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

  function draw() {
    const wrap = document.getElementById("stream-inner");
    wrap.innerHTML = "";
    const W = wrap.clientWidth, H = Math.max(240, Math.min(320, W*0.38));
    const iW=W-MG.l-MG.r, iH=H-MG.t-MG.b;

    svg = d3.select(wrap).append("svg").attr("viewBox",`0 0 ${W} ${H}`).attr("height",H);
    g   = svg.append("g").attr("transform",`translate(${MG.l},${MG.t})`);

    xSc = d3.scaleLinear().domain([2004,2024]).range([0,iW]);

    // Build data for current mode
    let stackData;
    if (mode === "ccu") {
      // Use CCU share columns (ci, ca, cb, cf)
      stackData = DATA.market.map(d => ({
        year: d.year,
        indie: d.ci ?? d.indie,
        aa:    d.ca ?? d.aa,
        aaa:   d.cb ?? d.aaa,
        f2p:   d.cf ?? d.f2p,
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

    // Glow filter
    const defs = svg.append("defs");
    const flt = defs.append("filter").attr("id","glow-s");
    flt.append("feGaussianBlur").attr("stdDeviation","3").attr("result","blur");
    const fMrg = flt.append("feMerge");
    fMrg.append("feMergeNode").attr("in","blur");
    fMrg.append("feMergeNode").attr("in","SourceGraphic");

    // Paths
    g.selectAll(".sp").data(series).join("path")
      .attr("class","sp")
      .attr("fill", s=>KC[s.key])
      .attr("fill-opacity",0.78)
      .attr("d", area)
      .on("mousemove", function(ev,s){
        const yr = Math.round(xSc.invert(d3.pointer(ev)[0]));
        const idx = stackData.findIndex(r=>r.year===yr);
        if(idx<0) return;
        const d = stackData[idx]._orig;
        const val = stackData[idx][s.key];
        g.selectAll(".sp").attr("fill-opacity", p=>p.key===s.key?1:0.18);

        const modeLabel = mode==="ccu" ? "CCU份额" : "发布占比";
        const countLabel = mode==="ccu" ? "CCU份额" : KL[s.key]+"发布量";
        const countVal = mode==="ccu" ? fmt.pct(val) : fmt.num(d["n"+s.key[0]]) + " 款";

        TIP.show(`<strong>${yr} · ${KL[s.key]}</strong>
          <div class="tip-row"><span class="tip-k">${modeLabel}</span><span class="tip-v" style="color:${KC[s.key]}">${val}%</span></div>
          <div class="tip-row"><span class="tip-k">本年总发布</span><span class="tip-v">${fmt.num(d.n)} 款</span></div>
          <div class="tip-row"><span class="tip-k">${countLabel}</span><span class="tip-v">${countVal}</span></div>
          ${d.ev?`<div class="tip-event">◆ ${d.ev}</div>`:""}
          <div style="margin-top:4px;font-size:9px;color:#6060a0">点击选中该年份，联动散点图 ↓</div>
        `, ev);
      })
      .on("mouseleave",()=>{ g.selectAll(".sp").attr("fill-opacity",0.78); TIP.hide(); })
      .on("click", function(ev){
        const yr = Math.round(xSc.invert(d3.pointer(ev)[0]));
        if(yr < 2004 || yr > 2024) return;
        selectYear(yr === selectedYear ? null : yr);
      });

    // X axis
    g.append("g").attr("class","axis").attr("transform",`translate(0,${iH})`)
      .call(d3.axisBottom(xSc).tickFormat(d3.format("d")).ticks(10).tickSize(3));

    // Event lines
    EVENTS.forEach(ev=>{
      const x=xSc(ev.yr);
      g.append("line").attr("class","ev-line").attr("x1",x).attr("x2",x).attr("y1",0).attr("y2",iH);
      g.append("text").attr("class","ev-label").attr("x",x).attr("y",-6).attr("text-anchor","middle").text(ev.yr+" · "+ev.label);
    });

    // Selected year highlight
    if (selectedYear) {
      const x = xSc(selectedYear);
      g.append("rect").attr("class","yr-highlight")
        .attr("x", x-8).attr("y", 0).attr("width", 16).attr("height", iH)
        .on("click", () => selectYear(null));
    }

    // Area labels
    series.forEach(s=>{
      const mid=Math.floor(s.length*0.55);
      const cy=(ySc(s[mid][0])+ySc(s[mid][1]))/2;
      const bw=Math.abs(ySc(s[mid][1])-ySc(s[mid][0]));
      if(bw<12) return;
      g.append("text")
        .attr("x",xSc(2013)).attr("y",cy+4)
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
      .text(mode==="ccu" ? "MODE: CCU SHARE" : "MODE: RELEASE COUNT");
  }

  function selectYear(yr) {
    selectedYear = yr;
    const indicator = document.getElementById("year-indicator");
    const yiYear = document.getElementById("yi-year");

    if (yr) {
      indicator.style.display = "flex";
      yiYear.textContent = yr;
      EVT.emit("yearSelect", yr);
    } else {
      indicator.style.display = "none";
      EVT.emit("yearSelect", null);
    }
    draw();
  }

  // Clear button
  document.getElementById("yi-clear").addEventListener("click", () => selectYear(null));

  // Controls: mode toggle
  document.querySelectorAll("[data-sm]").forEach(b=>{
    b.addEventListener("click",function(){
      document.querySelectorAll("[data-sm]").forEach(x=>x.classList.remove("active"));
      this.classList.add("active");
      mode = this.dataset.sm;
      draw();
    });
  });

  draw();
  window._streamRedraw = draw;
};
// ════════════════════════════════════════════════
