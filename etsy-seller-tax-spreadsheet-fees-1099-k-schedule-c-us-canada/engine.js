/* Etsy seller tax spreadsheet: the engine.
   Reads Etsy monthly statement CSVs (Shop Manager > Finances > Monthly statements > Download CSV), sorts every line,
   adds them up by month and puts the totals on the lines of Schedule C (US), T2125 (Canada) or SA103S (UK).
   Runs in the browser (window.ETX) and in node (tests). Nothing leaves the browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ETX = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var READ_ON = '26 Nov 2026';

  function r2(v) { v = Number(v) || 0; return Math.round((v + (v >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }

  // ---------- CSV ----------
  function parseCSV(text) {
    var t = String(text || '').replace(/^﻿/, '');
    var first = t.split(/\r?\n/)[0] || '';
    var delim = (first.split(';').length > first.split(',').length) ? ';' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) {
        if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && t[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return rows;
  }

  // "$1,234.56" · "-$1.00" · "($1.00)" · "CA$3.20" · "£1,234.56" · "1.234,56 €" · "--" → number (NaN when empty)
  function amount(s) {
    var v = String(s == null ? '' : s).trim();
    if (!v || /^-+$/.test(v) || /^n\/?a$/i.test(v)) return NaN;
    var neg = /^\(.*\)$/.test(v) || /^[^\d]*[-−–]/.test(v) || /[-−–]$/.test(v);
    v = v.replace(/[^\d.,]/g, '');
    if (!v) return NaN;
    var lastC = v.lastIndexOf(','), lastD = v.lastIndexOf('.');
    if (lastC >= 0 && lastD >= 0) v = lastC > lastD ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
    else if (lastC >= 0) { var p = v.split(','); v = (p.length === 2 && p[1].length !== 3) ? p[0] + '.' + p[1] : p.join(''); }
    else if (v.split('.').length > 2) v = v.replace(/\./g, '');
    var n = parseFloat(v);
    if (!isFinite(n)) return NaN;
    return neg ? -n : n;
  }
  // the money in a deposit title: "$1,064.90 sent to your bank account" · "CA$212.40 sent to your bank account"
  function moneyIn(text) {
    var m = /(?:[A-Z]{0,3}\$|£|€)\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*\.\d{2}/.exec(String(text || ''));
    return m ? amount(m[0]) : NaN;
  }

  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function pad(n) { return ('0' + n).slice(-2); }
  // → 'YYYY-MM-DD' ('' when unreadable) · dmy = true reads 03/04/2026 as 3 April (UK, Canada), else as March 4 (US)
  function ymd(s, dmy) {
    var t = String(s || '').trim(), m;
    if ((m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    if ((m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(t)) && MONTHS[m[1].toLowerCase()]) return m[3] + '-' + pad(MONTHS[m[1].toLowerCase()]) + '-' + pad(+m[2]);
    if ((m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/.exec(t)) && MONTHS[m[2].toLowerCase()]) return m[3] + '-' + pad(MONTHS[m[2].toLowerCase()]) + '-' + pad(+m[1]);
    if ((m = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/.exec(t))) {
      var a = +m[1], b = +m[2], y = m[3].length === 2 ? '20' + m[3] : m[3], mo, d;
      if (a > 12) { d = a; mo = b; } else if (b > 12) { mo = a; d = b; } else if (dmy) { d = a; mo = b; } else { mo = a; d = b; }
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return y + '-' + pad(mo) + '-' + pad(d);
    }
    return '';
  }

  // ---------- what each statement line is ----------
  var CATS = [
    ['listing', 'Listing fees'], ['transaction', 'Transaction fees'], ['processing', 'Payment processing fees'],
    ['rof', 'Regulatory operating fee'], ['conversion', 'Currency conversion fees'], ['subscription', 'Etsy Plus and other subscriptions'],
    ['otherfees', 'Other Etsy fees'], ['vat', 'VAT / GST / HST Etsy charged on its fees'], ['credits', 'Fee credits from Etsy'],
    ['ads', 'Etsy Ads'], ['offsite', 'Offsite Ads fees'], ['labels', 'Shipping labels bought on Etsy'],
    ['returned', 'Money sent back to buyers'], ['tax', 'Sales tax / VAT Etsy collected for the buyer'], ['other', 'Lines not sorted']
  ];
  var CAT_NAME = {}; CATS.forEach(function (c) { CAT_NAME[c[0]] = c[1]; });
  var FEE_KEYS = ['listing', 'transaction', 'processing', 'rof', 'conversion', 'subscription', 'otherfees', 'vat', 'credits'];

  function category(type, title) {
    var ty = String(type || '').toLowerCase().trim(), ti = String(title || '').toLowerCase();
    if (/deposit/.test(ty) || /sent to your bank|deposit to your bank|deposited/.test(ti)) return 'deposit';
    if (/^payment$|^bill|card payment|^reserve/.test(ty) || /^payment (made|received)|paid your etsy bill|etsy charged your|reserve/.test(ti)) return 'transfer';
    if (/^vat|^gst|^hst|^qst|^pst/.test(ty) || /^(vat|gst|hst|qst|pst|gst\/hst)\b|\bvat on\b|\bvat:|gst\/hst on|hst on|gst on/.test(ti)) return 'vat';
    if (/refund|return/.test(ty) || /^refund|refund to buyer/.test(ti)) return 'returned';
    if (/^sale/.test(ty)) return 'sale';
    if (/share ?& ?save/.test(ti) || (/credit/.test(ti) && !/fee/.test(ti))) return 'credits';
    if (/regulatory operating/.test(ti)) return 'rof';
    if (/offsite ads/.test(ti)) return 'offsite';
    if (/transaction fee/.test(ti)) return 'transaction';
    if (/processing fee/.test(ti)) return 'processing';
    if (/listing fee|auto.?renew|renew sold|renew expired|^listing/.test(ti)) return 'listing';
    if (/currency conversion/.test(ti)) return 'conversion';
    if (/shipping|postage|label/.test(ty) || /shipping label|postage label|\blabel\b/.test(ti)) return 'labels';
    if (/marketing|advert/.test(ty) || /etsy ads|promoted listing/.test(ti)) return 'ads';
    if (/subscription|etsy plus|pattern/.test(ti)) return 'subscription';
    if (/^tax/.test(ty) || /sales tax|vat paid by buyer|tax paid by buyer/.test(ti)) return 'tax';
    if (/^fee/.test(ty) || /\bfee\b/.test(ti)) return 'otherfees';
    return 'other';
  }

  function col(header, rxs) {
    for (var k = 0; k < rxs.length; k++) for (var i = 0; i < header.length; i++) if (rxs[k].test(String(header[i]).trim())) return i;
    return -1;
  }

  // one statement file → its lines (nothing summed yet)
  function readStatement(text, fileName, dmy) {
    var rows = parseCSV(text);
    if (!rows.length) return { ok: false, file: fileName || '', why: 'The file is empty.' };
    var h = rows[0].map(function (x) { return String(x).trim(); });
    var I = {
      date: col(h, [/^date$/i, /date/i]), type: col(h, [/^type$/i]), title: col(h, [/^title$/i, /^description$/i]), info: col(h, [/^info$/i]),
      cur: col(h, [/^currency$/i]), amt: col(h, [/^amount$/i, /^gross/i]), fee: col(h, [/fees?\s*(&|and)\s*tax/i, /^fees?$/i]), net: col(h, [/^net$/i, /^net amount/i])
    };
    if (I.type < 0 || I.title < 0 || (I.net < 0 && I.amt < 0)) {
      return { ok: false, file: fileName || '', why: 'This is not an Etsy monthly statement CSV: the columns Type, Title and Net (or Amount) are missing. It has: ' + h.slice(0, 8).join(', ') + '. In Shop Manager open Finances > Monthly statements and press Download CSV.' };
    }
    var out = [], curs = {}, bad = 0;
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r]; if (!row || row.length < 3) continue;
      var type = row[I.type] || '', title = row[I.title] || '', info = I.info >= 0 ? (row[I.info] || '') : '';
      var a = I.amt >= 0 ? amount(row[I.amt]) : NaN, f = I.fee >= 0 ? amount(row[I.fee]) : NaN, n = I.net >= 0 ? amount(row[I.net]) : NaN;
      var cat = category(type, title), d = I.date >= 0 ? ymd(row[I.date], dmy) : '';
      if (I.cur >= 0 && row[I.cur]) curs[row[I.cur]] = (curs[row[I.cur]] || 0) + 1;
      if (!d) bad++;
      out.push({ date: I.date >= 0 ? row[I.date] : '', day: d, type: type, title: title, info: info,
        amount: isFinite(a) ? r2(a) : null, fees: isFinite(f) ? r2(f) : null, net: isFinite(n) ? r2(n) : null, cat: cat });
    }
    var cur = '', best = -1; Object.keys(curs).forEach(function (k) { if (curs[k] > best) { best = curs[k]; cur = k; } });
    return { ok: true, file: fileName || '', currency: cur, lines: out, undated: bad };
  }

  // ---------- countries: the year, the money and the form lines ----------
  // a line's value = the sum of its parts (each part a category, sign applied so costs come out positive)
  var NOPROC = ['listing', 'transaction', 'rof', 'conversion', 'subscription', 'otherfees', 'vat', 'credits'];
  var COUNTRY = {
    us: {
      name: 'United States', cur: 'USD', sym: '$', dmy: false, form: 'Schedule C (Form 1040)', yearKind: 'calendar', defYear: '2026',
      formNote: 'Line numbers of the 2025 Schedule C, the newest form the IRS has published (read 26 Nov 2026). Check them on the 2026 form when it comes out.',
      lines: [
        { code: 'Line 1', name: 'Gross receipts or sales', parts: ['sales'], kind: 'in' },
        { code: 'Line 2', name: 'Returns and allowances', parts: ['returned'], kind: 'less' },
        { code: 'Line 8', name: 'Advertising: Etsy Ads and Offsite Ads', parts: ['ads', 'offsite'], kind: 'cost' },
        { code: 'Line 10', name: 'Commissions and fees: every Etsy fee', parts: FEE_KEYS, kind: 'cost' },
        { code: 'Line 18', name: 'Office expense: postage (your shipping labels)', parts: ['labels'], kind: 'cost' }
      ],
      profitName: 'Profit from your Etsy statements (before your own costs)'
    },
    ca: {
      name: 'Canada', cur: 'CAD', sym: 'C$', dmy: true, form: 'Form T2125', yearKind: 'calendar', defYear: '2026',
      formNote: 'Line numbers of Form T2125 as in CRA guide T4002 (read 26 Nov 2026).',
      lines: [
        { code: 'Amount 3A', name: 'Gross sales, commissions or fees', parts: ['sales'], kind: 'in' },
        { code: 'Part 3A', name: 'Returns and allowances, taken off before line 8000', parts: ['returned'], kind: 'less' },
        { code: 'Line 8521', name: 'Advertising: Etsy Ads and Offsite Ads', parts: ['ads', 'offsite'], kind: 'cost' },
        { code: 'Line 8871', name: 'Management and administration fees, incl. bank charges: payment processing', parts: ['processing'], kind: 'cost' },
        { code: 'Line 9270', name: 'Other expenses: Etsy selling fees', parts: NOPROC, kind: 'cost' },
        { code: 'Line 9275', name: 'Delivery, freight and express: shipping labels', parts: ['labels'], kind: 'cost' }
      ],
      profitName: 'Profit from your Etsy statements (before your own costs)'
    },
    uk: {
      name: 'United Kingdom', cur: 'GBP', sym: '£', dmy: true, form: 'SA103S (self-employment, short)', yearKind: 'uk', defYear: '2025-26',
      formNote: 'Box numbers of the SA103S for 6 April 2025 to 5 April 2026 (read 26 Nov 2026).',
      lines: [
        { code: 'Box 9', name: 'Your turnover (sales less money sent back)', parts: ['sales', 'returned'], kind: 'in' },
        { code: 'Box 17', name: 'Interest and bank and credit card financial charges: payment processing', parts: ['processing'], kind: 'cost' },
        { code: 'Box 18', name: 'Phone, fax, stationery and other office costs: postage labels', parts: ['labels'], kind: 'cost' },
        { code: 'Box 19', name: 'Other allowable business expenses: Etsy fees and ads', parts: NOPROC.concat(['ads', 'offsite']), kind: 'cost' },
        { code: 'Box 20', name: 'Total allowable expenses (alone is enough when turnover is below £90,000)', parts: [], kind: 'total' }
      ],
      profitName: 'Profit from your Etsy statements (before your own costs)'
    }
  };

  // the tax year → {key, label, from, to}
  function yearOf(country, key) {
    var c = COUNTRY[country] || COUNTRY.us;
    if (c.yearKind === 'uk') {
      var y = parseInt(String(key || c.defYear).slice(0, 4), 10);
      return { key: y + '-' + String(y + 1).slice(2), label: '6 April ' + y + ' to 5 April ' + (y + 1), from: y + '-04-06', to: (y + 1) + '-04-05' };
    }
    var yy = parseInt(String(key || c.defYear).slice(0, 4), 10);
    return { key: String(yy), label: '1 January to 31 December ' + yy, from: yy + '-01-01', to: yy + '-12-31' };
  }
  // the tax year most of the dated lines fall in
  function guessYear(country, files) {
    var c = COUNTRY[country] || COUNTRY.us, n = {};
    (files || []).forEach(function (F) {
      (F.lines || []).forEach(function (L) {
        if (!L.day) return;
        var y = +L.day.slice(0, 4), k;
        if (c.yearKind === 'uk') k = (L.day.slice(5) >= '04-06' ? y : y - 1) + '-' + String((L.day.slice(5) >= '04-06' ? y : y - 1) + 1).slice(2);
        else k = String(y);
        n[k] = (n[k] || 0) + 1;
      });
    });
    var best = '', b = -1; Object.keys(n).forEach(function (k) { if (n[k] > b) { b = n[k]; best = k; } });
    return best || c.defYear;
  }

  function money(v, country, plain) {
    var c = COUNTRY[country] || COUNTRY.us;
    var neg = v < 0, a = Math.abs(r2(v));
    var s = a.toFixed(2).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? (plain ? '-' : '−') : '') + c.sym + s[0] + '.' + s[1];
  }

  function blankMonth() { var o = { sales: 0, orders: 0, deposits: 0, net: 0, taxCollected: 0, lines: 0 }; CATS.forEach(function (x) { o[x[0]] = 0; }); return o; }

  // all files + country + year (+ your own costs) → the whole answer
  function combine(files, country, yearKey, opts) {
    country = COUNTRY[country] ? country : 'us';
    opts = opts || {};
    var c = COUNTRY[country];
    var ok = (files || []).filter(function (F) { return F && F.ok; });
    var Y = yearOf(country, yearKey || guessYear(country, ok));
    var months = {}, T = blankMonth(), orders = {}, outside = 0, undated = 0, dup = 0, used = 0, curs = {}, QS = {};
    // the same line twice inside one file is real (two equal fees on one day); the same line again in a second file is a repeat download
    var all = [], most = {}, taken = {};
    ok.forEach(function (F) {
      if (F.currency) curs[F.currency] = (curs[F.currency] || 0) + F.lines.length;
      var inFile = {};
      F.lines.forEach(function (L) {
        var sig = [L.date, L.type, L.title, L.info, L.amount, L.fees, L.net].join('|');
        inFile[sig] = (inFile[sig] || 0) + 1;
        all.push({ L: L, F: F, sig: sig });
      });
      Object.keys(inFile).forEach(function (k) { most[k] = Math.max(most[k] || 0, inFile[k]); });
    });
    var rowsOut = [];
    all.forEach(function (x) {
      var L = x.L;
      taken[x.sig] = (taken[x.sig] || 0) + 1;
      if (taken[x.sig] > most[x.sig]) { dup++; return; }
      if (!L.day) { undated++; return; }
      if (L.cat === 'sale') {   // calendar quarters across every file (the GST/HST small supplier test looks at four in a row)
        var qk = L.day.slice(0, 4) + '-Q' + (Math.floor((+L.day.slice(5, 7) - 1) / 3) + 1);
        QS[qk] = (QS[qk] || 0) + (L.amount != null ? L.amount : (L.net || 0));
      }
      if (L.day < Y.from || L.day > Y.to) { outside++; return; }
      used++;
      var mk = L.day.slice(0, 7), M = months[mk] || (months[mk] = blankMonth());
      var a = L.amount, f = L.fees, n = L.net;
      var val = n != null ? n : (a != null ? a : 0) + (f != null ? f : 0);
      var line = { day: L.day, date: L.date, type: L.type, title: L.title, info: L.info, amount: a, fees: f, net: n, cat: L.cat, value: 0, file: x.F.file };
      M.lines++; T.lines++;
      if (L.cat === 'deposit') {
        var dv = a != null ? Math.abs(a) : (n != null ? Math.abs(n) : moneyIn(L.title));
        dv = isFinite(dv) ? dv : 0;
        M.deposits += dv; T.deposits += dv; line.value = r2(dv);
      } else if (L.cat === 'transfer') {
        line.value = r2(val);
      } else if (L.cat === 'sale') {
        var gross = a != null ? a : val - (f != null ? f : 0);
        var feePart = f != null ? f : 0;
        M.sales += gross; T.sales += gross; M.processing += feePart; T.processing += feePart;
        var rest = val - gross - feePart;
        if (Math.abs(rest) > 0.004) { M.other += rest; T.other += rest; }
        M.net += val; T.net += val;
        var om = /order\s*#?\s*(\d+)/i.exec(L.title + ' ' + L.info);
        var ok2 = om ? om[1] : (L.day + '|' + L.title);
        if (!orders[ok2]) { orders[ok2] = 1; M.orders++; T.orders++; }
        line.value = r2(gross);
      } else if (L.cat === 'returned') {
        var back = a != null ? a : val;
        M.returned += back; T.returned += back;
        var fb = val - back;   // fees Etsy gave back on the returned order
        if (Math.abs(fb) > 0.004) { M.credits += fb; T.credits += fb; }
        M.net += val; T.net += val; line.value = r2(back);
      } else if (L.cat === 'tax') {
        var tc = a != null ? Math.abs(a) : 0;
        M.taxCollected += tc; T.taxCollected += tc;
        if (Math.abs(val) > 0.004) { M.tax += val; T.tax += val; M.net += val; T.net += val; }
        line.value = r2(val);
      } else {
        M[L.cat] += val; T[L.cat] += val; M.net += val; T.net += val; line.value = r2(val);
      }
      rowsOut.push(line);
    });
    Object.keys(T).forEach(function (k) { T[k] = r2(T[k]); });
    Object.keys(months).forEach(function (m) { Object.keys(months[m]).forEach(function (k) { months[m][k] = r2(months[m][k]); }); });

    // parts → positive amounts
    function part(p) {
      if (p === 'sales') return T.sales;
      return -T[p];   // costs are negative in the statement, credits positive (they lower the cost)
    }
    var lines = c.lines.map(function (ln) {
      var v = 0; ln.parts.forEach(function (p) { v += part(p); });
      if (country === 'uk' && ln.kind === 'in') v = T.sales + T.returned;   // turnover = sales less the money sent back
      return { code: ln.code, name: ln.name, kind: ln.kind, value: r2(v), parts: ln.parts };
    });
    var income = 0, costs = 0;
    lines.forEach(function (l) { if (l.kind === 'in') income += l.value; else if (l.kind === 'less') income -= l.value; else if (l.kind === 'cost') costs += l.value; });
    lines.forEach(function (l) { if (l.kind === 'total') l.value = r2(costs); });
    var fees = 0; FEE_KEYS.forEach(function (k) { fees -= T[k]; });
    var own = Math.max(0, Number(opts.ownCosts) || 0);
    var res = {
      ok: true, country: country, cname: c.name, form: c.form, currency: c.cur, year: Y, files: ok.length, bad: (files || []).length - ok.length,
      rows: T.lines, used: used, outside: outside, undated: undated, repeats: dup, curs: curs,
      months: months, monthKeys: Object.keys(months).sort(), tot: T, lines: lines,
      sales: T.sales, orders: T.orders, deposits: T.deposits, net: T.net, fees: r2(fees), ads: r2(-(T.ads + T.offsite)), labels: r2(-T.labels),
      returned: r2(-T.returned), unsorted: r2(T.other), taxCollected: T.taxCollected,
      income: r2(income), etsyCosts: r2(costs), profit: r2(income - costs), ownCosts: r2(own), profitAfterOwn: r2(income - costs - own),
      gap: r2(T.sales - T.deposits), inBalance: r2(T.net - T.deposits), rowsOut: rowsOut
    };
    res.check = r2(T.sales + T.returned + T.listing + T.transaction + T.processing + T.rof + T.conversion + T.subscription + T.otherfees + T.vat + T.credits + T.ads + T.offsite + T.labels + T.tax + T.other - T.net);
    res.quarters = quarterRun(QS);
    res.extra = extraChecks(res, opts);
    return res;
  }

  // sales per calendar quarter, every quarter from the first to the last (a quarter with no statement counts 0),
  // the best run of four in a row and the best single quarter
  function quarterRun(QS) {
    var ks = Object.keys(QS || {}).sort();
    if (!ks.length) return { list: [], best4: null, bestQ: null };
    var y = +ks[0].slice(0, 4), q = +ks[0].slice(6), last = ks[ks.length - 1], list = [];
    while (true) {
      var k = y + '-Q' + q;
      list.push({ k: k, sum: r2(QS[k] || 0), seen: k in QS });
      if (k === last || list.length > 80) break;
      q++; if (q > 4) { q = 1; y++; }
    }
    var bestQ = null, best4 = null;
    list.forEach(function (x, i) {
      if (!bestQ || x.sum > bestQ.sum) bestQ = { k: x.k, sum: x.sum };
      if (i >= 3) { var s4 = r2(list[i].sum + list[i - 1].sum + list[i - 2].sum + list[i - 3].sum); if (!best4 || s4 > best4.sum) best4 = { from: list[i - 3].k, to: x.k, sum: s4, full: true }; }
    });
    if (!best4) { var s = 0; list.forEach(function (x) { s += x.sum; }); best4 = { from: list[0].k, to: list[list.length - 1].k, sum: r2(s), full: false }; }
    return { list: list, best4: best4, bestQ: bestQ };
  }

  // the country's own question
  var US_1099K = { usd: 20000, n: 200 };
  var CA_SMALL_SUPPLIER = 30000;
  var UK_ALLOWANCE = 1000;
  function extraChecks(R, opts) {
    var x = {};
    if (R.country === 'us') {
      x.k1099 = { over: R.sales > US_1099K.usd && R.orders > US_1099K.n, sales: R.sales, orders: R.orders };
      var b = Number(opts.box1a);
      if (b > 0) x.k1099.box1a = r2(b), x.k1099.diff = r2(b - R.sales);
    } else if (R.country === 'ca') {
      var Q = R.quarters || {};
      x.gst = { over: R.sales > CA_SMALL_SUPPLIER, sales: R.sales, gstOnFees: r2(-R.tot.vat), q: Q.list || [], best4: Q.best4, bestQ: Q.bestQ,
        over4: !!(Q.best4 && Q.best4.sum > CA_SMALL_SUPPLIER), overQ: !!(Q.bestQ && Q.bestQ.sum > CA_SMALL_SUPPLIER) };
    } else if (R.country === 'uk') {
      var exp = r2(R.etsyCosts + R.ownCosts);
      x.allowance = { expenses: exp, allowance: UK_ALLOWANCE, better: exp > UK_ALLOWANCE ? 'expenses' : 'allowance', diff: r2(Math.abs(exp - UK_ALLOWANCE)), turnover: R.income };
    }
    return x;
  }

  // ---------- the made-up example shops (one per country) ----------
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  var SHOPS = {
    us: { seed: 2026, cur: 'USD', sym: '$', pp: 0.03, pf: 0.25, rof: 0, vat: 0, list: 0.20, label: 'USPS shipping label', tax: 0.07, ads: 11.5, start: '2026-01-01', months: 12,
      items: [['Speckled Ceramic Mug', 36, 6, 5.40], ['Botanical Art Print A4', 24, 4, 4.10], ['Linen Tea Towel Set', 28, 5, 4.60], ['Printable Garden Planner', 9, 0, 0]], per: [44, 40, 46, 48, 47, 45, 44, 48, 52, 60, 82, 94] },
    ca: { seed: 2027, cur: 'CAD', sym: 'CA$', pp: 0.03, pf: 0.25, rof: 0.005, vat: 0.13, vatName: 'HST', list: 0.29, label: 'Canada Post shipping label', tax: 0, ads: 9.0, start: '2026-01-01', months: 12,
      items: [['Hand-poured Soy Candle', 32, 9, 8.20], ['Beeswax Wraps Set of 3', 26, 7, 6.40], ['Maple Wood Coasters', 30, 8, 7.10], ['Printable Recipe Cards', 7, 0, 0]], per: [20, 18, 21, 22, 22, 20, 19, 21, 24, 28, 40, 47] },
    uk: { seed: 2025, cur: 'GBP', sym: '£', pp: 0.04, pf: 0.20, rof: 0.0048, vat: 0.20, vatName: 'VAT', list: 0.15, label: 'Royal Mail postage label', tax: 0, ads: 6.0, start: '2025-04-06', months: 13,
      items: [['Embroidered Tote Bag', 26, 3.5, 3.35], ['Personalised Bookmark', 12, 1.5, 1.25], ['Pressed Flower Card Set', 14, 1.6, 1.10], ['Knitting Pattern PDF', 6, 0, 0]], per: [22, 26, 25, 24, 25, 26, 30, 38, 48, 24, 23, 26, 12] }
  };
  function monthName(i) { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]; }
  function q(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }
  function m2(v) { if (v == null) return '--'; var neg = v < 0; var a = Math.abs(r2(v)).toFixed(2).split('.'); a[0] = a[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (neg ? '-' : '') + a[0] + '.' + a[1]; }

  // → [{name, text}] · one CSV per month in Etsy's statement layout · every number made up
  function sample(country) {
    var S = SHOPS[country] || SHOPS.us, R = rng(S.seed), files = [];
    var y0 = +S.start.slice(0, 4), m0 = +S.start.slice(5, 7) - 1, orderNo = 3700000000 + S.seed * 1000, bal = 0;
    for (var k = 0; k < S.months; k++) {
      var y = y0 + Math.floor((m0 + k) / 12), mi = (m0 + k) % 12, dim = new Date(Date.UTC(y, mi + 1, 0)).getUTCDate();
      var L = [], n = S.per[k], last = (k === S.months - 1);
      var days = last && country === 'uk' ? 20 : dim;   // the UK example stops on 20 April 2026
      var ev = [];
      var d0 = k === 0 ? +S.start.slice(8, 10) : 1;
      for (var o = 0; o < n; o++) ev.push({ d: d0 + Math.floor(R() * (days - d0 + 1)), o: o });
      ev.sort(function (a, b) { return a.d - b.d; });
      var dep = {}; dep[1] = 1; dep[15] = 1;
      var cursor = 1;
      function flush(upto) {   // deposits on the 1st and the 15th: the balance so far goes to the bank
        for (; cursor <= upto; cursor++) if (dep[cursor] && bal > 0.5) { L.push([cursor, 'Deposit', S.sym + m2(bal) + ' sent to your bank account', '', '--', '--', '--']); bal = 0; }
      }
      ev.forEach(function (e, idx) {
        flush(e.d);
        var it = S.items[Math.floor(R() * S.items.length)], qn = R() < 0.12 ? 2 : 1, id = ++orderNo;
        var item = it[1] * qn, ship = it[2], tot = r2(item + ship), tax = r2(item * S.tax);
        var fee = [];
        L.push([e.d, 'Sale', 'Payment for Order #' + id, 'Order #' + id, m2(tot), '--', m2(tot)]); bal += tot;
        if (tax > 0) L.push([e.d, 'Tax', 'Sales tax paid by buyer', 'Order #' + id, m2(tax), m2(-tax), '--']);
        fee.push(['Processing fee', r2((tot + tax) * S.pp + S.pf)]);
        fee.push(['Transaction fee: ' + it[0], r2(item * 0.065)]);
        if (ship > 0) fee.push(['Transaction fee: Shipping', r2(ship * 0.065)]);
        for (var qq = 0; qq < qn; qq++) fee.push(['Auto-renew sold: ' + it[0], S.list]);
        if (S.rof) fee.push(['Regulatory operating fee', r2(tot * S.rof)]);
        if (R() < 0.06) fee.push(['Offsite Ads fee for Order #' + id, r2(Math.min(tot * 0.15, 100))]);
        fee.forEach(function (fx) {
          var ty = /^Offsite/.test(fx[0]) ? 'Marketing' : 'Fee';
          L.push([e.d, ty, fx[0], 'Order #' + id, '--', m2(-fx[1]), m2(-fx[1])]); bal -= fx[1];
          if (S.vat) { var v = r2(fx[1] * S.vat); L.push([e.d, S.vatName, S.vatName + ': ' + fx[0].replace(/ for Order #\d+$/, ''), 'Order #' + id, '--', m2(-v), m2(-v)]); bal -= v; }
        });
        if (it[3] > 0) { L.push([e.d, 'Shipping', S.label, 'Label for Order #' + id, '--', m2(-it[3]), m2(-it[3])]); bal -= it[3]; }
        if (idx % 23 === 7) {   // now and then an order is sent back
          var bd = Math.min(days, e.d + 3); flush(bd);
          var fb = r2(item * 0.065);
          L.push([bd, 'Refund', 'Refund to buyer for Order #' + id, 'Order #' + id, m2(-tot), m2(fb), m2(-tot + fb)]); bal += -tot + fb;
        }
      });
      for (var w = 7; w <= days; w += 7) {   // Etsy Ads, billed weekly
        if (w < d0) continue;
        flush(w);
        var ad = r2(S.ads * (0.8 + R() * 0.5) * (k >= S.months - 3 && country !== 'uk' ? 1.6 : 1));
        L.push([w, 'Marketing', 'Etsy Ads', 'Ads for ' + monthName(mi) + ' ' + w, '--', m2(-ad), m2(-ad)]); bal -= ad;
        if (S.vat) { var va = r2(ad * S.vat); L.push([w, S.vatName, S.vatName + ': Etsy Ads', '', '--', m2(-va), m2(-va)]); bal -= va; }
      }
      flush(days);
      L.sort(function (a, b) { return b[0] - a[0]; });   // newest first, as Etsy lists them
      var head = 'Date,Type,Title,Info,Currency,Amount,Fees & Taxes,Net';
      var body = L.map(function (r) {
        var dt = country === 'us' ? monthName(mi) + ' ' + r[0] + ', ' + y : r[0] + ' ' + monthName(mi) + ' ' + y;
        var amt = r[4] === '--' ? '--' : r[4].replace(/^(-?)/, '$1' + S.sym), fe = r[5] === '--' ? '--' : r[5].replace(/^(-?)/, '$1' + S.sym), ne = r[6] === '--' ? '--' : r[6].replace(/^(-?)/, '$1' + S.sym);
        return [q(dt), q(r[1]), q(r[2]), q(r[3]), q(S.cur), q(amt), q(fe), q(ne)].join(',');
      });
      files.push({ name: 'etsy_statement_' + y + '_' + pad(mi + 1) + '.csv', text: head + '\r\n' + body.join('\r\n') + '\r\n' });
    }
    return files;
  }

  function readAll(list, country) {
    var c = COUNTRY[country] || COUNTRY.us;
    return list.map(function (f) { return readStatement(f.text, f.name, c.dmy); });
  }

  // a CSV of any table (for the workbook's sheets and for tests)
  function csv(rows) {
    return rows.map(function (r) { return r.map(function (v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  }

  // the official pages behind each line (re-read on the build day)
  var SOURCES = {
    us: [['IRS, Schedule C (Form 1040), the 2025 form: lines 1, 2, 8, 10 and 18', 'https://www.irs.gov/pub/irs-pdf/f1040sc.pdf'],
      ['IRS, Instructions for Schedule C, line 18: "Include on this line your expenses for office supplies and postage."', 'https://www.irs.gov/instructions/i1040sc'],
      ['IRS, Understanding your Form 1099-K: a 1099-K comes when payments total over $20,000 in more than 200 transactions; "you must report all income on your tax return"', 'https://www.irs.gov/businesses/understanding-your-form-1099-k'],
      ['IRS, Form 1099-K FAQs: box 1a is the gross amount of reportable payment transactions', 'https://www.irs.gov/newsroom/form-1099-k-faqs-general-information']],
    ca: [['CRA, guide T4002 chapter 4: amount 3A (gross sales, commissions or fees, including GST/HST collected or collectible) and line 8000', 'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4002/t4002-4.html'],
      ['CRA, guide T4002 chapter 5: lines 8521 (advertising), 8871 (management and administration fees, including bank charges), 9270 (other expenses), 9275 (delivery, freight and express)', 'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4002/t4002-5.html'],
      ['CRA, when to register for and start charging the GST/HST: the $30,000 small supplier line over four consecutive calendar quarters', 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html']],
    uk: [['GOV.UK, SA103S Self-employment (short), tax year 6 April 2025 to 5 April 2026: boxes 9, 10.1 and 17 to 20', 'https://assets.publishing.service.gov.uk/media/69c12ae013101e9908704a53/SA103S-2026.pdf'],
      ['GOV.UK, SA103S notes 2025 to 2026: postage is an allowable expense; below £90,000 turnover the total in box 20 is enough', 'https://assets.publishing.service.gov.uk/media/69ce15395cf899414a0bc69f/SA103S_Notes_2026.pdf'],
      ['GOV.UK, the trading allowance: up to £1,000 a year, and no other expenses if you claim it', 'https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income'],
      ['GOV.UK, Self Assessment deadlines: online return and payment by 31 January 2027 for 2025 to 2026', 'https://www.gov.uk/self-assessment-tax-returns/deadlines'],
      ['GOV.UK, selling on a digital platform: platforms such as Etsy report your sales income to HMRC', 'https://www.gov.uk/guidance/selling-goods-or-services-on-a-digital-platform']]
  };

  return {
    READ_ON: READ_ON, SOURCES: SOURCES, CATS: CATS, CAT_NAME: CAT_NAME, FEE_KEYS: FEE_KEYS, COUNTRY: COUNTRY, US_1099K: US_1099K, CA_SMALL_SUPPLIER: CA_SMALL_SUPPLIER, UK_ALLOWANCE: UK_ALLOWANCE,
    r2: r2, parseCSV: parseCSV, amount: amount, moneyIn: moneyIn, ymd: ymd, category: category, readStatement: readStatement, readAll: readAll,
    yearOf: yearOf, guessYear: guessYear, combine: combine, money: money, sample: sample, csv: csv
  };
});
