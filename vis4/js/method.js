//  VIEW 4: METHODOLOGY
// ════════════════════════════════════════════════
window.initMethod = function() {
  const wrap = document.getElementById("method-inner");
  if (!wrap) return;

  // Build methodology content
  wrap.innerHTML = `
    <div class="method-grid">
      <div class="method-cell">
        <div class="method-cell-title">数据采集</div>
        <div class="method-cell-body">
          <strong>SteamSpy API</strong> — 全量游戏基础数据（owners、CCU、tags、genre），
          约 50,000 条记录，分页采集（1页/60秒限速）支持断点续传。<br>
          <strong>Steam Store API</strong> — 补充发布日期、开发商、发行商、价格、Metacritic 评分。<br>
          <strong>采集策略</strong>：Top100 快速跑通（~10秒） → 全量渐进补全（1-2小时）
        </div>
      </div>
      <div class="method-cell">
        <div class="method-cell-title">游戏分类规则</div>
        <div class="method-cell-body">
          <strong>F2P</strong>：<code>is_free=true</code> 或 <code>price=0</code><br>
          <strong>AAA</strong>：发行商 ∈ 已知AAA名单（20家） ∧ 价格≥$29.99 ∧ 拥有量≥1M<br>
          <strong>Indie</strong>：Indie标签投票>100 或 genre含"Indie"，且拥有量<5M 或 价格≤$39.99<br>
          <strong>AA</strong>：价格≥$19.99 ∧ 拥有量≥0.5M 的中间地带<br>
          <span style="color:var(--aa)">⚠</span> 默认兜底归为 Indie，可能导致占比偏高
        </div>
      </div>
      <div class="method-cell">
        <div class="method-cell-title">数据清洗</div>
        <div class="method-cell-body">
          <strong>Owners</strong>：SteamSpy 返回区间（如"200k..500k"），取中值<br>
          <strong>年份过滤</strong>：仅保留 2004–2024 发布的游戏<br>
          <strong>评价过滤</strong>：视图二要求评价数 ≥ 10 条<br>
          <strong>类型过滤</strong>：排除 DLC、原声带、工具类<br>
          <strong>好评率</strong>：<code>positive / (positive + negative) × 100</code>
        </div>
      </div>
      <div class="method-cell">
        <div class="method-cell-title">可视化编码</div>
        <div class="method-cell-body">
          <strong>视图一</strong>：Stream Graph（<code>stackOffsetWiggle</code>），面积 → 发布占比/CCU份额<br>
          <strong>视图二</strong>：散点图，X → 好评率，Y → 峰值CCU（对数轴），半径 → 拥有量（平方根缩放）<br>
          <strong>视图三</strong>：折线图，归一化 CCU（首月=100%），24个月跨度<br>
          <strong>交互</strong>：跨视图年份联动、搜索定位、图例高亮、过渡动画
        </div>
      </div>
    </div>
    <div class="method-pipeline" id="method-pipeline"></div>
  `;

  // Draw pipeline SVG
  drawPipeline();
};

function drawPipeline() {
  const wrap = document.getElementById("method-pipeline");
  if (!wrap) return;
  const W = wrap.clientWidth || 700;
  const H = 80;

  const steps = [
    { label: "SteamSpy\nAPI", sub: "50k games", color: "#1de9b6" },
    { label: "Steam Store\nAPI", sub: "发布日期", color: "#1de9b6" },
    { label: "数据清洗\n分类", sub: "pandas", color: "#ffd54f" },
    { label: "JSON\n输出", sub: "4 files", color: "#ffd54f" },
    { label: "D3.js v7\n可视化", sub: "3 views", color: "#ff5252" },
  ];

  const svg = d3.select(wrap).append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("height", H);

  const stepW = W / steps.length;

  steps.forEach((s, i) => {
    const cx = stepW * i + stepW / 2;

    // Arrow between steps
    if (i > 0) {
      const prevCx = stepW * (i-1) + stepW / 2;
      svg.append("line")
        .attr("x1", prevCx + 36).attr("x2", cx - 36)
        .attr("y1", 32).attr("y2", 32)
        .attr("stroke", "#2a2a48").attr("stroke-width", 1)
        .attr("marker-end", "url(#arrow)");
    }

    // Box
    svg.append("rect")
      .attr("x", cx - 34).attr("y", 12)
      .attr("width", 68).attr("height", 40)
      .attr("rx", 3)
      .attr("fill", "rgba(255,255,255,0.03)")
      .attr("stroke", s.color).attr("stroke-width", 0.5)
      .attr("opacity", 0.6);

    // Label
    const lines = s.label.split("\n");
    lines.forEach((line, li) => {
      svg.append("text")
        .attr("x", cx).attr("y", 28 + li * 12)
        .attr("text-anchor", "middle")
        .attr("fill", "#d8d8f0")
        .attr("font-family", "'Space Mono',monospace")
        .attr("font-size", 9)
        .text(line);
    });

    // Sub label
    svg.append("text")
      .attr("x", cx).attr("y", 66)
      .attr("text-anchor", "middle")
      .attr("fill", "#6060a0")
      .attr("font-family", "'Space Mono',monospace")
      .attr("font-size", 8)
      .text(s.sub);
  });

  // Arrow marker
  svg.append("defs").append("marker")
    .attr("id", "arrow").attr("viewBox", "0 0 10 10")
    .attr("refX", 9).attr("refY", 5)
    .attr("markerWidth", 6).attr("markerHeight", 6)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#2a2a48");
}

// ════════════════════════════════════════════════
