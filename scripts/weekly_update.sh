#!/bin/bash
# Steam可视化项目 - 每周全量数据更新
# 使用方式：crontab -e 添加以下行（每周一凌晨 3 点执行）
# 0 3 * * 1 /data1/zhourf/steam-project/scripts/weekly_update.sh >> /data1/zhourf/steam-project/data/update.log 2>&1

set -e
cd "$(dirname "$0")/.."

echo "=== $(date) 开始全量数据更新 ==="

# 激活 conda 环境
source ~/miniconda3/etc/profile.d/conda.sh
conda activate steam-project

# 步骤1：全量获取 SteamSpy 数据（耗时约 1-2 小时）
echo "[1/3] 获取 SteamSpy 全量数据..."
python scripts/01_fetch_steamspy.py <<< "y"

# 步骤2：补全 Steam Store 详情
echo "[2/3] 补全 Steam Store 详情..."
python scripts/02_fetch_steam_store.py

# 步骤3：数据预处理，生成 JSON
echo "[3/3] 数据预处理..."
python scripts/03_preprocess.py

echo "=== $(date) 全量数据更新完成 ==="
