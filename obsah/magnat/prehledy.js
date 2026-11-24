/* Dopravní magnát – noviny, úspěchy, výroční zpráva (bez DOM).
   Noviny = archiv důležitých událostí (h.noviny, nejnovější na konci, nejvýš 200); velké události jdou i do h.zpravy
   s polem `noviny` (prohlížeč je ukáže jako novinovou kartu). Úspěchy = h.uspechy {id: den splnění}.
   Volá MAG.hra: denni (zachytí nové zprávy, úspěchy), mesicni (milníky měst), rocni (výroční zpráva). */
(function (MAG) {
  'use strict';
  const D = MAG.data, H = MAG.hra;

  // zpráva → rubrika novin (podle začátku textu), velká = karta na obrazovce
  const RUBRIKY = [
    [/^🎉 První/, 'Doprava', true],
    [/^🆕/, 'Technika', true],
    [/^🏭 Nový podnik/, 'Průmysl', false],
    [/^🏚️/, 'Průmysl', false],
    [/^📉 Hospodářská krize/, 'Ekonomika', true],
    [/^📈 Hospodářská krize skončila/, 'Ekonomika', true],
    [/^📈 .* zvyšuje výrobu/, 'Průmysl', false],
    [/^🥫/, 'Města', false],
    [/^🔄/, 'Firma', false],
    [/^💥 (Srážka|.* havarovalo)/, 'Neštěstí', true],
  ];
  function pridej(h, z) {
    if (!h.noviny) h.noviny = [];
    h.noviny.push(z);
    if (h.noviny.length > 200) h.noviny.shift();
    if (z.velka) h.zpravy.push({ den: h.den, noviny: z, tiche: true });
  }
  function titulek(text) {
    // titulek = text bez úvodní ikony, první věta
    return text.replace(/^\S+\s/, '').split(/[!–]/)[0].trim();
  }

  // --- úspěchy ---------------------------------------------------------------------------------
  const souhrn = (h, k) => (h.stat && h.stat.celkem[k]) || 0;
  const preprava = (h, typ) => (h.stat && h.stat.celkem.preprava[typ]) || 0;
  const aktivnich = h => h.vozidla.filter(H.aktivni).length;
  const prvni = (h, druh) => Object.keys(h.prvni || {}).some(k => k.endsWith(':' + druh));
  const USPECHY = [
    { id: 'bus', ikona: '🚌', nazev: 'První linka', popis: 'Autobus přijel na svou první zastávku', splneno: h => prvni(h, 'bus') },
    { id: 'nakl', ikona: '🚚', nazev: 'Náklad na cestě', popis: 'První nákladní auto dojelo na stanoviště', splneno: h => prvni(h, 'nakl') },
    { id: 'vlak', ikona: '🚂', nazev: 'Železniční éra', popis: 'První vlak přijel na nádraží', splneno: h => prvni(h, 'vlak') },
    { id: 'lod', ikona: '⛴️', nazev: 'Námořník', popis: 'První loď zakotvila v přístavu', splneno: h => prvni(h, 'lod') },
    { id: 'let', ikona: '✈️', nazev: 'Vzhůru do oblak', popis: 'První letadlo přistálo', splneno: h => prvni(h, 'let') },
    { id: 'pet', ikona: '🗺️', nazev: 'Všemi směry', popis: 'Vydělat autobusem, náklaďákem, vlakem, lodí i letadlem', splneno: h => ['bus', 'nakl', 'vlak', 'lod', 'let'].every(d => souhrn(h, 'vozem_' + d) > 0) },
    { id: 'flotila10', ikona: '🚍', nazev: 'Malá flotila', popis: 'Mít 10 vozidel', splneno: h => aktivnich(h) >= 10 },
    { id: 'flotila50', ikona: '🚆', nazev: 'Dopravní impérium', popis: 'Mít 50 vozidel', splneno: h => aktivnich(h) >= 50 },
    { id: 'lide10k', ikona: '🧑‍🤝‍🧑', nazev: 'Deset tisíc cest', popis: 'Převézt 10 000 cestujících', splneno: h => preprava(h, 'lide') >= 10000 },
    { id: 'uhli50k', ikona: '⚫', nazev: 'Uhelný baron', popis: 'Převézt 50 000 t uhlí', splneno: h => preprava(h, 'uhli') >= 50000 },
    { id: 'milion', ikona: '💰', nazev: 'Milionář', popis: 'Mít na účtu $1 000 000', splneno: h => h.firma.penize >= 1e6 },
    { id: 'hodnota10m', ikona: '🏦', nazev: 'Magnát', popis: 'Hodnota firmy $10 000 000', splneno: h => H.hodnotaFirmy(h) >= 1e7 },
    { id: 'bezdluhu', ikona: '🧾', nazev: 'Bez dluhů', popis: 'Splatit celý úvěr', splneno: h => h.den > 30 && h.firma.uver === 0 },
    { id: 'zisk100k', ikona: '📈', nazev: 'Výnosný rok', popis: 'Roční zisk přes $100 000', splneno: h => Object.values(h.fin.loni || {}).reduce((a, b) => a + b, 0) >= 100000 },
    { id: 'vyborne', ikona: '⭐', nazev: 'Oblíbená firma', popis: 'Výborné hodnocení u některého města', splneno: h => (h.mestaStat || []).some(s => s.hodn >= 600) },
    { id: 'velkomesto', ikona: '🏙️', nazev: 'Velkoměsto', popis: 'Obsluhované město přerostlo 5 000 obyvatel', splneno: h => h.m.mesta.some(c => c.obyv >= 5000 && H.obsluhovanychStanic(h, c) > 0) },
  ];

  function zkontrolujUspechy(h) {
    if (!h.uspechy) h.uspechy = {};
    for (const u of USPECHY) {
      if (h.uspechy[u.id] !== undefined || !u.splneno(h)) continue;
      h.uspechy[u.id] = h.den;
      pridej(h, { den: h.den, rubrika: 'Úspěch', titulek: `${u.ikona} ${u.nazev}`, text: u.popis, uspech: u.id, velka: true });
    }
  }

  // --- denně, měsíčně, ročně ------------------------------------------------------------------------
  // archivace zpráv do novin – volá se v každém ticku, kdy nějaké zprávy jsou (prohlížeč je po dávce ticků odebírá)
  function zachyt(h) {
    for (const z of h.zpravy) {
      if (z.archiv || !z.text) continue;
      z.archiv = true;
      const r = RUBRIKY.find(([re]) => re.test(z.text));
      if (r) pridej(h, { den: h.den, rubrika: r[1], titulek: titulek(z.text), text: z.text.replace(/^\S+\s/, ''), x: z.x, y: z.y, vozidlo: z.vozidlo, velka: r[2] });
    }
  }
  function denni(h) { zkontrolujUspechy(h); }
  const MILNIKY = [1000, 2500, 5000, 10000, 20000];
  function mesicni(h) {
    for (const c of h.m.mesta) {
      const s = h.mestaStat && h.mestaStat[c.id];
      if (!s) continue;
      if (s.milnik === undefined) s.milnik = MILNIKY.filter(n => c.obyv >= n).length;   // dosažené už na začátku se neslaví
      const dosazeno = MILNIKY.filter(n => c.obyv >= n).length;
      if (dosazeno > s.milnik) {
        s.milnik = dosazeno;
        pridej(h, { den: h.den, rubrika: 'Města', titulek: `${c.jmeno} má přes ${MILNIKY[dosazeno - 1].toLocaleString('cs-CZ')} obyvatel`, text: `Město roste${H.obsluhovanychStanic(h, c) ? ' díky dobré dopravě' : ''}.`, x: c.x, y: c.y, velka: dosazeno >= 3 });
      }
    }
  }
  function rocni(h) {
    const r = H.rok(h) - 1, loni = h.fin.loni || {};
    const prijmy = Object.values(loni).filter(v => v > 0).reduce((a, b) => a + b, 0);
    const vydaje = -Object.values(loni).filter(v => v < 0).reduce((a, b) => a + b, 0);
    const mesice = (h.fin.mesice || []).filter(x => x.rok === r);
    const prev = {};
    for (const x of mesice) for (const [k, n] of Object.entries(x.preprava || {})) prev[k] = (prev[k] || 0) + n;
    const vs = h.vozidla.filter(H.aktivni);
    const nej = vs.slice().sort((a, b) => b.zisk.loni - a.zisk.loni)[0], nejh = vs.slice().sort((a, b) => a.zisk.loni - b.zisk.loni)[0];
    if (!vs.length && !prijmy) return;
    pridej(h, {
      den: h.den, rubrika: 'Výroční zpráva', titulek: `Výroční zpráva ${r}`, velka: true,
      vyrocni: { rok: r, prijmy: Math.round(prijmy), vydaje: Math.round(vydaje), zisk: Math.round(prijmy - vydaje), preprava: prev,
        hodnota: Math.round(H.hodnotaFirmy(h)), vozidel: vs.length, odpisy: h.fin.odpisyLoni,
        nejlepsi: nej ? { jmeno: nej.jmeno, zisk: nej.zisk.loni, id: nej.id } : null,
        nejhorsi: nejh && nejh !== nej && nejh.zisk.loni < 0 ? { jmeno: nejh.jmeno, zisk: nejh.zisk.loni, id: nejh.id } : null },
      text: `Zisk ${prijmy - vydaje >= 0 ? '' : '−'}$${Math.abs(Math.round(prijmy - vydaje)).toLocaleString('cs-CZ')}`,
    });
  }

  // linky = vozidla se stejným pořadím stanic (a druhem); pro přehled linek
  function linky(h) {
    const mapa = new Map();
    for (const v of h.vozidla) {
      if (!H.aktivni(v) || !v.rozkazy.length) continue;
      const klic = v.druh + ':' + v.rozkazy.map(r => r.st).join('>');
      let l = mapa.get(klic);
      if (!l) mapa.set(klic, l = { druh: v.druh, stanice: v.rozkazy.map(r => r.st), vozidla: [], letos: 0, loni: 0 });
      l.vozidla.push(v.id); l.letos += v.zisk.letos; l.loni += v.zisk.loni;
    }
    return [...mapa.values()].sort((a, b) => b.loni - a.loni || b.letos - a.letos);
  }

  MAG.prehledy = { USPECHY, zachyt, denni, mesicni, rocni, zkontrolujUspechy, linky, pridej };
})(globalThis.MAG = globalThis.MAG || {});
