# Steam二十年：独立游戏如何重塑电子游戏市场生态
**数据可视化大实验 · 清华大学计算机系**

---

## 项目结构

```
steam_project/
├── scripts/
│   ├── 01_fetch_steamspy.py      # 从 SteamSpy API 获取游戏数据
│   ├── 02_fetch_steam_store.py   # 从 Steam Store API 补充发布日期
│   └── 03_preprocess.py          # 数据清洗、分类、生成 D3 所需 JSON
├── data/
│   ├── raw/                      # 原始数据（脚本输出）
│   └── processed/                # 预处理后数据（vis 读取）
│       ├── market_share.json     # 视图一：年度市场份额
│       ├── bubbles.json          # 视图二：散点气泡数据
│       ├── decay.json            # 视图三：生命周期衰减曲线
│       └── meta.json             # 全局元数据
└── vis/
    ├── index.html                # 主页面
    ├── css/style.css             # 样式
    └── js/
        ├── colors.js             # 颜色系统 & 格式化工具
        ├── tooltip.js            # 全局 Tooltip 控制器
        ├── stream.js             # 视图一：Stream Graph
        ├── scatter.js            # 视图二：气泡散点图
        ├── decay.js              # 视图三：衰减曲线
        └── main.js               # 主入口：数据加载 & 响应式
```

---


## TODOLIST

### 数据层（Python 端）

核心职责：确保数据干净、可信、够用，尽早拿到稳定数据。

- [x] **Kaggle 数据接入适配**
  - 新增 `00_import_kaggle.py` 转换器，支持 Kaggle Steam Dataset JSON 格式
  - `03_preprocess.py` 的 `load_raw_data()` 自动检测 Kaggle 格式（`{appid: {game}}` 字典结构）
  - 字段映射：`estimated_owners` → `owners`，`peak_ccu` → `ccu`，价格保持美元不除以100
  - 兼容多种文件名：`games.json`、`kaggle_steam.json`、`steam_games.json`

- [ ] **优先：补全四个数据来源并扩展数据至2025年**
  - 补全Kaggle Steam Dataset、Steam Store API和SteamCharts.com
  - 审查各数据，获取至最新年份

- [x] **修复游戏类型分类规则**
  - 当前 `classify_game_type` 中 `price=0` 直接判定 F2P 过于粗暴
  - 结合 tags 中的 `"Free to Play"` 标签交叉验证
  - 遵循业内规则，修复部分3A大作错分类问题（black myth等）
  - 手动修正已知误分类的游戏（如限免期间的独立游戏）

- [x] **修复 `_get_name` 兼容性问题**
  - pandas Series 的 `.name` 属性返回行索引而非列值，导致游戏名显示为 appid
  - 改用 `row[col] if col in row.index` 访问列值

- [x] **修复 market_share.json 字段名兼容**
  - 输出同时包含长字段名（`total_releases`/`n_indie`）和短字段名（`n`/`ni`/`na`/`nb`/`nf`/`ev`）
  - 修复 numpy 类型无法 JSON 序列化的问题

- [x] **修复年份过滤逻辑**
  - SteamSpy 数据无 `release_date`，所有游戏被 `year.between()` 过滤为空 DataFrame
  - 改为无年份游戏标记 year=0 保留，合并 Kaggle 数据后补上真实年份

- [x] **优化气泡图采样策略**
  - 将 `process_bubbles` 改为分层采样：每个类型按高/中/低人气各取一批
  - 总量控制在 **150–200 条**
  - 额外选 20–30 个"被低估神作"（好评率 > 95%，owners < 2M）
  - 确保散点图有代表性且不拥挤

