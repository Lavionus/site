/* ============================================================
   Srdce hory – hrozby.js: tvorové, nájezdy a boj.

   Tvorové:
     netopýr – létá kudykoli volným prostorem (slabý, otravný)
     pavouk  – leze po stěnách i stropech (silný, líný)
     goblin  – chodí jako trpaslík, vyráží dveře, krade (nájezdy)
     goblinní lukostřelec – střílí na 3 pole (nájezdy od 2. roku)
     horský troll – hodně zdraví, dveře vyrazí na 3 rány (nájezdy podle
                    výzbroje klanu: troll na každé 4 obrněné strážce)
   Tvorové spí ve skrytých jeskyních a probudí se, když se do jeskyně
   prokope; v hlubinách je při velkém neklidu hory občas vyleze další.
   Goblinní nájezdy chodí od 36. dne zhruba každých 18–26 dní (neklid hory
   je zkrátí, široká hora prodlouží), den předem je hlídka uvidí na obzoru.
   První nájezd jsou 2–3 vyhladovělí goblini, další rostou s klanem, slávou
   (lákadlo), počtem nájezdů a neklidem (na široké hoře víc); od 6. nájezdu
   se střídají druhy: útok, loupež, obléhání údolí, podkop z hlubin.
   Tunelem, když už je odkrytý (a nevyčištěný), jinak údolím. Za finále
   (zažíhání Výhně se Spáčem vzhůru) nájezd počká.
   Boj: kdo stojí vedle nepřítele, bije (jednou za 10 tahů). Poškození
   = útok × dovednost × náhoda, zbroj ho sníží. Strážci nepřátele loví
   (zranění pod 35 ♥ ustoupí, pod 40 ♥ lov nezačnou), bez nepřátel cvičí
   ve zbrojnici. Na Spáče jdou jen ozbrojení strážci a až ve skupině
   aspoň 3 (do té doby se shromáždí poblíž); ostatní před ním utíkají.
   Dveře netvory nepustí (goblin a troll je vyrazí), padací mříž nepustí
   nikoho, past zraní netvora.
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M, pevne } = T.hora;
  const P = T.prace, S = T.stavby, C = T.cesty;
  const N = W * H;

  // vzhled = sprite, kterým se tvor kreslí, dokud grafika nemá vlastní; dvere = kolik ran vyrazí dveře
  const DRUHY = {
    netopyr: { nazev: 'netopýr', zdravi: 12, utok: 3, krok: 3, pohyb: 'let' },
    pavouk:  { nazev: 'obří pavouk', zdravi: 45, utok: 6, krok: 6, pohyb: 'leze', lup: 'hedvabi' },
    goblin:  { nazev: 'goblin', zdravi: 30, utok: 6, krok: 5, pohyb: 'chuze', lup: 'cepel', dvere: 8, krade: true },
    lukostrelec: { nazev: 'goblinní lukostřelec', zdravi: 24, utok: 5, krok: 5, pohyb: 'chuze', lup: 'cepel', dvere: 8, krade: true, dosah: 3, vzhled: 'goblin' },
    trol:    { nazev: 'horský troll', zdravi: 130, utok: 11, krok: 8, pohyb: 'chuze', lup: 'drahokam', dvere: 3, vzhled: 'goblin' },
    spac:    { nazev: 'Pradávný spáč', zdravi: 420, utok: 20, krok: 7, pohyb: 'leze', lup: 'hvezdna' },
  };
  const PRODLEVA_UTOKU = 10, DOSAH_HLEDANI = 900;
  const MARNE_HLEDANI = 120;                         // útočník z nájezdu se stáhne po tolika marných hledáních (≈ 3–4 dny)
  const ZDRAVI_USTUP = 35, ZDRAVI_LOV = 40;          // strážce pod 35 ♥ ustoupí, pod 40 ♥ lov nezačne
  const SKUPINA_NA_SPACE = 3, BLIZKO_SPACE = 10;     // na Spáče aspoň 3 ozbrojení strážci do 10 polí od něj
  const UTEK_OD_SPACE = 12, BEZPECI_OD_SPACE = 20;   // civilisté utíkají, když je Spáč blíž než 12 polí, do 20 polí
  const DEN = () => T.hra.TAHU_ZA_DEN;

  const nah = hra => P.nahoda(hra);
  const vzd = (a, b) => Math.max(Math.abs(a % W - b % W), Math.abs((a / W | 0) - (b / W | 0)));
  const vedle = (a, b) => vzd(a, b) <= 1;

  // --- pohyb tvorů ---------------------------------------------------------------------------
  function prochozi(hra, j, druh) {
    const t = hra.hora.teren[j];
    if (t !== M.VZDUCH) return false;
    if (hra.zavreno[j]) return false;                           // zavřená mříž
    if (hra.stavba[j] === S.K.DVERE) return DRUHY[druh].dvere ? 'dvere' : false;
    return true;
  }
  function sousedeTvora(hra, i, druh, fn) {
    const x = i % W, D = DRUHY[druh];
    if (D.pohyb === 'chuze') {
      C.sousede(hra, i, (j, pres) => {
        const p = prochozi(hra, j, druh); if (!p) return;
        if (pres >= 0 && !prochozi(hra, pres, druh)) return;
        fn(j, pres, p === 'dvere');
      }, false, true);                                            // výtahem tvorové nejezdí
      // dveře: goblin k nim dojde, i když za nimi nestojí (pak je vyrazí)
      for (const dx of [-1, 1]) {
        const j = i + dx;
        if (D.dvere && x + dx >= 0 && x + dx < W && hra.stavba[j] === S.K.DVERE && hra.hora.teren[j] === M.VZDUCH) fn(j, -1, true);
      }
      return;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, j = i + dy * W + dx;
      if (xx < 0 || xx >= W || j < 0 || j >= N || prochozi(hra, j, druh) !== true) continue;
      if (dx && dy && (prochozi(hra, i + dx, druh) !== true || prochozi(hra, i + dy * W, druh) !== true)) continue;   // přes roh ne
      if (D.pohyb === 'leze' && !uStěny(hra, j) && uStěny(hra, i)) continue;   // od stěny se neodlepí (kdo visí ve vzduchu, dolétne ke stěně)
      fn(j, -1, false);
    }
  }
  function uStěny(hra, j) {
    const x = j % W;
    for (const k of [j - W, j + W, x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1]) if (k >= 0 && k < N && pevne(hra.hora.teren[k])) return true;
    return false;
  }
  // BFS pro tvora: cil(i) → hodnota; vrací { i, hodnota, cesta }
  function hledejTvor(hra, start, druh, cil, limit) {
    const pred = new Map([[start, -1]]), pres = new Map(), fronta = [start];
    for (let h = 0; h < fronta.length && h < (limit || DOSAH_HLEDANI); h++) {
      const i = fronta[h], v = cil(i);
      if (v) {
        const c = []; let k = i;
        while (k !== start) { c.push(k); if (pres.get(k) >= 0) c.push(pres.get(k)); k = pred.get(k); }
        return { i, hodnota: v, cesta: c.reverse() };
      }
      sousedeTvora(hra, i, druh, (j, p) => { if (!pred.has(j)) { pred.set(j, i); pres.set(j, p); fronta.push(j); } });
    }
    return null;
  }

  // --- vznik tvorů -----------------------------------------------------------------------------
  function novyTvor(hra, druh, i) {
    const D = DRUHY[druh];
    const t = { id: hra.dalsiId++, druh, i, o: i, t: 0, dur: 0, zdravi: D.zdravi, cesta: [], smer: 1, utok: 0, hledej: 0,
                nese: 0, cil: 0, stav: 'nic' };
    hra.tvorove.push(t);
    return t;
  }
  // prokopnutí do jeskyně probudí, co v ní spí
  function probudJeskyni(hra, o, zprava) {
    const bunky = (o.bunky || []).filter(i => hra.hora.teren[i] === M.VZDUCH);
    if (!bunky.length) return;
    const vyber = () => bunky[Math.floor(nah(hra) * bunky.length)];
    const pridej = (druh, n) => { for (let k = 0; k < n; k++) novyTvor(hra, druh, vyber()); return n; };
    let n = 0, kdo = '';
    if (o.typ === 'krapnikova' || o.typ === 'jeskyne') { n = pridej('netopyr', 1 + Math.floor(nah(hra) * 3)); kdo = 'Z jeskyně vylétli netopýři!'; }
    if (o.typ === 'jeskyne' || o.typ === 'hlubinna') { const k = pridej('pavouk', 1 + Math.floor(nah(hra) * 2)); if (k) { n += k; kdo = 'V jeskyni se pohnuli obří pavouci!'; } }
    if (o.typ === 'houbova' && nah(hra) < 0.5) { n += pridej('pavouk', 1); kdo = 'Mezi houbami číhá obří pavouk!'; }
    if (o.typ === 'tunel') {
      n += pridej('goblin', 2 + Math.floor(nah(hra) * 2)); kdo = 'Tunel patří goblinům – a jsou doma!';
      hra.dalsiNajezd = Math.min(hra.dalsiNajezd, hra.tik + 4 * T.hra.TAHU_ZA_DEN);
    }
    if (n) zprava('boj', '⚔️ ' + kdo, hra.tvorove[hra.tvorove.length - 1].i);
  }
  // --- nájezdy a neklid hory --------------------------------------------------------------------
  // neklid hory 0–1: roste s hloubkou (od 60 m) a s ukutou hvězdnou ocelí (artefakty duní horou)
  // (předčasně probuzený Spáč – kopání pod 138 m bez Klíče, Srdce bez Klíče – zvedne neklid natrvalo o 0,3)
  function neklid(hra) {
    const hl = Math.max(0, Math.min(1, ((hra.nejhloubeji || 0) - 60) / 90));
    const art = Object.keys(hra.artefakty || {}).length;
    return Math.min(1, 0.7 * hl + 0.1 * art + (hra.spac && hra.spac.brzy ? 0.3 : 0));
  }
  const ozbrojenych = hra => hra.trpaslici.filter(t => t.povoleno.hlidat && t.zbran).length;
  const obrnenych = hra => hra.trpaslici.filter(t => t.povoleno.hlidat && t.zbran && t.zbroj).length;
  // Sláva láká goblíny (bohatství klanu), ne počet zbraní: 200 slávy ≈ bod síly, nejvýš 4 (do slávy 800 – dřív strop
  // 2,5 už při slávě 375, pozdní sláva nájezdy neměnila).
  const LAKADLO_SLAVA = 200, LAKADLO_MAX = 4;
  const lakadlo = hra => Math.min(LAKADLO_MAX, (hra.slava || 0) / LAKADLO_SLAVA);
  // šířka hory: na široké hoře nájezdníci jdou dál a rozptýlí se (padlých na nájezd: malá 0,45, střední 0,39, obří 0,19)
  // → síla × (W/96)^¼, odstup nájezdů × (96/W)^¼ (s odmocninou byla obří hora po změně nejsmrtelnější – 0,34 na nájezd)
  const SIRKA_SILA = Math.pow(W / 96, 0.25), SIRKA_CAS = Math.pow(96 / W, 0.25);
  const MAX_SILA = 18;
  // síla nájezdu (body; troll = 3): první nájezd 2–3 slabí goblini, pak roste s klanem, slávou, počtem nájezdů a neklidem
  // (dřív i s roky: síla 14 = strop už v 6. roce a nejvíc mrtvých ve 3.–4. roce)
  function silaNajezdu(hra) {
    const k = hra.najezdu || 0, n = hra.trpaslici.length;
    if (!k) return n >= 10 ? 3 : 2;
    // (nejvýš 0,6 bodu na trpaslíka, aspoň 3 – zdecimovaný klan nedorazí stejně silný nájezd jako plnou horu)
    return Math.max(2, Math.min(MAX_SILA, Math.max(3, Math.ceil(0.6 * n)), Math.round((1 + n / 9 + lakadlo(hra) + k / 7 + neklid(hra)) * SIRKA_SILA)));
  }
  // Troll podle výzbroje klanu, ne podle roku: na každé 4 obrněné ozbrojené strážce jeden (nejvýš 3), jen u síly 7+.
  // Dřív troll od 3. roku při síle 8+ – přišel na klan s 0–2 obrněnými a ve 3.–4. roce zabíjel nejvíc.
  const trolluNa = (hra, sila) => (hra.najezdu || 0) && sila >= 7 ? Math.min(3, Math.floor(obrnenych(hra) / 4), Math.floor((sila - 3) / 3)) : 0;
  // druhy nájezdu (od 6. nájezdu se střídají): utok – tlupa jde na trpaslíky; kradez – zloději jdou rovnou po cennostech
  // ve skladech; obleh – tlupa s lukostřelci 2 dny obléhá údolí u brány (karavana se otočí, migranti nepřijdou), pak
  // zaútočí; podkop – goblini se prokopou z hlubin poblíž nejhlubších trpaslíků
  const TYPY_NAJEZDU = {
    utok: { nazev: 'útok', popis: 'tlupa jde na trpaslíky' },
    kradez: { nazev: 'loupež', popis: 'zloději jdou po cennostech ve skladech' },
    obleh: { nazev: 'obléhání', popis: 'tlupa s lukostřelci 2 dny obléhá údolí, pak zaútočí' },
    podkop: { nazev: 'podkop', popis: 'goblini se prokopou z hlubin k nejhlubším trpaslíkům' },
  };
  function zvolTypNajezdu(hra) {
    if ((hra.najezdu || 0) < 6) return 'utok';
    const v = [['utok', 4], ['kradez', 2], ['obleh', 2], ['podkop', (hra.nejhloubeji || 0) >= 60 ? 2 : 0]];
    let r = nah(hra) * v.reduce((a, x) => a + x[1], 0);
    for (const [typ, w] of v) { r -= w; if (r < 0) return typ; }
    return 'utok';
  }
  // předpověď dalšího nájezdu pro UI (Přehled): kdy, jak silný, jaký a odkud; troll podle stejných pravidel jako
  // sestavaNajezdu (lukostřelci se losují až při nájezdu – v odhadu jsou jen „goblini a lukostřelci")
  function predpovedNajezdu(hra) {
    const den = T.hra.TAHU_ZA_DEN, zaTahu = Math.max(0, hra.dalsiNajezd - hra.tik);
    const rok = T.obdobi.rok(hra), k = hra.najezdu || 0;
    let typ = hra.dalsiNajezdTyp || 'utok', podkopI = -1;
    // stejná pravidla jako najezd(): podkop bez místa (nejhlubší trpaslík nad 40 m) přijde jako útok, loupež je slabší
    if (typ === 'podkop') { podkopI = mistoPodkopu(hra); if (podkopI < 0) typ = 'utok'; }
    let sila = silaNajezdu(hra);
    if (typ === 'kradez') sila = Math.max(2, Math.ceil(sila * 0.6));
    const troll = typ === 'kradez' ? 0 : trolluNa(hra, sila);
    const misto = typ === 'podkop' ? { tunel: false, i: podkopI } : mistoNajezdu(hra);
    return { tik: hra.dalsiNajezd, den: Math.floor(hra.dalsiNajezd / den) + 1, zaDni: zaTahu / den, sila, trollu: troll, goblinu: Math.max(0, sila - 3 * troll),
             lukostrelci: k >= 2 && rok >= 2, prvni: !k, odkud: typ === 'podkop' ? 'hlubiny' : misto.tunel ? 'tunel' : 'brana', i: misto.i, ohlaseno: zaTahu <= den,
             typ, typNazev: TYPY_NAJEZDU[typ].nazev, typPopis: TYPY_NAJEZDU[typ].popis, lakadlo: lakadloInfo(hra) };
  }
  // jak sláva láká goblíny (pro UI): body síly ze slávy, strop a kolik slávy do stropu
  function lakadloInfo(hra) {
    const b = lakadlo(hra);
    return { slava: hra.slava || 0, body: Math.round(b * 10) / 10, max: LAKADLO_MAX, slavaNaBod: LAKADLO_SLAVA, sirka: Math.round(SIRKA_SILA * 100) / 100,
             text: `Sláva ${hra.slava || 0} láká goblíny: +${String(Math.round(b * 10) / 10).replace('.', ',')} k síle nájezdu (každých ${LAKADLO_SLAVA} slávy +1, nejvýš +${LAKADLO_MAX}).` };
  }
  // Odkrytý goblinní tunel, ze kterého se goblin dostane ke klanu: stojná pole tunelu, jinak null (nájezd přijde údolím).
  // Dřív nájezd vylezl z odkrytého tunelu, i když z něj nevedla cesta – goblini v něm zůstali uvěznění (desítky za pár
  // let), strážci je nemohli dostihnout a každý tah je marně hledali. Jednou za tah (WeakMap), cesta pro goblina.
  const tunelCache = new WeakMap();
  function tunelProNajezd(hra) {
    const tunel = hra.hora.oblasti.find(o => o.typ === 'tunel');
    if (!tunel || !hra.objeveno[tunel.cislo] || !hra.trpaslici.length || (hra.odemceno && hra.odemceno.tunelVycisten)) return null;   // vyčištěný tunel: nájezdy údolím
    const c = tunelCache.get(hra);
    if (c && c.tik === hra.tik) return c.mista;
    let mista = (tunel.bunky || []).filter(i => hra.hora.teren[i] === M.VZDUCH && C.stojne(hra, i));
    if (mista.length) {
      // cesta se ověří z každého místa zvlášť (dřív jen z prvního – ostatní mohla být oddělená a goblini v nich uvízli);
      // úspěch: místo i místa po cestě; neúspěch po celém prohledání (bez limitu): i všechna místa, kam se odtud došlo
      const kolem = poleUTrpasliku(hra), dobra = new Set(), spatna = new Set(), vTunelu = new Set(mista);
      const LIMIT = 6000;
      for (const m of mista) {
        if (dobra.has(m) || spatna.has(m)) continue;
        const navst = [];
        const r = hledejTvor(hra, m, 'goblin', i => { navst.push(i); return kolem.has(i) || dobra.has(i) ? 1 : 0; }, LIMIT);
        if (r) { dobra.add(m); for (const j of r.cesta) if (vTunelu.has(j)) dobra.add(j); }
        else if (navst.length < LIMIT) { for (const j of navst) if (vTunelu.has(j)) spatna.add(j); }
        else spatna.add(m);
      }
      mista = mista.filter(m => dobra.has(m));
    }
    if (!mista.length) mista = null;
    tunelCache.set(hra, { tik: hra.tik, mista });
    return mista;
  }
  // kudy nájezd přijde: odkrytým goblinním tunelem (když z něj vede cesta ke klanu), jinak údolím k bráně
  function mistoNajezdu(hra) {
    const m = tunelProNajezd(hra);
    if (m) return { tunel: true, i: m[0] };
    return { tunel: false, i: hra.hora.brana.y * W + hra.hora.brana.x };
  }
  // složení nájezdu: trollové podle výzbroje klanu (trolluNa), od 2. roku lukostřelci (při obléhání víc)
  function sestavaNajezdu(hra, sila, typ) {
    const rok = T.obdobi.rok(hra), k = hra.najezdu || 0, out = [];
    let body = sila;
    if (typ !== 'kradez') for (let n = trolluNa(hra, sila); n > 0; n--) { out.push('trol'); body -= 3; }
    const luk = typ === 'obleh' ? 0.5 : 0.3;
    for (; body > 0; body--) out.push(k >= 2 && rok >= 2 && nah(hra) < luk ? 'lukostrelec' : 'goblin');
    return out;
  }
  // místo podkopu: volné stojné známé pole 10–30 polí od nejhlubšího trpaslíka, kde do 6 polí nikdo nestojí
  function mistoPodkopu(hra) {
    const t = hra.trpaslici.reduce((a, u) => !a || (u.i / W | 0) > (a.i / W | 0) ? u : a, null);
    if (!t || (t.i / W | 0) - T.hora.UDOLI < 40) return -1;
    const r = C.hledej(hra, t.i, i => vzd(i, t.i) >= 10 && vzd(i, t.i) <= 30 && C.stojne(hra, i) && hra.znamo[i] &&
      !hra.trpaslici.some(u => vzd(u.i, i) <= 6) ? 1 : 0, 3000);
    return r ? r.i : -1;
  }
  // sila: volitelně pevný počet goblinů (testy)
  function najezd(hra, zprava, sila) {
    const prvni = !hra.najezdu;
    let typ = sila ? 'utok' : hra.dalsiNajezdTyp || 'utok';
    let silaN = silaNajezdu(hra);
    if (typ === 'kradez') silaN = Math.max(2, Math.ceil(silaN * 0.6));
    const druhy = sila ? Array(sila).fill('goblin') : sestavaNajezdu(hra, silaN, typ);
    let mista = null, odkud = '';
    if (typ === 'podkop') { const m = mistoPodkopu(hra); if (m >= 0) { mista = [m]; odkud = `se prokopali z hlubin (${(m / W | 0) - T.hora.UDOLI} m)`; } else typ = 'utok'; }
    if (!mista) mista = tunelProNajezd(hra);
    const odkryty = !!mista && typ !== 'podkop';
    if (!mista) mista = [T.obdobi.naOkraji(hra)];
    if (!odkud) odkud = odkryty ? 'vylézá z tunelu' : 'přichází údolím k bráně';
    if (typ === 'obleh' && odkryty) typ = 'utok';                 // obléhá se jen údolí
    let kde = -1;
    for (const d of druhy) {
      const u = novyTvor(hra, d, mista[Math.floor(nah(hra) * mista.length)]);
      if (prvni && !sila) u.zdravi = 20;                // první nájezd: vyhladovělí goblini
      u.najezd = 1;                                     // útočník z nájezdu (poplach se kvůli němu drží – viz hra.utocnik)
      if (typ === 'kradez' && DRUHY[d].krade) u.zlodej = 1;
      if (typ === 'obleh') u.obleh = hra.tik + OBLEH_DNI * DEN();
      kde = u.i;
    }
    if (typ === 'obleh') hra.oblehani = { do: hra.tik + OBLEH_DNI * DEN() };
    T.hra.zvuk(hra, 'roh');
    const pocty = {};
    for (const d of druhy) pocty[d] = (pocty[d] || 0) + 1;
    const popis = Object.entries(pocty).map(([d, n]) => d === 'goblin' ? (n < 5 ? `${n} goblini` : `${n} goblinů`) : d === 'lukostrelec' ? `${n}× lukostřelec` : n > 1 ? `${n} trollové` : 'troll').join(', ');
    const uvod = typ === 'kradez' ? '⚔️ Goblinní lupiči!' : typ === 'obleh' ? '⚔️ Goblini obléhají údolí!' : typ === 'podkop' ? '⚔️ Podkop!' : '⚔️ Goblinní nájezd!';
    const rada = typ === 'kradez' ? 'Jdou po cennostech ve skladech – pošli strážce ke skladům.' : typ === 'obleh' ? 'Dva dny čekají u brány (karavana neprojde), pak zaútočí. Zavři bránu a připrav strážce.'
      : 'Zavři dveře a pošli strážce.';
    zprava('boj', `${uvod} ${prvni && !sila ? 'Hrstka vyhladovělých goblinů' : popis} ${odkud}. ${rada}`, kde);
    hra.najezdu = (hra.najezdu || 0) + 1;
  }
  const OBLEH_DNI = 2;
  // varování den před nájezdem (stav se neukládá: nájezd se plánuje vždy aspoň den a tah dopředu)
  function varujNajezd(hra, zprava) {
    const n = hra.najezdu ? silaNajezdu(hra) : 0, typ = hra.dalsiNajezdTyp || 'utok';
    const kolik = !hra.najezdu ? 'Jen pár vyhladovělých – ale klan zatím nemá zbraně.' : n <= 4 ? 'Malá tlupa.' : n <= 9 ? 'Velká tlupa!' : 'Celé vojsko!';
    const trol = typ !== 'kradez' && trolluNa(hra, n) ? ' Mezi nimi je vidět trolla.' : '';
    const m = mistoNajezdu(hra);
    if (typ === 'podkop') { zprava('varovani', `👂 Horníci v hlubinách slyší cizí krumpáče – zítra se goblini prokopou k nejhlubším chodbám. ${kolik}${trol} Pošli strážce dolů.`); return; }
    const co = typ === 'kradez' ? ' Vypadají jako lupiči – půjdou po cennostech.' : typ === 'obleh' ? ' Táhnou s lukostřelci a stany – chystají obléhání.' : '';
    zprava('varovani', `👁️ Na obzoru se objevili goblini – zítra zaútočí ${m.tunel ? 'z goblinního tunelu' : 'údolím k bráně'}. ${kolik}${trol}${co} Vyzbroj strážce a připrav dveře nebo mříž.`, m.i);
  }
  // v hlubinách při velkém neklidu občas vyleze tvor z už objevené jeskyně
  function tvorZHlubin(hra, zprava) {
    const jj = hra.hora.jeskyne.filter(o => hra.objeveno[o.cislo] && (o.typ === 'hlubinna' || o.typ === 'jeskyne'));
    if (!jj.length) return;
    const o = jj[Math.floor(nah(hra) * jj.length)];
    const bunky = (o.bunky || []).filter(i => hra.hora.teren[i] === M.VZDUCH);
    if (!bunky.length) return;
    const pav = novyTvor(hra, 'pavouk', bunky[Math.floor(nah(hra) * bunky.length)]);
    zprava('boj', '🕷️ Hora se neklidně zachvěla – z hlubin vylezl obří pavouk.', pav.i);
  }

  // --- boj ---------------------------------------------------------------------------------------
  const ZBRAN = { valecna_sekera: 14, krumpac: 6, sekera: 8, kladivo: 7 };
  function utokTrpaslika(t, hra) {
    const zb = t.zbran ? ZBRAN[t.zbran.druh] || 8 : t.nastroj ? ZBRAN[t.nastroj.druh] || 4 : 4;
    const kov = (t.zbran || t.nastroj || {}).mat === 'med' ? 0.8 : 1;
    return zb * kov * (1 + 0.1 * (t.dov.boj || 0)) * (hra && T.pribeh ? T.pribeh.utokKlanu(hra) : 1);
  }
  function ochrana(t) { return t.zbroj ? (t.zbroj.mat === 'med' ? 0.25 : 0.4) : 0; }
  function zasah(hra, cil, sila, jeTrpaslik) {
    const dmg = Math.max(1, Math.round(sila * (0.7 + nah(hra) * 0.6) * (jeTrpaslik ? 1 - ochrana(cil) : 1 / (cil.odolnost || 1))));
    cil.zdravi -= dmg;
    return dmg;
  }
  function zabijTvora(hra, u, zprava, kdo) {
    hra.tvorove.splice(hra.tvorove.indexOf(u), 1);
    const D = DRUHY[u.druh];
    if (u.nese) { const v = hra.veci.find(v => v.id === u.nese); if (v) { v.nese = 0; v.rez = 0; v.i = u.i; } }
    if (D.lup && nah(hra) < 0.6) P.novaVec(hra, D.lup, u.i, 0);
    P.usadVeci(hra);
    hra.zabito = (hra.zabito || 0) + 1;
    T.hra.zvuk(hra, 'padl', u.i);
    const koho = { pavouk: 'obřího pavouka', spac: 'Pradávného spáče', goblin: 'goblina', netopyr: 'netopýra', lukostrelec: 'goblinního lukostřelce', trol: 'horského trolla' }[u.druh];
    if (u.druh !== 'netopyr' || nah(hra) < 0.3) zprava('objev', `${kdo ? kdo.jmeno : 'Past'} zabil ${koho}.`, u.i);
  }
  // ustoupí o krok dál od nepřítele; vrací true, když bylo kam
  function ustup(hra, t, u) {
    let nej = -1, nejV = vzd(u.i, t.i);
    C.sousede(hra, t.i, (j, pres) => { if (pres < 0 && vzd(u.i, j) > nejV) { nejV = vzd(u.i, j); nej = j; } }, false, true);   // jen sousední pole – výtahem se neutíká (krok trvá 4 tahy)
    if (nej < 0) return false;
    T.hra.pustPraci(hra, t); const dx = nej % W - t.i % W; if (dx) t.smer = dx > 0 ? 1 : -1;
    t.o = t.i; t.i = nej; t.t = 0; t.dur = 4; t.stav = 'utika'; t.cekej = 2;   // (dřív 10 tahů stál – nájezdník ho dohnal)
    return true;
  }
  const strazceSeZbrani = t => t.povoleno.hlidat && t.zbran;
  // trpaslík bije souseda-nepřítele (volá se každý tah trpaslíka, i při práci; i zuřící se brání)
  function branSe(hra, t, zprava) {
    if (t.utok > 0) { t.utok--; return false; }
    if (t.stav === 'spi') return false;                      // spícího probudí až útok (krokTvora)
    // zraněný strážce lov nedokončí
    if (t.prace && t.prace.typ === 'lov' && t.zdravi < ZDRAVI_USTUP) T.hra.pustPraci(hra, t);
    const u = hra.tvorove.find(u => vedle(u.i, t.i));
    if (!u) return false;
    // útěk: nevyzbrojený zraněný civilista, zraněný strážce, od Spáče každý kromě ozbrojeného strážce
    // (a kromě toho, kdo zažíhá Výheň); zuřivec neutíká
    const zuri = t.zuri > hra.tik;
    // (civilista utíká už pod 60 ♥ a před trollem vždy – holýma rukama ho neporazí; dál ho vede ukryjSe do úkrytu)
    const utect = !zuri && ((!t.zbran && !t.povoleno.hlidat && (t.zdravi < 60 || u.druh === 'trol')) || (t.povoleno.hlidat && t.zdravi < ZDRAVI_USTUP) ||
      (u.druh === 'spac' && !strazceSeZbrani(t) && !(t.prace && t.prace.typ === 'zazehnout')));
    if (utect && ustup(hra, t, u)) return true;
    t.utok = PRODLEVA_UTOKU;
    zasah(hra, u, utokTrpaslika(t, hra), false);
    T.hra.zvuk(hra, 'boj', u.i, t.zbran ? 1 : 0);
    if (t.povoleno.hlidat && (t.dov.boj || 0) < 10 && nah(hra) < 0.08) t.dov.boj = (t.dov.boj || 0) + 1;
    if (u.zdravi <= 0) zabijTvora(hra, u, zprava, t);
    return true;
  }

  // --- tah tvora -----------------------------------------------------------------------------------
  // lukostřelec vidí cíl, když mezi nimi není pevná hornina
  function volnyVyhled(hra, a, b) {
    const ax = a % W, ay = a / W | 0, dx = b % W - ax, dy = (b / W | 0) - ay, n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let k = 1; k < n; k++) if (pevne(hra.hora.teren[Math.round(ay + dy * k / n) * W + Math.round(ax + dx * k / n)])) return false;
    return true;
  }
  function presunTvor(u, j, doba) {
    const dx = j % W - u.i % W; if (dx) u.smer = dx > 0 ? 1 : -1;
    u.o = u.i; u.i = j; u.t = 0; u.dur = doba;
  }
  // pole vedle trpaslíků (cíle tvorů) – jednou za tah, znovu při úbytku klanu (během tahu tvorů se trpaslíci nehýbou)
  const kolemCache = new WeakMap();
  function poleUTrpasliku(hra) {
    const c = kolemCache.get(hra);
    if (c && c.tik === hra.tik && c.n === hra.trpaslici.length) return c.set;
    const set = new Set();
    for (const t of hra.trpaslici) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = t.i % W + dx, j = t.i + dy * W + dx; if (x >= 0 && x < W && j >= 0 && j < N) set.add(j);
    }
    kolemCache.set(hra, { tik: hra.tik, n: hra.trpaslici.length, set });
    return set;
  }
  // kdo právě zažíhá Výheň (stojí u ní s Klíčem)
  function zazehnujici(hra) {
    const vyhen = hra.hora.srdce.y * W + hra.hora.srdce.x;
    return hra.trpaslici.find(t => t.prace && t.prace.typ === 'zazehnout' && t.i === vyhen) || null;
  }
  function krokTvora(hra, u, zprava) {
    if (u.t < u.dur) { u.t++; if (u.t < u.dur) return; }
    u.o = u.i; u.t = u.dur = 0;
    const D = DRUHY[u.druh];
    // chodec padá
    if (D.pohyb === 'chuze' && !C.stojne(hra, u.i) && hra.hora.teren[u.i + W] === M.VZDUCH) { presunTvor(u, u.i + W, 2); return; }
    if (hra.hora.teren[u.i] === M.MAGMA) { zabijTvora(hra, u, zprava, null); return; }
    // past
    if (hra.stavba[u.i] === S.K.PAST && !hra.stavbaStav[u.i]) {
      u.zdravi -= 25; hra.stavbaStav[u.i] = 1; hra.pastiNapnout.push({ i: u.i, tik: hra.tik + 300 });
      if (u.zdravi <= 0) { zabijTvora(hra, u, zprava, null); return; }
    }
    if (u.utok > 0) u.utok--;
    // útok na souseda (lukostřelec i na dálku přes volný prostor)
    // Spáč a pavouci z vln finále jdou nejdřív po tom, kdo zažíhá Výheň (u Výhně), a bijí ho přednostně
    const zazehnuje = (u.druh === 'spac' || u.vlna) && hra.zazehnuti && !hra.vyhenHori ? zazehnujici(hra) : null;
    const obet = (zazehnuje && vedle(zazehnuje.i, u.i) ? zazehnuje : null) || hra.trpaslici.find(t => vedle(t.i, u.i)) ||
      (D.dosah && hra.trpaslici.find(t => vzd(t.i, u.i) <= D.dosah && volnyVyhled(hra, u.i, t.i)));
    if (obet) {
      if (u.utok <= 0) {
        u.utok = PRODLEVA_UTOKU + (D.pohyb === 'let' ? 5 : 0) + (D.dosah ? 5 : 0);
        u.zautocil = hra.tik;
        zasah(hra, obet, D.utok, true);
        T.hra.zvuk(hra, u.druh === 'spac' ? 'rev' : 'zasah', obet.i);
        if (obet.zdravi <= 0) T.hra.umri(hra, obet, `${obet.jmeno} padl v boji s: ${D.nazev}.`, 'boj');
        else {
          if (obet.stav === 'spi' && !(obet.nemoc > hra.tik)) { T.hra.pustPraci(hra, obet); obet.stav = 'nic'; }   // útok probudí
          if (!obet.poplach || obet.poplach < hra.tik) { obet.poplach = hra.tik + 600; zprava('zraneni', `${D.nazev[0].toUpperCase() + D.nazev.slice(1)} ${D.dosah && !vedle(obet.i, u.i) ? 'postřelil' : 'napadl'}: ${obet.jmeno}!`, obet.i); }
        }
      }
      return;
    }
    // cesta
    if (u.cesta.length) {
      const dalsi = u.cesta.shift();
      if (hra.stavba[dalsi] === S.K.DVERE && D.dvere) {                         // vyrazit dveře
        u.cesta.unshift(dalsi);
        if (u.utok <= 0) {
          u.utok = PRODLEVA_UTOKU;
          if ((hra.stavbaStav[dalsi] += Math.round(8 / D.dvere)) >= 8) { S.zbourej(hra, dalsi, () => {}); hra.stavbaStav[dalsi] = 0; zprava('boj', u.druh === 'trol' ? '⚔️ Troll vyrazil dveře!' : '⚔️ Goblini vyrazili dveře!'); }
        }
        return;
      }
      const ok = D.pohyb === 'chuze' ? prochozi(hra, dalsi, u.druh) : prochozi(hra, dalsi, u.druh) === true;
      if (!ok || vzd(dalsi, u.i) > 2) { u.cesta = []; return; }
      presunTvor(u, dalsi, D.krok);
      return;
    }
    if (u.hledej > 0) { u.hledej--; return; }
    u.hledej = 15 + (u.id % 7);
    // lupič (nájezd typu loupež): rovnou po nejcennější věci ve skladu, s kořistí pryč; trpaslíky bije, jen když stojí vedle
    if (u.zlodej && D.krade) {
      if (u.nese) { odnesKorist(hra, u, zprava); return; }
      const r0 = hledejTvor(hra, u.i, u.druh, i => S.jeSklad(hra, i) && hra.veci.some(v => !v.nese && v.i === i && (T.obdobi.HODNOTA[v.druh] || 1) >= 8) ? 1 : 0, 2500);
      if (r0) { if (!r0.cesta.length) krast(hra, u, zprava); else u.cesta = r0.cesta; return; }
      delete u.zlodej;                               // nic cenného – chová se jako běžný nájezdník
    }
    // cíl: nejbližší trpaslík; goblin bez cíle krade; netopýr poletuje
    const obsazeno = new Set(hra.trpaslici.map(t => t.i));
    const kolem = poleUTrpasliku(hra);
    // za finále: Spáč a pavouci z vln k zažíhajícímu; Spáč, když nikdo nezažíhá, hlídá Výheň (pole kolem ní)
    const vyhen = hra.hora.srdce.y * W + hra.hora.srdce.x;
    // obléhající čekají v údolí u brány: hledají jen nablízko (lukostřelci střílí, kdo vyjde ven)
    const dosahHledani = u.obleh > hra.tik ? OBLEH_DOSAH : D.pohyb === 'leze' ? 400 : DOSAH_HLEDANI;
    // volný režim (vyzvaný Spáč): Spáč neopouští okolí Srdce (25 polí) – je to volitelný boss, ne zkáza celé hory
    const doma = u.druh === 'spac' && hra.rezim === 'volny';
    const r = (zazehnuje && hledejTvor(hra, u.i, u.druh, i => vedle(i, zazehnuje.i) ? 1 : 0, 900)) ||
      hledejTvor(hra, u.i, u.druh, i => kolem.has(i) && (!doma || vzd(i, vyhen) <= SPAC_DOMA) ? 1 : 0, dosahHledani) ||
      (u.druh === 'spac' && ((hra.zazehnuti && !hra.vyhenHori) || doma) && vzd(u.i, vyhen) > 2 ? hledejTvor(hra, u.i, u.druh, i => vzd(i, vyhen) <= 2 ? 1 : 0, 900) : null);
    if (r) { u.cesta = r.cesta; if (u.marne) u.marne = 0; return; }
    // útočník z nájezdu, který se ke klanu dlouho nedostane (~3–4 dny marného hledání, nic nenese), se stáhne
    // (obléhající během obléhání marně nehledá – čeká)
    if (u.obleh > hra.tik) return;
    if (u.najezd && !u.nese && (u.marne = (u.marne || 0) + 1) > MARNE_HLEDANI) {
      hra.tvorove.splice(hra.tvorove.indexOf(u), 1);
      if (!hra.tvorove.some(v => v.najezd)) zprava('boj', 'Nájezdníci to vzdali a stáhli se – ke klanu se nedostali.', u.i);
      return;
    }
    void obsazeno;
    if (D.krade) {
      if (!u.nese) {
        const r2 = hledejTvor(hra, u.i, u.druh, i => hra.veci.find(v => !v.nese && v.i === i && S.jeSklad(hra, i)) ? 1 : 0);
        if (r2) { if (!r2.cesta.length) krast(hra, u, zprava); else u.cesta = r2.cesta; }
      } else odnesKorist(hra, u, zprava);
    } else if (u.druh === 'netopyr' && nah(hra) < 0.5) {
      const kam = [];
      sousedeTvora(hra, u.i, u.druh, j => kam.push(j));
      if (kam.length) u.cesta = [kam[Math.floor(nah(hra) * kam.length)]];
    }
  }
  function odnesKorist(hra, u, zprava) {
    const ven = T.obdobi.naOkraji(hra);
    if (u.i === ven) { utekl(hra, u, zprava); return; }
    const r3 = hledejTvor(hra, u.i, u.druh, i => i === ven ? 1 : 0, 3000);
    if (r3) u.cesta = r3.cesta; else utekl(hra, u, zprava);
  }
  const OBLEH_DOSAH = 150, SPAC_DOMA = 25;
  function krast(hra, u, zprava) {
    const vv = hra.veci.filter(v => !v.nese && v.i === u.i);
    if (!vv.length) return;
    vv.sort((a, b) => (T.obdobi.HODNOTA[b.druh] || 1) - (T.obdobi.HODNOTA[a.druh] || 1));
    const v = vv[0];
    v.nese = u.id; v.rez = -1; u.nese = v.id;
    zprava('boj', `Goblin krade ze skladu: ${P.VECI[v.druh].nazev}!`, v.i);
  }
  function utekl(hra, u, zprava) {
    if (u.nese) { const v = hra.veci.find(v => v.id === u.nese); if (v) hra.veci.splice(hra.veci.indexOf(v), 1); zprava('boj', 'Goblin utekl i s kořistí.'); }
    hra.tvorove.splice(hra.tvorove.indexOf(u), 1);
  }

  // --- strážci ----------------------------------------------------------------------------------------
  // najde práci strážce: lov nepřítele, jinak výcvik ve zbrojnici
  // strážci loví jen nepřátele, o kterých klan ví (tvorové skrytí v neprozkoumaných jeskyních je nelákají)
  const znamyNepritel = hra => hra.tvorove.some(u => hra.znamo[u.i]);
  const uNepritele = (hra, i) => hra.tvorove.some(u => hra.znamo[u.i] && vedle(u.i, i));
  const spacNa = hra => hra.tvorove.find(u => u.druh === 'spac');
  // na Spáče se jde, když je u něj dost zdravých ozbrojených strážců, nebo když už bojuje (někoho napadl)
  // a strážce je blízko (vzdálení se dál shromažďují – nechodí po jednom)
  function naSpaceVSkupine(hra, s, t) {
    if (s.zautocil > hra.tik - 60 && vzd(t.i, s.i) <= 2 * BLIZKO_SPACE) return true;
    let n = 0;
    for (const t of hra.trpaslici) if (strazceSeZbrani(t) && t.zdravi >= ZDRAVI_USTUP && vzd(t.i, s.i) <= BLIZKO_SPACE) n++;
    return n >= SKUPINA_NA_SPACE;
  }
  // Strážce: lov známého dosažitelného nepřítele, jinak výcvik. Nedosažitelný nebo neznámý tvor (pavouk v odlehlé
  // jeskyni, goblin za vodou) výcvik nezastaví – dřív stačil jakýkoli živý tvor v hoře a čistí strážci roky stáli.
  // Marné hledání lovu zablokuje další hledání na 60 tahů (t.lovBlok – celé prohledání hory je drahé).
  function praceStrazce(hra, t) {
    if (!t.povoleno.hlidat) return null;
    if (znamyNepritel(hra) && !(t.lovBlok > hra.tik)) {
      if (t.zdravi < ZDRAVI_LOV) return null;      // zraněný strážce lov nezačne
      const s = spacNa(hra), naSpace = s && t.zbran && naSpaceVSkupine(hra, s, t);
      // nejbližší známý nepřítel kdekoli v dosažitelné hoře (Spáč jen ozbrojeným a ve skupině); pole vedle nepřátel
      // předem do množiny (dřív se pro každé prohledané pole procházeli všichni tvorové)
      const cile = new Set();
      for (const u of hra.tvorove) if (hra.znamo[u.i] && (u.druh !== 'spac' || naSpace))
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = u.i % W + dx, j = u.i + dy * W + dx; if (x >= 0 && x < W && j >= 0 && j < N) cile.add(j); }
      const r = cile.size ? C.hledej(hra, t.i, i => cile.has(i) ? 1 : 0) : null;
      if (r) return { hodnota: { typ: 'lov', pos: r.i }, cesta: r.cesta };
      // ozbrojený strážce se shromáždí 4–9 polí od Spáče
      if (s && t.zbran && hra.znamo[s.i]) {
        const r2 = C.hledej(hra, t.i, i => { const d = vzd(i, s.i); return d >= 4 && d <= 9 && C.stojne(hra, i) ? 1 : 0; });
        if (r2) return { hodnota: { typ: 'lov', pos: r2.i, sraz: 1 }, cesta: r2.cesta };
      }
      if (t.zdravi >= ZDRAVI_LOV) t.lovBlok = hra.tik + 60;
    }
    if ((t.dov.boj || 0) < 10) {
      const r = C.hledej(hra, t.i, i => {
        if (hra.stavba[i] !== S.K.DILNA || !C.stojne(hra, i)) return 0;
        const d = S.dilnaNa(hra, i);
        return d && d.typ === 'zbrojnice' && !hra.trpaslici.some(u => u !== t && u.prace && u.prace.typ === 'cvicit' && u.prace.pos === i) ? 1 : 0;
      }, 1500);
      if (r) return { hodnota: { typ: 'cvicit', pos: r.i }, cesta: r.cesta };
    }
    // čistý strážce (nic jiného nemá zapnuté) v klidu necelí: cvičí na místě (bez zbrojnice pomaleji, na mistrovství jen drží formu)
    if (jenStraz(t)) return { hodnota: { typ: 'cvicit', pos: t.i, naMiste: 1 }, cesta: [] };
    return null;
  }
  const jenStraz = t => !t.dilna && !Object.keys(t.povoleno).some(k => k !== 'hlidat' && t.povoleno[k]);

  // BFS trpaslíka, který se vyhne polím u Spáče: první cíl, jinak nejvzdálenější pole (dál než min) – { cesta }
  function cestaPryc(hra, start, si, cil, min) {
    const pred = new Map([[start, -1]]), pres = new Map(), fronta = [start];
    let nej = -1, nejV = min;
    const cesta = k => { const c = []; while (k !== start) { c.push(k); if (pres.get(k) >= 0) c.push(pres.get(k)); k = pred.get(k); } return { cesta: c.reverse() }; };
    for (let h = 0; h < fronta.length && h < 4000; h++) {
      const i = fronta[h];
      if (i !== start && C.stojne(hra, i)) {
        if (cil(i)) return cesta(i);
        const v = vzd(i, si); if (v > nejV) { nejV = v; nej = i; }
      }
      C.sousede(hra, i, (j, p) => {
        if (pred.has(j) || vzd(j, si) <= 1 || (p >= 0 && vzd(p, si) <= 1)) return;
        pred.set(j, i); pres.set(j, p); fronta.push(j);
      });
    }
    return nej >= 0 ? cesta(nej) : null;
  }
  // Civilista (kdo není ozbrojený strážce) utíká od probuzeného Spáče – nahoru, aspoň 20 polí od něj.
  // Volá hra.krokTrpaslika po branSe; vrací true, když trpaslíka tento tah řídí útěk.
  function krokCivilisty(hra, t) {
    if (!hra.spac || !hra.spac.probuzen || hra.spac.porazen || strazceSeZbrani(t)) { if (t.utek) t.utek = null; return false; }
    if (t.prace && t.prace.typ === 'zazehnout' && t.zdravi >= ZDRAVI_USTUP) return false;   // kdo zažíhá Výheň, zůstane
    const s = hra.tvorove.find(u => u.id === hra.spac.id);
    if (!s) return false;
    const d = vzd(s.i, t.i);
    if (d > BEZPECI_OD_SPACE) { if (t.utek) t.utek = null; return false; }
    // jídlo a pití nepočká: kdo jde jíst nebo pít, v pásmu 12–20 polí nečeká, a kdo má kritický hlad či žízeň, neutíká
    // ani blíž (jinak klan během dlouhého finále umíral žízní, když Spáč postával mezi ním a pivem)
    const potreba = t.prace && (t.prace.typ === 'pit' || t.prace.typ === 'jist');
    if (potreba && (d > UTEK_OD_SPACE || T.potreby.kriticke(hra, t))) { if (t.utek) t.utek = null; return false; }
    if (d > UTEK_OD_SPACE && !(t.utek && t.utek.length)) {
      // v pásmu 12–20 polí: ke Spáči nejde (práce, která vede k němu, počká)
      if (t.cesta && t.cesta.length && vzd(t.cesta[0], s.i) < d && !(t.prace && t.prace.typ === 'zazehnout')) {
        T.hra.pustPraci(hra, t); t.stav = 'utika'; t.cekej = 20; return true;
      }
      return false;
    }
    while (t.utek && t.utek.length && t.utek[0] === t.i) t.utek.shift();
    if (!t.utek || !t.utek.length || (hra.tik + t.id) % 30 === 0) {
      // nejlépe nahoru a aspoň 20 polí daleko; když to nejde, aspoň co nejdál (o 3 pole víc než teď); kolem Spáče ne
      const sy = s.i / W | 0;
      const r = cestaPryc(hra, t.i, s.i, i => vzd(i, s.i) > BEZPECI_OD_SPACE && (i / W | 0) <= sy, d + 2);
      if (!r || !r.cesta.length) { t.utek = null; return false; }     // není kam – brání se a pracuje dál
      t.utek = r.cesta;
    }
    const dalsi = t.utek[0], typ = C.krok(hra, t.i, dalsi);
    if (!typ) { t.utek = null; return false; }
    t.utek.shift();
    if (t.prace) T.hra.pustPraci(hra, t);
    const dx = dalsi % W - t.i % W; if (dx) t.smer = dx > 0 ? 1 : -1;
    t.o = t.i; t.i = dalsi; t.t = 0; t.dur = T.hra.dobaKroku(typ, t.o, dalsi) || 4; t.stav = 'utika';
    return true;
  }

  // Spáč roste s obranou klanu: odolnost (dělí zásahy) = základní útok všech ozbrojených strážců (bez Rohu hory) / 45,
  // aspoň 1, bez horní meze – silný klan ho neskolí za pár úderů a boj trvá zhruba stejně dlouho; rozhoduje zbroj
  // (kolik ran strážci vydrží) a Roh hory (útok 1,3× se do odolnosti nepočítá). Dřív 1 + 0,15 za strážce nad 3,
  // nejvýš 2 – Spáč padl za 1–2 dny a odhad obrany byl vždy „dobrý". Nastaví se při probuzení.
  const ODOLNOST_UTOK = 45;
  const odolnostSpace = hra => {
    let u = 0;
    for (const t of hra.trpaslici) if (strazceSeZbrani(t)) u += utokTrpaslika(t, null);
    return Math.max(1, Math.round(u / ODOLNOST_UTOK * 100) / 100);
  };
  // síla obrany proti Spáči (pro UI): ozbrojení strážci, jejich útok a zbroj, odhad výsledku
  function silaSpace(hra) {
    const s = spacNa(hra), D = DRUHY.spac;
    return { zdravi: s ? Math.max(0, Math.round(s.zdravi)) : D.zdravi, max: D.zdravi, utok: D.utok, vzhuru: !!s,
             odolnost: s ? s.odolnost || 1 : odolnostSpace(hra) };
  }
  // vlna tvorů z puklin Srdce během zažíhání Výhně (finále): 1 + ozbrojení/3 obří pavouci (nejvýš 4) na okraji Srdce;
  // pavouci z vlny jdou po tom, kdo zažíhá Výheň (u.vlna)
  const pavoukuVeVlne = hra => Math.min(4, 1 + Math.floor(ozbrojenych(hra) / 3));
  function vlnaZHlubin(hra, zprava) {
    const srdce = hra.hora.oblasti.find(o => o.typ === 'srdce'), si = hra.hora.srdce.y * W + hra.hora.srdce.x;
    if (!srdce) return 0;
    const mista = [];
    for (let y = srdce.y; y < srdce.y + srdce.h; y++) for (let x = srdce.x; x < srdce.x + srdce.w; x++) {
      const i = y * W + x; if (hra.hora.teren[i] === M.VZDUCH && C.stojne(hra, i) && vzd(i, si) >= 4) mista.push(i);
    }
    if (!mista.length) return 0;
    const n = pavoukuVeVlne(hra);
    let kde = -1;
    for (let k = 0; k < n; k++) { const u = novyTvor(hra, 'pavouk', mista[Math.floor(nah(hra) * mista.length)]); u.vlna = 1; kde = u.i; }
    zprava('boj', `🕷️ Hora se probouzí – z puklin Srdce lezou obří pavouci (${n})! Braňte toho, kdo zažíhá Výheň.`, kde);
    return n;
  }
  // Odhad finále pro UI (a bota): kolik zdraví obrana snese (strážci nad hranicí ústupu + zažíhající civilista) proti
  // tomu, kolik zranění utrží, než padne Spáč (bije jednoho za 10 tahů = kolo, naráz na něj nejvýš 4 strážci; zbroj
  // tlumí) a zbylé vlny pavouků z puklin Srdce (na ně zbývá polovina útoku strážců; jdou po zažíhajícím a civilistech,
  // zbroj je nechrání). Dřív se vlny ani civilisté nepočítali – odhad byl vždy „dobrý" (poměr 3,5–6), ač právě pavouci
  // zabíjeli nejvíc.
  const VYDRZ_ZAZEHNUTI = 40;
  function silaObrany(hra) {
    const sp = silaSpace(hra), DP = DRUHY.pavouk;
    const st = hra.trpaslici.filter(t => t.povoleno.hlidat), oz = st.filter(t => t.zbran), civilu = hra.trpaslici.length - oz.length;
    let utok = 0, zbroj = 0, vydrz = 0;
    const utoky = [];
    for (const t of oz) {
      const u = utokTrpaslika(t, hra), o = ochrana(t);
      utok += u; zbroj += o; utoky.push(u);
      vydrz += Math.max(0, t.zdravi - ZDRAVI_USTUP);                 // kolik zranění strážce snese, než ustoupí
    }
    if (civilu) vydrz += VYDRZ_ZAZEHNUTI;
    const ochranaPrum = oz.length ? zbroj / oz.length : 0;
    const naraz = utoky.slice().sort((a, b) => b - a).slice(0, 4).reduce((a, x) => a + x, 0);
    const kol = naraz ? sp.zdravi * sp.odolnost / naraz : Infinity;
    const VL = T.pribeh ? T.pribeh.VLNY : [1, 2];
    const vln = VL.filter(v => !(hra.zazehnuti >= v)).length, nVlna = pavoukuVeVlne(hra);
    const kolVln = vln && utok ? vln * nVlna * DP.zdravi / (utok / 2) : 0;
    const zraneni = kol * sp.utok * (1 - ochranaPrum) + kolVln * nVlna * DP.utok;
    const pomer = oz.length ? vydrz / Math.max(1, zraneni) : 0;
    return { strazcu: st.length, ozbrojenych: oz.length, civilu, utok: Math.round(utok), zbroj: Math.round(zbroj * 100) / 100,
             spac: sp, pomer: Math.round(pomer * 100) / 100, kolSpace: Math.round(kol * 10) / 10,
             vlny: { zbyva: vln, pavouku: nVlna, kol: Math.round(kolVln * 10) / 10 },
             odhad: oz.length < SKUPINA_NA_SPACE ? 'málo strážců' : pomer >= ODHAD_DOBRY ? 'dobrý' : pomer >= ODHAD_VYROVNANY ? 'vyrovnaný' : 'špatný' };
  }
  // meze odhadu (bot 24 her: poměr 1,9–2,3 = finále s mediánem 5 padlými → „vyrovnaný")
  const ODHAD_DOBRY = 2.5, ODHAD_VYROVNANY = 1.2;

  function tik(hra, zprava) {
    // za finále nájezd počká, dokud se Výheň opravdu zažíhá: někdo u ní je, nebo zažíhání postoupilo v posledních
    // 2 dnech (dřív po pádu Spáče přišel nájezd uprostřed zažíhání a dorazil klan vyčerpaný finále). Opuštěné zažíhání
    // nájezd neodkládá – dřív stačil živý Spáč a nájezdy se odkládaly navždy.
    if (hra.zazehnuti && !hra.vyhenHori && (hra.tik - (hra.spac.zazTik || 0) < 2 * DEN() || hra.trpaslici.some(t => t.prace && t.prace.typ === 'zazehnout')))
      hra.dalsiNajezd = Math.max(hra.dalsiNajezd, hra.tik + DEN() + 1);
    // nájezdy: den předem varování
    if (hra.tik === hra.dalsiNajezd - DEN() && hra.trpaslici.length) varujNajezd(hra, zprava);
    if (hra.tik >= hra.dalsiNajezd && hra.trpaslici.length) {
      najezd(hra, zprava);
      hra.dalsiNajezd = hra.tik + Math.max(DEN() + 1, Math.round((18 + nah(hra) * 8) * (1 - 0.3 * neklid(hra)) * SIRKA_CAS * DEN()));
      hra.dalsiNajezdTyp = zvolTypNajezdu(hra);
    }
    // obléhání skončí po 2 dnech, nebo když padne poslední obléhající
    if (hra.oblehani && (hra.tik >= hra.oblehani.do || !hra.tvorove.some(u => u.obleh))) {
      hra.oblehani = null;
      for (const u of hra.tvorove) if (u.obleh) delete u.obleh;
    }
    // neklid hory: jednou denně v hlubinách občas vyleze tvor
    if (hra.tik % DEN() === 450 && hra.trpaslici.length && hra.tvorove.length < 6) {
      const nk = neklid(hra);
      if (nk >= 0.5 && nah(hra) < 0.12 * nk) tvorZHlubin(hra, zprava);
    }
    for (const u of hra.tvorove.slice()) if (hra.tvorove.includes(u)) krokTvora(hra, u, zprava);
    // pasti se samy napnou
    if (hra.pastiNapnout.length) hra.pastiNapnout = hra.pastiNapnout.filter(p => { if (p.tik > hra.tik) return true; hra.stavbaStav[p.i] = 0; return false; });
  }

  T.hrozby = { TYPY_NAJEZDU, zvolTypNajezdu, lakadloInfo, trolluNa, mistoPodkopu, SIRKA_SILA, SIRKA_CAS, MAX_SILA, zazehnujici, odolnostSpace, vlnaZHlubin, predpovedNajezdu, mistoNajezdu, jenStraz, uNepritele, znamyNepritel, DRUHY, ZBRAN, ZDRAVI_USTUP, ZDRAVI_LOV, SKUPINA_NA_SPACE, novyTvor, probudJeskyni, najezd, silaNajezdu,
               sestavaNajezdu, neklid, tvorZHlubin, utokTrpaslika, ochrana, branSe, zabijTvora, praceStrazce, krokCivilisty, silaObrany, silaSpace,
               hledejTvor, sousedeTvora, tik, vedle };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
