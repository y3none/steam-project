"""
Steam可视化项目 — 后端 API 服务
================================
数据策略：本地持久化 + 实时增量更新

  启动流程：
    1. 加载本地数据库 data/raw/game_db.json（所有历史爬取的累积）
    2. 加载 Kaggle 数据（如有），合并入数据库
    3. 实时爬取 SteamSpy Top100，增量更新数据库
    4. 处理 → 输出到 data/processed/ → API 供前端读取
    5. 后台持续爬取 SteamSpy 全量分页，每页处理后立即更新

  核心设计：
    - game_db.json 是唯一的本地数据真相源，只增不减
    - 每次爬取的新数据 merge 进 game_db.json 并持久化
    - processed/*.json 同步更新，前端可随时读到最新结果
    - 重启后从 game_db.json 秒级恢复，不需要重新爬取

启动：python server.py
访问：http://127.0.0.1:5000
"""

import json
import time
import threading
import requests
from pathlib import Path
from datetime import datetime

from flask import Flask, jsonify
from flask_cors import CORS

import importlib.util

BASE_DIR = Path(__file__).parent
RAW_DIR  = BASE_DIR / "data" / "raw"
OUT_DIR  = BASE_DIR / "data" / "processed"
RAW_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = RAW_DIR / "game_db.json"
STEAMSPY_URL = "https://steamspy.com/api.php"

# ── 加载预处理模块 ──────────────────────────────────
def load_preprocess_module():
    for path in [BASE_DIR / "05_preprocess.py",
                 BASE_DIR / "scripts" / "05_preprocess.py"]:
        if path.exists():
            spec = importlib.util.spec_from_file_location("preprocess", str(path))
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            print(f"[init] 预处理模块: {path}")
            return mod
    raise FileNotFoundError("找不到 05_preprocess.py")

preprocess = load_preprocess_module()

# ── Flask ────────────────────────────────────────────
VIS_DIR = BASE_DIR
for d in [BASE_DIR / "vis4", BASE_DIR / "frontend"]:
    if (d / "index.html").exists():
        VIS_DIR = d; break

app = Flask(__name__, static_folder=str(VIS_DIR), static_url_path='')
CORS(app)

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')


# ══════════════════════════════════════════════════
#  本地游戏数据库
# ══════════════════════════════════════════════════

class GameDB:
    """
    本地游戏数据库：以 appid 为 key 的字典。
    所有数据源（Kaggle / SteamSpy Top100 / SteamSpy 全量）都 merge 进来，
    持久化到 game_db.json。
    """
    def __init__(self):
        self._games = {}   # {appid: record_dict}
        self._lock = threading.Lock()
        self._dirty = False

    @property
    def count(self):
        return len(self._games)

    def load_from_disk(self):
        """从 game_db.json 恢复"""
        if DB_PATH.exists():
            with open(DB_PATH, encoding="utf-8") as f:
                records = json.load(f)
            with self._lock:
                for r in records:
                    aid = str(r.get("appid", ""))
                    if aid:
                        self._games[aid] = r
            print(f"[db] 从 game_db.json 恢复 {len(self._games)} 款游戏")
            return True
        return False

    def merge_records(self, records, source="unknown"):
        """
        合并一批记录，返回变化详情（新增/CCU变化/评价变化）。
        """
        added, updated = 0, 0
        changes = []
        with self._lock:
            for r in records:
                aid = str(r.get("appid", ""))
                if not aid or not r.get("name"):
                    continue
                new_ccu = r.get("ccu", 0) or 0
                new_pos = r.get("positive", 0) or 0

                if aid in self._games:
                    existing = self._games[aid]
                    game_name = existing.get("name", r.get("name", ""))
                    old_ccu = existing.get("ccu", 0) or 0
                    old_pos = existing.get("positive", 0) or 0
                    ccu_diff = new_ccu - old_ccu
                    pos_diff = new_pos - old_pos

                    # 记录有变化或有实时CCU的游戏
                    if ccu_diff != 0 or pos_diff > 0 or new_ccu > 0:
                        changes.append({
                            "appid": aid, "name": game_name,
                            "ccu": new_ccu, "ccu_diff": ccu_diff,
                            "pos_diff": max(0, pos_diff),
                        })

                    for key in ("ccu", "positive", "negative", "owners", "price_usd"):
                        new_val = r.get(key)
                        if new_val is not None and new_val != 0:
                            existing[key] = new_val
                    for key in ("release_date", "header_image", "genres",
                                "developers", "publishers", "tags"):
                        if not existing.get(key) and r.get(key):
                            existing[key] = r[key]
                    updated += 1
                else:
                    self._games[aid] = r
                    added += 1
                    if new_ccu > 0 or new_pos > 0:
                        changes.append({
                            "appid": aid, "name": r.get("name", ""),
                            "ccu": new_ccu, "ccu_diff": 0,
                            "pos_diff": 0, "is_new": True,
                        })
            self._dirty = True

        if added or updated:
            print(f"[db] 合并 [{source}]: +{added} 新增, ~{updated} 更新, {len(changes)} 条变化, 总计 {len(self._games)}")
        return changes

    def save_to_disk(self):
        """持久化到 game_db.json"""
        if not self._dirty:
            return
        with self._lock:
            records = list(self._games.values())
            self._dirty = False
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, separators=(",", ":"))
        size_mb = DB_PATH.stat().st_size / 1024 / 1024
        print(f"[db] 已保存 game_db.json ({len(records)} 款, {size_mb:.1f}MB)")

    def get_all_records(self):
        with self._lock:
            return list(self._games.values())


