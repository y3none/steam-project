//  VIEW 4: METHODOLOGY — Updated to reflect actual implementation
// ════════════════════════════════════════════════
window.initMethod = function() {
  const wrap = document.getElementById('method-inner');
  if (!wrap) return;

  var totalLabel = (DATA.meta && DATA.meta.total_games) ?
      fmt.num(DATA.meta.total_games) + '+' :
      '120,000+';

  wrap.innerHTML = `
    <div class="method-grid">
      <div class="method-cell">
        <div class="method-cell-title">四源数据融合</div>
        <div class="method-cell-body">
          <strong>① Kaggle Steam Dataset</strong> — 主数据源，${
      totalLabel} 游戏，含发布日期、评价、owners、标签<br>
          <strong>② SteamSpy API</strong> — 补充标签权重、近期游戏时长，Top100 实时爬取 + 全量分页采集<br>
          <strong>③ Steam Store API</strong> — 校验分类标签、开发商/发行商、Metacritic 评分<br>
          <strong>④ SteamCharts.com</strong> — 2012年至今逐月 Avg. Players，用于视图一在线占比和视图三衰减曲线<br>
          <span style="color:var(--aa)">+</span> <strong>Steam 官方 API</strong>（<code>GetNumberOfCurrentPlayers</code>）— 实时 CCU 查询，每次刷新获取此刻在线数据
        </div>
      </div>
      <div class="method-cell">
        <div class="method-cell-title">游戏分类规则（业界共识）</div>
        <div class="method-cell-body">
          <strong>F2P</strong>：<code>price=0</code> 且 tags/genres 含 "Free to Play"（避免限免独立游戏误判）<br>
          <strong>AAA</strong>：发行商 ∈ 已知大厂名单（30 家，含 Valve/Blizzard/Rockstar 等）且 owners ≥ 0.5M<br>
          <strong>Indie</strong>：Indie 标签投票 > 0 或 genre 含 "Indie"，且无 AAA 发行商信号<br>
          <strong>AA</strong>：无 Indie 信号 + owners ≥ 0.5M 或 price ≥ $9.99 的中间地带<br>
          <strong>手动覆盖</strong>：60+ 款已知游戏按业界共识手动标注（如 Black Myth: Wukong → AAA, $140M 预算）<br>
          <span style="color:var(--aa)">⚠</span> 价格使用当前售价（非首发价），降价 3A 大作通过发行商名单+手动覆盖修正
        </div>
      </div>
      <div class="method-cell">
        <div class="method-cell-title">数据清洗与处理</div>
        <div class="method-cell-body">
          <strong>Owners</strong>：Kaggle 返回区间（"0 - 20000"），取中值并转换为百万单位<br>
          <strong>年份</strong>：解析多种日期格式（"Feb 26, 2016" / "2016-02-26"），保留 2004–2025<br>
          <strong>评价过滤</strong>：视图二要求评价数 ≥ 10 条，好评率 = positive/(positive+negative)×100<br>
          <strong>本地数据库</strong>：<code>game_db.json</code> 累积所有来源数据，appid 为主键，只增不减<br>
          <strong>处理结果</strong>：持久化至 <code>data/processed/</code>（4 个 JSON），前后端均可读取
        </div>
      </div>
      <div class="method-cell">
        <div class="method-cell-title">可视化编码与交互</div>
        <div class="method-cell-body">
          <strong>视图一</strong>：Stream Graph（<code>stackOffsetWiggle</code>），可切换发布占比/在线占比（月均在线数据）<br>
          <strong>视图二</strong>：气泡散点，X → 好评率，Y → 峰值在线 CCU（对数轴），半径 → owners（<code>scalePow(0.35)</code>）<br>
          <strong>视图三</strong>：衰减折线，归一化 CCU（首月=100%），24个月跨度，关键时间节点标注<br>
          <strong>视图五 · 结论</strong>：三因一果汇聚（数量 × 顶尖口碑 × 长尾留存 → 收入），数字由 <code>DATA</code> 实时计算<br>
          <strong>跨视图联动</strong>：河流图点击年份 ↔ 散点图年份下拉（双向同步），散点图 → 衰减曲线下钻；联动触发时接收方视图<em>脉冲高亮 + 来源 chip</em><br>
          <strong>自动导览</strong>：一键按叙事顺序播放五段，复用各视图 narrative 接口，供演示/答辩；尊重系统“减少动态效果”偏好<br>
          <strong>实时数据</strong>：页面秒开 → 后台异步爬取 Steam API → 图表热更新 + CCU 涨跌 Ticker
        </div>
      </div>
      <div class="method-cell" style="grid-column:1 / -1">
        <div class="method-cell-title">关键指标口径（验收重点 · 数据驱动而非写死结论）</div>
        <div class="method-cell-body">
          <strong>CCU 语义</strong>：散点/衰减中的 <code>ccu</code> 为<strong>近期峰值在线</strong>（SteamSpy，约昨日峰值），并非历史最高在线——它随时间波动、量纲远低于历史峰值，这是下方阈值设计的前提。<br>
          <strong>“神作象限”（数据驱动阈值）</strong>：定义为 好评率 ≥ 90% <strong>且</strong> 峰值在线 ≥【全体“叫好”(好评≥90%)游戏 CCU 的中位数】。不采用固定绝对阈值（如 10 万），因为 CCU 与好评率在真实数据中<em>负相关</em>——高在线区被 CS2/Dota2 等高人气、好评<90% 的常驻游戏占据，固定阈值会使象限恒为空。以“叫好游戏自身人气中位”为线，可自适应量纲、不受 megahit 极值干扰，并直接回答“叫好的游戏里谁更出圈”。象限标签实时显示当前阈值。<br>
          <strong>质量结论口径</strong>：以<strong>前 5 名好评率均值</strong>衡量各类型“天花板”，以<strong>中位好评率</strong>衡量整体。结论为<em>天花板追平</em>（顶尖独立 ≈ 3A）、<em>中位仍低</em>（独立中位被海量长尾拉低）。文案随数据方向自适应，不写死“持平/追平”。<br>
          <strong>留存口径</strong>：各曲线以首月在线 = 100% 归一化，跨度 24 个月，消除绝对体量差异、只比较留存“形状”。
        </div>
      </div>
    </div>
    <div class="method-note">
      <strong>数据局限性声明：</strong>
      SteamSpy 数据自 2018 年后误差约 ±20%（Valve 隐藏了精确 owners 数据）；
      Kaggle price 为当前售价而非首发价，影响基于价格的分类准确度；
      CCU 在线占比数据仅覆盖 2012 年至今（SteamCharts 起始年份），2012 年前无公开 CCU 历史数据；
      分类规则对边缘游戏（如大厂发行的小型实验项目）可能存在争议；
      独立游戏整体中位好评率低于 3A，是数万款长尾游戏拉低中位的真实<em>长尾效应</em>（亦即“发现性危机”的量化体现），并非分类偏差——本作品对此如实呈现而不回避。
    </div>
    <div class="method-pipeline" id="method-pipeline"></div>
  `;

  drawPipeline();
};

