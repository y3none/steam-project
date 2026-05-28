"""
Steam可视化项目 — Kaggle数据导入适配器
======================================
将 Kaggle Steam Games Dataset (JSON格式) 转换为 05_preprocess.py 所需的输入。

Kaggle 数据集格式（每个key是appid，value是游戏详情对象）：
{
    "496350": {
        "name": "...",
        "release_date": "Jul 29, 2016",
        "price": 5.24,
        "positive": 252,
        "negative": 3,
        "estimated_owners": "0 - 20000",
        "peak_ccu": 0,
        "tags": {"Adventure": 27, "Visual Novel": 19},
        "developers": ["minori"],
        "publishers": ["MangaGamer"],
        "genres": ["Adventure"],
        ...
    }
}

输出（写入 data/raw/）：
    kaggle_games.json  —— 统一格式，供 05_preprocess.py 直接读取

用法：
    1. 将 Kaggle 下载的 JSON 文件放到 data/raw/ 目录，命名为 kaggle_steam.json
       （也支持多个分片文件：kaggle_steam_*.json）
    2. 运行：python 04_import_kaggle.py
    3. 再运行：python 05_preprocess.py
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime

# ── 路径配置 ──────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
RAW_DIR  = BASE_DIR / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_PATH = RAW_DIR / "kaggle_games.json"


def find_kaggle_files() -> list[Path]:
    """自动搜索 data/raw/ 下的 Kaggle JSON 文件"""
    patterns = [
        "kaggle_steam.json",
        "kaggle_steam_*.json",
        "games.json",          # Kaggle 默认文件名
        "steam_games.json",
    ]
    found = []
    for pat in patterns:
        found.extend(RAW_DIR.glob(pat))
    # 去重
    return list(dict.fromkeys(found))


def parse_owners(owners_str: str) -> str:
    """
    Kaggle格式: "0 - 20000" 或 "20000 - 50000"
    转为 SteamSpy 兼容格式: "0 .. 20,000"
    """
    if not owners_str:
        return "0 .. 0"
    # 统一分隔符
    owners_str = owners_str.replace(" - ", " .. ").replace(",", "")
    # 重新添加千位分隔符
    nums = re.findall(r"\d+", owners_str)
    if len(nums) == 2:
        return f"{int(nums[0]):,} .. {int(nums[1]):,}"
    elif len(nums) == 1:
        return f"{int(nums[0]):,} .. {int(nums[0]):,}"
    return "0 .. 0"


def convert_record(appid: str, raw: dict) -> dict:
    """
    将单条 Kaggle 记录转换为 05_preprocess.py 兼容的统一格式。
    字段映射策略：Kaggle 数据已经非常完整，大部分字段可以直接映射。
    """

    # ── 基础字段 ──
    name = raw.get("name", "")
    release_date = raw.get("release_date", "")
    price_raw = raw.get("price", 0)
    
    # Kaggle 价格已经是美元浮点数（不需要 /100）
    try:
        price_usd = float(price_raw) if price_raw else 0.0
    except (ValueError, TypeError):
        price_usd = 0.0

    # ── 评价 ──
    positive = int(raw.get("positive", 0) or 0)
    negative = int(raw.get("negative", 0) or 0)

    # ── Owners ──
    owners_str = raw.get("estimated_owners", "0 - 0")
    owners = parse_owners(owners_str)

    # ── CCU ──
    ccu = int(raw.get("peak_ccu", 0) or 0)

    # ── Tags（Kaggle格式已经是 dict {name: votes}）──
    tags = raw.get("tags", {})
    if isinstance(tags, list):
        # 如果是 list 格式，转为 dict
        tags = {t: 1 for t in tags}
    elif not isinstance(tags, dict):
        tags = {}

    # ── 分类信息 ──
    genres = raw.get("genres", [])
    if isinstance(genres, str):
        genres = [genres] if genres else []
    
    categories = raw.get("categories", [])
    if isinstance(categories, str):
        categories = [categories] if categories else []

    developers = raw.get("developers", [])
    if isinstance(developers, str):
        developers = [developers] if developers else []
    
    publishers = raw.get("publishers", [])
    if isinstance(publishers, str):
        publishers = [publishers] if publishers else []

    # ── F2P 判定辅助 ──
    is_free = bool(raw.get("price", 0) == 0 and (
        "Free to Play" in genres or
        "Free to Play" in (tags if isinstance(tags, dict) else {}) or
        any("free" in str(c).lower() for c in categories)
    ))

    # ── 组装统一记录 ──
    return {
        "appid":          str(appid),
        "name":           name,
        "release_date":   release_date,
        "price_usd":      round(price_usd, 2),
        "is_free":        is_free,
        "positive":       positive,
        "negative":       negative,
        "owners":         owners,
        "ccu":            ccu,
        "tags":           tags,
        "genres":         genres,
        "categories":     categories,
        "developers":     developers,
        "publishers":     publishers,
        "header_image":   raw.get("header_image", ""),
        "metacritic":     int(raw.get("metacritic_score", 0) or 0),
        # 保留 Kaggle 独有的额外字段
        "dlc_count":      int(raw.get("dlc_count", 0) or 0),
        "achievements":   int(raw.get("achievements", 0) or 0),
        "recommendations":int(raw.get("recommendations", 0) or 0),
        "avg_playtime":   int(raw.get("average_playtime_forever", 0) or 0),
        "median_playtime":int(raw.get("median_playtime_forever", 0) or 0),
        "windows":        bool(raw.get("windows", True)),
        "mac":            bool(raw.get("mac", False)),
        "linux":          bool(raw.get("linux", False)),
    }


def main():
    print("=" * 60)
    print("Steam 可视化项目 — Kaggle 数据导入")
    print("=" * 60)

    # 查找文件
    files = find_kaggle_files()
    
    if not files:
        print(f"\n✗ 未在 {RAW_DIR} 找到 Kaggle 数据文件。")
        print("  请将 Kaggle 下载的 JSON 放到该目录，支持的文件名：")
        print("    - kaggle_steam.json")
        print("    - games.json")
        print("    - steam_games.json")
        sys.exit(1)

    print(f"\n[1/3] 找到 {len(files)} 个数据文件：")
    for f in files:
        size_mb = f.stat().st_size / 1024 / 1024
        print(f"       {f.name} ({size_mb:.1f} MB)")

    # 加载并合并
    print("\n[2/3] 加载和转换数据...")
    all_records = []
    seen_appids = set()
    skipped = 0

    for fpath in files:
        print(f"  读取 {fpath.name}...")
        with open(fpath, encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                print(f"    ✗ JSON 解析失败：{e}")
                continue

        if isinstance(data, dict):
            # 标准格式：{appid: {game_data}}
            items = data.items()
        elif isinstance(data, list):
            # 列表格式：[{appid: ..., ...}, ...]
            items = []
            for item in data:
                aid = str(item.get("appid", item.get("steam_appid", "")))
                if aid:
                    items.append((aid, item))
        else:
            print(f"    ✗ 不支持的数据结构")
            continue

        for appid, game_raw in items:
            appid = str(appid)
            if appid in seen_appids:
                continue
            seen_appids.add(appid)

            # 基础过滤：跳过没有名字的记录
            if not game_raw.get("name"):
                skipped += 1
                continue

            record = convert_record(appid, game_raw)
            all_records.append(record)

    print(f"\n  转换完成：{len(all_records):,} 款游戏（跳过 {skipped} 条无名记录）")

    # 基础统计
    has_reviews = sum(1 for r in all_records if r["positive"] + r["negative"] > 0)
    has_ccu     = sum(1 for r in all_records if r["ccu"] > 0)
    has_date    = sum(1 for r in all_records if r["release_date"])
    free_count  = sum(1 for r in all_records if r["is_free"])

    print(f"  有评价数据：{has_reviews:,}")
    print(f"  有 CCU 数据：{has_ccu:,}")
    print(f"  有发布日期：{has_date:,}")
    print(f"  免费游戏：  {free_count:,}")

    # 保存
    print(f"\n[3/3] 保存到 {OUTPUT_PATH.name}...")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, separators=(",", ":"))
    
    size_mb = OUTPUT_PATH.stat().st_size / 1024 / 1024
    print(f"  → {OUTPUT_PATH.name} ({size_mb:.1f} MB)")

    print("\n" + "=" * 60)
    print("✓ 导入完成！")
    print(f"  下一步：修改 05_preprocess.py 的 load_raw_data() 以读取此文件")
    print(f"  或直接运行：python 05_preprocess.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
