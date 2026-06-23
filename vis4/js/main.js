//  MAIN ENTRY — init, observers, resize, counter animation, data-driven insights
// ════════════════════════════════════════════════

// Intersection observer with staggered entrance
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.06 });
document.querySelectorAll('.section').forEach(s => io.observe(s));

// ── Insight typewriter effect ──────────────────────
function typewriteInsight(el, speed) {
  if (!el || el.dataset.typed) return;
  el.dataset.typed = "1";
  speed = speed || 18;

  // Prefer data-driven HTML from updateInsights(), fallback to static innerHTML
  const html = el.dataset.typewriterHtml || el.innerHTML;

  // 尊重系统“减少动态效果”偏好：直接整段渲染，不做逐字动画
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.innerHTML = html;
    el.style.visibility = "visible";
    return;
  }

  el.innerHTML = "";
  el.style.visibility = "visible";

  // Parse HTML into a flat list of (char | tag) tokens
  const tokens = [];
  const re = /(<[^>]+>)|([^<])/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) {
      tokens.push({ tag: m[1] });
    } else if (m[2]) {
      tokens.push({ ch: m[2] });
    }
  }

  let i = 0;
  let buf = "";
  function tick() {
    if (i >= tokens.length) return;
    const t = tokens[i];
    if (t.tag) {
      buf += t.tag;
      i++;
      // Emit tags instantly, don't delay
      tick();
      return;
    }
    buf += t.ch;
    i++;
    el.innerHTML = buf;
    setTimeout(tick, speed);
  }
  tick();
}

// Observe the 3 insight texts (NOT sec-method)
const typewriterTargets = [
  "insight-stream",
  "insight-scatter",
  "insight-decay",
  "insight-genre",
];
const typeIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      typewriteInsight(e.target, 18);
      typeIO.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
typewriterTargets.forEach(id => {
  const el = document.getElementById(id);
  if (el) typeIO.observe(el);
});

// Debounced resize
let rt;
window.addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    window._streamRedraw?.();
    window._scatterRedraw?.();
    window._decayRedraw?.();
    window._genreRedraw?.();
  }, 220);
});

// ── Counter animation ──────────────────────────────
function animateCounter(el, targetText, duration) {
  duration = duration || 1200;
  var raw = targetText.replace(/,/g, '');
  var numMatch = raw.match(/([\d.]+)/);
  if (!numMatch) { el.textContent = targetText; return; }

  var targetNum = parseFloat(numMatch[1]);
  var suffix = raw.slice(numMatch.index + numMatch[1].length);
  var hasDecimal = numMatch[1].includes('.');
  var decimals = hasDecimal ? (numMatch[1].split('.')[1] || '').length : 0;
  var useComma = targetText.includes(',');

  var startTime = performance.now();

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function formatNum(n) {
    var s = hasDecimal ? n.toFixed(decimals) : Math.round(n).toString();
    if (useComma) {
      var parts = s.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      s = parts.join('.');
    }
    return s;
  }

  function tick(now) {
    var elapsed = now - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var current = targetNum * ease(progress);
    el.textContent = formatNum(current) + suffix;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = targetText;
    }
  }

  requestAnimationFrame(tick);
}

// ── Hero stats: counter animation on scroll into view ───
function initHeroCounters() {
  var ribbon = document.getElementById('stats-ribbon');
  if (!ribbon) return;

  var animated = false;
  var heroObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting && !animated) {
        animated = true;
        var nums = ribbon.querySelectorAll('.stat-num');
        nums.forEach(function(el, i) {
          var target = el.getAttribute('data-target') || el.textContent.trim();
          el.textContent = '—';
          setTimeout(function() { animateCounter(el, target, 1400); }, i * 180);
        });
        heroObserver.disconnect();
      }
    });
  }, { threshold: 0.3 });
  heroObserver.observe(ribbon);
}

// 供导览开场重放：把四个大数字重置为「—」后重新滚动计数（错落进入，吸睛开场）
window._heroReplayStats = function() {
  var ribbon = document.getElementById('stats-ribbon');
  if (!ribbon) return;
  var nums = ribbon.querySelectorAll('.stat-num');
  nums.forEach(function(el, i) {
    var target = el.getAttribute('data-target') || el.textContent.trim();
    el.textContent = '—';
    setTimeout(function() { animateCounter(el, target, 1400); }, 260 + i * 200);
  });
};

