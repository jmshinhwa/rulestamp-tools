/* entrenamiento CS2 — cálculo (sin DOM; también corre en node) */
(function (root) {
  'use strict';
  var IDS = ['adr', 'hs', 'ap', 'ud'];
  var MET = [
    { id: 'adr', curto: 'ADR', nombre: 'Daño por ronda (ADR)' },
    { id: 'hs', curto: '% HS', nombre: '% de headshot' },
    { id: 'ap', curto: 'Aperturas', nombre: 'Duelos de apertura ganados (%)' },
    { id: 'ud', curto: 'Utilidad', nombre: 'Daño de utilidad por partida' }
  ];
  var CMD_BASE = ['sv_cheats 1', 'mp_warmup_end', 'mp_limitteams 0', 'mp_autoteambalance 0', 'mp_freezetime 0', 'mp_roundtime_defuse 60', 'mp_buy_anywhere 1'];
  function drill(id, rol, mapa) {
    var awp = rol === 'awp';
    if (id === 'adr') return { nombre: 'Deathmatch largo con rifles', como: 'Sin cambiar de arma: acaba cada duelo y busca al segundo enemigo antes de recargar.', cmd: [] };
    if (id === 'hs') return awp
      ? { nombre: 'Flicks con AWP en Aim Botz', como: 'Un tiro por bot, vuelve al centro entre tiros, sin scope largo.', cmd: ['sv_infinite_ammo 1', 'sv_showimpacts 1'] }
      : { nombre: 'Deathmatch solo cabeza', como: 'Servidor comunitario HS-only: mira a la altura de la cabeza al girar cada esquina.', cmd: ['sv_infinite_ammo 1', 'sv_showimpacts 1'] };
    if (id === 'ap') return { nombre: 'Prefire de ' + mapa + ' + peeks con jiggle', como: 'Mapa de prefire del taller para ' + mapa + ': limpia cada ángulo de primeras; luego peeks cortos para sacar información.', cmd: ['bot_kick'] };
    return { nombre: 'Lineups de HE y molotov en ' + mapa, como: 'Las 5 granadas que más usas en ' + mapa + ', cada una 3 veces seguidas sin mirar el vídeo.', cmd: ['sv_infinite_ammo 1', 'sv_grenade_trajectory_prac_pipreview 1'] };
  }
  var FOCO = {
    adr: 'No salgas de un duelo sin vaciar el cargador y mira tu daño al acabar cada mitad.',
    hs: 'Mira a la altura de la cabeza en cada esquina antes de girar.',
    ap: 'Primer contacto con jiggle para sacar información y pide el trade antes de pelear.',
    ud: 'Lanza en cada ronda al menos una HE o molotov de las que entrenaste hoy.'
  };

  function num(v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).trim().replace(/\s/g, '');
    if (!s) return NaN;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    return Number(s.replace(',', '.'));
  }
  function fmt(n, d) {
    if (!isFinite(n)) return '–';
    var p = Math.abs(n).toFixed(d == null ? 0 : d).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + p.join(',');
  }
  function pct(x) { return fmt(x * 100, 0) + ' %'; }
  function reparto(total, w) {
    var s = w.reduce(function (a, b) { return a + b; }, 0);
    if (!(s > 0)) return w.map(function () { return 0; });
    var raw = w.map(function (x) { return total * x / s; }), out = raw.map(Math.floor);
    var rest = total - out.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (x, i) { return { i: i, r: x - Math.floor(x) }; }).sort(function (a, b) { return b.r - a.r || a.i - b.i; })
      .slice(0, rest).forEach(function (o) { out[o.i]++; });
    return out;
  }
  function actual(inp) {
    var a = {};
    a.adr = num(inp.adr); a.hs = num(inp.hs); a.ud = num(inp.ud);
    var g = num(inp.apg), j = num(inp.apj);
    a.ap = j > 0 && g >= 0 && g <= j ? g / j * 100 : NaN;
    return a;
  }

  /* inp: {min, dias, rol, mapa, adr, m_adr, hs, m_hs, apg, apj, m_ap, ud, m_ud} */
  function plan(inp) {
    var T = Math.round(num(inp.min)), dias = Math.round(num(inp.dias));
    if (!(T >= 15 && T <= 240)) return { erro: 'Pon entre 15 y 240 minutos de entrenamiento al día.' };
    if (!(dias >= 1 && dias <= 7)) return { erro: 'Pon entre 1 y 7 días de entrenamiento por semana.' };
    var a = actual(inp), m = {}, gap = {}, bad = [];
    IDS.forEach(function (id) {
      m[id] = num(inp['m_' + id]);
      if (!(a[id] >= 0) || !(m[id] > 0)) bad.push(MET[IDS.indexOf(id)].curto);
      else gap[id] = Math.max(0, 1 - a[id] / m[id]);
    });
    if (bad.length) return { erro: 'Revisa estos datos: ' + bad.join(', ') + ' (aperturas: ganadas no puede pasar de jugadas).' };
    var calent = Math.min(12, Math.max(5, Math.round(T * 0.2))), R = T - calent;
    var gw = IDS.map(function (id) { return gap[id]; }), sin = gw.every(function (g) { return g === 0; });
    var mins = sin ? reparto(R, [1, 1, 1, 1]) : reparto(R, gw), igual = reparto(R, [1, 1, 1, 1]);
    var fi = 0; gw.forEach(function (g, i) { if (g > gw[fi]) fi = i; });
    var cumple = IDS.filter(function (id) { return gap[id] === 0; });
    var despDia = 0; IDS.forEach(function (id, i) { if (gap[id] === 0 && !sin) despDia += igual[i]; });
    var bloques = [{ id: 'cal', nombre: 'Calentamiento: Aim Botz (taller de Steam)', como: 'Bots quietos, primero un tiro por bot y después ráfagas cortas.', min: calent, cmd: [] }];
    IDS.forEach(function (id, i) {
      var d = drill(id, inp.rol, inp.mapa || 'tu mapa');
      bloques.push({ id: id, nombre: d.nombre, como: d.como, cmd: d.cmd, min: mins[i], act: a[id], meta: m[id], gap: gap[id] });
    });
    var cmds = CMD_BASE.slice(); bloques.forEach(function (b) { (b.cmd || []).forEach(function (c) { if (cmds.indexOf(c) < 0) cmds.push(c); }); });
    return {
      total: T, dias: dias, calent: calent, resto: R, act: a, meta: m, gap: gap, min: mins, igual: igual, sinFallo: sin,
      flojo: IDS[fi], flojoMin: mins[fi], flojoIgual: igual[fi], masDia: mins[fi] - igual[fi], masSemana: (mins[fi] - igual[fi]) * dias,
      cumple: cumple, despDia: despDia, despSemana: despDia * dias, semana: T * dias, bloques: bloques, cmds: cmds, foco: FOCO[IDS[fi]]
    };
  }

  /* ---- Pro: registro de partidas ---- */
  function media(H, n) {
    var S = H.slice().sort(function (x, y) { return x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0; }).slice(-(n || 5));
    if (!S.length) return null;
    var o = { n: S.length, desde: S[0].fecha, hasta: S[S.length - 1].fecha }, g = 0, j = 0;
    ['adr', 'hs', 'ud'].forEach(function (k) { var s = 0; S.forEach(function (x) { s += num(x[k]) || 0; }); o[k] = Math.round(s / S.length * 10) / 10; });
    S.forEach(function (x) { g += num(x.apg) || 0; j += num(x.apj) || 0; });
    o.apg = g; o.apj = j; o.ap = j > 0 ? g / j * 100 : NaN;
    return o;
  }
  function compara(H) {
    var S = H.slice().sort(function (x, y) { return x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0; });
    if (S.length < 6) return null;
    var ult = media(S.slice(-5), 5), ant = media(S.slice(0, -5).slice(-5), 5), d = {};
    IDS.forEach(function (id) { d[id] = ult[id] - ant[id]; });
    return { ult: ult, ant: ant, d: d };
  }
  function lunes(iso) {
    var p = String(iso).split('-'), dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])), wd = (dt.getUTCDay() + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - wd); return dt.toISOString().slice(0, 10);
  }
  function semanas(H) {
    var G = {};
    H.forEach(function (x) { var w = lunes(x.fecha); (G[w] = G[w] || []).push(x); });
    return Object.keys(G).sort().map(function (w) { var mm = media(G[w], 999); mm.semana = w; return mm; });
  }
  var CSV_COLS = ['fecha', 'mapa', 'adr', 'hs', 'apg', 'apj', 'ud', 'min'];
  function csv(H) {
    var L = ['fecha;mapa;adr;hs_pct;aperturas_ganadas;aperturas_jugadas;dano_utilidad;min_entreno'];
    H.slice().sort(function (x, y) { return x.fecha < y.fecha ? -1 : 1; }).forEach(function (x) {
      L.push(CSV_COLS.map(function (k) { return String(x[k] == null ? '' : x[k]).replace(/[;\r\n]/g, ' '); }).join(';'));
    });
    return L.join('\r\n') + '\r\n';
  }
  function leerCsv(t) {
    var out = [];
    String(t).replace(/^﻿/, '').split(/\r?\n/).forEach(function (l, i) {
      if (!l.trim() || (i === 0 && /fecha/i.test(l))) return;
      var c = l.split(/[;,\t]/), o = {};
      CSV_COLS.forEach(function (k, n) { o[k] = (c[n] || '').trim(); });
      if (/^\d{4}-\d{2}-\d{2}$/.test(o.fecha)) out.push(o);
    });
    return out;
  }
  function ics(hora, desde, dias) {
    var h = /^(\d{2}):(\d{2})$/.exec(hora || '') || [0, '19', '00'], d = String(desde).replace(/-/g, '');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//entrenamiento-cs2//es', 'BEGIN:VEVENT', 'UID:entreno-cs2-' + d + '@app',
      'DTSTAMP:' + d + 'T000000Z', 'DTSTART:' + d + 'T' + h[1] + h[2] + '00', 'DURATION:PT30M', 'RRULE:FREQ=DAILY;COUNT=' + (dias || 30),
      'SUMMARY:entrenamiento CS2: rutina de hoy', 'DESCRIPTION:Abre la rutina\\, entrena y apunta la partida.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }
  function cfg(p) {
    var L = ['// entrenamiento CS2 - rutina de ' + p.total + ' min', '// exec entreno en la consola de un servidor local con bots'];
    p.bloques.forEach(function (b) { L.push('// ' + b.min + ' min - ' + b.nombre); });
    p.cmds.forEach(function (c) { L.push(c); });
    return L.join('\n') + '\n';
  }
  var API = { IDS: IDS, MET: MET, CMD_BASE: CMD_BASE, num: num, fmt: fmt, pct: pct, reparto: reparto, actual: actual, plan: plan,
    media: media, compara: compara, semanas: semanas, csv: csv, leerCsv: leerCsv, ics: ics, cfg: cfg, lunes: lunes };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ENTRENO = API;
})(this);
