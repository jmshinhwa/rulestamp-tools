/* organic dropshipping tracker - math. No DOM here, so node can test it (test/test.js). */
(function (root) {
  'use strict';
  function num(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/[$\s]/g, '').replace(/,/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function r2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function isoOk(d) {
    d = String(d || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    var t = new Date(d + 'T00:00:00Z');
    return isNaN(t.getTime()) ? '' : d;
  }
  function addDays(d, n) {
    d = isoOk(d); if (!d) return '';
    var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n);
    return t.toISOString().slice(0, 10);
  }

  /* One product test. Money per order:
     price - supplier - shipping - duty - card/platform fees - returns (returned orders: price given back,
     product, shipping, duty and card fee already spent). */
  function calc(i) {
    var p = {
      price: num(i.price), cogs: num(i.cogs), ship: num(i.ship), duty: num(i.duty),
      feePct: num(i.feePct), feeFix: num(i.feeFix), extraPct: num(i.extraPct), returnPct: num(i.returnPct),
      videos: Math.max(0, Math.round(num(i.videos))), views: Math.max(0, num(i.views)), clicks: Math.max(0, num(i.clicks)),
      orders: Math.max(0, Math.round(num(i.orders))), minPerVideo: Math.max(0, num(i.minPerVideo)),
      sampleCost: num(i.sampleCost), ruleVideos: Math.max(0, Math.round(num(i.ruleVideos))), targetHour: num(i.targetHour)
    };
    var o = { input: p };
    o.supplierMargin = p.price - p.cogs;
    o.feePerOrder = p.price * (p.feePct + p.extraPct) / 100 + p.feeFix;
    o.returnPerOrder = p.price * p.returnPct / 100;
    o.profitPerOrder = p.price - p.cogs - p.ship - p.duty - o.feePerOrder - o.returnPerOrder;
    o.gonePerOrder = o.supplierMargin - o.profitPerOrder;
    o.goneTotal = o.gonePerOrder * p.orders;
    o.sales = p.price * p.orders;
    o.netTest = o.profitPerOrder * p.orders - p.sampleCost;
    o.hours = p.videos * p.minPerVideo / 60;
    o.perHour = o.hours > 0 ? o.netTest / o.hours : null;
    o.per1kViews = p.views > 0 ? o.netTest / p.views * 1000 : null;
    o.viewsPerOrder = p.orders > 0 ? p.views / p.orders : null;
    o.clickRate = p.views > 0 ? p.clicks / p.views * 100 : null;
    o.convRate = p.clicks > 0 ? p.orders / p.clicks * 100 : null;
    o.ordersPerVideo = p.videos > 0 ? p.orders / p.videos : null;
    o.videosLeft = Math.max(0, p.ruleVideos - p.videos);
    var keepShare = 1 - (p.feePct + p.extraPct + p.returnPct) / 100;
    var need = p.targetHour * o.hours + p.sampleCost;          // test profit that pays your hours at your rate
    o.targetProfit = need;
    o.priceNeeded = (p.orders > 0 && keepShare > 0) ? (need / p.orders + p.cogs + p.ship + p.duty + p.feeFix) / keepShare : null;
    o.ordersNeeded = o.profitPerOrder > 0 ? Math.ceil(need / o.profitPerOrder - 1e-9) : null;
    o.breakEvenPrice = keepShare > 0 ? (p.cogs + p.ship + p.duty + p.feeFix) / keepShare : null;
    if (o.profitPerOrder <= 0) { o.verdict = 'kill'; o.why = 'every order loses money'; }
    else if (p.orders > 0 && o.perHour != null && o.perHour >= p.targetHour) { o.verdict = 'scale'; o.why = 'pays your hours at or above your rate'; }
    else if (o.videosLeft > 0) { o.verdict = 'keep'; o.why = o.videosLeft + ' videos left in your test'; }
    else if (p.orders === 0) { o.verdict = 'kill'; o.why = 'no order after ' + p.videos + ' videos'; }
    else { o.verdict = 'fix'; o.why = 'profitable, but under your hourly rate'; }
    return o;
  }

  /* Pro: a product board fed by a per-video log. */
  function productTotals(prod, log) {
    var rows = (log || []).filter(function (r) { return r.pid === prod.id; });
    var t = { videos: rows.length, views: 0, clicks: 0, orders: 0, first: '', last: '' };
    rows.forEach(function (r) {
      t.views += num(r.views); t.clicks += num(r.clicks); t.orders += Math.round(num(r.orders));
      var d = isoOk(r.date);
      if (d && (!t.first || d < t.first)) t.first = d;
      if (d && (!t.last || d > t.last)) t.last = d;
    });
    return t;
  }
  function productCalc(prod, log, set) {
    var t = productTotals(prod, log);
    var i = Object.assign({}, prod, { videos: t.videos, views: t.views, clicks: t.clicks, orders: t.orders,
      ruleVideos: set.ruleVideos, targetHour: set.targetHour });
    var o = calc(i);
    o.totals = t;
    var start = isoOk(prod.start) || t.first;
    o.start = start;
    o.decideOn = start ? addDays(start, Math.max(1, Math.round(num(set.testDays))) - 1) : '';
    return o;
  }
  function board(products, log, set) {
    return (products || []).map(function (p) { return { p: p, o: productCalc(p, log, set) }; })
      .sort(function (a, b) { return b.o.netTest - a.o.netTest; });
  }
  function topVideos(pid, log, n) {
    return (log || []).filter(function (r) { return r.pid === pid; }).slice()
      .sort(function (a, b) { return (num(b.orders) - num(a.orders)) || (num(b.views) - num(a.views)); })
      .slice(0, n || 3);
  }

  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csvOut(products, log) {
    var byId = {}; (products || []).forEach(function (p) { byId[p.id] = p; });
    var lines = ['date,product,video,views,clicks,orders'];
    (log || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (r) {
      lines.push([r.date, byId[r.pid] ? byId[r.pid].name : '', r.video, num(r.views), num(r.clicks), Math.round(num(r.orders))].map(csvCell).join(','));
    });
    return lines.join('\n') + '\n';
  }
  function splitCsvLine(line) {
    var out = [], cur = '', q = false;
    for (var k = 0; k < line.length; k++) {
      var c = line[k];
      if (q) { if (c === '"') { if (line[k + 1] === '"') { cur += '"'; k++; } else q = false; } else cur += c; }
      else if (c === '"') q = true; else if (c === ',' || c === ';' || c === '\t') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out.map(function (s) { return s.trim(); });
  }
  /* CSV in: a header row naming date, product, video/title/hook, views/plays, clicks/sessions, orders.
     Returns rows with product NAMES; the page matches names to products (new names become new products). */
  function csvIn(text) {
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    var res = { rows: [], bad: [] };
    if (!lines.length) return res;
    var h = splitCsvLine(lines[0]).map(function (s) { return s.toLowerCase(); });
    function col(re) { for (var k = 0; k < h.length; k++) if (re.test(h[k])) return k; return -1; }
    var cD = col(/date|posted|day/), cP = col(/product/), cV = col(/video|title|hook|caption/),
      cW = col(/view|play/), cC = col(/click|session|visit/), cO = col(/order|sale|purchase/);
    if (cW < 0) { res.bad.push('header: no views column'); return res; }
    for (var n = 1; n < lines.length; n++) {
      var c = splitCsvLine(lines[n]);
      var d = cD >= 0 ? isoOk(c[cD]) : '';
      if (cD >= 0 && !d) { res.bad.push('line ' + (n + 1)); continue; }
      res.rows.push({ date: d, product: cP >= 0 ? c[cP] : '', video: cV >= 0 ? c[cV] : '',
        views: num(c[cW]), clicks: cC >= 0 ? num(c[cC]) : 0, orders: cO >= 0 ? Math.round(num(c[cO])) : 0 });
    }
    return res;
  }
  function icsDate(d) { return d.replace(/-/g, ''); }
  function icsText(t) { return String(t == null ? '' : t).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n'); }
  function ics(items, now) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//organic dropshipping tracker//EN', 'CALSCALE:GREGORIAN'];
    var stamp = (isoOk(now) || '2026-01-01').replace(/-/g, '') + 'T000000Z';
    (items || []).forEach(function (it, k) {
      if (!isoOk(it.date)) return;
      L.push('BEGIN:VEVENT', 'UID:odt-' + k + '-' + icsDate(it.date) + '@organic-dropshipping-tracker', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + icsDate(it.date), 'DTEND;VALUE=DATE:' + icsDate(addDays(it.date, 1)),
        'SUMMARY:' + icsText(it.title), 'DESCRIPTION:' + icsText(it.note),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(it.title), 'TRIGGER:-PT12H', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }
  var api = { num: num, r2: r2, isoOk: isoOk, addDays: addDays, calc: calc, productTotals: productTotals, productCalc: productCalc,
    board: board, topVideos: topVideos, csvOut: csvOut, csvIn: csvIn, ics: ics };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ODT = api;
})(this);
