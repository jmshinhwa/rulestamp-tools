/* lead generation on Reddit - thread scorer + lead tracker. Browser-only: nothing leaves this browser (localStorage).
   Engine (parse · score · summarize · csv · ics) is pure and runs in node for tests; the page part runs only in a browser. */
(function (root) {
  'use strict';
  var SLUG = 'lead-generation-reddit-thread-scorer';
  var DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];

  /* ---------- phrases (all languages are always read: a German thread is scored in German) ---------- */
  var ASK = [ // someone is asking for a tool / service = buying intent
    ['en', /\blooking for (an?|some|the)?\s*\w*/i], ['en', /\bany (good )?(recommendations?|recs|suggestions?)\b/i], ['en', /\b(can (you|anyone) )?recommend\b/i],
    ['en', /\balternatives? (to|for)\b/i], ['en', /\bwhat do (you|y'?all|people) use\b/i], ['en', /\bwhat('?s| is) (everyone|everybody|the best)\b/i],
    ['en', /\b(best|good) (tool|app|software|service|platform|way) (for|to)\b/i], ['en', /\bis there (an?|any) (tool|app|software|service|plugin|way)\b/i],
    ['en', /\b(need|want) (an?|some) (tool|app|software|service|plugin)\b/i], ['en', /\bwilling to pay\b/i], ['en', /\bhappy to pay\b/i], ['en', /\bswitching (from|away|this)\b/i],
    ['en', /\bwhich (tool|app|software|service)\b/i],
    ['de', /\b(ich )?suche (eine?n?|nach)\b/i], ['de', /\bempfehlung(en)?\b/i], ['de', /\balternative zu\b/i], ['de', /\bwelche[sn]? (tool|app|software|programm)\b/i], ['de', /\bgibt es (ein|eine)\b/i],
    ['es', /\bbusco\b/i], ['es', /\b(me )?recomiendan\b/i], ['es', /\brecomendaci(ó|o)n(es)?\b/i], ['es', /\balternativa a\b/i], ['es', /\bqu(é|e) (herramienta|app|programa)\b/i],
    ['pt', /\bprocuro\b/i], ['pt', /\b(algu(é|e)m )?indica\b/i], ['pt', /\brecomendam\b/i], ['pt', /\balternativa (ao|à|a)\b/i], ['pt', /\bqual (ferramenta|app|aplicativo|programa)\b/i],
    ['ja', /おすすめ|オススメ/], ['ja', /探して(い|る)/], ['ja', /代わり(に|の)/]
  ];
  var PAIN = [ // the problem is hurting now
    ['en', /\b(frustrated|tired of|sick of|fed up)\b/i], ['en', /\bstruggling (with|to)\b/i], ['en', /\bhate\b/i], ['en', /\btoo expensive\b/i],
    ['en', /\bhow do (you|y'?all|people) (handle|manage|deal|track)\b/i], ['en', /\bby hand\b|\bmanually\b/i], ['en', /\bkeeps? (crashing|breaking|failing)\b/i], ['en', /\bprice (went up|increase|doubled)|pricing doubled\b/i],
    ['de', /\bnervt\b|\bzu teuer\b|\bvon hand\b|\bmanuell\b/i], ['es', /\bharto\b|\bdemasiado caro\b|\ba mano\b/i], ['pt', /\bcansado de\b|\bmuito caro\b|\bna m(ã|a)o\b/i], ['ja', /面倒|高すぎ/]
  ];
  var SELLER = [ // another seller or a job post, not a buyer
    /\bi (built|made|launched|created)\b/i, /\bwe (built|launched)\b/i, /\bfeedback on my\b/i, /\bmy (startup|saas|app|side project)\b/i, /\[hiring\]|\bhiring\b|\bfor hire\b/i,
    /\bshow ?(off|case)\b/i, /\bself[- ]promo/i, /\bhere(’|')?s what i learned\b/i, /\bhabe .* gebaut\b/i, /\bcre(é|e) una app\b/i, /\bcriei um\b/i
  ];

  /* ---------- small helpers ---------- */
  function num(v) { var s = String(v == null ? '' : v).replace(/[^0-9.,-]/g, ''); if (/,\d{1,2}$/.test(s) && s.indexOf('.') < 0) s = s.replace(',', '.'); s = s.replace(/,/g, ''); var n = parseFloat(s); return isFinite(n) ? n : 0; }
  function money(n) { var neg = n < 0; n = Math.round(Math.abs(n)); var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (neg ? '-$' : '$') + s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function list(s) { return String(s || '').split(/[,\n;]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function unhtml(s) { return String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function kwRx(k) { var e = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return /^[\x00-\x7f]+$/.test(k) ? new RegExp('(^|[^a-z0-9])' + e + '(s|es)?([^a-z0-9]|$)', 'i') : new RegExp(e, 'i'); }

  /* ---------- parse: Reddit JSON listing · Atom feed (.rss) · text copied from a search page ---------- */
  function fromT3(d) {
    return { id: d.name || ('t3_' + (d.id || '')), title: String(d.title || '').trim(), body: String(d.selftext || '').trim(), sub: String(d.subreddit || '').replace(/^r\//, ''),
      url: d.permalink ? 'https://www.reddit.com' + d.permalink : (d.url || ''), created: d.created_utc ? d.created_utc * 1000 : null,
      comments: d.num_comments == null ? null : +d.num_comments, author: d.author || '' };
  }
  function parseJSON(t) {
    var j = JSON.parse(t), out = [];
    (function walk(x) {
      if (!x) return;
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (x.kind === 'Listing' && x.data) { walk(x.data.children); return; }
      if (x.kind === 't3' && x.data) { out.push(fromT3(x.data)); return; }
      if (x.data && x.data.children) { walk(x.data.children); return; }
      if (x.title && (x.permalink || x.subreddit)) out.push(fromT3(x));
    })(j);
    return out;
  }
  function tag(s, name) { var m = s.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i')); return m ? m[1] : ''; }
  function parseAtom(t) {
    return (t.match(/<entry[\s\S]*?<\/entry>/gi) || []).map(function (e) {
      var link = (e.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '', cat = (e.match(/<category[^>]*term="([^"]+)"/i) || [])[1] || '';
      var up = tag(e, 'published') || tag(e, 'updated'), id = unhtml(tag(e, 'id'));
      return { id: id || link, title: unhtml(tag(e, 'title')), body: unhtml(unhtml(tag(e, 'content'))).replace(/submitted by .*$/i, '').trim(),
        sub: cat.replace(/^r\//, '') || ((link.match(/\/r\/([^/]+)/) || [])[1] || ''), url: unhtml(link), created: up ? Date.parse(unhtml(up)) : null, comments: null,
        author: unhtml(tag(tag(e, 'author'), 'name')).replace(/^\/?u\//, '') };
    });
  }
  var AGE = /\b(\d+)\s*(min|mins|minute|minutes|hr|hrs|hour|hours|h|day|days|d|mo|month|months|yr|year|years)\.?\s*ago\b/i;
  function ageMs(n, u) { u = u.toLowerCase(); var h = /^min/.test(u) ? 1 / 60 : /^(hr|hour|h)$|^hrs?$|^hours?$/.test(u) ? 1 : /^(d|day|days)$/.test(u) ? 24 : /^mo/.test(u) ? 720 : /^(yr|year)/.test(u) ? 8760 : 1; return n * h * 3600000; }
  function parseText(t, ref) {
    var lines = t.split(/\r?\n/).map(function (l) { return l.trim(); }), out = [], cur = null;
    function close() { if (cur && cur.title) out.push(cur); cur = null; }
    lines.forEach(function (l) {
      if (!l) return;
      var url = (l.match(/https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/[^\s)]+/i) || [])[0];
      var sm = l.match(/^(?:r\/)([A-Za-z0-9_]{2,21})\b/);
      if (sm) { close(); cur = { id: '', title: '', body: '', sub: sm[1], url: '', created: null, comments: null, author: '' }; }
      if (!cur) cur = { id: '', title: '', body: '', sub: '', url: '', created: null, comments: null, author: '' };
      if (url) { cur.url = url.replace(/[.,]$/, ''); if (!cur.sub) cur.sub = (url.match(/\/r\/([^/]+)/) || [])[1] || ''; var rest = l.replace(url, '').trim(); if (rest && !cur.title) cur.title = rest.replace(/^[-–:|]\s*/, ''); return; }
      var am = l.match(AGE); if (am) { cur.created = ref - ageMs(+am[1], am[2]); }
      var cm = l.match(/(\d[\d,.]*)\s*(k)?\s*comments?\b/i); if (cm) { cur.comments = Math.round(num(cm[1]) * (cm[2] ? 1000 : 1)); }
      var meta = sm || am || cm || /\b\d[\d,.]*k?\s*(votes?|upvotes?|points?)\b/i.test(l) || /^(promoted|share|award|join|•)$/i.test(l);
      if (meta) { var left = l.replace(/^r\/\S+/, '').replace(AGE, '').replace(/[•·]/g, ' ').replace(/(\d[\d,.]*)\s*k?\s*(comments?|votes?|upvotes?|points?)/ig, '').trim(); if (left.length > 12 && !cur.title && !/^u\//.test(left)) cur.title = left; return; }
      if (!cur.title) { cur.title = l; } else if (cur.body.length < 600) cur.body += (cur.body ? ' ' : '') + l;
    });
    close();
    out.forEach(function (p, i) { p.id = p.url ? (p.url.match(/comments\/([a-z0-9]+)/i) || [])[1] || p.url : 'text_' + i + '_' + p.title.slice(0, 40); });
    return out;
  }
  function parse(text, ref) {
    var t = String(text || '').trim();
    if (!t) return { kind: 'empty', posts: [] };
    if (/^[\[{]/.test(t)) { try { return { kind: 'json', posts: parseJSON(t) }; } catch (e) { /* fall through to text */ } }
    if (/<feed[\s>]/i.test(t) && /<entry/i.test(t)) return { kind: 'atom', posts: parseAtom(t) };
    return { kind: 'text', posts: parseText(t, ref == null ? Date.now() : ref) };
  }
  function dedupe(posts) { var seen = {}, out = []; posts.forEach(function (p) { var k = p.id || p.url || p.title; if (!seen[k]) { seen[k] = 1; out.push(p); } }); return out; }

  /* ---------- score: every point has a reason the buyer can read ---------- */
  function scorePost(p, cfg, ref) {
    var kws = list(cfg.keywords), comps = list(cfg.competitors), why = [], s = 0, title = p.title || '', body = p.body || '', all = title + ' \n ' + body;
    var tHits = kws.filter(function (k) { return kwRx(k).test(title); }), bHits = kws.filter(function (k) { return tHits.indexOf(k) < 0 && kwRx(k).test(body); });
    var kwPts = Math.min(40, tHits.length * 25 + bHits.length * 12);
    if (kwPts) { s += kwPts; var q = function (a) { return a.map(function (k) { return '"' + k + '"'; }).join(', '); }; why.push('+' + kwPts + ' keyword ' + [tHits.length ? q(tHits) + ' in title' : '', bHits.length ? q(bHits) + ' in text' : ''].filter(Boolean).join(', ')); }
    var cHits = comps.filter(function (c) { return kwRx(c).test(all); });
    if (cHits.length) { s += 20; why.push('+20 names ' + cHits.join(', ') + ' (a switcher)'); }
    var ask = null; ASK.some(function (a) { var m = all.match(a[1]); if (m) { ask = [a[0], m[0].trim()]; return true; } return false; });
    if (ask) { s += 30; why.push('+30 asks for a tool (' + ask[0] + ': "' + ask[1] + '")'); }
    var pain = null; PAIN.some(function (a) { var m = all.match(a[1]); if (m) { pain = [a[0], m[0].trim()]; return true; } return false; });
    if (pain) { s += 12; why.push('+12 pain now (' + pain[0] + ': "' + pain[1] + '")'); }
    if (/\?/.test(title)) { s += 5; why.push('+5 title is a question'); }
    var seller = null; SELLER.some(function (rx) { var m = all.match(rx); if (m) { seller = m[0].trim(); return true; } return false; });
    if (seller) { s -= 35; why.push('-35 a seller or job post ("' + seller + '"), not a buyer'); }
    var age = p.created != null && ref != null ? (ref - p.created) / 3600000 : null;
    if (age != null) {
      if (age <= 24) { s += 15; why.push('+15 posted ' + Math.max(0, Math.round(age)) + ' h ago'); }
      else if (age <= 72) { s += 8; why.push('+8 posted ' + Math.round(age) + ' h ago'); }
      else if (age > 168) { s -= 10; why.push('-10 older than 7 days'); }
    }
    if (p.comments != null) {
      if (p.comments <= 5) { s += 10; why.push('+10 only ' + p.comments + ' comments: your answer is seen'); }
      else if (p.comments <= 20) { s += 5; why.push('+5 ' + p.comments + ' comments'); }
      else if (p.comments > 60) { s -= 10; why.push('-10 ' + p.comments + ' comments: an answer gets buried'); }
    }
    if (!kwPts && !cHits.length && s > 30) { s = 30; why.push('capped at 30: none of your keywords or competitors'); }
    s = Math.max(0, Math.min(100, s));
    var tier = s >= 60 ? 'hot' : s >= 35 ? 'warm' : 'skip';
    return { id: p.id, title: title, body: body, sub: p.sub, url: p.url, created: p.created, comments: p.comments, score: s, tier: tier, why: why, lang: ask ? ask[0] : pain ? pain[0] : '' };
  }
  function scoreAll(posts, cfg, ref) {
    return dedupe(posts).map(function (p) { return scorePost(p, cfg, ref); }).sort(function (a, b) { return b.score - a.score || (b.created || 0) - (a.created || 0); });
  }
  function summarize(rows, cfg) {
    var deal = num(cfg.deal), close = num(cfg.close) / 100;
    var hot = rows.filter(function (r) { return r.tier === 'hot'; }).length, warm = rows.filter(function (r) { return r.tier === 'warm'; }).length;
    var noise = rows.filter(function (r) { return r.why.some(function (w) { return /seller or job post/.test(w); }); }).length;
    var perThread = Math.round(deal * close * 100) / 100;
    return { read: rows.length, hot: hot, warm: warm, skip: rows.length - hot - warm, noise: noise, deal: deal, closePct: num(cfg.close), perThread: perThread,
      hotValue: Math.round(hot * perThread * 100) / 100, top: rows[0] || null };
  }

  /* ---------- search links (open them while signed in to Reddit, copy, paste back) ---------- */
  var ASK_Q = { en: ['looking for', 'recommend', 'alternative to'], de: ['suche', 'Empfehlung'], es: ['busco', 'recomiendan'], pt: ['procuro', 'indica'], ja: ['おすすめ'] };
  function searchLinks(cfg, langs) {
    var kws = list(cfg.keywords), comps = list(cfg.competitors), out = [];
    (langs || ['en']).forEach(function (lg) {
      kws.slice(0, 6).forEach(function (k) {
        var q = '"' + k + '" (' + ASK_Q[lg].map(function (a) { return '"' + a + '"'; }).join(' OR ') + ')';
        out.push({ label: k + ' + ' + lg + ' ask words', page: 'https://www.reddit.com/search/?q=' + encodeURIComponent(q) + '&sort=new&t=week',
          json: 'https://www.reddit.com/search.json?q=' + encodeURIComponent(q) + '&sort=new&t=week&limit=100' });
      });
    });
    comps.slice(0, 4).forEach(function (c) {
      var q = '"alternative to ' + c + '" OR "' + c + ' alternative"';
      out.push({ label: c + ' switchers', page: 'https://www.reddit.com/search/?q=' + encodeURIComponent(q) + '&sort=new&t=month',
        json: 'https://www.reddit.com/search.json?q=' + encodeURIComponent(q) + '&sort=new&t=month&limit=100' });
    });
    return out;
  }

  /* ---------- lead book (Pro): seen threads, status, weekly results, CSV, reminder ---------- */
  var STATUS = ['new', 'replied', 'conversation', 'call', 'won', 'lost', 'skip'];
  function mergeBook(book, rows, minTier, today) {
    book = book || { leads: {} }; book.leads = book.leads || {};
    var added = 0, seen = 0;
    rows.forEach(function (r) {
      if (minTier === 'hot' ? r.tier !== 'hot' : r.tier === 'skip') return;
      var k = r.id || r.url || r.title;
      if (book.leads[k]) { seen++; book.leads[k].score = r.score; book.leads[k].lastSeen = today; return; }
      book.leads[k] = { title: r.title, sub: r.sub, url: r.url, score: r.score, tier: r.tier, status: 'new', added: today, lastSeen: today, note: '' };
      added++;
    });
    return { book: book, added: added, seen: seen };
  }
  function markSeen(book, rows) { var L = (book && book.leads) || {}; return rows.map(function (r) { var b = L[r.id || r.url || r.title]; return b ? { since: b.added, status: b.status } : null; }); }
  function isoWeek(dstr) {
    var d = new Date(dstr + 'T00:00:00Z'), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
    var y = d.getUTCFullYear(), j4 = new Date(Date.UTC(y, 0, 4)), w = 1 + Math.round(((d - j4) / 86400000 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7);
    return y + '-W' + (w < 10 ? '0' : '') + w;
  }
  function weekly(book, deal) {
    var W = {}, L = (book && book.leads) || {};
    Object.keys(L).forEach(function (k) {
      var l = L[k], w = isoWeek(l.added), x = W[w] || (W[w] = { week: w, found: 0, replied: 0, conversation: 0, call: 0, won: 0, revenue: 0 });
      x.found++; var i = STATUS.indexOf(l.status);
      if (i >= 1 && i <= 4) x.replied++; if (i >= 2 && i <= 4) x.conversation++; if (i >= 3 && i <= 4) x.call++; if (l.status === 'won') { x.won++; x.revenue += num(l.value || deal); }
    });
    return Object.keys(W).sort().map(function (k) { return W[k]; });
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function bookCSV(book) {
    var L = (book && book.leads) || {}, h = ['added', 'last_seen', 'score', 'tier', 'status', 'subreddit', 'title', 'url', 'note'];
    return h.join(',') + '\n' + Object.keys(L).map(function (k) { var l = L[k]; return [l.added, l.lastSeen, l.score, l.tier, l.status, l.sub, l.title, l.url, l.note].map(csvCell).join(','); }).join('\n') + '\n';
  }
  function rowsCSV(rows) {
    return 'score,tier,subreddit,comments,title,url,why\n' + rows.map(function (r) { return [r.score, r.tier, r.sub, r.comments == null ? '' : r.comments, r.title, r.url, r.why.join(' | ')].map(csvCell).join(','); }).join('\n') + '\n';
  }
  function icsDaily(hour, links, stamp) {
    var hh = (hour < 10 ? '0' : '') + hour, desc = 'Open these Reddit searches, copy the results, paste them into the thread scorer:\\n' + links.slice(0, 8).map(function (l) { return l.label + ': ' + l.page; }).join('\\n');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ready Stack//reddit thread scorer//EN', 'BEGIN:VEVENT', 'UID:reddit-leads-' + stamp + '@getreadystack.com',
      'DTSTAMP:' + stamp + 'T000000Z', 'DTSTART:' + stamp + 'T' + hh + '0000', 'DURATION:PT20M', 'RRULE:FREQ=DAILY', 'SUMMARY:Reddit leads: paste today\'s threads (20 min)',
      'DESCRIPTION:' + desc.replace(/[,;]/g, function (c) { return '\\' + c; }), 'BEGIN:VALARM', 'TRIGGER:-PT5M', 'ACTION:DISPLAY', 'DESCRIPTION:Reddit leads', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    return lines.map(function (l) { var o = ''; while (l.length > 74) { o += l.slice(0, 74) + '\r\n '; l = l.slice(74); } return o + l; }).join('\r\n') + '\r\n';
  }

  /* ---------- made-up examples (Reddit JSON listing shape) ---------- */
  var AS_OF = Date.UTC(2026, 10, 16, 12, 0, 0) / 1000;
  function t3(id, sub, h, c, title, body) { return { kind: 't3', data: { name: 't3_' + id, id: id, subreddit: sub, title: title, selftext: body, created_utc: AS_OF - h * 3600, num_comments: c, permalink: '/r/' + sub + '/comments/' + id + '/example/', author: 'example_user' } }; }
  function listing(a) { return { kind: 'Listing', data: { children: a } }; }
  var SAMPLES = {
    invoice: { name: 'Invoicing app for freelancers (made-up example)', keywords: 'invoice, invoicing, billing', competitors: 'AcmeBill, OldInvoicer', deal: 180, close: 10, asOf: AS_OF * 1000,
      data: listing([
        t3('ex01a', 'freelance', 3, 4, 'Looking for an invoicing tool that sends payment reminders on its own', 'Freelance designer, 12 clients, I chase late invoices by hand every month. What do you use? Happy to pay for something simple.'),
        t3('ex01b', 'smallbusiness', 9, 11, 'Alternative to AcmeBill? Their pricing doubled for 2 seats', 'We need recurring invoices and card payments for a 2-person studio. Any recommendations?'),
        t3('ex01c', 'Entrepreneur', 5, 40, 'I built an invoicing app in 30 days, here is what I learned', 'Long post about my launch and the first 10 users.'),
        t3('ex01d', 'freelance', 20, 85, 'How do you handle clients who pay 60 days late?', 'Invoice sent, two reminders, nothing. I hate chasing money.'),
        t3('ex01e', 'sysadmin', 2, 3, 'Best monitor for long coding days?', 'Budget around 400, need USB-C.'),
        t3('ex01f', 'Bookkeeping', 30, 2, 'Is there an app that turns timesheets into invoices?', 'I log hours in a spreadsheet and copy them into invoices by hand.'),
        t3('ex01g', 'SaaS', 6, 14, 'Feedback on my landing page (billing software for agencies)', 'Roast my hero section please.'),
        t3('ex01h', 'freelanceWriters', 50, 23, 'Do I put VAT on my invoice as a non-EU freelancer?', 'Client is in Germany, I am in Canada.'),
        t3('ex01i', 'smallbusiness', 46, 7, 'OldInvoicer keeps crashing, what is everyone using for billing now?', 'Switching this week, 40 invoices a month, need exports for my accountant.'),
        t3('ex01j', 'startups', 4, 1, '[Hiring] Billing engineer, remote', 'Stripe experience a plus.')
      ]) },
    reviews: { name: 'Shopify product-reviews app (made-up example)', keywords: 'reviews app, product reviews, photo reviews, review request', competitors: 'AcmeReviews', deal: 240, close: 15, asOf: AS_OF * 1000,
      data: listing([
        t3('ex02a', 'shopify', 7, 3, 'Which reviews app actually sends review request emails that people answer?', 'Store does 300 orders a month and we have 9 product reviews total.'),
        t3('ex02b', 'ecommerce', 15, 9, 'AcmeReviews is too expensive for a small store, alternatives?', 'Paying for photo reviews feels like a lot at our size.'),
        t3('ex02c', 'shopify', 26, 61, 'How do you get more product reviews without discounts?', 'Tried asking in the thank-you email, nothing.'),
        t3('ex02d', 'shopify', 3, 18, 'We launched our reviews app on the Shopify App Store today', 'Happy to answer questions about the build.'),
        t3('ex02e', 'dropship', 80, 4, 'Is there a tool to import product reviews from my supplier?', ''),
        t3('ex02f', 'smallbusiness', 200, 2, 'Google reviews vs product reviews for a bakery?', 'We sell online and in a shop.'),
        t3('ex02g', 'shopify', 12, 6, 'Theme question: change font size in the footer', '')
      ]) },
    multi: { name: 'Online bookkeeping service in 4 languages (made-up example)', keywords: 'Buchhaltung, contabilidad, contabilidade, bookkeeping, 会計', competitors: '', deal: 1800, close: 20, asOf: AS_OF * 1000,
      data: listing([
        t3('ex03a', 'Selbststaendig', 8, 5, 'Suche eine Online-Buchhaltung für mein Kleingewerbe, Empfehlungen?', 'Belege mache ich bisher von Hand, das nervt.'),
        t3('ex03b', 'autonomos', 18, 4, 'Busco contabilidad online para autónomo, ¿me recomiendan alguna?', 'Facturo unas 20 facturas al mes.'),
        t3('ex03c', 'empreendedorismo', 30, 12, 'Alguém indica contabilidade online para MEI que virou ME?', 'Faturamento passou do limite este ano.'),
        t3('ex03d', 'japanlife', 40, 9, 'フリーランスの会計ソフト、おすすめありますか？', '確定申告が面倒です。'),
        t3('ex03e', 'Bookkeeping', 5, 33, 'I made a bookkeeping template, sharing it here', 'Free download in the comments.'),
        t3('ex03f', 'de', 100, 90, 'Was haltet ihr vom neuen Grundsteuer-Bescheid?', ''),
        t3('ex03g', 'smallbusiness', 60, 6, 'Bookkeeping by hand is eating my Sundays, how do you track receipts?', 'Two-person cleaning company.')
      ]) }
  };
  function sampleText(k) { return JSON.stringify(SAMPLES[k].data, null, 1); }

  var API = { SLUG: SLUG, DOORS: DOORS, STATUS: STATUS, SAMPLES: SAMPLES, AS_OF: AS_OF, parse: parse, parseJSON: parseJSON, parseAtom: parseAtom, parseText: parseText,
    scorePost: scorePost, scoreAll: scoreAll, summarize: summarize, searchLinks: searchLinks, mergeBook: mergeBook, markSeen: markSeen, weekly: weekly, isoWeek: isoWeek,
    bookCSV: bookCSV, rowsCSV: rowsCSV, icsDaily: icsDaily, sampleText: sampleText, money: money, num: num, list: list };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.RTS = API;

  /* ================= page ================= */
  var $ = function (id) { return document.getElementById(id); };
  var LS = root.localStorage, last = { rows: [], sum: null, kind: '' };
  function cfg() { var o = {}; Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (el) { o[el.getAttribute('data-k')] = el.value; }); return o; }
  function isPro() { try { return LS.getItem('rts_pro') === '1'; } catch (e) { return false; } }
  function loadBook() { try { return JSON.parse(LS.getItem('rts_book') || '') || { leads: {} }; } catch (e) { return { leads: {} }; } }
  function saveBook(b) { LS.setItem('rts_book', JSON.stringify(b)); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function refTime() { var s = $('sample').value; return SAMPLES[s] ? SAMPLES[s].asOf : Date.now(); }
  function ago(r) { if (r.created == null) return ''; var h = Math.round((refTime() - r.created) / 3600000); return h < 48 ? h + ' h ago' : Math.round(h / 24) + ' d ago'; }

  function render() {
    var c = cfg(), p = parse($('paste').value, refTime()), rows = scoreAll(p.posts, c, refTime()), s = summarize(rows, c);
    last = { rows: rows, sum: s, kind: p.kind };
    $('r-hot').textContent = s.hot; $('r-read').textContent = s.read;
    $('r-warm').textContent = s.warm; $('r-noise').textContent = s.noise;
    $('r-value').textContent = money(s.hotValue);
    $('r-per').textContent = money(s.deal) + ' × ' + s.closePct + '% = ' + money(s.perThread) + ' a thread';
    $('r-loss').innerHTML = s.hot ? 'Leave these ' + s.hot + ' hot threads unanswered and <b>' + money(s.hotValue) + '</b> of expected deals goes to whoever replies first (' + s.hot + ' × ' + money(s.deal) + ' × ' + s.closePct + '%). Fresh threads with few comments are where an answer is still seen.' : 'No hot thread in this paste: widen the keywords or paste a newer search.';
    var top = rows.filter(function (r) { return r.tier !== 'skip'; }).slice(0, 3);
    $('r-top').innerHTML = top.map(function (r) { return '<li><span class="sc ' + r.tier + '">' + r.score + '</span> <b>r/' + esc(r.sub) + '</b> ' + esc(r.title) + ' <span class="small">' + esc(ago(r)) + (r.comments != null ? ' · ' + r.comments + ' comments' : '') + '</span></li>'; }).join('') || '<li class="small">Nothing above 35 yet.</li>';
    var seen = isPro() ? markSeen(loadBook(), rows) : [];
    $('rows').innerHTML = rows.map(function (r, i) {
      var sn = seen[i] ? '<span class="seen">in your book since ' + esc(seen[i].since) + ' · ' + esc(seen[i].status) + '</span>' : (isPro() && r.tier !== 'skip' ? '<span class="newb">new</span>' : '');
      return '<tr class="' + r.tier + '"><td class="n"><span class="sc ' + r.tier + '">' + r.score + '</span></td><td><b>' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + '</a>' : esc(r.title)) + '</b> ' + sn +
        '<div class="small">r/' + esc(r.sub) + (ago(r) ? ' · ' + esc(ago(r)) : '') + (r.comments != null ? ' · ' + r.comments + ' comments' : '') + '</div><ul class="why">' + r.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></td></tr>';
    }).join('');
    $('parse-msg').textContent = p.posts.length ? 'Read ' + rows.length + ' threads from ' + ({ json: 'Reddit JSON', atom: 'a Reddit feed', text: 'copied page text' }[p.kind]) + '.' : 'Paste Reddit results above.';
    var langs = ['en'].concat(Array.prototype.filter.call(document.querySelectorAll('.lg'), function (x) { return x.checked; }).map(function (x) { return x.value; }));
    $('links').innerHTML = searchLinks(c, langs).map(function (l) { return '<li>' + esc(l.label) + ': <a href="' + esc(l.page) + '" target="_blank" rel="noopener">search page</a> · <a href="' + esc(l.json) + '" target="_blank" rel="noopener">JSON</a></li>'; }).join('');
    if (isPro()) renderBook();
  }
  function download(name, data, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); }
  function needPro(what) { var b = $('paid'); b.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('paid-why').textContent = what + ' — Save and continue: https://getreadystack.com/apps/lead-generation-reddit-thread-scorer/'; }

  /* Pro: lead book + watchlists */
  function renderBook() {
    var b = loadBook(), L = b.leads, keys = Object.keys(L).sort(function (x, y) { return (L[y].added || '').localeCompare(L[x].added || '') || L[y].score - L[x].score; });
    $('book').innerHTML = keys.length ? '<table><tr><th>Added</th><th>Score</th><th>Thread</th><th>Status</th><th>Note</th></tr>' + keys.map(function (k) {
      var l = L[k]; return '<tr><td>' + esc(l.added) + '</td><td class="n">' + l.score + '</td><td>' + (l.url ? '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + '</a>' : esc(l.title)) + '<div class="small">r/' + esc(l.sub) + '</div></td><td><select data-lead="' + esc(k) + '">' + STATUS.map(function (s) { return '<option' + (s === l.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td><td><input data-note="' + esc(k) + '" value="' + esc(l.note) + '"></td></tr>';
    }).join('') + '</table>' : '<p class="small">Empty. Score a paste, then "Save hot + warm to my lead book".</p>';
    var w = weekly(b, num(cfg().deal));
    $('weeks').innerHTML = w.length ? '<table><tr><th>Week</th><th>Found</th><th>Replied</th><th>Conversations</th><th>Calls</th><th>Won</th><th>Won value</th></tr>' + w.map(function (x) { return '<tr><td>' + x.week + '</td><td class="n">' + x.found + '</td><td class="n">' + x.replied + '</td><td class="n">' + x.conversation + '</td><td class="n">' + x.call + '</td><td class="n">' + x.won + '</td><td class="n">' + money(x.revenue) + '</td></tr>'; }).join('') + '</table>' : '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-lead]'), function (el) { el.addEventListener('change', function () { var bb = loadBook(); bb.leads[el.getAttribute('data-lead')].status = el.value; saveBook(bb); renderBook(); }); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-note]'), function (el) { el.addEventListener('change', function () { var bb = loadBook(); bb.leads[el.getAttribute('data-note')].note = el.value; saveBook(bb); }); });
    var wl = loadLists(); $('wl-sel').innerHTML = '<option value="">Saved watchlists (' + wl.length + ')</option>' + wl.map(function (x, i) { return '<option value="' + i + '">' + esc(x.name) + '</option>'; }).join('');
  }
  function loadLists() { try { return JSON.parse(LS.getItem('rts_lists') || '[]'); } catch (e) { return []; } }
  function showPro() { var p = isPro(); $('pro-open').style.display = p ? '' : 'none'; $('pro-locked').style.display = p ? 'none' : ''; render(); }
  function checkKey(k, cb) { var i = 0; (function next() { if (i >= DOORS.length) return cb(false); var door = DOORS[i++]; fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) cb(true); else next(); }).catch(next); })(); }
  function unlock(k) { LS.setItem('rts_pro', '1'); LS.setItem('rts_key', k); showPro(); }

  function init() {
    $('sample').addEventListener('change', function () { var s = SAMPLES[$('sample').value]; if (!s) return; $('paste').value = sampleText($('sample').value); $('keywords').value = s.keywords; $('competitors').value = s.competitors; $('deal').value = s.deal; $('close').value = s.close; render(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-k],.lg'), function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });
    $('paste').addEventListener('input', function () { var cur = $('sample').value; if (SAMPLES[cur] && $('paste').value !== sampleText(cur)) $('sample').value = 'mine'; render(); });
    $('paste').value = sampleText('invoice');
    render();
    var gated = { 'save-book': 'Saving leads to a lead book', 'dl-csv': 'The CSV download', 'dl-ics': 'The daily reminder (.ics)', 'wl-save': 'Saved watchlists', 'dl-backup': 'The backup file' };
    Object.keys(gated).forEach(function (id) { var el = $(id); if (el) el.addEventListener('click', function (e) { if (!isPro()) { e.preventDefault(); needPro(gated[id]); } }); });
    $('save-book').addEventListener('click', function () { if (!isPro()) return; var m = mergeBook(loadBook(), last.rows, $('min-tier').value, today()); saveBook(m.book); $('book-msg').textContent = m.added + ' new leads saved · ' + m.seen + ' already in your book (not added twice).'; render(); });
    $('dl-csv').addEventListener('click', function () { if (!isPro()) return; download('reddit-leads-' + today() + '.csv', Object.keys(loadBook().leads).length ? bookCSV(loadBook()) : rowsCSV(last.rows), 'text/csv'); });
    $('dl-ics').addEventListener('click', function () { if (!isPro()) return; var langs = ['en'].concat(Array.prototype.filter.call(document.querySelectorAll('.lg'), function (x) { return x.checked; }).map(function (x) { return x.value; })); download('reddit-leads-daily.ics', icsDaily(+$('ics-hour').value || 9, searchLinks(cfg(), langs), today().replace(/-/g, '')), 'text/calendar'); });
    $('wl-save').addEventListener('click', function () { if (!isPro()) return; var c = cfg(), wl = loadLists(), name = ($('wl-name').value || list(c.keywords)[0] || 'watchlist').slice(0, 60); wl = wl.filter(function (x) { return x.name !== name; }); wl.push({ name: name, keywords: c.keywords, competitors: c.competitors, deal: c.deal, close: c.close }); LS.setItem('rts_lists', JSON.stringify(wl)); renderBook(); });
    $('wl-sel').addEventListener('change', function () { var x = loadLists()[+$('wl-sel').value]; if (!x) return; $('keywords').value = x.keywords; $('competitors').value = x.competitors; $('deal').value = x.deal; $('close').value = x.close; $('sample').value = 'mine'; render(); });
    $('dl-backup').addEventListener('click', function () { if (!isPro()) return; download('reddit-leads-backup-' + today() + '.json', JSON.stringify({ book: loadBook(), lists: loadLists() }), 'application/json'); });
    $('up-backup').addEventListener('change', function (e) { var f = e.target.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { try { var j = JSON.parse(rd.result); if (j.book) saveBook(j.book); if (j.lists) LS.setItem('rts_lists', JSON.stringify(j.lists)); $('book-msg').textContent = 'Backup loaded.'; render(); } catch (x) { $('book-msg').textContent = 'That file is not a backup from this page.'; } }; rd.readAsText(f); });
    var hk = (location.hash.match(/k=([^&]+)/) || [])[1];
    if (hk) checkKey(decodeURIComponent(hk), function (ok) { if (ok) unlock(decodeURIComponent(hk)); });
    $('key-go').addEventListener('click', function () { var k = $('key-in').value.trim(); if (!k) return; $('key-msg').textContent = 'Checking ...'; checkKey(k, function (ok) { $('key-msg').textContent = ok ? ' — Save and continue: https://getreadystack.com/apps/lead-generation-reddit-thread-scorer/' : ' — Save and continue: https://getreadystack.com/apps/lead-generation-reddit-thread-scorer/'; if (ok) unlock(k); }); });
    showPro();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
