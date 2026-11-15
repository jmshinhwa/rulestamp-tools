/* plantilla contabilidad Excel · escribe un .xlsx de verdad (con fórmulas) en el navegador, sin librerías */
(function (root) {
  'use strict';
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, 'utf8'));
  }
  function zip(files) { // método 0 (store)
    var parts = [], central = [], off = 0;
    function u16(a, v) { a.push(v & 255, (v >>> 8) & 255); }
    function u32(a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data), h = [];
      u32(h, 0x04034b50); u16(h, 20); u16(h, 0x0800); u16(h, 0); u16(h, 0); u16(h, 0x21);
      u32(h, crc); u32(h, data.length); u32(h, data.length); u16(h, name.length); u16(h, 0);
      parts.push(new Uint8Array(h), name, data);
      var c = []; u32(c, 0x02014b50); u16(c, 20); u16(c, 20); u16(c, 0x0800); u16(c, 0); u16(c, 0); u16(c, 0x21);
      u32(c, crc); u32(c, data.length); u32(c, data.length); u16(c, name.length); u16(c, 0); u16(c, 0); u16(c, 0); u16(c, 0); u32(c, 0); u32(c, off);
      central.push(new Uint8Array(c), name);
      off += h.length + name.length + data.length;
    });
    var csize = central.reduce(function (a, b) { return a + b.length; }, 0), e = [];
    u32(e, 0x06054b50); u16(e, 0); u16(e, 0); u16(e, files.length); u16(e, files.length); u32(e, csize); u32(e, off); u16(e, 0);
    var all = parts.concat(central, [new Uint8Array(e)]), len = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(len), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  // celda: número · texto · {f:'fórmula', v:valor, s:estilo} · {v, s}
  function cellXml(ref, c) {
    if (c == null || c === '') return '';
    var st = 0, v = c, f = null;
    if (typeof c === 'object') { st = c.s || 0; v = c.v; f = c.f || null; }
    var sa = st ? ' s="' + st + '"' : '';
    if (f) {
      if (typeof v === 'number') return '<c r="' + ref + '"' + sa + '><f>' + esc(f) + '</f><v>' + v + '</v></c>';
      return '<c r="' + ref + '"' + sa + ' t="str"><f>' + esc(f) + '</f><v>' + esc(v == null ? '' : v) + '</v></c>';
    }
    if (typeof v === 'number') return '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>';
    return '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
  }
  function sheetXml(sh) {
    var rows = sh.rows.map(function (r, i) {
      return '<row r="' + (i + 1) + '">' + r.map(function (c, j) { return cellXml(colName(j) + (i + 1), c); }).join('') + '</row>';
    }).join('');
    var cols = sh.widths ? '<cols>' + sh.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
    var pane = sh.freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + pane + cols + '<sheetData>' + rows + '</sheetData></worksheet>';
  }
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill></fills>' +
    '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>' +
    '<cellXfs count="6"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" applyNumberFormat="1" applyFont="1"/><xf numFmtId="165" applyNumberFormat="1"/><xf fillId="2" applyFill="1"/></cellXfs></styleSheet>';
  function build(sheets) {
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: STYLES }
    ];
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) }); });
    return zip(files);
  }

  // El libro de la plantilla: Resumen · Ventas · Gastos · Ajustes (fórmulas vivas, 300 filas de ventas y 150 de gastos)
  var NV = 300, NG = 150;
  function workbook(st, r) {
    var C = root.CONTA || (typeof require !== 'undefined' ? require('./conta.js') : null), R = C.RATES, num = C.num;
    var M = 2, B = 1, P = 4, Y = 5;
    var A = 'Ajustes!$B$';
    var sn = function (v) { return v === 'si' ? 'sí' : 'no'; };
    var aj = [
      [{ v: 'Ajustes (las celdas amarillas son tuyas)', s: B }, ''],
      ['Año', +st.anio || 2026], ['Trimestre (1–4)', +st.trim || 4], ['NIF-IVA dado a Etsy (alta en el ROI): sí / no', sn(st.roi)],
      ['Tus precios en Etsy incluyen IVA: sí / no', st.conIva === 'no' ? 'no' : 'sí'], ['Estimación directa simplificada (5 % difícil justificación): sí / no', st.gdj === 'no' ? 'no' : 'sí'],
      ['Etsy cobra IVA también sobre el procesamiento: sí / no', sn(st.ivaPago)],
      ['Tarifa de transacción', { v: R.trans, s: P }], ['Procesamiento de pagos España (%)', { v: R.payPct, s: P }], ['Procesamiento de pagos España (fijo)', { v: R.payFix, s: M }],
      ['Tarifa operativa regulatoria España', { v: R.reg, s: P }], ['Publicación por artículo vendido (0,20 USD en €)', { v: num(st.listEur), s: M }],
      ['Offsite Ads', { v: num(st.offRate) / 100, s: P }], ['IVA sobre las tarifas de Etsy', { v: R.ivaFees, s: P }], ['IVA de tus ventas', { v: R.ivaVentas, s: P }],
      ['Casilla 01 de tu último 130 de este año', { v: num(st.prev01), s: M }], ['Casilla 02 de tu último 130 de este año', { v: num(st.prev02), s: M }],
      ['Casilla 05: suma de las casillas 07 positivas anteriores', { v: num(st.prev05), s: M }], ['Minoración art. 110.3.c RIRPF (0, 25, 50, 75 o 100)', +st.ded || 0],
      ['Fuentes: Etsy Help (tarifas, leído 15/11/2026) · RIRPF arts. 30, 110 y 111 · LIVA art. 90 · LGT art. 27.2', '']
    ];
    var vh = ['Fecha', 'Producto', 'Uds.', 'Importe artículos (€)', 'Envío cobrado (€)', 'Destino (es / ue / fuera)', 'Offsite Ads (sí / no)', 'Materiales (€)', 'Envío pagado (€)',
      'Total cobrado', 'Transacción 6,5 %', 'Procesamiento', 'Regulatoria', 'Publicación', 'Offsite Ads', 'IVA sobre tarifas', 'Comisiones Etsy', 'IVA en tu precio', 'Ingreso sin IVA', 'Depósito de Etsy', 'Margen del pedido']
      .map(function (h) { return { v: h, s: B }; });
    var ven = [vh];
    for (var i = 0; i < NV; i++) {
      var n = i + 2, p = r.pedidos[i], o = st.pedidos ? st.pedidos.filter(function (q) { return num(q.imp) + num(q.env) > 0; })[i] : null;
      var J = 'J' + n, g = function (f) { return 'IF(' + J + '="","",' + f + ')'; };
      ven.push([
        p ? p.fecha : '', p ? p.prod : '', p ? p.uds : '', p ? { v: num(o.imp), s: M } : '', p ? { v: num(o.env), s: M } : '', p ? p.dest : '', p ? (p.off ? 'sí' : 'no') : '',
        p ? { v: p.mat, s: M } : '', p ? { v: p.envReal, s: M } : '',
        { f: 'IF(COUNT(D' + n + ':E' + n + ')=0,"",D' + n + '+E' + n + ')', v: p ? p.tot : '', s: M },
        { f: g('ROUND(' + J + '*' + A + '8,2)'), v: p ? p.fT : '', s: M },
        { f: g('ROUND(' + J + '*' + A + '9+' + A + '10,2)'), v: p ? p.fP : '', s: M },
        { f: g('ROUND(' + J + '*' + A + '11,2)'), v: p ? p.fR : '', s: M },
        { f: g('ROUND(C' + n + '*' + A + '12,2)'), v: p ? p.fL : '', s: M },
        { f: g('IF(G' + n + '="sí",ROUND(' + J + '*' + A + '13,2),0)'), v: p ? p.fO : '', s: M },
        { f: g('IF(' + A + '4="sí",0,ROUND(' + A + '14*(K' + n + '+M' + n + '+N' + n + '+O' + n + '+IF(' + A + '7="sí",L' + n + ',0)),2))'), v: p ? p.ivaF : '', s: M },
        { f: g('SUM(K' + n + ':P' + n + ')'), v: p ? p.fees : '', s: M },
        { f: g('IF(AND(' + A + '5="sí",F' + n + '<>"fuera"),ROUND(' + J + '*' + A + '15/(1+' + A + '15),2),0)'), v: p ? p.ivaRep : '', s: M },
        { f: g(J + '-R' + n), v: p ? p.base : '', s: M },
        { f: g(J + '-Q' + n), v: p ? p.deposito : '', s: M },
        { f: g('S' + n + '-Q' + n + '-I' + n + '-H' + n), v: p ? p.margen : '', s: M }
      ]);
    }
    var gas = [['Fecha', 'Concepto', 'Total pagado (€)', 'IVA % (21, 10, 4 o 0 si no es deducible)', 'Base (€)', 'Cuota IVA (€)'].map(function (h) { return { v: h, s: B }; })];
    for (i = 0; i < NG; i++) {
      var m = i + 2, q = r.gastos[i];
      gas.push([q ? q.fecha : '', q ? q.concepto : '', q ? { v: q.total, s: M } : '', q ? q.iva : '',
        { f: 'IF(C' + m + '="","",ROUND(C' + m + '/(1+D' + m + '/100),2))', v: q ? q.base : '', s: M },
        { f: 'IF(C' + m + '="","",C' + m + '-E' + m + ')', v: q ? q.cuota : '', s: M }]);
    }
    var V = function (c) { return 'SUM(Ventas!' + c + '2:' + c + (NV + 1) + ')'; }, Gs = function (c) { return 'SUM(Gastos!' + c + '2:' + c + (NG + 1) + ')'; };
    var res = [
      [{ v: 'plantilla contabilidad Excel · vendedores de Etsy en España', s: B }, ''],
      [{ f: '"Trimestre "&Ajustes!B3&" de "&Ajustes!B2', v: 'Trimestre ' + r.trim + ' de ' + r.anio, s: B }, ''],
      ['Cobrado en Etsy (artículos + envío)', { f: V('J'), v: r.cobrado, s: M }],
      ['Comisiones que se queda Etsy', { f: V('Q'), v: r.fees, s: 3 }],
      ['  · transacción 6,5 %', { f: V('K'), v: r.etsy.trans, s: M }],
      ['  · procesamiento de pagos', { f: V('L'), v: r.etsy.pago, s: M }],
      ['  · tarifa operativa regulatoria', { f: V('M'), v: r.etsy.reg, s: M }],
      ['  · publicación por artículo vendido', { f: V('N'), v: r.etsy.list, s: M }],
      ['  · Offsite Ads', { f: V('O'), v: r.etsy.off, s: M }],
      ['  · IVA sobre las tarifas', { f: V('P'), v: r.etsy.iva, s: M }],
      ['% de lo cobrado', { f: 'IF(B3=0,0,B4/B3)', v: r.cobrado ? Math.round(r.fees / r.cobrado * 1e6) / 1e6 : 0, s: P }],
      ['IVA dentro de tus precios (de Hacienda)', { f: V('R'), v: r.ivaRep, s: M }],
      ['Ingresos sin IVA', { f: V('S'), v: r.ingresos, s: M }],
      ['Envíos pagados', { f: V('I'), v: r.envReal, s: M }],
      ['Gastos: base', { f: Gs('E'), v: r.gBase, s: M }],
      ['Gastos: IVA soportado', { f: Gs('F'), v: r.gCuota, s: M }],
      ['Gastos: total pagado', { f: Gs('C'), v: r.gTot, s: M }],
      ['Gastos del trimestre (Etsy + envíos + base)', { f: 'B4+B14+B15', v: r.gastosQ, s: M }],
      ['Ingresos − gastos del trimestre', { f: 'B13-B18', v: r.dif, s: M }],
      ['Gastos de difícil justificación (5 %, máx. 2.000 €)', { f: 'IF(Ajustes!B6="sí",ROUND(MIN(2000,MAX(0,0.05*B19)),2),0)', v: r.gdj, s: M }],
      [{ v: 'Modelo 130', s: B }, ''],
      ['Casilla 01 (ingresos del 1 de enero al fin del trimestre)', { f: 'Ajustes!B16+B13', v: r.c01, s: M }],
      ['Casilla 02 (gastos acumulados)', { f: 'Ajustes!B17+B18+B20', v: r.c02, s: M }],
      ['Casilla 03', { f: 'B22-B23', v: r.c03, s: M }],
      ['Casilla 04 (20 %)', { f: 'IF(B24>0,ROUND(0.2*B24,2),0)', v: r.c04, s: M }],
      ['Casilla 05', { f: 'Ajustes!B18', v: r.c05, s: M }],
      ['Casilla 07', { f: 'B25-B26', v: r.c07, s: M }],
      ['Casilla 13 (minoración)', { f: 'MIN(Ajustes!B19,MAX(0,B27))', v: r.c13, s: M }],
      ['130 a ingresar', { f: 'MAX(0,B27-B28)', v: r.pago130, s: 3 }],
      [{ v: 'Modelo 303 (simplificado)', s: B }, ''],
      ['IVA repercutido en tus ventas', { f: 'B12', v: r.ivaRep, s: M }],
      ['IVA soportado deducible', { f: 'B16', v: r.gCuota, s: M }],
      ['Resultado del 303', { f: 'B31-B32', v: r.iva303, s: 3 }],
      ['Plazo del 130 y del 303', { f: 'IF(Ajustes!B3=4,"del 1 al 30 de enero de "&(Ajustes!B2+1),"del 1 al 20 de "&CHOOSE(Ajustes!B3,"abril","julio","octubre")&" de "&Ajustes!B2)', v: r.trim === 4 ? 'del 1 al 30 de enero de ' + (r.anio + 1) : 'del 1 al 20 de ' + ['abril', 'julio', 'octubre'][r.trim - 1] + ' de ' + r.anio }],
      ['Lo que te queda (cobrado − Etsy − envíos − gastos − 303 − 130)', { f: 'B3-B4-B14-B17-MAX(0,B33)-B29', v: r.caja, s: 3 }],
      ['Cálculo con los datos que escribes; no es asesoramiento fiscal. Ventas a otros países de la UE: el umbral de 10.000 € al año para aplicar el IVA del país del comprador no se calcula aquí.', '']
    ];
    return [
      { name: 'Resumen', rows: res, widths: [62, 22] },
      { name: 'Ventas', rows: ven, widths: [12, 26, 6, 14, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 14, 12, 14, 14, 14], freeze: 1 },
      { name: 'Gastos', rows: gas, widths: [12, 34, 14, 14, 12, 12], freeze: 1 },
      { name: 'Ajustes', rows: aj, widths: [62, 14] }
    ];
  }
  var api = { build: build, workbook: workbook, zip: zip, crc32: crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.XLSXW = api;
})(this);
