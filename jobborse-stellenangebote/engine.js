// engine.js — "Jobbörse Stellenangebote" core (browser + worker). Rows from the official BA Jobbörse (rest.arbeitsagentur.de v6)
// and from employers' own Personio career pages (<firma>.jobs.personio.de/xml). No AI, no outside paid service.
(function (g) {
  'use strict';
  var DAY = 864e5, STALE = 60;
  function S(v, n) { return String(v == null ? '' : v).slice(0, n || 300); }
  function ymd(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function de(t) { if (!t) return ''; var s = typeof t === 'string' ? t.slice(0, 10) : ymd(t); var p = s.split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : s; }
  function pd(s) { if (!s) return 0; var t = Date.parse(String(s).slice(0, 10) + 'T00:00:00Z'); return isNaN(t) ? 0 : t; }
  function days(from, now) { return from ? Math.max(0, Math.floor((now - from) / DAY)) : null; }
  function detailUrl(ref) { return 'https://www.arbeitsagentur.de/jobsuche/jobdetail/' + encodeURIComponent(ref); }
  // BA v6 row → our row
  function baRow(r) {
    var loc = (r.stellenlokationen || [])[0] || {}, a = loc.adresse || r.arbeitsort || {};
    var sal = '', v1 = r.gehaltsspanneVon || r.festgehalt, v2 = r.gehaltsspanneBis;
    function nf(x) { x = +x; return isNaN(x) ? '' : x.toLocaleString('de-DE', { maximumFractionDigits: 2 }); }
    if (v1 || v2) sal = [v1, v2].filter(Boolean).map(nf).filter(function (x, i, a) { return a.indexOf(x) === i; }).join('–') + ' €' + (/STUND/.test(r.verguetungsangabe || '') ? '/Std.' : /JAHR/.test(r.verguetungsangabe || '') ? '/Jahr' : /MONAT/.test(r.verguetungsangabe || '') ? '/Monat' : '');
    var wz = [];
    if (r.arbeitszeitVollzeit) wz.push('vz');
    if (r.arbeitszeitTeilzeitVormittag || r.arbeitszeitTeilzeitNachmittag || r.arbeitszeitTeilzeitAbend || r.arbeitszeitTeilzeitFlexibel) wz.push('tz');
    if (r.istGeringfuegigeBeschaeftigung) wz.push('mini');
    if (r.homeofficemoeglich) wz.push('ho');
    return { src: 'ba', id: S(r.referenznummer, 80), t: S(r.stellenangebotsTitel || r.titel || r.hauptberuf, 200), co: S(r.firma, 160).replace(/\s{2,}/g, ' '),
      l: S([a.plz, a.ort].filter(Boolean).join(' '), 80), km: r.entfernung == null ? null : +r.entfernung, p: pd(r.datumErsteVeroeffentlichung || (r.veroeffentlichungszeitraum || {}).von),
      ch: r.aenderungsdatum ? Date.parse(r.aenderungsdatum + (/Z$/.test(r.aenderungsdatum) ? '' : 'Z')) || 0 : 0, sal: S(sal, 40), wz: wz,
      bef: r.vertragsdauer === 'BEFRISTET' ? 1 : 0, u: detailUrl(r.referenznummer), x: /^https:\/\//.test(r.externeURL || '') ? S(r.externeURL, 400) : '' };
  }
  // Personio XML (text) → rows
  function personio(slug, xml) {
    var out = [], re = /<position>([\s\S]*?)<\/position>/g, m;
    function tag(b, n) { var x = new RegExp('<' + n + '>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</' + n + '>').exec(b); return x ? x[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : ''; }
    while ((m = re.exec(xml))) {
      var b = m[1].replace(/<jobDescriptions>[\s\S]*?<\/jobDescriptions>/, ''), id = tag(b, 'id');
      if (!id) continue;
      var offs = [tag(b, 'office')], ao = /<additionalOffices>([\s\S]*?)<\/additionalOffices>/.exec(b);
      if (ao) { var r2 = /<office>([\s\S]*?)<\/office>/g, k; while ((k = r2.exec(ao[1]))) offs.push(k[1].trim()); }
      var sch = tag(b, 'schedule');
      out.push({ src: 'p', id: slug + '#' + S(id, 30), t: S(tag(b, 'name'), 200), co: S(tag(b, 'subcompany').replace(/\s+-\s+\d+$/, '') || slug, 160), l: S(offs.filter(Boolean).join(', '), 120), km: null,
        p: Date.parse(tag(b, 'createdAt')) || 0, ch: 0, sal: '', wz: /part/i.test(sch) ? ['tz'] : /full/i.test(sch) ? ['vz'] : [], bef: /temporary|befrist/i.test(tag(b, 'employmentType')) ? 1 : 0,
        u: 'https://' + slug + '.jobs.personio.de/job/' + encodeURIComponent(id), x: '' });
    }
    return out;
  }
  function slugOf(v) {
    v = String(v || '').trim().toLowerCase();
    var m = /^(?:https?:\/\/)?([a-z0-9][a-z0-9-]{0,62})\.jobs\.personio\.(?:de|com)\b/.exec(v);
    if (m) return m[1];
    return /^[a-z0-9][a-z0-9-]{0,62}$/.test(v) ? v : '';
  }
  function key(r) { return (r.co + '|' + r.t + '|' + (r.l.split(' ').slice(-1)[0] || '')).toLowerCase().replace(/\s+/g, ' '); }
  // flags: age in days, > 60 days, listed N× (same employer + title + town), redated (changed ≥ 30 d after first publication)
  function annotate(rows, now) {
    var c = {};
    rows.forEach(function (r) { var k = key(r); c[k] = (c[k] || 0) + 1; });
    rows.forEach(function (r) {
      r.age = days(r.p, now); r.n = c[key(r)]; r.f = [];
      if (r.age != null && r.age <= 1) r.f.push('new'); else if (r.age != null && r.age <= 7) r.f.push('week');
      if (r.age != null && r.age > STALE) r.f.push('stale');
      if (r.n > 1) r.f.push('dup');
      if (r.ch && r.p && r.ch - r.p >= 30 * DAY && r.age > 30) r.f.push('red');
    });
    return rows;
  }
  function parseQ(q) {
    var inc = [], exc = [];
    String(q || '').toLowerCase().split(/\s+/).filter(Boolean).forEach(function (w) { if (w[0] === '-' && w.length > 1) exc.push(w.slice(1)); else inc.push(w.split('|')); });
    return { inc: inc, exc: exc };
  }
  function filter(rows, o) {
    o = o || {}; var q = parseQ(o.q), within = +o.within || 0, now = o.now || Date.now();
    return rows.filter(function (r) {
      var h = (r.t + ' ' + r.co + ' ' + r.l).toLowerCase();
      if (q.exc.some(function (w) { return h.indexOf(w) >= 0; })) return false;
      if (!q.inc.every(function (alt) { return alt.some(function (w) { return h.indexOf(w) >= 0; }); })) return false;
      if (within && (r.age == null || r.age > within)) return false;
      if (o.hideStale && r.f.indexOf('stale') >= 0) return false;
      if (o.hideDup && r.f.indexOf('dup') >= 0 && r.f.indexOf('stale') >= 0) return false;
      if (o.sal && !r.sal) return false;
      if (o.tz && r.wz.indexOf('tz') < 0) return false;
      if (o.ho && r.wz.indexOf('ho') < 0) return false;
      return true;
    });
  }
  function sortRows(rows, how) {
    var a = rows.slice();
    if (how === 'old') a.sort(function (x, y) { return (x.p || 9e15) - (y.p || 9e15); });
    else if (how === 'km') a.sort(function (x, y) { return (x.km == null ? 9e9 : x.km) - (y.km == null ? 9e9 : y.km) || (y.p - x.p); });
    else if (how === 'co') a.sort(function (x, y) { return x.co.localeCompare(y.co, 'de') || (y.p - x.p); });
    else a.sort(function (x, y) { return (y.p || 0) - (x.p || 0) || x.co.localeCompare(y.co, 'de'); });
    return a;
  }
  function stats(rows) {
    var s = { n: rows.length, d1: 0, d7: 0, stale: 0, dup: 0, sal: 0, oldest: 0 };
    rows.forEach(function (r) {
      if (r.f.indexOf('new') >= 0) s.d1++;
      if (r.age != null && r.age <= 7) s.d7++;
      if (r.f.indexOf('stale') >= 0) s.stale++;
      if (r.f.indexOf('dup') >= 0) s.dup++;
      if (r.sal) s.sal++;
      if (r.p && (!s.oldest || r.p < s.oldest)) s.oldest = r.p;
    });
    return s;
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csv(head, rows) { return '﻿' + [head].concat(rows).map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n'); }
  // application log (Eigenbemühungen): {id, d:'YYYY-MM-DD', co, t, l, ref, u, art, st, note}
  var ART = ['online', 'mail', 'post', 'pers', 'tel', 'initiativ'], ST = ['offen', 'eingang', 'gespraech', 'absage', 'zusage', 'keine'];
  function cleanLog(e) {
    e = e || {};
    return { id: S(e.id, 120), d: /^\d{4}-\d{2}-\d{2}$/.test(e.d) ? e.d : ymd(Date.now()), co: S(e.co, 160), t: S(e.t, 200), l: S(e.l, 120), ref: S(e.ref, 120), u: /^https:\/\//.test(e.u || '') ? S(e.u, 400) : '',
      art: ART.indexOf(e.art) >= 0 ? e.art : 'online', st: ST.indexOf(e.st) >= 0 ? e.st : 'offen', note: S(e.note, 300) };
  }
  function logRange(log, from, to) { return log.filter(function (e) { return (!from || e.d >= from) && (!to || e.d <= to); }).sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }); }
  g.JB = { DAY: DAY, STALE: STALE, baRow: baRow, personio: personio, slugOf: slugOf, annotate: annotate, filter: filter, sortRows: sortRows, stats: stats, csv: csv,
    ymd: ymd, de: de, pd: pd, days: days, detailUrl: detailUrl, cleanLog: cleanLog, logRange: logRange, ART: ART, ST: ST, key: key };
})(typeof globalThis !== 'undefined' ? globalThis : this);
