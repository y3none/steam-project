//  SCROLL-DRIVEN NARRATIVE — view 2 & view 3
// ════════════════════════════════════════════════

function initScatterNarrative() {
  var section = document.getElementById('sec-scatter');
  if (!section) return;

  var triggered = false;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (!e.isIntersecting || triggered) return;
      triggered = true;

      window._scatterApplyNarrative?.({
        filter: 'Indie',
        highlightQuadrant: true,
      });

      var insight = document.getElementById('insight-scatter');
      if (insight) insight.classList.add('narrative-reveal');

      observer.disconnect();
    });
  }, { threshold: 0.35 });

  observer.observe(section);
}

function initDecayNarrative() {
  var section = document.getElementById('sec-decay');
  if (!section) return;

  var triggered = false;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (!e.isIntersecting || triggered) return;
      triggered = true;

      window._decayApplyNarrative?.({ compareIndieAAA: true });

      var insight = document.getElementById('insight-decay');
      if (insight) insight.classList.add('narrative-reveal');

      observer.disconnect();
    });
  }, { threshold: 0.35 });

  observer.observe(section);
}

window.initScrollNarrative = function() {
  initScatterNarrative();
  initDecayNarrative();
};
// ════════════════════════════════════════════════
