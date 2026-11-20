/* planilha escala de trabalho — motor de cálculo (sem tela). Roda no navegador e no node.
   Regras: EC 141/2026 (42h + 2 dias de repouso a partir de 16/12/2026; 40h a partir de 16/12/2027),
   Decreto 13.173/2026 (divisor 210/200; 12x36 pela média do mês), CLT arts. 59, 59-A, 66, 71 §4º, 73. */
(function (root) {
  'use strict';
  var PADRAO = { '6x1': 'TTTTTTF', '5x2': 'TTTTTFF', '12x36': 'TF', '4x3': 'TTTTFFF' };
  var REGIMES = {
    '44': { limite: 44, folgas: 1, divisor: 220, nome: 'até 15/12/2026 (44h, 1 folga)' },
    '42': { limite: 42, folgas: 2, divisor: 210, nome: 'a partir de 16/12/2026 (42h, 2 folgas)' },
    '40': { limite: 40, folgas: 2, divisor: 200, nome: 'a partir de 16/12/2027 (40h, 2 folgas)' }
  };
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function hm(s) {
    var m = /^\s*(\d{1,2})(?:[:h](\d{2}))?\s*$/.exec(String(s == null ? '' : s));
    if (!m) return NaN;
    var h = +m[1], mi = +(m[2] || 0);
    if (h > 24 || mi > 59) return NaN;
    return h * 60 + mi;
  }
  function fmtH(min) {
    var neg = min < 0; min = Math.round(Math.abs(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + h + 'h' + (m ? (m < 10 ? '0' : '') + m : '');
  }
  function brl(x) {
    var n = r2(x), s = Math.abs(n).toFixed(2).split('.');
    return (n < 0 ? '−' : '') + 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }
  function num(v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isNaN(n) ? NaN : n;
  }

  /* minutos do turno dentro da janela noturna 22h–5h (relógio) */
  function noturnoRelogio(ini, fim) {
    var tot = 0;
    for (var d = -1440; d <= 1440; d += 1440) {
      var a = Math.max(ini, 1320 + d), b = Math.min(fim, 1740 + d); // 22:00 → 05:00 do dia seguinte
      if (b > a) tot += b - a;
    }
    return tot;
  }

  /* um turno: entrada, saída, intervalo (min) */
  function turno(ini, fim, intervalo) {
    var a = hm(ini), b = hm(fim), iv = Math.max(0, num(intervalo) || 0);
    if (isNaN(a) || isNaN(b)) return { erro: 'Horário inválido (use 09:00).' };
    if (b <= a) b += 1440;
    var vao = b - a, trab = vao - iv;
    if (trab <= 0) return { erro: 'O intervalo é maior que o turno.' };
    var notRel = Math.min(noturnoRelogio(a, b), trab);   // supõe o intervalo fora das 22h–5h quando possível
    var notCont = notRel * 60 / 52.5;                     // hora noturna de 52'30" (CLT art. 73, § 1º)
    var cont = trab - notRel + notCont;
    return { vao: vao, trab: trab, intervalo: iv, notRel: notRel, notCont: notCont, cont: cont };
  }

  function maxSeguidos(p) {
    var s = p + p, best = 0, run = 0;
    if (p.indexOf('F') < 0) return Infinity;
    for (var i = 0; i < s.length; i++) { if (s[i] === 'T') { run++; if (run > best) best = run; } else run = 0; }
    return best;
  }

  /* Páscoa (algoritmo de Meeus) → Sexta-feira Santa */
  function pascoa(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(y, mes - 1, dia));
  }
  function feriadosNacionais(y) {
    var f = {}, fixos = [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência'],
      ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal']];
    fixos.forEach(function (x) { f[y + '-' + x[0]] = x[1]; });
    var p = pascoa(y); p.setUTCDate(p.getUTCDate() - 2);
    f[p.toISOString().slice(0, 10)] = 'Sexta-feira Santa';
    return f;
  }
  function iso(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }

  /* calendário do mês: dias, domingos, feriados nacionais fora do domingo, dias úteis (seg–sáb) */
  function mes(ym) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7), dias = new Date(Date.UTC(y, m, 0)).getUTCDate(), fer = feriadosNacionais(y);
    var dom = 0, ferNaoDom = 0, lista = [];
    for (var d = 1; d <= dias; d++) {
      var w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(), k = iso(y, m, d);
      if (w === 0) dom++; else if (fer[k]) ferNaoDom++;
      lista.push({ dia: d, iso: k, semana: w, feriado: fer[k] || '' });
    }
    return { ym: ym, ano: y, mes: m, nome: MESES[m - 1] + ' de ' + y, dias: dias, domingos: dom, feriados: ferNaoDom, uteis: dias - dom - ferNaoDom, lista: lista };
  }

  /* uma escala com um turno, num regime, num mês → horas, checagens e custo por funcionário */
  function avaliar(o) {
    var p = PADRAO[o.escala] || o.padrao || PADRAO['6x1'];
    var R = REGIMES[o.regime] || REGIMES['42'];
    var t = turno(o.entrada, o.saida, o.intervalo);
    if (t.erro) return { erro: t.erro };
    var M = mes(o.mes || '2027-01'), sal = num(o.salario);
    if (!(sal > 0)) return { erro: 'Informe o salário.' };
    var L = p.length, w = p.split('T').length - 1, e1236 = o.escala === '12x36';
    var turnosSem = w * 7 / L, folgasSem = (L - w) * 7 / L;
    var semMin = t.cont * turnosSem;
    var acimaSem = Math.max(0, semMin - R.limite * 60);
    var diaAcima = Math.max(0, t.cont - 480);
    var acordo = o.acordo !== 'nao' && o.acordo !== false;
    if (!e1236 && !acordo) acimaSem = Math.max(acimaSem, diaAcima * turnosSem);
    var divisor = Math.min(R.divisor, 5 * semMin / 60);
    var hora = sal / divisor;
    var semanas = M.dias / 7;
    var turnosMes = turnosSem * semanas;
    var heHorasMes = acimaSem / 60 * semanas;
    var he = r2(heHorasMes * hora * 1.5);
    var dsr = r2(M.uteis ? he * (M.domingos + M.feriados) / M.uteis : 0);
    var faltaIv = 0;
    if (t.trab > 360 && t.intervalo < 60) faltaIv = 60 - t.intervalo;
    else if (t.trab > 240 && t.trab <= 360 && t.intervalo < 15) faltaIv = 15 - t.intervalo;
    var intervalo = r2(faltaIv / 60 * hora * 1.5 * turnosMes);
    var noturno = r2(t.notCont / 60 * hora * 0.2 * turnosMes);
    var extra = r2(he + dsr + intervalo + noturno);
    var horasMes = semMin / 60 * semanas;
    var seguidos = maxSeguidos(p);
    var interj = (p.indexOf('TT') >= 0 || p === 'T') ? 1440 - t.vao : 2880 - t.vao;
    var checks = [
      { id: 'folgas', ok: folgasSem + 1e-9 >= R.folgas, txt: (folgasSem >= R.folgas - 1e-9 ? 'Folgas: ' : 'Só ') + fmtDias(folgasSem) + ' de folga por semana' + (folgasSem + 1e-9 >= R.folgas ? ' (mínimo ' + R.folgas + ')' : ' — o regime exige ' + R.folgas + (R.folgas === 2 ? ' (EC 141/2026)' : '')) },
      { id: 'semana', ok: acimaSem === 0, txt: 'Semana: ' + fmtH(semMin) + (e1236 ? ' em média' : '') + (acimaSem ? ' — ' + fmtH(acimaSem) + ' acima de ' + R.limite + 'h' : ' (limite ' + R.limite + 'h)') },
      { id: 'dia', ok: e1236 || diaAcima === 0, txt: e1236 ? 'Dia de ' + fmtH(t.cont) + ': permitido na 12x36 (CLT art. 59-A)' : (diaAcima ? 'Dia de ' + fmtH(t.cont) + ': passa de 8h' + (acordo ? ' — só com acordo de compensação ou convenção' : ' — vira hora extra') : 'Dia de ' + fmtH(t.cont) + ' (limite 8h)') },
      { id: 'intervalo', ok: faltaIv === 0, txt: faltaIv ? 'Intervalo de ' + t.intervalo + ' min: faltam ' + faltaIv + ' min (CLT art. 71)' : 'Intervalo de ' + t.intervalo + ' min ok' },
      { id: 'interjornada', ok: interj >= 660, txt: 'Descanso entre turnos: ' + fmtH(interj) + (interj >= 660 ? '' : ' — mínimo 11h (CLT art. 66)') },
      { id: 'seguidos', ok: seguidos <= 6, txt: (seguidos === Infinity ? 'Sem folga' : seguidos + (seguidos === 1 ? ' dia seguido' : ' dias seguidos') + ' de trabalho') + (seguidos <= 6 ? '' : ' — folga após o 7º dia vira dobro (TST OJ 410)') }
    ];
    return {
      escala: o.escala, padrao: p, regime: o.regime || '42', R: R, M: M, turno: t, salario: sal,
      turnosSem: turnosSem, folgasSem: folgasSem, semMin: semMin, acimaSem: acimaSem, diaAcima: diaAcima,
      divisor: divisor, hora: hora, semanas: semanas, turnosMes: turnosMes, heHorasMes: heHorasMes,
      he: he, dsr: dsr, intervalo: intervalo, noturno: noturno, extra: extra, total: r2(sal + extra),
      horasMes: horasMes, custoHora: r2((sal + extra) / horasMes), heSemana: r2(acimaSem / 60 * hora * 1.5),
      checks: checks, ok: checks.every(function (c) { return c.ok; })
    };
  }
  function fmtDias(x) { var r = Math.round(x * 10) / 10; return (r % 1 ? String(r).replace('.', ',') : String(r)) + (r === 1 ? ' dia' : ' dias'); }

  /* hora extra por semana nos três regimes (para a linha do tempo) */
  function linhaDoTempo(o) {
    return ['44', '42', '40'].map(function (k) {
      var x = avaliar(Object.assign({}, o, { regime: k }));
      return { regime: k, R: REGIMES[k], acimaSem: x.acimaSem || 0, heSemana: x.heSemana || 0, folgasOk: x.checks ? x.checks[0].ok : false };
    });
  }

  /* grade do mês para uma pessoa: âncora = uma data em que a pessoa folga (o ciclo continua de mês em mês) */
  function grade(o) {
    var p = PADRAO[o.escala] || PADRAO['6x1'], L = p.length, M = mes(o.mes || '2027-01');
    var anc = Date.UTC(+o.ancora.slice(0, 4), +o.ancora.slice(5, 7) - 1, +o.ancora.slice(8, 10));
    var primeiraF = p.indexOf('F');
    var dias = M.lista.map(function (d) {
      var t = Date.UTC(M.ano, M.mes - 1, d.dia), k = Math.round((t - anc) / 864e5);
      var pos = (((k + primeiraF) % L) + L) % L;
      return { dia: d.dia, iso: d.iso, semana: d.semana, feriado: d.feriado, trab: p[pos] === 'T' };
    });
    var trab = 0, domF = [], domT = 0, ferT = 0, run = 0, maxRun = 0;
    dias.forEach(function (d) {
      if (d.trab) { trab++; run++; maxRun = Math.max(maxRun, run); if (d.semana === 0) domT++; if (d.feriado && d.semana !== 0) ferT++; }
      else { run = 0; if (d.semana === 0) domF.push(d.dia); }
    });
    return { M: M, escala: o.escala, dias: dias, trabalhados: trab, folgas: M.dias - trab, domingosFolga: domF, domingosTrab: domT, feriadosTrab: ferT, maxSeguidos: maxRun };
  }
  /* a 1ª folga dentro do mês → âncora ISO */
  function ancoraDoMes(ym, primeiraFolgaDia) { var d = Math.max(1, Math.min(28, parseInt(primeiraFolgaDia, 10) || 1)); return ym + '-' + (d < 10 ? '0' : '') + d; }

  /* cobertura da equipe: quantas pessoas trabalham em cada dia */
  function cobertura(grades) {
    if (!grades.length) return [];
    return grades[0].dias.map(function (d, i) { return grades.reduce(function (s, g) { return s + (g.dias[i] && g.dias[i].trab ? 1 : 0); }, 0); });
  }
  function proximoMes(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return y + '-' + (m < 10 ? '0' : '') + m; }

  /* exemplo da página (inventado): vendedora de loja, R$ 2.200,00, 6x1 de 09:00 a 17:20 com 1h de intervalo */
  var EXEMPLO = {
    salario: '2200', regime: '42', mes: '2027-01', atual: '6x1', acordo: 'sim',
    e6_ini: '09:00', e6_fim: '17:20', e6_int: '60',
    e5_ini: '09:00', e5_fim: '18:00', e5_int: '60',
    e12_ini: '07:00', e12_fim: '19:00', e12_int: '60',
    folga1: '3'
  };
  function comparar(v) {
    var base = { salario: v.salario, regime: v.regime, mes: v.mes, acordo: v.acordo };
    return {
      '6x1': avaliar(Object.assign({ escala: '6x1', entrada: v.e6_ini, saida: v.e6_fim, intervalo: v.e6_int }, base)),
      '5x2': avaliar(Object.assign({ escala: '5x2', entrada: v.e5_ini, saida: v.e5_fim, intervalo: v.e5_int }, base)),
      '12x36': avaliar(Object.assign({ escala: '12x36', entrada: v.e12_ini, saida: v.e12_fim, intervalo: v.e12_int }, base))
    };
  }
  function turnoDe(v, esc) { var k = esc === '6x1' ? 'e6' : esc === '5x2' ? 'e5' : 'e12'; return { entrada: v[k + '_ini'], saida: v[k + '_fim'], intervalo: v[k + '_int'] }; }


  /* equipe (Pro): grades de todos, cobertura por dia, custo e checagens por pessoa, e as abas da planilha */
  var SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function equipe(team, ym, regime, acordo) {
    var linhas = team.map(function (p) {
      var g = grade({ escala: p.escala, mes: ym, ancora: p.ancora });
      var a = avaliar({ escala: p.escala, entrada: p.entrada, saida: p.saida, intervalo: p.intervalo, salario: p.salario, regime: regime, mes: ym, acordo: acordo });
      return { p: p, g: g, a: a };
    });
    var cob = cobertura(linhas.map(function (l) { return l.g; }));
    var M = mes(ym);
    var head = ['Funcionário', 'Escala', 'Turno'].concat(M.lista.map(function (d) { return d.dia + ' ' + SEM[d.semana]; }));
    var rows = [['planilha escala de trabalho — ' + M.nome + ' — regime ' + (REGIMES[regime] || REGIMES['42']).nome], head];
    linhas.forEach(function (l) {
      rows.push([l.p.nome, l.p.escala, l.p.entrada + '–' + l.p.saida].concat(l.g.dias.map(function (d) { return d.trab ? (l.p.entrada + '–' + l.p.saida) : 'FOLGA'; })));
    });
    rows.push(['Pessoas trabalhando', '', ''].concat(cob));
    rows.push(['Feriado nacional', '', ''].concat(M.lista.map(function (d) { return d.feriado || ''; })));
    var res = [['Funcionário', 'Escala', 'Dias trabalhados', 'Folgas', 'Domingos de folga', 'Feriados trabalhados', 'Horas/semana', 'Acima do limite (h/semana)',
      'Hora extra (R$)', 'DSR sobre HE (R$)', 'Intervalo indenizado (R$)', 'Adicional noturno (R$)', 'Extra no mês (R$)', 'Salário (R$)', 'Alertas']];
    linhas.forEach(function (l) {
      var a = l.a;
      if (a.erro) { res.push([l.p.nome, l.p.escala, '', '', '', '', '', '', '', '', '', '', '', '', a.erro]); return; }
      res.push([l.p.nome, l.p.escala, l.g.trabalhados, l.g.folgas, l.g.domingosFolga.length, l.g.feriadosTrab, r2(a.semMin / 60), r2(a.acimaSem / 60),
        a.he, a.dsr, a.intervalo, a.noturno, a.extra, a.salario,
        a.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.txt; }).join(' · ') || 'ok']);
    });
    var tot = linhas.reduce(function (s, l) { return s + (l.a.extra || 0); }, 0);
    res.push(['Total da equipe', '', '', '', '', '', '', '', '', '', '', '', r2(tot), '', '']);
    var sheets = [
      { name: 'Escala ' + ym, rows: rows, widths: [22, 8, 13].concat(M.lista.map(function () { return 12; })) },
      { name: 'Resumo ' + ym, rows: res, widths: [22, 8, 10, 8, 10, 10, 10, 12, 12, 12, 12, 12, 12, 12, 60] }
    ];
    return { M: M, linhas: linhas, cob: cob, totalExtra: r2(tot), sheets: sheets };
  }
  function csv(rows) {
    return rows.map(function (r) { return r.map(function (v) { var s = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\r\n');
  }

  var ESC = { equipe: equipe, csv: csv, SEM: SEM, PADRAO: PADRAO, REGIMES: REGIMES, MESES: MESES, hm: hm, fmtH: fmtH, brl: brl, num: num, r2: r2, turno: turno, mes: mes,
    feriadosNacionais: feriadosNacionais, avaliar: avaliar, linhaDoTempo: linhaDoTempo, grade: grade, ancoraDoMes: ancoraDoMes,
    cobertura: cobertura, proximoMes: proximoMes, EXEMPLO: EXEMPLO, comparar: comparar, turnoDe: turnoDe, fmtDias: fmtDias, maxSeguidos: maxSeguidos };
  if (typeof module !== 'undefined' && module.exports) module.exports = ESC; else root.ESC = ESC;
})(this);
