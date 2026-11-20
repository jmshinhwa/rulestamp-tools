/* cuadrante turnos — interfaz. Gratis: una semana completa en pantalla. Pro: equipos y semanas guardados, encadenar semanas, imprimir, registro de jornada, CSV, .ics. */
(function () {
  'use strict';
  var C = window.CT, doc = document, LS = window.localStorage;
  var SLUG = 'cuadrante-turnos-descanso-12-horas-coste', DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  var K_KEY = 'ct_pro_key', K_DATA = 'ct_pro_data';
  var $ = function (id) { return doc.getElementById(id); };
  var last = null, pro = false;
  var TYPE = { rest: 'Descanso < 12 h', day: 'Más de 9 h al día', weekly: 'Sin día y medio libre', extra: 'Horas sobre contrato', smi: 'Por debajo del SMI', minor: 'Menor de noche', pause: 'Pausa sin marcar', cover: 'Faltan personas', bad: 'Celda sin entender' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opts(prevEnd) { return { rest: $('rest').value, maxDay: $('maxDay').value, annualHours: $('annualHours').value, prevEnd: prevEnd }; }
  function kpi(cls, big, small) { return '<div class="kpi ' + cls + '"><b>' + big + '</b><span>' + small + '</span></div>'; }

  function prevEndFor(team, week) {
    if (!pro || !team || !week) return null;
    var d = data(), t = d.teams[team], prevWeek = C.addDays(week, -7);
    if (!t || !t.weeks[prevWeek]) return null;
    var g = C.parseGrid(t.weeks[prevWeek].grid);
    return C.weekEnds(C.analyze(g, opts()));
  }

  function run() {
    var grid = C.parseGrid($('grid').value), out = $('out');
    if (!grid.staff.length) { out.innerHTML = '<p class="say">No encuentro personas. Escribe una fila por persona: Nombre · horas de contrato · €/h · los 7 turnos de lunes a domingo.</p>'; last = null; return; }
    var week = C.monday($('week').value) || $('week').value;
    var team = ($('team').value || '').trim();
    var pe = prevEndFor(team, week);
    var res = C.analyze(grid, opts(pe || undefined)), T = res.totals;
    last = { res: res, week: week, grid: $('grid').value, chained: !!pe };
    var ex = $('grid').value === $('grid').defaultValue;
    var h = '';
    h += '<p class="loss">' + (T.legal ? '<b>' + T.legal + (T.legal === 1 ? ' aviso legal' : ' avisos legales') + '</b> en el cuadrante' + (T.rest ? ', <b>' + T.rest + (T.rest === 1 ? ' descanso' : ' descansos') + ' de menos de ' + C.dec(C.num($('rest').value) || 12, 0) + ' h</b> entre jornadas' : '') + '. Cada uno puede ser una infracción grave: multa de ' + C.eur(T.fineMin).replace(',00', '') + ' a ' + C.eur(T.fineMax).replace(',00', '') + ' (LISOS, arts. 7.5 y 40.1.b).' : '<b>Ningún aviso legal</b> en el cuadrante de esta semana.') + '</p>';
    h += '<div class="kpis">' +
      kpi(T.rest ? 'bad' : 'good', String(T.rest), 'descansos de menos de ' + C.dec(C.num($('rest').value) || 12, 0) + ' h') +
      kpi(T.legal ? 'bad' : 'good', String(T.legal), 'avisos legales en total') +
      kpi('', C.eur(T.cost), 'coste bruto de la semana') +
      kpi('', C.hdec(T.minutes), 'horas de turnos · ' + C.hdec(T.night) + ' nocturnas') + '</div>';
    h += '<p class="meta">' + (ex ? 'Ejemplo inventado: bar de 5 personas, semana del ' : 'Semana del ') + C.fmtDate(week) + ' · SMI 2026: ' + C.dec(T.smiHour) + ' € por hora trabajada' + (last.chained ? ' · encadenada con la semana anterior' : '') + '</p>';
    h += '<ul class="issues">';
    res.issues.filter(function (i) { return i.type !== 'pause' && i.type !== 'bad'; }).forEach(function (i) { h += '<li class="t-' + i.type + '"><span class="tag">' + esc(TYPE[i.type]) + '</span> ' + (i.who ? '<b>' + esc(i.who) + '</b>: ' : '') + esc(i.text) + '</li>'; });
    res.issues.filter(function (i) { return i.type === 'pause' || i.type === 'bad'; }).forEach(function (i) { h += '<li class="t-' + i.type + '"><span class="tag">' + esc(TYPE[i.type]) + '</span> <b>' + esc(i.who) + '</b>: ' + esc(i.text) + '</li>'; });
    h += '</ul>';
    // cuadrante
    h += '<div class="tbl"><table class="rota"><thead><tr><th>Persona</th>';
    C.DAYS.forEach(function (d, i) { h += '<th>' + d + ' ' + C.fmtDate(C.addDays(week, i)).slice(0, 5) + '</th>'; });
    h += '<th>Horas</th><th>Contrato</th><th>Coste</th></tr></thead><tbody>';
    res.people.forEach(function (w) {
      h += '<tr><td>' + esc(w.name) + (w.minor ? ' <small>(menor)</small>' : '') + '</td>';
      w.days.forEach(function (d) {
        var cls = d.off ? 'off' : (d.flags.length ? 'flag f-' + d.flags[0] : 'on');
        h += '<td class="' + cls + '">' + (d.off ? esc(d.label || 'L') : esc(d.raw.replace(/\s*p\s*\d+/i, '')) + '<small>' + C.hdec(d.minutes) + '</small>') + '</td>';
      });
      var dif = isFinite(w.diff) && Math.abs(w.diff) > 0.5 ? ' (' + (w.diff > 0 ? '+' : '') + C.hrs(w.diff).replace('−', '−') + ')' : '';
      h += '<td>' + C.hdec(w.minutes) + '</td><td' + (w.diff > 0.5 ? ' class="neg"' : '') + '>' + (isFinite(w.contract) ? C.dec(w.contract, w.contract % 1 ? 1 : 0) + ' h' + dif : '—') + '</td><td>' + C.eur(w.cost) + '</td></tr>';
    });
    h += '<tr class="cnt"><td>Personas</td>';
    res.dayCount.forEach(function (n, i) { var need = res.need ? res.need[i] : 0; h += '<td class="' + (need > n ? 'neg' : '') + '">' + n + (need ? ' / ' + need : '') + '</td>'; });
    h += '<td>' + C.hdec(T.minutes) + '</td><td></td><td>' + C.eur(T.cost) + '</td></tr></tbody></table></div>';
    out.innerHTML = h;
    fillWho();
  }

  function fillWho() {
    var s = $('who'); if (!s || !last) return;
    var cur = s.value;
    s.innerHTML = '<option value="">todo el equipo</option>' + last.res.people.map(function (w) { return '<option>' + esc(w.name) + '</option>'; }).join('');
    s.value = cur;
  }

  /* */
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
    $('keymsg').textContent = 'Comprobando la clave…';
    check(key).then(function (ok) {
      if (ok) { pro = true; LS.setItem(K_KEY, key); doc.body.classList.add('is-pro'); $('keymsg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/cuadrante-turnos-descanso-12-horas-coste/'; drawHist(); run(); }
      else { $('keymsg').textContent = quiet ? '' : 'Esa clave no es válida para este producto.'; }
    });
  }
  function data() { try { var d = JSON.parse(LS.getItem(K_DATA)); return d && d.teams ? d : { teams: {} }; } catch (e) { return { teams: {} }; } }
  function store(d) { LS.setItem(K_DATA, JSON.stringify(d)); }
  function needPro(what) {
    if (pro) return false;
    $('keymsg').textContent = what + ' — Guardar y continuar: https://getreadystack.com/es/apps/cuadrante-turnos-descanso-12-horas-coste/';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return true;
  }
  function teamName() { return ($('team').value || '').trim() || 'Mi equipo'; }

  function save() {
    if (needPro('Guardar la semana') || !last) return;
    var d = data(), n = teamName(), t = d.teams[n] = d.teams[n] || { weeks: {} };
    t.weeks[last.week] = { week: last.week, grid: last.grid, rest: $('rest').value, maxDay: $('maxDay').value, annualHours: $('annualHours').value };
    store(d); drawHist(); $('keymsg').textContent = 'Semana del ' + C.fmtDate(last.week) + ' guardada en «' + n + '».';
  }
  function nextWeek() {
    if (needPro('Copiar a la semana siguiente') || !last) return;
    save();
    $('week').value = C.addDays(last.week, 7); run();
    $('keymsg').textContent = 'Semana del ' + C.fmtDate(last.week) + ' creada con los mismos turnos' + (last.chained ? ' y encadenada: el domingo → lunes ya se comprueba.' : '.');
  }
  function drawHist() {
    var d = data(), h = '';
    Object.keys(d.teams).forEach(function (n) {
      var wk = Object.keys(d.teams[n].weeks).sort().map(function (k) {
        var w = d.teams[n].weeks[k]; return { start: k, res: C.analyze(C.parseGrid(w.grid), { rest: w.rest, maxDay: w.maxDay, annualHours: w.annualHours }) };
      });
      var S = C.summary(wk);
      h += '<h3>' + esc(n) + ' · ' + wk.length + (wk.length === 1 ? ' semana' : ' semanas') + ' (' + wk.map(function (x) { return C.fmtDate(x.start).slice(0, 5); }).join(', ') + ')</h3><div class="tbl"><table><thead><tr><th>Persona</th><th>Semanas</th><th>Horas</th><th>Nocturnas</th><th>Coste</th><th>Avisos</th><th>14 días</th></tr></thead><tbody>';
      S.forEach(function (x) { h += '<tr><td>' + esc(x.name) + '</td><td>' + x.weeks + '</td><td>' + C.hdec(x.minutes) + '</td><td>' + C.hdec(x.night) + '</td><td>' + C.eur(x.cost) + '</td><td>' + x.issues + '</td><td>' + esc(x.alert || 'bien') + '</td></tr>'; });
      h += '</tbody></table></div>';
    });
    $('hist').innerHTML = h || '<p class="hint">Aún no hay semanas guardadas.</p>';
  }
  function download(name, text, type) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function slugify(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'equipo'; }
  function fileName(kind, ext) { return 'cuadrante-' + slugify(teamName()) + '-' + kind + '-' + (last ? last.week : 'semana') + '.' + ext; }

  function regSheet() {
    if (needPro('Las hojas de registro de jornada') || !last) return;
    var rows = C.registroRows(last.res, last.week), by = {}, h = '';
    rows.forEach(function (r) { (by[r.name] = by[r.name] || []).push(r); });
    Object.keys(by).forEach(function (n) {
      h += '<div class="sheet"><h3>Registro de jornada · ' + esc(n) + ' · ' + esc(teamName()) + ' · semana del ' + C.fmtDate(last.week) + '</h3><table><thead><tr><th>Fecha</th><th>Día</th><th>Horario previsto</th><th>Horas</th><th>Entrada real</th><th>Salida real</th><th>Firma</th></tr></thead><tbody>';
      by[n].forEach(function (r) { h += '<tr><td>' + r.date + '</td><td>' + r.day + '</td><td>' + esc(r.plan) + '</td><td>' + r.hours + '</td><td></td><td></td><td></td></tr>'; });
      h += '</tbody></table><p class="src">Registro diario de jornada con hora de inicio y fin (art. 34.9 ET). Consérvalo 4 años.</p></div>';
    });
    var s = $('regsheet'); s.innerHTML = h; s.hidden = false;
    doc.body.classList.add('print-reg'); window.print(); setTimeout(function () { doc.body.classList.remove('print-reg'); }, 1000);
  }
  function readFile(input, cb) { var f = input.files && input.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { cb(String(r.result)); input.value = ''; }; r.readAsText(f); }

  doc.addEventListener('DOMContentLoaded', function () {
    $('go').addEventListener('click', run);
    $('clear').addEventListener('click', function () { $('grid').value = 'Nombre\tContrato h/sem\t€/h\tLun\tMar\tMié\tJue\tVie\tSáb\tDom\n'; $('grid').focus(); });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-k]'), function (el) { el.addEventListener('change', run); });
    $('team').addEventListener('change', function () { if (pro) run(); });
    $('unlock').addEventListener('click', function () { unlock(($('key').value || '').trim()); });
    $('save').addEventListener('click', save);
    $('next').addEventListener('click', nextWeek);
    $('print').addEventListener('click', function () {
      if (needPro('Imprimir el cuadrante') || !last) return;
      var t = doc.createElement('p'); t.className = 'say printhead';
      t.innerHTML = '<b>' + esc(teamName()) + '</b> · cuadrante de la semana del ' + C.fmtDate(last.week);
      $('out').insertBefore(t, $('out').firstChild); doc.body.classList.add('print-rota'); window.print();
      setTimeout(function () { t.remove(); doc.body.classList.remove('print-rota'); }, 1000);
    });
    $('reg').addEventListener('click', regSheet);
    $('regcsv').addEventListener('click', function () { if (needPro('El registro en CSV') || !last) return; download(fileName('registro-jornada', 'csv'), C.registroCSV(last.res, last.week), 'text/csv;charset=utf-8'); });
    $('csv').addEventListener('click', function () { if (needPro('El CSV') || !last) return; download(fileName('gestoria', 'csv'), C.toCSV(last.res, last.week), 'text/csv;charset=utf-8'); });
    $('ics').addEventListener('click', function () { if (needPro('El .ics') || !last) return; var w = $('who').value; download(fileName(w ? slugify(w) : 'equipo', 'ics'), C.ics(last.res, last.week, w), 'text/calendar'); });
    $('backup').addEventListener('click', function () { if (needPro('La copia')) return; download('cuadrante-turnos-copia.json', JSON.stringify(data(), null, 1), 'application/json'); });
    $('restore').addEventListener('change', function () {
      if (needPro('Restaurar')) return;
      readFile($('restore'), function (txt) { try { var d = JSON.parse(txt); if (d && d.teams) { store(d); drawHist(); $('keymsg').textContent = 'Copia restaurada.'; } } catch (e) { $('keymsg').textContent = 'Ese archivo no es una copia válida.'; } });
    });
    var m = /[#&]k=([^&]+)/.exec(location.hash);
    var k = m ? decodeURIComponent(m[1]) : LS.getItem(K_KEY);
    if (k) { $('key').value = k; unlock(k, !m); }
    window.addEventListener('hashchange', function () { var h = /[#&]k=([^&]+)/.exec(location.hash); if (h) { $('key').value = decodeURIComponent(h[1]); unlock($('key').value); } });
    run();
  });
})();
