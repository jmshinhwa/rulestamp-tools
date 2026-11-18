/* automation scripts — page logic. Files are read in this browser only; Pro setups are kept in localStorage. */
(function () {
  'use strict';
  var doc = document, A = window.AS, PY = window.ASPY, LS = window.localStorage;
  var SLUG = 'automation-scripts-python-preview', DOORS = [SLUG, SLUG + '.once', SLUG + '.monthly'];
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var FIELDS = {
    overdue: [['invoice', 'Invoice number', 0], ['client', 'Client', 0], ['email', 'Email', 0], ['amount', 'Amount', 1], ['due', 'Due date', 1], ['paid', 'Paid on (empty = open)', 0], ['amount_paid', 'Amount paid (if you have it)', 0]],
    dedupe: [['email', 'Email', 1], ['phone', 'Phone', 0]],
    bank: [['date', 'Date', 1], ['description', 'Description', 1], ['amount', 'Amount', 1]],
    split: [['by', 'Split by', 1], ['amount', 'Amount to total (optional)', 0]],
    files: []
  };
  var GUESSF = { by: 'client' };
  var state = { script: 'overdue', own: {}, map: {}, last: null };
  var pro = false;

  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function table() {
    var s = state.script, t = state.own[s];
    if (t) return t.tab;
    return A.parseCSV(A.EX[s]);
  }
  function buildCols() {
    var s = state.script, f = FIELDS[s], box = $('cols');
    if (!f.length) { box.innerHTML = ''; return; }
    var t = table(), h = t.headers, g = A.guessMap(h, f.map(function (x) { return GUESSF[x[0]] || x[0]; }));
    var m = state.map[s] || {};
    box.innerHTML = '<p class="hint wide">Columns found in the file: ' + h.length + '. Check that each box points at the right one.</p>' + f.map(function (x) {
      var cur = x[0] in m ? m[x[0]] : g[GUESSF[x[0]] || x[0]];
      if (s === 'split' && x[0] === 'amount' && !(x[0] in m)) cur = g.amount;
      var opts = (x[2] ? '' : '<option value="-1">(none)</option>') + h.map(function (n, i) { return '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
      return '<label>' + esc(x[1]) + '<select data-col="' + x[0] + '" data-k>' + opts + '</select></label>';
    }).join('');
  }
  function readMap() {
    var m = {};
    Array.prototype.forEach.call($('cols').querySelectorAll('select[data-col]'), function (sel) { m[sel.getAttribute('data-col')] = +sel.value; });
    return m;
  }
  function settings() {
    var s = state.script;
    if (s === 'overdue') return { asof: $('asof').value || today(), grace: +$('grace').value || 0, datefmt: $('datefmt').value, yourname: $('yourname').value.trim(), paynote: $('paynote').value.trim() };
    if (s === 'dedupe') return { phone: $('phone').value === '1' };
    if (s === 'bank') return { rules: $('rules').value, sign: $('sign').value, datefmt: $('bdatefmt').value };
    if (s === 'files') return { lower: $('ftidy').value === '1', tidy: $('ftidy').value === '1', date: $('fdate').value === '1', folder: $('ffolder').value };
    return {};
  }
  function fileList() {
    if (state.own.files) return state.own.files.list;
    return A.filesFromText($('flist').value);
  }
  function run() {
    var s = state.script, st = settings(), r;
    if (s === 'files') r = A.runFiles(fileList(), st);
    else {
      var t = table(), m = readMap(); state.map[s] = m;
      if (s === 'overdue') r = A.runOverdue(t, m, st);
      else if (s === 'dedupe') r = A.runDedupe(t, m, st);
      else if (s === 'bank') r = A.runBank(t, m, st);
      else r = A.runSplit(t, m, st);
    }
    state.last = { script: s, r: r, st: st };
    $('out').innerHTML = VIEW[s](r, st);
  }
  function big(items) { return '<div class="big">' + items.map(function (x) { return '<div class="n' + (x[2] ? ' ' + x[2] : '') + '"><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>'; }
  function tbl(head, rows) { return '<div class="tablewrap"><table><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }
  var VIEW = {
    overdue: function (r, st) {
      var s = r.summary, src = state.own.overdue ? state.own.overdue.name : 'invoices.csv (made-up example)';
      var h = '<p class="cap">' + esc(src) + ' · checked as of ' + esc(A.nice(st.asof)) + '</p>';
      h += big([[A.usd(s.overdue_total), 'unpaid past the due date on ' + s.overdue_count + ' invoices', 'bad'], [A.usd(s.over_60), 'more than 60 days late', 'bad'],
        [s.oldest_days + ' days', 'oldest: ' + (s.oldest_invoice || 'none')], [String(s.reminders), 'reminder emails drafted, one per client']]);
      if (s.next_date) h += '<p class="next">Next to get older: <b>' + esc(s.next_invoice) + '</b> turns ' + s.next_days + ' days late on <b>' + esc(A.nice(s.next_date)) + '</b>.</p>';
      h += '<p class="bars">' + ['b1_30', 'b31_60', 'b61_90', 'b91'].map(function (k, i) { return '<span>' + A.BNAME[i] + ': <b>' + A.usd(s[k]) + '</b></span>'; }).join('') + '</p>';
      if (s.not_due_count) h += '<p class="hint">Not due yet: ' + s.not_due_count + ' invoices, ' + A.usd(s.not_due_total) + '.</p>';
      if (s.skipped) h += '<p class="warn">' + s.skipped + ' rows skipped: no readable amount or due date. Check the column boxes.</p>';
      h += tbl(['Invoice', 'Client', 'Still owed', 'Due', 'Days late', 'Bucket', 'Enters next bucket'], r.rows.map(function (o) { return [o.invoice, o.client, A.usd(o.owed), A.nice(o.due), o.days_late, o.bucket, o.next ? A.nice(o.next) : '-']; }));
      h += r.mails.map(function (m) { return '<details><summary>Reminder to ' + esc(m.client) + (m.email ? ' (' + esc(m.email) + ')' : '') + '</summary><pre>' + esc(m.text) + '</pre></details>'; }).join('');
      return h;
    },
    dedupe: function (r) {
      var s = r.summary, src = state.own.dedupe ? state.own.dedupe.name : 'contacts.csv (made-up example: 3 lists pasted together)';
      var h = '<p class="cap">' + esc(src) + '</p>' + big([[String(s.duplicates), 'duplicates removed', 'bad'], [String(s.kept), 'contacts kept of ' + s.rows_in + ' rows'],
        [String(s.cells_filled), 'empty cells filled from the duplicates'], [String(s.invalid_emails), 'emails that look invalid', s.invalid_emails ? 'bad' : '']]);
      if (s.blank_emails) h += '<p class="hint">' + s.blank_emails + ' rows have no email.</p>';
      h += tbl(['Line', 'Duplicate of line', 'Matched on'], r.rows.map(function (d) { return [d.line, d.of, d.key]; }));
      return h;
    },
    bank: function (r) {
      var s = r.summary, src = state.own.bank ? state.own.bank.name : 'bank.csv (made-up example, Oct-Nov 2026)';
      var h = '<p class="cap">' + esc(src) + '</p>' + big([[A.usd(s.spending), 'spent in ' + s.transactions + ' transactions'], [A.usd(s.top_total), 'biggest category: ' + (s.top_category || '-')],
        [String(s.uncategorized_count), 'transactions with no rule yet (' + A.usd(s.uncategorized_total) + ')', s.uncategorized_count ? 'bad' : ''], [A.usd(s.income), 'money in']]);
      h += tbl(['Category', 'Total'], r.cats.map(function (c) { return [c.category, A.usd(c.total)]; }));
      if (r.unc.length) h += '<p class="hint">No rule yet. Add a line like "venmo = Contractors" to the rules:</p>' + tbl(['Date', 'Description', 'Amount'], r.unc.map(function (o) { return [o.date, o.description, A.usd(o.amount)]; }));
      if (s.skipped) h += '<p class="warn">' + s.skipped + ' rows skipped: no readable amount or date.</p>';
      return h;
    },
    files: function (r) {
      var s = r.summary, src = state.own.files ? state.own.files.list.length + ' files you picked' : 'a made-up Downloads folder';
      var h = '<p class="cap">' + esc(src) + ' · nothing is renamed here, this is the plan</p>' + big([[String(s.renamed), 'files get a new name of ' + s.files], [String(s.folders), 'folders they are sorted into'],
        [String(s.clashes_fixed), 'name clashes fixed with -2, -3'], [String(s.unchanged), 'files left as they are']]);
      h += tbl(['Now', 'Becomes'], r.rows.map(function (p) { return [p.from, p.to]; }));
      return h;
    },
    split: function (r) {
      var s = r.summary, src = state.own.split ? state.own.split.name : 'timesheet.csv (made-up example, November 2026)';
      var h = '<p class="cap">' + esc(src) + '</p>' + big([[String(s.files), 'files, one per value'], [String(s.rows_in), 'rows split'], [String(s.largest_rows), 'rows in the largest: ' + s.largest], [A.usd(s.total), 'total of the amount column']]);
      h += tbl(['File', 'Rows', 'Total'], r.rows.map(function (x) { return [x.file, x.rows, x.total == null ? '-' : A.usd(x.total)]; }));
      return h;
    }
  };
  function show(s) {
    state.script = s; $('script').value = s;
    Array.prototype.forEach.call(doc.querySelectorAll('#tabs button'), function (b) { b.classList.toggle('on', b.getAttribute('data-s') === s); });
    Array.prototype.forEach.call(doc.querySelectorAll('.opts'), function (o) { o.hidden = o.getAttribute('data-for') !== s; });
    doc.querySelector('.for-csv').hidden = s === 'files'; doc.querySelector('.for-files').hidden = s !== 'files';
    var own = state.own[s];
    $('src').firstChild.textContent = own ? 'Using your file: ' + (own.name || own.list.length + ' files') + '. ' : 'Using the made-up example file. ';
    buildCols(); run();
  }

  // ---------- own files ----------
  $('file').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var s = state.script; state.own[s] = { name: f.name, tab: A.parseCSV(rd.result) }; delete state.map[s];
      if (s === 'overdue' && $('asof').value === '2026-11-18') $('asof').value = today();
      show(s);
    };
    rd.readAsText(f);
  });
  $('pick').addEventListener('change', function () {
    var list = Array.prototype.map.call(this.files || [], function (f) { var d = new Date(f.lastModified); return { name: f.name, modified: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }; });
    if (list.length) { state.own.files = { list: list }; show('files'); }
  });
  $('reset').addEventListener('click', function () { delete state.own[state.script]; delete state.map[state.script]; if (state.script === 'overdue') $('asof').value = '2026-11-18'; show(state.script); });

  // ---------- licence ----------
  function tryKey(k, quiet) {
    if (!k) return;
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { if (!quiet) $('keymsg').textContent = ' — Save and continue: https://getreadystack.com/apps/automation-scripts-python-preview/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) { LS.setItem('as_key', k); setPro(true); } else next(); })
        .catch(function () { if (!quiet) $('keymsg').textContent = 'Could not check the key right now. Try again in a minute.'; });
    })();
  }
  function setPro(on) { pro = on; doc.body.classList.toggle('is-pro', on); $('keymsg').textContent = on ? ' — Save and continue: https://getreadystack.com/apps/automation-scripts-python-preview/' : ''; listSetups(); }
  function need(what) {
    if (pro) return true;
    $('promsg').textContent = what + ' — Save and continue: https://getreadystack.com/apps/automation-scripts-python-preview/';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return false;
  }

  // ---------- Pro tools ----------
  function download(name, text, type) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name; doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function pySettings() {
    var s = state.script, st = settings(), out = {};
    for (var k in st) out[k] = st[k];
    if (s === 'overdue') { delete out.asof; if (!state.own.overdue) out.asof_fixed = st.asof; }
    if (s !== 'files') {
      var h = table().headers, m = readMap(), cols = {};
      for (var f in m) cols[f] = m[f] >= 0 ? h[m[f]] : '';
      out.columns = cols;
    }
    return out;
  }
  var ACT = {
    py: ['The Python script', function () { download(PY.NAMES[state.script], PY.build(state.script, pySettings()), 'text/x-python'); $('promsg').textContent = 'Saved ' + PY.NAMES[state.script] + '. Run: ' + PY.HOW[state.script]; }],
    files: ['The result files', function () {
      var f = state.last.r.files, names = Object.keys(f);
      names.forEach(function (n, i) { setTimeout(function () { download(n.replace(/\//g, '_'), f[n], n.slice(-4) === '.csv' ? 'text/csv' : 'text/plain'); }, i * 250); });
      $('promsg').textContent = names.length + ' files: ' + names.join(', ');
    }],
    save: ['Saved setups', function () {
      var name = (window.prompt('Name this setup (for example: invoices from my app)', PY.NAMES[state.script].replace('.py', '')) || '').trim(); if (!name) return;
      var all = JSON.parse(LS.getItem('as_setups') || '[]');
      all = all.filter(function (x) { return x.name !== name; });
      all.push({ name: name, script: state.script, settings: settings(), map: readMap(), at: today() });
      LS.setItem('as_setups', JSON.stringify(all)); listSetups(); $('promsg').textContent = 'Setup "' + name + '" saved in this browser.';
    }],
    sched: ['The weekly schedule', function () { $('schedbox').hidden = false; sched(); }]
  };
  function listSetups() {
    var all = pro ? JSON.parse(LS.getItem('as_setups') || '[]') : [];
    $('setups').innerHTML = all.length ? '<p class="hint">Your setups:</p>' + all.map(function (x, i) { return '<button type="button" class="btn ghost" data-setup="' + i + '">' + esc(x.name) + '</button>'; }).join(' ') : '';
  }
  $('setups').addEventListener('click', function (e) {
    var b = e.target.closest('[data-setup]'); if (!b) return;
    var x = JSON.parse(LS.getItem('as_setups') || '[]')[+b.getAttribute('data-setup')]; if (!x) return;
    var st = x.settings;
    if (x.script === 'overdue') { $('grace').value = st.grace; $('datefmt').value = st.datefmt; $('yourname').value = st.yourname; $('paynote').value = st.paynote; }
    if (x.script === 'dedupe') $('phone').value = st.phone ? '1' : '0';
    if (x.script === 'bank') { $('rules').value = st.rules; $('sign').value = st.sign; $('bdatefmt').value = st.datefmt; }
    if (x.script === 'files') { $('ftidy').value = st.tidy ? '1' : '0'; $('fdate').value = st.date ? '1' : '0'; $('ffolder').value = st.folder; }
    state.map[x.script] = x.map; show(x.script); $('promsg').textContent = 'Opened "' + x.name + '". Load this week\'s file and the same columns and rules are used.';
  });
  function sched() {
    var py = PY.NAMES[state.script], dir = $('sdir').value.trim(), file = $('sfile').value.trim(), day = $('sday').value, t = $('stime').value || '09:00';
    var dow = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5 }[day], hm = t.split(':');
    var win = 'schtasks /Create /SC WEEKLY /D ' + day + ' /ST ' + t + ' /TN "' + py.replace('.py', '') + '" /TR "cmd /c cd /d \\"' + dir + '\\" && python ' + py + ' \\"' + file + '\\""';
    var nix = (+hm[1]) + ' ' + (+hm[0]) + ' * * ' + dow + ' cd "' + dir.replace(/\\/g, '/') + '" && /usr/bin/env python3 ' + py + ' "' + file + '" >> run_log.txt 2>&1';
    $('schedout').textContent = 'Windows (Command Prompt, once):\n' + win + '\n\nMac or Linux (crontab -e, add this line):\n' + nix + '\n\nDouble-click launcher (Windows .bat):\ncd /d "' + dir + '"\npython ' + py + ' "' + file + '"\npause';
  }
  ['sdir', 'sfile', 'sday', 'stime'].forEach(function (id) { $(id).addEventListener('input', sched); });

  // ---------- wiring ----------
  $('rules').value = A.EX.rules; $('flist').value = A.EX.files;
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (b) show(b.getAttribute('data-s')); });
  $('script').addEventListener('change', function () { show(this.value); });
  $('cols').addEventListener('change', run);
  Array.prototype.forEach.call(doc.querySelectorAll('.opts input, .opts select, .opts textarea'), function (el) { el.addEventListener('input', run); el.addEventListener('change', run); });
  $('run').addEventListener('click', function () { run(); $('res').scrollIntoView({ behavior: 'smooth' }); });
  Array.prototype.forEach.call(doc.querySelectorAll('[data-pro]'), function (b) { b.addEventListener('click', function () { var a = ACT[b.getAttribute('data-pro')]; if (need(a[0])) a[1](); }); });
  $('unlock').addEventListener('click', function () { tryKey($('key').value.trim()); });
  var hk = (location.hash.match(/[#&]k=([^&]+)/) || [])[1];
  if (hk) { tryKey(decodeURIComponent(hk)); history.replaceState(null, '', location.pathname); }
  else if (LS.getItem('as_key')) tryKey(LS.getItem('as_key'), true);
  show('overdue');
})();
