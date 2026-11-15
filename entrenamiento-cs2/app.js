/* entrenamiento CS2 — página */
(function () {
  'use strict';
  var doc = document, LS = window.localStorage, E = window.ENTRENO;
  var DOORS = ['entrenamiento-cs2', 'entrenamiento-cs2.yearly', 'entrenamiento-cs2.monthly'];
  var K_KEY = 'entrenamiento-cs2.key', K_HIST = 'entrenamiento-cs2.partidas';
  var pro = false, cur = null, modo = 'hoy', med = null;
  var COL = { adr: '#2563eb', hs: '#15803d', ap: '#c2410c', ud: '#7c3aed' };
  var INP = ['min', 'dias', 'rol', 'mapa', 'adr', 'm_adr', 'hs', 'm_hs', 'apg', 'apj', 'm_ap', 'ud', 'm_ud'];
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function ffecha(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
  function nombre(id) { return E.MET[E.IDS.indexOf(id)].curto; }
  function val(id, v) { return id === 'ap' ? E.fmt(v, 0) + ' %' : id === 'hs' ? E.fmt(v, 0) + ' %' : E.fmt(v, 0); }
  function dl(n, txt, tipo) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: tipo + ';charset=utf-8' })); a.download = n;
    doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function leer() { var o = {}; INP.forEach(function (k) { o[k] = $(k).value; }); return o; }

  function draw() {
    var inp = leer(), p = E.plan(inp), F = E.fmt, h = [];
    cur = { inp: inp, p: p };
    if (p.erro) { $('out').innerHTML = '<p class="warn">' + esc(p.erro) + '</p>'; return; }
    var fi = E.IDS.indexOf(p.flojo);
    if (p.sinFallo) h.push('<p class="big">Cumples las 4 metas<b>' + p.total + ' min repartidos a partes iguales</b>Sube una meta para que la rutina vuelva a apuntar a un punto flojo.</p>');
    else h.push('<p class="big">Tu punto más flojo ' + (modo === 'manana' ? 'mañana' : 'hoy') + ': ' + esc(nombre(p.flojo)) + ' (' + val(p.flojo, p.act[p.flojo]) + ' de meta ' + val(p.flojo, p.meta[p.flojo]) + ')<b>' + p.flojoMin + ' min de ' + p.total + '</b></p>');
    if (!p.sinFallo) h.push('<p class="loss">' + (p.despSemana > 0 ? '<b>Una rutina igual para todo pone ' + p.despSemana + ' min a la semana en ' + p.cumple.map(nombre).join(', ') + ', que ya cumples</b> (' + p.despDia + ' min × ' + p.dias + ' días). ' : '') +
      'La rutina igual da ' + p.flojoIgual + ' min a ' + esc(nombre(p.flojo)) + '; esta da ' + p.flojoMin + ': +' + p.masDia + ' min al día × ' + p.dias + ' días = <b>+' + p.masSemana + ' min a la semana</b> en tu punto más flojo.</p>');
    if (modo === 'manana' && med) h.push('<p class="warn">Rutina de mañana: «ahora» = media de tus ' + med.n + ' últimas partidas (' + ffecha(med.desde) + ' a ' + ffecha(med.hasta) + '). <button id="vuelve" class="btn ghost" type="button">Volver a hoy</button></p>');
    h.push('<div class="tbl"><table><caption>Rutina de ' + p.total + ' min (' + p.semana + ' min a la semana)</caption><tr><th>Bloque</th><th>Min</th><th>Ahora / meta</th><th>Rutina igual</th></tr>');
    p.bloques.forEach(function (b) {
      var i = E.IDS.indexOf(b.id), m = i >= 0;
      h.push('<tr' + (b.id === p.flojo && !p.sinFallo ? ' class="hi"' : '') + '><td class="w"><b>' + esc(b.nombre) + '</b><small>' + esc(b.como) + '</small></td><td><b>' + b.min + '</b></td><td>' +
        (m ? esc(nombre(b.id)) + ' ' + val(b.id, b.act) + ' / ' + val(b.id, b.meta) + (b.gap === 0 ? ' <span class="ok">cumplida</span>' : ' <small>faltan ' + E.pct(b.gap) + '</small>') : '') + '</td><td>' + (m ? p.igual[i] : b.min) + '</td></tr>');
    });
    h.push('<tr class="tot"><td>Total</td><td>' + p.total + '</td><td></td><td>' + p.total + '</td></tr></table></div>');
    h.push('<p class="foco"><b>Foco para la próxima partida.</b> ' + esc(p.foco) + '</p>');
    h.push('<p><b>Comandos de consola</b> (en una partida local con bots: pégalos en la consola):</p><pre class="cmd" id="cmds">' + esc(p.cmds.join('; ')) + '</pre><p class="btns"><button id="copy" class="btn ghost" type="button">Copiar comandos</button></p>');
    $('out').innerHTML = h.join('');
    $('copy').addEventListener('click', function () { var t = $('cmds').textContent; if (navigator.clipboard) navigator.clipboard.writeText(t); $('copy').textContent = 'Copiado'; });
    if ($('vuelve')) $('vuelve').addEventListener('click', function () { modo = 'hoy'; draw(); });
    drawPro();
  }

  /* ---- clave ---- */
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
    if (!key) return;
    $('keymsg').textContent = 'Comprobando la clave…';
    check(key).then(function (ok) {
      if (ok) { LS.setItem(K_KEY, key); setPro(true); $('keymsg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/entrenamiento-cs2/'; }
      else $('keymsg').textContent = quiet ? '' : 'Esta clave no abre este producto.';
    });
  }
  function setPro(v) { pro = v; doc.body.classList.toggle('is-pro', v); drawPro(); }
  function needPro(what) {
    if (pro) return false;
    $('keymsg').textContent = what + ' — Guardar y continuar: https://getreadystack.com/es/apps/entrenamiento-cs2/';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return true;
  }

  /* ---- Pro ---- */
  function hist() { return jget(K_HIST, []); }
  function guardar() {
    if (needPro('El registro de partidas')) return;
    var o = { fecha: $('p-fecha').value || hoy(), mapa: $('p-mapa').value.trim() || cur.inp.mapa, adr: $('p-adr').value, hs: $('p-hs').value, apg: $('p-apg').value, apj: $('p-apj').value, ud: $('p-ud').value, min: cur.p.total || '' };
    if (!(E.num(o.adr) >= 0) || !(E.num(o.hs) >= 0) || !(E.num(o.apj) > 0) || !(E.num(o.apg) >= 0) || E.num(o.apg) > E.num(o.apj) || !(E.num(o.ud) >= 0)) { $('promsg').textContent = 'Rellena ADR, % HS, aperturas (ganadas ≤ jugadas) y daño de utilidad.'; return; }
    var H = hist(); H.push(o); jset(K_HIST, H);
    ['p-adr', 'p-hs', 'p-apg', 'p-apj', 'p-ud'].forEach(function (id) { $(id).value = ''; });
    $('promsg').textContent = 'Partida del ' + ffecha(o.fecha) + ' guardada (' + H.length + ' en el registro).'; drawPro();
  }
  function manana() {
    if (needPro('La rutina de mañana')) return;
    var H = hist(); med = E.media(H, 5);
    if (!med) { $('promsg').textContent = 'Guarda al menos una partida primero.'; return; }
    $('adr').value = E.fmt(med.adr, 1); $('hs').value = E.fmt(med.hs, 1); $('apg').value = med.apg; $('apj').value = med.apj; $('ud').value = E.fmt(med.ud, 1);
    modo = 'manana'; draw(); $('out').scrollIntoView({ behavior: 'smooth' });
  }
  function svgChart(H, M) {
    var S = H.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).slice(-30);
    if (S.length < 2) return '<p class="hint">El gráfico aparece con 2 partidas o más.</p>';
    var W = 640, Hh = 220, L = 40, R = 10, Tp = 10, B = 30, n = S.length, ymax = 1.5;
    function x(i) { return L + (W - L - R) * i / (n - 1); }
    function y(v) { return Tp + (Hh - Tp - B) * (1 - Math.min(v, ymax) / ymax); }
    var g = ['<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" role="img" aria-label="% de la meta por métrica">'];
    [0, 0.5, 1, 1.5].forEach(function (v) { g.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + (v === 1 ? '#13202c' : '#dde') + '"' + (v === 1 ? ' stroke-dasharray="4 3"' : '') + '/><text x="4" y="' + (y(v) + 4) + '" font-size="11" fill="#556">' + (v * 100) + '%</text>'); });
    g.push('<text x="' + L + '" y="' + (Hh - 8) + '" font-size="11" fill="#556">' + ffecha(S[0].fecha) + '</text><text x="' + (W - R) + '" y="' + (Hh - 8) + '" font-size="11" fill="#556" text-anchor="end">' + ffecha(S[n - 1].fecha) + '</text>');
    E.IDS.forEach(function (id) {
      var m = E.num(M['m_' + id]), pts = [];
      S.forEach(function (s, i) { var a = E.actual(s)[id]; if (m > 0 && a >= 0) pts.push(x(i).toFixed(1) + ',' + y(a / m).toFixed(1)); });
      if (pts.length) g.push('<polyline fill="none" stroke="' + COL[id] + '" stroke-width="2.2" points="' + pts.join(' ') + '"/>');
    });
    g.push('</svg><p class="lg">' + E.IDS.map(function (id) { return '<span><i style="background:' + COL[id] + '"></i>' + esc(nombre(id)) + '</span>'; }).join('') + '</p>');
    return '<h3>Últimas ' + n + ' partidas: % de tu meta (línea discontinua = meta)</h3>' + g.join('');
  }
  function drawPro() {
    if (!pro || !cur) return;
    var H = hist(), M = cur.inp, F = E.fmt, c = E.compara(H);
    $('cmp').innerHTML = c ? '<div class="tbl"><table><caption>¿Se nota en la partida? Tus ' + c.ult.n + ' últimas partidas frente a las ' + c.ant.n + ' anteriores</caption><tr><th>Métrica</th><th>Antes</th><th>Ahora</th><th>Cambio</th></tr>' +
      E.IDS.map(function (id) { var d = c.d[id]; return '<tr><td>' + esc(nombre(id)) + '</td><td>' + val(id, c.ant[id]) + '</td><td>' + val(id, c.ult[id]) + '</td><td class="' + (d > 0 ? 'ok' : d < 0 ? 'bad' : '') + '">' + (d > 0 ? '+' : '') + F(d, 1) + '</td></tr>'; }).join('') + '</table></div>'
      : '<p class="hint">La comparación «¿se nota en la partida?» aparece con 6 partidas guardadas o más (' + H.length + ' ahora).</p>';
    $('chart').innerHTML = svgChart(H, M);
    var W = E.semanas(H), w = ['<div class="tbl"><table><caption>Semana a semana (media de las partidas)</caption><tr><th>Semana del</th><th>Partidas</th>'];
    E.IDS.forEach(function (id) { w.push('<th>' + esc(nombre(id)) + '</th>'); }); w.push('</tr>');
    W.slice(-8).forEach(function (s) { w.push('<tr><td>' + ffecha(s.semana) + '</td><td>' + s.n + '</td>' + E.IDS.map(function (id) { var m = E.num(M['m_' + id]); return '<td' + (s[id] >= m ? ' class="ok"' : '') + '>' + val(id, s[id]) + '</td>'; }).join('') + '</tr>'); });
    w.push('</table></div>');
    $('weeks').innerHTML = W.length ? w.join('') : '';
    var S = H.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x.fecha < b.x.fecha ? 1 : -1; }), r = ['<div class="tbl"><table><caption>Registro (' + S.length + ' partidas)</caption><tr><th>Fecha</th><th>Mapa</th><th>ADR</th><th>% HS</th><th>Aperturas</th><th>Utilidad</th><th></th></tr>'];
    S.forEach(function (o) { var x = o.x; r.push('<tr><td>' + ffecha(x.fecha) + '</td><td>' + esc(x.mapa) + '</td><td>' + esc(x.adr) + '</td><td>' + esc(x.hs) + '</td><td>' + esc(x.apg) + ' de ' + esc(x.apj) + '</td><td>' + esc(x.ud) + '</td><td><button class="x" data-del="' + o.i + '" type="button" aria-label="borrar">×</button></td></tr>'); });
    r.push('</table></div>');
    $('hist').innerHTML = S.length ? r.join('') : '<p class="hint">Registro vacío: copia los números de tu última partida y guárdala.</p>';
    Array.prototype.forEach.call($('hist').querySelectorAll('[data-del]'), function (b) {
      b.addEventListener('click', function () { var H2 = hist(); H2.splice(+b.getAttribute('data-del'), 1); jset(K_HIST, H2); drawPro(); });
    });
  }
  function imprimir() {
    if (needPro('El plan para imprimir')) return;
    var p = cur.p, w = window.open('', '_blank'); if (!w) return;
    var rows = p.bloques.map(function (b) { return '<tr><td>' + esc(b.nombre) + '<br><small>' + esc(b.como) + '</small></td><td>' + b.min + ' min</td>' + [1, 2, 3, 4, 5, 6, 7].map(function (d) { return '<td>' + (d <= p.dias ? '☐' : '') + '</td>'; }).join('') + '</tr>'; }).join('');
    w.document.write('<!doctype html><meta charset="utf-8"><title>entrenamiento CS2 - plan de la semana</title><style>body{font:13px system-ui;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}small{color:#555}</style><h1>entrenamiento CS2 · plan de la semana</h1><p>' + p.total + ' min al día · ' + p.dias + ' días · punto más flojo: ' + esc(nombre(p.flojo)) + '</p><table><tr><th>Bloque</th><th>Min</th><th>L</th><th>M</th><th>X</th><th>J</th><th>V</th><th>S</th><th>D</th></tr>' + rows + '</table><p><b>Foco:</b> ' + esc(p.foco) + '</p><pre>' + esc(p.cmds.join('; ')) + '</pre>');
    w.document.close(); w.focus(); w.print();
  }

  function init() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-k]'), function (el) { el.addEventListener('input', draw); el.addEventListener('change', draw); });
    $('p-fecha').value = hoy();
    $('unlock').addEventListener('click', function () { unlock($('key').value.trim()); });
    $('save').addEventListener('click', guardar);
    $('manana').addEventListener('click', manana);
    $('print').addEventListener('click', imprimir);
    $('dlcfg').addEventListener('click', function () { if (!needPro('El archivo entreno.cfg')) dl('entreno.cfg', E.cfg(cur.p), 'text/plain'); });
    $('csv').addEventListener('click', function () { if (!needPro('El CSV')) dl('entrenamiento-cs2-partidas.csv', '﻿' + E.csv(hist()), 'text/csv'); });
    $('importcsv').addEventListener('change', function (e) {
      if (needPro('Importar CSV')) return; var f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) { var N = E.leerCsv(t); jset(K_HIST, hist().concat(N)); $('promsg').textContent = N.length + ' partidas importadas.'; drawPro(); });
    });
    $('ics').addEventListener('click', function () { if (!needPro('El recordatorio diario')) dl('entrenamiento-cs2-recordatorio.ics', E.ics($('hora').value, hoy(), 30), 'text/calendar'); });
    $('backup').addEventListener('click', function () { if (!needPro('La copia de seguridad')) dl('entrenamiento-cs2-copia.json', JSON.stringify({ v: 1, partidas: hist() }), 'application/json'); });
    $('restore').addEventListener('change', function (e) {
      if (needPro('Abrir copia')) return; var f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) { try { var j = JSON.parse(t); if (Array.isArray(j.partidas)) { jset(K_HIST, j.partidas); $('promsg').textContent = j.partidas.length + ' partidas recuperadas.'; drawPro(); } } catch (x) { $('promsg').textContent = 'Archivo de copia no válido.'; } });
    });
    draw();
    var m = /[#&]k=([^&]+)/.exec(location.hash), k = m ? decodeURIComponent(m[1]) : LS.getItem(K_KEY);
    if (k) { $('key').value = k; unlock(k, !m); }
    window.addEventListener('hashchange', function () { var mm = /[#&]k=([^&]+)/.exec(location.hash); if (mm) { $('key').value = decodeURIComponent(mm[1]); unlock($('key').value); } });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
