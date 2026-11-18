// app.js — "video compressor": pick a limit → see the size before → compress on this device → always under the limit.
// Nothing is uploaded: the file is read with BlobSource, encoded with WebCodecs (mediabunny, MPL-2.0) and saved from memory.
import * as M from './lib/mediabunny.min.js';

const E = globalThis.VCE, LIC = globalThis.VCLIC;
const LANG = (document.documentElement.lang || 'en').slice(0, 2);
const D = (globalThis.VCI18N && (globalThis.VCI18N[LANG] || globalThis.VCI18N.en)) || {};
const T = (k, v) => String(D[k] || (globalThis.VCI18N && globalThis.VCI18N.en[k]) || k).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? v[n] : ''));
const $ = (id) => document.getElementById(id);
const MBs = (b) => E.fmtMB(b, LANG);

// destination limits — re-read from each official help page on the date shown (rule: dated facts)
const DEST = [
  { id: 'gmail', name: 'Gmail', mb: 25, src: 'https://support.google.com/mail/answer/6584', checked: '2026-11-18' },
  { id: 'discord', name: 'Discord', note: 'free', mb: 20, src: 'https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ', checked: '2026-11-18' },
  { id: 'nitrob', name: 'Discord Nitro Basic', mb: 50, src: 'https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ', checked: '2026-11-18' },
  { id: 'mb10', name: '10 MB', mb: 10 },
];
const MAX_PASSES = 4;
const S = { files: [], pro: false, dest: 'gmail', customMB: 10, info: null, plan: null, conv: null, cancelled: false, busy: false, lastOut: null };

function targetBytes() {
  if (S.dest === 'custom') return Math.round(Math.max(0.2, Number($('customMB').value) || 0) * E.MB);
  const d = DEST.concat(savedDest()).find((x) => x.id === S.dest);
  return Math.round((d ? d.mb : 25) * E.MB);
}
function targetLabel() { return MBs(targetBytes()); }

// ── saved destinations + history (this device only, localStorage) ──
function savedDest() { try { return JSON.parse(localStorage.getItem('vc:dest') || '[]'); } catch (e) { return []; } }
function hist() { try { return JSON.parse(localStorage.getItem('vc:hist') || '[]'); } catch (e) { return []; } }
function pushHist(r) { const h = hist(); h.unshift(r); try { localStorage.setItem('vc:hist', JSON.stringify(h.slice(0, 500))); } catch (e) {} }

function renderDest() {
  const box = $('dests'); box.innerHTML = '';
  const all = DEST.concat(S.pro ? savedDest() : []);
  all.forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (S.dest === d.id ? ' on' : ''); b.dataset.dest = d.id;
    b.innerHTML = '<b></b><span></span>';
    b.querySelector('b').textContent = d.note ? d.name + ' (' + T('free_plan') + ')' : d.name;
    b.querySelector('span').textContent = /^\d/.test(d.name) ? '' : MBs(d.mb * E.MB);
    b.onclick = () => { S.dest = d.id; renderDest(); replan(); };
    box.appendChild(b);
  });
  const c = document.createElement('button');
  c.type = 'button'; c.className = 'chip' + (S.dest === 'custom' ? ' on' : ''); c.textContent = T('custom');
  c.onclick = () => { S.dest = 'custom'; renderDest(); $('customMB').focus(); replan(); };
  box.appendChild(c);
  $('customRow').hidden = S.dest !== 'custom';
  const d = DEST.find((x) => x.id === S.dest);
  const src = $('destSrc');
  if (d && d.src) { src.hidden = false; src.querySelector('a').href = d.src; src.querySelector('span').textContent = T('checked', { date: d.checked, name: d.name, mb: MBs(d.mb * E.MB) }); }
  else src.hidden = true;
}

