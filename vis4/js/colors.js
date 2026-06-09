//  COLORS & UTILS
// ════════════════════════════════════════════════
// 制作规模 tier（填充色，三档）：Indie / AA / AAA
const C = { Indie:"#1de9b6", AA:"#ffd54f", AAA:"#ff5252", F2P:"#4dabf7" };
const TL = { Indie:"独立游戏", AA:"中型AA", AAA:"3A大作", F2P:"免费F2P" };
// 商业模式 monetization（与 tier 正交）：买断 / 免费 / 混合
// 配色按【冷暖对立】区分免费↔买断：买断=暖琥珀、免费=亮青、混合=紫，
// 三色色相分得开，免费/买断一眼可辨（旧版三色都偏冷灰，区分度不足）。
const MON  = { Premium:"买断制", F2P:"免费F2P", Hybrid:"混合模式" };
const MONC = { Premium:"#ff9f43", F2P:"#18d6e0", Hybrid:"#b56bff" };
// 取气泡的商业模式标签 / 颜色（统一入口，散点·详情·tooltip 共用）
function monOf(d)    { return d.monetization || (d.f2p ? "F2P" : "Premium"); }
function monLabel(d) { return MON[monOf(d)] || monOf(d); }
function monColor(d) { return MONC[monOf(d)] || "#888"; }
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

// ── 稳健统计工具（供散点/结论/洞察共享） ──────────────
// 排序数组的分位数（线性插值）
function quantileSorted(sorted, q) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos), rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

// 某类型好评率“天花板”：评价数足够多的游戏里，好评率前 k 名的均值。
// 关键：必须设最低评价数门槛——否则“天花板”会被一批只有十几条评价、
//   恰好全好评(=100%)的冷门小游戏拼出来，严重高估且不具代表性。
//   门槛逐级放宽 [1000, 100, 0] 兜底，保证总能取到稳健样本。
function topKPosRate(type, k) {
  k = k || 5;
  const pool = (typeof DATA !== "undefined" ? (DATA.bubbles || []) : [])
    .filter(d => d.type === type && d.pr != null);
  const meanTop = arr => arr.length
    ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10 : null;
  for (const floor of [1000, 100, 0]) {
    const prs = pool.filter(d => (d.rc || 0) >= floor)
                    .map(d => d.pr).sort((a, b) => b - a).slice(0, k);
    if (prs.length >= Math.min(k, 3)) return meanTop(prs);
  }
  return meanTop(pool.map(d => d.pr).sort((a, b) => b - a).slice(0, k));
}

// “神作象限”好评率绝对线：90% 始终是可解释的“叫好”门槛
const GOD_PR = 90;

// “神作象限”CCU 阈值：数据驱动，且规避“质量↔人气负相关”陷阱。
//   真实数据里高 CCU 区被高人气低好评的常驻游戏占据，叫好游戏挤在低 CCU 区，
//   因此按“全体 CCU 分位”设线会让象限恒为空。改为：
//   取【好评率≥90% 的游戏】自身 CCU 的中位数作为人气线——
//   即“叫好的游戏里，人气居前的那一半”进入象限，按类型自然分布。
//   · 永远非空（约一半叫好游戏入选）  · 自适应量纲  · 不受 megahit 极值干扰
//   基于全体气泡计算，不随筛选变化，象限框位置稳定。
function godCcuThreshold() {
  const all = (typeof DATA !== "undefined" ? (DATA.bubbles || []) : []);
  const accl = all.filter(d => d.pr != null && d.pr >= GOD_PR && d.ccu > 0)
                  .map(d => d.ccu).sort((a, b) => a - b);
  if (accl.length >= 4) {
    return Math.max(2000, Math.min(100000, Math.round(quantileSorted(accl, 0.5))));
  }
  // 退化兜底：叫好样本太少时，用全体 CCU 高分位
  const c = all.map(d => d.ccu).filter(v => v > 0).sort((a, b) => a - b);
  return c.length ? Math.max(2000, Math.min(100000, Math.round(quantileSorted(c, 0.9)))) : 100000;
}
// ════════════════════════════════════════════════