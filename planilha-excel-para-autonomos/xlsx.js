/* gera a planilha .xlsx (Excel) no navegador: zip sem compressão + SpreadsheetML com fórmulas */
(function (root) {
  'use strict';
  var E = (typeof module === 'object' && module.exports) ? require('./engine.js') : root.PEA;
  var N = 200; /* linhas de lançamentos com fórmulas prontas */

  /* ---------- zip (método store) ---------- */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zip(files) {
    var parts = [], central = [], off = 0;
    var u16 = function (a, v) { a.push(v & 255, (v >>> 8) & 255); };
    var u32 = function (a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); };
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data), h = [];
      u32(h, 0x04034b50); u16(h, 20); u16(h, 0x0800); u16(h, 0); u16(h, 0); u16(h, 0x5B6F);
      u32(h, crc); u32(h, data.length); u32(h, data.length); u16(h, name.length); u16(h, 0);
      parts.push(new Uint8Array(h), name, data);
      var c = [];
      u32(c, 0x02014b50); u16(c, 20); u16(c, 20); u16(c, 0x0800); u16(c, 0); u16(c, 0); u16(c, 0x5B6F);
      u32(c, crc); u32(c, data.length); u32(c, data.length); u16(c, name.length); u16(c, 0); u16(c, 0); u16(c, 0); u16(c, 0); u32(c, 0); u32(c, off);
      central.push(new Uint8Array(c), name);
      off += h.length + name.length + data.length;
    });
    var csize = central.reduce(function (a, x) { return a + x.length; }, 0), e = [];
    u32(e, 0x06054b50); u16(e, 0); u16(e, 0); u16(e, files.length); u16(e, files.length); u32(e, csize); u32(e, off); u16(e, 0);
    var all = parts.concat(central, [new Uint8Array(e)]), len = all.reduce(function (a, x) { return a + x.length; }, 0), out = new Uint8Array(len), p = 0;
    all.forEach(function (x) { out.set(x, p); p += x.length; });
    return out;
  }

  /* ---------- células ---------- */
  function x(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function col(i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; }
  function serial(t) { return t / 86400000 + 25569; }
  /* c: {v, f, s, t} — t: 'n' número, 's' texto, 'fs' fórmula com resultado texto */
  function cellXml(ref, c) {
    if (c == null) return '';
    if (typeof c === 'string') c = { v: c, t: 's' };
    if (typeof c === 'number') c = { v: c };
    var st = c.s ? ' s="' + c.s + '"' : '';
    if (c.f) {
      var isStr = typeof c.v === 'string';
      return '<c r="' + ref + '"' + st + (isStr ? ' t="str"' : '') + '><f>' + x(c.f) + '</f>' + (c.v != null && c.v !== '' ? '<v>' + x(c.v) + '</v>' : (isStr ? '<v></v>' : '')) + '</c>';
    }
    if (typeof c.v === 'string') return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + x(c.v) + '</t></is></c>';
    if (c.v == null) return st ? '<c r="' + ref + '"' + st + '/>' : '';
    return '<c r="' + ref + '"' + st + '><v>' + c.v + '</v></c>';
  }
  function sheetXml(rows, widths, freeze) {
    var s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    if (freeze) s += '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + freeze + '" topLeftCell="A' + (freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    else s += '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    if (widths) s += '<cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    s += '<sheetData>';
    rows.forEach(function (r, i) {
      if (!r) return;
      var cells = r.map(function (c, j) { return cellXml(col(j) + (i + 1), c); }).join('');
      if (cells) s += '<row r="' + (i + 1) + '">' + cells + '</row>';
    });
    return s + '</sheetData></worksheet>';
  }

  /* estilos: 0 normal · 1 data · 2 R$ · 3 % · 4 cabeçalho · 5 R$ negrito · 6 texto negrito · 7 título */
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="&quot;R$&quot; #,##0.00;[Red]&quot;-R$&quot; #,##0.00"/><numFmt numFmtId="166" formatCode="0.00%"/></numFmts>' +
    '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEFE8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  var L = "'Lançamentos'!";
  function rng(c) { return L + '$' + c + '$2:$' + c + '$' + (N + 1); }

  function build(o) {
    var REF = 'Painel!$B$3', MUL = 'Painel!$B$4', JUR = 'Painel!$B$5';
    /* --- Lançamentos --- */
    var lr = [[{ v: 'Cliente', s: 4 }, { v: 'Serviço', s: 4 }, { v: 'Valor', s: 4 }, { v: 'Vencimento', s: 4 }, { v: 'Recebido em', s: 4 }, { v: 'Situação', s: 4 }, { v: 'Dias de atraso', s: 4 }, { v: 'Multa', s: 4 }, { v: 'Juros', s: 4 }, { v: 'Total a cobrar', s: 4 }]];
    for (var i = 0; i < N; i++) {
      var r = o.rows[i], n = i + 2;
      var f = {
        F: 'IF($C' + n + '="","",IF($E' + n + '<>"",IF($E' + n + '>$D' + n + ',"recebido com atraso","recebido"),IF($D' + n + '<' + REF + ',"em atraso","a vencer")))',
        G: 'IF($C' + n + '="","",IF($E' + n + '<>"",0,MAX(0,' + REF + '-$D' + n + ')))',
        H: 'IF($C' + n + '="","",IF(N($G' + n + ')>0,ROUND($C' + n + '*' + MUL + ',2),0))',
        I: 'IF($C' + n + '="","",IF(N($G' + n + ')>0,ROUND($C' + n + '*' + JUR + '*$G' + n + '/30,2),0))',
        J: 'IF($C' + n + '="","",IF($E' + n + '<>"",0,$C' + n + '+$H' + n + '+$I' + n + '))'
      };
      if (r) lr.push([r.cliente, r.servico, { v: r.valor, s: 2 }, { v: serial(r.venc), s: 1 }, r.rec != null ? { v: serial(r.rec), s: 1 } : { s: 1 },
        { f: f.F, v: r.status }, { f: f.G, v: r.dias }, { f: f.H, v: r.multa, s: 2 }, { f: f.I, v: r.juros, s: 2 }, { f: f.J, v: r.rec != null ? 0 : r.cobrar, s: 2 }]);
      else lr.push([null, null, { s: 2 }, { s: 1 }, { s: 1 }, { f: f.F, v: '' }, { f: f.G, v: '' }, { f: f.H, v: '', s: 2 }, { f: f.I, v: '', s: 2 }, { f: f.J, v: '', s: 2 }]);
    }
    /* --- Painel --- */
    var imp = o.imposto, reg = o.regime, regTxt = reg === 'simples' ? 'Simples Nacional' : reg === 'pf' ? 'Autônomo pessoa física (carnê-leão)' : 'MEI';
    var M1 = 'DATE(YEAR($B$3),MONTH($B$3),1)', M2 = 'EOMONTH($B$3,0)';
    var p = [];
    p[0] = [{ v: 'planilha excel para autônomos — painel do mês', s: 7 }];
    p[1] = [{ v: 'Mude só as células de B3 a B8. O resto é fórmula.', s: 0 }];
    p[2] = [{ v: 'Data de referência (hoje)', s: 6 }, { v: serial(o.hoje), s: 1 }];
    p[3] = [{ v: 'Multa do contrato', s: 6 }, { v: o.multaPct / 100, s: 3 }];
    p[4] = [{ v: 'Juros do contrato ao mês', s: 6 }, { v: o.jurosPct / 100, s: 3 }];
    p[5] = [{ v: 'Despesas do mês', s: 6 }, { v: o.despesas, s: 2 }];
    p[6] = [{ v: 'Regime', s: 6 }, regTxt];
    p[7] = [{ v: reg === 'simples' ? 'Alíquota do DAS' : reg === 'pf' ? 'INSS (contribuinte individual)' : 'DAS-MEI do mês', s: 6 }, reg === 'simples' ? { v: o.aliq / 100, s: 3 } : reg === 'pf' ? { v: 0.2, s: 3 } : { v: imp.total, s: 2 }];
    p[9] = [{ v: 'Resultado do mês', s: 4 }, { v: '', s: 4 }];
    p[10] = ['Recebido no mês', { f: 'SUMIFS(' + rng('C') + ',' + rng('E') + ',">="&' + M1 + ',' + rng('E') + ',"<="&' + M2 + ')', v: o.recebidoMes, s: 2 }];
    p[11] = ['A receber (todos os meses)', { f: 'SUMIFS(' + rng('C') + ',' + rng('F') + ',"em atraso")+SUMIFS(' + rng('C') + ',' + rng('F') + ',"a vencer")', v: o.aReceber, s: 2 }];
    p[12] = ['Em atraso', { f: 'SUMIFS(' + rng('C') + ',' + rng('F') + ',"em atraso")', v: o.emAtraso, s: 2 }];
    p[13] = ['Clientes em atraso', { f: 'COUNTIFS(' + rng('F') + ',"em atraso")', v: o.atrasados.length }];
    p[14] = ['Atraso mais antigo (dias)', { f: 'MAX(0,' + rng('G') + ')', v: o.maisAntigo }];
    p[15] = ['Multa e juros a cobrar', { f: 'SUM(' + rng('H') + ')+SUM(' + rng('I') + ')', v: o.encargos, s: 2 }];
    p[16] = ['Total a cobrar hoje dos atrasados', { f: 'B13+B16', v: E.r2(o.emAtraso + o.encargos), s: 5 }];
    var impF;
    if (reg === 'simples') impF = 'ROUND(B11*B8,2)';
    else if (reg === 'pf') {
      p[19] = [{ v: 'Carnê-leão (tabela mensal 2026)', s: 4 }, { v: '', s: 4 }];
      p[20] = ['INSS 20 % até o teto de R$ 8.475,55', { f: 'ROUND(MIN(B11,8475.55)*B8,2)', v: imp.inss, s: 2 }];
      p[21] = ['Base (recebido − INSS − despesas)', { f: 'ROUND(MAX(0,B11-B21-MIN(B6,B11)),2)', v: imp.base, s: 2 }];
      p[22] = ['IR pela tabela', { f: 'ROUND(MAX(0,B22*0.075-182.16,B22*0.15-394.16,B22*0.225-675.49,B22*0.275-908.73),2)', v: imp.ir, s: 2 }];
      p[23] = ['Redução Lei 15.270', { f: 'ROUND(MIN(B23,IF(B11<=5000,312.89,IF(B11<=7350,MAX(0,978.62-0.133145*B11),0))),2)', v: imp.red, s: 2 }];
      p[24] = ['Carnê-leão', { f: 'B23-B24', v: imp.carne, s: 2 }];
      impF = 'B21+B25';
    } else impF = 'B8';
    p[17] = ['Imposto a separar', { f: impF, v: imp.total, s: 2 }];
    p[18] = ['Sobra do mês (recebido − despesas − imposto)', { f: 'B11-B6-B18', v: o.sobra, s: 5 }];
    p[26] = [{ v: 'Não é assessoria contábil. Multa e juros = os do seu contrato. Tabelas de 2026 da Receita Federal.', s: 0 }];
    /* --- Ano --- */
    var y = new Date(o.hoje).getUTCFullYear(), A = E.ano(o, y);
    var ar = [[{ v: 'Ano ' + y + ' — faturado (pelo vencimento) e recebido (pela data de recebimento)', s: 7 }], [{ v: 'Mês', s: 4 }, { v: 'Faturado', s: 4 }, { v: 'Recebido', s: 4 }, { v: 'Ainda em aberto', s: 4 }]];
    var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    A.meses.forEach(function (m, k) {
      var n = k + 3, d1 = 'DATE(YEAR(Painel!$B$3),' + (k + 1) + ',1)', d2 = 'EOMONTH(' + d1 + ',0)';
      var open = E.r2(o.rows.filter(function (r) { var a = new Date(r.venc); return a.getUTCFullYear() === y && a.getUTCMonth() === k && r.rec == null; }).reduce(function (s, r) { return s + r.valor; }, 0));
      ar.push([MESES[k],
        { f: 'SUMIFS(' + rng('C') + ',' + rng('D') + ',">="&' + d1 + ',' + rng('D') + ',"<="&' + d2 + ')', v: m.faturado, s: 2 },
        { f: 'SUMIFS(' + rng('C') + ',' + rng('E') + ',">="&' + d1 + ',' + rng('E') + ',"<="&' + d2 + ')', v: m.recebido, s: 2 },
        { f: 'SUMIFS(' + rng('C') + ',' + rng('D') + ',">="&' + d1 + ',' + rng('D') + ',"<="&' + d2 + ',' + rng('E') + ',"")', v: open, s: 2 }]);
    });
    var fat = E.r2(A.meses.reduce(function (s, m) { return s + m.faturado; }, 0));
    ar.push([{ v: 'Total', s: 6 }, { f: 'SUM(B3:B14)', v: fat, s: 5 }, { f: 'SUM(C3:C14)', v: A.recebido, s: 5 }, { f: 'SUM(D3:D14)', v: E.r2(ar.slice(2).reduce(function (s, r) { return s + r[3].v; }, 0)), s: 5 }]);
    ar.push(null);
    ar.push(['Limite anual do MEI', { v: 81000, s: 2 }]);
    ar.push(['Usado do limite (recebido)', { f: 'C15/B17', v: A.recebido / 81000, s: 3 }]);
    /* --- Como usar --- */
    var cu = [[{ v: 'Como usar', s: 7 }],
      ['1. Na aba Lançamentos, uma linha por cobrança: cliente, serviço, valor, vencimento e, quando pagar, a data em que entrou.'],
      ['2. Deixe "Recebido em" vazio enquanto o cliente não pagar. Depois do vencimento a linha vira "em atraso" e calcula multa e juros.'],
      ['3. Juros pro rata: valor × juros ao mês × dias de atraso ÷ 30. Multa: valor × multa do contrato, uma vez.'],
      ['4. No Painel, mude a data de referência para ver qualquer mês. A aba Ano soma os 12 meses.'],
      ['Gerada em ' + E.fmtD(o.hoje) + ' pela página "planilha excel para autônomos". Funciona no Excel, no Google Planilhas e no LibreOffice, sem macros.']];
    var sheets = [
      { name: 'Painel', xml: sheetXml(p, [46, 20]) },
      { name: 'Lançamentos', xml: sheetXml(lr, [24, 24, 14, 13, 13, 20, 14, 12, 12, 15], 1) },
      { name: 'Ano', xml: sheetXml(ar, [26, 16, 16, 16]) },
      { name: 'Como usar', xml: sheetXml(cu, [120]) }
    ];
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + x(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: STYLES }
    ].concat(sheets.map(function (s, i) { return { name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: s.xml }; }));
    return zip(files);
  }

  var api = { build: build, zip: zip, crc32: crc32, ROWS: N };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PEAX = api;
})(this);
