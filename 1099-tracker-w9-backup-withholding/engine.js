/* 1099 tracker engine: contractor payments, W-9 status, $2,000 line, 24% backup withholding.
   Pure functions (browser: window.T1099 · node: module.exports). No network. */
(function (root) {
  'use strict';
  var RATE = 0.24;
  var YEARS = {
    '2026': { thr: 2000, due: '2027-02-01', due945: '2027-02-01', due945dep: '2027-02-10', label: '2026 ($2,000 line)' },
    '2025': { thr: 600, due: '2026-02-02', due945: '2026-02-02', due945dep: '2026-02-10', label: '2025 ($600 line)' }
  };
  var K_METHODS = /^(card|credit|debit|credit card|debit card|paypal|venmo|cash ?app|stripe|square|etsy|upwork|fiverr)/i;
  var TYPES = { individual: 'Individual / sole proprietor', llc: 'LLC (not taxed as a corporation)', partnership: 'Partnership',
    corp: 'Corporation (C or S)', attorney: 'Attorney / law firm' };

  var DEFAULTS = {
    year: '2026',
    payer_name: 'Maple & Rye Bakery LLC (example)',
    contractors: [
      'Ana Ruiz; individual; 2026-01-10; no',
      'Ben Cole; individual; ; no',
      'Cora Diaz Studio LLC; llc; 2026-08-01; no',
      'Dev Patel; individual; ; yes',
      'Eli Brooks; individual; ; no'
    ].join('\n'),
    payments: [
      '2026-02-12; Ana Ruiz; 1,200.00; check',
      '2026-07-08; Ana Ruiz; 1,400.00; ACH',
      '2026-03-05; Ben Cole; 900.00; check',
      '2026-06-10; Ben Cole; 800.00; check',
      '2026-09-15; Ben Cole; 1,200.00; ACH',
      '2026-11-02; Ben Cole; 1,500.00; check',
      '2026-02-01; Cora Diaz Studio LLC; 1,500.00; check',
      '2026-05-01; Cora Diaz Studio LLC; 1,500.00; check',
      '2026-09-01; Cora Diaz Studio LLC; 1,500.00; ACH',
      '2026-04-20; Dev Patel; 900.00; Zelle',
      '2026-10-12; Dev Patel; 1,300.00; check',
      '2026-08-20; Eli Brooks; 2,500.00; PayPal'
    ].join('\n'),
    next_who: 'Ben Cole',
    next_date: '2026-12-01',
    next_amt: '1,000.00'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(s) { var n = parseFloat(String(s == null ? '' : s).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; }
  function c2(n) { return Math.round(n * 100 + 1e-9) / 100; }
  function fmt(n) { return c2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function usd(n) { return '$' + fmt(n); }
  function usd0(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function isoOk(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)); }
  function longDate(d) { if (!isoOk(d)) return d; var p = d.split('-'); var M = ['January','February','March','April','May','June','July','August','September','October','November','December']; return M[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }
  function key(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function yes(s) { return /^(y|yes|true|1|x)/i.test(String(s || '').trim()); }

  function parseContractors(txt) {
    var out = [], seen = {};
    String(txt || '').split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim()) return;
      var f = line.split(';').map(function (x) { return x.trim(); });
      var t = key(f[1]); if (!TYPES[t]) t = /corp|inc\b/.test(t) ? 'corp' : /attor|law/.test(t) ? 'attorney' : /partner/.test(t) ? 'partnership' : /llc/.test(t) ? 'llc' : 'individual';
      var w9 = (f[2] || '').slice(0, 10);
      var c = { name: f[0], k: key(f[0]), type: t, w9: isoOk(w9) ? w9 : '', w9raw: f[2] || '', prior: yes(f[3]), line: i + 1 };
      if (!c.k || seen[c.k]) return; seen[c.k] = 1; out.push(c);
    });
    return out;
  }
  function parsePayments(txt) {
    var out = [], bad = [];
    String(txt || '').split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim()) return;
      var f = line.split(';').map(function (x) { return x.trim(); });
      var d = (f[0] || '').slice(0, 10), amt = num(f[2]);
      if (!isoOk(d) || !f[1] || !(amt > 0)) { bad.push(i + 1); return; }
      out.push({ date: d, who: f[1], k: key(f[1]), amt: c2(amt), method: f[3] || 'check', withheld: c2(num(f[4])), line: i + 1 });
    });
    return { list: out, bad: bad };
  }

  /* Treas. Reg. 31.3406(b)(3)-1(b)(3): the payment that brings the year's total to the line and every later payment are subject;
     the wait does not apply if a 1099 was required for this payee for the preceding year. Rate 24% (IRS General Instructions, part N). */
  function compute(v) {
    v = v || {};
    var year = YEARS[v.year] ? String(v.year) : '2026', Y = YEARS[year], thr = Y.thr;
    var C = parseContractors(v.contractors), P = parsePayments(v.payments);
    var byK = {}; C.forEach(function (c) { byK[c.k] = c; c.pays = []; c.counted = 0; c.kAmt = 0; c.subjectAmt = 0; c.owed = 0; c.withheld = 0; c.cross = ''; c.exposed = []; });
    var unknown = [], outYear = [];
    P.list.forEach(function (p) {
      if (p.date.slice(0, 4) !== year) { outYear.push(p); return; }
      var c = byK[p.k]; if (!c) { unknown.push(p); return; }
      c.pays.push(p);
    });
    var totalOwed = 0, forms = [], missing = [], kTotal = 0, monthly = {};
    C.forEach(function (c) {
      c.pays.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.line - b.line; });
      var run = 0;
      c.pays.forEach(function (p) {
        p.isK = K_METHODS.test(p.method);
        if (p.isK) { c.kAmt = c2(c.kAmt + p.amt); kTotal += p.amt; p.status = 'k'; return; }
        run = c2(run + p.amt); p.ytd = run; c.counted = run;
        if (c.type === 'corp') { p.status = 'exempt'; return; }
        var subject = c.prior || run >= thr;
        if (subject && !c.cross) c.cross = p.date;
        var tin = c.w9 && c.w9 <= p.date;
        if (!subject) { p.status = 'under'; return; }
        if (tin) { p.status = 'ok'; return; }
        var due = c2(p.amt * RATE), owe = c2(Math.max(0, due - p.withheld));
        p.due = due; p.owe = owe; p.status = owe > 0 ? 'owe' : 'held';
        c.subjectAmt = c2(c.subjectAmt + p.amt); c.owed = c2(c.owed + owe); c.withheld = c2(c.withheld + p.withheld);
        if (owe > 0) c.exposed.push(p);
        var m = p.date.slice(0, 7); monthly[m] = c2((monthly[m] || 0) + due);
      });
      c.needForm = c.type !== 'corp' && (c.counted >= thr || c.withheld > 0);
      c.needW9 = c.type !== 'corp' && c.counted > 0 && !c.w9;
      if (c.needForm) forms.push(c);
      if (c.needW9) missing.push(c);
      totalOwed = c2(totalOwed + c.owed);
    });
    var paid = C.filter(function (c) { return c.pays.length; });
    var next = nextCheck(v, C, byK, thr, year);
    var dueBW = 0; Object.keys(monthly).forEach(function (m) { dueBW = c2(dueBW + monthly[m]); });
    var R = { year: year, thr: thr, Y: Y, payer: v.payer_name || 'Your business', contractors: C, paid: paid, forms: forms, missing: missing,
      owed: totalOwed, kTotal: c2(kTotal), unknown: unknown, outYear: outYear, bad: P.bad, next: next, monthly: monthly, dueBW: dueBW,
      deposits: dueBW >= 2500 ? 'deposit' : 'with945' };
    R.summary = summary(R);
    return R;
  }

  function nextCheck(v, C, byK, thr, year) {
    var who = key(v.next_who), d = String(v.next_date || '').slice(0, 10), amt = c2(num(v.next_amt));
    var c = byK[who];
    if (!c || !isoOk(d) || !(amt > 0)) return { ok: false, msg: 'Pick a contractor from your list, a date and an amount.' };
    var before = 0; c.pays.forEach(function (p) { if (!p.isK && p.date <= d) before = c2(before + p.amt); });
    var after = c2(before + amt), r = { ok: true, who: c.name, date: d, amt: amt, before: before, after: after, hold: 0, send: amt };
    if (d.slice(0, 4) !== year) { r.msg = 'This date is outside tax year ' + year + '.'; r.kind = 'info'; return r; }
    if (c.type === 'corp') { r.kind = 'ok'; r.msg = 'Corporation: no backup withholding and no 1099-NEC. Send ' + usd(amt) + '.'; return r; }
    var tin = c.w9 && c.w9 <= d, subject = c.prior || after >= thr;
    if (tin) { r.kind = 'ok'; r.msg = 'W-9 on file since ' + c.w9 + ': send the full ' + usd(amt) + '.'; return r; }
    if (!subject) { r.kind = 'warn'; r.room = c2(thr - after); r.msg = 'No W-9, but the year stays under the ' + usd0(thr) + ' line (' + usd(after) + '). Send ' + usd(amt) + '; get the W-9 before you pay ' + usd(r.room) + ' more.'; return r; }
    r.hold = c2(amt * RATE); r.send = c2(amt - r.hold); r.kind = 'bad';
    r.msg = 'No W-9 on file' + (c.prior ? ' and you had to file a 1099 for this contractor last year, so the wait for the line does not apply' : ' and this payment brings the year to ' + usd(after)) + ': hold back 24% = ' + usd(r.hold) + ' and send ' + usd(r.send) + ', or get a signed W-9 before you pay.';
    return r;
  }

  function summary(R) {
    var s = R.payer + ', tax year ' + R.year + ': ' + R.forms.length + ' of ' + R.paid.length + ' contractors need a 1099-NEC (line ' + usd0(R.thr) + '). ';
    if (R.owed > 0) {
      s += 'Backup withholding not held: ' + usd(R.owed) + ' (24% of ' + usd(R.contractors.reduce(function (a, c) { return a + c.subjectAmt; }, 0)) + ' paid with no W-9 on file: ' +
        R.contractors.filter(function (c) { return c.owed > 0; }).map(function (c) { return c.name + ' ' + usd(c.owed); }).join(', ') + '). You can be liable for that amount yourself; it is reported on Form 945, due ' + longDate(R.Y.due945) + '. ';
    } else s += 'No payment needed backup withholding. ';
    if (R.missing.length) s += 'W-9 missing: ' + R.missing.map(function (c) { return c.name; }).join(', ') + '. ';
    if (R.kTotal > 0) s += usd(R.kTotal) + ' paid by card or payment app is left to Form 1099-K. ';
    if (R.next.ok && R.next.kind === 'bad') s += 'Next payment to ' + R.next.who + ' (' + usd(R.next.amt) + '): hold ' + usd(R.next.hold) + ', send ' + usd(R.next.send) + '. ';
    s += '1099-NEC due ' + longDate(R.Y.due) + '.';
    return s;
  }

  function tilesHtml(R) {
    var n = R.next, t = [];
    t.push(['bad', 'Backup withholding not held (24%)', usd(R.owed)]);
    t.push([n.ok && n.kind === 'bad' ? 'warn' : 'good', n.ok ? 'Next payment to ' + esc(n.who) + ': hold back' : 'Next payment: hold back', n.ok ? usd(n.hold) : '—']);
    t.push(['', '1099-NEC forms needed', R.forms.length + ' of ' + R.paid.length]);
    t.push([R.missing.length ? 'bad' : 'good', 'Contractors with no W-9', String(R.missing.length)]);
    t.push(['', 'Form 945 and 1099-NEC due', longDate(R.Y.due945)]);
    return t.map(function (x) { return '<div class="tile ' + x[0] + '"><span>' + x[1] + '</span><b>' + x[2] + '</b></div>'; }).join('');
  }
  var ST = { ok: ['W-9 on file', ''], under: ['under the line', ''], owe: ['24% not held', 'bad'], held: ['24% held', ''], k: ['card/app: 1099-K', 'skip'], exempt: ['corporation', 'skip'] };
  function rowsHtml(R) {
    var h = '';
    R.contractors.forEach(function (c) {
      if (!c.pays.length) return;
      h += '<tr class="grp"><td colspan="6"><b>' + esc(c.name) + '</b> <small>' + TYPES[c.type] + ' · W-9: ' + (c.w9 ? 'received ' + c.w9 : c.type === 'corp' ? 'not needed for this check' : '<span class="badtxt">none</span>') +
        (c.prior ? ' · 1099 filed for last year: no wait for the line' : '') + ' · year total ' + usd(c.counted) + (c.cross ? ' · subject from ' + c.cross : '') + '</small></td></tr>';
      c.pays.forEach(function (p) {
        var s = ST[p.status] || ['', ''];
        h += '<tr class="' + s[1] + '"><td>' + p.date + '</td><td>' + esc(p.method) + '</td><td>' + usd(p.amt) + '</td><td>' + (p.isK ? '—' : usd(p.ytd)) + '</td><td>' + s[0] + '</td><td>' + (p.status === 'owe' ? '<b>' + usd(p.owe) + '</b>' : p.status === 'held' ? usd(p.withheld) + ' held' : '—') + '</td></tr>';
      });
    });
    return h || '<tr><td colspan="6">No payments in ' + R.year + ' yet.</td></tr>';
  }
  function flagsHtml(R) {
    var f = [];
    R.missing.forEach(function (c) { f.push('<li class="bad">' + esc(c.name) + ': no W-9. ' + (c.owed > 0 ? usd(c.owed) + ' should have been held. ' : '') + 'Ask for a signed Form W-9 before the next payment; once it is on file, later payments are paid in full.</li>'); });
    R.contractors.forEach(function (c) { if (c.w9 && c.owed > 0) f.push('<li class="bad">' + esc(c.name) + ': the W-9 came on ' + c.w9 + ', after ' + c.exposed.length + ' payment(s) that were already subject (' + usd(c.owed) + ' not held).</li>'); });
    if (R.unknown.length) f.push('<li>' + R.unknown.length + ' payment(s) name a contractor not in your list (' + R.unknown.map(function (p) { return esc(p.who); }).join(', ') + '). Add them to the list.</li>');
    if (R.outYear.length) f.push('<li>' + R.outYear.length + ' payment(s) dated outside ' + R.year + ' not counted.</li>');
    if (R.bad.length) f.push('<li>Payment line(s) ' + R.bad.join(', ') + ' could not be read (date; contractor; amount; method).</li>');
    if (R.owed > 0) f.push('<li>' + (R.deposits === 'with945' ? 'Backup withholding for the year is under $2,500, so no deposits are due during the year: pay it with Form 945 by ' + longDate(R.Y.due945) + '.' : 'Backup withholding for the year is $2,500 or more: deposits follow the Form 945 deposit schedule (Pub. 15, section 11).') + '</li>');
    return f.join('');
  }

  var api = { RATE: RATE, YEARS: YEARS, TYPES: TYPES, DEFAULTS: DEFAULTS, compute: compute, parseContractors: parseContractors, parsePayments: parsePayments,
    esc: esc, usd: usd, usd0: usd0, fmt: fmt, c2: c2, longDate: longDate, tilesHtml: tilesHtml, rowsHtml: rowsHtml, flagsHtml: flagsHtml, isoOk: isoOk, key: key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.T1099 = api;
})(this);
