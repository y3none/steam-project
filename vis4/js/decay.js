//  VIEW 3: DECAY CURVES — Enhanced
// ════════════════════════════════════════════════
window.initDecay = function() {
  const MG={t:24,r:110,b:48,l:60};
  let showRef=true, highlighted=null;
  let svg,g,xSc,ySc;
  let firstDraw = true;

  // Type line style mapping
  const TYPE_STYLE = {
    AAA:   { dash: null,    width: 2.5, label: "3A大作" },
    AA:    { dash: "6,3",   width: 2,   label: "AA中型" },
    Indie: { dash: null,    width: 2,   label: "独立游戏" },
    F2P:   { dash: "2,3",   width: 2.5, label: "F2P免费" },
  };

  function draw() {
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

    // Reference lines
    if(showRef) [0.5,0.2,0.1].forEach(function(pct){
      g.append("line").attr("class","ref-l")
        .attr("x1",0).attr("x2",iW).attr("y1",ySc(pct)).attr("y2",ySc(pct))
        .attr("stroke","rgba(255,255,255,0.08)").attr("stroke-dasharray","2,5");
      g.append("text").attr("class","ref-t")
        .attr("x",iW+4).attr("y",ySc(pct)+3)
        .attr("fill","rgba(255,255,255,0.18)").attr("font-family","'Space Mono',monospace").attr("font-size",9)
        .text((pct*100)+"%");
    });

    // Industry median band
    if(showRef) {
      g.append("rect")
        .attr("x",0).attr("width",iW)
        .attr("y",ySc(0.35)).attr("height",ySc(0.08)-ySc(0.35))
        .attr("fill","rgba(255,255,255,0.02)");
    }

    // Key milestone annotations — prominent vertical markers
    var milestones = [
      {month:1,  label:"首月", note:"营销热度峰值", color:"rgba(255,82,82,0.35)"},
      {month:3,  label:"3个月", note:"3A典型断崖点", color:"rgba(255,213,79,0.3)"},
      {month:12, label:"一年", note:"长尾分水岭", color:"rgba(29,233,182,0.3)"},
    ];
    milestones.forEach(function(ms) {
      var x = xSc(ms.month);
      g.append("line")
        .attr("x1",x).attr("x2",x).attr("y1",0).attr("y2",iH)
        .attr("stroke", ms.color).attr("stroke-width", 1.5).attr("stroke-dasharray","4,4");
      g.append("text")
        .attr("x",x).attr("y",-8).attr("text-anchor","middle")
        .attr("fill", ms.color).attr("font-family","'Space Mono',monospace")
        .attr("font-size",10).attr("font-weight","bold")
        .text(ms.label);
      g.append("text")
        .attr("x",x).attr("y",iH+24).attr("text-anchor","middle")
        .attr("fill", ms.color).attr("font-family","var(--sans)")
        .attr("font-size",8)
        .text(ms.note);
    });

    // Axes
    g.append("g").attr("class","axis").attr("transform","translate(0,"+iH+")")
      .call(d3.axisBottom(xSc).tickFormat(function(d){return d===0?"发布":d+"月";}));
    g.append("g").attr("class","axis").call(d3.axisLeft(ySc).tickFormat(d3.format(".0%")));

    g.append("text").attr("x",iW/2).attr("y",iH+38).attr("text-anchor","middle")
      .attr("fill","#6060a0").attr("font-family","'Space Mono',monospace").attr("font-size",10).attr("letter-spacing","1")
      .text("发布后月数");
    g.append("text").attr("transform","rotate(-90)").attr("x",-iH/2).attr("y",-48)
      .attr("text-anchor","middle").attr("fill","#6060a0")
      .attr("font-family","'Space Mono',monospace").attr("font-size",10).attr("letter-spacing","1")
      .text("归一化在线人数（% of 首月峰值）");

    var line=d3.line().x(function(_,i){return xSc(i);}).y(function(v){return ySc(v);}).curve(d3.curveCatmullRom.alpha(0.5));

    // Sort: draw highlighted type on top
    var sorted = DATA.decay.slice().sort(function(a,b) {
      if (highlighted) {
        if (a.name === highlighted) return 1;
        if (b.name === highlighted) return -1;
      }
      return 0;
    });

    // Lines with type-specific styling
    var paths = g.selectAll(".dline").data(sorted, function(d){return d.name;}).join("path")
      .attr("class","dline")
      .attr("stroke",function(d){return d.color;})
      .attr("fill","none")
      .attr("d",function(d){return line(d.data);})
      .attr("stroke-dasharray", function(d) {
        var s = TYPE_STYLE[d.type];
        return s ? s.dash : null;
      })
      .style("cursor","pointer");

    if (firstDraw) {
      paths.each(function() {
        var totalLen = this.getTotalLength();
        d3.select(this)
          .attr("stroke-dasharray", totalLen)
          .attr("stroke-dashoffset", totalLen)
          .attr("stroke-width", 2)
          .attr("opacity", 0.75)
          .transition()
          .duration(1200)
          .delay(function(_,i){return i * 80;})
          .ease(d3.easeCubicInOut)
          .attr("stroke-dashoffset", 0)
          .on("end", function() {
            var d = d3.select(this).datum();
            var s = TYPE_STYLE[d.type];
            d3.select(this).attr("stroke-dasharray", s ? s.dash : null);
          });
      });
      firstDraw = false;
    } else {
      paths
        .attr("opacity",function(d){return highlighted?(d.name===highlighted?1:0.07):0.75;})
        .attr("stroke-width",function(d){return highlighted&&d.name===highlighted?3.5:((TYPE_STYLE[d.type]||{}).width||2);});
    }

    // Events on lines
    paths
      .on("mousemove",function(ev,d){
        var mx=d3.pointer(ev)[0];
        var m=Math.max(0,Math.min(24,Math.round(xSc.invert(mx))));
        TIP.show('<strong>'+d.name+'</strong>'+
          '<div class="tip-row"><span class="tip-k">发布后</span><span class="tip-v">'+m+' 个月</span></div>'+
          '<div class="tip-row"><span class="tip-k">相对在线</span><span class="tip-v">'+fmt.pct(d.data[m]*100)+'</span></div>'+
          '<div class="tip-row"><span class="tip-k">类型</span><span class="tip-v" style="color:'+d.color+'">'+TL[d.type]+'</span></div>'+
          '<div class="tip-row"><span class="tip-k">峰值CCU</span><span class="tip-v">'+fmt.ccu(d.peak)+'</span></div>'
        , ev);
        if(!highlighted) highlightLine(d.name);
      })
      .on("mouseleave",function(){ TIP.hide(); if(!highlighted) highlightLine(null); })
      .on("click", function(ev, d) {
        ev.stopPropagation();
        highlighted === d.name ? highlightLine(null, true) : highlightLine(d.name, true);
      });

    // ── Inline end-of-line labels (near each curve, avoiding overlap) ──
    var labelPositions = [];
    sorted.forEach(function(d) {
      // Find a good month to place the label (prefer month 20-24 where lines spread out)
      var bestM = 24;
      var lastVal = d.data[bestM] != null ? d.data[bestM] : d.data[d.data.length - 1];
      if (lastVal == null) return;

      var yPos = ySc(lastVal);
      // Avoid overlapping with previous labels
      var minGap = 11;
      for (var j = 0; j < labelPositions.length; j++) {
        if (Math.abs(yPos - labelPositions[j]) < minGap) {
          yPos = labelPositions[j] + (yPos > labelPositions[j] ? minGap : -minGap);
        }
      }
      labelPositions.push(yPos);

      var isActive = !highlighted || d.name === highlighted;
      var labelText = d.name.length > 14 ? d.name.slice(0,12)+"…" : d.name;

      g.append("line")
        .attr("x1", xSc(24)).attr("x2", xSc(24)+6)
        .attr("y1", ySc(lastVal)).attr("y2", yPos)
        .attr("stroke", d.color)
        .attr("stroke-width", 0.5)
        .attr("opacity", isActive ? 0.4 : 0);

      g.append("text")
        .attr("class", "decay-inline-label")
        .attr("x", xSc(24) + 8)
        .attr("y", yPos + 3)
        .attr("fill", d.color)
        .attr("font-family","'Space Mono',monospace")
        .attr("font-size", 9)
        .attr("opacity", isActive ? 0.7 : 0)
        .style("pointer-events","none")
        .text(labelText);
    });

    // Cursor & dots
    var cursor=g.append("line").attr("stroke","rgba(255,255,255,0.15)").attr("y1",0).attr("y2",iH).style("pointer-events","none").style("display","none");
    var dotsG=g.append("g");

    g.append("rect").attr("width",iW).attr("height",iH).attr("fill","transparent")
      .on("mousemove",function(ev){
        var mx=d3.pointer(ev)[0];
        if(mx<0||mx>iW){cursor.style("display","none");return;}
        var m=Math.max(0,Math.min(24,Math.round(xSc.invert(mx))));
        cursor.style("display",null).attr("x1",xSc(m)).attr("x2",xSc(m));
        dotsG.selectAll(".cdot").remove();
        var show=highlighted?DATA.decay.filter(function(d){return d.name===highlighted;}):DATA.decay;
        dotsG.selectAll(".cdot").data(show).join("circle").attr("class","cdot")
          .attr("cx",xSc(m)).attr("cy",function(d){return ySc(d.data[m]);}).attr("r",3.5)
          .attr("fill",function(d){return d.color;}).attr("stroke","#fff").attr("stroke-width",1).style("pointer-events","none");
        if(highlighted){
          var d=DATA.decay.find(function(x){return x.name===highlighted;});
          if(d) TIP.show('<strong>'+d.name+'</strong>'+
            '<div class="tip-row"><span class="tip-k">发布后</span><span class="tip-v">'+m+' 个月</span></div>'+
            '<div class="tip-row"><span class="tip-k">相对在线</span><span class="tip-v">'+fmt.pct(d.data[m]*100)+'</span></div>'
          , ev);
        }
      })
      .on("mouseleave",function(){ cursor.style("display","none"); dotsG.selectAll(".cdot").remove(); TIP.hide(); if(!highlighted) highlightLine(null); });

    buildLegend();
  }

  function highlightLine(name, sticky) {
    if (sticky !== undefined) {
      highlighted = sticky ? name : null;
    }
    if (sticky) highlighted = name;

    g&&g.selectAll(".dline").transition().duration(200)
      .attr("opacity",function(d){return name?(d.name===name?1:0.07):0.75;})
      .attr("stroke-width",function(d){return name&&d.name===name?3.5:((TYPE_STYLE[d.type]||{}).width||2);});

    // Update inline labels
    g&&g.selectAll(".decay-inline-label").transition().duration(200)
      .attr("opacity", function() {
        var text = d3.select(this).text();
        if (!name) return 0.7;
        // Check if this label belongs to highlighted game
        var match = DATA.decay.find(function(d) {
          var t = d.name.length > 14 ? d.name.slice(0,12)+"…" : d.name;
          return t === text;
        });
        return match && match.name === name ? 0.9 : 0;
      });

    document.querySelectorAll(".dl-item").forEach(function(el){
      el.classList.toggle("active", el.dataset.name===name);
    });

    // If sticky, redraw for full z-order fix
    if (sticky !== undefined) { firstDraw = false; draw(); }
  }

  function buildLegend() {
    var leg=document.getElementById("decay-legend");
    leg.innerHTML="";

    // Group by type with headers
    var typeOrder = ["AAA", "AA", "Indie", "F2P"];
    var groups = {};
    DATA.decay.forEach(function(d) {
      if (!groups[d.type]) groups[d.type] = [];
      groups[d.type].push(d);
    });

    typeOrder.forEach(function(type) {
      if (!groups[type] || groups[type].length === 0) return;
      var style = TYPE_STYLE[type] || {};

      // Type header
      var header = document.createElement("div");
      header.className = "dl-type-header";
      header.style.color = C[type] || "#888";
      header.innerHTML = '<span class="dl-type-line" style="border-color:' + (C[type]||"#888") + 
        (style.dash ? ';border-style:dashed' : '') + '"></span>' + style.label;
      leg.appendChild(header);

      groups[type].forEach(function(d) {
        var el=document.createElement("div");
        el.className="dl-item"+(highlighted===d.name?" active":"");
        el.dataset.name=d.name;
        el.innerHTML='<div class="dl-swatch" style="background:'+d.color+'"></div>'+d.name+' <span style="opacity:0.5">'+d.yr+'</span>';
        el.addEventListener("click",function(){
          highlighted===d.name ? highlightLine(null, true) : highlightLine(d.name, true);
        });
        leg.appendChild(el);
      });
    });
  }

  // Controls
  document.querySelectorAll("[data-dr]").forEach(function(b){
    b.addEventListener("click",function(){
      document.querySelectorAll("[data-dr]").forEach(function(x){x.classList.remove("active");});
      this.classList.add("active");
      showRef=this.dataset.dr==="on";
      firstDraw = false;
      draw();
    });
  });

  draw();
  window._decayRedraw = function() { firstDraw = false; draw(); };
};
// ════════════════════════════════════════════════