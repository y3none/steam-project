# Steam二十年：独立游戏如何重塑电子游戏市场生态
**数据可视化大实验 · 清华大学计算机系**

---

## 项目简介

一个面向 Steam 平台的全栈数据可视化项目，从原始数据采集、清洗、预处理到前端交互叙事完整闭环。
通过**市场、口碑、留存、机会**四个维度 + **综合结论**视图，回答"在这二十年里，独立游戏如何重塑了电子游戏市场的生态"，并在最后给出"**该做一款什么游戏**"的蓝海机会判断。

---

## 项目结构

```
steam_project/
├── scripts/                          # 数据采集与预处理
│   ├── 01_fetch_steamspy.py          # SteamSpy 全量 + Top100 榜单爬取
│   ├── 02_fetch_steam_store.py       # Steam Store API 补发布日期等
│   ├── 03_fetch_steamcharts.py       # SteamCharts 月度 CCU 爬取
│   ├── 04_import_kaggle.py           # Kaggle Steam Dataset 导入（一次性）
│   ├── 05_preprocess.py              # 主预处理：清洗、分类、输出 D3 所需 JSON
│   ├── 06_generate_decay.py          # 基于 03 的缓存生成真实衰减曲线
│   ├── 07_genre_opportunity.py       # 品类机会地图（"该做什么游戏"）
│   └── weekly_update.sh              # 每周全量更新（crontab 可调度）
├── data/
│   ├── raw/                          # 原始数据 + game_db.json 真值库
│   └── processed/                    # 预处理后 JSON（前端读取）
│       ├── market_share.json         # 视图 1：年度市场份额 + CCU 在线占比
│       ├── bubbles.json              # 视图 2：分层采样的气泡散点
│       ├── decay.json                # 视图 3：单款衰减曲线
│       ├── decay_aggregate.json      # 视图 3：类型聚合（合成队列法）
│       ├── genre_opportunity.json    # 视图 6：品类机会矩阵
│       └── meta.json                 # 全局元数据 / 统计摘要
├── vis4/                             # 前端可视化
│   ├── index.html                    # 主页面（6 个 section）
│   └── js/
│       ├── colors.js                 # 配色 / 格式化工具
│       ├── data.js                   # 三层降级数据加载
│       ├── tooltip.js                # 全局 Tooltip 控制器
│       ├── link-hints.js             # 跨视图联动脉冲提示
│       ├── narrative.js              # scroll-driven 滚动叙事
│       ├── tour.js                   # 自动导览（6 章故事播放）
│       ├── stream.js                 # 视图 1：Stream Graph
│       ├── scatter.js                # 视图 2：气泡散点图
│       ├── decay.js                  # 视图 3：衰减曲线（含类型聚合 + 时间扫描）
│       ├── method.js                 # 视图 4：方法论说明
│       ├── synthesis.js              # 视图 5：三因一果结论
│       ├── genre.js                  # 视图 6：品类机会蓝海图
│       └── main.js                   # 入口：数据加载 / 响应式 / EVT 总线
├── server.py                         # Flask 一体化后端（静态 + API）
└── games.csv                         # 早期遗留参考数据
```

---

## 功能特性

### 数据层（Python 端）

- **多数据源融合**：SteamSpy API + Steam Store API + SteamCharts.com + Kaggle Steam Dataset，四套来源互为补充
- **本地真值库 `game_db.json`**：以 appid 为 key 累积合并，只增不减，重启后秒级恢复，无需重新爬取
- **断点续传**：SteamSpy 全量分页爬取支持 Ctrl+C 中断后下次自动续传
- **分类正交化**：制作规模（Indie / AA / AAA）⇄ 商业模式（F2P / 付费）正交双维度分类，避免 3A 大作错分、避免 F2P 与 Indie 互相覆盖
- **气泡分层采样**：每个类型按高 / 中 / 低人气分层抽取，控制总量 150–200，并额外补 20–30 款"被低估神作"（好评率 > 95% 且 owners < 2M）
- **真实衰减曲线**：从 SteamCharts 月度数据对齐到"发布后第 N 个月"，归一化后输出真实历史 CCU 衰减，过滤持续增长型长线运营游戏
- **类型聚合留存（合成队列法 Synthetic Cohort）**：12 万款游戏按类型 × 游戏年龄逐年分组，取中位游戏时长归一化，主指标 `playtime_normalized`，不可用时降级为 `engagement_normalized`（peak_ccu ÷ owners）
- **CCU 在线占比年度数据**：基于月均在线（非峰值）口径，避免时间错位
- **品类机会地图 `07_genre_opportunity.py`**：按 SteamSpy tag 聚合，输出供给（在售游戏数）、需求（中位 / p75 / 均值三口径 owners）、市场规模、动量趋势（近三年 vs 前三年发行增速），并标注命中率与质量门槛

