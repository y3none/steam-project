"""
03_fetch_steamcharts.py — SteamCharts 月度 CCU 爬取
====================================================
从 steamcharts.com 爬取代表性游戏的月度在线数据，
用于计算年度 CCU 份额（供视图一"在线人数"切换使用）。

策略：
  1. 从 game_db.json / Kaggle 数据中选取各类型 CCU 最高的游戏
  2. 爬取每款游戏的 SteamCharts 页面，解析月度数据表格
  3. 按年+类型聚合 → 输出 ccu_share.json

用法：
  python 03_fetch_steamcharts.py

输出：
  data/processed/ccu_share.json — 年度 CCU 份额
  data/raw/steamcharts_raw.json — 原始月度数据（缓存）

注意：
  - SteamCharts 限速，每请求间隔 2 秒
  - 约 100 款游戏 × 2 秒 ≈ 3-4 分钟
  - 有缓存机制，重复运行不会重新爬取已有数据
"""

import json
import re
import time
import sys
from pathlib import Path
from datetime import datetime

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("需要安装依赖: pip install requests beautifulsoup4")
    sys.exit(1)

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
OUT_DIR = BASE_DIR / "data" / "processed"
RAW_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

CACHE_PATH = RAW_DIR / "steamcharts_raw.json"
OUTPUT_PATH = OUT_DIR / "ccu_share.json"

STEAMCHARTS_URL = "https://steamcharts.com/app/{appid}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html",
}


def load_game_db():
    """从 game_db.json 或 Kaggle 数据加载游戏列表"""
    # 优先 game_db.json
    db_path = RAW_DIR / "game_db.json"
    if db_path.exists():
        with open(db_path, encoding="utf-8") as f:
            records = json.load(f)
        print(f"从 game_db.json 加载 {len(records)} 款游戏")
        return records

    # 回退到 Kaggle
    for name in ["games.json", "kaggle_steam.json"]:
        path = RAW_DIR / name
        if path.exists():
            with open(path, encoding="utf-8") as f:
                raw = json.load(f)
            records = []
            if isinstance(raw, dict):
                for appid, g in raw.items():
                    if g.get("name"):
                        g["appid"] = str(appid)
                        records.append(g)
            print(f"从 {name} 加载 {len(records)} 款游戏")
            return records

    print("未找到游戏数据，请先运行 server.py 或放入 Kaggle 数据")
    return []


def select_top_games(records, n_per_type=25):
    """
    选取各类型 CCU 最高的游戏。
    手动指定一些必须包含的代表性游戏。
    """
    # 已知必须包含的代表性游戏 (appid, name, type)
    MUST_INCLUDE = {
        "730":     "AAA",   # CS2/CS:GO
        "570":     "F2P",   # Dota 2
        "578080":  "F2P",   # PUBG
        "271590":  "AAA",   # GTA V
        "1172470": "AAA",   # Apex Legends → actually F2P
        "440":     "F2P",   # TF2
        "292030":  "AAA",   # Witcher 3
        "1245620": "AAA",   # Elden Ring
        "2358720": "AAA",   # Black Myth
        "1086940": "AAA",   # BG3
        "413150":  "Indie", # Stardew Valley
        "105600":  "Indie", # Terraria
        "892970":  "Indie", # Valheim
        "1623730": "Indie", # Palworld
        "548430":  "Indie", # Deep Rock Galactic
        "252490":  "AA",    # Rust
        "346110":  "AA",    # ARK
        "1174180": "F2P",   # Red Dead Redemption 2
        "1085660": "Indie", # Destiny 2 → actually F2P
        "230410":  "AA",    # Warframe
    }

    # 先尝试用分类
    from importlib.machinery import SourceFileLoader
    classify = None
    for p in [BASE_DIR / "05_preprocess.py", BASE_DIR / "scripts" / "05_preprocess.py"]:
        if p.exists():
            try:
                mod = SourceFileLoader("pp", str(p)).load_module()
                classify = mod.classify_game_type
                break
            except:
                pass

    # 按类型分组，取 top CCU
    by_type = {"Indie": [], "AA": [], "AAA": [], "F2P": []}
    for r in records:
        appid = str(r.get("appid", ""))
        ccu = int(r.get("ccu") or r.get("peak_ccu") or 0)

        if appid in MUST_INCLUDE:
            gtype = MUST_INCLUDE[appid]
        elif classify:
            try:
                gtype = classify(r)
            except:
                gtype = "Indie"
        else:
            gtype = "Indie"

        if gtype in by_type:
            by_type[gtype].append({"appid": appid, "name": r.get("name", ""), "ccu": ccu, "type": gtype})

    selected = []
    for gtype, games in by_type.items():
        games.sort(key=lambda g: -g["ccu"])
        selected.extend(games[:n_per_type])

    # Deduplicate
    seen = set()
    deduped = []
    for g in selected:
        if g["appid"] not in seen:
            seen.add(g["appid"])
            deduped.append(g)

    print(f"选取 {len(deduped)} 款代表性游戏:")
    for gtype in ["AAA", "AA", "Indie", "F2P"]:
        count = sum(1 for g in deduped if g["type"] == gtype)
        print(f"  {gtype}: {count} 款")

    return deduped


