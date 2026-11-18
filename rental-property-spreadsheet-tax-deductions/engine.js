/* rental property spreadsheet | tax deduction tracker — engine (no network, no libraries) */
(function (root) {
  'use strict';
  var R2 = function (x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; };

  // Schedule E (Form 1040) expense lines
  var LINES = { 5: 'Advertising', 6: 'Auto and travel', 7: 'Cleaning and maintenance', 8: 'Commissions', 9: 'Insurance',
    10: 'Legal and other professional fees', 11: 'Management fees', 12: 'Mortgage interest paid to banks', 13: 'Other interest',
    14: 'Repairs', 15: 'Supplies', 16: 'Taxes', 17: 'Utilities', 18: 'Depreciation expense', 19: 'Other' };
  // type word → [kind, Schedule E line]
  var TYPES = { advertising: ['op', 5], travel: ['op', 6], auto: ['op', 6], cleaning: ['op', 7], commissions: ['op', 8], insurance: ['op', 9],
    legal: ['op', 10], professional: ['op', 10], management: ['op', 11], interest: ['op', 12], otherinterest: ['op', 13], supplies: ['op', 15],
    taxes: ['op', 16], tax: ['op', 16], utilities: ['op', 17], other: ['op', 19],
    repair: ['repair', 14], routine: ['routine', 14], improve: ['improve', 14], improvement: ['improve', 14],
    item: ['item', 19], appliance: ['item', 19], furniture: ['item', 19], carpet: ['item', 19], land: ['land', 19] };

  var DEFAULTS = {
    year: '2026', status: 'single', magi: '118,000', rate: '22', active: 'yes', prior: '0',
    owner: 'Chris Morgan (example)', property: '418 Alder Street, Boise, ID 83702',
    basis: '440,000', pis: '2021-07', afs: 'no', rents: '31,200',
    lines: [
      '2026-01-31; Mortgage interest (Form 1098); 14,880; interest',
      '2026-04-10; Property tax, first half; 2,605; taxes',
      '2026-11-10; Property tax, second half; 2,605; taxes',
      '2026-03-01; Landlord insurance policy; 1,740; insurance',
      '2026-02-10; Fix leaking kitchen faucet; 240; repair',
      '2026-04-03; HVAC annual service; 185; routine',
      '2026-05-22; Patch drywall and repaint after tenant; 1,150; repair',
      '2026-06-30; Dishwasher (new appliance); 780; item',
      '2026-08-14; Replace HVAC condenser and air handler; 5,900; improve'
    ].join('\n')
  };

  function num(s) { var t = String(s == null ? '' : s).replace(/[$,\s]/g, ''); if (t === '' || t === '-') return 0; var n = Number(t); return isFinite(n) ? n : NaN; }
  function usd(x) { var n = R2(Math.abs(x)), s = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (x < -0.004 ? '−$' : '$') + s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) { var p = String(iso).split('-'); return MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }

  // Residential rental property: 27.5 years, straight line, mid-month (Pub 527).
  // Year-1 % = (12 − month + 0.5) / 12 / 27.5, rounded to 3 decimals as in the IRS table (Feb 3.182 · May 2.273 · Aug 1.364);
  // years 2–9 = 3.636 % (Pub 527 example, year 6); from year 10 the remaining basis / remaining years.
  function firstYearPct(m) { return Math.round((12 - m + 0.5) / 12 / 27.5 * 100 * 1000) / 1000; }
  function bldgDep(basis, pisY, pisM, year) {
    if (!(basis > 0) || !(pisY > 0) || year < pisY) return { dep: 0, n: 0, pct: 0 };
    var n = year - pisY + 1, cum = basis * firstYearPct(pisM) / 100;
    if (n === 1) return { dep: R2(cum), n: 1, pct: firstYearPct(pisM) };
    var y; for (y = 2; y < n && y <= 9; y++) cum += basis * 0.03636;
    if (n <= 9) return { dep: R2(Math.min(basis * 0.03636, basis - cum)), n: n, pct: 3.636 };
    var left = basis - cum - (n - 10) * basis / 27.5;
    return { dep: R2(Math.max(0, Math.min(left, basis / 27.5))), n: n, pct: null };
  }

  function parseLines(text, year) {
    var out = [], bad = [];
    String(text || '').split(/\r?\n/).forEach(function (raw, i) {
      var s = raw.trim(); if (!s) return;
      var p = s.split(/\s*[;\t|]\s*/);
      if (p.length < 4) { bad.push({ line: i + 1, why: 'needs 4 parts: date; what; amount; type', text: s }); return; }
      var date = p[0], amt = num(p[p.length - 2]), tw = String(p[p.length - 1]).toLowerCase().replace(/[^a-z]/g, ''), desc = p.slice(1, p.length - 2).join('; ');
      var t = TYPES[tw];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { bad.push({ line: i + 1, why: 'date must be YYYY-MM-DD', text: s }); return; }
      if (!isFinite(amt) || amt <= 0) { bad.push({ line: i + 1, why: 'amount is not a number above 0', text: s }); return; }
      if (!t) { bad.push({ line: i + 1, why: 'type "' + tw + '" not known', text: s }); return; }
      if (+date.slice(0, 4) !== year) { bad.push({ line: i + 1, why: 'paid in ' + date.slice(0, 4) + ', not in ' + year, text: s }); return; }
      out.push({ date: date, month: +date.slice(5, 7), desc: desc, amt: R2(amt), kind: t[0], line: t[1], type: tw });
    });
    return { rows: out, bad: bad };
  }

  function allowance(status, magi, active) {
    if (active !== 'yes') return { max: 0, allow: 0, why: 'no active participation: no special allowance' };
    var max = 25000, start = 100000;
    if (status === 'mfs_apart') { max = 12500; start = 50000; }
    if (status === 'mfs_together') return { max: 0, allow: 0, why: 'married filing separately and lived together: no special allowance' };
    var a = Math.max(0, max - 0.5 * Math.max(0, magi - start));
    return { max: max, allow: R2(a), why: 'up to ' + usd(max) + ' − 50% of MAGI over ' + usd(start) };
  }

  function passive(net, prior, al) {
    var combined = R2(net - prior);
    if (combined >= 0) return { combined: combined, taxable: combined, allowed: 0, carry: 0, loss: 0 };
    var L = -combined, allowed = R2(Math.min(L, al.allow));
    return { combined: combined, taxable: -allowed, allowed: allowed, carry: R2(L - allowed), loss: L };
  }

  // one pass of Schedule E for a set of choices
  function schedE(rows, o) {
    var by = {}, k, cap = [], dep = o.bldg + (o.assetsDep || 0);
    for (k in LINES) by[k] = 0;
    rows.forEach(function (r) {
      var d = r.decision = { how: '', line: r.line, now: 0, later: 0 };
      if (r.kind === 'op') { d.how = 'deduct'; d.now = r.amt; }
      else if (r.kind === 'repair') { d.how = 'repair: deduct'; d.now = r.amt; }
      else if (r.kind === 'routine') { d.how = o.routine ? 'routine maintenance safe harbor: deduct' : 'deduct as maintenance'; d.now = r.amt; }
      else if (r.kind === 'improve') {
        if (o.shst) { d.how = 'small taxpayer safe harbor: deduct'; d.now = r.amt; d.line = 14; }
        else { var p = firstYearPct(r.month), x = R2(r.amt * p / 100); d.how = 'capitalize, 27.5 years from ' + MON[r.month - 1] + ' (' + p.toFixed(3) + '% this year)'; d.later = R2(r.amt - x); d.line = 18; d.dep = x; dep += x; cap.push({ desc: r.desc, amt: r.amt, pis: r.date.slice(0, 7), life: 27.5 }); }
      }
      else if (r.kind === 'item' || r.kind === 'land') {
        var life = r.kind === 'item' ? 5 : 15;
        if (o.dm && r.amt <= o.dmLimit) { d.how = 'de minimis safe harbor: deduct'; d.now = r.amt; d.line = 19; }
        else { d.how = life + '-year property, 100% bonus depreciation (acquired after January 19, 2025)'; d.line = 18; d.dep = r.amt; dep += r.amt; cap.push({ desc: r.desc, amt: r.amt, pis: r.date.slice(0, 7), life: life, bonus: true }); }
      }
      if (d.line !== 18) by[d.line] = R2(by[d.line] + d.now);
    });
    by[18] = R2(dep);
    var total = 0; for (k in by) total += by[k];
    total = R2(total);
    return { by: by, total: total, net: R2(o.rents - total), cap: cap, dep: R2(dep) };
  }

  // depreciation this year of improvements capitalized in earlier years (Pro carry-over)
  function assetsDep(assets, year) {
    var s = 0; (assets || []).forEach(function (a) {
      if (a.bonus || a.life !== 27.5) return;
      var p = String(a.pis).split('-'); s += bldgDep(a.amt, +p[0], +p[1], year).dep;
    });
    return R2(s);
  }

  function compute(v, assets) {
    var year = parseInt(v.year, 10) || 2026, basis = num(v.basis), rents = num(v.rents), magi = num(v.magi), rate = num(v.rate), prior = Math.abs(num(v.prior)) || 0;
    var pp = String(v.pis || '').match(/^(\d{4})-(\d{1,2})$/), pisY = pp ? +pp[1] : 0, pisM = pp ? +pp[2] : 0;
    var P = parseLines(v.lines, year), rows = P.rows, warn = [];
    if (!pp || pisM < 1 || pisM > 12) warn.push('Building placed in service: type it as YYYY-MM (for example 2021-07).');
    [['basis', basis], ['rents', rents], ['magi', magi], ['rate', rate]].forEach(function (x) { if (!isFinite(x[1])) warn.push('The ' + x[0] + ' field is not a number.'); });
    if (!isFinite(basis)) basis = 0; if (!isFinite(rents)) rents = 0; if (!isFinite(magi)) magi = 0; if (!isFinite(rate)) rate = 0;
    var dmLimit = v.afs === 'yes' ? 5000 : 2500;
    var B = bldgDep(basis, pisY, pisM, year), aDep = assetsDep(assets, year);
    var shstCap = R2(Math.min(10000, basis * 0.02)), shstBase = 0, nImp = 0, imp = 0;
    rows.forEach(function (r) { if (r.kind === 'repair' || r.kind === 'routine' || r.kind === 'improve') shstBase += r.amt; if (r.kind === 'improve') { nImp++; imp += r.amt; } });
    shstBase = R2(shstBase); imp = R2(imp);
    var shstOk = basis > 0 && basis <= 1000000 && shstBase <= shstCap;
    var base = { rents: rents, bldg: B.dep, assetsDep: aDep, dmLimit: dmLimit, routine: true };
    var W = schedE(rows.map(function (r) { return Object.assign({}, r); }), Object.assign({ shst: shstOk, dm: true }, base));
    var N = schedE(rows.map(function (r) { return Object.assign({}, r); }), Object.assign({ shst: false, dm: false }, base));
    var shown = schedE(rows, Object.assign({ shst: shstOk, dm: true }, base));
    var al = allowance(v.status, magi, v.active), pw = passive(W.net, prior, al), pn = passive(N.net, prior, al);
    var moved = R2(W.total - N.total); // deductions this year gained by the elections
    var taxKept = R2(Math.max(0, (pn.taxable - pw.taxable)) * rate / 100);
    var dmItems = rows.filter(function (r) { return (r.kind === 'item' || r.kind === 'land') && r.amt <= dmLimit; });
    if (basis > 1000000) warn.push('Building basis over $1,000,000: the small taxpayer safe harbor is not available.');
    if (year === pisY && pisM) warn.push('The building was placed in service this year: first-year rate ' + firstYearPct(pisM).toFixed(3) + '% (mid-month).');
    if (B.n > 9) warn.push('Year ' + B.n + ' of the building: from year 10 the page spreads the remaining basis evenly; the IRS table alternates 3.636% and 3.637%, so your software may differ by a few dollars.');
    var due = year + 1;
    return {
      year: year, basis: basis, rents: rents, magi: magi, rate: rate, prior: prior, rows: rows, bad: P.bad, warn: warn,
      bldg: B, assetsDep: aDep, dmLimit: dmLimit, dmItems: dmItems,
      shst: { cap: shstCap, base: shstBase, ok: shstOk, over: R2(Math.max(0, shstBase - shstCap)), room: R2(Math.max(0, shstCap - shstBase)), imp: imp, nImp: nImp, two: R2(basis * 0.02) },
      with: W, without: N, pw: pw, pn: pn, al: al, moved: moved, taxKept: taxKept,
      returnDue: due + '-04-15', extDue: due + '-10-15', cap: shown.cap, owner: v.owner || '', property: v.property || ''
    };
  }

  function tiles(R) {
    var S = R.shst, t = [];
    t.push({ c: S.ok ? 'good' : (S.imp ? 'bad' : ''), l: 'Small taxpayer safe harbor', b: S.ok ? 'fits: ' + usd(S.base) : (R.basis > 1000000 ? 'not available' : 'over by ' + usd(S.over)),
      s: 'cap ' + usd(S.cap) + ' = lesser of 2% of ' + usd(R.basis) + ' or $10,000 · repairs + maintenance + improvements ' + usd(S.base) });
    t.push({ c: R.moved > 0 ? 'good' : '', l: 'Deducted this year, not over 27.5 years', b: usd(R.moved), s: R.moved > 0 ? 'with the safe harbor statements on your ' + R.year + ' return' : (S.imp ? 'improvements stay capitalized' : 'no improvement this year') });
    t.push({ c: R.taxKept > 0 ? 'bad' : '', l: 'Tax lost if the statements are missing', b: usd(R.taxKept), s: R.taxKept > 0 ? usd(R.pn.taxable - R.pw.taxable) + ' × ' + R.rate + '% · attach by ' + longDate(R.returnDue) + ' (' + longDate(R.extDue) + ' extended)' : (R.moved > 0 ? 'this year the extra deduction only adds to the loss carried forward' : 'nothing moves this year') });
    t.push({ c: R.with.net < 0 ? 'warn' : '', l: 'Schedule E line 21', b: usd(R.with.net), s: usd(R.rents) + ' rents − ' + usd(R.with.total) + ' expenses (incl. ' + usd(R.with.by[18]) + ' depreciation)' });
    t.push({ c: '', l: R.pw.loss ? 'Loss allowed against your salary' : 'Taxable rental income', b: usd(R.pw.loss ? R.pw.allowed : R.pw.taxable), s: R.pw.loss ? 'special allowance ' + usd(R.al.allow) + ' at MAGI ' + usd(R.magi) : (R.prior ? 'after ' + usd(R.prior) + ' carried in' : 'no passive loss limit needed') });
    t.push({ c: R.pw.carry > 0 ? 'warn' : '', l: 'Loss carried to ' + (R.year + 1), b: usd(R.pw.carry), s: R.pw.carry > 0 ? 'Form 8582: suspended, usable later' : 'nothing suspended' });
    return t;
  }
  function tilesHtml(R) { return tiles(R).map(function (x) { return '<div class="tile ' + x.c + '"><span>' + esc(x.l) + '</span><b>' + esc(x.b) + '</b><small>' + esc(x.s) + '</small></div>'; }).join(''); }

  function rowsHtml(R) {
    return R.rows.map(function (r) {
      var d = r.decision, cls = /capitalize|bonus/.test(d.how) ? 'cap' : (/safe harbor/.test(d.how) ? 'sh' : '');
      return '<tr class="' + cls + '"><td>' + esc(r.date) + '</td><td>' + esc(r.desc) + '<small>' + esc(r.type) + '</small></td><td class="num">' + usd(r.amt) + '</td><td>' + esc(d.how) + '</td><td class="num">' + usd(d.line === 18 ? d.dep : d.now) + '</td><td>' + d.line + '</td></tr>';
    }).join('') + R.bad.map(function (b) { return '<tr class="err"><td colspan="6">Line ' + b.line + ' skipped: ' + esc(b.why) + ' · <code>' + esc(b.text) + '</code></td></tr>'; }).join('');
  }
  function linesHtml(R) {
    var h = '<tr><td>3</td><td>Rents received</td><td class="num">' + usd(R.rents) + '</td><td class="num">' + usd(R.rents) + '</td></tr>';
    for (var k = 5; k <= 19; k++) { var a = R.with.by[k], b = R.without.by[k]; if (a || b) h += '<tr><td>' + k + '</td><td>' + LINES[k] + '</td><td class="num">' + usd(a) + '</td><td class="num">' + usd(b) + '</td></tr>'; }
    h += '<tr class="tot"><td>20</td><td>Total expenses</td><td class="num">' + usd(R.with.total) + '</td><td class="num">' + usd(R.without.total) + '</td></tr>';
    h += '<tr class="tot"><td>21</td><td>Income or (loss)</td><td class="num">' + usd(R.with.net) + '</td><td class="num">' + usd(R.without.net) + '</td></tr>';
    return h;
  }
  function flags(R) {
    var f = [], S = R.shst;
    if (S.ok && S.imp) f.push(['bad', 'Attach the "Section 1.263(a)-3(h) Safe Harbor Election for Small Taxpayers" statement for ' + (R.property || 'this building') + ' to your ' + R.year + ' return, filed by ' + longDate(R.returnDue) + ' (with extension ' + longDate(R.extDue) + '). Without it the ' + usd(S.imp) + ' of improvements is depreciated over 27.5 years.']);
    if (!S.ok && S.imp && R.basis <= 1000000) f.push(['bad', 'Repairs, maintenance and improvements total ' + usd(S.base) + ', over the ' + usd(S.cap) + ' cap by ' + usd(S.over) + ': the safe harbor needs the whole year\'s total at or under the cap, so the ' + usd(S.imp) + ' of improvements is capitalized. Moving a planned job into January keeps it in next year\'s total instead.']);
    if (S.ok && !S.imp && S.base) f.push(['', 'Room left under the small taxpayer cap this year: ' + usd(S.room) + '. An improvement paid by December 31 up to that amount can still be deducted with the election.']);
    if (R.dmItems.length) f.push(['', 'De minimis safe harbor: ' + R.dmItems.length + ' item(s) at or under ' + usd(R.dmLimit) + ' each are deducted. Attach the "Section 1.263(a)-1(f) de minimis safe harbor election" statement; it covers every item under the limit that year.']);
    if (R.pw.carry > 0) f.push(['', usd(R.pw.carry) + ' of loss is suspended (Form 8582) and carries to ' + (R.year + 1) + '. Keep that number: it offsets future rental income or comes back when you sell.']);
    if (R.moved > 0 && R.taxKept === 0) f.push(['', 'The passive loss limit already caps this year: the safe harbor still adds ' + usd(R.moved) + ' to your deductions, which shows up as a larger loss carried forward.']);
    R.warn.forEach(function (w) { f.push(['', w]); });
    return f;
  }
  function flagsHtml(R) { return flags(R).map(function (x) { return '<li class="' + x[0] + '">' + esc(x[1]) + '</li>'; }).join(''); }
  function summary(R) {
    return (R.property || 'Your rental') + ', ' + R.year + ': rents ' + usd(R.rents) + ', expenses ' + usd(R.with.total) + ', Schedule E line 21 ' + usd(R.with.net) + '. Small taxpayer safe harbor: ' + usd(R.shst.base) + ' against a ' + usd(R.shst.cap) + ' cap (' + (R.shst.ok ? 'fits' : 'does not fit') + '). Deducted this year thanks to the elections: ' + usd(R.moved) + '; tax at ' + R.rate + '% if the statements are missing: ' + usd(R.taxKept) + '. Loss allowed ' + usd(R.pw.allowed) + ', carried to ' + (R.year + 1) + ': ' + usd(R.pw.carry) + '.';
  }

  // ---- Pro outputs ----
  function statementsHtml(R) {
    var who = esc(R.owner || '[your name]'), h = '<section class="stmt"><p class="small">Attach to Form 1040 for ' + R.year + ' · Name: ' + who + ' · SSN/ITIN: ____________ · Address of the property: ' + esc(R.property) + '</p>';
    if (R.shst.ok && R.shst.base) h += '<h3>Section 1.263(a)-3(h) Safe Harbor Election for Small Taxpayers</h3><p>' + who + ' hereby elects to apply the safe harbor election for small taxpayers under Treas. Reg. § 1.263(a)-3(h) for the taxable year ' + R.year + ' for the following building property: ' + esc(R.property) + ' (unadjusted basis ' + usd(R.basis) + '). Amounts paid in ' + R.year + ' for repairs, maintenance, improvements and similar activities: ' + usd(R.shst.base) + ', not more than ' + usd(R.shst.cap) + '.</p>';
    if (R.dmItems.length) h += '<h3>Section 1.263(a)-1(f) de minimis safe harbor election</h3><p>' + who + ' hereby elects to apply the de minimis safe harbor under Treas. Reg. § 1.263(a)-1(f) for the taxable year ' + R.year + '.</p>';
    if (!(R.shst.ok && R.shst.base) && !R.dmItems.length) h += '<p>No safe harbor election is needed for these numbers.</p>';
    return h + '<h3>Schedule E worksheet, ' + esc(R.property) + '</h3><table class="res"><thead><tr><th>Line</th><th></th><th>With elections</th><th>Without</th></tr></thead><tbody>' + linesHtml(R) + '</tbody></table><table class="res"><thead><tr><th>Date</th><th>Expense</th><th>Amount</th><th>Treatment</th><th>This year</th><th>Line</th></tr></thead><tbody>' + rowsHtml(R) + '</tbody></table></section>';
  }
  function csvCell(x) { var s = String(x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(props) {
    var out = ['property,year,line,description,amount'];
    props.forEach(function (p) {
      var R = p.R; out.push([p.name, R.year, 3, 'Rents received', R.rents.toFixed(2)].map(csvCell).join(','));
      for (var k = 5; k <= 19; k++) if (R.with.by[k]) out.push([p.name, R.year, k, LINES[k], R.with.by[k].toFixed(2)].map(csvCell).join(','));
      out.push([p.name, R.year, 20, 'Total expenses', R.with.total.toFixed(2)].map(csvCell).join(','));
      out.push([p.name, R.year, 21, 'Income or (loss)', R.with.net.toFixed(2)].map(csvCell).join(','));
    });
    return out.join('\r\n') + '\r\n';
  }
  function ledgerCsv(R) {
    return ['date,description,type,amount,treatment,this_year,schedule_e_line'].concat(R.rows.map(function (r) {
      var d = r.decision; return [r.date, r.desc, r.type, r.amt.toFixed(2), d.how, (d.line === 18 ? d.dep : d.now).toFixed(2), d.line].map(csvCell).join(',');
    })).join('\r\n') + '\r\n';
  }
  // next business day after weekends and the DC Emancipation Day / federal holidays that can land on these dates
  function nthMon(y, m, n) { var d = new Date(Date.UTC(y, m - 1, 1)), w = d.getUTCDay(), first = 1 + ((8 - w) % 7); return first + 7 * (n - 1); }
  function isHoliday(y, m, d) {
    var dt = new Date(Date.UTC(y, m - 1, d)), w = dt.getUTCDay();
    if (m === 1 && d === nthMon(y, 1, 3)) return true;
    if (m === 1 && (d === 1 || (d === 2 && w === 1))) return true;
    if (m === 4) { var e = new Date(Date.UTC(y, 3, 16)).getUTCDay(), obs = e === 6 ? 15 : (e === 0 ? 17 : 16); if (d === obs) return true; }
    if (m === 6 && (d === 19 || (d === 18 && w === 5) || (d === 20 && w === 1))) return true;
    if (m === 9 && d === nthMon(y, 9, 1)) return true;
    if (m === 10 && d === nthMon(y, 10, 2)) return true;
    return false;
  }
  function roll(iso) {
    var p = iso.split('-').map(Number), dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    for (;;) { var w = dt.getUTCDay(); if (w !== 0 && w !== 6 && !isHoliday(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())) break; dt.setUTCDate(dt.getUTCDate() + 1); }
    return dt.toISOString().slice(0, 10);
  }
  function deadlines(year) {
    var n = year + 1;
    return [[roll(n + '-01-15'), 'Estimated tax, 4th payment for ' + year + ' (Form 1040-ES)'],
      [roll(n + '-04-15'), year + ' return due: attach the safe harbor election statements'],
      [roll(n + '-04-15'), 'Estimated tax, 1st payment for ' + n],
      [roll(n + '-06-15'), 'Estimated tax, 2nd payment for ' + n],
      [roll(n + '-09-15'), 'Estimated tax, 3rd payment for ' + n],
      [roll(n + '-10-15'), year + ' return due with extension: last day to attach the election statements'],
      [n + '-12-01', 'Small taxpayer safe harbor: check the room left under this year\'s cap before paying for repairs in December']];
  }
  function ics(year, stamp) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rental property spreadsheet//EN', 'CALSCALE:GREGORIAN'];
    deadlines(year).forEach(function (d, i) {
      var day = d[0].replace(/-/g, ''), nx = new Date(Date.UTC(+d[0].slice(0, 4), +d[0].slice(5, 7) - 1, +d[0].slice(8, 10) + 1)).toISOString().slice(0, 10).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:rps-' + year + '-' + i + '-' + day + '@rental-property-spreadsheet', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + day, 'DTEND;VALUE=DATE:' + nx,
        'SUMMARY:' + d[1].replace(/[,;]/g, ' '), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + d[1].replace(/[,;]/g, ' '), 'TRIGGER:-P7D', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n') + '\r\n';
  }
  // close the year: next year's inputs + the asset list that keeps depreciating
  function closeYear(v, R, assets) {
    var n = Object.assign({}, v); n.year = String(R.year + 1); n.prior = R.pw.carry.toFixed(2); n.lines = '';
    var list = (assets || []).concat(R.cap.filter(function (a) { return a.life === 27.5; }));
    return { v: n, assets: list };
  }

  var API = { DEFAULTS: DEFAULTS, LINES: LINES, compute: compute, parseLines: parseLines, bldgDep: bldgDep, firstYearPct: firstYearPct, allowance: allowance,
    tilesHtml: tilesHtml, tiles: tiles, rowsHtml: rowsHtml, linesHtml: linesHtml, flags: flags, flagsHtml: flagsHtml, summary: summary,
    statementsHtml: statementsHtml, csv: csv, ledgerCsv: ledgerCsv, ics: ics, deadlines: deadlines, roll: roll, closeYear: closeYear, usd: usd, esc: esc, longDate: longDate, num: num };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.RPS = API;
})(this);
