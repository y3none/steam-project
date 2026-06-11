#!/bin/bash
# Steam可视化项目 - 每周全量数据更新
# ============================================================
# 顺序：01 → 02 → 03 → 06 → 05 → 07
#   01/02/03 拉新源数据；06 需要 03 的 steamcharts_raw.json；
#   05 主预处理，必须先于 07；07 算品类机会地图。
#   04_import_kaggle.py 不参与（Kaggle 是静态快照，首次手动导入）。
#
# 使用方式（crontab）：
#   0 3 * * 1 /data1/zhourf/steam-project/scripts/weekly_update.sh \
#             >> /data1/zhourf/steam-project/data/update.log 2>&1

set -e
cd "$(dirname "$0")/.."

echo "=== $(date) 开始全量数据更新 ==="

# 激活 conda 环境（如未启用 conda，可注释掉下面两行）
source ~/miniconda3/etc/profile.d/conda.sh 2>/dev/null || true
conda activate steam-project 2>/dev/null || true

# 步骤 1：全量获取 SteamSpy 数据（耗时约 1-2 小时；<<< "y" 触发全量爬取确认）
echo "[1/6] 获取 SteamSpy 全量数据..."
python scripts/01_fetch_steamspy.py <<< "y"

# 步骤 2：补全 Steam Store 详情（发布日期 / 开发商 / 封面）
echo "[2/6] 补全 Steam Store 详情..."
python scripts/02_fetch_steam_store.py

# 步骤 3：爬取 SteamCharts 月度 CCU（自带缓存，约 3-4 分钟）
echo "[3/6] 爬取 SteamCharts 月度 CCU..."
python scripts/03_fetch_steamcharts.py

# 步骤 4：基于 SteamCharts 缓存生成真实衰减曲线（必须在 05 之前）
echo "[4/6] 生成真实衰减曲线..."
python scripts/06_generate_decay.py

# 步骤 5：主预处理 → 输出 processed/*.json（注意：脚本名是 05_preprocess.py）
echo "[5/6] 数据预处理..."
python scripts/05_preprocess.py

# 步骤 6：计算品类机会地图（视图 6；依赖 05 的全量分类结果）
echo "[6/6] 计算品类机会地图..."
python scripts/07_genre_opportunity.py

echo "=== $(date) 全量数据更新完成 ==="
