/* ============================================================
   Srdce hory – obdobi.js: roční období, sláva, karavany, migranti.

   Rok = 4 období po 12 dnech. Zima: pole neroste (nezasetá zůstanou,
   co na poli bylo, spálí mráz), potok zamrzne, stromy nedorůstají.
   Sláva klanu roste s objevy, hloubkou, dílnami, sochami a cennostmi;
   láká lepší karavany a víc nových trpaslíků.
   Karavana přijede 8. den jara a 6. den podzimu a zůstane 2 dny.
   Obchod je výměnný: hodnota prodaného musí pokrýt hodnotu koupeného.
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W } = T.hora;
  const P = T.prace, S = T.stavby, C = T.cesty;

  const DNI_OBDOBI = 12, DNI_ROKU = 48;
  const OBDOBI = [
    { nazev: 'jaro', ikona: '🌸', rust: 3 },
    { nazev: 'léto', ikona: '☀️', rust: 4 },
    { nazev: 'podzim', ikona: '🍂', rust: 2 },
    { nazev: 'zima', ikona: '❄️', rust: 0 },
  ];
  const DNY_KARAVANY = [8, 30];                   // den v roce (1–48)
  const POBYT_KARAVANY = 2;                       // dní

  const den = hra => T.hra.den(hra);
  const denRoku = hra => (den(hra) - 1) % DNI_ROKU + 1;
  const obdobi = hra => Math.floor((denRoku(hra) - 1) / DNI_OBDOBI);
  const rok = hra => Math.floor((den(hra) - 1) / DNI_ROKU) + 1;
  const zima = hra => obdobi(hra) === 3;

  // hodnota věcí při obchodu (základ); nábytek z kamene má hodnotu vyšší
  const HODNOTA = {
    kamen: 1, jil: 1, uhli: 2, zelezo: 4, med: 3, stribro: 8, zlato: 12, drahokam: 15, hvezdna: 40,
    drevo: 2, jidlo: 2, pivo: 2, houby: 1, jecmen: 1,
    postel: 6, stul: 5, zidle: 4, socha: 25,
    prut_zelezo: 9, prut_med: 7, prut_stribro: 20, prut_zlato: 28,
    krumpac: 16, sekera: 14, kladivo: 14, brus: 45, sperk: 110, pohar: 60,
    valecna_sekera: 30, zbroj: 45, hedvabi: 8, cepel: 6, prut_hvezdny: 80,
  };
  const CENNOSTI = ['brus', 'sperk', 'pohar', 'socha'];
  function hodnotaVeci(v) {
    let h = HODNOTA[v.druh] || 1;
    if ((v.druh === 'stul' || v.druh === 'zidle') && v.mat === 'kamen') h = Math.round(h * 1.5);
    if ((v.druh === 'krumpac' || v.druh === 'kladivo') && v.mat === 'med') h = Math.round(h * 0.7);
    return h;
  }
  // karavana prodává dráž, než kupuje; sláva zlepší ceny
  const cenaNakup = druh => Math.ceil((HODNOTA[druh] || 1) * 1.5);
  function cenaProdej(hra, v) {
    const bonus = 1 + Math.min(0.5, (hra.slava || 0) / 200);
    return Math.max(1, Math.floor(hodnotaVeci(v) * (CENNOSTI.includes(v.druh) ? 1.2 : 1) * bonus));
  }

  function spocitejSlavu(hra) {
    let s = 0;
    s += Object.keys(hra.objeveno).length * 5;
    s += Math.floor(hra.vykopano / 40);
    s += Math.floor(hra.nejhloubeji / 3);
    s += hra.dilny.length * 3;
    s += hra.trpaslici.length * 2;
    for (let i = 0; i < hra.stavba.length; i++) if (hra.stavba[i] === S.K.SOCHA) s += 8;
    for (const v of hra.veci) if (CENNOSTI.includes(v.druh) && S.jeSklad(hra, v.i)) s += Math.round(hodnotaVeci(v) / 10);
    return s + (hra.slavaBonus || 0);
  }

  // věci ve skladech, které se dají prodat (ne nesené, ne rezervované)
  function naProdej(hra) {
    const m = {};
    for (const v of hra.veci) if (!v.nese && !v.rez && v.druh !== 'klic' && S.jeSklad(hra, v.i)) (m[v.druh] = m[v.druh] || []).push(v);
    return m;
  }
  // místo před bránou, kam karavana skládá zboží (a odkud přicházejí noví trpaslíci)
  // místo před bránou, kam se skládá zboží a dary (nejbližší volné stojné pole, kdyby tam hráč něco postavil)
  function uBrany(hra) {
    const b = hra.hora.brana;
    for (let d = 2; d < 24; d++) for (const x of [b.x - d, b.x + d]) {
      if (x < 0 || x >= W) continue;
      for (let y = b.y; y >= b.y - 4; y--) { const i = y * W + x; if (C.volne(hra, i) && C.stojne(hra, i)) return i; }
    }
    return b.y * W + b.x - 2;
  }
  // nejlevější pole údolí, ze kterého se dá dojít k bráně (potok se brodí)
  function naOkraji(hra) {
    const start = uBrany(hra), videno = new Set([start]), fronta = [start];
    let nej = start;
    for (let h = 0; h < fronta.length && h < 3000; h++) {
      const i = fronta[h];
      if (hra.hora.pozadi[i] === T.hora.M.VZDUCH && i % W < nej % W) nej = i;
      C.sousede(hra, i, j => { if (!videno.has(j)) { videno.add(j); fronta.push(j); } });
    }
    return nej;
  }

  function novaKaravana(hra) {
    const R = () => P.nahoda(hra), sl = hra.slava || 0;
    const n = (a, b) => a + Math.floor(R() * (b - a + 1));
    const nabidka = { jidlo: n(10, 20), pivo: n(10, 20), drevo: n(8, 16), uhli: n(4, 12), jecmen: n(4, 10) };
    nabidka.prut_zelezo = n(0, 2 + Math.floor(sl / 25));
    if (sl >= 20) nabidka.krumpac = n(0, 2);
    if (sl >= 30) { nabidka.sekera = n(0, 1); nabidka.kladivo = n(0, 1); }
    if (sl >= 60) nabidka.prut_stribro = n(0, 2);
    for (const k of Object.keys(nabidka)) if (!nabidka[k]) delete nabidka[k];
    return { od: hra.tik, do: hra.tik + POBYT_KARAVANY * T.hra.TAHU_ZA_DEN, nabidka, obchodu: 0 };
  }

  // obchod: nakup/prodej = { druh: počet }; vrací { ok, zprava }
  function obchod(hra, nakup, prodej) {
    const k = hra.karavana;
    if (!k) return { ok: false, zprava: 'Karavana tu není.' };
    const sklad = naProdej(hra);
    let dam = 0, chci = 0;
    for (const [druh, n] of Object.entries(prodej)) {
      if (n <= 0) continue;
      const vv = sklad[druh] || [];
      if (vv.length < n) return { ok: false, zprava: `Ve skladu není dost: ${P.VECI[druh].nazev}.` };
      vv.sort((a, b) => cenaProdej(hra, b) - cenaProdej(hra, a));
      for (let j = 0; j < n; j++) dam += cenaProdej(hra, vv[j]);
    }
    for (const [druh, n] of Object.entries(nakup)) {
      if (n <= 0) continue;
      if ((k.nabidka[druh] || 0) < n) return { ok: false, zprava: `Karavana nemá dost: ${P.VECI[druh].nazev}.` };
      chci += cenaNakup(druh) * n;
    }
    if (dam < chci) return { ok: false, zprava: `Karavana chce za zboží ${chci}, nabízíš jen ${dam}.` };
    if (!chci && !dam) return { ok: false, zprava: 'Nic jsi nevybral.' };
    const prodano = [], koupeno = [];
    for (const [druh, n] of Object.entries(prodej)) {
      if (n <= 0) continue;
      const vv = sklad[druh];
      for (let j = 0; j < n; j++) hra.veci.splice(hra.veci.indexOf(vv[j]), 1);
      prodano.push(`${n}× ${P.VECI[druh].nazev}`);
    }
    const kam = uBrany(hra);
    for (const [druh, n] of Object.entries(nakup)) {
      if (n <= 0) continue;
      const mat = druh === 'drevo' ? 'drevo' : ['krumpac', 'sekera', 'kladivo'].includes(druh) ? 'zelezo' : 0;
      for (let j = 0; j < n; j++) P.novaVec(hra, druh, kam, mat);
      k.nabidka[druh] -= n;
      if (!k.nabidka[druh]) delete k.nabidka[druh];
      koupeno.push(`${n}× ${P.VECI[druh].nazev}`);
    }
    P.usadVeci(hra);
    k.obchodu++;
    T.hra.zprava(hra, 'nalez', `Obchod s karavanou: ${prodano.join(', ') || 'nic'} za ${koupeno.join(', ') || 'nic'}.`);
    return { ok: true, zprava: 'Obchod uzavřen.', dam, chci };
  }

  // noví trpaslíci: skupina podle slávy (1–5), přednost mají chybějící řemesla
  function skupinaMigrantu(hra) {
    const n = Math.max(1, Math.min(5, 1 + Math.floor((hra.slava || 0) / 30)));
    const volne = 40 - hra.trpaslici.length;
    const pocet = Math.min(n, volne);
    const ma = new Set(hra.trpaslici.map(t => t.prof));
    const chybi = Object.keys(T.hra.PROFESE).filter(p => !ma.has(p));
    const lide = [];
    for (let k = 0; k < pocet; k++) {
      const prof = chybi.length && P.nahoda(hra) < 0.6 ? chybi.splice(Math.floor(P.nahoda(hra) * chybi.length), 1)[0]
        : T.hra.nahodnaProfese(hra);
      lide.push({ jmeno: T.hra.noveJmeno(hra, lide.map(l => l.jmeno)), prof });
    }
    return lide;
  }
  function prijmi(hra, lide) {
    const kde = naOkraji(hra);
    for (const l of lide) T.hra.pridejTrpaslika(hra, l.jmeno, l.prof, kde);
  }

  // jednou za den (na začátku dne)
  function novyDen(hra) {
    hra.slava = spocitejSlavu(hra);
    const d = denRoku(hra), o = obdobi(hra);
    if (den(hra) > 1 && (d - 1) % DNI_OBDOBI === 0) {
      const texty = ['Jaro! Sníh taje a údolí se zelená.', 'Léto. Ječmen roste nejrychleji.',
        'Podzim. Listí žloutne, na poli je třeba sklidit před zimou.', 'Přišla zima! Pole zamrzla, potok je pod ledem.'];
      T.hra.zprava(hra, 'pribeh', texty[o]);
      for (const t of hra.trpaslici) t.zachvaty = 0;
      if (o === 3) {                                // mráz spálí, co na poli zůstalo
        let spaleno = 0;
        for (let i = 0; i < hra.uroda.length; i++) {
          if (!hra.uroda[i]) continue;
          const z = S.zonaNa(hra, i);
          if (z && z.typ === 'pole') { hra.uroda[i] = 0; spaleno++; }
        }
        if (spaleno) T.hra.zprava(hra, 'uvizl', `Mráz spálil úrodu na ${spaleno} polích.`);
      } else if (!hra.udalost && hra.trpaslici.length < 40 && hra.trpaslici.length > 0) {
        const lide = skupinaMigrantu(hra);
        if (lide.length) T.udalosti.zacni(hra, 'migranti', { lide });
      }
    }
    if (DNY_KARAVANY.includes(d) && !hra.karavana && hra.trpaslici.length) {
      hra.karavana = novaKaravana(hra);
      T.hra.zvuk(hra, 'zvonek');
      T.hra.zprava(hra, 'objev', '🐫 Do údolí dorazila karavana! Zůstane dva dny – klepni na ni nebo na 🐫 v liště a obchoduj.');
    }
  }
  function tik(hra) {
    if (hra.tik % T.hra.TAHU_ZA_DEN === 0) novyDen(hra);
    if (hra.karavana && hra.tik >= hra.karavana.do) {
      T.hra.zprava(hra, 'pribeh', hra.karavana.obchodu ? 'Karavana odjela. Vrátí se za půl roku.' : 'Karavana odjela bez obchodu.');
      hra.karavana = null;
    }
  }

  T.obdobi = { DNI_OBDOBI, DNI_ROKU, OBDOBI, DNY_KARAVANY, HODNOTA, CENNOSTI, den, denRoku, obdobi, rok, zima,
               hodnotaVeci, cenaNakup, cenaProdej, spocitejSlavu, naProdej, uBrany, naOkraji, novaKaravana, obchod,
               skupinaMigrantu, prijmi, novyDen, tik };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
