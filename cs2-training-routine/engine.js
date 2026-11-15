/* CS2 Training Routine – Rechenkern (läuft im Browser und in node) */
(function (root) {
  'use strict';
  var SK = [
    { id: 'aim', name: 'Aim', test: 'Kills in 60 Sekunden auf einer Bot-Aimkarte', unit: 'Kills', cur: 38, tgt: 50,
      drills: ['Bot-Aimkarte (Workshop), stehende Bots: nur Kopf, AK-47, ein Schuss pro Bot',
               'Bot-Aimkarte, laufende Bots: nach jedem Kill sofort das nächste Ziel',
               'Nur Pistole (USP-S oder Glock): jeder Schuss auf Kopfhöhe',
               'Flicks zwischen einem nahen und einem fernen Bot, abwechselnd'] },
    { id: 'spray', name: 'Spray', test: 'Treffer mit 30 Schuss AK-47 auf einen Bot', unit: 'Treffer', cur: 18, tgt: 25,
      drills: ['AK-47 an die Wand: erst 10, dann 20, dann 30 Schuss (sv_showimpacts 1 zeigt jeden Einschlag)',
               'Spray-Transfer: ein Magazin auf zwei nebeneinander stehende Bots',
               'M4A4 und M4A1-S: 20 Schuss an die Wand, Muster vergleichen',
               'Bursts aus 3 bis 5 Schuss auf weite Entfernung'] },
    { id: 'strafe', name: 'Counter-Strafe', test: 'saubere Stopps mit Treffer von 20', unit: 'Stopps', cur: 11, tgt: 16,
      drills: ['A-D-Strafe: Gegentaste antippen, dann ein Schuss auf den Kopf',
               'Um eine Ecke peeken, stoppen, ein Schuss, zurück in Deckung',
               'Jiggle-Peek und Shoulder-Peek an einer Ecke deiner Karte',
               'Stoppen und schießen mit der Galil/FAMAS, dann mit der AK-47'] },
    { id: 'util', name: 'Utility', test: 'Smokes, die sitzen, von 10 Würfen', unit: 'Smokes', cur: 9, tgt: 8,
      drills: ['5 Smokes deiner Seite je 2-mal (sv_rethrow_last_grenade wiederholt den Wurf)',
               'Flashes für deinen Entry: Pop-Flash über die Wand, 10 Würfe',
               'Molotovs, mit denen du Standard-Ecken räumst, je 2-mal',
               'Retake-Utility der Gegenseite: 3 Smokes, 2 Molotovs'] },
    { id: 'dm', name: 'Deathmatch', test: 'Kills in 10 Minuten Deathmatch (Scoreboard)', unit: 'Kills', cur: 22, tgt: 30,
      drills: ['Deathmatch, nur Kopf: lieber ein Kill weniger als ein Körpertreffer',
               'Deathmatch nur mit Pistole',
               'Deathmatch mit festem Fokus: nach jedem Kill sofort counter-strafen',
               'Deathmatch, nur M4: Bursts statt voller Sprays'] }
  ];
  var ROLE = {
    entry:   { label: 'Entry-Rifler', f: { aim: 1.2, strafe: 1.2 } },
    awp:     { label: 'AWPer',        f: { aim: 1.3, spray: 0.6, strafe: 1.1 } },
    support: { label: 'Support',      f: { util: 1.4 } },
    lurker:  { label: 'Lurker',       f: { strafe: 1.2, util: 1.1 } },
    igl:     { label: 'IGL',          f: { util: 1.4, dm: 0.8 } }
  };
  var DAYSETS = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 0] };
  var DOW = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var WARM = ['Deathmatch oder Bot-Karte zum Aufwärmen: nur Kopfhöhe halten, ohne Messung'];
  var REVIEW = 'Demo: 3 verlorene Runden aus deinem letzten Match ansehen und je einen Fehler notieren';

  function num(v, d) { var x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : d; }
  function r5(x) { return Math.round(x / 5) * 5; }

  /* inp: {min, days, role, aim_c, aim_t, spray_c, ...} */
  function norm(inp) {
    inp = inp || {};
    var o = { min: Math.max(20, Math.min(240, Math.round(num(inp.min, 60)))), days: Math.round(num(inp.days, 5)), role: ROLE[inp.role] ? inp.role : 'entry', cur: {}, tgt: {} };
    if (!DAYSETS[o.days]) o.days = 5;
    SK.forEach(function (s) {
      o.cur[s.id] = Math.max(0, num(inp[s.id + '_c'], s.cur));
      o.tgt[s.id] = Math.max(1, num(inp[s.id + '_t'], s.tgt));
    });
    return o;
  }

  function split(blocks, w) {           /* largest remainder in 5-minute blocks */
    var ids = Object.keys(w), sum = 0, out = {};
    ids.forEach(function (k) { sum += w[k]; });
    if (sum <= 0) { ids.forEach(function (k) { out[k] = 0; }); return out; }
    var rest = [], used = 0;
    ids.forEach(function (k, i) { var q = blocks * w[k] / sum; out[k] = Math.floor(q); used += out[k]; rest.push({ k: k, r: q - out[k], i: i }); });
    rest.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    for (var j = 0; used < blocks; j++, used++) out[rest[j % rest.length].k] += 1;
    return out;
  }

  function plan(raw) {
    var o = norm(raw), M = o.min, f = ROLE[o.role].f;
    var warm = Math.max(5, r5(M * 0.1)), review = M >= 40 ? Math.max(5, r5(M * 0.08)) : 0;
    var R = M - warm - review, blocks = Math.floor(R / 5); warm += R - blocks * 5;
    var gaps = SK.map(function (s) {
      var c = o.cur[s.id], t = o.tgt[s.id], miss = Math.max(0, t - c);
      return { id: s.id, name: s.name, unit: s.unit, test: s.test, cur: c, tgt: t, miss: miss, gap: miss / t };
    });
    var w = {}, anyGap = gaps.some(function (g) { return g.gap > 0; });
    gaps.forEach(function (g) { w[g.id] = (anyGap ? g.gap : 1) * (f[g.id] || 1); });
    var b = split(blocks, w), per = {};
    SK.forEach(function (s) { per[s.id] = b[s.id] * 5; });
    var weekly = {}; SK.forEach(function (s) { weekly[s.id] = per[s.id] * o.days; });
    var focus = gaps.slice().sort(function (a, c) { return w[c.id] - w[a.id] || c.gap - a.gap; })[0];
    /* the same minutes split evenly across the 5 skills (a fixed routine) */
    var even = R / SK.length;
    var atTarget = gaps.filter(function (g) { return g.miss === 0; });
    var waste = Math.round(atTarget.length * even * o.days);
    var focusMore = Math.round((per[focus.id] - even) * o.days);
    var week = DAYSETS[o.days].map(function (dow, d) {
      var items = [{ id: 'warm', name: 'Aufwärmen', min: warm, drill: WARM[0] }];
      SK.forEach(function (s) { if (per[s.id] > 0) items.push({ id: s.id, name: s.name, min: per[s.id], drill: s.drills[d % s.drills.length], test: s.test }); });
      if (review) items.push({ id: 'review', name: 'Demo-Review', min: review, drill: REVIEW });
      return { dow: dow, day: DOW[dow], items: items };
    });
    return { inp: o, role: ROLE[o.role].label, min: M, days: o.days, warm: warm, review: review, train: blocks * 5, per: per, weekly: weekly,
      weekMin: M * o.days, monthH: Math.round(M * o.days * 52 / 12 / 60 * 10) / 10, gaps: gaps, focus: focus,
      even: even, atTarget: atTarget, waste: waste, focusMore: focusMore, week: week };
  }

  /* ---- Protokoll (Pro) ---- */
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isoWeek(s) {
    var d = parse(s); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    var w1 = new Date(d.getFullYear(), 0, 4);
    var wk = 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7);
    return d.getFullYear() + '-W' + ('0' + wk).slice(-2);
  }
  /* average of each test over the entries of the 7 days ending today */
  function recent(log, today, n) {
    n = n || 7; var t = parse(today), from = new Date(t); from.setDate(from.getDate() - (n - 1));
    var acc = {}, cnt = {};
    (log || []).forEach(function (e) {
      var d = parse(e.date); if (d < from || d > t) return;
      SK.forEach(function (s) { var v = e[s.id]; if (v === '' || v == null || !isFinite(+v)) return; acc[s.id] = (acc[s.id] || 0) + (+v); cnt[s.id] = (cnt[s.id] || 0) + 1; });
    });
    var out = {}; SK.forEach(function (s) { if (cnt[s.id]) out[s.id] = Math.round(acc[s.id] / cnt[s.id] * 10) / 10; });
    return { avg: out, n: cnt };
  }
  function adapt(raw, log, today) {
    var base = plan(raw), r = recent(log, today), x = {}, k;
    for (k in raw) x[k] = raw[k];
    SK.forEach(function (s) { if (r.avg[s.id] != null) x[s.id + '_c'] = r.avg[s.id]; });
    var p = plan(x), changes = [];
    SK.forEach(function (s) { var dlt = p.per[s.id] - base.per[s.id]; if (dlt) changes.push({ id: s.id, name: s.name, from: base.per[s.id], to: p.per[s.id], delta: dlt }); });
    p.base = base; p.changes = changes; p.recent = r;
    return p;
  }
  function weeks(log, tgt) {
    var by = {};
    (log || []).forEach(function (e) {
      var k = isoWeek(e.date); by[k] = by[k] || {};
      SK.forEach(function (s) { var v = e[s.id]; if (v === '' || v == null || !isFinite(+v)) return; var b = by[k][s.id] = by[k][s.id] || [0, 0]; b[0] += +v; b[1]++; });
    });
    return Object.keys(by).sort().map(function (k) {
      var row = { week: k };
      SK.forEach(function (s) { var b = by[k][s.id]; row[s.id] = b ? Math.round(b[0] / b[1] / (tgt[s.id] || s.tgt) * 100) : null; });
      return row;
    });
  }
  function streak(log, today) {
    var have = {}; (log || []).forEach(function (e) { have[e.date] = 1; });
    var d = parse(today), n = 0; if (!have[ymd(d)]) d.setDate(d.getDate() - 1);
    while (have[ymd(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function csv(log) {
    var h = ['Datum'].concat(SK.map(function (s) { return s.name + ' (' + s.unit + ')'; })).concat(['Notiz']);
    var q = function (v) { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [h.join(';')].concat((log || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (e) {
      return [e.date].concat(SK.map(function (s) { return e[s.id] == null ? '' : String(e[s.id]).replace('.', ','); })).concat([e.note || '']).map(q).join(';');
    })).join('\r\n') + '\r\n';
  }
  function ics(p, time, startYmd) {
    var hm = String(time || '18:00').split(':'), by = DAYSETS[p.days].map(function (d) { return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d]; }).join(',');
    var st = startYmd.replace(/-/g, '') + 'T' + ('0' + (+hm[0] || 0)).slice(-2) + ('0' + (+hm[1] || 0)).slice(-2) + '00';
    var end = new Date(parse(startYmd)); end.setHours(+hm[0] || 0, (+hm[1] || 0) + p.min, 0);
    var en = ymd(end).replace(/-/g, '') + 'T' + ('0' + end.getHours()).slice(-2) + ('0' + end.getMinutes()).slice(-2) + '00';
    var desc = p.week[0].items.map(function (i) { return i.min + ' min ' + i.name; }).join(', ');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rulestamp//cs2-training-routine//DE', 'BEGIN:VEVENT',
      'UID:cs2-routine-' + st + '@getreadystack.com', 'DTSTAMP:' + st, 'DTSTART:' + st, 'DTEND:' + en, 'RRULE:FREQ=WEEKLY;BYDAY=' + by,
      'SUMMARY:CS2 Training Routine (' + p.min + ' min)', 'DESCRIPTION:' + desc.replace(/,/g, '\\,'),
      'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:CS2 Training', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }
  function raise(tgt, gaps) {          /* reached targets go up by 10 % (at least +1) */
    var t = {}, k; for (k in tgt) t[k] = tgt[k];
    gaps.forEach(function (g) { if (g.miss === 0) t[g.id] = Math.max(g.tgt + 1, Math.round(g.tgt * 1.1)); });
    return t;
  }
  var API = { SK: SK, ROLE: ROLE, DAYSETS: DAYSETS, plan: plan, adapt: adapt, recent: recent, weeks: weeks, isoWeek: isoWeek, streak: streak, csv: csv, ics: ics, raise: raise, ymd: ymd };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CSR = API;
})(this);
