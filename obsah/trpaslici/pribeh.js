/* ============================================================
   Srdce hory – pribeh.js: příběh předků, artefakty, Spáč a konec hry.

   Runové desky v ruinách předků přečte kterýkoli trpaslík s povolenou
   prací v dílně. První přečtená deska odemkne runovou kovárnu, druhá
   recepty na artefakty; objevení Srdce hory přidá poslední úlomek.
   Artefakty (každý jen jednou) mají trvalý účinek pro celý klan:
     kladivo – stavba a výroba 1,3× rychleji
     lampa   – v hoře už není úplná tma (světlo aspoň 0,4)
     roh     – útok trpaslíků 1,3×
     klic    – věc; s ní se zažehne Výheň předků = vítězství
   Pradávný spáč (kampaň): probudí se, když klan kope v hlubinách
   (od 138 m) nebo objeví Srdce dřív, než má Klíč; jinak až při
   zažehnutí Výhně (finále – s ním přijde i poslední nájezd).
   Konec hry: vítězství (výheň hoří), nebo zahyne celý klan.
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, M, O, UDOLI } = T.hora;
  const P = T.prace, S = T.stavby;

  const HLOUBKA_SPACE = 138, DOBA_ZAZEHNUTI = 600;
  const ULOMKY = [
    { nadpis: 'Deska strážců', text: '„Strážili jsme cestu k Srdci. Z hlubin přišel Spáč a my mu zavřeli oči kamenem a písní. ' +
      'Kdo sestoupí k Srdci bez Klíče, probudí ho. Ukujte hvězdnou ocel v runové kovárně – její plán je vyrytý pod touto runou.“',
      odemkne: 'runovaKovarna' },
    { nadpis: 'Deska Síně předků', text: '„Výheň předků hasne, když ji nikdo nekrmí hvězdnou ocelí. Ukujte Klíč ze tří hvězdných prutů ' +
      'a šperku, doneste ho do Srdce a zažehněte oheň. Tak se hora znovu probudí – a Spáč s ní. Buďte připraveni.“',
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
  function zprava(hra, typ, text) { T.hra.zprava(hra, typ, text); }

  // úlomek příběhu (další v pořadí) a jeho odemčení
  function prectiUlomek(hra, k) {
    if (hra.prectene.includes(k)) return;
    hra.prectene.push(k);
    const u = ULOMKY[k];
    zprava(hra, 'pribeh', `📜 ${u.nadpis}: ${u.text}`);
    if (u.odemkne) { hra.odemceno[u.odemkne] = true; zprava(hra, 'objev', u.odemkne === 'runovaKovarna' ? 'Odemčeno: runová kovárna (🔨 stavět).' : 'Odemčeno: artefakty v runové kovárně.'); }
  }
  function prectiDesku(hra, i) {
    if (hra.deskyPrectene.includes(i)) return;
    hra.deskyPrectene.push(i);
    prectiUlomek(hra, hra.prectene.includes(0) ? 1 : 0);
    hra.slavaBonus = (hra.slavaBonus || 0) + 5;
  }
  // co lze v runové kovárně vyrobit (recepty se ukazují až po odemčení)
  function artefaktZakazany(hra, vyrobek) {
    const k = vyrobek.startsWith('art_') ? vyrobek.slice(4) : null;
    if (!k) return false;
    if (!hra.odemceno.artefakty) return true;
    return !!hra.artefakty[k] || (k === 'klic' && hra.veci.some(v => v.druh === 'klic'));
  }
  // vyrobený artefakt: klíč je věc, ostatní se zapíšou jako trvalý účinek
  function vyroben(hra, druh, i) {
    const k = druh.slice(4);
    if (k === 'klic') { P.novaVec(hra, 'klic', i, 0); hra.artefakty.klic = true; }
    else hra.artefakty[k] = true;
    hra.svetloZmena++;
    hra.slavaBonus = (hra.slavaBonus || 0) + 15;
    zprava(hra, 'objev', `✨ ${ARTEFAKTY[k].ikona} ${ARTEFAKTY[k].nazev} je hotov – ${ARTEFAKTY[k].popis}!`);
  }
  const faktor = (hra, prace) => (hra.artefakty.kladivo && (prace === 'stavet' || prace === 'vyrobit')) ? 1.3 : 1;
  const utokKlanu = hra => hra.artefakty.roh ? 1.3 : 1;

  // --- Spáč ---------------------------------------------------------------------------------
  function probudSpace(hra, proc) {
    if (!kampan(hra) || hra.spac.probuzen) return;
    hra.spac.probuzen = true;
    const srdce = hra.hora.oblasti.find(o => o.typ === 'srdce');
    const mista = [];
    for (let y = srdce.y; y < srdce.y + srdce.h; y++) for (let x = srdce.x; x < srdce.x + srdce.w; x++) {
      const i = y * W + x; if (hra.hora.teren[i] === M.VZDUCH && T.cesty.stojne(hra, i)) mista.push(i);
    }
    const s = T.hrozby.novyTvor(hra, 'spac', mista[Math.floor(P.nahoda(hra) * mista.length)] || hra.hora.srdce.y * W + hra.hora.srdce.x);
    hra.spac.id = s.id;
    T.hra.zvuk(hra, 'rev', s.i); T.hra.zvuk(hra, 'zaval', s.i, 12);
    zprava(hra, 'smrt', proc === 'brzy'
      ? '🌋 Země se zachvěla. Kopali jste příliš hluboko příliš brzy – v Srdci hory otevřel oči PRADÁVNÝ SPÁČ!'
      : '🌋 Výheň se rozhořívá a hora duní. PRADÁVNÝ SPÁČ se probouzí – braňte oheň!');
    if (proc !== 'brzy') T.hrozby.najezd(hra, (typ, text) => zprava(hra, typ, text));
  }
  function spacPorazen(hra) {
    hra.spac.porazen = true;
    hra.slavaBonus = (hra.slavaBonus || 0) + 40;
    zprava(hra, 'objev', '🏆 Pradávný spáč padl! Hora je volná.');
  }
  // volá se z prace.vykopej (hloubka) a při objevení Srdce
  function hlidejHloubku(hra, c) {
    if (!kampan(hra) || hra.spac.probuzen || hra.veci.some(v => v.druh === 'klic') || hra.zazehnuti) return;
    if ((c / W | 0) - UDOLI >= HLOUBKA_SPACE) probudSpace(hra, 'brzy');
  }
  function objevenoSrdce(hra) {
    prectiUlomek(hra, 2);
    if (!hra.veci.some(v => v.druh === 'klic')) probudSpace(hra, 'brzy');
  }

  // --- zažehnutí a konec -------------------------------------------------------------------------
  function zazehni(hra, t) {                        // volá práce 'zazehnout' každý tah na místě
    if (!hra.zazehnuti) { hra.zazehnuti = 1; zprava(hra, 'pribeh', `🔥 ${t.jmeno} vkládá Klíč do Výhně předků…`); if (!hra.spac.porazen) probudSpace(hra, 'finale'); }
    hra.zazehnuti++;
    if (hra.zazehnuti >= DOBA_ZAZEHNUTI) {
      hra.vyhenHori = true; hra.svetloZmena++;
      const v = hra.veci.find(v => v.druh === 'klic'); if (v) hra.veci.splice(hra.veci.indexOf(v), 1);
      hra.slavaBonus = (hra.slavaBonus || 0) + 60;
      zprava(hra, 'objev', '🔥🔥🔥 VÝHEŇ PŘEDKŮ HOŘÍ! Srdce hory znovu bije.');
      T.hra.zvuk(hra, 'fanfara');
      if (kampan(hra) && !hra.konec) konec(hra, true);
      return true;
    }
    return false;
  }
  function statistiky(hra) {
    return {
      dni: T.hra.den(hra), roky: T.obdobi.rok(hra), zije: hra.trpaslici.length, nejvic: hra.maxTrp || hra.trpaslici.length,
      padlo: hra.padlo || 0, slava: T.obdobi.spocitejSlavu(hra), hloubka: hra.nejhloubeji, vykopano: hra.vykopano,
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
    { text: '⛏️ Označ ke kopání místnost za bránou (K) – aspoň 20 polí.', hotovo: h => h.vykopano >= 20 },
    { text: '🪚 Postav tesařskou dílnu (B) – vyrábí postele, stoly a žebříky.', hotovo: h => maDilnu(h, 'tesarna') },
    { text: '🛏️ Vyznač ložnici (Z) a postav do ní aspoň 3 postele.', hotovo: h => maZonu(h, 'loznice') && pocetStaveb(h, S.K.POSTEL) >= 3 },
    { text: '🍄 Založ houbárnu nebo pole (Z) a postav kuchyni.', hotovo: h => maZonu(h, 'houbarna', 'pole') && maDilnu(h, 'kuchyne') },
    { text: '🍺 Postav pivovar – bez piva trpaslíci ztrácejí náladu.', hotovo: h => maDilnu(h, 'pivovar') },
    { text: '🔥 Rozvěš louče – ve tmě se pracuje pomalu a špatně spí.', hotovo: h => pocetStaveb(h, S.K.LOUC) >= 2 },
    { text: '🪜 Vytesej schodiště (L) do hloubky aspoň 30 m.', hotovo: h => h.nejhloubeji >= 30 },
    { text: '🧱 Najdi železnou rudu (48–105 m) a postav tavírnu.', hotovo: h => h.nalezeno.zelezo && maDilnu(h, 'tavirna') },
    { text: '⚔️ Postav kovárnu a zbrojnici, vyzbroj strážce (⚔️ v seznamu klanu) – goblini přijdou.', hotovo: h => maDilnu(h, 'kovarna') && h.trpaslici.some(t => t.povoleno.hlidat && t.zbran) },
    { text: '📜 Najdi ruiny předků (kolem 80–130 m) a přečti runovou desku.', hotovo: h => h.prectene.length >= 1 },
    { text: '✴️ Postav runovou kovárnu (potřebuje 2 zlaté pruty; zlato leží v 80–140 m).', hotovo: h => maDilnu(h, 'runova_kovarna') },
    { text: '📜 Přečti druhou desku (Síň předků) – odemkne artefakty.', hotovo: h => !!h.odemceno.artefakty },
    { text: '🟣 Vytěž hvězdnou rudu (126–137 m, hlouběji budíš Spáče) a ukuj 3 hvězdné pruty.', hotovo: h => h.veci.filter(v => v.druh === 'prut_hvezdny').length >= 3 || !!h.artefakty.klic },
    { text: '💍 Vybrus šperk (brusírna: zlatý prut + drahokam).', hotovo: h => h.veci.some(v => v.druh === 'sperk') || !!h.artefakty.klic },
    { text: '🗝️ Ukuj v runové kovárně Klíč k Srdci.', hotovo: h => !!h.artefakty.klic },
    { text: '❤️‍🔥 Prokopej se do Srdce hory (≈150 m) – připrav strážce, Spáč se probudí.', hotovo: h => !!h.znamo[h.hora.srdce.y * W + h.hora.srdce.x] },
    { text: '🔥 Dones Klíč k Výhni předků a ubraň ji, dokud se nerozhoří.', hotovo: h => !!h.vyhenHori },
  ];
  function coDal(hra) {
    const n = hra.rezim === 'volny' ? UKOLY.length - 8 : UKOLY.length;
    for (let k = 0; k < n; k++) if (!UKOLY[k].hotovo(hra)) return { krok: k + 1, z: n, text: UKOLY[k].text };
    return null;
  }

  function tik(hra) {
    hra.maxTrp = Math.max(hra.maxTrp || 0, hra.trpaslici.length);
    if (!hra.trpaslici.length && !hra.konec && hra.tik > 1) konec(hra, false);
    if (hra.spac.probuzen && !hra.spac.porazen && !hra.tvorove.some(u => u.id === hra.spac.id)) spacPorazen(hra);
  }

  T.pribeh = { HLOUBKA_SPACE, DOBA_ZAZEHNUTI, ULOMKY, ARTEFAKTY, kampan, prectiDesku, prectiUlomek, artefaktZakazany, vyroben,
               faktor, utokKlanu, probudSpace, hlidejHloubku, objevenoSrdce, zazehni, statistiky, konec, epilog, UKOLY, coDal, tik };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
