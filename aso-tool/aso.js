/* aso.js — App-Store-Texte prüfen: Name (30) · Untertitel (30) · Keywords (100).
   One engine for the page (window.ASO), the worker (prepended at deploy) and the node tests (module.exports).
   Characters = Unicode code points. Every rule cites Apple's own page (read 2026-11-25):
     S = developer.apple.com/app-store/search/ · P = developer.apple.com/app-store/product-page/
     V = App Store Connect Help › Platform version information · G = App Review Guidelines (last updated 2026-10-16) */
(function (root) {
  'use strict';
  var LIM = { title: 30, subtitle: 30, keywords: 100, promo: 170, notes: 4000 };
  var STORES = [
    { cc: 'de', loc: 'de-DE', lang: 'de', name: 'Deutschland' },
    { cc: 'us', loc: 'en-US', lang: 'en', name: 'USA' },
    { cc: 'gb', loc: 'en-GB', lang: 'en', name: 'Großbritannien' },
    { cc: 'jp', loc: 'ja', lang: 'ja', name: 'Japan' },
    { cc: 'es', loc: 'es-ES', lang: 'es', name: 'Spanien' },
    { cc: 'mx', loc: 'es-MX', lang: 'es', name: 'Mexiko' },
    { cc: 'br', loc: 'pt-BR', lang: 'pt', name: 'Brasilien' },
    { cc: 'pt', loc: 'pt-PT', lang: 'pt', name: 'Portugal' }
  ];
  var CJK = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/;
  function set(s) { var o = {}; s.split(' ').forEach(function (w) { if (w) o[w] = 1; }); return o; }
  /* S: "Filler words like 'the' and 'to'" — the same kind of word in each language */
  var FILLER = set('the to and a an of for with or in on at by my your ' +
                   'der die das und oder für mit ein eine im in am zu von den dem des ' +
                   'el la los las y o de del para con en un una por ' +
                   'o os as e ou de do da dos das para com em um uma por no na');
  /* S: "Generic terms that are too broad … such as 'app' or 'game'" · P: "the word 'app'" */
  var GENERIC = set('app apps game games iphone ipad アプリ ゲーム');
  /* G 2.3.7: no pricing information in metadata */
  var PRICE = /(^|[^\p{L}\-])(free|for free|gratis|kostenlos|umsonst|gratuito|gratuita|grátis)(?=$|[^\p{L}\-])|無料|0円|(\d+[.,]?\d*\s?(€|\$|円|¥|eur|usd)(?=$|[^\p{L}]))|([€$¥]\s?\d)|(\d+\s?%\s?(off|rabatt|descuento|desconto))/iu;
  /* G 2.3.8 / 5.1.4(b): "For Kids" / "For Children" is reserved for the Kids Category */
  var KIDS = /(for kids|for children|für kinder|para niños|para crianças|子供向け|子ども向け|キッズ向け)/iu;
  /* V: "Names of other apps or companies aren't allowed." · S/P: "Competing app names" (a list of 40 well-known names) */
  var NAMES = ('whatsapp instagram tiktok facebook youtube snapchat telegram spotify netflix chatgpt openai canva capcut ' +
    'duolingo notion uber airbnb amazon google gmail zoom twitter paypal shazam pinterest discord reddit temu shein ' +
    'roblox minecraft fortnite threads linkedin tinder bumble excel photoshop lightroom procreate').split(' ');
  var PLURAL = { de: ['en', 'n', 'e', 'er', 's'], en: ['es', 's'], es: ['es', 's'], pt: ['es', 's'] };

  function str(s) { return s == null ? '' : String(s); }
  function len(s) { return Array.from(str(s)).length; }
  function bytes(s) {
    var n = 0, a = Array.from(str(s));
    for (var i = 0; i < a.length; i++) { var c = a[i].codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
    return n;
  }
  function norm(s) { return str(s).normalize('NFKC').toLowerCase(); }
  function words(s) { return norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean); }
  function isCjk(s) { return CJK.test(str(s)); }
  function uniq(a) { var o = {}, r = []; a.forEach(function (x) { if (!o[x]) { o[x] = 1; r.push(x); } }); return r; }
  function plural(a, b, lang) {          // b is a plural of a (or the other way round) — heuristic, stems of 4+ letters
    var sx = PLURAL[lang] || PLURAL.en;
    if (a === b || isCjk(a) || isCjk(b)) return false;
    function one(x, y) {
      if (len(x) < 4) return false;
      if (lang === 'en' && /y$/.test(x) && y === x.slice(0, -1) + 'ies') return true;
      return sx.some(function (s) { return y === x + s; });
    }
    return one(a, b) || one(b, a);
  }

  /* the language a long text is written in (de en es pt ja) — '' when unsure */
  var LW = {
    en: set('the and you your with for is are to of this that it on from can all more will get'),
    de: set('und der die das ist mit für nicht sie ihre auf ein eine du dein deine ihr wird zu den von im auch oder'),
    es: set('el la los las que con para tu tus es y del una por más como su sus al lo puedes'),
    pt: set('o os as que com para seu sua seus suas é e do da dos das não você mais como um uma ao no na')
  };
  function detectLang(t) {
    t = str(t);
    if ((t.match(/[぀-ヿ]/g) || []).length >= 15) return 'ja';
    var w = words(t); if (w.length < 30) return '';
    var sc = { en: 0, de: 0, es: 0, pt: 0 };
    w.forEach(function (x) { Object.keys(sc).forEach(function (k) { if (LW[k][x]) sc[k]++; }); });
    var ks = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; });
    return sc[ks[0]] >= 8 && sc[ks[0]] >= 1.5 * sc[ks[1]] ? ks[0] : '';
  }

  /* the keyword field exactly as App Store Connect splits it: at ASCII commas */
  function parseKw(raw) {
    var s = str(raw), parts = s.split(','), out = [];
    parts.forEach(function (p, i) {
      var t = p.trim(), one = t.replace(/\s+/g, ' ');
      out.push({ raw: p, t: one, n: norm(one), i: i, pad: len(p) - len(one), comma: i < parts.length - 1 ? 1 : 0 });
    });
    return out;
  }

  /* where a keyword term already sits: name · subtitle · category · company — or '' */
  function ctx(f) {
    var c = { title: str(f.title), sub: str(f.subtitle), cat: str(f.category), co: str(f.seller) }, k = {};
    ['title', 'sub', 'cat', 'co'].forEach(function (x) { k[x] = {}; words(c[x]).forEach(function (w) { k[x][w] = 1; }); });
    c.w = k; c.n = { title: norm(c.title), sub: norm(c.sub), cat: norm(c.cat), co: norm(c.co) };
    return c;
  }
  function sitsIn(t, c) {
    var order = ['title', 'sub', 'cat', 'co'];
    if (isCjk(t)) { var n = norm(t); for (var i = 0; i < order.length; i++) if (c.n[order[i]] && c.n[order[i]].indexOf(n) >= 0) return order[i]; return ''; }
    var tw = words(t); if (!tw.length) return '';
    var all = tw.every(function (w) { return order.some(function (o) { return c.w[o][w]; }); });
    if (!all) return '';
    for (var j = 0; j < order.length; j++) if (c.w[order[j]][tw[0]]) return order[j];
    return 'title';
  }
  function risky(t, c) {
    var n = norm(t);
    if (PRICE.test(n)) return 'price';
    if (words(t).some(function (w) { return NAMES.indexOf(w) >= 0 && !c.w.title[w] && !c.w.co[w]; })) return 'app_name';
    return '';
  }
  function weak(t) {
    var tw = words(t);
    if (tw.length && tw.every(function (w) { return GENERIC[w]; })) return 'generic';
    if (tw.length && tw.every(function (w) { return FILLER[w]; })) return 'filler';
    return '';
  }

  /* check one localization → numbers + issues (codes; the page writes the words) */
  function check(f) {
    f = f || {};
    var title = str(f.title), sub = str(f.subtitle), kw = str(f.keywords), lang = str(f.lang || 'de');
    var tl = len(title), sl = len(sub), kl = len(kw), kb = bytes(kw), c = ctx(f);
    var issues = [];
    function add(sev, field, code, p) { issues.push({ sev: sev, field: field, code: code, p: p || {} }); }

    if (tl > LIM.title) add('bad', 'title', 'over', { n: tl - LIM.title, max: LIM.title });
    if (sl > LIM.subtitle) add('bad', 'subtitle', 'over', { n: sl - LIM.subtitle, max: LIM.subtitle });
    if (kl > LIM.keywords) add('bad', 'keywords', 'over', { n: kl - LIM.keywords, max: LIM.keywords });
    else if (kb > LIM.keywords) add('warn', 'keywords', 'bytes', { n: kb });
    if (!title.trim()) add('bad', 'title', 'empty', {});
    if (!sub.trim()) add('warn', 'subtitle', 'empty', { n: LIM.subtitle });

    /* subtitle words already in the name (Latin words ≥ 3 letters) — the 30 subtitle characters could carry a new word */
    var repeats = [];
    uniq(words(sub)).forEach(function (w) { if (c.w.title[w] && !FILLER[w] && len(w) >= 3 && !isCjk(w)) repeats.push(w); });
    var repeatChars = 0;
    repeats.forEach(function (w) { repeatChars += len(w) + 1; add('tip', 'subtitle', 'repeat_title', { w: w, n: len(w) + 1 }); });

    /* the keyword field */
    var terms = parseKw(kw), live = terms.filter(function (x) { return x.t; }), multi = live.length > 1;
    var hasKw = kw.trim().length > 0, seen = {}, keep = [];
    var w = { spaces: 0, dup: 0, inName: 0, empty: 0 }, riskChars = 0, weakChars = 0;
    if (hasKw) terms.forEach(function (x) {
      w.spaces += x.pad;
      if (!x.t) { if (x.comma || x.i > 0) w.empty += 1; return; }
      var cost = len(x.t) + (multi ? 1 : 0);
      if (seen[x.n]) { w.dup += cost; add('bad', 'keywords', 'dup', { w: x.t, n: cost }); return; }
      seen[x.n] = 1;
      var where = sitsIn(x.t, c);
      if (where) { w.inName += cost; add('bad', 'keywords', where === 'title' ? 'in_name' : where === 'sub' ? 'in_sub' : where === 'cat' ? 'in_category' : 'in_company', { w: x.t, n: cost }); return; }
      var r = risky(x.t, c);
      if (r) { riskChars += cost; add('bad', 'keywords', r, { w: x.t, n: cost }); return; }
      var k = weak(x.t);
      if (k) { weakChars += cost; add('warn', 'keywords', k, { w: x.t, n: cost }); return; }
      keep.push(x.t);
    });
    if (w.spaces) add('bad', 'keywords', 'spaces', { n: w.spaces });
    if (w.empty) add('warn', 'keywords', 'empty_term', { n: w.empty });

    /* kept terms: plurals of words already used (S: "considered duplicates"), parts already in the name, words twice, short terms, # @ */
    var used = Object.keys(c.w.title).concat(Object.keys(c.w.sub), Object.keys(c.w.cat));
    var kwWords = [];
    keep.forEach(function (t) {
      if (isCjk(t)) return;
      var tw = words(t);
      tw.forEach(function (x) {
        var p = used.concat(kwWords).filter(function (u) { return plural(u, x, lang); })[0];
        if (p) add('warn', 'keywords', 'plural', { w: x, of: p, n: len(x) + 1 });
      });
      var part = tw.filter(function (x) { return (c.w.title[x] || c.w.sub[x]) && !FILLER[x] && len(x) >= 3; });
      if (part.length && tw.length > 1) add('tip', 'keywords', 'partial', { w: t, ws: part });
      kwWords = kwWords.concat(tw);
      if (len(t) <= 2) add('warn', 'keywords', 'short_term', { w: t });
      if (/[#@]/.test(t)) add('warn', 'keywords', 'special', { w: t });
    });
    var wc = {};
    kwWords.forEach(function (x) { if (!FILLER[x] && len(x) >= 3) wc[x] = (wc[x] || 0) + 1; });
    Object.keys(wc).forEach(function (x) { if (wc[x] > 1) add('tip', 'keywords', 'word_twice', { w: x, k: wc[x] }); });
    var ideo = (kw.match(/[、，]/g) || []).length;
    if (ideo) add('bad', 'keywords', 'ideo_comma', { n: ideo, terms: live.length, meant: live.length + ideo });
    var otherSep = (kw.match(/[;；|]/g) || []).length;
    if (otherSep) add('warn', 'keywords', 'other_sep', { n: otherSep });

    /* name and subtitle: G 2.3.7 pricing, other apps, G 2.3.8 kids terms */
    [['title', title], ['subtitle', sub]].forEach(function (p) {
      var m = norm(p[1]).match(PRICE);
      if (m) add('bad', p[0], 'price', { w: m[0].replace(/^[^\p{L}\p{N}€$¥]+/u, '') });
      if (p[0] === 'subtitle') words(p[1]).forEach(function (x) { if (NAMES.indexOf(x) >= 0 && !c.w.title[x] && !c.w.co[x]) add('bad', 'subtitle', 'app_name', { w: x }); });
      var kd = str(p[1]).match(KIDS);
      if (kd && !/kids|kinder|niños|crianças|キッズ|子ども|子供/i.test(str(f.category))) add('warn', p[0], 'kids', { w: kd[0] });
    });

    /* the storefront shows another language than its own */
    if (f.dlang && f.dlang !== lang) add('bad', 'store', 'not_localized', { cc: str(f.cc), dl: f.dlang });

    var cleaned = cleanList(kw, title, sub, f).join(',');
    var wastedTotal = w.spaces + w.dup + w.inName + w.empty;
    if (hasKw && kl < LIM.keywords) add('tip', 'keywords', 'left', { n: LIM.keywords - kl });
    if (!hasKw) add('warn', 'keywords', 'none', { n: LIM.keywords });
    var order = { bad: 0, warn: 1, tip: 2 };
    issues.forEach(function (x, i) { x.o = i; });
    issues.sort(function (a, b) { return order[a.sev] - order[b.sev] || a.o - b.o; });
    return {
      lang: lang,
      title: { len: tl, max: LIM.title, left: LIM.title - tl },
      subtitle: { len: sl, max: LIM.subtitle, left: LIM.subtitle - sl, repeats: repeats, repeatChars: repeatChars },
      keywords: { len: kl, bytes: kb, max: LIM.keywords, left: LIM.keywords - kl, terms: live.length, keep: keep.length,
                  wasted: w, wastedTotal: wastedTotal, riskChars: riskChars, weakChars: weakChars,
                  cleaned: cleaned, cleanedLen: len(cleaned), roomAfter: LIM.keywords - len(cleaned), has: hasKw },
      issues: issues,
      risks: issues.filter(function (x) { return /^(price|app_name|kids)$/.test(x.code); }).length,
      bad: issues.filter(function (x) { return x.sev === 'bad'; }).length,
      warn: issues.filter(function (x) { return x.sev === 'warn'; }).length,
      tip: issues.filter(function (x) { return x.sev === 'tip'; }).length,
      nameLeft: Math.max(0, LIM.title - tl) + Math.max(0, LIM.subtitle - sl)
    };
  }

  /* the keyword line App Store Connect should get: commas only, no spaces, no duplicates, nothing already in
     name/subtitle/category/company, no pricing words, no other apps' names, no lone 'app'/'the' */
  function cleanList(kw, title, sub, f) {
    f = f || {};
    var c = ctx({ title: title, subtitle: sub, category: f.category, seller: f.seller }), seen = {}, out = [];
    str(kw).replace(/[、，;；|]/g, ',').split(',').forEach(function (p) {
      var t = p.trim().replace(/\s+/g, ' ').replace(/[#@]/g, '').trim(), n = norm(t);
      if (!t || seen[n]) return;
      seen[n] = 1;
      if (sitsIn(t, c) || risky(t, c) || weak(t)) return;
      out.push(t);
    });
    return out;
  }

  /* cut a keyword list to the limit at term boundaries (never mid-word) */
  function fitKw(list, max) {
    max = max || LIM.keywords; var out = [], n = 0;
    (list || []).forEach(function (t) { var k = len(t) + (out.length ? 1 : 0); if (n + k <= max) { out.push(t); n += k; } });
    return out.join(',');
  }
  /* cut a name/subtitle to the limit at a word boundary */
  function fitText(s, max) {
    s = str(s).trim().replace(/\s+/g, ' ');
    if (len(s) <= max) return s;
    var a = Array.from(s).slice(0, max).join('');
    if (isCjk(a)) return a.replace(/[\s\-–—:：|・,、]+$/, '');
    var cut = a.replace(/[\s\-–—:|·,]+[^\s\-–—:|·,]*$/, '');
    return (len(cut) >= max * 0.5 ? cut : a).replace(/[\s\-–—:|·,]+$/, '');
  }

  /* one release vs the one before (version history) */
  function diff(prev, cur) {
    prev = prev || {}; cur = cur || {};
    var a = {}, b = {}, out = { changed: [], added: [], removed: [] };
    ['title', 'subtitle', 'keywords'].forEach(function (k) { if (str(prev[k]) !== str(cur[k])) out.changed.push(k); });
    str(prev.keywords).split(/[,、，]/).forEach(function (t) { t = t.trim(); if (t) a[norm(t)] = t; });
    str(cur.keywords).split(/[,、，]/).forEach(function (t) { t = t.trim(); if (t) b[norm(t)] = t; });
    Object.keys(b).forEach(function (k) { if (!a[k]) out.added.push(b[k]); });
    Object.keys(a).forEach(function (k) { if (!b[k]) out.removed.push(a[k]); });
    out.kwBefore = len(prev.keywords); out.kwAfter = len(cur.keywords);
    return out;
  }

  /* exports */
  function csvCell(v) { v = str(v); return /[",;\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csv(rows) {
    var head = ['app_id', 'version', 'storefront', 'locale', 'title', 'title_chars', 'subtitle', 'subtitle_chars', 'keywords', 'keyword_chars', 'keyword_chars_wasted', 'keywords_clean', 'whats_new', 'promotional_text', 'saved_at'];
    return [head.join(',')].concat((rows || []).map(function (r) {
      var k = check(r);
      return [r.app, r.version, r.cc, r.loc, r.title, k.title.len, r.subtitle, k.subtitle.len, r.keywords, k.keywords.len, k.keywords.wastedTotal, k.keywords.cleaned, r.notes, r.promo, r.at].map(csvCell).join(',');
    })).join('\r\n') + '\r\n';
  }
  function ascText(rows) {
    return (rows || []).map(function (r) {
      return '=== ' + str(r.loc) + ' (' + str(r.cc) + ')' + (r.version ? ' · Version ' + r.version : '') + ' ===\n' +
        'Name (' + len(r.title) + '/30):\n' + str(r.title) + '\n\n' +
        'Untertitel (' + len(r.subtitle) + '/30):\n' + str(r.subtitle) + '\n\n' +
        'Keywords (' + len(r.keywords) + '/100):\n' + str(r.keywords) + '\n' +
        (r.promo ? '\nWerbetext (' + len(r.promo) + '/170):\n' + str(r.promo) + '\n' : '') +
        (r.notes ? '\nNeuerungen in dieser Version:\n' + str(r.notes) + '\n' : '') +
        (r.post ? '\nLaunch-Post:\n' + str(r.post) + '\n' : '');
    }).join('\n');
  }
  function appId(s) {
    s = str(s).trim();
    var m = s.match(/id(\d{6,12})(?!\d)/i) || s.match(/^(\d{6,12})$/);
    return m ? m[1] : '';
  }

  var ASO = { LIM: LIM, STORES: STORES, len: len, bytes: bytes, norm: norm, words: words, isCjk: isCjk, parseKw: parseKw, check: check,
              cleanList: cleanList, detectLang: detectLang, plural: plural, fitKw: fitKw, fitText: fitText, diff: diff, csv: csv,
              ascText: ascText, appId: appId, NAMES: NAMES };
  if (typeof module === 'object' && module.exports) module.exports = ASO;
  root.ASO = ASO;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
