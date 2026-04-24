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

核心职责：确保数据干净、可信、够用。**优先完成任务 1、2、4**，尽早拿到稳定数据。

- [x] **修复游戏类型分类规则**
  - 当前 `classify_game_type` 中 `price=0` 直接判定 F2P 过于粗暴
  - 结合 tags 中的 `"Free to Play"` 标签交叉验证
  - 手动修正已知误分类的游戏（如限免期间的独立游戏）

- [x] **优化气泡图采样策略**
  - 将 `process_bubbles` 改为分层采样：每个类型按高/中/低人气各取一批
  - 总量控制在 **150–200 条**
  - 额外选 20–30 个"被低估神作"（好评率 > 95%，owners < 2M）
  - 确保散点图有代表性且不拥挤

- [ ] **补全视图三的真实衰减数据**
  - 从 SteamDB 手动采集 **10–15 款**代表性游戏的 24 个月 CCU 历史
  - 各类型（Indie / AA / AAA / F2P）至少 2–3 款
  - 按格式填入 `data/raw/decay_manual.json`
  - 替换掉目前的参数化模拟曲线

- [ ] **生成 CCU 维度的年度份额数据**
  - 当前 `market_share.json` 只有发布数量维度
  - 新增按年度 CCU 总量汇总的各类型份额数据
  - 供视图一"在线人数"切换按钮使用

- [ ] **扩展 meta.json 统计摘要**
  - 新增字段：各类型好评率中位数、平均 CCU、年度关键指标
  - 供前端 insight 区域和顶部统计卡片动态渲染使用

---

### 前端视图修复与交互完善

核心职责：修复已知 bug，补全未实现的交互功能。

- [x] **修复气泡图显示问题**
  - 将所有 `Math.max(4001, d.ccu)` 改为 `Math.max(11, d.ccu)`（共 4 处）
  - Y 轴 `domain` 下限对应调整为 `[10, 4800000]`
  - 气泡半径比例尺根据数据量动态缩放（数据 > 200 条时 maxR 降至 16）
  - X 轴 `domain` 根据实际好评率范围自适应，不再硬编码 55
  - 加入游戏名称显示

- [ ] **实现视图一 CCU 份额切换**
  - 读取数据端产出的 CCU 份额数据
  - 点击"在线人数"按钮时切换 Stream Graph 数据源
  - 当前该按钮点击无实际效果

- [ ] **实现气泡图搜索功能**
  - UI 上已预留搜索框位置（右上角）
  - 输入游戏名时过滤匹配的气泡并高亮显示
  - 支持模糊匹配，匹配结果自动聚焦

- [ ] **优化视图三衰减曲线的显示**
  - 在底部的图例虽然有名字，但视线需要来回跳，可视化效果差，需要改进，如在每条曲线附近加上名字悬停
  - 加入按类型（AAA/Indie等）分组的视觉层次
  - 加入关键时间节点的标注

- [ ] **接入详情面板游戏封面图**
  - 数据中已有 `header_image` 字段
  - 点击气泡后在右侧详情面板顶部展示封面
  - 添加加载失败时的占位图处理

- [ ] **优化移动端适配**
  - 散点图在窄屏下详情面板叠在底部体验差，改为弹出浮层或抽屉
  - 衰减曲线图例在小屏上换行过多，考虑折叠/滚动
  - 测试 ≤ 768px 宽度下三个视图的可用性

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

- [ ] **顶部统计卡片数据联动**
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

---

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
