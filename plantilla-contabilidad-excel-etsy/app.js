(function () {
  'use strict';
  var doc = document, LS = window.localStorage, C = window.CONTA, X = window.XLSXW;
  var SLUG = 'plantilla-contabilidad-excel-etsy', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var K_DRAFT = 'pce.draft', K_KEY = 'pce.key', K_HIST = 'pce.hist';
  var KEYS = ['anio', 'trim', 'roi', 'prev01', 'prev02', 'prev05', 'ded', 'conIva', 'gdj', 'ivaPago', 'listEur', 'offRate'];
  var EJEMPLO = {
  anio: '2026', trim: '4', roi: 'no', prev01: '6240', prev02: '2870', prev05: '674', ded: '0',
  conIva: 'si', gdj: 'si', ivaPago: 'no', listEur: '0,18', offRate: '15',
  pedidos: [
    { fecha: '2026-10-03', prod: 'Taza esmaltada azul', uds: '2', imp: '56', env: '6.5', dest: 'es', off: 'no', mat: '9', envReal: '5.9' },
    { fecha: '2026-10-09', prod: 'Jarrón mediano', uds: '1', imp: '78', env: '12', dest: 'ue', off: 'no', mat: '11', envReal: '14.5' },
    { fecha: '2026-10-15', prod: 'Pendientes de cerámica', uds: '3', imp: '54', env: '4', dest: 'es', off: 'si', mat: '4.5', envReal: '3.2' },
    { fecha: '2026-10-22', prod: 'Taza esmaltada azul', uds: '1', imp: '28', env: '6.5', dest: 'es', off: 'no', mat: '4.5', envReal: '5.9' },
    { fecha: '2026-10-30', prod: 'Set de 4 platos', uds: '1', imp: '120', env: '18', dest: 'fuera', off: 'no', mat: '22', envReal: '28' },
    { fecha: '2026-11-04', prod: 'Pendientes de cerámica', uds: '2', imp: '36', env: '4', dest: 'ue', off: 'no', mat: '3', envReal: '3.2' },
    { fecha: '2026-11-08', prod: 'Jarrón mediano', uds: '1', imp: '78', env: '12', dest: 'es', off: 'si', mat: '11', envReal: '7.8' },
    { fecha: '2026-11-12', prod: 'Taza esmaltada azul', uds: '4', imp: '112', env: '8', dest: 'es', off: 'no', mat: '18', envReal: '7.4' },
    { fecha: '2026-10-11', prod: 'Set de 4 platos', uds: '1', imp: '120', env: '9', dest: 'es', off: 'no', mat: '22', envReal: '9.6' },
    { fecha: '2026-10-26', prod: 'Jarrón mediano', uds: '2', imp: '156', env: '14', dest: 'es', off: 'si', mat: '22', envReal: '11.2' },
    { fecha: '2026-11-02', prod: 'Taza esmaltada azul', uds: '2', imp: '56', env: '6.5', dest: 'fuera', off: 'no', mat: '9', envReal: '16.4' },
    { fecha: '2026-11-13', prod: 'Set de 4 platos', uds: '1', imp: '120', env: '9', dest: 'ue', off: 'si', mat: '22', envReal: '13.9' }
  ],
  gastos: [
    { fecha: '2026-10-02', concepto: 'arcilla y esmaltes', total: '186', iva: '21' },
    { fecha: '2026-10-20', concepto: 'cajas y relleno', total: '42.35', iva: '21' },
    { fecha: '2026-11-01', concepto: 'Etsy Ads (octubre)', total: '30', iva: '0' },
    { fecha: '2026-11-10', concepto: 'cuota de autónomos (oct–dic)', total: '264', iva: '0' }
  ]
};
  var pro = false, cur = null, st = null;
  var E = C.eur;

  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) { /* lleno o bloqueado */ } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fd(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function opt(v, label, cur) { return '<option value="' + v + '"' + (String(cur) === v ? ' selected' : '') + '>' + label + '</option>'; }

  function pedRow(p) {
    p = p || {};
    return '<div class="row ped">' +
      '<label class="sr"><span>Fecha</span><input class="p-fecha" type="date" data-yj-mine value="' + esc(p.fecha) + '"></label>' +
      '<label class="sr"><span>Producto</span><input class="p-prod" data-yj-mine value="' + esc(p.prod) + '" placeholder="producto"></label>' +
      '<label class="sr"><span>Uds.</span><input class="p-uds" data-yj-mine inputmode="numeric" value="' + esc(p.uds || '1') + '"></label>' +
      '<label class="sr"><span>Artículos (€)</span><input class="p-imp" data-yj-mine inputmode="decimal" value="' + esc(p.imp) + '"></label>' +
      '<label class="sr"><span>Envío cobrado (€)</span><input class="p-env" data-yj-mine inputmode="decimal" value="' + esc(p.env) + '"></label>' +
      '<label class="sr"><span>Destino</span><select class="p-dest" data-yj-mine>' + opt('es', 'España', p.dest || 'es') + opt('ue', 'otro país UE', p.dest) + opt('fuera', 'fuera de la UE', p.dest) + '</select></label>' +
      '<label class="sr"><span>Offsite Ads</span><select class="p-off" data-yj-mine>' + opt('no', 'no', p.off || 'no') + opt('si', 'sí', p.off) + '</select></label>' +
      '<label class="sr"><span>Materiales (€)</span><input class="p-mat" data-yj-mine inputmode="decimal" value="' + esc(p.mat) + '"></label>' +
      '<label class="sr"><span>Envío pagado (€)</span><input class="p-envReal" data-yj-mine inputmode="decimal" value="' + esc(p.envReal) + '"></label>' +
      '<button class="x" type="button" title="quitar">×</button></div>';
  }
  function gasRow(g) {
    g = g || {};
    return '<div class="row gas">' +
      '<label class="sr"><span>Fecha</span><input class="g-fecha" type="date" data-yj-mine value="' + esc(g.fecha) + '"></label>' +
      '<label class="sr"><span>Concepto</span><input class="g-concepto" data-yj-mine value="' + esc(g.concepto) + '" placeholder="concepto"></label>' +
      '<label class="sr"><span>Total (€)</span><input class="g-total" data-yj-mine inputmode="decimal" value="' + esc(g.total) + '"></label>' +
      '<label class="sr"><span>IVA</span><select class="g-iva" data-yj-mine>' + opt('21', '21 %', g.iva || '21') + opt('10', '10 %', g.iva) + opt('4', '4 %', g.iva) + opt('0', '0 / no deducible', g.iva) + '</select></label>' +
      '<button class="x" type="button" title="quitar">×</button></div>';
  }
  function fill(s) {
    KEYS.forEach(function (k) { if ($(k) && s[k] != null) $(k).value = s[k]; });
    $('peds').innerHTML = (s.pedidos || []).map(pedRow).join('');
    $('gass').innerHTML = (s.gastos || []).map(gasRow).join('');
  }
  function read() {
    var s = {};
    KEYS.forEach(function (k) { s[k] = $(k).value; });
    s.pedidos = [].map.call(doc.querySelectorAll('#peds .row'), function (r) {
      var o = {}; ['fecha', 'prod', 'uds', 'imp', 'env', 'dest', 'off', 'mat', 'envReal'].forEach(function (k) { o[k] = r.querySelector('.p-' + k).value; }); return o;
    });
    s.gastos = [].map.call(doc.querySelectorAll('#gass .row'), function (r) {
      var o = {}; ['fecha', 'concepto', 'total', 'iva'].forEach(function (k) { o[k] = r.querySelector('.g-' + k).value; }); return o;
    });
    return s;
  }

  function render() {
    st = read(); cur = C.compute(st); jset(K_DRAFT, st);
    var r = cur, tn = ['', '1.er', '2.º', '3.er', '4.º'][r.trim] + ' trimestre de ' + r.anio;
    var h = '';
    h += '<p class="eyebrow">' + esc(tn) + ' · ' + r.n + ' pedidos · tienda con cuenta de pagos en España</p>';
    h += '<div class="kpis">' +
      '<div class="kpi loss"><span>Etsy se queda</span><b>' + E(r.fees) + '</b><small>' + C.pct(r.feesPct) + ' de ' + E(r.cobrado) + ' cobrados</small></div>' +
      '<div class="kpi"><span>IVA que no es tuyo</span><b>' + E(r.ivaRep) + '</b><small>dentro de tus precios</small></div>' +
      '<div class="kpi"><span>Modelo 130 a ingresar</span><b>' + E(r.pago130) + '</b><small>plazo: ' + fd(r.plazo) + '</small></div>' +
      '<div class="kpi"><span>Modelo 303</span><b>' + E(r.iva303) + '</b><small>' + (r.iva303 >= 0 ? 'a ingresar' : 'a compensar') + ' · plazo: ' + fd(r.plazo) + '</small></div>' +
      '<div class="kpi big"><span>Lo que te queda de verdad</span><b>' + E(r.caja) + '</b><small>tras Etsy, envíos, gastos, 303 y 130</small></div>' +
      '</div>';
    h += '<h3>Lo que Etsy te quitó, tarifa por tarifa</h3><table class="t"><tbody>' +
      tr('Transacción 6,5 %', r.etsy.trans) + tr('Procesamiento 4 % + 0,30 €', r.etsy.pago) + tr('Tarifa operativa regulatoria 0,88 %', r.etsy.reg) +
      tr('Publicación por artículo vendido', r.etsy.list) + tr('Offsite Ads', r.etsy.off) + tr(r.roi ? 'IVA sobre tarifas (no te lo cobra: tiene tu NIF-IVA)' : 'IVA sobre las tarifas (sin NIF-IVA en Etsy)', r.etsy.iva) +
      '<tr class="tot"><td>Total comisiones</td><td>' + E(r.fees) + '</td></tr><tr><td>Depósito que te hace Etsy</td><td>' + E(r.deposito) + '</td></tr></tbody></table>';
    if (!r.roi && r.etsy.iva > 0) h += '<p class="note">Sin tu NIF-IVA, Etsy te cobró <b>' + E(r.etsy.iva) + '</b> de IVA sobre sus tarifas este trimestre. Con el NIF-IVA en Etsy no te lo cobra.</p>';
    if (r.peor && r.prods.length > 1) h += '<p class="note">Producto con menos margen: <b>' + esc(r.peor.prod) + '</b>, te deja <b>' + E(r.peor.porUd) + ' por unidad</b> (' + C.pct(r.peor.pctM) + ' de lo cobrado) después de Etsy, IVA, envío y materiales.</p>';
    h += '<h3>Margen por producto</h3><table class="t"><thead><tr><th>Producto</th><th>Uds.</th><th>Cobrado</th><th>Etsy</th><th>Margen</th><th>Por ud.</th></tr></thead><tbody>' +
      r.prods.map(function (p) { return '<tr><td>' + esc(p.prod) + '</td><td>' + p.uds + '</td><td>' + E(p.cobrado) + '</td><td>' + E(p.fees) + '</td><td>' + E(p.margen) + '</td><td>' + E(p.porUd) + '</td></tr>'; }).join('') + '</tbody></table>';
    h += '<h3>Modelo 130 del ' + esc(tn) + '</h3><table class="t"><tbody>' +
      tr('Ingresos del trimestre (sin IVA)', r.ingresos) + tr('Gastos del trimestre (Etsy + envíos + base de gastos)', r.gastosQ) + tr('Gastos de difícil justificación 5 %', r.gdj) +
      tr('Casilla 01', r.c01) + tr('Casilla 02', r.c02) + tr('Casilla 03', r.c03) + tr('Casilla 04 (20 %)', r.c04) + tr('Casilla 05', r.c05) + tr('Casilla 07', r.c07) + tr('Minoración (casilla 13)', r.c13) +
      '<tr class="tot"><td>A ingresar del 1 ' + (r.trim === 4 ? 'al 30 de enero de ' + (r.anio + 1) : 'al 20 de ' + ['abril', 'julio', 'octubre'][r.trim - 1] + ' de ' + r.anio) + '</td><td>' + E(r.pago130) + '</td></tr></tbody></table>';
    h += '<h3>Modelo 303 (simplificado)</h3><table class="t"><tbody>' + tr('IVA de tus ventas (España y UE)', r.ivaRep) + tr('IVA deducible de tus gastos', r.gCuota) +
      '<tr class="tot"><td>Resultado</td><td>' + E(r.iva303) + '</td></tr></tbody></table>';
    if (r.roi && r.autoIva) h += '<p class="note">Con NIF-IVA, Etsy no te cobra IVA; en el 303 declaras ' + E(r.autoIva) + ' por inversión del sujeto pasivo como devengado y como deducible: el efecto es 0.</p>';
    var rc = C.recargo(r.pago130 + Math.max(0, r.iva303), r.plazo, addMonths(r.plazo, 2));
    if (r.pago130 + Math.max(0, r.iva303) > 0) h += '<p class="note">Si presentas el 130 y el 303 dos meses tarde sin requerimiento, el recargo es del ' + rc.pct + ' %: ' + E(rc.eur) + ' sobre ' + E(r.pago130 + Math.max(0, r.iva303)) + ' (LGT art. 27.2).</p>';
    if (r.ueVentas > 0) h += '<p class="hint">Ventas a otros países de la UE este trimestre: ' + E(r.ueVentas) + '. Se cuentan con IVA español; si en el año superas 10.000 € de estas ventas, pasa a ser el IVA del país del comprador.</p>';
    if (r.fueraTrim) h += '<p class="hint">' + r.fueraTrim + ' pedido(s) tienen fecha fuera del trimestre elegido; se cuentan igual.</p>';
    $('out').innerHTML = h;
  }
  function tr(l, v) { return '<tr><td>' + esc(l) + '</td><td>' + E(v) + '</td></tr>'; }
  function addMonths(iso, m) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); }

  // ---------- Pro ----------
  function setPro(on) {
    pro = !!on; doc.body.classList.toggle('is-pro', pro);
    $('keymsg').textContent = pro ? ' — Guardar y continuar: https://getreadystack.com/es/apps/plantilla-contabilidad-excel-etsy/' : '';
    if (pro) $('proline').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/plantilla-contabilidad-excel-etsy/';
    hist();
  }
  function check(k) {
    k = String(k || '').trim(); if (!k) return Promise.resolve(false);
    var i = 0;
    function next() {
      if (i >= DOORS.length) return Promise.resolve(false);
      var door = DOORS[i++];
      return fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
        .then(function (j) { return j && j.ok ? true : next(); }, function () { return next(); });
    }
    return next().then(function (ok) { if (ok) { jset(K_KEY, k); setPro(true); } else $('keymsg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/plantilla-contabilidad-excel-etsy/'; return ok; });
  }
  function need() { if (pro) return true; $('promsg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/plantilla-contabilidad-excel-etsy/'; location.hash = '#pro'; return false; }
  function msg(t) { $('promsg').textContent = t; }
  function dl(name, data, type) {
    var b = data instanceof Uint8Array ? new Blob([data], { type: type }) : new Blob([data], { type: type });
    var a = doc.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function fname(ext) { return 'contabilidad-etsy-' + cur.anio + '-T' + cur.trim + '.' + ext; }
  function xlsx() { if (!need()) return; var b = X.build(X.workbook(st, cur)); dl(fname('xlsx'), b, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg('Excel descargado: ' + fname('xlsx') + '.'); }
  function icsFile(anio) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//plantilla contabilidad Excel//ES', 'CALSCALE:GREGORIAN'];
    [1, 2, 3, 4].forEach(function (t) {
      var p = C.plazo(anio, t), d = p.replace(/-/g, ''), a = new Date(p + 'T00:00:00Z'); a.setUTCDate(a.getUTCDate() - 5);
      var w = a.toISOString().slice(0, 10).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:pce-' + anio + '-T' + t + '@plantilla-contabilidad-excel', 'DTSTAMP:' + w + 'T080000Z', 'DTSTART;VALUE=DATE:' + w, 'SUMMARY:Modelo 130 y 303 del ' + t + '.º trimestre ' + anio + ': plazo hasta el ' + fd(p),
        'DESCRIPTION:Cierra el trimestre en la plantilla y presenta el 130 y el 303 antes del ' + fd(p) + '.', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:130 y 303', 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n') + '\r\n';
  }
  function ics() { if (!need()) return; dl('plazos-130-303-' + cur.anio + '.ics', icsFile(cur.anio), 'text/calendar'); msg('Avisos .ics de los 4 plazos de ' + cur.anio + ' descargados (5 días antes de cada uno).'); }
  function closeQ() {
    if (!need()) return;
    var H = jget(K_HIST, []), r = cur;
    H = H.filter(function (x) { return !(x.anio === r.anio && x.trim === r.trim); });
    H.push({ anio: r.anio, trim: r.trim, cobrado: r.cobrado, fees: r.fees, ingresos: r.ingresos, gastosQ: r.gastosQ + r.gdj, pago130: r.pago130, iva303: r.iva303, caja: r.caja, c01: r.c01, c02: r.c02, c05: r.c05, c07: r.c07 });
    jset(K_HIST, H);
    var n = clone(st);
    if (r.trim === 4) { n.anio = String(r.anio + 1); n.trim = '1'; n.prev01 = '0'; n.prev02 = '0'; n.prev05 = '0'; }
    else { n.trim = String(r.trim + 1); n.prev01 = String(r.c01); n.prev02 = String(r.c02); n.prev05 = String(C.r2(r.c05 + Math.max(0, r.c07))); }
    n.pedidos = []; n.gastos = [];
    fill(n); render(); hist(); msg('Trimestre ' + r.trim + ' de ' + r.anio + ' cerrado. Casillas 01, 02 y 05 ya rellenas para el siguiente.');
  }
  function hist() {
    var H = jget(K_HIST, []);
    if (!pro || !H.length) { $('hist').innerHTML = ''; return; }
    var years = {};
    H.forEach(function (x) { (years[x.anio] = years[x.anio] || []).push(x); });
    $('hist').innerHTML = Object.keys(years).sort().map(function (y) {
      var rows = years[y].sort(function (a, b) { return a.trim - b.trim; }), s = function (k) { return rows.reduce(function (a, x) { return a + x[k]; }, 0); };
      return '<h3>Año ' + y + '</h3><table class="t"><thead><tr><th>Trim.</th><th>Cobrado</th><th>Etsy</th><th>130</th><th>303</th><th>Te queda</th></tr></thead><tbody>' +
        rows.map(function (x) { return '<tr><td>' + x.trim + '.º</td><td>' + E(x.cobrado) + '</td><td>' + E(x.fees) + '</td><td>' + E(x.pago130) + '</td><td>' + E(x.iva303) + '</td><td>' + E(x.caja) + '</td></tr>'; }).join('') +
        '<tr class="tot"><td>Año</td><td>' + E(s('cobrado')) + '</td><td>' + E(s('fees')) + '</td><td>' + E(s('pago130')) + '</td><td>' + E(s('iva303')) + '</td><td>' + E(s('caja')) + '</td></tr></tbody></table>';
    }).join('');
  }
  function printIt() {
    if (!need()) return;
    var p = $('print'); p.hidden = false;
    p.innerHTML = '<h2>Resumen del ' + cur.trim + '.º trimestre de ' + cur.anio + ' para tu gestor</h2>' + $('out').innerHTML +
      '<h3>Pedidos</h3><table class="t"><thead><tr><th>Fecha</th><th>Producto</th><th>Total</th><th>Etsy</th><th>IVA</th><th>Destino</th></tr></thead><tbody>' +
      cur.pedidos.map(function (x) { return '<tr><td>' + fd(x.fecha) + '</td><td>' + esc(x.prod) + '</td><td>' + E(x.tot) + '</td><td>' + E(x.fees) + '</td><td>' + E(x.ivaRep) + '</td><td>' + x.dest + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h3>Gastos</h3><table class="t"><thead><tr><th>Fecha</th><th>Concepto</th><th>Total</th><th>Base</th><th>IVA</th></tr></thead><tbody>' +
      cur.gastos.map(function (x) { return '<tr><td>' + fd(x.fecha) + '</td><td>' + esc(x.concepto) + '</td><td>' + E(x.total) + '</td><td>' + E(x.base) + '</td><td>' + E(x.cuota) + '</td></tr>'; }).join('') + '</tbody></table>';
    doc.body.classList.add('printing'); window.print(); setTimeout(function () { doc.body.classList.remove('printing'); p.hidden = true; }, 800);
  }
  function importCsv(file) {
    if (!need()) return;
    var fr = new FileReader();
    fr.onload = function () {
      var r = C.importEtsy(fr.result);
      if (!r.ok) { msg('No se pudo leer: ' + r.why + '.'); return; }
      var s = read(), q = +s.trim, y = s.anio;
      var inQ = r.pedidos.filter(function (p) { return p.fecha.slice(0, 4) === String(y) && C.trimOf(p.fecha) === q; });
      s.pedidos = s.pedidos.filter(function (p) { return C.num(p.imp) + C.num(p.env) > 0; }).concat(inQ);
      fill(s); render(); msg(inQ.length + ' filas del CSV de Etsy importadas al ' + q + '.º trimestre de ' + y + ' (de ' + r.pedidos.length + '). Rellena materiales, envío pagado y Offsite Ads si aplica.');
    };
    fr.readAsText(file);
  }

  // ---------- eventos ----------
  doc.addEventListener('input', function (e) { if (e.target.closest('#inputs')) render(); });
  doc.addEventListener('change', function (e) { if (e.target.closest('#inputs')) render(); });
  doc.addEventListener('click', function (e) { if (e.target.classList.contains('x')) { e.target.parentNode.remove(); render(); } });
  $('addped').onclick = function () { $('peds').insertAdjacentHTML('beforeend', pedRow({})); };
  $('addgas').onclick = function () { $('gass').insertAdjacentHTML('beforeend', gasRow({})); };
  $('demo').onclick = function () { fill(EJEMPLO); render(); };
  $('mine').onclick = function () {
    var s = clone(EJEMPLO); s.pedidos = [{}, {}, {}]; s.gastos = [{}, {}]; s.prev01 = '0'; s.prev02 = '0'; s.prev05 = '0';
    fill(s); render(); var f = doc.querySelector('#peds .p-fecha'); if (f) f.focus();
  };
  $('unlock').onclick = function () { check($('key').value); };
  $('xlsx').onclick = xlsx; $('ics').onclick = ics; $('close').onclick = closeQ; $('print1').onclick = printIt;
  $('backup').onclick = function () { if (!need()) return; dl('contabilidad-etsy-copia.json', JSON.stringify({ draft: read(), hist: jget(K_HIST, []) }), 'application/json'); };
  $('restore').onchange = function (e) {
    if (!need() || !e.target.files[0]) return; var fr = new FileReader();
    fr.onload = function () { try { var j = JSON.parse(fr.result); if (j.hist) jset(K_HIST, j.hist); if (j.draft) fill(j.draft); render(); hist(); msg('Copia abierta.'); } catch (x) { msg('Ese archivo no es una copia de esta plantilla.'); } };
    fr.readAsText(e.target.files[0]);
  };
  $('csvin').onchange = function (e) { if (e.target.files[0]) importCsv(e.target.files[0]); e.target.value = ''; };

  // ---------- inicio ----------
  fill(jget(K_DRAFT, null) || EJEMPLO); render();
  var hk = (location.hash.match(/k=([^&]+)/) || [])[1];
  var saved = jget(K_KEY, '');
  if (hk) check(decodeURIComponent(hk)); else if (saved) check(saved);
  window.__pce = { compute: function () { return cur; }, ics: icsFile, workbook: function () { return X.build(X.workbook(st, cur)); } };
})();
