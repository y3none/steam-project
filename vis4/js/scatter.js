//  VIEW 2: BUBBLE SCATTER
// ════════════════════════════════════════════════
window.initScatter = function() {
  const MG={t:20,r:24,b:48,l:66};
  let activeFilter="all", selected=null, yearFilter=null, searchTerm="";
  let svg,g,xSc,ySc,rSc,iW,iH;

  function getFilteredData() {
    let data = DATA.bubbles;
    // Type filter
    if (activeFilter !== "all") {
      data = data.filter(d => d.type === activeFilter);
    }
    // Year filter (from stream graph cross-link)
    if (yearFilter) {
      data = data.filter(d => d.yr === yearFilter);
    }
    return data;
  }

  function getSearchMatch(d) {
    if (!searchTerm) return true;
    return d.name.toLowerCase().includes(searchTerm.toLowerCase());
  }

  function draw() {
    const wrap=document.getElementById("scatter-inner");
    wrap.innerHTML="";
    const W=wrap.clientWidth, H=Math.max(320,Math.min(420,W*0.45));
    iW=W-MG.l-MG.r; iH=H-MG.t-MG.b;

    svg=d3.select(wrap).append("svg").attr("viewBox",`0 0 ${W} ${H}`).attr("height",H);
    g=svg.append("g").attr("transform",`translate(${MG.l},${MG.t})`);

    xSc=d3.scaleLinear().domain([55,100]).range([0,iW]);
    ySc=d3.scaleLog().domain([4000,4800000]).range([iH,0]).clamp(true);
    rSc=d3.scaleSqrt().domain([0,60]).range([3,W<700?26:38]);

    // Grid
    g.append("g").attr("class","grid").call(d3.axisLeft(ySc).ticks(5).tickSize(-iW).tickFormat(""));
    g.append("g").attr("class","grid").attr("transform",`translate(0,${iH})`).call(d3.axisBottom(xSc).ticks(6).tickSize(-iH).tickFormat(""));

    // Axes
    g.append("g").attr("class","axis").attr("transform",`translate(0,${iH})`)
      .call(d3.axisBottom(xSc).tickFormat(d=>d+"%"));
    g.append("g").attr("class","axis")
      .call(d3.axisLeft(ySc).ticks(5).tickFormat(v=>v>=1e6?(v/1e6).toFixed(1)+"M":(v/1e3).toFixed(0)+"k"));

    // Axis labels
    g.append("text").attr("x",iW/2).attr("y",iH+38).attr("text-anchor","middle")
      .attr("fill","#6060a0").attr("font-family","'Space Mono',monospace").attr("font-size",10)
      .attr("letter-spacing","1").text("STEAM 好评率 (%)");
    g.append("text").attr("transform","rotate(-90)").attr("x",-iH/2).attr("y",-54)
      .attr("text-anchor","middle").attr("fill","#6060a0")
      .attr("font-family","'Space Mono',monospace").attr("font-size",10).attr("letter-spacing","1")
      .text("峰值在线人数（对数轴）");

    // Quadrant label
    g.append("text").attr("x",iW-4).attr("y",14).attr("text-anchor","end")
      .attr("fill","rgba(29,233,182,0.12)").attr("font-family","'Space Mono',monospace").attr("font-size",10)
      .text("高口碑 · 高人气 →");

    // Year filter indicator
    if (yearFilter) {
      g.append("text").attr("x",4).attr("y",14)
        .attr("fill","rgba(29,233,182,0.4)").attr("font-family","'Space Mono',monospace").attr("font-size",10)
        .text("筛选：" + yearFilter + " 年发布");
    }

    const show = getFilteredData();
    const allData = DATA.bubbles;
    const hide = allData.filter(d => !show.includes(d));

    // Background dimmed bubbles
    g.selectAll(".bub-dim").data(hide.sort((a,b)=>b.own-a.own)).join("circle")
      .attr("class","bub-dim")
      .attr("cx",d=>xSc(d.pr)).attr("cy",d=>ySc(Math.max(4001,d.ccu)))
      .attr("r",d=>rSc(d.own)).attr("fill",d=>C[d.type]||"#888")
      .attr("opacity",0.04).attr("stroke","none");

    // Active bubbles with transition support
    const bubbles = g.selectAll(".bub").data(show.sort((a,b)=>b.own-a.own), d=>d.name);

    bubbles.join(
      enter => enter.append("circle")
        .attr("class","bub")
        .attr("cx",d=>xSc(d.pr))
        .attr("cy",d=>ySc(Math.max(4001,d.ccu)))
        .attr("r",0)
        .attr("fill",d=>C[d.type]||"#888")
        .attr("stroke",d=>d3.color(C[d.type]||"#888").darker(0.8))
        .attr("stroke-width",1)
        .attr("opacity",0)
        .style("cursor","pointer")
        .call(enter => enter.transition().duration(600).ease(d3.easeCubicOut)
          .attr("r", d=>rSc(d.own))
          .attr("opacity", d => {
            if (searchTerm && !getSearchMatch(d)) return 0.08;
            return d.ccu>100000?0.85:0.65;
          })
        ),
      update => update
        .call(update => update.transition().duration(400)
          .attr("cx",d=>xSc(d.pr))
          .attr("cy",d=>ySc(Math.max(4001,d.ccu)))
          .attr("r", d=>rSc(d.own))
          .attr("opacity", d => {
            if (searchTerm && !getSearchMatch(d)) return 0.08;
            return d.ccu>100000?0.85:0.65;
          })
        ),
      exit => exit
        .call(exit => exit.transition().duration(300)
          .attr("r", 0).attr("opacity", 0).remove()
        )
    );

    // Re-bindge events after transition
    setTimeout(() => {
      g.selectAll(".bub")
        .on("mousemove",function(ev,d){
          if(selected===d) return;
          d3.select(this).transition().duration(100).attr("r",rSc(d.own)*1.12);
          TIP.show(`<strong>${d.name}</strong>
            <div class="tip-row"><span class="tip-k">类型</span><span class="tip-v" style="color:${C[d.type]}">${TL[d.type]}</span></div>
            <div class="tip-row"><span class="tip-k">发行年</span><span class="tip-v">${d.yr}</span></div>
            <div class="tip-row"><span class="tip-k">好评率</span><span class="tip-v">${fmt.pct(d.pr)}</span></div>
            <div class="tip-row"><span class="tip-k">峰值在线</span><span class="tip-v">${fmt.ccu(d.ccu)}</span></div>
            <div class="tip-row"><span class="tip-k">估算拥有</span><span class="tip-v">${fmt.own(d.own)}</span></div>
            <div class="tip-row"><span class="tip-k">定价</span><span class="tip-v">${fmt.price(d.price)}</span></div>
          `, ev);
        })
        .on("mouseleave",function(ev,d){
          if(selected!==d) { d3.select(this).transition().duration(100).attr("r",rSc(d.own)); TIP.hide(); }
        })
        .on("click",function(ev,d){
          ev.stopPropagation();
          if(selected===d){
            selected=null; TIP.hide();
            g.selectAll(".bub").transition().duration(300)
              .attr("opacity",dd=>{
                if(searchTerm && !getSearchMatch(dd)) return 0.08;
                return dd.ccu>100000?0.85:0.65;
              })
              .attr("r",dd=>rSc(dd.own));
            showDetailPanel(null);
          } else {
            selected=d; TIP.hide();
            g.selectAll(".bub").transition().duration(300)
              .attr("opacity",dd=>dd===d?1:0.06)
              .attr("r",dd=>dd===d?rSc(dd.own)*1.18:rSc(dd.own));
            showDetailPanel(d);
          }
        });
    }, 50);

    // Labels — improved: only show for non-overlapping, prominent games
    const labelCandidates = show
      .filter(d => (d.ccu>150000 || d.own>12 || d.pr>97.5) && (!searchTerm || getSearchMatch(d)))
      .sort((a,b) => b.ccu - a.ccu);

    // Simple overlap avoidance: track used y positions
    const usedPositions = [];
    labelCandidates.forEach(d => {
      const lx = xSc(d.pr);
      const ly = ySc(Math.max(4001,d.ccu)) - rSc(d.own) - 6;
      // Check if too close to existing label
      const tooClose = usedPositions.some(([px,py]) =>
        Math.abs(lx-px) < 60 && Math.abs(ly-py) < 12
      );
      if (tooClose) return;
      usedPositions.push([lx, ly]);

      g.append("text").attr("class","glabel")
        .attr("x", lx).attr("y", ly)
        .attr("text-anchor","middle").attr("font-size",8)
        .attr("font-family","'Space Mono',monospace").attr("fill","#6868a8")
        .attr("opacity", 0)
        .text(d.name.length>16 ? d.name.slice(0,14)+"…" : d.name)
        .transition().delay(400).duration(300).attr("opacity", 1);
    });

    // Search highlight: ring around matched games
    if (searchTerm) {
      const matched = show.filter(getSearchMatch);
      g.selectAll(".search-ring").data(matched, d=>d.name).join("circle")
        .attr("class","search-ring")
        .attr("cx", d=>xSc(d.pr))
        .attr("cy", d=>ySc(Math.max(4001,d.ccu)))
        .attr("r", d=>rSc(d.own)+4)
        .attr("fill","none")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3,2")
        .attr("opacity", 0.6)
        .style("pointer-events","none");
    }

    // Click outside deselect
    svg.on("click",()=>{
      selected=null; TIP.hide();
      g.selectAll(".bub").transition().duration(300)
        .attr("opacity",dd=>{
          if(searchTerm && !getSearchMatch(dd)) return 0.08;
          return dd.ccu>100000?0.85:0.65;
        })
        .attr("r",dd=>rSc(dd.own));
      showDetailPanel(null);
    });
  }

  function showDetailPanel(d) {
    const p=document.getElementById("detail-panel");
    if(!d){
      p.innerHTML=`<div class="detail-empty"><div class="detail-empty-icon">◎</div><div class="detail-empty-text">点击任意气泡<br>查看游戏详情</div></div>`;
      return;
    }
    const col=C[d.type]||"#888";
    p.innerHTML=`
      <div class="detail-game-name">${d.name}</div>
      <div class="detail-type" style="color:${col}">${d.type} · ${d.yr}</div>
      <div class="detail-row"><span class="detail-key">好评率</span><span class="detail-val" style="color:${col}">${fmt.pct(d.pr)}</span></div>
      <div class="detail-row"><span class="detail-key">峰值在线</span><span class="detail-val">${fmt.ccu(d.ccu)}</span></div>
      <div class="detail-row"><span class="detail-key">估算拥有</span><span class="detail-val">${fmt.own(d.own)}</span></div>
      <div class="detail-row"><span class="detail-key">定价</span><span class="detail-val">${fmt.price(d.price)}</span></div>
      <div class="detail-row"><span class="detail-key">评价总数</span><span class="detail-val">${fmt.num(d.rc)}</span></div>
      <div class="detail-row"><span class="detail-key">开发商</span><span class="detail-val" style="font-size:10px">${d.dev[0]||"—"}</span></div>
      <div class="detail-tags">${(d.tags||[]).map(t=>`<span class="detail-tag">${t}</span>`).join("")}</div>
    `;
  }

  // Filter buttons
  document.querySelectorAll("[data-sf]").forEach(b=>{
    b.addEventListener("click",function(){
      document.querySelectorAll("[data-sf]").forEach(x=>x.classList.remove("active"));
      this.classList.add("active");
      activeFilter=this.dataset.sf;
      selected=null;
      showDetailPanel(null);
      draw();
    });
  });

  // Search input
  const searchInput = document.getElementById("scatter-search");
  if (searchInput) {
    let debounce;
    searchInput.addEventListener("input", function() {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        searchTerm = this.value.trim();
        draw();
      }, 200);
    });
  }

  // Cross-view: listen for year selection from stream graph
  EVT.on("yearSelect", yr => {
    yearFilter = yr;
    selected = null;
    showDetailPanel(null);
    draw();
  });

  draw();
  window._scatterRedraw = draw;
};
// ════════════════════════════════════════════════
