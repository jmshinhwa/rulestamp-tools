/* automation scripts — preview engine. The same rules as the Python scripts the page builds (py.js); test/parity.js runs both on the same files. */
(function (root) {
  'use strict';

  // ---------- reading ----------
  function sniff(text) {
    var line = String(text || '').split(/\r?\n/)[0] || '', q = false, c = { ',': 0, ';': 0, '\t': 0 };
    for (var i = 0; i < line.length; i++) { var ch = line[i]; if (ch === '"') q = !q; else if (!q && ch in c) c[ch]++; }
    var best = ',', n = c[','];
    if (c[';'] > n) { best = ';'; n = c[';']; }
    if (c['\t'] > n) { best = '\t'; }
    return best;
  }
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    var d = sniff(text), rows = [], row = [], cell = '', q = false, i = 0;
    for (; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
    var headers = (rows.shift() || []).map(function (h) { return String(h).trim(); });
    return { headers: headers, rows: rows, delim: d };
  }
  function toCSV(headers, rows) {
    function esc(v) { v = v == null ? '' : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return [headers].concat(rows).map(function (r) { return r.map(esc).join(','); }).join('\r\n') + '\r\n';
  }
  function cents(x) { return x < 0 ? -Math.floor(-x * 100 + 0.5) : Math.floor(x * 100 + 0.5); }
  function money(s) {
    s = String(s == null ? '' : s).trim();
    if (!s) return null;
    var neg = /^\(.*\)$/.test(s) || /^-|^[^\d]*-/.test(s) || /-$/.test(s);
    var t = s.replace(/[^\d.,]/g, '');
    if (!/\d/.test(t)) return null;
    var c = t.lastIndexOf(','), p = t.lastIndexOf('.');
    if (c >= 0 && p >= 0) { if (c > p) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, ''); }
    else if (c >= 0) { t = /,\d{1,2}$/.test(t) && t.split(',').length === 2 ? t.replace(',', '.') : t.replace(/,/g, ''); }
    else if (p >= 0 && t.split('.').length > 2) t = t.replace(/\./g, '');
    var v = parseFloat(t);
    if (isNaN(v)) return null;
    return (neg ? -1 : 1) * cents(v) / 100;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateOf(s, fmt) {
    s = String(s == null ? '' : s).trim().split(/[\sT]/)[0];
    if (!s) return null;
    var m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/), y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else {
      m = s.match(/^(\d{1,2})([-/.])(\d{1,2})[-/.](\d{2}|\d{4})$/);
      if (!m) return null;
      var a = +m[1], b = +m[3]; y = +m[4]; if (y < 100) y += 2000;
      var f = fmt === 'dmy' || fmt === 'mdy' ? fmt : (m[2] === '.' || a > 12 ? 'dmy' : 'mdy');
      if (f === 'dmy') { d = a; mo = b; } else { mo = a; d = b; }
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCMonth() !== mo - 1) return null;
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  function dnum(iso) { var p = iso.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
  function diso(n) { var t = new Date(n * 864e5); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function nice(iso) { if (!iso) return ''; var p = iso.split('-'); return MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }
  function usd(x) {
    var c = cents(x), neg = c < 0; c = Math.abs(c);
    var s = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + s + '.' + pad(c % 100);
  }

  // ---------- column guesses (the page shows them; the buyer can change each one) ----------
  var GUESS = {
    invoice: /invoice|^inv|number|^no\.?$|^#/i, client: /client|customer|company|^name$|bill to/i, email: /e-?mail/i,
    amount: /^(?!.*paid)(?!.*received).*(amount|total|sum|value|price)/i, due: /due/i,
    paid: /^(?!.*amount)(paid( on| date)?|date paid|payment date|paid at)$/i, amount_paid: /amount paid|paid amount|received/i,
    phone: /phone|mobile|tel/i, date: /date|posted|booked/i, description: /desc|memo|payee|details|narrative|merchant|text/i
  };
  function guess(headers, field, taken) {
    for (var i = 0; i < headers.length; i++) if (GUESS[field].test(headers[i]) && !(taken || []).includes(i)) return i;
    return -1;
  }
  function guessMap(headers, fields) {
    var m = {}, taken = [];
    ['amount_paid', 'paid', 'due', 'email', 'phone', 'invoice', 'client', 'amount', 'date', 'description'].forEach(function (f) {
      if (fields.indexOf(f) < 0) return;
      var i = guess(headers, f, taken); m[f] = i; if (i >= 0) taken.push(i);
    });
    return m;
  }
  function cell(r, i) { return i >= 0 && i < r.length ? String(r[i]).trim() : ''; }

  // ---------- 1. overdue invoices + reminder drafts ----------
  var BUCKETS = [[1, 30], [31, 60], [61, 90], [91, 1e9]];
  function bucketOf(d) { for (var i = 0; i < BUCKETS.length; i++) if (d >= BUCKETS[i][0] && d <= BUCKETS[i][1]) return i; return -1; }
  var BNAME = ['1-30 days', '31-60 days', '61-90 days', '91+ days'];
  function runOverdue(tab, map, st) {
    var asof = st.asof, grace = +st.grace || 0, A = dnum(asof), out = [], open = [], skipped = 0;
    tab.rows.forEach(function (r, ix) {
      var amt = money(cell(r, map.amount)), due = dateOf(cell(r, map.due), st.datefmt);
      if (amt == null || !due) { skipped++; return; }
      var paidAmt = map.amount_paid >= 0 ? (money(cell(r, map.amount_paid)) || 0) : null;
      var owed = paidAmt != null ? cents(amt - paidAmt) / 100 : (cell(r, map.paid) ? 0 : amt);
      if (owed <= 0) return;
      var late = A - dnum(due);
      var row = { line: ix + 2, invoice: cell(r, map.invoice) || ('line ' + (ix + 2)), client: cell(r, map.client) || '(no client)', email: cell(r, map.email),
        due: due, amount: amt, owed: owed, days_late: late };
      if (late > grace) {
        var b = bucketOf(late); row.bucket = BNAME[b];
        row.next = b < 3 ? diso(dnum(due) + BUCKETS[b + 1][0]) : '';
        out.push(row);
      } else open.push(row);
    });
    out.sort(function (a, b) { return b.days_late - a.days_late || (a.invoice < b.invoice ? -1 : a.invoice > b.invoice ? 1 : 0); });
    var sumC = 0, bc = [0, 0, 0, 0], clients = {}, order = [];
    out.forEach(function (o) {
      sumC += cents(o.owed); bc[BNAME.indexOf(o.bucket)] += cents(o.owed);
      if (!clients[o.client]) { clients[o.client] = []; order.push(o.client); }
      clients[o.client].push(o);
    });
    var nexts = out.filter(function (o) { return o.next; }).sort(function (a, b) { return a.next < b.next ? -1 : a.next > b.next ? 1 : 0; });
    var openC = open.reduce(function (s, o) { return s + cents(o.owed); }, 0);
    var mails = order.map(function (c) { return { client: c, email: clients[c][0].email, text: reminder(c, clients[c], st) }; });
    var sum = {
      overdue_total: sumC / 100, overdue_count: out.length, clients: order.length, reminders: mails.length,
      oldest_days: out.length ? out[0].days_late : 0, oldest_invoice: out.length ? out[0].invoice : '',
      b1_30: bc[0] / 100, b31_60: bc[1] / 100, b61_90: bc[2] / 100, b91: bc[3] / 100,
      over_60: (bc[2] + bc[3]) / 100, not_due_total: openC / 100, not_due_count: open.length, skipped: skipped,
      next_date: nexts.length ? nexts[0].next : '', next_invoice: nexts.length ? nexts[0].invoice : '', next_days: nexts.length ? dnum(nexts[0].next) - dnum(nexts[0].due) : 0
    };
    var csv = toCSV(['Invoice', 'Client', 'Email', 'Due date', 'Amount', 'Still owed', 'Days late', 'Bucket', 'Enters next bucket'],
      out.map(function (o) { return [o.invoice, o.client, o.email, o.due, o.amount.toFixed(2), o.owed.toFixed(2), o.days_late, o.bucket, o.next]; }));
    var files = { 'overdue_report.csv': csv };
    mails.forEach(function (m) { files['reminders/' + safeName(m.client) + '.txt'] = m.text; });
    return { summary: sum, rows: out, mails: mails, files: files };
  }
  function reminder(client, list, st) {
    var tot = list.reduce(function (s, o) { return s + cents(o.owed); }, 0) / 100;
    var worst = list.reduce(function (m, o) { return Math.max(m, o.days_late); }, 0);
    var subj = list.length === 1 ? 'Invoice ' + list[0].invoice + ' is ' + worst + ' days past due' : list.length + ' invoices past due, ' + usd(tot) + ' in total';
    var open = worst > 60 ? 'This is a final reminder before I pause further work on your account.' : worst > 30 ? 'I have not yet received payment for the invoice(s) below and would be grateful if you could settle them this week.' : 'A quick reminder that the invoice(s) below are now past their due date.';
    var lines = list.map(function (o) { return '- ' + o.invoice + ': ' + usd(o.owed) + ', due ' + nice(o.due) + ' (' + o.days_late + ' days ago)'; });
    return 'Subject: ' + subj + '\n\nHello ' + client + ',\n\n' + open + '\n\n' + lines.join('\n') + '\n\nTotal now due: ' + usd(tot) + '\n' +
      (st.paynote ? '\n' + st.paynote + '\n' : '') + '\nThank you,\n' + (st.yourname || '') + '\n';
  }
  function safeName(s) { s = String(s || '').replace(/[^A-Za-z0-9 ._-]+/g, '').trim().replace(/\s+/g, '_'); return (s || 'blank').slice(0, 60); }

  // ---------- 2. merge & dedupe contacts ----------
  var EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function runDedupe(tab, map, st) {
    var seen = {}, keep = [], dups = [], invalid = 0, blank = 0, filled = 0;
    tab.rows.forEach(function (r, ix) {
      var e = cell(r, map.email).toLowerCase(), key = '';
      if (!e) blank++; else if (!EMAIL_RX.test(e)) invalid++; else key = 'e:' + e;
      if (!key && st.phone && map.phone >= 0) { var ph = cell(r, map.phone).replace(/\D/g, '').slice(-10); if (ph.length >= 7) key = 'p:' + ph; }
      var row = tab.headers.map(function (_, i) { return cell(r, i); });
      if (key && seen[key] != null) {
        var k = keep[seen[key]];
        row.forEach(function (v, i) { if (!k.row[i] && v) { k.row[i] = v; filled++; } });
        dups.push({ line: ix + 2, of: k.line, key: key.slice(2), row: row });
      } else {
        if (key) seen[key] = keep.length;
        keep.push({ line: ix + 2, row: row });
      }
    });
    var sum = { rows_in: tab.rows.length, kept: keep.length, duplicates: dups.length, invalid_emails: invalid, blank_emails: blank, cells_filled: filled };
    var files = {
      'contacts_clean.csv': toCSV(tab.headers, keep.map(function (k) { return k.row; })),
      'duplicates_removed.csv': toCSV(['Line', 'Duplicate of line', 'Matched on'].concat(tab.headers), dups.map(function (d) { return [d.line, d.of, d.key].concat(d.row); }))
    };
    return { summary: sum, rows: dups, kept: keep, files: files };
  }

  // ---------- 3. bank transactions by category ----------
  function parseRules(text) {
    return String(text || '').split(/\r?\n/).map(function (l) {
      var m = l.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/); return m ? { k: m[1].toLowerCase(), cat: m[2] } : null;
    }).filter(Boolean);
  }
  function runBank(tab, map, st) {
    var rules = parseRules(st.rules), flip = st.sign === 'positive', cats = {}, months = {}, rows = [], unc = [], skipped = 0, spendC = 0, inC = 0;
    tab.rows.forEach(function (r, ix) {
      var a = money(cell(r, map.amount)), d = dateOf(cell(r, map.date), st.datefmt), desc = cell(r, map.description);
      if (a == null || !d) { skipped++; return; }
      if (flip) a = -a;
      var low = desc.toLowerCase(), cat = '';
      for (var i = 0; i < rules.length; i++) if (low.indexOf(rules[i].k) >= 0) { cat = rules[i].cat; break; }
      if (!cat) cat = a > 0 ? 'Income (no rule)' : 'Uncategorized';
      var mo = d.slice(0, 7), c = cents(a);
      if (c < 0) spendC += -c; else inC += c;
      cats[cat] = (cats[cat] || 0) + c;
      months[mo] = months[mo] || {}; months[mo][cat] = (months[mo][cat] || 0) + c;
      var row = { line: ix + 2, date: d, description: desc, amount: c / 100, category: cat };
      rows.push(row); if (cat === 'Uncategorized') unc.push(row);
    });
    var list = Object.keys(cats).map(function (k) { return { category: k, total: cats[k] / 100 }; })
      .sort(function (a, b) { return a.total - b.total || (a.category < b.category ? -1 : 1); });
    var uncC = unc.reduce(function (s, o) { return s + cents(o.amount); }, 0);
    var top = list.filter(function (x) { return x.total < 0 && x.category !== 'Uncategorized'; })[0];
    var sum = { transactions: rows.length, categories: list.length, spending: spendC / 100, income: inC / 100, uncategorized_count: unc.length,
      uncategorized_total: -uncC / 100, top_category: top ? top.category : '', top_total: top ? -top.total : 0, months: Object.keys(months).length, skipped: skipped };
    var mrows = [];
    Object.keys(months).sort().forEach(function (mo) { Object.keys(months[mo]).sort().forEach(function (c) { mrows.push([mo, c, (months[mo][c] / 100).toFixed(2)]); }); });
    var files = {
      'transactions_categorized.csv': toCSV(['Date', 'Description', 'Amount', 'Category'], rows.map(function (o) { return [o.date, o.description, o.amount.toFixed(2), o.category]; })),
      'category_totals_by_month.csv': toCSV(['Month', 'Category', 'Total'], mrows)
    };
    return { summary: sum, rows: rows, cats: list, unc: unc, files: files };
  }

  // ---------- 4. rename and sort files ----------
  var TYPES = { Images: 'jpg jpeg png gif heic webp bmp tif tiff svg', Documents: 'pdf doc docx txt rtf odt md pages', Spreadsheets: 'xls xlsx csv ods numbers',
    Video: 'mp4 mov avi mkv webm', Audio: 'mp3 wav m4a aac flac ogg', Archives: 'zip rar 7z tar gz' };
  function typeOf(ext) { ext = ext.toLowerCase(); for (var k in TYPES) if ((' ' + TYPES[k] + ' ').indexOf(' ' + ext + ' ') >= 0) return k; return 'Other'; }
  function cleanBase(b, st) {
    if (st.lower) b = b.toLowerCase();
    if (st.tidy) b = b.replace(/[^A-Za-z0-9._ -]+/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return b || 'file';
  }
  function runFiles(list, st) {
    var used = {}, plan = [], renamed = 0, moved = 0, same = 0, clash = 0, folders = {};
    list.slice().sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; }).forEach(function (f) {
      var dot = f.name.lastIndexOf('.'), base = dot > 0 ? f.name.slice(0, dot) : f.name, ext = dot > 0 ? f.name.slice(dot + 1) : '';
      var nb = cleanBase(base, st);
      if (st.date && !/^\d{4}-\d{2}-\d{2}/.test(nb)) nb = f.modified + '_' + nb;
      var folder = st.folder === 'month' ? f.modified.slice(0, 7) : st.folder === 'type' ? typeOf(ext) : '';
      var tail = ext ? '.' + (st.lower ? ext.toLowerCase() : ext) : '', target = (folder ? folder + '/' : '') + nb + tail, n = 2;
      while (used[target.toLowerCase()]) { target = (folder ? folder + '/' : '') + nb + '-' + n + tail; n++; }
      if (n > 2) clash++;
      used[target.toLowerCase()] = 1;
      if (folder) { folders[folder] = 1; moved++; }
      var newName = target.slice(folder ? folder.length + 1 : 0);
      if (newName !== f.name) renamed++;
      if (target === f.name) same++;
      plan.push({ from: f.name, to: target, modified: f.modified });
    });
    var sum = { files: plan.length, renamed: renamed, moved: moved, unchanged: same, clashes_fixed: clash, folders: Object.keys(folders).length };
    return { summary: sum, rows: plan, files: { 'rename_plan.csv': toCSV(['Now', 'Becomes', 'Modified'], plan.map(function (p) { return [p.from, p.to, p.modified]; })) } };
  }

  // ---------- 5. split one CSV into one file per client ----------
  function runSplit(tab, map, st) {
    var groups = {}, order = [], sumCol = map.amount;
    tab.rows.forEach(function (r) {
      var v = cell(r, map.by) || '(blank)';
      if (!groups[v]) { groups[v] = { rows: [], c: 0 }; order.push(v); }
      var row = tab.headers.map(function (_, i) { return cell(r, i); });
      groups[v].rows.push(row);
      if (sumCol >= 0) { var a = money(cell(r, sumCol)); if (a != null) groups[v].c += cents(a); }
    });
    order.sort(function (a, b) { return groups[b].rows.length - groups[a].rows.length || (a < b ? -1 : 1); });
    var files = {}, names = {}, list = [];
    order.forEach(function (v) {
      var fn = safeName(v), k = fn, n = 2; while (names[k.toLowerCase()]) { k = fn + '-' + n; n++; }
      names[k.toLowerCase()] = 1;
      files['split/' + k + '.csv'] = toCSV(tab.headers, groups[v].rows);
      list.push({ value: v, file: k + '.csv', rows: groups[v].rows.length, total: sumCol >= 0 ? groups[v].c / 100 : null });
    });
    var sum = { rows_in: tab.rows.length, files: list.length, largest: list.length ? list[0].value : '', largest_rows: list.length ? list[0].rows : 0,
      total: sumCol >= 0 ? list.reduce(function (s, x) { return s + cents(x.total); }, 0) / 100 : 0 };
    return { summary: sum, rows: list, files: files };
  }

  // ---------- made-up examples ----------
  var EX = {};
  EX.overdue = 'Invoice,Client,Email,Amount,Issued,Due date,Paid on\n' +
    'INV-1031,Northfield Dental,accounts@northfield-dental.example,"$1,250.00",2026-07-20,2026-08-19,\n' +
    'INV-1033,Harbor & Pine Cafe,owner@harborpine.example,$480.00,2026-08-05,2026-09-04,2026-09-02\n' +
    'INV-1034,Lumen Yoga Studio,hello@lumenyoga.example,$650.00,2026-08-14,2026-09-13,\n' +
    'INV-1036,Northfield Dental,accounts@northfield-dental.example,$900.00,2026-09-01,2026-10-01,\n' +
    'INV-1037,Brightside Realty,ap@brightside.example,"$2,100.00",2026-09-10,2026-10-10,2026-10-08\n' +
    'INV-1038,Okafor Law Office,billing@okaforlaw.example,$1100,2026-09-22,2026-10-22,\n' +
    'INV-1039,Harbor & Pine Cafe,owner@harborpine.example,$360.00,2026-09-30,2026-10-30,\n' +
    'INV-1040,Lumen Yoga Studio,hello@lumenyoga.example,$650.00,2026-10-05,2026-11-04,\n' +
    'INV-1041,Brightside Realty,ap@brightside.example,"$1,800.00",2026-10-15,2026-11-14,2026-11-12\n' +
    'INV-1042,Kestrel Bikes,shop@kestrelbikes.example,$975.50,2026-10-20,2026-11-19,\n' +
    'INV-1043,Okafor Law Office,billing@okaforlaw.example,$1100,2026-10-24,2026-11-23,\n' +
    'INV-1044,Northfield Dental,accounts@northfield-dental.example,$900.00,2026-11-01,2026-12-01,\n';
  EX.dedupe = 'Name,Email,Phone,Company,Source\n' +
    'Maya Chen,maya.chen@example.com,(415) 555-0142,Chen Design,Webinar\n' +
    'Luis Ortega,luis@ortega-co.example,,Ortega & Co,Shop form\n' +
    'maya chen, Maya.Chen@Example.com ,,Chen Design Studio,Newsletter\n' +
    'Priya Nair,priya.nair@example.org,+1 312 555 0199,,Webinar\n' +
    'Tom Becker,tom.becker@example,555-0101,Becker Plumbing,Shop form\n' +
    'Ana Souza,ana.souza@example.net,,Souza Fotografia,Newsletter\n' +
    'Priya Nair,PRIYA.NAIR@example.org,,Nair Consulting,Shop form\n' +
    'Jordan Lee,,212-555-0177,Lee Fitness,Webinar\n' +
    'Ana Souza,ana.souza@example.net,+55 11 5555-0123,,Webinar\n' +
    'Luis Ortega,luis@ortega-co.example,646 555 0110,,Newsletter\n';
  EX.bank = 'Date,Description,Amount\n' +
    '10/01/2026,ADOBE *CREATIVE CLOUD,-59.99\n10/02/2026,CLIENT PAYMENT NORTHFIELD DENTAL,"1,250.00"\n10/03/2026,SHELL OIL 5521,-48.20\n' +
    '10/05/2026,GOOGLE *WORKSPACE,-14.00\n10/07/2026,COSTCO WHSE #118,-212.47\n10/09/2026,UBER *TRIP,-23.80\n10/12/2026,ZOOM.US,-15.99\n' +
    '10/14/2026,STARBUCKS #2231,-6.45\n10/15/2026,CLIENT PAYMENT BRIGHTSIDE REALTY,"2,100.00"\n10/18/2026,AMAZON MKTPL*2K4,-89.12\n' +
    '10/21/2026,SHELL OIL 5521,-51.03\n10/24/2026,VENMO *J LEE,-120.00\n10/28/2026,STARBUCKS #2231,-5.95\n' +
    '11/01/2026,ADOBE *CREATIVE CLOUD,-59.99\n11/03/2026,COMCAST BUSINESS,-89.00\n11/05/2026,GOOGLE *WORKSPACE,-14.00\n' +
    '11/06/2026,UBER *TRIP,-31.40\n11/08/2026,CLIENT PAYMENT LUMEN YOGA,650.00\n11/10/2026,AMAZON MKTPL*7Q1,-42.66\n11/12/2026,SQ *FARMERS MARKET,-27.00\n';
  EX.rules = 'adobe = Software\ngoogle *workspace = Software\nzoom = Software\ncomcast = Internet & phone\nshell = Car & fuel\nuber = Travel\n' +
    'starbucks = Meals\ncostco = Office supplies\namazon = Office supplies\nclient payment = Client income\n';
  EX.files = 'IMG_4421.JPG,2026-10-03\nIMG_4422.JPG,2026-10-03\nInvoice Final (2).pdf,2026-10-15\nInvoice Final.pdf,2026-10-15\n' +
    'Screenshot 2026-11-02 at 09.14.22.png,2026-11-02\nclient brief  v3.docx,2026-11-04\nQ3 numbers.xlsx,2026-10-28\nlogo-draft.png,2026-11-09\n' +
    'contract_signed.PDF,2026-11-10\nvoice memo.m4a,2026-11-11\n';
  EX.split = 'Date,Client,Task,Hours,Amount\n' +
    '2026-11-02,Northfield Dental,Homepage edits,3,$270.00\n2026-11-02,Kestrel Bikes,Product photos retouch,5,$450.00\n' +
    '2026-11-03,Okafor Law Office,Letterhead,2,$180.00\n2026-11-04,Northfield Dental,Booking page,4,$360.00\n' +
    '2026-11-05,Lumen Yoga Studio,Class schedule flyer,2.5,$225.00\n2026-11-06,Kestrel Bikes,Banner set,3,$270.00\n' +
    '2026-11-09,Northfield Dental,Newsletter template,2,$180.00\n2026-11-10,Okafor Law Office,Business cards,1.5,$135.00\n' +
    '2026-11-11,Kestrel Bikes,Social posts,4,$360.00\n';
  function filesFromText(t) {
    return String(t || '').split(/\r?\n/).map(function (l) {
      var m = l.match(/^(.*\S)\s*,\s*(\d{4}-\d{2}-\d{2})\s*$/); return m ? { name: m[1].trim(), modified: m[2] } : null;
    }).filter(Boolean);
  }

  var API = { sniff: sniff, parseCSV: parseCSV, toCSV: toCSV, money: money, dateOf: dateOf, dnum: dnum, diso: diso, nice: nice, usd: usd, cents: cents,
    guessMap: guessMap, runOverdue: runOverdue, runDedupe: runDedupe, runBank: runBank, runFiles: runFiles, runSplit: runSplit, filesFromText: filesFromText,
    safeName: safeName, typeOf: typeOf, EX: EX, BNAME: BNAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.AS = API;
})(this);
