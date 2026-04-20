//  COLORS & UTILS
// ════════════════════════════════════════════════
const C = { Indie:"#1de9b6", AA:"#ffd54f", AAA:"#ff5252", F2P:"#69f0ae" };
const TL = { Indie:"独立游戏", AA:"中型AA", AAA:"3A大作", F2P:"免费F2P" };
const fmt = {
  pct:   v => v.toFixed(1) + "%",
  ccu:   v => v >= 1e6 ? (v/1e6).toFixed(2)+"M" : v >= 1e3 ? (d3.format(".0f")(v/1e3))+"k" : String(v),
  own:   v => v >= 1 ? v.toFixed(1)+"M" : (v*1000).toFixed(0)+"k",
  price: v => v === 0 ? "FREE" : "$"+v.toFixed(2),
  num:   v => v.toLocaleString(),
};

// Tooltip — single implementation
const tip = document.getElementById("tip");
const TIP = {
  show(html, e) { tip.innerHTML = html; tip.style.opacity = "1"; TIP.move(e); },
  move(e) {
    const [x,y] = [e.clientX, e.clientY];
    const [tw,th] = [tip.offsetWidth, tip.offsetHeight];
    tip.style.left = (x+16+tw > innerWidth ? x-tw-12 : x+16) + "px";
    tip.style.top  = Math.max(8, y-10+th > innerHeight ? innerHeight-th-8 : y-10) + "px";
  },
  hide() { tip.style.opacity = "0"; },
};

// ── Cross-view event bus ─────────────────────────
// Stream → Scatter year linking
const EVT = {
  _handlers: {},
  on(name, fn)  { (this._handlers[name]||(this._handlers[name]=[])).push(fn); },
  emit(name, d) { (this._handlers[name]||[]).forEach(fn=>fn(d)); },
};
// ════════════════════════════════════════════════
