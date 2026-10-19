/* ============================================================
   Štítky a čelní panely – uživatelské rozhraní editoru (SVG plocha).
   Výpočty a exporty jsou v jadro.js (SP) a pdf.js (SP_PDF).
   ============================================================ */
(function () {
  'use strict';
  const PREFIX = 'webapp_stitky_panely_';
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) { } },
  };
  const $ = (id) => document.getElementById(id);
  const fmt = SP.fmt;
  const esc = SP.escXml;
  const n4 = (x) => String(Math.round(x * 10000) / 10000);
  const info = (t) => { try { Dialog.info(t); } catch (e) { } };
  const chyba = (t) => { try { Dialog.chyba(t); } catch (e) { } };

  const MATERIALY = {
    hlinik: { panel: '#c9ccd1', potisk: '#151515' }, cerny: { panel: '#252629', potisk: '#f0f0f0' }, bily: { panel: '#f4f4f1', potisk: '#151515' },
    zluty: { panel: '#f2c230', potisk: '#151515' }, fr4: { panel: '#1d6a3c', potisk: '#f4f4f4' }, mosaz: { panel: '#c8a64a', potisk: '#1a1a1a' },
  };
  const NASTROJE = [
    { id: 'vyber', nazev: 'Výběr', kl: 'V', ik: '<path d="M5 3l14 9-6 1.5L10 20z"/>' },
    { id: 'text', nazev: 'Text', kl: 'T', ik: '<path d="M5 5h14M12 5v15M9 20h6"/>' },
    { id: 'symbol', nazev: 'Symbol', kl: 'Y', ik: '<path d="M12 3v8M5 11h14M8 15h8M10.5 19h3"/>' },
    { id: 'znacka', nazev: 'Značka', kl: 'M', ik: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3v4M12 17v4"/>' },
    { id: 'otvor', nazev: 'Kruhový otvor', kl: 'O', ik: '<circle cx="12" cy="12" r="7" stroke-dasharray="0" /><path d="M9 12h6M12 9v6" stroke-width="1"/>' },
    { id: 'otvorObd', nazev: 'Obdélníkový otvor', kl: 'H', ik: '<rect x="4" y="7" width="16" height="10" rx="2"/>' },
    { id: 'stupnice', nazev: 'Stupnice / potenc.', kl: 'S', ik: '<circle cx="12" cy="13" r="3.5"/><path d="M5 18l-1.5 1.5M4 13H2M5 8L3.5 6.5M12 5V3M19 8l1.5-1.5M20 13h2M19 18l1.5 1.5"/>' },
    { id: 'led', nazev: 'LED', kl: 'L', ik: '<circle cx="12" cy="12" r="4" fill="currentColor"/><circle cx="12" cy="12" r="7"/>' },
    { id: 'konektor', nazev: 'Konektor', kl: 'J', ik: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.5"/>' },
    { id: 'ovladac', nazev: 'Tlačítko / spínač', kl: 'B', ik: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>' },
    { id: 'kota', nazev: 'Kóta', kl: 'K', ik: '<path d="M4 6v12M20 6v12M4 12h16M4 12l3-2M4 12l3 2M20 12l-3-2M20 12l-3 2"/>' },
    { id: 'cara', nazev: 'Čára', kl: 'C', ik: '<path d="M4 18L20 6"/>' },
    { id: 'obdelnik', nazev: 'Obdélník', kl: 'R', ik: '<rect x="4" y="6" width="16" height="12"/>' },
    { id: 'kruh', nazev: 'Kruh (grafika)', kl: 'U', ik: '<circle cx="12" cy="12" r="8"/>' },
  ];
  const POPISEK_POLE = { skupina: 'Popisek', pole: [
    ['popisek', 'Text popisku', 'text'], ['popPoloha', 'Poloha', 'vyber', [['nad', 'nad prvkem'], ['pod', 'pod prvkem']]],
    ['popVel', 'Výška písma (mm)', 'cislo'], ['popOdstup', 'Odstup (mm)', 'cislo'], ['popTucne', 'Tučně', 'bool']] };
  const POLE = {
    text: [{ pole: [['text', 'Text (nový řádek = Enter; {n}, {n:3}, {datum})', 'textarea'], ['vel', 'Výška verzálek (mm)', 'cislo'],
      ['zarov', 'Zarovnání', 'vyber', [['start', 'vlevo (od kotvy)'], ['middle', 'na střed'], ['end', 'vpravo (ke kotvě)']]], ['radkovani', 'Řádkování (× výška)', 'cislo'], ['tucne', 'Tučně', 'bool']] }],
    symbol: [{ pole: [['druh', 'Symbol', 'vyber', SP.SYMBOLY], ['vel', 'Velikost (mm)', 'cislo'], ['tah', 'Tloušťka čar (0 = automaticky)', 'cislo']] }],
    znacka: [{ pole: [['druh', 'Značka', 'vyber', SP.ZNACKY], ['vel', 'Velikost (mm)', 'cislo']] }],
    otvor: [{ pole: [['prumer', 'Průměr (mm)', 'cislo'], ['ploska', 'Ploška – vzdálenost od středu (0 = bez)', 'cislo'], ['dvePlosky', 'Dvě protilehlé plošky', 'bool'],
      ['zabor', 'Zábor knoflíku/matice – Ø (0 = nezobrazovat)', 'cislo']] }, POPISEK_POLE],
    otvorObd: [{ pole: [['sirka', 'Šířka (mm)', 'cislo'], ['vyska', 'Výška (mm)', 'cislo'], ['r', 'Rádius rohů (mm)', 'cislo'], ['zabor', 'Zábor – Ø (0 = nic)', 'cislo']] }, POPISEK_POLE],
    stupnice: [
      { skupina: 'Dílky', pole: [['r', 'Vnitřní poloměr (mm)', 'cislo'], ['rozsah', 'Rozsah (°)', 'cislo'], ['pocet', 'Počet dílků', 'cislo'], ['mezi', 'Pododdíly (1 = žádné)', 'cislo'],
        ['delka', 'Délka hlavní čárky', 'cislo'], ['delkaVedl', 'Délka vedlejší', 'cislo'], ['tah', 'Tloušťka hlavní', 'cislo'], ['tahVedl', 'Tloušťka vedlejší', 'cislo'],
        ['natoceni', 'Natočení středu (°)', 'cislo'], ['styl', 'Styl', 'vyber', [['carky', 'čárky'], ['tecky', 'tečky']]], ['smer', 'Hodnoty rostou', 'vyber', [['cw', 'po směru hodin'], ['ccw', 'proti směru']]], ['oblouk', 'Kreslit oblouk', 'bool']] },
      { skupina: 'Čísla', pole: [['popisky', 'Popisky', 'vyber', [['cisla', 'čísla od–do'], ['vlastni', 'vlastní texty'], ['zadne', 'žádné']]], ['od', 'Od', 'cislo'], ['do', 'Do', 'cislo'], ['des', 'Desetinná místa', 'cislo'],
        ['vlastni', 'Vlastní texty (odděleno ;)', 'text'], ['velPisma', 'Výška písma (mm)', 'cislo'], ['odstup', 'Odstup od čárek', 'cislo'],
        ['orientace', 'Orientace', 'vyber', [['vodorovne', 'vodorovně'], ['radialne', 'podél obvodu']]]] },
      { skupina: 'Otvor a knoflík', pole: [['otvor', 'Otvor uprostřed Ø (0 = bez)', 'cislo'], ['zabor', 'Průměr knoflíku (náhled)', 'cislo']] }, POPISEK_POLE],
    led: [{ pole: [['prumer', 'Otvor Ø (mm) – 3 mm LED ≈ 3,2; 5 mm ≈ 5,2', 'cislo'], ['krouzek', 'Grafický kroužek – šířka mezery (0 = bez)', 'cislo'], ['barva', 'Barva v náhledu', 'barva']] }, POPISEK_POLE],
    konektor: [{ pole: [['druh', 'Typ konektoru', 'vyber', SP.KONEKTORY.map((k) => [k.id, k.nazev])], ['zabor', 'Zábor – Ø (prázdné = podle typu)', 'cislo?']] }, POPISEK_POLE],
    ovladac: [{ pole: [['druh', 'Typ', 'vyber', SP.OVLADACE.map((k) => [k.id, k.nazev])], ['zabor', 'Zábor / knoflík – Ø (prázdné = podle typu)', 'cislo?']] }, POPISEK_POLE],
    kota: [{ pole: [['smer', 'Směr', 'vyber', [['vodorovna', 'vodorovná'], ['svisla', 'svislá'], ['sikma', 'šikmá (skutečná délka)']]], ['dx', 'Druhý bod – Δx (mm)', 'cislo'], ['dy', 'Druhý bod – Δy (mm)', 'cislo'],
      ['odsaz', 'Odsazení kótovací čáry (mm)', 'cislo'], ['vel', 'Výška písma', 'cislo'], ['des', 'Desetinná místa', 'cislo'], ['prefix', 'Předpona (např. Ø )', 'text'], ['tah', 'Tloušťka čar', 'cislo']] }],
    cara: [{ pole: [['dx', 'Δx (mm)', 'cislo'], ['dy', 'Δy (mm)', 'cislo'], ['tah', 'Tloušťka (mm)', 'cislo']] }],
    obdelnik: [{ pole: [['sirka', 'Šířka (mm)', 'cislo'], ['vyska', 'Výška (mm)', 'cislo'], ['r', 'Rádius rohů', 'cislo'], ['tah', 'Tloušťka čáry', 'cislo'], ['vypln', 'Vyplněný', 'bool']] }],
    kruh: [{ pole: [['prumer', 'Průměr (mm)', 'cislo'], ['tah', 'Tloušťka čáry', 'cislo'], ['vypln', 'Vyplněný', 'bool']] }],
  };

  /* ---------- stav ---------- */
  let P = null;
  let vyber = new Set();
  let nastroj = 'vyber';
  let aktivniVrstva = null;
  let pohled = { x: -10, y: -10, w: 100 };
  let historie = [], budoucnost = [];
  let schranka = null;
  let drag = null;
  let kotaBod = null;
  let voditka = null;
  let kurzorMm = null;
  let mezernik = false;
  const ukazatele = new Map();
  const svg = $('svg'), plocha = $('plocha');

  function demoProjekt() {
    const p = SP.novyProjekt('euro3u', { hp: 10 });
    p.panel.nazev = 'Filtr VCF 10 HP';
    p.panel.material = 'cerny';
    const W = p.panel.sirka, add = (typ, x, y, par) => p.prvky.push(SP.novyPrvek(typ, x, y, par || {}, p));
    add('text', W / 2, 13, { text: 'FILTR', vel: 4, tucne: true });
    add('stupnice', W / 2, 37, { r: 9.5, delka: 1.6, pocet: 10, mezi: 2, velPisma: 1.8, zabor: 15, otvor: 7.5, popisek: 'CUTOFF', popVel: 2.2 });
    add('stupnice', 13, 66, { r: 6.5, delka: 1.2, delkaVedl: 0.7, pocet: 10, mezi: 1, popisky: 'zadne', zabor: 11, otvor: 7.2, popisek: 'RES', popVel: 2 });
    add('stupnice', W - 13, 66, { r: 6.5, delka: 1.2, pocet: 4, mezi: 1, popisky: 'vlastni', vlastni: '−;;0;;+', velPisma: 1.8, zabor: 11, otvor: 7.2, popisek: 'FM', popVel: 2 });
    add('led', W / 2, 82, { prumer: 3.2 });
    add('konektor', 13, 98, { druh: 'jack35', popisek: 'IN', popVel: 2 });
    add('konektor', W - 13, 98, { druh: 'jack35', popisek: 'FM', popVel: 2 });
    add('konektor', 13, 112, { druh: 'jack35', popisek: 'CV', popVel: 2 });
    add('obdelnik', W - 13, 109.6, { sirka: 11, vyska: 13.8, r: 1.2, tah: 0.3 });
    add('konektor', W - 13, 112, { druh: 'jack35', popisek: 'OUT', popVel: 2, popTucne: true });
    return p;
  }

  /* ---------- obnovení ---------- */
  function nactiStav() {
    const ulozeny = ls.get('autosave', null);
    if (ulozeny) {
      const r = SP.nactiProjekt(ulozeny);
      if (r.projekt) return r.projekt;
    }
    return demoProjekt();
  }
  P = nactiStav();

  let casUlozeni = null;
  function autoUloz() {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => { if (!ls.set('autosave', P)) chyba('Automatické uložení selhalo (plné úložiště prohlížeče?).'); }, 400);
  }
  function snimek() { return JSON.stringify({ P, vyber: [...vyber] }); }
  function obnovSnimek(s) { const o = JSON.parse(s); P = o.P; vyber = new Set(o.vyber.filter((id) => P.prvky.some((p) => p.id === id))); }
  function zmena(fn) {
    historie.push(snimek()); if (historie.length > 200) historie.shift();
    budoucnost = [];
    fn();
    autoUloz(); vykresli();
  }
  function zpet() { if (!historie.length) return; budoucnost.push(snimek()); obnovSnimek(historie.pop()); autoUloz(); vykresli(); }
  function znovu() { if (!budoucnost.length) return; historie.push(snimek()); obnovSnimek(budoucnost.pop()); autoUloz(); vykresli(); }

  const prvek = (id) => P.prvky.find((p) => p.id === id);
  const vrstva = (id) => P.vrstvy.find((v) => v.id === id);
  const jeEditovatelny = (p) => { const v = vrstva(p.vrstva); return !p.zamceny && (!v || (v.viditelna && !v.zamcena)); };
  const vybrane = () => P.prvky.filter((p) => vyber.has(p.id));

  /* ---------- pohled ---------- */
  function rozmerPlochy() { const r = plocha.getBoundingClientRect(); return { w: Math.max(50, r.width), h: Math.max(50, r.height) }; }
  function vyskaPohledu() { const r = rozmerPlochy(); return pohled.w * r.h / r.w; }
  function pxNaMm() { return rozmerPlochy().w / pohled.w; }
  function celyPohled() {
    const r = rozmerPlochy(), W = P.panel.sirka, H = P.panel.vyska, okr = Math.max(W, H) * 0.08 + 6;
    const w = Math.max((W + 2 * okr), (H + 2 * okr) * r.w / r.h);
    pohled = { w, x: W / 2 - w / 2, y: H / 2 - (w * r.h / r.w) / 2 };
  }
  function zoom(f, kolem) {
    const h = vyskaPohledu(), c = kolem || { x: pohled.x + pohled.w / 2, y: pohled.y + h / 2 };
    const nw = Math.min(5000, Math.max(2, pohled.w / f));
    const k = nw / pohled.w;
    pohled = { w: nw, x: c.x - (c.x - pohled.x) * k, y: c.y - (c.y - pohled.y) * k };
    vykresliPlochu();
  }
  function mmZUdalosti(e) {
    const r = svg.getBoundingClientRect();
    return { x: pohled.x + (e.clientX - r.left) / r.width * pohled.w, y: pohled.y + (e.clientY - r.top) / r.height * vyskaPohledu() };
  }

  /* ---------- vykreslení plochy ---------- */
  function primEd(q) {
    const role = q.role;
    if (role === 'cut') {
      if (q.t === 'kruh') return `<circle class="cut" cx="${n4(q.cx)}" cy="${n4(q.cy)}" r="${n4(q.r)}"/>`;
      return `<path class="${q.obrys ? 'obrys' : 'cut'}" d="${SP.cestaNaD(q.p)}"/>`;
    }
    if (role === 'nahled') {
      if (q.barva) return `<circle class="led-nahled" cx="${n4(q.cx)}" cy="${n4(q.cy)}" r="${n4(q.r)}" style="fill:${esc(q.barva)};opacity:.85"/>`;
      return q.t === 'kruh' ? `<circle class="nz" cx="${n4(q.cx)}" cy="${n4(q.cy)}" r="${n4(q.r)}"/>` : '';
    }
    const f = role === 'pom' ? 'pf' : 'gf', s = role === 'pom' ? 'ps' : 'gs';
    if (q.t === 'text') {
      const pr = SP.textNaPrikazy(q);
      if (pr) return `<path class="${f}" d="${SP.cestaNaD(pr)}"/>`;
      const em = SP.emProVel(q.vel, null);
      return `<text class="${f}" x="0" y="${n4(q.vel / 2)}" transform="translate(${n4(q.x)} ${n4(q.y)}) rotate(${n4(q.rot || 0)})" font-family="Liberation Sans, Arial, sans-serif" font-size="${n4(em)}"${q.tucne ? ' font-weight="bold"' : ''} text-anchor="${q.zarov || 'middle'}">${esc(q.text)}</text>`;
    }
    const cls = q.vypln ? f : s, sw = q.vypln ? '' : ` stroke-width="${n4(q.tah || 0.1)}"`;
    if (q.t === 'kruh') return `<circle class="${cls}" cx="${n4(q.cx)}" cy="${n4(q.cy)}" r="${n4(q.r)}"${sw}/>`;
    return `<path class="${cls}" d="${SP.cestaNaD(q.p)}"${sw}/>`;
  }

  function mrizkaSvg() {
    const N = P.nastaveni;
    if (!N.mrizkaZobr) return '';
    const ppm = pxNaMm(); let krok = N.mrizka || 1;
    while (krok * ppm < 7) krok *= 2;
    const W = P.panel.sirka, H = P.panel.vyska, h = vyskaPohledu();
    const x0 = Math.max(0, pohled.x), x1 = Math.min(W, pohled.x + pohled.w), y0 = Math.max(0, pohled.y), y1 = Math.min(H, pohled.y + h);
    if (x1 <= x0 || y1 <= y0) return '';
    let d1 = '', d2 = '';
    const hlavni = krok * 5;
    for (let i = Math.ceil(x0 / krok); i * krok <= x1 + 1e-9; i++) { const x = i * krok; const s = `M${n4(x)} ${n4(y0)}V${n4(y1)}`; if (Math.abs(x / hlavni - Math.round(x / hlavni)) < 1e-6) d2 += s; else d1 += s; }
    for (let i = Math.ceil(y0 / krok); i * krok <= y1 + 1e-9; i++) { const y = i * krok; const s = `M${n4(x0)} ${n4(y)}H${n4(x1)}`; if (Math.abs(y / hlavni - Math.round(y / hlavni)) < 1e-6) d2 += s; else d1 += s; }
    return `<g class="mrizka"><path class="mr1" d="${d1}"/><path class="mr2" d="${d2}"/></g>`;
  }

  let bbCache = new Map();
  function vykresliPlochu() {
    const r = rozmerPlochy(), h = vyskaPohledu();
    svg.setAttribute('viewBox', `${n4(pohled.x)} ${n4(pohled.y)} ${n4(pohled.w)} ${n4(h)}`);
    const mat = MATERIALY[P.panel.material] || MATERIALY.hlinik;
    const svetly = parseInt(mat.panel.slice(1, 3), 16) > 128;
    svg.style.setProperty('--potisk', mat.potisk);
    svg.style.setProperty('--mr1', svetly ? 'rgba(0,0,0,.13)' : 'rgba(255,255,255,.12)');
    svg.style.setProperty('--mr2', svetly ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.26)');
    const panelD = SP.cestaNaD(SP.obdCesta(P.panel.sirka, P.panel.vyska, P.panel.r || 0, P.panel.sirka / 2, P.panel.vyska / 2));
    const out = [`<path d="${panelD}" style="fill:${mat.panel}"/>`, mrizkaSvg()];
    bbCache = new Map();
    const poradi = new Map(P.vrstvy.map((v, i) => [v.id, i]));
    const prvky = P.prvky.slice().sort((a, b) => (poradi.get(a.vrstva) || 0) - (poradi.get(b.vrstva) || 0));
    const vrchni = [];
    for (const p of prvky) {
      const v = vrstva(p.vrstva);
      if (v && !v.viditelna) continue;
      const prims = SP.prvekPrimitiva(p, { n: 1 });
      const bb = SP.ohraniceniPrimitiv(prims, ['cut', 'graf', 'pom']) || { x0: p.x - 1, y0: p.y - 1, x1: p.x + 1, y1: p.y + 1 };
      bbCache.set(p.id, bb);
      const m = Math.max(0.6, 4 / pxNaMm());
      const zam = !jeEditovatelny(p);
      // řez vždy nad potiskem: otvory „proděraví“ i grafiku pod nimi
      const cut = prims.filter((q) => q.role === 'cut'), ost = prims.filter((q) => q.role !== 'cut');
      out.push(`<g class="prvek${zam ? ' zamceny-prvek' : ''}" data-id="${p.id}"><rect class="hit" x="${n4(bb.x0 - m)}" y="${n4(bb.y0 - m)}" width="${n4(bb.x1 - bb.x0 + 2 * m)}" height="${n4(bb.y1 - bb.y0 + 2 * m)}"/>${ost.map(primEd).join('')}</g>`);
      if (cut.length) vrchni.push(`<g class="prvek${zam ? ' zamceny-prvek' : ''}" data-id="${p.id}">${cut.map(primEd).join('')}</g>`);
    }
    out.push(...vrchni);
    if (P.panel.obrys !== false) out.push(primEd(SP.obrysPrimitivum(P.panel)));
    else out.push(`<path d="${panelD}" class="nz"/>`);
    out.push(prekryvSvg());
    svg.innerHTML = out.join('');
    svg.classList.toggle('nahled', $('nahledHotovy').checked);
    svg.classList.toggle('bez-zaboru', !$('zaborZobr').checked);
    svg.classList.toggle('umistit', nastroj !== 'vyber');
    $('zoomInfo').textContent = fmt(pxNaMm() / (96 / 25.4) * 100, 0) + ' %';
  }

  function prekryvSvg() {
    const o = [];
    const h = vyskaPohledu(), ppm = pxNaMm();
    for (const id of vyber) {
      const bb = bbCache.get(id); if (!bb) continue;
      const m = 3 / ppm;
      o.push(`<rect class="vybrany" x="${n4(bb.x0 - m)}" y="${n4(bb.y0 - m)}" width="${n4(bb.x1 - bb.x0 + 2 * m)}" height="${n4(bb.y1 - bb.y0 + 2 * m)}"/>`);
      const p = prvek(id); if (p) { const k = 5 / ppm; o.push(`<path class="kotva" d="M${n4(p.x - k)} ${n4(p.y)}H${n4(p.x + k)}M${n4(p.x)} ${n4(p.y - k)}V${n4(p.y + k)}"/>`); }
    }
    if (voditka) {
      if (voditka.vodX != null) o.push(`<path class="voditko" d="M${n4(voditka.vodX)} ${n4(pohled.y)}V${n4(pohled.y + h)}"/>`);
      if (voditka.vodY != null) o.push(`<path class="voditko" d="M${n4(pohled.x)} ${n4(voditka.vodY)}H${n4(pohled.x + pohled.w)}"/>`);
    }
    if (drag && drag.typ === 'ramecek' && drag.akt) {
      const a = drag.start, b = drag.akt;
      o.push(`<rect class="ramecek" x="${n4(Math.min(a.x, b.x))}" y="${n4(Math.min(a.y, b.y))}" width="${n4(Math.abs(b.x - a.x))}" height="${n4(Math.abs(b.y - a.y))}"/>`);
    }
    // náhled umísťovaného prvku
    if (nastroj !== 'vyber' && kurzorMm && !drag) {
      if (nastroj === 'kota' && kotaBod) {
        const k = kotaZBodu(kotaBod, kurzorMm);
        o.push(`<g opacity=".7">${SP.prvekPrimitiva(Object.assign(SP.novyPrvek('kota', kotaBod.x, kotaBod.y), k)).map(primEd).join('')}</g>`);
      } else if (nastroj !== 'kota') {
        const p = SP.novyPrvek(nastroj, kurzorMm.x, kurzorMm.y, predvolba(nastroj));
        o.push(`<g opacity=".55" style="pointer-events:none">${SP.prvekPrimitiva(p).map(primEd).join('')}</g>`);
      }
      const k = 6 / ppm;
      o.push(`<path class="kotva" d="M${n4(kurzorMm.x - k)} ${n4(kurzorMm.y)}H${n4(kurzorMm.x + k)}M${n4(kurzorMm.x)} ${n4(kurzorMm.y - k)}V${n4(kurzorMm.y + k)}"/>`);
    }
    return `<g id="prekryv" style="pointer-events:none">${o.join('')}</g>`;
  }
  let rafPlocha = 0;
  function planujPlochu() { if (rafPlocha) return; rafPlocha = requestAnimationFrame(() => { rafPlocha = 0; vykresliPlochu(); }); }

  /* ---------- přichytávání ---------- */
  function cileProPrichyt(vyjma) {
    const W = P.panel.sirka, H = P.panel.vyska;
    const c = [{ x: 0, y: 0 }, { x: W / 2, y: H / 2 }, { x: W, y: H }];
    for (const p of P.prvky) if (!vyjma || !vyjma.has(p.id)) c.push({ x: p.x, y: p.y });
    return c;
  }
  function prichytBod(bod, e, vyjma) {
    const N = P.nastaveni;
    if (e && e.altKey) return { x: SP.zaokr(bod.x, 3), y: SP.zaokr(bod.y, 3), vodX: null, vodY: null };
    const tol = 6 / pxNaMm();
    return SP.prichyt(bod, { krok: N.mrizka, zapnuto: N.prichyt }, N.prichytObj ? cileProPrichyt(vyjma) : [], tol);
  }

  /* ---------- nástroje ---------- */
  function predvolba(typ) {
    return {};
  }
  function vrstvaProNovy(typ) {
    const druh = SP.TYPY[typ].druh, v = vrstva(aktivniVrstva);
    if (v && v.role === druh && v.viditelna && !v.zamcena) return v.id;
    const w = P.vrstvy.find((x) => x.role === druh && x.viditelna && !x.zamcena) || P.vrstvy.find((x) => x.role === druh);
    return w ? w.id : P.vrstvy[0].id;
  }
  function nastavNastroj(id) {
    nastroj = id; kotaBod = null;
    document.querySelectorAll('#paleta button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.nastroj === id ? 'true' : 'false'));
    const t = NASTROJE.find((x) => x.id === id);
    $('infoNastroj').textContent = id === 'vyber' ? '' : id === 'kota' ? 'Kóta: klepněte na první a druhý bod (Esc = zrušit)' : `${t.nazev}: klepněte na místo (Shift = umístit víc, Alt = bez přichycení, Esc = zrušit)`;
    vykresliPlochu();
  }
  function kotaZBodu(a, b) {
    const dx = SP.zaokr(b.x - a.x, 4), dy = SP.zaokr(b.y - a.y, 4);
    const smer = Math.abs(dx) >= Math.abs(dy) ? 'vodorovna' : 'svisla';
    return { dx, dy, smer, odsaz: -6 };
  }
  function umisti(e, bod) {
    const s = prichytBod(bod, e);
    if (nastroj === 'kota') {
      if (!kotaBod) { kotaBod = { x: s.x, y: s.y }; $('infoNastroj').textContent = 'Kóta: klepněte na druhý bod'; vykresliPlochu(); return; }
      const k = kotaZBodu(kotaBod, s);
      if (Math.hypot(k.dx, k.dy) < 1e-6) return;
      const a = kotaBod;
      zmena(() => { const p = SP.novyPrvek('kota', a.x, a.y, k, P); p.vrstva = vrstvaProNovy('kota'); P.prvky.push(p); vyber = new Set([p.id]); });
      kotaBod = null;
      if (!e.shiftKey) nastavNastroj('vyber'); else $('infoNastroj').textContent = 'Kóta: klepněte na první bod';
      return;
    }
    zmena(() => {
      const p = SP.novyPrvek(nastroj, s.x, s.y, predvolba(nastroj), P);
      p.vrstva = vrstvaProNovy(nastroj);
      P.prvky.push(p); vyber = new Set([p.id]);
    });
    if (!e.shiftKey) nastavNastroj('vyber');
  }

  /* ---------- myš a dotyk ---------- */
  svg.addEventListener('pointerdown', (e) => {
    try { svg.setPointerCapture(e.pointerId); } catch (er) { }
    ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const bod = mmZUdalosti(e);
    if (ukazatele.size === 2) {
      const [a, b] = [...ukazatele.values()];
      drag = { typ: 'stisk', d0: Math.hypot(a.x - b.x, a.y - b.y), pohled0: Object.assign({}, pohled), stred: mmZUdalosti({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }) };
      return;
    }
    if (ukazatele.size > 2) return;
    const cil = e.target.closest ? e.target.closest('[data-id]') : null;
    if (e.button === 1 || mezernik || (e.pointerType === 'touch' && !cil && nastroj === 'vyber')) {
      drag = { typ: 'pan', sx: e.clientX, sy: e.clientY, pohled0: Object.assign({}, pohled) }; svg.classList.add('posun'); e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    if (nastroj !== 'vyber') { umisti(e, bod); return; }
    if (cil) {
      const id = cil.dataset.id;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        if (vyber.has(id)) vyber.delete(id); else vyber.add(id);
        vykresli(); return;
      }
      if (!vyber.has(id)) { vyber = new Set([id]); vykresli(); }
      const ids = [...vyber].filter((i) => { const p = prvek(i); return p && jeEditovatelny(p); });
      if (!ids.length) return;
      drag = { typ: 'posun', start: bod, sx: e.clientX, sy: e.clientY, hlavni: id, orig: new Map(ids.map((i) => [i, { x: prvek(i).x, y: prvek(i).y }])), snimek: snimek(), pohnuto: false };
    } else {
      if (!e.shiftKey) vyber = new Set();
      drag = { typ: 'ramecek', start: bod, akt: null, pridat: e.shiftKey };
      vykresli();
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const bod = mmZUdalosti(e);
    kurzorMm = nastroj !== 'vyber' ? (() => { const s = prichytBod(bod, e); voditka = s; return { x: s.x, y: s.y }; })() : bod;
    zobrazKurzor(nastroj !== 'vyber' ? kurzorMm : bod);
    if (!drag) { if (nastroj !== 'vyber') planujPlochu(); return; }
    if (drag.typ === 'stisk' && ukazatele.size === 2) {
      const [a, b] = [...ukazatele.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const f = d / Math.max(1, drag.d0);
      const nw = Math.min(5000, Math.max(2, drag.pohled0.w / f)), k = nw / drag.pohled0.w;
      pohled = { w: nw, x: drag.stred.x - (drag.stred.x - drag.pohled0.x) * k, y: drag.stred.y - (drag.stred.y - drag.pohled0.y) * k };
      planujPlochu(); return;
    }
    if (drag.typ === 'pan') {
      const r = svg.getBoundingClientRect(), k = pohled.w / r.width;
      pohled = Object.assign({}, pohled, { x: drag.pohled0.x - (e.clientX - drag.sx) * k, y: drag.pohled0.y - (e.clientY - drag.sy) * k });
      planujPlochu(); return;
    }
    if (drag.typ === 'posun') {
      if (!drag.pohnuto && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
      drag.pohnuto = true;
      const o = drag.orig.get(drag.hlavni) || drag.orig.values().next().value;
      const cil = { x: o.x + bod.x - drag.start.x, y: o.y + bod.y - drag.start.y };
      const s = prichytBod(cil, e, new Set(drag.orig.keys()));
      voditka = s;
      const dx = s.x - o.x, dy = s.y - o.y;
      for (const [id, q] of drag.orig) { const p = prvek(id); p.x = SP.zaokr(q.x + dx, 4); p.y = SP.zaokr(q.y + dy, 4); }
      planujPlochu(); obnovPolohuVInspektoru(); return;
    }
    if (drag.typ === 'ramecek') { drag.akt = bod; planujPlochu(); }
  });
  function konecTahu(e) {
    ukazatele.delete(e.pointerId);
    if (!drag) return;
    const d = drag; drag = null; voditka = null; svg.classList.remove('posun');
    if (d.typ === 'posun' && d.pohnuto) {
      historie.push(d.snimek); budoucnost = []; autoUloz(); vykresli(); return;
    }
    if (d.typ === 'ramecek' && d.akt) {
      const x0 = Math.min(d.start.x, d.akt.x), x1 = Math.max(d.start.x, d.akt.x), y0 = Math.min(d.start.y, d.akt.y), y1 = Math.max(d.start.y, d.akt.y);
      if (x1 - x0 > 0.01 || y1 - y0 > 0.01) {
        for (const [id, bb] of bbCache) { const p = prvek(id); if (p && jeEditovatelny(p) && bb.x0 <= x1 && bb.x1 >= x0 && bb.y0 <= y1 && bb.y1 >= y0) vyber.add(id); }
      }
      vykresli(); return;
    }
    if (d.typ === 'stisk' || d.typ === 'pan') vykresliPlochu();
  }
  svg.addEventListener('pointerup', konecTahu);
  svg.addEventListener('pointercancel', konecTahu);
  svg.addEventListener('pointerleave', () => { if (!drag) { kurzorMm = null; voditka = null; planujPlochu(); } });
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    zoom(f, mmZUdalosti(e));
  }, { passive: false });
  svg.addEventListener('dblclick', (e) => {
    const cil = e.target.closest && e.target.closest('[data-id]');
    if (cil) { const p = prvek(cil.dataset.id); if (p && p.typ === 'text') { const el = document.querySelector('#insp [data-k="text"]'); if (el) { el.focus(); el.select && el.select(); } } }
  });

  function zobrazKurzor(b) {
    if (!b) { $('kurzor').textContent = 'X – Y –'; return; }
    const z = SP.naZobrazene(P, b.x, b.y, P.nastaveni.pocatek);
    $('kurzor').textContent = `X ${fmt(z.x, 2, false)}  Y ${fmt(z.y, 2, false)} mm`;
  }

  /* ---------- operace s výběrem ---------- */
  function smazVyber() {
    const ids = vybrane().filter(jeEditovatelny).map((p) => p.id);
    if (!ids.length) return;
    zmena(() => { P.prvky = P.prvky.filter((p) => !ids.includes(p.id)); vyber = new Set(); });
  }
  function kopiruj() { const v = vybrane(); if (v.length) { schranka = JSON.parse(JSON.stringify(v)); info(`Zkopírováno: ${v.length}`); } }
  function vloz(posun) {
    if (!schranka || !schranka.length) return;
    const d = posun != null ? posun : Math.max(P.nastaveni.mrizka || 1, 2);
    zmena(() => {
      vyber = new Set();
      for (const q of schranka) {
        const p = JSON.parse(JSON.stringify(q)); p.id = SP.noveId(); p.x = SP.zaokr(p.x + d, 4); p.y = SP.zaokr(p.y + d, 4); delete p.montazni;
        if (!vrstva(p.vrstva)) p.vrstva = vrstvaProNovy(p.typ);
        P.prvky.push(p); vyber.add(p.id);
      }
      schranka = JSON.parse(JSON.stringify(vybrane()));
    });
  }
  function duplikuj() { const v = vybrane(); if (!v.length) return; schranka = JSON.parse(JSON.stringify(v)); vloz(); }
  function posunVyber(dx, dy) {
    const v = vybrane().filter(jeEditovatelny); if (!v.length) return;
    zmena(() => { for (const p of v) { p.x = SP.zaokr(p.x + dx, 4); p.y = SP.zaokr(p.y + dy, 4); } });
  }
  function otocVyber(uhel) {
    const v = vybrane().filter(jeEditovatelny); if (!v.length) return;
    zmena(() => {
      if (v.length === 1) { v[0].rot = SP.zaokr((((v[0].rot || 0) + uhel) % 360 + 360) % 360, 6); return; }
      // skupina: otočit polohy kolem středu ohraničení a každý prvek
      const bb = v.reduce((a, p) => ({ x0: Math.min(a.x0, p.x), y0: Math.min(a.y0, p.y), x1: Math.max(a.x1, p.x), y1: Math.max(a.y1, p.y) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
      const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, a = uhel * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      for (const p of v) { const x = p.x - cx, y = p.y - cy; p.x = SP.zaokr(cx + x * c - y * s, 4); p.y = SP.zaokr(cy + x * s + y * c, 4); p.rot = SP.zaokr((((p.rot || 0) + uhel) % 360 + 360) % 360, 6); }
    });
  }
  function zarovnej(zpusob) {
    const v = vybrane().filter(jeEditovatelny);
    const kPanelu = $('zarovPanel').checked || v.length === 1;
    if (!v.length) { info('Nejdřív vyberte prvky.'); return; }
    const pol = v.map((p) => ({ id: p.id, bb: bbCache.get(p.id) || SP.ohraniceniPrvku(p) }));
    const pos = SP.zarovnej(pol, zpusob, kPanelu ? P.panel : null);
    zmena(() => { for (const p of v) { const d = pos[p.id]; if (d) { p.x = SP.zaokr(p.x + d.dx, 4); p.y = SP.zaokr(p.y + d.dy, 4); } } });
  }
  function rozmisti(osa) {
    const v = vybrane().filter(jeEditovatelny);
    if (v.length < 3) { info('Rozmístění potřebuje aspoň 3 vybrané prvky.'); return; }
    const pos = SP.rozmisti(v.map((p) => ({ id: p.id, x: p.x, y: p.y })), osa);
    zmena(() => { for (const p of v) { const d = pos[p.id]; if (d) { p.x = SP.zaokr(p.x + d.dx, 4); p.y = SP.zaokr(p.y + d.dy, 4); } } });
  }
  function okotuj() {
    let v = vybrane().filter((p) => SP.prvekPrimitiva(p).some((q) => q.role === 'cut'));
    if (!v.length) v = P.prvky.filter((p) => !p.montazni && SP.prvekPrimitiva(p).some((q) => q.role === 'cut'));
    if (!v.length) { info('Žádné otvory ke kótování.'); return; }
    const xs = [...new Set(v.map((p) => SP.zaokr(p.x, 3)))].sort((a, b) => a - b);
    const ys = [...new Set(v.map((p) => SP.zaokr(p.y, 3)))].sort((a, b) => a - b);
    zmena(() => {
      const vr = vrstvaProNovy('kota');
      xs.forEach((x, i) => { if (x > 0) P.prvky.push(SP.novyPrvek('kota', 0, 0, { dx: x, dy: 0, smer: 'vodorovna', odsaz: -(6 + i * 5), vrstva: vr }, P)); });
      ys.forEach((y, i) => { if (y > 0) P.prvky.push(SP.novyPrvek('kota', 0, 0, { dx: 0, dy: y, smer: 'svisla', odsaz: -(6 + i * 5), vrstva: vr }, P)); });
    });
    info(`Přidáno ${xs.length + ys.length} kót od levého horního rohu.`);
  }

  /* ---------- inspektor ---------- */
  let inspSnimek = null;
  function poleHtml(p, [k, nazev, typ, moznosti]) {
    const v = p[k];
    const id = 'f_' + k;
    if (typ === 'bool') return `<label class="zaskrt"><input type="checkbox" data-k="${k}" data-t="bool" ${v ? 'checked' : ''}> ${esc(nazev)}</label>`;
    let h = `<label for="${id}">${esc(nazev)}</label>`;
    if (typ === 'cislo' || typ === 'cislo?') h += `<input type="text" inputmode="decimal" id="${id}" data-k="${k}" data-t="${typ}" value="${v == null ? '' : esc(fmt(v, 4))}">`;
    else if (typ === 'text') h += `<input type="text" id="${id}" data-k="${k}" data-t="text" value="${esc(v == null ? '' : v)}">`;
    else if (typ === 'textarea') h += `<textarea id="${id}" data-k="${k}" data-t="text" rows="2">${esc(v == null ? '' : v)}</textarea>`;
    else if (typ === 'barva') h += `<input type="color" id="${id}" data-k="${k}" data-t="text" value="${esc(v || '#ff0000')}">`;
    else if (typ === 'vyber') h += `<select id="${id}" data-k="${k}" data-t="vyber">${moznosti.map(([a, b]) => `<option value="${esc(a)}"${a === v ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
    return `<div>${h}</div>`;
  }
  function vrstvyOptions(akt) { return P.vrstvy.map((v) => `<option value="${esc(v.id)}"${v.id === akt ? ' selected' : ''}>${esc(v.nazev)}</option>`).join(''); }
  function vykresliInspektor() {
    const el = $('insp'), v = vybrane();
    if (!v.length) {
      $('inspTitul').textContent = 'Vlastnosti';
      el.innerHTML = `<p class="insp-prazdny">Nic není vybráno. Zvolte nástroj vlevo (nebo klávesu) a klepněte do panelu.
        Prvek vyberete klepnutím, více prvků se Shiftem nebo tažením rámečku. Přesné hodnoty se zadávají zde – i jako výpočet (např. <code>40,34/2</code>).</p>`;
      return;
    }
    if (v.length > 1) {
      $('inspTitul').textContent = `Vybráno ${v.length} prvků`;
      el.innerHTML = `<label for="mVrstva">Vrstva</label><select id="mVrstva"><option value="">— beze změny —</option>${vrstvyOptions(null)}</select>
        <div class="mrizka2"><div><label for="mDx">Posunout o Δx (mm)</label><input type="text" id="mDx" value="0" inputmode="decimal"></div>
        <div><label for="mDy">Δy (mm)</label><input type="text" id="mDy" value="0" inputmode="decimal"></div></div>
        <div class="tlacitka" style="margin-top:8px"><button class="male" id="mPosun">Posunout</button></div>
        <p class="napoveda">Šipky posouvají o krok mřížky, Shift × 10, Alt o 0,1 mm. Zarovnání a rozmístění najdete vlevo.</p>`;
      $('mVrstva').onchange = (e) => { const id = e.target.value; if (!id) return; zmena(() => v.forEach((p) => { p.vrstva = id; })); };
      $('mPosun').onclick = () => { const dx = SP.vyraz($('mDx').value), dy = SP.vyraz($('mDy').value); if (isFinite(dx) && isFinite(dy)) posunVyber(dx, dy); };
      return;
    }
    const p = v[0], T = SP.TYPY[p.typ];
    $('inspTitul').textContent = (p.montazni ? 'Montážní otvor' : T.nazev) + (T.druh === 'cut' ? ' · výroba' : T.druh === 'pom' ? ' · pomocné' : ' · potisk');
    const z = SP.naZobrazene(P, p.x, p.y, P.nastaveni.pocatek);
    let h = `<div class="mrizka3">
      <div><label for="f_X">X (mm)</label><input type="text" inputmode="decimal" id="f_X" data-k="X" data-t="poloha" value="${esc(fmt(z.x, 4))}"></div>
      <div><label for="f_Y">Y (mm)</label><input type="text" inputmode="decimal" id="f_Y" data-k="Y" data-t="poloha" value="${esc(fmt(z.y, 4))}"></div>
      <div><label for="f_rot">Otočení (°)</label><input type="text" inputmode="decimal" id="f_rot" data-k="rot" data-t="cislo" value="${esc(fmt(p.rot || 0, 3))}"></div></div>
      <div class="mrizka2"><div><label for="f_vrstva">Vrstva</label><select id="f_vrstva" data-k="vrstva" data-t="vyber">${vrstvyOptions(p.vrstva)}</select></div>
      <div><label class="zaskrt" style="margin-top:24px"><input type="checkbox" data-k="zamceny" data-t="bool" ${p.zamceny ? 'checked' : ''}> zamknout</label></div></div>`;
    for (const sk of POLE[p.typ] || []) {
      h += `<div class="insp-skupina">${sk.skupina ? `<h3>${esc(sk.skupina)}</h3>` : ''}<div class="mrizka2">`;
      for (const f of sk.pole) h += poleHtml(p, f);
      h += '</div></div>';
    }
    if (p.typ === 'konektor' || p.typ === 'ovladac') {
      const k = SP.katalogPolozka(p.typ, p.druh);
      h += `<p class="napoveda">Výřez: ${k.otvory.map((o) => o.t === 'kruh' ? 'Ø ' + fmt(o.d) : o.t === 'obd' ? fmt(o.w) + ' × ' + fmt(o.h) : o.t === 'd' ? 'D Ø ' + fmt(o.d) + ' / ' + fmt(o.d / 2 + o.f) : o.t === 'klic' ? 'Ø ' + fmt(o.d) + ' s drážkou' : 'D-SUB').join(', ')}; zábor Ø ${fmt(k.zabor)} mm. Typické hodnoty – ověřte v datasheetu.</p>`;
    }
    if (p.typ === 'kota') h += `<p class="napoveda">Naměřeno: <b>${fmt(SP.kotaHodnota(p), 3)} mm</b>. Kóta je statická – po posunu prvků ji upravte.</p>`;
    if (p.montazni) h += '<p class="napoveda">Montážní otvor ze šablony – nezapočítává se do kontroly pásu lišt.</p>';
    if (T.druh === 'cut' && vrstva(p.vrstva) && vrstva(p.vrstva).role === 'graf') h += '<p class="napoveda" style="color:var(--text-mez)">Výrobní prvek leží na vrstvě potisku – otvor se přesto exportuje do řezu.</p>';
    el.innerHTML = h;
  }
  function obnovPolohuVInspektoru() {
    const v = vybrane(); if (v.length !== 1) return;
    const z = SP.naZobrazene(P, v[0].x, v[0].y, P.nastaveni.pocatek);
    const fx = $('f_X'), fy = $('f_Y');
    if (fx && document.activeElement !== fx) fx.value = fmt(z.x, 4);
    if (fy && document.activeElement !== fy) fy.value = fmt(z.y, 4);
  }
  function hodnotaPole(el) {
    const t = el.dataset.t;
    if (t === 'bool') return { ok: true, v: el.checked };
    if (t === 'text' || t === 'vyber') return { ok: true, v: el.value };
    if (t === 'cislo?' && el.value.trim() === '') return { ok: true, v: null };
    const v = SP.vyraz(el.value);
    return { ok: isFinite(v), v };
  }
  const KLADNE = new Set(['vel', 'prumer', 'sirka', 'vyska', 'pocet', 'mezi', 'radkovani', 'velPisma', 'popVel']);
  function aplikujPole(el) {
    const v = vybrane(); if (v.length !== 1) return false;
    const p = v[0], k = el.dataset.k, h = hodnotaPole(el);
    if (!h.ok || (KLADNE.has(k) && !(h.v > 0)) || (['zabor', 'r', 'otvor', 'krouzek', 'ploska', 'tah', 'tahVedl', 'delka', 'delkaVedl', 'des'].includes(k) && h.v != null && h.v < 0)) { el.classList.add('chyba'); return false; }
    el.classList.remove('chyba');
    if (k === 'X' || k === 'Y') {
      const z = SP.naZobrazene(P, p.x, p.y, P.nastaveni.pocatek);
      if (k === 'X') z.x = h.v; else z.y = h.v;
      const i = SP.zZobrazenych(P, z.x, z.y, P.nastaveni.pocatek);
      p.x = SP.zaokr(i.x, 6); p.y = SP.zaokr(i.y, 6);
    } else if (k === 'pocet' || k === 'mezi' || k === 'des') p[k] = Math.max(k === 'des' ? 0 : 1, Math.min(k === 'des' ? 6 : 360, Math.round(h.v)));
    else if (k === 'rozsah') p[k] = Math.max(1, Math.min(360, h.v));
    else p[k] = h.v;
    return true;
  }
  $('insp').addEventListener('focusin', (e) => { if (e.target.dataset && e.target.dataset.k) inspSnimek = snimek(); });
  $('insp').addEventListener('input', (e) => {
    const el = e.target; if (!el.dataset || !el.dataset.k || el.dataset.t === 'bool' || el.dataset.t === 'vyber') return;
    if (!inspSnimek) inspSnimek = snimek();
    if (aplikujPole(el)) { vykresliPlochu(); autoUloz(); }
  });
  $('insp').addEventListener('change', (e) => {
    const el = e.target; if (!el.dataset || !el.dataset.k) return;
    const pred = inspSnimek || snimek();
    if (aplikujPole(el)) {
      if (pred !== snimek()) { historie.push(pred); budoucnost = []; }
      inspSnimek = null; autoUloz();
      const prekreslit = el.dataset.t === 'vyber' || el.dataset.t === 'bool';
      if (prekreslit) vykresli(); else { vykresliPlochu(); vykresliKontrolu(); vykresliTabulku(); }
    }
  });
  $('insp').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur(); });

  /* ---------- panel ---------- */
  function vykresliPanel() {
    $('pNazev').value = P.panel.nazev || '';
    $('pSirka').value = fmt(P.panel.sirka, 4); $('pVyska').value = fmt(P.panel.vyska, 4); $('pR').value = fmt(P.panel.r || 0, 3);
    $('pMaterial').value = P.panel.material || 'hlinik';
    $('pObrys').checked = P.panel.obrys !== false;
    const t = P.panel.typ;
    let i = `Plocha ${fmt(P.panel.sirka)} × ${fmt(P.panel.vyska)} mm.`;
    if (t === 'eurorack') i += ` Eurorack ${fmt((P.panel.sirka + 0.3) / SP.HP, 2)} HP – pás lišt 9,5 mm nahoře a dole.`;
    if (t === 'rack19') i += ' 19" – uši racku 15,9 mm po stranách.';
    $('pInfo').textContent = i;
  }
  function panelZmena(fn) { zmena(fn); vykresliPanel(); }
  $('pNazev').addEventListener('change', (e) => panelZmena(() => { P.panel.nazev = e.target.value; }));
  for (const [id, k, min] of [['pSirka', 'sirka', 1], ['pVyska', 'vyska', 1], ['pR', 'r', 0]]) {
    $(id).addEventListener('change', (e) => {
      const v = SP.vyraz(e.target.value);
      if (!isFinite(v) || v < min || v > 5000) { e.target.classList.add('chyba'); return; }
      e.target.classList.remove('chyba');
      panelZmena(() => { P.panel[k] = v; P.panel.r = Math.min(P.panel.r || 0, P.panel.sirka / 2, P.panel.vyska / 2); });
    });
  }
  $('pMaterial').addEventListener('change', (e) => panelZmena(() => { P.panel.material = e.target.value; }));
  $('pObrys').addEventListener('change', (e) => panelZmena(() => { P.panel.obrys = e.target.checked; }));

  /* ---------- vrstvy ---------- */
  const ROLE = [['cut', 'výroba (řez)', 'var(--rez)'], ['graf', 'potisk', 'var(--text)'], ['pom', 'pomocná', 'var(--accent)']];
  function vykresliVrstvy() {
    const el = $('vrstvy');
    el.innerHTML = P.vrstvy.map((v, i) => `<div class="vrstva${v.id === aktivniVrstva ? ' aktivni' : ''}" data-v="${esc(v.id)}">
      <label title="Viditelná"><input type="checkbox" data-a="vid" ${v.viditelna ? 'checked' : ''}>vid.</label>
      <label title="Zamčená – prvky nejdou vybrat"><input type="checkbox" data-a="zam" ${v.zamcena ? 'checked' : ''}>zam.</label>
      <input type="text" data-a="nazev" value="${esc(v.nazev)}" aria-label="Název vrstvy">
      <span class="ovl"><button class="male" data-a="nahoru" title="Výš (kreslí se později)" ${i === P.vrstvy.length - 1 ? 'disabled' : ''}>▲</button><button class="male" data-a="dolu" title="Níž" ${i === 0 ? 'disabled' : ''}>▼</button><button class="male" data-a="smaz" title="Smazat vrstvu">✕</button></span>
      <span style="grid-column:1 / 3;font-size:.68rem;color:var(--text-muted)"><span class="role-znak" style="background:${(ROLE.find((r) => r[0] === v.role) || ROLE[1])[2]}"></span> ${P.prvky.filter((p) => p.vrstva === v.id).length} prvků</span>
      <select data-a="role" aria-label="Role vrstvy">${ROLE.map(([r, n]) => `<option value="${r}"${r === v.role ? ' selected' : ''}>${n}</option>`).join('')}</select>
    </div>`).reverse().join('');
  }
  $('vrstvy').addEventListener('click', (e) => {
    const r = e.target.closest('.vrstva'); if (!r) return;
    const id = r.dataset.v, a = e.target.dataset.a, i = P.vrstvy.findIndex((v) => v.id === id);
    if (a === 'nahoru' || a === 'dolu') { zmena(() => { const j = a === 'nahoru' ? i + 1 : i - 1; if (j < 0 || j >= P.vrstvy.length) return; const t = P.vrstvy[i]; P.vrstvy[i] = P.vrstvy[j]; P.vrstvy[j] = t; }); return; }
    if (a === 'smaz') { smazVrstvu(id); return; }
    if (!a) { aktivniVrstva = id; vykresliVrstvy(); }
  });
  async function smazVrstvu(id) {
    if (P.vrstvy.length <= 1) { info('Poslední vrstvu nelze smazat.'); return; }
    const n = P.prvky.filter((p) => p.vrstva === id).length;
    if (n && !(await Dialog.potvrd(`Vrstva obsahuje ${n} prvků. Smazat vrstvu i s nimi?`))) return;
    zmena(() => { P.vrstvy = P.vrstvy.filter((v) => v.id !== id); P.prvky = P.prvky.filter((p) => p.vrstva !== id); if (aktivniVrstva === id) aktivniVrstva = null; });
  }
  $('vrstvy').addEventListener('change', (e) => {
    const r = e.target.closest('.vrstva'); if (!r) return;
    const v = vrstva(r.dataset.v), a = e.target.dataset.a;
    zmena(() => {
      if (a === 'vid') v.viditelna = e.target.checked;
      else if (a === 'zam') v.zamcena = e.target.checked;
      else if (a === 'nazev') v.nazev = e.target.value || 'Vrstva';
      else if (a === 'role') v.role = e.target.value;
      if (a === 'vid' || a === 'zam') for (const id of [...vyber]) { const p = prvek(id); if (p && !jeEditovatelny(p)) vyber.delete(id); }
    });
  });
  $('bVrstvaPridat').addEventListener('click', () => zmena(() => {
    const id = 'v_' + Date.now().toString(36);
    P.vrstvy.push({ id, nazev: 'Vrstva ' + (P.vrstvy.length + 1), role: 'graf', viditelna: true, zamcena: false });
    aktivniVrstva = id;
  }));

  /* ---------- kontrola a tabulka ---------- */
  function vykresliKontrolu() {
    const minM = SP.vyraz($('minMustek').value), minT = SP.vyraz($('minText').value);
    const k = SP.kontrola(P, { minMustek: isFinite(minM) ? minM : 1.5, minText: isFinite(minT) ? minT : 1.5 });
    const c = k.filter((x) => x.uroven === 'chyba').length, w = k.length - c;
    $('kontrolaSouhrn').innerHTML = !k.length ? '<span class="o">Bez nálezů.</span>' : `<span class="c">${c} chyb</span>, <span class="v">${w} varování</span>`;
    $('kontrola').innerHTML = k.length ? k.map((x, i) => `<li class="${x.uroven}" data-i="${i}">${esc(x.text)}</li>`).join('') : '<li class="ok">Otvory, okraje, můstky i písmo jsou v pořádku.</li>';
    $('kontrola').onclick = (e) => { const li = e.target.closest('li[data-i]'); if (!li) return; vyber = new Set(k[+li.dataset.i].ids); vykresli(); };
  }
  let tabulka = [];
  function vykresliTabulku() {
    tabulka = SP.tabulkaOtvoru(P, P.nastaveni.pocatek);
    $('tabOtvoru').innerHTML = tabulka.map((r) => `<tr data-id="${esc(r.id)}" class="${vyber.has(r.id) ? 'vyb' : ''}"><td>${r.c}</td><td>${esc(r.nazev)}</td><td>${fmt(r.x, 2, false)}</td><td>${fmt(r.y, 2, false)}</td><td>${esc(r.rozmer)}</td></tr>`).join('')
      || '<tr><td colspan="5" style="text-align:left">Žádné otvory.</td></tr>';
  }
  $('tabOtvoru').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) { vyber = new Set([tr.dataset.id]); vykresli(); } });
  $('minMustek').addEventListener('change', vykresliKontrolu);
  $('minText').addEventListener('change', vykresliKontrolu);
  $('bCsv').addEventListener('click', () => {
    const h = 'c;prvek;x_mm;y_mm;rozmer\n' + tabulka.map((r) => [r.c, '"' + r.nazev.replace(/"/g, '""') + '"', fmt(r.x, 3, false), fmt(r.y, 3, false), '"' + r.rozmer + '"'].join(';')).join('\n');
    stahni(new Blob(['﻿' + h], { type: 'text/csv;charset=utf-8' }), jmenoSouboru() + '-otvory.csv');
  });

  /* ---------- celé překreslení ---------- */
  function vykresli() {
    vykresliPlochu(); vykresliInspektor(); vykresliVrstvy(); vykresliKontrolu(); vykresliTabulku();
    $('bZpet').disabled = !historie.length; $('bZnovu').disabled = !budoucnost.length;
    const N = P.nastaveni;
    $('mrizkaKrok').value = String(N.mrizka);
    if ($('mrizkaKrok').value !== String(N.mrizka)) { const o = document.createElement('option'); o.value = String(N.mrizka); o.textContent = fmt(N.mrizka, 3) + ' mm'; $('mrizkaKrok').appendChild(o); $('mrizkaKrok').value = String(N.mrizka); }
    $('mrizkaZobr').checked = !!N.mrizkaZobr; $('prichyt').checked = !!N.prichyt; $('prichytObj').checked = !!N.prichytObj; $('pocatek').value = N.pocatek || 'lh';
  }

  /* ---------- stavový řádek ---------- */
  $('mrizkaKrok').addEventListener('change', (e) => { P.nastaveni.mrizka = parseFloat(e.target.value); autoUloz(); vykresliPlochu(); });
  $('mrizkaZobr').addEventListener('change', (e) => { P.nastaveni.mrizkaZobr = e.target.checked; autoUloz(); vykresliPlochu(); });
  $('prichyt').addEventListener('change', (e) => { P.nastaveni.prichyt = e.target.checked; autoUloz(); });
  $('prichytObj').addEventListener('change', (e) => { P.nastaveni.prichytObj = e.target.checked; autoUloz(); });
  $('pocatek').addEventListener('change', (e) => { P.nastaveni.pocatek = e.target.value; autoUloz(); vykresli(); });
  $('nahledHotovy').addEventListener('change', vykresliPlochu);
  $('zaborZobr').addEventListener('change', vykresliPlochu);
  $('bPriblizit').addEventListener('click', () => zoom(1.4));
  $('bOddalit').addEventListener('click', () => zoom(1 / 1.4));
  $('bCele').addEventListener('click', () => { celyPohled(); vykresliPlochu(); });

  /* ---------- paleta a levý panel ---------- */
  $('paleta').innerHTML = NASTROJE.map((t) => `<button data-nastroj="${t.id}" aria-pressed="${t.id === 'vyber'}" title="${esc(t.nazev)} (${t.kl})"><svg viewBox="0 0 24 24" aria-hidden="true">${t.ik}</svg><span>${esc(t.nazev)}</span><span class="zk">${t.kl}</span></button>`).join('');
  $('paleta').addEventListener('click', (e) => { const b = e.target.closest('button[data-nastroj]'); if (b) nastavNastroj(b.dataset.nastroj); });
  document.querySelectorAll('[data-zarov]').forEach((b) => b.addEventListener('click', () => zarovnej(b.dataset.zarov)));
  document.querySelectorAll('[data-rozmisti]').forEach((b) => b.addEventListener('click', () => rozmisti(b.dataset.rozmisti)));
  $('bDuplikovat').addEventListener('click', duplikuj);
  $('bOtocit').addEventListener('click', () => otocVyber(90));
  $('bSmazat').addEventListener('click', smazVyber);
  $('bOkotovat').addEventListener('click', okotuj);
  $('bZpet').addEventListener('click', zpet);
  $('bZnovu').addEventListener('click', znovu);

  /* ---------- soubory ---------- */
  function jmenoSouboru() { return (P.panel.nazev || 'panel').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'panel'; }
  function stahni(blob, jmeno) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  function ulozSoubor() { stahni(new Blob([JSON.stringify(P, null, 1)], { type: 'application/json' }), jmenoSouboru() + '.panel.json'); }
  $('bUlozitSoubor').addEventListener('click', ulozSoubor);
  $('bOtevrit').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { otevriData(await f.text(), f.name); } catch (er) { chyba('Soubor nelze přečíst: ' + er.message); }
  });
  function otevriData(text, jmeno) {
    const r = SP.nactiProjekt(text);
    if (!r.projekt) { chyba(r.chyby.join(' ')); return false; }
    zmena(() => { P = r.projekt; vyber = new Set(); aktivniVrstva = null; });
    celyPohled(); vykresli(); vykresliPanel();
    info(`Otevřeno: ${jmeno || P.panel.nazev}` + (r.varovani.length ? ' – ' + r.varovani.join(' ') : ''));
    return true;
  }

  /* ---------- dialogy ---------- */
  document.querySelectorAll('dialog.okno').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target.closest('[data-zavrit]')) d.close(); else if (e.target === d) d.close(); });
  });
  const otevri = (id) => { const d = $(id); if (!d.open) d.showModal(); };

  // nový ze šablony
  (function () {
    const sel = $('nSablona'), kat = [...new Set(SP.SABLONY.map((s) => s.kat))];
    sel.innerHTML = kat.map((k) => `<optgroup label="${esc(k)}">${SP.SABLONY.filter((s) => s.kat === k).map((s) => `<option value="${s.id}">${esc(s.nazev)}</option>`).join('')}</optgroup>`).join('');
    const param = () => {
      const s = SP.SABLONY.find((x) => x.id === sel.value);
      $('nParam').innerHTML = (s.param || []).map((q) => `<div><label for="np_${q.k}">${esc(q.nazev)}</label><input type="text" inputmode="decimal" id="np_${q.k}" data-k="${q.k}" value="${fmt(q.vychozi)}"></div>`).join('');
      nInfo();
    };
    const hodnoty = () => { const o = {}; $('nParam').querySelectorAll('input').forEach((i) => { o[i.dataset.k] = SP.vyraz(i.value); }); return o; };
    const nInfo = () => {
      const pr = SP.novyProjekt(sel.value, hodnoty());
      $('nInfo').textContent = `Rozměr ${fmt(pr.panel.sirka, 2)} × ${fmt(pr.panel.vyska, 2)} mm` + (pr.prvky.length ? `, ${pr.prvky.length} montážní otvory.` : '.');
    };
    sel.addEventListener('change', param);
    $('nParam').addEventListener('input', nInfo);
    $('bNovy').addEventListener('click', () => { if (!sel.value) sel.value = 'euro3u'; param(); otevri('dlgNovy'); });
    $('nVytvorit').addEventListener('click', async () => {
      const novy = SP.novyProjekt(sel.value, hodnoty());
      if ($('nPonechat').checked) {
        zmena(() => { const montaz = novy.prvky; P.prvky = P.prvky.filter((p) => !p.montazni).concat(montaz.map((m) => Object.assign(m, { vrstva: vrstvaProNovy('otvor') }))); P.panel = Object.assign({}, P.panel, novy.panel, { material: P.panel.material }); });
      } else {
        if (P.prvky.some((p) => !p.montazni) && !(await Dialog.potvrd('Zahodit současný návrh? (Lze vrátit tlačítkem Zpět.)'))) return;
        zmena(() => { novy.panel.material = P.panel.material; P = novy; vyber = new Set(); aktivniVrstva = null; });
      }
      $('dlgNovy').close(); celyPohled(); vykresli(); vykresliPanel();
    });
  })();

  // projekty v prohlížeči
  function seznamProjektu() { return ls.get('projekty', {}) || {}; }
  function vykresliProjekty() {
    const s = seznamProjektu(), k = Object.keys(s).sort((a, b) => (s[b].cas || 0) - (s[a].cas || 0));
    $('prSeznam').innerHTML = k.length ? k.map((n) => `<li><span>${esc(n)}<br><small>${new Date(s[n].cas).toLocaleString('cs-CZ')} · ${fmt(s[n].data.panel.sirka)} × ${fmt(s[n].data.panel.vyska)} mm</small></span>
      <button class="male" data-otevrit="${esc(n)}">Otevřít</button><button class="male nebezpecne" data-smazat="${esc(n)}">Smazat</button></li>`).join('') : '<li>Zatím nic uloženého.</li>';
  }
  function ulozDoProhlizece(nazev) {
    const s = seznamProjektu(); s[nazev] = { cas: Date.now(), data: P };
    if (ls.set('projekty', s)) { ls.set('posledni', nazev); info(`Uloženo v prohlížeči: ${nazev}`); return true; }
    chyba('Uložení selhalo – úložiště prohlížeče je plné nebo zakázané. Použijte „Uložit soubor“.'); return false;
  }
  $('bProjekty').addEventListener('click', () => { $('prNazev').value = ls.get('posledni', '') || P.panel.nazev || ''; vykresliProjekty(); otevri('dlgProjekty'); });
  $('prUlozit').addEventListener('click', () => { const n = $('prNazev').value.trim(); if (!n) { $('prNazev').classList.add('chyba'); return; } $('prNazev').classList.remove('chyba'); ulozDoProhlizece(n); vykresliProjekty(); });
  $('prSeznam').addEventListener('click', async (e) => {
    const o = e.target.dataset.otevrit, s = e.target.dataset.smazat;
    if (o != null) { const d = seznamProjektu()[o]; if (d && otevriData(d.data, o)) { ls.set('posledni', o); $('dlgProjekty').close(); } }
    if (s != null && await Dialog.potvrd(`Smazat projekt „${s}“?`)) { const x = seznamProjektu(); delete x[s]; ls.set('projekty', x); vykresliProjekty(); }
  });

  // SVG / DXF
  $('bSvg').addEventListener('click', () => otevri('dlgSvg'));
  function moznostiSvg() {
    const t = SP.vyraz($('sTah').value);
    return { cut: $('sCut').checked, graf: $('sGraf').checked, pom: $('sPom').checked, tahRezu: isFinite(t) && t > 0 ? t : 0.1,
      barvaRezu: $('sBarvaRez').value.toUpperCase(), barvaPotisku: $('sBarvaGraf').value.toUpperCase(), textJakoText: !$('sKrivky').checked,
      zrcadlit: $('sZrcadlit').checked, n: parseInt($('sN').value, 10) || 1 };
  }
  $('sStahnout').addEventListener('click', () => {
    const m = moznostiSvg();
    if (!m.cut && !m.graf && !m.pom) { info('Zvolte aspoň jednu vrstvu.'); return; }
    if (!SP.PISMA.normal && !m.textJakoText) info('Písmo se ještě načítá – texty budou jako text, ne křivky.');
    stahni(new Blob([SP.doSvg(P, m)], { type: 'image/svg+xml' }), jmenoSouboru() + (m.zrcadlit ? '-zrcadlene' : '') + '.svg');
  });
  $('sDxf').addEventListener('click', () => {
    const m = moznostiSvg();
    stahni(new Blob([SP.doDxf(P, { cut: m.cut, graf: m.graf, pom: m.pom, n: m.n })], { type: 'application/dxf' }), jmenoSouboru() + '.dxf');
  });

  // PDF
  let jspdfSlib = null;
  function nactiJsPdf() {
    if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
    if (!jspdfSlib) jspdfSlib = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'lib/jspdf.umd.min.js'; s.onload = () => ok(window.jspdf.jsPDF); s.onerror = () => ko(new Error('Knihovnu jsPDF se nepodařilo načíst.')); document.head.appendChild(s); });
    return jspdfSlib;
  }
  function korekce() { return ls.get('korekce', null); }
  function moznostiPdf() {
    const k = korekce(), pouzit = $('tKorekce').checked && k;
    const pr = SP.vyraz($('tPrekryv').value);
    return { format: $('tFormat').value, potisk: $('tPotisk').checked, rez: $('tRez').checked, krizky: $('tKrizky').checked, koty: $('tKoty').checked,
      orez: $('tOrez').checked, kalibrace: $('tKal').checked, tabulka: $('tTabulka').checked, zrcadlit: $('tZrcadlit').checked, obrys: true,
      barvaPotisku: $('tBarva').value, prekryv: isFinite(pr) && pr >= 0 ? pr : 10, n: parseInt($('tN').value, 10) || 1, pocatek: P.nastaveni.pocatek,
      kx: pouzit ? k.kx : 1, ky: pouzit ? k.ky : 1 };
  }
  function pdfInfo() {
    const m = moznostiPdf();
    try {
      const st = SP_PDF.zvolStranu(m.format, P.panel.sirka, P.panel.vyska, m.kalibrace);
      let t = `Papír: ${st.nazev} (${fmt(st.sw)} × ${fmt(st.sh)} mm).`;
      if (st.dlazdice) {
        const o = st.okr, d = SP.dlazdice(P.panel.sirka, P.panel.vyska, st.sw - o.l - o.r, st.sh - o.t - o.b, m.prekryv);
        t += ` Panel se nevejde – rozdělí se na ${d.dily.length} dílů (${d.nx} × ${d.ny}) s překryvem ${fmt(m.prekryv)} mm; po tisku je slepte podle čárkovaných čar.`;
      }
      if (m.format === 'panel') t += ' Stránka bez okrajů a pravítek – vhodné pro tiskárny štítků a tiskové služby.';
      $('tInfo').textContent = t;
    } catch (e) { $('tInfo').textContent = e.message; }
    const k = korekce();
    $('tKorInfo').textContent = k ? `(X ${fmt(k.kx * 100, 2)} %, Y ${fmt(k.ky * 100, 2)} %)` : '(zatím neuložena – viz Kontrola měřítka)';
    $('tKorekce').disabled = !k;
  }
  $('bPdf').addEventListener('click', () => { const k = korekce(); $('tKorekce').checked = !!(k && k.pouzit); pdfInfo(); otevri('dlgPdf'); });
  $('dlgPdf').addEventListener('change', pdfInfo);
  async function vytvorPdf(otevrit) {
    try {
      const J = await nactiJsPdf();
      if (!SP.PISMA.normal) info('Písmo se ještě načítá – texty budou bez diakritiky. Zkuste to za chvíli znovu.');
      const r = SP_PDF.pdfPanel(J, P, moznostiPdf());
      vydejPdf(r.doc, jmenoSouboru() + '-1to1.pdf', otevrit);
      info(`PDF: ${r.info.format}, ${r.info.stran} str. Tiskněte se skutečnou velikostí (100 %).`);
    } catch (e) { chyba('PDF se nepodařilo vytvořit: ' + e.message); }
  }
  function vydejPdf(doc, jmeno, otevrit) {
    const blob = doc.output('blob');
    if (otevrit) { const u = URL.createObjectURL(blob); const w = window.open(u, '_blank'); if (!w) stahni(blob, jmeno); setTimeout(() => URL.revokeObjectURL(u), 120000); }
    else stahni(blob, jmeno);
  }
  $('tStahnout').addEventListener('click', () => vytvorPdf(false));
  $('tOtevrit').addEventListener('click', () => vytvorPdf(true));

  // arch samolepek
  let archStart = 0;
  const archVlastni = { id: 'vlastni', nazev: 'Vlastní rozložení', sl: 3, ra: 8, w: 70, h: 37, x0: 0, y0: 0.5, dx: 70, dy: 37 };
  (function () {
    $('aArch').innerHTML = SP.ARCHY.map((a) => `<option value="${a.id}">${esc(a.nazev)}</option>`).join('') + '<option value="vlastni">Vlastní rozložení…</option>';
    const pole = { aSl: 'sl', aRa: 'ra', aW: 'w', aH: 'h', aX0: 'x0', aY0: 'y0', aDx: 'dx', aDy: 'dy' };
    const naplnit = () => { const a = aktArch(); for (const [id, k] of Object.entries(pole)) $(id).value = fmt(a[k], 3); };
    $('aArch').addEventListener('change', () => { if ($('aArch').value !== 'vlastni') naplnit(); else Object.assign(archVlastni, aktArchZPoli()); archStart = 0; archInfo(); });
    for (const id of Object.keys(pole)) $(id).addEventListener('input', () => { if ($('aArch').value !== 'vlastni') { Object.assign(archVlastni, aktArchZPoli()); $('aArch').value = 'vlastni'; } else Object.assign(archVlastni, aktArchZPoli()); archInfo(); });
    function aktArchZPoli() { const o = {}; for (const [id, k] of Object.entries(pole)) { const v = SP.vyraz($(id).value); o[k] = k === 'sl' || k === 'ra' ? Math.max(1, Math.min(40, Math.round(v) || 1)) : (isFinite(v) ? v : 0); } return o; }
    window.__archNaplnit = naplnit;
  })();
  function aktArch() { const id = $('aArch').value; return id === 'vlastni' ? archVlastni : SP.ARCHY.find((a) => a.id === id) || SP.ARCHY[0]; }
  function archInfo() {
    const a = aktArch(), n = a.sl * a.ra;
    if (archStart >= n) archStart = 0;
    const poc = parseInt($('aPocet').value, 10);
    const kolik = isFinite(poc) && poc > 0 ? Math.min(poc, n - archStart) : n - archStart;
    const el = $('aNahled');
    el.style.gridTemplateColumns = `repeat(${a.sl}, 1fr)`;
    el.style.aspectRatio = `${210} / ${297}`;
    let h = '';
    for (let i = 0; i < n; i++) h += `<button data-i="${i}" class="${i < archStart ? 'pouzity' : i < archStart + kolik ? 'tisk' : ''}" title="Pozice ${i + 1}" aria-label="Pozice ${i + 1}">${i + 1}</button>`;
    el.innerHTML = h;
    const chyby = SP.archKontrola(a);
    const W = P.panel.sirka, H = P.panel.vyska;
    let t = `${n} štítků ${fmt(a.w)} × ${fmt(a.h)} mm; vytiskne se ${kolik} (pozice ${archStart + 1}–${archStart + kolik}), čísla {n} ${$('aNOd').value}–${(parseInt($('aNOd').value, 10) || 1) + kolik - 1}. `;
    if (Math.abs(W - a.w) > 0.05 || Math.abs(H - a.h) > 0.05) t += `Návrh má ${fmt(W)} × ${fmt(H)} mm – ${W > a.w || H > a.h ? 'je větší než štítek, okraje se oříznou' : 'je menší, vytiskne se na střed štítku'}. `;
    $('aInfo').innerHTML = esc(t) + (chyby.length ? `<br><span style="color:var(--text-chyba)">${esc(chyby.join(' '))}</span>` : '');
  }
  $('aNahled').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) { archStart = +b.dataset.i; archInfo(); } });
  ['aPocet', 'aNOd'].forEach((id) => $(id).addEventListener('input', archInfo));
  $('bArch').addEventListener('click', () => {
    const a = SP.ARCHY.find((x) => Math.abs(x.w - P.panel.sirka) < 0.05 && Math.abs(x.h - P.panel.vyska) < 0.05);
    if (a) $('aArch').value = a.id;
    window.__archNaplnit(); const k = korekce(); $('aKorekce').checked = !!(k && k.pouzit); $('aKorekce').disabled = !k;
    archInfo(); otevri('dlgArch');
  });
  $('aRozmer').addEventListener('click', () => { const a = aktArch(); panelZmena(() => { P.panel.sirka = a.w; P.panel.vyska = a.h; P.panel.r = Math.min(P.panel.r || 0, a.w / 2, a.h / 2); }); celyPohled(); vykresliPlochu(); archInfo(); });
  async function vytvorArch(otevrit) {
    try {
      const J = await nactiJsPdf(), a = aktArch();
      const ch = SP.archKontrola(a); if (ch.length) { chyba(ch.join(' ')); return; }
      const k = korekce(), pouzit = $('aKorekce').checked && k;
      const poc = parseInt($('aPocet').value, 10);
      const r = SP_PDF.pdfArch(J, P, a, { start: archStart, pocet: isFinite(poc) && poc > 0 ? poc : Infinity, nOd: parseInt($('aNOd').value, 10) || 1,
        obrysStitku: $('aObrys').checked, orezat: $('aOrez').checked, rez: $('aRez').checked, obrys: $('aRez').checked, kx: pouzit ? k.kx : 1, ky: pouzit ? k.ky : 1 });
      vydejPdf(r.doc, jmenoSouboru() + '-arch.pdf', otevrit);
      info(`Arch: ${r.info.stitku} štítků. ${r.info.varovani.join(' ')}`);
    } catch (e) { chyba('PDF se nepodařilo vytvořit: ' + e.message); }
  }
  $('aStahnout').addEventListener('click', () => vytvorArch(false));
  $('aOtevrit').addEventListener('click', () => vytvorArch(true));

  // kalibrace
  function kalStav() {
    const nx = SP.vyraz($('kNomX').value), mx = SP.vyraz($('kMerX').value), ny = SP.vyraz($('kNomY').value), my = SP.vyraz($('kMerY').value);
    const rx = SP.korekceMeritka(mx, nx), ry = SP.korekceMeritka(my, ny);
    const el = $('kStav');
    if (rx.stav === 'nic' && ry.stav === 'nic') { el.className = 'stav-kal'; el.textContent = 'Zadejte naměřené délky.'; return null; }
    const horsi = ['chyba', 'mez', 'ok', 'nic'].find((s) => s === rx.stav || s === ry.stav);
    el.className = 'stav-kal ' + horsi;
    el.innerHTML = `<b>Vodorovně:</b> ${esc(rx.zprava)}<br><b>Svisle:</b> ${esc(ry.zprava)}`;
    return { kx: rx.stav === 'nic' ? 1 : rx.faktor, ky: ry.stav === 'nic' ? 1 : ry.faktor, stav: horsi };
  }
  function kalUlozenaInfo() {
    const k = korekce();
    $('kUlozena').textContent = k ? `Uložená korekce: X ${fmt(k.kx * 100, 3)} %, Y ${fmt(k.ky * 100, 3)} % (${new Date(k.cas).toLocaleDateString('cs-CZ')}).` : 'Korekce zatím není uložena – tiskne se přesně 1:1.';
  }
  $('bKal').addEventListener('click', () => { kalStav(); kalUlozenaInfo(); otevri('dlgKal'); });
  ['kNomX', 'kMerX', 'kNomY', 'kMerY'].forEach((id) => $(id).addEventListener('input', kalStav));
  $('kUlozit').addEventListener('click', () => {
    const k = kalStav(); if (!k) { info('Nejdřív zadejte naměřené hodnoty.'); return; }
    if (k.stav === 'chyba') { chyba('Odchylka je příliš velká – nejdřív vypněte „Přizpůsobit stránce“ a změřte znovu.'); return; }
    ls.set('korekce', { kx: k.kx, ky: k.ky, pouzit: true, cas: Date.now() }); kalUlozenaInfo(); info('Korekce uložena a zapnuta pro další tisky.');
  });
  $('kZrusit').addEventListener('click', () => { ls.del('korekce'); kalUlozenaInfo(); info('Korekce zrušena.'); });
  $('kList').addEventListener('click', async () => {
    try { const J = await nactiJsPdf(); vydejPdf(SP_PDF.pdfKalibrace(J, {}).doc, 'kalibracni-list-1to1.pdf', false); $('kNomX').value = '150'; $('kNomY').value = '250'; kalStav(); }
    catch (e) { chyba(e.message); }
  });

  // řada / pole
  function radaUkaz() {
    const t = $('rTyp').value;
    $('rLin').classList.toggle('skryty', t !== 'lin'); $('rMriz').classList.toggle('skryty', t !== 'mriz');
    $('rKruh').classList.toggle('skryty', t !== 'kruh'); $('rMezi').classList.toggle('skryty', t !== 'mezi');
  }
  $('rTyp').addEventListener('change', radaUkaz);
  $('bRada').addEventListener('click', () => {
    const v = vybrane().filter(jeEditovatelny);
    if (!v.length) { info('Nejdřív vyberte prvek (nebo skupinu), který se má opakovat – např. otvor nebo konektor.'); return; }
    const a = v[0];
    $('rInfo').textContent = `Opakuje se ${v.length === 1 ? 'vybraný prvek' : v.length + ' vybraných prvků'} (${SP.TYPY[a.typ].nazev}). Kotva: X ${fmt(a.x)} Y ${fmt(a.y)} mm.`;
    $('rKX').value = fmt(P.panel.sirka / 2, 3); $('rKY').value = fmt(P.panel.vyska / 2, 3);
    $('rMX').value = fmt(a.x + 30, 3); $('rMY').value = fmt(a.y, 3);
    radaUkaz(); otevri('dlgRada');
  });
  $('rVytvorit').addEventListener('click', () => {
    const v = vybrane().filter(jeEditovatelny); if (!v.length) return;
    const N = (id, min, max) => { const x = Math.round(SP.vyraz($(id).value)); return isFinite(x) ? Math.max(min, Math.min(max, x)) : NaN; };
    const C = (id) => SP.vyraz($(id).value);
    const t = $('rTyp').value, a = v[0];
    let body;
    if (t === 'lin') body = SP.radaLinearni(N('rN', 1, 500), C('rRoz'), C('rUhel')).map((b) => ({ x: a.x + b.x, y: a.y + b.y }));
    else if (t === 'mriz') body = SP.radaMrizka(N('rSl', 1, 200), N('rRa', 1, 200), C('rDx'), C('rDy'), $('rSach').checked).map((b) => ({ x: a.x + b.x, y: a.y + b.y }));
    else if (t === 'mezi') body = SP.radaMezi(a.x, a.y, C('rMX'), C('rMY'), N('rMN', 1, 500));
    else body = SP.radaKruhova(N('rKN', 1, 500), C('rKD'), C('rKStart'), C('rKRoz'), $('rKOtacet').checked).map((b) => ({ x: C('rKX') + b.x, y: C('rKY') + b.y, rot: b.rot }));
    if (!body.length || body.some((b) => !isFinite(b.x) || !isFinite(b.y))) { chyba('Zkontrolujte zadané hodnoty.'); return; }
    if (body.length * v.length > 2000) { chyba('Příliš mnoho prvků (víc než 2000).'); return; }
    zmena(() => {
      const nove = new Set();
      body.forEach((b, i) => {
        for (const q of v) {
          const dx = q.x - a.x, dy = q.y - a.y;
          let p = q;
          if (i > 0) { p = JSON.parse(JSON.stringify(q)); p.id = SP.noveId(); delete p.montazni; P.prvky.push(p); }
          p.x = SP.zaokr(b.x + dx, 4); p.y = SP.zaokr(b.y + dy, 4);
          if (b.rot) p.rot = SP.zaokr(((q.rot || 0) + b.rot) % 360, 4);
          nove.add(p.id);
        }
      });
      vyber = nove;
    });
    $('dlgRada').close();
    info(`Vytvořeno ${body.length} pozic.`);
  });

  // zkratky
  const ZKRATKY = [
    ['V', 'výběr a posun'], ...NASTROJE.filter((t) => t.id !== 'vyber').map((t) => [t.kl, t.nazev]),
    ['Esc', 'zrušit nástroj / výběr'], ['Delete', 'smazat výběr'], ['Ctrl+Z / Ctrl+Y', 'zpět / znovu (i Ctrl+Shift+Z)'],
    ['Ctrl+C / X / V', 'kopírovat / vyjmout / vložit'], ['Ctrl+D', 'duplikovat'], ['Ctrl+A', 'vybrat vše'],
    ['Šipky', 'posun o krok mřížky (Shift × 10, Alt 0,1 mm)'], ['E / Shift+E', 'otočit o +90° / −90°'],
    ['G', 'mřížka zobrazit/skrýt'], ['P', 'přichytávání zap/vyp'], ['Alt při tažení', 'dočasně bez přichycení'],
    ['0', 'zobrazit celý panel'], ['+ / −', 'přiblížit / oddálit (i kolečko myši)'], ['Mezerník + tažení', 'posun pohledu (i prostřední tlačítko, dotyk)'],
    ['Ctrl+S', 'uložit do prohlížeče'], ['Ctrl+Shift+S', 'stáhnout soubor projektu'], ['F1', 'tato nápověda'],
  ];
  $('zkratky').innerHTML = ZKRATKY.map(([k, t]) => `<span><kbd>${esc(k)}</kbd></span><span>${esc(t)}</span>`).join('');
  $('bZkratky').addEventListener('click', () => otevri('dlgZkratky'));

  /* ---------- klávesnice ---------- */
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (document.querySelector('dialog[open]')) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const ctrl = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
    if (e.code === 'Space') { if (t && t.tagName === 'BUTTON') return; mezernik = true; e.preventDefault(); return; }
    if (ctrl) {
      if (k === 'z' && !e.shiftKey) { zpet(); e.preventDefault(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { znovu(); e.preventDefault(); }
      else if (k === 'c') { kopiruj(); e.preventDefault(); }
      else if (k === 'x') { kopiruj(); smazVyber(); e.preventDefault(); }
      else if (k === 'v') { vloz(); e.preventDefault(); }
      else if (k === 'd') { duplikuj(); e.preventDefault(); }
      else if (k === 'a') { vyber = new Set(P.prvky.filter(jeEditovatelny).map((p) => p.id)); vykresli(); e.preventDefault(); }
      else if (k === 's') { e.preventDefault(); if (e.shiftKey) ulozSoubor(); else { const n = ls.get('posledni', '') || P.panel.nazev || 'Panel'; ulozDoProhlizece(n); } }
      return;
    }
    if (e.altKey && !k.startsWith('arrow')) return;
    if (k.startsWith('arrow')) {
      if (!vyber.size) return;
      const krok = e.altKey ? 0.1 : (P.nastaveni.mrizka || 1) * (e.shiftKey ? 10 : 1);
      const d = { arrowleft: [-krok, 0], arrowright: [krok, 0], arrowup: [0, -krok], arrowdown: [0, krok] }[k];
      if (d) { posunVyber(d[0], d[1]); e.preventDefault(); }
      return;
    }
    if (k === 'escape') { if (kotaBod) { kotaBod = null; nastavNastroj('kota'); } else if (nastroj !== 'vyber') nastavNastroj('vyber'); else { vyber = new Set(); vykresli(); } return; }
    if (k === 'delete' || k === 'backspace') { smazVyber(); e.preventDefault(); return; }
    if (e.code === 'Digit0' || e.code === 'Numpad0') { celyPohled(); vykresliPlochu(); e.preventDefault(); return; }
    if (k === '+' || e.code === 'NumpadAdd') { zoom(1.4); e.preventDefault(); return; }
    if (k === '-' || e.code === 'NumpadSubtract') { zoom(1 / 1.4); e.preventDefault(); return; }
    if (k === 'f1' || k === '?') { otevri('dlgZkratky'); e.preventDefault(); return; }
    if (k === 'g') { P.nastaveni.mrizkaZobr = !P.nastaveni.mrizkaZobr; $('mrizkaZobr').checked = P.nastaveni.mrizkaZobr; autoUloz(); vykresliPlochu(); return; }
    if (k === 'p') { P.nastaveni.prichyt = !P.nastaveni.prichyt; $('prichyt').checked = P.nastaveni.prichyt; autoUloz(); info('Přichytávání ' + (P.nastaveni.prichyt ? 'zapnuto' : 'vypnuto')); return; }
    if (k === 'e') { otocVyber(e.shiftKey ? -90 : 90); return; }
    const n = NASTROJE.find((x) => x.kl.toLowerCase() === k);
    if (n) { nastavNastroj(n.id); e.preventDefault(); }
  });
  document.addEventListener('keyup', (e) => { if (e.code === 'Space') mezernik = false; });

  /* ---------- písma ---------- */
  async function nactiPismo(url, js, klic, tucne) {
    let buf = null;
    try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); buf = await r.arrayBuffer(); }
    catch (e) {
      try {
        await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = js; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
        const b64 = window.FONTY_JS && window.FONTY_JS[klic];
        if (b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); buf = u.buffer; delete window.FONTY_JS[klic]; }
      } catch (e2) { /* zůstane záložní text */ }
    }
    if (!buf || !window.opentype) return false;
    try { SP.nastavPismo(opentype.parse(buf), tucne); return true; } catch (e) { return false; }
  }
  Promise.all([
    nactiPismo('stitky_panely/fonty/LiberationSans-Regular.ttf', 'stitky_panely/fonty/LiberationSans-Regular.ttf.js', 'LiberationSans-Regular.ttf', false),
    nactiPismo('fonty/LiberationSans-Bold.ttf', 'fonty/js/LiberationSans-Bold.ttf.js', 'LiberationSans-Bold.ttf', true),
  ]).then((r) => { if (!r[0]) chyba('Písmo se nepodařilo načíst – texty se zobrazí systémovým písmem a PDF bez diakritiky.'); vykresli(); });

  /* ---------- start ---------- */
  new ResizeObserver(() => vykresliPlochu()).observe(plocha);
  celyPohled();
  vykresli(); vykresliPanel();
  window.__stitky = { get P() { return P; }, vykresli, nastavNastroj, umistiNa: (typ, x, y, par) => { zmena(() => { const p = SP.novyPrvek(typ, x, y, par || {}, P); p.vrstva = vrstvaProNovy(typ); P.prvky.push(p); vyber = new Set([p.id]); }); return [...vyber][0]; },
    vyberId: (ids) => { vyber = new Set(ids); vykresli(); }, otevri, nactiJsPdf, demo: () => { zmena(() => { P = demoProjekt(); vyber = new Set(); }); celyPohled(); vykresli(); vykresliPanel(); } };
})();