db = GameDB()


# ══════════════════════════════════════════════════
#  SteamSpy 爬取
# ══════════════════════════════════════════════════

def safe_get(url, params, retries=3, wait=2.0):
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=20)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 429:
                time.sleep(wait * (2 ** attempt))
        except requests.RequestException:
            time.sleep(wait)
    return None


STEAM_CCU_URL = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/"

def fetch_live_ccu(appids):
    """
    从 Steam 官方 API 批量获取实时在线人数。
    每个 appid 一个请求，并发获取（~1-2秒完成20个）。
    """
    import concurrent.futures
    results = {}

    def get_one(appid):
        try:
            resp = requests.get(STEAM_CCU_URL, params={"appid": appid}, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                count = data.get("response", {}).get("player_count")
                if count is not None:
                    return (str(appid), int(count))
        except:
            pass
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(get_one, aid): aid for aid in appids}
        for f in concurrent.futures.as_completed(futures):
            r = f.result()
            if r:
                results[r[0]] = r[1]

    return results


def _get_top_appids(n=20):
    """从数据库中取 CCU 最高的 n 个 appid"""
    with db._lock:
        games = list(db._games.values())
    games.sort(key=lambda g: -(g.get("ccu", 0) or 0))
    return [str(g["appid"]) for g in games[:n] if g.get("appid")]


def steamspy_to_records(games_dict):
    """将 SteamSpy API 响应转为统一记录格式"""
    records = []
    for appid, g in games_dict.items():
        tags = g.get("tags", {})
        if isinstance(tags, str):
            try: tags = json.loads(tags)
            except: tags = {}

        price_raw = g.get("price", 0)
        try:
            price_usd = float(price_raw) / 100 if price_raw else 0
        except:
            price_usd = 0

        genres = [g["genre"]] if g.get("genre") else []
        is_free = price_usd == 0 and ("Free to Play" in (tags or {}))

        records.append({
            "appid":        str(appid),
            "name":         g.get("name", ""),
            "release_date": "",
            "price_usd":    round(price_usd, 2),
            "is_free":      is_free,
            "positive":     int(g.get("positive", 0) or 0),
            "negative":     int(g.get("negative", 0) or 0),
            "owners":       g.get("owners", "0 .. 0"),
            "ccu":          int(g.get("ccu", 0) or 0),
            "tags":         tags if isinstance(tags, dict) else {},
            "genres":       genres,
            "developers":   [g["developer"]] if g.get("developer") else [],
            "publishers":   [g["publisher"]] if g.get("publisher") else [],
            "header_image": "",
        })
    return records


