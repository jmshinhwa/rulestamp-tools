(function () {
  'use strict';
  var doc = document, LS = window.localStorage, SZ = window.SZ;
  var SLUG = 'stundenzettel-vorlage-2027-excel', DOORS = [SLUG, SLUG + '.once'];
  var K_CUR = 'sz27_cur', K_MON = 'sz27_months', K_KEY = 'sz27_key';
  var pro = false, cur = null;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jget(k, d) { try { var v = LS.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function input() {
    return { ym: $('monat').value, bl: $('bl').value, art: $('art').value, lohn: $('lohn').value, soll: $('soll').value,
      paid: $('paid').value, name: $('name').value, text: $('rows').value };
  }
  function compute(inp) {
    var p = SZ.parseRows(inp.text, inp.ym);
    var r = SZ.month({ ym: inp.ym, bl: inp.bl, art: inp.art, lohn: inp.lohn, soll: inp.soll, paid: inp.paid, rows: p.rows });
    r.errs = p.errs; r.name = inp.name; r.inp = inp;
    return r;
  }
  function blName(c) { for (var i = 0; i < SZ.BL.length; i++) if (SZ.BL[i][0] === c) return SZ.BL[i][1]; return c; }
  function artName(a) { return { minijob: 'Minijob', teilzeit: 'Teilzeit', vollzeit: 'Vollzeit' }[a] || a; }
  function tile(id, bad) { $(id).className = 'tile' + (bad ? ' bad' : ''); }

  function draw() {
    var inp = input(), r = compute(inp); cur = r;
    jset(K_CUR, inp);
    $('errs').innerHTML = r.errs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('');
    $('r-label').textContent = r.label + ' · ' + (inp.name ? inp.name + ' · ' : '') + artName(r.art) + ' · ' + blName(r.bl);
    var hasPaid = !isNaN(r.paid), big = $('r-big'), loss = [];
    if (hasPaid && r.unpaidH > 0) {
      big.textContent = SZ.std(r.unpaidH) + ' unbezahlt'; big.className = 'r-big bad';
      loss.push(SZ.eur(r.unpaid) + ' fehlen zum Lohnanspruch von ' + SZ.eur(r.anspruch));
    } else if (r.lohnUnterMilo) {
      big.textContent = SZ.eur(r.milGap) + ' unter Mindestlohn'; big.className = 'r-big bad';
    } else if (hasPaid) {
      big.textContent = '0 Std. unbezahlt'; big.className = 'r-big ok';
    } else {
      big.textContent = SZ.std(r.ist) + ' · ' + SZ.eur(r.anspruch); big.className = 'r-big';
    }
    if (r.art === 'minijob' && r.mini !== 'ok') loss.push('Anspruch ' + SZ.eur(r.anspruch) + ' liegt ' + SZ.eur(r.miniOver) + ' über der Minijob-Grenze von ' + SZ.eur(r.grenze).replace(',00', ''));
    if (r.lohnUnterMilo && hasPaid && r.unpaidH > 0) loss.push('Vertragslohn ' + SZ.eur(r.lohn) + ' liegt unter dem Mindestlohn von ' + SZ.eur(r.milo));
    $('r-loss').textContent = loss.join(' · ');

    $('t-ist').textContent = SZ.std(r.ist).replace(' Std.', '') + ' / ' + SZ.std(r.soll);
    $('t-ist-n').textContent = r.ueber > 0 ? SZ.std(r.ueber) + ' Überstunden' : r.ueber < 0 ? SZ.std(-r.ueber) + ' weniger als vereinbart' : 'genau wie vereinbart';
    $('t-ans').textContent = SZ.eur(r.anspruch);
    $('t-ans-n').textContent = hasPaid ? 'ausgezahlt ' + SZ.eur(r.paid) + (r.unpaid > 0 ? ', fehlt ' + SZ.eur(r.unpaid) : '') : 'Auszahlung nicht eingetragen';
    tile('tl-ans', hasPaid && r.unpaid > 0);
    $('t-eff').textContent = hasPaid && r.ist > 0 ? SZ.eur(r.eff) : '–';
    $('t-eff-n').textContent = 'Mindestlohn ' + SZ.eur(r.milo) + (r.lohnUnterMilo ? ' · Vertrag darunter' : '');
    tile('tl-eff', (hasPaid && r.effUnterMilo) || r.lohnUnterMilo);
    if (r.art === 'minijob') {
      $('t-mini').textContent = r.mini === 'ok' ? 'eingehalten' : 'über ' + SZ.eur(r.grenze).replace(',00', '');
      $('t-mini-n').textContent = r.mini === 'ok' ? 'noch ' + SZ.eur(r.grenze - r.anspruch) + ' bis ' + SZ.eur(r.grenze).replace(',00', '')
        : r.mini === 'double' ? 'über dem Doppelten (' + SZ.eur(2 * r.grenze).replace(',00', '') + ')' : 'jeden Monat so: ' + SZ.eur(r.miniYear12) + ' > ' + SZ.eur(r.jahresgrenze).replace(',00', '') + ' im Jahr';
      tile('tl-mini', r.mini !== 'ok');
    } else { $('t-mini').textContent = '–'; $('t-mini-n').textContent = 'gilt nur für Minijobs'; tile('tl-mini', false); }
    $('t-pause').textContent = r.nPause + (r.nMax ? ' + ' + r.nMax + ' über 10 Std.' : '');
    tile('tl-pause', r.nPause + r.nMax > 0);
    $('t-hol').textContent = String(r.nHol);
    var hl = Object.keys(r.hol).map(function (d) { return SZ.dm(d) + ' ' + r.hol[d]; });
    $('t-hol-n').textContent = hl.length ? 'Feiertage im Monat: ' + hl.join(', ') : 'kein Feiertag in diesem Monat';
    tile('tl-hol', false);

    var fx = [];
    if (hasPaid && r.unpaid > 0) fx.push('<li class="bad"><b>Nachzahlen:</b> ' + SZ.eur(r.unpaid) + ' für ' + SZ.std(r.unpaidH) + ' (' + SZ.std(r.ist) + ' × ' + SZ.eur(r.rate) + ' = ' + SZ.eur(r.anspruch) + ', ausgezahlt ' + SZ.eur(r.paid) + ').</li>');
    if (r.lohnUnterMilo) fx.push('<li class="bad"><b>Stundenlohn anheben:</b> ' + SZ.eur(r.lohn) + ' ist unter ' + SZ.eur(r.milo) + ' (Mindestlohn ab ' + (r.ym >= '2027-01' ? '01.01.2027' : '01.01.2026') + '), ' + SZ.std(r.ist) + ' × ' + SZ.eur(r.milo - r.lohn) + ' = ' + SZ.eur(r.milGap) + ' zu wenig.</li>');
    if (r.art === 'minijob' && r.mini !== 'ok') fx.push('<li class="bad"><b>Minijob-Grenze:</b> ' + SZ.eur(r.anspruch) + ' > ' + SZ.eur(r.grenze) + '. Zulässig nur, wenn das Jahr bei höchstens ' + SZ.eur(r.jahresgrenze) + ' bleibt, oder gelegentlich und unvorhersehbar in höchstens 2 Monaten bis ' + SZ.eur(2 * r.grenze) + '. Bei ' + SZ.eur(r.rate) + ' passen ' + SZ.std(Math.floor(r.grenze / r.rate * 100) / 100) + ' in einen Monat.</li>');
    r.rows.forEach(function (x) { x.flags.forEach(function (f) { fx.push('<li class="bad"><b>' + x.wd + ' ' + SZ.dm(x.date) + ':</b> ' + esc(f) + '</li>'); }); });
    if (r.nHol) r.rows.filter(function (x) { return x.hol; }).forEach(function (x) { fx.push('<li class="warn"><b>' + x.wd + ' ' + SZ.dm(x.date) + ' ' + esc(x.hol) + ':</b> Arbeit am Feiertag. Ein Zuschlag ist nur Pflicht, wenn Vertrag oder Tarif ihn vorsehen.</li>'); });
    if (!fx.length && r.rows.length) fx.push('<li class="ok">Alles im Rahmen: kein Pausenverstoß, Mindestlohn eingehalten' + (r.art === 'minijob' ? ', Minijob-Grenze eingehalten' : '') + '.</li>');
    $('fixes').innerHTML = fx.join('');

    var h = '<table class="wk"><thead><tr><th>Datum</th><th>Beginn–Ende</th><th>Pause</th><th>Stunden</th><th>Prüfung</th><th>aufschreiben bis</th></tr></thead><tbody>';
    r.rows.forEach(function (x) {
      h += '<tr' + (x.flags.length ? ' class="bad"' : x.hol ? ' class="hol"' : '') + '><th>' + x.wd + ' ' + SZ.dm(x.date) + (x.hol ? '<small>' + esc(x.hol) + '</small>' : '') + '</th><td>' + SZ.fmtHM(x.start) + '–' + SZ.fmtHM(x.end) +
        '</td><td>' + x.pause + ' Min.</td><td class="n">' + String(x.hours).replace('.', ',') + '</td><td>' + (x.flags.length ? esc(x.flags.join(' · ')) : 'ok') + '</td><td>' + SZ.dm(x.bis) + '</td></tr>';
    });
    h += '<tr class="sum"><th>Summe</th><td></td><td></td><td class="n">' + String(r.ist).replace('.', ',') + '</td><td colspan="2">' + SZ.eur(r.anspruch) + ' Anspruch</td></tr></tbody></table>';
    $('table').innerHTML = r.rows.length ? h : '<p class="hint">Noch keine Arbeitstage eingetragen.</p>';
    drawPro();
  }

  /* ---------- Pro ---------- */
  function unlockUI() { pro = true; doc.body.classList.add('is-pro'); $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/stundenzettel-vorlage-2027-excel/'; drawPro(); }
  function tryKey(k) {
    k = String(k || '').trim(); if (!k) return;
    $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/stundenzettel-vorlage-2027-excel/';
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/stundenzettel-vorlage-2027-excel/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (res) { return res.json(); }).then(function (j) {
        if (j && j.ok) { try { LS.setItem(K_KEY, k); } catch (e) {} unlockUI(); } else next();
      }).catch(next);
    })();
  }
  function need(what) {
    if (pro) return false;
    $('pro').scrollIntoView({ behavior: 'smooth' });
    $('keymsg').textContent = what + ' — Speichern und weitermachen: https://getreadystack.com/de/apps/stundenzettel-vorlage-2027-excel/';
    return true;
  }
  function months() { return jget(K_MON, {}); }
  function saveMonth() {
    if (need('Monate speichern')) return;
    var m = months(), inp = input(); m[inp.ym] = inp; jset(K_MON, m); drawPro();
    $('keymsg').textContent = cur.label + ' gespeichert.';
  }
  function drawPro() {
    var m = months(), keys = Object.keys(m).sort();
    $('saved').innerHTML = keys.length ? '<ul>' + keys.map(function (k) {
      var r = compute(m[k]);
      return '<li><button type="button" class="ghost load" data-m="' + k + '">' + esc(r.label) + '</button> ' + SZ.std(r.ist) + ' · ' + SZ.eur(r.anspruch) +
        (r.unpaid > 0 ? ' · fehlt ' + SZ.eur(r.unpaid) : '') + ' <button type="button" class="del" data-del="' + k + '" aria-label="Monat löschen">×</button></li>';
    }).join('') + '</ul>' : '<p class="hint">Noch kein Monat gespeichert.</p>';
    var list = keys.map(function (k) { return compute(m[k]); }).filter(function (r) { return r.ym.slice(0, 4) === '2027'; });
    if (!list.length) { $('year').innerHTML = ''; return; }
    var y = SZ.year(list, 2027);
    var h = '<table class="mt"><thead><tr><th>Monat</th><th>Stunden</th><th>Anspruch</th><th>ausgezahlt</th><th>fehlt</th></tr></thead><tbody>' + y.months.map(function (r) {
      return '<tr' + (r.anspruch > y.grenze ? ' class="bad"' : '') + '><td>' + esc(r.label) + '</td><td>' + SZ.std(r.ist) + '</td><td>' + SZ.eur(r.anspruch) + '</td><td>' + SZ.eur(r.paid) + '</td><td>' + SZ.eur(r.unpaid) + '</td></tr>';
    }).join('') + '<tr class="sum"><td>2027 bisher</td><td>' + SZ.std(y.ist) + '</td><td>' + SZ.eur(y.anspruch) + '</td><td>' + SZ.eur(y.paid) + '</td><td>' + SZ.eur(y.unpaid) + '</td></tr></tbody></table>';
    var art = list[list.length - 1].art;
    if (art === 'minijob') h += '<p class="hint">Minijob 2027: ' + SZ.eur(y.anspruch) + ' von ' + SZ.eur(y.jahresgrenze) + ' Jahresgrenze · ' + y.over + ' Monat(e) über ' + SZ.eur(y.grenze) +
      (y.overDouble ? ' · ' + y.overDouble + ' über ' + SZ.eur(2 * y.grenze) : '') + (y.over > 2 || y.overDouble ? ' · mehr als gelegentlich: Minijob-Status mit dem Lohnbüro klären' : '') + '.</p>';
    $('year').innerHTML = h;
  }
  function download(name, data, type) {
    var b = new Blob([data], { type: type }), a = doc.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function xlsx() {
    if (need('Die Excel-Datei 2027')) return;
    var m = months(), inp = input(), all = {};
    Object.keys(m).forEach(function (k) { var p = SZ.parseRows(m[k].text, k); all[k] = { paid: m[k].paid, rows: p.rows }; });
    if (inp.ym.slice(0, 4) === '2027') all[inp.ym] = { paid: inp.paid, rows: SZ.parseRows(inp.text, inp.ym).rows };
    var data = SZ.workbook({ name: inp.name, bl: inp.bl, art: inp.art, lohn: inp.lohn, soll: inp.soll, months: all });
    download('Stundenzettel_2027_' + (inp.name || 'Vorlage').replace(/[^A-Za-z0-9ÄÖÜäöüß_-]+/g, '_') + '.xlsx', data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  function printSheet() {
    if (need('Der Ausdruck')) return;
    var r = cur, h = '<h2>Stundenzettel ' + esc(r.label) + '</h2><p>Name: ' + esc(r.name || '') + ' · ' + artName(r.art) + ' · ' + blName(r.bl) + ' · Stundenlohn ' + SZ.eur(r.lohn) + '</p>' +
      '<table><thead><tr><th>Datum</th><th>Tag</th><th>Beginn</th><th>Ende</th><th>Pause (Min.)</th><th>Stunden</th><th>Bemerkung</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr><td>' + SZ.dm(x.date) + '</td><td>' + x.wd + (x.hol ? ' (' + esc(x.hol) + ')' : '') + '</td><td>' + SZ.fmtHM(x.start) + '</td><td>' + SZ.fmtHM(x.end) + '</td><td>' + x.pause + '</td><td>' + String(x.hours).replace('.', ',') + '</td><td>' + esc(x.note) + '</td></tr>'; }).join('') +
      '</tbody></table><p>Summe: ' + SZ.std(r.ist) + ' · vereinbart ' + SZ.std(r.soll) + ' · Lohnanspruch ' + SZ.eur(r.anspruch) + (isNaN(r.paid) ? '' : ' · ausgezahlt ' + SZ.eur(r.paid)) + '</p>' +
      '<p class="sig"><span>Unterschrift Arbeitnehmer/in, Datum</span><span>Unterschrift Arbeitgeber, Datum</span></p><p class="small">Aufzeichnung nach § 17 MiLoG: Beginn, Ende und Dauer der täglichen Arbeitszeit, mindestens 2 Jahre aufbewahren.</p>';
    $('printview').innerHTML = h; window.print();
  }
  function csv() {
    if (need('Der CSV-Export')) return;
    var r = cur, L = ['Datum;Tag;Feiertag;Beginn;Ende;Pause_Min;Stunden;Pruefung;Aufschreiben_bis;Bemerkung'];
    r.rows.forEach(function (x) { L.push([SZ.dmy(x.date), x.wd, x.hol, SZ.fmtHM(x.start), SZ.fmtHM(x.end), x.pause, String(x.hours).replace('.', ','), x.flags.join(' / ') || 'ok', SZ.dmy(x.bis), x.note].join(';')); });
    download('Stundenzettel_' + r.ym + '.csv', '﻿' + L.join('\r\n'), 'text/csv;charset=utf-8');
  }
  function backup() { if (need('Das Backup')) return; download('stundenzettel-2027-backup.json', JSON.stringify({ months: months() }, null, 1), 'application/json'); }
  function restore(f) {
    if (need('Backup laden')) return;
    var rd = new FileReader();
    rd.onload = function () { try { var j = JSON.parse(rd.result); if (j && j.months) { jset(K_MON, j.months); drawPro(); $('keymsg').textContent = Object.keys(j.months).length + ' Monate geladen.'; } } catch (e) { $('keymsg').textContent = 'Diese Datei ist kein Backup.'; } };
    rd.readAsText(f);
  }
  function load(inp) {
    ['monat', 'bl', 'art', 'lohn', 'soll', 'paid', 'name'].forEach(function (k) { var key = k === 'monat' ? 'ym' : k; if (inp[key] != null) $(k).value = inp[key]; });
    $('rows').value = inp.text || ''; draw();
  }
  function beispiel() { var B = SZ.BEISPIEL; load({ ym: B.ym, bl: B.bl, art: B.art, lohn: B.lohn, soll: B.soll, paid: B.paid, name: B.name, text: B.text }); }

  function start() {
    var mo = ['2026-12'].concat(SZ.MONATE.map(function (_, i) { return '2027-' + (i < 9 ? '0' : '') + (i + 1); }));
    $('monat').innerHTML = mo.map(function (v) { var y = +v.slice(0, 4), m = +v.slice(5, 7); return '<option value="' + v + '"' + (v === '2027-01' ? ' selected' : '') + '>' + SZ.MONATE[m - 1] + ' ' + y + '</option>'; }).join('');
    $('bl').innerHTML = SZ.BL.map(function (b) { return '<option value="' + b[0] + '"' + (b[0] === 'BY' ? ' selected' : '') + '>' + esc(b[1]) + '</option>'; }).join('');
    var saved = jget(K_CUR, null);
    if (saved && saved.text != null && saved.ym) load(saved); else draw();
    ['monat', 'bl', 'art', 'lohn', 'soll', 'paid', 'name', 'rows'].forEach(function (id) { $(id).addEventListener('input', draw); $(id).addEventListener('change', draw); });
    $('reset').addEventListener('click', beispiel);
    $('clear').addEventListener('click', function () { $('rows').value = ''; $('paid').value = ''; $('name').value = ''; draw(); });
    $('unlock').addEventListener('click', function () { tryKey($('key').value); });
    $('save').addEventListener('click', saveMonth);
    $('xlsx').addEventListener('click', xlsx);
    $('print').addEventListener('click', printSheet);
    $('csv').addEventListener('click', csv);
    $('backup').addEventListener('click', backup);
    $('restore').addEventListener('change', function (e) { if (e.target.files[0]) restore(e.target.files[0]); });
    $('saved').addEventListener('click', function (e) {
      var t = e.target, m = months();
      if (t.dataset.m && m[t.dataset.m]) load(m[t.dataset.m]);
      if (t.dataset.del) { delete m[t.dataset.del]; jset(K_MON, m); drawPro(); }
    });
    var hk = (location.hash.match(/[#&]k=([^&]+)/) || [])[1];
    var k = hk ? decodeURIComponent(hk) : LS.getItem(K_KEY);
    if (k) { $('key').value = k; tryKey(k); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
