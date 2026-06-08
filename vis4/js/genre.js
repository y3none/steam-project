//  VIEW 6: GENRE OPPORTUNITY MAP — 该做一款什么游戏（面向从业者的决策视图）
//  自包含：自己拉取 genre_opportunity.json（同 decay 聚合的方式），失败则用内嵌示例。
// ════════════════════════════════════════════════
(function () {
  // ── 内嵌兜底样本（无 genre_opportunity.json 时仍可演示；真实数据会覆盖）──
  const SAMPLE_OVERALL = [
    ["Roguelite",1200,0.10,410,0.06,0.87,0.22],["Roguelike",1800,0.09,520,0.05,0.86,0.18],
    ["Open World",2600,0.12,1900,0.09,0.80,0.05],["Survival",2200,0.08,980,0.05,0.74,0.10],
    ["Souls-like",700,0.14,260,0.08,0.82,0.30],["Farming Sim",600,0.16,180,0.06,0.85,0.12],
    ["Visual Novel",6000,0.03,320,0.01,0.88,0.06],["Deckbuilder",900,0.10,240,0.05,0.84,0.20],
    ["Horror",5200,0.05,540,0.02,0.78,0.14],["Idle / Clicker",1400,0.06,220,0.02,0.80,-0.05],
    ["City Builder",800,0.13,230,0.06,0.83,0.08],["Metroidvania",1100,0.07,190,0.03,0.85,0.10],
    ["Battle Royale",180,0.20,220,0.10,0.70,-0.20],["MOBA",150,0.12,180,0.08,0.72,-0.25],
    ["Extraction Shooter",90,0.30,60,0.12,0.71,0.35],["Cozy",950,0.11,190,0.05,0.88,0.28],
    ["Puzzle",7000,0.04,480,0.01,0.86,-0.02],["Platformer",4800,0.05,430,0.02,0.83,-0.03],
    ["RPG",5500,0.08,1500,0.05,0.82,0.04],["Shooter",3800,0.07,900,0.04,0.76,-0.02],
    ["Tower Defense",700,0.07,130,0.03,0.82,-0.04],["Auto Battler",200,0.09,40,0.04,0.79,-0.10],
  ];
  const MULT = {
    All:  {c:1,    o:1,    t:1,    h:1   },
    Indie:{c:.72,  o:.55,  t:.34,  h:.45 },
    AA:   {c:.14,  o:1.7,  t:.26,  h:1.6 },
    AAA:  {c:.035, o:4.2,  t:.42,  h:3.0 },
    F2P:  {c:.05,  o:2.6,  t:.30,  h:2.2 },
  };
  function buildFallback() {
    const genres = SAMPLE_OVERALL.map(function (a) {
      var tag=a[0],c=a[1],o=a[2],tot=a[3],h=a[4],pos=a[5],tr=a[6];
      var scopes = {};
      for (var s in MULT) { var m = MULT[s];
        scopes[s] = { count: Math.max(8, Math.round(c*m.c)), median_owners_m: +(o*m.o).toFixed(3),
          total_owners_m: +(tot*m.t).toFixed(1), hit_rate: Math.min(.6, +(h*m.h).toFixed(3)),
          median_pos: pos, trend: Math.max(-.6, Math.min(.6, tr + (s==="F2P"?-.05:s==="Indie"?.03:0))) };
      }
      return { tag: tag, scopes: scopes };
    });
    return { meta: { source: "内嵌示例数据" }, genres: genres, _fallback: true };
  }

  // 把真实 json 或兜底统一成 {tag, scopes:{All,Indie,AA,AAA,F2P}}
  function normalize(raw) {
    if (raw && raw.genres && raw.genres[0] && raw.genres[0].scopes) return raw; // 已是兜底结构
    var genres = (raw.genres || []).map(function (g) {
      var scopes = { All: g.overall };
      ["Indie","AA","AAA","F2P"].forEach(function (t) { if (g.by_type && g.by_type[t]) scopes[t] = g.by_type[t]; });
      return { tag: g.tag, scopes: scopes };
    });
    return { meta: raw.meta || {}, genres: genres };
  }

  var DATA_G = null, scope = "All", gtip = null;

  function ensureTip() {
    if (gtip) return gtip;
    gtip = document.createElement("div");
    gtip.id = "genre-tip";
    gtip.style.cssText = "position:fixed;pointer-events:none;z-index:60;opacity:0;transition:opacity .12s;" +
      "background:#15151f;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:11px 13px;max-width:250px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.6);font-size:12px;font-family:'Noto Sans SC',sans-serif;color:#e8e8f0";
    document.body.appendChild(gtip);
    return gtip;
  }

  function trendColor(t) {
    var x = Math.max(-.4, Math.min(.4, t)) / 0.4;       // -1..1
    var cool=[61,127,255], mid=[106,106,138], hot=[255,107,61];
    var a = x < 0 ? cool : hot, k = Math.abs(x);
    return "rgb(" + Math.round(mid[0]+(a[0]-mid[0])*k) + "," + Math.round(mid[1]+(a[1]-mid[1])*k) + "," + Math.round(mid[2]+(a[2]-mid[2])*k) + ")";
  }
  function quadrant(d, mx, my) {
    var hiSup = d.count >= mx, hiDem = d.median_owners_m >= my;
    if (hiDem && !hiSup) return { name: "蓝海机会", col: "#1de9b6" };
    if (hiDem && hiSup)  return { name: "红海热门", col: "#ffd54f" };
    if (!hiDem && !hiSup) return { name: "小众/未验证", col: "#8080a0" };
    return { name: "过度饱和", col: "#ff5252" };
  }
  function fmtOwn(v) { return v >= 1 ? v.toFixed(2) + "M" : Math.round(v*1000) + "k"; }

  function render() {
    var wrap = document.getElementById("genre-inner");
    if (!wrap || !DATA_G) return;
    wrap.innerHTML = "";
    var rows = DATA_G.genres.map(function (x) {
      var s = x.scopes[scope]; return s ? Object.assign({ tag: x.tag }, s) : null;
    }).filter(function (d) { return d && d.count; });

    var W = wrap.clientWidth || 720, H = Math.max(330, Math.min(460, W * 0.5));
    var M = { t: 24, r: 26, b: 50, l: 58 }, iW = W - M.l - M.r, iH = H - M.t - M.b;
    var svg = d3.select(wrap).append("svg").attr("viewBox", "0 0 " + W + " " + H).attr("height", H).style("width", "100%");
    var g = svg.append("g").attr("transform", "translate(" + M.l + "," + M.t + ")");

    if (!rows.length) {
      g.append("text").attr("x", iW/2).attr("y", iH/2).attr("fill", "#8080a0").attr("text-anchor", "middle")
        .attr("font-family", "'Space Mono',monospace").text("该工作室规模下样本不足");
      buildLegend([]); return;
    }

    var x = d3.scaleLog().domain([d3.min(rows, function(d){return d.count;})*0.8, d3.max(rows, function(d){return d.count;})*1.15]).range([0, iW]);
    var y = d3.scaleLog().domain([Math.max(0.005, d3.min(rows, function(d){return d.median_owners_m;})*0.8), d3.max(rows, function(d){return d.median_owners_m;})*1.2]).range([iH, 0]);
    var r = d3.scaleSqrt().domain([0, d3.max(rows, function(d){return d.total_owners_m;})]).range([4, 38]);
    var mx = d3.median(rows, function(d){return d.count;}), my = d3.median(rows, function(d){return d.median_owners_m;});

    // 象限底色
    g.append("rect").attr("x",0).attr("y",0).attr("width",x(mx)).attr("height",y(my)).attr("fill","rgba(29,233,182,.045)");
    g.append("rect").attr("x",x(mx)).attr("y",y(my)).attr("width",iW-x(mx)).attr("height",iH-y(my)).attr("fill","rgba(255,82,82,.045)");
    // 中位分隔线
    g.append("line").attr("x1",x(mx)).attr("x2",x(mx)).attr("y1",0).attr("y2",iH).attr("stroke","rgba(255,255,255,.08)").attr("stroke-dasharray","3,4");
    g.append("line").attr("x1",0).attr("x2",iW).attr("y1",y(my)).attr("y2",y(my)).attr("stroke","rgba(255,255,255,.08)").attr("stroke-dasharray","3,4");
    // 象限标签
    var QL = "font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px";
    g.append("text").attr("x",6).attr("y",13).attr("style",QL).attr("fill","#1de9b6").text("◤ 蓝海机会");
    g.append("text").attr("x",iW-6).attr("y",13).attr("text-anchor","end").attr("style",QL).attr("fill","#ffd54f").text("红海热门 ◥");
    g.append("text").attr("x",6).attr("y",iH-6).attr("style",QL).attr("fill","#50506a").text("◣ 小众/未验证");
    g.append("text").attr("x",iW-6).attr("y",iH-6).attr("text-anchor","end").attr("style",QL).attr("fill","#ff5252").text("过度饱和 ◢");

    // 轴
    g.append("g").attr("transform","translate(0,"+iH+")").call(d3.axisBottom(x).ticks(5,"~s"))
      .call(styleAxis);
    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(function(d){return d>=1?d+"M":(d*1000)+"k";}))
      .call(styleAxis);
    var AT = "fill:#50506a;font-family:'Space Mono',monospace;font-size:11px";
    g.append("text").attr("x",iW).attr("y",iH+40).attr("text-anchor","end").attr("style",AT).text("供给：在售游戏数（对数）→ 越右竞争越激烈");
    g.append("text").attr("transform","rotate(-90)").attr("x",0).attr("y",-44).attr("text-anchor","end").attr("style",AT).text("需求：中位拥有量（对数）→ 越上典型结局越好");

    // 气泡
    var node = g.selectAll(".gbub").data(rows).join("g").attr("class","gbub")
      .attr("transform", function(d){ return "translate(" + x(d.count) + "," + y(d.median_owners_m) + ")"; })
      .style("cursor","pointer");
    node.append("circle").attr("r",0).attr("fill", function(d){return trendColor(d.trend);}).attr("fill-opacity",.55)
      .attr("stroke", function(d){return trendColor(d.trend);}).attr("stroke-width",1.2)
      .transition().duration(650).delay(function(d,i){return i*20;}).attr("r", function(d){return r(d.total_owners_m);});

    var labeled = {};
    rows.slice().sort(function(a,b){return b.total_owners_m-a.total_owners_m;}).slice(0,11).forEach(function(d){ labeled[d.tag]=1; });
    node.filter(function(d){return labeled[d.tag];}).append("text").attr("text-anchor","middle")
      .attr("dy", function(d){return -r(d.total_owners_m)-4;}).attr("fill","#e8e8f0")
      .attr("font-family","'Noto Sans SC',sans-serif").attr("font-size",10).attr("pointer-events","none")
      .text(function(d){return d.tag;}).attr("opacity",0).transition().delay(550).duration(380).attr("opacity",1);

    var tip = ensureTip();
    node.on("mousemove", function (ev, d) {
      var q = quadrant(d, mx, my);
      tip.innerHTML =
        '<div style="font-weight:700;font-size:14px;margin-bottom:6px">' + d.tag + '</div>' +
        '<div style="font-family:\'Space Mono\',monospace;font-size:11px;padding:2px 8px;border-radius:5px;display:inline-block;margin-bottom:8px;background:' + q.col + '22;color:' + q.col + ';border:1px solid ' + q.col + '55">' + q.name + '</div>' +
        row("供给(竞争)", d.count.toLocaleString() + " 款") +
        row("中位拥有量", fmtOwn(d.median_owners_m)) +
        row("命中率(≥1M)", Math.round(d.hit_rate*100) + "%") +
        (d.median_pos != null ? row("中位好评率", Math.round(d.median_pos*100) + "%") : "") +
        row("市场总规模", Math.round(d.total_owners_m) + "M") +
        rowC("趋势", (d.trend>0?"升温 +":"") + d.trend.toFixed(2), trendColor(d.trend));
      tip.style.left = Math.min(ev.clientX + 16, window.innerWidth - 270) + "px";
      tip.style.top = (ev.clientY + 14) + "px";
      tip.style.opacity = 1;
      d3.select(this).select("circle").attr("fill-opacity", .85);
    }).on("mouseleave", function () { tip.style.opacity = 0; d3.select(this).select("circle").attr("fill-opacity", .55); });

    buildLegend(rows);
  }

  function row(k, v) { return '<div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;color:#8080a0"><span>' + k + '</span><b style="color:#e8e8f0;font-family:\'Space Mono\',monospace">' + v + '</b></div>'; }
  function rowC(k, v, c) { return '<div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;color:#8080a0"><span>' + k + '</span><b style="color:' + c + ';font-family:\'Space Mono\',monospace">' + v + '</b></div>'; }
  function styleAxis(sel) {
    sel.selectAll("text").attr("fill", "#8080a0").attr("font-family", "'Space Mono',monospace").attr("font-size", "10px");
    sel.selectAll("line,path").attr("stroke", "rgba(255,255,255,.08)");
  }

  function buildLegend(rows) {
    var leg = document.getElementById("genre-legend");
    if (!leg) return;
    leg.innerHTML = "";
    var note = document.createElement("div");
    note.className = "dl-type-header";
    note.style.cssText = "color:rgba(255,255,255,.45);font-size:11px;margin-bottom:4px";
    var src = (DATA_G && DATA_G._fallback) ? "内嵌示例数据（运行 07_genre_opportunity.py 生成真实数据）" : "STEAMSPY tags 聚合 · 中位拥有量=典型结局（非均值）";
    note.innerHTML = "读法：<b style='color:#1de9b6'>左上=蓝海机会</b>（需求高·对手少），<b style='color:#ff5252'>右下=过度饱和</b>（慎入）；气泡越大=市场越大，颜色越暖=近年越多人涌入。 · " + src;
    leg.appendChild(note);
  }

  function syncPills() {
    document.querySelectorAll("#sec-genre [data-gs]").forEach(function (b) {
      b.classList.toggle("active", b.dataset.gs === scope);
    });
  }
  function bindPills() {
    document.querySelectorAll("#sec-genre [data-gs]").forEach(function (b) {
      b.addEventListener("click", function () { scope = this.dataset.gs; syncPills(); render(); });
    });
  }

  window.initGenre = function () {
    (async function () {
      var resp = null;
      try {
        if (typeof API_BASE !== "undefined") {
          try { var r = await fetch(API_BASE + "/genre_opportunity"); if (r.ok) resp = await r.json(); } catch (e) {}
        }
        if (!resp) { try { var r2 = await fetch("../data/processed/genre_opportunity.json"); if (r2.ok) resp = await r2.json(); } catch (e) {} }
      } catch (e) {}
      if (resp && resp.genres && resp.genres.length) {
        DATA_G = normalize(resp);
        console.log("[genre] opportunity data loaded: " + DATA_G.genres.length + " genres");
      } else {
        DATA_G = buildFallback();
        console.info("[genre] using embedded sample (run 07_genre_opportunity.py for real data)");
      }
      bindPills(); syncPills(); render();
    })();
  };

  // 供导览 / 联动调用：切换工作室规模
  window._genreSetScope = function (s) { if (!MULT[s]) return; scope = s; syncPills(); render(); };
  window._genreRedraw = function () { if (DATA_G) render(); };
})();
