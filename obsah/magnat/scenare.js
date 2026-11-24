/* Dopravní magnát – scénáře, výzva dne a výuka (bez DOM).
   Scénář = mapa (seed + volby), začátek (rok, peníze), cíle a termín (konec roku `do`). Stav ve hře h.scenar:
   {id, nazev, cile, do, splneno: den | null, neuspech: bool}. Kontrola měsíčně (hra.mesicni → prehledy → zde)
   a při načtení. Výuka = kroky s podmínkou nad stavem hry (h.vyuka = index kroku). */
(function (MAG) {
  'use strict';
  const D = MAG.data, H = MAG.hra;

  /* Typy cílů: preprava (náklad, volitelně jen druh vozidla), dodano (do podniků daného druhu nákladu),
     hodnota (firmy), zisk (roční, loni), mesto (obsluhované město s počtem obyvatel), vozidel (druh, počet). */
  const SCENARE = [
    { id: 'autobusy', nazev: 'Autobusové začátky', popis: 'Malé město touží po spojení se sousedy. Rozvoz cestujících autobusy.',
      mapa: { seed: 1000, velikost: 128, krajina: 'kopce' }, rok: 1950, penize: 80000, uver: 80000, do: 1953,
      cile: [{ typ: 'preprava', naklad: 'lide', n: 5000 }] },
    { id: 'uhli', nazev: 'Uhlí pro elektrárnu', popis: 'Elektrárny hladoví po uhlí. Dovez ho vlakem či auty.',
      mapa: { seed: 8919, velikost: 128, krajina: 'rovina' }, rok: 1925, penize: 120000, uver: 100000, do: 1932,
      cile: [{ typ: 'dodano', naklad: 'uhli', n: 16000 }] },
    { id: 'ostrovy', nazev: 'Ostrovní spojení', popis: 'Souostroví bez mostů. Spoj ostrovy loděmi a letadly.',
      mapa: { seed: 4242, velikost: 128, krajina: 'kopce', voda: 'hodne' }, rok: 1955, penize: 200000, uver: 100000, do: 1964,
      cile: [{ typ: 'preprava', naklad: 'lide', druh: 'lod', n: 3000 }, { typ: 'preprava', naklad: 'lide', druh: 'let', n: 3000 }] },
    { id: 'hory', nazev: 'Železná páteř', popis: 'V horách vládne železnice. Vybuduj síť, která vydělává.',
      mapa: { seed: 16838, velikost: 128, krajina: 'hory' }, rok: 1935, penize: 250000, uver: 150000, maxUver: 500000, do: 1948,
      cile: [{ typ: 'vozidel', druh: 'vlak', n: 5 }, { typ: 'zisk', n: 60000 }] },
    { id: 'metropole', nazev: 'Rostoucí metropole', popis: 'Pomoz městu vyrůst ve velkoměsto – dopravou a potravinami.',
      mapa: { seed: 32676, velikost: 128, krajina: 'rovina', mesta: 'malo' }, rok: 1960, penize: 150000, uver: 100000, do: 1980,
      cile: [{ typ: 'mesto', n: 6000 }] },
    { id: 'ocel', nazev: 'Průmyslový řetězec', popis: 'Ruda a uhlí do ocelárny, ocel do továrny – roztoč celý řetězec.',
      mapa: { seed: 40595, velikost: 128, krajina: 'kopce', prumysl: 'hodne' }, rok: 1950, penize: 250000, uver: 150000, maxUver: 500000, do: 1962,
      cile: [{ typ: 'dodano', naklad: 'ocel', n: 3000 }] },
    { id: 'letadla', nazev: 'Letecký věk', popis: 'Proudová letadla mění svět. Postav leteckou síť mezi velkými městy.',
      mapa: { seed: 56433, velikost: 256, krajina: 'kopce', mesta: 'hodne' }, rok: 1970, penize: 600000, uver: 300000, maxUver: 1000000, do: 1982,
      cile: [{ typ: 'preprava', naklad: 'lide', druh: 'let', n: 40000 }] },
    { id: 'magnat', nazev: 'Dopravní magnát', popis: 'Velká mapa, celé století. Vybuduj firmu v hodnotě deseti milionů.',
      mapa: { seed: 777, velikost: 256, krajina: 'kopce' }, rok: 1930, penize: 150000, uver: 150000, maxUver: 600000, do: 1990,
      cile: [{ typ: 'hodnota', n: 10e6 }] },
  ];

  // výzva dne: scénář z data (stejný pro všechny)
  function vyzvaDne(datum) {
    const seed = MAG.seedDne(datum), nah = MAG.Nahoda(MAG.hash('vyzva', seed));
    const rok = nah.vyber([1925, 1950, 1975, 2000]);
    const cil = nah.vyber([
      { typ: 'preprava', naklad: 'lide', n: 4000, text: 'cestujících' },
      { typ: 'dodano', naklad: 'uhli', n: 6000 },
      { typ: 'zisk', n: 50000 },
      { typ: 'mesto', n: 4000 },
    ]);
    const kr = nah.vyber(['rovina', 'kopce', 'hory']);
    return { id: 'den_' + datum.toISOString().slice(0, 10), nazev: 'Výzva dne', popis: `Mapa i cíl jsou dnes stejné pro všechny.`, dne: true,
      mapa: { seed, velikost: 128, krajina: kr }, rok, penize: 120000, uver: 100000, do: rok + 6, cile: [cil] };
  }

  const NAZEV_CILE = c => {
    const nk = c.naklad && D.NAKLADY_PODLE_ID[c.naklad];
    const n = Math.round(c.n).toLocaleString('cs-CZ');
    const druh = { lod: 'loděmi', let: 'letadly', vlak: 'vlaky', bus: 'autobusy', nakl: 'nákladními auty' }[c.druh];
    switch (c.typ) {
      case 'preprava': return `Převézt ${n} × ${nk.nazev.toLowerCase()}${druh ? ' ' + druh : ''}`;
      case 'dodano': return `Dodat ${n} t: ${nk.nazev.toLowerCase()} do podniků`;
      case 'hodnota': return `Hodnota firmy $${n}`;
      case 'zisk': return `Roční zisk aspoň $${n}`;
      case 'mesto': return `Obsluhované město s ${n} obyvateli`;
      case 'vozidel': return `Mít ${n} ${{ vlak: 'vlaků', bus: 'autobusů', lod: 'lodí', let: 'letadel' }[c.druh] || 'vozidel'}`;
    }
    return c.typ;
  };

  function postup(h, c) {
    const cel = (h.stat && h.stat.celkem) || { preprava: {} };
    let x = 0;
    switch (c.typ) {
      case 'preprava': x = c.druh ? (cel[c.druh + '_' + c.naklad] || 0) : (cel.preprava[c.naklad] || 0); break;
      case 'dodano': for (const s of h.prum || []) x += (s.celkemDodano && s.celkemDodano[c.naklad]) || 0; break;
      case 'hodnota': x = H.hodnotaFirmy(h); break;
      case 'zisk': x = Object.values(h.fin.loni || {}).reduce((a, b) => a + b, 0); break;
      case 'mesto': x = Math.max(0, ...h.m.mesta.filter(m => H.obsluhovanychStanic(h, m) > 0).map(m => m.obyv)); break;
      case 'vozidel': x = h.vozidla.filter(v => H.aktivni(v) && (!c.druh || v.druh === c.druh)).length; break;
    }
    return { x, n: c.n, hotovo: x >= c.n, podil: Math.min(1, x / c.n) };
  }

  function zacni(def) {
    const m = MAG.mapa.generuj(def.mapa.seed, def.mapa);
    const h = H.novaHra(m, { rok: def.rok, scenar: true, penize: def.penize, uver: def.uver, maxUver: def.maxUver });
    h.scenar = { id: def.id, nazev: def.nazev, popis: def.popis, cile: def.cile, do: def.do, dne: !!def.dne, splneno: null, neuspech: false };
    return h;
  }

  // měsíční kontrola: splněno / vypršel čas → noviny
  function kontrola(h) {
    const s = h.scenar;
    if (!s || s.splneno !== null || s.neuspech) return;
    const vse = s.cile.every(c => postup(h, c).hotovo);
    const rok = H.rok(h);
    if (vse) {
      s.splneno = h.den;
      s.skore = Math.round(H.hodnotaFirmy(h) / 1000) + Math.max(0, s.do - rok) * 200;
      MAG.prehledy.pridej(h, { den: h.den, rubrika: 'Scénář', titulek: `🏁 Scénář „${s.nazev}“ splněn!`, text: `O ${Math.max(0, s.do - rok)} let dřív, než bylo třeba. Skóre ${s.skore}. Hra může pokračovat.`, scenar: s.id, skore: s.skore, velka: true });
    } else if (rok > s.do) {
      s.neuspech = true;
      MAG.prehledy.pridej(h, { den: h.den, rubrika: 'Scénář', titulek: `⌛ Čas scénáře „${s.nazev}“ vypršel`, text: 'Cíle se nepodařilo splnit včas. Hrát se dá dál, nebo to zkus znovu.', scenar: s.id, velka: true });
    }
  }

  // --- výuka ---------------------------------------------------------------------------------------
  const VYUKA = [
    { text: 'Postav silnici (R): táhni z jednoho města do druhého. Tlačítko Stavět → Silnice.', nastroj: 'silnice',
      hotovo: h => { let n = 0; for (const c of h.m.cesta) if (c === 2) n++; return n >= 3; } },
    { text: 'Postav dvě zastávky autobusu (B) – v každém městě jednu, na rovném úseku silnice.', nastroj: 'bus',
      hotovo: h => new Set(h.stanice.filter(s => s && s.casti.some(c => c.druh === 'bus')).map(s => s.mesto)).size >= 2 },
    { text: 'Postav garáž (⇧D) na volné pole vedle silnice. Otevře se její okno.', nastroj: 'garaz',
      hotovo: h => h.depa.some(g => g && (g.druh || 'silnice') === 'silnice') },
    { text: 'V okně garáže klikni na „Koupit vozidlo“ a kup autobus.', hotovo: h => h.vozidla.some(v => H.aktivni(v) && v.druh === 'bus') },
    { text: 'V okně autobusu „Přidat zastávku“ a klikni na obě zastávky na mapě.', hotovo: h => h.vozidla.some(v => H.aktivni(v) && v.druh === 'bus' && v.rozkazy.length >= 2) },
    { text: 'Spusť autobus tlačítkem „Spustit“ v jeho okně.', hotovo: h => h.vozidla.some(v => H.aktivni(v) && v.druh === 'bus' && v.bezi) },
    { text: 'Počkej, až autobus dojede na zastávku a vydělá první peníze. Rychlost času je dole (1×–8×).', hotovo: h => (h.fin.letos.prijemBus || 0) + (h.fin.loni.prijemBus || 0) > 0 },
  ];
  // vrátí aktuální krok (a posune h.vyuka přes splněné); null = výuka skončila / neběží
  function krokVyuky(h) {
    if (h.vyuka === undefined || h.vyuka === null) return null;
    while (h.vyuka < VYUKA.length && VYUKA[h.vyuka].hotovo(h)) h.vyuka++;
    if (h.vyuka >= VYUKA.length) { h.vyuka = null; return { konec: true }; }
    return { k: h.vyuka, ...VYUKA[h.vyuka], celkem: VYUKA.length };
  }
  // výuková mapa: dvě blízká města na rovině
  const VYUKA_MAPA = { seed: 20, velikost: 64, krajina: 'rovina', voda: 'malo', mesta: 'stredne' };   // Kelafield a Melorria 15 polí od sebe

  MAG.scenare = { SCENARE, vyzvaDne, NAZEV_CILE, postup, zacni, kontrola, VYUKA, krokVyuky, VYUKA_MAPA };
})(globalThis.MAG = globalThis.MAG || {});
