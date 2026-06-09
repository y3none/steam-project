//  SCROLL-DRIVEN NARRATIVE — view 2 & view 3
//  - For sections in viewport at load, scatter.js handles initial state directly
//  - For sections below fold, IntersectionObserver triggers on scroll
//  - Toggle button lets user replay anytime
// ════════════════════════════════════════════════

function createNarrativeController(opts) {
  var section = document.getElementById(opts.section);
  if (!section) return;

  var DURATION = opts.duration || 4000;
  var resetTimer = null;
  var active = false;
  var label = opts.label || '聚焦';

  // ── Inject toggle button ──
  var controls = section.querySelector(opts.controlsSelector);
  if (!controls) return;

  var sep = document.createElement('span');
  sep.className = 'pill-sep';
  sep.textContent = '|';
  controls.appendChild(sep);

  var btn = document.createElement('button');
  btn.className = 'pill';
  btn.innerHTML = '▶ ' + label;
  btn.title = opts.tooltip || '';
  controls.appendChild(btn);

  function activate(autoReset) {
    if (active) return;
    active = true;
    btn.classList.add('active');
    btn.innerHTML = '■ ' + label;
    opts.applyFn();
    if (autoReset) resetTimer = setTimeout(deactivate, DURATION);
  }

  function deactivate() {
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
    if (!active) return;
    active = false;
    btn.classList.remove('active');
    btn.innerHTML = '▶ ' + label;
    opts.resetFn();
  }

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    active ? deactivate() : activate(false);
  });

  section.addEventListener('pointerdown', function(e) {
    if (!active || e.target === btn || btn.contains(e.target)) return;
    // 点击气泡（.bub）不退出叙事模式，只有点空白区域才退出
    if (e.target.closest('.bub')) return;
    deactivate();
  });

  // ── Scroll trigger ──
  // 不自动激活：按钮仅在用户主动点击时才激活叙事模式
  // （移除原来的「section 已在视口时自动激活」逻辑）
  var scrollTriggered = false;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (!e.isIntersecting || scrollTriggered) return;
      scrollTriggered = true;
      // 只标记 insight 为已揭示，不自动激活叙事按钮
      var insight = document.getElementById(opts.insightId);
      if (insight) insight.classList.add('narrative-reveal');
      observer.disconnect();
    });
  }, { threshold: 0.15 });

  observer.observe(section);
}

function initScatterNarrative() {
  createNarrativeController({
    section: 'sec-scatter',
    controlsSelector: '.scatter-controls-left .scatter-row',
    insightId: 'insight-scatter',
    label: '聚焦 Indie',
    tooltip: '高亮独立游戏的"神作象限"（好评>90% & CCU>100k）',
    applyFn: function() {
      window._scatterApplyNarrative?.({ filter: 'Indie', highlightQuadrant: true });
    },
    resetFn: function() {
      window._scatterApplyNarrative?.({ filter: 'all', highlightQuadrant: false });
    },
  });
}

function initDecayNarrative() {
  createNarrativeController({
    section: 'sec-decay',
    controlsSelector: '.section-controls',
    insightId: 'insight-decay',
    label: '对比 Indie vs 3A',
    tooltip: '高亮独立游戏与3A大作的留存差异',
    applyFn: function() {
      window._decayApplyNarrative?.({ compareIndieAAA: true });
    },
    resetFn: function() {
      window._decayApplyNarrative?.({ compareIndieAAA: false });
    },
  });
}

window.initScrollNarrative = function() {
  initScatterNarrative();
  initDecayNarrative();
};
// ════════════════════════════════════════════════