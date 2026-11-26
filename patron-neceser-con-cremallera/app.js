/* app.js - lógica de la página del patrón de neceser con cremallera. El trazado está en pouch.js. */
(function () {
  'use strict';
  var P = window.Pouch;
  var SLUG = 'patron-neceser-con-cremallera';
  var DOORS = [SLUG, SLUG + '.once'];
  var KEY = 'patron_neceser_cremallera_key';
  var $ = function (id) { return document.getElementById(id); };
  var unlocked = false;
  var x = function (a, b) { return a + ' × ' + b; };
  var n1 = function (mm) { return (mm / 10).toFixed(1).replace('.', ','); };
  var n0 = function (mm) { return n1(mm).replace(',0', ''); };
  var m1 = function (v) { return v.toFixed(1).replace('.', ','); };

  function readForm() {
    var size = $('size').value;
    var o = { style: $('style').value, layer: $('layer').value, lining: $('lining').value === 'yes', tab: true };
    if (size === 'custom') { o.W = num($('cw').value) * 10; o.H = num($('ch').value) * 10; o.D = num($('cd').value) * 10; }
    else o.size = size;
    return { o: o, count: parseInt($('count').value, 10), width: parseFloat($('width').value) };
  }
  function num(v) { return parseFloat(String(v).replace(',', '.')); }
  function money(v) { return v.toFixed(2).replace('.', ','); }

  function render() {
    var f = readForm();
    if (!(f.count >= 1 && f.count <= 200)) { $('err').textContent = 'Escribe entre 1 y 200 neceseres.'; return null; }
    var d = P.draft(f.o);
    if (!d.valid) { $('err').textContent = 'Revisa las medidas: ancho de 6 a 50 cm, alto de 4 a 40 cm y fondo de 2 a 20 cm, nunca mayor que el ancho.'; return null; }
    $('err').textContent = '';
    var o = d.opt, boxed = o.style === 'boxed';
    $('r_cut').textContent = x(n1(d.cw), n1(d.ch) + ' cm');
    $('r_cut_in').textContent = 'medida de corte de la pieza, cortar 2 (' + x(P.inch(d.cw).replace(' pulg.', ''), P.inch(d.ch)) + ')';
    $('r_corner').textContent = boxed ? n1(d.corner) + ' cm' : 'sin recorte';
    $('r_corner_lab').textContent = boxed ? 'cuadrado que se recorta en las dos esquinas de abajo (' + P.inch(d.corner) + ')' : 'neceser plano: esquinas rectas, se recortan en diagonal al coser';
    $('r_zip').textContent = P.ZIPS_IN[d.zip];
    $('r_zip_lab').textContent = 'cremallera cerrada (' + P.ZIPS_INCH[d.zip] + '), o ' + n1(d.zipReel) + ' cm de cremallera por metros';
    var fb = P.fabric(d, f.count, f.width);
    var row = function (k) { return fb.rows.filter(function (r) { return r.k === k; })[0]; };
    var e = row('ext'), l = row('lin');
    $('r_ext').textContent = m1(e.m) + ' m';
    $('r_ext_lab').textContent = 'de tela exterior para ' + f.count + (f.count === 1 ? ' neceser' : ' neceseres') + ', de ' + (f.width / 10) + ' cm de ancho' + (o.layer === 'quilted' ? ' (bloques para acolchar)' : '');
    $('r_lin').textContent = l ? m1(l.m) + ' m' : 'sin forro';
    $('r_lin_lab').textContent = l ? 'de forro para ' + f.count + (f.count === 1 ? ' neceser' : ' neceseres') : 'neceser sin forro';
    $('r_fq').textContent = e.fq_pieces + (e.fq_pieces === 1 ? ' pieza' : ' piezas');
    $('r_fq_lab').textContent = 'por fat quarter de 45 × 55 cm (' + (e.fq_pieces >= 2 ? Math.floor(e.fq_pieces / 2) + (Math.floor(e.fq_pieces / 2) === 1 ? ' neceser' : ' neceseres') : 'no llega a un neceser') + ')';
    $('r_fin').textContent = boxed ? x(n0(d.finished.W), x(n0(d.finished.H), n0(d.finished.D) + ' cm')) : x(n0(d.finished.flatW), n0(d.finished.flatH) + ' cm');
    $('pieces').innerHTML = P.svg(d);
    $('chart').innerHTML = '<tr><th>Cortar</th><th>Pieza</th><th>Medida</th></tr>' + P.chart(d).map(function (r) {
      return '<tr><td>' + r.n + ' ×</td><td><b>' + r.piece + '</b></td><td>' + r.size.replace(/ x /g, ' × ') + '</td></tr><tr><td></td><td class="note" colspan="2">' + r.note.replace(/ x /g, ' × ') + '</td></tr>';
    }).join('');
    $('fabric').innerHTML = '<tr><th>Capa</th><th>Piezas</th><th>Comprar</th><th>Por fat quarter</th></tr>' + fb.rows.map(function (r) {
      return r.fits ? '<tr><td>' + r.label + '</td><td>' + r.pieces + '</td><td>' + m1(r.m) + ' m (' + String(r.yd).replace('.', ',') + ' yd)</td><td>' + r.fq_pieces + '</td></tr>' : '<tr><td>' + r.label + '</td><td colspan="3">más ancha que la tela</td></tr>';
    }).join('') + '<tr><td>Cremalleras</td><td>' + fb.zips + '</td><td>' + fb.zips + ' × ' + P.ZIPS_IN[d.zip] + ', o ' + (fb.reel_mm / 1000).toFixed(2).replace('.', ',') + ' m por metros + ' + fb.zips + (fb.zips === 1 ? ' cursor' : ' cursores') + '</td><td></td></tr>';
    $('checks').innerHTML = '<tr><th>Medido en la pieza dibujada</th><th>Debe ser</th><th>Es</th></tr>' + d.checks.map(function (c) {
      return '<tr><td>' + c.label + '</td><td>' + n1(c.want) + ' cm</td><td class="' + (Math.abs(c.want - c.got) < 0.05 ? 'ok' : 'bad') + '">' + n1(c.got) + ' cm</td></tr>';
    }).join('');
    var pr = { ext: num($('p_ext').value) || 0, lin: num($('p_lin').value) || 0, bat: num($('p_pad').value) || 0, fle: num($('p_pad').value) || 0, zip: num($('p_zip').value) || 0 };
    var c = P.cost(fb, pr);
    $('costout').innerHTML = c.parts.map(function (p) { return p.label + ' ' + (p.m != null ? m1(p.m) + ' m × ' + money(p.price) : p.n + ' × ' + money(p.price)) + ' = ' + money(p.total); }).join(' · ') +
      '<br><b>Total ' + money(c.total) + ' para ' + f.count + ', ' + money(c.per) + ' por neceser</b> (tela comprada por metros, redondeada hacia arriba a 10 cm)';
    window.__draft = d; window.__fabric = fb; window.__cost = c;
    return d;
  }

  function download(name, str) {
    var bytes = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 255;
    var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function tag(d) {
    var o = d.opt;
    return 'patron-neceser_' + (o.size === 'custom' ? 'medidas-' + Math.round(o.W / 10) + 'x' + Math.round(o.H / 10) + (o.style === 'boxed' ? 'x' + Math.round(o.D / 10) : '') : o.size) + '_' + (o.style === 'boxed' ? 'con-fondo' : 'plano');
  }
  var T = 'Patrón neceser con cremallera';
  var NAMES = { A4: 'PDF en A4', Letter: 'PDF en Carta', A0: 'A0 para copistería', projector: 'para proyector', chart: 'con la tabla de corte de todas las tallas', guide: 'de instrucciones' };
  function getFile(kind) {
    var d = render();
    if (!d) return;
    if (!unlocked) { $('paid').scrollIntoView({ behavior: 'smooth' }); $('paywhy').textContent = 'El archivo ' + (NAMES[kind] || kind) + ' forma parte del patrón de pago. Tus medidas se quedan en las casillas de arriba.'; return; }
    var all = [];
    ['boxed', 'flat'].forEach(function (st) { P.SIZES.forEach(function (s) { all.push(P.draft({ size: s.id, style: st, lining: d.opt.lining, tab: true })); }); });
    if (d.opt.size === 'custom') all = [d].concat(all);
    if (kind === 'A4') download(tag(d) + '_A4.pdf', P.homePdf(d, 'a4', T).pdf.bytes(T));
    if (kind === 'Letter') download(tag(d) + '_Carta.pdf', P.homePdf(d, 'letter', T).pdf.bytes(T));
    if (kind === 'A0') download('patron-neceser_todas-las-tallas_A0.pdf', P.a0Pdf(all, T).pdf.bytes(T));
    if (kind === 'projector') download('patron-neceser_proyector.pdf', P.projectorPdf(all, T).pdf.bytes(T));
    if (kind === 'chart') download('patron-neceser_tabla-de-corte.pdf', P.chartPdf(/^es-(MX|US|CO|VE|CR|GT|PA|PR|SV|HN|NI|DO)/i.test(navigator.language || '') ? 'letter' : 'a4', T).pdf.bytes(T));
    if (kind === 'guide') download('patron-neceser_instrucciones.pdf', P.guidePdf('a4', T).pdf.bytes(T));
  }

  function setUnlocked(on) {
    unlocked = on;
    document.body.classList.toggle('pro', on);
    $('keystate').textContent = on ? 'Clave aceptada: ya puedes descargar los archivos.' : '';
  }
  function tryKey(k) {
    k = (k || '').trim();
    if (!k) return Promise.resolve(false);
    var i = 0;
    function next() {
      if (i >= DOORS.length) return false;
      var door = DOORS[i++];
      return fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door))
        .then(function (r) { return r.json(); })
        .then(function (j) { return j && j.ok ? true : next(); })
        .catch(function () { return next(); });
    }
    return Promise.resolve(next()).then(function (ok) {
      if (ok) { try { localStorage.setItem(KEY, k); } catch (e) {} setUnlocked(true); }
      else $('keystate').textContent = 'Esa clave no vale para este patrón.';
      return ok;
    });
  }

  function init() {
    var sel = $('size');
    sel.addEventListener('change', function () {
      var s = P.sizeById(sel.value);
      if (s) { $('cw').value = s.W / 10; $('ch').value = s.H / 10; $('cd').value = s.D / 10; }
      $('customrow').hidden = sel.value !== 'custom';
      render();
    });
    ['style', 'layer', 'count', 'width', 'lining', 'p_ext', 'p_lin', 'p_pad', 'p_zip'].forEach(function (id) { $(id).addEventListener('input', render); $(id).addEventListener('change', render); });
    ['cw', 'ch', 'cd'].forEach(function (id) {
      $(id).addEventListener('input', function () { sel.value = 'custom'; $('customrow').hidden = false; render(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-get]'), function (b) { b.addEventListener('click', function () { getFile(b.getAttribute('data-get')); }); });
    $('keybtn').addEventListener('click', function () { tryKey($('key').value); });
    var m = /[#&]k=([^&]+)/.exec(location.hash || '');
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (m) tryKey(decodeURIComponent(m[1]));
    else if (saved) tryKey(saved);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
