/* automatización LinkedIn — página (usa engine.js = window.LI) */
(function () {
  'use strict';
  var doc = document, LS = window.localStorage, L = window.LI;
  var SLUG = 'automatizacion-linkedin', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var K_IN = 'li_auto_in_v1', K_KEY = 'li_auto_key_v1', K_DATA = 'li_auto_data_v1';
  var FIELDS = ['contacts', 'cap', 'days', 'start', 'acc', 'rep', 'meet', 'lag', 'm1', 'f1', 'f2', 'wd', 'deal', 'close', 'stack', 'cur'];
  var pro = false, last = null;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fdate(s) { var M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], D = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    var p = s.split('-'); return D[L.dow(s)] + ' ' + (+p[2]) + ' ' + M[+p[1] - 1]; }
  function read() { var o = {}; FIELDS.forEach(function (k) { o[k] = $(k).value; }); return o; }
  function write(o) { FIELDS.forEach(function (k) { if (o[k] != null && o[k] !== '') $(k).value = o[k]; }); }
  function n(x) { return L.fmt(x); }

  function render() {
    var inp = read(), p = L.plan(inp, today()), o = p.inp, m = function (x) { return L.money(x, o.cur); };
    if (!$('start').value) $('start').value = o.start;
    try { LS.setItem(K_IN, JSON.stringify(inp)); } catch (e) {}
    last = p;
    var h = '';
    h += '<div class="big"><div><b>' + n(p.meetings) + '</b><span>reuniones de ' + n(o.contacts) + ' contactos</span></div>';
    h += '<div><b>' + n(p.weeksToCover) + '</b><span>semanas para invitar a toda tu lista</span></div>';
    h += '<div><b>' + n(p.perDay) + '</b><span>invitaciones al día, como máximo</span></div></div>';
    h += '<div class="loss">Una semana con las invitaciones restringidas: <b>' + m(p.lostWeek) + '</b> de negocio perdido (' + L.fmt(p.weekMeet, 2) + ' reuniones × ' + L.pct(o.close) + ' × ' + m(o.deal) + ')</div>';
    h += '<div class="tbl"><table class="sum">';
    h += '<tr><td>Aceptan tu invitación</td><td>' + n(p.accepted) + '</td></tr>';
    h += '<tr><td>Invitaciones a retirar a los ' + o.wd + ' días</td><td>' + n(p.withdrawals) + '</td></tr>';
    h += '<tr><td>Mensajes que escribes (' + n(p.accepted) + ' primeros + ' + n(p.followups) + ' seguimientos)</td><td>' + n(p.messages) + '</td></tr>';
    h += '<tr><td>Responden</td><td>' + n(p.replied) + '</td></tr>';
    h += '<tr><td>Negocio esperado (' + n(p.meetings) + ' reuniones × ' + L.pct(o.close) + ' × ' + m(o.deal) + ')</td><td>' + m(p.pipeline) + '</td></tr>';
    h += '<tr><td>Herramientas por reunión (' + m(o.stack) + ' al mes × ' + p.weeksToCover + ' semanas)</td><td>' + (p.costPerMeeting == null ? '—' : m(p.costPerMeeting)) + '</td></tr>';
    h += '<tr><td>Del primer envío al último paso</td><td>' + n(p.days) + ' días</td></tr>';
    h += '</table></div>';
    h += '<h3>Semana a semana</h3><div class="tbl"><table><tr><th>Semana del</th><th>Invitar</th><th>1.er mensaje</th><th>Seguimientos</th><th>Retirar</th><th>Respuestas</th></tr>';
    p.weeks.forEach(function (w) { h += '<tr><td>' + fdate(w.week) + '</td><td>' + w.invites + '</td><td>' + w.msg1 + '</td><td>' + w.fu + '</td><td>' + w.withdraw + '</td><td>' + w.replies + '</td></tr>'; });
    var after = p.agenda.filter(function (d) { return L.monday(d.date) > p.weeks[p.weeks.length - 1].week; });
    if (after.length) { var s = { msg1: 0, fu: 0, withdraw: 0, replies: 0 }; after.forEach(function (d) { s.msg1 += d.msg1; s.fu += d.fu; s.withdraw += d.withdraw; s.replies += d.replies; });
      h += '<tr><td>después, hasta ' + fdate(p.last) + '</td><td>0</td><td>' + s.msg1 + '</td><td>' + s.fu + '</td><td>' + s.withdraw + '</td><td>' + s.replies + '</td></tr>'; }
    h += '</table></div>';
    h += '<details><summary>Día a día (' + p.agenda.length + ' días con tareas)</summary><div class="tbl"><table><tr><th>Día</th><th>Invitar</th><th>1.er mensaje</th><th>Seguimientos</th><th>Retirar</th><th>Respuestas</th></tr>';
    p.agenda.forEach(function (d) { h += '<tr><td>' + fdate(d.date) + '</td><td>' + d.invites + '</td><td>' + d.msg1 + '</td><td>' + d.fu + '</td><td>' + d.withdraw + '</td><td>' + d.replies + '</td></tr>'; });
    h += '</table></div></details>';
    $('out').innerHTML = h;
    if (pro) drawPro();
    return p;
  }

  /* ---- clave Pro ---- */
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
    $('keymsg').textContent = 'Comprobando tu clave…';
    check(key).then(function (ok) {
      if (ok) { setPro(true); try { LS.setItem(K_KEY, key); } catch (e) {} $('keymsg').textContent = ' — Guardar y continuar: https://getreadystack.com/es/apps/automatizacion-linkedin/'; }
      else $('keymsg').textContent = quiet ? '' : 'Esa clave no vale para este producto.';
    });
  }
  function setPro(v) { pro = v; doc.body.classList.toggle('is-pro', v); if (v) drawPro(); }
  function needPro(what) {
    if (pro) return false;
    $('keymsg').textContent = what + ' — Guardar y continuar: https://getreadystack.com/es/apps/automatizacion-linkedin/';
    $('pro').scrollIntoView({ behavior: 'smooth' }); return true;
  }

  /* ---- datos Pro (solo en este navegador) ---- */
  function data() {
    var d; try { d = JSON.parse(LS.getItem(K_DATA) || 'null'); } catch (e) { d = null; }
    if (!d || !d.camps) d = { cur: 'c1', camps: { c1: { name: 'Mi campaña', contacts: [], tpl: {} } } };
    return d;
  }
  function save(d) { try { LS.setItem(K_DATA, JSON.stringify(d)); } catch (e) { $('listmsg').textContent = 'No se pudo guardar (almacenamiento lleno).'; } }
  function camp(d) { return d.camps[d.cur] || d.camps[Object.keys(d.camps)[0]]; }
  var TPL = ['t_inv', 't_m1', 't_f1', 't_f2'];
  function loadTpl(c) { TPL.forEach(function (k) { if (c.tpl && c.tpl[k] != null) $(k).value = c.tpl[k]; }); counts(); }
  function counts() { var x = $('t_inv').value.length, s = doc.querySelector('.cnt[data-for="t_inv"]'); s.textContent = x + ' / 200'; s.classList.toggle('over', x > 200); }

  function drawPro() {
    var d = data(), c = camp(d), t = $('today').value || today();
    $('camp').innerHTML = Object.keys(d.camps).map(function (k) { return '<option value="' + k + '"' + (k === d.cur ? ' selected' : '') + '>' + esc(d.camps[k].name) + ' (' + d.camps[k].contacts.length + ')</option>'; }).join('');
    if (c.inp) { /* la campaña recuerda sus números */ }
    var q = L.queue(c.contacts, read(), t), tp = {};
    TPL.forEach(function (k) { tp[k] = $(k).value; });
    function block(title, list, act, tplKey, extra) {
      var h = '<div class="qb"><h4>' + title + ' <span>' + list.length + '</span></h4>';
      if (extra) h += '<p class="hint">' + extra + '</p>';
      if (!list.length) return h + '<p class="hint">Nada hoy.</p></div>';
      h += '<ul>';
      list.forEach(function (x) {
        var ix = c.contacts.indexOf(x), msg = tplKey ? L.fill(tp[tplKey], x) : '';
        h += '<li><div class="who"><b>' + esc(x.nombre) + '</b> ' + esc([x.cargo, x.empresa].filter(Boolean).join(' · ')) + (x.url ? ' <a href="' + esc(x.url) + '" target="_blank" rel="noopener">perfil</a>' : '') + '</div>';
        if (msg) h += '<div class="msg">' + esc(msg) + ' <button class="btn ghost sm" data-copy="' + esc(msg) + '">Copiar</button></div>';
        h += '<div class="acts">' + act.map(function (a) { return '<button class="btn sm' + (a[2] ? ' ghost' : '') + '" data-ix="' + ix + '" data-mk="' + a[0] + '">' + a[1] + '</button>'; }).join(' ') + '</div></li>';
      });
      return h + '</ul></div>';
    }
    var h = '';
    h += block('Invitar', q.invite, [['invited', 'Invitada'], ['out', 'Descartar', 1]], 't_inv', 'Te quedan ' + q.weekLeft + ' de tu tope esta semana; hoy toca ' + q.quota + '.');
    h += block('Primer mensaje', q.msg1, [['msg1', 'Enviado'], ['replied', 'Respondió', 1], ['meeting', 'Reunión', 1]], 't_m1');
    h += block('Seguimiento 1', q.fu1, [['fu1', 'Enviado'], ['replied', 'Respondió', 1], ['meeting', 'Reunión', 1]], 't_f1');
    h += block('Seguimiento 2', q.fu2, [['fu2', 'Enviado'], ['replied', 'Respondió', 1], ['meeting', 'Reunión', 1], ['out', 'Cerrar', 1]], 't_f2');
    h += block('Retirar invitación', q.withdraw, [['withdrawn', 'Retirada'], ['accepted', 'Aceptó', 1]], null, 'Pendientes desde hace ' + L.norm(read()).wd + ' días o más. Podrás volver a invitarlas a las 3 semanas.');
    $('queue').innerHTML = h;
    var s = L.stats(c.contacts), o = L.norm(read());
    function cmp(real, planned) { return real == null ? '<td>—</td><td>' + L.pct(planned) + '</td>' : '<td><b>' + L.pct(real) + '</b></td><td>' + L.pct(planned) + '</td>'; }
    $('stats').innerHTML = '<div class="tbl"><table><tr><th></th><th>Tu real</th><th>Plan</th></tr><tr><td>Aceptan (' + s.accepted + ' de ' + s.invited + ')</td>' + cmp(s.accRate, o.acc) + '</tr><tr><td>Responden (' + s.replied + ' de ' + s.accepted + ')</td>' + cmp(s.repRate, o.rep) + '</tr><tr><td>Reunión (' + s.meetings + ' de ' + s.replied + ')</td>' + cmp(s.meetRate, o.meet) + '</tr></table></div>' +
      (s.invited >= 20 ? '<p class="btns"><button id="userates" class="btn ghost sm">Usar mis tasas reales en el plan</button></p>' : '<p class="hint">Con 20 invitaciones marcadas podrás pasar tus tasas reales al plan.</p>');
    var st = function (x) { return x.meeting ? 'reunión' : x.replied ? 'respondió' : x.out ? 'descartado' : x.withdrawn ? 'retirada' : x.fu2 ? 'seguimiento 2' : x.fu1 ? 'seguimiento 1' : x.msg1 ? 'mensaje 1' : x.accepted ? 'aceptó' : x.invited ? 'invitada' : 'en lista'; };
    $('list').innerHTML = c.contacts.length ? '<div class="tbl"><table><tr><th>Nombre</th><th>Empresa</th><th>Estado</th><th>Invitada</th><th></th></tr>' + c.contacts.map(function (x, i) {
      return '<tr><td>' + esc(x.nombre) + '</td><td>' + esc(x.empresa) + '</td><td>' + st(x) + '</td><td>' + (x.invited || '') + '</td><td><button class="btn ghost sm" data-ix="' + i + '" data-mk="accepted">Aceptó</button> <button class="btn ghost sm" data-del="' + i + '">Quitar</button></td></tr>'; }).join('') + '</table></div>' : '<p class="hint">Tu lista está vacía: pega o importa contactos en el paso 1.</p>';
  }
  function addContacts(text) {
    if (needPro('Guardar tu lista')) return;
    var d = data(), c = camp(d), got = L.parseContacts(text), have = {}, added = 0;
    c.contacts.forEach(function (x) { have[(x.url || (x.nombre + '|' + x.empresa)).toLowerCase()] = 1; });
    got.forEach(function (x) { var k = (x.url || (x.nombre + '|' + x.empresa)).toLowerCase(); if (!have[k]) { c.contacts.push(x); have[k] = 1; added++; } });
    save(d); $('listmsg').textContent = added + ' añadidos · ' + (got.length - added) + ' ya estaban · ' + c.contacts.length + ' en la lista.';
    drawPro();
  }
  function dl(name, text, type) { var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; doc.body.appendChild(a); a.click(); a.remove(); }
  function readFile(inp, cb) { var f = inp.files && inp.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { cb(String(r.result)); inp.value = ''; }; r.readAsText(f); }

  doc.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.copy != null) { if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copiado'; return; }
    if (b.dataset.mk) { var d = data(), c = camp(d), x = c.contacts[+b.dataset.ix]; if (!x) return; L.mark(x, b.dataset.mk, $('today').value || today()); save(d); drawPro(); return; }
    if (b.dataset.del) { var d2 = data(); camp(d2).contacts.splice(+b.dataset.del, 1); save(d2); drawPro(); return; }
    if (b.id === 'userates') { var s = L.stats(camp(data()).contacts); if (s.accRate != null) $('acc').value = s.accRate; if (s.repRate != null) $('rep').value = s.repRate; if (s.meetRate != null) $('meet').value = s.meetRate; render(); }
  });
  FIELDS.forEach(function (k) { $(k).addEventListener('input', render); $(k).addEventListener('change', render); });
  $('run').onclick = render;
  $('sample').onclick = function () { FIELDS.forEach(function (k) { $(k).value = k === 'start' ? '' : L.DEF[k]; }); render(); };
  $('unlock').onclick = function () { unlock($('key').value.trim()); };
  $('addlist').onclick = function () { addContacts($('paste').value); $('paste').value = ''; };
  $('csvfile').onchange = function () { var me = this; if (needPro('Importar un CSV')) { me.value = ''; return; } readFile(me, addContacts); };
  $('jsonfile').onchange = function () { var me = this; if (needPro('Cargar una copia')) { me.value = ''; return; } readFile(me, function (t) { try { var d = JSON.parse(t); if (d && d.camps) { save(d); drawPro(); $('listmsg').textContent = 'Copia cargada.'; } } catch (e) { $('listmsg').textContent = 'Ese archivo no es una copia de este planificador.'; } }); };
  $('newcamp').onclick = function () { if (needPro('Crear campañas')) return; var d = data(), id = 'c' + Date.now(); d.camps[id] = { name: $('campname').value.trim() || 'Campaña ' + (Object.keys(d.camps).length + 1), contacts: [], tpl: {} }; d.cur = id; save(d); $('campname').value = ''; drawPro(); };
  $('delcamp').onclick = function () { if (needPro('Borrar campañas')) return; var d = data(); if (Object.keys(d.camps).length < 2) return; delete d.camps[d.cur]; d.cur = Object.keys(d.camps)[0]; save(d); loadTpl(camp(d)); drawPro(); };
  $('camp').onchange = function () { var d = data(); d.cur = this.value; save(d); loadTpl(camp(d)); drawPro(); };
  TPL.forEach(function (k) { $(k).addEventListener('input', function () { counts(); if (!pro) return; var d = data(); camp(d).tpl[k] = $(k).value; save(d); drawPro(); }); });
  $('today').onchange = function () { if (pro) drawPro(); };
  $('ics').onclick = function () { if (needPro('El calendario .ics')) return; dl('prospeccion-linkedin.ics', L.ics(last || render(), camp(data()).name), 'text/calendar'); };
  $('csv').onclick = function () { if (needPro('El CSV')) return; dl('contactos-linkedin.csv', L.toCSV(camp(data()).contacts), 'text/csv'); };
  $('json').onclick = function () { if (needPro('La copia JSON')) return; dl('planificador-linkedin.json', JSON.stringify(data(), null, 1), 'application/json'); };

  try { var saved = JSON.parse(LS.getItem(K_IN) || 'null'); if (saved) write(saved); } catch (e) {}
  $('today').value = today();
  loadTpl(camp(data()));
  render();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { unlock(decodeURIComponent(hk[1])); history.replaceState(null, '', location.pathname); }
  else { try { var sk = LS.getItem(K_KEY); if (sk) unlock(sk, true); } catch (e) {} }
})();
