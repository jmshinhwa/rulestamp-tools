/* gastos mensuales Excel · control de recibos domiciliados — engine (browser + node). No network. */
(function (root) {
  'use strict';
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DEV_DIAS = 56;          // art. 49.1 RDL 19/2018: ocho semanas desde la fecha de adeudo
  var NOAUT_MESES = 13;       // art. 43.1 RDL 19/2018: trece meses desde la fecha del adeudo (no autorizado)
  var RX_RECIBO = /recibo|adeudo|domic|sepa|cargo cuota|cuota/i;

  var DEFAULTS = {
    mes: '2026-10',
    hoy: '2026-11-18',
    tol: '2',
    recibos: [
      'Luz; ELECTRA SUR; 5; 62,40',
      'Fibra y móvil; TELCO FIBRA; 3; 45,00',
      'Gimnasio; GYM CENTRO; 1; 39,90',
      'Comunidad; COMUNIDAD PROP; 10; 55,00',
      'Seguro de hogar; SEGUROS AZUL; 15; 186,30; 12; 10',
      'Agua; AGUAS MUNICIPALES; 20; 31,20; 2; 2',
      'Plataforma TV; STREAMFLIX; 22; 13,99',
      'Gas; GAS NORTE; 12; 38,90; 2; 1'
    ].join('\n'),
    cargos: [
      '01/10/2026;RECIBO GYM CENTRO;-39,90',
      '03/10/2026;RECIBO TELCO FIBRA SL;-49,50',
      '05/10/2026;RECIBO ELECTRA SUR SA;-62,40',
      '08/10/2026;COMPRA TARJETA SUPERMERCADO;-84,35',
      '10/10/2026;RECIBO COMUNIDAD PROP;-55,00',
      '12/10/2026;TRANSFERENCIA ALQUILER OCTUBRE;-850,00',
      '15/10/2026;RECIBO SEGUROS AZUL;-214,60',
      '22/10/2026;RECIBO STREAMFLIX;-13,99',
      '22/10/2026;RECIBO STREAMFLIX;-13,99',
      '24/10/2026;RECIBO REVISTA DIGITAL PLUS;-9,99',
      '25/10/2026;NOMINA OCTUBRE;1.850,00'
    ].join('\n')
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function eur(x) {
    var n = r2(x), neg = n < 0, a = Math.abs(n), ent = Math.floor(a), dec = Math.round((a - ent) * 100);
    if (dec === 100) { ent += 1; dec = 0; }
    var s = String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + s + ',' + (dec < 10 ? '0' : '') + dec + ' €';
  }
  // "1.234,56" · "-62,40" · "62.40" · "−13,99 €" → number
  function num(s) {
    var t = String(s == null ? '' : s).replace(/[€\s ]/g, '').replace(/[−–]/g, '-');
    if (!t) return NaN;
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    else t = t.replace(/,/g, '');
    var n = parseFloat(t);
    return isFinite(n) ? n : NaN;
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function dmy(d) { return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); }
  function corto(d) { return d.getUTCDate() + ' ' + MESES[d.getUTCMonth()]; }
  function mkDate(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function addMonths(d, n) {
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1 + n, day = d.getUTCDate();
    while (m > 12) { m -= 12; y++; }
    return mkDate(y, m, Math.min(day, lastDay(y, m)));
  }
  function daysBetween(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
  // fechas: 03/10/2026 · 3-10-26 · 2026-10-03 · 03.10.2026
  function parseDate(s) {
    var t = String(s || '').trim(), m;
    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return mkDate(+m[1], +m[2], +m[3]);
    if ((m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) { var y = +m[3]; if (y < 100) y += 2000; if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null; return mkDate(y, +m[2], +m[1]); }
    return null;
  }
  function parseMonth(s) {
    var m = String(s || '').match(/(\d{4})-(\d{1,2})/);
    if (!m) return null;
    var y = +m[1], mo = +m[2];
    return mo >= 1 && mo <= 12 ? { y: y, m: mo } : null;
  }

  // recibos: "nombre; texto en el banco; día; importe [; cada N meses; primer mes]"
  function parseRecibos(txt) {
    var out = [];
    String(txt || '').split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim() || /^\s*#/.test(line)) return;
      var p = line.split(/;|\t/).map(function (x) { return x.trim(); });
      var name = p[0], banco = p[1] || p[0], dia = parseInt(p[2], 10), imp = num(p[3]);
      var cada = parseInt(p[4], 10), primero = parseInt(p[5], 10);
      if (!name || !isFinite(imp)) return;
      if (!(dia >= 1 && dia <= 31)) dia = 1;
      if ([1, 2, 3, 4, 6, 12].indexOf(cada) < 0) cada = 1;
      if (!(primero >= 1 && primero <= 12)) primero = 1;
      out.push({ i: out.length, line: i + 1, name: name, banco: banco, key: norm(banco), dia: dia, importe: r2(Math.abs(imp)), cada: cada, primero: primero });
    });
    return out;
  }
  function venceEn(rc, m) { return ((m - rc.primero) % rc.cada + rc.cada) % rc.cada === 0; }

  // cargos pegados del banco: "fecha; concepto; importe" (separador ; tab o ,) · también formato con columnas extra (saldo): toma el primer importe tras el concepto
  function parseCargos(txt) {
    var out = [];
    String(txt || '').split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var p = line.indexOf(';') > -1 ? line.split(';') : line.indexOf('\t') > -1 ? line.split('\t') : line.split(/,(?=\S)/);
      p = p.map(function (x) { return x.trim().replace(/^"|"$/g, ''); });
      var d = parseDate(p[0]); if (!d) return;
      var concepto = '', imp = NaN;
      for (var k = 1; k < p.length; k++) {
        if (!concepto && p[k] && !isFinite(num(p[k])) && !parseDate(p[k])) { concepto = p[k]; continue; }
        if (concepto && isFinite(num(p[k]))) { imp = num(p[k]); break; }
      }
      if (!concepto || !isFinite(imp)) return;
      out.push({ i: out.length, fecha: d, concepto: concepto, key: norm(concepto), importe: r2(imp) });
    });
    return out;
  }

  function cfgOf(v) {
    var mm = parseMonth(v.mes) || { y: 2026, m: 10 };
    var hoy = parseDate(v.hoy) || addDays(mkDate(mm.y, mm.m, lastDay(mm.y, mm.m)), 1);
    var tol = num(v.tol); if (!isFinite(tol) || tol < 0) tol = 2;
    return { y: mm.y, m: mm.m, hoy: hoy, tol: tol };
  }
  function plazo(c, hoy) {
    var lim = addDays(c.fecha, DEV_DIAS), na = addMonths(c.fecha, NOAUT_MESES);
    return { hasta: lim, quedan: daysBetween(hoy, lim), noAut: na };
  }

  // analiza un mes: recibos esperados vs cargos del banco
  function check(v) {
    var cfg = cfgOf(v), recibos = parseRecibos(v.recibos), cargos = parseCargos(v.cargos);
    var delMes = cargos.filter(function (c) { return c.fecha.getUTCFullYear() === cfg.y && c.fecha.getUTCMonth() + 1 === cfg.m; });
    var salidas = delMes.filter(function (c) { return c.importe < 0; });
    var used = {}, filas = [], flags = [];
    // match longest bank text first so "GAS NORTE" does not eat "GAS NORTE TARIFA"
    var orden = recibos.slice().sort(function (a, b) { return b.key.length - a.key.length; });
    var hits = {};
    orden.forEach(function (rc) {
      hits[rc.i] = salidas.filter(function (c) {
        if (used[c.i] || !rc.key) return false;
        var ok = (' ' + c.key + ' ').indexOf(' ' + rc.key + ' ') > -1;
        if (ok) used[c.i] = rc.i;
        return ok;
      });
    });
    recibos.forEach(function (rc) {
      var toca = venceEn(rc, cfg.m), hs = hits[rc.i] || [], cobrado = r2(hs.reduce(function (s, c) { return s - c.importe; }, 0));
      var f = { rc: rc, toca: toca, cargos: hs, cobrado: cobrado, esperado: toca ? rc.importe : 0, estado: 'ok', dif: 0, extra: 0, anual: 0, plazo: null, txt: '' };
      var dia = Math.min(rc.dia, lastDay(cfg.y, cfg.m));
      if (!hs.length) {
        if (toca) {
          var fechaEsp = mkDate(cfg.y, cfg.m, dia);
          f.estado = daysBetween(fechaEsp, cfg.hoy) > 3 ? 'falta' : 'pendiente';
          f.txt = f.estado === 'falta' ? 'Sin cargo: tocaba el ' + corto(fechaEsp) : 'Aún no ha llegado (toca el ' + corto(fechaEsp) + ')';
        } else { f.estado = 'notoca'; f.txt = 'No toca este mes (cada ' + rc.cada + ' meses)'; }
      } else {
        var first = hs[0], amt1 = -first.importe;
        if (hs.length > 1) {
          var dup = hs.slice(1);
          f.estado = 'doble'; f.extra = r2(dup.reduce(function (s, c) { return s - c.importe; }, 0));
          f.plazo = plazo(dup[0], cfg.hoy);
          f.txt = 'Cobrado ' + hs.length + ' veces: ' + eur(f.extra) + ' de más';
          flags.push({ tipo: 'doble', nombre: rc.name, importe: f.extra, cargo: dup[0], plazo: f.plazo });
        }
        var limite = r2(rc.importe * (1 + cfg.tol / 100));
        if (amt1 > limite + 0.004) {
          f.dif = r2(amt1 - rc.importe);
          f.anual = r2(f.dif * 12 / rc.cada);
          var pct = rc.importe ? Math.round(f.dif / rc.importe * 1000) / 10 : 0;
          if (f.estado !== 'doble') { f.estado = 'subida'; f.plazo = plazo(first, cfg.hoy); }
          f.pct = pct;
          f.txt = (f.txt ? f.txt + ' · ' : '') + 'Sube ' + eur(f.dif) + ' (+' + String(pct).replace('.', ',') + ' %)';
          flags.push({ tipo: 'subida', nombre: rc.name, importe: f.dif, cargo: first, plazo: plazo(first, cfg.hoy), anual: f.anual, pct: pct });
        } else if (!toca && f.estado !== 'doble') {
          f.estado = 'fuera'; f.plazo = plazo(first, cfg.hoy);
          f.txt = 'Cobrado en un mes que no tocaba';
          flags.push({ tipo: 'fuera', nombre: rc.name, importe: -first.importe, cargo: first, plazo: f.plazo });
        } else if (f.estado === 'ok') {
          f.txt = amt1 < rc.importe - 0.004 ? 'Baja ' + eur(rc.importe - amt1) : 'Como siempre';
        }
      }
      filas.push(f);
    });
    // recibos del banco que no esperabas (solo líneas de recibo/adeudo; las compras con tarjeta y transferencias no)
    var otros = [], gastoOtros = 0;
    salidas.forEach(function (c) {
      if (used[c.i] != null) return;
      if (RX_RECIBO.test(c.concepto)) {
        var pz = plazo(c, cfg.hoy);
        otros.push({ cargo: c, plazo: pz });
        flags.push({ tipo: 'nuevo', nombre: c.concepto, importe: -c.importe, cargo: c, plazo: pz });
      } else gastoOtros = r2(gastoOtros - c.importe);
    });
    flags.forEach(function (f) { f.vivo = f.plazo.quedan >= 0; });
    var revisar = r2(flags.reduce(function (s, f) { return s + f.importe; }, 0));
    var vivos = flags.filter(function (f) { return f.vivo; }).sort(function (a, b) { return a.plazo.hasta - b.plazo.hasta; });
    var esperado = r2(filas.reduce(function (s, f) { return s + f.esperado; }, 0));
    var cobradoRecibos = r2(filas.reduce(function (s, f) { return s + f.cobrado; }, 0) + otros.reduce(function (s, o) { return s - o.cargo.importe; }, 0));
    var anual = r2(filas.reduce(function (s, f) { return s + f.anual; }, 0));
    return {
      cfg: cfg, recibos: recibos, cargos: delMes, filas: filas, otros: otros, flags: flags, vivos: vivos,
      revisar: revisar, anual: anual, esperado: esperado, cobrado: cobradoRecibos, gastoOtros: gastoOtros,
      total: r2(cobradoRecibos + gastoOtros),
      faltan: filas.filter(function (f) { return f.estado === 'falta'; }),
      fuera: cargos.length - delMes.length
    };
  }

  var TIPO = { subida: 'Subida', doble: 'Cobro doble', nuevo: 'Recibo que no esperabas', fuera: 'Fuera de su mes' };
  function mesNombre(cfg) { return MESES_L[cfg.m - 1] + ' ' + cfg.y; }

  function tilesHtml(r) {
    var first = r.vivos[0], n = r.flags.length;
    var t1 = '<div class="tile bad"><span>A revisar en ' + esc(mesNombre(r.cfg)) + '</span><b>' + eur(r.revisar) + '</b><i>' + n + (n === 1 ? ' cargo' : ' cargos') + ': ' +
      esc(r.flags.map(function (f) { return TIPO[f.tipo].toLowerCase() + ' ' + f.nombre; }).join(', ') || 'ninguno') + '</i></div>';
    var t2 = first ? '<div class="tile hot"><span>Primer plazo para devolverlo en el banco</span><b>' + dmy(first.plazo.hasta) + '</b><i>quedan ' + first.plazo.quedan + ' días · ' + esc(first.nombre) + ' ' + eur(first.importe) + ' · 8 semanas desde el cargo</i></div>'
      : '<div class="tile"><span>Plazo de 8 semanas</span><b>' + (n ? 'pasado' : '—') + '</b><i>' + (n ? 'los cargos marcados tienen más de 8 semanas' : 'nada que devolver este mes') + '</i></div>';
    var t3 = '<div class="tile"><span>Las subidas te cuestan al año</span><b>' + eur(r.anual) + '</b><i>' + esc(r.filas.filter(function (f) { return f.anual; }).map(function (f) { return f.rc.name + ' ' + eur(f.anual); }).join(' · ') || 'ninguna subida') + '</i></div>';
    return t1 + t2 + t3;
  }
  function rowsHtml(r) {
    var rows = r.filas.map(function (f) {
      var cls = { subida: 'neg', doble: 'neg', fuera: 'neg', falta: 'warn' }[f.estado] || (f.estado === 'notoca' ? 'mute' : '');
      return '<tr class="' + cls + '"><td class="sc"><b>' + esc(f.rc.name) + '</b><small>' + esc(f.rc.banco) + ' · día ' + f.rc.dia + (f.rc.cada > 1 ? ' · cada ' + f.rc.cada + ' meses' : '') + '</small></td>' +
        '<td class="nm">' + (f.toca ? eur(f.esperado) : '—') + '</td><td class="nm">' + (f.cargos.length ? f.cargos.map(function (c) { return eur(-c.importe) + ' <small>' + corto(c.fecha) + '</small>'; }).join('') : '—') + '</td>' +
        '<td>' + esc(f.txt) + '</td><td class="nm">' + (f.plazo ? (f.plazo.quedan >= 0 ? '<b>' + dmy(f.plazo.hasta) + '</b><small>quedan ' + f.plazo.quedan + ' días</small>' : '<small>pasado (' + dmy(f.plazo.hasta) + ')</small>') : '') + '</td></tr>';
    });
    r.otros.forEach(function (o) {
      rows.push('<tr class="neg"><td class="sc"><b>' + esc(o.cargo.concepto) + '</b><small>no está en tu lista de recibos</small></td><td class="nm">—</td><td class="nm">' + eur(-o.cargo.importe) + ' <small>' + corto(o.cargo.fecha) + '</small></td>' +
        '<td>Recibo que no esperabas: si no lo autorizaste, tienes hasta el ' + dmy(o.plazo.noAut) + ' (13 meses)</td><td class="nm">' + (o.plazo.quedan >= 0 ? '<b>' + dmy(o.plazo.hasta) + '</b><small>quedan ' + o.plazo.quedan + ' días</small>' : '<small>pasado (' + dmy(o.plazo.hasta) + ')</small>') + '</td></tr>');
    });
    return rows.join('');
  }
  function summary(r) {
    var s = 'Recibos de ' + mesNombre(r.cfg) + ': esperado ' + eur(r.esperado) + ', cobrado ' + eur(r.cobrado) + '. A revisar ' + eur(r.revisar);
    if (r.flags.length) s += ' (' + r.flags.map(function (f) { return TIPO[f.tipo].toLowerCase() + ' ' + f.nombre + ' ' + eur(f.importe) + (f.vivo ? ', devolver hasta ' + dmy(f.plazo.hasta) : ', plazo pasado'); }).join('; ') + ')';
    s += '. Subidas al año: ' + eur(r.anual) + '.';
    if (r.faltan.length) s += ' Sin cargo: ' + r.faltan.map(function (f) { return f.rc.name + ' ' + eur(f.rc.importe); }).join(', ') + '.';
    s += ' Gasto del mes con tarjeta y transferencias: ' + eur(r.gastoOtros) + '; total salido ' + eur(r.total) + '.';
    return s;
  }

  // ---- Pro: historial de meses ----
  // hist = { 'YYYY-MM': cargosText }  → por recibo, importe de cada mes y su cambio
  function year(v, hist) {
    var meses = Object.keys(hist || {}).filter(function (k) { return parseMonth(k); }).sort();
    var rows = meses.map(function (k) {
      var r = check({ mes: k, hoy: v.hoy, tol: v.tol, recibos: v.recibos, cargos: hist[k] });
      return { mes: k, r: r };
    });
    var recibos = parseRecibos(v.recibos);
    var porRecibo = recibos.map(function (rc) {
      var serie = rows.map(function (x) { var f = x.r.filas[rc.i]; return f && f.cargos.length ? -f.cargos[0].importe : null; });
      var vals = serie.filter(function (x) { return x != null; });
      return { rc: rc, serie: serie, primero: vals[0], ultimo: vals[vals.length - 1], cambio: vals.length > 1 ? r2(vals[vals.length - 1] - vals[0]) : 0,
        total: r2(rows.reduce(function (s, x) { var f = x.r.filas[rc.i]; return s + (f ? f.cobrado : 0); }, 0)) };
    });
    return {
      meses: meses, rows: rows, porRecibo: porRecibo,
      total: r2(rows.reduce(function (s, x) { return s + x.r.total; }, 0)),
      recibosTotal: r2(rows.reduce(function (s, x) { return s + x.r.cobrado; }, 0)),
      revisar: r2(rows.reduce(function (s, x) { return s + x.r.revisar; }, 0))
    };
  }

  function icsEsc(s) { return String(s).replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); }
  function ymd(d) { return iso(d).replace(/-/g, ''); }
  // .ics: un aviso por cargo marcado (último día de las 8 semanas) + cada recibo de los próximos 12 meses
  function ics(r, avisoDias, stamp) {
    var a = Math.max(0, Math.min(14, avisoDias | 0)), L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//gastos-mensuales-excel//es', 'CALSCALE:GREGORIAN'];
    var st = stamp || '20260101T000000Z', n = 0;
    function ev(uid, d, sum, desc, alarm) {
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@gastos-mensuales-excel', 'DTSTAMP:' + st, 'DTSTART;VALUE=DATE:' + ymd(d), 'DTEND;VALUE=DATE:' + ymd(addDays(d, 1)), 'SUMMARY:' + icsEsc(sum), 'DESCRIPTION:' + icsEsc(desc));
      if (alarm) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(sum), 'TRIGGER:-P' + a + 'D', 'END:VALARM');
      L.push('END:VEVENT'); n++;
    }
    r.vivos.forEach(function (f, i) {
      ev('dev-' + ymd(f.cargo.fecha) + '-' + i, f.plazo.hasta, 'Último día para devolver: ' + f.nombre + ' ' + eur(f.importe),
        TIPO[f.tipo] + '. Cargo del ' + dmy(f.cargo.fecha) + '. Ocho semanas desde el cargo (art. 49.1 RDL 19/2018).', true);
    });
    var y = r.cfg.y, m = r.cfg.m;
    for (var k = 1; k <= 12; k++) {
      var mm = m + k, yy = y; while (mm > 12) { mm -= 12; yy++; }
      r.recibos.forEach(function (rc) {
        if (!venceEn(rc, mm)) return;
        ev('rec-' + yy + pad(mm) + '-' + rc.i, mkDate(yy, mm, Math.min(rc.dia, lastDay(yy, mm))), 'Recibo ' + rc.name + ' ' + eur(rc.importe), 'Comprueba que llega por ' + eur(rc.importe) + ' (' + rc.banco + ').', false);
      });
    }
    L.push('END:VCALENDAR');
    return { text: L.join('\r\n') + '\r\n', events: n };
  }

  // hojas para el Excel (Pro): [[nombre, filas]] con números como números
  function sheets(v, r, y) {
    var s1 = [['Recibo', 'Texto en el banco', 'Día', 'Importe', 'Cada (meses)', 'Primer mes']].concat(r.recibos.map(function (rc) { return [rc.name, rc.banco, rc.dia, rc.importe, rc.cada, rc.primero]; }));
    var s2 = [['Recibo', 'Esperado', 'Cobrado', 'Estado', 'Diferencia', 'Coste al año', 'Devolver hasta', 'Días que quedan']].concat(r.filas.map(function (f) {
      return [f.rc.name, f.esperado, f.cobrado, f.txt, r2(f.dif + f.extra), f.anual, f.plazo ? dmy(f.plazo.hasta) : '', f.plazo ? f.plazo.quedan : ''];
    })).concat(r.otros.map(function (o) { return [o.cargo.concepto, 0, -o.cargo.importe, 'Recibo que no esperabas', -o.cargo.importe, 0, dmy(o.plazo.hasta), o.plazo.quedan]; }))
      .concat([[], ['A revisar', r.revisar], ['Subidas al año', r.anual], ['Esperado en recibos', r.esperado], ['Cobrado en recibos', r.cobrado], ['Tarjeta y transferencias', r.gastoOtros], ['Total salido', r.total]]);
    var s3 = [['Fecha', 'Concepto', 'Importe']].concat(r.cargos.map(function (c) { return [dmy(c.fecha), c.concepto, c.importe]; }));
    var out = [['Recibos', s1], ['Mes ' + r.cfg.y + '-' + pad(r.cfg.m), s2], ['Cargos del banco', s3]];
    if (y && y.meses.length) {
      var head = ['Recibo'].concat(y.meses).concat(['Total', 'Cambio']);
      out.push(['Año', [head].concat(y.porRecibo.map(function (p) { return [p.rc.name].concat(p.serie.map(function (x) { return x == null ? '' : x; })).concat([p.total, p.cambio]); }))
        .concat([['Total salido'].concat(y.rows.map(function (x) { return x.r.total; })).concat([y.total, ''])])]);
    }
    return out;
  }

  // CSV del banco (Pro: importar archivo): devuelve las líneas "fecha;concepto;importe"
  function csvToCargos(text) {
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/), out = [];
    lines.forEach(function (l) {
      var c = parseCargos(l);
      if (c.length) out.push(dmy(c[0].fecha) + ';' + c[0].concepto.replace(/;/g, ',') + ';' + String(c[0].importe.toFixed(2)).replace('.', ','));
    });
    return out.join('\n');
  }

  var API = { DEFAULTS: DEFAULTS, MESES: MESES, MESES_L: MESES_L, DEV_DIAS: DEV_DIAS, esc: esc, eur: eur, num: num, norm: norm, iso: iso, dmy: dmy, parseDate: parseDate,
    parseRecibos: parseRecibos, parseCargos: parseCargos, check: check, tilesHtml: tilesHtml, rowsHtml: rowsHtml, summary: summary, mesNombre: mesNombre,
    year: year, ics: ics, sheets: sheets, csvToCargos: csvToCargos, TIPO: TIPO, addDays: addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.GR = API;
})(this);
