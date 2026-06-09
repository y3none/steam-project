//  VIEW 6: GENRE OPPORTUNITY MAP — 该做一款什么游戏（面向从业者的决策视图）
//  自包含：自己拉取 genre_opportunity.json（同 decay
//  聚合的方式），失败则用内嵌示例。
// ════════════════════════════════════════════════
(function() {
// ── 内嵌兜底样本（无 genre_opportunity.json 时仍可演示；真实数据会覆盖）──
const SAMPLE_OVERALL = [
  ['Roguelite', 1200, 0.10, 410, 0.06, 0.87, 0.22],
  ['Roguelike', 1800, 0.09, 520, 0.05, 0.86, 0.18],
  ['Open World', 2600, 0.12, 1900, 0.09, 0.80, 0.05],
  ['Survival', 2200, 0.08, 980, 0.05, 0.74, 0.10],
  ['Souls-like', 700, 0.14, 260, 0.08, 0.82, 0.30],
  ['Farming Sim', 600, 0.16, 180, 0.06, 0.85, 0.12],
  ['Visual Novel', 6000, 0.03, 320, 0.01, 0.88, 0.06],
  ['Deckbuilder', 900, 0.10, 240, 0.05, 0.84, 0.20],
  ['Horror', 5200, 0.05, 540, 0.02, 0.78, 0.14],
  ['Idle / Clicker', 1400, 0.06, 220, 0.02, 0.80, -0.05],
  ['City Builder', 800, 0.13, 230, 0.06, 0.83, 0.08],
  ['Metroidvania', 1100, 0.07, 190, 0.03, 0.85, 0.10],
  ['Battle Royale', 180, 0.20, 220, 0.10, 0.70, -0.20],
  ['MOBA', 150, 0.12, 180, 0.08, 0.72, -0.25],
  ['Extraction Shooter', 90, 0.30, 60, 0.12, 0.71, 0.35],
  ['Cozy', 950, 0.11, 190, 0.05, 0.88, 0.28],
  ['Puzzle', 7000, 0.04, 480, 0.01, 0.86, -0.02],
  ['Platformer', 4800, 0.05, 430, 0.02, 0.83, -0.03],
  ['RPG', 5500, 0.08, 1500, 0.05, 0.82, 0.04],
  ['Shooter', 3800, 0.07, 900, 0.04, 0.76, -0.02],
  ['Tower Defense', 700, 0.07, 130, 0.03, 0.82, -0.04],
  ['Auto Battler', 200, 0.09, 40, 0.04, 0.79, -0.10],
];
const MULT = {
  All: {c: 1, o: 1, t: 1, h: 1},
  Indie: {c: .72, o: .55, t: .34, h: .45},
  AA: {c: .14, o: 1.7, t: .26, h: 1.6},
  AAA: {c: .035, o: 4.2, t: .42, h: 3.0},
  F2P: {c: .05, o: 2.6, t: .30, h: 2.2},
  Premium: {c: .92, o: .88, t: .68, h: .80},
  Hybrid: {c: .02, o: 3.1, t: .14, h: 2.4},
};
function buildFallback() {
  const genres = SAMPLE_OVERALL.map(function(a) {
    var tag = a[0], c = a[1], o = a[2], tot = a[3], h = a[4], pos = a[5],
        tr = a[6];
    var scopes = {};
    for (var s in MULT) {
      var m = MULT[s];
      var med = +(o * m.o).toFixed(3);
      scopes[s] = {
        count: Math.max(8, Math.round(c * m.c)),
        median_owners_m: med,
        mean_owners_m: +(med * 2.5).toFixed(4),
        p75_owners_m: +(med * 1.6).toFixed(4),
        total_owners_m: +(tot * m.t).toFixed(1),
        hit_rate: Math.min(.6, +(h * m.h).toFixed(3)),
        median_pos: pos,
        trend: Math.max(
            -.6,
            Math.min(
                .6,
                tr +
                    (s === 'F2P'       ? -.05 :
                         s === 'Indie' ? .03 :
                                         0)))
      };
    }
    return {tag: tag, scopes: scopes};
  });
  return {meta: {source: '内嵌示例数据'}, genres: genres, _fallback: true};
}

// 把真实 json 或兜底统一成 {tag, scopes:{All,Indie,AA,AAA,F2P,Premium,Hybrid}}
function normalize(raw) {
  if (raw && raw.genres && raw.genres[0] && raw.genres[0].scopes)
    return raw;  // 已是兜底结构
  var genres = (raw.genres || []).map(function(g) {
    var scopes = {All: g.overall};
    ['Indie', 'AA', 'AAA', 'F2P', 'Premium', 'Hybrid'].forEach(function(t) {
      if (g.by_type && g.by_type[t]) scopes[t] = g.by_type[t];
    });
    return {tag: g.tag, scopes: scopes};
  });
  return {meta: raw.meta || {}, genres: genres};
}

var DATA_G = null, scope = 'All', gtip = null;
var highlightBlueOcean = false;  // 蓝海高亮模式（叙事联动）
var showAnnotation = false;  // "解读" annotation state

function isBlueOcean(d, mx, my) {
  return d.mean_owners_m >= my && d.count < mx;
}

function ensureTip() {
  if (gtip) return gtip;
  gtip = document.createElement('div');
  gtip.id = 'genre-tip';
  gtip.style.cssText =
      'position:fixed;pointer-events:none;z-index:60;opacity:0;transition:opacity .12s;' +
      'background:#15151f;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:11px 13px;max-width:250px;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.6);font-size:14px;font-family:\'Noto Sans SC\',sans-serif;color:#e8e8f7';
  document.body.appendChild(gtip);
  return gtip;
}

function trendColor(t) {
  var x = Math.max(-.4, Math.min(.4, t)) / 0.4;  // -1..1
  var cool = [40, 100, 230], mid = [106, 106, 138], hot = [240, 80, 40];
  var a = x < 0 ? cool : hot, k = Math.abs(x);
  return 'rgb(' + Math.round(mid[0] + (a[0] - mid[0]) * k) + ',' +
      Math.round(mid[1] + (a[1] - mid[1]) * k) + ',' +
      Math.round(mid[2] + (a[2] - mid[2]) * k) + ')';
}
function quadrant(d, mx, my) {
  var hiSup = d.count >= mx, hiDem = d.mean_owners_m >= my;
  if (hiDem && !hiSup) return {name: '蓝海机会', col: '#1de9b6'};
  if (hiDem && hiSup) return {name: '红海热门', col: '#ffd54f'};
  if (!hiDem && !hiSup) return {name: '小众/未验证', col: '#8080a0'};
  return {name: '过度饱和', col: '#ff5252'};
}
function fmtOwn(v) {
  if (v == null || isNaN(v)) return '—';
  return v >= 1 ? v.toFixed(2) + 'M' : Math.round(v * 1000) + 'k';
}

function render() {
  var wrap = document.getElementById('genre-inner');
  if (!wrap || !DATA_G) return;
  var lockH = wrap.offsetHeight;
  if (lockH > 0) wrap.style.minHeight = lockH + 'px';
  wrap.innerHTML = '';
  var det =
      document.getElementById('genre-detail');  // 重绘/切规模时复位钉选详情
  if (det) {
    det.style.display = 'none';
    det.innerHTML = '';
  }
  var rows = DATA_G.genres
                 .map(function(x) {
                   var s = x.scopes[scope];
                   return s ? Object.assign({tag: x.tag}, s) : null;
                 })
                 .filter(function(d) {
                   return d && d.count;
                 });

  var W = wrap.clientWidth || 720, H = Math.max(330, Math.min(460, W * 0.5));
  var M = {t: 24, r: 26, b: 50, l: 58}, iW = W - M.l - M.r, iH = H - M.t - M.b;
  var svg = d3.select(wrap)
                .append('svg')
                .attr('viewBox', '0 0 ' + W + ' ' + H)
                .attr('height', H)
                .style('width', '100%');
  // Glow filter for highlighted bubbles
  var defs = svg.append('defs');
  var gf = defs.append('filter').attr('id', 'genre-glow');
  gf.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
  gf.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .join('feMergeNode')
      .attr('in', function(d) {
        return d;
      });
  var g =
      svg.append('g').attr('transform', 'translate(' + M.l + ',' + M.t + ')');

  if (!rows.length) {
    g.append('text')
        .attr('x', iW / 2)
        .attr('y', iH / 2)
        .attr('fill', '#8080a0')
        .attr('text-anchor', 'middle')
        .attr('font-family', '\'Space Mono\',monospace')
        .text('该工作室规模下样本不足');
    buildLegend([]);
    wrap.style.minHeight = '';
    return;
  }

  var x = d3.scaleLog()
              .domain([
                d3.min(
                    rows,
                    function(d) {
                      return d.count;
                    }) *
                    0.8,
                d3.max(
                    rows,
                    function(d) {
                      return d.count;
                    }) *
                    1.15
              ])
              .range([0, iW]);
  var y = d3.scaleLog()
              .domain([
                Math.max(
                    0.005,
                    d3.min(
                        rows,
                        function(d) {
                          return d.mean_owners_m;
                        }) *
                        0.7),
                d3.max(
                    rows,
                    function(d) {
                      return d.mean_owners_m;
                    }) *
                    1.3
              ])
              .range([iH, 0]);
  var r = d3.scaleSqrt()
              .domain([
                0,
                d3.max(
                    rows,
                    function(d) {
                      return d.total_owners_m;
                    })
              ])
              .range([4, 38]);
  var mx = d3.median(rows, function(d) {
    return d.count;
  }), my = d3.median(rows, function(d) {
    return d.mean_owners_m;
  });

  // ── 交互状态：高亮象限 activeQ + 钉选品类 selectedGenre（互斥）──
  var activeQ = null;        // 当前高亮的象限名称
  var selectedGenre = null;  // 当前钉选的品类气泡
  var tip = ensureTip();

  // 某气泡当前是否处于“高亮态”（选中的品类 / 选中象限内）
  function isHot(d) {
    if (selectedGenre) return d === selectedGenre;
    if (activeQ) return quadrant(d, mx, my).name === activeQ;
    if (highlightBlueOcean) return isBlueOcean(d, mx, my);
    return false;
  }
  // 统一的气泡视觉刷新——所有交互(悬浮离开/点象限/点气泡/重置)都收敛到这里，杜绝状态打架
  function applyBubbleState(dur) {
    dur = dur || 250;
    var dimmed = !!(selectedGenre || activeQ || highlightBlueOcean);
    node.interrupt().transition().duration(dur).attr('opacity', function(d) {
      if (!dimmed) return 1;
      return isHot(d) ? 1 : (highlightBlueOcean ? 0.12 : (selectedGenre ? 0.12 : 0.1));
    });
    node.select('circle')
        .interrupt()
        .transition()
        .duration(dur)
        .attr(
            'r',
            function(d) {
              return r(d.total_owners_m) * (selectedGenre === d ? 1.18 : 1);
            })
        .attr(
            'fill-opacity',
            function(d) {
              if (!dimmed) return .75;
              if (isHot(d)) return highlightBlueOcean && !selectedGenre && !activeQ ? 0.9 : 1;
              return highlightBlueOcean ? 0.12 : 0.2;
            })
        .attr(
            'stroke',
            function(d) {
              return isHot(d) ? '#fff' : trendColor(d.trend);
            })
        .attr(
            'stroke-width',
            function(d) {
              return isHot(d) ? 2 : (dimmed ? 0.5 : 1.2);
            })
        .attr('filter', function(d) {
          return isHot(d) ? 'url(#genre-glow)' : null;
        });
  }
  function resetBubbles() {
    activeQ = null;
    selectedGenre = null;
    tip.style.opacity = 0;
    showDetail(null);
    applyBubbleState(300);
  }
  function highlightQuadrant(qn) {
    activeQ = qn;
    selectedGenre = null;
    tip.style.opacity = 0;
    showDetail(null);
    applyBubbleState(250);
  }
  function selectGenre(d) {
    selectedGenre = d;
    activeQ = null;
    tip.style.opacity = 0;
    showDetail(d);
    applyBubbleState(250);
  }

  // 钉选详情卡（常驻，点 ✕ / 空白 / 再点同气泡 取消）
  function showDetail(d) {
    var box = document.getElementById('genre-detail');
    if (!box) return;
    if (!d) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    var q = quadrant(d, mx, my);
    var advice = {
      '蓝海机会': '需求高、对手还少 —— 当前最值得切入的方向。',
      '红海热门': '需求旺但竞争激烈 —— 蛋糕大，但必须靠差异化才能突围。',
      '小众/未验证': '供需都偏低 —— 小而美或尚未被市场验证，适合低成本试水。',
      '过度饱和': '对手多、平均回报低 —— 典型红海，谨慎进入。'
    }[q.name] ||
        '';
    var trendTxt = d.trend > 0.05 ? '近三年升温 ↑' :
        d.trend < -0.05           ? '近三年降温 ↓' :
                                    '热度平稳 →';
    box.style.display = '';
    box.innerHTML = '<div class="gd-head">' +
        '<span class="gd-tag">' + d.tag + '</span>' +
        '<span class="gd-badge" style="color:' + q.col +
        ';border-color:' + q.col + '66;background:' + q.col + '1a">' + q.name +
        '</span>' +
        '<span class="gd-trend" style="color:' + trendColor(d.trend) + '">' +
        trendTxt + '</span>' +
        '<button class="gd-close" id="gd-close" title="取消选中">✕</button>' +
        '</div>' +
        '<div class="gd-stats">' +
        gdStat('供给·竞争', d.count.toLocaleString() + ' 款') +
        gdStat('需求·均拥有', fmtOwn(d.mean_owners_m)) +
        gdStat('典型结局·中位', fmtOwn(d.median_owners_m)) +
        gdStat('突围概率·命中≥1M', Math.round(d.hit_rate * 100) + '%') +
        (d.median_pos != null ?
             gdStat('中位好评率', Math.round(d.median_pos * 100) + '%') :
             '') +
        gdStat('市场总盘', Math.round(d.total_owners_m) + 'M') + '</div>' +
        '<div class="gd-advice">▸ ' + advice + '</div>';
    var c = document.getElementById('gd-close');
    if (c)
      c.addEventListener('click', function(e) {
        e.stopPropagation();
        resetBubbles();
      });
  }

  var qDefs = [
    {
      fill: 'rgba(29,233,182,.06)',
      rx: 0,
      ry: 0,
      rw: x(mx),
      rh: y(my),
      qn: '蓝海机会'
    },
    {
      fill: 'rgba(255,213,79,.06)',
      rx: x(mx),
      ry: 0,
      rw: iW - x(mx),
      rh: y(my),
      qn: '红海热门'
    },
    {
      fill: 'rgba(80,80,106,.06)',
      rx: 0,
      ry: y(my),
      rw: x(mx),
      rh: iH - y(my),
      qn: '小众/未验证'
    },
    {
      fill: 'rgba(255,82,82,.06)',
      rx: x(mx),
      ry: y(my),
      rw: iW - x(mx),
      rh: iH - y(my),
      qn: '过度饱和'
    },
  ];
  qDefs.forEach(function(qd) {
    var rect = g.append('rect')
        .attr('x', qd.rx)
        .attr('y', qd.ry)
        .attr('width', qd.rw)
        .attr('height', qd.rh)
        .style('cursor', 'pointer')
        .on('click', function(ev) {
          ev.stopPropagation();
          if (activeQ === qd.qn) {
            resetBubbles();
          } else {
            highlightQuadrant(qd.qn);
          }
        });
    // 蓝海模式下给蓝海象限加特殊样式
    if (highlightBlueOcean && qd.qn === '蓝海机会') {
      rect.attr('class', 'genre-blue-quadrant');
    } else {
      rect.attr('fill', qd.fill);
    }
  });
  // 点击 SVG 空白区域 → 重置
  svg.on('click', function() {
    resetBubbles();
  });
  // 中位参考线（与结论数字同色 #ffd54f + 呼吸动画）
  g.append('line')
      .attr('x1', x(mx))
      .attr('x2', x(mx))
      .attr('y1', 0)
      .attr('y2', iH)
      .attr('stroke', '#ffd54f')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4')
      .attr('class', 'genre-ref-line');
  g.append('line')
      .attr('x1', 0)
      .attr('x2', iW)
      .attr('y1', y(my))
      .attr('y2', y(my))
      .attr('stroke', '#ffd54f')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4')
      .attr('class', 'genre-ref-line');
  // 象限标签（带该象限品类数）
  var qCount = {'蓝海机会': 0, '红海热门': 0, '小众/未验证': 0, '过度饱和': 0};
  rows.forEach(function(d) {
    var n = quadrant(d, mx, my).name;
    if (qCount[n] != null) qCount[n]++;
  });
  var QL =
      'font-family:\'Space Mono\',monospace;font-size:16px;font-weight:700;letter-spacing:1px';
  g.append('text')
      .attr('x', 6)
      .attr('y', 14)
      .attr('style', QL)
      .attr('fill', '#1de9b6')
      .text('◤ 蓝海机会 · ' + qCount['蓝海机会']);
  g.append('text')
      .attr('x', iW - 6)
      .attr('y', 14)
      .attr('text-anchor', 'end')
      .attr('style', QL)
      .attr('fill', '#ffd54f')
      .text('红海热门 · ' + qCount['红海热门'] + ' ◥');
  g.append('text')
      .attr('x', 6)
      .attr('y', iH - 6)
      .attr('style', QL)
      .attr('fill', '#6a6a90')
      .text('◣ 小众/未验证 · ' + qCount['小众/未验证']);
  g.append('text')
      .attr('x', iW - 6)
      .attr('y', iH - 6)
      .attr('text-anchor', 'end')
      .attr('style', QL)
      .attr('fill', '#ff5252')
      .text('过度饱和 · ' + qCount['过度饱和'] + ' ◢');

  // 轴
  g.append('g')
      .attr('transform', 'translate(0,' + iH + ')')
      .call(d3.axisBottom(x).ticks(5, '~s'))
      .call(styleAxis);
  g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(function(d) {
        return d >= 1 ? d + 'M' : (d * 1000) + 'k';
      }))
      .call(styleAxis);
  var AT = 'fill:#9a9ac0;font-family:\'Space Mono\',monospace;font-size:13.5px';
  g.append('text')
      .attr('x', iW)
      .attr('y', iH + 40)
      .attr('text-anchor', 'end')
      .attr('style', AT)
      .text('供给：在售游戏数（对数）→ 越右竞争越激烈');
  g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', 0)
      .attr('y', -44)
      .attr('text-anchor', 'end')
      .attr('style', AT)
      .text('需求：平均拥有量（对数）→ 越上市场回报越高');

  // 气泡 — 用 mean_owners_m 定位 Y，加轻微抖动避免重叠
  var node = g.selectAll('.gbub')
                 .data(rows)
                 .join('g')
                 .attr('class', function(d) {
                   return 'gbub' + (highlightBlueOcean && isBlueOcean(d, mx, my) ? ' gbub-blue' : '');
                 })
                 .attr(
                     'transform',
                     function(d, i) {
                       var jx = (Math.sin(i * 7.13) * 0.5 + 0.5 - 0.5) *
                           (iW / rows.length * 0.4);
                       var jy = (Math.cos(i * 11.07) * 0.5 + 0.5 - 0.5) *
                           (iH / rows.length * 0.3);
                       return 'translate(' + (x(d.count) + jx) + ',' +
                           (y(d.mean_owners_m) + jy) + ')';
                     })
                 .style('cursor', 'pointer');
  node.append('circle')
      .attr('r', 0)
      .attr(
          'fill',
          function(d) {
            return trendColor(d.trend);
          })
      .attr('fill-opacity', .75)
      .attr(
          'stroke',
          function(d) {
            return trendColor(d.trend);
          })
      .attr('stroke-width', 1.2)
      .transition()
      .duration(650)
      .delay(function(d, i) {
        return i * 20;
      })
      .attr('r', function(d) {
        return r(d.total_owners_m);
      })
      .on('end', function(d, i) {
        if (highlightBlueOcean && i === rows.length - 1) applyBubbleState(0);
      });

  // 标注【全部】品类（旧版只标市场总盘前 11，导致多数气泡无文字）。
  // 为避免叠字：① 加深色描边光晕(paint-order)保证重叠时仍可读；
  //            ② 按索引奇偶在气泡上/下交错放置，错开相邻标签；
  //            ③ 入场后跑一次贪心碰撞检测：按市场总盘从大到小依次放置，
  //               尝试上下左右四个候选位置，全冲突则隐藏次要标签。
  node.append('text')
      .attr('class', 'genre-label')
      .attr('text-anchor', 'middle')
      .attr(
          'dy',
          function(d, i) {
            var rr = r(d.total_owners_m);
            return (i % 2 === 0) ? (-rr - 5) : (rr + 13);
          })
      .attr('fill', function(d) {
        return highlightBlueOcean && isBlueOcean(d, mx, my) ? '#1de9b6' : '#e8e8f0';
      })
      .attr('stroke', '#0a0a12')          // 深色光晕，压在其它气泡/标签上仍清晰
      .attr('stroke-width', 3)
      .attr('stroke-linejoin', 'round')
      .attr('paint-order', 'stroke')      // 先描边后填字 → 文字在光晕之上
      .attr('font-family', '\'Noto Sans SC\',sans-serif')
      .attr('font-size', 11.5)
      .attr('pointer-events', 'none')
      .text(function(d) {
        return d.tag;
      })
      .attr('opacity', 0)
      .transition()
      .delay(function(d, i) {
        return highlightBlueOcean && isBlueOcean(d, mx, my) ? 700 + i * 20 : 550;
      })
      .duration(380)
      .attr('opacity', function(d) {
        if (!highlightBlueOcean) return 1;
        return isBlueOcean(d, mx, my) ? 1 : 0.2;
      })
      .on('end', function(d, i) {
        // 末个标签入场后跑一次贪心碰撞检测（重绘时也会因 selection 重建而再次触发）
        if (i === rows.length - 1) resolveLabelCollisions();
      });

  // 贪心碰撞：按市场总盘从大到小排序，依次尝试 4 个候选位置；全冲突则隐藏
  function resolveLabelCollisions() {
    var labels = node.select('text.genre-label').nodes();
    if (!labels.length) return;
    // 按数据 total_owners_m 降序，重要的优先占位
    var entries = labels.map(function(el) {
      var d3sel = d3.select(el);
      var datum = d3sel.datum();
      return { el: el, sel: d3sel, datum: datum, weight: datum.total_owners_m || 0 };
    }).sort(function(a, b) { return b.weight - a.weight; });

    var placed = []; // {x, y, w, h}
    entries.forEach(function(e) {
      var rr = r(e.datum.total_owners_m);
      var bbox;
      try { bbox = e.el.getBBox(); } catch (err) { bbox = { width: 0, height: 0 }; }
      var tw = bbox.width, th = bbox.height || 14;
      // 标签所属 node 在 g 内的位移
      var parent = e.el.parentNode;
      var tx = parent && parent.transform && parent.transform.baseVal[0]
               ? parent.transform.baseVal[0].matrix.e : 0;
      var ty = parent && parent.transform && parent.transform.baseVal[0]
               ? parent.transform.baseVal[0].matrix.f : 0;
      var cands = [
        { dy: -rr - 5,  dx: 0 },           // 上
        { dy: rr + 13,  dx: 0 },           // 下
        { dy: 4,        dx: rr + tw/2 + 6 }, // 右
        { dy: 4,        dx: -rr - tw/2 - 6 }, // 左
      ];
      var found = null;
      for (var k = 0; k < cands.length; k++) {
        var cx = tx + cands[k].dx, cy = ty + cands[k].dy;
        var box = { x: cx - tw/2 - 1, y: cy - th + 2, w: tw + 2, h: th };
        var clash = placed.some(function(p) {
          return !(box.x + box.w < p.x || p.x + p.w < box.x ||
                   box.y + box.h < p.y || p.y + p.h < box.y);
        });
        if (!clash) { found = { cand: cands[k], box: box }; break; }
      }
      if (found) {
        e.sel.attr('dy', found.cand.dy)
             .attr('dx', found.cand.dx || 0)
             .attr('opacity', highlightBlueOcean
               ? (isBlueOcean(e.datum, mx, my) ? 1 : 0.2)
               : 1);
        placed.push(found.box);
      } else {
        // 全冲突 → 隐藏（hover 时仍由 tooltip 显示完整信息）
        e.sel.attr('opacity', 0);
      }
    });
  }

  node.on('mouseenter',
          function(ev, d) {
            if (selectedGenre || highlightBlueOcean) return;  // 已钉选/蓝海模式时，悬浮不打断当前高亮
            // 放大当前气泡，其余变暗
            d3.select(this)
                .select('circle')
                .interrupt()
                .transition()
                .duration(150)
                .ease(d3.easeCubicOut)
                .attr('r', r(d.total_owners_m) * 1.2)
                .attr('fill-opacity', 1);
            node.filter(function(dd) {
                  return dd !== d;
                })
                .transition()
                .duration(150)
                .attr('opacity', activeQ ? function(dd) {
                  return quadrant(dd, mx, my).name === activeQ ? 1 : 0.1;
                } : 0.12);
          })
      .on('mousemove',
          function(ev, d) {
            var q = quadrant(d, mx, my);
            tip.innerHTML =
                '<div style="font-weight:700;font-size:15px;margin-bottom:6px">' +
                d.tag + '</div>' +
                '<div style="font-family:\'Space Mono\',monospace;font-size:13px;padding:2px 9px;border-radius:5px;display:inline-block;margin-bottom:8px;background:' +
                q.col + '22;color:' + q.col + ';border:1px solid ' + q.col +
                '55">' + q.name + '</div>' +
                row('供给(竞争)', d.count.toLocaleString() + ' 款') +
                row('均拥有量·定位纵轴', fmtOwn(d.mean_owners_m)) +
                row('中位拥有量·典型', fmtOwn(d.median_owners_m)) +
                (d.p75_owners_m != null ?
                     row('上四分位·做得好', fmtOwn(d.p75_owners_m)) :
                     '') +
                row('命中率(≥1M)', Math.round(d.hit_rate * 100) + '%') +
                (d.median_pos != null ?
                     row('中位好评率', Math.round(d.median_pos * 100) + '%') :
                     '') +
                row('市场总规模', Math.round(d.total_owners_m) + 'M') +
                rowC(
                    '趋势', (d.trend > 0 ? '升温 +' : '') + d.trend.toFixed(2),
                    trendColor(d.trend)) +
                '<div style="margin-top:7px;font-size:11px;color:#6a6a90">点击钉选 · 查看决策建议 ↓</div>';
            tip.style.left =
                Math.min(ev.clientX + 16, window.innerWidth - 270) + 'px';
            tip.style.top = (ev.clientY + 14) + 'px';
            tip.style.opacity = 1;
          })
      .on('mouseleave',
          function(ev, d) {
            tip.style.opacity = 0;
            applyBubbleState(250);  // 统一恢复：自动尊重 selectedGenre /
                                    // activeQ，不再各自为政
          })
      .on('click', function(ev, d) {
        ev.stopPropagation();  // 关键：阻止冒泡到 svg 的
                               // resetBubbles，否则“点击=重置”
        if (selectedGenre === d)
          resetBubbles();
        else
          selectGenre(d);
      });

  // ── "解读" annotation overlay ──
  if (showAnnotation) {
    // Highlight 蓝海机会 (top-left) and 过度饱和 (bottom-right)
    // 蓝海：标签在象限内部、"蓝海机会"文字下方
    g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', x(mx))
        .attr('height', y(my))
        .attr('fill', '#1de9b6')
        .attr('fill-opacity', 0.12)
        .attr('stroke', '#1de9b6')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,4')
        .style('pointer-events', 'none');
    g.append('text')
        .attr('x', 6)
        .attr('y', 34)
        .attr('fill', '#ffffff')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 13)
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .text('需求高·对手少');
    // 过度饱和：标签在象限内部、"过度饱和"文字上方
    g.append('rect')
        .attr('x', x(mx))
        .attr('y', y(my))
        .attr('width', iW - x(mx))
        .attr('height', iH - y(my))
        .attr('fill', '#ff5252')
        .attr('fill-opacity', 0.12)
        .attr('stroke', '#ff5252')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,4')
        .style('pointer-events', 'none');
    g.append('text')
        .attr('x', iW - 6)
        .attr('y', iH - 24)
        .attr('text-anchor', 'end')
        .attr('fill', '#ffffff')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 13)
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .text('慎入');
    // 蓝海模式额外提示
    g.append('text')
        .attr('x', iW / 2)
        .attr('y', iH + 16)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.5)')
        .attr('font-family', '\'Noto Sans SC\',sans-serif')
        .attr('font-size', 13)
        .attr('pointer-events', 'none')
        .text('气泡越大 = 市场越大，颜色越暖 = 近年越多人涌入');
  }

  buildLegend(rows);
  wrap.style.minHeight = '';
}

