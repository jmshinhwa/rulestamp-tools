// app.js — page logic of "bolsa de empleo España" (Spain edition of the career-page job board, 2026-11-18). Free part also shows the BOE II.B calls.
// Free: the whole live list for one search on screen (any number of rows, every flag), one saved search in this browser, a weekly digest.

// history of closed roles, CSV export.
(function () {
  'use strict';
  var J = window.JB, L = window.JBLIC, DIR = window.JBDIR, BASE = 'https://bolsa-de-empleo.pages.dev';
  var STARTER = DIR.boards.map(function (b) { return b[0] + ':' + b[1]; });
  var AG = {}; DIR.boards.forEach(function (b) { if (b[4]) AG[b[0] + ':' + b[1]] = 1; });
  var FIELDS = [['all', 'fAll'], ['ret', 'fRet'], ['via', 'fVia'], ['sal', 'fSal'], ['ing', 'fIng'], ['fin', 'fFin'], ['tec', 'fTec'], ['ett', 'fEtt']];
  var COKR = /^[glawtrs]:[a-z0-9._-]+$/;
  var PAGE = 200;
  var NAMES = {}; DIR.boards.forEach(function (b) { NAMES[b[0] + ':' + b[1]] = b[2]; });
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function pickLang() {
    var m = /^\/(en|de|es|pt|ja)\//.exec(location.pathname), q = /[?&]lang=(en|de|es|pt|ja)\b/.exec(location.search);
    return (q && q[1]) || ls('be:lang') || (m && m[1]) || 'es';
  }
  var LANG = pickLang(), T = I18N.tr(LANG);
  var S = { tier: 'free', key: '', acct: null, sel: [], field: 'all', cache: {}, closed: {}, boards: {}, rows: [], view: [], shown: PAGE, applied: ls('be:applied') || {}, extra: ls('be:extra') || {}, now: Date.now() };
  Object.keys(S.extra).forEach(function (co) { NAMES[co] = NAMES[co] || S.extra[co]; });
  function coName(co) { return NAMES[co] || co.split(':')[1]; }
  function fmtDate(t) { if (!t) return ''; try { return new Date(t).toLocaleDateString(LANG, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return J.day(t); } }
  function fmtTime(t) { try { return new Date(t).toLocaleString(LANG, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return new Date(t).toISOString(); } }
  function ccName(c) {
    if (!c) return T('ccAny'); if (c === 'EU') return T('ccEU'); if (c === 'LATAM') return T('ccLATAM');
    try { return new Intl.DisplayNames([LANG], { type: 'region' }).of(c); } catch (e) { return c; }
  }

  // ---- search state ----
  function curSearch() {
    return { b: S.sel.slice(), q: $('#q').value.trim(), cc: 'ES', ci: $('#ci').value, ciRemote: $('#ciRemote').checked, hideEtt: $('#hideEtt').checked, remote: $('#remote').checked, within: +$('#within').value || 0,
      hideStale: $('#hideStale').checked, hideRedated: $('#hideRedated').checked, sort: $('#sort').value, field: S.field };
  }
  function applySearch(s) {
    s = s || {};
    S.sel = (s.b && s.b.length ? s.b : STARTER).filter(function (co) { return COKR.test(co); }).slice(0, 200);
    S.field = s.field || (s.b && s.b.length ? '' : 'all');
    $('#q').value = s.q || ''; $('#ci').value = J.CITIES.indexOf(s.ci || '') >= 0 ? s.ci : ''; $('#ciRemote').checked = s.ciRemote !== false; $('#hideEtt').checked = !!s.hideEtt; $('#remote').checked = !!s.remote;
    $('#within').value = String(s.within || 0); $('#hideStale').checked = !!s.hideStale; $('#hideRedated').checked = !!s.hideRedated; $('#sort').value = s.sort === 'co' ? 'co' : 'new';
  }
  function fromHash() { var m = /#s=(.+)$/.exec(location.hash); if (!m) return null; try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; } }

  // ---- loading ----
  function load() {
    var need = S.sel.filter(function (co) { return !S.cache[co]; });
    if (!need.length) { compute(); return Promise.resolve(); }
    $('#readAt').textContent = T('loading', { n: need.length });
    $('#tiles').classList.add('busy');
    var chunks = []; for (var i = 0; i < need.length; i += 20) chunks.push(need.slice(i, i + 20));
    return Promise.all(chunks.map(function (c) {
      return fetch(BASE + '/api/jobs?b=' + encodeURIComponent(c.join(',')), { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) throw new Error('bad');
        S.now = d.now || Date.now();
        Object.keys(d.boards).forEach(function (co) { S.boards[co] = d.boards[co]; S.closed[co] = d.closed[co] || []; S.cache[co] = []; });
        d.rows.forEach(function (r) { var b = S.boards[r.co]; r.born = b ? b.born : 0; S.cache[r.co].push(r); });
      }).catch(function () { c.forEach(function (co) { S.boards[co] = S.boards[co] || { n: 0, err: 'net' }; }); });
    })).then(function () { $('#tiles').classList.remove('busy'); compute(); });
  }
  function compute() {
    var rows = [], closed = {};
    S.sel.forEach(function (co) { (S.cache[co] || []).forEach(function (r) { rows.push(Object.assign({}, r)); }); closed[co] = S.closed[co] || []; });
    S.rows = J.annotate(rows, S.now, closed, AG);
    var s = curSearch();
    S.view = J.sortRows(J.filter(S.rows, s), s.sort);
    S.shown = PAGE; render();
  }

  // ---- render ----
  function tile(n, k, cls) { return '<div class="tile ' + (cls || '') + '"><b>' + n.toLocaleString(LANG) + '</b><span>' + esc(T(k)) + '</span></div>'; }
  function flagHtml(r) {
    var o = [];
    r.f.forEach(function (f) {
      if (f === 'new') o.push('<i class="fl new">' + esc(T('fNew')) + '</i>');
      else if (f === 'week') o.push('<i class="fl week">' + esc(T('fWeek')) + '</i>');
      else if (f === 'stale') o.push('<i class="fl stale">' + esc(T('fStale', { d: r.age })) + '</i>');
      else if (f === 'redated') o.push('<i class="fl red">' + esc(T('fRed', { date: fmtDate(r.d) })) + '</i>');
      else if (f === 'dup') o.push('<i class="fl dup">' + esc(T('fDup', { n: r.n })) + '</i>');
      else if (f === 'repost') o.push('<i class="fl rep">' + esc(T('fRep', { date: fmtDate(r.rp) })) + '</i>');
      else if (f === 'ett') o.push('<i class="fl ett">' + esc(T('fEttR')) + '</i>');
    });
    if (r.r) o.push('<i class="fl rem">' + esc(T('fRemote')) + '</i>');
    if (r.$) o.push('<i class="fl pay">' + esc(r.$) + '</i>');
    if (r.fs && r.born && r.fs > r.born + 3600e3) o.push('<i class="fl seen">' + esc(T('fSeen', { date: fmtDate(r.fs) })) + '</i>');
    return o.join(' ');
  }
  function render() {
    var esr = S.rows.filter(function (r) { return /(^|,)ES(,|$)/.test(r.c || ''); }), st = J.stats(esr), sv = J.stats(S.view);
    $('#tiles').innerHTML = tile(sv.open, 'sShown', 'main') + tile(st.open, 'sOpen') + tile(st.cos, 'sCos') + tile(st.n24, 's24', 'g') + tile(st.n7, 's7', 'g') +
      tile(st.stale, 'sStale', 'o') + tile(st.redated, 'sRed', 'o') + tile(st.dup, 'sDup', 'o') + (st.repost ? tile(st.repost, 'sRep', 'o') : '') + (st.ett ? tile(st.ett, 'sEtt', 'o') : '');
    var ats = S.sel.map(function (co) { return S.boards[co] && S.boards[co].at; }).filter(Boolean), at = ats.length ? Math.min.apply(null, ats) : S.now;
    var bad = S.sel.filter(function (co) { return S.boards[co] && S.boards[co].err; });
    $('#readAt').textContent = T('readAt', { time: fmtTime(at) }) + (bad.length ? ' ' + T('failed', { n: bad.length, list: bad.map(coName).join(', ') }) : '');
    if (st.cos) $('#b1').textContent = T('b1', { n: st.cos });
    if (st.open) $('#lede').textContent = T('lede', { time: fmtTime(at), open: st.open.toLocaleString(LANG), cos: st.cos, stale: st.stale.toLocaleString(LANG), pct: Math.round(st.stale * 100 / st.open), redated: st.redated.toLocaleString(LANG) });
    var show = S.view.slice(0, S.shown);
    $('#rows').innerHTML = show.length ? show.map(function (r) {
      var k = r.co + '#' + r.id, ap = isApplied(k);
      return '<tr' + (ap ? ' class="ap"' : '') + '><td class="t"><a href="' + esc(r.u) + '" target="_blank" rel="noopener nofollow">' + esc(r.t) + '</a>' + (r.dp ? '<small>' + esc(r.dp) + '</small>' : '') + '</td><td>' + esc(coName(r.co)) + '</td><td class="l">' + esc(r.l) +
        '</td><td class="p">' + esc(fmtDate(r.p)) + '<small>' + esc(r.age === 0 ? T('today') : T('dAgo', { d: r.age })) + '</small></td><td class="f">' + flagHtml(r) + '</td><td class="a"><input type="checkbox" data-k="' + esc(k) + '"' + (ap ? ' checked' : '') + ' aria-label="' + esc(T('applied')) + '"></td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">' + esc(S.sel.length && Object.keys(S.cache).length ? T('noRows') : T('ledeWait')) + '</td></tr>';
    var left = S.view.length - show.length;
    $('#moreB').hidden = left <= 0; $('#moreB').textContent = T('more', { n: Math.min(PAGE, left).toLocaleString(LANG) });
    $('#pickedN').textContent = T('picked', { n: S.sel.length });
    renderFields(); renderCoList();
  }
  function renderFields() {
    $('#fields').innerHTML = FIELDS.map(function (f) {
      var n = f[0] === 'all' ? STARTER.length : DIR.boards.filter(function (b) { return b[3] === f[0]; }).length;
      return '<button type="button" class="chip' + (S.field === f[0] ? ' on' : '') + '" data-field="' + f[0] + '">' + esc(T(f[1])) + ' <small>' + n + '</small></button>';
    }).join('');
  }
  function allBoards() {
    var list = DIR.boards.map(function (b) { return [b[0] + ':' + b[1], b[2]]; });
    Object.keys(S.extra).forEach(function (co) { if (!NAMES[co] || !DIR.boards.some(function (b) { return b[0] + ':' + b[1] === co; })) list.push([co, S.extra[co]]); });
    return list;
  }
  function renderCoList() {
    if (!$('#picker').open) return;
    var f = J.norm($('#coFilter').value);
    $('#colist').innerHTML = allBoards().filter(function (b) { return !f || J.norm(b[1] + ' ' + b[0]).indexOf(f) >= 0; }).map(function (b) {
      var n = S.boards[b[0]] ? S.boards[b[0]].n : null;
      return '<label><input type="checkbox" data-co="' + esc(b[0]) + '"' + (S.sel.indexOf(b[0]) >= 0 ? ' checked' : '') + '> ' + esc(b[1]) + (n != null ? ' <small>' + n + '</small>' : '') + '</label>';
    }).join('');
  }

  // ---- applied marks ----
  function isApplied(k) { return S.acct ? !!(S.acct.applied || {})[k] : !!S.applied[k]; }
  var saveTimer = null;
  function setApplied(k, on) {
    if (S.acct) { S.acct.applied = S.acct.applied || {}; if (on) S.acct.applied[k] = Date.now(); else delete S.acct.applied[k]; clearTimeout(saveTimer); saveTimer = setTimeout(saveAcct, 800); }
    else { if (on) S.applied[k] = Date.now(); else delete S.applied[k]; ls('be:applied', S.applied); }
  }

  // ---- server calls ----
  function post(path, body) {
    return fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit' }).then(function (r) { return r.json().then(function (j) { j._s = r.status; return j; }); });
  }
  function saveAcct() {
    if (!S.acct) return Promise.resolve();
    return post('/api/a/save', { key: S.key, acct: { email: S.acct.email, lang: S.acct.lang, on: S.acct.on, searches: S.acct.searches, applied: S.acct.applied } }).then(function (j) { if (j.ok) S.acct = j.acct; return j; });
  }
  function openAcct() {
    return post('/api/a/open', { key: S.key }).then(function (j) { if (j.ok) { S.acct = j.acct; S.tier = j.tier || S.tier; } else { S.acct = null; } renderSaved(); render(); }, function () { renderSaved(); });
  }

  // ---- saved searches & alerts pane ----
  function searchLabel(s) { return s.name || s.q || (s.b || []).slice(0, 3).map(coName).join(', ') + ((s.b || []).length > 3 ? ' …' : ''); }
  function renderSaved() {
    var paid = S.tier !== 'free', box = $('#savedBox'), list = paid && S.acct ? S.acct.searches : (ls('be:search') ? [ls('be:search')] : []);
    box.innerHTML = '<div class="card"><h2>' + esc(T('mySearches')) + ' <span class="tag ' + (paid ? 'paid' : 'free') + '">' + esc(paid ? T('paidTag') : T('freeTag')) + '</span></h2>' +
      (list.length ? '<ol class="saved">' + list.map(function (s, i) {
        return '<li><b>' + esc(searchLabel(s)) + '</b> <small>' + esc(T('boardsN', { n: (s.b || []).length })) + ' · ' + esc(s.ci || T('ciAny')) + (s.remote ? ' · ' + esc(T('fRemote')) : '') + '</small> <button type="button" data-open="' + i + '">' + esc(T('open')) + '</button> <button type="button" data-del="' + i + '">' + esc(T('del')) + '</button></li>';
      }).join('') + '</ol>' : '<p class="hint">' + esc(T('noneSaved')) + '</p>') + (paid ? '' : '<p class="hint">' + esc(T('freeOne')) + '</p>') + '</div>';
    $('#digBox').hidden = paid;
    $('#keyBox').innerHTML = paid ? '<p class="ok">' + esc(T('keyOk', { tier: T(S.tier === 'year' ? 'year' : 'month') })) + ' <button type="button" id="keyOut">' + esc(T('keyOut')) + '</button></p>'
      : '<form id="keyForm" class="row"><label><span>' + esc(T('keyT')) + '</span><input id="keyIn" maxlength="200" placeholder="' + esc(T('keyPh')) + '" autocomplete="off"></label><button type="submit">' + esc(T('keyB')) + '</button></form><p class="hint" id="keyMsg"></p>';
    $('#acctBox').innerHTML = paid && S.acct ? '<form id="acctForm" class="row"><label><span>' + esc(T('email')) + '</span><input id="aEmail" type="email" maxlength="200" value="' + esc(S.acct.email) + '"></label>' +
      '<label><span>' + esc(T('alertLang')) + '</span><select id="aLang">' + I18N.LANGS.map(function (l) { return '<option value="' + l + '"' + (S.acct.lang === l ? ' selected' : '') + '>' + I18N.NAMES[l] + '</option>'; }).join('') + '</select></label>' +
      '<label class="ck"><input type="checkbox" id="aOn"' + (S.acct.on ? ' checked' : '') + '> ' + esc(T('alertsOn')) + '</label><button type="submit">' + esc(T('saveAcct')) + '</button></form>' +
      '<p class="hint" id="acctMsg">' + esc(T('lastMail', { t: S.acct.lastMail ? fmtTime(S.acct.lastMail) : T('never') })) + '</p>' : '';
  }
  function savedList() { return S.tier !== 'free' && S.acct ? S.acct.searches : (ls('be:search') ? [ls('be:search')] : []); }

  // ---- history (paid) ----
  function loadHist() {
    if (S.tier === 'free' || !S.key) { $('#histMsg').innerHTML = esc(T('histLock')) + ' <a href="#buybox">' + esc(T('buyM')) + '</a>'; return; }
    $('#histMsg').textContent = T('loading', { n: Math.min(60, S.sel.length) });
    post('/api/a/history', { key: S.key, b: S.sel.slice(0, 60) }).then(function (j) {
      if (!j.ok) { $('#histMsg').textContent = T('keyBad'); return; }
      var rows = [];
      Object.keys(j.closed).forEach(function (co) { j.closed[co].forEach(function (c) { rows.push({ co: co, t: c[0], l: c[1], u: c[2], closed: c[3], seen: c[4] }); }); });
      rows.sort(function (a, b) { return b.closed - a.closed; }); S.hist = rows;
      $('#histMsg').textContent = rows.length ? '' : T('histNone');
      $('#hist').innerHTML = rows.length ? '<table class="jobs"><tbody>' + rows.map(function (r) {
        return '<tr><td class="t">' + esc(r.t) + '</td><td>' + esc(coName(r.co)) + '</td><td class="l">' + esc(r.l) + '</td><td>' + esc(T('seenFrom', { date: fmtDate(r.seen) })) + '</td><td><i class="fl stale">' + esc(T('closedOn', { date: fmtDate(r.closed) })) + '</i></td></tr>';
      }).join('') + '</tbody></table>' : '';
    }, function () { $('#histMsg').textContent = T('netErr'); });
  }
  function download(name, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---- BOE II.B (free: the whole list on screen, filtered by a word) ----
  function loadBoe() {
    if (S.boe) { renderBoe(); return; }
    $('#boeMsg').textContent = T('boeLoad');
    fetch(BASE + '/api/boe?n=5', { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (j) { if (!j || !j.ok) throw new Error('bad'); S.boe = j.days || []; renderBoe(); },
      function () { $('#boeMsg').textContent = T('boeErr'); });
  }
  function renderBoe() {
    var q = $('#boeQ').value.trim(), html = '', msg = [], hits = 0;
    (S.boe || []).forEach(function (d) {
      var items = q ? d.items.filter(function (it) { return J.boeMatch(it, q); }) : d.items; hits += items.length;
      var dt = fmtDate(Date.parse(d.day + 'T12:00:00Z'));
      msg.push(T('boeDay', { date: dt, n: d.n }) + (q ? ' · ' + T('boeMatch', { n: items.length, q: q }) : ''));
      if (!items.length) return;
      html += '<h3 class="boeday">' + esc(T('boeDay', { date: dt, n: d.n })) + '</h3><ol class="boe">' + items.map(function (it) {
        return '<li><a href="' + esc(it.u) + '" target="_blank" rel="noopener">' + esc(it.t) + '</a><small>' + esc([it.dep, it.ep, it.id].filter(Boolean).join(' · ')) + (it.pdf ? ' · <a href="' + esc(it.pdf) + '" target="_blank" rel="noopener">' + esc(T('boePdf')) + '</a>' : '') + '</small></li>';
      }).join('') + '</ol>';
    });
    $('#boeMsg').textContent = msg.join(' — ') + (q && !hits ? ' — ' + T('boeNone') : '');
    $('#boeList').innerHTML = html;
  }

  // ---- language ----
  function setLang(l) {
    LANG = l; T = I18N.tr(l); ls('be:lang', l);
    try { history.replaceState(null, '', location.pathname + (l === 'es' && !/[?&]lang=/.test(location.search) ? location.search : '?lang=' + l) + location.hash); } catch (e) {}
    document.documentElement.lang = l; document.title = T('title');
    $$('[data-t]').forEach(function (e) { e.textContent = T(e.getAttribute('data-t'), { n: DIR.boards.length }); });
    $$('[data-tp]').forEach(function (e) { e.placeholder = T(e.getAttribute('data-tp')); });
    var civ = $('#ci').value, wv = $('#within').value, sv = $('#sort').value;
    $('#ci').innerHTML = '<option value="">' + esc(T('ciAny')) + '</option>' + J.CITIES.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join(''); $('#ci').value = civ || '';
    $('#within').innerHTML = [[0, 'wAny'], [1, 'w1'], [7, 'w7'], [30, 'w30']].map(function (w) { return '<option value="' + w[0] + '">' + esc(T(w[1])) + '</option>'; }).join(''); $('#within').value = wv || '0';
    $('#sort').innerHTML = '<option value="new">' + esc(T('sNew')) + '</option><option value="co">' + esc(T('sCo')) + '</option>'; $('#sort').value = sv || 'new';
    if (S.boe) renderBoe();
    if (S.rows.length) render(); renderSaved();
    $('#mode').textContent = S.tier !== 'free' ? T('keyOk', { tier: T(S.tier === 'year' ? 'year' : 'month') }) : '';
  }

  // ---- events ----
  function wire() {
    $('#lang').innerHTML = I18N.LANGS.map(function (l) { return '<option value="' + l + '"' + (l === LANG ? ' selected' : '') + '>' + I18N.NAMES[l] + '</option>'; }).join('');
    $('#lang').addEventListener('change', function () { setLang(this.value); });
    $$('.tabs [data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.tabs [data-tab]').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
        ['j', 'b', 's', 'h'].forEach(function (k) { $('#pane-' + k).hidden = k !== b.getAttribute('data-tab'); });
        if (b.getAttribute('data-tab') === 's') renderSaved();
        if (b.getAttribute('data-tab') === 'b') { if (!$('#boeQ').value && $('#q').value.trim()) $('#boeQ').value = $('#q').value.trim().split(/\s+/).filter(function (w) { return w.charAt(0) !== '-'; }).join(' '); loadBoe(); }
      });
    });
    $('#fields').addEventListener('click', function (e) {
      var b = e.target.closest('[data-field]'); if (!b) return;
      S.field = b.getAttribute('data-field');
      S.sel = S.field === 'all' ? STARTER.slice() : DIR.boards.filter(function (x) { return x[3] === S.field; }).map(function (x) { return x[0] + ':' + x[1]; });
      load();
    });
    $('#picker').addEventListener('toggle', renderCoList);
    $('#coFilter').addEventListener('input', renderCoList);
    var pickT = null;
    $('#colist').addEventListener('change', function (e) {
      var co = e.target.getAttribute('data-co'); if (!co) return;
      var i = S.sel.indexOf(co); if (e.target.checked && i < 0) S.sel.push(co); if (!e.target.checked && i >= 0) S.sel.splice(i, 1);
      S.field = ''; clearTimeout(pickT); pickT = setTimeout(load, 500);
    });
    $('#selAll').addEventListener('click', function () { $$('#colist [data-co]').forEach(function (c) { var co = c.getAttribute('data-co'); if (S.sel.indexOf(co) < 0) S.sel.push(co); }); S.field = ''; load(); });
    $('#selNone').addEventListener('click', function () { S.sel = []; S.field = ''; compute(); });
    $('#addForm').addEventListener('submit', function (e) {
      e.preventDefault(); var v = $('#addIn').value.trim(), p = J.parseBoard(v), msg = $('#addMsg');
      if (!p) { msg.textContent = T('addBad'); msg.className = 'hint err'; return; }
      var co = p.a + ':' + p.s; msg.textContent = T('loading', { n: 1 }); msg.className = 'hint';
      fetch(BASE + '/api/board?u=' + encodeURIComponent(v), { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) { msg.textContent = j.error === 'url' ? T('addBad') : T('addNone'); msg.className = 'hint err'; return; }
        if (!NAMES[co]) { NAMES[co] = p.s.replace(/[-_.]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); S.extra[co] = NAMES[co]; ls('be:extra', S.extra); }
        if (S.sel.indexOf(co) < 0) S.sel.push(co); S.field = ''; delete S.cache[co];
        msg.textContent = T('addOk', { name: coName(co), n: j.n }); msg.className = 'hint ok'; $('#addIn').value = ''; load();
      }, function () { msg.textContent = T('netErr'); msg.className = 'hint err'; });
    });
    ['#q', '#ci', '#ciRemote', '#hideEtt', '#within', '#sort', '#remote', '#hideStale', '#hideRedated'].forEach(function (id) {
      var t = null; $(id).addEventListener(id === '#q' ? 'input' : 'change', function () { clearTimeout(t); t = setTimeout(compute, id === '#q' ? 250 : 0); });
    });
    $('#moreB').addEventListener('click', function () { S.shown += PAGE; render(); });
    $('#rows').addEventListener('change', function (e) { var k = e.target.getAttribute('data-k'); if (k) { setApplied(k, e.target.checked); e.target.closest('tr').classList.toggle('ap', e.target.checked); } });
    $('#saveB').addEventListener('click', function () {
      var s = curSearch(), m = $('#actMsg');
      if (S.tier !== 'free' && S.acct) {
        s.id = 's' + Date.now().toString(36); s.name = s.q || (s.field ? T(FIELDS.filter(function (f) { return f[0] === s.field; })[0][1]) : '') || searchLabel(s);
        S.acct.searches = (S.acct.searches || []).concat([s]);
        saveAcct().then(function (j) { m.textContent = j && j.ok ? T('savedPaid') : T('netErr'); }, function () { m.textContent = T('netErr'); });
      } else { ls('be:search', s); m.textContent = T('saved1') + ' ' + T('freeOne'); }
      renderSaved();
    });
    $('#csvB').addEventListener('click', function () {
      var m = $('#actMsg');
      if (S.tier === 'free') { m.innerHTML = esc(T('csvLock')) + ' <a href="#buybox">' + esc(T('buyM')) + '</a>'; return; }
      download('bolsa-de-empleo-' + J.day(Date.now()) + '.csv', J.csv(S.view, NAMES));
    });
    $('#savedBox').addEventListener('click', function (e) {
      var o = e.target.getAttribute('data-open'), d = e.target.getAttribute('data-del'), list = savedList();
      if (o != null && list[+o]) { applySearch(list[+o]); $('.tabs [data-tab="j"]').click(); load(); }
      if (d != null) {
        if (S.tier !== 'free' && S.acct) { S.acct.searches.splice(+d, 1); saveAcct().then(renderSaved); } else { ls('be:search', null); renderSaved(); }
      }
    });
    $('#digForm').addEventListener('submit', function (e) {
      e.preventDefault(); var m = $('#digMsg'), s = ls('be:search') || curSearch();
      if (!ls('be:search')) ls('be:search', s);
      m.textContent = '…';
      post('/api/f/sub', { email: $('#digEmail').value.trim(), lang: LANG, s: s }).then(function (j) { m.textContent = j.ok ? T('digSent') : T('digErr'); m.className = 'hint ' + (j.ok ? 'ok' : 'err'); renderSaved(); }, function () { m.textContent = T('digErr'); m.className = 'hint err'; });
    });
    document.addEventListener('submit', function (e) {
      if (e.target.id === 'keyForm') {
        e.preventDefault(); var k = $('#keyIn').value.trim();
        L.enter(k).then(function (r) {
          if (r.ok) { S.tier = r.tier; S.key = k; $('#mode').textContent = T('keyOk', { tier: T(r.tier === 'year' ? 'year' : 'month') }); openAcct(); }
          else { $('#keyMsg').textContent = r.offline ? T('netErr') : T('keyBad'); $('#keyMsg').className = 'hint err'; }
        });
      }
      if (e.target.id === 'acctForm') {
        e.preventDefault(); S.acct.email = $('#aEmail').value.trim(); S.acct.lang = $('#aLang').value; S.acct.on = $('#aOn').checked;
        saveAcct().then(function (j) { $('#acctMsg').textContent = j && j.ok ? T('savedOk') : T('netErr'); }, function () { $('#acctMsg').textContent = T('netErr'); });
      }
    });
    document.addEventListener('click', function (e) { if (e.target.id === 'keyOut') { L.remove(); S.tier = 'free'; S.key = ''; S.acct = null; $('#mode').textContent = ''; renderSaved(); render(); } });
    $('#histB').addEventListener('click', loadHist);
    var bt = null; $('#boeQ').addEventListener('input', function () { clearTimeout(bt); bt = setTimeout(function () { if (S.boe) renderBoe(); }, 250); });
    $('#histCsv').addEventListener('click', function () {
      if (S.tier === 'free' || !S.hist) { loadHist(); return; }
      download('bolsa-de-empleo-cerradas-' + J.day(Date.now()) + '.csv', 'empresa,puesto,ubicacion,vista_desde,cerrada,url\n' + S.hist.map(function (r) { return [coName(r.co), r.t, r.l, J.day(r.seen), J.day(r.closed), r.u].map(function (v) { v = String(v || ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\n') + '\n');
    });
  }

  // ---- start ----
  wire();
  setLang(LANG);
  applySearch(fromHash() || ls('be:search') || null);
  load();
  L.status().then(function (st) {
    if (st.tier !== 'free' && st.key) { S.tier = st.tier; S.key = st.key; $('#mode').textContent = T('keyOk', { tier: T(st.tier === 'year' ? 'year' : 'month') }); openAcct(); }
    else renderSaved();
  });
  window.JBAPP = { S: S, load: load, compute: compute, loadBoe: loadBoe };
})();
