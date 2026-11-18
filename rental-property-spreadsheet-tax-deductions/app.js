(function () {
  'use strict';
  var E = window.RPS, SLUG = 'rental-property-spreadsheet-tax-deductions', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var LS = { cur: 'rps.current', assets: 'rps.assets', props: 'rps.props', key: 'rps.key' };
  var pro = false;
  var fields = [].slice.call(document.querySelectorAll('[data-k]'));
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function read() { var v = {}; fields.forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  function fill(v) { fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (v[k] != null) el.value = v[k]; }); }
  function assets() { return pro ? get(LS.assets, []) : []; }

  function render() {
    var v = read(), R = E.compute(v, assets());
    $('#o-title').textContent = R.year + ' · ' + (v.property || 'your rental');
    $('#o-tiles').innerHTML = E.tilesHtml(R);
    $('#o-flags').innerHTML = E.flagsHtml(R);
    $('#o-rows').innerHTML = E.rowsHtml(R);
    $('#o-lines').innerHTML = E.linesHtml(R);
    $('#o-summary').textContent = E.summary(R);
    put(LS.cur, v);
    return R;
  }
  var NAMES = { print: 'printing the two safe harbor election statements with the Schedule E worksheet (or saving them as PDF)', save: 'saving every rental with its numbers',
    close: 'closing the year: next year opens with the suspended loss and the capitalized improvements still depreciating', csv: 'the Schedule E CSV for all your rentals',
    ledger: 'the expense ledger CSV', ics: 'reminders for the return, extension and estimated tax dates (.ics)', backup: 'the backup of your rentals', imp: 'loading a backup' };
  function locked(what) {
    var m = $('#pro-msg'); m.hidden = false;
    m.innerHTML = 'This button opens ' + E.esc(NAMES[what] || ' — Save and continue: https://getreadystack.com/apps/rental-property-spreadsheet-tax-deductions/') + '' + SLUG + '';
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function download(name, body, type) {
    var b = new Blob([body], { type: type || 'text/plain;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function printNow(html) {
    $('#print-area').innerHTML = html; document.body.classList.add('printing');
    setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove('printing'); }, 300); }, 50);
  }
  function propName(v) { return (v.property || 'Rental') + ' · ' + v.year; }
  function draw() {
    var P = get(LS.props, []);
    $('#props').hidden = !pro || !P.length;
    var tb = $('#prop-rows'); tb.innerHTML = '';
    P.forEach(function (p, i) {
      var R = E.compute(p.v, p.assets || []), tr = document.createElement('tr');
      tr.innerHTML = '<td>' + E.esc(p.v.property || '?') + '</td><td>' + R.year + '</td><td>' + E.usd(R.with.net) + '</td><td>' + (R.shst.ok ? 'fits' : 'over') + '</td><td>' + E.usd(R.moved) + '</td><td>' + E.usd(R.pw.carry) + '</td><td>' + (p.assets || []).length + '</td><td><button type="button" class="link">open</button> <button type="button" class="link">remove</button></td>';
      var bs = tr.querySelectorAll('button');
      bs[0].addEventListener('click', function () { fill(p.v); put(LS.assets, p.assets || []); render(); window.scrollTo(0, 0); });
      bs[1].addEventListener('click', function () { if (confirm('Remove ' + p.name + '?')) { var X = get(LS.props, []); X.splice(i, 1); put(LS.props, X); draw(); } });
      tb.appendChild(tr);
    });
  }
  function saveCur(v) {
    var P = get(LS.props, []), name = propName(v), i = P.findIndex(function (p) { return p.name === name; }), rec = { name: name, v: v, assets: get(LS.assets, []) };
    if (i >= 0) P[i] = rec; else P.push(rec); put(LS.props, P); return P;
  }
  function act(what) {
    if (!pro) return locked(what);
    var R = render(), v = read(), out = $('#pro-out');
    if (what === 'print') { printNow(E.statementsHtml(R)); out.textContent = 'Sent to print: ' + ((R.shst.ok && R.shst.base ? 1 : 0) + (R.dmItems.length ? 1 : 0)) + ' election statement(s) and the Schedule E worksheet for ' + R.year + '.'; }
    else if (what === 'save') { var P = saveCur(v); draw(); out.textContent = 'Saved. ' + P.length + ' rental year(s) in this browser.'; }
    else if (what === 'close') {
      saveCur(v); var C = E.closeYear(v, R, get(LS.assets, []));
      put(LS.assets, C.assets); fill(C.v); var R2 = render(); saveCur(read()); draw();
      out.textContent = 'Opened ' + R2.year + ': ' + E.usd(R.pw.carry) + ' loss carried in, ' + C.assets.length + ' improvement(s) still depreciating (' + E.usd(R2.assetsDep) + ' this year) plus the building. Type ' + R2.year + "'s expenses.";
    }
    else if (what === 'csv') {
      var L = get(LS.props, []).map(function (p) { return { name: p.v.property || p.name, R: E.compute(p.v, p.assets || []) }; });
      if (!L.length) L = [{ name: v.property || 'Rental', R: R }];
      download('schedule-e-' + R.year + '.csv', E.csv(L), 'text/csv;charset=utf-8'); out.textContent = L.length + ' rental year(s) in the CSV.';
    }
    else if (what === 'ledger') { download('rental-expenses-' + R.year + '.csv', E.ledgerCsv(R), 'text/csv;charset=utf-8'); out.textContent = R.rows.length + ' expense line(s) in the CSV.'; }
    else if (what === 'ics') { var t = E.ics(R.year, new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'); download('rental-tax-dates-' + R.year + '.ics', t, 'text/calendar;charset=utf-8'); out.textContent = (t.match(/BEGIN:VEVENT/g) || []).length + ' reminders saved for your calendar.'; }
    else if (what === 'backup') download('rental-property-spreadsheet-backup.json', JSON.stringify({ props: get(LS.props, []), assets: get(LS.assets, []), current: v }, null, 1), 'application/json');
  }
  [].slice.call(document.querySelectorAll('[data-pro]')).forEach(function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-pro')); }); });
  [].slice.call(document.querySelectorAll('[data-pro-file]')).forEach(function (l) { l.addEventListener('click', function (e) { if (!pro) { e.preventDefault(); locked(l.getAttribute('data-pro-file')); } }); });
  $('#imp').addEventListener('change', function () {
    var inp = this, f = inp.files && inp.files[0]; if (!f) return; var r = new FileReader();
    r.onload = function () { try { var d = JSON.parse(String(r.result)); if (Array.isArray(d.props)) put(LS.props, d.props); if (Array.isArray(d.assets)) put(LS.assets, d.assets); if (d.current) fill(d.current); render(); draw(); $('#pro-out').textContent = 'Backup loaded.'; } catch (e) { $('#pro-out').textContent = 'This file is not a backup from this page.'; } inp.value = ''; };
    r.readAsText(f);
  });

  function unlock(k, quiet) {
    k = String(k || '').trim(); if (!k) return; var i = 0;
    (function next() {
      if (i >= DOORS.length) { if (!quiet) $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/rental-property-spreadsheet-tax-deductions/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/rental-property-spreadsheet-tax-deductions/'; } else next();
      }).catch(function () { if (!quiet) $('#key-msg').textContent = 'The key could not be checked right now. Try again in a minute.'; });
    })();
  }
  function setPro(on) { pro = on; document.body.classList.toggle('is-pro', on); if (on) $('#pro-msg').hidden = true; render(); draw(); }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  window.addEventListener('hashchange', function () { var h = /[#&]k=([^&]+)/.exec(location.hash); if (h) { $('#key').value = decodeURIComponent(h[1]); unlock(decodeURIComponent(h[1])); } });

  fields.forEach(function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });
  $('#reset').addEventListener('click', function () { fill(E.DEFAULTS); put(LS.assets, []); render(); });
  $('#clear').addEventListener('click', function () { var o = {}; fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (el.tagName !== 'SELECT') o[k] = ''; }); o.prior = '0'; fill(o); render(); });
  var saved = get(LS.cur, null); if (saved) fill(saved);
  render();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { var k = decodeURIComponent(hk[1]); $('#key').value = k; unlock(k); history.replaceState(null, '', location.pathname + location.search); }
  else if (get(LS.key, '')) unlock(get(LS.key, ''), true);
})();
