/* Etsy bookkeeping spreadsheet - browser-only app. Data stays in this browser (localStorage).
   Fee rates read 2026-11-15 from Etsy Help: Etsy Fee Basics (360035902374), Payment Processing Fees (115015628847),
   Regulatory Operating Fee (1500011073202), Offsite Ads (360000338367). Schedule C / SE lines from the IRS 2026 forms. */
(function (root) {
  'use strict';
  var SLUG = 'etsy-bookkeeping-spreadsheet';
  var DOORS = [SLUG, SLUG + '.monthly'];

  // location of the bank account -> processing % + flat per order, regulatory operating fee %, currency
  var COUNTRIES = {
    US: { name: 'United States', pct: 3, flat: 0.25, rof: 0, cur: 'USD', sym: '$', loc: 'en-US', schc: true },
    UK: { name: 'United Kingdom', pct: 4, flat: 0.20, rof: 0.48, cur: 'GBP', sym: '£', loc: 'en-GB' },
    CA: { name: 'Canada (domestic or US orders)', pct: 3, flat: 0.25, rof: 0.50, cur: 'CAD', sym: 'C$', loc: 'en-CA' },
    AU: { name: 'Australia (domestic orders)', pct: 3, flat: 0.25, rof: 0, cur: 'AUD', sym: 'A$', loc: 'en-AU' },
    DE: { name: 'Germany', pct: 4, flat: 0.30, rof: 0, cur: 'EUR', sym: '€', loc: 'en-IE' },
    FR: { name: 'France', pct: 4, flat: 0.30, rof: 1.14, cur: 'EUR', sym: '€', loc: 'en-IE' },
    ES: { name: 'Spain', pct: 4, flat: 0.30, rof: 0.88, cur: 'EUR', sym: '€', loc: 'en-IE' },
    IT: { name: 'Italy', pct: 4, flat: 0.30, rof: 0.80, cur: 'EUR', sym: '€', loc: 'en-IE' },
    HU: { name: 'Hungary', pct: 4, flat: 0.30, rof: 1.97, cur: 'EUR', sym: '€', loc: 'en-IE' },
    EU: { name: 'Other EU (NL, IE, AT, BE, PT ...)', pct: 4, flat: 0.30, rof: 0, cur: 'EUR', sym: '€', loc: 'en-IE' }
  };
  var TXN = 6.5;            // % of item + shipping + gift wrap
  var SE_BASE = 0.9235, SE_RATE = 0.153;   // Schedule SE 2026 lines 4a, 10 + 11

  function r2(x) { return Math.round((+x || 0) * 100) / 100; }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).trim();
    if (!s || s === '--' || s === '-') return 0;
    var neg = /^\s*\(/.test(s) || /^[^\d]*[-\u2212]/.test(s);
    s = s.replace(/[^\d.,]/g, '');
    if (!s) return 0;
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > ld) { s = (s.length - lc - 1 === 3 && ld < 0 && s.split(',').length > 1 && !/,\d{1,2}$/.test(s)) ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.'); }
    else { s = s.replace(/,/g, ''); }
    var n = parseFloat(s) || 0;
    return neg ? -n : n;
  }
  function money(x, c) {
    c = c || COUNTRIES.US;
    var v = r2(x), a = Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (v < 0 ? '-' : '') + c.sym + a;
  }

  /* ---------- the year in numbers (free, on screen) ---------- */
  function compute(i) {
    var c = COUNTRIES[i.country] || COUNTRIES.US;
    var sales = num(i.sales), orders = Math.max(0, Math.round(num(i.orders))), taxcol = num(i.taxcol);
    var offs = num(i.offsite), offrate = num(i.offrate) || 15;
    var f = {
      transaction: r2(sales * TXN / 100),
      processing: r2((sales + taxcol) * c.pct / 100 + orders * c.flat),
      regulatory: r2(sales * c.rof / 100),
      offsite: r2(offs * offrate / 100),
      listing: r2(num(i.listing)),
      ads: r2(num(i.ads))
    };
    var etsyFees = r2(f.transaction + f.processing + f.regulatory + f.offsite + f.listing + f.ads);
    var labels = r2(num(i.labels)), returns = r2(num(i.returns)), cogs = r2(num(i.cogs)), supplies = r2(num(i.supplies));
    var deposits = r2(sales - returns - etsyFees - labels);
    var profit = r2(sales - returns - etsyFees - labels - cogs - supplies);
    var missed = r2(etsyFees + labels);                       // what Etsy keeps before the money reaches the bank
    var seOnMissed = c.schc ? r2(missed * SE_BASE * SE_RATE) : 0;
    var schc = c.schc ? {
      l1: r2(sales), l2: returns, l4: cogs,
      l8: r2(f.ads + f.offsite), l10: r2(f.transaction + f.processing + f.regulatory + f.listing),
      l22: supplies, l27b: labels
    } : null;
    if (schc) {
      schc.l3 = r2(schc.l1 - schc.l2); schc.l5 = r2(schc.l3 - schc.l4);
      schc.l28 = r2(schc.l8 + schc.l10 + schc.l22 + schc.l27b); schc.l31 = r2(schc.l5 - schc.l28);
    }
    return {
      c: c, fees: f, etsyFees: etsyFees, labels: labels, returns: returns, cogs: cogs, supplies: supplies,
      sales: r2(sales), orders: orders, deposits: deposits, profit: profit, missed: missed, seOnMissed: seOnMissed,
      feeShare: sales ? r2(etsyFees / sales * 100) : 0, margin: sales ? r2(profit / sales * 100) : 0,
      perOrderFee: orders ? r2(etsyFees / orders) : 0, schc: schc
    };
  }

  /* ---------- Etsy statement CSV import (Pro) ---------- */
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false, i, ch;
    text = String(text || '').replace(/^﻿/, '');
    var delim = (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length) ? ';' : ',';
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function monthOf(s) {
    s = String(s || '').trim();
    var m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2);
    m = s.match(/([A-Za-z]{3})[a-z]*\.?\s+\d{1,2},?\s+(\d{4})/); if (m && MONTHS[m[1].toLowerCase()]) return m[2] + '-' + ('0' + MONTHS[m[1].toLowerCase()]).slice(-2);
    m = s.match(/\d{1,2}\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/); if (m && MONTHS[m[1].toLowerCase()]) return m[2] + '-' + ('0' + MONTHS[m[1].toLowerCase()]).slice(-2);
    m = s.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/);
    if (m) { var y = m[3].length === 2 ? '20' + m[3] : m[3]; var mo = +m[1] > 12 ? m[2] : m[1]; return y + '-' + ('0' + mo).slice(-2); }
    return '';
  }
  var CATS = ['sales', 'returns', 'taxcol', 'transaction', 'processing', 'regulatory', 'offsite', 'listing', 'ads', 'labels', 'feevat', 'otherfee', 'deposit', 'unsorted'];
  var CAT_NAME = {
    sales: 'Sales (items + shipping)', returns: 'Money sent back to buyers', taxcol: 'Sales tax / VAT collected by Etsy (pass-through)',
    transaction: 'Transaction fees 6.5%', processing: 'Payment processing fees', regulatory: 'Regulatory operating fee',
    offsite: 'Offsite Ads fees', listing: 'Listing + renewal fees', ads: 'Etsy Ads', labels: 'Shipping labels bought on Etsy',
    feevat: 'VAT on Etsy fees', otherfee: 'Other Etsy charges (subscriptions, Pattern ...)', deposit: 'Deposits to your bank (transfer)', unsorted: 'Not sorted - check these rows'
  };
  function classify(type, title, info) {
    var t = (type + ' | ' + title + ' | ' + info).toLowerCase(), ty = String(type || '').toLowerCase();
    if (/deposit|sent to your bank|withdraw|payout/.test(t)) return 'deposit';
    if (/refund|reversal of payment/.test(t)) return 'returns';
    if (/regulatory/.test(t)) return 'regulatory';
    if (/offsite/.test(t)) return 'offsite';
    if (/transaction fee/.test(t)) return 'transaction';
    if (/processing fee/.test(t)) return 'processing';
    if (/listing fee|renew|auto-renew|multi-quantity/.test(t)) return 'listing';
    if (/etsy ads|promoted listing|marketing/.test(t)) return 'ads';
    if (/shipping label|postage|usps|royal mail|canada post|fedex|ups label|label/.test(t)) return 'labels';
    if (/vat:|vat on|vat \(|fee vat|gst on/.test(t) && ty !== 'tax') return 'feevat';
    if (/sales tax|vat paid by buyer|tax collected|^tax/.test(t) || ty === 'tax') return 'taxcol';
    if (/etsy plus|subscription|pattern|share save|set-up fee|setup fee/.test(t)) return 'otherfee';
    if (ty === 'sale' || /payment for order|order #/.test(t)) return 'sales';
    if (ty === 'fee') return 'otherfee';
    return 'unsorted';
  }
  function findCol(head, re) { for (var i = 0; i < head.length; i++) if (re.test(String(head[i]).toLowerCase().trim())) return i; return -1; }
  function importStatement(text) {
    var rows = parseCSV(text), hi = -1, k;
    for (k = 0; k < Math.min(rows.length, 15); k++) {
      if (findCol(rows[k], /^date|sale date/) >= 0 && (findCol(rows[k], /^amount|order value|net/) >= 0)) { hi = k; break; }
    }
    if (hi < 0) return { ok: false, why: 'No header row with Date and Amount/Net found. Download the CSV from Shop Manager > Finances > Monthly statements (or Orders > Download CSV).', rows: [] };
    var h = rows[hi];
    var col = {
      date: findCol(h, /^date|sale date/), type: findCol(h, /^type$/), title: findCol(h, /^title|^item name/), info: findCol(h, /^info|order id/),
      amount: findCol(h, /^amount$|^order value/), fees: findCol(h, /fees|card processing fees/), net: findCol(h, /^net$|order net/),
      ship: findCol(h, /^shipping$/), tax: findCol(h, /^sales tax$/), cur: findCol(h, /^currency/)
    };
    var isOrders = col.type < 0 && col.amount >= 0 && /order value/i.test(h[col.amount]);
    var out = [], g = function (r, i) { return i >= 0 ? (r[i] == null ? '' : r[i]) : ''; };
    var hasProcRows = false;
    for (k = hi + 1; k < rows.length; k++) {
      var r = rows[k]; if (!r || r.join('').trim() === '') continue;
      var mo = monthOf(g(r, col.date));
      if (isOrders) {
        var ov = num(g(r, col.amount)) + num(g(r, col.ship));
        out.push({ m: mo, cat: 'sales', amt: r2(ov), desc: 'Order ' + g(r, col.info) });
        if (col.tax >= 0 && num(g(r, col.tax))) out.push({ m: mo, cat: 'taxcol', amt: r2(Math.abs(num(g(r, col.tax)))), desc: 'Sales tax order ' + g(r, col.info) });
        if (col.fees >= 0 && num(g(r, col.fees))) out.push({ m: mo, cat: 'processing', amt: r2(Math.abs(num(g(r, col.fees)))), desc: 'Processing order ' + g(r, col.info) });
        continue;
      }
      var type = g(r, col.type), title = g(r, col.title), info = g(r, col.info);
      var cat = classify(type, title, info);
      if (cat === 'processing') hasProcRows = true;
      var a = num(g(r, col.amount)), fe = num(g(r, col.fees)), ne = num(g(r, col.net));
      var v;
      if (cat === 'sales') v = a || ne;
      else if (cat === 'deposit') { v = Math.abs(a || ne); if (!v) { var mt = (title + ' ' + info).match(/[$£€]\s?[\d.,]+|[\d.,]+\s?[$£€]/); v = mt ? Math.abs(num(mt[0])) : 0; } }
      else v = Math.abs(ne || fe || a);
      out.push({ m: mo, cat: cat, amt: r2(v), desc: (type ? type + ': ' : '') + title + (info ? ' (' + info + ')' : ''), fe: (cat === 'sales' ? Math.abs(fe) : 0) });
    }
    if (!hasProcRows) out.forEach(function (x) { if (x.cat === 'sales' && x.fe) out.push({ m: x.m, cat: 'processing', amt: r2(x.fe), desc: 'Fee on ' + x.desc }); });
    out.forEach(function (x) { delete x.fe; });
    return { ok: true, rows: out, kind: isOrders ? 'orders' : 'statement' };
  }
  function totals(rows) {
    var t = {}; CATS.forEach(function (c) { t[c] = 0; });
    rows.forEach(function (x) { t[x.cat] = r2((t[x.cat] || 0) + x.amt); });
    return t;
  }
  function months(rows, expenses) {
    var by = {};
    rows.forEach(function (x) { var k = x.m || 'undated'; (by[k] = by[k] || []).push(x); });
    (expenses || []).forEach(function (e) { var k = e.m || 'undated'; (by[k] = by[k] || []).push({ m: k, cat: e.cat === 'cogs' ? 'cogs' : 'supplies', amt: r2(num(e.amt)) }); });
    return Object.keys(by).sort().map(function (k) {
      var t = totals(by[k].filter(function (x) { return CATS.indexOf(x.cat) >= 0; }));
      var cogs = 0, sup = 0; by[k].forEach(function (x) { if (x.cat === 'cogs') cogs += x.amt; if (x.cat === 'supplies') sup += x.amt; });
      var fees = r2(t.transaction + t.processing + t.regulatory + t.offsite + t.listing + t.ads + t.feevat + t.otherfee);
      return { m: k, sales: t.sales, returns: t.returns, fees: fees, labels: t.labels, cogs: r2(cogs), supplies: r2(sup), deposits: t.deposit,
        profit: r2(t.sales - t.returns - fees - t.labels - cogs - sup), unsorted: by[k].filter(function (x) { return x.cat === 'unsorted'; }).length };
    });
  }
  function bookSchC(rows, expenses) {
    var t = totals(rows), cogs = 0, sup = 0;
    (expenses || []).forEach(function (e) { if (e.cat === 'cogs') cogs += num(e.amt); else sup += num(e.amt); });
    var s = { l1: t.sales, l2: t.returns, l4: r2(cogs), l8: r2(t.ads + t.offsite), l10: r2(t.transaction + t.processing + t.regulatory + t.listing + t.feevat + t.otherfee), l22: r2(sup), l27b: t.labels };
    s.l3 = r2(s.l1 - s.l2); s.l5 = r2(s.l3 - s.l4); s.l28 = r2(s.l8 + s.l10 + s.l22 + s.l27b); s.l31 = r2(s.l5 - s.l28);
    return s;
  }
  function dedupe(oldRows, newRows) {
    var seen = {}; oldRows.forEach(function (x) { seen[x.m + '|' + x.cat + '|' + x.amt + '|' + x.desc] = 1; });
    var added = newRows.filter(function (x) { var k = x.m + '|' + x.cat + '|' + x.amt + '|' + x.desc; if (seen[k]) return false; seen[k] = 1; return true; });
    return { rows: oldRows.concat(added), added: added.length, skipped: newRows.length - added.length };
  }

  /* ---------- files (Pro) ---------- */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, 'utf8'));
  }
  function zip(files) {            // stored (no compression) zip
    var parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(Uint8Array.from(lh), name, data);
      central.push(Uint8Array.from([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += lh.length + name.length + data.length;
    });
    var csize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = Uint8Array.from([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(off), u16(0)));
    var all = parts.concat(central, [end]), len = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(len), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(n) { var s = ''; n++; while (n) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function sheetXml(rows) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    rows.forEach(function (r, ri) {
      x += '<row r="' + (ri + 1) + '">';
      r.forEach(function (v, ci) {
        var ref = colName(ci) + (ri + 1);
        if (v && typeof v === 'object' && v.f) x += '<c r="' + ref + '"><f>' + esc(v.f) + '</f><v>' + (v.v || 0) + '</v></c>';
        else if (typeof v === 'number') x += '<c r="' + ref + '"><v>' + v + '</v></c>';
        else x += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      });
      x += '</row>';
    });
    return x + '</sheetData></worksheet>';
  }
  function xlsx(sheets) {          // sheets: [{name, rows}]
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    var rel = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    var files = [];
    sheets.forEach(function (s, i) {
      var n = i + 1;
      ct += '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      wb += '<sheet name="' + esc(s.name.slice(0, 31)) + '" sheetId="' + n + '" r:id="rId' + n + '"/>';
      rel += '<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
      files.push({ name: 'xl/worksheets/sheet' + n + '.xml', data: sheetXml(s.rows) });
    });
    ct += '</Types>'; wb += '</sheets><calcPr fullCalcOnLoad="1"/></workbook>'; rel += '</Relationships>';
    return zip([
      { name: '[Content_Types].xml', data: ct },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: wb },
      { name: 'xl/_rels/workbook.xml.rels', data: rel }
    ].concat(files));
  }
  function bookWorkbook(book) {
    var rows = book.rows || [], ex = book.expenses || [];
    var led = [['Month', 'Category', 'Description', 'Amount']];
    rows.forEach(function (x) { led.push([x.m, CAT_NAME[x.cat] || x.cat, x.desc, x.amt]); });
    ex.forEach(function (e) { led.push([e.m, e.cat === 'cogs' ? 'Cost of goods (your entry)' : 'Supplies / other (your entry)', e.desc, r2(num(e.amt))]); });
    var ms = months(rows, ex), pl = [['Month', 'Sales', 'Returns', 'Etsy fees', 'Shipping labels', 'Cost of goods', 'Supplies', 'Profit', 'Deposits to bank']];
    ms.forEach(function (m, i) { var rr = i + 2; pl.push([m.m, m.sales, m.returns, m.fees, m.labels, m.cogs, m.supplies, { f: 'B' + rr + '-C' + rr + '-D' + rr + '-E' + rr + '-F' + rr + '-G' + rr, v: m.profit }, m.deposits]); });
    var n = ms.length + 1;
    pl.push(['Total', { f: 'SUM(B2:B' + n + ')' }, { f: 'SUM(C2:C' + n + ')' }, { f: 'SUM(D2:D' + n + ')' }, { f: 'SUM(E2:E' + n + ')' }, { f: 'SUM(F2:F' + n + ')' }, { f: 'SUM(G2:G' + n + ')' }, { f: 'SUM(H2:H' + n + ')' }, { f: 'SUM(I2:I' + n + ')' }]);
    var s = bookSchC(rows, ex);
    var sc = [['Schedule C (Form 1040) line', 'Amount', 'From'],
      ['1 Gross receipts or sales', s.l1, 'Etsy sales rows (items + shipping), sales tax excluded'], ['2 Returns and allowances', s.l2, 'money sent back to buyers'],
      ['3 Subtract line 2 from line 1', { f: 'B2-B3', v: s.l3 }, ''], ['4 Cost of goods sold', s.l4, 'your cost-of-goods entries (Part III builds the real line 4)'],
      ['5 Gross profit', { f: 'B4-B5', v: s.l5 }, ''], ['8 Advertising', s.l8, 'Etsy Ads + Offsite Ads fees'],
      ['10 Commissions and fees', s.l10, 'transaction, processing, regulatory, listing fees, VAT on fees, other Etsy charges'],
      ['22 Supplies', s.l22, 'your supplies entries'], ['27b Other expenses (Part V: postage)', s.l27b, 'shipping labels bought on Etsy'],
      ['28 Total expenses', { f: 'B7+B8+B9+B10', v: s.l28 }, ''], ['31 Net profit (before home office)', { f: 'B6-B11', v: s.l31 }, '']];
    return xlsx([{ name: 'Monthly P&L', rows: pl }, { name: 'Ledger', rows: led }, { name: 'Schedule C lines', rows: sc }]);
  }
  function icsMonthly(year, today) {   // a "close last month" reminder on the 2nd of each month, from today on
    var ev = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//yoojin//etsy-bookkeeping//EN\r\n', n = 0;
    for (var m = 1; m <= 12; m++) {
      var d = year + ('0' + m).slice(-2) + '02';
      if (today && d < today) continue;
      var prev = m === 1 ? 'December ' + (year - 1) : ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November'][m - 1] + ' ' + year;
      ev += 'BEGIN:VEVENT\r\nUID:ebs-' + d + '@yoojin\r\nDTSTAMP:' + (today || d) + 'T000000Z\r\nDTSTART;VALUE=DATE:' + d + '\r\nSUMMARY:Etsy books: import the ' + prev + ' statement CSV\r\nDESCRIPTION:Shop Manager > Finances > Monthly statements > Download CSV\\, then Import in your Etsy bookkeeping spreadsheet.\r\nEND:VEVENT\r\n';
      n++;
    }
    return { text: ev + 'END:VCALENDAR\r\n', n: n };
  }

  var SAMPLE_CSV = [
    'Date,Type,Title,Info,Currency,Amount,Fees & Taxes,Net,Tax Details',
    '"October 3, 2026",Sale,Payment for Order #1001 (made-up example),Order #1001,USD,$42.00,--,$42.00,--',
    '"October 3, 2026",Fee,Transaction fee: Linen apron,Order #1001,USD,--,-$2.24,-$2.24,--',
    '"October 3, 2026",Fee,Transaction fee: Shipping,Order #1001,USD,--,-$0.49,-$0.49,--',
    '"October 3, 2026",Fee,Processing fee,Order #1001,USD,--,-$1.51,-$1.51,--',
    '"October 4, 2026",Shipping,USPS shipping label,Label #77,USD,--,-$5.10,-$5.10,--',
    '"October 9, 2026",Sale,Payment for Order #1002 (made-up example),Order #1002,USD,$68.00,--,$68.00,--',
    '"October 9, 2026",Fee,Transaction fee: Wool throw,Order #1002,USD,--,-$4.42,-$4.42,--',
    '"October 9, 2026",Fee,Processing fee,Order #1002,USD,--,-$2.29,-$2.29,--',
    '"October 9, 2026",Marketing,Offsite Ads fee,Order #1002,USD,--,-$10.20,-$10.20,--',
    '"October 12, 2026",Fee,Listing fee,Listing #555,USD,--,-$0.20,-$0.20,--',
    '"October 20, 2026",Marketing,Etsy Ads,Daily budget,USD,--,-$12.40,-$12.40,--',
    '"October 28, 2026",Refund,Refund to buyer for Order #1001,Order #1001,USD,-$8.00,--,-$8.00,--',
    '"October 31, 2026",Deposit,"$63.15 sent to your bank account",--,USD,--,--,--,--',
    '"November 2, 2026",Sale,Payment for Order #1003 (made-up example),Order #1003,USD,$35.00,--,$35.00,--',
    '"November 2, 2026",Fee,Transaction fee: Tea towel set,Order #1003,USD,--,-$2.28,-$2.28,--',
    '"November 2, 2026",Fee,Processing fee,Order #1003,USD,--,-$1.30,-$1.30,--',
    '"November 5, 2026",Fee,Renew sold: Tea towel set,Listing #556,USD,--,-$0.20,-$0.20,--'
  ].join('\n');

  var API = { COUNTRIES: COUNTRIES, compute: compute, num: num, money: money, parseCSV: parseCSV, monthOf: monthOf, classify: classify,
    importStatement: importStatement, totals: totals, months: months, bookSchC: bookSchC, dedupe: dedupe, xlsx: xlsx, bookWorkbook: bookWorkbook,
    zip: zip, crc32: crc32, icsMonthly: icsMonthly, SAMPLE_CSV: SAMPLE_CSV, CAT_NAME: CAT_NAME, SLUG: SLUG, DOORS: DOORS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.EBS = API;

  /* ---------- page ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var LS = root.localStorage;
  function inputs() {
    var o = {}; Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (el) { o[el.getAttribute('data-k')] = el.value; }); return o;
  }
  function row(l, v, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + l + '</td><td class="n">' + v + '</td></tr>'; }
  function render() {
    var r = compute(inputs()), c = r.c, f = r.fees;
    $('res-profit').textContent = money(r.profit, c);
    $('res-fees').textContent = money(r.etsyFees, c);
    $('res-share').textContent = r.feeShare.toFixed(1) + '% of sales';
    $('res-dep').textContent = money(r.deposits, c);
    $('res-margin').textContent = r.margin.toFixed(1) + '%';
    $('res-perorder').textContent = money(r.perOrderFee, c);
    $('fee-table').innerHTML =
      row('Transaction fee 6.5% of ' + money(r.sales, c), money(f.transaction, c)) +
      row('Payment processing ' + c.pct + '% of ' + money(r.sales + num(inputs().taxcol), c) + ' (incl. tax) + ' + c.sym + c.flat.toFixed(2) + ' × ' + r.orders + ' orders', money(f.processing, c)) +
      (c.rof ? row('Regulatory operating fee ' + c.rof + '% (' + c.name + ')', money(f.regulatory, c)) : '') +
      row('Offsite Ads fee', money(f.offsite, c)) + row('Listing + renewal fees', money(f.listing, c)) + row('Etsy Ads', money(f.ads, c)) +
      row('<b>Etsy fees total</b>', '<b>' + money(r.etsyFees, c) + '</b>', 'tot') +
      row('Shipping labels bought on Etsy', money(r.labels, c)) + row('Money sent back to buyers', money(r.returns, c)) +
      row('Cost of goods + supplies (your costs)', money(r.cogs + r.supplies, c)) + row('<b>True profit</b>', '<b>' + money(r.profit, c) + '</b>', 'tot');
    var lossEl = $('loss-line');
    if (c.schc) {
      lossEl.innerHTML = 'If these fee and label lines are missing from your books, you are taxed on <b>' + money(r.missed, c) + '</b> Etsy kept: self-employment tax alone on it is <b>' + money(r.seOnMissed, c) + '</b> (' + money(r.missed, c) + ' × 92.35% × 15.3%, Schedule SE 2026), before any income tax.';
      var s = r.schc;
      $('schc').innerHTML = '<h3>Schedule C (Form 1040) 2026 lines from these numbers</h3><table>' +
        row('1 Gross receipts or sales', money(s.l1, c)) + row('2 Returns and allowances', money(s.l2, c)) + row('4 Cost of goods sold', money(s.l4, c)) +
        row('8 Advertising (Etsy Ads + Offsite Ads)', money(s.l8, c)) + row('10 Commissions and fees (Etsy fees)', money(s.l10, c)) +
        row('22 Supplies', money(s.l22, c)) + row('27b Other expenses: postage (labels)', money(s.l27b, c)) +
        row('<b>31 Net profit</b> (before home office, line 30)', '<b>' + money(s.l31, c) + '</b>', 'tot') + '</table>' +
        '<p class="small">Sales tax Etsy collected (' + money(num(inputs().taxcol), c) + ') is not income: Etsy remits it. Line 4 here is your cost-of-goods total; the form builds line 4 in Part III from inventory.</p>';
    } else {
      lossEl.innerHTML = 'If these fee and label lines are missing from your books, you report <b>' + money(r.missed, c) + '</b> more profit than you made: that is the money Etsy kept before your deposits.';
      $('schc').innerHTML = '<h3>Your deductible Etsy costs (' + c.name + ')</h3><p class="small">Etsy fees ' + money(r.etsyFees, c) + ' + shipping labels ' + money(r.labels, c) + ' + your costs ' + money(r.cogs + r.supplies, c) + '. Line-by-line Schedule C mapping is for US sellers; your tax return uses its own boxes.</p>';
    }
    var cs = $('cur-sym'); if (cs) Array.prototype.forEach.call(document.querySelectorAll('.cur'), function (el) { el.textContent = c.sym; });
  }

  /* licence */
  function isPro() { return LS && LS.getItem('ebs_pro') === '1'; }
  function checkKey(k, cb) {
    var i = 0;
    (function next() {
      if (i >= DOORS.length) return cb(false);
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) cb(true); else next(); }).catch(next);
    })();
  }
  function unlock() { LS.setItem('ebs_pro', '1'); showPro(); }
  function showPro() {
    var pro = isPro();
    $('pro-locked').style.display = pro ? 'none' : '';
    $('pro-open').style.display = pro ? '' : 'none';
    if (pro) renderBook();
  }

  /* book (Pro) */
  function loadBook() { try { return JSON.parse(LS.getItem('ebs_book_' + curYear()) || '') || { rows: [], expenses: [] }; } catch (e) { return { rows: [], expenses: [] }; } }
  function saveBook(b) { LS.setItem('ebs_book_' + curYear(), JSON.stringify(b)); }
  function curYear() { return ($('book-year') && $('book-year').value) || '2026'; }
  function renderBook() {
    var b = loadBook(), c = COUNTRIES[inputs().country] || COUNTRIES.US, ms = months(b.rows, b.expenses);
    var h = '<table><tr><th>Month</th><th>Sales</th><th>Etsy fees</th><th>Labels</th><th>Your costs</th><th>Profit</th><th>Deposits</th></tr>';
    ms.forEach(function (m) { h += '<tr><td>' + m.m + (m.unsorted ? ' <span class="warn">' + m.unsorted + ' unsorted</span>' : '') + '</td><td class="n">' + money(m.sales, c) + '</td><td class="n">' + money(m.fees, c) + '</td><td class="n">' + money(m.labels, c) + '</td><td class="n">' + money(m.cogs + m.supplies, c) + '</td><td class="n"><b>' + money(m.profit, c) + '</b></td><td class="n">' + money(m.deposits, c) + '</td></tr>'; });
    h += '</table>';
    $('book-months').innerHTML = ms.length ? h : '<p class="small">No rows yet: import a statement CSV.</p>';
    $('book-count').textContent = b.rows.length + ' statement rows · ' + b.expenses.length + ' cost entries · year ' + curYear();
    var un = b.rows.filter(function (x) { return x.cat === 'unsorted'; });
    $('book-unsorted').innerHTML = un.length ? '<p class="warn">Rows we could not sort (they are kept, not counted):</p><ul>' + un.slice(0, 50).map(function (x) { return '<li>' + esc(x.m + ' ' + x.desc + ' ' + x.amt) + '</li>'; }).join('') + '</ul>' : '';
  }
  function download(name, data, type) {
    var blob = new Blob([data], { type: type }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
  }
  function previewSample() {
    var im = importStatement(SAMPLE_CSV), t = totals(im.rows), c = COUNTRIES.US;
    var fees = r2(t.transaction + t.processing + t.regulatory + t.offsite + t.listing + t.ads + t.feevat + t.otherfee);
    $('sample-out').innerHTML = '<p class="small">Made-up statement, ' + im.rows.length + ' rows sorted:</p><table>' +
      ['sales', 'returns', 'taxcol', 'transaction', 'processing', 'offsite', 'listing', 'ads', 'labels', 'deposit'].map(function (k) { return row(CAT_NAME[k], money(t[k], c)); }).join('') +
      row('<b>Etsy fees in this file</b>', '<b>' + money(fees, c) + '</b>', 'tot') + '</table>';
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });
    render();
    var hk = (location.hash.match(/k=([^&]+)/) || [])[1];
    if (hk) checkKey(decodeURIComponent(hk), function (ok) { if (ok) { LS.setItem('ebs_key', decodeURIComponent(hk)); unlock(); } });
    $('key-go').addEventListener('click', function () {
      var k = $('key-in').value.trim(); if (!k) return;
      $('key-msg').textContent = 'Checking ...';
      checkKey(k, function (ok) { $('key-msg').textContent = ok ? ' — Save and continue: https://getreadystack.com/apps/etsy-bookkeeping-spreadsheet/' : ' — Save and continue: https://getreadystack.com/apps/etsy-bookkeeping-spreadsheet/'; if (ok) { LS.setItem('ebs_key', k); unlock(); } });
    });
    $('sample-go').addEventListener('click', previewSample);
    $('csv-in').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []), b = loadBook(), msgs = [];
      var left = files.length; if (!left) return;
      files.forEach(function (f) {
        var rd = new FileReader();
        rd.onload = function () {
          var im = importStatement(rd.result);
          if (!im.ok) msgs.push(f.name + ': ' + im.why);
          else { var d = dedupe(b.rows, im.rows); b.rows = d.rows; msgs.push(f.name + ': ' + d.added + ' rows added' + (d.skipped ? ', ' + d.skipped + ' already in the book' : '')); }
          if (--left === 0) { saveBook(b); $('csv-msg').textContent = msgs.join(' · '); renderBook(); }
        };
        rd.readAsText(f);
      });
    });
    $('exp-add').addEventListener('click', function () {
      var b = loadBook(), m = $('exp-month').value, amt = num($('exp-amt').value);
      if (!m || !amt) { $('exp-msg').textContent = 'Month and amount, please.'; return; }
      b.expenses.push({ m: m, cat: $('exp-cat').value, desc: $('exp-desc').value, amt: amt, repeat: $('exp-rep').checked }); saveBook(b); $('exp-msg').textContent = 'Saved.'; renderBook();
    });
    $('dl-xlsx').addEventListener('click', function () { download('etsy-bookkeeping-' + curYear() + '.xlsx', bookWorkbook(loadBook()), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); });
    $('dl-ics').addEventListener('click', function () { var y = +curYear() + (curYear() === '2026' ? 1 : 0); download('etsy-books-monthly-' + y + '.ics', icsMonthly(y, new Date().toISOString().slice(0, 10).replace(/-/g, '')).text, 'text/calendar'); });
    $('dl-print').addEventListener('click', function () { root.print(); });
    $('book-year').addEventListener('change', renderBook);
    $('new-year').addEventListener('click', function () {
      var old = loadBook(); $('book-year').value = '2027';
      var nb = loadBook(); if (!nb.rows.length && !nb.expenses.length) {
        nb.expenses = old.expenses.filter(function (e) { return e.repeat; }).map(function (e) { return { m: '2027-' + e.m.slice(5), cat: e.cat, desc: e.desc, amt: e.amt, repeat: true }; });
        saveBook(nb);
      }
      renderBook();
    });
    showPro();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
