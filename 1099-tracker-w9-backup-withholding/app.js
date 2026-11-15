(function () {
  'use strict';
  var E = window.T1099, SLUG = '1099-tracker-w9-backup-withholding', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var LS = { cur: 't1099.current', book: 't1099.book', key: 't1099.key' };
  var pro = false;
  var fields = [].slice.call(document.querySelectorAll('[data-k]'));
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function read() { var v = {}; fields.forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  function fill(v) { fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (v[k] != null) el.value = v[k]; }); }

  function whoOptions(R, keep) {
    var sel = $('#next-who'), cur = keep || sel.value;
    var names = R.contractors.map(function (c) { return c.name; });
    if (names.join('|') !== sel.getAttribute('data-names')) {
      sel.innerHTML = names.map(function (n) { return '<option>' + E.esc(n) + '</option>'; }).join('');
      sel.setAttribute('data-names', names.join('|'));
    }
    if (names.indexOf(cur) >= 0) sel.value = cur;
  }
  function render() {
    var v = read(), R = E.compute(v);
    whoOptions(R, v.next_who);
    if (v.next_who !== $('#next-who').value) { v.next_who = $('#next-who').value; R = E.compute(v); }
    $('#o-title').textContent = R.payer + ', tax year ' + R.year;
    $('#o-tiles').innerHTML = E.tilesHtml(R);
    var n = R.next, nb = $('#o-next');
    nb.className = 'nextline ' + (n.kind || '');
    nb.textContent = n.ok ? 'Before you pay ' + n.who + ' ' + E.usd(n.amt) + ' on ' + n.date + ': ' + n.msg : n.msg;
    $('#o-rows').innerHTML = E.rowsHtml(R);
    $('#o-flags').innerHTML = E.flagsHtml(R) || '<li>Nothing to fix: every subject payment had a W-9 on file.</li>';
    $('#o-summary').textContent = R.summary;
    put(LS.cur, v);
    return R;
  }

  var NAMES = { save: 'the log that keeps every business and every year', roll: 'carrying contractors into next year (with the last-year 1099 mark set for you)',
    csvin: 'importing payments from your bank or bookkeeping CSV', w9: 'the W-9 request letter for every contractor without one',
    ics: 'the calendar reminders (.ics): W-9 chase, Form 945 and 1099-NEC dates', csv: 'the CSV of every payment with the 24% column',
    m945: 'the month-by-month backup withholding record for Form 945 (print)', backup: 'the backup of your log', imp: 'loading a backup' };
  function locked(what) {
    var m = $('#pro-msg'); m.hidden = false;
    m.innerHTML = 'This button opens ' + E.esc(NAMES[what] || ' — Save and continue: https://getreadystack.com/apps/1099-tracker-w9-backup-withholding/') + '' + SLUG + '';
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function download(name, body, type) {
    var b = new Blob([body], { type: type || 'text/plain;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function printNow(html) {
    var w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to print.'); return; }
    w.document.write('<!doctype html><meta charset="utf-8"><title>1099 tracker</title><style>body{font:14px/1.5 Georgia,serif;max-width:720px;margin:24px auto;padding:0 16px}h1,h2{font-family:Arial,sans-serif}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 6px;text-align:left}.pb{page-break-after:always}</style>' + html);
    w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300);
  }
  function slugName(R) { return String(R.payer).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + R.year; }
  function csvCell(x) { x = String(x == null ? '' : x); return /[",\n;]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  function icsDate(d) { return d.replace(/-/g, ''); }
  function addDays(d, n) { var t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }

  function act(what) {
    if (!pro) { locked(what); return; }
    var v = read(), R = E.compute(v), name = slugName(R);
    if (what === 'save') {
      var B = get(LS.book, []), id = R.payer + ' · ' + R.year;
      B = B.filter(function (x) { return x.id !== id; }); B.push({ id: id, v: v, owed: R.owed, forms: R.forms.length, missing: R.missing.length, due: R.Y.due945, at: new Date().toISOString().slice(0, 10) });
      put(LS.book, B); drawBook();
    } else if (what === 'roll') {
      var ny = String(+R.year + 1);
      if (!E.YEARS[ny]) { alert('The ' + ny + ' line is indexed for inflation and not yet published by the IRS; the carry opens when it is.'); return; }
    } else if (what === 'w9') {
      var list = R.contractors.filter(function (c) { return c.needW9 || (c.counted > 0 && !c.w9 && c.type !== 'corp'); });
      if (!list.length) { alert('Every paid contractor has a W-9 on file.'); return; }
      printNow(list.map(function (c) {
        return '<div class="pb"><p>' + E.esc(R.payer) + '<br>' + new Date().toISOString().slice(0, 10) + '</p><p>To: ' + E.esc(c.name) + '</p><h2>Request for Form W-9</h2>' +
          '<p>We pay you for services in ' + R.year + ' (' + E.usd(c.counted) + ' so far). The IRS requires us to have your taxpayer identification number to report these payments on Form 1099-NEC. Without it, federal law requires us to withhold 24% (backup withholding) from payments once your total for the year reaches ' + E.usd0(R.thr) + '.</p>' +
          '<p>Please complete and sign the enclosed Form W-9 (download it from IRS.gov/FormW9) and return it before our next payment.</p><p>Thank you,<br>' + E.esc(R.payer) + '</p></div>';
      }).join(''));
    } else if (what === 'ics') {
      var ev = [], stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', i = 0;
      function add(d, t, desc) { ev.push('BEGIN:VEVENT\r\nUID:t1099-' + (i++) + '-' + icsDate(d) + '@yoojin\r\nDTSTAMP:' + stamp + '\r\nDTSTART;VALUE=DATE:' + icsDate(d) + '\r\nDTEND;VALUE=DATE:' + icsDate(addDays(d, 1)) + '\r\nSUMMARY:' + t + '\r\nDESCRIPTION:' + desc + '\r\nEND:VEVENT'); }
      R.missing.forEach(function (c) { add(addDays(new Date().toISOString().slice(0, 10), 1), 'Get a signed W-9 from ' + c.name, 'Before the next payment. Without it hold back 24 percent.'); });
      add(addDays(R.Y.due, -14), '1099-NEC: two weeks left', 'Copy B to each contractor and Copy A to the IRS by ' + R.Y.due);
      add(R.Y.due, '1099-NEC and Form 945 due', 'Tax year ' + R.year + ': 1099-NEC (box 4 shows any backup withholding) and Form 945.');
      download('1099-tracker-' + name + '.ics', 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//1099 tracker//EN\r\n' + ev.join('\r\n') + '\r\nEND:VCALENDAR\r\n', 'text/calendar');
    } else if (what === 'csv') {
      var rows = [['contractor', 'type', 'w9_received', 'date', 'method', 'amount', 'year_to_date', 'status', 'backup_24pct', 'withheld', 'not_held']];
      R.contractors.forEach(function (c) { c.pays.forEach(function (p) { rows.push([c.name, c.type, c.w9, p.date, p.method, p.amt.toFixed(2), p.isK ? '' : p.ytd.toFixed(2), p.status, p.due ? p.due.toFixed(2) : '', p.withheld ? p.withheld.toFixed(2) : '', p.owe ? p.owe.toFixed(2) : '']); }); });
      download('1099-tracker-' + name + '.csv', rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'), 'text/csv');
    } else if (what === 'm945') {
      var ms = Object.keys(R.monthly).sort();
      printNow('<h1>Backup withholding by month, ' + E.esc(R.payer) + ', ' + R.year + '</h1><table><tr><th>Month</th><th>24% due on payments made</th></tr>' +
        ms.map(function (m) { return '<tr><td>' + m + '</td><td>' + E.usd(R.monthly[m]) + '</td></tr>'; }).join('') + '<tr><th>Year</th><th>' + E.usd(R.dueBW) + '</th></tr></table>' +
        '<p>Form 945 for ' + R.year + ' is due ' + E.longDate(R.Y.due945) + ' (' + E.longDate(R.Y.due945dep) + ' if every deposit was made on time). Under $2,500 for the year, no deposits are due during the year.</p>');
    } else if (what === 'backup') download('1099-tracker-backup.json', JSON.stringify({ book: get(LS.book, []), current: v }, null, 1), 'application/json');
    if (what === 'roll') {
      var ny2 = String(+R.year + 1), carry = R.contractors.map(function (c) { return [c.name, c.type, c.w9, c.needForm || c.withheld > 0 ? 'yes' : 'no'].join('; '); }).join('\n');
      fill({ year: ny2, contractors: carry, payments: '' }); render();
    }
  }
  function drawBook() {
    var B = get(LS.book, []), box = $('#book'); box.hidden = !pro || !B.length;
    $('#book-rows').innerHTML = B.map(function (o, i) { return '<tr><td>' + E.esc(o.id) + '</td><td>' + E.usd(o.owed) + '</td><td>' + o.forms + '</td><td>' + o.missing + '</td><td>' + o.due + '</td><td><button type="button" class="btn2" data-open="' + i + '">Open</button></td></tr>'; }).join('');
    [].slice.call(document.querySelectorAll('[data-open]')).forEach(function (b) { b.addEventListener('click', function () { fill(B[+b.getAttribute('data-open')].v); render(); window.scrollTo(0, 0); }); });
  }
  [].slice.call(document.querySelectorAll('[data-pro]')).forEach(function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-pro')); }); });
  [].slice.call(document.querySelectorAll('[data-pro-file]')).forEach(function (l) {
    l.addEventListener('click', function (e) { if (!pro) { e.preventDefault(); locked(l.getAttribute('data-pro-file')); } });
  });
  $('#csv-in').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(function (t) {
      var lines = t.split(/\r?\n/).filter(function (x) { return x.trim(); }), head = lines.shift().toLowerCase().split(/[,;]/);
      function col(re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; }
      var cd = col(/date/), cw = col(/payee|name|vendor|description|contractor/), ca = col(/amount|debit|paid/), cm = col(/method|type|memo/);
      if (cd < 0 || cw < 0 || ca < 0) { $('#imp-msg').textContent = 'Need columns for date, payee and amount.'; return; }
      var out = lines.map(function (l) { var x = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (s) { return s.replace(/^"|"$/g, '').trim(); });
        var d = new Date(x[cd]); var iso = isNaN(d) ? x[cd] : d.toISOString().slice(0, 10);
        return iso + '; ' + x[cw] + '; ' + Math.abs(parseFloat(String(x[ca]).replace(/[$,]/g, '')) || 0).toFixed(2) + '; ' + (cm >= 0 ? x[cm] : 'check'); });
      var el = document.querySelector('[data-k="payments"]'); el.value = (el.value.trim() ? el.value.trim() + '\n' : '') + out.join('\n'); render();
      $('#imp-msg').textContent = out.length + ' payments added. Contractors not in your list are flagged above.';
    });
  });
  $('#imp').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(function (t) { try { var j = JSON.parse(t); if (j.book) put(LS.book, j.book); if (j.current) fill(j.current); render(); drawBook(); $('#imp-msg').textContent = 'Backup loaded.'; }
      catch (er) { $('#imp-msg').textContent = 'This file is not a backup from this page.'; } });
  });
  $('#copy').addEventListener('click', function () {
    var t = $('#o-summary').textContent, done = function () { $('#copy-msg').textContent = 'Copied.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () {});
    else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
  });

  function unlock(k, quiet) {
    k = String(k || '').trim(); if (!k) return;
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { if (!quiet) $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/1099-tracker-w9-backup-withholding/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/1099-tracker-w9-backup-withholding/'; }
        else next();
      }).catch(function () { if (!quiet) $('#key-msg').textContent = 'The key could not be checked right now. Try again in a minute.'; });
    })();
  }
  function setPro(on) { pro = on; document.body.classList.toggle('is-pro', on); if (on) $('#pro-msg').hidden = true; drawBook(); }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  window.addEventListener('hashchange', function () { var h = /[#&]k=([^&]+)/.exec(location.hash); if (h) { $('#key').value = decodeURIComponent(h[1]); unlock(decodeURIComponent(h[1])); } });

  fields.forEach(function (el) { el.addEventListener('change', render); if (el.tagName === 'TEXTAREA' || el.type === 'text') el.addEventListener('input', render); });
  $('#reset').addEventListener('click', function () { fill(E.DEFAULTS); render(); });
  $('#clear').addEventListener('click', function () { fill({ payer_name: '', contractors: '', payments: '', next_amt: '' }); render(); });
  var saved = get(LS.cur, null); if (saved) fill(saved);
  render();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { var k = decodeURIComponent(hk[1]); $('#key').value = k; unlock(k); history.replaceState(null, '', location.pathname + location.search); }
  else if (get(LS.key, '')) unlock(get(LS.key, ''), true);
})();
