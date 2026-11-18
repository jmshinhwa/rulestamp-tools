
(function (g) {
  'use strict';
  var SLUG = 'jobborse-stellenangebote';
  var API = (typeof location !== 'undefined' && (/rulestamp\.com$/.test(location.hostname) || location.protocol === 'http:')) ? '' : '';
  var BUY = { month: '' + SLUG, year: '' + SLUG + '.year' };
  if (typeof location !== 'undefined' && !/rulestamp\.com$/.test(location.hostname)) { BUY.month = 'https://getreadystack.com' + BUY.month; BUY.year = 'https://getreadystack.com' + BUY.year; }
  var DOORS = [[SLUG, 'month'], [SLUG + '.year', 'year']];   // a key is bound to the door it was bought through
  var RECHECK = 7 * 864e5, GRACE = 30 * 864e5, K = 'jbde:lic';
  function validate1(key, door) {
    return fetch(API + '?key=' + encodeURIComponent(key) + '&slug=' + encodeURIComponent(door), { headers: { accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) { if (r.status !== 200) return { ok: false, offline: r.status >= 500 }; return r.json().then(function (j) { return { ok: !!(j && j.ok), offline: false }; }, function () { return { ok: false }; }); },
        function () { return { ok: false, offline: true }; });
  }
  function validate(key) {
    var i = 0, off = false;
    function next() {
      if (i >= DOORS.length) return Promise.resolve({ ok: false, offline: off });
      var d = DOORS[i++];
      return validate1(key, d[0]).then(function (r) { if (r.ok) return { ok: true, tier: d[1] }; off = off || r.offline; return next(); });
    }
    return next();
  }
  function saved() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }
  function save(v) { try { if (v) localStorage.setItem(K, JSON.stringify(v)); else localStorage.removeItem(K); } catch (e) {} }
  function status() {
    var s = saved();
    if (!s || !s.key) return Promise.resolve({ tier: 'free' });
    var age = Date.now() - (s.at || 0);
    if (age < RECHECK) return Promise.resolve({ tier: s.tier, key: s.key });
    return validate(s.key).then(function (r) {
      if (r.ok) { save({ key: s.key, tier: r.tier, at: Date.now() }); return { tier: r.tier, key: s.key }; }
      if (r.offline && age < GRACE) return { tier: s.tier, key: s.key };
      if (!r.offline) save(null);
      return { tier: 'free' };
    });
  }
  function enter(key) {
    key = String(key || '').trim();
    if (!key) return Promise.resolve({ ok: false });
    return validate(key).then(function (r) { if (r.ok) save({ key: key, tier: r.tier, at: Date.now() }); return r; });
  }
  function remove() { save(null); }
  g.JBLIC = { status: status, enter: enter, remove: remove, save: save, BUY: BUY, SLUG: SLUG, API: API };
})(typeof globalThis !== 'undefined' ? globalThis : this);
