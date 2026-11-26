/* Etsy seller tax spreadsheet: the workbook (paid part). combine() result → sheets for XLSXW.workbook().
   Every total is a live formula over the Lines tab, with today's value already filled in. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.ETXBOOK = factory(root.ETX);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  var r2 = E.r2;
  var MCOLS = ['sales', 'returned', 'listing', 'transaction', 'processing', 'rof', 'conversion', 'subscription', 'otherfees', 'vat', 'credits', 'ads', 'offsite', 'labels', 'tax', 'other'];
  var MNAME = { sales: 'Sales (items + shipping)' };
  function L(i) { var s = '', n = i + 1; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function mlabel(k, R) {
    var s = MON[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
    if (R.country === 'uk' && k.slice(5, 7) === '04') s += k.slice(0, 4) === R.year.from.slice(0, 4) ? ' (from 6 Apr)' : ' (to 5 Apr)';
    return s;
  }
  // category → the form line it is added to
  function lineOf(country) {
    var c = E.COUNTRY[country], m = {};
    c.lines.forEach(function (ln) { ln.parts.forEach(function (p) { m[p] = ln.code; }); });
    m.deposit = 'not income: money Etsy sent to your bank';
    m.transfer = 'not counted: a payment between you and Etsy';
    if (!m.tax) m.tax = 'not your income: tax Etsy collects and pays for you';
    if (!m.other) m.other = 'not sorted: check this line';
    return m;
  }

  function build(R, opts) {
    opts = opts || {};
    var c = E.COUNTRY[R.country], cur = c.cur, today = opts.today || new Date().toISOString().slice(0, 10);
    var LN = lineOf(R.country);
    // ---------- Lines: one row per counted amount (a sale line with a fee inside it gives two rows) ----------
    var lines = [['Day', 'Month', 'Type', 'Title', 'Info', 'Amount', 'Fees & Taxes', 'Net', 'Counted', 'Key', 'What it is', 'Form line', 'File']];
    function push(x, val, key, note) {
      lines.push([x.day, x.day.slice(0, 7), x.type, note ? note : x.title, x.info, note ? null : x.amount, note ? null : x.fees, note ? null : x.net,
        { v: r2(val), s: 'm' }, key, key === 'deposit' ? 'Deposit to your bank' : key === 'transfer' ? 'Payment between you and Etsy' : key === 'sales' ? 'Sale' : (E.CAT_NAME[key] || key), LN[key] || '', x.file]);
    }
    R.rowsOut.forEach(function (x) {
      var a = x.amount, f = x.fees, n = x.net, val = n != null ? n : (a != null ? a : 0) + (f != null ? f : 0);
      if (x.cat === 'sale') {
        var g = a != null ? a : val - (f != null ? f : 0);
        push(x, g, 'sales');
        if (f) push(x, f, 'processing', '(in the line above) processing fee inside the sale line');
        var rest = val - g - (f || 0); if (Math.abs(rest) > 0.004) push(x, rest, 'other', '(in the line above) the rest of the sale line');
      } else if (x.cat === 'returned') {
        var b = a != null ? a : val; push(x, b, 'returned');
        if (Math.abs(val - b) > 0.004) push(x, val - b, 'credits', '(in the line above) fees Etsy gave back on this order');
      } else if (x.cat === 'deposit') push(x, x.value, 'deposit');
      else if (x.cat === 'transfer') push(x, x.value, 'transfer');
      else if (x.cat === 'tax') push(x, x.value, 'tax');
      else push(x, x.value, x.cat);
    });
    var nL = lines.length, rng = function (col) { return "Lines!$" + col + "$2:$" + col + "$" + Math.max(2, nL); };

    // ---------- Months ----------
    var head = ['Month', 'Orders'].concat(MCOLS.map(function (k) { return MNAME[k] || E.CAT_NAME[k]; })).concat(['Earned on Etsy (net)', 'Deposits to your bank', 'Gap: sales minus deposits']);
    var keys = ['month', 'sale rows'].concat(MCOLS).concat(['net', 'deposit', 'gap']);
    var M = [[{ v: 'Every month of ' + c.form + ' year ' + R.year.key + ' (' + R.year.label + '), from your Etsy statements', s: 't' }],
      [{ v: 'Costs are negative, as on Etsy. Each cell adds up the Lines tab by month and by the key in row 4, so a line you move to another key moves here too.', s: 'n' }],
      [], keys.map(function (k) { return { v: k, s: 'n' }; }), head.map(function (h) { return { v: h, s: 'h' }; })];
    var first = 6, mk = R.monthKeys;
    mk.forEach(function (k, i) {
      var r = first + i, m = R.months[k], row = [{ v: mlabel(k, R) }];
      var saleRows = 0; R.rowsOut.forEach(function (x) { if (x.cat === 'sale' && x.day.slice(0, 7) === k) saleRows++; });
      row.push({ f: 'COUNTIFS(' + rng('B') + ',"' + k + '",' + rng('J') + ',"sales")', v: saleRows, s: 'i' });
      MCOLS.forEach(function (key, j) {
        var v = key === 'sales' ? m.sales : m[key];
        row.push({ f: 'SUMIFS(' + rng('I') + ',' + rng('B') + ',"' + k + '",' + rng('J') + ',"' + key + '")', v: r2(v), s: 'm' });
      });
      var c0 = L(2), c1 = L(2 + MCOLS.length - 1);
      row.push({ f: 'SUM(' + c0 + r + ':' + c1 + r + ')', v: r2(m.net), s: 'mb' });
      row.push({ f: 'SUMIFS(' + rng('I') + ',' + rng('B') + ',"' + k + '",' + rng('J') + ',"deposit")', v: r2(m.deposits), s: 'm' });
      row.push({ f: L(2) + r + '-' + L(3 + MCOLS.length) + r, v: r2(m.sales - m.deposits), s: 'm' });
      M.push(row);
    });
    var tr = first + mk.length, last = tr - 1, tot = [{ v: 'Year total', s: 'b' }];
    var T = R.tot, totv = { sales: T.sales, net: T.net, deposit: T.deposits, gap: r2(T.sales - T.deposits), 'sale rows': 0 };
    R.rowsOut.forEach(function (x) { if (x.cat === 'sale') totv['sale rows']++; });
    keys.slice(1).forEach(function (k, j) {
      var col = L(1 + j), v = k in totv ? totv[k] : T[k];
      tot.push({ f: mk.length ? 'SUM(' + col + first + ':' + col + last + ')' : '0', v: r2(v || 0), s: k === 'sale rows' ? 'i' : 'mb' });
    });
    M.push(tot);
    function MT(key) { return 'Months!' + L(keys.indexOf(key)) + tr; }   // the year total of one key

    // ---------- Other costs (you type them) ----------
    var OC = [[{ v: 'Your own costs outside Etsy (materials, packaging, postage you bought elsewhere, software, mileage)', s: 't' }],
      [{ v: 'Type one cost per row in the yellow cells. Put the form line you will use in column D (see the Summary tab). The total goes to the Summary.', s: 'n' }],
      [], [{ v: 'Date', s: 'h' }, { v: 'What you paid for', s: 'h' }, { v: 'Amount (' + cur + ')', s: 'h' }, { v: 'Form line you will use', s: 'h' }]];
    var ocFirst = 5, ocRows = 120, own = (opts.ownRows || []);
    for (var i = 0; i < ocRows; i++) {
      var o = own[i] || {};
      OC.push([{ v: o.date || '', s: 'it' }, { v: o.what || '', s: 'it' }, { v: o.amount != null ? o.amount : '', s: 'in' }, { v: o.line || '', s: 'it' }]);
    }
    var ocTot = ocFirst + ocRows, ownSum = 0; own.forEach(function (o) { ownSum += Number(o.amount) || 0; });
    OC.push([{ v: 'Total', s: 'b' }, '', { f: 'SUM(C' + ocFirst + ':C' + (ocTot - 1) + ')', v: r2(ownSum), s: 'mb' }]);
    var OWN = "'Other costs'!C" + ocTot;

    // ---------- Summary ----------
    var S = [[{ v: 'Etsy seller tax spreadsheet: ' + c.form + ', ' + c.name + ', year ' + R.year.key, s: 't' }],
      [{ v: 'Built ' + today + ' from ' + R.files + ' Etsy statement file' + (R.files === 1 ? '' : 's') + ': ' + R.used + ' lines inside ' + R.year.label + (R.outside ? ', ' + R.outside + ' lines outside it left out' : '') + (R.repeats ? ', ' + R.repeats + ' repeated lines left out' : '') + '. Amounts in ' + cur + '.', s: 'n' }],
      [{ v: 'A calculator that sorts your own Etsy statements. It is not tax advice: check each line with your tax preparer or the official instructions linked below. Not made by Etsy.', s: 'n' }],
      [{ v: c.formNote || '', s: 'n' }],
      [{ v: 'Line', s: 'h' }, { v: 'What goes there', s: 'h' }, { v: 'Amount (' + cur + ')', s: 'h' }, { v: 'From your statements', s: 'h' }]];
    var sumRows = {};
    function fx(parts, sign) {
      var f = parts.map(function (p) { return MT(p); }).join('+');
      return sign < 0 ? '-(' + f + ')' : f;
    }
    var inRows = [], lessRows = [], costRows = [];
    R.lines.forEach(function (ln) {
      var parts = ln.parts.slice(), f;
      if (ln.kind === 'total') f = costRows.length ? 'SUM(' + costRows.join(',') + ')' : '0';
      else if (R.country === 'uk' && ln.kind === 'in') f = MT('sales') + '+' + MT('returned');
      else if (ln.kind === 'in') f = fx(parts, 1);
      else f = fx(parts, -1);
      var r = S.length + 1;
      S.push([{ v: ln.code, s: 'b' }, { v: ln.name, s: 'w' }, { f: f, v: ln.value, s: 'mb' }, { v: ln.kind === 'total' ? 'the boxes above added up' : parts.map(function (p) { return p === 'sales' ? 'sales' : (E.CAT_NAME[p] || p).toLowerCase(); }).join(', '), s: 'n' }]);
      if (ln.kind !== 'total') (ln.kind === 'in' ? inRows : ln.kind === 'less' ? lessRows : costRows).push('C' + r);
    });
    var pr = S.length + 1;
    var pf = inRows.join('+') + (lessRows.length ? '-' + lessRows.join('-') : '') + (costRows.length ? '-' + costRows.join('-') : '');
    S.push([{ v: '', s: 'b' }, { v: c.profitName, s: 'b' }, { f: pf, v: R.profit, s: 'mb' }]);
    S.push(['', { v: 'Your own costs (Other costs tab)' }, { f: OWN, v: r2(ownSum), s: 'm' }, { v: 'put each one on its own line of the form', s: 'n' }]);
    S.push(['', { v: 'Profit after your own costs', s: 'b' }, { f: 'C' + pr + '-C' + (pr + 1), v: r2(R.profit - ownSum), s: 'mb' }]);
    S.push([]);
    // the gap walk
    S.push([{ v: 'Why your deposits are smaller than your sales', s: 'h' }, { v: '', s: 'h' }, { v: cur, s: 'h' }, { v: '', s: 'h' }]);
    var g0 = S.length + 1;
    var feeF = E.FEE_KEYS.map(function (k) { return MT(k); }).join('+');
    var gw = [
      ['Sales on your statements (items + shipping)', MT('sales'), T.sales],
      ['Money sent back to buyers', MT('returned'), T.returned],
      ['Etsy fees, all types, after fee credits', feeF, r2(E.FEE_KEYS.reduce(function (s, k) { return s + T[k]; }, 0))],
      ['Etsy Ads and Offsite Ads', MT('ads') + '+' + MT('offsite'), r2(T.ads + T.offsite)],
      ['Shipping labels bought on Etsy', MT('labels'), T.labels],
      ['Sales tax lines and lines not sorted', MT('tax') + '+' + MT('other'), r2(T.tax + T.other)]
    ];
    gw.forEach(function (g) { S.push(['', { v: g[0] }, { f: g[1], v: r2(g[2]), s: 'm' }]); });
    var gn = S.length + 1;
    S.push(['', { v: 'Earned on Etsy (net)', s: 'b' }, { f: 'SUM(C' + g0 + ':C' + (gn - 1) + ')', v: T.net, s: 'mb' }]);
    S.push(['', { v: 'Reached your bank (deposits)' }, { f: MT('deposit'), v: T.deposits, s: 'm' }]);
    S.push(['', { v: 'Still in your Etsy balance at the end of the year (+) or paid out from earlier money (-)' }, { f: 'C' + gn + '-C' + (gn + 1), v: r2(T.net - T.deposits), s: 'm' }]);
    S.push([]);
    // the country's own question
    var X = R.extra || {}, q0;
    if (R.country === 'us') {
      S.push([{ v: 'Form 1099-K check', s: 'h' }, { v: '', s: 'h' }, { v: '', s: 'h' }, { v: '', s: 'h' }]);
      q0 = S.length + 1;
      S.push(['', { v: 'Your sales on the statements' }, { f: MT('sales'), v: T.sales, s: 'm' }]);
      S.push(['', { v: 'Sale lines (orders)' }, { f: MT('sale rows'), v: totv['sale rows'], s: 'i' }]);
      S.push(['', { v: 'Over the federal line (more than $' + E.US_1099K.usd.toLocaleString('en-US') + ' and more than ' + E.US_1099K.n + ' transactions)?' },
        { f: 'IF(AND(C' + q0 + '>' + E.US_1099K.usd + ',C' + (q0 + 1) + '>' + E.US_1099K.n + '),"Yes","No")', v: (T.sales > E.US_1099K.usd && totv['sale rows'] > E.US_1099K.n) ? 'Yes' : 'No' },
        { v: 'Report all of your income either way. Some states use a lower line.', s: 'n' }]);
      S.push(['', { v: 'Box 1a of the 1099-K you got (from the 1099-K match tab)' }, { f: "'1099-K match'!C" + (6 + 12), v: X.k1099 && X.k1099.box1a || 0, s: 'm' }]);
      S.push(['', { v: '1099-K minus your statements (month by month on the 1099-K match tab)' }, { f: 'IF(C' + (q0 + 3) + '=0,0,C' + (q0 + 3) + '-C' + q0 + ')', v: X.k1099 && X.k1099.diff || 0, s: 'm' }]);
    } else if (R.country === 'ca') {
      S.push([{ v: 'GST/HST check', s: 'h' }, { v: '', s: 'h' }, { v: '', s: 'h' }, { v: '', s: 'h' }]);
      q0 = S.length + 1;
      S.push(['', { v: 'Your sales on the statements this year' }, { f: MT('sales'), v: T.sales, s: 'm' }]);
      S.push(['', { v: 'Over the C$' + E.CA_SMALL_SUPPLIER.toLocaleString('en-US') + ' small supplier line this year?' }, { f: 'IF(C' + q0 + '>' + E.CA_SMALL_SUPPLIER + ',"Yes","No")', v: T.sales > E.CA_SMALL_SUPPLIER ? 'Yes' : 'No' }, { v: 'CRA counts your taxable sales over four calendar quarters in a row, Etsy and elsewhere.', s: 'n' }]);
      var G = X.gst || {};
      (G.q || []).forEach(function (qq) { S.push(['', { v: 'Etsy sales in ' + qq.k.replace('-', ' ') + (qq.seen ? '' : ' (no statement added)') }, { v: qq.sum, s: 'm' }]); });
      if (G.best4) S.push(['', { v: 'Best four calendar quarters in a row (' + G.best4.from.replace('-', ' ') + ' to ' + G.best4.to.replace('-', ' ') + ')' }, { v: G.best4.sum, s: 'mb' }, { v: G.over4 ? 'over C$30,000' : 'under C$30,000', s: 'n' }]);
      S.push(['', { v: 'GST/HST Etsy charged on its fees (inside the fee lines above)' }, { f: '-' + MT('vat'), v: r2(-T.vat), s: 'm' }]);
    } else {
      S.push([{ v: 'Trading allowance or your real costs', s: 'h' }, { v: '', s: 'h' }, { v: '', s: 'h' }, { v: '', s: 'h' }]);
      q0 = S.length + 1;
      var etsyCostF = costRows.join('+');
      S.push(['', { v: 'Your allowable costs: Etsy costs above plus the Other costs tab' }, { f: (etsyCostF || '0') + '+' + OWN, v: r2(R.etsyCosts + ownSum), s: 'm' }]);
      S.push(['', { v: 'Trading allowance' }, { v: E.UK_ALLOWANCE, s: 'm' }]);
      S.push(['', { v: 'Which gives the bigger deduction' }, { f: 'IF(C' + q0 + '>C' + (q0 + 1) + ',"Your real costs","The £1,000 trading allowance")', v: (R.etsyCosts + ownSum) > E.UK_ALLOWANCE ? 'Your real costs' : 'The £1,000 trading allowance' }, { v: 'You cannot use the allowance and also deduct costs.', s: 'n' }]);
      S.push(['', { v: 'By how much' }, { f: 'ABS(C' + q0 + '-C' + (q0 + 1) + ')', v: r2(Math.abs(R.etsyCosts + ownSum - E.UK_ALLOWANCE)), s: 'm' }]);
    }
    S.push([]);
    S.push([{ v: 'Official pages behind each line (read ' + E.READ_ON + ')', s: 'h' }, { v: '', s: 'h' }, { v: '', s: 'h' }, { v: '', s: 'h' }]);
    (E.SOURCES[R.country] || []).forEach(function (s) { S.push(['', { v: s[0], s: 'w' }, '', { v: s[1], s: 'n' }]); });

    var sheets = [
      { name: 'Summary', cols: [11, 62, 16, 60], rows: S },
      { name: 'Months', cols: [18, 9].concat(MCOLS.map(function () { return 14; })).concat([16, 16, 16]), rows: M, freeze: 5, landscape: true }
    ];
    if (R.country === 'us') {
      var K = [[{ v: '1099-K match: your statements against the 1099-K, month by month', s: 't' }],
        [{ v: 'Type the monthly amounts from your 1099-K (boxes 5a to 5l) in the yellow cells. A difference shows the month to look at.', s: 'n' }], [],
        [], [{ v: 'Month', s: 'h' }, { v: 'Sales on your statements', s: 'h' }, { v: 'Your 1099-K, that month', s: 'h' }, { v: '1099-K minus statements', s: 'h' }]];
      var y = R.year.key, kb = opts.k1099Months || [];
      for (var mi = 0; mi < 12; mi++) {
        var key = y + '-' + ('0' + (mi + 1)).slice(-2), mrow = mk.indexOf(key), rr = 6 + mi;
        var sv = mrow >= 0 ? R.months[key].sales : 0, kv = kb[mi] != null ? kb[mi] : '';
        K.push([{ v: MON[mi] + ' ' + y }, { f: mrow >= 0 ? 'Months!C' + (first + mrow) : '0', v: r2(sv), s: 'm' }, { v: kv, s: 'in' }, { f: 'IF(C' + rr + '="","",C' + rr + '-B' + rr + ')', v: kv === '' ? '' : r2(kv - sv), s: 'm' }]);
      }
      K.push([{ v: 'Year (box 1a)', s: 'b' }, { f: 'SUM(B6:B17)', v: T.sales, s: 'mb' }, { f: 'SUM(C6:C17)', v: r2(kb.reduce(function (s, v) { return s + (Number(v) || 0); }, 0)), s: 'mb' }, { f: 'C18-B18', v: r2(kb.reduce(function (s, v) { return s + (Number(v) || 0); }, 0) - T.sales), s: 'mb' }]);
      sheets.push({ name: '1099-K match', cols: [16, 24, 24, 24], rows: K });
    }
    sheets.push({ name: 'Other costs', cols: [14, 48, 16, 30], rows: OC, freeze: 4 });
    sheets.push({ name: 'Lines', cols: [11, 9, 12, 46, 22, 12, 12, 12, 12, 12, 30, 26, 26], rows: lines.map(function (r, i) { return i === 0 ? r.map(function (h) { return { v: h, s: 'h' }; }) : r; }), freeze: 1, landscape: true });
    return sheets;
  }

  return { build: build, MCOLS: MCOLS };
});
