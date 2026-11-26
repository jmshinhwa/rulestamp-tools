/* cloak.js - hooded cloak pattern drafted by code (no image model).
   One engine for the web page (window.Cloak) and the PDF builder (node require).
   Units: millimetres. y grows downward in layout space (like SVG). */
(function (root) {
  'use strict';
  var PI = Math.PI;
  var SA = 15;            // seam allowance on every seam, mm
  var HEM = 25;           // hem allowance on the outer edge, mm
  var EASE = 120;         // neckline = base-of-neck circumference + this
  var EXT = 250;          // the printed neck template reaches this far down the panel
  var STRIP = 100;        // 3-piece hood: centre strip width (seam line), mm
  var TOL = 3;            // a neckline mismatch above this (mm) fails the check

  // size chart: base-of-neck circumference and hood height (neck seam to top), mm
  var SIZES = [
    { id: 'PP', neck: 340, hood: 370 },
    { id: 'P', neck: 360, hood: 375 },
    { id: 'M', neck: 380, hood: 380 },
    { id: 'G', neck: 400, hood: 385 },
    { id: 'GG', neck: 420, hood: 390 },
    { id: 'G1', neck: 440, hood: 395 },
    { id: 'G2', neck: 460, hood: 400 }
  ];
  var LENGTHS = [
    { id: 'hip', label: 'Quadril', cm: 60 },
    { id: 'knee', label: 'Joelho', cm: 95 },
    { id: 'calf', label: 'Meia canela', cm: 115 },
    { id: 'floor', label: 'Chão', cm: 135 }
  ];
  // length from height: estimate only (body proportions), the page says "measure to be sure"
  var FROM_HEIGHT = { hip: 0.34, knee: 0.55, calf: 0.66, floor: 0.81 };

  function sizeById(id) {
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === id) return SIZES[i];
    return null;
  }

  // ---------- geometry helpers ----------
  function bez(p0, p1, p2, p3, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
    return out;
  }
  function arc(cx, cy, r, a0, a1, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * i / n;
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return out;
  }
  function len(pts) {
    var s = 0;
    for (var i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return s;
  }
  function pointAt(pts, d) {           // point at arc length d along a polyline
    var s = 0;
    for (var i = 1; i < pts.length; i++) {
      var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (s + l >= d) {
        var t = l ? (d - s) / l : 0;
        var p = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
        var nx = -(pts[i][1] - pts[i - 1][1]) / (l || 1), ny = (pts[i][0] - pts[i - 1][0]) / (l || 1);
        return { p: p, n: [nx, ny] };
      }
      s += l;
    }
    return { p: pts[pts.length - 1], n: [0, 1] };
  }
  function area(poly) {
    var a = 0;
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }
  function join() {                    // concatenate polylines, dropping repeated joints
    var out = [];
    for (var k = 0; k < arguments.length; k++) {
      var s = arguments[k];
      for (var i = 0; i < s.length; i++) {
        var p = s[i], l = out[out.length - 1];
        if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-6) out.push(p);
      }
    }
    return out;
  }
  // per-edge offset of a closed polygon (outward), joints by line intersection (miter, clamped)
  function offset(poly, dists) {
    var n = poly.length, ccw = area(poly) > 0, lines = [];
    for (var i = 0; i < n; i++) {
      var p = poly[i], q = poly[(i + 1) % n];
      var dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
      var nx = dy / l, ny = -dx / l;           // right normal; outward for a CCW polygon in y-up maths
      if (!ccw) { nx = -nx; ny = -ny; }
      var d = typeof dists === 'number' ? dists : dists[i];
      lines.push({ p: [p[0] + nx * d, p[1] + ny * d], v: [dx / l, dy / l], d: d, n: [nx, ny] });
    }
    var out = [];
    for (var j = 0; j < n; j++) {
      var a = lines[(j - 1 + n) % n], b = lines[j];
      var den = a.v[0] * b.v[1] - a.v[1] * b.v[0];
      var corner = poly[j];
      if (Math.abs(den) < 1e-9) { out.push(b.p); continue; }
      var t = ((b.p[0] - a.p[0]) * b.v[1] - (b.p[1] - a.p[1]) * b.v[0]) / den;
      var x = [a.p[0] + a.v[0] * t, a.p[1] + a.v[1] * t];
      var lim = 3 * Math.max(a.d, b.d);
      if (Math.hypot(x[0] - corner[0], x[1] - corner[1]) > lim) {     // too sharp: bevel
        out.push([corner[0] + a.n[0] * a.d, corner[1] + a.n[1] * a.d]);
        out.push([corner[0] + b.n[0] * b.d, corner[1] + b.n[1] * b.d]);
      } else out.push(x);
    }
    return out;
  }
  function bbox(polys) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    polys.forEach(function (pl) {
      pl.forEach(function (p) {
        if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1];
        if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1];
      });
    });
    return b;
  }
  // closed polygon from edges [{pts, sa}] → seam polygon + per-segment allowance
  function piece(edges) {
    var poly = [], d = [];
    edges.forEach(function (e) {
      for (var i = 0; i < e.pts.length - 1; i++) { poly.push(e.pts[i]); d.push(e.sa); }
    });
    return { seam: poly, cut: offset(poly, d) };
  }

  // ---------- hood ----------
  // the neck edge as a function of its width w (front neck point at 0,0)
  function hoodNeck(w) {
    return bez([0, 0], [0.4 * w, 0.06 * w], [0.75 * w, 0.05 * w], [w, -0.1 * w], 60);
  }
  function solveNeck(target) {          // bisection: neck edge length == target
    var lo = 50, hi = 900;
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2;
      if (len(hoodNeck(mid)) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  // y is up for the hood maths, flipped to layout (y down) at the end
  function hoodSide(target, H, three) {
    var w = solveNeck(target);
    var neck = hoodNeck(w);
    var Bn = neck[neck.length - 1];
    var back, top;
    if (!three) {
      back = bez(Bn, [w * 1.25, 0.35 * H], [w * 1.1, H], [w * 0.72, H], 60);
      top = [[w * 0.72, H], [0, H]];
    } else {
      back = bez(Bn, [w * 1.12, 0.55 * H], [w * 0.85, H], [w * 0.45, H], 60);
      top = [[w * 0.45, H], [0, H]];
    }
    var front = [[0, H], [0, 0]];
    var outer = join(back, top);       // 3-piece: this whole edge sews to the strip
    var e = piece([
      { pts: neck, sa: SA }, { pts: back, sa: SA }, { pts: top, sa: SA }, { pts: front, sa: SA }
    ]);
    var flip = function (p) { return [p[0], -p[1]]; };
    return {
      w: w, neckLen: len(neck), outerLen: len(outer), backLen: len(back),
      seam: e.seam.map(flip), cut: e.cut.map(flip), neck: neck.map(flip), outer: outer.map(flip)
    };
  }

  // ---------- cloak panel (quarter of a circle) ----------
  // full circle: 4 quarter panels, neckline 2*pi*r = N · half circle: 2 quarter panels, pi*r = N
  function panel(N, full, L, ext) {
    var r = full ? N / (2 * PI) : N / PI;
    var ro = r + Math.min(ext, L);
    var inner = arc(0, 0, r, 0, PI / 2, 90);
    var outerArc = arc(0, 0, ro, PI / 2, 0, 120);
    var e = piece([
      { pts: inner, sa: SA },
      { pts: [[0, r], [0, ro]], sa: SA },
      { pts: outerArc, sa: ro >= r + L - 0.5 ? HEM : 0 },     // the template edge has no allowance; the real hem does
      { pts: [[ro, 0], [r, 0]], sa: SA }
    ]);
    return { r: r, ro: ro, R: r + L, neck: inner, seam: e.seam, cut: e.cut, neckLen: len(inner) };
  }

  // ---------- one complete draft ----------
  // opt: {size:'M'} or {neck:mm, hood:mm}; full:bool; three:bool; length:mm; fabric:mm (bolt width)
  function draft(opt) {
    opt = opt || {};
    var s = opt.size ? sizeById(opt.size) : null;
    var neck = +(opt.neck || (s && s.neck) || 380);
    var H = +(opt.hood || (s && s.hood) || 380);
    var full = opt.full !== false;
    var three = !!opt.three;
    var L = +(opt.length || 1350);
    var fabric = +(opt.fabric || 1500);
    var N = neck + EASE;                                  // cloak neckline on the seam line
    var P = panel(N, full, L, EXT);
    var panels = full ? 4 : 2;
    var cloakNeck = P.neckLen * panels;                   // measured on the drawn arcs
    var sideTarget = three ? (N - STRIP) / 2 : N / 2;
    var hood = hoodSide(sideTarget, H, three);
    var strip = null;
    if (three) {
      var sl = hood.outerLen;
      var sp = [[0, 0], [STRIP, 0], [STRIP, sl], [0, sl]];
      strip = { w: STRIP, len: sl, seam: sp, cut: offset(sp, SA) };
    }
    var hoodNeckTotal = 2 * hood.neckLen + (three ? STRIP : 0);
    var diff = hoodNeckTotal - cloakNeck;
    // shoulder notch: full circle = the panel seam at N/4 from centre front; half circle = arc midpoint
    var notchAt = N / 4;
    var checks = [
      { id: 'neckline', label: 'Gola do capuz contra decote da capa', a: hoodNeckTotal, b: cloakNeck, diff: diff, ok: Math.abs(diff) <= TOL },
      { id: 'notch', label: 'Pique do ombro, capuz contra peça da capa', a: notchAt, b: full ? P.neckLen : P.neckLen / 2, diff: notchAt - (full ? P.neckLen : P.neckLen / 2), ok: Math.abs(notchAt - (full ? P.neckLen : P.neckLen / 2)) <= TOL }
    ];
    if (three) checks.push({ id: 'strip', label: 'Faixa central contra borda lateral do capuz', a: strip.len, b: hood.outerLen, diff: strip.len - hood.outerLen, ok: Math.abs(strip.len - hood.outerLen) <= TOL });
    var lay = fabricUse(P, panels, hood, strip, fabric);
    return {
      opt: { size: s ? s.id : 'custom', neck: neck, hood: H, full: full, three: three, length: L, fabric: fabric },
      N: N, panel: P, panels: panels, hood: hood, strip: strip, notchAt: notchAt,
      cloakNeck: cloakNeck, hoodNeck: hoodNeckTotal, diff: diff, checks: checks, ok: checks.every(function (c) { return c.ok; }),
      hemRadius: P.R, markFromNeck: L, fabricUse: lay
    };
  }

  // fabric needed: simple layout, each quarter panel in its own square (no nesting) - an estimate on the safe side
  function fabricUse(P, panels, hood, strip, bolt) {
    var W = bolt - 20;                                    // 1 cm selvage each side
    var box = P.R + HEM + SA;
    var perRow = Math.max(1, Math.floor(W / box));
    var rows = Math.ceil(panels / perRow);
    var corner = null;
    if (box > W) {                                        // a strip of the hem sticks out past the fabric: piece it
      var h = box - W, x = Math.sqrt(Math.max(0, box * box - W * W));
      corner = { w: x + 2 * SA, h: h + 2 * SA, count: panels };
    }
    var panelLen = rows * box + (corner ? Math.ceil(corner.count * corner.w / W) * corner.h : 0);
    var hb = bbox([hood.cut]);
    var hw = hb[2] - hb[0], hh = hb[3] - hb[1];
    var items = [[hw, hh], [hw, hh]];
    if (strip) items.push([strip.w + 2 * SA, strip.len + 2 * SA]);
    var x = 0, rowH = 0, hoodLen = 0;
    items.forEach(function (it) {
      if (x + it[0] > W) { hoodLen += rowH; x = 0; rowH = 0; }
      x += it[0]; rowH = Math.max(rowH, it[1]);
    });
    hoodLen += rowH;
    return { bolt: bolt, shell: panelLen + hoodLen, lining: hoodLen, panelBox: box, perRow: perRow, corner: corner };
  }

  // ---------- pieces with marks, for drawing ----------
  function pieces(d) {
    var out = [];
    var sz = d.opt.size === 'custom' ? 'medidas próprias' : 'tamanho ' + d.opt.size;
    var hood = d.hood;
    var neckPt = pointAt(hood.neck, d.notchAt);
    var hb = bbox([hood.cut]);
    out.push({
      key: 'hood', name: d.opt.three ? 'LATERAL DO CAPUZ (capuz de 3 peças)' : 'LATERAL DO CAPUZ (capuz de 2 peças)',
      cut: 'Cortar 2 no tecido externo + 2 no forro (um par espelhado)', size: sz, seam: hood.seam, cutLine: hood.cut,
      notches: [{ p: hood.neck[0], n: [0, 1], t: 'CF' }, { p: neckPt.p, n: neckPt.n, t: 'ombro' }, { p: hood.neck[hood.neck.length - 1], n: [1, 0], t: 'CC' }],
      grain: [[hood.w * 0.35, -hood.w * 0.2], [hood.w * 0.35, -d.opt.hood * 0.8]],
      label: [hood.w * 0.12, -d.opt.hood * 0.62], bb: hb
    });
    if (d.strip) {
      out.push({
        key: 'strip', name: 'FAIXA CENTRAL DO CAPUZ', cut: 'Cortar 1 no tecido externo + 1 no forro', size: sz, seam: d.strip.seam, cutLine: d.strip.cut,
        notches: [{ p: [STRIP / 2, d.strip.len], n: [0, 1], t: 'CC gola' }],
        grain: [[STRIP / 2, 60], [STRIP / 2, d.strip.len - 60]], label: [8, 30], vertical: true, bb: bbox([d.strip.cut])
      });
    }
    var P = d.panel;
    var mid = pointAt(P.neck, P.neckLen / 2);
    out.push({
      key: 'panel', name: (d.opt.full ? 'PEÇA DA CAPA, círculo completo' : 'PEÇA DA CAPA, meio círculo') + ' - gabarito do decote',
      cut: d.opt.full ? 'Cortar 4 (2 pares espelhados). Costuras: centro das costas + 2 ombros' : 'Cortar 2 espelhadas ou 1 na dobra no centro das costas',
      size: sz, seam: P.seam, cutLine: P.cut, template: P.ro < P.R - 0.5,
      notches: d.opt.full ? [] : [{ p: mid.p, n: mid.n, t: 'ombro' }],
      grain: [[P.r + 30, 15], [P.ro - 20, 15]],
      label: [P.r * 0.55 + 20, P.r * 0.55 + 40], bb: bbox([P.cut]),
      note: 'Barra: medir ' + Math.round(d.opt.length / 10) + ' cm a partir da linha de costura do decote em toda a volta e somar 2,5 cm'
    });
    return out;
  }

  // ---------- SVG (screen preview) ----------
  function svg(d, opts) {
    opts = opts || {};
    var ps = pieces(d), gap = 40, x = 0, items = [];
    ps.forEach(function (p) {
      var b = p.bb, w = b[2] - b[0], h = b[3] - b[1];
      items.push({ p: p, dx: x - b[0], dy: -b[1], w: w, h: h });
      x += w + gap;
    });
    var W = x - gap, H = Math.max.apply(null, items.map(function (i) { return i.h; }));
    var f = function (pts, dx, dy) {
      return pts.map(function (p, i) { return (i ? 'L' : 'M') + (p[0] + dx).toFixed(1) + ' ' + (p[1] + dy).toFixed(1); }).join('') + 'Z';
    };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ' + (W + 20).toFixed(0) + ' ' + (H + 20).toFixed(0) + '" role="img" aria-label="Peças do molde desenhadas por código">';
    items.forEach(function (it) {
      var p = it.p;
      s += '<path d="' + f(p.cutLine, it.dx, it.dy) + '" fill="#fff" stroke="#1e2538" stroke-width="2.2"/>';
      s += '<path d="' + f(p.seam, it.dx, it.dy) + '" fill="none" stroke="#285c96" stroke-width="1.2" stroke-dasharray="8 6"/>';
      p.notches.forEach(function (n) {
        var a = [n.p[0] + it.dx, n.p[1] + it.dy];
        s += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + (a[0] + n.n[0] * 15).toFixed(1) + '" y2="' + (a[1] + n.n[1] * 15).toFixed(1) + '" stroke="#c2410c" stroke-width="3"/>';
      });
      var gx = p.grain;
      s += '<line x1="' + (gx[0][0] + it.dx) + '" y1="' + (gx[0][1] + it.dy) + '" x2="' + (gx[1][0] + it.dx) + '" y2="' + (gx[1][1] + it.dy) + '" stroke="#58627a" stroke-width="1.5" marker-end="url(#a)"/>';
      s += '<text x="' + (it.dx + it.p.bb[0] + 6) + '" y="' + (it.h + 26) + '" font-size="22" fill="#1e2538" font-family="sans-serif">' + esc(p.name.split(' - ')[0]) + '</text>';
    });
    s = s.replace('role="img"', 'role="img" overflow="visible"');
    s += '<defs><marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#58627a"/></marker></defs></svg>';
    return s.replace('viewBox="-10 -10 ' + (W + 20).toFixed(0) + ' ' + (H + 20).toFixed(0), 'viewBox="-10 -10 ' + (W + 20).toFixed(0) + ' ' + (H + 50).toFixed(0));
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---------- PDF writer (vector, Helvetica, no library) ----------
  var WA = { 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201e: 0x84, 0x201d: 0x94, 0x2026: 0x85, 0x20ac: 0x80, 0x2022: 0x95 };
  function pdfStr(str) {   // WinAnsiEncoding: Latin-1 letters (á ã ç é ê í ó õ ú ×) as octal escapes
    var o = '';
    String(str).split('').forEach(function (ch) {
      var c = ch.charCodeAt(0);
      if (c === 0x5c || c === 0x28 || c === 0x29) o += '\\' + ch;
      else if (c >= 0x20 && c <= 0x7e) o += ch;
      else { var b = WA[c] || (c >= 0xa0 && c <= 0xff ? c : 0x2d); o += '\\' + ('00' + b.toString(8)).slice(-3); }
    });
    return o;
  }
  var K = 72 / 25.4;   // pt per mm
  function Pdf() { this.pages = []; }
  Pdf.prototype.page = function (wmm, hmm) {
    var pg = { w: wmm, h: hmm, ops: [] };
    this.pages.push(pg);
    var self = { pg: pg };
    var X = function (x) { return (x * K).toFixed(3); };
    var Y = function (y) { return ((hmm - y) * K).toFixed(3); };
    self.width = function (mm) { pg.ops.push((mm * K).toFixed(3) + ' w'); return self; };
    self.gray = function (g) { pg.ops.push(g + ' G ' + g + ' g'); return self; };
    self.rgb = function (r, g, b) { pg.ops.push(r + ' ' + g + ' ' + b + ' RG ' + r + ' ' + g + ' ' + b + ' rg'); return self; };
    self.dash = function (a, b) { pg.ops.push(a ? '[' + (a * K).toFixed(2) + ' ' + (b * K).toFixed(2) + '] 0 d' : '[] 0 d'); return self; };
    self.path = function (pts, close, fill) {
      if (!pts.length) return self;
      var o = X(pts[0][0]) + ' ' + Y(pts[0][1]) + ' m';
      for (var i = 1; i < pts.length; i++) o += ' ' + X(pts[i][0]) + ' ' + Y(pts[i][1]) + ' l';
      pg.ops.push(o + (close ? ' h' : '') + (fill ? ' f' : ' S'));
      return self;
    };
    self.rect = function (x, y, w, h, fill) {
      pg.ops.push(X(x) + ' ' + Y(y + h) + ' ' + (w * K).toFixed(3) + ' ' + (h * K).toFixed(3) + ' re ' + (fill ? 'f' : 'S'));
      return self;
    };
    self.clip = function (x, y, w, h) { pg.ops.push('q ' + X(x) + ' ' + Y(y + h) + ' ' + (w * K).toFixed(3) + ' ' + (h * K).toFixed(3) + ' re W n'); return self; };
    self.unclip = function () { pg.ops.push('Q'); return self; };
    self.text = function (x, y, size, str, bold, rot) {
      var t = pdfStr(str);
      if (rot) pg.ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf 0 -1 1 0 ' + X(x) + ' ' + Y(y) + ' Tm (' + t + ') Tj ET');
      else pg.ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + X(x) + ' ' + Y(y) + ' Td (' + t + ') Tj ET');
      return self;
    };
    return self;
  };
  Pdf.prototype.bytes = function (title) {
    var objs = [];
    var n = this.pages.length;
    // 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then page/content pairs
    objs[1] = '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>';
    var kids = [];
    for (var i = 0; i < n; i++) kids.push((6 + 2 * i) + ' 0 R');
    objs[2] = '<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objs[5] = '<< /Title (' + pdfStr(title || 'Molde capa com capuz') + ') /Producer (cloak.js) >>';
    for (var j = 0; j < n; j++) {
      var pg = this.pages[j];
      var stream = '1 J 1 j\n' + pg.ops.join('\n');
      objs[6 + 2 * j] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + (pg.w * K).toFixed(3) + ' ' + (pg.h * K).toFixed(3) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (7 + 2 * j) + ' 0 R >>';
      objs[7 + 2 * j] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
    }
    var out = '%PDF-1.4\n', xref = [];
    for (var k = 1; k < objs.length; k++) {
      xref[k] = out.length;
      out += k + ' 0 obj\n' + objs[k] + '\nendobj\n';
    }
    var xs = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (var m = 1; m < objs.length; m++) out += ('0000000000' + xref[m]).slice(-10) + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xs + '\n%%EOF\n';
    return out;   // ASCII only, so string length == byte length
  };

  var PAPER = { a4: { w: 210, h: 297, name: 'A4' }, letter: { w: 215.9, h: 279.4, name: 'Carta (US Letter)' }, a0: { w: 841, h: 1189, name: 'A0' } };
  var MARGIN = 10;

  // place pieces on a canvas of given width (shelf packing), y down
  function layout(ps, width, gap) {
    var placed = [], x0 = 0, colH = 0;
    ps.filter(function (p) { return p.vertical; }).forEach(function (p) {     // long strips: own column at the left
      var b = p.bb, w = b[2] - b[0], h = b[3] - b[1] + 16;
      placed.push({ p: p, dx: x0 - b[0], dy: -b[1], x: x0, y: 0, w: w, h: h });
      x0 += w + gap; colH = Math.max(colH, h);
    });
    var x = x0, y = 0, rowH = 0;
    ps.filter(function (p) { return !p.vertical; }).forEach(function (p) {
      var b = p.bb, w = b[2] - b[0], h = b[3] - b[1] + 16;      // +16: room for the label under it
      if (x > x0 && x + w > width) { y += rowH + gap; x = x0; rowH = 0; }
      placed.push({ p: p, dx: x - b[0], dy: y - b[1], x: x, y: y, w: w, h: h });
      x += w + gap; rowH = Math.max(rowH, h);
    });
    var W = 0, H = 0;
    placed.forEach(function (q) { W = Math.max(W, q.x + q.w); H = Math.max(H, q.y + q.h); });
    return { placed: placed, w: W, h: H };
  }

  function drawPiece(pg, q, ox, oy) {      // ox, oy: page offset of the canvas origin
    var p = q.p, dx = q.dx + ox, dy = q.dy + oy;
    var mv = function (pts) { return pts.map(function (a) { return [a[0] + dx, a[1] + dy]; }); };
    pg.gray(0).width(0.5).dash(0).path(mv(p.cutLine), true);
    pg.rgb(0.16, 0.36, 0.59).width(0.25).dash(3, 2).path(mv(p.seam), true).dash(0);
    pg.rgb(0.76, 0.25, 0.05).width(0.6);
    p.notches.forEach(function (n) {
      var a = [n.p[0] + dx, n.p[1] + dy];
      pg.path([[a[0] - n.n[0] * 0.1, a[1] - n.n[1] * 0.1], [a[0] + n.n[0] * 17, a[1] + n.n[1] * 17]]);
      pg.text(a[0] + n.n[0] * 20 + 1, a[1] + n.n[1] * 20 + 1, 6, n.t);
    });
    pg.gray(0.25).width(0.35);
    var g0 = [p.grain[0][0] + dx, p.grain[0][1] + dy], g1 = [p.grain[1][0] + dx, p.grain[1][1] + dy];
    pg.path([g0, g1]);
    var arrow = function (tip, from) {
      var vx = tip[0] - from[0], vy = tip[1] - from[1], l = Math.hypot(vx, vy) || 1;
      vx /= l; vy /= l;
      pg.path([[tip[0] - vx * 6 - vy * 3, tip[1] - vy * 6 + vx * 3], tip, [tip[0] - vx * 6 + vy * 3, tip[1] - vy * 6 - vx * 3]]);
    };
    arrow(g1, g0); arrow(g0, g1);
    var lx = p.label[0] + dx, ly = p.label[1] + dy, rot = !!p.vertical;
    var lines = [[p.name, 9, true], [p.size, 8, true], [p.cut, 6.5, false], ['Margem de costura de 1,5 cm incluída (azul tracejado = linha de costura)', 6, false]];
    if (p.template) lines.push(['GABARITO: a peça continua além desta borda', 6, true]);
    if (p.note) lines.push([p.note, 6, false]);
    pg.gray(0);
    lines.forEach(function (l, i) {
      if (rot) pg.text(lx + 4 * 0 + i * 5.5, ly, l[1], l[0], l[2], true);
      else pg.text(lx, ly + i * 5.5, l[1], l[0], l[2]);
    });
    pg.text(g0[0] + 2, (g0[1] + g1[1]) / 2, 6, 'fio', false, true);
  }

  function testSquare(pg, x, y, paper) {
    var s = paper === 'letter' ? 101.6 : 100;
    pg.gray(0).width(0.4).dash(0).rect(x, y, s, s);
    pg.text(x + 4, y + 10, 9, paper === 'letter' ? 'QUADRADO DE TESTE 4 in x 4 in' : 'QUADRADO DE TESTE 10 cm x 10 cm', true);
    pg.text(x + 4, y + 17, 7, 'Imprimir em 100 % / Tamanho real.');
    pg.text(x + 4, y + 23, 7, 'Meça antes de imprimir o resto.');
    // inner 1 cm / 1 in ticks
    var step = paper === 'letter' ? 25.4 : 10;
    for (var i = 1; i * step < s - 0.1; i++) pg.path([[x + i * step, y + s], [x + i * step, y + s - 4]]);
    return s;
  }

  // home print (A4 / Letter): page 1 = map + test square, then only the pages that carry lines
  function dense(pts, step) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(l / step);
      for (var k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return out;
  }
  function tileUp(d, P, width) {
    var tw = P.w - 2 * MARGIN, th = P.h - 2 * MARGIN;
    var lay = layout(pieces(d), width, 20);
    var cols = Math.max(1, Math.ceil(lay.w / tw)), rows = Math.max(1, Math.ceil(lay.h / th));
    var pts = [];
    lay.placed.forEach(function (q) {
      dense(q.p.cutLine.concat([q.p.cutLine[0]]), 4).forEach(function (a) { pts.push([a[0] + q.dx, a[1] + q.dy]); });
      // the label block sits inside the piece: count its corners too
      var lx = q.p.label[0] + q.dx, ly = q.p.label[1] + q.dy;
      pts.push([lx, ly], [lx + 60, ly + 30]);
    });
    var tiles = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var x0 = c * tw, y0 = r * th, used = false;
      for (var i = 0; i < pts.length && !used; i++) {
        var X = pts[i][0], Y = pts[i][1];
        if (X >= x0 - 1 && X <= x0 + tw + 1 && Y >= y0 - 1 && Y <= y0 + th + 1) used = true;
      }
      if (!used) lay.placed.forEach(function (q) {
        if (q.x <= x0 && q.x + q.w >= x0 + tw && q.y <= y0 && q.y + q.h >= y0 + th) used = true;
      });
      tiles.push({ r: r, c: c, x0: x0, y0: y0, used: used, id: String.fromCharCode(65 + r) + (c + 1) });
    }
    return { lay: lay, cols: cols, rows: rows, tiles: tiles, tw: tw, th: th, n: tiles.filter(function (t) { return t.used; }).length };
  }

  // home print (A4 / Letter): page 1 = map + test square, then only the pages that carry lines
  function homePdf(d, paper, title) {
    var P = PAPER[paper], pdf = new Pdf();
    var best = null;
    [1, 2, 3, 4].forEach(function (k) {
      var t = tileUp(d, P, k * (P.w - 2 * MARGIN) - 6);
      if (!best || t.n < best.n) best = t;
    });
    var lay = best.lay, cols = best.cols, rows = best.rows, tiles = best.tiles, tw = best.tw, th = best.th;
    var printed = tiles.filter(function (t) { return t.used; });
    printed.forEach(function (t, i) { t.page = i + 2; });
    // page 1
    var p1 = pdf.page(P.w, P.h);
    p1.gray(0).text(MARGIN, 18, 14, title, true);
    p1.text(MARGIN, 25, 8.5, (d.opt.size === 'custom' ? 'Medidas próprias' : 'Tamanho ' + d.opt.size) + ' - decote ' + cmES(d.N) + ' cm - ' +
      (d.opt.full ? 'círculo completo' : 'meio círculo') + ' - capuz de ' + (d.opt.three ? '3 peças' : '2 peças') + ' - papel ' + P.name);
    testSquare(p1, MARGIN, 32, paper);
    var mapX = MARGIN + 110, mapY = 32, cell = Math.min(80 / cols, 100 / rows, 22);
    p1.text(mapX, mapY - 2, 8, 'MAPA DE PÁGINAS (cole nesta ordem)', true);
    tiles.forEach(function (t) {
      var x = mapX + t.c * cell, y = mapY + 2 + t.r * cell * th / tw;
      var h = cell * th / tw;
      p1.gray(t.used ? 0 : 0.7).width(0.3).rect(x, y, cell, h);
      p1.text(x + 1.5, y + 5, 6.5, t.id, true);
      p1.text(x + 1.5, y + 10, 6, t.used ? 'p. ' + t.page : 'vazia');
    });
    p1.gray(0);
    var yy = Math.max(32 + (paper === 'letter' ? 101.6 : 100), mapY + 2 + rows * cell * th / tw) + 10;
    var lines = [
      'Imprima as páginas 2-' + (printed.length + 1) + ' (' + printed.length + ' páginas). Os quadros vazios não estão no arquivo: nenhuma folha sai em branco.',
      'Cada página traz o nome do seu quadro (A1, A2, B1...). Corte a margem esquerda e a de cima de uma página e coloque-a',
      'sobre a linha cinza da moldura da vizinha, de modo que os triângulos se encontrem. Linhas de cima para baixo, colunas da esquerda para a direita.',
      'Corte na linha preta. Azul tracejado = linha de costura, 1,5 cm para dentro. Marcas laranja = piques (CF, ombro, CC).',
      'Conferido pelo código neste tamanho: gola do capuz ' + cmES(d.hoodNeck) + ' cm, decote da capa ' + cmES(d.cloakNeck) +
        ' cm, diferença ' + mmES(d.diff) + ' mm.',
      'Peça da capa: só a parte do decote é impressa. Marque a barra medindo ' + (d.opt.length / 10).toFixed(0) +
        ' cm a partir da costura do decote em vários pontos, una as marcas e some 2,5 cm.',
      'As peças são desenhos feitos por código a partir das medidas acima. Este molde não tem fotos de uma peça costurada.'
    ];
    lines.forEach(function (l, i) { p1.text(MARGIN, yy + i * 6, 7.5, l); });
    // tile pages
    printed.forEach(function (t) {
      var pg = pdf.page(P.w, P.h);
      var ox = MARGIN - t.x0, oy = MARGIN - t.y0;
      pg.clip(MARGIN, MARGIN, tw, th);
      lay.placed.forEach(function (q) { drawPiece(pg, q, ox, oy); });
      pg.unclip();
      pg.gray(0.55).width(0.25).dash(0).rect(MARGIN, MARGIN, tw, th);
      var tri = function (cx, cy, dir) {
        var s = 4;
        var pts = dir === 'v' ? [[cx - s, cy], [cx + s, cy], [cx, cy + s * (cy < P.h / 2 ? 1 : -1)]] : [[cx, cy - s], [cx, cy + s], [cx + s * (cx < P.w / 2 ? 1 : -1), cy]];
        pg.path(pts, true, true);
      };
      pg.gray(0.55);
      tri(P.w / 2, MARGIN, 'v'); tri(P.w / 2, MARGIN + th, 'v'); tri(MARGIN, P.h / 2, 'h'); tri(MARGIN + tw, P.h / 2, 'h');
      pg.gray(0).text(MARGIN, MARGIN - 3, 7, t.id + '  -  página ' + t.page + ' de ' + (printed.length + 1) + '  -  ' + (d.opt.size === 'custom' ? 'medidas próprias' : 'tamanho ' + d.opt.size) + '  -  imprimir em 100 %', true);
      pg.text(MARGIN, P.h - MARGIN + 6, 6, 'Junte: esquerda ' + (t.c ? String.fromCharCode(65 + t.r) + t.c : '-') + ' | direita ' + (t.c < cols - 1 ? String.fromCharCode(65 + t.r) + (t.c + 2) : '-') +
        ' | acima ' + (t.r ? String.fromCharCode(64 + t.r) + (t.c + 1) : '-') + ' | abaixo ' + (t.r < rows - 1 ? String.fromCharCode(66 + t.r) + (t.c + 1) : '-'));
    });
    return { pdf: pdf, pages: printed.length + 1, tiles: tiles.length, blank: tiles.length - printed.length, cols: cols, rows: rows };
  }

  // copy shop: one A0 sheet per draft (all pieces at 1:1); projector: one page sized to the pieces
  function sheetPage(pdf, d, wmm, hmm, label, paper) {
    var lay = layout(pieces(d), wmm - 2 * MARGIN - 10, 25);
    var W = wmm || lay.w + 2 * MARGIN, H = hmm || lay.h + 2 * MARGIN + 130;
    var pg = pdf.page(W, H);
    pg.gray(0).text(MARGIN, 14, 12, label, true);
    var top = 22;
    lay.placed.forEach(function (q) { drawPiece(pg, q, MARGIN, top + 110); });
    testSquare(pg, MARGIN, top, paper || 'a4');
    pg.text(MARGIN + 110, top + 8, 8, 'Conferência do decote: capuz ' + cmES(d.hoodNeck) + ' cm, capa ' + cmES(d.cloakNeck) + ' cm, diferença ' + mmES(d.diff) + ' mm');
    pg.text(MARGIN + 110, top + 15, 8, 'Imprimir em 100 % / tamanho real. Meça primeiro o quadrado de 10 cm.');
    return { w: W, h: H, fits: lay.w <= W - 2 * MARGIN && lay.h + top + 110 <= H };
  }
  function a0Pdf(drafts, title) {
    var pdf = new Pdf(), fit = true;
    drafts.forEach(function (d) {
      var r = sheetPage(pdf, d, PAPER.a0.w, PAPER.a0.h, title + ' - ' + (d.opt.size === 'custom' ? 'medidas próprias' : 'tamanho ' + d.opt.size) + ' - ' + (d.opt.full ? 'círculo completo' : 'meio círculo') + ', capuz de ' + (d.opt.three ? '3 peças' : '2 peças') + ' - A0 para gráfica (plotter)');
      fit = fit && r.fits;
    });
    return { pdf: pdf, pages: drafts.length, fits: fit };
  }
  function projectorPdf(drafts, title) {
    var pdf = new Pdf();
    drafts.forEach(function (d) {
      var lay = layout(pieces(d), 1100, 25);
      var w = Math.max(lay.w + 2 * MARGIN, 330), h = lay.h + 2 * MARGIN + 140;
      sheetPage(pdf, d, w, h, title + ' - ' + (d.opt.size === 'custom' ? 'medidas próprias' : 'tamanho ' + d.opt.size) + ' - ' + (d.opt.full ? 'círculo completo' : 'meio círculo') + ', capuz de ' + (d.opt.three ? '3 peças' : '2 peças') + ' - projetor');
    });
    return { pdf: pdf, pages: drafts.length };
  }

  // ---------- instructions (vector step drawings, labelled as drawings) ----------
  function guidePdf(drafts, paper, title) {
    var P = PAPER[paper], pdf = new Pdf(), d0 = drafts[0];
    var pg = pdf.page(P.w, P.h), y = 20;
    var T = function (s, sz, b) { pg.text(MARGIN + 2, y, sz || 8, s, b); y += (sz || 8) * 0.5 + 2.2; };
    T(title + ' - instruções de costura', 14, true); y += 2;
    T('Todas as imagens destas instruções são desenhos de linhas feitos por código a partir das peças. Não há fotos de uma peça costurada.', 7.5);
    y += 3; T('TABELA DE TAMANHOS (meça a circunferência na base do pescoço, onde fica um colar)', 9, true);
    var head = ['Tamanho', 'Pescoço', 'Decote capa', 'Altura capuz', 'Conferência'];
    var cx = [MARGIN + 2, MARGIN + 22, MARGIN + 50, MARGIN + 88, MARGIN + 120];
    head.forEach(function (h, i) { pg.text(cx[i], y, 7.5, h, true); }); y += 5;
    drafts.forEach(function (d) {
      var row = [d.opt.size, (d.opt.neck / 10).toFixed(0) + ' cm', (d.N / 10).toFixed(0) + ' cm', cmES(d.opt.hood) + ' cm',
        'capuz ' + cmES(d.hoodNeck) + ' = capa ' + cmES(d.cloakNeck) + ' (' + mmES(d.diff) + ' mm)'];
      row.forEach(function (c, i) { pg.text(cx[i], y, 7.5, c); }); y += 4.6;
    });
    y += 4; T('TECIDO (1,50 m de largura, encaixe simples, cada peça no seu próprio quadrado: estimativa com folga)', 9, true);
    var lh = ['Tamanho', 'Comprimento'].concat(['círculo completo', 'meio círculo', 'forro do capuz']);
    lh.forEach(function (h, i) { pg.text(cx[i], y, 7.5, h, true); }); y += 5;
    var L = LENGTHS;
    [drafts[0], drafts[Math.floor(drafts.length / 2)], drafts[drafts.length - 1]].forEach(function (d) {
      L.forEach(function (l) {
        var f = draft({ neck: d.opt.neck, hood: d.opt.hood, full: true, three: d.opt.three, length: l.cm * 10 });
        var h = draft({ neck: d.opt.neck, hood: d.opt.hood, full: false, three: d.opt.three, length: l.cm * 10 });
        var row = [d.opt.size, l.label + ' ' + l.cm + ' cm', mES(f.fabricUse.shell) + ' m' + (f.fabricUse.corner ? ' *' : ''),
          mES(h.fabricUse.shell) + ' m' + (h.fabricUse.corner ? ' *' : ''), mES(f.fabricUse.lining) + ' m'];
        row.forEach(function (c, i) { pg.text(cx[i], y, 7, c); }); y += 4.2;
      });
      y += 1.5;
    });
    T('* a peça é mais larga que o tecido: na barra entra uma emenda de canto (ver passo 3).', 6.5);
    y += 3; T('COMPRIMENTO (meça nas costas, da base do pescoço até onde a barra deve terminar)', 9, true);
    T('Sem fita métrica? Estimativa pela sua altura: quadril 0,34 x altura, joelho 0,55, meia canela 0,66, chão 0,81.', 7.5);
    T('São estimativas por proporções do corpo, não a sua medida. Meça para ter certeza.', 7.5);
    // page 2-3: steps with drawings
    var steps = [
      ['1  Imprimir e conferir', 'Imprima a página 1 em 100 % / tamanho real. O quadrado de teste deve medir 10 cm (A4). Depois imprima as páginas do mapa.'],
      ['2  Montar as páginas', 'Disponha as páginas como no mapa (A1 em cima, à esquerda). Corte uma margem, encontre os triângulos e cole com fita. Corte cada peça na linha preta.'],
      ['3  Cortar as peças da capa', 'Prenda o gabarito do decote no tecido. A partir da linha de costura do decote meça o seu comprimento em vários pontos, una as marcas e some 2,5 cm de barra. 4 peças (círculo completo) ou 2 (meio).'],
      ['4  Costurar as peças', 'Direito com direito, costure o centro das costas e (círculo completo) as duas costuras de ombro, a 1,5 cm. Abra a costura com o ferro.'],
      ['5  Costurar o capuz', '2 peças: costure as duas laterais pela costura curva de trás. 3 peças: costure a faixa entre as duas laterais, pique com pique. Faça o mesmo no forro.'],
      ['6  Forrar o capuz', 'Capuz e forro direito com direito, costure a borda do rosto. Desvire, passe e faça o pesponto. Alinhave juntas as bordas da gola.'],
      ['7  Pregar o capuz', 'CF com a borda da frente, o pique do ombro com a costura do ombro, CC com a costura do centro das costas. Costure o decote a 1,5 cm.'],
      ['8  Acabamento', 'Passe a costura do decote para o lado da capa e pesponte. Dobre duas vezes as frentes e a barra e costure. Coloque fitas ou um fecho na gola.']
    ];
    var drawStep = function (pg2, i, x, yy, w, h, d) {
      pg2.gray(0.6).width(0.25).rect(x, yy, w, h);
      pg2.gray(0.4).text(x + 2, yy + h - 2, 5.5, 'desenho de linhas, feito por código');
      var hood = d.hood, P2 = d.panel, sc;
      pg2.gray(0).width(0.4);
      if (i === 0) {
        sc = Math.min(w, h) * 0.45 / 100;
        pg2.rect(x + w / 2 - 50 * sc, yy + h / 2 - 50 * sc, 100 * sc, 100 * sc);
        pg2.path([[x + w / 2 - 50 * sc, yy + h / 2 + 58 * sc], [x + w / 2 + 50 * sc, yy + h / 2 + 58 * sc]]);
        pg2.text(x + w / 2 - 10, yy + h / 2 + 66 * sc, 7, '10 cm', true);
      } else if (i === 1) {
        for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) pg2.rect(x + 8 + c * (w - 16) / 3, yy + 8 + r * (h - 20) / 2, (w - 16) / 3 - 2, (h - 20) / 2 - 2);
        pg2.text(x + 10, yy + 14, 6, 'A1', true); pg2.text(x + 10 + (w - 16) / 3, yy + 14, 6, 'A2', true);
      } else if (i === 2 || i === 3) {
        var R = P2.R, rr = P2.r;
        sc = Math.min(w * 0.42, h * 0.8) / R;
        var cxx = x + w / 2, cyy = yy + 6;
        var n = i === 2 ? 1 : (d.opt.full ? 4 : 2);
        for (var k = 0; k < n; k++) {
          var a = n === 1 ? PI / 4 : (k * PI / n), b = n === 1 ? 3 * PI / 4 : ((k + 1) * PI / n);
          var outer = arc(cxx, cyy, R * sc, a, b, 30), inner = arc(cxx, cyy, rr * sc, b, a, 15);
          pg2.path(join(outer, inner), true);
        }
        if (i === 2) {
          pg2.dash(1.5, 1.5);
          [0.3, 0.5, 0.7].forEach(function (t) { var an = PI / 4 + t * PI / 2; pg2.path([[cxx + rr * sc * Math.cos(an), cyy + rr * sc * Math.sin(an)], [cxx + R * sc * Math.cos(an), cyy + R * sc * Math.sin(an)]]); });
          pg2.dash(0); pg2.text(cxx - 12, cyy + R * sc * 0.6, 6, 'seu comprimento');
        }
      } else {
        var mir = function (pts, dx) { return pts.map(function (p) { return [dx - p[0], p[1]]; }); };
        var shift = function (pts, dx, dy) { return pts.map(function (p) { return [p[0] + dx, p[1] + dy]; }); };
        var polys = [], dashed = [];
        if (i === 4) { polys = [hood.seam, mir(hood.seam, 2 * hood.w * 1.32)]; }
        else if (i === 5) { polys = [hood.seam]; dashed = [shift(hood.seam, 18, -18)]; }
        else if (i === 6) {
          var cl = join(arc(0, 0, P2.r * 3.2, 0.2 * PI, 0.8 * PI, 40), arc(0, 0, P2.r, 0.8 * PI, 0.2 * PI, 12));
          polys = [cl, shift(hood.seam, -hood.w / 2, P2.r * 0.9)];
        } else {
          polys = [join(arc(0, 0, P2.R, 0.15 * PI, 0.85 * PI, 40), arc(0, 0, P2.r, 0.85 * PI, 0.15 * PI, 12))];
        }
        var bb = bbox(polys.concat(dashed));
        var k2 = Math.min((w - 10) / (bb[2] - bb[0]), (h - 14) / (bb[3] - bb[1]));
        var tx = function (pts) { return pts.map(function (p) { return [x + 5 + (p[0] - bb[0]) * k2, yy + 4 + (p[1] - bb[1]) * k2]; }); };
        polys.forEach(function (pl) { pg2.path(tx(pl), true); });
        pg2.dash(1.5, 1); dashed.forEach(function (pl) { pg2.path(tx(pl), true); }); pg2.dash(0);
      }
    };
    for (var s = 0; s < steps.length; s++) {
      if (s % 4 === 0) { pg = pdf.page(P.w, P.h); y = 18; pg.gray(0).text(MARGIN, 14, 11, title + ' - passos ' + (s + 1) + ' a ' + (s + 4), true); }
      var yy = 22 + (s % 4) * 64;
      drawStep(pg, s, MARGIN, yy, 70, 58, d0);
      pg.gray(0).text(MARGIN + 76, yy + 6, 9, steps[s][0], true);
      wrap(steps[s][1], 78).forEach(function (ln, k) { pg.text(MARGIN + 76, yy + 13 + k * 4.6, 7.5, ln); });
    }
    return { pdf: pdf, pages: pdf.pages.length };
  }
  function wrap(t, n) {
    var out = [], cur = '';
    t.split(' ').forEach(function (w) { if ((cur + ' ' + w).trim().length > n) { out.push(cur.trim()); cur = w; } else cur += ' ' + w; });
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function cmES(mm) { return (mm / 10).toFixed(1).replace('.', ','); }
  function mmES(mm) { return Math.abs(mm).toFixed(1).replace('.', ','); }
  function mES(mm) { return (mm / 1000).toFixed(1).replace('.', ','); }
  var api = {
    SA: SA, HEM: HEM, EASE: EASE, TOL: TOL, STRIP: STRIP, SIZES: SIZES, LENGTHS: LENGTHS, FROM_HEIGHT: FROM_HEIGHT, PAPER: PAPER,
    draft: draft, pieces: pieces, svg: svg, homePdf: homePdf, a0Pdf: a0Pdf, projectorPdf: projectorPdf, guidePdf: guidePdf,
    len: len, sizeById: sizeById, cmES: cmES, mmES: mmES, mES: mES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cloak = api;
})(typeof window !== 'undefined' ? window : this);
