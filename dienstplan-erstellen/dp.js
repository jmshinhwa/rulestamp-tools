/* Dienstplan erstellen - Rechenkern (ArbZG §§ 3, 4, 5 · MiLoG + MiLoV5 · SGB IV § 8 Abs. 1a)
   Läuft im Browser (window.DP) und in node (module.exports). Keine externen Aufrufe. */
(function (root) {
  'use strict';
  // Mindestlohn je Zeitstunde (MiLoV5 § 1): ab 01.01.2026 13,90 € · ab 01.01.2027 14,60 €
  var MILO = [['2026-01-01', 13.90], ['2027-01-01', 14.60]];
  // Geringfügigkeitsgrenze (SGB IV § 8 Abs. 1a): Mindestlohn × 130 ÷ 3, auf volle Euro aufgerundet
  function miniCap(year) { var r = miloOn(year + '-07-01'); return Math.ceil(r * 130 / 3 - 1e-9); }
  function miloOn(iso) { var v = MILO[0][1]; for (var i = 0; i < MILO.length; i++) if (iso >= MILO[i][0]) v = MILO[i][1]; return v; }
  // § 5 Abs. 2 ArbZG: Verkürzung um bis zu 1 Stunde nur in diesen Bereichen (mit Ausgleich auf 12 h)
  var BRANCHEN = [
    ['gastro', 'Gastronomie / Hotel', true],
    ['pflege', 'Pflege / Klinik / Betreuung', true],
    ['handel', 'Einzelhandel / Bäckerei-Verkauf', false],
    ['verkehr', 'Verkehrsbetrieb', true],
    ['sonst', 'Andere Branche', false]
  ];
  var ARTEN = { vollzeit: 'vz', vz: 'vz', teilzeit: 'tz', tz: 'tz', minijob: 'mini', mini: 'mini', aushilfe: 'mini', azubi: 'azubi', auszubildende: 'azubi', auszubildender: 'azubi' };
  var ART_LABEL = { vz: 'Vollzeit', tz: 'Teilzeit', mini: 'Minijob', azubi: 'Azubi' };
  var TAGE = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  var TAG_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  function num(s) {
    if (typeof s === 'number') return s;
    s = String(s == null ? '' : s).replace(/[€\s]/g, '');
    if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isFinite(n) ? n : NaN;
  }
  function eur(n) {
    var neg = n < 0; n = Math.abs(Math.round(n * 100) / 100);
    var p = n.toFixed(2).split('.'), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + ',' + p[1] + ' €';
  }
  function eur0(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; }
  function std(min) { var h = min / 60; return (Math.round(h * 100) / 100).toString().replace('.', ',') + ' Std.'; }
  function hm(min) { min = ((min % 1440) + 1440) % 1440; var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  function dur(min) { var h = Math.floor(min / 60), m = Math.round(min % 60); return h + ':' + (m < 10 ? '0' : '') + m + ' h'; }

  // ISO-Datum <-> Tageszahl (UTC, keine Zeitzonen-Sprünge)
  function dayNo(iso) { var p = iso.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
  function isoOf(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function addDays(iso, k) { return isoOf(dayNo(iso) + k); }
  function weekday(iso) { return (dayNo(iso) + 3) % 7; } // 0 = Montag (1970-01-01 war Donnerstag)
  function monday(iso) { return addDays(iso, -weekday(iso)); }
  function dmy(iso) { var p = iso.split('-'); return p[2] + '.' + p[1] + '.'; }
  function dmyy(iso) { var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function tagLabel(iso) { return TAG_KURZ[weekday(iso)] + ' ' + dmy(iso); }

  function splitLine(l) { return l.split(/[;|\t]/).map(function (x) { return x.trim(); }); }
  function lines(text) {
    if (Array.isArray(text)) return text.map(String);
    return String(text || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(function (x) { return x && x[0] !== '#'; });
  }

  function parseTeam(text) {
    var team = [], err = [];
    lines(text).forEach(function (l, i) {
      var c = splitLine(l), name = c[0], art = ARTEN[String(c[1] || '').toLowerCase()], lohn = num(c[2]);
      if (!name) return;
      if (!art) { err.push('Team Zeile ' + (i + 1) + ': Art "' + (c[1] || '') + '" unbekannt (Vollzeit, Teilzeit, Minijob, Azubi)'); art = 'tz'; }
      if (!(lohn > 0)) { err.push('Team Zeile ' + (i + 1) + ': Stundenlohn fehlt bei ' + name); lohn = 0; }
      team.push({ name: name, art: art, lohn: lohn });
    });
    return { team: team, err: err };
  }

  function parseTime(s) {
    var m = String(s).trim().match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
    if (!m) return NaN; var h = +m[1], mi = +(m[2] || 0);
    if (h > 24 || mi > 59) return NaN; return h * 60 + mi;
  }
  function parseDay(tok, mon) {
    tok = String(tok || '').trim().toLowerCase();
    var k = TAGE.indexOf(tok.slice(0, 2));
    if (k >= 0 && /^[a-zäöü]+\.?$/.test(tok)) return addDays(mon, k);
    var iso = tok.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (iso) return tok;
    var d = tok.match(/(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/);
    if (d) {
      var dd = ('0' + d[1]).slice(-2), mm = ('0' + d[2]).slice(-2);
      if (d[3]) { var y = d[3].length === 2 ? '20' + d[3] : d[3]; return y + '-' + mm + '-' + dd; }
      // ohne Jahr: das Datum innerhalb der Woche (Jahreswechsel beachten)
      for (var j = 0; j < 7; j++) { var c = addDays(mon, j); if (c.slice(5) === mm + '-' + dd) return c; }
      return mon.slice(0, 4) + '-' + mm + '-' + dd;
    }
    // "Mo 28.12." -> Datum gewinnt
    return null;
  }

  function parsePlan(text, mon) {
    var out = [], err = [];
    lines(text).forEach(function (l, i) {
      var c = splitLine(l);
      if (c.length < 3) { err.push('Plan Zeile ' + (i + 1) + ': "' + l + '" braucht Name; Tag; Beginn-Ende; Pause'); return; }
      var date = parseDay(c[1], mon) || parseDay((c[1].match(/\d{1,2}\.\d{1,2}\.?\d{0,4}/) || [''])[0], mon);
      if (!date) { var k = TAGE.indexOf(c[1].toLowerCase().slice(0, 2)); if (k >= 0) date = addDays(mon, k); }
      var tm = c[2].split(/\s*[-–—]\s*|\s+bis\s+/);
      var s = parseTime(tm[0]), e = parseTime(tm[1]);
      if (!date || isNaN(s) || isNaN(e)) { err.push('Plan Zeile ' + (i + 1) + ': "' + l + '" nicht lesbar'); return; }
      var p = c[3] == null || c[3] === '' ? 0 : num(String(c[3]).replace(/min|p/gi, ''));
      if (isNaN(p)) p = 0;
      var base = dayNo(date) * 1440, start = base + s, end = base + e;
      if (end <= start) end += 1440; // über Mitternacht
      out.push({ name: c[0], date: date, start: start, end: end, pause: Math.round(p), line: i + 1 });
    });
    out.sort(function (a, b) { return a.start - b.start; });
    return { shifts: out, err: err };
  }

  function reducible(br) { for (var i = 0; i < BRANCHEN.length; i++) if (BRANCHEN[i][0] === br) return BRANCHEN[i][2]; return false; }

  /* inp = {team: text|[], plan: text, woche: 'YYYY-MM-DD', branche: 'gastro', prev: [shift...] (optional, aus der gespeicherten Vorwoche)} */
  function check(inp) {
    var mon = monday(inp.woche || '2026-12-28');
    var T = Array.isArray(inp.team) ? { team: inp.team, err: [] } : parseTeam(inp.team);
    var P = parsePlan(inp.plan, mon);
    var byName = {}; T.team.forEach(function (t) { byName[t.name.toLowerCase()] = t; });
    var err = T.err.concat(P.err), v = [], people = {}, red = reducible(inp.branche);
    var sun = addDays(mon, 6), capYear = +sun.slice(0, 4), cap = miniCap(capYear);
    T.team.forEach(function (t) { people[t.name] = { name: t.name, art: t.art, lohn: t.lohn, min: 0, pay: 0, payLegal: 0, short: 0, shifts: [], bad: 0 }; });
    P.shifts.forEach(function (s) {
      var t = byName[s.name.toLowerCase()];
      if (!t) { err.push('Plan Zeile ' + s.line + ': ' + s.name + ' steht nicht im Team'); t = { name: s.name, art: 'tz', lohn: 0 }; byName[s.name.toLowerCase()] = t; people[t.name] = { name: t.name, art: t.art, lohn: 0, min: 0, pay: 0, payLegal: 0, short: 0, shifts: [], bad: 0 }; }
      s.name = t.name;
      var span = s.end - s.start, net = Math.max(0, span - s.pause), rate = miloOn(s.date);
      s.net = net; s.rate = rate; s.flags = [];
      var pp = people[t.name]; pp.min += net; pp.pay += t.lohn * net / 60; pp.shifts.push(s);
      var legal = t.art === 'azubi' ? t.lohn : Math.max(t.lohn, rate);
      pp.payLegal += legal * net / 60;
      // § 4 ArbZG
      var need = net > 540 ? 45 : net > 360 ? 30 : 0, have = s.pause >= 15 ? s.pause : 0;
      if (have < need) {
        v.push({ typ: 'pause', name: t.name, date: s.date, shift: s, text: tagLabel(s.date) + ' ' + t.name + ': ' + dur(net) + ' Arbeit, Pause ' + s.pause + ' Min. statt mindestens ' + need + ' Min.', fix: 'Pause auf ' + need + ' Min. setzen, spätestens um ' + hm(s.start + 360) + ' beginnen (§ 4 ArbZG)' });
        s.flags.push('pause');
      }
      // § 3 ArbZG
      if (net > 600) {
        v.push({ typ: 'max10', name: t.name, date: s.date, shift: s, text: tagLabel(s.date) + ' ' + t.name + ': ' + dur(net) + ' Arbeit an einem Tag (höchstens 10 h)', fix: 'Schicht spätestens um ' + hm(s.start + 600 + s.pause) + ' enden lassen (§ 3 ArbZG)' });
        s.flags.push('max10');
      }
      // MiLoG
      if (t.art !== 'azubi' && t.lohn > 0 && t.lohn < rate - 1e-9) {
        var miss = (rate - t.lohn) * net / 60; pp.short += miss;
        v.push({ typ: 'milo', name: t.name, date: s.date, shift: s, eur: miss, text: tagLabel(s.date) + ' ' + t.name + ': ' + eur(t.lohn).replace(' €', '') + ' €/Std. unter dem Mindestlohn von ' + eur(rate) + ' (fehlen ' + eur(miss) + ')', fix: 'Stundenlohn ab ' + dmyy(s.date.slice(0, 4) + '-01-01') + ' auf mindestens ' + eur(rate) + ' setzen' });
        s.flags.push('milo');
      }
    });
    // § 5 ArbZG - je Person die Lücke zwischen Ende und nächstem Beginn
    Object.keys(people).forEach(function (n) {
      var list = (inp.prev || []).filter(function (s) { return s.name.toLowerCase() === n.toLowerCase(); }).slice(-1).concat(people[n].shifts);
      for (var i = 1; i < list.length; i++) {
        var a = list[i - 1], b = list[i], rest = b.start - a.end;
        if (rest < 0) { v.push({ typ: 'overlap', name: n, date: b.date, shift: b, text: tagLabel(b.date) + ' ' + n + ': zwei Schichten überschneiden sich', fix: 'eine der beiden Schichten ändern' }); (b.flags = b.flags || []).push('overlap'); continue; }
        if (rest >= 660) continue;
        var same = a.date === b.date && rest < 120; // geteilter Dienst am selben Tag: zählt als ein Arbeitstag
        if (same) continue;
        if (red && rest >= 600) {
          v.push({ typ: 'rest10', name: n, date: b.date, shift: b, text: tagLabel(b.date) + ' ' + n + ': ' + dur(rest) + ' Ruhezeit nach ' + tagLabel(a.date) + ' ' + hm(a.end) + ' (verkürzt, § 5 Abs. 2)', fix: 'zulässig nur mit Ausgleich: eine andere Ruhezeit binnen 4 Wochen auf mindestens 12 h verlängern; ohne Ausgleich frühestens ' + hm(a.end + 660) + ' beginnen' });
          (b.flags = b.flags || []).push('rest10');
        } else {
          v.push({ typ: 'rest', name: n, date: b.date, shift: b, prevEnd: a.end, text: tagLabel(b.date) + ' ' + n + ': nur ' + dur(rest) + ' Ruhezeit nach Schichtende ' + tagLabel(a.date) + ' ' + hm(a.end), fix: 'frühestens um ' + hm(a.end + 660) + ' beginnen (11 h, § 5 ArbZG)' + (red ? '; mit Ausgleich (§ 5 Abs. 2) frühestens ' + hm(a.end + 600) : '') });
          (b.flags = b.flags || []).push('rest');
        }
      }
    });
    // Wochen- und Minijob-Prüfung
    Object.keys(people).forEach(function (n) {
      var p = people[n];
      if (p.min > 3600) v.push({ typ: 'week60', name: n, date: mon, text: n + ': ' + std(p.min) + ' in der Woche (mehr als 6 × 10 h)', fix: 'Stunden auf höchstens 60 senken (§ 3 ArbZG)' });
      p.proj = p.payLegal * 13 / 3;
      if (p.art === 'mini') {
        var rateRef = Math.max(p.lohn, miloOn(sun));
        p.maxWeekMin = Math.floor(cap / rateRef / (13 / 3) * 60);
        if (p.proj > cap + 1e-9) v.push({ typ: 'mini', name: n, date: mon, eur: p.proj, text: n + ' (Minijob): ' + std(p.min) + ' × Lohn ergibt hochgerechnet ' + eur(p.proj) + ' im Monat, Grenze ' + eur0(cap), fix: 'höchstens ' + std(p.maxWeekMin) + ' pro Woche einplanen' });
      }
    });
    v.forEach(function (x) { if (people[x.name]) people[x.name].bad++; });
    var c = { rest: 0, rest10: 0, pause: 0, max10: 0, milo: 0, mini: 0, week60: 0, overlap: 0 };
    v.forEach(function (x) { c[x.typ]++; });
    var tot = { min: 0, pay: 0, payLegal: 0, short: 0 };
    Object.keys(people).forEach(function (n) { var p = people[n]; tot.min += p.min; tot.pay += p.pay; tot.payLegal += p.payLegal; tot.short += p.short; });
    var hard = v.filter(function (x) { return x.typ !== 'rest10'; }).length;
    return { mon: mon, sun: sun, days: [0, 1, 2, 3, 4, 5, 6].map(function (k) { return addDays(mon, k); }), shifts: P.shifts, people: people, order: T.team.map(function (t) { return t.name; }).concat(Object.keys(people).filter(function (n) { return !T.team.some(function (t) { return t.name === n; }); })),
      v: v, count: c, hard: hard, err: err, tot: tot, cap: cap, capYear: capYear, miloMon: miloOn(mon), miloSun: miloOn(sun), branche: inp.branche, reducible: red };
  }

  /* Monat aus gespeicherten Wochen (Pro): Stunden und Lohn je Person nur aus Schichten dieses Monats */
  function month(weeks, ym) {
    var per = {};
    (weeks || []).forEach(function (w) {
      var r = check(w);
      r.shifts.forEach(function (s) {
        if (s.date.slice(0, 7) !== ym) return;
        var p = r.people[s.name]; if (!p) return;
        var x = per[s.name] || (per[s.name] = { name: s.name, art: p.art, lohn: p.lohn, min: 0, pay: 0, payLegal: 0, rows: [] });
        x.min += s.net; x.pay += p.lohn * s.net / 60;
        x.payLegal += (p.art === 'azubi' ? p.lohn : Math.max(p.lohn, s.rate)) * s.net / 60;
        x.rows.push({ date: s.date, start: hm(s.start), end: hm(s.end), pause: s.pause, net: s.net });
      });
    });
    var cap = miniCap(+ym.slice(0, 4));
    Object.keys(per).forEach(function (n) { var x = per[n]; x.rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : 1; }); x.over = x.art === 'mini' && x.payLegal > cap; });
    return { ym: ym, cap: cap, per: per };
  }

  function toCSV(shifts) {
    var q = function (s) { s = String(s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return 'Name;Datum;Beginn;Ende;Pause;Arbeitszeit Std.\n' + shifts.map(function (s) {
      return [q(s.name), dmyy(s.date), hm(s.start), hm(s.end), s.pause, (Math.round(s.net / 60 * 100) / 100).toString().replace('.', ',')].join(';');
    }).join('\n') + '\n';
  }
  function fromCSV(text) {
    // -> Planzeilen "Name; TT.MM.JJJJ; HH:MM-HH:MM; Pause"
    return String(text).split(/\r?\n/).slice(1).filter(function (l) { return l.trim(); }).map(function (l) {
      var c = l.split(';').map(function (x) { return x.replace(/^"|"$/g, '').trim(); });
      return c[0] + '; ' + c[1] + '; ' + c[2] + '-' + c[3] + '; ' + (c[4] || 0);
    }).join('\n');
  }
  function ics(shifts, name, stamp) {
    var pad = function (n) { return ('0' + n).slice(-2); };
    var dt = function (abs) { var iso = isoOf(Math.floor(abs / 1440)).replace(/-/g, ''); var m = abs % 1440; return iso + 'T' + pad(Math.floor(m / 60)) + pad(m % 60) + '00'; };
    var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dienstplan erstellen//DE', 'CALSCALE:GREGORIAN'];
    shifts.filter(function (s) { return !name || s.name === name; }).forEach(function (s, i) {
      out.push('BEGIN:VEVENT', 'UID:dp-' + s.name.replace(/\W/g, '') + '-' + dt(s.start) + '-' + i + '@dienstplan', 'DTSTAMP:' + (stamp || '20261120T000000Z'),
        'DTSTART;TZID=Europe/Berlin:' + dt(s.start), 'DTEND;TZID=Europe/Berlin:' + dt(s.end), 'SUMMARY:Schicht ' + s.name + ' ' + hm(s.start) + '-' + hm(s.end) + (s.pause ? ' (Pause ' + s.pause + ' Min.)' : ''), 'END:VEVENT');
    });
    out.push('END:VCALENDAR'); return out.join('\r\n') + '\r\n';
  }

  var DP = { MILO: MILO, BRANCHEN: BRANCHEN, ART_LABEL: ART_LABEL, TAG_KURZ: TAG_KURZ, miloOn: miloOn, miniCap: miniCap, num: num, eur: eur, eur0: eur0, std: std, hm: hm, dur: dur,
    addDays: addDays, weekday: weekday, monday: monday, dmy: dmy, dmyy: dmyy, tagLabel: tagLabel, parseTeam: parseTeam, parsePlan: parsePlan, check: check, month: month, toCSV: toCSV, fromCSV: fromCSV, ics: ics };
  if (typeof module !== 'undefined' && module.exports) module.exports = DP; else root.DP = DP;
})(this);
