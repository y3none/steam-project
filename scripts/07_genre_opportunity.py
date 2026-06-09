"""
07_genre_opportunity.py — 品类机会地图数据
==========================================
面向"该做一款什么游戏"的决策视图：把全平台游戏按 SteamSpy tag（玩法品类）聚合，
为每个品类算出四个决策维度：

  · 供给(supply)     = 该品类在售游戏数（横轴 / 竞争激烈度）
  · 需求(demand)     = 该品类拥有量。本脚本对每个品类同时输出多种口径：
                         median_owners_m（中位 / 抗爆款，真正的"典型结局"）、
                         p75_owners_m（上四分位 / "做得好时"的预期）、
                         mean_owners_m（均值 / 会被头部爆款拉高）。
                       ⚠ 注意：前端机会矩阵当前用 mean_owners_m 定位纵轴
                         （因 SteamSpy owners 是分桶区间，中位数在粗桶下分辨率不足），
                         故"需求高"实际含义偏向"该品类出过爆款"，而非"普遍都卖得好"。
                         前端 tooltip 应同时展示 median/p75 作为稳健参照（已随本 JSON 提供）。
  · 市场规模         = 该品类总拥有量（气泡大小）
  · 趋势(trend)      = 近三年 vs 前三年的发行数量动量（气泡颜色，红=升温/蓝=降温）
                       ⚠ 右删失风险：若数据快照截止于某年年中，则最近一年发行量被低估，
                         trend 会系统性偏冷。建议在 meta 标注快照日期或丢弃不完整的末年。
另附：命中率(owners≥1M 的占比)、质量门槛(中位好评率)。

读法（前端按象限呈现）：
  左上 高需求·低供给 → 蓝海机会      右上 高需求·高供给 → 红海热门
  左下 低需求·低供给 → 小众/未验证    右下 低需求·高供给 → 过度饱和（慎入）

所有数字均来自真实聚合，可溯源；不做任何硬编码。每个品类同时输出"按规模档(tier)
拆分"的子聚合，外加一个【与规模档正交】的 F2P 子聚合（商业模式维度，可与任一规模档重叠）。
前端可据此筛选——独立工作室只看独立游戏在各品类下的真实结局。

用法:  python 07_genre_opportunity.py
输出:  data/processed/genre_opportunity.json
"""

import json
import re
import sys
from pathlib import Path
from statistics import median
from collections import defaultdict
from importlib.machinery import SourceFileLoader

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
OUT_DIR = BASE_DIR / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUT_DIR / "genre_opportunity.json"

MIN_REVIEWS = 10      # 与主流程一致：评价数过滤，去掉噪声小样本
MIN_GAMES_PER_TAG = 50  # 品类至少要有这么多游戏才纳入（否则统计不稳）
TOP_N_TAGS = 48       # 最终保留按供给排序的前 N 个品类
HIT_OWNERS_M = 1.0    # "命中"门槛：拥有量 ≥ 100 万

# 非玩法品类标签：模式 / 视角 / 氛围 / 笼统大类——这些几乎每个游戏都挂，会污染机会图。
# 全部小写比较。可按需增删（例如你想保留 Action/Adventure 作为大类，就从这里删掉）。
STOPWORD_LC = {
    # 模式
    "singleplayer","multiplayer","co-op","online co-op","local co-op","local multiplayer",
    "online pvp","pvp","pve","co-op campaign","split screen","cross-platform multiplayer",
    "asynchronous multiplayer","online multiplayer","4 player local","lan",
    # 视角 / 维度
    "first-person","third person","third-person","top-down","isometric","side scroller",
    "2d","3d","2.5d","first person",
    # 氛围 / 主观感受
    "atmospheric","great soundtrack","funny","relaxing","difficult","cute","colorful","dark",
    "beautiful","emotional","psychological","story rich","choices matter","multiple endings",
    "soundtrack","memes","minimalist","stylized","realistic","cartoony","hand-drawn",
    "pixel graphics","retro","cinematic","tactical","fast-paced","replay value",
    # 内容标记
    "nudity","sexual content","gore","violent","mature","nsfw","blood","nudity ",
    # 业务 / 范围 / 笼统大类
    "indie","casual","early access","free to play","demo","controller","family friendly",
    "great soundtrack","action","adventure","singleplayer ","massively multiplayer",
    "exploration","open world",  # 过于宽泛；如要保留 Open World 可从此删除
    "sandbox","2d platformer","character customization","moddable","mod","games workshop",
}


# ── 复用主流程的分类器（拿不到就用内置兜底）──────────────
#   tier（规模档 Indie/AA/AAA）与 monetization（F2P/Premium）是【正交】两维：
#   AAA 也可以是 F2P（原神/Apex），Indie 也可以 F2P。所以这里两个分类器都要拿。
def load_classifier():
    for p in [BASE_DIR / "05_preprocess.py", BASE_DIR / "scripts" / "05_preprocess.py"]:
        if p.exists():
            try:
                mod = SourceFileLoader("pp", str(p)).load_module()
                monet = getattr(mod, "classify_monetization", None)
                return mod.classify_game_type, monet
            except Exception as e:
                print(f"    ⚠ 无法加载分类器({e})，使用内置兜底")
    return None, None


