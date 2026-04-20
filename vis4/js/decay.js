//  VIEW 3: DECAY CURVES
// ════════════════════════════════════════════════
window.initDecay = function() {
  const MG={t:24,r:48,b:48,l:60};
  let showRef=true, highlighted=null;
  let svg,g,xSc,ySc;
  let firstDraw = true;

  function draw() {
    const wrap=document.getElementById("decay-inner");
    wrap.innerHTML="";
    const W=wrap.clientWidth, H=Math.max(280,Math.min(360,W*0.4));
    const iW=W-MG.l-MG.r, iH=H-MG.t-MG.b;

    svg=d3.select(wrap).append("svg").attr("viewBox",`0 0 ${W} ${H}`).attr("height",H);
    g=svg.append("g").attr("transform",`translate(${MG.l},${MG.t})`);

    xSc=d3.scaleLinear().domain([0,24]).range([0,iW]);
    ySc=d3.scaleLinear().domain([0,1.06]).range([iH,0]);

    g.append("g").attr("class","grid").call(d3.axisLeft(ySc).ticks(6).tickSize(-iW).tickFormat(""));
    g.append("g").attr("class","grid").attr("transform",`translate(0,${iH})`).call(d3.axisBottom(xSc).ticks(12).tickSize(-iH).tickFormat(""));

    // Reference lines
    if(showRef) [0.5,0.2,0.1].forEach(pct=>{
      g.append("line").attr("class","ref-l")
        .attr("x1",0).attr("x2",iW).attr("y1",ySc(pct)).attr("y2",ySc(pct))
        .attr("stroke","rgba(255,255,255,0.08)").attr("stroke-dasharray","2,5");
      g.append("text").attr("class","ref-t")
        .attr("x",iW+4).attr("y",ySc(pct)+3)
        .attr("fill","rgba(255,255,255,0.18)").attr("font-family","'Space Mono',monospace").attr("font-size",9)
        .text((pct*100)+"%");
    });

    // "Industry median" band (25th-75th percentile approximation)
    if(showRef) {
      g.append("rect")
        .attr("x", 0).attr("width", iW)
        .attr("y", ySc(0.35)).attr("height", ySc(0.08) - ySc(0.35))
        .attr("fill", "rgba(255,255,255,0.02)")
        .attr("stroke", "none");
      g.append("text")
        .attr("x", 6).attr("y", ySc(0.22)-4)
        .attr("fill","rgba(255,255,255,0.1)").attr("font-family","'Space Mono',monospace").attr("font-size",8)
        .text("行业中位区间");
    }

    // Axes
    g.append("g").attr("class","axis").attr("transform",`translate(0,${iH})`)
      .call(d3.axisBottom(xSc).tickFormat(d=>d===0?"发布月":d+"月"));
    g.append("g").attr("class","axis").call(d3.axisLeft(ySc).tickFormat(d3.format(".0%")));

    g.append("text").attr("x",iW/2).attr("y",iH+38).attr("text-anchor","middle")
      .attr("fill","#6060a0").attr("font-family","'Space Mono',monospace").attr("font-size",10).attr("letter-spacing","1")
      .text("发布后月数");
    g.append("text").attr("transform","rotate(-90)").attr("x",-iH/2).attr("y",-48)
      .attr("text-anchor","middle").attr("fill","#6060a0")
      .attr("font-family","'Space Mono',monospace").attr("font-size",10).attr("letter-spacing","1")
      .text("归一化在线人数（% of 首月峰值）");

    const line=d3.line().x((_,i)=>xSc(i)).y(v=>ySc(v)).curve(d3.curveCatmullRom.alpha(0.5));

    // Lines with draw-on animation
    const paths = g.selectAll(".dline").data(DATA.decay).join("path")
      .attr("class","dline")
      .attr("stroke",d=>d.color)
      .attr("fill","none")
      .attr("d",d=>line(d.data))
      .style("cursor","pointer");

    if (firstDraw) {
      // Animate line drawing
      paths.each(function() {
        const totalLen = this.getTotalLength();
        d3.select(this)
          .attr("stroke-dasharray", totalLen)
          .attr("stroke-dashoffset", totalLen)
          .attr("stroke-width", 2)
          .attr("opacity", 0.75)
          .transition()
          .duration(1200)
          .delay((_,i) => i * 80)
          .ease(d3.easeCubicInOut)
          .attr("stroke-dashoffset", 0);
      });
      firstDraw = false;
    } else {
      paths
        .attr("stroke-dasharray", null)
        .attr("stroke-dashoffset", null)
        .attr("opacity",d=>highlighted?(d.name===highlighted?1:0.07):0.75)
        .attr("stroke-width",d=>highlighted&&d.name===highlighted?3:2);
    }

    // Events on lines
    paths
      .on("mousemove",function(ev,d){
        const mx=d3.pointer(ev)[0];
        const m=Math.max(0,Math.min(24,Math.round(xSc.invert(mx))));
        TIP.show(`<strong>${d.name}</strong>
          <div class="tip-row"><span class="tip-k">发布后</span><span class="tip-v">${m} 个月</span></div>
          <div class="tip-row"><span class="tip-k">相对在线</span><span class="tip-v">${fmt.pct(d.data[m]*100)}</span></div>
          <div class="tip-row"><span class="tip-k">类型</span><span class="tip-v" style="color:${d.color}">${TL[d.type]}</span></div>
          <div class="tip-row"><span class="tip-k">峰值CCU</span><span class="tip-v">${fmt.ccu(d.peak)}</span></div>
        `, ev);
        if(!highlighted) highlightLine(d.name);
      })
      .on("mouseleave",()=>{ TIP.hide(); if(!highlighted) highlightLine(null); })
      .on("click", function(ev, d) {
        ev.stopPropagation();
        highlighted === d.name ? highlightLine(null, true) : highlightLine(d.name, true);
      });

    // Cursor & dots
    const cursor=g.append("line").attr("stroke","rgba(255,255,255,0.15)").attr("y1",0).attr("y2",iH).style("pointer-events","none").style("display","none");
    const dotsG=g.append("g");

    g.append("rect").attr("width",iW).attr("height",iH).attr("fill","transparent")
      .on("mousemove",function(ev){
        const [mx]=d3.pointer(ev);
        if(mx<0||mx>iW){cursor.style("display","none");return;}
        const m=Math.max(0,Math.min(24,Math.round(xSc.invert(mx))));
        cursor.style("display",null).attr("x1",xSc(m)).attr("x2",xSc(m));
        dotsG.selectAll(".cdot").remove();
        const show=highlighted?DATA.decay.filter(d=>d.name===highlighted):DATA.decay;
        dotsG.selectAll(".cdot").data(show).join("circle").attr("class","cdot")
          .attr("cx",xSc(m)).attr("cy",d=>ySc(d.data[m])).attr("r",3.5)
          .attr("fill",d=>d.color).attr("stroke","#fff").attr("stroke-width",1).style("pointer-events","none");
        if(highlighted){
          const d=DATA.decay.find(x=>x.name===highlighted);
          if(d) TIP.show(`<strong>${d.name}</strong>
            <div class="tip-row"><span class="tip-k">发布后</span><span class="tip-v">${m} 个月</span></div>
            <div class="tip-row"><span class="tip-k">相对在线</span><span class="tip-v">${fmt.pct(d.data[m]*100)}</span></div>
          `, ev);
        }
      })
      .on("mouseleave",()=>{ cursor.style("display","none"); dotsG.selectAll(".cdot").remove(); TIP.hide(); if(!highlighted) highlightLine(null); });

    // End-of-line labels (show game name at month 24)
    DATA.decay.forEach(d => {
      const lastVal = d.data[24];
      g.append("text")
        .attr("x", xSc(24) + 4)
        .attr("y", ySc(lastVal) + 3)
        .attr("fill", d.color)
        .attr("font-family","'Space Mono',monospace")
        .attr("font-size", 8)
        .attr("opacity", highlighted ? (d.name === highlighted ? 0.8 : 0) : 0.4)
        .style("pointer-events","none")
        .text(d.name.length > 12 ? d.name.slice(0,10)+"…" : d.name);
    });

    buildLegend();
  }

  function highlightLine(name, sticky) {
    if (sticky !== undefined) {
      highlighted = sticky ? name : null;
    } else if (!highlighted) {
      // Temporary hover highlight
    }
    if (sticky) highlighted = name;

    g&&g.selectAll(".dline").transition().duration(200)
      .attr("opacity",d=>name?(d.name===name?1:0.07):0.75)
      .attr("stroke-width",d=>name&&d.name===name?3:2);
    document.querySelectorAll(".dl-item").forEach(el=>{
      el.classList.toggle("active", el.dataset.name===name);
    });
  }

  function buildLegend() {
    const leg=document.getElementById("decay-legend");
    leg.innerHTML="";
    // Group by type
    const groups = {};
    DATA.decay.forEach(d => {
      if (!groups[d.type]) groups[d.type] = [];
      groups[d.type].push(d);
    });

    Object.entries(groups).forEach(([type, games]) => {
      games.forEach(d => {
        const el=document.createElement("div");
        el.className="dl-item"+(highlighted===d.name?" active":"");
        el.dataset.name=d.name;
        el.innerHTML=`<div class="dl-swatch" style="background:${d.color}"></div>${d.name} <span style="opacity:0.5">${d.yr}</span>`;
        el.addEventListener("click",()=>{
          highlighted===d.name ? highlightLine(null, true) : highlightLine(d.name, true);
        });
        leg.appendChild(el);
      });
    });
  }

  // Controls
  document.querySelectorAll("[data-dr]").forEach(b=>{
    b.addEventListener("click",function(){
      document.querySelectorAll("[data-dr]").forEach(x=>x.classList.remove("active"));
      this.classList.add("active");
      showRef=this.dataset.dr==="on";
      firstDraw = false;
      draw();
    });
  });

  draw();
  window._decayRedraw = () => { firstDraw = false; draw(); };
};
// ════════════════════════════════════════════════
