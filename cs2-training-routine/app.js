/* CS2 Training Routine – Seite */
(function () {
  'use strict';
  var doc = document, LS = window.localStorage, E = window.CSR;
  var SLUG = 'cs2-training-routine', DOORS = [SLUG, SLUG + '.yearly'], K_KEY = 'cs2r_key', K_DATA = 'cs2r_data';
  var IDS = ['min', 'days', 'role', 'aim_c', 'aim_t', 'spray_c', 'spray_t', 'strafe_c', 'strafe_t', 'util_c', 'util_t', 'dm_c', 'dm_t'];
  var SAMPLE = {}, pro = false, last = null;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function de(n, d) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 1 : d }); }
  function today() { return E.ymd(new Date()); }
  function read() { var o = {}; IDS.forEach(function (k) { o[k] = $(k).value; }); return o; }
  function fill(o) { IDS.forEach(function (k) { if (o && o[k] != null) $(k).value = o[k]; }); }
  IDS.forEach(function (k) { SAMPLE[k] = $(k).value; });

  function render() {
    var inp = read(), p = E.plan(inp); last = p;
    var f = p.focus, g = p.gaps, h = '';
    h += '<p class="big">Heute ' + p.min + ' Minuten: <b>' + p.per[f.id] + ' min ' + esc(f.name) + '</b></p>';
    h += '<div class="kpis">';
    h += '<div><b>' + de(p.monthH) + ' h</b><span>Training im Monat (' + p.min + ' min × ' + p.days + ' Tage = ' + p.weekMin + ' min/Woche)</span></div>';
    h += '<div><b>' + de(f.miss) + ' von ' + de(f.tgt) + '</b><span>' + esc(f.unit) + ' fehlen bei ' + esc(f.name) + '</span></div>';
    if (p.atTarget.length) h += '<div><b>' + p.waste + ' min</b><span>pro Woche gingen gleich verteilt in ' + esc(p.atTarget.map(function (a) { return a.name; }).join(' + ')) + ' – schon am Ziel</span></div>';
    else h += '<div><b>+' + p.focusMore + ' min</b><span>pro Woche ' + esc(f.name) + ' gegenüber gleicher Verteilung</span></div>';
    h += '</div>';
    h += '<table class="today"><tr><th>min</th><th>Bereich</th><th>Übung heute (' + p.week[0].day + ')</th></tr>';
    p.week[0].items.forEach(function (i) { h += '<tr><td class="n">' + i.min + '</td><td>' + esc(i.name) + '</td><td>' + esc(i.drill) + '</td></tr>'; });
    h += '</table>';
    h += '<p class="gaps">' + g.map(function (x) { return esc(x.name) + ' ' + de(x.cur) + '/' + de(x.tgt) + (x.miss ? ' (−' + de(x.miss) + ')' : ' ✓'); }).join(' · ') + ' · Rolle: ' + esc(p.role) + '</p>';
    $('out').innerHTML = h;

    var w = '<div class="tbl"><table><tr><th>Tag</th><th>Aufw.</th>' + E.SK.map(function (s) { return '<th>' + esc(s.name) + '</th>'; }).join('') + '<th>Demo</th></tr>';
    p.week.forEach(function (d) {
      w += '<tr><td>' + d.day + '</td><td>' + p.warm + '</td>' + E.SK.map(function (s) { return '<td>' + (p.per[s.id] || '–') + '</td>'; }).join('') + '<td>' + (p.review || '–') + '</td></tr>';
    });
    w += '<tr class="sum"><td>Woche</td><td>' + p.warm * p.days + '</td>' + E.SK.map(function (s) { return '<td>' + p.weekly[s.id] + '</td>'; }).join('') + '<td>' + p.review * p.days + '</td></tr></table></div>';
    w += '<details><summary>Alle Übungen der Woche</summary><ol>';
    p.week.forEach(function (d) { w += '<li><b>' + d.day + '</b>: ' + d.items.map(function (i) { return i.min + ' min ' + esc(i.name) + ' – ' + esc(i.drill); }).join('; ') + '</li>'; });
    w += '</ol></details>';
    w += '<p class="hint">Gleich verteilt hätte jeder der 5 Bereiche ' + de(p.even) + ' min am Tag. Dein Plan: ' + E.SK.map(function (s) { return esc(s.name) + ' ' + p.per[s.id]; }).join(' · ') + ' min.</p>';
    $('week').innerHTML = w;
    $('tests').innerHTML = '<ul>' + E.SK.map(function (s) { return '<li><b>' + esc(s.name) + '</b>: ' + esc(s.test) + '.</li>'; }).join('') + '</ul>';
    if (pro) drawPro();
    return p;
  }

  /* ---- Schlüssel ---- */
  function check(key) {
    var k = 0;
    return new Promise(function (ok) {
      (function next() {
        if (k >= DOORS.length) return ok(false);
        var door = DOORS[k++];
        fetch('' + encodeURIComponent(key) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.ok) ok(true); else next(); }).catch(next);
      })();
    });
  }
  function unlock(key, quiet) {
    if (!key) return;
    $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/cs2-training-routine/';
    check(key).then(function (ok) {
      if (ok) { setPro(true); try { LS.setItem(K_KEY, key); } catch (e) {} $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/cs2-training-routine/'; }
      else $('keymsg').textContent = quiet ? '' : ' — Speichern und weitermachen: https://getreadystack.com/de/apps/cs2-training-routine/';
    });
  }
  function setPro(v) { pro = v; doc.body.classList.toggle('is-pro', v); if (v) { var d = data(); fill(d.profiles[d.cur].inp); render(); } }
  function needPro(what) {
    if (pro) return false;
    $('keymsg').textContent = what + ' — Speichern und weitermachen: https://getreadystack.com/de/apps/cs2-training-routine/';
    $('pro').scrollIntoView({ behavior: 'smooth' }); return true;
  }

  /* ---- Pro-Daten (nur in diesem Browser) ---- */
  function data() {
    var d; try { d = JSON.parse(LS.getItem(K_DATA) || 'null'); } catch (e) { d = null; }
    if (!d || !d.profiles) d = { cur: 'Main', profiles: { Main: { inp: read(), log: [] } } };
    if (!d.profiles[d.cur]) d.cur = Object.keys(d.profiles)[0];
    return d;
  }
  function store(d) { try { LS.setItem(K_DATA, JSON.stringify(d)); } catch (e) {} }
  function prof() { var d = data(); return { d: d, p: d.profiles[d.cur] }; }
  function keepInputs() { if (!pro) return; var x = prof(); x.p.inp = read(); store(x.d); }

  function drawPro() {
    var x = prof(), P = x.p, d = x.d;
    $('prof').innerHTML = Object.keys(d.profiles).map(function (n) { return '<option' + (n === d.cur ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
    if (!$('l_date').value) $('l_date').value = today();
    var a = E.adapt(read(), P.log, today()), h = '<h3>Dein Plan aus den letzten 7 Tagen</h3>';
    var nn = Object.keys(a.recent.n).length;
    if (!nn) h += '<p class="hint">Noch keine Einträge in den letzten 7 Tagen – der Plan nutzt deine Werte von oben.</p>';
    else {
      h += '<p>' + E.SK.map(function (s) { return esc(s.name) + ' Ø ' + (a.recent.avg[s.id] != null ? de(a.recent.avg[s.id]) : '–') + '/' + de(a.inp.tgt[s.id]); }).join(' · ') + '</p>';
      h += a.changes.length ? '<p><b>Geändert:</b> ' + a.changes.map(function (c) { return esc(c.name) + ' ' + c.from + ' → ' + c.to + ' min'; }).join(' · ') + '</p>' : '<p>Keine Änderung gegenüber deinem Startplan.</p>';
    }
    h += '<p>Tagesplan: Aufwärmen ' + a.warm + ' · ' + E.SK.map(function (s) { return esc(s.name) + ' ' + a.per[s.id]; }).join(' · ') + (a.review ? ' · Demo ' + a.review : '') + ' min · Serie: ' + E.streak(P.log, today()) + ' Tage</p>';
    $('adapt').innerHTML = h;
    $('chart').innerHTML = chart(E.weeks(P.log, a.inp.tgt).slice(-8));
    var rows = P.log.slice().sort(function (p, q) { return p.date < q.date ? 1 : -1; });
    $('hist').innerHTML = rows.length ? '<div class="tbl"><table><tr><th>Datum</th>' + E.SK.map(function (s) { return '<th>' + esc(s.name) + '</th>'; }).join('') + '<th>Notiz</th><th></th></tr>' +
      rows.map(function (e) { return '<tr><td>' + esc(e.date) + '</td>' + E.SK.map(function (s) { return '<td>' + (e[s.id] == null || e[s.id] === '' ? '–' : de(e[s.id])) + '</td>'; }).join('') + '<td>' + esc(e.note || '') + '</td><td><button class="del" data-d="' + esc(e.date) + '">×</button></td></tr>'; }).join('') + '</table></div>' : '';
  }
  var COL = { aim: '#e8590c', spray: '#1971c2', strafe: '#2f9e44', util: '#9c36b5', dm: '#495057' };
  function chart(ws) {
    if (!ws.length) return '';
    var W = 520, H = 200, L = 34, B = 24, n = ws.length, max = 120;
    var X = function (i) { return L + (n === 1 ? (W - L) / 2 : i * (W - L - 10) / (n - 1)); }, Y = function (v) { return H - B - Math.min(v, max) / max * (H - B - 10); };
    var s = '<h3>Fortschritt pro Woche (% deines Ziels)</h3><svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Fortschritt pro Woche">';
    [0, 50, 100].forEach(function (v) { s += '<line x1="' + L + '" x2="' + W + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#ddd"/><text x="2" y="' + (Y(v) + 4) + '" font-size="11">' + v + '%</text>'; });
    ws.forEach(function (w, i) { s += '<text x="' + (X(i) - 14) + '" y="' + (H - 6) + '" font-size="10">' + w.week.slice(5) + '</text>'; });
    E.SK.forEach(function (k) {
      var pts = ws.map(function (w, i) { return w[k.id] == null ? null : X(i).toFixed(1) + ',' + Y(w[k.id]).toFixed(1); }).filter(Boolean);
      if (!pts.length) return;
      s += '<polyline fill="none" stroke-width="2" stroke="' + COL[k.id] + '" points="' + pts.join(' ') + '"/>';
      pts.forEach(function (p) { var c = p.split(','); s += '<circle r="3" cx="' + c[0] + '" cy="' + c[1] + '" fill="' + COL[k.id] + '"/>'; });
    });
    s += '</svg><p class="legend">' + E.SK.map(function (k) { return '<span style="color:' + COL[k.id] + '">■</span> ' + esc(k.name); }).join(' ') + '</p>';
    return s;
  }
  function dl(name, type, body) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: type })); a.download = name;
    doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---- Ereignisse ---- */
  IDS.forEach(function (k) { $(k).addEventListener('input', function () { render(); keepInputs(); }); $(k).addEventListener('change', function () { render(); keepInputs(); }); });
  $('run').addEventListener('click', function () { render(); keepInputs(); $('out').scrollIntoView({ behavior: 'smooth' }); });
  $('sample').addEventListener('click', function () { fill(SAMPLE); render(); keepInputs(); });
  $('unlock').addEventListener('click', function () { unlock($('key').value.trim()); });
  $('save').addEventListener('click', function () {
    if (needPro('Das Tagesprotokoll')) return;
    var x = prof(), e = { date: $('l_date').value || today(), note: $('l_note').value.trim() }, any = false;
    E.SK.forEach(function (s) { var v = $('l_' + s.id).value.trim().replace(',', '.'); e[s.id] = v === '' || !isFinite(+v) ? null : +v; if (e[s.id] != null) any = true; });
    if (!any) { $('keymsg').textContent = 'Trag mindestens einen Messwert ein.'; return; }
    x.p.log = x.p.log.filter(function (o) { return o.date !== e.date; }).concat([e]); x.p.inp = read(); store(x.d);
    E.SK.forEach(function (s) { $('l_' + s.id).value = ''; }); $('l_note').value = ''; drawPro();
  });
  $('hist').addEventListener('click', function (ev) {
    var b = ev.target.closest('.del'); if (!b) return;
    var x = prof(); x.p.log = x.p.log.filter(function (o) { return o.date !== b.getAttribute('data-d'); }); store(x.d); drawPro();
  });
  $('prof').addEventListener('change', function () { var d = data(); d.cur = $('prof').value; store(d); fill(d.profiles[d.cur].inp); render(); });
  $('newprof').addEventListener('click', function () {
    if (needPro('Mehrere Profile')) return;
    var n = (window.prompt('Name des Profils (z. B. AWP oder Zweitaccount)') || '').trim().slice(0, 30); if (!n) return;
    var d = data(); if (!d.profiles[n]) d.profiles[n] = { inp: read(), log: [] }; d.cur = n; store(d); render();
  });
  $('raise').addEventListener('click', function () {
    if (needPro('Ziele anheben')) return;
    var a = E.adapt(read(), prof().p.log, today()), t = E.raise(a.inp.tgt, a.gaps), up = 0;
    E.SK.forEach(function (s) { if (t[s.id] !== a.inp.tgt[s.id]) { $(s.id + '_t').value = t[s.id]; up++; } });
    $('keymsg').textContent = up ? up + ' Ziel(e) um 10 % angehoben.' : 'Noch kein Ziel erreicht.'; render(); keepInputs();
  });
  $('ics').addEventListener('click', function () { if (needPro('Die Kalender-Erinnerung')) return; dl('cs2-training-routine.ics', 'text/calendar', E.ics(E.adapt(read(), prof().p.log, today()), $('rtime').value, today())); });
  $('print').addEventListener('click', function () { if (needPro('Der Druckplan')) return; doc.body.classList.add('printing'); window.print(); setTimeout(function () { doc.body.classList.remove('printing'); }, 500); });
  $('csv').addEventListener('click', function () { if (needPro('Der CSV-Export')) return; dl('cs2-protokoll.csv', 'text/csv;charset=utf-8', '﻿' + E.csv(prof().p.log)); });
  $('json').addEventListener('click', function () { if (needPro('Die Sicherung')) return; dl('cs2-training-routine.json', 'application/json', JSON.stringify(data(), null, 1)); });
  $('load').addEventListener('change', function () {
    if (needPro('Sicherung laden')) { this.value = ''; return; }
    var f = this.files[0]; if (!f) return; var r = new FileReader();
    r.onload = function () {
      try { var d = JSON.parse(r.result); if (!d || !d.profiles) throw 0; store(d); fill(data().profiles[data().cur].inp); render(); $('keymsg').textContent = 'Sicherung geladen.'; }
      catch (e) { $('keymsg').textContent = 'Diese Datei ist keine Sicherung dieses Plans.'; }
    };
    r.readAsText(f);
  });

  render();
  var hk = (location.hash.match(/[#&]k=([^&]+)/) || [])[1];
  if (hk) { try { hk = decodeURIComponent(hk); } catch (e) {} $('key').value = hk; unlock(hk); history.replaceState(null, '', location.pathname + location.search); }
  else { var sk = null; try { sk = LS.getItem(K_KEY); } catch (e) {} if (sk) unlock(sk, true); }
})();
