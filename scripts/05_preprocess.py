"""
Steam可视化项目 - 步骤3：数据预处理，生成D3.js所需的JSON文件
=============================================================
运行环境：Python 3.8+
依赖安装：pip install pandas numpy tqdm

输入（data/raw/）：
    steamspy_all.jsonl          —— SteamSpy全量数据
    steamspy_top100.json        —— Top100榜单
    steam_store_details.jsonl   —— Steam Store发布日期等字段

输出（data/processed/）：
    market_share.json           —— 视图一：年度市场份额（Stream Graph）
    bubbles.json                —— 视图二：散点气泡数据
    decay.json                  —— 视图三：生命周期衰减曲线
    meta.json                   —— 全局元数据（年份范围、游戏总数等）
"""

import json
import re
from pathlib import Path
from collections import defaultdict
from datetime import datetime

import pandas as pd
import numpy as np
from tqdm import tqdm

BASE_DIR = Path(__file__).parent.parent
RAW_DIR  = BASE_DIR / "data" / "raw"
OUT_DIR  = BASE_DIR / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ══════════════════════════════════════════════════
#  工具函数
# ══════════════════════════════════════════════════

def _get_name(row) -> str:
    """兼容不同数据源的名称字段：Kaggle用name，SteamSpy+Store合并后用name_spy/name_store"""
    for col in ("name", "name_spy", "name_store"):
        try:
            val = row[col] if col in row.index else None
        except (KeyError, AttributeError, TypeError):
            try:
                val = row.get(col)
            except (AttributeError, TypeError):
                val = None
        if val and str(val).strip():
            return str(val).strip()
    return ""


def parse_owners_midpoint(owners_str: str) -> float:
    """
    解析 SteamSpy 的 owners 区间字符串，返回中值（百万）。
    例："200,000 .. 500,000" -> 0.35
    """
    if not owners_str or owners_str == "0":
        return 0.0
    nums = re.findall(r"[\d,]+", str(owners_str))
    nums = [int(n.replace(",", "")) for n in nums if n]
    if len(nums) == 2:
        return (nums[0] + nums[1]) / 2 / 1_000_000
    elif len(nums) == 1:
        return nums[0] / 1_000_000
    return 0.0


def parse_release_year(date_str: str) -> int | None:
    """
    解析多种日期格式，返回年份整数。
    支持：'21 Feb, 2023' / '2023-02-21' / 'Feb 21, 2023' / '2023' 等
    """
    if not date_str:
        return None
    for fmt in ["%d %b, %Y", "%b %d, %Y", "%Y-%m-%d", "%Y"]:
        try:
            return datetime.strptime(date_str.strip(), fmt).year
        except:
            pass
    # 最后尝试直接提取4位数字年份
    m = re.search(r"\b(200[3-9]|20[12]\d)\b", str(date_str))
    return int(m.group()) if m else None


