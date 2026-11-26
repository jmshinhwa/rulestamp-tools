/* */
(function (root) {
  'use strict';
  var SLUG = 'precio-cartas-pokemon';
  var DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  var EX = { q: 'Mew ex 152/128', set: '', offer: '60' };

  /* ---------- pure core ---------- */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function normId(s) {
    var t = String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
    return t.replace(/^([a-z]*)0+(\d)/, '$1$2');
  }
  function grp(i) { return String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fmtNum(n) {
    var v = Math.round(Math.abs(Number(n)) * 100) / 100, p = v.toFixed(2).split('.');
    return (Number(n) < 0 ? '-' : '') + grp(p[0]) + ',' + p[1];
  }
  function fmtEUR(n) { return (n || n === 0) && isFinite(n) ? fmtNum(n) + ' €' : '—'; }
  function fmtUSD(n) { return n ? 'US$ ' + fmtNum(n) : '—'; }
  function fmtDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; }
  function parseMoney(s) {
    var t = String(s == null ? '' : s).replace(/[€$\s]|US/g, '');
    if (!t) return NaN;
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    else t = t.replace(/,/g, '');
    return parseFloat(t);
  }

  function buildIndex(idx) {
    var I = { date: idx.date, sets: [], bySet: {}, cards: [], r: idx.r || [] };
    idx.sets.forEach(function (s, i) {
      var o = { id: s[0], name: s[1], date: s[2], official: s[3], serie: s[4], n: norm(s[1]) };
      I.sets.push(o); I.bySet[s[0]] = i;
    });
    idx.c.forEach(function (c) {
      var st = I.sets[c[0]];
      I.cards.push({ si: c[0], set: st.id, lid: String(c[1]), nid: normId(c[1]), name: c[2], n: norm(c[2]), r: I.r[c[3]] || '' });
    });
    return I;
  }
  function keyOf(c) { return c.set + ':' + c.lid; }
  function cardByKey(I, k) {
    if (!I._k) { I._k = {}; I.cards.forEach(function (c) { I._k[keyOf(c)] = c; }); }
    return I._k[k] || null;
  }
  function parseQuery(q) {
    var words = [], nums = [], tot = '';
    norm(q).split(' ').forEach(function (t) {
      if (!t) return;
      var m = /^([a-z]*\d+[a-z]?)\/(\d+)$/.exec(t);
      if (m) { nums.push(normId(m[1])); tot = String(parseInt(m[2], 10)); return; }
      if (/\d/.test(t)) nums.push(normId(t.replace(/\//g, ''))); else words.push(t);
    });
    return { words: words, nums: nums, tot: tot };
  }
  function search(I, q, setId, limit) {
    var P = parseQuery(q), lim = limit || 30;
    if (!P.words.length && !P.nums.length) return [];
    var base = I.cards.filter(function (c) {
      if (setId && c.set !== setId) return false;
      var hay = c.n + ' ' + I.sets[c.si].n;
      for (var i = 0; i < P.words.length; i++) if (hay.indexOf(P.words[i]) < 0) return false;
      return true;
    });
    var out = base;
    if (P.nums.length) {
      var byNum = base.filter(function (c) { return P.nums.indexOf(c.nid) >= 0; });
      if (byNum.length) {
        out = byNum;
        if (P.tot) { var t = byNum.filter(function (c) { return String(I.sets[c.si].official) === P.tot; }); if (t.length) out = t; }
        var rest = P.nums.filter(function (n) { return !byNum.some(function (c) { return c.nid === n; }); });
        if (rest.length) { var sn = out.filter(function (c) { return rest.every(function (n) { return I.sets[c.si].n.indexOf(n) >= 0; }); }); if (sn.length) out = sn; }
      } else {
        var bySetName = base.filter(function (c) { return P.nums.every(function (n) { return I.sets[c.si].n.indexOf(n) >= 0; }); });
        if (bySetName.length || P.words.length) out = bySetName.length ? bySetName : base; else out = [];
      }
    }
    var qn = P.words.join(' ');
    return out.map(function (c, i) {
      var s = 0;
      if (qn && c.n === qn) s += 20; else if (qn && c.n.indexOf(qn) === 0) s += 10;
      return { c: c, s: s, i: i };
    }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).slice(0, lim).map(function (x) { return x.c; });
  }
  function priceRow(a) {
    if (!a) return null;
    return { trend: a[0], avg: a[1], low: a[2], avg1: a[3], avg7: a[4], avg30: a[5], trendH: a[6], avgH: a[7], lowH: a[8],
      avg30H: a[9], usd: a[10], shared: !!(a[11] & 1), exact: !!(a[11] & 2) };
  }
  function mainPrice(p, rev) {
    if (!p) return 0;
    if (rev) return p.trendH || p.avgH || p.avg30H || p.lowH || 0;
    return p.trend || p.avg || p.avg30 || p.low || 0;
  }
  function offerGap(offer, p) {
    var o = Number(offer); if (!p || !(o > 0)) return null;
    var ref = p.avg || p.trend; if (!ref) return null;
    return { offer: o, ref: ref, refName: p.avg ? 'avg' : 'trend', gap: Math.round((o - ref) * 100) / 100 };
  }
  function move7(p) { if (!p || !p.avg7 || !p.avg30) return null; return Math.round((p.avg7 / p.avg30 - 1) * 1000) / 10; }
  function itemValue(it, getP) { var p = getP(it.k); return Math.round(mainPrice(p, it.rev) * (it.qty || 1) * 100) / 100; }
  function totals(items, getP) {
    var t = { n: items.length, qty: 0, value: 0, paid: 0, paidKnown: 0, missing: 0 };
    items.forEach(function (it) {
      var p = getP(it.k), v = mainPrice(p, it.rev) * (it.qty || 1);
      t.qty += it.qty || 1; if (!v) t.missing++; t.value += v;
      if (it.paid > 0) { t.paid += it.paid; t.paidKnown += v; }
    });
    t.value = Math.round(t.value * 100) / 100; t.paid = Math.round(t.paid * 100) / 100;
    t.diff = Math.round((t.paidKnown - t.paid) * 100) / 100;
    return t;
  }
  var ALERT_TXT = { below: 'baja de', above: 'sube de', down: 'baja un', up: 'sube un' };
  function alertCond(a, price) {
    if (!(price > 0)) return false;
    if (a.type === 'below') return price <= a.val;
    if (a.type === 'above') return price >= a.val;
    if (a.type === 'down') return price <= a.base * (1 - a.val / 100);
    if (a.type === 'up') return price >= a.base * (1 + a.val / 100);
    return false;
  }
  function newAlert(k, type, val, price, date, rev) {
    return { id: k + '|' + type + '|' + val + '|' + (rev ? 'r' : 'n'), k: k, type: type, val: Number(val), base: price, rev: !!rev,
      created: date, on: false, last: price, lastDate: '' };
  }
  /* → {alerts, fired:[{a, price, date, first}]} · fires once per crossing; a line already crossed when set fires at once */
  function checkAlerts(alerts, getP, date) {
    var fired = [];
    var next = alerts.map(function (a0) {
      var a = JSON.parse(JSON.stringify(a0)), p = getP(a.k), price = mainPrice(p, a.rev);
      if (!price) return a;
      if (a.lastDate === date) return a;
      var c = alertCond(a, price);
      if (c && !a.on) fired.push({ a: a, price: price, date: date, first: !a.lastDate });
      a.on = c; a.last = price; a.lastDate = date;
      return a;
    });
    return { alerts: next, fired: fired };
  }
  function addHistory(hist, date, value, n) {
    var h = (hist || []).filter(function (x) { return x.d !== date; });
    h.push({ d: date, v: Math.round(value * 100) / 100, n: n });
    h.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    return h.slice(-730);
  }
  function csvCell(v) { var s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCSV(rows) { return '﻿' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n') + '\r\n'; }
  function collectionCSV(items, I, getP, date) {
    var rows = [['carta', 'expansion', 'numero', 'cantidad', 'reverse', 'pagado_eur', 'tendencia_eur', 'media_venta_eur', 'valor_eur', 'fecha_precio']];
    items.forEach(function (it) {
      var c = cardByKey(I, it.k), p = getP(it.k), s = c ? I.sets[c.si] : null;
      rows.push([c ? c.name : it.k, s ? s.name : '', c ? c.lid + (s && s.official ? '/' + s.official : '') : '', it.qty || 1, it.rev ? 'si' : 'no',
        it.paid > 0 ? fmtNum(it.paid) : '', p ? fmtNum(it.rev ? p.trendH : p.trend) : '', p ? fmtNum(it.rev ? p.avgH : p.avg) : '',
        fmtNum(itemValue(it, getP)), date]);
    });
    return toCSV(rows);
  }
  function parseCSV(text) {
    var t = String(text || '').replace(/^﻿/, ''), first = t.split(/\r?\n/)[0] || '';
    var sep = (first.split(';').length >= first.split(',').length) ? ';' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }
  var COLS = { name: ['carta', 'nombre', 'name', 'card'], set: ['expansion', 'set', 'edicion', 'coleccion'], num: ['numero', 'number', 'n', 'no', 'num'],
    qty: ['cantidad', 'qty', 'quantity', 'cant', 'unidades'], paid: ['pagado_eur', 'pagado', 'paid', 'precio_pagado', 'coste'], rev: ['reverse', 'rev'] };
  function importRows(rows, I) {
    if (!rows.length) return { items: [], bad: [] };
    var head = rows[0].map(function (h) { return norm(h).replace(/ /g, '_'); }), at = {};
    Object.keys(COLS).forEach(function (k) { at[k] = head.findIndex(function (h) { return COLS[k].indexOf(h) >= 0; }); });
    var items = [], bad = [];
    rows.slice(1).forEach(function (r, i) {
      var g = function (k) { return at[k] >= 0 ? String(r[at[k]] || '').trim() : ''; };
      var num = g('num').split('/')[0], setTxt = norm(g('set')), nm = norm(g('name')), hit = null;
      var nid = normId(num), cands = I.cards.filter(function (c) { return nid && c.nid === nid; });
      if (setTxt) cands = cands.filter(function (c) { var s = I.sets[c.si]; return s.n === setTxt || norm(s.id) === setTxt || s.n.indexOf(setTxt) >= 0; });
      if (nm && cands.length > 1) { var byN = cands.filter(function (c) { return c.n === nm || c.n.indexOf(nm) >= 0; }); if (byN.length) cands = byN; }
      if (cands.length === 1) hit = cands[0];
      else if (!cands.length && nm && !nid) { var byName = I.cards.filter(function (c) { return c.n === nm; }); if (byName.length === 1) hit = byName[0]; }
      if (!hit) { bad.push(i + 2); return; }
      var qty = parseInt(g('qty'), 10); var paid = parseMoney(g('paid'));
      items.push({ k: keyOf(hit), qty: qty > 0 ? qty : 1, paid: paid > 0 ? paid : 0, rev: /^(s|si|sí|y|yes|1|true)$/i.test(g('rev')) });
    });
    return { items: items, bad: bad };
  }
  function mergeItems(a, b) {
    var out = a.slice();
    b.forEach(function (it) {
      var j = out.findIndex(function (x) { return x.k === it.k && !!x.rev === !!it.rev; });
      if (j >= 0) { out[j] = { k: it.k, rev: it.rev, qty: (out[j].qty || 1) + (it.qty || 1), paid: (out[j].paid || 0) + (it.paid || 0) }; }
      else out.push(it);
    });
    return out;
  }

  var CORE = { SLUG: SLUG, DOORS: DOORS, EX: EX, norm: norm, normId: normId, fmtEUR: fmtEUR, fmtUSD: fmtUSD, fmtNum: fmtNum, fmtDate: fmtDate,
    parseMoney: parseMoney, buildIndex: buildIndex, keyOf: keyOf, cardByKey: cardByKey, parseQuery: parseQuery, search: search,
    priceRow: priceRow, mainPrice: mainPrice, offerGap: offerGap, move7: move7, totals: totals, itemValue: itemValue, alertCond: alertCond,
    newAlert: newAlert, checkAlerts: checkAlerts, addHistory: addHistory, toCSV: toCSV, collectionCSV: collectionCSV, parseCSV: parseCSV,
    importRows: importRows, mergeItems: mergeItems, ALERT_TXT: ALERT_TXT };
  if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
  root.PCP = CORE;
  if (typeof document === 'undefined') return;

  /* ---------- browser ---------- */
  var I = null, shards = {}, cur = null, dataDate = '', freeList = [], unlocked = false;
  var LS = { key: 'pcp_key', col: 'pcp_col', al: 'pcp_alerts', hist: 'pcp_hist', log: 'pcp_log', chk: 'pcp_keychk' };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function getJSON(u, fresh) { return fetch(u, fresh ? { cache: 'no-store' } : {}).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function loadShard(setId) {
    if (shards[setId]) return shards[setId];
    shards[setId] = getJSON('./data/p/' + encodeURIComponent(setId) + '.json').then(function (j) { return j.c || {}; }).catch(function () { return {}; });
    return shards[setId];
  }
  var loaded = {};
  function ensure(keys) {
    var sets = {}; keys.forEach(function (k) { sets[k.split(':')[0]] = 1; });
    return Promise.all(Object.keys(sets).map(function (s) { return loadShard(s).then(function (c) { loaded[s] = c; }); }));
  }
  function getP(k) { var i = k.indexOf(':'), s = k.slice(0, i), l = k.slice(i + 1); return loaded[s] ? priceRow(loaded[s][l]) : null; }
  function setLine(c) { var s = I.sets[c.si]; return s.name + ' · n.º ' + c.lid + (s.official ? '/' + s.official : '') + (c.r ? ' · ' + c.r : ''); }

  function renderResult(c) {
    var out = $('out');
    if (!c) { out.innerHTML = '<p class="none">No encuentro esa carta. Prueba con el nombre y el número que trae abajo, por ejemplo «Pikachu 25».</p>'; return; }
    cur = c;
    var p = getP(keyOf(c)), offer = parseMoney($('offer').value);
    if (!p) {
      out.innerHTML = '<div class="rh"><b class="rname">' + esc(c.name) + '</b><span class="rset">' + esc(setLine(c)) + '</span></div>' +
        '<p class="none">Cardmarket todavía no tiene precio para esta carta (pasa con cartas muy nuevas o que casi no se venden).</p>';
      return;
    }
    var g = offerGap(offer, p), mv = move7(p), rows = [];
    rows.push(['Precio medio de venta', fmtEUR(p.avg)]);
    rows.push(['Desde (oferta más barata)', fmtEUR(p.low)]);
    rows.push(['Media de 7 días', fmtEUR(p.avg7)]);
    rows.push(['Media de 30 días', fmtEUR(p.avg30)]);
    if (p.trendH) rows.push(['Reverse holo, tendencia', fmtEUR(p.trendH)]);
    if (p.usd) rows.push(['TCGplayer (EE. UU.)', fmtUSD(p.usd)]);
    if (g) rows.push(['Tu oferta de ' + fmtEUR(g.offer), (g.gap < 0 ? fmtEUR(-g.gap) + ' menos' : fmtEUR(g.gap) + ' más') + ' que la media de venta']);
    out.innerHTML = '<div class="rh"><b class="rname">' + esc(c.name) + '</b><span class="rset">' + esc(setLine(c)) + '</span></div>' +
      '<div class="big"><span>Tendencia en Cardmarket</span> <b>' + fmtEUR(p.trend || p.avg) + '</b></div>' +
      '<div class="grid sum">' + rows.map(function (r) { return '<div class="tile"><span>' + esc(r[0]) + '</span> <b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>' +
      (mv !== null ? '<p class="mv">Media de 7 días frente a la de 30: ' + (mv > 0 ? '+' : '') + fmtNum(mv) + ' %</p>' : '') +
      (p.shared ? '<p class="warn">Ojo: este precio coincide con otra versión de la misma carta en la misma expansión. Compruébalo en Cardmarket antes de vender.</p>' : '') +
      '<p class="date">Guía de precios de Cardmarket del ' + fmtDate(dataDate) + ' · carta suelta sin graduar</p>';
    $('acts').hidden = false;
  }
  function renderMatches(list) {
    var ul = $('matches');
    if (list.length < 2) { ul.innerHTML = ''; return; }
    ul.innerHTML = '<li class="mh">' + list.length + (list.length >= 30 ? '+' : '') + ' coincidencias: toca la tuya</li>' + list.map(function (c, i) {
      var p = getP(keyOf(c));
      return '<li><button type="button" data-i="' + i + '"><b>' + esc(c.name) + '</b> <span>' + esc(setLine(c)) + '</span> <em>' + (p ? fmtEUR(mainPrice(p)) : 'sin precio') + '</em></button></li>';
    }).join('');
    ul.onclick = function (e) { var b = e.target.closest('button[data-i]'); if (b) { renderResult(list[+b.getAttribute('data-i')]); $('out').scrollIntoView({ block: 'nearest' }); } };
  }
  var tmr = null;
  function run() {
    if (!I) return;
    var list = search(I, $('q').value, $('set').value, 30);
    ensure(list.map(keyOf)).then(function () { renderResult(list[0] || null); renderMatches(list); });
  }
  function later() { clearTimeout(tmr); tmr = setTimeout(run, 180); }

  function renderFree() {
    var box = $('free'), keys = freeList.map(function (x) { return x.k; });
    if (!freeList.length) { box.innerHTML = '<p class="muted">Añade cartas con «Añadir a mi lista de hoy» para sumar lo que vale tu montón.</p>'; return; }
    ensure(keys).then(function () {
      var t = totals(freeList, getP);
      box.innerHTML = '<table><thead><tr><th>Carta</th><th>Cant.</th><th>Valor</th><th></th></tr></thead><tbody>' + freeList.map(function (it, i) {
        var c = cardByKey(I, it.k);
        return '<tr><td>' + esc(c ? c.name : it.k) + '<small>' + esc(c ? setLine(c) : '') + '</small></td><td><input type="number" min="1" value="' + (it.qty || 1) + '" data-q="' + i + '" aria-label="Cantidad"></td><td>' + fmtEUR(itemValue(it, getP)) + '</td><td><button type="button" class="x" data-x="' + i + '" aria-label="Quitar">×</button></td></tr>';
      }).join('') + '</tbody></table><p class="tot"><span>Total de tu lista (tendencia)</span> <b>' + fmtEUR(t.value) + '</b></p>' +
        '<p class="muted">Esta lista se borra al cerrar la página.</p>';
    });
  }

  /* ---------- paid ---------- */
  function col() { return lsGet(LS.col, []); }
  function renderPro(note) {
    var box = $('pro-app');
    if (!unlocked) { $('pro-lock').hidden = false; box.hidden = true; if (note) { $('pro-why').textContent = note; } return; }
    $('pro-lock').hidden = true; box.hidden = false;
    var items = col(), alerts = lsGet(LS.al, []), keys = items.map(function (x) { return x.k; }).concat(alerts.map(function (a) { return a.k; }));
    ensure(keys).then(function () {
      var t = totals(items, getP);
      if (items.length && dataDate) { lsSet(LS.hist, addHistory(lsGet(LS.hist, []), dataDate, t.value, t.qty)); }
      var r = checkAlerts(alerts, getP, dataDate); lsSet(LS.al, r.alerts);
      if (r.fired.length) {
        var log = lsGet(LS.log, []);
        r.fired.forEach(function (f) { log.unshift({ d: f.date, k: f.a.k, t: f.a.type, v: f.a.val, p: f.price, first: f.first }); notify(f); });
        lsSet(LS.log, log.slice(0, 200));
      }
      $('col').innerHTML = items.length ? '<table><thead><tr><th>Carta</th><th>Cant.</th><th>Pagaste</th><th>Vale hoy</th><th></th></tr></thead><tbody>' + items.map(function (it, i) {
        var c = cardByKey(I, it.k);
        return '<tr><td>' + esc(c ? c.name : it.k) + (it.rev ? ' (reverse)' : '') + '<small>' + esc(c ? setLine(c) : '') + '</small></td><td><input type="number" min="1" value="' + (it.qty || 1) + '" data-cq="' + i + '" aria-label="Cantidad"></td><td><input type="text" inputmode="decimal" value="' + (it.paid > 0 ? fmtNum(it.paid) : '') + '" data-cp="' + i + '" placeholder="€" aria-label="Lo que pagaste"></td><td>' + fmtEUR(itemValue(it, getP)) + '</td><td><button type="button" class="x" data-cx="' + i + '" aria-label="Quitar">×</button></td></tr>';
      }).join('') + '</tbody></table>' +
        '<div class="grid sum"><div class="tile"><span>Cartas</span> <b>' + t.qty + '</b></div><div class="tile"><span>Lo que pagaste (donde lo anotaste)</span> <b>' + fmtEUR(t.paid) + '</b></div>' +
        '<div class="tile"><span>Diferencia con lo pagado</span> <b>' + (t.paid ? fmtEUR(t.diff) : '—') + '</b></div><div class="tile"><span>Tu colección vale hoy</span> <b>' + fmtEUR(t.value) + '</b></div></div>'
        : '<p class="muted">Tu colección está vacía. Busca una carta arriba y pulsa «Guardar en mi colección», o importa un CSV.</p>';
      drawHist(lsGet(LS.hist, []));
      $('alerts').innerHTML = r.alerts.length ? '<ul class="al">' + r.alerts.map(function (a, i) {
        var c = cardByKey(I, a.k), p = getP(a.k), now = mainPrice(p, a.rev);
        return '<li class="' + (a.on ? 'on' : '') + '"><b>' + esc(c ? c.name : a.k) + '</b> <span>' + esc(c ? setLine(c) : '') + '</span> · avísame si ' + ALERT_TXT[a.type] + ' ' + (a.type === 'up' || a.type === 'down' ? fmtNum(a.val) + ' % (desde ' + fmtEUR(a.base) + ')' : fmtEUR(a.val)) + ' · ahora ' + fmtEUR(now) + (a.on ? ' · <strong>se cumple</strong>' : '') + ' <button type="button" class="x" data-ax="' + i + '" aria-label="Quitar aviso">×</button></li>';
      }).join('') + '</ul>' : '<p class="muted">Sin avisos todavía. Elige una carta arriba y pon tu línea.</p>';
      var log = lsGet(LS.log, []);
      $('log').innerHTML = log.length ? '<ul class="lg">' + log.slice(0, 20).map(function (l) {
        var c = cardByKey(I, l.k);
        return '<li>' + fmtDate(l.d) + ' · ' + esc(c ? c.name : l.k) + ' ' + ALERT_TXT[l.t] + ' ' + (l.t === 'up' || l.t === 'down' ? fmtNum(l.v) + ' %' : fmtEUR(l.v)) + ': ' + fmtEUR(l.p) + (l.first ? ' (ya se cumplía al crear el aviso)' : '') + '</li>';
      }).join('') + '</ul>' : '';
    });
  }
  function drawHist(h) {
    var el = $('hist');
    if (!h.length) { el.innerHTML = ''; return; }
    if (h.length < 2) { el.innerHTML = '<p class="muted">Primer punto de tu gráfica: ' + fmtDate(h[0].d) + ', ' + fmtEUR(h[0].v) + '. Cada nueva tabla de precios añade un punto.</p>'; return; }
    var W = 520, H = 140, mx = Math.max.apply(null, h.map(function (x) { return x.v; })) || 1, mn = Math.min.apply(null, h.map(function (x) { return x.v; }));
    var span = (mx - mn) || mx, pts = h.map(function (x, i) { return (10 + i * (W - 20) / (h.length - 1)).toFixed(1) + ',' + (H - 20 - (x.v - mn) / span * (H - 40)).toFixed(1); }).join(' ');
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Valor de tu colección por fecha"><polyline fill="none" stroke="#1f6feb" stroke-width="2.5" points="' + pts + '"/>' +
      '<text x="10" y="14" font-size="12">' + fmtEUR(h[0].v) + ' · ' + fmtDate(h[0].d) + '</text><text x="' + (W - 10) + '" y="14" font-size="12" text-anchor="end">' + fmtEUR(h[h.length - 1].v) + ' · ' + fmtDate(h[h.length - 1].d) + '</text></svg>';
  }
  function notify(f) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      var c = cardByKey(I, f.a.k);
      new Notification('Aviso de precio: ' + (c ? c.name : ''), { body: (c ? c.name : '') + ' ' + ALERT_TXT[f.a.type] + ' tu línea: ' + fmtEUR(f.price) + ' (' + fmtDate(f.date) + ')' });
    } catch (e) { /* no notifications */ }
  }
  function download(name, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function goPro(what) { renderPro(what); $('pro').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  /* → cb('ok' | 'no' | 'err'): 'no' only when every door answered {ok:false} (a cancelled key locks again); a network error keeps the stored key */
  function checkKey(k, cb) {
    var i = 0, err = false;
    (function next() {
      if (i >= DOORS.length) { cb(err ? 'err' : 'no'); return; }
      var d = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(d)).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) cb('ok'); else next(); }).catch(function () { err = true; next(); });
    })();
  }
  function tryKey(k, quiet) {
    k = String(k || '').trim(); if (!k) return;
    checkKey(k, function (st) {
      if (st === 'ok') { unlocked = true; lsSet(LS.key, k); lsSet(LS.chk, Date.now()); if (!quiet) $('keymsg').textContent = 'Clave válida: tu versión completa está abierta.'; renderPro(); }
      else if (st === 'no' && quiet) { unlocked = false; try { localStorage.removeItem(LS.key); } catch (e) { /* ignore */ } renderPro(); }
      else if (!quiet) $('keymsg').textContent = st === 'err' ? 'No pude comprobar la clave ahora mismo. Inténtalo de nuevo en un momento.' : 'Esa clave no abre esta herramienta. Copia la clave tal cual llega en tu recibo de Whop.';
    });
  }
  function refreshData() {
    return getJSON('./data/meta.json', true).then(function (m) {
      if (m && m.date && m.date !== dataDate) { shards = {}; loaded = {}; return boot(true); }
    }).catch(function () { /* offline: keep what we have */ });
  }
  function boot(again) {
    return getJSON('./data/idx.json', !!again).then(function (idx) {
      I = buildIndex(idx); dataDate = idx.date;
      $('dd').textContent = fmtDate(dataDate);
      if (!again) {
        var sel = $('set');
        sel.innerHTML = '<option value="">Todas las expansiones</option>' + I.sets.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + (s.date ? ' (' + s.date.slice(0, 4) + ')' : '') + '</option>'; }).join('');
      }
      run(); renderFree(); renderPro();
    }).catch(function () { $('out').innerHTML = '<p class="none">No se pudo cargar la tabla de precios. Recarga la página.</p>'; });
  }
  document.addEventListener('DOMContentLoaded', function () {
    ['q', 'offer'].forEach(function (id) { $(id).addEventListener('input', later); });
    $('set').addEventListener('change', run);
    $('f').addEventListener('submit', function (e) { e.preventDefault(); run(); });
    $('add-free').onclick = function () { if (cur) { freeList = mergeItems(freeList, [{ k: keyOf(cur), qty: 1, paid: 0, rev: false }]); renderFree(); } };
    $('free').addEventListener('input', function (e) { var i = e.target.getAttribute('data-q'); if (i !== null) { freeList[+i].qty = Math.max(1, parseInt(e.target.value, 10) || 1); clearTimeout(tmr); tmr = setTimeout(renderFree, 400); } });
    $('free').addEventListener('click', function (e) { var i = e.target.getAttribute('data-x'); if (i !== null) { freeList.splice(+i, 1); renderFree(); } });
    $('add-col').onclick = function () {
      if (!unlocked) { goPro('Guardar tu colección, con su valor en cada tabla de precios, es parte de la versión completa.'); return; }
      if (cur) { lsSet(LS.col, mergeItems(col(), [{ k: keyOf(cur), qty: 1, paid: 0, rev: $('rev').checked }])); renderPro(); $('pro').scrollIntoView({ block: 'start' }); }
    };
    $('add-al').onclick = function () {
      if (!unlocked) { goPro('Los avisos de precio con tu propia línea son parte de la versión completa.'); return; }
      if (!cur) return;
      var type = $('at').value, val = parseMoney($('av').value), p = getP(keyOf(cur)), price = mainPrice(p, $('rev').checked);
      if (!(val > 0) || !price) { $('almsg').textContent = 'Escribe tu línea (en € o en %) para esta carta.'; return; }
      var a = newAlert(keyOf(cur), type, val, price, dataDate, $('rev').checked), list = lsGet(LS.al, []).filter(function (x) { return x.id !== a.id; });
      list.push(a); lsSet(LS.al, list); $('almsg').textContent = 'Aviso guardado.'; renderPro(); $('pro').scrollIntoView({ block: 'start' });
    };
    $('col').addEventListener('change', function (e) {
      var items = col(), q = e.target.getAttribute('data-cq'), p = e.target.getAttribute('data-cp');
      if (q !== null) items[+q].qty = Math.max(1, parseInt(e.target.value, 10) || 1);
      if (p !== null) { var v = parseMoney(e.target.value); items[+p].paid = v > 0 ? v : 0; }
      lsSet(LS.col, items); renderPro();
    });
    $('col').addEventListener('click', function (e) { var i = e.target.getAttribute('data-cx'); if (i !== null) { var items = col(); items.splice(+i, 1); lsSet(LS.col, items); renderPro(); } });
    $('alerts').addEventListener('click', function (e) { var i = e.target.getAttribute('data-ax'); if (i !== null) { var l = lsGet(LS.al, []); l.splice(+i, 1); lsSet(LS.al, l); renderPro(); } });
    $('csv-out').onclick = function () { if (unlocked) download('mi-coleccion-pokemon-' + dataDate + '.csv', collectionCSV(col(), I, getP, dataDate)); else goPro('Descargar tu colección en CSV es parte de la versión completa.'); };
    $('csv-in').onchange = function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      if (!unlocked) { goPro('Importar tu colección desde un CSV es parte de la versión completa.'); e.target.value = ''; return; }
      f.text().then(function (txt) {
        var r = importRows(parseCSV(txt), I); lsSet(LS.col, mergeItems(col(), r.items));
        $('csvmsg').textContent = r.items.length + ' cartas importadas' + (r.bad.length ? '; no encontré las filas ' + r.bad.slice(0, 12).join(', ') + (r.bad.length > 12 ? '…' : '') + ' (revisa expansión y número)' : '') + '.';
        renderPro(); e.target.value = '';
      });
    };
    $('notif').onclick = function () { if ('Notification' in window) Notification.requestPermission().then(function (p) { $('almsg').textContent = p === 'granted' ? 'Notificaciones activadas en este navegador.' : 'El navegador no dio permiso para notificaciones.'; }); };
    $('keyform').addEventListener('submit', function (e) { e.preventDefault(); tryKey($('key').value); });
    var h = /[#&]k=([^&]+)/.exec(location.hash || '');
    var stored = lsGet(LS.key, '');
    if (h) { tryKey(decodeURIComponent(h[1])); }
    else if (stored) { unlocked = true; if (Date.now() - lsGet(LS.chk, 0) > 864e5) tryKey(stored, true); }
    $('q').value = EX.q; $('offer').value = EX.offer;
    boot(false);
    setInterval(refreshData, 6 * 3600 * 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshData(); });
  });
})(typeof window !== 'undefined' ? window : globalThis);
