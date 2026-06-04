"""
06_generate_decay.py — 从 SteamCharts 缓存生成真实衰减曲线
==========================================================
读取 03_fetch_steamcharts.py 产出的 steamcharts_raw.json，
选取各类型代表性游戏，将月度在线数据对齐为"发布后第N个月"，
归一化后输出 decay_manual.json，供视图三直接使用。

修复项：
  - 使用 05_preprocess.py 的 classify_game_type 统一分类
  - 过滤持续增长型游戏（CS2、Dota 2 等长线运营）
  - 仅保留有 ≥12 个月真实数据的游戏

前置步骤：
  1. 确保 data/raw/steamcharts_raw.json 存在（先运行 03_fetch_steamcharts.py）
  2. 确保游戏数据中有 release_date（Kaggle 数据有，SteamSpy 没有）

用法：
  python 06_generate_decay.py

输出：
  data/raw/decay_manual.json — 真实衰减曲线数据
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from importlib.machinery import SourceFileLoader

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"

CACHE_PATH = RAW_DIR / "steamcharts_raw.json"
OUTPUT_PATH = RAW_DIR / "decay_manual.json"

# 各类型必须包含的代表性游戏（appid → 发布日期）
# 03_fetch_steamcharts.py 爬取时已包含这些游戏
# 发布日期从 Kaggle 数据获取，这里硬编码作为后备
RELEASE_DATES = {
    # AAA
    "1245620": "2022-02",   # Elden Ring
    "2358720": "2024-08",   # Black Myth: Wukong
    "1086940": "2023-08",   # Baldur's Gate 3
    "292030":  "2015-05",   # The Witcher 3
    "271590":  "2015-04",   # GTA V (Steam)
    "1174180": "2019-12",   # Red Dead Redemption 2
    # AA
    "252490":  "2013-12",   # Rust
    "346110":  "2017-08",   # ARK: Survival Evolved
    "251570":  "2013-12",   # 7 Days to Die
    # Indie
    "413150":  "2016-02",   # Stardew Valley
    "105600":  "2011-05",   # Terraria
    "892970":  "2021-02",   # Valheim
    "1623730": "2024-01",   # Palworld
    "548430":  "2020-05",   # Deep Rock Galactic
    "367520":  "2017-02",   # Hollow Knight
    # F2P
    "730":     "2012-08",   # CS:GO / CS2
    "570":     "2013-07",   # Dota 2
    "578080":  "2017-12",   # PUBG
    "440":     "2007-10",   # TF2
    "1172470": "2020-11",   # Apex Legends (Steam)
}

# 颜色配置
TYPE_COLORS = {
    "AAA":   ["#ff5252", "#ff7043", "#ef5350", "#e53935"],
    "AA":    ["#ffd54f", "#ffca28", "#ffc107", "#ffb300"],
    "Indie": ["#1de9b6", "#00e5ff", "#64ffda", "#00bfa5", "#1de9b6"],
    "F2P":   ["#69f0ae", "#b9f6ca", "#a5d6a7", "#81c784"],
}

# ══ 最低真实数据月数 ══
MIN_REAL_MONTHS = 12


def parse_month_str(s):
    """'January 2024' → (2024, 1) ; 'Last 30 Days' → current"""
    if "Last 30" in s:
        now = datetime.now()
        return (now.year, now.month)
    for fmt in ["%B %Y", "%b %Y"]:
        try:
            dt = datetime.strptime(s, fmt)
            return (dt.year, dt.month)
        except:
            continue
    return None


def months_since(release_ym, data_ym):
    """计算两个 (year, month) 之间的月数差"""
    return (data_ym[0] - release_ym[0]) * 12 + (data_ym[1] - release_ym[1])


def load_release_dates():
    """从 Kaggle 数据或 game_db.json 加载发布日期，与硬编码合并"""
    dates = dict(RELEASE_DATES)
    
    # 尝试从 game_db.json 补充
    db_path = RAW_DIR / "game_db.json"
    if db_path.exists():
        with open(db_path, encoding="utf-8") as f:
            records = json.load(f)
        for r in records:
            aid = str(r.get("appid", ""))
            rd = r.get("release_date", "")
            if aid and rd and aid not in dates:
                for fmt in ["%b %d, %Y", "%B %d, %Y", "%Y-%m-%d"]:
                    try:
                        dt = datetime.strptime(rd, fmt)
                        dates[aid] = f"{dt.year:04d}-{dt.month:02d}"
                        break
                    except:
                        continue
    
    # 也从 Kaggle 原始数据补充
    for name in ["games.json", "kaggle_steam.json"]:
        path = RAW_DIR / name
        if path.exists():
            with open(path, encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                for appid, g in raw.items():
                    if str(appid) not in dates and g.get("release_date"):
                        rd = g["release_date"]
                        for fmt in ["%b %d, %Y", "%B %d, %Y", "%Y-%m-%d"]:
                            try:
                                dt = datetime.strptime(rd, fmt)
                                dates[str(appid)] = f"{dt.year:04d}-{dt.month:02d}"
                                break
                            except:
                                continue
            break
    
    return dates


def load_classifier():
    """
    尝试从 05_preprocess.py 导入 classify_game_type，
    保证衰减图的分类与气泡图一致。
    """
    for p in [BASE_DIR / "05_preprocess.py",
              BASE_DIR / "scripts" / "05_preprocess.py"]:
        if p.exists():
            try:
                mod = SourceFileLoader("pp", str(p)).load_module()
                print(f"  ✓ 从 {p.name} 加载分类规则")
                return mod.classify_game_type
            except Exception as e:
                print(f"  ⚠ 加载 {p.name} 失败: {e}")
    return None


def load_game_db_records():
    """加载 game_db.json，构建 appid → record 映射（供分类器使用）"""
    db_path = RAW_DIR / "game_db.json"
    if not db_path.exists():
        return {}
    with open(db_path, encoding="utf-8") as f:
        records = json.load(f)
    return {str(r.get("appid", "")): r for r in records if r.get("appid")}


def generate_decay_curve(monthly_data, release_ym, max_months=25):
    """
    将月度在线数据转为归一化衰减曲线。
    返回 (curve, real_count):
      curve: 长度 max_months 的列表 [1.0, 0.85, 0.72, ...]
      real_count: 有真实数据的月份数
    """
    # 建立 month_offset → avg 映射
    offset_map = {}
    for m in monthly_data:
        ym = parse_month_str(m["month"])
        if not ym:
            continue
        offset = months_since(release_ym, ym)
        if 0 <= offset < max_months:
            offset_map[offset] = m["avg"]
    
    if not offset_map:
        return None, 0
    
    real_count = len(offset_map)
    
    # 归一化：以第0或第1个月为基准
    base = offset_map.get(0) or offset_map.get(1) or max(offset_map.values())
    if base <= 0:
        return None, 0
    
    curve = []
    for i in range(max_months):
        if i in offset_map:
            curve.append(round(offset_map[i] / base, 4))
        elif curve:
            # 插值：用前一个值的衰减估计
            curve.append(round(curve[-1] * 0.95, 4))
        else:
            curve.append(1.0)
    
    return curve, real_count


def is_growth_game(curve):
    """
    检测不适合放在衰减图中的曲线：
    1. 持续增长型：月3~月24 的均值 > 0.8（CS2、Dota 2）
    2. 异常尖峰型：任意月份 > 1.5（CoD 跨代叠加、Factorio EA→正式版回流）
    """
    # 尖峰检测：跳过首月（固定 1.0），月1之后出现 >1.5 的值
    if any(v > 1.5 for v in curve[1:]):
        return True
    # 持续增长检测
    tail = curve[3:25]
    if not tail:
        return False
    avg = sum(tail) / len(tail)
    return avg > 0.8


def main():
    print("=" * 56)
    print("生成真实衰减曲线数据")
    print("=" * 56)
    
    if not CACHE_PATH.exists():
        print(f"\n✗ 未找到 {CACHE_PATH}")
        print("  请先运行: python 03_fetch_steamcharts.py")
        sys.exit(1)
    
    with open(CACHE_PATH, encoding="utf-8") as f:
        cache = json.load(f)
    print(f"\n已加载 SteamCharts 缓存: {len(cache)} 款游戏")
    
    # 加载发布日期
    release_dates = load_release_dates()
    print(f"已加载发布日期: {len(release_dates)} 款")
    
    # 加载分类器（与 05_preprocess.py 保持一致）
    classify = load_classifier()
    db_records = load_game_db_records()
    print(f"已加载 game_db 记录: {len(db_records)} 款")
    
    # 生成衰减曲线
    decay_records = []
    skipped_growth = []
    skipped_short = []
    
    for appid, entry in cache.items():
        name = entry.get("name", "")
        monthly = entry.get("monthly", [])
        
        if not monthly or len(monthly) < 6:
            continue
        
        # ── 统一分类：优先用 05_preprocess 的 classify_game_type ──
        if classify and appid in db_records:
            gtype = classify(db_records[appid])
        elif classify:
            # 用 steamcharts 缓存中的信息构建一个最小 record
            gtype = classify({
                "name": name,
                "is_free": entry.get("is_free", False),
                "price_usd": entry.get("price", 0),
                "owners_m": entry.get("owners_m", 0),
                "tags": entry.get("tags", {}),
                "developers": entry.get("developers", []),
                "publishers": entry.get("publishers", []),
                "genres": entry.get("genres", []),
            })
        else:
            gtype = entry.get("type", "Indie")
        
        # 获取发布日期
        rd_str = release_dates.get(appid)
        if not rd_str:
            continue
        
        try:
            parts = rd_str.split("-")
            release_ym = (int(parts[0]), int(parts[1]))
        except:
            continue
        
        # 生成曲线
        curve, real_count = generate_decay_curve(monthly, release_ym, 25)
        if not curve:
            continue
        
        # ── 过滤：真实数据月数不足 ──
        if real_count < MIN_REAL_MONTHS:
            skipped_short.append(f"{name} ({real_count}个月)")
            continue
        
        # ── 过滤：持续增长型游戏 ──
        if is_growth_game(curve):
            skipped_growth.append(name)
            continue
        
        # 获取峰值 CCU
        peak_ccu = max((m.get("peak", 0) for m in monthly), default=0)
        
        decay_records.append({
            "name": name,
            "type": gtype,
            "peak_ccu": peak_ccu,
            "release_year": release_ym[0],
            "normalized": curve,
        })
    
    # 报告过滤结果
    if skipped_growth:
        print(f"\n  跳过增长/异常尖峰游戏: {', '.join(skipped_growth)}")
    if skipped_short:
        print(f"  跳过数据不足（<{MIN_REAL_MONTHS}个月）: {', '.join(skipped_short)}")
    
    # 每类型最多取 4 款，按峰值 CCU 排序
    color_idx = {"AAA": 0, "AA": 0, "Indie": 0, "F2P": 0}
    final = []
    for gtype in ["AAA", "AA", "Indie", "F2P"]:
        type_games = [d for d in decay_records if d["type"] == gtype]
        type_games.sort(key=lambda d: -d["peak_ccu"])
        selected = type_games[:3]
        
        # 分配颜色
        for d in selected:
            colors = TYPE_COLORS.get(gtype, ["#888"])
            ci = color_idx.get(gtype, 0) % len(colors)
            d["color"] = colors[ci]
            color_idx[gtype] = ci + 1
        
        final.extend(selected)
        if selected:
            names = ", ".join(f'{d["name"][:20]}' for d in selected)
            print(f"  {gtype}: {len(selected)} 款 — {names}")
    
    if not final:
        print("\n✗ 没有生成任何衰减曲线")
        print("  可能原因：SteamCharts 缓存中的游戏没有发布日期")
        print("  请确保 Kaggle 数据或 game_db.json 中有 release_date")
        return
    
    # 保存
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*56}")
    print(f"✓ 已生成 {len(final)} 条真实衰减曲线")
    print(f"  保存至: {OUTPUT_PATH}")
    print(f"  下一步: 运行 python 05_preprocess.py，视图三将自动使用真实数据")
    print(f"{'='*56}")


if __name__ == "__main__":
    main()