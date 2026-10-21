/* ============================================================
   Krumpáč – vykreslování, ovládání, obrazovky (titul, mapa dolu, obchod, hra).
   Logické rozlišení 480×270, plátno se zvětšuje CSS (pixelated).
   ============================================================ */
var KRUMPAC = (typeof KRUMPAC !== 'undefined') ? KRUMPAC : (typeof global !== 'undefined' && global.KRUMPAC) || {};
if (typeof global !== 'undefined') global.KRUMPAC = KRUMPAC;

KRUMPAC.ui = (function (K) {
  'use strict';
  const W = 480, H = 270, T = K.T;
  const Z = K.zvuk, HU = K.hudba;
  let cv, g, svetlo, sg;
  const obr = {};
  const PNG = ['trpaslik', 'goblin', 'netopyr', 'sliz', 'drahokam', 'srdce', 'krumpac', 'kamen', 'goblin_beh', 'netopyr_let', 'trpaslik_beh',
    'pavouk', 'kostlivec', 'krtek', 'ryba', 'boss_goblin', 'boss_pavouk', 'boss_uhor', 'boss_golem',
    'stit', 'ostep', 'sekera', 'zlate_srdce', 'hvezda', 'tex_led', 'tex_voda', 'tex_kovarna'];
  const WEBP = ['pozadi', 'titul', 'pozadi_led', 'pozadi_voda', 'pozadi_kovarna', 'mapa'];
  // animační pásy: počet snímků vedle sebe (snímky jsou kreslené otočené doprava)
  const PASY = { goblin_beh: 4, netopyr_let: 2, trpaslik_beh: 4 };

  const SVETY = {
    1: { nazev: 'Důl', pozadi: 'pozadi', textura: 'kamen', tma: 0.82, okraj: 'mech', kapky: 'rgba(140,190,255,.5)' },
    2: { nazev: 'Ledové jeskyně', pozadi: 'pozadi_led', textura: 'tex_led', tma: 0.62, okraj: 'snih', kapky: 'rgba(230,245,255,.7)' },
    3: { nazev: 'Zatopené štoly', pozadi: 'pozadi_voda', textura: 'tex_voda', tma: 0.8, okraj: 'mech', kapky: 'rgba(140,220,200,.6)' },
    4: { nazev: 'Kovárna', pozadi: 'pozadi_kovarna', textura: 'tex_kovarna', tma: 0.66, okraj: 'saze', kapky: 'rgba(255,170,90,.6)' },
  };

  // ---------- uložená data ----------
  const KLIC = { postup: 'webapp_hra_krumpac_postup', hvezdy: 'webapp_hra_krumpac_hvezdy', drahokamy: 'webapp_hra_krumpac_drahokamy', vybava: 'webapp_hra_krumpac_vybava' };
  function cti(klic, vychozi) {
    try { const v = localStorage.getItem(klic); return v === null ? vychozi : JSON.parse(v); } catch { return vychozi; }
  }
  function uloz(klic, hodnota) { try { localStorage.setItem(klic, JSON.stringify(hodnota)); } catch { /* soukromé okno */ } }
  const data = {
    postup: Math.max(0, Math.min(K.urovne.length - 1, parseInt(cti(KLIC.postup, 0), 10) || 0)),
    hvezdy: cti(KLIC.hvezdy, {}) || {},
    drahokamy: Math.max(0, parseInt(cti(KLIC.drahokamy, 0), 10) || 0),
    vybava: Object.assign({ maxSrdci: K.MAX_SRDCI, dvojskok: false, silnyKrumpac: false, sekera: false, zbroj: false }, cti(KLIC.vybava, {}) || {}),
  };
  function ulozVse() { uloz(KLIC.postup, data.postup); uloz(KLIC.hvezdy, data.hvezdy); uloz(KLIC.drahokamy, data.drahokamy); uloz(KLIC.vybava, data.vybava); }

  const ZBOZI = [
    { id: 'srdce', nazev: 'Srdce navíc', popis: '+1 srdce do začátku každé úrovně', ceny: [25, 45], stupen: v => v.maxSrdci - K.MAX_SRDCI, kup: v => { v.maxSrdci++; } },
    { id: 'dvojskok', nazev: 'Dvojitý skok', popis: 'Ve vzduchu ještě jednou vyskočíš', ceny: [35], stupen: v => +v.dvojskok, kup: v => { v.dvojskok = true; } },
    { id: 'krumpac', nazev: 'Kovaný krumpáč', popis: 'Úder krumpáčem má dvojnásobnou sílu', ceny: [30], stupen: v => +v.silnyKrumpac, kup: v => { v.silnyKrumpac = true; } },
    { id: 'sekera', nazev: 'Vrhací sekera', popis: 'Hod klávesou C – bez omezení, s prodlevou', ceny: [25], stupen: v => +v.sekera, kup: v => { v.sekera = true; } },
    { id: 'zbroj', nazev: 'Kožená zbroj', popis: 'Každou úroveň začínáš se štítem', ceny: [20], stupen: v => +v.zbroj, kup: v => { v.zbroj = true; } },
  ];

  // ---------- stav aplikace ----------
  let obrazovka = 'titul';   // titul | mapa | obchod | hra | pauza | smrt | hotovo | vitezstvi
  let st = null, urovenIdx = 0, bodyCelkem = 0, bodyNaZacatku = 0;
  let vrstvaDlazdic = null, kamera = { x: 0, y: 0 }, otres = 0;
  let casObrazovky = 0, rekord = null, novyRekord = false;
  let zastaveni = 0, popisky = [];
  let vyber = data.postup, vyberObchod = 0, nesene = { stit: 0, ostepy: 0 };
  let vysledek = null;      // po dokončení úrovně: { hvezdy, nove, drahokamy }
  let hlaska = null;        // krátká zpráva v obchodě
  const vstup = { vlevo: false, vpravo: false, nahoru: false, dolu: false, skok: false, utok: false, hod: false };
  const klavesy = new Set(), dotyk = {};

  // ---------- načtení obrázků ----------
  function nactiObrazky() {
    const cesta = 'krumpac/img/';
    const nacti = (j, pripona) => new Promise(ok => {
      const i = new Image(); i.onload = () => { obr[j] = i; ok(); }; i.onerror = () => ok(); i.src = cesta + j + pripona;
    });
    return Promise.all([...PNG.map(j => nacti(j, '.png')), ...WEBP.map(j => nacti(j, '.webp'))]);
  }

  // ---------- dlaždice (předkreslené do velkého plátna) ----------
  const vizPevna = c => c === '#' || c === 'X' || c === 'I' || c === '(' || c === ')' || c === 'F';
  const svet = () => SVETY[st ? st.svet : 1] || SVETY[1];

  function texturaKamene() { return obr[svet().textura] || obr.kamen; }

  function kresliKamen(c2, tx, ty, x, y, tex, nadTint) {
    if (tex) c2.drawImage(tex, (tx * T) % 32, (ty * T) % 32, T, T, x, y, T, T);
    else { c2.fillStyle = '#4a4550'; c2.fillRect(x, y, T, T); }
    if (nadTint) { c2.fillStyle = nadTint; c2.fillRect(x, y, T, T); }
  }

  function kresliDlazdici(c2, tx, ty) {
    const c = K.dlazdice(st, tx, ty), x = tx * T, y = ty * T;
    c2.clearRect(x, y, T, T);
    if (c === '#' || c === 'X' || c === 'I') {
      if (c === 'I') kresliKamen(c2, tx, ty, x, y, obr.tex_led || obr.kamen, obr.tex_led ? 'rgba(220,240,255,.12)' : 'rgba(150,210,255,.45)');
      else kresliKamen(c2, tx, ty, x, y, texturaKamene());
      if (c === 'X') {
        c2.fillStyle = 'rgba(190,150,100,.28)'; c2.fillRect(x, y, T, T);
        c2.fillStyle = '#1b1612';
        [[3, 2, 1, 5], [4, 6, 3, 1], [7, 7, 1, 4], [8, 10, 4, 1], [11, 3, 1, 4], [10, 2, 3, 1], [5, 12, 1, 3]].forEach(([a, b, w, h]) => c2.fillRect(x + a, y + b, w, h));
        c2.fillStyle = 'rgba(255,220,160,.35)'; c2.fillRect(x + 1, y + 1, T - 2, 1);
      }
      // osvětlená horní hrana podle světa (mech / sníh / saze), stinné boky
      if (!vizPevna(K.dlazdice(st, tx, ty - 1))) {
        const okraj = c === 'I' ? 'snih' : svet().okraj;
        c2.fillStyle = 'rgba(200,190,220,.45)'; c2.fillRect(x, y, T, 1);
        c2.fillStyle = okraj === 'snih' ? 'rgba(240,250,255,.9)' : okraj === 'saze' ? 'rgba(255,140,60,.55)' : 'rgba(80,130,90,.75)';
        for (let i = 0; i < T; i += 3) if ((tx * 7 + i * 3) % 5 < 3) c2.fillRect(x + i, y + 1, 2, 1 + ((tx + i) % 3 === 0));
        if (okraj === 'snih') { c2.fillStyle = 'rgba(255,255,255,.85)'; c2.fillRect(x, y, T, 2); }
      }
      if (!vizPevna(K.dlazdice(st, tx, ty + 1))) { c2.fillStyle = 'rgba(0,0,0,.45)'; c2.fillRect(x, y + T - 2, T, 2); }
      if (!vizPevna(K.dlazdice(st, tx - 1, ty))) { c2.fillStyle = 'rgba(0,0,0,.3)'; c2.fillRect(x, y, 1, T); }
      if (!vizPevna(K.dlazdice(st, tx + 1, ty))) { c2.fillStyle = 'rgba(0,0,0,.3)'; c2.fillRect(x + T - 1, y, 1, T); }
    } else if (c === '(' || c === ')') {
      c2.fillStyle = '#2c2c32'; c2.fillRect(x, y, T, T);
      c2.fillStyle = '#55565e'; c2.fillRect(x, y + 4, T, T - 6);
      c2.fillStyle = '#1b1b20'; c2.fillRect(x, y + T - 2, T, 2);
      c2.fillStyle = '#8a8c96'; c2.beginPath(); c2.arc(x + 8, y + 10, 3, 0, Math.PI * 2); c2.fill();
    } else if (c === '=') {
      c2.fillStyle = '#7a4f2a'; c2.fillRect(x, y, T, 5);
      c2.fillStyle = '#a06c3c'; c2.fillRect(x, y, T, 1);
      c2.fillStyle = '#4a2e18'; c2.fillRect(x, y + 4, T, 1); c2.fillRect(x + ((tx * 5) % 12) + 2, y + 1, 1, 3);
      if (K.dlazdice(st, tx - 1, ty) !== '=' || K.dlazdice(st, tx + 1, ty) !== '=') {
        c2.fillStyle = '#5a3a20';
        const sx = K.dlazdice(st, tx - 1, ty) !== '=' ? x + 2 : x + T - 4;
        c2.fillRect(sx, y + 5, 2, 6);
      }
    } else if (c === '|') {   // žebřík
      c2.fillStyle = '#7a5530'; c2.fillRect(x + 3, y, 2, T); c2.fillRect(x + T - 5, y, 2, T);
      c2.fillStyle = '#a57440'; for (let i = 2; i < T; i += 5) c2.fillRect(x + 3, y + i, T - 6, 2);
    } else if (c === '!') {   // lano
      c2.fillStyle = '#b8955a'; c2.fillRect(x + 7, y, 2, T);
      c2.fillStyle = '#7d6236'; for (let i = 0; i < T; i += 4) c2.fillRect(x + 7 + (i % 8 ? 1 : 0), y + i, 1, 2);
    } else if (c === '^') {
      for (let i = 0; i < 4; i++) {
        const bx = x + i * 4;
        c2.fillStyle = '#9aa0aa';
        for (let r = 0; r < 7; r++) { const w = Math.max(1, Math.round((r + 1) * 4 / 7)); c2.fillRect(bx + 2 - Math.ceil(w / 2), y + 9 + r, w, 1); }
        c2.fillStyle = '#e8ecf2'; c2.fillRect(bx + 1, y + 9, 1, 1);
      }
    }
    // '~', 'L', 'W', 'F' a pásy se kreslí v každém snímku (pohyb, průhlednost)
  }

  function predkresliUroven() {
    vrstvaDlazdic = document.createElement('canvas');
    vrstvaDlazdic.width = st.sirka * T; vrstvaDlazdic.height = st.vyska * T;
    const c2 = vrstvaDlazdic.getContext('2d');
    for (let ty = 0; ty < st.vyska; ty++) for (let tx = 0; tx < st.sirka; tx++) kresliDlazdici(c2, tx, ty);
  }

  function prekresliOkoli(px, py) {
    const c2 = vrstvaDlazdic.getContext('2d');
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++)
      if (x >= 0 && y >= 0 && x < st.sirka && y < st.vyska) kresliDlazdici(c2, x, y);
  }

  // ---------- přechody mezi obrazovkami ----------
  function hudbaPro() {
    if (obrazovka === 'hra' || obrazovka === 'pauza' || obrazovka === 'smrt') return st && st.boss ? 'boss' : String(st ? st.svet : 1);
    if (obrazovka === 'hotovo' || obrazovka === 'vitezstvi') return null;
    return 'mapa';
  }
  function nastavObrazovku(o) { obrazovka = o; casObrazovky = 0; if (HU) HU.hraj(hudbaPro()); }

  function zacniUroven(i) {
    urovenIdx = i; vyber = i;
    const vybava = Object.assign({}, data.vybava, { stit: nesene.stit, ostepy: nesene.ostepy });
    st = K.nactiUroven(K.urovne[i], vybava);
    bodyNaZacatku = bodyCelkem;
    predkresliUroven();
    kamera.x = Math.max(0, Math.min(st.sirka * T - W, st.hrac.x - W / 3)); kamera.y = Math.max(0, st.vyska * T - H);
    popisky = []; zastaveni = 0; vysledek = null;
    nastavObrazovku('hra');
  }

  function naMapu() { st = null; nastavObrazovku('mapa'); vyber = Math.min(vyber, data.postup); }

  function dokonciUroven() {
    const h = st.hrac;
    bodyCelkem = bodyNaZacatku + st.body;
    // hvězdičky: 1 = všechny drahokamy, 2 = bez smrti, 4 = čas pod limitem
    const bity = (st.sebrano >= st.drahokamu ? 1 : 0) | (st.umrti === 0 ? 2 : 0) | (!st.limit || st.cas <= st.limit ? 4 : 0);
    const predtim = data.hvezdy[urovenIdx] || 0;
    data.hvezdy[urovenIdx] = predtim | bity;
    data.drahokamy += st.sebrano;
    data.postup = Math.max(data.postup, Math.min(K.urovne.length - 1, urovenIdx + 1));
    nesene = { stit: Math.max(0, h.stit - (data.vybava.zbroj ? 1 : 0)), ostepy: h.ostepy };
    vysledek = { hvezdy: bity, nove: bity & ~predtim, drahokamy: st.sebrano };
    ulozVse();
    novyRekord = rekord.zapis(bodyCelkem);
    nastavObrazovku(urovenIdx + 1 < K.urovne.length ? 'hotovo' : 'vitezstvi');
  }

  // ---------- krok hry ----------
  function aktualizuj() {
    casObrazovky += K.DT;
    for (const p of popisky) { p.t += K.DT; p.y -= 22 * K.DT; }
    popisky = popisky.filter(p => p.t < (p.dlouho ? 2 : 0.9));
    if (obrazovka !== 'hra') return;
    if (zastaveni > 0) { zastaveni -= K.DT; return; }      // krátké zamrznutí po zásahu
    K.krok(st, vstup);
    for (const u of st.udalosti) {
      Z.hraj(u.druh);
      if (u.body) popisky.push({ text: '+' + u.body, x: u.x, y: u.y - 4, t: 0 });
      if (u.druh === 'tajne') popisky.push({ text: 'Tajná místnost!', x: u.x, y: u.y - 16, t: 0, dlouho: true });
      if (u.druh === 'boss_faze') popisky.push({ text: 'Zuří!', x: u.x + 12, y: u.y - 8, t: 0, dlouho: true });
      if (u.druh === 'zabiti' || u.druh === 'zasah' || u.druh === 'boss_zasah') zastaveni = u.druh === 'zabiti' ? 0.07 : 0.045;
      if (u.druh === 'krapnik' || u.druh === 'rozpad' || u.druh === 'lis') otres = Math.max(otres, u.druh === 'rozpad' ? 0.06 : 0.12);
      if (u.druh === 'dupnuti' || u.druh === 'naraz') otres = 0.3;
      if (u.druh === 'boss_porazen') { otres = 0.5; zastaveni = 0.4; }
      if (u.druh === 'skala') { prekresliOkoli(u.x + 8, u.y + 8); otres = 0.15; }
      if (u.druh === 'zraneni' || u.druh === 'pad') otres = 0.25;
    }
    // kamera s mrtvou zónou
    const h = st.hrac, cil = h.x + h.w / 2 - W / 2 + h.smer * 30;
    kamera.x += (cil - kamera.x) * 0.08;
    kamera.x = Math.max(0, Math.min(st.sirka * T - W, kamera.x));
    const cilY = h.y - H * 0.55;
    kamera.y += (cilY - kamera.y) * 0.1;
    kamera.y = Math.max(0, Math.min(st.vyska * T - H, kamera.y));
    otres = Math.max(0, otres - K.DT);
    if (st.konec === 'cil') dokonciUroven();
    else if (st.konec === 'smrt') nastavObrazovku('smrt');
  }

  // ---------- kreslení: pomocné ----------
  function sprite(img, x, y, smer, opts) {
    // x,y = střed paty; smer 1 = doprava
    const o = opts || {};
    if (!img) { g.fillStyle = o.nahrada || '#c33'; g.fillRect(Math.round(x - (o.nw || 12) / 2), Math.round(y - (o.nh || 16)), o.nw || 12, o.nh || 16); return; }
    const sx = (o.sx || 1), sy = (o.sy || 1);
    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (o.rot) g.rotate(o.rot);
    g.scale(smer * sx * (o.meritko || 1), sy * (o.flipY ? -1 : 1) * (o.meritko || 1));
    if (o.alfa !== undefined) g.globalAlpha = o.alfa;
    if (o.filtr) g.filter = o.filtr;
    if (o.snimek !== undefined) {
      const n = PASY[o.pas], sw = img.width / n, i = ((o.snimek % n) + n) % n;
      g.drawImage(img, i * sw, 0, sw, img.height, -Math.round(sw / 2), o.flipY ? 0 : -img.height, sw, img.height);
    } else if (o.orez) {   // zobrazit jen horní část (krtek vylézající ze země)
      const vh = Math.max(1, Math.round(img.height * o.orez));
      g.drawImage(img, 0, 0, img.width, vh, -Math.round(img.width / 2), -vh, img.width, vh);
    } else g.drawImage(img, -Math.round(img.width / 2), o.flipY ? 0 : -img.height);
    g.restore();
  }

  function text(t, x, y, zarovnani, barva, vel, tucne) {
    g.font = `${tucne === false ? '' : 'bold '}${vel || 10}px 'Courier New', monospace`;
    g.textAlign = zarovnani || 'left';
    g.fillStyle = '#000'; g.fillText(t, x + 1, y + 1);
    g.fillStyle = barva || '#fff'; g.fillText(t, x, y);
  }
  function zatemni(a) { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, W, H); }
  const blika = () => Math.floor(casObrazovky * 2) % 2 === 0;
  const dotykove = () => document.body.classList.contains('dotykove');
  function hvezda(x, y, plna, vel) {
    const r = vel || 6;
    if (obr.hvezda) { g.globalAlpha = plna ? 1 : 0.25; g.drawImage(obr.hvezda, Math.round(x - r), Math.round(y - r), 2 * r, 2 * r); g.globalAlpha = 1; return; }
    g.fillStyle = plna ? '#ffd23a' : 'rgba(255,255,255,.2)';
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.fill();
  }
  function tlacitko(x, y, w, h, popis, aktivni) {
    g.fillStyle = aktivni ? 'rgba(224,160,64,.85)' : 'rgba(30,26,34,.85)'; g.fillRect(x, y, w, h);
    g.strokeStyle = aktivni ? '#ffe0a0' : '#6b6070'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    text(popis, x + w / 2, y + h / 2 + 4, 'center', aktivni ? '#1a1206' : '#e8dcc0', 10);
    return { x, y, w, h };
  }

  // ---------- kreslení: svět ----------
  function kresliPozadi(cas) {
    g.fillStyle = '#0b0a12'; g.fillRect(0, 0, W, H);
    const p = obr[svet().pozadi] || obr.pozadi;
    if (p) {
      const sirka = Math.round(p.width * (H + 20) / p.height), ox = -((kamera.x * 0.3) % (sirka * 2));
      for (let x = ox; x < W; x += sirka) {
        const zrcadlo = Math.floor((x - ox) / sirka) % 2 === 1;
        g.save();
        if (zrcadlo) { g.translate(x + sirka, 0); g.scale(-1, 1); g.drawImage(p, 0, -kamera.y * 0.15, sirka, H + 20); }
        else g.drawImage(p, x, -kamera.y * 0.15, sirka, H + 20);
        g.restore();
      }
      g.fillStyle = 'rgba(8,6,16,.15)'; g.fillRect(0, 0, W, H);
    }
    // padající kapky (v kovárně jiskry vzhůru)
    g.fillStyle = svet().kapky;
    const nahoru = st.svet === 4;
    for (let i = 0; i < 6; i++) {
      const sx = ((i * 137 + 40) % (W + 80)) - ((kamera.x * 0.6) % (W + 80));
      const fx = sx < -40 ? sx + W + 80 : sx;
      const fy = nahoru ? 260 - ((cas * 60 + i * 53) % 260) : ((cas * 90 + i * 53) % 260);
      g.fillRect(Math.round(fx), Math.round(fy), 1, nahoru ? 2 : 3);
    }
  }

  function kresliVychod(cas) {
    const c = st.cil; if (!c) return;
    const x = Math.round(c.x - kamera.x), y = Math.round(c.y - kamera.y);
    g.fillStyle = '#3b2616'; g.fillRect(x - 3, y - 3, T + 6, 2 * T + 3);
    g.fillStyle = '#120c08'; g.fillRect(x, y, T, 2 * T);
    if (st.cilZamceno) {   // mříž, dokud boss žije
      g.fillStyle = '#6d7078'; for (let i = 2; i < T; i += 4) g.fillRect(x + i, y, 2, 2 * T);
      g.fillRect(x, y + 8, T, 2); g.fillRect(x, y + 20, T, 2);
    } else {
      const jas = 0.55 + Math.sin(cas * 3) * 0.15;
      g.fillStyle = `rgba(255,200,90,${jas})`; g.fillRect(x + 2, y + 4, T - 4, 2 * T - 4);
    }
    g.fillStyle = '#6b4424'; g.fillRect(x - 3, y - 3, T + 6, 2); g.fillRect(x - 3, y - 3, 2, 2 * T + 3); g.fillRect(x + T + 1, y - 3, 2, 2 * T + 3);
    g.fillStyle = '#e8d8a0'; g.font = 'bold 8px monospace'; g.textAlign = 'center';
    g.fillText(st.cilZamceno ? 'ZAMČENO' : 'VÝCHOD', x + T / 2, y - 6);
  }

  function kresliPredmety(cas) {
    for (const p of st.predmety) {
      if (p.sebrano) continue;
      const x = p.x - kamera.x, y = p.y - kamera.y;
      if (x < -20 || x > W + 20) continue;
      const bob = Math.round(Math.sin(p.faze * 3) * 1.5);
      if (p.druh === 'drahokam' || p.druh === 'srdce') {
        sprite(obr[p.druh], x + p.w / 2, y + p.h + bob, 1);
        if (p.druh === 'drahokam' && Math.sin(p.faze * 5) > 0.92) { g.fillStyle = '#fff'; g.fillRect(Math.round(x + 7), Math.round(y + bob), 1, 1); g.fillRect(Math.round(x + 6), Math.round(y + bob + 1), 3, 1); }
      } else if (p.druh === 'stit') {
        sprite(obr.stit, x + p.w / 2, y + p.h + bob, 1, { nahrada: '#b07a3a', nw: 12, nh: 12 });
      } else if (p.druh === 'ostep') {
        if (obr.ostep) sprite(obr.ostep, x + p.w / 2, y + p.h + bob, 1);
        else { g.fillStyle = '#8a6a40'; g.fillRect(Math.round(x), Math.round(y + 6 + bob), 14, 2); g.fillStyle = '#d8dce4'; g.fillRect(Math.round(x + 12), Math.round(y + 5 + bob), 3, 4); }
        text('×3', Math.round(x + p.w + 2), Math.round(y + 4 + bob), 'left', '#ffe6a0', 7);
      } else if (p.druh === 'kontrola') {
        const zx = Math.round(x + p.w / 2), zy = Math.round(y + p.h);
        g.fillStyle = '#4b3220'; g.fillRect(zx - 1, zy - 14, 2, 14);
        g.fillStyle = '#2a2a30'; g.fillRect(zx - 3, zy - 20, 7, 7);
        if (p.aktivni) { g.fillStyle = `rgba(255,${180 + Math.round(Math.sin(cas * 12) * 30)},80,1)`; g.fillRect(zx - 1, zy - 18, 3, 4); }
        else { g.fillStyle = '#555'; g.fillRect(zx - 1, zy - 18, 3, 4); }
      }
    }
  }

  function kresliNepratele(cas) {
    for (const n of st.nepratele) {
      const x = n.x + n.w / 2 - kamera.x, y = n.y + n.h - kamera.y;
      if (x < -30 || x > W + 30) continue;
      const o = {};
      if (n.zasah > 0 && Math.floor(cas * 20) % 2) o.filtr = 'brightness(2.6)';
      if (n.mrtvy) { o.rot = n.mrtvy * 6 * (n.vx >= 0 ? 1 : -1); o.alfa = Math.max(0, 1 - n.mrtvy / 1.2); }
      if (n.druh === 'g') {
        if (n.stav === 'pozor' && !n.mrtvy) {
          const by = Math.round(y - 32 - Math.abs(Math.sin(n.faze * 18)) * 2);
          g.fillStyle = '#ffd23a'; g.fillRect(Math.round(x) - 1, by, 3, 6); g.fillRect(Math.round(x) - 1, by + 8, 3, 2);
        }
        if (obr.goblin_beh) { o.pas = 'goblin_beh'; o.snimek = n.mrtvy || n.zasah > 0.15 ? 0 : Math.floor(n.faze * 7); sprite(obr.goblin_beh, x, y + (n.mrtvy ? -10 : 0), n.smer, o); }
        else sprite(obr.goblin, x, y + (n.mrtvy ? -10 : 0), n.smer, o);
      } else if (n.druh === 's') {
        const k = n.naZemi ? 1 + Math.sin(n.faze * 6) * 0.06 : (n.vy < 0 ? 0.85 : 1.1);
        o.sx = 1 / k; o.sy = k;
        sprite(obr.sliz, x, y, n.smer, o);
      } else if (n.druh === 'b') {
        if (n.stav === 'spi') { o.flipY = true; sprite(obr.netopyr, x, n.y - kamera.y, 1, o); }
        else if (obr.netopyr_let) { o.pas = 'netopyr_let'; o.snimek = Math.floor(n.faze * 9); sprite(obr.netopyr_let, x, y + 1, n.smer, o); }
        else sprite(obr.netopyr, x, y + 2, n.smer, o);
      } else if (n.druh === 'p') {
        if (!n.mrtvy) { g.fillStyle = 'rgba(220,220,230,.6)'; g.fillRect(Math.round(x), Math.round(n.kotva - kamera.y), 1, Math.max(0, Math.round(n.y - n.kotva))); }
        o.nahrada = '#2a2a33'; o.nw = 12; o.nh = 10;
        sprite(obr.pavouk, x, y + 2, 1, o);
      } else if (n.druh === 'k') {
        o.nahrada = '#e0dccc'; o.nw = 10; o.nh = 20;
        sprite(obr.kostlivec, x, y, n.smer, o);
        if (n.napina && !n.mrtvy) { g.fillStyle = '#fff6d0'; g.fillRect(Math.round(x + n.smer * 8), Math.round(y - 15), 2, 2); }
      } else if (n.druh === 'm') {
        g.fillStyle = '#4a3322'; g.fillRect(Math.round(x - 8), Math.round(y - 2), 16, 3);   // hromádka hlíny
        g.fillStyle = '#6b4a2f'; g.fillRect(Math.round(x - 6), Math.round(y - 4), 12, 2);
        if (n.stav !== 'schovany') { o.orez = n.mrtvy ? 1 : n.vynor; o.nahrada = '#7a5030'; o.nw = 12; o.nh = Math.round(12 * (n.vynor || 0)); sprite(obr.krtek, x, y - 2, n.smer, o); }
      } else if (n.druh === 'r') {
        o.nahrada = '#4a90d0'; o.nw = 14; o.nh = 8;
        sprite(obr.ryba, x, y + 1, n.smer, o);
      }
    }
  }

  function kresliBosse(cas) {
    const b = st.boss; if (!b) return;
    if (b.mrtvy > 1.6) return;
    const img = obr['boss_' + b.typ];
    const x = b.x + b.w / 2 - kamera.x, y = b.y + b.h - kamera.y;
    const o = { nahrada: '#7a2020', nw: b.w, nh: b.h };
    if (img) o.meritko = (b.h * 1.35) / img.height;
    if (b.nezranitelny > 0 && Math.floor(cas * 24) % 2) o.filtr = 'brightness(2.4)';
    if ((b.stav === 'napriah' || (b.stav === 'hod' && b.cas > 0.45)) && Math.floor(cas * 16) % 2) o.filtr = 'brightness(1.6) sepia(1) hue-rotate(-30deg) saturate(4)';
    if (b.mrtvy) { o.alfa = Math.max(0, 1 - b.mrtvy / 1.6); o.rot = b.mrtvy * 0.6 * -b.smer; }
    if (b.typ === 'pavouk') {   // vlákno ke stropu
      g.fillStyle = 'rgba(220,240,255,.7)'; g.fillRect(Math.round(x), 0, 1, Math.max(0, Math.round(b.y - kamera.y)));
    }
    if (b.typ === 'uhor' && b.stav === 'plave') o.alfa = 0.55;
    sprite(img, x, y + (img ? Math.round(b.h * 0.1) : 0), b.typ === 'pavouk' ? 1 : b.smer, o);
    if (b.typ === 'golem' && b.stav === 'jadro') {   // obnažené jádro svítí
      const r = 6 + Math.sin(cas * 12) * 2;
      const gr = g.createRadialGradient(x, y - b.h * 0.55, 0, x, y - b.h * 0.55, r * 2);
      gr.addColorStop(0, 'rgba(255,230,120,.95)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = gr; g.fillRect(x - r * 2, y - b.h * 0.55 - r * 2, r * 4, r * 4);
    }
    if (b.stav === 'omraceny') for (let i = 0; i < 3; i++) {   // hvězdičky nad hlavou
      const a = cas * 5 + i * 2.1;
      g.fillStyle = '#ffd23a'; g.fillRect(Math.round(x + Math.cos(a) * 12), Math.round(y - b.h - 6 + Math.sin(a) * 3), 2, 2);
    }
  }

  function kresliStrely(cas) {
    for (const s of st.strely) {
      const x = Math.round(s.x - kamera.x), y = Math.round(s.y - kamera.y);
      if (x < -20 || x > W + 20) continue;
      g.save(); g.translate(x + s.w / 2, y + s.h / 2);
      if (s.druh === 'ostep') {
        g.rotate(Math.atan2(s.vy, s.vx));
        g.fillStyle = '#8a6a40'; g.fillRect(-9, -1, 14, 2); g.fillStyle = '#e4e8ee'; g.fillRect(5, -2, 4, 4);
      } else if (s.druh === 'sekera') {
        g.rotate(s.rot);
        if (obr.sekera) g.drawImage(obr.sekera, -6, -6, 12, 12);
        else { g.fillStyle = '#6b4a2a'; g.fillRect(-1, -6, 2, 12); g.fillStyle = '#cfd4dc'; g.fillRect(1, -6, 5, 6); }
      } else if (s.druh === 'sip') {
        g.scale(Math.sign(s.vx) || 1, 1);
        g.fillStyle = '#c8b090'; g.fillRect(-5, 0, 10, 1); g.fillStyle = '#e8ecf2'; g.fillRect(4, -1, 2, 3); g.fillStyle = '#d84a3a'; g.fillRect(-5, -1, 2, 3);
      } else if (s.druh === 'kamen') {
        g.rotate(s.rot);
        g.fillStyle = '#6e665c'; g.fillRect(-5, -5, 10, 10); g.fillStyle = '#9a9184'; g.fillRect(-5, -5, 10, 2); g.fillStyle = '#ff8a2a'; g.fillRect(-1, -1, 2, 2);
      } else if (s.druh === 'led') {
        g.fillStyle = '#bfe8ff'; g.beginPath(); g.moveTo(-3, -4); g.lineTo(3, -4); g.lineTo(0, 5); g.fill();
      } else if (s.druh === 'vlna') {
        const v = 0.6 + Math.sin(cas * 30) * 0.3;
        g.fillStyle = `rgba(230,210,170,${v})`; g.fillRect(-5, -5, 10, 10); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(-5, -6, 10, 2);
      }
      g.restore();
    }
  }

  function kresliHrace(cas) {
    const h = st.hrac;
    if (h.nesmrt > 0 && !h.mrtvy && Math.floor(cas * 16) % 2) return;
    const x = h.x + h.w / 2 - kamera.x, y = h.y + h.h - kamera.y;
    const img = obr.trpaslik, bok = obr.trpaslik_beh;
    const jde = h.naZemi && Math.abs(h.vx) > 5;
    // snímek z profilu: 0 a 2 = krok, 1 a 3 = postoj; ve vzduchu krok, v klidu postoj, na žebříku střídavě
    const snimek = h.leze ? (Math.floor((h.y) / 6) % 2 ? 0 : 2) : !h.naZemi ? 0 : jde ? Math.floor(h.krok / 8) : 1;
    if (h.mrtvy) {
      const o = { rot: Math.min(1.5, h.mrtvy * 4) * -h.smer };
      if (bok) { o.pas = 'trpaslik_beh'; o.snimek = 1; sprite(bok, x, y, h.smer, o); } else sprite(img, x, y, h.smer, o);
      return;
    }
    let sx = 1, sy = 1;
    if (!h.naZemi && !h.leze) { if (h.vy < -60) { sx = 0.9; sy = 1.1; } else if (h.vy > 150) { sx = 0.95; sy = 1.05; } }
    const ruka = bok ? { x: x + h.smer * 3, y: y - 17 } : { x: x + h.smer * 8, y: y - 12 };
    let uhel;
    if (h.utok) { const t = Math.min(1, h.utok / (K.UTOK.trvani * 0.75)); uhel = -2.2 + t * 3.2; }
    else uhel = (bok ? -1.45 : -0.25) + (jde ? Math.sin(h.krok * 0.4) * 0.1 : 0);
    const kresliKrumpac = () => {
      const k = obr.krumpac; if (!k) return;
      g.save(); g.translate(Math.round(ruka.x), Math.round(ruka.y)); g.scale(h.smer, 1); g.rotate(uhel);
      if (st.vybava.silnyKrumpac) g.filter = 'brightness(1.25) saturate(1.6) hue-rotate(-15deg)';
      g.drawImage(k, -3, -k.height + 3);
      g.restore();
    };
    if (bok) sprite(bok, x, y - (jde && snimek % 2 === 0 ? 1 : 0), h.smer, { sx, sy, pas: 'trpaslik_beh', snimek });
    else sprite(img, x, y, h.smer, { sx, sy });
    if (!h.leze) kresliKrumpac();
    // štít na zádech
    if (h.stit > 0) {
      const sxp = Math.round(x - h.smer * 6), syp = Math.round(y - 16);
      if (obr.stit) g.drawImage(obr.stit, sxp - 5, syp - 5, 10, 10);
      else { g.fillStyle = '#b07a3a'; g.beginPath(); g.arc(sxp, syp, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d8dce4'; g.fillRect(sxp - 1, syp - 1, 2, 2); }
    }
    if (h.utok) {
      const b = K.utokovyBox(h);
      if (b) {
        g.strokeStyle = 'rgba(255,240,200,.55)'; g.lineWidth = 2; g.beginPath();
        g.arc(Math.round(ruka.x), Math.round(ruka.y), 15, h.smer > 0 ? -1.4 : Math.PI - 0.3, h.smer > 0 ? 0.3 : Math.PI + 1.4);
        g.stroke();
      }
    }
  }

  function kresliKrapniky(cas) {
    const ledove = st.svet === 2;
    for (const k of st.krapniky) {
      if (k.stav === 'pryc') continue;
      let x = Math.round(k.x - kamera.x), y = Math.round(k.y - kamera.y);
      if (x < -20 || x > W + 20) continue;
      if (k.stav === 'tres') x += Math.round(Math.sin(cas * 70) * 1.5);
      for (let r = 0; r < k.h; r++) {
        const sirka = Math.max(1, Math.round(k.w * (1 - r / k.h)));
        const ox = Math.round((k.w - sirka) / 2);
        g.fillStyle = ledove ? '#8fc8ec' : '#4b4658'; g.fillRect(x + ox, y + r, sirka, 1);
        g.fillStyle = ledove ? '#e8f6ff' : '#8d87a0'; g.fillRect(x + ox, y + r, Math.max(1, Math.floor(sirka / 3)), 1);
      }
      g.fillStyle = 'rgba(160,200,255,.7)'; g.fillRect(x + Math.floor(k.w / 2), y + k.h - 1, 1, 1);
    }
  }

  function kresliRozpady(cas) {
    for (const r of st.rozpady) {
      if (r.stav === 'pryc') continue;
      let x = r.tx * T - Math.round(kamera.x), y = r.ty * T - Math.round(kamera.y);
      if (x < -T || x > W) continue;
      if (r.stav === 'tres') { x += Math.round(Math.sin(cas * 60 + r.tx) * 1.2); y += r.cas > 0.3 ? 1 : 0; }
      const led = st.svet === 2;
      g.fillStyle = led ? '#7fb6d8' : '#5e574c'; g.fillRect(x, y, T, 6);
      g.fillStyle = led ? '#e8f6ff' : '#958b78'; g.fillRect(x, y, T, 1);
      g.fillStyle = led ? '#3c6e90' : '#3a342c'; g.fillRect(x, y + 5, T, 1);
      g.fillStyle = led ? '#2c5070' : '#2a251f';
      g.fillRect(x + 4 + (r.tx % 3), y + 1, 1, 3); g.fillRect(x + 10, y + 2, 1, 3);
      if (r.stav === 'tres') { g.fillRect(x + 7, y + 1, 1, 4); g.fillRect(x + 2, y + 3, 3, 1); g.fillRect(x + 12, y + 1, 2, 1); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 1, y + 6, T - 2, 1);
    }
  }

  function kresliPlosiny() {
    for (const p of st.plosiny) {
      const x = Math.round(p.x - kamera.x), y = Math.round(p.y - kamera.y);
      if (x < -p.w - 10 || x > W + 10) continue;
      if (p.typ === 'v') { g.fillStyle = '#6b5a44'; g.fillRect(x + 4, 0, 1, y); g.fillRect(x + p.w - 5, 0, 1, y); }
      g.fillStyle = '#7a4f2a'; g.fillRect(x, y, p.w, p.h);
      g.fillStyle = '#a8743f'; g.fillRect(x, y, p.w, 1);
      g.fillStyle = '#4a2e18'; g.fillRect(x, y + p.h - 1, p.w, 1);
      for (let i = 12; i < p.w; i += 12) g.fillRect(x + i, y + 1, 1, p.h - 2);
      g.fillStyle = '#8c8f98'; g.fillRect(x + 1, y + 2, 2, 2); g.fillRect(x + p.w - 3, y + 2, 2, 2);
      if (p.typ === 'h') {
        g.fillStyle = '#2b2b30'; g.fillRect(x + 6, y + p.h, 5, 3); g.fillRect(x + p.w - 11, y + p.h, 5, 3);
        g.fillStyle = '#6d7078'; g.fillRect(x + 8, y + p.h + 1, 1, 1); g.fillRect(x + p.w - 9, y + p.h + 1, 1, 1);
      }
    }
  }

  function kresliPruziny() {
    for (const p of st.pruziny) {
      const x = Math.round(p.x - kamera.x), y = Math.round(p.y - kamera.y);
      if (x < -20 || x > W + 20) continue;
      const stl = p.stlaceni > 0 ? Math.round(3 * p.stlaceni / 0.25) : 0;
      g.fillStyle = '#3d3d44'; g.fillRect(x - 1, y + p.h - 2, p.w + 2, 2);
      g.fillStyle = '#c8ccd4';
      const vys = p.h - 3 - stl;
      for (let i = 0; i < vys; i++) g.fillRect(x + 2 + ((i % 2) ? p.w - 6 : 0), y + p.h - 2 - i - 1, 2, 1);
      for (let i = 0; i < vys; i += 2) g.fillRect(x + 3, y + p.h - 3 - i, p.w - 6, 1);
      g.fillStyle = '#d23a2a'; g.fillRect(x, y + stl, p.w, 2);
      g.fillStyle = '#ff7a5a'; g.fillRect(x, y + stl, p.w, 1);
    }
  }

  // projde viditelné dlaždice daného znaku
  function viditelne(znak, fn) {
    const tx0 = Math.max(0, Math.floor(kamera.x / T)), tx1 = Math.min(st.sirka - 1, Math.floor((kamera.x + W) / T));
    const ty0 = Math.max(0, Math.floor(kamera.y / T)), ty1 = Math.min(st.vyska - 1, Math.floor((kamera.y + H) / T));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++)
      if (K.dlazdice(st, tx, ty) === znak) fn(tx, ty, tx * T - Math.round(kamera.x), ty * T - Math.round(kamera.y));
  }

  function kresliLavu(cas) {
    viditelne('L', (tx, ty, x, y) => {
      const nad = K.dlazdice(st, tx, ty - 1) !== 'L';
      g.fillStyle = '#b8340e'; g.fillRect(x, y + (nad ? 4 : 0), T, T - (nad ? 4 : 0));
      g.fillStyle = '#e8601a'; g.fillRect(x, y + (nad ? 6 : 0), T, 4);
      if (nad) {
        for (let i = 0; i < T; i++) {
          const v = Math.round(Math.sin(cas * 3 + (tx * T + i) * 0.35) * 1.2);
          g.fillStyle = '#ffb347'; g.fillRect(x + i, y + 4 + v, 1, 1);
          g.fillStyle = '#ff8a2a'; g.fillRect(x + i, y + 5 + v, 1, 1);
        }
        const b = (cas * 0.9 + tx * 0.37) % 1;
        if (b < 0.25) { g.fillStyle = '#ffd27a'; g.fillRect(x + (tx * 5) % 12 + 2, y + 6 - Math.round(b * 12), 2, 2); }
      }
    });
  }

  function kresliVodu(cas) {   // kreslí se až přes postavy (pod hladinou je vše namodralé)
    viditelne('W', (tx, ty, x, y) => {
      const nad = K.dlazdice(st, tx, ty - 1) !== 'W';
      g.fillStyle = 'rgba(30,90,150,.42)'; g.fillRect(x, y + (nad ? 3 : 0), T, T - (nad ? 3 : 0));
      if (nad) for (let i = 0; i < T; i++) {
        const v = Math.round(Math.sin(cas * 2.2 + (tx * T + i) * 0.3) * 1);
        g.fillStyle = 'rgba(170,220,255,.75)'; g.fillRect(x + i, y + 3 + v, 1, 1);
      }
      if ((tx * 13 + ty * 7) % 9 === 0) { const b = (cas * 0.6 + tx * 0.2) % 1; g.fillStyle = 'rgba(200,240,255,.5)'; g.fillRect(x + 6, y + T - Math.round(b * T), 1, 1); }
    });
  }

  function kresliPasy(cas) {
    for (const z of ['(', ')']) viditelne(z, (tx, ty, x, y) => {
      const posun = Math.floor(cas * 30 * (z === ')' ? 1 : -1)) % 6;
      g.fillStyle = '#2a2b30'; g.fillRect(x, y, T, 4);
      g.fillStyle = '#8a8c96';
      for (let i = -6; i < T + 6; i += 6) { const px = x + ((i + posun + 12) % 18) - 1; if (px >= x && px < x + T - 1) g.fillRect(px, y + 1, 2, 2); }
      g.fillStyle = '#ffcf6a'; g.fillRect(x + (z === ')' ? 11 : 3), y + 1, 2, 1);
    });
  }

  function kresliFalesneZdi() {
    viditelne('F', (tx, ty, x, y) => {
      const odkryta = st.odkryte.has(tx + ',' + ty);
      g.globalAlpha = odkryta ? 0.22 : 1;
      const tex = texturaKamene();
      if (tex) g.drawImage(tex, (tx * T) % 32, (ty * T) % 32, T, T, x, y, T, T); else { g.fillStyle = '#4a4550'; g.fillRect(x, y, T, T); }
      g.globalAlpha = 1;
    });
  }

  function kresliLisy() {
    for (const l of st.lisy) {
      const x = Math.round(l.x - kamera.x), y = Math.round(l.y - kamera.y), y0 = Math.round(l.y0 - kamera.y);
      if (x < -20 || x > W + 20) continue;
      g.fillStyle = '#3d3f46'; g.fillRect(x + 6, y0, 4, y - y0 + 2);          // píst
      g.fillStyle = '#5a5d66'; g.fillRect(x, y, l.w, l.h);                     // hlava
      g.fillStyle = '#8a8d96'; g.fillRect(x, y, l.w, 2);
      g.fillStyle = '#25262b'; g.fillRect(x, y + l.h - 3, l.w, 3);
      g.fillStyle = (l.stav === 'nahore' && l.cas > 1.1) ? '#ff6a3a' : '#a0a4ae';   // varovná kontrolka
      g.fillRect(x + 6, y + 5, 4, 3);
    }
  }

  function kresliPopisky() {
    for (const p of popisky) {
      g.globalAlpha = Math.max(0, 1 - p.t / (p.dlouho ? 2 : 0.9));
      text(p.text, Math.round(p.x - kamera.x), Math.round(p.y - kamera.y), 'center', p.dlouho ? '#bfffd0' : '#ffe6a0', p.dlouho ? 10 : 8);
    }
    g.globalAlpha = 1;
  }

  function kresliCastice() {
    for (const c of st.castice) {
      g.globalAlpha = Math.min(1, c.zivot * 2);
      g.fillStyle = c.barva; g.fillRect(Math.round(c.x - kamera.x), Math.round(c.y - kamera.y), 2, 2);
    }
    g.globalAlpha = 1;
  }

  function kresliSvetlo(cas) {
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, W, H);   // vrstva tmy se kreslí znovu v každém snímku (jinak se průhlednost sčítá do černa)
    sg.fillStyle = `rgba(2,2,10,${st.boss ? 0.35 : svet().tma})`; sg.fillRect(0, 0, W, H);   // aréna bosse je osvětlená
    sg.globalCompositeOperation = 'destination-out';
    const zdroj = (x, y, r, sila) => {
      const gr = sg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${sila})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      sg.fillStyle = gr; sg.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    const h = st.hrac;
    zdroj(h.x + h.w / 2 - kamera.x, h.y + 6 - kamera.y, 210 + Math.sin(cas * 7) * 3, 1);
    for (const p of st.predmety) {
      if (p.sebrano) continue;
      const x = p.x - kamera.x; if (x < -80 || x > W + 80) continue;
      if (p.druh === 'kontrola') zdroj(x + p.w / 2, p.y - kamera.y - 2, p.aktivni ? 70 : 30, p.aktivni ? 0.9 : 0.4);
      else if (p.druh === 'drahokam') zdroj(x + 5, p.y + 5 - kamera.y, 26, 0.7);
    }
    if (st.cil) zdroj(st.cil.x + T / 2 - kamera.x, st.cil.y + T - kamera.y, 70, 0.9);
    if (st.boss && st.boss.typ === 'golem' && st.boss.stav === 'jadro') zdroj(st.boss.x + st.boss.w / 2 - kamera.x, st.boss.y + st.boss.h * 0.45 - kamera.y, 80, 0.9);
    const lavy = [];
    viditelne('L', (tx, ty, x, y) => { if (tx % 2 === 0 && K.dlazdice(st, tx, ty - 1) !== 'L') lavy.push([x + T, y + 4, tx]); });
    for (const [x, y, tx] of lavy) zdroj(x, y, 46 + Math.sin(cas * 2 + tx) * 4, 0.75);
    g.drawImage(svetlo, 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (const [x, y] of lavy) {
      const gr = g.createRadialGradient(x, y, 0, x, y, 40);
      gr.addColorStop(0, 'rgba(255,110,30,.22)'); gr.addColorStop(1, 'rgba(255,110,30,0)');
      g.fillStyle = gr; g.fillRect(x - 40, y - 40, 80, 80);
    }
    g.globalCompositeOperation = 'source-over';
  }

  function kresliHud() {
    const h = st.hrac;
    let x = 8;
    // srdce: do maxima červená (prázdná ztlumená), nad maximum zlatá
    for (let i = 0; i < Math.max(h.max, h.srdce); i++) {
      const zlate = i >= h.max, plne = i < h.srdce;
      const img = zlate ? (obr.zlate_srdce || obr.srdce) : obr.srdce;
      if (img) { g.globalAlpha = plne ? 1 : 0.25; if (zlate && !obr.zlate_srdce) g.filter = 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.3)'; g.drawImage(img, x, 6, 11, 10); g.filter = 'none'; g.globalAlpha = 1; }
      else { g.fillStyle = zlate ? '#ffcf3a' : plne ? '#e33' : '#422'; g.fillRect(x, 7, 10, 9); }
      x += 12;
    }
    x += 4;
    for (let i = 0; i < h.stit; i++) {
      if (obr.stit) g.drawImage(obr.stit, x, 6, 10, 10); else { g.fillStyle = '#b07a3a'; g.fillRect(x, 7, 9, 9); }
      x += 11;
    }
    if (h.ostepy > 0) {
      g.fillStyle = '#8a6a40'; g.fillRect(x + 1, 11, 11, 2); g.fillStyle = '#e4e8ee'; g.fillRect(x + 10, 10, 3, 4);
      text('×' + h.ostepy, x + 14, 16, 'left', '#ffe6a0', 9); x += 32;
    } else if (st.vybava.sekera) {
      if (obr.sekera) g.drawImage(obr.sekera, x, 5, 11, 11); else { g.fillStyle = '#cfd4dc'; g.fillRect(x + 3, 6, 5, 6); }
      x += 16;
    }
    if (obr.drahokam) g.drawImage(obr.drahokam, x + 2, 6);
    text(`${st.sebrano}/${st.drahokamu}`, x + 16, 16, 'left', st.sebrano === st.drahokamu ? '#7fffa0' : '#bfe8ff', 9);
    text(`${bodyNaZacatku + st.body}`.padStart(6, '0'), W - 8, 16, 'right', '#ffe6a0', 10);
    text(oznaceni(urovenIdx), W - 68, 16, 'right', '#c8c0b0', 9);
    // ukazatel zdraví bosse
    const b = st.boss;
    if (b && !b.mrtvy) {
      const bw = 220, bx = (W - bw) / 2, by = H - 18;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(bx - 2, by - 2, bw + 4, 10);
      g.fillStyle = '#5a1010'; g.fillRect(bx, by, bw, 6);
      g.fillStyle = b.druhaFaze ? '#ff5a2a' : '#d8342a'; g.fillRect(bx, by, Math.round(bw * b.hp / b.max), 6);
      text(b.nazev, W / 2, by - 4, 'center', '#ffd0c0', 9);
    }
    if (casObrazovky < 2.5) {
      g.globalAlpha = Math.min(1, (2.5 - casObrazovky) * 1.5);
      text(`${SVETY[st.svet].nazev} · ${oznaceni(urovenIdx)}`, W / 2, 52, 'center', '#ffe6a0', 12);
      text(st.nazev, W / 2, 74, 'center', '#fff', 18);
      g.globalAlpha = 1;
    }
  }

  // „2–1“, „2–boss“
  function oznaceni(i) {
    const u = K.urovne[i], s = u.svet || 1;
    const vSvete = K.urovne.filter((v, j) => (v.svet || 1) === s && j <= i).length;
    return u.boss ? `${s}–boss` : `${s}–${vSvete}`;
  }

  function kresliHru(cas) {
    g.save();
    if (otres > 0) g.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));
    kresliPozadi(cas);
    g.drawImage(vrstvaDlazdic, Math.round(kamera.x), Math.round(kamera.y), W, H, 0, 0, W, H);
    kresliPasy(cas);
    kresliLavu(cas);
    kresliRozpady(cas);
    kresliPlosiny();
    kresliPruziny();
    kresliLisy();
    kresliVychod(cas);
    kresliPredmety(cas);
    kresliNepratele(cas);
    kresliBosse(cas);
    kresliKrapniky(cas);
    kresliHrace(cas);
    kresliStrely(cas);
    kresliFalesneZdi();
    kresliVodu(cas);
    kresliCastice();
    kresliSvetlo(cas);
    kresliPopisky();
    g.restore();
    kresliHud();
  }

  // ---------- obrazovky mimo hru ----------
  function kresliTitul() {
    if (obr.titul) {
      const s = Math.max(W / obr.titul.width, H / obr.titul.height);
      g.drawImage(obr.titul, (W - obr.titul.width * s) / 2, (H - obr.titul.height * s) / 2, obr.titul.width * s, obr.titul.height * s);
    } else { g.fillStyle = '#111'; g.fillRect(0, 0, W, H); }
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.75)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    text('KRUMPÁČ', W / 2, 46, 'center', '#ffcf6a', 36);
    text('trpasličí plošinovka', W / 2, 64, 'center', '#e8dcc0', 11);
    if (blika()) text(dotykove() ? 'Klepni a vyraz do dolu' : 'Enter – mapa dolu', W / 2, H - 34, 'center', '#fff', 12);
    const r = rekord && rekord.hodnota();
    if (r) text(`Rekord: ${r}`, W / 2, H - 16, 'center', '#ffe6a0', 9);
  }

  // rozložení uzlů na mapě: řádek na svět, svět 1 má 8 uzlů, ostatní 3
  function uzlyMapy() {
    const svety = {};
    K.urovne.forEach((u, i) => { (svety[u.svet || 1] = svety[u.svet || 1] || []).push(i); });
    const uzly = [];
    Object.keys(svety).sort().forEach((s, r) => {
      const idx = svety[s], y = 74 + r * 45;
      const x0 = idx.length > 4 ? 74 : 150, x1 = idx.length > 4 ? 446 : 400;
      idx.forEach((i, k) => {
        const x = idx.length === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * k / (idx.length - 1);
        uzly.push({ i, x: Math.round(x), y: y + (k % 2 ? 6 : -6), svet: +s, r: K.urovne[i].boss ? 10 : 7 });
      });
    });
    return uzly;
  }

  let tlacitkaMapy = {};
  function kresliMapu(cas) {
    if (obr.mapa) {
      const s = Math.max(W / obr.mapa.width, H / obr.mapa.height);
      g.drawImage(obr.mapa, (W - obr.mapa.width * s) / 2, (H - obr.mapa.height * s) / 2, obr.mapa.width * s, obr.mapa.height * s);
      zatemni(0.55);
    } else { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a1622'); gr.addColorStop(1, '#2a1208'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    text('Mapa dolu', 10, 18, 'left', '#ffcf6a', 13);
    if (obr.drahokam) g.drawImage(obr.drahokam, W - 70, 7);
    text(String(data.drahokamy), W - 54, 17, 'left', '#bfe8ff', 11);
    const uzly = uzlyMapy();
    // cesta
    g.strokeStyle = 'rgba(230,200,140,.55)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath();
    uzly.forEach((u, k) => { if (k === 0) g.moveTo(u.x, u.y); else g.lineTo(u.x, u.y); });
    g.stroke(); g.setLineDash([]);
    // popisky světů
    for (const s of [1, 2, 3, 4]) { const u = uzly.find(v => v.svet === s); if (u) text(`${s}. ${SVETY[s].nazev}`, 10, u.y - 16, 'left', u.i <= data.postup ? '#e8dcc0' : '#6a6470', 9); }
    for (const u of uzly) {
      const odemceno = u.i <= data.postup, vybrano = u.i === vyber;
      g.fillStyle = !odemceno ? '#3a3640' : K.urovne[u.i].boss ? '#8a2020' : '#c08a3a';
      g.beginPath(); g.arc(u.x, u.y, u.r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = vybrano ? '#fff' : 'rgba(0,0,0,.6)'; g.lineWidth = vybrano ? 2 : 1; g.stroke();
      if (K.urovne[u.i].boss) text('☠', u.x, u.y + 4, 'center', odemceno ? '#fff' : '#777', 11, false);
      else text(oznaceni(u.i).split('–')[1], u.x, u.y + 4, 'center', odemceno ? '#1a1206' : '#777', 9);
      const hv = data.hvezdy[u.i] || 0;
      if (odemceno) for (let k = 0; k < 3; k++) hvezda(u.x - 7 + k * 7, u.y + u.r + 6, hv & (1 << k), 3);
      if (vybrano) {   // trpaslík nad vybraným uzlem
        const bob = Math.round(Math.abs(Math.sin(cas * 4)) * 2);
        if (obr.trpaslik_beh) sprite(obr.trpaslik_beh, u.x, u.y - u.r - 1 - bob, 1, { pas: 'trpaslik_beh', snimek: Math.floor(cas * 5) % 2 ? 1 : 3 });
      }
    }
    // informační lišta
    const u = K.urovne[vyber];
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(0, H - 34, W, 34);
    text(`${oznaceni(vyber)}  ${u.nazev}`, 10, H - 19, 'left', '#fff', 11);
    const hv = data.hvezdy[vyber] || 0;
    const popisyHv = ['drahokamy', 'bez smrti', `čas ${Math.floor(u.limit / 60)}:${String(u.limit % 60).padStart(2, '0')}`];
    popisyHv.forEach((p, k) => { hvezda(16 + k * 78, H - 8, hv & (1 << k), 4); text(p, 24 + k * 78, H - 5, 'left', hv & (1 << k) ? '#ffe6a0' : '#8a8490', 8); });
    tlacitkaMapy.obchod = tlacitko(W - 168, H - 30, 74, 22, 'Obchod (O)', false);
    tlacitkaMapy.hrat = tlacitko(W - 88, H - 30, 80, 22, dotykove() ? '▶ Hrát' : '▶ Hrát (Enter)', true);
  }

  let tlacitkaObchodu = {};
  function kresliObchod(cas) {
    g.fillStyle = '#16121a'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(224,160,64,.08)'; for (let i = 0; i < W; i += 24) g.fillRect(i, 0, 12, H);
    text('Trpasličí obchod', W / 2, 24, 'center', '#ffcf6a', 16);
    if (obr.drahokam) g.drawImage(obr.drahokam, W - 70, 9);
    text(String(data.drahokamy), W - 54, 19, 'left', '#bfe8ff', 11);
    tlacitkaObchodu.radky = [];
    ZBOZI.forEach((z, k) => {
      const y = 40 + k * 38, vybrano = k === vyberObchod;
      const stupen = z.stupen(data.vybava), max = stupen >= z.ceny.length, cena = z.ceny[stupen];
      g.fillStyle = vybrano ? 'rgba(224,160,64,.25)' : 'rgba(255,255,255,.04)'; g.fillRect(20, y, W - 40, 34);
      if (vybrano) { g.strokeStyle = '#e0a040'; g.strokeRect(20.5, y + 0.5, W - 41, 33); }
      kresliIkonuZbozi(z.id, 36, y + 17);
      text(z.nazev + (z.ceny.length > 1 ? ` (${stupen}/${z.ceny.length})` : ''), 56, y + 14, 'left', '#fff', 11);
      text(z.popis, 56, y + 27, 'left', '#b8b0a0', 8, false);
      if (max) text('✓ máš', W - 32, y + 21, 'right', '#7fffa0', 11);
      else text(`${cena} ◆`, W - 32, y + 21, 'right', data.drahokamy >= cena ? '#bfe8ff' : '#a05050', 11);
      tlacitkaObchodu.radky.push({ x: 20, y, w: W - 40, h: 34, k });
    });
    if (hlaska && hlaska.t > casObrazovky - 2) text(hlaska.text, W / 2, H - 12, 'center', hlaska.barva, 10);
    else text(dotykove() ? 'Klepni na zboží – koupit' : '↑↓ vybrat · Enter koupit · Esc zpět', W / 2, H - 12, 'center', '#8a8490', 9);
    tlacitkaObchodu.zpet = tlacitko(8, H - 28, 60, 20, '◀ Zpět', false);
  }

  function kresliIkonuZbozi(id, x, y) {
    if (id === 'srdce') { if (obr.srdce) g.drawImage(obr.srdce, x - 6, y - 5, 12, 10); }
    else if (id === 'dvojskok') { g.fillStyle = '#cfe8ff'; g.fillRect(x - 5, y + 2, 4, 3); g.fillRect(x + 1, y - 4, 4, 3); g.fillRect(x - 1, y - 1, 2, 2); }
    else if (id === 'krumpac') { if (obr.krumpac) { g.save(); g.filter = 'brightness(1.25) saturate(1.6) hue-rotate(-15deg)'; g.drawImage(obr.krumpac, x - 6, y - 8, 12, 16); g.restore(); } }
    else if (id === 'sekera') { if (obr.sekera) g.drawImage(obr.sekera, x - 7, y - 7, 14, 14); else { g.fillStyle = '#cfd4dc'; g.fillRect(x - 2, y - 6, 6, 6); g.fillStyle = '#6b4a2a'; g.fillRect(x - 3, y - 6, 2, 12); } }
    else if (id === 'zbroj') { if (obr.stit) g.drawImage(obr.stit, x - 7, y - 7, 14, 14); else { g.fillStyle = '#b07a3a'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); } }
  }

  function kup(k) {
    const z = ZBOZI[k], stupen = z.stupen(data.vybava);
    if (stupen >= z.ceny.length) { hlaska = { text: 'Tohle už máš.', barva: '#b8b0a0', t: casObrazovky }; return; }
    const cena = z.ceny[stupen];
    if (data.drahokamy < cena) { hlaska = { text: `Chybí ${cena - data.drahokamy} drahokamů.`, barva: '#ff9a8a', t: casObrazovky }; Z.hraj('zraneni'); return; }
    data.drahokamy -= cena; z.kup(data.vybava); ulozVse();
    hlaska = { text: `Koupeno: ${z.nazev}!`, barva: '#7fffa0', t: casObrazovky }; Z.hraj('srdce');
  }

  function kresliKonecUrovne() {
    zatemni(Math.min(0.65, casObrazovky));
    const posledni = obrazovka === 'vitezstvi';
    text(posledni ? 'Srdce hory je volné!' : st.boss ? 'Boss poražen!' : 'Úroveň dokončena!', W / 2, 56, 'center', '#ffcf6a', 20);
    if (posledni) text('Kamenný golem padl a trpaslíci se vracejí do svých síní.', W / 2, 76, 'center', '#e8dcc0', 9, false);
    const popisy = ['všechny drahokamy', 'bez smrti', `čas do ${Math.floor(st.limit / 60)}:${String(st.limit % 60).padStart(2, '0')}`];
    for (let k = 0; k < 3; k++) {
      const ma = vysledek && vysledek.hvezdy & (1 << k), objev = casObrazovky > 0.3 + k * 0.25;
      const x = W / 2 - 110 + k * 110;
      hvezda(x, 108, ma && objev, objev && ma ? 11 + Math.max(0, 3 - (casObrazovky - 0.3 - k * 0.25) * 12) : 11);
      text(popisy[k], x, 132, 'center', ma ? '#ffe6a0' : '#8a8490', 9);
    }
    const m = Math.floor(st.cas / 60), sek = String(Math.floor(st.cas % 60)).padStart(2, '0');
    text(`Drahokamy ${st.sebrano}/${st.drahokamu} · Čas ${m}:${sek} · Smrti ${st.umrti}`, W / 2, 156, 'center', '#cfe6ff', 10);
    text(`+${vysledek ? vysledek.drahokamy : 0} ◆ do měšce (celkem ${data.drahokamy})`, W / 2, 174, 'center', '#bfe8ff', 10);
    text(`Skóre: ${bodyCelkem}`, W / 2, 196, 'center', '#fff', 13);
    if (novyRekord) text('NOVÝ REKORD!', W / 2, 212, 'center', '#7fffa0', 11);
    if (casObrazovky > 0.9 && blika()) text(posledni ? (dotykove() ? 'Klepni – mapa' : 'Enter – mapa dolu') : (dotykove() ? 'Klepni – další úroveň' : 'Enter – další úroveň · Esc – mapa'), W / 2, 240, 'center', '#ddd', 11);
  }

  function kresli() {
    const cas = performance.now() / 1000;
    if (obrazovka === 'titul') { kresliTitul(); return; }
    if (obrazovka === 'mapa') { kresliMapu(cas); return; }
    if (obrazovka === 'obchod') { kresliObchod(cas); return; }
    kresliHru(cas);
    if (obrazovka === 'pauza') {
      zatemni(0.55); text('PAUZA', W / 2, H / 2 - 6, 'center', '#fff', 24);
      text(dotykove() ? 'klepni pro pokračování' : 'P – pokračovat · Q – na mapu', W / 2, H / 2 + 16, 'center', '#ccc', 10);
    } else if (obrazovka === 'smrt') {
      zatemni(Math.min(0.7, casObrazovky));
      text('Došly ti síly…', W / 2, H / 2 - 6, 'center', '#ff8a70', 22);
      const kde = st.kontrola ? 'od lucerny' : 'od začátku úrovně';
      if (casObrazovky > 0.8 && blika()) text(dotykove() ? `Klepni – znovu ${kde}` : `Enter – znovu ${kde} · Esc – mapa`, W / 2, H / 2 + 18, 'center', '#fff', 11);
    } else if (obrazovka === 'hotovo' || obrazovka === 'vitezstvi') kresliKonecUrovne();
  }

  // ---------- ovládání ----------
  const MAPA_KLAVES = {
    ArrowLeft: 'vlevo', KeyA: 'vlevo', ArrowRight: 'vpravo', KeyD: 'vpravo',
    ArrowUp: 'nahoru', KeyW: 'nahoru', ArrowDown: 'dolu', KeyS: 'dolu',
    Space: 'skok', KeyK: 'skok',
    KeyX: 'utok', KeyJ: 'utok', KeyF: 'utok', ControlLeft: 'utok',
    KeyC: 'hod', KeyL: 'hod',
  };

  function prepocitejVstup() {
    for (const k of Object.keys(vstup)) vstup[k] = false;
    for (const c of klavesy) if (MAPA_KLAVES[c]) vstup[MAPA_KLAVES[c]] = true;
    for (const k in dotyk) if (dotyk[k]) vstup[k] = true;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p) : null;
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (ax < -0.4 || gp.buttons[14]?.pressed) vstup.vlevo = true;
      if (ax > 0.4 || gp.buttons[15]?.pressed) vstup.vpravo = true;
      if (ay > 0.5 || gp.buttons[13]?.pressed) vstup.dolu = true;
      if (ay < -0.5 || gp.buttons[12]?.pressed) vstup.nahoru = true;
      if (gp.buttons[0]?.pressed) vstup.skok = true;
      if (gp.buttons[2]?.pressed || gp.buttons[1]?.pressed) vstup.utok = true;
      if (gp.buttons[3]?.pressed) vstup.hod = true;
      if (gp.buttons[9]?.pressed && !prepocitejVstup.start) potvrd();
      prepocitejVstup.start = !!gp.buttons[9]?.pressed;
    }
  }

  function potvrd() {
    Z.priprav();
    if (HU) HU.hraj(hudbaPro());   // první povolení zvuku prohlížečem: rozjet hudbu
    if (obrazovka === 'titul') { bodyCelkem = 0; novyRekord = false; nesene = { stit: 0, ostepy: 0 }; naMapu(); }
    else if (obrazovka === 'mapa') { if (vyber <= data.postup) zacniUroven(vyber); }
    else if (obrazovka === 'obchod') kup(vyberObchod);
    else if (obrazovka === 'smrt' && casObrazovky > 0.8) {
      if (K.ozivit(st)) { nastavObrazovku('hra'); casObrazovky = 3; }
      else { bodyCelkem = bodyNaZacatku; zacniUroven(urovenIdx); }
    }
    else if (obrazovka === 'hotovo' && casObrazovky > 0.8) zacniUroven(urovenIdx + 1);
    else if (obrazovka === 'vitezstvi' && casObrazovky > 1) naMapu();
    else if (obrazovka === 'pauza') nastavObrazovku('hra');
  }

  function zpet() {
    if (obrazovka === 'hra') nastavObrazovku('pauza');
    else if (obrazovka === 'pauza') nastavObrazovku('hra');
    else if (obrazovka === 'obchod') naMapu();
    else if (obrazovka === 'mapa') nastavObrazovku('titul');
    else if (obrazovka === 'smrt' || obrazovka === 'hotovo' || obrazovka === 'vitezstvi') naMapu();
  }

  function posunVyber(dx, dy) {
    if (obrazovka === 'obchod') { vyberObchod = (vyberObchod + dy + ZBOZI.length) % ZBOZI.length; return; }
    const uzly = uzlyMapy(), akt = uzly.find(u => u.i === vyber);
    let cil = vyber;
    if (dx) cil = vyber + dx;
    if (dy) {   // nejbližší uzel v sousedním světě
      const kandidati = uzly.filter(u => u.svet === akt.svet + dy);
      if (kandidati.length) cil = kandidati.reduce((a, b) => Math.abs(b.x - akt.x) < Math.abs(a.x - akt.x) ? b : a).i;
    }
    if (cil >= 0 && cil <= data.postup && cil < K.urovne.length) { vyber = cil; Z.hraj('cvak'); }
  }

  function napojOvladani() {
    addEventListener('keydown', e => {
      const herni = obrazovka === 'hra';
      if (e.code === 'KeyM') { prepniZvuk(); return; }
      if (e.code === 'KeyN') { prepniHudbu(); return; }
      if (!herni && (e.code === 'Enter' || e.code === 'Space')) { potvrd(); e.preventDefault(); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { zpet(); e.preventDefault(); return; }
      if (obrazovka === 'pauza' && e.code === 'KeyQ') { naMapu(); return; }
      if (obrazovka === 'mapa' && e.code === 'KeyO') { vyberObchod = 0; hlaska = null; nastavObrazovku('obchod'); return; }
      if (obrazovka === 'obchod' && e.code === 'KeyO') { naMapu(); return; }
      if (obrazovka === 'mapa' || obrazovka === 'obchod') {
        const smer = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] }[e.code];
        if (smer) { posunVyber(...smer); e.preventDefault(); }
        return;
      }
      if (herni && e.code === 'Enter') { e.preventDefault(); return; }
      if (MAPA_KLAVES[e.code]) { klavesy.add(e.code); e.preventDefault(); Z.priprav(); }
    });
    addEventListener('keyup', e => klavesy.delete(e.code));
    addEventListener('blur', () => { klavesy.clear(); for (const k in dotyk) dotyk[k] = false; if (obrazovka === 'hra') nastavObrazovku('pauza'); });
    cv.addEventListener('pointerdown', e => {
      if (obrazovka === 'hra') return;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
      const v = b => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      Z.priprav();
      if (obrazovka === 'mapa') {
        if (v(tlacitkaMapy.hrat)) { potvrd(); return; }
        if (v(tlacitkaMapy.obchod)) { vyberObchod = 0; hlaska = null; nastavObrazovku('obchod'); return; }
        const u = uzlyMapy().find(u => Math.hypot(u.x - x, u.y - y) < u.r + 8);
        if (u && u.i <= data.postup) { if (u.i === vyber) potvrd(); else { vyber = u.i; Z.hraj('cvak'); } }
        return;
      }
      if (obrazovka === 'obchod') {
        if (v(tlacitkaObchodu.zpet)) { naMapu(); return; }
        const radek = (tlacitkaObchodu.radky || []).find(v);
        if (radek) { vyberObchod = radek.k; kup(radek.k); }
        return;
      }
      potvrd();
    });
    // dotyková tlačítka (víc prstů najednou)
    const tl = { tVlevo: 'vlevo', tVpravo: 'vpravo', tNahoru: 'nahoru', tDolu: 'dolu', tSkok: 'skok', tUtok: 'utok', tHod: 'hod' };
    for (const id in tl) {
      const el = document.getElementById(id), akce = tl[id];
      if (!el) continue;
      const dolu = e => { e.preventDefault(); dotyk[akce] = true; el.classList.add('drzi'); Z.priprav(); try { el.setPointerCapture(e.pointerId); } catch { /* syntetická událost */ } if (obrazovka === 'pauza' || obrazovka === 'smrt' || obrazovka === 'hotovo') potvrd(); };
      const nahoru = e => { e.preventDefault(); dotyk[akce] = false; el.classList.remove('drzi'); };
      el.addEventListener('pointerdown', dolu);
      el.addEventListener('pointerup', nahoru);
      el.addEventListener('pointercancel', nahoru);
      el.addEventListener('lostpointercapture', nahoru);
      el.addEventListener('contextmenu', e => e.preventDefault());
    }
    addEventListener('touchstart', () => document.body.classList.add('dotykove'), { once: true, passive: true });
    if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('dotykove');
    document.getElementById('zvukBtn').addEventListener('click', prepniZvuk);
    const hb = document.getElementById('hudbaBtn');
    if (hb) hb.addEventListener('click', prepniHudbu);
  }

  function prepniZvuk() {
    Z.priprav();
    const zap = Z.prepni();
    document.getElementById('zvukBtn').textContent = zap ? '🔊' : '🔇';
  }
  function prepniHudbu() {
    Z.priprav();
    if (!HU) return;
    const zap = HU.prepni();
    const hb = document.getElementById('hudbaBtn');
    if (hb) hb.style.opacity = zap ? '1' : '.4';
    HU.hraj(hudbaPro());
  }

  // ---------- velikost plátna ----------
  function prizpusob() {
    const info = document.getElementById('info');
    const volnoH = innerHeight - (info.offsetHeight || 20) - 24;
    const volnoW = innerWidth - 16;
    let s = Math.min(volnoW / W, volnoH / H);
    if (s >= 1) s = Math.max(1, Math.floor(s * 2) / 2);
    cv.style.width = Math.floor(W * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
  }

  // ---------- smyčka ----------
  let posledni = 0, zasoba = 0;
  function smycka(t) {
    const dt = Math.min(0.1, (t - posledni) / 1000 || 0);
    posledni = t;
    zasoba += dt;
    prepocitejVstup();
    let n = 0;
    while (zasoba >= K.DT && n++ < 6) { aktualizuj(); zasoba -= K.DT; }
    if (n >= 6) zasoba = 0;
    kresli();
    requestAnimationFrame(smycka);
  }

  function start() {
    cv = document.getElementById('cv');
    g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    svetlo = document.createElement('canvas'); svetlo.width = W; svetlo.height = H; sg = svetlo.getContext('2d');
    rekord = Rekord.sleduj('webapp_hra_krumpac', { popisek: 'Rekord' });
    rekord.prvek(document.getElementById('rekordBox'));
    document.getElementById('zvukBtn').textContent = Z.zapnuto() ? '🔊' : '🔇';
    const hb = document.getElementById('hudbaBtn'); if (hb && HU) hb.style.opacity = HU.zapnuto() ? '1' : '.4';
    napojOvladani();
    addEventListener('resize', prizpusob);
    prizpusob();
    nactiObrazky().then(() => requestAnimationFrame(smycka));
  }

  // pro testy
  return {
    start, zacniUroven, potvrd, vstup, naMapu,
    stav: () => ({ obrazovka, st, urovenIdx, bodyCelkem, kamera, vyber, data, vysledek }),
    obrazovka: o => nastavObrazovku(o),
  };
})(KRUMPAC);
