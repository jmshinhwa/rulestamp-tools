/* Muse AI prompts — engine (no DOM). Browser: window.MUSE · node: module.exports.
   Permission rules come from Meta's help page "How Muse works with your guidance and approval" (read 2026-11-18):
   - "Always ask": Muse asks before any action.
   - "Ask for some actions": Muse asks before every write action and important read actions (we count plain reads as not asked).
   - "Allow for this task": that type of action runs for the entire task without asking again.
   - "Always allow" (Connector) / "Allow for this site" (web): that type of action runs in the future without asking again.
   - "Some other actions, like sending an email, cannot be reversed."  */
(function (root) {
  'use strict';

  var SETTINGS = {
    always_ask: 'Always ask',
    some: 'Ask for some actions',
    task: 'I tap "Allow for this task"',
    always: '"Always allow" is already on'
  };
  var WEB_SETTINGS = {
    always_ask: 'Always ask',
    some: 'Ask for some actions',
    task: 'I tap "Allow for this task"',
    always: '"Allow for this site" is already on'
  };

  /* step: [text, door('conn'|'web'|'phone'), kind('read'|'write'|'buy'), undo(true|false), money(true|false), personal(true|false)] */
  var TASKS = {
    sell: {
      name: 'Sell an item on Facebook Marketplace',
      connectors: ['Facebook (connected automatically through Accounts Center)', 'Google Calendar'],
      a: 'Asking price', b: 'Lowest price you accept', c: 'A lowball offer to test',
      ex: { item: 'oak standing desk, 140 x 70 cm', a: 180, b: 150, c: 90 },
      steps: [
        ['Read new buyer messages about the listing', 'conn', 'read', true, false, false],
        ['Answer questions about the item', 'conn', 'write', false, false, false],
        ['Counter an offer with a price', 'conn', 'write', false, true, false],
        ['Accept an offer and promise the item', 'conn', 'write', false, true, false],
        ['Send the pickup spot and time', 'conn', 'write', false, false, true],
        ['Put the pickup on the calendar', 'conn', 'write', true, false, false],
        ['Mark the listing as sold', 'conn', 'write', true, false, false]
      ],
      loss: function (a, b, c) { return Math.max(0, a - c); },
      lossText: function (a, b, c, f) { return 'an offer of ' + f(c) + ' accepted without you = ' + f(a - c) + ' under your ' + f(a) + ' asking price (' + f(Math.max(0, b - c)) + ' under your ' + f(b) + ' floor)'; },
      goal: function (x, f) { return 'Handle buyer messages for my Facebook Marketplace listing: ' + x.item + ', asking ' + f(x.a) + '.'; },
      rules: function (x, f) {
        return [
          'Never accept, agree to or promise any price or deal. When a buyer makes an offer, reply "Thanks, I will confirm shortly" and ask me in chat with the buyer\'s name and the amount.',
          'Never offer or agree to anything below ' + f(x.b) + '. Offers below ' + f(x.b) + ' get a polite no without a counter.',
          'Never send my home address, phone number or full name. Send the pickup spot only after I reply YES to that buyer in this chat, and only as: [PICKUP SPOT].'
        ];
      }
    },
    inbox: {
      name: 'Sort the inbox and reply to email',
      connectors: ['Gmail (or another email Connector)'],
      a: '', b: '', c: '',
      ex: { item: 'work inbox, client and supplier emails', a: 0, b: 0, c: 0 },
      steps: [
        ['Read new emails', 'conn', 'read', true, false, false],
        ['Label emails by urgency', 'conn', 'write', true, false, false],
        ['Archive newsletters', 'conn', 'write', true, false, false],
        ['Draft replies', 'conn', 'write', true, false, false],
        ['Send replies', 'conn', 'write', false, false, true],
        ['', 'conn', 'write', false, false, false]
      ],
      loss: function () { return 0; },
      lossText: function () { return ''; },
      goal: function (x) { return 'Go through my inbox (' + x.item + ') and get it to a state where I only have to read what matters today.'; },
      rules: function () {
        return [
          'Write replies as drafts only. Do not send any email. List the drafts for me in chat with the recipient and the first line.',
          '',
          'Do not open links or attachments from senders I have never replied to.'
        ];
      }
    },
    meeting: {
      name: 'Book a meeting from an email thread',
      connectors: ['Gmail', 'Google Calendar'],
      a: '', b: '', c: '',
      ex: { item: 'a 30-minute call with a new client next week', a: 0, b: 0, c: 0 },
      steps: [
        ['Read the email thread', 'conn', 'read', true, false, false],
        ['Check the calendar for free slots', 'conn', 'read', true, false, false],
        ['Email the other person three time options', 'conn', 'write', false, false, true],
        ['Send the calendar invite', 'conn', 'write', false, false, true],
        ['Add a reminder before the meeting', 'conn', 'write', true, false, false]
      ],
      loss: function () { return 0; },
      lossText: function () { return ''; },
      goal: function (x) { return 'Set up ' + x.item + ' from the email thread I point you to.'; },
      rules: function () {
        return [
          'Show me the three times and the exact email text in chat before sending anything. Send only after I reply SEND.',
          'Create the calendar invite only after the other person confirms a time, and show it to me first.',
          'Do not share my calendar, other meetings or anyone else\'s email address in the reply.'
        ];
      }
    },
    shop: {
      name: 'Buy something online on a budget',
      connectors: ['Web browsing', ''],
      a: 'What you would normally pay', b: 'Your budget cap', c: 'A price Muse might find',
      ex: { item: 'a 27-inch monitor for home office work', a: 260, b: 250, c: 319 },
      steps: [
        ['Search stores for the item', 'web', 'read', true, false, false],
        ['Compare prices and reviews', 'web', 'read', true, false, false],
        ['Add the pick to a cart', 'web', 'write', true, false, false],
        ['Pay and place the order', 'web', 'buy', false, true, true]
      ],
      loss: function (a, b, c) { return Math.max(0, c - b); },
      lossText: function (a, b, c, f) { return c > b ? 'an order at ' + f(c) + ' placed without you = ' + f(c - b) + ' over your ' + f(b) + ' cap' : 'the price found is inside your ' + f(b) + ' cap'; },
      goal: function (x, f) { return 'Find and shortlist ' + x.item + '. Budget: ' + f(x.b) + ' all-in, shipping and tax included.'; },
      rules: function (x, f) {
        return [
          'Do not pay or place any order. Stop at the cart and show me the store, the total with shipping and tax, and the return window.',
          'Skip anything whose total is above ' + f(x.b) + '. Do not create store accounts or sign up for newsletters.',
          'Use only stores with a written return policy and show me the link to it.'
        ];
      }
    },
    trip: {
      name: 'Plan a trip: flights and hotel',
      connectors: ['Web browsing', 'Google Calendar', ''],
      a: 'Your usual trip cost', b: 'Your trip budget', c: 'A total Muse might find',
      ex: { item: '3 nights in Chicago, 2 adults, Dec 11 to Dec 14', a: 1400, b: 1200, c: 1460 },
      steps: [
        ['Search flights and hotels', 'web', 'read', true, false, false],
        ['Hold the best options', 'web', 'write', true, false, false],
        ['Book and pay', 'web', 'buy', false, true, true],
        ['Put the trip on the calendar', 'conn', 'write', true, false, false],
        ['Email the itinerary to travel partners', 'conn', 'write', false, false, true]
      ],
      loss: function (a, b, c) { return Math.max(0, c - b); },
      lossText: function (a, b, c, f) { return c > b ? 'a booking at ' + f(c) + ' made without you = ' + f(c - b) + ' over your ' + f(b) + ' budget' : 'the total found is inside your ' + f(b) + ' budget'; },
      goal: function (x, f) { return 'Plan ' + x.item + '. Total budget for flights and hotel: ' + f(x.b) + '.'; },
      rules: function (x, f) {
        return [
          'Do not book or pay for anything. Give me the 2 best combinations with total price, cancellation terms and the booking links.',
          'Prefer fares and rooms that can be cancelled for free; mark the ones that cannot.',
          'Do not send the itinerary to anyone. I will forward it myself.'
        ];
      }
    },
    watch: {
      name: 'Watch a price and alert me',
      connectors: ['Web browsing (scheduled task)', ''],
      a: 'Price today', b: 'Alert me at or below', c: 'A price that shows up later',
      ex: { item: 'a robot vacuum on two store websites', a: 399, b: 299, c: 349 },
      steps: [
        ['Check the store pages every day (scheduled task)', 'web', 'read', true, false, false],
        ['Send an alert', 'conn', 'write', true, false, false],
        ['Buy when the price drops', 'web', 'buy', false, true, true]
      ],
      loss: function (a, b, c) { return Math.max(0, c - b); },
      lossText: function (a, b, c, f) { return c > b ? 'a purchase at ' + f(c) + ' made without you = ' + f(c - b) + ' over your ' + f(b) + ' target' : 'the price that shows up is at or below your ' + f(b) + ' target'; },
      goal: function (x, f) { return 'Watch the price of ' + x.item + ' once a day. Alert me when it is ' + f(x.b) + ' or less.'; },
      rules: function (x) {
        return [
          'Never buy. Alerts only: send me the store, the price, the shipping cost and the link.',
          'Stop this scheduled task after 30 days or when I say STOP, and tell me it stopped.',
          'Do not sign in to any store account to check the price.'
        ];
      }
    },
    bill: {
      name: 'Call a provider to lower a bill',
      connectors: ['Phone calls', 'Gmail (for the account details email)'],
      a: 'Current monthly bill', b: 'Highest new bill you accept', c: 'A monthly offer heard on the call',
      ex: { item: 'home internet plan', a: 85, b: 60, c: 70 },
      steps: [
        ['Find the account details in the email', 'conn', 'read', true, false, false],
        ['Phone the provider', 'phone', 'write', false, false, true],
        ['Give account details on the call', 'phone', 'write', false, false, true],
        ['Agree to a new plan or contract', 'phone', 'write', false, true, false]
      ],
      loss: function (a, b, c) { return Math.max(0, c - b) * 12; },
      lossText: function (a, b, c, f) { return c > b ? 'a plan at ' + f(c) + ' a month agreed without you = 12 x ' + f(c - b) + ' = ' + f((c - b) * 12) + ' a year over your ' + f(b) + ' line' : 'the offer heard is at or below your ' + f(b) + ' line'; },
      goal: function (x, f) { return 'Call my provider about my ' + x.item + ' (now ' + f(x.a) + ' a month) and find out what lower plans or offers they have.'; },
      rules: function (x, f) {
        return [
          '',
          'Only offers at or below ' + f(x.b) + ' a month are worth reporting as a win; list the rest separately.',
          'Give only the account number and the account holder name [MY NAME]. Never give a card number, PIN, password or my date of birth.'
        ];
      }
    }
  };

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[^0-9.,-]/g, '');
    if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/,/g, '');
    else s = s.replace(/,/g, '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function usd(n) {
    n = Math.round(num(n) * 100) / 100;
    var neg = n < 0; n = Math.abs(n);
    var whole = Math.floor(n), cents = Math.round((n - whole) * 100);
    var w = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + '$' + w + (cents ? '.' + (cents < 10 ? '0' : '') + cents : '');
  }

  /* does this step run without a fresh yes under the chosen setting? */
  function unattended(step, conn, web) {
    var set = step[1] === 'web' ? web : conn;      // phone calls follow the Connector default
    var kind = step[2];
    if (set === 'always_ask') return false;
    if (set === 'some') return kind === 'read';      // asks before every write and before payments
    return true;                                      // task / always: that type of action runs again without asking
  }

  /* x = {task, conn, web, a, b, c, item, sign} → full answer */
  function build(x) {
    var T = TASKS[x.task] || TASKS.sell;
    var t = TASKS[x.task] ? x.task : 'sell';
    var conn = SETTINGS[x.conn] ? x.conn : 'some';
    var web = WEB_SETTINGS[x.web] ? x.web : 'some';
    var a = num(x.a), b = num(x.b), c = num(x.c);
    var item = String(x.item || T.ex.item).trim() || T.ex.item;
    var steps = T.steps.map(function (s) {
      var un = unattended(s, conn, web);
      return { text: s[0], door: s[1], kind: s[2], undo: s[3], money: s[4], personal: s[5], unattended: un };
    });
    var writes = steps.filter(function (s) { return s.kind !== 'read'; });
    var un = steps.filter(function (s) { return s.unattended; });
    var unWrite = un.filter(function (s) { return s.kind !== 'read'; });
    var noUndo = unWrite.filter(function (s) { return !s.undo; });
    var moneyUn = unWrite.some(function (s) { return s.money; });
    var hasMoney = steps.some(function (s) { return s.money; }) && T.a;
    var lossRaw = hasMoney ? T.loss(a, b, c) : 0;
    var loss = moneyUn ? lossRaw : 0;
    var f = usd;
    var X = { item: item, a: a, b: b, c: c };

    /* guard lines: the task's own rules + one "ask me before" line naming every write step that would run unasked */
    var guards = T.rules(X, f).slice();
    if (unWrite.length) {
      guards.push('Even where my settings allow it, ask me in chat before you: ' + unWrite.map(function (s) { return s.text.charAt(0).toLowerCase() + s.text.slice(1); }).join('; ') + '.');
    }
    if (x.sign !== false && x.sign !== 'no') guards.push('End every message you send for me with: "(sent by my Muse assistant)".');
    guards.push('When you finish, list every action you took, in order, with the time, so I can check it against the Activity log.');

    var lines = [];
    lines.push('Goal: ' + T.goal(X, f));
    lines.push('');
    lines.push('Rules for this task (they override any permission I have given you):');
    guards.forEach(function (g, i) { lines.push((i + 1) + '. ' + g); });
    lines.push('');
    lines.push('Before you start, repeat these rules back to me in one short list and wait for my OK.');
    var prompt = lines.join('\n');

    /* privacy-safe version: nothing personal typed into the item line goes to Muse */
    var safe = prompt.split(item).join('[ITEM: short description, no names, addresses or order numbers]');
    safe = safe.replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[EMAIL]').replace(/\+?\d[\d ()-]{7,}\d/g, '[PHONE]');

    /* settings checklist (Meta's own menu names) */
    var checklist = [];
    checklist.push('Settings → Permissions → Connectors: set ' + (conn === 'always_ask' ? '"Always ask" (keep it)' : '"Ask for some actions" or "Always ask"') + ' for ' + T.connectors.filter(function (n) { return !/^Web|^Link|^Phone/.test(n); }).map(function (n) { return n.replace(/ \(.*\)$/, ''); }).join(' and ') + (T.connectors.some(function (n) { return !/^Web|^Link|^Phone/.test(n); }) ? '' : 'the Connectors this task touches') + '.');
    if (conn === 'always') checklist.push('Settings → Permissions → Connectors → open the Connector and remove "Always allow": ' + noUndo.filter(function (s) { return s.door !== 'web'; }).length + ' step(s) in this task cannot be undone.');
    if (steps.some(function (s) { return s.door === 'web'; })) checklist.push('Settings → Permissions → Web access defaults: "Ask for some actions" at least; ' + (web === 'always' ? 'open Allowed websites and revoke the sites this task does not need.' : 'check Allowed websites after the task.'));
    if (t === 'inbox' || t === 'meeting' || t === 'bill') checklist.push('Settings: decide whether Muse may read new emails; turn it off if you only want it to work on threads you point to.');
    if (t === 'watch') checklist.push('Assistant icon → Upcoming: check the scheduled task is there, and remove it when you are done.');
    checklist.push('Tap "See task details" on every permission request, and choose "Allow once" rather than "Always allow" for steps that send, pay or share.');
    checklist.push('After the task: assistant icon → Activity log, compare it with the list Muse gives you.');

    return {
      task: t, name: T.name, connectors: T.connectors, conn: conn, web: web, item: item, a: a, b: b, c: c,
      labels: { a: T.a, b: T.b, c: T.c },
      steps: steps, nSteps: steps.length, nWrite: writes.length, nUnattended: unWrite.length, nNoUndo: noUndo.length,
      hasMoney: !!hasMoney, lossRaw: lossRaw, loss: loss, moneyUnattended: moneyUn,
      lossLine: hasMoney ? T.lossText(a, b, c, f) : '',
      guards: guards, nGuards: guards.length, prompt: prompt, safe: safe, checklist: checklist
    };
  }

  /* ---- Pro helpers (pure) ---- */
  function audit(list) {
    var by = {}, tot = { workflows: 0, unattended: 0, noUndo: 0, loss: 0 };
    (list || []).forEach(function (w) {
      var r = build(w);
      tot.workflows++; tot.unattended += r.nUnattended; tot.noUndo += r.nNoUndo; tot.loss += r.loss;
      r.connectors.forEach(function (c) {
        var k = c.replace(/ \(.*\)$/, '');
        var o = by[k] || (by[k] = { connector: k, workflows: 0, unattended: 0, noUndo: 0 });
        o.workflows++;
        r.steps.forEach(function (s) {
          var doorOk = (s.door === 'web') === /^Web|^Link/.test(k) || (s.door === 'phone' && /^Phone/.test(k));
          if (doorOk && s.unattended && s.kind !== 'read') { o.unattended++; if (!s.undo) o.noUndo++; }
        });
      });
    });
    return { total: tot, rows: Object.keys(by).sort().map(function (k) { return by[k]; }) };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()); }
  /* weekly permission review reminders: n weeks from the first date (YYYY-MM-DD) */
  function ics(first, weeks, names, stamp) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(first || '');
    if (!m) return '';
    var d0 = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yoojin//muse-ai-prompts//EN', 'CALSCALE:GREGORIAN'];
    var st = stamp || '20261118T000000Z';
    for (var i = 0; i < weeks; i++) {
      var d = new Date(d0 + i * 7 * 86400000), e = new Date(d0 + i * 7 * 86400000 + 86400000);
      out.push('BEGIN:VEVENT', 'UID:muse-review-' + ymd(d) + '-' + i + '@muse-ai-prompts', 'DTSTAMP:' + st,
        'DTSTART;VALUE=DATE:' + ymd(d), 'DTEND;VALUE=DATE:' + ymd(e),
        'SUMMARY:Muse permission review (' + (names || []).length + ' workflows)',
        'DESCRIPTION:Settings > Permissions > Connectors: remove Always allow you no longer need. Allowed websites: revoke. Upcoming: end old scheduled tasks. Activity log: check last week. Workflows: ' + String((names || []).join(', ')).replace(/[,;\\]/g, function (ch) { return '\\' + ch; }),
        'BEGIN:VALARM', 'TRIGGER:PT9H', 'ACTION:DISPLAY', 'DESCRIPTION:Muse permission review', 'END:VALARM', 'END:VEVENT');
    }
    out.push('END:VCALENDAR');
    return out.join('\r\n') + '\r\n';
  }

  function exportJSON(list) { return JSON.stringify({ app: 'muse-ai-prompts', v: 1, workflows: list || [] }, null, 1); }
  function importJSON(txt) {
    var j = JSON.parse(txt);
    var L = Array.isArray(j) ? j : (j && j.workflows);
    if (!Array.isArray(L)) throw new Error('no workflows in this file');
    return L.filter(function (w) { return w && TASKS[w.task]; }).map(function (w) {
      return { id: String(w.id || ('w' + Math.random().toString(36).slice(2, 9))), title: String(w.title || TASKS[w.task].name).slice(0, 80),
        task: w.task, conn: w.conn, web: w.web, a: num(w.a), b: num(w.b), c: num(w.c), item: String(w.item || ''), sign: w.sign !== false, saved: String(w.saved || '') };
    });
  }

  var API = { TASKS: TASKS, SETTINGS: SETTINGS, WEB_SETTINGS: WEB_SETTINGS, build: build, audit: audit, ics: ics,
    exportJSON: exportJSON, importJSON: importJSON, usd: usd, num: num };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MUSE = API;
})(this);
