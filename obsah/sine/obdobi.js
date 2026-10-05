/* ============================================================
   Síně pod horou – obdobi.js: roční období, sláva, karavana
   a tržiště, migranti (převzato ze Srdce hory, místa podle mapy).

   Rok = 4 období po 12 dnech. Zima: pole neroste a co na něm zůstalo,
   spálí mráz; potok v rokli zamrzne (dá se přejít i soutěskou – pozor
   na nájezdy!), pařezy nedorůstají, venku se mrzne (−3) a jí se 1,2×
   víc. Na podzim se zbarví tráva, v zimě napadne sníh (kreslení).
   Sláva roste s objevy, hloubkou, dílnami, sochami, cennostmi ve
   skladech a nádhernými místnostmi; milníky 120/200/250/330/500/650.
   Karavana přijede po cestě roklí 8. den jara a 6. den podzimu, zůstane
   2 dny a zastaví na tržišti (bez něj u Brány). Každý ⛺ stánek (nejvýš
   4) přidá jeden druh zboží a +5 % výkupu. Prodané zboží zmizí ze
   skladu hned. Migranti přicházejí na začátku období (ne v zimě) podle
   slávy, jen do volných postelí (+1).
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O, P } = SV, C = S.cesty, PR = S.prace;

  const DNI_OBDOBI = 12, DNI_ROKU = 48;
  const OBDOBI = [
    { nazev: 'jaro', ikona: '🌸', rust: 1 }, { nazev: 'léto', ikona: '☀️', rust: 1.3 },
    { nazev: 'podzim', ikona: '🍂', rust: 0.7 }, { nazev: 'zima', ikona: '❄️', rust: 0 },
  ];
  const DNY_KARAVANY = [8, 30], POBYT_KARAVANY = 2, PRIJEZD = 220;      // příjezd/odjezd po cestě (tahů)
  const MAX_STANKU = 4;

  const den = hra => Math.floor(hra.tik / S.hra.TAHU_ZA_DEN) + 1;
  const denRoku = hra => (den(hra) - 1) % DNI_ROKU + 1;
  const obdobi = hra => Math.floor((denRoku(hra) - 1) / DNI_OBDOBI);
  const rok = hra => Math.floor((den(hra) - 1) / DNI_ROKU) + 1;
  const zima = hra => obdobi(hra) === 3;

  const HODNOTA = {
    kamen: 1, jil: 1, uhli: 2, zelezo: 4, med: 3, stribro: 8, zlato: 12, drahokam: 15, hvezdna: 40,
    drevo: 2, jidlo: 2, pivo: 2, houby: 1, jecmen: 1, ryba: 1,
    postel: 6, stul: 5, zidle: 4, lavice: 5, socha: 25, truhla: 5, sud: 5, dlazba: 1, prkna: 2, koberec: 20, mozaika: 12, platno: 9, svicen: 12,
    prut_zelezo: 9, prut_med: 7, prut_stribro: 20, prut_zlato: 28,
    krumpac: 16, sekera: 14, kladivo: 14, kuse: 26, sipy: 1, brus: 45, sperk: 110, pohar: 60,
    valecna_sekera: 30, zbroj: 45, hedvabi: 8, cepel: 6, prut_hvezdny: 90, klic: 0,
  };
  const CENNOSTI = ['brus', 'sperk', 'pohar', 'socha'];
  function hodnotaVeci(v) {
    let h = HODNOTA[v.druh] || 1;
    if ((v.druh === 'stul' || v.druh === 'zidle') && v.mat === 'kamen') h = Math.round(h * 1.5);
    if (['krumpac', 'kladivo', 'zbroj'].includes(v.druh) && v.mat === 'med') h = Math.round(h * 0.7);
    return h;
  }
  const stanku = hra => Math.min(MAX_STANKU, hra.budovy.filter(b => b.typ === 'stanek').length);
  const cenaNakup = druh => Math.ceil((HODNOTA[druh] || 1) * 1.5);
  function cenaProdej(hra, v) {
    const bonus = 1 + Math.min(0.5, (hra.slava || 0) / 200) + (hra.odemceno.slava500 ? 0.2 : 0) + 0.05 * stanku(hra);
    return Math.max(1, Math.floor(hodnotaVeci(v) * (CENNOSTI.includes(v.druh) ? 1.2 : 1) * bonus));
  }
  const HROMADNE = ['jidlo', 'pivo', 'houby', 'jecmen', 'prut_zelezo'], HROMADNE_OD = 10, HROMADNE_BONUS = 1.25;
  function prodejDruhu(hra, druh, vv, n) {
    let s = 0;
    for (let j = 0; j < n; j++) s += cenaProdej(hra, vv[j]);
    return HROMADNE.includes(druh) && n >= HROMADNE_OD ? Math.floor(s * HROMADNE_BONUS) : s;
  }

  function spocitejSlavu(hra) {
    const ST = S.stavby;
    let s = Object.keys(hra.objeveno).length * 5 + Math.floor(hra.vykopano / 40) + Math.floor((hra.nejhloubeji || 0) / 3) + hra.trpaslici.length * 2;
    for (const b of hra.budovy) { if (ST.STAVBY[b.typ].dilna) s += 3; if (b.typ === 'socha') s += 8; }
    for (const v of hra.veci) if (CENNOSTI.includes(v.druh) && v.g >= 0 && ST.prijme(hra, v.g, v.druh)) s += Math.round(hodnotaVeci(v) / 10);
    // nádherné místnosti (kvalita ≥ 12) se zónou ložnice / jídelny / ošetřovny
    const vid = new Set();
    for (const z of hra.zony) {
      if (z.typ === 'sklad' || ST.FARMY[z.typ]) continue;
      let g = hra.zona.indexOf(z.id);
      const m = g >= 0 && S.mistnosti.mistnostNa(hra, g);
      if (!m || vid.has(m.id)) continue;
      vid.add(m.id);
      if (S.mistnosti.kvalita(hra, m, z.typ).hodnota >= 12) s += 1;
    }
    return s + (hra.slavaBonus || 0);
  }

  // věci ve skladech, které se dají prodat (leží ve skladu, který je přijímá)
  function naProdej(hra) {
    const m = {};
    for (const v of hra.veci) if (v.g >= 0 && v.druh !== 'klic' && S.stavby.prijme(hra, v.g, v.druh)) (m[v.druh] = m[v.druh] || []).push(v);
    return m;
  }
  // kam karavana staví vozy a skládá zboží: tržiště, jinak rokle před Branou
  function misto(hra) {
    const sv = hra.sv;
    if (sv.trziste) {
      const t = sv.trziste, g = (t.y + 2) * sv.W + t.x + 2;
      if (C.pruchozi(sv, g)) return g;
      const r = S.hra.volnaMistaKolem(hra, g, 1); if (r.length) return r[0];
    }
    const r = S.hra.volnaMistaKolem(hra, sv.brana.y * sv.W + sv.brana.x - 3, 1);
    return r.length ? r[0] : sv.brana.y * sv.W + sv.brana.x - 3;
  }
  // jižní konec cesty (odkud se přijíždí)
  function naOkraji(hra) {
    const sv = hra.sv;
    for (let x = 0; x < sv.W; x++) { const g = (sv.H - 1) * sv.W + x; if (sv.podlaha[g] === P.CESTA && C.pruchozi(sv, g)) return g; }
    return misto(hra);
  }

  const NAVIC_STANKY = ['prut_med', 'hedvabi', 'sekera', 'drahokam'];      // co přiveze každý stánek navíc
  function novaKaravana(hra) {
    const R = () => PR.nahoda(hra), sl = hra.slava || 0, n = (a, b) => a + Math.floor(R() * (b - a + 1));
    const nabidka = { jidlo: n(10, 20), pivo: n(10, 20), drevo: n(8, 16), uhli: n(4, 12), jecmen: n(4, 10) };
    nabidka.prut_zelezo = n(0, 2 + Math.floor(sl / 25));
    if (sl >= 20) nabidka.krumpac = n(0, 2);
    if (sl >= 30) { nabidka.sekera = n(0, 1); nabidka.kladivo = n(0, 1); }
    if (sl >= 60) nabidka.prut_stribro = n(0, 2);
    if (hra.odemceno.slava120) { nabidka.valecna_sekera = n(0, 2); nabidka.zbroj = n(0, 1); nabidka.prut_zlato = n(0, 2); nabidka.drahokam = n(0, 2); }
    if (hra.odemceno.slava200) nabidka.hvezdna = n(1, 2);
    for (let k = 0; k < stanku(hra); k++) { const d = NAVIC_STANKY[k]; nabidka[d] = (nabidka[d] || 0) + n(1, 3); }
    for (const k of Object.keys(nabidka)) if (!nabidka[k]) delete nabidka[k];
    const cil = misto(hra), start = naOkraji(hra);
    const res = C.hledej(hra, [start], g => g === cil, 30000);
    return { od: hra.tik, do: hra.tik + POBYT_KARAVANY * S.hra.TAHU_ZA_DEN, nabidka, obchodu: 0, cesta: res ? [start, ...res.cesta] : [cil], cil };
  }
  // poloha vozu karavany (index do cesty) – příjezd, stání, odjezd
  function polohaKaravany(hra, posun) {
    const k = hra.karavana; if (!k) return -1;
    const n = k.cesta.length - 1, t = hra.tik - k.od;
    const f = t < PRIJEZD ? t / PRIJEZD : hra.tik > k.do - PRIJEZD ? (k.do - hra.tik) / PRIJEZD : 1;
    return k.cesta[Math.max(0, Math.min(n, Math.round(f * n) - (posun || 0)))];
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
      if (vv.length < n) return { ok: false, zprava: `Ve skladu není dost: ${PR.VECI[druh].nazev}.` };
      vv.sort((a, b) => cenaProdej(hra, b) - cenaProdej(hra, a));
      dam += prodejDruhu(hra, druh, vv, n);
    }
    for (const [druh, n] of Object.entries(nakup)) {
      if (n <= 0) continue;
      if ((k.nabidka[druh] || 0) < n) return { ok: false, zprava: `Karavana nemá dost: ${PR.VECI[druh].nazev}.` };
      chci += cenaNakup(druh) * n;
    }
    if (!chci && !dam) return { ok: false, zprava: 'Nic jsi nevybral.' };
    if (dam < chci) return { ok: false, zprava: `Karavana chce za zboží ${chci}, nabízíš jen ${dam}.` };
    const prodano = [], koupeno = [];
    for (const [druh, n] of Object.entries(prodej)) {
      if (n <= 0) continue;
      for (let j = 0; j < n; j++) { PR.odeberVec(hra, sklad[druh][j]); hra.spotrebovano++; }
      prodano.push(`${n}× ${PR.VECI[druh].nazev}`);
    }
    for (const [druh, n] of Object.entries(nakup)) {
      if (n <= 0) continue;
      const mat = ['krumpac', 'sekera', 'kladivo', 'valecna_sekera', 'zbroj'].includes(druh) ? 'zelezo' : undefined;
      for (let j = 0; j < n; j++) PR.novaVec(hra, druh, k.cil, mat);
      k.nabidka[druh] -= n; if (!k.nabidka[druh]) delete k.nabidka[druh];
      koupeno.push(`${n}× ${PR.VECI[druh].nazev}`);
    }
    k.obchodu++;
    PR.zprava(hra, 'obchod', `Obchod s karavanou: ${prodano.join(', ') || 'nic'} za ${koupeno.join(', ') || 'nic'}.`, k.cil);
    return { ok: true, zprava: 'Obchod uzavřen.', dam, chci };
  }

  // místo v klanu: strop 40 a volné postele v ložnicích (+1, kdo přespí pod stanem)
  const MAX_KLAN = 40, SLAVA_NA_MIGRANTA = 60, MAX_MIGRANTU = 4;
  function mistoVKlanu(hra) {
    const n = hra.trpaslici.length, pr = S.potreby.prostredi(hra);
    const postele = pr.posteleLoznice || 0, volnePostele = Math.max(0, postele - n);
    const zeSlavy = Math.max(1, Math.min(MAX_MIGRANTU, 1 + Math.floor((hra.slava || 0) / SLAVA_NA_MIGRANTA)));
    const volno = Math.max(0, Math.min(MAX_KLAN - n, volnePostele + 1));
    const migrantu = Math.min(zeSlavy, volno);
    return { pocet: n, max: MAX_KLAN, postele, volnePostele, zeSlavy, volno, migrantu,
             duvod: n >= MAX_KLAN ? `klan je plný (${MAX_KLAN} trpaslíků)` : migrantu < zeSlavy ? `chybí postele v ložnicích (volných ${volnePostele})` : '' };
  }
  function skupinaMigrantu(hra) {
    const pocet = mistoVKlanu(hra).migrantu, HR = S.hra;
    const ma = new Set(hra.trpaslici.map(t => t.prof));
    const chybi = Object.keys(HR.PROFESE).filter(p => !ma.has(p));
    const lide = [];
    for (let k = 0; k < pocet; k++) {
      const prof = chybi.length && PR.nahoda(hra) < 0.6 ? chybi.splice(Math.floor(PR.nahoda(hra) * chybi.length), 1)[0] : HR.nahodnaProfese(hra);
      const l = { jmeno: HR.noveJmeno(hra, lide.map(l => l.jmeno)), prof };
      if (hra.odemceno.slava650 || (hra.odemceno.slava200 && PR.nahoda(hra) < 0.5)) l.zkuseny = true;
      lide.push(l);
    }
    return lide;
  }
  function prijmi(hra, lide) {
    const HR = S.hra, kde = naOkraji(hra), stari = hra.trpaslici.slice(), novi = [];
    for (const l of lide) {
      const t = HR.pridejTrpaslika(hra, l.jmeno, l.prof, kde);
      for (const u of novi) HR.spratel(t, u);
      if (stari.length) HR.spratel(t, stari[t.id % stari.length]);
      novi.push(t);
      if (l.zkuseny || l.vyzbrojeny) {
        t.dov.kopani = Math.min(20, t.dov.kopani + 3);
        for (const k of Object.keys(HR.DOVEDNOSTI)) if (k !== 'kopani' && t.dov[k]) t.dov[k] = Math.min(10, t.dov[k] + 3);
      }
      if (l.vyzbrojeny) { t.zbran = { druh: 'valecna_sekera', mat: 'zelezo', stav: 100 }; t.zbroj = { druh: 'zbroj', mat: 'zelezo', stav: 100 }; }
      PR.rozhledni(hra, t.g);
    }
    PR.zprava(hra, 'pribeh', `Přišli noví trpaslíci: ${lide.map(l => l.jmeno).join(', ')}. Jdou roklí k Bráně.`, kde);
  }
  const popisPrichoziho = l => `${l.jmeno} (${l.zkuseny || l.vyzbrojeny ? 'zkušený ' : ''}${S.hra.PROFESE[l.prof].nazev}${l.vyzbrojeny ? ' se zbraní a zbrojí' : ''})`;

  const MILNIKY = [
    { slava: 120, klic: 'slava120', text: '🎺 Sláva klanu dorazila až do Železných hor: karavany teď povezou i válečné sekery, zbroj a vzácné zboží.' },
    { slava: 200, klic: 'slava200', text: '🎺 Mistři řemesel slyšeli o vaší hoře – noví příchozí bývají zkušení a karavany vozí i hvězdnou rudu.' },
    { slava: 250, klic: 'slava300', text: '🎺 Bardi skládají písně o vašem klanu! Klan je hrdý a jeho jméno zná celý kraj.' },
    { slava: 330, klic: 'slava400', text: '🎺 Králové hor posílají čestnou stráž: dva zkušení strážci se zbraní a zbrojí čekají u brány.' },
    { slava: 500, klic: 'slava500', text: '🎺 Cech mistrů přijal klan mezi slavné: karavany vykupují o pětinu dráž.' },
    { slava: 650, klic: 'slava650', text: '👑 Legenda hor! Klan patří k nejslavnějším v kraji (nálada +4 natrvalo, noví příchozí jsou zkušení mistři).' },
  ];
  function hlidejMilniky(hra) {
    if (!hra.trpaslici.length) return;
    for (const m of MILNIKY) {
      if (hra.odemceno[m.klic] || (hra.slava || 0) < m.slava) continue;
      hra.odemceno[m.klic] = true;
      PR.zprava(hra, 'objev', m.text);
      if (m.klic === 'slava300') for (const t of hra.trpaslici) S.potreby.vzpominka(hra, t, 'písně o našem klanu', 6, 4);
      const straz = m.klic === 'slava400' ? 2 : 0;
      if (straz && !hra.udalost) {
        const lide = [];
        for (let k = 0; k < Math.min(straz, MAX_KLAN - hra.trpaslici.length); k++) lide.push({ jmeno: S.hra.noveJmeno(hra, lide.map(l => l.jmeno)), prof: 'strazce', vyzbrojeny: true });
        if (lide.length) S.udalosti.zacni(hra, 'migranti', { lide });
      }
      return;
    }
  }
  function milnikyInfo(hra) {
    const sez = MILNIKY.map(m => ({ slava: m.slava, klic: m.klic, text: m.text, splneno: !!hra.odemceno[m.klic] }));
    return { seznam: sez, dalsi: sez.find(m => !m.splneno) || null, slava: hra.slava || 0 };
  }

  // začátek období: zima (led, mráz na polích), jinak migranti
  function zmenObdobi(hra, o) {
    const sv = hra.sv;
    const texty = ['Jaro! Sníh taje a rokle se zelená.', 'Léto. Ječmen roste nejrychleji.',
      'Podzim. Tráva zrezavěla, pole je třeba sklidit před zimou.', 'Přišla zima! Rokle je pod sněhem a potok zamrzl.'];
    PR.zprava(hra, 'obdobi', texty[o]);
    for (const t of hra.trpaslici) t.zachvaty = 0;
    sv.obdobi = o;                                  // kreslení (sníh, barva trávy) a led na potoce
    hra.verzeTerenu++; hra.zmenyVse = true; hra.zmenaPraci++;
    if (o === 3) {
      let spaleno = 0;
      for (let g = 0; g < hra.uroda.length; g++) {
        if (!hra.uroda[g]) continue;
        const z = S.stavby.zonaNa(hra, g);
        if (z && z.typ === 'pole') { hra.uroda[g] = 0; spaleno++; }
      }
      if (spaleno) PR.zprava(hra, 'varovani', `Mráz spálil úrodu na ${spaleno} polích.`);
    } else if (!hra.udalost && hra.trpaslici.length > 0 && den(hra) > 1) {
      const lide = skupinaMigrantu(hra);
      if (lide.length) S.udalosti.zacni(hra, 'migranti', { lide });
      else S.udalosti.zacni(hra, 'hoste', { proc: mistoVKlanu(hra).duvod || 'v hoře není místo' });
    }
  }
  function novyDen(hra) {
    hra.slava = spocitejSlavu(hra);
    const d = denRoku(hra), o = obdobi(hra);
    if (hra.sv.obdobi !== o) zmenObdobi(hra, o);            // nové období (i po skoku v čase)
    if (DNY_KARAVANY.includes(d) && !hra.karavana && hra.trpaslici.length) {
      hra.karavana = novaKaravana(hra);
      PR.zvuk(hra, 'zvonek');
      PR.zprava(hra, 'obchod', (hra.odemceno.slava120 ? '🐫 Roklí přijíždí vyhlášená karavana se zbraněmi a vzácným zbožím!' : '🐫 Roklí přijíždí karavana!') +
        ` Zastaví ${hra.sv.trziste ? 'na tržišti' : 'u Brány'} a zůstane dva dny – obchoduj přes 🐫.`, hra.karavana.cil);
    }
    hlidejMilniky(hra);
  }
  function tik(hra) {
    if (hra.tik % S.hra.TAHU_ZA_DEN === 0) novyDen(hra);
    if (hra.karavana && hra.tik >= hra.karavana.do) {
      PR.zprava(hra, 'obchod', hra.karavana.obchodu ? 'Karavana odjela. Vrátí se za půl roku.' : 'Karavana odjela bez obchodu.');
      hra.karavana = null;
    }
  }
  // zamrzlý potok (povrch, zima): kreslení i chůze
  const zamrzle = (sv, g) => sv.obdobi === 3 && g < sv.N && sv.kap[g] > 0 && sv.kapTyp[g] === SV.K.VODA;

  S.obdobi = { DNI_OBDOBI, DNI_ROKU, OBDOBI, DNY_KARAVANY, HODNOTA, CENNOSTI, MAX_STANKU, den, denRoku, obdobi, rok, zima,
               hodnotaVeci, cenaNakup, cenaProdej, prodejDruhu, spocitejSlavu, naProdej, misto, naOkraji, novaKaravana,
               polohaKaravany, obchod, stanku, MAX_KLAN, mistoVKlanu, skupinaMigrantu, prijmi, popisPrichoziho, MILNIKY,
               hlidejMilniky, milnikyInfo, novyDen, tik, zamrzle };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;
