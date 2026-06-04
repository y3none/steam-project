//  VIEW 4: METHODOLOGY — Updated to reflect actual implementation
// ════════════════════════════════════════════════
window.initMethod = function() {
  const wrap = document.getElementById("method-inner");
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="method-grid">
      <div class="method-cell">
        <div class="method-cell-title">四源数据融合</div>
        <div class="method-cell-body">
          <strong>① Kaggle Steam Dataset</strong> — 主数据源，120,000+ 游戏，含发布日期、评价、owners、标签<br>
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
          <strong>视图二</strong>：气泡散点，X → 好评率，Y → CCU（对数轴），半径 → owners（<code>scalePow(0.35)</code>）<br>
          <strong>视图三</strong>：衰减折线，归一化 CCU（首月=100%），24个月跨度，关键时间节点标注<br>
          <strong>跨视图联动</strong>：河流图点击年份 ↔ 散点图年份下拉（双向同步），散点图 → 衰减曲线下钻<br>
          <strong>实时数据</strong>：页面秒开 → 后台异步爬取 Steam API → 图表热更新 + CCU 涨跌 Ticker
        </div>
      </div>
    </div>
    <div class="method-note">
      <strong>数据局限性声明：</strong>
      SteamSpy 数据自 2018 年后误差约 ±20%（Valve 隐藏了精确 owners 数据）；
      Kaggle price 为当前售价而非首发价，影响基于价格的分类准确度；
      CCU 在线占比数据仅覆盖 2012 年至今（SteamCharts 起始年份），2012 年前无公开 CCU 历史数据；
      分类规则对边缘游戏（如大厂发行的小型实验项目）可能存在争议。
    </div>
    <div class="method-pipeline" id="method-pipeline"></div>
  `;

  drawPipeline();
};

function drawPipeline() {
  const wrap = document.getElementById("method-pipeline");
  if (!wrap) return;
  const W = wrap.clientWidth || 700;
  const H = 90;

  const steps = [
    { label: "Kaggle\nDataset",     sub: "120k+ games",  color: "#1de9b6" },
    { label: "SteamSpy\nAPI",       sub: "实时 Top100",   color: "#1de9b6" },
    { label: "SteamCharts",         sub: "月均在线 CCU",   color: "#1de9b6" },
    { label: "Steam API",           sub: "实时 CCU",       color: "#69f0ae" },
    { label: "清洗 · 分类\n融合",    sub: "05_preprocess",  color: "#ffd54f" },
    { label: "JSON\n输出",           sub: "4 files",        color: "#ffd54f" },
    { label: "D3.js v7\n可视化",     sub: "3 views + 联动", color: "#ff5252" },
  ];

  const svg = d3.select(wrap).append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("height", H);

  // Arrow marker
  svg.append("defs").append("marker")
    .attr("id", "arrow-m").attr("viewBox", "0 0 10 10")
    .attr("refX", 9).attr("refY", 5)
    .attr("markerWidth", 6).attr("markerHeight", 6)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#2a2a48");

  const stepW = W / steps.length;

  steps.forEach((s, i) => {
    const cx = stepW * i + stepW / 2;

    // Arrow between steps
    if (i > 0) {
      const prevCx = stepW * (i-1) + stepW / 2;
      svg.append("line")
        .attr("x1", prevCx + 36).attr("x2", cx - 36)
        .attr("y1", 36).attr("y2", 36)
        .attr("stroke", "#2a2a48").attr("stroke-width", 1)
        .attr("marker-end", "url(#arrow-m)");
    }

    // Box
    svg.append("rect")
      .attr("x", cx - 38).attr("y", 14)
      .attr("width", 76).attr("height", 44)
      .attr("rx", 4)
      .attr("fill", "rgba(255,255,255,0.03)")
      .attr("stroke", s.color).attr("stroke-width", 0.5)
      .attr("opacity", 0.6);

    // Label
    const lines = s.label.split("\n");
    lines.forEach((line, li) => {
      svg.append("text")
        .attr("x", cx).attr("y", 32 + li * 12)
        .attr("text-anchor", "middle")
        .attr("fill", "#d8d8f0")
        .attr("font-family", "'Space Mono',monospace")
        .attr("font-size", 9)
        .text(line);
    });

    // Sub label
    svg.append("text")
      .attr("x", cx).attr("y", 74)
      .attr("text-anchor", "middle")
      .attr("fill", "#6060a0")
      .attr("font-family", "'Space Mono',monospace")
      .attr("font-size", 8)
      .text(s.sub);
  });
}

// ════════════════════════════════════════════════