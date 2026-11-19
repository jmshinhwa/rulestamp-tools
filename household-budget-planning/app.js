
(function () {
  'use strict';
  var HB = self.HB, I = self.HB_I18N, $ = function (id) { return document.getElementById(id); };
  var KH = 'hbp:hh', KL = 'hbp:ui', lang = 'ja', tier = 'free';
  function nowYm() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  var curYm = nowYm();
  var hh = load() || HB.newHousehold();
  var ym = (hh._ym && tier !== 'free') ? hh._ym : curYm;

  // ── i18n: ja = the page's own text
  document.querySelectorAll('[data-i]').forEach(function (e) { if (!(e.dataset.i in I.ja)) I.ja[e.dataset.i] = e.textContent; });
  document.querySelectorAll('[data-ph]').forEach(function (e) { I.ja[e.dataset.ph] = e.getAttribute('placeholder'); });
  function T(k, v) {
    var s = (I[lang] && I[lang][k]) || (lang !== 'ja' && I.en[k]) || I.ja[k] || k;
    if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); });
    return s;
  }
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i]').forEach(function (e) { e.textContent = T(e.dataset.i); });
    document.querySelectorAll('[data-ph]').forEach(function (e) { e.setAttribute('placeholder', T(e.dataset.ph)); });
    selects(); render();
  }

  function load() { try { var j = JSON.parse(localStorage.getItem(KH) || 'null'); return j && j.months ? j : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KH, JSON.stringify(hh)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nm(w) { return w === 'a' ? hh.names.a : w === 'b' ? hh.names.b : T('shared'); }
  function opts(sel, list, val) { sel.innerHTML = list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
  function whoList() { return [['s', T('shared')], ['a', hh.names.a], ['b', hh.names.b]]; }
  function paidList() { return [['a', hh.names.a], ['b', hh.names.b]]; }
  function catList(withAuto) { var l = hh.cats.map(function (c) { return [c.name, c.name]; }); return withAuto ? [['', T('auto')]].concat(l) : l; }
  function selects() {
    opts($('lWho'), whoList(), $('lWho').value || 's'); opts($('lPaid'), paidList(), $('lPaid').value || 'a'); opts($('lCat'), catList(true), $('lCat').value || '');
    opts($('csvWho'), whoList(), $('csvWho').value || 's'); opts($('csvPaid'), paidList(), $('csvPaid').value || 'a');
  }
  function paywall(where, key) {
    var box = where.querySelector('.paywall');
    if (!box) { box = document.createElement('p'); box.className = 'paywall'; where.appendChild(box); }
    box.innerHTML = esc(T(key)) + '' + esc(T('buyM')) + ' <b class="pM">' + esc(($('buyTop').querySelector('.pM') || {}).textContent || '') + '</b></a>';
  }
  function isPro() { return tier === 'monthly' || tier === 'yearly'; }

  // ── render
  function render() {
    var m = HB.month(hh, ym), S = HB.summarize(hh, ym);
    $('nameA').value = hh.names.a; $('nameB').value = hh.names.b;
    $('incA').value = HB.num(m.income.a) || ''; $('incB').value = HB.num(m.income.b) || '';
    $('ratioA').value = hh.ratio.a; $('ratioText').textContent = T('ratioText', { a: hh.names.a, b: hh.names.b, pa: hh.ratio.a, pb: hh.ratio.b });
    $('ym').value = ym;
    // lines
    $('lineTable').querySelector('tbody').innerHTML = m.lines.map(function (l, i) {
      return '<tr><td>' + esc(l.date) + '</td><td>' + esc(l.shop) + '</td><td class="n">' + HB.yen(l.amount) + '</td><td><select data-l="' + i + '" data-k="cat">' +
        catList(false).concat(hh.cats.some(function (c) { return c.name === l.cat; }) ? [] : [[l.cat, l.cat]]).map(function (o) { return '<option' + (o[0] === l.cat ? ' selected' : '') + '>' + esc(o[0]) + '</option>'; }).join('') +
        '</select></td><td><select data-l="' + i + '" data-k="who">' + whoList().map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === l.who ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') +
        '</select></td><td><select data-l="' + i + '" data-k="paid">' + paidList().map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === l.paid ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') +
        '</select></td><td><button type="button" class="ghost sm" data-del="' + i + '" aria-label="' + esc(T('del')) + '">×</button></td></tr>';
    }).join('');
    // budget
    $('budTable').querySelector('tbody').innerHTML = hh.cats.map(function (c, i) {
      return '<tr><td><input data-c="' + i + '" data-k="name" value="' + esc(c.name) + '"></td><td><input data-c="' + i + '" data-k="budget" type="number" min="0" step="1" value="' + (HB.num(c.budget) || '') + '"></td><td><button type="button" class="ghost sm" data-cdel="' + i + '">×</button></td></tr>';
    }).join('');
    // specials
    $('spTable').querySelector('tbody').innerHTML = (hh.specials || []).map(function (s, i) {
      var due = Number(ym.slice(5)) === s.month;
      return '<tr' + (due ? ' class="due"' : '') + '><td><input data-s="' + i + '" data-k="name" value="' + esc(s.name) + '"></td><td><input data-s="' + i + '" data-k="amount" type="number" min="0" step="1" value="' + (HB.num(s.amount) || '') + '"></td><td><select data-s="' + i + '" data-k="month">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) { return '<option value="' + n + '"' + (n === s.month ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
        '</select></td><td class="n">' + HB.yen(Math.ceil((HB.num(s.amount) || 0) / 12)) + '</td><td><button type="button" class="ghost sm" data-sdel="' + i + '">×</button></td></tr>';
    }).join('');
    $('spSum').textContent = S.specials.total ? T('spSum', { t: HB.yen(S.specials.total), m: HB.yen(S.specials.monthly) }) : '';
    // result
    var has = m.lines.length > 0 || S.income > 0;
    $('resultEmpty').hidden = has; $('resultBody').hidden = !has;
    if (has) {
      $('settleLine').textContent = S.settle.amount ? T('settle', { from: nm(S.settle.from), to: nm(S.settle.to), amt: HB.yen(S.settle.amount) }) : T('settleNone');
      $('kpis').innerHTML = [['kInc', HB.yen(S.income)], ['kSpend', HB.yen(S.total)], ['kBud', HB.yen(S.budgetTotal)], ['kSp', HB.yen(S.specials.monthly)], ['kLeft', HB.yen(S.left)], ['kRate', S.saveRate == null ? '—' : S.saveRate + '%']]
        .map(function (k) { return '<div class="kpi" data-k="' + k[0] + '"><span>' + esc(T(k[0])) + '</span><b>' + esc(k[1]) + '</b></div>'; }).join('');
      var al = S.over.map(function (o) { return '<li class="red">' + esc(T('over', { cat: o.name, amt: HB.yen(o.by) })) + '</li>'; });
      S.specials.dueNow.forEach(function (d) { al.push('<li class="red">' + esc(T('dueNow', { name: d.name, amt: HB.yen(d.amount) })) + '</li>'); });
      S.specials.dueNext.forEach(function (d) { al.push('<li>' + esc(T('dueNext', { name: d.name, amt: HB.yen(d.amount), m: HB.yen(Math.ceil(d.amount / 12)) })) + '</li>'); });
      if (!S.over.length) al.unshift('<li>' + esc(T('allOk')) + '</li>');
      $('alerts').innerHTML = al.join('');
      $('catTable').querySelector('tbody').innerHTML = S.cats.filter(function (c) { return c.budget || c.actual; }).map(function (c) {
        return '<tr' + (c.over ? ' class="over"' : '') + '><td>' + esc(c.name) + '</td><td class="n">' + HB.yen(c.budget) + '</td><td class="n">' + HB.yen(c.actual) + '</td><td class="n d">' + HB.yen(c.diff) + '</td></tr>';
      }).join('') + '<tr><td><b>計</b></td><td class="n"><b>' + HB.yen(S.budgetTotal) + '</b></td><td class="n"><b>' + HB.yen(S.total) + '</b></td><td class="n d"><b>' + HB.yen(S.budgetTotal - S.total) + '</b></td></tr>';
      $('calcText').textContent = T('calc', { sh: HB.yen(S.shared), pa: S.ratioA, a: hh.names.a, b: hh.names.b, sa: HB.yen(S.shareA), sb: HB.yen(S.shareB), oa: HB.yen(S.owe.a - S.shareA), wa: HB.yen(S.owe.a), pda: HB.yen(S.paid.a), net: HB.yen(S.paid.a - S.owe.a) });
    }
    // pro area
    $('proState').textContent = isPro() ? T('pro', { tier: T(tier === 'yearly' ? 'tierY' : 'tierM') }) : T('free');
    $('keyDel').hidden = !isPro();
    var Y = HB.year(hh, ym.slice(0, 4));
    $('yearTable').querySelector('tbody').innerHTML = Y.rows.map(function (r) {
      var lock = !isPro() && r.ym !== ym;
      return '<tr' + (r.due.length ? ' class="due"' : '') + '><td>' + r.ym + '</td><td class="n">' + (lock ? '—' : HB.yen(r.income)) + '</td><td class="n">' + (lock ? '—' : HB.yen(r.total)) + '</td><td class="n">' + (lock ? '—' : HB.yen(r.specialsMonthly)) + '</td><td class="n">' + (lock ? '—' : HB.yen(r.left)) + '</td><td>' + (lock || !r.has || !r.settle.amount ? '' : esc(nm(r.settle.from) + '→' + nm(r.settle.to) + ' ' + HB.yen(r.settle.amount))) + '</td></tr>';
    }).join('');
    hh._ym = ym; save();
  }

  // ── events
  $('uiLang').addEventListener('change', function () { lang = this.value; try { localStorage.setItem(KL, lang); } catch (e) {} applyLang(); });
  $('sampleBtn').addEventListener('click', function () {
    var S = self.HB_SAMPLE; hh = HB.newHousehold(); ym = isPro() ? ym : curYm;
    hh.names = { a: S.names.a, b: S.names.b }; hh.ratio = { a: S.ratio.a, b: S.ratio.b };
    hh.cats.forEach(function (c) { c.budget = S.budgets[c.name] || 0; });
    hh.specials = S.specials.map(function (s) { return { name: s.name, amount: s.amount, month: s.month }; });
    var m = HB.month(hh, ym); m.income = { a: S.income.a, b: S.income.b };
    S.lines.forEach(function (l) { var d = ym + '-' + ('0' + l[0]).slice(-2); m.lines.push({ date: d, shop: l[1], amount: l[2], cat: HB.categorize(hh, l[1]), who: l[3], paid: l[4] }); });
    selects(); render(); $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('nameA').addEventListener('change', function () { hh.names.a = this.value.trim() || '夫'; selects(); render(); });
  $('nameB').addEventListener('change', function () { hh.names.b = this.value.trim() || '妻'; selects(); render(); });
  $('incA').addEventListener('change', function () { HB.month(hh, ym).income.a = HB.num(this.value) || 0; render(); });
  $('incB').addEventListener('change', function () { HB.month(hh, ym).income.b = HB.num(this.value) || 0; render(); });
  $('ratioA').addEventListener('change', function () { var a = Math.max(0, Math.min(100, Math.round(HB.num(this.value) || 0))); hh.ratio = { a: a, b: 100 - a }; render(); });
  $('ratioInc').addEventListener('click', function () { var r = HB.ratioByIncome(hh, ym); if (r) { hh.ratio = r; render(); } });
  $('ym').addEventListener('change', function () {
    var v = this.value; if (!/^\d{4}-\d{2}$/.test(v)) return;
    if (!isPro() && v !== curYm) { this.value = ym; paywall($('setup'), 'payMonth'); return; }
    HB.carryOver(hh, ym, v); ym = v; render();
  });
  $('lDate').value = new Date().toISOString().slice(0, 10);
  $('lineForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = $('lDate').value, amt = HB.num($('lAmt').value), shop = $('lShop').value.trim();
    if (!d || !isFinite(amt) || !shop) return;
    var lym = d.slice(0, 7);
    if (lym !== ym) { if (!isPro()) { d = ym + d.slice(7); } else { ym = lym; } }
    HB.month(hh, ym).lines.push({ date: d, shop: shop, amount: amt, cat: $('lCat').value || HB.categorize(hh, shop), who: $('lWho').value, paid: $('lPaid').value });
    $('lShop').value = ''; $('lAmt').value = ''; $('lShop').focus(); render();
  });
  $('lineTable').addEventListener('change', function (e) {
    var t = e.target, i = t.dataset.l; if (i == null) return;
    var l = HB.month(hh, ym).lines[+i]; l[t.dataset.k] = t.value;
    if (t.dataset.k === 'cat' && isPro() && l.shop) HB.addShopRule(hh, l.shop, t.value);   // Pro: this shop is always this category (next CSV import)
    render();
  });
  $('lineTable').addEventListener('click', function (e) { var i = e.target.dataset.del; if (i != null) { HB.month(hh, ym).lines.splice(+i, 1); render(); } });
  $('budTable').addEventListener('change', function (e) {
    var t = e.target, i = t.dataset.c; if (i == null) return; var c = hh.cats[+i];
    if (t.dataset.k === 'name') { var old = c.name, nw = t.value.trim(); if (!nw) return; c.name = nw; Object.keys(hh.months).forEach(function (k) { hh.months[k].lines.forEach(function (l) { if (l.cat === old) l.cat = nw; }); }); hh.rules.shop.forEach(function (r) { if (r[1] === old) r[1] = nw; }); }
    else c.budget = HB.num(t.value) || 0;
    selects(); render();
  });
  $('budTable').addEventListener('click', function (e) { var i = e.target.dataset.cdel; if (i != null) { hh.cats.splice(+i, 1); selects(); render(); } });
  $('catAdd').addEventListener('click', function () { var n = 1, base = lang === 'ja' ? '新しい分類' : 'New category'; while (hh.cats.some(function (c) { return c.name === base + n; })) n++; hh.cats.push({ name: base + n, budget: 0 }); selects(); render(); });
  $('spTable').addEventListener('change', function (e) { var t = e.target, i = t.dataset.s; if (i == null) return; var s = hh.specials[+i]; s[t.dataset.k] = t.dataset.k === 'name' ? t.value : (HB.num(t.value) || 0); render(); });
  $('spTable').addEventListener('click', function (e) { var i = e.target.dataset.sdel; if (i != null) { hh.specials.splice(+i, 1); render(); } });
  $('spAdd').addEventListener('click', function () { hh.specials.push({ name: lang === 'ja' ? '特別費' : 'Yearly cost', amount: 0, month: Number(ym.slice(5)) }); render(); });

  // ── Pro
  $('csvFile').addEventListener('change', function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    if (!isPro()) { paywall($('csvMsg').parentNode, 'payCsv'); return; }
    f.arrayBuffer().then(function (buf) {
      var p = HB.parseCSV(new Uint8Array(buf));
      if (!p.lines.length) { $('csvMsg').textContent = T('csvNone'); return; }
      var r = HB.importLines(hh, p.lines, { card: $('csvCard').value.trim() || f.name, paid: $('csvPaid').value, who: $('csvWho').value });
      var ms = Object.keys(r.months).sort(); if (ms.length) ym = ms[ms.length - 1];
      $('csvMsg').textContent = T('csvDone', { n: r.added, s: p.skipped, months: ms.join(', ') }); render();
    });
  });
  $('csvCard').addEventListener('change', function () { var v = this.value.trim(), c = hh.rules.card.filter(function (x) { return x[0] === v; })[0]; if (c) { $('csvPaid').value = c[1]; $('csvWho').value = c[2]; } });
  function dl(name, data, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  $('xlsxBtn').addEventListener('click', function () { if (!isPro()) return paywall(this.parentNode.parentNode, 'payXlsx'); dl('家計簿_' + ym + '.xlsx', HB.xlsx(hh, ym), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); });
  $('icsBtn').addEventListener('click', function () { if (!isPro()) return paywall(this.parentNode.parentNode, 'payXlsx'); dl('特別費_通知.ics', HB.ics(hh, ym, T('rSp')), 'text/calendar'); });
  $('printBtn').addEventListener('click', function () {
    if (!isPro()) return paywall(this.parentNode.parentNode, 'payXlsx');
    buildPrint(); document.body.classList.add('printing'); window.print(); setTimeout(function () { document.body.classList.remove('printing'); }, 500);
  });
  function buildPrint() {
    var S = HB.summarize(hh, ym), m = HB.month(hh, ym);
    var t = function (rows) { return '<table>' + rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return (i ? '<td class="n">' : '<td>') + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>'; };
    $('printRoot').innerHTML = '<h1>' + esc(T('rTitle', { ym: ym })) + '</h1><p><b>' + esc($('settleLine').textContent) + '</b></p>' +
      t([[T('thCat'), T('thBud'), T('thAct'), T('thDiff')]].concat(S.cats.filter(function (c) { return c.budget || c.actual; }).map(function (c) { return [c.name, HB.yen(c.budget), HB.yen(c.actual), HB.yen(c.diff)]; })).concat([['計', HB.yen(S.budgetTotal), HB.yen(S.total), HB.yen(S.budgetTotal - S.total)]])) +
      t([[T('kInc'), HB.yen(S.income)], [T('kSpend'), HB.yen(S.total)], [T('kSp'), HB.yen(S.specials.monthly)], [T('kLeft'), HB.yen(S.left)], [T('kRate'), S.saveRate == null ? '—' : S.saveRate + '%']]) +
      '<h2>' + esc(T('rSettle')) + '</h2><pre>' + esc($('calcText').textContent) + '</pre>' +
      '<h2>' + esc(T('rSp')) + '</h2>' + t(S.specials.perItem.map(function (s) { return [s.name, HB.yen(s.amount), s.month + '月', HB.yen(s.monthly)]; })) +
      '<h2>' + esc(T('rLines')) + '</h2>' + t(m.lines.map(function (l) { return [l.date + ' ' + l.shop, HB.yen(l.amount), l.cat, nm(l.who), nm(l.paid)]; }));
  }
  self.HB_buildPrint = buildPrint;
  $('keyForm').addEventListener('submit', function (e) {
    e.preventDefault();
    self.LLK.enter($('keyIn').value).then(function (r) {
      if (r.ok) { tier = r.tier; $('keyMsg').textContent = T('keyOk'); $('keyIn').value = ''; document.querySelectorAll('.paywall').forEach(function (p) { p.remove(); }); }
      else $('keyMsg').textContent = r.offline ? T('keyOff') : T('keyBad');
      render();
    });
  });
  $('keyDel').addEventListener('click', function () { self.LLK.remove(); tier = 'free'; ym = curYm; render(); });

  // ── data
  $('expBtn').addEventListener('click', function () { dl('家計簿_backup_' + new Date().toISOString().slice(0, 10) + '.json', HB.backup(hh), 'application/json'); $('dataMsg').textContent = T('expDone'); });
  $('impFile').addEventListener('change', function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    f.text().then(function (txt) { try { hh = HB.restore(txt); ym = isPro() && hh._ym ? hh._ym : curYm; selects(); render(); $('dataMsg').textContent = T('impDone'); } catch (e) { $('dataMsg').textContent = T('impBad'); } });
  });
  $('resetBtn').addEventListener('click', function () { if (!confirm(T('resetQ'))) return; hh = HB.newHousehold(); ym = curYm; selects(); render(); });

  // ── start
  try { var sl = localStorage.getItem(KL); if (sl && I[sl]) lang = sl; } catch (e) {}
  var ql = /[?&]lang=(ja|en|de|es|pt)/.exec(location.search); if (ql) lang = ql[1];
  else { var pl = /^\/(en|de|es|pt|ja)\//.exec(location.pathname); if (pl && !localStorage.getItem(KL)) lang = pl[1]; }
  $('uiLang').value = lang;
  self.LLK.status().then(function (s) { tier = s.tier || 'free'; if (isPro() && hh._ym) ym = hh._ym; applyLang(); });
  applyLang();
})();
