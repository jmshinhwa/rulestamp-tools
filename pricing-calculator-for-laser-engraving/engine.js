/* Laser engraving job pricing engine — pure functions, no DOM.
   Node: require('./engine.js') · browser: window.LZE
   Etsy US fees (help.etsy.com, read 2026-11-26): transaction 6.5% of the order total · payment processing 3% + 0.25 USD · listing 0.20 USD. */
(function () {
  'use strict';
  var FEES = { tx: 6.5, pp: 3, ppFix: 0.25, list: 0.20 };
  function r2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function r4(x) { return Math.round(x * 10000) / 10000; }
  function num(s, d) {
    if (typeof s === 'number') return isFinite(s) ? s : (d || 0);
    var t = String(s == null ? '' : s).replace(/[^0-9.,\-]/g, '');
    if (/,\d{1,2}$/.test(t) && t.indexOf('.') < 0) t = t.replace(',', '.');
    t = t.replace(/,/g, '');
    var n = parseFloat(t); return isFinite(n) ? n : (d || 0);
  }
  function usd(x) { var n = r2(x), s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (n < 0 ? '−$' : '$') + s; }
  function clean(v) {
    v = v || {};
    var o = {
      qty: Math.max(1, Math.round(num(v.qty, 1))), mat: Math.max(0, num(v.mat)), waste: Math.min(90, Math.max(0, num(v.waste))),
      laser: Math.max(0, num(v.laser)), hands: Math.max(0, num(v.hands)), setup: Math.max(0, num(v.setup)), design: Math.max(0, num(v.design)),
      pack: Math.max(0, num(v.pack)), mrate: Math.max(0, num(v.mrate)), lrate: Math.max(0, num(v.lrate)),
      margin: Math.min(90, Math.max(0, num(v.margin))), channel: v.channel === 'direct' ? 'direct' : 'etsy'
    };
    return o;
  }
  function fees(P, channel, F) {
    F = F || FEES;
    if (channel !== 'etsy') return { tx: 0, pp: 0, list: 0, total: 0 };
    var tx = r2(P * F.tx / 100), pp = r2(P * F.pp / 100 + F.ppFix);
    return { tx: tx, pp: pp, list: F.list, total: r2(tx + pp + F.list) };
  }
  function costOf(o) {
    var w = 1 + o.waste / 100;
    var laserMin = r2(o.qty * o.laser * w), handMin = r2(o.qty * o.hands * w + o.setup + o.design);
    var matC = r2(o.qty * o.mat * w), lasC = r2(o.qty * o.laser * w / 60 * o.mrate), labC = r2((o.qty * o.hands * w + o.setup + o.design) / 60 * o.lrate);
    return { mat: matC, laser: lasC, labour: labC, pack: r2(o.pack), total: r2(matC + lasC + labC + o.pack), laserMin: laserMin, handMin: handMin,
      blanks: Math.ceil(r4(o.qty * w)) };
  }
  function priceFor(cost, o, F) {
    F = F || FEES;
    var keep = cost / (1 - o.margin / 100);
    return o.channel === 'etsy' ? r2((keep + F.ppFix + F.list) / (1 - F.tx / 100 - F.pp / 100)) : r2(keep);
  }
  function price(v, F) {
    var o = clean(v), c = costOf(o), P = priceFor(c.total, o, F), f = fees(P, o.channel, F);
    var naiveO = clean(v); naiveO.waste = 0; naiveO.setup = 0; naiveO.design = 0;
    var nc = costOf(naiveO), nP = priceFor(nc.total, naiveO, F), nf = fees(nP, o.channel, F);
    return {
      v: o, cost: c, price: P, perPiece: r2(P / o.qty), fees: f, profit: r2(P - f.total - c.total),
      naive: { price: nP, cost: nc.total, fees: nf.total, profit: r2(nP - nf.total - c.total) },
      under: r2(P - nP)
    };
  }
  // ---- the saved log (Pro) ----
  function jobRow(j, F) {
    var r = price(j, F), charged = (j.charged === '' || j.charged == null) ? r.price : r2(num(j.charged)), f = fees(charged, r.v.channel, F);
    return { j: j, r: r, charged: charged, fees: f.total, profit: r2(charged - f.total - r.cost.total), month: String(j.date || '').slice(0, 7) };
  }
  function months(jobs, F) {
    var M = {}, order = [];
    jobs.forEach(function (j) {
      var x = jobRow(j, F), k = x.month || 'no date';
      if (!M[k]) { M[k] = { month: k, jobs: 0, revenue: 0, fees: 0, cost: 0, profit: 0, laserMin: 0, handMin: 0 }; order.push(k); }
      var m = M[k]; m.jobs++; m.revenue = r2(m.revenue + x.charged); m.fees = r2(m.fees + x.fees); m.cost = r2(m.cost + x.r.cost.total);
      m.profit = r2(m.profit + x.profit); m.laserMin = r2(m.laserMin + x.r.cost.laserMin); m.handMin = r2(m.handMin + x.r.cost.handMin);
    });
    return order.sort().map(function (k) { return M[k]; });
  }
  function stock(materials, jobs) {
    return (materials || []).map(function (m) {
      var used = 0;
      jobs.forEach(function (j) { if (String(j.material || '').trim().toLowerCase() === String(m.name || '').trim().toLowerCase()) used += costOf(clean(j)).blanks; });
      var left = num(m.bought) - used;
      return { name: m.name, unit: r2(num(m.unit)), bought: num(m.bought), used: used, left: left, reorder: num(m.reorder), status: left <= num(m.reorder) ? 'REORDER' : 'OK', value: r2(Math.max(0, left) * num(m.unit)) };
    });
  }
  var BREAKS = [1, 5, 10, 25];
  function priceList(products, F) {
    return (products || []).map(function (p) {
      return { p: p, each: BREAKS.map(function (n) { var q = {}; for (var k in p) q[k] = p[k]; q.qty = n; var r = price(q, F); return r2(r.price / n); }) };
    });
  }
  function csvCell(x) { var s = String(x == null ? '' : x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(jobs, F) {
    var rows = [['Date', 'Job', 'Product', 'Material', 'Pieces', 'Sold on', 'Full cost', 'Suggested price', 'Charged', 'Etsy fees', 'Profit']];
    jobs.forEach(function (j) { var x = jobRow(j, F); rows.push([j.date, j.name, j.product, j.material, x.r.v.qty, x.r.v.channel === 'etsy' ? 'Etsy' : 'Direct', x.r.cost.total.toFixed(2), x.r.price.toFixed(2), x.charged.toFixed(2), x.fees.toFixed(2), x.profit.toFixed(2)]); });
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  // ---- tiny xlsx writer (stored zip, inline strings, real formulas) ----
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function utf8(s) { if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s); return Uint8Array.from(Buffer.from(s, 'utf8')); }
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
  function zip(files) {
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
      var loc = Uint8Array.from([].concat([0x50, 0x4b, 3, 4], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)));
      parts.push(loc, name, data);
      central.push([[].concat([0x50, 0x4b, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off)), name]);
      off += loc.length + name.length + data.length;
    });
    var cdLen = 0;
    central.forEach(function (c) { var h = Uint8Array.from(c[0]); parts.push(h, c[1]); cdLen += h.length + c[1].length; });
    parts.push(Uint8Array.from([].concat([0x50, 0x4b, 5, 6], u16(0), u16(0), u16(files.length), u16(files.length), u32(cdLen), u32(off), u16(0))));
    var len = 0; parts.forEach(function (p) { len += p.length; });
    var out = new Uint8Array(len), o = 0; parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }
  function xe(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26 | 0; } return s; }
  function sheetXml(rows, widths, freeze) {
    var out = rows.map(function (r, ri) {
      return '<row r="' + (ri + 1) + '">' + (r || []).map(function (c, ci) {
        if (c == null || c === '') return '';
        var ref = colName(ci) + (ri + 1), st = '';
        if (typeof c === 'object' && c.s) st = ' s="' + c.s + '"';
        var val = typeof c === 'object' ? c.v : c;
        if (typeof c === 'object' && c.f) return '<c r="' + ref + '"' + st + '><f>' + xe(c.f) + '</f></c>';
        if (val == null || val === '') return st ? '<c r="' + ref + '"' + st + '/>' : '';
        if (typeof val === 'number') return '<c r="' + ref + '"' + st + '><v>' + val + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + xe(val) + '</t></is></c>';
      }).join('') + '</row>';
    }).join('');
    var pane = freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + freeze + '" topLeftCell="A' + (freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
    var cols = widths ? '<cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + pane + cols + '<sheetData>' + out + '</sheetData></worksheet>';
  }
  function serial(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); if (!m) return ''; return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000); }
  // styles: 1 bold · 2 money · 3 date · 4 input (money) · 5 input (number) · 6 bold money · 7 month · 8 input text · 9 input date · 10 title
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/><numFmt numFmtId="166" formatCode="mmm yyyy"/></numFmts>' +
    '<fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4CC"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="11"><xf/>' +
    '<xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/>' +
    '<xf numFmtId="164" fillId="2" applyNumberFormat="1" applyFill="1"/><xf fillId="2" applyFill="1"/><xf numFmtId="164" fontId="1" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="166" applyNumberFormat="1"/><xf fillId="2" applyFill="1"/><xf numFmtId="165" fillId="2" applyNumberFormat="1" applyFill="1"/><xf fontId="2" applyFont="1"/></cellXfs></styleSheet>';
  var LOG_ROWS = 300;
  function workbook(data) {
    data = data || {};
    var F = data.fees || FEES, jobs = data.jobs || [], mats = data.materials || [], prods = data.products || [], ex = data.example ? ' (made-up example rows: overwrite them)' : '';
    var H = function (t) { return { v: t, s: 1 }; }, M = function (f) { return { f: f, s: 2 }; }, IN$ = function (v) { return { v: v, s: 4 }; }, INn = function (v) { return { v: v, s: 5 }; }, INt = function (v) { return { v: v, s: 8 }; };
    var S = "Settings!", TX = S + '$B$3', PP = S + '$B$4', PF = S + '$B$5', LF = S + '$B$6';
    var settings = [[{ v: 'Settings: Etsy US fees used by every sheet', s: 10 }], [H('Fee'), H('Value'), H('Source')],
      ['Etsy transaction fee %', INn(F.tx), 'help.etsy.com/hc/en-us/articles/360035902374 (read 2026-11-26): 6.5% of the order total'],
      ['Payment processing %', INn(F.pp), 'help.etsy.com/hc/articles/115015628847 (read 2026-11-26): United States 3% + 0.25 USD'],
      ['Payment processing, fixed $', IN$(F.ppFix), 'same page'],
      ['Listing fee $ (counted once per order)', IN$(F.list), 'help.etsy.com/hc/en-us/articles/360035902374: 0.20 USD per listing'],
      [], ['Selling outside the US? Type your own processing rate here. "Direct" jobs (craft fair, your website, cash) get no Etsy fees.']];
    // Price a Job
    var pj = data.priceJob || {};
    var P = [[{ v: 'Price a Job: what to charge for one order' + (data.example ? ' (example, made-up)' : ''), s: 10 }], [H('Your numbers (yellow cells)'), H('Value')],
      ['Pieces in the order', INn(pj.qty)], ['Material per piece $ (blank)', IN$(pj.mat)], ['Waste % (ruined pieces)', INn(pj.waste)], ['Laser minutes per piece', INn(pj.laser)],
      ['Hands-on minutes per piece (load, mask, wipe)', INn(pj.hands)], ['Setup minutes per order', INn(pj.setup)], ['Design and proof minutes per order', INn(pj.design)],
      ['Packing and extras $ per order', IN$(pj.pack)], ['Machine cost $ per laser hour', IN$(pj.mrate)], ['Your pay $ per hour', IN$(pj.lrate)], ['Profit margin %', INn(pj.margin)],
      ['Sold on (Etsy or Direct)', INt(pj.channel === 'direct' ? 'Direct' : 'Etsy')], [], [H('Result'), H('')],
      ['Material incl. waste', M('ROUND(B3*B4*(1+B5/100),2)')], ['Laser time', M('ROUND(B3*B6*(1+B5/100)/60*B11,2)')],
      ['Your time', M('ROUND((B3*B7*(1+B5/100)+B8+B9)/60*B12,2)')], ['Packing and extras', M('B10')], [H('Full cost'), { f: 'ROUND(B17+B18+B19+B20,2)', s: 6 }],
      [H('Price to charge'), { f: 'IF(B14="Direct",ROUND(B21/(1-B13/100),2),ROUND((B21/(1-B13/100)+' + PF + '+' + LF + ')/(1-' + TX + '/100-' + PP + '/100),2))', s: 6 }],
      ['Price per piece', M('ROUND(B22/B3,2)')], ['Etsy fees at that price', M('IF(B14="Direct",0,ROUND(B22*' + TX + '/100,2)+ROUND(B22*' + PP + '/100+' + PF + ',2)+' + LF + ')')],
      [H('Profit kept'), { f: 'ROUND(B22-B24-B21,2)', s: 6 }], [],
      [H('Skip waste, setup and design time'), H('')],
      ['Price you would charge', M('IF(B14="Direct",ROUND(ROUND(ROUND(B3*B4,2)+ROUND(B3*B6/60*B11,2)+ROUND(B3*B7/60*B12,2)+B10,2)/(1-B13/100),2),ROUND((ROUND(ROUND(B3*B4,2)+ROUND(B3*B6/60*B11,2)+ROUND(B3*B7/60*B12,2)+B10,2)/(1-B13/100)+' + PF + '+' + LF + ')/(1-' + TX + '/100-' + PP + '/100),2))')],
      ['Profit at that price (minus = the order loses money)', M('ROUND(B28-IF(B14="Direct",0,ROUND(B28*' + TX + '/100,2)+ROUND(B28*' + PP + '/100+' + PF + ',2)+' + LF + ')-B21,2)')],
      ['Undercharged by', M('ROUND(B22-B28,2)')]];
    // Job Log
    var hdr = ['Date', 'Job / customer', 'Product', 'Material', 'Pieces', 'Material $/piece', 'Waste %', 'Laser min/piece', 'Hands-on min/piece', 'Setup min', 'Design min', 'Packing & extras $', 'Machine $/h', 'Your $/h', 'Margin %', 'Sold on', 'You charged $ (blank = suggested)',
      'Material cost', 'Laser cost', 'Your time cost', 'Full cost', 'Suggested price', 'Charged', 'Etsy fees', 'Profit', 'Blanks used', 'Laser minutes', 'Your minutes'];
    var L = [hdr.map(H)];
    for (var i = 0; i < LOG_ROWS; i++) {
      var r = i + 2, j = jobs[i] || null, g = function (f) { return { f: 'IF($A' + r + '="","",' + f + ')', s: 2 }; }, gn = function (f) { return { f: 'IF($A' + r + '="","",' + f + ')' }; };
      var row = j ? [{ v: serial(j.date), s: 9 }, INt(j.name || ''), INt(j.product || ''), INt(j.material || ''), INn(num(j.qty)), IN$(num(j.mat)), INn(num(j.waste)), INn(num(j.laser)), INn(num(j.hands)), INn(num(j.setup)), INn(num(j.design)), IN$(num(j.pack)), IN$(num(j.mrate)), IN$(num(j.lrate)), INn(num(j.margin)), INt(j.channel === 'direct' ? 'Direct' : 'Etsy'), (j.charged === '' || j.charged == null) ? { v: '', s: 4 } : IN$(num(j.charged))]
        : [{ v: '', s: 9 }, { v: '', s: 8 }, { v: '', s: 8 }, { v: '', s: 8 }, { v: '', s: 5 }, { v: '', s: 4 }, { v: '', s: 5 }, { v: '', s: 5 }, { v: '', s: 5 }, { v: '', s: 5 }, { v: '', s: 5 }, { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 5 }, { v: '', s: 8 }, { v: '', s: 4 }];
      row.push(g('ROUND(E' + r + '*F' + r + '*(1+G' + r + '/100),2)'), g('ROUND(E' + r + '*H' + r + '*(1+G' + r + '/100)/60*M' + r + ',2)'), g('ROUND((E' + r + '*I' + r + '*(1+G' + r + '/100)+J' + r + '+K' + r + ')/60*N' + r + ',2)'),
        g('ROUND(R' + r + '+S' + r + '+T' + r + '+L' + r + ',2)'),
        g('IF(P' + r + '="Direct",ROUND(U' + r + '/(1-O' + r + '/100),2),ROUND((U' + r + '/(1-O' + r + '/100)+' + PF + '+' + LF + ')/(1-' + TX + '/100-' + PP + '/100),2))'),
        g('IF(Q' + r + '="",V' + r + ',Q' + r + ')'),
        g('IF(P' + r + '="Direct",0,ROUND(W' + r + '*' + TX + '/100,2)+ROUND(W' + r + '*' + PP + '/100+' + PF + ',2)+' + LF + ')'),
        g('ROUND(W' + r + '-X' + r + '-U' + r + ',2)'), gn('ROUNDUP(ROUND(E' + r + '*(1+G' + r + '/100),4),0)'), gn('ROUND(E' + r + '*H' + r + '*(1+G' + r + '/100),2)'), gn('ROUND(E' + r + '*I' + r + '*(1+G' + r + '/100)+J' + r + '+K' + r + ',2)'));
      L.push(row);
    }
    var LE = LOG_ROWS + 1, rng = function (c) { return "'Job Log'!$" + c + '$2:$' + c + '$' + LE; };
    // Monthly Profit
    var year = data.year || 2026;
    var MP = [[{ v: 'Monthly Profit', s: 10 }, '', 'Year', INn(year)], [H('Month'), H('Jobs'), H('Charged'), H('Etsy fees'), H('Full cost'), H('Profit'), H('Laser hours'), H('Your hours'), H('Profit per hour of your time')]];
    for (var m = 0; m < 12; m++) {
      var rr = m + 3, A = 'A' + rr, crit = rng('A') + ',">="&' + A + ',' + rng('A') + ',"<"&DATE(YEAR(' + A + '),MONTH(' + A + ')+1,1)';
      MP.push([{ f: 'DATE($D$1,' + (m + 1) + ',1)', s: 7 }, { f: 'COUNTIFS(' + crit + ')' }, M('SUMIFS(' + rng('W') + ',' + crit + ')'), M('SUMIFS(' + rng('X') + ',' + crit + ')'), M('SUMIFS(' + rng('U') + ',' + crit + ')'), M('SUMIFS(' + rng('Y') + ',' + crit + ')'),
        { f: 'ROUND(SUMIFS(' + rng('AA') + ',' + crit + ')/60,2)' }, { f: 'ROUND(SUMIFS(' + rng('AB') + ',' + crit + ')/60,2)' }, M('IF(H' + rr + '>0,ROUND(F' + rr + '/H' + rr + ',2),"")')]);
    }
    MP.push([H('Year'), { f: 'SUM(B3:B14)' }, { f: 'SUM(C3:C14)', s: 6 }, { f: 'SUM(D3:D14)', s: 6 }, { f: 'SUM(E3:E14)', s: 6 }, { f: 'SUM(F3:F14)', s: 6 }, { f: 'SUM(G3:G14)' }, { f: 'SUM(H3:H14)' }, M('IF(H15>0,ROUND(F15/H15,2),"")')]);
    // Material Stock
    var MS = [[{ v: 'Material Stock: blanks left after every logged job', s: 10 }], [H('Material (same name as in Job Log)'), H('Cost per blank $'), H('Blanks bought'), H('Blanks used'), H('Blanks left'), H('Reorder at'), H('Status'), H('Stock value')]];
    for (var s = 0; s < 40; s++) {
      var q = s + 3, mt = mats[s];
      MS.push([mt ? INt(mt.name) : { v: '', s: 8 }, mt ? IN$(num(mt.unit)) : { v: '', s: 4 }, mt ? INn(num(mt.bought)) : { v: '', s: 5 }, { f: 'IF(A' + q + '="","",SUMIFS(' + rng('Z') + ',' + rng('D') + ',A' + q + '))' },
        { f: 'IF(A' + q + '="","",C' + q + '-D' + q + ')' }, mt ? INn(num(mt.reorder)) : { v: '', s: 5 }, { f: 'IF(A' + q + '="","",IF(E' + q + '<=F' + q + ',"REORDER","OK"))' }, M('IF(A' + q + '="","",ROUND(MAX(0,E' + q + ')*B' + q + ',2))')]);
    }
    // Price List
    var PLh = ['Product', 'Material $/piece', 'Waste %', 'Laser min/piece', 'Hands-on min/piece', 'Setup + design min', 'Packing $', 'Machine $/h', 'Your $/h', 'Margin %', 'Sold on'].concat(BREAKS.map(function (n) { return n === 1 ? '1 piece: price each' : n + ' pieces: price each'; }));
    var PL = [[{ v: 'Price List: price per piece by order size', s: 10 }], PLh.map(H)];
    for (var p = 0; p < 40; p++) {
      var k = p + 3, pr = prods[p];
      var row2 = pr ? [INt(pr.product || pr.name), IN$(num(pr.mat)), INn(num(pr.waste)), INn(num(pr.laser)), INn(num(pr.hands)), INn(num(pr.setup) + num(pr.design)), IN$(num(pr.pack)), IN$(num(pr.mrate)), IN$(num(pr.lrate)), INn(num(pr.margin)), INt(pr.channel === 'direct' ? 'Direct' : 'Etsy')]
        : [{ v: '', s: 8 }, { v: '', s: 4 }, { v: '', s: 5 }, { v: '', s: 5 }, { v: '', s: 5 }, { v: '', s: 5 }, { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 4 }, { v: '', s: 5 }, { v: '', s: 8 }];
      BREAKS.forEach(function (n) {
        var c = 'ROUND(ROUND(' + n + '*B' + k + '*(1+C' + k + '/100),2)+ROUND(' + n + '*D' + k + '*(1+C' + k + '/100)/60*H' + k + ',2)+ROUND((' + n + '*E' + k + '*(1+C' + k + '/100)+F' + k + ')/60*I' + k + ',2)+G' + k + ',2)';
        var pf = 'IF(K' + k + '="Direct",ROUND(' + c + '/(1-J' + k + '/100),2),ROUND((' + c + '/(1-J' + k + '/100)+' + PF + '+' + LF + ')/(1-' + TX + '/100-' + PP + '/100),2))';
        row2.push(M('IF(A' + k + '="","",ROUND(' + pf + '/' + n + ',2))'));
      });
      PL.push(row2);
    }
    var start = [[{ v: 'Laser engraving job cost & profit tracker', s: 10 }], [data.example ? 'Every number already in this file belongs to a made-up example shop. Overwrite the yellow cells with your own.' : 'Built from the jobs you saved in the web app. Yellow cells are yours to change; white cells are formulas.'],
      [], [H('How to use it')], ['1. Settings: check the Etsy fees (US rates, read 2026-11-26). Outside the US, type your processing rate.'],
      ['2. Price a Job: type one order and read "Price to charge". The last block shows what skipping waste, setup and design time costs you.'],
      ['3. Job Log: one row per order. Leave "You charged" blank to log the suggested price, or type what you really charged.'],
      ['4. Monthly Profit: type the year in D1. Jobs, charged, Etsy fees, cost, profit and hours add up by month.'],
      ['5. Material Stock: type each blank and how many you bought. Blanks used come from the Job Log (pieces plus waste, rounded up).'],
      ['6. Price List: one row per product. Price per piece for 1, 5, 10 and 25 pieces, with setup spread over the order.'],
      [], ['Works in Excel, Google Sheets (File > Import) and LibreOffice Calc. Formulas recalculate when the file opens.'],
      ['Prices in US dollars. Etsy fee rates change; check Settings against help.etsy.com before a busy season.'],
      [], [H('Example in this file' + ex)], ['Price a Job: ' + (data.exampleLine || '')]];
    var names = ['Start Here', 'Price a Job', 'Job Log', 'Monthly Profit', 'Material Stock', 'Price List', 'Settings'];
    var sheets = [sheetXml(start, [110]), sheetXml(P, [50, 16]), sheetXml(L, [11, 24, 20, 18, 8, 10, 8, 9, 10, 8, 8, 10, 10, 9, 9, 9, 14, 11, 10, 11, 10, 11, 10, 10, 10, 9, 9, 9], 1),
      sheetXml(MP, [12, 8, 12, 11, 12, 12, 11, 11, 14]), sheetXml(MS, [30, 13, 12, 11, 11, 10, 10, 12], 2), sheetXml(PL, [26, 10, 8, 9, 10, 10, 9, 10, 9, 9, 8, 12, 12, 12, 12], 2), sheetXml(settings, [36, 10, 90])];
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + names.map(function (n, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map(function (n, i) { return '<sheet name="' + n + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets><calcPr fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + names.map(function (n, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: STYLES }
    ];
    sheets.forEach(function (x, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: x }); });
    return zip(files);
  }
  var EXAMPLE = { qty: 10, mat: 1.20, waste: 10, laser: 4, hands: 2, setup: 20, design: 30, pack: 3, mrate: 6, lrate: 25, margin: 30, channel: 'etsy' };
  var E = { FEES: FEES, EXAMPLE: EXAMPLE, BREAKS: BREAKS, r2: r2, num: num, usd: usd, clean: clean, fees: fees, costOf: costOf, price: price, jobRow: jobRow, months: months, stock: stock, priceList: priceList, csv: csv, workbook: workbook, zip: zip, crc32: crc32, serial: serial };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  if (typeof window !== 'undefined') window.LZE = E;
})();
