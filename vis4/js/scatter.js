//  VIEW 2: BUBBLE SCATTER
// ════════════════════════════════════════════════
window.initScatter = function() {
  const MG = {t: 20, r: 24, b: 48, l: 66};
  // 神作象限：好评率绝对线 GOD_PR(=90) 复用 colors.js 全局常量；
  // CCU 阈值数据驱动，在每次 draw() 开头按真实数据刷新
  let GOD_CCU = 100000;
  let activeFilter = 'all', selected = null, yearFilter = null;
  let activeTag = null;
  let classMode = 'tier';  // 'tier'=制作规模(Indie/AA/AAA) |
                           // 'mon'=商业模式(Premium/F2P/Hybrid)
  let searchMode = 'name';
  let searchTerm = '', hoverGame = null;
  let highlightQuadrant = false;
  let svg, g, xSc, ySc, rSc, iW, iH;

  // ══ 正交分类轴 ════════════════════════════════
  // 两条互不蕴含的轴：制作规模 tier ⊥ 商业模式 monetization。
  // 当前“填色轴”由 classMode 决定；另一条轴用【描边样式】呈现，
  // 因此每个气泡始终同时可读两条轴，不靠单一颜色硬区分。
  const MON_VALUES = ['Premium', 'F2P', 'Hybrid'];
  const FILTER_SETS = {
    tier: [['all', '全部'], ['Indie', 'INDIE'], ['AA', 'AA'], ['AAA', 'AAA']],
    mon: [
      ['all', '全部'], ['Premium', '买断制'], ['F2P', '免费F2P'],
      ['Hybrid', '混合模式']
    ],
  };
  const TONE = {
    Indie: 'indie',
    AA: 'aa',
    AAA: 'aaa',
    Premium: 'premium',
    F2P: 'f2p',
    Hybrid: 'hybrid',
  };
  function axisForFilter(f) {
    return MON_VALUES.indexOf(f) >= 0 ? 'mon' : 'tier';
  }
  // 填色：tier 模式按规模档，mon 模式按商业模式
  function bubbleFill(d) {
    return classMode === 'mon' ? (MONC[d.monetization] || '#888') :
                                 (C[d.tier] || '#888');
  }
  // 描边：呈现“另一条轴”——
  //   tier 模式 → 描边编码商业模式：买断=暗描边 / 免费=亮青环 / 混合=紫色虚线环
  //   mon  模式 → 描边粗细编码规模：Indie 细 / AA 中 / AAA 粗
  function bubbleStroke(d) {
    if (highlightQuadrant && isGodQuadrant(d)) return '#fff';
    if (classMode === 'mon')
      return d3.color(MONC[d.monetization] || '#888').darker(0.9);
    if (d.monetization === 'F2P') return '#3df0fb';      // 免费=亮青环（与商业模式配色一致）
    if (d.monetization === 'Hybrid') return '#cf9dff';   // 混合=紫环
    return d3.color(C[d.tier] || '#888').darker(0.8);
  }
  function bubbleStrokeW(d) {
    if (highlightQuadrant && isGodQuadrant(d)) return 1.5;
    if (classMode === 'mon')
      return d.tier === 'AAA' ? 2.4 : d.tier === 'AA' ? 1.5 : 0.7;
    // 默认(tier)视图：免费/混合用更粗的彩色环明确区分商业模式，买断保持细描边
    return d.monetization === 'F2P' ? 2.4 : d.monetization === 'Hybrid' ? 2 : 1;
  }
  function bubbleDash(d) {
    if (classMode === 'tier' && d.monetization === 'Hybrid') return '3,2';
    return null;
  }

  const searchInput = document.getElementById('scatter-search');
  const searchResults = document.getElementById('search-results');

  // ══ TAG FILTER SYSTEM ══════════════════════════

  // 商业模式已升级为独立分类轴(买断/F2P/混合)，因此「免费」这类标签在「玩法标签」
  // 筛选里属于冗余维度，从标签统计中剔除，避免与商业模式轴重复。
  const TAG_BLOCKLIST = new Set(
      ['free to play', 'free-to-play', 'f2p', '免费', '免费游玩', '免费游戏']);

  function buildTagStats() {
    const counts = {};
    DATA.bubbles.forEach(d => {
      (d.tags || []).forEach(t => {
        if (TAG_BLOCKLIST.has(String(t).trim().toLowerCase())) return;
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  }

  function updateTagUI() {
    document.querySelectorAll('[data-tag]').forEach(b => {
      b.classList.toggle('active', b.dataset.tag === (activeTag || ''));
    });
    document.querySelectorAll('.tag-dropdown-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tag === activeTag);
    });
  }

  function setupTagFilter() {
    const counts = buildTagStats();
    const bar = document.getElementById('tag-filter-bar');
    const dropdown = document.getElementById('tag-dropdown');
    if (!bar || !dropdown) return;

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // Buttons: tags with count > 20
    sorted.forEach(([tag, count]) => {
      if (count <= 20) return;
      const btn = document.createElement('button');
      btn.className = 'pill';
      btn.dataset.tag = tag;
      btn.textContent = tag;
      btn.addEventListener('click', () => {
        activeTag = activeTag === tag ? null : tag;
        selected = null;
        hoverGame = null;
        searchTerm = '';  // 清掉选中游戏遗留的搜索词，否则只剩该气泡不透明
        searchInput.value = '';
        closeDropdown();
        showDetailPanel(null);
        updateTagUI();
        draw();
      });
      bar.appendChild(btn);
    });

    // Dropdown: all tags
    sorted.forEach(([tag, count]) => {
      const el = document.createElement('div');
      el.className = 'tag-dropdown-item';
      el.dataset.tag = tag;
      el.innerHTML =
          `<span>${tag}</span><span class="tag-count">${count}</span>`;
      el.addEventListener('click', () => {
        activeTag = activeTag === tag ? null : tag;
        selected = null;
        hoverGame = null;
        searchTerm = '';  // 同上：避免残留搜索词把其余气泡压暗
        searchInput.value = '';
        showDetailPanel(null);
        updateTagUI();
        draw();
        dropdown.classList.remove('open');
      });
      dropdown.appendChild(el);
    });

    // Click outside to close dropdown
    document.addEventListener('click', e => {
      if (!e.target.closest('#tag-dropdown-wrap'))
        dropdown.classList.remove('open');
    });
  }

  // ══ SEARCH SYSTEM (unified: game name + tag search) ══════

  function setupSearch() {
    let debounce;

    // Search mode toggle buttons
    document.querySelectorAll('[data-search-mode]').forEach(b => {
      b.addEventListener('click', function() {
        document.querySelectorAll('[data-search-mode]')
            .forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        searchMode = this.dataset.searchMode;
        searchInput.placeholder =
            searchMode === 'tag' ? '搜索标签...' : '搜索游戏名...';
        searchInput.value = '';
        searchTerm = '';
        activeTag = null;
        updateTagUI();
        closeDropdown();
        draw();
        searchInput.focus();
      });
    });

    searchInput.addEventListener('input', function() {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        searchTerm = this.value.trim();
        selected = null;
        hoverGame = null;
        showDetailPanel(null);
        if (searchMode === 'tag') {
          // Tag search mode: filter dropdown
          showTagDropdown(searchTerm);
        } else {
          if (searchTerm)
            showDropdown();
          else
            closeDropdown();
        }
        draw();
      }, 150);
    });
    searchInput.addEventListener('focus', () => {
      if (searchMode === 'tag') {
        showTagDropdown(searchTerm);
      } else {
        if (searchTerm) showDropdown();
      }
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#search-wrap')) closeDropdown();
    });

    searchInput.addEventListener('keydown', e => {
      if (searchMode === 'tag') return;  // tag mode uses click only
      if (!searchResults.classList.contains('open')) return;
      const items = searchResults.querySelectorAll('.search-item[data-name]');
      const active = searchResults.querySelector('.search-item.kb-active');
      let idx = active ? [...items].indexOf(active) : -1;

      if (e.key === 'Escape') {
        closeDropdown();
        searchInput.blur();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = Math.min(idx + 1, items.length - 1);
        items.forEach(el => el.classList.remove('kb-active'));
        if (items[idx]) {
          items[idx].classList.add('kb-active');
          items[idx].scrollIntoView({block: 'nearest'});
        }
        const name = items[idx]?.dataset.name;
        const d = name && DATA.bubbles.find(x => x.name === name);
        previewGame(d || null);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = Math.max(idx - 1, 0);
        items.forEach(el => el.classList.remove('kb-active'));
        if (items[idx]) {
          items[idx].classList.add('kb-active');
          items[idx].scrollIntoView({block: 'nearest'});
        }
        const name = items[idx]?.dataset.name;
        const d = name && DATA.bubbles.find(x => x.name === name);
        previewGame(d || null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (active)
          active.click();
        else if (items[0])
          items[0].click();
      }
    });
  }

  function showTagDropdown(query) {
    const dropdown = document.getElementById('tag-dropdown');
    const searchResults = document.getElementById('search-results');
    if (!dropdown) return;
    const q = (query || '').toLowerCase();
    dropdown.querySelectorAll('.tag-dropdown-item').forEach(el => {
      el.style.display = el.dataset.tag.toLowerCase().includes(q) ? '' : 'none';
    });
    dropdown.classList.add('open');
    if (searchResults) searchResults.classList.remove('open');
  }

  function fuzzyMatch(name, query) {
    const lo = name.toLowerCase(), q = query.toLowerCase();
    if (lo.includes(q)) return true;
    let qi = 0;
    for (let i = 0; i < lo.length && qi < q.length; i++)
      if (lo[i] === q[qi]) qi++;
    return qi === q.length;
  }
  function highlightChars(text, query) {
    const lo = text.toLowerCase(), q = query.toLowerCase(), idx = lo.indexOf(q);
    if (idx >= 0)
      return text.slice(0, idx) + '<mark>' + text.slice(idx, idx + q.length) +
          '</mark>' + text.slice(idx + q.length);
    let r = '', qi = 0;
    for (let i = 0; i < text.length; i++) {
      if (qi < q.length && text[i].toLowerCase() === q[qi]) {
        r += '<mark>' + text[i] + '</mark>';
        qi++;
      } else
        r += text[i];
    }
    return r;
  }

  function showDropdown() {
    const q = searchTerm;
    const matches = DATA.bubbles.filter(d => fuzzyMatch(d.name, q)).slice(0, 8);
    if (!matches.length) {
      searchResults.innerHTML =
          `<div class="search-no-result">无匹配结果</div>`;
      searchResults.classList.add('open');
      return;
    }
    searchResults
        .innerHTML = matches
                         .map(
                             d => `<div class="search-item" data-name="${
                                 d.name.replace(/"/g, '&quot;')}">
        <span class="search-item-name">${highlightChars(d.name, q)}</span>
        <span class="search-item-type" style="color:${C[d.tier] || '#888'}">${
                                 (d.tier || d.type)} · ${monLabel(d)}</span>
      </div>`).join('');
    searchResults.classList.add('open');

    // Bind hover → preview bubble
    searchResults.querySelectorAll('.search-item[data-name]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        const d = DATA.bubbles.find(x => x.name === el.dataset.name);
        if (d) previewGame(d);
      });
      el.addEventListener('mouseleave', () => {
        previewGame(null);
      });
      el.addEventListener('click', () => {
        const d = DATA.bubbles.find(x => x.name === el.dataset.name);
        if (d) selectFromSearch(d);
      });
    });
  }

  function closeDropdown() {
    searchResults.classList.remove('open');
    searchResults.innerHTML = '';
  }

  // Preview: temporarily highlight a bubble (from dropdown hover / keyboard)
  function previewGame(d) {
    hoverGame = d;
    if (!g) return;
    // Update bubble opacities
    g.selectAll('.bub')
        .transition()
        .duration(150)
        .attr(
            'opacity',
            dd => {
              if (d) return dd === d ? 1 : 0.12;
              if (searchTerm && searchMode === 'name')
                return fuzzyMatch(dd.name, searchTerm) ? 0.75 : 0.08;
              return dd.ccu > 100000 ? 0.85 : 0.65;
            })
        .attr('r', dd => d && dd === d ? rSc(dd.own) * 1.15 : rSc(dd.own));
    // Show/remove label and ring for previewed game
    g.selectAll('.preview-label,.preview-ring').remove();
    if (d) {
      const cx = xSc(d.pr), cy = ySc(Math.max(1, d.ccu)), r = rFn(d);
      g.append('text')
          .attr('class', 'preview-label')
          .attr('x', cx)
          .attr('y', cy - r - 7)
          .attr('text-anchor', 'middle')
          .attr('fill', '#fff')
          .attr('font-size', 12)
          .attr('font-weight', '700')
          .attr('font-family', '\'Space Mono\',monospace')
          .attr('pointer-events', 'none')
          .text(d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name);
      g.append('circle')
          .attr('class', 'preview-ring search-ring-pulse')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', r + 6);
    }
  }

  function selectFromSearch(d) {
    closeDropdown();
    searchInput.value = d.name;
    searchTerm = d.name;
    hoverGame = null;
    // Switch filter if needed
    if (activeFilter !== 'all' && !matchesFilter(d, activeFilter)) {
      activeFilter = 'all';
      syncFilterPills('all');
    }
    if (yearFilter && d.yr !== yearFilter) {
      // User clicked a dimmed bubble outside year filter — clear the filter
      setYearFilter(null);
      EVT.emit('yearSelect', null);
    }
    selected = d;
    draw();
    showDetailPanel(d);
  }

  function resetAll() {
    selected = null;
    hoverGame = null;
    searchTerm = '';
    activeTag = null;
    searchInput.value = '';
    closeDropdown();
    TIP.hide();
    showDetailPanel(null);
    updateTagUI();
    draw();
  }

  function isGodQuadrant(d) {
    return d.pr > GOD_PR && d.ccu > GOD_CCU;
  }

  // ── 动态筛选 pill：按当前分类轴渲染（规模 ⇄ 商业模式）──
  const filterPillsWrap = document.getElementById('scatter-filter-pills');
  const legendWrap = document.getElementById('scatter-legend');

  function renderFilterPills() {
    if (!filterPillsWrap) return;
    filterPillsWrap.innerHTML = '';

    // ALL button: placed in the first scatter-row (same row as "聚焦 Indie"),
    // on the far right — same vertical position
    const firstRow = document.querySelector(
        '#sec-scatter .scatter-controls-left .scatter-row');
    let allBtn = document.getElementById('scatter-all-btn');
    if (!allBtn && firstRow) {
      allBtn = document.createElement('button');
      allBtn.id = 'scatter-all-btn';
      allBtn.className = 'pill pill-all';
      allBtn.dataset.sf = 'all';
      allBtn.textContent = '全部';
      allBtn.addEventListener('click', function() {
        setFilter('all');
        _selfEmit = true;
        EVT.emit('yearSelect', null);
        _selfEmit = false;
      });
      firstRow.appendChild(allBtn);
    }
    if (allBtn) {
      const isActive = activeFilter === 'all';
      allBtn.classList.toggle('active', isActive);
      allBtn.style.cssText = 'flex-shrink:0;font-size:12px;padding:5px 14px;' +
          'font-family:var(--mono);letter-spacing:1px;text-transform:uppercase;' +
          'border-radius:2px;cursor:pointer;font-weight:700;' +
          'background:#6060a0;' +
          'border:1px solid #6060a0;' +
          'color:#fff;' +
          'transition:border-color .15s,box-shadow .15s,background .15s;';
      allBtn.onmouseenter = function() {
        allBtn.style.borderColor = '#9090d0';
        allBtn.style.boxShadow = '0 0 0 2px rgba(96,96,160,0.35)';
      };
      allBtn.onmouseleave = function() {
        allBtn.style.borderColor = '#6060a0';
        allBtn.style.boxShadow = 'none';
      };
    }

    FILTER_SETS[classMode].forEach(pair => {
      if (pair[0] === 'all') return;  // ALL is outside, skip here
      const val = pair[0], label = pair[1];
      const btn = document.createElement('button');
      btn.className = 'pill' + (val === 'all' ? ' pill-all' : '');
      btn.dataset.sf = val;
      btn.textContent = label;
      if (val === activeFilter) {
        btn.classList.add('active');
        if (TONE[val]) btn.dataset.tone = TONE[val];
      }
      btn.addEventListener('click', function() {
        setFilter(val);
        _selfEmit = true;
        EVT.emit('yearSelect', null);
        _selfEmit = false;
      });
      filterPillsWrap.appendChild(btn);
    });
  }

  function syncFilterPills(type) {
    if (!filterPillsWrap) return;
    const allBtn = document.getElementById('scatter-all-btn');
    if (allBtn) allBtn.classList.toggle('active', type === 'all');
    filterPillsWrap.querySelectorAll('.pill').forEach(x => {
      const on = x.dataset.sf === type;
      x.classList.toggle('active', on);
      if (on && TONE[type])
        x.dataset.tone = TONE[type];
      else
        x.removeAttribute('data-tone');
    });
  }

  function syncModeUI() {
    document.querySelectorAll('[data-classmode]')
        .forEach(
            b => b.classList.toggle(
                'active', b.dataset.classmode === classMode));
    const hint = document.getElementById('classmode-hint');
    if (hint)
      hint.textContent = classMode === 'mon' ?
          '填色＝商业模式，描边粗细＝规模' :
          '填色＝规模，描边＝商业模式';
  }

  function setMode(mode) {
    if (mode === classMode) return;
    classMode = mode;
    activeFilter = 'all';
    syncModeUI();
    renderFilterPills();
    renderLegend();
    selected = null;
    hoverGame = null;
    searchTerm = '';
    searchInput.value = '';
    closeDropdown();
    showDetailPanel(null);
    draw();
  }

  // ── 双轴图例：填色轴(当前) + 描边轴(正交) + 大小 ──
  function renderLegend() {
    if (!legendWrap) return;
    let colorTitle, colorItems, ringTitle, ringItems;
    if (classMode === 'mon') {
      colorTitle = '填色 · 商业模式';
      colorItems = [
        [MONC.Premium, MON.Premium], [MONC.F2P, MON.F2P],
        [MONC.Hybrid, MON.Hybrid]
      ];
      ringTitle = '描边粗细 · 制作规模';
      ringItems = [
        ['border:0.7px solid #888', '独立 Indie'],
        ['border:1.5px solid #b9b9d8', '中型 AA'],
        ['border:2.4px solid #e6e6f5', '大作 AAA']
      ];
    } else {
      colorTitle = '填色 · 制作规模';
      colorItems =
          [[C.Indie, '独立 Indie'], [C.AA, '中型 AA'], [C.AAA, '大作 AAA']];
      ringTitle = '描边 · 商业模式';
      ringItems = [
        ['border:1px solid #888', MON.Premium],
        ['border:2.4px solid #3df0fb', MON.F2P],
        ['border:2px dashed #cf9dff', MON.Hybrid]
      ];
    }
    const dots =
        colorItems
            .map(
                it =>
                    `<span class="sl-item"><span class="sl-dot" style="background:${
                        it[0]}"></span>${it[1]}</span>`)
            .join('');
    const rings =
        ringItems
            .map(
                it => `<span class="sl-item"><span class="sl-ring" style="${
                    it[0]}"></span>${it[1]}</span>`)
            .join('');
    legendWrap.innerHTML = `<div class="sl-group"><span class="sl-title">${
                               colorTitle}</span>${dots}</div>` +
        `<div class="sl-group"><span class="sl-title">${ringTitle}</span>${
                               rings}</div>` +
        `<div class="sl-group"><span class="sl-title">气泡大小</span><span class="sl-item">估算拥有量</span></div>`;
  }

  function setFilter(type) {
    // 跨轴筛选值 → 自动切到对应分类轴
    if (type && type !== 'all') {
      const m = axisForFilter(type);
      if (m !== classMode) {
        classMode = m;
        syncModeUI();
        renderFilterPills();
        renderLegend();
      }
    }
    activeFilter = type;
    syncFilterPills(type);
    selected = null;
    hoverGame = null;
    searchTerm = '';
    searchInput.value = '';
    activeTag = null;
    yearFilter = null;
    const ys = document.getElementById('scatter-year-select');
    if (ys) ys.value = '';
    updateTagUI();
    closeDropdown();
    showDetailPanel(null);
    const indicator = document.getElementById('year-indicator');
    if (indicator) indicator.style.display = 'none';
    draw();
  }

  // ══ DATA HELPERS ═══════════════════════════════

  // 正交筛选：mon 模式按商业模式(Premium/F2P/Hybrid)，tier
  // 模式按规模档(Indie/AA/AAA)
  function matchesFilter(d, f) {
    if (!f || f === 'all') return true;
    if (MON_VALUES.indexOf(f) >= 0) return d.monetization === f;
    return d.tier === f;
  }

  function getFilteredData() {
    let data = DATA.bubbles;
    if (activeFilter !== 'all')
      data = data.filter(d => matchesFilter(d, activeFilter));
    if (yearFilter) data = data.filter(d => d.yr === yearFilter);
    if (activeTag) data = data.filter(d => (d.tags || []).includes(activeTag));
    return data;
  }

  // 选中态分层透明度：选中=1 / 同侪=0.4 / 其余=0.06
  //   统一口径——只要存在任一筛选(规模/商业模式/年份/标签)，处于同一筛选集内的
  //   气泡都算“同侪”→0.4；仅“全部”无筛选时才用聚光灯(0.06)，避免上百气泡同时变亮。
  //   这样分类筛选、年份筛选、标签筛选及其组合的选中观感完全一致。
  function inActiveFilterSet(d) {
    return matchesFilter(d, activeFilter) &&
        (!yearFilter || d.yr === yearFilter) &&
        (!activeTag || (d.tags || []).includes(activeTag));
  }
  function hasActiveFilter() {
    return (activeFilter && activeFilter !== 'all') || !!yearFilter ||
        !!activeTag;
  }
  function selectionOpacity(d) {
    if (d === selected) return 1;
    if (highlightQuadrant) return isGodQuadrant(d) ? 0.4 : 0.06;
    if (hasActiveFilter()) return inActiveFilterSet(d) ? 0.4 : 0.06;
    return 0.06;  // 全部模式：聚光灯，仅选中高亮
  }

  function bubbleOpacity(d) {
    if (selected) return selectionOpacity(d);
    if (hoverGame) return d === hoverGame ? 1 : 0.12;
    if (searchTerm && searchMode === 'name')
      return fuzzyMatch(d.name, searchTerm) ? 0.75 : 0.08;
    // 象限模式下，show 列表已仅含神作气泡，直接高亮
    if (highlightQuadrant) return isGodQuadrant(d) ? 1 : 0.3;
    return d.ccu > 100000 ? 0.85 : 0.65;
  }

  // ══ DRAW ═══════════════════════════════════════

  function draw() {
    // 神作象限 CCU 阈值：按当前数据刷新（示例数据→10万；真实数据→自适应）
    GOD_CCU =
        (typeof godCcuThreshold === 'function') ? godCcuThreshold() : 100000;
    const wrap = document.getElementById('scatter-inner');
    wrap.innerHTML = '';
    const W = wrap.clientWidth, H = Math.max(500, Math.min(700, W * 0.55));
    iW = W - MG.l - MG.r;
    iH = H - MG.t - MG.b;

    svg = d3.select(wrap)
              .append('svg')
              .attr('viewBox', `0 0 ${W} ${H}`)
              .attr('height', H);
    g = svg.append('g').attr('transform', `translate(${MG.l},${MG.t})`);

    xSc = d3.scaleLinear().domain([40, 100]).range([0, iW]);
    ySc = d3.scaleLog().domain([2, 4800000]).range([iH, 0]).clamp(true);
    const n = DATA.bubbles.length;
    const maxR = n > 500 ? 18 : n > 300 ? 24 : n > 150 ? 36 : n > 60 ? 44 : 50;
    rSc = d3.scalePow().exponent(0.35).domain([0, 80]).range([3, maxR]);
    const rFn = d => d.own > 0.01 ? rSc(d.own) : 3;

    // Grid
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(ySc).ticks(5).tickSize(-iW).tickFormat(''));
    g.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(xSc).ticks(6).tickSize(-iH).tickFormat(''));

    // Axes
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(xSc).tickFormat(d => d + '%'));
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(ySc).ticks(5).tickFormat(
            v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' :
                            (v / 1e3).toFixed(0) + 'k'));

    // Axis labels
    g.append('text')
        .attr('x', iW / 2)
        .attr('y', iH + 38)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6060a0')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 12)
        .attr('letter-spacing', '1')
        .text('STEAM 好评率 (%)');
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -iH / 2)
        .attr('y', -54)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6060a0')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 12)
        .attr('letter-spacing', '1')
        .text('峰值在线人数（对数轴）');

    // Quadrant label / narrative highlight
    if (highlightQuadrant) {
      // Glow filter for god-quadrant bubbles
      const defs = svg.append('defs');
      const glowFilter = defs.append('filter').attr('id', 'god-glow');
      glowFilter.append('feGaussianBlur')
          .attr('stdDeviation', '3')
          .attr('result', 'blur');
      glowFilter.append('feMerge')
          .selectAll('feMergeNode')
          .data(['blur', 'SourceGraphic'])
          .join('feMergeNode')
          .attr('in', d => d);

      const qx = xSc(GOD_PR);   // x position of vertical line (pr=90)
      const qy = ySc(GOD_CCU);  // y position of horizontal line (ccu threshold)

      // Right-upper region: subtle colored fill (no rect border)
      g.append('rect')
          .attr('class', 'god-quadrant-bg')
          .attr('x', qx)
          .attr('y', ySc(4800000))
          .attr('width', xSc(100) - qx)
          .attr('height', qy - ySc(4800000))
          .attr('fill', 'rgba(255, 200, 60, 0.05)')
          .attr('pointer-events', 'none');

      // Horizontal dashed line at GOD_CCU threshold
      g.append('line')
          .attr('class', 'god-threshold-line')
          .attr('x1', 0)
          .attr('y1', qy)
          .attr('x2', iW)
          .attr('y2', qy)
          .attr('stroke', '#ffd54f')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '6,4')
          .attr('pointer-events', 'none');

      // Vertical dashed line at GOD_PR (90%)
      g.append('line')
          .attr('class', 'god-threshold-line')
          .attr('x1', qx)
          .attr('y1', 0)
          .attr('x2', qx)
          .attr('y2', iH)
          .attr('stroke', '#ffd54f')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '6,4')
          .attr('pointer-events', 'none');

      // Label badge: horizontally centered within the quadrant region
      const labelCx = (qx + xSc(100)) / 2;  // quadrant center-x
      const labelText = '神作象限 · 好评率 > 90% 且 在线 > ' + fmt.ccu(GOD_CCU);
      const labelG =
          g.append('g')
              .attr('transform', `translate(${labelCx}, ${ySc(4800000) + 14})`)
              .attr('class', 'god-quadrant-label-group');
      const tmpText =
          labelG.append('text')
              .attr('font-family', '\'Noto Sans SC\',\'Space Mono\',monospace')
              .attr('font-size', 12)
              .attr('font-weight', '600')
              .text(labelText);
      const tw = tmpText.node().getBBox().width;
      tmpText.remove();
      labelG.append('rect')
          .attr('x', -(tw + 28) / 2)
          .attr('y', -13)
          .attr('width', tw + 28)
          .attr('height', 22)
          .attr('rx', 11)
          .attr('fill', 'rgba(255,200,60,0.12)')
          .attr('stroke', 'rgba(255,200,60,0.6)')
          .attr('stroke-width', 1)
          .attr('pointer-events', 'none');
      labelG.append('text')
          .attr('x', 0)
          .attr('y', 2)
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255,200,60,0.9)')
          .attr('font-family', '\'Noto Sans SC\',\'Space Mono\',monospace')
          .attr('font-size', 12)
          .attr('font-weight', '600')
          .attr('letter-spacing', '0.5')
          .attr('pointer-events', 'none')
          .text(labelText);
    } else {
      g.append('text')
          .attr('x', iW - 4)
          .attr('y', 14)
          .attr('text-anchor', 'end')
          .attr('fill', 'rgba(29,233,182,0.12)')
          .attr('font-family', '\'Space Mono\',monospace')
          .attr('font-size', 12)
          .text('高口碑 · 高人气 →');
    }

    if (yearFilter) {
      g.append('text')
          .attr('x', 4)
          .attr('y', 14)
          .attr('fill', 'rgba(29,233,182,0.4)')
          .attr('font-family', '\'Space Mono\',monospace')
          .attr('font-size', 12)
          .text('筛选：' + yearFilter + ' 年发布');
    }

    const show = getFilteredData();
    // 象限模式：只有神作气泡作为前景，其余全部变暗
    const visibleShow =
        highlightQuadrant ? show.filter(d => isGodQuadrant(d)) : show;
    const hide = DATA.bubbles.filter(d => !visibleShow.includes(d));

    // Background dimmed
    g.selectAll('.bub-dim')
        .data(hide.sort((a, b) => b.own - a.own))
        .join('circle')
        .attr('class', 'bub-dim')
        .attr('cx', d => xSc(d.pr))
        .attr('cy', d => ySc(Math.max(1, d.ccu)))
        .attr('r', d => rFn(d))
        .attr('fill', bubbleFill)
        .attr('opacity', 0.04)
        .attr('stroke', 'none');

    // Active bubbles
    g.selectAll('.bub')
        .data(show.sort((a, b) => b.own - a.own), d => d.name)
        .join(
            enter => enter.append('circle')
                         .attr('class', 'bub')
                         .attr('cx', d => xSc(d.pr))
                         .attr('cy', d => ySc(Math.max(1, d.ccu)))
                         .attr('r', 0)
                         .attr('fill', bubbleFill)
                         .attr('stroke', bubbleStroke)
                         .attr('stroke-width', bubbleStrokeW)
                         .attr('stroke-dasharray', bubbleDash)
                         .attr(
                             'filter',
                             d => highlightQuadrant && isGodQuadrant(d) ?
                                 'url(#god-glow)' :
                                 null)
                         .attr('opacity', 0)
                         .style('cursor', 'pointer')
                         .call(
                             en => en.transition()
                                       .duration(600)
                                       .ease(d3.easeCubicOut)
                                       .attr(
                                           'r',
                                           d => selected === d ? rFn(d) * 1.15 :
                                                                 rFn(d))
                                       .attr('opacity', bubbleOpacity)),
            update =>
                update.attr('fill', bubbleFill)
                    .attr('stroke', bubbleStroke)
                    .attr('stroke-width', bubbleStrokeW)
                    .attr('stroke-dasharray', bubbleDash)
                    .call(
                        up => up.transition()
                                  .duration(400)
                                  .attr('cx', d => xSc(d.pr))
                                  .attr('cy', d => ySc(Math.max(1, d.ccu)))
                                  .attr(
                                      'r',
                                      d => selected === d ? rFn(d) * 1.15 :
                                                            rFn(d))
                                  .attr('opacity', bubbleOpacity)),
            exit => exit.call(
                ex => ex.transition()
                          .duration(300)
                          .attr('r', 0)
                          .attr('opacity', 0)
                          .remove()));

    // Bind events
    setTimeout(() => {
      g.selectAll('.bub')
          .on('mousemove',
              function(ev, d) {
                if (selected === d) return;
                d3.select(this).transition().duration(100).attr(
                    'r', rFn(d) * 1.12);
                TIP.show(
                    `<strong>${d.name}</strong>
            <div class="tip-row"><span class="tip-k">制作规模</span><span class="tip-v" style="color:${
                        C[d.tier] ||
                        '#888'}">${(TL[d.tier] || d.tier)}</span></div>
            <div class="tip-row"><span class="tip-k">商业模式</span><span class="tip-v" style="color:${
                        monColor(d)}">${monLabel(d)}</span></div>
            <div class="tip-row"><span class="tip-k">发行年</span><span class="tip-v">${
                        d.yr || '—'}</span></div>
            <div class="tip-row"><span class="tip-k">好评率</span><span class="tip-v">${
                        fmt.pct(d.pr)}</span></div>
            <div class="tip-row"><span class="tip-k">峰值在线</span><span class="tip-v">${
                        fmt.ccu(d.ccu)}</span></div>
            <div class="tip-row"><span class="tip-k">估算拥有</span><span class="tip-v">${
                        fmt.own(d.own)}</span></div>
            <div class="tip-row"><span class="tip-k">定价</span><span class="tip-v">${
                        fmt.price(d.price)}</span></div>
          `,
                    ev);
              })
          .on('mouseleave',
              function(ev, d) {
                if (selected !== d) {
                  d3.select(this).transition().duration(100).attr('r', rFn(d));
                  TIP.hide();
                }
              })
          .on('click', function(ev, d) {
            ev.stopPropagation();
            if (selected === d) {
              // 取消选中：回到象限视图（不清除 highlightQuadrant）
              selected = null;
              hoverGame = null;
              searchTerm = '';
              searchInput.value = '';
              closeDropdown();
              g.selectAll('.sel-label,.sel-ring').remove();
              g.selectAll('.bub')
                  .transition()
                  .duration(300)
                  .attr('opacity', bubbleOpacity)
                  .attr('r', dd => rSc(dd.own));
              showDetailPanel(null);
            } else {
              selected = d;
              hoverGame = null;
              TIP.hide();
              searchInput.value = d.name;
              searchTerm = d.name;
              closeDropdown();
              // 分层透明度：选中=1 / 同类(同筛选或象限内)=0.4 / 其余=0.06
              g.selectAll('.bub')
                  .transition()
                  .duration(300)
                  .attr('opacity', selectionOpacity)
                  .attr('r', dd => dd === d ? rSc(dd.own) * 1.18 : rSc(dd.own));
              // Show label only for selected
              g.selectAll('.sel-label,.sel-ring').remove();
              const cx = xSc(d.pr), cy = ySc(Math.max(1, d.ccu)), r = rFn(d);
              g.append('text')
                  .attr('class', 'sel-label')
                  .attr('x', cx)
                  .attr('y', cy - r * 1.18 - 7)
                  .attr('text-anchor', 'middle')
                  .attr('fill', '#fff')
                  .attr('font-size', 12)
                  .attr('font-weight', '700')
                  .attr('font-family', '\'Space Mono\',monospace')
                  .attr('pointer-events', 'none')
                  .text(
                      d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name);
              g.append('circle')
                  .attr('class', 'sel-ring search-ring-pulse')
                  .attr('cx', cx)
                  .attr('cy', cy)
                  .attr('r', r * 1.18 + 6);
              showDetailPanel(d);
            }
          });
    }, 50);

    // If a game is selected on redraw, show its label and ring
    if (selected) {
      const d = selected, inShow = show.find(x => x.name === d.name);
      if (inShow) {
        const cx = xSc(d.pr), cy = ySc(Math.max(1, d.ccu)), r = rFn(d);
        g.append('text')
            .attr('class', 'sel-label')
            .attr('x', cx)
            .attr('y', cy - r * 1.15 - 7)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', 12)
            .attr('font-weight', '700')
            .attr('font-family', '\'Space Mono\',monospace')
            .attr('pointer-events', 'none')
            .text(d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name);
        g.append('circle')
            .attr('class', 'sel-ring search-ring-pulse')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', r * 1.15 + 6);
      }
    }

    // Search rings (when typing but no specific game selected)
    if (searchTerm && searchMode === 'name' && !selected && !hoverGame) {
      const matched = show.filter(d => fuzzyMatch(d.name, searchTerm));
      g.selectAll('.search-ring')
          .data(matched, d => d.name)
          .join('circle')
          .attr('class', 'search-ring')
          .attr('cx', d => xSc(d.pr))
          .attr('cy', d => ySc(Math.max(1, d.ccu)))
          .attr('r', d => rFn(d) + 4)
          .attr('fill', 'none')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '3,2')
          .attr('opacity', 0.5)
          .style('pointer-events', 'none');
    }

    // NO labels in default view — only show via select/hover/search

    // Click outside bubbles → deselect (keep quadrant mode if active)
    svg.on('click', () => {
      if (selected) {
        selected = null;
        hoverGame = null;
        searchTerm = '';
        searchInput.value = '';
        closeDropdown();
        g.selectAll('.sel-label,.sel-ring').remove();
        g.selectAll('.bub')
            .transition()
            .duration(300)
            .attr('opacity', bubbleOpacity)
            .attr('r', dd => rSc(dd.own));
        showDetailPanel(null);
      }
    });
  }

  // ══ DETAIL PANEL ═══════════════════════════════

  function showDetailPanel(d) {
    const p = document.getElementById('detail-panel');
    if (!d) {
      p.innerHTML =
          `<div class="detail-empty"><div class="detail-empty-icon">◎</div><div class="detail-empty-text">点击任意气泡<br>查看游戏详情</div></div>`;
      return;
    }
    const col = bubbleFill(d);
    const imgUrl = d.header_image || d.img || '';
    const defaultImg = '../images/banner.png';
    const imgHtml = imgUrl ?
        `<img class="detail-header-img" src="${imgUrl}" alt="${
            d.name}" onerror="this.onerror=null;this.src='${defaultImg}'">` :
        `<img class="detail-header-img" src="${defaultImg}" alt="default">`;

    // Check if this game exists in decay data
    const hasDecay = DATA.decay.some(x => x.name === d.name);
    const decayBtnHtml = hasDecay ?
        `<button class="detail-decay-btn" id="btn-jump-decay">📉 查看生命周期曲线 ↓</button>` :
        '';

    p.innerHTML = `
      ${imgHtml}
      <div class="detail-game-name">${d.name}</div>
      <div class="detail-type">
        <span style="color:${C[d.tier] || '#888'}">${
        (TL[d.tier] || d.tier)}</span>
        <span style="color:var(--muted2)"> × </span>
        <span style="color:${monColor(d)}">${monLabel(d)}</span>
        <span style="color:var(--muted2)"> · ${d.yr || '—'}</span>
      </div>
      <div class="detail-row"><span class="detail-key">好评率</span><span class="detail-val" style="color:${
        col}">${fmt.pct(d.pr)}</span></div>
      <div class="detail-row"><span class="detail-key">峰值在线</span><span class="detail-val">${
        fmt.ccu(d.ccu)}</span></div>
      <div class="detail-row"><span class="detail-key">估算拥有</span><span class="detail-val">${
        fmt.own(d.own)}</span></div>
      <div class="detail-row"><span class="detail-key">定价</span><span class="detail-val">${
        fmt.price(d.price)}</span></div>
      <div class="detail-row"><span class="detail-key">评价总数</span><span class="detail-val">${
        fmt.num(d.rc)}</span></div>
      <div class="detail-row"><span class="detail-key">开发商</span><span class="detail-val" style="font-size:10px">${
        (d.dev && d.dev[0]) || '—'}</span></div>
      <div class="detail-tags">${
        (d.tags || [])
            .map(t => `<span class="detail-tag">${t}</span>`)
            .join('')}</div>
      ${decayBtnHtml}
    `;

    // Bind decay jump button
    const jumpBtn = document.getElementById('btn-jump-decay');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', function() {
        // Emit event for decay.js to highlight this game
        EVT.emit('decayHighlight', d.name);
        // Scroll to decay section
        const decaySection = document.getElementById('decay-inner') ||
            document.querySelector('[data-view="decay"]');
        if (decaySection) {
          decaySection.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
      });
    }
  }

  // ══ FILTER BUTTONS ═════════════════════════════

  // ══ CLASSIFICATION MODE TOGGLE (规模 ⇄ 商业模式) ═══
  document.querySelectorAll('[data-classmode]').forEach(b => {
    b.addEventListener('click', function() {
      setMode(this.dataset.classmode);
      _selfEmit = true;
      EVT.emit('yearSelect', null);
      _selfEmit = false;
    });
  });

  // Cross-view year linking
  const yearSelect = document.getElementById('scatter-year-select');

  function populateYearDropdown() {
    // Collect unique years from bubbles data
    const years =
        [...new Set(DATA.bubbles.map(d => d.yr).filter(y => y > 0))].sort(
            (a, b) => b - a);
    yearSelect.innerHTML = '<option value="">全部年份</option>';
    years.forEach(yr => {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr + ' 年';
      yearSelect.appendChild(opt);
    });
  }

  function setYearFilter(yr) {
    yearFilter = yr;
    // highlightQuadrant = false;
    selected = null;
    hoverGame = null;
    searchTerm = '';
    searchInput.value = '';
    closeDropdown();
    showDetailPanel(null);
    // Sync dropdown
    yearSelect.value = yr || '';
    // Sync year-indicator bar (stream graph's bottom bar)
    const indicator = document.getElementById('year-indicator');
    const yiYear = document.getElementById('yi-year');
    if (indicator) {
      if (yr) {
        indicator.style.display = 'flex';
        yiYear.textContent = yr;
      } else {
        indicator.style.display = 'none';
      }
    }
    draw();
  }

  // Dropdown change → filter
  let _selfEmit = false;
  yearSelect.addEventListener('change', function() {
    const yr = this.value ? parseInt(this.value) : null;
    setYearFilter(yr);
    // Notify stream graph (but flag so we don't react to our own event)
    _selfEmit = true;
    EVT.emit('yearSelect', yr);
    _selfEmit = false;
  });

  // Stream graph click → filter (only react to external events)
  EVT.on('yearSelect', yr => {
    if (_selfEmit) return;
    setYearFilter(yr);
  });

  // Year indicator clear button also resets dropdown
  const yiClearBtn = document.getElementById('yi-clear');
  if (yiClearBtn) {
    const newBtn = yiClearBtn.cloneNode(true);
    yiClearBtn.parentNode.replaceChild(newBtn, yiClearBtn);
    newBtn.addEventListener('click', () => {
      setYearFilter(null);
      _selfEmit = true;
      EVT.emit('yearSelect', null);
      _selfEmit = false;
    });
  }

  populateYearDropdown();
  setupSearch();
  setupTagFilter();
  syncModeUI();
  renderFilterPills();
  renderLegend();
  draw();
  window._scatterRedraw = draw;
  window._scatterApplyNarrative = function(opts) {
    if (opts.filter) {
      // 叙事筛选值可能属于任一轴 → 自动切到对应轴并刷新 pill/图例
      const m = axisForFilter(opts.filter);
      if (opts.filter !== 'all' && m !== classMode) {
        classMode = m;
        syncModeUI();
        renderFilterPills();
        renderLegend();
      }
      activeFilter = opts.filter;
      syncFilterPills(opts.filter);
      activeTag = null;          // 清掉残留的标签筛选，避免叙事章节误叠加用户的临时选择
      updateTagUI();
      selected = null;
      hoverGame = null;
      searchTerm = '';
      searchInput.value = '';
      closeDropdown();
      showDetailPanel(null);
    }
    if (opts.highlightQuadrant != null)
      highlightQuadrant = opts.highlightQuadrant;
    draw();
  };
};
// ════════════════════════════════════════════════