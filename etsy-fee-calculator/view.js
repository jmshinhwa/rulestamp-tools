/* view.js: HTML strings for the Etsy fee calculator (no DOM access; used by app.js and by the page build) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.EFCV = factory(root.EFC);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function n2(v) { return (Math.round(v * 10000) / 10000).toString(); }
  function rate(p) { return String(p).replace(/\.0+$/, '') + ' %'; }

  function resultHTML(s) {
    var cc = s.country, c = s.c, M = function (v) { return E.money(v, cc); }, L = s.lines;
    var rows = [];
    var paid = 'item ' + M(s.items) + (s.qty > 1 ? ' (' + s.qty + ' × ' + M(s.price) + ')' : '') + (s.discount ? ' − coupon ' + M(s.discount) : '') +
      ' + shipping ' + M(s.ship) + (s.tax ? ' + tax ' + M(s.tax) : '');
    rows.push(['Buyer pays: ' + paid, M(s.buyer), '']);
    rows.push(['Listing fee: US$0.20 × ' + s.qty + (s.qty > 1 ? ' items' : ' item') + (cc === 'US' ? '' : ' at 1 US$ = ' + c.sym + n2(s.usd)), M(-L.listing), '']);
    rows.push(['Transaction fee: 6.5 % of ' + M(s.order), M(-L.transaction), '']);
    rows.push(['Payment processing: ' + rate(s.ppRate) + ' of ' + M(s.buyer) + ' + ' + M(c.pf), M(-L.processing), '']);
    if (c.rof) rows.push(['Regulatory operating fee: ' + rate(c.rof) + ' of ' + M(s.order) + ' (since 22 June 2026, was ' + rate(c.rofOld != null ? c.rofOld : 0) + ')', M(-L.rof), '']);
    else rows.push(['Regulatory operating fee: none for sellers in ' + (cc === 'US' || cc === 'NL' ? 'the ' : '') + c.name, M(0), 'zero']);
    if (L.offsite) rows.push(['Offsite Ads: ' + s.offRate + ' % of ' + M(s.order) + ' (never more than US$100)', M(-L.offsite), '']);
    if (L.conversion) rows.push(['Currency conversion: 2.5 % of ' + M(s.order), M(-L.conversion), '']);
    if (s.vatPct) rows.push(['VAT/GST on Etsy fees: ' + rate(s.vatPct) + ' of ' + M(L.listing + L.transaction + L.processing + L.rof + L.offsite + L.conversion), M(-L.vat), '']);
    rows.push(['Etsy fees', M(-s.fees), 'sum']);
    if (s.tax) rows.push(['Sales tax ' + M(s.tax) + ': Etsy collects it and passes it on, it is not yours', '—', 'note']);
    rows.push(['Etsy pays out for this order', M(s.deposit), 'sum']);
    rows.push(['Your costs: ' + M(s.cost) + (s.qty > 1 ? ' × ' + s.qty : '') + ' per item + label ' + M(s.label), M(-s.costs), '']);
    rows.push(['Profit', M(s.profit), 'sum big']);
    var h = '<div class="r-top">' +
      '<p class="r-big"><span>Profit on this order</span> <b data-o="profit">' + M(s.profit) + '</b> <em>' + E.pct(s.margin) + ' of ' + M(s.order) + '</em></p>' +
      '<div class="tiles">' +
      '<div><span>Etsy fees</span><b data-o="fees">' + M(s.fees) + '</b><small>' + E.pct(s.feePct) + ' of the order</small></div>' +
      '<div><span>Etsy pays out</span><b data-o="deposit">' + M(s.deposit) + '</b><small>before your costs</small></div>' +
      '<div><span>Break-even price</span><b data-o="be">' + (s.breakEven == null ? '—' : M(s.breakEven)) + '</b><small>per item, profit 0</small></div>' +
      '</div></div>';
    h += '<table class="r-tab"><caption>' + esc(c.name) + ' seller · fees read from Etsy\'s Help Center on 18 Nov 2026</caption><tbody>';
    rows.forEach(function (r) { h += '<tr class="' + r[2] + '"><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; });
    h += '</tbody></table>';
    var w = s.whatIf;
    if (w && !w.already) h += '<p class="r-if">If this order came through an Offsite Ad (' + w.rate + ' %): another ' + M(-w.extra) + ' → profit ' + M(w.profit) + '.</p>';
    else if (w) h += '<p class="r-if">The Offsite Ad costs this order ' + M(-w.extra) + ': without it the profit would be ' + M(w.without) + '.</p>';
    h += '<p class="r-target">Item price for a ' + esc(String(s.target)) + ' % margin: <b data-o="target">' + (s.targetPrice == null ? 'not reachable' : M(s.targetPrice)) + '</b>.</p>';
    if (s.profit < 0) h += '<p class="r-warn">This order loses ' + M(-s.profit) + '. Raise the price to at least ' + (s.breakEven == null ? '—' : M(s.breakEven)) + ' or cut the costs.</p>';
    return h;
  }

  function ratesHTML() {
    var h = '<table class="rates-tab"><thead><tr><th scope="col">Seller country (bank account)</th><th scope="col">Payment processing</th>' +
      '<th scope="col">Regulatory operating fee since 22 June 2026</th><th scope="col">VAT/GST on fees (no VAT ID)</th><th scope="col">US$0.20 listing fee</th></tr></thead><tbody>';
    E.ORDER.forEach(function (k) {
      var c = E.COUNTRIES[k];
      var pp = rate(c.pp) + ' + ' + E.money(c.pf, k) + (c.ppi !== c.pp ? ' (international ' + rate(c.ppi) + ')' : '');
      var rof = c.rof ? rate(c.rof) + (c.rofOld != null ? ' (was ' + rate(c.rofOld) + ')' : '') : '—';
      h += '<tr><th scope="row">' + esc(c.name) + '</th><td>' + esc(pp) + '</td><td>' + esc(rof) + '</td><td>' + (c.vat ? rate(c.vat) : '—') + '</td><td>' + esc(E.money(E.r2(0.2 * c.usd), k)) + '</td></tr>';
    });
    return h + '</tbody></table>';
  }

  var MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function monthName(k) { var m = /^(\d{4})-(\d{2})$/.exec(k || ''); return m ? MN[+m[2] - 1] + ' ' + m[1] : (k || 'Month not found in the file'); }
  function symOf(cur) { var k = Object.keys(E.COUNTRIES).filter(function (x) { return E.COUNTRIES[x].cur === cur; })[0]; return k || 'US'; }

  // st = statement() result · it = orderItems() result or null · costs = {key: unit cost} · editable = Pro inputs for unit costs
  function monthHTML(st, it, costs, other, editable, noLines) {
    var cc = symOf(st.currency), M = function (v) { return E.money(v, cc); };
    var cg = it ? E.cogs(it.items, costs) : { total: 0, missing: 0 };
    var res = E.monthResult(st, cg.total, other);
    var h = '<p class="m-head">' + esc(monthName(st.month)) + ' · ' + st.orders + ' orders · ' + st.lineCount + ' lines read from ' + esc(st.file || 'the file') + (st.currency ? ' · ' + esc(st.currency) : '') + '</p>';
    h += '<div class="tiles m-tiles">' +
      '<div><span>Sales (items + shipping)</span><b>' + M(st.sales) + '</b></div>' +
      '<div><span>Etsy fees</span><b>' + M(st.fees) + '</b><small>' + E.pct(st.feePct) + ' of sales</small></div>' +
      '<div><span>Net from Etsy</span><b>' + M(st.net) + '</b><small>sum of the Net column</small></div>' +
      '<div><span>Profit after your costs</span><b>' + M(res.profit) + '</b><small>' + E.pct(res.margin) + ' of sales</small></div></div>';
    h += '<table class="m-tab"><tbody><tr class="sum"><th scope="row">Sales</th><td>' + M(st.sales) + '</td></tr>';
    E.CATS.forEach(function (c) {
      var v = st.cats[c[0]];
      if (Math.abs(v) >= 0.005) h += '<tr' + (E.FEE_KEYS.indexOf(c[0]) >= 0 ? ' class="fee"' : '') + '><th scope="row">' + esc(c[1]) + '</th><td>' + M(v) + '</td></tr>';
    });
    if (Math.abs(st.check) >= 0.005) h += '<tr><th scope="row">Lines the categories above do not explain</th><td>' + M(st.check) + '</td></tr>';
    h += '<tr class="sum"><th scope="row">Net from Etsy</th><td>' + M(st.net) + '</td></tr>';
    if (it) h += '<tr><th scope="row">Cost of goods: ' + it.units + ' units × your unit costs' + (cg.missing ? ' (' + cg.missing + ' items without a cost)' : '') + '</th><td>' + M(-cg.total) + '</td></tr>';
    if (other) h += '<tr><th scope="row">Other costs this month</th><td>' + M(-other) + '</td></tr>';
    h += '<tr class="sum big"><th scope="row">Profit</th><td>' + M(res.profit) + '</td></tr></tbody></table>';
    if (st.deposits) h += '<p class="m-note">Deposits to your bank (' + M(st.deposits) + ') are transfers of money already counted, so they are left out.</p>';
    if (it && it.items.length) {
      h += '<table class="m-items"><thead><tr><th scope="col">Item</th><th scope="col">Units</th><th scope="col">Sales</th><th scope="col">Unit cost</th><th scope="col">Cost of goods</th></tr></thead><tbody>';
      it.items.forEach(function (x) {
        var u = costs && costs[x.key] !== undefined && costs[x.key] !== '' ? E.num(costs[x.key]) : null;
        h += '<tr><th scope="row">' + esc(x.name) + (x.sku ? ' <small>' + esc(x.sku) + '</small>' : '') + '</th><td>' + x.qty + '</td><td>' + M(x.sales) + '</td><td>' +
          (editable ? '<input class="ucost" data-key="' + esc(x.key) + '" inputmode="decimal" value="' + (u == null ? '' : u) + '" aria-label="Unit cost of ' + esc(x.name) + '">' : (u == null ? '—' : M(u))) +
          '</td><td>' + (u == null ? '—' : M(u * x.qty)) + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    if (!noLines) {
      h += '<details class="m-lines"><summary>Every line of the file, grouped by title (' + st.titles.length + ' titles)</summary><table><tbody>';
      st.titles.forEach(function (t) { h += '<tr><th scope="row">' + esc(t.title) + '</th><td>' + t.n + ' ×</td><td>' + M(t.total) + '</td></tr>'; });
      h += '</tbody></table></details>';
    }
    return h;
  }

  function historyHTML(months) {
    var keys = Object.keys(months || {}).sort();
    if (!keys.length) return '<p class="m-note">No month saved yet. Import a statement and press "Save this month".</p>';
    var h = '<table class="h-tab"><thead><tr><th scope="col">Month</th><th scope="col">Orders</th><th scope="col">Sales</th><th scope="col">Etsy fees</th><th scope="col">Fee %</th>' +
      '<th scope="col">Ads + labels</th><th scope="col">Net from Etsy</th><th scope="col">Cost of goods + other</th><th scope="col">Profit</th><th scope="col">vs month before</th><th scope="col"></th></tr></thead><tbody>';
    var prev = null;
    keys.forEach(function (k) {
      var m = months[k], cc = symOf(m.currency), M = function (v) { return E.money(v, cc); };
      var ch = prev ? m.profit - prev.profit : null;
      h += '<tr><th scope="row">' + esc(monthName(k)) + '</th><td>' + m.orders + '</td><td>' + M(m.sales) + '</td><td>' + M(m.fees) + '</td><td>' + E.pct(m.sales ? -m.fees / m.sales * 100 : 0) + '</td><td>' +
        M(m.bought) + '</td><td>' + M(m.net) + '</td><td>' + M(-(m.cogs + m.other)) + '</td><td><b>' + M(m.profit) + '</b></td><td>' + (ch == null ? '—' : (ch >= 0 ? '+' : '') + M(ch)) +
        '</td><td><button type="button" class="del" data-del="' + esc(k) + '" aria-label="Remove ' + esc(monthName(k)) + '">×</button></td></tr>';
      prev = m;
    });
    return h + '</tbody></table>';
  }

  function productsHTML(list, base) {
    if (!list || !list.length) return '<p class="m-note">No product saved yet. Fill the calculator and press "Save this product".</p>';
    var h = '<table class="p-tab"><thead><tr><th scope="col">Product</th><th scope="col">Price</th><th scope="col">Etsy fees</th><th scope="col">Profit</th><th scope="col">Margin</th>' +
      '<th scope="col">Break-even</th><th scope="col">Price for target</th><th scope="col"></th></tr></thead><tbody>';
    list.forEach(function (p, i) {
      var inp = Object.assign({}, base, p.inp);
      var s = E.full(inp), M = function (v) { return E.money(v, s.country); };
      var low = s.margin < s.target;
      h += '<tr' + (low ? ' class="low"' : '') + '><th scope="row">' + esc(p.name) + '<small>' + esc(E.COUNTRIES[s.country].name) + '</small></th><td>' + M(s.price) + '</td><td>' + M(s.fees) + '</td><td>' + M(s.profit) +
        '</td><td>' + E.pct(s.margin) + (low ? ' ⚠' : '') + '</td><td>' + (s.breakEven == null ? '—' : M(s.breakEven)) + '</td><td>' + (s.targetPrice == null ? '—' : M(s.targetPrice)) +
        '</td><td><button type="button" class="del" data-pdel="' + i + '" aria-label="Remove ' + esc(p.name) + '">×</button></td></tr>';
    });
    return h + '</tbody></table>';
  }

  return { esc: esc, resultHTML: resultHTML, ratesHTML: ratesHTML, monthHTML: monthHTML, historyHTML: historyHTML, productsHTML: productsHTML, monthName: monthName, symOf: symOf };
});
