/* */
(function () {
  'use strict';
  var doc = document, LS = window.localStorage, M = window.MUSE;
  var SLUG = 'muse-ai-prompts', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var K_KEY = 'muse_prompts_key', K_LIB = 'muse_prompts_lib', K_NOW = 'muse_prompts_now';
  var pro = false, last = null;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }

  function read() {
    return { task: $('task').value, conn: $('conn').value, web: $('web').value, a: $('a').value, b: $('b').value, c: $('c').value,
      item: $('item').value, sign: $('sign').checked };
  }
  function write(x) {
    $('task').value = x.task; $('conn').value = x.conn; $('web').value = x.web;
    $('a').value = x.a; $('b').value = x.b; $('c').value = x.c; $('item').value = x.item; $('sign').checked = x.sign !== false;
  }

  function labels(t) {
    var T = M.TASKS[t];
    ['a', 'b', 'c'].forEach(function (k) {
      $('l-' + k).style.display = T[k] ? '' : 'none';
      if (T[k]) $('n-' + k).textContent = T[k];
    });
  }

  function draw() {
    var x = read();
    labels(x.task);
    var r = M.build(x); last = r;
    jset(K_NOW, x);
    $('r-big').textContent = r.nUnattended + ' of ' + r.nSteps;
    $('r-label').textContent = 'Steps that would run without asking you · ' + r.name;
    var loss = $('r-loss');
    if (r.nUnattended) {
      loss.className = 'r-loss';
      loss.textContent = r.nNoUndo + ' of them cannot be undone' + (r.hasMoney && r.moneyUnattended && r.loss > 0 ? ' · ' + r.lossLine : '') + '. The prompt below makes Muse ask first.';
    } else {
      loss.className = 'r-loss good';
      loss.textContent = 'Your settings make Muse ask before every step that sends, changes or pays. The prompt below still sets your limits and the privacy lines.';
    }
    $('t-steps').textContent = r.nSteps; $('t-steps-n').textContent = r.connectors.join(' · ');
    $('t-write').textContent = r.nWrite;
    $('t-un').textContent = r.nUnattended; $('t-un-n').textContent = 'Connectors: ' + M.SETTINGS[r.conn] + ' · web: ' + M.WEB_SETTINGS[r.web];
    $('t-undo').textContent = r.nNoUndo;
    $('t-loss').textContent = M.usd(r.loss);
    $('t-loss-n').textContent = r.hasMoney ? (r.moneyUnattended ? r.lossLine : 'the money step asks you first') : 'no money step in this task';
    $('t-guard').textContent = r.nGuards;

    $('steps').innerHTML = r.steps.map(function (s, i) {
      var typ = s.kind === 'read' ? 'read' : s.kind === 'buy' ? 'pay' : 'write';
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(s.text) + '</td><td>' + typ + (s.door === 'web' ? ' · web' : s.door === 'phone' ? ' · phone' : '') + '</td>' +
        '<td class="' + (s.unattended ? 'no' : 'yes') + '">' + (s.unattended ? 'no' : 'yes') + '</td><td>' + (s.undo ? 'yes' : 'no') + '</td></tr>';
    }).join('');
    $('prompt').value = r.prompt;
    $('safe').value = r.safe;
    $('check').innerHTML = r.checklist.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
    drawPro();
  }

  function copy(txt) {
    var done = function () { $('copymsg').textContent = 'Copied.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { fallback(txt); done(); });
    else { fallback(txt); done(); }
  }
  function fallback(txt) { var t = doc.createElement('textarea'); t.value = txt; doc.body.appendChild(t); t.select(); try { doc.execCommand('copy'); } catch (e) { /* ignore */ } doc.body.removeChild(t); }

  /* ---- key ---- */
  function check(key) {
    var k = 0;
    return new Promise(function (ok) {
      (function next() {
        if (k >= DOORS.length) return ok(false);
        var door = DOORS[k++];
        fetch('' + encodeURIComponent(key) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.ok) ok(true); else next(); }).catch(next);
      })();
    });
  }
  function unlock(key, quiet) {
    key = String(key || '').trim();
    if (!key) return;
    $('keymsg').textContent = 'Checking the key…';
    check(key).then(function (ok) {
      if (ok) { LS.setItem(K_KEY, key); setPro(true); $('keymsg').textContent = ' — Save and continue: https://getreadystack.com/apps/muse-ai-prompts/'; }
      else $('keymsg').textContent = quiet ? '' : 'This key does not open this product.';
    });
  }
  function setPro(v) { pro = v; doc.body.classList.toggle('is-pro', v); drawPro(); }
  function needPro(what) {
    if (pro) return false;
    $('keymsg').textContent = what + ' — Save and continue: https://getreadystack.com/apps/muse-ai-prompts/';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return true;
  }

  /* ---- Pro ---- */
  function lib() { return jget(K_LIB, []); }
  function drawPro() {
    var L = lib();
    if (!$('lib')) return;
    if (!L.length) { $('lib').innerHTML = '<tr><td colspan="6" class="hint">No saved workflows yet.</td></tr>'; $('aud').innerHTML = ''; return; }
    $('lib').innerHTML = L.map(function (w, i) {
      var r = M.build(w);
      return '<tr><td>' + esc(w.title) + '</td><td>' + esc(r.name) + '</td><td>' + r.nUnattended + ' of ' + r.nSteps + '</td><td>' + r.nNoUndo + '</td><td>' + M.usd(r.loss) + '</td>' +
        '<td><button class="ghost" data-open="' + i + '">Open</button> <button class="ghost" data-dup="' + i + '">Duplicate</button> <button class="del" data-del="' + i + '">Delete</button></td></tr>';
    }).join('');
    var A = M.audit(L);
    $('aud').innerHTML = A.rows.map(function (o) {
      return '<tr><td>' + esc(o.connector) + '</td><td>' + o.workflows + '</td><td>' + o.unattended + '</td><td>' + o.noUndo + '</td></tr>';
    }).join('') + '<tr class="sum"><td>All workflows</td><td>' + A.total.workflows + '</td><td>' + A.total.unattended + '</td><td>' + A.total.noUndo + '</td></tr>';
  }
  function save() {
    if (needPro('Saving workflows')) return;
    var x = read(), L = lib();
    x.id = 'w' + Date.now().toString(36); x.title = ($('wname').value.trim() || M.TASKS[x.task].name).slice(0, 80);
    x.a = M.num(x.a); x.b = M.num(x.b); x.c = M.num(x.c); x.saved = new Date().toISOString().slice(0, 10);
    L.push(x); jset(K_LIB, L); $('wname').value = ''; drawPro();
    $('keymsg').textContent = 'Saved: ' + x.title + ' (' + L.length + ' in your library).';
  }
  function libClick(e) {
    var t = e.target, L = lib(), i;
    if (t.hasAttribute('data-open')) { if (needPro('The library')) return; i = +t.getAttribute('data-open'); write(L[i]); draw(); $('inputs').scrollIntoView({ behavior: 'smooth' }); }
    else if (t.hasAttribute('data-dup')) { if (needPro('The library')) return; i = +t.getAttribute('data-dup'); var c = JSON.parse(JSON.stringify(L[i])); c.id = 'w' + Date.now().toString(36); c.title = (c.title + ' (copy)').slice(0, 80); L.splice(i + 1, 0, c); jset(K_LIB, L); drawPro(); }
    else if (t.hasAttribute('data-del')) { if (needPro('The library')) return; i = +t.getAttribute('data-del'); L.splice(i, 1); jset(K_LIB, L); drawPro(); }
  }
  function download(name, type, body) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: type })); a.download = name;
    doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function pack() {
    if (needPro('The prompt pack')) return;
    var L = lib(); if (!L.length) { $('keymsg').textContent = 'Save at least one workflow first.'; return; }
    var A = M.audit(L);
    var h = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>My Muse AI prompts pack</title><style>body{font:14px/1.5 system-ui,Arial,sans-serif;max-width:760px;margin:24px auto;color:#111}pre{white-space:pre-wrap;background:#f4f4f6;border:1px solid #ddd;padding:10px;border-radius:6px}h2{page-break-before:always}h2.first{page-break-before:auto}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style></head><body>';
    h += '<h1>My Muse AI prompts pack</h1><p>' + L.length + ' workflows · printed ' + esc(new Date().toISOString().slice(0, 10)) + '</p>';
    h += '<table><tr><th>Connector</th><th>Workflows</th><th>Run unasked</th><th>No undo</th></tr>' + A.rows.map(function (o) { return '<tr><td>' + esc(o.connector) + '</td><td>' + o.workflows + '</td><td>' + o.unattended + '</td><td>' + o.noUndo + '</td></tr>'; }).join('') + '</table>';
    L.forEach(function (w, i) {
      var r = M.build(w);
      h += '<h2' + (i ? '' : ' class="first"') + '>' + (i + 1) + '. ' + esc(w.title) + '</h2><p>' + esc(r.name) + ' · ' + r.nUnattended + ' of ' + r.nSteps + ' steps run without asking under the saved settings · ' + r.nNoUndo + ' cannot be undone</p>';
      h += '<h3>Prompt</h3><pre>' + esc(r.prompt) + '</pre><h3>Privacy-safe version</h3><pre>' + esc(r.safe) + '</pre><h3>Settings</h3><ol>' + r.checklist.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ol>';
    });
    h += '<script>window.onload=function(){window.print()}<\/script></body></html>';
    var wnd = window.open('', '_blank');
    if (wnd) { wnd.document.write(h); wnd.document.close(); } else download('muse-ai-prompts-pack.html', 'text/html', h);
  }
  function exp() {
    if (needPro('JSON export')) return;
    download('muse-ai-prompts-library.json', 'application/json', M.exportJSON(lib()));
  }
  function imp(e) {
    if (needPro('JSON import')) { e.target.value = ''; return; }
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try { var add = M.importJSON(String(rd.result)); var L = lib().concat(add); jset(K_LIB, L); drawPro(); $('keymsg').textContent = 'Imported ' + add.length + ' workflows.'; }
      catch (err) { $('keymsg').textContent = 'Import failed: ' + err.message; }
      e.target.value = '';
    };
    rd.readAsText(f);
  }
  function ics() {
    if (needPro('The weekly review')) return;
    var L = lib(), n = Math.max(1, Math.min(52, Math.round(M.num($('rweeks').value) || 12)));
    var body = M.ics($('rdate').value, n, L.map(function (w) { return w.title; }), new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z');
    if (!body) { $('keymsg').textContent = 'Pick the date of the first review.'; return; }
    download('muse-permission-review.ics', 'text/calendar', body);
    $('keymsg').textContent = n + ' weekly reviews in the file.';
  }

  /* ---- wire ---- */
  ['task'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      var e = M.TASKS[$('task').value].ex; $('a').value = e.a; $('b').value = e.b; $('c').value = e.c; $('item').value = e.item; draw();
    });
  });
  ['conn', 'web', 'a', 'b', 'c', 'item', 'sign'].forEach(function (id) { $(id).addEventListener('input', draw); $(id).addEventListener('change', draw); });
  $('copy').addEventListener('click', function () { copy($('prompt').value); });
  $('copysafe').addEventListener('click', function () { copy($('safe').value); });
  $('unlock').addEventListener('click', function () { unlock($('key').value); });
  $('save').addEventListener('click', save);
  $('lib').addEventListener('click', libClick);
  $('pack').addEventListener('click', pack);
  $('exp').addEventListener('click', exp);
  $('imp').addEventListener('change', imp);
  $('ics').addEventListener('click', ics);

  var now = jget(K_NOW, null);
  if (now && M.TASKS[now.task]) write(now);
  draw();
  var hk = /[#&]k=([^&]+)/.exec(location.hash || '');
  if (hk) { var k = decodeURIComponent(hk[1]); $('key').value = k; unlock(k); }
  else if (LS.getItem(K_KEY)) unlock(LS.getItem(K_KEY), true);
})();
