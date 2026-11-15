/* presupuesto quincenal — engine (sin red, sin dependencias). Fechas como días desde 1970-01-01 en UTC. */
(function (root) {
  'use strict';
  var DAY = 86400000;
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  function dnum(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / DAY); }
  function ymd(n) { var t = new Date(n * DAY); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), w: t.getUTCDay() }; }
  function iso(n) { var o = ymd(n); return o.y + '-' + ('0' + o.m).slice(-2) + '-' + ('0' + o.d).slice(-2); }
  function corto(n) { var o = ymd(n); return o.d + ' ' + MESES[o.m - 1]; }
  function largo(n) { var o = ymd(n); return DIAS[o.w] + ' ' + o.d + ' ' + MESES[o.m - 1] + ' ' + o.y; }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  // Acepta "2027-01-15", "15/01/2027", "2027-01-15x" (lo que sobre se ignora)
  function parseDate(s) {
    s = String(s || '').trim();
    var a = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (a) return dnum(+a[1], +a[2], +a[3]);
    var b = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(s);
    if (b) return dnum(+b[3], +b[2], +b[1]);
    return null;
  }
  function parseMonth(s) {
    var a = /(\d{4})-(\d{1,2})/.exec(String(s || ''));
    if (a && +a[2] >= 1 && +a[2] <= 12) return { y: +a[1], m: +a[2] };
    var b = /(\d{1,2})[\/.\-](\d{4})/.exec(String(s || ''));
    if (b && +b[1] >= 1 && +b[1] <= 12) return { y: +b[2], m: +b[1] };
    return null;
  }
  // "12,400.50" · "12.400,50" · "$ 9,800" · "9800"
  function num(s) {
    s = String(s == null ? '' : s).replace(/[^\d.,\-]/g, '');
    if (!s) return 0;
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) { s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); }
    else if (lc > -1) { s = /,\d{3}$/.test(s) && s.split(',').length >= 2 && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(/,/g, '.'); }
    else if (ld > -1 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) { s = s.replace(/\./g, ''); } // 1.500 · 180.000 · 1.750.905 = miles
    var v = parseFloat(s);
    return isFinite(v) ? v : 0;
  }
  function r2(x) { return Math.round((x + (x < 0 ? -1e-9 : 1e-9)) * 100) / 100; }

  var CUR = {
    MXN: { pre: '$', th: ',', dc: '.', dec: 2, name: 'peso mexicano' },
    COP: { pre: '$ ', th: '.', dc: ',', dec: 0, name: 'peso colombiano' },
    USD: { pre: 'US$', th: ',', dc: '.', dec: 2, name: 'dólar' },
    EUR: { post: ' €', th: '.', dc: ',', dec: 2, name: 'euro' }
  };
  function money(x, c) {
    var f = CUR[c] || CUR.MXN, neg = x < 0, v = Math.abs(r2(x));
    var p = v.toFixed(f.dec).split('.'), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, f.th);
    var s = i + (f.dec ? f.dc + p[1] : '');
    return (neg ? '−' : '') + (f.pre || '') + s + (f.post || '');
  }

  // Pagos fijos: "Renta; 1; 7500" · opcional 4º campo = meses en que se paga ("1" anual en enero, "2,4,6,8,10,12" bimestral)
  function parseBills(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim(); if (!line || line.charAt(0) === '#') return;
      var p = line.split(/\s*[;|\t]\s*/);
      if (p.length < 3) return;
      var day = parseInt(p[1], 10), amt = num(p[2]);
      if (!(day >= 1 && day <= 31) || !(amt > 0)) return;
      var months = null;
      if (p[3]) { months = p[3].split(/[ ,]+/).map(function (x) { return parseInt(x, 10); }).filter(function (x) { return x >= 1 && x <= 12; }); if (!months.length) months = null; }
      out.push({ name: p[0] || 'Pago', day: day, amount: r2(amt), months: months });
    });
    return out;
  }
  // Ingresos extra: "Aguinaldo; 2026-12-18; 4900"
  function parseExtras(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var p = line.trim().split(/\s*[;|\t]\s*/);
      if (p.length < 3) return;
      var d = parseDate(p[1]), a = num(p[2]);
      if (d == null || !(a > 0)) return;
      out.push({ name: p[0] || 'Ingreso extra', date: d, amount: r2(a) });
    });
    return out;
  }

  function weekendShift(n, rule) {
    if (rule !== 'antes') return n;
    var w = ymd(n).w;
    return w === 6 ? n - 1 : w === 0 ? n - 2 : n;
  }
  // Fechas de pago entre a y b (inclusive)
  function payDates(cfg, a, b) {
    var out = [], f = cfg.frecuencia || 'quincenal';
    if (f === 'quincenal') {
      var s = ymd(a - 40), y = s.y, m = s.m;
      for (var k = 0; k < 600; k++) {
        [15, lastDay(y, m)].forEach(function (d) {
          var n = weekendShift(dnum(y, m, d), cfg.finde);
          if (n >= a && n <= b) out.push(n);
        });
        m++; if (m > 12) { m = 1; y++; }
        if (dnum(y, m, 1) > b + 40) break;
      }
    } else {
      var step = f === 'semanal' ? 7 : 14, anc = cfg.ancla;
      if (anc == null) anc = dnum(2027, 1, 8);
      var first = anc + Math.ceil((a - 40 - anc) / step) * step;
      for (var n = first; n <= b + 40; n += step) { var p = weekendShift(n, cfg.finde); if (p >= a && p <= b) out.push(p); }
    }
    out.sort(function (x, y) { return x - y; });
    return out.filter(function (x, i) { return i === 0 || x !== out[i - 1]; });
  }
  // Vencimientos de los pagos fijos entre a y b (inclusive). Día 31 en un mes de 30 → último día.
  function billsBetween(bills, a, b) {
    var out = [], s = ymd(a), y = s.y, m = s.m;
    while (dnum(y, m, 1) <= b) {
      bills.forEach(function (bl) {
        if (bl.months && bl.months.indexOf(m) < 0) return;
        var n = dnum(y, m, Math.min(bl.day, lastDay(y, m)));
        if (n >= a && n <= b) out.push({ name: bl.name, date: n, amount: bl.amount });
      });
      m++; if (m > 12) { m = 1; y++; }
    }
    out.sort(function (x, y) { return x.date - y.date || y.amount - x.amount; });
    return out;
  }

  var DEFAULTS = {
    moneda: 'MXN', mes: '2027-01', frecuencia: 'quincenal', finde: 'antes', ancla: '2027-01-08',
    neto: '10500', saldo: '0', variable: '3000', ahorro: '500',
    pagos: 'Renta; 1; 7500\nTarjeta de crédito; 5; 2400\nInternet; 10; 499\nCelular; 18; 299\nGimnasio; 20; 650\nPréstamo de nómina; 25; 1850',
    extras: ''
  };

  function config(v) {
    v = v || {};
    var mo = parseMonth(v.mes) || parseMonth(DEFAULTS.mes);
    return {
      moneda: CUR[v.moneda] ? v.moneda : 'MXN', y: mo.y, m: mo.m,
      frecuencia: ['quincenal', 'catorcenal', 'semanal'].indexOf(v.frecuencia) > -1 ? v.frecuencia : 'quincenal',
      finde: v.finde === 'igual' ? 'igual' : 'antes', ancla: parseDate(v.ancla),
      neto: r2(num(v.neto)), saldo: r2(num(v.saldo)), variable: r2(num(v.variable)), ahorro: r2(num(v.ahorro)),
      bills: parseBills(v.pagos), extras: parseExtras(v.extras)
    };
  }

  /* Un plan = los pagos de nómina cuya fecha cae en [mes, mes + meses). Cada pago cubre los vencimientos desde su fecha
     hasta el día antes del siguiente pago (aunque ese día ya sea del mes siguiente). */
  function plan(v, meses) {
    var c = config(v); meses = Math.max(1, Math.min(24, meses || 1));
    var a = dnum(c.y, c.m, 1), endM = c.m + meses, endY = c.y + Math.floor((endM - 1) / 12);
    endM = ((endM - 1) % 12) + 1;
    var b = dnum(endY, endM, 1) - 1;
    var pays = payDates(c, a, b);
    var nextAfter = payDates(c, b + 1, b + 40)[0];
    var P = pays.map(function (p, i) {
      var to = (i + 1 < pays.length ? pays[i + 1] : nextAfter) - 1;
      var bl = billsBetween(c.bills, p, to);
      var ex = c.extras.filter(function (e) { return e.date >= p && e.date <= to; });
      var bt = r2(bl.reduce(function (s, x) { return s + x.amount; }, 0));
      var et = r2(ex.reduce(function (s, x) { return s + x.amount; }, 0));
      var inc = r2(c.neto + et);
      var net = r2(inc - bt - c.variable - c.ahorro);
      return { pay: p, to: to, income: inc, neto: c.neto, extras: ex, extrasTotal: et, bills: bl, billsTotal: bt, variable: c.variable, ahorro: c.ahorro, net: net };
    });
    // Reserva al cierre de cada pago (lo que hay que guardar para los pagos que vienen) — pasada hacia atrás
    var R = new Array(P.length), i;
    for (i = P.length - 1; i >= 0; i--) R[i] = i === P.length - 1 ? 0 : r2(Math.max(0, R[i + 1] - P[i + 1].net));
    var colchon = 0, carry = c.saldo, bal = c.saldo;
    P.forEach(function (p, k) {
      p.entra = carry;                    // apartado que llega de antes (o saldo inicial)
      p.reserve = R[k];                   // lo que este pago aparta para los siguientes
      p.libre = r2(carry + p.net - R[k]); // lo que puedes gastar de más, sin tocar lo apartado
      p.falta = p.libre < 0 ? r2(-p.libre) : 0;
      if (p.falta) { colchon = r2(colchon + p.falta); p.libre = 0; }
      p.aparta = r2(Math.max(0, Math.min(R[k], carry + p.net) - carry)); // de este pago sale lo que falta para la reserva (si no alcanza, lo que haya; el resto es colchón)
      p.usa = r2(Math.max(0, carry - R[k]));    // apartado que este pago usa
      p.naive = p.net;                    // gastando todo lo que sobra en cada pago
      bal = r2(bal + p.net); p.saldoFin = bal;
      carry = R[k];
    });
    var worst = null; P.forEach(function (p) { if (!worst || p.naive < worst.naive) worst = p; });
    var neg = P.filter(function (p) { return p.naive < 0; });
    var maxAparta = P.reduce(function (s, p) { return s + p.aparta; }, 0);
    var aparta = P.filter(function (p) { return p.aparta > 0; });
    var tot = {
      income: r2(P.reduce(function (s, p) { return s + p.income; }, 0)),
      bills: r2(P.reduce(function (s, p) { return s + p.billsTotal; }, 0)),
      variable: r2(c.variable * P.length), ahorro: r2(c.ahorro * P.length),
      libre: r2(P.reduce(function (s, p) { return s + p.libre; }, 0))
    };
    tot.net = r2(tot.income - tot.bills - tot.variable - tot.ahorro);
    // meses con un pago de más (catorcenal: 3 · semanal: 5)
    var porMes = {};
    pays.forEach(function (p) { var o = ymd(p), k = o.y + '-' + ('0' + o.m).slice(-2); porMes[k] = (porMes[k] || 0) + 1; });
    var tipico = c.frecuencia === 'semanal' ? 4 : 2;
    var extraMeses = Object.keys(porMes).filter(function (k) { return porMes[k] > tipico; });
    return { cfg: c, periods: P, worst: worst, negativos: neg, aparta: aparta, maxAparta: r2(maxAparta), colchon: colchon, totals: tot, porMes: porMes, extraMeses: extraMeses,
      unpaid: c.bills.length === 0 };
  }

  function nombrePago(p, c) {
    var o = ymd(p.pay);
    if (c.frecuencia === 'quincenal') return 'Quincena del ' + o.d + ' ' + MESES[o.m - 1];
    return (c.frecuencia === 'catorcenal' ? 'Catorcena del ' : 'Semana del ') + o.d + ' ' + MESES[o.m - 1];
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }

  function tilesHtml(r) {
    var c = r.cfg, M = function (x) { return money(x, c.moneda); }, P = r.periods;
    if (!P.length) return '<p class="small">Ese mes no tiene pagos con esta frecuencia y fecha.</p>';
    var w = r.worst, h = '';
    if (w && w.naive < 0) {
      h += '<div class="tile bad"><span>Sin apartar, la ' + esc(nombrePago(w, c).toLowerCase()) + ' queda en</span><b>' + M(w.naive) + '</b><i>cubre ' + esc(w.bills.slice().sort(function (x, y) { return y.amount - x.amount; }).slice(0, 3).map(function (b) { return b.name + ' ' + corto(b.date); }).join(', ')) + '</i></div>';
      var ap = r.aparta, apT = r2(ap.reduce(function (s2, p) { return s2 + p.aparta; }, 0));
      var lab = ap.length === 1 ? 'Aparta de la ' + esc(nombrePago(ap[0], c).toLowerCase()) : ap.length ? 'Aparta en total, de ' + ap.length + ' pagos' : 'No hay pago anterior del que apartar';
      var sub = ap.length > 1 ? ap.map(function (p) { return M(p.aparta) + ' el ' + corto(p.pay); }).join(' · ') : '';
      if (r.colchon) sub += (sub ? ' · ' : '') + 'y además te falta un colchón de ' + M(r.colchon);
      if (!sub) sub = 'así ningún pago queda en negativo';
      h += '<div class="tile hot"><span>' + lab + '</span><b>' + M(apT) + '</b><i>' + sub + '</i></div>';
    } else {
      h += '<div class="tile ok"><span>Ningún pago queda en negativo</span><b>' + M(w ? w.naive : 0) + '</b><i>el pago más justo: ' + esc(w ? nombrePago(w, c) : '') + '</i></div>';
    }
    h += '<div class="tile"><span>Libre para gastar, sin tocar lo apartado</span><b>' + P.map(function (p) { return M(p.libre); }).join(' · ') + '</b><i>' + P.map(function (p) { return corto(p.pay); }).join(' · ') + '</i></div>';
    return h;
  }
  function rowsHtml(r) {
    var c = r.cfg, M = function (x) { return money(x, c.moneda); };
    return r.periods.map(function (p) {
      var bl = p.bills.map(function (b) { return '<li>' + esc(b.name) + ' <small>' + corto(b.date) + '</small> <b>' + M(b.amount) + '</b></li>'; }).join('') || '<li class="small">sin pagos fijos en estas fechas</li>';
      var ex = p.extras.map(function (e) { return '<li class="plus">' + esc(e.name) + ' <small>' + corto(e.date) + '</small> <b>+' + M(e.amount) + '</b></li>'; }).join('');
      return '<tr class="' + (p.naive < 0 ? 'neg' : '') + '"><td class="sc"><b>' + esc(nombrePago(p, c)) + '</b><small>' + largo(p.pay) + '<br>cubre hasta el ' + corto(p.to) + '</small></td>' +
        '<td><ul class="bl">' + ex + bl + '</ul></td>' +
        '<td class="nm">' + M(p.income) + '<small>− fijos ' + M(p.billsTotal) + '<br>− variable ' + M(p.variable) + '<br>− ahorro ' + M(p.ahorro) + '</small><b class="' + (p.naive < 0 ? 'bad' : '') + '">= ' + M(p.naive) + '</b></td>' +
        '<td class="nm">' + (p.usa ? 'usa ' + M(p.usa) + ' apartado<br>' : '') + (p.aparta ? '<b>aparta ' + M(p.aparta) + '</b><br>' : '') + (p.falta ? '<b class="bad">falta ' + M(p.falta) + '</b><br>' : '') + 'libre <b>' + M(p.libre) + '</b></td></tr>';
    }).join('');
  }
  function summary(r) {
    var c = r.cfg, M = function (x) { return money(x, c.moneda); }, P = r.periods;
    if (!P.length) return '';
    var t = 'Presupuesto quincenal de ' + MESES_L[c.m - 1] + ' ' + c.y + ' (' + c.frecuencia + '): ';
    t += P.map(function (p) { return nombrePago(p, c) + ': entra ' + M(p.income) + ', fijos ' + M(p.billsTotal) + (p.aparta ? ', aparta ' + M(p.aparta) : '') + (p.usa ? ', usa ' + M(p.usa) + ' apartado' : '') + ', libre ' + M(p.libre); }).join(' · ');
    if (r.worst && r.worst.naive < 0) t += '. Sin apartar, la ' + nombrePago(r.worst, c).toLowerCase() + ' queda en ' + M(r.worst.naive) + '.';
    if (r.colchon) t += ' Falta un colchón de ' + M(r.colchon) + '.';
    return t;
  }

  // ---- Pro: 12 meses con arrastre, registro real, CSV, .ics ----
  function yearRows(r) {
    var c = r.cfg;
    return r.periods.map(function (p) {
      return { fecha: iso(p.pay), pago: nombrePago(p, c), cubre_hasta: iso(p.to), entra: p.income, fijos: p.billsTotal, variable: p.variable, ahorro: p.ahorro, resultado: p.naive, aparta: p.aparta, usa: p.usa, libre: p.libre, falta: p.falta, saldo: p.saldoFin };
    });
  }
  function csvCell(x) { x = String(x == null ? '' : x); return /[",;\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  function toCSV(r) {
    var rows = yearRows(r), head = ['fecha', 'pago', 'cubre_hasta', 'entra', 'fijos', 'variable', 'ahorro', 'resultado', 'aparta', 'usa', 'libre', 'falta', 'saldo', 'pagos_fijos'];
    var lines = [head.join(',')];
    rows.forEach(function (o, i) {
      var p = r.periods[i];
      lines.push(head.slice(0, 13).map(function (k) { return csvCell(o[k]); }).concat([csvCell(p.bills.map(function (b) { return b.name + ' ' + iso(b.date) + ' ' + b.amount; }).join(' | '))]).join(','));
    });
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }
  // CSV de pagos fijos (nombre, día, monto[, meses]) → texto del cuadro
  function csvToBills(t) {
    var lines = String(t || '').replace(/^\ufeff/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return '';
    var sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    var out = [];
    lines.forEach(function (l, i) {
      var p = l.split(sep).map(function (x) { return x.replace(/^"|"$/g, '').trim(); });
      if (i === 0 && !/\d/.test(p[1] || '')) return; // cabecera
      if (p.length >= 3 && parseInt(p[1], 10) >= 1) out.push([p[0], parseInt(p[1], 10), p[2]].concat(p[3] ? [p[3].replace(/;/g, ',')] : []).join('; '));
    });
    return out.join('\n');
  }
  function icsDate(n) { return iso(n).replace(/-/g, ''); }
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function ics(r, avisoDias) {
    var c = r.cfg, M = function (x) { return money(x, c.moneda); }, L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//presupuesto-quincenal//ES', 'CALSCALE:GREGORIAN'];
    var stamp = icsDate(dnum(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, new Date().getUTCDate())) + 'T000000Z', n = 0;
    function ev(uid, day, title, desc) {
      n++;
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@presupuesto-quincenal', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + icsDate(day), 'DTEND;VALUE=DATE:' + icsDate(day + 1), 'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc));
      if (avisoDias > 0) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title), 'TRIGGER:-P' + avisoDias + 'D', 'END:VALARM');
      L.push('END:VEVENT');
    }
    r.periods.forEach(function (p) {
      var t = nombrePago(p, c) + ': ' + (p.aparta ? 'aparta ' + M(p.aparta) : 'libre ' + M(p.libre));
      ev('pago-' + iso(p.pay), p.pay, t, 'Entra ' + M(p.income) + '. Cubre hasta el ' + iso(p.to) + ': ' + p.bills.map(function (b) { return b.name + ' ' + M(b.amount); }).join(', ') + '. Libre para gastar ' + M(p.libre) + '.');
      p.bills.forEach(function (b) { ev('vence-' + iso(b.date) + '-' + b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), b.date, 'Vence ' + b.name + ' ' + M(b.amount), 'Se paga con la ' + nombrePago(p, c).toLowerCase() + '.'); });
    });
    L.push('END:VCALENDAR');
    return { text: L.join('\r\n') + '\r\n', events: n };
  }
  // Registro real: {fechaISO: {nombre: montoReal}} → diferencias contra el plan
  function compareReal(r, real) {
    var c = r.cfg; real = real || {};
    return r.periods.map(function (p) {
      var k = iso(p.pay), got = real[k] || {}, gastado = 0, pend = [];
      p.bills.forEach(function (b) { var v = got[b.name]; if (v == null) pend.push(b); else gastado += num(v); });
      var varReal = got.__variable == null ? null : num(got.__variable);
      var plan = r2(p.billsTotal + p.variable), realT = r2(gastado + (varReal == null ? 0 : varReal) + pend.reduce(function (s, b) { return s + b.amount; }, 0) + (varReal == null ? p.variable : 0));
      return { fecha: k, pago: nombrePago(p, c), plan: plan, real: realT, diferencia: r2(realT - plan), pendientes: pend.map(function (b) { return b.name; }) };
    });
  }

  var API = { DEFAULTS: DEFAULTS, CUR: CUR, MESES: MESES, MESES_L: MESES_L, num: num, money: money, parseBills: parseBills, parseExtras: parseExtras, parseDate: parseDate, parseMonth: parseMonth,
    payDates: payDates, billsBetween: billsBetween, plan: plan, config: config, nombrePago: nombrePago, tilesHtml: tilesHtml, rowsHtml: rowsHtml, summary: summary,
    yearRows: yearRows, toCSV: toCSV, csvToBills: csvToBills, ics: ics, compareReal: compareReal, iso: iso, corto: corto, largo: largo, dnum: dnum, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.PQ = API; else if (root) root.PQ = API;
})(typeof self !== 'undefined' ? self : this);
