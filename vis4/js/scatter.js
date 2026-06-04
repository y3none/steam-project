//  VIEW 2: BUBBLE SCATTER
// ════════════════════════════════════════════════
window.initScatter = function() {
  const MG={t:20,r:24,b:48,l:66};
  let activeFilter="all", selected=null, yearFilter=null;
  let activeTag=null;
  let searchMode="name"; // "name" or "tag"
  let searchTerm="", hoverGame=null;
  let svg,g,xSc,ySc,rSc,iW,iH;

  const searchInput   = document.getElementById("scatter-search");
  const searchResults = document.getElementById("search-results");

  // ══ TAG FILTER SYSTEM ══════════════════════════

  function buildTagStats() {
    const counts = {};
    DATA.bubbles.forEach(d => {
      (d.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    return counts;
  }

  function updateTagUI() {
    document.querySelectorAll("[data-tag]").forEach(b => {
      b.classList.toggle("active", b.dataset.tag === (activeTag || ""));
    });
    document.querySelectorAll(".tag-dropdown-item").forEach(el => {
      el.classList.toggle("active", el.dataset.tag === activeTag);
    });
  }

  function setupTagFilter() {
    const counts = buildTagStats();
    const bar = document.getElementById("tag-filter-bar");
    const dropdown = document.getElementById("tag-dropdown");
    if (!bar || !dropdown) return;

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // Buttons: tags with count > 20
    sorted.forEach(([tag, count]) => {
      if (count <= 20) return;
      const btn = document.createElement("button");
      btn.className = "pill";
      btn.dataset.tag = tag;
      btn.textContent = tag;
      btn.addEventListener("click", () => {
        activeTag = activeTag === tag ? null : tag;
        selected = null; hoverGame = null;
        showDetailPanel(null);
        updateTagUI();
        draw();
      });
      bar.appendChild(btn);
    });

    // Dropdown: all tags
    sorted.forEach(([tag, count]) => {
      const el = document.createElement("div");
      el.className = "tag-dropdown-item";
      el.dataset.tag = tag;
      el.innerHTML = `<span>${tag}</span><span class="tag-count">${count}</span>`;
      el.addEventListener("click", () => {
        activeTag = activeTag === tag ? null : tag;
        selected = null; hoverGame = null;
        showDetailPanel(null);
        updateTagUI();
        draw();
        dropdown.classList.remove("open");
      });
      dropdown.appendChild(el);
    });

    // Click outside to close dropdown
    document.addEventListener("click", e => {
      if (!e.target.closest("#tag-dropdown-wrap")) dropdown.classList.remove("open");
    });
  }

  // ══ SEARCH SYSTEM (unified: game name + tag search) ══════

  function setupSearch() {
    let debounce;

    // Search mode toggle buttons
    document.querySelectorAll("[data-search-mode]").forEach(b => {
      b.addEventListener("click", function() {
        document.querySelectorAll("[data-search-mode]").forEach(x => x.classList.remove("active"));
        this.classList.add("active");
        searchMode = this.dataset.searchMode;
        searchInput.placeholder = searchMode === "tag" ? "搜索标签..." : "搜索游戏名...";
        searchInput.value = "";
        searchTerm = "";
        activeTag = null;
        updateTagUI();
        closeDropdown();
        draw();
        searchInput.focus();
      });
    });

    searchInput.addEventListener("input", function(){
      clearTimeout(debounce);
      debounce = setTimeout(()=>{
        searchTerm = this.value.trim();
        selected = null; hoverGame = null;
        showDetailPanel(null);
        if(searchMode === "tag") {
          // Tag search mode: filter dropdown
          showTagDropdown(searchTerm);
        } else {
          if(searchTerm) showDropdown(); else closeDropdown();
        }
        draw();
      }, 150);
    });
    searchInput.addEventListener("focus", ()=>{
      if(searchMode === "tag") {
        showTagDropdown(searchTerm);
      } else {
        if(searchTerm) showDropdown();
      }
    });
    document.addEventListener("click", e=>{ if(!e.target.closest("#search-wrap")) closeDropdown(); });

    searchInput.addEventListener("keydown", e=>{
      if(searchMode === "tag") return; // tag mode uses click only
      if(!searchResults.classList.contains("open")) return;
      const items = searchResults.querySelectorAll(".search-item[data-name]");
      const active = searchResults.querySelector(".search-item.kb-active");
      let idx = active ? [...items].indexOf(active) : -1;

      if(e.key==="Escape"){ closeDropdown(); searchInput.blur(); }
      else if(e.key==="ArrowDown"){
        e.preventDefault(); idx = Math.min(idx+1, items.length-1);
        items.forEach(el=>el.classList.remove("kb-active"));
        if(items[idx]){ items[idx].classList.add("kb-active"); items[idx].scrollIntoView({block:"nearest"}); }
        const name = items[idx]?.dataset.name;
        const d = name && DATA.bubbles.find(x=>x.name===name);
        previewGame(d||null);
      } else if(e.key==="ArrowUp"){
        e.preventDefault(); idx = Math.max(idx-1, 0);
        items.forEach(el=>el.classList.remove("kb-active"));
        if(items[idx]){ items[idx].classList.add("kb-active"); items[idx].scrollIntoView({block:"nearest"}); }
        const name = items[idx]?.dataset.name;
        const d = name && DATA.bubbles.find(x=>x.name===name);
        previewGame(d||null);
      } else if(e.key==="Enter"){
        e.preventDefault();
        if(active) active.click(); else if(items[0]) items[0].click();
      }
    });
  }

  function showTagDropdown(query) {
    const dropdown = document.getElementById("tag-dropdown");
    const searchResults = document.getElementById("search-results");
    if (!dropdown) return;
    const q = (query || "").toLowerCase();
    dropdown.querySelectorAll(".tag-dropdown-item").forEach(el => {
      el.style.display = el.dataset.tag.toLowerCase().includes(q) ? "" : "none";
    });
    dropdown.classList.add("open");
    if (searchResults) searchResults.classList.remove("open");
  }

  function fuzzyMatch(name, query){
    const lo = name.toLowerCase(), q = query.toLowerCase();
    if(lo.includes(q)) return true;
    let qi=0;
    for(let i=0;i<lo.length&&qi<q.length;i++) if(lo[i]===q[qi]) qi++;
    return qi===q.length;
  }
  function highlightChars(text, query){
    const lo=text.toLowerCase(), q=query.toLowerCase(), idx=lo.indexOf(q);
    if(idx>=0) return text.slice(0,idx)+'<mark>'+text.slice(idx,idx+q.length)+'</mark>'+text.slice(idx+q.length);
    let r='',qi=0;
    for(let i=0;i<text.length;i++){
      if(qi<q.length&&text[i].toLowerCase()===q[qi]){r+='<mark>'+text[i]+'</mark>';qi++;}
      else r+=text[i];
    }
    return r;
  }

  function showDropdown(){
    const q = searchTerm;
    const matches = DATA.bubbles.filter(d=>fuzzyMatch(d.name,q)).slice(0,8);
    if(!matches.length){
      searchResults.innerHTML=`<div class="search-no-result">无匹配结果</div>`;
      searchResults.classList.add("open"); return;
    }
    searchResults.innerHTML = matches.map(d=>
      `<div class="search-item" data-name="${d.name.replace(/"/g,'&quot;')}">
        <span class="search-item-name">${highlightChars(d.name,q)}</span>
        <span class="search-item-type" style="color:${C[d.type]||'#888'}">${d.type}</span>
      </div>`
    ).join("");
    searchResults.classList.add("open");

    // Bind hover → preview bubble
    searchResults.querySelectorAll(".search-item[data-name]").forEach(el=>{
      el.addEventListener("mouseenter", ()=>{
        const d = DATA.bubbles.find(x=>x.name===el.dataset.name);
        if(d) previewGame(d);
      });
      el.addEventListener("mouseleave", ()=>{ previewGame(null); });
      el.addEventListener("click", ()=>{
        const d = DATA.bubbles.find(x=>x.name===el.dataset.name);
        if(d) selectFromSearch(d);
      });
    });
  }

  function closeDropdown(){
    searchResults.classList.remove("open");
    searchResults.innerHTML="";
  }

  // Preview: temporarily highlight a bubble (from dropdown hover / keyboard)
  function previewGame(d){
    hoverGame = d;
    if(!g) return;
    // Update bubble opacities
    g.selectAll(".bub").transition().duration(150)
      .attr("opacity", dd=>{
        if(d) return dd===d?1:0.12;
        if(searchTerm) return fuzzyMatch(dd.name,searchTerm)?0.75:0.08;
        return dd.ccu>100000?0.85:0.65;
      })
      .attr("r", dd=> d&&dd===d ? rSc(dd.own)*1.15 : rSc(dd.own));
    // Show/remove label and ring for previewed game
    g.selectAll(".preview-label,.preview-ring").remove();
    if(d){
      const cx=xSc(d.pr), cy=ySc(Math.max(1,d.ccu)), r=rFn(d);
      g.append("text").attr("class","preview-label")
        .attr("x",cx).attr("y",cy-r-7).attr("text-anchor","middle")
        .attr("fill","#fff").attr("font-size",10).attr("font-weight","700")
        .attr("font-family","'Space Mono',monospace").attr("pointer-events","none")
        .text(d.name.length>18?d.name.slice(0,16)+"…":d.name);
      g.append("circle").attr("class","preview-ring search-ring-pulse")
        .attr("cx",cx).attr("cy",cy).attr("r",r+6);
    }
  }

  function selectFromSearch(d){
    closeDropdown();
    searchInput.value = d.name;
    searchTerm = d.name;
    hoverGame = null;
    // Switch filter if needed
    if(activeFilter!=="all" && d.type!==activeFilter){
      activeFilter="all";
      document.querySelectorAll("[data-sf]").forEach(x=>x.classList.remove("active"));
      document.querySelector('[data-sf="all"]').classList.add("active");
    }
    if(yearFilter && d.yr!==yearFilter){
      // User clicked a dimmed bubble outside year filter — clear the filter
      setYearFilter(null);
      EVT.emit("yearSelect", null);
    }
    selected = d;
    draw();
    showDetailPanel(d);
  }

  function resetAll(){
    selected=null; hoverGame=null; searchTerm="";
    activeTag=null;
    searchInput.value="";
    closeDropdown();
    TIP.hide();
    showDetailPanel(null);
    updateTagUI();
    draw();
  }

  // ══ DATA HELPERS ═══════════════════════════════

  function getFilteredData(){
    let data = DATA.bubbles;
    if(activeFilter!=="all") data=data.filter(d=>d.type===activeFilter);
    if(yearFilter) data=data.filter(d=>d.yr===yearFilter);
    if(activeTag) data=data.filter(d=>(d.tags||[]).includes(activeTag));
    return data;
  }

  function bubbleOpacity(d){
    if(selected) return d===selected?1:0.06;
    if(hoverGame) return d===hoverGame?1:0.12;
    if(searchTerm && searchMode==="name") return fuzzyMatch(d.name,searchTerm)?0.75:0.08;
    return d.ccu>100000?0.85:0.65;
  }

  // ══ DRAW ═══════════════════════════════════════

  function draw(){
    const wrap=document.getElementById("scatter-inner");
    wrap.innerHTML="";
    const W=wrap.clientWidth, H=Math.max(500,Math.min(700,W*0.55));
    iW=W-MG.l-MG.r; iH=H-MG.t-MG.b;

    svg=d3.select(wrap).append("svg").attr("viewBox",`0 0 ${W} ${H}`).attr("height",H);
    g=svg.append("g").attr("transform",`translate(${MG.l},${MG.t})`);

    xSc=d3.scaleLinear().domain([40,100]).range([0,iW]);
    ySc=d3.scaleLog().domain([2,4800000]).range([iH,0]).clamp(true);
    const n=DATA.bubbles.length;
    const maxR=n>500?18:n>300?24:n>150?36:n>60?44:50;
    rSc=d3.scalePow().exponent(0.35).domain([0, 80]).range([3, maxR]);
    const rFn = d => d.own > 0.01 ? rSc(d.own) : 3;

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

    if(yearFilter){
      g.append("text").attr("x",4).attr("y",14)
        .attr("fill","rgba(29,233,182,0.4)").attr("font-family","'Space Mono',monospace").attr("font-size",10)
        .text("筛选："+yearFilter+" 年发布");
    }

    const show=getFilteredData();
    const hide=DATA.bubbles.filter(d=>!show.includes(d));

    // Background dimmed
    g.selectAll(".bub-dim").data(hide.sort((a,b)=>b.own-a.own)).join("circle")
      .attr("class","bub-dim")
      .attr("cx",d=>xSc(d.pr)).attr("cy",d=>ySc(Math.max(1,d.ccu)))
      .attr("r",d=>rFn(d)).attr("fill",d=>C[d.type]||"#888")
      .attr("opacity",0.04).attr("stroke","none");

    // Active bubbles
    g.selectAll(".bub").data(show.sort((a,b)=>b.own-a.own),d=>d.name).join(
      enter=>enter.append("circle").attr("class","bub")
        .attr("cx",d=>xSc(d.pr)).attr("cy",d=>ySc(Math.max(1,d.ccu)))
        .attr("r",0)
        .attr("fill",d=>C[d.type]||"#888")
        .attr("stroke",d=>d3.color(C[d.type]||"#888").darker(0.8))
        .attr("stroke-width",1).attr("opacity",0).style("cursor","pointer")
        .call(en=>en.transition().duration(600).ease(d3.easeCubicOut)
          .attr("r",d=>selected===d?rFn(d)*1.15:rFn(d))
          .attr("opacity",bubbleOpacity)),
      update=>update.call(up=>up.transition().duration(400)
        .attr("cx",d=>xSc(d.pr)).attr("cy",d=>ySc(Math.max(1,d.ccu)))
        .attr("r",d=>selected===d?rFn(d)*1.15:rFn(d))
        .attr("opacity",bubbleOpacity)),
      exit=>exit.call(ex=>ex.transition().duration(300).attr("r",0).attr("opacity",0).remove())
    );

    // Bind events
    setTimeout(()=>{
      g.selectAll(".bub")
        .on("mousemove",function(ev,d){
          if(selected===d) return;
          d3.select(this).transition().duration(100).attr("r",rFn(d)*1.12);
          TIP.show(`<strong>${d.name}</strong>
            <div class="tip-row"><span class="tip-k">类型</span><span class="tip-v" style="color:${C[d.type]}">${TL[d.type]}</span></div>
            <div class="tip-row"><span class="tip-k">发行年</span><span class="tip-v">${d.yr||"—"}</span></div>
            <div class="tip-row"><span class="tip-k">好评率</span><span class="tip-v">${fmt.pct(d.pr)}</span></div>
            <div class="tip-row"><span class="tip-k">峰值在线</span><span class="tip-v">${fmt.ccu(d.ccu)}</span></div>
            <div class="tip-row"><span class="tip-k">估算拥有</span><span class="tip-v">${fmt.own(d.own)}</span></div>
            <div class="tip-row"><span class="tip-k">定价</span><span class="tip-v">${fmt.price(d.price)}</span></div>
          `, ev);
        })
        .on("mouseleave",function(ev,d){
          if(selected!==d){d3.select(this).transition().duration(100).attr("r",rFn(d));TIP.hide();}
        })
        .on("click",function(ev,d){
          ev.stopPropagation();
          if(selected===d){ resetAll(); }
          else {
            selected=d; hoverGame=null; TIP.hide();
            searchInput.value=d.name; searchTerm=d.name; closeDropdown();
            g.selectAll(".bub").transition().duration(300)
              .attr("opacity",dd=>dd===d?1:0.06)
              .attr("r",dd=>dd===d?rSc(dd.own)*1.18:rSc(dd.own));
            // Show label only for selected
            g.selectAll(".sel-label,.sel-ring").remove();
            const cx=xSc(d.pr),cy=ySc(Math.max(1,d.ccu)),r=rFn(d);
            g.append("text").attr("class","sel-label")
              .attr("x",cx).attr("y",cy-r*1.18-7).attr("text-anchor","middle")
              .attr("fill","#fff").attr("font-size",10).attr("font-weight","700")
              .attr("font-family","'Space Mono',monospace").attr("pointer-events","none")
              .text(d.name.length>18?d.name.slice(0,16)+"…":d.name);
            g.append("circle").attr("class","sel-ring search-ring-pulse")
              .attr("cx",cx).attr("cy",cy).attr("r",r*1.18+6);
            showDetailPanel(d);
          }
        });
    },50);

    // If a game is selected on redraw, show its label and ring
    if(selected){
      const d=selected, inShow=show.find(x=>x.name===d.name);
      if(inShow){
        const cx=xSc(d.pr),cy=ySc(Math.max(1,d.ccu)),r=rFn(d);
        g.append("text").attr("class","sel-label")
          .attr("x",cx).attr("y",cy-r*1.15-7).attr("text-anchor","middle")
          .attr("fill","#fff").attr("font-size",10).attr("font-weight","700")
          .attr("font-family","'Space Mono',monospace").attr("pointer-events","none")
          .text(d.name.length>18?d.name.slice(0,16)+"…":d.name);
        g.append("circle").attr("class","sel-ring search-ring-pulse")
          .attr("cx",cx).attr("cy",cy).attr("r",r*1.15+6);
      }
    }

    // Search rings (when typing but no specific game selected)
    if(searchTerm && !selected && !hoverGame){
      const matched=show.filter(d=>fuzzyMatch(d.name,searchTerm));
      g.selectAll(".search-ring").data(matched,d=>d.name).join("circle")
        .attr("class","search-ring")
        .attr("cx",d=>xSc(d.pr)).attr("cy",d=>ySc(Math.max(1,d.ccu)))
        .attr("r",d=>rFn(d)+4)
        .attr("fill","none").attr("stroke","#fff").attr("stroke-width",1.5)
        .attr("stroke-dasharray","3,2").attr("opacity",0.5).style("pointer-events","none");
    }

    // NO labels in default view — only show via select/hover/search

    // Click outside → full reset
    svg.on("click",()=>{ resetAll(); });
  }

  // ══ DETAIL PANEL ═══════════════════════════════

  function showDetailPanel(d){
    const p=document.getElementById("detail-panel");
    if(!d){
      p.innerHTML=`<div class="detail-empty"><div class="detail-empty-icon">◎</div><div class="detail-empty-text">点击任意气泡<br>查看游戏详情</div></div>`;
      return;
    }
    const col=C[d.type]||"#888";
    const imgUrl=d.header_image||d.img||"";
    const defaultImg="../images/banner.png";
    const imgHtml=imgUrl
      ?`<img class="detail-header-img" src="${imgUrl}" alt="${d.name}" onerror="this.onerror=null;this.src='${defaultImg}'">`
      :`<img class="detail-header-img" src="${defaultImg}" alt="default">`;

    // Check if this game exists in decay data
    const hasDecay = DATA.decay.some(x => x.name === d.name);
    const decayBtnHtml = hasDecay
      ? `<button class="detail-decay-btn" id="btn-jump-decay">📉 查看生命周期曲线 ↓</button>`
      : '';

    p.innerHTML=`
      ${imgHtml}
      <div class="detail-game-name">${d.name}</div>
      <div class="detail-type" style="color:${col}">${TL[d.type]||d.type} · ${d.yr||"—"}</div>
      <div class="detail-row"><span class="detail-key">好评率</span><span class="detail-val" style="color:${col}">${fmt.pct(d.pr)}</span></div>
      <div class="detail-row"><span class="detail-key">峰值在线</span><span class="detail-val">${fmt.ccu(d.ccu)}</span></div>
      <div class="detail-row"><span class="detail-key">估算拥有</span><span class="detail-val">${fmt.own(d.own)}</span></div>
      <div class="detail-row"><span class="detail-key">定价</span><span class="detail-val">${fmt.price(d.price)}</span></div>
      <div class="detail-row"><span class="detail-key">评价总数</span><span class="detail-val">${fmt.num(d.rc)}</span></div>
      <div class="detail-row"><span class="detail-key">开发商</span><span class="detail-val" style="font-size:10px">${(d.dev&&d.dev[0])||"—"}</span></div>
      <div class="detail-tags">${(d.tags||[]).map(t=>`<span class="detail-tag">${t}</span>`).join("")}</div>
      ${decayBtnHtml}
    `;

    // Bind decay jump button
    const jumpBtn = document.getElementById("btn-jump-decay");
    if (jumpBtn) {
      jumpBtn.addEventListener("click", function() {
        // Emit event for decay.js to highlight this game
        EVT.emit("decayHighlight", d.name);
        // Scroll to decay section
        const decaySection = document.getElementById("decay-inner") || document.querySelector('[data-view="decay"]');
        if (decaySection) {
          decaySection.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }
  }

  // ══ FILTER BUTTONS ═════════════════════════════

  document.querySelectorAll("[data-sf]").forEach(b=>{
    b.addEventListener("click",function(){
      document.querySelectorAll("[data-sf]").forEach(x=>x.classList.remove("active"));
      this.classList.add("active");
      activeFilter=this.dataset.sf;
      selected=null; hoverGame=null; searchTerm=""; searchInput.value="";
      activeTag=null; yearFilter=null;
      yearSelect.value = "";
      updateTagUI();
      // Reset year indicator
      const indicator = document.getElementById("year-indicator");
      if(indicator) indicator.style.display = "none";
      closeDropdown(); showDetailPanel(null); draw();
      // Notify stream graph
      _selfEmit = true;
      EVT.emit("yearSelect", null);
      _selfEmit = false;
    });
  });

  // Cross-view year linking
  const yearSelect = document.getElementById("scatter-year-select");

  function populateYearDropdown() {
    // Collect unique years from bubbles data
    const years = [...new Set(DATA.bubbles.map(d => d.yr).filter(y => y > 0))].sort((a, b) => b - a);
    yearSelect.innerHTML = '<option value="">全部年份</option>';
    years.forEach(yr => {
      const opt = document.createElement("option");
      opt.value = yr;
      opt.textContent = yr + " 年";
      yearSelect.appendChild(opt);
    });
  }

  function setYearFilter(yr) {
    yearFilter = yr;
    selected = null; hoverGame = null;
    searchTerm = ""; searchInput.value = "";
    closeDropdown();
    showDetailPanel(null);
    // Sync dropdown
    yearSelect.value = yr || "";
    // Sync year-indicator bar (stream graph's bottom bar)
    const indicator = document.getElementById("year-indicator");
    const yiYear = document.getElementById("yi-year");
    if (indicator) {
      if (yr) {
        indicator.style.display = "flex";
        yiYear.textContent = yr;
      } else {
        indicator.style.display = "none";
      }
    }
    draw();
  }

  // Dropdown change → filter
  let _selfEmit = false;
  yearSelect.addEventListener("change", function() {
    const yr = this.value ? parseInt(this.value) : null;
    setYearFilter(yr);
    // Notify stream graph (but flag so we don't react to our own event)
    _selfEmit = true;
    EVT.emit("yearSelect", yr);
    _selfEmit = false;
  });

  // Stream graph click → filter (only react to external events)
  EVT.on("yearSelect", yr => {
    if (_selfEmit) return;
    setYearFilter(yr);
  });

  // Year indicator clear button also resets dropdown
  const yiClearBtn = document.getElementById("yi-clear");
  if (yiClearBtn) {
    const newBtn = yiClearBtn.cloneNode(true);
    yiClearBtn.parentNode.replaceChild(newBtn, yiClearBtn);
    newBtn.addEventListener("click", () => {
      setYearFilter(null);
      _selfEmit = true;
      EVT.emit("yearSelect", null);
      _selfEmit = false;
    });
  }

  populateYearDropdown();
  setupSearch();
  setupTagFilter();
  draw();
  window._scatterRedraw = draw;
};
// ════════════════════════════════════════════════