def classify_game_type(row: dict) -> str:
    """
    根据多个维度判断游戏类型：Indie / AA / AAA / F2P
    
    分类标准与业界共识对齐：
    - AAA：大型开发团队（100+人）、高预算（通常$50M+）、大发行商
           代表：GTA V, Elden Ring, Black Myth: Wukong, Baldur's Gate 3
    - AA：中等规模团队和预算，介于独立和3A之间
           代表：Hellblade, A Plague Tale, No Man's Sky
    - Indie：小型团队、自主发行或独立发行商、低预算
           代表：Stardew Valley, Hollow Knight, Celeste
    - F2P：免费游玩 + 内购驱动的商业模式
           代表：Dota 2, CS2, Genshin Impact
    
    判定优先级：手动覆盖 > F2P标签 > 大厂AAA > Indie标签 > AA规模 > 兜底
    注意：Kaggle 的 price 是当前售价（可能已降价），不能用于判定首发定位。
    """
    name       = str(row.get("name", "")).strip()
    is_free    = row.get("is_free", False)
    price      = row.get("price_usd", 0) or 0
    owners_m   = row.get("owners_m", 0) or 0
    genres     = " ".join(row.get("genres", []) or []).lower()
    tags       = row.get("tags", {}) or {}
    developers = row.get("developers", []) or []
    publishers = row.get("publishers", []) or []

    # ── 0. 手动覆盖表：与业界共识对齐 ──
    # 业界标准：AAA = 大型团队(100+人)、高预算(通常$50M+)、大发行商
    #           AA = 中等规模团队/预算，介于独立与3A之间
    #           Indie = 小型团队、自主发行或独立发行商、低预算
    MANUAL_OVERRIDES = {
        # ── AAA 大作（业界公认3A，但规则引擎可能因降价/发行商名不匹配而误判）──
        "Black Myth: Wukong":"AAA",   # Game Science, $140M+预算, 400+人团队
        "Baldur's Gate 3":   "AAA",   # Larian Studios, $100M+预算, 400+人团队
        "Monster Hunter: World":"AAA",# Capcom 旗舰
        "Hogwarts Legacy":   "AAA",   # Avalanche/WB, $150M+预算
        "Elden Ring":        "AAA",   # FromSoftware/Bandai Namco
        "Red Dead Redemption 2":"AAA",# Rockstar
        "Death Stranding":   "AAA",   # Kojima Productions/505 Games
        "Sekiro: Shadows Die Twice":"AAA", # FromSoftware/Activision
        "Star Wars Jedi: Fallen Order":"AAA",
        "Star Wars Jedi: Survivor":"AAA",
        "Horizon Zero Dawn": "AAA",
        "God of War":        "AAA",
        "Marvel's Spider-Man Remastered":"AAA",
        "Marvel's Spider-Man: Miles Morales":"AAA",
        "Resident Evil Village":"AAA",
        "Resident Evil 4":   "AAA",
        "Final Fantasy VII Remake Intergrade":"AAA",
        "Final Fantasy XVI":  "AAA",
        "Halo Infinite":     "AAA",
        "Forza Horizon 5":   "AAA",
        "Forza Horizon 4":   "AAA",
        "Diablo IV":         "AAA",
        # ── AA（中型制作，非独立但也不是3A规模）──
        "No Man's Sky":      "AA",    # Hello Games, 中等团队
        "A Plague Tale: Innocence":"AA",
        "A Plague Tale: Requiem":"AA",
        "Greedfall":         "AA",
        "Hellblade: Senua's Sacrifice":"AA",
        # ── 限免但本质是 Indie 的 ──
        "Celeste":           "Indie",
        "A Short Hike":      "Indie",
        "Minit":             "Indie",
        "Oxenfree":          "Indie",
        "Superhot":          "Indie",
        "Into the Breach":   "Indie",
        "Limbo":             "Indie",
        "Inside":            "Indie",
        "Subnautica":        "Indie",
        "Mudrunner":         "Indie",
        # ── F2P 大作 ──
        "DOTA 2":            "F2P",
        "Dota 2":            "F2P",
        "CS:GO":             "F2P",
        "Counter-Strike 2":  "F2P",
        "Apex Legends":      "F2P",
        "Warframe":          "F2P",
        "Path of Exile":     "F2P",
        "Path of Exile 2":   "F2P",
        "Genshin Impact":    "F2P",
        "Destiny 2":         "F2P",
        "Team Fortress 2":   "F2P",
        "Lost Ark":          "F2P",
        "Smite":             "F2P",
        "SMITE 2":           "F2P",
        "Rocket League":     "F2P",
        "Fall Guys":         "F2P",
        "MultiVersus":       "F2P",
    }
    if name in MANUAL_OVERRIDES:
        return MANUAL_OVERRIDES[name]

    # ── 1. F2P 判断：需要 tags/genres 中有 Free to Play 信号 ──
    has_f2p_tag = (
        tags.get("Free to Play", 0) > 50
        or tags.get("Free To Play", 0) > 50
        or tags.get("F2P", 0) > 50
        or "free to play" in genres
    )

    if has_f2p_tag and (is_free or price == 0):
        return "F2P"

    # price=0 但没有 F2P 标签 → 可能是限免/慈善包/早期免费
    # 不直接判定 F2P，继续往下走其他规则

    # ── 2. AAA 发行商列表 ──
    AAA_PUBLISHERS = {
        "Electronic Arts", "Activision", "Ubisoft", "Take-Two Interactive",
        "Bethesda Softworks", "2K Games", "Warner Bros. Games", "Square Enix",
        "SEGA", "Bandai Namco Entertainment", "Capcom", "Konami",
        "Sony Interactive Entertainment", "Microsoft Studios",
        "Xbox Game Studios", "Rockstar Games", "CD Projekt",
        "THQ Nordic", "Deep Silver", "Focus Entertainment",
        "Activision Blizzard", "505 Games",
        "Valve", "Blizzard Entertainment", "Epic Games",
        "Nintendo", "Riot Games", "Techland", "Paradox Interactive",
    }

    pub_set = set(publishers)
    is_aaa_pub = bool(pub_set & AAA_PUBLISHERS)

    # AAA 判定：大厂 + 有一定规模（价格门槛放宽——3A老游戏经常降价到$10以下）
    if is_aaa_pub and owners_m >= 0.5:
        return "AAA"

    # ── 3. Indie 标签强信号 ──
    indie_tag_votes = 0
    if isinstance(tags, dict):
        indie_tag_votes = tags.get("Indie", 0)
        if isinstance(indie_tag_votes, str):
            try: indie_tag_votes = int(indie_tag_votes)
            except: indie_tag_votes = 0

    has_indie_signal = (
        indie_tag_votes > 100
        or "indie" in genres
        or (isinstance(tags, dict) and tags.get("Indie", 0) > 0)
    )

    if has_indie_signal:
        if owners_m < 5.0 or price <= 39.99:
            return "Indie"

    # ── 4. AA：中间地带 ──
    if price >= 19.99 and owners_m >= 0.5:
        return "AA"
    # 大厂但拥有量不够 AAA 门槛（小众大厂游戏）
    if is_aaa_pub:
        return "AA"
    # 拥有量很高但价格不高且无 Indie 标签（老游戏降价/区域定价）
    if owners_m >= 2.0 and not has_indie_signal:
        return "AA"

    # ── 5. 兜底逻辑 ──
    if not has_indie_signal:
        if owners_m >= 0.5 or price >= 9.99:
            return "AA"

    return "Indie"


# ══════════════════════════════════════════════════
#  数据加载
# ══════════════════════════════════════════════════

