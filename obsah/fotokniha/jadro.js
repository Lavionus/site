/* ============================================================
   Fotokniha – jádro bez DOM. V prohlížeči window.FOTOKNIHA,
   v node module.exports. PDF přes globál PDFLib (pdf-lib).

   Soustava plochy: mm, x zleva od ořezu, y shora od ořezu.
   Plocha = dvoustrana (index) nebo obálka ('obalka').
   Spadávka b leží mimo (záporné / > rozměr).
   n dvoustran = 2n − 2 stran; levá půlka první a pravá půlka
   poslední dvoustrany jsou vnitřek desek (netisknou se).
   Obálka = zadní deska | hřbet | přední deska (zleva doprava,
   pohled zvenku), přesah = spadávka nebo záhyb tvrdých desek.

   Kreslení: scena(k, arch) dá seznam operací v mm archu (počátek
   v levém horním rohu spadávky) – z ní kreslí PDF i plátno (JPEG).
   ============================================================ */
(function (koren) {
  'use strict';
  const PT = 72 / 25.4;               // bodů na mm
  const DPI_CHYBA = 150, DPI_VAROVANI = 220;

  const FORMATY = [
    { id: '20x20', nazev: 'Čtverec 20 × 20 cm', s: 200, v: 200 },
    { id: '30x30', nazev: 'Čtverec 30 × 30 cm', s: 300, v: 300 },
    { id: '15x15', nazev: 'Čtverec 15 × 15 cm', s: 150, v: 150 },
    { id: 'a4v', nazev: 'A4 na výšku (21 × 29,7 cm)', s: 210, v: 297 },
    { id: 'a4s', nazev: 'A4 na šířku (29,7 × 21 cm)', s: 297, v: 210 },
    { id: 'a5s', nazev: 'A5 na šířku (21 × 14,8 cm)', s: 210, v: 148 },
    { id: '28x21', nazev: 'Na šířku 28 × 21 cm', s: 280, v: 210 },
  ];
  const VAZBY = [
    { id: 'lepena', nazev: 'Lepená / šitá (střed dvoustrany se ztrácí ve hřbetu)' },
    { id: 'layflat', nazev: 'Lay-flat (dvoustrana se otevře naplocho)' },
  ];
  // písma: soubory TTF pod obsah/ (stejný soubor pro náhled, PDF i JPEG)
  const PISMA = [
    { id: 'serif', nazev: 'Patkové', soubor: 'fonty/LiberationSerif-Regular.ttf' },
    { id: 'serif-i', nazev: 'Patkové kurzíva', soubor: 'fonty/LiberationSerif-Italic.ttf' },
    { id: 'serif-b', nazev: 'Patkové tučné', soubor: 'fonty/LiberationSerif-Bold.ttf' },
    { id: 'sans', nazev: 'Bezpatkové', soubor: 'lib/pdflib/LiberationSans-Regular.ttf' },
    { id: 'sans-i', nazev: 'Bezpatkové kurzíva', soubor: 'fonty/LiberationSans-Italic.ttf' },
    { id: 'sans-b', nazev: 'Bezpatkové tučné', soubor: 'fonty/LiberationSans-Bold.ttf' },
    { id: 'marcellus', nazev: 'Marcellus (vznešené)', soubor: 'fonty/Marcellus-Regular.ttf' },
    { id: 'playfair', nazev: 'Playfair SC (titulky)', soubor: 'fonty/PlayfairDisplaySC-Black.ttf' },
    { id: 'abril', nazev: 'Abril Fatface (plakát)', soubor: 'fonty/AbrilFatface-Regular.ttf' },
    { id: 'bebas', nazev: 'Bebas Neue (úzké)', soubor: 'fonty/BebasNeue-Regular.ttf' },
    { id: 'vibes', nazev: 'Great Vibes (krasopis)', soubor: 'fonty/GreatVibes-Regular.ttf' },
    { id: 'parisienne', nazev: 'Parisienne (krasopis)', soubor: 'fonty/Parisienne-Regular.ttf' },
    { id: 'courgette', nazev: 'Courgette (psací)', soubor: 'fonty/Courgette-Regular.ttf' },
    { id: 'patrick', nazev: 'Patrick Hand (rukopis)', soubor: 'fonty/PatrickHand-Regular.ttf' },
    { id: 'amatic', nazev: 'Amatic SC (křída)', soubor: 'fonty/AmaticSC-Bold.ttf' },
    { id: 'elite', nazev: 'Special Elite (psací stroj)', soubor: 'fonty/SpecialElite-Regular.ttf' },
  ];
  const nactenaPisma = new Map();    // id → fontkit font (registruje prohlížeč / test)
  const registrujPismo = (id, font) => nactenaPisma.set(id, font);

  const nid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));

  function novaKniha({ nazev = 'Moje fotokniha', format = '20x20', stran = 24, vazba = 'lepena', s, v } = {}) {
    const f = FORMATY.find(x => x.id === format) || FORMATY[0];
    const k = {
      verze: 2, id: nid(), nazev, vytvoreno: Date.now(), upraveno: Date.now(),
      format: { id: s ? 'vlastni' : f.id, s: s || f.s, v: v || f.v, spad: 3, bezpecna: 6, okraj: 12, mezera: 4 },
      vazba, fotky: [], dvoustrany: [],
    };
    const n = dvoustranProStran(stran);
    for (let i = 0; i < n; i++) k.dvoustrany.push(novaDvoustrana());
    doplnKnihu(k);
    return k;
  }
  // doplní pole přidaná ve verzi 2 (starší uložené knihy)
  function doplnKnihu(k) {
    const { s, v } = k.format;
    k.obalka = Object.assign({ typ: 'mekka', s, v, presah: 3, hrbet: null, tloustka: 0.15, desky: 0, pozadi: '#ffffff', prvky: [] }, k.obalka || {});
    k.cisla = Object.assign({ zap: false, pismo: 'serif', velikost: 9, barva: '#333333', pozice: 'stred', odspodu: 8 }, k.cisla || {});
    k.verze = 2;
    return k;
  }
  const novaDvoustrana = () => ({ id: nid(), pozadi: '#ffffff', prvky: [] });
  // počet stran se zaokrouhlí nahoru na sudé, min. 2
  const dvoustranProStran = p => Math.max(2, Math.ceil(Math.max(2, p) / 2) + 1);
  const pocetStran = k => 2 * k.dvoustrany.length - 2;

  // číslo strany na dvoustraně di, strana 'L' | 'P'; null = deska
  function cisloStrany(k, di, strana) {
    if (di === 'obalka') return null;
    const n = k.dvoustrany.length;
    if (strana === 'L') return di === 0 ? null : 2 * di;
    return di === n - 1 ? null : 2 * di + 1;
  }
  function popisDvoustrany(k, di) {
    if (di === 'obalka') return 'obálka';
    const l = cisloStrany(k, di, 'L'), p = cisloStrany(k, di, 'P');
    return l && p ? `${l}–${p}` : String(l || p);
  }

  // nastaví počet stran: přidává/ubírá dvoustrany před poslední (poslední strana zůstává poslední)
  function nastavPocetStran(k, stran) {
    const n = dvoustranProStran(stran);
    while (k.dvoustrany.length < n) k.dvoustrany.splice(k.dvoustrany.length - 1, 0, novaDvoustrana());
    while (k.dvoustrany.length > n) k.dvoustrany.splice(k.dvoustrany.length - 2, 1);
  }

  /* ---------- geometrie plochy ---------- */
  const hrbetMm = k => {
    const o = k.obalka;
    return o.hrbet != null ? o.hrbet : Math.max(2, Math.round((pocetStran(k) / 2 * o.tloustka + 2 * o.desky) * 2) / 2);
  };
  const plocha = (k, di) => di === 'obalka' ? k.obalka : k.dvoustrany[di];
  // w × v = ořez, b = spadávka, strany = úseky ve směru x
  function geom(k, di) {
    const { s, v, spad, bezpecna } = k.format;
    if (di === 'obalka') {
      const o = k.obalka, h = hrbetMm(k);
      return { w: 2 * o.s + h, v: o.v, b: o.presah, bezpecna, hrbet: [o.s, o.s + h],
        strany: [{ id: 'L', x: 0, w: o.s, nazev: 'zadní deska' }, { id: 'H', x: o.s, w: h, nazev: 'hřbet' }, { id: 'P', x: o.s + h, w: o.s, nazev: 'přední deska' }] };
    }
    const n = k.dvoustrany.length;
    return { w: 2 * s, v, b: spad, bezpecna, stred: s,
      strany: [{ id: 'L', x: 0, w: s, cislo: cisloStrany(k, di, 'L'), deska: di === 0 },
        { id: 'P', x: s, w: s, cislo: cisloStrany(k, di, 'P'), deska: di === n - 1 }] };
  }
  // obdélník strany / úseku: 'L', 'P', 'H' (hřbet obálky), 'D' = celá plocha
  function oblast(k, strana, di = 1) {
    const g = geom(k, di);
    if (strana === 'D') return { x: 0, y: 0, w: g.w, h: g.v };
    const u = g.strany.find(x => x.id === strana);
    return { x: u.x, y: 0, w: u.w, h: g.v };
  }

  /* ---------- fotka v rámečku ---------- */

  // W, H = rozměr fotky po EXIF otočení (px). Vrací výřez v px a měřítko mm/px.
  function vyrez(p, W, H) {
    const s = Math.max(p.w / W, p.h / H) * (p.zoom || 1);   // mm na px
    const sw = p.w / s, sh = p.h / s;
    const sx = omez((p.cx ?? 0.5) * W - sw / 2, 0, W - sw);
    const sy = omez((p.cy ?? 0.5) * H - sh / 2, 0, H - sh);
    return { sx, sy, sw, sh, s };
  }
  const dpi = (p, W, H) => 25.4 / vyrez(p, W, H).s;
  // posun výřezu o dx, dy mm (tažení fotky v rámečku) – střed se drží v mezích
  function posunVyrez(p, W, H, dx, dy) {
    const v = vyrez(p, W, H);
    p.cx = omez((v.sx + v.sw / 2 - dx / v.s) / W, v.sw / 2 / W, 1 - v.sw / 2 / W);
    p.cy = omez((v.sy + v.sh / 2 - dy / v.s) / H, v.sh / 2 / H, 1 - v.sh / 2 / H);
  }

  /* ---------- text ---------- */
  // šířka řetězce v em (součet posuvů glyfů jako pdf-lib widthOfTextAtSize, bez kerningu)
  function sirkaEm(pismo, t) {
    const f = nactenaPisma.get(pismo);
    if (!f) return t.length * 0.5;
    let w = 0;
    for (const g of f.layout(t).glyphs) w += g.advanceWidth;
    return w / f.unitsPerEm;
  }
  function metrikaEm(pismo) {
    const f = nactenaPisma.get(pismo);
    return f ? { asc: f.ascent / f.unitsPerEm, desc: -f.descent / f.unitsPerEm } : { asc: 0.8, desc: 0.2 };
  }
  const otocen = p => p.otoceni === 90 || p.otoceni === 270;
  // rozložení textu v místních souřadnicích (u podél řádku, v dolů; mm)
  function rozlozText(p) {
    const em = (p.velikost || 12) * 25.4 / 72, bw = otocen(p) ? p.h : p.w, bh = otocen(p) ? p.w : p.h;
    const mer = t => sirkaEm(p.pismo, t) * em, { asc, desc } = metrikaEm(p.pismo);
    const radky = [];
    let pretece = false;
    for (const odst of String(p.text ?? '').split('\n')) {
      let r = '';
      for (const slovo of odst.split(/ +/)) {
        const zkus = r ? r + ' ' + slovo : slovo;
        if (mer(zkus) <= bw + 1e-6 || !r) {
          if (!r && mer(slovo) > bw) {          // dlouhé slovo rozdělit po znacích
            let kus = '';
            for (const z of slovo) {
              if (kus && mer(kus + z) > bw) { radky.push(kus); kus = ''; }
              kus += z;
            }
            r = kus;
          } else r = zkus;
        } else { radky.push(r); r = slovo; }
      }
      radky.push(r);
    }
    const lh = em * (p.radkovani || 1.25);
    const vyska = (radky.length - 1) * lh + (asc + desc) * em;
    if (vyska > bh + 0.05) pretece = true;
    const v0 = p.svisle === 'dolu' ? bh - vyska : p.svisle === 'stred' ? (bh - vyska) / 2 : 0;
    return {
      em, pretece, uhel: p.otoceni || 0,
      radky: radky.map((t, i) => {
        const w = mer(t), u = p.zarovnani === 'stred' ? (bw - w) / 2 : p.zarovnani === 'vpravo' ? bw - w : 0;
        return { t, u, v: v0 + asc * em + i * lh, w };
      }),
    };
  }
  // místní (u, v) → souřadnice plochy podle otočení
  function bodTextu(p, u, v) {
    if (p.otoceni === 90) return [p.x + p.w - v, p.y + u];
    if (p.otoceni === 270) return [p.x + v, p.y + p.h - u];
    return [p.x + u, p.y + v];
  }
  const novyText = (r, text = 'Text') => ({ id: nid(), typ: 'text', x: r.x, y: r.y, w: r.w, h: r.h, text,
    pismo: 'serif', velikost: 18, barva: '#222222', zarovnani: 'stred', svisle: 'stred', otoceni: 0, radkovani: 1.25 });

  /* ---------- předlohy rozvržení ---------- */
  // ramy v jednotkách obsahové plochy (0–1); bez:true = do spadávky bez okraje; t = textové pole
  const PREDLOHY = [
    { id: '1', nazev: 'Jedna fotka', ramy: [[0, 0, 1, 1]] },
    { id: '1b', nazev: 'Přes celou stranu', bez: true, ramy: [[0, 0, 1, 1]] },
    { id: '1m', nazev: 'Menší uprostřed', ramy: [[0.14, 0.14, 0.72, 0.72]] },
    { id: '1t', nazev: 'Fotka s popiskem', ramy: [[0, 0, 1, 0.84], [0, 0.88, 1, 0.12, 't']] },
    { id: '2v', nazev: 'Dvě vedle sebe', ramy: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
    { id: '2n', nazev: 'Dvě nad sebou', ramy: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
    { id: '3a', nazev: 'Velká nahoře, dvě dole', ramy: [[0, 0, 1, 0.6], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]] },
    { id: '3b', nazev: 'Velká vlevo, dvě vpravo', ramy: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]] },
    { id: '3s', nazev: 'Tři pruhy', ramy: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
    { id: '4', nazev: 'Mřížka 2 × 2', ramy: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
    { id: '6', nazev: 'Mřížka 2 × 3', ramy: mrizka(2, 3) },
    { id: '9', nazev: 'Mřížka 3 × 3', ramy: mrizka(3, 3) },
    { id: 't', nazev: 'Jen text', ramy: [[0.1, 0.3, 0.8, 0.4, 't']] },
  ];
  const PREDLOHY_DVOUSTRANY = [
    { id: 'pan', nazev: 'Panorama s okrajem', ramy: [[0, 0, 1, 1]] },
    { id: 'panb', nazev: 'Panorama přes dvoustranu', bez: true, ramy: [[0, 0, 1, 1]] },
    { id: 'pan3', nazev: 'Panorama + dvě dole', ramy: [[0, 0, 1, 0.62], [0, 0.62, 0.5, 0.38], [0.5, 0.62, 0.5, 0.38]] },
  ];
  function mrizka(sl, ra) {
    const r = [];
    for (let j = 0; j < ra; j++) for (let i = 0; i < sl; i++) r.push([i / sl, j / ra, 1 / sl, 1 / ra]);
    return r;
  }
  const predloha = id => [...PREDLOHY, ...PREDLOHY_DVOUSTRANY].find(p => p.id === id);

  // obdélníky rámečků předlohy v mm (+ typ 'foto' / 'text')
  function ramyPredlohy(k, strana, pr, di = 1) {
    const { okraj, mezera: g } = k.format, G = geom(k, di), b = G.b;
    const o = oblast(k, strana, di);
    let box;
    if (pr.bez) {
      // do spadávky na vnějších hranách, u hřbetu / ohybu přesně na hranu
      const vlevo = o.x <= 1e-6 ? b : 0, vpravo = o.x + o.w >= G.w - 1e-6 ? b : 0;
      box = { x: o.x - vlevo, y: -b, w: o.w + vlevo + vpravo, h: o.h + 2 * b };
    } else box = { x: o.x + okraj, y: okraj, w: o.w - 2 * okraj, h: o.h - 2 * okraj };
    const mez = pr.bez && pr.ramy.length === 1 ? 0 : g;
    return pr.ramy.map(([ux, uy, uw, uh, typ]) => {
      let x1 = box.x + ux * box.w, x2 = box.x + (ux + uw) * box.w;
      let y1 = box.y + uy * box.h, y2 = box.y + (uy + uh) * box.h;
      if (ux > 1e-6) x1 += mez / 2;
      if (ux + uw < 1 - 1e-6) x2 -= mez / 2;
      if (uy > 1e-6) y1 += mez / 2;
      if (uy + uh < 1 - 1e-6) y2 -= mez / 2;
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, typ: typ === 't' ? 'text' : 'foto' };
    });
  }

  const vOblasti = (p, o) => {
    const cx = p.x + p.w / 2;
    return cx >= o.x && cx < o.x + o.w;
  };

  // nahradí rámečky v oblasti předlohou; fotky (a texty) se přenesou v pořadí čtení
  function pouzijPredlohu(k, di, strana, predlohaId) {
    const pr = predloha(predlohaId);
    if (!pr) throw new Error('neznámá předloha ' + predlohaId);
    const d = plocha(k, di), o = oblast(k, strana, di);
    const stare = d.prvky.filter(p => vOblasti(p, o)).sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const fotky = stare.filter(p => p.typ === 'foto' && p.foto).map(p => p.foto);
    const texty = stare.filter(p => p.typ === 'text');
    d.prvky = d.prvky.filter(p => !stare.includes(p));
    let fi = 0, ti = 0;
    const nove = ramyPredlohy(k, strana, pr, di).map(r => {
      if (r.typ === 'text') {
        const t = texty[ti++];
        return t ? Object.assign(t, { x: r.x, y: r.y, w: r.w, h: r.h }) : { ...novyText(r, 'Popisek'), velikost: 11 };
      }
      return novyRamecek(r, fotky[fi++] || null);
    });
    d.prvky.push(...nove);
    return nove;
  }
  const novyRamecek = (r, foto = null) => ({ id: nid(), typ: 'foto', x: r.x, y: r.y, w: r.w, h: r.h, foto, zoom: 1, cx: 0.5, cy: 0.5 });

  /* ---------- automatické rozvržení ----------
     ids = fotky v pořadí; naStranu 1–4 nebo 'mix'; plní prázdné strany od dvoustrany odDi,
     chybějící dvoustrany přidá před poslední. Vrací počet zaplněných stran. */
  const VZOREK_MIX = [2, 1, 3, 2, 4, 1, 3, 2];
  function automatickeRozvrzeni(k, ids, { naStranu = 'mix', odDi = 0, bezOkraje = false } = {}) {
    const foto = new Map(k.fotky.map(f => [f.id, f]));
    const fronta = ids.filter(id => foto.has(id)), skupiny = [];
    for (let i = 0, mix = 0; i < fronta.length;) {
      const n = naStranu === 'mix' ? VZOREK_MIX[mix++ % VZOREK_MIX.length] : +naStranu;
      skupiny.push(fronta.slice(i, i + n)); i += n;
    }
    const prazdne = () => {
      const r = [];
      for (let di = odDi; di < k.dvoustrany.length; di++) for (const strana of ['L', 'P']) {
        if (cisloStrany(k, di, strana) === null) continue;
        const o = oblast(k, strana, di);
        if (!k.dvoustrany[di].prvky.some(p => vOblasti(p, o))) r.push([di, strana]);
      }
      return r;
    };
    // chybějící strany: nové dvoustrany před poslední
    while (prazdne().length < skupiny.length) k.dvoustrany.splice(k.dvoustrany.length - 1, 0, novaDvoustrana());
    const volne = prazdne();
    skupiny.forEach((vyber, i) => {
      const [di, strana] = volne[i], n = vyber.length, siroke = vyber.map(id => foto.get(id).w >= foto.get(id).h);
      const id = n === 1 ? (bezOkraje ? '1b' : '1') : n === 2 ? (siroke.every(Boolean) ? '2n' : '2v') : n === 3 ? (siroke[0] ? '3a' : '3b') : '4';
      ramyPredlohy(k, strana, predloha(id), di).forEach((r, j) => k.dvoustrany[di].prvky.push(novyRamecek(r, vyber[j])));
    });
    return skupiny.length;
  }

  /* ---------- přichytávání ---------- */
  function cary(k, di, krome) {
    const g = geom(k, di), { okraj } = k.format, b = g.b;
    const xs = [-b, g.w + b, g.w / 2], ys = [-b, 0, okraj, g.v / 2, g.v - okraj, g.v, g.v + b];
    for (const u of g.strany) xs.push(u.x, u.x + u.w, u.x + okraj, u.x + u.w - okraj, u.x + u.w / 2);
    for (const p of plocha(k, di).prvky) {
      if (p === krome || p.id === krome?.id) continue;
      xs.push(p.x, p.x + p.w, p.x + p.w / 2); ys.push(p.y, p.y + p.h, p.y + p.h / 2);
    }
    return { xs, ys };
  }
  // nejbližší přichycení hodnot hrany (pole) k čarám; vrací posun nebo 0
  function prichyt(hodnoty, cary, prah) {
    let nej = null;
    for (const h of hodnoty) for (const c of cary) {
      const d = c - h;
      if (Math.abs(d) <= prah && (nej === null || Math.abs(d) < Math.abs(nej))) nej = d;
    }
    return nej ?? 0;
  }

  /* ---------- kontrola před tiskem ---------- */
  function kontrola(k) {
    const vys = [], foto = new Map(k.fotky.map(f => [f.id, f])), tol = 0.3, pouzito = new Map();
    const plochy = [...k.dvoustrany.map((d, i) => i), ...(k.obalka.prvky.length ? ['obalka'] : [])];
    for (const di of plochy) {
      const d = plocha(k, di), g = geom(k, di), b = g.b, bezp = g.bezpecna;
      const kde = di === 'obalka' ? 'Obálka' : 'Strany ' + popisDvoustrany(k, di);
      const lev = di === 0 ? g.strany[1].x : 0, prav = di === k.dvoustrany.length - 1 ? g.strany[0].w : g.w;
      for (const p of d.prvky) {
        const pridej = (uroven, text) => vys.push({ uroven, di, prvek: p.id, text: `${kde}: ${text}` });
        if (p.typ === 'text') {
          if (!String(p.text || '').trim()) pridej('varovani', 'prázdné textové pole');
          else if (rozlozText(p).pretece) pridej('chyba', `text „${String(p.text).slice(0, 30)}“ se nevejde do pole`);
          if (p.x < lev + bezp - tol || p.x + p.w > prav - bezp + tol || p.y < bezp - tol || p.y + p.h > g.v - bezp + tol)
            pridej('varovani', 'text zasahuje mimo bezpečnou zónu – u ořezu může být odříznut');
          if (g.hrbet && p.x < g.hrbet[1] && p.x + p.w > g.hrbet[0] && (p.x < g.hrbet[0] - tol || p.x + p.w > g.hrbet[1] + tol))
            pridej('varovani', 'text přechází přes ohyb hřbetu');
          continue;
        }
        if (p.typ !== 'foto') continue;
        if (!p.foto) { pridej('varovani', 'prázdný rámeček (nevytiskne se)'); continue; }
        const f = foto.get(p.foto);
        if (!f) { pridej('chyba', 'chybí fotka'); continue; }
        pouzito.set(p.foto, (pouzito.get(p.foto) || 0) + 1);
        const r = Math.round(dpi(p, f.w, f.h));
        if (r < DPI_CHYBA) pridej('chyba', `„${f.nazev}“ má jen ${r} DPI – bude rozmazaná`);
        else if (r < DPI_VAROVANI) pridej('varovani', `„${f.nazev}“ má ${r} DPI – na tisk hraniční`);
        // hrana u ořezu, která nedosahuje do spadávky (hrozí bílá linka) – jen vnější hrany
        const hrany = [];
        if (p.x > lev - b + tol && p.x < lev + bezp && p.x + p.w > lev) hrany.push('vlevo');
        if (p.x + p.w < prav + b - tol && p.x + p.w > prav - bezp && p.x < prav) hrany.push('vpravo');
        if (p.y > -b + tol && p.y < bezp) hrany.push('nahoře');
        if (p.y + p.h < g.v + b - tol && p.y + p.h > g.v - bezp) hrany.push('dole');
        if (hrany.length) pridej('varovani', `rámeček je ${hrany.join(', ')} blízko ořezu – natáhněte ho do spadávky, nebo odsuňte dál`);
        if (di !== 'obalka') {
          const s = g.stred;
          if (k.vazba !== 'layflat' && p.x < s - 2 && p.x + p.w > s + 2 && di > 0 && di < k.dvoustrany.length - 1)
            pridej('info', 'fotka přes hřbet – střed se ztratí ve vazbě');
          if ((di === 0 && p.x + p.w <= s) || (di === k.dvoustrany.length - 1 && p.x >= s))
            pridej('varovani', 'rámeček leží na desce – nevytiskne se');
        }
      }
    }
    for (const [id, n] of pouzito) if (n > 1) vys.push({ uroven: 'info', di: null, text: `„${foto.get(id).nazev}“ je v knize ${n}×` });
    const prazdne = [];
    k.dvoustrany.forEach((d, di) => geom(k, di).strany.forEach(u => {
      if (u.cislo && !d.prvky.some(p => vOblasti(p, oblast(k, u.id, di)))) prazdne.push(u.cislo);
    }));
    if (prazdne.length) vys.push({ uroven: 'info', di: null, text: `prázdné strany: ${prazdne.join(', ')}` });
    return vys;
  }

  /* ---------- archy tisku ---------- */
  // rezim 'strany' = každá strana zvlášť, 'dvoustrany' = vnitřní dvoustrany vcelku, 'obalka'
  function archy(k, rezim) {
    if (rezim === 'obalka') return [{ di: 'obalka', x0: 0, w: geom(k, 'obalka').w, strany: [] }];
    const { s } = k.format, a = [];
    k.dvoustrany.forEach((d, di) => {
      const L = cisloStrany(k, di, 'L'), P = cisloStrany(k, di, 'P');
      if (rezim === 'dvoustrany' && L && P) a.push({ di, x0: 0, w: 2 * s, strany: [L, P] });
      else {
        if (L) a.push({ di, x0: 0, w: s, strany: [L] });
        if (P) a.push({ di, x0: s, w: s, strany: [P] });
      }
    });
    return a;
  }

  // čísla stran jako textové prvky (soustava plochy)
  function prvkyCisel(k, di) {
    const c = k.cisla;
    if (!c.zap || di === 'obalka' || k.dvoustrany[di].bezCisel) return [];
    const g = geom(k, di), w = 30, h = c.velikost * 25.4 / 72 * 1.6;
    return g.strany.filter(u => u.cislo).map(u => {
      const x = c.pozice === 'vnejsi' ? (u.id === 'L' ? u.x + k.format.okraj : u.x + u.w - k.format.okraj - w) : u.x + (u.w - w) / 2;
      return { id: 'cislo' + u.cislo, typ: 'text', x, y: g.v - c.odspodu - h, w, h, text: String(u.cislo), pismo: c.pismo,
        velikost: c.velikost, barva: c.barva, zarovnani: c.pozice === 'vnejsi' ? (u.id === 'L' ? 'vlevo' : 'vpravo') : 'stred', svisle: 'dolu', otoceni: 0 };
    });
  }

  /* ---------- scéna archu ----------
     operace v mm archu (0,0 = levý horní roh spadávky):
     {op:'plocha', barva} · {op:'foto', id, orez:{x,y,w,h}, obr:{x,y,w,h}} ·
     {op:'okraj', x,y,w,h, sirka, barva} · {op:'text', t, x, y, pismo, velikost, barva, uhel} */
  function scena(k, a) {
    const g = geom(k, a.di), d = plocha(k, a.di), b = g.b, foto = new Map(k.fotky.map(f => [f.id, f]));
    const W = a.w + 2 * b, H = g.v + 2 * b, ox = b - a.x0, oy = b;
    const ops = [{ op: 'plocha', barva: d.pozadi || '#ffffff', w: W, h: H }];
    const ax1 = a.x0 - b, ax2 = a.x0 + a.w + b;
    for (const p of [...d.prvky, ...prvkyCisel(k, a.di)]) {
      if (p.x + p.w <= ax1 || p.x >= ax2) continue;
      if (p.typ === 'foto') {
        const f = p.foto && foto.get(p.foto);
        if (f) {
          const x1 = Math.max(p.x, ax1), x2 = Math.min(p.x + p.w, ax2), y1 = Math.max(p.y, -b), y2 = Math.min(p.y + p.h, g.v + b);
          if (x2 > x1 && y2 > y1) {
            const vy = vyrez(p, f.w, f.h);
            ops.push({ op: 'foto', id: p.foto, orez: { x: x1 + ox, y: y1 + oy, w: x2 - x1, h: y2 - y1 },
              obr: { x: p.x - vy.sx * vy.s + ox, y: p.y - vy.sy * vy.s + oy, w: f.w * vy.s, h: f.h * vy.s } });
          }
        }
        if (p.okraj?.sirka > 0 && (f || p.okraj.iPrazdny))
          ops.push({ op: 'okraj', x: p.x + ox, y: p.y + oy, w: p.w, h: p.h, sirka: p.okraj.sirka, barva: p.okraj.barva || '#ffffff' });
      } else if (p.typ === 'text') {
        const r = rozlozText(p);
        for (const ln of r.radky) {
          if (!ln.t) continue;
          const [x, y] = bodTextu(p, ln.u, ln.v);
          ops.push({ op: 'text', t: ln.t, x: x + ox, y: y + oy, pismo: p.pismo, velikost: p.velikost, barva: p.barva || '#000000', uhel: r.uhel });
        }
      }
    }
    return { w: W, h: H, ops };
  }

  /* ---------- EXIF ---------- */
  // surové souřadnice (x, y dolů, 0–1) → zobrazené
  const ORIENT = {
    1: (x, y) => [x, y], 2: (x, y) => [1 - x, y], 3: (x, y) => [1 - x, 1 - y], 4: (x, y) => [x, 1 - y],
    5: (x, y) => [y, x], 6: (x, y) => [1 - y, x], 7: (x, y) => [1 - y, 1 - x], 8: (x, y) => [y, 1 - x],
  };
  // matice PDF (a b c d e f), která jednotkový čtverec surového obrázku (v nahoru)
  // položí do obdélníku X0, Y0 (levý dolní roh), DW × DH zobrazeného obrázku
  function maticeOrientace(o, X0, Y0, DW, DH) {
    const f = ORIENT[o] || ORIENT[1];
    const bod = (u, v) => { const [X, Y] = f(u, 1 - v); return [X0 + X * DW, Y0 + (1 - Y) * DH]; };
    const [e, ff] = bod(0, 0), [ax, ay] = bod(1, 0), [cx, cy] = bod(0, 1);
    return [ax - e, ay - ff, cx - e, cy - ff, e, ff];
  }
  // datum pořízení z EXIF (DateTimeOriginal, jinak DateTime) → ms, nebo null
  function exifDatum(u8) {
    if (u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let o = 2;
    while (o + 10 < u8.length && u8[o] === 0xFF) {
      const znacka = u8[o + 1], delka = dv.getUint16(o + 2);
      if (znacka === 0xE1 && dv.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = dv.getUint16(t) === 0x4949;
        const tagy = ifd => {
          const m = new Map(), n = dv.getUint16(t + ifd, le);
          for (let i = 0; i < n; i++) { const e = t + ifd + 2 + i * 12; m.set(dv.getUint16(e, le), e); }
          return m;
        };
        const text = e => {
          const n = dv.getUint32(e + 4, le), off = n > 4 ? t + dv.getUint32(e + 8, le) : e + 8;
          return String.fromCharCode(...u8.subarray(off, off + Math.min(n, 19)));
        };
        try {
          const i0 = tagy(dv.getUint32(t + 4, le));
          let e = null;
          if (i0.has(0x8769)) e = tagy(dv.getUint32(i0.get(0x8769) + 8, le)).get(0x9003) ?? null;
          if (e == null) e = i0.get(0x0132) ?? null;
          if (e == null) return null;
          const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(text(e));
          return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
        } catch (er) { return null; }
      }
      if (znacka === 0xDA) return null;
      o += 2 + delka;
    }
    return null;
  }

  const hexNaRgb = h => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    const n = m ? parseInt(m[1], 16) : 0xffffff;
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };

  /* ---------- export PDF ----------
     nactiFoto(id) → { bytes: Uint8Array, typ: 'jpg'|'png', orient } (originál)
     moznosti: { rezim: 'strany'|'dvoustrany'|'obalka', znacky, pismo(id) → bytes, fontkit, prubeh(i, n) } */
  async function exportPdf(k, nactiFoto, { rezim = 'strany', znacky = false, pismo, fontkit, prubeh } = {}) {
    const L = koren.PDFLib;
    const doc = await L.PDFDocument.create();
    doc.setTitle(k.nazev + (rezim === 'obalka' ? ' – obálka' : '')); doc.setCreator('Fotokniha – lavionus.github.io/site');
    if (fontkit) doc.registerFontkit(fontkit);
    const m = znacky ? 10 : 0;                         // pole pro ořezové značky (mm)
    const vlozene = new Map(), pisma = new Map();
    const seznam = archy(k, rezim);
    for (let i = 0; i < seznam.length; i++) {
      const a = seznam[i], g = geom(k, a.di), b = g.b, sc = scena(k, a);
      prubeh?.(i, seznam.length);
      const page = doc.addPage([(sc.w + 2 * m) * PT, (sc.h + 2 * m) * PT]);
      page.setBleedBox(m * PT, m * PT, sc.w * PT, sc.h * PT);
      page.setTrimBox((m + b) * PT, (m + b) * PT, a.w * PT, g.v * PT);
      const X = x => (m + x) * PT, Y = y => (m + sc.h - y) * PT;
      for (const o of sc.ops) {
        if (o.op === 'plocha') {
          const [r, gg, bl] = hexNaRgb(o.barva);
          page.drawRectangle({ x: X(0), y: Y(o.h), width: o.w * PT, height: o.h * PT, color: L.rgb(r, gg, bl) });
        } else if (o.op === 'foto') {
          let img = vlozene.get(o.id);
          if (!img) {
            const z = await nactiFoto(o.id);
            img = { emb: z.typ === 'png' ? await doc.embedPng(z.bytes) : await doc.embedJpg(z.bytes), orient: z.orient || 1 };
            vlozene.set(o.id, img);
          }
          const jmeno = page.node.newXObject('Image', img.emb.ref);
          const mat = maticeOrientace(img.orient, X(o.obr.x), Y(o.obr.y + o.obr.h), o.obr.w * PT, o.obr.h * PT);
          page.pushOperators(
            L.pushGraphicsState(),
            L.rectangle(X(o.orez.x), Y(o.orez.y + o.orez.h), o.orez.w * PT, o.orez.h * PT), L.clip(), L.endPath(),
            L.concatTransformationMatrix(...mat),
            L.drawObject(jmeno),
            L.popGraphicsState(),
          );
        } else if (o.op === 'okraj') {
          const [r, gg, bl] = hexNaRgb(o.barva), s = o.sirka;
          page.drawRectangle({ x: X(o.x + s / 2), y: Y(o.y + o.h - s / 2), width: (o.w - s) * PT, height: (o.h - s) * PT,
            borderColor: L.rgb(r, gg, bl), borderWidth: s * PT });
        } else if (o.op === 'text') {
          let f = pisma.get(o.pismo);
          if (!f) {
            if (!pismo) throw new Error('chybí písmo ' + o.pismo);
            f = await doc.embedFont(await pismo(o.pismo), { subset: true });
            pisma.set(o.pismo, f);
          }
          const [r, gg, bl] = hexNaRgb(o.barva);
          page.drawText(o.t, { x: X(o.x), y: Y(o.y), size: o.velikost, font: f, color: L.rgb(r, gg, bl),
            rotate: L.degrees(o.uhel === 90 ? -90 : o.uhel === 270 ? 90 : 0) });
        }
      }
      if (znacky) {
        kresliZnacky(page, L, m, b, a.w, g.v);
        if (g.hrbet) for (const x of g.hrbet) carkaOhybu(page, L, m, b, x, g.v);
      }
    }
    return doc.save();
  }

  function kresliZnacky(page, L, m, b, w, v) {
    const c = { thickness: 0.25, color: L.rgb(0, 0, 0) };
    const x1 = (m + b) * PT, x2 = (m + b + w) * PT, y1 = (m + b) * PT, y2 = (m + b + v) * PT;
    const d2 = (m - 1) * PT;                           // značka od kraje archu k 1 mm před spadávkou
    for (const x of [x1, x2]) {
      page.drawLine({ start: { x, y: 0 }, end: { x, y: d2 }, ...c });
      page.drawLine({ start: { x, y: y2 + (b + 1) * PT }, end: { x, y: y2 + (b + m) * PT }, ...c });
    }
    for (const y of [y1, y2]) {
      page.drawLine({ start: { x: 0, y }, end: { x: d2, y }, ...c });
      page.drawLine({ start: { x: x2 + (b + 1) * PT, y }, end: { x: x2 + (b + m) * PT, y }, ...c });
    }
  }
  // čárkovaná značka ohybu hřbetu nad a pod obálkou
  function carkaOhybu(page, L, m, b, x, v) {
    const X = (m + b + x) * PT, c = { thickness: 0.25, color: L.rgb(0, 0, 0), dashArray: [2, 2] };
    page.drawLine({ start: { x: X, y: 0 }, end: { x: X, y: (m - 1) * PT }, ...c });
    page.drawLine({ start: { x: X, y: (m + 2 * b + v + 1) * PT }, end: { x: X, y: (2 * m + 2 * b + v) * PT }, ...c });
  }

  /* ---------- vykreslení archu na plátno (JPEG) ----------
     ziskejObraz(id) → Promise<ImageBitmap> (již otočený podle EXIF); písma musí být načtená
     v document.fonts pod jménem rodinaPisma(id) */
  const rodinaPisma = id => 'fk-' + id;
  async function kresliArch(ctx, k, a, px, ziskejObraz) {
    const sc = scena(k, a), foto = new Map(k.fotky.map(f => [f.id, f]));
    for (const o of sc.ops) {
      if (o.op === 'plocha') { ctx.fillStyle = o.barva; ctx.fillRect(0, 0, o.w * px, o.h * px); }
      else if (o.op === 'foto') {
        const obr = await ziskejObraz(o.id), f = foto.get(o.id), q = obr.width / f.w;
        // výřez obrázku odpovídající ořezové oblasti (kreslí se jen to, co je vidět)
        const s = o.obr.w / f.w;
        const sx = (o.orez.x - o.obr.x) / s, sy = (o.orez.y - o.obr.y) / s;
        ctx.drawImage(obr, sx * q, sy * q, o.orez.w / s * q, o.orez.h / s * q, o.orez.x * px, o.orez.y * px, o.orez.w * px, o.orez.h * px);
        obr.close?.();
      } else if (o.op === 'okraj') {
        ctx.strokeStyle = o.barva; ctx.lineWidth = o.sirka * px;
        ctx.strokeRect((o.x + o.sirka / 2) * px, (o.y + o.sirka / 2) * px, (o.w - o.sirka) * px, (o.h - o.sirka) * px);
      } else if (o.op === 'text') {
        ctx.save();
        ctx.translate(o.x * px, o.y * px);
        if (o.uhel) ctx.rotate(o.uhel === 90 ? Math.PI / 2 : -Math.PI / 2);
        ctx.font = `${o.velikost * 25.4 / 72 * px}px "${rodinaPisma(o.pismo)}"`;
        if ('fontKerning' in ctx) ctx.fontKerning = 'none';
        ctx.fillStyle = o.barva; ctx.textBaseline = 'alphabetic';
        ctx.fillText(o.t, 0, 0);
        ctx.restore();
      }
    }
  }

  // nastaví hustotu v hlavičce JFIF (canvas píše 1:1 bez jednotek)
  function jfifDpi(u8, dpi) {
    if (u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF && u8[3] === 0xE0 &&
        String.fromCharCode(u8[6], u8[7], u8[8], u8[9]) === 'JFIF') {
      u8[13] = 1; u8[14] = dpi >> 8; u8[15] = dpi & 255; u8[16] = dpi >> 8; u8[17] = dpi & 255;
    }
    return u8;
  }

  // ZIP bez komprese (jak ho píše PDFDILNA.zip) → [{name, data}]
  function rozbalZip(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), dek = new TextDecoder(), vys = [];
    let o = 0;
    while (o + 30 <= u8.length && dv.getUint32(o, true) === 0x04034b50) {
      const metoda = dv.getUint16(o + 8, true), vel = dv.getUint32(o + 18, true);
      const nj = dv.getUint16(o + 26, true), ne = dv.getUint16(o + 28, true);
      if (metoda !== 0) throw new Error('ZIP je komprimovaný – načíst jde jen záloha z Fotoknihy');
      const name = dek.decode(u8.subarray(o + 30, o + 30 + nj)), zac = o + 30 + nj + ne;
      vys.push({ name, data: u8.subarray(zac, zac + vel) });
      o = zac + vel;
    }
    return vys;
  }

  const api = {
    PT, DPI_CHYBA, DPI_VAROVANI, FORMATY, VAZBY, PISMA, PREDLOHY, PREDLOHY_DVOUSTRANY, nid, omez,
    novaKniha, doplnKnihu, novaDvoustrana, dvoustranProStran, pocetStran, cisloStrany, popisDvoustrany, nastavPocetStran,
    hrbetMm, plocha, geom, oblast, vyrez, dpi, posunVyrez,
    registrujPismo, nactenaPisma, sirkaEm, metrikaEm, rozlozText, bodTextu, novyText, rodinaPisma,
    predloha, ramyPredlohy, pouzijPredlohu, novyRamecek, automatickeRozvrzeni, cary, prichyt,
    kontrola, archy, prvkyCisel, scena, maticeOrientace, exifDatum, hexNaRgb, exportPdf, kresliArch, jfifDpi, rozbalZip,
  };
  koren.FOTOKNIHA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
