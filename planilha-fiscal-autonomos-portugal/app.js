(function () {
  'use strict';
  var doc = document, LS = window.localStorage, F = window.FISCAL, X = window.XLSXW, PL = window.PLANILHA;
  var SLUG = 'planilha-fiscal-autonomos-portugal', DOORS = [SLUG, SLUG + '.yearly'];
  var K_ST = 'pfa_state_v1', K_KEY = 'pfa_key_v1', K_H = 'pfa_years_v1';
  var KEYS = ['ano', 'inicio', 'vol_ant', 'iva', 'dispensa', 'ret_taxa', 'taxa_ss', 'aj_jan2', 'lucro_co'];
  var E = F.eur, pro = false, st, cur;

  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) { /* cheio ou bloqueado */ } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fd(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function opt(v, label, c) { return '<option value="' + v + '"' + (String(c) === v ? ' selected' : '') + '>' + label + '</option>'; }

  function recRow(r) {
    var d = doc.createElement('div'); d.className = 'row rec';
    d.innerHTML = '<label class="sr"><span>Data</span><input type="date" class="r-data" value="' + esc(r.data) + '"></label>' +
      '<label class="sr"><span>Cliente</span><input class="r-cliente" value="' + esc(r.cliente) + '"></label>' +
      '<label class="sr"><span>Valor sem IVA (€)</span><input class="r-valor" inputmode="decimal" value="' + esc(r.valor) + '"></label>' +
      '<label class="sr"><span>Tipo</span><select class="r-tipo">' + opt('serv', 'serviços (70 %)', r.tipo || 'serv') + opt('bens', 'venda de bens (20 %)', r.tipo) + '</select></label>' +
      '<label class="sr"><span>Contabilidade organizada</span><select class="r-empresa">' + opt('sim', 'sim: retém', r.empresa || 'sim') + opt('nao', 'não (particular)', r.empresa) + '</select></label>' +
      '<button class="x" type="button" aria-label="apagar">×</button>';
    return d;
  }
  function fill(s) {
    KEYS.forEach(function (k) { if (k === 'aj_jan2') { $(k).value = String((s.aj || {}).jan2 || 0); } else if ($(k) && s[k] != null) $(k).value = s[k]; });
    var box = $('recs'); box.innerHTML = '';
    (s.recibos || []).forEach(function (r) { box.appendChild(recRow(r)); });
  }
  function read() {
    var s = {};
    KEYS.forEach(function (k) { s[k] = $(k).value; });
    s.aj = { jan: 0, abr: 0, jul: 0, out: 0, jan2: +s.aj_jan2 || 0 }; delete s.aj_jan2;
    s.recibos = [].map.call(doc.querySelectorAll('#recs .row'), function (r) {
      return { data: r.querySelector('.r-data').value, cliente: r.querySelector('.r-cliente').value, valor: r.querySelector('.r-valor').value, tipo: r.querySelector('.r-tipo').value, empresa: r.querySelector('.r-empresa').value };
    });
    return s;
  }
  function kpi(label, val, small, cls) { return '<div class="kpi ' + (cls || '') + '"><span>' + esc(label) + '</span><b>' + val + '</b>' + (small ? '<small>' + esc(small) + '</small>' : '') + '</div>'; }
  function render() {
    st = read(); jset(K_ST, st);
    var r = cur = F.compute(st), Y = r.ano, n = r.next;
    var ivaK;
    if (r.ivaEstado === 'devido') ivaK = kpi('IVA devido desde ' + fd(r.cross1875), E(r.ivaDev), 'passou os 18.750 € (art. 58.º): cobra 23 % a partir desse recibo', 'loss');
    else if (r.ivaEstado === 'proximo_ano') ivaK = kpi('IVA: passou 15.000 € a ' + fd(r.cross15), E(r.falta1875), 'é o que falta para os 18.750 €; regime normal a 01/01/' + (Y + 1), 'loss');
    else if (r.ivaEstado === 'isento') ivaK = kpi('IVA: ainda isento (art. 53.º)', E(r.falta15), 'é o que falta faturar até aos 15.000 €');
    else ivaK = kpi('IVA', 'regime normal', 'cobra IVA desde o início do ano');
    var retK = r.dispOk ? (r.dispFim ? kpi('Dispensa de retenção acaba em ' + r.dispFim.mes, E(r.retPerdida), 'retido pelos clientes depois disso', 'loss') : kpi('Dispensa de retenção', 'ainda vale', 'até atingir 15.000 € no ano'))
      : kpi('Retenção na fonte em ' + Y, E(r.ret), (r.retRate === 0.23 ? '23 %' : '11,5 %') + ' dos recibos a clientes com contabilidade organizada');
    var h = '<p class="eyebrow">' + (isDemo() ? 'Exemplo (inventado): freelancer em Lisboa a recibos verdes · ' : 'Os seus recibos · ') + r.rows.length + ' recibos de ' + Y + '</p>' +
      '<div class="kpis">' +
      kpi('Segurança Social a partir de ' + n.months[0].mes, E(n.contrib) + ' /mês', n.nome + ' até ' + n.prazo + ': 70 % × ' + E(n.serv) + ' ÷ 3 × ' + (r.rate === 0.214 ? '21,4' : '25,2') + ' %', 'big') +
      ivaK + retK +
      kpi('Faturado em ' + Y, E(r.vol), 'limites: 15.000 € e 18.750 €') +
      kpi('Segurança Social de ' + Y, E(r.ssAno), '12 meses, 4 declarações') +
      '</div>';
    h += '<h3>As 5 declarações trimestrais</h3><table class="t"><thead><tr><th>Declaração (prazo)</th><th>Rendimentos de</th><th>Faturado</th><th>Base mensal</th><th>Por mês</th></tr></thead><tbody>' +
      r.decls.map(function (d) {
        var isento = d.months.every(function (m) { return m.isento; });
        return '<tr><td>' + esc(d.nome) + ' (até ' + d.prazo + ')</td><td>' + esc(d.periodo) + '</td><td>' + E(d.serv + d.bens) + '</td><td>' + E(d.base) + (d.aj ? ' (' + (d.aj > 0 ? '+' : '') + d.aj + ' %)' : '') + '</td><td>' +
          (isento ? 'isento (1.º ano)' : E(d.contrib) + (d.minimo ? ' (mínimo)' : '') + (d.capped ? ' (teto)' : '')) + '</td></tr>';
      }).join('') + '</tbody></table>';
    h += '<h3>Recibo a recibo</h3><table class="t"><thead><tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Acumulado</th><th>IVA</th><th>Retenção</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr' + (x.nota ? ' class="mark"' : '') + '><td>' + fd(x.data) + '</td><td>' + esc(x.cliente) + (x.nota ? '<br><small>' + esc(x.nota) + '</small>' : '') + '</td><td>' + E(x.valor) + '</td><td>' + E(x.acum) + '</td><td>' + E(x.iva) + '</td><td>' + E(x.ret) + '</td></tr>'; }).join('') + '</tbody></table>';
    if (r.co) h += '<p class="note">Contabilidade organizada: 1/12 de ' + E(r.co.lucro) + ' → base ' + E(r.co.base) + ' → ' + E(r.co.contrib) + ' por mês (' + E(r.co.ano) + ' no ano) contra ' + E(r.ssAno) + ' pela declaração trimestral em ' + Y + '. A mudança pede-se até 30 de novembro no Portal da Segurança Social.</p>';
    $('out').innerHTML = h;
  }
  function isDemo() { return JSON.stringify(st.recibos) === JSON.stringify(F.EXEMPLO.recibos) && st.vol_ant === F.EXEMPLO.vol_ant; }

  // ---- Pro ----
  function setPro(on) { pro = on; doc.body.classList.toggle('is-pro', on); $('keymsg').textContent = on ? ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-fiscal-autonomos-portugal/' : ''; hist(); }
  function check(k) {
    var i = 0;
    function next() {
      if (i >= DOORS.length) return Promise.resolve(false);
      var door = DOORS[i++];
      return fetch('' + encodeURIComponent(k) + '&slug=' + encodeURIComponent(door)).then(function (r) { return r.json(); })
        .then(function (j) { return j && j.ok ? true : next(); }, function () { return next(); });
    }
    return next().then(function (ok) { if (ok) { jset(K_KEY, k); setPro(true); } else $('keymsg').textContent = ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-fiscal-autonomos-portugal/'; return ok; });
  }
  function msg(t) { $('promsg').textContent = t; }
  function need(what) { if (pro) return true; msg(what + ' — Salvar e continuar: https://getreadystack.com/pt/apps/planilha-fiscal-autonomos-portugal/'); location.hash = '#pro'; return false; }
  function dl(name, data, type) {
    var b = new Blob([data], { type: type }), a = doc.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function xlsx() { if (!need('O Excel')) return; var nm = 'planilha-fiscal-autonomos-' + cur.ano + '.xlsx'; dl(nm, X.build(PL.workbook(st, cur)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg('Excel descarregado: ' + nm + '.'); }
  function icsDl() { if (!need('Os lembretes')) return; var ev = F.icsEvents(cur); dl('segurança-social-' + cur.ano + '.ics', F.ics(cur), 'text/calendar'); msg(ev.length + ' lembretes de ' + cur.ano + ' descarregados (2 dias antes de cada um).'); }
  function importCsv(file) {
    if (!need('Importar CSV')) return;
    var fr = new FileReader();
    fr.onload = function () {
      var rows = F.parseCsv(fr.result), s = read();
      s.recibos = s.recibos.filter(function (r) { return F.num(r.valor) > 0; }).concat(rows);
      fill(s); render(); msg(rows.length + ' recibos importados do CSV.');
    };
    fr.readAsText(file);
  }
  function closeYear() {
    if (!need('Fechar o ano')) return;
    var H = jget(K_H, []).filter(function (x) { return x.ano !== cur.ano; });
    H.push({ ano: cur.ano, vol: cur.vol, ss: cur.ssAno, iva: cur.ivaDev, ret: cur.ret, jan: cur.next.contrib });
    jset(K_H, H);
    var nx = F.rollYear(st); fill(nx); render(); hist();
    msg('Ano ' + (cur.ano - 1) + ' fechado: volume ' + E(H[H.length - 1].vol) + ' passou para "ano anterior"; os recibos de outubro a dezembro ficaram para a declaração de janeiro.');
  }
  function hist() {
    var H = jget(K_H, []);
    $('hist').innerHTML = pro && H.length ? '<table class="t"><thead><tr><th>Ano</th><th>Faturado</th><th>Segurança Social</th><th>IVA devido</th><th>Retenção</th></tr></thead><tbody>' +
      H.sort(function (a, b) { return a.ano - b.ano; }).map(function (x) { return '<tr><td>' + x.ano + '</td><td>' + E(x.vol) + '</td><td>' + E(x.ss) + '</td><td>' + E(x.iva) + '</td><td>' + E(x.ret) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
  }
  function printIt() {
    if (!need('O resumo em PDF')) return;
    var p = $('print'); p.hidden = false;
    p.innerHTML = '<h2>planilha fiscal para autónomos · resumo de ' + cur.ano + '</h2>' + $('out').innerHTML + '<p class="hint">Regras lidas a 15/11/2026: Código dos Regimes Contributivos e FAQ do ISS, CIVA arts. 53.º e 58.º, CIRS arts. 101.º e 101.º-B, Portaria 480-A/2025/1 (IAS 537,13 €). Não é aconselhamento fiscal.</p>';
    doc.body.classList.add('printing'); window.print(); setTimeout(function () { doc.body.classList.remove('printing'); p.hidden = true; }, 800);
  }
  function backup() { if (!need('A cópia')) return; dl('planilha-fiscal-copia.json', JSON.stringify({ st: st, years: jget(K_H, []) }), 'application/json'); }
  function restore(file) {
    if (!need('Abrir cópia')) return;
    var fr = new FileReader(); fr.onload = function () { try { var j = JSON.parse(fr.result); if (j.years) jset(K_H, j.years); fill(j.st); render(); hist(); msg('Cópia aberta.'); } catch (e) { msg('Esse ficheiro não é uma cópia desta planilha.'); } }; fr.readAsText(file);
  }

  // ---- arranque ----
  fill(jget(K_ST, null) || clone(F.EXEMPLO)); render();
  $('demo').onclick = function () { fill(clone(F.EXEMPLO)); render(); };
  $('mine').onclick = function () {
    var s = clone(F.EXEMPLO); s.vol_ant = ''; s.inicio = ''; s.recibos = [{ data: '', cliente: '', valor: '', tipo: 'serv', empresa: 'sim' }];
    fill(s); render(); var f = doc.querySelector('#recs .r-data'); if (f) f.focus();
  };
  $('addrec').onclick = function () { $('recs').appendChild(recRow({ data: '', cliente: '', valor: '', tipo: 'serv', empresa: 'sim' })); };
  $('xlsx').onclick = xlsx; $('icsb').onclick = icsDl; $('close').onclick = closeYear; $('print1').onclick = printIt; $('backup').onclick = backup;
  $('csvin').onchange = function (e) { if (e.target.files[0]) importCsv(e.target.files[0]); e.target.value = ''; };
  $('restore').onchange = function (e) { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; };
  $('unlock').onclick = function () { var k = $('key').value.trim(); if (k) check(k); };
  doc.addEventListener('input', function (e) { if (e.target.closest('#inputs')) render(); });
  doc.addEventListener('change', function (e) { if (e.target.closest('#inputs')) render(); });
  doc.addEventListener('click', function (e) { if (e.target.classList.contains('x')) { e.target.parentNode.remove(); render(); } });
  var hk = /[#&]k=([^&]+)/.exec(location.hash), saved = jget(K_KEY, '');
  if (hk) { var k = decodeURIComponent(hk[1]); $('key').value = k; check(k).then(function (ok) { if (ok) history.replaceState(null, '', location.pathname + '#pro'); }); }
  else if (saved) check(saved);
})();
