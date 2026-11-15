/* engine.js — 売上管理 表 (handmade sellers). Pure functions: parse pasted sales, per-platform fees, profit per item, 20万円 line. */
(function (root) {
  'use strict';
  // Default fee rules (editable on the page). Sources read 2026-11-15:
  // minne: 利用規約 第16条 fee on 作品・オプション価格＋送料（税込）; rate 10.56%（税込） from comparison articles (minne help returns 403).
  // Creema: news/1480 — 10.67%（税込）on the 決済総額 incl. 送料, orders from 2025-11-05.
  // Etsy (Japan): 取引手数料 6.5% + 決済手数料 6.0% + 0.30 USD, 出品料 0.20 USD (help.etsy.com 115015628847 / 115014483627).
  // BASE スタンダード: 決済手数料 3.6% + 40円 + サービス手数料 3% (thebase.com/pricing).
  var CH = {
    minne: { name: 'minne', pctKey: 'minne_pct', fixKey: null, usdKey: null },
    creema: { name: 'Creema', pctKey: 'creema_pct', fixKey: null, usdKey: null },
    etsy: { name: 'Etsy', pctKey: 'etsy_pct', fixKey: null, usdKey: 'etsy_usd' },
    base: { name: 'BASE', pctKey: 'base_pct', fixKey: 'base_fix', usdKey: null },
    hand: { name: '手渡し・イベント', pctKey: null, fixKey: null, usdKey: null }
  };
  var DEF = { minne_pct: 10.56, creema_pct: 10.67, etsy_pct: 12.5, etsy_usd: 0.5, base_pct: 6.6, base_fix: 40, fx: 150, ytd: 0, line: 200000, year: 2026 };
  var LINE = 200000;

  function num(v) { var s = String(v == null ? '' : v).replace(/[¥￥円,，\s]/g, '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); }).replace(/[－−]/g, '-'); var n = parseFloat(s); return isFinite(n) ? n : NaN; }
  function yen(n) { var r = Math.round(n); return (r < 0 ? '−¥' : '¥') + Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function chOf(s) {
    var t = String(s || '').toLowerCase().replace(/\s/g, '');
    if (/minne|ミンネ/.test(t)) return 'minne';
    if (/creema|クリーマ/.test(t)) return 'creema';
    if (/etsy|エッツィ|エッツイ/.test(t)) return 'etsy';
    if (/base|ベイス|ベース/.test(t)) return 'base';
    if (/手渡|イベント|対面|マルシェ|現金|hand/.test(t)) return 'hand';
    return null;
  }
  var HEAD = { date: /日付|date/i, ch: /販売先|サイト|チャネル|ショップ|channel/i, item: /作品|商品|item/i, price: /価格|作品代|代金|price/i, shipIn: /送料.*(受|もら|お客)|受取送料|ship.?in/i, shipCost: /送料.*(実費|払|支払)|発送費|ship.?cost/i, mat: /材料|原価|仕入|material/i, qty: /数量|個数|qty/i };
  function split(line) { return line.indexOf('\t') >= 0 ? line.split('\t') : line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (c) { return c.replace(/^"|"$/g, ''); }); }

  function parse(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    var rows = [], skipped = [], col = { date: 0, ch: 1, item: 2, price: 3, shipIn: 4, shipCost: 5, mat: 6, qty: -1 }, start = 0;
    if (lines.length) {
      var h = split(lines[0]);
      if (h.some(function (c) { return HEAD.price.test(c) || HEAD.ch.test(c); })) {
        start = 1; var c2 = { date: -1, ch: -1, item: -1, price: -1, shipIn: -1, shipCost: -1, mat: -1, qty: -1 };
        h.forEach(function (c, i) { ['shipIn', 'shipCost', 'mat', 'qty', 'date', 'ch', 'item', 'price'].some(function (k) { if (c2[k] < 0 && HEAD[k].test(c)) { c2[k] = i; return true; } return false; }); });
        col = c2;
      }
    }
    for (var i = start; i < lines.length; i++) {
      var c = split(lines[i]);
      var g = function (k) { return col[k] >= 0 ? (c[col[k]] || '').trim() : ''; };
      var ch = chOf(g('ch')), price = num(g('price'));
      if (!ch || !isFinite(price)) { skipped.push(i + 1); continue; }
      var qty = col.qty >= 0 && isFinite(num(g('qty'))) ? Math.max(1, num(g('qty'))) : 1;
      rows.push({ date: g('date'), ch: ch, item: g('item') || '（作品名なし）', price: price, shipIn: num(g('shipIn')) || 0, shipCost: num(g('shipCost')) || 0, mat: num(g('mat')) || 0, qty: qty });
    }
    return { rows: rows, skipped: skipped };
  }

  function opt(o, k) { var v = num(o && o[k]); return isFinite(v) ? v : DEF[k]; }
  function feeOf(r, o) {
    var C = CH[r.ch], total = r.price + r.shipIn;
    var pct = C.pctKey ? opt(o, C.pctKey) : 0, fix = C.fixKey ? opt(o, C.fixKey) : 0, usd = C.usdKey ? opt(o, C.usdKey) : 0;
    return Math.round(total * pct / 100) + fix + Math.round(usd * opt(o, 'fx'));
  }

  function analyze(rows, o) {
    var T = { sales: 0, fee: 0, shipCost: 0, mat: 0, profit: 0, n: 0 }, byCh = {}, byItem = {};
    var out = rows.map(function (r) {
      var total = r.price + r.shipIn, fee = feeOf(r, o), mat = r.mat * r.qty, profit = total - fee - r.shipCost - mat;
      var x = { date: r.date, ch: r.ch, item: r.item, qty: r.qty, total: total, fee: fee, shipCost: r.shipCost, mat: mat, profit: profit };
      T.sales += total; T.fee += fee; T.shipCost += r.shipCost; T.mat += mat; T.profit += profit; T.n += r.qty;
      var b = byCh[r.ch] || (byCh[r.ch] = { ch: r.ch, name: CH[r.ch].name, n: 0, sales: 0, fee: 0, profit: 0 });
      b.n += r.qty; b.sales += total; b.fee += fee; b.profit += profit;
      var it = byItem[r.item] || (byItem[r.item] = { item: r.item, n: 0, sales: 0, profit: 0, chs: {} });
      it.n += r.qty; it.sales += total; it.profit += profit; it.chs[CH[r.ch].name] = 1;
      return x;
    });
    var items = Object.keys(byItem).map(function (k) { var it = byItem[k]; it.per = it.profit / it.n; it.chs = Object.keys(it.chs); return it; }).sort(function (a, b) { return a.per - b.per; });
    var chs = Object.keys(byCh).map(function (k) { var b = byCh[k]; b.rate = b.sales ? b.profit / b.sales : 0; return b; }).sort(function (a, b) { return b.sales - a.sales; });
    var losers = items.filter(function (it) { return it.profit < 0; });
    // break-even price per channel for each losing item (same 受取送料・送料実費・材料費 per piece)
    losers.forEach(function (it) {
      var rs = rows.filter(function (r) { return r.item === it.item; }), q = 0, si = 0, sc = 0, m = 0, seen = {};
      rs.forEach(function (r) { q += r.qty; si += r.shipIn; sc += r.shipCost; m += r.mat * r.qty; });
      it.price = rs.reduce(function (a, r) { return a + r.price; }, 0) / rs.length;
      it.be = [];
      rs.forEach(function (r) {
        if (seen[r.ch]) return; seen[r.ch] = 1;
        var C = CH[r.ch], pct = C.pctKey ? opt(o, C.pctKey) : 0, fix = (C.fixKey ? opt(o, C.fixKey) : 0) + Math.round((C.usdKey ? opt(o, C.usdKey) : 0) * opt(o, 'fx'));
        var need = (sc / q + m / q + fix) / (1 - pct / 100) - si / q;
        var p = Math.ceil(need); while (feeOf({ ch: r.ch, price: p, shipIn: si / q }, o) > p + si / q - sc / q - m / q) p++;
        it.be.push({ ch: r.ch, name: C.name, price: p });
      });
    });
    var lossSum = losers.reduce(function (a, it) { return a + it.profit; }, 0);
    var ytd = opt(o, 'ytd'), line = opt(o, 'line') || LINE, inc = ytd + T.profit, year = opt(o, 'year');
    return {
      rows: out, T: T, chs: chs, items: items, losers: losers, lossSum: lossSum,
      leak: T.fee + T.shipCost, leakRate: T.sales ? (T.fee + T.shipCost) / T.sales : 0, margin: T.sales ? T.profit / T.sales : 0,
      payout: T.sales - T.fee, ytd: ytd, line: line, inc: inc, left: line - inc, over: inc > line, deadline: deadline(year)
    };
  }

  // 確定申告の期限: 翌年3月15日（土日なら翌月曜）
  function deadline(year) {
    var d = new Date(Date.UTC(year + 1, 2, 15)), w = d.getUTCDay();
    if (w === 6) d.setUTCDate(17); else if (w === 0) d.setUTCDate(16);
    return d.toISOString().slice(0, 10);
  }
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  function jdate(iso) { var d = new Date(iso + 'T00:00:00Z'); return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日（' + WD[d.getUTCDay()] + '）'; }

  // Pro: annual summary from saved months (科目別)
  function annual(months, year) {
    var A = { sales: 0, fee: 0, shipCost: 0, mat: 0, profit: 0, n: 0, months: [] };
    months.filter(function (m) { return String(m.month).slice(0, 4) === String(year); }).forEach(function (m) {
      A.sales += m.T.sales; A.fee += m.T.fee; A.shipCost += m.T.shipCost; A.mat += m.T.mat; A.profit += m.T.profit; A.n += m.T.n; A.months.push(m.month);
    });
    // months before the first saved month: the 「1月から先月まで」 income typed in that month
    var first = months.filter(function (m) { return String(m.month).slice(0, 4) === String(year); })[0];
    A.before = first && first.o ? (num(first.o.ytd) || 0) : 0;
    A.inc = A.before + A.profit; A.left = LINE - A.inc; A.over = A.inc > LINE; A.deadline = deadline(+year);
    return A;
  }
  function csvCell(v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(r) {
    var L = [['日付', '販売先', '作品', '数量', '売上（作品代＋受取送料）', '手数料', '送料（実費）', '材料費', '利益'].join(',')];
    r.rows.forEach(function (x) { L.push([x.date, CH[x.ch].name, x.item, x.qty, x.total, x.fee, x.shipCost, x.mat, x.profit].map(csvCell).join(',')); });
    L.push(['合計', '', '', r.T.n, r.T.sales, r.T.fee, r.T.shipCost, r.T.mat, r.T.profit].map(csvCell).join(','));
    return '﻿' + L.join('\r\n') + '\r\n';
  }
  function ics(year, today) {
    var stamp = today.replace(/-/g, '') + 'T000000Z', ev = [], dl = deadline(year).replace(/-/g, '');
    function add(uid, d, sum) { ev.push('BEGIN:VEVENT\r\nUID:' + uid + '@uriage-kanri-hyo\r\nDTSTAMP:' + stamp + '\r\nDTSTART;VALUE=DATE:' + d + '\r\nSUMMARY:' + sum + '\r\nBEGIN:VALARM\r\nTRIGGER:-P2D\r\nACTION:DISPLAY\r\nDESCRIPTION:' + sum + '\r\nEND:VALARM\r\nEND:VEVENT'); }
    for (var m = 1; m <= 12; m++) {
      var last = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10).replace(/-/g, '');
      add('month-' + year + '-' + m, last, year + '年' + m + '月の売上管理表をしめる（手数料・送料・材料費）');
    }
    add('deadline-' + year, dl, year + '年分の確定申告の期限（売上管理表の年間集計）');
    return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//rulestamp//uriage-kanri-hyo//JA\r\n' + ev.join('\r\n') + '\r\nEND:VCALENDAR\r\n';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pc(x) { return (x * 100).toFixed(1) + '%'; }
  // result block HTML (pure string — the page and the static first screen use the same view)
  function view(r) {
    var Y = yen, h = '<div class="sum">' +
      '<div><span>今月の売上（作品代＋受取送料）</span><b>' + Y(r.T.sales) + '</b>' + r.T.n + '件・確定申告の「売上」はこの額</div>' +
      '<div><span>本当の利益（手数料・送料・材料費を引く）</span><b>' + Y(r.T.profit) + '</b>利益率 ' + pc(r.margin) + '</div>' +
      '<div class="bad"><span>手数料＋送料で消えた額</span><b>' + Y(r.leak) + '</b>売上の ' + pc(r.leakRate) + '（手数料 ' + Y(r.T.fee) + '・送料 ' + Y(r.T.shipCost) + '）</div>' +
      '<div class="' + (r.over ? 'bad' : 'warn') + '"><span>副業の所得（1月から今月まで）</span><b>' + Y(r.inc) + '</b>' + (r.over ? '¥200,000 を ' + Y(-r.left) + ' 超えた' : '¥200,000 まであと ' + Y(r.left)) + '</div></div>';
    if (r.losers.length) {
      h += '<p class="loss">' + r.losers.map(function (it) {
        return '「' + esc(it.item) + '」は売るほど赤字：今月 ' + it.n + '件で <b>' + Y(it.profit) + '</b> の損（1件あたり ' + Y(it.per) + '）。送料無料のまま赤字にしない価格は ' +
          it.be.map(function (b) { return b.name + ' ' + Y(b.price); }).join('・') + '（いまは ' + Y(it.price) + '）。';
      }).join('<br>') + '</p>';
    } else h += '<p class="note">今月は赤字の作品はありません。</p>';
    h += '<p class="next">' + (r.over
      ? '副業の所得が ¥200,000 を超えました。会社で年末調整を受ける会社員でも、' + jdate(r.deadline) + 'までに確定申告が必要です（国税庁 No.1900）。'
      : '副業の所得は ¥200,000 まであと ' + Y(r.left) + '。超えると、会社で年末調整を受ける会社員でも ' + jdate(r.deadline) + 'までに確定申告が必要です（国税庁 No.1900）。¥200,000 以下でも住民税の申告は別に必要です。') + '</p>';
    h += '<h3>販売先ごと</h3><table><tr><th>販売先</th><th>件数</th><th>売上</th><th>手数料</th><th>利益</th><th>利益率</th></tr>' +
      r.chs.map(function (c) { return '<tr><td>' + esc(c.name) + '</td><td>' + c.n + '</td><td>' + Y(c.sales) + '</td><td>' + Y(c.fee) + '</td><td><b>' + Y(c.profit) + '</b></td><td>' + pc(c.rate) + '</td></tr>'; }).join('') + '</table>';
    h += '<h3>作品ごと（1件あたりの利益が低い順）</h3><table><tr><th>作品</th><th>件数</th><th>売上</th><th>利益</th><th>1件あたり</th><th>販売先</th></tr>' +
      r.items.map(function (it) { return '<tr' + (it.profit < 0 ? ' class="short"' : '') + '><td>' + esc(it.item) + '</td><td>' + it.n + '</td><td>' + Y(it.sales) + '</td><td>' + Y(it.profit) + '</td><td>' + Y(it.per) + '</td><td>' + esc(it.chs.join('・')) + '</td></tr>'; }).join('') + '</table>';
    h += '<h3>売上管理 表（1件1行）</h3><table><tr><th>日付</th><th>販売先</th><th>作品</th><th>売上</th><th>手数料</th><th>送料（実費）</th><th>材料費</th><th>利益</th></tr>' +
      r.rows.map(function (x) { return '<tr' + (x.profit < 0 ? ' class="short"' : '') + '><td>' + esc(x.date) + '</td><td>' + esc(CH[x.ch].name) + '</td><td>' + esc(x.item) + (x.qty > 1 ? ' ×' + x.qty : '') + '</td><td>' + Y(x.total) + '</td><td>' + Y(x.fee) + '</td><td>' + Y(x.shipCost) + '</td><td>' + Y(x.mat) + '</td><td>' + Y(x.profit) + '</td></tr>'; }).join('') +
      '<tr><th>合計</th><th></th><th>' + r.T.n + '件</th><th>' + Y(r.T.sales) + '</th><th>' + Y(r.T.fee) + '</th><th>' + Y(r.T.shipCost) + '</th><th>' + Y(r.T.mat) + '</th><th>' + Y(r.T.profit) + '</th></tr></table>';
    h += '<p class="note">入金額（売上−手数料）は ' + Y(r.payout) + '。確定申告では入金額ではなく売上 ' + Y(r.T.sales) + ' を収入に書き、手数料 ' + Y(r.T.fee) + '・送料 ' + Y(r.T.shipCost) + '・材料費 ' + Y(r.T.mat) + ' を経費にします。手数料は1円未満を四捨五入するので、各サイトの明細と1円ずれることがあります。</p>';
    return h;
  }
  var api = { CH: CH, DEF: DEF, LINE: LINE, num: num, yen: yen, chOf: chOf, parse: parse, feeOf: feeOf, analyze: analyze, deadline: deadline, jdate: jdate, annual: annual, csv: csv, ics: ics, view: view, esc: esc, pc: pc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.UK = api;
})(this);
