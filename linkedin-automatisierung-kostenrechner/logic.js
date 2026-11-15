/* LinkedIn Automatisierung Kostenrechner - reine Rechnung (Browser + node) */
(function (root) {
  var PRESETS = {
    // Preise gelesen am 15.11.2026 auf den Preisseiten der Anbieter (Monatszahlung, netto)
    walead:   { name: 'WaLead (Basis 65 €, +50 € je Sender, +50 € je 1.000 Credits)', cur: 'EUR', base: 65, incl_acc: 1, extra_acc: 50, cred_incl: 1000, pack_size: 1000, pack_price: 50 },
    expandi:  { name: 'Expandi Business (99 USD je Sitz)', cur: 'USD', base: 99, incl_acc: 1, extra_acc: 99, cred_incl: 0, pack_size: 0, pack_price: 0 },
    dripify:  { name: 'Dripify Pro monatlich (79 USD je Nutzer, 1.000 Credits 29 USD)', cur: 'USD', base: 79, incl_acc: 1, extra_acc: 79, cred_incl: 100, pack_size: 1000, pack_price: 29 },
    heyreach: { name: 'HeyReach Growth (79 USD je Sender)', cur: 'USD', base: 79, incl_acc: 1, extra_acc: 79, cred_incl: 0, pack_size: 0, pack_price: 0 }
  };
  var DEF = { cur: 'USD', base: 79, incl_acc: 1, extra_acc: 79, acc: 2, cred_need: 2000, cred_incl: 100, pack_size: 1000, pack_price: 29,
    nav: 0, fx: 1.1052, vat: 'klein', vat_rate: 19, meetings: 6, renew: '2027-01-15', notice: 30 };
  function n(x, d) { x = parseFloat(String(x == null ? '' : x).replace(',', '.')); return isFinite(x) ? x : d; }
  function r2(x) { return Math.round(x * 100 + 1e-9) / 100; }
  function compute(v) {
    var cur = v.cur === 'EUR' ? 'EUR' : 'USD';
    var fx = n(v.fx, 1); if (fx <= 0) fx = 1;
    var acc = Math.max(1, Math.round(n(v.acc, 1)));
    var inclAcc = Math.max(1, Math.round(n(v.incl_acc, 1)));
    var base = Math.max(0, n(v.base, 0)), extraP = Math.max(0, n(v.extra_acc, 0));
    var need = Math.max(0, n(v.cred_need, 0)), inclC = Math.max(0, n(v.cred_incl, 0));
    var psize = Math.max(0, n(v.pack_size, 0)), pprice = Math.max(0, n(v.pack_price, 0));
    var extraAcc = Math.max(0, acc - inclAcc);
    var missing = Math.max(0, need - inclC);
    var packs = psize > 0 ? Math.ceil(missing / psize) : 0;
    var toolCur = r2(base + extraAcc * extraP + packs * pprice);
    function eur(x) { return cur === 'USD' ? x / fx : x; }
    var toolEur = r2(eur(toolCur));
    var navEur = r2(Math.max(0, n(v.nav, 0)) * acc);
    var netEur = r2(toolEur + navEur);
    var listAccEur = r2(eur(base / inclAcc));
    var realAccEur = r2(netEur / acc);
    var rate = Math.max(0, n(v.vat_rate, 19));
    var vatEur = r2(netEur * rate / 100);
    var klein = v.vat === 'klein';
    var burdenVat = klein ? vatEur : 0;
    var monthEur = r2(netEur + burdenVat);
    var yearEur = r2(monthEur * 12);
    var lossYear = r2(burdenVat * 12);
    var accMonth = r2(monthEur / acc);
    var meet = Math.max(0, n(v.meetings, 0));
    var perMeeting = meet > 0 ? r2(monthEur / meet) : null;
    var factor = listAccEur > 0 ? Math.round(accMonth / listAccEur * 100) / 100 : null;
    return { cur: cur, fx: fx, acc: acc, extraAcc: extraAcc, packs: packs, missing: missing, toolCur: toolCur, toolEur: toolEur, navEur: navEur,
      netEur: netEur, listAccEur: listAccEur, realAccEur: realAccEur, rate: rate, vatEur: vatEur, klein: klein, burdenVat: burdenVat,
      monthEur: monthEur, yearEur: yearEur, lossYear: lossYear, accMonth: accMonth, perMeeting: perMeeting, factor: factor };
  }
  // Kündigungstermin: Verlängerung minus Frist in Tagen
  function cancelBy(renew, days) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(renew || '').slice(0, 10)); if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); if (isNaN(d)) return null;
    d.setUTCDate(d.getUTCDate() - Math.max(0, Math.round(n(days, 0))));
    return d.toISOString().slice(0, 10);
  }
  // Rechnungsliste: § 13b-Steuer je Monat
  function invoiceSum(rows, rate) {
    rate = n(rate, 19); var by = {}, tot = { net: 0, vat: 0 };
    (rows || []).forEach(function (r) {
      var m = String(r.date || '').slice(0, 7); if (!/^\d{4}-\d{2}$/.test(m)) return;
      var amt = n(r.amount, 0), fx = n(r.fx, 1) || 1;
      var net = r2(r.cur === 'USD' ? amt / fx : amt), vat = r2(net * rate / 100);
      by[m] = by[m] || { month: m, net: 0, vat: 0, n: 0 };
      by[m].net = r2(by[m].net + net); by[m].vat = r2(by[m].vat + vat); by[m].n++;
      tot.net = r2(tot.net + net); tot.vat = r2(tot.vat + vat);
    });
    return { months: Object.keys(by).sort().map(function (k) { return by[k]; }), total: tot };
  }
  function de(x, d) { if (x == null || !isFinite(x)) return '–'; d = d == null ? 2 : d;
    var s = Math.abs(x).toFixed(d).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (x < 0 ? '−' : '') + s.join(','); }
  var api = { PRESETS: PRESETS, DEF: DEF, compute: compute, cancelBy: cancelBy, invoiceSum: invoiceSum, de: de, r2: r2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LAK = api;
})(this);