- [x] **补全视图三的真实衰减数据**
  - 新增 `06_generate_decay.py`，从 `03_fetch_steamcharts.py` 的爬取缓存自动生成真实衰减曲线
  - 数据来源：SteamCharts.com 月度 Avg. Players（非模拟数据）
  - 转换逻辑：用发布日期对齐月度数据 → "发布后第N个月" → 除以首月值归一化
  - 每类型取峰值 CCU 最高的 4 款，共 ~16 条曲线（AAA/AA/Indie/F2P 各 4 款）
  - 内置 20+ 款代表性游戏的发布日期硬编码（Elden Ring、Black Myth、Stardew Valley 等）
  - 自动从 Kaggle 数据 / game_db.json 补充更多发布日期
  - 输出 `data/raw/decay_manual.json`，`05_preprocess.py` 自动检测并替换模拟数据
  - 运行方式：`python 03_fetch_steamcharts.py` → `python 06_generate_decay.py` → `python 05_preprocess.py`

- [x] **生成 CCU 维度的年度份额数据**
  - 新增 `04_fetch_steamcharts.py` 爬取脚本
  - 从 SteamCharts.com 爬取各类型代表性游戏（~100款）的月度 Avg. Players
  - 按年聚合：年度在线占比 = 某类型所有游戏月均在线之和 / 全部之和 × 100%
  - 输出 `data/processed/ccu_share.json`，含 `ci/ca/cb/cf` 字段
  - `03_preprocess.py` 自动合并 `ccu_share.json` 到 `market_share.json`
  - 明确方法论：使用月均在线（非峰值）计算占比，避免时间错位问题

- [x] **扩展 meta.json 统计摘要**
  - 新增字段：各类型好评率中位数、平均 CCU、年度关键指标
  - 供前端 insight 区域和顶部统计卡片动态渲染使用

- [x] **本地游戏数据库 game_db.json**
  - 所有数据源（Kaggle / SteamSpy Top100 / 全量爬取）累积合并
  - 以 appid 为 key，只增不减，持久化到 `data/raw/game_db.json`
  - 重启后秒级恢复，不需要重新爬取
  - merge 逻辑：新 appid 直接加入，已有 appid 更新实时字段（CCU/评价），保留历史字段（release_date）

---

### 后端服务（server.py）

- [x] **Flask 后端 API 服务**
  - `server.py` 同时提供页面静态文件服务和 API 端点
  - 自动搜索前端目录（`vis/` → `frontend/` → 项目根目录）
  - 无需分开启动 `python -m http.server`，一个命令搞定

- [x] **三层渐进式数据加载**
  - Layer 1：启动时从 `game_db.json` 秒级恢复历史数据
  - Layer 2：合并本地 Kaggle 数据
  - Layer 3：实时爬取 SteamSpy Top100 增量更新
  - 每层完成后立即处理 → 更新 `data/processed/` → API 可用

- [x] **实时 CCU 爬取（Steam 官方 API）**
  - `/api/refresh` 调用 `GetNumberOfCurrentPlayers` 接口获取此刻在线人数
  - 10 个并发线程查询 20 款热门游戏，约 1-2 秒返回
  - 每次刷新 CCU 数值都在变化（玩家实时上线下线）

- [ ] **实时变化追踪与 Ticker（待修复显示游戏的选取问题）**
  - `merge_records` 对比新旧数据，记录 CCU 涨跌、新增评价数
  - `/api/refresh` 返回 `live_changes`：CCU 涨幅/跌幅排行、当前在线排行
  - 前端顶部 badge 显示实时 ticker（如 "CS2 CCU ↑3,847 | Dota 2 CCU ↓1,203"）

- [x] **处理结果持久化**
  - `process_and_save()` 同时写入 `data/processed/` 四个 JSON
  - 即使不启动 server，前端也能从静态文件读取

- [ ] **全量爬取端点（待修复）**
  - `POST /api/crawl/start` 启动 SteamSpy 全量分页爬取（后台运行）
  - 每爬 5 页保存一次 + 更新 processed + 更新 API 缓存

---

### 前端数据驱动改造