def load_kaggle_files():
    """加载本地 Kaggle JSON 文件"""
    for name in ["games.json", "kaggle_steam.json", "steam_games.json"]:
        path = RAW_DIR / name
        if path.exists():
            print(f"[kaggle] 读取 {name}...")
            with open(path, encoding="utf-8") as f:
                raw = json.load(f)

            records = []
            if isinstance(raw, dict):
                for appid, g in raw.items():
                    if not g.get("name"):
                        continue
                    price = float(g.get("price", 0) or 0)
                    tags = g.get("tags", {})
                    if isinstance(tags, list): tags = {t: 1 for t in tags}
                    genres = g.get("genres", [])
                    if isinstance(genres, str): genres = [genres]

                    records.append({
                        "appid":        str(appid),
                        "name":         g["name"],
                        "release_date": g.get("release_date", ""),
                        "price_usd":    round(price, 2),
                        "is_free":      price == 0 and (
                            "Free to Play" in genres or
                            "Free to Play" in (tags if isinstance(tags, dict) else {})
                        ),
                        "positive":     int(g.get("positive", 0) or 0),
                        "negative":     int(g.get("negative", 0) or 0),
                        "owners":       (g.get("estimated_owners", "0 - 0") or "0 - 0")
                                         .replace(" - ", " .. "),
                        "ccu":          int(g.get("peak_ccu", 0) or 0),
                        "tags":         tags,
                        "genres":       genres,
                        "developers":   g.get("developers", []) or [],
                        "publishers":   g.get("publishers", []) or [],
                        "header_image": g.get("header_image", ""),
                    })
            return records
    return []


# ══════════════════════════════════════════════════
#  数据处理 & 持久化
# ══════════════════════════════════════════════════

def process_and_save(records):
    """处理记录 → 返回四个视图数据 → 同时保存到 data/processed/"""
    import pandas as pd
    df = pd.DataFrame(records)
    df["appid"] = df["appid"].astype(str)

    df_main, df_reviewed = preprocess.build_main_df(df)
    market  = preprocess.process_market_share(df_main)
    bubbles = preprocess.process_bubbles(df_reviewed)
    decay   = preprocess.process_decay(df_reviewed)
    meta    = preprocess.cal_meta(df_main, df_reviewed)

    # 持久化到 processed/
    def save(data, name):
        path = OUT_DIR / name
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    save(market,  "market_share.json")
    save(bubbles, "bubbles.json")
    save(decay,   "decay.json")
    save(meta,    "meta.json")
    print(f"[processed] 已更新 data/processed/ (4 files)")

    return {
        "market": market,  "bubbles": bubbles,
        "decay": decay,    "meta": meta,
        "total_games": len(df_main),
        "reviewed_games": len(df_reviewed),
    }


# ══════════════════════════════════════════════════
#  API 数据缓存
# ══════════════════════════════════════════════════

