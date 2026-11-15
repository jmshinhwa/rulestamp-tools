(function () {
  'use strict';
  var L = window.LAK, $ = function (s) { return document.querySelector(s); };
  var SLUG = 'linkedin-automatisierung-kostenrechner', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var PRICE = '$29 pro Jahr oder $5.99 im Monat';
  var LS = { cur: 'lak_cur', cmp: 'lak_cmp', inv: 'lak_inv', key: 'lak_key' };
  var KEYS = ['cur', 'base', 'incl_acc', 'extra_acc', 'acc', 'nav', 'cred_need', 'cred_incl', 'pack_size', 'pack_price', 'vat', 'vat_rate', 'fx', 'meetings', 'renew', 'notice'];
  var pro = false;
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var de = L.de;
  function eur(x) { return de(x) + ' €'; }
  function read() { var v = {}; KEYS.forEach(function (k) { var el = document.getElementById(k); v[k] = el ? el.value : ''; }); return v; }
  function fill(v) { KEYS.forEach(function (k) { var el = document.getElementById(k); if (el && v[k] != null) el.value = v[k]; }); }
  var SAMPLE_INV = [
    { date: '2026-09-03', tool: 'Outreach-Tool', amount: 216, cur: 'USD', fx: 1.1052 },
    { date: '2026-10-03', tool: 'Outreach-Tool', amount: 216, cur: 'USD', fx: 1.1052 },
    { date: '2026-11-03', tool: 'Outreach-Tool', amount: 216, cur: 'USD', fx: 1.1052 }
  ];

  function render() {
    var v = read(), a = L.compute(v); put(LS.cur, v);
    var c = a.cur === 'USD' ? ' USD' : ' €';
    var k = [
      ['USt verloren', a.klein ? eur(a.lossYear) : '0,00 €', 'jährlich, nicht abziehbar'],
      ['Pro Konto', eur(a.accMonth), 'statt ' + eur(a.listAccEur) + ' laut Preisseite'],
      ['Pro Termin', a.perMeeting == null ? '–' : eur(a.perMeeting), de(+read().meetings, 0) + ' Termine im Monat'],
      ['Gesamt', eur(a.monthEur), 'monatlich, ' + eur(a.yearEur) + ' jährlich']
    ];
    $('#kpi').innerHTML = k.map(function (x) { return '<div><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></div>'; }).join('');
    $('#verdict').innerHTML = a.klein
      ? 'Als Kleinunternehmer zahlen Sie <b>' + eur(a.burdenVat) + '</b> Umsatzsteuer im Monat obendrauf und bekommen sie nicht zurück. Pro Konto kostet das Tool das <b>' + de(a.factor) + '-Fache</b> des Preises auf der Preisseite.'
      : 'Regelbesteuert: Sie melden ' + eur(a.vatEur) + ' § 13b-Steuer im Monat und ziehen denselben Betrag als Vorsteuer ab, also 0,00 € Belastung. Pro Konto kostet das Tool das <b>' + de(a.factor) + '-Fache</b> des Preises auf der Preisseite.';
    var rows = [
      ['Grundpreis', de(+v.base) + c],
      ['Weitere Konten: ' + a.extraAcc + ' × ' + de(+v.extra_acc) + c, de(a.extraAcc * v.extra_acc) + c],
      ['Credit-Pakete: ' + a.packs + ' (fehlen ' + de(a.missing, 0) + ' Credits)', de(a.packs * v.pack_price) + c],
      ['Tool netto', de(a.toolCur) + c]
    ];
    if (a.cur === 'USD') rows.push(['In Euro (÷ ' + de(a.fx, 4) + ')', eur(a.toolEur)]);
    rows.push(['Sales Navigator × ' + a.acc + ' Konten', eur(a.navEur)], ['Netto gesamt', eur(a.netEur)],
      ['Umsatzsteuer ' + de(a.rate, 0) + ' % (§ 13b)', eur(a.vatEur)], [a.klein ? 'Davon nicht abziehbar' : 'Als Vorsteuer abziehbar', eur(a.klein ? a.burdenVat : a.vatEur)],
      ['Ihre Kosten im Monat', eur(a.monthEur)], ['Ihre Kosten im Jahr', eur(a.yearEur)]);
    var cb = L.cancelBy(v.renew, v.notice);
    if (cb) rows.push(['Spätestens kündigen am', cb.split('-').reverse().join('.')]);
    $('#bd tbody').innerHTML = rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td class="n">' + esc(r[1]) + '</td></tr>'; }).join('');
    drawInv();
  }

  function invRows() { return get(LS.inv, null) || SAMPLE_INV; }
  function drawInv() {
    var rows = invRows();
    $('#it tbody').innerHTML = rows.map(function (r, i) {
      return '<tr><td>' + esc(r.date.split('-').reverse().join('.')) + '</td><td>' + esc(r.tool) + '</td><td class="n">' + esc(de(+r.amount)) + '</td><td>' + esc(r.cur) + '</td><td class="n">' + esc(r.cur === 'USD' ? de(+r.fx, 4) : '–') + '</td><td>' + (pro ? '<button type="button" class="link" data-del="' + i + '">löschen</button>' : '') + '</td></tr>';
    }).join('');
    var s = L.invoiceSum(rows, read().vat_rate);
    $('#im tbody').innerHTML = s.months.map(function (m) { return '<tr><td>' + m.month.split('-').reverse().join('/') + '</td><td class="n">' + m.n + '</td><td class="n">' + de(m.net) + '</td><td class="n">' + de(m.vat) + '</td></tr>'; }).join('') +
      '<tr><th>Summe</th><td></td><th class="n">' + de(s.total.net) + '</th><th class="n">' + de(s.total.vat) + '</th></tr>';
    [].forEach.call(document.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { var r = invRows().slice(); r.splice(+b.getAttribute('data-del'), 1); put(LS.inv, r); drawInv(); }; });
  }

  var WHAT = { save: 'den Vergleich mehrerer Tools', print: 'die Kostenaufstellung zum Drucken oder als PDF', ics: 'die Kündigungs-Erinnerung (.ics)', csv: 'die Rechnungsliste als CSV', backup: 'die Sicherung', imp: 'das Laden einer Sicherung', addinv: 'die eigene Rechnungsliste' };
  function locked(what) { $('#pro-msg').innerHTML = 'Dieser Knopf öffnet ' + esc(WHAT[what] || ' — Speichern und weitermachen: https://getreadystack.com/de/apps/linkedin-automatisierung-kostenrechner/') + ' — Speichern und weitermachen: https://getreadystack.com/de/apps/linkedin-automatisierung-kostenrechner/' + PRICE + '' + SLUG + ' — Speichern und weitermachen: https://getreadystack.com/de/apps/linkedin-automatisierung-kostenrechner/'; }
  function download(name, text, type) { var b = new Blob([text], { type: type }); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function toolName() { var p = $('#preset'); return p.value ? p.options[p.selectedIndex].text.split(' (')[0] : 'Eigenes Tool'; }
  function drawCmp() {
    var rows = get(LS.cmp, []); $('#cmp').hidden = !rows.length;
    $('#cmp tbody').innerHTML = rows.map(function (r, i) { var a = L.compute(r.v);
      return '<tr><td>' + esc(r.name) + '</td><td class="n">' + a.acc + '</td><td class="n">' + de(a.accMonth) + '</td><td class="n">' + de(a.monthEur) + '</td><td class="n">' + (a.perMeeting == null ? '–' : de(a.perMeeting)) + '</td><td class="n">' + de(a.lossYear) + '</td><td><button type="button" class="link" data-cdel="' + i + '">entfernen</button></td></tr>'; }).join('');
    [].forEach.call(document.querySelectorAll('[data-cdel]'), function (b) { b.onclick = function () { var r = get(LS.cmp, []); r.splice(+b.getAttribute('data-cdel'), 1); put(LS.cmp, r); drawCmp(); }; });
  }
  function ics() {
    var v = read(), cb = L.cancelBy(v.renew, v.notice); if (!cb) return null; var d = cb.replace(/-/g, ''), now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LinkedIn Automatisierung Kostenrechner//DE', 'BEGIN:VEVENT', 'UID:' + d + '-' + SLUG + '@yj', 'DTSTAMP:' + now, 'DTSTART;VALUE=DATE:' + d,
      'SUMMARY:Letzter Tag: ' + toolName() + ' kündigen oder behalten', 'DESCRIPTION:Verlängerung am ' + v.renew + '. Kosten laut Rechner: ' + de(L.compute(v).monthEur) + ' EUR im Monat.',
      'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:Kündigungsfrist endet in 7 Tagen', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }
  function csv() { var rate = read().vat_rate; return 'Datum;Tool;Betrag;Waehrung;Kurs;Netto EUR;Steuer EUR\n' + invRows().map(function (r) { var s = L.invoiceSum([r], rate).total; return [r.date, r.tool, de(+r.amount), r.cur, r.cur === 'USD' ? de(+r.fx, 4) : '', de(s.net), de(s.vat)].join(';'); }).join('\n'); }
  function sheet() {
    var v = read(), a = L.compute(v);
    return '<h2>Kostenaufstellung ' + esc(toolName()) + '</h2><p>Stand ' + new Date().toLocaleDateString('de-DE') + ' · ' + a.acc + ' Konten · ' + (a.klein ? 'Kleinunternehmer (§ 19 UStG)' : 'regelbesteuert') + '</p>' + $('#bd').outerHTML + $('#im').outerHTML;
  }
  function act(what) {
    if (!pro) { locked(what); return; }
    if (what === 'save') { var r = get(LS.cmp, []); r.push({ name: toolName() + ', ' + read().acc + ' Konten', v: read() }); put(LS.cmp, r); drawCmp(); $('#pro-msg').textContent = 'Im Vergleich gespeichert.'; }
    else if (what === 'print') { $('#sheet').innerHTML = sheet(); $('#sheet').hidden = false; window.print(); }
    else if (what === 'ics') { var t = ics(); if (t) download('kuendigung-erinnerung.ics', t, 'text/calendar'); else $('#pro-msg').textContent = 'Bitte ein Verlängerungsdatum eintragen.'; }
    else if (what === 'csv') download('rechnungsliste-13b.csv', csv(), 'text/csv');
    else if (what === 'backup') download('linkedin-kosten-sicherung.json', JSON.stringify({ current: read(), cmp: get(LS.cmp, []), inv: invRows() }, null, 1), 'application/json');
    else if (what === 'addinv') { var v = read(), a = L.compute(v), rows = get(LS.inv, null) || []; rows.push({ date: new Date().toISOString().slice(0, 10), tool: toolName(), amount: a.toolCur, cur: a.cur, fx: +v.fx }); put(LS.inv, rows); drawInv(); }
  }
  [].forEach.call(document.querySelectorAll('[data-pro]'), function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-pro')); }); });
  $('#imp').addEventListener('click', function (e) { if (!pro) { e.preventDefault(); locked('imp'); } });
  $('#imp').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () { try { var j = JSON.parse(rd.result); if (j.cmp) put(LS.cmp, j.cmp); if (j.inv) put(LS.inv, j.inv); if (j.current) fill(j.current); drawCmp(); render(); $('#pro-msg').textContent = 'Sicherung geladen.'; } catch (e) { $('#pro-msg').textContent = 'Diese Datei ist keine Sicherung dieser Seite.'; } };
    rd.readAsText(f);
  });
  function setPro(on) { pro = on; document.body.classList.toggle('is-pro', on); $('#pw').hidden = on; drawInv(); }
  function unlock(k) {
    k = String(k || '').trim(); if (!k) return; $('#key-msg').textContent = 'Prüfe …'; var i = 0;
    (function next() {
      if (i >= DOORS.length) { $('#key-msg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/linkedin-automatisierung-kostenrechner/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Speichern und weitermachen: https://getreadystack.com/de/apps/linkedin-automatisierung-kostenrechner/'; } else next();
      }).catch(next);
    })();
  }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  var hk = (location.hash.match(/#k=([^&]+)/) || [])[1];
  if (hk) { unlock(decodeURIComponent(hk)); history.replaceState(null, '', location.pathname); } else if (get(LS.key, '')) unlock(get(LS.key, ''));
  window.addEventListener('hashchange', function () { var h = (location.hash.match(/#k=([^&]+)/) || [])[1]; if (h) unlock(decodeURIComponent(h)); });

  $('#preset').addEventListener('change', function () { var p = L.PRESETS[this.value]; if (p) { fill(p); render(); } });
  KEYS.forEach(function (k) { var el = document.getElementById(k); el.addEventListener('input', render); el.addEventListener('change', render); });
  $('#check').addEventListener('click', render);
  $('#reset').addEventListener('click', function () { $('#preset').value = ''; fill(L.DEF); render(); });
  var cur = get(LS.cur, null); if (cur) fill(cur);
  drawCmp(); render();
})();
