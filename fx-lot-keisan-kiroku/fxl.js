/* FX ロット計算 engine — pure functions, used by the page and by node tests. */
(function (root) {
  'use strict';
  var PAIRS = {
    'USD/JPY': 'JPY', 'EUR/JPY': 'JPY', 'GBP/JPY': 'JPY', 'AUD/JPY': 'JPY', 'NZD/JPY': 'JPY', 'CAD/JPY': 'JPY',
    'CHF/JPY': 'JPY', 'ZAR/JPY': 'JPY', 'MXN/JPY': 'JPY', 'TRY/JPY': 'JPY',
    'EUR/USD': 'USD', 'GBP/USD': 'USD', 'AUD/USD': 'USD', 'NZD/USD': 'USD', 'EUR/GBP': 'GBP', 'USD/CHF': 'CHF', 'USD/CAD': 'CAD'
  };
  var MARGIN_RATE = 0.04; // 金融商品取引業等に関する内閣府令 第117条第7項 (個人の店頭FX: 想定元本の4%以上 = レバレッジ25倍)
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[,，\s円¥%％]/g, '').replace(/[０-９．－]/g, function (c) {
      return c === '．' ? '.' : c === '－' ? '-' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    });
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function quoteOf(pair) { return PAIRS[pair] || (String(pair).split('/')[1] || 'JPY'); }
  function pipSize(pair) { return quoteOf(pair) === 'JPY' ? 0.01 : 0.0001; }
  function floorStep(x, step) {
    if (!(x > 0) || !(step > 0)) return 0;
    var n = Math.floor(x / step + 1e-9);
    return Math.round(n * step * 1000) / 1000;
  }
  /* one trade plan → order size and everything that follows from it */
  function plan(p) {
    var pair = p.pair || 'USD/JPY', q = quoteOf(pair), ps = pipSize(pair);
    var bal = num(p.bal), risk = num(p.risk), entry = num(p.entry), stop = num(p.stop), target = num(p.target);
    var unit = num(p.unit) || 10000, step = num(p.step) || 0.1;
    var qjpy = q === 'JPY' ? 1 : num(p.qjpy);
    var dayPct = num(p.dayPct), dayLost = Math.abs(num(p.dayLost));
    var r = { pair: pair, quote: q, pipSize: ps, unit: unit, step: step, qjpy: qjpy, errors: [] };
    var dir = p.dir === 'sell' ? 'sell' : 'buy';
    r.dir = dir;
    if (!(bal > 0)) r.errors.push('口座残高を入れてください');
    if (!(entry > 0) || !(stop > 0) || entry === stop) r.errors.push('エントリー価格と損切り価格を入れてください（同じ値は不可）');
    if (dir === 'buy' && stop > entry) r.errors.push('買いの損切り価格はエントリーより下です');
    if (dir === 'sell' && stop < entry) r.errors.push('売りの損切り価格はエントリーより上です');
    if (q !== 'JPY' && !(qjpy > 0)) r.errors.push(q + '/JPY のレートを入れてください');
    var dist = Math.abs(entry - stop);
    r.pips = Math.round(dist / ps * 10) / 10;
    r.allowTrade = Math.floor(bal * risk / 100);
    r.dayLimit = dayPct > 0 ? Math.floor(bal * dayPct / 100) : 0;
    r.dayLeft = dayPct > 0 ? Math.max(0, r.dayLimit - dayLost) : null;
    r.budget = r.dayLeft === null ? r.allowTrade : Math.min(r.allowTrade, r.dayLeft);
    r.cappedByDay = r.dayLeft !== null && r.dayLeft < r.allowTrade;
    r.lossPerLot = Math.round(dist * unit * qjpy * 10000) / 10000; // 円 / 1ロット
    r.lots = r.lossPerLot > 0 ? floorStep(r.budget / r.lossPerLot, step) : 0;
    r.units = Math.round(r.lots * unit);
    r.stopLoss = Math.round(r.lots * r.lossPerLot);
    r.stopLossPct = bal > 0 ? Math.round(r.stopLoss / bal * 10000) / 100 : 0;
    r.notional = Math.round(r.units * entry * qjpy);
    r.margin = Math.round(r.notional * MARGIN_RATE);
    r.leverage = bal > 0 ? Math.round(r.notional / bal * 100) / 100 : 0;
    r.overLev = r.leverage > 25;
    r.marginShort = r.margin > bal;
    /* the same lot count typed into an account where 1 lot = 100,000 units */
    r.wrongUnit = unit < 100000 ? Math.round(r.lots * Math.round(dist * 100000 * qjpy * 10000) / 10000) : 0;
    if (target > 0) {
      var tdist = dir === 'buy' ? target - entry : entry - target;
      r.targetPips = Math.round(tdist / ps * 10) / 10;
      r.targetGain = Math.round(r.lots * Math.round(tdist * unit * qjpy * 10000) / 10000);
      r.rr = dist > 0 ? Math.round(tdist / dist * 100) / 100 : 0;
      r.breakEvenWin = r.rr > 0 ? Math.round(100 / (1 + r.rr) * 10) / 10 : null;
      if (tdist <= 0) r.errors.push('利確価格がエントリーの反対側にあります');
    }
    r.dayStop = r.dayLeft !== null && r.dayLeft <= 0;
    return r;
  }
  /* a closed trade from the log → yen P/L and R multiple */
  function closeTrade(t) {
    var q = quoteOf(t.pair), entry = num(t.entry), stop = num(t.stop), exit = num(t.exit);
    var unit = num(t.unit) || 10000, lots = num(t.lots), qjpy = q === 'JPY' ? 1 : num(t.qjpy);
    var move = t.dir === 'sell' ? entry - exit : exit - entry;
    var cost = Math.abs(num(t.cost));
    var perLot = Math.round(move * unit * qjpy * 10000) / 10000, riskLot = Math.round(Math.abs(entry - stop) * unit * qjpy * 10000) / 10000;
    var pl = Math.round(lots * perLot) - cost;
    var risk = Math.round(lots * riskLot);
    return { pl: pl, risk: risk, r: risk > 0 ? Math.round(pl / risk * 100) / 100 : 0, pips: Math.round(move / pipSize(t.pair) * 10) / 10 };
  }
  /* the whole log → stats, today's loss, losing streak */
  function stats(trades, today, opt) {
    opt = opt || {};
    var closed = (trades || []).filter(function (t) { return t.exit !== '' && t.exit != null && num(t.exit) > 0; });
    var s = { n: closed.length, wins: 0, losses: 0, pl: 0, sumR: 0, grossWin: 0, grossLoss: 0, maxStreak: 0, streakNow: 0, todayPl: 0, todayLoss: 0, months: {}, pairs: {} };
    var run = 0;
    closed.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (t) {
      var c = closeTrade(t);
      s.pl += c.pl; s.sumR += c.r;
      if (c.pl > 0) { s.wins++; s.grossWin += c.pl; run = 0; } else { s.losses++; s.grossLoss += -c.pl; run++; }
      if (run > s.maxStreak) s.maxStreak = run;
      if (String(t.date) === today) s.todayPl += c.pl;
      var mo = String(t.date).slice(0, 7);
      var m = s.months[mo] || (s.months[mo] = { n: 0, pl: 0, sumR: 0, wins: 0 });
      m.n++; m.pl += c.pl; m.sumR += c.r; if (c.pl > 0) m.wins++;
      var pp = s.pairs[t.pair] || (s.pairs[t.pair] = { n: 0, pl: 0, sumR: 0 });
      pp.n++; pp.pl += c.pl; pp.sumR += c.r;
    });
    s.streakNow = run;
    s.todayLoss = s.todayPl < 0 ? -s.todayPl : 0;
    s.winRate = s.n ? Math.round(s.wins / s.n * 1000) / 10 : 0;
    s.avgR = s.n ? Math.round(s.sumR / s.n * 100) / 100 : 0;
    s.pf = s.grossLoss > 0 ? Math.round(s.grossWin / s.grossLoss * 100) / 100 : null;
    var lim = num(opt.streakLimit);
    s.streakStop = lim > 0 && s.streakNow >= lim;
    return s;
  }
  function yen(n) { n = Math.round(num(n)); return (n < 0 ? '-¥' : '¥') + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function csv(trades) {
    var head = ['日付', '通貨ペア', '売買', 'エントリー', '損切り', '利確', '決済', 'ロット', '1ロット通貨数', '決済通貨の円レート', '手数料等', '損益(円)', '予定リスク(円)', 'R倍数', 'メモ'];
    var rows = [head];
    (trades || []).forEach(function (t) {
      var c = num(t.exit) > 0 ? closeTrade(t) : { pl: '', risk: '', r: '' };
      rows.push([t.date, t.pair, t.dir === 'sell' ? '売り' : '買い', t.entry, t.stop, t.target || '', t.exit || '', t.lots, t.unit, quoteOf(t.pair) === 'JPY' ? 1 : t.qjpy, t.cost || 0, c.pl, c.risk, c.r, t.memo || '']);
    });
    return '﻿' + rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  }
  function parseCsv(text) {
    var out = [], lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
    lines.slice(1).forEach(function (ln) {
      var c = [], cur = '', q = false;
      for (var i = 0; i < ln.length; i++) {
        var ch = ln[i];
        if (q) { if (ch === '"' && ln[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
        else if (ch === '"') q = true; else if (ch === ',') { c.push(cur); cur = ''; } else cur += ch;
      }
      c.push(cur);
      if (c.length < 10) return;
      out.push({ date: c[0], pair: c[1], dir: c[2] === '売り' || c[2] === 'sell' ? 'sell' : 'buy', entry: c[3], stop: c[4], target: c[5], exit: c[6], lots: c[7], unit: c[8], qjpy: c[9], cost: c[10] || 0, memo: c[14] || '' });
    });
    return out;
  }
  var API = { PAIRS: PAIRS, MARGIN_RATE: MARGIN_RATE, num: num, quoteOf: quoteOf, pipSize: pipSize, floorStep: floorStep, plan: plan, closeTrade: closeTrade, stats: stats, yen: yen, csv: csv, parseCsv: parseCsv };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.FXL = API;
})(this);