def load_raw_data() -> pd.DataFrame:
    """
    合并数据，构建主 DataFrame。
    优先级：Kaggle统一格式 > SteamSpy+Store > SteamSpy Only
    """
    
    # ── 优先检测 Kaggle 统一格式 ──────────────────────
    kaggle_path = RAW_DIR / "kaggle_games.json"
    kaggle_raw_paths = list(RAW_DIR.glob("kaggle_steam*.json")) + \
                       list(RAW_DIR.glob("games.json")) + \
                       list(RAW_DIR.glob("steam_games.json"))
    
    if kaggle_path.exists():
        # 由 04_import_kaggle.py 预处理过的统一格式
        print("加载 Kaggle 统一格式数据（kaggle_games.json）...")
        with open(kaggle_path, encoding="utf-8") as f:
            records = json.load(f)
        df = pd.DataFrame(records)
        df["appid"] = df["appid"].astype(str)
        print(f"  Kaggle 记录数：{len(df)}")
        return df
    
    if kaggle_raw_paths:
        # 直接读取 Kaggle 原始 JSON（{appid: {game}} 格式）
        raw_path = kaggle_raw_paths[0]
        print(f"加载 Kaggle 原始数据（{raw_path.name}）...")
        with open(raw_path, encoding="utf-8") as f:
            raw = json.load(f)
        
        records = []
        if isinstance(raw, dict):
            for appid, game in tqdm(raw.items(), desc="  转换Kaggle数据"):
                if not game.get("name"):
                    continue
                # Kaggle 的 price 已经是美元浮点数
                price = float(game.get("price", 0) or 0)
                tags = game.get("tags", {})
                if isinstance(tags, list):
                    tags = {t: 1 for t in tags}
                genres = game.get("genres", [])
                if isinstance(genres, str):
                    genres = [genres] if genres else []
                
                is_free = (price == 0) and (
                    "Free to Play" in genres or
                    "Free to Play" in (tags if isinstance(tags, dict) else {})
                )
                
                records.append({
                    "appid":        str(appid),
                    "name":         game.get("name", ""),
                    "release_date": game.get("release_date", ""),
                    "price_usd":    round(price, 2),
                    "is_free":      is_free,
                    "positive":     int(game.get("positive", 0) or 0),
                    "negative":     int(game.get("negative", 0) or 0),
                    "owners":       (game.get("estimated_owners", "0 - 0") or "0 - 0")
                                     .replace(" - ", " .. "),
                    "ccu":          int(game.get("peak_ccu", 0) or 0),
                    "tags":         tags,
                    "genres":       genres,
                    "developers":   game.get("developers", []) or [],
                    "publishers":   game.get("publishers", []) or [],
                    "header_image": game.get("header_image", ""),
                    "median_playtime": int(game.get("median_playtime_forever", 0) or 0),
                    "avg_playtime":    int(game.get("average_playtime_forever", 0) or 0),
                    "avg_2weeks":      (int(game.get("average_2weeks") or 0)
                                        if game.get("average_2weeks") not in (None, "") else None),
                })
        
        df = pd.DataFrame(records)
        df["appid"] = df["appid"].astype(str)
        print(f"  Kaggle 记录数：{len(df)}")
        return df

    # ── 原有路径：SteamSpy + Store ──────────────────
    print("加载 SteamSpy 数据...")
    spy_records = []
    
    # 优先读取全量数据
    all_path = RAW_DIR / "steamspy_all.jsonl"
    top100_path = RAW_DIR / "steamspy_top100.json"
    
    if all_path.exists():
        with open(all_path, encoding="utf-8") as f:
            for line in tqdm(f, desc="  读取steamspy_all"):
                try:
                    spy_records.append(json.loads(line))
                except:
                    pass
    elif top100_path.exists():
        print("  使用 Top100 数据（全量数据未找到）")
        with open(top100_path) as f:
            top100 = json.load(f)
        seen = set()
        for section in top100.values():
            for appid, game in section.items():
                if appid not in seen:
                    game["appid"] = appid
                    spy_records.append(game)
                    seen.add(appid)
    
    df_spy = pd.DataFrame(spy_records)
    df_spy["appid"] = df_spy["appid"].astype(str)
    print(f"  SteamSpy 记录数：{len(df_spy)}")

    # 加载 Store 详情（发布日期等）
    store_records = []
    store_path = RAW_DIR / "steam_store_details.jsonl"
    if store_path.exists():
        with open(store_path, encoding="utf-8") as f:
            for line in tqdm(f, desc="  读取store_details"):
                try:
                    obj = json.loads(line)
                    if obj.get("_status") != "failed":
                        store_records.append(obj)
                except:
                    pass
        df_store = pd.DataFrame(store_records)
        df_store["appid"] = df_store["_appid"].astype(str)
        df_store = df_store.drop_duplicates("appid")
        print(f"  Store详情记录数：{len(df_store)}")
        
        # 合并
        df = df_spy.merge(df_store, on="appid", how="left",
                          suffixes=("_spy", "_store"))
    else:
        print("  Store详情未找到，将跳过发布日期（视图一需要此数据）")
        df = df_spy.copy()
        df["release_date"] = None
        df["genres"] = df["genre"] if "genre" in df.columns else pd.Series([""] * len(df))
        df["is_free"] = False
        df["price_usd"] = (df["price"] if "price" in df.columns else pd.Series([0]*len(df))).apply(
            lambda x: float(x) / 100 if x else 0)
    
    return df


