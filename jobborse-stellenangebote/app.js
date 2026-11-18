
(function () {
  'use strict';
  var J = window.JB, L = window.JBLIC, BASE = 'https://jobborse-stellenangebote.pages.dev';
  var $ = function (s) { return document.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function lj(k, d) { try { var v = JSON.parse(ls(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pickLang() { var m = /^\/(de|en|es|pt|ja)\//.exec(location.pathname), q = /[?&]lang=(de|en|es|pt|ja)\b/.exec(location.search); return (q && q[1]) || ls('jbde:lang') || (m && m[1]) || 'de'; }
  var LANG = pickLang(), T = I18N.tr(LANG);
  var S = { tier: 'free', key: '', acct: null, rows: [], meta: null, cos: {}, show: 100, cur: null, log: lj('jbde:log', []), who: lj('jbde:who', { name: '', kdnr: '' }) };
  var RADII = [0, 5, 10, 15, 25, 50, 100, 200];
  function paid() { return S.tier === 'month' || S.tier === 'year'; }
  function nowTime() { var d = new Date(); return d.toLocaleString(LANG === 'en' ? 'en-GB' : LANG, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function post(path, body) { return fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }
  function dl(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function needPaid(msgEl) { var m = $(msgEl); if (m) { m.textContent = T('needKey'); m.className = 'hint err'; } $('#buybox').scrollIntoView({ behavior: 'smooth', block: 'center' }); }

  // ---- search ----
  function current() { return { was: $('#was').value.trim(), wo: $('#wo').value.trim(), r: +$('#r').value, d: $('#d').checked, cos: S.cur && S.cur.cos || [] }; }
  function setForm(s) { $('#was').value = s.was || ''; $('#wo').value = s.wo || ''; $('#r').value = String(RADII.indexOf(+s.r) >= 0 ? +s.r : 25); $('#d').checked = s.d !== false; S.cur = { was: s.was || '', wo: s.wo || '', r: +s.r || 25, d: s.d !== false, cos: (s.cos || []).slice() }; }
  var seq = 0;
  function run() {
    var s = current(), my = ++seq; S.cur = s; S.show = 100;
    if (!s.was && !s.wo && !s.cos.length) return;
    $('#lede').textContent = T('ledeWait'); $('#tiles').classList.add('busy');
    var jobs = (s.was || s.wo) ? fetch(BASE + '/api/jobs?' + new URLSearchParams({ was: s.was, wo: s.wo, r: s.r, d: s.d ? 1 : 0 })).then(function (r) { return r.json(); }) : Promise.resolve({ ok: true, rows: [], total: 0, direct: 0, noZa: 0, n: 0 });
    var cos = paid() ? s.cos.map(function (c) { return fetch(BASE + '/api/co?s=' + encodeURIComponent(c)).then(function (r) { return r.json(); }).catch(function () { return { ok: false, slug: c, rows: [] }; }); }) : [];
    return Promise.all([jobs].concat(cos)).then(function (res) {
      if (my !== seq) return;
      var j = res[0]; $('#tiles').classList.remove('busy');
      if (!j.ok) { $('#lede').textContent = T('ledeErr'); S.rows = []; S.meta = null; render(); return; }
      var rows = j.rows.slice(); S.cos = {};
      res.slice(1).forEach(function (c) { if (c && c.ok) { S.cos[c.slug] = { co: c.co, n: c.n }; rows = rows.concat(c.rows); } });
      J.annotate(rows, Date.now());
      S.rows = rows; S.meta = { total: j.total, noZa: j.noZa, direct: j.direct, n: j.n, at: nowTime() };
      if (!paid() && !ls('jbde:s1')) ls('jbde:s1', JSON.stringify({ was: s.was, wo: s.wo, r: s.r, d: s.d, at: Date.now() }));
      render();
    }, function () { if (my === seq) { $('#tiles').classList.remove('busy'); $('#lede').textContent = T('ledeErr'); } });
  }
  function opts() { return { q: $('#q').value, within: +$('#within').value, hideStale: $('#hideStale').checked, sal: $('#sal').checked, tz: $('#tz').checked, ho: $('#ho').checked }; }
  function shownRows() { return J.sortRows(J.filter(S.rows, opts()), $('#sort').value); }
  function tile(v, k, cls) { return '<div class="tile ' + (cls || '') + '"><b>' + esc(v == null ? '–' : Number(v).toLocaleString('de-DE')) + '</b><span>' + esc(T(k)) + '</span></div>'; }
  function flags(r) {
    var o = [];
    if (r.f.indexOf('new') >= 0) o.push('<i class="fl new">' + esc(T('fNew')) + '</i>'); else if (r.f.indexOf('week') >= 0) o.push('<i class="fl week">' + esc(T('fWeek')) + '</i>');
    if (r.f.indexOf('stale') >= 0) o.push('<i class="fl stale">' + esc(T('fStale', { d: r.age })) + '</i>');
    if (r.f.indexOf('dup') >= 0) o.push('<i class="fl dup">' + esc(T('fDup', { n: r.n })) + '</i>');
    if (r.f.indexOf('red') >= 0) o.push('<i class="fl red">' + esc(T('fRed', { date: J.de(r.ch) })) + '</i>');
    if (r.sal) o.push('<i class="fl sal">' + esc(r.sal) + '</i>');
    r.wz.forEach(function (w) { o.push('<i class="fl">' + esc(T({ vz: 'fVz', tz: 'fTz', mini: 'fMini', ho: 'fHo' }[w])) + '</i>'); });
    if (r.bef) o.push('<i class="fl">' + esc(T('fBef')) + '</i>');
    if (r.src === 'p') o.push('<i class="fl seen">' + esc(T('pers')) + '</i>');
    return o.join(' ');
  }
  function logMap() { var m = {}; S.log.forEach(function (e) { if (e.id) m[e.id] = e.d; }); return m; }
  function render() {
    var m = S.meta, rows = shownRows(), st = J.stats(S.rows), ap = logMap();
    if (m) {
      var pct = st.n ? Math.round(st.stale / st.n * 100) : 0;
      $('#lede').textContent = S.rows.length ? T('lede', { time: m.at, total: (m.total || 0).toLocaleString('de-DE'), direct: (m.direct || 0).toLocaleString('de-DE'), n: st.n.toLocaleString('de-DE'), stale: st.stale.toLocaleString('de-DE'), pct: pct, oldest: J.de(st.oldest) }) : T('ledeNone');
      $('#tiles').innerHTML = tile(m.total, 'tTotal') + tile(m.noZa, 'tNoZa') + tile(m.direct, 'tDirect', 'main') + tile(rows.length, 'tShown') + tile(st.d1, 't1', 'g') + tile(st.d7, 't7', 'g') + tile(st.stale, 'tStale', 'o') + tile(st.dup, 'tDup', 'o') + tile(st.sal, 'tSal');
      var avail = (S.cur && S.cur.d) ? m.direct : m.total;
      $('#readAt').textContent = T('readAt', { time: m.at, n: S.rows.length.toLocaleString('de-DE') }) + (avail > m.n ? ' ' + T('capped', { n: m.n.toLocaleString('de-DE'), total: avail.toLocaleString('de-DE') }) : '');
    }
    var now = Date.now();
    $('#rows').innerHTML = rows.slice(0, S.show).map(function (r) {
      var done = ap[r.id];
      return '<tr' + (done ? ' class="ap"' : '') + '><td class="t"><a href="' + esc(r.u) + '" target="_blank" rel="noopener">' + esc(r.t) + '</a>' + (r.x ? '<small><a href="' + esc(r.x) + '" target="_blank" rel="noopener nofollow">' + esc(T('ext')) + ' ↗</a></small>' : '') + (r.src === 'ba' ? '<small>Ref. ' + esc(r.id) + '</small>' : '') + '</td>' +
        '<td>' + esc(r.co) + '</td><td class="l">' + esc(r.l) + (r.km != null ? '<small>' + esc(r.km) + ' km</small>' : '') + '</td>' +
        '<td class="p">' + esc(J.de(r.p)) + '<small>' + (r.age === 0 ? esc(T('today')) : r.age === 1 ? esc(T('day1')) : esc(T('days', { d: r.age == null ? '–' : r.age }))) + '</small></td>' +
        '<td>' + flags(r) + '</td><td class="a">' + (done ? '<span class="apd">' + esc(T('appliedOn', { date: J.de(done) })) + '</span>' : '<button type="button" class="apb" data-id="' + esc(r.id) + '">' + esc(T('apply')) + '</button>') + '</td></tr>';
    }).join('');
    var more = rows.length - S.show; $('#moreB').hidden = more <= 0; if (more > 0) $('#moreB').textContent = '+ ' + Math.min(100, more) + ' (' + more + ')';
    $('#logN').textContent = S.log.length || '';
  }
  function markApplied(id) {
    var r = S.rows.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    S.log.push(J.cleanLog({ id: r.id, d: J.ymd(Date.now()), co: r.co, t: r.t, l: r.l, ref: r.src === 'ba' ? r.id : '', u: r.u, art: 'online', st: 'offen' }));
    saveLog(); render(); renderLog();
  }
  function saveLog() { ls('jbde:log', JSON.stringify(S.log)); if (paid() && S.acct) { S.acct.log = S.log; syncAcct(); } }
  var syncT = 0;
  function syncAcct(now) { clearTimeout(syncT); var f = function () { return post('/api/a/save', { key: S.key, acct: { email: S.acct.email, lang: S.acct.lang, on: S.acct.on, who: S.who, searches: S.acct.searches, log: S.log } }).then(function (j) { if (j.ok) S.acct = j.acct; return j; }); }; if (now) return f(); syncT = setTimeout(f, 800); return Promise.resolve(); }

  // ---- proof of applications ----
  function logRows() { return J.logRange(S.log, $('#logFrom').value, $('#logTo').value); }
  function sel(name, vals, cur, i) { return '<select data-i="' + i + '" data-k="' + name + '">' + vals.map(function (v) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + esc(T(name + '_' + v)) + '</option>'; }).join('') + '</select>'; }
  function renderLog() {
    var list = logRows();
    $('#logCount').textContent = T('logCount', { n: list.length });
    $('#logRows').innerHTML = list.length ? list.map(function (e) {
      var i = S.log.indexOf(e);
      return '<tr><td><input type="date" data-i="' + i + '" data-k="d" value="' + esc(e.d) + '"></td><td><input data-i="' + i + '" data-k="co" value="' + esc(e.co) + '"></td><td><input data-i="' + i + '" data-k="t" value="' + esc(e.t) + '">' + (e.ref ? '<small>Ref. ' + esc(e.ref) + '</small>' : '') + '</td>' +
        '<td>' + sel('art', J.ART, e.art, i) + '</td><td>' + sel('st', J.ST, e.st, i) + '</td><td><input data-i="' + i + '" data-k="note" value="' + esc(e.note) + '"></td><td><button type="button" data-del="' + i + '">✕</button></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">' + esc(T('logEmpty')) + '</td></tr>';
    $('#logFree').hidden = paid();
    $('#logN').textContent = S.log.length || '';
  }
  function proofHtml() {
    var list = logRows(), f = $('#logFrom').value, t = $('#logTo').value, P = I18N.tr('de');
    var period = (f || (list[0] && list[0].d)) ? J.de(f || list[0].d) + ' – ' + J.de(t || (list.length ? list[list.length - 1].d : J.ymd(Date.now()))) : '';
    var rows = list.map(function (e, k) { return '<tr><td>' + (k + 1) + '</td><td>' + esc(J.de(e.d)) + '</td><td>' + esc(e.co) + (e.l ? '<br><small>' + esc(e.l) + '</small>' : '') + '</td><td>' + esc(e.t) + '</td><td>' + (e.ref ? 'Jobbörse BA, Ref. ' + esc(e.ref) : esc(e.u || '')) + '</td><td>' + esc(P('art_' + e.art)) + '</td><td>' + esc(P('st_' + e.st)) + (e.note ? '<br><small>' + esc(e.note) + '</small>' : '') + '</td></tr>'; }).join('');
    return '<!doctype html><html lang="de"><meta charset="utf-8"><title>' + esc(P('pdfTitle')) + '</title><style>body{font:11pt/1.35 Arial,sans-serif;margin:18mm}h1{font-size:16pt;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #444;padding:4px 6px;vertical-align:top;font-size:9.5pt;text-align:left}th{background:#eee}small{color:#444}.meta td{border:none;padding:2px 8px 2px 0;font-size:11pt}.sign{margin-top:40px;border-top:1px solid #000;width:60%;padding-top:4px;font-size:9pt}.foot{font-size:8.5pt;color:#444;margin-top:14px}@page{size:A4 landscape;margin:12mm}</style>' +
      '<h1>' + esc(P('pdfTitle')) + '</h1><table class="meta"><tr><td><b>' + esc(P('who')) + ':</b></td><td>' + esc(S.who.name) + '</td><td><b>' + esc(P('kdnr')) + ':</b></td><td>' + esc(S.who.kdnr) + '</td><td><b>' + esc(P('pdfPeriod')) + ':</b></td><td>' + esc(period) + '</td></tr></table>' +
      '<table><thead><tr><th>' + esc(P('colNr')) + '</th><th>' + esc(P('colDate')) + '</th><th>' + esc(P('colCo')) + '</th><th>' + esc(P('colRole')) + '</th><th>' + esc(P('colRef')) + '</th><th>' + esc(P('colArt')) + '</th><th>' + esc(P('colSt')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="foot">' + esc(P('pdfMade', { date: J.de(Date.now()) })) + '</p><div class="sign">' + esc(P('pdfSign')) + '</div></html>';
  }
  function proofCsv() { var P = I18N.tr('de'); return J.csv([P('colDate'), P('colCo'), P('colLoc'), P('colRole'), P('colRef'), 'URL', P('colArt'), P('colSt'), P('colNote')], logRows().map(function (e) { return [J.de(e.d), e.co, e.l, e.t, e.ref, e.u, P('art_' + e.art), P('st_' + e.st), e.note]; })); }

  // ---- saved searches / account ----
  function freeBox() {
    var s1 = lj('jbde:s1', null);
    $('#freeBox').innerHTML = s1 ? '<p>' + esc(T('freeSaved')) + ' <b>' + esc([s1.was, s1.wo].filter(Boolean).join(' · ')) + '</b> <button type="button" id="s1Open">' + esc(T('open')) + '</button></p>' : '';
    $('#freeBox').hidden = !s1 || paid();
    var b = $('#s1Open'); if (b) b.onclick = function () { setForm(s1); tab('j'); run(); };
  }
  function keyBox() {
    if (paid()) { $('#keyBox').innerHTML = '<p class="ok">' + esc(T('keyOk')) + ' <button type="button" id="keyOut">' + esc(T('keyOut')) + '</button></p>'; $('#keyOut').onclick = function () { L.remove(); location.reload(); }; return; }
    $('#keyBox').innerHTML = '<form id="keyForm" class="row"><label><span>' + esc(T('keyL')) + '</span><input id="keyIn" type="text" maxlength="200" autocomplete="off"></label><button type="submit">' + esc(T('keyB')) + '</button></form><p class="hint" id="keyMsg"></p>';
    $('#keyForm').onsubmit = function (e) { e.preventDefault(); L.enter($('#keyIn').value).then(function (r) { if (r.ok) location.reload(); else { $('#keyMsg').textContent = T('keyBad'); $('#keyMsg').className = 'hint err'; } }); };
  }
  function acctBox() {
    if (!paid() || !S.acct) { $('#acctBox').innerHTML = ''; return; }
    var a = S.acct;
    $('#acctBox').innerHTML = '<form id="acctForm" class="row"><label><span>' + esc(T('email')) + '</span><input id="aEmail" type="email" maxlength="200" value="' + esc(a.email) + '" autocomplete="email"></label>' +
      '<label><span>' + esc(T('alertLang')) + '</span><select id="aLang">' + I18N.LANGS.map(function (l) { return '<option value="' + l + '"' + (a.lang === l ? ' selected' : '') + '>' + I18N.NAMES[l] + '</option>'; }).join('') + '</select></label>' +
      '<label class="ck"><input type="checkbox" id="aOn"' + (a.on ? ' checked' : '') + '> <span>' + esc(T('alertsOn')) + '</span></label><button type="submit">' + esc(T('saveAcct')) + '</button></form><p class="hint" id="acctMsg">' + (a.lastScan ? esc(T('lastRun', { time: new Date(a.lastScan).toLocaleString(LANG) })) : '') + '</p>' +
      '<h3>' + esc(T('searchesT')) + '</h3>' + (a.searches.length ? '<ul class="saved">' + a.searches.map(function (s, i) { return '<li><b>' + esc(s.name || [s.was, s.wo].filter(Boolean).join(' · ') || s.cos.join(', ')) + '</b> <small>' + esc((s.r ? s.r + ' km' : '') + (s.d ? ' · ' + T('tDirect') : '') + (s.cos.length ? ' · Personio: ' + s.cos.join(', ') : '')) + '</small> <button type="button" data-open="' + i + '">' + esc(T('open')) + '</button> <button type="button" data-rm="' + i + '">' + esc(T('del')) + '</button></li>'; }).join('') + '</ul>' : '<p class="hint">' + esc(T('noSearches')) + '</p>');
    $('#acctForm').onsubmit = function (e) { e.preventDefault(); a.email = $('#aEmail').value.trim(); a.lang = $('#aLang').value; a.on = $('#aOn').checked; syncAcct(true).then(function (j) { $('#acctMsg').textContent = j && j.ok ? T('savedMsg') : T('keyBad'); $('#acctMsg').className = 'hint ' + (j && j.ok ? 'ok' : 'err'); acctBox(); }); };
    $$('#acctBox [data-open]').forEach(function (b) { b.onclick = function () { setForm(a.searches[+b.dataset.open]); tab('j'); renderCos(); run(); }; });
    $$('#acctBox [data-rm]').forEach(function (b) { b.onclick = function () { a.searches.splice(+b.dataset.rm, 1); syncAcct(true).then(acctBox); }; });
  }
  function renderCos() {
    var cs = (S.cur && S.cur.cos) || [];
    $('#coN').textContent = cs.length ? '· ' + cs.length : '';
    $('#coList').innerHTML = cs.map(function (c, i) { var x = S.cos[c]; return '<li>' + esc(x ? x.co : c) + ' <small>' + esc(c) + '.jobs.personio.de' + (x ? ' · ' + x.n : '') + '</small> <button type="button" data-corm="' + i + '">✕</button></li>'; }).join('');
    $$('#coList [data-corm]').forEach(function (b) { b.onclick = function () { S.cur.cos.splice(+b.dataset.corm, 1); renderCos(); run(); }; });
  }
  function histBox() {
    if (!paid() || !S.acct) { $('#histBox').innerHTML = '<p class="hint">' + esc(T('needKey')) + '</p>'; return; }
    var a = S.acct;
    $('#histBox').innerHTML = a.searches.length ? a.searches.map(function (s, i) { return '<div class="card"><b>' + esc(s.name || [s.was, s.wo].filter(Boolean).join(' · ')) + '</b> <button type="button" data-h="' + i + '">' + esc(T('histLoad')) + '</button><div id="h' + i + '"></div></div>'; }).join('') : '<p class="hint">' + esc(T('noSearches')) + '</p>';
    $$('#histBox [data-h]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.h, s = a.searches[i];
        post('/api/a/hist', { key: S.key, sid: s.id }).then(function (j) {
          var box = $('#h' + i); if (!j.ok || !j.h) { box.innerHTML = '<p class="hint">' + esc(T('histEmpty')) + '</p>'; return; }
          var es = Object.keys(j.h.m).map(function (id) { var e = j.h.m[id]; return { id: id, t: e[0], co: e[1], l: e[2], p: e[3], seen: e[4], gone: e[5], u: e[6] }; }).sort(function (x, y) { return (y.gone || y.seen) - (x.gone || x.seen); });
          box.innerHTML = '<div class="tablewrap"><table class="jobs hist"><thead><tr><th>' + esc(T('colRole')) + '</th><th>' + esc(T('colCo')) + '</th><th>' + esc(T('colPosted')) + '</th><th>' + esc(T('histSeen')) + '</th><th>' + esc(T('histGone')) + '</th></tr></thead><tbody>' +
            es.slice(0, 500).map(function (e) { return '<tr' + (e.gone ? ' class="gone"' : '') + '><td><a href="' + esc(e.u) + '" target="_blank" rel="noopener">' + esc(e.t) + '</a></td><td>' + esc(e.co) + '</td><td>' + esc(J.de(e.p)) + '</td><td>' + esc(J.de(e.seen)) + '</td><td>' + (e.gone ? esc(J.de(e.gone)) : esc(T('histOpen'))) + '</td></tr>'; }).join('') + '</tbody></table></div>';
        });
      };
    });
  }

  // ---- language, tabs, wiring ----
  function setLang(l) {
    LANG = l; T = I18N.tr(l); ls('jbde:lang', l);
    try { history.replaceState(null, '', location.pathname + '?lang=' + l + location.hash); } catch (e) {}
    document.documentElement.lang = l; document.title = T('title');
    $$('[data-t]').forEach(function (e) { e.textContent = T(e.getAttribute('data-t')); });
    $$('[data-tp]').forEach(function (e) { e.placeholder = T(e.getAttribute('data-tp')); });
    $('#r').innerHTML = RADII.map(function (r) { return '<option value="' + r + '">' + (r ? r + ' km' : esc(T('rAll'))) + '</option>'; }).join(''); if (S.cur) $('#r').value = String(S.cur.r); else $('#r').value = '25';
    var w = $('#within').value; $('#within').innerHTML = [['0', 'wAny'], ['1', 'w1'], ['7', 'w7'], ['30', 'w30']].map(function (x) { return '<option value="' + x[0] + '">' + esc(T(x[1])) + '</option>'; }).join(''); $('#within').value = w || '0';
    var so = $('#sort').value; $('#sort').innerHTML = [['new', 'sNew'], ['old', 'sOld'], ['km', 'sKm'], ['co', 'sCo']].map(function (x) { return '<option value="' + x[0] + '">' + esc(T(x[1])) + '</option>'; }).join(''); $('#sort').value = so || 'new';
    $('#mode').textContent = paid() ? T('mode') : '';
    render(); renderLog(); freeBox(); keyBox(); acctBox(); histBox();
  }
  function tab(k) { $$('.tabs button').forEach(function (b) { var on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); ['j', 's', 'n', 'h'].forEach(function (x) { $('#pane-' + x).hidden = x !== k; }); if (k === 'n') renderLog(); }
  function wire() {
    $('#lang').innerHTML = I18N.LANGS.map(function (l) { return '<option value="' + l + '"' + (l === LANG ? ' selected' : '') + '>' + I18N.NAMES[l] + '</option>'; }).join('');
    $('#lang').addEventListener('change', function () { setLang(this.value); });
    $$('.tabs button').forEach(function (b) { b.addEventListener('click', function () { tab(b.dataset.tab); }); });
    $('#search').addEventListener('submit', function (e) { e.preventDefault(); run(); });
    $('#d').addEventListener('change', run); $('#r').addEventListener('change', run);
    $('#sampleB').addEventListener('click', function () { setForm({ was: 'Buchhalter', wo: 'Köln', r: 25, d: true }); run(); });
    ['#q', '#within', '#sort', '#hideStale', '#sal', '#tz', '#ho'].forEach(function (s) { $(s).addEventListener(s === '#q' ? 'input' : 'change', function () { S.show = 100; render(); }); });
    $('#moreB').addEventListener('click', function () { S.show += 100; render(); });
    $('#rows').addEventListener('click', function (e) { var b = e.target.closest('.apb'); if (b) markApplied(b.dataset.id); });
    $('#saveB').addEventListener('click', function () {
      var s = current(), m = $('#actMsg');
      if (!paid()) { ls('jbde:s1', JSON.stringify({ was: s.was, wo: s.wo, r: s.r, d: s.d, at: Date.now() })); m.textContent = T('saved1'); m.className = 'hint ok'; freeBox(); return; }
      S.acct.searches.push({ id: 's' + Date.now().toString(36), name: [s.was, s.wo].filter(Boolean).join(' · '), was: s.was, wo: s.wo, r: s.r, d: s.d, cos: s.cos, q: $('#q').value, hideStale: $('#hideStale').checked });
      syncAcct(true).then(function (j) { m.textContent = j && j.ok ? T('savedP') : T('keyBad'); m.className = 'hint ' + (j && j.ok ? 'ok' : 'err'); acctBox(); histBox(); });
    });
    $('#csvB').addEventListener('click', function () {
      if (!paid()) return needPaid('#actMsg');
      dl('stellenangebote-' + J.ymd(Date.now()) + '.csv', J.csv(['Stelle', 'Arbeitgeber', 'Ort', 'km', 'Online seit', 'Tage', 'Merkmale', 'Gehalt', 'Referenznummer', 'Link'], shownRows().map(function (r) { return [r.t, r.co, r.l, r.km == null ? '' : r.km, J.de(r.p), r.age, r.f.join(' '), r.sal, r.src === 'ba' ? r.id : '', r.u]; })));
    });
    $('#coForm').addEventListener('submit', function (e) {
      e.preventDefault(); var m = $('#coMsg');
      if (!paid()) return needPaid('#coMsg');
      var slug = J.slugOf($('#coIn').value); if (!slug) { m.textContent = T('coBad'); m.className = 'hint err'; return; }
      fetch(BASE + '/api/co?s=' + encodeURIComponent(slug)).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) { m.textContent = T('coBad'); m.className = 'hint err'; return; }
        if (S.cur.cos.indexOf(slug) < 0) S.cur.cos.push(slug);
        m.textContent = T('coOk', { co: j.co, n: j.n }); m.className = 'hint ok'; $('#coIn').value = ''; run().then(renderCos);
      });
    });
    $('#logRows').addEventListener('change', function (e) { var x = e.target, i = +x.dataset.i; if (isNaN(i) || !S.log[i]) return; S.log[i][x.dataset.k] = x.value; S.log[i] = J.cleanLog(S.log[i]); saveLog(); render(); });
    $('#logRows').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; S.log.splice(+b.dataset.del, 1); saveLog(); renderLog(); render(); });
    $('#addRow').addEventListener('click', function () { S.log.push(J.cleanLog({ id: 'm' + Date.now().toString(36), d: J.ymd(Date.now()), art: 'online', st: 'offen' })); saveLog(); renderLog(); });
    ['#logFrom', '#logTo'].forEach(function (s) { $(s).addEventListener('change', renderLog); });
    ['#whoName', '#whoNr'].forEach(function (s) { $(s).addEventListener('change', function () { S.who = { name: $('#whoName').value.trim(), kdnr: $('#whoNr').value.trim() }; ls('jbde:who', JSON.stringify(S.who)); if (paid() && S.acct) syncAcct(); }); });
    $('#pdfB').addEventListener('click', function () { if (!paid()) return needPaid('#logMsg'); var w = window.open('', '_blank'); if (!w) return; w.document.write(proofHtml()); w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300); });
    $('#csvLog').addEventListener('click', function () { if (!paid()) return needPaid('#logMsg'); dl('eigenbemuehungen-' + J.ymd(Date.now()) + '.csv', proofCsv()); });
  }
  function start() {
    wire();
    $('#whoName').value = S.who.name || ''; $('#whoNr').value = S.who.kdnr || '';
    var h = /#s=([^&]+)/.exec(location.hash), s0 = null;
    if (h) { try { s0 = JSON.parse(decodeURIComponent(h[1])); } catch (e) {} }
    setLang(LANG);
    setForm(s0 || lj('jbde:s1', null) || { was: 'Buchhalter', wo: 'Köln', r: 25, d: true });
    L.status().then(function (st) {
      S.tier = st.tier || 'free'; S.key = st.key || '';
      if (!paid()) { setLang(LANG); return run(); }
      return post('/api/a/open', { key: S.key }).then(function (j) {
        if (!j.ok) { S.tier = 'free'; setLang(LANG); return run(); }
        S.acct = j.acct; S.who = j.acct.who && (j.acct.who.name || j.acct.who.kdnr) ? j.acct.who : S.who;
        $('#whoName').value = S.who.name || ''; $('#whoNr').value = S.who.kdnr || '';
        var ids = {}; (j.acct.log || []).forEach(function (e) { ids[e.id] = 1; });
        var merged = (j.acct.log || []).concat(S.log.filter(function (e) { return !ids[e.id]; }));
        var grew = merged.length > (j.acct.log || []).length; S.log = merged; ls('jbde:log', JSON.stringify(S.log)); if (grew) syncAcct(true);
        setLang(LANG); return run();
      }, function () { setLang(LANG); return run(); });
    });
  }
  window.JBAPP = { proofHtml: proofHtml, S: S };
  start();
})();