function row(k, v) {
  return '<div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;color:#8080a0"><span>' +
      k +
      '</span><b style="color:#e8e8f0;font-family:\'Space Mono\',monospace">' +
      v + '</b></div>';
}
function rowC(k, v, c) {
  return '<div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;color:#8080a0"><span>' +
      k + '</span><b style="color:' + c +
      ';font-family:\'Space Mono\',monospace">' + v + '</b></div>';
}
function gdStat(k, v) {
  return '<div class="gd-stat"><span>' + k + '</span><b>' + v + '</b></div>';
}
function styleAxis(sel) {
  sel.selectAll('text')
      .attr('fill', '#a2a2c8')
      .attr('font-family', '\'Space Mono\',monospace')
      .attr('font-size', '13px');
  sel.selectAll('line,path').attr('stroke', 'rgba(255,255,255,.08)');
}

function buildLegend(rows) {
  var leg = document.getElementById('genre-legend');
  if (!leg) return;
  leg.innerHTML = '';
  var src = (DATA_G && DATA_G._fallback) ?
      '内嵌示例数据（运行 07_genre_opportunity.py 生成真实数据）' :
      'STEAMSPY tags 聚合 · 均拥有量=市场回报（中位数因 SteamSpy 区间估算几乎无区分度）';
  var wrap = document.createElement('div');
  wrap.style.cssText =
      'display:flex;align-items:center;gap:14px;color:rgba(255,255,255,.7);font-size:13px;flex-wrap:wrap';
  // "解读" button
  var btn = document.createElement('button');
  btn.className = 'pill' + (showAnnotation ? ' active' : '');
  btn.textContent = showAnnotation ? '✕ 关闭解读' : '▶ 解读';
  btn.style.cssText =
      'flex-shrink:0;font-size:12px;padding:5px 10px;background:' +
      (showAnnotation ? 'rgba(96,96,160,0.25)' : '#6060a0') +
      ';border:1.5px solid #6060a0' +
      ';color:#fff;font-weight:700;letter-spacing:0.5px' +
      ';transition:border-color .15s,box-shadow .15s;cursor:pointer';
  btn.addEventListener('mouseenter', function() {
    btn.style.borderColor = '#9090d0';
    btn.style.boxShadow = '0 0 0 2px rgba(96,96,160,0.35)';
  });
  btn.addEventListener('mouseleave', function() {
    btn.style.borderColor = '#6060a0';
    btn.style.boxShadow = 'none';
  });
  btn.addEventListener('click', function() {
    showAnnotation = !showAnnotation;
    render();
  });
  wrap.appendChild(btn);
  // 常驻编码说明：气泡大小 + 颜色（无需点“解读”即可看懂）
  var enc = document.createElement('span');
  enc.style.cssText =
      'display:inline-flex;align-items:center;gap:6px;white-space:nowrap';
  enc.innerHTML =
      '<svg width="46" height="16" style="vertical-align:middle"><circle cx="6" cy="8" r="3" fill="#6a6a8a"/><circle cx="22" cy="8" r="5" fill="#6a6a8a"/><circle cx="39" cy="8" r="7" fill="#6a6a8a"/></svg>' +
      '气泡=市场总盘　|　' +
      '<span style="color:#2864e6">■</span>降温 → <span style="color:#6a6a8a">■</span>平稳 → <span style="color:#f05028">■</span>升温';
  wrap.appendChild(enc);
  var srcSpan = document.createElement('span');
  srcSpan.style.cssText = 'opacity:.7';
  srcSpan.textContent = src;
  wrap.appendChild(srcSpan);
  leg.appendChild(wrap);
}

