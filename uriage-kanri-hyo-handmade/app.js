/* app.js — 売上管理 表. Data stays in this browser; Pro months live in localStorage. */
(function () {
  'use strict';
  var U = window.UK, S = window.SAMPLE, Y = U.yen, esc = U.esc;
  var SLUG = 'uriage-kanri-hyo-handmade', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var KEY_LS = 'uriage_kanri_key', DATA_LS = 'uriage_kanri_data', DRAFT_LS = 'uriage_kanri_draft';
  var IDS = ['ytd', 'year', 'fx', 'minne_pct', 'creema_pct', 'etsy_pct', 'etsy_usd', 'base_pct', 'base_fix'];
  var $ = function (id) { return document.getElementById(id); };
  var pro = false, last = null;
  var data = { months: [] };
  try { data = JSON.parse(localStorage.getItem(DATA_LS) || 'null') || data; } catch (e) { /* keep empty */ }
  function store() { try { localStorage.setItem(DATA_LS, JSON.stringify(data)); } catch (e) { /* storage full */ } }
  function opts() { var o = {}; IDS.forEach(function (k) { o[k] = $(k).value; }); return o; }
  function today() { return new Date().toISOString().slice(0, 10); }

  function run() {
    var p = U.parse($('list').value);
    $('parseMsg').textContent = p.rows.length + '行を読みました' + (p.skipped.length ? '（販売先か価格が読めない ' + p.skipped.length + '行は除外：' + p.skipped.join('・') + '行目）' : '') + '。';
    if (!p.rows.length) { $('out').innerHTML = '<p class="note">売上を貼ると、ここに利益・赤字の作品・¥200,000ラインが出ます。</p>'; last = null; return; }
    last = U.analyze(p.rows, opts());
    $('out').innerHTML = U.view(last);
    $('proWhy').textContent = ' — 保存して続ける: https://getreadystack.com/ja/apps/uriage-kanri-hyo-handmade/';
    saveDraft();
  }

  function download(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function need(what) {
    if (pro) return true;
    $('keyMsg').textContent = '「' + what + '';
    $('proBox').scrollIntoView({ behavior: 'smooth' });
    return false;
  }
  function openPro() { pro = true; renderSaved(); }
  function tryKey(k) {
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { $('keyMsg').textContent = 'このキーは確認できませんでした。'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) { localStorage.setItem(KEY_LS, k); openPro(); $('keyMsg').textContent = ' — 保存して続ける: https://getreadystack.com/ja/apps/uriage-kanri-hyo-handmade/'; } else next(); })
        .catch(function () { next(); });
    })();
  }
  function yearOf() { return +$('year').value || 2026; }
  function annualHtml() {
    var y = yearOf(), A = U.annual(data.months, y);
    var h = '<h3>' + y + '年分の年間集計（保存した ' + A.months.length + 'か月）</h3><table><tr><th>項目</th><th>金額</th></tr>' +
      '<tr><td>売上（収入金額）</td><td>' + Y(A.sales) + '</td></tr><tr><td>支払手数料</td><td>' + Y(A.fee) + '</td></tr>' +
      '<tr><td>荷造運賃（送料）</td><td>' + Y(A.shipCost) + '</td></tr><tr><td>材料費</td><td>' + Y(A.mat) + '</td></tr>' +
      '<tr><th>所得（保存した月）</th><th>' + Y(A.profit) + '</th></tr>' + (A.before ? '<tr><td>保存する前の月の所得（入力）</td><td>' + Y(A.before) + '</td></tr><tr><th>所得の合計</th><th>' + Y(A.inc) + '</th></tr>' : '') + '</table>' +
      '<p class="' + (A.over ? 'loss' : 'note') + '">' + (A.over ? '¥200,000 を ' + Y(-A.left) + ' 超えています。確定申告の期限は ' + U.jdate(A.deadline) + '。' : '¥200,000 まであと ' + Y(A.left) + '（期限 ' + U.jdate(A.deadline) + '）。') + '</p>';
    var by = {};
    data.months.filter(function (m) { return String(m.month).slice(0, 4) === String(y); }).forEach(function (m) { (m.items || []).forEach(function (it) { var b = by[it.item] || (by[it.item] = { n: 0, profit: 0 }); b.n += it.n; b.profit += it.profit; }); });
    var ks = Object.keys(by).sort(function (a, b) { return by[a].profit / by[a].n - by[b].profit / by[b].n; });
    if (ks.length) h += '<table><tr><th>作品（年間）</th><th>件数</th><th>利益</th><th>1件あたり</th></tr>' + ks.map(function (k) { return '<tr' + (by[k].profit < 0 ? ' class="short"' : '') + '><td>' + esc(k) + '</td><td>' + by[k].n + '</td><td>' + Y(by[k].profit) + '</td><td>' + Y(by[k].profit / by[k].n) + '</td></tr>'; }).join('') + '</table>';
    h += '<table><tr><th>月</th><th>売上</th><th>手数料</th><th>送料</th><th>材料費</th><th>利益</th></tr>' + data.months.filter(function (m) { return String(m.month).slice(0, 4) === String(y); }).map(function (m) { return '<tr><td>' + esc(m.month) + '</td><td>' + Y(m.T.sales) + '</td><td>' + Y(m.T.fee) + '</td><td>' + Y(m.T.shipCost) + '</td><td>' + Y(m.T.mat) + '</td><td>' + Y(m.T.profit) + '</td></tr>'; }).join('') + '</table>';
    return h;
  }
  function renderSaved() {
    $('saved').innerHTML = data.months.map(function (m, i) { return '<option value="' + i + '">' + esc(m.month) + ' · 売上 ' + Y(m.T.sales) + ' · 利益 ' + Y(m.T.profit) + '</option>'; }).join('');
    $('histOut').innerHTML = data.months.length ? annualHtml() : '<p class="note">まだ保存した月はありません。</p>';
  }
  function saveDraft() { try { var o = opts(); o.list = $('list').value; localStorage.setItem(DRAFT_LS, JSON.stringify(o)); } catch (e) { /* ignore */ } }
  function fill(o) { IDS.forEach(function (k) { if (o[k] != null) $(k).value = o[k]; }); if (o.list != null) $('list').value = o.list; }

  IDS.forEach(function (k) { $(k).addEventListener('input', run); $(k).addEventListener('change', run); });
  $('list').addEventListener('change', run);
  $('run').onclick = run;
  $('loadSample').onclick = function () { fill(S); run(); };
  $('file').onchange = function (e) {
    if (!need('CSV ファイルの読み込み')) { e.target.value = ''; return; }
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader(); rd.onload = function () { $('list').value = String(rd.result).replace(/^﻿/, ''); run(); }; rd.readAsText(f);
  };
  $('keyBtn').onclick = function () { var k = $('key').value.trim(); if (k) tryKey(k); };
  $('month').value = today().slice(0, 7);
  $('save').onclick = function () {
    if (!need('月の保存') || !last) return;
    var m = $('month').value || today().slice(0, 7);
    data.months = data.months.filter(function (x) { return x.month !== m; });
    data.months.push({ month: m, T: last.T, items: last.items.map(function (it) { return { item: it.item, n: it.n, profit: it.profit }; }), o: opts(), list: $('list').value });
    data.months.sort(function (a, b) { return a.month < b.month ? -1 : 1; }); store(); renderSaved();
  };
  $('openSaved').onclick = function () { if (!need('保存した月を開く')) return; var m = data.months[+$('saved').value]; if (m) { fill(m.o); $('list').value = m.list; $('month').value = m.month; run(); } };
  $('delSaved').onclick = function () { if (!need('削除')) return; data.months.splice(+$('saved').value, 1); store(); renderSaved(); };
  $('csv').onclick = function () { if (!need('CSV書き出し') || !last) return; download('uriage_kanri_' + ($('month').value || today().slice(0, 7)) + '.csv', U.csv(last), 'text/csv'); };
  $('ics').onclick = function () { if (!need('締め日と申告期限の .ics')) return; download('uriage_kanri_' + yearOf() + '.ics', U.ics(yearOf(), today()), 'text/calendar'); };
  $('print').onclick = function () {
    if (!need('年間集計の印刷・PDF')) return;
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write('<!doctype html><meta charset="utf-8"><title>売上管理 表 年間集計 ' + yearOf() + '</title><link rel="stylesheet" href="./style.css"><body class="wrap"><h1>売上管理 表：' + yearOf() + '年分の年間集計</h1><p>作成日 ' + today() + '</p>' + annualHtml() + '<p class="src">売上管理 表（rulestamp）で作成。</p><script>setTimeout(function(){print()},400)<\/script></body>');
    w.document.close();
  };
  function hashKey() { var m = /[#&]k=([^&]+)/.exec(location.hash); if (m) { var k = decodeURIComponent(m[1]); $('key').value = k; tryKey(k); } }
  window.addEventListener('hashchange', hashKey);

  // start: the saved draft, else the 記入例 — computed at once (no click)
  var d = null; try { d = JSON.parse(localStorage.getItem(DRAFT_LS) || 'null'); } catch (e) { d = null; }
  fill(d && d.list ? d : S); run();
  var k0 = localStorage.getItem(KEY_LS); if (k0) tryKey(k0);
  hashKey();
})();
