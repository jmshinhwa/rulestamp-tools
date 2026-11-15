/* planilha fiscal para autónomos · escreve um .xlsx a sério (com fórmulas) no navegador, sem bibliotecas */
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
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="0.00%"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill></fills>' +
    '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>' +
    '<cellXfs count="7"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" applyNumberFormat="1" applyFont="1"/><xf numFmtId="165" applyNumberFormat="1"/><xf fillId="2" applyFill="1"/><xf numFmtId="166" applyNumberFormat="1"/></cellXfs></styleSheet>';
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

  var api = { build: build, zip: zip, crc32: crc32, colName: colName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.XLSXW = api;
})(this);
