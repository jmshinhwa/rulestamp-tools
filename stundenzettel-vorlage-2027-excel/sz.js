/* Stundenzettel 2027 – Rechenkern + Excel-Erzeuger (läuft im Browser und in node, ohne Bibliotheken) */
(function (root) {
  'use strict';

  var BL = [
    ['BW', 'Baden-Württemberg'], ['BY', 'Bayern'], ['BE', 'Berlin'], ['BB', 'Brandenburg'], ['HB', 'Bremen'],
    ['HH', 'Hamburg'], ['HE', 'Hessen'], ['MV', 'Mecklenburg-Vorpommern'], ['NI', 'Niedersachsen'],
    ['NW', 'Nordrhein-Westfalen'], ['RP', 'Rheinland-Pfalz'], ['SL', 'Saarland'], ['SN', 'Sachsen'],
    ['ST', 'Sachsen-Anhalt'], ['SH', 'Schleswig-Holstein'], ['TH', 'Thüringen']
  ];
  var CODES = BL.map(function (x) { return x[0]; });
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  /* Mindestlohn je Stunde nach Datum (§ 1 MiLoV5) und Minijob-Grenze (Mindestlohn × 130 ÷ 3, aufgerundet, § 8 Abs. 1a SGB IV) */
  function milo(iso) { return iso >= '2027-01-01' ? 14.60 : 13.90; }
  function grenze(year) { return Math.ceil(milo(year + '-01-01') * 130 / 3 - 1e-9); }   // 2026: 603 · 2027: 633

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function wd(isoD) { var p = isoD.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }
  function addDays(isoD, n) {
    var p = isoD.split('-'), t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  function easter(y) {   // anonymer gregorianischer Algorithmus
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(y, mo, da);
  }
  /* gesetzliche Feiertage je Bundesland · nur landesweite (nicht: Mariä Himmelfahrt in Teilen Bayerns, Fronleichnam in Teilen von Sachsen/Thüringen, Augsburger Friedensfest) */
  function feiertage(y, bl) {
    var o = easter(y), L = [];
    function add(d, n, only) { if (!only || only.indexOf(bl) >= 0) L.push({ d: d, n: n }); }
    add(iso(y, 1, 1), 'Neujahr');
    add(iso(y, 1, 6), 'Heilige Drei Könige', ['BW', 'BY', 'ST']);
    add(iso(y, 3, 8), 'Frauentag', ['BE', 'MV']);
    add(addDays(o, -2), 'Karfreitag');
    add(o, 'Ostersonntag', ['BB']);
    add(addDays(o, 1), 'Ostermontag');
    add(iso(y, 5, 1), 'Tag der Arbeit');
    add(addDays(o, 39), 'Christi Himmelfahrt');
    add(addDays(o, 49), 'Pfingstsonntag', ['BB']);
    add(addDays(o, 50), 'Pfingstmontag');
    add(addDays(o, 60), 'Fronleichnam', ['BW', 'BY', 'HE', 'NW', 'RP', 'SL']);
    add(iso(y, 8, 15), 'Mariä Himmelfahrt', ['SL']);
    add(iso(y, 9, 20), 'Weltkindertag', ['TH']);
    add(iso(y, 10, 3), 'Tag der Deutschen Einheit');
    add(iso(y, 10, 31), 'Reformationstag', ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH']);
    add(iso(y, 11, 1), 'Allerheiligen', ['BW', 'BY', 'NW', 'RP', 'SL']);
    if (bl === 'SN') { var n23 = iso(y, 11, 23), back = (wd(n23) - 3 + 7) % 7 || 7; add(addDays(n23, -back), 'Buß- und Bettag'); }
    add(iso(y, 12, 25), '1. Weihnachtstag');
    add(iso(y, 12, 26), '2. Weihnachtstag');
    return L.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  }

  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function num(s) {
    if (typeof s === 'number') return s;
    s = String(s == null ? '' : s).trim().replace(/\s|€|EUR/gi, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s);
  }
  function hm(s) {
    var m = String(s).trim().match(/^(\d{1,2})(?::|\.|h)?(\d{2})?$/);
    if (!m) return null;
    var h = +m[1], mi = +(m[2] || 0);
    if (h > 24 || mi > 59) return null;
    return h * 60 + mi;
  }
  function fmtHM(min) { min = ((min % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }

  /* eine Zeile: "Sa 02.01.; 10:00-15:00; 30; Bemerkung" (Wochentag optional, Pause in Minuten, Bemerkung optional) */
  function parseRows(text, ym) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7), out = [], errs = [];
    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      var raw = line.trim();
      if (!raw || raw.charAt(0) === '#') return;
      var f = raw.split(';').map(function (x) { return x.trim(); });
      var dm = (f[0] || '').replace(/^(mo|di|mi|do|fr|sa|so)\.?\s*/i, '').match(/^(\d{1,2})(?:\.(\d{1,2})\.?(\d{2,4})?)?\.?$/);
      if (!dm) { errs.push('Zeile ' + (i + 1) + ': Datum nicht erkannt („' + f[0] + '“)'); return; }
      var d = +dm[1], mm = dm[2] ? +dm[2] : m;
      if (mm !== m || d < 1 || d > dim(y, m)) { errs.push('Zeile ' + (i + 1) + ': ' + f[0] + ' liegt nicht im ' + MONATE[m - 1] + ' ' + y); return; }
      var t = (f[1] || '').split(/\s*[-–]\s*/);
      var a = hm(t[0] || ''), b = hm(t[1] || '');
      if (a == null || b == null) { errs.push('Zeile ' + (i + 1) + ': Zeit als Beginn-Ende schreiben, z. B. 10:00-15:00'); return; }
      var p = f[2] === undefined || f[2] === '' ? 0 : num(f[2]);
      if (!(p >= 0)) { errs.push('Zeile ' + (i + 1) + ': Pause in Minuten, z. B. 30'); return; }
      out.push({ date: iso(y, m, d), start: a, end: b, pause: Math.round(p), note: f.slice(3).join('; ') });
    });
    out.sort(function (x, z) { return x.date < z.date ? -1 : x.date > z.date ? 1 : x.start - z.start; });
    return { rows: out, errs: errs };
  }

  /* Monat rechnen. inp = {ym, bl, art, lohn, soll, paid, rows:[{date,start,end,pause,note}]} */
  function month(inp) {
    var ym = inp.ym, y = +ym.slice(0, 4), m = +ym.slice(5, 7), ml = milo(ym + '-01'), lohn = num(inp.lohn), soll = num(inp.soll) || 0,
      paid = inp.paid === '' || inp.paid == null ? NaN : num(inp.paid), rate = Math.max(isNaN(lohn) ? 0 : lohn, ml);
    var hol = {}; feiertage(y, inp.bl).forEach(function (h) { if (h.d.slice(0, 7) === ym) hol[h.d] = h.n; });
    var perDay = {}, rows = (inp.rows || []).map(function (r) {
      var dur = r.end - r.start; if (dur <= 0) dur += 1440;
      var h = r2((dur - r.pause) / 60);
      perDay[r.date] = (perDay[r.date] || { h: 0, p: 0 });
      perDay[r.date].h = r2(perDay[r.date].h + h); perDay[r.date].p += r.pause;
      return { date: r.date, wd: WT[wd(r.date)], hol: hol[r.date] || '', start: r.start, end: r.end, pause: r.pause, hours: h,
        bis: addDays(r.date, 7), note: r.note || '', flags: [] };
    });
    var nPause = 0, nMax = 0, nHol = 0, nSun = 0;
    rows.forEach(function (r) {
      var day = perDay[r.date];
      if (day.h > 10) { r.flags.push('über 10 Std. am Tag (§ 3 ArbZG)'); nMax++; }
      if (day.h > 9 && day.p < 45) { r.flags.push('Pause ' + day.p + ' Min., nötig 45 (§ 4 ArbZG)'); nPause++; }
      else if (day.h > 6 && day.p < 30) { r.flags.push('Pause ' + day.p + ' Min., nötig 30 (§ 4 ArbZG)'); nPause++; }
      if (r.hol) { nHol++; }
      if (r.wd === 'So') { nSun++; }
    });
    var ist = r2(rows.reduce(function (s, r) { return s + r.hours; }, 0));
    var anspruch = r2(ist * rate), out = {
      ym: ym, label: MONATE[m - 1] + ' ' + y, bl: inp.bl, art: inp.art, milo: ml, lohn: lohn, rate: rate, rows: rows, hol: hol,
      ist: ist, soll: soll, ueber: r2(ist - soll), anspruch: anspruch, paid: paid,
      lohnUnterMilo: !isNaN(lohn) && lohn < ml, milGap: !isNaN(lohn) && lohn < ml ? r2(ist * (ml - lohn)) : 0,
      nPause: nPause, nMax: nMax, nHol: nHol, nSun: nSun, grenze: grenze(y), jahresgrenze: grenze(y) * 12
    };
    if (!isNaN(paid)) {
      out.unpaid = r2(Math.max(0, anspruch - paid));
      out.unpaidH = r2(Math.max(0, ist - paid / rate));
      out.eff = ist > 0 ? r2(paid / ist) : 0;
      out.effUnterMilo = ist > 0 && paid / ist < ml - 1e-9;
    }
    if (inp.art === 'minijob') {
      out.mini = anspruch > 2 * out.grenze ? 'double' : anspruch > out.grenze ? 'over' : 'ok';
      out.miniOver = r2(Math.max(0, anspruch - out.grenze));
      out.miniYear12 = r2(anspruch * 12);
    }
    return out;
  }

  /* Jahr aus gespeicherten Monaten (nur Monate desselben Jahres) */
  function year(months, y) {
    var L = months.filter(function (x) { return x.ym.slice(0, 4) === String(y); }).sort(function (a, b) { return a.ym < b.ym ? -1 : 1; });
    var g = grenze(y), o = { y: y, months: L, n: L.length, ist: 0, anspruch: 0, paid: 0, unpaid: 0, over: 0, overDouble: 0, grenze: g, jahresgrenze: g * 12 };
    L.forEach(function (x) {
      o.ist = r2(o.ist + x.ist); o.anspruch = r2(o.anspruch + x.anspruch);
      if (!isNaN(x.paid)) { o.paid = r2(o.paid + x.paid); o.unpaid = r2(o.unpaid + (x.unpaid || 0)); }
      if (x.anspruch > g) o.over++;
      if (x.anspruch > 2 * g) o.overDouble++;
    });
    o.yearOver = o.anspruch > o.jahresgrenze;
    o.occasionalOk = o.over <= 2 && o.overDouble === 0;
    return o;
  }

  function eur(x) {
    if (x == null || isNaN(x)) return '–';
    var s = Math.abs(x).toFixed(2).split('.'), i = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (x < 0 ? '−' : '') + i + ',' + s[1] + ' €';
  }
  function std(x) {
    if (x == null || isNaN(x)) return '–';
    var s = (Math.round(x * 100) / 100).toString().replace('.', ',');
    return s + ' Std.';
  }
  function dmy(isoD) { var p = isoD.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function dm(isoD) { var p = isoD.split('-'); return p[2] + '.' + p[1] + '.'; }

  /* ───────── Excel (.xlsx) ohne Bibliothek: OOXML + ZIP (Methode 0) ───────── */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) {
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) { c = 0x10000 + ((c - 0xD800) << 10) + (s.charCodeAt(++i) - 0xDC00); }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }
  function zip(files) {   // files: [[name, string]]
    var parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f[0]), data = utf8(f[1]), crc = crc32(data);
      var head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off)), name);
      off += head.length + name.length + data.length;
    });
    var cdStart = off, cdLen = 0;
    central.forEach(function (c, i) { if (i % 2 === 0) { parts.push(new Uint8Array(c)); cdLen += c.length; } else { parts.push(c); cdLen += c.length; } });
    parts.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdLen), u32(cdStart), u16(0))));
    var total = parts.reduce(function (s, p) { return s + p.length; }, 0), buf = new Uint8Array(total), pos = 0;
    parts.forEach(function (p) { buf.set(p, pos); pos += p.length; });
    return buf;
  }
  function x(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function col(n) { var s = ''; n++; while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
  function serial(isoD) { var p = isoD.split('-'); return (Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 86400000; }

  /* Stile (Index in cellXfs) */
  var S = { def: 0, bold: 1, title: 2, head: 3, date: 4, txt: 5, timeIn: 6, intIn: 7, hrs: 8, eur: 9, txtIn: 10, eurB: 11, hrsB: 12, note: 13, eurIn: 14, numIn: 15, dateB: 16, lab: 17, chk: 18 };
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="4"><numFmt numFmtId="164" formatCode="DD.MM.YYYY"/><numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;€&quot;"/>' +
    '<numFmt numFmtId="166" formatCode="hh:mm"/><numFmt numFmtId="167" formatCode="0.00"/></numFmts>' +
    '<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF4A5263"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
    '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1D2330"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF8DC"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF3FF"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFB9BEC8"/></left><right style="thin"><color rgb="FFB9BEC8"/></right><top style="thin"><color rgb="FFB9BEC8"/></top><bottom style="thin"><color rgb="FFB9BEC8"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="19">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +                                                   // 0 def
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                    // 1 bold
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                    // 2 title
    '<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>' + // 3 head
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +          // 4 date
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +                                  // 5 txt
    '<xf numFmtId="166" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>' + // 6 timeIn
    '<xf numFmtId="1" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>' +   // 7 intIn
    '<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +          // 8 hrs
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +          // 9 eur
    '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>' +   // 10 txtIn
    '<xf numFmtId="165" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 11 eurB
    '<xf numFmtId="167" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 12 hrsB
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' + // 13 note
    '<xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>' + // 14 eurIn
    '<xf numFmtId="167" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>' + // 15 numIn
    '<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' + // 16 dateB
    '<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>' + // 17 lab
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>' + // 18 chk
    '</cellXfs><cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles>' +
    '<dxfs count="3"><dxf><font><b/><color rgb="FFC0392B"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFDE2E1"/></patternFill></fill></dxf>' +
    '<dxf><fill><patternFill patternType="solid"><bgColor rgb="FFFFF2CC"/></patternFill></fill></dxf>' +
    '<dxf><font><b/><color rgb="FF1E8449"/></font></dxf></dxfs></styleSheet>';

  function Sheet(name) { this.name = name; this.rows = {}; this.cols = []; this.cf = []; this.dv = []; this.merge = []; this.print = false; this.freeze = null; this.heights = {}; }
  Sheet.prototype.set = function (ref, v, s, kind) {
    var m = ref.match(/^([A-Z]+)(\d+)$/), r = +m[2];
    (this.rows[r] = this.rows[r] || []).push({ ref: ref, v: v, s: s || 0, k: kind || (typeof v === 'number' ? 'n' : 's') });
    return this;
  };
  Sheet.prototype.f = function (ref, formula, s) { return this.set(ref, formula, s, 'f'); };
  Sheet.prototype.xml = function () {
    var self = this, rows = Object.keys(this.rows).map(Number).sort(function (a, b) { return a - b; });
    var colIdx = function (ref) { var l = ref.match(/^[A-Z]+/)[0], n = 0; for (var i = 0; i < l.length; i++) n = n * 26 + l.charCodeAt(i) - 64; return n; };
    var body = rows.map(function (r) {
      var cells = self.rows[r].sort(function (a, b) { return colIdx(a.ref) - colIdx(b.ref); }).map(function (c) {
        if (c.k === 'f') return '<c r="' + c.ref + '" s="' + c.s + '"' + '><f>' + x(c.v) + '</f></c>';
        if (c.k === 'n') return '<c r="' + c.ref + '" s="' + c.s + '"><v>' + c.v + '</v></c>';
        if (c.v === '' || c.v == null) return '<c r="' + c.ref + '" s="' + c.s + '"/>';
        return '<c r="' + c.ref + '" s="' + c.s + '" t="inlineStr"><is><t xml:space="preserve">' + x(c.v) + '</t></is></c>';
      }).join('');
      return '<row r="' + r + '"' + (self.heights[r] ? ' ht="' + self.heights[r] + '" customHeight="1"' : '') + '>' + cells + '</row>';
    }).join('');
    var s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    if (this.print) s += '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
    s += '<sheetViews><sheetView workbookViewId="0"' + (this.first ? ' tabSelected="1"' : '') + '>' +
      (this.freeze ? '<pane ySplit="' + (this.freeze - 1) + '" topLeftCell="A' + this.freeze + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews>';
    s += '<sheetFormatPr defaultRowHeight="15"/>';
    if (this.cols.length) s += '<cols>' + this.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    s += '<sheetData>' + body + '</sheetData>';
    if (this.merge.length) s += '<mergeCells count="' + this.merge.length + '">' + this.merge.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
    var pr = 1;
    this.cf.forEach(function (c) { s += '<conditionalFormatting sqref="' + c[0] + '"><cfRule type="expression" dxfId="' + c[2] + '" priority="' + (pr++) + '"><formula>' + x(c[1]) + '</formula></cfRule></conditionalFormatting>'; });
    if (this.dv.length) s += '<dataValidations count="' + this.dv.length + '">' + this.dv.map(function (d) {
      return '<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="' + d[0] + '"><formula1>' + x('"' + d[1] + '"') + '</formula1></dataValidation>';
    }).join('') + '</dataValidations>';
    s += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
    if (this.print) s += '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>';
    return s + '</worksheet>';
  };

  var E = 'Einstellungen';
  function ref(name, cell) { return "'" + name + "'!" + cell; }
  var SET = { name: '$B$2', firma: '$B$3', bl: '$B$4', lohn: '$B$5', art: '$B$6', soll: '$B$7', milo: '$B$8', mon: '$B$9', jahr: '$B$10', dbl: '$B$11' };
  function eRef(k) { return ref(E, SET[k]); }

  /* cfg = {name, firma, bl, art('minijob'|'teilzeit'|'vollzeit'), lohn, soll, months: {'2027-01': {paid, rows:[{date,start,end,pause,note}]}}, example: bool} */
  function workbook(cfg) {
    cfg = cfg || {};
    var Y = 2027, ART = { minijob: 'Minijob', teilzeit: 'Teilzeit', vollzeit: 'Vollzeit' };
    var sheets = [];
    /* Einstellungen */
    var st = new Sheet(E); st.cols = [44, 26, 40]; st.first = true;
    st.set('A1', 'Stundenzettel 2027 – Einstellungen (gelb = Eingabe)', S.title);
    var lines = [
      ['A2', 'Name der Person', 'B2', cfg.name || '', S.txtIn],
      ['A3', 'Arbeitgeber', 'B3', cfg.firma || '', S.txtIn],
      ['A4', 'Bundesland (Kürzel, z. B. BY)', 'B4', cfg.bl || 'BY', S.txtIn],
      ['A5', 'Stundenlohn laut Vertrag (€)', 'B5', isNaN(num(cfg.lohn)) ? 14.6 : num(cfg.lohn), S.eurIn],
      ['A6', 'Beschäftigung (Minijob, Teilzeit, Vollzeit)', 'B6', ART[cfg.art] || 'Minijob', S.txtIn],
      ['A7', 'Vereinbarte Stunden pro Monat (Soll)', 'B7', isNaN(num(cfg.soll)) ? 40 : num(cfg.soll), S.numIn]
    ];
    lines.forEach(function (l) { st.set(l[0], l[1], S.lab).set(l[2], l[3], l[4]); });
    st.set('A8', 'Mindestlohn ab 01.01.2027 (€ je Stunde)', S.lab).set('B8', 14.6, S.eur);
    st.set('A9', 'Minijob-Grenze 2027 pro Monat', S.lab).set('B9', grenze(Y), S.eur);
    st.set('A10', 'Minijob-Grenze 2027 pro Jahr (12 × 633 €)', S.lab).set('B10', grenze(Y) * 12, S.eur);
    st.set('A11', 'Gelegentlich überschreiten: höchstens bis', S.lab).set('B11', grenze(Y) * 2, S.eur);
    st.f('C4', 'IF(ISNUMBER(MATCH(B4,Feiertage!$C$1:$R$1,0)),"ok","Kürzel unbekannt: BW BY BE BB HB HH HE MV NI NW RP SL SN ST SH TH")', S.chk);
    st.f('C5', 'IF(B5<B8,"unter Mindestlohn 2027: "&FIXED(B8-B5,2)&" € je Stunde zu wenig","ok")', S.chk);
    st.cf.push(['C4:C5', 'AND(C4<>"",C4<>"ok")', 0], ['C4:C5', 'C4="ok"', 2]);
    st.dv.push(['B4', CODES.join(',')], ['B6', 'Minijob,Teilzeit,Vollzeit']);
    var notes = [
      'So arbeiten Sie: oben gelbe Felder ausfüllen. Dann je Monat Beginn, Ende und Pause (Minuten) eintragen und unten „Ausgezahlt“ eintragen. Stunden, Überstunden, Lohnanspruch, Pausen- und Mindestlohn-Prüfung und Minijob-Grenze rechnen sich selbst.',
      'Mindestlohn: 13,90 € ab 01.01.2026, 14,60 € ab 01.01.2027. Minijob-Grenze = Mindestlohn × 130 ÷ 3, aufgerundet: 633 € im Monat, 7.596 € im Jahr 2027. Gelegentlich und unvorhersehbar darf die Grenze in bis zu 2 Kalendermonaten innerhalb von 12 Monaten überschritten werden, höchstens bis 1.266 € im Monat (minijob-zentrale.de, gelesen am 26.11.2026).',
      '§ 17 MiLoG: Bei Minijobs und in den Branchen nach § 2a SchwarzArbG Beginn, Ende und Dauer der täglichen Arbeitszeit spätestens bis zum Ablauf des siebten Kalendertages nach dem Arbeitstag aufschreiben und mindestens 2 Jahre aufbewahren (gilt nicht für Minijobs im Privathaushalt). Spalte „Aufschreiben bis“ zeigt die Frist. Bußgeld bei fehlender oder verspäteter Aufzeichnung bis 50.000 € (§ 21 Abs. 3 MiLoG).',
      '§ 4 ArbZG: mehr als 6 bis 9 Stunden Arbeit: mindestens 30 Minuten Pause, mehr als 9 Stunden: 45 Minuten. § 3 ArbZG: höchstens 10 Stunden am Tag. Mehrere Schichten an einem Tag: die Lücke zwischen den Schichten als Pause eintragen.',
      'Feiertage: nur landesweite gesetzliche Feiertage. Nicht markiert: Mariä Himmelfahrt in Teilen Bayerns (2027 ein Sonntag), Fronleichnam in Teilen von Sachsen und Thüringen, Augsburger Friedensfest.',
      'Für die Minijob-Grenze zählt der Lohn, auf den ein Anspruch besteht, auch wenn weniger ausgezahlt wurde. Diese Datei rechnet und markiert, sie ersetzt keine Lohnabrechnung und keine Rechtsberatung.'
    ];
    notes.forEach(function (n, i) { st.set('A' + (13 + i), n, S.note); st.merge.push('A' + (13 + i) + ':C' + (13 + i)); st.heights[13 + i] = 48; });
    sheets.push(st);

    /* 12 Monate */
    for (var m = 1; m <= 12; m++) {
      var ym = Y + '-' + pad(m), sh = new Sheet(MONATE[m - 1]), data = (cfg.months || {})[ym] || {}, byDate = {};
      (data.rows || []).forEach(function (r) { if (!byDate[r.date]) byDate[r.date] = r; });
      sh.cols = [11, 5, 18, 8, 8, 8, 9, 30, 12, 11, 22]; sh.print = true; sh.freeze = 9;
      sh.f('A1', '"Stundenzettel ' + MONATE[m - 1] + ' ' + Y + ' – "&IF(' + eRef('name') + '="","Name",' + eRef('name') + ')', S.title);
      sh.set('A2', 'Arbeitgeber', S.bold).f('C2', 'IF(' + eRef('firma') + '="","",' + eRef('firma') + ')', S.def)
        .set('E2', 'Land', S.bold).f('F2', eRef('bl'), S.def).set('G2', 'Lohn/Std.', S.bold).f('H2', eRef('lohn'), S.eur)
        .set('I2', 'Art', S.bold).f('J2', eRef('art'), S.def);
      var R0 = 9, R1 = 39, rg = function (c) { return c + R0 + ':' + c + R1; };
      var rate = 'MAX(' + eRef('lohn') + ',' + eRef('milo') + ')';
      sh.set('A3', 'Ist-Stunden', S.lab).f('C3', 'SUM(' + rg('G') + ')', S.hrsB)
        .set('D3', 'Soll', S.lab).f('F3', eRef('soll'), S.hrsB)
        .set('G3', 'Überstunden', S.lab).f('H3', 'IF(C3=0,"",C3-F3)', S.hrsB);
      sh.set('A4', 'Lohnanspruch', S.lab).f('C4', 'ROUND(C3*' + rate + ',2)', S.eurB)
        .set('D4', 'Ausgezahlt', S.lab).set('F4', data.paid == null || isNaN(num(data.paid)) ? '' : num(data.paid), S.eurIn)
        .set('G4', 'Fehlt (unbezahlt)', S.lab).f('H4', 'IF(F4="","",MAX(0,C4-F4))', S.eurB);
      sh.set('A5', 'Lohn je Std. ausgezahlt', S.lab).f('C5', 'IF(OR(F4="",C3=0),"",ROUND(F4/C3,2))', S.eurB)
        .set('D5', 'Unbezahlte Std.', S.lab).f('F5', 'IF(F4="","",MAX(0,ROUND(C3-F4/' + rate + ',2)))', S.hrsB)
        .set('G5', 'Mindestlohn-Prüfung', S.lab)
        .f('H5', 'IF(' + eRef('lohn') + '<' + eRef('milo') + ',"Stundenlohn unter "&FIXED(' + eRef('milo') + ',2)&" €",IF(AND(C5<>"",C5<' + eRef('milo') + '),"Auszahlung unter Mindestlohn","ok"))', S.chk);
      sh.set('A6', 'Minijob-Grenze', S.lab).f('C6', eRef('mon'), S.eurB)
        .set('D6', 'Minijob-Prüfung', S.lab)
        .f('F6', 'IF(' + eRef('art') + '<>"Minijob","–",IF(C4>' + eRef('dbl') + ',"über 1.266 €",IF(C4>' + eRef('mon') + ',"über 633 € – Jahr prüfen","ok")))', S.chk);
      sh.merge.push('F6:H6');
      sh.set('A7', 'Pausen-/10-Std.-Hinweise', S.lab).f('C7', 'SUMPRODUCT((' + rg('H') + '<>"")*(' + rg('H') + '<>"ok"))', S.chk)
        .set('D7', 'Feiertagsarbeit', S.lab).f('F7', 'SUMPRODUCT((' + rg('C') + '<>"")*ISNUMBER(' + rg('G') + '))', S.chk)
        .set('G7', 'Frist § 17 MiLoG: 7 Tage nach dem Arbeitstag', S.note);
      sh.merge.push('A3:B3', 'A4:B4', 'A5:B5', 'A6:B6', 'A7:B7', 'D3:E3', 'D4:E4', 'D5:E5', 'D6:E6', 'D7:E7');
      ['Datum', 'Tag', 'Feiertag', 'Beginn', 'Ende', 'Pause (Min.)', 'Stunden', 'Prüfung (§ 3 / § 4 ArbZG)', 'Aufschreiben bis', 'Lohn (€)', 'Bemerkung']
        .forEach(function (h, i) { sh.set(col(i) + '8', h, S.head); });
      sh.heights[8] = 30;
      var nd = dim(Y, m);
      for (var d = 1; d <= nd; d++) {
        var r = R0 + d - 1, di = iso(Y, m, d), row = byDate[di];
        sh.set('A' + r, serial(di), S.date).set('B' + r, WT[wd(di)], S.txt)
          .f('C' + r, 'IFERROR(IF(INDEX(Feiertage!$C$2:$R$30,MATCH(A' + r + ',Feiertage!$A$2:$A$30,0),MATCH(' + eRef('bl') + ',Feiertage!$C$1:$R$1,0))="x",INDEX(Feiertage!$B$2:$B$30,MATCH(A' + r + ',Feiertage!$A$2:$A$30,0)),""),"")', S.txt)
          .set('D' + r, row ? row.start / 1440 : '', S.timeIn).set('E' + r, row ? (row.end % 1440) / 1440 : '', S.timeIn)
          .set('F' + r, row ? row.pause : '', S.intIn)
          .f('G' + r, 'IF(OR(D' + r + '="",E' + r + '=""),"",ROUND(MOD(E' + r + '-D' + r + ',1)*24-N(F' + r + ')/60,2))', S.hrs)
          .f('H' + r, 'IF(G' + r + '="","",IF(G' + r + '>10,"über 10 Std. (§ 3 ArbZG)",IF(AND(G' + r + '>9,N(F' + r + ')<45),"Pause unter 45 Min. (§ 4 ArbZG)",IF(AND(G' + r + '>6,N(F' + r + ')<30),"Pause unter 30 Min. (§ 4 ArbZG)","ok"))))', S.txt)
          .f('I' + r, 'IF(G' + r + '="","",A' + r + '+7)', S.date)
          .f('J' + r, 'IF(G' + r + '="","",ROUND(G' + r + '*' + rate + ',2))', S.eur)
          .set('K' + r, row && row.note ? row.note : '', S.txtIn);
      }
      sh.set('A41', 'Unterschrift Arbeitnehmer/in, Datum', S.note).set('G41', 'Unterschrift Arbeitgeber, Datum', S.note);
      sh.merge.push('A41:E41', 'G41:K41');
      sh.heights[41] = 36;
      sh.cf.push([rg('H'), 'AND(H' + R0 + '<>"",H' + R0 + '<>"ok")', 0], ['H5', 'AND(H5<>"",H5<>"ok")', 0], ['F6', 'AND(F6<>"ok",F6<>"–")', 0],
        ['C7', 'C7>0', 0], ['H4', 'AND(ISNUMBER(H4),H4>0)', 0], ['A' + R0 + ':K' + R1, '$C' + R0 + '<>""', 1], ['H5', 'H5="ok"', 2], ['F6', 'F6="ok"', 2]);
      sheets.push(sh);
    }

    /* Jahresübersicht */
    var j = new Sheet('Jahr 2027'); j.cols = [14, 11, 11, 12, 14, 14, 14, 26]; j.print = true;
    j.f('A1', '"Jahresübersicht 2027 – "&IF(' + eRef('name') + '="","Name",' + eRef('name') + ')', S.title);
    ['Monat', 'Ist-Std.', 'Soll-Std.', 'Überstunden', 'Lohnanspruch', 'Ausgezahlt', 'Fehlt', 'Minijob-Prüfung'].forEach(function (h, i) { j.set(col(i) + '2', h, S.head); });
    for (var k = 0; k < 12; k++) {
      var rr = 3 + k, sn = MONATE[k];
      j.set('A' + rr, sn, S.txt).f('B' + rr, ref(sn, 'C3'), S.hrs).f('C' + rr, 'IF(' + ref(sn, 'C3') + '=0,"",' + ref(sn, 'F3') + ')', S.hrs).f('D' + rr, 'IF(' + ref(sn, 'H3') + '="","",' + ref(sn, 'H3') + ')', S.hrs)
        .f('E' + rr, ref(sn, 'C4'), S.eur).f('F' + rr, 'IF(' + ref(sn, 'F4') + '="","",' + ref(sn, 'F4') + ')', S.eur)
        .f('G' + rr, 'IF(' + ref(sn, 'H4') + '="","",' + ref(sn, 'H4') + ')', S.eur).f('H' + rr, ref(sn, 'F6'), S.txt);
    }
    j.set('A15', 'Summe', S.lab).f('B15', 'SUM(B3:B14)', S.hrsB).f('C15', 'SUM(C3:C14)', S.hrsB).f('D15', 'SUM(D3:D14)', S.hrsB)
      .f('E15', 'SUM(E3:E14)', S.eurB).f('F15', 'SUM(F3:F14)', S.eurB).f('G15', 'SUM(G3:G14)', S.eurB);
    j.set('A17', 'Minijob-Jahresgrenze', S.lab).f('E17', eRef('jahr'), S.eurB);
    j.set('A18', 'Monate über 633 €', S.lab).f('E18', 'COUNTIF(E3:E14,">"&' + eRef('mon') + ')', S.chk);
    j.set('A19', 'Monate über 1.266 €', S.lab).f('E19', 'COUNTIF(E3:E14,">"&' + eRef('dbl') + ')', S.chk);
    j.set('A20', 'Ergebnis Jahr', S.lab)
      .f('E20', 'IF(' + eRef('art') + '<>"Minijob","–",IF(E15<=E17,"Jahresgrenze eingehalten",IF(AND(E18<=2,E19=0),"über 7.596 €: nur zulässig, wenn gelegentlich und unvorhersehbar","über 7.596 €: Minijob-Status mit dem Lohnbüro klären")))', S.chk);
    j.merge.push('A17:D17', 'A18:D18', 'A19:D19', 'A20:D20', 'E20:H20');
    j.set('A22', 'Rechnet die 12 Monatsblätter zusammen. Lohnanspruch = Stunden × Vertragslohn, mindestens × Mindestlohn 14,60 €.', S.note);
    j.merge.push('A22:H22');
    j.cf.push(['H3:H14', 'AND(H3<>"ok",H3<>"–")', 0], ['E20', 'AND(E20<>"Jahresgrenze eingehalten",E20<>"–")', 0], ['E20', 'E20="Jahresgrenze eingehalten"', 2], ['E18', 'E18>2', 0], ['E19', 'E19>0', 0], ['G15', 'G15>0', 0]);
    sheets.push(j);

    /* Feiertage 2027 je Bundesland */
    var fsh = new Sheet('Feiertage'), all = {};
    CODES.forEach(function (c) { feiertage(Y, c).forEach(function (h) { (all[h.d] = all[h.d] || { n: h.n, bl: {} }).bl[c] = 1; }); });
    fsh.cols = [12, 24].concat(CODES.map(function () { return 5; }));
    fsh.set('A1', 'Datum', S.head).set('B1', 'Feiertag 2027', S.head);
    CODES.forEach(function (c, i) { fsh.set(col(2 + i) + '1', c, S.head); });
    Object.keys(all).sort().forEach(function (d, i) {
      var r = 2 + i; fsh.set('A' + r, serial(d), S.date).set('B' + r, all[d].n, S.txt);
      CODES.forEach(function (c, ci) { fsh.set(col(2 + ci) + r, all[d].bl[c] ? 'x' : '', S.txt); });
    });
    sheets.push(fsh);

    var files = [];
    files.push(['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>']);
    files.push(['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>']);
    files.push(['docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>Stundenzettel Vorlage 2027</dc:title><dc:creator>rulestamp</dc:creator><dc:language>de-DE</dc:language></cp:coreProperties>']);
    files.push(['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + x(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
      '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>']);
    files.push(['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']);
    files.push(['xl/styles.xml', STYLES]);
    sheets.forEach(function (s, i) { files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', s.xml()]); });
    return zip(files);
  }

  /* Beispiel (erfunden): Minijob in Bayern, Januar 2027 */
  var BEISPIEL = {
    ym: '2027-01', bl: 'BY', art: 'minijob', lohn: '14,60', soll: '40', paid: '584,00', name: 'Lena (Beispiel)',
    text: 'Sa 02.01.; 10:00-15:00; 0\nMi 06.01.; 16:00-21:00; 0\nSa 09.01.; 10:00-16:30; 0\nMi 13.01.; 16:00-20:30; 0\nSa 16.01.; 10:00-15:00; 0\n' +
      'Mi 20.01.; 16:00-20:30; 0\nSa 23.01.; 10:00-15:30; 0\nMi 27.01.; 16:00-20:30; 0\nSa 30.01.; 10:00-16:30; 30'
  };

  var API = { BL: BL, CODES: CODES, MONATE: MONATE, milo: milo, grenze: grenze, feiertage: feiertage, easter: easter, parseRows: parseRows, month: month, year: year,
    eur: eur, std: std, dmy: dmy, dm: dm, fmtHM: fmtHM, num: num, workbook: workbook, zip: zip, crc32: crc32, BEISPIEL: BEISPIEL, addDays: addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.SZ = API;
})(this);
