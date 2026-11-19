(function () {
  'use strict';
  var A = window.AZN, SLUG = 'arbeitszeitnachweis-vorlage-bau-7-tage-frist', DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  var PRICE = '$6.99 im Monat oder $59 im Jahr';
  var LS = { cur: 'azn.cur', key: 'azn.key', rows: 'azn.rows', team: 'azn.team' };
  var ART = { an: 'Arbeitnehmer', mini: 'Minijob', fam: 'Angehörige/r' };
  var ST = { ok: 'rechtzeitig', spaet: 'zu spät eingetragen', fehlt: 'fehlt, Frist vorbei', offen: 'noch offen', frei: 'keine Pflicht' };
  var WHAT = { month: 'den Monatsnachweis je Mitarbeiter mit Unterschriftszeile (Drucken oder PDF)', site: 'die Stundenliste je Baustelle zum Drucken oder als PDF',
    keep: 'die Aufbewahrungs-Liste mit Löschdatum nach 2 Jahren', ics: 'die wöchentliche Frist-Erinnerung (.ics)', csv: 'alle Wochen als CSV',
    csvin: 'den CSV-Import aus deiner Stempel-App', backup: 'die Sicherung aller Wochen', imp: 'das Laden einer Sicherung' };
  var fields = [].slice.call(document.querySelectorAll('[data-k]')), pro = false, R = null;
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(x, d) { return (+x || 0).toLocaleString('de-DE', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }); }
  function eur(x) { return num(x) + ' €'; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function d10(s) { return String(s || '').slice(0, 10); }
  var SAMPLE = A.sample();
  function rows() { return get(LS.rows, null) || A.sample().rows; }
  function team() { return get(LS.team, null) || A.sample().workers; }
  function read() {
    var v = {}; fields.forEach(function (f) { v[f.id] = f.value; });
    return { woche: A.okDate(d10(v.woche)) ? d10(v.woche) : SAMPLE.v.woche, branche: A.BRANCHEN[v.branche] ? v.branche : 'bau', pruef: A.okDate(d10(v.pruef)) ? d10(v.pruef) : today() };
  }
  function fill(v) { fields.forEach(function (f) { if (v[f.id] != null) f.value = v[f.id]; }); }

  function render() {
    var v = read(); put(LS.cur, v);
    R = A.pruefe(v, team(), rows());
    var kp = [
      [String(R.verstoesse), 'Einträge nach der 7-Tage-Frist (§ 17 MiLoG)'],
      ['bis 50.000 €', 'Bußgeldrahmen nach § 21 Abs. 3 MiLoG'],
      [eur(R.luecke), 'Mindestlohn-Lücke in KW ' + R.kw],
      [num(R.stunden) + ' Std.', 'Arbeitszeit der Kolonne in KW ' + R.kw]
    ];
    $('#kpi').innerHTML = kp.map(function (k, i) { return '<div' + (i === 0 && R.verstoesse ? ' class="bad"' : '') + '><b>' + esc(k[0]) + '</b><span>' + esc(k[1]) + '</span></div>'; }).join('');
    var t = 'KW ' + R.kw + ' (' + A.de(R.woche) + ' bis ' + A.de(R.bis) + '), geprüft am ' + A.de(R.pruef) + ': ';
    t += R.verstoesse ? R.spaet + ' zu spät eingetragen, ' + R.fehlt + (R.fehlt === 1 ? ' fehlt' : ' fehlen') + ' nach Fristende.' : 'kein Eintrag nach der Frist.';
    if (R.offen) t += ' ' + R.offen + ' noch offen, spätestens bis ' + A.de(R.naechste) + ' eintragen.';
    if (R.pause || R.zehn) t += ' ArbZG: ' + R.pause + ' Tage mit zu kurzer Pause, ' + R.zehn + ' Tag über 10 Std.';
    if (R.frei) t += ' ' + R.frei + ' Zeilen ohne Aufzeichnungspflicht.';
    $('#verdict').textContent = t;
    var show = R.zeilen.filter(function (z) { return z.st === 'spaet' || z.st === 'fehlt' || z.st === 'offen' || z.flags.length; });
    $('#st tbody').innerHTML = (show.length ? show : R.zeilen).map(function (z) {
      return '<tr class="' + z.st + '"><td>' + A.wtag(z.d) + ' ' + A.de(z.d).slice(0, 6) + '</td><td>' + esc(z.name) + '</td><td class="n">' + num(z.h) + '</td><td>' + A.de(z.frist) + '</td><td>' +
        esc(ST[z.st]) + (z.ein ? ' (' + A.de(z.ein) + ')' : '') + (z.flags.length ? '<br><small>' + esc(z.flags.join(' · ')) + '</small>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="5">Für diese Woche steht noch keine Zeile in der Tabelle unten.</td></tr>';
    $('#bs tbody').innerHTML = Object.keys(R.baustellen).map(function (k) { return '<tr><td>' + esc(k) + '</td><td class="n">' + num(R.baustellen[k]) + ' Std.</td></tr>'; }).join('') +
      '<tr class="sum"><td>Summe</td><td class="n">' + num(R.stunden) + ' Std.</td></tr>';
    $('#ml').textContent = R.luecke2027 > 0 && R.woche < '2027-01-01'
      ? 'Ab 01.01.2027 gilt 14,60 € je Stunde: dieselbe Woche hätte dann ' + eur(R.luecke2027) + ' Mindestlohn-Lücke. Löhne vor dem Jahreswechsel anpassen.'
      : (R.luecke > 0 ? 'Mindestlohn-Lücke = (Mindestlohn − Stundenlohn) × Stunden, je Tag nach Datum.' : 'Alle Stundenlöhne liegen auf oder über dem Mindestlohn des jeweiligen Tages.');
    drawTeam(false);
  }

  function drawTeam(full) {
    var v = read(), T = team();
    if (full !== false) {
      $('#wt tbody').innerHTML = T.map(function (w, i) {
        return '<tr><td><input data-w="name" data-i="' + i + '" value="' + esc(w.name) + '"></td><td><select data-w="art" data-i="' + i + '">' +
          Object.keys(ART).map(function (a) { return '<option value="' + a + '"' + (w.art === a ? ' selected' : '') + '>' + ART[a] + '</option>'; }).join('') + '</select></td>' +
          '<td><input type="number" step="0.01" min="0" data-w="lohn" data-i="' + i + '" value="' + esc(w.lohn) + '"></td>' +
          '<td><input type="number" step="10" min="0" data-w="brutto" data-i="' + i + '" value="' + esc(w.brutto || '') + '"></td>' +
          '<td><select data-w="zwoelf" data-i="' + i + '"><option value="nein">nein</option><option value="ja"' + (w.zwoelf === 'ja' ? ' selected' : '') + '>ja</option></select></td>' +
          '<td class="pf" data-pf="' + i + '"></td><td><button type="button" class="link" data-wdel="' + i + '">entfernen</button></td></tr>';
      }).join('');
      [].forEach.call(document.querySelectorAll('#wt [data-w]'), function (el) {
        el.addEventListener('change', function () {
          var T2 = team(), i = +el.getAttribute('data-i'), k = el.getAttribute('data-w'), old = T2[i].name;
          T2[i][k] = (k === 'lohn' || k === 'brutto') ? (+el.value || 0) : el.value; put(LS.team, T2);
          if (k === 'name' && old !== el.value) { put(LS.rows, rows().map(function (r) { if (r.name === old) r.name = el.value; return r; })); drawRows(); }
          render();
        });
      });
      [].forEach.call(document.querySelectorAll('[data-wdel]'), function (b) { b.onclick = function () { var T2 = team(); T2.splice(+b.getAttribute('data-wdel'), 1); put(LS.team, T2); drawTeam(); drawRows(); render(); }; });
    }
    T.forEach(function (w, i) { var c = document.querySelector('[data-pf="' + i + '"]'); if (c) { var p = A.pflicht(v.branche, w); c.textContent = (p.on ? 'ja: ' : 'nein: ') + p.why; } });
  }

  function weekRows() { var v = read(), wk = A.monday(v.woche), bis = A.addDays(wk, 6); return rows().map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return x.r.d >= wk && x.r.d <= bis; }); }
  function drawRows() {
    var names = team().map(function (w) { return w.name; });
    $('#dt tbody').innerHTML = weekRows().sort(function (a, b) { return (a.r.d + a.r.name) < (b.r.d + b.r.name) ? -1 : 1; }).map(function (x) {
      var r = x.r, i = x.i, nm = names.indexOf(r.name) < 0 ? names.concat([r.name]) : names;
      return '<tr><td><select data-r="name" data-i="' + i + '">' + nm.map(function (n) { return '<option' + (n === r.name ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></td>' +
        '<td><input type="date" data-r="d" data-i="' + i + '" value="' + esc(r.d) + '"></td><td><input data-r="ort" data-i="' + i + '" value="' + esc(r.ort) + '"></td>' +
        '<td><input type="time" data-r="b" data-i="' + i + '" value="' + esc(r.b) + '"></td><td><input type="time" data-r="e" data-i="' + i + '" value="' + esc(r.e) + '"></td>' +
        '<td><input type="number" min="0" step="5" data-r="p" data-i="' + i + '" value="' + esc(r.p) + '"></td><td class="n">' + num(A.dauer(r.b, r.e, r.p)) + '</td>' +
        '<td><input type="date" data-r="ein" data-i="' + i + '" value="' + esc(r.ein) + '"></td><td><button type="button" class="link" data-del="' + i + '">×</button></td></tr>';
    }).join('');
    [].forEach.call(document.querySelectorAll('#dt [data-r]'), function (el) {
      el.addEventListener('change', function () {
        var all = rows(), i = +el.getAttribute('data-i'), k = el.getAttribute('data-r');
        all[i][k] = k === 'p' ? (+el.value || 0) : el.value; put(LS.rows, all); drawRows(); render();
      });
    });
    [].forEach.call(document.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { var all = rows(); all.splice(+b.getAttribute('data-del'), 1); put(LS.rows, all); drawRows(); render(); }; });
  }
  $('#add').addEventListener('click', function () {
    var v = read(), all = rows(), w = weekRows(), last = w.length ? w.map(function (x) { return x.r.d; }).sort().pop() : A.monday(v.woche), t = team();
    all.push({ name: t.length ? t[0].name : 'Mitarbeiter', d: last, ort: w.length ? w[w.length - 1].r.ort : '', b: '07:00', e: '16:00', p: 30, ein: today() });
    put(LS.rows, all); drawRows(); render();
  });
  $('#copy').addEventListener('click', function () {
    var w = weekRows(); if (!w.length) return; var last = w.map(function (x) { return x.r.d; }).sort().pop(), nx = A.addDays(last, 1), all = rows();
    if (A.monday(nx) !== A.monday(last)) return;
    w.filter(function (x) { return x.r.d === last; }).forEach(function (x) { var c = JSON.parse(JSON.stringify(x.r)); c.d = nx; c.ein = today(); all.push(c); });
    put(LS.rows, all); drawRows(); render();
  });
  $('#clear').addEventListener('click', function () { var keep = weekRows().map(function (x) { return x.i; }); put(LS.rows, rows().filter(function (r, i) { return keep.indexOf(i) < 0; })); drawRows(); render(); });
  $('#wadd').addEventListener('click', function () { var T = team(); T.push({ name: 'Neu ' + (T.length + 1), lohn: 13.90, brutto: 0, zwoelf: 'nein', art: 'an' }); put(LS.team, T); drawTeam(); drawRows(); render(); });

  // ---------- Pro ----------
  function locked(what) { $('#pro-msg').innerHTML = 'Dieser Knopf öffnet ' + esc(WHAT[what] || ' — Speichern und weitermachen: https://getreadystack.com/de/apps/arbeitszeitnachweis-vorlage-bau-7-tage-frist/') + ' — Speichern und weitermachen: https://getreadystack.com/de/apps/arbeitszeitnachweis-vorlage-bau-7-tage-frist/' + PRICE + '' + SLUG + ' — Speichern und weitermachen: https://getreadystack.com/de/apps/arbeitszeitnachweis-vorlage-bau-7-tage-frist/'; }
  function download(name, body, type) { var b = new Blob([body], { type: type }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function monthSheet() {
    var ym = ($('#p-monat').value || read().woche.slice(0, 7)).slice(0, 7), firma = $('#p-firma').value, h = '';
    team().forEach(function (w) {
      var M = A.monat(w.name, ym, rows()); if (!M.tage.length) return;
      h += '<div class="pg"><h3>Arbeitszeitnachweis ' + esc(ym.slice(5, 7) + '/' + ym.slice(0, 4)) + ' · ' + esc(w.name) + '</h3><p>Betrieb: ' + esc(firma) + ' · Aufzeichnung nach § 17 Abs. 1 MiLoG · aufbewahren bis mindestens ' + A.de(M.aufbewahren_bis) + '</p>' +
        '<table><thead><tr><th>Datum</th><th>Baustelle</th><th>Beginn</th><th>Ende</th><th>Pause</th><th class="n">Std.</th><th>eingetragen am</th></tr></thead><tbody>' +
        M.tage.map(function (x) { return '<tr><td>' + A.wtag(x.d) + ' ' + A.de(x.d) + '</td><td>' + esc(x.ort) + '</td><td>' + esc(x.b) + '</td><td>' + esc(x.e) + '</td><td>' + x.p + ' Min.</td><td class="n">' + num(x.h) + '</td><td>' + A.de(x.ein) + '</td></tr>'; }).join('') +
        '<tr class="sum"><td colspan="5">Summe</td><td class="n">' + num(M.sum) + '</td><td></td></tr></tbody></table>' +
        '<p>Unterschrift Arbeitnehmer: ____________________ &nbsp; Unterschrift Arbeitgeber: ____________________</p></div>';
    });
    return h || '<p>Im Monat ' + esc(ym) + ' steht keine Zeile.</p>';
  }
  function siteSheet() {
    var ym = ($('#p-monat').value || read().woche.slice(0, 7)).slice(0, 7), S = {};
    rows().filter(function (r) { return String(r.d).slice(0, 7) === ym; }).forEach(function (r) {
      var o = r.ort || '(ohne Baustelle)'; S[o] = S[o] || {}; S[o][r.name] = A.r2((S[o][r.name] || 0) + A.dauer(r.b, r.e, r.p));
    });
    return '<h3>Stunden je Baustelle ' + esc(ym) + '</h3>' + Object.keys(S).map(function (o) {
      var sum = 0; return '<h4>' + esc(o) + '</h4><table><tbody>' + Object.keys(S[o]).map(function (n) { sum += S[o][n]; return '<tr><td>' + esc(n) + '</td><td class="n">' + num(S[o][n]) + ' Std.</td></tr>'; }).join('') +
        '<tr class="sum"><td>Summe</td><td class="n">' + num(sum) + ' Std.</td></tr></tbody></table>';
    }).join('');
  }
  function keepList() {
    var W = {}; rows().forEach(function (r) { if (A.okDate(r.d)) { var m = A.monday(r.d); W[m] = W[m] || 0; W[m]++; } });
    return '<h3>Aufbewahrung (§ 17 Abs. 1 MiLoG: mindestens zwei Jahre)</h3><table><thead><tr><th>Woche</th><th class="n">Zeilen</th><th>aufbewahren bis mindestens</th></tr></thead><tbody>' +
      Object.keys(W).sort().map(function (m) { var e = A.addDays(m, 13); return '<tr><td>KW ' + A.kw(m) + ' (' + A.de(m) + ')</td><td class="n">' + W[m] + '</td><td>' + A.de(String(+e.slice(0, 4) + 2) + e.slice(4)) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function ics() {
    var v = read(), wk = A.monday(v.woche), first = A.addDays(wk, 7).replace(/-/g, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Arbeitszeitnachweis vorlage//DE', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', 'UID:azn-weekly-' + first + '@arbeitszeitnachweis', 'DTSTAMP:' + first + 'T070000Z', 'DTSTART;VALUE=DATE:' + first, 'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'SUMMARY:Arbeitszeitnachweis: heute endet die 7-Tage-Frist für Montag der Vorwoche',
      'DESCRIPTION:Stundenzettel der Kolonne bis heute 24 Uhr eintragen (§ 17 Abs. 1 MiLoG). Dienstag bis Sonntag folgen jeweils einen Tag später.',
      'BEGIN:VALARM', 'TRIGGER:PT8H', 'ACTION:DISPLAY', 'DESCRIPTION:Stundenzettel eintragen', 'END:VALARM', 'END:VEVENT'];
    (R ? R.zeilen : []).filter(function (z) { return z.st === 'offen'; }).forEach(function (z, i) {
      var d = z.frist.replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:azn-' + d + '-' + i + '@arbeitszeitnachweis', 'DTSTAMP:' + d + 'T070000Z', 'DTSTART;VALUE=DATE:' + d,
        'SUMMARY:Frist endet: ' + z.name.replace(/[,;]/g, ' ') + ' ' + A.de(z.d) + ' eintragen', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n');
  }
  function csv() {
    var L = ['Mitarbeiter;Datum;Baustelle;Beginn;Ende;Pause_Min;Stunden;eingetragen_am'];
    rows().slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; }).forEach(function (r) {
      L.push([r.name, A.de(r.d), r.ort, r.b, r.e, r.p, num(A.dauer(r.b, r.e, r.p)), A.de(r.ein)].map(function (x) { return String(x == null ? '' : x).replace(/;/g, ','); }).join(';'));
    });
    return L.join('\r\n');
  }
  function parseCsv(txt) {
    var out = [];
    String(txt || '').split(/\r?\n/).slice(1).forEach(function (line) {
      var c = line.split(/[;\t]/).map(function (x) { return x.trim(); }); if (c.length < 5) return;
      var dd = function (s) { var m = String(s || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''); };
      var d = dd(c[1]); if (!d || !/^\d{1,2}:\d{2}$/.test(c[3]) || !/^\d{1,2}:\d{2}$/.test(c[4])) return;
      out.push({ name: c[0], d: d, ort: c[2], b: c[3], e: c[4], p: +c[5] || 0, ein: dd(c[7]) });
    });
    return out;
  }
  window.__azn = { ics: ics, csv: csv, parseCsv: parseCsv, monthSheet: monthSheet, siteSheet: siteSheet, keepList: keepList, R: function () { return R; } };
  function showSheet(h, print) { $('#sheet').innerHTML = h; $('#sheet').hidden = false; if (print) window.print(); }
  function act(what) {
    if (!pro) { locked(what); return; }
    if (what === 'month') showSheet(monthSheet(), true);
    else if (what === 'site') showSheet(siteSheet(), true);
    else if (what === 'keep') showSheet(keepList(), false);
    else if (what === 'ics') download('arbeitszeitnachweis-fristen.ics', ics(), 'text/calendar');
    else if (what === 'csv') download('arbeitszeitnachweis.csv', '﻿' + csv(), 'text/csv');
    else if (what === 'backup') download('arbeitszeitnachweis-sicherung.json', JSON.stringify({ current: read(), team: team(), rows: rows() }, null, 1), 'application/json');
  }
  [].forEach.call(document.querySelectorAll('[data-pro]'), function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-pro')); }); });
  ['imp', 'csvin'].forEach(function (id) { $('#' + id).addEventListener('click', function (e) { if (!pro) { e.preventDefault(); locked(id); } }); });
  $('#imp').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () { try { var j = JSON.parse(rd.result); if (j.rows) put(LS.rows, j.rows); if (j.team) put(LS.team, j.team); if (j.current) fill(j.current); drawTeam(); drawRows(); render(); $('#pro-msg').textContent = 'Sicherung geladen.'; } catch (e) { $('#pro-msg').textContent = 'Diese Datei ist keine Sicherung dieser Seite.'; } };
    rd.readAsText(f);
  });
  $('#csvin').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () {
      var add = parseCsv(rd.result); if (!add.length) { $('#pro-msg').textContent = 'In der Datei steht keine Zeile mit Mitarbeiter, Datum, Beginn und Ende.'; return; }
      var T = team(); add.forEach(function (r) { if (!T.some(function (w) { return w.name === r.name; })) T.push({ name: r.name, lohn: 0, brutto: 0, zwoelf: 'nein', art: 'an' }); });
      put(LS.team, T); put(LS.rows, rows().concat(add)); $('#woche').value = add[0].d; drawTeam(); drawRows(); render(); $('#pro-msg').textContent = add.length + ' Zeilen geladen.';
    };
    rd.readAsText(f);
  });

  function setPro(on) { pro = on; document.body.classList.toggle('is-pro', on); $('#pw').hidden = on; }
  function unlock(k) {
    k = String(k || '').trim(); if (!k) return; $('#key-msg').textContent = 'Prüfe …'; var i = 0;
    (function next() {
      if (i >= DOORS.length) { $('#key-msg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/arbeitszeitnachweis-vorlage-bau-7-tage-frist/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/arbeitszeitnachweis-vorlage-bau-7-tage-frist/'; } else next();
      }).catch(next);
    })();
  }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  var hk = (location.hash.match(/#k=([^&]+)/) || [])[1];
  if (hk) { unlock(decodeURIComponent(hk)); history.replaceState(null, '', location.pathname); } else if (get(LS.key, '')) unlock(get(LS.key, ''));
  window.addEventListener('hashchange', function () { var h = (location.hash.match(/#k=([^&]+)/) || [])[1]; if (h) unlock(decodeURIComponent(h)); });

  fields.forEach(function (f) { f.addEventListener('input', render); f.addEventListener('change', function () { if (f.id === 'woche') drawRows(); drawTeam(); render(); }); });
  $('#check').addEventListener('click', render);
  $('#reset').addEventListener('click', function () { var S0 = A.sample(); fill(S0.v); put(LS.rows, S0.rows); put(LS.team, S0.workers); drawTeam(); drawRows(); render(); });
  var cur = get(LS.cur, null); if (cur) fill(cur);
  drawTeam(); drawRows(); render();
})();
