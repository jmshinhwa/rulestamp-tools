/* pouch.js - patrón de neceser con cremallera trazado por código (sin modelo de imagen). Edición en español.
   One engine for the web page (window.Pouch) and the PDF builder (node require).
   Units: millimetres. y grows downward (like SVG). Panel top edge = zipper edge. */
(function (root) {
  'use strict';
  var SA = 10;              // seam allowance on every panel edge, mm (1 cm, about 3/8 in)
  var QUILT = 25;           // quilted layers: cut this much bigger on every side, quilt, then trim
  var ZIP_CLOSED = 20;      // closed zipper: at least the panel cut width + this
  var ZIP_REEL = 60;        // zipper from a continuous reel: cut the panel cut width + this (room for the slider)
  var STRAIGHTEN = 50;      // added to every fabric length: straighten the cut edge
  var FQ = { w: 457.2, h: 558.8 };   // fat quarter 18 x 22 in
  var TAB = { w: 40, h: 80 };        // loop tab, cut size (folded in quarters, no seam allowance)
  var ZIPS = [150, 180, 200, 230, 250, 300, 350, 400, 450, 500, 550, 600];   // closed zipper lengths sold (6 to 24 in)
  var ZIPS_IN = { 150: '15 cm', 180: '18 cm', 200: '20 cm', 230: '23 cm', 250: '25 cm', 300: '30 cm', 350: '35 cm', 400: '40 cm', 450: '45 cm', 500: '50 cm', 550: '55 cm', 600: '60 cm' };
  var ZIPS_INCH = { 150: '6 pulg.', 180: '7 pulg.', 200: '8 pulg.', 230: '9 pulg.', 250: '10 pulg.', 300: '12 pulg.', 350: '14 pulg.', 400: '16 pulg.', 450: '18 pulg.', 500: '20 pulg.', 550: '22 pulg.', 600: '24 pulg.' };

  // finished sizes (boxed): W = base width, H = front height, D = depth (box)
  var SIZES = [
    { id: 'S', label: 'Pequeño', use: 'monedas, auriculares, cables', W: 120, H: 80, D: 40 },
    { id: 'M', label: 'Mediano', use: 'lápices, maquillaje', W: 200, H: 120, D: 60 },
    { id: 'L', label: 'Grande', use: 'aseo, cosméticos', W: 250, H: 150, D: 80 },
    { id: 'XL', label: 'Extragrande', use: 'viaje, labores de punto', W: 300, H: 180, D: 100 }
  ];
  function sizeById(id) {
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === id) return SIZES[i];
    return null;
  }
  function inch(mm) {                     // nearest 1/8 in, written the way sewists write it
    var e = Math.round(mm / 25.4 * 8), w = Math.floor(e / 8), f = e % 8;
    var fr = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'][f];
    return (w ? w + (fr ? ' ' + fr : '') : (fr || '0')) + ' pulg.';
  }
  function dec(v, d) { return v.toFixed(d).replace('.', ','); }
  function cm(mm, d) { return dec(mm / 10, d == null ? 1 : d) + ' cm'; }
  function both(mm) { return cm(mm) + ' (' + inch(mm) + ')'; }
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

  // ---------- the draft ----------
  // opt: {size} or {W,H,D}; style 'boxed' | 'flat'; layer 'none' | 'quilted' | 'fleece'; lining (bool); tab (bool)
  function draft(opt) {
    opt = opt || {};
    var s = opt.size ? sizeById(opt.size) : null;
    var W = s ? s.W : +opt.W, H = s ? s.H : +opt.H, D = s ? s.D : +opt.D;
    var boxed = opt.style !== 'flat';
    if (!boxed) D = opt.size ? s.D : (+opt.D || 0);
    var o = { size: s ? s.id : 'custom', W: W, H: H, D: D, style: boxed ? 'boxed' : 'flat', layer: opt.layer || 'none', lining: opt.lining !== false, tab: !!opt.tab };
    // seam-line panel: half the box depth on each end and under the front
    var c = boxed ? D / 2 : 0;
    var Ws = boxed ? W + D : W, Hs = boxed ? H + D / 2 : H;
    var seam;
    if (boxed) seam = [[0, 0], [Ws, 0], [Ws, Hs - c], [Ws - c, Hs - c], [Ws - c, Hs], [c, Hs], [c, Hs - c], [0, Hs - c]];
    else seam = [[0, 0], [Ws, 0], [Ws, Hs], [0, Hs]];
    var cut = offset(seam, SA);
    var cb = bbox([cut]);
    var cw = cb[2] - cb[0], ch = cb[3] - cb[1];
    // corner cut-out measured on the cut piece (raw edge to raw notch edge)
    var corner = 0;
    if (boxed) {
      var xs = cut.map(function (p) { return p[0]; }).filter(function (x) { return x < cb[2] - 0.01 && x > Ws / 2; });
      corner = cb[2] - Math.max.apply(null, xs);
    }
    var gap = Math.round(Math.min(100, 0.45 * (Ws - 2 * c)) / 5) * 5;   // turning gap in the lining bottom seam
    var zipMin = cw + ZIP_CLOSED, zip = null;
    for (var i = 0; i < ZIPS.length; i++) if (ZIPS[i] >= zipMin) { zip = ZIPS[i]; break; }
    var d = {
      opt: o, c: c, Ws: Ws, Hs: Hs, seam: seam, cut: cut, cw: cw, ch: ch, corner: corner, gap: gap,
      zipMin: zipMin, zip: zip, zipReel: cw + ZIP_REEL, block: [cw + 2 * QUILT, ch + 2 * QUILT],
      fleece: [Ws, Hs], tabCut: [TAB.w, TAB.h]
    };
    // finished size measured back from the drawn seam polygon (not from the inputs)
    var sb = bbox([seam]);
    var notchW = boxed ? (sb[2] - Math.max.apply(null, seam.filter(function (p) { return p[1] > Hs - 0.01; }).map(function (p) { return p[0]; }))) : 0;
    d.finished = {
      W: (sb[2] - sb[0]) - 2 * notchW,                  // base width between the box seams
      D: 2 * notchW,                                    // box seam length = 2 x notch
      H: (sb[3] - sb[1]) - notchW,                      // front height above the base
      flatW: sb[2] - sb[0], flatH: sb[3] - sb[1]
    };
    d.saMeasured = Math.min(sb[0] - cb[0], cb[2] - sb[2], sb[1] - cb[1], cb[3] - sb[3]);
    d.checks = [
      { label: 'Margen de costura, de la línea de corte a la de costura', want: SA, got: d.saMeasured },
      { label: 'Cuadrado de esquina en la pieza cortada = la mitad del fondo', want: c, got: corner },
      { label: 'Ancho acabado de la base', want: boxed ? W : Ws, got: boxed ? d.finished.W : d.finished.flatW },
      { label: boxed ? 'Fondo acabado (costura de la esquina)' : 'Alto acabado', want: boxed ? D : Hs, got: boxed ? d.finished.D : d.finished.flatH }
    ];
    if (boxed) d.checks.push({ label: 'Alto acabado del frente', want: H, got: d.finished.H });
    d.ok = d.checks.every(function (k) { return Math.abs(k.want - k.got) < 0.05; });
    d.valid = W >= 60 && W <= 500 && H >= 40 && H <= 400 && (!boxed || (D >= 20 && D <= 200 && D <= W)) && !!zip;
    return d;
  }

  // ---------- cutting chart ----------
  function chart(d) {
    var o = d.opt, rows = [];
    var sz = function (a, b) { return dec(a / 10, 1) + ' × ' + cm(b) + '  (' + inch(a).replace(' pulg.', '') + ' × ' + inch(b) + ')'; };
    var cornerTxt = o.style === 'boxed' ? 'recorta un cuadrado de ' + cm(d.corner) + ' (' + inch(d.corner) + ') en las dos esquinas de abajo' : 'esquinas rectas, sin recorte';
    if (o.layer === 'quilted') {
      rows.push({ k: 'ext', piece: 'Tela exterior', n: 2, size: sz(d.block[0], d.block[1]), note: 'bloque cortado ' + cm(QUILT) + ' más grande por cada lado: acólchalo con la guata y después recórtalo a la pieza de ' + sz(d.cw, d.ch) + '; ' + cornerTxt });
      rows.push({ k: 'bat', piece: 'Guata', n: 2, size: sz(d.block[0], d.block[1]), note: 'el mismo bloque que la tela exterior: se acolchan juntas y se recortan juntas' });
    } else {
      rows.push({ k: 'ext', piece: 'Tela exterior', n: 2, size: sz(d.cw, d.ch), note: cornerTxt });
    }
    if (o.layer === 'fleece') rows.push({ k: 'fle', piece: 'Guata termoadhesiva', n: 2, size: sz(d.fleece[0], d.fleece[1]), note: 'a la medida de la línea de costura, sin margen, para que no abulte en las costuras' + (o.style === 'boxed' ? '; esquinas de ' + cm(d.c) : '') + '; plánchala por el revés de la tela exterior' });
    if (o.lining) rows.push({ k: 'lin', piece: 'Tela de forro', n: 2, size: sz(d.cw, d.ch), note: cornerTxt + '; deja ' + cm(d.gap, 0) + ' (' + inch(d.gap) + ') sin coser en la costura de abajo para dar la vuelta' });
    if (o.tab) rows.push({ k: 'tab', piece: 'Presilla', n: 1, size: sz(d.tabCut[0], d.tabCut[1]), note: 'plancha doblada en cuatro a lo largo, pespunta y dóblala por la mitad; no lleva margen' });
    rows.push({ k: 'zip', piece: 'Cremallera', n: 1, size: 'cerrada de ' + cm(d.zip, 0) + ' (' + ZIPS_INCH[d.zip] + ')', note: 'mínimo ' + cm(d.zipMin) + ' para que los dos topes queden fuera de las costuras laterales; de cremallera por metros, corta ' + cm(d.zipReel) + ' (' + inch(d.zipReel) + ') y pon 1 cursor' });
    return rows;
  }

  // ---------- fabric to buy (shelf layout of whole pieces across the fabric width) ----------
  function along(pw, ph, n, width) {
    var best = null;
    [[pw, ph], [ph, pw]].forEach(function (r) {
      var per = Math.floor(width / r[0]);
      if (per < 1) return;
      var L = Math.ceil(n / per) * r[1];
      if (!best || L < best.L) best = { L: L, per: per, rot: r[0] !== pw };
    });
    return best;
  }
  function fabric(d, n, width) {
    n = Math.max(1, Math.round(n || 1)); width = width || 1100;
    var o = d.opt, out = [];
    var add = function (k, label, pw, ph, cnt) {
      var a = along(pw, ph, cnt, width);
      if (!a) { out.push({ k: k, label: label, fits: false }); return; }
      var L = a.L + STRAIGHTEN;
      var m = Math.ceil(L / 100) / 10;                                       // next 10 cm
      var yd = Math.ceil(L / 914.4 * 8) / 8;                                 // next 1/8 yd
      var fq = Math.max(along(pw, ph, 1, FQ.w) ? Math.floor(FQ.w / pw) * Math.floor(FQ.h / ph) : 0, Math.floor(FQ.w / ph) * Math.floor(FQ.h / pw));
      out.push({ k: k, label: label, fits: true, pieces: cnt, per_row: a.per, length_mm: L, m: m, yd: yd, fq_pieces: fq });
    };
    var ext = o.layer === 'quilted' ? d.block : [d.cw, d.ch];
    add('ext', 'Tela exterior', ext[0], ext[1], 2 * n + (o.tab ? 0 : 0));
    if (o.layer === 'quilted') add('bat', 'Guata', d.block[0], d.block[1], 2 * n);
    if (o.layer === 'fleece') add('fle', 'Guata termoadhesiva', d.fleece[0], d.fleece[1], 2 * n);
    if (o.lining) add('lin', 'Forro', d.cw, d.ch, 2 * n);
    return { n: n, width: width, rows: out, zips: n, zip: d.zip, reel_mm: n * d.zipReel };
  }
  // money: what the fabric you buy costs, split per pouch (prices are the user's own)
  function cost(f, prices) {
    prices = prices || {};
    var t = 0, parts = [];
    f.rows.forEach(function (r) {
      var p = +prices[r.k] || 0;
      if (!r.fits || !p) return;
      var v = Math.round(r.m * p * 100) / 100;
      parts.push({ k: r.k, label: r.label, m: r.m, price: p, total: v }); t += v;
    });
    var z = +prices.zip || 0;
    if (z) { var zv = Math.round(f.zips * z * 100) / 100; parts.push({ k: 'zip', label: 'Cremalleras', n: f.zips, price: z, total: zv }); t += zv; }
    t = Math.round(t * 100) / 100;
    return { parts: parts, total: t, per: Math.round(t / f.n * 100) / 100 };
  }

  // ---------- pieces for drawing ----------
  function pieces(d) {
    var o = d.opt, out = [];
    var sz = o.size === 'custom' ? 'medidas propias ' + dec(o.W / 10, 0) + ' × ' + dec(o.H / 10, 0) + (o.style === 'boxed' ? ' × ' + dec(o.D / 10, 0) : '') + ' cm' : 'talla ' + o.size;
    var Ws = d.Ws, Hs = d.Hs, c = d.c;
    var notches = [{ p: [Ws / 2, 0], n: [0, -1], t: 'centre' }, { p: [Ws / 2, Hs], n: [0, 1], t: 'centre' }];
    var gx = (Ws - d.gap) / 2;
    out.push({
      key: 'panel', name: 'PIEZA PRINCIPAL (' + (o.style === 'boxed' ? 'con fondo' : 'plana') + ')',
      cut: 'Cortar 2 en tela exterior' + (o.lining ? ' + 2 en forro' : '') + (o.layer === 'fleece' ? ' + 2 en guata termoadhesiva por la línea de costura' : '') + '. Simétrica: no hay que cortar en espejo.',
      size: sz, seam: d.seam, cutLine: d.cut, notches: notches,
      gapMarks: o.lining ? [[gx, Hs], [gx + d.gap, Hs]] : null,
      top: 'LADO DE LA CREMALLERA',
      grain: [[Ws * 0.82, Hs * 0.2], [Ws * 0.82, Hs * 0.2 + Math.min(Hs * 0.55, 120)]],
      label: [c + 8, 14], corner: c + SA, bb: bbox([d.cut])
    });
    if (o.tab) {
      var t = [[0, 0], [TAB.w, 0], [TAB.w, TAB.h], [0, TAB.h]];
      out.push({ key: 'tab', name: 'PRESILLA', cut: 'Cortar 1', size: sz, seam: t, cutLine: t, notches: [], grain: [[TAB.w / 2, 12], [TAB.w / 2, TAB.h - 12]], label: [3, 10], bb: bbox([t]), small: true });
    }
    return out;
  }

  // ---------- SVG (screen preview) ----------
  function svg(d) {
    var ps = pieces(d), gap = 30, x = 0, items = [];
    ps.forEach(function (p) {
      var b = p.bb, w = b[2] - b[0], h = b[3] - b[1];
      items.push({ p: p, dx: x - b[0], dy: -b[1] + 18, w: w, h: h });
      x += w + gap;
    });
    var W = x - gap, H = Math.max.apply(null, items.map(function (i) { return i.h; })) + 18;
    var f = function (pts, dx, dy) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + (p[0] + dx).toFixed(1) + ' ' + (p[1] + dy).toFixed(1); }).join('') + 'Z'; };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -4 ' + (W + 24).toFixed(0) + ' ' + (H + 40).toFixed(0) + '" role="img" aria-label="Piezas del patrón de neceser con cremallera, dibujadas por código">';
    items.forEach(function (it) {
      var p = it.p;
      s += '<path d="' + f(p.cutLine, it.dx, it.dy) + '" fill="#fff" stroke="#1e2538" stroke-width="1.6"/>';
      if (p.key === 'panel') s += '<path d="' + f(p.seam, it.dx, it.dy) + '" fill="none" stroke="#285c96" stroke-width="0.9" stroke-dasharray="5 4"/>';
      p.notches.forEach(function (n) {
        var a = [n.p[0] + it.dx, n.p[1] + it.dy];
        s += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + (a[0] + n.n[0] * 12).toFixed(1) + '" y2="' + (a[1] + n.n[1] * 12).toFixed(1) + '" stroke="#c2410c" stroke-width="2"/>';
      });
      if (p.gapMarks) p.gapMarks.forEach(function (g) { s += '<circle cx="' + (g[0] + it.dx).toFixed(1) + '" cy="' + (g[1] + it.dy).toFixed(1) + '" r="3.5" fill="#c2410c"/>'; });
      if (p.top) s += '<text x="' + (it.dx + d.Ws / 2) + '" y="' + (it.dy - 14) + '" font-size="11" text-anchor="middle" fill="#58627a" font-family="sans-serif">' + p.top + '</text>';
      s += '<text x="' + (it.dx + p.bb[0] + (p.small ? 0 : 4)) + '" y="' + (it.dy + p.bb[3] + 22) + '" font-size="' + (p.small ? 9 : 13) + '" fill="#1e2538" font-family="sans-serif">' + esc(p.small ? 'PRESILLA' : p.name) + '</text>';
    });
    if (d.opt.style === 'boxed') s += '<text x="' + (items[0].dx + 2) + '" y="' + (items[0].dy + d.Hs + 2) + '" font-size="10" fill="#c2410c" font-family="sans-serif">' + cm(d.corner) + '</text>';
    return s + '</svg>';
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---------- PDF writer (vector, Helvetica, no library) ----------
  // WinAnsiEncoding: Latin-1 letters (á é í ó ú ñ ü ¿ ¡ × º) as octal escapes, so the file stays ASCII
  var WA = { 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2026: 0x85, 0x20ac: 0x80 };
  function pdfStr(str) {
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
    objs[5] = '<< /Title (' + pdfStr(title || 'Patrón neceser con cremallera') + ') /Producer (pouch.js) >>';
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
    return out;   // ASCII only (Latin-1 letters are octal escapes), so string length == byte length
  };

  var PAPER = { a4: { w: 210, h: 297, name: 'A4' }, letter: { w: 215.9, h: 279.4, name: 'Carta (US Letter)' }, a0: { w: 841, h: 1189, name: 'A0' } };
  var MARGIN = 8;

  function rotPiece(p) {                  // 90 degrees: (x, y) -> (-y, x)
    var r = function (pts) { return pts.map(function (a) { return [-a[1], a[0]]; }); };
    var q = {};
    for (var k in p) q[k] = p[k];
    q.seam = r(p.seam); q.cutLine = r(p.cutLine);
    q.notches = p.notches.map(function (n) { return { p: [-n.p[1], n.p[0]], n: [-n.n[1], n.n[0]], t: n.t }; });
    q.gapMarks = p.gapMarks ? r(p.gapMarks) : null;
    q.grain = r(p.grain);
    q.bb = bbox([q.cutLine]);
    q.label = [q.bb[0] + (p.corner || 0) + 22, q.bb[1] + 24];
    q.rotated = true;
    return q;
  }
  function layout(ps, width, gap) {
    var placed = [], x = 0, y = 0, rowH = 0;
    ps.forEach(function (p) {
      var b = p.bb, w = b[2] - b[0], h = b[3] - b[1];
      if (x > 0 && x + w > width) { y += rowH + gap; x = 0; rowH = 0; }
      placed.push({ p: p, dx: x - b[0], dy: y - b[1], x: x, y: y, w: w, h: h });
      x += w + gap; rowH = Math.max(rowH, h);
    });
    var W = 0, H = 0;
    placed.forEach(function (q) { W = Math.max(W, q.x + q.w); H = Math.max(H, q.y + q.h); });
    return { placed: placed, w: W, h: H };
  }
  function drawPiece(pg, q, ox, oy, d) {
    var p = q.p, dx = q.dx + ox, dy = q.dy + oy;
    var mv = function (pts) { return pts.map(function (a) { return [a[0] + dx, a[1] + dy]; }); };
    pg.gray(0).width(0.5).dash(0).path(mv(p.cutLine), true);
    if (p.key === 'panel') pg.rgb(0.16, 0.36, 0.59).width(0.25).dash(3, 2).path(mv(p.seam), true).dash(0);
    pg.rgb(0.76, 0.25, 0.05).width(0.6);
    p.notches.forEach(function (n) {
      var a = [n.p[0] + dx, n.p[1] + dy];
      pg.path([[a[0] - n.n[0] * 0.1, a[1] - n.n[1] * 0.1], [a[0] - n.n[0] * 10, a[1] - n.n[1] * 10]]);
    });
    if (p.gapMarks) p.gapMarks.forEach(function (g) {
      var a = [g[0] + dx, g[1] + dy];
      pg.path([[a[0] - 2.5, a[1] - 2.5], [a[0] + 2.5, a[1] + 2.5]]); pg.path([[a[0] - 2.5, a[1] + 2.5], [a[0] + 2.5, a[1] - 2.5]]);
    });
    pg.gray(0.25).width(0.35);
    var g0 = [p.grain[0][0] + dx, p.grain[0][1] + dy], g1 = [p.grain[1][0] + dx, p.grain[1][1] + dy];
    pg.path([g0, g1]);
    var arrow = function (tip, from) {
      var vx = tip[0] - from[0], vy = tip[1] - from[1], l = Math.hypot(vx, vy) || 1;
      vx /= l; vy /= l;
      pg.path([[tip[0] - vx * 5 - vy * 2.5, tip[1] - vy * 5 + vx * 2.5], tip, [tip[0] - vx * 5 + vy * 2.5, tip[1] - vy * 5 - vx * 2.5]]);
    };
    arrow(g1, g0); arrow(g0, g1);
    var lx = p.label[0] + dx, ly = p.label[1] + dy;
    pg.gray(0);
    if (p.key === 'tab') { pg.text(lx, ly, 6, 'PRESILLA', true); pg.text(lx, ly + 4.5, 5.5, 'cortar 1'); pg.text(lx, ly + 9, 5.5, 'sin margen'); return; }
    var o = d.opt;
    var lines = [[p.name, 9, true], [p.size + (o.style === 'boxed' ? ' - acabado ' + dec(o.W / 10, 0) + ' × ' + dec(o.H / 10, 0) + ' × ' + cm(o.D, 0) : ' - acabado ' + dec(d.Ws / 10, 0) + ' × ' + cm(d.Hs, 0)), 7, true],
      [p.cut, 6.2, false], ['Margen de costura de 1 cm incluido. Trazo azul discontinuo = línea de costura.', 6, false]];
    if (o.style === 'boxed') lines.push(['Cuadrados de esquina de ' + cm(d.corner) + ' (' + inch(d.corner) + '), medidos de borde a borde.', 6, false]);
    if (o.lining) lines.push(['Forro: deja sin coser el hueco entre las dos X (' + cm(d.gap, 0) + ').', 6, false]);
    lines.push([p.rotated ? 'Lado de la cremallera = el borde largo de la derecha (las marcas de arriba y abajo = centro).' : 'Borde de arriba = lado de la cremallera. Marcas naranjas = centro.', 6, false]);
    var maxw = (p.bb[2] - p.label[0]) - 14;
    var yy = 0;
    lines.forEach(function (l) {
      wrap(l[0], Math.max(20, Math.floor(maxw / (l[1] * 0.19)))).forEach(function (t) { pg.text(lx, ly + yy, l[1], t, l[2]); yy += l[1] * 0.5 + 1.6; });
    });
  }
  function testSquare(pg, x, y, paper) {
    var s = paper === 'letter' ? 101.6 : 100;
    pg.gray(0).width(0.4).dash(0).rect(x, y, s, s);
    pg.text(x + 4, y + 10, 9, paper === 'letter' ? 'CUADRADO DE PRUEBA 4 × 4 pulg.' : 'CUADRADO DE PRUEBA 10 × 10 cm', true);
    pg.text(x + 4, y + 17, 7, 'Imprime al 100 % / Tamaño real.');
    pg.text(x + 4, y + 23, 7, 'Mídelo antes de imprimir lo demás.');
    var step = paper === 'letter' ? 25.4 : 10;
    for (var i = 1; i * step < s - 0.1; i++) pg.path([[x + i * step, y + s], [x + i * step, y + s - 4]]);
    return s;
  }
  function dense(pts, step) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(l / step);
      for (var k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return out;
  }
  function tileUp(ps, P, width) {
    var tw = P.w - 2 * MARGIN, th = P.h - 2 * MARGIN;
    var lay = layout(ps, width, 12);
    var cols = Math.max(1, Math.ceil(lay.w / tw)), rows = Math.max(1, Math.ceil(lay.h / th));
    var pts = [];
    lay.placed.forEach(function (q) {
      dense(q.p.cutLine.concat([q.p.cutLine[0]]), 3).forEach(function (a) { pts.push([a[0] + q.dx, a[1] + q.dy]); });
    });
    var tiles = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var x0 = c * tw, y0 = r * th, used = false;
      for (var i = 0; i < pts.length && !used; i++) if (pts[i][0] >= x0 - 1 && pts[i][0] <= x0 + tw + 1 && pts[i][1] >= y0 - 1 && pts[i][1] <= y0 + th + 1) used = true;
      if (!used) lay.placed.forEach(function (q) { if (q.x <= x0 && q.x + q.w >= x0 + tw && q.y <= y0 && q.y + q.h >= y0 + th) used = true; });
      tiles.push({ r: r, c: c, x0: x0, y0: y0, used: used, id: String.fromCharCode(65 + r) + (c + 1) });
    }
    return { lay: lay, cols: cols, rows: rows, tiles: tiles, tw: tw, th: th, n: tiles.filter(function (t) { return t.used; }).length };
  }
  function bestTiles(d, P) {
    var base = pieces(d).filter(function (p) { return p.key !== 'tab'; }), best = null;
    [false, true].forEach(function (rot) {
      var ps = base.map(function (p) { return rot && p.key === 'panel' ? rotPiece(p) : p; });
      [1, 2, 3].forEach(function (k) {
        var t = tileUp(ps, P, k * (P.w - 2 * MARGIN) - 4);
        if (!best || t.n < best.n || (t.n === best.n && t.rows * t.cols < best.rows * best.cols)) best = t;
      });
    });
    return best;
  }
  function sizeLine(d) {
    var o = d.opt;
    return (o.size === 'custom' ? 'Medidas propias' : 'Talla ' + o.size) + ' - ' + (o.style === 'boxed' ? 'con fondo, acabado ' + cm(o.W, 0) + ' de ancho × ' + cm(o.H, 0) + ' de alto × ' + cm(o.D, 0) + ' de fondo' :
      'plano, acabado ' + dec(d.Ws / 10, 0) + ' × ' + cm(d.Hs, 0));
  }
  function chartBlock(pg, d, x, y, wchars) {
    var rows = chart(d);
    pg.gray(0).text(x, y, 8.5, 'TABLA DE CORTE (mide y corta, o usa la pieza impresa)', true); y += 5.5;
    rows.forEach(function (r) {
      pg.text(x, y, 7, r.n + ' ×  ' + r.piece + ':  ' + r.size, true); y += 4.2;
      wrap(r.note, wchars).forEach(function (t) { pg.text(x + 4, y, 6.3, t); y += 3.8; });
      y += 0.8;
    });
    return y;
  }
  function homePdf(d, paper, title) {
    var P = PAPER[paper], pdf = new Pdf();
    var best = bestTiles(d, P);
    var lay = best.lay, cols = best.cols, rows = best.rows, tiles = best.tiles, tw = best.tw, th = best.th;
    var printed = tiles.filter(function (t) { return t.used; });
    printed.forEach(function (t, i) { t.page = i + 2; });
    var p1 = pdf.page(P.w, P.h);
    p1.gray(0).text(MARGIN, 16, 14, title, true);
    p1.text(MARGIN, 23, 8, sizeLine(d) + ' - papel ' + P.name);
    testSquare(p1, MARGIN, 30, paper);
    var mapX = MARGIN + 112, mapY = 34, cell = Math.min(70 / cols, 60 / rows, 24);
    p1.text(mapX, mapY - 2, 8, 'MAPA DE PÁGINAS', true);
    tiles.forEach(function (t) {
      var x = mapX + t.c * cell, y = mapY + 2 + t.r * cell * th / tw, h = cell * th / tw;
      p1.gray(t.used ? 0 : 0.7).width(0.3).rect(x, y, cell, h);
      p1.text(x + 1.5, y + 5, 6.5, t.id, true);
      p1.text(x + 1.5, y + 10, 6, t.used ? 'pág. ' + t.page : 'vacía');
    });
    p1.gray(0);
    var yy = Math.max(30 + 102, mapY + 2 + rows * cell * th / tw) + 9;
    var info = [
      (printed.length === 1 ? 'Imprime la página 2 (1 página)' : 'Imprime las páginas 2 a ' + (printed.length + 1) + ' (' + printed.length + ' páginas)') + (best.tiles.length > printed.length ? '; las casillas vacías no van en el archivo.' : '.'),
      printed.length > 1 ? 'Recorta el margen de una página y ponla sobre el marco gris de la de al lado, hasta que coincidan los triángulos.' : 'La pieza entera cabe en una página: corta por la línea negra.',
      'Comprobado por código para esta talla: margen de costura de ' + dec(d.saMeasured, 1) + ' mm en todos los bordes' + (d.opt.style === 'boxed' ? ', cuadrado de esquina de ' + cm(d.corner) + ' = la mitad de los ' + cm(d.opt.D, 0) + ' de fondo.' : '.'),
      'Las piezas son dibujos hechos por código a partir de las medidas. Este patrón no trae fotos de un neceser cosido.'
    ];
    info.forEach(function (l) { wrap(l, 105).forEach(function (t) { p1.text(MARGIN, yy, 7.2, t); yy += 4.4; }); });
    yy += 3;
    chartBlock(p1, d, MARGIN, yy, 110);
    printed.forEach(function (t) {
      var pg = pdf.page(P.w, P.h);
      var ox = MARGIN - t.x0, oy = MARGIN - t.y0;
      pg.clip(MARGIN, MARGIN, tw, th);
      lay.placed.forEach(function (q) { drawPiece(pg, q, ox, oy, d); });
      pg.unclip();
      pg.gray(0.55).width(0.25).dash(0).rect(MARGIN, MARGIN, tw, th);
      if (printed.length > 1) {
        var tri = function (cx, cy, dir) {
          var s = 3.5;
          var pts = dir === 'v' ? [[cx - s, cy], [cx + s, cy], [cx, cy + s * (cy < P.h / 2 ? 1 : -1)]] : [[cx, cy - s], [cx, cy + s], [cx + s * (cx < P.w / 2 ? 1 : -1), cy]];
          pg.path(pts, true, true);
        };
        tri(P.w / 2, MARGIN, 'v'); tri(P.w / 2, MARGIN + th, 'v'); tri(MARGIN, P.h / 2, 'h'); tri(MARGIN + tw, P.h / 2, 'h');
      }
      pg.gray(0).text(MARGIN, MARGIN - 2.5, 6.5, t.id + '  -  página ' + t.page + ' de ' + (printed.length + 1) + '  -  ' + (d.opt.size === 'custom' ? 'medidas propias' : 'talla ' + d.opt.size) + ' ' + (d.opt.style === 'boxed' ? 'con fondo' : 'plano') + '  -  imprime al 100 %', true);
    });
    return { pdf: pdf, pages: printed.length + 1, tiles: tiles.length, blank: tiles.length - printed.length, cols: cols, rows: rows };
  }
  function sheet(pdf, drafts, wmm, hmm, label, paper) {
    var all = [];
    drafts.forEach(function (d) { pieces(d).forEach(function (p) { all.push({ p: p, d: d }); }); });
    all.sort(function (a, b) { return (b.p.bb[3] - b.p.bb[1]) - (a.p.bb[3] - a.p.bb[1]); });
    var lay = layout(all.map(function (a) { return a.p; }), (wmm || 1100) - 2 * MARGIN - 6, 14);
    var W = wmm || Math.max(lay.w + 2 * MARGIN + 6, 230), top = 22 + 112, H = hmm || lay.h + top + MARGIN + 6;
    var pg = pdf.page(W, H);
    pg.gray(0).text(MARGIN, 14, 12, label, true);
    testSquare(pg, MARGIN, 22, paper || 'a4');
    pg.text(MARGIN + 110, 30, 8, 'Imprime al 100 % / tamaño real. Mide antes el cuadrado de 10 cm.');
    pg.text(MARGIN + 110, 37, 8, 'Margen de costura de 1 cm incluido en todas las piezas. Trazo azul discontinuo = línea de costura.');
    lay.placed.forEach(function (q, i) { drawPiece(pg, q, MARGIN, top, all[i].d); });
    return { w: W, h: H, fits: lay.w <= W - 2 * MARGIN && lay.h + top <= H };
  }
  function a0Pdf(drafts, title) {
    var pdf = new Pdf();
    var r = sheet(pdf, drafts, PAPER.a0.w, PAPER.a0.h, title + ' - todas las tallas - A0 para copistería');
    return { pdf: pdf, pages: 1, fits: r.fits };
  }
  function projectorPdf(drafts, title) {
    var pdf = new Pdf();
    drafts.forEach(function (d) { sheet(pdf, [d], 0, 0, title + ' - ' + (d.opt.size === 'custom' ? 'medidas propias' : 'talla ' + d.opt.size) + ' ' + (d.opt.style === 'boxed' ? 'con fondo' : 'plano') + ' - proyector'); });
    return { pdf: pdf, pages: drafts.length };
  }
  // ---------- printable cutting chart, all sizes ----------
  function chartPdf(paper, title) {
    var P = PAPER[paper], pdf = new Pdf(), pg = pdf.page(P.w, P.h), y = 16;
    pg.gray(0).text(MARGIN, y, 13, title + ' - tabla de corte, todas las tallas', true); y += 6;
    pg.text(MARGIN, y, 7, 'Cada talla, medida por código. Margen de costura de 1 cm incluido en cada medida de corte. Pulgadas redondeadas al 1/8 más cercano.'); y += 7;
    var cx = [MARGIN, MARGIN + 18, MARGIN + 58, MARGIN + 98, MARGIN + 128, MARGIN + 160];
    var head = ['Talla', 'Acabado (an. × al. × fondo)', 'Pieza, cortar 2 + 2', 'Cuadrado esquina', 'Cremallera cerrada', 'Bloque acolchado'];
    ['boxed', 'flat'].forEach(function (style) {
      pg.text(MARGIN, y, 9, style === 'boxed' ? 'CON FONDO (esquinas recortadas)' : 'PLANO (la misma pieza, sin recortar las esquinas)', true); y += 5;
      head.forEach(function (h, i) { pg.text(cx[i], y, 6.6, h, true); }); y += 4.2;
      SIZES.forEach(function (s) {
        var d = draft({ size: s.id, style: style });
        var finV = style === 'boxed' ? [s.W, s.H, s.D] : [d.Ws, d.Hs];
        var fin = finV.map(function (v) { return dec(v / 10, 0); }).join(' × ') + ' cm';
        var row = [s.id + ' ' + s.use.split(',')[0], fin, dec(d.cw / 10, 1) + ' × ' + cm(d.ch), style === 'boxed' ? cm(d.corner) : '-', cm(d.zip, 0) + ' (' + ZIPS_INCH[d.zip] + ')', dec(d.block[0] / 10, 1) + ' × ' + cm(d.block[1])];
        row.forEach(function (c, i) { pg.text(cx[i], y, 6.6, c); }); y += 3.8;
        var row2 = ['', finV.map(function (v) { return inch(v).replace(' pulg.', ''); }).join(' × ') + ' pulg.', inch(d.cw).replace(' pulg.', '') + ' × ' + inch(d.ch), style === 'boxed' ? inch(d.corner) : '', 'por metros: ' + cm(d.zipReel, 0), inch(d.block[0]).replace(' pulg.', '') + ' × ' + inch(d.block[1])];
        pg.gray(0.3); row2.forEach(function (c, i) { pg.text(cx[i], y, 6, c); }); pg.gray(0); y += 5;
      });
      y += 3;
    });
    pg.text(MARGIN, y, 9, 'TELA QUE COMPRAR, 110 cm de ancho, + 5 cm para enderezar el corte, redondeado hacia arriba a 10 cm (1/8 yd)', true); y += 5;
    var fh = ['Talla', '1 neceser: exterior / forro', '6 neceseres: exterior / forro', '6 acolchados: exterior / guata', 'Piezas por fat quarter'];
    var fx = [MARGIN, MARGIN + 18, MARGIN + 68, MARGIN + 118, MARGIN + 165];
    fh.forEach(function (h, i) { pg.text(fx[i], y, 6.6, h, true); }); y += 4.2;
    SIZES.forEach(function (s) {
      var d = draft({ size: s.id, style: 'boxed' }), q = draft({ size: s.id, style: 'boxed', layer: 'quilted' });
      var f1 = fabric(d, 1, 1100), f6 = fabric(d, 6, 1100), q6 = fabric(q, 6, 1100);
      var g = function (f, k) { var r = f.rows.filter(function (x) { return x.k === k; })[0]; return r && r.fits ? dec(r.m, 1) + ' m (' + String(r.yd).replace('.', ',') + ' yd)' : '-'; };
      var row = [s.id, g(f1, 'ext') + ' / ' + g(f1, 'lin'), g(f6, 'ext') + ' / ' + g(f6, 'lin'), g(q6, 'ext') + ' / ' + g(q6, 'bat'), String(f1.rows[0].fq_pieces) + ' lisas, ' + String(fabric(q, 1, 1100).rows[0].fq_pieces) + ' acolchadas'];
      row.forEach(function (c, i) { pg.text(fx[i], y, 6.3, c); }); y += 4.6;
    });
    y += 4;
    var notes = [
      'Acolchado: corta la tela exterior y la guata en un bloque ' + cm(QUILT) + ' (1 pulg.) más grande por cada lado, acólchalas juntas y después recorta a la medida de la pieza. El acolchado encoge la tela: una pieza cortada a medida antes de acolchar se queda corta.',
      'Guata termoadhesiva en lugar de acolchar: córtala a la medida de la línea de costura (sin margen) para que las costuras no abulten.',
      'Cremallera: una cremallera cerrada al menos ' + cm(ZIP_CLOSED, 0) + ' más larga que el ancho de corte de la pieza, para que los dos topes queden fuera de las costuras laterales. Cremallera por metros: corta el ancho de la pieza + ' + cm(ZIP_REEL, 0) + ' y pon un cursor.',
      'Todas las piezas son rectángulos simétricos: no hay nada que cortar en espejo.'
    ];
    notes.forEach(function (n) { wrap(n, 120).forEach(function (t) { pg.text(MARGIN, y, 6.8, t); y += 4; }); y += 1.2; });
    return { pdf: pdf, pages: 1, bottom: y };
  }

  // ---------- sewing guide with line drawings made from the real pieces ----------
  function guidePdf(paper, title) {
    var P = PAPER[paper], pdf = new Pdf(), pg = pdf.page(P.w, P.h), y = 18;
    var T = function (s, sz, b, n) { wrap(s, n || 112).forEach(function (t) { pg.text(MARGIN + 2, y, sz || 7.5, t, b); y += (sz || 7.5) * 0.45 + 2.2; }); };
    T(title + ' - instrucciones de costura', 14, true); y += 2;
    T('Los dibujos de estas instrucciones están hechos por código a partir de las piezas del patrón. No hay fotos de un neceser cosido.', 7.5); y += 3;
    T('MATERIALES', 9.5, true);
    ['Tela exterior y tela de forro (algodón de patchwork, loneta o lino). La tabla de corte dice cuánta hace falta por talla y para 6 neceseres.',
      'Una de estas tres: guata (para acolchar el exterior), guata termoadhesiva (mullido sin acolchar) o nada, para un neceser blandito.',
      'Una cremallera cerrada del largo de la tabla, o cremallera por metros y un cursor.',
      'Opcional: una tira de 4 × 8 cm para la presilla. Alfileres o pinzas, prensatelas de cremalleras e hilo.'].forEach(function (s) { T('-  ' + s, 7.5); });
    y += 3; T('QUÉ CAPA VA EN CADA SITIO', 9.5, true);
    [['Guata', 'solo en las piezas exteriores: se acolcha junto con el bloque de tela exterior y luego se recorta a la medida de la pieza.'],
      ['Guata termoadhesiva', 'por el revés de las piezas exteriores, cortada por la línea de costura (sin margen).'],
      ['Forro', 'tela de forro lisa, cortada a la medida de la pieza. Si quieres un neceser más firme, pega una entretela fina tejida en el forro.']].forEach(function (r) { T(r[0] + ':  ' + r[1], 7.5); });
    y += 3; T('TALLAS', 9.5, true);
    var cx = [MARGIN + 2, MARGIN + 22, MARGIN + 72, MARGIN + 112, MARGIN + 150];
    ['Talla', 'Para', 'Acabado an. × al. × fondo', 'Versión plana', 'Cremallera'].forEach(function (h, i) { pg.text(cx[i], y, 7, h, true); }); y += 4.6;
    SIZES.forEach(function (s) {
      var d = draft({ size: s.id }), f = draft({ size: s.id, style: 'flat' });
      [s.id, s.use, dec(s.W / 10, 0) + ' × ' + dec(s.H / 10, 0) + ' × ' + cm(s.D, 0), dec(f.Ws / 10, 0) + ' × ' + cm(f.Hs, 0), cm(d.zip, 0) + ' (' + ZIPS_INCH[d.zip] + ')'].forEach(function (c, i) { pg.text(cx[i], y, 7, c); });
      y += 4.4;
    });
    y += 3; T('IMPRESIÓN', 9.5, true);
    T('Imprime la página 1 del patrón al 100 % / Tamaño real, nunca con Ajustar a la página. El cuadrado de prueba tiene que medir 10 cm en A4 o 4 pulgadas en Carta. Con la tabla de corte de la página 1 también puedes cortar todas las piezas con una regla, sin imprimir nada.', 7.5);
    var d0 = draft({ size: 'M', style: 'boxed', lining: true });
    var steps = [
      ['1  Corta', 'Corta 2 piezas de tela exterior y 2 de forro. Con fondo: recorta los cuadrados de las dos esquinas de abajo en cada pieza. Acolchado: acolcha primero el bloque grande y luego recorta.'],
      ['2  Cremallera, primer lado', 'Pieza exterior con el derecho hacia arriba, cremallera boca abajo en el borde de arriba y el forro boca abajo encima. Sujeta con pinzas y cose a 6 mm del borde con el prensatelas de cremalleras.'],
      ['3  Cremallera, segundo lado', 'Dobla las piezas hacia atrás y plancha. Repite con la otra pieza exterior y el otro forro en la otra cinta de la cremallera. Pespunta los dos lados.'],
      ['4  Abre la cremallera a medias', 'Lleva el cursor hasta la mitad. Si se te olvida, luego no podrás dar la vuelta al neceser. Pon ahora la presilla doblada, con los extremos en una costura lateral.'],
      ['5  Cose el contorno', 'Exterior con exterior y forro con forro, derecho contra derecho, con los dientes de la cremallera hacia el forro. Cose lados y base a 1 cm y deja abierto en el forro el hueco entre las dos X.'],
      ['6  Haz el fondo', 'Con fondo: abre cada esquina, pon la costura lateral sobre la de la base y cose en recto a 1 cm del borde. Plano: en lugar de eso, recorta las esquinas en diagonal.'],
      ['7  Da la vuelta', 'Recorta los extremos de la cremallera. Da la vuelta al neceser por el hueco y saca bien las esquinas.'],
      ['8  Cierra y remata', 'Cierra el hueco del forro a máquina o a mano, mete el forro dentro y plancha.']
    ];
    var drawStep = function (g, i, x, yy, w, h) {
      g.gray(0.6).width(0.25).dash(0).rect(x, yy, w, h);
      g.gray(0.4).text(x + 2, yy + h - 2, 5.5, 'dibujo hecho por código');
      var sc = Math.min((w - 16) / d0.cw, (h - 18) / d0.ch) * 0.9;
      var tx = function (pts, ox, oy, s2) { s2 = s2 || sc; return pts.map(function (p) { return [ox + p[0] * s2, oy + p[1] * s2]; }); };
      var cx0 = x + (w - d0.cw * sc) / 2, cy0 = yy + 8;
      var zip = function (ox, oy, len) {
        g.gray(0).width(0.9).path([[ox, oy], [ox + len, oy]]); g.width(0.25);
        for (var k = 0; k < len; k += 1.6) g.path([[ox + k, oy - 0.9], [ox + k, oy + 0.9]]);
      };
      g.gray(0).width(0.4);
      if (i === 0) {
        g.path(tx(d0.cut, cx0 + SA * sc, cy0 + SA * sc), true);
        g.rgb(0.16, 0.36, 0.59).dash(1.5, 1).path(tx(d0.seam, cx0 + SA * sc, cy0 + SA * sc), true).dash(0);
        g.rgb(0.76, 0.25, 0.05).rect(cx0 + (d0.cw - d0.corner) * sc, cy0 + (d0.ch - d0.corner) * sc, d0.corner * sc, d0.corner * sc);
        g.gray(0).text(cx0 + (d0.cw - d0.corner) * sc - 9, cy0 + d0.ch * sc + 5, 5.5, 'cuadrado de ' + cm(d0.corner));
      } else if (i === 1 || i === 2) {
        var s2 = sc * 0.78, ph = d0.ch * s2, pw = d0.cw * s2, ox = x + (w - pw) / 2, oy = yy + (i === 1 ? 14 : 8);
        g.rect(ox, oy, pw, ph * (i === 1 ? 1 : 0.42));
        zip(ox - 3, oy + 1.2, pw + 6);
        g.dash(1.2, 1).rect(ox + 1.5, oy - 3, pw - 3, ph * (i === 1 ? 0.9 : 0.4)).dash(0);
        if (i === 2) { g.rect(ox, oy + ph * 0.42 + 3, pw, ph * 0.42); g.text(ox, oy + ph * 0.84 + 9, 5.5, 'pespunte a los dos lados'); }
        else g.text(ox, oy + ph + 5, 5.5, 'exterior, cremallera, forro');
      } else if (i === 3) {
        var L = w - 20; zip(x + 10, yy + h / 2 - 4, L);
        g.rect(x + 10 + L / 2 - 2.5, yy + h / 2 - 7.5, 5, 7);
        g.text(x + 10 + L / 2 - 8, yy + h / 2 + 7, 6, 'cursor en la mitad', true);
      } else if (i === 4) {
        var s3 = sc * 0.55, pw2 = d0.cw * s3, ph2 = d0.ch * s3, ox2 = x + (w - pw2) / 2, oy2 = yy + 6;
        g.path(tx(d0.cut, ox2, oy2, s3), true);
        g.path(tx(d0.cut.map(function (p) { return [p[0], 2 * d0.ch - p[1]]; }), ox2, oy2 + 1.5, s3), true);
        zip(ox2 - 3, oy2 + ph2 + 0.8, pw2 + 6);
        var gy = oy2 + 2 * ph2 + 1.5, gx = ox2 + (d0.cw - d0.gap) / 2 * s3;
        g.rgb(0.76, 0.25, 0.05).width(0.8).path([[gx, gy], [gx + d0.gap * s3, gy]]);
        g.gray(0).text(gx - 2, gy - 2, 5.5, 'hueco');
        g.text(ox2 + pw2 + 2, oy2 + ph2 / 2, 5.5, 'exterior'); g.text(ox2 + pw2 + 2, oy2 + ph2 * 1.6, 5.5, 'forro');
      } else if (i === 5) {
        var D = d0.opt.D * sc * 1.6, ax = x + w / 2, ay = yy + 10;
        g.path([[ax, ay], [ax + D / 2, ay + D / 2], [ax - D / 2, ay + D / 2]], true);
        g.dash(1, 1).path([[ax, ay], [ax, ay + D / 2]]).dash(0);
        g.rgb(0.16, 0.36, 0.59).width(0.7).path([[ax - D / 2 + 2, ay + D / 2 - 2], [ax + D / 2 - 2, ay + D / 2 - 2]]);
        g.gray(0).text(ax - 14, ay + D / 2 + 6, 5.5, 'costura lateral sobre la de la base');
        g.text(ax - 9, ay + D / 2 + 11, 5.5, 'costura del fondo = ' + cm(d0.opt.D, 0));
      } else {
        var bw = d0.opt.W * sc * 0.9, bh = d0.opt.H * sc * 0.9, bx = x + (w - bw) / 2, by = yy + 12, dd = d0.opt.D * sc * 0.45;
        g.path([[bx, by + bh], [bx + bw, by + bh], [bx + bw, by], [bx, by]], true);
        g.path([[bx + bw, by + bh], [bx + bw + dd, by + bh - dd * 0.6], [bx + bw + dd, by - dd * 0.2], [bx + bw, by]]);
        zip(bx - dd * 0.2, by, bw + dd * 0.6);
        if (i === 7) g.text(bx, by + bh + 6, 5.5, 'acabado ' + dec(d0.opt.W / 10, 0) + ' × ' + dec(d0.opt.H / 10, 0) + ' × ' + cm(d0.opt.D, 0));
      }
    };
    for (var s = 0; s < steps.length; s++) {
      if (s % 4 === 0) { pg = pdf.page(P.w, P.h); pg.gray(0).text(MARGIN, 14, 11, title + ' - pasos ' + (s + 1) + ' a ' + (s + 4) + ' (dibujado para la talla M con fondo)', true); }
      var yy = 22 + (s % 4) * 64;
      drawStep(pg, s, MARGIN, yy, 70, 58);
      pg.gray(0).text(MARGIN + 76, yy + 6, 9, steps[s][0], true);
      wrap(steps[s][1], 78).forEach(function (ln, k) { pg.text(MARGIN + 76, yy + 13 + k * 4.6, 7.5, ln); });
    }
    return { pdf: pdf, pages: pdf.pages.length };
  }
  function wrap(t, n) {
    var out = [], cur = '';
    String(t).split(' ').forEach(function (w) { if ((cur + ' ' + w).trim().length > n) { out.push(cur.trim()); cur = w; } else cur += ' ' + w; });
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  var api = {
    SA: SA, QUILT: QUILT, ZIP_CLOSED: ZIP_CLOSED, ZIP_REEL: ZIP_REEL, STRAIGHTEN: STRAIGHTEN, FQ: FQ, ZIPS: ZIPS, ZIPS_IN: ZIPS_IN, ZIPS_INCH: ZIPS_INCH, SIZES: SIZES, PAPER: PAPER, dec: dec, pdfStr: pdfStr,
    draft: draft, chart: chart, fabric: fabric, cost: cost, pieces: pieces, svg: svg, inch: inch, cm: cm, both: both,
    homePdf: homePdf, a0Pdf: a0Pdf, projectorPdf: projectorPdf, chartPdf: chartPdf, guidePdf: guidePdf, sizeById: sizeById, Pdf: Pdf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pouch = api;
})(typeof window !== 'undefined' ? window : this);
