/* ============================================================
   Síně pod horou – ui.js: stránka, smyčka simulace, kamera,
   nástroje (kopat, schody, díra, otesat, kácet, přednost, zrušit,
   stavět), přepínač pater, minimapa, klan, deník a popis pole.
   Jediný soubor (vedle kresba.js a postavy.js), který sahá na DOM
   a localStorage.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, PR = S.prace, HR = S.hra, C = S.cesty, PO = S.postavy, ST = S.stavby, U = S.ulozeni, { O } = SV, OZN = PR.OZN;
  const Z = S.zvuk, CA = S.castice, castice = CA.vytvor();
  const KLIC_HRY = 'webapp_hra_sine_save';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_hra_sine_nastaveni';
  const ZOOM_MIN = 0.25, ZOOM_MAX = 2, TAHU_ZA_S = 10, MAX_TAHU_SNIMEK = 12;

  const nacti = () => { try { return JSON.parse(localStorage.getItem(KLIC)) || {}; } catch (e) { return {}; } };
  const uloz = n => { try { localStorage.setItem(KLIC, JSON.stringify(n)); } catch (e) { /* bez úložiště */ } };

  const par = new URLSearchParams(location.search);
  const nast = Object.assign({ seed: null, vel: 'stredni', odkryt: false, rezim: 'kampan' }, nacti());
  if (par.has('seed')) nast.seed = S.nahoda.seedZTextu(par.get('seed'));
  if (par.has('vel')) nast.vel = par.get('vel');
  if (par.has('odkryt')) nast.odkryt = par.get('odkryt') === '1';
  if (nast.seed == null) nast.seed = S.nahoda.seedDne();

  const cv = $('mapa'), ctx = cv.getContext('2d'), obal = $('obal');
  const mini = $('minimapa'), mctx = mini.getContext('2d');
  let hra, sv, kresba, kam, dpr = 1, ceka = 0, hover = null, vybrane = null, vybranyTrp = null, vybranyTvor = null;
  let rychlost = 0, zbytek = 0, posledni = 0, nastroj = '', stavba = 'tesarna', smer = 0, vyber = null;
  let vybranaBudova = null, vybranyPlan = null, vybranaZona = null, posledniUlozeni = 0, zonaTyp = 'sklad';
  const miniData = [], miniSpina = new Set();

  // --- nová hra -----------------------------------------------------------------------
  function novaHora(seed, vel) {
    nast.seed = seed >>> 0; nast.vel = SV.VELIKOSTI[vel] ? vel : 'stredni';
    uloz(nast);
    const h = HR.novaHra(nast.seed, nast.vel);
    h.rezim = nast.rezim === 'volny' ? 'volny' : 'kampan';
    if (nast.odkryt) { SV.odkrytVse(h.sv); h.verzeTerenu++; }
    zacni(h);
    ulozHru();
  }
  // nasadí hru (novou nebo načtenou) do rozhraní
  function zacni(h) {
    hra = h; sv = hra.sv;
    nast.seed = hra.seed; nast.vel = hra.velikost;
    kresba = S.kresba.vytvor(sv, { stavby: PO.stavbyVBloku(hra) });
    kam = { p: 0, x: sv.brana.x + 1, y: sv.brana.y + 1, zoom: 1 };
    if (par.has('patro')) kam.p = Math.max(0, Math.min(SV.PATER - 1, +par.get('patro') || 0));
    if (par.has('zoom')) kam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +par.get('zoom') || 1));
    $('seed').value = nast.seed; $('velikost').value = nast.vel; $('odkryt').checked = nast.odkryt; $('rezim').value = hra.rezim;
    konecUkazan = !!hra.konec; pribehHtml = '';
    $('nazev').textContent = 'Hora ' + sv.jmeno;
    mini.width = sv.W; mini.height = sv.H;
    miniData.length = 0;
    postavPatra();
    vybrane = null; vybranyTrp = null; vybranyTvor = null; vybranaBudova = vybranyPlan = vybranaZona = null; obnovInfo();
    nastavRychlost(0);
    obnovKlan(true); obnovDenik(true); obnovZasoby(true);
    posledniUlozeni = hra.tik;
  }
  // --- ukládání -----------------------------------------------------------------------
  function ulozHru() {
    if (!hra) return false;
    try { localStorage.setItem(KLIC_HRY, JSON.stringify(U.uloz(hra))); posledniUlozeni = hra.tik; return true; }
    catch (e) { hlaska('Hru se nepodařilo uložit: ' + e.message); return false; }
  }
  function nactiUlozenou() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KLIC_HRY)); } catch (e) { d = null; }
    if (!d) return false;
    try { zacni(U.nacti(d)); return true; }
    catch (e) { hlaska('Uloženou hru nejde načíst: ' + e.message); return false; }
  }
  function exportuj() {
    const blob = new Blob([JSON.stringify(U.uloz(hra))], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `sine-${sv.jmeno.replace(/\s+/g, '_')}-den${Math.floor(hra.tik / HR.TAHU_ZA_DEN) + 1}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importuj(soubor) {
    try { zacni(U.nacti(JSON.parse(await soubor.text()))); ulozHru(); hlaska('Hra načtena.'); }
    catch (e) { hlaska('Soubor nejde načíst: ' + e.message); }
  }

  // --- simulace -----------------------------------------------------------------------
  function nastavRychlost(r) {
    rychlost = r; zbytek = 0;
    document.querySelectorAll('.rychlost button').forEach(b => b.classList.toggle('akt', +b.dataset.r === r));
    $('pauza').hidden = r !== 0;
  }
  function tahni(n) {               // n tahů simulace (i pro testy)
    for (let k = 0; k < n; k++) HR.krok(hra);
    vyzvedniZmeny();
  }
  function vyzvedniZmeny() {
    if (hra.zmenyVse) { hra.zmenyVse = false; kresba.zneplatni(); for (let p = 0; p < SV.PATER; p++) miniSpina.add(p); }
    if (!hra.zmeny.length) return;
    // po patrech obdélník změn (bloky se zneplatní najednou)
    const bb = new Map();
    for (const g of hra.zmeny) {
      const p = (g / sv.N) | 0, l = g - p * sv.N, x = l % sv.W, y = (l / sv.W) | 0;
      const b = bb.get(p);
      if (!b) bb.set(p, [x, y, x, y]); else { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    }
    hra.zmeny.length = 0;
    for (const [p, b] of bb) {
      // velké obdélníky (rozptýlené změny) by zneplatnily skoro celé patro – rozdělit podle bloků je zbytečné, stačí obdélník
      kresba.zneplatni(p, b[0], b[1], b[2], b[3]);
      miniSpina.add(p);
    }
  }

  // --- přepínač pater -----------------------------------------------------------------
  function postavPatra() {
    const el = $('patra');
    el.innerHTML = '';
    SV.PATRA.forEach((pp, p) => {
      const b = document.createElement('button');
      b.className = 'patro'; b.dataset.p = p;
      b.title = `${pp.nazev} (${pp.hloubka}) – ${pp.hornina}`;
      const c = document.createElement('canvas'); c.width = sv.W; c.height = sv.H;
      const t = document.createElement('span'); t.className = 't';
      t.innerHTML = `<b>${pp.nazev} <i class="lidi"></i></b><span>${pp.hloubka} · ${pp.hornina}</span>` +
        (pp.varovani ? `<span class="var">⚠️ ${pp.varovani}</span>` : '');
      b.append(c, t);
      b.addEventListener('click', () => prepniPatro(p));
      el.append(b);
    });
    obnovNahledy();
  }
  function dataMinimapy(p) {
    if (!miniData[p] || miniSpina.has(p)) {
      const d = miniData[p] || new ImageData(sv.W, sv.H);
      S.kresba.minimapa(sv, p, d.data);
      miniData[p] = d; miniSpina.delete(p);
    }
    return miniData[p];
  }
  function obnovNahledy() {
    const pocty = new Array(SV.PATER).fill(0);
    for (const t of hra.trpaslici) pocty[(t.g / sv.N) | 0]++;
    document.querySelectorAll('.patro').forEach(b => {
      const p = +b.dataset.p;
      b.classList.toggle('akt', p === kam.p);
      b.querySelector('canvas').getContext('2d').putImageData(dataMinimapy(p), 0, 0);
      b.querySelector('.lidi').textContent = pocty[p] ? '🧔' + pocty[p] : '';
    });
  }
  function prepniPatro(p) {
    p = Math.max(0, Math.min(SV.PATER - 1, p));
    if (p === kam.p) return;
    kam.p = p;
    document.querySelectorAll('.patro').forEach(b => b.classList.toggle('akt', +b.dataset.p === p));
    vybrane = null; obnovInfo();
  }

  // --- kamera -------------------------------------------------------------------------
  const meritko = () => 64 * kam.zoom;            // CSS px na pole
  function omez() {
    kam.x = Math.max(0, Math.min(sv.W, kam.x)); kam.y = Math.max(0, Math.min(sv.H, kam.y));
    kam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, kam.zoom));
  }
  function vystred(x, y) { kam.x = x; kam.y = y; omez(); }
  function zoomuj(z, sx, sy) {
    const r = obal.getBoundingClientRect();
    if (sx == null) { sx = r.width / 2; sy = r.height / 2; }
    const pred = naPole(sx, sy);
    kam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    const po = naPole(sx, sy);
    kam.x += pred.x - po.x; kam.y += pred.y - po.y;
    omez();
  }
  function naPole(sx, sy) {
    const r = obal.getBoundingClientRect(), s = meritko();
    return { x: kam.x + (sx - r.width / 2) / s, y: kam.y + (sy - r.height / 2) / s };
  }
  function skokNa(g) {
    const p = (g / sv.N) | 0, l = g - p * sv.N;
    prepniPatro(p); vystred(l % sv.W + 0.5, ((l / sv.W) | 0) + 0.5);
  }

  // --- kreslení -----------------------------------------------------------------------
  function velikost() {
    const r = obal.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  let posledniPanel = 0;
  function snimek(cas) {
    const dt = Math.min(250, cas - (posledni || cas)); posledni = cas;
    if (rychlost && !hra.konec) {
      zbytek += dt / 1000 * TAHU_ZA_S * rychlost;
      const n = Math.min(MAX_TAHU_SNIMEK * rychlost, Math.floor(zbytek));
      zbytek -= n;
      if (n) tahni(n);
    }
    vyberZvuky();
    emitory(dt / 1000);
    CA.krok(castice, dt / 1000);
    if (cas - posledniProstredi > 1000) { posledniProstredi = cas; prostredi(); }
    kresliVse();
    if (cas - posledniPanel > 400) { posledniPanel = cas; obnovKlan(); obnovDenik(); obnovCas(); obnovNahledy(); obnovZasoby(); if (vybranyTrp || vybranyTvor || vybrane || vybranaBudova || vybranyPlan) obnovInfo(); }
    if (hra.tik - posledniUlozeni >= HR.TAHU_ZA_DEN) ulozHru();          // automaticky každý herní den
    requestAnimationFrame(snimek);
  }
  // --- zvuk a částice: události z logiky, prostředí, emitory --------------------------------------
  const GLOBALNI = new Set(['roh', 'objev', 'zvonek', 'smrt', 'fanfara', 'varovani', 'deska']);
  let posledniProstredi = 0, emitCas = 0;
  function vyberZvuky() {
    const ev = hra._zvuky;
    if (!ev || !ev.length) return;
    hra._zvuky = [];
    const s = meritko(), sirka = cv.width / dpr / s, vyska = cv.height / dpr / s;
    for (const e of ev) {
      if (e.g < 0 || GLOBALNI.has(e.typ)) { Z.hraj(e.typ, 0.8, {}, e.x); continue; }
      const p = (e.g / sv.N) | 0, l = e.g % sv.N, x = l % sv.W + 0.5, y = ((l / sv.W) | 0) + 0.5;
      if (Math.abs(p - kam.p) > 1 || !sv.zn[e.g]) continue;
      if (Math.abs(x - kam.x) > sirka / 2 + 4 || Math.abs(y - kam.y) > vyska / 2 + 4) continue;
      if (p === kam.p) CA.zUdalosti(castice, e, p, x, y);
      const m = p > 0 ? S.mistnosti.mistnostNa(hra, e.g) : null;
      const ozv = Z.miraOzveny(m ? (m.uzavrena ? m.pole : 260) : 0, p === 0);
      Z.hraj(e.typ, Math.min(1, 0.35 + s / 6), { pan: (x - kam.x) / (sirka / 2), ozvena: ozv, patro: p !== kam.p ? 1 : 0 }, e.x);
    }
  }
  // stálé zdroje částic v záběru: kouř a jiskry pracujících pecí, Výheň, sníh v zimě
  const OHNE = { milir: 'kour', tavirna: 'jiskra', kovarna: 'jiskra', magmovyhen: 'jiskra', runova_kovarna: 'runa', kuchyne: 'kour', pivovar: 'kour' };
  function emitory(dt) {
    emitCas += dt; if (emitCas < 0.12) return;
    const d = emitCas; emitCas = 0;
    const s = meritko(), sirka = cv.width / dpr / s, vyska = cv.height / dpr / s;
    const vidim = (x, y) => Math.abs(x - kam.x) < sirka / 2 + 2 && Math.abs(y - kam.y) < vyska / 2 + 2;
    for (const b of hra.budovy) {
      const druh = OHNE[b.typ]; if (!druh || ((b.g / sv.N) | 0) !== kam.p) continue;
      const l = b.g % sv.N, x = l % sv.W + 0.6, y = ((l / sv.W) | 0) + 0.6;
      if (!vidim(x, y)) continue;
      const pracuje = hra.trpaslici.some(t => t.prace && t.prace.dilna === b.id && t.akce > 0);
      if (!pracuje) continue;
      if (Math.random() < d * 3) CA.pridej(castice, 'kour', kam.p, x, y, 1, { smer: -Math.PI / 2, rozptyl: 0.5 });
      if (druh !== 'kour' && Math.random() < d * 4) CA.pridej(castice, druh === 'runa' ? 'runa' : 'uhlik', kam.p, x, y, 1);
    }
    if (kam.p === sv.srdce.p && (hra.zazehnuti || hra.vyhenHori) && sv.zn[kam.p * sv.N + sv.srdce.y * sv.W + sv.srdce.x]) {
      const n = hra.vyhenHori ? 1 : 2 + Math.floor(4 * hra.zazehnuti / S.pribeh.DOBA_ZAZEHNUTI);
      CA.pridej(castice, 'uhlik', kam.p, sv.srdce.x + 0.5, sv.srdce.y + 0.5, n, { rychl: 2 });
    }
    if (kam.p === 0 && sv.obdobi === 3) {
      const n = Math.round(sirka * vyska * d * 0.02);
      for (let k = 0; k < n; k++) CA.pridej(castice, 'snih', 0, kam.x + (Math.random() - 0.5) * sirka, kam.y - vyska / 2 + Math.random() * vyska * 0.8, 1);
    }
  }
  // zvuky prostředí a hudba (jednou za sekundu): vítr a potok v rokli, tržiště s karavanou, kapky v podzemí
  function prostredi() {
    if (!hra) return;
    Z.hudba(kam.p);
    const s = meritko(), sirka = cv.width / dpr / s, vyska = cv.height / dpr / s;
    let voda = 0, n = 0;
    const x0 = Math.max(0, Math.floor(kam.x - sirka / 2)), x1 = Math.min(sv.W - 1, Math.ceil(kam.x + sirka / 2));
    const y0 = Math.max(0, Math.floor(kam.y - vyska / 2)), y1 = Math.min(sv.H - 1, Math.ceil(kam.y + vyska / 2));
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) { const g = kam.p * sv.N + y * sv.W + x; n++; if (sv.kap[g] && sv.kapTyp[g] === SV.K.VODA && sv.zn[g]) voda++; }
    const podil = n ? voda / n : 0, venku = kam.p === 0;
    const tr = sv.trziste, uTrhu = hra.karavana && venku && tr && Math.hypot(tr.x - kam.x, tr.y - kam.y) < sirka;
    Z.prostredi({ vitr: venku ? (sv.obdobi === 3 ? 1 : 0.6) : 0, potok: venku && sv.obdobi !== 3 ? Math.min(1, podil * 12) : 0,
                  trh: uTrhu ? 1 : 0, kapky: !venku && podil > 0 ? Math.min(1, 0.3 + podil * 8) : 0 });
  }
  function kresliVse(rozpocet) {
    velikost();
    vyzvedniZmeny();                 // i za pauzy (mříž, zbourání, rušení plánů z panelu)
    ceka = kresba.kresli(ctx, kam, cv.width, cv.height, dpr, rozpocet);
    prekryv();
    hlidejUdalost();
    kresliMinimapu();
    obnovStitek();
    return ceka;
  }
  const kresliHned = () => kresliVse(1e9);
  let nahledStab = { klic: '', pole: [] };
  // --- tma a světlo ------------------------------------------------------------------
  const tmaCv = document.createElement('canvas'), teploCv = document.createElement('canvas');
  let tmaKlic = '';
  function kresliTmu(s, x0, y0) {
    const L = S.svetlo, m = L.mapy(hra), den = L.denni(L.hodina(hra)), p = kam.p, zp = p * sv.N;
    const klic = p + ':' + hra.verzeTerenu + ':' + Math.round(den * 40) + ':' + sv.W;
    if (klic !== tmaKlic) {
      tmaKlic = klic;
      for (const c of [tmaCv, teploCv]) if (c.width !== sv.W || c.height !== sv.H) { c.width = sv.W; c.height = sv.H; }
      const tc = tmaCv.getContext('2d'), wc = teploCv.getContext('2d');
      const ti = tc.createImageData(sv.W, sv.H), wi = wc.createImageData(sv.W, sv.H), td = ti.data, wd = wi.data;
      for (let l = 0; l < sv.N; l++) {
        const g = zp + l, o = l * 4;
        const venku = p === 0 && (sv.teren[g] !== SV.M.VOLNO || (sv.oblast[g] && sv.oblasti[sv.oblast[g]].typ === 'rokle'));
        if (venku) { td[o] = 10; td[o + 1] = 16; td[o + 2] = 42; td[o + 3] = Math.round((1 - den) * 0.6 * 255); }
        else {
          const sv_ = Math.max(m.slunce[g] * den, m.zdroj[g]);
          td[o] = 6; td[o + 1] = 5; td[o + 2] = 12; td[o + 3] = Math.round((1 - Math.min(1, sv_ * 1.3)) * 0.8 * 255);
        }
        const w = m.ohen[g];
        if (w > 0) { wd[o] = 255; wd[o + 1] = 160; wd[o + 2] = 70; wd[o + 3] = Math.round(w * 0.28 * 255); }
      }
      tc.putImageData(ti, 0, 0); wc.putImageData(wi, 0, 0);
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const ox = -x0 * s, oy = -y0 * s;
    ctx.drawImage(tmaCv, ox, oy, sv.W * s, sv.H * s);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(teploCv, ox, oy, sv.W * s, sv.H * s);
    // lampičky trpaslíků (pod zemí a v noci)
    if (p > 0 || den < 0.6) for (const t of hra.trpaslici) {
      const q = PO.poloha(hra, t); if (q.p !== p) continue;
      const X = (q.x - x0) * s, Y = (q.y - y0) * s, r = s * 1.8;
      const gr = ctx.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, 'rgba(255,200,120,0.22)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gr; ctx.fillRect(X - r, Y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }

  function prekryv() {
    const s = meritko() * dpr, x0 = kam.x - cv.width / 2 / s, y0 = kam.y - cv.height / 2 / s;
    const naObr = (x, y) => [(x - x0) * s, (y - y0) * s];
    const vx0 = Math.max(0, Math.floor(x0)), vy0 = Math.max(0, Math.floor(y0));
    const vx1 = Math.min(sv.W - 1, Math.ceil(x0 + cv.width / s)), vy1 = Math.min(sv.H - 1, Math.ceil(y0 + cv.height / s));
    const zp = kam.p * sv.N;
    const typZony = {}; for (const z of hra.zony) typZony[z.id] = z.typ;
    ctx.save();
    // --- pod tmou: zóny (nádech), úroda, zásoby dílen, věci
    for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
      const g = zp + y * sv.W + x, z = hra.zona[g];
      if (!z) continue;
      const [X, Y] = naObr(x, y), b = (ST.ZONY[typZony[z]] || ST.ZONY.sklad).barva;
      ctx.fillStyle = `rgba(${b[0]},${b[1]},${b[2]},${vybranaZona === z ? 0.22 : 0.09})`; ctx.fillRect(X, Y, s, s);
      if (hra.uroda[g]) PO.uroda(ctx, typZony[z], hra.uroda[g], X, Y, s, g);
    }
    for (const b of hra.budovy) {
      if (((b.g / sv.N) | 0) !== kam.p || !ST.STAVBY[b.typ].dilna || !b.mista) continue;
      const pp = ST.predniPole(sv, b); if (!pp.length) continue;
      const druhy = b.mista.flatMap(m => Object.entries(m.zasoba).flatMap(([d, n]) => Array(Math.min(n, 3)).fill(d))).slice(0, 4);
      const lq = pp[0] - zp, [X, Y] = naObr(lq % sv.W, (lq / sv.W) | 0);
      druhy.forEach((d, k) => PO.vec(ctx, d, X + s * (0.25 + 0.17 * k), Y + s * 0.3, s * 0.11));
    }
    const naPoli = new Map();
    for (const v of hra.veci) {
      if (v.g < 0 || ((v.g / sv.N) | 0) !== kam.p || !sv.zn[v.g]) continue;
      const a = naPoli.get(v.g); if (a) a.push(v.druh); else naPoli.set(v.g, [v.druh]);
    }
    for (const [g, druhy] of naPoli) {
      const l = g - zp, x = l % sv.W, y = (l / sv.W) | 0;
      if (x < vx0 - 1 || x > vx1 + 1 || y < vy0 - 1 || y > vy1 + 1) continue;
      const [X, Y] = naObr(x, y);
      [...new Set(druhy)].slice(0, 3).forEach((d, k) => PO.vec(ctx, d, X + s * (0.3 + 0.2 * k), Y + s * (0.68 - 0.12 * (k & 1)), s * 0.13));
      if (druhy.length > 1 && s >= 24) {
        ctx.font = `bold ${Math.round(s * 0.18)}px sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(druhy.length, X + s - 2, Y + s - 1);
        ctx.fillStyle = '#f3e6c4'; ctx.fillText(druhy.length, X + s - 3, Y + s - 2);
      }
    }
    // karavana: tři vozy za sebou po cestě
    if (kam.p === 0 && hra.karavana) {
      const k = hra.karavana;
      for (let n = 0; n < 3; n++) {
        const g = S.obdobi.polohaKaravany(hra, n * 3), g2 = S.obdobi.polohaKaravany(hra, n * 3 - 1);
        if (g < 0) continue;
        const l = g % sv.N, l2 = g2 % sv.N, [X, Y] = naObr(l % sv.W + 0.5, ((l / sv.W) | 0) + 0.5);
        const ang = Math.atan2(((l2 / sv.W) | 0) - ((l / sv.W) | 0), l2 % sv.W - l % sv.W) || -Math.PI / 2;
        PO.vuz(ctx, X, Y, s * 1.1, ang, ['#c8b48a', '#a85a4a', '#5a7aa8'][n]);
      }
      void k;
    }
    CA.kresli(ctx, castice, kam.p, naObr, s, 'pod');
    ctx.restore();
    // --- tma podzemí, noc venku, záře ohňů
    kresliTmu(s, x0, y0);
    ctx.save();
    // --- nad tmou: trpaslíci
    const faze = (performance.now() / 600) % 1;
    for (const t of hra.trpaslici) {
      const q = PO.poloha(hra, t);
      if (q.p !== kam.p) continue;
      const [X, Y] = naObr(q.x, q.y);
      if (X < -s || Y < -s || X > cv.width + s || Y > cv.height + s) continue;
      PO.trpaslik(ctx, t, X, Y, s, (faze + t.id * 0.17) % 1, vybranyTrp === t.id);
    }
    // tvorové (jen na známých polích) a střely v letu
    for (const u of hra.tvorove) {
      if (!sv.zn[u.g]) continue;
      const q = PO.poloha(hra, u);
      if (q.p !== kam.p) continue;
      const [X, Y] = naObr(q.x, q.y);
      if (X < -2 * s || Y < -2 * s || X > cv.width + 2 * s || Y > cv.height + 2 * s) continue;
      PO.tvor(ctx, u, X, Y, s, (faze * 2.5 + u.id * 0.13) % 1, vybranyTvor === u.id);
    }
    CA.kresli(ctx, castice, kam.p, naObr, s, 'nad');
    if (hra.strely) for (const st of hra.strely) {
      const f = (hra.tik - st.tik + zbytek) / 6;
      if (f < 0 || f > 1 || ((st.z / sv.N) | 0) !== kam.p) continue;
      const a = st.z % sv.N, b = st.na % sv.N, [X0, Y0] = naObr(a % sv.W + 0.5, ((a / sv.W) | 0) + 0.5), [X1, Y1] = naObr(b % sv.W + 0.5, ((b / sv.W) | 0) + 0.5);
      PO.strela(ctx, X0, Y0, X1, Y1, f, s);
    }
    // Výheň předků: plamen při zažíhání a po zažehnutí, nepřečtené runové desky září
    if (kam.p === sv.srdce.p && (hra.zazehnuti || hra.vyhenHori) && sv.zn[kam.p * sv.N + sv.srdce.y * sv.W + sv.srdce.x]) {
      const [X, Y] = naObr(sv.srdce.x + 0.5, sv.srdce.y + 0.5), f = hra.vyhenHori ? 1 : hra.zazehnuti / S.pribeh.DOBA_ZAZEHNUTI, t = performance.now() / 1000;
      const r = s * (0.9 + 1.6 * f) * (1 + 0.06 * Math.sin(t * 7));
      const gr = ctx.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, 'rgba(255,240,180,0.95)'); gr.addColorStop(0.35, 'rgba(255,160,50,0.6)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
      if (!hra.vyhenHori) { ctx.strokeStyle = 'rgba(255,210,120,0.9)'; ctx.lineWidth = Math.max(2, s * 0.06); ctx.beginPath(); ctx.arc(X, Y, s * 0.75, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); }
    }
    for (const g of hra._desky || []) {
      if (((g / sv.N) | 0) !== kam.p || !sv.zn[g] || hra.deskyPrectene.includes(g)) continue;
      const l = g % sv.N, [X, Y] = naObr(l % sv.W + 0.5, ((l / sv.W) | 0) + 0.5), a = 0.35 + 0.25 * Math.sin(performance.now() / 400);
      ctx.strokeStyle = `rgba(190,170,255,${a})`; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.beginPath(); ctx.arc(X, Y, s * 0.55, 0, Math.PI * 2); ctx.stroke();
    }
    // patro nad: schodiště a díry, které vedou sem
    if (kam.p > 0) {
      ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.strokeStyle = 'rgba(243,201,107,0.55)'; ctx.lineWidth = 1.5 * dpr;
      const zn = zp - sv.N;
      for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
        const o = sv.obj[zn + y * sv.W + x];
        if (o === O.SCHODY_DOLU || o === O.DIRA || o === O.ZEBRIK || o === O.SACHTA) { const [X, Y] = naObr(x, y); ctx.strokeRect(X + 2, Y + 2, s - 4, s - 4); }
      }
      ctx.setLineDash([]);
    }
    // okraje zón, značky prací
    for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
      const g = zp + y * sv.W + x, z = hra.zona[g];
      if (hra.oznac[g]) { const [X, Y] = naObr(x, y); PO.znacka(ctx, hra, g, X, Y, s); }
      if (!z) continue;
      const [X, Y] = naObr(x, y), zv = vybranaZona === z, b = (ST.ZONY[typZony[z]] || ST.ZONY.sklad).barva;
      ctx.strokeStyle = `rgba(${b[0]},${b[1]},${b[2]},${zv ? 0.95 : 0.5})`; ctx.lineWidth = Math.max(1, s * (zv ? 0.05 : 0.03));
      ctx.beginPath();
      if (y === 0 || hra.zona[g - sv.W] !== z) { ctx.moveTo(X, Y); ctx.lineTo(X + s, Y); }
      if (y === sv.H - 1 || hra.zona[g + sv.W] !== z) { ctx.moveTo(X, Y + s); ctx.lineTo(X + s, Y + s); }
      if (x === 0 || hra.zona[g - 1] !== z) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + s); }
      if (x === sv.W - 1 || hra.zona[g + 1] !== z) { ctx.moveTo(X + s, Y); ctx.lineTo(X + s, Y + s); }
      ctx.stroke();
    }
    for (const pl of hra.plany) if (((pl.g / sv.N) | 0) === kam.p) {
      const l = pl.g - zp, [X, Y] = naObr(l % sv.W, (l / sv.W) | 0); PO.plan(ctx, hra, pl, X, Y, s);
    }
    // dílny: ukazatel výroby, vybraná stavba
    for (const b of hra.budovy) {
      if (((b.g / sv.N) | 0) !== kam.p) continue;
      const l = b.g - zp, bx = l % sv.W, by = (l / sv.W) | 0;
      if (bx > vx1 + 3 || by > vy1 + 3 || bx < vx0 - 3 || by < vy0 - 3) continue;
      if (ST.STAVBY[b.typ].dilna) {
        const prac = hra.trpaslici.find(t => t.prace && t.prace.druh === 'vyrobit' && t.prace.dilna === b.id && t.akce > 0);
        if (prac && s >= 16) {
          const [X, Y] = naObr(bx, by), [w] = ST.rozmer(b.typ, b.smer);
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(X + s * 0.15, Y + s * 0.06, (w - 0.3) * s, s * 0.08);
          ctx.fillStyle = '#f3c96b'; ctx.fillRect(X + s * 0.15, Y + s * 0.06, (w - 0.3) * s * (1 - prac.akce / prac.akceDoba), s * 0.08);
        }
      }
      if (vybranaBudova === b.id) {
        const [X, Y] = naObr(bx, by), [w, h] = ST.rozmer(b.typ, b.smer);
        ctx.strokeStyle = 'rgba(243,201,107,0.95)'; ctx.lineWidth = 2 * dpr; ctx.strokeRect(X, Y, w * s, h * s);
      }
    }
    // praskající strop: praskliny a odpočet
    for (const pr of hra.praskani) {
      if (((pr.g / sv.N) | 0) !== kam.p) continue;
      ctx.strokeStyle = 'rgba(255,90,60,0.85)'; ctx.lineWidth = Math.max(1, s * 0.03);
      for (const g of pr.bunky) {
        const l = g % sv.N, [X, Y] = naObr(l % sv.W, (l / sv.W) | 0);
        ctx.fillStyle = 'rgba(255,60,30,0.12)'; ctx.fillRect(X, Y, s, s);
        ctx.beginPath(); ctx.moveTo(X + s * 0.15, Y + s * 0.2); ctx.lineTo(X + s * 0.45, Y + s * 0.5); ctx.lineTo(X + s * 0.35, Y + s * 0.75);
        ctx.moveTo(X + s * 0.45, Y + s * 0.5); ctx.lineTo(X + s * 0.85, Y + s * 0.4); ctx.stroke();
      }
      const l = pr.g % sv.N, [X, Y] = naObr(l % sv.W + 0.5, (l / sv.W | 0) + 0.5);
      const zbyva = Math.max(0, Math.ceil((pr.do - hra.tik) / TAHU_ZA_S));
      ctx.font = `bold ${Math.round(Math.max(11, s * 0.28))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(20,6,4,0.8)'; const txt = `⚠️ zával za ${zbyva} s`, tw = ctx.measureText(txt).width + 10;
      ctx.fillRect(X - tw / 2, Y - s * 0.22, tw, s * 0.44); ctx.fillStyle = '#ffb090'; ctx.fillText(txt, X, Y);
    }
    // náhled stability při kopání: nepodepřená pole červeně
    if (vyber && vyber.p === kam.p && nastroj === 'kopat') {
      const xa = Math.min(vyber.x0, vyber.x1), ya = Math.min(vyber.y0, vyber.y1), xb = Math.max(vyber.x0, vyber.x1), yb = Math.max(vyber.y0, vyber.y1);
      const klic = [kam.p, xa, ya, xb, yb, hra.verzeTerenu].join(':');
      if (nahledStab.klic !== klic) {
        const navic = new Set();
        for (let y = Math.max(0, ya); y <= Math.min(sv.H - 1, yb); y++) for (let x = Math.max(0, xa); x <= Math.min(sv.W - 1, xb); x++) {
          const g = zp + y * sv.W + x; if (sv.teren[g] !== SV.M.VOLNO && sv.teren[g] !== SV.M.PODLOZI && !hra.planNa.has(g)) navic.add(g);
        }
        for (let g = zp; g < zp + sv.N; g++) if (hra.oznac[g] === OZN.KOPAT && !hra.planNa.has(g)) navic.add(g);
        nahledStab = { klic, pole: S.priroda.nepodeprena(hra, kam.p, navic) };
      }
      for (const g of nahledStab.pole) { const l = g - zp, [X, Y] = naObr(l % sv.W, (l / sv.W) | 0); ctx.fillStyle = 'rgba(255,60,40,0.28)'; ctx.fillRect(X, Y, s, s); }
      const [X, Y] = naObr(xb + 1, yb + 1);
      ctx.font = `bold ${13 * dpr}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const txt = nahledStab.pole.length ? '⚠️ potřebuje sloupy' : '✅ strop vydrží';
      ctx.fillStyle = 'rgba(10,12,21,0.8)'; ctx.fillRect(X + 4, Y + 2, ctx.measureText(txt).width + 10, 18 * dpr);
      ctx.fillStyle = nahledStab.pole.length ? '#ffb090' : '#bff0b0'; ctx.fillText(txt, X + 9, Y + 4);
    }
    // náhled stavby pod kurzorem
    if (nastroj === 'stavet' && hover && hover.p === kam.p && !vyber) {
      const g = kam.p * sv.N + hover.y * sv.W + hover.x;
      if (hover.x >= 0 && hover.y >= 0 && hover.x < sv.W && hover.y < sv.H) {
        const [X, Y] = naObr(hover.x, hover.y);
        PO.nahled(ctx, hra, stavba, g, smer, X, Y, s, ST.lzePostavit(hra, stavba, g, smer) ? 'ne' : 'ok');
      }
    }
    // výběr nástrojem
    if (vyber && vyber.p === kam.p) {
      const xa = Math.min(vyber.x0, vyber.x1), ya = Math.min(vyber.y0, vyber.y1), xb = Math.max(vyber.x0, vyber.x1), yb = Math.max(vyber.y0, vyber.y1);
      const [X, Y] = naObr(xa, ya);
      ctx.fillStyle = 'rgba(243,201,107,0.12)'; ctx.fillRect(X, Y, (xb - xa + 1) * s, (yb - ya + 1) * s);
      ctx.strokeStyle = 'rgba(243,201,107,0.95)'; ctx.lineWidth = 2 * dpr; ctx.strokeRect(X, Y, (xb - xa + 1) * s, (yb - ya + 1) * s);
      if (s * (xb - xa + 1) > 40) {
        ctx.font = `${12 * dpr}px sans-serif`; ctx.fillStyle = '#f3e6c4'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${xb - xa + 1} × ${yb - ya + 1}`, X + 3, Y - 2);
      }
    }
    for (const [pole, barva] of [[hover, 'rgba(255,240,200,0.55)'], [vybrane, 'rgba(243,201,107,0.95)']]) {
      if (!pole || pole.p !== kam.p) continue;
      const [x, y] = naObr(pole.x, pole.y);
      ctx.strokeStyle = barva; ctx.lineWidth = 2 * dpr; ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    }
    ctx.restore();
  }
  function kresliMinimapu() {
    mctx.putImageData(dataMinimapy(kam.p), 0, 0);
    mctx.fillStyle = '#ffe08a';
    for (const t of hra.trpaslici) {
      const g = t.g, p = (g / sv.N) | 0;
      if (p !== kam.p) continue;
      const l = g - p * sv.N; mctx.fillRect(l % sv.W - 0.5, ((l / sv.W) | 0) - 0.5, 2, 2);
    }
    const s = meritko(), r = obal.getBoundingClientRect();
    const w = r.width / s, h = r.height / s;
    mctx.strokeStyle = '#f3c96b'; mctx.lineWidth = 1;
    mctx.strokeRect(Math.round(kam.x - w / 2) + 0.5, Math.round(kam.y - h / 2) + 0.5, Math.round(w), Math.round(h));
  }
  function obnovStitek() {
    const pp = SV.PATRA[kam.p];
    const nz = hra.nouze || {};
    const t = $('stitek'), h = `<b>${pp.nazev}</b> · ${pp.hloubka}` + (pp.varovani ? ` · <span class="var">⚠️ ${pp.varovani}</span>` : '') +
      ` · ${Math.round(kam.zoom * 100)} %` + (nz.hlad ? ' · <span class="var">🚨 hlad</span>' : '') + (nz.strop ? ' · <span class="var">🚨 strop</span>' : '') + (nz.voda ? ' · <span class="var">💧 voda</span>' : '');
    if (t.innerHTML !== h) t.innerHTML = h;
  }
  function obnovCas() {
    const c = HR.cas(hra);
    const h = S.svetlo.hodina(hra);
    const OB = S.obdobi, mi = OB.milnikyInfo(hra);
    $('cas').textContent = `${OB.OBDOBI[OB.obdobi(hra)].ikona} ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(h % 1 * 60 / 10) * 10).padStart(2, '0')} · den ${c.den}, ${c.obdobi}, rok ${c.rok}`;
    const sl = $('slava'); sl.textContent = `⭐ ${hra.slava || 0}`;
    sl.title = `Sláva klanu ${hra.slava || 0}` + (mi.dalsi ? ` – další milník ${mi.dalsi.slava}` : ' – všechny milníky splněny');
    $('karavanaBtn').hidden = !hra.karavana;
    $('poplachBtn').classList.toggle('akt', !!hra.poplach);
    obnovHrozbu();
    obnovPribeh();
    hlidejUdalost();
  }
  // --- příběh: vodítko, artefakty, kusovník, Spáč, zažíhání -------------------------------------------
  let pribehHtml = '', konecUkazan = false;
  function obnovPribeh() {
    const PB = S.pribeh, v = PB.voditko(hra), k = PB.kusovnik(hra), sp = PB.spacNa(hra);
    let h = '';
    const cd = PB.coDal(hra);
    if (cd) h += `<div class="codal"><b>❓ Co dál? (${cd.krok}/${cd.z})</b> ${cd.text}</div>`;
    if (hra.vyhenHori) h += '🔥 <b>Výheň předků hoří.</b> ' + (hra.rezim === 'volny' ? 'Volný režim – hora žije dál.' : '');
    else if (hra.zazehnuti) h += `🔥 Zažíhání Výhně ${Math.round(hra.zazehnuti / PB.DOBA_ZAZEHNUTI * 100)} %<div class="ohen"><i style="width:${Math.min(100, hra.zazehnuti / PB.DOBA_ZAZEHNUTI * 100)}%"></i></div>`;
    else if (!PB.kampan(hra)) h += '♾️ Volný režim: bez příběhu.';
    if (v.text) h += `<button class="voditko" data-g="${v.g}" title="Ukázat na mapě">🧭 ${v.text}</button>`;
    if (PB.kampan(hra) || Object.keys(hra.artefakty).length) h += '<div class="art" title="Artefakty předků">' + Object.entries(PB.ARTEFAKTY).map(([a, x]) =>
      `<span class="${hra.artefakty[a] ? '' : 'ne'}" title="${x.nazev} – ${x.popis}${hra.artefakty[a] ? ' (hotovo)' : ''}">${x.ikona}</span>`).join('') + '</div>';
    if (k) h += '<div class="kus">Kusovník Klíče: ' + k.polozky.map(p => `<span title="${p.nazev}">${p.ikona}<b class="${p.ma >= p.potreba ? 'ok' : ''}">${p.ma}/${p.potreba}</b></span>`).join(' ') +
      (k.artefakty.length ? ` · ukovat: ${k.artefakty.map(a => PB.ARTEFAKTY[a].ikona).join(' ')}` : '') + '</div>';
    if (sp) h += `<div>🌋 Spáč bdí: ♥ ${Math.max(0, Math.round(sp.zdravi))}/${S.hrozby.DRUHY.spac.zdravi}, odolnost ${sp.odolnost || 1}× <button class="mini" data-skok="${sp.g}">ukázat</button></div>`;
    else if (hra.spac.porazen) h += '<div>🏆 Pradávný spáč je poražen.</div>';
    if (PB.lzeVyzvatSpace(hra)) h += '<button class="mini" data-vyzva="1">🌋 Vyzvat Spáče</button>';
    if (h !== pribehHtml) { pribehHtml = h; $('pribeh').innerHTML = h || '<small>Hora mlčí.</small>'; }
  }
  $('pribeh').addEventListener('click', async e => {
    const b = e.target.closest('[data-g],[data-skok],[data-vyzva]'); if (!b) return;
    if (b.dataset.vyzva) {
      if (await Dialog.potvrd('Vyzvat Pradávného spáče? Probudí se v Srdci hory (480 ♥, úder 22). Strážci na něj půjdou aspoň ve třech.')) { S.pribeh.vyzviSpace(hra); obnovPribeh(); obnovDenik(true); }
      return;
    }
    const g = +(b.dataset.g || b.dataset.skok); if (g >= 0) skokNa(g);
  });
  // konec hry: epilog a statistiky v okně (místo události)
  function ukazKonec() {
    const PB = S.pribeh, k = hra.konec, st = k.stat, el = $('udalost');
    if (rychlost) nastavRychlost(0);
    const radky = [['Dní', st.dni], ['Trpaslíků žije / nejvíc', `${st.zije} / ${st.nejvic}`], ['Padlo', st.padlo], ['Sláva', st.slava], ['Nejhlouběji', `${st.hloubka} m`],
      ['Vytesáno polí', st.vykopano], ['Odraženo nájezdů', st.najezdu], ['Zabito tvorů', st.zabito], ['Artefaktů', st.artefakty], ['Spáč', st.spac]];
    el.innerHTML = `<div class="okno konec"><canvas class="ilustrace" width="440" height="90"></canvas><h3>${k.vitezstvi ? '🔥 Výheň předků hoří!' : '🪦 Hora utichla'}</h3><p>${PB.epilog(hra)}</p>` +
      `<div class="stat">${radky.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div><div class="volby">` +
      (k.vitezstvi ? '<button data-konec="dal">♾️ Hrát dál ve volném režimu</button>' : '') +
      '<button data-konec="nova">⛰️ Nová hora</button><button data-konec="zavrit">Jen se podívat na horu</button></div></div>';
    S.ilustrace.kresli(el.querySelector('.ilustrace'), k.vitezstvi ? 'vitezstvi' : 'prohra', hra.seed);
    el.hidden = false;
  }
  function obnovInfo() {
    const el = $('info');
    if (vybranyTvor) {
      const u = hra.tvorove.find(x => x.id === vybranyTvor), HZ = S.hrozby;
      if (!u) { vybranyTvor = null; el.innerHTML = '<small>Tvor je pryč.</small>'; return; }
      const D = HZ.DRUHY[u.druh];
      el.innerHTML = `<b>${D.nazev[0].toUpperCase() + D.nazev.slice(1)}</b>${u.najezd ? ' – nájezdník' : ''}${u.zlodej ? ' (lupič)' : ''}` +
        `<div class="pruh"><span>♥</span><i><b style="width:${Math.max(0, u.zdravi) / D.zdravi * 100}%;background:#d85a5a"></b></i></div>` +
        `<small>útok ${D.utok}${D.dosah ? `, střílí do ${D.dosah} polí` : ''}${D.dvere ? ', vyráží dveře' : ''}${D.siroky ? ', do chodby široké 1 pole se nevejde' : ''}` +
        `${D.pohyb === 'let' ? ', létá přes díry a vodu' : D.pohyb === 'leze' ? ', přeleze díry' : ''}${u.nese ? ' · nese kořist!' : ''}</small>`;
      return;
    }
    if (vybranaBudova || vybranyPlan || vybranaZona) { el.innerHTML = htmlVyberu(); return; }
    if (vybranyTrp) {
      const t = hra.trpaslici.find(x => x.id === vybranyTrp);
      if (!t) { vybranyTrp = null; el.innerHTML = '<small>Trpaslík už není s námi.</small>'; return; }
      const p = (t.g / sv.N) | 0;
      const pruh = (ikona, nazev, v, barva) => `<div class="pruh" title="${nazev} ${Math.round(v)}"><span>${ikona}</span><i><b style="width:${Math.max(0, Math.min(100, v))}%;background:${barva}"></b></i></div>`;
      const roz = S.potreby.rozpis(hra, t).sort((a, b) => a[1] - b[1]);
      el.innerHTML = `<b>${t.jmeno}</b> – ${HR.PROFESE[t.prof].nazev} · ${naladaIkona(t.nalada)} ${t.nalada}<br>${HR.popisCinnosti(hra, t)}` +
        pruh('🍖', 'jídlo', t.jidlo, '#c98a4a') + pruh('🍺', 'pití', t.piti, '#d8b040') + pruh('💤', 'spánek', t.spanek, '#7a8ad8') + pruh('♥', 'zdraví', t.zdravi, '#d85a5a') +
        `<div class="rozpis">${roz.map(([tx, h]) => `<span class="${h < 0 ? 'zle' : 'dobre'}">${h > 0 ? '+' : ''}${h} ${tx}</span>`).join('')}</div>` +
        htmlPrace(t) + `<small>${SV.PATRA[p].nazev}</small>`;
      return;
    }
    const pole = vybrane || hover;
    if (!pole) { el.innerHTML = '<small>Najeď myší na mapu.</small>'; return; }
    const v = SV.popisPole(sv, pole.p, pole.x, pole.y);
    if (!v) { el.innerHTML = '<small>Mimo mapu.</small>'; return; }
    const g = pole.p * sv.N + pole.y * sv.W + pole.x;
    const z = hra.oznac[g] ? ` · ⚒️ ${PR.OZN_NAZEV[hra.oznac[g]]}${hra.prio[g] ? ' ⭐' : ''}${hra.zachrana[g] ? ' (záchrana)' : ''}` : '';
    const veci = hra.veci.filter(x => x.g === g).map(x => PR.VECI[x.druh].ikona);
    const sl = v.znamo ? ` · světlo ${Math.round(S.svetlo.svetloNa(hra, g) * 100)} %` : '';
    el.innerHTML = `${v.text}${z}${veci.length ? '<br>' + veci.join(' ') : ''}<br><small>${SV.PATRA[pole.p].nazev}, pole ${pole.x} × ${pole.y}${sl}</small>`;
  }
  // stupně prací: 0 vypnuto, 1 hlavní, 2 běžná, 3 když není co jiného
  const PRACE = [['kopat', '⛏️', 'tesání skály'], ['tesat', '🧱', 'otesávání'], ['kacet', '🪓', 'kácení'], ['stavet', '🔨', 'stavění'],
    ['nosit', '📦', 'nošení'], ['remeslo', '⚒️', 'řemeslo v dílnách'], ['pole', '🌾', 'farmy'], ['hlidat', '⚔️', 'hlídání (strážce: loví nepřátele, cvičí, nosí zbraň)']];
  const STUPEN = ['–', '1', '2', '3'];
  function htmlPrace(t) {
    const n = t.nastroj;
    let h = `<div class="radek">🧰 ${n ? `${PR.VECI[n.druh].ikona} ${n.mat === 'zelezo' ? 'železný' : 'měděný'} ${PR.VECI[n.druh].nazev} <small>${Math.round(n.stav)} %</small>` : '<small>bez nástroje</small>'}` +
      (t.zbran || t.zbroj ? ` · ${[t.zbran, t.zbroj].filter(Boolean).map(v => PR.VECI[v.druh].ikona + ' ' + PR.VECI[v.druh].nazev).join(', ')}` : '') + '</div>';
    h += '<div class="dov">' + Object.entries(HR.DOVEDNOSTI).map(([k, d]) => `<span title="${d.nazev}">${d.ikona}${(t.dov[k] || 0)}</span>`).join('') + '</div>';
    h += '<div class="stupne">' + PRACE.map(([k, ik, nz]) => `<button data-stupen="${k}" data-trp="${t.id}" title="${nz}: ${['vypnuto', 'hlavní', 'běžná', 'když není co jiného'][t.povoleno[k] || 0]} (klepni pro změnu)" class="s${t.povoleno[k] || 0}">${ik}<b>${STUPEN[t.povoleno[k] || 0]}</b></button>`).join('') + '</div>';
    const typy = [...new Set(hra.budovy.filter(b => ST.STAVBY[b.typ].dilna).map(b => b.typ))];
    h += `<label class="radek">🎯 <select data-dilna="${t.id}"><option value="">bez vyhrazeného pracoviště</option>` +
      typy.map(ty => `<option value="${ty}" ${t.dilna === ty ? 'selected' : ''}>${ST.STAVBY[ty].nazev}</option>`).join('') + '</select></label>';
    return h;
  }
  function prepniStupen(id, k) {
    const t = hra.trpaslici.find(x => x.id === id); if (!t) return;
    t.povoleno[k] = k === 'hlidat' ? (t.povoleno[k] ? 0 : 1) : ((t.povoleno[k] || 0) + 1) % 4;
    if (k === 'hlidat') { HR.pustPraci(hra, t); t.hledej = hra.tik; }
    if (t.prace && !t.prace.potreba && PR.SKUPINA[t.prace.druh] === k && !t.povoleno[k]) HR.pustPraci(hra, t);
    hra.zmenaPraci++;
  }
  const naladaIkona = n => n >= 70 ? '😄' : n >= 50 ? '🙂' : n >= 35 ? '😐' : '😠';
  // panel vybrané stavby / plánu / skladu
  function htmlVyberu() {
    if (vybranyPlan) {
      const pl = ST.planPodle(hra, vybranyPlan);
      if (!pl) { vybranyPlan = null; return '<small>Plán už není.</small>'; }
      const d = ST.STAVBY[pl.typ];
      const mat = Object.entries(d.mat).map(([k, n]) => `${PR.VECI[k].ikona} ${PR.VECI[k].nazev} ${pl.doneseno[k] || 0}/${n}`).join('<br>');
      return `<b>${d.ikona} ${d.nazev}</b> – plán<br>${mat}<br><small>${ST.kompletni(pl) ? 'Materiál je na místě, čeká na stavitele.' : 'Čeká na materiál.'}</small>` +
        `<div class="akce"><button data-akce="zrusPlan">✖️ Zrušit plán</button></div>`;
    }
    if (vybranaZona) {
      const z = ST.zonaPodle(hra, vybranaZona);
      if (!z) { vybranaZona = null; return '<small>Sklad už není.</small>'; }
      let pole = 0, veci = 0;
      for (let g = 0; g < hra.zona.length; g++) if (hra.zona[g] === z.id) pole++;
      for (const v of hra.veci) if (v.g >= 0 && hra.zona[v.g] === z.id) veci++;
      const sk = Object.entries(ST.SKUPINY_VECI).map(([k, x]) =>
        `<label class="filtr"><input type="checkbox" data-filtr="${k}" ${!z.filtr || z.filtr.includes(k) ? 'checked' : ''}> ${x.ikona} ${x.nazev}</label>`).join('');
      if (z.typ !== 'sklad') {
        const d = ST.ZONY[z.typ];
        let h = `<b>${d.ikona} ${d.nazev}</b> · ${pole} polí<br><small>${d.popis}</small>`;
        if (ST.FARMY[z.typ]) {
          let zrale = 0, roste = 0;
          for (let g = 0; g < hra.zona.length; g++) if (hra.zona[g] === z.id) { if (hra.uroda[g] > 100) zrale++; else if (hra.uroda[g]) roste++; }
          h += `<br>roste ${roste} · zralé ${zrale} · zásoba ${ST.pocty(hra)[ST.FARMY[z.typ]] || 0}/${ST.CIL_FARMY(hra.trpaslici.length)}`;
        } else {
          let prvni = -1; for (let g = 0; g < hra.zona.length; g++) if (hra.zona[g] === z.id) { prvni = g; break; }
          const m = S.mistnosti.mistnostNa(hra, prvni), k = S.mistnosti.kvalita(hra, m, z.typ);
          h += `<br>${m && m.uzavrena ? 'uzavřená místnost' : 'otevřený prostor'} · kvalita <b>${k.hodnota} – ${k.slovo}</b>` +
            `<div class="rozpis">${k.rozpis.map(([tx, v]) => `<span class="${v < 0 ? 'zle' : 'dobre'}">${v > 0 ? '+' : ''}${v} ${tx}</span>`).join('')}</div>`;
        }
        return h + `<div class="akce"><button data-akce="zrusZonu">✖️ Zrušit zónu</button></div>`;
      }
      return `<b>📦 Sklad</b> · ${pole} polí · ${veci}/${pole * ST.KAPACITA_POLE} věcí<br>${sk}` +
        `<div class="akce"><button data-akce="prioZony" class="${z.prio ? 'akt' : ''}">⭐ Přednost</button><button data-akce="zrusZonu">✖️ Zrušit sklad</button></div>`;
    }
    const b = ST.budovaPodle(hra, vybranaBudova);
    if (!b) { vybranaBudova = null; return '<small>Stavba už není.</small>'; }
    const d = ST.STAVBY[b.typ];
    let h = `<b>${d.ikona} ${d.nazev}</b><br><small>${d.popis || ''}</small>`;
    if (d.dilna) {
      const rc = ST.RECEPTY[b.typ] || [], c = ST.pocty(hra);
      b.mista.forEach((m, k) => {
        const akt = m.aktivni ? ST.nazevReceptu(rc[m.aktivni.r]) : '';
        const zas = Object.entries(m.zasoba).map(([x, n]) => PR.VECI[x].ikona + n).join(' ');
        const kdo = hra.trpaslici.find(t => t.prace && t.prace.druh === 'vyrobit' && t.prace.dilna === b.id && t.prace.misto === k);
        h += `<br>${k + 1}. pracoviště: ${akt ? '⚒️ ' + akt + (zas ? ' · ' + zas : '') + (kdo ? ` · ${kdo.jmeno}` : '') : '<small>volné</small>'}`;
      });
      const vyhr = hra.trpaslici.filter(t => t.dilna === b.typ).map(t => t.jmeno);
      if (vyhr.length) h += `<br><small>🎯 vyhrazeno: ${vyhr.join(', ')}</small>`;
      h += '<div class="recepty">' + rc.map((r, k) => {
        const mat = Object.entries(ST.materialReceptu(r)).map(([m, n]) => (n > 1 ? n : '') + PR.VECI[m].ikona).join('+');
        return `<div class="recept"><span title="${ST.nazevReceptu(r)}">${PR.VECI[r.vyrobek].ikona} ${ST.nazevReceptu(r)} <small>${mat} · máš ${c[r.vyrobek] || 0}</small></span>` +
          `<button data-akce="zak" data-r="${k}" data-n="1" title="Vyrobit 1">+1</button><button data-akce="zak" data-r="${k}" data-n="5" title="Vyrobit 5">+5</button>` +
          `<button data-akce="udrz" data-r="${k}" title="Udržovat zásobu 5 (opakovaným klepnutím +5)">∞</button></div>`;
      }).join('') + '</div>';
      if (b.fronta.length) h += '<b>Zakázky</b>' + b.fronta.map(z => `<div class="zakazka">${z.trvala ? `udržuj ${z.cil}` : `${z.zbyva}×`} ${ST.nazevReceptu(rc[z.r])}` +
        `<button data-akce="nahoru" data-id="${z.id}" title="Dřív">↑</button><button data-akce="zrusZak" data-id="${z.id}" title="Zrušit">✖</button></div>`).join('');
    }
    if (d.sklad) h += `<br>${hra.veci.filter(v => v.g === b.g).length}/${d.sklad} věcí`;
    if (b.poskozeni) h += `<br><span class="zle">poškozeno ${Math.round(b.poskozeni / 8 * 100)} %</span>`;
    if (b.typ === 'past') h += `<br>${b.napnout > hra.tik ? 'napíná se…' : 'napnutá'}`;
    const mriz = b.typ === 'mriz' ? `<button data-akce="mriz" class="${b.zavreno ? 'akt' : ''}">${b.zavreno ? '⬆️ Vytáhnout mříž' : '⬇️ Spustit mříž'}</button>` : '';
    return h + `<div class="akce">${mriz}<button data-akce="zbourat">🔨 Zbourat</button></div>`;
  }
  $('info').addEventListener('click', e => {
    const st = e.target.closest('[data-stupen]');
    if (st) { prepniStupen(+st.dataset.trp, st.dataset.stupen); obnovInfo(); return; }
    const t = e.target.closest('[data-akce]'); if (!t) return;
    const a = t.dataset.akce, b = ST.budovaPodle(hra, vybranaBudova);
    if (a === 'zak' && b) ST.pridejZakazku(hra, b, +t.dataset.r, +t.dataset.n, false);
    else if (a === 'udrz' && b) ST.pridejZakazku(hra, b, +t.dataset.r, 5, true);
    else if (a === 'zrusZak' && b) ST.zrusZakazku(hra, b, +t.dataset.id);
    else if (a === 'nahoru' && b) ST.posunZakazku(hra, b, +t.dataset.id, -1);
    else if (a === 'zbourat' && b) { ST.zbourej(hra, b); vybranaBudova = null; }
    else if (a === 'mriz' && b) ST.prepniMriz(hra, b);
    else if (a === 'zrusPlan') { const pl = ST.planPodle(hra, vybranyPlan); if (pl) ST.zrusPlan(hra, pl); vybranyPlan = null; }
    else if (a === 'prioZony') { const z = ST.zonaPodle(hra, vybranaZona); if (z) { z.prio = !z.prio; hra.zmenaPraci++; } }
    else if (a === 'zrusZonu') {
      ST.zrusZonuId(hra, vybranaZona); vybranaZona = null;
    }
    vyzvedniZmeny(); obnovInfo();
  });
  $('info').addEventListener('change', e => {
    const sd = e.target.closest('[data-dilna]');
    if (sd) { const t = hra.trpaslici.find(x => x.id === +sd.dataset.dilna); if (t) HR.nastavDilnu(hra, t, sd.value || null); obnovInfo(); return; }
    const t = e.target.closest('[data-filtr]'); if (!t) return;
    const z = ST.zonaPodle(hra, vybranaZona); if (!z) return;
    const vybrane_ = [...document.querySelectorAll('#info [data-filtr]')].filter(x => x.checked).map(x => x.dataset.filtr);
    ST.nastavFiltr(hra, z, vybrane_);
  });
  // přehled zásob (věci na zemi a ve skladech podle druhu)
  let zasobyHtml = '';
  function obnovZasoby(hned) {
    const c = ST.pocty(hra);
    const h = Object.keys(PR.VECI).filter(d => c[d]).map(d => `<span title="${PR.VECI[d].nazev}">${PR.VECI[d].ikona} ${c[d]}</span>`).join('') || '<small>nic</small>';
    if (h !== zasobyHtml || hned) { zasobyHtml = h; $('zasoby').innerHTML = h; }
  }

  // --- události s volbou: hra se pozastaví, po volbě se vrátí rychlost ---------------------
  let udalostId = null, rychlostPred = 0;
  function hlidejUdalost() {
    if (hra.konec && !konecUkazan) { konecUkazan = true; ukazKonec(); return; }
    if (hra.konec) return;
    const u = hra.udalost, el = $('udalost');
    if (!u) { if (!el.hidden) el.hidden = true; udalostId = null; return; }
    const klic = u.id + ':' + u.tik;
    if (udalostId === klic) return;
    udalostId = klic;
    if (rychlost) { rychlostPred = rychlost; nastavRychlost(0); } else rychlostPred = 0;
    const lide = u.id === 'migranti' && u.param.lide.length > 1 ? '<div class="lide">' + u.param.lide.map((l, k) =>
      `<label><input type="checkbox" data-clovek="${k}" checked> ${S.obdobi.popisPrichoziho(l)}</label>`).join('') + '</div>' : '';
    el.innerHTML = `<div class="okno"><canvas class="ilustrace" width="440" height="130"></canvas><h3>📜 ${{ migranti: 'Příchozí', hoste: 'Hosté', poutnik: 'Poutník', poutnik_navrat: 'Návrat poutníka', nemoc: 'Nemoc', spor: 'Spor', dutina: 'Krystalová dutina', slavnost: 'Slavnost', dar: 'Dar', zbloudily: 'Zbloudilý' }[u.id] || 'Událost'}</h3>` +
      `<p>${u.text}</p>${lide}<div class="volby">${u.volby.map((v, i) => `<button data-volba="${i}">${v}</button>`).join('')}</div></div>`;
    S.ilustrace.kresli(el.querySelector('.ilustrace'), S.ilustrace.KUDALOSTI[u.id] || 'hora', hra.seed + u.tik);
    el.hidden = false;
  }
  $('udalost').addEventListener('click', e => {
    const kb = e.target.closest('[data-konec]');
    if (kb) {
      $('udalost').hidden = true;
      if (kb.dataset.konec === 'dal') { S.pribeh.hratDal(hra); $('rezim').value = hra.rezim; konecUkazan = false; obnovDenik(true); ulozHru(); }
      else if (kb.dataset.konec === 'nova') $('nova').click();
      return;
    }
    const b = e.target.closest('[data-volba]'); if (!b || !hra.udalost) return;
    const vyber = [...document.querySelectorAll('#udalost [data-clovek]')].filter(x => x.checked).map(x => +x.dataset.clovek);
    const text = S.udalosti.vyres(hra, +b.dataset.volba, vyber.length || document.querySelector('#udalost [data-clovek]') ? vyber : undefined);
    $('udalost').hidden = true; udalostId = null;
    if (text) hlaska(text);
    vyzvedniZmeny(); obnovDenik(true); obnovKlan(true);
    if (rychlostPred) nastavRychlost(rychlostPred);
  });
  // --- obchod s karavanou ---------------------------------------------------------
  let obchodNakup = {}, obchodProdej = {};
  function obnovObchod() {
    const el = $('obchod'); if (el.hidden) return;
    const k = hra.karavana, OB = S.obdobi;
    if (!k) { el.hidden = true; return; }
    const sklad = OB.naProdej(hra);
    let dam = 0, chci = 0;
    for (const [d, n] of Object.entries(obchodProdej)) if (n > 0 && sklad[d]) { const vv = sklad[d].slice().sort((a, b) => OB.cenaProdej(hra, b) - OB.cenaProdej(hra, a)); dam += OB.prodejDruhu(hra, d, vv, Math.min(n, vv.length)); }
    for (const [d, n] of Object.entries(obchodNakup)) if (n > 0) chci += OB.cenaNakup(d) * n;
    const radek = (d, max, cena, kam, n) => `<tr><td>${PR.VECI[d].ikona} ${PR.VECI[d].nazev}</td><td>${max}</td><td>${cena}</td>` +
      `<td><button data-o="${kam}" data-d="${d}" data-k="-1">−</button><b>${n || 0}</b><button data-o="${kam}" data-d="${d}" data-k="1">+</button></td></tr>`;
    el.innerHTML = `<div class="hlav"><b>🐫 Karavana</b><small> do odjezdu ${Math.max(0, Math.ceil((k.do - hra.tik) / HR.TAHU_ZA_DEN * 24))} h · stánků ${OB.stanku(hra)}/${OB.MAX_STANKU}</small><button data-zavrit="1">✖</button></div>` +
      '<div class="sloupce"><div><h4>Nabízí</h4><table><tr><th></th><th>má</th><th>cena</th><th>koupit</th></tr>' +
      Object.entries(k.nabidka).map(([d, n]) => radek(d, n, OB.cenaNakup(d), 'n', obchodNakup[d])).join('') + '</table></div>' +
      '<div><h4>Ze skladu</h4><table><tr><th></th><th>máš</th><th>za kus</th><th>prodat</th></tr>' +
      Object.entries(sklad).sort((a, b) => OB.cenaProdej(hra, b[1][0]) - OB.cenaProdej(hra, a[1][0])).map(([d, vv]) => radek(d, vv.length, OB.cenaProdej(hra, vv[0]), 'p', obchodProdej[d])).join('') + '</table></div></div>' +
      `<div class="bilance">dáváš <b>${dam}</b> · chceš <b>${chci}</b> <button id="obchodovat" ${dam >= chci && (dam || chci) ? '' : 'disabled'}>Obchodovat</button></div>`;
  }
  $('obchod').addEventListener('click', e => {
    if (e.target.closest('[data-zavrit]')) { $('obchod').hidden = true; return; }
    if (e.target.id === 'obchodovat') {
      const r = S.obdobi.obchod(hra, obchodNakup, obchodProdej);
      hlaska(r.zprava); if (r.ok) { obchodNakup = {}; obchodProdej = {}; vyzvedniZmeny(); obnovZasoby(true); }
      obnovObchod(); return;
    }
    const b = e.target.closest('[data-o]'); if (!b) return;
    const cil = b.dataset.o === 'n' ? obchodNakup : obchodProdej, d = b.dataset.d;
    const max = b.dataset.o === 'n' ? (hra.karavana.nabidka[d] || 0) : ((S.obdobi.naProdej(hra)[d] || []).length);
    cil[d] = Math.max(0, Math.min(max, (cil[d] || 0) + (+b.dataset.k) * (e.shiftKey ? 5 : 1)));
    obnovObchod();
  });
  $('poplachBtn').addEventListener('click', () => {
    hra.poplach = !hra.poplach; hra.zmenaPraci++;
    for (const t of hra.trpaslici) if (!t.povoleno.hlidat) { if (hra.poplach) HR.pustPraci(hra, t); t.hledej = hra.tik; }
    PR.zprava(hra, hra.poplach ? 'varovani' : 'info', hra.poplach ? '🔔 Poplach! Civilisté se schovávají, strážci do zbraně.' : '🔕 Poplach odvolán.');
    obnovCas(); obnovDenik(true);
  });
  // nepřátelé a předpověď nájezdu (panel Klan)
  let hrozbaHtml = '';
  function obnovHrozbu() {
    const HZ = S.hrozby, P = HZ.predpovedNajezdu(hra);
    const znami = hra.tvorove.filter(u => sv.zn[u.g]);
    const pocty = {}; for (const u of znami) pocty[u.druh] = (pocty[u.druh] || 0) + 1;
    const strazci = hra.trpaslici.filter(t => t.povoleno.hlidat).length, ozbr = hra.trpaslici.filter(t => t.povoleno.hlidat && t.zbran).length;
    let h = znami.length ? '⚔️ ' + Object.entries(pocty).map(([d, n]) => `<button class="mini" data-tvor="${d}">${n}× ${HZ.DRUHY[d].nazev}</button>`).join(' ') + '<br>' : '';
    h += hra.oblehani ? `🏹 Obléhání rokle ještě ${((hra.oblehani.do - hra.tik) / HR.TAHU_ZA_DEN).toFixed(1)} dne` :
      P.ohlaseno ? `👁️ Zítra ${P.typNazev}: ~${P.sila} goblinů${P.trollu ? ` (${P.trollu}× troll)` : ''}, ${P.odkud}` : `🛡️ Další nájezd asi za ${Math.ceil(P.zaDni)} dní`;
    h += `<br><small>strážci ${strazci} (ozbrojení ${ozbr})${hra.zabito ? ` · zabito ${hra.zabito}` : ''}</small>`;
    if (h !== hrozbaHtml) { hrozbaHtml = h; const el = $('hrozba'); el.innerHTML = h; el.classList.toggle('klid', !znami.length && !P.ohlaseno && !hra.oblehani); }
  }
  $('hrozba').addEventListener('click', e => {
    const b = e.target.closest('[data-tvor]'); if (!b) return;
    const u = hra.tvorove.find(u => u.druh === b.dataset.tvor && sv.zn[u.g]); if (u) skokNa(u.g);
  });
  $('karavanaBtn').addEventListener('click', () => { const el = $('obchod'); el.hidden = !el.hidden; obchodNakup = {}; obchodProdej = {}; obnovObchod(); });

  // panel klanu (seznam trpaslíků) a deník – obnovují se jen při změně textu
  let klanHtml = '', denikDelka = -1;
  function obnovKlan(hned) {
    const h = hra.trpaslici.map(t => {
      const p = (t.g / sv.N) | 0, c = HR.popisCinnosti(hra, t);
      return `<button class="trp${vybranyTrp === t.id ? ' akt' : ''}${t.uvizl ? ' uvizl' : ''}" data-id="${t.id}">` +
        `<i style="background:${HR.PROFESE[t.prof].barva}"></i><b>${t.jmeno}</b><em title="nálada ${t.nalada}">${naladaIkona(t.nalada)}</em><span>${c} · ${p ? p + '. p.' : 'povrch'}${t.zdravi < 100 ? ' · ♥' + Math.round(t.zdravi) : ''}</span></button>`;
    }).join('') || '<small>Klan je pryč.</small>';
    if (h !== klanHtml || hned) { klanHtml = h; $('klan').innerHTML = h; }
  }
  function obnovDenik(hned) {
    if (hra.denik.length === denikDelka && !hned) return;
    denikDelka = hra.denik.length;
    $('denik').innerHTML = hra.denik.slice(-8).reverse().map((z, k) =>
      `<button class="zaznam ${z.typ}" data-k="${hra.denik.length - 1 - k}">${z.text}</button>`).join('');
  }
  // tabulka prací celého klanu
  function obnovTabulkuPraci() {
    const el = $('tabPrace'); if (el.hidden) return;
    el.innerHTML = '<div class="hlav"><b>⚒️ Práce klanu</b><small> 1 hlavní · 2 běžná · 3 když není co jiného · – vypnuto</small><button data-zavrit="1">✖</button></div>' +
      '<table><tr><th></th>' + PRACE.map(([, ik, nz]) => `<th title="${nz}">${ik}</th>`).join('') + '<th>🎯</th></tr>' +
      hra.trpaslici.map(t => `<tr><td><i style="background:${HR.PROFESE[t.prof].barva}"></i>${t.jmeno}</td>` +
        PRACE.map(([k]) => `<td><button data-stupen="${k}" data-trp="${t.id}" class="s${t.povoleno[k] || 0}">${STUPEN[t.povoleno[k] || 0]}</button></td>`).join('') +
        `<td><small>${t.dilna ? ST.STAVBY[t.dilna].ikona : ''}</small></td></tr>`).join('') + '</table>';
  }
  $('tabPrace').addEventListener('click', e => {
    const st = e.target.closest('[data-stupen]');
    if (st) { prepniStupen(+st.dataset.trp, st.dataset.stupen); obnovTabulkuPraci(); obnovInfo(); return; }
    if (e.target.closest('[data-zavrit]')) $('tabPrace').hidden = true;
  });
  $('otevritPrace').addEventListener('click', () => { const el = $('tabPrace'); el.hidden = !el.hidden; obnovTabulkuPraci(); });
  $('klan').addEventListener('click', e => {
    const b = e.target.closest('.trp'); if (!b) return;
    const t = hra.trpaslici.find(x => x.id === +b.dataset.id); if (!t) return;
    vybranyTrp = t.id; vybrane = null; vybranaBudova = vybranyPlan = vybranaZona = null; skokNa(t.g); obnovInfo(); obnovKlan(true);
  });
  $('denik').addEventListener('click', e => {
    const b = e.target.closest('.zaznam'); if (!b) return;
    const z = hra.denik[+b.dataset.k]; if (z && z.g >= 0) skokNa(z.g);
  });

  // --- nástroje -----------------------------------------------------------------------
  const NASTROJE = {
    kopat: { ikona: '⛏️', nazev: 'Kopat', klavesa: 'k', ozn: OZN.KOPAT },
    schody: { ikona: '⛰️', nazev: 'Schody dolů', klavesa: 'l', ozn: OZN.SCHODY },
    dira: { ikona: '🕳️', nazev: 'Díra', klavesa: 'h', ozn: OZN.DIRA },
    otesat: { ikona: '🧱', nazev: 'Otesat', klavesa: 'o', ozn: OZN.OTESAT },
    kacet: { ikona: '🪓', nazev: 'Kácet', klavesa: 'c', ozn: OZN.KACET },
    prednost: { ikona: '⭐', nazev: 'Přednost', klavesa: 'p' },
    zrusit: { ikona: '✖️', nazev: 'Zrušit', klavesa: 'x' },
    stavet: { ikona: '🏗️', nazev: 'Stavět', klavesa: 'b' },
    zona: { ikona: '📦', nazev: 'Sklad', klavesa: 'z' },
  };
  function postavNastroje() {
    const el = $('nastroje');
    el.innerHTML = Object.entries(NASTROJE).map(([k, n]) =>
      `<button data-n="${k}" title="${n.nazev} (${n.klavesa.toUpperCase()})">${n.ikona}<span>${n.nazev}</span></button>`).join('');
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) zvolNastroj(nastroj === b.dataset.n ? '' : b.dataset.n); });
    $('paleta').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sk !== undefined) { paletaSkupina = +b.dataset.sk; postavPaletu(); }
      else if (b.dataset.typ) { stavba = b.dataset.typ; postavPaletu(); }
      else if (b.dataset.otoc) { smer = (smer + 1) % 4; postavPaletu(); }
      else if (b.dataset.zona) { zonaTyp = b.dataset.zona; postavPaletuZon(); }
    });
  }
  let paletaSkupina = 3;
  function postavPaletu() {
    const c = ST.pocty(hra), sk = ST.SKUPINY_STAVEB;
    if (!sk[paletaSkupina].typy.includes(stavba)) stavba = sk[paletaSkupina].typy[0];
    const d = ST.STAVBY[stavba];
    $('paleta').innerHTML = '<div class="skupiny">' + sk.map((g, k) => `<button data-sk="${k}" class="${k === paletaSkupina ? 'akt' : ''}">${g.ikona} ${g.nazev}</button>`).join('') + '</div>' +
      '<div class="typy">' + sk[paletaSkupina].typy.map(t => {
        const x = ST.STAVBY[t], mat = Object.entries(x.mat).map(([m, n]) => `${n}${PR.VECI[m].ikona}`).join(' ');
        const ma = Object.entries(x.mat).every(([m, n]) => (c[m] || 0) >= n);
        return `<button data-typ="${t}" class="${t === stavba ? 'akt' : ''}${ma ? '' : ' chybi'}" title="${x.popis || ''}">${x.ikona} ${x.nazev} <small>${mat}</small></button>`;
      }).join('') + `<button data-otoc="1" title="Otočit (R)">⟳ ${['jih', 'západ', 'sever', 'východ'][smer]}</button></div>` +
      `<div class="popis"><small>${d.popis || ''}${(d.rozmer ? '' : ' Tažením položíš víc kusů.')}</small></div>`;
  }
  function zvolNastroj(n) {
    nastroj = n;
    document.querySelectorAll('#nastroje button').forEach(b => b.classList.toggle('akt', b.dataset.n === n));
    cv.classList.toggle('nastroj', !!n);
    $('paleta').hidden = n !== 'stavet' && n !== 'zona';
    if (n === 'stavet') postavPaletu();
    if (n === 'zona') postavPaletuZon();
  }
  function postavPaletuZon() {
    $('paleta').innerHTML = '<div class="typy">' + Object.entries(ST.ZONY).map(([k, z]) =>
      `<button data-zona="${k}" class="${k === zonaTyp ? 'akt' : ''}" title="${z.popis}">${z.ikona} ${z.nazev}</button>`).join('') + '</div>' +
      `<div class="popis"><small>${ST.ZONY[zonaTyp].popis} Tažením obdélník, klepnutím do uzavřené místnosti ji celou vyplníš.</small></div>`;
  }
  // použije nástroj na obdélník polí; vrátí počet změněných
  async function pouzij(p, xa, ya, xb, yb) {
    const n = NASTROJE[nastroj]; if (!n) return 0;
    if ((nastroj === 'kopat' || nastroj === 'schody' || nastroj === 'dira') && S.pribeh.budiSpace(hra, nastroj === 'kopat' ? p : p + 1)) {
      const ok = await Dialog.potvrd('🌋 Tohle je pásmo Spáče (8. patro) a klan ještě nemá Klíč k Srdci. Tesání tady Pradávného spáče probudí předčasně a hora bude neklidná (častější nájezdy). Opravdu tesat?');
      if (!ok) return 0;
    } else if (nastroj === 'schody' && p === SV.PATER - 2) {
      const ok = await Dialog.potvrd('Schodiště z 7. do 8. patra vede do pásma Spáče. Tesání tam bez Klíče může Pradávného spáče probudit. Pokračovat?');
      if (!ok) return 0;
    }
    let pocet = 0, duvod = '';
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      if (x < 0 || y < 0 || x >= sv.W || y >= sv.H) continue;
      const g = p * sv.N + y * sv.W + x;
      if (n.ozn) {
        if (PR.oznac(hra, g, n.ozn)) pocet++;
        else if (!duvod && hra.oznac[g] !== n.ozn) duvod = PR.lzeOznacit(hra, g, n.ozn);
      } else if (nastroj === 'prednost') {
        if (PR.prednost(hra, g, !hra.prio[g])) pocet++;
        const pl = hra.planNa.has(g) && ST.planPodle(hra, hra.planNa.get(g)); if (pl && pl.g === g) { pl.prio = !pl.prio; hra.zmenaPraci++; pocet++; }
      } else if (nastroj === 'zrusit') {
        if (hra.oznac[g]) { PR.zrusOznaceni(hra, g); pocet++; }
        const pl = hra.planNa.has(g) && ST.planPodle(hra, hra.planNa.get(g)); if (pl) { ST.zrusPlan(hra, pl); pocet++; }
      } else if (nastroj === 'stavet') {
        // vícepolní stavby jen jednou (levé horní pole výběru), jednopolní na každé pole obdélníku
        if (ST.STAVBY[stavba].rozmer && (x !== xa || y !== ya)) continue;
        const e = ST.naplanuj(hra, stavba, g, smer);
        if (!e) pocet++; else if (!duvod) duvod = e;
      } else if (nastroj === 'zona') {
        if (x !== xa || y !== ya) continue;
        let z = null;
        const m = xa === xb && ya === yb ? S.mistnosti.mistnostNa(hra, g) : null;
        if (m && m.uzavrena) {                          // klepnutí do uzavřené místnosti: celá místnost
          const mm = S.mistnosti.mistnosti(hra), bunky = [];
          for (let h = p * sv.N; h < (p + 1) * sv.N; h++) if (mm.id[h] === m.id) bunky.push(h);
          z = ST.zonaNaPolich(hra, bunky, zonaTyp);
        } else z = ST.novaZona(hra, p, xa, ya, xb, yb, zonaTyp);
        if (z) { pocet++; vybranaZona = z.id; obnovInfo(); }
        else duvod = { pole: 'pole ječmene patří na louku v rokli', houbarna: 'houbárna patří pod zem na surovou podlahu' }[zonaTyp] || 'zóna jde jen na volnou suchou podlahu';
      }
    }
    if (nastroj === 'zrusit') pocet += ST.zrusZonu(hra, p, xa, ya, xb, yb);
    if (nastroj === 'stavet') postavPaletu();
    if (!pocet && duvod) hlaska(duvod);
    vyzvedniZmeny();
    return pocet;
  }
  let hlaskaCas = 0;
  function hlaska(text) {
    const el = $('hlaska'); el.textContent = text; el.hidden = false;
    clearTimeout(hlaskaCas); hlaskaCas = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // --- ovládání: myš a dotyk ----------------------------------------------------------
  const ukaz = new Map();
  let tah = null, stipnuti = null;
  const bod = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const poleZ = b => { const q = naPole(b.x, b.y); return { p: kam.p, x: Math.floor(q.x), y: Math.floor(q.y) }; };
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
    const b = bod(e);
    ukaz.set(e.pointerId, b);
    if (ukaz.size === 2) {
      const [a, c] = [...ukaz.values()];
      stipnuti = { d: Math.hypot(a.x - c.x, a.y - c.y), zoom: kam.zoom, sx: (a.x + c.x) / 2, sy: (a.y + c.y) / 2, kx: kam.x, ky: kam.y };
      tah = null; vyber = null;
      return;
    }
    const kreslit = nastroj && e.button === 0;
    tah = { x: b.x, y: b.y, kx: kam.x, ky: kam.y, posun: 0, kreslit };
    if (kreslit) { const q = poleZ(b); vyber = { p: q.p, x0: q.x, y0: q.y, x1: q.x, y1: q.y }; }
  });
  cv.addEventListener('pointermove', e => {
    const b = bod(e);
    if (ukaz.has(e.pointerId)) ukaz.set(e.pointerId, b);
    if (stipnuti && ukaz.size === 2) {
      const [a, c] = [...ukaz.values()];
      const s0 = 64 * stipnuti.zoom;
      kam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, stipnuti.zoom * Math.hypot(a.x - c.x, a.y - c.y) / (stipnuti.d || 1)));
      const sx = (a.x + c.x) / 2, sy = (a.y + c.y) / 2, r = obal.getBoundingClientRect(), s1 = meritko();
      const wx = stipnuti.kx + (stipnuti.sx - r.width / 2) / s0, wy = stipnuti.ky + (stipnuti.sy - r.height / 2) / s0;
      vystred(wx - (sx - r.width / 2) / s1, wy - (sy - r.height / 2) / s1);
      return;
    }
    if (tah) {
      tah.posun = Math.max(tah.posun, Math.hypot(b.x - tah.x, b.y - tah.y));
      if (tah.kreslit) { const q = poleZ(b); vyber.x1 = q.x; vyber.y1 = q.y; }
      else if (tah.posun > 4) { const s = meritko(); cv.classList.add('tahne'); vystred(tah.kx - (b.x - tah.x) / s, tah.ky - (b.y - tah.y) / s); }
    }
    const nove = poleZ(b);
    if (!hover || hover.x !== nove.x || hover.y !== nove.y || hover.p !== nove.p) { hover = nove; if (!vybrane && !vybranyTrp) obnovInfo(); }
  });
  const konec = e => {
    ukaz.delete(e.pointerId);
    if (ukaz.size < 2) stipnuti = null;
    if (tah && e.type === 'pointerup') {
      if (tah.kreslit && vyber) {
        const v = vyber;
        pouzij(v.p, Math.min(v.x0, v.x1), Math.min(v.y0, v.y1), Math.max(v.x0, v.x1), Math.max(v.y0, v.y1));
      } else if (tah.posun <= 4) klikNa(bod(e));
    }
    vyber = null; tah = null; cv.classList.remove('tahne');
  };
  function klikNa(b) {
    // trpaslík pod kurzorem má přednost před polem
    const q = naPole(b.x, b.y);
    let nej = null, nd = 0.6;
    for (const t of hra.trpaslici) {
      const o = PO.poloha(hra, t); if (o.p !== kam.p) continue;
      const d = Math.hypot(o.x - q.x, o.y - q.y); if (d < nd) { nd = d; nej = t; }
    }
    let tvor = null;
    for (const u of hra.tvorove) {
      if (!sv.zn[u.g]) continue;
      const o = PO.poloha(hra, u); if (o.p !== kam.p) continue;
      const d = Math.hypot(o.x - q.x, o.y - q.y); if (d < nd) { nd = d; tvor = u; nej = null; }
    }
    vybranaBudova = vybranyPlan = vybranaZona = null;
    vybranyTvor = tvor && vybranyTvor !== tvor.id ? tvor.id : null;
    if (tvor) { vybranyTrp = null; vybrane = null; }
    else if (nej) { vybranyTrp = vybranyTrp === nej.id ? null : nej.id; vybrane = null; }
    else {
      vybranyTrp = null;
      const nove = poleZ(b), g = nove.p * sv.N + nove.y * sv.W + nove.x;
      const vMape = nove.x >= 0 && nove.y >= 0 && nove.x < sv.W && nove.y < sv.H;
      if (vMape && hra.budovaNa[g]) { vybranaBudova = hra.budovaNa[g]; vybrane = null; }
      else if (vMape && hra.planNa.has(g)) { vybranyPlan = hra.planNa.get(g); vybrane = null; }
      else if (vMape && hra.zona[g] && !hra.oznac[g]) { vybranaZona = hra.zona[g]; vybrane = nove; }
      else vybrane = vybrane && vybrane.x === nove.x && vybrane.y === nove.y && vybrane.p === nove.p ? null : nove;
    }
    obnovInfo(); obnovKlan(true);
  }
  cv.addEventListener('pointerup', konec);
  cv.addEventListener('pointercancel', konec);
  cv.addEventListener('pointerleave', () => { if (!tah) { hover = null; if (!vybrane && !vybranyTrp) obnovInfo(); } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const b = bod(e);
    zoomuj(kam.zoom * Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 33 : 1)), b.x, b.y);
  }, { passive: false });

  let miniTah = false;
  const naMinimapu = e => { const r = mini.getBoundingClientRect(); vystred((e.clientX - r.left) / r.width * sv.W, (e.clientY - r.top) / r.height * sv.H); };
  mini.addEventListener('pointerdown', e => { miniTah = true; try { mini.setPointerCapture(e.pointerId); } catch (er) { /* */ } naMinimapu(e); });
  mini.addEventListener('pointermove', e => { if (miniTah) naMinimapu(e); });
  mini.addEventListener('pointerup', () => { miniTah = false; });

  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,select,textarea,dialog')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const krok = 3 / kam.zoom, k = e.key, kl = k.toLowerCase();
    const nst = Object.entries(NASTROJE).find(([, n]) => n.klavesa === kl);
    if (k === 'ArrowLeft' || kl === 'a') vystred(kam.x - krok, kam.y);
    else if (k === 'ArrowRight' || kl === 'd') vystred(kam.x + krok, kam.y);
    else if (k === 'ArrowUp' || kl === 'w') vystred(kam.x, kam.y - krok);
    else if (k === 'ArrowDown' || kl === 's') vystred(kam.x, kam.y + krok);
    else if (k === '+' || k === '=') zoomuj(kam.zoom * 1.25);
    else if (k === '-' || k === '_') zoomuj(kam.zoom / 1.25);
    else if (k === 'PageUp' || k === '<' || k === ',') prepniPatro(kam.p - 1);
    else if (k === 'PageDown' || k === '>' || k === '.') prepniPatro(kam.p + 1);
    else if (k === 'Home') { prepniPatro(0); vystred(sv.brana.x + 1, sv.brana.y + 1); }
    else if (k === ' ') nastavRychlost(rychlost ? 0 : 1);
    else if (k === '1' || k === '2' || k === '3') nastavRychlost(k === '3' ? 4 : +k);
    else if (k === 'Escape') { zvolNastroj(''); vyber = null; vybranyTrp = null; vybrane = null; vybranaBudova = vybranyPlan = vybranaZona = null; obnovInfo(); }
    else if (kl === 'r') { smer = (smer + 1) % 4; if (nastroj === 'stavet') postavPaletu(); }
    else if (nst) zvolNastroj(nastroj === nst[0] ? '' : nst[0]);
    else return;
    e.preventDefault();
  });

  // lišta
  $('nova').addEventListener('click', async () => {
    if (hra && hra.tik > 600 && !(await Dialog.potvrd('Začít novou horu? Rozehraná hra se přepíše (ulož si ji případně do souboru).'))) return;
    const t = $('seed').value.trim();
    const seed = t && +t !== nast.seed ? S.nahoda.seedZTextu(t) : (Math.random() * 4294967296) >>> 0;
    novaHora(seed, $('velikost').value);
  });
  // nápověda: okno s pravidly (při první hře se otevře samo)
  $('napovedaBtn').addEventListener('click', () => { $('napoveda').hidden = false; });
  $('napoveda').addEventListener('click', e => { if (e.target.closest('[data-zavrit]') || e.target === $('napoveda')) { $('napoveda').hidden = true; if (!nast.napoveda) { nast.napoveda = 1; uloz(nast); } } });
  if (!nast.napoveda && !par.has('seed')) $('napoveda').hidden = false;
  const zvukTlacitka = () => { $('zvukBtn').textContent = Z.nast.zvuk ? '🔊' : '🔇'; $('hudbaBtn').classList.toggle('vyp', !Z.nast.hudba); };
  $('zvukBtn').addEventListener('click', () => { Z.probud(); Z.nastav('zvuk', !Z.nast.zvuk); zvukTlacitka(); });
  $('hudbaBtn').addEventListener('click', () => { Z.probud(); Z.nastav('hudba', !Z.nast.hudba); zvukTlacitka(); });
  zvukTlacitka();
  for (const ud of ['pointerdown', 'keydown']) window.addEventListener(ud, () => Z.probud(), { passive: true });
  $('rezim').addEventListener('change', async () => {
    if (hra && hra.tik > 600 && !(await Dialog.potvrd('Změna režimu začne novou horu. Rozehraná hra se přepíše. Pokračovat?'))) { $('rezim').value = hra.rezim; return; }
    nast.rezim = $('rezim').value; novaHora(nast.seed, nast.vel);
  });
  $('dne').addEventListener('click', () => novaHora(S.nahoda.seedDne(), $('velikost').value));
  $('velikost').addEventListener('change', () => novaHora(nast.seed, $('velikost').value));
  $('seed').addEventListener('keydown', e => { if (e.key === 'Enter') novaHora(S.nahoda.seedZTextu($('seed').value), $('velikost').value); });
  $('odkryt').addEventListener('change', () => { nast.odkryt = $('odkryt').checked; novaHora(nast.seed, nast.vel); });
  document.querySelectorAll('.rychlost button[data-r]').forEach(b => b.addEventListener('click', () => nastavRychlost(+b.dataset.r)));
  $('ulozit').addEventListener('click', () => { if (ulozHru()) hlaska('Uloženo do prohlížeče.'); });
  $('export').addEventListener('click', exportuj);
  $('import').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', () => { const f = $('soubor').files[0]; if (f) importuj(f); $('soubor').value = ''; });
  addEventListener('visibilitychange', () => { if (document.hidden) ulozHru(); });
  addEventListener('pagehide', () => ulozHru());

  postavNastroje();
  // uložená hra má přednost; ?seed= v adrese nebo ?nova=1 začne novou
  if (par.has('seed') || par.has('nova') || !nactiUlozenou()) novaHora(nast.seed, nast.vel);
  else hlaska(`Pokračuje uložená hra – ${HR.cas(hra).den}. den, ${HR.cas(hra).obdobi}.`);
  zvolNastroj('');
  requestAnimationFrame(snimek);

  // rozhraní pro testy
  S.ui = {
    get hra() { return hra; }, otevriObchod() { $('obchod').hidden = false; obnovObchod(); }, otevriPrace() { $('tabPrace').hidden = false; obnovTabulkuPraci(); }, get sv() { return sv; }, get kam() { return kam; }, get ceka() { return ceka; },
    get nastroj() { return nastroj; }, get rychlost() { return rychlost; },
    prepniPatro, vystred, zoomuj, kresliHned, novaHora, tahni, nastavRychlost, zvolNastroj, pouzij, skokNa, ulozHru, nactiUlozenou,
    vyberBudovu(id) { vybranaBudova = id; vybranyTrp = null; obnovInfo(); }, vyberZonu(id) { vybranaZona = id; obnovInfo(); },
    zvolStavbu(t, s) { stavba = t; smer = s || 0; paletaSkupina = ST.SKUPINY_STAVEB.findIndex(g => g.typy.includes(t)); zvolNastroj('stavet'); },
    vyberTrp(id) { vybranyTrp = id; vybranaBudova = vybranyPlan = vybranaZona = null; obnovInfo(); },
    odkryj() { SV.odkrytVse(sv); hra.verzeTerenu++; kresba.zneplatni(); miniData.length = 0; obnovNahledy(); },
    statistika: () => kresba.statistika(),
    castice: () => castice.c, vyberZvuky, emitory,
  };
})(SIN);