### 后端服务（server.py）

- **Flask 一体化**：单进程同时提供静态站点服务和 API，不再需要另起 `http.server`
- **三层渐进式数据加载**：启动时从 `game_db.json` 秒级恢复 → 合并本地 Kaggle → 实时爬取 SteamSpy Top100 增量，每完成一层立即更新 `processed/` 并开放 API
- **API 端点**：
  - `GET /api/data` — 秒级返回市场 / 气泡 / 衰减聚合 / 元数据
  - `GET /api/market` — 年度市场份额
  - `GET /api/decay_aggregate` — 类型聚合衰减
  - `POST /api/refresh` — 增量爬取 Top100 + 拉取 Steam 官方 `GetNumberOfCurrentPlayers` 实时 CCU
  - `POST /api/crawl/start` — 后台全量分页爬取
- **持久化**：每次新鲜数据自动 merge 回 `game_db.json` 并落到 `processed/*.json`，前端即使不连 API 也能读静态文件

### 前端视图（5 个主视图 + 1 个综合视图 + 自动导览）

| 视图 | Section | 主题 | 关键交互 |
|---|---|---|---|
| **01 MARKET** | Stream Graph | 二十年市场份额流动 | 发布占比 ↔ CCU 在线占比双模式切换，点击年份联动散点图；事件标注 Greenlight (2012) / Steam Direct (2017) / COVID (2020)；条带垂直渐变填充 |
| **02 QUALITY** | 气泡散点 | 好评率 × 在线 × 拥有量 | 类型筛选 / 模糊搜索 / 年份联动下拉 / 神作象限高亮 / 点击查看封面详情面板 |
| **03 RETENTION** | 衰减曲线 | 24 个月留存 | 单款 ↔ 类型聚合切换 / 图例点击高亮 / 时间游标扫描（独立 vs AAA 差距随月份拉开） |
| **04 METHOD** | 方法论 | 数据来源 / 口径 / 局限 | 静态说明 section |
| **05 SYNTHESIS** | 结论 | 三因一果 | 数量 / 质量 / 留存三张"因"卡 + 四个大数字滚动计数，IntersectionObserver 自动播放 |
| **06 OPPORTUNITY** | 品类机会 | 该做什么游戏 | 蓝海 / 红海 / 小众 / 过度饱和四象限，气泡大小=市场规模、颜色=趋势 |

**视觉与交互细节**：

- 气泡半径改用 `scalePow(0.35)` 抗极端值（Dota2 75M 不再压扁其他气泡）
- Y 轴改用对数标度 `domain([10, 4_800_000])`
- 详情面板支持 `header_image` 封面图 + 加载失败占位
- Hero 顶部统计卡片 `data-target` 驱动 + IntersectionObserver + cubic ease-out 数字滚动，四个数字瀑布式启动
- 三个视图的 `insight` 文案数据驱动（日均新游、Steam Direct 前后跳升、神作象限、24 月留存等）

### 跨视图联动与叙事

- **EVT 总线**：散点图年份下拉 ↔ 河流图点击年份双向同步，避让双重 draw 竞态
- **`link-hints.js`**：联动触发时接收方视图脉冲高亮 + 「← 联动自 XX」提示 chip，零侵入
- **`narrative.js` scroll-driven**：滚到视图 1 自动高亮 2012/2017/2020；滚到视图 2 高亮神作象限；首次播放后允许按钮重播，不再霸占展示
- **`tour.js` 自动导览**：6 章叙事（序章 → 数量 → 跨视图联动 → 质量 → 留存 → 终章），常驻按钮 + 字幕条 + 进度点 + 播放/暂停/上一段/下一段/退出，支持空格 / ← → / Esc 键盘控制，尊重 `reduced-motion`
- **章节动态化**：导览中河流图沿时间线依次高亮、衰减图竖线时间游标扫描、结论视图大数字 counter

### 实时性

- **数据源 Badge**：顶部实时显示数据来源（后端 API / 静态文件 / 内嵌数据）+ 最后更新时间
- **CCU Ticker**：API 模式下，顶部跑马灯实时滚动 `CS2 ↑3,847 | Dota 2 ↓1,203` 等实时变化
- **后台异步刷新**：页面秒开后异步调用 `/api/refresh`，几秒后图表热更新
- **三层降级**：优先后端 API（< 100ms 返回内存缓存）→ 静态 JSON → 内嵌示例数据

---

## 架构原理

