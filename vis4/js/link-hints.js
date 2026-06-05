//  LINK HINTS — 让已有的跨视图联动“被看见”
//  非侵入：仅监听 colors.js 里定义的 EVT 总线，给接收方视图加脉冲高亮 + 提示 chip
//  现有联动链：① 市场河流图 ⇄ 散点图（yearSelect）  ② 散点图 → 衰减曲线（decayHighlight）
// ════════════════════════════════════════════════
(function () {
  if (typeof EVT === "undefined") return;

  function flash(sectionId, label) {
    const sec = document.getElementById(sectionId);
    if (!sec) return;
    const box = sec.querySelector(".chart-box") || sec;

    // 边框脉冲
    box.classList.remove("link-pulse");
    void box.offsetWidth; // 强制重排，使动画可重复触发
    box.classList.add("link-pulse");

    // 来源 chip（短暂浮现）
    let chip = sec.querySelector(".link-chip");
    if (!chip) {
      chip = document.createElement("div");
      chip.className = "link-chip";
      box.appendChild(chip);
    }
    chip.textContent = label;
    chip.classList.remove("show");
    void chip.offsetWidth;
    chip.classList.add("show");
    clearTimeout(chip._t);
    chip._t = setTimeout(() => chip.classList.remove("show"), 2200);
  }

  // 市场河流图点击年份 → 散点图被联动（仅在选中某年时提示，清除时不提示）
  EVT.on("yearSelect", yr => { if (yr) flash("sec-scatter", "← 联动自 市场视图 · " + yr + " 年"); });

  // 散点图点击“查看生命周期曲线” → 衰减曲线被联动
  EVT.on("decayHighlight", name => { if (name) flash("sec-decay", "← 联动自 口碑视图 · " + name); });
})();
// ════════════════════════════════════════════════
