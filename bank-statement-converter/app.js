/* app.js — Bank statement converter page. The PDF is read here, in this browser tab (pdf.js from ./lib). Nothing is uploaded. */
(function () {
  'use strict';
  var SLUG = 'bank-statement-converter';
  var DOORS = [SLUG];
  var BUY = '' + SLUG;
  var LK = 'bsc:lic', SK = 'bsc:saved';
  var $ = function (s) { return document.querySelector(s); };
  var B = window.BSC;
  var cur = null, curName = 'example-statement.pdf';

  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f(c) { return B.fmt(c); }

  // ───────────── licence (Pro)
  function lic() { try { return JSON.parse(localStorage.getItem(LK) || 'null'); } catch (e) { return null; } }
  function isPro() { var l = lic(); return !!(l && l.ok); }
  function ask(key, door) {
    return fetch('' + encodeURIComponent(key) + '&slug=' + encodeURIComponent(door), { headers: { accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) { return r.json(); }).then(function (j) { return !!(j && j.ok); }).catch(function () { return false; });
  }
  function unlock(key) {
    key = String(key || '').trim();
    if (!key) return Promise.resolve(false);
    var i = 0;
    function next() {
      if (i >= DOORS.length) return false;
      var d = DOORS[i++];
      return ask(key, d).then(function (ok) {
        if (ok) { localStorage.setItem(LK, JSON.stringify({ ok: true, key: key, door: d, at: Date.now() })); return true; }
        return next();
      });
    }
    return Promise.resolve(next());
  }
  function proUi() {
    var p = isPro();
    document.body.classList.toggle('pro', p);
    $('#lic-state').textContent = p ? ' — Save and continue: https://getreadystack.com/apps/bank-statement-converter/' : '';
  }

  // ───────────── PDF → text lines (column-aware: amounts under Withdrawals get "-", under Deposits get "+")
  var pdfjs = null;
  function loadPdf() {
    if (pdfjs) return Promise.resolve(pdfjs);
    return import(new URL('lib/pdf.min.js', document.baseURI).href).then(function (m) {
      m.GlobalWorkerOptions.workerSrc = new URL('lib/pdf.worker.min.js', document.baseURI).href; pdfjs = m; return m;
    });
  }
  var OUTW = /^(withdrawals?|debits?|paid out|money out|payments?|charges|debit amount|withdrawal amount)$/i;
  var INW = /^(deposits?|credits?|paid in|money in|receipts|credit amount|deposit amount|deposits? (and|&) (other )?(additions|credits))$/i;
  var BALW = /^(balance|running balance|ending daily balance|daily balance)$/i;
  var AMTONLY = /^\(?[-+]?[$€£]?\d{1,3}(,\d{3})*(\.\d{2})\)?(CR|DR)?-?$/i;
  function pageLines(items) {
    items = items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) {
      var fs = Math.hypot(i.transform[0], i.transform[1]) || i.height || 10;
      return { s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, fs: fs };
    });
    items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var lines = [];
    items.forEach(function (it) {
      var L = lines.length ? lines[lines.length - 1] : null;
      if (L && Math.abs(L.y - it.y) <= Math.max(2, it.fs * 0.35)) L.items.push(it); else lines.push({ y: it.y, items: [it] });
    });
    lines.forEach(function (L) { L.items.sort(function (a, b) { return a.x - b.x; }); });
    return lines;
  }
  function joinLine(L, cols) {
    var out = '', prevEnd = null;
    L.items.forEach(function (it) {
      var s = it.s.trim();
      if (cols && AMTONLY.test(s.replace(/\s/g, '')) && !/^[-+(]/.test(s) && !/(CR|DR)$/i.test(s)) {
        var r = it.x + it.w, c = it.x + it.w / 2, best = null, bd = 1e9;
        cols.forEach(function (k) { var d = Math.min(Math.abs(r - k.r), Math.abs(c - k.c), Math.abs(it.x - k.l)); if (d < bd) { bd = d; best = k; } });
        if (best && best.kind === 'out') s = '-' + s.replace(/\s/g, '');
        else if (best && best.kind === 'in') s = '+' + s.replace(/\s/g, '');
      }
      if (prevEnd !== null && it.x - prevEnd > it.fs * 0.12) out += ' ';
      else if (prevEnd !== null && !/\s$/.test(out)) out += (it.x - prevEnd > -1 && /\d$/.test(out) && /^[A-Za-z]/.test(s)) ? ' ' : '';
      out += s; prevEnd = it.x + it.w;
    });
    return out.replace(/\s+/g, ' ').trim();
  }
  function headerCols(L) {
    var cols = [];
    L.items.forEach(function (it) {
      var s = it.s.trim(), kind = OUTW.test(s) ? 'out' : INW.test(s) ? 'in' : BALW.test(s) ? 'bal' : null;
      if (kind) cols.push({ kind: kind, l: it.x, r: it.x + it.w, c: it.x + it.w / 2 });
    });
    var k = cols.map(function (c) { return c.kind; });
    return k.indexOf('out') >= 0 && k.indexOf('in') >= 0 ? cols : null;
  }
  function readPdf(buf, password) {
    return loadPdf().then(function (pj) {
      return pj.getDocument({ data: buf, password: password || undefined, isEvalSupported: false }).promise;
    }).then(function (pdf) {
      var all = [], chars = 0, cols = null, n = pdf.numPages, p = 0;
      function step() {
        if (++p > n) return { lines: all, chars: chars, pages: n };
        return pdf.getPage(p).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
          pageLines(tc.items).forEach(function (L) {
            var hc = headerCols(L);
            if (hc) { cols = hc; all.push(joinLine(L, null)); return; }
            var t = joinLine(L, cols); chars += t.length; all.push(t);
          });
          return step();
        });
      }
      return step();
    });
  }

  // ───────────── render
  function render(st) {
    cur = st;
    var s = st.sum, out = $('#out');
    var badRows = st.rows.filter(function (r) { return r.status === 'bad'; });
    var off = badRows.length ? Math.abs(badRows[0].off) : 0;
    var endLine = s.endPrinted === null ? 'no ending balance printed' : (s.endOk === null ? 'statement ending ' + f(s.endPrinted) : (s.endOk ? 'ending ' + f(s.endPrinted) + ' matches' : 'ending ' + f(s.endPrinted) + ' vs ' + f(s.endCalc) + ' added up'));
    var h = '<div class="stats">' +
      '<div class="stat"><b>' + s.rows + '</b><span>transactions read</span></div>' +
      '<div class="stat ' + (s.bad ? 'red' : 'green') + '"><b>' + (s.bad ? s.bad + (s.bad === 1 ? ' row' : ' rows') : 'All rows') + '</b><span>' + (s.bad ? 'to check · off by ' + f(off) : 'balance to the cent') + '</span></div>' +
      '<div class="stat"><b>' + f(s.inn) + '</b><span>money in · out ' + f(s.out) + '</span></div></div>' +
      '<p class="endline ' + (s.endOk === false ? 'red' : '') + '">' + esc(endLine) + (s.opening !== null ? ' · opening ' + f(s.opening) : ' · no opening balance found') + (s.start ? ' · ' + s.start + ' to ' + s.end : '') + '</p>';
    if (badRows.length) h += '<p class="why red">Row ' + (st.rows.indexOf(badRows[0]) + 1) + ', ' + esc(badRows[0].date) + ' ' + esc(badRows[0].desc) + ': ' + esc(badRows[0].note) + '.</p>';
    h += '<div class="tw"><table><thead><tr><th>Date</th><th>Description</th><th class="n">Amount</th><th class="n">Balance</th><th>Check</th></tr></thead><tbody>';
    st.rows.forEach(function (r) {
      var cls = r.status === 'bad' ? 'bad' : '';
      var mark = r.status === 'ok' ? '✓' : r.status === 'bad' ? '✗ check' : r.status === 'start' ? 'start' : '-';
      h += '<tr class="' + cls + '"' + (r.note ? ' title="' + esc(r.note) + '"' : '') + '><td>' + esc(r.date) + '</td><td>' + esc(r.desc) + '</td><td class="n ' + (r.amount < 0 ? 'neg' : 'pos') + '">' + f(r.amount) + '</td><td class="n">' + (r.bal !== null ? f(r.bal) : '') + '</td><td>' + mark + '</td></tr>';
    });
    h += '</tbody></table></div>';
    if (!st.rows.length) h = '<p class="why red">No transaction lines found. A transaction line starts with a date and ends with an amount (and usually the balance). Check the text box below.</p>';
    out.innerHTML = h;
    $('#fname').textContent = curName;
  }
  function run() {
    var st = B.parse($('#text').value, { order: $('#order').value });
    st.name = curName;
    render(st);
  }

  // ───────────── files
  function readFile(file) {
    return file.arrayBuffer().then(function (buf) {
      return readPdf(buf).catch(function (e) {
        if (e && e.name === 'PasswordException') {
          var pw = window.prompt('This PDF is password-protected. Type its password (it stays in this tab):');
          if (pw) return file.arrayBuffer().then(function (b2) { return readPdf(b2, pw); });
        }
        throw e;
      });
    });
  }
  function msg(t, red) { var m = $('#msg'); m.textContent = t || ''; m.className = red ? 'msg red' : 'msg'; }
  function onFiles(list) {
    var files = Array.prototype.filter.call(list || [], function (x) { return /\.pdf$/i.test(x.name) || /pdf/.test(x.type); });
    if (!files.length) { msg('Choose a PDF bank statement.', true); return; }
    if (files.length > 1 && isPro()) return batch(files);
    if (files.length > 1) { $('#paid-why').textContent = 'You chose ' + files.length + ' — Save and continue: https://getreadystack.com/apps/bank-statement-converter/'; $('#paid').classList.add('show'); }
    var file = files[0];
    msg('Reading ' + file.name + ' in this browser…');
    readFile(file).then(function (r) {
      if (r.chars < 30) { msg('This PDF has no text layer (' + r.pages + ' page' + (r.pages > 1 ? 's' : '') + '): it is a scan or a photo. This version reads text PDFs, the ones you download from online banking. Scanned statements are not read yet.', true); return; }
      curName = file.name;
      $('#text').value = r.lines.join('\n');
      run();
      msg(r.pages + ' page' + (r.pages > 1 ? 's' : '') + ' read from ' + file.name + '. Nothing was uploaded.');
    }).catch(function (e) { msg('Could not read this PDF: ' + (e && e.message ? e.message : e), true); });
  }

  // ───────────── Pro: exports, batch, saved
  function download(name, data, type) {
    var b = new Blob([data], { type: type }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function base(n) { return String(n || 'statement').replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '-'); }
  function gate(what) {
    if (isPro()) return true;
    $('#paid-why').textContent = what + ' — Save and continue: https://getreadystack.com/apps/bank-statement-converter/';
    $('#paid').classList.add('show');
    $('#paid').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  function exp(kind) {
    if (!cur || !gate(kind === 'xlsx' ? 'The Excel download' : kind === 'csv' ? 'The CSV download' : 'The OFX download')) return;
    if (kind === 'xlsx') download(base(curName) + '.xlsx', B.toXLSX(cur), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (kind === 'csv') download(base(curName) + '.csv', B.toCSV(cur), 'text/csv');
    if (kind === 'ofx') download(base(curName) + '.ofx', B.toOFX(cur), 'application/x-ofx');
  }
  var batchList = [];
  function batch(files) {
    batchList = [];
    var i = 0;
    msg('Reading ' + files.length + ' statements in this browser…');
    function next() {
      if (i >= files.length) return showBatch();
      var file = files[i++];
      return readFile(file).then(function (r) {
        var st = B.parse(r.lines, { order: $('#order').value }); st.name = file.name; st.pages = r.pages; st.text = r.lines.join('\n');
        if (r.chars < 30) st.scan = true;
        batchList.push(st);
      }).catch(function (e) { batchList.push({ name: file.name, err: String(e && e.message || e), sum: { start: '' } }); }).then(next);
    }
    next();
  }
  function showBatch() {
    var ok = batchList.filter(function (s) { return !s.err && !s.scan; });
    var ch = B.chain(ok), links = {};
    ch.links.forEach(function (l) { links[l.to] = l; });
    var h = '<table><thead><tr><th>Statement</th><th>Dates</th><th class="n">Rows</th><th class="n">Opening</th><th class="n">Ending</th><th>Rows to check</th><th>Opening = previous ending?</th></tr></thead><tbody>';
    ch.ordered.forEach(function (st) {
      var l = links[st.name], s = st.sum;
      h += '<tr' + ((s.bad || (l && l.ok === false)) ? ' class="bad"' : '') + '><td>' + esc(st.name) + '</td><td>' + esc(s.start) + ' to ' + esc(s.end) + '</td><td class="n">' + s.rows + '</td><td class="n">' + f(s.opening) + '</td><td class="n">' + f(s.endPrinted) + '</td><td>' + (s.bad ? s.bad + ' ✗' : '✓') + '</td><td>' + (l ? (l.ok === null ? 'not printed' : l.ok ? '✓' : 'gap ' + f(l.diff)) : 'first') + '</td></tr>';
    });
    batchList.filter(function (s) { return s.err || s.scan; }).forEach(function (s) { h += '<tr class="bad"><td>' + esc(s.name) + '</td><td colspan="6">' + (s.scan ? 'no text layer (scan)' : 'not read: ' + esc(s.err)) + '</td></tr>'; });
    h += '</tbody></table>';
    $('#batch-out').innerHTML = h;
    $('#batch-box').classList.add('show');
    msg(ok.length + ' of ' + batchList.length + ' statements read · ' + ch.gaps + ' gap' + (ch.gaps === 1 ? '' : 's') + ' between statements. Nothing was uploaded.');
    if (ok.length) { cur = ch.ordered[0]; curName = cur.name; $('#text').value = cur.text; render(cur); }
  }
  function saved() { try { return JSON.parse(localStorage.getItem(SK) || '[]'); } catch (e) { return []; } }
  function showSaved() {
    var list = saved(), el = $('#saved-list');
    if (!list.length) { el.innerHTML = '<p class="muted">Nothing saved yet.</p>'; return; }
    el.innerHTML = '<ul>' + list.map(function (s, i) { return '<li><button class="link" data-open="' + i + '">' + esc(s.name) + '</button> <span class="muted">' + esc(s.start || '') + ' to ' + esc(s.end || '') + ' · ' + s.rows + ' rows</span> <button class="link" data-del="' + i + '">remove</button></li>'; }).join('') + '</ul>';
  }
  function saveCur() {
    if (!cur || !gate('Saving statements')) return;
    var list = saved().filter(function (s) { return s.name !== curName; });
    list.push({ name: curName, text: $('#text').value, order: $('#order').value, start: cur.sum.start, end: cur.sum.end, rows: cur.sum.rows });
    localStorage.setItem(SK, JSON.stringify(list)); showSaved(); msg(curName + ' saved in this browser.');
  }
  function savedXlsx() {
    if (!gate('The Excel file of all saved statements')) return;
    var list = saved().map(function (s) { var st = B.parse(s.text, { order: s.order }); st.name = s.name; return st; });
    if (!list.length) { msg('Save a statement first.', true); return; }
    download('statements-' + list.length + '.xlsx', B.toXLSX(list), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  // ───────────── wire up
  document.addEventListener('DOMContentLoaded', function () {
    var drop = $('#drop'), inp = $('#file');
    inp.addEventListener('change', function () { onFiles(inp.files); inp.value = ''; });
    ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (ev) { onFiles(ev.dataTransfer.files); });
    var tm = null;
    $('#text').addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(run, 250); });
    $('#order').addEventListener('change', run);
    $('#x-xlsx').addEventListener('click', function () { exp('xlsx'); });
    $('#x-csv').addEventListener('click', function () { exp('csv'); });
    $('#x-ofx').addEventListener('click', function () { exp('ofx'); });
    $('#x-save').addEventListener('click', saveCur);
    $('#x-batch').addEventListener('click', function () { if (gate('Converting many statements at once')) $('#file-many').click(); });
    $('#file-many').addEventListener('change', function () { var fl = $('#file-many').files; if (fl.length) batch(Array.prototype.slice.call(fl)); $('#file-many').value = ''; });
    $('#x-saved-xlsx').addEventListener('click', savedXlsx);
    $('#batch-xlsx').addEventListener('click', function () { var ok = batchList.filter(function (s) { return !s.err && !s.scan; }); if (ok.length && gate('The batch Excel file')) download('statements-' + ok.length + '.xlsx', B.toXLSX(ok), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); });
    $('#saved-list').addEventListener('click', function (ev) {
      var o = ev.target.getAttribute('data-open'), d = ev.target.getAttribute('data-del'), list = saved();
      if (o !== null && list[+o]) { curName = list[+o].name; $('#text').value = list[+o].text; $('#order').value = list[+o].order || 'auto'; run(); }
      if (d !== null) { list.splice(+d, 1); localStorage.setItem(SK, JSON.stringify(list)); showSaved(); }
    });
    $('#reset').addEventListener('click', function () { curName = 'example-statement.pdf'; $('#text').value = $('#text').defaultValue; $('#order').value = 'auto'; run(); msg(''); });
    $('#lic-go').addEventListener('click', function () {
      $('#lic-state').textContent = 'Checking…';
      unlock($('#lic-key').value).then(function (ok) { proUi(); if (!ok) $('#lic-state').textContent = ' — Save and continue: https://getreadystack.com/apps/bank-statement-converter/'; else $('#paid').classList.remove('show'); });
    });
    document.querySelectorAll('a[data-buy]').forEach(function (a) { a.setAttribute('href', BUY); });
    var hk = /[#&]k=([^&]+)/.exec(location.hash);
    if (hk) { unlock(decodeURIComponent(hk[1])).then(function () { proUi(); history.replaceState(null, '', location.pathname); }); }
    proUi(); showSaved(); run();
  });
})();
