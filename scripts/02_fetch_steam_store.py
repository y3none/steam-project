"""
Steam可视化项目 - 步骤2：从Steam官方Store API补充发布日期
==========================================================
运行环境：Python 3.8+
依赖安装：pip install requests tqdm

说明：
    SteamSpy 不提供精确发布日期，视图一（年度市场份额）需要此字段。
    Steam Store API 是完全公开的，无需 API Key，无需注册。
    
    接口：https://store.steampowered.com/api/appdetails?appids={appid}&cc=us&l=en
    速率：约 200 次/5分钟（遇到 429 自动退避）

输出文件：
    data/raw/steam_store_details.jsonl  —— 每行一款游戏的商店详情
    data/raw/steam_applist.json          —— Steam 完整 AppID 列表（用于映射）
"""

import requests
import json
import time
import os
from pathlib import Path
from tqdm import tqdm

BASE_DIR    = Path(__file__).parent.parent
RAW_DIR     = BASE_DIR / "data" / "raw"
STORE_URL   = "https://store.steampowered.com/api/appdetails"
APPLIST_URL = "https://api.steampowered.com/ISteamApps/GetAppList/v2/"

# ── 工具函数 ──────────────────────────────────────────────
def safe_get(url, params, retries=5, base_wait=2.0):
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=20)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                wait = base_wait * (2 ** attempt)
                print(f"\n  [限流429] 等待 {wait:.0f}s ...")
                time.sleep(wait)
            else:
                time.sleep(base_wait)
        except Exception as e:
            time.sleep(base_wait * (attempt + 1))
    return None


# ── 1. 获取 Steam 完整 AppID 列表 ────────────────────────
def fetch_applist():
    """获取 Steam 上所有 App 的 ID 和名称映射"""
    out_path = RAW_DIR / "steam_applist.json"
    if out_path.exists():
        print(f"  AppID列表已存在，跳过（删除 {out_path} 可重新获取）")
        with open(out_path) as f:
            return json.load(f)
    
    print("  获取Steam完整AppID列表...")
    data = safe_get(APPLIST_URL, {})
    if not data:
        print("  获取失败")
        return {}
    
    apps = {str(app["appid"]): app["name"] 
            for app in data.get("applist", {}).get("apps", [])}
    
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(apps, f, ensure_ascii=False)
    print(f"  AppID列表已保存：{len(apps)} 个应用")
    return apps


# ── 2. 从 SteamSpy 数据提取需要查询详情的 AppID ──────────
def get_target_appids(max_games: int = 50000) -> list[int]:
    """
    读取 SteamSpy 全量数据，提取 owners > 0 的游戏 AppID。
    如果全量数据未下载，则使用 Top100 数据。
    """
    all_path = RAW_DIR / "steamspy_all.jsonl"
    top100_path = RAW_DIR / "steamspy_top100.json"
    
    appids = []
    
    if all_path.exists():
        print(f"  从全量数据提取 AppID（最多 {max_games} 款）...")
        with open(all_path, encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    if obj.get("appid") and obj.get("owners", "0") != "0":
                        appids.append(int(obj["appid"]))
                        if len(appids) >= max_games:
                            break
                except:
                    pass
    elif top100_path.exists():
        print("  全量数据未找到，使用 Top100 数据...")
        with open(top100_path) as f:
            top100 = json.load(f)
        for section in top100.values():
            for appid in section.keys():
                try:
                    appids.append(int(appid))
                except:
                    pass
        appids = list(set(appids))
    
    print(f"  目标 AppID 数量：{len(appids)}")
    return appids


# ── 3. 批量获取 Store 详情 ─────────────────────────────────
def fetch_store_details(appids: list[int], batch_size: int = 1):
    """
    逐个查询 Steam Store API 获取游戏详情。
    重点提取：release_date, genres, categories, developers, publishers,
              is_free, price_overview, platforms, metacritic
    
    注：Store API 支持批量查询（appids参数逗号分隔），但实践中单条更稳定。
    """
    out_path = RAW_DIR / "steam_store_details.jsonl"
    
    # 断点续传：读取已完成的 appid
    done = set()
    if out_path.exists():
        with open(out_path, encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    done.add(obj.get("_appid"))
                except:
                    pass
        print(f"  断点续传：已完成 {len(done)} 款")
    
    remaining = [aid for aid in appids if aid not in done]
    print(f"  待获取：{len(remaining)} 款（速率约 200次/5分钟）")
    
    request_count = 0
    with open(out_path, "a", encoding="utf-8") as f:
        for appid in tqdm(remaining, desc="Store详情"):
            data = safe_get(STORE_URL, {
                "appids": appid,
                "cc": "us",
                "l": "english",
                "filters": "basic,release_date,genres,categories,developers,publishers,metacritic,price_overview"
            })
            
            if data and str(appid) in data:
                app_data = data[str(appid)]
                if app_data.get("success") and app_data.get("data"):
                    record = _extract_store_fields(appid, app_data["data"])
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
            else:
                # 记录失败（appid不存在或已下架）
                f.write(json.dumps({"_appid": appid, "_status": "failed"}, ensure_ascii=False) + "\n")
            
            request_count += 1
            # 速率控制：约 1.5 秒/次，避免触发 429
            time.sleep(1.6)
            
            # 每 100 次请求暂停 10 秒缓冲
            if request_count % 100 == 0:
                time.sleep(10)
    
    print(f"\n  Store详情已保存至：{out_path}")


def _extract_store_fields(appid: int, data: dict) -> dict:
    """提取 Store API 中对可视化有用的字段"""
    release = data.get("release_date", {})
    price   = data.get("price_overview", {})
    meta    = data.get("metacritic", {})
    
    return {
        "_appid":       appid,
        "name":         data.get("name", ""),
        "type":         data.get("type", ""),          # game / dlc / music ...
        "is_free":      data.get("is_free", False),
        "release_date": release.get("date", ""),       # e.g. "21 Feb, 2023"
        "coming_soon":  release.get("coming_soon", False),
        "developers":   data.get("developers", []),
        "publishers":   data.get("publishers", []),
        "genres":       [g["description"] for g in data.get("genres", [])],
        "categories":   [c["description"] for c in data.get("categories", [])],
        "platforms":    data.get("platforms", {}),
        "price_usd":    price.get("final", 0) / 100 if price else 0,  # 转换为美元
        "metacritic":   meta.get("score", None),
        "required_age": data.get("required_age", 0),
        "header_image": data.get("header_image", ""),  # 用于视图三的游戏封面图
    }


# ── 主流程 ─────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("Steam 可视化项目 — Steam Store API 数据补全")
    print("=" * 60)
    
    print("\n[1/3] 获取 AppID 列表...")
    fetch_applist()
    
    print("\n[2/3] 确定目标 AppID...")
    # 先处理 Top100，跑通流程；有全量数据再处理全量
    # 修改 max_games 控制处理数量（全量约 50,000，约需 22 小时；
    # 建议先用 max_games=3000 约需 1.5 小时跑出足够的可视化数据）
    appids = get_target_appids(max_games=5000)
    
    print("\n[3/3] 批量获取 Store 详情（支持断点续传）...")
    fetch_store_details(appids)
    
    print("\n✓ 完成！请运行 03_preprocess.py 进行数据预处理。")
