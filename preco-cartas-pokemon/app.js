/* */
(function () {
  'use strict';
  var E = window.PCP, W = 'https://preco-cartas-pokemon.pages.dev', SLUG = 'preco-cartas-pokemon', BUY = '' + SLUG;
  var DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  // the example on the first screen: a dated read (2026-11-26) of "Mega Rayquaza ex", so the page answers before any click
  var SAMPLE = {"q":"Mega Rayquaza ex","read":"2026-11-26","fx":{"usd":5.8825,"eur":6.4413,"date":"25/11/2026","date_eur":"25/11/2026","src":"BCB PTAX venda (SGS 1 e 21619)"},"cards":[{"id":"me06-084","name":"Mega Rayquaza ex","num":"084","total":103,"set":{"id":"me06","name":"Reinado Delta"},"rarity":"Rara Dupla","cm":{"id":918912,"updated":"2026-11-25T22:16:19.632Z","trend":2.48,"avg":3.92,"low":1.6,"avg1":3.44,"avg7":3.15,"avg30":3.75,"trendHolo":null,"avg30Holo":null,"lowHolo":null},"tp":{"updated":"2026-11-25T22:16:36.509Z","variants":[{"v":"holofoil","id":726543,"market":4.52,"low":3,"mid":5.52}]},"cmShared":true,"cmSharedWith":["138","141"],"tpShared":false},{"id":"me06-138","name":"Mega Rayquaza ex","num":"138","total":103,"set":{"id":"me06","name":"Reinado Delta"},"rarity":"Ilustração Rara Especial","cm":{"id":918912,"updated":"2026-11-25T22:16:19.632Z","trend":2.48,"avg":3.92,"low":1.6,"avg1":3.44,"avg7":3.15,"avg30":3.75,"trendHolo":null,"avg30Holo":null,"lowHolo":null},"tp":{"updated":"2026-11-25T22:16:36.509Z","variants":[{"v":"holofoil","id":728061,"market":271.24,"low":249,"mid":300}]},"cmShared":true,"cmSharedWith":["084","141"],"tpShared":false},{"id":"me06-141","name":"Mega Rayquaza ex","num":"141","total":103,"set":{"id":"me06","name":"Reinado Delta"},"rarity":"Mega Hiper Raro","cm":{"id":918912,"updated":"2026-11-25T22:16:19.627Z","trend":2.48,"avg":3.92,"low":1.6,"avg1":3.44,"avg7":3.15,"avg30":3.75,"trendHolo":null,"avg30Holo":null,"lowHolo":null},"tp":{"updated":"2026-11-25T22:16:36.509Z","variants":[{"v":"holofoil","id":728062,"market":203.43,"low":198.95,"mid":221.43}]},"cmShared":true,"cmSharedWith":["084","138"],"tpShared":false}]};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var state = { last: null, fx: SAMPLE.fx, session: [], pro: false, key: '', watch: null, cards: {} };

  function srcLabel(r) { return r.src === 'cardmarket' ? 'Cardmarket tendência ' + E.money(r.v, 'EUR') : 'TCGplayer mercado ' + E.money(r.v, 'USD'); }
  function cardHtml(c, fx, i) {
    var r = E.reference(c, fx), g = E.gap30(c, fx), t = c.tp && c.tp.variants || [];
    var title = esc(c.name) + ' ' + esc(c.num) + (c.total ? '/' + esc(c.total) : '');
    var h = '<article class="card" data-i="' + i + '"><div class="ctop"><div><b class="cname">' + title + '</b><span class="cset">' + esc(c.set && c.set.name) + (c.rarity ? ' · ' + esc(c.rarity) : '') + '</span></div>';
    h += '<div class="cref">' + (r ? '<span class="big">' + E.money(r.brl, 'BRL') + '</span><small>' + esc(srcLabel(r)) + '</small>' : '<span class="big">sem preço</span><small>nenhum mercado listou esta carta</small>') + '</div></div>';
    if (c.cmShared) h += '<p class="warn">⚠ anúncio compartilhado: na base de preços, o Cardmarket desta carta aponta para o mesmo anúncio das cartas ' + esc(c.cmSharedWith.join(', ')) + ' desta coleção (' + E.money(c.cm.trend, 'EUR') + ' para todas). Referência = TCGplayer.</p>';
    h += '<table class="pr"><tbody>';
    if (c.cm) {
      h += '<tr><th>Cardmarket tendência</th><td>' + E.money(c.cm.trend, 'EUR') + '</td><td>' + E.money(E.toBrl(c.cm.trend, 'EUR', fx), 'BRL') + '</td></tr>';
      h += '<tr><th>Cardmarket média 30 dias</th><td>' + E.money(c.cm.avg30, 'EUR') + '</td><td>' + E.money(E.toBrl(c.cm.avg30, 'EUR', fx), 'BRL') + '</td></tr>';
      h += '<tr><th>Cardmarket média 7 dias · menor</th><td>' + E.money(c.cm.avg7, 'EUR') + ' · ' + E.money(c.cm.low, 'EUR') + '</td><td>' + E.money(E.toBrl(c.cm.avg7, 'EUR', fx), 'BRL') + '</td></tr>';
      if (c.cm.trendHolo) h += '<tr><th>Cardmarket reverse holo tendência</th><td>' + E.money(c.cm.trendHolo, 'EUR') + '</td><td>' + E.money(E.toBrl(c.cm.trendHolo, 'EUR', fx), 'BRL') + '</td></tr>';
    }
    t.forEach(function (v) { h += '<tr><th>TCGplayer mercado (' + esc(v.v) + ')</th><td>' + E.money(v.market || v.mid, 'USD') + '</td><td>' + E.money(E.toBrl(v.market || v.mid, 'USD', fx), 'BRL') + '</td></tr>'; });
    h += '</tbody></table>';
    if (g && Math.abs(g.eur) >= 0.5) h += '<p class="gap">Tendência ' + (g.eur > 0 ? 'acima' : 'abaixo') + ' da média de 30 dias em ' + E.money(Math.abs(g.eur), 'EUR') + ' (' + E.money(Math.abs(g.brl), 'BRL') + ', ' + String(Math.abs(g.pct)).replace('.', ',') + '%). Quem anuncia pela média de 30 dias fica ' + (g.eur > 0 ? E.money(Math.abs(g.brl), 'BRL') + ' abaixo' : E.money(Math.abs(g.brl), 'BRL') + ' acima') + ' da tendência de hoje.</p>';
    var dt = E.dateBr((c.cm && c.cm.updated) || (c.tp && c.tp.updated));
    h += '<p class="meta">Preço lido em ' + esc(dt || '—') + ' · <a href="https://www.cardmarket.com/pt/Pokemon/Products/Search?searchString=' + encodeURIComponent(c.name) + '" rel="noopener nofollow" target="_blank">Cardmarket</a>' + (t[0] && t[0].id ? ' · <a href="https://www.tcgplayer.com/product/' + encodeURIComponent(t[0].id) + '" rel="noopener nofollow" target="_blank">TCGplayer</a>' : '') + ' <button type="button" class="add" data-i="' + i + '">+ lista</button></p></article>';
    return h;
  }
  function render(res, isSample) {
    var fx = res.fx && !res.fx._err ? res.fx : state.fx; state.fx = fx; state.last = res;
    var cards = res.cards || [];
    var first = cards.filter(function (c) { return E.reference(c, fx); }).sort(function (a, b) { return (E.reference(b, fx).brl || 0) - (E.reference(a, fx).brl || 0); })[0];
    var h = '<div class="sum">';
    if (first) { var r = E.reference(first, fx); h += '<p class="ans"><span>' + esc(first.name) + ' ' + esc(first.num) + ' · ' + esc(first.set.name) + '</span><b>' + E.money(r.brl, 'BRL') + '</b><small>' + esc(srcLabel(r)) + (first.cmShared ? ' · na base de preços o Cardmarket dá ' + E.money(first.cm.trend, 'EUR') + ' (' + E.money(E.toBrl(first.cm.trend, 'EUR', fx), 'BRL') + '), anúncio compartilhado ⚠' : '') + '</small></p>'; }
    h += '<p class="fx">' + (isSample ? 'Exemplo lido em 26/11/2026 · ' : '') + esc(cards.length) + ' carta(s) para «' + esc(res.q || (res.query && (res.query.name + (res.query.num ? ' ' + res.query.num : ''))) || '') + '»' + (res.more ? ' (mais ' + esc(res.more) + ' abaixo)' : '') + ' · PTAX venda ' + esc(fx.date) + ': € 1 = R$ ' + String(fx.eur).replace('.', ',') + ' · US$ 1 = R$ ' + String(fx.usd).replace('.', ',') + '</p></div>';
    cards.forEach(function (c, i) { h += cardHtml(c, fx, i); });
    if (!cards.length) h += '<p class="msg">Nenhuma carta com esse nome' + (res.query && res.query.num ? ' e número' : '') + '. Confira a grafia como está impressa (ex.: «Pesquisa de Professores», «Charizard ex 199»).</p>';
    if (res.rest && res.rest.length) h += '<p class="rest">Outras versões: ' + res.rest.map(function (o) { return '<button type="button" class="other" data-id="' + esc(o.id) + '">' + esc(o.name + ' ' + o.num + ' · ' + o.set) + '</button>'; }).join(' ') + '</p>';
    $('out').innerHTML = h;
  }
  function msg(t) { $('msg').textContent = t || ''; }
  function api(path, opt) {
    opt = opt || {}; opt.headers = opt.headers || {};
    if (state.key) opt.headers['x-key'] = state.key;
    return fetch(W + path, opt).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http_' + r.status }; }); });
  }
  function lookup() {
    var q = document.querySelector('[data-k="q"]').value.trim();
    if (q.length < 2) { msg('Digite pelo menos 2 letras do nome da carta.'); return; }
    msg('Lendo o preço de hoje…');
    api('/api/search?lang=pt&q=' + encodeURIComponent(q)).then(function (j) {
      if (!j.ok) { msg(j.error === 'slow_down' ? 'Muitas consultas em um minuto. Espere alguns segundos.' : j.error === 'short' ? 'Digite pelo menos 2 letras.' : 'A fonte de preços não respondeu agora (' + j.error + '). Tente de novo em instantes.'); return; }
      msg(''); $('exampleNote').textContent = 'Preços de hoje para «' + q + '». Digite outra carta quando quiser.'; render(j, false);
    }).catch(function () { msg('Sem conexão com o leitor de preços. Tente de novo.'); });
  }
  function one(id) {
    msg('Lendo…');
    api('/api/card?lang=pt&id=' + encodeURIComponent(id)).then(function (j) {
      if (!j.ok) { msg('Não deu para ler esta carta agora.'); return; }
      msg(''); render({ cards: [j.card], fx: j.fx, q: j.card.name + ' ' + j.card.num }, false);
    });
  }
  // ── free list (this tab only)
  function addSession(c) {
    var k = c.id; if (state.session.some(function (x) { return x.card.id === k; })) { state.session.forEach(function (x) { if (x.card.id === k) x.qty++; }); }
    else state.session.push({ card: c, qty: 1, paid: null, line: null, dir: 'below' });
    state.cards[c.id] = c; drawSession();
  }
  function refs() { var o = {}; state.session.forEach(function (x) { o[x.card.id] = E.reference(x.card, state.fx); }); return o; }
  function items() { return state.session.map(function (x) { return E.cleanItem({ id: x.card.id, name: x.card.name, num: x.card.num, set: x.card.set.name, qty: x.qty, paid: x.paid, line: x.line, dir: x.dir }); }); }
  function drawSession() {
    if (!state.session.length) { $('sessionOut').innerHTML = '<p class="hint">Nenhuma carta ainda.</p>'; return; }
    var R = refs(), col = E.collection(items(), R);
    var h = '<div class="scroll"><table class="sl"><thead><tr><th>Carta</th><th>Qtd</th><th>Ref. un.</th><th>Pagou un. (R$)</th><th>Linha (R$)</th><th>Avisar</th><th></th></tr></thead><tbody>';
    state.session.forEach(function (x, i) {
      var r = R[x.card.id], st = state.watch && state.watch.states ? state.watch.states[x.card.id + ':' + (x.line || '') + ':' + x.dir] : '';
      h += '<tr><td>' + esc(x.card.name + ' ' + x.card.num) + '<small>' + esc(x.card.set.name) + '</small></td><td><input type="number" min="1" max="999" value="' + x.qty + '" data-f="qty" data-i="' + i + '"></td><td>' + (r ? E.money(r.brl, 'BRL') : '—') + '</td>' +
        '<td><input inputmode="decimal" value="' + (x.paid ? E.fmt(x.paid) : '') + '" data-f="paid" data-i="' + i + '" placeholder="opcional"></td><td><input inputmode="decimal" value="' + (x.line ? E.fmt(x.line) : '') + '" data-f="line" data-i="' + i + '" placeholder="ex.: 1.200,00"></td>' +
        '<td><select data-f="dir" data-i="' + i + '"><option value="below"' + (x.dir === 'below' ? ' selected' : '') + '>se cair abaixo</option><option value="above"' + (x.dir === 'above' ? ' selected' : '') + '>se subir acima</option></select>' + (st === 'hit' ? ' <b class="hit">cruzou</b>' : '') + '</td><td><button type="button" class="rm" data-i="' + i + '">×</button></td></tr>';
    });
    h += '</tbody></table></div><p class="tot">Total: <b>' + E.money(col.value, 'BRL') + '</b> em ' + col.cards + ' carta(s)' + (col.unpriced ? ' · ' + col.unpriced + ' sem preço' : '') + (col.paidKnown ? ' · você pagou ' + E.money(col.paid, 'BRL') + ' nas que marcou' : '') + ' · PTAX ' + esc(state.fx.date) + '</p>';
    $('sessionOut').innerHTML = h;
  }
  function brNum(s) { s = String(s || '').replace(/[R$\s]/g, ''); if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); var n = Number(s); return isFinite(n) && n > 0 ? n : null; }
  // ── Pro
  function proMsg(t, html) { if (html) $('proMsg').innerHTML = t; else $('proMsg').textContent = t || ''; }
  function needPro(what) { proMsg(' — Salvar e continuar: https://getreadystack.com/pt/apps/preco-cartas-pokemon/' + esc(what) + '. <a href="' + BUY + '', true); $('pro').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function checkKey(k, i) {
    i = i || 0; if (i >= DOORS.length) return Promise.resolve(false);
    return fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(DOORS[i])).then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? true : checkKey(k, i + 1); }).catch(function () { return checkKey(k, i + 1); });
  }
  function unlock(k, quiet) {
    return checkKey(k).then(function (ok) {
      if (!ok) { if (!quiet) $('keyMsg').textContent = ' — Salvar e continuar: https://getreadystack.com/pt/apps/preco-cartas-pokemon/'; return false; }
      state.pro = true; state.key = k; try { localStorage.setItem('pcp_key', k); } catch (e) {}
      $('keyMsg').textContent = ' — Salvar e continuar: https://getreadystack.com/pt/apps/preco-cartas-pokemon/'; document.body.classList.add('is-pro'); loadWatch(); return true;
    });
  }
  function loadWatch() {
    api('/api/watch').then(function (j) {
      if (!j.ok) return; state.watch = j; if (!$('email').value.trim()) $('email').value = j.email || '';
      if (j.items && j.items.length && !state.session.length) {
        Promise.all(j.items.map(function (it) { return api('/api/card?lang=pt&id=' + encodeURIComponent(it.id)).then(function (r) { return r.ok ? { it: it, c: r.card, fx: r.fx } : null; }); })).then(function (rows) {
          rows.forEach(function (x) { if (!x) return; if (x.fx && !x.fx._err) state.fx = x.fx; state.session.push({ card: x.c, qty: x.it.qty, paid: x.it.paid, line: x.it.line, dir: x.it.dir }); });
          drawSession(); watchNote();
        });
      } else watchNote();
    });
  }
  function watchNote() {
    var w = state.watch || {};
    $('watchOut').innerHTML = '<p class="hint">' + (w.items ? w.items.length : 0) + ' carta(s) salvas · ' + (w.email ? (w.confirmed ? 'avisos para ' + esc(w.email) : 'e-mail ' + esc(w.email) + ' esperando o clique de confirmação') : 'sem e-mail de aviso') + (w.last ? ' · última conferência ' + esc(E.dateBr(w.last)) : '') + '</p>';
  }
  function save() {
    var em = $('email').value.trim();
    api('/api/watch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: items(), email: em, lang: 'pt' }) }).then(function (j) {
      if (!j.ok) { proMsg(j.error === 'bad_email' ? 'Esse e-mail não parece válido.' : j.error === 'mail_day_limit' ? 'Já mandamos 3 confirmações hoje. Tente amanhã.' : 'Não salvou (' + j.error + ').'); return; }
      state.watch = Object.assign(state.watch || {}, j); watchNote();
      proMsg('Lista salva (' + j.items.length + ' carta(s)).' + (j.mail === 'confirm_sent' ? ' Mandamos um e-mail de confirmação: clique no link para ativar os avisos.' : ''));
    });
  }
  function checkNow() {
    proMsg('Conferindo a lista…');
    api('/api/check').then(function (j) {
      if (!j.ok) { proMsg(j.error === 'once_an_hour' ? 'Já conferimos nesta hora. A conferência automática roda todo dia.' : 'Não deu para conferir agora.'); return; }
      state.watch = Object.assign(state.watch || {}, { hist: j.hist, states: j.states, last: new Date().toISOString().slice(0, 10) });
      drawSession(); watchNote();
      proMsg('Conferido: valor ' + E.money(j.value, 'BRL') + ' · ' + j.fired + ' carta(s) cruzaram a linha agora' + (j.sent && j.sent.ok ? ' · e-mail enviado' : '') + (j.held ? ' · ' + j.held + ' vão no e-mail de amanhã (um por dia)' : '') + '.');
    });
  }
  function chart(pts) {
    var s = E.histStats(pts); if (!s) return '<p class="hint">Ainda sem pontos. O primeiro aparece depois da primeira conferência.</p>';
    var w = 520, h = 160, n = pts.length, lo = s.min * 0.98, hi = s.max * 1.02 || 1, sx = function (i) { return n === 1 ? w / 2 : 30 + i * (w - 40) / (n - 1); }, sy = function (v) { return hi === lo ? h / 2 : h - 20 - (v - lo) * (h - 40) / (hi - lo); };
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.v).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="ch" role="img" aria-label="valor da coleção por dia"><path d="' + d + '" fill="none" stroke="#2563eb" stroke-width="2.5"/>' + pts.map(function (p, i) { return '<circle cx="' + sx(i).toFixed(1) + '" cy="' + sy(p.v).toFixed(1) + '" r="3" fill="#2563eb"/>'; }).join('') + '</svg>' +
      '<p class="hint">' + esc(E.dateBr(s.first.d)) + ': ' + E.money(s.first.v, 'BRL') + ' → ' + esc(E.dateBr(s.last.d)) + ': ' + E.money(s.last.v, 'BRL') + ' · menor ' + E.money(s.min, 'BRL') + ' · maior ' + E.money(s.max, 'BRL') + ' · ' + s.n + ' dia(s)</p>';
  }
  function hist() { api('/api/watch').then(function (j) { if (j.ok) { var col = E.collection(items(), refs()); $('histOut').innerHTML = chart(j.hist || []) + (col.paidKnown ? '<p class="hint">Você pagou ' + E.money(col.paid, 'BRL') + ' nas ' + col.paidKnown + ' carta(s) em que marcou o valor.</p>' : ''); } }); }
  function importList() {
    var rows = E.parseImport($('imp').value); if (!rows.length) { $('impOut').textContent = 'Nenhuma linha lida. Use: nome e número;quantidade;valor pago.'; return; }
    $('impOut').textContent = 'Lendo ' + rows.length + ' carta(s)…';
    var done = 0, miss = [];
    (function next(i) {
      if (i >= rows.length) { drawSession(); $('impOut').textContent = done + ' de ' + rows.length + ' importadas' + (miss.length ? ' · não achamos: ' + miss.join(', ') : '') + '. Clique em «Salvar lista e avisos» para guardar.'; return; }
      var r = rows[i];
      api('/api/search?lang=pt&q=' + encodeURIComponent(r.name + (r.num ? ' ' + r.num : ''))).then(function (j) {
        var c = j.ok && j.cards && j.cards[0];
        if (c && !c.missing) { state.session.push({ card: c, qty: r.qty, paid: r.paid, line: null, dir: 'below' }); if (j.fx && !j.fx._err) state.fx = j.fx; done++; } else miss.push(r.name + (r.num ? ' ' + r.num : ''));
        setTimeout(function () { next(i + 1); }, 400);
      }).catch(function () { miss.push(r.name); next(i + 1); });
    })(0);
  }
  function csv() {
    var R = refs(), its = items(), rows = state.session.map(function (x, i) { return { card: x.card, item: its[i], ref: R[x.card.id] }; });
    var b = new Blob([E.toCsv(rows, state.fx)], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'preco-cartas-pokemon-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  // ── wiring
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'go') lookup();
    else if (t.classList.contains('add')) { var c = state.last && state.last.cards[+t.getAttribute('data-i')]; if (c && !c.missing) addSession(c); }
    else if (t.classList.contains('other')) one(t.getAttribute('data-id'));
    else if (t.classList.contains('rm')) { state.session.splice(+t.getAttribute('data-i'), 1); drawSession(); }
    else if (t.classList.contains('needpro')) {
      if (!state.pro) { needPro(t.getAttribute('data-what')); return; }
      if (t.id === 'saveBtn') save(); else if (t.id === 'checkBtn') checkNow(); else if (t.id === 'histBtn') hist(); else if (t.id === 'impBtn') importList(); else if (t.id === 'csvBtn') csv();
    } else if (t.id === 'keyBtn') { var k = $('key').value.trim(); if (k) unlock(k, false); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, f = t.getAttribute('data-f'), i = +t.getAttribute('data-i'); if (!f || !state.session[i]) return;
    var x = state.session[i];
    if (f === 'qty') x.qty = Math.max(1, Math.min(999, Math.floor(+t.value) || 1)); else if (f === 'paid') x.paid = brNum(t.value); else if (f === 'line') x.line = brNum(t.value); else if (f === 'dir') x.dir = t.value === 'above' ? 'above' : 'below';
    drawSession();
  });
  document.querySelector('[data-k="q"]').addEventListener('keydown', function (e) { if (e.key === 'Enter') lookup(); });
  render(SAMPLE, true); drawSession();
  var hk = (location.hash.match(/[#&]k=([^&]+)/) || [])[1], sk = ''; try { sk = localStorage.getItem('pcp_key') || ''; } catch (e) {}
  if (hk) { unlock(decodeURIComponent(hk), false); history.replaceState(null, '', location.pathname); } else if (sk) unlock(sk, true);
  if (typeof window !== 'undefined') window.PCP_APP = { render: render, state: state, items: items, refs: refs };
})();
