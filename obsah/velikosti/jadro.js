/* Tabulky velikostí – jádro bez DOM (test: _test/velikosti_test.js).
   Převody oblečení, bot, dětských velikostí, prstenů, rukavic, klobouků, podprsenek a rámů kol;
   doporučení z měr osoby včetně hraničních případů. Orientačně podle EN 13402 a běžných tabulek
   výrobců – každá značka šije jinak.
   Boty: vzorce bere z jádra Barefoot vložek (barefoot_vlozky/jadro.js → BFJ.velikosti), ať se čísla na webu neliší. */
(function () {
  'use strict';
  const BF = typeof module !== 'undefined' ? require('../barefoot_vlozky/jadro.js') : window.BFJ;

  const VERZE = 1;
  const KLIC = 'webapp_velikosti';
  const STAV = '11/2026';

  const fmt = (x, d) => { d = d || 0; const v = Math.round(x * Math.pow(10, d)) / Math.pow(10, d); return v.toFixed(d).replace('.', ','); };
  /* 8.5 → „8½“, 8 → „8“ */
  const pul = x => { if (x == null) return '–'; const c = Math.floor(x + 1e-9); return (x - c > 0.25 ? (c ? c : '') + '½' : String(c)); };
  const zaokr = (x, k) => Math.round(x / k) * k;

  /* ---------- míry osoby ---------- */
  const MIRY = [
    { k: 'vyska', nazev: 'Výška postavy', j: 'cm', min: 40, max: 230, jak: 'Bez bot, zády ke zdi, paty u zdi; na temeno položte knihu kolmo ke zdi a změřte od podlahy.' },
    { k: 'hrudnik', nazev: 'Obvod hrudníku / přes prsa', j: 'cm', min: 30, max: 180, jak: 'Vodorovně přes nejširší místo hrudníku (u žen přes nejvyšší bod prsou), pod pažemi; volně dýchat, metr netáhnout.' },
    { k: 'pas', nazev: 'Obvod pasu', j: 'cm', min: 30, max: 180, jak: 'V nejužším místě trupu (zhruba 2 cm nad pupkem), nezatahovat břicho.' },
    { k: 'boky', nazev: 'Obvod boků', j: 'cm', min: 30, max: 190, jak: 'Vodorovně přes nejširší místo hýždí, nohy u sebe.' },
    { k: 'krk', nazev: 'Obvod krku', j: 'cm', min: 20, max: 60, jak: 'Pod ohryzkem, kde sedí límec; mezi metr a krk vložte prst.' },
    { k: 'rozkrok', nazev: 'Vnitřní délka nohy', j: 'cm', min: 30, max: 110, jak: 'Bez bot od podlahy do rozkroku: mezi nohy si přitiskněte knihu hřbetem nahoru a změřte od podlahy k hřbetu.' },
    { k: 'chodidlo', nazev: 'Délka chodidla', j: 'mm', min: 80, max: 340, jak: 'Ve stoje, večer, s ponožkou: pata u zdi, obkreslit, změřit od zdi k nejdelšímu prstu. Měřte obě nohy, platí delší.' },
    { k: 'prst', nazev: 'Obvod prstu', j: 'mm', min: 35, max: 80, jak: 'Proužek papíru omotat kolem prstu (přes kloub musí projít), označit překryv a změřit. Měřte večer, v teple.' },
    { k: 'dlan', nazev: 'Obvod dlaně', j: 'cm', min: 10, max: 32, jak: 'Kolem dlaně v nejširším místě (přes klouby, bez palce), u pracovní ruky.' },
    { k: 'hlava', nazev: 'Obvod hlavy', j: 'cm', min: 30, max: 70, jak: 'Vodorovně 1–2 cm nad obočím a nad ušima, vzadu přes nejvyšší vyklenutí.' },
    { k: 'podprsi', nazev: 'Obvod pod prsy', j: 'cm', min: 50, max: 140, jak: 'Těsně pod prsy, vodorovně, metr pevně přitažený, po výdechu.' }
  ];
  const MIRA = Object.fromEntries(MIRY.map(m => [m.k, m]));
  const DRUHY = { zena: '👩 Žena', muz: '👨 Muž', dite: '🧒 Dítě' };

  function prazdna() { return { verze: VERZE, profily: [], aktivni: null, pridavek: 12, pxNaMm: null }; }
  function normCislo(v, m) {
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
    return (typeof n === 'number' && isFinite(n) && n >= m.min && n <= m.max) ? n : null;
  }
  function normProfil(p) {
    p = p || {};
    const o = { id: String(p.id || ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))), jmeno: String(p.jmeno || 'Já').slice(0, 60), druh: DRUHY[p.druh] ? p.druh : 'zena', miry: {} };
    for (const m of MIRY) { const v = normCislo(p.miry && p.miry[m.k], m); if (v != null) o.miry[m.k] = v; }
    return o;
  }
  function migruj(d) {
    if (!d || typeof d !== 'object') return prazdna();
    const o = prazdna();
    o.profily = Array.isArray(d.profily) ? d.profily.map(normProfil) : [];
    o.aktivni = o.profily.some(p => p.id === d.aktivni) ? d.aktivni : (o.profily[0] ? o.profily[0].id : null);
    if (typeof d.pridavek === 'number' && d.pridavek >= 0 && d.pridavek <= 25) o.pridavek = d.pridavek;
    if (typeof d.pxNaMm === 'number' && d.pxNaMm > 1 && d.pxNaMm < 30) o.pxNaMm = d.pxNaMm;
    return o;
  }

  /* ---------- obecný výběr řádku ----------
     Řádky vzestupně podle `klic`. Hodnota se zařadí lineární interpolací mezi řádky (p = zlomkový index).
     Velikost pokrývá svoje číslo ± půl kroku, takže hodnota uprostřed mezi dvěma řádky je hraniční. */
  function vyber(radky, klic, h) {
    if (h == null || !radky.length) return null;
    const n = radky.length, v = i => radky[i][klic];
    let p;
    if (n === 1) p = 0;
    else if (h <= v(0)) p = (h - v(0)) / (v(1) - v(0));
    else if (h >= v(n - 1)) p = n - 1 + (h - v(n - 1)) / (v(n - 1) - v(n - 2));
    else { let i = 0; while (v(i + 1) < h) i++; p = i + (h - v(i)) / (v(i + 1) - v(i)); }
    const mimo = p < -0.5 ? 'pod' : p > n - 0.5 ? 'nad' : null;
    const i = Math.max(0, Math.min(n - 1, Math.round(p)));
    const f = p - Math.floor(p);
    const hranice = !mimo && p > 0 && p < n - 1 && f > 0.35 && f < 0.65 ? [Math.floor(p), Math.floor(p) + 1] : null;
    return { i, p, mimo, hranice };
  }

  /* ---------- oblečení dospělých ----------
     Dámské DE 32–54 (krok 4 cm, od 46 krok 6 cm), FR = DE + 2, IT = DE + 6, UK = DE − 26, US = DE − 30.
     Pánské DE = polovina obvodu hrudníku, FR/IT = DE, UK/US = hrudník v palcích. */
  const DAMSKE = [
    [32, 76, 60, 84, 'XS'], [34, 80, 64, 88, 'XS'], [36, 84, 68, 92, 'S'], [38, 88, 72, 96, 'M'], [40, 92, 76, 100, 'M'],
    [42, 96, 80, 104, 'L'], [44, 100, 84, 108, 'L'], [46, 104, 88, 112, 'XL'], [48, 110, 94, 117, 'XL'], [50, 116, 100, 122, 'XXL'],
    [52, 122, 106, 127, 'XXL'], [54, 128, 112, 132, '3XL']
  ].map(([de, hrudnik, pas, boky, mez]) => ({ de, fr: de + 2, it: de + 6, uk: de - 26, us: de - 30, mez, hrudnik, pas, boky }));
  const PANSKE = [
    [44, 'XS'], [46, 'S'], [48, 'M'], [50, 'L'], [52, 'XL'], [54, 'XXL'], [56, '3XL'], [58, '3XL']
  ].map(([de, mez]) => ({ de, fr: de, it: de, uk: de - 10, us: de - 10, mez, hrudnik: de * 2, pas: de * 2 - 12, boky: de * 2 + 4 }));
  /* košile: číslo = obvod krku v cm (+ prst rezervy), US/UK v palcích */
  const KOSILE = [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48].map(cm => ({
    cm, palce: zaokr(cm / 2.54, 0.5), mez: cm <= 38 ? 'S' : cm <= 40 ? 'M' : cm <= 42 ? 'L' : cm <= 44 ? 'XL' : cm <= 46 ? 'XXL' : '3XL'
  }));
  const JEANS_W = []; for (let w = 24; w <= 44; w++) JEANS_W.push({ w, pas: Math.round(w * 2.54) });
  const JEANS_L = [28, 30, 32, 34, 36].map(l => ({ l, rozkrok: Math.round(l * 2.54) }));

  const RADA = {
    obleceni: (a, b) => `u slim střihu nebo na vrstvení volte ${b}, u volného střihu stačí ${a}`,
    kalhoty: (a, b) => `rozhoduje pohodlí v pase – u pevné látky volte ${b}, u strečové ${a}`,
    kosile: (a, b) => `volte ${b}, škrtící límec je horší než volnější`,
    boty: (a, b) => `noha večer a při chůzi nabývá – volte ${b}, užší nohu dotáhne tkanička`,
    deti: (a, b) => `dítě roste – na sezonu volte ${b}`,
    prsten: (a, b) => `prsty v teple a večer otékají – u širokého prstenu (nad 6 mm) volte ${b}`,
    rukavice: (a, b) => `volte ${b}, rukavice nemají na dlani táhnout`,
    klobouk: (a, b) => `volte ${b}, volnější klobouk zúží vložená páska`,
    kolo: (a, b) => `menší rám (${a}) je obratnější, větší (${b}) klidnější na dlouhé jízdy – rozhodne zkušební jízda`
  };
  const hraniceText = (a, b, druh) => `mezi ${a} a ${b} – ${RADA[druh](a, b)}`;

  /* zařazení podle více měr: rozhoduje největší (oblečení se nemá kde roztáhnout) */
  function obleceniPodle(tab, miry, klice, popis, druh) {
    const vys = klice.map(k => ({ k, r: vyber(tab, k, miry[k]) })).filter(x => x.r);
    if (!vys.length) return null;
    const max = vys.reduce((a, x) => (x.r.p > a.r.p ? x : a));
    const r = max.r, t = tab[r.i];
    let hranice = null;
    if (r.hranice) hranice = hraniceText(popis(tab[r.hranice[0]]), popis(tab[r.hranice[1]]), druh);
    const ruzne = vys.length > 1 && Math.max(...vys.map(x => x.r.i)) - Math.min(...vys.map(x => x.r.i)) >= 2;
    return { i: r.i, radek: t, velikost: popis(t), mimo: r.mimo, hranice, rozdil: ruzne ? 'míry spadají do různých velikostí – vybírá se podle největší, ostatní upraví krejčí' : null, podle: MIRA[max.k].nazev.toLowerCase() };
  }
  const popisDam = t => `EU ${t.de} (${t.mez})`;
  function obleceni(miry, druh) {
    const tab = druh === 'muz' ? PANSKE : DAMSKE;
    return {
      tab,
      vrsek: obleceniPodle(tab, miry, ['hrudnik'], popisDam, 'obleceni'),
      kalhoty: obleceniPodle(tab, miry, ['pas', 'boky'], popisDam, 'obleceni'),
      saty: druh === 'muz' ? null : obleceniPodle(tab, miry, ['hrudnik', 'pas', 'boky'], popisDam, 'obleceni')
    };
  }
  /* límec: obvod krku + 1 cm na prst */
  function kosile(krk) {
    if (krk == null) return null;
    const r = vyber(KOSILE, 'cm', krk + 1), t = KOSILE[r.i];
    return { i: r.i, radek: t, velikost: `${t.cm} (${fmt(t.palce, 1)}″, ${t.mez})`, mimo: r.mimo, hranice: r.hranice ? hraniceText(String(KOSILE[r.hranice[0]].cm), String(KOSILE[r.hranice[1]].cm), 'kosile') : null };
  }
  function jeans(pas, rozkrok) {
    if (pas == null && rozkrok == null) return null;
    const o = {};
    if (pas != null) { const r = vyber(JEANS_W, 'pas', pas); o.iW = r.i; o.w = JEANS_W[r.i].w; o.mimoW = r.mimo; if (r.hranice) o.hranice = hraniceText('W' + JEANS_W[r.hranice[0]].w, 'W' + JEANS_W[r.hranice[1]].w, 'kalhoty'); }
    if (rozkrok != null) { const r = vyber(JEANS_L, 'rozkrok', rozkrok); o.iL = r.i; o.l = JEANS_L[r.i].l; }
    o.velikost = (o.w ? 'W' + o.w : '') + (o.w && o.l ? '/' : '') + (o.l ? 'L' + o.l : '');
    return o;
  }

  /* ---------- boty (vzorce z Barefoot vložek) ----------
     vnitřní délka boty = chodidlo + přídavek (výchozí 12 mm), kopyto = vnitřní + 8 mm, EU = kopyto / 6,667 mm (pařížský steh),
     UK = 3 × kopyto v palcích − 25 (dětská řada − 12), US muži = UK + 1, US ženy = UK + 2, US děti ≈ UK + ½, JP = chodidlo v cm. */
  function boty(chodidlo, pridavek) {
    if (chodidlo == null) return null;
    pridavek = pridavek == null ? 12 : pridavek;
    const v = BF.velikosti(chodidlo, chodidlo + pridavek);
    const euPresne = (chodidlo + pridavek + BF.NAVYSENI_KOPYTA) / 6.667;
    const f = euPresne - Math.floor(euPresne);
    return Object.assign({}, v, {
      euPresne, jp: zaokr(chodidlo / 10, 0.5), usDeti: v.detske ? v.uk + 0.5 : null, usY: v.detske ? null : v.uk + 0.5,
      hranice: f > 0.3 && f < 0.7 ? hraniceText('EU ' + Math.floor(euPresne), 'EU ' + (Math.floor(euPresne) + 1), 'boty') + ' (kde se vyrábějí půlčísla, sedne EU ' + pul(v.eu) + ')' : null
    });
  }
  function botyZEu(eu, pridavek) { pridavek = pridavek == null ? 12 : pridavek; return boty(BF.delkaZEu(eu, pridavek), pridavek); }
  function tabulkaBot(od, doEu, pridavek) {
    const r = [];
    for (let eu = od; eu <= doEu; eu++) { const b = botyZEu(eu, pridavek); r.push(Object.assign({ euRad: eu }, b)); }
    return r;
  }

  /* ---------- dětské oblečení: EU velikost = výška dítěte v cm ---------- */
  const DETSKE = [
    [50, 'novorozenec'], [56, '0–1 měsíc'], [62, '2–3 měsíce'], [68, '4–6 měsíců'], [74, '6–9 měsíců'], [80, '9–12 měsíců'],
    [86, '12–18 měsíců'], [92, '1½–2 roky'], [98, '2–3 roky'], [104, '3–4 roky'], [110, '4–5 let'], [116, '5–6 let'],
    [122, '6–7 let'], [128, '7–8 let'], [134, '8–9 let'], [140, '9–10 let'], [146, '10–11 let'], [152, '11–12 let'],
    [158, '12–13 let'], [164, '13–14 let'], [170, '14–15 let'], [176, '15–16 let']
  ].map(([cm, vek]) => ({ cm, vek }));
  /* nejmenší velikost, která výšku pokryje; když dítě skoro dorostlo do horní hranice, radit větší */
  function detske(vyska) {
    if (vyska == null) return null;
    let i = DETSKE.findIndex(t => t.cm >= vyska - 0.5);
    const mimo = i < 0 ? 'nad' : null;
    if (i < 0) i = DETSKE.length - 1;
    const t = DETSKE[i], dalsi = DETSKE[i + 1];
    const hranice = !mimo && dalsi && t.cm - vyska <= 2 ? hraniceText(String(t.cm), String(dalsi.cm), 'deti') : null;
    return { i, radek: t, velikost: String(t.cm), vek: t.vek, mimo, hranice };
  }

  /* ---------- prsteny ----------
     US: vnitřní průměr = 11,63 + 0,8128 × US (mm). EU = vnitřní obvod v mm. UK písmeno = 2 × US − ½ (A = 0, N½ = US 7).
     JP ≈ (obvod − 39,7) / 1,047 (krok ⅓ mm průměru). Řádky po půl velikosti US. */
  const PISMENA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function ukPismeno(idx) {
    if (idx < 0) return '–';
    const c = Math.floor(idx + 1e-9), h = idx - c > 0.25;
    return c >= PISMENA.length ? 'Z+' + (c - PISMENA.length + 1) + (h ? '½' : '') : PISMENA[c] + (h ? '½' : '');
  }
  const PRSTENY = [];
  for (let us = 3; us <= 13.01; us += 0.5) {
    const prumer = 11.63 + 0.8128 * us, obvod = Math.PI * prumer;
    PRSTENY.push({ us, prumer, obvod, eu: Math.round(obvod), uk: ukPismeno(2 * us - 0.5), jp: Math.max(1, Math.round((obvod - 39.7) / 1.047)) });
  }
  function prsten(obvod) {
    if (obvod == null) return null;
    const r = vyber(PRSTENY, 'obvod', obvod), t = PRSTENY[r.i];
    const pop = x => `US ${pul(x.us)} / EU ${x.eu}`;
    return { i: r.i, radek: t, velikost: `EU ${Math.round(obvod)} · US ${pul(t.us)} · UK ${t.uk}`, eu: Math.round(obvod), prumer: obvod / Math.PI, mimo: r.mimo,
      hranice: r.hranice ? hraniceText(pop(PRSTENY[r.hranice[0]]), pop(PRSTENY[r.hranice[1]]), 'prsten') : null };
  }

  /* ---------- rukavice: velikost = obvod dlaně v palcích ---------- */
  const RUKAVICE = [];
  for (let v = 6; v <= 11.01; v += 0.5) RUKAVICE.push({ vel: v, cm: v * 2.54, mez: v < 7 ? 'XS' : v < 8 ? 'S' : v < 9 ? 'M' : v < 10 ? 'L' : v < 11 ? 'XL' : 'XXL' });
  function rukavice(dlan) {
    if (dlan == null) return null;
    const r = vyber(RUKAVICE, 'cm', dlan), t = RUKAVICE[r.i];
    const pop = x => `${pul(x.vel)} (${x.mez})`;
    return { i: r.i, radek: t, velikost: pop(t), mimo: r.mimo, hranice: r.hranice ? hraniceText(pop(RUKAVICE[r.hranice[0]]), pop(RUKAVICE[r.hranice[1]]), 'rukavice') : null };
  }

  /* ---------- klobouky a čepice: EU = obvod hlavy v cm, US = průměr v palcích po ⅛, UK = US − ⅛ ---------- */
  const OSMINY = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
  function palceOsminy(x) { const o = Math.round(x * 8), c = Math.floor(o / 8), z = o % 8; return (c ? c : '') + (z ? (c ? ' ' : '') + OSMINY[z] : ''); }
  const KLOBOUKY = [];
  for (let cm = 48; cm <= 64; cm++) {
    const us = Math.round(cm / 2.54 / Math.PI * 8) / 8;
    KLOBOUKY.push({ cm, us, usTxt: palceOsminy(us), ukTxt: palceOsminy(us - 0.125),
      mez: cm <= 50 ? 'dětská' : cm <= 52 ? 'XXS' : cm <= 54 ? 'XS' : cm <= 56 ? 'S' : cm <= 58 ? 'M' : cm <= 60 ? 'L' : cm <= 62 ? 'XL' : 'XXL' });
  }
  function klobouk(hlava) {
    if (hlava == null) return null;
    const r = vyber(KLOBOUKY, 'cm', hlava), t = KLOBOUKY[r.i];
    const pop = x => `${x.cm} (${x.mez})`;
    return { i: r.i, radek: t, velikost: `${t.cm} · ${t.mez} · US ${t.usTxt}`, mimo: r.mimo, hranice: r.hranice ? hraniceText(pop(KLOBOUKY[r.hranice[0]]), pop(KLOBOUKY[r.hranice[1]]), 'klobouk') : null };
  }

  /* ---------- podprsenky ----------
     Obvod EU = obvod pod prsy zaokrouhlený na 5 cm, FR = EU + 15, UK/US = palce (EU 70 = 32).
     Košíček podle rozdílu přes prsa − pod prsy: AA ≈ 11 cm, A ≈ 13 cm, každý další + 2 cm. */
  const KOSICKY = [
    ['AA', 'AA', 'AA'], ['A', 'A', 'A'], ['B', 'B', 'B'], ['C', 'C', 'C'], ['D', 'D', 'D'], ['E', 'DD', 'DD/E'], ['F', 'E', 'DDD/F'],
    ['G', 'F', 'G'], ['H', 'FF', 'H'], ['I', 'G', 'I'], ['J', 'GG', 'J'], ['K', 'H', 'K']
  ].map(([eu, uk, us], i) => ({ eu, uk, us, rozdil: 11 + 2 * i }));
  const OBVODY = []; for (let eu = 60; eu <= 120; eu += 5) OBVODY.push({ eu, fr: eu + 15, uk: Math.round(eu * 0.4 + 4), od: eu - 2.5, do: eu + 2.5 });
  function podprsenka(podprsi, prsa) {
    if (podprsi == null) return null;
    const r = vyber(OBVODY, 'eu', podprsi), o = OBVODY[r.i];
    const out = { i: r.i, obvod: o, mimo: r.mimo, hranice: null };
    if (prsa != null && prsa > podprsi) {
      const k = vyber(KOSICKY, 'rozdil', prsa - podprsi);
      out.k = k.i; out.kosicek = KOSICKY[k.i];
      out.velikost = `EU ${o.eu}${out.kosicek.eu} · FR ${o.fr}${out.kosicek.eu} · UK ${o.uk}${out.kosicek.uk} · US ${o.uk}${out.kosicek.us}`;
      const rady = [];
      if (r.hranice) {
        const vetsi = OBVODY[r.hranice[1]], mensi = OBVODY[r.hranice[0]], kSes = KOSICKY[Math.max(0, k.i - 1)], kSes2 = KOSICKY[Math.min(KOSICKY.length - 1, k.i + 1)];
        rady.push(`obvod mezi ${mensi.eu} a ${vetsi.eu} – zkuste i sesterské velikosti ${vetsi.eu}${kSes.eu} (volnější obvod) a ${mensi.eu}${kSes2.eu} (pevnější); objem košíčku zůstává stejný`);
      }
      if (k.hranice) rady.push(`košíček mezi ${KOSICKY[k.hranice[0]].eu} a ${KOSICKY[k.hranice[1]].eu} – když se prsa nevejdou nebo vrchem přetékají, volte ${KOSICKY[k.hranice[1]].eu}`);
      out.hranice = rady.join('; ') || null;
    } else out.velikost = `obvod EU ${o.eu} · UK ${o.uk} (košíček chybí obvod přes prsa)`;
    return out;
  }

  /* ---------- rámy kol ----------
     výška rámu = vnitřní délka nohy × koeficient: silniční 0,665 (cm), trekking/město 0,66 (cm), horské 0,226 (palce = 0,574 cm).
     Bez vnitřní délky nohy odhad 0,47 × výška. Písmenná velikost podle výšky postavy. */
  const KOLA = [
    { id: 'silnicni', nazev: '🚴 Silniční / gravel', k: 0.665, palce: false },
    { id: 'trekking', nazev: '🚲 Trekking / městské', k: 0.66, palce: false },
    { id: 'horske', nazev: '🚵 Horské (MTB)', k: 0.574, palce: true }
  ];
  const KOLA_VYSKA = [
    { od: 150, do: 160, mez: 'XS', silnicni: '47–50', horske: '13–14″' }, { od: 160, do: 170, mez: 'S', silnicni: '50–53', horske: '15–16″' },
    { od: 170, do: 180, mez: 'M', silnicni: '53–56', horske: '17–18″' }, { od: 180, do: 190, mez: 'L', silnicni: '56–59', horske: '19–20″' },
    { od: 190, do: 200, mez: 'XL', silnicni: '59–62', horske: '21–22″' }
  ];
  function kolo(vyska, rozkrok) {
    if (vyska == null && rozkrok == null) return null;
    const odhad = rozkrok == null;
    const noha = odhad ? vyska * 0.47 : rozkrok;
    const ramy = KOLA.map(t => { const cm = noha * t.k; return { id: t.id, nazev: t.nazev, cm, palce: cm / 2.54, txt: t.palce ? `${fmt(cm / 2.54, 0)}″ (${fmt(cm)} cm)` : `${fmt(cm)} cm (${fmt(cm / 2.54, 0)}″)` }; });
    let i = null, hranice = null, mimo = null;
    if (vyska != null) {
      i = KOLA_VYSKA.findIndex(t => vyska >= t.od && vyska < t.do);
      if (i < 0) { mimo = vyska < 150 ? 'pod' : 'nad'; i = vyska < 150 ? 0 : KOLA_VYSKA.length - 1; }
      const t = KOLA_VYSKA[i];
      if (!mimo && vyska - t.od < 2 && i > 0) hranice = hraniceText(KOLA_VYSKA[i - 1].mez, t.mez, 'kolo');
      else if (!mimo && t.do - vyska <= 2 && i < KOLA_VYSKA.length - 1) hranice = hraniceText(t.mez, KOLA_VYSKA[i + 1].mez, 'kolo');
    }
    return { i, mez: i != null ? KOLA_VYSKA[i].mez : null, ramy, odhad, mimo, hranice,
      velikost: (i != null ? KOLA_VYSKA[i].mez + ' · ' : '') + `silniční ${ramy[0].txt}, MTB ${ramy[2].txt}` };
  }

  /* ---------- souhrnné doporučení pro profil ---------- */
  const KATEGORIE = [
    { id: 'obleceni', nazev: '👕 Oblečení', miry: ['hrudnik', 'pas', 'boky', 'krk', 'rozkrok'] },
    { id: 'boty', nazev: '👟 Boty', miry: ['chodidlo'] },
    { id: 'deti', nazev: '👶 Dětské', miry: ['vyska', 'chodidlo'] },
    { id: 'prsteny', nazev: '💍 Prsteny', miry: ['prst'] },
    { id: 'rukavice', nazev: '🧤 Rukavice', miry: ['dlan'] },
    { id: 'klobouky', nazev: '🎩 Klobouky a čepice', miry: ['hlava'] },
    { id: 'podprsenky', nazev: '👙 Podprsenky', miry: ['podprsi', 'hrudnik'] },
    { id: 'kola', nazev: '🚲 Rámy kol', miry: ['vyska', 'rozkrok'] }
  ];
  const mimoText = m => m === 'pod' ? 'menší než tabulka – hledejte v menší řadě (dětská / petite)' : m === 'nad' ? 'větší než tabulka – hledejte nadměrné velikosti' : null;

  function doporuc(profil, pridavek) {
    const m = profil.miry || {}, druh = profil.druh, out = [];
    const pridej = (kat, co, x, detail) => { if (x) out.push({ kat, co, velikost: x.velikost, detail: detail || '', hranice: x.hranice || null, upozorneni: mimoText(x.mimo) || x.rozdil || null }); };
    if (druh === 'dite') {
      pridej('deti', 'Oblečení (výška)', detske(m.vyska), detske(m.vyska) ? 'věk orientačně ' + detske(m.vyska).vek : '');
    } else {
      const o = obleceni(m, druh);
      pridej('obleceni', 'Trička, svetry, saka', o.vrsek, o.vrsek ? `EU/DE ${o.vrsek.radek.de} · FR ${o.vrsek.radek.fr} · IT ${o.vrsek.radek.it} · UK ${o.vrsek.radek.uk} · US ${o.vrsek.radek.us}` : '');
      pridej('obleceni', 'Kalhoty, sukně', o.kalhoty, o.kalhoty ? `podle: ${o.kalhoty.podle}` : '');
      if (o.saty) pridej('obleceni', 'Šaty', o.saty, `podle: ${o.saty.podle}`);
      if (druh === 'muz') pridej('obleceni', 'Košile (límec)', kosile(m.krk));
      const j = jeans(m.pas, m.rozkrok); if (j) pridej('obleceni', 'Džíny', j, 'W = pas v palcích, L = vnitřní délka nohy v palcích');
    }
    const b = boty(m.chodidlo, pridavek);
    if (b) {
      const us = druh === 'dite' ? (b.detske ? `US děti ${pul(b.usDeti)}` : `US mládež ${pul(b.usY)}`) : druh === 'muz' ? `US muži ${pul(b.usM)}` : `US ženy ${pul(b.usW)}`;
      out.push({ kat: druh === 'dite' ? 'deti' : 'boty', co: 'Boty', velikost: `EU ${pul(b.eu)} · UK ${pul(b.uk)}${b.detske ? ' (dětská)' : ''} · ${us}`, detail: `Mondopoint ${b.mondopoint} · JP ${fmt(b.jp, 1)} · vnitřní délka boty ≥ ${b.vnitrni} mm`, hranice: b.hranice, upozorneni: null });
    }
    pridej('prsteny', 'Prsten', prsten(m.prst), prsten(m.prst) ? `vnitřní průměr ${fmt(prsten(m.prst).prumer, 1)} mm · JP ${prsten(m.prst).radek.jp}` : '');
    pridej('rukavice', 'Rukavice', rukavice(m.dlan));
    pridej('klobouky', 'Klobouk, čepice', klobouk(m.hlava), klobouk(m.hlava) ? `UK ${klobouk(m.hlava).radek.ukTxt}` : '');
    if (druh !== 'muz') pridej('podprsenky', 'Podprsenka', podprsenka(m.podprsi, m.hrudnik));
    const k = kolo(m.vyska, m.rozkrok);
    if (k) pridej('kola', 'Rám kola', k, `trekking ${k.ramy[1].txt}${k.odhad ? ' · vnitřní délka nohy odhadnuta z výšky – změřte ji' : ''}`);
    return out;
  }

  /* ---------- měřítko prstenů k tisku 1:1 ----------
     SVG v mm. `jednotka` = 'mm' pro tisk (rozměry width/height v mm), nebo číslo px na mm pro obrazovku (kalibrace kartou).
     Obsahuje: kontrolní obdélník kreditní karty 85,6 × 53,98 mm, pásek k vystřižení se stupnicí obvodu (EU) a značkami US,
     kroužky vnitřních průměrů k přiložení prstenu. */
  const KARTA = { w: 85.6, h: 53.98 };
  function svgMeritko(jednotka) {
    const W = 190, H = 160;
    const rozm = jednotka === 'mm' ? `width="${W}mm" height="${H}mm"` : `width="${Math.round(W * jednotka)}" height="${Math.round(H * jednotka)}"`;
    const c = [];
    c.push(`<rect x="2" y="2" width="${KARTA.w}" height="${KARTA.h}" rx="3" fill="none" stroke="currentColor" stroke-width="0.3"/>`);
    c.push(`<text x="${2 + KARTA.w / 2}" y="${2 + KARTA.h / 2 - 2}" font-size="4" text-anchor="middle" fill="currentColor">Kontrola: sem přesně padne</text>`);
    c.push(`<text x="${2 + KARTA.w / 2}" y="${2 + KARTA.h / 2 + 4}" font-size="4" text-anchor="middle" fill="currentColor">platební karta 85,6 × 54 mm</text>`);
    /* kroužky US 4–12 */
    let x = 96, y = 10;
    for (const t of PRSTENY.filter(t => t.us >= 4 && t.us <= 12 && t.us % 1 === 0)) {
      const r = t.prumer / 2;
      if (x + 2 * r > W - 2) { x = 96; y += 30; }
      c.push(`<circle cx="${(x + r).toFixed(2)}" cy="${(y + 11).toFixed(2)}" r="${r.toFixed(3)}" fill="none" stroke="currentColor" stroke-width="0.25"/>`);
      c.push(`<text x="${(x + r).toFixed(2)}" y="${(y + 11 + 1.2).toFixed(2)}" font-size="2.8" text-anchor="middle" fill="currentColor">US ${t.us}</text>`);
      c.push(`<text x="${(x + r).toFixed(2)}" y="${(y + 25.5).toFixed(2)}" font-size="2.4" text-anchor="middle" fill="currentColor">EU ${t.eu} · ${fmt(t.prumer, 1)}</text>`);
      x += 2 * r + 4;
    }
    /* pásek: 0–80 mm, značky obvodu, štěrbina na začátku */
    const py = 108, ph = 14, x0 = 14, L = 85;
    c.push(`<rect x="4" y="${py}" width="${x0 + L + 6 - 4}" height="${ph}" fill="none" stroke="currentColor" stroke-width="0.3" stroke-dasharray="1.5 1"/>`);
    c.push(`<line x1="${x0 - 4}" y1="${py + 4}" x2="${x0 - 4}" y2="${py + ph - 4}" stroke="currentColor" stroke-width="0.6"/>`);
    c.push(`<text x="${x0 - 6}" y="${py - 1.5}" font-size="2.6" fill="currentColor">prořízněte štěrbinu</text>`);
    for (let mm = 0; mm <= 80; mm++) {
      const xx = x0 + mm, dl = mm % 10 === 0 ? 5 : mm % 5 === 0 ? 3.5 : 2;
      c.push(`<line x1="${xx}" y1="${py}" x2="${xx}" y2="${py + dl}" stroke="currentColor" stroke-width="0.15"/>`);
      if (mm >= 44 && mm <= 72 && mm % 4 === 0) c.push(`<text x="${xx}" y="${py + 8.5}" font-size="2.3" text-anchor="middle" fill="currentColor">${mm}</text>`);
      else if (mm % 10 === 0 && mm < 42) c.push(`<text x="${xx}" y="${py + 8.5}" font-size="2.3" text-anchor="middle" fill="currentColor">${mm}</text>`);
    }
    for (const t of PRSTENY.filter(t => t.obvod <= 80 && t.us % 1 === 0)) {
      const xx = (x0 + t.obvod).toFixed(2);
      c.push(`<line x1="${xx}" y1="${py + ph}" x2="${xx}" y2="${py + ph - 3}" stroke="currentColor" stroke-width="0.25"/>`);
      c.push(`<text x="${xx}" y="${py + ph - 3.6}" font-size="1.9" text-anchor="middle" fill="currentColor">${t.us}</text>`);
    }
    c.push(`<text x="${x0 + L + 4}" y="${py + ph / 2 + 1}" font-size="2.6" fill="currentColor">→ prostrčit</text>`);
    c.push(`<text x="4" y="${py + ph + 6}" font-size="3" fill="currentColor">Nahoře obvod v mm = velikost EU, dole velikosti US. Pásek omotejte kolem prstu, prostrčte štěrbinou a čtěte u hrany štěrbiny.</text>`);
    /* pravítko 100 mm pro kontrolu tisku */
    const ry = 138;
    c.push(`<line x1="4" y1="${ry}" x2="104" y2="${ry}" stroke="currentColor" stroke-width="0.3"/>`);
    for (let mm = 0; mm <= 100; mm += 1) c.push(`<line x1="${4 + mm}" y1="${ry}" x2="${4 + mm}" y2="${ry + (mm % 10 ? (mm % 5 ? 1.5 : 2.5) : 4)}" stroke="currentColor" stroke-width="0.15"/>`);
    c.push(`<text x="4" y="${ry + 8}" font-size="3" fill="currentColor">Kontrolní pravítko 100 mm – tiskněte v měřítku 100 % (bez „přizpůsobit stránce“).</text>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="0 0 ${W} ${H}" font-family="sans-serif">${c.join('')}</svg>`;
  }

  const API = {
    VERZE, KLIC, STAV, MIRY, MIRA, DRUHY, KATEGORIE, fmt, pul, prazdna, normProfil, migruj, vyber,
    DAMSKE, PANSKE, KOSILE, JEANS_W, JEANS_L, DETSKE, PRSTENY, RUKAVICE, KLOBOUKY, KOSICKY, OBVODY, KOLA, KOLA_VYSKA, KARTA,
    obleceni, kosile, jeans, boty, botyZEu, tabulkaBot, detske, prsten, ukPismeno, rukavice, klobouk, palceOsminy, podprsenka, kolo, doporuc, svgMeritko
  };
  if (typeof module !== 'undefined') module.exports = API; else window.VelikostiJadro = API;
})();
