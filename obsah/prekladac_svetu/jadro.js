/* ============================================================
   prekladac_svetu/jadro.js – překladač do vymyšlených jazyků.

   Jazyky jsou vlastní (žádný není převzatý z knih ani filmů).
   Překlad je deterministický: české slovo se rozdělí na kmen
   a koncovku, z kmene se hashem vybere „náhoda“ a z hlásek
   jazyka se poskládá kořen; koncovka dostane pevnou příponu.
   Stejné slovo tak dá vždy stejný překlad, tvary jednoho slova
   (drak, draka, drakovi) mají společný kořen.

     PRESVETU.JAZYKY                          – vestavěné jazyky
     PRESVETU.registruj([jazyk…])              – jazyky uživatele (id dosažitelné přes jazyk())
     PRESVETU.preloz(text, j, lexikon, pary)   → text v jazyce (j = id nebo objekt)
     PRESVETU.zpet(text, j, slova, lexikon)    → {text, neznama}
     PRESVETU.rozbor(text, j, lexikon)         → [{cs, cil, kmen, konc, koren, pripona, zdroj, pocet}]
     PRESVETU.jmena(j, {pocet, min, max, semeno, pridomek, lex}) → [{jmeno, pridomek, pridomekCs}]
     PRESVETU.nahodnyJazyk(semeno), zkontroluj(jazyk) – editor vlastních jazyků
     lexikon = [{cs, cil, tvary}] – ruční překlady (tvary: platí pro celý kmen)
   ============================================================ */
