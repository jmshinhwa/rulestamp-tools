/* Trading Journal (de) — Oberfläche. Rechnen in tj.js. */
(function () {
  'use strict';
  var doc = document, TJ = window.TJ, S = window.TJ_SAMPLES || {}, LS = window.localStorage;
  var SLUG = 'trading-journal-erwartungswert-setup', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var K_KEY = 'tj_de_key', K_DATA = 'tj_de_data', K_SP = 'tj_de_spreads';
  var pro = false, view = { trades: [], skipped: 0, src: '' }, spreads = {};
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cur() { return $('cur').value; }
  function m(x) { return TJ.money(x, cur()); }
  function sm(x) { return TJ.signed(x, cur()); }
  function cls(x) { return x < 0 ? 'neg' : 'pos'; }
  function opt() {
    return { mode: $('mode').value, slip: TJ.num($('slip').value) || 0, risk: TJ.num($('risk').value) || 0,
      minN: Math.max(0, Math.round(TJ.num($('minN').value) || 0)), cur: cur(), spreads: spreads };
  }

  /* ---- Spread-Felder je Symbol ---- */
  function drawSpreads() {
    var syms = {}; view.trades.forEach(function (t) { syms[t.symbol] = 1; });
    var h = '';
    Object.keys(syms).sort().forEach(function (y) {
      var v = spreads[y] === undefined || spreads[y] === '' ? '' : String(spreads[y]).replace('.', ',');
      h += '<label>' + esc(y) + '<input data-sym="' + esc(y) + '" data-yj-mine inputmode="decimal" value="' + esc(v) + '" placeholder="0,00"></label>';
    });
    $('spreads').innerHTML = h || '<p class="hint">Nach dem Einfügen erscheint hier ein Feld je Symbol.</p>';
  }
  function load(text, src) {
    var p = TJ.parseAny(text);
    view = { trades: p.trades, skipped: p.skipped, src: src || p.platform };
    drawSpreads(); draw();
  }
  function fromPaste() { load($('paste').value, ''); }
  function sample(k) {
    var s = S[k]; if (!s) return;
    $('paste').value = s.text; spreads = JSON.parse(JSON.stringify(s.spreads)); $('risk').value = String(s.risk);
    load(s.text, s.label);
  }

  /* ---- Ergebnis ---- */
  function verdict(s) { return '<span class="verdict ' + s.code + '">' + s.verdict + '</span>'; }
  function costbar(r) {
    var parts = [[r.spread, 'c1', 'Spread'], [-r.commission, 'c2', 'Kommission'], [-r.swap, 'c3', 'Swap'], [r.slip, 'c4', 'Zusatz-Slippage']].filter(function (p) { return p[0] > 0.004; });
    var tot = parts.reduce(function (a, p) { return a + p[0]; }, 0); if (!tot) return '';
    return '<div class="costbar">' + parts.map(function (p) { return '<i class="' + p[1] + '" style="width:' + (p[0] / tot * 100).toFixed(1) + '%"></i>'; }).join('') + '</div>' +
      '<p class="legend">' + parts.map(function (p) { return '<span><i class="' + p[1] + '"></i>' + p[2] + ' ' + m(p[0]) + '</span>'; }).join('') + '</p>';
  }
  function draw() {
    var o = opt(), out = $('out');
    if (!view.trades.length) { out.innerHTML = '<p class="big">Noch keine Trades erkannt.</p><p class="hint">Füge unten deine Historie ein oder lade ein Beispiel.' + (view.skipped ? ' ' + view.skipped + ' Zeilen übersprungen.' : '') + '</p>'; return; }
    var r = TJ.compute(view.trades, o), h = '';
    var lead = r.eaten[0];
    if (lead) h += '<p class="big">„' + esc(lead.name) + '“: vor Kosten <b class="pos">' + sm(lead.expGross) + '</b> je Trade, nach Kosten <b class="neg">' + sm(lead.expNet) + '</b> je Trade</p><p>' + lead.n + ' Trades, ' + m(lead.cost) + ' Kosten: aus ' + sm(lead.gross) + ' Vorteil werden ' + sm(lead.net) + '.</p>';
    else if (r.setups.length) { var b = r.setups[0]; h += '<p class="big">Bestes Setup „' + esc(b.name) + '“: <b class="' + cls(b.expNet) + '">' + sm(b.expNet) + '</b> je Trade nach Kosten (vorher ' + sm(b.expGross) + ')</p>'; }
    h += '<div class="kpis">' +
      '<div class="kpi ' + cls(r.net) + '"><b>' + sm(r.net) + '</b><span>netto, ' + r.n + ' Trades (brutto ' + sm(r.gross) + ')</span></div>' +
      '<div class="kpi neg"><b>' + m(r.cost) + '</b><span>Kosten' + (r.costShare !== null ? ' = ' + TJ.pct(r.costShare) + ' des Brutto-Vorteils' : '') + '</span></div>' +
      '<div class="kpi"><b>' + r.carry.length + ' von ' + r.setups.length + '</b><span>Setups tragen nach Kosten</span></div></div>';
    h += '<div class="tbl"><table><thead><tr><th>Setup</th><th>Trades</th><th>Netto je Trade</th><th>Brutto je Trade</th><th>Kosten je Trade</th><th>Urteil</th><th>Treffer</th><th>Break-even-Treffer</th><th>in R</th><th>Puffer je Lot</th></tr></thead><tbody>';
    r.setups.forEach(function (s) {
      h += '<tr><td>' + esc(s.name) + (s.thin ? '<br><span class="thin">erst ' + s.n + ' von ' + o.minN + ' Trades</span>' : '') + '</td><td>' + s.n + '</td><td class="' + cls(s.expNet) + '"><b>' + sm(s.expNet) + '</b></td><td class="' + cls(s.expGross) + '">' + sm(s.expGross) + '</td><td>' + m(s.expCost) +
        '</td><td>' + verdict(s) + '</td><td>' + TJ.pct(s.winRate) + '</td><td>' + (s.beWin === null ? '–' : TJ.pct(s.beWin)) + '</td><td>' + TJ.dec(s.expR) + '</td><td>' + (s.buffer ? m(s.buffer) : '–') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += costbar(r);
    if (r.missingSpread.length) h += '<p class="hint">Ohne Spread-Angabe (zählt 0): ' + r.missingSpread.map(esc).join(', ') + '.</p>';
    if (view.skipped) h += '<p class="hint">' + view.skipped + ' Zeilen übersprungen (Ein-/Auszahlung, Summen, offene Orders).</p>';
    out.innerHTML = h;
    if (pro) drawMonths(r);
  }

  /* ---- Pro: Schlüssel ---- */
  function check(key) {
    var i = 0;
    return new Promise(function (ok) {
      (function next() {
        if (i >= DOORS.length) return ok(false);
        var door = DOORS[i++];
        fetch('' + encodeURIComponent(key) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.ok) ok(true); else next(); }).catch(next);
      })();
    });
  }
  function unlock(key, quiet) {
    if (!key) return;
    $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/trading-journal-erwartungswert-setup/';
    check(key).then(function (ok) {
      if (ok) { pro = true; LS.setItem(K_KEY, key); doc.body.classList.add('is-pro'); $('keymsg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/trading-journal-erwartungswert-setup/'; drawAccts(); draw(); }
      else $('keymsg').textContent = quiet ? '' : ' — Speichern und weitermachen: https://getreadystack.com/de/apps/trading-journal-erwartungswert-setup/';
    });
  }
  function needPro(what) {
    if (pro) return false;
    $('keymsg').textContent = what + '';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return true;
  }

  /* ---- Pro: Konten ---- */
  function data() { try { return JSON.parse(LS.getItem(K_DATA)) || { accounts: {} }; } catch (e) { return { accounts: {} }; } }
  function store(d) { LS.setItem(K_DATA, JSON.stringify(d)); }
  function acctName() { return ($('acct').value || '').trim() || 'Mein Konto'; }
  function saveInto(name, add) {
    var d = data(), a = d.accounts[name] = d.accounts[name] || { trades: [] };
    var mg = TJ.merge(a.trades, add);
    a.trades = mg.trades; a.opt = opt(); a.updated = new Date().toISOString().slice(0, 10);
    store(d); drawAccts();
    return mg;
  }
  function drawAccts() {
    var d = data(), names = Object.keys(d.accounts), h = '';
    if (!names.length) { $('accts').innerHTML = '<p class="hint">Noch kein Konto gespeichert.</p>'; return; }
    h += '<div class="tbl"><table><caption>Gespeicherte Konten</caption><thead><tr><th>Konto</th><th>Trades</th><th>Netto</th><th>Stand</th><th></th></tr></thead><tbody>';
    names.forEach(function (n) {
      var a = d.accounts[n], r = TJ.compute(a.trades, a.opt || opt());
      h += '<tr><td>' + esc(n) + '</td><td>' + r.n + '</td><td class="' + cls(r.net) + '">' + sm(r.net) + '</td><td>' + esc(a.updated || '') + '</td><td><button class="btn ghost sm" data-open="' + esc(n) + '">Öffnen</button> <button class="btn ghost sm" data-del="' + esc(n) + '">Löschen</button></td></tr>';
    });
    $('accts').innerHTML = h + '</tbody></table></div>';
  }
  /* Pro: Setup nachtragen (MT4/MT5-Dateien haben keine Setup-Spalte) */
  function drawTag() {
    var n = ($('acct').value || '').trim(), d = data(), a = n && d.accounts[n];
    if (!a) { $('tag').innerHTML = ''; return; }
    var known = {}; a.trades.forEach(function (t) { if (t.setup) known[t.setup] = 1; });
    var open = a.trades.map(function (t, i) { return [t, i]; }).filter(function (x) { return !x[0].setup; }).slice(-60).reverse();
    if (!open.length) { $('tag').innerHTML = '<p class="hint">Alle ' + a.trades.length + ' Trades in „' + esc(n) + '“ haben ein Setup.</p>'; return; }
    var h = '<datalist id="setuplist">' + Object.keys(known).map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist>';
    h += '<div class="tbl"><table><caption>Setup nachtragen: ' + a.trades.filter(function (t) { return !t.setup; }).length + ' Trades ohne Setup (neueste zuerst)</caption><thead><tr><th>Schließung</th><th>Symbol</th><th>Lots</th><th>Ergebnis</th><th>Setup</th></tr></thead><tbody>';
    open.forEach(function (x) { var t = x[0]; h += '<tr><td>' + esc(t.close) + '</td><td>' + esc(t.symbol) + '</td><td>' + TJ.dec(t.lots) + '</td><td class="' + cls(t.profit) + '">' + sm(t.profit) + '</td><td><input data-ti="' + x[1] + '" list="setuplist" placeholder="z. B. Pinbar am Level"></td></tr>'; });
    $('tag').innerHTML = h + '</tbody></table></div>';
  }
  function drawMonths(r) {
    var names = {}, months = {};
    r.months.forEach(function (x) { names[x.name] = 1; months[x.month] = 1; });
    var ms = Object.keys(months).sort(), ns = Object.keys(names).sort(), idx = {};
    r.months.forEach(function (x) { idx[x.name + '|' + x.month] = x; });
    var h = '<div class="tbl"><table><caption>Netto-Erwartung je Trade, Monat für Monat</caption><thead><tr><th>Setup</th>' + ms.map(function (x) { return '<th>' + x.slice(5, 7) + '/' + x.slice(0, 4) + '</th>'; }).join('') + '</tr></thead><tbody>';
    ns.forEach(function (n) {
      h += '<tr><td>' + esc(n) + '</td>' + ms.map(function (x) { var c = idx[n + '|' + x]; return c ? '<td class="' + cls(c.expNet) + '">' + sm(c.expNet) + ' <small>(' + c.n + ')</small></td>' : '<td>–</td>'; }).join('') + '</tr>';
    });
    $('months').innerHTML = h + '</tbody></table></div>';
  }

  function download(name, bytes, type) {
    var b = new Blob([bytes], { type: type }), a = doc.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }
  function fileBase() { return 'trading-journal-' + acctName().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + stamp(); }
  function readFile(f, cb) { var rd = new FileReader(); rd.onload = function () { cb(rd.result); }; rd.readAsArrayBuffer(f); }
  function saveSpreads() { try { LS.setItem(K_SP, JSON.stringify(spreads)); } catch (e) { } }

  function wire() {
    $('run').addEventListener('click', function () { $('beispiel').value = 'eigene'; fromPaste(); });
    $('clear').addEventListener('click', function () { $('paste').value = ''; $('beispiel').value = 'eigene'; view = { trades: [], skipped: 0, src: '' }; drawSpreads(); draw(); });
    $('beispiel').addEventListener('change', function () { if (S[$('beispiel').value]) sample($('beispiel').value); });
    ['mode', 'slip', 'risk', 'minN', 'cur'].forEach(function (id) { $(id).addEventListener('change', draw); $(id).addEventListener('input', draw); });
    $('paste').addEventListener('change', function () { $('beispiel').value = 'eigene'; fromPaste(); });
    $('spreads').addEventListener('input', function (e) {
      var y = e.target.getAttribute('data-sym'); if (!y) return;
      spreads[y] = e.target.value === '' ? '' : TJ.num(e.target.value); saveSpreads(); draw();
    });
    $('unlock').addEventListener('click', function () { unlock(($('key').value || '').trim()); });
    $('file').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return; e.target.value = '';
      if (needPro('Datei laden')) return;
      readFile(f, function (buf) {
        var p = TJ.parseAny(TJ.decode(buf));
        if (!p.trades.length) { $('keymsg').textContent = 'In ' + f.name + ' keine geschlossenen Trades gefunden.'; return; }
        var mg = saveInto(acctName(), p.trades), all = data().accounts[acctName()].trades;
        view = { trades: all, skipped: p.skipped, src: acctName() }; $('beispiel').value = 'eigene';
        $('keymsg').textContent = f.name + ' (' + p.platform + '): ' + mg.added + ' neue Trades, ' + mg.dup + ' schon im Journal. Konto „' + acctName() + '“ hat jetzt ' + all.length + '.';
        drawSpreads(); draw(); drawTag();
      });
    });
    $('save').addEventListener('click', function () {
      if (needPro('Speichern im Journal')) return;
      var mg = saveInto(acctName(), view.trades);
      $('keymsg').textContent = mg.added + ' neue Trades gespeichert, ' + mg.dup + ' waren schon da.'; drawTag();
    });
    $('tag').addEventListener('change', function (e) {
      var i = e.target.getAttribute('data-ti'), v = (e.target.value || '').trim(); if (i === null || !v) return;
      var n = acctName(), d = data(), a = d.accounts[n]; if (!a || !a.trades[+i]) return;
      a.trades[+i].setup = v; store(d); view = { trades: a.trades, skipped: 0, src: n }; draw(); drawTag();
    });
    $('accts').addEventListener('click', function (e) {
      var o = e.target.getAttribute('data-open'), d = e.target.getAttribute('data-del');
      if (o) { $('acct').value = o; view = { trades: data().accounts[o].trades, skipped: 0, src: o }; $('beispiel').value = 'eigene'; drawSpreads(); draw(); drawTag(); }
      if (d && window.confirm('Konto „' + d + '“ löschen?')) { var x = data(); delete x.accounts[d]; store(x); drawAccts(); }
    });
    $('csv').addEventListener('click', function () {
      if (needPro('CSV') || !view.trades.length) return;
      download(fileBase() + '.csv', TJ.csv(TJ.compute(view.trades, opt())), 'text/csv;charset=utf-8');
    });
    $('print').addEventListener('click', function () { if (needPro('Der Bericht')) return; window.print(); });
    $('ics').addEventListener('click', function () {
      if (needPro('Die Erinnerung')) return;
      var d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
      download('trading-journal-wochenrueckblick.ics', TJ.ics(d.toISOString().slice(0, 10), 18), 'text/calendar');
    });
    $('backup').addEventListener('click', function () {
      if (needPro('Die Sicherung')) return;
      download('trading-journal-sicherung-' + stamp() + '.json', JSON.stringify({ data: data(), spreads: spreads }), 'application/json');
    });
    $('restore').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return; e.target.value = '';
      if (needPro('Wiederherstellen')) return;
      readFile(f, function (buf) {
        try { var j = JSON.parse(TJ.decode(buf)); if (j.data && j.data.accounts) { store(j.data); if (j.spreads) { spreads = j.spreads; saveSpreads(); } drawAccts(); $('keymsg').textContent = 'Sicherung geladen: ' + Object.keys(j.data.accounts).length + ' Konten.'; } }
        catch (er) { $('keymsg').textContent = 'Diese Datei ist keine Sicherung des Trading Journals.'; }
      });
    });
  }

  function start() {
    wire();
    var hash = (location.hash.match(/k=([^&]+)/) || [])[1], k = hash ? decodeURIComponent(hash) : LS.getItem(K_KEY);
    sample('A');
    if (k) unlock(k, !hash);
    if (hash) history.replaceState(null, '', location.pathname);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