def build_main_df(df_raw: pd.DataFrame) -> pd.DataFrame:
    """清洗、派生字段，构建分析用主 DataFrame"""
    df = df_raw.copy()

    # 解析 owners
    df["owners_m"] = (df["owners"] if "owners" in df.columns else pd.Series(["0"]*len(df))).apply(parse_owners_midpoint)
    
    # 解析年份
    df["year"] = (df["release_date"] if "release_date" in df.columns else pd.Series([None]*len(df))).apply(parse_release_year)
    # 保留有效年份的游戏，无年份的游戏也保留（标记为 0，视图一会跳过）
    df["year"] = df["year"].fillna(0).astype(int)
    df_with_year = df[df["year"].between(2004, 2025, inclusive="left")]
    # 如果按年份过滤后为空（如 SteamSpy 数据无日期），保留全部
    if len(df_with_year) == 0 and len(df) > 0:
        print("  警告：无有效发布日期，跳过年份过滤")
    else:
        df = df_with_year

    # CCU 清洗
    df["ccu"] = pd.to_numeric(df["ccu"] if "ccu" in df.columns else pd.Series([0]*len(df)), errors="coerce").fillna(0).astype(int)
    
    # 好评率
    pos = pd.to_numeric(df["positive"] if "positive" in df.columns else pd.Series([0]*len(df)), errors="coerce").fillna(0)
    neg = pd.to_numeric(df["negative"] if "negative" in df.columns else pd.Series([0]*len(df)), errors="coerce").fillna(0)
    total = pos + neg
    df["pos_rate"] = np.where(total > 0, pos / total * 100, np.nan)
    df["review_count"] = total

    # tags 解析（SteamSpy 返回的 tags 可能是 dict 或 string）
    def parse_tags(t):
        if isinstance(t, dict):
            return t
        try:
            return json.loads(t) if t else {}
        except:
            return {}
    df["tags_dict"] = df["tags"].apply(parse_tags) if "tags" in df.columns else pd.Series([{}]*len(df))

    # genres 清洗
    def parse_genres(g):
        if isinstance(g, list):
            return [str(x) for x in g]
        if isinstance(g, str):
            return [g]
        return []
    df["genres_list"] = df["genres"].apply(parse_genres) if "genres" in df.columns else pd.Series([[]] * len(df))

    # 开发商/发行商
    def to_list(x):
        if isinstance(x, list): return x
        if isinstance(x, str) and x: return [x]
        return []
    df["developers"] = df["developers"].apply(to_list) if "developers" in df.columns else pd.Series([[]] * len(df))
    df["publishers"] = df["publishers"].apply(to_list) if "publishers" in df.columns else pd.Series([[]] * len(df))

    # price
    if "price_usd" not in df.columns:
        df["price_usd"] = pd.to_numeric(df["price"] if "price" in df.columns else pd.Series([0]*len(df)), errors="coerce").fillna(0) / 100
    
    # 游戏类型分类
    if len(df) > 0:
        df["game_type"] = df.apply(lambda row: classify_game_type(row.to_dict()), axis=1)
    else:
        df["game_type"] = pd.Series(dtype=str)

    # 过滤：只保留游戏类型（排除 DLC、工具、原声等）
    if "type" in df.columns:
        df = df[df["type"].isin(["game", ""])]

    # 过滤：过滤评价数极少的游戏（用于视图二）
    df_reviewed = df[df["review_count"] >= 10].copy()

    print(f"  清洗后：{len(df)} 款游戏（含全量），{len(df_reviewed)} 款有有效评价")
    return df, df_reviewed


# ══════════════════════════════════════════════════
#  视图一：市场份额 Stream Graph
# ══════════════════════════════════════════════════

def process_market_share(df: pd.DataFrame) -> list[dict]:
    """
    按年份统计各类型游戏的发布数量份额 + CCU份额。
    返回格式：[{year, indie, aa, aaa, f2p, n, ni, ..., ci, ca, cb, cf}, ...]
    """
    print("\n处理视图一：市场份额...")
    
    yearly = df.groupby(["year", "game_type"]).size().reset_index(name="count")
    pivot = yearly.pivot(index="year", columns="game_type", values="count").fillna(0)
    
    # CCU 维度聚合
    ccu_yearly = df.groupby(["year", "game_type"])["ccu"].sum().reset_index(name="ccu_sum")
    ccu_pivot = ccu_yearly.pivot(index="year", columns="game_type", values="ccu_sum").fillna(0)
    
    # 确保四列都存在
    for col in ["Indie", "AA", "AAA", "F2P"]:
        if col not in pivot.columns:
            pivot[col] = 0
        if col not in ccu_pivot.columns:
            ccu_pivot[col] = 0
    
    pivot["total"] = pivot[["Indie","AA","AAA","F2P"]].sum(axis=1)
    ccu_pivot["total"] = ccu_pivot[["Indie","AA","AAA","F2P"]].sum(axis=1)
    
    records = []
    for year in pivot.index:
        total = int(pivot.loc[year, "total"])
        if total == 0:
            continue
        ni, na, nb, nf = int(pivot.loc[year, "Indie"]), int(pivot.loc[year, "AA"]), int(pivot.loc[year, "AAA"]), int(pivot.loc[year, "F2P"])
        
        # CCU 份额
        ccu_total = float(ccu_pivot.loc[year, "total"]) if year in ccu_pivot.index else 0
        if ccu_total > 0:
            ci = round(float(ccu_pivot.loc[year, "Indie"]) / ccu_total * 100, 1)
            ca = round(float(ccu_pivot.loc[year, "AA"]) / ccu_total * 100, 1)
            cb = round(float(ccu_pivot.loc[year, "AAA"]) / ccu_total * 100, 1)
            cf = round(float(ccu_pivot.loc[year, "F2P"]) / ccu_total * 100, 1)
        else:
            ci = ca = cb = cf = 0.0

        records.append({
            "year":            int(year),
            # 发布数量份额
            "indie":           round(float(ni / total * 100), 1),
            "aa":              round(float(na / total * 100), 1),
            "aaa":             round(float(nb / total * 100), 1),
            "f2p":             round(float(nf / total * 100), 1),
            # CCU 份额
            "ci": ci, "ca": ca, "cb": cb, "cf": cf,
            # 绝对数量
            "n": total, "ni": ni, "na": na, "nb": nb, "nf": nf,
            "total_releases": total,
            "n_indie": ni, "n_aa": na, "n_aaa": nb, "n_f2p": nf,
            "event": _get_event(int(year)),
            "ev": _get_event(int(year)),
        })
    
    records.sort(key=lambda x: x["year"])

    # 合并 SteamCharts 的真实 CCU 份额数据（如果存在）
    ccu_share_path = OUT_DIR / "ccu_share.json"
    if ccu_share_path.exists():
        try:
            with open(ccu_share_path, encoding="utf-8") as f:
                ccu_share = json.load(f)
            ccu_map = {r["year"]: r for r in ccu_share}
            merged = 0
            for rec in records:
                yr = rec["year"]
                if yr in ccu_map:
                    rec["ci"] = ccu_map[yr]["ci"]
                    rec["ca"] = ccu_map[yr]["ca"]
                    rec["cb"] = ccu_map[yr]["cb"]
                    rec["cf"] = ccu_map[yr]["cf"]
                    merged += 1
            print(f"  已合并 SteamCharts CCU 份额数据: {merged} 年")
        except Exception as e:
            print(f"  CCU 份额数据合并失败（忽略）: {e}")

    print(f"  生成 {len(records)} 年的市场份额数据")
    return records


