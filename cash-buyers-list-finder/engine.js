/* cash buyers list — engine (pure functions, browser + node) */
(function (root) {
  'use strict';
  var SAMPLE = "Sale Date,Buyer Name,Buyer Mailing Address,Property Address,Property Zip,Property Type,Sale Price,Loan Amount\n2026-11-03,REDLINE PROPERTY GROUP LLC,\"880 W PEACHTREE ST NW STE 1200, ATLANTA GA 30309\",1452 Sylvan Rd SW,30310,SFR,109000,\n2026-10-28,MAPLE RIDGE HOMES LLC,\"PO BOX 4471, ATLANTA GA 30302\",1187 Lucile Ave SW,30310,SFR,131000,\n2026-10-17,Jasmine Carter,\"1240 Lucile Ave SW, Atlanta GA 30310\",1240 Lucile Ave SW,30310,SFR,289000,280330\n2026-10-10,J & K RENTALS INC,\"3125 DELOWE DR, EAST POINT GA 30344\",811 Joseph E Boone Blvd NW,30314,Duplex,98000,\n2026-09-29,KINGSLEY HOMEBUYERS LLC,\"455 GLEN IRIS DR NE UNIT 6, ATLANTA GA 30308\",1314 Graymont Dr SW,30310,SFR,121000,\n2026-09-15,\"Maple Ridge Homes, L.L.C.\",\"P.O. Box 4471, Atlanta, GA 30302\",742 Oakland Dr SW,30310,SFR,124500,0\n2026-09-08,Tomas Reyes,\"88 Ormewood Ave SE, Atlanta GA 30315\",1756 Olympian Way SW,30311,SFR,99000,\n2026-09-02,Michael and Ana Brooks,\"2150 Westwood Ave SW, Atlanta GA 30311\",2150 Westwood Ave SW,30311,SFR,315000,252000\n2026-08-28,FEDERAL NATIONAL MORTGAGE ASSOCIATION,\"PO BOX 650043, DALLAS TX 75265\",1102 Sylvan Rd SW,30310,SFR,151200,\n2026-08-19,RPG Holdings LLC,\"880 West Peachtree Street NW Suite 1200, Atlanta, GA 30309\",986 Dill Ave SW,30310,SFR,126000,\n2026-08-05,PEACHTREE FLIP CO LLC,\"2970 PEACHTREE RD NW STE 300, ATLANTA GA 30305\",1995 Beecher Rd SW,30311,SFR,186000,\n2026-07-21,HAYES DARNELL,\"519 HOLDERNESS ST SW, ATLANTA GA 30310\",1361 Avon Ave SW,30310,SFR,72000,\n2026-07-11,KEISHA WARD,\"1077 Lena St NW, Atlanta GA 30314\",1077 Lena St NW,30314,SFR,245000,240562\n2026-07-02,Maple Ridge Homes LLC,\"PO Box 4471 Atlanta GA 30302\",215 Peeples St SW,30310,SFR,118000,\n2026-06-30,REDLINE PROPERTY GROUP LLC,\"880 W PEACHTREE ST NW STE 1200, ATLANTA GA 30309\",1452 Sylvan Rd SW,30310,SFR,10,\n2026-06-24,J&K Rentals Inc.,\"3125 Delowe Drive, East Point, GA 30344\",64 Chestnut St NW,30314,SFR,85000,\n2026-06-02,SOUTHSIDE LAND TRUST,\"PO BOX 90211, ATLANTA GA 30364\",0 Proctor St NW,30314,Vacant Land,24000,\n2026-05-20,MAPLE RIDGE HOMES LLC,\"PO BOX 4471, ATLANTA GA 30302\",1630 Beecher St SW,30311,SFR,142000,\n2026-05-06,Greenleaf Rentals LLC,\"3400 Lenox Rd NE Ste 210, Atlanta GA 30326\",1490 Avon Ave SW,30310,Duplex,210000,157500\n2026-04-22,BRIGHTWATER HOMES LLC,\"1100 SPRING ST NW STE 450, ATLANTA GA 30309\",1288 Lucile Ave SW,30310,SFR,139000,\n2026-04-07,Redline Property Grp LLC,\"880 W Peachtree St NW #1200, Atlanta GA 30309\",2240 Campbellton Rd SW,30311,Duplex,140000,\n2026-03-27,Peachtree Flip Co.,\"2970 Peachtree Rd NW Suite 300, Atlanta, GA 30305\",1820 Westhaven Dr SW,30311,SFR,152000,\n2026-03-18,Kingsley Homebuyers LLC,\"455 Glen Iris Dr NE #6, Atlanta GA 30308\",1757 Westwood Ave SW,30310,SFR,133000,\n2026-03-12,Robert Kim,\"2215 Fairhaven Cir NE, Atlanta GA 30305\",1688 Beecher St SW,30311,SFR,262000,209600\n2026-02-25,WELLS FARGO BANK NA,\"1 HOME CAMPUS, DES MOINES IA 50328\",1544 Westwood Ave SW,30311,SFR,98500,\n2026-02-11,Maple Ridge Homes Llc,\"PO Box 4471, Atlanta, GA 30302\",2088 Westwood Ave SW,30311,SFR,168000,\n2026-01-30,Darnell Hayes,\"519 Holderness St SW, Atlanta, GA 30310\",1033 Hopkins St SW,30310,SFR,88000,\n2026-01-15,J AND K RENTALS INC,\"3125 Delowe Dr East Point GA 30344\",1029 Lena St NW,30314,SFR,110000,\n2026-01-08,Aaliyah Brown,\"1302 Sylvan Rd SW, Atlanta GA 30310\",1302 Sylvan Rd SW,30310,SFR,238000,233681\n2025-12-30,REDLINE PROPERTY GROUP LLC,\"880 W PEACHTREE ST NW STE 1200 ATLANTA GA 30309\",1601 Murphy Ave SW,30310,SFR,95000,\n2025-12-09,MAPLE RIDGE HOMES L L C,\"PO BOX 4471 ATLANTA GA 30302\",541 Lawshe St NW,30314,SFR,112000,\n2025-06-12,OAKLINE CAPITAL LLC,\"3340 PEACHTREE RD NE STE 1800, ATLANTA GA 30326\",1405 Sells Ave SW,30310,SFR,104000,\n2025-05-14,ORTIZ LENA,\"2716 Ridge Ave, Decatur GA 30032\",1918 Venetian Dr SW,30311,SFR,115000,\n2025-03-03,Oakline Capital LLC,\"3340 Peachtree Rd NE Suite 1800, Atlanta GA 30326\",1546 Lucile Ave SW,30310,SFR,97000,\n2024-11-19,OAKLINE CAPITAL LLC,\"3340 PEACHTREE RD NE STE 1800, ATLANTA GA 30326\",752 Oakland Dr SW,30310,SFR,91000,\n";
  var DEFAULTS = { csv: SAMPLE, asof: '2026-11-18', months: '12', minbuys: '2', who: 'all', dzip: '30310', dprice: '125000', dtype: 'SFR', fee: '10000', assignby: '2026-12-18' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(x) {
    if (x == null || isNaN(x)) return '—';
    var n = Math.round(Math.abs(x)), s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (x < 0 ? '−$' : '$') + s;
  }
  function num(s) { var t = String(s == null ? '' : s).replace(/[\s$,]/g, ''); if (t === '' || isNaN(+t)) return null; return +t; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function parseDate(s) {
    s = String(s || '').trim(); var m;
    if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/.exec(s))) { var y = +m[3]; if (y < 100) y += y < 70 ? 2000 : 1900; return Date.UTC(y, +m[1] - 1, +m[2]); }
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return null;
  }
  function ymd(t) { return t == null ? '' : iso(new Date(t)); }
  function addMonths(t, k) { var d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, d.getUTCDate()); }
  function flat(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  // ---- CSV ----
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    var first = text.split(/\r?\n/)[0] || '', delim = ',';
    var c = { ',': (first.match(/,/g) || []).length, ';': (first.match(/;/g) || []).length, '\t': (first.match(/\t/g) || []).length };
    if (c['\t'] > c[delim]) delim = '\t'; if (c[';'] > c[delim]) delim = ';';
    var rows = [], row = [], f = '', q = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.join('').trim() !== '') rows.push(row); row = []; }
      else f += ch;
    }
    row.push(f); if (row.join('').trim() !== '') rows.push(row);
    return rows;
  }

  var ALIAS = {
    buyer: ['buyer name', 'buyer', 'grantee', 'grantee name', 'buyer 1', 'owner 1 full name', 'owner name', 'owner', 'purchaser', 'new owner', 'buyer full name'],
    mail: ['buyer mailing address', 'mailing address', 'owner mailing address', 'mail address', 'grantee address', 'buyer address', 'owner address', 'mailing street'],
    addr: ['property address', 'address', 'situs address', 'site address', 'property street', 'street address'],
    zip: ['property zip', 'zip', 'zip code', 'site zip', 'situs zip', 'property zip code', 'postal code', 'zipcode'],
    date: ['sale date', 'recording date', 'last sale date', 'last sale recording date', 'sold date', 'date sold', 'deed date', 'close date', 'closing date', 'transfer date', 'date', 'recorded date', 'instrument date'],
    price: ['sale price', 'sale amount', 'last sale amount', 'last sale price', 'sold price', 'price', 'consideration', 'sales price', 'transfer amount'],
    loan: ['loan amount', 'mortgage amount', 'first mortgage amount', '1st mortgage amount', 'loan', 'mortgage', 'est. mortgage balance', 'mortgage balance', 'total open loans'],
    lender: ['lender', 'lender name', 'mortgage lender', '1st mortgage lender'],
    fin: ['financing', 'sale type', 'buyer financing', 'purchase method', 'financing type', 'cash sale', 'cash buyer', 'last sale type'],
    type: ['property type', 'type', 'land use', 'use code', 'property use', 'property class']
  };
  function detect(head) {
    var h = head.map(function (x) { return flat(String(x).replace(/[_]+/g, ' ')).toLowerCase(); }), used = {}, out = {};
    Object.keys(ALIAS).forEach(function (k) {
      var i = -1;
      ALIAS[k].some(function (a) { var j = h.indexOf(a); if (j >= 0 && !used[j]) { i = j; return true; } return false; });
      if (i < 0) {
        h.some(function (x, j) {
          if (used[j]) return false;
          var ok = (k === 'buyer' && /(buyer|grantee|owner).*name|^buyer|^grantee/.test(x) && !/mail|address/.test(x)) ||
                   (k === 'mail' && /mail/.test(x) && /addr|street/.test(x)) ||
                   (k === 'zip' && /zip|postal/.test(x) && !/mail|owner/.test(x)) ||
                   (k === 'date' && /date/.test(x) && /sale|sold|record|deed|transfer/.test(x)) ||
                   (k === 'price' && /(sale|sold|transfer).*(price|amount)/.test(x)) ||
                   (k === 'loan' && /(loan|mortgage)/.test(x) && /(amount|amt|balance)/.test(x)) ||
                   (k === 'lender' && /lender/.test(x)) ||
                   (k === 'type' && /type|land use/.test(x) && !/sale|financ|loan/.test(x));
          if (ok) { i = j; return true; } return false;
        });
      }
      if (i >= 0) { used[i] = true; out[k] = i; }
    });
    // mailing city/state/zip in separate columns
    out.mailExtra = [];
    h.forEach(function (x, j) { if (!used[j] && /mail/.test(x) && /(city|state|zip)/.test(x)) out.mailExtra.push(j); });
    return out;
  }

  // ---- names & addresses ----
  var SUFFIX = /\b(L ?L ?C|L ?L ?P|L ?P|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLLC|PC|THE|TR|TRUSTEE|TRUSTEES|ET AL|ETAL|ETUX|ET UX)\b/g;
  var ABBR = { GRP: 'GROUP', HLDGS: 'HOLDINGS', HLDG: 'HOLDING', PROPS: 'PROPERTIES', PROP: 'PROPERTY', INVS: 'INVESTMENTS', INVT: 'INVESTMENT', MGMT: 'MANAGEMENT', MGT: 'MANAGEMENT', DEV: 'DEVELOPMENT', ENT: 'ENTERPRISES', SVCS: 'SERVICES', RLTY: 'REALTY', CAP: 'CAPITAL', HMS: 'HOMES' };
  var COMPANY = /\b(LLC|L\.?L\.?C|INC|CORP|CORPORATION|COMPANY|CO\.?|LP|LLP|LTD|TRUST|HOLDINGS?|PROPERTIES|PROPERTY|HOMES|HOMEBUYERS|CAPITAL|INVEST\w*|REALTY|GROUP|GRP|RENTALS|VENTURES|PARTNERS|ENTERPRISES|DEVELOPMENT|ASSETS|EQUITY|FUND|ACQUISITIONS)\b/i;
  var INSTITUTION = /\b(BANK|BANCORP|FEDERAL NATIONAL MORTGAGE|FANNIE MAE|FEDERAL HOME LOAN|FREDDIE MAC|SECRETARY OF HOUSING|HOUSING AND URBAN|\bHUD\b|VETERANS AFFAIRS|CITY OF|COUNTY OF|STATE OF|HOUSING AUTHORITY|LAND BANK|CREDIT UNION|SAVINGS|MORTGAGE (LLC|INC|CORP|COMPANY|ASSOCIATION|SERVICING)|LOAN SERVICING|NATIONAL ASSOCIATION|N\.A\.?$|\bNA$)/i;
  function nameKey(s) {
    var t = flat(s).toUpperCase().replace(/&/g, ' AND ').replace(/\./g, '').replace(/[^A-Z0-9 ]+/g, ' ');
    t = ' ' + t.replace(/\s+/g, ' ').trim() + ' ';
    t = t.replace(/ L L C | LLC /g, ' ').replace(SUFFIX, ' ');
    var w = t.split(/\s+/).filter(Boolean).map(function (x) { return ABBR[x] || x; });
    return w.sort().join(' ');
  }
  var STREET = { STREET: 'ST', AVENUE: 'AVE', AV: 'AVE', ROAD: 'RD', DRIVE: 'DR', BOULEVARD: 'BLVD', LANE: 'LN', COURT: 'CT', CIRCLE: 'CIR', PLACE: 'PL', PARKWAY: 'PKWY', HIGHWAY: 'HWY', TERRACE: 'TER', WEST: 'W', EAST: 'E', NORTH: 'N', SOUTH: 'S', NORTHWEST: 'NW', NORTHEAST: 'NE', SOUTHWEST: 'SW', SOUTHEAST: 'SE', SUITE: '#', STE: '#', UNIT: '#', APT: '#', APARTMENT: '#', NO: '#' };
  function mailKey(s) {
    var t = flat(s).toUpperCase().replace(/P\.\s*O\.|POST OFFICE/g, 'PO').replace(/[.,]/g, ' ').replace(/#/g, ' # ').replace(/[^A-Z0-9# ]+/g, ' ');
    var w = t.split(/\s+/).filter(Boolean).map(function (x) { return STREET[x] || x; });
    var out = [];
    w.forEach(function (x) { if (x === '#' && out[out.length - 1] === '#') return; out.push(x); });
    t = out.join(' ').replace(/# (\w+)/g, '#$1').replace(/\bP O BOX\b/, 'PO BOX');
    // keep street line + 5-digit zip; drop city/state words (they vary: "ATLANTA GA" vs "ATLANTA, GA")
    var z = /(\d{5})(?:\s*\d{4})?\s*$/.exec(t), zip = z ? z[1] : '';
    var m = /^(PO BOX \w+|\d+[A-Z]? (?:[A-Z0-9#]+ ){0,6}?(?:ST|AVE|RD|DR|BLVD|LN|CT|CIR|PL|PKWY|HWY|TER|WAY)\b(?: [NSEW]{1,2}\b)?(?: #\w+)?)/.exec(t);
    var line = m ? m[1] : t.replace(/\d{5}(\s*\d{4})?\s*$/, '').trim();
    if (line.length < 5) return '';
    return line + (zip ? ' ' + zip : '');
  }
  function ptype(s) {
    var t = flat(s).toLowerCase();
    if (!t) return '';
    if (/land|lot|vacant|acre|agric/.test(t)) return 'Land';
    if (/duplex|triplex|quad|multi|2-4|apartment|plex/.test(t)) return 'Multi';
    if (/condo|town/.test(t)) return 'Condo';
    if (/mobile|manufactured/.test(t)) return 'Mobile';
    if (/sfr|single|residential|house|detached/.test(t)) return 'SFR';
    if (/commercial|retail|office|industrial/.test(t)) return 'Commercial';
    return flat(s);
  }

  // ---- analysis ----
  function analyze(cfg, extraTexts) {
    cfg = cfg || DEFAULTS;
    var texts = [cfg.csv].concat(extraTexts || []);
    var asof = parseDate(cfg.asof) || Date.UTC(2026, 10, 18), months = +cfg.months || 12, minb = +cfg.minbuys || 2;
    var since = addMonths(asof, -months);
    var st = { files: 0, rows: 0, financed: 0, institutions: 0, nominal: 0, noDate: 0, noBuyer: 0, noPrice: 0, dupRows: 0, cashRows: 0, cashWindow: 0, future: 0 };
    var cols = null, cashKnown = false, sales = [], seen = {}, colsList = [];
    texts.forEach(function (tx) {
      if (!String(tx || '').trim()) return;
      var R = parseCSV(tx); if (R.length < 2) return;
      var c = detect(R[0]); colsList.push({ head: R[0], c: c }); if (!cols) cols = c; st.files++;
      if (c.loan != null || c.lender != null || c.fin != null) cashKnown = true;
      for (var i = 1; i < R.length; i++) {
        var r = R[i], g = function (k) { return c[k] == null ? '' : flat(r[c[k]]); };
        st.rows++;
        var buyer = g('buyer');
        if (!buyer) { st.noBuyer++; continue; }
        var d = parseDate(g('date'));
        if (d == null) { st.noDate++; continue; }
        var mail = g('mail'); if (c.mailExtra.length) mail = [mail].concat(c.mailExtra.map(function (j) { return flat(r[j]); })).filter(Boolean).join(' ');
        var addr = g('addr'), zip = g('zip'); if (!/^\d{5}/.test(zip)) { var zz = /(\d{5})(?:-\d{4})?\s*$/.exec(addr); zip = zz ? zz[1] : ''; } else zip = zip.slice(0, 5);
        var price = num(g('price')), loan = num(g('loan')), lender = g('lender'), fin = g('fin').toLowerCase();
        var dk = d + '|' + addr.toUpperCase() + '|' + nameKey(buyer);
        if (seen[dk]) { st.dupRows++; continue; } seen[dk] = 1;
        if (INSTITUTION.test(buyer)) { st.institutions++; continue; }
        var financed = (loan != null && loan > 0) || (!!lender && !/^(none|n\/a|cash|-)$/i.test(lender)) || (/conv|fha|\bva\b|usda|loan|mortgage|financ|seller/.test(fin) && !/cash/.test(fin)) || /^(n|no|false|0)$/.test(fin);
        if (financed) { st.financed++; continue; }
        if (price != null && price > 0 && price < 1000) { st.nominal++; continue; }
        if (price == null || price <= 0) st.noPrice++;
        if (d > asof) st.future++;
        sales.push({ buyer: buyer, nk: nameKey(buyer), mk: mailKey(mail), mail: mail, addr: addr, zip: zip, d: d, price: price && price > 0 ? price : null, type: ptype(g('type')), co: COMPANY.test(buyer) });
      }
    });
    st.cashRows = sales.length;
    // union-find: same cleaned name OR same mailing address
    var parent = sales.map(function (_, i) { return i; });
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function uni(a, b) { a = find(a); b = find(b); if (a !== b) parent[b] = a; }
    var byN = {}, byM = {}, why = {};
    sales.forEach(function (s, i) {
      if (s.nk) { if (byN[s.nk] != null) uni(byN[s.nk], i); else byN[s.nk] = i; }
      if (s.mk) { if (byM[s.mk] != null) { if (sales[byM[s.mk]].nk !== s.nk) why[s.mk] = 1; uni(byM[s.mk], i); } else byM[s.mk] = i; }
    });
    var groups = {};
    sales.forEach(function (s, i) { var k = find(i); (groups[k] = groups[k] || []).push(s); });
    var buyers = Object.keys(groups).map(function (k) {
      var g = groups[k].slice().sort(function (a, b) { return b.d - a.d; });
      var cnt = {}, ord = [];
      g.forEach(function (s) { if (!cnt[s.buyer]) { cnt[s.buyer] = 0; ord.push(s.buyer); } cnt[s.buyer]++; });
      var name = ord.slice().sort(function (a, b) { return cnt[b] - cnt[a] || ord.indexOf(a) - ord.indexOf(b); })[0];
      var nks = {}, mailCnt = {}; g.forEach(function (s) { nks[s.nk] = 1; if (s.mail) mailCnt[s.mail] = (mailCnt[s.mail] || 0) + 1; });
      var mail = g.filter(function (s) { return s.mail; }).map(function (s) { return s.mail; })[0] || '';
      var win = g.filter(function (s) { return s.d >= since && s.d <= asof; });
      var prices = win.map(function (s) { return s.price; }).filter(function (p) { return p != null; }).sort(function (a, b) { return a - b; });
      var zips = {}, types = {}; win.forEach(function (s) { if (s.zip) zips[s.zip] = (zips[s.zip] || 0) + 1; if (s.type) types[s.type] = (types[s.type] || 0) + 1; });
      var med = prices.length ? (prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2) : null;
      var reasons = [];
      if (ord.length > 1) {
        var byName = Object.keys(nks).length < ord.length, byMail = Object.keys(nks).length > 1;
        if (byName) reasons.push('same name once LLC, Inc, punctuation and word order are ignored');
        if (byMail) reasons.push('same mailing address');
      }
      return {
        id: nameKey(name) || name, keys: Object.keys(nks), name: name, aka: ord.filter(function (x) { return x !== name; }), spellings: ord.length, mail: mail, reasons: reasons,
        all: g.length, buys: win.length, last: g[0].d, lastIn: win.length ? win[0].d : null, min: prices[0] == null ? null : prices[0], max: prices.length ? prices[prices.length - 1] : null, med: med,
        zips: zips, types: types, co: g.some(function (s) { return s.co; }), sales: g, win: win
      };
    });
    buyers.forEach(function (b) { b.stale = b.buys === 0; });
    var pool = buyers.filter(function (b) { return cfg.who === 'companies' ? b.co : cfg.who === 'people' ? !b.co : true; });
    var active = pool.filter(function (b) { return b.buys > 0; }).sort(function (a, b) { return b.buys - a.buys || b.lastIn - a.lastIn || (b.med || 0) - (a.med || 0); });
    var stale = pool.filter(function (b) { return b.stale; }).sort(function (a, b) { return b.last - a.last; });
    active.forEach(function (b, i) { b.rank = i + 1; });
    var repeat = active.filter(function (b) { return b.buys >= minb; });
    st.cashWindow = active.reduce(function (s, b) { return s + b.buys; }, 0);
    var spellings = active.reduce(function (s, b) { return s + b.spellings; }, 0);
    // deal match
    var deal = { zip: String(cfg.dzip || '').trim().slice(0, 5), price: num(cfg.dprice), type: cfg.dtype || 'any', fee: num(cfg.fee), by: parseDate(cfg.assignby) };
    deal.days = deal.by != null ? Math.round((deal.by - asof) / 864e5) : null;
    var matches = [], near = [];
    if (deal.zip) {
      active.forEach(function (b) {
        var inZip = b.zips[deal.zip] || 0; if (!inZip) return;
        var typeOk = deal.type === 'any' || !Object.keys(b.types).length || !!b.types[deal.type];
        var priceOk = deal.price == null || b.min == null || (deal.price >= b.min * 0.8 && deal.price <= b.max * 1.2);
        var zp = b.win.filter(function (s) { return s.zip === deal.zip && s.price != null; }).map(function (s) { return s.price; });
        var m = { b: b, inZip: inZip, zipMin: zp.length ? Math.min.apply(null, zp) : null, zipMax: zp.length ? Math.max.apply(null, zp) : null, typeOk: typeOk, priceOk: priceOk };
        if (typeOk && priceOk) matches.push(m); else near.push(m);
      });
      var srt = function (a, b) { return b.inZip - a.inZip || b.b.buys - a.b.buys || b.b.lastIn - a.b.lastIn; };
      matches.sort(srt); near.sort(srt);
    }
    var fit = {}; matches.forEach(function (m) { fit[m.b.id] = 1; });
    return { cfg: cfg, asof: asof, since: since, months: months, minb: minb, cols: cols, colsList: colsList, cashKnown: cashKnown, st: st,
      buyers: active, stale: stale, repeat: repeat, spellings: spellings, deal: deal, matches: matches, near: near, fit: fit };
  }

  // ---- views ----
  function topZips(b, n) { return Object.keys(b.zips).sort(function (x, y) { return b.zips[y] - b.zips[x] || (x < y ? -1 : 1); }).slice(0, n || 4).map(function (z) { return z + (b.zips[z] > 1 ? ' ×' + b.zips[z] : ''); }); }
  function typesOf(b) { return Object.keys(b.types).sort(function (x, y) { return b.types[y] - b.types[x]; }).join(', '); }
  function box(b) { return b.min == null ? 'no price in file' : (b.min === b.max ? money(b.min) : money(b.min) + '–' + money(b.max)); }
  function dealLine(r) {
    var d = r.deal; if (!d.zip) return 'no deal entered';
    return d.zip + (d.price != null ? ' · ' + money(d.price) : '') + (d.type !== 'any' ? ' ' + d.type : '');
  }
  function tilesHtml(r) {
    var d = r.deal, t = '';
    t += '<div class="tile hot"><span>Repeat cash buyers found · ' + r.minb + '+ cash buys since ' + ymd(r.since) + '</span><b>' + r.repeat.length + '</b><i>of ' + r.buyers.length + ' cash buyers · ' + r.st.cashWindow + ' cash buys in ' + r.months + ' months</i></div>';
    t += '<div class="tile ' + (d.zip && !r.matches.length ? 'bad' : '') + '"><span>Buyers who fit your deal · ' + esc(dealLine(r)) + '</span><b>' + (d.zip ? r.matches.length + ' buyer' + (r.matches.length === 1 ? '' : 's') : '—') + '</b><i>' +
      (d.fee != null ? 'your ' + money(d.fee) + ' assignment fee' : 'bought cash in ' + esc(d.zip || 'your zip')) + (d.by != null ? ' · assign by ' + ymd(d.by) + (d.days != null ? ' (' + d.days + ' days)' : '') : '') + '</i></div>';
    t += '<div class="tile"><span>Name spellings merged into one buyer</span><b>' + r.spellings + ' → ' + r.buyers.length + '</b><i>' + (r.spellings - r.buyers.length) + ' duplicates you would skip-trace twice · ' + r.stale.length + ' stale buyer' + (r.stale.length === 1 ? '' : 's') + ' dropped</i></div>';
    return t;
  }
  function matchHtml(r) {
    var d = r.deal; if (!d.zip) return '<p class="small">Enter your deal\'s zip and price to see who bought there.</p>';
    if (!r.matches.length) return '<p class="bad"><b>No buyer in this file bought cash in ' + esc(d.zip) + ' in the last ' + r.months + ' months at a price near ' + money(d.price) + ' — Save and continue: https://getreadystack.com/apps/cash-buyers-list-finder/';
    var h = '<ol class="match">';
    r.matches.forEach(function (m) {
      var b = m.b;
      h += '<li><b>' + esc(b.name) + '</b> — ' + m.inZip + ' cash buy' + (m.inZip > 1 ? 's' : '') + ' in ' + esc(d.zip) + (m.zipMin != null ? ' (' + (m.zipMin === m.zipMax ? money(m.zipMin) : money(m.zipMin) + '–' + money(m.zipMax)) + ')' : '') + ', last ' + ymd(b.lastIn) + ' · ' + b.buys + ' in ' + r.months + ' months</li>';
    });
    h += '</ol>';
    if (r.near.length) h += '<p class="small">Bought in ' + esc(d.zip) + ' but outside your deal: ' + r.near.map(function (m) { return esc(m.b.name) + ' (' + (!m.priceOk ? 'buys ' + box(m.b) : 'buys ' + esc(typesOf(m.b))) + ')'; }).join(' · ') + '</p>';
    return h;
  }
  function noteFor(notes, b) { if (!notes) return null; if (notes[b.id]) return notes[b.id]; for (var i = 0; i < (b.keys || []).length; i++) if (notes[b.keys[i]]) return notes[b.keys[i]]; return null; }
  function rowsHtml(r, notes) {
    notes = notes || {};
    var h = '';
    r.buyers.forEach(function (b) {
      var n = noteFor(notes, b);
      h += '<tr class="' + (r.fit[b.id] ? 'fit' : '') + (b.buys >= r.minb ? '' : ' one') + '"><td class="nm">' + b.rank + '</td><td class="sc"><b>' + esc(b.name) + '</b>' + (r.fit[b.id] ? ' <em class="tag">fits your deal</em>' : '') +
        (b.aka.length ? '<small>also recorded as: ' + b.aka.map(esc).join(' · ') + '</small><small class="why">merged: ' + esc(b.reasons.join(' + ')) + '</small>' : '') +
        (n && n.status ? '<small class="st">' + esc(n.status) + (n.note ? ' — ' + esc(n.note) : '') + '</small>' : '') + '</td>' +
        '<td class="nm"><b>' + b.buys + '</b><small>last ' + ymd(b.lastIn) + '</small></td><td class="nm">' + box(b) + (b.med != null && b.buys > 2 ? '<small>median ' + money(b.med) + '</small>' : '') + '</td>' +
        '<td>' + esc(topZips(b).join(', ')) + '<small>' + esc(typesOf(b)) + '</small></td><td class="ml">' + esc(b.mail || '—') + '</td></tr>';
    });
    return h || '<tr><td colspan="6">No cash purchase found in this window. Check the date column and the window.</td></tr>';
  }
  function notesHtml(r) {
    var s = r.st, out = [];
    out.push(s.rows + ' rows read' + (s.files > 1 ? ' from ' + s.files + ' files' : ''));
    out.push(s.cashRows + ' cash sales');
    if (s.financed) out.push(s.financed + ' with a loan skipped');
    if (s.institutions) out.push(s.institutions + ' bank/agency deeds skipped');
    if (s.nominal) out.push(s.nominal + ' nominal transfer' + (s.nominal > 1 ? 's' : '') + ' under $1,000 skipped');
    if (s.dupRows) out.push(s.dupRows + ' repeated rows skipped');
    var un = s.noDate + s.noBuyer;
    out.push('unmeasured ' + un + (un ? ' (' + (s.noDate ? s.noDate + ' without a date' : '') + (s.noDate && s.noBuyer ? ', ' : '') + (s.noBuyer ? s.noBuyer + ' without a buyer' : '') + ')' : ''));
    if (s.noPrice) out.push(s.noPrice + ' cash sales without a price (counted, no price box)');
    var warn = r.cashKnown ? '' : '<b class="bad">No loan, lender or financing column found — every sale is counted, cash is not verified.</b> ';
    return warn + out.join(' · ');
  }
  function staleHtml(r) {
    if (!r.stale.length) return '';
    return 'Stale, no cash buy since ' + ymd(r.since) + ': ' + r.stale.map(function (b) { return esc(b.name) + ' (' + b.all + ' buy' + (b.all > 1 ? 's' : '') + ', last ' + ymd(b.last) + ')'; }).join(' · ');
  }
  function colsHtml(r) {
    if (!r.cols) return 'No header row found.';
    var c = r.cols, h = r.colsList[0].head, nm = function (k) { return c[k] == null ? '<i>none</i>' : '“' + esc(flat(h[c[k]])) + '”'; };
    return 'Columns used: buyer ' + nm('buyer') + ' · date ' + nm('date') + ' · price ' + nm('price') + ' · loan ' + nm('loan') + (c.lender != null ? ' · lender ' + nm('lender') : '') + (c.fin != null ? ' · financing ' + nm('fin') : '') + ' · mailing ' + nm('mail') + ' · zip ' + nm('zip') + ' · type ' + nm('type');
  }
  function summary(r) {
    var top = r.buyers.slice(0, 3).map(function (b) { return b.name + ' ' + b.buys + ' cash buys (' + box(b) + ')'; }).join('; ');
    var d = r.deal;
    return 'Cash buyers list, ' + ymd(r.since) + ' to ' + ymd(r.asof) + ': ' + r.repeat.length + ' repeat cash buyers (' + r.minb + '+ buys) of ' + r.buyers.length + ' · ' + r.st.cashWindow + ' cash buys · ' + r.spellings + ' name spellings merged into ' + r.buyers.length + ' buyers. Top: ' + top + '.' +
      (d.zip ? ' Deal ' + dealLine(r) + ': ' + r.matches.length + ' buyers fit' + (r.matches.length ? ' (' + r.matches.map(function (m) { return m.b.name; }).join(', ') + ')' : '') + '.' : '');
  }

  // ---- Pro outputs ----
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV(r, notes) {
    notes = notes || {};
    var L = [['rank', 'buyer', 'also_recorded_as', 'mailing_address', 'cash_buys_' + r.months + 'm', 'last_cash_buy', 'min_price', 'max_price', 'median_price', 'zips', 'property_types', 'company', 'fits_deal', 'status', 'note', 'last_contact']];
    r.buyers.forEach(function (b) {
      var n = noteFor(notes, b) || {};
      L.push([b.rank, b.name, b.aka.join(' | '), b.mail, b.buys, ymd(b.lastIn), b.min, b.max, b.med, topZips(b, 9).join(' '), typesOf(b), b.co ? 'yes' : 'no', r.fit[b.id] ? 'yes' : 'no', n.status || '', n.note || '', n.contact || '']);
    });
    return L.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }
  function blastCSV(r) {
    var L = [['buyer', 'mailing_address', 'cash_buys_in_zip', 'their_price_in_zip', 'last_cash_buy', 'deal_zip', 'deal_price', 'deal_type', 'assign_by']];
    r.matches.forEach(function (m) {
      L.push([m.b.name, m.b.mail, m.inZip, m.zipMin == null ? '' : (m.zipMin === m.zipMax ? m.zipMin : m.zipMin + '-' + m.zipMax), ymd(m.b.lastIn), r.deal.zip, r.deal.price, r.deal.type, ymd(r.deal.by)]);
    });
    return L.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); }
  function ics(deals, stamp) {
    stamp = stamp || '20261118T000000Z';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//cash buyers list//deals//EN', 'CALSCALE:GREGORIAN'];
    (deals || []).forEach(function (d, i) {
      var t = parseDate(d.assignby); if (t == null) return;
      var day = ymd(t).replace(/-/g, ''), next = ymd(t + 864e5).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:cbl-' + day + '-' + i + '-' + String(d.dzip || '') + '@cash-buyers-list', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + day, 'DTEND;VALUE=DATE:' + next,
        'SUMMARY:' + icsEsc('Assign-by date: ' + (d.label || d.dzip) + (d.fee ? ' · fee ' + money(num(d.fee)) : '')),
        'DESCRIPTION:' + icsEsc('Deal ' + (d.dzip || '') + ' ' + (d.dprice ? money(num(d.dprice)) : '') + ' · ' + (d.matched != null ? d.matched + ' buyers fit when saved' : '') + (d.names ? ': ' + d.names : '')));
      [7, 2].forEach(function (k) { L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc('Assign-by in ' + k + ' days: ' + (d.label || d.dzip)), 'TRIGGER:-P' + k + 'D', 'END:VALARM'); });
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  var API = { DEFAULTS: DEFAULTS, SAMPLE: SAMPLE, esc: esc, money: money, num: num, ymd: ymd, parseDate: parseDate, parseCSV: parseCSV, detect: detect, nameKey: nameKey, mailKey: mailKey, ptype: ptype,
    analyze: analyze, tilesHtml: tilesHtml, matchHtml: matchHtml, rowsHtml: rowsHtml, notesHtml: notesHtml, staleHtml: staleHtml, colsHtml: colsHtml, summary: summary,
    exportCSV: exportCSV, noteFor: noteFor, blastCSV: blastCSV, ics: ics, box: box, topZips: topZips, typesOf: typesOf };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.CBL = API;
})(this);
