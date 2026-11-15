(function () {
  'use strict';
  var T = window.TF, SLUG = 'tarifas-freelance', DOORS = [SLUG, SLUG + '.once'], PRICE = '$13.99 una vez';
  var LS = { cur: 'tfr.cur', key: 'tfr.key', track: 'tfr.track', sc: 'tfr.sc' };
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var WHAT = { save: 'los escenarios guardados para comparar', print: 'la hoja del cálculo para imprimir o guardar en PDF', ics: 'el calendario .ics con los plazos del 130 y 303 y el fin de tu tarifa plana',
    csv: 'el seguimiento mes a mes en CSV', backup: 'la copia de seguridad de tus datos', imp: 'cargar una copia de seguridad', track: 'el seguimiento mes a mes', quote: 'el presupuesto para un cliente con IVA y retención' };
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(x, d) { return (+x).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' }); }
  function eur(x, d) { return fmt(x, d == null ? 2 : d) + ' €'; }
  function num(x, d) { return fmt(x, d || 0); }
  var fields = [].slice.call(document.querySelectorAll('[data-k]')), pro = false, R = null;

  function read() {
    var v = {};
    fields.forEach(function (f) { v[f.id] = f.value; });
    var n = function (k) { var x = parseFloat(String(v[k]).replace(',', '.')); return isNaN(x) ? 0 : x; };
    return { neto: n('neto'), actual: n('actual'), gastos: n('gastos'), ccaa: v.ccaa || 'MD', locales: n('locales'), vacaciones: n('vacaciones'), otros: n('otros'),
      nofact: Math.min(90, n('nofact')), horas: n('horas'), plana: Math.min(12, Math.max(0, Math.round(n('plana')))), plana_eur: n('plana_eur'), retencion: n('retencion'), irpf_pct: n('irpf_pct') };
  }
  function fill(v) { fields.forEach(function (f) { if (f.id in v) f.value = v[f.id]; }); }
  function fin(meses) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + meses); return MES[d.getMonth()] + ' de ' + d.getFullYear(); }

  function render() {
    var v = read(); put(LS.cur, v); R = T.compute(v);
    var B = R.B, A = R.actual, D = R.D;
    var k = [['Tarifa diaria mínima', eur(R.diaR, 0)], ['Por hora', eur(R.horaR, 0)], ['Días facturables 2026', num(D.fact, 2)]];
    if (A && A.perdida > 0.005) k.push(['Pierdes al año con ' + eur(A.tarifa, 0) + '/día', eur(A.perdida)]);
    else k.push(['Facturación necesaria al año', eur(R.F)]);
    $('#kpi').innerHTML = k.map(function (x) { return '<div><b>' + x[1] + '</b><span>' + esc(x[0]) + '</span></div>'; }).join('');
    var t = 'Para ' + eur(v.neto) + ' netos al mes necesitas facturar ' + eur(R.F) + ' al año sin IVA: con ' + num(D.fact, 2) + ' días facturables, al menos ' + eur(R.diaR, 0) + ' al día (' + eur(R.horaR, 0) + ' la hora).';
    if (A) {
      if (A.perdida > 0.005) t += ' Con tus ' + eur(A.tarifa, 0) + ' al día te quedan ' + eur(A.B.neto) + ' netos al año: pierdes ' + eur(A.perdida) + ' al año, ' + eur(A.perdidaMes) + ' al mes. A esa tarifa tendrías que facturar ' + num(A.diasNecesarios, 1) + ' días.';
      else t += ' Con tus ' + eur(A.tarifa, 0) + ' al día te quedan ' + eur(A.B.neto) + ' netos al año, ' + eur(-A.perdida) + ' más de lo que pides.';
    }
    $('#verdict').textContent = t;
    if (R.plana) {
      $('#plana-out').hidden = false;
      $('#plana-out').textContent = 'Tarifa plana: con ' + R.plana.meses + (R.plana.meses === 1 ? ' mes' : ' meses') + ' de cuota reducida en los próximos 12 te bastarían ' + eur(R.plana.diaR, 0) + ' al día. Cuando se acabe (' + fin(R.plana.meses) + ') pagarás la cuota del tramo ' + B.tramo.n + ', ' + eur(B.tramo.cuota) + ' al mes, ' + eur(R.plana.cuotaExtra) + ' más cada mes: tu tarifa tiene que subir a ' + eur(R.diaR, 0) + ' al día.';
    } else $('#plana-out').hidden = true;
    var rows = [['Facturación (sin IVA)', B.F], ['− Gastos del negocio', -B.G], ['− Cuota de autónomos (tramo ' + B.tramo.n + ', ' + eur(B.tramo.cuota) + ' al mes)', -B.cuota],
      ['= Rendimiento neto', B.RN], ['− IRPF del año' + (v.irpf_pct > 0 ? ' (' + num(v.irpf_pct, 1) + ' %)' : ' (base ' + eur(B.base, 0) + ')'), -B.irpf], ['= Neto al año', B.neto], ['= Neto al mes', B.neto / 12]];
    if (A) rows.push(['Neto al año cobrando ' + eur(A.tarifa, 0) + ' al día', A.B.neto]);
    $('#bd tbody').innerHTML = rows.map(function (r) { return '<tr' + (/^=/.test(r[0]) ? ' class="sum"' : '') + '><td>' + esc(r[0]) + '</td><td class="n">' + eur(r[1]) + '</td></tr>'; }).join('');
    $('#dt tbody').innerHTML = [['Lunes a viernes de 2026', D.laborables], ['− Festivos en día laborable (' + T.CCAA[v.ccaa] + ')', -D.festivos], ['− Festivos locales', -D.locales],
      ['− Vacaciones y otros días', -D.libres], ['= Días de trabajo', D.trabajo], ['− Tiempo sin facturar (' + num(v.nofact) + ' %)', -(D.trabajo - D.fact)], ['= Días facturables', D.fact]]
      .map(function (r) { return '<tr' + (/^=/.test(r[0]) ? ' class="sum"' : '') + '><td>' + esc(r[0]) + '</td><td class="n">' + num(r[1], 2) + '</td></tr>'; }).join('');
    var WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    $('#hol-sum').textContent = 'Festivos 2026 en día laborable en ' + T.CCAA[v.ccaa] + ': ' + D.festivos + ' (más tus ' + D.locales + ' locales)';
    $('#hol').innerHTML = D.liste.map(function (h) { var p = h.d.split('-'), w = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); return '<li>' + WD[w] + ' ' + p[2] + '/' + p[1] + '/' + p[0] + ' ' + esc(h.n) + '</li>'; }).join('');
    var C = R.cliente;
    $('#cli').textContent = 'Factura de un día a ' + eur(C.base) + ': + IVA 21 % ' + eur(C.iva) + (v.retencion > 0 ? ' − retención ' + num(v.retencion) + ' % ' + eur(C.ret) : '') + ' = tu cliente te paga ' + eur(C.total) + '. El IVA no es tuyo: va al modelo 303.';
    $('#ren').textContent = v.retencion > 0
      ? 'Retención: tus clientes adelantan ' + eur(R.retenido) + ' de IRPF en el año y tu IRPF calculado es ' + eur(B.irpf) + (R.renta > 0.005 ? ': en la Renta te tocaría pagar ' + eur(R.renta) + '. Aparta un ' + num(R.apartar, 1) + ' % de cada factura.' : ': en la Renta te devolverían unos ' + eur(-R.renta) + '.')
      : 'Sin retención (clientes particulares): si al menos el 70 % de tus ingresos no lleva retención presentas el modelo 130 cada trimestre (20 % del rendimiento acumulado). Tu IRPF calculado del año: ' + eur(B.irpf) + '.';
    drawTrack();
  }

  // ---------- Pro ----------
  function trRows() { return get(LS.track, []); }
  function drawTrack() {
    var rows = trRows();
    $('#tr tbody').innerHTML = MES.map(function (m, i) { var r = rows[i] || {}; return '<tr><td>' + m + '</td><td><input data-tr="' + i + '" data-c="dias" type="number" min="0" step="0.5" value="' + (r.dias || '') + '"></td><td><input data-tr="' + i + '" data-c="fact" type="number" min="0" step="10" value="' + (r.fact || '') + '"></td></tr>'; }).join('');
    [].forEach.call(document.querySelectorAll('[data-tr]'), function (inp) {
      inp.addEventListener('focus', function () { if (!pro) { this.blur(); locked('track'); } });
      inp.addEventListener('change', function () {
        var L = get(LS.track, []), i = +inp.getAttribute('data-tr');
        L[i] = L[i] || {}; L[i][inp.getAttribute('data-c')] = parseFloat(inp.value) || 0; put(LS.track, L); trOut();
      });
    });
    trOut();
  }
  function trData() { var L = trRows(); return MES.map(function (m, i) { var r = L[i] || {}; return { dias: r.dias || 0, fact: r.fact || 0 }; }); }
  function trOut() {
    var X = T.track(R, trData());
    if (!X.meses) { $('#tr-out').textContent = 'Aún no hay meses apuntados.'; return; }
    $('#tr-out').textContent = 'Hasta ' + MES[X.meses - 1] + ': ' + num(X.dias, 1) + ' días, ' + eur(X.fact) + ' facturados (tu plan: ' + eur(X.plan) + ', ' + (X.diff >= 0 ? eur(X.diff) + ' por delante' : eur(-X.diff) + ' por detrás') + '). Media ' + eur(X.media) + ' al día. En los ' + num(X.restDias, 1) + ' días que te quedan necesitas ' + eur(X.restF) + ': ' + eur(X.tarifaResto, 0) + ' al día.';
  }
  function locked(what) { $('#pro-msg').innerHTML = 'Este botón abre ' + esc(WHAT[what] || ' — Guardar y continuar: https://getreadystack.com/es/apps/tarifas-freelance/') + ' — Guardar y continuar: https://getreadystack.com/es/apps/tarifas-freelance/' + PRICE + '' + SLUG + ' — Guardar y continuar: https://getreadystack.com/es/apps/tarifas-freelance/'; }
  function download(name, body, type) { var b = new Blob([body], { type: type }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function drawSc() {
    var S = get(LS.sc, []);
    $('#sc tbody').innerHTML = S.map(function (s, i) { return '<tr><td>' + esc(s.name) + '</td><td>' + eur(s.v.neto, 0) + '</td><td>' + esc(T.CCAA[s.v.ccaa] || s.v.ccaa) + '</td><td>' + num(s.fact, 2) + '</td><td>' + eur(s.diaR, 0) + '</td><td>' + eur(s.horaR, 0) + '</td><td><button type="button" class="link" data-open="' + i + '">abrir</button> <button type="button" class="link" data-del="' + i + '">borrar</button></td></tr>'; }).join('') || '<tr><td colspan="7">Aún no hay escenarios.</td></tr>';
    [].forEach.call(document.querySelectorAll('[data-open]'), function (b) { b.onclick = function () { fill(S[+b.getAttribute('data-open')].v); render(); }; });
    [].forEach.call(document.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { S.splice(+b.getAttribute('data-del'), 1); put(LS.sc, S); drawSc(); }; });
  }
  function ev(L, d, uid, sum, desc) {
    L.push('BEGIN:VEVENT', 'UID:' + uid + '@tarifas-freelance', 'DTSTAMP:' + d + 'T080000Z', 'DTSTART;VALUE=DATE:' + d, 'SUMMARY:' + sum, 'DESCRIPTION:' + desc,
      'BEGIN:VALARM', 'TRIGGER:-P5D', 'ACTION:DISPLAY', 'DESCRIPTION:' + sum + ' en 5 días', 'END:VALARM', 'END:VEVENT');
  }
  function ics() {
    var v = read(), L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//tarifas freelance//ES', 'CALSCALE:GREGORIAN'];
    var iva = eur(R.F * 0.21 / 4), q130 = eur(Math.max(0, B130()) / 4);
    T.PLAZOS.forEach(function (p) {
      var d = p[1] + ('0' + p[2]).slice(-2) + ('0' + p[3]).slice(-2);
      ev(L, d, 'p' + d, 'Modelos 303 y 130 del ' + p[0] + ' ' + T.K.year, 'IVA repercutido del trimestre según tu plan ca. ' + iva + ' (menos el IVA de tus gastos). Modelo 130: ' + (v.retencion > 0 ? 'no lo presentas si al menos el 70 % de tus ingresos lleva retención' : 'ca. ' + q130 + ' por trimestre') + '.');
    });
    if (R.plana) {
      var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + R.plana.meses);
      var ds = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + '01';
      ev(L, ds, 'plana' + ds, 'Se acaba tu tarifa plana: sube tu tarifa a ' + eur(R.diaR, 0) + ' al día', 'Desde este mes pagas la cuota del tramo ' + R.B.tramo.n + ' (' + eur(R.B.tramo.cuota) + ' al mes). Revisa tus presupuestos.');
    }
    L.push('END:VCALENDAR'); return L.join('\r\n');
  }
  function B130() { return (R.B.RN) * 0.20 - R.retenido; }
  function csv() {
    var L = ['Mes;Días;Facturado'];
    trData().forEach(function (r, i) { L.push(MES[i] + ';' + String(r.dias).replace('.', ',') + ';' + String(r.fact).replace('.', ',')); });
    L.push('Tarifa diaria mínima;' + R.diaR + ';Facturación plan ' + String(R.F).replace('.', ','));
    return L.join('\n');
  }
  function quote() {
    var tar = parseFloat($('#q-tar').value) || R.diaR, dias = parseFloat($('#q-dias').value) || 0, iva = +$('#q-iva').value, ret = +$('#q-ret').value;
    var base = Math.round(tar * dias * 100) / 100, vi = Math.round(base * iva) / 100, vr = Math.round(base * ret) / 100, tot = Math.round((base + vi - vr) * 100) / 100;
    var d = new Date(), ds = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    return { base: base, iva: vi, ret: vr, total: tot, html: '<h3>Presupuesto</h3><p>Para: ' + esc($('#q-cli').value) + '<br>Fecha: ' + ds + ' · válido 30 días</p><table><thead><tr><th>Trabajo</th><th class="n">Días</th><th class="n">Tarifa día</th><th class="n">Importe</th></tr></thead><tbody><tr><td>' + esc($('#q-trab').value) + '</td><td class="n">' + num(dias, 1) + '</td><td class="n">' + eur(tar) + '</td><td class="n">' + eur(base) + '</td></tr>' +
      '<tr><td colspan="3">Base imponible</td><td class="n">' + eur(base) + '</td></tr>' + (iva ? '<tr><td colspan="3">IVA 21 %</td><td class="n">' + eur(vi) + '</td></tr>' : '<tr><td colspan="3">Operación exenta de IVA</td><td class="n">0,00 €</td></tr>') +
      (ret ? '<tr><td colspan="3">Retención IRPF ' + ret + ' %</td><td class="n">−' + eur(vr) + '</td></tr>' : '') + '<tr class="sum"><td colspan="3">Total a pagar</td><td class="n">' + eur(tot) + '</td></tr></tbody></table>' };
  }
  window.__quote = quote;
  function act(what) {
    if (!pro) { locked(what); return; }
    var v = read();
    if (what === 'save') { var S = get(LS.sc, []), name = (prompt('Nombre del escenario', 'Escenario ' + (S.length + 1)) || '').trim(); if (!name) return; S.push({ name: name, v: v, fact: R.D.fact, diaR: R.diaR, horaR: R.horaR }); put(LS.sc, S); drawSc(); }
    else if (what === 'print') window.print();
    else if (what === 'quote') { var q = quote(); $('#presupuesto').innerHTML = q.html; $('#presupuesto').hidden = false; }
    else if (what === 'ics') download('plazos-autonomo-' + T.K.year + '.ics', ics(), 'text/calendar');
    else if (what === 'csv') download('tarifas-freelance-seguimiento.csv', csv(), 'text/csv');
    else if (what === 'backup') download('tarifas-freelance-copia.json', JSON.stringify({ current: v, track: get(LS.track, []), sc: get(LS.sc, []) }, null, 1), 'application/json');
  }
  [].forEach.call(document.querySelectorAll('[data-pro]'), function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-pro')); }); });
  $('#imp').addEventListener('click', function (e) { if (!pro) { e.preventDefault(); locked('imp'); } });
  $('#imp').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () { try { var j = JSON.parse(rd.result); if (j.track) put(LS.track, j.track); if (j.sc) put(LS.sc, j.sc); if (j.current) fill(j.current); render(); drawSc(); $('#pro-msg').textContent = 'Copia cargada.'; } catch (e) { $('#pro-msg').textContent = 'Este archivo no es una copia de esta calculadora.'; } };
    rd.readAsText(f);
  });
  window.__exportICS = function () { return ics(); }; window.__exportCSV = function () { return csv(); }; window.__R = function () { return R; };

  function setPro(on) { pro = on; document.body.classList.toggle('is-pro', on); $('#pw').hidden = on; }
  function unlock(k) {
    k = String(k || '').trim(); if (!k) return; $('#key-msg').textContent = 'Comprobando…'; var i = 0;
    (function next() {
      if (i >= DOORS.length) { $('#key-msg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/tarifas-freelance/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/tarifas-freelance/'; } else next();
      }).catch(next);
    })();
  }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  var hk = (location.hash.match(/#k=([^&]+)/) || [])[1];
  if (hk) { unlock(decodeURIComponent(hk)); history.replaceState(null, '', location.pathname); } else if (get(LS.key, '')) unlock(get(LS.key, ''));
  window.addEventListener('hashchange', function () { var h = (location.hash.match(/#k=([^&]+)/) || [])[1]; if (h) unlock(decodeURIComponent(h)); });

  $('#reset').addEventListener('click', function () { var d = {}; for (var k in T.DEFAULTS) d[k] = T.DEFAULTS[k]; fill(d); render(); });
  $('#check').addEventListener('click', render);
  fields.forEach(function (f) { f.addEventListener('change', render); f.addEventListener('input', render); });
  var cur = get(LS.cur, null); if (cur) fill(cur);
  render(); drawSc();
})();
