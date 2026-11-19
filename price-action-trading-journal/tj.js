/* Price action trading journal (en) - engine for browser and node. No network, no libraries. Parsers shared with our de/es journals. */
(function (root) {
  'use strict';

  /* ---------- números y fechas ---------- */
  function num(s) {
    if (s === null || s === undefined) return NaN;
    if (typeof s === 'number') return s;
    var raw = String(s), neg = /\(\s*[^)]*\d[^)]*\)/.test(raw);
    var t = raw.replace(/[−–]/g, '-').replace(/[^0-9.,\-]/g, '');
    if (!t || t === '-') return NaN;
    var c = t.lastIndexOf(','), d = t.lastIndexOf('.');
    if (c > -1 && d > -1) {
      if (c > d) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, '');
    } else if (c > -1) {
      var parts = t.split(',');
      if (parts.length > 2 || (parts[1] && parts[1].length === 3 && parts[0].replace('-', '').length >= 1 && !/^-?0$/.test(parts[0]))) t = t.replace(/,/g, ''); else t = t.replace(',', '.');
    } else if (d > -1) {
      var p2 = t.split('.');
      if (p2.length > 2) t = t.replace(/\./g, '');
    }
    var v = parseFloat(t);
    if (!isNaN(v) && neg && v > 0) v = -v;
    return isNaN(v) ? NaN : v;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* → "YYYY-MM-DD HH:MM" (hora del servidor, sin convertir zonas) */
  var DMY = false; /* set per file by parseText: true = 31/12/2026, false = 12/31/2026 (US) */
  function date(s, dmy) {
    if (dmy === undefined) dmy = DMY;
    if (!s) return '';
    var t = String(s).trim(), m;
    if ((m = t.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/))) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]) + ' ' + pad(+(m[4] || 0)) + ':' + (m[5] || '00');
    if ((m = t.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})(?:[ T,]+(\d{1,2}):(\d{2}))?/))) {
      var a = +m[1], b = +m[2], day = dmy ? a : b, mon = dmy ? b : a;
      if (mon > 12 && day <= 12) { var x = day; day = mon; mon = x; }
      return m[3] + '-' + pad(mon) + '-' + pad(day) + ' ' + pad(+(m[4] || 0)) + ':' + (m[5] || '00');
    }
    return '';
  }
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function weekday(d) { var x = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))); return DOW[x.getUTCDay()]; }
  function r2(x) { return Math.round(x * 100) / 100; }

  function side(s) {
    var t = String(s || '').toLowerCase();
    if (/sell|verkauf|short|venta|leer/.test(t)) return 'sell';
    if (/buy|kauf|long|compra/.test(t)) return 'buy';
    return '';
  }

  function mk(o) {
    var t = {
      platform: o.platform || '', id: String(o.id || ''), symbol: String(o.symbol || '').trim().toUpperCase(), side: side(o.side),
      lots: num(o.lots) || 0, open: date(o.open), close: date(o.close) || date(o.open), entry: num(o.entry), exit: num(o.exit),
      sl: num(o.sl), tp: num(o.tp), commission: num(o.commission) || 0, swap: num(o.swap) || 0, profit: num(o.profit),
      setup: String(o.setup || '').trim(), note: String(o.note || '').trim(), slKnown: o.sl !== undefined,
      commKnown: o.commission !== undefined && String(o.commission).trim() !== ''
    };
    if (isNaN(t.sl)) t.sl = 0;
    if (isNaN(t.tp)) t.tp = 0;
    if (o.net !== undefined && o.net !== '' && !isNaN(num(o.net))) {
      t.net = r2(num(o.net));
      if (isNaN(t.profit)) t.profit = r2(t.net - t.commission - t.swap);
    } else {
      t.net = r2((isNaN(t.profit) ? 0 : t.profit) + t.commission + t.swap);
    }
    if (isNaN(t.profit)) t.profit = 0;
    return t;
  }

  /* ---------- texto pegado / CSV (cTrader, genérico, tu Excel) ---------- */
  var SYN = {
    id: ['id', 'ticket', 'positions-id', 'positionsnr', 'auftrag', 'position', 'posición', 'posicion', 'position id', 'order', 'orden', 'deal'],
    symbol: ['symbol', 'contract', 'product', 'instrument', 'basiswert', 'markt', 'símbolo', 'simbolo', 'item', 'instrument', 'instrumento', 'activo', 'par'],
    side: ['side', 'type', 'typ', 'richtung', 'art', 'tipo', 'direction', 'opening direction', 'dirección', 'direccion', 'sentido', 'operación', 'operacion'],
    lots: ['lots', 'lot', 'lose', 'größe', 'menge', 'stück', 'kontrakte', 'lotes', 'volume', 'volumen', 'size', 'quantity', 'closing quantity', 'cantidad', 'tamaño', 'volume (lots)', 'qty', 'contracts', 'filled qty'],
    open: ['open time', 'opening time', 'eröffnung', 'eröffnet', 'einstieg zeit', 'eröffnungszeit', 'datum', 'open', 'zeit', 'apertura', 'fecha apertura', 'hora apertura', 'entry time', 'time', 'fecha', 'open date', 'opened'],
    close: ['close time', 'closing time', 'schließung', 'geschlossen', 'schlusszeit', 'ausstieg zeit', 'close', 'cierre', 'fecha cierre', 'hora cierre', 'exit time', 'close date', 'closed'],
    entry: ['entry price', 'open price', 'einstieg', 'einstiegskurs', 'eröffnungskurs', 'kurs eröffnung', 'opening price', 'precio entrada', 'precio de entrada', 'entrada', 'price'],
    exit: ['closing price', 'close price', 'ausstieg', 'ausstiegskurs', 'schlusskurs', 'kurs schließung', 'exit price', 'precio salida', 'precio de salida', 'salida', 'precio cierre'],
    sl: ['s/l', 'sl', 's / l', 'stop loss', 'stop', 'stoploss'],
    tp: ['t/p', 'tp', 't / p', 'take profit', 'objetivo'],
    commission: ['commission', 'fees', 'total fees', 'comm', 'commissions', 'kommission', 'provision', 'gebühr', 'gebühren', 'comisión', 'comision', 'comisiones'],
    swap: ['swap', 'swaps', 'rollover'],
    profit: ['profit', 'gross', 'gewinn', 'g/v', 'brutto', 'ergebnis', 'gross $', 'gross €', 'beneficio', 'resultado', 'p/l', 'pnl', 'p&l', 'ganancia', 'realized p&l', 'realized pnl', 'gross p&l'],
    net: ['net', 'netto', 'net $', 'net €', 'net usd', 'net eur', 'net p&l', 'net pnl', 'neto', 'beneficio neto', 'resultado neto'],
    setup: ['setup', 'strategie', 'muster', 'estrategia', 'strategy', 'tag', 'etiqueta', 'label', 'comment', 'comentario'],
    note: ['note', 'notiz', 'kommentar notiz', 'nota', 'notas', 'notes']
  };
  function norm(h) { return String(h || '').toLowerCase().replace(/\s+/g, ' ').replace(/[()]/g, '').trim(); }
  function splitLine(line, d) {
    if (d !== ',') return line.split(d);
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function parseText(text, platform) {
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return { trades: [], skipped: 0, platform: platform || 'Text' };
    var d = /\t/.test(lines[0]) ? '\t' : (lines[0].split(';').length > lines[0].split(',').length ? ';' : ',');
    var head = splitLine(lines[0], d).map(norm), map = {}, used = {};
    var order = ['net', 'close', 'exit', 'open', 'entry', 'id', 'symbol', 'side', 'lots', 'sl', 'tp', 'commission', 'swap', 'profit', 'setup', 'note'];
    order.forEach(function (k) {
      for (var i = 0; i < head.length; i++) {
        if (used[i]) continue;
        if (SYN[k].indexOf(head[i]) > -1 || SYN[k].indexOf(head[i].replace(/ \(.*$/, '')) > -1) { map[k] = i; used[i] = 1; return; }
      }
    });
    /* columnas repetidas tipo MT: "Time ... Price ... Time ... Price" */
    head.forEach(function (h, i) {
      if (used[i]) return;
      if (h === 'time' && map.open !== undefined && map.close === undefined) { map.close = i; used[i] = 1; }
      else if (h === 'price' && map.entry !== undefined && map.exit === undefined) { map.exit = i; used[i] = 1; }
    });
    /* day/month order for the whole file: a first part > 12 means 31/12, a second part > 12 means 12/31; else US order */
    var dmy = false, seenDMY = false, seenMDY = false;
    for (var q = 1; q < lines.length; q++) {
      var cq = splitLine(lines[q], d);
      ['open', 'close'].forEach(function (k) { var mm = map[k] !== undefined && String(cq[map[k]] || '').match(/^\s*(\d{1,2})[.\-\/](\d{1,2})[.\-\/]\d{4}/); if (mm) { if (+mm[1] > 12) seenDMY = true; if (+mm[2] > 12) seenMDY = true; } });
    }
    if (seenDMY && !seenMDY) dmy = true;
    if (!seenDMY && !seenMDY && /cTrader/.test(platform || '')) dmy = true;
    var keepDMY = DMY; DMY = dmy;
    var trades = [], skipped = 0;
    for (var r = 1; r < lines.length; r++) {
      var c = splitLine(lines[r], d), o = { platform: platform || 'Text' };
      Object.keys(map).forEach(function (k) { o[k] = (c[map[k]] || '').trim(); });
      if (/total|balance|deposit|einzahlung|auszahlung|summe|depósito|ingreso/i.test(lines[r].slice(0, 40)) && !o.symbol) { skipped++; continue; }
      var t = mk(o);
      if (!t.symbol || (!t.side && map.side !== undefined) || !t.close || (isNaN(t.net))) { skipped++; continue; }
      trades.push(t);
    }
    DMY = keepDMY;
    return { trades: trades, skipped: skipped, platform: platform || 'Text', cols: Object.keys(map), dayFirst: dmy };
  }

  /* ---------- HTML de MetaTrader 4 / 5 ---------- */
  function cells(rowHtml) {
    var out = [], re = /<td([^>]*)>([\s\S]*?)<\/td>/gi, m;
    while ((m = re.exec(rowHtml))) {
      if (/class\s*=\s*"?hidden/i.test(m[1])) continue;
      var span = (m[1].match(/colspan\s*=\s*"?(\d+)/i) || [])[1];
      var txt = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      out.push(txt);
      if (span && +span > 1 && !txt) for (var k = 1; k < +span; k++) out.push('');
    }
    return out;
  }
  function rows(html) {
    var out = [], re = /<tr[^>]*>([\s\S]*?)<\/tr>/gi, m;
    while ((m = re.exec(html))) out.push(cells(m[1]));
    return out;
  }
  var MTDATE = /^\d{4}\.\d{2}\.\d{2}/;
  /* MT4 «Detailed Statement»: Ticket, Open Time, Type, Size, Item, Price, S/L, T/P, Close Time, Price, Commission, Taxes, Swap, Profit */
  function parseMT4(html) {
    var trades = [], skipped = 0;
    rows(html).forEach(function (c) {
      if (!MTDATE.test(c[1] || '')) return;
      if (c.length < 14) { skipped++; return; }
      var ty = (c[2] || '').toLowerCase();
      if (ty !== 'buy' && ty !== 'sell') { skipped++; return; }
      if (!MTDATE.test(c[8] || '')) { skipped++; return; }
      trades.push(mk({ platform: 'MT4', id: c[0], open: c[1], side: ty, lots: c[3], symbol: c[4], entry: c[5], sl: c[6], tp: c[7], close: c[8], exit: c[9], commission: num(c[10]) + (num(c[11]) || 0), swap: c[12], profit: c[13] }));
    });
    return { trades: trades, skipped: skipped, platform: 'MT4' };
  }
  /* MT5 informe, bloque «Positions/Posiciones»: Time, Position, Symbol, Type, Volume, Price, S/L, T/P, Time, Price, Commission, Swap, Profit */
  function parseMT5(html) {
    var trades = [], skipped = 0, inPos = false;
    rows(html).forEach(function (c) {
      var first = (c[0] || '').toLowerCase();
      if (c.length <= 2 && first) { inPos = /^(positions|positionen|posiciones)$/.test(first); return; }
      if (!inPos || !MTDATE.test(c[0] || '')) return;
      if (c.length < 13) { skipped++; return; }
      var ty = (c[3] || '').toLowerCase();
      if (ty !== 'buy' && ty !== 'sell') { skipped++; return; }
      trades.push(mk({ platform: 'MT5', open: c[0], id: c[1], symbol: c[2], side: ty, lots: c[4], entry: c[5], sl: c[6], tp: c[7], close: c[8], exit: c[9], commission: c[10], swap: c[11], profit: c[12] }));
    });
    return { trades: trades, skipped: skipped, platform: 'MT5' };
  }
  function decode(bytes) {
    var u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var enc = 'utf-8';
    if (u[0] === 0xFF && u[1] === 0xFE) enc = 'utf-16le';
    else if (u[0] === 0xFE && u[1] === 0xFF) enc = 'utf-16be';
    else if (u.length > 3 && u[1] === 0 && u[3] === 0) enc = 'utf-16le';
    return new TextDecoder(enc).decode(u).replace(/^﻿/, '');
  }
  /* Tradovate "Performance" CSV (futures): symbol, qty, buyPrice, sellPrice, pnl, boughtTimestamp, soldTimestamp. No fee column. */
  function parseTradovate(text) {
    var lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    var h = splitLine(lines[0], ',').map(norm), ix = {};
    h.forEach(function (x, i) { ix[x] = i; });
    var trades = [], skipped = 0;
    for (var r = 1; r < lines.length; r++) {
      var c = splitLine(lines[r], ',');
      function g(k) { return ix[k] === undefined ? '' : String(c[ix[k]] || '').trim(); }
      var b = date(g('boughttimestamp'), false), s2 = date(g('soldtimestamp'), false);
      if (!g('symbol') || !b || !s2 || isNaN(num(g('pnl')))) { skipped++; continue; }
      var lng = b <= s2;
      trades.push(mk({ platform: 'Tradovate', id: g('buyfillid') + '-' + g('sellfillid'), symbol: g('symbol'), side: lng ? 'buy' : 'sell', lots: g('qty'),
        open: lng ? g('boughttimestamp') : g('soldtimestamp'), close: lng ? g('soldtimestamp') : g('boughttimestamp'),
        entry: lng ? g('buyprice') : g('sellprice'), exit: lng ? g('sellprice') : g('buyprice'), profit: g('pnl'), setup: g('setup') }));
    }
    trades.forEach(function (t) { t.open = date(t.open, false) || t.open; });
    return { trades: trades, skipped: skipped, platform: 'Tradovate' };
  }
  /* any file -> trades */
  function parseAny(text) {
    var t = String(text || '');
    if (/boughtTimestamp/i.test(t.split(/\r?\n/)[0] || '') && /soldTimestamp/i.test(t.split(/\r?\n/)[0] || '')) return parseTradovate(t);
    if (/<t[dr][\s>]/i.test(t)) {
      if (/(^|>)\s*(Positions|Positionen|Posiciones)\s*</i.test(t) || /MetaTrader 5|Trade History Report|Informe del historial/i.test(t)) { var a = parseMT5(t); if (a.trades.length) return a; }
      var b = parseMT4(t); if (b.trades.length) return b;
      var a2 = parseMT5(t); if (a2.trades.length) return a2;
      return { trades: [], skipped: 0, platform: 'html' };
    }
    var looksCT = /closing direction|opening direction|closing quantity|net \$|net €|net eur|net usd/i.test(t.split(/\r?\n/)[0] || '');
    return parseText(t, looksCT ? 'cTrader' : 'Text');
  }


  /* ---------- expectancy per setup after costs ---------- */
  function sum(a, f) { var s = 0; a.forEach(function (x) { s += f(x); }); return r2(s); }
  /* Cost per trade. mode 'in': prices from a broker export, the spread is already inside the result ->
     gross (before costs) = result + spread. mode 'add': result noted without costs (backtest, hand notes) ->
     the spread is taken off. Extra slippage per lot is always a stated assumption on top.
     Commission: from the export; when the export has no fee column (Tradovate Performance CSV), lots x your commission per lot. */
  function costs(t, o) {
    var sp = r2((t.lots || 0) * (num((o.spreads || {})[t.symbol]) || 0));
    var sl = r2((t.lots || 0) * (o.slip || 0));
    var cm = t.commKnown ? t.commission : r2(-(t.lots || 0) * (o.comm || 0));
    var gross = o.mode === 'add' ? t.profit : r2(t.profit + sp);
    var net = r2(gross - sp - sl + cm + t.swap);
    return { spread: sp, slip: sl, commission: cm, swap: t.swap, gross: gross, net: net, cost: r2(gross - net) };
  }
  function stats(list, o) {
    var n = list.length, W = list.filter(function (x) { return x.c.net > 0; }), L = list.filter(function (x) { return x.c.net <= 0; });
    var s = {
      n: n, wins: W.length, lots: sum(list, function (x) { return x.t.lots || 0; }),
      gross: sum(list, function (x) { return x.c.gross; }), net: sum(list, function (x) { return x.c.net; }), cost: sum(list, function (x) { return x.c.cost; }),
      spread: sum(list, function (x) { return x.c.spread; }), slip: sum(list, function (x) { return x.c.slip; }),
      commission: sum(list, function (x) { return x.c.commission; }), swap: sum(list, function (x) { return x.c.swap; })
    };
    s.expGross = n ? r2(s.gross / n) : 0; s.expNet = n ? r2(s.net / n) : 0; s.expCost = n ? r2(s.cost / n) : 0;
    s.expR = o.risk ? r2(s.expNet / o.risk) : 0;
    s.winRate = n ? W.length / n : 0;
    s.avgWin = W.length ? r2(sum(W, function (x) { return x.c.net; }) / W.length) : 0;
    s.avgLoss = L.length ? r2(sum(L, function (x) { return x.c.net; }) / L.length) : 0;
    s.beWin = (s.avgWin > 0 && s.avgLoss < 0) ? -s.avgLoss / (s.avgWin - s.avgLoss) : null;
    s.costShare = s.gross > 0 ? s.cost / s.gross : null;
    s.buffer = (s.net > 0 && s.lots > 0) ? r2(s.net / s.lots) : 0;
    s.verdict = s.gross <= 0 ? 'loses before costs' : (s.net <= 0 ? 'costs eat the edge' : 'holds after costs');
    s.code = s.gross <= 0 ? 'loss' : (s.net <= 0 ? 'eaten' : 'ok');
    s.thin = n < (o.minN || 0);
    return s;
  }
  var NOSETUP = '(no setup)';
  function compute(trades, opt) {
    var o = opt || {}; o.minN = o.minN === undefined ? 20 : o.minN;
    var X = trades.slice().sort(function (a, b) { return a.close < b.close ? -1 : a.close > b.close ? 1 : 0; }).map(function (t) { return { t: t, c: costs(t, o) }; });
    var res = stats(X, o), g = {};
    X.forEach(function (x) { var k = x.t.setup || NOSETUP; (g[k] = g[k] || []).push(x); });
    res.setups = Object.keys(g).map(function (k) { var s = stats(g[k], o); s.name = k; return s; })
      .sort(function (a, b) { return b.expNet - a.expNet; });
    var ms = {};
    X.forEach(function (x) { var k = (x.t.setup || NOSETUP) + '\u0000' + x.t.close.slice(0, 7); (ms[k] = ms[k] || []).push(x); });
    res.months = Object.keys(ms).sort().map(function (k) { var p = k.split('\u0000'), s = stats(ms[k], o); s.name = p[0]; s.month = p[1]; return s; });
    res.eaten = res.setups.filter(function (s) { return s.code === 'eaten'; }).sort(function (a, b) { return b.gross - a.gross; });
    res.carry = res.setups.filter(function (s) { return s.code === 'ok'; });
    res.symbols = Object.keys(X.reduce(function (a, x) { a[x.t.symbol] = 1; return a; }, {})).sort();
    res.missingSpread = res.symbols.filter(function (y) { return !(num((o.spreads || {})[y]) > 0); });
    res.noFee = X.filter(function (x) { return !x.t.commKnown; }).length;
    res.rows = X;
    return res;
  }

  var SYM = { USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };
  function money(x, cur) {
    var sym = SYM[cur || 'USD'] || '$';
    var v = Math.abs(Math.round(x * 100) / 100).toFixed(2).split('.');
    return (x < -0.004 ? '−' : '') + sym + v[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + v[1];
  }
  function signed(x, cur) { return (x > 0.004 ? '+' : '') + money(x, cur); }
  function pct(x) { return (Math.round(x * 1000) / 10).toFixed(1) + '%'; }
  function dec(x) { return (Math.round(x * 100) / 100).toFixed(2).replace(/^-/, '−'); }

  function csvCell(v) { v = String(v); return /[,"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
  /* comma CSV with dot decimals (Excel / Google Sheets, US-UK locale) */
  function csv(r) {
    var out = ['Close time,Open time,Symbol,Side,Lots,Setup,Export result,Spread (est.),Commission,Swap,Extra slippage,Gross before costs,Costs,Net'];
    r.rows.forEach(function (x) {
      var t = x.t, c = x.c;
      out.push([t.close, t.open, t.symbol, t.side, f2(t.lots), t.setup, f2(t.profit), f2(c.spread), f2(c.commission), f2(c.swap), f2(c.slip), f2(c.gross), f2(c.cost), f2(c.net)].map(csvCell).join(','));
    });
    out.push('');
    out.push('Setup,Trades,Win rate,Gross expectancy per trade,Costs per trade,Net expectancy per trade,Net in R,Break-even win rate,Cost share,Verdict');
    r.setups.forEach(function (s) {
      out.push([s.name, s.n, f2(s.winRate * 100) + '%', f2(s.expGross), f2(s.expCost), f2(s.expNet), f2(s.expR), s.beWin === null ? '' : f2(s.beWin * 100) + '%', s.costShare === null ? '' : f2(s.costShare * 100) + '%', s.verdict].map(csvCell).join(','));
    });
    return '﻿' + out.join('\r\n') + '\r\n';
  }
  function ics(startDay, hour) {
    var d = startDay.replace(/-/g, ''), h = pad(+hour || 18);
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//price-action-trading-journal//en', 'BEGIN:VEVENT', 'UID:price-action-trading-journal-' + d + '@rulestamp', 'DTSTAMP:' + d + 'T000000Z',
      'DTSTART:' + d + 'T' + h + '0000', 'DURATION:PT20M', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Trading journal: load this week\\, check each setup after costs',
      'DESCRIPTION:Export your MT4/MT5/cTrader/Tradovate history\\, load it into the price action trading journal and read the net expectancy per setup.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }
  function key(t) { return t.id ? '#' + t.id : [t.symbol, t.open, t.close, t.profit].join('|'); }
  function merge(old, add) {
    var seen = {}, out = [], dup = 0;
    old.concat(add).forEach(function (t) { var k = key(t); if (seen[k]) { dup++; return; } seen[k] = 1; out.push(t); });
    return { trades: out, dup: dup, added: out.length - old.length };
  }

  var api = { num: num, date: date, mk: mk, parseText: parseText, parseMT4: parseMT4, parseMT5: parseMT5, parseTradovate: parseTradovate, parseAny: parseAny, decode: decode,
    costs: costs, compute: compute, money: money, signed: signed, pct: pct, dec: dec, csv: csv, ics: ics, merge: merge, weekday: weekday, NOSETUP: NOSETUP };
  root.TJ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
