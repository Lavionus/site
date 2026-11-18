/* ============================================================
   anonymizace/stranka.js – rozhraní Anonymizace fotek.
   Fotky drží v paměti (File + oblasti), dekóduje se vždy jen ta aktuální.
   Volitelně (📁 → Ukládat rozpracovanou práci) se soubory a oblasti ukládají do IndexedDB.
   Výpočty (efekty, detekce, metadata, ZIP, protokol) jsou v jadro.js (window.ANON).
   Video je v video.js (sdílí window.ANON_APP).
   ============================================================ */
(function () {
'use strict';
const A = window.ANON, $ = id => document.getElementById(id);
const ONNX = 'lib/onnx/', MODEL = 'anonymizace/ultraface-rfb-320.onnx';
const KLIC = 'webapp_anonymizace_nastaveni', KLIC_SAB = 'webapp_anonymizace_sablony', DB = 'webapp_anonymizace';
const EMOJI = ['😎', '🙂', '😀', '🤐', '🙈', '😺', '🐶', '⭐', '❤️', '🌸', '🎃', '🤖'];
const POZN_EFEKT = {
  rozmazat: 'Gaussovské rozmazání se vpálí do pixelů. Detaily menší než udaná velikost zaniknou úplně – zpětné zaostření je neobnoví.',
  pixely: 'Pixelizace průměruje bloky. Malé bloky u textu jdou prolomit hádáním (Depix) – držte ukazatel v zelené.',
  cerna: 'Plná barva úplně nahradí obsah – nejjistější volba (vhodná pro úřední dokumenty).',
  emoji: 'Pod emoji je hrubá pixelizace, takže ani okraje kolem emoji nic neprozradí.',
  zrneni: 'Rozmazání s hrubým zrnem – působí přirozeněji než hladká skvrna, nevratnost jako u rozmazání.',
};
const EFEKT_KLAVESA = { 1: 'rozmazat', 2: 'pixely', 3: 'cerna', 4: 'zrneni', 5: 'emoji' };
if (window.self === window.top) document.body.classList.add('samostatne');

const nast = Object.assign({ efekt: 'rozmazat', sila: 60, emoji: '😎', barva: '#000000', tvar: 'elipsa', stetec: 40, format: 'image/jpeg', kvalita: '0.9',
  maxStrana: '0', pripona: '_anonym', citlivost: '0.65', auto: true, navrhyObliceju: false, spzEfekt: 'pixely', protokol: true, bezeztrat: true,
  icc: false, ukladat: false }, nactiNast());
function nactiNast() { try { return JSON.parse(localStorage.getItem(KLIC)) || {}; } catch (e) { return {}; } }
function ulozNast() { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* bez úložiště jen nezapamatuje */ } }

const S = { fotky: [], akt: -1, obr: null, nastroj: 'vyber', vybrana: null, porovnat: false, z: 1, zoom: 'fit', ai: null, casVykresleni: 0,
  polygon: null, polygonKurzor: null, mezernik: false };
const UZKY = matchMedia('(max-width:900px)');
const foto = () => S.fotky[S.akt] || null;
const oblasti = () => (foto() ? foto().oblasti : []);
const vybrana = () => oblasti().find(o => o.id === S.vybrana) || null;
const vychozi = () => ({ efekt: nast.efekt, sila: nast.sila, emoji: nast.emoji, barva: nast.barva });
const tr = t => (window.I18N && typeof I18N.t === 'function' ? I18N.t(t) : t);
const mb = n => (n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' kB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB');
const obdelnikBox = o => ({ x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.h });

/* ---------- práce s průběhem a fronta ---------- */
let fronta = Promise.resolve();
function vePoradi(fn) { const p = fronta.then(fn, fn); fronta = p.catch(() => {}); return p; }
function prace(text, podil) {
  if (text === null) { $('prace').hidden = true; return; }
  $('prace').hidden = false; $('praceText').textContent = text;
  $('praceProuzek').style.width = Math.round((podil || 0) * 100) + '%';
}
const chvilka = () => new Promise(r => setTimeout(r, 0));

/* ---------- načtení fotek ---------- */
async function dekoduj(f) {
  const bmp = await createImageBitmap(f.soubor); // otočení podle EXIF se použije (image-orientation: from-image)
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0); bmp.close();
  return { W: c.width, H: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
}
async function pridejSoubory(seznam, { bezHledani = false } = {}) {
  const soubory = [...seznam].filter(f => f && (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name)));
  if (!soubory.length) return [];
  const chybne = [], nove = [];
  for (let i = 0; i < soubory.length; i++) {
    const s = soubory[i];
    prace(`Načítám ${i + 1} / ${soubory.length}: ${s.name}`, i / soubory.length);
    try {
      const bmp = await createImageBitmap(s);
      const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const f = { id: 'f' + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5), soubor: s, nazev: s.name || 'foto', typ: s.type, velikost: s.size,
        W: bmp.width, H: bmp.height, oblasti: [], historie: A.novaHistorie(), meta: A.ctiMetadata(await s.arrayBuffer()),
        nahled: c.toDataURL('image/jpeg', 0.75), hledano: false, stazeno: false, overeni: '', zkontrolovano: false };
      bmp.close();
      S.fotky.push(f); nove.push(f);
      if (nast.ukladat && !bezHledani) ulozFotku(f);
    } catch (e) { console.warn(e); chybne.push(s.name); }
  }
  prace(null);
  if (S.akt < 0 && S.fotky.length) await vyber(0); else vykresliFotky();
  if (chybne.length) Dialog.chyba('Tyto soubory prohlížeč neumí otevřít (např. HEIC z iPhonu – převeďte je na JPG):\n' + chybne.join('\n'));
  if (nast.auto && nove.length && !bezHledani) hledejVe(nove);
  planujUlozeni();
  return nove;
}
async function vyber(i) {
  S.polygon = null;
  if (i < 0 || i >= S.fotky.length) { S.akt = -1; S.obr = null; return obnovVse(); }
  S.akt = i; S.vybrana = null;
  prace('Otevírám fotku…', 0.5); await chvilka();
  try { S.obr = await dekoduj(foto()); }
  catch (e) { prace(null); S.obr = null; Dialog.chyba('Fotku se nepodařilo otevřít: ' + e.message); return obnovVse(); }
  prace(null);
  const co = $('cOrig'); co.width = S.obr.W; co.height = S.obr.H;
  co.getContext('2d').putImageData(new ImageData(S.obr.data, S.obr.W, S.obr.H), 0, 0);
  obnovVse();
  const el = document.querySelector(`[data-foto="${i}"]`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function odeber(i) {
  const [f] = S.fotky.splice(i, 1);
  if (f) { smazFotkuDb(f); if (f.miniUrl) URL.revokeObjectURL(f.miniUrl); }
  planujUlozeni();
  if (!S.fotky.length) { S.akt = -1; S.obr = null; return obnovVse(); }
  if (i < S.akt) { S.akt--; return vykresliFotky(); }
  if (i === S.akt) return vyber(Math.min(i, S.fotky.length - 1));
  vykresliFotky();
}

/* ---------- vykreslení ---------- */
function obnovVse() {
  const je = !!S.obr;
  $('scena').hidden = !je; $('prazdno').hidden = je; $('porovnani').hidden = !je || !S.porovnat;
  $('cOrig').hidden = !S.porovnat;
  if (je) { nastavScenu(); vykresliVysledek(); }
  vykresliFotky(); vykresliPanel(); vykresliSeznam(); vykresliMetadata(); vykresliKontrolu();
}
function nastavScenu() {
  if (!S.obr) return;
  const { W, H } = S.obr, obal = $('obal');
  // na úzkém displeji má plocha výšku podle fotky (max. 70 % okna), jinak vyplní volné místo
  const vyska = UZKY.matches ? innerHeight * 0.7 : obal.clientHeight;
  const z = S.zoom === 'fit' ? Math.min((obal.clientWidth - 24) / W, (vyska - 24) / H, 2) : S.zoom;
  S.z = Math.max(0.02, z);
  const sc = $('scena'); sc.style.width = Math.round(W * S.z) + 'px'; sc.style.height = Math.round(H * S.z) + 'px';
  const dpr = window.devicePixelRatio || 1, ov = $('cOverlay');
  ov.width = Math.round(W * S.z * dpr); ov.height = Math.round(H * S.z * dpr);
  // výběr zvětšení: pevná hodnota, nebo „vlastní“ z kolečka
  const zs = $('zoom'), pevna = [...zs.options].find(o => o.value === String(S.zoom));
  $('zoomVlastni').hidden = !!pevna;
  if (!pevna) { $('zoomVlastni').textContent = Math.round(S.z * 100) + ' %'; zs.value = 'vlastni'; } else zs.value = String(S.zoom);
  kresliOverlay();
}
/** Změna zvětšení tak, aby bod pod kurzorem (cx, cy v okně) zůstal na místě. */
function zoomNa(z, cx, cy) {
  if (!S.obr) return;
  const obal = $('obal'), r = $('scena').getBoundingClientRect();
  const ro = obal.getBoundingClientRect();
  if (cx === undefined) { cx = ro.left + ro.width / 2; cy = ro.top + ro.height / 2; }
  const ix = (cx - r.left) / S.z, iy = (cy - r.top) / S.z;
  S.zoom = Math.max(0.05, Math.min(16, z));
  nastavScenu();
  const r2 = $('scena').getBoundingClientRect();
  obal.scrollLeft += r2.left + ix * S.z - cx; obal.scrollTop += r2.top + iy * S.z - cy;
}
const KROKY_ZOOMU = [0.05, 0.1, 0.25, 0.33, 0.5, 0.67, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];
function zoomKrok(smer, cx, cy) {
  const z = S.z;
  const dalsi = smer > 0 ? KROKY_ZOOMU.find(k => k > z * 1.01) || 16 : [...KROKY_ZOOMU].reverse().find(k => k < z * 0.99) || 0.05;
  zoomNa(dalsi, cx, cy);
}
function kresliEmoji(ctx, o, k = 1) {
  const w = o.w * k, h = o.h * k;
  ctx.save();
  ctx.translate((o.x + o.w / 2) * k, (o.y + o.h / 2) * k);
  ctx.scale(w / h, 1);
  ctx.font = `${h * 0.92}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(o.emoji, 0, h * 0.04);
  ctx.restore();
}
function vykresliDo(ctx, obr, obl, k) {
  ctx.putImageData(new ImageData(A.vykresli(obr.data, obr.W, obr.H, obl), obr.W, obr.H), 0, 0);
  for (const o of obl) if (A.aktivni(o) && o.efekt === 'emoji') kresliEmoji(ctx, o, k);
}
/** Použije oblasti přímo na plátno (jen výřezy kolem oblastí – pro video, kde se kreslí snímek za snímkem). */
function aplikujNaKontext(ctx, W, H, obl) {
  for (const o of obl) {
    if (!A.aktivni(o)) continue;
    const pad = o.efekt === 'rozmazat' || o.efekt === 'zrneni' ? Math.ceil(A.sigmaZeSily(o) * 3) : o.efekt === 'pixely' ? A.blokZeSily(o) : 0;
    const vx = Math.max(0, Math.floor(o.x) - pad), vy = Math.max(0, Math.floor(o.y) - pad);
    const vw = Math.min(W, Math.ceil(o.x + o.w) + pad) - vx, vh = Math.min(H, Math.ceil(o.y + o.h) + pad) - vy;
    if (vw <= 0 || vh <= 0) continue;
    const id = ctx.getImageData(vx, vy, vw, vh), kopie = A.novaOblast(JSON.parse(JSON.stringify(o)));
    A.posun(kopie, -vx, -vy);
    A.aplikujOblast(id.data, vw, vh, kopie);
    ctx.putImageData(id, vx, vy);
    if (o.efekt === 'emoji') kresliEmoji(ctx, o, 1);
  }
}
function vykresliVysledek() {
  if (!S.obr) return;
  const t0 = performance.now(), c = $('cVysl');
  if (c.width !== S.obr.W || c.height !== S.obr.H) { c.width = S.obr.W; c.height = S.obr.H; }
  vykresliDo(c.getContext('2d'), S.obr, oblasti(), 1);
  S.casVykresleni = performance.now() - t0;
}
let rafVysl = 0;
function planujVysledek() { if (!rafVysl) rafVysl = requestAnimationFrame(() => { rafVysl = 0; vykresliVysledek(); }); }

function barva(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'; }
function cestaTvaru(ctx, o, k) {
  ctx.beginPath();
  if (o.tvar === 'elipsa') ctx.ellipse((o.x + o.w / 2) * k, (o.y + o.h / 2) * k, o.w / 2 * k, o.h / 2 * k, 0, 0, Math.PI * 2);
  else if (o.tvar === 'stetec' || o.tvar === 'polygon') {
    o.body.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
    if (o.tvar === 'polygon') ctx.closePath();
    else if (o.body.length === 1) ctx.lineTo(o.body[0][0] * k + 0.01, o.body[0][1] * k);
  } else ctx.rect(o.x * k, o.y * k, o.w * k, o.h * k);
}
let kurzorStetce = null, novyNahled = null;
function kresliOverlay() {
  const ov = $('cOverlay'), ctx = ov.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ov.width, ov.height);
  if (!S.obr) return;
  const dpr = window.devicePixelRatio || 1, k = S.z * dpr;
  const cAcc = barva('--accent'), cOk = barva('--ok'), cWarn = barva('--warn'), cFaint = barva('--text-faint'), cDanger = barva('--danger');
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const o of oblasti()) {
    const vyb = o.id === S.vybrana, slabe = A.aktivni(o) && A.hodnoceni(o).uroven === 'slabe';
    const c = vyb ? cAcc : o.navrh ? cWarn : o.vypnuta ? cFaint : slabe ? cDanger : o.zdroj === 'oblicej' ? cOk : cAcc;
    ctx.setLineDash(o.navrh || o.vypnuta ? [6 * dpr, 4 * dpr] : []);
    if (o.tvar === 'stetec') {
      cestaTvaru(ctx, o, k);
      ctx.globalAlpha = o.navrh || o.vypnuta ? 0.25 : 0.12; ctx.strokeStyle = c; ctx.lineWidth = o.r * 2 * k; ctx.stroke(); ctx.globalAlpha = 1;
      if (vyb) { ctx.lineWidth = 1.5 * dpr; ctx.strokeRect(o.x * k, o.y * k, o.w * k, o.h * k); }
    } else {
      cestaTvaru(ctx, o, k);
      if (o.navrh) { ctx.fillStyle = cWarn; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.lineWidth = (vyb ? 2.5 : 1.6) * dpr; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
      ctx.lineWidth = (vyb ? 1.6 : 1) * dpr; ctx.strokeStyle = c; ctx.stroke();
      if (vyb && o.tvar === 'polygon') { ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.strokeRect(o.x * k, o.y * k, o.w * k, o.h * k); }
    }
    ctx.setLineDash([]);
    if ((o.zdroj !== 'rucni' || o.navrh || slabe) && (vyb || o.w * S.z >= 44)) { // popisek jen u dost velkých oblastí
      const t = (o.zdroj === 'oblicej' ? '👤' : o.zdroj === 'spz' ? '🚗' : '') + (o.navrh ? ' ' + tr('návrh?') : o.skore ? ' ' + Math.round(o.skore * 100) + ' %' : '') + (slabe ? ' ⚠️' : '');
      ctx.font = `${11 * dpr}px system-ui,sans-serif`;
      const tw = ctx.measureText(t).width + 8 * dpr, tx = o.x * k, ty = Math.max(0, o.y * k - 16 * dpr);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(tx, ty, tw, 15 * dpr);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(t, tx + 4 * dpr, ty + 7.5 * dpr);
    }
    if (vyb) {
      const u = A.uchyty(o), s = 8 * dpr;
      for (const n of A.UCHYTY) {
        ctx.fillStyle = barva('--bg'); ctx.strokeStyle = cAcc; ctx.lineWidth = 1.5 * dpr;
        ctx.fillRect(u[n][0] * k - s / 2, u[n][1] * k - s / 2, s, s); ctx.strokeRect(u[n][0] * k - s / 2, u[n][1] * k - s / 2, s, s);
      }
    }
  }
  if (novyNahled) {
    ctx.setLineDash([5 * dpr, 4 * dpr]); cestaTvaru(ctx, novyNahled, k);
    ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = cAcc; ctx.stroke(); ctx.setLineDash([]);
  }
  if (S.polygon) { // rozpracovaný mnohoúhelník
    const b = S.polygon.concat(S.polygonKurzor ? [S.polygonKurzor] : []);
    ctx.beginPath(); b.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
    ctx.lineWidth = 2.5 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
    ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = cAcc; ctx.setLineDash([5 * dpr, 4 * dpr]); ctx.stroke(); ctx.setLineDash([]);
    for (const [i, [x, y]] of S.polygon.entries()) {
      ctx.beginPath(); ctx.arc(x * k, y * k, (i ? 3 : 6) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = i ? cAcc : barva('--bg'); ctx.fill(); ctx.strokeStyle = cAcc; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
    }
  }
  if (kurzorStetce && S.nastroj === 'stetec') {
    ctx.beginPath(); ctx.arc(kurzorStetce[0] * k, kurzorStetce[1] * k, nast.stetec / 2 * dpr, 0, Math.PI * 2);
    ctx.lineWidth = 2 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke(); ctx.lineWidth = 1 * dpr; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
}

/* ---------- miniatury, panel, seznam, metadata ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pocetSlabych = f => f.oblasti.filter(o => A.aktivni(o) && A.hodnoceni(o).uroven === 'slabe').length;
function vykresliFotky() {
  const el = $('fotky');
  el.innerHTML = S.fotky.map((f, i) => {
    const n = f.oblasti.filter(A.aktivni).length, navrhy = f.oblasti.filter(o => o.navrh).length, slabe = pocetSlabych(f);
    const st = f.hledam ? '⏳ ' + tr('hledám') : (f.stazeno ? '💾 ' : '🕶️ ') + n + (navrhy ? ' · ❓' + navrhy : '') + (slabe ? ' · ⚠️' + slabe : '');
    return `<button class="fotka" data-foto="${i}" aria-current="${i === S.akt}" title="${esc(f.nazev)} (${f.W}×${f.H})">
      <img src="${f.nahled}" alt="">${f.zkontrolovano ? '<span class="ok" title="Zkontrolováno">✔</span>' : ''}<span class="stitek${f.stazeno ? ' hotovo' : ''}${navrhy || slabe ? ' varovani' : ''}">${st}</span>
      <span class="x" role="button" data-odebrat="${i}" title="Odebrat fotku" aria-label="Odebrat fotku">✕</span></button>`;
  }).join('') + '<button class="pridat-fotku" data-prikaz="pridat">➕ Přidat</button>';
}
function vykresliKontrolu() {
  const f = foto();
  $('tlZkontrolovano').setAttribute('aria-pressed', String(!!(f && f.zkontrolovano)));
}
function textBezpecnosti(o) {
  const h = A.hodnoceni(o);
  if (h.detail === Infinity) return [h.uroven, '🔒 Nevratné – obsah oblasti je zcela nahrazen.'];
  const pct = Math.round(h.podil * 100);
  if (h.uroven === 'bezpecne') return [h.uroven, `🔒 Nevratné – zaniknou detaily do ${Math.round(h.detail)} px (${pct} % oblasti): rysy obličeje i znaky.`];
  if (h.uroven === 'stredni') return [h.uroven, `⚠️ Hraniční – zaniknou detaily do ${Math.round(h.detail)} px (${pct} % oblasti). Hrubé rysy mohou zůstat, zvyšte sílu.`];
  return [h.uroven, `⛔ Slabé – zaniknou jen detaily do ${Math.round(h.detail)} px (${pct} % oblasti). Obličej nebo text může zůstat rozpoznatelný!`];
}
function vykresliPanel() {
  const o = vybrana(), zdroj = o || nast;
  $('nadpisVlastnosti').textContent = o ? tr('Vybraná oblast') : tr('Výchozí úprava nových oblastí');
  document.querySelectorAll('[data-efekt]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.efekt === zdroj.efekt)));
  $('sila').value = zdroj.sila; $('silaHodnota').textContent = zdroj.sila + ' %';
  $('radekSila').hidden = zdroj.efekt === 'cerna' || zdroj.efekt === 'emoji';
  $('radekBarva').hidden = zdroj.efekt !== 'cerna';
  $('barva').value = zdroj.barva || '#000000';
  $('emojiVyber').hidden = zdroj.efekt !== 'emoji';
  $('emojiVyber').innerHTML = EMOJI.map(e => `<button type="button" data-emoji="${e}" aria-pressed="${e === zdroj.emoji}">${e}</button>`).join('');
  $('radekTvar').hidden = !!o && (o.tvar === 'stetec' || o.tvar === 'polygon');
  $('tvar').value = o ? (o.tvar === 'elipsa' ? 'elipsa' : 'obdelnik') : nast.tvar;
  $('tvar').title = o ? tr('Tvar vybrané oblasti') : tr('Tvar oblastí z hledání obličejů');
  $('stetec').value = nast.stetec; $('stetecHodnota').textContent = nast.stetec + ' px';
  $('poznEfekt').textContent = tr(POZN_EFEKT[zdroj.efekt]);
  const [ur, txt] = textBezpecnosti(o || A.novaOblast({ ...vychozi(), w: 100, h: 100 }));
  $('bezpecnost').className = 'bezpecnost ' + ur; $('bezpecnost').textContent = txt;
}
function popisOblasti(o) {
  const tvar = { obdelnik: '▭', elipsa: '◯', stetec: '🖌️', polygon: '⬠' }[o.tvar];
  const ef = { rozmazat: '🌫️', pixely: '▦', cerna: '🎨', emoji: o.emoji, zrneni: '░' }[o.efekt];
  if (o.zdroj === 'oblicej') return `👤 ${tr('Obličej')}${o.skore ? ' ' + Math.round(o.skore * 100) + ' %' : ''}${o.navrh ? ' – ' + tr('návrh') : ''} ${ef}`;
  if (o.zdroj === 'spz') return `🚗 SPZ${o.navrh ? ' – ' + tr('návrh') : ''} ${ef}`;
  return `${tvar} ${tr({ obdelnik: 'Obdélník', elipsa: 'Elipsa', stetec: 'Štětec', polygon: 'Mnohoúhelník' }[o.tvar])} ${ef}`;
}
function vykresliSeznam() {
  const obl = oblasti();
  $('pocetOblasti').textContent = obl.length ? `(${obl.filter(A.aktivni).length} / ${obl.length})` : '';
  $('seznamOblasti').innerHTML = obl.length ? obl.map(o => {
    const h = A.hodnoceni(o), bz = h.uroven === 'slabe' ? '⛔' : h.uroven === 'stredni' ? '⚠️' : '🔒';
    return `<div class="polozka${o.navrh ? ' navrh' : ''}${o.vypnuta ? ' vyp' : ''}" data-oblast="${o.id}" aria-current="${o.id === S.vybrana}">
      <span class="jm">${popisOblasti(o)}</span><span class="bezp" title="${esc(textBezpecnosti(o)[1])}">${bz}</span>
      ${o.navrh ? `<button data-prijmout="${o.id}" title="Přijmout návrh – oblast se upraví (Enter)">✅</button>` : `<button data-prepnout="${o.id}" title="${o.vypnuta ? 'Zapnout' : 'Vypnout'} úpravu oblasti">${o.vypnuta ? '🚫' : '👁️'}</button>`}
      <button data-smazat="${o.id}" title="${o.navrh ? 'Odmítnout návrh' : 'Smazat oblast'} (Delete)">${o.navrh ? '✖' : '🗑️'}</button></div>`;
  }).join('')
    : `<p class="pozn">${S.obr ? tr('Zatím žádné oblasti. Najděte obličeje 👤 nebo táhněte myší přes fotku (nástroj ▭ ◯ ⬠ 🖌️).') : tr('Přidejte fotku.')}</p>`;
}
function vykresliMetadata() {
  const f = foto(), el = $('metadata');
  if (!f) { el.innerHTML = `<p class="pozn">${tr('Zatím není načtena žádná fotka.')}</p>`; return; }
  const m = f.meta;
  let h = `<p class="pozn">${esc(f.nazev)} · ${m.format} · ${f.W}×${f.H} px · ${mb(f.velikost)}</p>`;
  if (!m.bloky.length && !m.polozky.length) h += `<div class="stav-meta ok">${tr('Původní soubor neobsahuje EXIF ani jiná metadata.')}</div>`;
  else {
    h += `<div class="stav-meta zle"><b>${tr(m.gps ? 'Původní soubor prozrazuje i GPS polohu!' : 'Původní soubor obsahuje metadata.')}</b> ${tr('Při uložení se všechna odstraní.')}</div>`;
    if (m.bloky.length) h += '<div class="bloky" data-i18n="ne">' + m.bloky.map(b => `<span>${esc(b)}</span>`).join('') + '</div>';
    if (m.miniatura) {
      if (!f.miniUrl) f.miniUrl = URL.createObjectURL(new Blob([m.miniatura], { type: 'image/jpeg' }));
      h += `<div class="miniatura-exif"><img src="${f.miniUrl}" alt="Miniatura uložená v EXIF"><p class="pozn">⚠️ ${tr('Miniatura uložená uvnitř souboru. Často zůstane neupravená i po oříznutí nebo zakrytí v jiném programu – porovnejte ji s fotkou. Při uložení se odstraní.')}</p></div>`;
    }
    if (m.gps) h += `<p class="pozn">📍 ${tr('Místo pořízení')}: <a href="https://www.openstreetmap.org/?mlat=${m.gps.lat}&amp;mlon=${m.gps.lon}#map=16/${m.gps.lat}/${m.gps.lon}" target="_blank" rel="noopener">${m.gps.lat}, ${m.gps.lon} – ${tr('ukázat na mapě')}</a> (${tr('odkaz otevře OpenStreetMap')})</p>`;
    if (m.polozky.length) h += '<table class="meta-tab"><tbody>' + m.polozky.map(([k, v, c]) => `<tr${c ? ' class="citlive"' : ''}><td>${esc(k)}</td><td data-i18n="ne">${esc(v)}</td></tr>`).join('') + '</tbody></table>';
  }
  if (f.overeni) h += `<div class="stav-meta ok" data-i18n="ne">${esc(f.overeni)}</div>`;
  el.innerHTML = h;
}

/* ---------- úpravy oblastí, Zpět/Znovu ---------- */
const stav = () => JSON.stringify(oblasti());
function zapamatuj(s) { const f = foto(); if (f) A.hZapamatuj(f.historie, s === undefined ? stav() : s); }
function zmeneno(kresli = true) {
  const f = foto(); if (f) f.stazeno = false;
  if (kresli) vykresliVysledek();
  kresliOverlay(); vykresliSeznam(); vykresliPanel(); vykresliFotky();
  planujUlozeni();
}
function obnovZHistorie(fn) {
  const f = foto(); if (!f) return;
  const s = fn(f.historie, stav()); if (s === null) return;
  f.oblasti = JSON.parse(s);
  if (!vybrana()) S.vybrana = null;
  zmeneno();
}
const zpet = () => { if (S.polygon) { S.polygon.pop(); if (!S.polygon.length) S.polygon = null; return kresliOverlay(); } obnovZHistorie(A.hZpet); };
const znovu = () => obnovZHistorie(A.hZnovu);
function smazOblast(id) {
  const f = foto(); if (!f) return;
  zapamatuj(); f.oblasti = f.oblasti.filter(o => o.id !== id);
  if (S.vybrana === id) S.vybrana = null;
  zmeneno();
}
function prijmiOblast(id) { const o = oblasti().find(x => x.id === id); if (!o) return; zapamatuj(); o.navrh = false; zmeneno(); }
function upravVybranou(fn) {
  const o = vybrana();
  if (o) { zapamatuj(); fn(o); zmeneno(); }
  else { fn(nast); ulozNast(); vykresliPanel(); }
}
function nastavNastroj(n) {
  S.nastroj = n;
  if (n !== 'polygon') S.polygon = null;
  document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === n)));
  $('cOverlay').classList.toggle('vyber', n === 'vyber');
  if (n !== 'stetec') kurzorStetce = null;
  kresliOverlay();
}
function uzavriPolygon() {
  const b = S.polygon; S.polygon = null; S.polygonKurzor = null;
  // dvojklik přidá dva skoro stejné body – odstraň duplicity
  const ciste = (b || []).filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) * S.z > 3);
  if (ciste.length < 3) return kresliOverlay();
  zapamatuj();
  const o = A.novaOblast({ ...vychozi(), tvar: 'polygon', body: ciste });
  foto().oblasti.push(o); S.vybrana = o.id;
  zmeneno();
}

/* ---------- myš / dotyk na plátně ---------- */
const ov = $('cOverlay'), obal = $('obal');
let tah = null;
function bod(e) {
  const r = ov.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * S.obr.W, y: (e.clientY - r.top) / r.height * S.obr.H };
}
const KURZORY = { sz: 'nwse-resize', jv: 'nwse-resize', sv: 'nesw-resize', jz: 'nesw-resize', s: 'ns-resize', j: 'ns-resize', v: 'ew-resize', z: 'ew-resize' };
// posun plochy: prostřední tlačítko nebo mezerník + tažení
let posunPlochy = null;
obal.addEventListener('pointerdown', e => {
  if (!S.obr || !(e.button === 1 || S.mezernik)) return;
  e.preventDefault(); e.stopPropagation();
  posunPlochy = { x: e.clientX, y: e.clientY, sl: obal.scrollLeft, st: obal.scrollTop };
  try { obal.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
}, true);
obal.addEventListener('pointermove', e => {
  if (!posunPlochy) return;
  obal.scrollLeft = posunPlochy.sl - (e.clientX - posunPlochy.x); obal.scrollTop = posunPlochy.st - (e.clientY - posunPlochy.y);
});
const konecPosunu = () => { posunPlochy = null; };
obal.addEventListener('pointerup', konecPosunu); obal.addEventListener('pointercancel', konecPosunu);
obal.addEventListener('wheel', e => {
  if (!S.obr || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault(); zoomKrok(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
}, { passive: false });

ov.addEventListener('pointerdown', e => {
  if (!S.obr || e.button > 0 || posunPlochy) return;
  e.preventDefault(); try { ov.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
  const p = bod(e), tol = 9 / S.z, sel = vybrana();
  if (S.nastroj === 'polygon' && S.polygon) {
    const [fx, fy] = S.polygon[0];
    if (S.polygon.length >= 3 && Math.hypot(p.x - fx, p.y - fy) * S.z < 10) return uzavriPolygon();
    S.polygon.push([p.x, p.y]); return kresliOverlay();
  }
  if (S.nastroj === 'stetec') {
    zapamatuj();
    const o = A.novaOblast({ ...vychozi(), tvar: 'stetec', body: [[p.x, p.y]], r: nast.stetec / 2 / S.z });
    foto().oblasti.push(o); S.vybrana = o.id; tah = { druh: 'stetec', o };
    return zmeneno(false);
  }
  const u = sel && A.najdiUchyt(sel, p.x, p.y, tol);
  if (u) { tah = { druh: 'uchyt', o: sel, u, r0: { x: sel.x, y: sel.y, w: sel.w, h: sel.h }, p0: p, stav: stav(), pohnuto: false }; return; }
  const h = A.najdiOblast(oblasti(), p.x, p.y);
  if (h) { S.vybrana = h.id; tah = { druh: 'posun', o: h, r0: { x: h.x, y: h.y, w: h.w, h: h.h }, p0: p, stav: stav(), pohnuto: false }; return zmeneno(false); }
  if (S.nastroj === 'obdelnik' || S.nastroj === 'elipsa') { tah = { druh: 'novy', p0: p }; return; }
  if (S.nastroj === 'polygon') { S.vybrana = null; S.polygon = [[p.x, p.y]]; return zmeneno(false); }
  if (S.vybrana) { S.vybrana = null; zmeneno(false); }
});
ov.addEventListener('dblclick', e => { if (S.polygon) { e.preventDefault(); uzavriPolygon(); } });
ov.addEventListener('pointermove', e => {
  if (!S.obr || posunPlochy) return;
  const p = bod(e);
  if (S.nastroj === 'stetec') { kurzorStetce = [p.x, p.y]; if (!tah) kresliOverlay(); }
  if (S.polygon) { S.polygonKurzor = [p.x, p.y]; kresliOverlay(); return; }
  if (!tah) {
    const sel = vybrana(), u = sel && A.najdiUchyt(sel, p.x, p.y, 9 / S.z);
    ov.style.cursor = u ? KURZORY[u] : (S.nastroj !== 'stetec' && A.najdiOblast(oblasti(), p.x, p.y)) ? 'move' : '';
    return;
  }
  if (tah.druh === 'stetec') {
    const b = tah.o.body, posl = b[b.length - 1];
    if (Math.hypot(p.x - posl[0], p.y - posl[1]) > tah.o.r / 3) { b.push([p.x, p.y]); A.prepocitejStetec(tah.o); }
  } else if (tah.druh === 'novy') {
    const r = A.normObdelnik(tah.p0.x, tah.p0.y, p.x, p.y);
    if (e.shiftKey) { const m = Math.max(r.w, r.h); r.w = r.h = m; if (p.x < tah.p0.x) r.x = tah.p0.x - m; if (p.y < tah.p0.y) r.y = tah.p0.y - m; }
    novyNahled = { ...r, tvar: S.nastroj };
  } else {
    const dx = p.x - tah.p0.x, dy = p.y - tah.p0.y;
    if (!tah.pohnuto && Math.hypot(dx, dy) * S.z > 2) { tah.pohnuto = true; zapamatuj(tah.stav); }
    if (!tah.pohnuto) return;
    if (tah.druh === 'posun') A.nastavObdelnik(tah.o, { ...tah.r0, x: tah.r0.x + dx, y: tah.r0.y + dy });
    else A.nastavObdelnik(tah.o, A.tahUchytem(tah.r0, tah.u, dx, dy, 4 / S.z));
  }
  if (S.casVykresleni < 45 && tah.druh !== 'novy') planujVysledek();
  kresliOverlay();
});
function konecTahu() {
  if (!tah) return;
  const t = tah; tah = null;
  if (t.druh === 'novy') {
    const n = novyNahled; novyNahled = null;
    if (n && n.w * S.z >= 4 && n.h * S.z >= 4) {
      zapamatuj();
      const o = A.novaOblast({ ...vychozi(), ...n });
      foto().oblasti.push(o); S.vybrana = o.id;
      return zmeneno();
    }
    return kresliOverlay();
  }
  if ((t.druh === 'posun' || t.druh === 'uchyt') && !t.pohnuto) return;
  zmeneno();
}
ov.addEventListener('pointerup', konecTahu);
ov.addEventListener('pointercancel', konecTahu);
ov.addEventListener('pointerleave', () => { if (kurzorStetce && !tah) { kurzorStetce = null; kresliOverlay(); } });

/* ---------- detekce ---------- */
async function stahni(url, prubeh) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
  const celkem = +r.headers.get('content-length') || 0;
  if (!r.body || !celkem) return new Uint8Array(await r.arrayBuffer());
  const cteni = r.body.getReader(), kusy = []; let n = 0;
  for (;;) { const { done, value } = await cteni.read(); if (done) break; kusy.push(value); n += value.length; prubeh(n / celkem); }
  const ven = new Uint8Array(n); let o = 0;
  for (const k of kusy) { ven.set(k, o); o += k.length; }
  return ven;
}
function nactiSkript(src) {
  return new Promise((ok, chyba) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = () => chyba(new Error('Nepodařilo se načíst ' + src)); document.head.appendChild(s);
  });
}
async function pripravAi(ukazPrubeh = prace) {
  if (S.ai) return S.ai;
  ukazPrubeh(tr('Načítám model pro hledání obličejů…'), 0);
  if (!window.ort) await nactiSkript(ONNX + 'ort.wasm.min.js');
  let a = 0, b = 0;
  const ukaz = () => ukazPrubeh(tr('Načítám model pro hledání obličejů (jen poprvé, ~12 MB)…'), a * 0.9 + b * 0.1);
  const [wasm, model] = await Promise.all([
    stahni(ONNX + 'ort-wasm-simd-threaded.wasm', x => { a = x; ukaz(); }),
    stahni(MODEL, x => { b = x; ukaz(); }),
  ]);
  ort.env.logLevel = 'error';
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = new URL(ONNX, location.href).href;
  ort.env.wasm.wasmBinary = wasm.buffer;
  S.ai = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], logSeverityLevel: 3 });
  return S.ai;
}
/** Obličeje v obrazu { W, H, data } → sloučené boxy v pixelech. dlazdice = false jen celý obraz (rychle, pro video). */
async function detekujObliceje(obr, prah, prubeh, dlazdice = true) {
  const ses = await pripravAi(), plan = dlazdice ? A.planDlazdic(obr.W, obr.H) : [{ x: 0, y: 0, w: obr.W, h: obr.H }];
  let boxy = [];
  for (let i = 0; i < plan.length; i++) {
    if (prubeh) prubeh(i / plan.length);
    const d = plan[i];
    const t = new ort.Tensor('float32', A.tenzorUltraFace(A.vyrezNa(obr.data, obr.W, obr.H, d, A.UF_W, A.UF_H)), [1, 3, A.UF_H, A.UF_W]);
    const v = await ses.run({ [ses.inputNames[0]]: t });
    boxy = boxy.concat(A.dekodujUltraFace(v.scores.data, v.boxes.data, prah).map(b => A.naObraz(b, d)));
  }
  return A.slucDetekce(boxy);
}
/** Najde obličeje ve fotce a přidá je jako oblasti (bez duplicit s už nalezenými). */
async function najdiObliceje(f, obr, popis) {
  const boxy = await detekujObliceje(obr, +nast.citlivost, x => prace(`${popis}${tr('hledám obličeje…')} ${Math.round(x * 100)} %`, x));
  let nove = 0;
  for (const b of boxy) {
    const o = A.oblastZObliceje(b, obr.W, obr.H, 0.18, { ...vychozi(), tvar: nast.tvar, navrh: !!nast.navrhyObliceju });
    if (f.oblasti.some(k => A.iou(obdelnikBox(k), obdelnikBox(o)) > 0.4)) continue;
    f.oblasti.push(o); nove++;
  }
  return nove;
}
function najdiSpz(f, obr) {
  const k = Math.min(1, 1000 / Math.max(obr.W, obr.H)), w = Math.max(1, Math.round(obr.W * k)), h = Math.max(1, Math.round(obr.H * k));
  const g = A.sedotisk(A.vyrezNa(obr.data, obr.W, obr.H, { x: 0, y: 0, w: obr.W, h: obr.H }, w, h), w, h);
  let nove = 0;
  for (const c of A.hledejSpz(g, w, h)) {
    const r = { x: c.x / k, y: c.y / k, w: c.w / k, h: c.h / k };
    if (f.oblasti.some(o => A.iou(obdelnikBox(o), obdelnikBox(r)) > 0.3)) continue;
    f.oblasti.push(A.novaOblast({ ...vychozi(), efekt: nast.spzEfekt, sila: Math.max(nast.sila, 70), tvar: 'obdelnik', ...r, zdroj: 'spz', skore: c.skore, navrh: true }));
    nove++;
  }
  return nove;
}
/** Hledání v jedné fotce: obličeje a/nebo SPZ. */
async function hledej(f, coHledat, popis = '') {
  const jeAkt = f === foto();
  const obr = jeAkt && S.obr ? S.obr : await dekoduj(f);
  const pred = JSON.stringify(f.oblasti);
  f.hledam = true; vykresliFotky();
  let o = 0, s = 0;
  try {
    if (coHledat.spz) s = najdiSpz(f, obr);
    if (coHledat.obliceje) o = await najdiObliceje(f, obr, popis);
    if (coHledat.obliceje && coHledat.spz) f.hledano = true;
  } finally { f.hledam = false; }
  if (o || s) { f.stazeno = false; A.hZapamatuj(f.historie, pred); }
  if (f === foto()) zmeneno(); else { vykresliFotky(); planujUlozeni(); }
  return { o, s };
}
function hledejVe(fotky, coHledat = { obliceje: true, spz: true }) {
  return vePoradi(async () => {
    let o = 0, s = 0;
    try {
      for (let i = 0; i < fotky.length; i++) {
        if (!S.fotky.includes(fotky[i])) continue;
        const r = await hledej(fotky[i], coHledat, fotky.length > 1 ? `${tr('Fotka')} ${i + 1} / ${fotky.length}: ` : '');
        o += r.o; s += r.s;
      }
    } catch (e) { console.error(e); prace(null); return Dialog.chyba(tr('Hledání selhalo: ') + e.message); }
    prace(null);
    const t = [coHledat.obliceje ? `👤 ${tr('Nalezené obličeje')}: ${o}` : '', coHledat.spz ? `🚗 ${tr('Návrhy SPZ')}: ${s}` : ''].filter(Boolean).join(' · ');
    oznam(t + ' · ⚠️ ' + tr('Automatika může něco přehlédnout – projděte fotky.'));
  });
}
let casOznam = 0;
function oznam(t) {
  prace(t, 1); $('praceProuzek').parentNode.hidden = true;
  clearTimeout(casOznam);
  casOznam = setTimeout(() => { $('praceProuzek').parentNode.hidden = false; prace(null); }, 4500);
}

/* ---------- uložení ---------- */
function toBlob(c, typ, q) { return new Promise((ok, chyba) => c.toBlob(b => (b ? ok(b) : chyba(new Error('Prohlížeč nevytvořil obrázek'))), typ, q)); }
const FORMAT_ORIG = { JPEG: 'image/jpeg', PNG: 'image/png', WebP: 'image/webp' };
const cilovyFormat = f => (nast.format === 'orig' ? FORMAT_ORIG[f.meta.format] || 'image/png' : nast.format);
/** Bezeztrátové očištění, když fotka nemá co upravit (JPEG bez otočení, PNG) – jinak null. */
async function zkusBezeztrat(f, typ) {
  if (!nast.bezeztrat || f.oblasti.some(A.aktivni)) return null;
  if (+nast.maxStrana && Math.max(f.W, f.H) > +nast.maxStrana) return null;
  const buf = await f.soubor.arrayBuffer();
  let d = null;
  if (f.meta.format === 'JPEG' && typ === 'image/jpeg' && f.meta.orientace === 1) d = A.ocistiJpeg(buf, { icc: nast.icc });
  else if (f.meta.format === 'PNG' && typ === 'image/png') d = A.ocistiPng(buf, { icc: nast.icc });
  return d ? new Blob([d], { type: typ }) : null;
}
async function vystup(f) {
  const typ = cilovyFormat(f);
  let blob = await zkusBezeztrat(f, typ), sirka = f.W, vyska = f.H;
  f.bezeztrat = !!blob;
  if (!blob) {
    const obr = f === foto() && S.obr ? S.obr : await dekoduj(f);
    const c = document.createElement('canvas'); c.width = obr.W; c.height = obr.H;
    vykresliDo(c.getContext('2d'), obr, f.oblasti, 1);
    let cil = c;
    const max = +nast.maxStrana;
    if (max && Math.max(obr.W, obr.H) > max) {
      const k = max / Math.max(obr.W, obr.H);
      cil = document.createElement('canvas'); cil.width = Math.round(obr.W * k); cil.height = Math.round(obr.H * k);
      const cx = cil.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(c, 0, 0, cil.width, cil.height);
    }
    if (typ === 'image/jpeg') { // JPEG nezná průhlednost – podklad bílý
      const b = document.createElement('canvas'); b.width = cil.width; b.height = cil.height;
      const bx = b.getContext('2d'); bx.fillStyle = '#fff'; bx.fillRect(0, 0, b.width, b.height); bx.drawImage(cil, 0, 0); cil = b;
    }
    blob = await toBlob(cil, typ, +nast.kvalita);
    sirka = cil.width; vyska = cil.height;
  }
  // ověření: přečti výsledný soubor a zkontroluj, že v něm nic nezůstalo
  const m = A.ctiMetadata(await blob.arrayBuffer());
  const typTxt = (blob.type || typ).replace('image/', '').toUpperCase().replace('JPEG', 'JPG');
  const zbylo = m.bloky.filter(b => b !== 'Barevný profil ICC'); // obecný profil sRGB přidává sám prohlížeč – nic neprozradí
  f.overeni = (m.polozky.length || zbylo.length ? '⚠️ ' + tr('Uložený soubor obsahuje: ') + zbylo.join(', ') : '✓ ' + tr('Uložený soubor ověřen: žádná metadata (EXIF, GPS…) v něm nejsou.'))
    + ` (${typTxt}, ${sirka}×${vyska}, ${mb(blob.size)}${f.bezeztrat ? ', ' + tr('bez překódování') : ''})`;
  f.vystupNazev = A.nazevVystupu(f.nazev, blob.type || typ, nast.pripona);
  return blob;
}
function stahniBlob(blob, nazev) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
async function kontrolaPredUlozenim(fotky) {
  const navrhy = fotky.reduce((n, f) => n + f.oblasti.filter(o => o.navrh).length, 0);
  const nehledano = fotky.filter(f => !f.hledano && !f.oblasti.length).length;
  const slabe = fotky.reduce((n, f) => n + pocetSlabych(f), 0);
  const nezk = fotky.filter(f => !f.zkontrolovano).length;
  const duvody = [];
  if (navrhy) duvody.push(`${navrhy} ${tr('nepotvrzených návrhů se NEupraví (přijměte je ✅ nebo odmítněte).')}`);
  if (slabe) duvody.push(`${slabe} ${tr('oblastí má slabý efekt – obsah může zůstat rozpoznatelný.')}`);
  if (nehledano) duvody.push(`${tr('Fotek bez upravené oblasti')}: ${nehledano} – ${tr('uloží se jen bez metadat.')}`);
  if (nezk && fotky.length > 1) duvody.push(`${tr('Neoznačených jako zkontrolované')}: ${nezk} / ${fotky.length}.`);
  if (!duvody.length) return true;
  return Dialog.potvrd(duvody.join('\n') + '\n\n' + tr('Přesto uložit?'));
}
async function stahnout() {
  const f = foto(); if (!f) return Dialog.info(tr('Nejdřív přidejte fotku.'));
  if (!(await kontrolaPredUlozenim([f]))) return;
  await vePoradi(async () => {
    try {
      prace(tr('Ukládám…'), 0.5); await chvilka();
      const b = await vystup(f);
      stahniBlob(b, f.vystupNazev);
      f.stazeno = true;
    } catch (e) { Dialog.chyba(tr('Uložení selhalo: ') + e.message); }
    prace(null); vykresliFotky(); vykresliMetadata();
  });
}
const zaznamy = fotky => fotky.map(f => ({ nazev: f.nazev, vystup: f.vystupNazev || A.nazevVystupu(f.nazev, cilovyFormat(f), nast.pripona), meta: f.meta,
  W: f.W, H: f.H, oblasti: f.oblasti, overeni: f.overeni, bezeztrat: !!f.bezeztrat, zkontrolovano: !!f.zkontrolovano }));
async function stahnoutVse() {
  if (!S.fotky.length) return Dialog.info(tr('Nejdřív přidejte fotky.'));
  if (!(await kontrolaPredUlozenim(S.fotky))) return;
  await vePoradi(async () => {
    try {
      const soubory = [];
      for (let i = 0; i < S.fotky.length; i++) {
        const f = S.fotky[i];
        prace(`${tr('Zpracovávám')} ${i + 1} / ${S.fotky.length}: ${f.nazev}`, i / S.fotky.length); await chvilka();
        const b = await vystup(f);
        soubory.push({ nazev: f.vystupNazev, data: new Uint8Array(await b.arrayBuffer()) });
        f.stazeno = true;
      }
      const jm = A.unikatniNazvy(soubory.map(s => s.nazev));
      soubory.forEach((s, i) => { s.nazev = jm[i]; S.fotky[i].vystupNazev = jm[i]; });
      if (nast.protokol) {
        const enc = new TextEncoder(), z = zaznamy(S.fotky);
        soubory.push({ nazev: 'protokol_anonymizace.txt', data: enc.encode(A.protokolText(z)) }, { nazev: 'protokol_anonymizace.csv', data: enc.encode(A.protokolCsv(z)) });
      }
      prace(tr('Balím ZIP…'), 1); await chvilka();
      stahniBlob(new Blob([A.zip(soubory)], { type: 'application/zip' }), 'anonymizovane_fotky.zip');
    } catch (e) { console.error(e); Dialog.chyba(tr('Uložení selhalo: ') + e.message); }
    prace(null); vykresliFotky(); vykresliMetadata();
  });
}
function stahniProtokol(csv) {
  if (!S.fotky.length) return Dialog.info(tr('Nejdřív přidejte fotky.'));
  const z = zaznamy(S.fotky);
  stahniBlob(new Blob([csv ? A.protokolCsv(z) : A.protokolText(z)], { type: csv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }), 'protokol_anonymizace.' + (csv ? 'csv' : 'txt'));
}

/* ---------- kontrola dávky ---------- */
function prejdi(smer) { if (!S.fotky.length) return; const i = Math.min(S.fotky.length - 1, Math.max(0, S.akt + smer)); if (i !== S.akt) vePoradi(() => vyber(i)); }
function prepniZkontrolovano() {
  const f = foto(); if (!f) return;
  f.zkontrolovano = !f.zkontrolovano;
  vykresliKontrolu(); vykresliFotky(); planujUlozeni();
  if (f.zkontrolovano) {
    const dalsi = S.fotky.findIndex((g, i) => i > S.akt && !g.zkontrolovano);
    if (dalsi >= 0) vePoradi(() => vyber(dalsi));
    else if (S.fotky.every(g => g.zkontrolovano)) oznam('✔ ' + tr('Všechny fotky jsou zkontrolované.'));
  }
}
function vykresliPrehled() {
  const F = S.fotky, akt = F.reduce((n, f) => n + f.oblasti.filter(A.aktivni).length, 0);
  const navrhy = F.reduce((n, f) => n + f.oblasti.filter(o => o.navrh).length, 0), slabe = F.reduce((n, f) => n + pocetSlabych(f), 0);
  $('souhrnDavky').innerHTML = `<span>${tr('Fotek')}: <b>${F.length}</b></span><span>${tr('Zkontrolováno')}: <b>${F.filter(f => f.zkontrolovano).length}</b></span>`
    + `<span>${tr('Upravených oblastí')}: <b>${akt}</b></span><span>${tr('Nepotvrzené návrhy')}: <b>${navrhy}</b></span><span>${tr('Slabé efekty')}: <b>${slabe}</b></span>`
    + `<span>${tr('S GPS')}: <b>${F.filter(f => f.meta.gps).length}</b></span><span>${tr('S miniaturou v EXIF')}: <b>${F.filter(f => f.meta.miniatura).length}</b></span>`;
  $('prehledTelo').innerHTML = F.length ? F.map((f, i) => `<tr data-foto="${i}" data-zavrit="1">
    <td><img src="${f.nahled}" alt=""></td><td>${esc(f.nazev)}<br><span class="pozn">${f.W}×${f.H}${f.stazeno ? ' · 💾' : ''}</span></td>
    <td>${f.oblasti.filter(A.aktivni).length}</td><td>${f.oblasti.filter(o => o.navrh).length || '–'}</td><td>${pocetSlabych(f) || '–'}</td>
    <td>${f.meta.gps ? '📍 GPS ' : ''}${f.meta.miniatura ? '🖼️ ' : ''}${f.meta.bloky.length ? f.meta.bloky.length + '×' : '–'}</td>
    <td><input type="checkbox" data-zkontrolovano="${i}" ${f.zkontrolovano ? 'checked' : ''} aria-label="Zkontrolováno"></td></tr>`).join('')
    : `<tr><td colspan="7" class="pozn">${tr('Zatím žádné fotky.')}</td></tr>`;
}

/* ---------- šablony ---------- */
function vlastniSablony() { try { return JSON.parse(localStorage.getItem(KLIC_SAB)) || []; } catch (e) { return []; } }
function ulozVlastniSablony(s) { try { localStorage.setItem(KLIC_SAB, JSON.stringify(s)); } catch (e) { Dialog.chyba(tr('Šablonu se nepodařilo uložit.')); } }
function vykresliSablony() {
  const v = vlastniSablony();
  $('seznamSablon').innerHTML = A.SABLONY.map(s => `<button class="tl" data-sablona="${s.id}" title="${esc(s.popis)}">${esc(s.nazev)}</button>`).join('')
    + (v.length ? '<hr>' + v.map(s => `<button class="tl" data-sablona="${esc(s.id)}" data-i18n="ne">🧩 ${esc(s.nazev)}<span class="x-sab" data-smazat-sablonu="${esc(s.id)}" title="Smazat šablonu">✕</span></button>`).join('') : '');
}
function pouzijSablonu(id) {
  const s = A.SABLONY.find(x => x.id === id) || vlastniSablony().find(x => x.id === id);
  if (!s) return;
  Object.assign(nast, A.cistaNastaveni(s.nast)); ulozNast(); nastavOvladace(); vykresliPanel();
  oznam('🧩 ' + tr('Šablona použita') + ': ' + s.nazev);
}
async function ulozSablonu() {
  const n = await Dialog.zeptej(tr('Název šablony'), tr('Moje nastavení'));
  if (!n || !n.trim()) return;
  const v = vlastniSablony().filter(s => s.nazev !== n.trim());
  v.push({ id: 'v' + Date.now().toString(36), nazev: n.trim(), nast: A.cistaNastaveni(nast) });
  ulozVlastniSablony(v);
}

/* ---------- export / import oblastí ---------- */
function exportOblasti() {
  if (!S.fotky.length) return Dialog.info(tr('Nejdřív přidejte fotky.'));
  stahniBlob(new Blob([JSON.stringify(A.exportOblasti(S.fotky), null, 1)], { type: 'application/json' }), 'anonymizace_oblasti.json');
}
async function importOblasti(soubor) {
  try {
    const data = JSON.parse(await soubor.text());
    const pridat = S.fotky.some(f => f.oblasti.length) ? await Dialog.potvrd(tr('Přidat importované oblasti k existujícím? (Zrušit = nahradit je)')) : false;
    S.fotky.forEach(f => A.hZapamatuj(f.historie, JSON.stringify(f.oblasti)));
    const r = A.importOblasti(data, S.fotky, pridat);
    S.vybrana = null; zmeneno(); vykresliKontrolu();
    Dialog.info(`${tr('Importováno')}: ${r.oblasti} ${tr('oblastí do')} ${r.fotek} ${tr('fotek.')}` + (r.nenalezene.length ? '\n' + tr('Fotky nenalezené podle názvu') + ': ' + r.nenalezene.join(', ') : ''));
  } catch (e) { Dialog.chyba(tr('Import selhal: ') + e.message); }
}

/* ---------- uložení rozpracované práce (IndexedDB, jen když je zapnuto) ---------- */
function otevriDb() {
  return new Promise((ok, chyba) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sezeni');
    r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
  });
}
async function dbOp(rezim, fn) {
  const d = await otevriDb();
  return new Promise((ok, chyba) => {
    const t = d.transaction('sezeni', rezim), r = fn(t.objectStore('sezeni'));
    t.oncomplete = () => { d.close(); ok(r && r.result); };
    t.onerror = () => { d.close(); chyba(t.error); };
  });
}
const ulozFotku = f => dbOp('readwrite', st => st.put(f.soubor, 'f:' + f.id)).catch(e => console.warn('IndexedDB', e));
const smazFotkuDb = f => { if (nast.ukladat) dbOp('readwrite', st => st.delete('f:' + f.id)).catch(() => {}); };
let casUlozeni = 0;
function planujUlozeni() {
  if (!nast.ukladat) return;
  clearTimeout(casUlozeni);
  casUlozeni = setTimeout(() => dbOp('readwrite', st => st.put({ ulozeno: Date.now(), akt: S.akt,
    fotky: S.fotky.map(f => ({ id: f.id, nazev: f.nazev, typ: f.typ, oblasti: f.oblasti, zkontrolovano: f.zkontrolovano, hledano: f.hledano })) }, 'index')).catch(e => console.warn('IndexedDB', e)), 800);
}
async function smazUlozene() { try { await dbOp('readwrite', st => st.clear()); } catch (e) { /* nic uloženo */ } }
async function obnovUlozene() {
  let idx;
  try { idx = await dbOp('readonly', st => st.get('index')); } catch (e) { return; }
  if (!idx || !idx.fotky || !idx.fotky.length) return;
  if (!(await Dialog.potvrd(`${tr('Obnovit rozpracovanou práci')}: ${idx.fotky.length} ${tr('fotek')} (${new Date(idx.ulozeno).toLocaleString()})?`))) return;
  const soubory = [], data = [];
  for (const z of idx.fotky) {
    const b = await dbOp('readonly', st => st.get('f:' + z.id)).catch(() => null);
    if (b) { soubory.push(b instanceof File ? b : new File([b], z.nazev, { type: z.typ || b.type })); data.push(z); }
  }
  const nove = await pridejSoubory(soubory, { bezHledani: true });
  nove.forEach((f, i) => {
    const z = data[i];
    f.id = z.id; f.oblasti = (z.oblasti || []).map(o => A.novaOblast(o)); f.zkontrolovano = !!z.zkontrolovano; f.hledano = !!z.hledano;
  });
  await vyber(Math.min(Math.max(0, idx.akt), S.fotky.length - 1));
}

/* ---------- příkazy, nabídky, události ---------- */
function nastavNaVse(fotky) {
  const z = vybrana() || nast;
  for (const f of fotky) {
    A.hZapamatuj(f.historie, JSON.stringify(f.oblasti));
    for (const o of f.oblasti) { o.efekt = z.efekt; o.sila = z.sila; o.emoji = z.emoji; o.barva = z.barva; }
    if (f.oblasti.length) f.stazeno = false;
  }
  zmeneno();
}
const prepniVideo = () => { if (window.ANON_VIDEO) window.ANON_VIDEO.prepni(); };
const PRIKAZY = {
  pridat: () => $('vstupSoubory').click(),
  odebrat: () => { if (S.akt >= 0) odeber(S.akt); },
  odebratVse: async () => { if (S.fotky.length && await Dialog.potvrd(tr('Odebrat všechny fotky ze stránky? Neuložené úpravy se ztratí.'))) { S.fotky.forEach(smazFotkuDb); S.fotky = []; planujUlozeni(); vyber(-1); } },
  obliceje: () => (foto() ? hledejVe([foto()], { obliceje: true }) : Dialog.info(tr('Nejdřív přidejte fotku.'))),
  spz: () => (foto() ? hledejVe([foto()], { spz: true }) : Dialog.info(tr('Nejdřív přidejte fotku.'))),
  vseVsude: () => (S.fotky.length ? hledejVe(S.fotky.slice()) : Dialog.info(tr('Nejdřív přidejte fotky.'))),
  prijmout: () => { if (!foto()) return; zapamatuj(); foto().oblasti.forEach(o => { o.navrh = false; }); zmeneno(); },
  odmitnout: () => { if (!foto()) return; zapamatuj(); foto().oblasti = foto().oblasti.filter(o => !o.navrh); S.vybrana = vybrana() ? S.vybrana : null; zmeneno(); },
  smazatAuto: () => { if (!foto()) return; zapamatuj(); foto().oblasti = foto().oblasti.filter(o => o.zdroj === 'rucni'); S.vybrana = null; zmeneno(); },
  smazatVse: () => { if (!foto()) return; zapamatuj(); foto().oblasti = []; S.vybrana = null; zmeneno(); },
  zpet, znovu,
  smazat: () => { if (S.vybrana) smazOblast(S.vybrana); },
  porovnat: () => {
    S.porovnat = !S.porovnat; $('tlPorovnat').setAttribute('aria-pressed', String(S.porovnat));
    $('cOrig').hidden = !S.porovnat; $('porovnani').hidden = !S.porovnat || !S.obr;
  },
  priblizit: () => zoomKrok(1), oddalit: () => zoomKrok(-1),
  predchozi: () => prejdi(-1), dalsi: () => prejdi(1), zkontrolovano: prepniZkontrolovano,
  prehled: () => { vykresliPrehled(); $('dlgPrehled').showModal(); },
  vseZkontrolovano: () => { S.fotky.forEach(f => { f.zkontrolovano = true; }); vykresliPrehled(); vykresliFotky(); vykresliKontrolu(); planujUlozeni(); },
  stahnout, stahnoutVse,
  protokolTxt: () => stahniProtokol(false), protokolCsv: () => stahniProtokol(true),
  exportOblasti, importOblasti: () => $('vstupJson').click(),
  smazatUlozene: async () => { if (await Dialog.potvrd(tr('Smazat rozpracovanou práci uloženou v tomto prohlížeči?'))) { await smazUlozene(); if (nast.ukladat) { for (const f of S.fotky) await ulozFotku(f); planujUlozeni(); } } },
  ulozSablonu,
  naVseOblasti: () => nastavNaVse(foto() ? [foto()] : []),
  naVseFotky: () => nastavNaVse(S.fotky),
  video: prepniVideo,
  napoveda: () => $('dlgNapoveda').showModal(),
};
function zavriNabidky() {
  document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
  document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  const n = $(b.dataset.nabidka), bylo = !n.hidden;
  zavriNabidky();
  if (bylo) return;
  if (n.id === 'nabSablony') vykresliSablony();
  n.hidden = false; b.setAttribute('aria-expanded', 'true');
  const r = b.getBoundingClientRect();
  n.style.top = (r.bottom + 4) + 'px';
  n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
}));
document.addEventListener('click', e => {
  const t = e.target;
  const ss = t.closest('[data-smazat-sablonu]');
  if (ss) { e.stopPropagation(); ulozVlastniSablony(vlastniSablony().filter(s => s.id !== ss.dataset.smazatSablonu)); return vykresliSablony(); }
  const sb = t.closest('[data-sablona]');
  if (sb) { zavriNabidky(); return pouzijSablonu(sb.dataset.sablona); }
  const p = t.closest('[data-prikaz]');
  if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
  if (!t.closest('.nabidka')) zavriNabidky();
  const zk = t.closest('[data-zkontrolovano]');
  if (zk) { const f = S.fotky[+zk.dataset.zkontrolovano]; f.zkontrolovano = zk.checked; vykresliFotky(); vykresliKontrolu(); planujUlozeni(); return vykresliPrehled(); }
  const od = t.closest('[data-odebrat]');
  if (od) { e.stopPropagation(); return odeber(+od.dataset.odebrat); }
  const fo = t.closest('[data-foto]');
  if (fo) {
    const i = +fo.dataset.foto;
    if (fo.dataset.zavrit) $('dlgPrehled').close();
    if (i !== S.akt) vePoradi(() => vyber(i)); return;
  }
  const n = t.closest('[data-nastroj]');
  if (n) return nastavNastroj(n.dataset.nastroj);
  const ef = t.closest('[data-efekt]');
  if (ef) return upravVybranou(o => { o.efekt = ef.dataset.efekt; });
  const em = t.closest('[data-emoji]');
  if (em) return upravVybranou(o => { o.emoji = em.dataset.emoji; });
  const pj = t.closest('[data-prijmout]');
  if (pj) return prijmiOblast(pj.dataset.prijmout);
  const pr = t.closest('[data-prepnout]');
  if (pr) { zapamatuj(); const o = oblasti().find(x => x.id === pr.dataset.prepnout); o.vypnuta = !o.vypnuta; return zmeneno(); }
  const sm = t.closest('[data-smazat]');
  if (sm) return smazOblast(sm.dataset.smazat);
  const ob = t.closest('[data-oblast]');
  if (ob) { S.vybrana = ob.dataset.oblast; zmeneno(false); }
});
// síla a barva: jeden krok Zpět za celý tah posuvníkem
let posuvnikZapamatovan = false;
function zivaZmena(fn) {
  const o = vybrana();
  if (o) { if (!posuvnikZapamatovan) { zapamatuj(); posuvnikZapamatovan = true; } fn(o); foto().stazeno = false; planujVysledek(); kresliOverlay(); vykresliSeznam(); }
  else { fn(nast); ulozNast(); }
  const [ur, txt] = textBezpecnosti(o || A.novaOblast({ ...vychozi(), w: 100, h: 100 }));
  $('bezpecnost').className = 'bezpecnost ' + ur; $('bezpecnost').textContent = txt;
}
const konecZmeny = () => { posuvnikZapamatovan = false; vykresliFotky(); planujUlozeni(); };
$('sila').addEventListener('input', () => { const v = +$('sila').value; $('silaHodnota').textContent = v + ' %'; zivaZmena(o => { o.sila = v; }); });
$('sila').addEventListener('change', konecZmeny);
$('barva').addEventListener('input', () => zivaZmena(o => { o.barva = $('barva').value; }));
$('barva').addEventListener('change', konecZmeny);
$('tvar').addEventListener('change', () => upravVybranou(o => { o.tvar = $('tvar').value; }));
$('stetec').addEventListener('input', () => { nast.stetec = +$('stetec').value; $('stetecHodnota').textContent = nast.stetec + ' px'; ulozNast(); });
$('zoom').addEventListener('change', () => { const v = $('zoom').value; if (v === 'vlastni') return; S.zoom = v === 'fit' ? 'fit' : +v; nastavScenu(); });
const VOLBY = ['format', 'kvalita', 'maxStrana', 'pripona', 'citlivost', 'spzEfekt'], ZASKRTAVACI = ['auto', 'navrhyObliceju', 'protokol', 'bezeztrat', 'icc'];
function nastavOvladace() {
  for (const id of VOLBY) $(id).value = nast[id];
  for (const id of ZASKRTAVACI) $(id).checked = !!nast[id];
  $('ukladat').checked = !!nast.ukladat;
  $('kvalita').disabled = nast.format === 'image/png';
  $('citlivostHodnota').textContent = Math.round(nast.citlivost * 100) + ' %';
}
for (const id of VOLBY) $(id).addEventListener(id === 'citlivost' ? 'input' : 'change', () => { nast[id] = $(id).value.trim(); ulozNast(); nastavOvladace(); });
for (const id of ZASKRTAVACI) $(id).addEventListener('change', () => { nast[id] = $(id).checked; ulozNast(); });
$('ukladat').addEventListener('change', async () => {
  nast.ukladat = $('ukladat').checked; ulozNast();
  if (nast.ukladat) { for (const f of S.fotky) await ulozFotku(f); planujUlozeni(); oznam('💽 ' + tr('Rozpracovaná práce se ukládá v tomto prohlížeči.')); }
  else { await smazUlozene(); oznam(tr('Uložená práce smazána, dál se neukládá.')); }
});
nastavOvladace();
$('vstupSoubory').addEventListener('change', e => { pridejSoubory(e.target.files); e.target.value = ''; });
$('vstupJson').addEventListener('change', e => { if (e.target.files[0]) importOblasti(e.target.files[0]); e.target.value = ''; });

// přetažení a vložení
let pocitadloDrag = 0;
const videoAktivni = () => !$('video').hidden;
addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { pocitadloDrag++; $('drop').classList.add('nad'); } });
addEventListener('dragleave', () => { if (--pocitadloDrag <= 0) { pocitadloDrag = 0; $('drop').classList.remove('nad'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault(); pocitadloDrag = 0; $('drop').classList.remove('nad');
  const fs = [...e.dataTransfer.files], vid = fs.find(f => f.type.startsWith('video/'));
  if (vid && window.ANON_VIDEO) return window.ANON_VIDEO.otevri(vid);
  if (fs.length) pridejSoubory(fs);
});
addEventListener('paste', e => { const f = [...(e.clipboardData ? e.clipboardData.files : [])]; if (f.length) pridejSoubory(f.map((s, i) => (s.name && s.name !== 'image.png' ? s : new File([s], `vlozeno_${Date.now()}_${i}.png`, { type: s.type })))); });

addEventListener('keydown', e => {
  if (videoAktivni() || e.target.closest('input,select,textarea') || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === 'z') { e.preventDefault(); return e.shiftKey ? znovu() : zpet(); }
  if (ctrl && k === 'y') { e.preventDefault(); return znovu(); }
  if (ctrl && k === 's') { e.preventDefault(); return e.shiftKey ? stahnoutVse() : stahnout(); }
  if (ctrl || e.altKey) return;
  if (k === ' ') { e.preventDefault(); if (!S.mezernik) { S.mezernik = true; obal.classList.add('posun'); } return; }
  if (S.polygon) {
    if (k === 'enter') { e.preventDefault(); return uzavriPolygon(); }
    if (k === 'escape') { S.polygon = null; return kresliOverlay(); }
    if (k === 'backspace') { e.preventDefault(); return zpet(); }
  }
  if (k === 'delete' || k === 'backspace') { if (S.vybrana) { e.preventDefault(); smazOblast(S.vybrana); } return; }
  if (k === 'escape') { if (S.vybrana) { S.vybrana = null; zmeneno(false); } return; }
  if (k === 'enter') { const o = vybrana(); if (o && o.navrh) { e.preventDefault(); prijmiOblast(o.id); } return; }
  if (k === 'tab' && oblasti().length) {
    e.preventDefault();
    const obl = oblasti(), i = obl.findIndex(o => o.id === S.vybrana);
    S.vybrana = obl[i < 0 ? (e.shiftKey ? obl.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + obl.length) % obl.length].id;
    return zmeneno(false);
  }
  if (k === 'pagedown') { e.preventDefault(); return prejdi(1); }
  if (k === 'pageup') { e.preventDefault(); return prejdi(-1); }
  const sip = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
  if (sip && vybrana()) {
    e.preventDefault(); zapamatuj();
    const d = (e.shiftKey ? 10 : 1) / S.z; A.posun(vybrana(), sip[0] * d, sip[1] * d); return zmeneno();
  }
  if (k === '+' || k === '=') return zoomKrok(1);
  if (k === '-') return zoomKrok(-1);
  if (k === '0') { S.zoom = 'fit'; return nastavScenu(); }
  if (EFEKT_KLAVESA[k]) return upravVybranou(o => { o.efekt = EFEKT_KLAVESA[k]; });
  const n = { v: 'vyber', r: 'obdelnik', e: 'elipsa', p: 'polygon', b: 'stetec' }[k];
  if (n) return nastavNastroj(n);
  const pr = { k: 'zkontrolovano', g: 'prehled', f: 'obliceje', c: 'porovnat', o: 'pridat', '?': 'napoveda' }[k];
  if (pr) { e.preventDefault(); PRIKAZY[pr](); }
});
addEventListener('keyup', e => { if (e.key === ' ' && S.mezernik) { S.mezernik = false; obal.classList.remove('posun'); } });
addEventListener('blur', () => { S.mezernik = false; obal.classList.remove('posun'); });
addEventListener('beforeunload', e => { if (!nast.ukladat && S.fotky.some(f => f.oblasti.length && !f.stazeno)) { e.preventDefault(); e.returnValue = ''; } });
new ResizeObserver(() => { if (S.obr && S.zoom === 'fit') nastavScenu(); }).observe(obal);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', kresliOverlay);
new MutationObserver(kresliOverlay).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

window.ANON_APP = { S, nast, pridejSoubory, hledejVe, vyber, vystup, zpet, znovu, nastavNastroj, uzavriPolygon, zoomNa, prepniZkontrolovano, pouzijSablonu,
  pripravAi, detekujObliceje, aplikujNaKontext, stahniBlob, textBezpecnosti, zaznamy, obnovUlozene, PRIKAZY, tr };
obnovVse();
if (nast.ukladat) obnovUlozene();
})();
