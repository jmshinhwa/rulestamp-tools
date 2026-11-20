/* シフト作成 engine — 労基法34条 休憩・37条 深夜/時間外・61条/60条 18歳未満・地域別最低賃金（発効日で切替）・人件費
   facts: e-Gov 労働基準法 (rev. 322AC0000000049_20260717) · 最低賃金法40条 · MHLW 地域別最低賃金 全国一覧 令和8年度 (read 2026-11-20) */
(function (root) {
  'use strict';
  // [都道府県, 令和8年度の時間額, 発効日, 令和7年度の時間額]
  var PREFS = [
    ["北海道",1131,"2026-10-01",1075],
    ["青森県",1090,"2026-10-29",1029],
    ["岩手県",1090,"2026-12-01",1031],
    ["宮城県",1098,"2026-10-01",1038],
    ["秋田県",1090,"2026-10-14",1031],
    ["山形県",1092,"2026-10-30",1032],
    ["福島県",1094,"2026-10-16",1033],
    ["茨城県",1136,"2026-10-18",1074],
    ["栃木県",1125,"2026-10-01",1068],
    ["群馬県",1120,"2026-10-03",1063],
    ["埼玉県",1196,"2026-10-01",1141],
    ["千葉県",1195,"2026-10-01",1140],
    ["東京都",1280,"2026-10-01",1226],
    ["神奈川県",1279,"2026-10-01",1225],
    ["新潟県",1108,"2026-10-01",1050],
    ["富山県",1119,"2026-10-01",1062],
    ["石川県",1113,"2026-10-03",1054],
    ["福井県",1112,"2026-10-04",1053],
    ["山梨県",1113,"2026-11-01",1052],
    ["長野県",1117,"2026-10-02",1061],
    ["岐阜県",1121,"2026-10-01",1065],
    ["静岡県",1154,"2026-10-15",1097],
    ["愛知県",1195,"2026-10-01",1140],
    ["三重県",1143,"2026-10-01",1087],
    ["滋賀県",1136,"2026-10-03",1080],
    ["京都府",1180,"2026-11-16",1122],
    ["大阪府",1231,"2026-10-01",1177],
    ["兵庫県",1172,"2026-10-01",1116],
    ["奈良県",1107,"2026-10-04",1051],
    ["和歌山県",1101,"2026-10-03",1045],
    ["鳥取県",1090,"2026-10-03",1030],
    ["島根県",1092,"2026-10-10",1033],
    ["岡山県",1104,"2026-10-02",1047],
    ["広島県",1141,"2026-10-11",1085],
    ["山口県",1101,"2026-10-08",1043],
    ["徳島県",1103,"2026-11-01",1046],
    ["香川県",1092,"2026-10-01",1036],
    ["愛媛県",1093,"2026-11-01",1033],
    ["高知県",1086,"2026-10-29",1023],
    ["福岡県",1114,"2026-10-04",1057],
    ["佐賀県",1095,"2026-11-15",1030],
    ["長崎県",1087,"2026-11-02",1031],
    ["熊本県",1092,"2026-12-01",1034],
    ["大分県",1096,"2026-11-01",1035],
    ["宮崎県",1085,"2026-10-24",1023],
    ["鹿児島県",1090,"2026-10-25",1026],
    ["沖縄県",1086,"2026-12-02",1023]
  ];
  var MW_SRC = '厚生労働省「地域別最低賃金の全国一覧」令和8年度（2026-11-20 確認）';
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  var NIGHT_A = 22 * 60, NIGHT_B = 29 * 60;          // 22:00〜翌5:00

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(x) { var n = parseFloat(String(x == null ? '' : x).replace(/[,，円¥\s]/g, '').replace(/[０-９．]/g, function (c) { return c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })); return isFinite(n) ? n : NaN; }
  function yen(n) { n = Math.round(n || 0); return (n < 0 ? '−' : '') + '¥' + Math.abs(n).toLocaleString('en-US'); }
  function hm(min) { min = Math.round(min || 0); var h = Math.floor(min / 60), m = min % 60; return !h ? m + '分' : m ? h + '時間' + m + '分' : h + '時間'; }
  function hdec(min) { return (Math.round(min / 60 * 100) / 100).toLocaleString('en-US'); }
  function clock(min) { var d = Math.floor(min / 1440), t = min - d * 1440; var s = Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); return d > 0 ? '翌' + s : s; }

  function norm(s) {
    return String(s == null ? '' : s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[〜～~ー－–—―‐]/g, '-').replace(/翌/g, '').replace(/：/g, ':').replace(/／/g, '/').replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, ' ').trim();
  }
  var OFF = /^(|-|休|休み|公休|有休|×|x|off)$/i;
  var RX = /^(\d{1,2})(?:(?::|時)(\d{1,2})?分?)?\s*-\s*(\d{1,2})(?:(?::|時)(\d{1,2})?分?)?\s*(?:(?:\/|\(|\s)\s*(?:休憩?)?\s*(\d{1,3})\s*分?\)?)?$/;
  function parseCell(s) {
    var t = norm(s);
    if (OFF.test(t)) return { off: true };
    var m = RX.exec(t);
    if (!m) return { err: '「' + String(s).trim() + '」は読めません（例：9-18/60、17:30-22:00、22-5）' };
    var h1 = +m[1], m1 = +(m[2] || 0), h2 = +m[3], m2 = +(m[4] || 0), brk = +(m[5] || 0);
    if (h1 > 30 || h2 > 30 || m1 > 59 || m2 > 59) return { err: '「' + String(s).trim() + '」の時刻が範囲外です' };
    var a = h1 * 60 + m1, b = h2 * 60 + m2;
    if (b <= a) b += 1440;
    if (b - a > 1440) return { err: '「' + String(s).trim() + '」は24時間を超えています' };
    if (brk >= b - a) return { err: '「' + String(s).trim() + '」は休憩が勤務より長い' };
    return { start: a, end: b, brk: brk };
  }
  function nightSpan(a, b) {
    var t = 0;
    for (var k = -1; k <= 1; k++) { var x = Math.max(a, NIGHT_A + 1440 * k), y = Math.min(b, NIGHT_B + 1440 * k); if (y > x) t += y - x; }
    return t;
  }
  function breakNeed(labor) { return labor > 480 ? 60 : labor > 360 ? 45 : 0; }

  function prefRow(p) { for (var i = 0; i < PREFS.length; i++) if (PREFS[i][0] === p) return PREFS[i]; return PREFS[12]; }
  function minWage(pref, date) {
    var r = prefRow(pref), isNew = String(date) >= r[2];
    return { pref: r[0], yen: isNew ? r[1] : r[3], isNew: isNew, eff: r[2], newYen: r[1], prev: r[3] };
  }
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dow(iso) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
  function validDate(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(new Date(iso + 'T00:00:00Z').getTime()); }
  function monthDays(iso) { var d = new Date(iso.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.getUTCDate(); }

  var KIND = { brk: '休憩不足', minor_night: '18歳未満の深夜', minor_ot: '18歳未満の時間外', minwage: '最低賃金割れ', rest: '7日連続勤務', bad: '読めない入力' };

  function analyse(inp) {
    var start = validDate(String(inp.start || '')) ? String(inp.start) : '2026-11-22';
    var nd = Math.max(1, Math.min(31, parseInt(inp.days, 10) || 7));
    var ws = (+inp.weekStart === 1) ? 1 : 0;
    var dates = [], i;
    for (i = 0; i < nd; i++) dates.push(addDays(start, i));
    var pref = prefRow(inp.pref || '東京都')[0];
    var out = { pref: pref, start: start, days: nd, dates: dates, wd: dates.map(function (d) { return WD[dow(d)]; }), weekStart: ws,
      staff: [], issues: [], counts: {}, day: dates.map(function () { return { labor: 0, heads: 0, cost: 0 }; }),
      mw: dates.map(function (d) { return minWage(pref, d); }) };
    Object.keys(KIND).forEach(function (k) { out.counts[k] = 0; });
    var T = { labor: 0, night: 0, ot: 0, ot60: 0, base: 0, pNight: 0, pOt: 0, cost: 0, short: 0, shifts: 0 };
    (inp.staff || []).forEach(function (st, si) {
      var name = String(st.name || '').trim() || ('スタッフ' + (si + 1)), wage = num(st.wage), minor = !!st.minor;
      var cells = st.cells || [];
      var hasAny = cells.some(function (c) { return !OFF.test(norm(c)); });
      if (!name && !hasAny) return;
      var S = { name: name, wage: isFinite(wage) ? wage : 0, minor: minor, cells: [], labor: 0, night: 0, ot: 0, ot60: 0, base: 0, pNight: 0, pOt: 0, cost: 0, short: 0, shifts: 0, issues: 0 };
      var wk = {}, otCum = 0;
      function issue(di, kind, msg) { out.issues.push({ staff: name, date: dates[di], wd: out.wd[di], kind: kind, msg: msg }); out.counts[kind]++; S.issues++; if (S.cells[di]) S.cells[di].flags.push(kind); }
      for (var di = 0; di < nd; di++) {
        var raw = cells[di] == null ? '' : String(cells[di]), p = parseCell(raw);
        var C = { raw: raw.trim(), off: !!p.off, flags: [] };
        S.cells.push(C);
        var key = addDays(dates[di], -((dow(dates[di]) - ws + 7) % 7));
        var W = wk[key] || (wk[key] = { cum: 0, worked: 0, seen: 0, first: di }); W.seen++;
        if (p.err) { C.bad = true; issue(di, 'bad', p.err); continue; }
        if (p.off) continue;
        var span = p.end - p.start, labor = span - p.brk, ns = nightSpan(p.start, p.end);
        var night = Math.max(0, ns - Math.max(0, p.brk - (span - ns)));
        var need = breakNeed(labor), dOt = Math.max(0, labor - 480);
        var before = W.cum; W.cum += labor - dOt; W.worked++;
        var wOt = Math.max(0, W.cum - 2400) - Math.max(0, before - 2400);
        var ot = dOt + wOt, ot60 = Math.max(0, otCum + ot - 3600) - Math.max(0, otCum - 3600); otCum += ot;
        var mw = out.mw[di];
        C.start = p.start; C.end = p.end; C.brk = p.brk; C.labor = labor; C.night = night; C.ot = ot; C.ot60 = ot60; C.mw = mw.yen;
        C.label = clock(p.start) + '-' + clock(p.end) + (p.brk ? ' 休' + p.brk : '');
        if (p.brk < need) issue(di, 'brk', '実働' + hm(labor) + 'に休憩' + p.brk + '分。' + need + '分以上が必要（労基法34条）');
        if (minor && night > 0) issue(di, 'minor_night', '18歳未満が22時〜5時に' + hm(night) + '働く予定（労基法61条）');
        if (minor && ot > 0) issue(di, 'minor_ot', '18歳未満に時間外' + hm(ot) + '（1日8時間・週40時間を超える。36協定でも延長できない・労基法60条）');
        var base = S.wage * labor / 60, pN = S.wage * 0.25 * night / 60, pO = S.wage * 0.25 * (ot + ot60) / 60;
        var sh = 0;
        if (S.wage < mw.yen) {
          sh = (mw.yen - S.wage) * (labor + 0.25 * (night + ot + ot60)) / 60;
          issue(di, 'minwage', '時給' + yen(S.wage) + 'は' + pref + 'の最低賃金' + yen(mw.yen) + '（' + (mw.isNew ? mw.eff + 'から' : mw.eff + 'の前日まで') + '）より' + yen(mw.yen - S.wage) + '低い。この日の不足' + yen(sh));
        }
        S.labor += labor; S.night += night; S.ot += ot; S.ot60 += ot60; S.base += base; S.pNight += pN; S.pOt += pO; S.short += sh; S.shifts++;
        out.day[di].labor += labor; out.day[di].heads++; out.day[di].cost += base + pN + pO + sh;
      }
      Object.keys(wk).forEach(function (k) {
        var W = wk[k];
        if (W.seen === 7 && W.worked === 7) issue(W.first + 6, 'rest', name + 'が' + k + 'からの7日間すべて出勤（毎週1日の休日・労基法35条。4週4日の定めがあれば別）');
      });
      S.base = Math.round(S.base); S.pNight = Math.round(S.pNight); S.pOt = Math.round(S.pOt); S.short = Math.round(S.short);
      S.cost = S.base + S.pNight + S.pOt;
      ['labor', 'night', 'ot', 'ot60', 'base', 'pNight', 'pOt', 'cost', 'short', 'shifts'].forEach(function (k) { T[k] += S[k]; });
      out.staff.push(S);
    });
    T.legal = T.cost + T.short;
    T.premium = T.pNight + T.pOt;
    var sales = num(inp.sales);
    T.sales = isFinite(sales) && sales > 0 ? sales : 0;
    T.ratio = T.sales ? T.legal / T.sales * 100 : null;
    T.violations = out.counts.brk + out.counts.minor_night + out.counts.minor_ot + out.counts.minwage;
    out.T = T;
    var nw = out.mw.filter(function (m) { return !m.isNew; }).length;
    out.mwNote = nw && nw < nd ? pref + 'の最低賃金は' + out.mw[0].eff.replace(/-/g, '/') + 'に' + yen(out.mw[0].prev) + '→' + yen(out.mw[0].newYen) + 'へ変わります（この表の途中で切り替え）'
      : nw ? pref + 'の最低賃金はこの表の期間は' + yen(out.mw[0].prev) + '、' + out.mw[0].eff + 'から' + yen(out.mw[0].newYen)
      : pref + 'の最低賃金 ' + yen(out.mw[0].yen) + '（' + out.mw[0].eff + '発効）';
    return out;
  }

  function tilesHtml(R) {
    var T = R.T, c = R.counts;
    var parts = [];
    if (c.brk) parts.push('休憩不足' + c.brk);
    if (c.minor_night) parts.push('18歳未満の深夜' + c.minor_night);
    if (c.minor_ot) parts.push('18歳未満の時間外' + c.minor_ot);
    if (c.minwage) parts.push('最低賃金割れ' + c.minwage);
    var t = [
      ['労基法・最低賃金の違反', T.violations ? T.violations + '件（' + parts.join('・') + '）' : '0件', T.violations ? 'bad' : 'good'],
      ['最低賃金に足りない額', T.short ? yen(T.short) : '¥0', T.short ? 'bad' : 'good'],
      ['人件費（' + R.days + '日・割増込み）', yen(T.legal), ''],
      ['深夜・時間外の割増', yen(T.premium) + '（深夜' + yen(T.pNight) + '・時間外' + yen(T.pOt) + '）', T.premium ? 'warn' : ''],
      ['総労働時間', hdec(T.labor) + '時間（' + T.shifts + 'シフト）', ''],
      ['人件費率', T.ratio == null ? '売上見込みを入れると出ます' : (Math.round(T.ratio * 10) / 10) + '%（売上' + yen(T.sales) + '）', '']
    ];
    return t.map(function (x) { return '<div class="tile ' + x[2] + '"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('');
  }
  function issuesHtml(R) {
    var list = R.issues.filter(function (x) { return x.kind !== 'bad'; }).concat(R.issues.filter(function (x) { return x.kind === 'bad'; }));
    if (!list.length) return '<li class="ok">この表では、休憩・深夜・18歳未満・最低賃金の違反は見つかりませんでした。</li>';
    return list.map(function (x) { return '<li class="k-' + x.kind + '"><b>' + esc(x.date.slice(5).replace('-', '/') + '（' + x.wd + '）' + x.staff) + '</b> ' + esc(KIND[x.kind]) + '：' + esc(x.msg) + '</li>'; }).join('');
  }
  function tableHtml(R) {
    var h = '<thead><tr><th>スタッフ</th>' + R.dates.map(function (d, i) { return '<th class="d' + dow(d) + '">' + (+d.slice(8)) + '<br>' + R.wd[i] + '</th>'; }).join('') + '<th>実働</th><th>給与（割増込み）</th></tr></thead><tbody>';
    R.staff.forEach(function (S) {
      h += '<tr><th>' + esc(S.name) + (S.minor ? '<small>18歳未満</small>' : '') + '<small>' + yen(S.wage) + '</small></th>';
      S.cells.forEach(function (C) {
        var cls = C.flags.length ? ' class="flag"' : C.off ? ' class="off"' : '';
        h += '<td' + cls + ' title="' + esc(C.flags.map(function (f) { return KIND[f]; }).join('・')) + '">' + (C.off ? '' : esc(C.bad ? C.raw : C.label).replace(' 休', '<br>休')) + '</td>';
      });
      h += '<td>' + hdec(S.labor) + 'h</td><td>' + yen(S.cost + S.short) + (S.short ? '<small>不足' + yen(S.short) + '込み</small>' : '') + '</td></tr>';
    });
    h += '<tr class="sum"><th>出勤 / 人件費</th>' + R.day.map(function (d) { return '<td>' + d.heads + '人<br>' + yen(d.cost) + '</td>'; }).join('') + '<td>' + hdec(R.T.labor) + 'h</td><td>' + yen(R.T.legal) + '</td></tr>';
    return h + '</tbody>';
  }
  function staffHtml(R) {
    return R.staff.map(function (S) {
      return '<tr><td>' + esc(S.name) + '</td><td>' + yen(S.wage) + '</td><td>' + hdec(S.labor) + '</td><td>' + hdec(S.night) + '</td><td>' + hdec(S.ot) + '</td><td>' + yen(S.base) + '</td><td>' + yen(S.pNight) + '</td><td>' + yen(S.pOt) + '</td><td>' + (S.short ? yen(S.short) : '-') + '</td><td><b>' + yen(S.cost + S.short) + '</b></td></tr>';
    }).join('');
  }
  function summary(R) {
    var T = R.T, s = R.pref + '・' + R.dates[0] + 'から' + R.days + '日のシフト：' + R.staff.length + '人・' + hdec(T.labor) + '時間。';
    s += '労基法・最低賃金の違反は' + T.violations + '件';
    if (T.violations) s += '（休憩不足' + R.counts.brk + '・18歳未満の深夜' + R.counts.minor_night + '・18歳未満の時間外' + R.counts.minor_ot + '・最低賃金割れ' + R.counts.minwage + '）';
    s += '。人件費は割増込みで' + yen(T.legal) + '（深夜割増' + yen(T.pNight) + '・時間外割増' + yen(T.pOt) + (T.short ? '・最低賃金の不足' + yen(T.short) : '') + '）';
    if (T.ratio != null) s += '、人件費率' + (Math.round(T.ratio * 10) / 10) + '%';
    return s + '。';
  }
  function csv(R) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var L = [['スタッフ', '時給', '18歳未満'].concat(R.dates.map(function (d, i) { return d + '(' + R.wd[i] + ')'; })).concat(['実働時間', '深夜時間', '時間外時間', '基本給', '深夜割増', '時間外割増', '最低賃金不足', '合計']).map(q).join(',')];
    R.staff.forEach(function (S) {
      L.push([S.name, S.wage, S.minor ? '1' : ''].concat(S.cells.map(function (C) { return C.off ? '' : (C.bad ? C.raw : C.label); }))
        .concat([hdec(S.labor), hdec(S.night), hdec(S.ot), S.base, S.pNight, S.pOt, S.short, S.cost + S.short]).map(q).join(','));
    });
    L.push(['合計', '', ''].concat(R.day.map(function (d) { return Math.round(d.cost); })).concat([hdec(R.T.labor), hdec(R.T.night), hdec(R.T.ot), R.T.base, R.T.pNight, R.T.pOt, R.T.short, R.T.legal]).map(q).join(','));
    return '﻿' + L.join('\r\n') + '\r\n';
  }
  function csvToStaff(text, nd) {
    var rows = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    var out = [];
    rows.forEach(function (l, i) {
      var c = [], cur = '', q = false;
      for (var k = 0; k < l.length; k++) { var ch = l[k]; if (q) { if (ch === '"' && l[k + 1] === '"') { cur += '"'; k++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',' || ch === '\t') { c.push(cur); cur = ''; } else cur += ch; }
      c.push(cur);
      if (i === 0 && /スタッフ|名前|name/i.test(c[0])) return;
      if (/^合計$/.test(c[0])) return;
      out.push({ name: c[0], wage: c[1], minor: /^(1|true|はい|○|〇|18歳未満)$/i.test(String(c[2] || '').trim()), cells: c.slice(3, 3 + nd).map(function (x) { return x.replace(/<br>/g, ' '); }) });
    });
    return out;
  }
  var DEFAULTS = {
    pref: '東京都', start: '2026-11-22', sales: '1,150,000', weekStart: 0, days: 7,
    staff: [
      { name: '佐藤（店長代理）', wage: '1,450', minor: false, cells: ['', '9-18/45', '9-18/45', '9-18/45', '9-18/45', '9-18/45', ''] },
      { name: '田中', wage: '1,300', minor: false, cells: ['10-16', '', '17-23/30', '17-23/30', '', '17-23:30/30', '10-17/45'] },
      { name: '鈴木（高校生）', wage: '1,280', minor: true, cells: ['', '17-22', '', '17-22:30', '', '17-22', '12-18'] },
      { name: '高橋', wage: '1,250', minor: false, cells: ['9-15:30', '', '9-15:30', '', '9-15:30', '', '9-15:30'] },
      { name: '伊藤', wage: '1,350', minor: false, cells: ['17-24/45', '', '', '17-24/45', '', '18-26/60', '17-24/45'] },
      { name: '渡辺', wage: '1,300', minor: false, cells: ['10-19/60', '10-19/60', '', '10-19/60', '10-19/60', '10-19/60', '10-19/60'] }
    ]
  };
  var API = { PREFS: PREFS, MW_SRC: MW_SRC, WD: WD, KIND: KIND, DEFAULTS: DEFAULTS, parseCell: parseCell, nightSpan: nightSpan, breakNeed: breakNeed, minWage: minWage,
    analyse: analyse, tilesHtml: tilesHtml, issuesHtml: issuesHtml, tableHtml: tableHtml, staffHtml: staffHtml, summary: summary, csv: csv, csvToStaff: csvToStaff,
    yen: yen, hm: hm, hdec: hdec, esc: esc, addDays: addDays, dow: dow, monthDays: monthDays, validDate: validDate, num: num };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.SHIFT = API;
})(typeof window !== 'undefined' ? window : null);
