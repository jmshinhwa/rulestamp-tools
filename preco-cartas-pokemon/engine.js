/* preço cartas Pokémon — engine (pure functions, no network). Shared by the page (app.js) and the worker (bundled as one module).
   Prices come from TCGdex (api.tcgdex.net, free, MIT database), which carries Cardmarket (EUR, daily) and TCGplayer (USD) fields.
   BRL = the source price × the BCB PTAX venda of the date shown. Nothing here is advice: it only reads, converts and compares numbers. */
(function (root) {
  'use strict';
  var E = {};

  // "Umbreon ex 161/131" · "umbreon 161" · "Charizard ex #199" · "pikachu" → {name, num}
  E.parseQuery = function (q) {
    var s = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    var num = '';
    var m = s.match(/(?:^|\s)#?([A-Za-z]{0,4}\d{1,4}[a-z]?)(?:\s*\/\s*([A-Za-z]{0,4}\d{1,4}))?\s*$/);
    if (m && /\d/.test(m[1]) && s.replace(m[0], '').trim()) { num = m[1]; s = s.slice(0, m.index).trim(); }
    return { name: s, num: num };
  };
  // card numbers: "060" and "60" are the same card number
  E.sameNum = function (a, b) {
    a = String(a || '').toUpperCase(); b = String(b || '').toUpperCase();
    if (!a || !b) return false;
    var na = a.replace(/^([A-Z]*)0+(?=\d)/, '$1'), nb = b.replace(/^([A-Z]*)0+(?=\d)/, '$1');
    return na === nb;
  };
  E.num = function (x) { var n = Number(x); return isFinite(n) && n > 0 ? n : null; };
  E.round2 = function (x) { return Math.round((x + Number.EPSILON) * 100) / 100; };

  // pt-BR money: 9211.06 → "9.211,06"
  E.fmt = function (x) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    var neg = x < 0, v = E.round2(Math.abs(x)).toFixed(2).split('.');
    var i = v[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + ',' + v[1];
  };
  E.money = function (x, cur) {
    var f = E.fmt(x);
    if (f === '—') return f;
    return cur === 'EUR' ? '€ ' + f : cur === 'USD' ? 'US$ ' + f : 'R$ ' + f;
  };
  E.toBrl = function (x, cur, fx) {
    x = E.num(x);
    if (x === null || !fx) return null;
    var r = cur === 'EUR' ? E.num(fx.eur) : cur === 'USD' ? E.num(fx.usd) : 1;
    return r ? E.round2(x * r) : null;
  };
  // "2026-11-25T22:16:19.604Z" → "25/11/2026"
  E.dateBr = function (iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  };

  // TCGdex card object → our summary (prices only; no images are kept: text-only product)
  var TP_ORDER = ['normal', 'holofoil', 'reverse-holofoil', '1st-edition', '1st-edition-holofoil', 'unlimited', 'unlimited-holofoil'];
  E.summarize = function (c) {
    var p = (c && c.pricing) || {}, cm = p.cardmarket || null, tp = p.tcgplayer || null;
    var set = (c && c.set) || {};
    var out = { id: c.id, name: c.name, num: c.localId, total: (set.cardCount && set.cardCount.official) || null,
      set: { id: set.id || String(c.id || '').replace(/-[^-]+$/, ''), name: set.name || '' }, rarity: c.rarity || '', cm: null, tp: null };
    if (cm && (E.num(cm.trend) || E.num(cm.avg) || E.num(cm.low))) {
      out.cm = { id: cm.idProduct || null, updated: cm.updated || '', trend: E.num(cm.trend), avg: E.num(cm.avg), low: E.num(cm.low),
        avg1: E.num(cm.avg1), avg7: E.num(cm.avg7), avg30: E.num(cm.avg30),
        trendHolo: E.num(cm['trend-holo']), avg30Holo: E.num(cm['avg30-holo']), lowHolo: E.num(cm['low-holo']) };
    }
    if (tp) {
      var vs = Object.keys(tp).filter(function (k) { return tp[k] && typeof tp[k] === 'object' && (E.num(tp[k].marketPrice) || E.num(tp[k].midPrice)); });
      vs.sort(function (a, b) { var ia = TP_ORDER.indexOf(a), ib = TP_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      if (vs.length) out.tp = { updated: tp.updated || '', variants: vs.map(function (k) { var v = tp[k];
        return { v: k, id: v.productId || null, market: E.num(v.marketPrice), low: E.num(v.lowPrice), mid: E.num(v.midPrice) }; }) };
    }
    return out;
  };

  // Two printings in the same set that point at the SAME marketplace listing get the same price (TCGdex FAQ says so).
  // Flag them: a Cardmarket number shared by printings of different rarity is not this printing's price.
  E.flagShared = function (cards) {
    var seenCm = {}, seenTp = {};
    cards.forEach(function (c) {
      if (c.cm && c.cm.id) (seenCm[c.cm.id] = seenCm[c.cm.id] || []).push(c);
      if (c.tp) c.tp.variants.forEach(function (v) { if (v.id) (seenTp[v.id] = seenTp[v.id] || []).push(c); });
    });
    cards.forEach(function (c) {
      c.cmShared = !!(c.cm && c.cm.id && seenCm[c.cm.id].length > 1);
      c.cmSharedWith = c.cmShared ? seenCm[c.cm.id].filter(function (o) { return o !== c; }).map(function (o) { return o.num; }) : [];
      c.tpShared = !!(c.tp && c.tp.variants.some(function (v) { return v.id && seenTp[v.id].length > 1; }));
    });
    return cards;
  };

  // the one reference number per card: Cardmarket trend (EUR) unless that listing is shared, then TCGplayer market (USD)
  E.reference = function (c, fx) {
    if (c.cm && c.cm.trend && !c.cmShared) return { src: 'cardmarket', cur: 'EUR', v: c.cm.trend, brl: E.toBrl(c.cm.trend, 'EUR', fx) };
    var t = c.tp && c.tp.variants.filter(function (v) { return v.market; })[0];
    if (t && !c.tpShared) return { src: 'tcgplayer', cur: 'USD', v: t.market, brl: E.toBrl(t.market, 'USD', fx), variant: t.v };
    if (c.cm && c.cm.trend) return { src: 'cardmarket', cur: 'EUR', v: c.cm.trend, brl: E.toBrl(c.cm.trend, 'EUR', fx), shared: true };
    if (t) return { src: 'tcgplayer', cur: 'USD', v: t.market, brl: E.toBrl(t.market, 'USD', fx), variant: t.v, shared: true };
    return null;
  };
  // today's trend vs the 30-day average (Cardmarket): the gap in R$ someone pricing at the 30-day average leaves out
  E.gap30 = function (c, fx) {
    if (!c.cm || !c.cm.trend || !c.cm.avg30 || c.cmShared) return null;
    var d = E.round2(c.cm.trend - c.cm.avg30);
    return { eur: d, brl: E.toBrl(Math.abs(d), 'EUR', fx) * (d < 0 ? -1 : 1), pct: Math.round((d / c.cm.avg30) * 1000) / 10 };
  };

  // ── watchlist (Pro): {id, name, num, set, qty, paid (R$ per card, optional), line (R$), dir: 'below'|'above'}
  E.cleanItem = function (x) {
    x = x || {};
    var dir = x.dir === 'above' ? 'above' : 'below';
    return { id: String(x.id || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40), name: String(x.name || '').slice(0, 80),
      num: String(x.num || '').slice(0, 12), set: String(x.set || '').slice(0, 80),
      qty: Math.max(1, Math.min(999, Math.floor(Number(x.qty) || 1))),
      paid: E.num(x.paid) ? E.round2(E.num(x.paid)) : null, line: E.num(x.line) ? E.round2(E.num(x.line)) : null, dir: dir };
  };
  // did today's reference (R$) cross the line? prev = the last state we sent about (so one crossing = one e-mail)
  E.crossed = function (item, brlNow, prevState) {
    if (!item.line || brlNow === null || brlNow === undefined) return { state: prevState || 'none', fire: false };
    var hit = item.dir === 'below' ? brlNow <= item.line : brlNow >= item.line;
    var state = hit ? 'hit' : 'clear';
    return { state: state, fire: hit && prevState !== 'hit' };
  };
  // collection value in R$: Σ qty × reference(R$); paid total when the buyer typed it
  E.collection = function (items, refs) {
    var value = 0, paid = 0, priced = 0, unpriced = 0, paidKnown = 0;
    items.forEach(function (it) {
      var r = refs[it.id];
      if (r && r.brl !== null && r.brl !== undefined) { value += r.brl * it.qty; priced++; } else unpriced++;
      if (it.paid) { paid += it.paid * it.qty; paidKnown++; }
    });
    return { value: E.round2(value), paid: E.round2(paid), priced: priced, unpriced: unpriced, paidKnown: paidKnown, cards: items.reduce(function (s, it) { return s + it.qty; }, 0) };
  };

  // CSV (; separated, comma decimals — opens right in Excel/Sheets with pt-BR locale)
  function q(s) { s = String(s === null || s === undefined ? '' : s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  E.toCsv = function (rows, fx) {
    var head = ['id', 'carta', 'numero', 'colecao', 'qtd', 'pago_rs_un', 'cardmarket_tendencia_eur', 'cardmarket_media30_eur', 'tcgplayer_mercado_usd',
      'referencia', 'referencia_rs_un', 'referencia_rs_total', 'linha_rs', 'aviso', 'ptax_eur', 'ptax_usd', 'ptax_data', 'preco_lido_em'];
    var out = [head.join(';')];
    rows.forEach(function (r) {
      var c = r.card || {}, it = r.item || {}, ref = r.ref || null, t = c.tp && c.tp.variants && c.tp.variants[0];
      out.push([it.id || c.id, it.name || c.name, it.num || c.num, it.set || (c.set && c.set.name), it.qty || 1, it.paid ? E.fmt(it.paid) : '',
        c.cm && c.cm.trend ? E.fmt(c.cm.trend) : '', c.cm && c.cm.avg30 ? E.fmt(c.cm.avg30) : '', t && t.market ? E.fmt(t.market) : '',
        ref ? ref.src + (ref.shared ? ' (anuncio compartilhado)' : '') : '', ref && ref.brl ? E.fmt(ref.brl) : '', ref && ref.brl ? E.fmt(ref.brl * (it.qty || 1)) : '',
        it.line ? E.fmt(it.line) : '', it.line ? (it.dir === 'above' ? 'acima de' : 'abaixo de') : '', fx ? String(fx.eur).replace('.', ',') : '', fx ? String(fx.usd).replace('.', ',') : '',
        fx ? fx.date : '', c.cm ? E.dateBr(c.cm.updated) : (c.tp ? E.dateBr(c.tp.updated) : '')].map(q).join(';'));
    });
    return '﻿' + out.join('\r\n') + '\r\n';
  };
  // import: one card per line — "Umbreon ex 161/131;2;850" (name+number ; qty ; paid R$ per card) · also "," or tab separated
  E.parseImport = function (text) {
    var rows = [];
    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      var l = line.replace(/^﻿/, '').trim();
      if (!l || /^(carta|card|nome|name|id)\s*[;,\t]/i.test(l)) return;
      var parts = l.split(/\s*[;\t]\s*/);
      if (parts.length === 1) parts = l.split(/\s*,\s*(?=\d)/);
      var p = E.parseQuery(parts[0]);
      var qty = Math.floor(Number(String(parts[1] || '1').replace(',', '.'))) || 1;
      var paid = E.num(String(parts[2] || '').replace(/[R$\s.]/g, '').replace(',', '.'));
      if (p.name) rows.push({ line: i + 1, name: p.name, num: p.num, qty: Math.max(1, Math.min(999, qty)), paid: paid });
    });
    return rows.slice(0, 500);
  };
  // the history line (one point a day, R$): [{d:'2026-11-26', v:1234.5}] → min, max, first, last
  E.histStats = function (pts) {
    pts = (pts || []).filter(function (p) { return p && isFinite(p.v); });
    if (!pts.length) return null;
    var vs = pts.map(function (p) { return p.v; });
    return { first: pts[0], last: pts[pts.length - 1], min: Math.min.apply(null, vs), max: Math.max.apply(null, vs), n: pts.length };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else root.PCP = E;
})(typeof window !== 'undefined' ? window : globalThis);
