/* dropshipping orgánico — motor de cálculo (sin servidor, sin dependencias).
   Productos en prueba + vídeos orgánicos → margen real por pedido, beneficio, decisión según TUS reglas,
   constancia de publicación y mejores ganchos. Mismo código en el navegador (window.DO) y en node (module.exports). */
(function () {
  'use strict';
  var DAY = 86400000;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // número escrito a la española o a la inglesa: "1.234,56" · "1234.56" · "24,90" · "12 400"
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[€$%\s ]/g, '').replace(/[^0-9,.\-]/g, '');
    if (!s) return 0;
    var c = s.lastIndexOf(','), d = s.lastIndexOf('.');
    if (c > -1 && d > -1) { s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); }
    else if (c > -1) { s = (s.split(',').length > 2 || /,\d{3}$/.test(s) && s.length > 5 && false) ? s.replace(/,/g, '') : s.replace(',', '.'); }
    else if (d > -1 && /^\-?\d{1,3}(\.\d{3})+$/.test(s)) { s = s.replace(/\./g, ''); }
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function r2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function grp(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function eur(x) {
    var v = r2(x), neg = v < 0; v = Math.abs(v);
    var p = v.toFixed(2).split('.');
    return (neg ? '−' : '') + grp(p[0]) + ',' + p[1] + ' €';
  }
  function int(x) { var v = Math.round(x); return (v < 0 ? '−' : '') + grp(String(Math.abs(v))); }
  function pct(x, dec) { var v = (x * 100).toFixed(dec == null ? 1 : dec); return v.replace('.', ',') + ' %'; }
  function dec1(x) { return x.toFixed(1).replace('.', ','); }

  // fechas: 2026-11-03 · 3/11/2026 · 03.11.2026 · "2026-11-03x" (se ignora la basura) → ms UTC o NaN
  function pdate(v) {
    var s = String(v == null ? '' : v).trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(s))) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    if ((m = /^(\d{4})(\d{2})(\d{2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return NaN;
  }
  function iso(ms) { return isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

  function lines(t) { return String(t || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && l.charAt(0) !== '#'; }); }
  function cells(l) { return l.split(';').map(function (c) { return c.trim(); }); }

  // producto; precio de venta (IVA incl.); coste proveedor; envío; inicio de la prueba; pedidos; muestra
  function parseProducts(t) {
    return lines(t).map(function (l) {
      var c = cells(l);
      return { name: c[0] || '', price: num(c[1]), cost: num(c[2]), ship: num(c[3]), start: pdate(c[4]), orders: Math.max(0, Math.round(num(c[5]))), sample: num(c[6]) };
    }).filter(function (p) { return p.name; });
  }
  // fecha; producto; plataforma; gancho; visualizaciones; clics
  function parseVideos(t) {
    return lines(t).map(function (l) {
      var c = cells(l);
      return { date: pdate(c[0]), product: c[1] || '', platform: c[2] || '', hook: c[3] || '', views: Math.max(0, Math.round(num(c[4]))), clicks: Math.max(0, Math.round(num(c[5]))) };
    }).filter(function (v) { return v.product && !isNaN(v.date); });
  }

  function findProduct(prods, name) {
    var n = norm(name), i;
    for (i = 0; i < prods.length; i++) if (norm(prods[i].name) === n) return prods[i];
    for (i = 0; i < prods.length; i++) if (n && (norm(prods[i].name).indexOf(n) > -1 || n.indexOf(norm(prods[i].name)) > -1)) return prods[i];
    return null;
  }

  // margen real de UN pedido: precio sin IVA − proveedor − envío − comisión de pago − provisión de devoluciones
  function unit(p, s) {
    var base = p.price / (1 + s.iva / 100);
    var fee = p.price * s.feePct / 100 + s.feeFix;
    var ret = base * s.retPct / 100;
    var m = base - p.cost - p.ship - fee - ret;
    return { base: base, ivaAmt: p.price - base, fee: fee, ret: ret, margin: m };
  }

  function compute(inp) {
    var s = {
      shop: String(inp.tienda || '').trim() || 'Mi tienda',
      today: pdate(inp.hoy),
      window: Math.max(1, Math.round(num(inp.ventana) || 7)),
      minVid: Math.max(1, Math.round(num(inp.minvid) || 6)),
      minOrd: Math.max(1, Math.round(num(inp.minped) || 5)),
      perDay: Math.max(0, num(inp.objetivo)),
      iva: num(inp.iva),
      feePct: num(inp.compct),
      feeFix: num(inp.comfijo),
      retPct: num(inp.devol)
    };
    if (isNaN(s.today)) s.today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    var prods = parseProducts(inp.productos), vids = parseVideos(inp.videos), orphan = [];
    prods.forEach(function (p) { p.vids = []; });
    vids.forEach(function (v) { var p = findProduct(prods, v.product); if (p) p.vids.push(v); else orphan.push(v); });

    var R = { s: s, prods: [], orphan: orphan, videos: vids };
    var tot = { orders: 0, profit: 0, revenue: 0, views: 0, clicks: 0, vids: 0, lossOrders: 0, lossAmt: 0 };
    prods.forEach(function (p) {
      var u = unit(p, s);
      var views = 0, clicks = 0; p.vids.forEach(function (v) { views += v.views; clicks += v.clicks; });
      var end = isNaN(p.start) ? NaN : p.start + (s.window - 1) * DAY;
      var dayN = isNaN(p.start) ? NaN : Math.floor((s.today - p.start) / DAY) + 1;
      var profit = p.orders * u.margin - p.sample;
      var o = {
        name: p.name, price: p.price, cost: p.cost, ship: p.ship, sample: p.sample, orders: p.orders, start: p.start, end: end, day: dayN,
        u: u, vids: p.vids.length, views: views, clicks: clicks,
        clickRate: views ? clicks / views : 0, conv: clicks ? p.orders / clicks : 0,
        viewsPerOrder: p.orders ? views / p.orders : 0, profit: profit,
        breakEven: u.margin > 0 ? Math.ceil((p.sample - 1e-9) / u.margin) : null
      };
      // decisión con TUS reglas (no es una predicción: aplica los umbrales que escribes arriba)
      var ended = !isNaN(end) && s.today > end;
      if (p.orders > 0 && u.margin <= 0) { o.dec = 'precio'; o.why = 'cada pedido pierde ' + eur(-u.margin); }
      else if (o.vids < s.minVid) { o.dec = 'publicar'; o.why = 'faltan ' + (s.minVid - o.vids) + ' vídeos para tu mínimo de ' + s.minVid; }
      else if (p.orders >= s.minOrd && u.margin > 0) { o.dec = 'escalar'; o.why = p.orders + ' pedidos con ' + o.vids + ' vídeos, ' + eur(u.margin) + ' por pedido'; }
      else if (ended) { o.dec = 'descartar'; o.why = p.orders + ' de ' + s.minOrd + ' pedidos al cerrar la prueba (' + iso(end) + ')'; }
      else { o.dec = 'seguir'; o.why = p.orders + ' de ' + s.minOrd + ' pedidos; la prueba cierra el ' + iso(end); }
      R.prods.push(o);
      tot.orders += p.orders; tot.profit += profit; tot.revenue += p.orders * p.price; tot.views += views; tot.clicks += clicks; tot.vids += o.vids;
      if (p.orders > 0 && u.margin < 0) { tot.lossOrders += p.orders; tot.lossAmt += -u.margin * p.orders; }
    });
    R.tot = tot;

    // constancia: últimos 7 días (hoy incluido)
    var from = s.today - 6 * DAY, days = [], i;
    for (i = 0; i < 7; i++) days.push({ d: from + i * DAY, n: 0 });
    vids.forEach(function (v) { var k = Math.round((v.date - from) / DAY); if (k >= 0 && k < 7) days[k].n++; });
    var week = days.reduce(function (a, d) { return a + d.n; }, 0);
    R.week = { days: days, posted: week, target: Math.round(s.perDay * 7), empty: days.filter(function (d) { return d.n === 0; }).map(function (d) { return iso(d.d); }) };

    // ganchos: clics por cada 1.000 visualizaciones (solo vídeos con 500+ visualizaciones)
    var hooks = vids.filter(function (v) { return v.views >= 500 && v.hook; }).map(function (v) { return { hook: v.hook, product: v.product, platform: v.platform, views: v.views, clicks: v.clicks, per1k: v.clicks * 1000 / v.views, date: v.date }; });
    hooks.sort(function (a, b) { return b.per1k - a.per1k || b.views - a.views; });
    R.hooks = hooks;
    R.best = hooks[0] || null;
    R.worst = hooks.length > 1 ? hooks[hooks.length - 1] : null;
    R.scale = R.prods.filter(function (p) { return p.dec === 'escalar'; });
    R.loss = R.prods.filter(function (p) { return p.dec === 'precio'; });
    R.drop = R.prods.filter(function (p) { return p.dec === 'descartar'; });
    return R;
  }

  var DEC = { escalar: 'escalar', precio: 'subir precio o cambiar proveedor', publicar: 'seguir publicando', descartar: 'descartar', seguir: 'seguir probando' };
  var CLS = { escalar: 'good', precio: 'bad', publicar: 'warn', descartar: 'bad', seguir: 'warn' };

  // 6 cifras del primer pantallazo
  function tiles(R) {
    var t = R.tot, out = [];
    var lossNames = R.loss.map(function (p) { return p.name; }).join(', ');
    out.push({ hot: true, k: 'Pedidos que pierden dinero', v: t.lossOrders ? int(t.lossOrders) + ' pedidos' : '0', i: t.lossOrders ? eur(t.lossAmt) + ' perdidos en ' + lossNames : 'todos los productos con pedidos dejan margen' });
    out.push({ k: 'Beneficio real de la prueba', v: eur(t.profit), i: int(t.orders) + ' pedidos, ' + eur(t.revenue) + ' cobrados, tras IVA, proveedor, envío, comisión, devoluciones y muestras' });
    out.push({ hot: !R.scale.length, k: 'Productos para escalar', v: R.scale.length + ' de ' + R.prods.length, i: R.scale.length ? R.scale.map(function (p) { return p.name + ' (' + eur(p.u.margin) + ' por pedido)'; }).join(', ') : 'ninguno cumple aún tus reglas' });
    out.push({ hot: R.week.target > 0 && R.week.posted < R.week.target, k: 'Vídeos en los últimos 7 días', v: R.week.posted + ' de ' + R.week.target, i: R.week.empty.length ? R.week.empty.length + (R.week.empty.length === 1 ? ' día sin publicar: ' : ' días sin publicar: ') + R.week.empty.join(', ') : 'publicaste todos los días' });
    out.push({ k: 'Mejor gancho', v: R.best ? dec1(R.best.per1k) + ' clics por 1.000' : '—', i: R.best ? '«' + R.best.hook + '» (' + R.best.product + ', ' + R.best.platform + ')' : 'anota visualizaciones y clics' });
    out.push({ hot: R.drop.length > 0, k: 'Descartar según tus reglas', v: R.drop.length + ' de ' + R.prods.length, i: R.drop.length ? R.drop.map(function (p) { return p.name; }).join(', ') + ': ' + eur(R.drop.reduce(function (a, p) { return a + p.sample; }, 0)) + ' en muestras' : 'ningún producto cerró la prueba sin llegar a tu mínimo' });
    return out;
  }

  function tilesHTML(R) {
    return tiles(R).map(function (x) { return '<div class="tile' + (x.hot ? ' hot' : '') + '"><span>' + esc(x.k) + '</span><b>' + esc(x.v) + '</b><i>' + esc(x.i) + '</i></div>'; }).join('');
  }

  function rowsHTML(R) {
    return R.prods.map(function (p) {
      return '<tr class="' + CLS[p.dec] + '"><th>' + esc(p.name) + '<small>' + eur(p.price) + ' IVA incl. · prueba desde ' + (iso(p.start) || '—') + (isNaN(p.day) ? '' : ', día ' + p.day) + '</small></th>' +
        '<td>' + p.vids + '<small>' + int(p.views) + ' visualizaciones</small></td>' +
        '<td>' + int(p.clicks) + '<small>' + (p.views ? dec1(p.clickRate * 1000) + ' por 1.000' : '—') + '</small></td>' +
        '<td>' + p.orders + '<small>' + (p.clicks ? pct(p.conv) + ' de los clics' : '—') + '</small></td>' +
        '<td class="v">' + eur(p.u.margin) + '<small>sin IVA ' + eur(p.u.base) + ' − proveedor ' + eur(p.cost) + ' − envío ' + eur(p.ship) + ' − comisión ' + eur(p.u.fee) + ' − devoluciones ' + eur(p.u.ret) + '</small></td>' +
        '<td>' + eur(p.profit) + '<small>muestra ' + eur(p.sample) + (p.breakEven != null ? ', se cubre con ' + p.breakEven + ' pedidos' : '') + '</small></td>' +
        '<td class="d"><b>' + DEC[p.dec] + '</b><small>' + esc(p.why) + '</small></td></tr>';
    }).join('');
  }

  function flags(R) {
    var f = [];
    R.loss.forEach(function (p) {
      // precio mínimo con IVA para margen 0: P/(1+iva)·(1 − ret) − P·fee% = cost + ship + fix
      var s = R.s, k = (1 - s.retPct / 100) / (1 + s.iva / 100) - s.feePct / 100;
      var minP = k > 0 ? (p.cost + p.ship + s.feeFix) / k : 0;
      f.push({ c: 'bad', b: p.name, t: p.orders + ' pedidos pierden ' + eur(-p.u.margin) + ' cada uno (' + eur(-p.u.margin * p.orders) + '). Con tu proveedor y tu envío, el precio con IVA tiene que pasar de ' + eur(minP) + ' solo para no perder; cambia el precio, el proveedor o el envío antes del siguiente vídeo.' });
    });
    R.prods.filter(function (p) { return p.dec === 'publicar'; }).forEach(function (p) { f.push({ c: 'warn', b: p.name, t: p.why + '. Aún no hay datos para decidir.' }); });
    R.drop.forEach(function (p) { f.push({ c: 'bad', b: p.name, t: 'cerró la prueba el ' + iso(p.end) + ' con ' + p.orders + (p.orders === 1 ? ' pedido (' : ' pedidos (') + p.vids + ' vídeos, ' + int(p.views) + ' visualizaciones). Tu regla dice descartar: deja de grabarlo y usa ese tiempo en el siguiente producto.' }); });
    R.scale.forEach(function (p) { f.push({ c: 'good', b: p.name, t: p.why + '. Graba más vídeos con el gancho que mejor funciona' + (bestFor(R, p.name) ? ': «' + bestFor(R, p.name).hook + '»' : '') + '.' }); });
    if (R.week.target && R.week.posted < R.week.target) f.push({ c: 'warn', b: 'Constancia', t: R.week.posted + ' de ' + R.week.target + ' vídeos en 7 días' + (R.week.empty.length ? '; sin publicar el ' + R.week.empty.join(', ') : '') + '.' });
    if (R.worst && R.best && R.worst.hook !== R.best.hook) f.push({ c: '', b: 'Ganchos', t: '«' + R.best.hook + '» saca ' + dec1(R.best.per1k) + ' clics por 1.000 visualizaciones; «' + R.worst.hook + '» solo ' + dec1(R.worst.per1k) + '.' });
    if (R.orphan.length) f.push({ c: 'warn', b: R.orphan.length + ' vídeos sin producto', t: 'el nombre no coincide con ninguno de la lista: ' + R.orphan.map(function (v) { return v.product; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', ') });
    return f;
  }
  function bestFor(R, name) { var n = norm(name); for (var i = 0; i < R.hooks.length; i++) if (norm(R.hooks[i].product) === n) return R.hooks[i]; return null; }

  function flagsHTML(R) { return flags(R).map(function (x) { return '<li class="' + x.c + '"><b>' + esc(x.b) + '</b> ' + esc(x.t) + '</li>'; }).join(''); }

  function summary(R) {
    var t = R.tot, s = R.s;
    var parts = [s.shop + ', a ' + iso(s.today) + ': ' + R.prods.length + ' productos en prueba, ' + t.vids + ' vídeos, ' + int(t.views) + ' visualizaciones, ' + int(t.clicks) + ' clics, ' + int(t.orders) + ' pedidos.'];
    parts.push('Beneficio real ' + eur(t.profit) + ' (IVA ' + String(s.iva).replace('.', ',') + ' %, comisión ' + String(s.feePct).replace('.', ',') + ' % + ' + eur(s.feeFix) + ', devoluciones ' + String(s.retPct).replace('.', ',') + ' %).');
    if (t.lossOrders) parts.push(t.lossOrders + ' pedidos pierden dinero: ' + eur(t.lossAmt) + ' perdidos (' + R.loss.map(function (p) { return p.name; }).join(', ') + ').');
    if (R.scale.length) parts.push('Escalar: ' + R.scale.map(function (p) { return p.name; }).join(', ') + '.');
    if (R.drop.length) parts.push('Descartar: ' + R.drop.map(function (p) { return p.name; }).join(', ') + '.');
    parts.push('Últimos 7 días: ' + R.week.posted + ' de ' + R.week.target + ' vídeos.');
    if (R.best) parts.push('Mejor gancho: «' + R.best.hook + '», ' + dec1(R.best.per1k) + ' clics por 1.000 visualizaciones.');
    return parts.join(' ');
  }

  // ---------- Pro: importaciones y exportaciones ----------
  function splitCSV(text) {
    var t = String(text || '').replace(/^﻿/, ''), first = t.split(/\r?\n/)[0] || '';
    var sep = (first.split(';').length > first.split(',').length) ? ';' : (first.split('\t').length > first.split(',').length ? '\t' : ',');
    var rows = [], row = [], cur = '', q = false, i, ch;
    for (i = 0; i < t.length; i++) {
      ch = t.charAt(i);
      if (q) { if (ch === '"') { if (t.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t.charAt(i + 1) === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }
  function col(head, names) {
    var h = head.map(norm), i, j;
    for (j = 0; j < names.length; j++) for (i = 0; i < h.length; i++) if (h[i] === names[j]) return i;
    for (j = 0; j < names.length; j++) for (i = 0; i < h.length; i++) if (h[i].indexOf(names[j]) > -1) return i;
    return -1;
  }

  // Export de pedidos de Shopify (Pedidos → Exportar → CSV): "Created at", "Lineitem quantity", "Lineitem name".
  // Cuenta unidades por producto desde el inicio de su prueba. Devuelve {counts:{nombre:n}, unmatched:[...], rows:n}
  function importOrders(csv, productsText) {
    var rows = splitCSV(csv); if (rows.length < 2) return { error: 'el archivo no tiene filas' };
    var h = rows[0];
    var cName = col(h, ['lineitem name', 'nombre del articulo', 'nombre de la linea', 'product', 'producto']);
    var cQty = col(h, ['lineitem quantity', 'cantidad del articulo', 'cantidad', 'quantity', 'qty']);
    var cDate = col(h, ['created at', 'creado', 'fecha', 'date']);
    if (cName < 0) return { error: 'no encuentro la columna del producto (Lineitem name)' };
    var prods = parseProducts(productsText), counts = {}, unmatched = {}, used = 0;
    rows.slice(1).forEach(function (r) {
      var nm = r[cName]; if (!nm || !String(nm).trim()) return;
      var p = findProduct(prods, nm);
      if (!p) { unmatched[nm] = 1; return; }
      var d = cDate > -1 ? pdate(r[cDate]) : NaN;
      if (!isNaN(d) && !isNaN(p.start) && d < p.start) return;
      counts[p.name] = (counts[p.name] || 0) + (cQty > -1 ? Math.max(1, Math.round(num(r[cQty]))) : 1); used++;
    });
    var text = lines(productsText).map(function (l) {
      var c = cells(l), p = findProduct(prods, c[0]); if (!p || counts[p.name] == null) return l;
      while (c.length < 7) c.push('');
      c[5] = String(counts[p.name]); return c.join('; ');
    }).join('\n');
    return { counts: counts, unmatched: Object.keys(unmatched), rows: used, text: text };
  }

  // CSV de vídeos (tu hoja o un export de estadísticas): fecha, producto, plataforma, gancho/título, visualizaciones, clics
  function importVideos(csv, defaultPlatform) {
    var rows = splitCSV(csv); if (rows.length < 2) return { error: 'el archivo no tiene filas' };
    var h = rows[0];
    var cD = col(h, ['fecha', 'date', 'post time', 'publicado', 'created']);
    var cP = col(h, ['producto', 'product']);
    var cPl = col(h, ['plataforma', 'platform', 'red']);
    var cH = col(h, ['gancho', 'hook', 'titulo', 'title', 'descripcion', 'caption', 'video title']);
    var cV = col(h, ['visualizaciones', 'vistas', 'reproducciones', 'video views', 'views', 'plays']);
    var cC = col(h, ['clics', 'clicks', 'link clicks', 'visitas', 'visits']);
    if (cD < 0 || cV < 0) return { error: 'faltan columnas: fecha y visualizaciones son obligatorias' };
    var out = [];
    rows.slice(1).forEach(function (r) {
      var d = pdate(r[cD]); if (isNaN(d)) return;
      out.push([iso(d), cP > -1 ? r[cP] : '', cPl > -1 ? r[cPl] : (defaultPlatform || 'TikTok'), String(cH > -1 ? r[cH] : '').replace(/;/g, ','), Math.round(num(r[cV])), cC > -1 ? Math.round(num(r[cC])) : 0].join('; '));
    });
    return { lines: out, n: out.length };
  }

  function csvCell(v) { var s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csvResults(R) {
    var h = ['producto', 'precio IVA incl.', 'proveedor', 'envío', 'inicio', 'vídeos', 'visualizaciones', 'clics', 'pedidos', 'margen por pedido', 'beneficio', 'decisión', 'motivo'];
    var rows = R.prods.map(function (p) { return [p.name, r2(p.price), r2(p.cost), r2(p.ship), iso(p.start), p.vids, p.views, p.clicks, p.orders, r2(p.u.margin), r2(p.profit), DEC[p.dec], p.why]; });
    return '﻿' + [h].concat(rows).map(function (r) { return r.map(function (c) { return csvCell(typeof c === 'number' ? String(c).replace('.', ',') : c); }).join(';'); }).join('\r\n');
  }
  function csvVideos(R) {
    var h = ['fecha', 'producto', 'plataforma', 'gancho', 'visualizaciones', 'clics', 'clics por 1.000'];
    var rows = R.videos.map(function (v) { return [iso(v.date), v.product, v.platform, v.hook, v.views, v.clicks, v.views ? dec1(v.clicks * 1000 / v.views) : '']; });
    return '﻿' + [h].concat(rows).map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n');
  }

  // Calendario .ics: plan de publicación de los próximos N días + cierre de cada prueba
  function icsPlan(R, opt) {
    opt = opt || {};
    var days = opt.days || 7, hours = (opt.hours || '12:00, 19:00, 21:00').split(/[,\s]+/).filter(Boolean);
    var per = Math.max(1, Math.round(R.s.perDay || 1));
    var live = R.prods.filter(function (p) { return p.dec === 'escalar' || p.dec === 'publicar' || p.dec === 'seguir'; });
    live.sort(function (a, b) { var o = { escalar: 0, publicar: 1, seguir: 2 }; return o[a.dec] - o[b.dec]; });
    var ev = [], stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', k = 0, d, j;
    function dt(ms, hm) { var m = /^(\d{1,2}):(\d{2})$/.exec(hm) || [0, '12', '00']; return iso(ms).replace(/-/g, '') + 'T' + ('0' + m[1]).slice(-2) + m[2] + '00'; }
    function ics(s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); }
    if (live.length) for (d = 1; d <= days; d++) for (j = 0; j < per; j++) {
      var p = live[k % live.length]; k++;
      var hk = bestFor(R, p.name);
      ev.push(['BEGIN:VEVENT', 'UID:do-' + iso(R.s.today) + '-' + d + '-' + j + '@dropshipping-organico', 'DTSTAMP:' + stamp,
        'DTSTART:' + dt(R.s.today + d * DAY, hours[j % hours.length]), 'DURATION:PT30M',
        'SUMMARY:' + ics('Vídeo ' + (j + 1) + '/' + per + ': ' + p.name + ' (' + DEC[p.dec] + ')'),
        'DESCRIPTION:' + ics((hk ? 'Gancho que mejor funciona: «' + hk.hook + '» (' + dec1(hk.per1k) + ' clics por 1.000). ' : '') + 'Anota visualizaciones y clics a las 24 h.'),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + ics('Publicar vídeo: ' + p.name), 'TRIGGER:-PT15M', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
    }
    R.prods.forEach(function (p) {
      if (isNaN(p.end) || p.end < R.s.today) return;
      ev.push(['BEGIN:VEVENT', 'UID:do-cierre-' + norm(p.name).replace(/[^a-z0-9]+/g, '-') + '-' + iso(p.end) + '@dropshipping-organico', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + iso(p.end + DAY).replace(/-/g, ''), 'SUMMARY:' + ics('Decidir: ' + p.name + ' (cierre de la prueba)'),
        'DESCRIPTION:' + ics('Regla: escalar con ' + R.s.minOrd + ' pedidos y margen positivo; descartar si no llega.'),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + ics('Decidir ' + p.name), 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
    });
    return { text: ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//dropshipping organico//ES', 'CALSCALE:GREGORIAN'].concat(ev).concat(['END:VCALENDAR']).join('\r\n') + '\r\n', n: ev.length };
  }

  var E = { num: num, pdate: pdate, iso: iso, eur: eur, int: int, pct: pct, esc: esc, parseProducts: parseProducts, parseVideos: parseVideos, unit: unit,
    compute: compute, tiles: tiles, tilesHTML: tilesHTML, rowsHTML: rowsHTML, flags: flags, flagsHTML: flagsHTML, summary: summary, DEC: DEC,
    splitCSV: splitCSV, importOrders: importOrders, importVideos: importVideos, csvResults: csvResults, csvVideos: csvVideos, icsPlan: icsPlan };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  if (typeof window !== 'undefined') window.DO = E;
})();
