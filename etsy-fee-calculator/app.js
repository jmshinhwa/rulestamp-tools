/* app.js: page wiring for the Etsy fee calculator (free calculator + Pro month reports) */
(function () {
  'use strict';
  var E = window.EFC, V = window.EFCV, SAMPLE = window.EFC_SAMPLE || null;
  var SLUG = 'etsy-fee-calculator', DOORS = [SLUG, SLUG + '.yearly'];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('efc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('efc.' + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked: the page still works */ } }
  };
  var state = { pro: false, st: null, items: null, other: 0, example: true };

  // ---------- free calculator ----------
  function inputs() {
    var o = {};
    $$('#f [data-k]').forEach(function (el) { o[el.getAttribute('data-k')] = el.value; });
    return o;
  }
  function setCountry(cc, keepRates) {
    var c = E.COUNTRIES[cc] || E.COUNTRIES.US;
    $$('.cur').forEach(function (el) { el.textContent = c.sym; });
    if (!keepRates) {
      var d = E.defaults(cc);
      $('#f [data-k="vat"]').value = d.vat;
      $('#f [data-k="usd"]').value = d.usd;
    }
    $('#usdrow').hidden = cc === 'US';
    var n = $('#cnote');
    if (n) n.textContent = c.intlNote ? 'Processing in ' + c.name + ': ' + c.intlNote + '.' : (c.vatNote ? c.vatNote + '.' : '');
  }
  function compute() {
    var s = E.full(inputs());
    $('#out').innerHTML = V.resultHTML(s);
    return s;
  }

  // ---------- Pro gate ----------
  var PRO_WHAT = {
    'import': 'the month report from your own Etsy monthly statement CSV',
    'items': 'profit per item from your Order Items CSV',
    'save-month': 'saving this month next to your other months',
    'csv-months': 'the CSV download of your saved months',
    'csv-lines': 'the CSV download of every line of this month',
    'print': 'the printable year summary',
    'save-product': 'your saved product list with break-even and target prices',
    'csv-products': 'the CSV download of your products'
  };
  function showPro(what) {
    var box = $('#probox');
    $('#prowhat').textContent = PRO_WHAT[what] || 'this';
    box.hidden = false;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function setPro(on) {
    state.pro = !!on;
    document.documentElement.classList.toggle('is-pro', state.pro);
    $('#prostate').textContent = state.pro ? ' — Save and continue: https://getreadystack.com/apps/etsy-fee-calculator/' : '';
    if (state.pro) { $('#probox').hidden = true; renderHistory(); renderProducts(); renderMonth(); }
  }

  function check(key) {
    var k = String(key || '').trim();
    if (!k) return Promise.resolve('no');
    var i = 0, lost = false;
    function next() {
      if (i >= DOORS.length) return Promise.resolve(lost ? 'unknown' : 'no');
      var door = DOORS[i++];
      return fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door))
        .then(function (r) { return r.json(); })
        .then(function (j) { return j && j.ok ? 'ok' : next(); })
        .catch(function () { lost = true; return next(); });
    }
    return next();
  }
  function useKey(k, msgEl) {
    if (msgEl) msgEl.textContent = 'Checking the key…';
    return check(k).then(function (res) {
      if (res === 'ok') { LS.set('key', String(k).trim()); setPro(true); if (msgEl) msgEl.textContent = ' — Save and continue: https://getreadystack.com/apps/etsy-fee-calculator/'; }
      else if (msgEl) msgEl.textContent = res === 'unknown' ? 'The key check could not be reached. Try again in a minute.' : 'This key was not accepted. Copy it again from your Whop receipt or account.';
      return res === 'ok';
    });
  }

  // ---------- month report ----------
  function renderMonth() {
    var box = $('#month');
    if (!state.st) { box.innerHTML = ''; return; }
    var costs = state.example ? SAMPLE.costs : LS.get('costs', {});
    $('#monthlabel').textContent = state.example ? 'Example month (made-up file, a US seller):' : 'Your month:';
    box.innerHTML = V.monthHTML(state.st, state.items, costs, state.other, state.pro && !state.example);
  }
  function readFile(input, cb) {
    var f = input.files && input.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { cb(String(r.result || ''), f.name); input.value = ''; };
    r.readAsText(f);
  }
  function summary() {
    var st = state.st, costs = LS.get('costs', {});
    var cg = state.items ? E.cogs(state.items.items, costs).total : 0;
    var res = E.monthResult(st, cg, state.other);
    return { month: st.month, currency: st.currency, orders: st.orders, sales: st.sales, cats: st.cats, fees: st.fees, bought: st.bought, net: st.net,
      cogs: cg, other: E.num(state.other), profit: res.profit, file: st.file, items: state.items ? state.items.items : [], savedAt: new Date().toISOString().slice(0, 10) };
  }
  function renderHistory() { $('#history').innerHTML = state.pro ? V.historyHTML(LS.get('months', {})) : ''; }
  function renderProducts() { $('#products').innerHTML = state.pro ? V.productsHTML(LS.get('products', []), inputs()) : ''; }

  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function monthsCSV() {
    var months = LS.get('months', {}), keys = Object.keys(months).sort();
    var head = ['Month', 'Currency', 'Orders', 'Sales'].concat(E.CATS.map(function (c) { return c[1]; })).concat(['Etsy fees', 'Ads + labels', 'Net from Etsy', 'Cost of goods', 'Other costs', 'Profit']);
    var rows = [head];
    keys.forEach(function (k) {
      var m = months[k];
      rows.push([k, m.currency, m.orders, m.sales].concat(E.CATS.map(function (c) { return m.cats[c[0]] || 0; })).concat([m.fees, m.bought, m.net, m.cogs, m.other, m.profit]));
    });
    return E.csv(rows);
  }
  function linesCSV() {
    var rows = [['Date', 'Type', 'Title', 'Info', 'Category', 'Net']];
    var label = {}; E.CATS.forEach(function (c) { label[c[0]] = c[1]; }); label.sale = 'Sales'; label.deposit = 'Deposit'; label.transfer = 'Transfer';
    state.st.lines.forEach(function (l) { rows.push([l.date, l.type, l.title, l.info, label[l.cat] || l.cat, l.value]); });
    return E.csv(rows);
  }
  function productsCSV() {
    var rows = [['Product', 'Country', 'Price', 'Qty', 'Shipping', 'Etsy fees', 'Etsy pays out', 'Your costs', 'Profit', 'Margin %', 'Break-even price', 'Target margin %', 'Price for target']];
    LS.get('products', []).forEach(function (p) {
      var s = E.full(Object.assign({}, inputs(), p.inp));
      rows.push([p.name, s.country, s.price, s.qty, s.ship, s.fees, s.deposit, s.costs, s.profit, Math.round(s.margin * 10) / 10, s.breakEven, s.target, s.targetPrice]);
    });
    return E.csv(rows);
  }
  function printYear() {
    var months = LS.get('months', {}), keys = Object.keys(months).sort();
    if (!keys.length) { $('#promsg').textContent = 'Save at least one month first.'; return; }
    var year = keys[keys.length - 1].slice(0, 4);
    var mine = {}; keys.filter(function (k) { return k.slice(0, 4) === year; }).forEach(function (k) { mine[k] = months[k]; });
    var tot = { sales: 0, fees: 0, bought: 0, net: 0, cogs: 0, other: 0, profit: 0, orders: 0 };
    Object.keys(mine).forEach(function (k) { Object.keys(tot).forEach(function (t) { tot[t] += E.num(mine[k][t]); }); });
    var cc = V.symOf(mine[Object.keys(mine)[0]].currency), M = function (v) { return E.money(v, cc); };
    $('#print-area').innerHTML = '<h2>Etsy shop year summary ' + year + '</h2><p>From the Etsy monthly statements imported into this page. Not tax advice: give it to your bookkeeper with the statements.</p>' +
      V.historyHTML(mine) + '<table class="h-tab"><tbody><tr><th scope="row">Orders</th><td>' + tot.orders + '</td></tr><tr><th scope="row">Sales</th><td>' + M(tot.sales) +
      '</td></tr><tr><th scope="row">Etsy fees</th><td>' + M(tot.fees) + '</td></tr><tr><th scope="row">Etsy Ads + shipping labels</th><td>' + M(tot.bought) + '</td></tr><tr><th scope="row">Net from Etsy</th><td>' + M(tot.net) +
      '</td></tr><tr><th scope="row">Cost of goods + other costs</th><td>' + M(-(tot.cogs + tot.other)) + '</td></tr><tr><th scope="row">Profit</th><td><b>' + M(tot.profit) + '</b></td></tr></tbody></table>' +
      '<p>Printed ' + new Date().toISOString().slice(0, 10) + ' · ' + Object.keys(mine).length + ' months.</p>';
    window.print();
  }

  function pro(what, fn) { return function (ev) { if (ev) ev.preventDefault(); if (!state.pro) return showPro(what); fn(); }; }

  function wire() {
    var f = $('#f');
    f.addEventListener('input', function (ev) { if (ev.target.getAttribute('data-k') === 'country') return; compute(); });
    f.addEventListener('change', function (ev) {
      if (ev.target.getAttribute('data-k') === 'country') setCountry(ev.target.value, false);
      compute(); if (state.pro) renderProducts();
    });
    f.addEventListener('submit', function (ev) { ev.preventDefault(); compute(); });

    $('#btn-import').addEventListener('click', pro('import', function () { $('#file-st').click(); }));
    $('#btn-items').addEventListener('click', pro('items', function () { $('#file-it').click(); }));
    $('#file-st').addEventListener('change', function () {
      readFile(this, function (text, name) {
        var st = E.statement(text, name);
        if (!st.ok) { $('#promsg').textContent = st.why; return; }
        state.st = st; state.example = false; state.items = null; state.other = 0; $('#other').value = '';
        $('#promsg').textContent = 'Read ' + st.lineCount + ' lines of ' + V.monthName(st.month) + '. Add the Order Items CSV for profit per item, then save the month.';
        renderMonth();
      });
    });
    $('#file-it').addEventListener('change', function () {
      readFile(this, function (text, name) {
        var it = E.orderItems(text, name);
        if (!it.ok) { $('#promsg').textContent = it.why; return; }
        if (state.example) { $('#promsg').textContent = 'Import your monthly statement first, then the Order Items CSV of the same month.'; return; }
        state.items = it;
        $('#promsg').textContent = 'Read ' + it.items.length + ' items, ' + it.units + ' units. Type each unit cost once; it is kept for the next months.';
        renderMonth();
      });
    });
    $('#month').addEventListener('change', function (ev) {
      if (!ev.target.classList.contains('ucost') || !state.pro) return;
      var costs = LS.get('costs', {}); var v = ev.target.value.trim();
      if (v === '') delete costs[ev.target.getAttribute('data-key')]; else costs[ev.target.getAttribute('data-key')] = E.num(v);
      LS.set('costs', costs); renderMonth();
    });
    $('#other').addEventListener('change', pro('import', function () { state.other = E.num($('#other').value); renderMonth(); }));
    $('#btn-save-month').addEventListener('click', pro('save-month', function () {
      if (!state.st || state.example) { $('#promsg').textContent = 'Import your own monthly statement first.'; return; }
      if (!state.st.month) { $('#promsg').textContent = 'No month found in this file: rename it like etsy_statement_2026_10.csv.'; return; }
      var months = LS.get('months', {}); months[state.st.month] = summary(); LS.set('months', months);
      $('#promsg').textContent = V.monthName(state.st.month) + ' saved.'; renderHistory();
    }));
    $('#history').addEventListener('click', function (ev) {
      var k = ev.target.getAttribute && ev.target.getAttribute('data-del'); if (!k || !state.pro) return;
      var months = LS.get('months', {}); delete months[k]; LS.set('months', months); renderHistory();
    });
    $('#btn-csv-months').addEventListener('click', pro('csv-months', function () { download('etsy-months.csv', monthsCSV()); }));
    $('#btn-csv-lines').addEventListener('click', pro('csv-lines', function () {
      if (!state.st || state.example) { $('#promsg').textContent = 'Import your own monthly statement first.'; return; }
      download('etsy-lines-' + (state.st.month || 'month') + '.csv', linesCSV());
    }));
    $('#btn-print').addEventListener('click', pro('print', printYear));
    $('#btn-save-product').addEventListener('click', pro('save-product', function () {
      var name = ($('#pname').value || '').trim() || ('Product ' + (LS.get('products', []).length + 1));
      var list = LS.get('products', []); list.push({ name: name, inp: inputs() }); LS.set('products', list);
      $('#pname').value = ''; renderProducts();
    }));
    $('#products').addEventListener('click', function (ev) {
      var i = ev.target.getAttribute && ev.target.getAttribute('data-pdel'); if (i == null || !state.pro) return;
      var list = LS.get('products', []); list.splice(+i, 1); LS.set('products', list); renderProducts();
    });
    $('#btn-csv-products').addEventListener('click', pro('csv-products', function () { download('etsy-products.csv', productsCSV()); }));
    $('#keyform').addEventListener('submit', function (ev) { ev.preventDefault(); useKey($('#key').value, $('#keymsg')); });
    $('#proclose').addEventListener('click', function () { $('#probox').hidden = true; });
  }

  function start() {
    setCountry($('#f [data-k="country"]').value, true);
    compute();
    if (SAMPLE) {
      state.st = E.statement(SAMPLE.statement, SAMPLE.statementName);
      state.items = E.orderItems(SAMPLE.items, SAMPLE.itemsName);
      state.example = true;
      renderMonth();
    }
    wire();
    var m = /[#&]k=([^&]+)/.exec(location.hash || '');
    if (m) {
      var k = decodeURIComponent(m[1]);
      history.replaceState(null, '', location.pathname + location.search);
      useKey(k, $('#keymsg'));
    } else if (LS.get('key', '')) {
      setPro(true);
      check(LS.get('key', '')).then(function (res) { if (res === 'no') { setPro(false); $('#keymsg').textContent = 'Your saved key was not accepted any more.'; } });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
