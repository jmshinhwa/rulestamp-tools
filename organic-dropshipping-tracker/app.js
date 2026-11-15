/* organic dropshipping tracker - page. Math lives in odt.js. Data stays in this browser's localStorage. */
(function () {
  'use strict';
  var O = window.ODT;
  var K_LIC = 'odt.lic', K_PROD = 'odt.products', K_LOG = 'odt.log', K_SET = 'odt.settings';
  var DOORS = ['organic-dropshipping-tracker', 'organic-dropshipping-tracker.monthly', 'organic-dropshipping-tracker.yearly'];
  var FIELDS = ['name', 'price', 'cogs', 'ship', 'duty', 'feePct', 'feeFix', 'extraPct', 'returnPct', 'videos', 'views', 'clicks', 'orders', 'minPerVideo', 'sampleCost', 'ruleVideos', 'targetHour'];
  var PROD_KEYS = ['name', 'price', 'cogs', 'ship', 'duty', 'feePct', 'feeFix', 'extraPct', 'returnPct', 'minPerVideo', 'sampleCost'];
  var CALL = { scale: 'SCALE', fix: 'FIX', keep: 'KEEP TESTING', kill: 'KILL' };
  function $(id) { return document.getElementById(id); }
  function get(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(x) { if (x == null || !isFinite(x)) return '–'; var n = O.r2(x), s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (n < 0 ? '−$' : '$') + s; }
  function int(x) { return x == null || !isFinite(x) ? '–' : Math.round(x).toLocaleString('en-US'); }
  function pct(x) { return x == null || !isFinite(x) ? '–' : (Math.round(x * 100) / 100) + '%'; }
  function today() { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  function unlocked() { return !!get(K_LIC, ''); }
  function form() { var i = {}; FIELDS.forEach(function (k) { var el = document.querySelector('[data-k="' + k + '"]'); i[k] = el ? el.value : ''; }); return i; }
  function badge(v) { return '<span class="verdict v-' + v + '">' + CALL[v] + '</span>'; }

  function advice(o) {
    var p = o.input;
    if (o.verdict === 'kill' && o.profitPerOrder <= 0) return 'Every order loses ' + money(-o.profitPerOrder) + '. Break-even price is ' + money(o.breakEvenPrice) + '; below that, more views only lose more money.';
    if (o.verdict === 'kill') return 'No order after ' + p.videos + ' videos, your rule says decide after ' + p.ruleVideos + '. ' + money(-o.netTest) + ' of samples is the cost of this test.';
    if (o.verdict === 'keep') return o.videosLeft + ' videos left before your rule decides. So far: ' + money(o.netTest) + ' test profit; at ' + money(o.profitPerOrder) + ' an order it needs ' + int(o.ordersNeeded) + ' orders in total to pay ' + money(p.targetHour) + ' per hour.';
    if (o.verdict === 'fix') return 'Profitable, but ' + money(o.perHour) + ' per hour of filming is under your ' + money(p.targetHour) + ' rule. Price that pays your rule at the same ' + p.orders + ' orders: ' + money(o.priceNeeded) + ', or ' + int(o.ordersNeeded) + ' orders at today\'s price.';
    return 'Pays ' + money(o.perHour) + ' per hour of filming, at or above your ' + money(p.targetHour) + ' rule. Film more of the hooks that brought the orders.';
  }
  function render(o) {
    var p = o.input, name = form().name || 'This product';
    var h = '<p class="hero">' + badge(o.verdict) + money(o.profitPerOrder) + ' <small>real profit per order · ' + esc(name) + '</small></p>';
    h += '<div class="kpis">' +
      '<div class="kpi">Supplier margin per order<b>' + money(o.supplierMargin) + '</b></div>' +
      '<div class="kpi">Lost per order to shipping, duty, fees, returns<b class="neg">' + money(o.gonePerOrder) + '</b></div>' +
      '<div class="kpi">Lost across ' + p.orders + ' orders<b class="neg">' + money(o.goneTotal) + '</b></div>' +
      '<div class="kpi">Test profit after samples<b>' + money(o.netTest) + '</b></div>' +
      '<div class="kpi">Per hour of filming (' + O.r2(o.hours) + ' h)<b>' + money(o.perHour) + '</b></div>' +
      '<div class="kpi">Per 1,000 views<b>' + money(o.per1kViews) + '</b></div></div>';
    h += '<p class="' + (o.verdict === 'scale' ? 'okline' : 'warn') + '">' + esc(advice(o)) + '</p>';
    h += '<table><tbody>' +
      '<tr><td>Selling price</td><td>' + money(p.price) + '</td></tr>' +
      '<tr><td>Supplier cost</td><td>−' + money(p.cogs) + '</td></tr>' +
      '<tr><td>Shipping</td><td>−' + money(p.ship) + '</td></tr>' +
      '<tr><td>Import duty and clearance</td><td>−' + money(p.duty) + '</td></tr>' +
      '<tr><td>Card and platform fees (' + O.r2(p.feePct + p.extraPct) + '% + ' + money(p.feeFix) + ')</td><td>−' + money(o.feePerOrder) + '</td></tr>' +
      '<tr><td>Returns (' + p.returnPct + '% of the price)</td><td>−' + money(o.returnPerOrder) + '</td></tr>' +
      '<tr><td><b>Real profit per order</b></td><td><b>' + money(o.profitPerOrder) + '</b></td></tr>' +
      '<tr><td>Break-even price</td><td>' + money(o.breakEvenPrice) + '</td></tr>' +
      '<tr><td>Sales (' + p.orders + ' orders)</td><td>' + money(o.sales) + '</td></tr>' +
      '<tr><td>Views per order · click rate · orders per click</td><td>' + int(o.viewsPerOrder) + ' · ' + pct(o.clickRate) + ' · ' + pct(o.convRate) + '</td></tr>' +
      '<tr><td>Orders per video</td><td>' + (o.ordersPerVideo == null ? '–' : O.r2(o.ordersPerVideo)) + '</td></tr>' +
      '</tbody></table>';
    $('out').innerHTML = h;
  }
  function runCheck() { render(O.calc(form())); }

  /* ---------- Pro ---------- */
  var products = [], log = [];
  function settings() { return { testDays: $('g_days').value, ruleVideos: form().ruleVideos, targetHour: form().targetHour }; }
  function saveAll() { put(K_PROD, products); put(K_LOG, log); put(K_SET, { testDays: $('g_days').value }); }
  function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fromForm() { var i = form(), p = { id: newId(), start: '' }; PROD_KEYS.forEach(function (k) { p[k] = i[k]; }); return p; }
  function gate(msg) { $('upsell').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('upsell').classList.add('warn'); $('keyMsg').textContent = msg; }
  function addProduct() {
    if (!unlocked()) { gate(' — Save and continue: https://getreadystack.com/apps/organic-dropshipping-tracker/'); return; }
    var p = fromForm(); p.start = today(); products.push(p); saveAll(); renderPro();
    $('gMsg').textContent = 'Saved "' + p.name + '". Add its videos below, one line per post.';
  }
  function addVideo() {
    var pid = $('g_prod').value; if (!pid) { $('gMsg').textContent = 'Save a product first.'; return; }
    var d = O.isoOk($('l_date').value) || today();
    log.push({ pid: pid, date: d, video: $('l_video').value, views: O.num($('l_views').value), clicks: O.num($('l_clicks').value), orders: Math.round(O.num($('l_orders').value)) });
    ['l_video', 'l_views', 'l_clicks', 'l_orders'].forEach(function (k) { $(k).value = ''; });
    saveAll(); renderPro();
  }
  function renderPro() {
    var on = unlocked();
    $('proArea').hidden = !on; if (!on) return;
    $('upsell').hidden = true;
    var sel = $('g_prod'), cur = sel.value;
    sel.innerHTML = products.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
    if (cur) sel.value = cur;
    var b = O.board(products, log, settings());
    $('gTbl').querySelector('tbody').innerHTML = b.map(function (x) {
      var o = x.o, t = o.totals;
      return '<tr><td>' + esc(x.p.name) + '</td><td>' + badge(o.verdict) + '</td><td>' + t.videos + '</td><td>' + int(t.views) + '</td><td>' + t.orders + '</td><td>' + money(o.profitPerOrder) +
        '</td><td>' + money(o.netTest) + '</td><td>' + money(o.perHour) + '</td><td>' + money(o.per1kViews) + '</td><td>' + esc(o.decideOn) + '</td><td><button class="x" data-del="' + esc(x.p.id) + '" title="Delete product">✕</button></td></tr>';
    }).join('');
    var tops = b.map(function (x) {
      var v = O.topVideos(x.p.id, log, 3); if (!v.length) return '';
      return '<p><b>' + esc(x.p.name) + '</b> best videos: ' + v.map(function (r) { return '"' + esc(r.video || 'untitled') + '" ' + int(r.views) + ' views, ' + O.num(r.orders) + ' orders'; }).join(' · ') + '</p>';
    }).join('');
    $('gTop').innerHTML = tops;
    var byId = {}; products.forEach(function (p) { byId[p.id] = p; });
    $('lTbl').querySelector('tbody').innerHTML = log.map(function (r, k) { return { r: r, k: k }; })
      .sort(function (a, b) { return String(b.r.date).localeCompare(String(a.r.date)); }).map(function (x) {
        var r = x.r; return '<tr><td>' + esc(r.date) + '</td><td>' + esc(byId[r.pid] ? byId[r.pid].name : '?') + '</td><td>' + esc(r.video) + '</td><td>' + int(r.views) + '</td><td>' + int(r.clicks) + '</td><td>' + O.num(r.orders) + '</td><td><button class="x" data-dl="' + x.k + '" title="Delete line">✕</button></td></tr>';
      }).join('');
  }
  function download(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function importCsv(text) {
    var res = O.csvIn(text), byName = {}, fallback = $('g_prod').value, made = 0;
    products.forEach(function (p) { byName[String(p.name).toLowerCase()] = p.id; });
    res.rows.forEach(function (r) {
      var key = String(r.product || '').toLowerCase(), pid = key ? byName[key] : fallback;
      if (!pid) { var p = fromForm(); p.name = r.product || 'Imported product'; p.start = r.date || today(); products.push(p); pid = byName[key] = p.id; made++; }
      log.push({ pid: pid, date: r.date || today(), video: r.video, views: r.views, clicks: r.clicks, orders: r.orders });
    });
    saveAll(); renderPro();
    $('gMsg').textContent = res.rows.length + ' videos imported' + (made ? ', ' + made + ' new products (costs copied from the form above)' : '') + (res.bad.length ? '; skipped: ' + res.bad.slice(0, 10).join(', ') : '') + '.';
  }
  function report() {
    var b = O.board(products, log, settings()), sum = { views: 0, orders: 0, net: 0 };
    b.forEach(function (x) { sum.views += x.o.totals.views; sum.orders += x.o.totals.orders; sum.net += x.o.netTest; });
    var h = '<h2>organic dropshipping tracker: weekly report ' + today() + '</h2><p>' + b.length + ' products · ' + int(sum.views) + ' views · ' + sum.orders + ' orders · test profit ' + money(sum.net) + '</p>';
    h += '<table class="rows"><tr><th>Product</th><th>Call</th><th>Videos</th><th>Orders</th><th>Profit/order</th><th>Test profit</th><th>Per hour</th><th>Decide on</th></tr>' + b.map(function (x) {
      var o = x.o; return '<tr><td>' + esc(x.p.name) + '</td><td>' + CALL[o.verdict] + '</td><td>' + o.totals.videos + '</td><td>' + o.totals.orders + '</td><td>' + money(o.profitPerOrder) + '</td><td>' + money(o.netTest) + '</td><td>' + money(o.perHour) + '</td><td>' + esc(o.decideOn) + '</td></tr>';
    }).join('') + '</table>' + $('gTop').innerHTML;
    $('report').innerHTML = h; $('report').hidden = false; window.print(); setTimeout(function () { $('report').hidden = true; }, 1000);
  }
  var SAMPLE = [
    { name: 'Sunset lamp', price: '24.99', cogs: '8.40', ship: '6.20', duty: '2.10', feePct: '2.9', feeFix: '0.30', extraPct: '0', returnPct: '6', minPerVideo: '50', sampleCost: '31.50', start: '2026-11-03' },
    { name: 'Magnetic phone mount', price: '19.99', cogs: '7.10', ship: '5.80', duty: '1.80', feePct: '2.9', feeFix: '0.30', extraPct: '0', returnPct: '9', minPerVideo: '40', sampleCost: '18.00', start: '2026-11-06' },
    { name: 'Pet hair roller', price: '29.99', cogs: '6.90', ship: '5.40', duty: '1.70', feePct: '2.9', feeFix: '0.30', extraPct: '0', returnPct: '4', minPerVideo: '35', sampleCost: '22.00', start: '2026-11-08' }];
  var SAMPLE_LOG = [[0, '2026-11-03', 'POV: my room at 9pm', 61000, 540, 14], [0, '2026-11-04', 'Lamp vs no lamp', 18000, 150, 3], [0, '2026-11-05', '3 rooms, one lamp', 42000, 380, 9],
    [1, '2026-11-06', 'Pothole test', 3100, 22, 0], [1, '2026-11-07', 'One-hand mount', 2600, 18, 0], [1, '2026-11-08', 'Mount fails?', 4900, 41, 1],
    [2, '2026-11-08', 'Couch before/after', 88000, 910, 26], [2, '2026-11-09', 'Dog hair challenge', 51000, 470, 12], [2, '2026-11-10', 'Car seat test', 23000, 190, 5]];
  function loadSample() {
    if ((products.length || log.length) && !window.confirm('Replace your board with the example board?')) return;
    products = SAMPLE.map(function (s, k) { var p = Object.assign({}, s); p.id = 'ex' + k; return p; });
    log = SAMPLE_LOG.map(function (r) { return { pid: 'ex' + r[0], date: r[1], video: r[2], views: r[3], clicks: r[4], orders: r[5] }; });
    saveAll(); renderPro();
  }
  function checkKey(k) {
    k = String(k || '').trim(); if (!k) return;
    $('keyMsg').textContent = 'Checking…';
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { $('keyMsg').textContent = 'Key not recognised.'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) { put(K_LIC, k); $('keyMsg').textContent = ' — Save and continue: https://getreadystack.com/apps/organic-dropshipping-tracker/'; loadStore(); renderPro(); } else next(); })
        .catch(function () { next(); });
    })();
  }
  function loadStore() { products = get(K_PROD, []); log = get(K_LOG, []); var s = get(K_SET, {}); if (s.testDays) $('g_days').value = s.testDays; }
  function renderFaq() {
    var el = $('faq'); if (!el || !window.ODT_FAQ) return;
    el.innerHTML = '<h2>Questions</h2>' + window.ODT_FAQ.map(function (f) { return '<h3 id="' + esc(f.id) + '">' + esc(f.q) + '</h3><p>' + esc(f.a) + '</p>'; }).join('');
  }
  function init() {
    if (unlocked()) loadStore();
    $('go').onclick = runCheck;
    $('add').onclick = addProduct;
    $('lAdd').onclick = addVideo;
    $('keyOk').onclick = function () { checkKey($('key').value); };
    FIELDS.forEach(function (k) { var el = document.querySelector('[data-k="' + k + '"]'); if (el) el.addEventListener('input', function () { runCheck(); if (unlocked()) renderPro(); }); });
    $('g_days').addEventListener('input', function () { saveAll(); renderPro(); });
    $('gTbl').onclick = function (e) { var a = e.target.getAttribute && e.target.getAttribute('data-del'); if (!a) return; if (!window.confirm('Delete this product and its videos?')) return;
      products = products.filter(function (p) { return p.id !== a; }); log = log.filter(function (r) { return r.pid !== a; }); saveAll(); renderPro(); };
    $('lTbl').onclick = function (e) { var a = e.target.getAttribute && e.target.getAttribute('data-dl'); if (a == null) return; log.splice(+a, 1); saveAll(); renderPro(); };
    $('xIcs').onclick = function () { var b = O.board(products, log, settings()); download('decision-days.ics', O.ics(b.filter(function (x) { return x.o.decideOn; }).map(function (x) {
      return { date: x.o.decideOn, title: 'Decide: ' + x.p.name + ' - kill, keep or scale', note: 'Now: ' + CALL[x.o.verdict] + ', test profit ' + money(x.o.netTest) }; }), today()), 'text/calendar'); };
    $('xCsv').onclick = function () { download('organic-dropshipping-log.csv', O.csvOut(products, log)); };
    $('xJson').onclick = function () { download('organic-dropshipping-backup.json', JSON.stringify({ v: 1, products: products, log: log, settings: { testDays: $('g_days').value } }, null, 1), 'application/json'); };
    $('xRep').onclick = report;
    $('xSample').onclick = loadSample;
    $('g_csv').onchange = function (e) { var f = e.target.files[0]; if (f) f.text().then(importCsv); };
    $('g_json').onchange = function (e) { var f = e.target.files[0]; if (!f) return; f.text().then(function (tx) { try { var j = JSON.parse(tx); products = j.products || []; log = j.log || []; if (j.settings && j.settings.testDays) $('g_days').value = j.settings.testDays; saveAll(); renderPro(); $('gMsg').textContent = 'Backup restored: ' + products.length + ' products, ' + log.length + ' videos.'; } catch (x) { $('gMsg').textContent = 'That file is not a backup from this tracker.'; } }); };
    function hashKey() { var m = /[#&]k=([^&]+)/.exec(location.hash); if (m) checkKey(decodeURIComponent(m[1])); }
    window.addEventListener('hashchange', hashKey); hashKey();
    $('l_date').value = today();
    renderFaq(); runCheck(); renderPro();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
