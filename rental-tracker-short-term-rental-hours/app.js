(function () {
  'use strict';
  var E = window.STR, SLUG = 'rental-tracker-short-term-rental-hours', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var LS = { cur: 'strt.current', list: 'strt.listings', key: 'strt.key' };
  var pro = false;
  var fields = [].slice.call(document.querySelectorAll('[data-k]'));
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function read() { var v = {}; fields.forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  function fill(v) { fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (v[k] != null) el.value = v[k]; }); }

  function render() {
    var v = read(), R = E.compute(v);
    $('#o-title').textContent = R.year + ' · ' + (v.listing || 'your rental');
    $('#o-tiles').innerHTML = E.tilesHtml(R);
    $('#o-flags').innerHTML = E.flagsHtml(R);
    $('#o-lines').innerHTML = E.linesHtml(R);
    $('#o-people').innerHTML = E.peopleHtml(R);
    $('#o-stays').innerHTML = E.staysHtml(R);
    $('#o-summary').textContent = E.summary(R);
    put(LS.cur, v);
    return R;
  }
  var NAMES = { print: 'the printed pack (Schedule E worksheet, the dated hours log and every stay) or a PDF of it', save: 'saving each rental and year',
    close: 'closing the year: next year opens with the suspended loss and any vacation-home carryover filled in', csv: 'one CSV with every saved rental and year',
    imp: 'reading a bookings CSV into the stays box', ics: 'quarterly log reminders and the December 1 hours check (.ics)', backup: 'the backup of your rentals', load: 'loading a backup' };
  function locked(what) {
    var m = $('#pro-msg'); m.hidden = false;
    m.innerHTML = 'This button opens ' + E.esc(NAMES[what] || ' — Save and continue: https://getreadystack.com/apps/rental-tracker-short-term-rental-hours/') + '' + SLUG + '';
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
  function name(v) { return (v.listing || 'Rental') + ' · ' + v.year; }
  function draw() {
    var P = get(LS.list, []);
    $('#props').hidden = !pro || !P.length;
    var tb = $('#prop-rows'); tb.innerHTML = '';
    P.forEach(function (p, i) {
      var R = E.compute(p.v), tr = document.createElement('tr');
      tr.innerHTML = '<td>' + E.esc(p.v.listing || '?') + '</td><td>' + R.year + '</td><td>' + R.avg.toFixed(2) + '</td><td>' + R.personalDays + ' / ' + R.allowed + '</td><td>' + E.hrs(R.hours.own) + (R.mp ? ' ✓' : '') + '</td><td>' + E.usd(R.net) + '</td><td>' + E.usd(R.taxLost) + '</td><td><button type="button" class="link">open</button> <button type="button" class="link">remove</button></td>';
      var bs = tr.querySelectorAll('button');
      bs[0].addEventListener('click', function () { fill(p.v); render(); window.scrollTo(0, 0); });
      bs[1].addEventListener('click', function () { if (confirm('Remove ' + p.name + '?')) { var X = get(LS.list, []); X.splice(i, 1); put(LS.list, X); draw(); } });
      tb.appendChild(tr);
    });
  }
  function saveCur(v) {
    var P = get(LS.list, []), n = name(v), i = P.findIndex(function (p) { return p.name === n; }), rec = { name: n, v: v };
    if (i >= 0) P[i] = rec; else P.push(rec); put(LS.list, P); return P;
  }
  function act(what) {
    if (!pro) return locked(what);
    var R = render(), v = read(), out = $('#pro-out');
    if (what === 'print') { printNow(E.packHtml(R, v)); out.textContent = 'Sent to print: Schedule E worksheet, ' + R.hours.lines + ' hour lines and ' + R.stays.list.length + ' stays for ' + R.year + '.'; }
    else if (what === 'save') { var P = saveCur(v); draw(); out.textContent = 'Saved. ' + P.length + ' rental year(s) in this browser.'; }
    else if (what === 'close') {
      saveCur(v); var n = E.closeYear(v, R); fill(n); var R2 = render(); saveCur(read()); draw();
      out.textContent = 'Opened ' + R2.year + ': ' + E.usd(R.carryPass) + ' suspended loss and ' + E.usd(R.carryOp + R.carryDep) + ' vacation-home carryover filled in. Add ' + R2.year + "'s stays and hours as they happen.";
    }
    else if (what === 'csv') {
      var L = get(LS.list, []).map(function (p) { return { name: p.v.listing || p.name, R: E.compute(p.v) }; });
      if (!L.length) L = [{ name: v.listing || 'Rental', R: R }];
      download('rental-tracker-' + R.year + '.csv', E.csv(L), 'text/csv;charset=utf-8'); out.textContent = L.length + ' rental year(s) in the CSV.';
    }
    else if (what === 'ics') { var t = E.ics(R.year, new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'); download('rental-tracker-' + R.year + '.ics', t, 'text/calendar;charset=utf-8'); out.textContent = (t.match(/BEGIN:VEVENT/g) || []).length + ' reminders saved for your calendar.'; }
    else if (what === 'backup') download('rental-tracker-backup.json', JSON.stringify({ listings: get(LS.list, []), current: v }, null, 1), 'application/json');
  }
  [].slice.call(document.querySelectorAll('[data-pro]')).forEach(function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-pro')); }); });
  [].slice.call(document.querySelectorAll('[data-pro-file]')).forEach(function (l) { l.addEventListener('click', function (e) { if (!pro) { e.preventDefault(); locked(l.getAttribute('data-pro-file')); } }); });
  function onFile(id, fn) {
    $(id).addEventListener('change', function () { var inp = this, f = inp.files && inp.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { fn(String(r.result)); inp.value = ''; }; r.readAsText(f); });
  }
  onFile('#imp', function (txt) {
    var I = E.importCsv(txt), el = $('[data-k="stays"]');
    if (!I.lines.length) { $('#pro-out').textContent = 'No stays found: the CSV needs a start date (or check-in) column and nights or an end date.'; return; }
    el.value = (el.value.trim() ? el.value.trim() + '\n' : '') + I.lines.join('\n'); render();
    $('#pro-out').textContent = I.lines.length + ' stay(s) added' + (I.skipped ? ', ' + I.skipped + ' row(s) skipped (payouts, adjustments or no dates)' : '') + '. Mark your own nights as owner.';
  });
  onFile('#load', function (txt) {
    try { var d = JSON.parse(txt); if (Array.isArray(d.listings)) put(LS.list, d.listings); if (d.current) fill(d.current); render(); draw(); $('#pro-out').textContent = 'Backup loaded.'; }
    catch (e) { $('#pro-out').textContent = 'This file is not a backup from this page.'; }
  });

  function unlock(k, quiet) {
    k = String(k || '').trim(); if (!k) return; var i = 0;
    (function next() {
      if (i >= DOORS.length) { if (!quiet) $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/rental-tracker-short-term-rental-hours/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/rental-tracker-short-term-rental-hours/'; } else next();
      }).catch(function () { if (!quiet) $('#key-msg').textContent = 'The key could not be checked right now. Try again in a minute.'; });
    })();
  }
  function setPro(on) { pro = on; document.body.classList.toggle('is-pro', on); if (on) $('#pro-msg').hidden = true; render(); draw(); }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  window.addEventListener('hashchange', function () { var h = /[#&]k=([^&]+)/.exec(location.hash); if (h) { $('#key').value = decodeURIComponent(h[1]); unlock(decodeURIComponent(h[1])); } });

  fields.forEach(function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });
  $('#reset').addEventListener('click', function () { fill(E.DEFAULTS); render(); });
  $('#clear').addEventListener('click', function () { var o = {}; fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (el.tagName !== 'SELECT') o[k] = ''; }); o.carry_op = o.carry_dep = o.carry_pass = '0'; o.rate = '22'; o.magi = ''; fill(o); render(); });
  var saved = get(LS.cur, null); if (saved) fill(saved);
  render();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { var k = decodeURIComponent(hk[1]); $('#key').value = k; unlock(k); history.replaceState(null, '', location.pathname + location.search); }
  else if (get(LS.key, '')) unlock(get(LS.key, ''), true);
})();
