/* Klíčenky a jmenovky – jádro bez DOM (běží i v node).
   Parametry a jejich normalizace, rozvržení textu z písma (opentype.js Font), stavba dílů přes manifold-3d
   (CrossSection: offset = Clipper2 uvnitř manifoldu, booleany, vysunutí), výšky vrstev pro výměnu barvy,
   pokyny pro slicery (M600 / PAUSE), kontroly, dávka jmen na podložku, export 3MF s barevnými díly.

   sestav(w, font, p) → {dily: [{jmeno, nazev, role, poz, idx, objem}], odv, info}
     w = inicializovaný manifold (po setup()), font = opentype Font, p = normalizovaný projekt.
   Souřadnice = tisková poloha: podklad leží na z = 0, text nahoře, osa y nahoru při pohledu shora. */
(function () {
  'use strict';
  const KRAB = typeof module !== 'undefined' ? require('../krabicky/jadro.js') : window.KRAB;
  const VERZE_FORMATU = 1;

  const VYCHOZI = {
    nazev: 'Klíčenka',
    text: { obsah: 'Klára', pismo: 'titan', velikost: 12, naSirku: 0, radkovani: 1.45, zarovnani: 'stred', rezim: 'vystouply', vyska: 1, hloubka: 0.6, otoceni: 0 },
    podklad: { tvar: 'obrys', okraj: 3, spoj: 1.5, zaobleni: 3, tloustka: 2.4, pevny: false, sirka: 50, vyska: 20 },
    ocko: { zap: true, poloha: 'vlevo', prumer: 4.5, stena: 2 },
    ramecek: { zap: false, sirka: 1.2 },
    magnet: { zap: false, prumer: 10, vyska: 2, vule: 0.2, dno: 0.6 },
    stojanek: { zap: false, uhel: 15, hloubka: 6, vule: 0.25 },
    barvy: { podklad: '#2B2D42', text: '#F2E9E4', ramecek: '#E63946' },
    tisk: { rezim: 'jedna', vrstva: 0.2, prvni: 0.2, prichytit: true, material: 'PLA', vypln: 20, podlozka: 220 },
    davka: { jmena: '', mezera: 5 },
  };
  const ROZSAHY = {
    'text.velikost': [3, 80], 'text.naSirku': [0, 300], 'text.radkovani': [0.9, 3], 'text.vyska': [0.2, 10], 'text.hloubka': [0.2, 5],
    'podklad.okraj': [0.5, 30], 'podklad.spoj': [0, 10], 'podklad.zaobleni': [0, 50], 'podklad.tloustka': [0.6, 20],
    'podklad.sirka': [10, 300], 'podklad.vyska': [8, 300],
    'ocko.prumer': [1.5, 20], 'ocko.stena': [0.8, 10], 'ramecek.sirka': [0.4, 10],
    'magnet.prumer': [2, 60], 'magnet.vyska': [0.5, 15], 'magnet.vule': [0, 1], 'magnet.dno': [0.2, 5],
    'stojanek.uhel': [0, 35], 'stojanek.hloubka': [2, 30], 'stojanek.vule': [0, 1.5],
    'tisk.vrstva': [0.04, 0.6], 'tisk.prvni': [0.04, 0.8], 'tisk.vypln': [0, 100], 'tisk.podlozka': [80, 600],
    'davka.mezera': [1, 50],
  };
  const VOLBY = {
    'text.zarovnani': ['stred', 'vlevo', 'vpravo'], 'text.rezim': ['vystouply', 'vyryty', 'zarovnany'], 'text.otoceni': [0, 90],
    'podklad.tvar': ['obrys', 'obdelnik', 'zaobleny', 'oval', 'stitek'], 'ocko.poloha': ['vlevo', 'vpravo', 'nahore'],
    'tisk.rezim': ['jedna', 'vice'], 'tisk.material': ['PLA', 'PETG', 'ABS', 'ASA', 'TPU'],
  };
  const NAZVY = {
    rezim: { vystouply: 'vystouplý', vyryty: 'vyrytý', zarovnany: 'zarovnaný (vykládaný)' },
    tvar: { obrys: 'obrys textu', obdelnik: 'obdélník', zaobleny: 'zaoblený obdélník', oval: 'ovál', stitek: 'štítek s ouškem' },
  };
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 }, PETG: { nazev: 'PETG', hustota: 1.27 }, ABS: { nazev: 'ABS', hustota: 1.04 },
    ASA: { nazev: 'ASA', hustota: 1.07 }, TPU: { nazev: 'TPU', hustota: 1.21 },
  };
  const MAX_RADKU = 3;

  // předvolby přepíší tvar, výšky a doplňky; text a barvy zůstanou
  const PREDVOLBY = [
    { nazev: 'Klíčenka – bublina kolem jména', popis: 'obrys textu, očko vlevo, vystouplý text',
      p: { podklad: { tvar: 'obrys', okraj: 3, spoj: 1.5, tloustka: 2.4, pevny: false }, text: { rezim: 'vystouply', vyska: 1, velikost: 12, naSirku: 0, otoceni: 0 },
        ocko: { zap: true, poloha: 'vlevo', prumer: 4.5, stena: 2 }, ramecek: { zap: false }, magnet: { zap: false }, stojanek: { zap: false } } },
    { nazev: 'Štítek s ouškem a rámečkem', popis: 'tři barvy: podklad, text, rámeček',
      p: { podklad: { tvar: 'stitek', okraj: 4, zaobleni: 3, tloustka: 2.4, pevny: false }, text: { rezim: 'vystouply', vyska: 1, velikost: 10, naSirku: 0, otoceni: 0 },
        ocko: { zap: true, poloha: 'vlevo', prumer: 4.5, stena: 2 }, ramecek: { zap: true, sirka: 1.2 }, magnet: { zap: false }, stojanek: { zap: false } } },
    { nazev: 'Vyrytá klíčenka', popis: 'zaoblený obdélník, dno rytiny v barvě textu',
      p: { podklad: { tvar: 'zaobleny', okraj: 3.5, zaobleni: 4, tloustka: 3, pevny: false }, text: { rezim: 'vyryty', hloubka: 0.8, velikost: 10, naSirku: 0, otoceni: 0 },
        ocko: { zap: true, poloha: 'vlevo', prumer: 4.5, stena: 2 }, ramecek: { zap: false }, magnet: { zap: false }, stojanek: { zap: false } } },
    { nazev: 'Magnet na lednici', popis: 'ovál, skrytý magnet ⌀ 10 × 2 mm s pauzou',
      p: { podklad: { tvar: 'oval', okraj: 4, tloustka: 3.6, pevny: false }, text: { rezim: 'vystouply', vyska: 1, velikost: 14, naSirku: 0, otoceni: 0 },
        ocko: { zap: false }, ramecek: { zap: false }, magnet: { zap: true, prumer: 10, vyska: 2, vule: 0.2, dno: 0.6 }, stojanek: { zap: false } } },
    { nazev: 'Jmenovka na stůl', popis: '90 × 30 mm se stojánkem (sklon 15°)',
      p: { podklad: { tvar: 'zaobleny', okraj: 7, zaobleni: 3, tloustka: 3, pevny: true, sirka: 90, vyska: 30 }, text: { rezim: 'vystouply', vyska: 1, velikost: 14, naSirku: 0, otoceni: 0 },
        ocko: { zap: false }, ramecek: { zap: true, sirka: 1.2 }, magnet: { zap: false }, stojanek: { zap: true, uhel: 15, hloubka: 6, vule: 0.25 } } },
    { nazev: 'Záložka do knihy', popis: '35 × 150 mm, text svisle, očko na střapec nahoře',
      p: { podklad: { tvar: 'zaobleny', okraj: 4, zaobleni: 5, tloustka: 1.2, pevny: true, sirka: 35, vyska: 150 }, text: { rezim: 'vystouply', vyska: 0.6, velikost: 20, naSirku: 0, otoceni: 90 },
        ocko: { zap: true, poloha: 'nahore', prumer: 4, stena: 2 }, ramecek: { zap: false }, magnet: { zap: false }, stojanek: { zap: false } } },
    { nazev: 'Vykládaná klíčenka (AMS / MMU)', popis: 'text zarovnaný s podkladem, tisk více barvami',
      p: { podklad: { tvar: 'zaobleny', okraj: 3.5, zaobleni: 4, tloustka: 2.8, pevny: false }, text: { rezim: 'zarovnany', hloubka: 0.6, velikost: 10, naSirku: 0, otoceni: 0 },
        ocko: { zap: true, poloha: 'vlevo', prumer: 4.5, stena: 2 }, ramecek: { zap: false }, magnet: { zap: false }, stojanek: { zap: false }, tisk: { rezim: 'vice' } } },
  ];

  /** Předvolba na projekt: přepíše uvedené sekce, text a barvy ponechá. */
  function pouzijPredvolbu(p, v) { const q = kopie(p); for (const [sek, hod] of Object.entries(v.p)) Object.assign(q[sek], hod); return normalizuj(q).p; }

  const kopie = o => JSON.parse(JSON.stringify(o));
  const zaokr = x => Math.round(x * 1e6) / 1e6;
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '—';
    const r = Math.round(x * 10 ** des) / 10 ** des;
    return String(Object.is(r, -0) ? 0 : r).replace('.', ',');
  }
  function cislo(v, nahrada) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : nahrada;
    if (typeof v !== 'string') return nahrada;
    const t = v.trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    const x = t === '' ? NaN : Number(t);
    return Number.isFinite(x) ? x : nahrada;
  }
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }

  /** Doplní chybějící, opraví neplatné a omezí rozsahy. Vrací {p, hlaseni} – hlášení jen o opravách zadaných hodnot. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hlaseni = [];
    const v = vstup && typeof vstup === 'object' ? vstup : {};
    (function projdi(vzor, cesta) {
      for (const k of Object.keys(vzor)) {
        const c = cesta ? cesta + '.' + k : k, d = vzor[k], h = vezmi(v, c);
        if (d && typeof d === 'object') { projdi(d, c); continue; }
        if (h === undefined) continue;
        if (typeof d === 'boolean') { poloz(p, c, !!h); continue; }
        if (VOLBY[c]) {
          const x = typeof d === 'number' ? cislo(h, NaN) : h;
          if (VOLBY[c].includes(x)) poloz(p, c, x); else hlaseni.push(`${c}: neznámá volba „${h}“ → ${d}`);
          continue;
        }
        if (typeof d === 'number') {
          const x = cislo(h, NaN);
          if (!Number.isFinite(x)) { hlaseni.push(`${c}: neplatné číslo → ${fmt(d, 2)}`); continue; }
          const r = ROZSAHY[c], y = r ? Math.min(r[1], Math.max(r[0], x)) : x;
          if (y !== x) hlaseni.push(`${c}: ${fmt(x, 2)} omezeno na ${fmt(y, 2)}`);
          poloz(p, c, y); continue;
        }
        if (c.startsWith('barvy.')) {
          if (/^#[0-9a-f]{6}$/i.test(h)) poloz(p, c, h.toUpperCase()); else hlaseni.push(`${c}: neplatná barva → ${d}`);
          continue;
        }
        poloz(p, c, String(h).slice(0, k === 'jmena' ? 20000 : 300));
      }
    })(VYCHOZI, '');
    const radky = p.text.obsah.replace(/\r/g, '').split('\n');
    if (radky.length > MAX_RADKU) { p.text.obsah = radky.slice(0, MAX_RADKU).join('\n'); hlaseni.push(`text: nejvýš ${MAX_RADKU} řádky, zbytek vynechán`); }
    if (!(PISMO_OK.test(p.text.pismo))) p.text.pismo = VYCHOZI.text.pismo;
    return { p, hlaseni };
  }
  const PISMO_OK = /^[\w-]{1,80}$/;

  /* ---------- vrstvy ----------
     Vrstva 1 končí na výšce první vrstvy, vrstva i na prvni + (i − 1) · vrstva.
     Rozhraní barev musí ležet na horní hraně vrstvy – jinak slicer vrstvu „rozpůlí“ a barva přeteče. */
  function naMrizku(z, t, smer = 0) {
    const k = (z - t.prvni) / t.vrstva;
    const n = smer > 0 ? Math.ceil(k - 1e-9) : smer < 0 ? Math.floor(k + 1e-9) : Math.round(k);
    return zaokr(t.prvni + Math.max(0, n) * t.vrstva);
  }
  function naVrstve(z, t) {
    const k = (z - t.prvni) / t.vrstva;
    return z >= t.prvni - 1e-9 && Math.abs(k - Math.round(k)) < 1e-6;
  }
  /** Číslo první vrstvy NAD rozhraním z (od 1) a výška její horní hrany (ta se ve sliceru ukazuje na jezdci). */
  function vrstvaNad(z, t) {
    const n = Math.round((z - t.prvni) / t.vrstva) + 2;
    return { cislo: n, vyska: zaokr(z + t.vrstva) };
  }

  /** Odvozené výšky (s přichycením na vrstvy) a události tisku (výměny barvy, pauza na magnet). */
  function odvozene(p) {
    const t = p.tisk, tx = p.text, snap = t.prichytit;
    const g = (z, smer) => (snap ? naMrizku(z, t, smer) : zaokr(z));
    const H = Math.max(g(p.podklad.tloustka), snap ? zaokr(t.prvni + t.vrstva) : 0);
    const o = { H, zText: H, zRyt: H, magnet: null, udalosti: [] };
    if (tx.rezim === 'vystouply') o.zText = Math.max(g(H + tx.vyska), snap ? zaokr(H + t.vrstva) : 0);
    else o.zRyt = Math.min(g(H - tx.hloubka), snap ? zaokr(H - t.vrstva) : H);
    if (p.magnet.zap) {
      const z0 = snap ? Math.max(t.prvni, naMrizku(p.magnet.dno, t)) : p.magnet.dno;
      const z1 = snap ? naMrizku(z0 + p.magnet.vyska + p.magnet.vule, t, 1) : zaokr(z0 + p.magnet.vyska + p.magnet.vule);
      o.magnet = { z0, z1, r: p.magnet.prumer / 2 + p.magnet.vule };
      o.udalosti.push({ z: z1, druh: 'pauza', text: `vložit magnet ⌀ ${fmt(p.magnet.prumer)} × ${fmt(p.magnet.vyska)} mm` });
    }
    if (tx.rezim === 'vystouply') o.udalosti.push({ z: H, druh: 'barva', z_barvy: 'podklad', na: 'text' });
    else if (tx.rezim === 'vyryty') o.udalosti.push({ z: o.zRyt, druh: 'barva', z_barvy: 'text', na: 'podklad' });
    o.udalosti.sort((a, b) => a.z - b.z);
    for (const u of o.udalosti) Object.assign(u, { naVrstve: naVrstve(u.z, t), nad: vrstvaNad(u.z, t) });
    o.prvniBarva = tx.rezim === 'vyryty' ? 'text' : 'podklad';
    o.vyska = Math.max(o.zText, H);
    o.vrstev = Math.round((o.vyska - t.prvni) / t.vrstva) + 1;
    return o;
  }

  /* ---------- text z písma ----------
     Obrysy v jednotkách „výška verzálek = 1“, osa y nahoru, střed obdélníku inkoustu v počátku.
     Křivky se dělí podle délky řídicího polygonu (krok 0,03 výšky verzálky). */
  function vyskaVerzalky(font) {
    const os2 = font.tables && font.tables.os2;
    if (os2 && os2.sCapHeight > 0) return os2.sCapHeight;
    try { const b = font.charToGlyph('H').getBoundingBox(); if (b.y2 > 0) return b.y2; } catch (e) { /* bez H */ }
    return 0.7 * font.unitsPerEm;
  }
  function rozvrhniText(font, text, volby = {}) {
    const radkovani = volby.radkovani || 1.45, zarovnani = volby.zarovnani || 'stred';
    const em = font.unitsPerEm || 1000, vel = em / vyskaVerzalky(font);   // velikost písma, při které má verzálka výšku 1
    const radky = String(text).replace(/\r/g, '').split('\n').map(r => r.replace(/\s+$/, '')).slice(0, MAX_RADKU);
    while (radky.length && !radky[radky.length - 1].trim()) radky.pop();
    const chybi = [...new Set([...radky.join('')].filter(ch => !/\s/.test(ch) && font.charToGlyphIndex(ch) === 0))];
    const obrysy = [];
    radky.forEach((radek, i) => {
      if (!radek.trim()) return;
      const sirka = font.getAdvanceWidth(radek, vel, { kerning: true });
      const x0 = zarovnani === 'vlevo' ? 0 : zarovnani === 'vpravo' ? -sirka : -sirka / 2;
      const cesta = font.getPath(radek, x0, i * radkovani, vel, { kerning: true });
      let akt = null, px = 0, py = 0;
      const bod = (x, y) => akt.push([x, -y]);
      const deleni = d => Math.max(2, Math.min(24, Math.ceil(d / 0.03)));
      for (const c of cesta.commands) {
        if (c.type === 'M') { akt = []; obrysy.push(akt); bod(c.x, c.y); }
        else if (c.type === 'L') bod(c.x, c.y);
        else if (c.type === 'Q') {
          const n = deleni(Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x - c.x1, c.y - c.y1));
          for (let k = 1; k <= n; k++) { const s = k / n, u = 1 - s; bod(u * u * px + 2 * u * s * c.x1 + s * s * c.x, u * u * py + 2 * u * s * c.y1 + s * s * c.y); }
        } else if (c.type === 'C') {
          const n = deleni(Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2));
          for (let k = 1; k <= n; k++) {
            const s = k / n, u = 1 - s;
            bod(u * u * u * px + 3 * u * u * s * c.x1 + 3 * u * s * s * c.x2 + s * s * s * c.x, u * u * u * py + 3 * u * u * s * c.y1 + 3 * u * s * s * c.y2 + s * s * s * c.y);
          }
        }
        if (c.type !== 'Z') { px = c.x; py = c.y; }
      }
    });
    const platne = obrysy.filter(o => o.length >= 3);
    if (!platne.length) return { obrysy: [], sirka: 0, vyska: 0, radku: radky.length, chybi };
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const o of platne) for (const [x, y] of o) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    return { obrysy: platne.map(o => o.map(([x, y]) => [x - cx, y - cy])), sirka: b[2] - b[0], vyska: b[3] - b[1], radku: radky.length, chybi };
  }

  /** Výška verzálky v mm: zadaná velikost, zmenšená na šířku (naSirku) nebo do pevného podkladu. */
  function velikostTextu(p, roz) {
    const W1 = p.text.otoceni ? roz.vyska : roz.sirka, H1 = p.text.otoceni ? roz.sirka : roz.vyska;
    let c = p.text.velikost;
    const pk = p.podklad;
    if (pk.pevny) c = Math.min(c, (pk.sirka - 2 * pk.okraj) / W1, (pk.vyska - 2 * pk.okraj) / H1);
    else if (p.text.naSirku > 0) c = Math.min(c, p.text.naSirku / W1);
    return c;
  }

  /* ---------- 2D tvary ---------- */
  function zaoblenyObdelnik(L, W, r, seg = 48) {
    r = Math.max(0, Math.min(r, L / 2 - 1e-4, W / 2 - 1e-4));
    if (r < 1e-3) return [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];
    const n = Math.max(3, Math.ceil(seg / 4)), pts = [];
    for (const [cx, cy, a0] of [[L / 2 - r, -W / 2 + r, -90], [L / 2 - r, W / 2 - r, 0], [-L / 2 + r, W / 2 - r, 90], [-L / 2 + r, -W / 2 + r, 180]]) {
      for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    }
    return pts;
  }
  function elipsa(a, b, n = 96) {
    return Array.from({ length: n }, (_, i) => { const t = 2 * Math.PI * i / n; return [a * Math.cos(t), b * Math.sin(t)]; });
  }
  /** Krajní bod obrysu ve směru polohy očka a vnější normála (průměr bodů v pásu 0,3 mm u extrému). */
  function krajniBod(polygony, poloha) {
    const osa = poloha === 'nahore' ? 1 : 0, zn = poloha === 'vlevo' ? -1 : 1;
    let ext = -Infinity;
    for (const o of polygony) for (const q of o) ext = Math.max(ext, zn * q[osa]);
    let s = 0, n = 0;
    for (const o of polygony) for (const q of o) if (zn * q[osa] > ext - 0.3) { s += q[1 - osa]; n++; }
    const bod = osa ? [s / n, ext] : [zn * ext, s / n];
    return { bod, ven: osa ? [0, 1] : [zn, 0] };
  }

  /* ---------- stavba ---------- */
  function sestav(w, font, vstup) {
    const p = vstup, t0 = Date.now();
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const SEG = 48;
    try {
      const odv = odvozene(p), info = {};
      const roz = rozvrhniText(font, p.text.obsah, p.text);
      info.chybi = roz.chybi;
      if (!roz.obrysy.length) throw new Error('Zadejte text (aspoň jeden znak, který písmo obsahuje).');
      const cap = velikostTextu(p, roz);
      if (!(cap > 0.5)) throw new Error('Text se do podkladu nevejde – zvětšete podklad nebo zmenšete okraj.');
      info.cap = cap;
      const rot = p.text.otoceni === 90;
      const poly = roz.obrysy.map(o => o.map(([x, y]) => (rot ? [-y * cap, x * cap] : [x * cap, y * cap])));
      const text0 = k(k(new CS(poly, 'NonZero')).simplify(0.004));
      const tb = text0.bounds();
      info.textRozmer = [tb.max[0] - tb.min[0], tb.max[1] - tb.min[1]];

      /* podklad bez očka */
      const pk = p.podklad;
      const pevnyR = pk.pevny ? [pk.sirka, pk.vyska] : [info.textRozmer[0] + 2 * pk.okraj, info.textRozmer[1] + 2 * pk.okraj];
      const sx = (tb.min[0] + tb.max[0]) / 2, sy = (tb.min[1] + tb.max[1]) / 2;
      let zaklad;
      if (pk.tvar === 'obrys') {
        // „bublina“: offset o okraj + spoj a zpět o spoj (spojí mezery mezi písmeny a řádky), otvory písmen se zaplní
        const nafouk = k(text0.offset(pk.okraj + pk.spoj, 'Round', 2, SEG));
        const sraz = pk.spoj > 0 ? k(nafouk.offset(-pk.spoj, 'Round', 2, SEG)) : nafouk;
        const vnejsi = sraz.toPolygons().filter(o => plocha(o) > 0);
        zaklad = k(new CS(vnejsi, 'Positive'));
      } else if (pk.tvar === 'oval') {
        const [a, b] = pk.pevny ? [pevnyR[0] / 2, pevnyR[1] / 2] : [pevnyR[0] / 2 * Math.SQRT2, pevnyR[1] / 2 * Math.SQRT2];
        zaklad = k(k(new CS([elipsa(a, b)], 'Positive')).translate([sx, sy]));
      } else {
        const r = pk.tvar === 'obdelnik' ? 0 : pk.zaobleni;
        zaklad = k(k(new CS([zaoblenyObdelnik(pevnyR[0], pevnyR[1], r)], 'Positive')).translate([sx, sy]));
      }
      info.castiPodkladu = zaklad.decompose().map(c => { const a = c.area(); c.delete(); return a; }).filter(a => a > 0.5).length;

      /* očko: otvor celý vně podkladu (1 mm od kraje), kroužek spojený s podkladem krčkem */
      let obrys = zaklad, otvor = null, krouzek = null;
      if (p.ocko.zap || pk.tvar === 'stitek') {
        const d = p.ocko.prumer, R = d / 2 + p.ocko.stena;
        const kb = krajniBod(zaklad.toPolygons(), p.ocko.poloha);
        const odstup = pk.tvar === 'stitek' ? d / 2 + p.ocko.stena + 0.5 : d / 2 + 1;
        const c = [kb.bod[0] + kb.ven[0] * odstup, kb.bod[1] + kb.ven[1] * odstup];
        info.ocko = { stred: c, R, d };
        const kruh = (r, q = c) => k(k(CS.circle(r, Math.max(32, Math.ceil(r * 12)))).translate(q));
        if (pk.tvar === 'stitek') krouzek = k(CS.hull([zaklad, kruh(R + 0.5)]));
        else krouzek = k(CS.hull([kruh(R), kruh(R, [kb.bod[0] - kb.ven[0] * R * 0.5, kb.bod[1] - kb.ven[1] * R * 0.5])]));
        otvor = kruh(d / 2);
        obrys = k(k(zaklad.add(krouzek)).subtract(otvor));
      }
      info.obrys2d = obrys.toPolygons(); info.text2d = poly;
      const rb = obrys.bounds();
      info.rozmer = [rb.max[0] - rb.min[0], rb.max[1] - rb.min[1]];

      /* text oříznutý do podkladu (s rámečkem do vnitřku rámečku, mimo kroužek očka) */
      const rs = p.ramecek.zap && p.text.rezim === 'vystouply' ? p.ramecek.sirka : 0;
      let textK = k(text0.intersect(rs ? k(zaklad.offset(-rs - 0.2, 'Round', 2, SEG)) : zaklad));
      if (info.ocko) textK = k(textK.subtract(k(k(CS.circle(Math.max(info.ocko.R, info.ocko.d / 2 + rs) + 0.2, 64)).translate(info.ocko.stred))));
      const aT = text0.area(), aK = textK.area();
      info.textOrez = aT > 0 ? Math.max(0, (aT - aK) / aT) : 0;
      // tenké tahy: otevření o polovinu šíře stopy trysky 0,4 mm ubere tenkým tahům plochu
      const otevreny = k(k(textK.offset(-0.2, 'Round', 2, 16)).offset(0.2, 'Round', 2, 16));
      info.tenke = aK > 0 ? Math.max(0, (aK - otevreny.area()) / aK) : 0;
      info.plochaTextu = aK;

      /* magnet: kapsa ve středu textu, celá uvnitř podkladu (1,2 mm stěna) */
      let kapsa = null;
      if (odv.magnet) {
        const m = odv.magnet, mc = [sx, sy];
        const okoli = k(k(CS.circle(m.r + 1.2, 64)).translate(mc));
        info.magnetVen = k(okoli.subtract(zaklad)).area() > 0.05;
        kapsa = k(k(k(CS.circle(m.r, 64)).translate(mc)).extrude(m.z1 - m.z0));
        kapsa = k(kapsa.translate([0, 0, m.z0]));
      }

      /* tělesa */
      const H = odv.H, vysun = (cs, z0, z1) => k(k(cs.extrude(z1 - z0)).translate([0, 0, z0]));
      const dily = [];
      const sit = (m, jmeno, nazev, role) => {
        const st = m.status();
        if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
        if (m.isEmpty()) return;
        const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
        const poz = new Float32Array(vp.length / np * 3);
        for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
        dily.push({ jmeno, nazev, role, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume() });
      };
      const bezKapsy = m => (kapsa ? k(m.subtract(kapsa)) : m);
      const rez = p.text.rezim;
      if (rez === 'vystouply') {
        sit(bezKapsy(vysun(obrys, 0, H)), 'podklad', 'Podklad', 'podklad');
        sit(vysun(textK, H, odv.zText), 'text', 'Text', 'text');
        if (rs) {
          let ram = k(obrys.subtract(k(obrys.offset(-rs, 'Round', 2, SEG))));
          if (info.ocko) ram = k(ram.add(k(k(k(CS.circle(info.ocko.d / 2 + rs, 64)).translate(info.ocko.stred)).intersect(obrys))));
          sit(vysun(ram, H, odv.zText), 'ramecek', 'Rámeček', 'ramecek');
        }
      } else if (rez === 'vyryty') {
        // dno rytiny v barvě textu, nad ním podklad s vyrytým textem – rozhraní = dno rytiny
        sit(bezKapsy(vysun(obrys, 0, odv.zRyt)), 'dno', 'Dno rytiny (barva textu)', 'text');
        sit(vysun(k(obrys.subtract(textK)), odv.zRyt, H), 'podklad', 'Podklad s rytinou', 'podklad');
      } else {
        const pod = k(M.union([vysun(obrys, 0, odv.zRyt), vysun(k(obrys.subtract(textK)), odv.zRyt, H)]));
        sit(bezKapsy(pod), 'podklad', 'Podklad', 'podklad');
        sit(vysun(textK, odv.zRyt, H), 'text', 'Text (vykládaný)', 'text');
      }

      /* stojánek pro jmenovku na stůl: kvádr se šikmou drážkou na spodní hranu jmenovky */
      if (p.stojanek.zap) {
        const s = p.stojanek, L = Math.max(30, Math.min(info.rozmer[0], 0.8 * info.rozmer[0] + 10));
        const sirkaDr = H + s.vule, D = Math.max(22, sirkaDr + 2 * (s.hloubka * Math.tan(s.uhel * Math.PI / 180) + 6)), Hs = s.hloubka + 3;
        const blok = k(k(M.cube([L, D, Hs], false)).translate([-L / 2, -D / 2, 0]));
        const dr = k(k(k(M.cube([L + 2, sirkaDr, 60], false)).translate([-(L + 2) / 2, -sirkaDr / 2, 0])).rotate([-s.uhel, 0, 0]));
        const drazka = k(dr.translate([0, 0, Hs - s.hloubka * Math.cos(s.uhel * Math.PI / 180)]));
        const st = k(blok.subtract(drazka));
        info.stojanek = { L, D, Hs, sirkaDr };
        sit(k(st.translate([sx, rb.min[1] - D / 2 - 8, 0])), 'stojanek', 'Stojánek', 'podklad');
      }
      info.cas = Date.now() - t0;
      return { dily, odv, info };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }
  function plocha(o) { let a = 0; for (let i = 0, j = o.length - 1; i < o.length; j = i++) a += (o[j][0] - o[i][0]) * (o[j][1] + o[i][1]); return a / 2; }

  /* ---------- kontroly ---------- */
  function kontroly(p, model) {
    const H = [], t = p.tisk;
    const h = (uroven, text, pole = [], oprava) => H.push({ uroven, text, pole, oprava });
    if (!model) return H;
    if (model.chyba) { h('chyba', model.chyba, ['text.obsah']); return H; }
    const { odv, info } = model, rez = p.text.rezim;
    if (info.chybi && info.chybi.length) h('varovani', `Písmo nemá znaky ${info.chybi.join(' ')} – vynechají se. Zvolte jiné písmo.`, ['text.pismo']);
    if (info.castiPodkladu > 1) h('chyba', `Podklad se rozpadá na ${info.castiPodkladu} části – zvětšete okraj nebo spojení mezer.`, ['podklad.spoj', 'podklad.okraj'],
      { text: 'Spojit mezery 4 mm', pole: 'podklad.spoj', hodnota: Math.max(4, p.podklad.spoj + 2) });
    if (info.textOrez > 0.01) h('varovani', `Text přesahuje podklad – ořízne se ${fmt(info.textOrez * 100, 0)} % jeho plochy. Zmenšete písmo nebo zvětšete podklad.`, ['text.velikost', 'podklad.okraj']);
    if (info.tenke > 0.05) h('varovani', `Tenké tahy písma: ${fmt(info.tenke * 100, 0)} % plochy textu je užší než stopa trysky 0,4 mm – zvětšete písmo nebo zvolte tučnější.`, ['text.velikost', 'text.pismo']);
    if (p.text.velikost !== info.cap && info.cap < p.text.velikost - 0.01) h('info', `Výška verzálek zmenšena na ${fmt(info.cap, 1)} mm, aby se text vešel.`, ['text.naSirku']);
    if (info.cap < 4) h('varovani', `Písmo vysoké jen ${fmt(info.cap, 1)} mm – drobné detaily se slijí.`, ['text.velikost']);
    if (odv.H < 1.2) h('varovani', `Podklad ${fmt(odv.H, 2)} mm je tenký a snadno se zlomí (doporučeno ≥ 1,6 mm).`, ['podklad.tloustka']);
    if (rez === 'vystouply' && odv.zText - odv.H < 2 * t.vrstva - 1e-9) h('varovani', 'Text má méně než 2 vrstvy – barva bude prosvítat.', ['text.vyska']);
    if (rez !== 'vystouply') {
      if (odv.zRyt < Math.max(0.6, 3 * t.vrstva) - 1e-9) h('chyba', `Pod rytinou zbývá jen ${fmt(odv.zRyt, 2)} mm – zmenšete hloubku nebo zesilte podklad.`, ['text.hloubka', 'podklad.tloustka']);
      if (odv.H - odv.zRyt < 2 * t.vrstva - 1e-9) h('varovani', 'Rytina má méně než 2 vrstvy – sotva bude vidět.', ['text.hloubka']);
    }
    if (rez === 'zarovnany' && t.rezim === 'jedna') h('chyba', 'Zarovnaný (vykládaný) text má obě barvy ve stejných vrstvách – jedna tryska s výměnou filamentu to neumí. Zvolte vystouplý nebo vyrytý text, nebo tisk více barvami (AMS/MMU).', ['tisk.rezim', 'text.rezim']);
    if (p.ramecek.zap && rez !== 'vystouply') h('info', 'Rámeček se tiskne jen u vystouplého textu.', ['ramecek.zap']);
    if (p.ramecek.zap && rez === 'vystouply' && t.rezim === 'jedna' && p.barvy.ramecek !== p.barvy.text) h('info', 'Jedna tryska: rámeček je ve stejné výšce jako text, vytiskne se barvou textu.', ['tisk.rezim']);
    if (info.ocko) {
      if (p.ocko.stena < 1.2) h('varovani', `Stěna očka ${fmt(p.ocko.stena, 1)} mm se snadno utrhne (doporučeno ≥ 1,6 mm).`, ['ocko.stena']);
      if (p.ocko.prumer < 3) h('info', `Otvor ⌀ ${fmt(p.ocko.prumer, 1)} mm – projde jen tenký drát nebo šňůrka.`, ['ocko.prumer']);
    }
    if (p.magnet.zap) {
      const m = odv.magnet;
      if (info.magnetVen) h('chyba', `Magnet ⌀ ${fmt(p.magnet.prumer)} mm se do podkladu nevejde (potřebuje 1,2 mm stěnu kolem) – zvětšete podklad nebo zmenšete magnet.`, ['magnet.prumer', 'podklad.okraj']);
      const strop = (rez === 'vystouply' ? odv.H : odv.zRyt) - m.z1;
      if (strop < 0) h('chyba', `Kapsa na magnet (do ${fmt(m.z1, 2)} mm) je vyšší než ${rez === 'vystouply' ? 'podklad' : 'dno rytiny'} – zesilte podklad na aspoň ${fmt(m.z1 + 3 * t.vrstva + (rez === 'vystouply' ? 0 : odv.H - odv.zRyt), 2)} mm.`, ['podklad.tloustka', 'magnet.vyska'],
        { text: 'Zesílit podklad', pole: 'podklad.tloustka', hodnota: zaokr(m.z1 + 3 * t.vrstva + (rez === 'vystouply' ? 0 : odv.H - odv.zRyt)) });
      else if (strop < 3 * t.vrstva - 1e-9) h('varovani', `Strop nad magnetem má jen ${fmt(strop, 2)} mm – první vrstvy přes kapsu se prověsí (doporučeno ≥ 3 vrstvy).`, ['podklad.tloustka']);
      if (m.z0 < 2 * t.vrstva - 1e-9 && m.z0 < t.prvni + t.vrstva - 1e-9) h('varovani', `Dno kapsy ${fmt(m.z0, 2)} mm je jen jedna vrstva – může se protrhnout.`, ['magnet.dno']);
      if (p.ocko.zap) h('info', 'Magnet i očko zároveň – je to záměr?', ['ocko.zap']);
    }
    if (p.stojanek.zap) {
      if (!['obdelnik', 'zaobleny'].includes(p.podklad.tvar)) h('varovani', 'Stojánek potřebuje rovnou spodní hranu – zvolte obdélník nebo zaoblený obdélník.', ['podklad.tvar'],
        { text: 'Zaoblený obdélník', pole: 'podklad.tvar', hodnota: 'zaobleny' });
      if (p.podklad.pevny ? (p.podklad.vyska - info.textRozmer[1]) / 2 < p.stojanek.hloubka : p.podklad.okraj < p.stojanek.hloubka)
        h('varovani', `Spodní okraj jmenovky je menší než hloubka drážky ${fmt(p.stojanek.hloubka)} mm – text zapadne do stojánku.`, ['stojanek.hloubka', 'podklad.okraj']);
      if (p.ocko.zap) h('info', 'Jmenovka na stojánek obvykle očko nepotřebuje.', ['ocko.zap']);
    }
    // rozhraní barev na hranici vrstvy
    for (const u of odv.udalosti) if (!u.naVrstve) {
      h('varovani', `${u.druh === 'barva' ? 'Rozhraní barev' : 'Pauza na magnet'} ve výšce ${fmt(u.z, 3)} mm neleží na hranici vrstvy (první ${fmt(t.prvni, 2)} + n × ${fmt(t.vrstva, 2)} mm) – slicer barvu posune.`, ['tisk.prichytit', 'podklad.tloustka'],
        { text: 'Přichytit výšky na vrstvy', pole: 'tisk.prichytit', hodnota: true });
    }
    if (Math.max(info.rozmer[0], info.rozmer[1]) > t.podlozka) h('chyba', `Výrobek (${fmt(info.rozmer[0])} × ${fmt(info.rozmer[1])} mm) je větší než podložka ${fmt(t.podlozka, 0)} mm.`, ['text.velikost', 'tisk.podlozka']);
    if (p.text.rezim === 'vystouply' && p.tisk.rezim === 'vice' && odv.udalosti.length) h('info', 'Více barev (AMS/MMU): 3MF má podklad, text a rámeček jako samostatné díly s barvou – výměny řídí slicer.', []);
    if (!H.some(x => x.uroven === 'chyba' || x.uroven === 'varovani')) h('ok', 'Geometrie i výšky vrstev jsou v pořádku.');
    return H;
  }

  /* ---------- pokyny pro výměnu barvy ---------- */
  function pokyny(p, odv) {
    const t = p.tisk, barva = r => p.barvy[r] || '#808080';
    const kroky = odv.udalosti.map(u => ({
      z: u.z, druh: u.druh, vrstva: u.nad.cislo, vyskaVrstvy: u.nad.vyska, naVrstve: u.naVrstve,
      text: u.druh === 'barva' ? `výměna na barvu ${u.na === 'text' ? 'textu' : 'podkladu'} ${barva(u.na)}` : u.text,
    }));
    const radkyGcode = (prikaz, pauza) => kroky.map(k => `; ${k.text} – před vrstvou ${k.vrstva} (Z ${fmt(k.vyskaVrstvy, 2).replace(',', '.')} mm, rozhraní ${fmt(k.z, 2).replace(',', '.')} mm)\n${k.druh === 'barva' ? prikaz : pauza}`).join('\n');
    return {
      kroky,
      zacatek: odv.prvniBarva,
      marlin: radkyGcode('M600', 'M601 ; nebo M0 – podle firmwaru (Prusa: M601)'),
      klipper: radkyGcode('PAUSE ; nebo M600, pokud máte makro M600', 'PAUSE'),
      podminka: kroky.length ? `; PrusaSlicer – Tiskárna › Vlastní G-code › Po změně vrstvy\n${kroky.map(k => `{if layer_z == ${fmt(k.vyskaVrstvy, 2).replace(',', '.')}}${k.druh === 'barva' ? 'M600' : 'M601'}{endif}`).join('\n')}` : '',
      vrstva: t.vrstva, prvni: t.prvni,
    };
  }

  /* ---------- dávka a rozložení na podložku ---------- */
  /** Řádky seznamu → texty jmenovek; „|“ uvnitř jména = nový řádek. */
  function seznamJmen(text) {
    return String(text || '').replace(/\r/g, '').split('\n').map(r => r.trim()).filter(Boolean).map(r => r.split(/\s*\|\s*/).slice(0, MAX_RADKU).join('\n'));
  }
  function obalDilu(dily) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const d of dily) { const o = KRAB.obal(d.poz); for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], o[i]); b[i + 3] = Math.max(b[i + 3], o[i + 3]); } }
    return b;
  }
  /** Kusy [{dily}] do řad na čtvercovou podložku (strana W) s mezerou; celé rozložení vystředěné na počátek. */
  function rozlozNaPodlozku(kusy, mezera, W) {
    let x = 0, y = 0, radek = 0, maxX = 0;
    const umisteni = kusy.map(kus => {
      const b = obalDilu(kus.dily), sw = b[3] - b[0], sh = b[4] - b[1];
      if (x > 0 && x + sw > W) { x = 0; y += radek + mezera; radek = 0; }
      const u = { kus, b, x, y };
      x += sw + mezera; radek = Math.max(radek, sh); maxX = Math.max(maxX, x - mezera);
      return u;
    });
    const celkem = [maxX, y + radek];
    // řady od horního okraje dolů, celé rozložení vystředěné na počátek, z = 0
    const out = umisteni.map(({ kus, b, x: ux, y: uy }) => Object.assign({}, kus, {
      dily: kus.dily.map(d => Object.assign({}, d, KRAB.presun(d, ux - b[0] - celkem[0] / 2, celkem[1] / 2 - uy - b[4], -b[2]))),
    }));
    return { kusy: out, rozmer: celkem, vejde: celkem[0] <= W + 1e-6 && celkem[1] <= W + 1e-6 };
  }
  /** Sestaví všechna jména ze seznamu se stejným nastavením. Vrací {kusy: [{text, dily, info}], chyby: [{text, chyba}]}. */
  function sestavDavku(w, font, p) {
    const kusy = [], chyby = [];
    for (const jm of seznamJmen(p.davka.jmena)) {
      const q = kopie(p); q.text.obsah = jm;
      try { const m = sestav(w, font, q); kusy.push({ text: jm, dily: m.dily, info: m.info }); }
      catch (e) { chyby.push({ text: jm, chyba: e.message || String(e) }); }
    }
    return { kusy, chyby };
  }

  /* ---------- export ----------
     3MF: každý kus = jeden objekt, díly (podklad, text, rámeček) jsou jeho části s vlastní barvou
     (core 3MF: basematerials + pid/p1 u trojúhelníků) a s extruderem pro PrusaSlicer/OrcaSlicer
     (Metadata/Slic3r_PE_model.config – rozsahy trojúhelníků na objem). Stojánek je samostatný objekt. */
  const ROLE = ['podklad', 'text', 'ramecek'];
  const NAZVY_ROLI = { podklad: 'Podklad', text: 'Text', ramecek: 'Rámeček' };
  const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cisloXml = x => { const r = Math.round(x * 1e5) / 1e5; return Object.is(r, -0) ? '0' : String(r); };
  /** Extrudery podle barev: stejná barva = stejný extruder (1 = podklad). */
  function extrudery(barvy) {
    const map = {}, pouzite = [];
    for (const r of ROLE) { const b = barvy[r]; let i = pouzite.indexOf(b); if (i < 0) { pouzite.push(b); i = pouzite.length - 1; } map[r] = i + 1; }
    return map;
  }
  function soubor3mfBarevny(kusy, nazev, barvy) {
    const ext = extrudery(barvy), objekty = [];
    for (const kus of kusy) {
      const hlavni = kus.dily.filter(d => d.jmeno !== 'stojanek'), stoj = kus.dily.filter(d => d.jmeno === 'stojanek');
      if (hlavni.length) objekty.push({ nazev: kus.text.replace(/\n/g, ' '), dily: hlavni });
      for (const s of stoj) objekty.push({ nazev: `${kus.text.replace(/\n/g, ' ')} – stojánek`, dily: [s] });
    }
    const r = [], cfg = [];
    r.push('<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="cs-CZ" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">');
    r.push(` <metadata name="Title">${xmlEsc(nazev)}</metadata>\n <metadata name="Application">klicenky (github_site)</metadata>`);
    r.push(' <resources>\n  <basematerials id="1">');
    ROLE.forEach(role => r.push(`   <base name="${NAZVY_ROLI[role]}" displaycolor="${barvy[role]}FF"/>`));
    r.push('  </basematerials>');
    cfg.push('<?xml version="1.0" encoding="UTF-8"?>\n<config>');
    objekty.forEach((o, i) => {
      const id = i + 2;
      r.push(`  <object id="${id}" type="model" name="${xmlEsc(o.nazev)}" pid="1" pindex="0">\n   <mesh>\n    <vertices>`);
      const v = [], t = [], obj = [];
      let zakladV = 0, zakladT = 0;
      for (const d of o.dily) {
        const P = d.poz, I = d.idx, pi = ROLE.indexOf(d.role);
        for (let q = 0; q < P.length; q += 3) v.push(`     <vertex x="${cisloXml(P[q])}" y="${cisloXml(P[q + 1])}" z="${cisloXml(P[q + 2])}"/>`);
        for (let q = 0; q < I.length; q += 3) t.push(`     <triangle v1="${I[q] + zakladV}" v2="${I[q + 1] + zakladV}" v3="${I[q + 2] + zakladV}" pid="1" p1="${pi}"/>`);
        obj.push(`  <volume firstid="${zakladT}" lastid="${zakladT + I.length / 3 - 1}">\n   <metadata type="volume" key="name" value="${xmlEsc(d.nazev)}"/>\n   <metadata type="volume" key="volume_type" value="ModelPart"/>\n   <metadata type="volume" key="extruder" value="${ext[d.role]}"/>\n  </volume>`);
        zakladV += P.length / 3; zakladT += I.length / 3;
      }
      r.push(v.join('\n'), '    </vertices>\n    <triangles>', t.join('\n'), '    </triangles>\n   </mesh>\n  </object>');
      cfg.push(` <object id="${id}" instances_count="1">\n  <metadata type="object" key="name" value="${xmlEsc(o.nazev)}"/>\n${obj.join('\n')}\n </object>`);
    });
    r.push(' </resources>\n <build>');
    objekty.forEach((o, i) => r.push(`  <item objectid="${i + 2}"/>`));
    r.push(' </build>\n</model>\n');
    cfg.push('</config>\n');
    const ct = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
      + '<Default Extension="config" ContentType="text/xml"/></Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
    return KRAB.zip([
      { name: '[Content_Types].xml', data: ct },
      { name: '_rels/.rels', data: rels },
      { name: '3D/3dmodel.model', data: r.join('\n') },
      { name: 'Metadata/Slic3r_PE_model.config', data: cfg.join('\n') },
    ]);
  }
  /** STL po barvách (všechny kusy spojené podle role) – pro slicery, které 3MF s díly nenačtou. */
  function stlPoBarvach(kusy, nazev) {
    const out = [];
    for (const role of ROLE) {
      const d = kusy.flatMap(k => k.dily.filter(x => x.role === role));
      if (d.length) out.push({ role, name: `${nazev}_${role}.stl`, data: KRAB.stlBinarni(d, `klicenky ${role}`) });
    }
    return out;
  }
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '');

  /* ---------- odhad tisku ---------- */
  function odhad(objem, plochaPovrchu, p, zmen = 0) {
    const obal = Math.min(objem, plochaPovrchu * 0.9);
    const v = obal + (objem - obal) * p.tisk.vypln / 100;
    const mat = MATERIALY[p.tisk.material];
    return { objem: v, g: v / 1000 * mat.hustota, m: v / (Math.PI * 0.875 * 0.875) / 1000, min: v / 6 * 1.5 / 60 + 3 + 2 * zmen };
  }

  /* ---------- projekt ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_klicenky', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== 'webapp_klicenky') throw new Error('Soubor není projekt klíčenky (chybí "format": "webapp_klicenky").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const API = {
    VYCHOZI, PREDVOLBY, pouzijPredvolbu, ROZSAHY, VOLBY, NAZVY, MATERIALY, MAX_RADKU, ROLE, NAZVY_ROLI,
    kopie, fmt, cislo, vezmi, poloz, normalizuj, naMrizku, naVrstve, vrstvaNad, odvozene,
    rozvrhniText, velikostTextu, zaoblenyObdelnik, sestav, kontroly, pokyny,
    seznamJmen, obalDilu, rozlozNaPodlozku, sestavDavku, extrudery, soubor3mfBarevny, stlPoBarvach, bezDiakritiky, odhad,
    ulozProjekt, nactiProjekt,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KLIC = API;
})();
