/* */
(function () {
  'use strict';
  var doc = document, LS = window.localStorage, A = window.ASO;
  var API = 'https://aso-tool.pages.dev';
  var SLUG = 'aso-tool', DOORS = ['aso-tool', 'aso-tool.yearly'];
  var K_KEY = 'aso_tool_key', K_DATA = 'aso_tool_data';
  var pro = false, live = null, last = null;
  var STORE = {}; A.STORES.forEach(function (s) { STORE[s.cc] = s; });
  var LN = { de: 'Deutsch', en: 'Englisch', ja: 'Japanisch', es: 'Spanisch', pt: 'Portugiesisch' };
  var FIELD = { title: 'Name', subtitle: 'Untertitel', keywords: 'Keyword-Feld', store: 'Store' };
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function q(w) { return '„' + esc(w) + '“'; }
  function jget(k, d) { try { return JSON.parse(LS.getItem(k)) || d; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function storeName(cc) { var s = STORE[cc]; return s ? s.name + ' (' + s.loc + ')' : cc; }

  /* the words for each finding (codes come from aso.js) */
  var T = {
    over: function (p, f) { return FIELD[f] + ': ' + p.n + ' Zeichen zu lang. Apple erlaubt höchstens ' + p.max + '.'; },
    empty: function (p, f) { return f === 'subtitle' ? 'Kein Untertitel: 30 Zeichen, die Apple bei der Suche mitliest, bleiben leer.' : 'Der Name fehlt.'; },
    bytes: function (p) { return 'Keyword-Feld: ' + p.n + ' Bytes. Apples Suchseite nennt 100 Zeichen, die App-Store-Connect-Hilfe 100 Bytes; japanische Zeichen zählen 3 Bytes. Speichert App Store Connect das Feld nicht, kürzen Sie auf 100 Bytes.'; },
    repeat_title: function (p) { return q(p.w) + ' steht in Name und Untertitel. Ein neues Wort im Untertitel wäre ein weiterer Suchbegriff (' + p.n + ' Zeichen).'; },
    dup: function (p) { return q(p.w) + ' steht doppelt im Keyword-Feld: ' + p.n + ' Zeichen verschenkt.'; },
    in_name: function (p) { return q(p.w) + ' steht schon im Namen: ' + p.n + ' Zeichen verschenkt. Apple: Wörter aus Name, Untertitel und Kategorie nicht wiederholen.'; },
    in_sub: function (p) { return q(p.w) + ' steht schon im Untertitel: ' + p.n + ' Zeichen verschenkt.'; },
    in_category: function (p) { return q(p.w) + ' ist Ihre Kategorie, die Apple schon durchsucht: ' + p.n + ' Zeichen verschenkt.'; },
    in_company: function (p) { return q(p.w) + ' steht im Firmennamen, den Apple schon durchsucht: ' + p.n + ' Zeichen verschenkt.'; },
    price: function (p, f) { return q(p.w) + (f === 'keywords' ? ' im Keyword-Feld' : ' im ' + FIELD[f]) + ' ist eine Preisangabe. Apple-Regel 2.3.7: keine Preisinformationen in den Metadaten. Streichen' + (p.n ? ' (' + p.n + ' Zeichen).' : '.'); },
    app_name: function (p, f) { return q(p.w) + (f === 'keywords' ? ' im Keyword-Feld' : ' im ' + FIELD[f]) + ' ist der Name einer anderen App oder Firma. Apple: „Names of other apps or companies aren’t allowed.“ Streichen.'; },
    generic: function (p) { return q(p.w) + ' ist zu allgemein. Apple rät von Wörtern wie „app“ oder „game“ ab (' + p.n + ' Zeichen).'; },
    filler: function (p) { return q(p.w) + ' ist ein Füllwort. Apple: Wörter wie „the“ und „to“ bringen nichts (' + p.n + ' Zeichen).'; },
    spaces: function (p) { return p.n + ' Leerzeichen neben Kommas. Apple: Begriffe mit Kommas trennen, ohne Leerzeichen. ' + p.n + ' Zeichen verschenkt.'; },
    empty_term: function (p) { return p.n + ' leere Begriffe (doppelte oder letzte Kommas): ' + p.n + ' Zeichen verschenkt.'; },
    plural: function (p) { return q(p.w) + ' und ' + q(p.of) + ' sind wohl Einzahl und Mehrzahl. Apple zählt Pluralformen als Duplikat (' + p.n + ' Zeichen).'; },
    partial: function (p) { return q(p.w) + ' enthält ' + p.ws.map(q).join(', ') + ' aus Name oder Untertitel. Apple rät, diese Wörter nicht zu wiederholen.'; },
    word_twice: function (p) { return q(p.w) + ' kommt ' + p.k + '-mal in Ihren Keyword-Begriffen vor.'; },
    short_term: function (p) { return q(p.w) + ' ist kürzer als 3 Zeichen. App-Store-Connect-Hilfe: jedes Keyword länger als zwei Zeichen.'; },
    special: function (p) { return q(p.w) + ' enthält # oder @. Apple: Sonderzeichen zählen bei der Suche nicht.'; },
    ideo_comma: function (p) { return p.n + '× „、“ oder „，“ im Keyword-Feld. Apple trennt Begriffe mit Kommas (,). So stehen dort ' + p.terms + ' statt ' + p.meant + ' Begriffe.'; },
    other_sep: function (p) { return p.n + '× „;“ oder „|“ als Trenner. Apple trennt nur mit Kommas.'; },
    kids: function (p) { return q(p.w) + ': Apple-Regel 2.3.8 behält „Für Kinder“ der Kategorie Kinder vor.'; },
    not_localized: function (p) { return 'Im Store ' + esc(storeName(p.cc)) + ' steht Ihre Beschreibung auf ' + (LN[p.dl] || p.dl) + '. Ohne eigene Lokalisierung zeigt Apple dort Ihre Standardsprache.'; },
    left: function (p) { return p.n + ' Zeichen im Keyword-Feld sind noch frei.'; },
    none: function () { return 'Kein Keyword-Feld eingefügt. Es ist privat: kopieren Sie es aus App Store Connect (Version › Keywords).'; }
  };
  var MARK = { bad: '✗', warn: '!', tip: '·' };

  function input() {
    return { title: $('title').value, subtitle: $('subtitle').value, keywords: $('keywords').value, category: $('category').value,
             lang: $('lang').value, seller: $('seller').value,
             dlang: live && live.cc === $('cc').value && live.dlang ? live.dlang : '', cc: live ? live.cc : $('cc').value };
  }
  function bar(label, n, max, extra) {
    var pct = Math.min(100, Math.round(n / max * 100));
    return '<div class="bar' + (n > max ? ' over' : '') + '"><span class="b-l">' + label + ' ' + n + '/' + max + (extra || '') + '</span><span class="b-t"><i style="width:' + pct + '%"></i></span></div>';
  }
  function draw() {
    var f = input(), r = A.check(f), k = r.keywords;
    last = { f: f, r: r };
    var cc = live ? live.cc : $('cc').value;
    $('r-label').textContent = 'Keyword-Feld · ' + storeName(cc);
    if (!k.has) {
      $('r-big').textContent = 'Keyword-Feld fehlt: 100 Zeichen leer';
      $('r-loss').textContent = 'Fügen Sie Ihr Keyword-Feld aus App Store Connect ein; Name und Untertitel sind schon geprüft.';
    } else if (r.issues.some(function (x) { return x.code === 'ideo_comma'; })) {
      var io = r.issues.filter(function (x) { return x.code === 'ideo_comma'; })[0].p;
      $('r-big').textContent = 'Keyword-Feld: ' + io.terms + ' statt ' + io.meant + ' Begriffe';
      $('r-loss').textContent = '„、“ trennt keine Begriffe. Mit Kommas aufgeräumt sind ' + k.roomAfter + ' Zeichen frei.';
    } else {
      $('r-big').textContent = k.wastedTotal + ' von 100 Keyword-Zeichen verschenkt';
      $('r-loss').textContent = k.wastedTotal + k.riskChars + k.weakChars > 0
        ? 'Aufgeräumt sind ' + k.roomAfter + ' Zeichen frei für neue Suchwörter.'
        : 'Nichts doppelt, keine Leerzeichen' + (k.left > 0 ? ', ' + k.left + ' Zeichen sind noch frei.' : ', das Feld ist voll genutzt.');
    }
    $('t-name').textContent = 'Name: ' + r.title.len + ' von 30 Zeichen';
    $('t-sub').textContent = 'Untertitel: ' + r.subtitle.len + ' von 30 Zeichen';
    $('t-risk').textContent = 'Verstöße gegen Regel 2.3.7: ' + r.issues.filter(function (x) { return x.code === 'price' || x.code === 'app_name'; }).length;
    $('t-room').textContent = 'Frei nach dem Aufräumen: ' + (k.has ? k.roomAfter : 100) + ' Zeichen';
    $('t-waste').textContent = 'Verschenkte Keyword-Zeichen: ' + k.wastedTotal;
    $('bars').innerHTML = bar('Name', r.title.len, 30) + bar('Untertitel', r.subtitle.len, 30) + bar('Keywords', k.len, 100, k.bytes !== k.len ? ' · ' + k.bytes + ' Bytes' : '');
    $('fixes').innerHTML = r.issues.map(function (x) {
      var fn = T[x.code]; if (!fn) return '';
      return '<li class="' + x.sev + '"><b>' + MARK[x.sev] + '</b> ' + fn(x.p, x.field) + '</li>';
    }).join('') || '<li class="tip"><b>·</b> Keine Meldung: Name, Untertitel und Keyword-Feld halten Apples Regeln ein.</li>';
    $('clean-h').textContent = 'Aufgeräumtes Keyword-Feld (' + k.cleanedLen + ' von 100 Zeichen)';
    $('clean-v').textContent = k.cleaned || '–';
    ['title', 'subtitle', 'keywords'].forEach(function (id) {
      var n = A.len($(id).value), max = A.LIM[id];
      $('c-' + id).textContent = n + ' / ' + max + (id === 'keywords' && A.bytes($(id).value) !== n ? ' · ' + A.bytes($(id).value) + ' Bytes' : '');
      $('c-' + id).className = 'cnt' + (n > max ? ' over' : '');
    });
  }

  /* live listing (free) */
  function loadLive() {
    var id = A.appId($('appid').value), cc = $('cc').value;
    if (!id) { $('load-msg').textContent = 'Bitte einen App-Store-Link mit „id…“ oder die Zahlen-ID eingeben.'; return; }
    $('load-msg').textContent = 'Lade ' + storeName(cc) + ' …';
    fetch(API + '/api/lookup?id=' + id + '&cc=' + cc).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) {
        $('load-msg').textContent = j && j.err === 'not_found' ? 'Diese App gibt es im Store ' + storeName(cc) + ' nicht.' : j && j.err === 'busy' ? 'Zu viele Abrufe in dieser Minute, bitte gleich noch einmal.' : 'Apple hat gerade nicht geantwortet. Sie können die Texte auch von Hand einfügen.';
        return;
      }
      live = j; fill(j);
      $('load-msg').textContent = 'Geladen: ' + j.title + (j.version ? ' · Version ' + j.version : '') + (j.subtitle === null ? ' · Untertitel nicht gelesen, bitte einfügen' : '') + '. Jetzt Ihr Keyword-Feld einfügen.';
    }).catch(function () { $('load-msg').textContent = 'Keine Verbindung zum Abruf. Sie können die Texte auch von Hand einfügen.'; });
  }
  function fill(j) {
    $('title').value = j.title || '';
    $('subtitle').value = j.subtitle || '';
    $('category').value = j.genre || '';
    $('seller').value = j.seller || '';
    $('lang').value = j.lang || 'de';
    if (j.version) $('ver').value = j.version;
    if (j.notes && !$('notes').value) $('notes').value = String(j.notes).slice(0, 300);
    if ($('keywords').value === EX_KW) $('keywords').value = '';
    $('savecc').value = j.cc;
    if (!$('brand').value) $('brand').value = String(j.title || '').split(/\s+[–—\-|:]\s+|：|:\s+/)[0];
    draw();
  }
  var EX_KW = $('keywords').value;

  /* ---------- Pro ---------- */
  function unlockUI() { pro = true; doc.body.classList.add('is-pro'); $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/aso-tool/'; drawHistory(); }
  function key() { try { return LS.getItem(K_KEY) || ''; } catch (e) { return ''; } }
  function tryKey(k, quiet) {
    k = String(k || '').trim(); if (!k) return;
    if (!quiet) $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/aso-tool/';
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { if (!quiet) $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/aso-tool/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (res) { return res.json(); }).then(function (j) {
        if (j && j.ok) { try { LS.setItem(K_KEY, k); } catch (e) {} unlockUI(); } else next();
      }).catch(next);
    })();
  }
  function need() {
    if (pro) return false;
    $('pro').scrollIntoView({ behavior: 'smooth' });
    $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/aso-tool/';
    return true;
  }

  function loadAll() {
    if (need()) return;
    var id = A.appId($('appid').value);
    if (!id) { $('all-msg').textContent = 'Oben zuerst den App-Store-Link oder die ID eingeben.'; return; }
    $('all-msg').textContent = 'Lade 8 Storefronts …';
    fetch(API + '/api/all?id=' + id + '&key=' + encodeURIComponent(key())).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.rows) { $('all-msg').textContent = j && j.err === 'pro_required' ? ' — Speichern und weitermachen: https://getreadystack.com/de/apps/aso-tool/' : 'Apple hat gerade nicht geantwortet.'; return; }
      var rows = j.rows;
      $('all').innerHTML = '<table class="t"><thead><tr><th>Storefront</th><th>Name</th><th>Untertitel</th><th>Sprache der Beschreibung</th><th>Befund</th><th></th></tr></thead><tbody>' + rows.map(function (x, i) {
        if (!x.ok) return '<tr><td>' + esc(storeName(x.cc)) + '</td><td colspan="5" class="mut">' + (x.err === 'not_found' ? 'nicht in diesem Store' : 'nicht gelesen') + '</td></tr>';
        var c = A.check({ title: x.title, subtitle: x.subtitle || '', keywords: '', lang: x.lang, category: x.genre, seller: x.seller, dlang: x.dlang, cc: x.cc });
        var miss = c.issues.filter(function (y) { return y.sev === 'bad' || y.code === 'empty'; }).map(function (y) { return y.code === 'not_localized' ? 'nicht übersetzt' : y.code === 'empty' && y.field === 'subtitle' ? 'kein Untertitel' : y.code === 'over' ? FIELD[y.field] + ' zu lang' : y.code === 'price' ? 'Preisangabe' : y.code === 'app_name' ? 'fremder App-Name' : ''; }).filter(Boolean);
        if (x.subtitle === null) miss.push('Untertitel nicht gelesen');
        return '<tr' + (miss.length ? ' class="badrow"' : '') + '><td>' + esc(storeName(x.cc)) + '</td><td>' + esc(x.title) + ' <small>' + A.len(x.title) + '/30</small></td><td>' + esc(x.subtitle || '–') + ' <small>' + A.len(x.subtitle || '') + '/30</small></td><td>' + (LN[x.dlang] || '?') + '</td><td>' + (miss.join(', ') || 'in Ordnung') + '</td><td><button type="button" class="ghost use" data-i="' + i + '">Prüfen</button></td></tr>';
      }).join('') + '</tbody></table>';
      $('all').querySelectorAll('button.use').forEach(function (b) { b.addEventListener('click', function () { var x = rows[+b.getAttribute('data-i')]; live = x; $('cc').value = x.cc; fill(x); $('out').scrollIntoView({ behavior: 'smooth' }); }); });
      $('all-msg').textContent = rows.filter(function (x) { return x.ok; }).length + ' von 8 Storefronts gelesen.';
    }).catch(function () { $('all-msg').textContent = 'Keine Verbindung zum Abruf.'; });
  }

  function writeDraft() {
    if (need()) return;
    var f = input(), to = $('to').value;
    if (!f.title.trim()) { $('draft-msg').textContent = 'Oben zuerst den Namen eintragen oder die App laden.'; return; }
    $('draft-msg').textContent = 'Schreibe den Entwurf für ' + storeName(to) + ' …';
    var DEF = { de: 'de-DE', en: 'en-US', ja: 'ja', es: 'es-ES', pt: 'pt-BR' };
    var src = { loc: live && live.lang === f.lang ? live.loc : DEF[f.lang] || f.lang, title: f.title, subtitle: f.subtitle, keywords: f.keywords, desc: live ? live.desc : '',
                notes: $('notes').value || (live ? live.notes : ''), brand: $('brand').value, hint: $('notes').value };
    fetch(API + '/api/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key(), to: to, src: src }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) { $('draft-msg').textContent = j && j.err === 'pro_required' ? ' — Speichern und weitermachen: https://getreadystack.com/de/apps/aso-tool/' : j && j.err === 'busy' ? 'Tageslimit für Entwürfe erreicht, morgen geht es weiter.' : 'Der Entwurf hat nicht geklappt, bitte noch einmal.'; return; }
        var d = j.draft;
        $('draft').innerHTML = '<div class="dr"><p class="dr-h">' + esc(storeName(j.cc)) + ': Entwurf</p>' +
          '<p><b>Name</b> <small>' + A.len(d.title) + '/30</small><br>' + esc(d.title) + '</p>' +
          '<p><b>Untertitel</b> <small>' + A.len(d.subtitle) + '/30</small><br>' + esc(d.subtitle) + '</p>' +
          '<p><b>Keyword-Feld</b> <small>' + A.len(d.keywords) + '/100 · ' + A.bytes(d.keywords) + ' Bytes</small><br><code>' + esc(d.keywords) + '</code></p>' +
          '<p><b>Neuerungen in dieser Version</b><br>' + esc(d.whats_new) + '</p>' +
          '<p><b>Werbetext</b> <small>' + A.len(d.promo) + '/170</small><br>' + esc(d.promo) + '</p>' +
          '<p><b>Launch-Post</b> <small>' + A.len(d.post) + '/280</small><br>' + esc(d.post) + '</p>' +
          '<p class="btns"><button type="button" class="btn" id="dr-use">In die Prüfung übernehmen</button> <button type="button" class="btn ghost" id="dr-copy">Alles kopieren</button></p>' +
          '<p class="hint">Bitte lesen Sie den Entwurf vor dem Einreichen: die KI kennt nur Ihre Texte, nicht Ihre App.</p></div>';
        $('dr-use').addEventListener('click', function () {
          $('title').value = d.title; $('subtitle').value = d.subtitle; $('keywords').value = d.keywords; $('lang').value = j.lang; $('savecc').value = j.cc;
          live = live ? Object.assign({}, live, { cc: j.cc, dlang: '' }) : null; $('cc').value = j.cc; LAST_DRAFT = { cc: j.cc, d: d }; draw(); $('out').scrollIntoView({ behavior: 'smooth' });
        });
        $('dr-copy').addEventListener('click', function () { copy(A.ascText([{ loc: j.loc, cc: j.cc, title: d.title, subtitle: d.subtitle, keywords: d.keywords, promo: d.promo, notes: d.whats_new, post: d.post }]), $('draft-msg')); });
        $('draft-msg').textContent = 'Fertig. Grenzen eingehalten: Name ' + j.check.title + '/30, Untertitel ' + j.check.subtitle + '/30, Keywords ' + j.check.keywords + '/100.';
      }).catch(function () { $('draft-msg').textContent = 'Keine Verbindung zum Entwurf.'; });
  }
  var LAST_DRAFT = null;

  /* version history (browser storage) */
  function data() { return jget(K_DATA, { apps: {} }); }
  function appKey() { return A.appId($('appid').value) || A.norm($('brand').value || $('title').value).slice(0, 40) || 'app'; }
  function saveVersion() {
    if (need()) return;
    var f = input(), d = data(), k = appKey(), cc = $('savecc').value, s = STORE[cc];
    if (!f.title.trim()) { $('x-msg').textContent = 'Ohne Namen gibt es nichts zu speichern.'; return; }
    var app = d.apps[k] || (d.apps[k] = { id: A.appId($('appid').value), name: f.title, rows: [] });
    var extra = LAST_DRAFT && LAST_DRAFT.cc === cc ? LAST_DRAFT.d : {};
    app.name = f.title;
    app.rows.push({ app: app.id || k, version: $('ver').value.trim() || '–', cc: cc, loc: s.loc, lang: f.lang, title: f.title, subtitle: f.subtitle, keywords: f.keywords,
                    category: f.category, seller: f.seller, notes: extra.whats_new || $('notes').value, promo: extra.promo || '', post: extra.post || '', at: new Date().toISOString() });
    jset(K_DATA, d); drawHistory();
    $('x-msg').textContent = 'Gespeichert: ' + f.title + ' · ' + storeName(cc) + ' · Version ' + ($('ver').value.trim() || '–') + '.';
  }
  function drawHistory() {
    var d = data(), keys = Object.keys(d.apps);
    if (!keys.length) { $('history').innerHTML = '<p class="hint">Noch keine Version gespeichert.</p>'; return; }
    $('history').innerHTML = keys.map(function (k) {
      var app = d.apps[k], prevBy = {};
      var items = app.rows.map(function (r, i) {
        var c = A.check(r), p = prevBy[r.cc], df = p ? A.diff(p, r) : null; prevBy[r.cc] = r;
        return '<li>' + esc(storeName(r.cc)) + ' · Version ' + esc(r.version) + ' · ' + esc(r.at.slice(0, 10)) + ': Keywords ' + c.keywords.len + '/100, verschenkt ' + c.keywords.wastedTotal +
          (df ? ' · neu: ' + (df.added.map(esc).join(', ') || '–') + ' · weg: ' + (df.removed.map(esc).join(', ') || '–') + (df.changed.length ? ' · geändert: ' + df.changed.map(function (x) { return FIELD[x]; }).join(', ') : '') : ' · erste gespeicherte Version') +
          ' <button type="button" class="ghost load" data-k="' + esc(k) + '" data-i="' + i + '">Laden</button> <button type="button" class="del" data-k="' + esc(k) + '" data-i="' + i + '" aria-label="Eintrag löschen">×</button></li>';
      }).reverse();
      return '<div class="app"><p class="app-h">' + esc(app.name) + (app.id ? ' <small>ID ' + esc(app.id) + '</small>' : '') + '</p><ul class="hist">' + items.join('') + '</ul></div>';
    }).join('');
    $('history').querySelectorAll('button.load').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = data().apps[b.getAttribute('data-k')].rows[+b.getAttribute('data-i')];
        $('title').value = r.title; $('subtitle').value = r.subtitle; $('keywords').value = r.keywords; $('category').value = r.category || ''; $('seller').value = r.seller || '';
        $('lang').value = r.lang; $('ver').value = r.version === '–' ? '' : r.version; $('savecc').value = r.cc; live = null; $('cc').value = r.cc; draw();
        $('out').scrollIntoView({ behavior: 'smooth' });
      });
    });
    $('history').querySelectorAll('button.del').forEach(function (b) {
      b.addEventListener('click', function () {
        var d2 = data(), k = b.getAttribute('data-k'); d2.apps[k].rows.splice(+b.getAttribute('data-i'), 1);
        if (!d2.apps[k].rows.length) delete d2.apps[k];
        jset(K_DATA, d2); drawHistory();
      });
    });
  }
  function allRows() { var d = data(), out = []; Object.keys(d.apps).forEach(function (k) { out = out.concat(d.apps[k].rows); }); return out; }
  function latestPerStore() {
    var d = data(), k = appKey(), app = d.apps[k], by = {};
    (app ? app.rows : []).forEach(function (r) { by[r.cc] = r; });
    return Object.keys(by).map(function (c) { return by[c]; });
  }
  function download(name, type, text) {
    var b = new Blob([text], { type: type }), a = doc.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportAsc() {
    if (need()) return;
    var rows = latestPerStore();
    if (!rows.length) { var f = input(), cc = $('savecc').value; rows = [{ loc: STORE[cc].loc, cc: cc, version: $('ver').value, title: f.title, subtitle: f.subtitle, keywords: A.check(f).keywords.cleaned || f.keywords, notes: $('notes').value }]; }
    download('app-store-connect-' + appKey() + '.txt', 'text/plain;charset=utf-8', A.ascText(rows));
    $('x-msg').textContent = 'Textdatei mit ' + rows.length + ' Sprache(n) gespeichert.';
  }
  function exportCsv() {
    if (need()) return;
    var rows = allRows(); if (!rows.length) { $('x-msg').textContent = 'Erst eine Version speichern.'; return; }
    download('aso-versionen.csv', 'text/csv;charset=utf-8', '﻿' + A.csv(rows));
    $('x-msg').textContent = 'CSV mit ' + rows.length + ' Zeilen gespeichert.';
  }
  function exportJson() {
    if (need()) return;
    download('aso-tool-sicherung.json', 'application/json', JSON.stringify({ kind: 'aso-tool-backup', v: 1, at: new Date().toISOString(), data: data() }, null, 1));
    $('x-msg').textContent = 'Sicherung gespeichert.';
  }
  function importJson(ev) {
    if (need()) { ev.target.value = ''; return; }
    var file = ev.target.files && ev.target.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var j = JSON.parse(rd.result), inc = j && j.kind === 'aso-tool-backup' ? j.data : null;
        if (!inc || !inc.apps) throw new Error('kind');
        var d = data(), n = 0;
        Object.keys(inc.apps).forEach(function (k) {
          var a = d.apps[k] || (d.apps[k] = { id: inc.apps[k].id, name: inc.apps[k].name, rows: [] }), seen = {};
          a.rows.forEach(function (r) { seen[r.at + r.cc] = 1; });
          (inc.apps[k].rows || []).forEach(function (r) { if (!seen[r.at + r.cc]) { a.rows.push(r); n++; } });
          a.rows.sort(function (x, y) { return x.at < y.at ? -1 : 1; });
        });
        jset(K_DATA, d); drawHistory(); $('x-msg').textContent = n + ' Einträge aus der Sicherung übernommen.';
      } catch (e) { $('x-msg').textContent = 'Diese Datei ist keine Sicherung des ASO Tools.'; }
      ev.target.value = '';
    };
    rd.readAsText(file);
  }

  function copy(text, msg) {
    function ok() { if (msg) msg.textContent = 'Kopiert.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, fallback); } else fallback();
    function fallback() { var t = doc.createElement('textarea'); t.value = text; doc.body.appendChild(t); t.select(); try { doc.execCommand('copy'); ok(); } catch (e) {} t.remove(); }
  }

  /* wire up */
  ['title', 'subtitle', 'keywords', 'category', 'lang', 'seller'].forEach(function (id) { $(id).addEventListener('input', draw); $(id).addEventListener('change', draw); });
  $('cc').addEventListener('change', function () { var s = STORE[$('cc').value]; if (s) $('lang').value = s.lang; draw(); });
  $('load').addEventListener('click', loadLive);
  $('appid').addEventListener('keydown', function (e) { if (e.key === 'Enter') loadLive(); });
  $('copy-clean').addEventListener('click', function () { copy($('clean-v').textContent, $('copy-msg')); });
  $('key-go').addEventListener('click', function () { tryKey($('key').value); });
  $('all-go').addEventListener('click', loadAll);
  $('draft-go').addEventListener('click', writeDraft);
  $('save').addEventListener('click', saveVersion);
  $('x-asc').addEventListener('click', exportAsc);
  $('x-csv').addEventListener('click', exportCsv);
  $('x-json').addEventListener('click', exportJson);
  $('x-in').addEventListener('change', importJson);

  draw();
  var h = /[#&]k=([^&]+)/.exec(location.hash || '');
  if (h) { $('key').value = decodeURIComponent(h[1]); tryKey(decodeURIComponent(h[1])); }
  else if (key()) tryKey(key(), true);
  drawHistory();
  if (typeof window !== 'undefined') window.ASO_APP = { draw: draw, check: function () { return last; } };
})();