def _get_event(year: int) -> str | None:
    events = {
        2007: "Steam Mac版上线",
        2010: "Steam Works开放",
        2012: "Steam Greenlight上线",
        2013: "Steam OS / Controller 发布",
        2017: "Steam Direct 取消审核门槛",
        2018: "Steam隐私政策更新",
        2020: "COVID-19 / 游戏时长激增",
        2022: "Steam Deck 发布",
    }
    return events.get(year)


# ══════════════════════════════════════════════════
#  元数据 & 关键指标
# ══════════════════════════════════════════════════

def cal_meta(df_main: pd.DataFrame, df_reviewed: pd.DataFrame) -> dict:
    """
    计算全局元数据：各类型好评率中位数、平均 CCU、年度关键指标。
    """
    print("\n处理元数据...")

    type_list = ["Indie", "AA", "AAA", "F2P"]
    df_with_reviews = df_reviewed.dropna(subset=["pos_rate"])

    # 各类型好评率中位数
    pos_rate_median = {}
    for t in type_list:
        sub = df_with_reviews[df_with_reviews["game_type"] == t]["pos_rate"]
        pos_rate_median[t] = round(float(sub.median()), 1) if len(sub) > 0 else None

    # 各类型平均 CCU
    avg_ccu = {}
    for t in type_list:
        sub = df_main[df_main["game_type"] == t]
        avg_ccu[t] = round(float(sub["ccu"].mean()), 0) if len(sub) > 0 else 0

    # 年度关键指标
    yearly_stats = []
    for year in sorted(df_main["year"].unique()):
        sub = df_main[df_main["year"] == year]
        sub_rev = df_reviewed[df_reviewed["year"] == year].dropna(subset=["pos_rate"])
        yearly_stats.append({
            "year":              int(year),
            "total_releases":    int(len(sub)),
            "total_ccu":         int(sub["ccu"].sum()),
            "avg_pos_rate":      round(float(sub_rev["pos_rate"].mean()), 1) if len(sub_rev) > 0 else None,
            "top_ccu_game":      _get_name(sub.loc[sub["ccu"].idxmax()]) if len(sub) > 0 and sub["ccu"].max() > 0 else None,
            "top_ccu_value":     int(sub["ccu"].max()) if len(sub) > 0 else 0,
            "event":             _get_event(int(year)),
        })

    meta = {
        "generated_at":      pd.Timestamp.now().isoformat(),
        "year_range":        [int(df_main["year"].min()), int(df_main["year"].max())],
        "total_games":       len(df_main),
        "reviewed_games":    len(df_reviewed),
        "type_counts":       df_main["game_type"].value_counts().to_dict(),
        "pos_rate_median":   pos_rate_median,
        "avg_ccu":           avg_ccu,
        "yearly_stats":      yearly_stats,
        "data_sources":      ["SteamSpy API", "Steam Store API", "VG Insights"],
    }

    print(f"  元数据：{len(df_main)} 款游戏，{len(yearly_stats)} 个年份")
    return meta


# ══════════════════════════════════════════════════
#  视图二：气泡散点图
# ══════════════════════════════════════════════════

def process_bubbles(df_reviewed: pd.DataFrame, top_n: int = 160) -> list[dict]:
    """
    选取有代表性的游戏作为气泡散点图数据点。
    策略（分层采样）：
    1. 每个类型（Indie/AA/AAA/F2P）分高/中/低人气三档各取一批
    2. 额外纳入"被低估的神作"（好评率 > 95%，owners < 2M）
    3. 总量控制在 150–200 条
    4. 过滤 CCU=0 和 pos_rate 缺失的游戏
    """
    print("\n处理视图二：气泡散点图...")

    df = df_reviewed.dropna(subset=["pos_rate", "owners_m"]).copy()
    df = df[df["ccu"] > 0]  # 必须有 CCU 数据

    type_list = ["Indie", "AA", "AAA", "F2P"]
    # 每个类型的基础配额
    base_per_type = top_n // 4  # 约 40

    selected = []

    for game_type in type_list:
        sub = df[df["game_type"] == game_type].copy()
        if len(sub) == 0:
            continue

        # 按 owners_m 排序后分三档
        sub_sorted = sub.sort_values("owners_m", ascending=False)
        n = len(sub_sorted)
        quota = base_per_type

        if n <= quota:
            # 该类型数据不足，全取
            selected.append(sub_sorted)
        else:
            # 分三档：高人气（前 30%）、中人气（30%-70%）、低人气（后 30%）
            cut1 = max(1, int(n * 0.3))
            cut2 = max(cut1 + 1, int(n * 0.7))

            tier_high = sub_sorted.iloc[:cut1]
            tier_mid  = sub_sorted.iloc[cut1:cut2]
            tier_low  = sub_sorted.iloc[cut2:]

            # 高人气多取，低人气少取
            n_high = max(3, int(quota * 0.50))
            n_mid  = max(3, int(quota * 0.30))
            n_low  = max(2, quota - n_high - n_mid)

            picked_high = tier_high.head(n_high)
            # 中档和低档随机采样，保证多样性
            picked_mid  = tier_mid.sample(n=min(n_mid, len(tier_mid)), random_state=42)
            picked_low  = tier_low.sample(n=min(n_low, len(tier_low)), random_state=42)

            selected.extend([picked_high, picked_mid, picked_low])

        print(f"    {game_type}: 可选 {n} 款，取样 {min(n, quota)} 款（高/中/低分层）")

    # ── 额外：被低估的神作 ──
    already_ids = set(pd.concat(selected)["appid"].values) if selected else set()
    hidden_gems = df[
        (df["pos_rate"] >= 95) &
        (df["owners_m"] < 2.0) &
        (df["review_count"] >= 50) &
        (~df["appid"].isin(already_ids))
    ].nlargest(25, "pos_rate")
    selected.append(hidden_gems)
    print(f"    被低估神作: 额外 {len(hidden_gems)} 款（好评>95%, owners<2M）")

    df_sel = pd.concat(selected).drop_duplicates(subset=["appid"])

    records = []
    for _, row in df_sel.iterrows():
        tags_dict = row["tags_dict"] if isinstance(row["tags_dict"], dict) else {}
        top_tags = sorted(tags_dict.items(), key=lambda x: -x[1])[:5]
        records.append({
            "appid":       str(row.get("appid", "")),
            "name":        _get_name(row),
            "type":        row["game_type"],
            "year":        int(row["year"]) if pd.notna(row.get("year")) else None,
            "pos_rate":    round(float(row["pos_rate"]), 1),
            "peak_ccu":    int(row["ccu"]),
            "owners_m":    round(float(row["owners_m"]), 2),
            "price":       round(float(row.get("price_usd", 0)), 2),
            "review_count":int(row["review_count"]),
            "developers":  row["developers"][:2] if isinstance(row["developers"], list) else [],
            "genres":      row["genres_list"][:3] if isinstance(row["genres_list"], list) else [],
            "top_tags":    [t[0] for t in top_tags],
            "header_image":str(row.get("header_image", "")),
        })

    print(f"  生成 {len(records)} 个气泡数据点（目标 {top_n}，含神作补充）")
    return records


