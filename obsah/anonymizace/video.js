/* ============================================================
   anonymizace/video.js – anonymizace videa.
   Náhled přes <video> (posun v čase), oblasti = stopy s klíčovými snímky (jadro.js: oblastVCase,
   nastavKlic, sledujDetekce), export přes Mediabunny Conversion s vlastním zpracováním snímků
   (process → plátno s vpálenými efekty), bez metadat (tags: {}).
   ============================================================ */
(function () {
'use strict';
const A = window.ANON, APP = window.ANON_APP, $ = id => document.getElementById(id), tr = APP.tr;
const MB_SKRIPT = 'lib/mediabunny.min.js';
const V = { soubor: null, W: 0, H: 0, dur: 0, fps: 30, t: 0, stopy: [], vybrana: null, z: 1, hraje: false, historie: A.novaHistorie(), meta: null, prvni: 0 };
const vid = document.createElement('video');
vid.muted = true; vid.playsInline = true; vid.preload = 'auto';
const platno = $('vPlatno'), ctx = platno.getContext('2d', { willReadFrequently: true }), ov = $('vOverlay');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const casTxt = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const vybrana = () => V.stopy.find(s => s.id === V.vybrana) || null;

function prace(text, podil) {
  if (text === null) { $('vPrace').hidden = true; return; }
  $('vPrace').hidden = false; $('vPraceText').textContent = text; $('vPraceProuzek').style.width = Math.round((podil || 0) * 100) + '%';
}
function nactiSkript(src) {
  return new Promise((ok, chyba) => {
    if (window.Mediabunny) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = () => chyba(new Error('Nepodařilo se načíst ' + src)); document.head.appendChild(s);
  });
}

/* ---------- přepínání režimu a otevření ---------- */
function prepni(zapnout = $('video').hidden) {
  $('video').hidden = !zapnout; $('rozlozeni').hidden = zapnout;
  $('tlVideo').setAttribute('aria-pressed', String(zapnout));
  document.querySelectorAll('.lista .skup').forEach(g => { g.hidden = zapnout; });
  if (zapnout) { nastavScenu(); if (!V.soubor) $('vSoubor').click(); }
  else { vid.pause(); }
}
async function otevri(soubor) {
  prepni(true);
  prace(tr('Otevírám video…'), 0.2);
  try {
    await nactiSkript(MB_SKRIPT);
    const MB = window.Mediabunny;
    const input = new MB.Input({ source: new MB.BlobSource(soubor), formats: MB.ALL_FORMATS });
    const stopa = await input.getPrimaryVideoTrack();
    if (!stopa) throw new Error(tr('Soubor neobsahuje video.'));
    const [dur, stat, tagy, prvni] = await Promise.all([input.computeDuration(), stopa.computePacketStats(120).catch(() => null), input.getMetadataTags().catch(() => ({})), stopa.getFirstTimestamp().catch(() => 0)]);
    if (vid.src) URL.revokeObjectURL(vid.src);
    vid.src = URL.createObjectURL(soubor);
    await new Promise((ok, chyba) => { vid.onloadeddata = ok; vid.onerror = () => chyba(new Error(tr('Prohlížeč toto video neumí přehrát (zkuste MP4 H.264 nebo WebM).'))); });
    Object.assign(V, { soubor, W: vid.videoWidth, H: vid.videoHeight, dur: isFinite(vid.duration) ? vid.duration : dur, fps: stat && stat.averagePacketRate ? stat.averagePacketRate : 30,
      t: 0, stopy: [], vybrana: null, historie: A.novaHistorie(), prvni: Math.max(0, prvni || 0),
      meta: { format: (await input.getFormat()).name, kodek: await stopa.getCodec(), tagy } });
    platno.width = V.W; platno.height = V.H;
    $('vScena').hidden = false; $('vPrazdno').hidden = true;
    $('vCas').max = Math.max(1, Math.round(V.dur * 1000));
    nastavScenu(); vykresliMetadata(); obnov();
    await posunNa(0);
  } catch (e) { console.error(e); Dialog.chyba(tr('Video se nepodařilo otevřít: ') + e.message); }
  prace(null);
}

/* ---------- vykreslení ---------- */
function nastavScenu() {
  if (!V.W) return;
  const o = $('vObal'), z = Math.min((o.clientWidth - 16) / V.W, (o.clientHeight - 16) / V.H);
  V.z = Math.max(0.05, z);
  const sc = $('vScena'); sc.style.width = Math.round(V.W * V.z) + 'px'; sc.style.height = Math.round(V.H * V.z) + 'px';
  const dpr = window.devicePixelRatio || 1;
  ov.width = Math.round(V.W * V.z * dpr); ov.height = Math.round(V.H * V.z * dpr);
  kresliOverlay();
}
let nahradni = null; // oblast právě taženou myší (ještě ne klíč)
function oblastiVCase(t) {
  return V.stopy.map(s => (nahradni && nahradni.id === s.id ? nahradni : A.oblastVCase(s, t))).filter(Boolean);
}
function kresli() {
  if (!V.W) return;
  ctx.drawImage(vid, 0, 0, V.W, V.H);
  APP.aplikujNaKontext(ctx, V.W, V.H, oblastiVCase(V.t));
  kresliOverlay();
}
function barva(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'; }
function kresliOverlay() {
  const c = ov.getContext('2d'), dpr = window.devicePixelRatio || 1, k = V.z * dpr;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, ov.width, ov.height);
  if (!V.W) return;
  const cAcc = barva('--accent'), cOk = barva('--ok');
  for (const o of oblastiVCase(V.t)) {
    const vyb = o.id === V.vybrana, st = V.stopy.find(s => s.id === o.id), jeKlic = st && st.klice.some(q => Math.abs(q.t - V.t) < 0.5 / V.fps);
    c.beginPath();
    if (o.tvar === 'elipsa') c.ellipse((o.x + o.w / 2) * k, (o.y + o.h / 2) * k, o.w / 2 * k, o.h / 2 * k, 0, 0, Math.PI * 2); else c.rect(o.x * k, o.y * k, o.w * k, o.h * k);
    c.lineWidth = (vyb ? 2.5 : 1.6) * dpr; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
    c.setLineDash(jeKlic ? [] : [5 * dpr, 4 * dpr]);
    c.lineWidth = (vyb ? 1.6 : 1) * dpr; c.strokeStyle = vyb ? cAcc : o.zdroj === 'oblicej' ? cOk : cAcc; c.stroke(); c.setLineDash([]);
    if (vyb) {
      const u = A.uchyty(o), s = 8 * dpr;
      for (const n of A.UCHYTY) { c.fillStyle = barva('--bg'); c.strokeStyle = cAcc; c.fillRect(u[n][0] * k - s / 2, u[n][1] * k - s / 2, s, s); c.strokeRect(u[n][0] * k - s / 2, u[n][1] * k - s / 2, s, s); }
      if (jeKlic) { c.font = `${11 * dpr}px system-ui,sans-serif`; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(o.x * k, Math.max(0, o.y * k - 16 * dpr), 52 * dpr, 15 * dpr); c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText('◆ ' + tr('klíč'), o.x * k + 4 * dpr, Math.max(0, o.y * k - 16 * dpr) + 7.5 * dpr); }
    }
  }
  if (novy) { c.setLineDash([5 * dpr, 4 * dpr]); c.strokeStyle = cAcc; c.lineWidth = 1.5 * dpr; c.strokeRect(novy.x * k, novy.y * k, novy.w * k, novy.h * k); c.setLineDash([]); }
}
function obnov() {
  $('vCasText').textContent = casTxt(V.t) + ' / ' + casTxt(V.dur);
  if (!tahCasu) $('vCas').value = Math.round(V.t * 1000);
  $('vPrehrat').textContent = V.hraje ? '⏸' : '▶';
  // časová osa stop
  const d = V.dur || 1;
  $('vOsa').innerHTML = V.stopy.map(s => `<i class="${s.id === V.vybrana ? 'vyb' : ''}" style="left:${s.od / d * 100}%;width:${Math.max(0.3, (Math.min(s.do, d) - s.od) / d * 100)}%"></i>`).join('') + `<b style="left:${V.t / d * 100}%"></b>`;
  $('vPocet').textContent = V.stopy.length ? '(' + V.stopy.length + ')' : '';
  $('vSeznam').innerHTML = V.stopy.length ? V.stopy.map(s => `<div class="polozka" data-vstopa="${s.id}" aria-current="${s.id === V.vybrana}">
      <span class="jm">${s.zdroj === 'oblicej' ? '👤' : s.tvar === 'elipsa' ? '◯' : '▭'} ${casTxt(s.od)}–${casTxt(Math.min(s.do, V.dur))} · ${s.klice.length} ◆</span>
      <button data-vsmazat="${s.id}" title="Smazat stopu">🗑️</button></div>`).join('')
    : `<p class="pozn">${tr('Zatím žádné stopy. Táhněte myší přes snímek nebo najděte obličeje 👤.')}</p>`;
  const st = vybrana(), z = st || { efekt: $('vEfekt').value, sila: +$('vSila').value };
  if (st) { $('vEfekt').value = st.efekt; $('vSila').value = st.sila; $('vTvar').value = st.tvar; }
  $('vSilaHodnota').textContent = $('vSila').value + ' %';
  const [ur, txt] = APP.textBezpecnosti(A.novaOblast({ efekt: z.efekt, sila: +z.sila, w: 100, h: 100 }));
  $('vBezpecnost').className = 'bezpecnost ' + ur; $('vBezpecnost').textContent = txt;
}
function vykresliMetadata() {
  const m = V.meta; if (!m) return;
  const t = m.tagy || {}, polozky = Object.entries(t).filter(([k]) => k !== 'raw' && k !== 'images').map(([k, v]) => [k, v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v)]);
  const raw = t.raw ? Object.keys(t.raw) : [];
  const poloha = raw.find(k => /xyz|location/i.test(k));
  let h = `<p class="pozn">${esc(V.soubor.name)} · ${esc(m.format)} · ${esc(m.kodek || '?')} · ${V.W}×${V.H} · ${V.fps.toFixed(2).replace('.', ',')} fps · ${casTxt(V.dur)}</p>`;
  if (!polozky.length && !raw.length) h += `<div class="stav-meta ok">${tr('Kontejner neobsahuje metadatové značky.')}</div>`;
  else {
    h += `<div class="stav-meta zle"><b>${poloha ? tr('Video obsahuje i polohu (GPS)!') : tr('Video obsahuje metadata.')}</b> ${tr('Uložené video je mít nebude.')}</div>`;
    if (polozky.length) h += '<table class="meta-tab"><tbody>' + polozky.map(([k, v]) => `<tr><td>${esc(k)}</td><td data-i18n="ne">${esc(v.slice(0, 200))}</td></tr>`).join('') + '</tbody></table>';
    if (raw.length) h += '<div class="bloky" data-i18n="ne">' + raw.map(k => `<span>${esc(k)}</span>`).join('') + '</div>';
  }
  $('vMetadata').innerHTML = h;
}

/* ---------- čas ---------- */
let hledaniCeka = null;
function posunNa(t) {
  V.t = Math.max(0, Math.min(V.dur, t));
  return new Promise(ok => {
    if (Math.abs(vid.currentTime - V.t) < 1e-4 && vid.readyState >= 2) { kresli(); obnov(); return ok(); }
    hledaniCeka = () => { hledaniCeka = null; kresli(); obnov(); ok(); };
    vid.currentTime = V.t;
  });
}
vid.addEventListener('seeked', () => { if (hledaniCeka) hledaniCeka(); });
function smycka() {
  if (!V.hraje) return;
  V.t = vid.currentTime; kresli(); obnov();
  if (vid.ended) { V.hraje = false; return obnov(); }
  if (vid.requestVideoFrameCallback) vid.requestVideoFrameCallback(smycka); else requestAnimationFrame(smycka);
}
function prehraj() {
  if (!V.W) return;
  if (V.hraje) { vid.pause(); V.hraje = false; V.t = vid.currentTime; return obnov(); }
  if (V.t >= V.dur - 0.01) vid.currentTime = 0;
  V.hraje = true; vid.play().then(smycka, () => { V.hraje = false; obnov(); });
}
const krokSnimku = s => { if (V.hraje) prehraj(); posunNa(V.t + s / V.fps); };
let tahCasu = false;
$('vCas').addEventListener('input', () => { tahCasu = true; if (V.hraje) prehraj(); posunNa(+$('vCas').value / 1000); });
$('vCas').addEventListener('change', () => { tahCasu = false; });
$('vOsa').addEventListener('click', e => { const r = $('vOsa').getBoundingClientRect(); posunNa((e.clientX - r.left) / r.width * V.dur); });

/* ---------- úpravy stop ---------- */
function zapamatuj() { A.hZapamatuj(V.historie, JSON.stringify(V.stopy)); }
function historie(fn) { const s = fn(V.historie, JSON.stringify(V.stopy)); if (s === null) return; V.stopy = JSON.parse(s); if (!vybrana()) V.vybrana = null; kresli(); obnov(); }
let novy = null, tah = null;
function bod(e) { const r = ov.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * V.W, y: (e.clientY - r.top) / r.height * V.H }; }
ov.addEventListener('pointerdown', e => {
  if (!V.W || e.button > 0) return;
  e.preventDefault(); try { ov.setPointerCapture(e.pointerId); } catch (err) { /* syntetická */ }
  if (V.hraje) prehraj();
  const p = bod(e), obl = oblastiVCase(V.t), sel = obl.find(o => o.id === V.vybrana);
  const u = sel && A.najdiUchyt(sel, p.x, p.y, 9 / V.z);
  if (u) { tah = { druh: 'uchyt', u, r0: { x: sel.x, y: sel.y, w: sel.w, h: sel.h }, p0: p, o: sel }; return; }
  const h = A.najdiOblast(obl, p.x, p.y);
  if (h) { V.vybrana = h.id; tah = { druh: 'posun', r0: { x: h.x, y: h.y, w: h.w, h: h.h }, p0: p, o: h }; kresliOverlay(); return obnov(); }
  V.vybrana = null; tah = { druh: 'novy', p0: p }; obnov();
});
ov.addEventListener('pointermove', e => {
  if (!tah) return;
  const p = bod(e), dx = p.x - tah.p0.x, dy = p.y - tah.p0.y;
  if (tah.druh === 'novy') { novy = A.normObdelnik(tah.p0.x, tah.p0.y, p.x, p.y); return kresliOverlay(); }
  if (Math.hypot(dx, dy) * V.z < 2 && !tah.pohnuto) return;
  tah.pohnuto = true;
  const r = tah.druh === 'posun' ? { ...tah.r0, x: tah.r0.x + dx, y: tah.r0.y + dy } : A.tahUchytem(tah.r0, tah.u, dx, dy, 4 / V.z);
  nahradni = A.novaOblast({ ...tah.o, ...r });
  kresli();
});
function konecTahu() {
  const t = tah; tah = null; if (!t) return;
  if (t.druh === 'novy') {
    const n = novy; novy = null;
    if (n && n.w * V.z >= 4 && n.h * V.z >= 4) {
      zapamatuj();
      const st = { id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tvar: $('vTvar').value, efekt: $('vEfekt').value, sila: +$('vSila').value,
        barva: '#000000', zdroj: 'rucni', od: V.t, do: V.dur, klice: [] };
      A.nastavKlic(st, V.t, n); st.do = V.dur;
      V.stopy.push(st); V.vybrana = st.id;
    }
    kresli(); return obnov();
  }
  if (t.pohnuto && nahradni) { zapamatuj(); A.nastavKlic(vybrana(), V.t, nahradni); }
  nahradni = null; kresli(); obnov();
}
ov.addEventListener('pointerup', konecTahu); ov.addEventListener('pointercancel', konecTahu);
function upravStopu(fn) { const st = vybrana(); if (!st) return; zapamatuj(); fn(st); kresli(); obnov(); }

