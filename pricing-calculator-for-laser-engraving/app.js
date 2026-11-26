/* */
(function () {
  'use strict';
  var E = window.LZE, $ = function (s) { return document.querySelector(s); };
  var SLUG = 'pricing-calculator-for-laser-engraving', DOORS = [SLUG];
  var pro = false, key = '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function vals() { var v = {}; document.querySelectorAll('[data-k]').forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  var U = E.usd;
  function render() {
    var r = E.price(vals()), c = r.cost, v = r.v, etsy = v.channel === 'etsy';
    var lossLine = r.naive.profit < 0
      ? 'Skip the waste, setup and design time and you would charge <b>' + U(r.naive.price) + '</b>. At that price this order loses <b class="neg">' + U(-r.naive.profit) + '</b>.'
      : 'Skip the waste, setup and design time and you would charge <b>' + U(r.naive.price) + '</b>, keeping only <b>' + U(r.naive.profit) + '</b> instead of ' + U(r.profit) + '.';
    $('#out').innerHTML =
      '<div class="big"><span class="lbl">Price to charge for this order</span><span class="num">' + U(r.price) + '</span></div>' +
      '<p class="sub">' + U(r.perPiece) + ' a piece · profit kept ' + U(r.profit) + (etsy ? ' after ' + U(r.fees.total) + ' Etsy fees' : ' (direct sale, no Etsy fees)') + '</p>' +
      '<p class="loss">' + lossLine + ' Undercharged by ' + U(r.under) + '.</p>' +
      '<table class="brk"><tbody>' +
      '<tr><td>Material, ' + v.qty + ' pieces + ' + v.waste + '% waste</td><td>' + U(c.mat) + '</td></tr>' +
      '<tr><td>Laser time, ' + c.laserMin + ' min</td><td>' + U(c.laser) + '</td></tr>' +
      '<tr><td>Your time, ' + c.handMin + ' min</td><td>' + U(c.labour) + '</td></tr>' +
      '<tr><td>Packing and extras</td><td>' + U(c.pack) + '</td></tr>' +
      '<tr class="tot"><td>Full cost</td><td>' + U(c.total) + '</td></tr>' +
      (etsy ? '<tr><td>Etsy fees: 6.5% ' + U(r.fees.tx) + ' · processing ' + U(r.fees.pp) + ' · listing ' + U(r.fees.list) + '</td><td>' + U(r.fees.total) + '</td></tr>' : '') +
      '<tr class="tot"><td>Profit kept (' + v.margin + '% margin)</td><td>' + U(r.profit) + '</td></tr>' +
      '</tbody></table>';
    return r;
  }
  document.querySelectorAll('[data-k]').forEach(function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });

  // ── Pro storage
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k) || '') || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var jobs = load('lze_jobs', []), mats = load('lze_mats', []);
  function products() { var seen = {}, out = []; jobs.slice().reverse().forEach(function (j) { var p = (j.product || '').trim(); if (p && !seen[p.toLowerCase()]) { seen[p.toLowerCase()] = 1; out.push(j); } }); return out.reverse(); }
  var NAMES = { save: 'saving this order to your job log', mat: 'blank stock', xlsx: 'the Excel workbook (job log, profit by month, stock, price list)', csv: 'the job log CSV', bak: 'the backup file', restore: 'loading a backup', del: 'your job log' };
  function needPro(what) {
    if (pro) return false;
    $('#proMsg').innerHTML = ' — Save and continue: https://getreadystack.com/apps/pricing-calculator-for-laser-engraving/' + esc(NAMES[what] || 'this') + '' + SLUG + '';
    $('#proMsg').scrollIntoView({ block: 'nearest' });
    return true;
  }
  function table(head, rows) { return '<table><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>'; }
  function showPro() {
    if (!jobs.length) { $('#logOut').innerHTML = '<p class="msg">No jobs saved yet.</p>'; } else {
      $('#logOut').innerHTML = table(['Date', 'Job', 'Product', 'Pieces', 'Full cost', 'Charged', 'Etsy fees', 'Profit', ''], jobs.map(function (j, i) {
        var x = E.jobRow(j);
        return '<tr><td>' + esc(j.date) + '</td><td>' + esc(j.name) + '</td><td>' + esc(j.product) + '</td><td>' + x.r.v.qty + '</td><td>' + U(x.r.cost.total) + '</td><td>' + U(x.charged) + '</td><td>' + U(x.fees) + '</td><td class="' + (x.profit < 0 ? 'neg' : '') + '">' + U(x.profit) + '</td><td><button type="button" class="del" data-i="' + i + '">Delete</button></td></tr>';
      }));
    }
    var M = E.months(jobs);
    $('#monOut').innerHTML = M.length ? table(['Month', 'Jobs', 'Charged', 'Etsy fees', 'Full cost', 'Profit', 'Laser hours', 'Your hours'], M.map(function (m) {
      return '<tr><td>' + esc(m.month) + '</td><td>' + m.jobs + '</td><td>' + U(m.revenue) + '</td><td>' + U(m.fees) + '</td><td>' + U(m.cost) + '</td><td>' + U(m.profit) + '</td><td>' + E.r2(m.laserMin / 60) + '</td><td>' + E.r2(m.handMin / 60) + '</td></tr>';
    })) : '';
    var S = E.stock(mats, jobs);
    $('#stockOut').innerHTML = S.length ? table(['Material', 'Cost each', 'Bought', 'Used', 'Left', 'Reorder at', 'Status', 'Stock value'], S.map(function (s) {
      return '<tr><td>' + esc(s.name) + '</td><td>' + U(s.unit) + '</td><td>' + s.bought + '</td><td>' + s.used + '</td><td>' + s.left + '</td><td>' + s.reorder + '</td><td class="' + (s.status === 'REORDER' ? 'neg' : '') + '">' + s.status + '</td><td>' + U(s.value) + '</td></tr>';
    })) : '';
    var P = E.priceList(products());
    $('#listOut').innerHTML = P.length ? table(['Product', '1 piece', '5 pieces, each', '10 pieces, each', '25 pieces, each'], P.map(function (p) {
      return '<tr><td>' + esc(p.p.product) + '</td>' + p.each.map(function (x) { return '<td>' + U(x) + '</td>'; }).join('') + '</tr>';
    })) : '';
    document.querySelectorAll('#logOut .del').forEach(function (b) { b.addEventListener('click', function () { if (needPro('del')) return; jobs.splice(+b.getAttribute('data-i'), 1); save('lze_jobs', jobs); showPro(); }); });
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  $('#jDate').value = today();
  $('#saveBtn').addEventListener('click', function () {
    if (needPro('save')) return;
    var j = vals(); j.date = $('#jDate').value || today(); j.name = $('#jName').value.trim() || 'Job ' + (jobs.length + 1); j.product = $('#jProd').value.trim(); j.material = $('#jMat').value.trim(); j.charged = $('#jCharged').value.trim();
    jobs.push(j); save('lze_jobs', jobs); showPro();
    var x = E.jobRow(j); $('#saveMsg').textContent = 'Saved: ' + j.name + ', charged ' + U(x.charged) + ', profit ' + U(x.profit) + '.';
  });
  $('#matBtn').addEventListener('click', function () {
    if (needPro('mat')) return;
    var n = $('#mName').value.trim(); if (!n) { $('#proMsg').textContent = 'Type the material name first (the same name you use in the job log).'; return; }
    mats = mats.filter(function (m) { return m.name.toLowerCase() !== n.toLowerCase(); });
    mats.push({ name: n, unit: E.num($('#mUnit').value), bought: E.num($('#mBought').value), reorder: E.num($('#mReorder').value) }); save('lze_mats', mats); showPro();
  });
  function dl(name, data, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  $('#xlsxBtn').addEventListener('click', function () {
    if (needPro('xlsx')) return;
    var v = E.clean(vals());
    dl('laser-job-cost-profit-tracker.xlsx', E.workbook({ jobs: jobs, materials: mats, products: products(), priceJob: v, year: new Date().getFullYear() }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    $('#proMsg').textContent = 'Excel workbook downloaded: ' + jobs.length + ' jobs, ' + mats.length + ' materials, ' + products().length + ' products, with live formulas.';
  });
  $('#csvBtn').addEventListener('click', function () { if (needPro('csv')) return; dl('laser-job-log.csv', '﻿' + E.csv(jobs), 'text/csv;charset=utf-8'); });
  $('#bakBtn').addEventListener('click', function () { if (needPro('bak')) return; dl('laser-job-log-backup.json', JSON.stringify({ v: 1, jobs: jobs, materials: mats }, null, 1), 'application/json'); });
  $('#restore').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    if (needPro('restore')) { ev.target.value = ''; return; }
    var rd = new FileReader();
    rd.onload = function () { try { var d = JSON.parse(rd.result); if (!Array.isArray(d.jobs)) throw 0; jobs = d.jobs; mats = Array.isArray(d.materials) ? d.materials : []; save('lze_jobs', jobs); save('lze_mats', mats); showPro(); $('#proMsg').textContent = 'Backup loaded: ' + jobs.length + ' jobs.'; } catch (e) { $('#proMsg').textContent = 'That file is not a backup from this page.'; } };
    rd.readAsText(f); ev.target.value = '';
  });


  function tryKey(k) {
    k = String(k || '').trim(); if (!k) return Promise.resolve(false);
    var i = 0;
    function next() {
      if (i >= DOORS.length) return Promise.resolve(false);
      var d = DOORS[i++];
      return fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(d)).then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? true : next(); }, function () { return next(); });
    }
    return next();
  }
  function setPro(on) { pro = on; document.body.classList.toggle('is-pro', on); $('#tier').textContent = on ? ' — Save and continue: https://getreadystack.com/apps/pricing-calculator-for-laser-engraving/' : ''; showPro(); }
  function unlock(k) {
    $('#keyMsg').textContent = 'Checking the key…';
    tryKey(k).then(function (ok) {
      if (ok) { key = String(k).trim(); save('lze_key', key); setPro(true); $('#keyMsg').textContent = ' — Save and continue: https://getreadystack.com/apps/pricing-calculator-for-laser-engraving/'; }
      else $('#keyMsg').textContent = 'That key did not work. Copy it again from your Whop receipt.';
    });
  }
  $('#keyBtn').addEventListener('click', function () { unlock($('#key').value); });
  var hk = (location.hash.match(/k=([^&]+)/) || [])[1], saved = load('lze_key', '');
  if (hk) { unlock(decodeURIComponent(hk)); history.replaceState(null, '', location.pathname + location.search); } else if (saved) unlock(saved);

  render(); showPro();
})();