```
   ┌────────────────────────────────────────────────┐
   │  数据源                                         │
   │  SteamSpy · Steam Store · SteamCharts · Kaggle │
   └───────────────────┬────────────────────────────┘
                       │ scripts/01-07
                       ▼
   ┌─────────────────────────────────────────────┐
   │  data/raw/                                  │
   │   ├ game_db.json   ◄── 只增不减的真值库        │
   │   └ *.jsonl / *.json  各源原始缓存            │
   └───────────────────┬─────────────────────────┘
                       │ 05_preprocess.py
                       ▼
   ┌─────────────────────────────────────────────┐
   │  data/processed/*.json                      │
   │  (market / bubbles / decay / genre / meta)  │
   └───────────────────┬─────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                              ▼
 ┌────────────────┐           ┌─────────────────┐
 │  server.py     │           │  浏览器直读       │
 │  Flask + API   │           │  静态 JSON       │
 │  内存缓存       │           │  （离线 fallback）│
 └────────┬───────┘           └─────────┬───────┘
          │                             │
          └──────────┬──────────────────┘
                     ▼
          ┌────────────────────────┐
          │  vis4/js/ (D3.js v7)   │
          │  三层降级 data.js        │
          │  EVT 总线 + 跨视图联动    │
          │  scroll-driven + tour  │
          └────────────────────────┘
```

**关键设计**：

1. **game_db.json 是唯一源**——所有源的数据最终都 merge 进它，重启后秒级恢复
2. **server.py 仅作为缓存层**——不依赖它运行，关掉服务也能从静态 JSON 读到完整数据
3. **前端永远先尝试 API → 静态 → 内嵌**，三层降级保证任何环境下都能演示

---

## 运行说明

### 第零步：环境依赖

```bash
pip install requests pandas numpy tqdm flask flask-cors
```

> Python 3.8+。conda 用户可创建独立环境：`conda create -n steam-project python=3.10`

### 第一步：数据预处理（首次运行）

预处理脚本有严格的依赖顺序：**1 → 2 → 3 → 4 → 6 → 5 → 7**

```bash
cd scripts

# 1. 获取 SteamSpy 全量数据（约 1-2 小时，支持 Ctrl+C 续传；
#    想快速跑通可只跑 Top100，后续脚本会自动降级使用）
python 01_fetch_steamspy.py

# 2. 补全 Steam Store 发布日期（视图 1 必需；建议 max_games=5000）
python 02_fetch_steam_store.py

# 3. 爬取 SteamCharts 月度 CCU（约 3-4 分钟，自带缓存）
python 03_fetch_steamcharts.py

# 4. 导入 Kaggle 数据集（一次性；如没有 Kaggle 数据可跳过）
python 04_import_kaggle.py

# 5. 基于第 3 步的缓存生成真实衰减曲线（必须在 05 之前）
python 06_generate_decay.py

# 6. 主预处理：清洗、分类、输出 processed/*.json
python 05_preprocess.py

# 7. 计算品类机会矩阵（视图 6 必需；基于第 5 步的全量分类结果）
python 07_genre_opportunity.py
```

### 第二步：定周更新（可选）

每周自动拉取全量数据并重新预处理，已配置好正确脚本顺序（`1 2 3 6 5 7`）：

```bash
bash scripts/weekly_update.sh
```

如需挂 cron，编辑 `crontab -e` 添加（每周一凌晨 3 点）：

```
0 3 * * 1 /path/to/steam_project/scripts/weekly_update.sh >> /path/to/steam_project/data/update.log 2>&1
```

> `04_import_kaggle.py` 不在 weekly 内——Kaggle 数据集是手动下载的静态快照，首次导入即可。

### 第三步：启动服务

```bash
python server.py --host 0.0.0.0 --port 8000
```

浏览器打开 **http://localhost:8000/** 即可。

启动时控制台会输出类似：

```
 * Running on http://0.0.0.0:8000
[db] 从 game_db.json 恢复 NNNNN 款游戏
[kaggle] 读取 games.json...
[db] 合并 [Kaggle]: +0 新增, ~NNNNN 更新, NNNN 条变化, 总计 NNNNN
  清洗后：NNNNN 款游戏（含全量），NNNNN 款有有效评价

处理视图一：市场份额...
处理视图二：气泡散点图...
处理视图三：生命周期衰减曲线...
处理元数据...
[processed] 已更新 data/processed/ (5 files)
[startup] ✓ 本地数据就绪
[startup] 实时爬取 SteamSpy Top100...
```

