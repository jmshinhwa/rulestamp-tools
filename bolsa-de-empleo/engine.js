// engine.js — the job engine of "bolsa de empleo España" (shared by the page and the worker). Spain edition, built from the en sibling 2026-11-18.
// Reads the public job-board feeds of Greenhouse, Lever, Ashby, Workable, Teamtailor (jobs.rss), Recruitee and SmartRecruiters (country=es), turns them into one row shape,
// and marks each row: first-posted age, new / stale, re-dated (old posting with a fresh update date), listed N× (same title + place
// at one company), reposted (same title + place closed earlier, from our dated snapshots). No AI, no guessing: every date is the ATS's own.
(function (g) {
  'use strict';
  var DAY = 864e5;
  var ATS = { g: 'greenhouse', l: 'lever', a: 'ashby', w: 'workable', t: 'teamtailor', r: 'recruitee', s: 'smartrecruiters' };
  function feedUrl(a, s) {
    s = encodeURIComponent(s);
    if (a === 'g') return 'https://boards-api.greenhouse.io/v1/boards/' + s + '/jobs';
    if (a === 'l') return 'https://api.lever.co/v0/postings/' + s + '?mode=json';
    if (a === 'a') return 'https://api.ashbyhq.com/posting-api/job-board/' + s + '?includeCompensation=true';
    if (a === 'w') return 'https://apply.workable.com/api/v1/widget/accounts/' + s;
    if (a === 't') return 'https://' + s + '.teamtailor.com/jobs.rss';
    if (a === 'r') return 'https://' + s + '.recruitee.com/api/offers/';
    if (a === 's') return 'https://api.smartrecruiters.com/v1/companies/' + s + '/postings?limit=100&country=es';
    return '';
  }
  function careersUrl(a, s) {
    if (a === 't') return 'https://' + s + '.teamtailor.com/jobs';
    if (a === 'r') return 'https://' + s + '.recruitee.com/';
    return { g: 'https://job-boards.greenhouse.io/', l: 'https://jobs.lever.co/', a: 'https://jobs.ashbyhq.com/', w: 'https://apply.workable.com/', s: 'https://jobs.smartrecruiters.com/' }[a] + s;
  }
  // "gh:stripe", "g:stripe" or any careers URL of the four ATS → {a, s} (null when it is none of them)
  function parseBoard(x) {
    x = String(x || '').trim(); var m;
    if ((m = /^(g|gh|greenhouse|l|lever|a|ashby|w|workable|t|teamtailor|r|recruitee|s|smartrecruiters):([A-Za-z0-9._-]{1,80})$/i.exec(x))) return { a: m[1].charAt(0).toLowerCase(), s: m[2].toLowerCase() };
    var u; try { u = new URL(/^https?:\/\//i.test(x) ? x : 'https://' + x); } catch (e) { return null; }
    var h = u.hostname.toLowerCase(), p = u.pathname.split('/').filter(Boolean), q = u.searchParams;
    function ok(s) { return s && /^[A-Za-z0-9._-]{1,80}$/.test(s) ? s.toLowerCase() : null; }
    var s;
    if (/(^|\.)greenhouse\.io$/.test(h)) {
      if (h === 'boards-api.greenhouse.io') s = ok(p[2]);
      else s = ok(q.get('for')) || ok(p[0] === 'embed' ? q.get('for') : p[0]);
      return s ? { a: 'g', s: s } : null;
    }
    if (/(^|\.)lever\.co$/.test(h)) { s = ok(h.indexOf('api.') === 0 ? p[2] : p[0]); return s ? { a: 'l', s: s } : null; }
    if (/(^|\.)ashbyhq\.com$/.test(h)) { s = ok(h.indexOf('api.') === 0 ? p[2] : p[0]); return s ? { a: 'a', s: s } : null; }
    if (h === 'apply.workable.com') { s = ok(p[0] === 'api' ? p[4] : p[0]); return s && s !== 'j' ? { a: 'w', s: s } : null; }
    if (/^[a-z0-9-]+\.workable\.com$/.test(h) && h !== 'www.workable.com') return { a: 'w', s: h.split('.')[0] };
    if (/^[a-z0-9-]+\.teamtailor\.com$/.test(h) && !/^(www|app|career|api)\./.test(h)) return { a: 't', s: h.split('.')[0] };
    if (/^[a-z0-9-]+\.recruitee\.com$/.test(h) && !/^(www|app|api)\./.test(h)) return { a: 'r', s: h.split('.')[0] };
    if (/(^|\.)smartrecruiters\.com$/.test(h)) { s = ok(h.indexOf('api.') === 0 ? p[2] : p[0]); return s && s !== 'oneclick-ui' ? { a: 's', s: s } : null; }
    return null;
  }
  // country codes from a location text (plus the ATS's own country field)
  var US_ST = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';
  var CC = [
    ['US', new RegExp('\\b(united states|usa|u\\.s\\.|us-?remote|remote[ ,(-]+us\\b|new york|nyc|san francisco|seattle|austin|boston|chicago|los angeles|denver|atlanta|miami|washington|palo alto|mountain view|menlo park|sunnyvale|san jose|san mateo|redwood city|brooklyn|pittsburgh|philadelphia|portland|salt lake|dallas|houston|phoenix|nashville|raleigh|minneapolis|detroit|san diego|irvine|hawthorne|starbase|cape canaveral|bastrop|redmond|bellevue)\\b|,\\s*(' + US_ST + ')\\b', 'i')],
    ['CA', /\b(canada|toronto|vancouver|montr[eé]al|ottawa|calgary|waterloo|ontario|british columbia|quebec)\b/i],
    ['GB', /\b(united kingdom|uk|england|scotland|london|manchester|edinburgh|cambridge, uk|bristol|leeds|glasgow|belfast)\b/i],
    ['IE', /\b(ireland|dublin|cork)\b/i],
    ['DE', /\b(germany|deutschland|berlin|munich|m[uü]nchen|hamburg|frankfurt|cologne|k[oö]ln|stuttgart|d[uü]sseldorf|leipzig)\b/i],
    ['AT', /\b(austria|[oö]sterreich|vienna|wien)\b/i],
    ['CH', /\b(switzerland|schweiz|zurich|z[uü]rich|geneva|gen[eè]ve|lausanne|basel)\b/i],
    ['FR', /\b(france|paris|lyon|nantes|bordeaux|toulouse|lille)\b/i],
    ['ES', /\b(spain|espa[nñ]a|madrid|barcelona|valencia|sevilla|seville|m[aá]laga|bilbao)\b/i],
    ['PT', /\b(portugal|lisbon|lisboa|porto)\b/i],
    ['NL', /\b(netherlands|amsterdam|rotterdam|utrecht|the hague|eindhoven)\b/i],
    ['PL', /\b(poland|warsaw|krak[oó]w|wroc[lł]aw)\b/i],
    ['IT', /\b(italy|milan|milano|rome|roma|turin)\b/i],
    ['SE', /\b(sweden|stockholm|gothenburg)\b/i],
    ['DK', /\b(denmark|copenhagen)\b/i],
    ['FI', /\b(finland|helsinki|espoo)\b/i],
    ['BR', /\b(brazil|brasil|s[aã]o paulo|rio de janeiro|curitiba|belo horizonte|florian[oó]polis|porto alegre)\b/i],
    ['MX', /\b(mexico|m[eé]xico|cdmx|guadalajara|monterrey)\b/i],
    ['AR', /\b(argentina|buenos aires)\b/i],
    ['CO', /\b(colombia|bogot[aá]|medell[ií]n)\b/i],
    ['CL', /\b(chile|santiago)\b/i],
    ['JP', /\b(japan|tokyo|osaka|kyoto|fukuoka|日本|東京)\b|東京|大阪/i],
    ['KR', /\b(korea|seoul)\b/i],
    ['SG', /\b(singapore)\b/i],
    ['IN', /\b(india|bengaluru|bangalore|hyderabad|mumbai|pune|chennai|gurgaon|gurugram|new delhi|noida)\b/i],
    ['AU', /\b(australia|sydney|melbourne|brisbane|perth)\b/i],
    ['IL', /\b(israel|tel aviv|herzliya|jerusalem)\b/i]
  ];
  var ISO3 = { USA: 'US', GBR: 'GB', DEU: 'DE', ESP: 'ES', PRT: 'PT', BRA: 'BR', JPN: 'JP', FRA: 'FR', CAN: 'CA', IRL: 'IE', NLD: 'NL', MEX: 'MX', IND: 'IN', AUS: 'AU', SGP: 'SG' };
  var CNAME = { 'UNITED STATES': 'US', 'UNITED KINGDOM': 'GB', GERMANY: 'DE', SPAIN: 'ES', PORTUGAL: 'PT', BRAZIL: 'BR', JAPAN: 'JP', FRANCE: 'FR', CANADA: 'CA', IRELAND: 'IE', NETHERLANDS: 'NL', MEXICO: 'MX', INDIA: 'IN', AUSTRALIA: 'AU', SINGAPORE: 'SG' };
  function countries(loc, extra) {
    var out = {}, s = String(loc || '');
    CC.forEach(function (c) { if (c[1].test(s)) out[c[0]] = 1; });
    (extra || []).forEach(function (x) {
      x = String(x || '').trim().toUpperCase(); if (!x) return;
      var c = x.length === 2 ? x : (ISO3[x] || CNAME[x] || ''); if (c === 'UK') c = 'GB';
      if (/^[A-Z]{2}$/.test(c)) out[c] = 1;
    });
    return Object.keys(out).join(',');
  }
  // Spanish city of a location text ('' when none is named) — the city filter of the Spain edition
  var CITY = [['Madrid', /madrid|alcobendas|las rozas|pozuelo|getafe|legan[eé]s|tres cantos|alcal[aá] de henares|majadahonda|boadilla/i], ['Barcelona', /barcelona|sant cugat|l'?hospitalet|badalona|terrassa|sabadell|matar[oó]|cornell[aà]|el prat|castelldefels|granollers/i],
    ['Valencia', /val[eè]ncia|paterna/i], ['Sevilla', /sevilla|seville|dos hermanas/i], ['Málaga', /m[aá]laga|marbella|torremolinos|benalm[aá]dena/i], ['Bilbao', /bilbao|bizkaia|vizcaya|barakaldo|getxo/i], ['Zaragoza', /zaragoza/i],
    ['Alicante', /alicante|alacant|elche|elx|benidorm/i], ['Palma', /palma|mallorca|baleares|balears|ibiza|menorca/i], ['Murcia', /murcia|cartagena/i], ['Valladolid', /valladolid/i], ['Vigo', /vigo|pontevedra/i], ['A Coruña', /coru[nñ]a|arteixo|santiago de compostela/i],
    ['Granada', /granada/i], ['San Sebastián', /san sebasti[aá]n|donostia|gipuzkoa|guip[uú]zcoa/i], ['Canarias', /las palmas|gran canaria|tenerife|canarias|canary/i], ['Pamplona', /pamplona|navarra/i], ['Santander', /santander|cantabria/i],
    ['Asturias', /oviedo|gij[oó]n|asturias/i], ['Córdoba', /c[oó]rdoba(?!,? *argentina)/i], ['Cádiz', /c[aá]diz|jerez|algeciras/i], ['Tarragona', /tarragona|reus/i], ['Girona', /girona|gerona/i], ['Lleida', /lleida|l[eé]rida/i],
    ['Castellón', /castell[oó]n/i], ['Salamanca', /salamanca/i], ['Burgos', /burgos/i], ['Almería', /almer[ií]a/i], ['Huelva', /huelva/i], ['Badajoz', /badajoz|m[eé]rida/i], ['Logroño', /logro[nñ]o|la rioja/i], ['Vitoria', /vitoria|gasteiz|[aá]lava/i], ['Toledo', /toledo/i], ['León', /\ble[oó]n\b(?!,? *(mexico|m[eé]xico|gto|guanajuato))/i]];
  function cityOf(l) { var s = String(l || ''); for (var i = 0; i < CITY.length; i++) if (CITY[i][1].test(s)) return CITY[i][0]; return ''; }
  function xmlText(s) { return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&'); }
  function tag(x, t) { var m = new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>').exec(x); return m ? xmlText(m[1]).trim() : ''; }
  function ms(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
    var t = Date.parse(v); return isNaN(t) ? 0 : t;
  }
  function S(v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 200); }
  function money(min, max, cur, per) {
    if (!min && !max) return '';
    function f(n) { return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n); }
    return S((cur || '') + ' ' + (min ? f(min) : '') + (max && max !== min ? '–' + f(max) : '') + (per ? ' / ' + String(per).toLowerCase().replace(/^per[- ]?/, '') : ''), 60);
  }
  // raw feed JSON → rows {id,t,l,u,p,d,r,$,c,dp}
  function normalize(a, raw) {
    var rows = [];
    try {
      if (a === 'g') (raw.jobs || []).forEach(function (j) {
        var l = S(j.location && j.location.name, 160);
        rows.push({ id: String(j.id), t: S(j.title), l: l, u: S(j.absolute_url, 400), p: ms(j.first_published), d: ms(j.updated_at), r: /remote/i.test(l) ? 1 : 0, $: '', c: countries(l), dp: '' });
      });
      else if (a === 'l') (Array.isArray(raw) ? raw : []).forEach(function (j) {
        var c = j.categories || {}, l = S((c.allLocations && c.allLocations.length ? c.allLocations.join(' · ') : c.location), 160), sr = j.salaryRange;
        rows.push({ id: String(j.id), t: S(j.text), l: l, u: S(j.hostedUrl, 400), p: ms(j.createdAt), d: 0, r: (j.workplaceType === 'remote' || /remote/i.test(l)) ? 1 : 0,
          $: sr ? money(sr.min, sr.max, sr.currency, sr.interval) : '', c: countries(l, [j.country]), dp: S(c.team || c.department, 60) });
      });
      else if (a === 'a') (raw.jobs || []).forEach(function (j) {
        if (j.isListed === false) return;
        var locs = [j.location].concat((j.secondaryLocations || []).map(function (x) { return x && x.location; })).filter(Boolean);
        var l = S(locs.join(' · '), 160), pa = j.address && j.address.postalAddress, comp = j.compensation;
        rows.push({ id: String(j.id), t: S(j.title), l: l, u: S(j.jobUrl, 400), p: ms(j.publishedAt), d: 0, r: (j.isRemote || j.workplaceType === 'Remote' || /remote/i.test(l)) ? 1 : 0,
          $: S(comp && (comp.scrapeableCompensationSalarySummary || comp.compensationTierSummary), 60), c: countries(l, [pa && pa.addressCountry]), dp: S(j.department || j.team, 60) });
      });
      else if (a === 'w') (raw.jobs || []).forEach(function (j) {
        var locs = (j.locations && j.locations.length ? j.locations : [{ city: j.city, country: j.country, countryCode: j.country_code }]);
        var l = S(locs.map(function (x) { return [x.city, x.country].filter(Boolean).join(', '); }).join(' · '), 160);
        rows.push({ id: String(j.shortcode || j.id), t: S(j.title), l: l || (j.telecommuting ? 'Remote' : ''), u: S(j.url || j.shortlink, 400), p: ms(j.published_on || j.created_at), d: 0,
          r: j.telecommuting ? 1 : 0, $: '', c: countries(l, locs.map(function (x) { return x.countryCode || x.country; })), dp: S(j.department, 60) });
      });
      else if (a === 't') String(raw || '').split('<item>').slice(1).forEach(function (it) {   // Teamtailor jobs.rss (text)
        it = it.replace(/<description>[\s\S]*?<\/description>/, '');
        var locs = it.split('<tt:location>').slice(1).map(function (x) { return [tag(x, 'tt:city'), tag(x, 'tt:country')].filter(Boolean).join(', '); }).filter(Boolean);
        var l = S(locs.join(' · '), 160), rs = tag(it, 'remoteStatus'), u = tag(it, 'link');
        rows.push({ id: S(tag(it, 'guid') || u, 80), t: S(tag(it, 'title')), l: l || (rs === 'fully' ? 'Remote' : ''), u: S(u, 400), p: ms(tag(it, 'pubDate')), d: 0, r: (rs === 'fully' || /remote/i.test(l)) ? 1 : 0,
          $: '', c: countries(l + ' ' + tag(it, 'title')), dp: S(tag(it, 'tt:department'), 60) });
      });
      else if (a === 'r') (raw.offers || []).forEach(function (j) {   // Recruitee
        var l = S(j.location || [j.city, j.country].filter(Boolean).join(', '), 160);
        rows.push({ id: String(j.id), t: S(j.title), l: l, u: S(j.careers_url, 400), p: ms(String(j.published_at || j.created_at || '').replace(' UTC', 'Z').replace(' ', 'T')), d: 0,
          r: (j.remote || /remote/i.test(l)) ? 1 : 0, $: '', c: countries(l, [j.country_code]), dp: S(j.department, 60) });
      });
      else if (a === 's') (raw.content || []).forEach(function (j) {   // SmartRecruiters (asked with country=es)
        var lo = j.location || {}, l = S(lo.fullLocation || [lo.city, lo.region, lo.country].filter(Boolean).join(', '), 160), co = (j.company && j.company.identifier) || '';
        rows.push({ id: String(j.id), t: S(j.name), l: l, u: 'https://jobs.smartrecruiters.com/' + encodeURIComponent(co) + '/' + encodeURIComponent(j.id), p: ms(j.releasedDate), d: 0,
          r: lo.remote ? 1 : 0, $: '', c: countries(l, [lo.country]), dp: S(j.department && j.department.label || j['function'] && j['function'].label, 60) });
      });
    } catch (e) {}
    rows.forEach(function (r) { r.ci = cityOf(r.l); });
    return rows.filter(function (r) { return r.id && r.t && r.u; });
  }
  function norm(t) { t = String(t || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {} return t.replace(/[^a-z0-9À-ɏ぀-ヿ一-鿿]+/g, ' ').trim(); }
  function sig(r) { return norm(r.t) + '|' + norm(r.l); }
  // marks on every row (rows carry .co = company key); closed = {co: [[sig, closedAt, firstSeen]]} from our snapshots
  function annotate(rows, now, closed, ag) {
    var cnt = {};
    rows.forEach(function (r) { var k = r.co + '#' + sig(r); cnt[k] = (cnt[k] || 0) + 1; });
    rows.forEach(function (r) {
      r.age = r.p ? Math.max(0, Math.floor((now - r.p) / DAY)) : null;
      r.f = [];
      if (r.p && now - r.p < DAY) r.f.push('new');
      else if (r.p && now - r.p < 7 * DAY) r.f.push('week');
      if (r.age != null && r.age > 60) r.f.push('stale');
      if (ag && ag[r.co]) r.f.push('ett');
      if (r.p && r.d && r.d - r.p >= 30 * DAY && now - r.d <= 14 * DAY) r.f.push('redated');
      r.n = cnt[r.co + '#' + sig(r)]; if (r.n > 1) r.f.push('dup');
      var cl = closed && closed[r.co], s = sig(r);
      if (cl) for (var i = 0; i < cl.length; i++) if (cl[i][0] === s && cl[i][1] <= (r.fs || r.p || now)) { r.rp = cl[i][1]; r.f.push('repost'); break; }
    });
    return rows;
  }
  // keyword: all words must match · "a|b" = either · "-word" = exclude
  function matchQ(r, q) {
    var hay = norm(r.t + ' ' + r.dp + ' ' + r.l);
    var parts = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.charAt(0) === '-' && p.length > 1) { if (hay.indexOf(norm(p.slice(1))) >= 0) return false; continue; }
      var alts = p.split('|').map(norm).filter(Boolean);
      if (alts.length && !alts.some(function (x) { return hay.indexOf(x) >= 0; })) return false;
    }
    return true;
  }
  // f = {q, cc ('' | 'US' | 'EU' | 'LATAM' | code), ci (Spanish city or ''), remote (bool), within (days or 0), hideStale, hideRedated, hideEtt}
  var REG = { EU: 'DE,AT,CH,FR,ES,PT,NL,PL,IT,SE,DK,FI,IE', LATAM: 'BR,MX,AR,CO,CL' };
  function filter(rows, f) {
    f = f || {}; var want = f.cc ? (REG[f.cc] || f.cc).split(',') : null;
    return rows.filter(function (r) {
      if (f.q && !matchQ(r, f.q)) return false;
      if (f.remote && !r.r) return false;
      if (f.ci && r.ci !== f.ci && !(f.ciRemote && r.r)) return false;
      if (f.hideEtt && r.f.indexOf('ett') >= 0) return false;
      if (want) { var c = (r.c || '').split(','); if (!want.some(function (x) { return c.indexOf(x) >= 0; })) return false; }
      if (f.within && (r.age == null || r.age >= f.within)) return false;
      if (f.hideStale && r.f.indexOf('stale') >= 0) return false;
      if (f.hideRedated && (r.f.indexOf('redated') >= 0 || r.f.indexOf('repost') >= 0)) return false;
      return true;
    });
  }
  function sortRows(rows, by) {
    return rows.sort(by === 'co' ? function (a, b) { return a.co < b.co ? -1 : a.co > b.co ? 1 : (b.p - a.p); } : function (a, b) { return (b.p || 0) - (a.p || 0); });
  }
  function stats(rows) {
    var s = { open: rows.length, cos: {}, n24: 0, n7: 0, stale: 0, redated: 0, dup: 0, repost: 0, remote: 0, ett: 0 };
    rows.forEach(function (r) {
      s.cos[r.co] = 1; if (r.r) s.remote++;
      r.f.forEach(function (x) { if (x === 'new') { s.n24++; s.n7++; } else if (x === 'week') s.n7++; else if (s[x] != null) s[x]++; });
    });
    s.cos = Object.keys(s.cos).length; return s;
  }
  function day(t) { return t ? new Date(t).toISOString().slice(0, 10) : ''; }
  function csv(rows, names) {
    function q(v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var h = ['empresa', 'puesto', 'ubicacion', 'ciudad', 'paises', 'remoto', 'publicada', 'dias_abierta', 'actualizada_ats', 'vista_por_nosotros', 'avisos', 'veces_publicada', 'republicada_tras_cierre', 'salario', 'url_candidatura'];
    return h.join(',') + '\n' + rows.map(function (r) {
      return [names && names[r.co] || r.co, r.t, r.l, r.ci, r.c, r.r ? 'si' : '', day(r.p), r.age, day(r.d), day(r.fs), r.f.join(' '), r.n, day(r.rp), r.$, r.u].map(q).join(',');
    }).join('\n') + '\n';
  }
  // BOE open-data sumario JSON → section II.B (Oposiciones y concursos) items {id, t, dep, ep, u, pdf, day}
  function arr(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
  function boe(raw, day) {
    var out = [];
    try {
      arr(raw && raw.data && raw.data.sumario && raw.data.sumario.diario).forEach(function (di) {
        arr(di.seccion).forEach(function (sec) {
          if (sec.codigo !== '2B') return;
          arr(sec.departamento).forEach(function (dep) {
            function add(it, ep) { if (it && it.identificador) out.push({ id: S(it.identificador, 40), t: S(it.titulo, 600), dep: S(dep.nombre, 160), ep: S(ep, 100), u: S(it.url_html, 300), pdf: S(it.url_pdf && it.url_pdf.texto || it.url_pdf, 300), day: day || '' }); }
            arr(dep.item).forEach(function (it) { add(it, ''); });
            arr(dep.epigrafe).forEach(function (ep) { arr(ep.item).forEach(function (it) { add(it, ep.nombre); }); });
          });
        });
      });
    } catch (e) {}
    return out;
  }
  function boeMatch(it, q) { return matchQ({ t: it.t + ' ' + it.ep, dp: it.dep, l: '' }, q); }
  g.JB = { DAY: DAY, boe: boe, boeMatch: boeMatch, ATS: ATS, feedUrl: feedUrl, careersUrl: careersUrl, parseBoard: parseBoard, countries: countries, normalize: normalize, norm: norm, sig: sig,
    annotate: annotate, matchQ: matchQ, filter: filter, sortRows: sortRows, stats: stats, csv: csv, day: day, REG: REG, cityOf: cityOf, CITIES: CITY.map(function (c) { return c[0]; }), tag: tag };
})(typeof globalThis !== 'undefined' ? globalThis : this);
