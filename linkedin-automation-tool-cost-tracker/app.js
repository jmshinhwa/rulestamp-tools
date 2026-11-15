(function () {
  'use strict';
  var E = window.LAT, U = window.LATUI, SLUG = 'linkedin-automation-tool-cost-tracker', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var LS = { cur: 'lat.current', key: 'lat.key', ws: 'lat.workspaces' };
  var pro = false, last = null;
  var fields = [].slice.call(document.querySelectorAll('[data-k]'));
  var DEFAULTS = {}; fields.forEach(function (el) { DEFAULTS[el.getAttribute('data-k')] = el.value; });
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var esc = U.esc;
  function today() { return new Date().toISOString().slice(0, 10); }
  function read() { var v = {}; fields.forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  function fill(v) {
    fields.forEach(function (el) {
      var k = el.getAttribute('data-k'), x = v[k]; if (x == null) return;
      if (el.tagName === 'SELECT' && ![].some.call(el.options, function (o) { return o.value === String(x); })) return;
      el.value = x;
    });
  }
  function render() {
    var v = read(), r = E.run(v), o = U.build(E, r, v);
    last = { v: v, r: r }; put(LS.cur, v);
    Object.keys(o).forEach(function (id) { var el = document.getElementById(id); if (el) el.innerHTML = o[id]; });
  }
  var NAMES = { csv: 'the CSV of your stack, every logged week and the per-account results', ics: 'calendar reminders: 3 days before every charge in the next 12 months, plus a Monday "log last week" reminder', print: 'the printable monthly report (per account, stack, renewals, weeks)', save: 'saving this workspace', backup: 'the backup file', restore: 'loading a backup', ws: 'your saved workspaces (one per client or team)' };
  function locked(what) {
    var mm = $('#pro-msg'); mm.hidden = false;
    mm.innerHTML = 'This button opens ' + esc(NAMES[what] || ' — Save and continue: https://getreadystack.com/apps/linkedin-automation-tool-cost-tracker/') + '' + SLUG + '';
  }
  function download(name, data, type) {
    var bl = new Blob([data], { type: type || 'text/plain' }), a = document.createElement('a');
    a.href = URL.createObjectURL(bl); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function fileSlug(s) { return String(s || 'team').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'; }
  function csvCell(x) { x = String(x == null ? '' : x); return /[",\n;]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  function toCSV(r, v) {
    var L = [], R = function (a) { L.push(a.map(csvCell).join(',')); }, f = function (x) { return isFinite(x) ? E.r2(x).toFixed(2) : ''; };
    R(['section', 'workspace', v.team, 'as of', r.asof, 'currency', r.cur]);
    R(['stack', 'item', 'account', 'price', 'billed per', 'per month', 'charge date']);
    r.stack.forEach(function (x) { R(['stack', x.item, x.account, f(x.price), x.per.label, f(x.monthly), E.iso(x.date)]); });
    R(['week', 'week start', 'account', 'invites', 'accepted', 'replies', 'meetings']);
    r.weeks.forEach(function (x) { R(['week', E.iso(x.date), x.account, x.invites, x.accepted, x.replies, x.meetings]); });
    R(['account', 'account', 'per month', 'cost last weeks', 'invites', 'accepted', 'replies', 'meetings', 'per meeting', 'per accepted']);
    r.accounts.forEach(function (a) { R(['account', a.name, f(a.monthly), f(a.cost), a.invites, a.accepted, a.replies, a.meetings, f(a.perMeeting), f(a.perAccepted)]); });
    R(['charge', 'date', 'item', 'account', 'amount']);
    r.charges.forEach(function (c) { R(['charge', E.iso(c.date), c.item, c.account, f(c.amount)]); });
    return L.join('\r\n') + '\r\n';
  }
  function icsText(s) { return String(s).replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); }
  function toICS(r, v) {
    var stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yoojin//linkedin-automation-tool-cost-tracker//EN', 'CALSCALE:GREGORIAN'];
    function ev(uid, d, sum, desc, rrule) {
      var ds = d.replace(/-/g, ''), nd = new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@lat', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ds, 'DTEND;VALUE=DATE:' + nd, 'SUMMARY:' + icsText(sum), 'DESCRIPTION:' + icsText(desc));
      if (rrule) L.push('RRULE:' + rrule);
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(sum), 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT');
    }
    r.charges.forEach(function (c, i) {
      var remind = E.iso(new Date(c.date.getTime() - 3 * 864e5));
      ev('c' + i + '-' + E.iso(c.date), remind, 'In 3 days: ' + c.item + ' (' + c.account + ') charges ' + E.money(c.amount), 'Charge date ' + E.iso(c.date) + '. Keep it or cancel it before then. ' + (v.team || ''));
    });
    var d = E.pdate(r.asof) || new Date(), k = 0; while (d.getUTCDay() !== 1 && k < 7) { d = new Date(d.getTime() + 864e5); k++; }
    ev('weekly-log', E.iso(d), 'Log last week: invites, accepted, replies, meetings per account', 'Open the LinkedIn automation tool cost tracker and add one line per account. ' + (v.team || ''), 'FREQ=WEEKLY;COUNT=52');
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }
  function printReport(r, v) {
    var w = window.open('', '_blank');
    if (!w) { $('#pro-msg').hidden = false; $('#pro-msg').textContent = 'Allow pop-ups to print the report.'; return; }
    var o = U.build(E, r, v);
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + esc(v.team || 'LinkedIn outreach') + ' report ' + r.asof + '</title><style>body{font:12px system-ui,sans-serif;margin:22px}table{border-collapse:collapse;width:100%;margin:6px 0 14px}td,th{border:1px solid #999;padding:3px 6px;text-align:left}.num{text-align:right}h1{font-size:17px}h2{font-size:14px;margin-top:16px}.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.tile{border:1px solid #999;padding:6px}.tile b{display:block;font-size:16px}.tile small{color:#444}tr.bad td{background:#fde2e2}</style>' +
      '<h1>' + o['o-title'] + '</h1><div class="tiles">' + o['o-tiles'] + '</div><p>' + o['o-summary'] + '</p><ul>' + o['o-flags'] + '</ul>' +
      '<h2>Per account</h2><table>' + o['o-accounts'] + '</table><h2>Stack</h2><table>' + o['o-stack'] + '</table><h2>Charges in the next 30 days</h2><table>' + o['o-renew'] + '</table><h2>Week by week</h2><table>' + o['o-weeks'] + '</table>' +
      '<p>Made with the LinkedIn automation tool cost tracker. Numbers are the ones typed into it.</p><script>setTimeout(function(){print()},300)<\/script>');
    w.document.close();
  }
  function drawWS() {
    var S = get(LS.ws, []);
    $('#ws-msg').textContent = S.length ? '' : 'Nothing saved yet.';
    if (!S.length) { $('#ws').innerHTML = ''; return; }
    $('#ws').innerHTML = '<thead><tr><th>Workspace</th><th>As of</th><th class="num">Stack / month</th><th class="num">Meetings</th><th class="num">Per meeting</th><th></th></tr></thead><tbody>' +
      S.map(function (p, i) { var r = E.run(p.v); return '<tr><td><button type="button" class="link" data-open="' + i + '">' + esc(p.v.team || 'workspace') + '</button></td><td>' + r.asof + '</td><td class="num">' + E.money(r.totalMonthly) + '</td><td class="num">' + E.qty(r.T.meetings) + '</td><td class="num"><b>' + E.money(r.perMeeting) + '</b></td><td><button type="button" class="link" data-del="' + i + '">remove</button></td></tr>'; }).join('') + '</tbody>';
    [].forEach.call(document.querySelectorAll('#ws [data-open]'), function (b) { b.addEventListener('click', function () { var p = get(LS.ws, [])[+b.getAttribute('data-open')]; if (p) { fill(p.v); render(); window.scrollTo(0, 0); } }); });
    [].forEach.call(document.querySelectorAll('#ws [data-del]'), function (b) { b.addEventListener('click', function () { var S2 = get(LS.ws, []); S2.splice(+b.getAttribute('data-del'), 1); put(LS.ws, S2); drawWS(); }); });
  }
  function saveCurrent(v) {
    var S = get(LS.ws, []), i = -1;
    S.forEach(function (p, j) { if ((p.v.team || '') === (v.team || '')) i = j; });
    if (i >= 0) S[i] = { v: v }; else S.push({ v: v });
    put(LS.ws, S); drawWS();
  }
  function act(what) {
    if (!pro) { locked(what); return; }
    var v = last.v, r = last.r, base = fileSlug(v.team) + '-' + r.asof;
    if (what === 'csv') download(base + '.csv', toCSV(r, v), 'text/csv');
    else if (what === 'ics') download(base + '-reminders.ics', toICS(r, v), 'text/calendar');
    else if (what === 'print') printReport(r, v);
    else if (what === 'save') { saveCurrent(v); $('#pro-msg').hidden = false; $('#pro-msg').textContent = 'Saved "' + (v.team || 'workspace') + '" in this browser.'; }
    else if (what === 'backup') download('linkedin-cost-tracker-backup.json', JSON.stringify({ current: v, workspaces: get(LS.ws, []) }, null, 1), 'application/json');
  }
  [].forEach.call(document.querySelectorAll('[data-pro]'), function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-pro')); }); });
  $('#restore').addEventListener('change', function (e) {
    if (!pro) { locked('restore'); e.target.value = ''; return; }
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { try { var j = JSON.parse(rd.result); if (j.workspaces) put(LS.ws, j.workspaces); if (j.current) { fill(j.current); render(); } drawWS(); $('#pro-msg').hidden = false; $('#pro-msg').textContent = 'Backup loaded.'; } catch (x) { $('#pro-msg').hidden = false; $('#pro-msg').textContent = 'That file is not a backup from this page.'; } };
    rd.readAsText(f);
  });
  // quick add: one line per account for one week
  $('#add-week').addEventListener('click', function () {
    var d = $('#w-date').value, a = $('#w-acc').value.trim(), nums = ['#w-inv', '#w-acc2', '#w-rep', '#w-mt'].map(function (s) { return $(s).value.trim() || '0'; });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !a || !isFinite(E.num(nums[0]))) { $('#w-msg').textContent = 'Week start, account and invites are needed.'; return; }
    var ta = document.querySelector('[data-k="weeks"]');
    ta.value = (ta.value.replace(/\s+$/, '') ? ta.value.replace(/\s+$/, '') + '\n' : '') + [d, a].concat(nums).join('; ');
    $('#w-msg').textContent = 'Added ' + a + ', week of ' + d + '.';
    ['#w-inv', '#w-acc2', '#w-rep', '#w-mt'].forEach(function (s) { $(s).value = ''; });
    render();
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
      if (i >= DOORS.length) { if (!quiet) $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/linkedin-automation-tool-cost-tracker/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/linkedin-automation-tool-cost-tracker/'; }
        else next();
      }).catch(function () { if (!quiet) $('#key-msg').textContent = 'Could not check the key right now. Try again in a minute.'; });
    })();
  }
  function setPro(on) { pro = on; document.body.classList.toggle('is-pro', on); if (on) { $('#pro-msg').hidden = true; drawWS(); } }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  window.addEventListener('hashchange', function () { var h = /[#&]k=([^&]+)/.exec(location.hash); if (h) { $('#key').value = decodeURIComponent(h[1]); unlock(decodeURIComponent(h[1])); } });
  fields.forEach(function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });
  $('#reset').addEventListener('click', function () { fill(DEFAULTS); render(); });
  $('#clear').addEventListener('click', function () { fill({ team: '', stack: '', weeks: '', asof: today() }); render(); document.querySelector('[data-k="stack"]').focus(); });
  $('#w-date').value = (function () { var d = new Date(), k = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - (k + 7) * 864e5).toISOString().slice(0, 10); })();
  var saved = get(LS.cur, null);
  if (saved && saved.stack != null) fill(saved);
  render();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { var k = decodeURIComponent(hk[1]); $('#key').value = k; unlock(k); history.replaceState(null, '', location.pathname + location.search); }
  else if (get(LS.key, '')) unlock(get(LS.key, ''), true);
  window.__lat = { render: render, setPro: setPro, act: act, toCSV: toCSV, toICS: toICS, last: function () { return last; } };
})();
