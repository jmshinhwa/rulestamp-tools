/* FX ロット計算 — page script (free calculator + Pro trade log) */
(function () {
  'use strict';
  var F = window.FXL, S = window.FXL_SAMPLES, LOGS = window.FXL_LOG_SAMPLE || [], LS = window.localStorage, doc = document;
  var SLUG = 'fx-lot-keisan-kiroku', DOORS = [SLUG, SLUG + '.yearly'];
  var K_KEY = 'fxlk_key', K_DOOR = 'fxlk_door', K_DATA = 'fxlk_data', K_DRAFT = 'fxlk_draft';
  var FIELDS = ['bal', 'risk', 'pair', 'dir', 'entry', 'stop', 'target', 'unit', 'step', 'qjpy', 'dayPct', 'dayLost'];
  var pro = false, lastPlan = null;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function y(n) { return F.yen(n); }
  function lsGet(k, d) { try { var v = LS.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtN(n, d) { return Number(n).toLocaleString('ja-JP', { maximumFractionDigits: d == null ? 2 : d }); }
  function signedR(r) { r = Math.round(r * 100) / 100; return (r > 0 ? '+' : '') + r.toFixed(2) + 'R'; }

  /* ---- data (Pro) ---- */
  function data() {
    var d = lsGet(K_DATA, null);
    if (!d || !d.accounts) d = { cur: 'メイン口座', streak: 2, accounts: { 'メイン口座': { start: 1000000, trades: [] } } };
    return d;
  }
  function saveData(d) { lsSet(K_DATA, d); }
  function acct(d) { d = d || data(); return d.accounts[d.cur] || (d.accounts[d.cur] = { start: 0, trades: [] }); }

  /* ---- form ---- */
  function fillPairs() {
    var h = '';
    Object.keys(F.PAIRS).forEach(function (p) { h += '<option value="' + p + '">' + p + '</option>'; });
    $('pair').innerHTML = h;
  }
  function read() { var o = {}; FIELDS.forEach(function (k) { o[k] = $(k).value; }); return o; }
  function put(o) { FIELDS.forEach(function (k) { if (o[k] !== undefined) $(k).value = o[k]; }); }
  function loadSample(key) {
    if (key === 'blank') put({ bal: '', risk: '1', entry: '', stop: '', target: '', qjpy: '', dayPct: '', dayLost: '' });
    else put(S[key] || S.A);
  }

  /* ---- the answer ---- */
  function render() {
    var p = read(), q = F.quoteOf(p.pair);
    $('qjpyl').style.display = q === 'JPY' ? 'none' : '';
    $('qjpyl').firstChild.nodeValue = '決済通貨の円レート（' + q + '/JPY）';
    var r = F.plan(p); lastPlan = { p: p, r: r };
    var h = '';
    if (r.errors.length) {
      h = '<div class="warn">' + r.errors.map(esc).join('<br>') + '</div>';
      $('out').innerHTML = h; return r;
    }
    if (r.dayStop) {
      h += '<div class="big stop"><b>0ロット</b><span>今日の損失 ' + y(F.num(p.dayLost)) + ' が1日の上限 ' + y(r.dayLimit) + ' に届いています。今日はここまで。</span></div>';
    } else {
      h += '<div class="big"><b>' + fmtN(r.lots, 2) + 'ロット</b><span>発注ロット（' + fmtN(r.units, 0) + '通貨・' + esc(r.pair) + ' ' + (r.dir === 'sell' ? '売り' : '買い') + '）</span></div>';
    }
    if (r.wrongUnit) h += '<p class="warn">1ロット＝10万通貨の口座で同じ' + fmtN(r.lots, 2) + 'ロットを入れると、損切り時の損失は <b>' + y(r.wrongUnit) + '</b>（口座の' + (Math.round(r.wrongUnit / F.num(p.bal) * 1000) / 10) + '%）。発注画面の1ロットの通貨数を確かめてください。</p>';
    h += '<div class="tiles">';
    h += '<div class="tile loss"><b>' + y(r.stopLoss) + '</b><span>損切り時の損失（口座の' + r.stopLossPct + '%・損切り幅' + fmtN(r.pips, 1) + 'pips）</span></div>';
    if (r.targetGain !== undefined) h += '<div class="tile"><b>' + y(r.targetGain) + '</b><span>利確時の利益（R:R 1:' + r.rr.toFixed(2) + '・損益分岐の勝率' + r.breakEvenWin + '%）</span></div>';
    h += '<div class="tile"><b>' + y(r.margin) + '</b><span>必要証拠金4%（取引額' + y(r.notional) + '・実効レバレッジ' + r.leverage + '倍）</span></div>';
    if (r.dayLeft !== null) h += '<div class="tile' + (r.cappedByDay ? ' loss' : '') + '"><b>' + y(r.dayLeft) + '</b><span>今日の残り損失枠（上限' + y(r.dayLimit) + '）' + (r.cappedByDay ? '：1回の許容' + y(r.allowTrade) + 'より小さいのでロットを減らしました' : '') + '</span></div>';
    h += '</div>';
    if (r.overLev) h += '<p class="warn">実効レバレッジ' + r.leverage + '倍は25倍（証拠金4%）を超えます。このロットは発注できません。</p>';
    else if (r.marginShort) h += '<p class="warn">必要証拠金が口座残高を超えます。</p>';
    h += '<p class="hint">許容損失 ' + y(r.allowTrade) + ' ÷ 1ロットの損失 ' + y(r.lossPerLot) + ' を' + r.step + 'ロット単位で切り捨て。</p>';
    $('out').innerHTML = h;
    lsSet(K_DRAFT, p);
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
    key = (key || '').trim(); if (!key) return;
    $('keymsg').textContent = 'キーを確認しています…';
    check(key).then(function (d) {
      if (d) {
        pro = true; LS.setItem(K_KEY, key); LS.setItem(K_DOOR, d); doc.body.classList.add('is-pro');
        $('keymsg').textContent = 'Proが使えます。上の計算を「このトレードを記録に追加」で残し、決済したら決済価格を入れてください。';
        syncFromLog(); drawLog();
      } else $('keymsg').textContent = quiet ? '' : 'このキーはこの計算機のものではありません。';
    });
  }
  function needPro(what) {
    if (pro) return false;
    $('keymsg').textContent = what + 'はProの機能です。キーを入れるか、上のプランを選んでください。';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return true;
  }

  /* ---- Pro: log ---- */
  function syncFromLog() {
    if (!pro) return;
    var d = data(), a = acct(d), s = F.stats(a.trades, today(), { streakLimit: d.streak });
    if (a.start > 0) $('bal').value = String(a.start + s.pl);
    $('dayLost').value = String(s.todayLoss);
    $('lostfrom').textContent = '口座残高と今日の損失は記録（' + d.cur + '）から：開始 ' + y(a.start) + ' ＋ 決済済み ' + y(s.pl) + '、今日の損益 ' + y(s.todayPl) + '。' + (s.streakStop ? ' 連敗' + s.streakNow + '回：連敗ストップに届きました。今日はここまで。' : '');
    render();
  }
  function statsHtml(s, title) {
    var h = '<div class="tiles">' +
      '<div class="tile"><b>' + s.winRate + '%</b><span>勝率（' + s.wins + '勝' + s.losses + '敗）</span></div>' +
      '<div class="tile"><b>' + signedR(s.avgR) + '</b><span>平均R（1トレードの期待値）</span></div>' +
      '<div class="tile' + (s.pl < 0 ? ' loss' : '') + '"><b>' + y(s.pl) + '</b><span>損益合計' + (s.pf != null ? '（PF ' + s.pf + '）' : '') + '</span></div>' +
      '<div class="tile' + (s.streakStop ? ' loss' : '') + '"><b>' + s.maxStreak + '回</b><span>最大連敗（いま' + s.streakNow + '連敗）</span></div></div>';
    var mk = Object.keys(s.months).sort();
    if (mk.length) {
      h += '<div class="tbl"><table><thead><tr><th>月</th><th class="n">件数</th><th class="n">勝率</th><th class="n">平均R</th><th class="n">損益</th></tr></thead><tbody>';
      mk.forEach(function (k) { var m = s.months[k]; h += '<tr><td>' + k + '</td><td class="n">' + m.n + '</td><td class="n">' + Math.round(m.wins / m.n * 1000) / 10 + '%</td><td class="n">' + signedR(m.sumR / m.n) + '</td><td class="n">' + y(m.pl) + '</td></tr>'; });
      h += '</tbody></table></div>';
      h += '<div class="tbl"><table><thead><tr><th>通貨ペア</th><th class="n">件数</th><th class="n">平均R</th><th class="n">損益</th></tr></thead><tbody>';
      Object.keys(s.pairs).forEach(function (k) { var m = s.pairs[k]; h += '<tr><td>' + esc(k) + '</td><td class="n">' + m.n + '</td><td class="n">' + signedR(m.sumR / m.n) + '</td><td class="n">' + y(m.pl) + '</td></tr>'; });
      h += '</tbody></table></div>';
    }
    return (title ? '<p class="hint">' + title + '</p>' : '') + h;
  }
  function drawLog() {
    var trades, title, d = null;
    if (pro) { d = data(); trades = acct(d).trades; title = '記録：' + d.cur + '（' + trades.length + '件）'; $('streak').value = d.streak; drawAccts(d); }
    else { trades = LOGS; title = '記入例の記録（架空・5トレード）：Proでは自分のトレードがここに貯まります。'; }
    $('logtitle').textContent = title;
    var s = F.stats(trades, pro ? today() : '2026-11-18', { streakLimit: d ? d.streak : 2 });
    $('stats').innerHTML = statsHtml(s);
    var h = '';
    trades.forEach(function (t, i) {
      var c = F.num(t.exit) > 0 ? F.closeTrade(t) : null;
      h += '<tr><td>' + esc(t.date) + '</td><td>' + esc(t.pair) + '</td><td>' + (t.dir === 'sell' ? '売り' : '買い') + '</td><td class="n">' + esc(t.entry) + '</td><td class="n">' + esc(t.stop) + '</td><td class="n">' + esc(t.lots) + '</td>' +
        '<td class="n">' + (pro ? '<input class="exit" data-i="' + i + '" value="' + esc(t.exit || '') + '" inputmode="decimal" size="7">' : esc(t.exit)) + '</td>' +
        '<td class="n' + (c && c.pl < 0 ? ' neg' : '') + '">' + (c ? y(c.pl) : '-') + '</td><td class="n">' + (c ? signedR(c.r) : '-') + '</td><td>' + esc(t.memo || '') + '</td>' +
        '<td>' + (pro ? '<button class="del" data-i="' + i + '" title="削除">×</button>' : '') + '</td></tr>';
    });
    $('log').querySelector('tbody').innerHTML = h;
  }
  function drawAccts(d) {
    var h = '';
    Object.keys(d.accounts).forEach(function (n) { h += '<option' + (n === d.cur ? ' selected' : '') + '>' + esc(n) + '</option>'; });
    $('acct').innerHTML = h;
  }
  function addTrade() {
    if (needPro('記録')) return;
    var r = render(); if (!r || r.errors.length || !(r.lots > 0)) { $('keymsg').textContent = 'ロットが0のトレードは記録できません。'; return; }
    var p = lastPlan.p, d = data();
    acct(d).trades.push({ date: today(), pair: p.pair, dir: p.dir, entry: p.entry, stop: p.stop, target: p.target, exit: '', lots: r.lots, unit: F.num(p.unit), qjpy: p.qjpy, cost: 0, memo: '' });
    saveData(d); drawLog(); $('keymsg').textContent = '記録しました。決済したら表の「決済」に価格を入れてください。';
  }
  function download(name, text, type) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function readFile(input, fn) { var f = input.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { fn(String(rd.result)); input.value = ''; }; rd.readAsText(f); }

  /* ---- wire ---- */
  function init() {
    fillPairs();
    var draft = lsGet(K_DRAFT, null);
    if (draft && draft.entry) put(draft); else loadSample('A');
    render(); drawLog();
    $('sample').addEventListener('change', function () { loadSample(this.value); render(); });
    FIELDS.forEach(function (k) { $(k).addEventListener('input', render); $(k).addEventListener('change', render); });
    $('unlock').addEventListener('click', function () { unlock($('key').value); });
    $('addtrade').addEventListener('click', addTrade);
    $('log').addEventListener('change', function (e) {
      if (!pro || !e.target.classList.contains('exit')) return;
      var d = data(), i = +e.target.getAttribute('data-i'); if (acct(d).trades[i].exit === e.target.value) return; acct(d).trades[i].exit = e.target.value; saveData(d); setTimeout(function () { drawLog(); syncFromLog(); }, 0);
    });
    $('log').addEventListener('click', function (e) {
      if (!pro || !e.target.classList.contains('del')) return;
      var d = data(); acct(d).trades.splice(+e.target.getAttribute('data-i'), 1); saveData(d); drawLog(); syncFromLog();
    });
    $('acct').addEventListener('change', function () { var d = data(); d.cur = this.value; saveData(d); drawLog(); syncFromLog(); });
    $('addacct').addEventListener('click', function () {
      if (needPro('複数口座')) return;
      var n = ($('acctname').value || '').trim(); if (!n) return;
      var d = data(); if (!d.accounts[n]) d.accounts[n] = { start: F.num($('acctbal').value), trades: [] }; d.cur = n; saveData(d); drawLog(); syncFromLog();
    });
    $('streak').addEventListener('change', function () { if (!pro) return; var d = data(); d.streak = F.num(this.value); saveData(d); drawLog(); syncFromLog(); });
    $('csv').addEventListener('click', function () { if (needPro('CSV書き出し')) return; var d = data(); download('fx-trade-log-' + today() + '.csv', F.csv(acct(d).trades), 'text/csv'); });
    $('csvin').addEventListener('change', function () {
      if (needPro('CSV取り込み')) { this.value = ''; return; }
      readFile(this, function (t) { var d = data(), rows = F.parseCsv(t); acct(d).trades = acct(d).trades.concat(rows); saveData(d); drawLog(); syncFromLog(); $('keymsg').textContent = rows.length + '件を取り込みました。'; });
    });
    $('backup').addEventListener('click', function () { if (needPro('バックアップ')) return; download('fx-lot-keisan-backup-' + today() + '.json', JSON.stringify(data(), null, 1), 'application/json'); });
    $('restore').addEventListener('change', function () {
      if (needPro('復元')) { this.value = ''; return; }
      readFile(this, function (t) { try { var d = JSON.parse(t); if (d && d.accounts) { saveData(d); drawLog(); syncFromLog(); $('keymsg').textContent = '復元しました。'; } } catch (e) { $('keymsg').textContent = 'このファイルは読めません。'; } });
    });
    var hk = (location.hash.match(/[#&]k=([^&]+)/) || [])[1];
    var k = hk ? decodeURIComponent(hk) : LS.getItem(K_KEY);
    if (k) { $('key').value = k; unlock(k, !hk); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  window.FXL_PAGE = { render: render, drawLog: drawLog, syncFromLog: syncFromLog, addTrade: addTrade };
})();
