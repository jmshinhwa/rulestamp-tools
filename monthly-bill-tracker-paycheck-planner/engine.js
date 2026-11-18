/* monthly bill tracker — engine (pure functions, no DOM). Works in the browser (window.BT) and in node (module.exports). */
(function (root) {
  'use strict';

  // Federal Reserve K.8 "Holidays Observed by the Federal Reserve System 2026-2030" (federalreserve.gov/aboutthefed/k8.htm, read 2026-11-18).
  // Dates on which Federal Reserve Banks are closed (a Sunday holiday is observed the following Monday; on a Saturday holiday the Banks are open the Friday before).
  var FED_CLOSED = {
    '2026-01-01': "New Year's Day", '2026-01-19': 'Martin Luther King Jr. Day', '2026-02-16': "Washington's Birthday",
    '2026-05-25': 'Memorial Day', '2026-06-19': 'Juneteenth', '2026-09-07': 'Labor Day', '2026-10-12': 'Columbus Day',
    '2026-11-11': 'Veterans Day', '2026-11-26': 'Thanksgiving Day', '2026-12-25': 'Christmas Day',
    '2027-01-01': "New Year's Day", '2027-01-18': 'Martin Luther King Jr. Day', '2027-02-15': "Washington's Birthday",
    '2027-05-31': 'Memorial Day', '2027-07-05': 'Independence Day (observed)', '2027-09-06': 'Labor Day',
    '2027-10-11': 'Columbus Day', '2027-11-11': 'Veterans Day', '2027-11-25': 'Thanksgiving Day',
    '2028-01-17': 'Martin Luther King Jr. Day', '2028-02-21': "Washington's Birthday", '2028-05-29': 'Memorial Day',
    '2028-06-19': 'Juneteenth', '2028-07-04': 'Independence Day', '2028-09-04': 'Labor Day', '2028-10-09': 'Columbus Day',
    '2028-11-23': 'Thanksgiving Day', '2028-12-25': 'Christmas Day'
  };
  // Saturday holidays (2026-07-04, 2027-06-19, 2027-12-25, 2028-01-01) fall on a weekend anyway, so the weekend rule covers them.

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '').slice(0, 10));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function daysInMonth(y, m0) { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }
  function isBusinessDay(d) {
    var w = d.getUTCDay();
    return w !== 0 && w !== 6 && !FED_CLOSED[iso(d)];
  }
  function closedWhy(d) {
    var w = d.getUTCDay();
    if (FED_CLOSED[iso(d)]) return FED_CLOSED[iso(d)];
    if (w === 6) return 'Saturday';
    if (w === 0) return 'Sunday';
    return '';
  }
  function prevBusinessDay(d) { var x = d; while (!isBusinessDay(x)) x = addDays(x, -1); return x; }
  function nextBusinessDay(d) { var x = d; while (!isBusinessDay(x)) x = addDays(x, 1); return x; }
  function fmtDate(d) { return DOW[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCDate(); }
  function cents(x) { return Math.round((+x || 0) * 100); }
  function money(c) {
    var neg = c < 0; c = Math.abs(Math.round(c));
    var s = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + pad(c % 100);
    return (neg ? '−$' : '$') + s;
  }
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  // Is this bill due in month (y, m0)? repeat: monthly | quarterly | yearly; start = first month 1-12 (quarterly/yearly).
  function dueThisMonth(b, y, m0) {
    var r = b.repeat || 'monthly';
    if (r === 'monthly') return true;
    var st = (parseInt(b.month, 10) || 1) - 1;
    if (r === 'yearly') return m0 === st;
    if (r === 'quarterly') return ((m0 - st) % 3 + 3) % 3 === 0;
    return true;
  }

  // Paydays that land in the month. freq: weekly | biweekly | semimonthly | monthly. anchor = one known payday (yyyy-mm-dd).
  // shift: 'before' (paid the business day before a weekend/bank holiday) | 'after'.
  function paydays(p, y, m0) {
    var first = new Date(Date.UTC(y, m0, 1)), last = new Date(Date.UTC(y, m0, daysInMonth(y, m0)));
    var out = [], raw = [];
    var mv = function (d) { return isBusinessDay(d) ? d : (p.shift === 'after' ? nextBusinessDay(d) : prevBusinessDay(d)); };
    if (p.freq === 'weekly' || p.freq === 'biweekly') {
      var step = p.freq === 'weekly' ? 7 : 14;
      var a = parse(p.anchor) || first;
      var k = Math.floor((addDays(first, -7).getTime() - a.getTime()) / 86400000 / step);
      var d = addDays(a, k * step);
      while (d <= addDays(last, 7)) { raw.push(d); d = addDays(d, step); }
    } else if (p.freq === 'semimonthly') {
      // the 15th and the last day of each month (prev and next month too, a shifted payday can cross the month line)
      [-1, 0, 1].forEach(function (k) {
        var yy = y, mm = m0 + k; if (mm < 0) { mm = 11; yy--; } if (mm > 11) { mm = 0; yy++; }
        raw.push(new Date(Date.UTC(yy, mm, 15)));
        raw.push(new Date(Date.UTC(yy, mm, daysInMonth(yy, mm))));
      });
    } else { // monthly on day N
      var an = parse(p.anchor);
      var dn = parseInt(p.day, 10) || (an ? an.getUTCDate() : 1);
      [-1, 0, 1].forEach(function (k) {
        var yy = y, mm = m0 + k; if (mm < 0) { mm = 11; yy--; } if (mm > 11) { mm = 0; yy++; }
        raw.push(new Date(Date.UTC(yy, mm, Math.min(dn, daysInMonth(yy, mm)))));
      });
    }
    raw.forEach(function (d) {
      var e = mv(d);
      if (e >= first && e <= last) out.push({ sched: d, date: e, moved: iso(e) !== iso(d), why: closedWhy(d) });
    });
    out.sort(function (a, b) { return a.date - b.date; });
    return out;
  }

  // The whole month: bills → safe pay-by day (last bank business day on or before the due date) → which paycheck pays it → running cash.
  function plan(inp) {
    var y = +inp.year, m0 = +inp.month - 1;
    var dim = daysInMonth(y, m0);
    var pay = cents(num(inp.pay));
    var start = cents(num(inp.start));
    var buffer = cents(num(inp.buffer));
    var pds = paydays({ freq: inp.freq, anchor: inp.anchor, day: inp.payDay, shift: inp.shift }, y, m0);
    var bills = [];
    (inp.bills || []).forEach(function (b, i) {
      var amt = cents(num(b.amount));
      if (!b.name && !amt) return;
      if (!dueThisMonth(b, y, m0)) return;
      var dd = Math.min(Math.max(parseInt(b.day, 10) || 1, 1), dim);
      var due = new Date(Date.UTC(y, m0, dd));
      var payBy = prevBusinessDay(due); // may fall in the previous month (due on a closed 1st): shown as is, counted from the 1st
      bills.push({ i: i, name: String(b.name || 'Bill ' + (i + 1)), amount: amt, fee: cents(num(b.fee)), auto: b.how === 'auto',
                   due: due, payBy: payBy, moved: iso(payBy) !== iso(due), why: closedWhy(due), repeat: b.repeat || 'monthly',
                   paid: !!b.paid });
    });
    // events in date order: a paycheck on the same day lands before that day's bills
    var ev = [];
    pds.forEach(function (p, k) { ev.push({ t: p.date.getTime(), o: 0, kind: 'pay', k: k, p: p }); });
    var t1 = Date.UTC(y, m0, 1);
    bills.forEach(function (b) { ev.push({ t: Math.max(b.payBy.getTime(), t1), o: 1, kind: 'bill', b: b }); });
    ev.sort(function (a, b) { return a.t - b.t || a.o - b.o || (a.b && b.b ? b.b.amount - a.b.amount : 0); });
    var bal = start, low = null, period = -1, periods = [{ label: 'Cash on the 1st', date: null, inflow: start, bills: [], total: 0 }];
    pds.forEach(function (p) { periods.push({ label: 'Paycheck ' + fmtDate(p.date), date: p.date, inflow: pay, bills: [], total: 0, moved: p.moved, why: p.why, sched: p.sched }); });
    var late = [], shortAt = null, need = 0;
    ev.forEach(function (e) {
      if (e.kind === 'pay') { bal += pay; period = e.k; return; }
      var b = e.b;
      var P = periods[period + 1];
      P.bills.push(b); P.total += b.amount;
      b.period = period + 1;
      bal -= b.amount;
      b.after = bal;
      if (bal < buffer) need = Math.max(need, buffer - bal);
      if (bal < 0) late.push(b);
      if (low === null || bal < low.bal) low = { bal: bal, date: b.payBy, bill: b };
    });
    var billTotal = bills.reduce(function (s, b) { return s + b.amount; }, 0);
    var feeAtStake = late.reduce(function (s, b) { return s + b.fee; }, 0);
    // the low point of the month: if it sits under the cushion, that is the day to fix
    if (low && low.bal < buffer) shortAt = low.bill;
    var carry = shortAt ? periods[shortAt.period] : null;
    var nextPay = shortAt ? pds.filter(function (p) { return p.date > shortAt.payBy; })[0] || null : null;
    periods.forEach(function (P) { P.left = P.inflow - P.total; });
    return {
      y: y, m0: m0, monthName: MONTHS[m0] + ' ' + y, paydays: pds, bills: bills, periods: periods,
      billTotal: billTotal, payTotal: pay * pds.length, start: start, end: bal, buffer: buffer,
      shortAt: shortAt, need: need, late: late, feeAtStake: feeAtStake, low: low, carry: carry, nextPay: nextPay,
      movedBills: bills.filter(function (b) { return b.moved; }), movedPays: pds.filter(function (p) { return p.moved; })
    };
  }

  // one year ahead, month by month (Pro): the month to fix first
  function year(inp, months) {
    var out = [], y = +inp.year, m = +inp.month;
    var bal = cents(num(inp.start));
    for (var i = 0; i < (months || 12); i++) {
      var r = plan(Object.assign({}, inp, { year: y, month: m, start: bal / 100 }));
      out.push({ y: y, m: m, name: r.monthName, bills: r.billTotal, pay: r.payTotal, paychecks: r.paydays.length, need: r.need, fee: r.feeAtStake, end: r.end, shortAt: r.shortAt });
      bal = r.end;
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  function csv(r) {
    var q = function (s) { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var rows = [['Bill', 'Amount', 'Due date', 'Safe pay-by day', 'Why moved', 'Paid from', 'Autopay', 'Late fee', 'Balance after']];
    r.bills.slice().sort(function (a, b) { return a.payBy - b.payBy; }).forEach(function (b) {
      rows.push([b.name, (b.amount / 100).toFixed(2), iso(b.due), iso(b.payBy), b.moved ? b.why : '', r.periods[b.period].label,
                 b.auto ? 'yes' : 'no', (b.fee / 100).toFixed(2), (b.after / 100).toFixed(2)]);
    });
    return rows.map(function (x) { return x.map(q).join(','); }).join('\r\n') + '\r\n';
  }

  // .ics reminders: one all-day event on each safe pay-by day, alarm 2 days before at 9:00
  function ics(r, name) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yoojin//monthly bill tracker//EN', 'CALSCALE:GREGORIAN'];
    var stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    r.bills.forEach(function (b, i) {
      var d = iso(b.payBy).replace(/-/g, ''), d2 = iso(addDays(b.payBy, 1)).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:bill-' + d + '-' + i + '@monthly-bill-tracker', 'DTSTAMP:' + stamp,
             'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + d2,
             'SUMMARY:Pay ' + b.name.replace(/[,;\\]/g, ' ') + ' ' + money(b.amount).replace('$', 'USD '),
             'DESCRIPTION:Due ' + iso(b.due) + (b.moved ? ' (' + b.why + ')' : '') + '. Late fee ' + money(b.fee).replace('$', 'USD ') + '.',
             'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Bill due soon', 'TRIGGER:-P2DT15H', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  var BT = { plan: plan, year: year, paydays: paydays, csv: csv, ics: ics, money: money, iso: iso, parse: parse, fmtDate: fmtDate,
             isBusinessDay: isBusinessDay, FED_CLOSED: FED_CLOSED, MONTHS: MONTHS, num: num };
  if (typeof module !== 'undefined' && module.exports) module.exports = BT; else root.BT = BT;
})(this);
