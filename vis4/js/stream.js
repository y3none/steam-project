//  VIEW 1: STREAM GRAPH
// ════════════════════════════════════════════════
window.initStream = function() {
  const KEYS = ["f2p","aaa","aa","indie"];
  const KC = { indie:C.Indie, aa:C.AA, aaa:C.AAA, f2p:C.F2P };
  const KL = { indie:"INDIE", aa:"AA", aaa:"AAA", f2p:"F2P" };
  const EVENTS = [{yr:2012,label:"GREENLIGHT"},{yr:2017,label:"DIRECT"},{yr:2020,label:"COVID"}];
  const MG = {t:24,r:24,b:38,l:48};

  let svg,g,xSc,ySc;
  let mode = "count"; // "count" or "ccu"
  let selectedYear = null;
  let isModeCountEntranceDone = false;
  let isModeCCUEntranceDone = false;

  function draw() {
    const wrap = document.getElementById("stream-inner");
    wrap.innerHTML = "";
    const W = wrap.clientWidth, H = Math.max(240, Math.min(320, W*0.38));
    const iW=W-MG.l-MG.r, iH=H-MG.t-MG.b;

    svg = d3.select(wrap).append("svg").attr("viewBox",`0 0 ${W} ${H}`).attr("height",H);
    g   = svg.append("g").attr("transform",`translate(${MG.l},${MG.t})`);

    // CCU mode: X axis starts at 2012 (no public CCU data before that)
    const xMin = mode === "ccu" ? 2012 : 2004;
    xSc = d3.scaleLinear().domain([xMin, 2024]).range([0, iW]);

    // Build data for current mode, filter by xMin
    let stackData;
    if (mode === "ccu") {
      stackData = DATA.market
        .filter(d => d.year >= 2012)
        .map(d => ({
          year: d.year,
          indie: d.ci ?? 0,
          aa:    d.ca ?? 0,
          aaa:   d.cb ?? 0,
          f2p:   d.cf ?? 0,
          _orig: d,
        }));
    } else {
      stackData = DATA.market.map(d => ({
        year: d.year,
        indie: d.indie,
        aa:    d.aa,
        aaa:   d.aaa,
        f2p:   d.f2p,
        _orig: d,
      }));
    }

    const stack = d3.stack().keys(KEYS)
      .offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut);
    const series = stack(stackData);

    ySc = d3.scaleLinear()
      .domain([d3.min(series,s=>d3.min(s,d=>d[0])), d3.max(series,s=>d3.max(s,d=>d[1]))])
      .range([iH,0]);

    const area = d3.area()
      .x((_,i)=>xSc(stackData[i].year))
      .y0(d=>ySc(d[0])).y1(d=>ySc(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5));

    // Glow filter + gradients
    const defs = svg.append("defs");
    const flt = defs.append("filter").attr("id","glow-s");
    flt.append("feGaussianBlur").attr("stdDeviation","3").attr("result","blur");
    const fMrg = flt.append("feMerge");
    fMrg.append("feMergeNode").attr("in","blur");
    fMrg.append("feMergeNode").attr("in","SourceGraphic");

    KEYS.forEach(k => {
      const grad = defs.append("linearGradient").attr("id","sg-"+k).attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
      grad.append("stop").attr("offset","0%").attr("stop-color",KC[k]).attr("stop-opacity",0.9);
      grad.append("stop").attr("offset","100%").attr("stop-color",KC[k]).attr("stop-opacity",0.6);
    });

    // ClipPath for grow animation
    const clip = defs.append("clipPath").attr("id","stream-reveal");
    const clipRect = clip.append("rect")
      .attr("x", 0).attr("y", 0).attr("width", 0).attr("height", H);

    // Paths
    g.selectAll(".sp").data(series).join("path")
      .attr("class","sp")
      .attr("fill", s=>"url(#sg-"+s.key+")")
      .attr("fill-opacity",0.82)
      .attr("d", area)
      .attr("stroke", s=>KC[s.key])
      .attr("stroke-width", 0.3)
      .attr("stroke-opacity", 0.2)
      .attr("clip-path","url(#stream-reveal)")
      .on("mousemove", function(ev,s){
        const yr = Math.round(xSc.invert(d3.pointer(ev)[0]));
        const idx = stackData.findIndex(r=>r.year===yr);
        if(idx<0) return;
        const d = stackData[idx]._orig;
        const val = stackData[idx][s.key];
        g.selectAll(".sp").attr("fill-opacity", p=>p.key===s.key?1:0.18);

        const modeLabel = mode==="ccu" ? "在线占比" : "发布占比";

        let tipContent = `<strong>${yr} · ${KL[s.key]}</strong>
          <div class="tip-row"><span class="tip-k">${modeLabel}</span><span class="tip-v" style="color:${KC[s.key]}">${val}%</span></div>`;

        if (mode === "ccu") {
          // CCU mode: show absolute CCU if available
          const absKey = {"indie":"ci_abs","aa":"ca_abs","aaa":"cb_abs","f2p":"cf_abs"}[s.key];
          const absVal = d[absKey];
          if (absVal) {
            tipContent += `<div class="tip-row"><span class="tip-k">月均在线</span><span class="tip-v">~${fmt.num(Math.round(absVal))}k</span></div>`;
          }
          tipContent += `<div style="margin-top:3px;font-size:8px;color:#6060a0">基于 SteamCharts 月均在线数据计算</div>`;
        } else {
          tipContent += `<div class="tip-row"><span class="tip-k">本年总发布</span><span class="tip-v">${fmt.num(d.n)} 款</span></div>
          <div class="tip-row"><span class="tip-k">${KL[s.key]}发布量</span><span class="tip-v">${fmt.num(d["n"+s.key[0]])} 款</span></div>`;
        }

        tipContent += `${d.ev?`<div class="tip-event">◆ ${d.ev}</div>`:""}
          <div style="margin-top:4px;font-size:9px;color:#6060a0">点击选中该年份，联动散点图 ↓</div>`;

        TIP.show(tipContent, ev);
      })
      .on("mouseleave",()=>{ g.selectAll(".sp").attr("fill-opacity",0.82); TIP.hide(); })
      .on("click", function(ev){
        const yr = Math.round(xSc.invert(d3.pointer(ev)[0]));
        if(yr < xMin || yr > 2024) return;
        selectYear(yr === selectedYear ? null : yr);
      });

    // X axis
    g.append("g").attr("class","axis").attr("transform",`translate(0,${iH})`)
      .call(d3.axisBottom(xSc).tickFormat(d3.format("d")).ticks(mode==="ccu"?6:10).tickSize(3));

    // Event lines (only show events within current x range)
    EVENTS.forEach(ev=>{
      if (ev.yr < xMin) return;
      const x=xSc(ev.yr);
      g.append("line").attr("class","ev-line").attr("x1",x).attr("x2",x).attr("y1",0).attr("y2",iH);
      g.append("circle").attr("class","ev-marker")
        .attr("cx", x).attr("cy", 0).attr("r", 4);
      g.append("text").attr("class","ev-label").attr("x",x).attr("y",-8).attr("text-anchor","middle").text(ev.yr+" · "+ev.label);
    });

    // CCU mode: prominent annotation for missing pre-2012 data
    if (mode === "ccu") {
      // Dimmed area on the left to visually indicate "no data zone"
      const noDataW = 36;
      g.append("rect")
        .attr("x", -noDataW - 4).attr("y", 0)
        .attr("width", noDataW).attr("height", iH)
        .attr("fill", "rgba(255,255,255,0.03)")
        .attr("stroke", "rgba(255,255,255,0.08)")
        .attr("stroke-dasharray", "3,3");
      g.append("text")
        .attr("x", -noDataW/2 - 4).attr("y", iH / 2)
        .attr("fill", "rgba(255,255,255,0.35)")
        .attr("font-family", "'Space Mono',monospace")
        .attr("font-size", 10)
        .attr("font-weight", "bold")
        .attr("writing-mode", "vertical-rl")
        .attr("text-anchor", "middle")
        .text("◀ 2012前无公开数据");
      // Horizontal annotation at top
      g.append("text")
        .attr("x", 4).attr("y", iH - 6)
        .attr("fill", "rgba(255,255,255,0.2)")
        .attr("font-family", "'Space Mono',monospace")
        .attr("font-size", 8)
        .text("数据来源: SteamCharts.com 月均在线（2012.7起）");
    }

    // Selected year highlight
    if (selectedYear) {
      const x = xSc(selectedYear);
      g.append("rect").attr("class","yr-highlight")
        .attr("x", x-8).attr("y", 0).attr("width", 16).attr("height", iH)
        .on("click", () => selectYear(null));
    }

    // Area labels
    const labelYear = mode === "ccu" ? 2018 : 2013;
    series.forEach(s=>{
      const mid=Math.floor(s.length*0.55);
      const cy=(ySc(s[mid][0])+ySc(s[mid][1]))/2;
      const bw=Math.abs(ySc(s[mid][1])-ySc(s[mid][0]));
      if(bw<12) return;
      g.append("text")
        .attr("x",xSc(labelYear)).attr("y",cy+4)
        .attr("text-anchor","middle")
        .attr("fill","rgba(0,0,0,0.65)")
        .attr("font-family","'Space Mono',monospace")
        .attr("font-size",Math.min(13,bw*0.38))
        .attr("font-weight","700")
        .attr("pointer-events","none")
        .text(KL[s.key]);
    });

    // Mode label
    g.append("text").attr("x",iW).attr("y",-6).attr("text-anchor","end")
      .attr("fill","rgba(255,255,255,0.15)").attr("font-family","'Space Mono',monospace").attr("font-size",9)
      .text(mode==="ccu" ? "MODE: AVG. ONLINE SHARE" : "MODE: RELEASE COUNT");

    // Grow animation: reveal from left to right
    if ((!isModeCountEntranceDone && mode == "count") || (!isModeCCUEntranceDone && mode == "ccu")) {
      clipRect.transition()
          .duration(1800)
          .ease(d3.easeCubicInOut)
          .attr("width", W);
        if (mode == "count") isModeCountEntranceDone = true;
        if (mode == "ccu") isModeCCUEntranceDone = true;
    } else {
      clipRect.attr("width", W);
    }
  }

  let _selfEmit = false;

  function selectYear(yr) {
    selectedYear = yr;
    const indicator = document.getElementById("year-indicator");
    const yiYear = document.getElementById("yi-year");

    if (yr) {
      indicator.style.display = "flex";
      yiYear.textContent = yr;
    } else {
      indicator.style.display = "none";
    }
    // Draw stream FIRST, then notify scatter
    draw();
    _selfEmit = true;
    EVT.emit("yearSelect", yr);
    _selfEmit = false;
  }

  // Clear button
  document.getElementById("yi-clear").addEventListener("click", () => selectYear(null));

  // Listen for year changes from scatter (dropdown) — skip self-emitted events
  EVT.on("yearSelect", yr => {
    if (_selfEmit) return;
    if (yr !== selectedYear) {
      selectedYear = yr;
      draw();
    }
  });

  // Controls: mode toggle
  document.querySelectorAll("[data-sm]").forEach(b=>{
    b.addEventListener("click",function(){
      document.querySelectorAll("[data-sm]").forEach(x=>x.classList.remove("active"));
      this.classList.add("active");
      mode = this.dataset.sm;
      // 如果需要每次切换模式时都播放入场动画，则取消注释以下两行
      // if (mode == "count") isModeCountEntranceDone = false;
      // if (mode == "ccu") isModeCCUEntranceDone = false;
      draw();
    });
  });

  draw();
  window._streamRedraw = draw;
};
// ════════════════════════════════════════════════