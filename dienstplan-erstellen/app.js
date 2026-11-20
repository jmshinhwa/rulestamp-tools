(function () {
  'use strict';
  var doc = document, LS = window.localStorage, DP = window.DP;
  var SLUG = 'dienstplan-erstellen', DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  var K_KEY = SLUG + ':key', K_WEEKS = SLUG + ':weeks', K_CUR = SLUG + ':cur';
  var pro = false, cur = null;
  var TYP = { rest: 'Ruhezeit unter 11 h (§ 5)', rest10: 'Ruhezeit verkürzt (§ 5 Abs. 2)', pause: 'Pause zu kurz (§ 4)', max10: 'Mehr als 10 h am Tag (§ 3)', milo: 'Unter Mindestlohn', mini: 'Minijob über der Grenze', week60: 'Mehr als 60 h in der Woche', overlap: 'Schichten überschneiden sich' };
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function input() { return { woche: $('woche').value || '2026-12-28', branche: $('branche').value, team: $('team').value, plan: $('plan').value }; }
  function weeks() { return jget(K_WEEKS, {}); }
  function prevShifts(inp) {
    if (!pro) return [];
    var w = weeks()[DP.addDays(DP.monday(inp.woche), -7)];
    return w ? DP.check(w).shifts : [];
  }

  function draw() {
    var inp = input(); inp.prev = prevShifts(inp);
    var r = DP.check(inp); cur = { inp: inp, r: r };
    var c = r.count;
    $('r-label').textContent = 'Dienstplan ' + DP.dmyy(r.mon) + ' – ' + DP.dmyy(r.sun) + ' · ' + r.order.length + ' Personen · ' + r.shifts.length + ' Schichten';
    $('r-big').textContent = r.hard === 0 ? '0 Verstöße' : r.hard + (r.hard === 1 ? ' Verstoß' : ' Verstöße');
    $('r-big').className = 'r-big' + (r.hard ? ' bad' : ' ok');
    $('r-loss').textContent = r.hard
      ? 'Ruhezeit, Pausen und Höchstarbeitszeit: Bußgeld bis 30.000 € (§ 22 ArbZG). Lohn unter dem Mindestlohn: bis 500.000 € (§ 21 MiLoG).'
      : 'Kein Verstoß gegen §§ 3, 4, 5 ArbZG, Mindestlohn oder Minijob-Grenze in dieser Woche.';
    $('t-rest').textContent = c.rest; $('t-rest').parentNode.classList.toggle('bad', c.rest > 0);
    $('t-rest-n').textContent = c.rest10 ? '+ ' + c.rest10 + ' verkürzt auf 10 h (Ausgleich nötig)' : 'zwischen Schichtende und nächstem Beginn';
    $('t-pause').textContent = c.pause; $('t-pause').parentNode.classList.toggle('bad', c.pause > 0);
    $('t-milo').textContent = DP.eur(r.tot.short); $('t-milo').parentNode.classList.toggle('bad', r.tot.short > 0);
    $('t-milo-n').textContent = r.miloMon === r.miloSun ? 'Mindestlohn ' + DP.eur(r.miloSun) + '/Std.' : DP.eur(r.miloMon) + ' bis 31.12., ' + DP.eur(r.miloSun) + ' ab 01.01.';
    $('t-mini').textContent = c.mini; $('t-mini').parentNode.classList.toggle('bad', c.mini > 0);
    $('t-mini-n').textContent = 'Grenze ' + DP.eur0(r.cap) + ' im Monat (' + r.capYear + ')';
    $('t-cost').textContent = DP.eur(r.tot.payLegal);
    $('t-cost-n').textContent = DP.std(r.tot.min) + (r.tot.short > 0 ? ' · mit Mindestlohn gerechnet' : '');
    $('t-max').textContent = c.max10 + c.week60;
    $('t-max').parentNode.classList.toggle('bad', c.max10 + c.week60 > 0);
    var order = { rest: 0, overlap: 0, max10: 1, pause: 2, milo: 3, mini: 4, week60: 5, rest10: 6 };
    var list = r.v.slice().sort(function (a, b) { return order[a.typ] - order[b.typ] || (a.date < b.date ? -1 : 1); });
    $('fixes').innerHTML = list.length ? list.map(function (x) {
      return '<li class="' + (x.typ === 'rest10' ? 'warn' : 'bad') + '"><b>' + esc(TYP[x.typ]) + ':</b> ' + esc(x.text) + ' → <span class="fix">' + esc(x.fix) + '</span></li>';
    }).join('') : ' — Speichern und weitermachen: https://getreadystack.com/de/apps/dienstplan-erstellen/';
    drawTable(r);
    $('errs').innerHTML = r.err.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('');
    try { LS.setItem(K_CUR, JSON.stringify(input())); } catch (e) {}
    if (pro) drawPro();
  }

  function drawTable(r) {
    var h = '<table class="wk"><thead><tr><th>Name</th>' + r.days.map(function (d) { return '<th>' + DP.tagLabel(d) + '</th>'; }).join('') + '<th>Std.</th></tr></thead><tbody>';
    r.order.forEach(function (n) {
      var p = r.people[n]; if (!p) return;
      h += '<tr><th>' + esc(n) + '<small>' + esc(DP.ART_LABEL[p.art] || '') + ' · ' + esc(DP.eur(p.lohn)) + '</small></th>';
      r.days.forEach(function (d) {
        var s = p.shifts.filter(function (x) { return x.date === d; });
        h += '<td>' + s.map(function (x) {
          var f = x.flags || [], cls = f.length ? (f.every(function (y) { return y === 'rest10'; }) ? 'warn' : 'bad') : '';
          return '<span class="sh ' + cls + '">' + DP.hm(x.start) + '–' + DP.hm(x.end) + (x.pause ? '<i>P ' + x.pause + '</i>' : '') + '</span>';
        }).join('') + '</td>';
      });
      h += '<td class="n">' + DP.std(p.min).replace(' Std.', '') + '</td></tr>';
    });
    $('table').innerHTML = h + '</tbody></table>';
  }

  /* ---------- Pro ---------- */
  function unlockUI() {
    pro = true; doc.body.classList.add('is-pro');
    $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/dienstplan-erstellen/'; draw();
  }
  function tryKey(k) {
    k = String(k || '').trim(); if (!k) return;
    $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/dienstplan-erstellen/';
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/dienstplan-erstellen/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (res) { return res.json(); }).then(function (j) {
        if (j && j.ok) { try { LS.setItem(K_KEY, k); } catch (e) {} unlockUI(); } else next();
      }).catch(next);
    })();
  }
  function need() { if (!pro) { $('pro').scrollIntoView({ behavior: 'smooth' }); $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/dienstplan-erstellen/'; return true; } return false; }

  function drawPro() {
    var w = weeks(), keys = Object.keys(w).sort();
    $('saved').innerHTML = keys.length ? '<ul>' + keys.map(function (k) {
      var r = DP.check(w[k]);
      return '<li><button type="button" class="ghost load" data-w="' + k + '">' + DP.dmyy(k) + ' – ' + DP.dmyy(DP.addDays(k, 6)) + '</button> ' + r.shifts.length + ' Schichten · ' + (r.hard ? r.hard + ' Verstöße' : 'ohne Verstoß') + ' <button type="button" class="del" data-del="' + k + '" aria-label="Woche löschen">×</button></li>';
    }).join('') + '</ul>' : '<p class="hint">Noch keine Woche gespeichert.</p>';
    var ym = $('monat').value || cur.r.mon.slice(0, 7);
    var m = DP.month(keys.map(function (k) { return w[k]; }), ym), names = Object.keys(m.per);
    $('month').innerHTML = names.length ? '<table class="mt"><thead><tr><th>Name</th><th>Stunden</th><th>Lohn (mit Mindestlohn)</th><th>Minijob-Grenze ' + DP.eur0(m.cap) + '</th></tr></thead><tbody>' + names.map(function (n) {
      var x = m.per[n];
      return '<tr' + (x.over ? ' class="bad"' : '') + '><td>' + esc(n) + '</td><td>' + DP.std(x.min) + '</td><td>' + DP.eur(x.payLegal) + '</td><td>' + (x.art === 'mini' ? (x.over ? 'ÜBER der Grenze um ' + DP.eur(x.payLegal - m.cap) : 'noch ' + DP.eur(m.cap - x.payLegal)) : '–') + '</td></tr>';
    }).join('') + '</tbody></table><p class="hint">Nur gespeicherte Wochen zählen; Schichten werden dem Monat ihres Datums zugeordnet.</p>' : '<p class="hint">Für ' + ym + ' ist noch keine Woche gespeichert.</p>';
  }
  function saveWeek() {
    if (need()) return;
    var w = weeks(), inp = input(); w[DP.monday(inp.woche)] = { woche: DP.monday(inp.woche), branche: inp.branche, team: inp.team, plan: inp.plan }; jset(K_WEEKS, w); drawPro();
    $('keymsg').textContent = 'Woche ' + DP.dmyy(DP.monday(inp.woche)) + ' gespeichert.';
  }
  function nextWeek() {
    if (need()) return;
    saveWeek();
    var r = cur.r, n = DP.addDays(r.mon, 7);
    $('plan').value = r.shifts.map(function (s) { return s.name + '; ' + DP.TAG_KURZ[DP.weekday(s.date)] + '; ' + DP.hm(s.start) + '-' + DP.hm(s.end) + '; ' + s.pause; }).join('\n');
    $('woche').value = n; draw();
  }
  function openPrint(title, body) {
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write('<!doctype html><html lang="de"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font:12px/1.35 system-ui,sans-serif;margin:16mm}h1{font-size:18px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #888;padding:4px 5px;text-align:left;vertical-align:top}th{background:#eee}.bad{background:#fde2e1}.warn{background:#fff3cd}small{color:#555}.sig{margin-top:28px;display:flex;gap:40px}.sig div{border-top:1px solid #000;padding-top:3px;min-width:200px}@page{size:A4 landscape;margin:10mm}@media print{.np{display:none}}</style></head><body>' + body + '<p class="np"><button onclick="print()">Drucken / als PDF speichern</button></p></body></html>');
    w.document.close();
  }
  function printPlan() {
    if (need()) return;
    var r = cur.r;
    var b = '<h1>Dienstplan ' + DP.dmyy(r.mon) + ' – ' + DP.dmyy(r.sun) + '</h1><small>Stand: ' + DP.dmyy(new Date().toISOString().slice(0, 10)) + ' · Pausen in Minuten (P) · geprüft: §§ 3, 4, 5 ArbZG, Mindestlohn, Minijob-Grenze</small>' + $('table').innerHTML;
    b += r.v.length ? '<h2 style="font-size:14px">Offene Punkte (' + r.v.length + ')</h2><ul>' + r.v.map(function (x) { return '<li>' + esc(x.text) + ' → ' + esc(x.fix) + '</li>'; }).join('') + '</ul>' : '<p>Keine Verstöße gefunden.</p>';
    b += '<p><small>Aushang nach § 16 ArbZG: Gesetz und geltende Tarifverträge zusätzlich zugänglich machen. Arbeitszeit über 8 Std. an Werktagen aufzeichnen und 2 Jahre aufbewahren (§ 16 Abs. 2 ArbZG).</small></p>';
    openPrint('Dienstplan ' + DP.dmyy(r.mon), b);
  }
  function printSheets() {
    if (need()) return;
    var w = weeks(), keys = Object.keys(w).sort(), ym = $('monat').value || cur.r.mon.slice(0, 7);
    var src = keys.map(function (k) { return w[k]; });
    if (!w[cur.r.mon]) src.push(cur.inp);
    var m = DP.month(src, ym), b = '';
    Object.keys(m.per).forEach(function (n, i) {
      var x = m.per[n];
      b += '<section style="' + (i ? 'page-break-before:always' : '') + '"><h1>Stundenzettel ' + esc(n) + ' · ' + ym.slice(5) + '/' + ym.slice(0, 4) + '</h1><small>' + esc(DP.ART_LABEL[x.art] || '') + ' · Aufzeichnung von Beginn, Ende und Dauer der täglichen Arbeitszeit (§ 17 MiLoG: spätestens bis zum 7. Tag danach, 2 Jahre aufbewahren)</small>';
      b += '<table><thead><tr><th>Datum</th><th>Beginn</th><th>Ende</th><th>Pause (Min.)</th><th>Dauer</th></tr></thead><tbody>' + x.rows.map(function (q) {
        return '<tr><td>' + DP.tagLabel(q.date) + q.date.slice(0, 4) + '</td><td>' + q.start + '</td><td>' + q.end + '</td><td>' + q.pause + '</td><td>' + DP.dur(q.net) + '</td></tr>';
      }).join('') + '<tr><th colspan="4">Summe</th><th>' + DP.dur(x.min) + '</th></tr></tbody></table>';
      b += '<p>Lohn mit Mindestlohn: ' + DP.eur(x.payLegal) + (x.art === 'mini' ? ' · Minijob-Grenze ' + DP.eur0(m.cap) + (x.over ? ' <b>überschritten</b>' : '') : '') + '</p><div class="sig"><div>Datum, Unterschrift Arbeitgeber</div><div>Datum, Unterschrift ' + esc(n) + '</div></div></section>';
    });
    openPrint('Stundenzettel ' + ym, b || '<p>Keine Schichten in diesem Monat.</p>');
  }
  function download(name, type, text) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function readFile(inp, cb) { var f = inp.files && inp.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { cb(String(fr.result)); inp.value = ''; }; fr.readAsText(f); }

  function bind() {
    ['woche', 'branche', 'team', 'plan'].forEach(function (id) { $(id).addEventListener('input', draw); $(id).addEventListener('change', draw); });
    $('reset').addEventListener('click', function () { try { LS.removeItem(K_CUR); } catch (e) {} location.reload(); });
    $('unlock').addEventListener('click', function () { tryKey($('key').value); });
    $('save').addEventListener('click', saveWeek);
    $('next').addEventListener('click', nextWeek);
    $('monat').addEventListener('change', function () { if (pro) drawPro(); });
    $('saved').addEventListener('click', function (e) {
      var t = e.target, w = weeks();
      if (t.dataset.w && w[t.dataset.w]) { var x = w[t.dataset.w]; $('woche').value = x.woche; $('branche').value = x.branche; $('team').value = x.team; $('plan').value = x.plan; draw(); }
      if (t.dataset.del) { delete w[t.dataset.del]; jset(K_WEEKS, w); drawPro(); }
    });
    $('print').addEventListener('click', printPlan);
    $('sheets').addEventListener('click', printSheets);
    $('csv').addEventListener('click', function () { if (need()) return; download('dienstplan-' + cur.r.mon + '.csv', 'text/csv;charset=utf-8', '﻿' + DP.toCSV(cur.r.shifts)); });
    $('csvin').addEventListener('change', function () { if (need()) return; readFile($('csvin'), function (t) { $('plan').value = DP.fromCSV(t.replace(/^﻿/, '')); draw(); }); });
    $('ics').addEventListener('click', function () {
      if (need()) return;
      var n = $('icsname').value, stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
      download('schichten-' + (n || 'alle') + '-' + cur.r.mon + '.ics', 'text/calendar', DP.ics(cur.r.shifts, n, stamp));
    });
    $('backup').addEventListener('click', function () { if (need()) return; download('dienstplan-backup.json', 'application/json', JSON.stringify({ weeks: weeks(), cur: input() }, null, 1)); });
    $('restore').addEventListener('change', function () { if (need()) return; readFile($('restore'), function (t) { try { var j = JSON.parse(t); if (j.weeks) jset(K_WEEKS, j.weeks); drawPro(); } catch (e) { $('keymsg').textContent = 'Backup nicht lesbar.'; } }); });
  }

  function fillIcsNames() {
    var r = cur.r; $('icsname').innerHTML = '<option value="">alle</option>' + r.order.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');
  }

  function start() {
    if (!$('branche').options.length) $('branche').innerHTML = DP.BRANCHEN.map(function (b) { return '<option value="' + b[0] + '"' + (b[0] === 'gastro' ? ' selected' : '') + '>' + esc(b[1]) + '</option>'; }).join('');
    var saved = jget(K_CUR, null);
    if (saved && saved.plan) { $('woche').value = saved.woche; $('branche').value = saved.branche; $('team').value = saved.team; $('plan').value = saved.plan; }
    bind(); draw(); fillIcsNames();
    $('team').addEventListener('change', function () { fillIcsNames(); });
    var hk = (location.hash.match(/[#&]k=([^&]+)/) || [])[1];
    var k = hk ? decodeURIComponent(hk) : LS.getItem(K_KEY);
    if (k) { $('key').value = k; tryKey(k); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
