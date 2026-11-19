// engine.js — 家計簿 エクセル: the household engine (pure functions, runs in the browser and in node for the tests)
// month totals · budget vs actual · 夫婦精算 · 特別費 積立 · card/bank CSV reading · .xlsx with live formulas · .ics reminders
(function (g) {
  'use strict';
  var CATS = ['食費', '外食', '日用品', '住居', '水道光熱', '通信', '交通・車', '保険', '医療', '子ども・教育', '娯楽・趣味', '衣服・美容', 'その他'];
  // shop-name → category starters (matched on the NFKC-normalised, lower-cased shop text; the buyer adds/overrides their own)
  var DEFAULT_RULES = [
    ['電力|でんき|電気|ガス|水道', '水道光熱'],
    ['ドコモ|docomo|ソフトバンク|softbank|kddi|au |楽天モバイル|ahamo|povo|ntt|光回線|プロバイダ', '通信'],
    ['jr|鉄道|メトロ|バス|タクシー|eneos|出光|コスモ石油|ガソリン|駐車|etc|高速', '交通・車'],
    ['生命|損保|保険|共済', '保険'],
    ['病院|クリニック|医院|歯科|調剤|薬局', '医療'],
    ['ドラッグ|マツモトキヨシ|ウエルシア|スギ薬局|ツルハ|ココカラ|ニトリ|無印|ダイソー|セリア|ホームセンター|カインズ', '日用品'],
    ['イオン|西友|ライフ|マルエツ|イトーヨーカドー|業務スーパー|オーケー|スーパー|生協|コープ|セブン|ファミリーマート|ローソン', '食費'],
    ['マクドナルド|スターバックス|すき家|吉野家|サイゼリヤ|ガスト|くら寿司|スシロー|レストラン|カフェ|居酒屋|ウーバーイーツ|uber eats|出前館', '外食'],
    ['ユニクロ|gu |zara|美容|ヘアサロン|しまむら', '衣服・美容'],
    ['netflix|spotify|映画|書店|ゲーム|nintendo|playstation|youtube', '娯楽・趣味'],
    ['塾|学童|保育|幼稚園|学校|教材', '子ども・教育'],
    ['家賃|管理費|住宅ローン', '住居']
  ];

  function nfkc(s) { s = String(s == null ? '' : s); try { return s.normalize('NFKC'); } catch (e) { return s; } }
  function yen(n) { n = Math.round(Number(n) || 0); return (n < 0 ? '-¥' : '¥') + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function num(s) {
    if (typeof s === 'number') return isFinite(s) ? s : NaN;
    s = nfkc(s).replace(/[¥￥円,\s"]/g, '');
    var neg = /^\(.*\)$/.test(s) || /^[-−▲△]/.test(s);
    s = s.replace(/[()−▲△+-]/g, '');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return neg ? -Number(s) : Number(s);
  }
  function ymOf(d) { var m = /^(\d{4})-(\d{2})/.exec(d || ''); return m ? m[1] + '-' + m[2] : ''; }

  // ── a new household (two persons a/b · shared split ratio a:b in percent)
  function newHousehold() {
    return {
      v: 1,
      names: { a: '夫', b: '妻' },
      ratio: { a: 50, b: 50 },
      cats: CATS.map(function (c) { return { name: c, budget: 0 }; }),
      specials: [],
      months: {},
      rules: { shop: [], card: [] }
    };
  }
  function month(hh, ym) {
    if (!hh.months[ym]) hh.months[ym] = { income: { a: 0, b: 0 }, lines: [] };
    return hh.months[ym];
  }

  // ── 特別費 (yearly costs) → monthly 積立: ceil(sum/12); items due in a month
  function specials(hh, ym) {
    var list = (hh.specials || []).filter(function (s) { return num(s.amount) > 0 && s.month >= 1 && s.month <= 12; });
    var total = list.reduce(function (t, s) { return t + num(s.amount); }, 0);
    var mon = ym ? Number(ym.slice(5, 7)) : 0;
    var next = mon ? (mon % 12) + 1 : 0;
    return {
      total: total,
      monthly: Math.ceil(total / 12),
      perItem: list.map(function (s) { return { name: s.name, amount: num(s.amount), month: s.month, monthly: Math.ceil(num(s.amount) / 12) }; }),
      dueNow: list.filter(function (s) { return s.month === mon; }).map(function (s) { return { name: s.name, amount: num(s.amount), month: s.month }; }),
      dueNext: list.filter(function (s) { return s.month === next; }).map(function (s) { return { name: s.name, amount: num(s.amount), month: s.month }; })
    };
  }

  // ── the month: budget vs actual per category, income, savings rate, 夫婦精算
  // line = {date, shop, amount, cat, who: 'a'|'b'|'s' (whose cost; s = 共通), paid: 'a'|'b' (who paid)}
  function summarize(hh, ym) {
    var m = hh.months[ym] || { income: { a: 0, b: 0 }, lines: [] };
    var by = {}, total = 0, owe = { a: 0, b: 0 }, paid = { a: 0, b: 0 }, shared = 0, sharedPaid = { a: 0, b: 0 };
    var ra = Number(hh.ratio.a) || 0, rb = Number(hh.ratio.b) || 0, rs = ra + rb || 100;
    var fa = ra / rs;
    m.lines.forEach(function (l) {
      var amt = num(l.amount); if (!isFinite(amt)) return;
      total += amt;
      var c = l.cat || 'その他'; by[c] = (by[c] || 0) + amt;
      var p = l.paid === 'b' ? 'b' : 'a';
      paid[p] += amt;
      if (l.who === 'a') owe.a += amt;
      else if (l.who === 'b') owe.b += amt;
      else { shared += amt; sharedPaid[p] += amt; }
    });
    // shared costs split by the ratio, rounded to whole yen; a's share rounded, b gets the rest (sum stays exact)
    var shareA = Math.round(shared * fa), shareB = shared - shareA;
    owe.a += shareA; owe.b += shareB;
    var netA = paid.a - owe.a;     // > 0: a paid more than a's part → b pays a
    var settle = netA > 0 ? { from: 'b', to: 'a', amount: netA } : netA < 0 ? { from: 'a', to: 'b', amount: -netA } : { from: '', to: '', amount: 0 };
    var cats = hh.cats.map(function (c) { var act = by[c.name] || 0, bud = num(c.budget) || 0; return { name: c.name, budget: bud, actual: act, diff: bud - act, over: bud > 0 && act > bud }; });
    Object.keys(by).forEach(function (k) { if (!hh.cats.some(function (c) { return c.name === k; })) cats.push({ name: k, budget: 0, actual: by[k], diff: -by[k], over: false }); });
    var income = (num(m.income.a) || 0) + (num(m.income.b) || 0);
    var sp = specials(hh, ym);
    var left = income - total - sp.monthly;
    var budgetTotal = cats.reduce(function (t, c) { return t + c.budget; }, 0);
    return {
      ym: ym, lines: m.lines.length, income: income, incomeA: num(m.income.a) || 0, incomeB: num(m.income.b) || 0,
      total: total, budgetTotal: budgetTotal, cats: cats,
      over: cats.filter(function (c) { return c.over; }).map(function (c) { return { name: c.name, by: c.actual - c.budget }; }),
      shared: shared, shareA: shareA, shareB: shareB, ratioA: ra, ratioB: rb,
      paid: paid, owe: owe, sharedPaid: sharedPaid, settle: settle,
      specials: sp, left: left,
      saveRate: income > 0 ? Math.round((income - total - sp.monthly) / income * 1000) / 10 : null
    };
  }
  function ratioByIncome(hh, ym) {
    var m = hh.months[ym]; if (!m) return null;
    var a = num(m.income.a) || 0, b = num(m.income.b) || 0; if (a + b <= 0) return null;
    var pa = Math.round(a / (a + b) * 100); return { a: pa, b: 100 - pa };
  }

  // ── 12-month 年間 view
  function year(hh, y) {
    var rows = [], tot = { income: 0, total: 0, specials: 0, left: 0 };
    for (var i = 1; i <= 12; i++) {
      var ym = y + '-' + (i < 10 ? '0' : '') + i;
      var has = !!hh.months[ym] && (hh.months[ym].lines.length || num(hh.months[ym].income.a) || num(hh.months[ym].income.b));
      var s = summarize(hh, ym);
      var r = { ym: ym, has: !!has, income: has ? s.income : 0, total: has ? s.total : 0, specialsMonthly: has ? s.specials.monthly : 0, left: has ? s.left : 0, settle: s.settle, due: s.specials.dueNow };
      rows.push(r);
      tot.income += r.income; tot.total += r.total; tot.specials += r.specialsMonthly; tot.left += r.left;
    }
    return { year: y, rows: rows, totals: tot };
  }

  // ── categorise a shop name: the buyer's own rules first, then the starters
  function categorize(hh, shop) {
    var s = nfkc(shop).toLowerCase();
    var own = (hh && hh.rules && hh.rules.shop) || [];
    for (var i = 0; i < own.length; i++) if (own[i][0] && s.indexOf(nfkc(own[i][0]).toLowerCase()) >= 0) return own[i][1];
    for (var j = 0; j < DEFAULT_RULES.length; j++) if (new RegExp(DEFAULT_RULES[j][0], 'i').test(s)) return DEFAULT_RULES[j][1];
    return 'その他';
  }
  function addShopRule(hh, pattern, cat) {
    pattern = String(pattern || '').trim(); if (!pattern) return;
    hh.rules.shop = hh.rules.shop.filter(function (r) { return r[0] !== pattern; });
    hh.rules.shop.unshift([pattern, cat]);
  }

  // ── CSV: bytes → text (UTF-8, else Shift_JIS) → rows → {date, shop, amount}
  function decode(bytes) {
    if (typeof bytes === 'string') return bytes.replace(/^﻿/, '');
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, ''); } catch (e) {}
    try { return new TextDecoder('shift_jis').decode(u8); } catch (e) {}
    return new TextDecoder('utf-8').decode(u8);
  }
  function csvRows(text) {
    var rows = [], row = [], f = '', q = false, sep = ',';
    var first = text.split(/\r?\n/)[0] || '';
    if ((first.match(/\t/g) || []).length > (first.match(/,/g) || []).length) sep = '\t';
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
      if (c === '"') q = true;
      else if (c === sep) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.map(function (r) { return r.map(function (x) { return nfkc(x).trim(); }); }).filter(function (r) { return r.some(function (x) { return x !== ''; }); });
  }
  function toDate(s) {
    s = nfkc(s).trim();
    var m = /^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/.exec(s);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = /^(\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/.exec(s);           // 26/11/03
    if (m) return '20' + m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);                              // 20261103
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    return '';
  }
  var H_DATE = /(ご?利用日|日付|取引日|利用年月日|お取引日|年月日|date)/i;
  var H_SHOP = /(ご?利用(店名|先|店|者名)|店名|内容|摘要|お取引内容|取引内容|明細|加盟店|description|merchant|payee)/i;
  var H_AMT = /(金額|出金|お引出し|支払額|支払総額|amount)/i;
  var H_IN = /(入金|お預入れ|預入)/;
  function parseCSV(input) {
    var rows = csvRows(decode(input)), hdr = -1, cD = -1, cS = -1, cA = -1, cIn = -1;
    for (var i = 0; i < Math.min(rows.length, 15) && hdr < 0; i++) {
      var r = rows[i], d = -1, s = -1, a = -1, inn = -1;
      r.forEach(function (h, k) {
        if (d < 0 && H_DATE.test(h)) d = k;
        else if (inn < 0 && H_IN.test(h)) inn = k;
        else if (a < 0 && H_AMT.test(h)) a = k;
        else if (s < 0 && H_SHOP.test(h)) s = k;
      });
      if (d >= 0 && a >= 0) { hdr = i; cD = d; cA = a; cS = s; cIn = inn; }
    }
    var body = hdr >= 0 ? rows.slice(hdr + 1) : rows;
    if (hdr < 0) {   // no header line: date = first column that parses as a date, amount = last numeric column, shop = longest text column
      var probe = body.filter(function (r) { return r.some(function (x) { return toDate(x); }); })[0] || [];
      probe.forEach(function (x, k) { if (cD < 0 && toDate(x)) cD = k; });
      probe.forEach(function (x, k) { if (k !== cD && isFinite(num(x)) && x !== '') cA = k; });
      var best = -1; probe.forEach(function (x, k) { if (k !== cD && k !== cA && !isFinite(num(x)) && x.length > best) { best = x.length; cS = k; } });
    }
    var out = [], skipped = 0;
    body.forEach(function (r) {
      var d = toDate(r[cD] || ''), a = num(r[cA] == null ? '' : r[cA]);
      if (!d || !isFinite(a) || r[cA] === '') { skipped++; return; }
      if (a === 0) { skipped++; return; }
      out.push({ date: d, shop: cS >= 0 ? (r[cS] || '') : '', amount: a });
    });
    return { lines: out, skipped: skipped, header: hdr, cols: { date: cD, shop: cS, amount: cA } };
  }
  // CSV lines → household month(s); card label remembers who paid and whose cost by default (card→person rule)
  function importLines(hh, lines, opt) {
    opt = opt || {};
    var who = opt.who || 's', paid = opt.paid || 'a', n = 0, months = {};
    if (opt.card) {
      hh.rules.card = hh.rules.card.filter(function (c) { return c[0] !== opt.card; });
      hh.rules.card.unshift([opt.card, paid, who]);
    }
    lines.forEach(function (l) {
      var ym = ymOf(l.date); if (!ym) return;
      var m = month(hh, ym);
      var dup = m.lines.some(function (x) { return x.date === l.date && x.shop === l.shop && num(x.amount) === l.amount && x.src === (opt.card || 'csv'); });
      if (dup) return;
      m.lines.push({ date: l.date, shop: l.shop, amount: l.amount, cat: categorize(hh, l.shop), who: who, paid: paid, src: opt.card || 'csv' });
      months[ym] = (months[ym] || 0) + 1; n++;
    });
    return { added: n, months: months };
  }
  // carry a month's budget forward: budgets live on hh.cats (shared by all months), income copied if the new month has none
  function carryOver(hh, fromYm, toYm) {
    var f = hh.months[fromYm], t = month(hh, toYm);
    if (f && !(num(t.income.a) || num(t.income.b))) t.income = { a: f.income.a, b: f.income.b };
    return t;
  }

  // ── backup file (the buyer's own copy)
  function backup(hh) { return JSON.stringify({ app: 'household-budget-planning', v: 1, at: new Date().toISOString(), hh: hh }); }
  function restore(text) {
    var j = JSON.parse(text); var h = j && j.hh;
    if (!h || !h.months || !h.cats) throw new Error('not a backup of this app');
    h.rules = h.rules || { shop: [], card: [] }; h.specials = h.specials || [];
    return h;
  }

  // ── .ics: one yearly reminder per 特別費 item on the 1st of the month before it falls due (alarm 9:00)
  function ics(hh, fromYm, label) {
    var y = Number(fromYm.slice(0, 4)), m = Number(fromYm.slice(5, 7));
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rulestamp//household-budget-planning//JA', 'CALSCALE:GREGORIAN'];
    (hh.specials || []).forEach(function (s, i) {
      if (!(num(s.amount) > 0)) return;
      var rm = s.month - 1 || 12, ry = y;          // reminder month = one month before the due month
      if (rm < m) ry++;                             // next occurrence from the current month on
      var dt = ry + ('0' + rm).slice(-2) + '01';
      var title = (label || '特別費') + ': ' + s.name + ' ' + yen(num(s.amount)) + ' (' + s.month + '月)';
      L.push('BEGIN:VEVENT', 'UID:hbp-' + i + '-' + dt + '@getreadystack.com', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
        'DTSTART;VALUE=DATE:' + dt, 'RRULE:FREQ=YEARLY', 'SUMMARY:' + title.replace(/([,;])/g, '\\$1'),
        'DESCRIPTION:' + ('来月 ' + yen(num(s.amount)) + ' · 毎月の積立 ' + yen(Math.ceil(num(s.amount) / 12))).replace(/([,;])/g, '\\$1'),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', 'DESCRIPTION:' + title.replace(/([,;])/g, '\\$1'), 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  // ── .xlsx (SpreadsheetML in a stored zip) with live formulas + cached values
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zip(files) {     // files: [[name, string]] → Uint8Array (store, no compression)
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = utf8(f[0]), data = utf8(f[1]), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (t, p) { return t + p.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    var all = parts.concat(central, [new Uint8Array(e.buffer)]), len = all.reduce(function (t, p) { return t + p.length; }, 0), out = new Uint8Array(len), p = 0;
    all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function col(i) { var s = ''; i++; while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
  // cell: string | number | {f: formula, v: cached} | {s: string, st: style}
  function sheetXml(rows, widths) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (widths) x += '<cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    x += '<sheetData>';
    rows.forEach(function (r, ri) {
      x += '<row r="' + (ri + 1) + '">';
      r.forEach(function (c, ci) {
        if (c == null || c === '') return;
        var ref = col(ci) + (ri + 1), st = (c && c.st) ? ' s="' + c.st + '"' : '';
        if (typeof c === 'number') x += '<c r="' + ref + '" s="1"><v>' + c + '</v></c>';
        else if (typeof c === 'string') x += '<c r="' + ref + '" t="inlineStr"><is><t>' + esc(c) + '</t></is></c>';
        else if (c.f != null && typeof c.v === 'string') x += '<c r="' + ref + '" t="str"' + st + '><f>' + esc(c.f) + '</f><v>' + esc(c.v) + '</v></c>';
        else if (c.f != null) x += '<c r="' + ref + '"' + (st || ' s="1"') + '><f>' + esc(c.f) + '</f><v>' + (Number(c.v) || 0) + '</v></c>';
        else if (c.s != null) x += '<c r="' + ref + '" t="inlineStr"' + st + '><is><t>' + esc(c.s) + '</t></is></c>';
      });
      x += '</row>';
    });
    return x + '</sheetData></worksheet>';
  }
  var WHO = { a: 'a', b: 'b', s: 's' };
  function xlsx(hh, ym, opt) {
    opt = opt || {};
    var N = hh.names, S = summarize(hh, ym), y = ym.slice(0, 4);
    var whoName = function (w) { return w === 'a' ? N.a : w === 'b' ? N.b : '共通'; };
    // 明細 (all lines of the year; the month sheet sums its own month by the 月 column)
    var det = [['日付', '月', '内容', '金額', '分類', '誰の支出', '支払った人']];
    Object.keys(hh.months).sort().forEach(function (k) {
      if (k.slice(0, 4) !== y || (opt.oneMonth && k !== ym)) return;
      hh.months[k].lines.forEach(function (l) { det.push([l.date, k, l.shop || '', num(l.amount), l.cat || 'その他', whoName(WHO[l.who] || 's'), whoName(l.paid === 'b' ? 'b' : 'a')]); });
    });
    var nd = det.length, D = "'明細'!";
    var rngM = D + '$B$2:$B$' + Math.max(nd, 2), rngA = D + '$D$2:$D$' + Math.max(nd, 2), rngC = D + '$E$2:$E$' + Math.max(nd, 2),
      rngW = D + '$F$2:$F$' + Math.max(nd, 2), rngP = D + '$G$2:$G$' + Math.max(nd, 2);
    // 今月 (budget · actual = SUMIFS over 明細 · diff)
    var mon = [[{ s: '家計簿 ' + ym, st: 2 }, '', '月', ym], ['分類', '予算', '実績', '差額（予算−実績）']];
    S.cats.forEach(function (c, i) {
      var r = i + 3;
      mon.push([c.name, c.budget, { f: 'SUMIFS(' + rngA + ',' + rngC + ',A' + r + ',' + rngM + ',$D$1)', v: c.actual }, { f: 'B' + r + '-C' + r, v: c.diff }]);
    });
    var last = S.cats.length + 2, tr = last + 1;
    mon.push([{ s: '合計', st: 2 }, { f: 'SUM(B3:B' + last + ')', v: S.budgetTotal }, { f: 'SUM(C3:C' + last + ')', v: S.total }, { f: 'B' + tr + '-C' + tr, v: S.budgetTotal - S.total }]);
    mon.push([]);
    mon.push(['収入 ' + N.a, S.incomeA]); mon.push(['収入 ' + N.b, S.incomeB]);
    var ri = tr + 2;
    mon.push(['収入 合計', { f: 'B' + ri + '+B' + (ri + 1), v: S.income }]);
    mon.push(['特別費 積立（月）', { f: "'特別費'!E" + ((hh.specials || []).filter(function (s) { return num(s.amount) > 0; }).length + 2), v: S.specials.monthly }]);
    mon.push(['残り（収入−支出−積立）', { f: 'B' + (ri + 2) + '-C' + tr + '-B' + (ri + 3), v: S.left }]);
    mon.push(['貯蓄率', { f: 'IF(B' + (ri + 2) + '>0,ROUND(B' + (ri + 4) + '/B' + (ri + 2) + '*100,1),0)', v: S.saveRate || 0 }, '%']);
    // 精算
    var sei = [[{ s: '夫婦精算 ' + ym, st: 2 }, '', '月', ym], ['', N.a, N.b],
      ['負担割合（%）', S.ratioA, S.ratioB],
      ['共通の支出 合計', { f: 'SUMIFS(' + rngA + ',' + rngW + ',"共通",' + rngM + ',$D$1)', v: S.shared }],
      ['共通の負担額', { f: 'ROUND(B4*B3/(B3+C3),0)', v: S.shareA }, { f: 'B4-B5', v: S.shareB }],
      ['自分の支出', { f: 'SUMIFS(' + rngA + ',' + rngW + ',B2,' + rngM + ',$D$1)', v: S.owe.a - S.shareA }, { f: 'SUMIFS(' + rngA + ',' + rngW + ',C2,' + rngM + ',$D$1)', v: S.owe.b - S.shareB }],
      ['負担すべき額', { f: 'B5+B6', v: S.owe.a }, { f: 'C5+C6', v: S.owe.b }],
      ['実際に支払った額', { f: 'SUMIFS(' + rngA + ',' + rngP + ',B2,' + rngM + ',$D$1)', v: S.paid.a }, { f: 'SUMIFS(' + rngA + ',' + rngP + ',C2,' + rngM + ',$D$1)', v: S.paid.b }],
      ['差（支払−負担）', { f: 'B8-B7', v: S.paid.a - S.owe.a }, { f: 'C8-C7', v: S.paid.b - S.owe.b }],
      ['精算', { f: 'IF(B9>0,C2&"→"&B2&" "&TEXT(B9,"#,##0")&"円",IF(B9<0,B2&"→"&C2&" "&TEXT(-B9,"#,##0")&"円","精算なし"))', v: 0 }]];
    sei[9][1] = { s: S.settle.amount ? (N[S.settle.from] + '→' + N[S.settle.to] + ' ' + S.settle.amount.toLocaleString('en-US') + '円') : '精算なし' };   // text result (formula kept in C10 below)
    sei[9][2] = { f: 'IF(B9>0,C2&"→"&B2&" "&TEXT(B9,"#,##0")&"円",IF(B9<0,B2&"→"&C2&" "&TEXT(-B9,"#,##0")&"円","精算なし"))', v: sei[9][1].s };
    sei[9][3] = { f: 'ABS(B9)', v: S.settle.amount };
    // 特別費
    var sp = [['特別費（年払い）', '金額', '月', '', '毎月の積立']], spl = (hh.specials || []).filter(function (s) { return num(s.amount) > 0; });
    spl.forEach(function (s, i) { var r = i + 2; sp.push([s.name, num(s.amount), s.month, '', { f: 'ROUNDUP(B' + r + '/12,0)', v: Math.ceil(num(s.amount) / 12) }]); });
    var sr = spl.length + 2;
    sp.push([{ s: '合計', st: 2 }, { f: 'SUM(B2:B' + (sr - 1) + ')', v: S.specials.total }, '', '', { f: 'ROUNDUP(B' + sr + '/12,0)', v: S.specials.monthly }]);
    // 年間
    var Y = year(hh, y), yr = [['月', '収入', '支出', '特別費 積立', '残り']];
    Y.rows.forEach(function (r, i) {
      var rr = i + 2;
      yr.push([r.ym, r.income, { f: 'SUMIFS(' + rngA + ',' + rngM + ',A' + rr + ')', v: r.has ? r.total : 0 }, r.specialsMonthly, { f: 'B' + rr + '-C' + rr + '-D' + rr, v: r.has ? r.left : 0 }]);
    });
    yr.push([{ s: '年間 合計', st: 2 }, { f: 'SUM(B2:B13)', v: Y.totals.income }, { f: 'SUM(C2:C13)', v: Y.totals.total }, { f: 'SUM(D2:D13)', v: Y.totals.specials }, { f: 'SUM(E2:E13)', v: Y.totals.left }]);
    var sheets = [['今月', mon, [22, 12, 12, 18]], ['精算', sei, [18, 18, 26, 10]], ['特別費', sp, [22, 12, 6, 2, 12]], ['年間', yr, [10, 12, 12, 12, 12]], ['明細', det, [12, 9, 28, 10, 12, 10, 10]]];
    var files = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map(function (s, i) { return '<sheet name="' + s[0] + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Yu Gothic"/></font><font><b/><sz val="11"/><name val="Yu Gothic"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf numFmtId="164" applyNumberFormat="1"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>']
    ];
    sheets.forEach(function (s, i) { files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s[1], s[2])]); });
    return zip(files);
  }

  g.HB = {
    CATS: CATS, DEFAULT_RULES: DEFAULT_RULES, newHousehold: newHousehold, month: month, summarize: summarize, specials: specials, year: year,
    ratioByIncome: ratioByIncome, categorize: categorize, addShopRule: addShopRule, decode: decode, csvRows: csvRows, parseCSV: parseCSV,
    importLines: importLines, carryOver: carryOver, backup: backup, restore: restore, ics: ics, xlsx: xlsx, yen: yen, num: num, toDate: toDate, ymOf: ymOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.HB;
})(typeof self !== 'undefined' ? self : globalThis);
