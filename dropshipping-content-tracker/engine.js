/* Dropshipping Content Tracker — Rechenkern (rein, ohne DOM). Läuft im Browser und in node. */
(function (root) {
  'use strict';
  function num(v) { if (typeof v === 'number') return isFinite(v) ? v : 0; var s = String(v == null ? '' : v).trim().replace(/\s/g, '').replace(/€/g, '');
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(',', '.');
    var n = parseFloat(s); return isFinite(n) ? n : 0; }
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function eur(x) { var neg = x < 0; x = Math.abs(r2(x)); var p = x.toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (neg ? '−' : '') + p[0] + ',' + p[1] + ' €'; }
  function int(x) { return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function dec(x, d) { return r2(x).toFixed(d == null ? 2 : d).replace('.', ','); }

  /* Ein Produkttest: Preis, Kosten, Videos → Ergebnis.
     p = {vk, ek, ship, feePct, feeFix, vat (19|0), returns, fixed, minPerVideo, hourly, perDay, days, ruleVideos, ruleOrders, videos:[{date,platform,hook,views,clicks,orders}]} */
  function evaluate(p) {
    var vk = num(p.vk), ek = num(p.ek), ship = num(p.ship), feePct = num(p.feePct), feeFix = num(p.feeFix);
    var vat = num(p.vat), returns = Math.max(0, Math.round(num(p.returns))), fixed = num(p.fixed);
    var vids = (p.videos || []).filter(function (v) { return v && (num(v.views) || num(v.orders) || num(v.clicks) || String(v.hook || '').trim()); });
    var views = 0, clicks = 0, orders = 0;
    vids.forEach(function (v) { views += num(v.views); clicks += num(v.clicks); orders += Math.round(num(v.orders)); });
    returns = Math.min(returns, orders);
    var net = vk / (1 + vat / 100);                 // Umsatz ohne USt je Bestellung
    var vatPer = vk - net;
    var fee = vk * feePct / 100 + feeFix;            // Zahlungsgebühr je Bestellung
    var db = net - ek - ship - fee;                  // Deckungsbeitrag je behaltener Bestellung
    var lossPerReturn = ek + ship + fee;             // Retoure: Kaufpreis geht an den Kunden, Ware nicht wiederverkauft, Gebühr bleibt
    var kept = orders - returns;
    var gross = orders * vk;
    var vatTotal = kept * vatPer;
    var contrib = kept * db - returns * lossPerReturn;
    var profit = contrib - fixed;
    var hours = vids.length * num(p.minPerVideo) / 60;
    var hourly = num(p.hourly);
    var profitAfterTime = profit - hours * hourly;
    var perHour = hours > 0 ? profit / hours : 0;
    var beOrders = db > 0 ? Math.ceil((fixed + returns * lossPerReturn) / db - 1e-9) : null; // Bestellungen bis Null
    var beAll = db > 0 ? Math.ceil((fixed + returns * lossPerReturn + hours * hourly) / db - 1e-9) + returns : null;
    var o10k = views > 0 ? orders / views * 10000 : 0;
    var ctr = views > 0 ? clicks / views * 100 : 0;
    var conv = clicks > 0 ? orders / clicks * 100 : 0;
    var planned = Math.round(num(p.perDay) * num(p.days));
    var ruleV = Math.round(num(p.ruleVideos)), ruleO = Math.round(num(p.ruleOrders));
    var verdict;
    if (!ruleV) verdict = { code: 'none', text: 'keine Regel gesetzt' };
    else if (vids.length < ruleV) verdict = { code: 'wait', text: 'noch ' + (ruleV - vids.length) + ' Videos bis zu deiner Regel (' + ruleV + ' Videos, mindestens ' + ruleO + ' Bestellungen)' };
    else if (orders >= ruleO) verdict = { code: 'go', text: 'Regel erfüllt: ' + orders + ' Bestellungen nach ' + vids.length + ' Videos (Ziel ' + ruleO + ')' };
    else verdict = { code: 'stop', text: 'Regel verfehlt: ' + orders + ' Bestellungen nach ' + vids.length + ' Videos (Ziel ' + ruleO + ') – laut deiner Regel stoppen' };
    return { videos: vids.length, views: views, clicks: clicks, orders: orders, returns: returns, kept: kept,
      net: r2(net), vatPer: r2(vatPer), fee: r2(fee), db: r2(db), lossPerReturn: r2(lossPerReturn),
      gross: r2(gross), vatTotal: r2(vatTotal), contrib: r2(contrib), profit: r2(profit), hours: r2(hours),
      profitAfterTime: r2(profitAfterTime), perHour: r2(perHour), beOrders: beOrders, beAll: beAll,
      o10k: r2(o10k), ctr: r2(ctr), conv: r2(conv), planned: planned, left: Math.max(0, planned - vids.length), verdict: verdict,
      hooks: hookRank(vids) };
  }

  /* Hooks nach Bestellungen je 1.000 Views (gleicher Hook-Text = eine Zeile) */
  function hookRank(vids) {
    var m = {}, order = [];
    vids.forEach(function (v) { var h = String(v.hook || '').trim() || '(ohne Hook)'; var k = h.toLowerCase();
      if (!m[k]) { m[k] = { hook: h, videos: 0, views: 0, orders: 0 }; order.push(k); }
      m[k].videos++; m[k].views += num(v.views); m[k].orders += Math.round(num(v.orders)); });
    return order.map(function (k) { var x = m[k]; x.o1k = x.views > 0 ? r2(x.orders / x.views * 1000) : 0; return x; })
      .sort(function (a, b) { return b.o1k - a.o1k || b.views - a.views; });
  }

  /* Pro: Posting-Queue für einen Tag über alle Tests. tests = [{id,name,start,perDay,days,videos:[{date}]}] */
  function queue(tests, today) {
    var out = [];
    (tests || []).forEach(function (t) {
      if (t.status === 'stop') return;
      var start = t.start || today, perDay = Math.round(num(t.perDay)), days = Math.round(num(t.days));
      if (!perDay || !days) return;
      var dayIdx = Math.floor((Date.parse(today + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 864e5);
      if (dayIdx < 0 || dayIdx >= days) return;
      var postedToday = (t.videos || []).filter(function (v) { return v.date === today; }).length;
      var postedTotal = (t.videos || []).length;
      var dueTotal = Math.min(perDay * (dayIdx + 1), perDay * days);
      var open = Math.max(0, Math.min(dueTotal - postedTotal, perDay * days - postedTotal));
      out.push({ id: t.id, name: t.name, day: dayIdx + 1, days: days, postedToday: postedToday, open: open });
    });
    return out;
  }

  /* Pro: CSV mit Kopfzeile (Datum;Plattform;Hook;Views;Klicks;Bestellungen) → Videos. Erkennt ; oder , und Anführungszeichen. */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    var first = text.split(/\r?\n/)[0] || ''; var sep = (first.split(';').length >= first.split(',').length) ? ';' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) { var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c; }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    function col(names) { for (var j = 0; j < head.length; j++) for (var n = 0; n < names.length; n++) if (head[j].indexOf(names[n]) === 0) return j; return -1; }
    var cD = col(['datum', 'date']), cP = col(['plattform', 'platform']), cH = col(['hook', 'titel', 'title']), cV = col(['views', 'aufrufe', 'video views']),
      cC = col(['klicks', 'clicks', 'link']), cO = col(['bestell', 'orders', 'käufe', 'sales']);
    var out = [];
    rows.slice(1).forEach(function (r) { if (!r.join('').trim()) return;
      var d = cD >= 0 ? String(r[cD]).trim() : ''; var m = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (m) d = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
      out.push({ date: d, platform: cP >= 0 ? String(r[cP]).trim() : '', hook: cH >= 0 ? String(r[cH]).trim() : '',
        views: cV >= 0 ? num(r[cV]) : 0, clicks: cC >= 0 ? num(r[cC]) : 0, orders: cO >= 0 ? Math.round(num(r[cO])) : 0 }); });
    return out;
  }
  function toCSV(tests) {
    var esc = function (s) { s = String(s == null ? '' : s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var L = ['Produkt;Datum;Plattform;Hook;Views;Klicks;Bestellungen'];
    (tests || []).forEach(function (t) { (t.videos || []).forEach(function (v) {
      L.push([t.name, v.date, v.platform, v.hook, num(v.views), num(v.clicks), Math.round(num(v.orders))].map(esc).join(';')); }); });
    return '﻿' + L.join('\r\n') + '\r\n';
  }
  /* Pro: .ics — eine Erinnerung je Testtag mit der Zahl der Videos */
  function toICS(tests, hour) {
    hour = ('0' + (hour == null ? 18 : hour)).slice(-2);
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rulestamp//dropshipping-content-tracker//DE', 'CALSCALE:GREGORIAN'];
    (tests || []).forEach(function (t) { if (t.status === 'stop') return; var n = Math.round(num(t.days)), per = Math.round(num(t.perDay));
      for (var i = 0; i < n; i++) { var d = new Date(Date.parse(t.start + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
        L.push('BEGIN:VEVENT', 'UID:' + (t.id || 'test') + '-' + d + '@dropshipping-content-tracker', 'DTSTAMP:' + d + 'T000000Z',
          'DTSTART:' + d + 'T' + hour + '0000', 'DURATION:PT30M',
          'SUMMARY:' + String(per + ' Videos posten: ' + t.name + ' (Tag ' + (i + 1) + '/' + n + ')').replace(/[,;]/g, ' '),
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15M', 'DESCRIPTION:Videos posten', 'END:VALARM', 'END:VEVENT'); } });
    L.push('END:VCALENDAR'); return L.join('\r\n') + '\r\n';
  }

  var EX = { name: 'LED-Mondlampe (Beispiel)', vk: '29,99', ek: '9,80', ship: '4,90', feePct: '2,9', feeFix: '0,30', vat: '19', returns: '1', fixed: '24',
    minPerVideo: '40', hourly: '15', perDay: '3', days: '5', ruleVideos: '15', ruleOrders: '10',
    videos: [
      { date: '2026-11-09', platform: 'TikTok', hook: 'Zimmer ohne Deckenlicht', views: 820, clicks: 6, orders: 0 },
      { date: '2026-11-09', platform: 'TikTok', hook: 'Geschenk unter 30 €', views: 1450, clicks: 11, orders: 1 },
      { date: '2026-11-09', platform: 'Instagram', hook: 'Zimmer ohne Deckenlicht', views: 610, clicks: 3, orders: 0 },
      { date: '2026-11-10', platform: 'TikTok', hook: 'Mond über dem Bett', views: 5400, clicks: 41, orders: 2 },
      { date: '2026-11-10', platform: 'TikTok', hook: 'Geschenk unter 30 €', views: 2300, clicks: 15, orders: 1 },
      { date: '2026-11-10', platform: 'Instagram', hook: 'Mond über dem Bett', views: 1900, clicks: 9, orders: 0 },
      { date: '2026-11-11', platform: 'TikTok', hook: 'Mond über dem Bett', views: 12800, clicks: 96, orders: 3 },
      { date: '2026-11-11', platform: 'TikTok', hook: 'Zimmer ohne Deckenlicht', views: 940, clicks: 5, orders: 0 },
      { date: '2026-11-11', platform: 'Instagram', hook: 'Geschenk unter 30 €', views: 1200, clicks: 8, orders: 1 },
      { date: '2026-11-12', platform: 'TikTok', hook: 'Mond über dem Bett', views: 7300, clicks: 52, orders: 1 },
      { date: '2026-11-12', platform: 'TikTok', hook: 'Geschenk unter 30 €', views: 1100, clicks: 7, orders: 0 },
      { date: '2026-11-12', platform: 'Instagram', hook: 'Zimmer ohne Deckenlicht', views: 480, clicks: 2, orders: 0 }
    ] };

  var API = { num: num, r2: r2, eur: eur, int: int, dec: dec, evaluate: evaluate, hookRank: hookRank, queue: queue, parseCSV: parseCSV, toCSV: toCSV, toICS: toICS, EX: EX };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.DCT = API;
})(this);
