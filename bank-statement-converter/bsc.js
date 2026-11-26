/* bsc.js — bank statement converter core (pure: no DOM, no network). Runs in the browser and in node (tests).
   text lines of a statement → transactions + a running-balance check on every row → CSV / XLSX / OFX. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BSC = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  var MONRX = '(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?';
  var D_NUM = /^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?(?=\s|$)/;
  var D_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?=\s|$)/;
  var D_DMON = new RegExp('^(\\d{1,2})[ \\-]' + MONRX + '(?:[ \\-,]+(\\d{4}|\\d{2}))?(?=\\s|$)', 'i');
  var D_MOND = new RegExp('^' + MONRX + ' (\\d{1,2})(?:,? (\\d{4}))?(?=\\s|,|$)', 'i');
  var AMT = /^(\()?([-+])?([$€£])?(\d{1,3}(?:,\d{3})*|\d+)(\.\d{2})(\))?(-)?(CR|DR|Cr|Dr|cr|dr)?$/;
  var OPEN = /\b(opening|beginning|starting|previous|brought forward|balance forward|balance b\/f)\b/i;
  var CLOSE = /\b(closing|ending|new balance|balance c\/f|carried forward)\b/i;
  var CREDIT_WORDS = /\b(deposit|credit|salary|refund|interest paid|interest earned|transfer from|incoming|received|direct dep|reversal|returned item|cash in|payment from|zelle from|stripe payout|square deposit|shopify payout|paypal transfer in)\b/i;
  var SKIP = /^(page \d|continued|date\b.*\b(description|details|transaction)|total\b|totals\b|subtotal)/i;
  var DAILY = /daily (ending )?balance|balance summary/i;
  var C = 100;  // work in cents

  function cents(x) { return Math.round(x * C); }
  function amtTok(t) {
    var m = AMT.exec(t);
    if (!m) return null;
    var v = parseFloat(m[4].replace(/,/g, '') + m[5]);
    var sign = 0;
    if (m[1] && m[6]) sign = -1;
    if (m[2] === '-' || m[7]) sign = -1;
    if (m[2] === '+') sign = 1;
    if (m[8]) sign = /cr/i.test(m[8]) ? 1 : -1;
    return { c: cents(v), sign: sign };
  }
  function norm(line) {
    return String(line).replace(/ /g, ' ').replace(/([$€£])\s+(?=\d)/g, '$1').replace(/\s+(CR|DR)\b/g, '$1').replace(/(^|\s)-\s+([$€£]?\d[\d,]*\.\d{2})(?=\s|$)/g, '$1-$2').replace(/\s+/g, ' ').trim();
  }
  // date at the start of a line → {m, d, y|null, len}
  function dateAt(s, order) {
    var m;
    if ((m = D_ISO.exec(s))) return { y: +m[1], m: +m[2], d: +m[3], len: m[0].length };
    if ((m = D_NUM.exec(s))) {
      var a = +m[1], b = +m[2], y = m[3] ? +m[3] : null;
      if (y !== null && y < 100) y += 2000;
      var mm = order === 'dmy' ? b : a, dd = order === 'dmy' ? a : b;
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
      return { y: y, m: mm, d: dd, len: m[0].length, a: a, b: b };
    }
    if ((m = D_DMON.exec(s))) { var y2 = m[3] ? +m[3] : null; if (y2 !== null && y2 < 100) y2 += 2000; return { y: y2, m: MON[m[2].toLowerCase().slice(0, 4).replace(/t$/, '')] || MON[m[2].toLowerCase().slice(0, 3)], d: +m[1], len: m[0].length }; }
    if ((m = D_MOND.exec(s))) return { y: m[3] ? +m[3] : null, m: MON[m[1].toLowerCase().slice(0, 3)], d: +m[2], len: m[0].length };
    return null;
  }
  // which way round are 01/02 dates? any first number > 12 → day first
  function guessOrder(lines) {
    var dmy = 0, mdy = 0;
    lines.forEach(function (l) { var m = D_NUM.exec(norm(l)); if (m) { if (+m[1] > 12) dmy++; if (+m[2] > 12) mdy++; } });
    return dmy > mdy ? 'dmy' : 'mdy';
  }
  // split trailing amounts: "desc 12.00 1,000.00" → {desc, amts:[...]}
  function tail(s) {
    var toks = s.split(' '), amts = [];
    while (toks.length) {
      var a = amtTok(toks[toks.length - 1]);
      if (!a) break;
      amts.unshift(a); toks.pop();
      if (amts.length === 4) break;
    }
    return { desc: toks.join(' '), amts: amts };
  }
  function iso(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  // statement year(s): a "period" line with two full dates, else the latest 4-digit year in the text
  function period(lines, order) {
    var full = [];
    lines.forEach(function (raw) {
      var s = norm(raw), re = /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}-\d{1,2}-\d{1,2}|[A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{1,2} [A-Za-z]{3,9},? \d{4})/g, m;
      if (!/(period|through|statement|from|to|between|dates?)\b/i.test(s) && full.length) return;
      while ((m = re.exec(s))) { var d = dateAt(m[1], order); if (d && d.y) full.push(d); }
    });
    if (full.length >= 2) return { start: full[0], end: full[1] };
    if (full.length === 1) return { start: full[0], end: full[0] };
    var ys = (lines.join(' ').match(/\b20\d{2}\b/g) || []).map(Number);
    var y = ys.length ? Math.max.apply(null, ys) : new Date().getFullYear();
    return { start: { y: y, m: 1, d: 1 }, end: { y: y, m: 12, d: 31 }, guessed: true };
  }
  function yearFor(dt, per) {
    if (dt.y) return dt.y;
    if (per.start.y === per.end.y) return per.end.y;
    return dt.m >= per.start.m ? per.start.y : per.end.y;   // Dec → Jan statements
  }

  // ── parse: lines → statement
  function parse(text, opts) {
    opts = opts || {};
    var lines = (Array.isArray(text) ? text : String(text || '').split(/\r?\n/)).map(norm).filter(Boolean);
    var order = opts.order && opts.order !== 'auto' ? opts.order : guessOrder(lines);
    var per = period(lines, order);
    var rows = [], opening = null, closing = null, inDaily = false, last = null, header = [];
    lines.forEach(function (s) {
      if (DAILY.test(s)) { inDaily = true; last = null; return; }
      var dt = dateAt(s, order);
      var rest = dt ? s.slice(dt.len).trim() : s;
      var t = tail(rest);
      var low = t.desc.toLowerCase();
      if (t.amts.length && OPEN.test(low) && /balance|forward|b\/f/i.test(low)) { if (opening === null) opening = t.amts[t.amts.length - 1].c * (t.amts[t.amts.length - 1].sign < 0 ? -1 : 1); last = null; return; }
      if (t.amts.length && CLOSE.test(low) && /balance|forward|c\/f/i.test(low)) { closing = t.amts[t.amts.length - 1].c * (t.amts[t.amts.length - 1].sign < 0 ? -1 : 1); last = null; inDaily = true; return; }
      if (dt && t.amts.length && !inDaily) {
        if (!t.desc || dateAt(t.desc, order) || SKIP.test(t.desc)) { last = null; return; }
        var r = { date: iso(yearFor(dt, per), dt.m, dt.d), desc: t.desc, amts: t.amts, line: s };
        rows.push(r); last = r; return;
      }
      if (dt && !t.amts.length && !inDaily && rest && !SKIP.test(rest)) {          // date + description, amounts on the next line
        last = { date: iso(yearFor(dt, per), dt.m, dt.d), desc: rest, amts: [], line: s, pending: true }; return;
      }
      if (!dt && last && last.pending && t.amts.length && !inDaily) {
        if (t.desc) last.desc += ' ' + t.desc;
        last.amts = t.amts; last.line += ' | ' + s; delete last.pending; rows.push(last); return;
      }
      if (!dt && last && !last.pending && !t.amts.length && !SKIP.test(s) && s.length < 90 && !inDaily) { last.desc += ' ' + s; return; }
      if (!rows.length && !dt) header.push(s);
    });
    var st = { order: order, period: per, opening: opening, closing: closing, rows: rows, header: header.slice(0, 6) };
    check(st);
    return st;
  }

  // ── the check: every printed balance must equal previous balance ± this row's amount
  function guessSign(r) { return CREDIT_WORDS.test(r.desc) ? 1 : -1; }
  function check(st) {
    var rows = st.rows, hasBal = rows.some(function (r) { return r.amts.length >= 2; });
    st.hasBalance = hasBal;
    rows.forEach(function (r) {
      var a = r.amts;
      r.bal = hasBal && a.length >= 2 ? a[a.length - 1].c * (a[a.length - 1].sign < 0 ? -1 : 1) : null;
      r.parts = hasBal && a.length >= 2 ? a.slice(0, -1) : a.slice();
      if (!hasBal && a.length >= 2) r.parts = a.slice();     // two-column debit / credit statement without balances
    });
    var ref = st.opening, run = st.opening, seg = [];
    function settle(end) {
      // seg = rows up to and including `end` (which has a printed balance); choose signs so ref + Σ = bal
      var free = [], fixed = 0;
      seg.forEach(function (r) {
        r.parts.forEach(function (p) { if (p.sign) fixed += p.sign * p.c; else free.push({ r: r, p: p }); });
      });
      var target = end.bal - (ref === null ? 0 : ref) - fixed, best = null, bestCost = 1e9, n = free.length;
      if (ref !== null && n <= 14) {
        for (var mask = 0; mask < (1 << n); mask++) {
          var sum = 0, cost = 0;
          for (var i = 0; i < n; i++) { var sg = (mask >> i) & 1 ? 1 : -1; sum += sg * free[i].p.c; if (sg !== guessSign(free[i].r)) cost++; }
          if (sum === target && cost < bestCost) { best = mask; bestCost = cost; }
        }
      }
      var ok = best !== null || (ref !== null && n === 0 && target === 0);
      free.forEach(function (f, i) { f.p.used = ok ? (((best >> i) & 1) ? 1 : -1) : guessSign(f.r); });
      seg.forEach(function (r) {
        r.amount = r.parts.reduce(function (s, p) { return s + (p.sign || p.used) * p.c; }, 0);
        run = (run === null ? null : run + r.amount);
        r.calc = run;
        if (ref === null) { r.status = 'start'; r.note = 'first balance on the statement - no opening balance found to check it against'; }
        else if (ok) r.status = 'ok';
        else r.status = 'bad';
      });
      if (!ok && ref !== null) {
        var diff = end.bal - (ref + seg.reduce(function (s, r) { return s + r.amount; }, 0));
        var note;
        if (seg.length === 1 && seg[0].parts.length === 1) {
          var want = Math.abs(end.bal - ref);
          note = 'balance column implies ' + fmt(want) + ', the amount reads ' + fmt(seg[0].parts[0].c) + ' (off by ' + fmt(Math.abs(Math.abs(want) - seg[0].parts[0].c)) + ')';
        } else note = 'these ' + seg.length + ' rows miss the printed balance by ' + fmt(Math.abs(diff));
        seg.forEach(function (r) { r.note = note; r.off = diff; });
      }
      run = end.bal; ref = end.bal; seg = [];
    }
    rows.forEach(function (r) {
      seg.push(r);
      if (r.bal !== null) settle(r);
    });
    // rows after the last printed balance, or a statement with no balance column at all
    seg.forEach(function (r) {
      r.amount = r.parts.reduce(function (s, p, i) {
        var sg = p.sign || (!hasBal && r.parts.length === 2 ? (i === 0 ? -1 : 1) : guessSign(r));
        return s + sg * p.c;
      }, 0);
      run = run === null ? null : run + r.amount; r.calc = run; r.status = 'nobal';
      r.note = hasBal ? 'no balance printed after this row' : 'no balance column - checked against the ending balance';
    });
    var inn = 0, out = 0, bad = 0;
    rows.forEach(function (r) { if (r.amount > 0) inn += r.amount; else out -= r.amount; if (r.status === 'bad') bad++; });
    var last = rows.length ? rows[rows.length - 1] : null;
    var endCalc = st.opening !== null ? st.opening + inn - out : null;
    var endPrinted = st.closing !== null ? st.closing : (last && last.bal !== null ? last.bal : null);
    st.sum = {
      rows: rows.length, bad: bad, inn: inn, out: out, opening: st.opening, closing: st.closing,
      endCalc: endCalc, endPrinted: endPrinted,
      endOk: endCalc !== null && endPrinted !== null ? endCalc === endPrinted : null,
      endDiff: endCalc !== null && endPrinted !== null ? endPrinted - endCalc : null,
      lastBalOk: last && last.bal !== null && st.closing !== null ? last.bal === st.closing : null,
      start: rows.length ? rows[0].date : null, end: last ? last.date : null
    };
    return st;
  }

  // ── carry-over across statements: each opening must equal the previous closing
  function chain(list) {
    var s = list.slice().sort(function (a, b) { return String(a.sum.start).localeCompare(String(b.sum.start)); });
    var out = [];
    for (var i = 1; i < s.length; i++) {
      var prev = s[i - 1].sum.endPrinted, open = s[i].sum.opening;
      out.push({ from: s[i - 1].name || ('#' + i), to: s[i].name || ('#' + (i + 1)), prevClose: prev, open: open,
        ok: prev !== null && open !== null ? prev === open : null, diff: prev !== null && open !== null ? open - prev : null });
    }
    return { ordered: s, links: out, gaps: out.filter(function (l) { return l.ok === false; }).length };
  }

  function fmt(c, cur) {
    if (c === null || c === undefined) return '-';
    var neg = c < 0, v = Math.abs(c), s = Math.floor(v / C).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','), d = ('0' + (v % C)).slice(-2);
    return (neg ? '-' : '') + (cur === undefined ? '$' : cur) + s + '.' + d;
  }
  function num(c) { return c === null || c === undefined ? '' : (c / C).toFixed(2); }

  // ── exports
  var STATUS = { ok: 'OK', bad: 'CHECK', start: 'START', nobal: 'NO BALANCE' };
  function table(st) {
    return st.rows.map(function (r) {
      return { date: r.date, desc: r.desc, debit: r.amount < 0 ? -r.amount : null, credit: r.amount > 0 ? r.amount : null,
        amount: r.amount, balance: r.bal, calc: r.calc, check: STATUS[r.status] || '', note: r.status === 'bad' ? r.note : '' };
    });
  }
  function csvCell(v) { v = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(v) || /^[=+\-@]/.test(v) && isNaN(+v) ? '"' + (/^[=+\-@]/.test(v) && isNaN(+v) ? "'" : '') + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(st) {
    var out = [['Date', 'Description', 'Debit', 'Credit', 'Amount', 'Balance (statement)', 'Balance (computed)', 'Check', 'Note']];
    table(st).forEach(function (r) { out.push([r.date, r.desc, num(r.debit), num(r.credit), num(r.amount), num(r.balance), num(r.calc), r.check, r.note]); });
    return out.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  // OFX 1.0.2 (SGML) — bank statement download format
  function ofxEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); }
  function toOFX(st, acct) {
    acct = acct || {};
    var d = function (iso) { return String(iso).replace(/-/g, '') + '120000'; };
    var tx = st.rows.map(function (r, i) {
      return '<STMTTRN>\n<TRNTYPE>' + (r.amount < 0 ? 'DEBIT' : 'CREDIT') + '\n<DTPOSTED>' + d(r.date) + '\n<TRNAMT>' + num(r.amount) +
        '\n<FITID>' + r.date.replace(/-/g, '') + '-' + (i + 1) + '-' + hash(r.date + r.desc + r.amount) + '\n<NAME>' + ofxEsc(r.desc.slice(0, 32)) +
        (r.desc.length > 32 ? '\n<MEMO>' + ofxEsc(r.desc.slice(0, 255)) : '') + '\n</STMTTRN>';
    }).join('\n');
    var endBal = st.sum.endPrinted !== null ? st.sum.endPrinted : (st.sum.endCalc || 0);
    return 'OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n' +
      '<OFX>\n<SIGNONMSGSRSV1>\n<SONRS>\n<STATUS>\n<CODE>0\n<SEVERITY>INFO\n</STATUS>\n<DTSERVER>' + d(st.sum.end || '2000-01-01') + '\n<LANGUAGE>ENG\n</SONRS>\n</SIGNONMSGSRSV1>\n' +
      '<BANKMSGSRSV1>\n<STMTTRNRS>\n<TRNUID>1\n<STATUS>\n<CODE>0\n<SEVERITY>INFO\n</STATUS>\n<STMTRS>\n<CURDEF>' + (acct.cur || 'USD') + '\n' +
      '<BANKACCTFROM>\n<BANKID>' + (acct.bank || '000000000') + '\n<ACCTID>' + (acct.id || '0000') + '\n<ACCTTYPE>CHECKING\n</BANKACCTFROM>\n' +
      '<BANKTRANLIST>\n<DTSTART>' + d(st.sum.start || '2000-01-01') + '\n<DTEND>' + d(st.sum.end || '2000-01-01') + '\n' + tx + '\n</BANKTRANLIST>\n' +
      '<LEDGERBAL>\n<BALAMT>' + num(endBal) + '\n<DTASOF>' + d(st.sum.end || '2000-01-01') + '\n</LEDGERBAL>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n';
  }

  // XLSX — written by hand (stored zip, no library). sheets: [{name, rows:[[cell...]]}] cell = string | number | {f, v} | {d:'YYYY-MM-DD'} | {n, s}
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return new Uint8Array(Buffer.from(s, 'utf8'));
  }
  function zip(files) {
    var parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
      var head = [].concat([0x50, 0x4b, 3, 4], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push(new Uint8Array([].concat([0x50, 0x4b, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += head.length + name.length + data.length;
    });
    var csize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var end = new Uint8Array([].concat([0x50, 0x4b, 5, 6], u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(off), u16(0)));
    var all = parts.concat(central, [end]), len = all.reduce(function (s, p) { return s + p.length; }, 0), out = new Uint8Array(len), p = 0;
    all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }
  function xe(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }
  function col(i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function serial(isoD) { var p = isoD.split('-'); return Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 864e5); }
  function sheetXml(rows, widths) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    if (widths) x += '<cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    x += '<sheetData>';
    rows.forEach(function (r, ri) {
      x += '<row r="' + (ri + 1) + '">';
      r.forEach(function (c, ci) {
        var ref = col(ci) + (ri + 1);
        if (c === null || c === undefined || c === '') return;
        if (typeof c === 'number') x += '<c r="' + ref + '" s="2"><v>' + c + '</v></c>';
        else if (c.d) x += '<c r="' + ref + '" s="1"><v>' + serial(c.d) + '</v></c>';
        else if (c.f) x += '<c r="' + ref + '" s="' + (c.s || 2) + '"' + (typeof c.v === 'string' ? ' t="str"' : '') + '><f>' + xe(c.f) + '</f><v>' + xe(c.v) + '</v></c>';
        else if (c.t !== undefined) x += '<c r="' + ref + '" s="' + (c.s || 0) + '" t="inlineStr"><is><t xml:space="preserve">' + xe(c.t) + '</t></is></c>';
        else x += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xe(c) + '</t></is></c>';
      });
      x += '</row>';
    });
    return x + '</sheetData></worksheet>';
  }
  function xlsx(sheets) {
    var files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    var used = {};
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map(function (s, i) {
        var n = String(s.name).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31).trim() || ('Sheet' + (i + 1)), b = n, k = 2;
        while (used[n.toLowerCase()]) n = b.slice(0, 28) + ' ' + (k++);
        used[n.toLowerCase()] = 1;
        return '<sheet name="' + xe(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      }).join('') + '</sheets><calcPr fullCalcOnLoad="1"/></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s.rows, s.widths) }); });
    return zip(files);
  }
  // one statement → sheet rows (G = computed balance as a live Excel formula, H = the check)
  function sheetRows(st) {
    var rows = [[{ t: 'Date', s: 3 }, { t: 'Description', s: 3 }, { t: 'Debit', s: 3 }, { t: 'Credit', s: 3 }, { t: 'Amount', s: 3 }, { t: 'Balance (statement)', s: 3 }, { t: 'Balance (computed)', s: 3 }, { t: 'Check', s: 3 }, { t: 'Note', s: 3 }]];
    var open = st.opening;
    table(st).forEach(function (r, i) {
      var n = i + 2, prev = i === 0 ? (open !== null ? String(open / C) : null) : 'IF(F' + (n - 1) + '="",G' + (n - 1) + ',F' + (n - 1) + ')';
      var g = prev !== null && r.calc !== null ? { f: prev + '+E' + n, v: r.calc / C } : (r.calc !== null ? r.calc / C : '');
      var chk = r.balance !== null && prev !== null ? { f: 'IF(ABS(G' + n + '-F' + n + ')<0.005,"OK","CHECK")', v: r.check === 'CHECK' ? 'CHECK' : 'OK', s: r.check === 'CHECK' ? 4 : 0 } : { t: r.check, s: r.check === 'CHECK' ? 4 : 0 };
      rows.push([{ d: r.date }, r.desc, r.debit !== null ? r.debit / C : '', r.credit !== null ? r.credit / C : '', r.amount / C, r.balance !== null ? r.balance / C : '', g, chk, r.note]);
    });
    return rows;
  }
  function summaryRows(list) {
    var rows = [[{ t: 'Statement', s: 3 }, { t: 'From', s: 3 }, { t: 'To', s: 3 }, { t: 'Rows', s: 3 }, { t: 'Opening', s: 3 }, { t: 'Money in', s: 3 }, { t: 'Money out', s: 3 }, { t: 'Ending (computed)', s: 3 }, { t: 'Ending (statement)', s: 3 }, { t: 'Rows to check', s: 3 }, { t: 'Opening = previous ending?', s: 3 }]];
    var ch = chain(list), links = {};
    ch.links.forEach(function (l) { links[l.to] = l; });
    ch.ordered.forEach(function (st) {
      var s = st.sum, l = links[st.name];
      rows.push([st.name || '', s.start ? { d: s.start } : '', s.end ? { d: s.end } : '', s.rows, s.opening !== null ? s.opening / C : '', s.inn / C, s.out / C, s.endCalc !== null ? s.endCalc / C : '', s.endPrinted !== null ? s.endPrinted / C : '', s.bad,
        l ? (l.ok === null ? { t: 'not printed' } : (l.ok ? { t: 'OK' } : { t: 'GAP ' + fmt(l.diff), s: 4 })) : { t: 'first' }]);
    });
    return rows;
  }
  function toXLSX(list) {
    list = Array.isArray(list) ? list : [list];
    var W = [11, 44, 12, 12, 12, 18, 18, 9, 50];
    var sheets = [];
    if (list.length > 1) {
      sheets.push({ name: 'Summary', rows: summaryRows(list), widths: [28, 11, 11, 7, 12, 12, 12, 16, 16, 12, 24] });
      var all = [[{ t: 'Statement', s: 3 }].concat(sheetRows(list[0])[0])];
      chain(list).ordered.forEach(function (st) { table(st).forEach(function (r) { all.push([st.name || '', { d: r.date }, r.desc, r.debit !== null ? r.debit / C : '', r.credit !== null ? r.credit / C : '', r.amount / C, r.balance !== null ? r.balance / C : '', r.calc !== null ? r.calc / C : '', { t: r.check, s: r.check === 'CHECK' ? 4 : 0 }, r.note]); }); });
      sheets.push({ name: 'All transactions', rows: all, widths: [24].concat(W) });
    }
    chain(list).ordered.forEach(function (st, i) { sheets.push({ name: st.name ? st.name.replace(/\.pdf$/i, '') : 'Statement ' + (i + 1), rows: sheetRows(st), widths: W }); });
    return xlsx(sheets);
  }

  return { parse: parse, check: check, chain: chain, table: table, toCSV: toCSV, toOFX: toOFX, toXLSX: toXLSX, xlsx: xlsx, zip: zip, crc32: crc32, fmt: fmt, num: num, dateAt: dateAt, amtTok: amtTok, norm: norm };
});
