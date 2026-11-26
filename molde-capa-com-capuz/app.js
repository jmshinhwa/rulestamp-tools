/* app.js - lógica da página do molde de capa (pt-BR). O traçado está em cloak.js. */
(function () {
  'use strict';
  var C = window.Cloak;
  var SLUG = 'molde-capa-com-capuz';
  var DOORS = [SLUG, SLUG + '.once'];
  var KEY = 'molde_capa_key';
  var $ = function (id) { return document.getElementById(id); };
  var unlocked = false;
  var NAMES = { A4: 'Molde A4', A0: 'A0 para gráfica', projector: 'Projetor', guide: 'Instruções de costura' };

  function readForm() {
    var size = $('size').value;
    var s = C.sizeById(size);
    var neck = parseFloat($('neck').value) * 10;
    var hood = parseFloat($('hoodh').value) * 10;
    return {
      size: size === 'custom' ? null : size,
      neck: size === 'custom' ? neck : s.neck,
      hood: size === 'custom' ? hood : s.hood,
      length: parseFloat($('length').value) * 10,
      full: $('circle').value === 'full',
      three: $('hoodtype').value === '3',
      fabric: parseFloat($('fabric').value) * 10
    };
  }
  function valid(o) {
    return o.neck >= 250 && o.neck <= 600 && o.hood >= 300 && o.hood <= 480 && o.length >= 300 && o.length <= 1700 && o.fabric >= 900 && o.fabric <= 2000;
  }
  function cm(mm, d) { return (mm / 10).toFixed(d == null ? 1 : d).replace('.', ',') + ' cm'; }

  function render() {
    var o = readForm();
    var out = $('out');
    if (!valid(o)) {
      $('err').textContent = 'Confira as medidas: pescoço 25-60 cm, altura do capuz 30-48 cm, comprimento 30-170 cm, largura do tecido 90-200 cm.';
      return;
    }
    $('err').textContent = '';
    var d = C.draft(o);
    var a4 = C.homePdf(d, 'a4', 'x');
    var fu = d.fabricUse;
    $('r_hood').textContent = cm(d.hoodNeck);
    $('r_cloak').textContent = cm(d.cloakNeck);
    $('r_diff').textContent = C.mmES(d.diff) + ' mm';
    $('r_ok').textContent = d.ok ? 'as peças encaixam' : 'não encaixam';
    $('r_ok').className = d.ok ? 'ok' : 'bad';
    $('r_fabric').textContent = C.mES(fu.shell) + ' m';
    $('r_fabric_note').textContent = 'de tecido com ' + (o.fabric / 1000).toFixed(2).replace('.', ',') + ' m de largura, mais ' + C.mES(fu.lining) + ' m de forro para o capuz' + (fu.corner ? ' (na barra entra uma emenda de canto: a peça é mais larga que o tecido)' : '');
    $('r_pages').textContent = a4.pages + ' páginas A4';
    $('r_hem').textContent = cm(o.length, 0);
    $('r_panels').textContent = (o.full ? '4 peças, círculo completo' : '2 peças, meio círculo') + ' + capuz de ' + (o.three ? '3 peças' : '2 peças');
    var rows = d.checks.map(function (c) {
      return '<tr><td>' + c.label + '</td><td>' + cm(c.a, 2) + '</td><td>' + cm(c.b, 2) + '</td><td class="' + (c.ok ? 'ok' : 'bad') + '">' + Math.abs(c.diff).toFixed(2).replace('.', ',') + ' mm ' + (c.ok ? 'OK' : 'mais de 3 mm') + '</td></tr>';
    }).join('');
    $('checks').innerHTML = '<tr><th>Conferência</th><th>Peça A</th><th>Peça B</th><th>Diferença</th></tr>' + rows;
    $('pieces').innerHTML = C.svg(d);
    var ps = C.pieces(d);
    $('cutlist').innerHTML = ps.map(function (p) { return '<li><b>' + p.name.split(' - ')[0] + '</b>: ' + p.cut + '</li>'; }).join('') +
      '<li><b>Barra</b>: medir ' + cm(o.length, 0) + ' a partir da linha de costura do decote em toda a volta e somar 2,5 cm</li>';
    out.setAttribute('data-size', d.opt.size);
    window.__draft = d;
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
  function fileTag(d) {
    return 'capa_' + (d.opt.size === 'custom' ? 'medidas-proprias-pescoco' + Math.round(d.opt.neck / 10) : d.opt.size) + '_' + (d.opt.full ? 'circulo-completo' : 'meio-circulo') + '_capuz-' + (d.opt.three ? '3' : '2') + 'pecas';
  }
  var T = 'Molde capa com capuz';
  function getFile(kind) {
    var d = render();
    if (!d) return;
    if (!unlocked) { $('paid').scrollIntoView({ behavior: 'smooth' }); $('paywhy').textContent = 'O arquivo «' + (NAMES[kind] || kind) + '» faz parte do molde pago. As suas medidas continuam aí em cima.'; return; }
    var all = C.SIZES.map(function (s) { return C.draft({ size: s.id, full: d.opt.full, three: d.opt.three, length: d.opt.length, fabric: d.opt.fabric }); });
    if (d.opt.size === 'custom') all = [d];
    if (kind === 'A4') download(fileTag(d) + '_A4.pdf', C.homePdf(d, 'a4', T).pdf.bytes(T));
    if (kind === 'A0') download('capa_' + (d.opt.size === 'custom' ? 'medidas-proprias' : 'todos-os-tamanhos') + '_A0-grafica.pdf', C.a0Pdf(all, T).pdf.bytes(T));
    if (kind === 'projector') download('capa_' + (d.opt.size === 'custom' ? 'medidas-proprias' : 'todos-os-tamanhos') + '_projetor.pdf', C.projectorPdf(all, T).pdf.bytes(T));
    if (kind === 'guide') download('capa_instrucoes-de-costura.pdf', C.guidePdf(all, 'a4', T).pdf.bytes(T));
  }

  // ---- licence ----
  function setUnlocked(on) {
    unlocked = on;
    document.body.classList.toggle('pro', on);
    $('keystate').textContent = on ? 'Chave aceita: os downloads estão liberados.' : '';
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
      else $('keystate').textContent = 'Esta chave não vale para este molde.';
      return ok;
    });
  }

  function estimate() {
    var h = parseFloat($('height').value);
    var which = $('lenpick').value;
    if (!(h >= 120 && h <= 220)) { $('estout').textContent = 'Digite uma altura entre 120 e 220 cm.'; return; }
    var v = Math.round(h * C.FROM_HEIGHT[which]);
    $('length').value = v;
    $('estout').textContent = 'Estimativa: ' + v + ' cm (' + String(C.FROM_HEIGHT[which]).replace('.', ',') + ' x ' + h + ' cm). Meça para ter certeza.';
    render();
  }

  function init() {
    var sel = $('size');
    sel.addEventListener('change', function () {
      var s = C.sizeById(sel.value);
      if (s) { $('neck').value = s.neck / 10; $('hoodh').value = s.hood / 10; }
      $('customrow').hidden = sel.value !== 'custom';
      render();
    });
    ['neck', 'hoodh', 'length', 'circle', 'hoodtype', 'fabric'].forEach(function (id) {
      $(id).addEventListener('input', function () { if (id === 'neck' || id === 'hoodh') { sel.value = 'custom'; $('customrow').hidden = false; } render(); });
    });
    $('est').addEventListener('click', estimate);
    Array.prototype.forEach.call(document.querySelectorAll('[data-get]'), function (b) {
      b.addEventListener('click', function () { getFile(b.getAttribute('data-get')); });
    });
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
