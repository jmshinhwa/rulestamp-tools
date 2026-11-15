/* LinkedIn automation tool cost tracker — engine (pure functions, no DOM). Runs in the browser and in node. */
(function () {
  'use strict';
  var SYM = { USD: '$', EUR: '€', GBP: '£' };
  var cur = 'USD';
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function group(n, d) {
    var s = Math.abs(n).toFixed(d), p = s.split('.'), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-' : '') + i + (p[1] ? '.' + p[1] : '');
  }
  function money(x) {
    if (!isFinite(x)) return '—';
    var v = r2(x), s = group(Math.abs(v), 2);
    return (v < 0 ? '-' : '') + (SYM[cur] || '$') + s;
  }
  function qty(x) { return isFinite(x) ? group(Math.round(x), 0) : '—'; }
  function pct(x) { return isFinite(x) ? (Math.round(x * 1000) / 10).toFixed(1) + '%' : '—'; }
  function num(s) {
    s = String(s == null ? '' : s).replace(/[$€£\s]/g, '');
    if (!s) return NaN;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function pdate(s) {
    var m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  function iso(d) { return d ? d.toISOString().slice(0, 10) : ''; }
  function addDays(d, n) { return new Date(d.getTime() + n * 864e5); }
  function addMonths(d, n) {
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(day, last)));
  }
  // billing period → [label, monthly factor, step(date, k)]
  function period(s) {
    s = String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (/^(4 ?w|4 weeks|four weeks|28 days)/.test(s)) return { key: '4w', label: '4 weeks', f: 13 / 12, step: function (d, k) { return addDays(d, 28 * k); } };
    if (/^(w|week|weekly)/.test(s)) return { key: 'w', label: 'week', f: 52 / 12, step: function (d, k) { return addDays(d, 7 * k); } };
    if (/^(q|quarter|quarterly|3 months)/.test(s)) return { key: 'q', label: 'quarter', f: 1 / 3, step: function (d, k) { return addMonths(d, 3 * k); } };
    if (/^(y|year|yearly|annual|annually|12 months)/.test(s)) return { key: 'y', label: 'year', f: 1 / 12, step: function (d, k) { return addMonths(d, 12 * k); } };
    if (/^(m|mo|month|monthly|$)/.test(s)) return { key: 'm', label: 'month', f: 1, step: function (d, k) { return addMonths(d, k); } };
    return null;
  }
  var SHARED = /^(team|all|shared|everyone|company)$/i;
  function parseStack(t) {
    var out = [], bad = [];
    String(t || '').split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim() || /^\s*#/.test(line)) return;
      var c = line.split(/[;\t]/).map(function (x) { return x.trim(); });
      var price = num(c[2]), per = period(c[3] || 'month');
      if (!c[0] || !isFinite(price) || !per) { bad.push(i + 1); return; }
      out.push({ item: c[0], account: c[1] || 'team', shared: SHARED.test(c[1] || 'team'), price: price, per: per, monthly: price * per.f, date: pdate(c[4]), seat: /\bseat\b/i.test(c[0]) });
    });
    return { rows: out, bad: bad };
  }
  function parseWeeks(t) {
    var out = [], bad = [];
    String(t || '').split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim() || /^\s*#/.test(line)) return;
      var c = line.split(/[;\t]/).map(function (x) { return x.trim(); });
      var d = pdate(c[0]), inv = num(c[2]), acc = num(c[3]), rep = num(c[4] || 0), mt = num(c[5] || 0);
      if (!d || !c[1] || !isFinite(inv) || !isFinite(acc)) { bad.push(i + 1); return; }
      out.push({ date: d, account: c[1], invites: inv, accepted: acc, replies: isFinite(rep) ? rep : 0, meetings: isFinite(mt) ? mt : 0 });
    });
    out.sort(function (a, b) { return a.date - b.date; });
    return { rows: out, bad: bad };
  }
  function sum(a, k) { return a.reduce(function (s, x) { return s + (x[k] || 0); }, 0); }

  function run(v) {
    cur = SYM[v.cur] ? v.cur : 'USD';
    var asof = pdate(v.asof) || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    var cap = num(v.cap), goal = num(v.goal), hours = num(v.hours), rate = num(v.rate);
    if (!isFinite(hours)) hours = 0; if (!isFinite(rate)) rate = 0;
    var S = parseStack(v.stack), W = parseWeeks(v.weeks);
    // accounts: every named account in the stack or the log, in order of first appearance
    var names = [];
    S.rows.forEach(function (r) { if (!r.shared && names.indexOf(r.account) < 0) names.push(r.account); });
    W.rows.forEach(function (r) { if (names.indexOf(r.account) < 0) names.push(r.account); });
    var nAcc = names.length || 1;
    var sharedMonthly = sum(S.rows.filter(function (r) { return r.shared; }), 'monthly');
    var seatsMonthly = sum(S.rows.filter(function (r) { return r.seat; }), 'monthly');
    var totalMonthly = sum(S.rows, 'monthly');
    var addOnsMonthly = totalMonthly - seatsMonthly;
    var seatCount = S.rows.filter(function (r) { return r.seat; }).length;
    // windows: last 4 weeks (start in (asof-28, asof]) and the 4 weeks before
    var t0 = addDays(asof, -28), t1 = addDays(asof, -56);
    var win = W.rows.filter(function (r) { return r.date > t0 && r.date <= asof; });
    var prev = W.rows.filter(function (r) { return r.date > t1 && r.date <= t0; });
    function weeksIn(a) { var s = {}; a.forEach(function (r) { s[iso(r.date)] = 1; }); return Object.keys(s).length; }
    var nw = weeksIn(win);
    var weekly = totalMonthly * 12 / 52, timeWeekly = hours * rate;
    var toolsWin = weekly * nw, timeWin = timeWeekly * nw;
    var T = { invites: sum(win, 'invites'), accepted: sum(win, 'accepted'), replies: sum(win, 'replies'), meetings: sum(win, 'meetings') };
    var P = { invites: sum(prev, 'invites'), accepted: sum(prev, 'accepted') };
    var perMeeting = T.meetings ? (toolsWin + timeWin) / T.meetings : NaN;
    var accounts = names.map(function (n) {
      var own = S.rows.filter(function (r) { return !r.shared && r.account === n; });
      var monthly = sum(own, 'monthly') + sharedMonthly / nAcc;
      var w = win.filter(function (r) { return r.account === n; }), p = prev.filter(function (r) { return r.account === n; });
      var a = { name: n, monthly: monthly, ownMonthly: sum(own, 'monthly'), invites: sum(w, 'invites'), accepted: sum(w, 'accepted'), replies: sum(w, 'replies'), meetings: sum(w, 'meetings'),
        pInvites: sum(p, 'invites'), pAccepted: sum(p, 'accepted'), weeks: weeksIn(w) };
      a.cost = monthly * 12 / 52 * nw + timeWeekly * nw / nAcc;
      a.accRate = a.invites ? a.accepted / a.invites : NaN;
      a.pAccRate = a.pInvites ? a.pAccepted / a.pInvites : NaN;
      a.perMeeting = a.meetings ? a.cost / a.meetings : NaN;
      a.perAccepted = a.accepted ? a.cost / a.accepted : NaN;
      a.overCap = isFinite(cap) ? w.filter(function (r) { return r.invites > cap; }).map(function (r) { return { date: iso(r.date), invites: r.invites }; }) : [];
      a.drop = isFinite(a.pAccRate) && isFinite(a.accRate) && a.pAccRate > 0 && a.accRate < a.pAccRate * 0.7;
      a.overGoal = isFinite(goal) && goal > 0 && (a.meetings ? a.perMeeting > goal : a.cost > 0);
      return a;
    });
    var worst = accounts.filter(function (a) { return a.cost > 0; }).sort(function (x, y) {
      var px = x.meetings ? x.perMeeting : Infinity, py = y.meetings ? y.perMeeting : Infinity; return py - px;
    })[0] || null;
    var overCap = [];
    accounts.forEach(function (a) { a.overCap.forEach(function (o) { overCap.push({ name: a.name, date: o.date, invites: o.invites }); }); });
    // renewals: roll each dated item forward to its next charge on or after asof
    var end30 = addDays(asof, 30), end365 = addMonths(asof, 12), charges = [];
    S.rows.forEach(function (r) {
      if (!r.date) return;
      var d = r.date, k = 0;
      while (d < asof && k < 2000) { k++; d = r.per.step(r.date, k); }
      var j = 0;
      while (d < end365 && j < 60) { charges.push({ date: d, item: r.item, account: r.account, amount: r.price, per: r.per.label }); j++; d = r.per.step(r.date, k + j); }
    });
    charges.sort(function (a, b) { return a.date - b.date || a.item.localeCompare(b.item); });
    var next30 = charges.filter(function (c) { return c.date < end30; });
    var undated = S.rows.filter(function (r) { return !r.date; });
    var weeks = {};
    W.rows.forEach(function (r) { var k = iso(r.date); var x = weeks[k] || (weeks[k] = { date: k, invites: 0, accepted: 0, replies: 0, meetings: 0 }); x.invites += r.invites; x.accepted += r.accepted; x.replies += r.replies; x.meetings += r.meetings; });
    return {
      asof: iso(asof), cur: cur, cap: cap, goal: goal, hours: hours, rate: rate, nw: nw,
      stack: S.rows, weeks: W.rows, byWeek: Object.keys(weeks).sort().map(function (k) { return weeks[k]; }),
      parse: { stack: S.rows.length, weeks: W.rows.length, stackBad: S.bad, weeksBad: W.bad },
      totalMonthly: totalMonthly, seatsMonthly: seatsMonthly, addOnsMonthly: addOnsMonthly, seatCount: seatCount, sharedMonthly: sharedMonthly,
      addOnPct: seatsMonthly ? addOnsMonthly / seatsMonthly : NaN,
      toolsWin: toolsWin, timeWin: timeWin, perMeeting: perMeeting, toolsPerMeeting: T.meetings ? toolsWin / T.meetings : NaN,
      perAccepted: T.accepted ? (toolsWin + timeWin) / T.accepted : NaN,
      T: T, accRate: T.invites ? T.accepted / T.invites : NaN, pAccRate: P.invites ? P.accepted / P.invites : NaN,
      accounts: accounts, worst: worst, overCap: overCap,
      charges: charges, next30: next30, next30Total: sum(next30, 'amount'), undated: undated,
      yearCost: totalMonthly * 12
    };
  }
  var E = { run: run, money: money, qty: qty, pct: pct, num: num, iso: iso, pdate: pdate, period: period, r2: r2, sym: function () { return SYM[cur]; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  if (typeof window !== 'undefined') window.LAT = E;
})();
