"""
Steam可视化项目 - 步骤1：从SteamSpy API获取数据
================================================
运行环境：Python 3.8+
依赖安装：pip install requests tqdm

用法：
    python 01_fetch_steamspy.py

输出文件（保存至 data/raw/）：
    steamspy_all.jsonl      —— 全量游戏基础数据（owners, ccu, tags, genre等）
    steamspy_tags.json      —— 标签列表
    steamspy_top100.json    —— Top100常驻榜单

注意：
  - all 接口速率限制：1次/60秒，每页1000条，全量约需 1-2 小时
  - 单游戏接口：1次/秒，如需补全字段可按需调用
  - 数据已足够支撑全部三个视图，无需Steam官方API Key
"""

import requests
import json
import time
import os
from pathlib import Path
from tqdm import tqdm

# ── 路径配置 ──────────────────────────────────────────────
BASE_DIR  = Path(__file__).parent.parent
RAW_DIR   = BASE_DIR / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL  = "https://steamspy.com/api.php"

# ── 工具函数 ──────────────────────────────────────────────
def safe_get(url: str, params: dict, retries: int = 5, wait: float = 2.0) -> dict | None:
    """带重试的 GET 请求，处理限流和网络错误"""
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=30)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                sleep_time = wait * (2 ** attempt)
                print(f"  [限流] 等待 {sleep_time:.0f}s ...")
                time.sleep(sleep_time)
            else:
                print(f"  [HTTP {resp.status_code}] 重试 {attempt+1}/{retries}")
                time.sleep(wait)
        except requests.exceptions.RequestException as e:
            print(f"  [网络错误] {e}，重试 {attempt+1}/{retries}")
            time.sleep(wait * (attempt + 1))
    return None


# ── 1. 获取全量游戏数据 ───────────────────────────────────
def fetch_all_games():
    """
    通过 all 接口分页获取全量游戏数据。
    返回字段：appid, name, developer, publisher, score_rank,
              owners, average_forever, average_2weeks, 
              median_forever, price, ccu, languages, genre, tags
    """
    out_path = RAW_DIR / "steamspy_all.jsonl"
    
    # 断点续传：检查已下载的页数
    completed_pages = set()
    if out_path.exists():
        with open(out_path, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    if "_page" in obj:
                        completed_pages.add(obj["_page"])
                except:
                    pass
        print(f"  断点续传：已完成 {len(completed_pages)} 页")

    print("开始获取全量数据（all 接口，1次/60秒，约需 1-2 小时）...")
    print("可以 Ctrl+C 中断，下次运行会自动续传。\n")

    page = 0
    total_games = 0

    with open(out_path, "a", encoding="utf-8") as f:
        while True:
            if page in completed_pages:
                page += 1
                continue

            data = safe_get(BASE_URL, {"request": "all", "page": str(page)})
            
            if not data:
                print(f"页 {page} 获取失败，停止。")
                break
            if len(data) == 0:
                print(f"页 {page} 为空，全量获取完成。共 {total_games} 款游戏。")
                break

            # 写入每条记录，附带页号用于断点续传
            for appid, game in data.items():
                game["_page"] = page
                f.write(json.dumps(game, ensure_ascii=False) + "\n")
            
            total_games += len(data)
            print(f"  页 {page:4d} ✓  本页 {len(data)} 款  累计 {total_games} 款")
            
            page += 1
            # all 接口限速：60秒一次
            time.sleep(61)

    print(f"\n全量数据已保存至：{out_path}")
    return total_games


# ── 2. 获取 Top100 榜单 ────────────────────────────────────
def fetch_top100():
    """获取三个 Top100 榜单，用于视图二的代表性游戏选取"""
    endpoints = {
        "top100forever":  "历史总在线人数 Top100",
        "top100in2weeks": "近两周在线人数 Top100",
        "top100owned":    "拥有人数 Top100",
    }
    result = {}
    for request_type, desc in endpoints.items():
        print(f"  获取 {desc} ...")
        data = safe_get(BASE_URL, {"request": request_type})
        if data:
            result[request_type] = data
            time.sleep(1.5)
    
    out_path = RAW_DIR / "steamspy_top100.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"  Top100 榜单已保存至：{out_path}")


# ── 3. 获取指定游戏详情（可选：补全特定游戏的 tag 投票数）──
def fetch_game_detail(appids: list[int]) -> dict:
    """
    对特定 appid 列表调用 appdetails 接口，获取详细 tags 投票数。
    appdetails 速率：1次/秒。
    """
    out_path = RAW_DIR / "steamspy_details.jsonl"
    results = {}
    
    print(f"获取 {len(appids)} 款游戏的详细数据...")
    with open(out_path, "a", encoding="utf-8") as f:
        for appid in tqdm(appids, desc="游戏详情"):
            data = safe_get(BASE_URL, {"request": "appdetails", "appid": str(appid)})
            if data:
                f.write(json.dumps(data, ensure_ascii=False) + "\n")
                results[appid] = data
            time.sleep(1.1)
    
    print(f"详情已保存至：{out_path}")
    return results


# ── 4. 获取标签列表 ────────────────────────────────────────
def fetch_tag_list():
    """获取 Steam 上所有可用的用户标签列表"""
    # SteamSpy 没有专门的标签列表接口，从全量数据中提取（在预处理脚本中完成）
    # 这里直接从 top100 的 tags 字段中采集常见标签作为预热
    top100_path = RAW_DIR / "steamspy_top100.json"
    if not top100_path.exists():
        print("  请先运行 fetch_top100()")
        return
    
    with open(top100_path, "r") as f:
        top100 = json.load(f)
    
    all_tags = {}
    for section in top100.values():
        for appid, game in section.items():
            for tag, count in game.get("tags", {}).items():
                all_tags[tag] = all_tags.get(tag, 0) + count
    
    sorted_tags = dict(sorted(all_tags.items(), key=lambda x: -x[1]))
    out_path = RAW_DIR / "steamspy_tags.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(sorted_tags, f, ensure_ascii=False, indent=2)
    print(f"  常用标签已保存至：{out_path}（共 {len(sorted_tags)} 个）")


# ── 主流程 ─────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("Steam 可视化项目 — 数据获取脚本")
    print("=" * 60)
    
    # 快速获取 Top100（约 5 秒）
    print("\n[1/3] 获取 Top100 榜单...")
    fetch_top100()
    
    # 从 Top100 提取常用标签
    print("\n[2/3] 提取标签列表...")
    fetch_tag_list()
    
    # 全量数据（耗时较长）
    print("\n[3/3] 获取全量游戏数据（耗时约 1-2 小时）...")
    print("提示：可以先 Ctrl+C 退出，用 Top100 数据跑通后续脚本，")
    print("      再回来跑全量。全量数据用于视图一的市场份额统计。")
    confirm = input("\n是否现在开始全量获取？[y/N] ").strip().lower()
    if confirm == "y":
        fetch_all_games()
    else:
        print("跳过全量获取。后续脚本将使用 Top100 数据作为近似。")
    
    print("\n✓ 数据获取完成，请运行 02_fetch_steam_store.py 补全发布日期等字段。")