- [x] **前端三层降级数据加载**
  - 优先：`/api/data` 秒级返回内存缓存数据（<100ms）
  - 其次：`data/processed/*.json` 静态文件
  - 兜底：`data.js` 内嵌示例数据
  - 字段规范化映射：兼容 `total_releases`/`n` 等不同字段名

- [x] **后台异步刷新 + 图表热更新**
  - 页面秒开渲染 → 后台异步调用 `/api/refresh` → 完成后自动 `_streamRedraw` / `_scatterRedraw`
  - 用户感知：页面秒开，几秒后数据悄悄变得更新
  - 待增加不重启服务（如每日刷新）就能获得steamspy的ccu每日快照功能

- [x] **顶部统计卡片数据联动**
  - 四个 `.stat-num` 改为 `data-target` 属性驱动
  - `updateHeroStats()` 从 `DATA.meta` / `DATA.market` 动态计算
  - Counter 动画：cubic ease-out 数字滚动，支持逗号/百分号/中文后缀
  - 四个数字瀑布式启动（间隔 180ms），IntersectionObserver 触发

- [x] **动态化 Insight 文案**
  - 三个视图的洞察文字从硬编码改为数据驱动（`updateInsights()`）
  - 视图一：日均新游戏数、Steam Direct 前后发布量跳升百分比
  - 视图二：Indie/AAA 中位好评率、"神作象限"游戏数量对比
  - 视图三：AAA 三月留存率、最佳独立游戏 24 月留存率及游戏名

- [x] **数据源指示器 Badge**
  - 显示数据来源（后端API实时 / 静态文件 / 内嵌数据）
  - API 模式下显示实时 ticker 和时间戳
  - 爬取中显示 "正在获取最新数据..."

---

### 前端视图修复与交互完善

核心职责：修复已知 bug，补全未实现的交互功能。

- [x] **修复气泡图显示问题**
  - 将所有 `Math.max(4001, d.ccu)` 改为 `Math.max(11, d.ccu)`（共 4 处）
  - Y 轴 `domain` 下限对应调整为 `[10, 4800000]`
  - X 轴 `domain` 根据实际好评率范围自适应，不再硬编码 55
  - 加入游戏名称显示

- [x] **修复气泡半径缩放**
  - 改用 `scalePow(0.35)` 替代 `scaleSqrt`，避免极端值（Dota2 75M）压扁其他气泡
  - `maxR` 根据数据量分档调大（150款时 maxR=36）
  - 大游戏仍然最大，层次分明

- [x] **实现视图一 CCU 在线占比切换**
  - 后端：`04_fetch_steamcharts.py` 爬取 SteamCharts 月均在线数据，`03_preprocess.py` 合并输出 `ci/ca/cb/cf`
  - 前端：点击"在线人数"按钮切换到 CCU 在线占比数据
  - CCU 模式 X 轴从 2012 起（SteamCharts 数据起始年），2012 前无公开 CCU 数据
  - 左侧显著标注"◀ 2012前无公开数据" + 虚线边框灰色区域
  - 底部标注数据来源"SteamCharts.com 月均在线（2012.7起）"
  - Tooltip 区分两种模式：发布模式显示发布量，在线模式显示在线占比 + 月均在线绝对值 + 方法论说明
  - 术语修正："CCU份额"→"在线占比"，基于月均在线（非峰值）计算，避免时间错位问题

- [x] **优化视图一河流图的视觉效果**
  - 每种类型色带改用垂直渐变填充（顶部亮、底部暗）
  - 添加 0.3px 同色描边，增加层间边界感
  - CCU 模式下事件标注和标签位置自动适配缩短的 X 轴

- [x] **实现气泡图搜索功能**
  - UI 上已预留搜索框位置（右上角）
  - 输入游戏名时过滤匹配的气泡并高亮显示
  - 支持模糊匹配，匹配结果自动聚焦
  - 鼠标悬停在搜索匹配结果时高亮显示对应的气泡