function syncPills() {
  document.querySelectorAll('#sec-genre [data-gs]').forEach(function(b) {
    b.classList.toggle('active', b.dataset.gs === scope);
  });
}
function setScope(s) {
  if (!MULT[s]) return;
  var sy = window.scrollY;
  scope = s;
  syncPills();
  render();
  requestAnimationFrame(function() {
    window.scrollTo(0, sy);
  });
}
function bindPills() {
  document.querySelectorAll('#sec-genre [data-gs]').forEach(function(b) {
    b.addEventListener('click', function() {
      highlightBlueOcean = false;
      setScope(this.dataset.gs);
    });
  });
}

window.initGenre = function() {
  (async function() {
    var resp = null;
    try {
      if (typeof API_BASE !== 'undefined') {
        try {
          var r = await fetch(API_BASE + '/genre_opportunity');
          if (r.ok) resp = await r.json();
        } catch (e) {
        }
      }
      if (!resp) {
        try {
          var r2 = await fetch('../data/processed/genre_opportunity.json');
          if (r2.ok) resp = await r2.json();
        } catch (e) {
        }
      }
    } catch (e) {
    }
    if (resp && resp.genres && resp.genres.length) {
      DATA_G = normalize(resp);
      console.log(
          '[genre] opportunity data loaded: ' + DATA_G.genres.length +
          ' genres');
    } else {
      DATA_G = buildFallback();
      console.info(
          '[genre] using embedded sample (run 07_genre_opportunity.py for real data)');
    }
    bindPills();
    syncPills();
    render();
  })();
};

// 供导览 / 联动调用：切换工作室规模、narrative 高亮
window._genreSetScope = setScope;
window._genreRedraw = function() {
  if (DATA_G) render();
};
window._genreApplyNarrative = function(opts) {
  if (opts && opts.highlightBlueOcean != null)
    highlightBlueOcean = opts.highlightBlueOcean;
  if (DATA_G) render();
};
window._genreResetNarrative = function() {
  highlightBlueOcean = false;
  if (DATA_G) render();
};
})();