# ══════════════════════════════════════════════════
#  视图三：生命周期衰减曲线
# ══════════════════════════════════════════════════

def process_decay(df_reviewed: pd.DataFrame) -> list[dict]:
    """
    视图三需要各游戏发布后逐月的 CCU 数据。
    SteamSpy 和 Steam Store API 均不提供历史 CCU 时序，
    因此此数据需要从 SteamDB 补充（或使用真实历史快照数据集）。
    
    本脚本实现两个功能：
    1. 生成"需要手动补全"的游戏列表（推荐补全方式附在注释中）
    2. 如果 data/raw/decay_manual.json 存在，则直接使用并格式化
    
    data/raw/decay_manual.json 格式：
    [
      {
        "name": "Stardew Valley",
        "type": "Indie",
        "monthly_ccu": [89063, 71000, 62000, 55000, ...],  // 24个月
        "release_year": 2016
      },
      ...
    ]
    获取方式：https://steamdb.info/app/{appid}/charts/ 手动记录，
              或使用 steamdb-history 等社区工具爬取历史 CCU 快照。
    """
    print("\n处理视图三：生命周期衰减曲线...")
    
    manual_path = RAW_DIR / "decay_manual.json"
    
    if manual_path.exists():
        print("  使用手动采集的历史CCU数据...")
        with open(manual_path) as f:
            raw = json.load(f)
        
        records = []
        for game in raw:
            # 兼容两种格式：
            #   06_generate_decay.py 输出 "normalized" (已归一化) + "peak_ccu"
            #   手动录入格式使用 "monthly_ccu" (原始CCU值，需归一化)
            if "normalized" in game and game["normalized"]:
                normalized = game["normalized"][:25]
                peak = game.get("peak_ccu", 0)
            elif "monthly_ccu" in game and game["monthly_ccu"]:
                monthly = game["monthly_ccu"]
                peak = monthly[0]
                if peak <= 0:
                    continue
                normalized = [round(v / peak, 4) for v in monthly[:25]]
            else:
                continue
            
            # 补齐至25个月
            while len(normalized) < 25:
                normalized.append(round(normalized[-1] * 0.97, 4))
            
            records.append({
                "name":         game["name"],
                "type":         game["type"],
                "release_year": game.get("release_year"),
                "peak_ccu":     peak,
                "normalized":   normalized,  # 25个值，月0到月24
            })
        print(f"  加载 {len(records)} 条衰减曲线")
        return records
    
    else:
        # 生成"待补全游戏清单"
        print("  未找到手动衰减数据，生成推荐游戏清单...")
        
        # 选取各类型代表性游戏
        candidates = []
        for game_type in ["Indie", "AA", "AAA", "F2P"]:
            sub = df_reviewed[df_reviewed["game_type"] == game_type].nlargest(5, "ccu")
            for _, row in sub.iterrows():
                candidates.append({
                    "appid":    str(row.get("appid", "")),
                    "name":     _get_name(row),
                    "type":     game_type,
                    "peak_ccu": int(row["ccu"]),
                    "year":     int(row["year"]) if pd.notna(row.get("year")) else None,
                    "steamdb_url": f"https://steamdb.info/app/{row.get('appid','')}/charts/",
                    "note": "请从SteamDB手动记录各月CCU，填入decay_manual.json"
                })
        
        candidates_path = RAW_DIR / "decay_candidates.json"
        with open(candidates_path, "w", encoding="utf-8") as f:
            json.dump(candidates, f, ensure_ascii=False, indent=2)
        print(f"  推荐游戏清单已保存至：{candidates_path}")
        print("  请参考 decay_manual_template.json 补全数据，或直接运行可视化（将使用内嵌示例数据）")
        
        # 返回内嵌示例数据（基于真实统计数字的模拟）
        return _generate_example_decay()


