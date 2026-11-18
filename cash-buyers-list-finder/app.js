(function () {
  'use strict';
  var E = window.CBL, SLUG = 'cash-buyers-list-finder', DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  var LS = { cur: 'cbl.current', files: 'cbl.files', notes: 'cbl.notes', deals: 'cbl.deals', key: 'cbl.key' };
  var pro = false, last = null;
  var fields = [].slice.call(document.querySelectorAll('[data-k]'));
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function read() { var v = {}; fields.forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  function fill(v) { fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (v[k] != null) el.value = v[k]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function extras() { return pro ? get(LS.files, []).map(function (f) { return f.text; }) : []; }

  function render() {
    var v = read(), r = E.analyze(v, extras()), notes = get(LS.notes, {});
    last = r;
    $('#o-tiles').innerHTML = E.tilesHtml(r);
    $('#o-match').innerHTML = E.matchHtml(r);
    $('#o-title').textContent = 'Cash buyers ranked · ' + E.ymd(r.since) + ' to ' + E.ymd(r.asof);
    $('#o-rows').innerHTML = E.rowsHtml(r, pro ? notes : {});
    $('#o-stale').innerHTML = E.staleHtml(r);
    $('#o-notes').innerHTML = E.notesHtml(r);
    $('#o-cols').innerHTML = E.colsHtml(r);
    $('#o-summary').textContent = E.summary(r);
    if (!put(LS.cur, v)) put(LS.cur, Object.assign({}, v, { csv: '' }));
    if (pro) drawPro();
  }

  // ---- Pro ----
  var NAMES = { add: 'merging another export into one deduplicated list', 'csv-out': 'the buyer list CSV (one row per real buyer)', 'blast-out': 'the blast list CSV for this deal',
    'deal-save': 'saved deals with the buyers who fit', 'ics-out': 'assign-by reminders (.ics, 7 and 2 days before)', print: 'the printed buyer sheet' };
  function locked(what) {
    var m = $('#pro-msg'); m.hidden = false;
    m.innerHTML = '<b>' + E.esc(NAMES[what] || 'This') + '' + SLUG + ' — Save and continue: https://getreadystack.com/apps/cash-buyers-list-finder/';
    m.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function setPro(on) {
    pro = on; $('#pro').classList.toggle('open', on);
    if (on) { $('#pro-msg').hidden = true; render(); }
  }
  function dl(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function drawPro() {
    var files = get(LS.files, []), notes = get(LS.notes, {}), deals = get(LS.deals, []);
    $('#files').innerHTML = '<li>The CSV in the box above' + (last ? ' (' + last.st.rows + ' rows in all files)' : '') + '</li>' + files.map(function (f, i) {
      return '<li>' + E.esc(f.name) + ' · ' + f.rows + ' rows · added ' + E.esc(f.added) + ' <button type="button" class="link" data-rmf="' + i + '">remove</button></li>';
    }).join('');
    var ST = ['', 'new', 'called', 'interested', 'deal sent', 'bought from us', 'not buying'];
    $('#p-rows').innerHTML = (last ? last.buyers : []).map(function (b) {
      var n = E.noteFor(notes, b) || {};
      return '<tr data-id="' + E.esc(b.id) + '"><td><b>' + E.esc(b.name) + '</b><small>' + E.esc(b.mail || '') + '</small></td><td class="nm">' + b.buys + '<small>last ' + E.ymd(b.lastIn) + '</small></td>' +
        '<td><select data-n="status">' + ST.map(function (s) { return '<option' + (s === (n.status || '') ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
        '<td><input data-n="note" value="' + E.esc(n.note || '') + '" placeholder="buy box, phone, what they said"></td><td><input data-n="contact" type="date" value="' + E.esc(n.contact || '') + '"></td></tr>';
    }).join('');
    $('#d-rows').innerHTML = deals.map(function (d, i) {
      return '<tr><td><b>' + E.esc(d.dzip) + '</b> ' + E.esc(d.dtype) + '<small>saved ' + E.esc(d.saved) + '</small></td><td class="nm">' + E.money(E.num(d.dprice)) + '<small>fee ' + E.money(E.num(d.fee)) + '</small></td><td class="nm">' + E.esc(d.assignby) + '</td><td>' + d.matched + ': ' + E.esc(d.names) + '</td><td><button type="button" class="link" data-ld="' + i + '">open</button> <button type="button" class="link" data-rmd="' + i + '">remove</button></td></tr>';
    }).join('') || '<tr><td colspan="5" class="small">No saved deal yet.</td></tr>';
  }
  $('#p-rows').addEventListener('change', function (e) {
    var tr = e.target.closest('tr'), k = e.target.getAttribute('data-n'); if (!tr || !k) return;
    var notes = get(LS.notes, {}), id = tr.getAttribute('data-id'); var b0 = last.buyers.filter(function (x) { return x.id === id; })[0]; notes[id] = notes[id] || (b0 && E.noteFor(notes, b0)) || {}; notes[id][k] = e.target.value;
    if (k === 'status' && e.target.value && !notes[id].contact) { notes[id].contact = today(); tr.querySelector('[data-n="contact"]').value = notes[id].contact; }
    put(LS.notes, notes); $('#o-rows').innerHTML = E.rowsHtml(last, notes);
  });
  $('#files').addEventListener('click', function (e) {
    var i = e.target.getAttribute('data-rmf'); if (i == null) return;
    var f = get(LS.files, []); f.splice(+i, 1); put(LS.files, f); render();
  });
  $('#d-rows').addEventListener('click', function (e) {
    var ds = get(LS.deals, []), i = e.target.getAttribute('data-rmd'), j = e.target.getAttribute('data-ld');
    if (i != null) { ds.splice(+i, 1); put(LS.deals, ds); drawPro(); }
    if (j != null) { var d = ds[+j]; ['dzip', 'dprice', 'dtype', 'fee', 'assignby'].forEach(function (k) { var el = $('[data-k="' + k + '"]'); if (el && d[k] != null) el.value = d[k]; }); render(); }
  });
  function readFile(input, cb) {
    var f = input.files && input.files[0]; if (!f) return;
    var rd = new FileReader(); rd.onload = function () { cb(f.name, String(rd.result || '')); input.value = ''; }; rd.readAsText(f);
  }
  $('#open').addEventListener('change', function () {
    readFile(this, function (name, text) { $('[data-k="csv"]').value = text; $('#open-msg').textContent = name + ' loaded.'; render(); });
  });
  $('#add').addEventListener('click', function (e) { if (!pro) { e.preventDefault(); locked('add'); } });
  $('#add').addEventListener('change', function () {
    if (!pro) return locked('add');
    readFile(this, function (name, text) {
      var f = get(LS.files, []), rows = Math.max(0, E.parseCSV(text).length - 1);
      f.push({ name: name, rows: rows, added: today(), text: text });
      if (!put(LS.files, f)) { alert('This browser has no room left to keep that file. Remove an older export first.'); return; }
      render();
    });
  });
  $('#csv-out').addEventListener('click', function () { if (!pro) return locked('csv-out'); dl('cash-buyers-list-' + E.ymd(last.asof) + '.csv', E.exportCSV(last, get(LS.notes, {}))); });
  $('#blast-out').addEventListener('click', function () { if (!pro) return locked('blast-out'); dl('blast-' + (last.deal.zip || 'deal') + '-' + E.ymd(last.asof) + '.csv', E.blastCSV(last)); });
  $('#deal-save').addEventListener('click', function () {
    if (!pro) return locked('deal-save');
    var v = read(), ds = get(LS.deals, []);
    ds.push({ dzip: v.dzip, dprice: v.dprice, dtype: v.dtype, fee: v.fee, assignby: v.assignby, saved: today(), matched: last.matches.length, names: last.matches.map(function (m) { return m.b.name; }).join(', ') });
    put(LS.deals, ds); drawPro();
  });
  $('#ics-out').addEventListener('click', function () {
    if (!pro) return locked('ics-out');
    var ds = get(LS.deals, []); if (!ds.length) { var v = read(); ds = [{ dzip: v.dzip, dprice: v.dprice, fee: v.fee, assignby: v.assignby, matched: last.matches.length, names: last.matches.map(function (m) { return m.b.name; }).join(', ') }]; }
    var d = new Date(), stamp = d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    dl('assign-by-reminders.ics', E.ics(ds, stamp), 'text/calendar');
  });
  $('#print').addEventListener('click', function () {
    if (!pro) return locked('print');
    var r = last, notes = get(LS.notes, {});
    $('#print-sheet').innerHTML = '<h1>Cash buyers list · ' + E.ymd(r.since) + ' to ' + E.ymd(r.asof) + '</h1><p>' + E.esc(E.summary(r)) + '</p>' +
      '<table class="res"><thead><tr><th>#</th><th>Buyer</th><th>Cash buys</th><th>Price paid</th><th>Zips · type</th><th>Mailing address</th></tr></thead><tbody>' + E.rowsHtml(r, notes) + '</tbody></table>';
    window.print();
  });

  $('#copy').addEventListener('click', function () {
    var t = $('#o-summary').textContent, done = function () { $('#copy-msg').textContent = 'Copied.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () {});
    else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
  });

  function unlock(k, quiet) {
    k = String(k || '').trim(); if (!k) return;
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { if (!quiet) $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/cash-buyers-list-finder/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Save and continue: https://getreadystack.com/apps/cash-buyers-list-finder/'; }
        else next();
      }).catch(function () { if (!quiet) $('#key-msg').textContent = 'The key could not be checked right now. Try again in a minute.'; });
    })();
  }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });

  var tm = null;
  fields.forEach(function (el) {
    el.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(render, el.tagName === 'TEXTAREA' ? 250 : 0); });
    el.addEventListener('change', render);
  });
  $('#reset').addEventListener('click', function () { fill(E.DEFAULTS); render(); });
  $('#clear').addEventListener('click', function () {
    $('[data-k="csv"]').value = ''; $('[data-k="asof"]').value = today(); $('[data-k="dzip"]').value = ''; $('[data-k="dprice"]').value = '';
    var d = new Date(Date.now() + 30 * 864e5); $('[data-k="assignby"]').value = d.toISOString().slice(0, 10);
    render(); $('[data-k="csv"]').focus();
  });
  var saved = get(LS.cur, null);
  fill(E.DEFAULTS);
  if (saved) { if (!saved.csv) delete saved.csv; fill(saved); }
  render();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { var k = decodeURIComponent(hk[1]); $('#key').value = k; unlock(k); history.replaceState(null, '', location.pathname + location.search); }
  else if (get(LS.key, '')) unlock(get(LS.key, ''), true);
})();
