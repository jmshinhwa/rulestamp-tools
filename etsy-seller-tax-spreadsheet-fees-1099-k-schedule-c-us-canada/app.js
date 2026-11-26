/* */
(function () {
  'use strict';
  var E = window.ETX, X = window.XLSXW, B = window.ETXBOOK, doc = document, $ = function (id) { return doc.getElementById(id); };
  var SLUG = 'etsy-seller-tax-spreadsheet-fees-1099-k-schedule-c-us-canada';
  var DOORS = [SLUG, SLUG + '.once'];
  var KEY_LS = 'etx_key', YEAR_LS = 'etx_years';
  var LS = (function () { try { var t = window.localStorage; t.setItem('_t', '1'); t.removeItem('_t'); return t; } catch (e) { return null; } })();
  var state = { mine: [], useSample: true, pro: false, R: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function num(id) { var v = parseFloat(String($(id).value || '').replace(/,/g, '')); return isFinite(v) && v > 0 ? v : 0; }
  function country() { return $('country').value || 'us'; }
  function M(v) { return E.money(v, country()); }

  function yearOptions(files) {
    var c = country(), C = E.COUNTRY[c], sel = $('year'), keep = sel.value, opts = {};
    var g = E.guessYear(c, files);
    opts[g] = 1; opts[C.defYear] = 1;
    if (C.yearKind === 'uk') { opts['2024-25'] = 1; opts['2025-26'] = 1; opts['2026-27'] = 1; } else { opts['2025'] = 1; opts['2026'] = 1; }
    var list = Object.keys(opts).sort().reverse();
    var want = (keep && opts[keep]) ? keep : g;
    sel.innerHTML = list.map(function (k) { return '<option value="' + k + '"' + (k === want ? ' selected' : '') + '>' + (C.yearKind === 'uk' ? 'Tax year ' + k : 'Year ' + k) + '</option>'; }).join('');
  }

  function sources() { return state.useSample ? E.sample(country()) : state.mine; }

  function draw() {
    var c = country(), C = E.COUNTRY[c];
    $('k1099row').style.display = c === 'us' ? '' : 'none';
    var list = sources().slice(), pasted = String($('paste').value || '').trim();
    if (pasted) list.push({ name: 'pasted statement', text: pasted });
    var read = E.readAll(list, c);
    yearOptions(read.filter(function (f) { return f.ok; }));
    var R = E.combine(read, c, $('year').value, { ownCosts: num('own'), box1a: num('box1a') });
    state.R = R; state.read = read;
    $('out').innerHTML = render(R, read);
    $('filelist').innerHTML = state.useSample ? 'Showing the made-up example shop. Add your own files to replace it.'
      : (state.mine.length ? state.mine.length + ' file' + (state.mine.length === 1 ? '' : 's') + ' added: ' + esc(state.mine.map(function (f) { return f.name; }).join(', ')) : 'No files yet.');
    drawPaidCount(R);
  }

  function tile(txt, cls) { return '<div class="tile' + (cls ? ' ' + cls : '') + '">' + esc(txt) + '</div>'; }

  function render(R, read) {
    var c = R.country, C = E.COUNTRY[c], bad = read.filter(function (f) { return !f.ok; });
    var h = '';
    if (!R.used) {
      h += '<p class="who">' + esc(C.form) + ' · ' + esc(R.year.label) + '</p>';
      h += '<div class="empty"><b>Add your Etsy monthly statements.</b> In Shop Manager open Finances, then Monthly statements. Pick a month and press Download CSV. Do it for each month of the year, then drop all the files here at once.</div>';
      if (bad.length) h += '<p class="warn">' + bad.map(function (f) { return esc(f.file + ': ' + f.why); }).join('<br>') + '</p>';
      return h;
    }
    var who = state.useSample ? 'Made-up ' + (c === 'us' ? 'US' : c === 'ca' ? 'Canadian' : 'UK') + ' shop' : 'Your shop';
    var endDay = c === 'uk' ? '5 Apr ' + R.year.to.slice(0, 4) : '31 Dec';
    h += '<p class="who">' + esc(who) + ' · ' + R.files + ' Etsy statement' + (R.files === 1 ? '' : 's') + ' · ' + esc(C.yearKind === 'uk' ? 'tax year ' + R.year.key : R.year.key) + '</p>';
    var kept = R.sales - R.deposits - R.inBalance;
    h += '<div class="sum">' +
      tile('Sales on the statements: ' + M(R.sales)) +
      tile('Reached your bank: ' + M(R.deposits)) +
      tile((R.inBalance >= 0 ? 'Still in your Etsy balance on ' + endDay + ': ' : 'Paid out from earlier money: ') + M(Math.abs(R.inBalance))) +
      tile('Etsy kept before paying you: ' + M(kept), 'm') + '</div>';
    h += '<h3>' + esc(C.form) + ': your lines</h3><table class="lines"><tbody>';
    R.lines.forEach(function (l) { h += '<tr><td class="code">' + esc(l.code) + '</td><td>' + esc(l.name) + '</td><td class="v">' + esc(M(l.value)) + '</td></tr>'; });
    h += '<tr class="tot"><td></td><td>' + esc(C.profitName) + '</td><td class="v">' + esc(M(R.profit)) + '</td></tr>';
    if (R.ownCosts) h += '<tr><td></td><td>Your own costs outside Etsy</td><td class="v">' + esc(M(R.ownCosts)) + '</td></tr><tr class="tot"><td></td><td>Profit after your own costs</td><td class="v">' + esc(M(R.profitAfterOwn)) + '</td></tr>';
    h += '</tbody></table>';
    var x = R.extra || {};
    if (c === 'us' && x.k1099) {
      h += '<p class="chk">1099-K: ' + (x.k1099.over ? 'over the federal line for ' + R.year.key + ' (more than $20,000 and more than 200 transactions): expect a 1099-K from Etsy' : 'under the federal line for ' + R.year.key + ' ($20,000 and 200 transactions), so maybe no 1099-K, but the income is still reported') + '. Sale lines read: ' + R.orders + '.</p>';
      if (x.k1099.box1a) h += '<p class="chk">' + (Math.abs(x.k1099.diff) < 0.01 ? 'Your 1099-K box 1a matches your statements.' : 'Your 1099-K box 1a is ' + M(x.k1099.box1a) + ', ' + M(Math.abs(x.k1099.diff)) + (x.k1099.diff > 0 ? ' more' : ' less') + ' than your statements. Compare each month below with the month boxes of your 1099-K (5a to 5l) to find the month that differs.') + '</p>';
    } else if (c === 'ca' && x.gst) {
      var b4 = x.gst.best4 || {}, bq = x.gst.bestQ || {};
      h += '<p class="chk">GST/HST small supplier line, C$30,000: your best four calendar quarters in a row ' + (b4.full ? '' : '(fewer than four quarters added) ') + 'came to ' + M(b4.sum || 0) + ' (' + esc((b4.from || '').replace('-', ' ')) + ' to ' + esc((b4.to || '').replace('-', ' ')) + '), ' + (x.gst.over4 ? 'over' : 'under') + ' the line; your biggest single quarter ' + M(bq.sum || 0) + ' (' + esc((bq.k || '').replace('-', ' ')) + ')' + (x.gst.overQ ? ', over the line in one quarter' : '') + '. Add last year\'s statements to count earlier quarters. GST/HST Etsy charged on its fees: ' + M(x.gst.gstOnFees) + '.</p>';
    } else if (c === 'uk' && x.allowance) {
      h += '<p class="chk">Trading allowance: your costs ' + M(x.allowance.expenses) + ' against the £1,000 allowance. ' + (x.allowance.better === 'expenses' ? 'Claiming your real costs deducts ' + M(x.allowance.diff) + ' more.' : 'The £1,000 allowance deducts ' + M(x.allowance.diff) + ' more than your costs.') + '</p>';
    }
    h += '<h3>Every fee by type</h3><table class="fees"><tbody>';
    E.CATS.forEach(function (k) {
      var v = R.tot[k[0]];
      if (k[0] === 'tax' || Math.abs(v) < 0.005) return;
      h += '<tr><td>' + esc(k[1]) + '</td><td class="v">' + esc(M(v)) + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<h3>Month by month</h3><table class="fees mon"><tbody><tr><th>Month</th><th class="v">Sales</th><th class="v">Etsy kept</th><th class="v">Deposits</th></tr>';
    R.monthKeys.forEach(function (k) {
      var m = R.months[k];
      h += '<tr><td>' + esc(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4)) + '</td><td class="v">' + esc(M(m.sales)) + '</td><td class="v">' + esc(M(m.sales - m.net)) + '</td><td class="v">' + esc(M(m.deposits)) + '</td></tr>';
    });
    h += '</tbody></table>';
    var notes = [R.used + ' lines read'];
    if (R.outside) notes.push(R.outside + ' outside ' + R.year.label + ' left out');
    if (R.repeats) notes.push(R.repeats + ' repeated lines left out');
    if (R.undated) notes.push(R.undated + ' lines without a date left out');
    if (R.taxCollected) notes.push('sales tax Etsy collected for buyers ' + M(R.taxCollected) + ' (not your income)');
    var cs = Object.keys(R.curs || {}).filter(function (k) { return k && k !== C.cur; });
    if (cs.length) notes.push('files in ' + cs.join(', ') + ': pick the country your Etsy payment account is in');
    if (Math.abs(R.check) > 0.01) notes.push('check ' + M(R.check));
    h += '<p class="small">' + esc(notes.join(' · ')) + '</p>';
    if (bad.length) h += '<p class="warn">' + bad.map(function (f) { return esc(f.file + ': ' + f.why); }).join('<br>') + '</p>';
    return h;
  }

  function drawPaidCount(R) {
    var c = E.COUNTRY[R.country];
    $('bookwhat').textContent = R.used ? 'For this year: ' + (R.monthKeys.length) + ' month' + (R.monthKeys.length === 1 ? '' : 's') + ', ' + R.used + ' statement lines, ' + R.lines.length + ' ' + c.form.split(' (')[0] + ' lines.' : '';
  }

  // ---------- files ----------
  function addFiles(fl) {
    var arr = Array.prototype.slice.call(fl || []), left = arr.length;
    if (!left) return;
    arr.forEach(function (f) {
      var rd = new FileReader();
      rd.onload = function () {
        state.mine = state.mine.filter(function (x) { return x.name !== f.name; });
        state.mine.push({ name: f.name, text: String(rd.result || '') });
        if (--left === 0) { state.useSample = false; state.mine.sort(function (a, b) { return a.name < b.name ? -1 : 1; }); draw(); }
      };
      rd.onerror = function () { if (--left === 0) { state.useSample = false; draw(); } };
      rd.readAsText(f);
    });
  }

  // ---------- paid ----------
  function need(what) {
    $('keymsg').textContent = what + ' is part of the tax workbook. It opens with your key.';
    $('pro').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function download(name, data, type) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: type })); a.download = name; doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function workbook() {
    var R = state.R; if (!R || !R.used) { $('keymsg').textContent = 'Add your statements first.'; return; }
    var sheets = B.build(R, { today: today(), ownRows: R.ownCosts ? [{ date: today(), what: 'Your own costs typed on the page', amount: R.ownCosts, line: '' }] : [],
      k1099Months: [] });
    var bytes = X.workbook(sheets, { title: 'Etsy seller tax spreadsheet ' + R.year.key });
    download('etsy-tax-' + R.country + '-' + R.year.key + '.xlsx', bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    $('keymsg').textContent = 'Workbook saved: open it in Excel, or in Google Sheets with File > Import.';
  }
  function printSummary() {
    var R = state.R; if (!R || !R.used) { $('keymsg').textContent = 'Add your statements first.'; return; }
    var C = E.COUNTRY[R.country], w = window.open('', '_blank');
    if (!w) { $('keymsg').textContent = 'Allow pop-ups for this page to print.'; return; }
    var rows = R.lines.map(function (l) { return '<tr><td>' + esc(l.code) + '</td><td>' + esc(l.name) + '</td><td class="v">' + esc(M(l.value)) + '</td></tr>'; }).join('');
    var gap = [['Sales on the statements', R.sales], ['Money sent back to buyers', R.tot.returned], ['Etsy fees after credits', -R.fees], ['Etsy Ads and Offsite Ads', -R.ads], ['Shipping labels', -R.labels], ['Earned on Etsy (net)', R.net], ['Reached your bank', R.deposits], ['Left in the Etsy balance', R.inBalance]]
      .map(function (g) { return '<tr><td colspan="2">' + esc(g[0]) + '</td><td class="v">' + esc(M(g[1])) + '</td></tr>'; }).join('');
    var src = (E.SOURCES[R.country] || []).map(function (s) { return '<li>' + esc(s[0]) + ': ' + esc(s[1]) + '</li>'; }).join('');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Etsy year summary ' + esc(R.year.key) + '</title><style>body{font:13px/1.45 system-ui,sans-serif;margin:28px;color:#111}h1{font-size:18px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin:10px 0}td{border:1px solid #bbb;padding:4px 6px}.v{text-align:right;white-space:nowrap}.d{color:#555;font-size:11px}</style></head><body>' +
      '<h1>Etsy year summary: ' + esc(C.form) + ', ' + esc(R.year.label) + '</h1><p class="d">Printed ' + today() + ' from ' + R.files + ' Etsy statement files, ' + R.used + ' lines. Amounts in ' + esc(C.cur) + '.</p>' +
      '<table>' + rows + '<tr><td></td><td><b>' + esc(C.profitName) + '</b></td><td class="v"><b>' + esc(M(R.profit)) + '</b></td></tr></table>' +
      '<h2 style="font-size:14px">From sales to deposits</h2><table>' + gap + '</table><p class="d">Official pages, read ' + esc(E.READ_ON) + ':</p><ul class="d">' + src + '</ul>' +
      '<p class="d">A calculator that sorts your own Etsy statements. It is not tax advice. Not made by Etsy.</p><script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }
  function years() { try { return JSON.parse((LS && LS.getItem(YEAR_LS)) || '{}') || {}; } catch (e) { return {}; } }
  function saveYear() {
    var R = state.R; if (!R || !R.used || state.useSample) { $('keymsg').textContent = 'Add your own statements first; the example is not saved.'; return; }
    var Y = years(), k = R.country + ':' + R.year.key;
    Y[k] = { at: today(), files: state.mine, own: $('own').value, box1a: $('box1a').value };
    try { LS.setItem(YEAR_LS, JSON.stringify(Y)); $('keymsg').textContent = 'Saved in this browser: ' + k + '. Add next month\'s statement any time.'; }
    catch (e) { $('keymsg').textContent = 'This browser has no room left to save the year; download the workbook instead.'; }
    drawYears();
  }
  function drawYears() {
    var Y = years(), ks = Object.keys(Y).sort().reverse();
    $('years').innerHTML = ks.length ? ks.map(function (k) { return '<button class="btn ghost small" data-year="' + esc(k) + '">Open ' + esc(k) + ' (saved ' + esc(Y[k].at) + ')</button>'; }).join(' ') : '<span class="hint">No year saved yet.</span>';
  }
  function openYear(k) {
    var y = years()[k]; if (!y) return;
    $('country').value = k.split(':')[0]; state.mine = y.files || []; state.useSample = false; $('own').value = y.own || ''; $('box1a').value = y.box1a || '';
    yearOptions([]); $('year').value = k.split(':')[1]; draw();
  }

  function unlock(k, quiet) {
    k = String(k || '').trim(); if (!k) return;
    var left = DOORS.length, done = false;
    DOORS.forEach(function (door) {
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (done) return;
        if (j && j.ok) { done = true; if (LS) LS.setItem(KEY_LS, k); setPro(true); $('keymsg').textContent = 'Tax workbook opened in this browser.'; }
        else if (--left === 0 && !quiet) $('keymsg').textContent = 'That key was not accepted. Check that it was copied whole.';
      }).catch(function () { if (--left === 0 && !quiet) $('keymsg').textContent = 'Could not reach the key check. Try again in a minute.'; });
    });
  }
  function setPro(on) { state.pro = on; $('proarea').style.display = on ? '' : 'none'; if (on) drawYears(); }

  // ---------- events ----------
  doc.addEventListener('input', function (e) { if (e.target.hasAttribute('data-k') && e.target.tagName !== 'SELECT') draw(); });
  doc.addEventListener('change', function (e) { if (e.target.hasAttribute('data-k')) draw(); });
  $('files').addEventListener('change', function () { addFiles(this.files); this.value = ''; });
  var dz = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('on'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('on'); }); });
  dz.addEventListener('drop', function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });
  $('mine').onclick = function () { state.useSample = false; state.mine = []; $('paste').value = ''; $('own').value = ''; $('box1a').value = ''; draw(); $('files').click(); };
  $('example').onclick = function () { state.useSample = true; state.mine = []; $('paste').value = ''; draw(); };
  $('dlsample').onclick = function () { var f = E.sample(country()); download(f[f.length - 1].name, f[f.length - 1].text, 'text/csv'); };
  $('getbook').onclick = function () { if (state.pro) workbook(); else need('The .xlsx workbook'); };
  $('getprint').onclick = function () { if (state.pro) printSummary(); else need('The printed summary'); };
  $('getsave').onclick = function () { if (state.pro) saveYear(); else need('Keeping the year in this browser'); };
  $('years').addEventListener('click', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-year'); if (k) openYear(k); });
  $('unlock').onclick = function () { unlock($('key').value); };

  var hk = /[#&]k=([^&]+)/.exec(location.hash || '');
  if (hk) { unlock(decodeURIComponent(hk[1])); history.replaceState(null, '', location.pathname + location.search); }
  else if (LS && LS.getItem(KEY_LS)) unlock(LS.getItem(KEY_LS), true);
  setPro(false);
  draw();
})();
