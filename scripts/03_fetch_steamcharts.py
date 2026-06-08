"""
03_fetch_steamcharts.py — SteamCharts 月度 CCU 爬取
====================================================
从 steamcharts.com 爬取代表性游戏的月度在线数据，
用于计算年度 CCU 份额（供视图一"在线人数"切换使用）。

策略：
  1. 始终纳入 ~50 款人工策展的代表作（四类型 × 不同年代，含首发爆冲后崩盘的反例）
  2. 再从 game_db.json / Kaggle 数据中按类型补充 CCU 最高的游戏
  3. 爬取每款游戏的 SteamCharts 页面，解析月度数据表格
  4. 按年+类型聚合 → 输出 ccu_share.json；月度缓存供视图三个体衰减曲线使用

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
    选取代表性游戏。策展集（MUST_INCLUDE）始终纳入，再用分类器从全库按类型补充 top-CCU。
    """
    # 手动策展的代表性游戏：(appid, 名称, 类型)
    # 覆盖四类型 × 不同发行年代；刻意纳入"首发爆冲后崩盘"的例子（Among Us / Lethal Company /
    # New World / Lost Ark / Helldivers 2 / Valheim / Palworld），使个体模式不只剩常青幸存者，
    # 主动回应"精选幸存者"的质疑。
    # 分类依据：发行商规模 + 拥有量规模（非价格）；F2P 指免费 live-service。
    # appid 为 Steam 稳定 ID；标 ⚠ 的为较新作，建议上线前抽查一次。
    MUST_INCLUDE = [
        # ── AAA 单机大作（营销驱动，首发冲高后回落）──
        ("271590",  "Grand Theft Auto V",            "AAA"),   # 2015
        ("292030",  "The Witcher 3",                 "AAA"),   # 2015
        ("1245620", "Elden Ring",                    "AAA"),   # 2022
        ("1091500", "Cyberpunk 2077",                "AAA"),   # 2020
        ("1174180", "Red Dead Redemption 2",         "AAA"),   # 2019 ← 修正：原误标 F2P（R 星付费 3A）
        ("990080",  "Hogwarts Legacy",               "AAA"),   # 2023
        ("489830",  "Skyrim Special Edition",        "AAA"),   # 2016
        ("379720",  "DOOM (2016)",                   "AAA"),   # 2016
        ("1593500", "God of War (2018)",             "AAA"),   # 2022 PC
        ("1817070", "Marvel's Spider-Man Remastered","AAA"),   # 2022 PC ⚠
        ("1888930", "The Last of Us Part I",         "AAA"),   # 2023 PC ⚠
        ("2050650", "Resident Evil 4 (2023)",        "AAA"),   # 2023 ⚠
        ("1086940", "Baldur's Gate 3",               "AAA"),   # 2023（AAA/AA 可议）
        ("2358720", "Black Myth: Wukong",            "AAA"),   # 2024（与分类器手动覆盖保持一致）
        ("730",     "Counter-Strike 2",              "AAA"),   # 2012（注：现为免费 live-service，类型可议）

        # ── F2P 免费 live-service（曲线最平/常驻）──
        ("570",     "Dota 2",                        "F2P"),   # 2013
        ("440",     "Team Fortress 2",               "F2P"),   # 2007
        ("578080",  "PUBG: BATTLEGROUNDS",           "F2P"),   # 2017（2022 转免费）
        ("1172470", "Apex Legends",                  "F2P"),   # 2020 PC ← 修正：原误标 AAA
        ("1085660", "Destiny 2",                     "F2P"),   # 2019 PC ← 修正：原误标 Indie
        ("230410",  "Warframe",                      "F2P"),   # 2013 ← 修正：原误标 AA
        ("238960",  "Path of Exile",                 "F2P"),   # 2013
        ("386360",  "SMITE",                         "F2P"),   # 2015
        ("1599340", "Lost Ark",                      "F2P"),   # 2022（首发冲高后崩）
        ("2767030", "Marvel Rivals",                 "F2P"),   # 2024 ⚠

        # ── AA 中型（含首发爆冲后回落的例子）──
        ("252490",  "Rust",                          "AA"),    # 2018
        ("346110",  "ARK: Survival Evolved",         "AA"),    # 2017
        ("553850",  "Helldivers 2",                  "AA"),    # 2024（首发爆冲后回落）
        ("322330",  "Don't Starve Together",         "AA"),    # 2016
        ("264710",  "Subnautica",                    "AA"),    # 2018
        ("261550",  "Mount & Blade II: Bannerlord",  "AA"),    # 2020
        ("739630",  "Phasmophobia",                  "AA"),    # 2020（首发爆冲）
        ("1063730", "New World",                     "AA"),    # 2021（首发爆冲后崩）
        ("588650",  "Dead Cells",                    "AA"),    # 2018
        ("632360",  "Risk of Rain 2",                "AA"),    # 2020

        # ── Indie 独立（既有常青款，也有爆冲后回落款）──
        ("413150",  "Stardew Valley",                "Indie"), # 2016 常青
        ("105600",  "Terraria",                      "Indie"), # 2011 常青
        ("892970",  "Valheim",                       "Indie"), # 2021 爆冲后回落
        ("1623730", "Palworld",                      "Indie"), # 2024 爆冲后回落
        ("548430",  "Deep Rock Galactic",            "Indie"), # 2020
        ("367520",  "Hollow Knight",                 "Indie"), # 2017
        ("1145360", "Hades",                         "Indie"), # 2020
        ("646570",  "Slay the Spire",                "Indie"), # 2019
        ("504230",  "Celeste",                       "Indie"), # 2018
        ("250900",  "The Binding of Isaac: Rebirth", "Indie"), # 2014
        ("1794680", "Vampire Survivors",             "Indie"), # 2022
        ("945360",  "Among Us",                      "Indie"), # 2018→2020 病毒式爆冲后回落
        ("1966720", "Lethal Company",                "Indie"), # 2023 爆冲后回落 ⚠
        ("1426210", "It Takes Two",                  "Indie"), # 2021（Hazelight，AA 可议）
    ]

    # 1) 策展集始终纳入（不依赖 game_db 是否收录该游戏）
    selected = [{"appid": a, "name": nm, "type": t, "ccu": 0} for (a, nm, t) in MUST_INCLUDE]
    must_ids = {a for (a, _, _) in MUST_INCLUDE}

    # 2) 用分类器从全库按类型补充 top-CCU（丰富视图一的在线份额）
    from importlib.machinery import SourceFileLoader
    classify = None
    for p in [BASE_DIR / "05_preprocess.py", BASE_DIR / "scripts" / "05_preprocess.py"]:
        if p.exists():
            try:
                mod = SourceFileLoader("pp", str(p)).load_module()
                classify = mod.classify_game_type
                break
            except Exception:
                pass

    by_type = {"Indie": [], "AA": [], "AAA": [], "F2P": []}
    for r in records:
        appid = str(r.get("appid", ""))
        if not appid or appid in must_ids:
            continue
        ccu = int(r.get("ccu") or r.get("peak_ccu") or 0)
        if ccu <= 0:
            continue
        try:
            gtype = classify(r) if classify else "Indie"
        except Exception:
            gtype = "Indie"
        if gtype in by_type:
            by_type[gtype].append({"appid": appid, "name": r.get("name", ""), "ccu": ccu, "type": gtype})

    for gtype, games in by_type.items():
        games.sort(key=lambda g: -g["ccu"])
        selected.extend(games[:n_per_type])

    # 去重（策展集优先保留）
    seen, deduped = set(), []
    for g in selected:
        if g["appid"] and g["appid"] not in seen:
            seen.add(g["appid"])
            deduped.append(g)

    print(f"选取 {len(deduped)} 款代表性游戏（其中策展集 {len(must_ids)} 款必含）:")
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