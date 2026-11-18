/* monthly bill tracker — page logic. Data stays in this browser (localStorage, Pro only). */
(function () {
  'use strict';
  var doc = document, BT = window.BT, LS = window.localStorage;
  var SLUG = 'monthly-bill-tracker-paycheck-planner';
  var DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var KEY_LS = 'mbt_key', DATA_LS = 'mbt_data';
  var $ = function (id) { return doc.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var M = BT.money;

  // made-up examples (no real person)
  var EX = {
    A: { month: '2026-12', freq: 'biweekly', anchor: '2026-12-04', shift: 'before', pay: '1,640.00', start: '1,520.00', buffer: '100.00', bills: [
      { name: 'Rent', amount: '1,450.00', day: 1, fee: '75.00', how: 'manual' },
      { name: 'Streaming', amount: '18.00', day: 5, fee: '0.00', how: 'auto' },
      { name: 'Phone', amount: '85.00', day: 8, fee: '10.00', how: 'auto' },
      { name: 'Daycare', amount: '720.00', day: 10, fee: '50.00', how: 'manual' },
      { name: 'Internet', amount: '70.00', day: 12, fee: '10.00', how: 'auto' },
      { name: 'Car loan', amount: '412.00', day: 13, fee: '40.00', how: 'auto' },
      { name: 'Car insurance', amount: '186.00', day: 14, fee: '25.00', how: 'auto' },
      { name: 'Credit card payment', amount: '260.00', day: 16, fee: '32.00', how: 'manual' },
      { name: 'Electric', amount: '140.00', day: 22, fee: '15.00', how: 'manual' },
      { name: 'Student loan', amount: '230.00', day: 25, fee: '0.00', how: 'auto' },
      { name: 'Car registration', amount: '165.00', day: 31, fee: '0.00', how: 'manual', repeat: 'yearly', month: 12 }
    ] },
    B: { month: '2027-01', freq: 'semimonthly', anchor: '2027-01-15', shift: 'before', pay: '1,980.00', start: '2,150.00', buffer: '150.00', bills: [
      { name: 'Rent', amount: '1,600.00', day: 1, fee: '80.00', how: 'manual' },
      { name: 'Gym', amount: '40.00', day: 2, fee: '0.00', how: 'auto' },
      { name: 'Phone', amount: '75.00', day: 5, fee: '10.00', how: 'auto' },
      { name: 'Internet', amount: '65.00', day: 9, fee: '10.00', how: 'auto' },
      { name: 'Credit card payment', amount: '310.00', day: 10, fee: '32.00', how: 'manual' },
      { name: "Renter's insurance", amount: '54.00', day: 15, fee: '0.00', how: 'auto', repeat: 'quarterly', month: 1 },
      { name: 'Car loan', amount: '380.00', day: 18, fee: '40.00', how: 'auto' },
      { name: 'Utilities', amount: '160.00', day: 20, fee: '15.00', how: 'manual' },
      { name: 'Personal loan', amount: '290.00', day: 28, fee: '30.00', how: 'auto' }
    ] }
  };

  var pro = false;

  // ---------- form ----------
  function monthOptions() {
    var sel = $('month'), h = '';
    for (var y = 2026; y <= 2028; y++) for (var m = 1; m <= 12; m++) {
      if (y === 2026 && m < 11) continue;
      var v = y + '-' + (m < 10 ? '0' : '') + m;
      h += '<option value="' + v + '">' + BT.MONTHS[m - 1] + ' ' + y + '</option>';
    }
    sel.innerHTML = h;
  }
  function opt(list, v) {
    return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
  }
  function rowHtml(b) {
    b = b || {};
    var months = BT.MONTHS.map(function (n, i) { return [i + 1, n.slice(0, 3)]; });
    return '<tr>' +
      '<td><input class="bn" data-yj-mine value="' + esc(b.name || '') + '" placeholder="Rent"></td>' +
      '<td><input class="ba" data-yj-mine inputmode="decimal" value="' + esc(b.amount || '') + '" placeholder="0.00"></td>' +
      '<td><input class="bd" data-yj-mine inputmode="numeric" value="' + esc(b.day || '') + '" placeholder="1-31"></td>' +
      '<td><input class="bf" data-yj-mine inputmode="decimal" value="' + esc(b.fee || '') + '" placeholder="0.00"></td>' +
      '<td><select class="bh">' + opt([['auto', 'Autopay'], ['manual', 'I pay it']], b.how || 'manual') + '</select></td>' +
      '<td><select class="br">' + opt([['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Once a year']], b.repeat || 'monthly') + '</select></td>' +
      '<td><select class="bm">' + opt(months, b.month || 1) + '</select></td>' +
      '<td><button type="button" class="del" title="Remove">×</button></td></tr>';
  }
  function setBills(list) {
    $('bills').querySelector('tbody').innerHTML = (list || []).map(rowHtml).join('') + (list && list.length ? '' : rowHtml({}) + rowHtml({}) + rowHtml({}));
  }
  function readBills() {
    var out = [];
    Array.prototype.forEach.call($('bills').querySelectorAll('tbody tr'), function (tr) {
      var g = function (c) { return tr.querySelector('.' + c).value; };
      if (!g('bn').trim() && !g('ba').trim()) return;
      out.push({ name: g('bn').trim(), amount: g('ba'), day: g('bd'), fee: g('bf'), how: g('bh'), repeat: g('br'), month: g('bm') });
    });
    return out;
  }
  function loadExample(k) {
    var e = EX[k];
    if (!e) { setBills([]); render(); return; }
    ['month', 'freq', 'anchor', 'shift', 'pay', 'start', 'buffer'].forEach(function (f) { $(f).value = e[f]; });
    setBills(e.bills);
  }
  function input() {
    var mv = String($('month').value || '2026-12').split('-');
    return { year: +mv[0], month: +mv[1], freq: $('freq').value, anchor: $('anchor').value, shift: $('shift').value,
             pay: $('pay').value, start: $('start').value, buffer: $('buffer').value, bills: readBills() };
  }

  // ---------- result ----------
  var last = null;
  function render() {
    var inp = input(), r = BT.plan(inp);
    last = { inp: inp, r: r };
    var h = '';
    var low = r.low;
    if (!r.bills.length) {
      h = '<p class="big">Add your bills below</p><p>Type each bill with its due day and amount; the answer appears here.</p>';
      $('out').innerHTML = h; return r;
    }
    if (r.shortAt) {
      var neg = low.bal < 0;
      var np = r.nextPay;
      var days = np ? Math.round((np.date - r.shortAt.payBy) / 86400000) : 0;
      h += '<p class="verdict bad">' + (neg ? 'Short ' + M(-low.bal) : 'Only ' + M(low.bal) + ' left') + ' on ' + BT.fmtDate(r.shortAt.payBy) +
           (np ? ', ' + days + ' day' + (days === 1 ? '' : 's') + ' before your ' + BT.fmtDate(np.date) + ' paycheck' : ', and no paycheck comes after it this month') + '</p>';
    } else {
      h += '<p class="verdict ok">Every bill is covered on time. Lowest balance ' + M(low.bal) + ' on ' + BT.fmtDate(low.date) + '</p>';
    }
    h += '<div class="nums">' +
      '<div><b>' + M(r.billTotal) + '</b><span>bills in ' + esc(r.monthName) + ' (' + r.bills.length + ')</span></div>' +
      '<div><b>' + M(r.payTotal) + '</b><span>' + r.paydays.length + ' paycheck' + (r.paydays.length === 1 ? '' : 's') + ' land this month</span></div>' +
      '<div class="' + (r.feeAtStake ? 'red' : '') + '"><b>' + M(r.feeAtStake) + '</b><span>late fees at stake</span></div>' +
      '<div><b>' + M(r.need) + '</b><span>' + (r.need ? 'more to keep on the 1st' : 'extra needed') + '</span></div>' +
      '</div>';
    if (r.late.length) {
      h += '<p class="late">At risk of paying late: ' + r.late.map(function (b) { return esc(b.name) + ' ' + M(b.amount) + ' (pay by ' + BT.fmtDate(b.payBy) + ', late fee ' + M(b.fee) + ')'; }).join('; ') + '.</p>';
    }
    // per paycheck
    h += '<table class="per"><thead><tr><th>Paid from</th><th>In</th><th>Bills</th><th>Left</th></tr></thead><tbody>';
    r.periods.forEach(function (P) {
      if (!P.bills.length && P.date === null) return;
      h += '<tr class="' + (P.left < 0 ? 'neg' : '') + '"><td>' + esc(P.label) + (P.moved ? ' <small>(moved from ' + BT.fmtDate(P.sched) + ', ' + esc(P.why) + ')</small>' : '') + '</td><td>' + M(P.inflow) + '</td><td>' + M(P.total) + ' <small>' + P.bills.length + '</small></td><td>' + M(P.left) + '</td></tr>';
    });
    h += '</tbody></table>';
    // timeline
    h += '<table class="tl"><thead><tr><th>Pay by</th><th>Bill</th><th>Amount</th><th>Balance after</th></tr></thead><tbody>';
    r.bills.slice().sort(function (a, b) { return a.payBy - b.payBy || b.amount - a.amount; }).forEach(function (b) {
      h += '<tr class="' + (b.after < 0 ? 'neg' : (b.after < r.buffer ? 'warn' : '')) + '"><td>' + BT.fmtDate(b.payBy) + (b.moved ? ' <small>due ' + BT.fmtDate(b.due) + ', ' + esc(b.why) + '</small>' : '') + '</td><td>' + esc(b.name) + (b.auto ? ' <small>autopay</small>' : '') + '</td><td>' + M(b.amount) + '</td><td>' + M(b.after) + '</td></tr>';
    });
    h += '</tbody></table>';
    if (r.shortAt) {
      h += '<p class="fix">To fix it: keep ' + M(r.need) + ' more in the account on the 1st (from last month\'s paychecks), or ask the lender of a bill due before ' + (r.nextPay ? BT.fmtDate(r.nextPay.date) : 'month end') + ' to move its due date after that payday.</p>';
    }
    $('out').innerHTML = h;
    if (pro) checklist();
    return r;
  }

  // ---------- licence ----------
  function tryKey(k, quiet) {
    if (!k) return;
    var i = 0;
    var next = function () {
      if (i >= DOORS.length) { if (!quiet) $('keymsg').textContent = ' — Save and continue: https://getreadystack.com/apps/monthly-bill-tracker-paycheck-planner/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) { LS.setItem(KEY_LS, k); setPro(true); } else next(); })
        .catch(function () { if (!quiet) $('keymsg').textContent = 'Could not reach the key check. Try again in a minute.'; });
    };
    next();
  }
  function setPro(on) {
    pro = !!on;
    doc.body.classList.toggle('is-pro', pro);
    $('keymsg').textContent = pro ? ' — Save and continue: https://getreadystack.com/apps/monthly-bill-tracker-paycheck-planner/' : '';
    if (pro) { restoreSaved(); render(); }
  }
  function need(what) {
    if (pro) return true;
    $('promsg').innerHTML = '<b>' + esc(what) + ' — Save and continue: https://getreadystack.com/apps/monthly-bill-tracker-paycheck-planner/';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return false;
  }

  // ---------- Pro ----------
  function saved() { try { return JSON.parse(LS.getItem(DATA_LS) || 'null'); } catch (e) { return null; } }
  function save(quiet) {
    var inp = input(), d = saved() || { paid: {} };
    d.month = $('month').value; d.freq = inp.freq; d.anchor = inp.anchor; d.shift = inp.shift;
    d.pay = inp.pay; d.start = inp.start; d.buffer = inp.buffer; d.bills = inp.bills; d.at = new Date().toISOString();
    LS.setItem(DATA_LS, JSON.stringify(d));
    if (!quiet) $('promsg').textContent = 'Saved ' + inp.bills.length + ' bills in this browser.';
    return d;
  }
  function restoreSaved() {
    var d = saved();
    if (!d || !d.bills) return;
    ['month', 'freq', 'anchor', 'shift', 'pay', 'start', 'buffer'].forEach(function (f) { if (d[f] != null) $(f).value = d[f]; });
    $('example').value = 'own';
    setBills(d.bills);
  }
  function checklist() {
    if (!last) return;
    var d = saved() || { paid: {} }, mk = $('month').value, paid = (d.paid || {})[mk] || {};
    var h = '<h3>' + esc(last.r.monthName) + ': tick each bill when it is paid</h3><ul class="check">';
    last.r.bills.slice().sort(function (a, b) { return a.payBy - b.payBy; }).forEach(function (b) {
      var k = b.name + '|' + b.i;
      h += '<li><label><input type="checkbox" data-paid="' + esc(k) + '"' + (paid[k] ? ' checked' : '') + '> ' + BT.fmtDate(b.payBy) + ' · ' + esc(b.name) + ' ' + M(b.amount) + (paid[k] ? ' <small>paid ' + esc(paid[k]) + '</small>' : '') + '</label></li>';
    });
    var pd = 0, all = 0;
    last.r.bills.forEach(function (b) { all += b.amount; if (paid[b.name + '|' + b.i]) pd += b.amount; });
    $('checklist').innerHTML = h + '</ul><p class="hint"><b>Paid ' + M(pd) + ' of ' + M(all) + '</b> · still to pay ' + M(all - pd) + '</p>';
  }
  function rollNext() {
    var r = last.r, d = save(true);
    var y = r.y, m = r.m0 + 2; if (m > 12) { m = 1; y++; }
    var v = y + '-' + (m < 10 ? '0' : '') + m;
    if (!Array.prototype.some.call($('month').options, function (o) { return o.value === v; })) { $('promsg').textContent = 'The planner runs to December 2028.'; return; }
    $('month').value = v;
    $('start').value = (r.end / 100).toFixed(2);
    d.month = v; d.start = $('start').value; LS.setItem(DATA_LS, JSON.stringify(d));
    render();
    $('promsg').textContent = 'Now planning ' + BT.MONTHS[m - 1] + ' ' + y + ', starting from ' + M(r.end) + ' (end of last month). Change it if your bank balance differs.';
  }
  function yearView() {
    var rows = BT.year(last.inp, 12);
    var h = '<h3>12 months ahead</h3><table class="per"><thead><tr><th>Month</th><th>Paychecks</th><th>Bills</th><th>Short by</th><th>Late fees at stake</th><th>End balance</th></tr></thead><tbody>';
    rows.forEach(function (x) {
      h += '<tr class="' + (x.fee ? 'neg' : '') + '"><td>' + esc(x.name) + '</td><td>' + x.paychecks + ' · ' + M(x.pay) + '</td><td>' + M(x.bills) + '</td><td>' + (x.need ? M(x.need) : '–') + '</td><td>' + M(x.fee) + '</td><td>' + M(x.end) + '</td></tr>';
    });
    $('yearout').innerHTML = h + '</tbody></table><p class="hint">Each month starts from the previous month\'s end balance, with the same bills and pay.</p>';
  }
  function download(name, text, type) {
    var a = doc.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  var tag = function () { return $('month').value; };
  var ACT = {
    save: ['Saving your bills', function () { save(); }],
    next: ['Rolling into next month', rollNext],
    year: ['12 months ahead', yearView],
    ics: ['Reminders (.ics)', function () { download('bill-reminders-' + tag() + '.ics', BT.ics(last.r), 'text/calendar'); $('promsg').textContent = 'Calendar file with ' + last.r.bills.length + ' pay-by days downloaded.'; }],
    print: ['Print / PDF', function () { doc.body.classList.add('printing'); window.print(); setTimeout(function () { doc.body.classList.remove('printing'); }, 500); }],
    csv: ['CSV', function () { download('bills-' + tag() + '.csv', BT.csv(last.r), 'text/csv'); }],
    backup: ['Backup', function () { download('monthly-bill-tracker-backup.json', JSON.stringify(save(true), null, 1), 'application/json'); }]
  };

  // ---------- wire ----------
  monthOptions();
  loadExample('A');
  var t = null;
  var soon = function () { clearTimeout(t); t = setTimeout(render, 120); };
  $('inputs').addEventListener('input', function (e) { if (e.target.id !== 'example') soon(); });
  $('inputs').addEventListener('change', function (e) {
    if (e.target.id === 'example') { loadExample(e.target.value); render(); return; }
    soon();
  });
  $('bills').addEventListener('click', function (e) {
    if (e.target.classList.contains('del')) { e.target.closest('tr').remove(); render(); }
  });
  $('add').addEventListener('click', function () { $('bills').querySelector('tbody').insertAdjacentHTML('beforeend', rowHtml({})); });
  $('run').addEventListener('click', function () { render(); $('res').scrollIntoView({ behavior: 'smooth' }); });
  doc.querySelectorAll('[data-pro]').forEach(function (b) {
    b.addEventListener('click', function () { var a = ACT[b.getAttribute('data-pro')]; if (need(a[0])) a[1](); });
  });
  $('restore').addEventListener('click', function (e) { if (!pro) { e.preventDefault(); need('Load backup'); } });
  $('restore').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    f.text().then(function (s) { var d = JSON.parse(s); if (!d || !d.bills) throw new Error('no bills'); LS.setItem(DATA_LS, JSON.stringify(d)); restoreSaved(); render(); $('promsg').textContent = 'Loaded ' + d.bills.length + ' bills.'; })
      .catch(function () { $('promsg').textContent = 'That file is not a monthly bill tracker backup.'; });
  });
  $('checklist').addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-paid'); if (!k) return;
    var d = save(true); d.paid = d.paid || {}; var mk = $('month').value; d.paid[mk] = d.paid[mk] || {};
    if (e.target.checked) d.paid[mk][k] = new Date().toISOString().slice(0, 10); else delete d.paid[mk][k];
    LS.setItem(DATA_LS, JSON.stringify(d)); checklist();
  });
  $('unlock').addEventListener('click', function () { tryKey($('key').value.trim()); });
  render();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { tryKey(decodeURIComponent(hk[1])); history.replaceState(null, '', location.pathname + location.search); }
  else if (LS.getItem(KEY_LS)) tryKey(LS.getItem(KEY_LS), true);

  window.MBT = { render: render, EX: EX, input: input };
})();
