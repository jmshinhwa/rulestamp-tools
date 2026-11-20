/* planilha escala de trabalho — HTML do resultado (função pura: usada pela página e para gravar o exemplo estático). */
(function (root) {
  'use strict';
  var E = root.ESC || (typeof require !== 'undefined' ? require('./escala.js') : null);
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var ORD = ['6x1', '5x2', '12x36'];

  function resultado(v) {
    var c = E.comparar(v), cur = c[v.atual] || c['6x1'], R = E.REGIMES[v.regime] || E.REGIMES['42'];
    for (var i = 0; i < ORD.length; i++) if (c[ORD[i]].erro) return '<p class="err">' + esc(ORD[i] + ': ' + c[ORD[i]].erro) + '</p>';
    var M = cur.M, falhas = cur.checks.filter(function (x) { return !x.ok; });
    var h = '<h2 class="res-h">' + esc(v.atual) + ' em ' + esc(M.nome) + ': ' +
      (cur.extra > 0 ? '<b>' + E.brl(cur.extra) + '</b> de custo extra por funcionário' : '<b>R$ 0,00</b> de custo extra por funcionário') + '</h2>';
    var linha = [];
    if (cur.acimaSem) linha.push(E.fmtH(cur.semMin) + ' por semana passam ' + E.fmtH(cur.acimaSem) + ' do limite de ' + R.limite + 'h');
    if (!cur.checks[0].ok) linha.push('só ' + E.fmtDias(cur.folgasSem) + ' de folga por semana, e a EC 141/2026 exige 2 a partir de 16/12/2026');
    if (cur.intervalo) linha.push('intervalo curto: ' + E.brl(cur.intervalo) + ' de indenização');
    if (!linha.length) linha.push('dentro das regras do regime ' + R.nome);
    h += '<p class="res-l">' + esc(linha.join(' · ')) + '.</p>';
    h += '<table class="cmp"><thead><tr><th>Por funcionário · ' + R.limite + 'h</th>' + ORD.map(function (k) { return '<th class="' + (k === v.atual ? 'cur' : '') + '">' + k + (k === v.atual ? ' (atual)' : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
    function row(lbl, f, cls) { h += '<tr class="' + (cls || '') + '"><td>' + esc(lbl) + '</td>' + ORD.map(function (k) { return '<td class="' + (k === v.atual ? 'cur' : '') + '">' + f(c[k]) + '</td>'; }).join('') + '</tr>'; }
    row('Turno', function (x) { var t = E.turnoDe(v, x.escala); return esc(t.entrada + '–' + t.saida) + '<br><small>intervalo ' + x.turno.intervalo + ' min</small>'; });
    row('Horas por semana', function (x) { return E.fmtH(x.semMin) + (x.escala === '12x36' ? ' (média)' : ''); });
    row('Folgas por semana', function (x) { return (x.checks[0].ok ? '' : '✗ ') + E.fmtDias(x.folgasSem); });
    row('Acima de ' + R.limite + 'h/semana', function (x) { return x.acimaSem ? '✗ ' + E.fmtH(x.acimaSem) : '0h'; });
    row('Valor da hora', function (x) { return E.brl(x.hora) + ' <small>÷' + String(E.r2(x.divisor)).replace('.', ',') + '</small>'; });
    row('Hora extra 50%', function (x) { return E.brl(x.he); });
    row('DSR da hora extra', function (x) { return E.brl(x.dsr); });
    row('Intervalo indenizado', function (x) { return E.brl(x.intervalo); });
    row('Noturno 20%', function (x) { return E.brl(x.noturno); });
    row('Extra no mês', function (x) { return '<b>' + E.brl(x.extra) + '</b>'; }, 'tot');
    row('Horas no mês', function (x) { return E.fmtH(x.horasMes * 60); });
    row('Custo por hora', function (x) { return E.brl(x.custoHora); });
    row('Regras', function (x) { return x.ok ? '<span class="ok">✓ ok</span>' : '<span class="bad">✗ ' + x.checks.filter(function (y) { return !y.ok; }).length + ' alerta(s)</span>'; });
    h += '</tbody></table>';
    var tl = E.linhaDoTempo({ escala: cur.escala, entrada: E.turnoDe(v, cur.escala).entrada, saida: E.turnoDe(v, cur.escala).saida, intervalo: E.turnoDe(v, cur.escala).intervalo, salario: v.salario, mes: v.mes, acordo: v.acordo });
    h += '<p class="tl"><b>Hora extra por semana da sua ' + esc(cur.escala) + ':</b> ' + tl.map(function (t) {
      return esc(t.R.nome.split(' (')[0]) + ' → ' + E.fmtH(t.acimaSem) + ' = ' + E.brl(t.heSemana) + (t.folgasOk ? '' : ' ✗ folgas');
    }).join(' · ') + '</p>';
    if (falhas.length) h += '<ul class="alert">' + falhas.map(function (x) { return '<li>' + esc(x.txt) + '</li>'; }).join('') + '</ul>';
    h += '<p class="small">Mês de ' + M.dias + ' dias = ' + String(E.r2(M.dias / 7)).replace('.', ',') + ' semanas · DSR = hora extra × (' + M.domingos + ' domingos + ' + M.feriados + ' feriado(s)) ÷ ' + M.uteis + ' dias úteis.</p>';
    return h;
  }

  function gradeHTML(g, turnoTxt) {
    var h = '<table class="cal"><thead><tr>' + ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead><tbody><tr>';
    var lead = (g.dias[0].semana + 6) % 7;
    for (var i = 0; i < lead; i++) h += '<td class="vazio"></td>';
    g.dias.forEach(function (d) {
      var cls = (d.trab ? 't' : 'f') + (d.semana === 0 ? ' dom' : '') + (d.feriado ? ' fer' : '');
      h += '<td class="' + cls + '" title="' + esc(d.feriado) + '"><b>' + d.dia + '</b><span>' + (d.trab ? esc(turnoTxt) : 'FOLGA') + '</span>' + (d.feriado ? '<i>feriado</i>' : '') + '</td>';
      if (d.semana === 0 && d.dia < g.dias.length) h += '</tr><tr>';
    });
    h += '</tr></tbody></table>';
    h += '<p class="small"><b>' + g.trabalhados + '</b> dias de trabalho · <b>' + g.folgas + '</b> folgas · domingos de folga: <b>' + (g.domingosFolga.length ? g.domingosFolga.join(', ') : 'nenhum') + '</b> · feriados trabalhados: <b>' + g.feriadosTrab + '</b> · maior sequência sem folga: <b>' + g.maxSeguidos + (g.maxSeguidos === 1 ? ' dia' : ' dias') + '</b></p>';
    var al = [];
    if (!g.domingosFolga.length) al.push('Nenhuma folga no domingo neste mês: no comércio a folga precisa cair no domingo pelo menos 1 vez a cada 3 semanas (Lei 10.101/2000, art. 6º, parágrafo único).');
    if (g.maxSeguidos > 6) al.push('Mais de 6 dias seguidos sem folga: o repouso dado depois do 7º dia é pago em dobro (TST, OJ 410 da SDI-1).');
    if (g.feriadosTrab && g.escala !== '12x36') al.push(g.feriadosTrab + ' feriado(s) trabalhado(s): sem folga compensatória, o dia é pago em dobro (TST, Súmula 146).');
    if (al.length) h += '<ul class="alert">' + al.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    return h;
  }
  var VIEW = { resultado: resultado, gradeHTML: gradeHTML, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = VIEW; else root.VIEW = VIEW;
})(this);
