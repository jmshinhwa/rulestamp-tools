/* plantilla contabilidad Excel · motor de cálculo (sin red, sin dependencias) */
(function (root) {
  'use strict';
  // Tarifas de Etsy para tiendas con cuenta de pagos en España (Etsy Help, leído 15/11/2026)
  var RATES = {
    trans: 0.065,      // tarifa de transacción: 6,5 % de artículo + envío + envoltorio
    payPct: 0.04,      // procesamiento de pagos España: 4 % + 0,30 €
    payFix: 0.30,
    reg: 0.0088,       // tarifa operativa regulatoria España: 0,88 % de artículo + envío
    listUsd: 0.20,     // publicación / renovación por artículo vendido: 0,20 USD
    ivaFees: 0.21,     // IVA español (LIVA art. 90) que Etsy cobra sobre sus tarifas si no tiene tu NIF-IVA
    ivaVentas: 0.21,
    irpf130: 0.20,     // RIRPF art. 110.1.a
    gdjPct: 0.05, gdjMax: 2000 // RIRPF art. 30.2ª
  };
  var EU = ['spain','españa','espana','germany','alemania','france','francia','italy','italia','portugal','netherlands','the netherlands','países bajos','paises bajos','belgium','bélgica','belgica','austria','ireland','irlanda','luxembourg','luxemburgo','denmark','dinamarca','sweden','suecia','finland','finlandia','poland','polonia','czech republic','czechia','chequia','república checa','slovakia','eslovaquia','slovenia','eslovenia','hungary','hungría','hungria','romania','rumanía','rumania','bulgaria','croatia','croacia','greece','grecia','cyprus','chipre','malta','estonia','latvia','letonia','lithuania','lituania'];
  var DED = { '0': 0, '100': 100, '75': 75, '50': 50, '25': 25 };

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[€$\s ]/g, '').replace(/^EUR|^USD/i, '');
    if (!s || s === '--') return 0;
    var neg = /^-|^\(.*\)$/.test(s); s = s.replace(/[-()]/g, '');
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
    } else if (s.indexOf(',') >= 0) s = s.replace(',', '.');
    var n = parseFloat(s); if (!isFinite(n)) return 0; return neg ? -n : n;
  }
  function r2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function eur(x) {
    var n = r2(x), neg = n < 0, a = Math.abs(n).toFixed(2).split('.');
    a[0] = a[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + a[0] + ',' + a[1] + ' €';
  }
  function pct(x) { return (Math.round(x * 1000) / 10).toFixed(1).replace('.', ',') + ' %'; }
  function plazo(anio, trim) {
    anio = +anio; trim = +trim;
    if (trim === 4) return (anio + 1) + '-01-30';
    return anio + '-' + ['04', '07', '10'][trim - 1] + '-20';
  }
  function trimOf(fecha) { var m = +String(fecha).slice(5, 7); return m ? Math.ceil(m / 3) : 0; }
  function destOf(country) {
    var c = String(country || '').trim().toLowerCase();
    if (!c || c === 'spain' || c === 'españa' || c === 'espana' || c === 'es') return 'es';
    return EU.indexOf(c) >= 0 ? 'ue' : 'fuera';
  }

  function pedido(p, s) {
    var uds = Math.max(0, num(p.uds) || 0), imp = num(p.imp), env = num(p.env), tot = imp + env;
    var fT = r2(RATES.trans * tot), fP = tot > 0 ? r2(RATES.payPct * tot + RATES.payFix) : 0, fR = r2(RATES.reg * tot);
    var fL = r2(uds * num(s.listEur)), fO = p.off === 'si' ? r2(num(s.offRate) / 100 * tot) : 0;
    var ivaBase = fT + fR + fL + fO + (s.ivaPago === 'si' ? fP : 0);
    var ivaF = s.roi === 'si' ? 0 : r2(RATES.ivaFees * ivaBase);
    var fees = r2(fT + fP + fR + fL + fO + ivaF);
    var ivaRep = (s.conIva !== 'no' && p.dest !== 'fuera') ? r2(tot * RATES.ivaVentas / (1 + RATES.ivaVentas)) : 0;
    var base = tot - ivaRep, envR = num(p.envReal), mat = num(p.mat);
    return {
      fecha: p.fecha, prod: String(p.prod || '').trim() || '(sin nombre)', uds: uds, dest: p.dest || 'es', off: p.off === 'si',
      tot: r2(tot), fT: r2(fT), fP: r2(fP), fR: r2(fR), fL: r2(fL), fO: r2(fO), ivaF: r2(ivaF), fees: r2(fees),
      autoIva: s.roi === 'si' ? r2(RATES.ivaFees * ivaBase) : 0,
      ivaRep: r2(ivaRep), base: r2(base), deposito: r2(tot - fees), envReal: r2(envR), mat: r2(mat),
      margen: r2(base - fees - envR - mat)
    };
  }
  function gasto(g) {
    var tot = num(g.total), t = num(g.iva) / 100, base = tot / (1 + t);
    return { fecha: g.fecha, concepto: String(g.concepto || '').trim() || '(gasto)', total: r2(tot), iva: num(g.iva), base: r2(base), cuota: r2(tot - base) };
  }

  function compute(st) {
    var s = st || {}, trim = +s.trim || 4, anio = +s.anio || 2026;
    var P = (s.pedidos || []).filter(function (p) { return num(p.imp) + num(p.env) > 0; }).map(function (p) { return pedido(p, s); });
    var G = (s.gastos || []).filter(function (g) { return num(g.total) !== 0; }).map(gasto);
    var sum = function (arr, k) { return r2(arr.reduce(function (a, x) { return a + x[k]; }, 0)); };
    var cobrado = sum(P, 'tot'), fees = sum(P, 'fees'), ivaRep = sum(P, 'ivaRep'), ingresos = sum(P, 'base');
    var envReal = sum(P, 'envReal'), gBase = sum(G, 'base'), gCuota = sum(G, 'cuota'), gTot = sum(G, 'total');
    var gastosQ = r2(fees + envReal + gBase);
    var dif = r2(ingresos - gastosQ);
    var gdj = s.gdj === 'no' ? 0 : r2(Math.min(RATES.gdjMax, Math.max(0, RATES.gdjPct * dif)));
    var c01 = r2(num(s.prev01) + ingresos), c02 = r2(num(s.prev02) + gastosQ + gdj), c03 = r2(c01 - c02);
    var c04 = c03 > 0 ? r2(RATES.irpf130 * c03) : 0, c05 = r2(num(s.prev05)), c07 = r2(c04 - c05);
    var ded = DED[String(s.ded || '0')] || 0, c13 = r2(Math.min(ded, Math.max(0, c07)));
    var pago130 = r2(Math.max(0, c07 - c13));
    var iva303 = r2(ivaRep - gCuota), autoIva = sum(P, 'autoIva');
    var etsy = { trans: sum(P, 'fT'), pago: sum(P, 'fP'), reg: sum(P, 'fR'), list: sum(P, 'fL'), off: sum(P, 'fO'), iva: sum(P, 'ivaF') };
    var porProd = {};
    P.forEach(function (p) {
      var x = porProd[p.prod] || (porProd[p.prod] = { prod: p.prod, uds: 0, cobrado: 0, fees: 0, margen: 0, pedidos: 0 });
      x.uds += p.uds; x.cobrado = r2(x.cobrado + p.tot); x.fees = r2(x.fees + p.fees); x.margen = r2(x.margen + p.margen); x.pedidos++;
    });
    var prods = Object.keys(porProd).map(function (k) { var x = porProd[k]; x.porUd = x.uds ? r2(x.margen / x.uds) : 0; x.pctM = x.cobrado ? x.margen / x.cobrado : 0; return x; })
      .sort(function (a, b) { return a.pctM - b.pctM; });
    var ueVentas = r2(P.filter(function (p) { return p.dest === 'ue'; }).reduce(function (a, p) { return a + p.tot; }, 0));
    var caja = r2(cobrado - fees - envReal - gTot - Math.max(0, iva303) - pago130);
    var fuera = P.filter(function (p) { return trimOf(p.fecha) && trimOf(p.fecha) !== trim; }).length;
    return {
      anio: anio, trim: trim, plazo: plazo(anio, trim), pedidos: P, gastos: G, n: P.length,
      cobrado: cobrado, fees: fees, feesPct: cobrado ? fees / cobrado : 0, etsy: etsy, ivaRep: ivaRep, ingresos: ingresos,
      envReal: envReal, gBase: gBase, gCuota: gCuota, gTot: gTot, gastosQ: gastosQ, dif: dif, gdj: gdj,
      c01: c01, c02: c02, c03: c03, c04: c04, c05: c05, c07: c07, c13: c13, pago130: pago130,
      iva303: iva303, autoIva: autoIva, roi: s.roi === 'si', prods: prods, peor: prods[0] || null, ueVentas: ueVentas,
      caja: caja, fueraTrim: fuera, deposito: r2(cobrado - fees)
    };
  }

  // recargo por presentar tarde sin requerimiento (LGT art. 27.2): 1 % + 1 punto por mes completo; desde 12 meses, 15 %
  function recargo(importe, plazoISO, diaISO) {
    var a = new Date(plazoISO + 'T00:00:00Z'), b = new Date(diaISO + 'T00:00:00Z');
    if (!(b > a)) return { meses: 0, pct: 0, eur: 0 };
    var m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    if (b.getUTCDate() < a.getUTCDate()) m--;
    var p = m >= 12 ? 15 : 1 + m;
    return { meses: m, pct: p, eur: r2(importe * p / 100) };
  }

  // Importar CSV de Etsy (EtsySoldOrderItems o EtsySoldOrders)
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false, i, c;
    text = String(text || '').replace(/^﻿/, '');
    var sep = (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length) ? ';' : ',';
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.join('').trim() !== ''; });
  }
  function isoDate(s) {
    s = String(s || '').trim(); var m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
      var y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2); // Etsy: MM/DD/YY
    }
    return '';
  }
  function importEtsy(text) {
    var rows = parseCSV(text); if (rows.length < 2) return { ok: false, why: 'CSV vacío', pedidos: [] };
    var h = rows[0].map(function (x) { return x.trim().toLowerCase(); });
    function col() { for (var a = 0; a < arguments.length; a++) { var i = h.indexOf(arguments[a]); if (i >= 0) return i; } return -1; }
    var iDate = col('sale date', 'fecha de venta'), iName = col('item name', 'nombre del artículo'), iQty = col('quantity', 'number of items', 'cantidad');
    var iItemTot = col('item total', 'total del artículo'), iOrderVal = col('order value', 'valor del pedido'), iPrice = col('price', 'precio');
    var iShip = col('order shipping', 'shipping', 'envío'), iCountry = col('ship country', 'país de envío'), iOrder = col('order id', 'id del pedido');
    var iDisc = col('discount amount', 'importe del descuento');
    if (iDate < 0 || (iItemTot < 0 && iOrderVal < 0 && iPrice < 0)) return { ok: false, why: 'No veo las columnas de Etsy (Sale Date, Item Total / Order Value)', pedidos: [] };
    var seenShip = {}, out = [];
    rows.slice(1).forEach(function (r) {
      var qty = iQty >= 0 ? num(r[iQty]) || 1 : 1, imp;
      if (iItemTot >= 0) imp = num(r[iItemTot]); else if (iOrderVal >= 0) imp = num(r[iOrderVal]) - (iDisc >= 0 ? num(r[iDisc]) : 0); else imp = num(r[iPrice]) * qty;
      var oid = iOrder >= 0 ? r[iOrder] : String(out.length), env = 0;
      if (iShip >= 0 && !seenShip[oid]) { env = num(r[iShip]); seenShip[oid] = 1; } // el envío va una vez por pedido
      out.push({ fecha: isoDate(r[iDate]), prod: iName >= 0 ? r[iName] : 'pedido ' + oid, uds: String(qty), imp: String(r2(imp)), env: String(r2(env)),
        dest: destOf(iCountry >= 0 ? r[iCountry] : ''), off: 'no', mat: '0', envReal: '0' });
    });
    return { ok: true, pedidos: out, why: '' };
  }

  var api = { RATES: RATES, num: num, r2: r2, eur: eur, pct: pct, plazo: plazo, compute: compute, recargo: recargo, importEtsy: importEtsy, parseCSV: parseCSV, destOf: destOf, trimOf: trimOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CONTA = api;
})(this);
