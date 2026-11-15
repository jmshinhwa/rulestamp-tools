/* planilha de receitas e despesas — motor (sem DOM). Roda no navegador e no node. */
(function (root) {
  'use strict';
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isFinite(n) ? n : 0;
  }
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function brl(x) {
    var neg = x < 0, v = Math.abs(r2(x)), i = Math.floor(v), c = Math.round((v - i) * 100);
    if (c === 100) { i += 1; c = 0; }
    var s = String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? 'R$ −' : 'R$ ') + s + ',' + (c < 10 ? '0' : '') + c;
  }
  function pct(x, d) { return (Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toFixed(d || 0).replace('.', ','); }
  function okDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function dnum(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
  function ym(s) { return s.slice(0, 7); }
  function addM(ymS, k) { var y = +ymS.slice(0, 4), m = +ymS.slice(5, 7) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + (m < 9 ? '0' : '') + (m + 1); }
  function mesNome(ymS) { return MESES[+ymS.slice(5, 7) - 1] + ' de ' + ymS.slice(0, 4); }
  function lastDay(ymS) { var y = +ymS.slice(0, 4), m = +ymS.slice(5, 7); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  /* inp = {ref:'AAAA-MM-DD', saldo, multa(% do contrato), juros(% ao mês), recs:[{cliente,projeto,valor,venc,st:'receber'|'recebido'}], desp:[{nome,valor,dia,tipo:'negocio'|'pessoal'}]} */
  function calc(inp) {
    var ref = okDate(inp.ref) ? inp.ref : '2026-11-15', refN = dnum(ref), refYm = ym(ref), refDia = +ref.slice(8, 10);
    var saldo = num(inp.saldo), multa = num(inp.multa) / 100, juros = num(inp.juros) / 100;
    var recs = (inp.recs || []).map(function (r, i) {
      return { i: i, cliente: String(r.cliente || '').trim() || 'sem nome', projeto: String(r.projeto || '').trim(), valor: r2(num(r.valor)), venc: okDate(r.venc) ? r.venc : '', st: r.st === 'recebido' ? 'recebido' : 'receber' };
    }).filter(function (r) { return r.valor > 0 && r.venc; });
    var desp = (inp.desp || []).map(function (d) {
      var dia = Math.round(num(d.dia)); if (dia < 1) dia = 1; if (dia > 31) dia = 31;
      return { nome: String(d.nome || '').trim() || 'despesa', valor: r2(num(d.valor)), dia: dia, tipo: d.tipo === 'pessoal' ? 'pessoal' : 'negocio' };
    }).filter(function (d) { return d.valor > 0; });

    var despMes = r2(desp.reduce(function (a, d) { return a + d.valor; }, 0));
    var despNeg = r2(desp.filter(function (d) { return d.tipo === 'negocio'; }).reduce(function (a, d) { return a + d.valor; }, 0));
    var despFalta = r2(desp.filter(function (d) { return Math.min(d.dia, lastDay(refYm)) > refDia; }).reduce(function (a, d) { return a + d.valor; }, 0));

    // atrasados
    var venc = recs.filter(function (r) { return r.st === 'receber' && dnum(r.venc) < refN; }).map(function (r) {
      var dias = refN - dnum(r.venc), m = r2(r.valor * multa), j = r2(r.valor * juros / 30 * dias);
      return { i: r.i, cliente: r.cliente, projeto: r.projeto, valor: r.valor, venc: r.venc, dias: dias, multa: m, juros: j, total: r2(r.valor + m + j) };
    }).sort(function (a, b) { return b.dias - a.dias; });
    var vencTot = r2(venc.reduce(function (a, v) { return a + v.valor; }, 0));
    var encargos = r2(venc.reduce(function (a, v) { return a + v.multa + v.juros; }, 0));
    var cliVenc = {}; venc.forEach(function (v) { cliVenc[v.cliente] = 1; });

    // a vencer, por mês (mês da referência = do dia de hoje até o fim)
    var meses = [refYm, addM(refYm, 1), addM(refYm, 2), addM(refYm, 3)];
    var proj = [], acum = saldo, acumCom = r2(saldo + vencTot), negativo = null, negativoCom = null;
    meses.forEach(function (mm, k) {
      var entra = r2(recs.filter(function (r) { return r.st === 'receber' && ym(r.venc) === mm && dnum(r.venc) >= refN; }).reduce(function (a, r) { return a + r.valor; }, 0));
      var sai = k === 0 ? despFalta : despMes;
      acum = r2(acum + entra - sai); acumCom = r2(acumCom + entra - sai);
      proj.push({ ym: mm, nome: mesNome(mm), parcial: k === 0, entra: entra, sai: sai, saldoFim: acum, saldoFimCom: acumCom });
      if (negativo === null && acum < 0) negativo = proj[proj.length - 1];
      if (negativoCom === null && acumCom < 0) negativoCom = proj[proj.length - 1];
    });

    // resultado do mês da referência (recebido com vencimento no mês − despesas do mês)
    var recebMes = r2(recs.filter(function (r) { return r.st === 'recebido' && ym(r.venc) === refYm; }).reduce(function (a, r) { return a + r.valor; }, 0));
    var faturadoMes = r2(recs.filter(function (r) { return ym(r.venc) === refYm; }).reduce(function (a, r) { return a + r.valor; }, 0));

    // por cliente (tudo o que está na lista)
    var porCli = {}, totalLista = 0;
    recs.forEach(function (r) {
      var c = porCli[r.cliente] = porCli[r.cliente] || { cliente: r.cliente, total: 0, recebido: 0, aberto: 0, vencido: 0, maxDias: 0 };
      c.total = r2(c.total + r.valor); totalLista = r2(totalLista + r.valor);
      if (r.st === 'recebido') c.recebido = r2(c.recebido + r.valor); else c.aberto = r2(c.aberto + r.valor);
    });
    venc.forEach(function (v) { var c = porCli[v.cliente]; c.vencido = r2(c.vencido + v.valor); c.maxDias = Math.max(c.maxDias, v.dias); });
    var clientes = Object.keys(porCli).map(function (k) { var c = porCli[k]; c.share = totalLista ? c.total / totalLista : 0; return c; })
      .sort(function (a, b) { return b.total - a.total; });

    return {
      ref: ref, refNome: mesNome(refYm), saldo: saldo, despMes: despMes, despNeg: despNeg, despPes: r2(despMes - despNeg), despFalta: despFalta,
      folego: despMes > 0 ? saldo / despMes : null,
      vencidos: venc, vencTot: vencTot, nClientesVenc: Object.keys(cliVenc).length, maxDias: venc.length ? venc[0].dias : 0, encargos: encargos,
      proj: proj, negativo: negativo, negativoCom: negativoCom,
      recebMes: recebMes, faturadoMes: faturadoMes, resultadoMes: r2(recebMes - despMes),
      clientes: clientes, maior: clientes[0] || null, totalLista: totalLista, recs: recs, desp: desp
    };
  }

  /* Pro: fecha o mês — guarda o resumo e devolve a entrada do mês seguinte (saldo levado + abertos) */
  function fechar(inp, saldoFinal) {
    var r = calc(inp), prox = addM(ym(r.ref), 1) + '-01';
    var resumo = { ym: ym(r.ref), saldoInicial: r.saldo, recebido: r.recebMes, faturado: r.faturadoMes, despesas: r.despMes, resultado: r.resultadoMes,
      vencido: r.vencTot, encargos: r.encargos, saldoFinal: r2(num(saldoFinal)),
      porCliente: r.clientes.filter(function (c) { return c.recebido > 0; }).map(function (c) { return { cliente: c.cliente, recebido: c.recebido }; }) };
    var next = { ref: prox, saldo: r2(num(saldoFinal)), multa: inp.multa, juros: inp.juros, desp: inp.desp,
      recs: (inp.recs || []).filter(function (x) { return x.st !== 'recebido' || (okDate(x.venc) && x.venc >= prox); }) };
    return { resumo: resumo, next: next };
  }

  function somaAno(hist, ano) {
    var s = { recebido: 0, despesas: 0, resultado: 0, meses: 0, porCliente: {} };
    Object.keys(hist || {}).sort().forEach(function (k) {
      if (k.slice(0, 4) !== String(ano)) return;
      var h = hist[k]; s.meses++; s.recebido = r2(s.recebido + h.recebido); s.despesas = r2(s.despesas + h.despesas); s.resultado = r2(s.resultado + h.resultado);
      (h.porCliente || []).forEach(function (c) { s.porCliente[c.cliente] = r2((s.porCliente[c.cliente] || 0) + c.recebido); });
    });
    return s;
  }

  function cobranca(v, multaPct, jurosPct) {
    var d = v.venc.split('-');
    return 'Olá! Passando para lembrar do pagamento de ' + (v.projeto || 'serviço') + ', ' + brl(v.valor) + ', com vencimento em ' + d[2] + '/' + d[1] + '/' + d[0] +
      ' (' + v.dias + ' dias). Pelo nosso contrato (multa de ' + pct(num(multaPct), 1) + '% e juros de ' + pct(num(jurosPct), 1) + '% ao mês), o valor hoje é ' + brl(v.total) +
      ' (multa ' + brl(v.multa) + ' + juros ' + brl(v.juros) + '). Posso enviar o Pix?';
  }

  function csv(r) {
    var L = [['tipo', 'cliente/despesa', 'projeto', 'valor', 'vencimento/dia', 'situacao', 'dias_atraso', 'multa', 'juros'].join(';')];
    function q(s) { s = String(s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    function n(x) { return r2(x).toFixed(2).replace('.', ','); }
    var vmap = {}; r.vencidos.forEach(function (v) { vmap[v.i] = v; });
    r.recs.forEach(function (x) { var v = vmap[x.i]; L.push(['receita', q(x.cliente), q(x.projeto), n(x.valor), x.venc, v ? 'vencido' : x.st, v ? v.dias : '', v ? n(v.multa) : '', v ? n(v.juros) : ''].join(';')); });
    r.desp.forEach(function (d) { L.push(['despesa ' + d.tipo, q(d.nome), '', n(d.valor), 'dia ' + d.dia, 'mensal', '', '', ''].join(';')); });
    return '﻿' + L.join('\r\n') + '\r\n';
  }

  function ics(r) {
    function dt(s) { return s.replace(/-/g, ''); }
    var ev = [], stamp = r.ref.replace(/-/g, '') + 'T120000Z';
    r.recs.filter(function (x) { return x.st === 'receber' && x.venc >= r.ref; }).forEach(function (x, k) {
      ev.push(['BEGIN:VEVENT', 'UID:rec-' + k + '-' + dt(x.venc) + '@planilha-receitas', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + dt(x.venc),
        'SUMMARY:Receber ' + brl(x.valor) + ' de ' + x.cliente + (x.projeto ? ' (' + x.projeto + ')' : ''), 'END:VEVENT'].join('\r\n'));
    });
    r.proj.forEach(function (p) {
      r.desp.forEach(function (d, k) {
        var dia = Math.min(d.dia, lastDay(p.ym)), ds = p.ym + '-' + (dia < 10 ? '0' : '') + dia;
        if (ds <= r.ref) return;
        ev.push(['BEGIN:VEVENT', 'UID:desp-' + k + '-' + dt(ds) + '@planilha-receitas', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + dt(ds),
          'SUMMARY:Pagar ' + d.nome + ' ' + brl(d.valor), 'END:VEVENT'].join('\r\n'));
      });
    });
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//planilha de receitas e despesas//pt-BR', 'CALSCALE:GREGORIAN'].concat(ev).concat(['END:VCALENDAR']).join('\r\n') + '\r\n';
  }

  var API = { calc: calc, fechar: fechar, somaAno: somaAno, cobranca: cobranca, csv: csv, ics: ics, brl: brl, pct: pct, num: num, mesNome: mesNome, addM: addM };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CAIXA = API;
})(this);
