(function () {
  'use strict';
  var E = window.DO, SLUG = 'dropshipping-organico-pruebas-videos-margen', DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  var LS = { cur: 'dso.current', book: 'dso.book', key: 'dso.key' };
  var pro = false, last = null;
  var fields = [].slice.call(document.querySelectorAll('[data-k]'));
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function read() { var v = {}; fields.forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  function fill(v) { fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (v && v[k] != null) el.value = v[k]; }); }

  function render() {
    var v = read(), R = E.compute(v);
    $('#o-title').innerHTML = E.esc(R.s.shop) + ', a <span class="nw">' + E.iso(R.s.today) + '</span>';
    $('#o-tiles').innerHTML = E.tilesHTML(R);
    $('#o-rows').innerHTML = E.rowsHTML(R) || '<tr><td colspan="7">Escribe al menos un producto.</td></tr>';
    $('#o-flags').innerHTML = E.flagsHTML(R) || '<li>Nada pendiente.</li>';
    $('#o-summary').textContent = E.summary(R);
    put(LS.cur, v);
    last = R;
    if (pro) drawBook();
    return R;
  }

  var NAMES = { save: 'el registro semana a semana de tus pruebas', orders: 'los pedidos contados desde el export de Shopify (CSV)', vidin: 'la importación de vídeos (CSV)',
    ics: 'el plan de publicación de 7 días y los cierres de prueba en tu calendario (.ics)', pdf: 'el informe de la prueba para imprimir o guardar en PDF',
    csv: 'la exportación de resultados (CSV)', csvv: 'la exportación de vídeos (CSV)', backup: 'la copia de seguridad del registro', restore: 'cargar una copia de seguridad' };
  function locked(what) {
    var m = $('#pro-msg'); m.hidden = false;
    m.innerHTML = 'Este botón abre ' + E.esc(NAMES[what] || ' — Guardar y continuar: https://getreadystack.com/es/apps/dropshipping-organico-pruebas-videos-margen/') + '' + SLUG + ' — Guardar y continuar: https://getreadystack.com/es/apps/dropshipping-organico-pruebas-videos-margen/';
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function ok(msg) { var o = $('#pro-ok'); o.hidden = false; o.textContent = msg; }
  function download(name, body, type) {
    var b = new Blob([body], { type: type || 'text/plain;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function fname(ext) { return 'dropshipping-organico-' + E.iso(last.s.today) + '.' + ext; }
  function readFile(input, cb) { var f = input.files && input.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { cb(String(r.result)); input.value = ''; }; r.readAsText(f, 'utf-8'); }

  function drawBook() {
    var B = get(LS.book, []), box = $('#book'), tb = $('#book-rows');
    box.hidden = !B.length; tb.innerHTML = '';
    B.forEach(function (b, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + E.esc(b.at) + '</td><td>' + E.esc(b.v.tienda) + '</td><td>' + b.orders + '</td><td>' + E.esc(b.profit) + '</td><td>' + E.esc(b.scale) + '</td>' +
        '<td><button type="button" class="btn2" data-open="' + i + '">Abrir</button> <button type="button" class="btn2" data-del="' + i + '">Borrar</button></td>';
      tb.appendChild(tr);
    });
  }
  function saveBook() {
    var R = render(), B = get(LS.book, []), v = read();
    var key = (v.tienda || '') + '|' + E.iso(R.s.today);
    B = B.filter(function (b) { return b.key !== key; });
    B.unshift({ key: key, at: E.iso(R.s.today), v: v, orders: R.tot.orders, profit: E.eur(R.tot.profit), scale: R.scale.map(function (p) { return p.name; }).join(', ') || '—' });
    put(LS.book, B); drawBook(); ok('Guardado en el registro: ' + (v.tienda || '') + ', ' + E.iso(R.s.today) + '.');
  }

  function printReport() {
    var R = render(), h = '<h1>' + E.esc(R.s.shop) + ' · ' + E.iso(R.s.today) + '</h1>';
    h += '<p>' + E.esc(E.summary(R)) + '</p><table><thead><tr><th>Producto</th><th>Vídeos</th><th>Clics</th><th>Pedidos</th><th>Margen por pedido</th><th>Beneficio</th><th>Decisión</th></tr></thead><tbody>' + E.rowsHTML(R) + '</tbody></table>';
    h += '<h2>Qué hacer ahora</h2><ul>' + E.flagsHTML(R) + '</ul>';
    h += '<h2>Ganchos por clics por 1.000 visualizaciones</h2><table><thead><tr><th>Gancho</th><th>Producto</th><th>Plataforma</th><th>Visualizaciones</th><th>Clics por 1.000</th></tr></thead><tbody>' +
      R.hooks.map(function (k) { return '<tr><td>' + E.esc(k.hook) + '</td><td>' + E.esc(k.product) + '</td><td>' + E.esc(k.platform) + '</td><td>' + E.int(k.views) + '</td><td>' + (k.per1k).toFixed(1).replace('.', ',') + '</td></tr>'; }).join('') + '</tbody></table>';
    var B = get(LS.book, []);
    if (B.length) h += '<h2>Registro</h2><table><thead><tr><th>Guardado</th><th>Prueba</th><th>Pedidos</th><th>Beneficio</th><th>Escalar</th></tr></thead><tbody>' + B.map(function (b) { return '<tr><td>' + E.esc(b.at) + '</td><td>' + E.esc(b.v.tienda) + '</td><td>' + b.orders + '</td><td>' + E.esc(b.profit) + '</td><td>' + E.esc(b.scale) + '</td></tr>'; }).join('') + '</tbody></table>';
    $('#print-report').innerHTML = h;
    window.print();
  }

  var ACT = {
    save: saveBook,
    ics: function () { var R = render(), c = E.icsPlan(R, { days: 7, hours: $('#hours').value }); download(fname('ics'), c.text, 'text/calendar;charset=utf-8'); ok(c.n + ' citas en el calendario: vídeos de los próximos 7 días y cierres de prueba.'); },
    pdf: printReport,
    csv: function () { download(fname('csv'), E.csvResults(render()), 'text/csv;charset=utf-8'); },
    csvv: function () { download('videos-' + fname('csv'), E.csvVideos(render()), 'text/csv;charset=utf-8'); },
    backup: function () { download('copia-' + fname('json'), JSON.stringify({ app: SLUG, current: read(), book: get(LS.book, []) }, null, 1), 'application/json'); }
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-pro]');
    if (t && t.tagName === 'BUTTON') { if (!pro) { locked(t.getAttribute('data-pro')); return; } ACT[t.getAttribute('data-pro')](); }
    var lb = e.target.closest('label.btn2');
    if (lb && !pro) { var inp = lb.querySelector('input[type=file]'); if (inp) { e.preventDefault(); locked(inp.getAttribute('data-pro')); } }
    var o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
    if (o) { var b = get(LS.book, [])[+o.getAttribute('data-open')]; if (b) { fill(b.v); render(); window.scrollTo(0, 0); } }
    if (d) { var B = get(LS.book, []); B.splice(+d.getAttribute('data-del'), 1); put(LS.book, B); drawBook(); }
  });
  $('#orders-in').addEventListener('change', function () {
    readFile(this, function (txt) {
      var el = document.querySelector('[data-k=productos]'), r = E.importOrders(txt, el.value);
      if (r.error) { ok('No se pudo leer: ' + r.error); return; }
      el.value = r.text; render();
      ok(r.rows + ' líneas de pedido contadas. ' + Object.keys(r.counts).map(function (k) { return k + ': ' + r.counts[k]; }).join(' · ') + (r.unmatched.length ? '. Sin producto en tu lista: ' + r.unmatched.join(', ') : ''));
    });
  });
  $('#videos-in').addEventListener('change', function () {
    readFile(this, function (txt) {
      var el = document.querySelector('[data-k=videos]'), r = E.importVideos(txt, 'TikTok');
      if (r.error) { ok('No se pudo leer: ' + r.error); return; }
      el.value = (el.value.trim() ? el.value.trim() + '\n' : '') + r.lines.join('\n'); render();
      ok(r.n + ' vídeos añadidos. Si falta el producto en alguna línea, escríbelo después de la fecha.');
    });
  });
  $('#restore-in').addEventListener('change', function () {
    readFile(this, function (txt) {
      try { var j = JSON.parse(txt); if (j.book) put(LS.book, j.book); if (j.current) fill(j.current); render(); ok('Copia cargada.'); } catch (e) { ok('El archivo no es una copia de esta página.'); }
    });
  });


  function setPro(on) { pro = !!on; document.body.classList.toggle('is-pro', pro); if (pro) { $('#pro-msg').hidden = true; $('#key-msg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/dropshipping-organico-pruebas-videos-margen/'; drawBook(); } }
  function unlock(k) {
    k = String(k || '').trim(); if (!k) return;
    $('#key-msg').textContent = 'Comprobando…';
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { $('#key-msg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/dropshipping-organico-pruebas-videos-margen/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); } else next();
      }).catch(next);
    })();
  }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  function fromHash() { var h = /[#&]k=([^&]+)/.exec(location.hash); if (h) { var k = decodeURIComponent(h[1]); $('#key').value = k; unlock(k); } }
  window.addEventListener('hashchange', fromHash);

  $('#copy').addEventListener('click', function () {
    var t = $('#o-summary').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $('#copy-msg').textContent = 'Copiado.'; }, function () { $('#copy-msg').textContent = 'Selecciona el texto y cópialo.'; });
  });
  $('#clear').addEventListener('click', function () {
    document.querySelector('[data-k=productos]').value = 'Mi producto; 24,90; 7,00; 4,00; ' + new Date().toISOString().slice(0, 10) + '; 0; 0';
    document.querySelector('[data-k=videos]').value = '';
    document.querySelector('[data-k=tienda]').value = 'Mi tienda';
    render(); document.querySelector('[data-k=productos]').focus();
  });
  var tmr; document.getElementById('f').addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(render, 150); });

  var saved = get(LS.cur, null); if (saved && saved.productos) fill(saved);
  render();
  var k0 = get(LS.key, ''); if (k0) unlock(k0);
  fromHash();
})();