class DataStore:
    def __init__(self):
        self.market = self.bubbles = self.decay = self.meta = None
        self.status = {
            "loaded": False,
            "loading": False,
            "phase": "init",      # init → restoring → kaggle → top100 → ready → crawling
            "total_games": 0,
            "reviewed_games": 0,
            "loaded_at": None,
            "load_time_sec": 0,
            "error": None,
            "crawl": {"active": False, "pages": 0, "games": 0},
        }
        self._lock = threading.Lock()

    def _apply(self, result, phase, elapsed):
        with self._lock:
            self.market  = result["market"]
            self.bubbles = result["bubbles"]
            self.decay   = result["decay"]
            self.meta    = result["meta"]
            self.status.update({
                "loaded": True, "loading": False, "phase": phase,
                "total_games": result["total_games"],
                "reviewed_games": result["reviewed_games"],
                "loaded_at": datetime.now().isoformat(),
                "load_time_sec": round(elapsed, 2),
                "error": None,
            })

    # ── 启动流程 ──────────────────────────────────

    def startup(self):
        """完整的启动流程"""
        with self._lock:
            self.status["loading"] = True
        total_t0 = time.time()

        # 阶段 1：从 game_db.json 恢复历史数据
        with self._lock:
            self.status["phase"] = "restoring"
        restored = db.load_from_disk()

        # 阶段 2：合并 Kaggle 数据
        with self._lock:
            self.status["phase"] = "kaggle"
        kaggle_records = load_kaggle_files()
        if kaggle_records:
            db.merge_records(kaggle_records, source="Kaggle")

        # 如果有历史数据，先处理一版给前端用（秒级启动）
        if db.count > 0:
            t0 = time.time()
            try:
                result = process_and_save(db.get_all_records())
                phase = "restored" if restored else "kaggle"
                self._apply(result, phase, time.time() - t0)
                print(f"[startup] ✓ 本地数据就绪: {result['total_games']} 款, {time.time()-t0:.1f}s")
            except Exception as e:
                print(f"[startup] 本地数据处理失败: {e}")
                import traceback; traceback.print_exc()

        # 阶段 3：实时爬取 SteamSpy Top100
        with self._lock:
            self.status["phase"] = "top100"
            self.status["loading"] = True
        try:
            print("[startup] 实时爬取 SteamSpy Top100...")
            endpoints = ["top100forever", "top100in2weeks", "top100owned"]
            all_games = {}
            for ep in endpoints:
                data = safe_get(STEAMSPY_URL, {"request": ep})
                if data:
                    for appid, game in data.items():
                        game["appid"] = str(appid)
                        all_games[str(appid)] = game
                time.sleep(1.5)

            if all_games:
                records = steamspy_to_records(all_games)
                db.merge_records(records, source="SteamSpy Top100")
                db.save_to_disk()

                t0 = time.time()
                result = process_and_save(db.get_all_records())
                self._apply(result, "ready", time.time() - t0)
                print(f"[startup] ✓ Top100 合并完成: {result['total_games']} 款")
            else:
                print("[startup] SteamSpy Top100 获取失败，使用本地数据")
                with self._lock:
                    self.status["loading"] = False
                    self.status["phase"] = "ready"

        except Exception as e:
            print(f"[startup] Top100 爬取异常: {e}")
            with self._lock:
                self.status["loading"] = False
                self.status["phase"] = "ready"
                self.status["error"] = str(e)

        elapsed = time.time() - total_t0
        print(f"[startup] 启动完成, 总耗时 {elapsed:.1f}s, 数据库 {db.count} 款游戏")

    # ── 全量爬取 ──────────────────────────────────

    def crawl_full(self):
        """后台全量爬取 SteamSpy，每页增量更新"""
        with self._lock:
            if self.status["crawl"]["active"]:
                return
            self.status["crawl"] = {"active": True, "pages": 0, "games": 0}
            self.status["phase"] = "crawling"

        page = 0
        try:
            while True:
                data = safe_get(STEAMSPY_URL, {"request": "all", "page": str(page)})
                if not data or len(data) == 0:
                    break

                records = steamspy_to_records(data)
                db.merge_records(records, source=f"SteamSpy page {page}")
                page += 1

                with self._lock:
                    self.status["crawl"]["pages"] = page
                    self.status["crawl"]["games"] = db.count

                # 每 5 页保存一次数据库 + 更新 processed
                if page % 5 == 0:
                    db.save_to_disk()
                    try:
                        t0 = time.time()
                        result = process_and_save(db.get_all_records())
                        self._apply(result, "crawling", time.time() - t0)
                        print(f"[crawl] 第{page}页后更新: {result['total_games']} 款")
                    except Exception as e:
                        print(f"[crawl] 处理异常（跳过）: {e}")

                time.sleep(61)

            # 爬取结束，最终保存 + 处理
            db.save_to_disk()
            t0 = time.time()
            result = process_and_save(db.get_all_records())
            self._apply(result, "ready", time.time() - t0)
            print(f"[crawl] ✓ 全量爬取完成: {page} 页, {result['total_games']} 款游戏")

        except Exception as e:
            print(f"[crawl] 爬取异常: {e}")
        finally:
            with self._lock:
                self.status["crawl"]["active"] = False
                self.status["phase"] = "ready"


store = DataStore()


# ── API 端点 ────────────────────────────────────────

@app.route("/api/market")
def api_market():
    if not store.status["loaded"]:
        return jsonify({"error": "数据加载中", "status": store.status}), 503
    return jsonify(store.market)

@app.route("/api/bubbles")
def api_bubbles():
    if not store.status["loaded"]:
        return jsonify({"error": "数据加载中", "status": store.status}), 503
    return jsonify(store.bubbles)

@app.route("/api/decay")
def api_decay():
    if not store.status["loaded"]:
        return jsonify({"error": "数据加载中", "status": store.status}), 503
    return jsonify(store.decay)

@app.route("/api/meta")
def api_meta():
    if not store.status["loaded"]:
        return jsonify({"error": "数据加载中", "status": store.status}), 503
    return jsonify(store.meta)

@app.route("/api/status")
def api_status():
    return jsonify(store.status)

@app.route("/api/data")
def api_data():
    """秒级返回：直接返回内存中的已处理数据，不等待爬取"""
    if not store.status["loaded"]:
        return jsonify({"error": "数据尚未加载", "status": store.status}), 503
    return jsonify({
        "market":  store.market,
        "bubbles": store.bubbles,
        "decay":   store.decay,
        "meta":    store.meta,
        "total_in_db": db.count,
        "phase":   store.status["phase"],
        "loaded_at": store.status["loaded_at"],
    })

