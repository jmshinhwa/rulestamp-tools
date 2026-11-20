/* planilha escala de trabalho — tela. Cálculo em escala.js, HTML em view.js, .xlsx em xlsx.js. Dados só no localStorage. */
(function () {
  'use strict';
  var E = window.ESC, V = window.VIEW, X = window.XLSXW;
  var SLUG = 'planilha-escala-de-trabalho', DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  var K_LIC = 'pet_lic', K_DRAFT = 'pet_draft', K_TEAM = 'pet_team';
  var FIELDS = ['salario', 'regime', 'mes', 'atual', 'acordo', 'e6_ini', 'e6_fim', 'e6_int', 'e5_ini', 'e5_fim', 'e5_int', 'e12_ini', 'e12_fim', 'e12_int', 'folga1'];
  function $(id) { return document.getElementById(id); }
  function get(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* cheio ou bloqueado */ } }
  function esc(s) { return V.esc(s == null ? '' : s); }

  function meses(sel, val) {
    var h = '', y = 2026, m = 11;
    for (var i = 0; i < 26; i++) {
      var ym = y + '-' + (m < 10 ? '0' : '') + m;
      h += '<option value="' + ym + '"' + (ym === val ? ' selected' : '') + '>' + E.MESES[m - 1] + ' de ' + y + '</option>';
      m++; if (m > 12) { m = 1; y++; }
    }
    sel.innerHTML = h;
  }
  function valores() { var v = {}; FIELDS.forEach(function (f) { v[f] = $(f).value; }); return v; }
  function preencher(v) { FIELDS.forEach(function (f) { if (v[f] != null) $(f).value = v[f]; }); }

  function run() {
    var v = valores();
    put(K_DRAFT, v);
    $('out').innerHTML = V.resultado(v);
    var t = E.turnoDe(v, v.atual);
    var g = E.grade({ escala: v.atual, mes: v.mes, ancora: E.ancoraDoMes(v.mes, v.folga1) });
    $('gradeOut').innerHTML = '<h3>' + esc(v.atual + ' · ' + g.M.nome + ' · ' + t.entrada + '–' + t.saida) + '</h3>' + V.gradeHTML(g, t.entrada + '–' + t.saida);
  }

  /* ---------- licença ---------- */
  function proAtivo() { return !!get(K_LIC, ''); }
  function openPro(k) { put(K_LIC, k); $('proApp').hidden = false; $('chaveMsg').textContent = ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-escala-de-trabalho/'; pro(); }
  function checkKey(k) {
    k = String(k || '').trim(); if (!k) return Promise.resolve(false);
    $('chaveMsg').textContent = 'Conferindo…';
    var i = 0;
    function next() {
      if (i >= DOORS.length) { $('chaveMsg').textContent = 'Chave não reconhecida para este app.'; return Promise.resolve(false); }
      var door = DOORS[i++];
      return fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door))
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) { openPro(k); return true; } return next(); })
        .catch(function () { return next(); });
    }
    return next();
  }

  /* ---------- Pro: equipe ---------- */
  function team() {
    var d = get(K_TEAM, null);
    if (!d || !d.pessoas) {
      var v = valores(), t = E.turnoDe(v, v.atual);
      d = { mes: v.mes, regime: v.regime, acordo: v.acordo, pessoas: [
        { nome: 'Funcionário 1', escala: v.atual, entrada: t.entrada, saida: t.saida, intervalo: t.intervalo, salario: v.salario, ancora: E.ancoraDoMes(v.mes, v.folga1) }] };
    }
    return d;
  }
  function saveTeam(d) { put(K_TEAM, d); }
  function teamTable(d) {
    var h = '<thead><tr><th>Nome</th><th>Escala</th><th>Entrada</th><th>Saída</th><th>Intervalo</th><th>Salário (R$)</th><th>Uma data de folga</th><th></th></tr></thead><tbody>';
    d.pessoas.forEach(function (p, i) {
      h += '<tr data-i="' + i + '"><td><input data-f="nome" value="' + esc(p.nome) + '"></td><td><select data-f="escala">' +
        ['6x1', '5x2', '12x36', '4x3'].map(function (k) { return '<option' + (k === p.escala ? ' selected' : '') + '>' + k + '</option>'; }).join('') +
        '</select></td><td><input data-f="entrada" size="5" value="' + esc(p.entrada) + '"></td><td><input data-f="saida" size="5" value="' + esc(p.saida) + '"></td>' +
        '<td><input data-f="intervalo" size="4" value="' + esc(p.intervalo) + '"></td><td><input data-f="salario" size="8" value="' + esc(p.salario) + '"></td>' +
        '<td><input data-f="ancora" type="date" value="' + esc(p.ancora) + '"></td><td><button type="button" class="ghost" data-del="' + i + '">×</button></td></tr>';
    });
    $('pTeam').innerHTML = h + '</tbody>';
  }
  function lerTeam(d) {
    Array.prototype.forEach.call($('pTeam').querySelectorAll('tr[data-i]'), function (tr) {
      var p = d.pessoas[+tr.getAttribute('data-i')];
      Array.prototype.forEach.call(tr.querySelectorAll('[data-f]'), function (el) { p[el.getAttribute('data-f')] = el.value; });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.ancora).slice(0, 10))) p.ancora = d.mes + '-01';
      p.ancora = String(p.ancora).slice(0, 10);
    });
    d.mes = $('pMes').value; d.regime = $('regime').value; d.acordo = $('acordo').value;
    return d;
  }
  var ultimo = null;
  function gerar() {
    var d = lerTeam(team()); saveTeam(d);
    var q = E.equipe(d.pessoas, d.mes, d.regime || '42', d.acordo || 'sim');
    ultimo = q;
    var M = q.M, h = '<h3>' + esc(M.nome) + ' · ' + d.pessoas.length + ' pessoa(s) · custo extra da equipe: ' + E.brl(q.totalExtra) + '</h3>';
    h += '<table class="quadro"><thead><tr><th>Funcionário</th>' + M.lista.map(function (x) { return '<th class="' + (x.semana === 0 ? 'dom' : '') + (x.feriado ? ' fer' : '') + '">' + x.dia + '<br>' + E.SEM[x.semana] + '</th>'; }).join('') + '<th>Extra</th><th>Alertas</th></tr></thead><tbody>';
    q.linhas.forEach(function (l) {
      h += '<tr><td>' + esc(l.p.nome) + '<br><small>' + esc(l.p.escala + ' ' + l.p.entrada + '–' + l.p.saida) + '</small></td>' +
        l.g.dias.map(function (x) { return '<td class="' + (x.trab ? 't' : 'f') + (x.semana === 0 ? ' dom' : '') + '">' + (x.trab ? 'T' : 'F') + '</td>'; }).join('') +
        '<td>' + (l.a.erro ? '' : E.brl(l.a.extra)) + '</td><td class="al">' + esc(l.a.erro || l.a.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.txt; }).join(' · ') || 'ok') +
        (l.g.domingosFolga.length ? '' : ' · nenhum domingo de folga') + '</td></tr>';
    });
    h += '<tr class="cob"><td>Trabalhando</td>' + q.cob.map(function (n) { return '<td>' + n + '</td>'; }).join('') + '<td></td><td></td></tr></tbody></table>';
    $('pOut').innerHTML = h;
  }
  function baixar(nome, data, tipo) {
    var b = new Blob([data], { type: tipo }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function pro() {
    var d = team();
    meses($('pMes'), d.mes);
    teamTable(d); gerar();
  }
  function wirePro() {
    $('pAdd').onclick = function () {
      var d = lerTeam(team()), last = d.pessoas[d.pessoas.length - 1] || {};
      var anc = last.ancora ? new Date(Date.UTC(+last.ancora.slice(0, 4), +last.ancora.slice(5, 7) - 1, +last.ancora.slice(8, 10) + 1)).toISOString().slice(0, 10) : d.mes + '-01';
      d.pessoas.push({ nome: 'Funcionário ' + (d.pessoas.length + 1), escala: last.escala || '5x2', entrada: last.entrada || '09:00', saida: last.saida || '18:00', intervalo: last.intervalo || 60, salario: last.salario || 2200, ancora: anc });
      saveTeam(d); teamTable(d); gerar();
    };
    $('pTeam').addEventListener('click', function (e) {
      var i = e.target.getAttribute && e.target.getAttribute('data-del'); if (i == null) return;
      var d = lerTeam(team()); d.pessoas.splice(+i, 1); saveTeam(d); teamTable(d); gerar();
    });
    $('pTeam').addEventListener('change', gerar);
    $('pMes').onchange = gerar;
    $('pGerar').onclick = gerar;
    $('pProx').onclick = function () { var d = lerTeam(team()); d.mes = E.proximoMes(d.mes); saveTeam(d); meses($('pMes'), d.mes); gerar(); };
    $('pXlsx').onclick = function () { gerar(); baixar('escala-de-trabalho-' + ultimo.M.ym + '.xlsx', X.build(ultimo.sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); };
    $('pCsv').onclick = function () { gerar(); baixar('escala-de-trabalho-' + ultimo.M.ym + '.csv', '﻿' + E.csv(ultimo.sheets[0].rows) + '\r\n\r\n' + E.csv(ultimo.sheets[1].rows), 'text/csv;charset=utf-8'); };
    $('pPrint').onclick = function () { gerar(); document.body.classList.add('printing'); window.print(); setTimeout(function () { document.body.classList.remove('printing'); }, 500); };
    $('pBackup').onclick = function () { baixar('escala-equipe.json', JSON.stringify(lerTeam(team()), null, 1), 'application/json'); };
    $('pRestore').onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (t) { try { var j = JSON.parse(t); if (j && j.pessoas) { saveTeam(j); pro(); } } catch (e) { $('pOut').innerHTML = '<p class="err">Arquivo de cópia inválido.</p>'; } });
    };
  }

  /* ---------- início ---------- */
  meses($('mes'), '2027-01');
  var dr = get(K_DRAFT, null); if (dr) preencher(dr);
  run();
  $('calcular').onclick = run;
  $('exemplo').onclick = function () { preencher(E.EXEMPLO); run(); };
  FIELDS.forEach(function (f) { $(f).addEventListener('change', run); });
  wirePro();
  $('chaveOk').onclick = function () { checkKey($('chave').value); };
  function hashKey() { var h = /#k=([^&]+)/.exec(location.hash || ''); if (h) checkKey(decodeURIComponent(h[1])); }
  window.addEventListener('hashchange', hashKey);
  if (/#k=/.test(location.hash || '')) hashKey();
  else if (proAtivo()) { $('proApp').hidden = false; $('chaveMsg').textContent = ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-escala-de-trabalho/'; pro(); }
})();
