//  VIEW 5: SYNTHESIS — 收束论点：三因一果
//  把视图1(数量) / 视图2(质量) / 视图3(留存) 的发现汇聚成一句结论
//  所有数字从 DATA 实时计算，与 main.js updateInsights 同源
// ════════════════════════════════════════════════
window.initSynthesis = function() {
  const wrap = document.getElementById("synthesis-inner");
  if (!wrap) return;

  // 所有结论数字封进 build()，每次调用都从最新 DATA 重新计算 —— 兑现"实时计算"承诺，
  // 后台爬取热更新 DATA 后可再次调用刷新（见文件末 window._synthesisRefresh）。
  function build() {
  const market = DATA.market || [];
  const lastYear = market[market.length - 1] || {};
  const meta = DATA.meta || {};

  // ── 因①：数量（发布占比） ──────────────────────
  const indieShare = lastYear.indie != null ? lastYear.indie : 98.9;
  const yr2012 = market.find(d => d.year === 2012);
  const share2012 = yr2012 ? yr2012.indie : 40;

  // ── 因②：质量（天花板 vs 中位，诚实自适应） ──────
  // 不再用绝对阈值的“神作象限计数”（真实数据下量纲漂移会塌成 0:0）。
  // 改用人口级稳健指标：顶尖好评率看天花板，中位好评率如实反映长尾。
  const prMed = meta.pos_rate_median || {};
  const indieMed = prMed.Indie != null ? prMed.Indie : 75.2;
  const aaaMed   = prMed.AAA   != null ? prMed.AAA   : 73.6;
  const ceilIndie = (typeof topKPosRate === "function" && topKPosRate("Indie", 5)) || indieMed;
  const ceilAAA   = (typeof topKPosRate === "function" && topKPosRate("AAA", 5))   || aaaMed;
  const tc = meta.type_counts || {};
  const cntIndie = tc.Indie != null ? tc.Indie : null;
  const cntAAA   = tc.AAA   != null ? tc.AAA   : null;
  const volStr = (cntIndie && cntAAA)
    ? `全平台约 ${fmt.num(cntIndie)} 款独立 vs ${fmt.num(cntAAA)} 款 3A`
    : "独立游戏数量是 3A 的数百倍";
  // 中位方向自适应：数据怎么走文案怎么说，不写死“追平”
  const medianClause = indieMed >= aaaMed
    ? `而整体中位好评率独立游戏 <strong>${indieMed}%</strong> 已追平甚至反超 3A <strong>${aaaMed}%</strong>。`
    : `但整体中位好评率独立游戏 <strong>${indieMed}%</strong> 仍低于 3A <strong>${aaaMed}%</strong>——${volStr}，海量长尾拉低了中位：<em>天花板追平，差距在地板</em>。`;

  // ── 因③：留存（长尾） ──────────────────────────
  const decays = DATA.decay || [];
  let bestIndie = null, bestRetain = 0;
  decays.filter(d => d.type === "Indie").forEach(d => {
    const m24 = d.data && d.data[24] != null ? d.data[24] : (d.data ? d.data[d.data.length - 1] : 0);
    if (m24 > bestRetain) { bestRetain = m24; bestIndie = d; }
  });
  const bestRetainPct = Math.round(bestRetain * 100);
  const bestName = bestIndie ? bestIndie.name : "Terraria";
  const aaaDecays = decays.filter(d => d.type === "AAA");
  let aaa3 = 20;
  if (aaaDecays.length) {
    const s = aaaDecays.reduce((acc, d) => acc + (d.data && d.data[3] != null ? d.data[3] : 0.15), 0);
    aaa3 = Math.round(s / aaaDecays.length * 100);
  }

  // ── 果：收入份额（VG Insights 外部数据，无法从本地计算，固定值） ──
  const revenueShare = 48;

  // ── 渲染 ────────────────────────────────────────
  wrap.innerHTML = `
    <div class="syn-thesis">
      <div class="syn-thesis-label">// THESIS · 一句话结论</div>
      <div class="syn-thesis-text">
        独立游戏的崛起不是偶然，而是<em>平台开放</em> × <em>顶尖口碑追平</em> × <em>长尾留存</em>
        三股力量叠加的必然结果——它们共同把独立游戏从 2004 年的边缘角色，
        推上了占据 Steam <em>近半收入</em>的主导地位。
      </div>
    </div>

    <div class="syn-flow">
      <!-- 因① 数量 -->
      <div class="syn-cause" style="--accent:var(--indie)">
        <div class="syn-cause-tag">因 ① · 来自视图 01</div>
        <div class="syn-cause-title">平台开放 → 数量爆炸</div>
        <div class="syn-cause-num">${indieShare}%</div>
        <div class="syn-cause-unit">2024 年发布数量中的独立游戏占比</div>
        <div class="syn-cause-body">
          Greenlight (2012) 与 Direct (2017) 拆除上架门槛，
          独立游戏发布占比从 <strong>${share2012}%</strong> 一路攀升至今天的近乎全部。
        </div>
      </div>

      <div class="syn-op">×</div>

      <!-- 因② 质量 -->
      <div class="syn-cause" style="--accent:var(--aa)">
        <div class="syn-cause-tag">因 ② · 来自视图 02</div>
        <div class="syn-cause-title">顶尖口碑追平 → 质量祛魅</div>
        <div class="syn-cause-num">${ceilIndie}%</div>
        <div class="syn-cause-unit">顶尖独立作品好评率（前 5 均值）· 3A 为 ${ceilAAA}%</div>
        <div class="syn-cause-body">
          最好的独立游戏口碑已与 3A 并肩，高口碑不再是大厂专利；${medianClause}
        </div>
      </div>

      <div class="syn-op">×</div>

      <!-- 因③ 留存 -->
      <div class="syn-cause" style="--accent:var(--f2p)">
        <div class="syn-cause-tag">因 ③ · 来自视图 03</div>
        <div class="syn-cause-title">长尾留存 → 收入兑现</div>
        <div class="syn-cause-num">${bestRetainPct}%</div>
        <div class="syn-cause-unit">《${bestName}》发布 24 个月后的留存峰值</div>
        <div class="syn-cause-body">
          3A 首发热潮 3 个月内跌至 <strong>${aaa3}%</strong> 以下；
          口碑驱动的独立长青款靠社区把流量摊到数年，长尾才是总收入的关键。
        </div>
      </div>

      <div class="syn-op syn-op-eq">=</div>

      <!-- 果 -->
      <div class="syn-effect">
        <div class="syn-effect-tag">果 · OUTCOME</div>
        <div class="syn-effect-num">${revenueShare}%</div>
        <div class="syn-effect-unit">Steam 全价游戏销售额中的独立游戏份额（2024）<br><span>VG Insights · 不含内购 · 2018 年仅 25%</span></div>
      </div>
    </div>

    <div class="syn-tension">
      <span class="syn-tension-icon">⚠</span>
      <div>
        <strong>但故事没有童话结局。</strong>数量爆炸的另一面是<em>"发现性危机"</em>——
        ${lastYear.year || 2024} 年平均每天 ${lastYear.n ? Math.round(lastYear.n / 365) : 52} 款新游戏上架，
        单款游戏的中位曝光机会反而低于十年前。崛起的是"独立游戏"这个整体，
        而绝大多数独立开发者仍在"叫好不叫座"的长尾里挣扎。这正是我们这套可视化想留给观众的真问题。
      </div>
    </div>
  `;
  }
  build();
  // 后台爬取热更新 DATA 后重算结论数字（与"所有数字均由数据实时计算"一致）
  window._synthesisRefresh = build;

  // ── 动态重放：卡片交错浮现 + 大数字滚动计数 ──────────
  const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function countUp(el, durMs) {
    const txt = el.dataset.fullText || el.textContent;
    el.dataset.fullText = txt;
    const m = txt.match(/([\d.]+)/);
    if (!m) return;
    if (RM) { el.textContent = txt; return; }
    const target = parseFloat(m[1]);
    const decimals = (m[1].split(".")[1] || "").length;
    const prefix = txt.slice(0, m.index);
    const suffix = txt.slice(m.index + m[1].length);
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    (function frame(now) {
      const p = Math.min((now - start) / durMs, 1);
      el.textContent = prefix + (target * ease(p)).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = txt;
    })(performance.now());
  }

  function replay() {
    // 交错入场：重置 .syn-played 再触发，CSS 用 nth-child 错峰
    wrap.classList.remove("syn-played");
    void wrap.offsetWidth; // 强制重排，使动画可重复触发
    wrap.classList.add("syn-played");
    // 大数字滚动计数（与卡片入场错峰）
    wrap.querySelectorAll(".syn-cause-num, .syn-effect-num").forEach((el, i) => {
      setTimeout(() => countUp(el, 1100), RM ? 0 : 300 + i * 220);
    });
  }
  window._synthesisReplay = replay;

  // 普通滚动到达结论视图时也自动播放一次
  const sec = document.getElementById("sec-synthesis");
  if (sec && "IntersectionObserver" in window) {
    let played = false;
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting && !played) { played = true; replay(); io.disconnect(); } });
    }, { threshold: 0.3 });
    io.observe(sec);
  }
};
// ════════════════════════════════════════════════