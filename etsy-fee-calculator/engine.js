/* engine.js: Etsy fee calculator engine (pure functions, no DOM).
   Fee rules read on 2026-11-18 from Etsy's Help Center:
     fees and taxes ........ help.etsy.com/hc/en-us/articles/115014483627
     payment processing .... help.etsy.com/hc/articles/115015628847
     regulatory operating .. help.etsy.com/hc/articles/1500011073202 (rates in force since 22 June 2026,
                             Etsy announcement "Regulatory Operating Fee updates for some markets")
     VAT on seller fees .... help.etsy.com/hc/articles/360040584433
     Offsite Ads ........... help.etsy.com/hc/articles/360000338367
   US$ amounts (listing fee, Offsite Ads cap) are converted with the ECB reference rate of 17 Nov 2026
   (bancaditalia.it cambi_rif_20261117); the seller can edit the rate. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EFC = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var READ_ON = '18 Nov 2026';
  var ROF_SINCE = '22 June 2026';
  var FX_ON = '17 Nov 2026';
  var TX = 6.5;            // transaction fee % of item + shipping (+ gift wrap)
  var LISTING_USD = 0.20;  // per listing, and per extra item sold in one order
  var OFFSITE_CAP_USD = 100;
  var CONVERSION = 2.5;

  // pp/pf = processing % and fixed fee for domestic orders · ppi = % for international orders
  // rof = regulatory operating fee % (since 22 June 2026) · rofOld = the rate before that day
  // vat = VAT/GST % that Etsy adds on its fees when no VAT/GST ID is on file (national standard rate; edit it)
  // usd = 1 US$ in the local currency (ECB reference rate, 17 Nov 2026)
  var COUNTRIES = {
    US: { name: 'United States', cur: 'USD', sym: '$', pp: 3, ppi: 3, pf: 0.25, rof: 0, vat: 0, usd: 1 },
    GB: { name: 'United Kingdom', cur: 'GBP', sym: '£', pp: 4, ppi: 4, pf: 0.20, rof: 0.48, rofOld: 0.32, vat: 20, usd: 0.7581 },
    CA: { name: 'Canada', cur: 'CAD', sym: 'C$', pp: 3, ppi: 4, pf: 0.25, rof: 0.50, vat: 5, usd: 1.4291, intlNote: 'orders from Canada or the US pay 3 %, other countries 4 %' },
    AU: { name: 'Australia', cur: 'AUD', sym: 'A$', pp: 3, ppi: 4, pf: 0.25, rof: 0, vat: 10, usd: 1.4848, intlNote: 'domestic orders pay 3 %, international 4 %' },
    DE: { name: 'Germany', cur: 'EUR', sym: '€', pp: 4, ppi: 4, pf: 0.30, rof: 0, vat: 19, usd: 0.9100 },
    FR: { name: 'France', cur: 'EUR', sym: '€', pp: 4, ppi: 4, pf: 0.30, rof: 1.14, rofOld: 0.47, vat: 20, usd: 0.9100 },
    ES: { name: 'Spain', cur: 'EUR', sym: '€', pp: 4, ppi: 4, pf: 0.30, rof: 0.88, rofOld: 0.72, vat: 21, usd: 0.9100 },
    IT: { name: 'Italy', cur: 'EUR', sym: '€', pp: 4, ppi: 4, pf: 0.30, rof: 0.80, rofOld: 0.32, vat: 22, usd: 0.9100 },
    NL: { name: 'Netherlands', cur: 'EUR', sym: '€', pp: 4, ppi: 4, pf: 0.30, rof: 0, vat: 21, usd: 0.9100 },
    IE: { name: 'Ireland', cur: 'EUR', sym: '€', pp: 4, ppi: 4, pf: 0.30, rof: 0, vat: 23, usd: 0.9100, vatNote: 'Etsy charges Irish VAT on fees even with a VAT ID' },
    IN: { name: 'India', cur: 'INR', sym: '₹', pp: 5, ppi: 5, pf: 25, rof: 0.05, rofOld: 0.29, vat: 18, usd: 93.4753 },
    TR: { name: 'Türkiye', cur: 'TRY', sym: '₺', pp: 6.5, ppi: 6.5, pf: 14, rof: 1.67, rofOld: 2.27, vat: 20, usd: 50.4129 }
  };
  var ORDER = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'IN', 'TR'];

  function r2(v) { return Math.round((Number(v) + (v >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function num(v, d) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : (d === undefined ? 0 : d); }

  function money(v, cc) {
    var c = COUNTRIES[cc] || COUNTRIES.US;
    var neg = v < 0; var a = Math.abs(r2(v));
    var s = a.toFixed(2).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + c.sym + s[0] + '.' + s[1];
  }
  function pct(v, d) { return (Math.round(v * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).toFixed(d == null ? 1 : d) + ' %'; }

  function defaults(cc) {
    var c = COUNTRIES[cc] || COUNTRIES.US;
    return { vat: c.vat, usd: c.usd };
  }

  // one order of one listing → every Etsy fee line, the deposit and the profit
  function sale(inp) {
    var cc = COUNTRIES[inp.country] ? inp.country : 'US';
    var c = COUNTRIES[cc];
    var qty = Math.max(1, Math.round(num(inp.qty, 1)));
    var price = Math.max(0, num(inp.price));
    var ship = Math.max(0, num(inp.ship));
    var disc = Math.min(100, Math.max(0, num(inp.disc)));
    var taxPct = Math.max(0, num(inp.tax));
    var usd = num(inp.usd, c.usd) > 0 ? num(inp.usd, c.usd) : c.usd;
    var vatPct = inp.vat === '' || inp.vat == null ? c.vat : Math.max(0, num(inp.vat));
    var intl = inp.intl === 'yes' || inp.intl === true;
    var conv = inp.conv === 'yes' || inp.conv === true;
    var off = String(inp.offsite || 'no');
    var offRate = off === '15' ? 15 : off === '12' ? 12 : 0;

    var items = r2(price * qty);
    var discount = r2(items * disc / 100);
    var itemsNet = r2(items - discount);
    var order = r2(itemsNet + ship);                 // base of transaction fee, regulatory fee, Offsite Ads
    var tax = r2(order * taxPct / 100);              // collected by Etsy, passed on (not the seller's money)
    var buyer = r2(order + tax);                     // base of payment processing (Etsy: incl. shipping and sales tax)
    var ppRate = intl ? c.ppi : c.pp;

    var L = {};
    L.listing = r2(LISTING_USD * usd * qty);
    L.transaction = r2(order * TX / 100);
    L.processing = r2(buyer * ppRate / 100 + c.pf);
    L.rof = r2(order * c.rof / 100);
    L.conversion = conv ? r2(order * CONVERSION / 100) : 0;
    L.offsite = offRate ? r2(Math.min(order * offRate / 100, OFFSITE_CAP_USD * usd)) : 0;
    var vatBase = L.listing + L.transaction + L.processing + L.rof + L.conversion + L.offsite;
    L.vat = r2(vatBase * vatPct / 100);
    var fees = r2(L.listing + L.transaction + L.processing + L.rof + L.conversion + L.offsite + L.vat);
    var deposit = r2(order - fees);
    var cost = Math.max(0, num(inp.cost));
    var label = Math.max(0, num(inp.label));
    var costs = r2(cost * qty + label);
    var profit = r2(deposit - costs);
    var out = {
      country: cc, c: c, qty: qty, price: price, items: items, discount: discount, ship: ship, order: order, tax: tax, taxPct: taxPct,
      buyer: buyer, ppRate: ppRate, vatPct: vatPct, usd: usd, offRate: offRate, lines: L, fees: fees, deposit: deposit,
      costs: costs, cost: cost, label: label, profit: profit,
      margin: order > 0 ? profit / order * 100 : 0, feePct: order > 0 ? fees / order * 100 : 0
    };
    return out;
  }

  // the same order if it came through an Offsite Ad (15 % or the chosen rate), VAT on that fee included
  function offsiteWhatIf(inp) {
    var base = sale(inp);
    var rate = base.offRate || 15;
    var withAd = sale(Object.assign({}, inp, { offsite: String(rate) }));
    var noAd = sale(Object.assign({}, inp, { offsite: 'no' }));
    return { rate: rate, extra: r2(withAd.fees - noAd.fees), profit: withAd.profit, without: noAd.profit, already: !!base.offRate };
  }

  // smallest item price (to the cent) that reaches the goal; goal(s) → true when good. Profit grows with price.
  function solvePrice(inp, goal) {
    var lo = 0, hi = 100000000;   // cents
    var t = function (cents) { return goal(sale(Object.assign({}, inp, { price: cents / 100 }))); };
    if (!t(hi)) return null;
    while (hi - lo > 1) { var mid = Math.floor((lo + hi) / 2); if (t(mid)) hi = mid; else lo = mid; }
    return t(lo) ? lo / 100 : hi / 100;
  }
  function breakEven(inp) { return solvePrice(inp, function (s) { return s.profit >= 0; }); }
  function targetPrice(inp, marginPct) {
    var m = num(marginPct, 30);
    if (m >= 95) return null;
    return solvePrice(inp, function (s) { return s.order > 0 && s.profit >= s.order * m / 100 - 1e-9; });
  }

  function full(inp) {
    var s = sale(inp);
    s.whatIf = offsiteWhatIf(inp);
    s.breakEven = breakEven(inp);
    s.target = num(inp.target, 30);
    s.targetPrice = targetPrice(inp, s.target);
    return s;
  }

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

  // "$1,234.56" · "-$1.00" · "($1.00)" · "€3,20" · "1.234,56 €" · "--" → number (NaN when empty)
  function amount(s) {
    var v = String(s == null ? '' : s).trim();
    if (!v || /^-+$/.test(v) || /^n\/?a$/i.test(v)) return NaN;
    var neg = /^\(.*\)$/.test(v) || /^[^\d]*[-−–]/.test(v) || /[-−–]$/.test(v);
    v = v.replace(/[^\d.,]/g, '');
    if (!v) return NaN;
    var lastC = v.lastIndexOf(','), lastD = v.lastIndexOf('.');
    if (lastC >= 0 && lastD >= 0) {                       // both: the later one is the decimal mark
      v = lastC > lastD ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
    } else if (lastC >= 0) {                              // only commas: "3,20" decimal · "1,234" / "1,234,567" thousands
      var parts = v.split(',');
      v = (parts.length === 2 && parts[1].length !== 3) ? parts[0] + '.' + parts[1] : parts.join('');
    } else if (v.split('.').length > 2) {                 // "1.234.567" thousands
      v = v.replace(/\./g, '');
    }
    var n = parseFloat(v);
    if (!isFinite(n)) return NaN;
    return neg ? -n : n;
  }

  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function ym(dateStr) {
    var s = String(dateStr || '').trim(), m;
    if ((m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + '-' + ('0' + m[2]).slice(-2);
    if ((m = /([A-Za-z]{3})[a-z]*\.?\s+\d{1,2},?\s+(\d{4})/.exec(s)) && MONTHS[m[1].toLowerCase()]) return m[2] + '-' + ('0' + MONTHS[m[1].toLowerCase()]).slice(-2);
    if ((m = /\d{1,2}\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(s)) && MONTHS[m[1].toLowerCase()]) return m[2] + '-' + ('0' + MONTHS[m[1].toLowerCase()]).slice(-2);
    if ((m = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/.exec(s))) {
      var a = +m[1], b = +m[2], y = m[3].length === 2 ? '20' + m[3] : m[3];
      var mo = a > 12 ? b : a;   // 31/10/2026 → 10 · 10/31/2026 → 10
      return y + '-' + ('0' + mo).slice(-2);
    }
    return '';
  }
  function monthOfFile(name) {
    var m = /(\d{4})[_-](\d{1,2})(?!\d)/.exec(String(name || ''));
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
  }
  function col(header, rxs) {
    for (var k = 0; k < rxs.length; k++) for (var i = 0; i < header.length; i++) if (rxs[k].test(String(header[i]).trim())) return i;
    return -1;
  }

  var CATS = [
    ['listing', 'Listing fees'], ['transaction', 'Transaction fees (6.5 %)'], ['processing', 'Payment processing'],
    ['rof', 'Regulatory operating fee'], ['offsite', 'Offsite Ads fees'], ['ads', 'Etsy Ads'], ['labels', 'Shipping labels'],
    ['vat', 'VAT / GST on fees'], ['conversion', 'Currency conversion'], ['subscription', 'Subscriptions (Etsy Plus and others)'],
    ['otherfees', 'Other fees'], ['credits', 'Credits from Etsy'], ['refunds', 'Money sent back to buyers'], ['tax', 'Sales tax lines'],
    ['other', 'Other lines']
  ];
  var FEE_KEYS = ['listing', 'transaction', 'processing', 'rof', 'offsite', 'vat', 'conversion', 'subscription', 'otherfees'];
  var BOUGHT_KEYS = ['ads', 'labels'];   // bought through Etsy, not Etsy's selling fees

  function category(type, title) {
    var ty = String(type || '').toLowerCase(), ti = String(title || '').toLowerCase();
    if (/deposit|payment to bank|sent to your bank/.test(ty) || /sent to your bank|deposit to/.test(ti)) return 'deposit';
    if (/^payment$|^bill|card payment/.test(ty) || /^payment (made|received) |paid your etsy bill/.test(ti)) return 'transfer';
    if (/refund/.test(ty) || /^refund/.test(ti)) return 'refunds';
    if (/^sale/.test(ty)) return 'sale';
    if (/share ?& ?save|credit/.test(ti) && !/fee/.test(ti)) return 'credits';
    if (/regulatory operating/.test(ti)) return 'rof';
    if (/offsite ads/.test(ti)) return 'offsite';
    if (/transaction fee/.test(ti)) return 'transaction';
    if (/processing fee/.test(ti)) return 'processing';
    if (/listing fee|auto.?renew|renew sold|renew expired/.test(ti)) return 'listing';
    if (/currency conversion/.test(ti)) return 'conversion';
    if (/^vat|vat\b|gst|hst|\bqst/.test(ty) || /^vat|\bvat:|vat on|gst|hst/.test(ti)) return 'vat';
    if (/shipping|postage|label/.test(ty) || /shipping label|postage label|label/.test(ti)) return 'labels';
    if (/marketing/.test(ty) || /etsy ads|promoted listing/.test(ti)) return 'ads';
    if (/subscription|etsy plus|pattern/.test(ti)) return 'subscription';
    if (/^tax/.test(ty) || /sales tax/.test(ti)) return 'tax';
    if (/^fee/.test(ty) || /fee/.test(ti)) return 'otherfees';
    return 'other';
  }

  // Etsy's monthly statement CSV (Shop Manager → Finances → Monthly statements → Download CSV)
  // columns: Date, Type, Title, Info, Currency, Amount, Fees & Taxes, Net (later files may add Tax Details)
  function statement(text, fileName) {
    var rows = parseCSV(text);
    if (!rows.length) return { ok: false, why: 'The file is empty.' };
    var h = rows[0].map(function (x) { return String(x).trim(); });
    var I = {
      date: col(h, [/^date$/i, /date/i]), type: col(h, [/^type$/i]), title: col(h, [/^title$/i, /description/i]), info: col(h, [/^info$/i]),
      cur: col(h, [/^currency$/i]), amt: col(h, [/^amount$/i, /^gross/i]), fee: col(h, [/fees?\s*&\s*tax/i, /^fees?$/i]), net: col(h, [/^net$/i, /^net amount/i])
    };
    if (I.type < 0 || I.title < 0 || (I.net < 0 && I.amt < 0)) {
      return { ok: false, why: 'This does not look like an Etsy monthly statement: the columns Type, Title and Net (or Amount) were not found. Found: ' + h.slice(0, 9).join(', ') };
    }
    var S = { ok: true, file: fileName || '', rows: 0, sales: 0, saleRows: 0, orders: {}, net: 0, deposits: 0, cats: {}, titles: {}, months: {}, curs: {}, lines: [] };
    CATS.forEach(function (c) { S.cats[c[0]] = 0; });
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r]; if (!row || row.length < 2) continue;
      var type = row[I.type] || '', title = row[I.title] || '', info = I.info >= 0 ? row[I.info] || '' : '';
      var a = I.amt >= 0 ? amount(row[I.amt]) : NaN, f = I.fee >= 0 ? amount(row[I.fee]) : NaN, n = I.net >= 0 ? amount(row[I.net]) : NaN;
      var val = isFinite(n) ? n : (isFinite(a) ? a : 0) + (isFinite(f) ? f : 0);
      var cat = category(type, title);
      if (I.cur >= 0 && row[I.cur]) S.curs[row[I.cur]] = (S.curs[row[I.cur]] || 0) + 1;
      if (I.date >= 0) { var k = ym(row[I.date]); if (k) S.months[k] = (S.months[k] || 0) + 1; }
      S.rows++;
      if (cat === 'deposit' || cat === 'transfer') {
        S.deposits += isFinite(a) ? Math.abs(a) : 0;
        S.lines.push({ date: I.date >= 0 ? row[I.date] : '', type: type, title: title, info: info, value: isFinite(n) ? r2(n) : '', cat: cat });
        continue;
      }
      S.net += val;
      if (cat === 'sale') {
        var gross = isFinite(a) ? a : val - (isFinite(f) ? f : 0);
        S.sales += gross; S.saleRows++;
        var feePart = isFinite(f) ? f : 0;
        S.cats.processing += feePart;
        var rest = val - gross - feePart;
        if (Math.abs(rest) > 0.004) S.cats.other += rest;
        var om = /order\s*#?\s*(\d+)/i.exec(title + ' ' + info); if (om) S.orders[om[1]] = 1;
      } else {
        S.cats[cat] = (S.cats[cat] || 0) + val;
      }
      var key = String(title).trim() || '(no title)';
      var tk = S.titles[key] || (S.titles[key] = { title: key, cat: cat, n: 0, total: 0 });
      tk.n++; tk.total += val;
      S.lines.push({ date: I.date >= 0 ? row[I.date] : '', type: type, title: title, info: info, value: r2(val), cat: cat });
    }
    var mk = monthOfFile(fileName) || pickMax(S.months) || '';
    var cur = pickMax(S.curs) || '';
    var fees = 0; FEE_KEYS.forEach(function (k) { fees += S.cats[k]; });
    var bought = 0; BOUGHT_KEYS.forEach(function (k) { bought += S.cats[k]; });
    Object.keys(S.cats).forEach(function (k) { S.cats[k] = r2(S.cats[k]); });
    var named = S.sales; CATS.forEach(function (c) { named += S.cats[c[0]]; });
    return {
      ok: true, month: mk, currency: cur, file: S.file, rows: S.rows, lineCount: S.rows,
      sales: r2(S.sales), saleRows: S.saleRows, orders: Object.keys(S.orders).length,
      cats: S.cats, fees: r2(fees), feePct: S.sales > 0 ? -fees / S.sales * 100 : 0, bought: r2(bought),
      net: r2(S.net), check: r2(S.net - named), deposits: r2(S.deposits),
      titles: Object.keys(S.titles).map(function (k) { var t = S.titles[k]; t.total = r2(t.total); return t; })
        .sort(function (x, y) { return Math.abs(y.total) - Math.abs(x.total); }),
      lines: S.lines
    };
  }
  function pickMax(o) { var best = '', n = -1; Object.keys(o || {}).forEach(function (k) { if (o[k] > n) { n = o[k]; best = k; } }); return best; }

  // Etsy's Order Items CSV (Shop Manager → Settings → Options → Download Data → Order Items)
  function orderItems(text, fileName) {
    var rows = parseCSV(text);
    if (!rows.length) return { ok: false, why: 'The file is empty.' };
    var h = rows[0].map(function (x) { return String(x).trim(); });
    var I = {
      name: col(h, [/^item name$/i, /^title$/i, /item name/i]), qty: col(h, [/^quantity$/i, /^qty$/i]),
      price: col(h, [/^price$/i, /^item price$/i]), total: col(h, [/^item total$/i]), sku: col(h, [/^sku$/i]),
      lid: col(h, [/^listing id$/i]), date: col(h, [/^sale date$/i, /^date paid$/i, /date/i])
    };
    if (I.name < 0 || I.qty < 0 || (I.price < 0 && I.total < 0)) {
      return { ok: false, why: 'This does not look like Etsy\'s Order Items file: the columns Item Name, Quantity and Price (or Item Total) were not found. Found: ' + h.slice(0, 9).join(', ') };
    }
    var map = {}, months = {}, units = 0;
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r]; if (!row || row.length < 2) continue;
      var q = Math.max(0, Math.round(amount(row[I.qty]) || 0));
      var tot = I.total >= 0 ? amount(row[I.total]) : NaN;
      var pr = I.price >= 0 ? amount(row[I.price]) : NaN;
      var sales = isFinite(tot) ? tot : (isFinite(pr) ? pr * q : 0);
      var name = String(row[I.name] || '').trim();
      var sku = I.sku >= 0 ? String(row[I.sku] || '').trim() : '';
      var lid = I.lid >= 0 ? String(row[I.lid] || '').trim() : '';
      var key = sku ? 'sku:' + sku : lid ? 'lid:' + lid : 'name:' + name.toLowerCase();
      var it = map[key] || (map[key] = { key: key, name: name, sku: sku, listingId: lid, qty: 0, sales: 0 });
      it.qty += q; it.sales += sales; units += q;
      if (I.date >= 0) { var k = ym(row[I.date]); if (k) months[k] = (months[k] || 0) + 1; }
    }
    var items = Object.keys(map).map(function (k) { map[k].sales = r2(map[k].sales); return map[k]; })
      .sort(function (a, b) { return b.sales - a.sales; });
    return { ok: true, month: monthOfFile(fileName) || pickMax(months), items: items, units: units };
  }

  function cogs(items, unitCosts) {
    var total = 0, missing = 0;
    (items || []).forEach(function (it) {
      var u = unitCosts && unitCosts[it.key];
      if (u === undefined || u === '' || !isFinite(num(u, NaN))) { missing++; return; }
      total += num(u) * it.qty;
    });
    return { total: r2(total), missing: missing };
  }

  function monthResult(st, cogsTotal, otherCosts) {
    var profit = r2(st.net - num(cogsTotal) - num(otherCosts));
    return { profit: profit, margin: st.sales > 0 ? profit / st.sales * 100 : 0 };
  }

  function csv(rows) {
    return rows.map(function (r) {
      return r.map(function (v) {
        var s = v == null ? '' : String(v);
        return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n') + '\r\n';
  }

  return {
    READ_ON: READ_ON, ROF_SINCE: ROF_SINCE, FX_ON: FX_ON, TX: TX, LISTING_USD: LISTING_USD, OFFSITE_CAP_USD: OFFSITE_CAP_USD, CONVERSION: CONVERSION,
    COUNTRIES: COUNTRIES, ORDER: ORDER, CATS: CATS, FEE_KEYS: FEE_KEYS, BOUGHT_KEYS: BOUGHT_KEYS,
    r2: r2, num: num, money: money, pct: pct, defaults: defaults,
    sale: sale, offsiteWhatIf: offsiteWhatIf, breakEven: breakEven, targetPrice: targetPrice, full: full,
    parseCSV: parseCSV, amount: amount, ym: ym, monthOfFile: monthOfFile, category: category,
    statement: statement, orderItems: orderItems, cogs: cogs, monthResult: monthResult, csv: csv
  };
});
