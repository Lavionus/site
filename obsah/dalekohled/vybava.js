/* dalekohled/vybava.js – vybavení: dalekohledy, okuláry, Barlowovy čočky a reduktory, filtry, kamery.
   Předvolby + vlastní položky uložené v localStorage (webapp_dalekohled_vybava), export/import JSON. */
(function (koren) {
  'use strict';
  const KLIC = 'webapp_dalekohled_vybava';

  const DALEKOHLEDY = [
    { id: 'galileo', nazev: 'Galileův dalekohled 1609 (replika, 20×)', D: 26, F: 980, typ: 'galileo', vada: 'cocka', obstrukce: 0, pevneZvetseni: 20, pevnePole: 0.25, montaz: 'az', diag: 0 },
    { id: 'r70', nazev: 'Refraktor 70/700 (začátečnický)', D: 70, F: 700, typ: 'refraktor', vada: 'achromat', obstrukce: 0, montaz: 'az', diag: 1 },
    { id: 'r102', nazev: 'Refraktor 102/1000 achromát', D: 102, F: 1000, typ: 'refraktor', vada: 'achromat', obstrukce: 0, montaz: 'eq', diag: 1 },
    { id: 'apo80', nazev: 'Apochromát 80/480', D: 80, F: 480, typ: 'refraktor', vada: 'apo', obstrukce: 0, montaz: 'eq', diag: 1 },
    { id: 'apo130', nazev: 'Apochromát 130/910', D: 130, F: 910, typ: 'refraktor', vada: 'apo', obstrukce: 0, montaz: 'eq', diag: 1, sledovani: true },
    { id: 'n114', nazev: 'Newton 114/900', D: 114, F: 900, typ: 'newton', vada: 'zadna', obstrukce: 0.25, montaz: 'eq', diag: 0 },
    { id: 'n200f4', nazev: 'Newton 200/800 (astrograf f/4)', D: 200, F: 800, typ: 'newton', vada: 'zadna', obstrukce: 0.35, montaz: 'eq', diag: 0, sledovani: true },
    { id: 'd150', nazev: 'Dobson 150/1200', D: 150, F: 1200, typ: 'newton', vada: 'zadna', obstrukce: 0.22, montaz: 'az', diag: 0 },
    { id: 'd200', nazev: 'Dobson 200/1200', D: 200, F: 1200, typ: 'newton', vada: 'zadna', obstrukce: 0.22, montaz: 'az', diag: 0 },
    { id: 'd300', nazev: 'Dobson 300/1500', D: 300, F: 1500, typ: 'newton', vada: 'zadna', obstrukce: 0.2, montaz: 'az', diag: 0 },
    { id: 'd400', nazev: 'Dobson 400/1800', D: 400, F: 1800, typ: 'newton', vada: 'zadna', obstrukce: 0.2, montaz: 'az', diag: 0 },
    { id: 'sct8', nazev: 'Schmidt-Cassegrain 203/2032 (GoTo)', D: 203, F: 2032, typ: 'sct', vada: 'zadna', obstrukce: 0.34, montaz: 'az', diag: 1, sledovani: true },
    { id: 'sct11', nazev: 'Schmidt-Cassegrain 280/2800', D: 280, F: 2800, typ: 'sct', vada: 'zadna', obstrukce: 0.34, montaz: 'eq', diag: 1, sledovani: true },
    { id: 'mak127', nazev: 'Maksutov 127/1500', D: 127, F: 1500, typ: 'mak', vada: 'zadna', obstrukce: 0.3, montaz: 'eq', diag: 1, sledovani: true },
    { id: 'rc8', nazev: 'Ritchey-Chrétien 203/1624', D: 203, F: 1624, typ: 'sct', vada: 'zadna', obstrukce: 0.45, montaz: 'eq', diag: 0, sledovani: true },
    { id: 'triedr', nazev: 'Triedr 10×50', D: 50, F: 200, typ: 'triedr', vada: 'achromat', obstrukce: 0, pevneZvetseni: 10, pevnePole: 6.5, montaz: 'az', diag: 0 },
    { id: 'triedr2', nazev: 'Triedr 15×70', D: 70, F: 300, typ: 'triedr', vada: 'achromat', obstrukce: 0, pevneZvetseni: 15, pevnePole: 4.4, montaz: 'az', diag: 0 },
  ];
  // okuláry: f mm, zdánlivé pole °, clona pole mm (pokud známa – přesnější skutečné pole)
  const OKULARY = [
    { id: 'p40', f: 40, afov: 43, clona: 27, n: 'Plössl' }, { id: 'p32', f: 32, afov: 52, clona: 27, n: 'Plössl' },
    { id: 'p25', f: 25, afov: 52, clona: 21.5, n: 'Plössl' }, { id: 'w20', f: 20, afov: 68, n: 'širokoúhlý' },
    { id: 'p15', f: 15, afov: 52, n: 'Plössl' }, { id: 'p12', f: 12.5, afov: 52, n: 'Plössl' }, { id: 'p10', f: 10, afov: 52, n: 'Plössl' },
    { id: 'w8', f: 8, afov: 68, n: 'širokoúhlý' }, { id: 'pl6', f: 6, afov: 60, n: 'planetární' }, { id: 'pl5', f: 5, afov: 60, n: 'planetární' },
    { id: 'pl4', f: 4, afov: 58, n: 'planetární' }, { id: 'pl3', f: 3, afov: 58, n: 'planetární' },
    { id: 'u31', f: 31, afov: 82, n: 'ultraširokoúhlý', vybaveno: false }, { id: 'u13', f: 13, afov: 100, n: 'ultraširokoúhlý 100°', vybaveno: false },
    { id: 'z8', f: 8, afov: 57, n: 'zoom 8–24 (8 mm)', vybaveno: false }, { id: 'z24', f: 24, afov: 40, n: 'zoom 8–24 (24 mm)', vybaveno: false },
  ];
  const PRISLUSENSTVI = [
    { id: '1', n: 'bez', k: 1 }, { id: 'b2', n: 'Barlow 2×', k: 2 }, { id: 'b3', n: 'Barlow 3×', k: 3 }, { id: 'pm5', n: 'Powermate 5×', k: 5 },
    { id: 'r08', n: 'reduktor 0,8×', k: 0.8 }, { id: 'r063', n: 'reduktor 0,63×', k: 0.63 },
  ];
  // filtry: ztlumení (mag) pozadí oblohy, spojitého světla (hvězdy, galaxie), emisních čar (mlhoviny), těles; barva náhledu
  const FILTRY = [
    { id: 'zadny', n: 'bez filtru', pozadi: 0, hvezdy: 0, emisni: 0, telesa: 0 },
    { id: 'uhc', n: 'UHC (úzkopásmový mlhovinový)', pozadi: 1.6, hvezdy: 1.0, emisni: 0.25, telesa: 1.0, barva: [120, 255, 200] },
    { id: 'oiii', n: 'OIII', pozadi: 2.7, hvezdy: 2.0, emisni: 0.45, telesa: 2.0, barva: [90, 255, 220] },
    { id: 'hbeta', n: 'Hβ (Koňská hlava, Kalifornie)', pozadi: 3.2, hvezdy: 2.6, emisni: 1.4, telesa: 2.6, barva: [80, 200, 255] },
    { id: 'cls', n: 'CLS (proti světelnému znečištění)', pozadi: 0.9, hvezdy: 0.5, emisni: 0.15, telesa: 0.5, barva: [255, 170, 230] },
    { id: 'mesic', n: 'měsíční ND 13 %', pozadi: 2.2, hvezdy: 2.2, emisni: 2.2, telesa: 2.2, barva: [200, 210, 200] },
    { id: 'w21', n: 'oranžový #21 (Mars)', pozadi: 0.6, hvezdy: 0.6, emisni: 1.5, telesa: 0.5, barva: [255, 150, 70] },
    { id: 'w80a', n: 'modrý #80A (Jupiter)', pozadi: 0.9, hvezdy: 0.9, emisni: 0.6, telesa: 0.9, barva: [140, 175, 255] },
    { id: 'slunce', n: 'sluneční fólie ND 5 (celoaperturní)', pozadi: 12.5, hvezdy: 12.5, emisni: 12.5, telesa: 12.5, barva: [255, 255, 255], slunecni: true },
  ];
  // kamery: čip mm, pixel µm, rozlišení
  const KAMERY = [
    { id: 'asi120', n: 'ZWO ASI120MC (planetární)', sirka: 4.8, vyska: 3.6, pixel: 3.75, barevna: true },
    { id: 'asi224', n: 'ZWO ASI224MC (planetární)', sirka: 4.9, vyska: 3.7, pixel: 3.75, barevna: true },
    { id: 'asi462', n: 'ZWO ASI462MC (planetární)', sirka: 5.6, vyska: 3.2, pixel: 2.9, barevna: true },
    { id: 'asi533', n: 'ZWO ASI533MC Pro (1″, čtverec)', sirka: 11.3, vyska: 11.3, pixel: 3.76, barevna: true },
    { id: 'asi294', n: 'ZWO ASI294MC Pro (4/3″)', sirka: 19.1, vyska: 13.0, pixel: 4.63, barevna: true },
    { id: 'asi2600', n: 'ZWO ASI2600MC Pro (APS-C)', sirka: 23.5, vyska: 15.7, pixel: 3.76, barevna: true },
    { id: 'asi6200', n: 'ZWO ASI6200MM Pro (full frame, mono)', sirka: 36, vyska: 24, pixel: 3.76, barevna: false },
    { id: 'apsc', n: 'zrcadlovka APS-C 24 Mpx', sirka: 23.5, vyska: 15.6, pixel: 3.9, barevna: true },
    { id: 'ff', n: 'full frame 24 Mpx', sirka: 35.9, vyska: 23.9, pixel: 5.95, barevna: true },
  ];

  let vlastni = { dalekohledy: [], okulary: [], kamery: [], vybaveno: null };
  try { Object.assign(vlastni, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* nic */ }
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(vlastni)); } catch (e) { /* plné úložiště */ } };
  if (!vlastni.vybaveno) vlastni.vybaveno = OKULARY.filter(o => o.vybaveno !== false).map(o => o.id);

  const API = {
    FILTRY, PRISLUSENSTVI, KAMERY_PRESETY: KAMERY,
    dalekohledy: () => DALEKOHLEDY.concat(vlastni.dalekohledy.map(d => ({ ...d, vlastni: true }))),
    okularyVse: () => OKULARY.concat(vlastni.okulary.map(o => ({ ...o, vlastni: true }))).sort((a, b) => b.f - a.f),
    okulary: () => API.okularyVse().filter(o => vlastni.vybaveno.includes(o.id)),
    kamery: () => KAMERY.concat(vlastni.kamery.map(k => ({ ...k, vlastni: true }))),
    dalekohled: id => API.dalekohledy().find(d => d.id === id) || DALEKOHLEDY.find(d => d.id === 'd200'),
    okular: id => API.okularyVse().find(o => o.id === id) || API.okulary()[0] || OKULARY[2],
    kamera: id => API.kamery().find(k => k.id === id) || KAMERY[0],
    filtr: id => FILTRY.find(f => f.id === id) || FILTRY[0],
    prislusenstvi: id => PRISLUSENSTVI.find(p => p.id === id) || PRISLUSENSTVI[0],
    jeVybaven: id => vlastni.vybaveno.includes(id),
    nastavVybaveni(id, ano) {
      vlastni.vybaveno = vlastni.vybaveno.filter(x => x !== id);
      if (ano) vlastni.vybaveno.push(id);
      uloz();
    },
    pridej(druh, polozka) {
      const id = 'v' + Date.now().toString(36);
      vlastni[druh].push({ ...polozka, id });
      if (druh === 'okulary') vlastni.vybaveno.push(id);
      uloz();
      return id;
    },
    odeber(druh, id) { vlastni[druh] = vlastni[druh].filter(x => x.id !== id); vlastni.vybaveno = vlastni.vybaveno.filter(x => x !== id); uloz(); },
    export: () => JSON.stringify({ format: 'dalekohled-vybava-1', ...vlastni }, null, 2),
    import(text) {
      const d = JSON.parse(text);
      if (!d || d.format !== 'dalekohled-vybava-1') throw new Error('Soubor není export vybavení z této stránky.');
      for (const k of ['dalekohledy', 'okulary', 'kamery']) if (!Array.isArray(d[k])) throw new Error('Chybí seznam ' + k + '.');
      vlastni = { dalekohledy: d.dalekohledy, okulary: d.okulary, kamery: d.kamery, vybaveno: Array.isArray(d.vybaveno) ? d.vybaveno : vlastni.vybaveno };
      uloz();
    },
  };
  koren.DALEK_VYBAVA = API;
})(typeof window !== 'undefined' ? window : globalThis);
