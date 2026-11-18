/* divorce asset division calculator — engine (no DOM). Runs in the browser (window.DAD) and in node (module.exports). */
(function (root) {
  'use strict';
  // IRS Publication 555 (Rev. 12-2024), "Married individuals ... domiciled in one of the following community property states"
  var CP = { AZ: 1, CA: 1, ID: 1, LA: 1, NV: 1, NM: 1, TX: 1, WA: 1, WI: 1 };
  var STATES = [['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'],
    ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'],
    ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'],
    ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
    ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'],
    ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
    ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']];
  var KINDS = {
    home: 'Home (equity taxed on sale above the exclusion)',
    cash: 'Cash / bank account',
    pretax: 'Pre-tax retirement: 401(k), 403(b), traditional IRA, pension',
    roth: 'Roth IRA / Roth 401(k)',
    taxable: 'Brokerage / stocks / crypto (gain above basis taxed)',
    vehicle: 'Vehicle',
    business: 'Business / other property (gain above basis taxed)',
    other: 'Other asset (no tax adjustment)',
    debt: 'Debt: mortgage, loan, card (enter as a positive amount)'
  };
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function r2(x) { return Math.round(x * 100) / 100; }
  function isCP(st) { return !!CP[st]; }

  /* tax that would be paid when this item is cashed in (whole item), before any split */
  function itemTax(it, o) {
    var v = Math.max(0, num(it.value)), b = num(it.basis);
    if (it.kind === 'pretax') return v * o.ti / 100;
    if (it.kind === 'taxable' || it.kind === 'business') return Math.max(0, v - b) * o.tcg / 100;
    if (it.kind === 'home') return Math.max(0, v - b - o.excl) * o.tcg / 100;
    return 0;
  }

  /* c = {state, pctA, nameA, nameB, ti, tcg, excl, items:[{name, kind, value, basis, sep, sepOwner:''|'A'|'B', keep:'A'|'B'|'sell'}]} */
  function compute(c) {
    var o = { ti: Math.min(60, Math.max(0, num(c.ti))), tcg: Math.min(60, Math.max(0, num(c.tcg))), excl: Math.max(0, num(c.excl)) };
    var pA = Math.min(100, Math.max(0, num(c.pctA))) / 100, pB = 1 - pA;
    var rows = [], M = 0, keptA = 0, keptB = 0, taxA = 0, taxB = 0, sepA = 0, sepB = 0, assets = 0, debts = 0;
    (c.items || []).forEach(function (it) {
      var v = Math.max(0, num(it.value));
      if (!v && !String(it.name || '').trim()) return;
      var sign = it.kind === 'debt' ? -1 : 1;
      var so = it.sepOwner === 'A' || it.sepOwner === 'B' ? it.sepOwner : '';
      var sepAmt = so ? (num(it.sep) > 0 ? Math.min(num(it.sep), v) : v) : 0;
      var mar = v - sepAmt;
      var tax = itemTax(it, o), taxMar = v > 0 ? tax * mar / v : 0;
      var toA = it.keep === 'A' ? 1 : it.keep === 'B' ? 0 : pA;
      var sm = sign * mar;
      M += sm; keptA += sm * toA; keptB += sm * (1 - toA);
      taxA += taxMar * toA; taxB += taxMar * (1 - toA);
      if (so === 'A') sepA += sign * sepAmt; else if (so === 'B') sepB += sign * sepAmt;
      if (sign > 0) assets += v; else debts += v;
      rows.push({ name: String(it.name || '').trim() || '(no name)', kind: it.kind, value: sign * v, sep: sign * sepAmt, sepOwner: so, marital: r2(sm),
        tax: r2(taxMar), keep: it.keep === 'A' || it.keep === 'B' ? it.keep : 'sell', toA: r2(sm * toA), toB: r2(sm * (1 - toA)) });
    });
    var targetA = M * pA, targetB = M * pB;
    var E = keptA - targetA;                               // > 0: A pays B · < 0: B pays A (face value)
    var Mt = M - taxA - taxB, keptAt = keptA - taxA, keptBt = keptB - taxB;
    var Et = keptAt - Mt * pA;                              // the same 'even-up' measured after the tax each side will owe
    var walkA = keptAt - E, walkB = keptBt + E;             // after-tax money each walks away with if the face-value payment is made
    return {
      cp: isCP(c.state), pctA: r2(pA * 100), pctB: r2(pB * 100), rows: rows,
      assets: r2(assets), debts: r2(debts), estate: r2(M), sepA: r2(sepA), sepB: r2(sepB),
      keptA: r2(keptA), keptB: r2(keptB), targetA: r2(targetA), targetB: r2(targetB),
      pay: r2(Math.abs(E)), payer: E > 0.004 ? 'A' : E < -0.004 ? 'B' : '',
      taxA: r2(taxA), taxB: r2(taxB), estateAfterTax: r2(Mt),
      payAfterTax: r2(Math.abs(Et)), payerAfterTax: Et > 0.004 ? 'A' : Et < -0.004 ? 'B' : '',
      faceMinusTax: r2(E - Et),                             // how much the face-value payment moves from A to B beyond the after-tax even-up
      walkA: r2(walkA), walkB: r2(walkB),
      walkPctA: Mt ? r2(walkA / Mt * 100) : 0, walkPctB: Mt ? r2(walkB / Mt * 100) : 0
    };
  }

  function usd(x, cents) {
    var neg = x < 0, v = Math.abs(x);
    var s = cents ? v.toFixed(2) : String(Math.round(v));
    var p = s.split('.'), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + '$' + i + (p[1] ? '.' + p[1] : '');
  }

  function csvCell(v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(c, r) {
    var A = c.nameA || 'Spouse A', B = c.nameB || 'Spouse B';
    var L = [['Item', 'Type', 'Value', 'Separate part', 'Separate owner', 'Marital part', 'Kept by', 'To ' + A, 'To ' + B, 'Tax on cash-in (marital part)']];
    r.rows.forEach(function (x) {
      L.push([x.name, x.kind, x.value, x.sep, x.sepOwner ? (x.sepOwner === 'A' ? A : B) : '', x.marital, x.keep === 'A' ? A : x.keep === 'B' ? B : 'Sell and split', x.toA, x.toB, x.tax]);
    });
    L.push([]);
    L.push(['Net marital estate', '', r.estate]);
    L.push(['Split', '', A + ' ' + r.pctA + '% / ' + B + ' ' + r.pctB + '%']);
    L.push(['Equalization payment (face value)', '', r.pay, r.payer ? (r.payer === 'A' ? A + ' pays ' + B : B + ' pays ' + A) : 'none']);
    L.push(['Equalization payment (after tax)', '', r.payAfterTax, r.payerAfterTax ? (r.payerAfterTax === 'A' ? A + ' pays ' + B : B + ' pays ' + A) : 'none']);
    L.push(['Separate property kept out', '', A + ' ' + r.sepA, B + ' ' + r.sepB]);
    return L.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  function ics(dateISO, title, note) {
    var d = String(dateISO || '').replace(/-/g, '');
    if (!/^\d{8}$/.test(d)) return '';
    var nx = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1)).toISOString().slice(0, 10).replace(/-/g, '');
    var esc = function (s) { return String(s || '').replace(/[\\;,]/g, function (m) { return '\\' + m; }).replace(/\n/g, '\\n'); };
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yoojin//divorce-asset-division//EN', 'BEGIN:VEVENT',
      'UID:' + d + '-' + Math.abs(hash(title + note)) + '@divorce-asset-division', 'DTSTAMP:' + d + 'T000000Z',
      'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + nx, 'SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(note),
      'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(title), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  var api = { CP: CP, STATES: STATES, KINDS: KINDS, num: num, isCP: isCP, compute: compute, usd: usd, csv: csv, ics: ics, itemTax: itemTax };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DAD = api;
})(this);
