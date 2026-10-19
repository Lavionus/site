/* ============================================================
   hieroglyfy/jadro.js – Egyptský písař: přepis a sazba hieroglyfů.

   Bez DOM, běží i v node (testy _test/hieroglyfy_test.js).

     HIERO.rozloz(text, volby)        → položky (slova, jména, čísla, znaky)
     HIERO.ctverce(kody, rozmer, v)   → znaky seskupené do čtverců
     HIERO.sazba(polozky, rozmer, v)  → souřadnice znaků a kartuší (v em)
     HIERO.svg(sazba, font, v)        → SVG s obrysy znaků (opentype.js)
     HIERO.unicode(polozky)           → text v Unicode
     HIERO.mdc(polozky, rozmer, v)    → Manuel de Codage (JSesh)
     HIERO.rozmerZFontu(font)         → funkce kód → {w, h} pro sazbu

   Jednotka sazby je em = výška čtverce (1000 jednotek fontu Noto).
   Znaky v Unicode hledí doleva a čtou se zleva doprava; psaní zprava
   doleva je jen zrcadlový obraz celé sazby (dělá ho svg()).
   ============================================================ */
(function (g) {
  'use strict';
  const Z = g.HIERO_ZNAKY || (typeof require === 'function' ? require('./znaky.js') : null);

  const bezDiakritiky = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const klic = s => bezDiakritiky(s.toLowerCase());
  const VYCHOZI = {
    styl: 'pisar',          // 'pisar' | 'muzeum'
    samohlasky: 'vse',      // 'vse' | 'zacatek' | 'zadne'  (jen styl pisar)
    viceznaky: true,        // dvou- a trojsouhláskové znaky
    doplnky: true,          // fonetické doplňky za nimi
    slovnik: true,          // egyptská slova ze slovníčku
    det: '',                // určující znak za jména (kód) nebo ''
    kartuse: false,         // celý text do kartuše
    skladat: true,          // skládat znaky do čtverců
    svisle: false,          // sloupce místo řádků
    sirka: 0,               // délka řádku / sloupce v em (0 = bez zalamování)
    mezeraSlov: 0.45,
  };
  const volbyS = v => Object.assign({}, VYCHOZI, v || {});

  /* ---------- čeština → egyptské hlásky ----------
     Podle zvyku, jak se hieroglyfy psala cizí jména v ptolemaiovské
     době (Kleopatra = q-l-i-w-p-ꜣ-d-r-ꜣ-t): a → ꜣ, e/i → i, o/u → w.
     [písmena, hlásky, je to samohláska]                               */
  const PISMENA = [
    ['ch', 'ḫ'], ['dž', 'ḏ'], ['ph', 'f'], ['th', 't'], ['qu', 'qw'], ['ou', 'w', 1], ['x', 'ks'],
    ['a', 'ꜣ', 1], ['á', 'ꜣ', 1], ['e', 'i', 1], ['é', 'i', 1], ['ě', 'i', 1], ['i', 'i', 1],
    ['í', 'y', 1], ['y', 'i', 1], ['ý', 'y', 1], ['o', 'w', 1], ['ó', 'w', 1], ['u', 'w', 1],
    ['ú', 'w', 1], ['ů', 'w', 1],
    ['b', 'b'], ['c', 'ts'], ['č', 'ṯ'], ['d', 'd'], ['ď', 'd'], ['f', 'f'], ['g', 'g'], ['h', 'h'],
    ['j', 'y'], ['k', 'k'], ['l', 'l'], ['m', 'm'], ['n', 'n'], ['ň', 'n'], ['p', 'p'], ['q', 'q'],
    ['r', 'r'], ['ř', 'r'], ['s', 's'], ['š', 'š'], ['t', 't'], ['ť', 't'], ['v', 'w'], ['w', 'w'],
    ['z', 'z'], ['ž', 'ḏ'],
  ].sort((a, b) => b[0].length - a[0].length);

  /* „Muzejní abeceda“: každé písmeno svým znakem (jako dosud v Převodníku
     písma) – hodí se na jmenovky, protože se dá přečíst zpátky.       */
  const MUZEUM = {
    ch: 'Aa1', a: 'G1', 'á': 'G1', b: 'D58', c: 'V13', 'č': 'V13', d: 'D46', 'ď': 'D46',
    e: 'M17', 'é': 'M17', 'ě': 'M17', i: 'M17', 'í': 'M17', y: 'M17A', 'ý': 'M17A', j: 'M17A',
    f: 'I9', v: 'I9', g: 'W11', h: 'O4', k: 'V31', q: 'N29', l: 'E23', m: 'G17', n: 'N35', 'ň': 'N35',
    o: 'V4', 'ó': 'V4', p: 'Q3', r: 'D21', 'ř': 'D21', s: 'S29', 'š': 'N37', t: 'X1', 'ť': 'X1',
    u: 'G43', 'ú': 'G43', 'ů': 'G43', w: 'G43', x: 'V31 S29', z: 'O34', 'ž': 'I10',
  };
  const MUZEUM_KLICE = Object.keys(MUZEUM).sort((a, b) => b.length - a.length);

  // zvuk jednosouhláskového znaku (pro přepis i popisky)
  const ZVUK_ZNAKU = {};
  for (const [z, k] of Object.entries(Z.ZVUKY)) if (!ZVUK_ZNAKU[k]) ZVUK_ZNAKU[k] = z;
  ZVUK_ZNAKU.V4 = 'wꜣ';

  // najde nejdelší položku tabulky na začátku řetězce (s nouzí bez diakritiky)
  function najdi(mala, i, klice) {
    for (const k of klice) if (mala.startsWith(k, i)) return k;
    return null;
  }

  /* Hlásky slova: [{z: 'ꜣ', v: true}] (v = vznikla ze samohlásky). */
  function hlasky(slovo) {
    const mala = slovo.toLowerCase().normalize('NFC');
    const out = [];
    const klice = PISMENA.map(p => p[0]);
    for (let i = 0; i < mala.length;) {
      let k = najdi(mala, i, klice), delka = k ? k.length : 1;
      if (!k) {
        const zaklad = bezDiakritiky(mala[i]);
        k = klice.includes(zaklad) ? zaklad : null;
      }
      if (k) {
        const p = PISMENA.find(x => x[0] === k);
        for (const z of p[1]) out.push({ z, v: !!p[2] });
      }
      i += delka;
    }
    // zdvojené hlásky Egypťané nepsali (Anna → ꜣnꜣ)
    return out.filter((h, i) => !(i > 0 && out[i - 1].z === h.z));
  }

  function proskrtejSamohlasky(hl, rezim) {
    if (rezim === 'vse') return hl;
    const bez = hl.filter((h, i) => !h.v || (rezim === 'zacatek' && i === 0));
    return bez.length ? bez : hl.slice(0, 1);
  }

  /* Hlásky → kódy znaků; víceznakové znaky hledá jako nejdelší shodu. */
  const VZ = Z.VICEZNAKY.map(([hod, kod, dopl]) => ({ h: [...hod], kod, dopl: dopl ? dopl.split(' ') : [] }))
    .sort((a, b) => b.h.length - a.h.length);
  // hl = [{z, v}]; víceznakové znaky jen ze souhlásek – samohlásky
  // se ve jménech psaly vždy jednosouhláskovými znaky (Novák ≠ nw-ꜣ-k)
  function znakyHlasek(hl, v) {
    const kody = [];
    const zv = hl.map(h => h.z);
    for (let i = 0; i < zv.length;) {
      let hit = null;
      if (v.viceznaky) hit = VZ.find(x => x.h.length > 1 && x.h.every((z, j) => zv[i + j] === z && !hl[i + j].v));
      if (hit) {
        kody.push(hit.kod);
        if (v.doplnky) kody.push(...hit.dopl);
        i += hit.h.length;
      } else {
        const k = Z.ZVUKY[zv[i]];
        if (k) kody.push(k);
        i++;
      }
    }
    return kody;
  }

  /* Foneticky přepsané slovo → {tr, kody}. */
  function prepisSlovo(slovo, volby) {
    const v = volbyS(volby);
    if (v.styl === 'muzeum') {
      const mala = slovo.toLowerCase().normalize('NFC');
      const kody = [];
      for (let i = 0; i < mala.length;) {
        let k = najdi(mala, i, MUZEUM_KLICE), delka = k ? k.length : 1;
        if (!k) { const z = bezDiakritiky(mala[i]); k = MUZEUM[z] ? z : null; }
        // zdvojená písmena se tu píšou obě – muzejní abeceda je písmeno po písmenu
        if (k) kody.push(...MUZEUM[k].split(' '));
        i += delka;
      }
      return { tr: kody.map(k => ZVUK_ZNAKU[k] || '').join(''), kody };
    }
    const hl = proskrtejSamohlasky(hlasky(slovo), v.samohlasky);
    return { tr: hl.map(h => h.z).join(''), kody: znakyHlasek(hl, v) };
  }

  /* ---------- čísla ---------- */
  const PISM = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  function cislo(n) {
    n = Math.floor(n);
    if (!(n > 0) || n > 9999999) return null;
    const kody = [];
    const mil = Math.floor(n / 1e6), sto = Math.floor(n / 1e5) % 10;
    for (let i = 0; i < mil; i++) kody.push('C11');
    for (let i = 0; i < sto; i++) kody.push('I8');
    [['D50', 1e4], ['M12', 1e3], ['V1', 100], ['V20', 10], ['Z15', 1]].forEach(([k, r]) => {
      const c = Math.floor(n / r) % 10;
      if (c) kody.push(k + PISM[c - 1]);
    });
    return kody;
  }

  /* ---------- rozbor textu ----------
     [Jméno]  → kartuše, {G17} → znak podle Gardinera, hieroglyf vložený
     přímo → ten znak, číslice → egyptské číslo, konec řádku → nový řádek. */
  const SLOVNIK_MAPA = new Map();
  let MAX_SLOV = 1;
  for (const s of Z.SLOVNIK) for (const t of s.cs) {
    const k = klic(t).replace(/[^\p{L}\s]/gu, '').trim().replace(/\s+/g, ' ');
    SLOVNIK_MAPA.set(k, s);
    MAX_SLOV = Math.max(MAX_SLOV, k.split(' ').length);
  }

  const RE_TOKEN = /\{\s*([A-Za-z]{1,2}\d+[A-Za-z]?)\s*\}|([\u{13000}-\u{1342F}]+)|(\[)|(\])|(\n)|(\d+)|([\p{L}\p{M}]+)/gu;

  function rozloz(text, volby) {
    const v = volbyS(volby);
    const tok = [];
    let m;
    RE_TOKEN.lastIndex = 0;
    while ((m = RE_TOKEN.exec(text || ''))) {
      const od = m.index, po = m.index + m[0].length;
      const pocet = tok.length;
      if (m[1]) {
        const kod = normKod(m[1]);
        tok.push(Z.ZNAK[kod] ? { t: 'znak', kody: [kod], cesky: '{' + kod + '}' } : { t: 'neznamy', cesky: m[0] });
      } else if (m[2]) tok.push({ t: 'znak', kody: [...m[2]].map(ch => Z.KODY[ch.codePointAt(0) - 0x13000]), cesky: m[2] });
      else if (m[3]) tok.push({ t: '[' });
      else if (m[4]) tok.push({ t: ']' });
      else if (m[5]) tok.push({ t: 'radek' });
      else if (m[6]) tok.push({ t: 'cislo', cesky: m[6] });
      else tok.push({ t: 'slovo', cesky: m[7] });
      if (tok.length > pocet) Object.assign(tok[tok.length - 1], { od, po });
    }
    // přímo za sebou vložené znaky ({G17}{N35}) tvoří jedno „slovo“
    const tk = [];
    for (const t of tok) {
      const p = tk[tk.length - 1];
      if (t.t === 'znak' && p && p.t === 'znak' && p.po === t.od) { p.kody.push(...t.kody); p.cesky += t.cesky; p.po = t.po; }
      else tk.push(Object.assign({}, t, { kody: t.kody && t.kody.slice() }));
    }

    const out = [];
    let kart = null, idKart = 0;
    const celyVKartusi = v.kartuse;
    if (celyVKartusi) kart = ++idKart;
    const pridejDet = () => { if (v.det && Z.ZNAK[v.det]) out.push({ druh: 'det', cesky: '', tr: '', kody: [v.det], kartuse: null }); };

    for (let i = 0; i < tk.length; i++) {
      const t = tk[i];
      if (t.t === '[') { if (!celyVKartusi && !kart) kart = ++idKart; continue; }
      if (t.t === ']') {
        if (!celyVKartusi && kart) { kart = null; pridejDet(); }
        continue;
      }
      if (t.t === 'radek') { out.push({ druh: 'radek' }); continue; }
      if (t.t === 'neznamy') { out.push({ druh: 'neznamy', cesky: t.cesky, tr: '', kody: [], kartuse: kart }); continue; }
      if (t.t === 'znak') { out.push({ druh: 'znaky', cesky: t.cesky, tr: t.kody.map(k => ZVUK_ZNAKU[k] || k).join('-'), kody: t.kody.slice(), kartuse: kart }); continue; }
      if (t.t === 'cislo') {
        const k = cislo(Number(t.cesky));
        out.push(k ? { druh: 'cislo', cesky: t.cesky, tr: t.cesky, kody: k, kartuse: kart }
                   : { druh: 'neznamy', cesky: t.cesky, tr: '', kody: [], kartuse: kart });
        continue;
      }
      // slovo: nejdřív slovníček (nejdelší fráze), ve jménech (kartuši) ne
      if (v.slovnik && !kart) {
        let hit = null, delka = 0;
        for (let n = Math.min(MAX_SLOV, tk.length - i); n >= 1 && !hit; n--) {
          const okno = tk.slice(i, i + n);
          if (!okno.every(x => x.t === 'slovo')) continue;
          const s = SLOVNIK_MAPA.get(okno.map(x => klic(x.cesky)).join(' '));
          if (s) { hit = s; delka = n; }
        }
        if (hit) {
          out.push({ druh: 'slovnik', cesky: tk.slice(i, i + delka).map(x => x.cesky).join(' '), tr: hit.tr,
            kody: hit.z.split(' '), kartuse: null, pozn: hit.pozn || '' });
          i += delka - 1;
          continue;
        }
      }
      const p = prepisSlovo(t.cesky, v);
      out.push({ druh: 'jmeno', cesky: t.cesky, tr: p.tr, kody: p.kody, kartuse: kart });
      if (!kart) pridejDet();
    }
    if (kart && !celyVKartusi) pridejDet();    // neuzavřená závorka
    if (celyVKartusi) pridejDet();
    return out.filter(p => p.druh === 'radek' || p.kody.length || p.druh === 'neznamy');
  }

  // „g17“ → „G17“, „aa1“ → „Aa1“, „z15a“ → „Z15A“
  function normKod(k) {
    const m = String(k).trim().match(/^([A-Za-z]{1,2})(\d+)([A-Za-z]?)$/);
    if (!m) return k;
    let p = m[1].toUpperCase();
    if (p === 'AA') p = 'Aa';
    return p + Number(m[2]) + m[3].toUpperCase();
  }

  /* ---------- skládání do čtverců ----------
     Znak má přirozenou velikost z fontu (em = výška čtverce). Pro
     skupinu znaků se zkusí všechna uspořádání vedle sebe (H) a pod
     sebou (V) i vnořená (H z V…) a vybere se to, které je potřeba
     nejméně zmenšit. Znak se přidá do čtverce jen tehdy, když skupina
     nemusí zmenšit víc než na PRAH původní velikosti.                 */
  const MEZ = 0.07;          // mezera mezi znaky ve čtverci
  const PRAH = 0.84;
  const MAX_VE_CTVERCI = 4;

  function velikost(uzel) {
    if (uzel.t === 'z') return uzel;
    let w = 0, h = 0;
    for (const d of uzel.d) {
      velikost(d);
      if (uzel.t === 'H') { w += d.w; h = Math.max(h, d.h); }
      else { h += d.h; w = Math.max(w, d.w); }
    }
    if (uzel.t === 'H') w += MEZ * (uzel.d.length - 1); else h += MEZ * (uzel.d.length - 1);
    uzel.w = w; uzel.h = h;
    return uzel;
  }

  // všechna rozdělení posloupnosti na ≥ 2 souvislé části
  function rozdeleni(n) {
    const out = [];
    for (let maska = 1; maska < (1 << (n - 1)); maska++) {
      const casti = []; let od = 0;
      for (let i = 0; i < n - 1; i++) if (maska & (1 << i)) { casti.push([od, i + 1]); od = i + 1; }
      casti.push([od, n]);
      out.push(casti);
    }
    return out;
  }
  function varianty(listy, smer) {
    if (listy.length === 1) return [listy[0]];
    const jiny = smer === 'H' ? 'V' : 'H';
    const out = [];
    for (const casti of rozdeleni(listy.length)) {
      let kombinace = [[]];
      for (const [a, b] of casti) {
        const moznosti = b - a === 1 ? [listy[a]] : varianty(listy.slice(a, b), jiny);
        const dalsi = [];
        for (const k of kombinace) for (const m of moznosti) dalsi.push(k.concat([m]));
        kombinace = dalsi;
      }
      for (const d of kombinace) out.push({ t: smer, d });
    }
    return out;
  }
  const kopie = u => u.t === 'z' ? Object.assign({}, u) : { t: u.t, d: u.d.map(kopie) };
  // V řádcích je čtverec vysoký nanejvýš 1 em a široký jako nejširší znak,
  // ve sloupcích naopak široký nanejvýš 1 em (široký znak se zmenší).
  const meritkoSama = (l, sv) => Math.min(1, 1 / (sv ? l.w : l.h));

  function nejlepsi(listy, sv) {
    if (listy.length === 1) return { uzel: listy[0], s: meritkoSama(listy[0], sv), rel: 1 };
    const volny = Math.max(1, ...listy.map(l => sv ? l.h : l.w));
    const sMin = Math.min(...listy.map(l => meritkoSama(l, sv)));
    let best = null;
    for (const smer of ['H', 'V']) for (const u0 of varianty(listy, smer)) {
      const u = velikost(kopie(u0));
      const s = sv ? Math.min(1, 1 / u.w, volny / u.h) : Math.min(1, 1 / u.h, volny / u.w);
      const plocha = listy.reduce((a, l) => a + l.w * l.h, 0) / (u.w * u.h);
      const skore = Math.round(s * 30) / 30 + plocha * 0.01;
      if (!best || skore > best.skore) best = { uzel: u, s, rel: s / sMin, skore };
    }
    return best;
  }

  function ctverce(kody, rozmer, volby) {
    const v = volbyS(volby);
    const listy = kody.map(k => Object.assign({ t: 'z', kod: k }, rozmer(k)));
    const out = [];
    let cur = [];
    const uzavri = () => {
      if (!cur.length) return;
      const b = nejlepsi(cur, v.svisle);
      out.push({ kody: cur.map(l => l.kod), strom: b.uzel, s: b.s, w: b.uzel.w * b.s, h: b.uzel.h * b.s });
      cur = [];
    };
    for (const l of listy) {
      if (!v.skladat) { cur = [l]; uzavri(); continue; }
      if (cur.length && cur.length < MAX_VE_CTVERCI) {
        const b = nejlepsi(cur.concat([l]), v.svisle);
        if (b.rel >= PRAH) { cur.push(l); continue; }
      }
      uzavri();
      cur = [l];
    }
    uzavri();
    return out;
  }

  /* ---------- sazba ---------- */
  const MEZ_CTV = 0.12;      // mezera mezi čtverci
  const KP = 0.2;            // vnitřní okraj kartuše
  const KUZEL = 0.16;        // místo na uzel na konci kartuše
  const MEZ_RADKU = 0.35;

  // umístí strom čtverce do obdélníku; znaky přidá do `znaky`
  function umistiStrom(uzel, x, y, s, znaky, idx) {
    if (uzel.t === 'z') { znaky.push({ kod: uzel.kod, x, y, w: uzel.w * s, h: uzel.h * s, s, polozka: idx }); return; }
    let p = 0;
    for (const d of uzel.d) {
      if (uzel.t === 'H') {
        umistiStrom(d, x + p, y + (uzel.h - d.h) * s / 2, s, znaky, idx);
        p += (d.w + MEZ) * s;
      } else {
        umistiStrom(d, x + (uzel.w - d.w) * s / 2, y + p, s, znaky, idx);
        p += (d.h + MEZ) * s;
      }
    }
  }

  function sazba(polozky, rozmer, volby) {
    const v = volbyS(volby);
    const sv = v.svisle;
    // bloky: slovo nebo celá kartuše; řádek = posloupnost bloků
    const radky = [[]];
    let kartBlok = null;
    polozky.forEach((p, idx) => {
      if (p.druh === 'radek') { radky.push([]); kartBlok = null; return; }
      if (!p.kody.length) return;
      const ctv = ctverce(p.kody, rozmer, v).map(c => Object.assign(c, { polozka: idx }));
      const radek = radky[radky.length - 1];
      if (p.kartuse) {
        if (kartBlok && kartBlok.id === p.kartuse) { kartBlok.slova.push(ctv); return; }
        kartBlok = { id: p.kartuse, kartuse: true, slova: [ctv] };
        radek.push(kartBlok);
      } else {
        kartBlok = null;
        radek.push({ kartuse: false, slova: [ctv] });
      }
    });

    // délka bloku ve směru psaní
    const delkaCtv = c => sv ? c.h : c.w;
    const delkaSlova = ctv => ctv.reduce((a, c) => a + delkaCtv(c), 0) + MEZ_CTV * Math.max(0, ctv.length - 1);
    const delkaBloku = b => b.slova.reduce((a, s) => a + delkaSlova(s), 0) + v.mezeraSlov * 0.6 * (b.slova.length - 1)
      + (b.kartuse ? 2 * KP + KUZEL : 0);

    // zalomení: bloky se nedělí; příliš dlouhé slovo mimo kartuši se rozdělí po čtvercích
    const limit = v.sirka > 0 ? v.sirka : Infinity;
    const vystupRadky = [];
    for (const r of radky) {
      let cur = [], del = 0;
      const pridej = b => {
        const d = delkaBloku(b);
        if (cur.length && del + v.mezeraSlov + d > limit) { vystupRadky.push(cur); cur = []; del = 0; }
        cur.push(b); del += (cur.length > 1 ? v.mezeraSlov : 0) + d;
      };
      for (const b of r) {
        if (!b.kartuse && delkaBloku(b) > limit && b.slova[0].length > 1) {
          let kus = [];
          for (const c of b.slova[0]) {
            const zkus = { kartuse: false, slova: [kus.concat([c])] };
            if (kus.length && delkaBloku(zkus) > limit) { pridej({ kartuse: false, slova: [kus] }); kus = []; }
            kus.push(c);
          }
          if (kus.length) pridej({ kartuse: false, slova: [kus] });
        } else pridej(b);
      }
      vystupRadky.push(cur);
    }

    // příčný rozměr řádku: 1 em (čtverec) + okraje kartuše
    const znaky = [], kartuse = [];
    const pricne = 1 + 2 * KP;
    let maxDelka = 0;
    vystupRadky.forEach((r, ri) => {
      const o = ri * (pricne + MEZ_RADKU);       // posun řádku (sloupce)
      let p = 0;                                  // pozice ve směru psaní
      r.forEach((b, bi) => {
        if (bi) p += v.mezeraSlov;
        const zac = p;
        if (b.kartuse) p += KP;
        b.slova.forEach((ctv, si) => {
          if (si) p += v.mezeraSlov * 0.6;
          ctv.forEach((c, ci) => {
            if (ci) p += MEZ_CTV;
            // ve směru napříč se čtverec vystředí
            if (sv) umistiStrom(c.strom, o + (pricne - c.w) / 2, p, c.s, znaky, c.polozka);
            else umistiStrom(c.strom, p, o + (pricne - c.h) / 2, c.s, znaky, c.polozka);
            p += delkaCtv(c);
          });
        });
        if (b.kartuse) {
          p += KP;
          const del = p - zac;
          kartuse.push(sv ? { x: o + 0.03, y: zac, w: pricne - 0.06, h: del, svisle: true }
                          : { x: zac, y: o + 0.03, w: del, h: pricne - 0.06, svisle: false });
          p += KUZEL;
        }
      });
      maxDelka = Math.max(maxDelka, p);
    });
    const pocet = vystupRadky.length;
    const napric = pocet * pricne + (pocet - 1) * MEZ_RADKU;
    return {
      sirka: sv ? napric : maxDelka, vyska: sv ? maxDelka : napric,
      znaky, kartuse, radku: pocet,
    };
  }

  /* ---------- výstupy ---------- */
  function unicode(polozky) {
    let out = '', kart = null, prvni = true;
    for (const p of polozky) {
      if (p.druh === 'radek') {
        if (kart) { out += Z.ZNAK.V11B; kart = null; }
        out += '\n'; prvni = true; continue;
      }
      if (kart && p.kartuse !== kart) { out += Z.ZNAK.V11B; kart = null; }
      if (!p.kody.length) continue;
      if (!prvni && !(kart && p.kartuse === kart)) out += ' ';
      if (p.kartuse && p.kartuse !== kart) { out += Z.ZNAK.V11A; kart = p.kartuse; }
      out += p.kody.map(k => Z.ZNAK[k] || '').join('');
      prvni = false;
    }
    if (kart) out += Z.ZNAK.V11B;
    return out;
  }

  // Manuel de Codage: '-' odděluje čtverce, ':' pod sebou, '*' vedle sebe,
  // '<-' '->' kartuše, '!' konec řádku
  function mdcStrom(u, uvnitr) {
    if (u.t === 'z') return u.kod;
    const s = u.d.map(d => mdcStrom(d, true)).join(u.t === 'H' ? '*' : ':');
    return uvnitr ? '(' + s + ')' : s;
  }
  function mdc(polozky, rozmer, volby) {
    const v = volbyS(volby);
    const casti = [];
    let kart = null;
    for (const p of polozky) {
      if (p.druh === 'radek') { if (kart) { casti.push('->'); kart = null; } casti.push('!'); continue; }
      if (kart && p.kartuse !== kart) { casti.push('->'); kart = null; }
      if (!p.kody.length) continue;
      if (p.kartuse && p.kartuse !== kart) { casti.push('<-'); kart = p.kartuse; }
      casti.push(ctverce(p.kody, rozmer, v).map(c => mdcStrom(c.strom, false)).join('-'));
    }
    if (kart) casti.push('->');
    return casti.join(' ').replace(/<- /g, '<-').replace(/ ->/g, '->').replace(/ ?! ?/g, ' !\n').trim();
  }

  /* rozměry znaků podle obrysů ve fontu (opentype.js) */
  function rozmerZFontu(font) {
    const cache = {};
    const upm = font.unitsPerEm || 1000;
    return kod => {
      if (cache[kod]) return cache[kod];
      const gl = font.charToGlyph(Z.ZNAK[kod] || ' ');
      const b = gl.getBoundingBox();
      let w = (b.x2 - b.x1) / upm, h = (b.y2 - b.y1) / upm;
      if (!(w > 0) || !(h > 0)) { w = 0.5; h = 0.5; }
      // velmi tenké znaky (čárka) potřebují aspoň kousek šířky
      return (cache[kod] = { w: Math.max(w, 0.06), h: Math.max(h, 0.06), x1: b.x1, y2: b.y2, upm, glyf: gl });
    };
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function popisZnaku(kod) {
    const p = Z.POPIS[kod];
    if (!p) return kod;
    const [co, cteni] = p.split('|');
    return kod + ' – ' + co + (cteni ? ' (' + cteni + ')' : '');
  }

  // cesta kartuše: ovál (stadion) + příčná čárka – uzel – na konci
  function cestaKartuse(k, V, sila) {
    const x = k.x * V, y = k.y * V, w = k.w * V, h = k.h * V;
    let d;
    if (!k.svisle) {
      const r = Math.min(h / 2, w / 2);
      d = `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
      const ux = x + w + KUZEL * V * 0.45;
      d += `M${ux},${y + h * 0.08}V${y + h * 0.92}`;
    } else {
      const r = Math.min(w / 2, h / 2);
      d = `M${x},${y + r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x},${y + h - r}Z`;
      const uy = y + h + KUZEL * V * 0.45;
      d += `M${x + w * 0.08},${uy}H${x + w * 0.92}`;
    }
    return `<path d="${d}" fill="none" stroke-width="${sila}" stroke-linecap="round"/>`;
  }

  /* SVG s obrysy znaků. v: {velikost (px na em), okraj (em), barva, pozadi,
     rtl, popisky (title u znaků), tridy (data-polozka)}                */
  function svg(saz, rozmer, v) {
    v = Object.assign({ velikost: 64, okraj: 0.35, barva: '#2b2116', pozadi: null, rtl: false, popisky: true }, v || {});
    const V = v.velikost, O = v.okraj * V;
    const W = Math.ceil(saz.sirka * V + 2 * O), H = Math.ceil(saz.vyska * V + 2 * O);
    const casti = [];
    for (const z of saz.znaky) {
      const r = rozmer(z.kod);
      // 1 em sazby = upm jednotek fontu; levý horní roh obrysu na (x, y) znaku
      const k = V * z.s / r.upm;                    // px na jednotku fontu
      const x = z.x * V - r.x1 * k, y = z.y * V + r.y2 * k;
      const d = r.glyf.getPath(x, y, k * r.upm).toPathData(2);
      const t = v.popisky ? `<title>${esc(popisZnaku(z.kod))}</title>` : '';
      casti.push(`<path d="${d}" data-polozka="${z.polozka}" data-kod="${z.kod}">${t}</path>`);
    }
    const sila = Math.max(1, 0.045 * V);
    const kart = saz.kartuse.map(k => cestaKartuse(k, V, sila)).join('');
    // psaní zprava doleva = zrcadlový obraz celé sazby (znaky hledí doprava)
    const flipX = v.rtl ? ` transform="translate(${W - O},${O}) scale(-1,1)"` : ` transform="translate(${O},${O})"`;
    const bg = v.pozadi ? `<rect width="100%" height="100%" fill="${v.pozadi}"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
      + bg + `<g${flipX} fill="${v.barva}" stroke="${v.barva}" stroke-width="0">${casti.join('')}`
      + `<g stroke-width="${sila}">${kart}</g></g></svg>`;
  }

  const API = {
    VYCHOZI, hlasky, prepisSlovo, cislo, rozloz, normKod, ctverce, sazba, unicode, mdc,
    rozmerZFontu, svg, popisZnaku, ZVUK_ZNAKU, _nejlepsi: nejlepsi,
  };
  g.HIERO = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