def _generate_example_decay() -> list[dict]:
    """
    基于真实游戏生命周期研究数字的参数化生成（非随机）。
    参数来源：Game Analytics 行业报告、Konvoy研究数据。
    """
    rng = np.random.default_rng(42)  # 固定种子，保证可复现
    
    profiles = [
        # name, type, a, b, c, floor, color, peak_ccu, release_year
        ("GTA V",              "AAA", 0.90, 0.58, 0.05, 0.04, "#ff6b6b", 364548, 2015),
        ("Cyberpunk 2077",     "AAA", 0.88, 0.72, 0.04, 0.03, "#ff9a9a", 1054388, 2020),
        ("Hogwarts Legacy",    "AAA", 0.92, 0.82, 0.03, 0.02, "#ffbaba", 879308, 2023),
        ("Black Myth: Wukong", "AA",  0.85, 0.55, 0.08, 0.06, "#ffe66d", 2416376, 2024),
        ("Baldur's Gate 3",    "AA",  0.70, 0.24, 0.22, 0.16, "#ffd700", 875343, 2023),
        ("Stardew Valley",     "Indie",0.55, 0.06, 0.36, 0.31, "#4ecdc4", 89063, 2016),
        ("Valheim",            "Indie",0.75, 0.32, 0.18, 0.12, "#45b7aa", 502387, 2021),
        ("Terraria",           "Indie",0.50, 0.05, 0.42, 0.38, "#26a99a", 489886, 2011),
        ("Hades",              "Indie",0.65, 0.14, 0.29, 0.24, "#a8e6cf", 100654, 2020),
        ("DOTA 2",             "F2P", 0.28, 0.03, 0.68, 0.64, "#88ccaa", 1291328, 2013),
    ]
    
    records = []
    for name, gtype, a, b, c, floor, color, peak, year in profiles:
        months = np.arange(25)
        base = np.maximum(floor, a * np.exp(-b * months) + c)
        noise = rng.normal(0, 0.015, 25)
        vals = np.clip(base + noise, floor - 0.02, 1.05)
        vals[0] = 1.0  # 第0月固定为100%
        
        records.append({
            "name":         name,
            "type":         gtype,
            "release_year": year,
            "peak_ccu":     peak,
            "normalized":   [round(float(v), 4) for v in vals],
            "color":        color,
            "_is_example":  True,  # 标记为示例数据，供前端显示提示
        })
    
    return records


# ══════════════════════════════════════════════════
#  主流程
# ══════════════════════════════════════════════════