def fallback_classify(rec):
    """无主分类器时的粗略兜底【规模档】：仅用于不影响主结论的退路。不再返回 F2P。"""
    owners = parse_owners_m(rec.get("owners", rec.get("owners_m", "")))
    if owners >= 20:
        return "AAA"
    if owners >= 2:
        return "AA"
    return "Indie"


def fallback_monetization(rec):
    """兜底【商业模式】：免费进入 + Free to Play 信号 → F2P，否则 Premium。"""
    price = rec.get("price_usd", rec.get("price", 0)) or 0
    try:
        price = float(price)
    except Exception:
        price = 0
    is_free = rec.get("is_free", False)
    tags = rec.get("tags", {}) or {}
    genres = " ".join(rec.get("genres", []) or []).lower() if isinstance(rec.get("genres"), list) else str(rec.get("genres", "")).lower()
    has_f2p = (
        (isinstance(tags, dict) and any(
            tags.get(k, 0) and tags.get(k, 0) > 50 for k in ("Free to Play", "Free To Play", "F2P")))
        or "free to play" in genres
    )
    return "F2P" if (has_f2p and (is_free or price == 0)) else "Premium"


def parse_owners_m(owners):
    """SteamSpy owners 字符串 → 中点（百万）。'1,000,000 .. 2,000,000' → 1.5"""
    if owners is None:
        return 0.0
    if isinstance(owners, (int, float)):
        return float(owners) / 1e6
    nums = re.findall(r"[\d,]+", str(owners))
    nums = [int(n.replace(",", "")) for n in nums if n.replace(",", "").isdigit()]
    if not nums:
        return 0.0
    mid = sum(nums) / len(nums)
    return mid / 1e6


def parse_year(rec):
    for k in ("release_date", "year", "first_release_date", "date"):
        v = rec.get(k)
        if v:
            m = re.search(r"(19|20)\d{2}", str(v))
            if m:
                return int(m.group(0))
    return 0


def get_tags(rec):
    """SteamSpy tags 既可能是 {tag: votes} 也可能是 [tag,...]，统一成 tag 列表。"""
    t = rec.get("tags")
    if isinstance(t, dict):
        return [k for k, v in t.items() if k and (v is None or v > 0)]
    if isinstance(t, list):
        return [str(x) for x in t if x]
    # 退路：genres 字段
    g = rec.get("genres")
    if isinstance(g, list):
        return [str(x) for x in g if x]
    if isinstance(g, str):
        return [s.strip() for s in g.split(",") if s.strip()]
    return []


def load_records():
    db_path = RAW_DIR / "game_db.json"
    if db_path.exists():
        with open(db_path, encoding="utf-8") as f:
            raw = json.load(f)
        records = list(raw.values()) if isinstance(raw, dict) else raw
        print(f"从 game_db.json 加载 {len(records)} 款游戏")
        return records
    for name in ["games.json", "kaggle_steam.json"]:
        p = RAW_DIR / name
        if p.exists():
            with open(p, encoding="utf-8") as f:
                raw = json.load(f)
            records = list(raw.values()) if isinstance(raw, dict) else raw
            print(f"从 {name} 加载 {len(records)} 款游戏")
            return records
    print("未找到游戏数据 (data/raw/game_db.json)")
    return []


def review_count(rec):
    pos = int(rec.get("positive", 0) or 0)
    neg = int(rec.get("negative", 0) or 0)
    rc = rec.get("review_count")
    if rc:
        try:
            return int(rc)
        except Exception:
            pass
    return pos + neg


def pos_rate(rec):
    pos = int(rec.get("positive", 0) or 0)
    neg = int(rec.get("negative", 0) or 0)
    if pos + neg == 0:
        return None
    return pos / (pos + neg)