/* ---------- obličeje ve videu ---------- */
async function najdiObliceje() {
  if (!V.W) return Dialog.info(tr('Nejdřív otevřete video.'));
  if (V.hraje) prehraj();
  const krok = +$('vKrok').value, n = Math.floor(V.dur / krok) + 1;
  try {
    await APP.pripravAi(prace);
    const k = Math.min(1, 960 / Math.max(V.W, V.H)), w = Math.round(V.W * k), h = Math.round(V.H * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true }), snimky = [];
    V.ruseno = false;
    for (let i = 0; i < n && !V.ruseno; i++) {
      const t = Math.min(V.dur, i * krok);
      prace(`${tr('Hledám obličeje ve videu…')} ${casTxt(t)} / ${casTxt(V.dur)}`, i / n);
      await posunNa(t);
      cx.drawImage(vid, 0, 0, w, h);
      const boxy = await APP.detekujObliceje({ W: w, H: h, data: cx.getImageData(0, 0, w, h).data }, +APP.nast.citlivost);
      snimky.push({ t, boxy: boxy.map(b => ({ x0: b.x0 / k, y0: b.y0 / k, x1: b.x1 / k, y1: b.y1 / k, skore: b.skore })) });
    }
    const stopy = A.sledujDetekce(snimky, { maxMezera: Math.max(1, krok * 3), krok, minDetekci: 2 });
    zapamatuj();
    V.stopy = V.stopy.filter(s => s.zdroj !== 'oblicej');
    for (const s of stopy) {
      V.stopy.push({ id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tvar: 'elipsa', efekt: $('vEfekt').value, sila: +$('vSila').value, barva: '#000000', zdroj: 'oblicej',
        od: s.od, do: Math.min(V.dur, s.do), klice: s.klice.map(q => { const o = A.oblastZObliceje({ x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h, skore: 1 }, V.W, V.H); return { t: q.t, x: o.x, y: o.y, w: o.w, h: o.h }; }) });
    }
    prace(null); await posunNa(0);
    Dialog.info(`👤 ${tr('Nalezené stopy obličejů')}: ${stopy.length}.\n${tr('Projděte video a doplňte klíče, kde oblast nesedí – automatika může obličej ztratit (profil, rychlý pohyb).')}`);
  } catch (e) { console.error(e); prace(null); Dialog.chyba(tr('Hledání selhalo: ') + e.message); }
}