页面顶部 Badge 应显示绿色 ✓「**后端 API 实时数据**」。如果显示黄色 ⚡「静态文件数据」表示 server 未起，前端会自动降级到 `processed/*.json`；显示 ⚠「使用内嵌示例数据」表示连静态 JSON 都没有，进入纯离线演示模式。

---

## 视图说明

### View 01 · MARKET：市场格局演变（Stream Graph）
2004–2024 年各类型游戏（Indie / AA / AAA / F2P）发布数量占比的流动变化。
标注 Greenlight (2012) / Steam Direct (2017) / COVID (2020) 政策节点。
点击 ### 切换「发布占比」与「CCU 在线占比」两种口径——后者基于 SteamCharts 月均在线计算，仅 2012 起可用。

### View 02 · QUALITY：口碑 × 人气 × 规模（气泡散点）
X 轴 Steam 好评率、Y 轴峰值在线（对数）、气泡大小为拥有量。
- 顶部筛选条：类型过滤 + 模糊搜索 + 年份下拉（双向联动视图 1）
- 点击气泡：右侧详情面板显示封面图、标签、估算 owners 等
- "神作象限"高亮：好评 > 95% 且在线 < 中位数

### View 03 · RETENTION：玩家留存（衰减曲线）
- **单款模式**：4 类型各 4 款代表作，发布后 24 个月归一化 CCU 变化
- **类型聚合模式**：合成队列法（synthetic cohort），4 条类型曲线 + 半透明面积填充
- 图例点击高亮 / 时间游标扫描对比独立 vs AAA

### View 04 · METHOD：方法论
数据来源、分类规则、采样策略、衰减曲线算法、已知局限（owners 估算分桶、SteamCharts 2012 起步等）。

### View 05 · SYNTHESIS：三因一果（结论）
把"数量 / 质量 / 留存"三个发现收束成论点，并以"独立游戏的发现性危机"作为反转收尾。
入场动画：三张「因」卡错峰浮现 + 四个大数字滚动计数。

### View 06 · OPPORTUNITY：品类机会地图（"该做一款什么游戏"）
按 SteamSpy tag 聚合的蓝海 / 红海四象限矩阵：
- 横轴=供给（在售游戏数）
- 纵轴=需求（multiple 口径 owners）
- 气泡大小=市场规模
- 颜色=近三年发行动量（红=升温 / 蓝=降温）

象限含义：左上 高需求低供给（**蓝海**）/ 右上 高需求高供给（红海）/ 左下 低需求低供给（小众）/ 右下 低需求高供给（过度饱和）。

### 自动导览 · tour
常驻启动按钮 + 字幕条 + 进度点 + 键盘控制（空格 / ← → / Esc）。
6 章叙事：序章 → 数量 → 跨视图联动 → 质量 → 留存 → 终章，复用各视图现有 narrative 接口。
尊重系统 `prefers-reduced-motion`，开启时直接跳到终态。

---

## 数据来源与合规说明

| 数据源 | 许可证 | 用途 |
|--------|--------|------|
| SteamSpy API (`steamspy.com/api.php`) | 公开免费，声明服务学生 / 研究者 | 拥有量、CCU、tags、分类基础数据 |
| Steam Store API (`store.steampowered.com/api/appdetails`) | Valve 公开接口，无需 Key | 发布日期、开发商、封面图 |
| SteamCharts.com | 公开网页，月度 Avg. Players | 视图 1 CCU 占比、视图 3 真实衰减、类型聚合 |
| Kaggle FronkonGames Steam Dataset | CC0 公共领域 | 视图 2 备用、release_date 补全 |
| VG Insights 2024 报告 | 公开报告（引用数字） | 统计卡片对照 |

所有数据均不含用户个人信息，无涉密和隐私风险。

---

## 技术栈

- **前端**：D3.js v7、原生 ES6+、IntersectionObserver、CSS Custom Properties
- **后端**：Python 3.8+ / Flask / Flask-CORS
- **数据**：pandas / numpy / tqdm / requests
- **图表类型**：Stream Graph (`stackOffsetWiggle`)、对数气泡散点、衰减折线、品类矩阵气泡、聚合面积、Counter Animation
- **交互**：EVT 总线跨视图联动、scroll-driven 触发、自动导览播放器、三层降级数据加载

---

## 参考文献

1. VG Insights. *Global Indie Games Market Report 2024*. October 2024.
2. Galyonkin, S. *SteamSpy API Documentation*. https://steamspy.com/api.php
3. Shneiderman, B. *The eyes have it*. IEEE Symposium on Visual Languages, 1996.
4. Harrower, M., Brewer, C. A. *ColorBrewer.org*. The Cartographic Journal, 2003.
5. Gasselseder et al. *From Fads to Classics*. arXiv:2506.08881, 2025.
