/* ============================================================
   Srdce hory – pribeh.js: příběh předků, artefakty, Spáč a konec hry.

   Runové desky v ruinách předků přečte kterýkoli trpaslík s povolenou
   prací v dílně. První přečtená deska odemkne runovou kovárnu, druhá
   recepty na artefakty; objevení Srdce hory přidá poslední úlomek.
   Artefakty (každý jen jednou) mají trvalý účinek pro celý klan:
     kladivo – stavba a výroba 1,3× rychleji
     lampa   – v hoře už není úplná tma (světlo aspoň 0,4)
     roh     – útok trpaslíků 1,3×
     klic    – věc; s ní se zažehne Výheň předků = vítězství; ukovat jde
               až po dvou ze tří ostatních artefaktů (dědictví předků)
   Pradávný spáč (kampaň): probudí se, když klan kope v hlubinách
   (od 138 m) nebo objeví Srdce dřív, než má Klíč; jinak až při
   zažehnutí Výhně (finále; nájezdy počkají, dokud Spáč žije).
   Od 130 m hora varuje („hora duní…“), UI dostane pásmo z hloubkaVarovani.
   Konec hry: vítězství (výheň hoří), nebo zahyne celý klan.
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, M, O, UDOLI } = T.hora;
  const P = T.prace, S = T.stavby;

  const HLOUBKA_SPACE = 138, HLOUBKA_VAROVANI = 130, DOBA_ZAZEHNUTI = 600;
  const DEDICTVI = ['kladivo', 'lampa', 'roh'], DEDICTVI_NA_KLIC = 2;   // před Klíčem aspoň 2 ze 3 artefaktů
  const ULOMKY = [
    { nadpis: 'Deska strážců', text: '„Strážili jsme cestu k Srdci. Z hlubin přišel Spáč a my mu zavřeli oči kamenem a písní. ' +
      'Kdo sestoupí k Srdci bez Klíče, probudí ho. Ukujte hvězdnou ocel v runové kovárně – její plán je vyrytý pod touto runou.“',
      odemkne: 'runovaKovarna' },
    { nadpis: 'Deska Síně předků', text: '„Výheň předků hasne, když ji nikdo nekrmí hvězdnou ocelí. Klíč přijme jen klan, který znovu ' +
      'ukoval dědictví předků – aspoň dvě ze tří věcí: kladivo, lampu a roh. Pak ukujte Klíč ze tří hvězdných prutů a šperku, ' +
      'doneste ho do Srdce a zažehněte oheň. Tak se hora znovu probudí – a Spáč s ní. Buďte připraveni.“',
      odemkne: 'artefakty' },
    { nadpis: 'Runy Srdce hory', text: 'Na stěnách Srdce svítí poslední runa: „Oheň, který zažehnete, bude hořet, dokud bude žít klan.“' },
  ];
  const ARTEFAKTY = {
    kladivo: { nazev: 'Durinovo kladivo', ikona: '🔨', popis: 'stavba a výroba celého klanu 1,3× rychleji' },
    lampa:   { nazev: 'Lampa předků', ikona: '🏮', popis: 'v hoře už není úplná tma' },
    roh:     { nazev: 'Roh hory', ikona: '📯', popis: 'útok všech trpaslíků 1,3×' },
    klic:    { nazev: 'Klíč k Srdci', ikona: '🗝️', popis: 'zažehne Výheň předků' },
  };

  const kampan = hra => hra.rezim !== 'volny';
  function zprava(hra, typ, text, i) { T.hra.zprava(hra, typ, text, i); }

  // úlomek příběhu (další v pořadí) a jeho odemčení
  function prectiUlomek(hra, k) {
    if (hra.prectene.includes(k)) return;
    hra.prectene.push(k);
    const u = ULOMKY[k];
    zprava(hra, 'pribeh', `📜 ${u.nadpis}: ${u.text}`);
    if (u.odemkne) { hra.odemceno[u.odemkne] = true; zprava(hra, 'objev', u.odemkne === 'runovaKovarna' ? 'Odemčeno: runová kovárna (🔨 stavět).' : 'Odemčeno: artefakty v runové kovárně.'); }
    // první deska ukáže cestu: kde leží další ruiny (druhá deska odemyká artefakty) a pásmo sloupců Srdce hory
    if (k === 0 && kampan(hra)) { odhalStopy(hra, true, true); const v = voditko(hra); if (v.text) zprava(hra, 'pribeh', '🧭 ' + v.text, v.i); }
  }
  function prectiDesku(hra, i) {
    if (hra.deskyPrectene.includes(i)) return;
    hra.deskyPrectene.push(i);
    prectiUlomek(hra, hra.prectene.includes(0) ? 1 : 0);
    hra.slavaBonus = (hra.slavaBonus || 0) + 10;     // přečtená deska předků: sláva (dřív +5 – milníky 300/400 byly nedosažitelné)
  }
  // co lze v runové kovárně vyrobit (recepty se ukazují až po odemčení)
  function artefaktZakazany(hra, vyrobek) {
    const k = vyrobek.startsWith('art_') ? vyrobek.slice(4) : null;
    if (!k) return false;
    if (!hra.odemceno.artefakty) return true;
    if (k === 'klic' && !klicPodminka(hra).ok) return true;
    return !!hra.artefakty[k] || (k === 'klic' && hra.veci.some(v => v.druh === 'klic'));
  }
  // Klíč jde ukovat až po 2 ze 3 artefaktů; { ok, ma, chybi: text pro UI }
  function klicPodminka(hra) {
    const ma = DEDICTVI.filter(k => hra.artefakty[k]).length;
    const ok = ma >= DEDICTVI_NA_KLIC;
    return { ok, ma, potreba: DEDICTVI_NA_KLIC,
             chybi: ok ? '' : `Klíč jde ukovat až po ${DEDICTVI_NA_KLIC} ze 3 artefaktů (kladivo, lampa, roh) – hotovo ${ma}.` };
  }
  // --- vodítko: kam dál hledat (ruiny s deskou, Srdce hory) – „Co dál?", zprávy a UI ------------------------------
  // Stopy (ukládají se v hra.odemceno): stopaRuin = čísla ruin, na které ukázala deska či hlas hlubin (pásmo sloupců
  // a hloubka), stopaSrdce = pásmo sloupců Srdce (z první desky nebo hlasu hlubin); hotový Klíč „táhne" k Srdci přesně.
  // Dřív „Co dál?" říkalo jen „≈150 m": 6 ze 14 nedohraných her mělo Klíč a Srdce nenašlo, 6 nepřečetlo druhou desku.
  function odhalStopy(hra, ruiny, srdce) {
    const o = hra.odemceno;
    if (ruiny) o.stopaRuin = hra.hora.ruiny.filter(r => !hra.objeveno[r.cislo]).map(r => r.cislo);
    if (srdce) o.stopaSrdce = 1;
  }
  const PASMO = 8;                                   // pásmo sloupců (± polí) u stopy
  function smerOd(hra, x) {
    const dx = x - hra.hora.brana.x;
    return { smer: dx < 0 ? 'vlevo' : 'vpravo', dx: Math.abs(dx) };
  }
  const deskaRuiny = (hra, r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (hra.hora.obj[y * W + x] === O.DESKA) return y * W + x; return -1; };
  // { cil: 'deska'|'ruiny'|'srdce'|'vyhen'|null, smer: 'vlevo'|'vpravo'|null, x, y (pole, když je místo přesné), i (pole cíle pro
  //   skok v UI), xOd, xDo (pásmo sloupců), hloubka (m), presne, text }
  function voditko(hra) {
    const r0 = { cil: null, smer: null, presne: false, text: '' };
    if (!kampan(hra) || hra.vyhenHori) return r0;
    const hl = y => y - UDOLI;
    // 1) nepřečtená deska v objevených ruinách
    for (const r of hra.hora.ruiny) {
      const d = deskaRuiny(hra, r);
      if (d < 0 || hra.deskyPrectene.includes(d) || !hra.objeveno[r.cislo]) continue;
      if (hra.prectene.length >= 2) break;
      const sm = smerOd(hra, d % W);
      return { cil: 'deska', smer: sm.smer, x: d % W, y: d / W | 0, i: d, hloubka: hl(d / W | 0), presne: true,
               text: `Runová deska v ruinách (${hl(d / W | 0)} m, ${sm.dx} polí ${sm.smer} od brány) čeká na přečtení – dojde k ní řemeslník.` };
    }
    // 2) ruiny, dokud nejsou přečtené obě desky (druhá odemyká artefakty)
    if (hra.prectene.length < 2) {
      const stopa = (hra.odemceno.stopaRuin || []);
      const r = hra.hora.ruiny.find(r => !hra.objeveno[r.cislo] && stopa.includes(r.cislo));
      if (r) {
        const xc = r.x + (r.w >> 1), sm = smerOd(hra, xc), od = Math.max(1, xc - PASMO), do_ = Math.min(W - 2, xc + PASMO);
        return { cil: 'ruiny', smer: sm.smer, xOd: od, xDo: do_, hloubka: hl(r.y + r.h - 2), i: (r.y + r.h - 2) * W + xc, presne: false,
                 text: `Runy ukazují na ${hra.prectene.length ? 'další ' : ''}ruiny předků: kolem ${hl(r.y + r.h - 2)} m, ${Math.max(0, sm.dx - PASMO)}–${sm.dx + PASMO} polí ${sm.smer} od brány.` };
      }
      if (!hra.prectene.length) return { cil: 'ruiny', smer: null, presne: false, text: 'Ruiny předků leží hluboko (60–125 m) – průzkumné štoly do stran je najdou.' };
    }
    // 3) Srdce hory, dokud není objevené
    const sr = hra.hora.srdce, si = sr.y * W + sr.x;
    if (hra.znamo[si]) return hra.veci.some(v => v.druh === 'klic') ? { cil: 'vyhen', smer: null, x: sr.x, y: sr.y, i: si, hloubka: hl(sr.y), presne: true,
      text: 'Srdce hory je otevřené – dones Klíč k Výhni předků.' } : r0;
    const klic = hra.veci.find(v => v.druh === 'klic');
    if (klic) {
      const kde = klic.nese ? (hra.trpaslici.find(t => t.id === klic.nese) || {}).i ?? klic.i : klic.i;
      const dx = sr.x - kde % W, dy = sr.y - (kde / W | 0), d = Math.round(Math.hypot(dx, dy));
      return { cil: 'srdce', smer: dx < 0 ? 'vlevo' : 'vpravo', x: sr.x, y: sr.y, i: si, hloubka: hl(sr.y), presne: true, vzdalenost: d,
               text: `🗝️ Klíč táhne ${dx ? `${Math.abs(dx)} polí ${dx < 0 ? 'vlevo' : 'vpravo'}` : 'přímo'}${dy > 0 ? ` a ${dy} m dolů` : dy < 0 ? ` a ${-dy} m nahoru` : ''} (~${d} polí) – Srdce hory leží v ${hl(sr.y)} m, ${smerOd(hra, sr.x).dx} polí ${smerOd(hra, sr.x).smer} od brány.` };
    }
    if (hra.odemceno.stopaSrdce) {
      const sm = smerOd(hra, sr.x), od = Math.max(1, sr.x - PASMO), do_ = Math.min(W - 2, sr.x + PASMO);
      return { cil: 'srdce', smer: sm.smer, xOd: od, xDo: do_, hloubka: hl(sr.y), i: si, presne: false,
               text: `Srdce hory leží v ~${hl(sr.y)} m, ${Math.max(0, sm.dx - PASMO)}–${sm.dx + PASMO} polí ${sm.smer} od brány (Klíč pak ukáže přesně).` };
    }
    return { cil: 'srdce', smer: null, presne: false, hloubka: hl(sr.y), text: `Srdce hory leží hluboko (~${hl(sr.y)} m) – směr prozradí runová deska.` };
  }

  // --- volba artefaktů: které 2 ze 3 ukovat před Klíčem ---------------------------------------------------------
  // hráč (UI) zvolí dvojici – uloží se v hra.odemceno.volbaArt; null = automaticky. Výchozí pořadí: když nájezdy bolí
  // (padlých v boji aspoň 4 nebo 15 % nejvyššího počtu klanu), Roh hory napřed (útok 1,3×), jinak kladivo a lampa.
  // Dřív bylo pořadí pevné (kladivo, lampa) a Roh nevznikl ani v jedné hře bota.
  function zvolArtefakty(hra, par) {
    if (par === null || par === undefined) { delete hra.odemceno.volbaArt; return true; }
    if (!Array.isArray(par) || par.length !== DEDICTVI_NA_KLIC || par[0] === par[1] || !par.every(k => DEDICTVI.includes(k))) return false;
    hra.odemceno.volbaArt = par.slice();
    return true;
  }
  function nabizeneArtefakty(hra) {
    const boj = (hra.padloPodle && hra.padloPodle.boj) || 0;
    const boli = boj >= 4 || boj >= 0.15 * (hra.maxTrp || 7);
    // Roh potřebuje stříbrný pohár: bez nalezeného stříbra by kusovník čekal na nemožné
    const stribro = !!hra.nalezeno.stribro || hra.veci.some(v => v.druh === 'stribro' || v.druh === 'prut_stribro' || v.druh === 'pohar');
    // Roh i tehdy, když na finále (Spáč s vlnami pavouků je nejtěžší boj hry) chybí obrněná stráž – méně než 6 strážců
    // se zbraní i zbrojí (stálé měřítko: odhad obrany kolísá se zraněními a volba by přeskakovala)
    const finale = hra.trpaslici.filter(t => t.povoleno.hlidat && t.zbran && t.zbroj).length < 6;
    if ((boli || finale) && stribro) return { poradi: ['roh', 'kladivo', 'lampa'], duvod: boli ? `nájezdy bolí (padlých v boji ${boj}) – Roh hory zvedne útok všech o 30 %` : 'obrana na finále se Spáčem není dobrá – Roh hory zvedne útok všech o 30 %' };
    return { poradi: DEDICTVI.slice(), duvod: boli || finale ? 'Roh by pomohl, ale chce stříbrný pohár a stříbro klan ještě nenašel' : 'klan je v bezpečí – kladivo a lampa urychlí práci' };
  }
  // { zvoleno: [a, b] | null, doporuceno: [a, b], poradi, duvod } pro UI
  function volbaArtefaktu(hra) {
    const n = nabizeneArtefakty(hra), z = hra.odemceno.volbaArt || null;
    return { zvoleno: z ? z.slice() : null, doporuceno: n.poradi.slice(0, DEDICTVI_NA_KLIC), poradi: z ? z.concat(DEDICTVI.filter(k => !z.includes(k))) : n.poradi, duvod: z ? 'volba hráče' : n.duvod };
  }

  // --- kusovník Klíče: co je ještě potřeba od teď po hotový Klíč -------------------------------------------------
  // Klíč = 3 hvězdné pruty + šperk (zlatý prut + drahokam); předtím 2 ze 3 artefaktů (2 hvězdné pruty + železný prut /
  // broušený drahokam / stříbrný pohár); runová kovárna 2 zlaté pruty. Hvězdný prut = hvězdná ruda + uhlí, zlatý, stříbrný
  // a železný prut = ruda + uhlí (magmatická výheň bez uhlí). Rozpracované výrobky v dílnách se počítají, jako by už byly.
  // Vrací null (Klíč nic nepotřebuje: volný režim, nečtená deska, Klíč hotový) nebo
  // { polozky: [{ druh, nazev, ikona, potreba, ma, chybi, nedosazitelne }], chybi: {druh: n}, drzet: {druh: n}, artefakty: [...] }
  // sDosahem = spočítat i kusy, ke kterým se ze skladu nedá dojít (BFS – pro UI a „Co dál?"; logika ho nepotřebuje)
  const KUS_PORADI = ['prut_hvezdny', 'hvezdna', 'sperk', 'prut_zlato', 'zlato', 'drahokam', 'brus', 'pohar', 'prut_stribro', 'stribro', 'prut_zelezo', 'zelezo', 'uhli'];
  const ART_VSTUP = { kladivo: 'prut_zelezo', lampa: 'brus', roh: 'pohar' };
  function kusovnikKlice(hra, sDosahem) {
    if (!kampan(hra) || hra.vyhenHori || hra.artefakty.klic || !hra.odemceno.runovaKovarna) return null;
    const ma = {};
    for (const v of hra.veci) ma[v.druh] = (ma[v.druh] || 0) + 1;
    // rozpracované výrobky: donesený materiál se počítá jako výrobek (jinak by zmizel z kusovníku)
    for (const d of hra.dilny) for (const m of [d, d.m2]) {
      if (!m || !m.vRobe) continue;
      const z = d.fronta.find(z => z.id === m.vRobe.zak); if (!z) continue;
      const rc = S.RECEPTY[d.typ][z.r];
      if (!Object.values(m.vRobe.doneseno).some(n => n > 0)) continue;
      // materiál na cestě do dílny je už součástí počítaného výrobku (dřív se uhlí nesené do kovárny počítalo dvakrát:
      // jako uhlí i jako hotový prut)
      for (const [druh, n] of Object.entries(m.vRobe.vCeste || {})) if (n > 0) ma[druh] = Math.max(0, (ma[druh] || 0) - n);
      if (rc.vyrobek.startsWith('art_')) { if (!hra.artefakty[rc.vyrobek.slice(4)]) ma[rc.vyrobek] = 1; }
      else ma[rc.vyrobek] = (ma[rc.vyrobek] || 0) + (rc.pocet || 1);
    }
    // které artefakty ještě (2 ze 3): rozpracovaný, pak podle volby hráče / doporučeného pořadí (volbaArtefaktu)
    const hotovo = DEDICTVI.filter(k => hra.artefakty[k] || ma['art_' + k]);
    const zbyva = Math.max(0, DEDICTVI_NA_KLIC - hotovo.length);
    // (po rozpracovaných: zvolená dvojice / doporučené pořadí – viz volbaArtefaktu; dřív rozhodoval přídavný materiál
    // na skladě – železné pruty jsou vždy, takže vzniklo vždy kladivo a lampa)
    const vol = volbaArtefaktu(hra), por = vol.poradi;
    const kandidati = DEDICTVI.filter(k => !hotovo.includes(k)).sort((a, b) => por.indexOf(a) - por.indexOf(b));
    const artefakty = kandidati.slice(0, zbyva);
    const potreba = { prut_hvezdny: 3 + 2 * artefakty.length, sperk: 1 };
    for (const k of artefakty) potreba[ART_VSTUP[k]] = (potreba[ART_VSTUP[k]] || 0) + 1;
    if (!hra.dilny.some(d => d.typ === 'runova_kovarna')) {
      const pl = hra.plany.find(p => p.typ === 'runova_kovarna');
      potreba.prut_zlato = 2 - (pl ? pl.doneseno.prut_zlato || 0 : 0);
    }
    const vyhen = hra.dilny.some(d => d.typ === 'magmovyhen');
    const chybi = {};
    const pridej = (druh, n) => { if (n > 0) potreba[druh] = (potreba[druh] || 0) + n; };
    const spocti = druh => (chybi[druh] = Math.max(0, (potreba[druh] || 0) - (ma[druh] || 0)));
    // od výrobků k surovinám
    pridej('hvezdna', spocti('prut_hvezdny')); pridej('uhli', chybi.prut_hvezdny);
    pridej('prut_zlato', spocti('sperk')); pridej('drahokam', chybi.sperk);
    pridej('drahokam', spocti('brus'));
    pridej('prut_stribro', spocti('pohar'));
    for (const [prut, ruda] of [['prut_zlato', 'zlato'], ['prut_stribro', 'stribro'], ['prut_zelezo', 'zelezo']]) {
      pridej(ruda, spocti(prut)); if (!vyhen) pridej('uhli', chybi[prut]);
    }
    for (const druh of ['hvezdna', 'zlato', 'stribro', 'zelezo', 'drahokam', 'uhli']) spocti(druh);
    // co držet stranou pro příběh (dílny to nedají trvalým zakázkám): suroviny a pruty, které kusovník potřebuje,
    // uhlí jen na rudu, která už leží (hvězdná, zlatá, stříbrná) – ať trvalé zakázky nestojí kvůli rudě, co ještě není
    const drzet = {};
    for (const druh of ['hvezdna', 'zlato', 'stribro', 'drahokam', 'prut_zlato', 'prut_stribro', 'brus', 'pohar', 'sperk', 'prut_hvezdny'])
      if (potreba[druh]) drzet[druh] = Math.min(ma[druh] || 0, potreba[druh]);
    if (potreba.prut_zelezo) drzet.prut_zelezo = Math.min(ma.prut_zelezo || 0, potreba.prut_zelezo);
    const uhliNaRudu = Math.min(ma.hvezdna || 0, chybi.prut_hvezdny) + (vyhen ? 0 : Math.min(ma.zlato || 0, chybi.prut_zlato || 0) + Math.min(ma.stribro || 0, chybi.prut_stribro || 0));
    if (uhliNaRudu) drzet.uhli = Math.min(ma.uhli || 0, uhliNaRudu);
    // kusy, ke kterým se nedá dojít (spadlé do jámy…)
    const nedos = {};
    if (sDosahem) {
      const F = T.hra.dosahSkladuTik(hra);
      if (F) for (const v of hra.veci) if (!v.nese && potreba[v.druh] && !T.hra.dosazitelna(hra, v, F)) nedos[v.druh] = (nedos[v.druh] || 0) + 1;
    }
    const polozky = KUS_PORADI.filter(d => potreba[d] > 0).map(druh => ({ druh, nazev: P.VECI[druh].nazev, ikona: P.VECI[druh].ikona,
      potreba: potreba[druh], ma: Math.min(ma[druh] || 0, potreba[druh]), chybi: chybi[druh] || 0, nedosazitelne: nedos[druh] || 0 }));
    return { polozky, chybi, drzet, artefakty, potreba };
  }
  // krátký text kusovníku pro „Co dál?" (jen co chybí nebo leží nedostupně; hvězdná ocel vždy)
  function kusovnikText(hra) {
    const k = kusovnikKlice(hra, true);
    if (!k) return '';
    const casti = k.polozky.filter(p => p.druh === 'prut_hvezdny' || p.chybi || p.nedosazitelne)
      .map(p => `${p.ikona} ${p.nazev} ${p.ma}/${p.potreba}` + (p.nedosazitelne ? ` (${p.nedosazitelne} nedostupn${p.nedosazitelne === 1 ? 'ý kus' : 'é kusy'} – žebřík k nim)` : ''));
    return casti.length ? 'Kusovník Klíče: ' + casti.join(' · ') + (k.artefakty.length ? ` (artefakty: ${k.artefakty.map(a => ARTEFAKTY[a].ikona).join(' ')})` : '') : '';
  }
  // vyrobený artefakt: klíč je věc, ostatní se zapíšou jako trvalý účinek
  function vyroben(hra, druh, i) {
    const k = druh.slice(4);
    if (k === 'klic') { P.novaVec(hra, 'klic', i, 0); hra.artefakty.klic = true; }
    else hra.artefakty[k] = true;
    hra.svetloZmena++;
    hra.slavaBonus = (hra.slavaBonus || 0) + 25;
    zprava(hra, 'objev', `✨ ${ARTEFAKTY[k].ikona} ${ARTEFAKTY[k].nazev} je hotov – ${ARTEFAKTY[k].popis}!`);
    if (k === 'klic' && kampan(hra) && !hra.znamo[hra.hora.srdce.y * W + hra.hora.srdce.x]) { const v = voditko(hra); if (v.text) zprava(hra, 'pribeh', v.text, v.i); }
  }
  // kladivo: stavba a výroba 1,3×; milník slávy 500 (cech mistrů): výroba 1,15×
  const faktor = (hra, prace) => ((hra.artefakty.kladivo && (prace === 'stavet' || prace === 'vyrobit')) ? 1.3 : 1) *
    (prace === 'vyrobit' && hra.odemceno && hra.odemceno.slava500 ? 1.15 : 1);
  const utokKlanu = hra => hra.artefakty.roh ? 1.3 : 1;

  // --- Spáč ---------------------------------------------------------------------------------
  function probudSpace(hra, proc) {
    if ((!kampan(hra) && proc !== 'vyzva') || hra.spac.probuzen) return;
    hra.spac.probuzen = true;
    const srdce = hra.hora.oblasti.find(o => o.typ === 'srdce');
    const mista = [];
    for (let y = srdce.y; y < srdce.y + srdce.h; y++) for (let x = srdce.x; x < srdce.x + srdce.w; x++) {
      const i = y * W + x; if (hra.hora.teren[i] === M.VZDUCH && T.cesty.stojne(hra, i)) mista.push(i);
    }
    const s = T.hrozby.novyTvor(hra, 'spac', mista[Math.floor(P.nahoda(hra) * mista.length)] || hra.hora.srdce.y * W + hra.hora.srdce.x);
    if (proc === 'vyzva') {                          // volný režim: Spáč jako volitelný boss (hráč ho vyzval)
      hra.spac.id = s.id; s.odolnost = T.hrozby.odolnostSpace(hra);
      T.hra.zvuk(hra, 'rev', s.i);
      zprava(hra, 'boj', '🌋 Klan vyzval PRADÁVNÉHO SPÁČE! Probouzí se v Srdci hory. Ozbrojení strážci na něj jdou aspoň ve třech, ostatní utíkají.', s.i);
      return;
    }
    hra.spac.id = s.id;
    s.odolnost = T.hrozby.odolnostSpace(hra);       // silnější obrana klanu = odolnější Spáč
    // předčasné probuzení má trvalou cenu: hora je neklidná (častější a silnější nájezdy, tvorové z hlubin)
    if (proc === 'brzy') hra.spac.brzy = true;
    T.hra.zvuk(hra, 'rev', s.i); T.hra.zvuk(hra, 'zaval', s.i, 12);
    zprava(hra, 'boj', (proc === 'brzy'
      ? '🌋 Země se zachvěla. Kopali jste příliš hluboko příliš brzy – v Srdci hory otevřel oči PRADÁVNÝ SPÁČ!'
      : '🌋 Výheň se rozhořívá a hora duní. PRADÁVNÝ SPÁČ se probouzí – braňte oheň!') +
      ' Kdo nemá zbraň, utíká nahoru; ozbrojení strážci se shromáždí a zaútočí aspoň ve třech.', s.i);
  }
  // volný režim: Spáč jako volitelný boss – vyzvat ho jde, když je Srdce hory objevené a Spáč ještě nebojoval
  const lzeVyzvatSpace = hra => !kampan(hra) && !hra.spac.probuzen && !!hra.znamo[hra.hora.srdce.y * W + hra.hora.srdce.x];
  function vyzviSpace(hra) { if (!lzeVyzvatSpace(hra)) return false; probudSpace(hra, 'vyzva'); return true; }
  function spacPorazen(hra) {
    hra.spac.porazen = true;
    hra.slavaBonus = (hra.slavaBonus || 0) + 40;
    zprava(hra, 'objev', '🏆 Pradávný spáč padl! Hora je volná.', hra.hora.srdce.y * W + hra.hora.srdce.x);
  }
  // volá se z prace.vykopej (hloubka) a při objevení Srdce
  function hlidejHloubku(hra, c) {
    if (!kampan(hra) || hra.spac.probuzen || hra.veci.some(v => v.druh === 'klic') || hra.zazehnuti) return;
    const hl = (c / W | 0) - UDOLI;
    if (hl >= HLOUBKA_SPACE) { probudSpace(hra, 'brzy'); return; }
    // varování nejvýš jednou za 3 dny (čas posledního v hra.spac.duni)
    if (hl >= HLOUBKA_VAROVANI && !(hra.spac.duni > hra.tik - 3 * T.hra.TAHU_ZA_DEN)) {
      hra.spac.duni = hra.tik;
      zprava(hra, 'varovani', `🌋 Hora duní… V ${hl} m je pod nohama horníků cítit těžký dech. Hlouběji než ${HLOUBKA_SPACE} m bez Klíče se Spáč probudí!`);
    }
  }
  // pásmo varování pro UI: hloubky v m a řádky mapy; aktivni = kopáním pod prah by se Spáč probudil
  function hloubkaVarovani(hra) {
    const aktivni = kampan(hra) && !hra.spac.probuzen && !hra.zazehnuti && !hra.veci.some(v => v.druh === 'klic');
    return { od: HLOUBKA_VAROVANI, prah: HLOUBKA_SPACE, yOd: UDOLI + HLOUBKA_VAROVANI, yPrah: UDOLI + HLOUBKA_SPACE, aktivni };
  }
  // probudí kopání pole v řádku y Spáče? (UI: potvrzení při označení)
  const budiSpace = (hra, y) => hloubkaVarovani(hra).aktivni && y - UDOLI >= HLOUBKA_SPACE;
  function objevenoSrdce(hra) {
    prectiUlomek(hra, 2);
    if (!hra.veci.some(v => v.druh === 'klic')) probudSpace(hra, 'brzy');
  }

  // --- zažehnutí a konec -------------------------------------------------------------------------
  // během zažíhání se hora probouzí: dvě vlny tvorů z puklin Srdce (VLNY = hodnoty hra.zazehnuti)
  const VLNY = [150, 380];
  function zazehni(hra, t) {                        // volá práce 'zazehnout' každý tah na místě
    if (!hra.zazehnuti) { hra.zazehnuti = 1; zprava(hra, 'pribeh', `🔥 ${t.jmeno} vkládá Klíč do Výhně předků…`, t.i); if (!hra.spac.porazen) probudSpace(hra, 'finale'); }
    hra.zazehnuti++;
    hra.spac.zazTik = hra.tik;                     // kdy se naposledy zažíhalo (nájezdy během zažíhání čekají – hrozby.tik)
    if (VLNY.includes(hra.zazehnuti) && kampan(hra)) T.hrozby.vlnaZHlubin(hra, (typ, text, i) => zprava(hra, typ, text, i));
    if (hra.zazehnuti >= DOBA_ZAZEHNUTI) {
      hra.vyhenHori = true; hra.svetloZmena++;
      const v = hra.veci.find(v => v.druh === 'klic'); if (v) hra.veci.splice(hra.veci.indexOf(v), 1);
      hra.slavaBonus = (hra.slavaBonus || 0) + 60;
      zprava(hra, 'objev', '🔥🔥🔥 VÝHEŇ PŘEDKŮ HOŘÍ! Srdce hory znovu bije.', hra.hora.srdce.y * W + hra.hora.srdce.x);
      T.hra.zvuk(hra, 'fanfara');
      if (kampan(hra) && !hra.konec) konec(hra, true);
      return true;
    }
    return false;
  }
  function statistiky(hra) {
    return {
      dni: T.hra.den(hra), roky: T.obdobi.rok(hra), zije: hra.trpaslici.length, nejvic: hra.maxTrp || hra.trpaslici.length,
      padlo: hra.padlo || 0, padloPodle: Object.assign({}, hra.padloPodle || {}), slava: T.obdobi.spocitejSlavu(hra), hloubka: hra.nejhloubeji, vykopano: hra.vykopano,
      zabito: hra.zabito || 0, najezdu: hra.najezdu || 0, artefakty: Object.keys(hra.artefakty).length,
      spac: hra.spac.porazen ? 'poražen' : hra.spac.probuzen ? 'žije' : 'spí',
    };
  }
  function konec(hra, vitezstvi) {
    hra.konec = { vitezstvi, tik: hra.tik, stat: statistiky(hra) };
    zprava(hra, vitezstvi ? 'objev' : 'smrt', vitezstvi ? 'KONEC HRY: vítězství! Srdce hory bije.' : 'KONEC HRY: v hoře už nežije žádný trpaslík.');
  }
  function epilog(hra) {
    const s = hra.konec.stat;
    if (!hra.konec.vitezstvi) return `Hora ${hra.hora.nazev} znovu utichla. Klan vydržel ${s.dni} dní; nejhlouběji došel do ${s.hloubka} m. ` +
      'Možná jednou přijdou jiní a najdou po něm schody, dílny a vyhaslé louče.';
    return `Po ${s.dni} dnech (${s.roky}. rok) zažehl klan Výheň předků v Srdci hory ${hra.hora.nazev}. ` +
      (s.spac === 'poražen' ? 'Pradávný spáč leží poražen a ' : '') +
      `v síních žije ${s.zije} trpaslíků. Písně o jejich slávě (${s.slava}) se ponesou horami ještě stovky let.`;
  }

  // --- výukové úkoly „Co dál?" ----------------------------------------------------------------
  // první nesplněný krok od založení kolonie po zažehnutí Výhně; null = vše hotovo
  const maDilnu = (hra, typ) => hra.dilny.some(d => d.typ === typ);
  const pocetStaveb = (hra, k) => { let n = 0; for (const v of hra.stavba) if (v === k) n++; return n; };
  const maZonu = (hra, ...typy) => hra.zony.some(z => typy.includes(z.typ));
  const UKOLY = [
    { text: '⛏️ Označ ke kopání místnost za bránou (K) – aspoň 20 polí, nejvýš 2 pole vysoko (vyšší síň potřebuje podpěry).', hotovo: h => h.vykopano >= 20 },
    { text: '🪚 Postav tesařskou dílnu (B) – vyrábí postele, stoly a židle.', hotovo: h => maDilnu(h, 'tesarna') },
    { text: '🛏️ Vyznač ložnici (Z) a postav do ní aspoň 3 postele.', hotovo: h => maZonu(h, 'loznice') && pocetStaveb(h, S.K.POSTEL) >= 3 },
    { text: '🍄 Založ houbárnu nebo pole (Z) a postav kuchyni.', hotovo: h => maZonu(h, 'houbarna', 'pole') && maDilnu(h, 'kuchyne') },
    { text: '🍺 Postav pivovar – bez piva trpaslíci ztrácejí náladu.', hotovo: h => maDilnu(h, 'pivovar') },
    { text: '🔥 Rozvěš louče – ve tmě se pracuje pomalu a špatně spí.', hotovo: h => pocetStaveb(h, S.K.LOUC) >= 2 },
    { text: '🪜 Vytesej schodiště (L) do hloubky aspoň 30 m.', hotovo: h => h.nejhloubeji >= 30 },
    { text: '🧱 Najdi železnou rudu (48–105 m) a postav tavírnu.', hotovo: h => h.nalezeno.zelezo && maDilnu(h, 'tavirna') },
    { text: '⚔️ Postav kovárnu a zbrojnici, zapni práci ⚔️ stráž a vyzbroj je – goblini přijdou.', hotovo: h => maDilnu(h, 'kovarna') && h.trpaslici.some(t => t.povoleno.hlidat && t.zbran) },
    { text: '📜 Najdi ruiny předků (kolem 80–130 m) a přečti runovou desku.', hotovo: h => h.prectene.length >= 1 },
    { text: '✴️ Postav runovou kovárnu (potřebuje 2 zlaté pruty; zlato leží v 80–140 m).', hotovo: h => maDilnu(h, 'runova_kovarna') },
    { text: '📜 Přečti druhou desku (Síň předků) – odemkne artefakty.', hotovo: h => !!h.odemceno.artefakty },
    { text: '🟣 Vytěž hvězdnou rudu (126–137 m, hlouběji budíš Spáče) – na 2 artefakty a Klíč je potřeba 7 hvězdných prutů.',
      hotovo: h => h.veci.filter(v => v.druh === 'prut_hvezdny').length + 2 * DEDICTVI.filter(k => h.artefakty[k]).length >= 7 || !!h.artefakty.klic },
    { text: '✨ Ukuj 2 ze 3 artefaktů: 🔨 kladivo (+ železný prut), 🏮 lampa (+ broušený drahokam), 📯 roh (+ pohár).', hotovo: h => klicPodminka(h).ok || !!h.artefakty.klic },
    { text: '🗝️ Vybrus šperk (brusírna: zlatý prut + drahokam) a ukuj v runové kovárně Klíč k Srdci.', hotovo: h => !!h.artefakty.klic },
    { text: '❤️‍🔥 Prokopej se do Srdce hory (≈150 m) – připrav strážce, Spáč se probudí.', hotovo: h => !!h.znamo[h.hora.srdce.y * W + h.hora.srdce.x] },
    { text: '🔥 Dones Klíč k Výhni předků a ubraň ji, dokud se nerozhoří.', hotovo: h => !!h.vyhenHori },
  ];
  // kroky kampaně, u kterých se ukazuje kusovník Klíče (runová kovárna … Klíč)
  const KROKY_KUSOVNIKU = new Set([10, 11, 12, 13, 14]);
  // volný režim: po základech (prvních 9 krocích) cíle pro dlouhou hru – hloubka, velká síň, opevnění, sláva
  const velkaSin = h => h.zony.some(z => { if (z.typ !== 'jidelna') return false; const k = S.kvalitaZony(h, z.id); return k.polí >= 24 && k.podilZdi >= 0.6 && k.sochy >= 2; });
  const ozbrojenych = h => h.trpaslici.filter(t => t.povoleno.hlidat && t.zbran).length;
  const VOLNE_CILE = [
    { text: '⛏️ Prokopej se do hloubky 80 m – hlouběji leží zlato, stříbro a drahokamy.', hotovo: h => h.nejhloubeji >= 80 },
    { text: '🏛️ Vybuduj velkou síň: jídelnu aspoň 24 polí s otesanými stěnami (60 %) a 2 sochami.', hotovo: velkaSin },
    { text: '🛡️ Opevni horu: dveře nebo padací mříž, aspoň 2 pasti a 4 ozbrojení strážci.', hotovo: h => (pocetStaveb(h, S.K.DVERE) + pocetStaveb(h, S.K.MRIZ)) >= 1 && pocetStaveb(h, S.K.PAST) >= 2 && ozbrojenych(h) >= 4 },
    { text: '⛏️ Hloubkový rekord: 140 m – v hlubinách čeká hvězdná ruda.', hotovo: h => h.nejhloubeji >= 140 },
    { text: '🎺 Dosáhni slávy 250 – bardi začnou zpívat o vašem klanu.', hotovo: h => (h.slava || 0) >= 250 },
    { text: '👑 Dosáhni slávy 330 – králové hor pošlou čestnou stráž.', hotovo: h => (h.slava || 0) >= 330 },
    // pozdní hra volného režimu
    { text: '🗡️ Vyčisti goblinní tunel (135–155 m): objev ho, pobij gobliny a obsaď ho – nájezdy tudy přestanou (sláva +20).', hotovo: h => !!h.odemceno.tunelVycisten },
    { text: '⛏️ Hloubkový rekord: 155 m – až ke kořenům hory.', hotovo: h => h.nejhloubeji >= 155 },
    { text: '🎺 Dosáhni slávy 500 – cech mistrů zrychlí dílny.', hotovo: h => (h.slava || 0) >= 500 },
    { text: '🌋 Najdi Srdce hory (~150 m) a vyzvi Pradávného spáče – volitelný boss (sláva +40). Připrav zbroj a strážce.', hotovo: h => !!h.spac.porazen },
    { text: '👑 Dosáhni slávy 650 – legenda hor.', hotovo: h => (h.slava || 0) >= 650 },
  ];
  // nekonečné cíle volného režimu po splnění všech: další stovka slávy a další desítka odražených nájezdů
  function opakovanyCil(hra) {
    const s = (Math.floor((hra.slava || 0) / 100) + 1) * 100, nj = (Math.floor((hra.najezdu || 0) / 10) + 1) * 10;
    return { text: `♾️ Sláva ${s} (teď ${hra.slava || 0}) · přežij ${nj}. nájezd (teď ${hra.najezdu || 0}) – hora nikdy nespí.`, opakovany: true, slava: s, najezdu: nj };
  }
  // krok kampaně, u kterého se ukazuje vodítko (ruiny, druhá deska, Srdce)
  const KROKY_VODITKA = new Set([9, 11, 15]);
  function coDal(hra) {
    const volny = hra.rezim === 'volny', zaklad = volny ? UKOLY.length - 8 : UKOLY.length;
    const seznam = volny ? UKOLY.slice(0, zaklad).concat(VOLNE_CILE) : UKOLY, n = seznam.length;
    for (let k = 0; k < n; k++) if (!seznam[k].hotovo(hra)) {
      const r = { krok: k + 1, z: n, text: seznam[k].text };
      if (!volny && KROKY_KUSOVNIKU.has(k)) { const kt = kusovnikText(hra); if (kt) { r.text += ' ' + kt; r.kusovnik = kusovnikKlice(hra, true); } }
      if (!volny && KROKY_VODITKA.has(k)) { const v = voditko(hra); if (v.text) { r.text += ' 🧭 ' + v.text; r.voditko = v; } }
      if (!volny && k === 12) { const va = volbaArtefaktu(hra); r.artefakty = va; }
      return r;
    }
    if (volny) { const o = opakovanyCil(hra); return { krok: n + 1, z: n + 1, text: o.text, opakovany: true }; }
    return null;
  }
  // goblinní tunel vyčištěný: objevený, žádný tvor v něm a stojí v něm trpaslík (kontrola jednou za 60 tahů);
  // odměna sláva +20 a nájezdy tunelem přestanou (hrozby.tunelProNajezd)
  function hlidejTunel(hra) {
    if (hra.odemceno.tunelVycisten || hra.tik % 60 !== 15) return;
    const o = hra.hora.oblasti.find(o => o.typ === 'tunel');
    if (!o || !hra.objeveno[o.cislo]) return;
    const ob = hra.hora.oblast;
    if (hra.tvorove.some(u => ob[u.i] === o.cislo)) return;
    const t = hra.trpaslici.find(t => ob[t.i] === o.cislo);
    if (!t) return;
    hra.odemceno.tunelVycisten = hra.tik;
    hra.slavaBonus = (hra.slavaBonus || 0) + 20;
    zprava(hra, 'objev', `🗡️ Goblinní tunel je vyčištěný – ${t.jmeno} v něm zatloukl runu předků. Nájezdy tudy už nepřijdou (sláva +20).`, t.i);
  }

  function tik(hra) {
    hra.maxTrp = Math.max(hra.maxTrp || 0, hra.trpaslici.length);
    hlidejTunel(hra);
    if (!hra.trpaslici.length && !hra.konec && hra.tik > 1) konec(hra, false);
    if (hra.spac.probuzen && !hra.spac.porazen && !hra.tvorove.some(u => u.id === hra.spac.id)) spacPorazen(hra);
  }

  T.pribeh = { VLNY, kusovnikKlice, kusovnikText, VOLNE_CILE, HLOUBKA_SPACE, HLOUBKA_VAROVANI, DEDICTVI, DOBA_ZAZEHNUTI, klicPodminka, hloubkaVarovani, budiSpace, ULOMKY, ARTEFAKTY, kampan, prectiDesku, prectiUlomek, artefaktZakazany, vyroben,
               faktor, utokKlanu, probudSpace, hlidejHloubku, objevenoSrdce, zazehni, statistiky, konec, epilog, UKOLY, coDal, tik,
               voditko, odhalStopy, zvolArtefakty, volbaArtefaktu, opakovanyCil, lzeVyzvatSpace, vyzviSpace, hlidejTunel };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