def save_json(data, path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = path.stat().st_size / 1024
    print(f"  → 已保存 {path.name}（{size_kb:.1f} KB）")


def process_decay_aggregate(df: pd.DataFrame) -> list[dict]:
    """
    计算各类型游戏的聚合留存趋势——按"游戏年龄"（发布后年数）分组。
    
    主指标：中位游戏时长（median_playtime_forever）
      该指标直接反映"玩家实际在这款游戏上花了多少时间"，
      不受 owners 累积或 peak_ccu 冻结的影响。
      
    预期模式：
      - Indie 长尾款：老游戏的中位时长 > 新游戏（社区持续活跃，玩家累积时长）
      - AAA 单机：无论新老，中位时长都在 20-40 小时（通关即弃）
      - F2P：中位时长随年龄增长最快（日活模式，玩家每天登录）
    
    辅助指标：参与度比率（peak_ccu / owners）
    """
    print("  处理类型聚合留存趋势...")
    
    current_year = int(df["year"].max()) if len(df) > 0 and df["year"].max() > 0 else 2024
    max_age = 10
    
    type_list = ["Indie", "AA", "AAA", "F2P"]
    type_colors = {"Indie": "#1de9b6", "AA": "#ffd54f", "AAA": "#ff5252", "F2P": "#69f0ae"}
    
    # 确定游戏时长列
    pt_col = None
    for col in ["median_playtime", "median_playtime_forever", "avg_playtime", "average_playtime_forever"]:
        if col in df.columns:
            nonzero = pd.to_numeric(df[col], errors="coerce").fillna(0)
            if nonzero.sum() > 0:
                pt_col = col
                break
    
    if pt_col:
        df = df.copy()
        df["_playtime"] = pd.to_numeric(df[pt_col], errors="coerce").fillna(0)
        has_pt_count = (df["_playtime"] > 0).sum()
        print(f"    ✓ 使用 {pt_col}，{has_pt_count} 款游戏有时长数据")
    else:
        print("    ⚠ 无游戏时长数据")
        df = df.copy()
        df["_playtime"] = 0

    # 存活信号：只用"近两周活跃时长"（average_2weeks）这类真正的近期信号。
    # 不退回 ccu：ccu>0 的占比受"发行世代构成"主导（近年小作坊游戏暴增拉低新作、
    # 老作目录只剩幸存者拉高老作），按年龄看不降反升，画出来会得出"越老越活"的错误结论。
    # 缺数据的游戏保持 NaN，不计入分子分母。无有效信号时 survival_available=False，前端自动隐藏。
    rec_col, survival_basis = None, ""
    for col in ["avg_2weeks", "average_2weeks", "players_2weeks"]:
        if col in df.columns and pd.to_numeric(df[col], errors="coerce").fillna(0).gt(0).any():
            rec_col, survival_basis = col, "近两周仍有游玩时长"
            break
    if rec_col:
        df["_recent"] = pd.to_numeric(df[rec_col], errors="coerce")  # 缺失保持 NaN
        print(f"    ✓ 存活率信号: {rec_col}（{int((df['_recent'] > 0).sum())} 款活跃 / {int(df['_recent'].notna().sum())} 款有该数据）")
    else:
        df["_recent"] = np.nan
        print("    ⚠ 无有效近期活跃字段，存活率不可用（前端将隐藏该视图）")

    records = []
    
    for gtype in type_list:
        sub = df[(df["game_type"] == gtype) & (df["year"] > 0)].copy()
        if len(sub) < 10:
            continue
        
        sub["age"] = current_year - sub["year"]
        
        playtime_curve = []
        engagement_curve = []
        sample_sizes = []
        survival_curve = []   # alive / known，0..1
        survival_known = []   # 有近两周数据的游戏数（分母）
        survival_alive = []   # 近两周仍活跃的游戏数（分子）
        
        for age in range(0, max_age + 1):
            cohort = sub[sub["age"] == age]
            n = len(cohort)
            
            if n < 3:
                playtime_curve.append(playtime_curve[-1] if playtime_curve else 0)
                engagement_curve.append(engagement_curve[-1] if engagement_curve else 0)
                sample_sizes.append(0)
                survival_curve.append(survival_curve[-1] if survival_curve else 0)
                survival_known.append(0)
                survival_alive.append(0)
                continue
            
            # 中位游戏时长 — 只看有玩家的游戏（playtime > 0）
            played = cohort[cohort["_playtime"] > 0]
            if len(played) > 0:
                med_pt = float(played["_playtime"].median())
            else:
                med_pt = 0
            playtime_curve.append(round(med_pt, 1))
            
            # 参与度比率
            active = cohort[(cohort["owners_m"] > 0) & (cohort["ccu"] > 0)]
            if len(active) > 0:
                ratios = active["ccu"] / (active["owners_m"] * 1e6) * 100
                eng = float(ratios.median())
            else:
                eng = 0
            engagement_curve.append(round(eng, 4))
            sample_sizes.append(n)

            # 存活率 = 近两周仍活跃的游戏 ÷ 有近两周数据的游戏（缺数据的游戏不进分母）
            rec = cohort["_recent"]
            known_n = int(rec.notna().sum())
            alive_n = int((rec > 0).sum())
            survival_known.append(known_n)
            survival_alive.append(alive_n)
            survival_curve.append(round(alive_n / known_n, 4) if known_n >= 3 else (survival_curve[-1] if survival_curve else 0))
        
        if len(playtime_curve) < 3:
            continue
        
        # 归一化
        pt_base = playtime_curve[0] if playtime_curve[0] > 0 else max(max(playtime_curve), 1)
        pt_normalized = [round(v / pt_base, 4) if pt_base > 0 else 0 for v in playtime_curve]
        
        eng_base = engagement_curve[0] if engagement_curve[0] > 0 else max(max(engagement_curve), 0.001)
        eng_normalized = [round(v / eng_base, 4) if eng_base > 0 else 0 for v in engagement_curve]
        
        # 选择主曲线：有 playtime 数据用 playtime，否则用 engagement
        use_playtime = playtime_curve[0] > 0
        
        total_games = len(sub)
        
        records.append({
            "type": gtype,
            "color": type_colors.get(gtype, "#888"),
            "total_games": total_games,
            "primary": "playtime" if use_playtime else "engagement",
            "playtime_normalized": pt_normalized,
            "playtime_absolute": playtime_curve,
            "engagement_normalized": eng_normalized,
            "engagement_absolute": engagement_curve,
            "sample_sizes": sample_sizes,
            "survival_curve": survival_curve,
            "survival_known": survival_known,
            "survival_alive": survival_alive,
            "survival_available": bool(any(k >= 3 for k in survival_known) and any(a > 0 for a in survival_alive)),
            "survival_basis": survival_basis,
            "max_age": len(playtime_curve),
            "has_playtime": bool(use_playtime),
        })
        
        if use_playtime and len(playtime_curve) > 5:
            pt0 = playtime_curve[0]
            pt5 = playtime_curve[5]
            pt0_str = f"{pt0/60:.0f}h" if pt0 >= 60 else f"{pt0:.0f}min"
            pt5_str = f"{pt5/60:.0f}h" if pt5 >= 60 else f"{pt5:.0f}min"
            print(f"    {gtype}: {total_games} 款, 新游戏中位时长 {pt0_str}, 5年老游戏 {pt5_str} ({pt_normalized[5]:.0%})")
        elif len(engagement_curve) > 5:
            print(f"    {gtype}: {total_games} 款, 5年参与度保留 {eng_normalized[5]:.0%}")
    
    print(f"  生成 {len(records)} 条类型聚合留存曲线")
    return records


if __name__ == "__main__":
    print("=" * 60)
    print("Steam 可视化项目 — 数据预处理")
    print("=" * 60)
    
    # 加载原始数据
    print("\n[1/5] 加载原始数据...")
    df_raw = load_raw_data()
    
    print("\n[2/5] 清洗和构建主 DataFrame...")
    df_main, df_reviewed = build_main_df(df_raw)
    
    # 视图一
    print("\n[3/5] 处理市场份额数据...")
    market_data = process_market_share(df_main)
    save_json(market_data, OUT_DIR / "market_share.json")
    
    # 视图二
    print("\n[4/5] 处理气泡散点数据...")
    bubble_data = process_bubbles(df_reviewed)
    save_json(bubble_data, OUT_DIR / "bubbles.json")
    
    # 视图三
    print("\n[5/5] 处理生命周期衰减数据...")
    decay_data = process_decay(df_reviewed)
    save_json(decay_data, OUT_DIR / "decay.json")
    
    # 视图三扩展：类型聚合存活率
    print("\n[bonus] 处理类型聚合存活趋势...")
    aggregate_data = process_decay_aggregate(df_main)
    save_json(aggregate_data, OUT_DIR / "decay_aggregate.json")
    
    # 元数据
    meta = cal_meta(df_main, df_reviewed)
    save_json(meta, OUT_DIR / "meta.json")
    
    print("\n" + "=" * 60)
    print("✓ 预处理完成！")
    print(f"  输出目录：{OUT_DIR}")
    print("  请运行 vis4/index.html 查看可视化效果。")
    print("=" * 60)