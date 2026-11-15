(function () {
  'use strict';
  var E = window.PEA, X = window.PEAX, SLUG = 'planilha-excel-para-autonomos';
  var DOORS = [SLUG, SLUG + '.monthly', SLUG + '.yearly'];
  var LS = { cur: 'pea.current', key: 'pea.key', rec: 'pea.recibo' };
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var NAMES = { xlsx: 'a planilha Excel (.xlsx) com 4 abas e fórmulas', ano: 'o ano em 12 meses com o limite do MEI', ics: 'os lembretes de vencimento e cobrança no calendário', recibo: 'o recibo de pagamento em PDF', backup: 'o backup dos lançamentos', imp: 'a importação do backup' };
  var pro = false, last = null;
  function $(s) { return document.querySelector(s); }
  function get(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : JSON.parse(x); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var b = E.brl;
  var fields = [].slice.call(document.querySelectorAll('[data-k]'));
  function read() { var v = {}; fields.forEach(function (el) { v[el.getAttribute('data-k')] = el.value; }); return v; }
  function fill(v) { fields.forEach(function (el) { var k = el.getAttribute('data-k'); if (v[k] != null) el.value = v[k]; }); }
  function pct(x) { return String(x).replace('.', ','); }
  function todayStr() { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }

  function render() {
    var v = read(); put(LS.cur, v);
    var o = E.compute(v); last = o;
    var mesNome = MESES[(o.mes % 100) - 1] + ' de ' + Math.floor(o.mes / 100);
    $('#o-title').textContent = 'Seu mês: ' + mesNome + ' (referência ' + E.fmtD(o.hoje) + ')';
    var t = [
      ['bad', 'Em atraso', b(o.emAtraso), o.atrasados.length + (o.atrasados.length === 1 ? ' cliente' : ' clientes') + (o.maisAntigo ? ', o mais antigo há ' + o.maisAntigo + ' dias' : '')],
      ['bad', 'Multa e juros a cobrar', b(o.encargos), 'multa ' + pct(o.multaPct) + ' % + juros ' + pct(o.jurosPct) + ' % ao mês'],
      ['good', 'Recebido no mês', b(o.recebidoMes), 'pela data em que entrou'],
      ['', 'A receber', b(o.aReceber), o.aVencer.length + ' a vencer + ' + o.atrasados.length + ' em atraso'],
      ['warn', 'Imposto a separar', b(o.imposto.total), o.regime === 'pf' ? 'INSS + carnê-leão' : o.regime === 'simples' ? 'DAS do Simples' : 'DAS-MEI 2026'],
      [o.sobra < 0 ? 'bad' : 'good', 'Sobra do mês', b(o.sobra), 'recebido − despesas − imposto']
    ];
    $('#o-tiles').innerHTML = t.map(function (x) { return '<div class="tile ' + x[0] + '"><span>' + esc(x[1]) + '</span><b>' + esc(x[2]) + '</b><small>' + esc(x[3]) + '</small></div>'; }).join('');
    var fl = [];
    if (o.bad.length) fl.push('<li class="bad">Linha ' + o.bad.join(', ') + ' não foi lida: falta cliente, valor ou vencimento (dd/mm/aaaa).</li>');
    if (o.atrasados.length) fl.push('<li class="bad">Cobrando hoje os atrasados com multa e juros: ' + esc(b(o.emAtraso + o.encargos)) + '. Cada dia a mais soma ' + esc(b(o.atrasados.reduce(function (a, r) { return a + r.valor * o.jurosPct / 100 / 30; }, 0))) + ' de juros.</li>');
    o.aVencer.forEach(function (r) { if (r.faltam <= 7) fl.push('<li>' + esc(r.cliente) + ': ' + esc(b(r.valor)) + ' vence em ' + r.faltam + (r.faltam === 1 ? ' dia' : ' dias') + ' (' + E.fmtD(r.venc) + ').</li>'); });
    var late = o.rows.filter(function (r) { return r.status === 'recebido com atraso'; });
    late.forEach(function (r) { fl.push('<li>' + esc(r.cliente) + ' pagou ' + r.diasPago + (r.diasPago === 1 ? ' dia' : ' dias') + ' depois do vencimento.</li>'); });
    if (!o.rows.length) fl.push('<li>Cole as suas cobranças acima para ver o seu mês.</li>');
    $('#o-flags').innerHTML = fl.join('');
    var ord = o.rows.slice().sort(function (a, c) { var w = { 'em atraso': 0, 'a vencer': 1, 'recebido com atraso': 2, 'recebido': 3 }; return (w[a.status] - w[c.status]) || (c.dias - a.dias) || (a.venc - c.venc); });
    $('#o-rows').innerHTML = '<thead><tr><th>Cliente</th><th>Serviço</th><th class="num">Valor</th><th>Vencimento</th><th>Situação</th><th class="num">Dias</th><th class="num">Multa</th><th class="num">Juros</th><th class="num">Cobrar hoje</th></tr></thead><tbody>' +
      ord.map(function (r) {
        var cls = r.status === 'em atraso' ? 'hot' : '';
        return '<tr class="' + cls + '"><td>' + esc(r.cliente) + '</td><td>' + esc(r.servico) + '</td><td class="num">' + esc(b(r.valor)) + '</td><td>' + E.fmtD(r.venc) + '</td><td>' + esc(r.status) + (r.rec != null ? ' em ' + E.fmtD(r.rec) : '') + '</td><td class="num">' + (r.dias || '') + '</td><td class="num">' + (r.multa ? esc(b(r.multa)) : '') + '</td><td class="num">' + (r.juros ? esc(b(r.juros)) : '') + '</td><td class="num">' + (r.rec == null ? '<b>' + esc(b(r.cobrar)) + '</b>' : '') + '</td></tr>';
      }).join('') + '</tbody>';
    var m = [['Recebido no mês', o.recebidoMes], ['Despesas do mês', -o.despesas]].concat(o.imposto.linhas.map(function (l, i) { return [l[0], (o.regime === 'pf' && (i === 1 || i === 2 || i === 3)) ? null : -Math.abs(l[1]), l[1]]; }));
    $('#o-mes').innerHTML = m.map(function (x) { var val = x[1] == null ? x[2] : x[1]; var info = x[1] == null; return '<tr' + (info ? ' class="info"' : '') + '><td>' + esc(x[0]) + '</td><td class="num">' + esc(b(val)) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>Sobra do mês</td><td class="num">' + esc(b(o.sobra)) + '</td></tr>';
    $('#o-msgs').innerHTML = o.atrasados.length ? o.atrasados.map(function (r, i) { return '<div class="msg"><p>' + esc(E.cobranca(r, o)) + '</p><button type="button" class="btn2" data-copy="' + i + '">Copiar</button></div>'; }).join('') : '<p class="small">Nenhuma cobrança em atraso.</p>';
    [].slice.call(document.querySelectorAll('[data-copy]')).forEach(function (bt) { bt.addEventListener('click', function () { copy(E.cobranca(o.atrasados[+bt.getAttribute('data-copy')], o), bt); }); });
    $('#o-summary').textContent = mesNome + ': entraram ' + b(o.recebidoMes) + ', faltam ' + b(o.aReceber) + ' a receber, dos quais ' + b(o.emAtraso) + ' em atraso (' + b(o.encargos) + ' de multa e juros). Imposto a separar ' + b(o.imposto.total) + ', sobra ' + b(o.sobra) + '.';
    var sel = $('#r-lin'), recs = o.rows.filter(function (r) { return r.rec != null; });
    sel.innerHTML = recs.length ? recs.map(function (r) { return '<option value="' + r.line + '">' + esc(r.cliente + ' · ' + b(r.valor) + ' · ' + E.fmtD(r.rec)) + '</option>'; }).join('') : '<option value="">nenhuma cobrança recebida</option>';
    if (pro && !$('#ano').hidden) drawAno();
  }
  function copy(t, bt) {
    var done = function () { if (bt) { bt.textContent = 'Copiado'; setTimeout(function () { bt.textContent = 'Copiar'; }, 1500); } };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () {});
    else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
  }
  function drawAno() {
    var y = new Date(last.hoje).getUTCFullYear(), A = E.ano(last, y);
    $('#ano-rows').innerHTML = '<thead><tr><th>' + y + '</th><th class="num">Faturado (vencimento)</th><th class="num">Recebido</th></tr></thead><tbody>' +
      A.meses.map(function (m) { return '<tr><td>' + MESES[m.mes - 1] + '</td><td class="num">' + esc(b(m.faturado)) + '</td><td class="num">' + esc(b(m.recebido)) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>Total</td><td class="num">' + esc(b(A.meses.reduce(function (s, m) { return s + m.faturado; }, 0))) + '</td><td class="num">' + esc(b(A.recebido)) + '</td></tr></tbody>';
    $('#ano-mei').textContent = 'Limite anual do MEI: R$ 81.000,00. Recebido em ' + y + ': ' + b(A.recebido) + ' (' + pct(A.usoMei.toFixed(1)) + ' % do limite).';
    $('#ano').hidden = false;
  }
  function download(name, data, type) {
    var blob = new Blob([data], { type: type }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function locked(what) {
    var m = $('#pro-msg'); m.hidden = false;
    m.innerHTML = 'Este botão abre ' + esc(NAMES[what] || ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-excel-para-autonomos/') + '' + SLUG + '';
    m.scrollIntoView({ block: 'center' });
  }
  function recibo() {
    var line = +$('#r-lin').value, r = last.rows.filter(function (x) { return x.line === line; })[0];
    if (!r) { $('#imp-msg').textContent = 'Escolha uma cobrança já recebida.'; return; }
    put(LS.rec, { nome: $('#r-nome').value, doc: $('#r-doc').value, cid: $('#r-cid').value });
    $('#print-area').innerHTML = '<div class="sheet"><h1>RECIBO</h1><p class="big">' + esc(b(r.valor)) + '</p><p>Recebi de <b>' + esc(r.cliente) + '</b> a importância de <b>' + esc(b(r.valor)) + '</b>, referente a ' + esc(r.servico || 'serviços prestados') + ', com vencimento em ' + E.fmtD(r.venc) + ', paga em ' + E.fmtD(r.rec) + '.</p><p>Para clareza, firmo o presente.</p><p>' + esc($('#r-cid').value) + ', ' + E.fmtD(r.rec) + '.</p><p class="sign">______________________________<br>' + esc($('#r-nome').value) + '<br>CPF/CNPJ ' + esc($('#r-doc').value) + '</p></div>';
    document.body.classList.add('printing'); window.print(); setTimeout(function () { document.body.classList.remove('printing'); }, 500);
  }
  function act(what) {
    if (!pro) { locked(what); return; }
    var msg = $('#imp-msg'); msg.textContent = '';
    if (what === 'xlsx') { download('planilha-autonomo-' + last.mes + '.xlsx', X.build(last), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg.textContent = 'Planilha baixada: 4 abas, ' + last.rows.length + ' lançamentos.'; }
    else if (what === 'ano') drawAno();
    else if (what === 'ics') { download('cobrancas-' + last.mes + '.ics', E.ics(last), 'text/calendar'); msg.textContent = 'Lembretes baixados: abra o arquivo para pôr no seu calendário.'; }
    else if (what === 'recibo') recibo();
    else if (what === 'backup') download('planilha-autonomo-backup.json', JSON.stringify({ v: 1, current: read(), recibo: get(LS.rec, null) }, null, 1), 'application/json');
  }
  [].slice.call(document.querySelectorAll('[data-pro]')).forEach(function (bt) { bt.addEventListener('click', function () { act(bt.getAttribute('data-pro')); }); });
  [].slice.call(document.querySelectorAll('[data-pro-file]')).forEach(function (l) { l.addEventListener('click', function (e) { if (!pro) { e.preventDefault(); locked(l.getAttribute('data-pro-file')); } }); });
  $('#imp').addEventListener('change', function () {
    var inp = this, f = inp.files && inp.files[0]; if (!f) return; var r = new FileReader();
    r.onload = function () { try { var j = JSON.parse(String(r.result)); if (j.current) fill(j.current); render(); $('#imp-msg').textContent = 'Backup carregado.'; } catch (e) { $('#imp-msg').textContent = 'Arquivo de backup inválido.'; } inp.value = ''; };
    r.readAsText(f);
  });
  function unlock(k, quiet) {
    k = String(k || '').trim(); if (!k) return;
    var i = 0;
    (function next() {
      if (i >= DOORS.length) { if (!quiet) $('#key-msg').textContent = ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-excel-para-autonomos/'; return; }
      var door = DOORS[i++];
      fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { put(LS.key, k); setPro(true); $('#key-msg').textContent = ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-excel-para-autonomos/'; }
        else next();
      }).catch(function () { if (!quiet) $('#key-msg').textContent = 'Não foi possível conferir a chave agora. Tente de novo em um minuto.'; });
    })();
  }
  function setPro(on) { pro = on; document.body.classList.toggle('is-pro', on); if (on) $('#pro-msg').hidden = true; }
  $('#key-go').addEventListener('click', function () { unlock($('#key').value); });
  window.addEventListener('hashchange', function () { var h = /[#&]k=([^&]+)/.exec(location.hash); if (h) { $('#key').value = decodeURIComponent(h[1]); unlock(decodeURIComponent(h[1])); } });
  fields.forEach(function (el) { el.addEventListener('input', render); el.addEventListener('change', render); });
  $('#reset').addEventListener('click', function () { fill(E.DEFAULTS); render(); });
  $('#mine').addEventListener('click', function () { $('#lanc').value = ''; $('#hoje').value = todayStr(); render(); $('#lanc').focus(); });
  $('#today').addEventListener('click', function () { $('#hoje').value = todayStr(); render(); });
  var sr = get(LS.rec, null); if (sr) { $('#r-nome').value = sr.nome; $('#r-doc').value = sr.doc; $('#r-cid').value = sr.cid; }
  var saved = get(LS.cur, null); fill(saved || E.DEFAULTS);
  render();
  var hk = /[#&]k=([^&]+)/.exec(location.hash);
  if (hk) { var k = decodeURIComponent(hk[1]); $('#key').value = k; unlock(k); history.replaceState(null, '', location.pathname + location.search); }
  else if (get(LS.key, '')) unlock(get(LS.key, ''), true);
})();
