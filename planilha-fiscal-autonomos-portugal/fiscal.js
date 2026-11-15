/* planilha fiscal para autónomos · motor de cálculo (Portugal, trabalhadores independentes a recibos verdes)
   Fontes (lidas a 15/11/2026):
   - Segurança Social: Código dos Regimes Contributivos (Lei 110/2009) e Perguntas Frequentes do ISS sobre o regime dos TI —
     rendimento relevante = 70 % dos serviços + 20 % das vendas de bens dos 3 meses anteriores; base mensal = 1/3, no mês da
     declaração e nos dois seguintes; opção ±25 % em intervalos de 5 %; mínimo 20 € de contribuição; máximo 12 × IAS;
     taxa 21,4 % (ENI/EIRL 25,2 %); pagamento entre o dia 10 e o dia 20 do mês seguinte; declaração até ao último dia de
     janeiro, abril, julho e outubro; 1.º enquadramento produz efeitos no 1.º dia do 12.º mês após o início de atividade;
     contabilidade organizada: 1/12 do lucro tributável, mínimo 1,5 × IAS.
   - IAS 2026 = 537,13 € (Portaria n.º 480-A/2025/1, de 30 de dezembro).
   - CIVA art. 53.º n.º 1 (isenção até 15 000 € no ano anterior) e art. 58.º n.os 2 e 4 (> 15 000 € → regime normal a 1 de janeiro
     seguinte; excedido em mais de 25 % no ano em curso → imposto devido a partir desse momento). Taxa normal 23 % (continente).
   - CIRS art. 101.º n.º 1 b) 23 % (atividades da tabela do art. 151.º) e c) 11,5 %; n.º 4 (antes do IVA);
     art. 101.º-B n.º 1 a) e d), n.º 3 (dispensa abaixo do limite do art. 53.º; cessa no mês seguinte ao que o atinge; < 25 €). */
