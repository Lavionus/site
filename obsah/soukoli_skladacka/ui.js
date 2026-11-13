/* Skládačka soukolí – ovládání stránky nad gen3d/aplikace.js.
   Výpočty a geometrie jsou v soukoli_skladacka/jadro.js (SOUK), 3D náhled v nahled.js;
   tady je pracovní plocha (kreslení, pokládání, tažení, okno vlastností), výstupy a exporty. */
/* global SOUK, SOUK_NAHLED, KRAB, G3D, Dialog, TrubkyGui, THREE */
(function () {
  'use strict';
  const J = SOUK, O = J.O, { PI, TAU } = O;
  const el = id => document.getElementById(id);
  const f = J.f, esc = J.esc;
  const KLIC = 'webapp_skladacka_soukoli';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // dřív se rozpracovaná sestava ukládala přímo pod KLIC – převést na <klic>_projekt (G3D.aplikace)
  try {
    const stary = localStorage.getItem(KLIC);
    if (stary && !localStorage.getItem(KLIC + '_projekt')) localStorage.setItem(KLIC + '_projekt', stary);
    if (stary) localStorage.removeItem(KLIC);
  } catch (e) { /* bez úložiště */ }

  const IKONY = {
    kolo: '<circle cx="15" cy="15" r="9"/><path d="M15 3v3M15 24v3M3 15h3M24 15h3M6.5 6.5l2.1 2.1M21.4 21.4l2.1 2.1M6.5 23.5l2.1-2.1M21.4 8.6l2.1-2.1"/><circle cx="15" cy="15" r="2.5"/>',
    pastorek: '<circle cx="15" cy="15" r="6"/><path d="M15 6v3M15 21v3M6 15h3M21 15h3M8.6 8.6l2 2M19.4 19.4l2 2M8.6 21.4l2-2M19.4 10.6l2-2"/><circle cx="15" cy="15" r="1.8"/>',
    velke: '<circle cx="15" cy="15" r="12"/><circle cx="15" cy="15" r="10" stroke-dasharray="1.6 1.6"/><circle cx="15" cy="15" r="2.5"/><circle cx="15" cy="9" r="2"/><circle cx="15" cy="21" r="2"/>',
    venec: '<circle cx="15" cy="15" r="13"/><circle cx="15" cy="15" r="9.5" stroke-dasharray="1.8 1.6"/><circle cx="19" cy="15" r="4.5"/>',
    hreben: '<path d="M2 11h2l1.2-3h2.6L9 11h2l1.2-3h2.6L16 11h2l1.2-3h2.6L23 11h2l1.2-3M2 11v5h26v-5"/><circle cx="15" cy="23" r="4"/>',
    remenice: '<circle cx="8" cy="15" r="5"/><circle cx="22" cy="15" r="3"/><path d="M8 10l14 2M8 20l14-2"/>',
    retezka: '<circle cx="15" cy="15" r="9"/><path d="M15 4v3M15 23v3M4 15h3M23 15h3M7.2 7.2l2 2M20.8 20.8l2 2M7.2 22.8l2-2M20.8 9.2l2-2"/><circle cx="15" cy="15" r="3" stroke-dasharray="1.5 1.2"/>',
    remen: '<circle cx="8" cy="15" r="5"/><circle cx="23" cy="15" r="3.5"/><path d="M8 10l15 1.5M8 20l15-1.5" stroke-width="2.4"/>',
    remenx: '<circle cx="8" cy="15" r="5"/><circle cx="23" cy="15" r="3.5"/><path d="M8 10l15 8.5M8 20l15-8.5" stroke-width="2.2"/>',
    retez: '<circle cx="8" cy="15" r="5"/><circle cx="23" cy="15" r="3.5"/><path d="M8 10l15 1.5M8 20l15-1.5" stroke-width="2.6" stroke-dasharray="1.6 1.4"/>',
  };
  const PALETA = J.PALETA, NAZVY_DRUHU = J.NAZVY_DRUHU, NAZVY_VAZEB = J.NAZVY_VAZEB;
  const polomery = J.polomery, osyHrebene = J.osyHrebene, delkaHrebene = J.delkaHrebene, vyskaHrebene = J.vyskaHrebene;

  /* ---------- stav ---------- */
  let S = null, R = null;            // S = app.p (synchronizuje sync()), R = řešení vazeb
  let vybrany = null;                // id vybraného prvku
  const sync = () => { S = app.p; };
  const najdi = id => J.najdi(S, id);
  const troj = (obrys, otvory) => THREE.ShapeUtils.triangulateShape(obrys.map(([x, y]) => new THREE.Vector2(x, y)), otvory.map(o => o.map(([x, y]) => new THREE.Vector2(x, y))));
  const zobr = { d3: false, tisk: false };

  const app = G3D.aplikace({
    typ: 'skladacka_soukoli', nazev: 'Skládačka soukolí', klic: KLIC, soubor: 'skladacka_soukoli',
    normalizuj: J.normalizuj, vychozi: J.vychozi,
    // projekt = holá sestava jako dřív (staré soubory se načtou beze změny)
    ulozProjekt: q => JSON.stringify(q, null, 1),
    nactiProjekt: t => {
      let d;
      try { d = JSON.parse(t); } catch (e) { throw new Error('Soubor není platný JSON.'); }
      if (!d || !Array.isArray(d.prvky)) throw new Error('Soubor neobsahuje sestavu.');
      return J.normalizuj(d);
    },
    popis: q => `${q.prvky.length} dílů, ${q.vazby.length} řemenů / řetězů`,
    poNaplneni: () => { sync(); if (vybrany && !najdi(vybrany)) vybrany = null; obnovGlobalni(); },
    prepocitej: () => zmena(),
    png: () => (zobr.d3 || zobr.tisk ? nahled.png() : (kresli(), platno.toDataURL('image/png'))),
    pohled: j => { nastav3d(true); nahled.pohled(j); },
    exportStl: () => exportStl('deska'),
    doModelare: () => (prazdnaPlocha() ? null : { data: KRAB.soubor3mf(dilyNaDesce(), 'Skládačka soukolí'), pripona: '.3mf' }),
    zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', v: 't3d', f: 'btnFit' },
    zmenaTematu: () => { nactiBarvy(); kresli(); barvy3d(); },
  });
  sync();

  /* ---------- kreslení plochy ---------- */
  const platno = el('platno'), ctx = platno.getContext('2d');
  const pohled = { cx: 0, cy: 0, s: 3 };
  let W = 0, H = 0, DPR = 1;
  let cas = 0, hraje = true;
  const barvy = {};
  let nahledDilu = null;       // náhled pokládaného dílu {p, x, y, info}
  let nastroj = null;          // id položky palety nebo null (= výběr)
  let spojOd = null;           // první kolo při natahování řemenu
  let oknoCeka = false;        // okno vlastností se ukáže až po uvolnění tlačítka myši
  const cesty = new WeakMap(); // tvar → Path2D
  function cesta(p) {
    const tv = J.tvar(p);
    if (!cesty.has(tv)) {
      const c = new Path2D();
      for (const sm of [tv.obrys, ...tv.otvory]) { sm.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); }
      cesty.set(tv, c);
    }
    return cesty.get(tv);
  }

  function nactiBarvy() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    Object.assign(barvy, { pozadi: v('--bg-deep', '#121212'), text: v('--text', '#e0e0e0'), slaby: v('--text-faint', '#888'), stredni: v('--text-muted', '#b0b0b0'),
      mrizka: v('--border', '#404040'), akcent: v('--accent', '#6aa6fd'), ok: v('--ok', '#4caf7d'), chyba: v('--danger', '#e05d5d'), svetle: document.documentElement.dataset.theme === 'light',
      pismo: getComputedStyle(document.body).fontFamily || 'sans-serif' });
  }
  function tmavsi(hex, q) {
    const n = parseInt(hex.slice(1), 16);
    q = q || (barvy.svetle ? 0.62 : 0.55);
    return `rgb(${Math.round(((n >> 16) & 255) * q)},${Math.round(((n >> 8) & 255) * q)},${Math.round((n & 255) * q)})`;
  }
  function velikost() {
    const box = el('platnoBox');
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = box.clientWidth; H = box.clientHeight;
    platno.width = Math.max(1, Math.round(W * DPR)); platno.height = Math.max(1, Math.round(H * DPR));
    if (!pohnuto && W > 1 && H > 1) prizpusob(); else kresli();   // dokud uživatel pohled neposunul, drží se celá sestava v ploše
  }
  let pohnuto = false;
  const uhelMotoru = () => J.uhelMotoru(S, cas);
  const transformace = (p, Phi) => J.transformace(R, p, Phi);
  function prizpusob() {
    const b = J.obalka(S);
    if (!b || !W) { pohled.cx = 0; pohled.cy = 0; pohled.s = 3; kresli(); return; }
    pohled.cx = (b.x0 + b.x1) / 2; pohled.cy = (b.y0 + b.y1) / 2;
    pohled.s = Math.max(0.05, Math.min(40, Math.min((W - 60) / (b.x1 - b.x0 || 1), (H - 90) / (b.y1 - b.y0 || 1)) * 0.92));
    kresli();
  }
  const naSvet = (sx, sy) => [pohled.cx + (sx - W / 2) / pohled.s, pohled.cy - (sy - H / 2) / pohled.s];

  function kresliDil(p, t, stav, zvyr) {
    const k = pohled.s * DPR, ox = W * DPR / 2 - pohled.cx * k, oy = H * DPR / 2 + pohled.cy * k;
    const px = DPR / k;
    const cs = cesta(p);
    // stín dílu ve vyšším patře
    if (p.patro > 0) {
      ctx.setTransform(k, 0, 0, -k, ox + 3 * p.patro * DPR, oy + 3 * p.patro * DPR);
      ctx.translate(t.x, t.y); ctx.rotate(t.rot); if (t.posun) ctx.translate(t.posun, 0);
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.fill(cs, 'evenodd'); ctx.globalAlpha = 1;
    }
    ctx.setTransform(k, 0, 0, -k, ox, oy);
    ctx.translate(t.x, t.y); ctx.rotate(t.rot); if (t.posun) ctx.translate(t.posun, 0);
    ctx.globalAlpha = stav === 'volne' ? 0.55 : (p.patro > 0 ? 0.93 : 0.88);
    ctx.fillStyle = p.barva; ctx.fill(cs, 'evenodd');
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stav === 'chyba' ? barvy.chyba : tmavsi(p.barva);
    ctx.lineWidth = px * (stav === 'chyba' ? 2.2 : 1.1);
    ctx.stroke(cs);
    if (zvyr) { ctx.strokeStyle = barvy.akcent; ctx.lineWidth = px * 2.6; ctx.stroke(cs); }
    if (p.druh === 'remenice') {
      ctx.beginPath(); ctx.arc(0, 0, polomery(p).r - 1.5, 0, TAU);
      ctx.strokeStyle = tmavsi(p.barva, 0.4); ctx.lineWidth = Math.max(px, 2.2); ctx.stroke();
    }
    // značka natočení
    if (p.druh !== 'hreben') {
      const r = polomery(p);
      const rz = p.druh === 'venec' ? (r.ri + r.ra) / 2 + (r.ra - r.ri) * 0.25 : r.r * 0.62;
      ctx.beginPath(); ctx.arc(rz, 0, Math.max(2.5 * px, Math.min(r.r * 0.05, 3)), 0, TAU);
      ctx.fillStyle = barvy.svetle ? '#fff' : '#111'; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  function kresli() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = barvy.pozadi; ctx.fillRect(0, 0, platno.width, platno.height);
    if (!R) return;
    const k = pohled.s * DPR, ox = W * DPR / 2 - pohled.cx * k, oy = H * DPR / 2 + pohled.cy * k;
    const px = DPR / k;
    const svet = () => ctx.setTransform(k, 0, 0, -k, ox, oy);
    // mřížka
    svet();
    const krok = pohled.s > 20 ? 1 : pohled.s > 2 ? 10 : 100;
    const [vx0, vy1] = naSvet(0, 0), [vx1, vy0] = naSvet(W, H);
    ctx.beginPath();
    for (let x = Math.ceil(vx0 / krok) * krok; x <= vx1; x += krok) { ctx.moveTo(x, vy0); ctx.lineTo(x, vy1); }
    for (let y = Math.ceil(vy0 / krok) * krok; y <= vy1; y += krok) { ctx.moveTo(vx0, y); ctx.lineTo(vx1, y); }
    ctx.strokeStyle = barvy.mrizka; ctx.globalAlpha = 0.35; ctx.lineWidth = px; ctx.stroke(); ctx.globalAlpha = 1;

    const Phi = uhelMotoru();
    const kolizni = new Set(R.kolize.flat());
    const razeni = S.prvky.slice().sort((a, b) => a.patro - b.patro || (a.druh === 'venec' ? -1 : 0) - (b.druh === 'venec' ? -1 : 0));
    const patra = [...new Set(razeni.map(p => p.patro))];
    for (const pat of patra) {
      for (const p of razeni) {
        if (p.patro !== pat) continue;
        const stav = R.zablokovane.has(p.id) || kolizni.has(p.id) ? 'chyba' : (R.pohanene.has(p.id) ? 'ok' : 'volne');
        kresliDil(p, transformace(p, Phi), stav, p.id === vybrany);
      }
      // řemeny v tomto patře (podle vyššího z obou kol)
      for (const v of S.vazby) {
        const a = najdi(v.a), b = najdi(v.b);
        if (!a || !b || Math.max(a.patro, b.patro) !== pat) continue;
        const d = J.drahaRemene(S, v);
        if (!d) continue;
        svet();
        ctx.beginPath(); d.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        const beh = (R.pomer.get(a.id) || 0) * Phi * polomery(a).r;
        if (v.typ === 'retez') {
          ctx.strokeStyle = barvy.svetle ? '#555' : '#9aa0a8'; ctx.lineWidth = a.p * 0.62; ctx.lineCap = 'butt';
          ctx.setLineDash([a.p * 0.55, a.p * 0.45]); ctx.lineDashOffset = beh; ctx.stroke();
          ctx.setLineDash([]); ctx.lineWidth = a.p * 0.18; ctx.strokeStyle = barvy.svetle ? '#333' : '#5d636b'; ctx.stroke();
        } else {
          ctx.strokeStyle = barvy.svetle ? '#3d3d3d' : '#2b2b2b'; ctx.lineWidth = Math.max(3 * px, Math.min(polomery(a).r, polomery(b).r) * 0.14); ctx.lineCap = 'round'; ctx.stroke();
          ctx.setLineDash([6 * px, 7 * px]); ctx.lineDashOffset = beh; ctx.strokeStyle = barvy.svetle ? '#9a9a9a' : '#777'; ctx.lineWidth = Math.max(px, ctx.lineWidth * 0.25); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    // středy, hřídele
    for (const p of S.prvky) {
      if (p.druh === 'hreben') continue;
      svet();
      const r = 1.6 * DPR / k * 2;
      ctx.beginPath(); ctx.moveTo(p.x - r * 2, p.y); ctx.lineTo(p.x + r * 2, p.y); ctx.moveTo(p.x, p.y - r * 2); ctx.lineTo(p.x, p.y + r * 2);
      ctx.strokeStyle = barvy.stredni; ctx.lineWidth = px; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1;
    }
    // vybraný díl: roztečná kružnice / přímka
    const vyb = vybrany && najdi(vybrany);
    if (vyb) {
      svet(); ctx.setLineDash([6 * px, 4 * px]); ctx.strokeStyle = barvy.akcent; ctx.lineWidth = px * 1.2;
      if (vyb.druh === 'hreben') {
        const { eu } = osyHrebene(vyb), L = delkaHrebene(vyb) / 2;
        ctx.beginPath(); ctx.moveTo(vyb.x - eu[0] * L, vyb.y - eu[1] * L); ctx.lineTo(vyb.x + eu[0] * L, vyb.y + eu[1] * L); ctx.stroke();
      } else { ctx.beginPath(); ctx.arc(vyb.x, vyb.y, polomery(vyb).r, 0, TAU); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    // body záběru
    for (const v of R.vazby) {
      if (!['ext', 'int', 'hreben'].includes(v.typ)) continue;
      const a = najdi(v.a), b = najdi(v.b);
      let x, y;
      if (v.typ === 'hreben') { const K = a.druh === 'kolo' ? a : b, Hh = K === a ? b : a; const { en } = osyHrebene(Hh), r = polomery(K).r; x = K.x + en[0] * r; y = K.y + en[1] * r; }
      else if (v.typ === 'int') { const K = b, V = a, d = Math.hypot(K.x - V.x, K.y - V.y) || 1, r = polomery(V).r; x = V.x + (K.x - V.x) / d * r; y = V.y + (K.y - V.y) / d * r; }
      else { const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, r = polomery(a).r; x = a.x + (b.x - a.x) / d * r; y = a.y + (b.y - a.y) / d * r; }
      svet(); ctx.beginPath(); ctx.arc(x, y, 3.2 * px, 0, TAU);
      ctx.fillStyle = R.zablokovane.has(a.id) ? barvy.chyba : barvy.ok; ctx.fill();
    }
    // náhled pokládaného dílu
    if (nahledDilu) {
      const t = { x: nahledDilu.x, y: nahledDilu.y, rot: nahledDilu.p.druh === 'hreben' ? O.rad(nahledDilu.p.uhel || 0) : 0, posun: 0 };
      ctx.globalAlpha = 0.55; kresliDil(nahledDilu.p, t, 'ok', true); ctx.globalAlpha = 1;
      if (nahledDilu.cil) {
        svet(); ctx.beginPath(); ctx.moveTo(nahledDilu.x, nahledDilu.y); ctx.lineTo(nahledDilu.cil.x, nahledDilu.cil.y);
        ctx.strokeStyle = barvy.ok; ctx.setLineDash([4 * px, 3 * px]); ctx.lineWidth = 1.5 * px; ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (spojOd) {
      const A = najdi(spojOd);
      if (A) { svet(); ctx.beginPath(); ctx.arc(A.x, A.y, polomery(A).ra + 3 * px * 3, 0, TAU); ctx.strokeStyle = barvy.akcent; ctx.lineWidth = 2 * px; ctx.setLineDash([5 * px, 4 * px]); ctx.stroke(); ctx.setLineDash([]); }
    }
    // popisky
    if (S.nast.popisky) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of S.prvky) {
        let x = p.x, y = p.y;
        if (p.druh === 'hreben') { const { en } = osyHrebene(p); x += en[0] * vyskaHrebene(p) * 0.55; y += en[1] * vyskaHrebene(p) * 0.55; }
        else if (p.druh === 'venec') { const r = polomery(p); y -= (r.ri + r.ra) / 2; }
        const sx = x * k + ox, sy = -y * k + oy + (p.druh === 'venec' || p.druh === 'hreben' ? 0 : -18 * DPR) + p.patro * 13 * DPR;
        const znak = (p.motor ? '⚡ ' : '') + (p.vystup ? '🎯 ' : '');
        const radek1 = znak + p.nazev;
        let radek2 = '';
        if (R.pohanene.has(p.id)) {
          if (p.druh === 'hreben') radek2 = f(Math.abs(R.pomer.get(p.id) * J.omegaMotoru(S)), 1) + ' mm/s';
          else { const n = J.otacky(S, R, p); radek2 = f(Math.abs(n), Math.abs(n) < 10 ? 2 : 1) + ' min⁻¹ ' + J.smerText(n); }
        } else if (R.zablokovane.has(p.id)) radek2 = 'zablokováno';
        ctx.font = `600 ${11.5 * DPR}px ${barvy.pismo}`;
        const w1 = ctx.measureText(radek1).width;
        ctx.font = `${10.5 * DPR}px ${barvy.pismo}`;
        const w2 = radek2 ? ctx.measureText(radek2).width : 0;
        const ww = Math.max(w1, w2) + 10 * DPR, hh = (radek2 ? 30 : 17) * DPR;
        ctx.fillStyle = barvy.pozadi; ctx.globalAlpha = 0.78; ctx.fillRect(sx - ww / 2, sy - hh / 2, ww, hh); ctx.globalAlpha = 1;
        ctx.fillStyle = barvy.text; ctx.font = `600 ${11.5 * DPR}px ${barvy.pismo}`;
        ctx.fillText(radek1, sx, sy - (radek2 ? 7 * DPR : 0));
        if (radek2) { ctx.font = `${10.5 * DPR}px ${barvy.pismo}`; ctx.fillStyle = R.zablokovane.has(p.id) ? barvy.chyba : barvy.stredni; ctx.fillText(radek2, sx, sy + 7.5 * DPR); }
      }
    }
    aktualizujHud(Phi);
  }
  function aktualizujHud(Phi) {
    if (!R.motor) { el('hud').innerHTML = 'Motor: <b>není</b>'; return; }
    el('hud').innerHTML = `Motor: <b>${esc(R.motor.nazev)}</b> · ${f(S.nast.otacky, 1)} min⁻¹ ${S.nast.smer > 0 ? '↺' : '↻'}<br>` +
      `natočení motoru <b>${f(((Phi * 180 / PI) % 360 + 360) % 360, 1)}°</b> · animace ${f(S.nast.animace, 2)}×`;
  }

  /* ---------- 3D náhled ---------- */
  const nahled = SOUK_NAHLED.vytvorNahled(el('nahled3d'));
  const sitCache = new Map();
  function sit(p) {
    const k = [p.druh, p.z, p.m, p.n, p.D, p.p, p.d, p.otvor, p.odlehceni, p.b].join('|');
    if (!sitCache.has(k)) { sitCache.set(k, J.sitDilu(p, troj)); if (sitCache.size > 120) sitCache.delete(sitCache.keys().next().value); }
    return sitCache.get(k);
  }
  /** Díly vedle sebe na podložce (tisková poloha, STL a 3MF „vše“). */
  function dilyNaDesce() {
    return J.rozlozeniNaDesku(S).map(({ p, x, y }) => {
      const m = sit(p), poz = new Float32Array(m.poz);
      for (let i = 0; i < poz.length; i += 3) { poz[i] += x; poz[i + 1] += y; }
      return { id: p.id, nazev: p.nazev, jmeno: J.bezpecneJmeno(p.nazev), poz, idx: m.idx, objem: m.objem, barva: p.barva };
    });
  }
  let klic3d = '';
  function obnov3d(novyPohled) {
    if (!(zobr.d3 || zobr.tisk)) { klic3d = ''; return; }
    const uhel = 45;
    if (zobr.tisk) {
      const k = 't' + JSON.stringify(S.prvky.map(p => [p.id, J.bezpecneJmeno(p.nazev), p.barva, p.druh, p.z, p.m, p.n, p.D, p.p, p.d, p.otvor, p.odlehceni, p.b]));
      if (k !== klic3d || novyPohled) { klic3d = k; nahled.nastav(dilyNaDesce().map(d => ({ id: d.id, sit: d, barva: d.barva })), { tisk: true, uhel, novyPohled }); }
      return;
    }
    const vyska = Math.max(1, ...S.prvky.map(J.vyskaDilu)) + 1;
    const k = 's' + JSON.stringify(S.prvky.map(p => [p.id, p.barva, p.druh, p.z, p.m, p.n, p.D, p.p, p.d, p.otvor, p.odlehceni, p.b, p.x, p.y, p.patro, p.uhel]));
    const Phi = uhelMotoru();
    if (k !== klic3d || novyPohled) {
      klic3d = k;
      nahled.nastav(S.prvky.map(p => { const t = transformace(p, Phi); return { id: p.id, sit: sit(p), barva: p.barva, x: t.x, y: t.y, z: p.patro * vyska, rot: t.rot, posun: t.posun }; }), { novyPohled });
    } else pohyb3d(Phi);
  }
  function pohyb3d(Phi) {
    for (const p of S.prvky) { const t = transformace(p, Phi); nahled.poloha(p.id, t.rot, t.posun); }
    nahled.prekresli();
  }
  function barvy3d() { nahled.barvy(css('--border-strong'), css('--border'), css('--text')); klic3d = ''; obnov3d(); }
  function nastav3d(h) {
    if (zobr.d3 === h) return;
    el('t3d').setAttribute('aria-pressed', String(h));
    prepniNahled(h);
  }
  function prepniNahled(h) {
    zobr.d3 = h;
    const vid3 = zobr.d3 || zobr.tisk;
    el('nahled3d').hidden = !vid3; el('platnoBox').hidden = vid3;
    el('n3d').setAttribute('aria-pressed', String(vid3)); el('n2d').setAttribute('aria-pressed', String(!vid3));
    el('legPrevisy').hidden = !(zobr.tisk && nahled.stav.previsy);
    if (!vid3) velikost();
    else setTimeout(() => obnov3d(true), 60);   // až plátno dostane velikost (ResizeObserver scény)
  }

  /* ---------- výstupy: ukazatele, kontroly, tabulka, kusovník ---------- */
  const box = G3D.dlazdice;
  function vykresliVystupy() {
    const { kpi } = J.kpi(S, R);
    let h = kpi.map(([l, v, p]) => `<div><small>${l}</small><b>${v}</b><span>${p || '&nbsp;'}</span></div>`).join('');
    // materiál k tisku (plné díly, PLA)
    const V = S.prvky.reduce((s, p) => s + J.objemDilu(p), 0);
    if (V > 0) {
      const o = G3D.odhadTisku(V, 1.24, { dilu: S.prvky.length });
      const b = J.obalka(S);
      h += `<div><small>Sestava</small><b>${f(b.x1 - b.x0, 0)} × ${f(b.y1 - b.y0, 0)} mm</b><span>${S.prvky.length} dílů, ${new Set(S.prvky.map(p => p.patro)).size} pater</span></div>`;
      h += `<div><small>Objem dílů</small><b>${f(V / 1000, 1)} cm³</b><span>${f(o.g, 0)} g PLA (plné díly)</span></div>`;
      h += `<div><small>Filament</small><b>${f(o.metru, 1)} m</b><span>průměr 1,75 mm</span></div>`;
      h += `<div><small>Doba tisku</small><b>≈ ${o.minut < 60 ? o.minut + ' min' : f(o.minut / 60, 1) + ' h'}</b><span>hrubý odhad, všechny díly</span></div>`;
    }
    el('kpi').innerHTML = h;
    app.hlaseni(J.kontroly(S, R), { boxy: [] });

    // tabulka dílů
    if (!S.prvky.length) { el('tabulka').innerHTML = '<p class="prazdne">Zatím tu nic není.</p>'; }
    else {
      let t = '<table class="t"><thead><tr><th>Díl</th><th>Patro</th><th>Rozměr</th><th>Otáčky</th><th>Smysl</th><th>Poměr k motoru</th><th>Moment</th><th>Stav</th></tr></thead><tbody>';
      for (const p of S.prvky) {
        const zab = R.zablokovane.has(p.id), poh = R.pohanene.has(p.id);
        const kol = R.kolize.some(k => k.includes(p.id));
        let stav = poh ? '<span class="stav ok">pohání se</span>' : '<span class="stav volne">stojí</span>';
        if (zab) stav = '<span class="stav chyba">zablokováno</span>';
        if (kol) stav += ' <span class="stav chyba">kolize</span>';
        const q = R.pomer.get(p.id);
        let ot = '—', smer = '—', pom = '—', mom = '—';
        if (poh) {
          if (p.druh === 'hreben') {
            ot = f(Math.abs(q * J.omegaMotoru(S)), 1) + ' mm/s';
            smer = q * S.nast.smer > 0 ? '→' : '←';
            pom = f(Math.abs(q) * TAU, 2) + ' mm/ot';
            mom = f(S.nast.moment * 1000 / Math.abs(q) * (S.nast.ucinnost ? R.eta.get(p.id) : 1), 1) + ' N';
          } else {
            const n = J.otacky(S, R, p);
            ot = f(Math.abs(n), 2) + ' min⁻¹'; smer = J.smerText(n);
            const zl = R.zlomek.get(p.id);
            pom = q === 0 ? '—' : (zl ? `${J.zlomekText([zl[1], Math.abs(zl[0])])}` : f(1 / Math.abs(q), 4));
            mom = f(S.nast.moment / Math.abs(q) * (S.nast.ucinnost ? R.eta.get(p.id) : 1), 2) + ' N·m';
          }
        }
        const znak = (p.motor ? ' ⚡' : '') + (p.vystup ? ' 🎯' : '');
        t += `<tr data-id="${p.id}" class="${p.id === vybrany ? 'vybrany' : ''}"><td><span class="barva" style="background:${p.barva}"></span>${esc(p.nazev)}${znak}</td>
          <td class="c">${p.patro}</td><td>${J.rozmerText(p)}</td><td class="c">${ot}</td><td class="c">${smer}</td><td class="c">${pom}</td><td class="c">${mom}</td><td>${stav}</td></tr>`;
      }
      for (const v of S.vazby) {
        const a = najdi(v.a), b = najdi(v.b);
        if (!a || !b) continue;
        const L = J.delkaRemene(S, v);
        const info = v.typ === 'retez' ? `${Math.ceil(L / a.p / 2) * 2} článků (${f(L, 0)} mm)` : `délka ${f(L, 1)} mm`;
        t += `<tr><td colspan="2">${NAZVY_VAZEB[v.typ]}: ${esc(a.nazev)} → ${esc(b.nazev)}</td><td colspan="6">${info}</td></tr>`;
      }
      el('tabulka').innerHTML = t + '</tbody></table>';
      el('tabulka').querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => vyber(+tr.dataset.id)));
    }
    const r = J.polozkyKusovniku(S);
    el('kusovnik').innerHTML = !r.length ? '<p class="prazdne">Kusovník je prázdný.</p>' : '<table class="t"><thead><tr><th>Díl</th><th>Rozměr</th><th>Ks</th></tr></thead><tbody>' +
      r.map(x => `<tr><td>${x.barva ? `<span class="barva" style="background:${x.barva}"></span>` : ''}${esc(x.nazev)}</td><td>${esc(x.rozmer)}</td><td class="c">${x.pocet}</td></tr>`).join('') + '</tbody></table>';
    TrubkyGui.souhrn('sPaleta', `${S.prvky.length} dílů na ploše`, S.prvky.length > 0);
    TrubkyGui.souhrn('sPohon', `${f(S.nast.otacky, 1)} min⁻¹ ${S.nast.smer > 0 ? '↺' : '↻'} · ${f(S.nast.moment, 2)} N·m${S.nast.rezim === 'kyv' ? ' · kyvadlově' : ''}`, true);
  }

  /* ---------- pokládání, přichycení, tažení ---------- */
  // Najde nejbližší polohu, kde díl p u bodu (x, y) zabírá s jiným dílem nebo sdílí hřídel.
  function prichyt(p, x, y) {
    const tolPx = 18 / pohled.s;
    let best = null;
    const kand = (nx, ny, cil, info, patro) => {
      // cíle v jiném patře mají malou penalizaci, ať vyhraje stejné patro
      const d = Math.hypot(nx - x, ny - y) + (patro !== p.patro ? tolPx * 0.3 : 0);
      if (!best || d < best.d) best = { x: nx, y: ny, d, cil, info, patro };
    };
    for (const Q of S.prvky) {
      if (Q.id === p.id) continue;
      const dq = Math.hypot(x - Q.x, y - Q.y) || 1e-9;
      const pq = polomery(Q), pp = polomery(p);
      // na střed jiného dílu → společná hřídel (patro se zvolí samo)
      if (p.druh !== 'hreben' && Q.druh !== 'hreben' && dq < Math.max(tolPx * 1.3, pq.r * 0.35)) kand(Q.x, Q.y, Q, 'na hřídel', patroNaOse(p, Q));
      if (!p.m || Q.m !== p.m) continue;
      const kandZ = (nx, ny, cil, info) => kand(nx, ny, cil, info, Q.patro);
      if (p.druh === 'kolo' && Q.druh === 'kolo') {
        const D = pp.r + pq.r;
        if (Math.abs(dq - D) < Math.max(tolPx, 1.5 * p.m)) kandZ(Q.x + (x - Q.x) / dq * D, Q.y + (y - Q.y) / dq * D, Q, 'záběr');
      } else if (p.druh === 'kolo' && Q.druh === 'venec') {
        const D = pq.r - pp.r;
        if (D > 0 && Math.abs(dq - D) < Math.max(tolPx, 1.5 * p.m)) kandZ(Q.x + (x - Q.x) / dq * D, Q.y + (y - Q.y) / dq * D, Q, 'záběr ve věnci');
      } else if (p.druh === 'venec' && Q.druh === 'kolo') {
        const D = pp.r - pq.r;
        if (D > 0 && Math.abs(dq - D) < Math.max(tolPx, 1.5 * p.m)) kandZ(Q.x + (x - Q.x) / dq * D, Q.y + (y - Q.y) / dq * D, Q, 'záběr ve věnci');
      } else if (p.druh === 'kolo' && Q.druh === 'hreben') {
        const { eu, en } = osyHrebene(Q);
        const u = (x - Q.x) * eu[0] + (y - Q.y) * eu[1], w = (x - Q.x) * en[0] + (y - Q.y) * en[1];
        if (Math.abs(w + pp.r) < Math.max(tolPx, 1.5 * p.m) && Math.abs(u) < delkaHrebene(Q) / 2) kandZ(Q.x + u * eu[0] - pp.r * en[0], Q.y + u * eu[1] - pp.r * en[1], Q, 'záběr s hřebenem');
      } else if (p.druh === 'hreben' && Q.druh === 'kolo') {
        const { eu, en } = osyHrebene(p);
        const wq = (Q.x - x) * en[0] + (Q.y - y) * en[1], uq = (Q.x - x) * eu[0] + (Q.y - y) * eu[1];
        const opr = wq + pq.r;
        if (Math.abs(opr) < Math.max(tolPx, 1.5 * p.m) && Math.abs(uq) < delkaHrebene(p) / 2) kandZ(x + opr * en[0], y + opr * en[1], Q, 'záběr s kolem');
      }
    }
    return best;
  }
  // Patro pro díl nasazený na osu dílu Q: nejbližší volné nad ostatními díly na ose.
  function patroNaOse(p, Q) {
    if (J.vDutineVence({ ...p, patro: Q.patro }, Q)) return Q.patro;
    const osa = S.prvky.filter(o => o.id !== p.id && o.druh !== 'hreben' && Math.hypot(o.x - Q.x, o.y - Q.y) < 0.05);
    const obsazeno = new Set(osa.map(o => o.patro));
    if (!obsazeno.has(p.patro)) return p.patro;
    return Math.min(9, Math.max(...obsazeno) + 1);
  }
  function nastavNahled(sx, sy) {
    const pal = PALETA.find(q => q.id === nastroj);
    if (!pal || pal.nastroj) { nahledDilu = null; return; }
    const [x, y] = naSvet(sx, sy);
    const p = J.novyPrvek(S, pal.druh, { ...pal.h, barva: J.novaBarva(S) }, x, y, true);
    const b = prichyt(p, x, y);
    if (b) p.patro = b.patro;
    nahledDilu = { p, x: b ? b.x : x, y: b ? b.y : y, cil: b ? b.cil : null, info: b ? b.info : null };
    zobrazRezim();
  }
  function hitTest(sx, sy) {
    const [x, y] = naSvet(sx, sy);
    const razeni = S.prvky.slice().sort((a, b) => b.patro - a.patro || (a.druh === 'venec' ? 1 : 0) - (b.druh === 'venec' ? 1 : 0));
    for (const p of razeni) {
      if (p.druh === 'hreben') {
        const { eu, en } = osyHrebene(p);
        const u = (x - p.x) * eu[0] + (y - p.y) * eu[1], w = (x - p.x) * en[0] + (y - p.y) * en[1];
        if (Math.abs(u) <= delkaHrebene(p) / 2 && w >= -p.m && w <= vyskaHrebene(p)) return p;
        continue;
      }
      const r = polomery(p), d = Math.hypot(x - p.x, y - p.y);
      if (p.druh === 'venec' ? (d >= r.ri && d <= r.ra) : d <= r.ra) return p;
    }
    return null;
  }
  function zobrazRezim() {
    const info = el('rezimInfo');
    let t = '';
    const pal = PALETA.find(q => q.id === nastroj);
    if (pal && pal.nastroj) t = spojOd ? `${NAZVY_VAZEB[pal.nastroj]}: klepněte na druhé ${pal.nastroj === 'retez' ? 'řetězové kolo' : 'kolo / řemenici'}` : `${NAZVY_VAZEB[pal.nastroj]}: klepněte na první ${pal.nastroj === 'retez' ? 'řetězové kolo' : 'řemenici'}`;
    else if (pal) t = `Pokládání: ${pal.nazev}` + (nahledDilu && nahledDilu.info ? ` · přichyceno (${nahledDilu.info})` : ' · klepněte do plochy');
    info.textContent = t;
    info.classList.toggle('skryt', !t);
  }
  function nastavNastroj(id) {
    nastroj = id; spojOd = null; nahledDilu = null;
    document.querySelectorAll('.dil').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === (id || ''))));
    platno.style.cursor = id ? 'crosshair' : 'grab';
    if (id) nastav3d(false);
    zobrazRezim(); kresli();
  }

  (function () {
    const prsty = new Map();
    let tah = null, minVzd = 0;
    const rel = e => { const r = platno.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    platno.addEventListener('pointerdown', e => {
      try { platno.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
      prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [sx, sy] = rel(e);
      if (prsty.size > 1) { tah = null; return; }
      const pal = PALETA.find(q => q.id === nastroj);
      if (pal && pal.nastroj) {
        const Q = hitTest(sx, sy);
        const hodi = Q && (pal.nastroj === 'retez' ? Q.druh === 'retezka' : Q.druh === 'remenice');
        if (!hodi) { if (Q) Dialog.info(pal.nastroj === 'retez' ? 'Řetěz spojuje jen řetězová kola.' : 'Řemen spojuje jen řemenice.'); return; }
        if (!spojOd) { spojOd = Q.id; zobrazRezim(); kresli(); return; }
        if (Q.id === spojOd) return;
        const A = najdi(spojOd);
        if (pal.nastroj === 'retez' && Math.abs(A.p - Q.p) > 1e-9) { Dialog.chyba('Řetězová kola mají různou rozteč.'); return; }
        spojOd = null;
        app.zmen(q => {
          q.vazby = q.vazby.filter(v => !((v.a === A.id && v.b === Q.id) || (v.a === Q.id && v.b === A.id)));
          q.vazby.push({ typ: pal.nastroj, a: A.id, b: Q.id });
        });
        zobrazRezim();
        return;
      }
      if (pal) {
        nastavNahled(sx, sy);
        if (!nahledDilu) return;
        const nd = nahledDilu;
        nahledDilu = null;
        oknoCeka = true;
        app.zmen(q => {
          const p = J.novyPrvek(q, pal.druh, { ...pal.h, patro: nd.p.patro, barva: J.novaBarva(q) }, nd.x, nd.y);
          if (!q.prvky.some(x => x.motor) && p.druh !== 'hreben') p.motor = true;
          q.prvky.push(p);
          vybrany = p.id;
        });
        if (!e.shiftKey) nastavNastroj(null);
        return;
      }
      const Q = hitTest(sx, sy);
      if (Q) {
        oknoCeka = true;          // při tažení dílu okno nepřekáží
        vyber(Q.id);
        const [wx, wy] = naSvet(sx, sy);
        tah = { id: Q.id, dx: Q.x - wx, dy: Q.y - wy, pohnuto: false, zaloha: { x: Q.x, y: Q.y, patro: Q.patro } };
        platno.style.cursor = 'grabbing';
      } else {
        if (vybrany) vyber(null);
        tah = { pan: true };
        platno.style.cursor = 'grabbing';
      }
    });
    platno.addEventListener('pointermove', e => {
      const [sx, sy] = rel(e);
      const pr = prsty.get(e.pointerId);
      if (!pr) { if (nastroj) { nastavNahled(sx, sy); kresli(); } return; }
      const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
      pr.x = e.clientX; pr.y = e.clientY;
      if (prsty.size >= 2) {
        const [a, b] = [...prsty.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (minVzd) zoom(d / minVzd, (a.x + b.x) / 2, (a.y + b.y) / 2);
        minVzd = d; return;
      }
      if (!tah) return;
      if (tah.pan) { pohnuto = true; pohled.cx -= dx / pohled.s; pohled.cy += dy / pohled.s; kresli(); return; }
      // při tažení se díl posouvá přímo v projektu; krok zpět vznikne až po puštění
      const p = najdi(tah.id);
      const [wx, wy] = naSvet(sx, sy);
      let x = wx + tah.dx, y = wy + tah.dy;
      const b = prichyt(p, x, y);
      if (b && !e.altKey) { x = b.x; y = b.y; p.patro = b.patro; }
      p.x = x; p.y = y; tah.pohnuto = true;
      R = J.res(S); kresli();
    });
    const konec = e => {
      prsty.delete(e.pointerId); minVzd = 0;
      if (tah && tah.pohnuto) {
        const p = najdi(tah.id), kon = { x: p.x, y: p.y, patro: p.patro };
        Object.assign(p, tah.zaloha);
        const id = tah.id;
        app.zmen(q => Object.assign(J.najdi(q, id), kon));
      }
      tah = null;
      platno.style.cursor = nastroj ? 'crosshair' : 'grab';
      if (oknoCeka) {
        oknoCeka = false;
        if (vybrany) { const [sx, sy] = rel(e); umistiOkno(sx, sy); vykresliInspektor(); }
      }
    };
    platno.addEventListener('pointerup', konec);
    platno.addEventListener('pointercancel', konec);
    platno.addEventListener('pointerleave', () => { if (nahledDilu) { nahledDilu = null; kresli(); } });
    platno.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
  })();
  function zoom(nas, clientX, clientY) {
    const r = platno.getBoundingClientRect();
    const mx = clientX - r.left - W / 2, my = clientY - r.top - H / 2;
    const wx = pohled.cx + mx / pohled.s, wy = pohled.cy - my / pohled.s;
    pohnuto = true;
    pohled.s = Math.max(0.03, Math.min(60, pohled.s * nas));
    pohled.cx = wx - mx / pohled.s; pohled.cy = wy + my / pohled.s;
    kresli();
  }

  /* ---------- okno vlastností vybraného dílu ---------- */
  // sx, sy = místo klepnutí na plátně; okno se objeví vedle dílu, ne přes něj
  function vyber(id, sx, sy) {
    const novy = id && id !== vybrany;
    vybrany = id;
    if (novy && !oknoCeka) umistiOkno(sx, sy);
    vykresliInspektor();
    vykresliVystupy();
    kresli();
  }
  // Viditelná část plochy (v souřadnicích plochy) — při odrolované stránce může být kus plochy mimo okno prohlížeče.
  function viditelnaCast() {
    const r = el('platnoBox').getBoundingClientRect();
    const v = { top: Math.max(0, -r.top), bottom: Math.min(r.height, window.innerHeight - r.top),
      left: Math.max(0, -r.left), right: Math.min(r.width, window.innerWidth - r.left) };
    if (v.bottom - v.top < 140) { v.top = 0; v.bottom = r.height; }
    if (v.right - v.left < 200) { v.left = 0; v.right = r.width; }
    return v;
  }
  const jeMobil = () => window.matchMedia('(max-width: 700px)').matches;
  // Okno se vejde celé do viditelné části plochy; když je obsah vyšší, roluje se uvnitř.
  function udrzOknoVidet() {
    const okno = el('okno');
    if (okno.classList.contains('skryt') || jeMobil()) return;
    const v = viditelnaCast(), m = 6;
    okno.style.maxHeight = Math.max(120, v.bottom - v.top - 2 * m) + 'px';
    const w = okno.offsetWidth, h = okno.offsetHeight;
    const x = Math.max(v.left + m, Math.min(v.right - w - m, okno.offsetLeft));
    const y = Math.max(v.top + m, Math.min(v.bottom - h - m, okno.offsetTop));
    okno.style.left = x + 'px'; okno.style.top = y + 'px';
  }
  // Nové okno: vedle místa klepnutí (na stranu, kde je víc místa), jinak vpravo nahoře.
  function umistiOkno(sx, sy) {
    const okno = el('okno'), v = viditelnaCast(), w = 252, odstup = 40;
    let x, y;
    if (sx == null) { x = v.right - w - 10; y = v.top + 10; }
    else { x = sx > (v.left + v.right) / 2 ? sx - w - odstup : sx + odstup; y = sy - 90; }
    okno.style.left = x + 'px'; okno.style.top = y + 'px';
  }
  const RETEZY = [[6.35, '04B · ANSI 25 (6,35)'], [8, '05B (8,0)'], [9.525, '06B · ANSI 35 (9,525)'], [12.7, '08B · ANSI 40 (12,7)'], [15.875, '10B (15,875)'], [19.05, '12B (19,05)']];
  const TVARY_OTVORU = [['kruh', 'kruh'], ['pero', 's perem'], ['D', 'D'], ['sestihran', 'šestihran']];
  const zmenDil = (id, f2) => app.zmen(q => { const p = J.najdi(q, id); if (p) f2(p, q); });

  function vykresliInspektor() {
    const bx = el('inspektor'), okno = el('okno');
    const p = vybrany && najdi(vybrany);
    okno.classList.toggle('skryt', !p || oknoCeka);
    if (!p) { bx.innerHTML = ''; return; }
    const id = p.id;
    if (document.activeElement !== el('oknoNazev')) el('oknoNazev').value = p.nazev || NAZVY_DRUHU[p.druh];
    el('oknoBarva').value = p.barva;
    const c = (k, label, min, max, krok, v, tr) => `<label class="kf ${tr || ''}">${label}<input type="number" data-k="${k}" min="${min}" max="${max}" step="${krok}" value="${v}"></label>`;
    const sel = (k, label, moz, v, tr) => `<label class="kf ${tr || ''}">${label}<select data-k="${k}">${moz.map(([a, t]) => `<option value="${a}" ${String(a) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    let h = '<div class="kp">';
    if (p.druh === 'kolo' || p.druh === 'venec') h += c('z', 'Zuby z', p.druh === 'venec' ? 12 : 5, 400, 1, p.z) + c('m', 'Modul', 0.2, 20, 0.05, p.m);
    if (p.druh === 'hreben') h += c('n', 'Zubů', 2, 400, 1, p.n) + c('m', 'Modul', 0.2, 20, 0.05, p.m);
    if (p.druh === 'remenice') h += c('D', 'Průměr', 5, 2000, 1, p.D, 's2');
    if (p.druh === 'retezka') { const rz = RETEZY.find(([v]) => Math.abs(v - p.p) < 1e-6); h += c('z', 'Zuby z', 6, 200, 1, p.z) + sel('p', 'Řetěz', RETEZY.map(([v, t]) => [v, t.split(' ')[0]]), rz ? rz[0] : p.p); }
    h += c('b', p.druh === 'retezka' ? 'Tloušťka' : 'Šířka', 0.5, 500, 0.5, p.b);
    if (p.druh === 'hreben') h += c('uhel', 'Natočení °', -360, 360, 5, p.uhel, 's3');
    if (p.druh !== 'venec' && p.druh !== 'hreben') h += c('d', 'Otvor Ø', 0, 500, 0.1, p.d) + sel('otvor', 'Tvar otvoru', TVARY_OTVORU, p.otvor || 'kruh', 's2');
    h += '</div>';
    h += `<div class="patra-r">Patro<div class="patra" role="group" aria-label="Patro">${Array.from({ length: 10 }, (_, i) =>
      `<button type="button" data-patro="${i}" aria-pressed="${p.patro === i}" title="Patro ${i} — zabírá jen se stejným patrem">${i}</button>`).join('')}</div></div>`;
    const cipy = [];
    if (p.druh !== 'hreben') cipy.push(['motor', '⚡ Motor', 'pohání soustavu']);
    cipy.push(['vystup', '🎯 Výstup', 'převod se počítá k tomuto dílu']);
    if (p.druh !== 'hreben') cipy.push(['volne', '↻ Volně na ose', 'na stejné ose s jiným dílem, ale neotáčí se s ním']);
    if (['kolo', 'remenice', 'retezka'].includes(p.druh)) cipy.push(['odlehceni', '◌ Odlehčení', 'odlehčovací otvory']);
    h += `<div class="cipy">${cipy.map(([k, t, ti]) => `<button type="button" class="cip" data-prepni="${k}" aria-pressed="${!!p[k]}" title="${ti}">${t}</button>`).join('')}</div>`;
    h += `<div class="kp">${c('x', 'X mm', -100000, 100000, 0.1, +p.x.toFixed(2))}${c('y', 'Y mm', -100000, 100000, 0.1, +p.y.toFixed(2))}<span class="kf">&nbsp;</span></div>`;
    const souv = R ? R.vazby.filter(v => v.a === p.id || v.b === p.id) : [];
    if (souv.length) {
      const pop = { ext: 'záběr', int: 'věnec', hreben: 'hřeben', hridel: 'hřídel', remen: 'řemen', remenx: 'zkř. řemen', retez: 'řetěz' };
      h += '<div class="kp-pozn">' + souv.map(v => `${pop[v.typ]}: <b>${esc(najdi(v.a === p.id ? v.b : v.a).nazev)}</b>`).join(' · ') + '</div>';
    }
    const par = p.druh === 'kolo' && R && R.vazby.find(v => v.typ === 'ext' && (v.a === p.id || v.b === p.id));
    if (par) h += '<button type="button" class="kp-odkaz" id="iNavrhar">⚙️ Otevřít dvojici v Návrháři</button>';
    bx.innerHTML = h;

    bx.querySelectorAll('[data-k]').forEach(inp => {
      const k = inp.dataset.k;
      inp.addEventListener('change', () => {
        let v = inp.value;
        if (inp.type === 'number' || k === 'p') {
          v = parseFloat(String(v).replace(',', '.'));
          if (!isFinite(v) || (inp.min !== '' && v < +inp.min) || (inp.max !== '' && v > +inp.max)) { inp.value = p[k]; return; }
          if (['z', 'n'].includes(k)) v = Math.round(v);
        }
        zmenDil(id, q => { q[k] = v; });
      });
    });
    bx.querySelectorAll('[data-prepni]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.prepni;
      zmenDil(id, (q, Sq) => {
        if (k === 'motor' && !q.motor) Sq.prvky.forEach(x => { x.motor = false; });
        q[k] = !q[k];
      });
    }));
    bx.querySelectorAll('[data-patro]').forEach(b => b.addEventListener('click', () => {
      const n = +b.dataset.patro;
      if (n !== p.patro) zmenDil(id, q => { q.patro = n; });
    }));
    if (par) el('iNavrhar').addEventListener('click', () => {
      const q = najdi(par.a === p.id ? par.b : par.a);
      const [z1, z2] = p.z <= q.z ? [p.z, q.z] : [q.z, p.z];
      const d = { v: 1, typ: 'celni', hodnoty: { celni: { m: p.m, z1, z2, x1: 0, x2: 0, aw: 0, zuby: 'prime' } } };
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      window.open('ozubena_kola.html#n=' + b64, '_blank');
    });
    udrzOknoVidet();
  }
  function duplikujVybrany() {
    const p = vybrany && najdi(vybrany);
    if (!p) return;
    app.zmen(Sq => {
      const q = { ...p, id: Sq.dalsiId++, x: p.x + polomery(p).ra * 2.2 + 10, motor: false, vystup: false, barva: J.novaBarva(Sq) };
      if (p.druh === 'hreben') { q.x = p.x; q.y = p.y - vyskaHrebene(p) * 3; }
      Sq.prvky.push(q); vybrany = q.id;
    });
  }
  function smazVybrany() {
    if (!vybrany) return;
    const id = vybrany;
    vybrany = null;
    app.zmen(q => { q.prvky = q.prvky.filter(p => p.id !== id); q.vazby = q.vazby.filter(v => v.a !== id && v.b !== id); });
  }

  /* ---------- změny ---------- */
  /** Po každé změně projektu (zmen, zpět, načtení): řešení, okno, výstupy, plocha, 3D. */
  function zmena() {
    sync();
    if (vybrany && !najdi(vybrany)) vybrany = null;
    R = J.res(S);
    vykresliInspektor();
    vykresliVystupy();
    kresli();
    obnov3d();
  }
  function obnovGlobalni() {
    el('gAnimace').value = S.nast.animace; el('gAnimaceTxt').textContent = f(S.nast.animace, 2) + '×';
    el('tPopisky').setAttribute('aria-pressed', String(!!S.nast.popisky));
  }
  function nactiPriklad(i) {
    vybrany = null; cas = 0;
    app.nahrad(J.priklad(i, S.nast));
    prizpusob(); obnov3d(true);
  }
  function novaPlocha() {
    if (!S.prvky.length && !S.vazby.length) { Dialog.info('Plocha už je prázdná — vezměte díl z palety vlevo.'); return; }
    vybrany = null; cas = 0;
    app.zmen(q => { q.prvky = []; q.vazby = []; });
    prizpusob();
    nastavNastroj(null);
    Dialog.info('Prázdná plocha. Předchozí sestavu vrátí Zpět (Ctrl+Z).');
  }

  /* ---------- exporty ---------- */
  const stahni = (data, jmeno, typ) => app.stahni(data instanceof Blob ? data : new Blob(Array.isArray(data) ? data : [data], { type: typ || 'application/octet-stream' }), jmeno);
  const prazdnaPlocha = () => { if (!S.prvky.length) { Dialog.chyba('Plocha je prázdná.'); return true; } return false; };
  function exportStl(rezim) {
    if (prazdnaPlocha()) return;
    if (rezim === 'vybrany' && !vybrany) { Dialog.chyba('Nejdřív vyberte díl (klepněte na něj v ploše).'); return; }
    try {
      if (rezim === 'vybrany') {
        const p = najdi(vybrany);
        stahni(J.stlBinarni(J.siteDilu(p, troj, 0, 0, 0, 0), p.nazev), J.bezpecneJmeno(p.nazev) + '.stl', 'model/stl');
      } else if (rezim === 'zip') {
        const pouzite = new Set();
        const polozky = S.prvky.map(p => {
          let j = J.bezpecneJmeno(p.nazev);
          while (pouzite.has(j)) j += '_' + p.id;
          pouzite.add(j);
          return { name: j + '.stl', data: J.stlBinarni(J.siteDilu(p, troj, 0, 0, 0, 0), p.nazev) };
        });
        stahni(J.zip(polozky), 'skladacka_dily_stl.zip', 'application/zip');
      } else if (rezim === 'deska') {
        stahni(J.stlBinarni(dilyNaDesce().map(d => ({ pos: d.poz, idx: d.idx })), 'podlozka'), 'skladacka_podlozka.stl', 'model/stl');
      } else {
        const Phi = uhelMotoru();
        const vyska = Math.max(...S.prvky.map(J.vyskaDilu)) + 1;
        const site = [];
        for (const p of S.prvky) { const t = transformace(p, Phi); site.push(...J.siteDilu(p, troj, t.x, t.y, t.rot, p.patro * vyska, t.posun)); }
        stahni(J.stlBinarni(site, 'sestava'), 'skladacka_sestava.stl', 'model/stl');
      }
    } catch (e) { Dialog.chyba('Export se nepovedl: ' + (e.message || e)); }
  }
  function tiskVykresu() {
    if (prazdnaPlocha()) return;
    const svg = J.svgVykres(S, R).replace(/^<\?xml[^>]*>\s*/, '');
    const w = window.open('', '_blank');
    if (!w) { stahni(J.svgVykres(S, R), 'skladacka_vykres.svg', 'image/svg+xml'); Dialog.info('Okno pro tisk bylo zablokováno — výkres se stáhl jako SVG.'); return; }
    w.document.write(`<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><title>Výkres — rozteče os</title>
      <style>@page{margin:8mm} body{margin:0;background:#fff} svg{display:block} p{font:12px sans-serif;margin:6px 0}@media print{p{display:none}}</style></head>
      <body><p>Tiskněte v měřítku 100 % (bez „přizpůsobit stránce“), aby výkres odpovídal 1 : 1.</p>${svg}</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* uživatel okno zavřel */ } }, 300);
  }
  const klik = (id, fn) => el(id).addEventListener('click', fn);
  klik('btnNova', novaPlocha);
  klik('btnStl', () => exportStl('deska'));
  klik('btnStlVybrany', () => exportStl('vybrany'));
  klik('btnStlZip', () => exportStl('zip'));
  klik('btnStlSestava', () => exportStl('sestava'));
  klik('btn3mf', () => { if (!prazdnaPlocha()) stahni(KRAB.soubor3mf(dilyNaDesce(), 'Skládačka soukolí'), 'skladacka_soukoli.3mf', 'model/3mf'); });
  const csv = () => stahni('﻿' + J.csv(S), 'kusovnik_skladacka.csv', 'text/csv;charset=utf-8');
  klik('btnCsv', csv); klik('btnCsvMenu', csv);
  klik('btnVykresSvg', () => { if (!prazdnaPlocha()) stahni(J.svgVykres(S, R), 'skladacka_vykres.svg', 'image/svg+xml'); });
  klik('btnVykresDxf', () => { if (!prazdnaPlocha()) stahni(J.dxfVykres(S, R), 'skladacka_vykres.dxf', 'application/dxf'); });
  klik('btnVykresTisk', tiskVykresu);
  klik('btnPlochaSvg', () => { if (!prazdnaPlocha()) stahni(J.svgPlocha(S, R, uhelMotoru()), 'skladacka_soukoli.svg', 'image/svg+xml'); });
  klik('btnPlochaPng', () => { kresli(); platno.toBlob(b => b && stahni(b, 'skladacka_soukoli.png')); });
  klik('btnFit', () => { if (zobr.d3 || zobr.tisk) nahled.pohled('ponech'); else prizpusob(); });

  /* ---------- ovládání a start ---------- */
  // okno vlastností: zavírací křížek a přetahování za hlavičku
  (function () {
    const okno = el('okno'), hlava = el('oknoHlava');
    klik('oknoZavrit', () => vyber(null));
    klik('iSmazat', smazVybrany);
    klik('iDuplikat', duplikujVybrany);
    el('oknoNazev').addEventListener('change', () => {
      const p = vybrany && najdi(vybrany);
      const t = el('oknoNazev').value.trim();
      if (!p || !t || t === p.nazev) return;
      zmenDil(p.id, q => { q.nazev = t; });
    });
    el('oknoNazev').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
    el('oknoBarva').addEventListener('change', () => {
      const p = vybrany && najdi(vybrany);
      if (p) zmenDil(p.id, q => { q.barva = el('oknoBarva').value; });
    });
    window.addEventListener('resize', udrzOknoVidet);
    let tah = null;
    hlava.addEventListener('pointerdown', e => {
      if (e.target.closest('button, input') || jeMobil()) return;
      try { hlava.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
      tah = { x: e.clientX - okno.offsetLeft, y: e.clientY - okno.offsetTop };
    });
    hlava.addEventListener('pointermove', e => {
      if (!tah) return;
      okno.style.left = (e.clientX - tah.x) + 'px';
      okno.style.top = (e.clientY - tah.y) + 'px';
      udrzOknoVidet();
    });
    const konec = () => { tah = null; };
    hlava.addEventListener('pointerup', konec);
    hlava.addEventListener('pointercancel', konec);
  })();

  // paleta a příklady
  const dlazdice = q => `<button type="button" class="dil" data-id="${q.id}" aria-pressed="false" title="${q.nazev}">
    <svg viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKONY[q.id]}</svg>${q.nazev}</button>`;
  el('paleta').innerHTML = `<button type="button" class="dil dil-vyber" id="btnVyber" data-id="" aria-pressed="true" title="Výběr a posun dílů (Esc)">
      <svg viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l13 11-6 1 3.5 7-3 1.4-3.4-7L9 22z"/></svg>Výběr a posun</button>` +
    PALETA.filter(q => !q.nastroj).map(dlazdice).join('') +
    '<div class="oddelovac">Spojení</div>' + PALETA.filter(q => q.nastroj).map(dlazdice).join('');
  el('paleta').addEventListener('click', e => {
    const b = e.target.closest('.dil');
    if (!b) return;
    const id = b.dataset.id;
    nastavNastroj(!id || nastroj === id ? null : id);
  });
  el('seznamPredvoleb').innerHTML = '<button type="button" class="pol" role="menuitem" data-nova="1">📄 Prázdná plocha</button>' +
    J.PRIKLADY.map((p, i) => `<button type="button" class="pol" role="menuitem" data-pr="${i}">${esc(p.nazev)}</button>`).join('');
  el('seznamPredvoleb').addEventListener('click', e => {
    const b = e.target.closest('.pol'); if (!b) return;
    if (b.dataset.nova) novaPlocha(); else nactiPriklad(+b.dataset.pr);
  });

  el('gAnimace').addEventListener('input', () => {
    const v = +el('gAnimace').value;
    el('gAnimaceTxt').textContent = f(v, 2) + '×';
    app.zmen(q => { q.nast.animace = v; }, 'animace');
  });
  klik('btnPlay', () => prepniHrani(!hraje));
  klik('btnNula', () => { cas = 0; kresli(); if (zobr.d3) pohyb3d(0); });
  klik('tPopisky', () => app.zmen(q => { q.nast.popisky = !q.nast.popisky; }));
  klik('n2d', () => { nastav3d(false); if (zobr.tisk) el('tTisk').click(); });
  klik('n3d', () => nastav3d(true));

  TrubkyGui.pripoj({ klic: KLIC + '_gui', pohled: j => { nastav3d(true); nahled.pohled(j); } });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); el('legPrevisy').hidden = !(h && zobr.tisk); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('t3d', h => prepniNahled(h), true);
  app.prepinac('tTisk', h => { zobr.tisk = h; klic3d = ''; prepniNahled(zobr.d3); });

  document.addEventListener('keydown', e => {
    const vPoli = e.target.closest && e.target.closest('input, select, textarea');
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') { if (!nastroj && vybrany) vyber(null); nastavNastroj(null); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && vybrany) { e.preventDefault(); smazVybrany(); return; }
    if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); prepniHrani(!hraje); }
  });
  new ResizeObserver(velikost).observe(el('platnoBox'));

  function prepniHrani(h) {
    hraje = h; posledni = 0;
    el('btnPlay').textContent = h ? '⏸ Pauza' : '▶ Přehrát';
    el('btnPlay').setAttribute('aria-pressed', String(h));
  }
  let posledni = 0;
  function smycka(ts) {
    if (hraje) {
      const dt = posledni ? Math.min(0.1, (ts - posledni) / 1000) : 0; cas += dt;
      if (zobr.d3 && !zobr.tisk) pohyb3d(uhelMotoru()); else if (!zobr.tisk) kresli();
    }
    posledni = ts;
    requestAnimationFrame(smycka);
  }

  // start: starý odkaz #s= (dřívější sdílení) má přednost před uloženou sestavou
  const m = /#s=([\w-]+)/.exec(location.hash);
  if (m) {
    try { const r = J.normalizuj(J.zOdkazuS(m[1])); if (r.p.prvky.length) Object.assign(app.p, r.p); } catch (e) { Dialog.chyba('Odkaz je poškozený – sestavu z něj nejde načíst.'); }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sandbox */ }
  }
  if (!app.p.prvky.length) { const pr = J.vychozi(); Object.assign(app.p, { prvky: pr.prvky, vazby: pr.vazby, dalsiId: pr.dalsiId }); }
  nactiBarvy();
  nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
  sync();
  velikost();
  app.start().then(() => { prizpusob(); });
  prizpusob();
  nastavNastroj(null);
  requestAnimationFrame(smycka);
  window.SKLADACKA = {
    svgVykres: () => J.svgVykres(S, R), dxfVykres: () => J.dxfVykres(S, R), podkladyVykresu: () => J.podkladyVykresu(S, R),
    siteDilu: (p, x, y, rot, dz, posun) => J.siteDilu(p, troj, x, y, rot, dz, posun), stlBinarni: J.stlBinarni, zip: J.zip, vyber,
    stav: () => S, reseni: () => R, nactiPriklad, PRIKLADY: J.PRIKLADY, zmena, prichyt, najdi, nastavCas: t => { cas = t; kresli(); }, analyzuj: () => J.analyzuj(S),
    app, nahled, prepniNahled: nastav3d,
  };
})();