// ── Update hero stats from data ──────────────────────
function updateHeroStats() {
  var m = DATA.meta;
  var market = DATA.market;
  var lastYear = market[market.length - 1];
  var firstYear = market[0];

  var cells = document.querySelectorAll('#stats-ribbon .stat-cell');
  if (cells.length < 4) return;

  var latestYr = lastYear ? lastYear.year : 2024;

  // Cell 0: total games (from meta)
  var totalGames = m.total_games || (lastYear ? lastYear.n : 50000);
  var totalStr = fmt.num(totalGames) + '+';
  cells[0].querySelector('.stat-num').setAttribute('data-target', totalStr);
  cells[0].querySelector('.stat-label').textContent = 'STEAM 在售游戏总数（' + latestYr + '）';
  if (firstYear) {
    cells[0].querySelector('.stat-trend').textContent = '↑ ' + firstYear.year + '年约' + firstYear.n + '款';
  }

  // Cell 1: indie release share (computed from market data)
  var indieShare = lastYear ? lastYear.indie : 98.9;
  cells[1].querySelector('.stat-num').setAttribute('data-target', indieShare + '%');
  cells[1].querySelector('.stat-label').textContent = '发布数量中的独立游戏占比（' + latestYr + '）';
  var yr2012 = market.find(function(d) { return d.year === 2012; });
  if (yr2012) {
    cells[1].querySelector('.stat-trend').textContent = '↑ 2012年仅' + yr2012.indie + '%';
  }

  // Cell 2: indie revenue share (external VG Insights figure — can't compute)
  cells[2].querySelector('.stat-num').setAttribute('data-target', '48%');

  // Cell 3: MAU (external Valve figure — can't compute)
  cells[3].querySelector('.stat-num').setAttribute('data-target', '1.32亿');
}