def parse_steamcharts_page(html):
    """
    解析 SteamCharts 页面，提取月度数据。
    返回: [{month: "January 2024", avg: 786630.82, peak: 1347519}, ...]
    """
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="common-table")
    if not table:
        return []

    rows = table.find("tbody")
    if not rows:
        return []

    data = []
    for tr in rows.find_all("tr"):
        cells = tr.find_all("td")
        if len(cells) < 5:
            continue
        month_text = cells[0].text.strip()
        avg_text = cells[1].text.strip().replace(",", "")
        peak_text = cells[4].text.strip().replace(",", "")

        try:
            avg = float(avg_text) if avg_text else 0
            peak = int(float(peak_text)) if peak_text else 0
        except:
            continue

        data.append({
            "month": month_text,
            "avg": avg,
            "peak": peak,
        })

    return data


def fetch_steamcharts(games, cache=None):
    """爬取 SteamCharts 数据，带缓存"""
    if cache is None:
        cache = {}

    total = len(games)
    for i, game in enumerate(games):
        appid = game["appid"]
        if appid in cache and len(cache[appid].get("monthly", [])) > 0:
            continue

        url = STEAMCHARTS_URL.format(appid=appid)
        print(f"  [{i+1}/{total}] {game['name'][:30]:30s} ...", end=" ", flush=True)

        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                monthly = parse_steamcharts_page(resp.text)
                cache[appid] = {
                    "name": game["name"],
                    "type": game["type"],
                    "monthly": monthly,
                    "fetched_at": datetime.now().isoformat(),
                }
                print(f"✓ {len(monthly)} 个月")
            elif resp.status_code == 429:
                print(f"⚠ 限速, 等待 30s...")
                time.sleep(30)
                continue  # retry later
            else:
                print(f"✗ HTTP {resp.status_code}")
                cache[appid] = {"name": game["name"], "type": game["type"], "monthly": [], "error": resp.status_code}
        except Exception as e:
            print(f"✗ {e}")
            cache[appid] = {"name": game["name"], "type": game["type"], "monthly": [], "error": str(e)}

        time.sleep(2.0)

    return cache


def parse_month_to_year(month_str):
    """'January 2024' → 2024, 'Last 30 Days' → current year"""
    if "Last 30" in month_str:
        return datetime.now().year
    try:
        dt = datetime.strptime(month_str, "%B %Y")
        return dt.year
    except:
        # Try abbreviated month
        try:
            dt = datetime.strptime(month_str, "%b %Y")
            return dt.year
        except:
            return None


def compute_yearly_ccu_share(cache):
    """
    从月度数据计算年度 CCU 份额。

    方法：
    1. 每款游戏每年的"年度平均在线" = 该年所有月的 avg 的均值
    2. 按类型汇总：Indie 年度 CCU = 所有 Indie 游戏的年度平均在线之和
    3. 份额 = 类型年度 CCU / 全部类型年度 CCU 之和
    """
    # year → type → [avg_values]
    yearly = {}

    for appid, entry in cache.items():
        gtype = entry.get("type", "Indie")
        for m in entry.get("monthly", []):
            year = parse_month_to_year(m["month"])
            if not year or year < 2012:
                continue
            if year not in yearly:
                yearly[year] = {"Indie": [], "AA": [], "AAA": [], "F2P": []}
            if gtype in yearly[year]:
                yearly[year][gtype].append(m["avg"])

    # Compute shares
    records = []
    for year in sorted(yearly.keys()):
        type_avgs = {}
        for gtype in ["Indie", "AA", "AAA", "F2P"]:
            values = yearly[year].get(gtype, [])
            # Sum of yearly averages (each game contributes its avg)
            type_avgs[gtype] = sum(values)

        total = sum(type_avgs.values())
        if total == 0:
            continue

        records.append({
            "year": year,
            "ci": round(type_avgs["Indie"] / total * 100, 1),
            "ca": round(type_avgs["AA"] / total * 100, 1),
            "cb": round(type_avgs["AAA"] / total * 100, 1),
            "cf": round(type_avgs["F2P"] / total * 100, 1),
            # 绝对值（千人）
            "ci_abs": round(type_avgs["Indie"] / 1000, 1),
            "ca_abs": round(type_avgs["AA"] / 1000, 1),
            "cb_abs": round(type_avgs["AAA"] / 1000, 1),
            "cf_abs": round(type_avgs["F2P"] / 1000, 1),
        })

    return records


def main():
    print("=" * 56)
    print("SteamCharts 月度 CCU 数据爬取")
    print("=" * 56)

    # 1. 加载游戏列表
    print("\n[1/4] 加载游戏数据...")
    records = load_game_db()
    if not records:
        return

    # 2. 选取代表性游戏
    print("\n[2/4] 选取各类型代表性游戏...")
    games = select_top_games(records, n_per_type=25)

    # 3. 爬取 SteamCharts（带缓存）
    print("\n[3/4] 爬取 SteamCharts 月度数据...")
    cache = {}
    if CACHE_PATH.exists():
        with open(CACHE_PATH, encoding="utf-8") as f:
            cache = json.load(f)
        print(f"  已有缓存 {len(cache)} 款游戏")

    cache = fetch_steamcharts(games, cache)

    # 保存缓存
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    print(f"  缓存已保存至 {CACHE_PATH.name}")

    # 4. 计算年度 CCU 份额
    print("\n[4/4] 计算年度 CCU 份额...")
    ccu_share = compute_yearly_ccu_share(cache)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(ccu_share, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*56}")
    print(f"✓ 年度 CCU 份额数据已保存至 {OUTPUT_PATH}")
    print(f"  覆盖 {len(ccu_share)} 年 ({ccu_share[0]['year']}–{ccu_share[-1]['year']})")
    for r in ccu_share[-3:]:
        print(f"  {r['year']}: Indie {r['ci']}% | AA {r['ca']}% | AAA {r['cb']}% | F2P {r['cf']}%")
    print(f"{'='*56}")


if __name__ == "__main__":
    main()
