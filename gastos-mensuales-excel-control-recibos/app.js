(function () {
  'use strict';
  var E = window.GR, X = window.XLSX_MINI, SLUG = 'gastos-mensuales-excel-control-recibos', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var LS = { cur: 'gr.current', profs: 'gr.profiles', hist: 'gr.history', key: 'gr.key' };
  var pro = false, last = null;
  var fields = [].slice.call(document.querySelectorAll('[data-k]'));
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function read() { var v = {}; fields.forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  function fill(v) { fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (v[k] != null) el.value = v[k]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // the date input may carry stray characters; keep only a real YYYY-MM-DD
  function cleanDate(s) { var m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : today(); }

  function render() {
    var v = read(); v.hoy = cleanDate(v.hoy);
    var r = E.check(v); last = r;
    $('#o-title').textContent = 'Recibos de ' + E.mesNombre(r.cfg);
    $('#o-tiles').innerHTML = E.tilesHtml(r);
    $('#o-rows').innerHTML = E.rowsHtml(r);
    $('#o-summary').textContent = E.summary(r);
    put(LS.cur, read());
    if (pro) drawYear();
  }

  // ---- Pro ----
  var NAMES = { 'save-month': 'el historial de 12 meses de tus recibos', 'xlsx-out': 'el Excel (.xlsx) con 4 hojas', 'ics-out': 'el calendario .ics con aviso antes de que acaben las 8 semanas',
    print: 'el informe para imprimir o guardar en PDF', csv: 'la importación del CSV de tu banco', prof: 'varios hogares o cuentas guardados' };
  function locked(what) {
    var m = $('#pro-msg'); m.hidden = false;
    m.innerHTML = 'Ese botón abre ' + E.esc(NAMES[what] || ' — Guardar y continuar: https://getreadystack.com/es/apps/gastos-mensuales-excel-control-recibos/') + '' + SLUG + ' — Guardar y continuar: https://getreadystack.com/es/apps/gastos-mensuales-excel-control-recibos/';
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
  function hist() { return get(LS.hist, {}); }
  function yearData() {
    var h = hist(), ks = Object.keys(h).sort().slice(-12), hh = {};
    ks.forEach(function (k) { hh[k] = h[k]; });
    var v = read(); v.hoy = cleanDate(v.hoy);
    return E.year(v, hh);
  }
  function drawYear() {
    var y = yearData();
    if (!y.meses.length) { $('#y-title').textContent = 'Historial: aún no hay meses guardados. Pega los cargos de un mes y pulsa «Guardar este mes en el historial».'; $('#y-head').innerHTML = ''; $('#y-rows').innerHTML = ''; return y; }
    $('#y-title').textContent = 'Historial de ' + y.meses.length + (y.meses.length === 1 ? ' mes' : ' meses') + ' (' + y.meses[0] + ' a ' + y.meses[y.meses.length - 1] + '): recibos ' + E.eur(y.recibosTotal) + ' · total salido ' + E.eur(y.total) + ' · a revisar ' + E.eur(y.revisar);
    $('#y-head').innerHTML = '<tr><th>Recibo</th>' + y.meses.map(function (m) { return '<th>' + m + '</th>'; }).join('') + '<th>Total</th><th>Cambio</th></tr>';
    $('#y-rows').innerHTML = y.porRecibo.map(function (p) {
      return '<tr class="' + (p.cambio > 0 ? 'neg' : '') + '"><td class="sc"><b>' + E.esc(p.rc.name) + '</b></td>' + p.serie.map(function (x) { return '<td class="nm">' + (x == null ? '—' : E.eur(x)) + '</td>'; }).join('') +
        '<td class="nm">' + E.eur(p.total) + '</td><td class="nm' + (p.cambio > 0 ? ' bad' : '') + '">' + (p.cambio > 0 ? '+' : '') + E.eur(p.cambio) + '</td></tr>';
    }).join('');
    return y;
  }
  function drawProfiles() {
    var ps = get(LS.profs, []);
    $('#prof').innerHTML = '<option value="">— elige —</option>' + ps.map(function (p, i) { return '<option value="' + i + '">' + E.esc(p.name) + '</option>'; }).join('');
  }
  function setPro(on) {
    pro = on; document.body.classList.toggle('is-pro', on);
    $('#pro').classList.toggle('open', on);
    if (on) { $('#pro-msg').hidden = true; drawProfiles(); drawYear(); }
  }

  gate('save-month', function () {
    var v = read(), h = hist(); h[v.mes] = v.cargos; put(LS.hist, h); drawYear();
    $('#y-title').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  gate('xlsx-out', function () {
    var y = yearData(), bin = X.build(E.sheets(read(), last, y));
    download('gastos-mensuales-recibos-' + last.cfg.y + '-' + pad(last.cfg.m) + '.xlsx', bin, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
  gate('ics-out', function () {
    var d = Math.max(0, Math.min(14, parseInt($('#ics-days').value, 10) || 0)), now = new Date();
    var st = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T000000Z';
    download('recibos-plazos-' + today() + '.ics', E.ics(last, d, st).text, 'text/calendar;charset=utf-8');
  });
  gate('print', function () {
    var r = last;
    $('#print-cal').innerHTML = '<h1>Recibos de ' + E.esc(E.mesNombre(r.cfg)) + '</h1><p>Impreso ' + today() + ' · a revisar ' + E.eur(r.revisar) + ' · subidas al año ' + E.eur(r.anual) + '</p>' +
      '<table class="res"><thead><tr><th>Recibo</th><th>Esperado</th><th>Cobrado</th><th>Qué pasa</th><th>Devolver hasta</th></tr></thead><tbody>' + E.rowsHtml(r) + '</tbody></table><p>' + E.esc(E.summary(r)) + '</p>' +
      '<p>Plazos: 8 semanas desde el cargo (art. 49.1 RDL 19/2018) · 13 meses si no lo autorizaste (art. 43.1).</p>';
    window.print();
  });
  gate('csv');
  $('#csv').addEventListener('change', function () {
    var inp = this, f = inp.files && inp.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var t = E.csvToCargos(String(fr.result)); inp.value = '';
      if (!t) { $('#imp-msg').textContent = 'No encuentro filas con fecha, concepto e importe.'; return; }
      $('[data-k="cargos"]').value = t; render(); $('#imp-msg').textContent = 'Importados ' + t.split('\n').length + ' movimientos.';
    };
    fr.readAsText(f);
  });
  $('#prof').addEventListener('change', function () { var ps = get(LS.profs, []), p = ps[+this.value]; if (p) { fill(p.v); if (p.hist) put(LS.hist, p.hist); render(); } });
  $('#prof-save').addEventListener('click', function () {
    if (!pro) return locked('prof');
    var n = $('#prof-new').value.trim() || 'Hogar ' + (get(LS.profs, []).length + 1), ps = get(LS.profs, []);
    var i = ps.map(function (p) { return p.name; }).indexOf(n);
    if (i > -1) { ps[i].v = read(); ps[i].hist = hist(); } else ps.push({ name: n, v: read(), hist: hist() });
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
      if (i >= DOORS.length) { if (!quiet) $('#key-msg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/gastos-mensuales-excel-control-recibos/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/gastos-mensuales-excel-control-recibos/'; }
        else next();
      }).catch(function () { if (!quiet) $('#key-msg').textContent = 'No se pudo comprobar la clave ahora. Inténtalo en un minuto.'; });
    })();
  }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });

  fields.forEach(function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });
  $('#reset').addEventListener('click', function () { fill(E.DEFAULTS); render(); });
  $('#clear').addEventListener('click', function () {
    $('[data-k="cargos"]').value = '';
    var d = new Date(), m = d.getMonth(), y = d.getFullYear(); if (m < 1) { m = 12; y--; }
    $('[data-k="mes"]').value = y + '-' + pad(m);
    $('[data-k="hoy"]').value = today();
    render(); $('[data-k="cargos"]').focus();
  });

  // start: saved data, then #k= from /thanks/, then stored key
  var saved = get(LS.cur, null); if (saved && saved.recibos) { fill(saved); $('[data-k="hoy"]').value = today(); }
  render();
  var hk = (location.hash.match(/[#&]k=([^&]+)/) || [])[1];
  if (hk) { unlock(decodeURIComponent(hk)); history.replaceState(null, '', location.pathname + location.search); }
  else if (get(LS.key, null)) unlock(get(LS.key, null), true);
})();
