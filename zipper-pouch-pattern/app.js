/* app.js - page logic for the zipper pouch pattern. The drafting is in pouch.js. */
(function () {
  'use strict';
  var P = window.Pouch;
  var SLUG = 'zipper-pouch-pattern';
  var DOORS = [SLUG, SLUG + '.once'];
  var KEY = 'zipper_pouch_pattern_key';
  var $ = function (id) { return document.getElementById(id); };
  var unlocked = false;
  var x = function (a, b) { return a + ' × ' + b; };
  var n1 = function (mm) { return (mm / 10).toFixed(1); };

  function readForm() {
    var size = $('size').value;
    var o = { style: $('style').value, layer: $('layer').value, lining: $('lining').value === 'yes', tab: true };
    if (size === 'custom') { o.W = parseFloat($('cw').value) * 10; o.H = parseFloat($('ch').value) * 10; o.D = parseFloat($('cd').value) * 10; }
    else o.size = size;
    return { o: o, count: parseInt($('count').value, 10), width: parseFloat($('width').value) };
  }
  function money(v) { return v.toFixed(2); }

  function render() {
    var f = readForm();
    if (!(f.count >= 1 && f.count <= 200)) { $('err').textContent = 'Type between 1 and 200 pouches.'; return null; }
    var d = P.draft(f.o);
    if (!d.valid) { $('err').textContent = 'Check the size: width 6-50 cm, height 4-40 cm, boxed depth 2-20 cm and not wider than the pouch.'; return null; }
    $('err').textContent = '';
    var o = d.opt, boxed = o.style === 'boxed';
    $('r_cut').textContent = x(n1(d.cw), n1(d.ch) + ' cm');
    $('r_cut_in').textContent = 'panel cut size, cut 2 (' + x(P.inch(d.cw).replace(' in', ''), P.inch(d.ch)) + ')';
    $('r_corner').textContent = boxed ? n1(d.corner) + ' cm' : 'none';
    $('r_corner_lab').textContent = boxed ? 'corner square out of both bottom corners (' + P.inch(d.corner) + ')' : 'flat pouch: square corners, clip them after sewing';
    $('r_zip').textContent = P.ZIPS_IN[d.zip];
    $('r_zip_lab').textContent = 'zipper (' + (d.zip / 10) + ' cm), or ' + n1(d.zipReel) + ' cm from a reel';
    var fb = P.fabric(d, f.count, f.width);
    var row = function (k) { return fb.rows.filter(function (r) { return r.k === k; })[0]; };
    var e = row('ext'), l = row('lin');
    $('r_ext').textContent = e.m.toFixed(1) + ' m';
    $('r_ext_lab').textContent = 'exterior fabric for ' + f.count + (f.count === 1 ? ' pouch' : ' pouches') + ', ' + (f.width / 10) + ' cm wide' + (o.layer === 'quilted' ? ' (quilting blocks)' : '');
    $('r_lin').textContent = l ? l.m.toFixed(1) + ' m' : 'none';
    $('r_lin_lab').textContent = l ? 'lining for ' + f.count + (f.count === 1 ? ' pouch' : ' pouches') : 'unlined pouch';
    $('r_fq').textContent = e.fq_pieces + (e.fq_pieces === 1 ? ' panel' : ' panels');
    $('r_fq_lab').textContent = 'per fat quarter (' + (e.fq_pieces >= 2 ? Math.floor(e.fq_pieces / 2) + (Math.floor(e.fq_pieces / 2) === 1 ? ' pouch' : ' pouches') : 'not one whole pouch') + ')';
    $('r_fin').textContent = boxed ? x(n1(d.finished.W).replace('.0', ''), x(n1(d.finished.H).replace('.0', ''), n1(d.finished.D).replace('.0', '') + ' cm')) : x(n1(d.finished.flatW).replace('.0', ''), n1(d.finished.flatH).replace('.0', '') + ' cm');
    $('pieces').innerHTML = P.svg(d);
    $('chart').innerHTML = '<tr><th>Cut</th><th>Piece</th><th>Size</th></tr>' + P.chart(d).map(function (r) {
      return '<tr><td>' + r.n + ' ×</td><td><b>' + r.piece + '</b></td><td>' + r.size.replace(/ x /g, ' × ') + '</td></tr><tr><td></td><td class="note" colspan="2">' + r.note.replace(/ x /g, ' × ') + '</td></tr>';
    }).join('');
    $('fabric').innerHTML = '<tr><th>Layer</th><th>Pieces</th><th>Buy</th><th>Per fat quarter</th></tr>' + fb.rows.map(function (r) {
      return r.fits ? '<tr><td>' + r.label + '</td><td>' + r.pieces + '</td><td>' + r.m.toFixed(1) + ' m (' + r.yd + ' yd)</td><td>' + r.fq_pieces + '</td></tr>' : '<tr><td>' + r.label + '</td><td colspan="3">wider than the fabric</td></tr>';
    }).join('') + '<tr><td>Zippers</td><td>' + fb.zips + '</td><td>' + fb.zips + ' × ' + P.ZIPS_IN[d.zip] + ', or ' + (fb.reel_mm / 1000).toFixed(2) + ' m of reel + ' + fb.zips + ' sliders</td><td></td></tr>';
    $('checks').innerHTML = '<tr><th>Measured on the drawn piece</th><th>Should be</th><th>Is</th></tr>' + d.checks.map(function (c) {
      return '<tr><td>' + c.label + '</td><td>' + n1(c.want) + ' cm</td><td class="' + (Math.abs(c.want - c.got) < 0.05 ? 'ok' : 'bad') + '">' + n1(c.got) + ' cm</td></tr>';
    }).join('');
    var pr = { ext: +$('p_ext').value, lin: +$('p_lin').value, bat: +$('p_pad').value, fle: +$('p_pad').value, zip: +$('p_zip').value };
    var c = P.cost(fb, pr);
    $('costout').innerHTML = c.parts.map(function (p) { return p.label + ' ' + (p.m != null ? p.m.toFixed(1) + ' m × ' + money(p.price) : p.n + ' × ' + money(p.price)) + ' = ' + money(p.total); }).join(' · ') +
      '<br><b>Total ' + money(c.total) + ' for ' + f.count + ', ' + money(c.per) + ' per pouch</b> (whole metres bought, rounded up to 10 cm)';
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
    return 'zipper-pouch_' + (o.size === 'custom' ? 'custom-' + Math.round(o.W / 10) + 'x' + Math.round(o.H / 10) + (o.style === 'boxed' ? 'x' + Math.round(o.D / 10) : '') : o.size) + '_' + o.style;
  }
  var T = 'Zipper pouch pattern';
  function getFile(kind) {
    var d = render();
    if (!d) return;
    if (!unlocked) { $('paid').scrollIntoView({ behavior: 'smooth' }); $('paywhy').textContent = 'The ' + kind + ' file is part of the paid pattern. Your numbers stay in the boxes above.'; return; }
    var all = [];
    ['boxed', 'flat'].forEach(function (st) { P.SIZES.forEach(function (s) { all.push(P.draft({ size: s.id, style: st, lining: d.opt.lining, tab: true })); }); });
    if (d.opt.size === 'custom') all = [d].concat(all);
    if (kind === 'A4') download(tag(d) + '_A4.pdf', P.homePdf(d, 'a4', T).pdf.bytes(T));
    if (kind === 'Letter') download(tag(d) + '_Letter.pdf', P.homePdf(d, 'letter', T).pdf.bytes(T));
    if (kind === 'A0') download('zipper-pouch_all-sizes_A0.pdf', P.a0Pdf(all, T).pdf.bytes(T));
    if (kind === 'projector') download('zipper-pouch_projector.pdf', P.projectorPdf(all, T).pdf.bytes(T));
    if (kind === 'chart') download('zipper-pouch_cutting-chart.pdf', P.chartPdf(/letter/i.test(navigator.language || '') ? 'letter' : 'a4', T).pdf.bytes(T));
    if (kind === 'guide') download('zipper-pouch_sewing-guide.pdf', P.guidePdf('a4', T).pdf.bytes(T));
  }

  function setUnlocked(on) {
    unlocked = on;
    document.body.classList.toggle('pro', on);
    $('keystate').textContent = on ? 'Key accepted: the downloads are on.' : '';
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
      else $('keystate').textContent = 'That key was not accepted for this pattern.';
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
