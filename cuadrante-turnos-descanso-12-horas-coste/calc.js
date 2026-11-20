/* cuadrante turnos — motor de cálculo (sin DOM). Reglas: ET arts. 6, 12, 34, 36, 37 · RD 126/2026 (SMI) · LISOS 7.5 / 40.1.b. */
(function (root) {
  'use strict';
  var DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var DAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  var LAW = {
    smiYear: 17094,            // RD 126/2026 art. 1: 1.221 €/mes × 14 pagas
    smiMonth: 1221,
    vacationDays: 30,          // ET 38.1: nunca menos de 30 días naturales
    holidays: 14,              // ET 37.2: hasta 14 fiestas laborales al año
    weekHours: 40,             // ET 34.1
    restBetween: 12,           // ET 34.3
    maxDay: 9, maxDayMinor: 8, // ET 34.3
    pauseAfter: 6, pauseAfterMinor: 4.5, pauseMin: 15, pauseMinMinor: 30, // ET 34.4
    weeklyRest: 36, weeklyRestMinor: 48, // ET 37.1
    fineMin: 751, fineMax: 7500 // LISOS 7.5 (grave) → 40.1.b
  };
  // horas de trabajo efectivo al año a 40 h con 30 días de vacaciones y 14 festivos: (365 − 30) ÷ 7 × 40 − 14 × 8
  function annualHours() { return (365 - LAW.vacationDays) / 7 * LAW.weekHours - LAW.holidays * 8; }
  function smiHour(hours) { var h = num(hours) > 0 ? num(hours) : annualHours(); return LAW.smiYear / h; }

  function num(v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).trim().replace(/[€\s%h]/g, '');
    if (!s) return NaN;
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else s = s.replace(/,/g, '');
    return parseFloat(s);
  }
  function fix2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
  function dec(x, d) {
    d = d == null ? 2 : d;
    if (!isFinite(x)) return '—';
    var neg = x < 0, p = (Math.round(Math.abs(x) * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + p[0] + (d ? ',' + p[1] : '');
  }
  function eur(x) { return dec(x, 2) + ' €'; }
  function hrs(min) { var h = Math.floor(Math.abs(min) / 60), m = Math.round(Math.abs(min) % 60); return (min < 0 ? '−' : '') + (h ? h + (m ? ' h ' + (m < 10 ? '0' : '') + m : ' h') : m + ' min'); }
  function hdec(min) { return dec(min / 60, (min % 60) ? 2 : 0) + ' h'; }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), n = m % 60; return (h < 10 ? '0' : '') + h + ':' + (n < 10 ? '0' : '') + n; }

  function parseTime(s) {
    var m = /^(\d{1,2})(?:[:.h](\d{2}))?$/.exec(String(s).trim());
    if (!m) return null;
    var h = +m[1], n = m[2] ? +m[2] : 0;
    if (h > 24 || n > 59) return null;
    return h * 60 + n;
  }
  var OFF = /^(|-|–|—|l|libre|descanso|d|x|v|vac|vacaciones|b|baja|f|fiesta|festivo)$/i;
  // celda: "8-16" · "08:00-16:00" · "10-14/18-22" (partida) · "22-6" (noche) · "9-17 p15" (pausa marcada) · "L" libre
  function parseCell(cell) {
    var raw = String(cell == null ? '' : cell).trim();
    var res = { raw: raw, off: true, tramos: [], pause: 0, label: '', bad: false };
    if (OFF.test(raw)) { res.label = raw ? raw.toUpperCase().slice(0, 3) : ''; return res; }
    var pm = /\bp\s*(\d{1,3})\b/i.exec(raw);
    if (pm) res.pause = +pm[1];
    var body = raw.replace(/\bp\s*\d{1,3}\b/i, '').trim();
    var parts = body.split(/\s*[\/+;y]\s*|\s{2,}/).filter(Boolean);
    var prevEnd = -1;
    parts.forEach(function (p) {
      var m = /^(\d{1,2}(?:[:.h]\d{2})?)\s*[-–a]\s*(\d{1,2}(?:[:.h]\d{2})?)$/.exec(p.replace(/\s+/g, ' ').replace(/ a /, '-'));
      if (!m) { res.bad = true; return; }
      var a = parseTime(m[1]), b = parseTime(m[2]);
      if (a == null || b == null || a === b) { res.bad = true; return; }
      if (a < prevEnd) a += 1440;
      while (b <= a) b += 1440;
      res.tramos.push([a, b]);
      prevEnd = b;
    });
    if (res.tramos.length) res.off = false;
    return res;
  }

  function splitLine(line) {
    if (line.indexOf('\t') >= 0) return line.split('\t');
    if (line.indexOf(';') >= 0) return line.split(';');
    if (line.indexOf('|') >= 0) return line.split('|');
    return line.split(/\s*,\s*(?![^()]*\))/);
  }
  // Pegado: Nombre · horas de contrato/semana · €/h · Lun … Dom. La fila «Necesarias» da el mínimo de personas por día.
  function parseGrid(text) {
    var staff = [], need = null;
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var c = splitLine(line).map(function (x) { return x.trim(); });
      if (/^nombre$|^empleado|^persona|^trabajador/i.test(c[0]) && !/\d/.test(c[1] || '')) return;
      if (/^necesari|^m[ií]nimo|^cobertura/i.test(c[0])) { need = c.slice(c.length - 7).map(function (x) { var n = num(x); return isFinite(n) ? n : 0; }); return; }
      if (c.length < 10) {
        if (c.length < 8) return;
        while (c.length < 10) c.splice(1, 0, '');
      }
      var name = c[0].replace(/\s*\(menor\)|\*$/i, '').trim();
      var minor = /\(menor\)|\*$/i.test(c[0]);
      staff.push({ name: name || 'Persona ' + (staff.length + 1), minor: minor, contract: num(c[1]), rate: num(c[2]), cells: c.slice(3, 10).map(parseCell) });
    });
    return { staff: staff, need: need };
  }

  function nightMin(a, b) { // minutos entre 22:00 y 06:00
    var tot = 0;
    for (var d = Math.floor(a / 1440) - 1; d <= Math.floor(b / 1440) + 1; d++) {
      var s = d * 1440 + 22 * 60, e = d * 1440 + 30 * 60;
      tot += Math.max(0, Math.min(b, e) - Math.max(a, s));
    }
    return tot;
  }

  function analyze(grid, o) {
    o = o || {};
    var restMin = (num(o.rest) > 0 ? num(o.rest) : LAW.restBetween) * 60;
    var maxDay = num(o.maxDay) > 0 ? num(o.maxDay) : LAW.maxDay;
    var floor = num(o.smiHour) > 0 ? num(o.smiHour) : smiHour(o.annualHours);
    var prev = o.prevEnd || {}; // fin del último turno de la semana anterior (minutos relativos al lunes 00:00, negativos)
    var issues = [], people = [], dayCount = [0, 0, 0, 0, 0, 0, 0], dayHours = [0, 0, 0, 0, 0, 0, 0];
    var T = { minutes: 0, cost: 0, night: 0, rest: 0, day: 0, weekly: 0, pause: 0, extra: 0, smi: 0, minor: 0, cover: 0, bad: 0 };
    grid.staff.forEach(function (p) {
      var w = { name: p.name, minor: p.minor, contract: p.contract, rate: p.rate, minutes: 0, night: 0, days: [], issues: [], shortRest: [], maxGap: 0 };
      var lim = p.minor ? LAW.maxDayMinor : maxDay;
      var pauseAfter = (p.minor ? LAW.pauseAfterMinor : LAW.pauseAfter) * 60, pauseNeed = p.minor ? LAW.pauseMinMinor : LAW.pauseMin;
      var jornadas = [];
      p.cells.forEach(function (c, d) {
        var day = { off: c.off, label: c.label, raw: c.raw, minutes: 0, flags: [] };
        if (c.bad) { add('bad', 'No entiendo «' + c.raw + '» el ' + DAYS_LONG[d] + '. Escribe 8-16, 10-14/18-22 o L.', d); T.bad++; }
        if (!c.off) {
          var s = d * 1440 + c.tramos[0][0], e = d * 1440 + c.tramos[c.tramos.length - 1][1], m = 0, n = 0;
          c.tramos.forEach(function (t) {
            var len = t[1] - t[0];
            m += len; n += nightMin(d * 1440 + t[0], d * 1440 + t[1]);
            if (len > pauseAfter && c.pause < pauseNeed) {
              add('pause', DAYS_LONG[d] + ' ' + hhmm(t[0]) + '–' + hhmm(t[1]) + ': ' + hrs(len) + ' seguidas sin pausa de ' + pauseNeed + ' min marcada (ET 34.4). Escribe «p' + pauseNeed + '» en la celda si ya la tiene.', d);
              day.flags.push('pause');
            }
          });
          day.minutes = m; day.start = s; day.end = e; day.night = n;
          w.minutes += m; w.night += n; dayCount[d]++; dayHours[d] += m;
          if (m > lim * 60) { add('day', DAYS_LONG[d] + ': ' + hrs(m) + ' de trabajo, más de ' + lim + ' h ordinarias al día' + (p.minor ? ' para un menor (ET 34.3)' : ' (ET 34.3, salvo otra distribución en tu convenio)') + '.', d); day.flags.push('day'); }
          if (p.minor && n > 0) { add('minor', DAYS_LONG[d] + ': ' + hrs(n) + ' entre las 22:00 y las 06:00. Un menor de 18 no puede hacer trabajo nocturno (ET 6.2).', d); day.flags.push('minor'); }
          jornadas.push({ d: d, s: s, e: e });
        }
        w.days.push(day);
      });
      // descanso entre jornadas (ET 34.3)
      var lastEnd = isFinite(prev[p.name]) ? prev[p.name] : null;
      if (lastEnd != null && jornadas.length) {
        var g0 = jornadas[0].s - lastEnd;
        if (g0 < restMin) { w.shortRest.push({ from: -1, to: jornadas[0].d, gap: g0 }); add('rest', 'De la semana anterior al ' + DAYS_LONG[jornadas[0].d] + ': ' + hrs(g0) + ' de descanso, faltan ' + hrs(restMin - g0) + ' para las ' + (restMin / 60) + ' h (ET 34.3).', jornadas[0].d); w.days[jornadas[0].d].flags.push('rest'); }
      }
      for (var i = 1; i < jornadas.length; i++) {
        var a = jornadas[i - 1], b = jornadas[i], gap = b.s - a.e;
        if (gap < restMin) {
          w.shortRest.push({ from: a.d, to: b.d, gap: gap });
          add('rest', DAYS_LONG[a.d] + ' sale a las ' + hhmm(a.e) + ' y el ' + DAYS_LONG[b.d] + ' entra a las ' + hhmm(b.s) + ': ' + hrs(gap) + ' de descanso, faltan ' + hrs(restMin - gap) + ' para las ' + (restMin / 60) + ' h (ET 34.3).', b.d);
          w.days[b.d].flags.push('rest');
        }
      }
      // descanso semanal (ET 37.1): el hueco libre más largo de la semana
      var edges = [lastEnd != null ? Math.max(lastEnd, -7 * 1440) : 0].concat([]), cur = edges[0], best = 0;
      jornadas.forEach(function (j) { best = Math.max(best, j.s - cur); cur = Math.max(cur, j.e); });
      best = Math.max(best, 7 * 1440 - cur);
      w.maxGap = best;
      var needWeekly = (p.minor ? LAW.weeklyRestMinor : LAW.weeklyRest) * 60;
      if (best < needWeekly) add('weekly', 'Ningún descanso de ' + (needWeekly / 60) + ' h seguidas esta semana (el más largo: ' + hrs(best) + '). Solo vale si lo acumulas dentro de 14 días (ET 37.1).', -1);
      // horas frente al contrato
      var c = isFinite(p.contract) ? p.contract * 60 : NaN;
      w.diff = isFinite(c) ? w.minutes - c : NaN;
      if (isFinite(c) && w.minutes > c + 0.5) {
        if (p.minor) add('extra', hrs(w.minutes - c) + ' por encima de su contrato de ' + dec(p.contract, p.contract % 1 ? 1 : 0) + ' h: un menor no puede hacer horas extra (ET 6.3).', -1);
        else if (p.contract < LAW.weekHours) add('extra', hrs(w.minutes - c) + ' por encima de su contrato a tiempo parcial de ' + dec(p.contract, p.contract % 1 ? 1 : 0) + ' h: solo como horas complementarias con pacto escrito (ET 12.5); a tiempo parcial no caben horas extra (ET 12.4.c).', -1);
        else add('extra', hrs(w.minutes - c) + ' por encima de sus ' + dec(p.contract, p.contract % 1 ? 1 : 0) + ' h: horas extraordinarias, máximo 80 al año salvo las compensadas con descanso (ET 35.2).', -1);
      }
      // coste y SMI
      w.cost = isFinite(p.rate) ? p.rate * w.minutes / 60 : 0;
      if (isFinite(p.rate) && p.rate > 0 && p.rate + 1e-9 < floor) add('smi', dec(p.rate) + ' €/h está por debajo del SMI 2026 por hora trabajada (' + dec(floor) + ' €/h): faltan ' + eur((floor - p.rate) * w.minutes / 60) + ' esta semana.', -1);
      T.minutes += w.minutes; T.cost += w.cost; T.night += w.night;
      people.push(w);
      function add(type, text, d) { var it = { type: type, who: p.name, text: text, day: d }; w.issues.push(it); issues.push(it); T[type] = (T[type] || 0) + 1; }
    });
    var cover = [];
    if (grid.need) grid.need.forEach(function (n, d) {
      if (n > dayCount[d]) { cover.push({ day: d, need: n, have: dayCount[d] }); issues.push({ type: 'cover', who: '', day: d, text: DAYS_LONG[d] + ': ' + dayCount[d] + ' personas de ' + n + ' necesarias.' }); T.cover++; }
    });
    var legal = T.rest + T.day + T.weekly + T.extra + T.smi + T.minor;
    return {
      people: people, issues: issues, cover: cover, dayCount: dayCount, dayHours: dayHours, need: grid.need,
      totals: { minutes: T.minutes, cost: T.cost, night: T.night, rest: T.rest, day: T.day, weekly: T.weekly, pause: T.pause, extra: T.extra, smi: T.smi, minor: T.minor, cover: T.cover, bad: T.bad, legal: legal, smiHour: floor, fineMin: LAW.fineMin, fineMax: LAW.fineMax }
    };
  }

  // fin del último turno de la semana (para encadenar con la siguiente): minutos relativos al lunes siguiente
  function weekEnds(res) {
    var out = {};
    res.people.forEach(function (w) {
      var last = null;
      w.days.forEach(function (d) { if (!d.off) last = d.end; });
      if (last != null) out[w.name] = last - 7 * 1440;
    });
    return out;
  }

  function addDays(iso, n) { var t = Date.parse(iso + 'T00:00:00Z'); if (!isFinite(t)) return ''; return new Date(t + n * 864e5).toISOString().slice(0, 10); }
  function monday(iso) { var t = Date.parse(iso + 'T00:00:00Z'); if (!isFinite(t)) return ''; var wd = (new Date(t).getUTCDay() + 6) % 7; return addDays(iso, -wd); }
  function fmtDate(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }

  function csvCell(s) { s = String(s == null ? '' : s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  // CSV del cuadrante: una fila por persona y día (para la gestoría o el registro de jornada previsto)
  function toCSV(res, weekStart) {
    var L = [['Fecha', 'Día', 'Persona', 'Entrada prevista', 'Salida prevista', 'Tramos', 'Horas', 'Horas nocturnas', 'Coste bruto (€)', 'Avisos'].join(';')];
    res.people.forEach(function (w) {
      w.days.forEach(function (d, i) {
        var date = weekStart ? addDays(weekStart, i) : '';
        var aw = w.issues.filter(function (x) { return x.day === i; }).map(function (x) { return x.type; }).join(' ');
        L.push([date, DAYS[i], w.name, d.off ? (d.label || 'L') : hhmm(d.start), d.off ? '' : hhmm(d.end), d.raw, d.off ? '0' : fix2(d.minutes / 60).replace('.', ','), d.off ? '0' : fix2(d.night / 60).replace('.', ','), d.off || !isFinite(w.rate) ? '0' : fix2(w.rate * d.minutes / 60).replace('.', ','), aw].map(csvCell).join(';'));
      });
    });
    return '﻿' + L.join('\r\n') + '\r\n';
  }
  // hoja de registro de jornada (art. 34.9 ET): previsto + huecos para la hora real y la firma
  function registroRows(res, weekStart, who) {
    var rows = [];
    res.people.forEach(function (w) {
      if (who && w.name !== who) return;
      w.days.forEach(function (d, i) {
        rows.push({ name: w.name, date: weekStart ? fmtDate(addDays(weekStart, i)) : DAYS[i], day: DAYS_LONG[i], plan: d.off ? (d.label || 'Libre') : d.raw.replace(/\s*p\s*\d+/i, ''), hours: d.off ? '' : hdec(d.minutes) });
      });
    });
    return rows;
  }
  function registroCSV(res, weekStart) {
    var L = [['Persona', 'Fecha', 'Día', 'Horario previsto', 'Horas previstas', 'Entrada real', 'Salida real', 'Firma'].join(';')];
    registroRows(res, weekStart).forEach(function (r) { L.push([r.name, r.date, r.day, r.plan, r.hours, '', '', ''].map(csvCell).join(';')); });
    return '﻿' + L.join('\r\n') + '\r\n';
  }
  function icsStamp(iso, min) { var t = Date.parse(iso + 'T00:00:00') + min * 60000; var d = new Date(t); function z(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + 'T' + z(d.getHours()) + z(d.getMinutes()) + '00'; }
  // .ics con los turnos de una persona (hora local)
  function ics(res, weekStart, who) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//cuadrante turnos//ES', 'CALSCALE:GREGORIAN'];
    res.people.forEach(function (w) {
      if (who && w.name !== who) return;
      w.days.forEach(function (d, i) {
        if (d.off) return;
        var parsed = parseCell(d.raw);
        parsed.tramos.forEach(function (t, k) {
          L.push('BEGIN:VEVENT', 'UID:' + (weekStart + '-' + w.name + '-' + i + '-' + k).replace(/[^\w-]/g, '') + '@cuadrante-turnos', 'DTSTAMP:' + icsStamp(weekStart, 0),
            'DTSTART:' + icsStamp(addDays(weekStart, i), t[0]), 'DTEND:' + icsStamp(addDays(weekStart, i), t[1]), 'SUMMARY:Turno ' + w.name + ' ' + hhmm(t[0]) + '-' + hhmm(t[1]), 'END:VEVENT');
        });
      });
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }
  // varias semanas guardadas: horas, coste y avisos por persona; descanso semanal en 14 días (ET 37.1)
  function summary(weeks) {
    var by = {};
    weeks.slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; }).forEach(function (wk) {
      wk.res.people.forEach(function (w) {
        var x = by[w.name] = by[w.name] || { name: w.name, weeks: 0, minutes: 0, cost: 0, night: 0, issues: 0, gaps: [] };
        x.weeks++; x.minutes += w.minutes; x.cost += w.cost; x.night += w.night; x.issues += w.issues.length; x.gaps.push(w.maxGap);
      });
    });
    return Object.keys(by).map(function (k) {
      var x = by[k], alert = '';
      for (var i = 1; i < x.gaps.length; i++) if (x.gaps[i - 1] < 36 * 60 && x.gaps[i] < 36 * 60) alert = '2 semanas seguidas sin día y medio libre: comprueba los 3 días de descanso de esos 14 días (ET 37.1)';
      x.alert = alert; return x;
    });
  }

  var api = { LAW: LAW, DAYS: DAYS, DAYS_LONG: DAYS_LONG, num: num, dec: dec, eur: eur, hrs: hrs, hdec: hdec, hhmm: hhmm, parseCell: parseCell, parseGrid: parseGrid, analyze: analyze, annualHours: annualHours, smiHour: smiHour, weekEnds: weekEnds, addDays: addDays, monday: monday, fmtDate: fmtDate, toCSV: toCSV, registroRows: registroRows, registroCSV: registroCSV, ics: ics, summary: summary, nightMin: nightMin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CT = api;
})(this);
