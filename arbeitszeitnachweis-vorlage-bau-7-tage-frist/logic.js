/* Arbeitszeitnachweis vorlage Bau: Rechenkern (läuft im Browser und in node) */
(function (root) {
  'use strict';
  // Mindestlohn je Zeitstunde: MiLoV5 § 1 (ab 01.01.2026 13,90 €, ab 01.01.2027 14,60 €), davor MiLoV4
  var ML = [['2027-01-01', 14.60], ['2026-01-01', 13.90], ['2025-01-01', 12.82], ['2024-01-01', 12.41]];
  var DOK_HI = 4461, DOK_LO = 2974; // MiLoDokV § 1 Abs. 1 (gelesen 19.11.2026)
  var FRIST_TAGE = 7;               // § 17 Abs. 1 MiLoG
  var BUSSGELD = 50000;             // § 21 Abs. 1 Nr. 8, Abs. 3 MiLoG
  var BRANCHEN = {
    bau: 'Baugewerbe', transport: 'Spedition, Transport, Logistik', gastro: 'Gaststätten und Beherbergung',
    reinigung: 'Gebäudereinigung', andere: 'andere Branche nach § 2a SchwarzArbG', keine: 'keine § 2a-Branche'
  };

  function mlohn(d) { for (var i = 0; i < ML.length; i++) if (String(d) >= ML[i][0]) return ML[i][1]; return 12.41; }
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function okDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10)) && !isNaN(Date.parse(String(s).slice(0, 10))); }
  function addDays(s, n) {
    s = String(s).slice(0, 10);
    var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) + n * 864e5);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }
  function monday(s) {
    s = String(s).slice(0, 10);
    var wd = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))).getUTCDay();
    return addDays(s, -((wd + 6) % 7));
  }
  function de(s) { s = String(s || ''); return okDate(s) ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : ''; }
  function wtag(s) { s = String(s).slice(0, 10); return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))).getUTCDay()]; }
  function kw(s) { // ISO-Kalenderwoche
    s = String(s).slice(0, 10);
    var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
    var day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
    var j = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((d - j) / 864e5 - 3 + ((j.getUTCDay() + 6) % 7)) / 7);
  }
  function mins(t) { var m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; }
  function dauer(b, e, p) {
    var a = mins(b), z = mins(e); if (a == null || z == null) return 0;
    if (z <= a) z += 1440; // über Mitternacht
    return Math.max(0, z - a - (+p || 0)) / 60;
  }

  // Gilt § 17 Abs. 1 MiLoG für diese Person?
  function pflicht(branche, w) {
    w = w || {};
    if (w.art === 'fam') return { on: false, why: 'Angehörige/r des Inhabers (§ 1 Abs. 2 MiLoDokV)' };
    if (w.art === 'mini') return { on: true, why: 'Minijob (§ 8 Abs. 1 SGB IV)' };
    if (branche === 'keine') return { on: false, why: 'keine § 2a-Branche und kein Minijob' };
    var b = +w.brutto || 0;
    if (b > DOK_HI) return { on: false, why: 'Monatsbrutto über 4.461 € (§ 1 Abs. 1 MiLoDokV)' };
    if (b > DOK_LO && w.zwoelf === 'ja') return { on: false, why: 'über 2.974 € seit 12 Monaten belegt (§ 1 Abs. 1 MiLoDokV)' };
    return { on: true, why: BRANCHEN[branche] || BRANCHEN.bau };
  }

  // Herzstück: eine Woche prüfen
  function pruefe(v, workers, rows) {
    var wk = monday(okDate(v.woche) ? v.woche : '2026-11-09'), bis = addDays(wk, 6);
    var pruef = okDate(v.pruef) ? String(v.pruef).slice(0, 10) : wk;
    var byName = {}; (workers || []).forEach(function (w) { if (w && w.name) byName[w.name] = w; });
    var out = { woche: wk, bis: bis, kw: kw(wk), pruef: pruef, branche: v.branche || 'bau', zeilen: [], stunden: 0,
      spaet: 0, fehlt: 0, offen: 0, frei: 0, pause: 0, zehn: 0, luecke: 0, luecke2027: 0, baustellen: {}, leute: {}, naechste: null };
    (rows || []).filter(function (r) { return okDate(r.d) && r.d >= wk && r.d <= bis; })
      .sort(function (a, b) { return (a.d + a.name) < (b.d + b.name) ? -1 : 1; })
      .forEach(function (r) {
        var w = byName[r.name] || { name: r.name || '?', lohn: 0, art: 'an' };
        var h = r2(dauer(r.b, r.e, r.p)), p = +r.p || 0;
        var pf = pflicht(out.branche, w), frist = addDays(r.d, FRIST_TAGE), ein = okDate(r.ein) ? String(r.ein).slice(0, 10) : '';
        var z = { d: r.d, name: w.name, ort: r.ort || '', b: r.b, e: r.e, p: p, h: h, frist: frist, ein: ein, flags: [] };
        if (!pf.on) { z.st = 'frei'; z.why = pf.why; out.frei++; }
        else if (ein) { z.st = ein > frist ? 'spaet' : 'ok'; if (z.st === 'spaet') out.spaet++; }
        else if (pruef > frist) { z.st = 'fehlt'; out.fehlt++; }
        else { z.st = 'offen'; out.offen++; if (!out.naechste || frist < out.naechste) out.naechste = frist; }
        var need = h > 9 ? 45 : (h > 6 ? 30 : 0);
        if (p < need) { z.flags.push('Pause ' + p + ' von ' + need + ' Min. (§ 4 ArbZG)'); out.pause++; }
        if (h > 10) { z.flags.push('über 10 Std. (§ 3 ArbZG)'); out.zehn++; }
        var ml = mlohn(r.d), lohn = +w.lohn || 0;
        if (lohn > 0 && lohn < ml) { var l = r2((ml - lohn) * h); z.flags.push('Mindestlohn: ' + (ml - lohn).toFixed(2).replace('.', ',') + ' € je Std. zu wenig'); out.luecke += l; }
        if (lohn > 0 && lohn < 14.60) out.luecke2027 += (14.60 - lohn) * h;
        out.stunden += h;
        var o = z.ort || '(ohne Baustelle)'; out.baustellen[o] = r2((out.baustellen[o] || 0) + h);
        var L = out.leute[w.name] || (out.leute[w.name] = { name: w.name, h: 0, tage: 0, pf: pf, lohn: lohn });
        L.h = r2(L.h + h); L.tage++;
        out.zeilen.push(z);
      });
    out.stunden = r2(out.stunden); out.luecke = r2(out.luecke); out.luecke2027 = r2(out.luecke2027);
    out.verstoesse = out.spaet + out.fehlt;
    return out;
  }

  // Monatsnachweis je Person (Pro: druckt ihn)
  function monat(name, ym, rows) {
    var list = (rows || []).filter(function (r) { return r.name === name && okDate(r.d) && String(r.d).slice(0, 7) === ym; })
      .sort(function (a, b) { return a.d < b.d ? -1 : 1; })
      .map(function (r) { return { d: r.d, ort: r.ort || '', b: r.b, e: r.e, p: +r.p || 0, h: r2(dauer(r.b, r.e, r.p)), ein: r.ein || '' }; });
    var sum = r2(list.reduce(function (s, x) { return s + x.h; }, 0));
    var last = list.length ? addDays(list[list.length - 1].d, FRIST_TAGE) : '';
    return { name: name, ym: ym, tage: list, sum: sum, aufbewahren_bis: last ? addDays(last, 0).replace(/^(\d{4})/, function (y) { return String(+y + 2); }) : '' };
  }

  // Beispiel (erfunden): Kolonne in KW 46/2026, Zettel der Baustelle kamen erst am Dienstag ins Büro
  function sample() {
    var W = [
      { name: 'Tomasz K. (Maurer)', lohn: 19.80, brutto: 3430, zwoelf: 'nein', art: 'an' },
      { name: 'Ali D. (Helfer)', lohn: 13.50, brutto: 2340, zwoelf: 'nein', art: 'an' },
      { name: 'Jonas B. (Lkw-Fahrer)', lohn: 17.20, brutto: 2980, zwoelf: 'nein', art: 'an' },
      { name: 'Frank R. (Polier)', lohn: 27.70, brutto: 4800, zwoelf: 'ja', art: 'an' }
    ];
    var R = [], days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
    days.forEach(function (d, i) {
      var ort = i < 3 ? 'Neubau Lindenstraße 12' : 'Sanierung Hofweg 3';
      ['Tomasz K. (Maurer)', 'Ali D. (Helfer)'].forEach(function (n) {
        R.push({ name: n, d: d, ort: ort, b: '07:00', e: i === 0 ? '17:30' : '16:00', p: 30, ein: '2026-11-17' });
      });
    });
    var J = [['06:00', '15:30', 30, ''], ['06:00', '14:30', 30, '2026-11-10'], ['06:00', '17:15', 45, '2026-11-11'], ['06:00', '14:30', 30, '2026-11-12'], ['06:00', '12:00', 0, '2026-11-13']];
    days.forEach(function (d, i) { R.push({ name: 'Jonas B. (Lkw-Fahrer)', d: d, ort: 'Fuhren Lager', b: J[i][0], e: J[i][1], p: J[i][2], ein: J[i][3] }); });
    ['2026-11-09', '2026-11-10'].forEach(function (d) { R.push({ name: 'Frank R. (Polier)', d: d, ort: 'Neubau Lindenstraße 12', b: '07:00', e: '16:00', p: 30, ein: '' }); });
    return { v: { woche: '2026-11-09', branche: 'bau', pruef: '2026-11-19' }, workers: W, rows: R };
  }

  var api = { sample: sample, ML: ML, mlohn: mlohn, DOK_HI: DOK_HI, DOK_LO: DOK_LO, FRIST_TAGE: FRIST_TAGE, BUSSGELD: BUSSGELD, BRANCHEN: BRANCHEN,
    r2: r2, okDate: okDate, addDays: addDays, monday: monday, de: de, wtag: wtag, kw: kw, dauer: dauer, pflicht: pflicht, pruefe: pruefe, monat: monat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AZN = api;
})(this);
