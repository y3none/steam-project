//  MAIN ENTRY — init, observers, resize
// ════════════════════════════════════════════════

// Intersection observer with staggered entrance
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      // Stagger child animations
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.06 });
document.querySelectorAll('.section').forEach(s => io.observe(s));

// Debounced resize
let rt;
window.addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    window._streamRedraw?.();
    window._scatterRedraw?.();
    window._decayRedraw?.();
  }, 220);
});

// ── Main entry ──────────────────────────────────
(async function main() {
  const result = await window.loadRealData();
  const anyReal = Object.values(result).some(Boolean);
  if (anyReal) {
    console.log('[main] Using real data from processed/');
  } else {
    console.info('[main] No processed data found — using embedded fallback data.');
    console.info('       Run scripts/03_preprocess.py to generate real data.');
  }
  initStream();
  initScatter();
  initDecay();
  initMethod();
})();

// ════════════════════════════════════════════════
