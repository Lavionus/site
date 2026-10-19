/* ============================================================
   bunecne_automaty/jadro.js – výpočetní jádro laboratoře buněčných
   automatů. Čistý modul bez DOM: běží v hlavním vlákně, ve Web Workeru
   i v node (testy _test/bunecne_automaty_test.js).

   Obsah:
     parsujPravidlo / formatujPravidlo  – zápis B/S, S/B („23/3“),
                                           Generations (B2/S/C3), W30, WireWorld
     Svet                               – mřížka nad Uint8Array s okrajem
                                           (dvojitý buffer), krok, okrajové podmínky
     Historie                           – kruhový buffer stavů s limitem paměti
     parsujRLE / zapisRLE / parsujVzor  – RLE (Golly), .cells, Life 1.06, JSON
     Motor                              – zpracování zpráv (Worker i záložní běh)

   Buňky jsou uloženy s jednobuněčným okrajem: šířka řádku P = W + 2,
   řádků H + 2. Okraj se před každým krokem doplní podle okrajové
   podmínky, takže vnitřní smyčka nemá žádné větvení na hranách.
   ============================================================ */
(function () {
'use strict';

// ---------------------------------------------------------------- pravidla
const ZNAMA_PRAVIDLA = [
  { nazev: 'Conwayův Život (Game of Life)', zapis: 'B3/S23', popis: 'Klasika J. H. Conwaye (1970): zrod při 3 sousedech, přežití při 2–3.' },
  { nazev: 'HighLife', zapis: 'B36/S23', popis: 'Nathan Thompson (1994); navíc zrod při 6 sousedech – existuje replikátor.' },
  { nazev: 'Seeds', zapis: 'B2/S', popis: 'Brian Silverman; žádná buňka nepřežije, přesto vzniká bouřlivý růst.' },
  { nazev: 'Day & Night', zapis: 'B3678/S34678', popis: 'Nathan Thompson (1997); symetrické vůči záměně živé a mrtvé.' },
  { nazev: 'Život bez smrti', zapis: 'B3/S012345678', popis: 'Živé buňky nikdy neumírají – roste „inkoust“.' },
  { nazev: 'Bludiště (Maze)', zapis: 'B3/S12345', popis: 'Vytváří chodby podobné bludišti.' },
  { nazev: 'Replikátor (Fredkin)', zapis: 'B1357/S1357', popis: 'Edward Fredkin: každý vzor se po čase zkopíruje.' },
  { nazev: '2×2', zapis: 'B36/S125', popis: 'Vzory složené z bloků 2×2 se chovají jako v hrubší mřížce.' },
  { nazev: '34 Life', zapis: 'B34/S34', popis: 'Bohaté na malé oscilátory a lodě.' },
  { nazev: 'Diamoeba', zapis: 'B35678/S5678', popis: 'Velké „améby“ s diamantovými okraji.' },
  { nazev: 'Morley (Move)', zapis: 'B368/S245', popis: 'Stephen Morley; mnoho vesmírných lodí.' },
  { nazev: 'Žíhání (Anneal)', zapis: 'B4678/S35678', popis: 'Většinové hlasování s šumem – oblasti se vyhlazují.' },
  { nazev: 'Korály (Coral)', zapis: 'B3/S45678', popis: 'Pomalý růst korálovitých útvarů.' },
  { nazev: 'Brianův mozek (Brian\'s Brain)', zapis: 'B2/S/C3', popis: 'Brian Silverman; tři stavy (živá, umírající, mrtvá), téměř samé lodě.' },
  { nazev: 'Star Wars', zapis: 'B2/S345/C4', popis: 'Mirek Wójtowicz; Generations se 4 stavy.' },
  { nazev: 'Wireworld', zapis: 'WireWorld', popis: 'Brian Silverman (1987): elektrony ve vodičích, logická hradla.' },
  { nazev: 'Wolframovo pravidlo 30', zapis: 'W30', popis: 'Jednorozměrný chaotický automat (S. Wolfram, 1983).' },
  { nazev: 'Wolframovo pravidlo 90', zapis: 'W90', popis: 'XOR sousedů – Sierpińského trojúhelník.' },
  { nazev: 'Wolframovo pravidlo 110', zapis: 'W110', popis: 'Turingovsky úplné (M. Cook, publikováno 2004).' },
  { nazev: 'Wolframovo pravidlo 184', zapis: 'W184', popis: 'Model dopravy – auta jedou doprava, pokud je volno.' },
];

const ALIASY = {
  life: 'B3/S23', conway: 'B3/S23', gameoflife: 'B3/S23', zivot: 'B3/S23', 'život': 'B3/S23',
  highlife: 'B36/S23', seeds: 'B2/S', daynight: 'B3678/S34678', 'day&night': 'B3678/S34678',
  maze: 'B3/S12345', replicator: 'B1357/S1357', '2x2': 'B36/S125', '34life': 'B34/S34',
  diamoeba: 'B35678/S5678', morley: 'B368/S245', move: 'B368/S245', anneal: 'B4678/S35678',
  coral: 'B3/S45678', lifewithoutdeath: 'B3/S012345678', briansbrain: 'B2/S/C3', "brian'sbrain": 'B2/S/C3',
  starwars: 'B2/S345/C4', wireworld: 'WireWorld',
};

function chybaPravidla(vstup) {
  return new Error('Neznámý zápis pravidla „' + vstup + '“. Použijte např. B3/S23, 23/3 (S/B), B2/S/C3 (Generations), W30 nebo WireWorld.');
}

/** Rozebere textový zápis pravidla. Vrací
 *  {typ:'life', narozeni:bool[9], preziti:bool[9], stavy, okoli:'M'|'V'}
 *  {typ:'wireworld'} nebo {typ:'wolfram', cislo}. Při chybě vyhodí Error s českou zprávou. */
function parsujPravidlo(vstup) {
  if (typeof vstup !== 'string') throw new Error('Pravidlo musí být zadáno textem.');
  const puvodni = vstup.trim();
  if (!puvodni) throw new Error('Zadejte pravidlo, např. B3/S23.');
  let t = puvodni.replace(/\s+/g, '');
  const a = ALIASY[t.toLowerCase()];
  if (a) t = a;
  if (/^wireworld$/i.test(t)) return { typ: 'wireworld' };
  let m = /^(?:w|r|rule|pravidlo)(\d{1,4})$/i.exec(t);
  if (m) {
    const n = Number(m[1]);
    if (n > 255) throw new Error('Elementární Wolframova pravidla mají čísla 0–255 (zadáno ' + n + ').');
    return { typ: 'wolfram', cislo: n };
  }
  t = t.toUpperCase();
  let okoli = 'M';
  if (/[0-9\/SBC]H$/.test(t)) throw new Error('Hexagonální okolí (přípona H) laboratoř nepodporuje.');
  if (/[0-9\/SBC][MV]$/.test(t)) { okoli = t.slice(-1); t = t.slice(0, -1); }
  let B, S, C = '2';
  if ((m = /^B([0-9]*)\/?S([0-9]*)(?:\/?[CG]([0-9]+))?$/.exec(t))) { B = m[1]; S = m[2]; C = m[3] || '2'; }
  else if ((m = /^S([0-9]*)\/?B([0-9]*)(?:\/?[CG]([0-9]+))?$/.exec(t))) { S = m[1]; B = m[2]; C = m[3] || '2'; }
  else if ((m = /^([0-9]*)\/([0-9]*)(?:\/([0-9]+))?$/.exec(t))) { S = m[1]; B = m[2]; C = m[3] || '2'; }
  else throw chybaPravidla(puvodni);
  const max = okoli === 'V' ? 4 : 8;
  const narozeni = new Array(9).fill(false), preziti = new Array(9).fill(false);
  for (const [cislice, pole, co] of [[B, narozeni, 'zrodu'], [S, preziti, 'přežití']]) {
    for (const ch of cislice) {
      const n = Number(ch);
      if (n > max) throw new Error('Počet sousedů ' + n + ' v podmínce ' + co + ' je mimo rozsah 0–' + max + (okoli === 'V' ? ' (von Neumannovo okolí má 4 sousedy).' : '.'));
      pole[n] = true;
    }
  }
  const stavy = Number(C);
  if (!Number.isInteger(stavy) || stavy < 2 || stavy > 256) throw new Error('Počet stavů (C) musí být 2–256.');
  return { typ: 'life', narozeni, preziti, stavy, okoli };
}

function cislice(pole) { let s = ''; for (let i = 0; i < pole.length; i++) if (pole[i]) s += i; return s; }

/** Normalizovaný zápis pravidla (Golly kompatibilní). */
function formatujPravidlo(p) {
  if (p.typ === 'wireworld') return 'WireWorld';
  if (p.typ === 'wolfram') return 'W' + p.cislo;
  return 'B' + cislice(p.narozeni) + '/S' + cislice(p.preziti) + (p.stavy > 2 ? '/C' + p.stavy : '') + (p.okoli === 'V' ? 'V' : '');
}

function nazevPravidla(p) {
  const z = formatujPravidlo(p);
  const k = ZNAMA_PRAVIDLA.find(r => r.zapis === z);
  if (k) return k.nazev;
  if (p.typ === 'wolfram') return 'Wolframovo pravidlo ' + p.cislo;
  if (p.typ === 'life') return p.stavy > 2 ? 'Vlastní pravidlo Generations' : 'Vlastní dvoustavové pravidlo';
  return z;
}

function pocetStavu(p) { return p.typ === 'wireworld' ? 4 : p.typ === 'wolfram' ? 2 : p.stavy; }

/** Lze vzor zapsat do RLE kompatibilního s běžnými programy jako b/o? */
function jeDvoustavove(p) { return pocetStavu(p) === 2; }

function tabulkaPrechodu(p) {
  const C = p.stavy, L = new Uint8Array(C * 9);
  for (let n = 0; n <= 8; n++) {
    L[n] = p.narozeni[n] ? 1 : 0;
    L[9 + n] = p.preziti[n] ? 1 : (C > 2 ? 2 : 0);
    for (let k = 2; k < C; k++) L[k * 9 + n] = k + 1 < C ? k + 1 : 0;
  }
  return L;
}

// ---------------------------------------------------------------- náhoda
function mulberry32(seme) {
  let a = seme >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- svět
const OKRAJE = {
  torus: 'Toroid (okraje navazují)',
  mrtvy: 'Pevné mrtvé okraje',
  valec: 'Válec (navazuje jen vodorovně)',
  klein: 'Kleinova láhev',
  odraz: 'Zrcadlový odraz',
};
const MAX_STRANA = 8192, MAX_BUNEK = 16777216;

class Svet {
  constructor(sirka, vyska, pravidlo, okraj) {
    sirka = Math.floor(sirka); vyska = Math.floor(vyska);
    if (!(sirka >= 3 && vyska >= 3 && sirka <= MAX_STRANA && vyska <= MAX_STRANA))
      throw new Error('Rozměr mřížky musí být 3–' + MAX_STRANA + ' buněk na stranu.');
    if (sirka * vyska > MAX_BUNEK) throw new Error('Mřížka může mít nejvýše ' + MAX_BUNEK.toLocaleString('cs-CZ') + ' buněk (např. 4096 × 4096).');
    this.W = sirka; this.H = vyska; this.P = sirka + 2;
    this.a = new Uint8Array(this.P * (vyska + 2));
    this.b = new Uint8Array(this.P * (vyska + 2));
    this.radek = 1;           // Wolfram: aktuální řádek (1..H)
    this.okraj = 'torus';
    this.nastavPravidlo(pravidlo || parsujPravidlo('B3/S23'));
    this.nastavOkraj(okraj || 'torus');
  }
  get stavy() { return pocetStavu(this.pravidlo); }
  nastavPravidlo(p) {
    this.pravidlo = p;
    this.lut = p.typ === 'life' ? tabulkaPrechodu(p) : null;
    const C = pocetStavu(p);
    const a = this.a;
    for (let i = 0; i < a.length; i++) if (a[i] >= C) a[i] = 0;
  }
  nastavOkraj(o) {
    if (!OKRAJE[o]) throw new Error('Neznámá okrajová podmínka: ' + o);
    this.okraj = o;
  }
  idx(x, y) { return (y + 1) * this.P + x + 1; }
  uvnitr(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  ziskej(x, y) { return this.uvnitr(x, y) ? this.a[this.idx(x, y)] : 0; }
  nastav(x, y, s) {
    if (!this.uvnitr(x, y)) return false;
    if (!(s >= 0 && s < this.stavy)) s = 0;
    this.a[this.idx(x, y)] = s;
    return true;
  }
  vycisti() { this.a.fill(0); this.radek = 1; }
  /** Obraz bez okraje (W×H), nová kopie. */
  obraz(cil) {
    const { W, H, P, a } = this;
    const o = cil || new Uint8Array(W * H);
    for (let y = 0; y < H; y++) o.set(a.subarray((y + 1) * P + 1, (y + 1) * P + 1 + W), y * W);
    return o;
  }
  /** Vloží obraz w×h na pozici (x,y). rezim: 'prepis' (i mrtvé) nebo 'pridej' (jen nenulové). */
  vloz(data, w, h, x, y, rezim) {
    const C = this.stavy, pridej = rezim === 'pridej';
    for (let j = 0; j < h; j++) {
      const yy = y + j; if (yy < 0 || yy >= this.H) continue;
      for (let i = 0; i < w; i++) {
        const xx = x + i; if (xx < 0 || xx >= this.W) continue;
        let s = data[j * w + i];
        if (pridej && !s) continue;
        if (s >= C) s = C === 2 ? 1 : 0;
        this.a[(yy + 1) * this.P + xx + 1] = s;
      }
    }
  }
  nahodne(hustota, seme, oblast) {
    const r = mulberry32(seme), C = this.stavy;
    const x0 = oblast ? Math.max(0, oblast.x) : 0, y0 = oblast ? Math.max(0, oblast.y) : 0;
    const x1 = oblast ? Math.min(this.W, oblast.x + oblast.w) : this.W, y1 = oblast ? Math.min(this.H, oblast.y + oblast.h) : this.H;
    const ww = this.pravidlo.typ === 'wireworld';
    if (this.pravidlo.typ === 'wolfram') {
      this.vycisti();
      for (let x = 0; x < this.W; x++) this.a[this.P + x + 1] = r() < hustota ? 1 : 0;
      return;
    }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const v = r() < hustota;
      this.a[(y + 1) * this.P + x + 1] = v ? (ww ? (r() < 0.1 ? 1 : 3) : 1) : 0;
    }
    if (C > 2 && !ww) { /* Generations: náhodně jen živé (1) */ }
  }
  populace() {
    const { a, W, H, P } = this;
    if (this.pravidlo.typ === 'wolfram') {
      let n = 0; const o = this.radek * P + 1;
      for (let x = 0; x < W; x++) n += a[o + x];
      return n;
    }
    let n = 0;
    for (let y = 1; y <= H; y++) { const o = y * P + 1; for (let x = 0; x < W; x++) if (a[o + x] === 1) n++; }
    return n;
  }
  pocty() {
    const C = this.stavy, p = new Array(C).fill(0), { a, W, H, P } = this;
    for (let y = 1; y <= H; y++) { const o = y * P + 1; for (let x = 0; x < W; x++) p[a[o + x]]++; }
    return p;
  }
  /** Doplní jednobuněčný okraj bufferu podle okrajové podmínky. */
  doplnOkraj(buf) {
    const { W, H, P } = this, o = this.okraj;
    const posledni = (H + 1) * P;
    // horní a dolní řádek
    if (o === 'torus' || o === 'klein') {
      if (o === 'torus') {
        buf.copyWithin(0, H * P, H * P + P);
        buf.copyWithin(posledni, P, 2 * P);
      } else {
        for (let x = 1; x <= W; x++) {
          buf[x] = buf[H * P + (W + 1 - x)];
          buf[posledni + x] = buf[P + (W + 1 - x)];
        }
      }
    } else if (o === 'odraz') {
      buf.copyWithin(0, P, 2 * P);
      buf.copyWithin(posledni, H * P, H * P + P);
    } else {
      buf.fill(0, 0, P); buf.fill(0, posledni, posledni + P);
    }
    // levý a pravý sloupec (včetně rohů)
    if (o === 'mrtvy') {
      for (let y = 0; y <= H + 1; y++) { buf[y * P] = 0; buf[y * P + W + 1] = 0; }
    } else if (o === 'odraz') {
      for (let y = 0; y <= H + 1; y++) { buf[y * P] = buf[y * P + 1]; buf[y * P + W + 1] = buf[y * P + W]; }
    } else {
      for (let y = 0; y <= H + 1; y++) { buf[y * P] = buf[y * P + W]; buf[y * P + W + 1] = buf[y * P + 1]; }
    }
  }
  /** Jeden krok automatu. Vrací {pop, narozene, zemrele}. */
  krok() {
    const p = this.pravidlo;
    if (p.typ === 'wolfram') return this.krokWolfram();
    this.doplnOkraj(this.a);
    let st;
    if (p.typ === 'wireworld') st = this.krokWireworld();
    else if (p.stavy === 2 && p.okoli === 'M') st = this.krokLife2();
    else st = this.krokObecny();
    const t = this.a; this.a = this.b; this.b = t;
    return st;
  }
  krokLife2() {
    const { W, H, P, lut } = this, s = this.a, d = this.b;
    let pop = 0, zmen = 0, popPred = 0;
    for (let y = 1; y <= H; y++) {
      let i = y * P + 1, u = i - P, n = i + P;
      let cl = s[u - 1] + s[i - 1] + s[n - 1];
      let cc = s[u] + s[i] + s[n];
      for (let x = 0; x < W; x++, i++, u++, n++) {
        const cr = s[u + 1] + s[i + 1] + s[n + 1];
        const v = s[i];
        const nv = lut[v * 9 + cl + cc + cr - v];
        d[i] = nv;
        pop += nv; popPred += v; zmen += nv ^ v;
        cl = cc; cc = cr;
      }
    }
    const rozdil = pop - popPred;
    return { pop, narozene: (zmen + rozdil) / 2, zemrele: (zmen - rozdil) / 2 };
  }
  krokObecny() {
    const { W, H, P, lut } = this, s = this.a, d = this.b, vn = this.pravidlo.okoli === 'V';
    let pop = 0, nar = 0, zem = 0;
    for (let y = 1; y <= H; y++) {
      let i = y * P + 1;
      for (let x = 0; x < W; x++, i++) {
        let k;
        if (vn) k = (s[i - P] === 1) + (s[i + P] === 1) + (s[i - 1] === 1) + (s[i + 1] === 1);
        else k = (s[i - P - 1] === 1) + (s[i - P] === 1) + (s[i - P + 1] === 1) + (s[i - 1] === 1) +
                 (s[i + 1] === 1) + (s[i + P - 1] === 1) + (s[i + P] === 1) + (s[i + P + 1] === 1);
        const v = s[i], nv = lut[v * 9 + k];
        d[i] = nv;
        if (nv === 1) { pop++; if (v !== 1) nar++; } else if (v === 1) zem++;
      }
    }
    return { pop, narozene: nar, zemrele: zem };
  }
  krokWireworld() {
    // 0 prázdno, 1 hlava elektronu, 2 ocas, 3 vodič
    const { W, H, P } = this, s = this.a, d = this.b;
    let pop = 0, nar = 0, zem = 0;
    for (let y = 1; y <= H; y++) {
      let i = y * P + 1;
      for (let x = 0; x < W; x++, i++) {
        const v = s[i]; let nv = v;
        if (v === 1) { nv = 2; zem++; }
        else if (v === 2) nv = 3;
        else if (v === 3) {
          const k = (s[i - P - 1] === 1) + (s[i - P] === 1) + (s[i - P + 1] === 1) + (s[i - 1] === 1) +
                    (s[i + 1] === 1) + (s[i + P - 1] === 1) + (s[i + P] === 1) + (s[i + P + 1] === 1);
          if (k === 1 || k === 2) { nv = 1; nar++; }
        }
        d[i] = nv;
        if (nv === 1) pop++;
      }
    }
    return { pop, narozene: nar, zemrele: zem };
  }
  krokWolfram() {
    const { W, H, P } = this, a = this.a, cislo = this.pravidlo.cislo;
    const r = this.radek, o = r * P;
    let levy, pravy;
    if (this.okraj === 'mrtvy') { levy = 0; pravy = 0; }
    else if (this.okraj === 'odraz') { levy = a[o + 1]; pravy = a[o + W]; }
    else { levy = a[o + W]; pravy = a[o + 1]; }
    const novy = this._radek && this._radek.length === W ? this._radek : (this._radek = new Uint8Array(W));
    let pop = 0, nar = 0, zem = 0;
    for (let x = 1; x <= W; x++) {
      const l = x === 1 ? levy : a[o + x - 1], c = a[o + x], p = x === W ? pravy : a[o + x + 1];
      const v = (cislo >> ((l << 2) | (c << 1) | p)) & 1;
      novy[x - 1] = v; pop += v;
      if (v && !c) nar++; else if (!v && c) zem++;
    }
    let cil;
    if (r < H) { cil = (r + 1) * P + 1; this.radek = r + 1; }
    else { a.copyWithin(P, 2 * P, (H + 1) * P); cil = H * P + 1; }
    a.set(novy, cil);
    return { pop, narozene: nar, zemrele: zem };
  }
  /** Ohraničující obdélník nenulových buněk {x0,y0,x1,y1} (včetně) nebo null. */
  ohraniceni() {
    const { W, H, P, a } = this;
    let x0 = W, y0 = -1, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      const o = (y + 1) * P + 1; let radekMa = false;
      for (let x = 0; x < W; x++) if (a[o + x]) { radekMa = true; if (x < x0) x0 = x; if (x > x1) x1 = x; }
      if (radekMa) { if (y0 < 0) y0 = y; y1 = y; }
    }
    return y0 < 0 ? null : { x0, y0, x1, y1 };
  }
  /** Otisk obsahu nezávislý na poloze (pro zjištění periody a posunu). */
  otisk() {
    const bb = this.ohraniceni();
    if (!bb) return { klic: 'prazdno', x0: 0, y0: 0 };
    const { P, a } = this;
    let h1 = 0x811c9dc5 | 0, h2 = 0x9747b28c | 0;
    for (let y = bb.y0; y <= bb.y1; y++) {
      const o = (y + 1) * P + 1;
      for (let x = bb.x0; x <= bb.x1; x++) {
        const v = a[o + x];
        h1 = Math.imul(h1 ^ v, 16777619);
        h2 = Math.imul(h2 + v + 1, 0x5bd1e995); h2 ^= h2 >>> 13;
      }
      h1 = Math.imul(h1 ^ 0xff, 16777619);
    }
    return { klic: (bb.x1 - bb.x0) + 'x' + (bb.y1 - bb.y0) + ':' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36), x0: bb.x0, y0: bb.y0 };
  }
  // ---- komprimované snímky pro historii
  bituNaBunku() { const C = this.stavy; return C <= 2 ? 1 : C <= 4 ? 2 : C <= 16 ? 4 : 8; }
  velikostSnimku() { return Math.ceil(this.W * this.H * this.bituNaBunku() / 8); }
  zabal() {
    const { W, H, P, a } = this, b = this.bituNaBunku();
    const out = new Uint8Array(this.velikostSnimku());
    if (b === 8) { this.obraz(out); return out; }
    const naBajt = 8 / b; let k = 0, bajt = 0, pos = 0;
    for (let y = 1; y <= H; y++) {
      const o = y * P + 1;
      for (let x = 0; x < W; x++) {
        bajt |= a[o + x] << (pos * b);
        if (++pos === naBajt) { out[k++] = bajt; bajt = 0; pos = 0; }
      }
    }
    if (pos) out[k] = bajt;
    return out;
  }
  rozbal(data) {
    const { W, H, P, a } = this, b = this.bituNaBunku();
    if (b === 8) { this.vloz(data, W, H, 0, 0, 'prepis'); return; }
    const naBajt = 8 / b, maska = (1 << b) - 1; let k = 0, pos = 0;
    for (let y = 1; y <= H; y++) {
      const o = y * P + 1;
      for (let x = 0; x < W; x++) {
        a[o + x] = (data[k] >> (pos * b)) & maska;
        if (++pos === naBajt) { k++; pos = 0; }
      }
    }
  }
}

// ---------------------------------------------------------------- historie
/** Kruhový buffer snímků. Nejstarší se zahazují po překročení limitu paměti. */
class Historie {
  constructor(limitBajtu) { this.limit = Math.max(1, limitBajtu || 64 * 1048576); this.vycisti(); }
  vycisti() { this.buf = []; this.zac = 0; this.n = 0; this.kap = 0; this.velikost = 0; }
  /** Nastaví kapacitu podle velikosti jednoho snímku (volá se při změně mřížky). */
  priprav(velikostSnimku) {
    this.vycisti();
    this.velikost = velikostSnimku;
    this.kap = Math.max(2, Math.min(200000, Math.floor(this.limit / Math.max(1, velikostSnimku))));
    this.buf = new Array(this.kap);
  }
  nastavLimit(limitBajtu) {
    const stare = this.vse();
    this.limit = Math.max(1, limitBajtu);
    this.priprav(this.velikost);
    for (const e of stare.slice(-this.kap)) this._vloz(e);
  }
  _vloz(e) {
    if (this.n === this.kap) { this.zac = (this.zac + 1) % this.kap; this.n--; }
    this.buf[(this.zac + this.n) % this.kap] = e; this.n++;
  }
  polozka(i) { return this.buf[(this.zac + i) % this.kap]; }
  /** Přidá snímek; snímky se stejnou nebo vyšší generací (budoucnost po návratu) zahodí. */
  pridej(e) {
    if (!this.kap) throw new Error('Historie není připravena.');
    while (this.n && this.polozka(this.n - 1).gen >= e.gen) { this.buf[(this.zac + this.n - 1) % this.kap] = undefined; this.n--; }
    this._vloz(e);
  }
  /** Odstraní snímky s generací ≥ gen. */
  orizni(gen) { while (this.n && this.polozka(this.n - 1).gen >= gen) { this.buf[(this.zac + this.n - 1) % this.kap] = undefined; this.n--; } }
  /** Nejnovější snímek s generací ≤ gen. */
  najdi(gen) {
    let lo = 0, hi = this.n - 1, r = null;
    while (lo <= hi) { const m = (lo + hi) >> 1, e = this.polozka(m); if (e.gen <= gen) { r = e; lo = m + 1; } else hi = m - 1; }
    return r;
  }
  get od() { return this.n ? this.polozka(0).gen : null; }
  get do() { return this.n ? this.polozka(this.n - 1).gen : null; }
  get bajtu() { return this.n * this.velikost; }
  vse() { const o = []; for (let i = 0; i < this.n; i++) o.push(this.polozka(i)); return o; }
}

// ---------------------------------------------------------------- RLE a další formáty
function znakStavu(s, dvoustavy) {
  if (dvoustavy) return s ? 'o' : 'b';
  if (s === 0) return '.';
  if (s <= 24) return String.fromCharCode(64 + s);
  const pre = Math.floor((s - 25) / 24), zb = (s - 25) % 24;
  return String.fromCharCode(112 + pre) + String.fromCharCode(65 + zb);
}

/** Načte RLE (Golly / LifeWiki). Vrací {sirka, vyska, bunky, pravidlo, nazev, autor, komentare, varovani[]}. */
function parsujRLE(text) {
  if (typeof text !== 'string') throw new Error('RLE musí být text.');
  const radky = text.replace(/\r/g, '').split('\n');
  let nazev = '', autor = '', pravidlo = null, sirka = null, vyska = null, i = 0;
  const komentare = [], varovani = [];
  for (; i < radky.length; i++) {
    const r = radky[i].trim();
    if (!r) continue;
    if (r[0] === '#') {
      const typ = r[1], obsah = r.slice(2).trim();
      if (typ === 'N') nazev = obsah;
      else if (typ === 'O') autor = obsah;
      else if (typ === 'C' || typ === 'c') komentare.push(obsah);
      else if (typ === 'r') pravidlo = obsah;
      continue;
    }
    if (/^x\s*=/i.test(r)) {
      for (const cast of r.split(',')) {
        const kv = cast.split('=');
        if (kv.length < 2) continue;
        const k = kv[0].trim().toLowerCase(), v = kv.slice(1).join('=').trim();
        if (k === 'x') sirka = parseInt(v, 10);
        else if (k === 'y') vyska = parseInt(v, 10);
        else if (k === 'rule') pravidlo = v;
      }
      if (!(sirka >= 0) || !(vyska >= 0)) throw new Error('Hlavička RLE má neplatné rozměry: ' + r);
      i++;
    }
    break;
  }
  const telo = radky.slice(i).join('\n');
  // průchod tělem
  const body = []; // [x,y,s]
  let x = 0, y = 0, pocet = 0, maxX = 0, konec = false, maxS = 0;
  for (let k = 0; k < telo.length && !konec; k++) {
    const ch = telo[k];
    if (ch >= '0' && ch <= '9') { pocet = pocet * 10 + (ch.charCodeAt(0) - 48); if (pocet > 1e7) throw new Error('Příliš dlouhý běh v RLE.'); continue; }
    const n = pocet || 1; pocet = 0;
    if (ch === '!') { konec = true; break; }
    if (ch === '$') { y += n; x = 0; continue; }
    if (ch === ' ' || ch === '\n' || ch === '\t') { if (n > 1) throw new Error('Číslo v RLE musí následovat značka stavu.'); continue; }
    if (ch === '#') { // komentář uprostřed (nestandardní) – přeskočit řádek
      while (k < telo.length && telo[k] !== '\n') k++;
      continue;
    }
    let s;
    if (ch === 'b' || ch === '.') s = 0;
    else if (ch === 'o') s = 1;
    else if (ch >= 'A' && ch <= 'X') s = ch.charCodeAt(0) - 64;
    else if (ch >= 'p' && ch <= 'y' && telo[k + 1] >= 'A' && telo[k + 1] <= 'X') { s = 24 * (ch.charCodeAt(0) - 112) + (telo[k + 1].charCodeAt(0) - 64) + 24; k++; }
    else if (ch >= 'a' && ch <= 'z') s = 1; // starší soubory: libovolné malé písmeno = živá
    else throw new Error('Neočekávaný znak „' + ch + '“ v těle RLE.');
    if (s > 255) throw new Error('Stav ' + s + ' je mimo rozsah 0–255.');
    if (s) { for (let j = 0; j < n; j++) body.push(x + j, y, s); if (s > maxS) maxS = s; }
    x += n; if (x > maxX) maxX = x;
    if (body.length > 3 * MAX_BUNEK) throw new Error('Vzor je příliš velký.');
  }
  if (!konec) varovani.push('RLE nekončí znakem „!“ – načteno, co bylo k dispozici.');
  const vyskaTela = body.length || x > 0 ? y + 1 : y;
  let W = sirka, H = vyska;
  if (W == null) { W = maxX; H = vyskaTela; }
  if (maxX > W || vyskaTela > H) { varovani.push('Tělo RLE přesahuje rozměry z hlavičky – rozměry zvětšeny.'); W = Math.max(W, maxX); H = Math.max(H, vyskaTela); }
  if (W * H > MAX_BUNEK) throw new Error('Vzor ' + W + ' × ' + H + ' je příliš velký.');
  const bunky = new Uint8Array(Math.max(0, W * H));
  for (let k = 0; k < body.length; k += 3) bunky[body[k + 1] * W + body[k]] = body[k + 2];
  return { sirka: W, vyska: H, bunky, pravidlo, nazev, autor, komentare, varovani, maxStav: maxS };
}

/** Zapíše obraz w×h do RLE. moznosti: {pravidlo (text), nazev, autor, komentare[], orez (true = jen ohraničení živých)}. */
function zapisRLE(bunky, w, h, moznosti) {
  const m = moznosti || {};
  let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
  let maxS = 0;
  for (let i = 0; i < bunky.length; i++) if (bunky[i] > maxS) maxS = bunky[i];
  if (m.orez !== false) {
    x0 = w; y0 = -1; x1 = -1; y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bunky[y * w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y0 < 0) y0 = y; y1 = y;
    }
    if (y0 < 0) { x0 = 0; y0 = 0; x1 = -1; y1 = -1; }
  }
  const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
  const dvoustavy = m.stavy ? m.stavy <= 2 : maxS <= 1;
  if (dvoustavy && maxS > 1) throw new Error('Obsah má více než dva stavy – nelze zapsat jako b/o.');
  const tokeny = [];
  let cekajiciRadky = 0;
  for (let y = y0; y <= y1 && sh > 0; y++) {
    const runy = []; let x = x0;
    while (x <= x1) {
      const s = bunky[y * w + x]; let n = 1;
      while (x + n <= x1 && bunky[y * w + x + n] === s) n++;
      runy.push([s, n]); x += n;
    }
    if (runy.length && runy[runy.length - 1][0] === 0) runy.pop();
    if (!runy.length) { cekajiciRadky++; continue; }
    if (tokeny.length) tokeny.push((cekajiciRadky + 1 > 1 ? cekajiciRadky + 1 : '') + '$');
    else if (cekajiciRadky) tokeny.push((cekajiciRadky > 1 ? cekajiciRadky : '') + '$');
    cekajiciRadky = 0;
    for (const [s, n] of runy) tokeny.push((n > 1 ? n : '') + znakStavu(s, dvoustavy));
  }
  tokeny.push('!');
  const radky = [];
  if (m.nazev) radky.push('#N ' + m.nazev);
  if (m.autor) radky.push('#O ' + m.autor);
  for (const k of m.komentare || []) radky.push('#C ' + k);
  radky.push('x = ' + Math.max(0, sw) + ', y = ' + Math.max(0, sh) + (m.pravidlo ? ', rule = ' + m.pravidlo : ''));
  let r = '';
  for (const t of tokeny) { if (r.length + t.length > 70) { radky.push(r); r = ''; } r += t; }
  if (r) radky.push(r);
  return { text: radky.join('\n') + '\n', x0, y0, sirka: Math.max(0, sw), vyska: Math.max(0, sh) };
}