- [x] **优化视图三衰减曲线的显示**
  - 每条曲线末端（24月处）直接标注游戏名，位置自动避让防重叠
  - 图例按类型分组，添加类型表头（3A大作/AA中型/独立游戏/F2P免费）
  - 不同类型使用不同线型（AAA 粗实线、AA 虚线、F2P 点线）增加视觉层次
  - 添加关键时间节点标注：首月热度、3个月节点、一年后

- [x] **接入详情面板游戏封面图**
  - 数据中已有 `header_image` 字段
  - 点击气泡后在右侧详情面板顶部展示封面
  - 添加加载失败时的占位图处理

- [x] **接入后端实时数据**
  - 前后端集成到一个 server.py 上
  - 前端 `/api/data` 秒级加载 + `/api/refresh` 后台异步实时爬取
  - SteamSpy 获取实时 CCU（每日快照）
  - SteamStore 获取实时CCU变化，ticker 显示 CCU 涨跌

- [x] **跨视图年份联动交互优化**
  - 散点图筛选栏新增年份下拉选择器，用户无需滚回河流图即可切换年份
  - 河流图点击年份 ↔ 散点图下拉选择器 双向同步
  - 修复首次选择年份时散点不显示的 bug（`_selfEmit` 防护避免 EVT 事件双重 draw 竞态）
  - 河流图 `selectYear` 改为先 `draw()` 再 `emit`，避免跨组件渲染冲突

- [ ] **增加展示实时数据的图表**
  - 将后端能实时爬取数据的功能以可视化的形式展现

- [ ] **优化移动端适配**
  - 散点图在窄屏下详情面板叠在底部体验差，改为弹出浮层或抽屉
  - 衰减曲线图例在小屏上换行过多，考虑折叠/滚动
  - `detail-panel` 添加 `overflow-y: auto` 防止内容溢出✅
  - `decay-legend` 添加 `overflow-x: auto` 支持横向滚动✅
  - 新增 540px 断点：统计卡片单列、标题缩小、footer 纵向排列✅
  - 控件 `flex-wrap` 防止窄屏按钮溢出✅
  - insight 区域窄屏下改为纵向排列✅

---

### 叙事层与整体串联

核心职责：把三个独立视图串成有说服力的数据故事。

- [ ] **增加 scroll-driven 引导叙事**
  - 使用 IntersectionObserver 实现滚动触发
  - 滚到视图一时：自动高亮 2012 / 2017 / 2020 三个关键节点，配渐入文字
  - 滚到视图二时：自动切换到 Indie 筛选并高亮"神作象限"
  - 滚到视图三时：自动高亮独立游戏 vs 3A 的曲线对比

- [ ] **动态化 insight 文案**
  - 读取数据端在 `meta.json` 中输出的统计摘要
  - 将三个视图下方的洞察文字从硬编码改为数据驱动
  - 示例：`独立游戏平均好评率 ${meta.indie_median_pr}%`

- [x] **顶部统计卡片数据联动**
  - 当前 hero 区四个数字是写死的
  - 改为从 `meta.json` 读取，确保与实际数据一致
  - 数字变化时加入 counter 动画效果

- [ ] **打磨视觉细节**
  - 优化三个视图的入口动画（当前仅简单淡入）
  - 统一 tooltip 样式和信息层级
  - 检查字体加载失败时的回退方案
  - 增加页面加载时的整体 loading 状态

- [ ] **撰写方法论文档**
  - 说明数据来源（SteamSpy / Steam Store API / SteamDB）
  - 说明分类规则与采样方法
  - 说明已知局限（owners 为估算值、衰减曲线数据来源等）
  - 放置在页面底部或独立页面

---

### 展示准备

- [ ] **联调测试**
  - 产出新数据后，验证三个视图是否正常显示
  - 检查边界情况（数据为空、极端值、字段缺失）
  - 跨浏览器测试（Chrome / Firefox / Safari）

