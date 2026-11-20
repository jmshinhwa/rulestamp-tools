/* shift planner — page. Free: one whole week checked on screen. Pro: saved teams and weeks, chained weeks, 17-week average, print, payroll CSV, .ics. */
(function () {
  'use strict';
  var C = window.SP, doc = document, LS = window.localStorage;
  var SLUG = 'shift-planner-uk-rota-wage-cost', DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  var K_KEY = 'sp_pro_key', K_DATA = 'sp_pro_data';
  var $ = function (id) { return doc.getElementById(id); };
  var last = null, pro = false;
  var TYPE = { rest: 'Short daily rest', brk: 'No rest break', weekly: 'No weekly rest', young: 'Under-18 limit', nmw: 'Below minimum wage', over48: 'Over 48 h', cover: 'Short-staffed', bad: 'Cell not read' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opts(prevEnd) { return { week: $('week').value, rest: $('rest').value, holidayPct: $('hol').value, ni: $('ni').checked, prevEnd: prevEnd }; }
  function kpi(cls, big, small) { return '<div class="kpi ' + cls + '"><b>' + big + '</b><span>' + small + '</span></div>'; }

  function prevEndFor(team, week) {
    if (!pro || !team || !week) return null;
    var d = data(), t = d.teams[team], pw = C.addDays(week, -7);
    if (!t || !t.weeks[pw]) return null;
    var w = t.weeks[pw];
    return C.weekEnds(C.analyze(C.parseGrid(w.grid), { week: pw, rest: w.rest }));
  }

  function run() {
    var grid = C.parseGrid($('grid').value), out = $('out');
    if (!grid.staff.length) { out.innerHTML = '<p class="say">No staff rows found. Type one row per person: Name · Age · £ per hour · the 7 shifts from Monday to Sunday.</p>'; last = null; return; }
    var week = C.monday($('week').value) || '2026-11-23';
    var team = ($('team').value || '').trim();
    var pe = prevEndFor(team, week);
    var res = C.analyze(grid, opts(pe || undefined)), T = res.totals, nx = T.nextRates;
    last = { res: res, week: week, grid: $('grid').value, chained: !!pe };
    var ex = $('grid').value === $('grid').defaultValue;
    var h = '<p class="loss">';
    if (T.nmw) h += '<b>' + C.money(T.arrears) + ' owed this week</b>: ' + T.nmw + (T.nmw === 1 ? ' person is' : ' people are') + ' paid below the ' + T.minRates.label + ' minimum wage for their age. ';
    if (T.legal - T.nmw) h += '<b>' + (T.legal - T.nmw) + ' working-time ' + (T.legal - T.nmw === 1 ? 'problem' : 'problems') + '</b> (rest between shifts, breaks, weekly rest, under-18 limits). ';
    if (!T.legal) h += '<b>No minimum wage or working-time problems</b> in this week\'s rota. ';
    if (nx && T.futureBelow) h += 'From 1 April 2027 the same rota underpays ' + T.futureBelow + (T.futureBelow === 1 ? ' person' : ' people') + ' by <b>' + C.money(T.futureCost) + ' a week</b>.';
    h += '</p><div class="kpis">' +
      kpi(T.arrears ? 'bad' : 'good', C.money(T.arrears), 'below minimum wage this week') +
      kpi(T.legal - T.nmw ? 'bad' : 'good', String(T.legal - T.nmw), 'working-time problems') +
      kpi('', C.money(T.cost), 'wage cost of the week' + (T.holiday || T.ni ? ' (with on-costs)' : '')) +
      kpi(nx ? (T.futureCost ? 'bad' : 'good') : '', nx ? C.money(T.futureCost) : C.hdec(T.minutes), nx ? 'a week short at April 2027 rates' : 'paid hours') + '</div>';
    h += '<p class="meta">' + (ex ? 'Made-up example: a 5-person café, week of ' : 'Week of ') + C.fmtDate(week) + ' · ' + C.hdec(T.minutes) + ' paid · minimum wage ' + T.minRates.label + ': ' + C.money(T.minRates.a21) + ' (21+), ' + C.money(T.minRates.a18) + ' (18-20), ' + C.money(T.minRates.u18) + ' (under 18)' + (last.chained ? ' · chained to last week' : '') + '</p>';
    h += '<ul class="issues">';
    var order = ['nmw', 'rest', 'brk', 'weekly', 'young', 'over48', 'cover', 'bad'];
    order.forEach(function (t) { res.issues.filter(function (i) { return i.type === t; }).forEach(function (i) { h += '<li class="t-' + i.type + '"><span class="tag">' + esc(TYPE[i.type]) + '</span> ' + (i.who ? '<b>' + esc(i.who) + '</b>: ' : '') + esc(i.text) + '</li>'; }); });
    if (nx) res.people.forEach(function (w) { if (w.future) h += '<li class="t-future"><span class="tag">From 1 Apr 2027</span> <b>' + esc(w.name) + '</b>: ' + C.money(w.rate) + '/h is below ' + C.money(w.futureMin) + '; ' + C.money(w.future) + ' a week short at these hours.</li>'; });
    h += '</ul>';
    h += '<div class="tbl"><table class="rota"><thead><tr><th>Name</th>';
    C.DAYS.forEach(function (d, i) { h += '<th>' + d + ' ' + C.shortDate(C.addDays(week, i)) + '</th>'; });
    h += '<th>Hours</th><th>£/h</th><th>Minimum</th><th>Pay</th><th>Cost</th></tr></thead><tbody>';
    res.people.forEach(function (w) {
      h += '<tr><td>' + esc(w.name) + ' <small>' + esc(isFinite(w.age) ? w.age : '') + (w.band === 'app' ? ' app.' : '') + '</small></td>';
      w.days.forEach(function (d) {
        var cls = d.off ? 'off' : (d.flags.length ? 'flag f-' + d.flags[0] : 'on');
        h += '<td class="' + cls + '">' + (d.off ? esc(d.label || 'off') : esc(d.raw.replace(/\s*b(reak)?\s*\d+/i, '')) + '<small>' + C.hdec(d.minutes) + '</small>') + '</td>';
      });
      var low = isFinite(w.rate) && w.rate < w.min;
      h += '<td>' + C.hdec(w.minutes) + '</td><td' + (low ? ' class="neg"' : '') + '>' + (isFinite(w.rate) ? C.money(w.rate) : '—') + '</td><td>' + C.money(w.min) + '</td><td>' + C.money(w.pay) + '</td><td>' + C.money(w.cost) + '</td></tr>';
    });
    h += '<tr class="cnt"><td>On the rota</td>';
    res.dayCount.forEach(function (n, i) { var need = res.need ? res.need[i] : 0; h += '<td class="' + (need > n ? 'neg' : '') + '">' + n + (need ? ' / ' + need : '') + '</td>'; });
    h += '<td>' + C.hdec(T.minutes) + '</td><td></td><td></td><td>' + C.money(T.pay) + '</td><td>' + C.money(T.cost) + '</td></tr></tbody></table></div>';
    out.innerHTML = h;
    fillWho();
  }

  function fillWho() {
    var s = $('who'); if (!s || !last) return;
    var cur = s.value;
    s.innerHTML = '<option value="">whole team</option>' + last.res.people.map(function (w) { return '<option>' + esc(w.name) + '</option>'; }).join('');
    s.value = cur;
  }

  /* */
  function check(key) {
    var i = 0;
    return new Promise(function (ok) {
      (function next() {
        if (i >= DOORS.length) return ok(false);
        var door = DOORS[i++];
        fetch('' + encodeURIComponent(key) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.ok) ok(true); else next(); }).catch(next);
      })();
    });
  }
  function unlock(key, quiet) {
    if (!key) return;
    $('keymsg').textContent = 'Checking your key…';
    check(key).then(function (ok) {
      if (ok) { pro = true; LS.setItem(K_KEY, key); doc.body.classList.add('is-pro'); $('keymsg').textContent = ' — Save and continue: https://getreadystack.com/apps/shift-planner-uk-rota-wage-cost/'; drawHist(); run(); }
      else { $('keymsg').textContent = quiet ? '' : 'That key is not valid for this product.'; }
    });
  }
  function data() { try { var d = JSON.parse(LS.getItem(K_DATA)); return d && d.teams ? d : { teams: {} }; } catch (e) { return { teams: {} }; } }
  function store(d) { LS.setItem(K_DATA, JSON.stringify(d)); }
  function needPro(what) {
    if (pro) return false;
    $('keymsg').textContent = what + '';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return true;
  }
  function teamName() { return ($('team').value || '').trim() || 'My team'; }

  function save() {
    if (needPro('Saving weeks') || !last) return;
    var d = data(), n = teamName(), t = d.teams[n] = d.teams[n] || { weeks: {} };
    t.weeks[last.week] = { week: last.week, grid: last.grid, rest: $('rest').value, hol: $('hol').value, ni: $('ni').checked };
    store(d); drawHist(); $('keymsg').textContent = 'Week of ' + C.fmtDate(last.week) + ' saved in "' + n + '".';
  }
  function nextWeek() {
    if (needPro('Copying to next week') || !last) return;
    if (!($('team').value || '').trim()) $('team').value = teamName();
    save();
    $('week').value = C.addDays(last.week, 7); run();
    $('keymsg').textContent = 'Week of ' + C.fmtDate(last.week) + ' made with the same shifts' + (last.chained ? ', chained: Sunday → Monday rest is now checked.' : '.');
  }
  function drawHist() {
    var d = data(), h = '';
    Object.keys(d.teams).forEach(function (n) {
      var wk = Object.keys(d.teams[n].weeks).sort().map(function (k) {
        var w = d.teams[n].weeks[k]; return { start: k, res: C.analyze(C.parseGrid(w.grid), { week: k, rest: w.rest, holidayPct: w.hol, ni: w.ni }) };
      });
      var S = C.summary(wk);
      h += '<h3>' + esc(n) + ' · ' + wk.length + (wk.length === 1 ? ' week' : ' weeks') + ' (' + wk.map(function (x) { return C.shortDate(x.start); }).join(', ') + ')</h3><div class="tbl"><table><thead><tr><th>Name</th><th>Weeks</th><th>Hours</th><th>Average a week</th><th>Pay</th><th>Cost</th><th>Problems</th></tr></thead><tbody>';
      S.forEach(function (x) { h += '<tr><td>' + esc(x.name) + '</td><td>' + x.weeks + '</td><td>' + C.hdec(x.minutes) + '</td><td' + (x.avgOver ? ' class="neg"' : '') + '>' + C.hdec(x.avg) + (x.avgOver ? ' (over 48)' : '') + '</td><td>' + C.money(x.pay) + '</td><td>' + C.money(x.cost) + '</td><td>' + x.issues + '</td></tr>'; });
      h += '</tbody></table></div>';
    });
    $('hist').innerHTML = h || '<p class="hint">No saved weeks yet.</p>';
  }
  function download(name, text, type) {
    var a = doc.createElement('a'); a.href = window.URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    doc.body.appendChild(a); a.click(); setTimeout(function () { window.URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'; }
  function fileName(kind, ext) { return 'rota-' + slugify(teamName()) + '-' + kind + '-' + (last ? last.week : 'week') + '.' + ext; }
  function readFile(input, cb) { var f = input.files && input.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { cb(String(r.result)); input.value = ''; }; r.readAsText(f); }

  doc.addEventListener('DOMContentLoaded', function () {
    $('go').addEventListener('click', run);
    $('clear').addEventListener('click', function () { $('grid').value = 'Name\tAge\t£/hour\tMon\tTue\tWed\tThu\tFri\tSat\tSun\n'; $('grid').focus(); });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-k]'), function (el) { el.addEventListener('change', run); });
    $('team').addEventListener('change', function () { if (pro) run(); });
    $('ni').addEventListener('change', run);
    $('unlock').addEventListener('click', function () { unlock(($('key').value || '').trim()); });
    $('save').addEventListener('click', save);
    $('next').addEventListener('click', nextWeek);
    $('print').addEventListener('click', function () {
      if (needPro('Printing the rota') || !last) return;
      var t = doc.createElement('p'); t.className = 'say printhead';
      t.innerHTML = '<b>' + esc(teamName()) + '</b> · rota for the week of ' + C.fmtDate(last.week);
      $('out').insertBefore(t, $('out').firstChild); doc.body.classList.add('print-rota'); window.print();
      setTimeout(function () { t.remove(); doc.body.classList.remove('print-rota'); }, 1000);
    });
    $('csv').addEventListener('click', function () { if (needPro('The payroll CSV') || !last) return; download(fileName('payroll', 'csv'), C.toCSV(last.res), 'text/csv;charset=utf-8'); });
    $('ics').addEventListener('click', function () { if (needPro('The calendar file') || !last) return; var w = $('who').value; download(fileName(w ? slugify(w) : 'team', 'ics'), C.ics(last.res, w, teamName()), 'text/calendar'); });
    $('backup').addEventListener('click', function () { if (needPro('The backup')) return; download('shift-planner-backup.json', JSON.stringify(data(), null, 1), 'application/json'); });
    $('restore').addEventListener('change', function () {
      if (needPro('Restoring a backup')) return;
      readFile($('restore'), function (txt) { try { var d = JSON.parse(txt); if (d && d.teams) { store(d); drawHist(); $('keymsg').textContent = 'Backup restored.'; } } catch (e) { $('keymsg').textContent = 'That file is not a shift planner backup.'; } });
    });
    var m = /[#&]k=([^&]+)/.exec(location.hash);
    var k = m ? decodeURIComponent(m[1]) : LS.getItem(K_KEY);
    if (k) { $('key').value = k; unlock(k, !m); }
    window.addEventListener('hashchange', function () { var hh = /[#&]k=([^&]+)/.exec(location.hash); if (hh) { $('key').value = decodeURIComponent(hh[1]); unlock($('key').value); } });
    run();
  });
})();