// ── Update insight texts from data ───────────────────
function updateInsights() {
  var m = DATA.meta;
  var market = DATA.market;
  var lastYear = market[market.length - 1];

  // ── Insight 1: Stream Graph (market) ──
  var insight1 = document.getElementById('insight-stream');
  if (insight1 && lastYear) {
    // var dailyNew = lastYear.n ? Math.round(lastYear.n / 365) : 52;
    var yr2017 = market.find(function(d) { return d.year === 2017; });
    var yr2016 = market.find(function(d) { return d.year === 2016; });
    var directCount = yr2017 ? fmt.num(yr2017.ni) : '7,600';
    var preCount = yr2016 ? fmt.num(yr2016.ni) : '5,472';
    var jumpPct = yr2016 && yr2017 ? Math.round((yr2017.ni - yr2016.ni) / yr2016.ni * 100) : 39;
    var dailyNew = lastYear.n ? Math.round(lastYear.n / 365) : 52;

    var html1 =
      '<span class="event-chip">2012</span> <strong>Steam Greenlight</strong> — 开放第三方上架，独立游戏涌入加速，占比持续攀升；' +
      '<span class="event-chip">2017</span> <strong>Steam Direct</strong> — 取消审核门槛，独立年发布量再上一个台阶；' +
      '<span class="event-chip">2020</span> <strong>COVID-19</strong> — 居家隔离驱动 Steam 月活激增，独立游戏销量创历史新高。' +
      '<br><br>' +
      '<strong>深层洞察：</strong>平台开放带来了数量爆炸的同时，也引发了<em>"发现性危机"（Discoverability Crisis）</em>——' +
      lastYear.year + '年平均每天有约 ' + dailyNew + ' 款新游戏上架，' +
      '单款游戏的中位曝光机会反而低于2014年。数量增长并不等于生态健康，这一矛盾贯穿独立游戏崛起的全过程。';
    insight1.dataset.typewriterHtml = html1;
    // var html1 =
    //   '<span class="event-chip">2012</span> <strong>Steam Greenlight</strong> — 开放第三方上架，推动独立游戏年发布量在次年首次超越 AA+3A 之和；' +
    //   '<span class="event-chip">2017</span> <strong>Steam Direct</strong> — 取消审核门槛，Indie 年发布量从约 ' + preCount +
    //   ' <em>跳升至 ' + directCount + '（+' + jumpPct + '%）</em>；' +
    //   '<span class="event-chip">2020</span> <strong>COVID-19</strong> — 居家隔离驱动 Steam 月活激增，独立游戏销量创历史新高。' +
    //   '<br><br>' +
    //   '<strong>深层洞察：</strong>平台开放带来了数量爆炸的同时，也引发了<em>"发现性危机"（Discoverability Crisis）</em>——' +
    //   lastYear.year + '年平均每天有 ' + dailyNew + ' 款新游戏上架，' +
    //   '单款游戏的中位曝光机会反而低于2014年。数量增长并不等于生态健康，这一矛盾贯穿独立游戏崛起的全过程。';
    // insight1.dataset.typewriterHtml = html1;
  }

  // ── Insight 2: Scatter (quality) ──
  var insight2 = document.getElementById('insight-scatter');
  if (insight2 && m.pos_rate_median) {
    var indiePR = m.pos_rate_median.Indie != null ? m.pos_rate_median.Indie : 75;
    var aaaPR   = m.pos_rate_median.AAA != null ? m.pos_rate_median.AAA : 74;

    // 神作象限 CCU 阈值数据驱动（与 scatter / synthesis 同源）
    var godCcu = (typeof godCcuThreshold === 'function') ? godCcuThreshold() : 100000;
    var godIndie = DATA.bubbles.filter(function(d) { return d.type === 'Indie' && d.pr > 90 && d.ccu > godCcu; }).length;
    var godAAA   = DATA.bubbles.filter(function(d) { return d.type === 'AAA'   && d.pr > 90 && d.ccu > godCcu; }).length;

    // 顶尖好评率（前5均值）看天花板
    var ceilI = (typeof topKPosRate === 'function' && topKPosRate('Indie', 5)) || indiePR;
    var ceilA = (typeof topKPosRate === 'function' && topKPosRate('AAA', 5))   || aaaPR;

    // 中位方向自适应：不写死“持平”
    var medianSentence = indiePR >= aaaPR
      ? '独立游戏中位好评率（<em>' + indiePR + '%</em>）已追平甚至反超3A大作（<em>' + aaaPR + '%</em>）。'
      : '独立游戏顶尖作品好评率（前5均值 <em>' + ceilI + '%</em>）已与3A（<em>' + ceilA + '%</em>）并肩；' +
        '但<em>整体</em>中位（独立 <em>' + indiePR + '%</em> vs 3A <em>' + aaaPR + '%</em>）仍被海量长尾拉低——天花板追平，差距在地板。';

    var godSentence = '右上"神作象限"（好评率>90% & 在线>' + fmt.ccu(godCcu) + '）中，独立 <em>' + godIndie + '</em> 款 vs 3A <em>' + godAAA + '</em> 款。';

    var html2 =
      medianSentence + godSentence +
      '<br><br>' +
      '<strong>值得注意的模式：</strong>图中可见独立游戏的分布呈"倒L型"——多数集中在<em>高好评但低人气</em>区域，' +
      '说明独立游戏的质量天花板已经打破，但<em>市场注意力的分配仍然极度不均</em>。' +
      '少数"破圈"独立作品（如 Palworld、Valheim）的人气可比肩3A，但大多数优质独立作品仍面临"叫好不叫座"的困境。';
    insight2.dataset.typewriterHtml = html2;
  }

  // ── Insight 3: Decay (retention) ──
  var insight3 = document.getElementById('insight-decay');
  if (insight3) {
    var indieDecays = DATA.decay.filter(function(d) { return d.type === 'Indie'; });
    var bestIndie = null, bestRetain = 0;
    indieDecays.forEach(function(d) {
      var m24 = d.data[24] != null ? d.data[24] : (d.data[d.data.length - 1] || 0);
      if (m24 > bestRetain) { bestRetain = m24; bestIndie = d; }
    });
    var bestRetainPct = Math.round(bestRetain * 100);
    var bestName = bestIndie ? bestIndie.name : 'Terraria';

    var aaaDecays = DATA.decay.filter(function(d) { return d.type === 'AAA'; });
    var aaaAvg3 = 20;
    if (aaaDecays.length) {
      var sum = aaaDecays.reduce(function(s, d) { return s + (d.data[3] != null ? d.data[3] : 0.15); }, 0);
      aaaAvg3 = Math.round(sum / aaaDecays.length * 100);
    }

    var html3 =
      '<strong>3A大作</strong>（红色系）：营销驱动的首发热潮在 3 个月内消退，峰值普遍降至 <em>' + aaaAvg3 + '%</em> 以下，验证了"买了即弃"的消费模式；' +
      '<em>独立游戏长青款</em>（绿色系）：口碑驱动的持续流量，《' + bestName + '》发布 24 个月后仍保持峰值 <em>' + bestRetainPct + '%</em> 的日活；' +
      '<strong>F2P游戏</strong>：内容更新维持曲线最为平坦，商业模式与留存高度绑定。' +
      '<br><br>' +
      '<strong>核心发现：</strong>留存曲线的形状差异揭示了两种根本不同的<em>商业模式</em>：' +
      '3A依赖首周销量爆发，回收高额开发成本，因此必须重营销轻社区；' +
      '独立游戏依赖口碑长尾，首月成绩可能平平，但12个月后的留存率反而决定了总收入。' +
      '这解释了为什么越来越多的独立工作室选择<em>Early Access</em>策略——它本质上是用时间换曝光，用社区反馈代替营销预算。';
    insight3.dataset.typewriterHtml = html3;
  }

  // ── Data source indicator ──
  var badge = document.getElementById('data-source-badge');
  if (badge && window._dataSource) {
    var src = window._dataSource;
    var layer = window._dataLayer || '';
    if (src === 'api') {
      var layerText = {
        'top100': 'SteamSpy Top100 实时爬取',
        'local+top100': '实时爬取 + 本地历史数据',
        'full': 'SteamSpy 全量实时数据',
      }[layer] || '后端API实时数据';
      badge.innerHTML = '<span class="badge-icon" style="border-color:var(--indie);color:var(--indie)">✓</span>' +
        '<span class="badge-text" style="color:var(--indie)">' + layerText + ' · ' + fmt.num(DATA.meta.total_games) + ' 款游戏</span>';
    } else if (src === 'file') {
      badge.innerHTML = '<span class="badge-icon" style="border-color:var(--aa);color:var(--aa)">⚡</span>' +
        '<span class="badge-text" style="color:var(--aa)">静态文件数据 · ' + fmt.num(DATA.meta.total_games) + ' 款游戏</span>';
    } else {
      badge.innerHTML = '<span class="badge-icon">⚠</span>' +
        '<span class="badge-text">内嵌示例数据 · 运行 python server.py 启动实时数据服务</span>';
    }
    badge.style.display = 'flex';
  }
}

// ── Main entry ──────────────────────────────────
(async function main() {
  var result = await window.loadRealData();
  window._dataSource = result.source || 'embedded';
  window._dataLayer = result.layer || '';

  var anyReal = result.market || result.bubbles;
  if (anyReal) {
    console.log('[main] Data loaded from: ' + result.source);
  } else {
    console.info('[main] No real data — using embedded fallback.');
    console.info('       Run: python server.py');
  }

  // Update hero stats from data BEFORE charts init
  updateHeroStats();

  // Init counter animations
  initHeroCounters();

  // Init charts
  initStream();
  initScatter();
  initScrollNarrative();
  initDecay();
  initMethod();
  initSynthesis();
  initGenre();
  initTour();

  // Inject data-driven insights
  updateInsights();

  // ── 后台实时爬取：页面已渲染，异步更新数据 ──
  if (result.source === 'api' && window.backgroundRefresh) {
    setTimeout(window.backgroundRefresh, 500);
  }

  // 绑定刷新按钮
  document.getElementById("refresh-btn")?.addEventListener("click", function() {
    window.refreshData();
  });
})();

// ════════════════════════════════════════════════