- [ ] **准备演示叙事线**
  - 线索：2004 年 150 款 → Greenlight 打开闸门 → Direct 彻底放开 → 今天 Indie 占比 98.9%
  - 用衰减曲线收尾：独立游戏不只是数量多，留存也更好
  - 可以每人负责讲解一个视图？

- [ ] **准备答辩材料**
  - PPT / 演示脚本
  - 可能的提问与回答准备
  - 现场演示的网络 / 环境预案（离线可用性）


## 快速开始（三步走）

### 第零步：环境准备
```bash
pip install requests pandas numpy tqdm
```

### 第一步：获取数据
```bash
cd scripts
python 01_fetch_steamspy.py
```
- 先获取 Top100 榜单（约10秒）
- 全量数据需 1-2 小时，**可中途 Ctrl+C，下次运行自动续传**
- 如果只想快速跑通，**跳过全量获取**，后续脚本自动使用 Top100

```bash
python 02_fetch_steam_store.py
```
- 补充发布日期、开发商等字段（视图一必需）
- 建议先用默认的 `max_games=5000`，约需 2.5 小时
- 同样支持断点续传

### 第二步：预处理
```bash
python 03_preprocess.py
```
- 自动生成 `data/processed/` 下的四个 JSON 文件
- 如果 `decay_manual.json` 不存在，会自动生成示例衰减数据并提示

### 第三步：查看可视化
```bash
# 方法A：用任意 HTTP 服务器（推荐）
# 在根目录执行
python -m http.server 8080
# 浏览器打开 http://localhost:8080
# 浏览器点击vis4进入可视化界面

# 方法B：直接双击 vis/index.html（部分浏览器可能因 CORS 限制无法加载本地 JSON）
# 此时可视化会自动使用内嵌的备用数据，所有功能正常可用
```

### 第四步：前后端耦合
使用方式：
```bash
# 1. 安装依赖（一次性）
pip install flask flask-cors pandas numpy tqdm

# 2. 把 server.py 放到项目根目录，启动后端
python server.py --port 5000
```

启动后会看到：
```
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
[db] 从 game_db.json 恢复 122614 款游戏
[kaggle] 读取 games.json...
[db] 合并 [Kaggle]: +0 新增, ~122610 更新, 19676 条变化, 总计 122614
  清洗后：97538 款游戏（含全量），53484 款有有效评价

处理视图一：市场份额...
  生成 21 年的市场份额数据

处理视图二：气泡散点图...
    Indie: 可选 12018 款，取样 40 款（高/中/低分层）
    AA: 可选 2374 款，取样 40 款（高/中/低分层）
    AAA: 可选 510 款，取样 40 款（高/中/低分层）
    F2P: 可选 1416 款，取样 40 款（高/中/低分层）
    被低估神作: 额外 25 款（好评>95%, owners<2M）
  生成 185 个气泡数据点（目标 160，含神作补充）

处理视图三：生命周期衰减曲线...
  未找到手动衰减数据，生成推荐游戏清单...
  推荐游戏清单已保存至：/Users/y3/Desktop/数据可视化/steam_project/data/raw/decay_candidates.json
  请参考 decay_manual_template.json 补全数据，或直接运行可视化（将使用内嵌示例数据）

处理元数据...
  元数据：97538 款游戏，21 个年份
[processed] 已更新 data/processed/ (4 files)
[startup] ✓ 本地数据就绪: 97538 款, 1.4s
[startup] 实时爬取 SteamSpy Top100...
```

