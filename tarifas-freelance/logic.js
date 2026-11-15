/* tarifas freelance — cálculo de la tarifa diaria mínima de un autónomo en España (2026).
 * Fuentes (leídas el 15/11/2026):
 *  - Festivos 2026: Resolución de 17 de octubre de 2025 de la Dirección General de Trabajo (BOE de 28/10/2025), anexo.
 *  - Cuota de autónomos 2026: Orden PJC/297/2026 (BOE 31/03/2026), 15 tramos, tipo 31,50 %.
 *  - Rendimiento para la cuota: art. 308 LGSS (rendimientos + cuotas, menos 7 % de gastos genéricos).
 *  - IRPF: escala general art. 63 LIRPF (estatal) + escala autonómica tipo; mínimo personal 5.550 €;
 *    estimación directa simplificada: 5 % de gastos de difícil justificación, máximo 2.000 € (AEAT, 2026).
 */
(function (root) {
  'use strict';
  var CCAA = { AN: 'Andalucía', AR: 'Aragón', AS: 'Asturias', IB: 'Illes Balears', CN: 'Canarias', CB: 'Cantabria', CM: 'Castilla-La Mancha',
    CL: 'Castilla y León', CT: 'Cataluña', EX: 'Extremadura', GA: 'Galicia', MD: 'Comunidad de Madrid', MC: 'Región de Murcia', NC: 'Navarra',
    PV: 'País Vasco', RI: 'La Rioja', VC: 'Comunitat Valenciana', CE: 'Ceuta', ML: 'Melilla' };
  // Festivos 2026 en día laborable (lunes a viernes) por comunidad, del anexo del BOE de 28/10/2025.
  var FEST = {"AN":["01-01","01-06","04-02","04-03","05-01","10-12","11-02","12-07","12-08","12-25"],"AR":["01-01","01-06","04-02","04-03","04-23","05-01","10-12","11-02","12-07","12-08","12-25"],"AS":["01-01","01-06","04-02","04-03","05-01","09-08","10-12","11-02","12-07","12-08","12-25"],"IB":["01-01","01-06","03-02","04-02","04-03","04-06","05-01","10-12","12-08","12-25"],"CN":["01-01","01-06","04-02","04-03","05-01","10-12","11-02","12-08","12-25"],"CB":["01-01","01-06","04-02","04-03","05-01","07-28","09-15","10-12","12-07","12-08","12-25"],"CM":["01-01","01-06","04-02","04-03","04-06","05-01","06-04","10-12","11-02","12-08","12-25"],"CL":["01-01","01-06","04-02","04-03","04-23","05-01","10-12","11-02","12-07","12-08","12-25"],"CT":["01-01","01-06","04-03","04-06","05-01","06-24","09-11","10-12","12-08","12-25"],"EX":["01-01","01-06","04-02","04-03","05-01","09-08","10-12","11-02","12-07","12-08","12-25"],"GA":["01-01","01-06","03-19","04-02","04-03","05-01","06-24","10-12","12-08","12-25"],"MD":["01-01","01-06","04-02","04-03","05-01","10-12","11-02","12-07","12-08","12-25"],"MC":["01-01","01-06","03-19","04-02","04-03","05-01","06-09","10-12","12-07","12-08","12-25"],"NC":["01-01","01-06","03-19","04-02","04-03","04-06","05-01","10-12","11-02","12-08","12-25"],"PV":["01-01","01-06","03-19","04-02","04-03","04-06","05-01","10-12","12-08","12-25"],"RI":["01-01","01-06","04-02","04-03","04-06","05-01","06-09","10-12","12-07","12-08","12-25"],"VC":["01-01","01-06","03-19","04-03","04-06","05-01","06-24","10-09","10-12","12-08","12-25"],"CE":["01-01","01-06","04-02","04-03","05-01","05-27","08-05","09-02","10-12","12-08","12-25"],"ML":["01-01","01-06","03-20","04-02","04-03","05-01","05-27","10-12","12-07","12-08","12-25"]};
  var FNAME = { '01-01': 'Año Nuevo', '01-06': 'Epifanía del Señor', '03-02': 'Lunes siguiente al Día de les Illes Balears', '03-19': 'San José', '03-20': 'Fiesta del Eid Fitr',
    '04-02': 'Jueves Santo', '04-03': 'Viernes Santo', '04-06': 'Lunes de Pascua', '04-23': 'San Jorge / Fiesta de Castilla y León', '05-01': 'Fiesta del Trabajo',
    '05-27': 'Fiesta del Sacrificio', '06-04': 'Corpus Christi', '06-09': 'Día de la Región de Murcia / Día de La Rioja', '06-24': 'San Juan',
    '07-28': 'Día de las Instituciones de Cantabria', '08-05': 'Nuestra Señora de África', '09-02': 'Día de Ceuta', '09-08': 'Día de Asturias / Día de Extremadura',
    '09-11': 'Fiesta Nacional de Cataluña', '09-15': 'La Bien Aparecida', '10-09': 'Día de la Comunitat Valenciana', '10-12': 'Fiesta Nacional de España',
    '11-02': 'Día siguiente a Todos los Santos', '12-07': 'Lunes siguiente al Día de la Constitución', '12-08': 'Inmaculada Concepción', '12-25': 'Natividad del Señor' };
  // [rendimiento neto mensual hasta, base mínima, base máxima] — Orden PJC/297/2026
  var TRAMOS = [[670, 653.59, 718.94], [900, 718.95, 900], [1166.70, 849.67, 1166.70], [1300, 950.98, 1300], [1500, 960.78, 1500], [1700, 960.78, 1700],
    [1850, 1143.79, 1850], [2030, 1209.15, 2030], [2330, 1274.51, 2330], [2760, 1356.21, 2760], [3190, 1437.91, 3190], [3620, 1519.61, 3620],
    [4050, 1601.31, 4050], [6000, 1732.03, 5101.20], [Infinity, 1928.10, 5101.20]];
  var K = { tipo: 0.315, generic: 0.07, dj: 0.05, djMax: 2000, minimo: 5550, iva: 0.21, year: 2026,
    escala: [[12450, 0.19], [20200, 0.24], [35200, 0.30], [60000, 0.37], [300000, 0.45], [Infinity, 0.47]] };
  var DEFAULTS = { neto: 2000, actual: 150, gastos: 200, ccaa: 'MD', locales: 2, vacaciones: 22, otros: 8, nofact: 25, horas: 8,
    plana: 0, plana_eur: 80, retencion: 15, irpf_pct: 0 };

  function r2(x) { return Math.round(x * 100) / 100; }
  function weekdays(y) { var n = 0, d = new Date(Date.UTC(y, 0, 1)); while (d.getUTCFullYear() === y) { var w = d.getUTCDay(); if (w > 0 && w < 6) n++; d.setUTCDate(d.getUTCDate() + 1); } return n; }
  function days(v) {
    var list = (FEST[v.ccaa] || FEST.MD).map(function (md) { return { d: K.year + '-' + md, n: FNAME[md] || '' }; });
    var wd = weekdays(K.year), fest = list.length, loc = Math.max(0, Math.min(2, v.locales)), free = Math.max(0, v.vacaciones) + Math.max(0, v.otros);
    var trab = Math.max(0, wd - fest - loc - free), fact = r2(trab * (1 - Math.min(90, Math.max(0, v.nofact)) / 100));
    return { laborables: wd, festivos: fest, locales: loc, libres: free, trabajo: trab, fact: fact, liste: list };
  }
  function tramo(mensual) {
    for (var i = 0; i < TRAMOS.length; i++) if (mensual <= TRAMOS[i][0]) break;
    i = Math.min(i, TRAMOS.length - 1);
    return { n: i + 1, desde: i ? TRAMOS[i - 1][0] : 0, hasta: TRAMOS[i][0], base: TRAMOS[i][1], cuota: r2(TRAMOS[i][1] * K.tipo) };
  }
  function escala(b) { var t = 0, p = 0; for (var i = 0; i < K.escala.length && b > p; i++) { t += (Math.min(b, K.escala[i][0]) - p) * K.escala[i][1]; p = K.escala[i][0]; } return t; }
  function irpf(base) { base = Math.max(0, base); return r2(Math.max(0, escala(base) - escala(Math.min(K.minimo, base)))); }
  // Reparto de una facturación anual (sin IVA). planaMeses = meses del año con tarifa plana.
  function desglose(F, v, planaMeses) {
    var G = v.gastos * 12, p = Math.max(0, Math.min(12, planaMeses));
    var rendSS = Math.max(0, F - G) * (1 - K.generic) / 12, T = tramo(rendSS);
    var cuota = r2(p * v.plana_eur + (12 - p) * T.cuota);
    var RN = F - G - cuota, dj = Math.min(Math.max(RN, 0) * K.dj, K.djMax), base = RN - dj;
    var tax = v.irpf_pct > 0 ? r2(Math.max(RN, 0) * v.irpf_pct / 100) : irpf(base);
    return { F: r2(F), G: G, rendSS: r2(rendSS), tramo: T, cuota: cuota, RN: r2(RN), dj: r2(dj), base: r2(base), irpf: tax, neto: r2(RN - tax) };
  }
  function facturacion(netoAnual, v, p) {
    var lo = 0, hi = netoAnual * 3 + v.gastos * 12 + 30000;
    while (desglose(hi, v, p).neto < netoAnual) hi *= 2;
    for (var i = 0; i < 100; i++) { var m = (lo + hi) / 2; if (desglose(m, v, p).neto >= netoAnual) hi = m; else lo = m; }
    return Math.ceil(hi * 100) / 100;
  }
  function up5(x) { return Math.ceil(x / 5 - 1e-9) * 5; }
  function compute(v) {
    var D = days(v), N = v.neto * 12, p = v.plana > 0 ? Math.min(12, v.plana) : 0;
    var F = facturacion(N, v, 0), B = desglose(F, v, 0);
    var dia = D.fact > 0 ? F / D.fact : 0, diaR = up5(dia), horaR = v.horas > 0 ? Math.ceil(diaR / v.horas) : 0;
    var out = { D: D, N: N, F: F, B: B, dia: r2(dia), diaR: diaR, horaR: horaR, plana: null, actual: null };
    if (p > 0) { // con tarifa plana los próximos p meses: lo que bastaría ahora y el salto al terminar
      var Fp = facturacion(N, v, p);
      out.plana = { meses: p, F: Fp, diaR: up5(Fp / D.fact), salto: up5(F / D.fact) - up5(Fp / D.fact), cuotaExtra: r2((B.tramo.cuota - v.plana_eur)) };
    }
    if (v.actual > 0) {
      var FA = v.actual * D.fact, A = desglose(FA, v, 0), lost = r2(N - A.neto);
      out.actual = { tarifa: v.actual, F: r2(FA), B: A, perdida: lost, perdidaMes: r2(lost / 12), diasNecesarios: A.neto >= N ? null : r2(F / v.actual) };
    }
    // Retención en factura frente al IRPF real del año
    out.retenido = r2(F * v.retencion / 100); out.renta = r2(B.irpf - out.retenido); // >0 = a pagar en la Renta, <0 = a devolver
    out.apartar = F > 0 ? r2(Math.max(0, (B.irpf - out.retenido)) / F * 100) : 0;
    out.cliente = { base: diaR, iva: r2(diaR * K.iva), ret: r2(diaR * v.retencion / 100), total: r2(diaR * (1 + K.iva - v.retencion / 100)) };
    return out;
  }
  // Seguimiento: meses con días y facturación reales → tarifa necesaria el resto del año
  function track(R, rows) {
    var done = rows.filter(function (r) { return r && (r.dias > 0 || r.fact > 0); });
    var meses = 0; rows.forEach(function (r, i) { if (r && (r.dias > 0 || r.fact > 0)) meses = i + 1; });
    var dias = 0, fact = 0; done.forEach(function (r) { dias += +r.dias || 0; fact += +r.fact || 0; });
    var plan = R.F * meses / 12, restDias = Math.max(0, R.D.fact - dias), restF = Math.max(0, R.F - fact);
    return { meses: meses, dias: r2(dias), fact: r2(fact), plan: r2(plan), diff: r2(fact - plan), media: dias ? r2(fact / dias) : 0,
      restDias: r2(restDias), restF: r2(restF), tarifaResto: restDias ? up5(restF / restDias) : 0 };
  }
  // Calendario fiscal del autónomo (modelos 130 y 303): 1T 20/04, 2T 20/07, 3T 20/10, 4T 30/01 del año siguiente
  var PLAZOS = [['1T', K.year, 4, 20], ['2T', K.year, 7, 20], ['3T', K.year, 10, 20], ['4T', K.year + 1, 1, 30]];
  var api = { CCAA: CCAA, FEST: FEST, TRAMOS: TRAMOS, K: K, DEFAULTS: DEFAULTS, PLAZOS: PLAZOS, weekdays: weekdays, days: days, tramo: tramo, irpf: irpf,
    desglose: desglose, facturacion: facturacion, compute: compute, track: track, up5: up5 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TF = api;
})(this);
