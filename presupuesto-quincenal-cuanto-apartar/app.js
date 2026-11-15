(function () {
  'use strict';
  var E = window.PQ, SLUG = 'presupuesto-quincenal-cuanto-apartar', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var LS = { cur: 'pq.current', profs: 'pq.profiles', real: 'pq.real', key: 'pq.key' };
  var pro = false, last = null, yearOn = false;
  var fields = [].slice.call(document.querySelectorAll('[data-k]'));
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function read() { var v = {}; fields.forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  function fill(v) { fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (v[k] != null) el.value = v[k]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function M(x) { return E.money(x, last ? last.cfg.moneda : 'MXN'); }

  function render() {
    var v = read(), r = E.plan(v, 1);
    last = r;
    $('#o-title').textContent = 'Presupuesto quincenal de ' + E.MESES_L[r.cfg.m - 1] + ' ' + r.cfg.y + (r.cfg.frecuencia === 'quincenal' ? '' : ' (' + r.cfg.frecuencia + ')');
    $('#o-tiles').innerHTML = E.tilesHtml(r);
    $('#o-rows').innerHTML = E.rowsHtml(r);
    $('#o-summary').textContent = E.summary(r);
    put(LS.cur, v);
    if (pro) { drawReal(); if (yearOn) drawYear(); }
  }

  // ---- Pro ----
  var NAMES = { year: 'los 12 meses seguidos con arrastre de lo apartado', 'csv-out': 'la exportación CSV del año', 'ics-out': 'el calendario .ics con aviso antes de cada vencimiento',
    print: 'el calendario de pagos para imprimir o guardar en PDF', csv: 'la importación de pagos fijos desde CSV', prof: 'varios presupuestos guardados', real: 'el registro de lo que pagaste de verdad' };
  function locked(what) {
    var m = $('#pro-msg'); m.hidden = false;
    m.innerHTML = 'Ese botón abre ' + E.esc(NAMES[what] || ' — Guardar y continuar: https://getreadystack.com/es/apps/presupuesto-quincenal-cuanto-apartar/') + '' + SLUG + ' — Guardar y continuar: https://getreadystack.com/es/apps/presupuesto-quincenal-cuanto-apartar/';
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function download(name, body, type) {
    var b = new Blob([body], { type: type || 'text/plain;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function gate(id, fn) {
    var el = document.getElementById(id);
    el.addEventListener('click', function (ev) { if (!pro) { ev.preventDefault(); locked(id); return; } if (fn && el.type !== 'file') fn(ev); });
  }
  function drawYear() {
    var y = E.plan(read(), 12), c = y.cfg;
    $('#y-title').textContent = '12 meses desde ' + E.MESES_L[c.m - 1] + ' ' + c.y + ': ' + y.periods.length + ' pagos · libre en total ' + E.money(y.totals.libre, c.moneda) +
      (y.colchon ? ' · colchón que falta ' + E.money(y.colchon, c.moneda) : '') + (y.extraMeses.length ? ' · meses con un pago de más: ' + y.extraMeses.join(', ') : '');
    $('#y-rows').innerHTML = y.periods.map(function (p) {
      return '<tr class="' + (p.naive < 0 ? 'neg' : '') + '"><td class="sc"><b>' + E.esc(E.nombrePago(p, c)) + ' ' + E.iso(p.pay).slice(0, 4) + '</b><small>' + E.esc(p.bills.map(function (b) { return b.name; }).join(', ')) + '</small></td>' +
        '<td class="nm">' + E.money(p.income, c.moneda) + '</td><td class="nm">' + E.money(p.billsTotal, c.moneda) + '</td><td class="nm' + (p.naive < 0 ? ' bad' : '') + '">' + E.money(p.naive, c.moneda) + '</td>' +
        '<td class="nm">' + (p.aparta ? 'aparta ' + E.money(p.aparta, c.moneda) : p.usa ? 'usa ' + E.money(p.usa, c.moneda) : '') + (p.falta ? '<br><b class="bad">falta ' + E.money(p.falta, c.moneda) + '</b>' : '') + '</td>' +
        '<td class="nm">' + E.money(p.libre, c.moneda) + '</td><td class="nm">' + E.money(p.saldoFin, c.moneda) + '</td></tr>';
    }).join('');
    return y;
  }
  function realKey() { var c = last.cfg; return c.y + '-' + c.m; }
  function drawReal() {
    var all = get(LS.real, {}), real = all[realKey()] || {}, cmp = E.compareReal(last, real), c = last.cfg;
    $('#r-rows').innerHTML = last.periods.map(function (p, i) {
      var k = E.iso(p.pay), got = real[k] || {};
      var ins = p.bills.map(function (b) { return '<label class="inline">' + E.esc(b.name) + ' <input data-p="' + k + '" data-b="' + E.esc(b.name) + '" inputmode="decimal" placeholder="' + b.amount + '" value="' + (got[b.name] == null ? '' : E.esc(got[b.name])) + '"></label>'; }).join(' ');
      ins += ' <label class="inline">variable <input data-p="' + k + '" data-b="__variable" inputmode="decimal" placeholder="' + p.variable + '" value="' + (got.__variable == null ? '' : E.esc(got.__variable)) + '"></label>';
      var d = cmp[i];
      return '<tr><td class="sc"><b>' + E.esc(d.pago) + '</b>' + (d.pendientes.length ? '<small>pendiente: ' + E.esc(d.pendientes.join(', ')) + '</small>' : '<small>todo pagado</small>') + '</td><td>' + ins + '</td>' +
        '<td class="nm">' + E.money(d.plan, c.moneda) + '</td><td class="nm">' + E.money(d.real, c.moneda) + '</td><td class="nm' + (d.diferencia > 0 ? ' bad' : '') + '">' + (d.diferencia > 0 ? '+' : '') + E.money(d.diferencia, c.moneda) + '</td></tr>';
    }).join('');
    [].forEach.call(document.querySelectorAll('#r-rows input'), function (el) {
      el.addEventListener('change', function () {
        var all = get(LS.real, {}), rk = realKey(), real = all[rk] || {}, pk = el.getAttribute('data-p'), bk = el.getAttribute('data-b');
        real[pk] = real[pk] || {};
        if (el.value.trim() === '') delete real[pk][bk]; else real[pk][bk] = el.value.trim();
        all[rk] = real; put(LS.real, all); drawReal();
      });
    });
  }
  function drawProfiles() {
    var ps = get(LS.profs, []);
    $('#prof').innerHTML = '<option value="">— elige —</option>' + ps.map(function (p, i) { return '<option value="' + i + '">' + E.esc(p.name) + '</option>'; }).join('');
  }
  function setPro(on) {
    pro = on; document.body.classList.toggle('is-pro', on);
    $('#pro').classList.toggle('open', on);
    if (on) { $('#pro-msg').hidden = true; drawProfiles(); drawReal(); }
  }

  gate('year', function () { yearOn = true; drawYear(); $('#y-title').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  gate('csv-out', function () { var y = E.plan(read(), 12); download('presupuesto-quincenal-12-meses-' + today() + '.csv', E.toCSV(y), 'text/csv;charset=utf-8'); });
  gate('ics-out', function () { var y = E.plan(read(), 12), d = Math.max(0, Math.min(7, parseInt($('#ics-days').value, 10) || 0)); download('presupuesto-quincenal-calendario-' + today() + '.ics', E.ics(y, d).text, 'text/calendar;charset=utf-8'); });
  gate('print', function () {
    var y = drawYear(), c = y.cfg;
    $('#print-cal').innerHTML = '<h1>Calendario de pagos · presupuesto quincenal</h1><p>12 meses desde ' + E.MESES_L[c.m - 1] + ' ' + c.y + ' · impreso ' + today() + '</p>' +
      '<table class="res"><thead><tr><th>Pago</th><th>Pagos fijos que cubre</th><th>Entra</th><th>Aparta / usa</th><th>Libre</th></tr></thead><tbody>' +
      y.periods.map(function (p) {
        return '<tr><td>' + E.esc(E.largo(p.pay)) + '</td><td>' + p.bills.map(function (b) { return E.esc(b.name) + ' (' + E.corto(b.date) + ') ' + E.money(b.amount, c.moneda); }).join('<br>') + '</td><td>' + E.money(p.income, c.moneda) + '</td><td>' +
          (p.aparta ? 'aparta ' + E.money(p.aparta, c.moneda) : p.usa ? 'usa ' + E.money(p.usa, c.moneda) : '') + (p.falta ? ' · falta ' + E.money(p.falta, c.moneda) : '') + '</td><td>' + E.money(p.libre, c.moneda) + '</td></tr>';
      }).join('') + '</tbody></table>';
    window.print();
  });
  gate('csv');
  $('#csv').addEventListener('change', function () {
    var inp = this, f = inp.files && inp.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var t = E.csvToBills(String(fr.result)); inp.value = '';
      if (!t) { $('#imp-msg').textContent = 'No encuentro filas con nombre, día y monto.'; return; }
      $('[data-k="pagos"]').value = t; render(); $('#imp-msg').textContent = 'Importados ' + t.split('\n').length + ' pagos fijos.';
    };
    fr.readAsText(f);
  });
  $('#prof').addEventListener('change', function () { var ps = get(LS.profs, []), p = ps[+this.value]; if (p) { fill(p.v); render(); } });
  $('#prof-save').addEventListener('click', function () {
    if (!pro) return locked('prof');
    var n = $('#prof-new').value.trim() || 'Presupuesto ' + (get(LS.profs, []).length + 1), ps = get(LS.profs, []);
    var i = ps.map(function (p) { return p.name; }).indexOf(n);
    if (i > -1) ps[i].v = read(); else ps.push({ name: n, v: read() });
    put(LS.profs, ps); $('#prof-new').value = ''; drawProfiles();
  });
  $('#prof-del').addEventListener('click', function () {
    var ps = get(LS.profs, []), i = +$('#prof').value;
    if ($('#prof').value === '' || !ps[i]) return;
    if (confirm('¿Borrar «' + ps[i].name + '»?')) { ps.splice(i, 1); put(LS.profs, ps); drawProfiles(); }
  });

  $('#copy').addEventListener('click', function () {
    var t = $('#o-summary').textContent, done = function () { $('#copy-msg').textContent = 'Copiado.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () {});
    else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
  });

  function unlock(k, quiet) {
    k = String(k || '').trim(); if (!k) return;
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { if (!quiet) $('#key-msg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/presupuesto-quincenal-cuanto-apartar/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/presupuesto-quincenal-cuanto-apartar/'; }
        else next();
      }).catch(function () { if (!quiet) $('#key-msg').textContent = 'No se pudo comprobar la clave ahora. Inténtalo en un minuto.'; });
    })();
  }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });

  fields.forEach(function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });
  $('#reset').addEventListener('click', function () { fill(E.DEFAULTS); render(); });
  $('#clear').addEventListener('click', function () {
    $('[data-k="pagos"]').value = ''; $('[data-k="extras"]').value = ''; $('[data-k="saldo"]').value = '0';
    var d = new Date(), m = d.getMonth() + 2, y = d.getFullYear(); if (m > 12) { m = 1; y++; }
    $('[data-k="mes"]').value = y + '-' + ('0' + m).slice(-2);
    render(); $('[data-k="neto"]').focus();
  });
  var saved = get(LS.cur, null); if (saved) fill(saved);
  render();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { var k = decodeURIComponent(hk[1]); $('#key').value = k; unlock(k); history.replaceState(null, '', location.pathname + location.search); }
  else if (get(LS.key, '')) unlock(get(LS.key, ''), true);
})();