// ── probe a file: duration, frame size, fps, audio ──
async function probe(file) {
  const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack();
  if (!vt) throw new Error('no_video');
  const at = await input.getPrimaryAudioTrack();
  const duration = await input.computeDuration();
  let fps = 30, aCodec = '', aKbps = 0;
  if (at) { aCodec = at.codec || ''; try { const as = await at.computePacketStats(400); aKbps = (as.averageBitrate || 0) / 1000; } catch (e) {} }
  try { const st = await vt.computePacketStats(120); if (st.averagePacketRate) fps = st.averagePacketRate; } catch (e) {}
  return { input, vt, at, duration, width: vt.displayWidth, height: vt.displayHeight, fps, hasAudio: !!at, aCodec, aKbps, bytes: file.size, name: file.name };
}

function planFor(info, tgt) {
  return E.plan({ targetBytes: tgt, duration: info.duration, width: info.width, height: info.height, fps: info.fps, hasAudio: info.hasAudio, keepAudio: !$('noAudio').checked, srcBytes: info.bytes, copyAudioKbps: info.aCodec === 'aac' ? info.aKbps : 0 });
}

function showPlan() {
  const i = S.info, p = S.plan, out = $('plan');
  if (!i || !p) { out.hidden = true; return; }
  out.hidden = false;
  $('srcLine').textContent = T('src_line', { name: i.name, size: MBs(i.bytes), w: i.width, h: i.height, sec: Math.round(i.duration), fps: Math.round(i.fps) });
  const pl = $('predLine');
  if (!p.ok) {
    pl.className = 'pred bad';
    pl.textContent = T('too_small', { target: targetLabel(), min: MBs(p.minBytes) });
    $('go').disabled = true;
    return;
  }
  $('go').disabled = S.busy;
  pl.className = 'pred';
  pl.textContent = T('pred_line', { pred: MBs(p.predictedBytes), target: targetLabel(), w: p.width, h: p.height, vk: Math.round(p.videoBps / 1000), ak: p.audioKbps, fps: Math.round(p.fps) });
  $('predNote').textContent = p.alreadyUnder ? T('already_under', { size: MBs(i.bytes), target: targetLabel() }) : (p.keepSize ? T('keep_size') : T('smaller_size', { w: p.width, h: p.height }));
  const more = S.files.length - 1;
  $('multiNote').hidden = !(more > 0 && !S.pro);
  $('multiNote').textContent = T('multi_free', { n: S.files.length });
}

function replan() { if (S.info) { S.plan = planFor(S.info, targetBytes()); showPlan(); } }

async function pickFiles(list) {
  S.files = Array.from(list || []).filter((f) => f && f.size > 0);
  if (!S.files.length) return;
  $('err').hidden = true; $('result').hidden = true;
  $('srcLine').textContent = T('reading'); $('plan').hidden = false;
  try {
    S.info = await probe(S.files[0]);
    replan();
  } catch (e) {
    S.info = null; S.plan = null; $('plan').hidden = true;
    showErr(e && e.message === 'no_video' ? T('err_novideo') : T('err_read'));
  }
}

function showErr(msg) { const e = $('err'); e.hidden = false; e.textContent = msg; }

// ── one encode pass ──
async function encodePass(info, file, p, vbps, onProg) {
  const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
  const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
  const vcodec = await M.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: p.width, height: p.height, bitrate: vbps });
  if (!vcodec) throw new Error('no_encoder');
  const video = { codec: vcodec, bitrate: vbps, forceTranscode: true, keyFrameInterval: 2 };
  if (!p.keepSize) { if (info.width >= info.height) video.height = p.height; else video.width = p.width; }
  if (p.fpsCapped) video.frameRate = p.fps;
  let audio = { discard: true };
  if (p.audioKbps > 0 && p.audioCopy) audio = {};
  else if (p.audioKbps > 0) {
    const ac = await M.getFirstEncodableAudioCodec(['aac', 'opus'], { bitrate: p.audioKbps * 1000 });
    if (ac) audio = { codec: ac, bitrate: p.audioKbps * 1000, forceTranscode: true };
  }
  const conv = await M.Conversion.init({ input, output, video, audio, tracks: 'primary', showWarnings: false });
  if (!conv.isValid) throw new Error('invalid:' + (conv.discardedTracks || []).map((d) => d.reason).join(','));
  S.conv = conv;
  conv.onProgress = (x) => onProg(x);
  await conv.execute();
  S.conv = null;
  return { buf: new Uint8Array(output.target.buffer), vcodec, acodec: p.audioKbps > 0 ? (p.audioCopy ? 'aac' : audio.codec || '') : '' };
}