function drawPipeline() {
  const wrap = document.getElementById('method-pipeline');
  if (!wrap) return;
  const W = wrap.clientWidth || 700;
  const H = 100;

  var gameCount = (DATA.meta && DATA.meta.total_games) ?
      Math.round(DATA.meta.total_games / 1000) + 'k+ games' :
      '120k+ games';

  const steps = [
    {label: 'Kaggle\nDataset', sub: gameCount, color: '#1de9b6'},
    {label: 'SteamSpy\nAPI', sub: '实时 Top100', color: '#69f0ae'},
    {label: 'SteamCharts', sub: '月均在线 CCU', color: '#26c6da'},
    {label: 'Steam API', sub: '实时 CCU', color: '#4fc3f7'},
    {label: '清洗 · 分类\n融合', sub: '05_preprocess', color: '#ffd54f'},
    {label: 'JSON\n输出', sub: '4 files', color: '#ffab40'},
    {label: 'D3.js v7\n可视化', sub: '5 视图 + 联动', color: '#ff5252'},
  ];

  const svg = d3.select(wrap)
                  .append('svg')
                  .attr('viewBox', `0 0 ${W} ${H}`)
                  .attr('height', H);

  // Arrow marker (larger)
  svg.append('defs')
      .append('marker')
      .attr('id', 'arrow-m')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 5)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', '#3a3a58');

  const stepW = W / steps.length;
  const boxW = 120, boxH = 70, boxY = 20;

  steps.forEach((s, i) => {
    const cx = stepW * i + stepW / 2;

    // Arrow between steps — endpoints computed from box edges
    if (i > 0) {
      const prevCx = stepW * (i - 1) + stepW / 2;
      const pad = 2;
      const arrowX1 = prevCx + boxW / 2 + pad;
      const arrowX2 = cx - boxW / 2 - pad;
      svg.append('line')
          .attr('x1', arrowX1)
          .attr('x2', arrowX2)
          .attr('y1', boxY + boxH / 2)
          .attr('y2', boxY + boxH / 2)
          .attr('stroke', '#3a3a58')
          .attr('stroke-width', 3)
          .attr('marker-end', 'url(#arrow-m)');
    }

    // Box with colored fill & border
    svg.append('rect')
        .attr('x', cx - boxW / 2)
        .attr('y', boxY)
        .attr('width', boxW)
        .attr('height', boxH)
        .attr('rx', 6)
        .attr('fill', s.color)
        .attr('fill-opacity', 0.1)
        .attr('stroke', s.color)
        .attr('stroke-width', 1.8);

    // Label (centered, larger font)
    const lines = s.label.split('\n');
    const labelStartY = boxY + boxH / 2 - (lines.length - 1) * 8;
    lines.forEach((line, li) => {
      svg.append('text')
          .attr('x', cx)
          .attr('y', labelStartY + li * 16)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', '#e8e8f0')
          .attr('font-family', '\'Space Mono\',monospace')
          .attr('font-size', 13)
          .attr('font-weight', '600')
          .text(line);
    });

    // Sub label
    svg.append('text')
        .attr('x', cx)
        .attr('y', boxY + boxH + 16)
        .attr('text-anchor', 'middle')
        .attr('fill', s.color)
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 11)
        .attr('font-weight', '500')
        .text(s.sub);
  });
}

// ════════════════════════════════════════════════