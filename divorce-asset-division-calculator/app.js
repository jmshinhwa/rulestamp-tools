/* divorce asset division calculator — page */
(function () {
  'use strict';
  var doc = document, D = window.DAD, S = window.DAD_SAMPLES || {}, LS = window.localStorage;
  var SLUG = 'divorce-asset-division-calculator', DOORS = [SLUG + '.monthly', SLUG];
  var K_KEY = 'dad_key', K_DOOR = 'dad_door', K_DRAFT = 'dad_draft', K_CASES = 'dad_cases';
  var pro = false, door = '', cur = null, dirty = false;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function m(x) { return D.usd(x); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function lsGet(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function stateName(st) { for (var i = 0; i < D.STATES.length; i++) if (D.STATES[i][0] === st) return D.STATES[i][1]; return st; }
  function nm(w) { return w === 'A' ? (cur.nameA || 'Spouse A') : (cur.nameB || 'Spouse B'); }

  /* ---- case <-> form ---- */
  function load(c) {
    cur = clone(c); dirty = false;
    ['nameA', 'nameB', 'pctA', 'ti', 'tcg', 'excl'].forEach(function (k) { $(k).value = cur[k] == null ? '' : cur[k]; });
    $('state').value = cur.state || 'CA';
    drawItems(); draw();
  }
  function readTop() {
    cur.nameA = $('nameA').value.trim(); cur.nameB = $('nameB').value.trim();
    cur.state = $('state').value; cur.pctA = $('pctA').value; cur.ti = $('ti').value; cur.tcg = $('tcg').value; cur.excl = $('excl').value;
  }
  function opts(list, val) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
  function drawItems() {
    var kinds = Object.keys(D.KINDS).map(function (k) { return [k, D.KINDS[k]]; });
    var h = '';
    cur.items.forEach(function (it, i) {
      h += '<tr data-i="' + i + '"><td><input data-f="name" value="' + esc(it.name) + '"></td>' +
        '<td><select data-f="kind">' + opts(kinds, it.kind || 'other') + '</select></td>' +
        '<td><input data-f="value" inputmode="decimal" value="' + esc(it.value == null ? '' : it.value) + '"></td>' +
        '<td><input data-f="basis" inputmode="decimal" placeholder="' + (/home|taxable|business/.test(it.kind) ? 'needed' : '-') + '" value="' + esc(it.basis == null ? '' : it.basis) + '"></td>' +
        '<td><input data-f="sep" inputmode="decimal" placeholder="' + (it.sepOwner ? 'all' : '') + '" value="' + esc(it.sep == null ? '' : it.sep) + '"></td>' +
        '<td><select data-f="sepOwner">' + opts([['', 'none (marital)'], ['A', nm('A')], ['B', nm('B')]], it.sepOwner || '') + '</select></td>' +
        '<td><select data-f="keep">' + opts([['A', nm('A')], ['B', nm('B')], ['sell', 'Sell and split']], it.keep || 'A') + '</select></td>' +
        '<td><button class="btn ghost" data-del="' + i + '" title="Remove">×</button></td></tr>';
    });
    $('items').querySelector('tbody').innerHTML = h;
  }

  /* ---- result ---- */
  function draw() {
    readTop();
    var r = D.compute(cur), A = nm('A'), B = nm('B');
    var st = stateName(cur.state), rule = r.cp ? 'community property state (IRS Pub. 555)' : 'equitable distribution: your percent';
    $('statehint').textContent = r.cp ? st + ' is one of the 9 community property states in IRS Publication 555: the starting point is 50/50.' :
      st + ' divides by equitable distribution: the court looks for a fair split, not always 50/50. Type the percent you agreed or are asking for.';
    var h = '<div class="printhead"><h2>Marital balance sheet: ' + esc(A) + ' and ' + esc(B) + '</h2><p class="hint">Prepared ' + new Date().toISOString().slice(0, 10) + ' · ' + esc(st) + ' · ' + r.pctA + '/' + r.pctB + '</p></div>';
    if (r.payer) h += '<p class="big">' + esc(nm(r.payer)) + ' pays ' + esc(nm(r.payer === 'A' ? 'B' : 'A')) + ' ' + m(r.pay) + '</p>';
    else h += '<p class="big">No equalization payment needed</p>';
    h += '<p class="bigsub">Equalization payment at face value · ' + esc(A) + ' ' + r.pctA + '% / ' + esc(B) + ' ' + r.pctB + '% · ' + esc(st) + ', ' + rule + '</p>';
    var shortBy = Math.abs(r.faceMinusTax), shortWho = r.faceMinusTax > 0 ? 'A' : 'B';
    h += '<div class="tiles">';
    h += '<div class="tile"><b>' + (r.payerAfterTax ? m(r.payAfterTax) : m(0)) + '</b><span>even-up after tax' + (r.payerAfterTax ? ' (' + esc(nm(r.payerAfterTax)) + ' pays)' : '') + '</span></div>';
    h += '<div class="tile loss"><b>' + m(shortBy) + '</b><span>' + (shortBy >= 1 ? esc(nm(shortWho)) + ' loses after tax if paid at face value' : 'face value and after tax agree') + '</span></div>';
    h += '<div class="tile"><b>' + m(r.estate) + '</b><span>net marital estate (' + m(r.assets) + ' assets − ' + m(r.debts) + ' debts, separate parts out)</span></div>';
    h += '<div class="tile"><b>' + m(r.taxA + r.taxB) + '</b><span>tax still owed inside the marital items</span></div>';
    h += '</div>';
    h += '<div class="tbl"><table><thead><tr><th></th><th class="n">' + esc(A) + '</th><th class="n">' + esc(B) + '</th></tr></thead><tbody>' +
      '<tr><td>Target share</td><td class="n">' + m(r.targetA) + '</td><td class="n">' + m(r.targetB) + '</td></tr>' +
      '<tr><td>Keeps at face value</td><td class="n">' + m(r.keptA) + '</td><td class="n">' + m(r.keptB) + '</td></tr>' +
      '<tr><td>Tax due on cash-in</td><td class="n">' + m(r.taxA) + '</td><td class="n">' + m(r.taxB) + '</td></tr>' +
      '<tr><td>Walks away with after tax, once the face-value payment is made</td><td class="n"><b>' + m(r.walkA) + '</b> (' + r.walkPctA + '%)</td><td class="n"><b>' + m(r.walkB) + '</b> (' + r.walkPctB + '%)</td></tr>' +
      '<tr><td>Separate property, not divided</td><td class="n">' + m(r.sepA) + '</td><td class="n">' + m(r.sepB) + '</td></tr>' +
      '</tbody></table></div>';
    h += '<h2>Item by item</h2><div class="tbl"><table><thead><tr><th>Item</th><th class="n">Marital part</th><th>Kept by</th><th class="n">To ' + esc(A) + '</th><th class="n">To ' + esc(B) + '</th><th class="n">Tax on cash-in</th></tr></thead><tbody>';
    r.rows.forEach(function (x) {
      h += '<tr><td>' + esc(x.name) + (x.sepOwner ? '<br><span class="hint">separate ' + esc(nm(x.sepOwner)) + ': ' + m(x.sep) + '</span>' : '') + '</td><td class="n">' + m(x.marital) + '</td><td>' +
        (x.keep === 'sell' ? 'Sell and split' : esc(nm(x.keep))) + '</td><td class="n">' + m(x.toA) + '</td><td class="n">' + m(x.toB) + '</td><td class="n">' + (x.tax ? m(x.tax) : '-') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<p class="printhead hint">Rates used: income tax ' + D.num(cur.ti) + '% on pre-tax retirement, capital gains ' + D.num(cur.tcg) + '%, home exclusion ' + m(D.num(cur.excl)) + '. Sources: IRS Publication 555 (Rev. 12-2024), 504 (2025), 523. Not legal or tax advice.</p>';
    $('out').innerHTML = h;
    if (dirty) lsSet(K_DRAFT, cur);
    if (pro) drawCompare();
    return r;
  }

  /* ---- Pro: key ---- */
  function check(key) {
    var i = 0;
    return new Promise(function (ok) {
      (function next() {
        if (i >= DOORS.length) return ok('');
        var d = DOORS[i++];
        fetch('' + encodeURIComponent(key) + '&slug=' + encodeURIComponent(d)).then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.ok) ok(d); else next(); }).catch(next);
      })();
    });
  }
  function unlock(key, quiet) {
    if (!key) return;
    $('keymsg').textContent = 'Checking the key…';
    check(key).then(function (d) {
      if (d) {
        pro = true; door = d; LS.setItem(K_KEY, key); LS.setItem(K_DOOR, d); doc.body.classList.add('is-pro');
        $('keymsg').textContent = ' — Save and continue: https://getreadystack.com/apps/divorce-asset-division-calculator/' + (d === SLUG ? ' for one case' : ' for unlimited client cases') + '. Name the case and save it; save each settlement idea as a scenario to compare them.';
        drawCases(); drawCompare();
      } else $('keymsg').textContent = quiet ? '' : 'This key does not belong to this calculator.';
    });
  }
  function needPro(what) {
    if (pro) return false;
    $('keymsg').textContent = what + '';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return true;
  }

  /* ---- Pro: cases + scenarios ---- */
  function cases() { return lsGet(K_CASES, {}); }
  function caseName() { return ($('casename').value || '').trim() || ((cur.nameA || 'A') + ' & ' + (cur.nameB || 'B')); }
  function saveCase() {
    if (needPro('Saving a case')) return;
    var all = cases(), n = caseName();
    if (door === SLUG && !all[n] && Object.keys(all).length >= 1) {
      $('keymsg').textContent = 'The one-case plan keeps one case (' + Object.keys(all)[0] + '). Open it, or use the professional plan for more client cases.'; return;
    }
    all[n] = all[n] || { scenarios: {} };
    all[n].data = clone(cur); all[n].updated = new Date().toISOString().slice(0, 10);
    lsSet(K_CASES, all); $('casename').value = n; $('keymsg').textContent = 'Saved: ' + n + '.'; drawCases();
  }
  function saveScenario() {
    if (needPro('Scenarios')) return;
    var all = cases(), n = caseName();
    if (!all[n]) { saveCase(); all = cases(); if (!all[n]) return; }
    var s = ($('scname').value || '').trim() || ('Scenario ' + (Object.keys(all[n].scenarios).length + 1));
    all[n].scenarios[s] = clone(cur); all[n].data = clone(cur);
    lsSet(K_CASES, all); $('scname').value = ''; $('keymsg').textContent = 'Scenario saved: ' + s + '.'; drawCompare();
  }
  function drawCases() {
    var all = cases(), ks = Object.keys(all);
    $('cases').innerHTML = ks.length ? '<h2>Saved cases</h2><ul>' + ks.map(function (k) {
      return '<li><b>' + esc(k) + '</b> · ' + Object.keys(all[k].scenarios || {}).length + ' scenarios · saved ' + esc(all[k].updated || '') +
        ' <button class="btn ghost" data-open="' + esc(k) + '">Open</button> <button class="btn ghost" data-drop="' + esc(k) + '">Delete</button></li>';
    }).join('') + '</ul>' : '<p class="hint">No saved case yet.</p>';
  }
  function compareRows(scs) {
    return Object.keys(scs).map(function (k) { var c = scs[k], r = D.compute(c); return { name: k, c: c, r: r }; });
  }
  function drawCompare() {
    var all = cases(), n = caseName(), sc = all[n] && all[n].scenarios;
    if (!sc || !Object.keys(sc).length) { $('compare').innerHTML = ''; return; }
    var rows = compareRows(sc);
    var h = '<h2>Scenarios for ' + esc(n) + '</h2><div class="tbl"><table><thead><tr><th>Scenario</th><th>Split</th><th class="n">Payment at face value</th><th class="n">Payment after tax</th><th class="n">' +
      esc(cur.nameA || 'A') + ' walks away (after tax)</th><th class="n">' + esc(cur.nameB || 'B') + ' walks away (after tax)</th><th></th></tr></thead><tbody>';
    rows.forEach(function (x) {
      var who = function (p) { return p ? (p === 'A' ? (x.c.nameA || 'A') : (x.c.nameB || 'B')) + ' pays ' : ''; };
      h += '<tr><td>' + esc(x.name) + '</td><td>' + x.r.pctA + '/' + x.r.pctB + '</td><td class="n">' + esc(who(x.r.payer)) + m(x.r.pay) + '</td><td class="n">' + esc(who(x.r.payerAfterTax)) + m(x.r.payAfterTax) +
        '</td><td class="n">' + m(x.r.walkA) + '</td><td class="n">' + m(x.r.walkB) + '</td><td><button class="btn ghost" data-sc="' + esc(x.name) + '">Load</button></td></tr>';
    });
    $('compare').innerHTML = h + '</tbody></table></div>';
  }

  /* ---- files ---- */
  function download(name, text, type) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }

  function wire() {
    $('state').innerHTML = D.STATES.map(function (s) { return '<option value="' + s[0] + '">' + esc(s[1]) + (D.isCP(s[0]) ? ' (community property)' : '') + '</option>'; }).join('');
    $('sample').addEventListener('change', function () {
      var v = this.value;
      if (v === 'blank') load({ state: $('state').value, pctA: 50, nameA: 'Spouse A', nameB: 'Spouse B', ti: 22, tcg: 15, excl: 250000,
        items: [{ name: '', kind: 'home', value: '', keep: 'A' }, { name: '', kind: 'debt', value: '', keep: 'A' }, { name: '', kind: 'pretax', value: '', keep: 'A' }, { name: '', kind: 'cash', value: '', keep: 'B' }] });
      else if (S[v]) load(S[v]);
    });
    $('state').addEventListener('change', function () { dirty = true; if (D.isCP(this.value)) $('pctA').value = 50; draw(); });
    ['nameA', 'nameB'].forEach(function (k) { $(k).addEventListener('input', function () { dirty = true; readTop(); drawItems(); draw(); }); });
    ['pctA', 'ti', 'tcg', 'excl'].forEach(function (k) { var f = function () { dirty = true; draw(); }; $(k).addEventListener('input', f); $(k).addEventListener('change', f); });
    var tb = $('items').querySelector('tbody');
    function onEdit(e) {
      var t = e.target, f = t.getAttribute('data-f'), tr = t.closest('tr'); if (!f || !tr) return;
      var it = cur.items[+tr.getAttribute('data-i')]; it[f] = t.value; dirty = true;
      if (e.type === 'change' && (f === 'kind' || f === 'sepOwner')) drawItems();
      draw();
    }
    tb.addEventListener('input', onEdit); tb.addEventListener('change', onEdit);
    tb.addEventListener('click', function (e) { var d = e.target.getAttribute('data-del'); if (d != null) { dirty = true; cur.items.splice(+d, 1); drawItems(); draw(); } });
    $('addA').addEventListener('click', function () { dirty = true; cur.items.push({ name: '', kind: 'cash', value: '', keep: 'A' }); drawItems(); draw(); });
    $('addD').addEventListener('click', function () { dirty = true; cur.items.push({ name: '', kind: 'debt', value: '', keep: 'A' }); drawItems(); draw(); });
    $('clear').addEventListener('click', function () { dirty = true; cur.items = []; drawItems(); draw(); });
    $('unlock').addEventListener('click', function () { unlock(($('key').value || '').trim()); });
    $('savecase').addEventListener('click', saveCase);
    $('savesc').addEventListener('click', saveScenario);
    $('cases').addEventListener('click', function (e) {
      var o = e.target.getAttribute('data-open'), d = e.target.getAttribute('data-drop'), all = cases();
      if (o && all[o]) { $('casename').value = o; load(all[o].data); drawCompare(); }
      if (d && all[d] && window.confirm('Delete the case "' + d + '" from this browser?')) { delete all[d]; lsSet(K_CASES, all); drawCases(); drawCompare(); }
    });
    $('compare').addEventListener('click', function (e) {
      var s = e.target.getAttribute('data-sc'), all = cases(), n = caseName();
      if (s && all[n] && all[n].scenarios[s]) load(all[n].scenarios[s]);
    });
    $('print').addEventListener('click', function () { if (needPro('The printed balance sheet')) return; draw(); window.print(); });
    $('csv').addEventListener('click', function () {
      if (needPro('The CSV export')) return;
      download('divorce-asset-division-' + stamp() + '.csv', '﻿' + D.csv(cur, D.compute(cur)), 'text/csv');
    });
    $('backup').addEventListener('click', function () {
      if (needPro('The backup')) return;
      download('divorce-asset-division-backup-' + stamp() + '.json', JSON.stringify({ cases: cases(), draft: cur }), 'application/json');
    });
    $('restore').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return; e.target.value = '';
      if (needPro('Restoring a backup')) return;
      var rd = new FileReader();
      rd.onload = function () {
        try { var j = JSON.parse(rd.result); if (j.cases) { lsSet(K_CASES, j.cases); drawCases(); } if (j.draft && j.draft.items) load(j.draft); $('keymsg').textContent = 'Backup restored.'; }
        catch (er) { $('keymsg').textContent = 'This file is not a backup of this calculator.'; }
      };
      rd.readAsText(f);
    });
    $('ics').addEventListener('click', function () {
      if (needPro('Calendar reminders')) return;
      var d = $('icsdate').value; if (!d) { $('keymsg').textContent = 'Pick the date from your settlement first.'; return; }
      var r = D.compute(cur), what = $('icswhat').value;
      var note = what + ' (' + caseName() + ').' + (what.indexOf('Equalization') === 0 && r.payer ? ' ' + nm(r.payer) + ' pays ' + nm(r.payer === 'A' ? 'B' : 'A') + ' ' + m(r.pay) + '.' : '');
      download('divorce-reminder-' + d + '.ics', D.ics(d, what, note), 'text/calendar');
    });
  }

  function start() {
    wire();
    var draft = lsGet(K_DRAFT, null);
    if (draft && draft.items && draft.items.length) {
      var o = doc.createElement('option'); o.value = 'mine'; o.textContent = 'My numbers (kept in this browser)'; $('sample').appendChild(o); $('sample').value = 'mine';
      load(draft);
    } else load(S.A);
    var hash = (location.hash.match(/k=([^&]+)/) || [])[1], k = hash ? decodeURIComponent(hash) : LS.getItem(K_KEY);
    if (k) unlock(k, !hash);
    if (hash) history.replaceState(null, '', location.pathname);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