// passes until the file is under the target (max 3), Pro: one more pass to fill unused room
async function compressOne(info, file, onStatus) {
  const p = Object.assign({}, planFor(info, targetBytes()));
  if (!p.ok) throw new Error('too_small');
  // test switch (?vc_overshoot=1): the first pass asks the encoder for 40 % too much, so the re-encode-lower loop runs in a real browser
  const over = /[?&]vc_overshoot=1/.test(location.search) ? 1.4 : 1;
  let vbps = Math.floor(p.videoBps * over), best = null, passes = 0, log = [];
  for (let n = 1; n <= MAX_PASSES; n++) {
    passes = n;
    const r = await encodePass(info, file, p, vbps, (x) => onStatus(n, x));
    log.push({ pass: n, vbps, bytes: r.buf.length });
    if (r.buf.length <= p.targetBytes) { best = r; break; }
    const asked = vbps * p.duration / 8 + p.audioKbps * 1000 * p.duration / 8;
    const sh = r.buf.length / asked > 1.25 ? E.shrink(p, r.buf.length / asked) : null;
    if (sh) { p.width = sh.width; p.height = sh.height; p.keepSize = false; vbps = p.videoBps; log[log.length - 1].shrinkTo = sh.width + 'x' + sh.height; continue; }
    const nv = E.retry(Object.assign({}, p, { videoBps: vbps }), r.buf.length);
    if (!nv) { best = null; break; }
    vbps = nv;
  }
  if (best && S.pro && $('fillOpt').checked) {
    const fv = E.fill(Object.assign({}, p, { videoBps: vbps }), best.buf.length);
    if (fv) {
      const r2 = await encodePass(info, file, p, fv, (x) => onStatus(passes + 1, x));
      log.push({ pass: passes + 1, vbps: fv, bytes: r2.buf.length, fill: true });
      if (r2.buf.length <= p.targetBytes && r2.buf.length > best.buf.length) { best = r2; passes++; }
    }
  }
  return { plan: p, out: best, passes, log };
}

function outName(name, tgt) { return name.replace(/\.[^.]+$/, '') + '-under-' + String(Math.round(tgt / E.MB * 10) / 10).replace('.', '_') + 'MB.mp4'; }

function setProg(n, x) {
  $('prog').hidden = false;
  $('progBar').style.width = Math.round(x * 100) + '%';
  $('progTxt').textContent = T('progress', { pass: n, pct: Math.round(x * 100) });
}

async function compareFrames(info, buf) {
  try {
    const t = Math.min(info.duration * 0.4, Math.max(info.duration - 0.2, 0));
    const a = new M.CanvasSink(info.vt, { width: 640, fit: 'contain' });
    const oIn = new M.Input({ source: new M.BufferSource(buf), formats: M.ALL_FORMATS });
    const ot = await oIn.getPrimaryVideoTrack();
    const b = new M.CanvasSink(ot, { width: 640, fit: 'contain' });
    const [fa, fb] = await Promise.all([a.getCanvas(t), b.getCanvas(t)]);
    const put = (id, f) => { const c = $(id); if (!f) return; c.width = f.canvas.width; c.height = f.canvas.height; c.getContext('2d').drawImage(f.canvas, 0, 0); };
    put('cmpA', fa); put('cmpB', fb);
    $('cmp').hidden = false;
    $('cmpT').textContent = T('cmp_at', { sec: t.toFixed(1) });
  } catch (e) { $('cmp').hidden = true; }
}