/* ---------- export ---------- */
async function exportuj() {
  if (!V.W) return Dialog.info(tr('Nejdřív otevřete video.'));
  if (V.hraje) prehraj();
  if (!V.stopy.length && !(await Dialog.potvrd(tr('Video nemá žádnou oblast – uloží se jen bez metadat. Pokračovat?')))) return;
  const MB = window.Mediabunny, mp4 = $('vFormat').value === 'mp4';
  try {
    prace(tr('Připravuji převod…'), 0);
    const input = new MB.Input({ source: new MB.BlobSource(V.soubor), formats: MB.ALL_FORMATS });
    const output = new MB.Output({ format: mp4 ? new MB.Mp4OutputFormat() : new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const c = document.createElement('canvas'); c.width = V.W; c.height = V.H;
    const cx = c.getContext('2d', { willReadFrequently: true });
    const stopy = JSON.parse(JSON.stringify(V.stopy));
    const conv = await MB.Conversion.init({
      input, output, tags: {}, showWarnings: false,
      video: { forceTranscode: true, allowRotationMetadata: false, process: sample => {
        sample.drawWithFit(cx, { fit: 'fill' });
        const t = sample.timestamp - V.prvni;
        APP.aplikujNaKontext(cx, V.W, V.H, stopy.map(s => A.oblastVCase(s, t)).filter(Boolean));
        return c;
      } },
      audio: $('vZvuk').checked ? {} : { discard: true },
    });
    if (!conv.isValid) throw new Error(tr('Tento formát nejde v prohlížeči zakódovat') + ': ' + conv.discardedTracks.map(d => d.reason).join(', ') + (mp4 ? ' – ' + tr('zkuste WebM.') : ''));
    conv.onProgress = p => prace(`${tr('Ukládám video…')} ${Math.round(p * 100)} %`, p);
    V.konverze = conv;
    await conv.execute();
    V.konverze = null;
    const nazev = A.nazevVystupu(V.soubor.name, 'image/x', APP.nast.pripona).replace(/\.jpg$/, mp4 ? '.mp4' : '.webm');
    APP.stahniBlob(new Blob([output.target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }), nazev);
    const zv = conv.discardedTracks.filter(d => d.track.type === 'audio').length;
    prace(null);
    Dialog.info(`💾 ${tr('Video uloženo bez metadat')}: ${nazev}` + (zv && $('vZvuk').checked ? '\n' + tr('Zvuk se nepodařilo převést, video je bez zvuku.') : ''));
  } catch (e) { console.error(e); V.konverze = null; prace(null); Dialog.chyba(tr('Uložení videa selhalo: ') + e.message); }
}

/* ---------- ovládání ---------- */
const VPRIKAZY = {
  otevrit: () => $('vSoubor').click(), zavrit: () => prepni(false), obliceje: najdiObliceje, export: exportuj,
  prehrat: prehraj, zpetSnimek: () => krokSnimku(-1), vpredSnimek: () => krokSnimku(1),
  zacatek: () => upravStopu(st => { st.od = Math.min(V.t, st.do); }),
  konec: () => upravStopu(st => { st.do = Math.max(V.t, st.od); }),
  smazatKlic: () => upravStopu(st => { if (st.klice.length > 1) st.klice = st.klice.filter(q => Math.abs(q.t - V.t) >= 0.5 / V.fps); }),
};
document.addEventListener('click', e => {
  const t = e.target, p = t.closest('[data-vprikaz]');
  if (p) return VPRIKAZY[p.dataset.vprikaz]();
  const sm = t.closest('[data-vsmazat]');
  if (sm) { zapamatuj(); V.stopy = V.stopy.filter(s => s.id !== sm.dataset.vsmazat); if (!vybrana()) V.vybrana = null; kresli(); return obnov(); }
  const st = t.closest('[data-vstopa]');
  if (st) { V.vybrana = st.dataset.vstopa; const s = vybrana(); if (V.t < s.od || V.t > s.do) posunNa(s.od); else { kresliOverlay(); obnov(); } }
});
$('vSoubor').addEventListener('change', e => { if (e.target.files[0]) otevri(e.target.files[0]); e.target.value = ''; });
$('vEfekt').addEventListener('change', () => upravStopu(st => { st.efekt = $('vEfekt').value; }) || obnov());
$('vTvar').addEventListener('change', () => upravStopu(st => { st.tvar = $('vTvar').value; }));
$('vSila').addEventListener('input', () => { const st = vybrana(); if (st) { st.sila = +$('vSila').value; kresli(); } obnov(); });
$('vSila').addEventListener('change', () => { if (vybrana()) A.hZapamatuj(V.historie, JSON.stringify(V.stopy)); });
$('vSila').value = 70;
addEventListener('keydown', e => {
  if ($('video').hidden || e.target.closest('input:not([type=range]),select,textarea') || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === 'z') { e.preventDefault(); return historie(e.shiftKey ? A.hZnovu : A.hZpet); }
  if (ctrl && k === 'y') { e.preventDefault(); return historie(A.hZnovu); }
  if (ctrl || e.altKey) return;
  if (k === ' ') { e.preventDefault(); return prehraj(); }
  if (k === ',' || k === 'arrowleft') { e.preventDefault(); return krokSnimku(e.shiftKey ? -10 : -1); }
  if (k === '.' || k === 'arrowright') { e.preventDefault(); return krokSnimku(e.shiftKey ? 10 : 1); }
  if (k === '[') return VPRIKAZY.zacatek();
  if (k === ']') return VPRIKAZY.konec();
  if (k === 'delete' && V.vybrana) { zapamatuj(); V.stopy = V.stopy.filter(s => s.id !== V.vybrana); V.vybrana = null; kresli(); return obnov(); }
  if (k === 'escape' && $('vPrace').hidden === false && V.konverze) { V.konverze.cancel(); return; }
  if (k === 'escape') { V.vybrana = null; kresliOverlay(); return obnov(); }
});
new ResizeObserver(() => { if (!$('video').hidden) nastavScenu(); }).observe($('vObal'));

window.ANON_VIDEO = { V, prepni, otevri, posunNa, najdiObliceje, exportuj, kresli };
})();
