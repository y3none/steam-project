//  GUIDED TOUR — 自动导览 / 故事播放模式
//  复用现有 narrative 钩子，逐段滚动 + 字幕，专为录制演示视频 / 答辩兜底设计
// ════════════════════════════════════════════════
window.initTour = function() {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollOpt = { behavior: RM ? "auto" : "smooth", block: "start" };

  // 把元素垂直居中到视口（带顶部下限，避免遮住吸顶图例条）
  function centerInView(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const desired = window.scrollY + rect.top - Math.max(80, (window.innerHeight - rect.height) / 2);
    const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.max(0, Math.min(desired, maxTop)), behavior: scrollOpt.behavior });
  }
  // genre 图表在切换工作室规模时会重绘，重绘后再居中一次（高度稳定，通常无跳动）
  function recenterGenre() {
    const box = document.querySelector("#sec-genre .chart-box");
    if (box) centerInView(box);
  }

  // ── narrative 复位（退出 / 开场时回到中性状态） ──
  function resetAll() {
    window._streamSelectYear && window._streamSelectYear(null);
    window._scatterApplyNarrative && window._scatterApplyNarrative({ filter: "all", highlightQuadrant: false });
    window._decayApplyNarrative && window._decayApplyNarrative({ compareIndieAAA: false });
    window._genreResetNarrative && window._genreResetNarrative();
  }

  // ── 步骤定义：每段 = 滚动目标 + 字幕 + 触发动作 + 停留时长 ──
  const steps = [
    {
      sel: ".hero", chapter: "PROLOGUE", title: "Steam 二十年 · 独立游戏崛起史",
      text: "2004 到 2024，全球最大 PC 游戏生态被一群没有发行商、没有营销预算的独立开发者悄悄改写。我们用三个视图，讲清楚这件事是怎么发生的。",
      dur: 7000,
      action() { resetAll(); window.scrollTo({ top: 0, behavior: scrollOpt.behavior }); },
    },
    {
      sel: "#sec-stream", chapter: "01 · 数量", title: "平台开放，闸门打开",
      text: "Greenlight(2012)与 Direct(2017)拆除上架门槛后，独立游戏发布量呈指数级爆炸。沿时间线依次走过三个关键节点，最后停在转折之年 2017（Steam Direct）。",
      dur: 8000,
      action() { window._streamSelectYear && window._streamSelectYear(2017); },
      // 动态：沿时间线依次高亮 2012→2017→2020，最后回落到 2017
      anim(A) {
        [2012, 2017, 2020, 2017].forEach((y, k) => A.later(() => A.stream(y), k * 1300));
      },
    },
    {
      sel: "#sec-scatter", chapter: "跨视图联动", title: "一次点击，两图联动",
      text: "注意散点图随年份实时重筛：在 2016 → 2018 → 2017 之间擦动，每次都由河流图的年份联动驱动——这就是我们的跨视图下钻设计。",
      dur: 7500,
      action() { window._streamSelectYear && window._streamSelectYear(2017); },
      // 动态：在相邻年份间擦动，让散点图当场重新筛选，最后落到 2017
      anim(A) {
        [2016, 2018, 2017].forEach((y, k) => A.later(() => A.stream(y), k * 1500));
      },
    },
    {
      sel: "#sec-scatter", chapter: "02 · 质量", title: "口碑追平，质量祛魅",
      text: "解除年份筛选 → 淡出非独立游戏 → 点亮「神作象限」，分步聚焦：曾经口碑差 3A 一大截的独立游戏，如今在高口碑×高人气的右上角已能与大厂平起平坐。",
      dur: 8500,
      action() {
        window._streamSelectYear && window._streamSelectYear(null);
        window._scatterApplyNarrative && window._scatterApplyNarrative({ filter: "Indie", highlightQuadrant: true });
      },
      // 动态：先全量 → 淡到只剩独立 → 再点亮象限，三步引导
      anim(A) {
        A.stream(null);
        A.scatter({ filter: "all", highlightQuadrant: false });
        A.later(() => A.scatter({ filter: "Indie", highlightQuadrant: false }), 1000);
        A.later(() => A.scatter({ filter: "Indie", highlightQuadrant: true }), 2200);
      },
    },
    {
      sel: "#sec-decay", chapter: "03 · 留存", title: "长尾留存，收入兑现",
      text: "先铺开全部曲线、再聚焦独立 vs 3A，最后一条时间游标从第 0 月扫到第 24 月——看两者留存差距如何在头几个月迅速拉开、并长期保持。决定总收入的不是首月，而是长尾。",
      dur: 10500,
      action() { window._decayApplyNarrative && window._decayApplyNarrative({ compareIndieAAA: true }); },
      // 动态：全部曲线 → 聚焦 Indie/AAA → 时间游标扫描（差距实时拉开）
      anim(A) {
        A.decay({ compareIndieAAA: false });
        A.later(() => A.decay({ compareIndieAAA: true }), 1000);
        A.later(() => A.sweep(4800), 2300);
      },
    },
    {
      sel: "#sec-synthesis", chapter: "05 · 结论", title: "三因一果",
      text: "数量爆炸 × 顶尖口碑追平 × 长尾留存 = 独立游戏拿下近半 Steam 收入。但数量的另一面是“发现性危机”——崛起的是整体，多数开发者仍困在长尾。这就是我们想留下的问题。",
      dur: 3000,
      action() { /* 结论视图为静态内容，仅滚动到位 */ },
      // 动态：三张因卡依次浮现 + 大数字滚动计数
      anim(A) { A.synth(); },
    },
    {
      sel: "#sec-genre", centerSel: ".chart-box", chapter: "尾声 · 给从业者", title: "那，该做一款什么游戏？",
      text: "我们把结论交回开发者手里：按玩法品类铺开供给与需求，左上角是需求高、对手少的蓝海。切到「独立」——地图重算成你这个段位的真实机会。这才是这套系统的落点：不止说明过去，更指向该做什么。",
      dur: 7500,
      action() { window._genreSetScope && window._genreSetScope("Indie"); },
      // 动态：全貌 → 点亮蓝海 → 切到独立段位；每次重算后重新居中
      anim(A) {
        A.later(() => A.genre({ highlightBlueOcean: false }), 0);
        if (window._genreSetScope) {
          A.later(function () { window._genreSetScope("All"); recenterGenre(); }, 200);
          A.later(() => A.genre({ highlightBlueOcean: true }), 1500);
          A.later(function () { window._genreSetScope("Indie"); recenterGenre(); }, 3000);
        }
      },
    },
  ];

  // ── 构建 UI ─────────────────────────────────────
  // 1) 常驻启动按钮
  const launch = document.createElement("button");
  launch.id = "tour-launch";
  launch.innerHTML = `<span class="tl-icon">▶</span><span class="tl-text">播放完整故事</span>`;
  document.body.appendChild(launch);

  // 2) 字幕 / 控制条（默认隐藏）
  const bar = document.createElement("div");
  bar.id = "tour-bar";
  bar.innerHTML = `
    <div class="tour-progress" id="tour-progress"></div>
    <div class="tour-body">
      <div class="tour-meta">
        <span class="tour-chapter" id="tour-chapter"></span>
        <span class="tour-step" id="tour-step"></span>
      </div>
      <div class="tour-title" id="tour-title"></div>
      <div class="tour-text" id="tour-text"></div>
    </div>
    <div class="tour-controls">
      <button class="tour-ctrl" id="tour-prev" title="上一段">‹</button>
      <button class="tour-ctrl tour-play" id="tour-play" title="播放 / 暂停">⏸</button>
      <button class="tour-ctrl" id="tour-next" title="下一段">›</button>
      <button class="tour-ctrl tour-exit" id="tour-exit" title="退出导览">✕</button>
    </div>`;
  document.body.appendChild(bar);

  // progress dots（每个点是轨道，内含绿色填充条用作倒计时进度）
  const progEl = bar.querySelector("#tour-progress");
  steps.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "tour-dot";
    dot.dataset.i = i;
    dot.innerHTML = '<span class="tour-dot-fill"></span>';
    dot.addEventListener("click", () => goTo(i));
    progEl.appendChild(dot);
  });

  // 进度填充控制：done=满，future=空，current 播放时动画倒计时、暂停时冻结
  function setDotFill(dotEl, pct, animateMs) {
    const fill = dotEl && dotEl.querySelector(".tour-dot-fill");
    if (!fill) return;
    if (animateMs) {
      fill.style.transition = "none"; fill.style.width = "0%";
      void fill.offsetWidth; // 强制重排，重启动画
      fill.style.transition = "width " + animateMs + "ms linear";
      fill.style.width = "100%";
    } else {
      fill.style.transition = "none";
      fill.style.width = pct + "%";
    }
  }
  function freezeCurrentFill() {
    const dot = progEl.querySelector(".tour-dot.current");
    const fill = dot && dot.querySelector(".tour-dot-fill");
    if (!fill) return;
    fill.style.width = getComputedStyle(fill).width; // 冻结在当前宽度
    fill.style.transition = "none";
  }

  // ── 状态机 ──────────────────────────────────────
  let idx = 0, playing = false, timer = null, active = false;
  const $ = id => bar.querySelector(id);

  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  // 章节内动态序列：用可取消的定时器编排分阶段呈现
  let animTimers = [];
  function later(fn, ms) { const id = setTimeout(fn, ms); animTimers.push(id); return id; }
  function clearAnim() { animTimers.forEach(clearTimeout); animTimers = []; }
  // 供各章节 anim() 调用的便捷别名
  const A = {
    stream: y => window._streamSelectYear && window._streamSelectYear(y),
    scatter: o => window._scatterApplyNarrative && window._scatterApplyNarrative(o),
    decay: o => window._decayApplyNarrative && window._decayApplyNarrative(o),
    sweep: ms => window._decaySweep && window._decaySweep(ms),
    synth: () => window._synthesisReplay && window._synthesisReplay(),
    genre: o => window._genreApplyNarrative && window._genreApplyNarrative(o),
    later,
  };

  function render() {
    const s = steps[idx];
    $("#tour-chapter").textContent = s.chapter;
    $("#tour-step").textContent = `${idx + 1} / ${steps.length}`;
    $("#tour-title").textContent = s.title;
    $("#tour-text").textContent = s.text;
    progEl.querySelectorAll(".tour-dot").forEach((d, i) => {
      d.classList.toggle("done", i < idx);
      d.classList.toggle("current", i === idx);
      // 非当前点直接置满/空；当前点的填充由 goTo 控制（动画或冻结）
      if (i < idx) setDotFill(d, 100);
      else if (i > idx) setDotFill(d, 0);
    });
    $("#tour-prev").disabled = idx === 0;
    $("#tour-next").disabled = idx === steps.length - 1;
  }

  function goTo(i, keepPlaying) {
    clearTimer();
    clearAnim();
    idx = Math.max(0, Math.min(steps.length - 1, i));
    const s = steps[idx];
    const target = document.querySelector(s.sel);
    if (target) {
      if (s.sel === ".hero") {
        window.scrollTo({ top: 0, behavior: scrollOpt.behavior });
      } else if (s.centerSel) {
        // 把章节内的指定元素（通常是图表框）垂直居中到视口——
        // 用于页面末尾的区块：scrollIntoView(block:"start") 会因文档底部
        // 不足以下滚而被钳制，导致图表停在视口下半（有半截在折叠线以下）。
        // 末尾已加 .scroll-runway 提供下滚余量，这里再做一次精确居中。
        centerInView(target.querySelector(s.centerSel) || target);
      } else {
        target.scrollIntoView(scrollOpt);
      }
    }
    // 等滚动落定再触发：非 reduced-motion 且该章有 anim() → 播放动态序列；否则直接到终态
    setTimeout(() => {
      try {
        if (!RM && s.anim) s.anim(A);
        else s.action();
      } catch (e) { console.warn("[tour]", e); }
    }, RM ? 0 : 450);
    render();
    // 当前进度点：播放中→倒计时动画；暂停→置空或冻结
    const curDot = progEl.querySelector(".tour-dot.current");
    const willPlay = (keepPlaying ?? playing);
    if (curDot) {
      if (willPlay) setDotFill(curDot, null, s.dur);
      else setDotFill(curDot, 0);
    }
    if (willPlay) {
      timer = setTimeout(() => {
        if (idx < steps.length - 1) {
          goTo(idx + 1, true);
        } else {
          const dot = progEl.querySelector(".tour-dot.current");
          if (dot) setDotFill(dot, 100);
          setPlaying(false);
        }
      }, s.dur);
    }
  }

  function setPlaying(p) {
    playing = p;
    $("#tour-play").textContent = p ? "⏸" : "▶";
    if (p) {
      goTo(idx, true);
    } else {
      clearTimer();
      freezeCurrentFill(); // 暂停时把倒计时绿条冻结在当前位置，给出明确反馈
    }
  }

  function start() {
    if (active) return;
    active = true;
    document.body.classList.add("tour-active");
    bar.classList.add("show");
    idx = 0;
    setPlaying(true);
  }

  function exit() {
    active = false;
    clearTimer();
    clearAnim();
    playing = false;
    bar.classList.remove("show");
    document.body.classList.remove("tour-active");
    resetAll();
  }

  // ── 事件绑定 ────────────────────────────────────
  launch.addEventListener("click", start);
  $("#tour-play").addEventListener("click", () => setPlaying(!playing));
  $("#tour-prev").addEventListener("click", () => { setPlaying(false); goTo(idx - 1, false); });
  $("#tour-next").addEventListener("click", () => { setPlaying(false); goTo(idx + 1, false); });
  $("#tour-exit").addEventListener("click", exit);

  // 键盘：空格 播放/暂停，← → 切换，Esc 退出
  document.addEventListener("keydown", e => {
    if (!active) return;
    if (e.code === "Space") { e.preventDefault(); setPlaying(!playing); }
    else if (e.code === "ArrowRight") { setPlaying(false); goTo(idx + 1, false); }
    else if (e.code === "ArrowLeft") { setPlaying(false); goTo(idx - 1, false); }
    else if (e.code === "Escape") exit();
  });
};
// ════════════════════════════════════════════════