function download(data, name, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: type || 'video/mp4' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function go() {
  if (S.busy || !S.info) return;
  if (typeof VideoEncoder === 'undefined') { showErr(T('no_webcodecs')); return; }
  S.busy = true; S.cancelled = false; $('go').disabled = true; $('cancel').hidden = false; $('err').hidden = true; $('result').hidden = true;
  const batch = S.pro && S.files.length > 1;
  try {
    if (batch) await runBatch(); else await runOne();
  } catch (e) {
    if (!S.cancelled) showErr(e && e.message === 'no_encoder' ? T('no_webcodecs') : e && e.message === 'too_small' ? $('predLine').textContent : T('err_enc') + ' (' + String(e && e.message || e).slice(0, 80) + ')');
  } finally {
    S.busy = false; $('go').disabled = false; $('cancel').hidden = true; $('prog').hidden = true; S.conv = null;
  }
}

async function runOne() {
  const info = S.info, file = S.files[0], t0 = performance.now();
  const r = await compressOne(info, file, setProg);
  const secs = (performance.now() - t0) / 1000;
  const res = $('result'); res.hidden = false;
  const tgt = r.plan.targetBytes;
  $('res').dataset.log = JSON.stringify(r.log);
  if (!r.out) { $('resHead').textContent = T('res_fail', { target: MBs(tgt), passes: r.passes }); $('resLine').textContent = r.log.map((x) => x.pass + ': ' + MBs(x.bytes)).join(' · '); $('dl').hidden = true; return; }
  const size = r.out.buf.length;
  const useOrig = size >= info.bytes && info.bytes <= tgt;
  S.lastOut = { buf: r.out.buf, name: outName(info.name, tgt) };
  $('resHead').textContent = useOrig ? T('res_orig', { size: MBs(info.bytes), target: MBs(tgt) }) : T('res_ok', { size: MBs(size), target: MBs(tgt) });
  $('resLine').textContent = T('res_line', { from: MBs(info.bytes), to: MBs(size), pct: E.pctSmaller(info.bytes, size), w: r.plan.width, h: r.plan.height, passes: r.passes, sec: secs.toFixed(1), pred: MBs(r.plan.predictedBytes) });
  $('res').dataset.bytes = size; $('res').dataset.target = tgt; $('res').dataset.passes = r.passes; $('res').dataset.pred = r.plan.predictedBytes;
  $('res').dataset.secs = secs.toFixed(2); $('res').dataset.vcodec = r.out.vcodec; $('res').dataset.acodec = r.out.acodec; $('res').dataset.log = JSON.stringify(r.log);
  $('opusNote').hidden = r.out.acodec !== 'opus';
  $('dl').hidden = false;
  $('dl').onclick = () => useOrig ? download(file, file.name, file.type) : download(S.lastOut.buf, S.lastOut.name);
  pushHist({ at: new Date().toISOString().slice(0, 16) + 'Z', name: info.name, from: info.bytes, target: tgt, to: size, w: r.plan.width, h: r.plan.height, passes: r.passes });
  renderHist();
  compareFrames(info, r.out.buf);
}

async function runBatch() {
  const rows = $('batchRows'); rows.innerHTML = ''; $('batch').hidden = false;
  const outs = [], tgt = targetBytes();
  for (let i = 0; i < S.files.length; i++) {
    if (S.cancelled) break;
    const f = S.files[i], tr = document.createElement('tr');
    tr.innerHTML = '<td></td><td></td><td></td><td></td>'; tr.children[0].textContent = f.name; tr.children[1].textContent = MBs(f.size); rows.appendChild(tr);
    try {
      const info = await probe(f);
      const r = await compressOne(info, f, (n, x) => setProg(n, (i + x) / S.files.length));
      if (r.out) {
        const useOrig = r.out.buf.length >= f.size && f.size <= tgt;
        const data = useOrig ? new Uint8Array(await f.arrayBuffer()) : r.out.buf;
        outs.push({ name: useOrig ? f.name : outName(f.name, tgt), data });
        tr.children[2].textContent = MBs(data.length); tr.children[3].textContent = data.length <= tgt ? '✓ ' + T('under', { target: MBs(tgt) }) : '—';
        pushHist({ at: new Date().toISOString().slice(0, 16) + 'Z', name: f.name, from: f.size, target: tgt, to: data.length, w: r.plan.width, h: r.plan.height, passes: r.passes });
      } else { tr.children[3].textContent = T('res_fail', { target: MBs(tgt), passes: r.passes }); }
    } catch (e) { tr.children[3].textContent = T('err_read'); }
  }
  renderHist();
  if (outs.length) {
    const parts = E.zipParts(outs);
    const blob = new Blob(parts, { type: 'application/zip' });
    $('zipLine').hidden = false;
    $('zipLine').textContent = T('zip_line', { n: outs.length, size: MBs(blob.size), target: MBs(tgt) });
    $('zipDl').hidden = false;
    $('zipDl').onclick = () => download(blob, 'videos-under-' + Math.round(tgt / E.MB) + 'MB.zip', 'application/zip');
    $('zipDl').dataset.n = outs.length; $('zipDl').dataset.under = outs.every((o) => o.data.length <= tgt) ? '1' : '0';
  }
}

function renderHist() {
  const box = $('histRows'); if (!box) return;
  box.innerHTML = '';
  if (!S.pro) { $('histLock').hidden = false; return; }
  $('histLock').hidden = true;
  hist().slice(0, 50).forEach((h) => {
    const tr = document.createElement('tr');
    [h.at.replace('T', ' '), h.name, MBs(h.from), MBs(h.to), MBs(h.target)].forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
    box.appendChild(tr);
  });
}

function setPro(on) {
  S.pro = on;
  document.body.classList.toggle('pro', on);
  $('proState').textContent = on ? T('pro_on') : T('pro_off');
  $('fillOpt').disabled = !on; $('saveDest').disabled = !on; $('csv').disabled = !on;
  renderDest(); renderHist(); showPlan();
}

async function sample() {
  try {
    const r = await fetch('sample.mp4');
    const b = await r.blob();
    S.dest = 'custom'; $('customMB').value = '1'; renderDest();
    await pickFiles([new File([b], 'sample-made-up-clip.mp4', { type: 'video/mp4' })]);
    go();
  } catch (e) { showErr(T('err_read')); }
}

function init() {
  ['buyM', 'buyY', 'buyM2', 'buyY2'].forEach((id) => { const a = $(id); if (a) a.href = /Y/.test(id) ? LIC.BUY.year : LIC.BUY.month; });
  const fi = $('file');
  fi.onchange = () => pickFiles(fi.files);
  const dz = $('drop');
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('over'); pickFiles(e.dataTransfer.files); };
  $('customMB').oninput = replan;
  $('noAudio').onchange = replan;
  $('go').onclick = go;
  $('sample').onclick = sample;
  $('cancel').onclick = async () => { S.cancelled = true; if (S.conv) try { await S.conv.cancel(); } catch (e) {} };
  $('saveDest').onclick = () => {
    const name = ($('destName').value || '').trim(), mb = Number($('destMB').value);
    if (!S.pro || !name || !(mb > 0)) return;
    const l = savedDest().filter((d) => d.name !== name); l.push({ id: 'u' + Date.now(), name, mb }); localStorage.setItem('vc:dest', JSON.stringify(l));
    renderDest();
  };
  $('csv').onclick = () => { if (S.pro) download(new Blob([E.csv(hist())], { type: 'text/csv' }), 'video-compressor-history.csv', 'text/csv'); };
  $('keyGo').onclick = async () => {
    $('keyMsg').textContent = '…';
    const r = await LIC.enter($('key').value);
    $('keyMsg').textContent = r.ok ? T('key_ok') : r.offline ? T('key_offline') : T('key_bad');
    if (r.ok) setPro(true);
  };
  if (typeof VideoEncoder === 'undefined') { $('support').hidden = false; $('support').textContent = T('no_webcodecs'); }
  renderDest();
  LIC.status().then((s) => setPro(s.tier !== 'free'));
}
init();
