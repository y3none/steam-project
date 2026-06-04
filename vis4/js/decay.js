//  VIEW 3: DECAY CURVES — Dual Mode (Individual + Aggregate)
//  Merged: teammate's crosshair/tooltip model + dual mode + milestones + inline labels
// ════════════════════════════════════════════════
window.initDecay = function() {
  const MG={t:28,r:110,b:52,l:60};
  let showRef=true, highlighted=null, decayMode="individual";
  let svg,g,xSc,ySc;
  let firstDraw = true;

  const TYPE_STYLE = {
    AAA:   { dash: null,  width: 2.5, label: "3A大作" },
    AA:    { dash: "6,3", width: 2,   label: "AA中型" },
    Indie: { dash: null,  width: 2,   label: "独立游戏" },
    F2P:   { dash: "2,3", width: 2.5, label: "F2P免费" },
  };

  // ══════════════════════════════════════════════
  //  INDIVIDUAL MODE — single game curves
  // ══════════════════════════════════════════════
  function drawIndividual() {
    const wrap=document.getElementById("decay-inner");
    wrap.innerHTML="";
    const W=wrap.clientWidth, H=Math.max(280,Math.min(360,W*0.4));
    const iW=W-MG.l-MG.r, iH=H-MG.t-MG.b;

    svg=d3.select(wrap).append("svg").attr("viewBox","0 0 "+W+" "+H).attr("height",H);
    g=svg.append("g").attr("transform","translate("+MG.l+","+MG.t+")");

    xSc=d3.scaleLinear().domain([0,24]).range([0,iW]);
    ySc=d3.scaleLinear().domain([0,1.06]).range([iH,0]);

    g.append("g").attr("class","grid").call(d3.axisLeft(ySc).ticks(6).tickSize(-iW).tickFormat(""));
    g.append("g").attr("class","grid").attr("transform","translate(0,"+iH+")").call(d3.axisBottom(xSc).ticks(12).tickSize(-iH).tickFormat(""));

    if(showRef) [0.5,0.2,0.1].forEach(function(pct){
      g.append("line").attr("class","ref-l")
        .attr("x1",0).attr("x2",iW).attr("y1",ySc(pct)).attr("y2",ySc(pct))
        .attr("stroke","rgba(255,255,255,0.08)").attr("stroke-dasharray","2,5");
      g.append("text").attr("class","ref-t")
        .attr("x",iW+4).attr("y",ySc(pct)+3)
        .attr("fill","rgba(255,255,255,0.18)").attr("font-family","'Space Mono',monospace").attr("font-size",9)
        .text((pct*100)+"%");
    });

    // Milestone annotations
    var milestones = [
      {month:1,  label:"首月", note:"营销热度峰值", color:"rgba(255,82,82,0.35)"},
      {month:3,  label:"3个月", note:"3A典型断崖点", color:"rgba(255,213,79,0.3)"},
      {month:12, label:"一年", note:"长尾分水岭", color:"rgba(29,233,182,0.3)"},
    ];
    milestones.forEach(function(ms) {
      var x = xSc(ms.month);
      g.append("line").attr("x1",x).attr("x2",x).attr("y1",0).attr("y2",iH)
        .attr("stroke",ms.color).attr("stroke-width",1.5).attr("stroke-dasharray","4,4");
      g.append("text").attr("x",x).attr("y",-8).attr("text-anchor","middle")
        .attr("fill",ms.color).attr("font-family","'Space Mono',monospace").attr("font-size",10).attr("font-weight","bold")
        .text(ms.label);
      g.append("text").attr("x",x).attr("y",iH+24).attr("text-anchor","middle")
        .attr("fill",ms.color).attr("font-family","var(--sans)").attr("font-size",8)
        .text(ms.note);
    });

    // Axes
    g.append("g").attr("class","axis").attr("transform","translate(0,"+iH+")")
      .call(d3.axisBottom(xSc).tickFormat(function(d){return d===0?"发布":d+"月";}));
    g.append("g").attr("class","axis").call(d3.axisLeft(ySc).tickFormat(d3.format(".0%")));

    g.append("text").attr("x",iW/2).attr("y",iH+42).attr("text-anchor","middle")
      .attr("fill","#6060a0").attr("font-family","'Space Mono',monospace").attr("font-size",10)
      .text("发布后月数");

    var line=d3.line().x(function(_,i){return xSc(i);}).y(function(v){return ySc(v);}).curve(d3.curveCatmullRom.alpha(0.5));

    var sorted = DATA.decay.slice().sort(function(a,b) {
      if (highlighted) { if (a.name === highlighted) return 1; if (b.name === highlighted) return -1; }
      return 0;
    });

    // ── Crosshair & unified tooltip (background rect BEFORE paths) ──
    var cursor=g.append("line").attr("stroke","rgba(255,255,255,0.15)").attr("y1",0).attr("y2",iH).style("pointer-events","none").style("display","none");
    var dotsG=g.append("g").style("pointer-events","none");
    g.append("rect").attr("width",iW).attr("height",iH).attr("fill","transparent")
      .on("mousemove",function(ev){
        var mx=d3.pointer(ev)[0];
        if(mx<0||mx>iW){cursor.style("display","none");return;}
        var m=Math.max(0,Math.min(24,Math.round(xSc.invert(mx))));
        cursor.style("display",null).attr("x1",xSc(m)).attr("x2",xSc(m));
        var show=highlighted?DATA.decay.filter(function(d){return d.name===highlighted;}):DATA.decay;
        dotsG.selectAll(".cdot").remove();
        dotsG.selectAll(".cdot").data(show).join("circle").attr("class","cdot")
          .attr("cx",xSc(m)).attr("cy",function(d){return ySc(d.data[m]);}).attr("r",3.5)
          .attr("fill",function(d){return d.color;}).attr("stroke","#fff").attr("stroke-width",1);
        // Unified tooltip
        var tipHtml = '<div style="margin-bottom:4px;font-weight:700;color:var(--bright)">发布后 ' + m + ' 个月</div>';
        show.forEach(function(d) {
          tipHtml += '<div class="tip-row" style="margin:2px 0">' +
            '<span class="tip-k" style="color:'+d.color+'">'+d.name+'</span>' +
            '<span class="tip-v">'+fmt.pct(d.data[m]*100)+'</span></div>';
        });
        TIP.show(tipHtml, ev);
      })
      .on("mouseleave",function(){ cursor.style("display","none"); dotsG.selectAll(".cdot").remove(); TIP.hide(); });

    // ── Lines (drawn AFTER rect, on top, pointer-events:none) ──
    var paths = g.selectAll(".dline").data(sorted, function(d){return d.name;}).join("path")
      .attr("class","dline").attr("stroke",function(d){return d.color;}).attr("fill","none")
      .attr("d",function(d){return line(d.data);})
      .attr("stroke-dasharray", function(d){ var s=TYPE_STYLE[d.type]; return s?s.dash:null; })
      .attr("opacity",function(d){return highlighted?(d.name===highlighted?1:0.07):0.75;})
      .attr("stroke-width",function(d){return highlighted&&d.name===highlighted?3.5:((TYPE_STYLE[d.type]||{}).width||2);})
      .style("pointer-events","none");

    if (firstDraw) {
      paths.each(function() {
        var totalLen = this.getTotalLength();
        d3.select(this).attr("stroke-dasharray",totalLen).attr("stroke-dashoffset",totalLen)
          .transition().duration(1200).delay(function(_,i){return i*80;}).ease(d3.easeCubicInOut)
          .attr("stroke-dashoffset",0)
          .on("end", function(){ var d=d3.select(this).datum(); var s=TYPE_STYLE[d.type]; d3.select(this).attr("stroke-dasharray",s?s.dash:null); });
      });
      firstDraw = false;
    }

    // ── Inline end-of-line labels ──
    var labelPositions = [];
    sorted.forEach(function(d) {
      var lastVal = d.data[24] != null ? d.data[24] : d.data[d.data.length-1];
      if (lastVal == null) return;
      var yPos = ySc(lastVal);
      for (var j=0; j<labelPositions.length; j++) {
        if (Math.abs(yPos-labelPositions[j])<11) yPos = labelPositions[j]+(yPos>labelPositions[j]?11:-11);
      }
      labelPositions.push(yPos);
      var isActive = !highlighted || d.name===highlighted;
      var labelText = d.name.length>14 ? d.name.slice(0,12)+"…" : d.name;

      g.append("line").attr("x1",xSc(24)).attr("x2",xSc(24)+6).attr("y1",ySc(lastVal)).attr("y2",yPos)
        .attr("stroke",d.color).attr("stroke-width",0.5).attr("opacity",isActive?0.4:0);
      g.append("text").attr("class","decay-inline-label").attr("x",xSc(24)+8).attr("y",yPos+3)
        .attr("fill",d.color).attr("font-family","'Space Mono',monospace").attr("font-size",9)
        .attr("opacity",isActive?0.7:0).style("pointer-events","none").text(labelText);
    });

    buildLegendIndividual();
  }

  function highlightLine(name, sticky) {
    if (sticky !== undefined) highlighted = sticky ? name : null;
    g&&g.selectAll(".dline").transition().duration(200)
      .attr("opacity",function(d){return name?(d.name===name?1:0.07):0.75;})
      .attr("stroke-width",function(d){return name&&d.name===name?3.5:((TYPE_STYLE[d.type]||{}).width||2);});
    g&&g.selectAll(".decay-inline-label").transition().duration(200)
      .attr("opacity",function(){
        if(!name) return 0.7;
        var text=d3.select(this).text();
        var match=DATA.decay.find(function(d){ var t=d.name.length>14?d.name.slice(0,12)+"…":d.name; return t===text; });
        return match&&match.name===name?0.9:0;
      });
    document.querySelectorAll(".dl-item").forEach(function(el){ el.classList.toggle("active",el.dataset.name===name); });
    if (sticky !== undefined) { firstDraw=false; drawIndividual(); }
  }

  function buildLegendIndividual() {
    var leg=document.getElementById("decay-legend"); leg.innerHTML="";
    var typeOrder=["AAA","AA","Indie","F2P"];
    var groups={};
    DATA.decay.forEach(function(d){ if(!groups[d.type]) groups[d.type]=[]; groups[d.type].push(d); });

    typeOrder.forEach(function(type){
      if(!groups[type]||groups[type].length===0) return;
      var style=TYPE_STYLE[type]||{};
      var header=document.createElement("div"); header.className="dl-type-header"; header.style.color=C[type]||"#888";
      header.innerHTML='<span class="dl-type-line" style="border-color:'+(C[type]||"#888")+(style.dash?';border-style:dashed':'')+'"></span>'+style.label;
      leg.appendChild(header);
      groups[type].forEach(function(d){
        var el=document.createElement("div"); el.className="dl-item"+(highlighted===d.name?" active":""); el.dataset.name=d.name;
        el.innerHTML='<div class="dl-swatch" style="background:'+d.color+'"></div>'+d.name+' <span style="opacity:0.5">'+d.yr+'</span>';
        el.addEventListener("click",function(){ highlighted===d.name?highlightLine(null,true):highlightLine(d.name,true); });
        leg.appendChild(el);
      });
    });
  }


  // ══════════════════════════════════════════════
  //  AGGREGATE MODE — type-level engagement depth
  // ══════════════════════════════════════════════
  function drawAggregate() {
    var wrap=document.getElementById("decay-inner");
    wrap.innerHTML="";
    var W=wrap.clientWidth, H=Math.max(280,Math.min(360,W*0.4));
    var MGA={t:28,r:50,b:52,l:60};
    var iW=W-MGA.l-MGA.r, iH=H-MGA.t-MGA.b;

    var aggData = DATA.decayAggregate;
    if (!aggData || aggData.length===0) {
      wrap.innerHTML='<div class="loading-wrap" style="opacity:0.4">聚合数据不可用<br><span style="font-size:10px">运行 05_preprocess.py 生成 decay_aggregate.json</span></div>';
      return;
    }

    svg=d3.select(wrap).append("svg").attr("viewBox","0 0 "+W+" "+H).attr("height",H);
    g=svg.append("g").attr("transform","translate("+MGA.l+","+MGA.t+")");

    var maxAge = d3.max(aggData, function(d){return d.max_age;})||10;
    // Determine primary metric from data
    var usePrimary = aggData[0] && aggData[0].primary === "playtime" ? "playtime" : "engagement";
    var yLabel, tipMainLabel, tipMethodNote;
    if (usePrimary === "playtime") {
      yLabel = "相对中位游戏时长";
      tipMainLabel = "相对时长";
      tipMethodNote = "基于 median_playtime_forever · >1.0× = 长尾效应";
    } else {
      yLabel = "相对参与度（CCU/拥有者）";
      tipMainLabel = "相对参与度";
      tipMethodNote = "参与度 = 同时在线 ÷ 拥有者 · 越高 = 留存越好";
    }

    xSc=d3.scaleLinear().domain([0,Math.min(maxAge,10)]).range([0,iW]);

    // Y axis
    var curveKey = usePrimary === "playtime" ? "playtime_normalized" : "engagement_normalized";
    var absKey = usePrimary === "playtime" ? "playtime_absolute" : "engagement_absolute";
    var maxY = d3.max(aggData, function(d){ return d3.max(d[curveKey]); }) || 1.2;
    maxY = Math.max(maxY, 1.2);
    ySc=d3.scaleLinear().domain([0, maxY]).range([iH,0]);

    g.append("g").attr("class","grid").call(d3.axisLeft(ySc).ticks(6).tickSize(-iW).tickFormat(""));
    g.append("g").attr("class","grid").attr("transform","translate(0,"+iH+")").call(d3.axisBottom(xSc).ticks(Math.min(maxAge,10)).tickSize(-iH).tickFormat(""));

    // Baseline reference at 1.0
    g.append("line").attr("x1",0).attr("x2",iW).attr("y1",ySc(1)).attr("y2",ySc(1))
      .attr("stroke","rgba(255,255,255,0.15)").attr("stroke-dasharray","6,4").attr("stroke-width",1);
    g.append("text").attr("x",iW+4).attr("y",ySc(1)+3)
      .attr("fill","rgba(255,255,255,0.25)").attr("font-family","'Space Mono',monospace").attr("font-size",9)
      .text("首年基准 100%");

    // Axes
    g.append("g").attr("class","axis").attr("transform","translate(0,"+iH+")")
      .call(d3.axisBottom(xSc).ticks(Math.min(maxAge,10)).tickFormat(function(d){return d===0?"发布年":d+"年后";}));
    g.append("g").attr("class","axis").call(d3.axisLeft(ySc).tickFormat(d3.format(".0%")));

    g.append("text").attr("x",iW/2).attr("y",iH+42).attr("text-anchor","middle")
      .attr("fill","#6060a0").attr("font-family","'Space Mono',monospace").attr("font-size",10)
      .text("游戏年龄（发布后年数）");
    g.append("text").attr("transform","rotate(-90)").attr("x",-iH/2).attr("y",-46).attr("text-anchor","middle")
      .attr("fill","#6060a0").attr("font-family","'Space Mono',monospace").attr("font-size",10)
      .text(yLabel);

    var line=d3.line().x(function(_,i){return xSc(i);}).y(function(v){return ySc(v);}).defined(function(v){return v>0;}).curve(d3.curveCatmullRom.alpha(0.5));

    // Draw each type
    aggData.forEach(function(d) {
      var style = TYPE_STYLE[d.type]||{};
      var curve = d[curveKey];
      var maxIdx = Math.min(curve.length-1, 10);

      // Area under curve
      var area = d3.area().x(function(_,i){return xSc(i);}).y0(function(v){return ySc(Math.min(v,1));}).y1(function(v){return ySc(v);})
        .defined(function(v){return v>0;}).curve(d3.curveCatmullRom.alpha(0.5));
      g.append("path").attr("d",area(curve.slice(0,maxIdx+1))).attr("fill",d.color).attr("fill-opacity",0.06);

      // Main line
      var path=g.append("path").attr("d",line(curve.slice(0,maxIdx+1)))
        .attr("stroke",d.color).attr("fill","none").attr("stroke-width",style.width+1)
        .attr("stroke-dasharray",style.dash||null)
        .style("cursor","pointer");

      // Animate
      var totalLen=path.node().getTotalLength();
      path.attr("stroke-dasharray",totalLen).attr("stroke-dashoffset",totalLen)
        .transition().duration(1500).ease(d3.easeCubicInOut).attr("stroke-dashoffset",0)
        .on("end",function(){ d3.select(this).attr("stroke-dasharray",style.dash||null); });

      // End label
      var lastVal = curve[maxIdx];
      g.append("text").attr("x",xSc(maxIdx)+6).attr("y",ySc(lastVal)+4)
        .attr("fill",d.color).attr("font-family","'Space Mono',monospace").attr("font-size",10).attr("font-weight","bold")
        .text(style.label+" "+Math.round(lastVal*100)+"%");

      // Tooltip
      path.on("mousemove",function(ev){
        var mx=d3.pointer(ev)[0];
        var age=Math.max(0,Math.min(maxIdx,Math.round(xSc.invert(mx))));
        var val=curve[age]||0;
        var absVal = d[absKey] ? d[absKey][age] : 0;
        var absStr;
        if (usePrimary === "playtime") {
          absStr = absVal >= 60 ? Math.round(absVal/60)+"小时" : Math.round(absVal)+"分钟";
        } else {
          absStr = absVal > 0 ? absVal.toFixed(3)+"%" : "N/A";
        }
        var sampleN = d.sample_sizes ? d.sample_sizes[age] : 0;
        TIP.show('<strong>'+style.label+'（发布后'+age+'年的游戏）</strong>'+
          '<div class="tip-row"><span class="tip-k">'+tipMainLabel+'</span><span class="tip-v" style="color:'+d.color+'">'+val.toFixed(2)+'×</span></div>'+
          '<div class="tip-row"><span class="tip-k">'+(usePrimary==="playtime"?"中位游戏时长":"CCU/拥有者比率")+'</span><span class="tip-v">'+absStr+'</span></div>'+
          '<div class="tip-row"><span class="tip-k">该年龄段游戏数</span><span class="tip-v">'+fmt.num(sampleN)+' 款</span></div>'+
          '<div style="margin-top:3px;font-size:8px;color:#6060a0">'+tipMethodNote+'</div>'
        , ev);
      }).on("mouseleave",function(){ TIP.hide(); });
    });

    // Interpretation annotation
    g.append("text").attr("x",4).attr("y",14)
      .attr("fill","rgba(255,255,255,0.2)").attr("font-family","'Space Mono',monospace").attr("font-size",10)
      .text("基于 "+fmt.num(aggData.reduce(function(s,d){return s+d.total_games;},0))+" 款游戏 · 指标: "+(usePrimary==="playtime"?"中位游戏时长":"CCU/拥有者比率"));

    buildLegendAggregate(aggData, curveKey, usePrimary);
  }

  function buildLegendAggregate(aggData, curveKey, usePrimary) {
    var leg=document.getElementById("decay-legend"); leg.innerHTML="";

    var note=document.createElement("div");
    note.className="dl-type-header";
    note.style.color="rgba(255,255,255,0.3)";
    note.innerHTML='指标：'+(usePrimary==="playtime"?"中位游戏时长随游戏年龄变化":"参与度比率（CCU ÷ 拥有者）按游戏年龄变化");
    leg.appendChild(note);

    aggData.forEach(function(d){
      var style=TYPE_STYLE[d.type]||{};
      var el=document.createElement("div"); el.className="dl-item";
      var curve = d[curveKey];
      var lastVal = curve[Math.min(curve.length-1, 5)];
      var trend;
      if (usePrimary === "playtime") {
        trend = lastVal > 1.5 ? "长尾显著 ↑" : lastVal > 1.0 ? "略有增长" : lastVal > 0.7 ? "缓慢衰减" : "快速衰减 ↓";
      } else {
        trend = lastVal > 0.8 ? "留存强" : lastVal > 0.4 ? "中等衰减" : "快速流失";
      }
      el.innerHTML='<div class="dl-swatch" style="background:'+d.color+'"></div>'+style.label+
        ' <span style="opacity:0.5">'+fmt.num(d.total_games)+'款</span>'+
        ' <span style="opacity:0.35;font-size:9px;color:'+d.color+'">'+trend+'</span>';
      leg.appendChild(el);
    });
  }


  // ══════════════════════════════════════════════
  //  MODE SWITCHING & CONTROLS
  // ══════════════════════════════════════════════
  function draw() {
    if (decayMode === "aggregate") {
      drawAggregate();
    } else {
      drawIndividual();
    }
  }

  // Load aggregate data
  (async function(){
    try {
      var resp = null;
      if (typeof API_BASE !== 'undefined') {
        try { var r = await fetch(API_BASE+'/decay_aggregate'); if(r.ok) resp = await r.json(); } catch(e){}
      }
      if (!resp) {
        try { var r2 = await fetch('../data/processed/decay_aggregate.json'); if(r2.ok) resp = await r2.json(); } catch(e){}
      }
      if (resp && resp.length > 0) {
        DATA.decayAggregate = resp;
        console.log('[decay] aggregate data loaded: '+resp.length+' types');
      }
    } catch(e) { console.log('[decay] aggregate data not available'); }
  })();

  // Mode buttons
  document.querySelectorAll("[data-dm]").forEach(function(b){
    b.addEventListener("click",function(){
      document.querySelectorAll("[data-dm]").forEach(function(x){x.classList.remove("active");});
      this.classList.add("active");
      decayMode = this.dataset.dm;
      highlighted = null;
      firstDraw = (decayMode === "individual");
      draw();
    });
  });

  // Ref line buttons
  document.querySelectorAll("[data-dr]").forEach(function(b){
    b.addEventListener("click",function(){
      document.querySelectorAll("[data-dr]").forEach(function(x){x.classList.remove("active");});
      this.classList.add("active");
      showRef=this.dataset.dr==="on";
      firstDraw=false; draw();
    });
  });

  draw();
  window._decayRedraw = function() { firstDraw=false; draw(); };

  // Cross-view linkage: scatter → decay
  EVT.on("decayHighlight", function(name) {
    if (!name) { highlightLine(null, true); return; }
    if (decayMode !== "individual") {
      decayMode = "individual";
      document.querySelectorAll("[data-dm]").forEach(function(x){x.classList.remove("active");});
      var indBtn = document.querySelector('[data-dm="individual"]');
      if (indBtn) indBtn.classList.add("active");
    }
    var match = DATA.decay.find(function(d){ return d.name===name; });
    if (match) highlightLine(match.name, true);
  });
};
// ════════════════════════════════════════════════