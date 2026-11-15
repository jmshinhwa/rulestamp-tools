/* planilha fiscal para autónomos · o livro .xlsx do Pro: Resumo · Recibos · Segurança Social · Ajustes (fórmulas vivas) */
(function (root) {
  'use strict';
  var NR = 400;
  function serial(iso) { var p = String(iso).split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5) + 25569; }
  function workbook(st, res) {
    var F = root.FISCAL || (typeof require !== 'undefined' ? require('./fiscal.js') : null), R = F.R, num = F.num;
    var B = 1, M = 2, P = 4, Y = 5, DT = 6;
    var A = 'Ajustes!$B$';
    var aj = st.aj || {};
    var ajustes = [
      [{ v: 'Ajustes (as células amarelas são suas)', s: B }, ''],
      ['Ano da planilha', { v: +st.ano || 2026, s: Y }],
      ['Início de atividade (1.º dia do mês)', { v: st.inicio ? serial(st.inicio + '-01') : '', s: DT }],
      ['Volume de negócios do ano anterior (€)', { v: num(st.vol_ant), s: M }],
      ['IVA no início do ano: isento / normal', { v: res.ivaEstado === 'normal' ? 'normal' : 'isento', s: Y }],
      ['Usa a dispensa de retenção do art. 101.º-B: sim / não', { v: st.dispensa === 'sim' ? 'sim' : 'não', s: Y }],
      ['Taxa de retenção na fonte (23 % ou 11,5 %)', { v: res.retRate, s: P }],
      ['Taxa da Segurança Social (21,4 % ou 25,2 %)', { v: res.rate, s: P }],
      ['IAS 2026 (Portaria 480-A/2025/1)', { v: R.IAS, s: M }],
      ['Limite de isenção de IVA (CIVA art. 53.º)', { v: R.ivaLimit, s: M }],
      ['Limite + 25 % (CIVA art. 58.º n.º 2 b)', { v: R.ivaHard, s: M }],
      ['Taxa normal de IVA (continente)', { v: R.ivaRate, s: P }],
      ['Lucro tributável do ano anterior, se tem contabilidade organizada (€)', { v: num(st.lucro_co), s: M }],
      ['Fontes: Código dos Regimes Contributivos e FAQ do ISS · CIVA arts. 53.º e 58.º · CIRS arts. 101.º e 101.º-B · lidas a 15/11/2026. Não é aconselhamento fiscal.', '']
    ];
    var hd = ['Data', 'Cliente', 'Valor sem IVA (€)', 'Tipo: serv / bens', 'Cliente com contabilidade organizada: sim / não', 'Ano', 'Acumulado do ano (€)', 'IVA a liquidar (€)', 'Retenção na fonte (€)']
      .map(function (h) { return { v: h, s: B }; });
    var rec = [hd], rows = (st.recibos || []).filter(function (r) { return num(r.valor) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.data); })
      .slice().sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    var byKey = {}; res.rows.forEach(function (x) { byKey[x.data + '|' + x.valor + '|' + x.cliente] = x; });
    for (var i = 0; i < NR; i++) {
      var n = i + 2, r = rows[i], x = r ? byKey[r.data + '|' + F.r2(num(r.valor)) + '|' + (r.cliente || '')] : null;
      var G = 'G' + n;
      rec.push([
        r ? { v: serial(r.data), s: DT } : { v: '', s: DT }, r ? (r.cliente || '') : '', r ? { v: F.r2(num(r.valor)), s: M } : { v: '', s: M },
        r ? (r.tipo === 'bens' ? 'bens' : 'serv') : '', r ? (r.empresa === 'nao' ? 'não' : 'sim') : '',
        { f: 'IF(A' + n + '="","",YEAR(A' + n + '))', v: r ? +r.data.slice(0, 4) : '' },
        { f: 'IF(OR(A' + n + '="",F' + n + '<>' + A + '2),"",SUMIFS($C$2:C' + n + ',$F$2:F' + n + ',' + A + '2))', v: x ? x.acum : '', s: M },
        { f: 'IF(OR(' + G + '="",' + A + '5<>"isento"),0,IF(' + G + '>' + A + '11,ROUND(C' + n + '*' + A + '12,2),0))', v: x ? x.iva : 0, s: M },
        { f: 'IF(OR(' + G + '="",E' + n + '<>"sim"),0,IF(AND(' + A + '6="sim",' + A + '4<' + A + '10,OR(Resumo!$B$6=0,A' + n + '<DATE(YEAR(Resumo!$B$6),MONTH(Resumo!$B$6)+1,1))),0,IF(C' + n + '*' + A + '7<25,0,ROUND(C' + n + '*' + A + '7,2))))', v: x ? x.ret : 0, s: M }
      ]);
    }
    var RA = 'Recibos!$A$2:$A$' + (NR + 1), RC = 'Recibos!$C$2:$C$' + (NR + 1), RD = 'Recibos!$D$2:$D$' + (NR + 1), RG = 'Recibos!$G$2:$G$' + (NR + 1);
    var ss = [[{ v: 'Declaração trimestral', s: B }, { v: 'Mês da declaração', s: B }, { v: 'Serviços dos 3 meses anteriores (€)', s: B }, { v: 'Vendas de bens (€)', s: B },
      { v: 'Rendimento relevante 70 % / 20 % (€)', s: B }, { v: 'Opção ±25 % (de 5 em 5)', s: B }, { v: 'Base mensal (€)', s: B }, { v: 'Contribuição por mês (€)', s: B }, { v: 'Paga nos meses', s: B }]];
    res.decls.forEach(function (d, k) {
      var n = k + 2, a = (+aj[d.key] || 0) / 100;
      ss.push([d.nome + ' (até ' + d.prazo + ')', { v: serial(d.y + '-' + (d.m < 10 ? '0' : '') + d.m + '-01'), s: DT },
        { f: 'SUMIFS(' + RC + ',' + RD + ',"serv",' + RA + ',">="&EDATE(B' + n + ',-3),' + RA + ',"<"&B' + n + ')', v: d.serv, s: M },
        { f: 'SUMIFS(' + RC + ',' + RD + ',"bens",' + RA + ',">="&EDATE(B' + n + ',-3),' + RA + ',"<"&B' + n + ')', v: d.bens, s: M },
        { f: 'ROUND(0.7*C' + n + '+0.2*D' + n + ',2)', v: d.rr, s: M }, { v: a, s: P },
        { f: 'MIN(ROUND(E' + n + '/3*(1+F' + n + '),2),ROUND(12*' + A + '9,2))', v: d.capped || !d.minimo ? d.base : F.r2(d.rr / 3 * (1 + a)), s: M },
        { f: 'MAX(20,ROUND(G' + n + '*' + A + '8,2))', v: d.contrib, s: M }, d.months.map(function (m) { return m.mes; }).join(', ')]);
    });
    ss.push(['Mínimo de 20 € por mês; base máxima 12 × IAS; isenção no 1.º ano de atividade não aplicada nesta folha (veja o ecrã).', '']);
    var resumo = [
      [{ v: 'Resumo do ano', s: B }, ''],
      ['Faturado no ano (€)', { f: 'SUMIFS(' + RC + ',Recibos!$F$2:$F$' + (NR + 1) + ',' + A + '2)', v: res.vol, s: M }],
      ['Falta para 15.000 € (€)', { f: 'MAX(0,' + A + '10-B2)', v: res.falta15, s: M }],
      ['Falta para 18.750 € (€)', { f: 'MAX(0,' + A + '11-B2)', v: res.falta1875, s: M }],
      ['Primeiro recibo acima de 15.000 € (regime normal de IVA a 1 de janeiro seguinte)', { f: 'IFERROR(MINIFS(' + RA + ',' + RG + ',">"&' + A + '10),0)', v: res.cross15 ? serial(res.cross15) : 0, s: DT }],
      ['Recibo que atinge 15.000 € (a dispensa de retenção cessa no mês seguinte)', { f: 'IFERROR(MINIFS(' + RA + ',' + RG + ',">="&' + A + '10),0)', v: res.cross15 ? serial(res.cross15) : 0, s: DT }],
      ['Primeiro recibo acima de 18.750 € (IVA devido a partir daí)', { f: 'IFERROR(MINIFS(' + RA + ',' + RG + ',">"&' + A + '11),0)', v: res.cross1875 ? serial(res.cross1875) : 0, s: DT }],
      ['IVA a liquidar nos recibos do ano (€)', { f: 'SUM(Recibos!$H$2:$H$' + (NR + 1) + ')', v: res.ivaDev, s: M }],
      ['Retenção na fonte do ano (€)', { f: 'SUM(Recibos!$I$2:$I$' + (NR + 1) + ')', v: res.ret, s: M }],
      ['Segurança Social do ano (3 × cada declaração de jan, abr, jul, out) (€)', { f: "3*SUM('Segurança Social'!$H$2:$H$5)", v: res.ssAno, s: 3 }],
      ['Declaração de janeiro seguinte: contribuição por mês (€)', { f: "'Segurança Social'!$H$6", v: res.next.contrib, s: 3 }],
      ['Contabilidade organizada: base mensal (1/12 do lucro, mínimo 1,5 × IAS) (€)', { f: 'IF(' + A + '13>0,MIN(ROUND(12*' + A + '9,2),MAX(ROUND(1.5*' + A + '9,2),ROUND(' + A + '13/12,2))),0)', v: res.co ? res.co.base : 0, s: M }],
      ['Contabilidade organizada: contribuição por mês (€)', { f: 'ROUND(B12*' + A + '8,2)', v: res.co ? res.co.contrib : 0, s: M }],
      ['Cálculo com os dados que escreve; não é aconselhamento fiscal. Recibos de Madeira e Açores, acumulação com trabalho por conta de outrem e pensionistas não são calculados aqui.', '']
    ];
    return [
      { name: 'Resumo', rows: resumo, widths: [78, 20] },
      { name: 'Recibos', rows: rec, widths: [12, 26, 16, 14, 22, 8, 18, 16, 18], freeze: 1 },
      { name: 'Segurança Social', rows: ss, widths: [44, 14, 18, 14, 20, 14, 14, 16, 52] },
      { name: 'Ajustes', rows: ajustes, widths: [70, 16] }
    ];
  }
  var api = { workbook: workbook, serial: serial };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PLANILHA = api;
})(this);