const PRESVETU = (function () {
  const JAZYKY = [
    { id: 'elfi', pismo: 'abeceda', abeceda: { styl: 'vlnite', semeno: 7 }, nazev: 'Elfština (sylvarin)', emoji: '🧝', vlastni: 'Sylvarin',
      popis: 'Měkká řeč lesních elfů: hodně samohlásek, l, r, th. Zní jako zpěv – slova se protahují, souhlásky se skoro nevyslovují.',
      vyslovnost: 'ë se čte jako krátké e na konci slova, th jako anglické th, c vždy jako k.',
      hlas: { vyska: 1.35, rychlost: 0.85 },
      zac: ['l', 'r', 'n', 'm', 's', 'th', 'v', 'f', 'c', 't', 'el', 'al', 'ar', 'ny', 'ly', 'gw', ''],
      jadro: ['a', 'e', 'i', 'o', 'ë', 'ia', 'ie', 'ae', 'ui', 'a', 'e', 'i', 'é'],
      kon: ['n', 'l', 'r', 's', 'th', 'nd', 'ss', 'ril'], pKon: 0.35,
      pripony: ['', 'ë', 'iel', 'or', 'an', 'in', 'ath', 'wen', 'ir', 'os', 'ien', 'al'], maxSlabik: 3 },
    { id: 'trpaslici', pismo: 'abeceda', abeceda: { styl: 'runove', semeno: 7 }, nazev: 'Trpasličí kamenná řeč (dvergrim)', emoji: '⛏️', vlastni: 'Dvergrim',
      popis: 'Tvrdá řeč horníků a kovářů. Krátká slova jako údery kladiva, zavřené slabiky, hrdelní kh. Píše se hranatými runami tesanými do kamene.',
      vyslovnost: 'kh je hrdelní ch, â a û jsou dlouhé a temné samohlásky.',
      hlas: { vyska: 0.55, rychlost: 0.85 },
      zac: ['k', 'kh', 'd', 'g', 'b', 'z', 'dr', 'gr', 'br', 'th', 'r', 'n', 'm', 'bh', 'h'],
      jadro: ['a', 'u', 'o', 'i', 'â', 'û', 'e', 'a', 'u'],
      kon: ['r', 'k', 'd', 'm', 'n', 'rm', 'zd', 'rk', 'nd', 'l', 'g', 'rn', 'th'], pKon: 0.8,
      pripony: ['', 'ul', 'ak', 'um', 'in', 'az', 'or', 'ek', 'âr', 'und'], maxSlabik: 2 },
    { id: 'skreti', pismo: 'abeceda', abeceda: { styl: 'drapy', semeno: 7 }, nazev: 'Skřetí hantýrka (grukh)', emoji: '👺', vlastni: 'Grukh',
      popis: 'Chrčivá řeč skřetů a goblinů. Mluví se nahlas, nejlépe s pěstí na stole – každá věta končí vykřičníkem.',
      vyslovnost: 'gh je chraplavé g, ü se vyslovuje jako u s úšklebkem.',
      hlas: { vyska: 0.3, rychlost: 1.15 }, vykrik: true,
      zac: ['g', 'gr', 'kr', 'sk', 'z', 'zg', 'b', 'br', 'dr', 'm', 'sn', 'sh', 'r', 'n', 'ug', ''],
      jadro: ['u', 'a', 'o', 'ü', 'uu', 'a', 'i', 'u'],
      kon: ['g', 'k', 'kh', 'z', 'rz', 'gh', 'sh', 'b', 't', 'rg', 'zg'], pKon: 0.75,
      pripony: ['', 'uk', 'ak', 'z', 'ish', 'og', 'gul', 'ash', 'nak'], maxSlabik: 2 },
    { id: 'draci', pismo: 'abeceda', abeceda: { styl: 'draci', semeno: 7 }, nazev: 'Dračí řeč (vorthaxis)', emoji: '🐉', vlastni: 'Vorthaxis',
      popis: 'Prastarý syčivý jazyk draků. Draci myslí odzadu – slova ve větě jdou v obráceném pořadí.',
      vyslovnost: 'x jako ks, ss se dlouze syčí, rr je válené.',
      hlas: { vyska: 0.1, rychlost: 0.7 }, obracene: true,
      zac: ['v', 'z', 's', 'sh', 'th', 'kr', 'dr', 'x', 'ss', 'vh', 'n', 'r', 'y', 'q'],
      jadro: ['a', 'o', 'i', 'ae', 'ah', 'u', 'ei', 'aa'],
      kon: ['x', 'ss', 'th', 'r', 'n', 'z', 'rr', 'sh', 'k'], pKon: 0.6,
      pripony: ['', 'ax', 'ir', 'oth', 'iss', 'ar', 'un', 'yx'], maxSlabik: 3 },
    { id: 'mimozemska', pismo: 'abeceda', abeceda: { styl: 'kruhy', semeno: 7 }, nazev: 'Mimozemská řeč (zq\'tari)', emoji: '👽', vlastni: 'Zq\'tari',
      popis: 'Jazyk z mlhoviny Zq\'tar. Apostrof je mlasknutí, slova jsou plná x a q. Píše se kroužky a čárkami zavěšenými pod spojovací linkou.',
      vyslovnost: 'Apostrof je mlasknutí jazykem, q je hluboké k, ä jako otevřené e.',
      hlas: { vyska: 2, rychlost: 1.3 }, spojka: '\'', pSpojka: 0.4,
      zac: ['x', 'q', 'k', 'z', 't', 'ql', 'xr', 'zh', 'v', 'n', 'ix', 'tl'],
      jadro: ['a', 'i', 'u', 'ee', 'oo', 'y', 'ä', 'ii'],
      kon: ['k', 'q', 'x', 't', 'n', 'zz', 'qt'], pKon: 0.5,
      pripony: ['', '-ka', '\'ix', '-oq', 'ii', '\'tl', '-zu'], maxSlabik: 3 },
    { id: 'robot', pismo: 'abeceda', abeceda: { styl: 'obvod', semeno: 7 }, nazev: 'Robotí kód (binarion)', emoji: '🤖', vlastni: 'BINARION',
      popis: 'Protokol androidů a lodních počítačů. Slabiky odděluje pomlčka, všechno se píše velkými písmeny a čísla jsou ve dvojkové soustavě.',
      vyslovnost: 'Čte se monotónně, každá slabika zvlášť: BZ-EEP.',
      hlas: { vyska: 0, rychlost: 1 }, velka: true, spojka: '-', pSpojka: 1, binarni: true,
      zac: ['b', 'z', 'k', 't', 'v', 'd', 'tr', 'kr', 'zz', 'p', 'x'],
      jadro: ['ee', 'ii', 'o', 'a', 'u', 'i', 'oo'],
      kon: ['p', 't', 'k', 'zt', 'rr', 'x', 'n', 'mm'], pKon: 0.7,
      pripony: ['', '-0', '-1', '-01', '-10', '-X', '-7', '-11'], maxSlabik: 3 },
    { id: 'galakticka', pismo: 'abeceda', abeceda: { styl: 'geometr', semeno: 7 }, nazev: 'Galaktická obchodní řeč (galaktika)', emoji: '🛸', vlastni: 'Galaktika',
      popis: 'Zjednodušený jazyk vesmírných přístavů a trhů, kterým se domluví lidé, roboti i mimozemšťané. Jen otevřené slabiky, nic složitého.',
      vyslovnost: 'Čte se, jak se píše. j = j, w = krátké u.',
      hlas: { vyska: 1, rychlost: 1.05 },
      zac: ['b', 'd', 'g', 'k', 'l', 'm', 'n', 'p', 's', 't', 'w', 'j', 'h'],
      jadro: ['a', 'e', 'i', 'o', 'u'],
      kon: ['n', 's'], pKon: 0.15,
      pripony: ['', '-ka', '-no', '-ta', '-si', '-lo', '-mu'], minSlabik: 2, maxSlabik: 4 },
    { id: 'arkanum', pismo: 'abeceda', abeceda: { styl: 'pecet', semeno: 7 }, nazev: 'Řeč mágů (arkánum)', emoji: '🧙', vlastni: 'Arcanum',
      popis: 'Zaklínací jazyk čarodějů, učený z prastarých svitků. Zní jako latina – vhodné na zaklínadla, nápisy na hůlky a nadpisy kouzelných knih.',
      vyslovnost: 'c se čte jako k, ae jako é, au jako au.',
      hlas: { vyska: 0.8, rychlost: 0.75 },
      zac: ['c', 'v', 'l', 'm', 'n', 's', 't', 'r', 'ign', 'luc', 'um', 'ex', 'ar', 'f', 'p', ''],
      jadro: ['a', 'e', 'i', 'o', 'u', 'ae', 'au', 'a', 'o'],
      kon: ['s', 'x', 'm', 'n', 'r', 't', 'l'], pKon: 0.4,
      pripony: ['us', 'um', 'is', 'ae', 'ex', 'or', 'ium', 'a', 'ta', 'o'], maxSlabik: 3 },
  ];
  JAZYKY.forEach((j, i) => { j.semeno = 7919 * (i + 1); j.vestaveny = true; });
  const PODLE_ID = Object.fromEntries(JAZYKY.map(j => [j.id, j]));
  let vlastni = new Map();   // jazyky uživatele (registruj)

  // id nebo objekt jazyka → objekt
  const jazyk = x => (typeof x === 'string' ? PODLE_ID[x] || vlastni.get(x) : x);
  function registruj(seznam) { vlastni = new Map(seznam.map(j => [j.id, j])); }

  // české koncovky od nejdelší; kmen musí mít aspoň 3 písmena
  const KONCOVKY = ['ovými', 'ového', 'ovému', 'ujeme', 'ujete', 'ovat', 'ovali', 'oval', 'ými', 'ého', 'ému',
    'ech', 'ách', 'ích', 'ami', 'emi', 'ové', 'ovi', 'ují', 'uje', 'ala', 'ali', 'alo', 'aly', 'íme', 'íte',
    'ila', 'ili', 'ilo', 'ou', 'em', 'ům', 'ím', 'ým', 'al', 'il', 'ěl', 'at', 'it', 'et', 'me', 'te',
    'y', 'i', 'a', 'e', 'o', 'u', 'á', 'é', 'í', 'ý', 'ů', 'ě'];

  const bezDiakritiky = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  function hash(s, semeno) {   // FNV-1a
    let h = (2166136261 ^ semeno) >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function nahoda(semeno) {     // mulberry32
    let a = semeno >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const vyber = (pole, r) => pole[Math.floor(r() * pole.length)];

  function rozdel(slovo) {
    for (const k of KONCOVKY) if (slovo.length - k.length >= 3 && slovo.endsWith(k)) return [slovo.slice(0, -k.length), k];
    return [slovo, ''];
  }

  function slabiky(j, r, slabik) {
    const casti = [];
    for (let i = 0; i < slabik; i++) {
      let s = vyber(j.zac, r) + vyber(j.jadro, r);
      if (j.kon.length && r() < j.pKon) s += vyber(j.kon, r);
      if (i && j.spojka && r() < j.pSpojka) casti.push(j.spojka);
      casti.push(s);
    }
    return casti.join('');
  }

  function koren(kmen, j, sul) {
    const r = nahoda(hash(bezDiakritiky(kmen) + (sul ? '#' + sul : ''), j.semeno));
    const slabik = Math.max(j.minSlabik || 1, Math.min(j.maxSlabik, Math.round(kmen.length / 2.6 + r() * 0.8 - 0.4)));
    return slabiky(j, r, slabik);
  }

  // přípona pro koncovku (bez koncovky = první přípona)
  function priponaIndex(konc, j) {
    return konc && j.pripony.length > 1 ? 1 + hash(konc, j.semeno) % (j.pripony.length - 1) : 0;
  }

  // sul > 0 = řešení shody: nejdřív se zkoušejí jiné přípony (kořen zůstává), pak jiný kořen
  function vytvorCasti(male, j, sul) {
    const [kmen, konc] = rozdel(male);
    const n = j.pripony.length - 1;
    let i = priponaIndex(konc, j);
    if (sul && sul <= n) i = konc ? 1 + (i - 1 + sul) % n : sul;
    return { kmen, konc, koren: koren(kmen, j, sul > n ? sul - n : 0), pripona: j.pripony[i] || '' };
  }
  const slep = c => c.koren + c.pripona;

  // běžná slova mají pevnou tabulku bez shod; cache podle objektu jazyka
  // (upravený jazyk je nový objekt → nová tabulka)
  const tabulky = new WeakMap();
  function tabulka(j) {
    let t = tabulky.get(j);
    if (t) return t;
    t = new Map();
    const obsazeno = t.obsazeno = new Set();
    for (const w of SLOVA) {
      if (t.has(w)) continue;
      let sul = 0, c = vytvorCasti(w, j, 0);
      while (obsazeno.has(slep(c)) && sul < 60) c = vytvorCasti(w, j, ++sul);
      obsazeno.add(slep(c));
      t.set(w, c);
    }
    tabulky.set(j, t);
    return t;
  }

  // lexikon = ruční překlady uživatele: [{cs, cil, tvary}] – tvary: true = celý kmen (všechny tvary)
  const lexCache = new WeakMap();
  function pripravLexikon(lex) {
    if (!lex) return null;
    if (lex.presne) return lex;
    let p = lexCache.get(lex);
    if (p) return p;
    p = { presne: new Map(), kmeny: new Map() };
    for (const e of lex) {
      const cs = (e.cs || '').trim().toLowerCase(), cil = (e.cil || '').trim();
      if (!cs || !cil) continue;
      if (e.tvary) p.kmeny.set(rozdel(cs)[0], cil); else p.presne.set(cs, cil);
    }
    lexCache.set(lex, p);
    return p;
  }

  // podrobný překlad jednoho slova (pro rozbor i překlad)
  function detail(slovo, j, lx) {
    const male = slovo.toLowerCase();
    if (lx && lx.presne.has(male)) return { cs: male, cil: lx.presne.get(male), kmen: male, konc: '', koren: lx.presne.get(male), pripona: '', zdroj: 'lexikon' };
    if (lx && lx.kmeny.size) {
      const [kmen, konc] = rozdel(male);
      if (lx.kmeny.has(kmen)) {
        const k = lx.kmeny.get(kmen), pr = j.pripony[priponaIndex(konc, j)] || '';
        return { cs: male, cil: k + pr, kmen, konc, koren: k, pripona: pr, zdroj: 'lexikon-tvary' };
      }
    }
    const t = tabulka(j);
    if (t.has(male)) return Object.assign({ cs: male, cil: slep(t.get(male)), zdroj: 'slovnik' }, t.get(male));
    // ostatní slova se nesmí shodovat s běžnými
    let sul = 0, c = vytvorCasti(male, j, 0);
    while (t.obsazeno.has(slep(c)) && sul < 60) c = vytvorCasti(male, j, ++sul);
    return Object.assign({ cs: male, cil: slep(c), zdroj: 'generovano' }, c);
  }

  // text → tokeny {s: slovo} | {o: ostatní}
  const RE_SLOVO = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}\d]+)*/gu;
  function tokeny(text) {
    const out = [];
    let i = 0;
    for (const m of text.matchAll(RE_SLOVO)) {
      if (m.index > i) out.push({ o: text.slice(i, m.index) });
      out.push({ s: m[0] });
      i = m.index + m[0].length;
    }
    if (i < text.length) out.push({ o: text.slice(i) });
    return out;
  }

  const velkym = s => s.charAt(0).toUpperCase() + s.slice(1);

  // obrácený slovosled: pořadí slov v každé větě pozpátku (interpunkce uvnitř zůstává na místě slov)
  function obrat(tok) {
    const out = [];
    let veta = [];
    const vyprazdni = () => {
      const slova = veta.filter(t => t.s !== undefined).reverse();
      let k = 0;
      for (const t of veta) out.push(t.s !== undefined ? slova[k++] : t);
      veta = [];
    };
    for (const t of tok) {
      veta.push(t);
      if (t.o !== undefined && /[.!?\n]/.test(t.o)) vyprazdni();
    }
    vyprazdni();
    return out;
  }

  // velké písmeno: první slovo věty a slova, která byla velká uprostřed věty (jména)
  // pary (nepovinné) – sem se zapíše [{cs, cil} | {o}] v pořadí výstupu
  function slozit(tok, j, prevod, pary) {
    let zacatek = true;
    const jmena = new Set();
    for (const t of tok) {
      if (t.s !== undefined) { if (!zacatek && /^\p{Lu}/u.test(t.s)) jmena.add(t); zacatek = false; }
      else if (/[.!?\n]/.test(t.o)) zacatek = true;
    }
    const poradi = j.obracene ? obrat(tok) : tok;
    let out = '';
    zacatek = true;
    for (const t of poradi) {
      if (t.s !== undefined) {
        let w = prevod(t.s);
        if (zacatek || jmena.has(t)) w = velkym(w);
        if (j.velka) w = w.toUpperCase();
        out += w;
        if (pary) pary.push({ cs: t.s, cil: w });
        zacatek = false;
      } else {
        let o = t.o;
        if (j.binarni) o = o.replace(/\d+/g, n => Number(n).toString(2));
        if (j.vykrik) o = o.replace(/[.?]/g, '!');
        out += o;
        if (pary) pary.push({ o });
        if (/[.!?\n]/.test(t.o)) zacatek = true;
      }
    }
    if (j.vykrik && /[\p{L}]$/u.test(out.trim())) {
      out = out.replace(/\s*$/, m => '!' + m);
      if (pary) pary.push({ o: '!' });
    }
    return out;
  }

  function preloz(text, id, lex, pary) {
    const j = jazyk(id), lx = pripravLexikon(lex);
    return slozit(tokeny(text), j, s => detail(s, j, lx).cil, pary);
  }

  // zpětný překlad: běžná slova + slova, která uživatel přeložil, + lexikon (slova uživatele mají přednost)
  const zaklad = new WeakMap();
  function mapa(j, slova, lx) {
    let z = zaklad.get(j);
    if (!z) { z = new Map(); for (const w of SLOVA) pridej(z, w, j, null); zaklad.set(j, z); }
    const m = lx && (lx.presne.size || lx.kmeny.size) ? new Map() : new Map(z);
    if (m.size === 0) for (const w of SLOVA) pridej(m, w, j, lx);
    for (const w of slova) pridej(m, w, j, lx, true);
    if (lx) {
      for (const [cs, cil] of lx.presne) m.set(cil.toLowerCase(), cs);
      for (const [kmen, cil] of lx.kmeny) if (!m.has(cil.toLowerCase())) m.set(cil.toLowerCase(), kmen);
    }
    return m;
  }
  function pridej(m, w, j, lx, prepsat) {
    const male = w.toLowerCase(), p = detail(male, j, lx).cil.toLowerCase();
    if (prepsat || !m.has(p)) m.set(p, male);
  }

  function zpet(text, id, slova, lex) {
    const j = jazyk(id), lx = pripravLexikon(lex);
    const m = mapa(j, slova || [], lx);
    const neznama = [];
    let t = j.velka ? text.toLowerCase() : text;
    if (j.binarni) t = t.replace(/(^|[^\p{L}\d\-])([01]+)(?![\p{L}\d\-])/gu, (a, p, b) => p + parseInt(b, 2));
    if (j.vykrik) t = t.replace(/!/g, '.');
    const vysledek = slozit(tokeny(t), Object.assign({}, j, { velka: false, binarni: false, vykrik: false }), s => {
      const c = m.get(s.toLowerCase());
      if (c) return c;
      neznama.push(s);
      return '‹' + s.toLowerCase() + '›';
    });
    return { text: vysledek, neznama };
  }

  // rozbor: každé slovo textu jednou, s kmenem, koncovkou, kořenem, příponou a zdrojem
  function rozbor(text, id, lex) {
    const j = jazyk(id), lx = pripravLexikon(lex), videno = new Map();
    for (const t of tokeny(text)) {
      if (t.s === undefined) continue;
      const male = t.s.toLowerCase();
      if (videno.has(male)) { videno.get(male).pocet++; continue; }
      const d = detail(male, j, lx);
      if (j.velka) { d.cil = d.cil.toUpperCase(); d.koren = d.koren.toUpperCase(); d.pripona = d.pripona.toUpperCase(); }
      d.pocet = 1;
      videno.set(male, d);
    }
    return [...videno.values()];
  }

  // ---------- generátor jmen ----------
  const PRIDOMKY = ['Statečný', 'Moudrá', 'Temný', 'Stříbrná', 'Kamenná pěst', 'z Hor', 'od Řeky', 'Lovec draků',
    'Bez strachu', 'Rudý', 'Tichá', 'Poutník', 'Kovář', 'Zlatovlasá', 'Strážce brány', 'Hvězdná', 'Železný',
    'Vlčí srdce', 'Starý', 'Rychlá', 'Zrozený z ohně', 'Pán stínů', 'Bílá', 'Kapitán', 'Navigátorka'];
  // vrátí [{jmeno, pridomek?, pridomekCs?}]
  function jmena(id, volby) {
    const j = jazyk(id), v = Object.assign({ pocet: 12, min: 2, max: 3, semeno: 1, pridomek: false, lex: null }, volby);
    const r = nahoda(hash('jmena', j.semeno + v.semeno * 31));
    const out = [], videno = new Set();
    for (let pokus = 0; out.length < v.pocet && pokus < v.pocet * 20; pokus++) {
      const n = v.min + Math.floor(r() * (v.max - v.min + 1));
      let w = velkym(slabiky(Object.assign({}, j, { pSpojka: Math.min(j.pSpojka || 0, 0.5) }), r, n));
      if (j.velka) w = w.toUpperCase();
      if (videno.has(w) || w.replace(/[-']/g, '').length < 3) continue;
      videno.add(w);
      const z = { jmeno: w };
      if (v.pridomek) {
        z.pridomekCs = vyber(PRIDOMKY, r);
        z.pridomek = preloz(z.pridomekCs, j, v.lex);
      }
      out.push(z);
    }
    return out;
  }

  // ---------- vlastní jazyky: náhodný návrh, kontrola ----------
  const ZASOBA = {
    zac: ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z', 'x', 'q', 'w',
      'th', 'sh', 'kh', 'gh', 'ch', 'dr', 'tr', 'kr', 'gr', 'br', 'pr', 'fl', 'gl', 'sk', 'st', 'sv', 'zh', 'ny', 'ly', 'ts', ''],
    jadro: ['a', 'e', 'i', 'o', 'u', 'y', 'aa', 'ee', 'ii', 'oo', 'uu', 'ai', 'ei', 'au', 'ou', 'ia', 'io', 'ä', 'ö', 'ü', 'â', 'ê', 'î', 'ô', 'û', 'é', 'á'],
    kon: ['n', 'm', 'l', 'r', 's', 't', 'k', 'x', 'th', 'sh', 'ng', 'nd', 'rk', 'st', 'z', 'g', 'd', 'q', 'ss', 'rn'],
  };
  function zamichej(pole, r) { const a = pole.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; }
  function nahodnyJazyk(semeno) {
    const r = nahoda(hash('nahodny', semeno));
    const zac = zamichej(ZASOBA.zac, r).slice(0, 8 + Math.floor(r() * 8));
    const jadro = zamichej(ZASOBA.jadro.slice(0, 5), r).concat(zamichej(ZASOBA.jadro.slice(5), r).slice(0, 1 + Math.floor(r() * 4)));
    const kon = zamichej(ZASOBA.kon, r).slice(0, 3 + Math.floor(r() * 6));
    const j = { zac, jadro, kon, pKon: Math.round((0.15 + r() * 0.7) * 20) / 20, minSlabik: 1, maxSlabik: 2 + Math.floor(r() * 2), pripony: [''], semeno: Math.floor(r() * 1e6) };
    for (let i = 0; i < 6 + Math.floor(r() * 4); i++) {
      const p = (r() < 0.5 ? vyber(jadro, r) : '') + vyber(kon.concat(zac.filter(Boolean)), r) + (r() < 0.4 ? vyber(jadro, r) : '');
      if (p && !j.pripony.includes(p)) j.pripony.push(p);
    }
    return j;
  }

  // doplní výchozí hodnoty a vrátí chybu (text) nebo null
  function zkontroluj(j) {
    const pole = k => Array.isArray(j[k]) ? j[k].map(String) : [];
    j.zac = pole('zac'); j.jadro = pole('jadro').filter(Boolean); j.kon = pole('kon').filter(Boolean); j.pripony = pole('pripony');
    if (!j.zac.length) j.zac = [''];
    if (!j.pripony.length) j.pripony = [''];
    j.pKon = Math.min(1, Math.max(0, +j.pKon || 0));
    j.pSpojka = Math.min(1, Math.max(0, +j.pSpojka || 0));
    j.minSlabik = Math.min(6, Math.max(1, Math.round(+j.minSlabik || 1)));
    j.maxSlabik = Math.min(8, Math.max(j.minSlabik, Math.round(+j.maxSlabik || 3)));
    j.semeno = Math.round(+j.semeno || 1);
    j.hlas = Object.assign({ vyska: 1, rychlost: 1 }, j.hlas);
    if (j.pismo === 'glyfy') j.pismo = 'abeceda';   // starší verze: kruhové glyfy → abeceda „kruhy“
    if (j.pismo === 'abeceda') j.abeceda = Object.assign({ styl: 'kruhy', semeno: 1 }, j.abeceda);
    if (!j.nazev || !String(j.nazev).trim()) return 'Jazyk musí mít název.';
    if (!j.jadro.length) return 'Zadejte aspoň jednu samohlásku (jádro slabiky).';
    if (j.pKon > 0 && !j.kon.length) return 'Pravděpodobnost koncové souhlásky je nenulová, ale žádné koncové souhlásky nejsou.';
    return null;
  }

  // běžná česká slova a tvary – aby šlo přeložit zpět i text, který jsem nepsal
  const SLOVA = (`a i o u v k s z na do od po za pro pod nad před mezi bez se si je jsou jsem jsi jsme jste byl byla bylo byli
    být bude budu budeš budeme není nejsem ne ano já ty on ona ono my vy oni mě mi tě ti tebe ho mu jí ji nás nám vás vám
    jim je jejich můj moje moji tvůj tvoje tvá náš naše váš vaše svůj své svou ten ta to ti ty tento tato toto tam tady zde
    kde kdy proč jak co kdo který která které kam odkud když protože ale nebo aby že až už ještě jen také taky velmi moc
    hodně málo všechno všichni nic nikdo něco někdo vždy nikdy dnes zítra včera teď potom ráno večer noc den rok
    ahoj dobrý dobrá dobré den sbohem díky děkuji prosím vítej vítejte promiň pojď pojďte jdi jdu jde jdeme stůj
    přítel přítele přátelé nepřítel nepřítele nepřátelé člověk lidé lidi muž žena dítě děti král královna princ princezna
    rytíř čaroděj mág elf elfové trpaslík trpaslíci skřet skřeti drak draka draci obr obři vlk vlci kůň koně pes kočka pták
    meč meče štít luk šíp sekera kladivo hůl prsten koruna poklad zlato stříbro železo kámen hora hory hoře horou les lesa
    lese řeka moře voda oheň ohně ohni země vzduch vítr nebe slunce měsíc hvězda hvězdy hvězd svět světa světě cesta brána
    bránu dům hrad věž město vesnice hospoda hospodě jídlo pivo víno chléb hlava srdce ruka ruce oko oči krev život smrt
    láska mír míru válka válku bitva síla moc magie kouzlo kouzla odvaha čest naděje strach tma světlo stín stíny
    loď lodi lodě vesmír planeta planety hvězdná palivo motor motory štíty robot roboti počítač stroj mimozemšťan
    mimozemšťané kapitán posádka paluba palubu laser zbraň zbraně zbraní signál zpráva rychlost výkon plný plnou
    jít přijít přicházíme přichází odejít mluvit mluví říct řekl vidět vidím vím znát spát spí jíst pít bojovat
    chránit pomoc pomoci pomoz potřebuje potřebuji potřebujeme mít mám máš máme chci chceš chceme můžeš můžu může
    otevři otevřít zavři najít najdi hledat hledám zemřít žít žije vrať zpět dolů nahoru pryč sem domů
    velký velká velké malý malá malé starý stará staré nový nová nové mladý dlouhý krátký silný slabý rychlý pomalý
    krásný temný temná temné světlý zlý dobrý bílý černý červený zelený modrý zlatý jediný první poslední
    má mají měl měla jeden jedna dva dvě tři čtyři pět sto tisíc
    provází prováze provázejí poutník poutníku našeho ohně spí tvorové zvláštní mírumilovní obchodníci nejbližší`)
    .split(/\s+/).filter(Boolean);

  return { JAZYKY, PODLE_ID, jazyk, registruj, preloz, zpet, rozbor, jmena, nahodnyJazyk, zkontroluj, rozdel, SLOVA, bezDiakritiky };
})();
if (typeof module !== 'undefined') module.exports = PRESVETU;
