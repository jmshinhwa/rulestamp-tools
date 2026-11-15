/* Dropshipping Content Tracker — Seite. Rechnet mit engine.js (DCT). */
(function () {
  'use strict';
  var E = window.DCT, doc = document, LS = window.localStorage;
  var K_CUR = 'dct.cur.v1', K_TESTS = 'dct.tests.v1', K_KEY = 'dct.key.v1';
  var DOORS = ['dropshipping-content-tracker', 'dropshipping-content-tracker.monthly', 'dropshipping-content-tracker.yearly'];
  var FIELDS = ['name', 'vk', 'ek', 'ship', 'feePct', 'feeFix', 'vat', 'returns', 'fixed', 'minPerVideo', 'hourly', 'perDay', 'days', 'ruleVideos', 'ruleOrders'];
  var pro = false, cur = null, curId = null;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function toForm(t) { FIELDS.forEach(function (f) { if ($(f)) $(f).value = t[f] == null ? '' : t[f]; }); drawRows(t.videos || []); if ($('start')) $('start').value = t.start || today(); }
  function fromForm() { var t = { videos: [] }; FIELDS.forEach(function (f) { t[f] = $(f).value; });
    Array.prototype.forEach.call(doc.querySelectorAll('#vt tbody tr'), function (tr) { var g = function (c) { return tr.querySelector('[data-c="' + c + '"]').value; };
      t.videos.push({ date: g('date'), platform: g('platform'), hook: g('hook'), views: E.num(g('views')), clicks: E.num(g('clicks')), orders: Math.round(E.num(g('orders'))) }); });
    t.start = ($('start') && $('start').value) || (t.videos[0] && t.videos[0].date) || today(); return t; }
  function rowHtml(v) {
    var pl = ['TikTok', 'Instagram', 'YouTube Shorts', 'Facebook', 'Pinterest'];
    return '<tr><td><input type="date" data-c="date" value="' + esc(v.date || today()) + '"></td>' +
      '<td><select data-c="platform">' + pl.map(function (p) { return '<option' + (p === v.platform ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></td>' +
      '<td><input data-c="hook" value="' + esc(v.hook || '') + '"></td>' +
      '<td><input data-c="views" inputmode="numeric" value="' + esc(v.views || 0) + '"></td>' +
      '<td><input data-c="clicks" inputmode="numeric" value="' + esc(v.clicks || 0) + '"></td>' +
      '<td><input data-c="orders" inputmode="numeric" value="' + esc(v.orders || 0) + '"></td>' +
      '<td><button type="button" class="x" title="Zeile löschen">×</button></td></tr>'; }
  function drawRows(vs) { $('vt').querySelector('tbody').innerHTML = vs.map(rowHtml).join(''); }

  function render() {
    cur = fromForm(); save(K_CUR, cur);
    var r = E.evaluate(cur), eur = E.eur, cls = r.profit < 0 ? 'neg' : 'pos';
    var h = '<p class="big ' + cls + '">' + eur(r.profit) + ' <span>Gewinn des Tests nach USt und allen Kosten</span></p>';
    h += '<div class="kpis">' +
      '<div><b>' + eur(r.gross) + '</b><span>Umsatz brutto (' + r.orders + ' Bestellungen)</span></div>' +
      '<div><b>' + eur(r.perHour) + '</b><span>pro Stunde (' + E.dec(r.hours, 1) + ' h Videoarbeit)</span></div>' +
      '<div><b>' + eur(r.db) + '</b><span>bleiben je Bestellung</span></div>' +
      '<div><b>' + E.dec(r.o10k) + '</b><span>Bestellungen je 10.000 Views</span></div></div>';
    h += '<p class="verdict v-' + r.verdict.code + '">' + esc(r.verdict.text) + '</p>';
    h += '<table class="sum"><tr><td>Umsatzsteuer ans Finanzamt</td><td>' + eur(r.vatTotal) + '</td></tr>' +
      '<tr><td>Retouren (' + r.returns + ' × ' + eur(r.lossPerReturn) + ')</td><td>' + eur(-r.returns * r.lossPerReturn) + '</td></tr>' +
      '<tr><td>Bestellungen bis null (ohne Zeit / mit Zeit)</td><td>' + (r.beOrders == null ? 'nie – jede Bestellung kostet' : r.beOrders + ' / ' + r.beAll) + '</td></tr>' +
      '<tr><td>Mit deinem Stundenwert gerechnet</td><td>' + eur(r.profitAfterTime) + '</td></tr>' +
      '<tr><td>Videos: gepostet / geplant</td><td>' + r.videos + ' / ' + r.planned + (r.left ? ' (noch ' + r.left + ')' : '') + '</td></tr>' +
      '<tr><td>Klickrate · Kaufrate</td><td>' + E.dec(r.ctr) + ' % · ' + E.dec(r.conv) + ' %</td></tr></table>';
    if (r.hooks.length) { h += '<p class="hk">Hooks nach Bestellungen je 1.000 Views:</p><ol class="hooks">';
      r.hooks.slice(0, 5).forEach(function (x) { h += '<li><b>' + esc(x.hook) + '</b> ' + E.dec(x.o1k) + ' · ' + x.orders + ' Best. aus ' + E.int(x.views) + ' Views (' + x.videos + ' Videos)</li>'; });
      h += '</ol>'; }
    $('out').innerHTML = h;
    if (pro) drawPro();
    return r;
  }

  /* ---- Pro ---- */
  function tests() { return load(K_TESTS, []); }
  function drawPro() {
    var ts = tests(), d = today();
    if (!ts.length) { $('board').innerHTML = '<p class="hint">Noch kein Test gespeichert. „Aktuellen Test speichern“ legt dein Produkt hier ab.</p>'; }
    else { var h = '<div class="tbl"><table><tr><th>Produkt</th><th>Videos</th><th>Views</th><th>Best.</th><th>Gewinn nach USt</th><th>Regel</th><th></th></tr>';
      ts.forEach(function (t) { var r = E.evaluate(t);
        h += '<tr><td>' + esc(t.name) + (t.status === 'stop' ? ' <i>(gestoppt)</i>' : '') + '</td><td>' + r.videos + '</td><td>' + E.int(r.views) + '</td><td>' + r.orders + '</td><td class="' + (r.profit < 0 ? 'neg' : 'pos') + '">' + E.eur(r.profit) + '</td><td>' + esc(r.verdict.code === 'go' ? 'erfüllt' : r.verdict.code === 'stop' ? 'verfehlt' : r.verdict.code === 'wait' ? 'läuft' : '–') + '</td>' +
          '<td><button type="button" data-open="' + esc(t.id) + '" class="lnk">öffnen</button> <button type="button" data-stop="' + esc(t.id) + '" class="lnk">' + (t.status === 'stop' ? 'fortsetzen' : 'stoppen') + '</button> <button type="button" data-del="' + esc(t.id) + '" class="lnk">löschen</button></td></tr>'; });
      $('board').innerHTML = h + '</table></div>'; }
    var q = E.queue(ts, d);
    $('today').innerHTML = q.length ? '<ul>' + q.map(function (x) { return '<li><b>' + esc(x.name) + '</b>: Tag ' + x.day + '/' + x.days + ' – ' + (x.open ? 'noch <b>' + x.open + ' Videos</b> offen' : 'alles gepostet') + ' (heute ' + x.postedToday + ')</li>'; }).join('') + '</ul>' : '<p class="hint">Heute läuft kein Testtag.</p>';
    var all = []; ts.forEach(function (t) { (t.videos || []).forEach(function (v) { all.push(v); }); });
    var hr = E.hookRank(all);
    $('hooksAll').innerHTML = hr.length ? '<ol class="hooks">' + hr.slice(0, 10).map(function (x) { return '<li><b>' + esc(x.hook) + '</b> ' + E.dec(x.o1k) + ' · ' + x.orders + ' Best. aus ' + E.int(x.views) + ' Views</li>'; }).join('') + '</ol>' : '<p class="hint">Noch keine Videos gespeichert.</p>';
  }
  function needPro(what) { if (pro) return false; $('keymsg').textContent = what + ' — Speichern und weitermachen: https://getreadystack.com/de/apps/dropshipping-content-tracker/'; $('pro').scrollIntoView({ behavior: 'smooth' }); return true; }
  function dl(name, type, text) { var a = doc.createElement('a'); a.href = 'data:' + type + ';charset=utf-8,' + encodeURIComponent(text); a.download = name; doc.body.appendChild(a); a.click(); a.remove(); }
  function check(key) { var k = 0; return new Promise(function (ok) { (function next() { if (k >= DOORS.length) return ok(false); var door = DOORS[k++];
    fetch('' + encodeURIComponent(key) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) ok(true); else next(); }).catch(next); })(); }); }
  function setPro(v) { pro = v; doc.body.classList.toggle('is-pro', v); if (v) drawPro(); }
  function unlock(key, quiet) { if (!key) return; $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/dropshipping-content-tracker/';
    check(key).then(function (ok) { if (ok) { setPro(true); save(K_KEY, key); $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/dropshipping-content-tracker/'; }
      else $('keymsg').textContent = quiet ? '' : ' — Speichern und weitermachen: https://getreadystack.com/de/apps/dropshipping-content-tracker/'; }); }

  doc.addEventListener('input', function (e) { if (e.target.closest('#vt') || e.target.hasAttribute('data-k')) render(); });
  doc.addEventListener('change', function (e) { if (e.target.closest('#vt') || e.target.hasAttribute('data-k')) render(); });
  doc.addEventListener('click', function (e) {
    var t = e.target;
    if (t.classList.contains('x')) { t.closest('tr').remove(); render(); }
    var id;
    if ((id = t.getAttribute('data-open'))) { var ts = tests().filter(function (x) { return x.id === id; })[0]; if (ts) { curId = id; toForm(ts); render(); window.scrollTo(0, 0); } }
    if ((id = t.getAttribute('data-stop'))) { save(K_TESTS, tests().map(function (x) { if (x.id === id) x.status = x.status === 'stop' ? '' : 'stop'; return x; })); drawPro(); }
    if ((id = t.getAttribute('data-del'))) { save(K_TESTS, tests().filter(function (x) { return x.id !== id; })); drawPro(); }
  });
  $('addv').onclick = function () { var vs = fromForm().videos; vs.push({ date: today(), platform: 'TikTok', hook: '', views: 0, clicks: 0, orders: 0 }); drawRows(vs); render(); };
  $('reset').onclick = function () { curId = null; toForm(clone(E.EX)); render(); };
  $('clear').onclick = function () { curId = null; var t = clone(E.EX); t.name = ''; t.videos = []; t.returns = '0'; t.fixed = '0'; t.start = today(); toForm(t); render(); };
  $('keybtn').onclick = function () { unlock($('key').value.trim()); };
  $('saveTest').onclick = function () { if (needPro('Tests speichern')) return; var t = fromForm(); var ts = tests(); t.id = curId || ('t' + Date.now().toString(36)); curId = t.id;
    var i = ts.map(function (x) { return x.id; }).indexOf(t.id); if (i >= 0) { t.status = ts[i].status; ts[i] = t; } else ts.push(t); save(K_TESTS, ts); $('promsg').textContent = '„' + (t.name || 'Test') + '“ gespeichert.'; drawPro(); };
  $('newTest').onclick = function () { if (needPro('Ein zweiter Test')) return; $('clear').onclick(); };
  $('csvIn').onchange = function (e) { if (needPro('CSV-Import')) return; var f = e.target.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () { var vs = E.parseCSV(rd.result); var all = fromForm().videos.concat(vs); drawRows(all); render(); $('promsg').textContent = vs.length + ' Videos importiert.'; }; rd.readAsText(f); };
  $('csvOut').onclick = function () { if (needPro('CSV-Export')) return; var ts = tests(); if (!ts.length) ts = [fromForm()]; dl('dropshipping-content-tests.csv', 'text/csv', E.toCSV(ts)); };
  $('icsOut').onclick = function () { if (needPro('Der Kalender')) return; var ts = tests(); if (!ts.length) ts = [fromForm()]; dl('dropshipping-content-plan.ics', 'text/calendar', E.toICS(ts)); };
  $('jsonOut').onclick = function () { if (needPro('Die JSON-Sicherung')) return; dl('dropshipping-content-tracker.json', 'application/json', JSON.stringify({ tests: tests(), current: fromForm() }, null, 1)); };
  $('jsonIn').onchange = function (e) { if (needPro('JSON laden')) return; var f = e.target.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () { try { var j = JSON.parse(rd.result); if (Array.isArray(j.tests)) save(K_TESTS, j.tests); if (j.current) toForm(j.current); render(); $('promsg').textContent = (j.tests || []).length + ' Tests geladen.'; } catch (x) { $('promsg').textContent = 'Datei nicht lesbar.'; } }; rd.readAsText(f); };

  toForm(load(K_CUR, null) || clone(E.EX));
  render();
  var m = /[#&]k=([^&]+)/.exec(location.hash); var k = m ? decodeURIComponent(m[1]) : load(K_KEY, '');
  if (k) { $('key').value = k; unlock(k, true); }
})();
