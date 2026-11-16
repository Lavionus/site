// Jádro kalkulačky filamentu – čisté výpočty bez DOM (testuje _test/filament_calc_test.js).
// Jednotky: hmotnost g, délka m, objem cm³, průměr mm, hustota g/cm³.
// Pomůcka: cm³ / mm² = m (1 cm³ = 1000 mm³, 1 m = 1000 mm), proto délka = objem / průřez.
(function (koren) {
  'use strict';

  // Orientační hustoty (přesnou uvádí výrobce v technickém listu)
  const MATERIALY = [
    { id: 'pla', nazev: 'PLA', hustota: 1.24 },
    { id: 'petg', nazev: 'PETG', hustota: 1.27 },
    { id: 'abs', nazev: 'ABS', hustota: 1.04 },
    { id: 'asa', nazev: 'ASA', hustota: 1.07 },
    { id: 'tpu', nazev: 'TPU / flex', hustota: 1.21 },
    { id: 'pa', nazev: 'Nylon (PA)', hustota: 1.14 },
    { id: 'pc', nazev: 'PC', hustota: 1.20 },
    { id: 'hips', nazev: 'HIPS', hustota: 1.04 },
    { id: 'pp', nazev: 'PP', hustota: 0.90 },
    { id: 'pva', nazev: 'PVA', hustota: 1.23 },
    { id: 'placf', nazev: 'PLA-CF', hustota: 1.29 },
    { id: 'pla_drevo', nazev: 'PLA s dřevem', hustota: 1.15 },
  ];

  const kladne = x => (Number.isFinite(x) && x > 0 ? x : 0);

  // průřez filamentu v mm²
  function prurez(prumer) {
    return Math.PI * kladne(prumer) * kladne(prumer) / 4;
  }

  // Ze zadané veličiny dopočítá ostatní dvě. velicina: 'g' | 'm' | 'cm3'
  function preved(velicina, hodnota, hustota, prumer) {
    const h = kladne(hodnota), rho = kladne(hustota), S = prurez(prumer);
    if (!rho || !S) return { g: 0, m: 0, cm3: 0 };
    let cm3;
    if (velicina === 'g') cm3 = h / rho;
    else if (velicina === 'm') cm3 = h * S;
    else cm3 = h;
    return { g: cm3 * rho, m: cm3 / S, cm3 };
  }

  const gNaM = (g, hustota, prumer) => preved('g', g, hustota, prumer).m;
  const mNaG = (m, hustota, prumer) => preved('m', m, hustota, prumer).g;

  // Zbytek na cívce z vážení: brutto (cívka i s filamentem) − tára (prázdná cívka)
  function zbytek({ brutto, tara, hustota, prumer, vytiskG = 0 }) {
    const g = Math.max(0, (+brutto || 0) - (+tara || 0));
    const vytisk = kladne(vytiskG);
    return {
      g,
      m: gNaM(g, hustota, prumer),
      kusu: vytisk ? Math.floor(g / vytisk) : null,
    };
  }

  // Cena výtisku. Vstupy: hmotnost modelu g, odpad % (podpory, čištění),
  // cena cívky + hmotnost náplně, příkon W, doba h, Kč/kWh, opotřebení Kč/h,
  // zmetkovitost %, přirážka %, počet kusů.
  function cena(v) {
    const g = kladne(v.g) * (1 + kladne(v.odpad) / 100);
    const kcG = kladne(v.naplnG) ? kladne(v.cenaCivky) / v.naplnG : 0;
    const material = g * kcG;
    const elektrina = kladne(v.prikonW) / 1000 * kladne(v.hodin) * kladne(v.kcKwh);
    const stroj = kladne(v.opotrebeniKcH) * kladne(v.hodin);
    const prace = kladne(v.praceKc);
    const vyroba = material + elektrina + stroj + prace;
    const zmetky = Math.min(kladne(v.zmetkovitost), 90);
    const sRiziky = vyroba / (1 - zmetky / 100);
    const celkem = sRiziky * (1 + kladne(v.prirazka) / 100);
    const kusu = Math.max(1, Math.round(kladne(v.kusu)) || 1);
    return {
      gCelkem: g, material, elektrina, stroj, prace,
      zmetky: sRiziky - vyroba, marze: celkem - sRiziky,
      celkem, naKus: celkem / kusu,
    };
  }

  const api = { MATERIALY, prurez, preved, gNaM, mNaG, zbytek, cena };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else koren.FIL = api;
})(this);
