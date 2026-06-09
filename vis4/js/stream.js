//  VIEW 1: STREAM GRAPH
// ════════════════════════════════════════════════
window.initStream = function() {
  // ── 两条正交分类维度（与散点图一致）：制作规模 tier ⊥ 商业模式 monetization ──
  //   tier: Indie/AA/AAA（F2P 已按真实规模并入对应档）
  //   mon : Premium 买断 / F2P 免费 / Hybrid 混合
  const DIM = {
    tier: {
      keys:  ["aaa", "aa", "indie"],
      color: { indie: C.Indie, aa: C.AA, aaa: C.AAA },
      label: { indie: "INDIE", aa: "AA", aaa: "AAA" },
    },
    mon: {
      keys:  ["hybrid", "premium", "f2p"],
      color: { premium: MONC.Premium, f2p: MONC.F2P, hybrid: MONC.Hybrid },
      label: { premium: "买断制", f2p: "免费F2P", hybrid: "混合模式" },
    },
  };
  const EVENTS = [{yr:2012,label:"GREENLIGHT"},{yr:2017,label:"DIRECT"},{yr:2020,label:"COVID"}];
  const MG = {t:24,r:24,b:38,l:48};

  let svg,g,xSc,ySc;
  let mode = "count"; // "count" or "ccu"
  let dim  = "tier";  // "tier"=制作规模 | "mon"=商业模式
  let selectedYear = null;
  let isModeCountEntranceDone = false;
  let isModeCCUEntranceDone = false;

  // 当前维度下每段的份额取值（含诚实回退）：
  //  · tier：优先用后端干净字段 ti/ta/tb（CCU: cti/cta/ctb，F2P 已并入真实规模档）；
  //          缺失则用旧 indie/aa/aaa(ci/ca/cb) 去掉 F2P 后归一化兜底。
  //  · mon ：优先用后端 mp/mf/mh（CCU: cmp/cmf/cmh）；缺失则该(模式,维度)无数据。
  function dimVals(row) {
    if (dim === "tier") {
      if (mode === "ccu") {
        if (row.cti != null) return { indie: row.cti, aa: row.cta, aaa: row.ctb };
        return _renorm3(row.ci ?? 0, row.ca ?? 0, row.cb ?? 0, "indie","aa","aaa");
      }
      if (row.ti != null) return { indie: row.ti, aa: row.ta, aaa: row.tb };
      return _renorm3(row.indie ?? 0, row.aa ?? 0, row.aaa ?? 0, "indie","aa","aaa");
    } else {  // mon
      if (mode === "ccu") {
        if (row.cmp != null) return { premium: row.cmp, f2p: row.cmf, hybrid: row.cmh };
        return null;  // SteamCharts CCU 未按商业模式聚合 → 无数据
      }
      if (row.mp != null) return { premium: row.mp, f2p: row.mf, hybrid: row.mh };
      return null;
    }
  }
  function _renorm3(a, b, c, ka, kb, kc) {
    const s = a + b + c;
    const o = {};
    if (s > 0) { o[ka]=+(a/s*100).toFixed(1); o[kb]=+(b/s*100).toFixed(1); o[kc]=+(c/s*100).toFixed(1); }
    else { o[ka]=o[kb]=o[kc]=0; }
    return o;
  }
  // 当前(模式,维度)是否有可用数据（mon 维度依赖后端聚合）
  function dimAvailable() {
    return DATA.market.some(r => dimVals(r) != null);
  }

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

    // 当前维度的分段定义
    const KEYS = DIM[dim].keys, KC = DIM[dim].color, KL = DIM[dim].label;

    // 商业模式无分维数据 → 优雅提示，不硬拆造假
    if (!dimAvailable()) {
      // 区分两种情况：① 发布维度有数据、仅在线占比缺；② 整体未生成分维数据
      const monCountOk = DATA.market.some(r => r.mp != null);
      const line1 = (dim === "mon" && mode === "ccu" && monCountOk)
        ? "商业模式·在线占比暂无分维聚合数据"
        : "商业模式分维数据尚未生成";
      const line2 = (dim === "mon" && mode === "ccu" && monCountOk)
        ? "（SteamCharts 仅按制作规模聚合在线数 · 可切「发布数量」查看）"
        : "（请重新运行 05_preprocess.py 生成 tier/monetization 分维聚合）";
      g.append("text")
        .attr("x", iW/2).attr("y", iH/2)
        .attr("text-anchor","middle")
        .attr("fill","rgba(255,255,255,0.45)")
        .attr("font-family","'Space Mono',monospace")
        .attr("font-size", 12)
        .text(line1);
      g.append("text")
        .attr("x", iW/2).attr("y", iH/2 + 20)
        .attr("text-anchor","middle")
        .attr("fill","rgba(255,255,255,0.3)")
        .attr("font-family","'Noto Sans SC',sans-serif")
        .attr("font-size", 11)
        .text(line2);
      return;
    }

    // Build data for current mode/dimension（dimVals 内含后端字段优先 + 诚实回退）
    let stackData = DATA.market
      .filter(d => mode !== "ccu" || d.year >= 2012)
      .map(d => Object.assign({ year: d.year, _orig: d }, dimVals(d)));

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
          // CCU mode: show absolute CCU if available（仅 tier 维度有绝对值字段）
          const absKey = {"indie":"ci_abs","aa":"ca_abs","aaa":"cb_abs"}[s.key];
          const absVal = absKey ? d[absKey] : null;
          if (absVal) {
            tipContent += `<div class="tip-row"><span class="tip-k">月均在线</span><span class="tip-v">~${fmt.num(Math.round(absVal))}k</span></div>`;
          }
          tipContent += `<div style="margin-top:3px;font-size:8px;color:#6060a0">基于 SteamCharts 月均在线数据计算</div>`;
        } else {
          // 各段当年发布量绝对数：tier→ni/na/nb（后端干净计数 nti/nta/ntb 优先），mon→nmp/nmf/nmh
          const cntKey = {
            indie: d.nti != null ? "nti" : "ni", aa: d.nta != null ? "nta" : "na",
            aaa:   d.ntb != null ? "ntb" : "nb",
            premium: "nmp", f2p: "nmf", hybrid: "nmh",
          }[s.key];
          const cnt = cntKey != null ? d[cntKey] : null;
          tipContent += `<div class="tip-row"><span class="tip-k">本年总发布</span><span class="tip-v">${fmt.num(d.n)} 款</span></div>`;
          if (cnt != null)
            tipContent += `<div class="tip-row"><span class="tip-k">${KL[s.key]}发布量</span><span class="tip-v">${fmt.num(cnt)} 款</span></div>`;
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
        .attr("font-size", 12)
        .attr("font-weight", "bold")
        .attr("writing-mode", "vertical-rl")
        .attr("text-anchor", "middle")
        .text("◀ 2012前无公开数据");
      // Horizontal annotation at top
      g.append("text")
        .attr("x", 4).attr("y", iH - 6)
        .attr("fill", "rgba(255,255,255,0.2)")
        .attr("font-family", "'Space Mono',monospace")
        .attr("font-size", 10)
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
    const labelIdx = stackData.findIndex(r => r.year === labelYear);
    if (labelIdx >= 0) {
      series.forEach(s => {
        const d = s[labelIdx];
        const cy = (ySc(d[0]) + ySc(d[1])) / 2;
        const bw = Math.abs(ySc(d[1]) - ySc(d[0]));
        if (bw < 12) return;
        g.append("text")
          .attr("x", xSc(labelYear))
          .attr("y", cy)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("fill", "rgba(0,0,0,0.65)")
          .attr("font-family", "'Space Mono',monospace")
          .attr("font-size", Math.min(13, bw * 0.38))
          .attr("font-weight", "700")
          .attr("pointer-events", "none")
          .text(KL[s.key]);
      });
    }

    // Mode label
    g.append("text").attr("x",iW).attr("y",-6).attr("text-anchor","end")
      .attr("fill","rgba(255,255,255,0.15)").attr("font-family","'Space Mono',monospace").attr("font-size",11)
      .text(mode==="ccu" ? "MODE: AVG. ONLINE SHARE" : "MODE: RELEASE COUNT");

    // 商业模式视图诚实脚注：Hybrid 依赖内购信号 → 下界估计（与方法论一致）
    if (dim === "mon") {
      g.append("text")
        .attr("x", 0).attr("y", iH + 30)
        .attr("fill", "rgba(255,255,255,0.3)")
        .attr("font-family", "'Noto Sans SC',sans-serif")
        .attr("font-size", 10)
        .text("注：混合模式依赖「内购」信号识别，仅 Store 富集子集可得 → 占比为下界，买断为上界");
    }

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

  // Controls: 维度切换（制作规模 ⇄ 商业模式）
  function syncDimUI() {
    document.querySelectorAll("[data-sdim]").forEach(x =>
      x.classList.toggle("active", x.dataset.sdim === dim));
    // 商业模式·在线占比无分维数据时，禁用「在线人数」并加提示
    const ccuBtn = document.querySelector('[data-sm="ccu"]');
    if (ccuBtn) {
      const block = dim === "mon" && !DATA.market.some(r => r.cmp != null);
      ccuBtn.classList.toggle("disabled", block);
      ccuBtn.title = block ? "商业模式维度暂无在线占比数据" : "";
    }
  }
  document.querySelectorAll("[data-sdim]").forEach(b => {
    b.addEventListener("click", function () {
      if (dim === this.dataset.sdim) return;
      dim = this.dataset.sdim;
      // 切到商业模式且当前在「在线人数」却无 CCU 分维数据 → 自动回退到发布数量
      if (dim === "mon" && mode === "ccu" && !DATA.market.some(r => r.cmp != null)) {
        mode = "count";
        document.querySelectorAll("[data-sm]").forEach(x =>
          x.classList.toggle("active", x.dataset.sm === "count"));
      }
      syncDimUI();
      draw();
    });
  });

  draw();
  syncDimUI();
  window._streamRedraw = function () { syncDimUI(); draw(); };
  // 供导览模式（tour.js）以编程方式选中/清除年份，复用既有联动链
  window._streamSelectYear = selectYear;
};
// ════════════════════════════════════════════════