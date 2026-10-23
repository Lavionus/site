/* Krabička s víčkem na pantu – výpočetní jádro bez DOM a bez manifoldu.
   Parametry (výchozí, normalizace), odvozené rozměry (osy pantů, rozložení článků, zapínání,
   přihrádky, zarážka, magnety), kontroly návrhu, tiskové polohy dílů, kusovník, odhad tisku,
   text na víko (obrysy z opentype.js) a projekt JSON.
   Kontrolu sítě, STL, 3MF a ZIP přebírá z krabicky/jadro.js (window.KRAB).
   Souřadnice: mm, osa Z nahoru, střed půdorysu v počátku, dno v z = 0,
   pant vzadu (+Y), zapínání vpředu (−Y) a volitelně na bocích (±X).
   Zapínání se počítá v „místní“ soustavě přední stěny a na boky se otočí kolem Z o phi. */
(function () {
  'use strict';
  const KRAB = typeof module !== 'undefined' ? require('../krabicky/jadro.js') : window.KRAB;
  const { fmt, kopie } = KRAB;

  const VERZE_FORMATU = 1;
  const FORMAT = 'webapp_krabicka_pant';

  const VYCHOZI = {
    nazev: 'Krabička s víčkem',
    vnitrni: { delka: 100, sirka: 60, vyska: 35 },   // dutina: od horní plochy dna po horní hranu stěn
    stena: 2, dno: 1.6, zaobleni: 4, segmenty: 48,
    viko: { tloustka: 2.4, osazeni: true, vyskaOsazeni: 3, stenaOsazeni: 1.2, vule: 0.25 },
    // přihrádky: počet v délce a šířce (1 = nedělit) nebo poměry šířek („1 1 2“), pevné přepážky nebo vyjímatelná vložka
    prihradky: { delka: 1, sirka: 1, pomeryDelka: '', pomerySirka: '', tloustka: 1.2, vyska: 0, typ: 'pevne', vule: 0.3 },
    // panty vzadu: počet samostatných pantů, délka jednoho (0 = automaticky), zarážka = úhel dorazu (0 = bez)
    pant: { pocet: 1, delka: 0, clanku: 5, prumer: 6.4, mezera: 0.4, odstup: 0.4, zarazka: 0 },
    // čep společný pro pant i zapínání: kovový (drát, hřebík) nebo tištěný jako samostatný díl
    cep: { druh: 'kov', prumer: 2, vule: 0.2, tesnyKonec: true, vuleTesna: 0, slza: true,
      hlavaD: 4.5, hlavaH: 1.2, zplosteni: 0.4 },
    // chlopně na kloubu u hrany víka: počet vpředu (0 = bez) a na každém boku
    // dolad: posun vnitřní plochy chlopně ke stěně (+ = větší záběr), treni: chlopeň na čepu s malou vůlí drží polohu
    zapinani: { pocet: 1, boky: 0, sirka: 20, tloustka: 2, hloubka: 0, presah: 1.4, plato: 1, pricka: 3.5, vule: 0.3, odstup: 0.4, dolad: 0, treni: false },
    // kapsy na válcové magnety: zavírání (přední rohy krabičky a víka), stohování (dno a horní plocha víka)
    magnety: { zavirani: false, stohovani: false, prumer: 6, vyska: 2, vule: 0.15 },
    // text vyrytý do horní plochy víka (obsah prázdný = bez textu)
    text: { obsah: '', velikost: 10, hloubka: 0.6, pismo: 'libsans' },
    // odhad tisku: výplň, materiál, průměrný objemový průtok tiskárny
    tisk: { vypln: 15, material: 'PLA', prutok: 6 },
  };

  const ROZSAHY = {
    'vnitrni.delka': [10, 400], 'vnitrni.sirka': [10, 400], 'vnitrni.vyska': [5, 300],
    stena: [0.8, 10], dno: [0.6, 10], zaobleni: [0, 60], segmenty: [12, 128],
    'viko.tloustka': [1, 10], 'viko.vyskaOsazeni': [0.5, 20], 'viko.stenaOsazeni': [0.6, 5], 'viko.vule': [0, 2],
    'prihradky.delka': [1, 12], 'prihradky.sirka': [1, 12], 'prihradky.tloustka': [0.6, 6], 'prihradky.vyska': [0, 300], 'prihradky.vule': [0, 1.5],
    'pant.pocet': [1, 4], 'pant.delka': [0, 400], 'pant.clanku': [3, 25], 'pant.prumer': [3, 20], 'pant.mezera': [0.1, 2], 'pant.odstup': [0.1, 2],
    'pant.zarazka': [0, 150],
    'cep.prumer': [1, 10], 'cep.vule': [0, 1], 'cep.vuleTesna': [-0.3, 0.5],
    'cep.hlavaD': [1.5, 20], 'cep.hlavaH': [0.4, 5], 'cep.zplosteni': [0, 2],
    'zapinani.pocet': [0, 4], 'zapinani.boky': [0, 2], 'zapinani.sirka': [10, 80], 'zapinani.tloustka': [1, 6], 'zapinani.hloubka': [0, 200],
    'zapinani.presah': [0.4, 4], 'zapinani.plato': [0, 6], 'zapinani.pricka': [1.5, 15], 'zapinani.vule': [0.05, 1.5],
    'zapinani.odstup': [0.1, 2], 'zapinani.dolad': [-0.6, 0.6],
    'magnety.prumer': [2, 20], 'magnety.vyska': [0.5, 10], 'magnety.vule': [0, 0.6],
    'text.velikost': [3, 60], 'text.hloubka': [0.2, 3],
    'tisk.vypln': [0, 100], 'tisk.prutok': [1, 40],
  };
  const CELA = ['segmenty', 'pant.clanku', 'pant.pocet', 'zapinani.pocet', 'zapinani.boky', 'prihradky.delka', 'prihradky.sirka'];
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 }, PETG: { nazev: 'PETG', hustota: 1.27 }, ABS: { nazev: 'ABS', hustota: 1.04 },
    ASA: { nazev: 'ASA', hustota: 1.07 }, TPU: { nazev: 'TPU', hustota: 1.21 },
  };
  const VULE_MERKY = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4];   // radiální vůle otvorů na měrce
  const RAM_OKNA = 3;          // šířka rámečku chlopně vedle okénka
  const MEZERA_PLOCHY = 0.4;   // vůle mezi deskou chlopně a články víka při otáčení
  const SRAZENI = Math.SQRT2 - 1; // srážení 45° na článcích víka: přesah za osu v násobcích poloměru
  const STENA_KAPSY = 1.2;     // materiál kolem a pod kapsou magnetu

  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }
  const cislo = (x, d) => { const n = typeof x === 'string' ? Number(x.replace(',', '.')) : Number(x); return x === null || x === '' || !Number.isFinite(n) ? d : n; };

  /** „1 1 2“, „1;1;2“ nebo „40/40/80“ → [1, 1, 2]; prázdné nebo neplatné → null. Nejvýš 12 kladných čísel. */
  function pomery(s) {
    const t = String(s == null ? '' : s).trim();
    if (!t) return null;
    const c = t.split(/[\s;/|]+/).map(x => cislo(x, NaN));
    if (!c.length || c.length > 12 || c.some(x => !(x > 0))) return null;
    return c;
  }

  /** Doplní chybějící hodnoty, převede na čísla a ořízne do rozsahů. Vrací {p, hlaseni}. */
  function normalizuj(vstup) {
    const hlaseni = [];
    const p = kopie(VYCHOZI);
    const slij = (cil, zdroj) => {
      if (!zdroj || typeof zdroj !== 'object') return;
      for (const k of Object.keys(cil)) {
        if (!(k in zdroj)) continue;
        if (cil[k] && typeof cil[k] === 'object') slij(cil[k], zdroj[k]); else cil[k] = zdroj[k];
      }
    };
    slij(p, vstup || {});
    p.nazev = String(p.nazev || VYCHOZI.nazev).slice(0, 120);
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      const puv = vezmi(p, c), vych = vezmi(VYCHOZI, c);
      let h = cislo(puv, NaN);
      if (!Number.isFinite(h)) { hlaseni.push(`${c}: neplatná hodnota „${puv}“, použito ${fmt(vych, 2)}`); h = vych; }
      if (CELA.includes(c)) h = Math.round(h);
      if (h < mn) { hlaseni.push(`${c}: ${fmt(h, 2)} je pod minimem ${fmt(mn, 2)}`); h = mn; }
      if (h > mx) { hlaseni.push(`${c}: ${fmt(h, 2)} je nad maximem ${fmt(mx, 2)}`); h = mx; }
      poloz(p, c, h);
    }
    if (p.pant.clanku % 2 === 0) { p.pant.clanku += 1; hlaseni.push(`pant.clanku: sudý počet zvýšen na ${p.pant.clanku} (krajní články patří krabičce)`); }
    if (p.pant.zarazka > 0 && p.pant.zarazka < 90) { hlaseni.push(`pant.zarazka: ${fmt(p.pant.zarazka)}° je méně než 90°, použito 90°`); p.pant.zarazka = 90; }
    if (!['kov', 'plast'].includes(p.cep.druh)) { hlaseni.push(`cep.druh: neznámý druh „${p.cep.druh}“, použit kovový`); p.cep.druh = 'kov'; }
    for (const k of ['tesnyKonec', 'slza']) p.cep[k] = !!p.cep[k];
    p.viko.osazeni = !!p.viko.osazeni;
    p.zapinani.treni = !!p.zapinani.treni;
    if (p.zapinani.dolad > p.zapinani.odstup - 0.1) {
      hlaseni.push(`zapinani.dolad: chlopeň by se dotýkala stěny – omezeno na ${fmt(p.zapinani.odstup - 0.1, 2)} mm`);
      p.zapinani.dolad = Math.round((p.zapinani.odstup - 0.1) * 100) / 100;
    }
    for (const k of ['zavirani', 'stohovani']) p.magnety[k] = !!p.magnety[k];
    if (!['pevne', 'vlozka'].includes(p.prihradky.typ)) p.prihradky.typ = 'pevne';
    for (const k of ['pomeryDelka', 'pomerySirka']) {
      const s = String(p.prihradky[k] == null ? '' : p.prihradky[k]).trim(), r = pomery(s);
      if (s && !r) hlaseni.push(`prihradky.${k}: „${s.slice(0, 40)}“ není seznam kladných čísel – použit počet přihrádek`);
      p.prihradky[k] = r ? r.join(' ') : '';
    }
    p.text.obsah = String(p.text.obsah == null ? '' : p.text.obsah).slice(0, 40);
    p.text.pismo = String(p.text.pismo || VYCHOZI.text.pismo).slice(0, 40);
    if (!MATERIALY[p.tisk.material]) p.tisk.material = 'PLA';
    return { p, hlaseni };
  }

  /** Rozdělí délku L na n článků s mezerami g, střed v x = 0. Vrací [[x0, x1], …]. */
  function clanky(L, n, g) {
    const w = (L - (n - 1) * g) / n, out = [];
    for (let i = 0; i < n; i++) { const x0 = -L / 2 + i * (w + g); out.push([x0, x0 + w]); }
    return out;
  }
  /** Rozmístí k prvků rovnoměrně na úsečce délky L se středem v 0 (každý uprostřed svého úseku). */
  const rozmisti = (k, L) => Array.from({ length: k }, (_, i) => (k === 1 ? 0 : (i + 0.5) / k * L - L / 2));
  /** Bod (x, y) místní soustavy přední stěny otočený kolem Z o phi stupňů. */
  function naSvet(phi, x, y) {
    const a = phi * Math.PI / 180, c = Math.round(Math.cos(a) * 1e12) / 1e12, s = Math.round(Math.sin(a) * 1e12) / 1e12;
    return [x * c - y * s, x * s + y * c];
  }
  /** Osy přepážek na úsečce délky L (střed 0) pro poměry šířek přihrádek; vrací {osy, min}. */
  function prepazky(L, vahy, td) {
    const n = vahy.length, celk = L - (n - 1) * td, suma = vahy.reduce((a, b) => a + b, 0), osy = [];
    let x = -L / 2;
    for (let j = 0; j < n - 1; j++) { x += celk * vahy[j] / suma; osy.push(x + td / 2); x += td; }
    return { osy, min: celk * Math.min(...vahy) / suma };
  }

  /* Zarážka víka: výstupek na článcích víka (horní plocha lícuje s víkem) dosedne při úhlu θ na polici
     pod nimi. Výstupek o poloměru Rl začíná pod úhlem a0 = asin(Rk/Rl), police má horní plochu
     Rk + mezera pod osou, dotyk při úhlu a1 = −asin((Rk + mezera)/Rl); θ = a0 − a1 klesá s Rl. */
  function zarazka(uhel, Rk, mezera) {
    const th = Rl => Math.asin(Math.min(1, Rk / Rl)) + Math.asin(Math.min(1, (Rk + mezera) / Rl));
    const cil = uhel * Math.PI / 180;
    let lo = Rk + mezera + 1e-6, hi = 20 * Rk;
    if (th(lo) < cil) return null;                    // tak velký úhel nejde
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (th(m) > cil) lo = m; else hi = m; }
    const Rl = (lo + hi) / 2, a0 = Math.asin(Rk / Rl), a1 = -Math.asin((Rk + mezera) / Rl);
    return { uhel, Rl, yHrot: Rl * Math.cos(a0), yDotyk: Rl * Math.cos(a1), zPolice: -(Rk + mezera) };
  }

  /* ---------- odvozené rozměry ---------- */
  function odvozene(p) {
    const t = p.stena, Li = p.vnitrni.delka, Wi = p.vnitrni.sirka, Hi = p.vnitrni.vyska;
    const Lo = Li + 2 * t, Wo = Wi + 2 * t, Hb = p.dno + Hi, tv = p.viko.tloustka;
    const R = Math.max(0, Math.min(p.zaobleni, Lo / 2 - 0.5, Wo / 2 - 0.5));
    const Ri = Math.max(0, R - t);
    const rovna = Lo - 2 * R, rovnaBok = Wo - 2 * R;   // rovná část přední/zadní a boční stěny
    const upravy = [];
    const Rk = p.pant.prumer / 2;
    // osy pantů a kloubů zapínání: horní plocha článků v rovině horní plochy víka (víko se tiskne převrácené)
    const zA = Hb + tv - Rk;
    const yA = Wo / 2 + p.pant.odstup + Rk;
    // více pantů: rovná část se rozdělí na stejné úseky, pant uprostřed každého
    const nP = p.pant.pocet, usek = rovna / nP;
    const maxL = nP === 1 ? rovna : usek - 2;
    let Lh = p.pant.delka > 0 ? p.pant.delka : (nP === 1 ? rovna - 4 : Math.round(usek * 0.6));
    if (Lh > maxL) {
      upravy.push({ text: nP === 1 ? `Pant (${fmt(Lh)} mm) je delší než rovná část zadní stěny – zkrácen na ${fmt(maxL)} mm.`
        : `Panty (${fmt(Lh)} mm) by se nevešly vedle sebe – zkráceny na ${fmt(maxL)} mm.`, pole: ['pant.delka', 'pant.pocet'],
      oprava: { pole: 'pant.delka', hodnota: Math.floor(maxL * 10) / 10 } });
      Lh = maxL;
    }
    let zar = null;
    if (p.pant.zarazka > 0) {
      zar = zarazka(p.pant.zarazka, Rk, MEZERA_PLOCHY);
      if (!zar) upravy.push({ text: `Zarážka na ${fmt(p.pant.zarazka)}° se s těmito články nedá udělat – vynechána.`, pole: ['pant.zarazka'], oprava: { pole: 'pant.zarazka', hodnota: 0 } });
    }
    const pant = {
      yA, zA, Rk, L: Lh, xs: rozmisti(nP, rovna), zarazka: zar,
      clanky: clanky(Lh, p.pant.clanku, p.pant.mezera).map((c, i) => ({ x0: c[0], x1: c[1], dil: i % 2 ? 'viko' : 'krabicka' })),
    };

    // zapínání (společné rozměry; strany se liší jen vzdáleností stěny W2 a rovnou délkou)
    const z = p.zapinani, gz = z.odstup, tf = z.tloustka, B = z.sirka, zF = zA;
    // spodní hrana náběhu (45°) kloubu chlopně – okénko musí zůstat pod ní i pod deskou u článků víka
    const zWeb = zF - Rk - Math.max(MEZERA_PLOCHY, 2 * Rk - tf);
    const vyskaVyst = z.plato + z.presah;             // výstupek: rovný spodek, plató, náběh 45°
    const hMin = vyskaVyst + z.vule + (Hb - zWeb);
    const pocetZap = z.pocet + 2 * z.boky;
    let hl = z.hloubka > 0 ? z.hloubka : Math.ceil(hMin * 2) / 2;
    if (hl < hMin) {
      if (pocetZap) upravy.push({ text: `Výstupek zapínání (${fmt(hl)} mm pod hranou) by zasahoval do kloubu chlopně – posunut na ${fmt(hMin, 2)} mm.`,
        pole: ['zapinani.hloubka'], oprava: { pole: 'zapinani.hloubka', hodnota: 0 } });
      hl = hMin;
    }
    const zVyst = Hb - hl;                             // spodní (záchytná) plocha výstupku
    const okno = { z0: zVyst - z.vule, z1: zVyst + vyskaVyst + z.vule, sirka: B - 2 * RAM_OKNA };
    const zSpod = okno.z0 - z.pricka;
    const vystupek = { z0: zVyst, sirka: okno.sirka - 2 * z.vule, presah: z.presah, plato: z.plato };
    const strany = [];
    const strana = (id, phi, W2, rovnaS, k) => { if (k) strany.push({ id, phi, W2, rovna: rovnaS, xs: rozmisti(k, rovnaS), yF: -(W2 + gz + Rk) }); };
    strana('predek', 0, Wo / 2, rovna, z.pocet);
    strana('vlevo', -90, Lo / 2, rovnaBok, z.boky);
    strana('vpravo', 90, Lo / 2, rovnaBok, z.boky);
    const predni = strany.find(s => s.id === 'predek');
    // nejkratší rameno od osy pantu k chlopni (rozhoduje o zdvihu při kontrole zajištění)
    let rameno = Infinity;
    for (const s of strany) for (const x of s.xs) rameno = Math.min(rameno, yA - naSvet(s.phi, x, s.yF - tf)[1]);
    const zap = {
      zF, Rk, sirka: B, gz, tf, hloubka: hl, okno, zSpod, vystupek, zWeb, strany, pocet: pocetZap, rameno,
      xs: predni ? predni.xs : [], yF: -(Wo / 2 + gz + Rk),
      clanky: clanky(B, 3, p.pant.mezera).map((c, i) => ({ x0: c[0], x1: c[1], dil: i === 1 ? 'chlopen' : 'viko' })),
    };

    // přihrádky: pevné přepážky v dutině, nebo vyjímatelná vložka (rámeček s přepážkami bez dna)
    const ph = p.prihradky, td = ph.tloustka, vlozka = ph.typ === 'vlozka', vl = vlozka ? ph.vule : 0;
    const Lp = Li - 2 * (vl + (vlozka ? td : 0)), Wp = Wi - 2 * (vl + (vlozka ? td : 0));
    const vahyX = pomery(ph.pomeryDelka) || Array(ph.delka).fill(1), vahyY = pomery(ph.pomerySirka) || Array(ph.sirka).fill(1);
    const px = prepazky(Lp, vahyX, td), py = prepazky(Wp, vahyY, td);
    const vyskaAuto = Hi - (p.viko.osazeni ? p.viko.vyskaOsazeni : 0) - 0.5;
    const prihradky = {
      typ: ph.typ, xs: px.osy, ys: py.osy, td, vyska: ph.vyska > 0 ? Math.min(ph.vyska, Hi) : vyskaAuto, vyskaAuto,
      sirkaX: px.min, sirkaY: py.min, pocetX: vahyX.length, pocetY: vahyY.length,
      vnejsi: [Li - 2 * vl, Wi - 2 * vl], rVnejsi: Math.max(0, Ri - vl),
    };
    prihradky.ma = vlozka || prihradky.xs.length > 0 || prihradky.ys.length > 0;

    // magnety: kapsa = magnet + vůle; zavírání v předních vnitřních rozích, stohování ve čtyřech rozích
    const mg = p.magnety, rm = mg.prumer / 2 + mg.vule, hk = mg.vyska + 0.1, rb = rm + STENA_KAPSY;
    const e = Math.max(0, hk + 0.5 - tv);              // o kolik musí kapsa ve víku vystoupit pod víko
    const magnety = {
      rm, hk, rb, e,
      zavirani: mg.zavirani ? {
        rohy: [-1, 1].map(sx => [sx * (Li / 2 - rb), -(Wi / 2 - rb)]),
        zVrchKrab: Hb - (e > 0 ? e + 0.2 : 0),         // horní plocha sloupku s kapsou v krabičce
      } : null,
      stohovani: mg.stohovani ? { rohy: [], c: Math.max(rm + STENA_KAPSY, R) } : null,
    };
    if (magnety.stohovani) {
      const c = magnety.stohovani.c;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) magnety.stohovani.rohy.push([sx * (Lo / 2 - c), sy * (Wo / 2 - c)]);
    }

    const cep = { r: p.cep.prumer / 2, rd: p.cep.prumer / 2 + p.cep.vule, rt: p.cep.prumer / 2 + (p.cep.tesnyKonec ? p.cep.vuleTesna : p.cep.vule) };
    const vyskaChl = Math.max(gz + 2 * Rk, gz + tf + 2);          // jak daleko chlopeň vystupuje před stěnu
    const zadek = Math.max(yA + Rk * (1 + SRAZENI), zar ? yA + Math.max(zar.yHrot, zar.yDotyk + 1.5) : 0);
    const predek = predni ? -(Wo / 2 + vyskaChl) : -Wo / 2;
    const celkem = [Lo + (z.boky ? 2 * vyskaChl : 0), zadek - predek, Hb + tv];
    return {
      t, Li, Wi, Hi, Lo, Wo, Hb, tv, R, Ri, rovna, rovnaBok, pant, zap, prihradky, magnety, cep, celkem, upravy,
      SRAZENI, MEZERA_PLOCHY, STENA_KAPSY,
    };
  }

  /* ---------- kontroly návrhu ----------
     Každé hlášení: {uroven, text, pole: [cesty parametrů, kterých se týká], oprava?: {pole, hodnota}} –
     stránka podle pole skočí na příslušné políčko a opravu umí jedním klikem použít.
     doplnky.textRozmer = [šířka, výška] obrysu textu v mm (spočítá stránka z písma). */
  function kontroly(p, o = odvozene(p), doplnky = {}) {
    const h = [];
    const add = (uroven, text, pole = [], oprava = null) => h.push(oprava ? { uroven, text, pole, oprava } : { uroven, text, pole });
    const nahoru = (x, krok) => Math.ceil(x / krok - 1e-9) * krok;
    const dolu = (x, krok) => Math.floor(x / krok + 1e-9) * krok;
    const zaokr = x => Math.round(x * 100) / 100;
    for (const u of o.upravy) add('info', u.text, u.pole, u.oprava);
    const { Rk } = o.pant, c = o.cep;
    // slzičkový otvor má špičku ve vzdálenosti r·√2 od osy
    const krat = p.cep.slza ? Math.SQRT2 : 1;
    const stenaKloubu = Rk - Math.max(c.rd, c.rt) * krat;
    const prumerKloubu = zaokr(nahoru(2 * (Math.max(c.rd, c.rt) * krat + 1.2), 0.2));
    if (stenaKloubu < 0.8) add('chyba', `Stěna článku kolem čepu je jen ${fmt(stenaKloubu, 2)} mm – zvětšete průměr článku nebo zmenšete čep.`,
      ['pant.prumer', 'cep.prumer'], { pole: 'pant.prumer', hodnota: prumerKloubu });
    else if (stenaKloubu < 1.2) add('varovani', `Stěna článku kolem čepu ${fmt(stenaKloubu, 2)} mm je tenká (doporučeno ≥ 1,2 mm, tj. 3 perimetry).`,
      ['pant.prumer', 'cep.prumer'], { pole: 'pant.prumer', hodnota: prumerKloubu });
    const sirkaPant = o.pant.clanky[0].x1 - o.pant.clanky[0].x0;
    if (sirkaPant < 3) {
      let n = Math.floor((o.pant.L + p.pant.mezera) / (3 + p.pant.mezera)); if (n % 2 === 0) n--;
      add('chyba', `Články pantu jsou úzké (${fmt(sirkaPant, 2)} mm) – snižte jejich počet.`, ['pant.clanku', 'pant.delka'],
        n >= 3 ? { pole: 'pant.clanku', hodnota: n } : null);
    }
    if (p.cep.druh === 'plast' && p.cep.prumer < 2.5) add('varovani', `Tištěný čep Ø ${fmt(p.cep.prumer, 2)} mm je křehký – doporučeno aspoň 2,5–3 mm (nebo kovový).`, ['cep.prumer', 'cep.druh']);
    if (p.cep.druh === 'plast' && p.cep.hlavaD <= 2 * c.rd) add('chyba', 'Hlava tištěného čepu není větší než otvor – čep by propadl.',
      ['cep.hlavaD'], { pole: 'cep.hlavaD', hodnota: zaokr(nahoru(2 * c.rd + 1.5, 0.5)) });
    if (Rk < o.tv) add('info', 'Články jsou tenčí než víko – osa pantu leží nad horní hranou stěn.', ['pant.prumer', 'viko.tloustka']);
    if (o.pant.zarazka) {
      const zr = o.pant.zarazka;
      if (o.pant.zA + zr.zPolice - 1.6 < 1) add('chyba', 'Police zarážky by sahala pod dno – krabička je na zarážku příliš nízká.', ['pant.zarazka', 'vnitrni.vyska'], { pole: 'pant.zarazka', hodnota: 0 });
      else add('info', `Zarážka: víko se zastaví zhruba na ${fmt(zr.uhel)}° (výstupek na článcích víka dosedne na polici pod nimi).`, ['pant.zarazka']);
    }
    const zap = o.zap;
    if (!zap.pocet && !p.magnety.zavirani) add('info', 'Bez zapínání – víko drží jen vlastní vahou a třením v osazení.', ['zapinani.pocet', 'zapinani.boky', 'magnety.zavirani']);
    if (zap.pocet) {
      const sirkaZap = zap.clanky[0].x1 - zap.clanky[0].x0;
      const minSirka = Math.max(10, nahoru(3 * 3 + 2 * p.pant.mezera, 1), 2 * 3 + 4);
      if (sirkaZap < 3) add('chyba', `Články zapínání jsou úzké (${fmt(sirkaZap, 2)} mm) – rozšiřte chlopeň.`, ['zapinani.sirka'], { pole: 'zapinani.sirka', hodnota: minSirka });
      if (zap.okno.sirka < 4) add('chyba', 'Chlopeň je na okénko a výstupek příliš úzká (okénko užší než 4 mm).', ['zapinani.sirka'], { pole: 'zapinani.sirka', hodnota: minSirka });
      const tol = toleranceZapinani(p);
      if (tol.zaber < 0.5) add('chyba', `Výstupek přesahuje chlopeň jen o ${fmt(tol.zaber, 2)} mm – zapínání nebude držet (zvětšete přesah nebo doladění záběru).`,
        ['zapinani.presah', 'zapinani.dolad', 'zapinani.odstup'], { pole: 'zapinani.presah', hodnota: zaokr(nahoru(p.zapinani.presah + 0.9 - tol.zaber, 0.1)) });
      else if (tol.zaberMin < 0.3) {
        const dolad = zaokr(Math.min(p.zapinani.odstup - 0.1, nahoru(p.zapinani.dolad + 0.3 - tol.zaberMin + 0.01, 0.05)));
        add('varovani', `Při vůli čepů může záběr klesnout na ${fmt(tol.zaberMin, 2)} mm – chlopeň může vyskočit. Zvětšete doladění záběru nebo zmenšete vůli čepu.`,
          ['zapinani.dolad', 'cep.vule', 'zapinani.presah'], dolad > p.zapinani.dolad ? { pole: 'zapinani.dolad', hodnota: dolad } : null);
      }
      if (p.zapinani.vule < 0.15) add('varovani', `Vůle okénka ${fmt(p.zapinani.vule, 2)} mm je malá – tisk otvory zužuje, chlopeň nemusí přes výstupek zapadnout.`,
        ['zapinani.vule'], { pole: 'zapinani.vule', hodnota: 0.2 });
      if (p.zapinani.presah > 2) add('varovani', `Výstupek má rovný spodek s převisem ${fmt(p.zapinani.presah, 1)} mm – nad 2 mm může při tisku bez podpěr prověsit.`,
        ['zapinani.presah'], { pole: 'zapinani.presah', hodnota: 2 });
      if (zap.zSpod < 0.5) add('chyba', `Chlopeň zapínání sahá pod dno krabičky (spodní hrana ${fmt(zap.zSpod, 1)} mm) – zvětšete výšku krabičky nebo zmenšete hloubku zapínání.`,
        ['vnitrni.vyska', 'zapinani.hloubka', 'zapinani.pricka'], { pole: 'vnitrni.vyska', hodnota: nahoru(p.vnitrni.vyska + 0.5 - zap.zSpod, 1) });
      if (zap.vystupek.z0 < p.dno) add('varovani', 'Výstupek zapínání je níž než horní plocha dna.', ['vnitrni.vyska', 'zapinani.hloubka'],
        { pole: 'vnitrni.vyska', hodnota: nahoru(p.vnitrni.vyska + p.dno - zap.vystupek.z0, 1) });
      // zapínání musí ležet na rovné části stěny a nesmí se překrývat
      for (const s of zap.strany) {
        const predni = s.id === 'predek', kde = predni ? 'přední stěny' : 'boční stěny', poc = predni ? 'zapinani.pocet' : 'zapinani.boky';
        const maxSirka = dolu(Math.min(s.rovna / s.xs.length - 2, s.rovna), 1);
        const opravaSirky = maxSirka >= 10 ? { pole: 'zapinani.sirka', hodnota: maxSirka } : { pole: poc, hodnota: s.xs.length - 1 };
        if (Math.max(...s.xs.map(x => Math.abs(x))) + zap.sirka / 2 > s.rovna / 2 + 1e-6) add('chyba', `Chlopně zapínání se nevejdou na rovnou část ${kde} – zmenšete jejich šířku nebo počet.`, ['zapinani.sirka', poc], opravaSirky);
        else if (s.xs.length > 1 && s.xs[1] - s.xs[0] < zap.sirka + 2) add('chyba', `Chlopně zapínání na ${predni ? 'přední' : 'boční'} stěně se navzájem překrývají.`, ['zapinani.sirka', poc], opravaSirky);
      }
    }
    const pr = o.prihradky;
    if (pr.ma) {
      if (Math.min(pr.sirkaX, pr.sirkaY) < 5) add('chyba', `Přihrádky jsou příliš úzké (${fmt(Math.min(pr.sirkaX, pr.sirkaY), 1)} mm) – snižte jejich počet.`,
        pr.sirkaX < pr.sirkaY ? ['prihradky.delka', 'prihradky.pomeryDelka'] : ['prihradky.sirka', 'prihradky.pomerySirka']);
      if (pr.vyska > pr.vyskaAuto + 1e-6) add('chyba', `Přepážky (${fmt(pr.vyska, 1)} mm) jsou vyšší než ${fmt(pr.vyskaAuto, 1)} mm – narazí na víko nebo jeho osazení.`,
        ['prihradky.vyska'], { pole: 'prihradky.vyska', hodnota: 0 });
      if (pr.td < 0.8) add('varovani', `Přepážky ${fmt(pr.td, 2)} mm jsou tenké – tiskárna je vytiskne jen jedním perimetrem.`, ['prihradky.tloustka'], { pole: 'prihradky.tloustka', hodnota: 1.2 });
      if (pr.typ === 'vlozka' && !pr.xs.length && !pr.ys.length) add('info', 'Vložka bez přepážek je jen rámeček – nastavte počet nebo poměry přihrádek.', ['prihradky.delka', 'prihradky.sirka']);
      if (pr.typ === 'vlozka' && p.magnety.zavirani) add('chyba', 'Vložka se s magnety na zavírání nesnese – sloupky s kapsami jsou v rozích dutiny.',
        ['prihradky.typ', 'magnety.zavirani'], { pole: 'prihradky.typ', hodnota: 'pevne' });
    }
    const m = o.magnety;
    if (m.zavirani) {
      const vyskaSloupku = m.hk + STENA_KAPSY + 2.5 * m.rb;
      if (vyskaSloupku > o.Hi) add('varovani', `Sloupky s kapsami na magnety (${fmt(vyskaSloupku, 1)} mm se šikmým spodkem) jsou vyšší než dutina – dosednou na dno.`, ['magnety.prumer', 'vnitrni.vyska']);
      if (m.e > 0) add('info', `Víko je na magnet ${fmt(p.magnety.vyska, 1)} mm tenké – kapsa vystoupí ${fmt(m.e, 1)} mm pod víko jako sloupek.`, ['viko.tloustka', 'magnety.vyska']);
      if (2 * m.rb > Math.min(o.Li, o.Wi) / 2) add('chyba', 'Magnety na zavírání jsou na tuto krabičku příliš velké.', ['magnety.prumer']);
    }
    if (m.stohovani) {
      if (p.dno < m.hk + 0.5) add('chyba', `Na kapsy pro stohování je dno tenké – potřeba aspoň ${fmt(m.hk + 0.5, 1)} mm (magnet ${fmt(p.magnety.vyska, 1)} mm + 0,6 mm).`,
        ['dno', 'magnety.vyska'], { pole: 'dno', hodnota: zaokr(nahoru(m.hk + 0.5, 0.1)) });
      if (o.tv < m.hk + 0.5) add('chyba', `Na kapsy pro stohování je víko tenké – potřeba aspoň ${fmt(m.hk + 0.5, 1)} mm.`,
        ['viko.tloustka', 'magnety.vyska'], { pole: 'viko.tloustka', hodnota: zaokr(nahoru(m.hk + 0.5, 0.1)) });
      if (m.zavirani && o.tv < 2 * m.hk + 0.6) add('varovani', 'Kapsy pro stohování a pro zavírání jsou ve víku blízko sebe – zkontrolujte řez.', ['viko.tloustka']);
    }
    if (p.text.obsah.trim()) {
      if (p.text.hloubka > o.tv - 0.6 + 1e-9) add('chyba', `Text hluboký ${fmt(p.text.hloubka, 1)} mm by víko skoro prorazil – nejvýš ${fmt(o.tv - 0.6, 1)} mm.`,
        ['text.hloubka'], { pole: 'text.hloubka', hodnota: zaokr(Math.max(0.2, dolu(o.tv - 0.6, 0.1))) });
      const tr = doplnky.textRozmer, sw = o.Lo - 2 * o.R - 4, sh = o.Wo - 2 * o.R - 4;
      if (tr && (tr[0] > sw || tr[1] > sh)) add('varovani', `Text (${fmt(tr[0], 1)} × ${fmt(tr[1], 1)} mm) přesahuje horní plochu víka – zmenšete písmo.`,
        ['text.velikost', 'text.obsah'], { pole: 'text.velikost', hodnota: Math.max(3, dolu(p.text.velikost * Math.min(sw / tr[0], sh / tr[1]), 0.5)) });
    }
    if (p.viko.osazeni && p.viko.vyskaOsazeni > o.Hi - 1) add('chyba', 'Osazení víka je vyšší než dutina krabičky.', ['viko.vyskaOsazeni'], { pole: 'viko.vyskaOsazeni', hodnota: Math.max(0.5, dolu(o.Hi - 1.5, 0.5)) });
    if (p.viko.osazeni && 2 * (p.viko.vule + p.viko.stenaOsazeni) > Math.min(o.Li, o.Wi) - 4) add('chyba', 'Osazení víka se do dutiny nevejde.', ['viko.stenaOsazeni', 'viko.osazeni'], { pole: 'viko.osazeni', hodnota: false });
    if (o.t < 1.2) add('varovani', `Stěna ${fmt(o.t, 2)} mm je tenká – výstupek zapínání a články pantu ji namáhají.`, ['stena'], { pole: 'stena', hodnota: 1.6 });
    return h;
  }

  /* ---------- tolerance zapínání ----------
     záběr = jak daleko výstupek zasahuje za vnitřní plochu chlopně; vůle čepů (zapínání i pantu) ho mohou
     zmenšit až o 2 × radiální vůli. Hra víka = o kolik se zavřené víko zvedne, než se příčka zapře. */
  function toleranceZapinani(p, vule = p.zapinani.vule, dolad = p.zapinani.dolad) {
    const zaber = p.zapinani.presah - (p.zapinani.odstup - dolad);
    const zaberMin = zaber - 2 * p.cep.vule;
    const hra = vule + p.cep.vule;
    let verdikt = 'ok';
    if (zaberMin < 0.3) verdikt = 'volne';
    else if (vule < 0.15) verdikt = 'tesne';
    return { zaber, zaberMin, hra, verdikt };
  }
  /** Sada 5 zkušebních chlopní od nejtužší (1) po nejvolnější (5); 3 = současné nastavení.
      Krok: vůle okénka ±0,1 mm a doladění záběru ∓0,1 mm. */
  function variantyChlopni(p) {
    const z = p.zapinani, out = [];
    for (let i = 1; i <= 5; i++) {
      const vule = Math.max(0.05, Math.round((z.vule + (i - 3) * 0.1) * 100) / 100);
      const dolad = Math.max(-0.6, Math.min(z.odstup - 0.1, Math.round((z.dolad - (i - 3) * 0.1) * 100) / 100));
      out.push(Object.assign({ i, vule, dolad }, toleranceZapinani(p, vule, dolad)));
    }
    return out;
  }

  /* ---------- text na víko ----------
     Obrysy textu z opentype.js Font: křivky se rozdělí na úsečky, výška velkých písmen = velikost,
     střed obrysu v počátku, osa Y nahoru. Otvory písmen mají opačný směr obrysu (výplň NonZero). */
  function textNaObrysy(font, text, velikost) {
    const em = font.unitsPerEm || 1000;
    const cap = (font.tables && font.tables.os2 && font.tables.os2.sCapHeight) || 0.7 * em;
    const vel = velikost * em / cap;
    const cesta = font.getPath(text, 0, 0, vel, { kerning: true });
    const obrysy = []; let akt = null, x0 = 0, y0 = 0;
    const KROKU = 8;
    const bod = (x, y) => akt.push([x, -y]);
    for (const c of cesta.commands) {
      if (c.type === 'M') { akt = []; obrysy.push(akt); bod(c.x, c.y); x0 = c.x; y0 = c.y; }
      else if (c.type === 'L') { bod(c.x, c.y); x0 = c.x; y0 = c.y; }
      else if (c.type === 'Q') {
        for (let i = 1; i <= KROKU; i++) { const t = i / KROKU, u = 1 - t; bod(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); }
        x0 = c.x; y0 = c.y;
      } else if (c.type === 'C') {
        for (let i = 1; i <= KROKU; i++) {
          const t = i / KROKU, u = 1 - t;
          bod(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y);
        }
        x0 = c.x; y0 = c.y;
      }
    }
    const platne = obrysy.filter(o => o.length >= 3);
    if (!platne.length) return { obrysy: [], rozmer: [0, 0] };
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const o of platne) for (const [x, y] of o) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    return { obrysy: platne.map(o => o.map(([x, y]) => [x - cx, y - cy])), rozmer: [b[2] - b[0], b[3] - b[1]] };
  }

  /* ---------- tiskové polohy ----------
     krabička a vložka dnem dolů, víko převrácené horní plochou dolů, chlopeň vnitřní plochou dolů,
     čepy naležato zploštěním dolů a měrka (tak už jsou postavené). */
  function otoc(sit, f) {
    const P = sit.poz, poz = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { const q = f(P[i], P[i + 1], P[i + 2]); poz[i] = q[0]; poz[i + 1] = q[1]; poz[i + 2] = q[2]; }
    return { poz, idx: sit.idx };
  }
  const POLOHY = {
    krabicka: (x, y, z) => [x, y, z],
    viko: (x, y, z) => [x, -y, -z],          // 180° kolem X
    chlopen: (x, y, z) => [x, z, -y],         // −90° kolem X: vnitřní plocha (normála +Y) na podložku
  };
  /** Díly [{jmeno, poz, idx, ...}] (opakované kusy už rozkopírované) → vedle sebe na z = 0. */
  function tiskoveRozlozeni(dily, mezera = 8) {
    const out = []; let y = 0;
    for (const d of dily) {
      let s = otoc(d, POLOHY[d.jmeno] || POLOHY.krabicka);
      const b = KRAB.obal(s.poz);
      s = KRAB.presun(s, -(b[0] + b[3]) / 2, y - b[1], -b[2]);
      out.push(Object.assign({}, d, s));
      y += b[4] - b[1] + mezera;
    }
    const sir = y - mezera;
    return out.map(d => Object.assign({}, d, KRAB.presun(d, 0, -sir / 2, 0)));
  }

  /* ---------- odhad tisku ----------
     Hrubý odhad z objemu a povrchu dílu: obal 1,2 mm (perimetry + horní a spodní vrstvy) plný,
     zbytek s výplní; čas = objem / průtok × 1,3 (přejezdy, zrychlení). */
  function odhadTisku(objem, plocha, tisk) {
    const obal = Math.min(objem, plocha * 1.2);
    const v = obal + (objem - obal) * tisk.vypln / 100;           // mm³ tištěného plastu
    const g = v / 1000 * MATERIALY[tisk.material].hustota;
    const m = v / (Math.PI * 0.875 * 0.875) / 1000;               // filament 1,75 mm
    const min = v / tisk.prutok * 1.3 / 60;
    return { objem: v, g, m, min };
  }

  /* ---------- kusovník ---------- */
  function kusovnik(p, o = odvozene(p)) {
    const k = o.zap.pocet, nP = p.pant.pocet, d = fmt(p.cep.prumer, 2);
    const r = [
      { co: 'Krabička', ks: 1, tisk: 'dnem dolů' },
      { co: 'Víko', ks: 1, tisk: 'převrácené, horní plochou dolů' },
    ];
    if (o.prihradky.typ === 'vlozka') r.push({ co: 'Vložka s přihrádkami', ks: 1, tisk: 'dnem dolů (je bez dna, stojí na stěnách)' });
    if (k) r.push({ co: 'Chlopeň zapínání', ks: k, tisk: 'vnitřní plochou dolů' });
    if (p.cep.druh === 'plast') {
      r.push({ co: `Čep pantu Ø ${d} × ${fmt(o.pant.L, 1)} mm`, ks: nP, tisk: 'naležato, zploštěním dolů' });
      if (k) r.push({ co: `Čep zapínání Ø ${d} × ${fmt(o.zap.sirka, 1)} mm`, ks: k, tisk: 'naležato, zploštěním dolů' });
    } else {
      r.push({ co: `Kovový čep pantu Ø ${d} mm, délka ${fmt(o.pant.L, 1)} mm`, ks: nP, tisk: 'drát nebo hřebík zkrátit na délku, konce zabrousit' });
      if (k) r.push({ co: `Kovový čep zapínání Ø ${d} mm, délka ${fmt(o.zap.sirka, 1)} mm`, ks: k, tisk: 'drát, hřebík nebo kus filamentu 1,75 mm' });
    }
    const mg = p.magnety, nm = (mg.zavirani ? 4 : 0) + (mg.stohovani ? 8 : 0);
    if (nm) r.push({ co: `Magnet Ø ${fmt(mg.prumer, 1)} × ${fmt(mg.vyska, 1)} mm`, ks: nm,
      tisk: (mg.zavirani ? '4 na zavírání (2 do krabičky, 2 do víka)' : '') + (mg.zavirani && mg.stohovani ? ', ' : '')
        + (mg.stohovani ? '8 na stohování (4 do dna, 4 do víka)' : '') + ' – vlepit, pozor na polaritu' });
    return r;
  }

  /* ---------- varianty (předvolby) ----------
     Každá vychází z výchozích hodnot; druh čepu a tiskové vůle uživatele se zachovají. */
  const VARIANTY = {
    zakladni: { nazev: 'Základní krabička', popis: '100 × 60 × 35 mm, jeden průběžný pant, jedna chlopeň', uprav: () => {} },
    sperkovnice: { nazev: 'Šperkovnice', popis: '120 × 80 × 35 mm, vložka s přihrádkami 1 : 2 : 1 × 2, 2 panty, zarážka 105°',
      uprav: q => { q.vnitrni = { delka: 120, sirka: 80, vyska: 35 }; q.zaobleni = 8; q.prihradky.pomeryDelka = '1 2 1'; q.prihradky.sirka = 2; q.prihradky.typ = 'vlozka'; q.pant.pocet = 2; q.pant.zarazka = 105; } },
    karty: { nazev: 'Krabička na hrací karty', popis: 'na balíček 63 × 88 mm (karty v obalech), magnety místo chlopně',
      uprav: q => { q.vnitrni = { delka: 94, sirka: 69, vyska: 30 }; q.zaobleni = 3; q.zapinani.pocet = 0; q.magnety.zavirani = true; } },
    penal: { nazev: 'Penál na tužky', popis: '200 × 40 × 25 mm, 2 panty, chlopně na bocích',
      uprav: q => { q.vnitrni = { delka: 200, sirka: 40, vyska: 25 }; q.pant.pocet = 2; q.zapinani.pocet = 0; q.zapinani.boky = 1; q.zapinani.sirka = 18; } },
    organizer: { nazev: 'Organizér na šroubky', popis: '160 × 100 × 30 mm, 4 × 3 přihrádky (širší vpravo), 2 panty, 2 chlopně',
      uprav: q => { q.vnitrni = { delka: 160, sirka: 100, vyska: 30 }; q.prihradky.pomeryDelka = '1 1 1 2'; q.prihradky.sirka = 3; q.pant.pocet = 2; q.zapinani.pocet = 2; } },
    stohovaci: { nazev: 'Stohovací box', popis: '120 × 80 × 40 mm, magnety na stohování ve dně a víku, 2 chlopně',
      uprav: q => { q.vnitrni = { delka: 120, sirka: 80, vyska: 40 }; q.dno = 2.6; q.viko.tloustka = 2.8; q.pant.prumer = 7.2; q.zapinani.pocet = 2; q.magnety.stohovani = true; } },
    mala: { nazev: 'Malá krabička', popis: '40 × 30 × 18 mm, 3 články, užší chlopeň',
      uprav: q => { q.vnitrni = { delka: 40, sirka: 30, vyska: 18 }; q.zaobleni = 3; q.pant.clanku = 3; q.zapinani.sirka = 14; } },
    velka: { nazev: 'Velký box', popis: '220 × 140 × 80 mm, silnější stěny, 3 panty, 2 chlopně vpředu a po jedné na bocích',
      uprav: q => { q.vnitrni = { delka: 220, sirka: 140, vyska: 80 }; q.stena = 2.4; q.dno = 2; q.viko.tloustka = 3; q.pant.pocet = 3; q.pant.prumer = 7.2; q.zapinani.pocet = 2; q.zapinani.boky = 1; q.zapinani.sirka = 24; } },
  };
  function varianta(klic, puvodni) {
    const q = kopie(VYCHOZI);
    VARIANTY[klic].uprav(q);
    q.nazev = VARIANTY[klic].nazev;
    if (puvodni) {
      q.cep = kopie(puvodni.cep); q.segmenty = puvodni.segmenty; q.tisk = kopie(puvodni.tisk);
      if (q.cep.druh === 'plast') q.pant.prumer = Math.max(q.pant.prumer, puvodni.pant.prumer);
    }
    return normalizuj(q).p;
  }

  /* ---------- projekt JSON ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: FORMAT, verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object' || o.format !== FORMAT) throw new Error(`Soubor není projekt krabičky s víčkem (chybí "format": "${FORMAT}").`);
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const API = {
    VYCHOZI, ROZSAHY, VERZE_FORMATU, FORMAT, VARIANTY, MATERIALY, VULE_MERKY, varianta, normalizuj, odvozene, kontroly,
    clanky, rozmisti, naSvet, pomery, prepazky, zarazka, textNaObrysy, odhadTisku, toleranceZapinani, variantyChlopni,
    POLOHY, otoc, tiskoveRozlozeni, kusovnik, ulozProjekt, nactiProjekt, fmt, kopie,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KPANT = API;
})();