@app.route("/api/refresh")
def api_refresh():
    """
    实时刷新：从 Steam 官方 API 获取当前在线人数（秒级变化），
    不重复调用 SteamSpy（日更快照）。
    """
    t0 = time.time()
    try:
        # 从数据库中取 CCU 最高的游戏，查询实时在线
        top_appids = _get_top_appids(20)
        live_ccu = fetch_live_ccu(top_appids)

        # 对比旧 CCU，生成变化
        changes = []
        with db._lock:
            for appid, new_ccu in live_ccu.items():
                if appid in db._games:
                    g = db._games[appid]
                    old_ccu = g.get("ccu", 0) or 0
                    diff = new_ccu - old_ccu
                    changes.append({
                        "appid": appid,
                        "name": g.get("name", appid),
                        "ccu": new_ccu,
                        "ccu_diff": diff,
                    })
                    # 更新数据库中的 CCU
                    g["ccu"] = new_ccu

        changes.sort(key=lambda c: abs(c.get("ccu_diff", 0)), reverse=True)
        ccu_up   = [c for c in changes if c.get("ccu_diff", 0) > 0][:5]
        ccu_down = [c for c in changes if c.get("ccu_diff", 0) < 0][:5]
        top_ccu_now = sorted(changes, key=lambda c: -(c.get("ccu", 0)))[:5]

        return jsonify({
            "market":  store.market,
            "bubbles": store.bubbles,
            "decay":   store.decay,
            "meta":    store.meta,
            "total_in_db": db.count,
            "elapsed_sec": round(time.time() - t0, 2),
            "live_changes": {
                "timestamp": datetime.now().isoformat(),
                "total_updated": len(live_ccu),
                "ccu_rising": ccu_up,
                "ccu_falling": ccu_down,
                "top_ccu_now": top_ccu_now,
                "new_games": [],
                "new_reviews": [],
            },
        })
    except Exception as e:
        print(f"[refresh] 失败: {e}")
        import traceback; traceback.print_exc()
        if store.status["loaded"]:
            return jsonify({
                "market": store.market, "bubbles": store.bubbles,
                "decay": store.decay,   "meta": store.meta,
                "total_in_db": db.count,
                "live_changes": {"total_updated": 0, "top_ccu_now": [],
                                 "ccu_rising": [], "ccu_falling": [],
                                 "new_games": [], "new_reviews": []},
                "error": str(e),
            })
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"[refresh] 失败: {e}")
        import traceback; traceback.print_exc()
        if store.status["loaded"]:
            return jsonify({
                "market": store.market, "bubbles": store.bubbles,
                "decay": store.decay,   "meta": store.meta,
                "freshly_crawled": 0, "total_in_db": db.count,
                "error": str(e),
            })
        return jsonify({"error": str(e)}), 500

@app.route("/api/reload", methods=["POST"])
def api_reload():
    """重新执行启动流程（重新爬取 Top100 + 合并）"""
    if store.status["loading"]:
        return jsonify({"message": "正在加载中"}), 409
    thread = threading.Thread(target=store.startup, daemon=True)
    thread.start()
    return jsonify({"message": "已触发重新加载"})

@app.route("/api/crawl/start", methods=["POST"])
def api_crawl_start():
    """启动全量爬取"""
    if store.status["crawl"]["active"]:
        return jsonify({"message": "爬取进行中", "crawl": store.status["crawl"]}), 409
    thread = threading.Thread(target=store.crawl_full, daemon=True)
    thread.start()
    return jsonify({"message": "已启动全量爬取"})

@app.route("/api/crawl/status")
def api_crawl_status():
    return jsonify(store.status["crawl"])

@app.route("/api/db/stats")
def api_db_stats():
    return jsonify({"total_in_db": db.count, "db_path": str(DB_PATH)})


# ── 启动 ────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    thread = threading.Thread(target=store.startup, daemon=True)
    thread.start()

    print(f"""
{'='*56}
  Steam 可视化 API
  http://{args.host}:{args.port}

  数据流:
    game_db.json ← Kaggle + SteamSpy 累积
         ↓
    05_preprocess.py 处理
         ↓
    data/processed/*.json ← 持久化
         ↓
    /api/* ← 前端实时读取

  API:
    GET  /api/market|bubbles|decay|meta   视图数据
    GET  /api/status                      加载状态
    GET  /api/db/stats                    数据库统计
    POST /api/reload                      重新加载
    POST /api/crawl/start                 启动全量爬取
{'='*56}
""")

    app.run(host=args.host, port=args.port, debug=False)