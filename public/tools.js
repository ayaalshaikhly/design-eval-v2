/* ============================================================
   Shared tool definitions + map drawing for v2 class sessions
   x/y are the two scales of each tool (both 1–5).
   ============================================================ */
(function () {
  var TOOLS = {
    meta: {
      key: 'meta',
      title: 'Metaphoric Design Evaluation',
      zoneName: 'Target zone',
      defaultZone: { cx: 3.5, cy: 4.0, rx: 0.65, ry: 0.55 },
      x: {
        name: 'Metaphorical Abstraction',
        short: 'Abstraction',
        question: 'How literal or abstract is the design compared to its source?',
        low: 'Highly Literal', high: 'Highly Abstract',
        levels: {
          1: 'Highly Literal — The design looks like the source.',
          2: 'Mostly Literal — It still looks a lot like the source, but it has been changed a little.',
          3: 'Subtle / Balanced — You can recognize the source, but the idea has been transformed in a meaningful way.',
          4: 'Mostly Abstract — You may not see the source right away, but you can figure out the connection.',
          5: 'Highly Abstract — The source is hard to recognize, and the meaning is hard to figure out.'
        }
      },
      y: {
        name: 'Source Relevance',
        short: 'Relevance',
        question: 'How relevant is the inspiration source to the PRODUCT?',
        low: 'Irrelevant', high: 'Highly Relevant',
        levels: {
          1: 'Irrelevant — The source has little or nothing in common with the PRODUCT.',
          2: 'Slightly Relevant — The source has a weak or indirect link to the PRODUCT.',
          3: 'Moderately Relevant — The source has a recognizable link to the PRODUCT.',
          4: 'Clearly Relevant — The source shares meaningful characteristics with the PRODUCT.',
          5: 'Highly Relevant — The source has a strong, compelling link to the PRODUCT.'
        }
      }
    },
    maya: {
      key: 'maya',
      title: 'MAYA Calibration',
      zoneName: 'MAYA zone',
      defaultZone: { cx: 3.6, cy: 3.6, rx: 0.8, ry: 0.7 },
      presets: {
        'Consumer product': { cx: 3.6, cy: 3.6, rx: 0.8, ry: 0.7 },
        'Medical device': { cx: 4.0, cy: 2.8, rx: 0.7, ry: 0.6 },
        'Fashion / lifestyle': { cx: 2.8, cy: 4.0, rx: 0.8, ry: 0.7 },
        'Consumer electronics': { cx: 3.5, cy: 3.5, rx: 0.7, ry: 0.7 },
        'Architecture / interior': { cx: 3.4, cy: 3.4, rx: 0.8, ry: 0.7 }
      },
      x: {
        name: 'Familiarity',
        short: 'Familiarity',
        question: 'How easy is it to understand what this is and how it would be used?',
        low: 'Hard to understand', high: 'Instantly understood',
        levels: {
          1: 'Hard to understand — I cannot tell what it is or how it would be used.',
          2: 'Unclear — I need a lot of explanation to understand it.',
          3: 'Understandable — I get it once it is explained.',
          4: 'Easy to understand — I can tell what it is and how to use it.',
          5: 'Instantly understood — It is immediately clear what it is and how it is used.'
        }
      },
      y: {
        name: 'Novelty',
        short: 'Novelty',
        question: 'How new is this idea to you?',
        low: 'Very familiar', high: 'Never seen before',
        levels: {
          1: 'Very familiar — I have seen this many times before.',
          2: 'Mostly familiar — Ideas like this are common; only small changes.',
          3: 'Somewhat new — Some parts feel new, others feel familiar.',
          4: 'Quite new — I have rarely seen anything like this.',
          5: 'Never seen before — I have never seen anything like this.'
        }
      }
    }
  };

  function withProduct(text, product) {
    return text.replace(/PRODUCT/g, product || 'product');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function mean(arr, k) {
    if (!arr.length) return null;
    return arr.reduce(function (s, r) { return s + r[k]; }, 0) / arr.length;
  }

  function inZone(zone, x, y) {
    var dx = (x - zone.cx) / zone.rx, dy = (y - zone.cy) / zone.ry;
    return dx * dx + dy * dy <= 1;
  }

  // Developmental wording: never "good/bad", always "which direction to develop".
  function suggestion(toolKey, zone, mx, my) {
    if (inZone(zone, mx, my)) {
      return { cls: 'in-zone', icon: '✔', text: toolKey === 'maya'
        ? 'In the MAYA zone: novel enough to excite, familiar enough to accept.'
        : 'In the target zone: the metaphor is well balanced between abstraction and relevance.' };
    }
    var dx = zone.cx - mx, dy = zone.cy - my, parts = [];
    if (toolKey === 'meta') {
      if (dx > 0.3) parts.push('make it a bit more abstract (less literal)');
      else if (dx < -0.3) parts.push('make it a bit more recognizable (less abstract)');
      if (dy > 0.3) parts.push('choose a source that relates more to the product');
      else if (dy < -0.3) parts.push('explore a more creative reading of the source');
    } else {
      if (dy > 0.3) parts.push('push toward more novelty: explore unexpected directions (lateral thinking)');
      else if (dy < -0.3) parts.push('temper the novelty: make it easier to grasp (vertical thinking)');
      if (dx > 0.3) parts.push('strengthen the link to recognizable forms and uses');
      else if (dx < -0.3) parts.push('move away from the obvious: try unexpected combinations');
    }
    if (!parts.length) return { cls: 'in-zone', icon: '✔', text: 'Very close to the ' + TOOLS[toolKey].zoneName.toLowerCase() + '.' };
    return { cls: dy > 0 ? 'push-novelty' : 'push-familiarity', icon: '↗', text: 'To develop it: ' + parts.join(', and ') + '.' };
  }

  // Distinct colours for many presenters (golden-angle hue spacing).
  function colorFor(i) {
    var h = Math.round((i * 137.508) % 360);
    return 'hsl(' + h + ',62%,42%)';
  }

  /* drawMap(canvas, {tool, zone, series:[{color, ratings:[{x,y}], avg:{x,y}, label}], showLabels})
     - ratings are drawn as dots sized by how many people gave that exact score
     - avg is drawn as a diamond with an arrow toward the zone */
  function drawMap(canvas, opts) {
    var T = TOOLS[opts.tool], zone = opts.zone;
    // Hidden tabs have no width yet; they are drawn when shown.
    if (canvas.parentElement.clientWidth < 120) return;
    var w = canvas.parentElement.clientWidth, h = Math.min(Math.max(w * 0.9, 300), 600), dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var pad = { top: 24, right: 20, bottom: 58, left: 58 };
    var pw = w - pad.left - pad.right, ph = h - pad.top - pad.bottom;
    var X = function (v) { return pad.left + ((v - 1) / 4) * pw; };
    var Y = function (v) { return pad.top + ph - ((v - 1) / 4) * ph; };

    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#eef0f2'; ctx.lineWidth = 1;
    for (var v = 1; v <= 5; v++) {
      ctx.beginPath(); ctx.moveTo(X(v), pad.top); ctx.lineTo(X(v), pad.top + ph); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.left, Y(v)); ctx.lineTo(pad.left + pw, Y(v)); ctx.stroke();
    }
    ctx.strokeStyle = '#ccc';
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ph); ctx.lineTo(pad.left + pw, pad.top + ph);
    ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ph); ctx.stroke();

    ctx.fillStyle = '#888'; ctx.font = '11px Inter,sans-serif'; ctx.textAlign = 'center';
    for (v = 1; v <= 5; v++) {
      ctx.fillText(v, X(v), pad.top + ph + 16);
      ctx.save(); ctx.textAlign = 'right'; ctx.fillText(v, pad.left - 8, Y(v) + 4); ctx.restore();
    }
    ctx.font = '10px Inter,sans-serif'; ctx.fillStyle = '#999';
    ctx.textAlign = 'left'; ctx.fillText(T.x.low, pad.left, pad.top + ph + 30);
    ctx.textAlign = 'right'; ctx.fillText(T.x.high, pad.left + pw, pad.top + ph + 30);
    ctx.save(); ctx.translate(pad.left - 26, pad.top + ph); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'left'; ctx.fillText(T.y.low, 0, 0); ctx.textAlign = 'right'; ctx.fillText(T.y.high, ph, 0); ctx.restore();

    ctx.fillStyle = '#444'; ctx.font = '600 12px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(T.x.name.toUpperCase() + ' →', pad.left + pw / 2, h - 8);
    ctx.save(); ctx.translate(14, pad.top + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(T.y.name.toUpperCase() + ' →', 0, 0); ctx.restore();

    // Zone
    var zx = X(zone.cx), zy = Y(zone.cy), zrx = (zone.rx / 4) * pw, zry = (zone.ry / 4) * ph;
    ctx.beginPath(); ctx.ellipse(zx, zy, zrx, zry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(45,106,79,0.10)'; ctx.fill();
    ctx.strokeStyle = 'rgba(45,106,79,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(45,106,79,0.8)'; ctx.font = '600 11px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(T.zoneName.toUpperCase(), zx, zy - zry - 6 < pad.top + 10 ? zy + 4 : zy - zry - 6);

    var series = opts.series || [];
    // Individual ratings: one dot per distinct score, bigger when more people gave it
    series.forEach(function (s) {
      if (!s.ratings || !s.ratings.length) return;
      var counts = {};
      s.ratings.forEach(function (r) { var k = r.x + ',' + r.y; counts[k] = (counts[k] || 0) + 1; });
      Object.keys(counts).forEach(function (k) {
        var p = k.split(','), n = counts[k], rad = 4 + Math.sqrt(n) * 3;
        ctx.beginPath(); ctx.arc(X(+p[0]), Y(+p[1]), rad, 0, Math.PI * 2);
        ctx.globalAlpha = 0.28; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = s.color; ctx.lineWidth = 1; ctx.stroke();
        if (n > 1) { ctx.fillStyle = s.color; ctx.font = '600 10px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(n, X(+p[0]), Y(+p[1]) + 3.5); }
      });
    });

    // Averages (diamonds), arrows toward the zone, optional labels
    var placed = [];
    function freeSpot(x, y, tw) {
      // Nudge a label down/up until it no longer overlaps one already drawn.
      var tries = [0, 14, -14, 28, -28, 42, -42];
      for (var i = 0; i < tries.length; i++) {
        var ty = y + tries[i], hit = placed.some(function (r) { return x < r.x + r.w && x + tw > r.x && ty - 8 < r.y + 15 && ty + 7 > r.y; });
        if (!hit) return ty;
      }
      return y;
    }
    series.forEach(function (s) {
      if (!s.avg) return;
      var mx = X(s.avg.x), my = Y(s.avg.y), ds = opts.small ? 7 : 10;
      if (opts.arrows !== false) {
        var dx = zx - mx, dy = zy - my, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 26 && !inZone(zone, s.avg.x, s.avg.y)) {
          var ang = Math.atan2(dy, dx), len = Math.min(dist - 20, 56);
          var ax = mx + Math.cos(ang) * 14, ay = my + Math.sin(ang) * 14, bx = ax + Math.cos(ang) * len, by = ay + Math.sin(ang) * len;
          ctx.strokeStyle = s.color; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(bx, by); ctx.lineTo(bx - 7 * Math.cos(ang - 0.4), by - 7 * Math.sin(ang - 0.4));
          ctx.moveTo(bx, by); ctx.lineTo(bx - 7 * Math.cos(ang + 0.4), by - 7 * Math.sin(ang + 0.4)); ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.moveTo(mx, my - ds); ctx.lineTo(mx + ds, my); ctx.lineTo(mx, my + ds); ctx.lineTo(mx - ds, my); ctx.closePath();
      ctx.fillStyle = s.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    });
    // Names last, so no diamond covers a label
    series.forEach(function (s) {
      if (!s.avg) return;
      var mx = X(s.avg.x), my = Y(s.avg.y), ds = opts.small ? 7 : 10;
      if (opts.showLabels && s.label) {
        ctx.font = '600 11px Inter,sans-serif'; ctx.textAlign = 'left';
        var tw = ctx.measureText(s.label).width, tx = mx + ds + 4;
        if (tx + tw > w - 4) { tx = mx - ds - 4 - tw; }
        var ty = freeSpot(tx, my, tw);
        placed.push({ x: tx - 2, y: ty - 8, w: tw + 4 });
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(tx - 2, ty - 8, tw + 4, 15);
        ctx.fillStyle = s.color; ctx.fillText(s.label, tx, ty + 4);
      }
    });
  }

  window.DE = { TOOLS: TOOLS, withProduct: withProduct, esc: esc, mean: mean, inZone: inZone, suggestion: suggestion, colorFor: colorFor, drawMap: drawMap };
})();
