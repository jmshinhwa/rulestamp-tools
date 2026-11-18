/* bookkeeping spreadsheet for UK sole traders - browser-only app. Data stays in this browser (localStorage).
   Rates read 2026-11-18 on GOV.UK: Income Tax rates and Personal Allowances (/income-tax-rates), Self-employed National Insurance rates,
   Simplified expenses (/simpler-income-tax-simplified-expenses: 55p from 6 April 2026, 45p before), SA103S (2026) boxes 9-22,
   Income Tax: increasing the trading allowance (28 Oct 2026: £3,000 from 2027 to 2028), MTD for Income Tax pages (thresholds, penalties). */
(function (root) {
  'use strict';
  var SLUG = 'bookkeeping-spreadsheet-uk-sole-trader';
  var DOORS = [SLUG, SLUG + '.monthly'];

  // England, Wales and Northern Ireland bands (Scotland has its own income tax bands)
  var YEARS = {
    '2026-27': { label: '2026/27 (6 Apr 2026 - 5 Apr 2027)', pa: 12570, basic: 37700, addl: 125140, taper: 100000,
      c4lo: 12570, c4hi: 50270, c4main: 0.06, c4up: 0.02, spt: 7105, car1: 0.55, car2: 0.25, moto: 0.24, prevCar1: 0.45,
      start: '2026-04-06', due: '31 January 2028', dueIso: '20280131', poa2: '31 July 2028', poa2Iso: '20280731', ta: 1000, nextTa: 3000 },
    '2025-26': { label: '2025/26 (6 Apr 2025 - 5 Apr 2026)', pa: 12570, basic: 37700, addl: 125140, taper: 100000,
      c4lo: 12570, c4hi: 50270, c4main: 0.06, c4up: 0.02, spt: 6845, car1: 0.45, car2: 0.25, moto: 0.24, prevCar1: 0.45,
      start: '2025-04-06', due: '31 January 2027', dueIso: '20270131', poa2: '31 July 2027', poa2Iso: '20270731', ta: 1000, nextTa: 1000 }
  };
  var BOXES = [
    ['b11', '11 Cost of goods bought for resale or goods used'],
    ['b12', '12 Car, van and travel expenses'],
    ['b13', '13 Wages, salaries and other staff costs'],
    ['b14', '14 Rent, rates, power and insurance costs'],
    ['b15', '15 Repairs and maintenance of property and equipment'],
    ['b16', '16 Accountancy, legal and other professional fees'],
    ['b17', '17 Interest and bank and credit card financial charges'],
    ['b18', '18 Phone, fax, stationery and other office costs'],
    ['b19', '19 Other allowable business expenses']
  ];
  var LEDGER_CATS = [['in', '9 Turnover (takings, fees, sales)'], ['oth', '10 Other business income']].concat(BOXES)
    .concat([['miles', 'Business miles (flat rate, not £)'], ['car', 'Vehicle running cost (not allowed with the mileage rate)'], ['private', 'Private / not business'], ['unsorted', 'Unsorted (kept, not counted)']]);

  function r2(x) { return Math.round((+x || 0) * 100) / 100; }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[£$€\s]/g, '').replace(/,/g, '');
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s);
    s = s.replace(/[()\-]/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? (neg ? -n : n) : 0;
  }
  function money(x) {
    var n = r2(x), s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-£' : '£') + s;
  }

  function incomeTax(income, y) {      // income tax on total taxable non-savings income, rUK bands
    income = Math.max(0, income);
    var pa = Math.max(0, y.pa - Math.max(0, Math.floor((income - y.taper) / 2)));
    if (income - y.taper >= 2 * y.pa) pa = 0;
    var t = Math.max(0, income - pa);
    var b = Math.min(t, y.basic), h = Math.min(Math.max(0, t - y.basic), y.addl - y.basic), a = Math.max(0, t - y.addl);
    return r2(b * 0.20 + h * 0.40 + a * 0.45);
  }
  function class4(p, y) {
    return r2(Math.max(0, Math.min(p, y.c4hi) - y.c4lo) * y.c4main + Math.max(0, p - y.c4hi) * y.c4up);
  }
  function mileage(miles, vehicle, y, rate1) {
    miles = Math.max(0, miles);
    if (vehicle === 'moto') return r2(miles * y.moto);
    return r2(Math.min(miles, 10000) * (rate1 == null ? y.car1 : rate1) + Math.max(0, miles - 10000) * y.car2);
  }

  // i: {year, turnover, other, b11..b19, travel(part of b12 typed), miles, vehicle, paye, poa}
  function compute(i) {
    var y = YEARS[i.year] || YEARS['2026-27'];
    var gross = r2(num(i.turnover) + num(i.other));
    var mil = mileage(num(i.miles), i.vehicle, y);
    var boxes = {};
    BOXES.forEach(function (b) { boxes[b[0]] = r2(num(i[b[0]])); });
    boxes.b12 = r2(boxes.b12 + mil);
    var b20 = r2(BOXES.reduce(function (a, b) { return a + boxes[b[0]]; }, 0));
    var b21 = r2(gross - b20);
    // trading allowance instead of expenses, when it is bigger
    var useTA = gross > 0 && b20 < y.ta;
    var profit = useTA ? r2(Math.max(0, gross - y.ta)) : Math.max(0, b21);
    var paye = Math.max(0, num(i.paye));
    function bill(p) {
      var it = r2(incomeTax(paye + p, y) - incomeTax(paye, y)), c4 = class4(p, y);
      return { it: it, c4: c4, total: r2(it + c4) };
    }
    var b = bill(profit);
    // the same year with last year's 45p first-10,000-miles rate
    var oldDiff = 0, oldExtra = 0;
    if (i.vehicle !== 'moto' && y.car1 !== y.prevCar1 && num(i.miles) > 0) {
      oldDiff = r2(mil - mileage(num(i.miles), i.vehicle, y, y.prevCar1));
      var p2 = useTA ? profit : Math.max(0, r2(b21 + oldDiff));
      oldExtra = r2(bill(p2).total - b.total);
    }
    var atSource = incomeTax(paye, y), allTax = r2(atSource + b.total);
    var poaNeeded = b.total >= 1000 && !(allTax > 0 && atSource / allTax > 0.8);
    var poaEach = poaNeeded ? r2(b.total / 2) : 0;
    var balancing = r2(b.total - Math.max(0, num(i.poa)));
    var janCash = r2(Math.max(0, balancing) + poaEach);
    return {
      y: y, gross: gross, mileage: mil, boxes: boxes, b20: b20, b21: b21, loss: b21 < 0 ? r2(-b21) : 0,
      useTA: useTA, profit: profit, it: b.it, c4: b.c4, setAside: b.total,
      pctTurnover: gross > 0 ? r2(b.total / gross * 100) : 0,
      per100: profit > 0 ? r2(b.total / profit * 100) : 0,
      oldDiff: oldDiff, oldExtra: oldExtra, poaNeeded: poaNeeded, poaEach: poaEach, balancing: balancing, janCash: janCash,
      class2Treated: profit >= y.spt, under1000: gross > 0 && gross <= y.ta,
      mtd: mtdLine(gross, i.year)
    };
  }
  function mtdLine(gross, year) {
    if (year === '2025-26') {
      return gross > 30000 ? 'Over £30,000 in 2025/26: Making Tax Digital for Income Tax applies to you from 6 April 2027 (quarterly updates by 7 Aug, 7 Nov, 7 Feb, 7 May).'
        : 'Under £30,000 in 2025/26: MTD for Income Tax does not start for you in April 2027 on this figure (the line is £20,000 for 2026/27, from April 2028).';
    }
    return gross > 20000 ? 'Over £20,000 in 2026/27: if this holds, Making Tax Digital for Income Tax applies to you from 6 April 2028 at the latest (from 2026 if 2024/25 was over £50,000, from 2027 if 2025/26 was over £30,000).'
      : 'Under £20,000 in 2026/27: on this figure MTD for Income Tax does not start for you in April 2028.';
  }

  /* ---------- ledger ---------- */
  function isoDate(s) {
    s = String(s || '').trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (m) { var yy = m[3].length === 2 ? '20' + m[3] : m[3]; return yy + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
    var mo = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
    if (m && mo[m[2].toLowerCase()]) return m[3] + '-' + ('0' + mo[m[2].toLowerCase()]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  // ledger rows -> the box fields (b12 here = travel typed in the ledger, mileage is added in compute)
  function ledgerTotals(rows) {
    var t = { turnover: 0, other: 0, miles: 0, car: 0, unsorted: 0, n: 0 };
    BOXES.forEach(function (b) { t[b[0]] = 0; });
    rows.forEach(function (r) {
      var a = r.cat === 'miles' ? num(r.amt) : Math.abs(num(r.amt));
      if (r.cat === 'in') t.turnover += a; else if (r.cat === 'oth') t.other += a;
      else if (r.cat === 'miles') t.miles += a; else if (r.cat === 'car') t.car += a;
      else if (r.cat === 'unsorted') t.unsorted += 1;
      else if (t[r.cat] != null) t[r.cat] += a;
      else return;
      t.n++;
    });
    Object.keys(t).forEach(function (k) { t[k] = r2(t[k]); });
    return t;
  }
  // MTD standard quarterly periods: cumulative from 6 April
  function quarters(rows, year, vehicle) {
    var y = YEARS[year] || YEARS['2026-27'], y0 = +y.start.slice(0, 4);
    var ends = [[y0 + '-07-05', '7 Aug ' + y0], [y0 + '-10-05', '7 Nov ' + y0], [(y0 + 1) + '-01-05', '7 Feb ' + (y0 + 1)], [(y0 + 1) + '-04-05', '7 May ' + (y0 + 1)]];
    return ends.map(function (e) {
      var inP = rows.filter(function (r) { var d = isoDate(r.date); return d && d >= y.start && d <= e[0]; });
      var t = ledgerTotals(inP);
      var exp = BOXES.reduce(function (a, b) { return a + t[b[0]]; }, 0) + mileage(t.miles, vehicle, y);
      return { end: e[0], deadline: e[1], income: r2(t.turnover + t.other), expenses: r2(exp), profit: r2(t.turnover + t.other - exp), rows: inP.length };
    });
  }

  /* ---------- bank CSV import (Pro) ---------- */
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false;
    text = String(text || '').replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.join('').trim()) rows.push(row); row = []; }
      else f += ch;
    }
    row.push(f); if (row.join('').trim()) rows.push(row);
    return rows;
  }
  var RULES = [
    ['car', /\b(shell|bp|esso|texaco|fuel|petrol|diesel|car wash|mot\b|tyres?)\b/i],
    ['b16', /\b(accountant|accountancy|solicitor|legal|bookkeep|xero|freeagent|quickbooks)\b/i],
    ['b17', /\b(bank charge|account fee|monthly fee|overdraft|interest|card fee|sumup|zettle|stripe fee|paypal fee|square fee)\b/i],
    ['b18', /\b(ee|vodafone|o2|three|giffgaff|bt|virgin media|plusnet|sky broadband|stationery|ryman|staples|royal mail|post office|printer|ink)\b/i],
    ['b14', /\b(rent|business rates|insurance|electric|electricity|octopus|british gas|edf|eon|e\.on|water)\b/i],
    ['b12', /\b(trainline|train|rail|parking|ncp|ringgo|tfl|bus|taxi|uber|congestion|toll)\b/i],
    ['b15', /\b(repair|maintenance|servicing|service charge)\b/i],
    ['b13', /\b(wages?|payroll|salary|staff)\b/i],
    ['b11', /\b(wholesale|supplies|stock|materials|screwfix|toolstation|booker|costco|makro)\b/i],
    ['b19', /\b(training|course|subscription|software|website|domain|hosting|advert)\b/i],
    ['private', /\b(transfer to savings|own account|tesco|sainsbury|asda|netflix|spotify|atm|cash withdrawal)\b/i]
  ];
  function classify(desc, amt) {
    if (amt > 0) return /\b(transfer|interest paid|hmrc|tax refund)\b/i.test(desc) ? 'unsorted' : 'in';
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(desc)) return RULES[i][0];
    return 'unsorted';
  }
  function findCol(head, re) { for (var i = 0; i < head.length; i++) if (re.test(String(head[i]).toLowerCase().trim())) return i; return -1; }
  function importBank(text) {
    var rows = parseCSV(text); if (!rows.length) return { rows: [], skipped: 0 };
    var h = rows[0], cD = findCol(h, /date/), cS = findCol(h, /desc|details|narrative|payee|merchant|name|reference/),
      cA = findCol(h, /^amount|^value|amount \(/), cIn = findCol(h, /paid in|money in|credit/), cOut = findCol(h, /paid out|money out|debit/);
    var out = [], skipped = 0;
    rows.slice(1).forEach(function (r) {
      var d = isoDate(r[cD]), desc = String(r[cS] || '').trim(), a;
      if (cA >= 0) a = num(r[cA]); else a = num(r[cIn]) - Math.abs(num(r[cOut]));
      if (!d || !a) { skipped++; return; }
      out.push({ date: d, desc: desc, cat: classify(desc, a), amt: r2(Math.abs(a)) });
    });
    return { rows: out, skipped: skipped };
  }
  function dedupe(oldRows, newRows) {
    var seen = {}; oldRows.forEach(function (r) { seen[r.date + '|' + r.desc + '|' + r2(num(r.amt))] = 1; });
    var added = newRows.filter(function (r) { var k = r.date + '|' + r.desc + '|' + r2(num(r.amt)); if (seen[k]) return false; seen[k] = 1; return true; });
    return { rows: oldRows.concat(added), added: added.length, skipped: newRows.length - added.length };
  }

  /* ---------- files (Pro) ---------- */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s); return Uint8Array.from(Buffer.from(s, 'utf8')); }
  function zip(files) {
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
  function xlsx(sheets) {
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
  var CAT_NAME = {}; LEDGER_CATS.forEach(function (c) { CAT_NAME[c[0]] = c[1]; });
  // book: {year, vehicle, paye, poa, rows:[{date,desc,cat,amt}]}
  function bookWorkbook(book) {
    var rows = book.rows || [], y = YEARS[book.year] || YEARS['2026-27'];
    var led = [['Date', 'Description', 'Box code', 'Box', 'Amount (£) or miles']];
    rows.forEach(function (r) { led.push([r.date, r.desc, r.cat, CAT_NAME[r.cat] || r.cat, r2(num(r.amt))]); });
    var n = Math.max(2, rows.length + 1), rng = function (col) { return 'Ledger!' + col + '2:' + col + n; };
    var sumif = function (code) { return { f: 'SUMIF(' + rng('C') + ',"' + code + '",' + rng('E') + ')' }; };
    var t = ledgerTotals(rows), mil = mileage(t.miles, book.vehicle, y);
    var r1 = Math.round(y.car1 * 100), r2p = Math.round(y.car2 * 100);
    var milF = book.vehicle === 'moto' ? 'B4*' + y.moto : 'MIN(B4,10000)*' + y.car1 + '+MAX(0,B4-10000)*' + y.car2;
    var sa = [['SA103S box', 'Amount', 'How'],
      ['9 Turnover', sumif('in'), 'ledger rows coded "in"'],
      ['10 Other business income', sumif('oth'), 'ledger rows coded "oth"'],
      ['Business miles', sumif('miles'), book.vehicle === 'moto' ? 'motorcycle 24p a mile' : 'car or van: ' + r1 + 'p first 10,000, ' + r2p + 'p after'],
      ['Mileage claim (flat rate)', { f: milF, v: mil }, 'goes into box 12'],
      ['11 Cost of goods', sumif('b11'), ''],
      ['12 Car, van and travel', { f: 'SUMIF(' + rng('C') + ',"b12",' + rng('E') + ')+B5' }, 'travel rows + mileage claim'],
      ['13 Wages and staff', sumif('b13'), ''], ['14 Rent, rates, power, insurance', sumif('b14'), ''],
      ['15 Repairs and maintenance', sumif('b15'), ''], ['16 Accountancy, legal, professional', sumif('b16'), ''],
      ['17 Interest, bank and card charges', sumif('b17'), ''], ['18 Phone, stationery, office', sumif('b18'), ''],
      ['19 Other allowable expenses', sumif('b19'), ''],
      ['20 Total allowable expenses', { f: 'SUM(B6:B14)' }, 'boxes 11 to 19'],
      ['21 Net profit (or 22 loss if negative)', { f: 'B2+B3-B15' }, 'box 9 + box 10 - box 20'],
      ['Vehicle running costs (not claimed)', sumif('car'), 'not allowed on a vehicle you claim the mileage rate for']];
    var q = quarters(rows, book.year, book.vehicle), qs = [['Period (from ' + y.start + ')', 'Update deadline', 'Income to date', 'Expenses to date', 'Profit to date']];
    q.forEach(function (x) { qs.push(['to ' + x.end, x.deadline, x.income, x.expenses, x.profit]); });
    var c = compute({ year: book.year, vehicle: book.vehicle, paye: book.paye, poa: book.poa, turnover: t.turnover, other: t.other, miles: t.miles,
      b11: t.b11, b12: t.b12, b13: t.b13, b14: t.b14, b15: t.b15, b16: t.b16, b17: t.b17, b18: t.b18, b19: t.b19 });
    var tx = [['Tax set-aside ' + y.label, 'Amount'], ['Profit taxed' + (c.useTA ? ' (trading allowance £' + y.ta + ' used)' : ''), c.profit],
      ['Income Tax on the business profit', c.it], ['Class 4 National Insurance', c.c4], ['Set aside in total', c.setAside],
      ['Payments on account already paid', r2(num(book.poa))], ['Balancing payment due ' + y.due, c.balancing],
      ['First payment on account for next year, due ' + y.due, c.poaEach], ['Cash needed by ' + y.due, c.janCash],
      ['Second payment on account, due ' + y.poa2, c.poaEach]];
    return xlsx([{ name: 'Ledger', rows: led }, { name: 'SA103S boxes', rows: sa }, { name: 'Quarterly to date', rows: qs }, { name: 'Tax set-aside', rows: tx }]);
  }
  function ics(year, mtd, today) {
    var y = YEARS[year] || YEARS['2026-27'], y0 = +y.start.slice(0, 4), ev = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//yoojin//uk-bookkeeping//EN\r\n', n = 0;
    var list = [[y.dueIso, 'Self Assessment: online return + balancing payment + 1st payment on account (' + y.label.slice(0, 7) + ')'],
      [y.poa2Iso, 'Self Assessment: 2nd payment on account']];
    if (mtd) list = list.concat([[y0 + '0807', 'MTD quarterly update to 5 July'], [y0 + '1107', 'MTD quarterly update to 5 October'], [(y0 + 1) + '0207', 'MTD quarterly update to 5 January'], [(y0 + 1) + '0507', 'MTD quarterly update to 5 April']]);
    for (var m = 0; m < 12; m++) {      // close the month in the book on the 2nd
      var d = new Date(Date.UTC(y0, 4 + m, 2)), s = d.toISOString().slice(0, 10).replace(/-/g, '');
      list.push([s, 'Bookkeeping: put last month\'s bank CSV into the book']);
    }
    list.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).forEach(function (e) {
      if (today && e[0] < today) return;
      ev += 'BEGIN:VEVENT\r\nUID:ukbk-' + e[0] + '-' + n + '@yoojin\r\nDTSTAMP:' + (today || e[0]) + 'T000000Z\r\nDTSTART;VALUE=DATE:' + e[0] + '\r\nSUMMARY:' + e[1] + '\r\nEND:VEVENT\r\n';
      n++;
    });
    return { text: ev + 'END:VCALENDAR\r\n', n: n };
  }

  var SAMPLE_LEDGER = [
    { date: '2026-04-08', desc: 'Made-up example: cut + colour, 6 clients', cat: 'in', amt: 540 },
    { date: '2026-04-14', desc: 'Wholesale colour + products', cat: 'b11', amt: 212.4 },
    { date: '2026-04-30', desc: 'Round trips to clients, April', cat: 'miles', amt: 690 },
    { date: '2026-05-02', desc: 'Public liability insurance', cat: 'b14', amt: 96 },
    { date: '2026-05-19', desc: 'Card reader fees', cat: 'b17', amt: 8.1 },
    { date: '2026-06-03', desc: 'Mobile phone contract', cat: 'b18', amt: 45 },
    { date: '2026-06-20', desc: 'Fuel', cat: 'car', amt: 62.3 },
    { date: '2026-07-12', desc: 'Wedding party, 5 guests', cat: 'in', amt: 425 },
    { date: '2026-08-09', desc: 'Parking at client', cat: 'b12', amt: 6.5 },
    { date: '2026-10-15', desc: 'Colour course', cat: 'b19', amt: 150 }
  ];
  var SAMPLE_CSV = [
    'Date,Description,Amount,Balance',
    '06/10/2026,FASTER PAYMENT FROM J SMITH (made-up),85.00,1085.00',
    '07/10/2026,SALON WHOLESALE SUPPLIES LTD,-64.20,1020.80',
    '08/10/2026,SHELL BRISTOL,-48.00,972.80',
    '09/10/2026,VODAFONE LTD,-22.00,950.80',
    '10/10/2026,SUMUP CARD FEE,-3.12,947.68',
    '14/10/2026,RINGGO PARKING,-4.40,943.28',
    '15/10/2026,TESCO STORES,-31.75,911.53',
    '20/10/2026,FASTER PAYMENT FROM A KHAN (made-up),120.00,1031.53',
    '27/10/2026,TRANSFER TO SAVINGS,-200.00,831.53',
    '31/10/2026,MONTHLY ACCOUNT FEE,-6.50,825.03'
  ].join('\n');

  var API = { YEARS: YEARS, BOXES: BOXES, LEDGER_CATS: LEDGER_CATS, compute: compute, incomeTax: incomeTax, class4: class4, mileage: mileage,
    num: num, money: money, isoDate: isoDate, ledgerTotals: ledgerTotals, quarters: quarters, parseCSV: parseCSV, classify: classify,
    importBank: importBank, dedupe: dedupe, xlsx: xlsx, bookWorkbook: bookWorkbook, zip: zip, crc32: crc32, ics: ics,
    SAMPLE_LEDGER: SAMPLE_LEDGER, SAMPLE_CSV: SAMPLE_CSV, CAT_NAME: CAT_NAME, SLUG: SLUG, DOORS: DOORS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.UKBK = API;

  /* ---------- page ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var LS = root.localStorage;
  var ledger = [], ready = false;
  function inputs() { var o = {}; Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (el) { o[el.getAttribute('data-k')] = el.value; }); return o; }
  function row(l, v, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + l + '</td><td class="n">' + v + '</td></tr>'; }
  function render() {
    var i = inputs(), r = compute(i), y = r.y;
    $('res-jan').textContent = money(r.janCash);
    $('res-jan-lbl').textContent = 'Cash to have ready by ' + y.due;
    $('res-set').textContent = money(r.setAside);
    $('res-set-sub').textContent = r.pctTurnover + '% of turnover · £' + r.per100.toFixed(2) + ' per £100 profit';
    $('res-profit').textContent = money(r.profit);
    $('res-profit-sub').textContent = r.useTA ? 'trading allowance £' + y.ta.toLocaleString('en-GB') + ' used (beats your expenses)' : 'box 21 net profit';
    $('res-miles').textContent = money(r.mileage);
    $('res-miles-sub').textContent = num(i.miles).toLocaleString('en-GB') + ' miles · ' + (i.vehicle === 'moto' ? '24p' : Math.round(y.car1 * 100) + 'p first 10,000');
    var loss = '';
    if (r.oldExtra > 0) loss = 'A sheet still at last year\'s 45p claims <b>' + money(r.oldDiff) + '</b> less for your miles: that is <b>' + money(r.oldExtra) + '</b> more tax. The 2026/27 rate is 55p a mile for the first 10,000.';
    else if (r.poaNeeded) loss = 'Not just the bill: with a bill over £1,000, HMRC also asks for half of it in advance for next year, so ' + y.due + ' needs <b>' + money(r.janCash) + '</b>, not ' + money(r.balancing) + '.';
    else if (r.under1000) loss = 'Turnover of £1,000 or less is covered by the trading allowance: no tax on it.';
    $('loss-line').innerHTML = loss;
    $('poa-line').innerHTML = r.poaNeeded
      ? 'Bill ' + money(r.setAside) + ' − already paid ' + money(num(i.poa)) + ' = <b>' + money(r.balancing) + '</b> + first payment on account <b>' + money(r.poaEach) + '</b> = ' + money(r.janCash) + ' by ' + y.due + '; another ' + money(r.poaEach) + ' by ' + y.poa2 + '.'
      : 'No payments on account: the bill is under £1,000 or more than 80% of your tax is taken at source.';
    var b = r.boxes, h = row('9 Turnover', money(num(i.turnover))) + row('10 Other business income', money(num(i.other)));
    BOXES.forEach(function (x) { h += row(x[1] + (x[0] === 'b12' ? ' (incl. mileage ' + money(r.mileage) + ')' : ''), money(b[x[0]])); });
    h += row('<b>20 Total allowable expenses</b>', '<b>' + money(r.b20) + '</b>', 'tot') +
      row(r.b21 >= 0 ? '<b>21 Net profit</b>' : '<b>22 Net loss</b>', '<b>' + money(Math.abs(r.b21)) + '</b>', 'tot') +
      row('Income Tax on this profit (' + y.label.slice(0, 7) + ', on top of ' + money(num(i.paye)) + ' other income)', money(r.it)) +
      row('Class 4 National Insurance (' + y.c4main * 100 + '% / ' + y.c4up * 100 + '%)', money(r.c4)) +
      row('<b>Set aside for this year</b>', '<b>' + money(r.setAside) + '</b>', 'tot');
    $('box-table').innerHTML = h;
    var notes = ['Box 20 = expenses other than mileage ' + money(r.b20 - r.mileage) + ' + mileage ' + money(r.mileage) + ' = ' + money(r.b20) + '.', r.mtd];
    if (r.class2Treated) notes.push('Profit is £' + y.spt.toLocaleString('en-GB') + ' or more, so Class 2 is treated as paid: nothing to pay.');
    if (i.year === '2026-27') notes.push('From 2027/28 the trading allowance rises from £1,000 to £3,000 (HMRC, 28 Oct 2026).');
    $('notes').innerHTML = notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    renderLedger();
    if (isPro() && ready) saveBook();
  }

  /* ledger (free on screen; Pro keeps it) */
  function catSelect(v) { return '<select class="lg-cat">' + LEDGER_CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === v ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select>'; }
  function drawLedger() {
    var h = '';
    ledger.forEach(function (r, k) {
      h += '<tr data-i="' + k + '"><td><input class="lg-date" data-yj-mine type="date" value="' + esc(isoDate(r.date)) + '"></td><td><input class="lg-desc" data-yj-mine value="' + esc(r.desc) + '"></td><td>' + catSelect(r.cat) + '</td><td><input class="lg-amt" data-yj-mine inputmode="decimal" value="' + esc(r.amt) + '"></td><td><button class="x" type="button" aria-label="Delete row">×</button></td></tr>';
    });
    $('ledger-body').innerHTML = h;
    renderLedger();
    if (isPro() && ready) saveBook();
  }
  function readLedger() {
    ledger = Array.prototype.map.call(document.querySelectorAll('#ledger-body tr'), function (tr) {
      return { date: tr.querySelector('.lg-date').value, desc: tr.querySelector('.lg-desc').value, cat: tr.querySelector('.lg-cat').value, amt: tr.querySelector('.lg-amt').value };
    });
  }
  function renderLedger() {
    var i = inputs(), t = ledgerTotals(ledger), q = quarters(ledger, i.year, i.vehicle);
    $('ledger-sum').textContent = ledger.length + ' rows · turnover ' + money(t.turnover + t.other) + ' · ' + t.miles.toLocaleString('en-GB') + ' miles' + (t.car ? ' · vehicle costs ' + money(t.car) + ' not claimed (mileage rate used)' : '') + (t.unsorted ? ' · ' + t.unsorted + ' unsorted' : '');
    var h = '<tr><th>Running total to</th><th>Update due</th><th>Income</th><th>Expenses</th><th>Profit</th></tr>';
    q.forEach(function (x) { h += '<tr><td>' + x.end + '</td><td>' + x.deadline + '</td><td class="n">' + money(x.income) + '</td><td class="n">' + money(x.expenses) + '</td><td class="n">' + money(x.profit) + '</td></tr>'; });
    $('quarters').innerHTML = h;
  }
  function ledgerToBoxes() {
    readLedger();
    var t = ledgerTotals(ledger);
    var set = function (k, v) { var el = document.querySelector('[data-k="' + k + '"]'); if (el) el.value = v ? r2(v).toFixed(2) : '0'; };
    set('turnover', t.turnover); set('other', t.other); BOXES.forEach(function (b) { set(b[0], t[b[0]]); });
    var m = document.querySelector('[data-k="miles"]'); if (m) m.value = String(t.miles);
    render();
  }

  /* licence */
  function isPro() { return !!(LS && LS.getItem('ukbk_pro') === '1'); }
  function checkKey(k, cb) {
    var n = 0;
    (function next() {
      if (n >= DOORS.length) return cb(false);
      var door = DOORS[n++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) cb(true); else next(); }).catch(next);
    })();
  }
  function unlock() { LS.setItem('ukbk_pro', '1'); showPro(); }
  function showPro() {
    var pro = isPro();
    $('pro-locked').style.display = pro ? 'none' : '';
    $('pro-open').style.display = pro ? '' : 'none';
    if (pro) loadBook(true);
    ready = true;
  }
  function bookKey() { return 'ukbk_book_' + (inputs().year || '2026-27'); }
  function saveBook() {
    readLedger();
    var i = inputs();
    LS.setItem(bookKey(), JSON.stringify({ year: i.year, vehicle: i.vehicle, paye: i.paye, poa: i.poa, fields: i, rows: ledger }));
    $('book-msg').textContent = 'Saved in this browser · ' + ledger.length + ' rows · ' + (YEARS[i.year] || {}).label;
  }
  function loadBook(adopt) {   // adopt: no saved book yet -> keep what is on screen and save it
    var b; try { b = JSON.parse(LS.getItem(bookKey()) || 'null'); } catch (e) { b = null; }
    if (!b) { if (adopt) saveBook(); else { ledger = []; drawLedger(); } return; }
    Object.keys(b.fields || {}).forEach(function (k) { var el = document.querySelector('[data-k="' + k + '"]'); if (el && k !== 'year') el.value = b.fields[k]; });
    ledger = b.rows || []; drawLedger(); render();
  }
  function currentBook() { readLedger(); var i = inputs(); return { year: i.year, vehicle: i.vehicle, paye: i.paye, poa: i.poa, rows: ledger }; }
  function download(name, data, type) {
    var blob = new Blob([data], { type: type }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
  }
  function needPro(what) { if (isPro()) return false; $('pro-why').textContent = what + ' — Save and continue: https://getreadystack.com/apps/bookkeeping-spreadsheet-uk-sole-trader/'; $('pro').scrollIntoView({ behavior: 'smooth' }); return true; }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (el) {
      if (el.getAttribute('data-k') === 'year') {   // a Pro book per tax year: switch books, never save one year's rows under the other
        el.addEventListener('change', function () { if (isPro()) { ready = false; loadBook(false); ready = true; } render(); });
        return;
      }
      el.addEventListener('input', render); el.addEventListener('change', render);
    });
    $('ledger-body').addEventListener('input', function () { readLedger(); renderLedger(); if (isPro() && ready) saveBook(); });
    $('ledger-body').addEventListener('change', function () { readLedger(); renderLedger(); if (isPro() && ready) saveBook(); });
    $('ledger-body').addEventListener('click', function (e) { if (e.target.className === 'x') { readLedger(); ledger.splice(+e.target.closest('tr').getAttribute('data-i'), 1); drawLedger(); } });
    $('add-row').addEventListener('click', function () { readLedger(); ledger.push({ date: new Date().toISOString().slice(0, 10), desc: '', cat: 'in', amt: '' }); drawLedger(); });
    $('sample-ledger').addEventListener('click', function () { readLedger(); ledger = ledger.concat(SAMPLE_LEDGER.map(function (r) { return Object.assign({}, r); })); drawLedger(); });
    $('to-boxes').addEventListener('click', ledgerToBoxes);
    $('btn-import').addEventListener('click', function () { if (!needPro('Bank CSV import')) $('csv-file').click(); });
    $('csv-file').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () {
        readLedger(); var im = importBank(rd.result), d = dedupe(ledger, im.rows); ledger = d.rows; drawLedger(); saveBook();
        $('book-msg').textContent = d.added + ' rows added, ' + d.skipped + ' already in the book, ' + im.skipped + ' lines without a date or amount.';
      }; rd.readAsText(f);
    });
    $('btn-xlsx').addEventListener('click', function () { if (!needPro('The Excel file')) download('bookkeeping-' + inputs().year + '.xlsx', bookWorkbook(currentBook()), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); });
    $('btn-print').addEventListener('click', function () { if (!needPro('The printable year summary')) root.print(); });
    $('btn-ics').addEventListener('click', function () {
      if (needPro('Deadline reminders')) return;
      var i = inputs(), r = compute(i), today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      download('tax-deadlines-' + i.year + '.ics', ics(i.year, r.gross > 20000, today).text, 'text/calendar');
    });
    $('btn-sample-csv').addEventListener('click', function () {
      var im = importBank(SAMPLE_CSV);
      $('sample-out').innerHTML = '<p class="small">Made-up bank CSV, ' + im.rows.length + ' lines sorted:</p><table>' + im.rows.map(function (r) { return row(esc(r.date + ' ' + r.desc), esc(CAT_NAME[r.cat]) + ' · ' + money(r.amt)); }).join('') + '</table>';
    });
    showPro();
    render();
    var hk = (location.hash.match(/k=([^&]+)/) || [])[1];
    if (hk) checkKey(decodeURIComponent(hk), function (ok) { if (ok) { LS.setItem('ukbk_key', decodeURIComponent(hk)); unlock(); } });
    $('key-go').addEventListener('click', function () {
      var k = $('key-in').value.trim(); if (!k) return;
      $('key-msg').textContent = 'Checking ...';
      checkKey(k, function (ok) { $('key-msg').textContent = ok ? ' — Save and continue: https://getreadystack.com/apps/bookkeeping-spreadsheet-uk-sole-trader/' : ' — Save and continue: https://getreadystack.com/apps/bookkeeping-spreadsheet-uk-sole-trader/'; if (ok) { LS.setItem('ukbk_key', k); unlock(); } });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
