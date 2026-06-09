//  VIEW 3: DECAY CURVES — Dual Mode (Individual + Aggregate)
//  Merged: teammate's crosshair/tooltip model + dual mode + milestones + inline
//  labels
// ════════════════════════════════════════════════
window.initDecay = function() {
  const MG = {t: 28, r: 110, b: 52, l: 60};
  const NARRATIVE_TYPES = ['Indie', 'AAA'];
  let showRef = true, highlighted = null, narrativeCompare = false,
      decayMode = 'individual';
  let aggHighlighted = null;
  let aggMetric = 'depth';  // 聚合模式子视图：depth=参与深度 / survival=存活率
  let svg, g, xSc, ySc;
  let firstDraw = true;
  let _iW = 0, _iH = 0, sweepRAF = null;  // 几何缓存 + 时间游标扫描的 rAF 句柄

  const TYPE_STYLE = {
    AAA: {dash: null, width: 2.5, label: '3A大作'},
    AA: {dash: '6,3', width: 2, label: 'AA中型'},
    Indie: {dash: null, width: 2, label: '独立游戏'},
    F2P: {dash: '2,3', width: 2.5, label: 'F2P免费'},
  };

  function lineOpacity(d, hoverName) {
    if (hoverName) return d.name === hoverName ? 1 : 0.07;
    if (highlighted) return d.name === highlighted ? 1 : 0.07;
    if (narrativeCompare) return NARRATIVE_TYPES.includes(d.type) ? 1 : 0.06;
    return 0.75;
  }

  function lineWidth(d, hoverName) {
    if ((hoverName && d.name === hoverName) ||
        (highlighted && d.name === highlighted))
      return 3.5;
    if (narrativeCompare && NARRATIVE_TYPES.includes(d.type)) return 2.8;
    return (TYPE_STYLE[d.type] || {}).width || 2;
  }

  function isLabelActive(d, hoverName) {
    if (hoverName) return d.name === hoverName;
    if (highlighted) return d.name === highlighted;
    if (narrativeCompare) return NARRATIVE_TYPES.includes(d.type);
    return true;
  }

  function applyLineStyles(hoverName) {
    if (!g) return;
    g.selectAll('.dline')
        .transition()
        .duration(200)
        .attr(
            'opacity',
            function(d) {
              return lineOpacity(d, hoverName);
            })
        .attr('stroke-width', function(d) {
          return lineWidth(d, hoverName);
        });

    g.selectAll('.decay-inline-label')
        .transition()
        .duration(200)
        .attr('opacity', function() {
          var name = d3.select(this).attr('data-name');
          var match = DATA.decay.find(function(d) {
            return d.name === name;
          });
          if (!match) return 0;
          return isLabelActive(match, hoverName) ?
              (hoverName || highlighted ? 0.9 : 0.7) :
              0;
        });

    g.selectAll('.decay-connector')
        .transition()
        .duration(200)
        .attr('opacity', function() {
          var name = d3.select(this).attr('data-name');
          var match = DATA.decay.find(function(d) {
            return d.name === name;
          });
          if (!match) return 0;
          return isLabelActive(match, hoverName) ?
              (hoverName || highlighted ? 0.5 : 0.35) :
              0;
        });
  }

  function switchToIndividualMode() {
    if (decayMode === 'individual') return;
    decayMode = 'individual';
    document.querySelectorAll('[data-dm]').forEach(function(x) {
      x.classList.remove('active');
    });
    var indBtn = document.querySelector('[data-dm="individual"]');
    if (indBtn) indBtn.classList.add('active');
  }

  // ══════════════════════════════════════════════
  //  INDIVIDUAL MODE — single game curves
  // ══════════════════════════════════════════════
  function drawIndividual() {
    const wrap = document.getElementById('decay-inner');
    wrap.innerHTML = '';
    const W = wrap.clientWidth, H = Math.max(280, Math.min(360, W * 0.4));
    const iW = W - MG.l - MG.r, iH = H - MG.t - MG.b;
    _iW = iW;
    _iH = iH;  // 缓存供时间游标扫描使用

    svg = d3.select(wrap)
              .append('svg')
              .attr('viewBox', '0 0 ' + W + ' ' + H)
              .attr('height', H);
    g = svg.append('g').attr(
        'transform', 'translate(' + MG.l + ',' + MG.t + ')');

    xSc = d3.scaleLinear().domain([0, 24]).range([0, iW]);
    ySc = d3.scaleLinear().domain([0, 1.06]).range([iH, 0]);

    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(ySc).ticks(6).tickSize(-iW).tickFormat(''));
    g.append('g')
        .attr('class', 'grid')
        .attr('transform', 'translate(0,' + iH + ')')
        .call(d3.axisBottom(xSc).ticks(12).tickSize(-iH).tickFormat(''));

    if (showRef)
      [0.5, 0.2, 0.1].forEach(function(pct) {
        g.append('line')
            .attr('class', 'ref-l')
            .attr('x1', 0)
            .attr('x2', iW)
            .attr('y1', ySc(pct))
            .attr('y2', ySc(pct))
            .attr('stroke', 'rgba(255,255,255,0.08)')
            .attr('stroke-dasharray', '2,5');
        g.append('text')
            .attr('class', 'ref-t')
            .attr('x', iW + 4)
            .attr('y', ySc(pct) + 3)
            .attr('fill', 'rgba(255,255,255,0.18)')
            .attr('font-family', '\'Space Mono\',monospace')
            .attr('font-size', 9)
            .text((pct * 100) + '%');
      });

    // Milestone annotations
    var milestones = [
      {
        month: 1,
        label: '首月',
        note: '营销热度峰值',
        color: 'rgba(255,82,82,0.35)'
      },
      {
        month: 3,
        label: '3个月',
        note: '3A典型断崖点',
        color: 'rgba(255,213,79,0.3)'
      },
      {
        month: 12,
        label: '一年',
        note: '长尾分水岭',
        color: 'rgba(29,233,182,0.3)'
      },
    ];
    milestones.forEach(function(ms) {
      var x = xSc(ms.month);
      g.append('line')
          .attr('x1', x)
          .attr('x2', x)
          .attr('y1', 0)
          .attr('y2', iH)
          .attr('stroke', ms.color)
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,4');
      g.append('text')
          .attr('x', x)
          .attr('y', -8)
          .attr('text-anchor', 'middle')
          .attr('fill', ms.color)
          .attr('font-family', '\'Space Mono\',monospace')
          .attr('font-size', 10)
          .attr('font-weight', 'bold')
          .text(ms.label);
      g.append('text')
          .attr('x', x)
          .attr('y', iH + 24)
          .attr('text-anchor', 'middle')
          .attr('fill', ms.color)
          .attr('font-family', 'var(--sans)')
          .attr('font-size', 8)
          .text(ms.note);
    });

    // Axes
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + iH + ')')
        .call(d3.axisBottom(xSc).tickFormat(function(d) {
          return d === 0 ? '发布' : d + '月';
        }));
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(ySc).tickFormat(d3.format('.0%')));

    g.append('text')
        .attr('x', iW / 2)
        .attr('y', iH + 42)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6060a0')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 10)
        .text('发布后月数');

    var line = d3.line()
                   .x(function(_, i) {
                     return xSc(i);
                   })
                   .y(function(v) {
                     return ySc(v);
                   })
                   .curve(d3.curveCatmullRom.alpha(0.5));

    var sorted = DATA.decay.slice().sort(function(a, b) {
      if (highlighted) {
        if (a.name === highlighted) return 1;
        if (b.name === highlighted) return -1;
      }
      return 0;
    });

    // ── Crosshair & unified tooltip (background rect BEFORE paths) ──
    var cursor = g.append('line')
                     .attr('stroke', 'rgba(255,255,255,0.15)')
                     .attr('y1', 0)
                     .attr('y2', iH)
                     .style('pointer-events', 'none')
                     .style('display', 'none');
    var dotsG = g.append('g').style('pointer-events', 'none');
    g.append('rect')
        .attr('width', iW)
        .attr('height', iH)
        .attr('fill', 'transparent')
        .on('mousemove',
            function(ev) {
              var mx = d3.pointer(ev)[0];
              if (mx < 0 || mx > iW) {
                cursor.style('display', 'none');
                return;
              }
              var m = Math.max(0, Math.min(24, Math.round(xSc.invert(mx))));
              cursor.style('display', null)
                  .attr('x1', xSc(m))
                  .attr('x2', xSc(m));
              var show = highlighted ? DATA.decay.filter(function(d) {
                return d.name === highlighted;
              }) :
                  narrativeCompare   ? DATA.decay.filter(function(d) {
                      return NARRATIVE_TYPES.includes(d.type);
                    }) :
                                       DATA.decay;
              dotsG.selectAll('.cdot').remove();
              dotsG.selectAll('.cdot')
                  .data(show)
                  .join('circle')
                  .attr('class', 'cdot')
                  .attr('cx', xSc(m))
                  .attr(
                      'cy',
                      function(d) {
                        return ySc(d.data[m]);
                      })
                  .attr('r', 3.5)
                  .attr(
                      'fill',
                      function(d) {
                        return d.color;
                      })
                  .attr('stroke', '#fff')
                  .attr('stroke-width', 1);
              // Unified tooltip
              var tipHtml =
                  '<div style="margin-bottom:4px;font-weight:700;color:var(--bright)">发布后 ' +
                  m + ' 个月</div>';
              show.forEach(function(d) {
                tipHtml += '<div class="tip-row" style="margin:2px 0">' +
                    '<span class="tip-k" style="color:' + d.color + '">' +
                    d.name + '</span>' +
                    '<span class="tip-v">' + fmt.pct(d.data[m] * 100) +
                    '</span></div>';
              });
              TIP.show(tipHtml, ev);
            })
        .on('mouseleave', function() {
          cursor.style('display', 'none');
          dotsG.selectAll('.cdot').remove();
          TIP.hide();
        });

    // ── Lines (drawn AFTER rect, on top, pointer-events:none) ──
    var paths = g.selectAll('.dline')
                    .data(
                        sorted,
                        function(d) {
                          return d.name;
                        })
                    .join('path')
                    .attr('class', 'dline')
                    .attr(
                        'stroke',
                        function(d) {
                          return d.color;
                        })
                    .attr('fill', 'none')
                    .attr(
                        'd',
                        function(d) {
                          return line(d.data);
                        })
                    .attr(
                        'stroke-dasharray',
                        function(d) {
                          var s = TYPE_STYLE[d.type];
                          return s ? s.dash : null;
                        })
                    .attr(
                        'opacity',
                        function(d) {
                          return lineOpacity(d, null);
                        })
                    .attr(
                        'stroke-width',
                        function(d) {
                          return lineWidth(d, null);
                        })
                    .style('pointer-events', 'none');

    if (firstDraw) {
      paths.each(function() {
        var totalLen = this.getTotalLength();
        d3.select(this)
            .attr('stroke-dasharray', totalLen)
            .attr('stroke-dashoffset', totalLen)
            .transition()
            .duration(1200)
            .delay(function(_, i) {
              return i * 80;
            })
            .ease(d3.easeCubicInOut)
            .attr('stroke-dashoffset', 0)
            .on('end', function() {
              var d = d3.select(this).datum();
              var s = TYPE_STYLE[d.type];
              d3.select(this).attr('stroke-dasharray', s ? s.dash : null);
            });
      });
      firstDraw = false;
    } else {
      paths
          .attr(
              'opacity',
              function(d) {
                return lineOpacity(d, null);
              })
          .attr('stroke-width', function(d) {
            return lineWidth(d, null);
          });
    }

    // ── Inline end-of-line labels (collision-free) ──
    var MIN_GAP = 12;
    var labels = [];
    sorted.forEach(function(d) {
      var lastVal = d.data[24] != null ? d.data[24] : d.data[d.data.length - 1];
      if (lastVal == null) return;
      labels.push({d: d, naturalY: ySc(lastVal), adjustedY: ySc(lastVal)});
    });

    // Sort by natural Y position (top → bottom, smallest Y first)
    labels.sort(function(a, b) {
      return a.naturalY - b.naturalY;
    });

    // Pass 1: sweep top→bottom, push down any overlaps
    for (var i = 1; i < labels.length; i++) {
      var prev = labels[i - 1].adjustedY;
      if (labels[i].adjustedY - prev < MIN_GAP) {
        labels[i].adjustedY = prev + MIN_GAP;
      }
    }

    // Pass 2: if bottom label overflows chart, push everything up
    var maxY = iH + 6;
    if (labels.length && labels[labels.length - 1].adjustedY > maxY) {
      var overflow = labels[labels.length - 1].adjustedY - maxY;
      for (var i = labels.length - 1; i >= 0; i--) {
        labels[i].adjustedY -= overflow;
        if (i < labels.length - 1 &&
            labels[i + 1].adjustedY - labels[i].adjustedY < MIN_GAP) {
          labels[i].adjustedY = labels[i + 1].adjustedY - MIN_GAP;
        }
      }
    }

    // Clamp within chart area
    labels.forEach(function(l) {
      l.adjustedY = Math.max(4, Math.min(iH + 6, l.adjustedY));
    });

    // Draw connector lines + labels
    labels.forEach(function(l) {
      var d = l.d;
      var isActive = isLabelActive(d, null);
      var labelText = d.name.length > 14 ? d.name.slice(0, 12) + '…' : d.name;
      var needsConnector = Math.abs(l.adjustedY - l.naturalY) > 2;

      if (needsConnector) {
        g.append('path')
            .attr('class', 'decay-connector')
            .attr(
                'd',
                'M' + xSc(24) + ',' + l.naturalY + ' C' + (xSc(24) + 12) + ',' +
                    l.naturalY + ' ' + (xSc(24) + 12) + ',' + l.adjustedY +
                    ' ' + (xSc(24) + 20) + ',' + l.adjustedY)
            .attr('fill', 'none')
            .attr('stroke', d.color)
            .attr('stroke-width', 0.6)
            .attr('opacity', isActive ? 0.35 : 0)
            .attr('data-name', d.name);
      } else {
        g.append('line')
            .attr('class', 'decay-connector')
            .attr('x1', xSc(24))
            .attr('x2', xSc(24) + 6)
            .attr('y1', l.naturalY)
            .attr('y2', l.adjustedY)
            .attr('stroke', d.color)
            .attr('stroke-width', 0.5)
            .attr('opacity', isActive ? 0.4 : 0)
            .attr('data-name', d.name);
      }

      g.append('text')
          .attr('class', 'decay-inline-label')
          .attr('x', xSc(24) + (needsConnector ? 22 : 8))
          .attr('y', l.adjustedY + 3)
          .attr('fill', d.color)
          .attr('font-family', '\'Space Mono\',monospace')
          .attr('font-size', 9)
          .attr('opacity', isActive ? 0.7 : 0)
          .style('pointer-events', 'none')
          .attr('data-name', d.name)
          .text(labelText);
    });

    buildLegendIndividual();
  }

  function highlightLine(name, sticky) {
    if (sticky !== undefined) {
      narrativeCompare = false;
      highlighted = sticky ? name : null;
      firstDraw = false;
      draw();
      return;
    }
    applyLineStyles(name);

    document.querySelectorAll('.dl-item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.name === name);
    });
  }

  function buildLegendIndividual() {
    var leg = document.getElementById('decay-legend');
    leg.innerHTML = '';
    var typeOrder = ['AAA', 'AA', 'Indie', 'F2P'];
    var groups = {};
    DATA.decay.forEach(function(d) {
      if (!groups[d.type]) groups[d.type] = [];
      groups[d.type].push(d);
    });

    // 2-column grid of grouped boxes
    var grid = document.createElement('div');
    grid.className = 'dl-group-grid';
    leg.appendChild(grid);

    typeOrder.forEach(function(type) {
      if (!groups[type] || groups[type].length === 0) return;
      var style = TYPE_STYLE[type] || {};

      // Group container for 2-per-row layout
      var group = document.createElement('div');
      group.className = 'dl-group';

      // Category label outside the box
      var catLabel = document.createElement('div');
      catLabel.className = 'dl-group-label';
      if (narrativeCompare) {
        catLabel.classList.add(
            NARRATIVE_TYPES.includes(type) ? 'dl-type-narrative' :
                                             'dl-type-dimmed');
      }
      catLabel.style.color = C[type] || '#888';
      catLabel.innerHTML = style.label;
      group.appendChild(catLabel);

      // Inner box with member items
      var inner = document.createElement('div');
      inner.className = 'dl-group-inner';
      groups[type].forEach(function(d) {
        var el = document.createElement('div');
        el.className = 'dl-item' + (highlighted === d.name ? ' active' : '');
        el.dataset.name = d.name;
        el.innerHTML = '<div class="dl-swatch" style="background:' + d.color +
            '"></div>' + d.name + ' <span style="opacity:0.5">' + d.yr +
            '</span>';
        el.addEventListener('click', function() {
          highlighted === d.name ? highlightLine(null, true) :
                                   highlightLine(d.name, true);
        });
        inner.appendChild(el);
      });
      group.appendChild(inner);

      grid.appendChild(group);
    });
  }


  // ══════════════════════════════════════════════
  //  AGGREGATE MODE — type-level engagement depth
  // ══════════════════════════════════════════════
  function drawAggregate() {
    var wrap = document.getElementById('decay-inner');
    wrap.innerHTML = '';
    var W = wrap.clientWidth, H = Math.max(280, Math.min(360, W * 0.4));
    var MGA = {t: 28, r: 50, b: 52, l: 60};
    var iW = W - MGA.l - MGA.r, iH = H - MGA.t - MGA.b;

    var aggData = DATA.decayAggregate;
    if (!aggData || aggData.length === 0) {
      wrap.innerHTML =
          '<div class="loading-wrap" style="opacity:0.4">聚合数据不可用<br><span style="font-size:10px">运行 05_preprocess.py 生成 decay_aggregate.json</span></div>';
      return;
    }

    // 子视图切换：参与深度 / 存活率（仅当后端给出存活率数据时显示）
    var survAvail = aggData.some(function(d) {
      return d.survival_available;
    });
    if (survAvail) {
      var bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:6px;margin:0 0 8px 4px';
      bar.innerHTML = '<button class="pill' +
          (aggMetric === 'depth' ? ' active' : '') +
          '" data-agg="depth">参与深度</button>' +
          '<button class="pill' +
          (aggMetric === 'survival' ? ' active red' : '') +
          '" data-agg="survival">存活率</button>';
      wrap.appendChild(bar);
      bar.querySelectorAll('[data-agg]').forEach(function(b) {
        b.addEventListener('click', function() {
          aggMetric = this.dataset.agg;
          draw();
        });
      });
    } else if (aggMetric === 'survival') {
      aggMetric = 'depth';
    }

    if (aggMetric === 'survival' && survAvail) {
      drawSurvival(aggData);
      return;
    }

    svg = d3.select(wrap)
              .append('svg')
              .attr('viewBox', '0 0 ' + W + ' ' + H)
              .attr('height', H);
    g = svg.append('g').attr(
        'transform', 'translate(' + MGA.l + ',' + MGA.t + ')');

    var maxAge = d3.max(aggData, function(d) {
      return d.max_age;
    }) || 10;
    // Determine primary metric from data
    var usePrimary = aggData[0] && aggData[0].primary === 'playtime' ?
        'playtime' :
        'engagement';
    var yLabel, tipMainLabel, tipMethodNote;
    if (usePrimary === 'playtime') {
      yLabel = '相对中位游戏时长';
      tipMainLabel = '相对时长';
      tipMethodNote = '基于 median_playtime_forever · >1.0× = 长尾效应';
    } else {
      yLabel = '相对参与度（CCU/拥有者）';
      tipMainLabel = '相对参与度';
      tipMethodNote = '参与度 = 同时在线 ÷ 拥有者 · 越高 = 留存越好';
    }

    xSc = d3.scaleLinear().domain([0, Math.min(maxAge, 10)]).range([0, iW]);

    // Y axis
    var curveKey = usePrimary === 'playtime' ? 'playtime_normalized' :
                                               'engagement_normalized';
    var absKey =
        usePrimary === 'playtime' ? 'playtime_absolute' : 'engagement_absolute';
    var maxY = d3.max(aggData, function(d) {
      return d3.max(d[curveKey]);
    }) || 1.2;
    maxY = Math.max(maxY, 1.2);
    ySc = d3.scaleLinear().domain([0, maxY]).range([iH, 0]);

    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(ySc).ticks(6).tickSize(-iW).tickFormat(''));
    g.append('g')
        .attr('class', 'grid')
        .attr('transform', 'translate(0,' + iH + ')')
        .call(d3.axisBottom(xSc)
                  .ticks(Math.min(maxAge, 10))
                  .tickSize(-iH)
                  .tickFormat(''));

    // Baseline reference at 1.0
    g.append('line')
        .attr('x1', 0)
        .attr('x2', iW)
        .attr('y1', ySc(1))
        .attr('y2', ySc(1))
        .attr('stroke', 'rgba(255,255,255,0.15)')
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-width', 1);
    g.append('text')
        .attr('x', iW + 4)
        .attr('y', ySc(1) + 3)
        .attr('fill', 'rgba(255,255,255,0.25)')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 9)
        .text('首年基准 100%');

    // Axes
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + iH + ')')
        .call(d3.axisBottom(xSc)
                  .ticks(Math.min(maxAge, 10))
                  .tickFormat(function(d) {
                    return d === 0 ? '发布年' : d + '年后';
                  }));
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(ySc).tickFormat(d3.format('.0%')));

    g.append('text')
        .attr('x', iW / 2)
        .attr('y', iH + 42)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6060a0')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 10)
        .text('游戏年龄（发布后年数）');
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -iH / 2)
        .attr('y', -46)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6060a0')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 10)
        .text(yLabel);

    var line = d3.line()
                   .x(function(_, i) {
                     return xSc(i);
                   })
                   .y(function(v) {
                     return ySc(v);
                   })
                   .defined(function(v) {
                     return v > 0;
                   })
                   .curve(d3.curveCatmullRom.alpha(0.5));

    // ── Crosshair & unified tooltip (background rect BEFORE curves) ──
    var xMax = Math.min(maxAge, 10);
    var aggCursor = g.append('line')
                        .attr('stroke', 'rgba(255,255,255,0.15)')
                        .attr('y1', 0)
                        .attr('y2', iH)
                        .style('pointer-events', 'none')
                        .style('display', 'none');
    var aggDotsG = g.append('g').style('pointer-events', 'none');
    g.append('rect')
        .attr('width', iW)
        .attr('height', iH)
        .attr('fill', 'transparent')
        .on('mousemove', function(ev) {
          var mx = d3.pointer(ev)[0];
          if (mx < 0 || mx > iW) {
            aggCursor.style('display', 'none');
            aggDotsG.selectAll('.cdot').remove();
            TIP.hide();
            return;
          }
          var age = Math.max(0, Math.min(xMax, Math.round(xSc.invert(mx))));
          aggCursor.style('display', null)
              .attr('x1', xSc(age))
              .attr('x2', xSc(age));
          aggDotsG.selectAll('.cdot').remove();
          var tipHtml =
              '<div style="margin-bottom:4px;font-weight:700;color:var(--bright)">发布后 ' +
              age + ' 年</div>';
          var showAgg = aggHighlighted ?
              aggData.filter(function(dd) { return dd.type === aggHighlighted; }) :
              aggData;
          showAgg.forEach(function(d) {
            var curve = d[curveKey];
            if (!curve) return;
            var val = curve[age] || 0;
            var absVal = d[absKey] ? d[absKey][age] : 0;
            var absStr;
            if (usePrimary === 'playtime') {
              absStr = absVal >= 60 ? Math.round(absVal / 60) + '小时' :
                                      Math.round(absVal) + '分钟';
            } else {
              absStr = absVal > 0 ? absVal.toFixed(3) + '%' : 'N/A';
            }
            var sampleN = d.sample_sizes ? d.sample_sizes[age] : 0;
            var s = TYPE_STYLE[d.type] || {};
            aggDotsG.append('circle')
                .attr('class', 'cdot')
                .attr('cx', xSc(age))
                .attr('cy', ySc(val))
                .attr('r', 4)
                .attr('fill', d.color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
            tipHtml += '<div class="tip-row" style="margin:2px 0">' +
                '<span class="tip-k" style="color:' + d.color + '">' +
                s.label + '</span>' +
                '<span class="tip-v">' + val.toFixed(2) + '× · ' + absStr +
                ' · ' + fmt.num(sampleN) + '款</span></div>';
          });
          tipHtml += '<div style="margin-top:3px;font-size:8px;color:#6060a0">' +
              tipMethodNote + '</div>';
          TIP.show(tipHtml, ev);
        })
        .on('mouseleave', function() {
          aggCursor.style('display', 'none');
          aggDotsG.selectAll('.cdot').remove();
          TIP.hide();
        });

    // Draw each type
    aggData.forEach(function(d) {
      var style = TYPE_STYLE[d.type] || {};
      var curve = d[curveKey];
      var maxIdx = Math.min(curve.length - 1, 10);

      // Area under curve
      var area = d3.area()
                     .x(function(_, i) {
                       return xSc(i);
                     })
                     .y0(function(v) {
                       return ySc(Math.min(v, 1));
                     })
                     .y1(function(v) {
                       return ySc(v);
                     })
                     .defined(function(v) {
                       return v > 0;
                     })
                     .curve(d3.curveCatmullRom.alpha(0.5));
      g.append('path')
          .attr('class', 'agg-area')
          .attr('data-type', d.type)
          .attr('d', area(curve.slice(0, maxIdx + 1)))
          .attr('fill', d.color)
          .attr('fill-opacity', aggHighlighted ? (d.type === aggHighlighted ? 0.06 : 0) : 0.06);

      // Main line
      var path = g.append('path')
                     .attr('class', 'agg-curve')
                     .attr('data-type', d.type)
                     .attr('d', line(curve.slice(0, maxIdx + 1)))
                     .attr('stroke', d.color)
                     .attr('fill', 'none')
                     .attr('stroke-width', style.width + 1)
                     .attr('stroke-dasharray', style.dash || null)
                     .attr('opacity', aggHighlighted ? (d.type === aggHighlighted ? 1 : 0.07) : 1)
                     .style('pointer-events', 'none');

      // Animate
      var totalLen = path.node().getTotalLength();
      path.attr('stroke-dasharray', totalLen)
          .attr('stroke-dashoffset', totalLen)
          .transition()
          .duration(1500)
          .ease(d3.easeCubicInOut)
          .attr('stroke-dashoffset', 0)
          .on('end', function() {
            d3.select(this).attr('stroke-dasharray', style.dash || null);
          });

      // End label
      var lastVal = curve[maxIdx];
      g.append('text')
          .attr('class', 'agg-label')
          .attr('data-type', d.type)
          .attr('x', xSc(maxIdx) + 6)
          .attr('y', ySc(lastVal) + 4)
          .attr('fill', d.color)
          .attr('font-family', '\'Space Mono\',monospace')
          .attr('font-size', 10)
          .attr('font-weight', 'bold')
          .attr('opacity', aggHighlighted ? (d.type === aggHighlighted ? 1 : 0.07) : 1)
          .text(style.label + ' ' + Math.round(lastVal * 100) + '%');
    });

    // Interpretation annotation
    g.append('text')
        .attr('x', 4)
        .attr('y', 14)
        .attr('fill', 'rgba(255,255,255,0.28)')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 10)
        .text(
            '总体视角 · 仅活跃游戏（已排除死游戏）· 指标: ' +
            (usePrimary === 'playtime' ? '中位游戏时长' :
                                         '在线比率 CCU÷拥有者') +
            ' · ' + fmt.num(aggData.reduce(function(s, d) {
              return s + d.total_games;
            }, 0)) + ' 款');

    buildLegendAggregate(aggData, curveKey, usePrimary);
  }

  function buildLegendAggregate(aggData, curveKey, usePrimary) {
    var leg = document.getElementById('decay-legend');
    leg.innerHTML = '';

    var note = document.createElement('div');
    note.className = 'dl-type-header';
    note.style.color = 'rgba(255,255,255,0.4)';
    note.innerHTML = '总体视角（与上方个体视角不同量）：' +
        (usePrimary === 'playtime' ? '按发布年数分组的中位游戏时长' :
                                     '按发布年数分组的在线比率（CCU÷拥有者）') +
        ' · 仅统计仍活跃的游戏';
    leg.appendChild(note);

    aggData.forEach(function(d) {
      var style = TYPE_STYLE[d.type] || {};
      var curve = d[curveKey];
      var lastVal = curve[Math.min(curve.length - 1, 5)];
      var trend;
      if (usePrimary === 'playtime') {
        trend = lastVal > 1.5 ? '长尾显著 ↑' :
            lastVal > 1.0     ? '略有增长' :
            lastVal > 0.7     ? '缓慢衰减' :
                                '快速衰减 ↓';
      } else {
        trend = lastVal > 0.8 ? '留存强' :
            lastVal > 0.4     ? '中等衰减' :
                                '快速流失';
      }
      var el = document.createElement('div');
      el.className = 'dl-item' + (aggHighlighted === d.type ? ' active' : '');
      el.dataset.type = d.type;
      el.style.cursor = 'pointer';
      el.innerHTML = '<span class="dl-type-line" style="border-color:' +
          d.color + (style.dash ? ';border-style:dashed' : '') +
          '"></span>' + style.label +
          ' <span style="opacity:0.5">' + fmt.num(d.total_games) + '款</span>' +
          ' <span style="opacity:0.35;font-size:9px;color:' + d.color + '">' +
          trend + '</span>';
      el.addEventListener('click', function() {
        toggleAggHighlight(d.type);
      });
      leg.appendChild(el);
    });
  }

  function toggleAggHighlight(type) {
    aggHighlighted = (aggHighlighted === type) ? null : type;
    if (!g) return;
    g.selectAll('.agg-curve')
        .transition().duration(200)
        .attr('opacity', function() {
          return !aggHighlighted || d3.select(this).attr('data-type') === aggHighlighted ? 1 : 0.07;
        });
    g.selectAll('.agg-area')
        .transition().duration(200)
        .attr('fill-opacity', function() {
          return !aggHighlighted || d3.select(this).attr('data-type') === aggHighlighted ? 0.06 : 0;
        });
    g.selectAll('.agg-label')
        .transition().duration(200)
        .attr('opacity', function() {
          return !aggHighlighted || d3.select(this).attr('data-type') === aggHighlighted ? 1 : 0.07;
        });
    // Update legend active state
    document.querySelectorAll('#decay-legend .dl-item[data-type]').forEach(function(el) {
      el.classList.toggle('active', aggHighlighted && el.dataset.type === aggHighlighted);
    });
  }

  // 存活率视角：把"幸存者偏差"本身画出来——各类型仍活跃游戏的占比随年龄变化
  function drawSurvival(aggData) {
    var wrap = document.getElementById('decay-inner');
    var W = wrap.clientWidth, H = Math.max(280, Math.min(360, W * 0.4));
    var MGA = {t: 28, r: 66, b: 52, l: 56};
    var iW = W - MGA.l - MGA.r, iH = H - MGA.t - MGA.b;

    setDecayDesc('survival');

    svg = d3.select(wrap)
              .append('svg')
              .attr('viewBox', '0 0 ' + W + ' ' + H)
              .attr('height', H);
    g = svg.append('g').attr(
        'transform', 'translate(' + MGA.l + ',' + MGA.t + ')');

    var maxAge = Math.min(d3.max(aggData, function(d) {
      return d.max_age || 10;
    }) || 10, 10);
    var xSc = d3.scaleLinear().domain([0, maxAge]).range([0, iW]);
    var ySc = d3.scaleLinear().domain([0, 1]).range([iH, 0]);

    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(ySc).ticks(5).tickSize(-iW).tickFormat(''));
    g.append('g')
        .attr('class', 'grid')
        .attr('transform', 'translate(0,' + iH + ')')
        .call(d3.axisBottom(xSc).ticks(maxAge).tickSize(-iH).tickFormat(''));
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + iH + ')')
        .call(d3.axisBottom(xSc).ticks(maxAge).tickFormat(function(d) {
          return d === 0 ? '发布年' : d + '年';
        }));
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(ySc).ticks(5).tickFormat(d3.format('.0%')));

    g.append('text')
        .attr('x', iW / 2)
        .attr('y', iH + 42)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6060a0')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 10)
        .text('游戏年龄（发布后年数）');
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -iH / 2)
        .attr('y', -42)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6060a0')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 10)
        .text('存活率（近期仍活跃）');

    var line = d3.line()
                   .x(function(_, i) {
                     return xSc(i);
                   })
                   .y(function(v) {
                     return ySc(v);
                   })
                   .defined(function(v) {
                     return v != null;
                   })
                   .curve(d3.curveCatmullRom.alpha(0.5));

    aggData.forEach(function(d) {
      if (!d.survival_available || !d.survival_curve) return;
      var style = TYPE_STYLE[d.type] || {};
      var maxIdx = Math.min(d.survival_curve.length - 1, maxAge);
      var seg = d.survival_curve.slice(0, maxIdx + 1);
      var path = g.append('path')
                     .attr('d', line(seg))
                     .attr('stroke', d.color)
                     .attr('fill', 'none')
                     .attr('stroke-width', (style.width || 2) + 0.5)
                     .attr('stroke-linecap', 'round')
                     .style('cursor', 'pointer');
      var L = path.node().getTotalLength();
      path.attr('stroke-dasharray', L)
          .attr('stroke-dashoffset', L)
          .transition()
          .duration(1300)
          .ease(d3.easeCubicInOut)
          .attr('stroke-dashoffset', 0)
          .on('end', function() {
            d3.select(this).attr('stroke-dasharray', style.dash || null);
          });

      var lastVal = seg[maxIdx];
      g.append('text')
          .attr('x', xSc(maxIdx) + 6)
          .attr('y', ySc(lastVal) + 4)
          .attr('fill', d.color)
          .attr('font-family', '\'Space Mono\',monospace')
          .attr('font-size', 10)
          .attr('font-weight', 'bold')
          .text(style.label + ' ' + Math.round(lastVal * 100) + '%');

      path.on('mousemove', function(ev) {
            var mx = d3.pointer(ev)[0];
            var age = Math.max(0, Math.min(maxIdx, Math.round(xSc.invert(mx))));
            var val = d.survival_curve[age] || 0;
            var alive = d.survival_alive ? d.survival_alive[age] : 0;
            var known = d.survival_known ? d.survival_known[age] : 0;
            TIP.show(
                '<strong>' + style.label + '（发布后' + age + '年）</strong>' +
                    '<div class="tip-row"><span class="tip-k">存活率</span><span class="tip-v" style="color:' +
                    d.color + '">' + Math.round(val * 100) + '%</span></div>' +
                    '<div class="tip-row"><span class="tip-k">近两周仍活跃</span><span class="tip-v">' +
                    fmt.num(alive) + ' / ' + fmt.num(known) +
                    ' 款</span></div>' +
                    '<div style="margin-top:3px;font-size:8px;color:#6060a0">存活=' +
                    survBasis(aggData) + ' · 仅统计有该数据的游戏</div>',
                ev);
          }).on('mouseleave', function() {
        TIP.hide();
      });
    });

    g.append('text')
        .attr('x', 4)
        .attr('y', 14)
        .attr('fill', 'rgba(255,255,255,0.3)')
        .attr('font-family', '\'Space Mono\',monospace')
        .attr('font-size', 10)
        .text(
            '存活率 = 近期仍活跃的游戏占比 · 曲线越低=越多同龄游戏已无人在线');

    buildLegendSurvival(aggData);
  }

  function buildLegendSurvival(aggData) {
    var leg = document.getElementById('decay-legend');
    leg.innerHTML = '';
    var note = document.createElement('div');
    note.className = 'dl-type-header';
    note.style.color = 'rgba(255,255,255,0.4)';
    note.innerHTML =
        '存活率视角：各类型「近期仍活跃 ÷ 有活跃数据」的游戏占比随发布年数变化 —— 直接揭示「长尾」主要是少数幸存者，而非整类游戏的普遍属性。';
    leg.appendChild(note);
    aggData.forEach(function(d) {
      if (!d.survival_available || !d.survival_curve) return;
      var style = TYPE_STYLE[d.type] || {};
      var idx = Math.min(d.survival_curve.length - 1, 5);
      var v = d.survival_curve[idx];
      var trend = v > 0.5 ? '存活强 ↑' : v > 0.25 ? '半数已死' : '大量死亡 ↓';
      var el = document.createElement('div');
      el.className = 'dl-item';
      el.innerHTML = '<div class="dl-swatch" style="background:' + d.color +
          '"></div>' + style.label + ' <span style="opacity:0.5">5年后 ' +
          Math.round(v * 100) + '%</span>' +
          ' <span style="opacity:0.35;font-size:9px;color:' + d.color + '">' +
          trend + '</span>';
      leg.appendChild(el);
    });
  }


  // ══════════════════════════════════════════════
  //  MODE SWITCHING & CONTROLS
  // ══════════════════════════════════════════════
  // 让标题下方的说明随模式切换——两个模式量的不是同一个东西，必须说清楚
  function survBasis(aggData) {
    var d = (aggData || DATA.decayAggregate || []).find(function(x) {
      return x && x.survival_basis;
    });
    return d ? d.survival_basis : '近期仍活跃';
  }

  function setDecayDesc(mode) {
    var el = document.getElementById('decay-desc');
    if (!el) return;
    if (mode === 'survival') {
      var basis = survBasis();
      el.innerHTML =
          '<strong style="color:var(--aaa)">存活率视角 · 把幸存者偏差摊开看。</strong>' +
          '纵轴是各类型游戏里「' + basis +
          '」的<strong>占比</strong>，按发布年数变化。' +
          '它说出了上面那条总体曲线藏起来的事：<strong style="color:var(--bright)">所谓「独立长尾」，其实是少数幸存者撑起来的——大多数同龄独立游戏早已无人在线。</strong>' +
          '<br><span style="color:#8080b0">存活 = ' + basis +
          '；只统计有该数据的游戏（缺数据的不计入分子分母）。</span>';
      return;
    }
    if (mode === 'aggregate') {
      el.innerHTML =
          '<strong style="color:var(--aa)">总体视角 · 换了一把尺子。</strong>' +
          '这里<strong>不是</strong>上面那几款游戏的逐月轨迹，而是把全平台游戏按<strong>发布年数</strong>分组，' +
          '比较每组的<strong>中位参与深度</strong>（游戏时长 / 在线比率）。' +
          '横轴是「年」、纵轴是相对参与度——<strong style="color:var(--bright)">和个体视角的「留存% · 逐月」不是同一个量，不能直接比读数</strong>，' +
          '两者只是从不同角度共同印证长尾。' +
          '<br><span style="color:var(--aaa)">⚠ 仅统计「仍然活跃」的游戏；当前没人在线的「死游戏」已被排除，所以这条曲线会<strong>高估</strong>典型游戏的长尾。</span>';
    } else {
      el.innerHTML = '<strong style="color:var(--indie)">个体视角。</strong>' +
          '每款代表作 ÷ 它自己的<strong>首月峰值</strong>，按<strong>月</strong>看发布后在线人数掉得有多快——这是少数代表作的真实留存轨迹。' +
          '<strong style="color:var(--text)">点击图例</strong>高亮单条曲线。';
    }
  }

  function draw() {
    cancelSweep();  // 任何重绘都先终止进行中的时间游标扫描
    setDecayDesc(decayMode);
    if (decayMode === 'aggregate') {
      drawAggregate();
    } else {
      drawIndividual();
    }
  }

  // ══════════════════════════════════════════════
  //  TIME-CURSOR SWEEP — 时间游标扫描（个体+对比视图）
  //  一条竖线从第0月扫到第24月，沿途用环标出独立/3A 的平均留存，
  //  中间竖条 = 两者差距，随扫描实时拉开
  // ══════════════════════════════════════════════
  function cancelSweep() {
    if (sweepRAF) {
      cancelAnimationFrame(sweepRAF);
      sweepRAF = null;
    }
    if (g) g.selectAll('.sweep-layer').remove();
  }

  function runSweep(durMs) {
    if (!g) return;
    cancelSweep();
    durMs = durMs || 4500;

    const indie = DATA.decay.filter(function(d) {
      return d.type === 'Indie';
    });
    const aaa = DATA.decay.filter(function(d) {
      return d.type === 'AAA';
    });
    function avgAt(arr, mF) {
      if (!arr.length) return null;
      var lo = Math.floor(mF), hi = Math.min(24, Math.ceil(mF)), t = mF - lo,
          s = 0, n = 0;
      arr.forEach(function(d) {
        var a = d.data[lo], b = d.data[hi];
        if (a != null && b != null) {
          s += a + (b - a) * t;
          n++;
        }
      });
      return n ? s / n : null;
    }

    var layer = g.append('g')
                    .attr('class', 'sweep-layer')
                    .style('pointer-events', 'none');
    var cur = layer.append('line')
                  .attr('y1', 0)
                  .attr('y2', _iH)
                  .attr('stroke', '#fff')
                  .attr('stroke-opacity', 0.5)
                  .attr('stroke-width', 1);
    var gapBar = layer.append('line')
                     .attr('stroke', C.Indie)
                     .attr('stroke-width', 6)
                     .attr('stroke-linecap', 'round')
                     .attr('opacity', 0.3);
    var ringI = layer.append('circle')
                    .attr('r', 5)
                    .attr('fill', 'none')
                    .attr('stroke', C.Indie)
                    .attr('stroke-width', 2);
    var ringA = layer.append('circle')
                    .attr('r', 5)
                    .attr('fill', 'none')
                    .attr('stroke', C.AAA)
                    .attr('stroke-width', 2);
    var box = layer.append('g');
    // Pill badge (gold, positioned at upper-left of chart area)
    var maxLabelW = 270;
    box.append('rect')
        .attr('x', -30)
        .attr('y', -50)
        .attr('width', maxLabelW)
        .attr('height', 20)
        .attr('rx', 10)
        .attr('fill', 'rgba(255,210,80,0.1)')
        .attr('stroke', 'rgba(255,210,80,0.5)')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');
    var boxTxt = box.append('text')
                     .attr('x', -30 + maxLabelW / 2)
                     .attr('y', -36)
                     .attr('text-anchor', 'middle')
                     .attr('font-family', '\'Space Mono\',monospace')
                     .attr('font-size', 10)
                     .attr('font-weight', '600')
                     .attr('fill', 'rgba(255,210,80,0.9)')
                     .attr('letter-spacing', '0.5');

    var start = performance.now();
    function frame(now) {
      var p = Math.min((now - start) / durMs, 1);
      var mF = p * 24, m = Math.round(mF), x = xSc(mF);
      cur.attr('x1', x).attr('x2', x);
      var iv = avgAt(indie, mF), av = avgAt(aaa, mF);
      if (iv != null && av != null) {
        var yi = ySc(iv), ya = ySc(av);
        gapBar.attr('x1', x).attr('x2', x).attr('y1', yi).attr('y2', ya);
        ringI.attr('cx', x).attr('cy', yi);
        ringA.attr('cx', x).attr('cy', ya);
        var gap = Math.round((iv - av) * 100);
        boxTxt.text(
            '第 ' + m + ' 月    独立均 ' + Math.round(iv * 100) + '%    3A均 ' +
            Math.round(av * 100) + '%    差 ' + (gap >= 0 ? '+' : '') + gap +
            '%');
      }
      if (p < 1)
        sweepRAF = requestAnimationFrame(frame);
      else
        sweepRAF = null;  // 结束后保留终态（差距最大处）
    }
    sweepRAF = requestAnimationFrame(frame);
  }

  // Load aggregate data
  (async function() {
    try {
      var resp = null;
      if (typeof API_BASE !== 'undefined') {
        try {
          var r = await fetch(API_BASE + '/decay_aggregate');
          if (r.ok) resp = await r.json();
        } catch (e) {
        }
      }
      if (!resp) {
        try {
          var r2 = await fetch('../data/processed/decay_aggregate.json');
          if (r2.ok) resp = await r2.json();
        } catch (e) {
        }
      }
      if (resp && resp.length > 0) {
        DATA.decayAggregate = resp;
        console.log('[decay] aggregate data loaded: ' + resp.length + ' types');
      }
    } catch (e) {
      console.log('[decay] aggregate data not available');
    }
  })();

  // Mode buttons
  document.querySelectorAll('[data-dm]').forEach(function(b) {
    b.addEventListener('click', function() {
      document.querySelectorAll('[data-dm]').forEach(function(x) {
        x.classList.remove('active');
      });
      this.classList.add('active');
      decayMode = this.dataset.dm;
      highlighted = null;
      aggHighlighted = null;
      firstDraw = (decayMode === 'individual');
      draw();
    });
  });

  // Ref line buttons
  document.querySelectorAll('[data-dr]').forEach(function(b) {
    b.addEventListener('click', function() {
      document.querySelectorAll('[data-dr]').forEach(function(x) {
        x.classList.remove('active');
      });
      this.classList.add('active');
      showRef = this.dataset.dr === 'on';
      firstDraw = false;
      draw();
    });
  });

  // Initial render (may be below the fold — animation handled by IO)
  firstDraw = false;
  draw();

  // Ensure grow-in animation plays when section first enters viewport
  var _decayAnimated = false;
  var _decayIO = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting && !_decayAnimated) {
        _decayAnimated = true;
        firstDraw = true;
        draw();
        _decayIO.disconnect();
      }
    });
  }, { threshold: 0.05 });
  _decayIO.observe(document.getElementById('sec-decay'));

  window._decayRedraw = function() {
    firstDraw = false;
    draw();
  };

  window._decayApplyNarrative = function(opts) {
    if (opts.compareIndieAAA) {
      narrativeCompare = true;
      highlighted = null;
      switchToIndividualMode();
    }
    if (opts.compareIndieAAA === false) narrativeCompare = false;
    firstDraw = false;
    draw();
  };

  // 时间游标扫描：确保处于 个体+对比 视图后，从第0月扫到第24月
  window._decaySweep = function(durMs) {
    narrativeCompare = true;
    switchToIndividualMode();
    firstDraw = false;
    draw();  // 重绘到个体+对比，刷新 g / xSc / ySc / 几何
    runSweep(durMs || 4500);
  };

  // Cross-view linkage: scatter → decay
  EVT.on('decayHighlight', function(name) {
    if (!name) {
      highlightLine(null, true);
      return;
    }
    switchToIndividualMode();
    var match = DATA.decay.find(function(d) {
      return d.name === name;
    });
    if (match) highlightLine(match.name, true);
  });
};
// ════════════════════════════════════════════════