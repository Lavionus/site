/* Ostrov v obležení – definice (věže, nepřátelé, pasti, počasí, artefakty, biomy).
   Vzdálenosti jsou v polích, rychlosti v polích za sekundu, časy v sekundách. */
(function (OBL) {
  'use strict';

  /* ---------- Věže ----------
     cile: m = moře (lodě a tvorové na hladině), v = vzduch, s = souš (pěchota)
     misto: 'sous' kdekoli stavitelně, 'breh' jen u vody, 'louka' jen na louce, 'pristav' kotviště přístavu
     aura: popis bonusu pro sousedy (Chebyshevova vzdálenost 1, jako v TD) */
  const VEZE = {
    straz:  { nazev: 'Strážní věž', ikona: '🏹', cena: 70, dosah: 2.7, kad: 0.8, dmg: 9, cile: 'ms', misto: 'sous', strela: 'sip', barva: '#c8a165',
              popis: 'Lučištníci. Levná a rychlá, střílí na pěchotu i na lodě blízko břehu.', aura: 'sousedé +12 % kadence',
              specs: [{ n: 'Ohnivé šípy', d: 'zásah zapaluje (hoření)' }, { n: 'Dlouhé luky', d: '+30 % dosah' }] },
    delo:   { nazev: 'Pobřežní dělo', ikona: '💥', cena: 150, dosah: 4.6, kad: 2.6, dmg: 48, splash: 0.45, cile: 'm', misto: 'breh', strela: 'koule', barva: '#5d6d7e',
              popis: 'Dlouhý dostřel na moře, jen proti lodím a tvorům. Musí stát u vody, na útesu dostřelí o 30 % dál.', aura: 'sousedé +12 % poškození proti lodím',
              specs: [{ n: 'Řetězové koule', d: 'láme stěžně: zásah zpomalí loď na 50 %' }, { n: 'Těžká ráže', d: '+60 % poškození, ignoruje pancíř' }] },
    mozdir: { nazev: 'Moždíř', ikona: '💣', cena: 185, dosah: 4.4, min: 1.3, kad: 3.8, dmg: 34, splash: 1.15, cile: 'ms', misto: 'sous', strela: 'granat', barva: '#7f6a4f',
              popis: 'Granát letí obloukem a vybuchne v ploše. Nezasáhne nic blíž než 1,3 pole.', aura: 'sousedé +10 % poškození',
              specs: [{ n: 'Kartáč', d: '+60 % plocha výbuchu' }, { n: 'Zápalné granáty', d: 'výbuch nechá hořící plochu' }] },
    balista:{ nazev: 'Harpunová balista', ikona: '🎯', cena: 160, dosah: 4.0, kad: 1.5, dmg: 24, cile: 'mv', misto: 'sous', strela: 'harpuna', zpomal: 0.7, zpomalT: 1, barva: '#8e6e3c',
              popis: 'Proti letcům a mořským tvorům. Harpuna cíl na chvíli zpomalí.', aura: 'střely sousedů lehce zpomalují',
              specs: [{ n: 'Síť', d: 'zasažený letec na 1,5 s ztratí let (omráčení)' }, { n: 'Trojitá harpuna', d: 'střílí na 3 cíle' }] },
    musket: { nazev: 'Mušketýři', ikona: '🎖️', cena: 135, dosah: 2.5, kad: 0.45, dmg: 6, cile: 'vs', misto: 'sous', strela: 'kulka', barva: '#3d5a80',
              popis: 'Rychlá palba na pěchotu i na letce, krátký dosah.', aura: 'sousedé +10 % kadence',
              specs: [{ n: 'Salva', d: 'střílí na 2 cíle' }, { n: 'Ostrostřelci', d: '25 % šance na trojnásobný zásah' }] },
    kotel:  { nazev: 'Kotel řeckého ohně', ikona: '🔥', cena: 200, dosah: 2.4, kad: 2.4, dmg: 6, ohen: 14, ohenT: 3, ohenR: 0.8, cile: 'ms', misto: 'breh', strela: 'ohen', barva: '#c0392b',
              popis: 'Zapálí moře i zem: zasažené místo několik sekund hoří. Stojí u vody.', aura: 'střely sousedů zapalují',
              specs: [{ n: 'Žhavé moře', d: 'větší a déle hořící plocha' }, { n: 'Kyselý oheň', d: 'hoření ignoruje pancíř, +40 % síla' }] },
    mag:    { nazev: 'Věž mága', ikona: '🔮', cena: 230, dosah: 3.0, kad: 3.0, dmg: 20, retez: 3, cile: 'mvs', misto: 'sous', strela: 'blesk', barva: '#8e44ad',
              popis: 'Řetězový blesk přeskočí na další cíle. Zasáhne moře, vzduch i souš.', aura: 'střely sousedů mají 8 % šanci omráčit',
              specs: [{ n: 'Bouřný řetěz', d: '+2 přeskoky' }, { n: 'Ochromení', d: '20 % šance omráčit' }] },
    majak:  { nazev: 'Maják', ikona: '🏮', cena: 170, dosah: 4.5, podpora: true, misto: 'sous', barva: '#f5cd79',
              popis: 'Neútočí. V dosahu odhalí ponořené tvory a přízračné lodě. Sousedé zasáhnou i letce a v noci a mlze nemají menší dosah.', aura: 'sousedé zasáhnou letce, v noci a mlze bez postihu',
              specs: [{ n: 'Oslepující paprsek', d: 'lodě v dosahu střílí o 40 % pomaleji' }, { n: 'Daleký svit', d: 'aura o pole dál, odhalení +1,5 pole' }] },
    prapor: { nazev: 'Prapor', ikona: '🚩', cena: 150, dosah: 0, podpora: true, misto: 'sous', barva: '#d4a017',
              popis: 'Neútočí. Aura sousedům přidává poškození, kadenci i dosah a roste s úrovní.', aura: 'sousedé +poškození, +kadence, +dosah',
              specs: [{ n: 'Válečný pokřik', d: 'aura +15 % poškození navíc' }, { n: 'Široký prapor', d: 'aura dosáhne o pole dál' }] },
    sklad:  { nazev: 'Sklad a dílna', ikona: '🏭', cena: 190, dosah: 0, podpora: true, misto: 'sous', barva: '#b08968',
              popis: 'Neútočí. Během vlny opravuje pevnost, přístav a vesnice (1 bod za 8 s).', aura: 'sousedé +8 % dosah',
              specs: [{ n: 'Rychlé opravy', d: 'opravuje dvakrát rychleji' }, { n: 'Pokladnice', d: '+15 zlata po každé vlně' }] },
    plantaz:{ nazev: 'Plantáž', ikona: '🌾', cena: 110, dosah: 0, podpora: true, misto: 'louka', barva: '#9acd32', maxUr: 3,
              popis: 'Neútočí. Po každé vlně vynese zlato (20, s každou úrovní o polovinu víc). Jen na louce.', aura: 'žádná',
              specs: [] },
    salupa: { nazev: 'Strážní šalupa', ikona: '⛵', cena: 220, dosah: 2.8, kad: 1.6, dmg: 22, cile: 'm', misto: 'pristav', strela: 'koule', barva: '#2e86de', max: 2, rychlost: 1.9,
              popis: 'Vlastní loď. Kotví u přístavu, hlídkuje u místa, které jí určíš kliknutím na moře, a pálí na lodě a tvory.', aura: 'žádná',
              specs: [{ n: 'Kartáčová palba', d: 'zásah v ploše' }, { n: 'Rychlé plachty', d: '+50 % rychlost, +25 % kadence' }] },
  };
  const KLICE_VEZI = Object.keys(VEZE);
  const UTOCNE = KLICE_VEZI.filter(k => !VEZE[k].podpora);

  /* ---------- Pasti ---------- */
  const PASTI = {
    zatarasy: { nazev: 'Zátarasy', ikona: '🪵', cena: 40, misto: 'cesta', popis: 'Na cestě nebo pláži zpomalí pěchotu na 45 %, vydrží 30 s od prvního průchodu.', zpomal: 0.45, doba: 30 },
    kuly:     { nazev: 'Kůly v mělčině', ikona: '🗡️', cena: 50, misto: 'melcina', popis: 'V mělčině zraní projíždějící lodě a tvory (18 poškození, 10 zásahů).', dmg: 18, uses: 10 },
    mina:     { nazev: 'Námořní mina', ikona: '💥', cena: 70, misto: 'voda', popis: 'Vybuchne pod lodí: 200 poškození v okolí, jen jednou.', dmg: 200, splash: 1.2 },
    retez:    { nazev: 'Řetězová závora', ikona: '⛓️', cena: 160, misto: 'voda', popis: 'Lodě s ponorem 2 a víc se zastaví a musí řetěz přerazit (výdrž 300). Čluny a tvorové proklouznou.', hp: 300 },
  };
  const KLICE_PASTI = Object.keys(PASTI);

  /* ---------- Nepřátelé ----------
     druh: lod, tvor (plave, může být ponořený), vzduch, pesi
     ukol: vysadek (doplout k pláži a vysadit pěchotu), ostrel (ostřelovat budovy), loupez (vyloupit přístav),
           pevnost (jít/letět k pevnosti a útočit), vez (harpyje: usednout na věž), had (obtočit pobřežní věž)
     utok = poškození budovy jednou ranou, kadU = sekundy mezi ranami,
     vtrh = kolik bodů výdrže pevnosti vezme pěšák nebo letec, který k ní dojde (pak zmizí, jako únik v TD) */
  const NEPRATELE = {
    clun:     { nazev: 'Pirátský člun', ikona: '🛶', druh: 'lod', hp: 45, v: 1.9, ponor: 1, ukol: 'vysadek', vysadek: [['pirat', 2]], odmena: 6, vel: 0.42 },
    kaper:    { nazev: 'Kaperská šalupa', ikona: '⛵', druh: 'lod', hp: 120, v: 1.6, ponor: 2, ukol: 'ostrel', dosahU: 3.2, utok: 3, kadU: 2.5, odmena: 12, vel: 0.5 },
    briga:    { nazev: 'Brigantina', ikona: '🚢', druh: 'lod', hp: 240, v: 1.15, ponor: 2, ukol: 'vysadek', vysadek: [['pirat', 3], ['marinak', 2]], odmena: 18, vel: 0.62 },
    lupic:    { nazev: 'Lupičská loď', ikona: '🏴‍☠️', druh: 'lod', hp: 170, v: 1.9, ponor: 2, ukol: 'loupez', odmena: 15, vel: 0.52 },
    galeona:  { nazev: 'Válečná galeona', ikona: '⚓', druh: 'lod', hp: 650, v: 0.8, ponor: 3, ukol: 'ostrel', dosahU: 4.2, utok: 7, kadU: 2.5, pancir: 6, odmena: 40, vel: 0.78 },
    prizrak:  { nazev: 'Přízračná loď', ikona: '👻', druh: 'lod', hp: 280, v: 1.3, ponor: 1, ukol: 'vysadek', vysadek: [['kostlivec', 4]], odmena: 22, vel: 0.6, skryty: true },
    zralok:   { nazev: 'Žralok', ikona: '🦈', druh: 'tvor', hp: 30, v: 2.6, ponor: 1, ukol: 'loupez', utok: 1, kadU: 1.5, odmena: 4, vel: 0.35 },
    had:      { nazev: 'Mořský had', ikona: '🐍', druh: 'tvor', hp: 380, v: 1.4, ponor: 1, ukol: 'had', odmena: 30, vel: 0.55, ponoreny: true },
    krab:     { nazev: 'Obří krab', ikona: '🦀', druh: 'tvor', hp: 220, v: 0.9, ponor: 1, ukol: 'vylez', vtrh: 5, pancir: 5, utok: 3, kadU: 1, odmena: 16, vel: 0.5 },
    harpyje:  { nazev: 'Harpyje', ikona: '🦅', druh: 'vzduch', hp: 34, v: 2.6, ukol: 'vez', vtrh: 2, utok: 1, kadU: 1, odmena: 5, vel: 0.36, unos: 0.5 },
    balon:    { nazev: 'Výsadkový balon', ikona: '🎈', druh: 'vzduch', hp: 150, v: 0.7, ukol: 'shoz', vysadek: [['pirat', 4]], odmena: 14, vel: 0.55, unos: 1.4 },
    wyverna:  { nazev: 'Wyverna', ikona: '🐉', druh: 'vzduch', hp: 420, v: 1.5, ukol: 'pevnost', vtrh: 8, utok: 3, kadU: 1, ohnivyDech: true, odmena: 32, vel: 0.6, unos: 0.4 },
    vzducholod:{ nazev: 'Vzducholoď mágů', ikona: '🛸', druh: 'vzduch', hp: 520, v: 0.6, ukol: 'pevnost', vtrh: 12, utok: 6, kadU: 3, pancir: 4, odmena: 38, vel: 0.75, unos: 0.8 },
    pirat:    { nazev: 'Pirát', ikona: '🗡️', druh: 'pesi', hp: 45, v: 1.1, ukol: 'pevnost', vtrh: 2, utok: 1, kadU: 1, odmena: 5, vel: 0.3 },
    marinak:  { nazev: 'Mariňák', ikona: '🛡️', druh: 'pesi', hp: 120, v: 0.85, ukol: 'pevnost', vtrh: 4, utok: 2, kadU: 1, pancir: 5, odmena: 10, vel: 0.34 },
    saper:    { nazev: 'Sapér', ikona: '🪓', druh: 'pesi', hp: 70, v: 1.0, ukol: 'pevnost', vtrh: 2, utok: 1, kadU: 1, saper: true, odmena: 8, vel: 0.32 },
    strelec:  { nazev: 'Střelec', ikona: '🔫', druh: 'pesi', hp: 60, v: 0.9, ukol: 'pevnost', utok: 1, kadU: 2, dosahU: 3, odmena: 9, vel: 0.3 },
    kostlivec:{ nazev: 'Kostlivec', ikona: '💀', druh: 'pesi', hp: 55, v: 1.0, ukol: 'pevnost', vtrh: 2, utok: 1, kadU: 1, odmena: 4, vel: 0.3, slabyOhen: true },
    bubenik:  { nazev: 'Bubeník', ikona: '🥁', druh: 'pesi', hp: 85, v: 0.9, ukol: 'pevnost', vtrh: 3, utok: 1, kadU: 1, bubny: true, odmena: 10, vel: 0.32 },
    magN:     { nazev: 'Mág bouře', ikona: '🧙', druh: 'pesi', hp: 90, v: 0.8, ukol: 'pevnost', vtrh: 4, utok: 2, kadU: 1, stity: true, odmena: 14, vel: 0.32 },
    // bossové
    kraken:   { nazev: 'Kraken', ikona: '🐙', druh: 'tvor', boss: true, hp: 2600, v: 0.8, ponor: 2, ukol: 'ostrel', dosahU: 6.5, utok: 5, kadU: 2, odmena: 260, vel: 1.1, chapadla: true, ponoreny: true },
    admiral:  { nazev: 'Admirálská galeona', ikona: '⚓', druh: 'lod', boss: true, hp: 3000, v: 0.6, ponor: 3, ukol: 'ostrel', dosahU: 6.5, utok: 6, kadU: 2.5, pancir: 8, odmena: 280, vel: 1.05 },
    matka:    { nazev: 'Matka wyvern', ikona: '🐲', druh: 'vzduch', boss: true, hp: 2400, v: 0.85, ukol: 'pevnost', vtrh: 40, utok: 8, kadU: 2, ohnivyDech: true, odmena: 260, vel: 1.0, unos: 0.2, mladata: true },
    holandan: { nazev: 'Holandský přízrak', ikona: '☠️', druh: 'lod', boss: true, hp: 2600, v: 1.1, ponor: 1, ukol: 'vysadek', vysadek: [['kostlivec', 6]], opakovany: true, odmena: 260, vel: 1.0, skryty: true, teleport: true },
    titan:    { nazev: 'Ohnivý titán', ikona: '🌋', druh: 'pesi', boss: true, hp: 3400, v: 0.5, ukol: 'pevnost', vtrh: 35, utok: 10, kadU: 1, pancir: 6, odmena: 300, vel: 0.9, imunita: 'zpomaleni', zarVez: true },
    mlade:    { nazev: 'Mládě wyverny', ikona: '🐉', druh: 'vzduch', hp: 120, v: 1.8, ukol: 'pevnost', vtrh: 3, utok: 2, kadU: 1, odmena: 6, vel: 0.4, unos: 0.5 },
  };

  // od kterého stupně (globální číslo vlny) se nepřítel objevuje a kolik „bodů“ vlny stojí
  const NABOR = [
    ['clun', 1, 2.4], ['kaper', 2, 3], ['zralok', 3, 0.8], ['harpyje', 3, 0.9],
    ['briga', 4, 6.5], ['lupic', 5, 3.5], ['balon', 6, 4], ['krab', 7, 3], ['wyverna', 9, 7],
    ['prizrak', 8, 6], ['had', 10, 6], ['galeona', 12, 9], ['vzducholod', 14, 9],
  ];

  const BOSSOVE = ['admiral', 'kraken', 'matka', 'holandan', 'titan'];

  const IMUNITY = {
    ohen:      { nazev: 'Ohnivzdorný', ikona: '🧯', popis: 'nehoří' },
    zpomaleni: { nazev: 'Neúnavný', ikona: '🏃', popis: 'nelze zpomalit' },
    omraceni:  { nazev: 'Neochvějný', ikona: '🗿', popis: 'nelze omráčit' },
    krit:      { nazev: 'Bez slabin', ikona: '🎖️', popis: 'nelze kriticky zasáhnout' },
  };
  const KLICE_IMUNIT = Object.keys(IMUNITY);

  const POCASI = {
    jasno: { nazev: 'Jasno', ikona: '☀️', popis: '+25 % zlata ze zabití' },
    mlha:  { nazev: 'Mlha', ikona: '🌫️', popis: 'dosah věží −15 %, přízračné lodě vidí jen maják' },
    boure: { nazev: 'Bouře', ikona: '⛈️', popis: 'nepřátelé o 12 % rychlejší, moždíře míří hůř' },
    noc:   { nazev: 'Noc', ikona: '🌙', popis: 'dosah věží −20 % (kromě věží u majáku)' },
  };
  const PRILIV = { '-1': { nazev: 'Odliv', ikona: '🏖️', popis: 'mělčiny vyschnou, velké lodě mají méně cest' },
                   '0': { nazev: 'Běžná hladina', ikona: '🌊', popis: '' },
                   '1': { nazev: 'Příliv', ikona: '🌊⬆', popis: 'hlubší voda, lodě doplují blíž a čluny dál do řeky' } };
  const SMERY = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
  const SMER_UHEL = s => (SMERY.indexOf(s) * 45 - 90) * Math.PI / 180; // S = nahoru

  const ARTEFAKTY = {
    kompas:  { nazev: 'Kompas mrtvého kapitána', ikona: '🧭', popis: 'hlídka vždy hlásí přesné směry útoku' },
    inkoust: { nazev: 'Inkoust krakena', ikona: '🦑', popis: '+12 % poškození proti lodím a tvorům' },
    pero:    { nazev: 'Pero ptáka hromu', ikona: '🪶', popis: '+15 % poškození proti letcům' },
    poklad:  { nazev: 'Pirátský poklad', ikona: '💰', popis: '+15 % zlata ze zabití' },
    kamen:   { nazev: 'Kámen předků', ikona: '🗿', popis: '+20 výdrže pevnosti (hned i natrvalo)' },
    roh:     { nazev: 'Roh mořského boha', ikona: '🐚', popis: 'schopnosti se nabíjejí o 25 % rychleji' },
    lampa:   { nazev: 'Lampa strážce', ikona: '🪔', popis: 'majáky odhalují o 1,5 pole dál, noc ubírá jen 10 % dosahu' },
  };
  const KLICE_ARTEFAKTU = Object.keys(ARTEFAKTY);

  const OBTIZNOSTI = {
    lehka:   { nazev: 'Lehká', ikona: '🌱', hp: 0.8, pevnost: 130, zlato: 430 },
    normalni:{ nazev: 'Normální', ikona: '⚔️', hp: 1, pevnost: 100, zlato: 370 },
    tezka:   { nazev: 'Těžká', ikona: '💀', hp: 1.3, pevnost: 75, zlato: 340 },
  };

  /* biomy: vzhled a ráz vln (podíl moře/vzduchu/tvorů) */
  const BIOMY = {
    tropy:    { nazev: 'Tropický ostrov', ikona: '🌴', boss: 'admiral', vahy: { lod: 1, vzduch: 0.6, tvor: 0.5 },
                barvy: { more: ['#0b3d63', '#11598a', '#1b7bb0', '#38a6c9'], plaz: '#e8d39a', utes: '#8d7b68', louka: '#6fa84a', les: '#2f7a3a', kopec: '#8a9a5b', skala: '#7d7a76', bazina: '#4f6b48', reka: '#3c9ac4', cesta: '#c9a46a' } },
    sopka:    { nazev: 'Sopečný ostrov', ikona: '🌋', boss: 'titan', vahy: { lod: 0.8, vzduch: 1.1, tvor: 0.3 },
                barvy: { more: ['#0c2f4a', '#134766', '#1f6283', '#3f88a3'], plaz: '#4b4542', utes: '#5b4b44', louka: '#71894a', les: '#3e6b35', kopec: '#6d5d50', skala: '#3a3332', bazina: '#4c5a40', reka: '#3a86a8', cesta: '#a88a66' } },
    atol:     { nazev: 'Korálový atol', ikona: '🪸', boss: 'kraken', vahy: { lod: 1.2, vzduch: 0.4, tvor: 0.9 },
                barvy: { more: ['#0a4f78', '#0f7aa6', '#25a5c4', '#62d0d6'], plaz: '#f2e3b3', utes: '#b7a58a', louka: '#86b85a', les: '#3f8c45', kopec: '#a3ad6a', skala: '#9a948a', bazina: '#5f7d55', reka: '#4cb3cf', cesta: '#d8b77d' } },
    mlha:     { nazev: 'Mlžný severní ostrov', ikona: '🌫️', boss: 'holandan', vahy: { lod: 1, vzduch: 0.6, tvor: 0.6 },
                barvy: { more: ['#13303f', '#1d4a5c', '#2b6577', '#4b8794'], plaz: '#bfb8a0', utes: '#6e706b', louka: '#5f8a5a', les: '#2c5a40', kopec: '#78876d', skala: '#5f625f', bazina: '#4a5f4f', reka: '#3f7f90', cesta: '#a99a7c' } },
    skaly:    { nazev: 'Skalnatý ostrov', ikona: '🏜️', boss: 'matka', vahy: { lod: 0.8, vzduch: 1.2, tvor: 0.3 },
                barvy: { more: ['#0d3a5c', '#15557e', '#1f72a0', '#3d97bd'], plaz: '#dcc48f', utes: '#9a7b5c', louka: '#a3a35a', les: '#5f7f3a', kopec: '#b08d5f', skala: '#8a7766', bazina: '#6b7350', reka: '#3f93b8', cesta: '#caa36f' } },
    mangrovy: { nazev: 'Mangrovový ostrov', ikona: '🌿', boss: 'kraken', vahy: { lod: 0.9, vzduch: 0.6, tvor: 1.2 },
                barvy: { more: ['#0d3a3f', '#145457', '#1f6e6b', '#3d8f84'], plaz: '#c9b98a', utes: '#6f6650', louka: '#5f8f45', les: '#285f33', kopec: '#768a55', skala: '#6a675f', bazina: '#3f5a3c', reka: '#2f7f76', cesta: '#b29a6e' } },
  };
  const KLICE_BIOMU = Object.keys(BIOMY);

  const HODNOSTI = [
    { n: 'Rekrut', znak: '', xp: 0 }, { n: 'Veterán', znak: '▲', xp: 240 }, { n: 'Elita', znak: '▲▲', xp: 720 },
    { n: 'Mistr', znak: '▲▲▲', xp: 1680 }, { n: 'Legenda', znak: '★', xp: 3600 },
  ];

  const SCHOPNOSTI = {
    salva:   { nazev: 'Salva flotily', ikona: '💣', max: 45, popis: 'klikni na moře nebo pobřeží: 140 poškození v okolí' },
    brander: { nazev: 'Brander', ikona: '🔥', max: 60, popis: 'z přístavu vypluje hořící loď a vybuchne u nejbližší nepřátelské lodi' },
    zpev:    { nazev: 'Bouřný zpěv', ikona: '🌪️', max: 90, popis: 'na 4 s zastaví všechny lodě, tvory a letce' },
  };

  OBL.data = {
    VEZE, KLICE_VEZI, UTOCNE, PASTI, KLICE_PASTI, NEPRATELE, NABOR, BOSSOVE, IMUNITY, KLICE_IMUNIT,
    POCASI, PRILIV, SMERY, SMER_UHEL, ARTEFAKTY, KLICE_ARTEFAKTU, OBTIZNOSTI, BIOMY, KLICE_BIOMU, HODNOSTI, SCHOPNOSTI,
  };
})(globalThis.OBL = globalThis.OBL || {});