浏览器打开 `http://127.0.0.1:5000` 即可  
数据流变化：  
之前：python 03_preprocess.py → 静态 JSON → 前端读文件  
现在：前端 → fetch('/api/market') → server.py → 实时处理 → 返回 JSON  
三层降级策略（data.js 里实现）：  
优先：后端 API（server.py 运行时）→ 顶部显示绿色 ✓「后端API实时数据」
其次：静态 JSON 文件（data/processed/*.json 存在时）→ 显示黄色 ⚡「静态文件数据」
兜底：内嵌示例数据 → 显示 ⚠「使用内嵌示例数据」


## 视图功能说明

### 视图一：市场格局演变（Stream Graph）
- 展示 2004–2024 年各类型游戏（Indie/AA/3A/F2P）发布数量占比的流动变化
- 标注 Greenlight（2012）、Steam Direct（2017）、COVID（2020）三个政策节点
- **悬停**任意区域查看该年详细数字
- **切换按钮**可在发布数量和 CCU 份额之间切换

### 视图二：口碑×人气×规模散点图（气泡图）
- X轴：Steam 好评率；Y轴：历史同时在线峰值（对数）；气泡大小：拥有人数
- **筛选按钮**：按游戏类型过滤，非选中类淡出
- **点击气泡**：右侧详情面板显示该游戏完整信息（封面图、标签等）
- **点击空白处**：取消选中

### 视图三：玩家留存曲线（折线对比图）
- 展示发布后 24 个月的归一化在线人数变化
- 纵轴为相对发布首月峰值的百分比，方便跨游戏对比
- **点击图例项**：高亮该游戏曲线，其余曲线淡出
- **再次点击**：取消高亮，恢复全部显示
- **鼠标移动**：显示当前月份对应的精确数值

---

## 补充真实衰减曲线数据（可选）

视图三默认使用基于行业研究数据参数化生成的曲线。如需使用真实历史 CCU 数据：

1. 查看 `data/raw/decay_candidates.json`，里面列出了推荐补全的游戏及其 SteamDB 链接
2. 访问对应的 SteamDB 页面（如 `https://steamdb.info/app/413150/charts/`），记录历年月度峰值 CCU
3. 按如下格式创建 `data/raw/decay_manual.json`：

```json
[
  {
    "name": "Stardew Valley",
    "type": "Indie",
    "release_year": 2016,
    "peak_ccu": 89063,
    "monthly_ccu": [89063, 68000, 55000, 48000, 42000, 38000, 35000, ...]
  }
]
```

4. 重新运行 `python 03_preprocess.py`，视图三将自动使用真实数据。

---

## 数据来源与合规说明

| 数据源 | 许可证 | 用途 |
|--------|--------|------|
| SteamSpy API (`steamspy.com/api.php`) | 公开免费，官方声明服务于学生/研究者 | 视图二气泡数据 |
| Steam Store API (`store.steampowered.com/api/appdetails`) | Valve 公开接口，无需 Key | 发布日期、开发商 |
| Kaggle FronkonGames 数据集 | CC0 公共领域 | 视图二备用 |
| VG Insights 2024 报告 | 公开报告（数字用于标注） | 统计卡片 |

所有数据均不含用户个人信息，无涉密和隐私风险。

---

## 技术实现

- **前端**：D3.js v7，原生 JavaScript（ES6+），无其他依赖
- **后端**：Python 3.8+（仅用于数据获取和预处理，无需运行时）
- **图表类型**：Stream Graph（stackOffsetWiggle）、气泡散点图（log scale）、折线对比图
- **交互**：跨视图联动（年份滑块驱动）、气泡点击详情面板、衰减曲线图例高亮、响应式布局

---

## 参考文献

1. VG Insights. *Global Indie Games Market Report 2024*. October 2024.
2. Galyonkin, S. *SteamSpy API Documentation*. https://steamspy.com/api.php
3. Shneiderman, B. *The eyes have it*. IEEE Symposium on Visual Languages, 1996.
4. Harrower, M., Brewer, C. A. *ColorBrewer.org*. The Cartographic Journal, 2003.
5. Gasselseder et al. *From Fads to Classics*. arXiv:2506.08881, 2025.
