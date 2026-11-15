(function () {
  'use strict';
  var doc = document, LS = window.localStorage, C = window.CAIXA;
  var SLUG = 'planilha-de-receitas-e-despesas', DOORS = [SLUG, SLUG + '.yearly', SLUG + '.monthly'];
  var K_DRAFT = 'prd.draft', K_KEY = 'prd.key', K_HIST = 'prd.hist';
  var EXEMPLO = {
    ref: '2026-11-15', saldo: '3200', multa: '2', juros: '1',
    recs: [
      { cliente: 'Studio Pétala', projeto: 'identidade visual', valor: '2800', venc: '2026-09-29', st: 'receber' },
      { cliente: 'Clínica Viva', projeto: 'posts de outubro', valor: '1500', venc: '2026-10-31', st: 'receber' },
      { cliente: 'Loja Ramos', projeto: 'site da loja', valor: '4000', venc: '2026-11-05', st: 'recebido' },
      { cliente: 'Clínica Viva', projeto: 'posts de novembro', valor: '1500', venc: '2026-11-30', st: 'receber' },
      { cliente: 'Loja Ramos', projeto: 'manutenção de dezembro', valor: '600', venc: '2026-12-10', st: 'receber' },
      { cliente: 'Café Aroma', projeto: 'cardápio', valor: '900', venc: '2026-12-18', st: 'receber' },
      { cliente: 'Clínica Viva', projeto: 'posts de dezembro', valor: '1500', venc: '2026-12-30', st: 'receber' },
      { cliente: 'Loja Ramos', projeto: 'manutenção de janeiro', valor: '600', venc: '2027-01-11', st: 'receber' }
    ],
    desp: [
      { nome: 'aluguel', valor: '1900', dia: '10', tipo: 'pessoal' },
      { nome: 'luz, internet e celular', valor: '420', dia: '20', tipo: 'pessoal' },
      { nome: 'softwares (Adobe, Figma)', valor: '310', dia: '5', tipo: 'negocio' },
      { nome: 'plano de saúde', valor: '650', dia: '25', tipo: 'pessoal' },
      { nome: 'mercado e casa', valor: '1400', dia: '30', tipo: 'pessoal' }
    ]
  };
  var pro = false, cur = null;

  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) { /* cheio ou bloqueado */ } }
  function B(x) { return C.brl(x); }
  function fd(s) { var p = String(s).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function recRow(r) {
    r = r || {};
    return '<div class="row rec">' +
      '<label class="sr"><span>Cliente</span><input class="r-cliente" data-yj-mine value="' + esc(r.cliente) + '" placeholder="cliente"></label>' +
      '<label class="sr"><span>Projeto</span><input class="r-projeto" data-yj-mine value="' + esc(r.projeto) + '" placeholder="projeto ou parcela"></label>' +
      '<label class="sr"><span>Valor (R$)</span><input class="r-valor" data-yj-mine inputmode="decimal" value="' + esc(r.valor) + '"></label>' +
      '<label class="sr"><span>Vencimento</span><input class="r-venc" type="date" data-yj-mine value="' + esc(r.venc) + '"></label>' +
      '<label class="sr"><span>Situação</span><select class="r-st" data-yj-mine><option value="receber"' + (r.st !== 'recebido' ? ' selected' : '') + '>a receber</option><option value="recebido"' + (r.st === 'recebido' ? ' selected' : '') + '>recebido</option></select></label>' +
      '<button class="x" type="button" aria-label="remover">×</button></div>';
  }
  function despRow(d) {
    d = d || {};
    return '<div class="row desp">' +
      '<label class="sr"><span>Despesa</span><input class="d-nome" data-yj-mine value="' + esc(d.nome) + '" placeholder="despesa"></label>' +
      '<label class="sr"><span>Valor (R$)</span><input class="d-valor" data-yj-mine inputmode="decimal" value="' + esc(d.valor) + '"></label>' +
      '<label class="sr"><span>Dia</span><input class="d-dia" data-yj-mine inputmode="numeric" value="' + esc(d.dia || '') + '"></label>' +
      '<label class="sr"><span>Tipo</span><select class="d-tipo" data-yj-mine><option value="negocio"' + (d.tipo !== 'pessoal' ? ' selected' : '') + '>negócio</option><option value="pessoal"' + (d.tipo === 'pessoal' ? ' selected' : '') + '>casa / pessoal</option></select></label>' +
      '<button class="x" type="button" aria-label="remover">×</button></div>';
  }
  function read() {
    function rows(sel, pre, keys) {
      return Array.prototype.map.call(doc.querySelectorAll(sel), function (r) { var o = {}; keys.forEach(function (k) { o[k] = r.querySelector('.' + pre + k).value; }); return o; });
    }
    return { ref: $('ref').value, saldo: $('saldo').value, multa: $('multa').value, juros: $('juros').value,
      recs: rows('#recs .row', 'r-', ['cliente', 'projeto', 'valor', 'venc', 'st']), desp: rows('#desps .row', 'd-', ['nome', 'valor', 'dia', 'tipo']) };
  }
  function write(v) {
    ['ref', 'saldo', 'multa', 'juros'].forEach(function (k) { $(k).value = v[k] == null ? '' : v[k]; });
    $('recs').innerHTML = (v.recs || []).map(recRow).join('');
    $('desps').innerHTML = (v.desp || []).map(despRow).join('');
  }

  function draw() {
    var inp = read(); jset(K_DRAFT, inp);
    var r = C.calc(inp); cur = { inp: inp, r: r };
    var h = [], last = r.proj[r.proj.length - 1];
    h.push('<div class="kpis">');
    if (r.negativo) h.push('<div class="kpi main bad"><div class="l">Caixa em ' + esc(r.negativo.nome) + ', com o que já está contratado</div><div class="v">' + B(r.negativo.saldoFim) + '</div><div class="s">' + (r.negativoCom ? 'mesmo se os atrasados pagarem: ' + B(r.negativoCom.saldoFimCom) + ' em ' + esc(r.negativoCom.nome) : 'se os atrasados pagarem: ' + B(r.negativo.saldoFimCom)) + '</div></div>');
    else h.push('<div class="kpi main good"><div class="l">Caixa no fim de ' + esc(last.nome) + '</div><div class="v">' + B(last.saldoFim) + '</div><div class="s">sem contar os atrasados; nenhum mês fica negativo</div></div>');
    h.push('<div class="kpi' + (r.vencTot > 0 ? ' bad' : ' good') + '"><div class="l">Vencido</div><div class="v">' + B(r.vencTot) + '</div><div class="s">' + (r.vencidos.length ? r.nClientesVenc + (r.nClientesVenc === 1 ? ' cliente' : ' clientes') + ' · o mais antigo há ' + r.maxDias + ' dias' : 'nenhum atraso') + '</div></div>');
    h.push('<div class="kpi' + (r.encargos > 0 ? ' bad' : '') + '"><div class="l">Multa + juros do contrato</div><div class="v">' + B(r.encargos) + '</div><div class="s">a cobrar sobre os atrasos</div></div>');
    h.push('<div class="kpi"><div class="l">Fôlego do caixa</div><div class="v">' + (r.folego == null ? '—' : C.pct(r.folego, 1) + ' mês') + '</div><div class="s">' + B(r.saldo) + ' ÷ ' + B(r.despMes) + ' de despesas</div></div>');
    h.push('<div class="kpi"><div class="l">Maior cliente</div><div class="v">' + (r.maior ? C.pct(r.maior.share * 100, 0) + '%' : '—') + '</div><div class="s">' + (r.maior ? esc(r.maior.cliente) + ' · ' + B(r.maior.total) + ' de ' + B(r.totalLista) : '') + '</div></div>');
    h.push('</div>');
    h.push('<div class="tbl"><table><caption>Caixa mês a mês (saldo de hoje ' + B(r.saldo) + ')</caption><tr><th>Mês</th><th class="n">Entra</th><th class="n">Sai</th><th class="n">Saldo no fim</th><th class="n">Se os atrasados pagarem</th></tr>' +
      r.proj.map(function (p) { return '<tr><td>' + (p.parcial ? 'resto de ' : '') + esc(p.nome) + '</td><td class="n">' + B(p.entra) + '</td><td class="n">' + B(p.sai) + '</td><td class="n' + (p.saldoFim < 0 ? ' neg' : '') + '">' + B(p.saldoFim) + '</td><td class="n' + (p.saldoFimCom < 0 ? ' neg' : '') + '">' + B(p.saldoFimCom) + '</td></tr>'; }).join('') + '</table></div>');
    if (r.vencidos.length) h.push('<div class="tbl"><table><caption>Atrasados em ' + fd(r.ref) + '</caption><tr><th>Cliente</th><th>Projeto</th><th>Venceu</th><th class="n">Dias</th><th class="n">Valor</th><th class="n">Multa</th><th class="n">Juros</th><th class="n">Hoje</th></tr>' +
      r.vencidos.map(function (v) { return '<tr><td>' + esc(v.cliente) + '</td><td>' + esc(v.projeto) + '</td><td>' + fd(v.venc) + '</td><td class="n">' + v.dias + '</td><td class="n">' + B(v.valor) + '</td><td class="n">' + B(v.multa) + '</td><td class="n">' + B(v.juros) + '</td><td class="n">' + B(v.total) + '</td></tr>'; }).join('') + '</table></div>');
    if (r.clientes.length) h.push('<div class="tbl"><table><caption>Por cliente</caption><tr><th>Cliente</th><th class="n">Total na lista</th><th class="n">Recebido</th><th class="n">Em aberto</th><th class="n">Vencido</th><th class="n">Peso</th></tr>' +
      r.clientes.map(function (c) { return '<tr><td>' + esc(c.cliente) + '</td><td class="n">' + B(c.total) + '</td><td class="n">' + B(c.recebido) + '</td><td class="n">' + B(c.aberto) + '</td><td class="n' + (c.vencido ? ' neg' : '') + '">' + B(c.vencido) + '</td><td class="n">' + C.pct(c.share * 100, 0) + '%</td></tr>'; }).join('') + '</table></div>');
    h.push('<p class="hint">Resultado de ' + esc(r.refNome) + ': recebido ' + B(r.recebMes) + ' − despesas do mês ' + B(r.despMes) + ' (negócio ' + B(r.despNeg) + ', casa ' + B(r.despPes) + ') = <b' + (r.resultadoMes < 0 ? ' class="neg"' : '') + '>' + B(r.resultadoMes) + '</b>.</p>');
    $('out').innerHTML = h.join('');
    if (pro) drawPro();
  }

  /* ---------- Pro ---------- */
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
    if (!key) { if (!quiet) $('keymsg').textContent = 'Cole a chave que chegou depois do pagamento.'; return; }
    if (!quiet) $('keymsg').textContent = 'Conferindo a chave…';
    check(key).then(function (ok) {
      if (ok) { LS.setItem(K_KEY, key); setPro(true); $('keymsg').textContent = ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-de-receitas-e-despesas/'; }
      else if (!quiet) $('keymsg').textContent = 'Chave não reconhecida. Confira se copiou inteira.';
    });
  }
  function setPro(v) { pro = v; doc.body.classList.toggle('is-pro', v); if (v) drawPro(); }
  function needPro(what) {
    if (pro) return false;
    $('promsg').innerHTML = '<b>' + esc(what) + '' + SLUG + ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-de-receitas-e-despesas/';
    $('pro').scrollIntoView({ behavior: 'smooth' });
    return true;
  }
  function drawPro() {
    if (!cur) return;
    var r = cur.r, h = [];
    if (r.vencidos.length) {
      h.push('<h3>Mensagens de cobrança</h3>');
      r.vencidos.forEach(function (v, k) { h.push('<div class="cob" id="cob' + k + '">' + esc(C.cobranca(v, cur.inp.multa, cur.inp.juros)) + '</div><p><button class="btn ghost" type="button" data-copy="' + k + '">Copiar</button></p>'); });
    }
    $('cobr').innerHTML = h.join('');
    Array.prototype.forEach.call($('cobr').querySelectorAll('[data-copy]'), function (b) {
      b.addEventListener('click', function () { var t = $('cob' + b.getAttribute('data-copy')).textContent; if (navigator.clipboard) navigator.clipboard.writeText(t); b.textContent = 'Copiado'; });
    });
    drawHist();
  }
  function drawHist() {
    var H = jget(K_HIST, {}), ks = Object.keys(H).sort(), h = [];
    if (!ks.length) { $('hist').innerHTML = '<p class="hint">Nenhum mês fechado ainda. Use "Fechar o mês" no último dia.</p>'; return; }
    h.push('<div class="tbl"><table><caption>Meses fechados</caption><tr><th>Mês</th><th class="n">Recebido</th><th class="n">Despesas</th><th class="n">Resultado</th><th class="n">Saldo final</th></tr>');
    ks.forEach(function (k) { var x = H[k]; h.push('<tr><td>' + esc(C.mesNome(k)) + '</td><td class="n">' + B(x.recebido) + '</td><td class="n">' + B(x.despesas) + '</td><td class="n' + (x.resultado < 0 ? ' neg' : '') + '">' + B(x.resultado) + '</td><td class="n">' + B(x.saldoFinal) + '</td></tr>'); });
    h.push('</table></div>');
    var anos = {}; ks.forEach(function (k) { anos[k.slice(0, 4)] = 1; });
    Object.keys(anos).forEach(function (a) {
      var s = C.somaAno(H, a);
      h.push('<div class="tbl"><table><caption>Soma ' + a + ' (' + s.meses + (s.meses === 1 ? ' mês' : ' meses') + '): recebido ' + B(s.recebido) + ' · despesas ' + B(s.despesas) + ' · resultado ' + B(s.resultado) + '</caption><tr><th>Cliente</th><th class="n">Recebido no ano</th></tr>' +
        Object.keys(s.porCliente).sort(function (x, y) { return s.porCliente[y] - s.porCliente[x]; }).map(function (c) { return '<tr><td>' + esc(c) + '</td><td class="n">' + B(s.porCliente[c]) + '</td></tr>'; }).join('') + '</table></div>');
    });
    $('hist').innerHTML = h.join('');
  }
  function closeMonth() {
    if (needPro('Fechar o mês')) return;
    var r = cur.r, last = r.proj[0];
    var fim = window.prompt('Saldo em conta no último dia de ' + r.refNome + ' (R$). Sugestão pela conta de hoje:', String(last.saldoFim).replace('.', ','));
    if (fim == null) return;
    var f = C.fechar(cur.inp, fim), H = jget(K_HIST, {});
    H[f.resumo.ym] = f.resumo; jset(K_HIST, H);
    write(f.next); draw();
    $('promsg').textContent = C.mesNome(f.resumo.ym) + ' fechado. Saldo e receitas em aberto levados para ' + C.mesNome(f.next.ref.slice(0, 7)) + '.';
  }
  function dl(name, text, type) {
    var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function printMonth() {
    if (needPro('O livro caixa em PDF')) return;
    var r = cur.r, h = ['<h2>Livro caixa — ' + esc(r.refNome) + ' (referência ' + fd(r.ref) + ')</h2>'];
    h.push('<table><tr><th>Cliente</th><th>Projeto</th><th>Vencimento</th><th>Situação</th><th class="n">Valor</th></tr>' + r.recs.map(function (x) { return '<tr><td>' + esc(x.cliente) + '</td><td>' + esc(x.projeto) + '</td><td>' + fd(x.venc) + '</td><td>' + (x.st === 'recebido' ? 'recebido' : 'a receber') + '</td><td class="n">' + B(x.valor) + '</td></tr>'; }).join('') + '</table>');
    h.push('<table><tr><th>Despesa</th><th>Dia</th><th>Tipo</th><th class="n">Valor</th></tr>' + r.desp.map(function (d) { return '<tr><td>' + esc(d.nome) + '</td><td>' + d.dia + '</td><td>' + (d.tipo === 'pessoal' ? 'casa' : 'negócio') + '</td><td class="n">' + B(d.valor) + '</td></tr>'; }).join('') + '</table>');
    h.push('<p>Recebido no mês ' + B(r.recebMes) + ' · despesas ' + B(r.despMes) + ' · resultado ' + B(r.resultadoMes) + ' · saldo de referência ' + B(r.saldo) + '</p>');
    r.vencidos.forEach(function (v) { h.push('<h3>Demonstrativo de débito — ' + esc(v.cliente) + '</h3><p>' + esc(v.projeto) + ': ' + B(v.valor) + ', vencido em ' + fd(v.venc) + ' (' + v.dias + ' dias). Multa ' + B(v.multa) + ' + juros ' + B(v.juros) + ' = <b>' + B(v.total) + '</b> em ' + fd(r.ref) + '.</p>'); });
    h.push('<p class="hint">Feito com os números digitados. Não é orientação contábil.</p>');
    var p = $('print'); p.innerHTML = h.join(''); p.hidden = false; window.print();
  }
  function init() {
    var d = jget(K_DRAFT, null); write(d && d.recs ? d : clone(EXEMPLO));
    $('inputs').addEventListener('input', draw); $('inputs').addEventListener('change', draw);
    $('inputs').addEventListener('click', function (e) { if (e.target.classList.contains('x')) { e.target.parentNode.remove(); draw(); } });
    $('addrec').addEventListener('click', function () { $('recs').insertAdjacentHTML('beforeend', recRow({ venc: $('ref').value })); draw(); });
    $('adddesp').addEventListener('click', function () { $('desps').insertAdjacentHTML('beforeend', despRow({ dia: '10' })); draw(); });
    $('mine').addEventListener('click', function () { write({ ref: hoje(), saldo: '', multa: '0', juros: '0', recs: [{ venc: hoje() }], desp: [{ dia: '10' }] }); draw(); $('inputs').scrollIntoView({ behavior: 'smooth' }); });
    $('demo').addEventListener('click', function () { write(clone(EXEMPLO)); draw(); });
    $('unlock').addEventListener('click', function () { unlock($('key').value.trim(), false); });
    $('close').addEventListener('click', closeMonth);
    $('print1').addEventListener('click', printMonth);
    $('csv').addEventListener('click', function () { if (!needPro('O CSV')) dl('receitas-despesas-' + cur.r.ref.slice(0, 7) + '.csv', C.csv(cur.r), 'text/csv;charset=utf-8'); });
    $('ics').addEventListener('click', function () { if (!needPro('Os lembretes .ics')) dl('vencimentos.ics', C.ics(cur.r), 'text/calendar'); });
    $('backup').addEventListener('click', function () { if (!needPro('O backup')) dl('backup-receitas-despesas.json', JSON.stringify({ draft: read(), hist: jget(K_HIST, {}) }), 'application/json'); });
    $('restore').addEventListener('change', function (e) {
      if (needPro('Abrir backup')) return;
      var f = e.target.files[0]; if (!f) return; var fr = new FileReader();
      fr.onload = function () { try { var j = JSON.parse(fr.result); if (j.hist) jset(K_HIST, j.hist); if (j.draft) write(j.draft); draw(); $('promsg').textContent = 'Backup aberto.'; } catch (x) { $('promsg').textContent = 'Arquivo inválido.'; } };
      fr.readAsText(f);
    });
    draw();
    var m = /#k=([^&]+)/.exec(location.hash), k = m ? decodeURIComponent(m[1]) : LS.getItem(K_KEY);
    if (k) { $('key').value = k; unlock(k, !m); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