function parsujCells(text) {
  const radky = text.replace(/\r/g, '').split('\n');
  let nazev = ''; const komentare = [], data = [];
  for (const r of radky) {
    if (r.startsWith('!')) { const t = r.slice(1).trim(); if (/^name:/i.test(t)) nazev = t.replace(/^name:\s*/i, ''); else if (t) komentare.push(t); continue; }
    if (/^[.Oo*\s]*$/.test(r)) data.push(r.replace(/\s+$/, ''));
    else throw new Error('Neplatný řádek formátu .cells: „' + r.slice(0, 30) + '“');
  }
  while (data.length && !data[data.length - 1]) data.pop();
  const H = data.length, W = data.reduce((m, r) => Math.max(m, r.length), 0);
  if (W * H > MAX_BUNEK) throw new Error('Vzor je příliš velký.');
  const bunky = new Uint8Array(W * H);
  data.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'O' || r[x] === 'o' || r[x] === '*') bunky[y * W + x] = 1; });
  return { sirka: W, vyska: H, bunky, pravidlo: null, nazev, autor: '', komentare, varovani: [], maxStav: 1 };
}

function parsujLife106(text) {
  const body = [];
  for (const r of text.replace(/\r/g, '').split('\n')) {
    const t = r.trim(); if (!t || t[0] === '#') continue;
    const m = /^(-?\d+)\s+(-?\d+)$/.exec(t);
    if (!m) throw new Error('Neplatný řádek Life 1.06: „' + t + '“');
    body.push([+m[1], +m[2]]);
  }
  if (!body.length) return { sirka: 0, vyska: 0, bunky: new Uint8Array(0), pravidlo: null, nazev: '', autor: '', komentare: [], varovani: [], maxStav: 0 };
  const xs = body.map(b => b[0]), ys = body.map(b => b[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), W = Math.max(...xs) - x0 + 1, H = Math.max(...ys) - y0 + 1;
  if (W * H > MAX_BUNEK) throw new Error('Vzor je příliš velký.');
  const bunky = new Uint8Array(W * H);
  for (const [x, y] of body) bunky[(y - y0) * W + x - x0] = 1;
  return { sirka: W, vyska: H, bunky, pravidlo: null, nazev: '', autor: '', komentare: [], varovani: [], maxStav: 1 };
}

const FORMAT_JSON = 'bunecne_automaty';
function zapisJSON(stav) {
  // stav: {sirka, vyska, bunky, pravidlo (obj), okraj, gen, radek, nazev}
  const rle = zapisRLE(stav.bunky, stav.sirka, stav.vyska, { orez: false, stavy: pocetStavu(stav.pravidlo) });
  const telo = rle.text.split('\n').filter(r => r && r[0] !== '#' && !/^x\s*=/.test(r)).join('');
  return JSON.stringify({
    format: FORMAT_JSON, verze: 1, nazev: stav.nazev || '', pravidlo: formatujPravidlo(stav.pravidlo),
    okraj: stav.okraj, sirka: stav.sirka, vyska: stav.vyska, generace: stav.gen || 0,
    radek: stav.pravidlo.typ === 'wolfram' ? stav.radek : undefined,
    vytvoreno: new Date().toISOString(), rle: telo,
  }, null, 1);
}
function parsujJSON(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
  if (!o || o.format !== FORMAT_JSON) throw new Error('JSON nepochází z této laboratoře (chybí "format": "' + FORMAT_JSON + '").');
  if (!(o.sirka >= 3 && o.vyska >= 3 && o.sirka <= MAX_STRANA && o.vyska <= MAX_STRANA)) throw new Error('JSON má neplatné rozměry mřížky.');
  const p = parsujPravidlo(String(o.pravidlo || 'B3/S23'));
  const r = parsujRLE('x = ' + o.sirka + ', y = ' + o.vyska + '\n' + String(o.rle || '!'));
  const okraj = OKRAJE[o.okraj] ? o.okraj : 'torus';
  return { sirka: o.sirka, vyska: o.vyska, bunky: r.bunky, pravidlo: formatujPravidlo(p), okraj, gen: Math.max(0, o.generace | 0),
    radek: o.radek | 0, nazev: o.nazev || '', autor: '', komentare: [], varovani: r.varovani, maxStav: r.maxStav, json: true };
}

/** Rozpozná formát (RLE, .cells, Life 1.06, JSON) a načte vzor. */
function parsujVzor(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Vstup je prázdný.');
  const t = text.replace(/^﻿/, '').trim();
  if (t[0] === '{') return parsujJSON(t);
  if (/^#Life 1\.06/i.test(t)) return parsujLife106(t);
  if (/^#Life 1\.05/i.test(t)) throw new Error('Formát Life 1.05 není podporován – převeďte jej na RLE.');
  const radky = t.split(/\r?\n/).filter(r => r.trim());
  if (radky.some(r => /^\s*x\s*=/i.test(r)) || /!\s*$/.test(t) && !radky.every(r => /^!|^[.Oo*]*$/.test(r))) return parsujRLE(t);
  if (radky.every(r => r[0] === '!' || /^[.Oo*\s]*$/.test(r))) return parsujCells(t);
  return parsujRLE(t);
}

// ---------------------------------------------------------------- motor (Worker / záloha)
const nyni = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

class Motor {
  constructor(posli) {
    this.posli = posli;
    this.svet = null; this.gen = 0; this.bezi = false;
    this.rychlost = 30; this.cil = 0; this.dluh = 0;
    this.cekam = false; this.spinavy = false;
    this.historie = new Historie(64 * 1048576);
    this.interval = 1;
    this.rada = [];          // populace podle generace
    this.otisky = new Map(); this.perioda = null; this.detekce = true; this.zastavPriUstaleni = false;
    this.posledniStat = { pop: 0, narozene: 0, zemrele: 0 };
    this.mereni = { t: nyni(), gen: 0, rychlost: 0, msNaGen: 0 };
    this.casovac = null;
  }
  chyba(e) { this.posli({ typ: 'chyba', zprava: e && e.message ? e.message : String(e) }); }
  zprava(m) {
    try { this._zprava(m); } catch (e) { this.chyba(e); }
  }
  _zprava(m) {
    switch (m.typ) {
      case 'init': {
        this.historie = new Historie((m.historieMB || 64) * 1048576);
        this.svet = new Svet(m.sirka, m.vyska, m.pravidlo, m.okraj);
        if (m.bunky) this.svet.vloz(m.bunky, m.sirka, m.vyska, 0, 0, 'prepis');
        this.reset(m.gen || 0); break;
      }
      case 'pravidlo': {
        const stary = this.svet.pravidlo.typ, novy = m.pravidlo.typ;
        this.svet.nastavPravidlo(m.pravidlo);
        if ((stary === 'wolfram') !== (novy === 'wolfram')) { this.svet.vycisti(); this.reset(0); }
        else this.novaZakladna();
        break;
      }
      case 'okraj': this.svet.nastavOkraj(m.okraj); this.novaZakladna(); break;
      case 'velikost': {
        const s = this.svet, nov = new Svet(m.sirka, m.vyska, s.pravidlo, s.okraj);
        const ob = s.obraz();
        nov.vloz(ob, s.W, s.H, Math.floor((nov.W - s.W) / 2), Math.floor((nov.H - s.H) / 2), 'prepis');
        if (s.pravidlo.typ === 'wolfram') nov.radek = Math.min(nov.H, Math.max(1, s.radek + Math.floor((nov.H - s.H) / 2)));
        this.svet = nov; this.reset(0); break;
      }
      case 'nahraj': {
        const s = this.svet;
        if (m.sirka !== s.W || m.vyska !== s.H) this.svet = new Svet(m.sirka, m.vyska, m.pravidlo || s.pravidlo, m.okraj || s.okraj);
        else { if (m.pravidlo) s.nastavPravidlo(m.pravidlo); if (m.okraj) s.nastavOkraj(m.okraj); }
        this.svet.vycisti();
        this.svet.vloz(m.bunky, m.sirka, m.vyska, 0, 0, 'prepis');
        if (this.svet.pravidlo.typ === 'wolfram') this.svet.radek = Math.min(this.svet.H, Math.max(1, m.radek || posledniRadek(this.svet)));
        this.reset(m.gen || 0); break;
      }
      case 'vloz': this.svet.vloz(m.bunky, m.w, m.h, m.x, m.y, m.rezim); this.poUprave(); break;
      case 'kresli': {
        const b = m.body;
        for (let i = 0; i + 2 < b.length; i += 3) this.svet.nastav(b[i], b[i + 1], b[i + 2]);
        this.poUprave(); break;
      }
      case 'vycisti': this.svet.vycisti(); this.reset(0); break;
      case 'nahodne': {
        this.svet.vycisti();
        this.svet.nahodne(m.hustota, m.seme >>> 0, m.oblast);
        this.reset(0); break;
      }
      case 'jednaBunka': { // Wolfram: jedna živá buňka uprostřed prvního řádku
        this.svet.vycisti();
        this.svet.nastav(Math.floor(this.svet.W / 2), 0, 1); this.svet.radek = 1;
        this.reset(0); break;
      }
      case 'start': this.rychlost = m.rychlost ?? this.rychlost; this.cil = m.cil || 0; this.spust(); break;
      case 'stop': this.zastav(); this.snimek(); break;
      case 'rychlost': this.rychlost = m.rychlost; this.dluh = 0; break;
      case 'krok': this.zastav(); this.kroky(m.n || 1, true); this.snimek(); break;
      case 'zpet': this.zastav(); this.skoc(Math.max(this.historie.od ?? 0, this.gen - (m.n || 1))); break;
      case 'skoc': this.zastav(); this.skoc(m.gen); break;
      case 'historie': this.historie.nastavLimit(m.mb * 1048576); this.snimek(); break;
      case 'detekce': this.detekce = !!m.zap; this.zastavPriUstaleni = !!m.zastavit; this.otisky.clear(); break;
      case 'potvrzeni': this.cekam = false; if (this.spinavy) { this.spinavy = false; this.snimek(); } break;
      case 'zadost': this.cekam = false; this.spinavy = false; this.snimek(); break;
      default: throw new Error('Neznámá zpráva motoru: ' + m.typ);
    }
  }
  intervalHistorie() {
    const n = this.svet.W * this.svet.H;
    return n <= 262144 ? 1 : Math.ceil(n / 262144);
  }
  snimekHistorie() { return { gen: this.gen, radek: this.svet.radek, data: this.svet.zabal() }; }
  reset(gen) {
    this.gen = gen; this.interval = this.intervalHistorie();
    this.historie.priprav(this.svet.velikostSnimku());
    this.historie.pridej(this.snimekHistorie());
    this.rada = []; this.rada[gen] = this.svet.populace();
    this.otisky.clear(); this.perioda = null;
    this.posledniStat = { pop: this.rada[gen], narozene: 0, zemrele: 0 };
    this.snimek();
  }
  novaZakladna() {
    this.historie.priprav(this.svet.velikostSnimku());
    this.historie.pridej(this.snimekHistorie());
    this.otisky.clear(); this.perioda = null;
    this.rada[this.gen] = this.svet.populace();
    this.snimek();
  }
  poUprave() {
    this.historie.orizni(this.gen);
    this.historie.pridej(this.snimekHistorie());
    this.rada.length = this.gen + 1; this.rada[this.gen] = this.svet.populace();
    this.posledniStat = { pop: this.rada[this.gen], narozene: 0, zemrele: 0 };
    this.otisky.clear(); this.perioda = null;
    this.snimek();
  }
  /** Provede n kroků. ukladat=false při přehrávání z historie (nepřepisuje budoucnost). */
  kroky(n, ukladat) {
    const s = this.svet, det = this.detekce && s.pravidlo.typ !== 'wolfram' && s.W * s.H <= 1048576;
    for (let k = 0; k < n; k++) {
      this.posledniStat = s.krok();
      this.gen++;
      if (this.rada.length <= 4000000) this.rada[this.gen] = this.posledniStat.pop;
      if (ukladat && this.gen % this.interval === 0) this.historie.pridej(this.snimekHistorie());
      if (det && !this.perioda) this.zkontrolujPeriodu();
      if (this.cil && this.gen >= this.cil) { this.zastav(); break; }
      if (this.perioda && this.zastavPriUstaleni && this.bezi) { this.zastav(); break; }
    }
  }
  zkontrolujPeriodu() {
    const o = this.svet.otisk(), pred = this.otisky.get(o.klic);
    if (pred) {
      const p = this.gen - pred.gen, dx = o.x0 - pred.x0, dy = o.y0 - pred.y0;
      this.perioda = { p, dx, dy, odGen: pred.gen, prazdno: o.klic === 'prazdno' };
      return;
    }
    if (this.otisky.size >= 8192) this.otisky.delete(this.otisky.keys().next().value);
    this.otisky.set(o.klic, { gen: this.gen, x0: o.x0, y0: o.y0 });
  }
  skoc(cilGen) {
    if (!(cilGen >= 0)) return;
    const e = this.historie.najdi(cilGen);
    if (!e) { this.chyba(new Error('Generace ' + cilGen + ' už v historii není (limit paměti).')); return; }
    this.svet.vycisti(); this.svet.rozbal(e.data); this.svet.radek = e.radek; this.gen = e.gen;
    this.kroky(cilGen - e.gen, false);
    this.otisky.clear(); this.perioda = null;
    this.posledniStat = { pop: this.svet.populace(), narozene: 0, zemrele: 0 };
    this.rada[this.gen] = this.posledniStat.pop;
    this.snimek();
  }
  spust() {
    if (this.bezi) return;
    this.bezi = true; this.dluh = 1; this.posledniTik = nyni();
    this.tik();
  }
  zastav() {
    this.bezi = false;
    if (this.casovac) { clearTimeout(this.casovac); this.casovac = null; }
  }
  tik() {
    this.casovac = null;
    if (!this.bezi) return;
    const t0 = nyni(), dt = Math.min(250, t0 - this.posledniTik); this.posledniTik = t0;
    const g0 = this.gen;
    if (this.rychlost > 0) {
      this.dluh += dt * this.rychlost / 1000;
      let n = Math.floor(this.dluh);
      this.dluh -= n;
      // po dávkách s časovým rozpočtem
      while (n > 0 && this.bezi && nyni() - t0 < 40) { const d = Math.min(n, 8); this.kroky(d, true); n -= d; }
      if (n > 0) this.dluh = 0; // nestíhá – dluh nehromadit
    } else {
      while (this.bezi && nyni() - t0 < 30) this.kroky(1, true);
    }
    const t1 = nyni();
    if (this.gen > g0) { this.mereni.msNaGen = (t1 - t0) / (this.gen - g0); }
    if (t1 - this.mereni.t >= 500) {
      this.mereni.rychlost = (this.gen - this.mereni.gen) * 1000 / (t1 - this.mereni.t);
      this.mereni.t = t1; this.mereni.gen = this.gen;
    }
    if (this.gen > g0 || !this.bezi) this.snimek();
    if (this.bezi) this.casovac = setTimeout(() => this.tik(), this.rychlost > 0 ? Math.max(4, Math.min(16, 1000 / this.rychlost)) : 0);
  }
  graf(body) {
    const r = this.rada, kon = this.gen, zac = Math.max(0, kon - 20000);
    const n = kon - zac + 1, k = Math.min(body || 400, n);
    const min = new Float64Array(k), max = new Float64Array(k);
    for (let i = 0; i < k; i++) {
      const a = zac + Math.floor(i * n / k), b = Math.max(a + 1, zac + Math.floor((i + 1) * n / k));
      let mn = Infinity, mx = -Infinity;
      for (let g = a; g < b; g++) { const v = r[g]; if (v === undefined) continue; if (v < mn) mn = v; if (v > mx) mx = v; }
      min[i] = mn === Infinity ? NaN : mn; max[i] = mx === -Infinity ? NaN : mx;
    }
    return { od: zac, do: kon, min, max };
  }
  snimek() {
    if (!this.svet) return;
    if (this.cekam) { this.spinavy = true; return; }
    const s = this.svet, bunky = s.obraz();
    const g = this.graf();
    this.cekam = true;
    this.posli({
      typ: 'snimek', bunky, sirka: s.W, vyska: s.H, gen: this.gen, radek: s.radek, bezi: this.bezi,
      stat: Object.assign({}, this.posledniStat, { pocty: s.stavy > 2 ? s.pocty() : null }),
      historie: { od: this.historie.od, do: this.historie.do, n: this.historie.n, bajtu: this.historie.bajtu, limit: this.historie.limit, interval: this.interval },
      perioda: this.perioda, rychlost: this.mereni.rychlost, msNaGen: this.mereni.msNaGen, graf: g,
    }, [bunky.buffer, g.min.buffer, g.max.buffer]);
  }
}
function posledniRadek(s) {
  for (let y = s.H; y >= 1; y--) { const o = y * s.P + 1; for (let x = 0; x < s.W; x++) if (s.a[o + x]) return y; }
  return 1;
}

const X = {
  ZNAMA_PRAVIDLA, OKRAJE, MAX_STRANA, MAX_BUNEK,
  parsujPravidlo, formatujPravidlo, nazevPravidla, pocetStavu, jeDvoustavove, tabulkaPrechodu,
  mulberry32, Svet, Historie, Motor,
  parsujRLE, zapisRLE, parsujCells, parsujLife106, parsujJSON, zapisJSON, parsujVzor,
};
if (typeof module !== 'undefined' && module.exports) module.exports = X;
else (typeof self !== 'undefined' ? self : window).BunecneAutomaty = X;
})();
