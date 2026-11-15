/* planilha excel para autônomos — motor de cálculo (sem rede, sem dependências) */
(function (root) {
  'use strict';
  var DAY = 86400000;
  var DAS_MEI = { servicos: 86.05, comercio: 82.05, ambos: 87.05 };
  var INSS_TETO = 8475.55;
  var IR = [[0.075, 182.16], [0.15, 394.16], [0.225, 675.49], [0.275, 908.73]];
  var RED_CAP = 312.89;

  var DEFAULTS = {
    hoje: '15/11/2026', regime: 'mei', multa: '2', juros: '1', despesas: '450,00', aliq: '6',
    lanc: [
      'Loja Exemplo; identidade visual; 2.400,00; 05/11/2026; 05/11/2026',
      'Clínica Exemplo; posts de outubro; 1.200,00; 10/10/2026;',
      'Agência Exemplo; landing page; 3.500,00; 30/10/2026;',
      'Studio Exemplo; banner; 480,00; 12/11/2026; 14/11/2026',
      'Café Exemplo; cardápio; 650,00; 20/11/2026;'
    ].join('\n')
  };

  function r2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function num(s) {
    s = String(s == null ? '' : s).replace(/R\$|\s|%/g, '');
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var v = parseFloat(s.replace(/[^0-9.\-]/g, ''));
    return isFinite(v) ? v : 0;
  }
  /* aceita dd/mm/aaaa, dd/mm/aa, dd-mm-aaaa, aaaa-mm-dd; ignora lixo no fim */
  function date(s) {
    s = String(s == null ? '' : s).trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s), y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else {
      m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(s);
      if (!m) return null;
      d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000;
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var t = Date.UTC(y, mo - 1, d), o = new Date(t);
    if (o.getUTCDate() !== d) return null;
    return t;
  }
  function fmtD(t) { if (t == null) return ''; var o = new Date(t); return ('0' + o.getUTCDate()).slice(-2) + '/' + ('0' + (o.getUTCMonth() + 1)).slice(-2) + '/' + o.getUTCFullYear(); }
  function brl(x) {
    var neg = x < 0, v = Math.abs(r2(x)).toFixed(2).split('.');
    return (neg ? '−' : '') + 'R$ ' + v[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + v[1];
  }
  function ym(t) { var o = new Date(t); return o.getUTCFullYear() * 100 + o.getUTCMonth() + 1; }

  function parseLines(txt) {
    var out = [], bad = [];
    String(txt || '').split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim() || /^\s*#/.test(line)) return;
      var p = line.split(/;|\t/).map(function (x) { return x.trim(); });
      var cli = p[0] || '', serv = p[1] || '', val = num(p[2]), venc = date(p[3]), rec = date(p[4]);
      if (!cli || !(val > 0) || venc == null) { bad.push(i + 1); return; }
      out.push({ cliente: cli, servico: serv, valor: r2(val), venc: venc, rec: rec, line: i + 1 });
    });
    return { rows: out, bad: bad };
  }

  function irMensal(base) {
    var t = 0;
    IR.forEach(function (b) { t = Math.max(t, base * b[0] - b[1]); });
    return r2(Math.max(0, t));
  }
  function reducao(bruto, tax) {
    var red = 0;
    if (bruto <= 5000) red = RED_CAP;
    else if (bruto <= 7350) red = Math.max(0, 978.62 - 0.133145 * bruto);
    return r2(Math.min(tax, red));
  }

  function imposto(regime, recebido, despesas, aliq) {
    if (regime === 'mei' || regime === 'mei_comercio' || regime === 'mei_ambos') {
      var das = regime === 'mei' ? DAS_MEI.servicos : regime === 'mei_comercio' ? DAS_MEI.comercio : DAS_MEI.ambos;
      return { total: das, linhas: [['DAS-MEI do mês (valor fixo 2026)', das]] };
    }
    if (regime === 'simples') {
      var v = r2(recebido * aliq / 100);
      return { total: v, linhas: [['DAS do Simples (' + String(aliq).replace('.', ',') + ' % sobre o recebido)', v]] };
    }
    /* autônomo pessoa física: INSS 20 % até o teto + carnê-leão */
    var inss = r2(Math.min(recebido, INSS_TETO) * 0.20);
    var dedut = r2(Math.min(despesas, recebido));
    var base = r2(Math.max(0, recebido - inss - dedut));
    var ir = irMensal(base), red = reducao(recebido, ir), cl = r2(ir - red);
    return { total: r2(inss + cl), inss: inss, base: base, ir: ir, red: red, carne: cl,
      linhas: [['INSS 20 % sobre o recebido (até o teto)', inss], ['Base do carnê-leão (recebido − INSS − livro caixa)', base], ['IR pela tabela mensal 2026', ir], ['Redução da Lei 15.270 (até 312,89)', -red], ['Carnê-leão a pagar', cl]] };
  }

  function compute(v) {
    v = v || {};
    var hoje = date(v.hoje); if (hoje == null) hoje = date(DEFAULTS.hoje);
    var multa = Math.max(0, num(v.multa)), juros = Math.max(0, num(v.juros)), desp = Math.max(0, num(v.despesas)), aliq = Math.max(0, num(v.aliq));
    var regime = v.regime || 'mei';
    var P = parseLines(v.lanc), mes = ym(hoje);
    var rows = P.rows.map(function (r) {
      var o = { cliente: r.cliente, servico: r.servico, valor: r.valor, venc: r.venc, rec: r.rec, line: r.line };
      if (r.rec != null) {
        o.status = r.rec > r.venc ? 'recebido com atraso' : 'recebido';
        o.dias = 0; o.multa = 0; o.juros = 0; o.cobrar = 0;
        o.diasPago = Math.max(0, Math.round((r.rec - r.venc) / DAY));
      } else if (r.venc < hoje) {
        o.status = 'em atraso';
        o.dias = Math.round((hoje - r.venc) / DAY);
        o.multa = r2(r.valor * multa / 100);
        o.juros = r2(r.valor * juros / 100 * o.dias / 30);
        o.cobrar = r2(r.valor + o.multa + o.juros);
      } else {
        o.status = 'a vencer'; o.dias = 0; o.multa = 0; o.juros = 0; o.cobrar = r.valor;
        o.faltam = Math.round((r.venc - hoje) / DAY);
      }
      return o;
    });
    var sum = function (f) { return r2(rows.filter(f).reduce(function (a, r) { return a + r.valor; }, 0)); };
    var recMes = sum(function (r) { return r.rec != null && ym(r.rec) === mes; });
    var aReceber = sum(function (r) { return r.rec == null; });
    var atrasados = rows.filter(function (r) { return r.status === 'em atraso'; }).sort(function (a, b) { return b.dias - a.dias; });
    var emAtraso = sum(function (r) { return r.status === 'em atraso'; });
    var encargos = r2(atrasados.reduce(function (a, r) { return a + r.multa + r.juros; }, 0));
    var aVencer = rows.filter(function (r) { return r.status === 'a vencer'; });
    var vencMes = sum(function (r) { return ym(r.venc) === mes; });
    var imp = imposto(regime, recMes, desp, aliq);
    var sobra = r2(recMes - desp - imp.total);
    /* se os atrasados entrassem hoje com multa e juros */
    var sobraSeCobrar = r2(sobra + emAtraso + encargos - (regime === 'simples' ? r2((emAtraso + encargos) * aliq / 100) : 0));
    return {
      hoje: hoje, mes: mes, regime: regime, multaPct: multa, jurosPct: juros, despesas: desp, aliq: aliq,
      rows: rows, bad: P.bad, recebidoMes: recMes, aReceber: aReceber, emAtraso: emAtraso, atrasados: atrasados,
      encargos: encargos, aVencer: aVencer, vencMes: vencMes, imposto: imp, sobra: sobra,
      maisAntigo: atrasados.length ? atrasados[0].dias : 0
    };
  }

  function cobranca(r, o) {
    return 'Olá, ' + r.cliente + '. A cobrança de ' + brl(r.valor) + (r.servico ? ' (' + r.servico + ')' : '') + ', vencida em ' + fmtD(r.venc) +
      ', está em aberto há ' + r.dias + ' dias. Com a multa de ' + String(o.multaPct).replace('.', ',') + ' % e os juros de ' + String(o.jurosPct).replace('.', ',') +
      ' % ao mês do nosso contrato, o total em ' + fmtD(o.hoje) + ' é ' + brl(r.cobrar) + '. Pode me confirmar a data do pagamento?';
  }

  /* resumo de 12 meses (Pro): recebido por mês de recebimento, faturado por mês de vencimento */
  function ano(o, y) {
    var m = [], tot = 0;
    for (var i = 1; i <= 12; i++) m.push({ mes: i, faturado: 0, recebido: 0 });
    o.rows.forEach(function (r) {
      var a = new Date(r.venc); if (a.getUTCFullYear() === y) m[a.getUTCMonth()].faturado = r2(m[a.getUTCMonth()].faturado + r.valor);
      if (r.rec != null) { var b = new Date(r.rec); if (b.getUTCFullYear() === y) m[b.getUTCMonth()].recebido = r2(m[b.getUTCMonth()].recebido + r.valor); }
    });
    m.forEach(function (x) { tot = r2(tot + x.recebido); });
    return { ano: y, meses: m, recebido: tot, limiteMei: 81000, usoMei: r2(tot / 81000 * 100) };
  }

  /* lembretes .ics (Pro) */
  function ics(o) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//planilha-autonomos//pt-BR', 'CALSCALE:GREGORIAN'];
    var stamp = new Date(o.hoje).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    var d8 = function (t) { return new Date(t).toISOString().slice(0, 10).replace(/-/g, ''); };
    var esc = function (s) { return String(s).replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); };
    var ev = function (id, t, sum, desc) { L.push('BEGIN:VEVENT', 'UID:' + id + '@planilha-autonomos', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + d8(t), 'DTEND;VALUE=DATE:' + d8(t + DAY), 'SUMMARY:' + esc(sum), 'DESCRIPTION:' + esc(desc), 'BEGIN:VALARM', 'TRIGGER:-PT9H', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(sum), 'END:VALARM', 'END:VEVENT'); };
    o.aVencer.forEach(function (r, i) { ev('v' + r.line + '-' + d8(r.venc), r.venc, 'Vence hoje: ' + r.cliente + ' ' + brl(r.valor), r.servico || ''); ev('c' + r.line + '-' + d8(r.venc + 3 * DAY), r.venc + 3 * DAY, 'Conferir pagamento: ' + r.cliente, 'Se não entrou, cobrar com multa e juros do contrato.'); });
    o.atrasados.forEach(function (r) { ev('a' + r.line + '-' + d8(o.hoje + DAY), o.hoje + DAY, 'Cobrar: ' + r.cliente + ' ' + brl(r.cobrar), cobranca(r, o)); });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  var api = { DEFAULTS: DEFAULTS, DAS_MEI: DAS_MEI, num: num, date: date, fmtD: fmtD, brl: brl, r2: r2, parseLines: parseLines, irMensal: irMensal, reducao: reducao, imposto: imposto, compute: compute, cobranca: cobranca, ano: ano, ics: ics, DAY: DAY };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PEA = api;
})(this);
