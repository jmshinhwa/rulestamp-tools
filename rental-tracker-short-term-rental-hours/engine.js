/* rental tracker — short-term rental engine (browser + node). Rules: IRS Pub 527 ch. 5 + Worksheet 5-1, Schedule E line 2,
   Pub 925 (7-day exception, $25,000 allowance), Treas. Reg. 1.469-1(e)(3)(iii), 1.469-5T(a)(1),(a)(3),(f)(3). Read 2026-11-18. */
(function (root) {
  'use strict';
  var EX_STAYS = "2026-01-03; 2026-01-06; 740; guest\n2026-01-09; 2026-01-13; 955; guest\n2026-01-16; 2026-01-18; 525; guest\n2026-01-23; 2026-01-28; 1,170; guest\n2026-01-31; 2026-02-03; 740; guest\n2026-02-06; 2026-02-12; 1,385; guest\n2026-02-17; 2026-02-21; 955; guest\n2026-02-24; 2026-02-27; 740; guest\n2026-03-02; 2026-03-04; 555; guest\n2026-03-09; 2026-03-13; 1,015; guest\n2026-03-16; 2026-03-21; 1,245; guest\n2026-03-24; 2026-03-27; 785; guest\n2026-04-01; 2026-04-04; 815; guest\n2026-04-07; 2026-04-11; 1,055; guest\n2026-04-14; 2026-04-19; 0; owner\n2026-04-21; 2026-04-23; 575; guest\n2026-04-28; 2026-05-03; 1,295; guest\n2026-05-06; 2026-05-09; 860; guest\n2026-05-12; 2026-05-18; 1,625; guest\n2026-05-23; 2026-05-27; 1,115; guest\n2026-05-30; 2026-06-02; 860; guest\n2026-06-05; 2026-06-07; 645; guest\n2026-06-12; 2026-06-16; 1,195; guest\n2026-06-19; 2026-06-24; 1,470; guest\n2026-06-27; 2026-06-30; 920; guest\n2026-07-05; 2026-07-08; 980; guest\n2026-07-11; 2026-07-15; 1,275; guest\n2026-07-18; 2026-07-20; 685; guest\n2026-07-25; 2026-07-30; 1,570; guest\n2026-08-02; 2026-08-05; 980; guest\n2026-08-08; 2026-08-14; 1,865; guest\n2026-08-19; 2026-08-23; 1,275; guest\n2026-08-26; 2026-08-29; 980; guest\n2026-09-01; 2026-09-03; 615; guest\n2026-09-08; 2026-09-12; 1,135; guest\n2026-09-15; 2026-09-20; 1,395; guest\n2026-09-23; 2026-09-26; 875; guest\n2026-10-01; 2026-10-04; 890; guest\n2026-10-07; 2026-10-11; 1,155; guest\n2026-10-14; 2026-10-16; 625; guest\n2026-10-21; 2026-10-28; 0; owner\n2026-10-30; 2026-11-04; 1,420; guest\n2026-11-07; 2026-11-10; 815; guest\n2026-11-13; 2026-11-19; 1,535; guest\n2026-11-24; 2026-11-28; 1,055; guest\n2026-12-01; 2026-12-04; 950; guest\n2026-12-07; 2026-12-09; 665; guest\n2026-12-14; 2026-12-18; 1,235; guest\n2026-12-21; 2026-12-26; 1,520; guest";
  var EX_HOURS = "2026-01-31; you; 8; guest messages, 2 check-in walk-throughs, restock run\n2026-01-31; Dana (cleaner); 10; 4 turnovers\n2026-02-28; you; 6.5; guest messages, pricing changes, hot tub service visit\n2026-02-28; Dana (cleaner); 10; 4 turnovers\n2026-03-31; you; 7; guest messages, listing photos, restock run\n2026-03-31; Dana (cleaner); 10; 4 turnovers\n2026-04-30; you; 9.5; spring deck repair with handyman, guest messages\n2026-04-30; Dana (cleaner); 7.5; 3 turnovers\n2026-05-31; you; 7; guest messages, restock run, smoke detector test\n2026-05-31; Dana (cleaner); 10; 4 turnovers\n2026-06-30; you; 8.5; guest messages, AC repair visit, pricing for July\n2026-06-30; Dana (cleaner); 12.5; 5 turnovers\n2026-07-31; you; 8; guest messages, 2 check-in walk-throughs\n2026-07-31; Dana (cleaner); 10; 4 turnovers\n2026-08-31; you; 7.5; guest messages, restock run, review replies\n2026-08-31; Dana (cleaner); 10; 4 turnovers\n2026-09-30; you; 7; guest messages, pest control visit\n2026-09-30; Dana (cleaner); 10; 4 turnovers\n2026-10-31; you; 9; guest messages, gutter cleaning, winter pricing\n2026-10-31; Dana (cleaner); 7.5; 3 turnovers\n2026-11-15; you; 3.5; guest messages, restock run\n2026-11-15; Dana (cleaner); 5; 2 turnovers";
  var DEFAULTS = { year: '2026', listing: 'Smoky Ridge Cabin, Gatlinburg, TN (example)', rate: '24', magi: '165,000',
    stays: EX_STAYS, hours: EX_HOURS,
    interest: '15,600', taxes: '3,900', insurance: '2,450', utilities: '4,320', cleaning: '8,225', supplies: '2,180', repairs: '1,640', fees: '1,462', depreciation: '41,127',
    carry_op: '0', carry_dep: '0', carry_pass: '0' };
  var EXP = [ // key, Schedule E line, label, tier for Worksheet 5-1
    ['cleaning', '7', 'Cleaning and maintenance', 2], ['insurance', '9', 'Insurance', 2], ['interest', '12', 'Mortgage interest', 1],
    ['repairs', '14', 'Repairs', 2], ['supplies', '15', 'Supplies', 2], ['taxes', '16', 'Taxes', 1], ['utilities', '17', 'Utilities', 2],
    ['depreciation', '18', 'Depreciation', 3], ['fees', '19', 'Other: host service fees (direct)', 0]];
  var OWN = /^(you|me|myself|owner|i|spouse|wife|husband|my spouse|my wife|my husband)\b/i;
  var PERSONAL = { owner: 1, family: 1, below: 1, friend: 1, swap: 1 };

  function num(x) { var s = String(x == null ? '' : x).replace(/[$\s,]/g, ''); var n = parseFloat(s); return isFinite(n) ? n : 0; }
  function r2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function usd(x) { var n = r2(x), s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (n < 0 ? '−$' : '$') + s; }
  function hrs(x) { return (Math.round(x * 100) / 100).toString(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function day(s) { var m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(String(s || '')); if (!m) return null; var t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return isFinite(t) ? t / 864e5 : null; }
  function split(line) { return String(line).split(/\s*[;\t|]\s*/); }

  // stays: check-in; check-out; amount; who (guest | owner | family | below | repair)
  function parseStays(text, year) {
    var y0 = Date.UTC(year, 0, 1) / 864e5, y1 = Date.UTC(year + 1, 0, 1) / 864e5, out = [], bad = [];
    String(text || '').split(/\r?\n/).forEach(function (raw, i) {
      if (!raw.trim()) return;
      var p = split(raw.trim()), a = day(p[0]), b = day(p[1]);
      if (a == null || b == null || b <= a) { bad.push(i + 1); return; }
      var who = String(p[3] || 'guest').trim().toLowerCase().split(/\s+/)[0] || 'guest';
      var kind = PERSONAL[who] ? 'personal' : (who === 'repair' ? 'repair' : 'guest');
      var nights = b - a, inYr = Math.max(0, Math.min(b, y1) - Math.max(a, y0));
      if (!inYr) return;
      var amt = num(p[2]);
      out.push({ line: i + 1, inn: p[0].trim(), out: p[1].trim(), nights: nights, inYear: inYr, amount: r2(amt * inYr / nights), who: who, kind: kind,
        counts: b > y0 && (b <= y1 || a < y1) }); // periods ending in the year or including its last day
    });
    out.sort(function (x, y) { return day(x.inn) - day(y.inn); });
    var overlap = 0; for (var i = 1; i < out.length; i++) if (day(out[i].inn) < day(out[i - 1].out)) overlap++;
    return { list: out, bad: bad, overlap: overlap };
  }
  // hours: date; who; hours; what
  function parseHours(text, year) {
    var people = {}, own = 0, lines = 0, noTask = 0, bad = [], outYear = 0;
    String(text || '').split(/\r?\n/).forEach(function (raw, i) {
      if (!raw.trim()) return;
      var p = split(raw.trim()), d = day(p[0]), h = num(p[2]), who = String(p[1] || '').trim();
      if (d == null || !who || !(h > 0)) { bad.push(i + 1); return; }
      if (new Date(d * 864e5).getUTCFullYear() !== year) { outYear++; return; }
      lines++; if (!String(p[3] || '').trim()) noTask++;
      if (OWN.test(who)) own += h; else { var k = who.toLowerCase(); people[k] = people[k] || { name: who, h: 0 }; people[k].h += h; }
    });
    var others = Object.keys(people).map(function (k) { return people[k]; }).sort(function (a, b) { return b.h - a.h; });
    return { own: own, others: others, top: others[0] || null, lines: lines, noTask: noTask, bad: bad, outYear: outYear };
  }
  function allowance25k(magi) { return Math.max(0, 25000 - 0.5 * Math.max(0, magi - 100000)); }

  function compute(v) {
    v = v || DEFAULTS;
    var year = parseInt(v.year, 10) || 2026, S = parseStays(v.stays, year), H = parseHours(v.hours, year), rate = num(v.rate) / 100, magi = num(v.magi);
    var guest = S.list.filter(function (s) { return s.kind === 'guest'; }), pers = S.list.filter(function (s) { return s.kind === 'personal'; });
    var rentalDays = guest.reduce(function (a, s) { return a + s.inYear; }, 0), personalDays = pers.reduce(function (a, s) { return a + s.inYear; }, 0);
    var periods = guest.filter(function (s) { return s.counts; }), avg = periods.length ? periods.reduce(function (a, s) { return a + s.nights; }, 0) / periods.length : 0;
    var rents = r2(S.list.filter(function (s) { return s.kind !== 'repair'; }).reduce(function (a, s) { return a + s.amount; }, 0));
    var allowed = Math.max(14, rentalDays * 0.1), home = personalDays > allowed, used = rentalDays + personalDays;
    var pct = used ? rentalDays / used : 1;
    var exempt = home && rentalDays < 15;
    var X = {}; EXP.forEach(function (e) { X[e[0]] = num(v[e[0]]); });
    var cOp = num(v.carry_op), cDep = num(v.carry_dep), cPass = num(v.carry_pass);
    // rental share of each expense (host fees are direct: 100 %)
    var share = {}; EXP.forEach(function (e) { share[e[0]] = r2(e[3] === 0 ? X[e[0]] : X[e[0]] * pct); });
    var personalIT = r2((X.interest + X.taxes) * (1 - pct));
    var t1 = share.interest + share.taxes + share.fees, t2 = share.cleaning + share.insurance + share.repairs + share.supplies + share.utilities + cOp, t3 = share.depreciation + cDep;
    var lines = {}, ws = null, carryOp = 0, carryDep = 0, total;
    EXP.forEach(function (e) { lines[e[1]] = (lines[e[1]] || 0) + share[e[0]]; });
    lines['19'] += 0; if (cOp) lines['19'] += cOp; if (cDep) lines['18'] += cDep;
    total = r2(t1 + t2 + t3);
    var net = r2(rents - total);
    if (exempt) { net = 0; total = 0; }
    else if (home && net < 0) { // Worksheet 5-1: tier 1 in full, tier 2 up to line 3, tier 3 up to line 5, rest carried
      var l3 = Math.max(0, rents - t1), op = Math.min(t2, l3), l5 = l3 - op, dep = Math.min(t3, l5);
      carryOp = r2(t2 - op); carryDep = r2(t3 - dep);
      ws = { l1: rents, t1: r2(t1), l3: r2(l3), t2: r2(t2), op: r2(op), l5: r2(l5), t3: r2(t3), dep: r2(dep), carryOp: carryOp, carryDep: carryDep };
      // scale lines to what is allowed this year
      var fOp = t2 ? op / t2 : 0, fDep = t3 ? dep / t3 : 0;
      EXP.forEach(function (e) { if (e[3] === 2) lines[e[1]] = r2(share[e[0]] * fOp); if (e[3] === 3) lines[e[1]] = r2(share[e[0]] * fDep); });
      if (cOp) lines['19'] = r2(share.fees + cOp * fOp); if (cDep) lines['18'] = r2(share.depreciation * fDep + cDep * fDep);
      total = r2(t1 + op + dep); net = r2(rents - total);
    }
    // activity class and material participation
    var shortStay = periods.length > 0 && avg <= 7, top = H.top ? H.top.h : 0;
    var t1Pass = H.own > 500, t3Pass = H.own > 100 && H.own >= top, mp = t1Pass || t3Pass;
    var need = mp ? 0 : Math.max(top - H.own, 100 - H.own, 0); var needStrict = !mp && top <= 100; // "more than 100"
    var cls, lossAllowed = 0, suspended = 0, usedCarry = 0;
    var none = !S.list.length;
    if (none) cls = 'none';
    else if (exempt) cls = 'exempt';
    else if (home) cls = 'home';
    else if (shortStay) cls = mp ? 'str_mp' : 'str_passive';
    else cls = 'rental';
    var loss = net < 0 ? -net : 0, allow = 0;
    if (loss && cls !== 'none') {
      if (cls === 'home') lossAllowed = loss; // only tier-1 items can make a loss here; not passive (Pub 527)
      else if (cls === 'str_mp') lossAllowed = loss;
      else if (cls === 'str_passive') { lossAllowed = 0; }
      else if (cls === 'rental') { allow = allowance25k(magi); lossAllowed = Math.min(loss, allow); }
      suspended = r2(loss - lossAllowed);
    } else if (net > 0 && cPass && cls !== 'home' && cls !== 'exempt') usedCarry = Math.min(cPass, net);
    var carryPass = r2(cPass - usedCarry + suspended);
    var taxLost = r2(suspended * rate), taxSaved = r2(lossAllowed * rate);
    var fixNote = '';
    if (cls === 'str_passive' && loss) fixNote = 'mp';
    return { year: year, listing: v.listing || '', rate: num(v.rate), magi: magi, stays: S, hours: H, guestCount: guest.length, periods: periods.length,
      rentalDays: rentalDays, personalDays: personalDays, avg: Math.round(avg * 100) / 100, rents: rents, allowed: Math.round(allowed * 10) / 10,
      daysLeft: Math.max(0, Math.round((allowed - personalDays) * 10) / 10), home: home, exempt: exempt, pct: pct, share: share, personalIT: personalIT,
      lines: lines, total: total, net: net, ws: ws, carryOp: carryOp, carryDep: carryDep, shortStay: shortStay, mp: mp, t1Pass: t1Pass, t3Pass: t3Pass,
      need: Math.round(need * 100) / 100, needStrict: needStrict, top: H.top, cls: cls, loss: r2(loss), allow: allow, lossAllowed: r2(lossAllowed), suspended: suspended,
      usedCarry: r2(usedCarry), carryPass: carryPass, taxLost: taxLost, taxSaved: taxSaved, fixNote: fixNote, X: X, cOp: cOp, cDep: cDep, cPass: cPass };
  }

  var CLS = { none: 'No stays yet: add this year\'s stays to see the tests', exempt: 'Rented under 15 days and used as a home: not reported', home: 'Used as a home: expenses capped at rents',
    str_mp: 'Average stay 7 days or less, you materially participate: loss not passive', str_passive: 'Average stay 7 days or less, no material participation: loss passive',
    rental: 'Average stay over 7 days: rental activity, $25,000 allowance' };
  function tiles(R) {
    var oth = R.top ? R.top.name : 'nobody else';
    return [
      ['Average stay', R.avg.toFixed(2) + ' nights', R.periods + ' guest stays · ' + R.rentalDays + ' fair rental days · ' + (R.avg && R.avg <= 7 ? '7 days or less: not a rental activity' : 'over 7: a rental activity')],
      ['Personal-use days', R.personalDays + ' of ' + R.allowed, R.home ? 'over the limit: used as a home' : R.daysLeft + ' days left before the 14-day / 10% limit'],
      ['Your hours', hrs(R.hours.own), R.mp ? 'material participation: ' + (R.t1Pass ? 'over 500 hours' : 'over 100 and not less than ' + oth) : (R.top ? oth + ' logged ' + hrs(R.top.h) : 'nobody else logged')],
      ['Hours still needed', R.mp ? '0' : hrs(R.need), R.mp ? 'tests (a)(1) or (a)(3) met' : 'by December 31, ' + R.year + (R.needStrict ? ' (more than 100)' : ' to be not less than ' + oth)],
      ['Schedule E line 21', usd(R.net), R.net < 0 ? (R.lossAllowed ? usd(R.lossAllowed) + ' of the loss offsets your pay' : 'loss offsets none of your pay') : 'rents ' + usd(R.rents)],
      ['Tax lost this year', usd(R.taxLost), R.suspended ? usd(R.suspended) + ' loss suspended at ' + R.rate + '%' : 'nothing suspended']
    ];
  }
  function tilesHtml(R) { var bad = [false, R.home, false, R.need > 0, R.suspended > 0, R.taxLost > 0]; return tiles(R).map(function (t, i) { return '<div class="tile' + (bad[i] ? ' bad' : '') + '"><span>' + esc(t[0]) + '</span><b>' + esc(t[1]) + '</b><small>' + esc(t[2]) + '</small></div>'; }).join(''); }
  function flags(R) {
    var F = [], oth = R.top ? R.top.name : '';
    F.push(['main', CLS[R.cls]]);
    if (R.cls === 'str_passive' && R.loss) F.push(['bad', 'The ' + usd(R.loss) + ' loss is passive and the $25,000 allowance is only for rental activities, so none of it offsets your pay this year: ' + usd(R.taxLost) + ' of tax at ' + R.rate + '%. Log ' + hrs(R.need) + ' more hours by December 31' + (oth ? ' (and stay not less than ' + oth + ')' : '') + ' and it becomes ' + usd(R.loss * R.rate / 100) + ' saved.']);
    if (R.cls === 'str_mp' && R.loss) F.push(['ok', 'Material participation met: the ' + usd(R.loss) + ' loss offsets your other income, ' + usd(R.taxSaved) + ' at ' + R.rate + '%. Keep the log with dates and tasks.']);
    if (R.cls === 'rental' && R.loss) F.push([R.suspended ? 'bad' : 'ok', 'At MAGI ' + usd(R.magi) + ' the allowance is ' + usd(R.allow) + ': ' + usd(R.lossAllowed) + ' allowed, ' + usd(R.suspended) + ' suspended.']);
    if (R.home) F.push(['bad', R.personalDays + ' personal days is more than ' + R.allowed + ' (the greater of 14 or 10% of ' + R.rentalDays + ' rental days). ' + (R.ws ? usd(R.carryOp + R.carryDep) + ' of expenses carried to next year.' : 'Expenses are capped at rents if there is a loss.')]);
    else if (R.daysLeft < 5) F.push(['warn', 'Only ' + R.daysLeft + ' personal days left this year before the unit counts as your home.']);
    if (R.pct < 1) F.push(['info', 'Rental share ' + (R.pct * 100).toFixed(2) + '% (' + R.rentalDays + ' of ' + (R.rentalDays + R.personalDays) + ' days used). ' + usd(R.personalIT) + ' of interest and taxes is the personal part (Schedule A if you itemize).']);
    if (R.usedCarry) F.push(['ok', usd(R.usedCarry) + ' of last year\'s suspended loss used against this year\'s income.']);
    if (R.hours.noTask) F.push(['warn', R.hours.noTask + ' hour line(s) have no task written: write what you did.']);
    if (R.stays.overlap) F.push(['warn', R.stays.overlap + ' stay(s) overlap the one before: check the dates.']);
    if (R.stays.bad.length) F.push(['warn', 'Stay line(s) not read: ' + R.stays.bad.join(', ') + ' (use YYYY-MM-DD; YYYY-MM-DD; amount; who).']);
    if (R.hours.bad.length) F.push(['warn', 'Hour line(s) not read: ' + R.hours.bad.join(', ') + ' (use YYYY-MM-DD; who; hours; task).']);
    if (R.avg > 7 && R.avg <= 30) F.push(['info', 'Average over 7 but 30 or less: if you provide significant personal services it is also not a rental activity. That test is not checked here.']);
    return F;
  }
  function flagsHtml(R) { return flags(R).map(function (f) { return '<li class="' + f[0] + '">' + esc(f[1]) + '</li>'; }).join(''); }
  function schedE(R) {
    var L = [['1b', 'Type of property', '3 (vacation / short-term rental)'], ['2', 'Fair rental days', String(R.rentalDays)], ['2', 'Personal use days', String(R.personalDays)], ['3', 'Rents received', usd(R.exempt ? 0 : R.rents)]];
    EXP.slice().sort(function (a, b) { return +a[1] - +b[1]; }).forEach(function (e) { L.push([e[1], e[2], usd(R.exempt ? 0 : (R.lines[e[1]] || 0))]); });
    L.push(['20', 'Total expenses', usd(R.total)], ['21', 'Income or (loss)', usd(R.net)], ['22', 'Loss allowed this year (Form 8582)', usd(R.lossAllowed)]);
    return L;
  }
  function linesHtml(R) { return schedE(R).map(function (l) { return '<tr><td>' + esc(l[0]) + '</td><td>' + esc(l[1]) + '</td><td class="n">' + esc(l[2]) + '</td></tr>'; }).join(''); }
  function staysHtml(R) {
    return R.stays.list.map(function (s) { return '<tr><td>' + esc(s.inn) + '</td><td>' + esc(s.out) + '</td><td class="n">' + s.inYear + '</td><td>' + esc(s.who) + '</td><td class="n">' + usd(s.amount) + '</td></tr>'; }).join('');
  }
  function peopleHtml(R) {
    var rows = [['You (and spouse)', R.hours.own, R.mp ? 'meets a test' : 'short']].concat(R.hours.others.map(function (o) { return [o.name, o.h, o.h > R.hours.own ? 'more than you' : 'not more than you']; }));
    return rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td class="n">' + hrs(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('');
  }
  function summary(R) {
    return R.listing + ', ' + R.year + ': ' + R.periods + ' guest stays averaging ' + R.avg.toFixed(2) + ' nights, ' + R.personalDays + ' personal days (limit ' + R.allowed + '), your hours ' + hrs(R.hours.own) +
      (R.top ? ' vs ' + R.top.name + ' ' + hrs(R.top.h) : '') + '. Schedule E line 21 ' + usd(R.net) + ', allowed against other income ' + usd(R.lossAllowed) + ', carried on ' + usd(R.carryPass + R.carryOp + R.carryDep) + '.';
  }
  // Pro: printable pack (Schedule E worksheet + hours log + stays)
  function packHtml(R, v) {
    var log = String(v.hours || '').split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (l) { var p = split(l); return '<tr><td>' + esc(p[0]) + '</td><td>' + esc(p[1]) + '</td><td class="n">' + esc(p[2]) + '</td><td>' + esc(p[3] || '') + '</td></tr>'; }).join('');
    return '<h1>' + esc(R.listing) + ' · ' + R.year + '</h1><p>' + esc(summary(R)) + '</p><h2>Schedule E worksheet</h2><table>' + linesHtml(R) + '</table>' +
      (R.ws ? '<h2>Worksheet 5-1 (used as a home)</h2><table><tr><td>Rents</td><td class="n">' + usd(R.ws.l1) + '</td></tr><tr><td>Tier 1: interest, taxes (rental share), direct expenses</td><td class="n">' + usd(R.ws.t1) + '</td></tr><tr><td>Line 3</td><td class="n">' + usd(R.ws.l3) + '</td></tr><tr><td>Tier 2 operating allowed (of ' + usd(R.ws.t2) + ')</td><td class="n">' + usd(R.ws.op) + '</td></tr><tr><td>Tier 3 depreciation allowed (of ' + usd(R.ws.t3) + ')</td><td class="n">' + usd(R.ws.dep) + '</td></tr><tr><td>Carried to next year: operating / depreciation</td><td class="n">' + usd(R.ws.carryOp) + ' / ' + usd(R.ws.carryDep) + '</td></tr></table>' : '') +
      '<h2>Material participation hours</h2><table>' + peopleHtml(R) + '</table><table><tr><th>Date</th><th>Who</th><th>Hours</th><th>Task</th></tr>' + log + '</table>' +
      '<h2>Stays (' + R.stays.list.length + ')</h2><table><tr><th>In</th><th>Out</th><th>Nights in ' + R.year + '</th><th>Who</th><th>Amount</th></tr>' + staysHtml(R) + '</table>' +
      '<p class="small">Printed ' + new Date().toISOString().slice(0, 10) + ' from rental tracker. A calculation and record tool, not tax or legal advice.</p>';
  }
  function csvCell(x) { var s = String(x == null ? '' : x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(list) { // list of {name, R}
    var head = ['listing', 'year', 'guest_stays', 'avg_stay', 'fair_rental_days', 'personal_days', 'your_hours', 'top_other_hours', 'material_participation', 'rents', 'total_expenses', 'line_21', 'loss_allowed', 'suspended', 'carry_passive', 'carry_operating', 'carry_depreciation'];
    var rows = list.map(function (x) { var R = x.R; return [x.name, R.year, R.periods, R.avg.toFixed(2), R.rentalDays, R.personalDays, hrs(R.hours.own), R.top ? hrs(R.top.h) : 0, R.mp ? 'yes' : 'no', R.rents.toFixed(2), R.total.toFixed(2), R.net.toFixed(2), R.lossAllowed.toFixed(2), R.suspended.toFixed(2), R.carryPass.toFixed(2), R.carryOp.toFixed(2), R.carryDep.toFixed(2)]; });
    return [head].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }
  // Pro: bookings CSV import (header names like Start date / Check-in, Nights or End date, Gross earnings / Amount, Type)
  function importCsv(text) {
    var rows = [], cur = [], f = '', q = false, t = String(text || '');
    for (var i = 0; i < t.length; i++) { var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { cur.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; cur.push(f); rows.push(cur); cur = []; f = ''; } else f += c; }
    if (f || cur.length) { cur.push(f); rows.push(cur); }
    if (rows.length < 2) return { lines: [], skipped: 0 };
    var h = rows[0].map(function (x) { return x.trim().toLowerCase(); });
    function col(re) { for (var j = 0; j < h.length; j++) if (re.test(h[j])) return j; return -1; }
    var cS = col(/^(start date|check-?in|arrival|start)/), cE = col(/^(end date|check-?out|departure|end)/), cN = col(/^nights?$/), cA = [/^gross earnings/, /^gross/, /^(total|amount)/, /^payout/].reduce(function (a, re) { return a >= 0 ? a : col(re); }, -1), cT = col(/^type$/);
    function iso(s) { s = String(s || '').trim(); var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0]; m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2); return ''; }
    var out = [], skipped = 0;
    rows.slice(1).forEach(function (r) {
      if (!r.join('').trim()) return;
      if (cT >= 0 && r[cT] && !/reserv|booking|stay/i.test(r[cT])) { skipped++; return; }
      var a = iso(r[cS]), b = cE >= 0 ? iso(r[cE]) : '';
      if (a && !b && cN >= 0 && num(r[cN]) > 0) { var d = new Date((day(a) + num(r[cN])) * 864e5); b = d.toISOString().slice(0, 10); }
      if (!a || !b) { skipped++; return; }
      out.push(a + '; ' + b + '; ' + (cA >= 0 ? num(r[cA]).toFixed(2) : '0') + '; guest');
    });
    return { lines: out, skipped: skipped };
  }
  function reminders(year) { // our own check-ins + the two federal dates for the 2026 return
    var L = [[year + '-03-31', 'rental tracker: log Q1 hours and stays'], [year + '-06-30', 'rental tracker: log Q2 hours and stays'], [year + '-09-30', 'rental tracker: log Q3 hours and stays'],
      [year + '-12-01', 'rental tracker: hours still needed and personal days left before December 31']];
    if (year === 2026) L.push(['2027-01-15', '4th quarter 2026 estimated tax payment due'], ['2027-04-15', '2026 return (Schedule E) due']);
    return L;
  }
  function ics(year, stamp) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rental tracker//EN', 'CALSCALE:GREGORIAN'];
    reminders(year).forEach(function (d, i) {
      var dd = d[0].replace(/-/g, ''), nx = new Date((day(d[0]) + 1) * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:str-' + year + '-' + i + '@rental-tracker', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + dd, 'DTEND;VALUE=DATE:' + nx, 'SUMMARY:' + d[1],
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + d[1], 'TRIGGER:-P3D', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n') + '\r\n';
  }
  function closeYear(v, R) {
    var n = Object.assign({}, v); n.year = String(R.year + 1); n.stays = ''; n.hours = '';
    EXP.forEach(function (e) { n[e[0]] = ''; });
    n.carry_pass = R.carryPass.toFixed(2); n.carry_op = R.carryOp.toFixed(2); n.carry_dep = R.carryDep.toFixed(2);
    return n;
  }
  var API = { DEFAULTS: DEFAULTS, EXP: EXP, compute: compute, parseStays: parseStays, parseHours: parseHours, allowance25k: allowance25k, tiles: tiles, tilesHtml: tilesHtml,
    flags: flags, flagsHtml: flagsHtml, schedE: schedE, linesHtml: linesHtml, staysHtml: staysHtml, peopleHtml: peopleHtml, summary: summary, packHtml: packHtml,
    csv: csv, importCsv: importCsv, reminders: reminders, ics: ics, closeYear: closeYear, usd: usd, esc: esc, num: num, hrs: hrs };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.STR = API;
})(this);
