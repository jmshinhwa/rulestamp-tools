(function () {
  'use strict';
  var E = window.SHIFT, SLUG = 'shift-sakusei-roukihou-jinkenhi', DOORS = [SLUG, SLUG + '.monthly'];
  var LS = { cur: 'shift.current', book: 'shift.book', key: 'shift.key' };
  var pro = false, last = null;
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var st = clone(E.DEFAULTS);
  var prefSel = $('#pref');
  prefSel.innerHTML = E.PREFS.map(function (p) { return '<option value="' + p[0] + '">' + p[0] + ' ' + p[1].toLocaleString('en-US') + '円</option>'; }).join('');

  function syncTop() { prefSel.value = st.pref; $('#start').value = st.start; $('#sales').value = st.sales; }
  function readTop() {
    st.pref = prefSel.value;
    var s = $('#start').value.trim().replace(/[/.]/g, '-').replace(/-(\d)(?=-|$)/g, '-0$1');
    if (E.validDate(s)) {
      if (st.days > 7) s = s.slice(0, 8) + '01';
      st.start = s;
    }
    st.sales = $('#sales').value;
    if (st.days > 7) st.days = E.monthDays(st.start);
  }
  function pad() { st.staff.forEach(function (s) { s.cells = (s.cells || []).slice(0, st.days); while (s.cells.length < st.days) s.cells.push(''); }); }

  function drawGrid() {
    pad();
    var dates = [], i; for (i = 0; i < st.days; i++) dates.push(E.addDays(st.start, i));
    var h = '<thead><tr><th>スタッフ</th><th>時給（円）</th><th>年齢</th>' + dates.map(function (d) { return '<th class="d' + E.dow(d) + '">' + (+d.slice(5, 7)) + '/' + (+d.slice(8)) + '<br>' + E.WD[E.dow(d)] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>';
    st.staff.forEach(function (s, si) {
      h += '<tr><td><input class="nm" data-s="' + si + ':name" value="' + E.esc(s.name) + '" aria-label="名前"></td>' +
        '<td><input class="wg" data-s="' + si + ':wage" value="' + E.esc(s.wage) + '" inputmode="decimal" aria-label="時給"></td>' +
        '<td><select data-s="' + si + ':minor" aria-label="年齢"><option value="0"' + (s.minor ? '' : ' selected') + '>18歳以上</option><option value="1"' + (s.minor ? ' selected' : '') + '>18歳未満</option></select></td>' +
        s.cells.map(function (c, di) { return '<td><input class="cell" data-c="' + si + ':' + di + '" value="' + E.esc(c) + '" aria-label="' + E.esc(s.name) + ' ' + dates[di] + '"></td>'; }).join('') +
        '<td><button type="button" class="x" data-del="' + si + '" aria-label="この行を消す">×</button></td></tr>';
    });
    $('#grid').innerHTML = h + '</tbody>';
    drawn = gridKey();
  }

  function render() {
    var R = E.analyse(st);
    $('#o-tiles').innerHTML = E.tilesHtml(R);
    $('#o-issues').innerHTML = E.issuesHtml(R);
    $('#o-mw').textContent = R.mwNote + '。出典：' + E.MW_SRC;
    $('#o-table').innerHTML = E.tableHtml(R);
    $('#o-staff').innerHTML = E.staffHtml(R);
    $('#o-summary').textContent = E.summary(R);
    [].slice.call(document.querySelectorAll('#grid input.cell')).forEach(function (el) {
      var p = el.getAttribute('data-c').split(':'), S = R.staff[+p[0]], C = S && S.cells[+p[1]];
      el.classList.toggle('flag', !!(C && C.flags.length)); el.title = C && C.flags.length ? C.flags.map(function (f) { return E.KIND[f]; }).join('・') : '';
    });
    if (pro) put(LS.cur, st);
    last = R;
    return R;
  }

  $('#grid').addEventListener('input', function (e) {
    var t = e.target, c = t.getAttribute('data-c'), s = t.getAttribute('data-s');
    if (c) { var p = c.split(':'); st.staff[+p[0]].cells[+p[1]] = t.value; }
    else if (s) { var q = s.split(':'), row = st.staff[+q[0]]; if (q[1] === 'minor') row.minor = t.value === '1'; else row[q[1]] = t.value; }
    render();
  });
  $('#grid').addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') { var q = e.target.getAttribute('data-s').split(':'); st.staff[+q[0]].minor = e.target.value === '1'; render(); } });
  $('#grid').addEventListener('click', function (e) {
    var d = e.target.getAttribute && e.target.getAttribute('data-del');
    if (d != null) { st.staff.splice(+d, 1); drawGrid(); render(); }
  });
  var drawn = '';
  function gridKey() { return st.start + '/' + st.days + '/' + st.staff.length; }
  function topChanged() { readTop(); if (gridKey() !== drawn) drawGrid(); render(); }
  [prefSel, $('#start'), $('#sales')].forEach(function (el) { el.addEventListener('input', topChanged); el.addEventListener('change', topChanged); });
  $('#add').addEventListener('click', function () { st.staff.push({ name: 'スタッフ' + (st.staff.length + 1), wage: '', minor: false, cells: [] }); drawGrid(); render(); });
  $('#reset').addEventListener('click', function () { st = clone(E.DEFAULTS); syncTop(); drawGrid(); render(); });
  $('#clear').addEventListener('click', function () { st.staff = [1, 2, 3].map(function (n) { return { name: 'スタッフ' + n, wage: '', minor: false, cells: [] }; }); st.sales = ''; syncTop(); drawGrid(); render(); });
  function toMonth() {
    if (st.days > 7) { st.start = st.start.slice(0, 8) + '01'; st.days = 7; }
    else {
      var map = {}, i, dates = []; for (i = 0; i < st.days; i++) dates.push(E.addDays(st.start, i));
      st.staff.forEach(function (s, si) { map[si] = {}; dates.forEach(function (d, di) { if (map[si][E.dow(d)] == null) map[si][E.dow(d)] = s.cells[di] || ''; }); });
      st.start = st.start.slice(0, 8) + '01'; st.days = E.monthDays(st.start);
      st.staff.forEach(function (s, si) { s.cells = []; for (i = 0; i < st.days; i++) s.cells.push(map[si][E.dow(E.addDays(st.start, i))] || ''); });
    }
    $('#month').textContent = st.days > 7 ? '1週間の表に戻す' : '1か月の表にする（同じ曜日のシフトで埋める）';
    syncTop(); drawGrid(); render();
  }
  $('#month').addEventListener('click', toMonth);
  $('#png').addEventListener('click', function () {
    var R = render(), u = png(R);
    $('#png-img').src = u; $('#png-dl').href = u; $('#png-dl').download = 'shift-' + R.dates[0] + '.png'; $('#png-wrap').hidden = false;
  });
  $('#copy').addEventListener('click', function () {
    var t = $('#o-summary').textContent, done = function () { $('#copy-msg').textContent = 'コピーしました'; };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () {});
  });

  // ---- Pro ----
  var NAMES = { save: 'シフト表の保存（店ごと・月ごと）', load: '保存したシフト表を開く', print: 'A4横の印刷（PDF保存）', csv: '給与計算に渡すCSVの書き出し', csvin: 'CSVからのシフトの読み込み', next: '翌週・翌月への複製', backup: 'JSONの控え', imp: 'JSONの控えからの復元' };
  function msg(t) { var m = $('#pro-msg'); m.hidden = false; m.textContent = t; }
  function locked(what) {
    var m = $('#pro-msg'); m.hidden = false;
    m.innerHTML = 'このボタンは「' + E.esc(NAMES[what] || ' — 保存して続ける: https://getreadystack.com/ja/apps/shift-sakusei-roukihou-jinkenhi/') + '' + SLUG + ' — 保存して続ける: https://getreadystack.com/ja/apps/shift-sakusei-roukihou-jinkenhi/';
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function download(name, body, type) {
    var b = body instanceof Blob ? body : new Blob([body], { type: type || 'text/plain;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function bookObj() { var b = get(LS.book, null); return b && b.tables ? b : { tables: {} }; }
  function drawBook() {
    var b = bookObj(), sel = $('#book-list'), names = Object.keys(b.tables).sort();
    sel.innerHTML = '<option value="">保存したシフト表（' + names.length + '）</option>' + names.map(function (n) { var a = b.tables[n]; return '<option value="' + E.esc(n) + '">' + E.esc(n) + '・' + E.esc(a.saved || '') + '</option>'; }).join('');
  }
  function printHtml(R) {
    return '<h1>' + E.esc($('#book-name').value || 'シフト表') + '（' + E.esc(R.dates[0]) + '〜' + E.esc(R.dates[R.dates.length - 1]) + '・' + E.esc(R.pref) + '）</h1>' +
      '<table class="res shift">' + E.tableHtml(R) + '</table><ul class="issues">' + E.issuesHtml(R) + '</ul><p>' + E.esc(E.summary(R)) + '</p>';
  }
  function png(R) {
    var cw = R.days > 7 ? 66 : 112, lw = 150, rh = 46, hh = 52, top = 54, foot = 70;
    var W = lw + cw * R.days + 110, H = top + hh + rh * (R.staff.length + 1) + foot;
    var cv = document.createElement('canvas'), sc = 2; cv.width = W * sc; cv.height = H * sc;
    var g = cv.getContext('2d'); g.scale(sc, sc);
    var F = '"Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif';
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1d2433'; g.font = 'bold 20px ' + F; g.textBaseline = 'middle';
    g.fillText(($('#book-name').value || 'シフト表') + '  ' + R.dates[0].slice(5).replace('-', '/') + '〜' + R.dates[R.dates.length - 1].slice(5).replace('-', '/'), 12, 28);
    function cell(x, y, w, h, fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); g.strokeStyle = '#c9cfdb'; g.strokeRect(x + 0.5, y + 0.5, w, h); }
    function text(t, x, y, size, bold, color, w) { g.fillStyle = color || '#1d2433'; g.font = (bold ? 'bold ' : '') + size + 'px ' + F; g.textAlign = 'center'; g.fillText(t, x + w / 2, y, w - 4); g.textAlign = 'left'; }
    var y = top;
    cell(0, y, lw, hh, '#eef1f6'); text('スタッフ', 0, y + hh / 2, 14, true, '#1d2433', lw);
    R.dates.forEach(function (d, i) { var dw = E.dow(d); cell(lw + i * cw, y, cw, hh, dw === 0 ? '#ffecec' : dw === 6 ? '#eaf2ff' : '#eef1f6'); text((+d.slice(8)) + '日', lw + i * cw, y + 17, 14, true, '#1d2433', cw); text(R.wd[i], lw + i * cw, y + 36, 13, false, dw === 0 ? '#cf222e' : dw === 6 ? '#1f6feb' : '#424a53', cw); });
    cell(lw + cw * R.days, y, 110, hh, '#eef1f6'); text('実働', lw + cw * R.days, y + hh / 2, 14, true, '#1d2433', 110);
    y += hh;
    R.staff.forEach(function (S) {
      cell(0, y, lw, rh, '#fff'); text(S.name, 0, y + rh / 2, 15, true, '#1d2433', lw);
      S.cells.forEach(function (C, i) {
        var x = lw + i * cw, red = false;   // the staff image never shows checks or wages
        cell(x, y, cw, rh, red ? '#ffe3e3' : C.off ? '#f6f7fb' : '#fff');
        if (C.off) return;
        var t = C.bad ? C.raw : C.label.split(' 休')[0], b = C.bad ? '' : (C.brk ? '休' + C.brk + '分' : '');
        text(t, x, y + (b ? 16 : rh / 2), R.days > 7 ? 11 : 14, true, red ? '#a40e26' : '#1d2433', cw);
        if (b) text(b, x, y + 33, R.days > 7 ? 10 : 12, false, '#57606a', cw);
      });
      cell(lw + cw * R.days, y, 110, rh, '#fff'); text(E.hdec(S.labor) + 'h', lw + cw * R.days, y + rh / 2, 14, false, '#1d2433', 110);
      y += rh;
    });
    cell(0, y, lw, rh, '#f0f5ff'); text('出勤', 0, y + rh / 2, 14, true, '#1d2433', lw);
    R.day.forEach(function (d, i) { cell(lw + i * cw, y, cw, rh, '#f0f5ff'); text(d.heads + '人', lw + i * cw, y + rh / 2, 14, false, '#1d2433', cw); });
    cell(lw + cw * R.days, y, 110, rh, '#f0f5ff'); text(E.hdec(R.T.labor) + 'h', lw + cw * R.days, y + rh / 2, 14, true, '#1d2433', 110);
    y += rh + 22;
    g.font = '13px ' + F; g.fillStyle = '#424a53';
    g.fillText('数字は始業-終業、下の段は休憩。変更があれば店長まで。', 12, y);
    return cv.toDataURL('image/png');
  }
  function shiftNext() {
    var R = last || render();
    if (st.days > 7) {
      var map = {}; R.dates.slice(0, 7).forEach(function (d, i) { st.staff.forEach(function (s, si) { (map[si] = map[si] || {})[E.dow(d)] = s.cells[i]; }); });
      var d0 = new Date(st.start + 'T00:00:00Z'); d0.setUTCMonth(d0.getUTCMonth() + 1);
      st.start = d0.toISOString().slice(0, 10); st.days = E.monthDays(st.start);
      st.staff.forEach(function (s, si) { s.cells = []; for (var i = 0; i < st.days; i++) s.cells.push((map[si] || {})[E.dow(E.addDays(st.start, i))] || ''); });
    } else {
      st.start = E.addDays(st.start, 7);
    }
    syncTop(); drawGrid(); render();
    msg(st.start + 'からの表を作りました（前の表は「保存」で残してください）。');
  }
  var ACTIONS = {
    save: function () {
      var b = bookObj(), n = ($('#book-name').value || 'シフト表').trim(), R = render();
      b.tables[n] = { st: clone(st), saved: new Date().toISOString().slice(0, 10), cost: R.T.legal };
      put(LS.book, b); drawBook(); msg('「' + n + '」を保存しました（' + R.staff.length + '人・' + R.days + '日）。');
    },
    load: function () {
      var n = $('#book-list').value, a = bookObj().tables[n]; if (!a) return;
      st = clone(a.st); $('#book-name').value = n; syncTop(); drawGrid(); render();
    },
    print: function () { var R = render(); $('#print-area').innerHTML = printHtml(R); window.print(); },
    csv: function () { var R = render(); download('shift-' + R.dates[0] + '.csv', E.csv(R), 'text/csv;charset=utf-8'); },
    csvin: function () { $('#csv-in').click(); },
    next: shiftNext,
    backup: function () { download('shift-sakusei-backup.json', JSON.stringify({ current: st, book: bookObj() }, null, 1), 'application/json'); },
    imp: function () { $('#json-in').click(); }
  };
  [].slice.call(document.querySelectorAll('[data-pro]')).forEach(function (b) {
    b.addEventListener('click', function (ev) {
      var w = b.getAttribute('data-pro');
      if (!pro) { ev.preventDefault(); locked(w); return; }
      if (b.tagName === 'LABEL') return;
      ACTIONS[w]();
    });
  });
  $('#csv-in').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f || !pro) return;
    f.text().then(function (t) { var rows = E.csvToStaff(t, st.days); if (rows.length) { st.staff = rows; drawGrid(); render(); } msg(rows.length + '人のシフトを読み込みました。'); e.target.value = ''; });
  });
  $('#json-in').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f || !pro) return;
    f.text().then(function (t) { try { var o = JSON.parse(t); if (o.book && o.book.tables) put(LS.book, o.book); if (o.current && o.current.staff) st = o.current; syncTop(); drawGrid(); render(); drawBook(); } catch (x) { msg('このファイルは読めません。'); } e.target.value = ''; });
  });

  function unlock(k, quiet) {
    k = String(k || '').trim(); if (!k) return;
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { if (!quiet) $('#key-msg').textContent = ' — 保存して続ける: https://getreadystack.com/ja/apps/shift-sakusei-roukihou-jinkenhi/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — 保存して続ける: https://getreadystack.com/ja/apps/shift-sakusei-roukihou-jinkenhi/'; }
        else next();
      }).catch(function () { if (!quiet) $('#key-msg').textContent = '今はキーを確かめられません。少しあとでもう一度。'; });
    })();
  }
  function setPro(on) {
    pro = on; document.body.classList.toggle('is-pro', on); if (on) { $('#pro-msg').hidden = true; put(LS.cur, st); }
    drawBook();
  }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  window.addEventListener('hashchange', function () { var h = /[#&]k=([^&]+)/.exec(location.hash); if (h) { $('#key').value = decodeURIComponent(h[1]); unlock(decodeURIComponent(h[1])); } });

  var saved = get(LS.cur, null), hasKey = !!get(LS.key, '');
  if (saved && saved.staff && hasKey) st = saved;
  syncTop(); drawGrid(); render(); drawBook();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { var k = decodeURIComponent(hk[1]); $('#key').value = k; unlock(k); history.replaceState(null, '', location.pathname + location.search); }
  else if (hasKey) unlock(get(LS.key, ''), true);
})();