(function (root) {
  'use strict';
  var R = {
    IAS: 537.13, ssRate: 0.214, ssRateEni: 0.252, coefServ: 0.70, coefBens: 0.20, minContrib: 20,
    capIas: 12, coMinIas: 1.5, ivaLimit: 15000, ivaHard: 18750, ivaRate: 0.23, retMin: 25
  };
  var MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[€\s]/g, '');
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isFinite(n) ? n : 0;
  }
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function eur(x) {
    var neg = x < 0, s = Math.abs(r2(x)).toFixed(2).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + s[0] + ',' + s[1] + ' €';
  }
  function ym(iso) { var p = String(iso || '').split('-'); return { y: +p[0] || 0, m: +p[1] || 0, d: +p[2] || 1 }; }
  function mIdx(y, m) { return y * 12 + (m - 1); }            // índice de mês absoluto
  function fromIdx(i) { return { y: Math.floor(i / 12), m: (i % 12) + 1 }; }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function fdate(y, m, d) { return (d < 10 ? '0' : '') + d + '/' + (m < 10 ? '0' : '') + m + '/' + y; }

  function sorted(recs) {
    return (recs || []).map(function (r, i) {
      var v = num(r.valor), t = r.tipo === 'bens' ? 'bens' : 'serv';
      return { i: i, data: r.data || '', cliente: r.cliente || '', valor: r2(v), tipo: t, empresa: r.empresa !== 'nao' };
    }).filter(function (r) { return r.valor > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.data); })
      .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : a.i - b.i; });
  }

  // Declaração trimestral feita no mês "decl" (índice absoluto): rendimentos dos 3 meses anteriores
  function declaracao(recs, declIdx, aj, rate, effIdx) {
    var serv = 0, bens = 0, n = 0;
    recs.forEach(function (r) { var d = ym(r.data), k = mIdx(d.y, d.m); if (k >= declIdx - 3 && k < declIdx) { n++; if (r.tipo === 'bens') bens += r.valor; else serv += r.valor; } });
    serv = r2(serv); bens = r2(bens);
    var rr = r2(R.coefServ * serv + R.coefBens * bens);
    var base0 = rr / 3, base = r2(base0 * (1 + aj / 100)), cap = r2(R.capIas * R.IAS), capped = false;
    if (base > cap) { base = cap; capped = true; }
    var c = r2(base * rate), minimo = false;
    if (c < R.minContrib) { c = R.minContrib; base = r2(R.minContrib / rate); minimo = true; }
    var D = fromIdx(declIdx), months = [];
    for (var j = 0; j < 3; j++) {
      var mi = declIdx + j, M = fromIdx(mi), P = fromIdx(mi + 1), isento = effIdx != null && mi < effIdx;
      months.push({ y: M.y, m: M.m, mes: MES[M.m - 1] + ' de ' + M.y, valor: isento ? 0 : c, isento: isento, pagar: 'de 10 a 20/' + (P.m < 10 ? '0' : '') + P.m + '/' + P.y });
    }
    var from = fromIdx(declIdx - 3), to = fromIdx(declIdx - 1);
    return {
      idx: declIdx, y: D.y, m: D.m, nome: 'Declaração de ' + MES[D.m - 1] + ' de ' + D.y, prazo: fdate(D.y, D.m, lastDay(D.y, D.m)),
      periodo: MES[from.m - 1] + '–' + MES[to.m - 1] + ' de ' + to.y, n: n, serv: serv, bens: bens, rr: rr, base: base, aj: aj,
      contrib: c, minimo: minimo, capped: capped, months: months
    };
  }

  function compute(st) {
    var Y = +st.ano || 2026, recs = sorted(st.recibos);
    var rate = st.taxa_ss === '25.2' ? R.ssRateEni : R.ssRate;
    var aj = st.aj || {};
    var ini = ym(st.inicio ? st.inicio + '-01' : ''), effIdx = ini.y ? mIdx(ini.y, ini.m) + 12 : null;
    // 5 declarações: jan/abr/jul/out do ano + janeiro do ano seguinte (que fecha o 4.º trimestre)
    var decls = [[Y, 1, 'jan'], [Y, 4, 'abr'], [Y, 7, 'jul'], [Y, 10, 'out'], [Y + 1, 1, 'jan2']].map(function (q) {
      var a = +aj[q[2]] || 0; a = Math.max(-25, Math.min(25, Math.round(a / 5) * 5));
      var d = declaracao(recs, mIdx(q[0], q[1]), a, rate, effIdx); d.key = q[2]; return d;
    });
    var ssAno = 0; decls.slice(0, 4).forEach(function (d) { d.months.forEach(function (m) { ssAno += m.valor; }); }); ssAno = r2(ssAno);

    // IVA (art. 53.º / 58.º) e retenção (art. 101.º / 101.º-B) — volume do ano Y, recibo a recibo
    var volAnt = num(st.vol_ant), isentoIni = st.iva !== 'normal' && volAnt <= R.ivaLimit;
    var retRate = st.ret_taxa === '11.5' ? 0.115 : 0.23;
    var dispOk = st.dispensa === 'sim' && volAnt < R.ivaLimit;
    var cum = 0, cross15 = null, cross1875 = null, dispFimIdx = null, rows = [], ivaDev = 0, ret = 0, retPerdida = 0, vol = 0;
    recs.forEach(function (r) {
      var d = ym(r.data); if (d.y !== Y) return;
      var k = mIdx(d.y, d.m), before = cum; cum = r2(cum + r.valor); vol = cum;
      var row = { data: r.data, cliente: r.cliente, valor: r.valor, tipo: r.tipo, empresa: r.empresa, acum: cum, iva: 0, ret: 0, nota: '' };
      if (isentoIni) {
        if (cross15 === null && cum > R.ivaLimit) { cross15 = r.data; row.nota = 'passa 15.000 €: regime normal de IVA a 01/01/' + (Y + 1); }
        if (cross1875 === null && cum > R.ivaHard) { cross1875 = r.data; row.nota = 'passa 18.750 €: IVA devido a partir deste recibo'; }
        if (cross1875 !== null) { row.iva = r2(r.valor * R.ivaRate); ivaDev = r2(ivaDev + row.iva); }
      }
      if (dispOk && dispFimIdx === null && before < R.ivaLimit && cum >= R.ivaLimit) dispFimIdx = k + 1;  // cessa no mês seguinte
      if (r.empresa) {
        var disp = dispOk && (dispFimIdx === null || k < dispFimIdx);
        var v = r2(r.valor * retRate);
        if (disp) row.ret = 0; else if (v < R.retMin) row.ret = 0; else { row.ret = v; ret = r2(ret + v); }
        if (!disp && dispOk && v >= R.retMin) { retPerdida = r2(retPerdida + v); if (!row.nota) row.nota = 'já sem dispensa: o cliente retém ' + (retRate === 0.23 ? '23' : '11,5') + ' %'; }
      }
      rows.push(row);
    });
    var dispFim = dispFimIdx === null ? null : fromIdx(dispFimIdx);
    var ivaEstado = !isentoIni ? 'normal' : cross1875 ? 'devido' : cross15 ? 'proximo_ano' : 'isento';

    // Contabilidade organizada vs declaração trimestral (opção até 30 de novembro)
    var lucro = num(st.lucro_co), co = null;
    if (lucro > 0) {
      var bco = r2(Math.min(R.capIas * R.IAS, Math.max(R.coMinIas * R.IAS, lucro / 12)));
      var cco = r2(bco * rate), media = r2(ssAno / 12);
      co = { lucro: lucro, base: bco, contrib: cco, ano: r2(cco * 12), trimMedia: media, diff: r2(cco * 12 - ssAno) };
    }
    var next = decls[4];
    return {
      ano: Y, rate: rate, decls: decls, next: next, ssAno: ssAno, rows: rows, vol: r2(vol), volAnt: volAnt,
      ivaEstado: ivaEstado, cross15: cross15, cross1875: cross1875, ivaDev: ivaDev, falta15: r2(Math.max(0, R.ivaLimit - vol)), falta1875: r2(Math.max(0, R.ivaHard - vol)),
      retRate: retRate, ret: ret, retPerdida: retPerdida, dispOk: dispOk, dispFim: dispFim ? { y: dispFim.y, m: dispFim.m, mes: MES[dispFim.m - 1] + ' de ' + dispFim.y } : null,
      co: co, effIdx: effIdx, R: R
    };
  }

  // Exemplo (inventado): freelancer em Lisboa a recibos verdes desde 2019, serviços, clientes empresa
  var EXEMPLO = {
    ano: '2026', inicio: '2019-03', vol_ant: '14200', iva: 'isento', dispensa: 'sim', ret_taxa: '23', taxa_ss: '21.4', lucro_co: '',
    aj: { jan: 0, abr: 0, jul: 0, out: 0, jan2: 0 },
    recibos: [
      { data: '2025-10-15', cliente: 'Agência Norte', valor: '1100', tipo: 'serv', empresa: 'sim' },
      { data: '2025-11-14', cliente: 'Agência Norte', valor: '1300', tipo: 'serv', empresa: 'sim' },
      { data: '2025-12-12', cliente: 'Loja Mar', valor: '1200', tipo: 'serv', empresa: 'sim' },
      { data: '2026-01-20', cliente: 'Agência Norte', valor: '1200', tipo: 'serv', empresa: 'sim' },
      { data: '2026-02-18', cliente: 'Loja Mar', valor: '1350', tipo: 'serv', empresa: 'sim' },
      { data: '2026-03-17', cliente: 'Agência Norte', valor: '1500', tipo: 'serv', empresa: 'sim' },
      { data: '2026-04-21', cliente: 'Estúdio Sol', valor: '1400', tipo: 'serv', empresa: 'sim' },
      { data: '2026-05-19', cliente: 'Agência Norte', valor: '1650', tipo: 'serv', empresa: 'sim' },
      { data: '2026-06-16', cliente: 'Loja Mar', valor: '1700', tipo: 'serv', empresa: 'sim' },
      { data: '2026-07-14', cliente: 'Agência Norte', valor: '1800', tipo: 'serv', empresa: 'sim' },
      { data: '2026-08-25', cliente: 'Estúdio Sol', valor: '950', tipo: 'serv', empresa: 'sim' },
      { data: '2026-09-22', cliente: 'Agência Norte', valor: '2100', tipo: 'serv', empresa: 'sim' },
      { data: '2026-10-20', cliente: 'Loja Mar', valor: '2300', tipo: 'serv', empresa: 'sim' },
      { data: '2026-11-05', cliente: 'Agência Norte', valor: '1900', tipo: 'serv', empresa: 'sim' },
      { data: '2026-11-12', cliente: 'Estúdio Sol', valor: '2400', tipo: 'serv', empresa: 'sim' }
    ]
  };

  // Lembretes (.ics): 4 declarações + 12 pagamentos do ano
  function icsEvents(res) {
    var ev = [];
    res.decls.slice(1).forEach(function (d) { ev.push({ y: d.y, m: d.m, d: lastDay(d.y, d.m) - 5, t: d.nome + ' (até ' + d.prazo + ') — rendimentos de ' + d.periodo }); });
    res.decls.slice(0, 4).forEach(function (d) { d.months.forEach(function (m) { if (m.valor > 0) { var P = fromIdx(mIdx(m.y, m.m) + 1); ev.push({ y: P.y, m: P.m, d: 15, t: 'Segurança Social: pagar ' + eur(m.valor) + ' de ' + m.mes + ' (até dia 20)' }); } }); });
    return ev;
  }
  function ics(res) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//planilha fiscal para autonomos//PT', 'CALSCALE:GREGORIAN'];
    icsEvents(res).forEach(function (e, i) {
      var dt = e.y + (e.m < 10 ? '0' : '') + e.m + (e.d < 10 ? '0' : '') + e.d;
      L.push('BEGIN:VEVENT', 'UID:pfa-' + res.ano + '-' + i + '@planilha-fiscal', 'DTSTAMP:' + dt + 'T080000Z', 'DTSTART;VALUE=DATE:' + dt, 'SUMMARY:' + e.t.replace(/[,;]/g, ' '),
        'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', 'DESCRIPTION:' + e.t.replace(/[,;]/g, ' '), 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n') + '\r\n';
  }

  // CSV: data;valor[;cliente;tipo;empresa] — aceita ; ou , e datas dd/mm/aaaa ou aaaa-mm-dd
  function parseCsv(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var sep = line.indexOf(';') >= 0 ? ';' : (line.indexOf('\t') >= 0 ? '\t' : ',');
      var c = line.split(sep).map(function (x) { return x.replace(/^"|"$/g, '').trim(); });
      var dt = c[0], m;
      if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(dt))) dt = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) return;
      var v = num(c[1]); if (!(v > 0)) return;
      out.push({ data: dt, valor: String(v), cliente: c[2] || '', tipo: /bens|venda/i.test(c[3] || '') ? 'bens' : 'serv', empresa: /^n(ao|ão|o)?$/i.test(c[4] || '') ? 'nao' : 'sim' });
    });
    return out;
  }

  // Fecho do ano: o volume do ano passa a "ano anterior" e os recibos de out–dez ficam para a declaração de janeiro
  function rollYear(st) {
    var res = compute(st), Y = +st.ano || 2026;
    var keep = (st.recibos || []).filter(function (r) { var d = ym(r.data); return d.y === Y && d.m >= 10; });
    return { ano: String(Y + 1), inicio: st.inicio, vol_ant: String(res.vol), iva: res.vol > R.ivaLimit ? 'normal' : 'isento',
      dispensa: res.vol < R.ivaLimit ? st.dispensa : 'nao', ret_taxa: st.ret_taxa, taxa_ss: st.taxa_ss, lucro_co: '', aj: { jan: (st.aj || {}).jan2 || 0, abr: 0, jul: 0, out: 0, jan2: 0 }, recibos: keep };
  }

  var api = { R: R, MES: MES, num: num, r2: r2, eur: eur, compute: compute, EXEMPLO: EXEMPLO, ics: ics, icsEvents: icsEvents, parseCsv: parseCsv, rollYear: rollYear, fdate: fdate, ym: ym };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FISCAL = api;
})(this);
