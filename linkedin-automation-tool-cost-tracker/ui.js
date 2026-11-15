/* builds every output block from engine results (shared by the page, the tests and the prerender) */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function build(E, r, v) {
    var m = E.money, q = E.qty, p = E.pct, o = {}, w = r.worst;
    o['o-title'] = esc('Your LinkedIn automation stack, last ' + (r.nw || 4) + ' weeks to ' + r.asof + (v.team ? ' · ' + v.team : ''));
    var goalTxt = isFinite(r.goal) && r.goal > 0 ? m(r.goal) : '';
    var wTimes = w && w.meetings && goalTxt ? Math.round(w.perMeeting / r.goal * 10) / 10 : NaN;
    var wGoal = !goalTxt ? '' : !w || !w.meetings ? '' : w.perMeeting > r.goal ? ' · ' + wTimes + '× your goal of ' + goalTxt : ' · under your goal of ' + goalTxt;
    var tiles = [
      ['good', 'Cost per meeting, last ' + r.nw + ' weeks', m(r.perMeeting), 'tools ' + m(r.toolsWin) + ' + your time ' + m(r.timeWin) + ' ÷ ' + q(r.T.meetings) + ' meetings'],
      [w && w.overGoal ? 'bad' : '', 'Costliest account per meeting', w ? (w.meetings ? m(w.perMeeting) : m(w.cost) + ', 0 meetings') : '—', w ? w.name + wGoal + ' · ' + m(w.monthly) + ' a month' : 'log a week to see it'],
      ['warn', 'Stack per month', m(r.totalMonthly), r.seatCount + (r.seatCount === 1 ? ' seat ' : ' seats ') + m(r.seatsMonthly) + ' + add-ons ' + m(r.addOnsMonthly) + (isFinite(r.addOnPct) ? ' (+' + Math.round(r.addOnPct * 100) + '% on the seats)' : '')],
      ['warn', 'Charges in the next 30 days', m(r.next30Total), r.next30.length ? r.next30.length + ' charges · first ' + E.iso(r.next30[0].date) + ' ' + r.next30[0].item + ' (' + r.next30[0].account + ')' : 'no dated charge in 30 days'],
      [r.overCap.length ? 'bad' : 'good', 'Weeks over your invite limit', q(r.overCap.length), isFinite(r.cap) ? (r.overCap.length ? uniq(r.overCap.map(function (x) { return x.name; })).join(', ') + ' above ' + q(r.cap) + ' invites a week' : 'every account at or under ' + q(r.cap) + ' a week') : 'set your weekly limit'],
      [isFinite(r.pAccRate) && r.accRate < r.pAccRate * 0.85 ? 'bad' : '', 'Acceptance rate, last ' + r.nw + ' weeks', p(r.accRate), q(r.T.accepted) + ' of ' + q(r.T.invites) + ' invites' + (isFinite(r.pAccRate) ? ' · ' + p(r.pAccRate) + ' the 4 weeks before' : '')]
    ];
    o['o-tiles'] = tiles.map(function (t) { return '<div class="tile ' + t[0] + '"><span>' + esc(t[1]) + '</span><b>' + esc(t[2]) + '</b><small>' + esc(t[3]) + '</small></div>'; }).join('');
    var s = (v.team || 'Your team') + ', ' + r.nw + ' weeks to ' + r.asof + ': ' + q(r.T.invites) + ' invites, ' + q(r.T.accepted) + ' accepted (' + p(r.accRate) + '), ' + q(r.T.replies) + ' replies, ' + q(r.T.meetings) + ' meetings. Stack ' + m(r.totalMonthly) + ' a month (' + m(r.yearCost) + ' a year); cost per meeting ' + m(r.perMeeting) + ' with your time, ' + m(r.toolsPerMeeting) + ' tools only.';
    if (w && w.overGoal) s += ' ' + w.name + ': ' + (w.meetings ? m(w.perMeeting) + ' per meeting' : 'no meeting') + ' on ' + m(w.monthly) + ' a month.';
    o['o-summary'] = esc(s);
    var fl = [];
    r.accounts.forEach(function (a) {
      if (a.overGoal && a.meetings) fl.push(['bad', a.name + ': ' + m(a.perMeeting) + ' per meeting (' + m(a.cost) + ' ÷ ' + q(a.meetings) + '), above your goal of ' + goalTxt + '. Its seat and add-ons plus its share of team items cost ' + m(a.monthly) + ' a month.']);
      else if (a.overGoal) fl.push(['bad', a.name + ': no meeting in ' + r.nw + ' weeks on ' + m(a.monthly) + ' a month.']);
      if (a.drop) fl.push(['bad', a.name + ': acceptance fell from ' + p(a.pAccRate) + ' to ' + p(a.accRate) + ' while invites went from ' + q(a.pInvites) + ' to ' + q(a.invites) + '.']);
      if (a.overCap.length) fl.push(['warn', a.name + ' sent more than your limit of ' + q(r.cap) + ' invites in ' + a.overCap.length + (a.overCap.length === 1 ? ' week' : ' weeks') + ' (' + a.overCap.map(function (x) { return x.date + ': ' + q(x.invites); }).join(' · ') + ').']);
    });
    if (isFinite(r.addOnPct) && r.addOnsMonthly > 0) fl.push(['', 'Add-ons cost ' + m(r.addOnsMonthly) + ' a month on top of ' + r.seatCount + (r.seatCount === 1 ? ' seat at ' : ' seats at ') + m(r.seatsMonthly) + ', +' + Math.round(r.addOnPct * 100) + '%. Monthly equivalents: a yearly price ÷ 12, a 4-week price × 13 ÷ 12.']);
    if (r.undated.length) fl.push(['warn', r.undated.length + ' stack lines have no charge date, so they are not in the renewal list: ' + r.undated.map(function (x) { return x.item + ' (' + x.account + ')'; }).join(', ') + '.']);
    if (r.parse.stackBad.length) fl.push(['bad', 'Stack lines I cannot read: ' + r.parse.stackBad.join(', ') + ' (use item; account; price; month|year|4 weeks; charge date).']);
    if (r.parse.weeksBad.length) fl.push(['bad', 'Week lines I cannot read: ' + r.parse.weeksBad.join(', ') + ' (use week start; account; invites; accepted; replies; meetings).']);
    if (!r.nw) fl.push(['warn', 'No week in the log starts in the 28 days before ' + r.asof + '. Add last week to see cost per meeting.']);
    o['o-flags'] = fl.map(function (f) { return '<li class="' + f[0] + '">' + esc(f[1]) + '</li>'; }).join('');
    o['o-accounts'] = '<thead><tr><th>Account</th><th class="num">Per month</th><th class="num">Cost, ' + r.nw + ' wk</th><th class="num">Invites</th><th class="num">Accepted</th><th class="num">Replies</th><th class="num">Meetings</th><th class="num">Per meeting</th><th class="num">Per accepted</th></tr></thead><tbody>' +
      r.accounts.map(function (a) { return '<tr' + (a.overGoal ? ' class="bad"' : '') + '><td>' + esc(a.name) + '</td><td class="num">' + m(a.monthly) + '</td><td class="num">' + m(a.cost) + '</td><td class="num">' + q(a.invites) + '</td><td class="num">' + q(a.accepted) + ' <small>' + p(a.accRate) + '</small></td><td class="num">' + q(a.replies) + '</td><td class="num">' + q(a.meetings) + '</td><td class="num"><b>' + (a.meetings ? m(a.perMeeting) : '—') + '</b></td><td class="num">' + (a.accepted ? m(a.perAccepted) : '—') + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>All</td><td class="num">' + m(r.totalMonthly) + '</td><td class="num">' + m(r.toolsWin + r.timeWin) + '</td><td class="num">' + q(r.T.invites) + '</td><td class="num">' + q(r.T.accepted) + '</td><td class="num">' + q(r.T.replies) + '</td><td class="num">' + q(r.T.meetings) + '</td><td class="num"><b>' + m(r.perMeeting) + '</b></td><td class="num">' + m(r.perAccepted) + '</td></tr></tbody>';
    o['o-stack'] = '<thead><tr><th>Item</th><th>Account</th><th class="num">Price</th><th>Billed per</th><th class="num">Per month</th></tr></thead><tbody>' +
      r.stack.map(function (x) { return '<tr><td>' + esc(x.item) + '</td><td>' + esc(x.shared ? 'team (split ' + r.accounts.length + ' ways)' : x.account) + '</td><td class="num">' + m(x.price) + '</td><td>' + esc(x.per.label) + '</td><td class="num">' + m(x.monthly) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td colspan="4">Per month · per year</td><td class="num"><b>' + m(r.totalMonthly) + '</b> · ' + m(r.yearCost) + '</td></tr></tbody>';
    o['o-renew'] = '<thead><tr><th>Date</th><th>Item</th><th>Account</th><th class="num">Charge</th></tr></thead><tbody>' +
      (r.next30.length ? r.next30.map(function (c) { return '<tr><td>' + E.iso(c.date) + '</td><td>' + esc(c.item) + '</td><td>' + esc(c.account) + '</td><td class="num">' + m(c.amount) + '</td></tr>'; }).join('') : '<tr><td colspan="4">No dated charge in the next 30 days.</td></tr>') +
      '<tr class="tot"><td colspan="3">Next 30 days</td><td class="num"><b>' + m(r.next30Total) + '</b></td></tr></tbody>';
    o['o-weeks'] = '<thead><tr><th>Week of</th><th class="num">Invites</th><th class="num">Accepted</th><th class="num">Rate</th><th class="num">Replies</th><th class="num">Meetings</th></tr></thead><tbody>' +
      r.byWeek.map(function (x) { return '<tr><td>' + x.date + '</td><td class="num">' + q(x.invites) + '</td><td class="num">' + q(x.accepted) + '</td><td class="num">' + p(x.invites ? x.accepted / x.invites : NaN) + '</td><td class="num">' + q(x.replies) + '</td><td class="num">' + q(x.meetings) + '</td></tr>'; }).join('') + '</tbody>';
    o['parse-msg'] = esc(r.parse.stack + ' stack lines · ' + r.parse.weeks + ' week lines · ' + r.accounts.length + ' accounts read');
    return o;
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  var U = { build: build, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = U;
  if (typeof window !== 'undefined') window.LATUI = U;
})();
