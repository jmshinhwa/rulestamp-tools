// engine.js — "video compressor" size planner, retry rule, CSV and a store-mode ZIP writer.
// Pure functions (no DOM): node test/engine_test.js runs them. Nothing here touches the network.
(function (g) {
  'use strict';
  var MB = 1000 * 1000;              // the limits we show (Gmail 25 MB, Discord 20 MB) are decimal megabytes, so are ours
  var LADDER = [2160, 1440, 1080, 720, 540, 480, 360, 240];   // short side of the frame (portrait or landscape)
  var BPP = 0.05;                    // bits per pixel per frame below which H.264 starts to smear; we step the size down instead
  var OVERHEAD = 0.97;               // 3 % of the target kept for the MP4 index and encoder overshoot
  var FIXED = 4096;                  // bytes of MP4 header we always budget

  function even(n) { n = Math.round(n); return n % 2 ? n - 1 : n; }

  // o: {targetBytes, duration (s), width, height, fps, hasAudio, keepAudio, srcBytes}
  function plan(o) {
    var dur = Math.max(Number(o.duration) || 0, 0.1);
    var target = Math.floor(Number(o.targetBytes) || 0);
    var res = { targetBytes: target, duration: dur, srcBytes: o.srcBytes || 0, alreadyUnder: !!(o.srcBytes && o.srcBytes <= target) };
    var bits = (target * OVERHEAD - FIXED) * 8;
    var totalBps = bits / dur;
    var aK = 0;
    if (o.hasAudio && o.keepAudio !== false) {
      aK = totalBps >= 1.5e6 ? 128 : totalBps >= 6e5 ? 96 : totalBps >= 2.5e5 ? 64 : totalBps >= 1.2e5 ? 48 : 32;
    }
    // the source sound is already AAC and small enough: copy it untouched (plays everywhere, exact size known)
    var ck = Number(o.copyAudioKbps) || 0;
    res.audioCopy = false;
    if (aK && ck > 0 && ck <= aK * 1.35) { aK = Math.ceil(ck); res.audioCopy = true; }
    var vbps = Math.floor(totalBps - aK * 1000);
    res.audioKbps = aK;
    res.videoBps = vbps;
    if (!(vbps >= 60000)) {        // under 60 kbps even 240p turns to mush: say so, never fake it
      res.ok = false; res.reason = 'too_small';
      res.minBytes = Math.ceil(((60000 + aK * 1000) * dur / 8 + FIXED) / OVERHEAD);
      return res;
    }
    var w = Number(o.width) || 1280, h = Number(o.height) || 720;
    var srcFps = Number(o.fps) || 30;
    var fps = srcFps > 30.5 && vbps < 6e6 ? 30 : srcFps;
    var shortSide = Math.min(w, h), longSide = Math.max(w, h), aspect = longSide / shortSide;
    var pick = 0;
    for (var i = 0; i < LADDER.length; i++) {
      var s = LADDER[i];
      if (s > shortSide) continue;
      if (vbps / (s * s * aspect * fps) >= BPP) { pick = s; break; }
    }
    if (!pick) pick = Math.min(shortSide, LADDER[LADDER.length - 1]);
    var outShort = even(pick), outLong = even(pick * aspect);
    res.keepSize = pick >= shortSide;
    if (res.keepSize) { outShort = even(shortSide); outLong = even(longSide); }
    res.width = w >= h ? outLong : outShort;
    res.height = w >= h ? outShort : outLong;
    res.fps = Math.round(fps * 100) / 100;
    res.fpsCapped = fps !== srcFps;
    res.predictedBytes = Math.round((vbps + aK * 1000) * dur / 8 + FIXED);
    res.ok = true;
    return res;
  }

  // after a pass came out at actualBytes: next video bitrate, or null when no further pass is needed
  function retry(p, actualBytes) {
    if (actualBytes <= p.targetBytes) return null;
    var audioBytes = p.audioKbps * 1000 * p.duration / 8;
    var room = p.targetBytes * OVERHEAD - FIXED - audioBytes;
    var spent = Math.max(actualBytes - audioBytes - FIXED, 1);
    var v = Math.floor(p.videoBps * (room / spent) * 0.97);
    return v >= 40000 ? v : null;
  }

  // the encoder did not follow the bitrate (ratio = bytes it wrote ÷ bytes we asked for > 1.25): shrink the frame instead,
  // area roughly ÷ ratio, snapped down to the ladder; null when it is already at the smallest step
  function shrink(p, ratio) {
    var shortSide = Math.min(p.width, p.height), longSide = Math.max(p.width, p.height), aspect = longSide / shortSide;
    var want = shortSide * Math.sqrt(1 / Math.max(ratio, 1.01)) * 0.9, pick = 0;
    for (var i = 0; i < LADDER.length; i++) if (LADDER[i] <= want && LADDER[i] < shortSide) { pick = LADDER[i]; break; }
    if (!pick) pick = LADDER[LADDER.length - 1];
    if (pick >= shortSide) return null;
    var s = even(pick), l = even(pick * aspect);
    return p.width >= p.height ? { width: l, height: s } : { width: s, height: l };
  }

  // Pro "fill the limit": a pass that came out far below the target may spend the unused room on quality
  function fill(p, actualBytes) {
    if (actualBytes >= p.targetBytes * 0.85) return null;
    var f = Math.min((p.targetBytes * 0.93) / actualBytes, 2.5);
    return Math.floor(p.videoBps * f);
  }

  function fmtMB(bytes, lang) {
    var v = bytes / MB;
    var d = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    var s = v.toFixed(d);
    if (lang && lang !== 'en' && lang !== 'ja') s = s.replace('.', ',');
    return s + ' MB';
  }

  function pctSmaller(from, to) { return from > 0 ? Math.round((1 - to / from) * 100) : 0; }

  function csv(rows) {
    var head = ['date_utc', 'file', 'original_bytes', 'target_bytes', 'result_bytes', 'width', 'height', 'passes', 'under_target'];
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [head.join(',')].concat(rows.map(function (r) {
      return [r.at, r.name, r.from, r.target, r.to, r.w, r.h, r.passes, r.to <= r.target ? 'yes' : 'no'].map(q).join(',');
    })).join('\n') + '\n';
  }

  var CRC_T = null;
  function crc32(u8) {
    if (!CRC_T) { CRC_T = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) crc = CRC_T[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // files: [{name, data: Uint8Array}] → array of Uint8Array parts of a store-mode (no deflate: MP4 is already compressed) ZIP
  function zipParts(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    var seen = {};
    files.forEach(function (f) {
      var nm = f.name, i = 2;
      while (seen[nm]) nm = f.name.replace(/(\.[^.]+)?$/, function (x) { return ' (' + (i++) + ')' + (x || ''); });
      seen[nm] = 1;
      var name = enc.encode(nm), data = f.data, crc = crc32(data), size = data.length;
      if (size >= 0xFFFFFFFF || off >= 0xFFFFFFFF) throw new Error('zip_4gb');
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + size;
    });
    var cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return parts.concat(central, [new Uint8Array(end.buffer)]);
  }

  g.VCE = { MB: MB, plan: plan, retry: retry, shrink: shrink, fill: fill, fmtMB: fmtMB, pctSmaller: pctSmaller, csv: csv, crc32: crc32, zipParts: zipParts, LADDER: LADDER };
  if (typeof module !== 'undefined') module.exports = g.VCE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
