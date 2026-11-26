/* app.js - Seitenlogik für das Umhang-Schnittmuster (de). Die Konstruktion steckt in cloak.js. */
(function () {
  'use strict';
  var C = window.Cloak;
  var SLUG = 'umhang-kapuze-schnittmuster';
  var DOORS = [SLUG, SLUG + '.once'];
  var KEY = 'umhang_schnitt_key';
  var $ = function (id) { return document.getElementById(id); };
  var unlocked = false;
  var NAMES = { A4: 'Schnittmuster A4', A0: 'A0 Copyshop', projector: 'Beamer', guide: 'Nähanleitung' };

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
      $('err').textContent = 'Bitte Maße prüfen: Hals 25-60 cm, Kapuzenhöhe 30-48 cm, Länge 30-170 cm, Stoffbreite 90-200 cm.';
      return;
    }
    $('err').textContent = '';
    var d = C.draft(o);
    var a4 = C.homePdf(d, 'a4', 'x');
    var fu = d.fabricUse;
    $('r_hood').textContent = cm(d.hoodNeck);
    $('r_cloak').textContent = cm(d.cloakNeck);
    $('r_diff').textContent = C.mmDE(d.diff) + ' mm';
    $('r_ok').textContent = d.ok ? 'Teile passen' : 'passen nicht';
    $('r_ok').className = d.ok ? 'ok' : 'bad';
    $('r_fabric').textContent = C.mDE(fu.shell) + ' m';
    $('r_fabric_note').textContent = 'Stoff, ' + (o.fabric / 10).toFixed(0) + ' cm breit, dazu ' + C.mDE(fu.lining) + ' m Kapuzenfutter' + (fu.corner ? ' (am Saum wird ein Eckstück angesetzt: das Teil ist breiter als der Stoff)' : '');
    $('r_pages').textContent = a4.pages + ' Seiten A4';
    $('r_hem').textContent = cm(o.length, 0);
    $('r_panels').textContent = (o.full ? '4 Teile, Vollkreis' : '2 Teile, Halbkreis') + ' + Kapuze ' + (o.three ? '3-teilig' : '2-teilig');
    var rows = d.checks.map(function (c) {
      return '<tr><td>' + c.label + '</td><td>' + cm(c.a, 2) + '</td><td>' + cm(c.b, 2) + '</td><td class="' + (c.ok ? 'ok' : 'bad') + '">' + Math.abs(c.diff).toFixed(2).replace('.', ',') + ' mm ' + (c.ok ? 'OK' : 'über 3 mm') + '</td></tr>';
    }).join('');
    $('checks').innerHTML = '<tr><th>Prüfung</th><th>Teil A</th><th>Teil B</th><th>Unterschied</th></tr>' + rows;
    $('pieces').innerHTML = C.svg(d);
    var ps = C.pieces(d);
    $('cutlist').innerHTML = ps.map(function (p) { return '<li><b>' + p.name.split(' - ')[0] + '</b>: ' + p.cut + '</li>'; }).join('') +
      '<li><b>Saum</b>: ' + cm(o.length, 0) + ' ab der Halsnahtlinie rundum abmessen, dann 2,5 cm zugeben</li>';
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
    return 'umhang_' + (d.opt.size === 'custom' ? 'eigene-masse-hals' + Math.round(d.opt.neck / 10) : d.opt.size) + '_' + (d.opt.full ? 'vollkreis' : 'halbkreis') + '_kapuze-' + (d.opt.three ? '3' : '2') + 'teilig';
  }
  var T = 'Umhang Kapuze Schnittmuster';
  function getFile(kind) {
    var d = render();
    if (!d) return;
    if (!unlocked) { $('paid').scrollIntoView({ behavior: 'smooth' }); $('paywhy').textContent = 'Die Datei „' + (NAMES[kind] || kind) + '“ gehört zum gekauften Schnittmuster. Deine Maße bleiben oben stehen.'; return; }
    var all = C.SIZES.map(function (s) { return C.draft({ size: s.id, full: d.opt.full, three: d.opt.three, length: d.opt.length, fabric: d.opt.fabric }); });
    if (d.opt.size === 'custom') all = [d];
    if (kind === 'A4') download(fileTag(d) + '_A4.pdf', C.homePdf(d, 'a4', T).pdf.bytes(T));
    if (kind === 'A0') download('umhang_' + (d.opt.size === 'custom' ? 'eigene-masse' : 'alle-groessen') + '_A0-copyshop.pdf', C.a0Pdf(all, T).pdf.bytes(T));
    if (kind === 'projector') download('umhang_' + (d.opt.size === 'custom' ? 'eigene-masse' : 'alle-groessen') + '_beamer.pdf', C.projectorPdf(all, T).pdf.bytes(T));
    if (kind === 'guide') download('umhang_naehanleitung.pdf', C.guidePdf(all, 'a4', T).pdf.bytes(T));
  }

  // ---- licence ----
  function setUnlocked(on) {
    unlocked = on;
    document.body.classList.toggle('pro', on);
    $('keystate').textContent = on ? ' — Speichern und weitermachen: https://getreadystack.com/de/apps/umhang-kapuze-schnittmuster/' : '';
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
      else $('keystate').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/umhang-kapuze-schnittmuster/';
      return ok;
    });
  }

  function estimate() {
    var h = parseFloat($('height').value);
    var which = $('lenpick').value;
    if (!(h >= 120 && h <= 220)) { $('estout').textContent = 'Bitte eine Körpergröße zwischen 120 und 220 cm eingeben.'; return; }
    var v = Math.round(h * C.FROM_HEIGHT[which]);
    $('length').value = v;
    $('estout').textContent = 'Schätzung: ' + v + ' cm (' + String(C.FROM_HEIGHT[which]).replace('.', ',') + ' x ' + h + ' cm). Zur Sicherheit nachmessen.';
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
