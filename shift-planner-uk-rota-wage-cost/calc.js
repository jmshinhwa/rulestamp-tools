/* shift planner — UK weekly rota maths. No DOM here (tested with node). Rates and rules read on gov.uk on 20 Nov 2026. */
(function (root) {
  'use strict';
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // gov.uk/national-minimum-wage-rates (read 2026-11-20). Band keys: a21 = 21 and over, a18 = 18 to 20, u18 = under 18, app = apprentice rate.
  var RATES = [
    { from: '2026-04-01', label: 'April 2026', a21: 12.71, a18: 10.85, u18: 8.00, app: 8.00 },
    { from: '2027-04-01', label: 'April 2027', a21: 13.21, a18: 11.27, u18: 8.31, app: 8.31 }
  ];
  var BAND_NAME = { a21: '21 and over', a18: '18 to 20', u18: 'under 18', app: 'apprentice' };
  var NI = { rate: 0.15, st: 96, uel: 967 }; // employer Class 1, 2026/27, per week
  var OFF = /^(|-|–|—|x|o|off|rest|day off|hol|holiday|h|al|annual leave|sick|s)$/i;

  function num(s) {
    if (typeof s === 'number') return s;
    var t = String(s == null ? '' : s).replace(/[£$€\s]/g, '').replace(/,/g, '');
    if (t === '') return NaN;
    return Number(t);
  }
  function r2(x) { return Math.round(x * 100 + (x >= 0 ? 1e-9 : -1e-9)) / 100; }
  function money(x) {
    var neg = x < 0, v = Math.abs(r2(x)).toFixed(2).split('.');
    return (neg ? '−' : '') + '£' + v[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + v[1];
  }
  function hdec(min) { var h = Math.round(min / 60 * 100) / 100; return String(h) + ' h'; }
  function hm(min) { var h = Math.floor(min / 60), m = Math.round(min - h * 60); return h + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m : ''); }
  function clock(absMin) { var m = ((absMin % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
  function dayOf(absMin) { return DAYS[((Math.floor(absMin / 1440) % 7) + 7) % 7]; }
  function when(absMin) { return dayOf(absMin) + ' ' + clock(absMin); }

  // dates as ISO yyyy-mm-dd, computed in UTC so no timezone drift
  function d2s(d) { return d.toISOString().slice(0, 10); }
  function s2d(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  function addDays(s, n) { var d = s2d(s); if (!d) return s; d.setUTCDate(d.getUTCDate() + n); return d2s(d); }
  function monday(s) { var d = s2d(s); if (!d) return null; var wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return d2s(d); }
  function fmtDate(s) { var d = s2d(s); return d ? d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : String(s); }
  function shortDate(s) { var d = s2d(s); return d ? d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] : ''; }

  function rateSet(dateIso) { var r = RATES[0]; RATES.forEach(function (x) { if (dateIso >= x.from) r = x; }); return r; }
  function nextRateSet(dateIso) { for (var i = 0; i < RATES.length; i++) if (RATES[i].from > dateIso) return RATES[i]; return null; }

  // "9", "9:30", "09:00", "0930", "9.30", "9am", "5pm"
  function tmin(t) {
    var s = String(t).trim().toLowerCase(), pm = /pm$/.test(s), am = /am$/.test(s);
    s = s.replace(/(am|pm)$/, '');
    var m = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/.exec(s);
    if (!m) return NaN;
    var h = +m[1], mi = m[2] ? +m[2] : 0;
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    if (h > 24 || mi > 59) return NaN;
    return h * 60 + mi;
  }
  // one cell: "9-17", "09:00-17:30 b30", "10-14/18-22", "22-6", "off", "hol", "sick"
  function parseCell(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (OFF.test(s)) return { off: true, label: s ? s.toLowerCase() : 'off', segs: [], brk: 0 };
    var brk = 0;
    s = s.replace(/\bb(?:reak)?\s*(\d{1,3})\b/i, function (_, n) { brk = +n; return ''; }).trim();
    var parts = s.split(/[\/+&]| and /), segs = [];
    for (var i = 0; i < parts.length; i++) {
      var m = /^\s*([0-9:.apm]+)\s*(?:-|–|—|to)\s*([0-9:.apm]+)\s*$/i.exec(parts[i]);
      if (!m) return { bad: true, raw: raw, segs: [], brk: 0 };
      var a = tmin(m[1]), b = tmin(m[2]);
      if (!isFinite(a) || !isFinite(b)) return { bad: true, raw: raw, segs: [], brk: 0 };
      if (b <= a) b += 1440; // overnight
      if (segs.length && a < segs[segs.length - 1][1] - 1440 * 0) {
        if (a < segs[segs.length - 1][0]) { a += 1440; b += 1440; }
      }
      segs.push([a, b]);
    }
    return { off: false, segs: segs, brk: brk };
  }

  function splitRow(line) {
    if (line.indexOf('\t') >= 0) return line.split('\t');
    if (line.indexOf('|') >= 0) return line.split('|');
    if (line.indexOf(';') >= 0) return line.split(';');
    if (line.indexOf(',') >= 0) return line.split(',');
    return line.trim().split(/\s{2,}/);
  }
  function ageBand(ageCell, name) {
    var s = String(ageCell || '').trim().toLowerCase();
    if (/app/.test(s) || /\(apprentice\)/i.test(name)) return { band: 'app', age: num(s.replace(/[^0-9]/g, '')) };
    var a = num(s.replace(/\+/g, ''));
    if (!isFinite(a)) return { band: 'a21', age: NaN, guessed: true };
    return { band: a >= 21 ? 'a21' : a >= 18 ? 'a18' : 'u18', age: a };
  }
  // Rows: Name | Age | £ per hour | Mon … Sun. A "Needed" row gives the people you need each day.
  function parseGrid(text) {
    var staff = [], need = null;
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var c = splitRow(line).map(function (x) { return x.trim(); });
      var first = (c[0] || '').toLowerCase();
      if (first === 'name' || first === 'staff' || first === 'employee') return;
      if (/^need/.test(first)) { need = c.slice(3, 10).map(function (x) { var n = num(x); return isFinite(n) ? n : 0; }); return; }
      var cells = c.slice(3, 10); while (cells.length < 7) cells.push('');
      staff.push({ name: c[0], age: c[1] || '', rate: c[2] || '', cells: cells });
    });
    return { staff: staff, need: need };
  }

  function analyze(grid, o) {
    o = o || {};
    var week = monday(o.week) || o.week || '2026-11-23';
    var restMin = (isFinite(num(o.rest)) ? num(o.rest) : 11) * 60;
    var holPct = isFinite(num(o.holidayPct)) ? num(o.holidayPct) : 0;
    var rs = rateSet(week), nx = nextRateSet(week);
    var issues = [], people = [], dayCount = [0, 0, 0, 0, 0, 0, 0];
    var T = { minutes: 0, pay: 0, holiday: 0, ni: 0, cost: 0, legal: 0, rest: 0, brk: 0, weekly: 0, young: 0, nmw: 0, arrears: 0, over48: 0, cover: 0, bad: 0, futureCost: 0, futureBelow: 0 };
    function add(type, who, text, extra) { var i = { type: type, who: who, text: text }; for (var k in extra || {}) i[k] = extra[k]; issues.push(i); return i; }

    grid.staff.forEach(function (p) {
      var ab = ageBand(p.age, p.name), young = ab.band === 'u18';
      var rate = num(p.rate), w = { name: p.name.replace(/\s*\(apprentice\)/i, ''), band: ab.band, age: ab.age, young: young, rate: rate, days: [], minutes: 0 };
      var shifts = []; // [start, end, dayIndex] absolute minutes from Monday 00:00
      p.cells.forEach(function (raw, d) {
        var c = parseCell(raw), day = { raw: String(raw || '').trim(), off: !!c.off, label: c.label, flags: [], minutes: 0, segs: [] };
        if (c.bad) { day.off = true; day.label = '?'; day.flags.push('bad'); add('bad', w.name, DAYS[d] + ': "' + raw + '" is not a shift I can read (write 9-17, 10-14/18-22, 22-6 or off).'); T.bad++; }
        else if (!c.off) {
          var span = 0, longest = 0;
          c.segs.forEach(function (s) { var a = d * 1440 + s[0], b = d * 1440 + s[1]; day.segs.push([a, b]); shifts.push([a, b, d]); span += b - a; longest = Math.max(longest, b - a); });
          day.brk = c.brk;
          day.minutes = Math.max(0, span - c.brk);
          dayCount[d]++;
          // rest break at work: 20 min if the working day is over 6 h (young: 30 min over 4.5 h). A gap of 20+ min between split parts counts as the break.
          var limit = young ? 270 : 360, needBrk = young ? 30 : 20;
          var gapOk = false; for (var g = 1; g < c.segs.length; g++) if (c.segs[g][0] - c.segs[g - 1][1] >= needBrk) gapOk = true;
          if (span > limit && c.brk < needBrk && !(gapOk && longest <= limit)) {
            day.flags.push('brk'); T.brk++;
            add('brk', w.name, DAYS[d] + ' ' + clock(d * 1440 + c.segs[0][0]) + '–' + clock(d * 1440 + c.segs[c.segs.length - 1][1]) + ' is ' + hm(span) + ' with ' + (c.brk ? 'a ' + c.brk + ' min break' : 'no break') + ': over ' + (young ? '4.5' : '6') + ' h needs an uninterrupted ' + needBrk + ' min break.');
          }
          if (young && day.minutes > 480) { day.flags.push('young'); T.young++; add('young', w.name, DAYS[d] + ': ' + hm(day.minutes) + ' of work. Under 18 the limit is 8 h a day.'); }
        }
        w.days.push(day);
        w.minutes += day.minutes;
      });
      // daily rest between working days (11 h; under 18: 12 h). Chained weeks pass last week's end.
      shifts.sort(function (a, b) { return a[0] - b[0]; });
      var needRest = young ? Math.max(restMin, 720) : restMin;
      var prevEnd = o.prevEnd && isFinite(o.prevEnd[w.name]) ? o.prevEnd[w.name] : null;
      var lastEnd = prevEnd, lastDay = prevEnd != null ? -1 : null, longestRest = 0, cursor = prevEnd != null ? prevEnd : 0;
      shifts.forEach(function (s) {
        if (lastEnd != null && s[2] !== lastDay) {
          var gap = s[0] - lastEnd;
          if (gap < needRest) {
            w.days[s[2]].flags.unshift('rest'); T.rest++;
            add('rest', w.name, 'finishes ' + when(lastEnd) + (lastDay === -1 ? ' (last week)' : '') + ' and starts ' + when(s[0]) + ': ' + hm(gap) + ' off, ' + hm(needRest - gap) + ' short of ' + needRest / 60 + ' h daily rest.', { gap: gap, short: needRest - gap });
          }
        }
        longestRest = Math.max(longestRest, s[0] - cursor);
        cursor = Math.max(cursor, s[1]);
        if (lastEnd == null || s[1] > lastEnd) lastEnd = s[1];
        lastDay = s[2];
      });
      if (shifts.length) longestRest = Math.max(longestRest, 7 * 1440 - cursor); else longestRest = 7 * 1440;
      w.longestRest = longestRest;
      w.lastEnd = shifts.length ? shifts[shifts.length - 1][1] : null;
      var weekNeed = young ? 2880 : 1440;
      if (longestRest < weekNeed) {
        T.weekly++;
        add('weekly', w.name, 'longest time off this week is ' + hm(longestRest) + (young ? '. Under 18 needs 48 h off each week.' : '. The rule is 24 h off each week, or 48 h over two weeks.'), { longest: longestRest });
      }
      if (young && w.minutes > 2400) { T.young++; add('young', w.name, hm(w.minutes) + ' this week. Under 18 the limit is 40 h a week (no averaging).'); }
      if (!young && w.minutes > 2880) { T.over48++; add('over48', w.name, hm(w.minutes) + ' this week. Over 48 h is allowed only if the 17-week average stays at 48 h or less, or they opted out in writing.'); }
      // minimum wage for the band on the week's date
      w.min = rs[ab.band];
      var hrs = w.minutes / 60;
      w.pay = isFinite(rate) ? r2(hrs * rate) : 0;
      if (!isFinite(rate)) add('bad', w.name, 'no £ per hour, so no pay or minimum wage check.');
      else if (rate < w.min - 1e-9) {
        w.arrears = r2((w.min - rate) * hrs);
        T.nmw++; T.arrears += w.arrears;
        add('nmw', w.name, money(rate) + '/h is below the ' + rs.label + ' minimum of ' + money(w.min) + ' (' + BAND_NAME[ab.band] + '): (' + money(w.min) + ' − ' + money(rate) + ') × ' + hdec(w.minutes) + ' = ' + money(w.arrears) + ' owed for this week.', { arrears: w.arrears });
      }
      if (nx && isFinite(rate) && rate < nx[ab.band] - 1e-9) {
        w.future = r2((nx[ab.band] - rate) * hrs);
        w.futureMin = nx[ab.band];
        T.futureBelow++; T.futureCost += w.future;
      }
      w.holiday = r2(w.pay * holPct / 100);
      var earn = w.pay + w.holiday;
      w.ni = 0;
      if (o.ni) {
        if (ab.band === 'a21') w.ni = r2(Math.max(0, earn - NI.st) * NI.rate);
        else w.ni = r2(Math.max(0, earn - NI.uel) * NI.rate); // under 21 and apprentices under 25: 0% up to the UEL
      }
      w.cost = r2(w.pay + w.holiday + w.ni);
      T.minutes += w.minutes; T.pay += w.pay; T.holiday += w.holiday; T.ni += w.ni; T.cost += w.cost;
      people.push(w);
    });
    if (grid.need) grid.need.forEach(function (n, d) {
      if (n > dayCount[d]) { T.cover++; add('cover', '', DAYS[d] + ' ' + shortDate(addDays(week, d)) + ': ' + dayCount[d] + ' on the rota, ' + n + ' needed.'); }
    });
    ['pay', 'holiday', 'ni', 'cost', 'arrears', 'futureCost'].forEach(function (k) { T[k] = r2(T[k]); });
    T.legal = T.rest + T.brk + T.weekly + T.young + T.nmw;
    T.minRates = rs; T.nextRates = nx;
    return { week: week, people: people, issues: issues, totals: T, dayCount: dayCount, need: grid.need };
  }

  // end of each person's last shift, relative to the NEXT week's Monday 00:00 (negative), for chaining weeks
  function weekEnds(res) { var m = {}; res.people.forEach(function (w) { if (w.lastEnd != null) m[w.name] = w.lastEnd - 7 * 1440; }); return m; }

  function csvCell(v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  // payroll CSV: one row per shift + one total row per person
  function toCSV(res) {
    var out = [['Name', 'Date', 'Day', 'Start', 'End', 'Unpaid break (min)', 'Paid hours', '£ per hour', 'Pay £', 'Checks'].join(',')];
    res.people.forEach(function (w) {
      w.days.forEach(function (d, i) {
        if (d.off) return;
        out.push([w.name, addDays(res.week, i), DAYS[i], clock(d.segs[0][0]), clock(d.segs[d.segs.length - 1][1]), d.brk || 0, (d.minutes / 60).toFixed(2), isFinite(w.rate) ? w.rate.toFixed(2) : '', isFinite(w.rate) ? (d.minutes / 60 * w.rate).toFixed(2) : '', d.flags.join(' ')].map(csvCell).join(','));
      });
      out.push([w.name + ' TOTAL', res.week, 'week', '', '', '', (w.minutes / 60).toFixed(2), isFinite(w.rate) ? w.rate.toFixed(2) : '', w.pay.toFixed(2), 'holiday ' + w.holiday.toFixed(2) + ' · employer NI ' + w.ni.toFixed(2) + ' · cost ' + w.cost.toFixed(2)].map(csvCell).join(','));
    });
    return out.join('\r\n') + '\r\n';
  }
  function icsStamp(weekIso, absMin) { var d = addDays(weekIso, Math.floor(absMin / 1440)).replace(/-/g, ''), m = absMin % 1440; return d + 'T' + ('0' + Math.floor(m / 60)).slice(-2) + ('0' + m % 60).slice(-2) + '00'; }
  function ics(res, who, team) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//shift planner//EN', 'CALSCALE:GREGORIAN'];
    res.people.forEach(function (w) {
      if (who && w.name !== who) return;
      w.days.forEach(function (d, i) {
        d.segs.forEach(function (s, j) {
          L.push('BEGIN:VEVENT', 'UID:' + res.week + '-' + i + '-' + j + '-' + w.name.replace(/[^A-Za-z0-9]/g, '') + '@shift-planner', 'DTSTAMP:' + res.week.replace(/-/g, '') + 'T000000Z',
            'DTSTART;TZID=Europe/London:' + icsStamp(res.week, s[0]), 'DTEND;TZID=Europe/London:' + icsStamp(res.week, s[1]),
            'SUMMARY:' + (who ? '' : w.name + ' · ') + 'Shift' + (team ? ' · ' + team : ''), 'END:VEVENT');
        });
      });
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }
  // several saved weeks: hours, pay, issues and the running 48-hour average (last 17 weeks)
  function summary(weeks) {
    var by = {};
    weeks.slice(-17).forEach(function (wk) {
      wk.res.people.forEach(function (w) {
        var s = by[w.name] = by[w.name] || { name: w.name, weeks: 0, minutes: 0, pay: 0, cost: 0, issues: 0, young: w.young };
        s.weeks++; s.minutes += w.minutes; s.pay = r2(s.pay + w.pay); s.cost = r2(s.cost + w.cost);
      });
      wk.res.issues.forEach(function (i) { if (i.who && by[i.who] && i.type !== 'bad' && i.type !== 'over48') by[i.who].issues++; });
    });
    return Object.keys(by).map(function (k) { var s = by[k]; s.avg = s.minutes / s.weeks; s.avgOver = !s.young && s.avg > 2880; return s; });
  }

  var api = { DAYS: DAYS, RATES: RATES, BAND_NAME: BAND_NAME, NI: NI, num: num, r2: r2, money: money, hdec: hdec, hm: hm, clock: clock, when: when, addDays: addDays, monday: monday, fmtDate: fmtDate, shortDate: shortDate, rateSet: rateSet, nextRateSet: nextRateSet, parseCell: parseCell, parseGrid: parseGrid, analyze: analyze, weekEnds: weekEnds, toCSV: toCSV, ics: ics, summary: summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SP = api;
})(this);
