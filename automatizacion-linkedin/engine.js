/* automatización LinkedIn — planificador de prospección (motor puro · sin DOM · se prueba con node) */
(function (root) {
  'use strict';
  var DAY = 86400000;
  function num(x, d) { var v = parseFloat(String(x == null ? '' : x).replace(/\s/g, '').replace(',', '.')); return isFinite(v) ? v : (d || 0); }
  function r2(x) { return Math.round(x * 100 + 1e-9) / 100; }
  function iso(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function parse(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function add(s, n) { return iso(parse(s) + n * DAY); }
  function dow(s) { return new Date(parse(s)).getUTCDay(); }            // 0 = domingo
  function monday(s) { var w = (dow(s) + 6) % 7; return add(s, -w); }
  function nextMonday(today) { var w = (dow(today) + 6) % 7; return add(today, w === 0 ? 0 : 7 - w); }
  function sendDay(s, days) { var w = (dow(s) + 6) % 7; return w < days; }  // 5 = lun-vie · 6 = lun-sáb · 7 = todos
  // reparto entero estable: el i-ésimo (0..n-1) entra si round((i+1)p) - round(i p) = 1
  function pick(i, pct) { return Math.floor(((i + 1) * pct + 50) / 100 + 1e-9) - Math.floor((i * pct + 50) / 100 + 1e-9) > 0; }
  function grp(n) { var s = String(Math.floor(Math.abs(n))); return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fmt(x, dec) { dec = dec == null ? 0 : dec; var v = Math.abs(x), i = Math.floor(v + 1e-9); var f = dec ? Math.round((v - i) * Math.pow(10, dec)) : 0;
    if (dec && f >= Math.pow(10, dec)) { i += 1; f = 0; }
    var s = grp(i) + (dec ? ',' + ('000000' + f).slice(-dec) : ''); return (x < 0 ? '−' : '') + s; }
  function money(x, cur) { cur = cur || '€'; var s = fmt(x, Math.abs(x - Math.round(x)) > 0.004 ? 2 : 0); return cur === '€' ? s + ' €' : cur + ' ' + s; }
  function pct(x) { return fmt(x, x % 1 ? 1 : 0) + ' %'; }

  var DEF = { contacts: 400, cap: 100, days: 5, start: '', acc: 28, rep: 15, meet: 30, lag: 3, m1: 1, f1: 4, f2: 10, wd: 21, stack: 49, deal: 3000, close: 20, cur: '€' };

  function norm(inp, today) {
    var o = {}, k; inp = inp || {};
    for (k in DEF) o[k] = (inp[k] === undefined || inp[k] === '') ? DEF[k] : inp[k];
    ['contacts', 'cap', 'days', 'lag', 'm1', 'f1', 'f2', 'wd'].forEach(function (k) { o[k] = Math.max(0, Math.round(num(o[k], DEF[k]))); });
    ['acc', 'rep', 'meet', 'close'].forEach(function (k) { o[k] = Math.min(100, Math.max(0, num(o[k], DEF[k]))); });
    ['stack', 'deal'].forEach(function (k) { o[k] = Math.max(0, num(o[k], DEF[k])); });
    o.contacts = Math.min(o.contacts, 20000); o.cap = Math.max(1, Math.min(o.cap, 1000));
    o.days = Math.min(7, Math.max(1, o.days || 5));
    if (o.f1 <= o.m1) o.f1 = o.m1 + 1; if (o.f2 <= o.f1) o.f2 = o.f1 + 1; if (o.wd < 1) o.wd = 21;
    if (isNaN(parse(o.start))) o.start = nextMonday(today || iso(Date.now()));
    return o;
  }

  // cuota de cada día de envío dentro de una semana lun-dom: el tope semanal repartido, el resto a los primeros días
  function dayQuota(o, s) {
    if (!sendDay(s, o.days)) return 0;
    var w = (dow(s) + 6) % 7, base = Math.floor(o.cap / o.days), extra = o.cap % o.days;
    return base + (w < extra ? 1 : 0);
  }

  /* plan(): cada contacto, con fechas. El contacto i acepta / responde / pide reunión según las tasas (reparto entero, sin azar). */
  function plan(inp, today) {
    var o = norm(inp, today), people = [], d = o.start, i = 0, guard = 0, weekSent = {};
    while (i < o.contacts && guard < 4000) {
      var q = dayQuota(o, d), wk = monday(d); weekSent[wk] = weekSent[wk] || 0;
      q = Math.min(q, o.cap - weekSent[wk]);
      for (var j = 0; j < q && i < o.contacts; j++, i++) { people.push({ i: i, invite: d }); weekSent[wk]++; }
      d = add(d, 1); guard++;
    }
    var acc = 0, rep = 0;
    people.forEach(function (p) {
      if (pick(p.i, o.acc)) {
        p.accept = add(p.invite, o.lag); p.msg1 = add(p.accept, o.m1);
        var a = acc++;
        if (pick(a, o.rep)) {
          var r = rep++, step = r % 3;                         // responde tras el mensaje 1, el seguimiento 1 o el 2
          if (step >= 1) p.fu1 = add(p.accept, o.f1);
          if (step >= 2) p.fu2 = add(p.accept, o.f2);
          p.reply = add(step === 0 ? p.msg1 : step === 1 ? p.fu1 : p.fu2, 1);
          if (pick(r, o.meet)) p.meeting = true;
        } else { p.fu1 = add(p.accept, o.f1); p.fu2 = add(p.accept, o.f2); }
      } else { p.withdraw = add(p.invite, o.wd); p.again = add(p.withdraw, 21); }
    });
    var days = {};
    function bump(day, k) { if (!day) return; days[day] = days[day] || { date: day, invites: 0, msg1: 0, fu: 0, withdraw: 0, replies: 0 }; days[day][k]++; }
    people.forEach(function (p) { bump(p.invite, 'invites'); bump(p.msg1, 'msg1'); bump(p.fu1, 'fu'); bump(p.fu2, 'fu'); bump(p.withdraw, 'withdraw'); bump(p.reply, 'replies'); });
    var agenda = Object.keys(days).sort().map(function (k) { return days[k]; });
    var weeks = {}; people.forEach(function (p) { var w = monday(p.invite); weeks[w] = (weeks[w] || 0) + 1; });
    var weekList = Object.keys(weeks).sort().map(function (w) {
      var a = agenda.filter(function (x) { return monday(x.date) === w; }), s = { week: w, invites: 0, msg1: 0, fu: 0, withdraw: 0, replies: 0 };
      a.forEach(function (x) { s.invites += x.invites; s.msg1 += x.msg1; s.fu += x.fu; s.withdraw += x.withdraw; s.replies += x.replies; }); return s;
    });
    var accepted = people.filter(function (p) { return p.accept; }).length,
      replied = people.filter(function (p) { return p.reply; }).length,
      meetings = people.filter(function (p) { return p.meeting; }).length,
      withdrawals = people.filter(function (p) { return p.withdraw; }).length,
      followups = people.reduce(function (s, p) { return s + (p.fu1 ? 1 : 0) + (p.fu2 ? 1 : 0); }, 0),
      messages = accepted + followups;
    var last = agenda.length ? agenda[agenda.length - 1].date : o.start, first = people.length ? people[0].invite : o.start;
    var lastInvite = people.length ? people[people.length - 1].invite : o.start;
    var weeksToCover = people.length ? Math.round((parse(monday(lastInvite)) - parse(monday(first))) / (7 * DAY)) + 1 : 0;
    var perDayMax = 0; agenda.forEach(function (x) { if (x.invites > perDayMax) perDayMax = x.invites; });
    var weekMeet = o.cap * o.acc / 100 * o.rep / 100 * o.meet / 100;            // reuniones de una semana completa de invitaciones
    var lostWeek = r2(weekMeet * o.close / 100 * o.deal);
    var months = weeksToCover * 12 / 52, stackCost = r2(o.stack * months);
    return { inp: o, people: people, agenda: agenda, weeks: weekList, accepted: accepted, replied: replied, meetings: meetings,
      withdrawals: withdrawals, followups: followups, messages: messages, weeksToCover: weeksToCover, perDay: perDayMax,
      first: first, lastInvite: lastInvite, last: last, weekMeet: r2(weekMeet), lostWeek: lostWeek, stackCost: stackCost,
      costPerMeeting: meetings ? r2(stackCost / meetings) : null, pipeline: r2(meetings * o.close / 100 * o.deal),
      days: Math.round((parse(last) - parse(first)) / DAY) + 1 };
  }

  /* ---- Pro: contactos reales con su estado ---- */
  function fill(tpl, c) {
    var first = String(c.nombre || '').trim().split(/\s+/)[0] || '';
    return String(tpl || '').replace(/\{(nombre|nombre_completo|empresa|cargo)\}/g, function (_, k) {
      return k === 'nombre' ? first : k === 'nombre_completo' ? (c.nombre || '') : (c[k] || '');
    }).replace(/[ \t]+\n/g, '\n').trim();
  }
  function invitedThisWeek(cs, today) { var w = monday(today); return cs.filter(function (c) { return c.invited && monday(c.invited) === w; }).length; }
  // la cola de hoy: lo que toca hacer a mano en LinkedIn (no enviamos nada por ti)
  function queue(cs, inp, today) {
    var o = norm(inp, today), q = { invite: [], msg1: [], fu1: [], fu2: [], withdraw: [], quota: 0, weekLeft: 0 };
    var t = parse(today);
    function due(d, n) { return d && parse(add(d, n)) <= t; }
    cs.forEach(function (c) {
      if (c.out || c.replied || c.meeting) return;
      if (c.invited && !c.accepted && !c.withdrawn && due(c.invited, o.wd)) q.withdraw.push(c);
      if (c.accepted && !c.msg1 && due(c.accepted, o.m1)) q.msg1.push(c);
      if (c.msg1 && !c.fu1 && due(c.accepted || c.msg1, o.f1)) q.fu1.push(c);
      if (c.fu1 && !c.fu2 && due(c.accepted || c.fu1, o.f2)) q.fu2.push(c);
    });
    q.weekLeft = Math.max(0, o.cap - invitedThisWeek(cs, today));
    q.quota = Math.min(q.weekLeft, sendDay(today, o.days) ? Math.ceil(o.cap / o.days) - cs.filter(function (c) { return c.invited === today; }).length : 0);
    if (q.quota < 0) q.quota = 0;
    q.invite = cs.filter(function (c) { return !c.invited && !c.out && (!c.again || parse(c.again) <= t); }).slice(0, q.quota);
    return q;
  }
  function mark(c, what, today) {
    if (what === 'invited') c.invited = today;
    else if (what === 'accepted') { c.accepted = today; if (!c.invited) c.invited = today; }
    else if (what === 'msg1') c.msg1 = today;
    else if (what === 'fu1') c.fu1 = today;
    else if (what === 'fu2') c.fu2 = today;
    else if (what === 'replied') c.replied = today;
    else if (what === 'meeting') { c.meeting = today; if (!c.replied) c.replied = today; }
    else if (what === 'withdrawn') { c.withdrawn = today; c.again = add(today, 21); }
    else if (what === 'reinvite') { delete c.invited; delete c.withdrawn; }
    else if (what === 'out') c.out = today;
    return c;
  }
  function stats(cs) {
    var inv = cs.filter(function (c) { return c.invited; }).length, acc = cs.filter(function (c) { return c.accepted; }).length,
      rep = cs.filter(function (c) { return c.replied; }).length, meet = cs.filter(function (c) { return c.meeting; }).length,
      wd = cs.filter(function (c) { return c.withdrawn; }).length;
    return { total: cs.length, invited: inv, accepted: acc, replied: rep, meetings: meet, withdrawn: wd,
      accRate: inv ? r2(acc / inv * 100) : null, repRate: acc ? r2(rep / acc * 100) : null, meetRate: rep ? r2(meet / rep * 100) : null };
  }

  /* CSV: el Connections.csv de LinkedIn (con notas arriba), una exportación de CRM o líneas "nombre; empresa; cargo; url" */
  function splitLine(line, sep) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) { var ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out.map(function (s) { return s.trim(); });
  }
  function low(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function parseContacts(text) {
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var sep = /;/.test(lines[0]) && !/,/.test(lines[0]) ? ';' : (lines.some(function (l) { return l.indexOf(';') >= 0; }) && !lines.some(function (l) { return l.indexOf(',') >= 0 && l.indexOf(';') < 0; }) ? ';' : (lines.some(function (l) { return l.indexOf('\t') >= 0; }) ? '\t' : ','));
    var hi = -1, H = null;
    for (var i = 0; i < Math.min(lines.length, 12); i++) {
      var cells = splitLine(lines[i], sep).map(low);
      if (cells.some(function (c) { return /^(first name|nombre|name|nome)$/.test(c); })) { hi = i; H = cells; break; }
    }
    function col(rx) { if (!H) return -1; for (var k = 0; k < H.length; k++) if (rx.test(H[k])) return k; return -1; }
    var cF = col(/^(first name|nombre|name|nome)$/), cL = col(/^(last name|apellidos?|sobrenome)$/), cC = col(/^(company|empresa|organization|organizacion)$/),
      cP = col(/^(position|cargo|title|puesto|job title)$/), cU = col(/^(url|profile url|perfil|linkedin|linkedin url)$/);
    var out = [], seen = {};
    lines.slice(hi + 1).forEach(function (l) {
      var c = splitLine(l, sep), r;
      if (H) r = { nombre: [c[cF] || '', cL >= 0 ? c[cL] || '' : ''].join(' ').trim(), empresa: cC >= 0 ? c[cC] || '' : '', cargo: cP >= 0 ? c[cP] || '' : '', url: cU >= 0 ? c[cU] || '' : '' };
      else { r = { nombre: c[0] || '', empresa: c[1] || '', cargo: c[2] || '', url: '' };
        c.forEach(function (x) { if (/linkedin\.com\/|^https?:\/\//i.test(x)) r.url = x; });
        if (r.cargo === r.url) r.cargo = ''; if (r.empresa === r.url) r.empresa = ''; }
      if (!r.nombre) return;
      var key = low(r.url || (r.nombre + '|' + r.empresa)); if (seen[key]) return; seen[key] = 1;
      out.push(r);
    });
    return out;
  }
  function csvCell(v) { v = v == null ? '' : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(cs) {
    var cols = ['nombre', 'empresa', 'cargo', 'url', 'invited', 'accepted', 'msg1', 'fu1', 'fu2', 'replied', 'meeting', 'withdrawn', 'again', 'out', 'nota'];
    var head = ['nombre', 'empresa', 'cargo', 'url', 'invitada', 'aceptó', 'mensaje 1', 'seguimiento 1', 'seguimiento 2', 'respondió', 'reunión', 'retirada', 're-invitable desde', 'descartado', 'nota'];
    return '﻿' + [head.join(';')].concat(cs.map(function (c) { return cols.map(function (k) { return csvCell(c[k]); }).join(';'); })).join('\r\n') + '\r\n';
  }
  /* .ics: un aviso por día de trabajo con lo que toca (plan de la campaña) */
  function ics(p, name) {
    function esc(s) { return String(s).replace(/[\;,]/g, function (m) { return '\\' + m; }).replace(/\n/g, '\\n'); }
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rulestamp//automatizacion-linkedin//ES', 'CALSCALE:GREGORIAN'];
    p.agenda.forEach(function (d, k) {
      var parts = []; if (d.invites) parts.push(d.invites + ' invitaciones'); if (d.msg1) parts.push(d.msg1 + ' primeros mensajes');
      if (d.fu) parts.push(d.fu + ' seguimientos'); if (d.withdraw) parts.push(d.withdraw + ' invitaciones a retirar');
      if (!parts.length) return; var ds = d.date.replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:' + ds + '-' + k + '-' + low(name || 'campana').replace(/[^a-z0-9]+/g, '-') + '@getreadystack.com', 'DTSTAMP:' + ds + 'T080000Z',
        'DTSTART;VALUE=DATE:' + ds, 'DTEND;VALUE=DATE:' + add(d.date, 1).replace(/-/g, ''),
        'SUMMARY:' + esc('LinkedIn: ' + parts.join(' · ')), 'DESCRIPTION:' + esc((name ? name + ' · ' : '') + 'Abre la cola de hoy en el planificador y envía a mano desde LinkedIn.'),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('LinkedIn: ' + parts.join(' · ')), 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n') + '\r\n';
  }

  var api = { DEF: DEF, norm: norm, plan: plan, queue: queue, mark: mark, stats: stats, fill: fill, parseContacts: parseContacts, toCSV: toCSV, ics: ics,
    fmt: fmt, money: money, pct: pct, add: add, iso: iso, monday: monday, nextMonday: nextMonday, dow: dow, r2: r2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LI = api;
})(this);