def pct(vals, q):
    """线性插值分位数。vals 可未排序。"""
    if not vals:
        return 0.0
    s = sorted(vals)
    if len(s) == 1:
        return s[0]
    k = (len(s) - 1) * q
    f = int(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


def metrics_from(owners_list, pos_list, years, cur_year):
    """从一个品类（或品类×类型）的样本算决策指标。"""
    n = len(owners_list)
    if n == 0:
        return None
    recent = sum(1 for y in years if y and y >= cur_year - 2)        # 近三年
    prev = sum(1 for y in years if y and cur_year - 5 <= y <= cur_year - 3)  # 前三年
    trend = round((recent - prev) / (recent + prev), 3) if (recent + prev) > 0 else 0.0
    pos_vals = [p for p in pos_list if p is not None]
    return {
        "count": n,
        "total_owners_m": round(sum(owners_list), 2),
        "median_owners_m": round(median(owners_list), 4),
        "p75_owners_m": round(pct(owners_list, 0.75), 4),   # 上四分位：做得好时的预期
        "p90_owners_m": round(pct(owners_list, 0.90), 4),   # 头部预期
        "mean_owners_m": round(sum(owners_list) / n, 4),
        "hit_rate": round(sum(1 for o in owners_list if o >= HIT_OWNERS_M) / n, 4),
        "median_pos": round(median(pos_vals), 4) if pos_vals else None,
        "recent3y": recent,
        "prev3y": prev,
        "trend": trend,  # [-1,1]，>0 升温 <0 降温
    }


def main():
    print("=" * 56)
    print("品类机会地图 数据聚合")
    print("=" * 56)

    records = load_records()
    if not records:
        return
    classify_tier, classify_monet = load_classifier()
    if classify_tier is None:
        classify_tier = fallback_classify
    if classify_monet is None:
        classify_monet = fallback_monetization

    cur_year = max((parse_year(r) for r in records), default=2024)
    cur_year = min(cur_year, 2025)
    print(f"基准年: {cur_year}")

    # tag → 样本累积；tag → type → 样本累积
    owners_by_tag = defaultdict(list)
    pos_by_tag = defaultdict(list)
    years_by_tag = defaultdict(list)
    by_tag_type = defaultdict(lambda: defaultdict(lambda: {"o": [], "p": [], "y": []}))

    kept = 0
    for rec in records:
        if review_count(rec) < MIN_REVIEWS:
            continue
        tags = get_tags(rec)
        if not tags:
            continue
        om = parse_owners_m(rec.get("owners", rec.get("owners_m", 0)))
        pr = pos_rate(rec)
        yr = parse_year(rec)
        try:
            tier = classify_tier(rec)
        except Exception:
            tier = fallback_classify(rec)
        if tier not in ("Indie", "AA", "AAA"):
            tier = "Indie"
        try:
            monet = classify_monet(rec)
        except Exception:
            monet = fallback_monetization(rec)
        if monet not in ("F2P", "Premium", "Hybrid"):
            monet = "Premium"
        kept += 1
        for tag in tags:
            if not tag or tag.strip().lower() in STOPWORD_LC:
                continue
            tag = tag.strip()
            owners_by_tag[tag].append(om)
            pos_by_tag[tag].append(pr)
            years_by_tag[tag].append(yr)
            # 规模档桶（Indie/AA/AAA，互斥）
            slot = by_tag_type[tag][tier]
            slot["o"].append(om); slot["p"].append(pr); slot["y"].append(yr)
            # 商业模式桶（F2P/Premium/Hybrid，互斥）——与规模档【正交、可重叠】
            #   一款 F2P 的 AAA 会同时计入 AAA 和 F2P；一款付费 Indie 会同时计入 Indie 和 Premium
            mslot = by_tag_type[tag][monet]
            mslot["o"].append(om); mslot["p"].append(pr); mslot["y"].append(yr)

    print(f"参与统计的游戏(评价≥{MIN_REVIEWS}): {kept} 款 · 候选品类 {len(owners_by_tag)} 个")

    # 组装：保留样本量足够的品类，按供给排序取 TOP_N
    rows = []
    for tag, owners in owners_by_tag.items():
        if len(owners) < MIN_GAMES_PER_TAG:
            continue
        overall = metrics_from(owners, pos_by_tag[tag], years_by_tag[tag], cur_year)
        by_type = {}
        for gtype, s in by_tag_type[tag].items():
            m = metrics_from(s["o"], s["p"], s["y"], cur_year)
            if m and m["count"] >= 8:   # 类型子样本太小不输出，避免误导
                by_type[gtype] = m
        rows.append({"tag": tag, "overall": overall, "by_type": by_type})

    rows.sort(key=lambda r: -r["overall"]["count"])
    rows = rows[:TOP_N_TAGS]

    meta = {
        "cur_year": cur_year,
        "min_reviews": MIN_REVIEWS,
        "hit_owners_m": HIT_OWNERS_M,
        "n_games_counted": kept,
        "demand_axis_field": "mean_owners_m",
        "note": ("需求口径同时提供 median/p75/mean。前端纵轴用 mean_owners_m（owners 分桶导致"
                 "中位分辨率不足），故'需求高'≈'出过爆款'；median/p75 为抗爆款的稳健参照。"
                 "趋势=近三年vs前三年发行量动量；末年若不完整会使 trend 偏冷。"),
        "by_type_scopes": "Indie/AA/AAA 为互斥规模档；F2P/Premium/Hybrid 为正交的商业模式桶，可与任一规模档重叠。",
    }
    out = {"meta": meta, "genres": rows}
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"\n✓ 已输出 {len(rows)} 个品类 → {OUTPUT_PATH}")
    print("\n供给最高的几个品类（中位拥有量 / 命中率 / 趋势）:")
    for r in rows[:8]:
        o = r["overall"]
        print(f"  {r['tag']:<22} 供给{o['count']:>5} · 中位{o['median_owners_m']:>6.2f}M · "
              f"命中{o['hit_rate']*100:>4.0f}% · 趋势{o['trend']:+.2f}")


if __name__ == "__main__":
    main()