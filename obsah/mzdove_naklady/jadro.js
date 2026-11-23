/* Mzdové náklady zaměstnavatele – jádro bez DOM (test: _test/mzdove_naklady_test.js).
   Měsíční výpočet (hrubá → odvody, záloha na daň, čistá, náklad firmy) pro pracovní poměr, DPP a DPČ,
   roční náklad s dovolenou, svátky a náhradou mzdy při nemoci, náklad na hodinu skutečné práce,
   zpětné dopočty (z čisté / z rozpočtu), srovnání HPP × DPP × OSVČ a tým zaměstnanců.
   Používá OsvcJadro (osvc/jadro.js) a DavkyJadro (davky/jadro.js – náhrada mzdy).
   Parametry jsou ručně stárnoucí data – stav k 11/2026; `overit` = nepotvrzeno z úředního zdroje. */
(function () {
  'use strict';
  const VERZE = 1;
  const KLIC = 'webapp_mzdove_naklady';
  const STAV_K = '11/2026';
  const uzel = typeof module !== 'undefined';
  const OSVC = uzel ? require('../osvc/jadro.js') : window.OsvcJadro;
  const DAVKY = uzel ? require('../davky/jadro.js') : window.DavkyJadro;

  /* Zdroje 2026: průměrná mzda NV 365/2025 Sb.; minimální mzda NV 2025 (22 400 Kč / 134,40 Kč/h);
     zákon 589/1992 Sb. (SP 24,8 % + 7,1 %, max. VZ 48× PM, sleva § 7a); zákon 592/1992 Sb. (ZP 13,5 %, MVZ = min. mzda);
     zákon 586/1992 Sb. (záloha 15 %/23 % nad 3× PM měsíčně, slevy § 35ba, zvýhodnění § 35c, srážková daň § 36);
     vyhláška MPSV 573/2025 Sb. (stravné 5–12 h horní hranice 185 Kč → paušál 70 % = 129,50 Kč);
     vyhláška 125/1993 Sb. (zákonné pojištění odpovědnosti, příloha 2). */
  const PARAMETRY = {
    2026: {
      rok: 2026,
      prumernaMzda: 48967, minMzda: 22400, minHod: 134.40,
      sp: { firma: 0.248, zam: 0.071, maxVZ: 2350416 },
      zp: { sazba: 0.135, minVZ: 22400 },
      dan: { sazba: 0.15, vyssi: 0.23, hraniceMes: 146901 },
      slevy: { poplatnik: 2570, invalidita12: 210, invalidita3: 420, ztpp: 1345, deti: [1267, 1860, 2320], bonusMinPrijem: 11200, bonusMin: 50 },
      dpp: { limit: 12000, maxHodinRok: 300 },
      dpc: { limit: 4500 },                    // zároveň hranice zaměstnání malého rozsahu (i u pracovního poměru)
      slevaUvazek: { sazba: 0.05, maxVZ: 73450.5, maxHodinova: 563.12, hodinOd: 8, hodinDo: 30, maxHodinMes: 138 },
      strava: { pausal: 129.5, stravne512: 185, uznatelnePrispevek: 71.23 },
      benefity: { volnocas: 24483.5, zdravi: 48967, penzijni: 50000 },
      zdroje: { pm: 'NV 365/2025 Sb.', mm: 'NV o minimální mzdě (2026)', hranice: 'sdělení MPSV 397/2025 Sb.' }
    },
    /* 2027: průměrná mzda NV 177/2026 Sb. (51 663 Kč), minimální mzda sdělení MPSV 171/2026 Sb. (24 900 Kč / 148,30 Kč/h),
       limit DPP 184/2026 Sb., rozhodný příjem 186/2026 Sb., redukční hranice 185/2026 Sb. Slevy na dani beze změny;
       nové slevy (student, školkovné – zákon 180/2026 Sb.) se v měsíční záloze nepočítají.
       ⚠ Stravné 2027 (vyhláška MPSV) ještě nevyšlo – použito 2026. Volnočasové benefity: podle EY zákon 180/2026 Sb.
       limit ½ PM ruší (rekreace zvlášť do 20 000 Kč) – v textu zákona neověřeno, počítáme dál s ½ PM. */
    2027: {
      rok: 2027,
      prumernaMzda: 51663, minMzda: 24900, minHod: 148.30,
      sp: { firma: 0.248, zam: 0.071, maxVZ: 2479824 },
      zp: { sazba: 0.135, minVZ: 24900 },
      dan: { sazba: 0.15, vyssi: 0.23, hraniceMes: 154989 },
      slevy: { poplatnik: 2570, invalidita12: 210, invalidita3: 420, ztpp: 1345, deti: [1267, 1860, 2320], bonusMinPrijem: 12450, bonusMin: 50 },
      dpp: { limit: 12500, maxHodinRok: 300 },
      dpc: { limit: 5000 },
      slevaUvazek: { sazba: 0.05, maxVZ: 77494.5, maxHodinova: 594.12, hodinOd: 8, hodinDo: 30, maxHodinMes: 138 },
      strava: { pausal: 129.5, stravne512: 185, uznatelnePrispevek: 71.23, overit: true },
      benefity: { volnocas: 25831.5, zdravi: 51663, penzijni: 50000, overit: true },
      zdroje: { pm: 'NV 177/2026 Sb.', mm: 'sdělení MPSV 171/2026 Sb.', hranice: 'sdělení MPSV 185/2026 Sb.' }
    }
  };
  const ROKY = Object.keys(PARAMETRY).map(Number);
  const ROK_TED = PARAMETRY[new Date().getFullYear()] ? new Date().getFullYear() : ROKY[ROKY.length - 1];
  const param = rok => PARAMETRY[rok] || PARAMETRY[ROK_TED];

  /* Kategorie zákonného pojištění odpovědnosti (vyhláška 125/1993 Sb., příloha 2 – podle převažující činnosti OKEČ). */
  const POV = [
    { sazba: 2.8, nazev: 'Peněžnictví, pojišťovnictví, IT a zpracování dat, reklama, vydavatelství, foto, kadeřnictví a kosmetika' },
    { sazba: 4.2, nazev: 'Účetnictví a poradenství, inženýrské služby, školství, zdravotnictví, sociální služby, pohostinství, ubytování, nemovitosti, telekomunikace, veřejná správa, oděvy a obuv, elektronika' },
    { sazba: 5.6, nazev: 'Ostatní činnosti nezařazené jinde (obchod, opravy, většina služeb)' },
    { sazba: 7.0, nazev: 'Zemědělství, výroba nábytku, pozemní doprava, odpady a kanalizace, veterina' },
    { sazba: 8.4, nazev: 'Strojírenství, kovové konstrukce, truhlářství a tesařství, chemie, keramika a beton, papír, mlékárny, nápoje' },
    { sazba: 9.8, nazev: 'Stavebnictví, zpracování masa, pily, slévárny, lesnictví, hasiči' },
    { sazba: 10.5, nazev: 'Rizikové činnosti nezařazené jinde (výbušniny, radioaktivní látky, jedy, práce ve výškách a hloubkách)' },
    { sazba: 50.4, nazev: 'Těžba černého uhlí, uranu a rud' }
  ];

  const TYPY = { hpp: 'Pracovní poměr', dpp: 'DPP', dpc: 'DPČ' };
  const TYDNU_MES = 365.25 / 7 / 12;
  const ceil = x => Math.ceil(x - 1e-9);
  const floor = x => Math.floor(x + 1e-9);
  const cislo = (x, d) => { const n = Number(String(x == null ? '' : x).replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : d; };
  const nez = (x, d) => Math.max(0, cislo(x, d));
  const kc = n => (Math.round(n) || 0).toLocaleString('cs-CZ') + ' Kč';

  /* ---------- kalendář ---------- */
  function velikonoce(rok) {   // anonymní gregoriánský algoritmus → neděle
    const a = rok % 19, b = Math.floor(rok / 100), c = rok % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(rok, mes - 1, den);
  }
  function svatky(rok) {
    const v = velikonoce(rok);
    const pevne = ['1-1', '5-1', '5-8', '7-5', '7-6', '9-28', '10-28', '11-17', '12-24', '12-25', '12-26']
      .map(s => { const [m, d] = s.split('-').map(Number); return new Date(rok, m - 1, d); });
    return pevne.concat([new Date(rok, v.getMonth(), v.getDate() - 2), new Date(rok, v.getMonth(), v.getDate() + 1)]);
  }
  /* Všední dny v roce a z nich svátky (placené v měsíční mzdě, ale neodpracované). */
  function kalendar(rok) {
    let vsedni = 0;
    for (let d = new Date(rok, 0, 1); d.getFullYear() === rok; d.setDate(d.getDate() + 1)) if (d.getDay() % 6) vsedni++;
    const svatkyVsedni = svatky(rok).filter(d => d.getDay() % 6).length;
    return { vsedni, svatky: svatkyVsedni, pracovni: vsedni - svatkyVsedni };
  }

  /* ---------- vstup ---------- */
  const VYCHOZI = {
    rok: ROK_TED, typ: 'hpp', hruba: 45000, hodinTydne: 40, plnyTyden: 40,
    prohlaseni: true, deti: 0, ztpDeti: 0, invalidita: '0', slevaUvazek: false, zpBezMinima: false,
    strava: 'zadna', stravaKc: 129.5, volnocasRok: 0, zdraviRok: 0, penzijniMes: 0,
    pov: 4.2, dovolenaTydnu: 4, nemocDni: 6
  };
  function normVstup(v) {
    v = Object.assign({}, VYCHOZI, v || {});
    const P = param(v.rok);
    const deti = Math.min(20, Math.floor(nez(v.deti, 0)));
    return {
      rok: P.rok, typ: TYPY[v.typ] ? v.typ : 'hpp',
      hruba: nez(v.hruba, 0), hodinTydne: Math.min(80, nez(v.hodinTydne, 40)), plnyTyden: Math.min(40, Math.max(30, nez(v.plnyTyden, 40))),
      prohlaseni: !!v.prohlaseni, deti, ztpDeti: Math.min(deti, Math.floor(nez(v.ztpDeti, 0))),
      invalidita: ['0', '12', '3', 'ztpp'].includes(String(v.invalidita)) ? String(v.invalidita) : '0',
      slevaUvazek: !!v.slevaUvazek, zpBezMinima: !!v.zpBezMinima,
      strava: ['zadna', 'pausal', 'stravenky'].includes(v.strava) ? v.strava : 'zadna', stravaKc: nez(v.stravaKc, 0),
      volnocasRok: nez(v.volnocasRok, 0), zdraviRok: nez(v.zdraviRok, 0), penzijniMes: nez(v.penzijniMes, 0),
      pov: Math.min(60, nez(v.pov, 4.2)), dovolenaTydnu: Math.min(10, nez(v.dovolenaTydnu, 4)), nemocDni: Math.min(60, nez(v.nemocDni, 0))
    };
  }

  /* Průměrný počet odpracovaných dnů v měsíci (stravování se poskytuje za odpracovanou směnu). */
  function odpracovaneDny(v) {
    const k = kalendar(v.rok);
    return Math.max(0, k.pracovni - v.dovolenaTydnu * 5 - v.nemocDni);
  }

  /* ---------- benefity (měsíčně) ---------- */
  function benefity(v, P, dnyMes) {
    const b = { strava: 0, stravaZdan: 0, volnocas: v.volnocasRok / 12, zdravi: v.zdraviRok / 12, penzijni: v.penzijniMes, pozn: [] };
    if (v.strava === 'pausal') {
      b.strava = v.stravaKc * dnyMes;
      b.stravaZdan = Math.max(0, v.stravaKc - P.strava.pausal) * dnyMes;
      if (b.stravaZdan) b.pozn.push('Stravenkový paušál nad ' + P.strava.pausal.toLocaleString('cs-CZ') + ' Kč za směnu je zdanitelný a podléhá pojistnému.');
    } else if (v.strava === 'stravenky') {
      b.strava = v.stravaKc * dnyMes;
      if (v.stravaKc > P.strava.uznatelnePrispevek) b.pozn.push('Příspěvek na stravenku je daňově uznatelný jen do 55 % ceny jídla, nejvýš ' + P.strava.uznatelnePrispevek.toLocaleString('cs-CZ') + ' Kč.');
    }
    const B = P.benefity;
    b.volnocasZdan = Math.max(0, v.volnocasRok - B.volnocas) / 12;
    b.zdraviZdan = Math.max(0, v.zdraviRok - B.zdravi) / 12;
    b.penzijniZdan = Math.max(0, v.penzijniMes * 12 - B.penzijni) / 12;
    b.zdanitelne = b.stravaZdan + b.volnocasZdan + b.zdraviZdan + b.penzijniZdan;
    b.naklad = b.strava + b.volnocas + b.zdravi + b.penzijni;
    if (b.volnocasZdan) b.pozn.push('Volnočasové benefity nad ' + kc(B.volnocas) + ' ročně se zdaňují a podléhají pojistnému.');
    if (b.zdraviZdan) b.pozn.push('Zdravotní benefity nad ' + kc(B.zdravi) + ' ročně se zdaňují a podléhají pojistnému.');
    if (b.penzijniZdan) b.pozn.push('Příspěvek na penzijní/životní pojištění nad ' + kc(B.penzijni) + ' ročně se zdaňuje a podléhá pojistnému.');
    return b;
  }

  /* ---------- měsíční výpočet ----------
     o.hruba = jiná hrubá mzda (roční průměr), o.dnyMes = dny stravování. */
  function mesic(vstup, o) {
    const v = normVstup(vstup), P = param(v.rok);
    o = o || {};
    const hruba = o.hruba != null ? o.hruba : v.hruba;
    const hodMes = v.hodinTydne * TYDNU_MES;
    const dnyMes = o.dnyMes != null ? o.dnyMes : odpracovaneDny(v) / 12;
    const ben = benefity(v, P, dnyMes);
    const vz = ceil(hruba + ben.zdanitelne);
    const varovani = [], info = ben.pozn.slice();

    // účast na pojištění: DPP od 12 000 Kč, DPČ i pracovní poměr od 4 500 Kč (zaměstnání malého rozsahu)
    const limit = v.typ === 'dpp' ? P.dpp.limit : P.dpc.limit;
    const ucast = vz >= limit;
    if (!ucast) info.push(v.typ === 'dpp'
      ? 'Odměna z DPP pod ' + kc(P.dpp.limit) + ' – bez sociálního a zdravotního pojištění.'
      : 'Příjem pod ' + kc(P.dpc.limit) + ' = zaměstnání malého rozsahu – v tomto měsíci se pojistné neplatí.');

    let spZam = 0, spFirma = 0, sleva = 0, zp = 0, zpZam = 0, zpFirma = 0, doplatek = 0, pov = 0;
    const slevaDuvody = [];
    if (ucast) {
      spZam = ceil(vz * P.sp.zam);
      spFirma = ceil(vz * P.sp.firma);
      zp = ceil(vz * P.zp.sazba);
      zpZam = ceil(zp / 3);
      zpFirma = zp - zpZam;
      if (!v.zpBezMinima && vz < P.zp.minVZ) doplatek = ceil((P.zp.minVZ - vz) * P.zp.sazba);
      pov = Math.round(vz * v.pov / 1000 * 100) / 100;
      if (v.slevaUvazek) {
        const S = P.slevaUvazek;
        if (v.typ !== 'hpp') slevaDuvody.push('jen pracovní poměr (ne dohody)');
        if (v.hodinTydne < S.hodinOd || v.hodinTydne > S.hodinDo) slevaDuvody.push('úvazek musí být ' + S.hodinOd + '–' + S.hodinDo + ' h týdně');
        if (hodMes > S.maxHodinMes) slevaDuvody.push('nejvýš ' + S.maxHodinMes + ' odpracovaných hodin v měsíci');
        if (vz > S.maxVZ) slevaDuvody.push('VZ nejvýš 1,5× průměrné mzdy (' + kc(S.maxVZ) + ')');
        if (hodMes > 0 && vz / hodMes > S.maxHodinova) slevaDuvody.push('hodinový výdělek nejvýš ' + S.maxHodinova.toLocaleString('cs-CZ') + ' Kč');
        if (!slevaDuvody.length) sleva = Math.round(vz * S.sazba);
      }
    }
    if (doplatek) info.push('Vyměřovací základ je pod minimální mzdou – doplatek zdravotního pojištění do minima ' + kc(doplatek) + ' sráží zaměstnanci (výjimky: státní pojištěnec, souběh s jiným zaměstnáním nebo OSVČ).');
    if (v.slevaUvazek && slevaDuvody.length) varovani.push('Slevu na pojistném nelze uplatnit: ' + slevaDuvody.join('; ') + '.');

    // daň: srážková bez prohlášení u malých příjmů, jinak záloha
    const srazkova = !v.prohlaseni && vz < limit;
    let danPred, slevy = 0, zvyhodneni = 0, dan, bonus = 0, druhDane;
    if (srazkova) {
      danPred = floor(floor(vz) * P.dan.sazba); dan = danPred; druhDane = 'srážková daň 15 % (konečná)';
    } else {
      const zaklad = vz > 100 ? Math.ceil(vz / 100 - 1e-9) * 100 : ceil(vz);
      const H = P.dan.hraniceMes;
      danPred = ceil(Math.min(zaklad, H) * P.dan.sazba + Math.max(0, zaklad - H) * P.dan.vyssi);
      if (v.prohlaseni) {
        slevy = P.slevy.poplatnik + (v.invalidita === '12' ? P.slevy.invalidita12 : v.invalidita === '3' ? P.slevy.invalidita3 : v.invalidita === 'ztpp' ? P.slevy.ztpp : 0);
        for (let i = 0; i < v.deti; i++) zvyhodneni += P.slevy.deti[Math.min(i, 2)] * (i < v.ztpDeti ? 2 : 1);
      }
      const poSlevach = Math.max(0, danPred - slevy);
      const zbyva = zvyhodneni - poSlevach;
      dan = Math.max(0, poSlevach - zvyhodneni);
      if (zbyva > 0) {
        if (vz >= P.slevy.bonusMinPrijem && zbyva >= P.slevy.bonusMin) bonus = zbyva;
        else if (zbyva > 0 && vz < P.slevy.bonusMinPrijem) info.push('Daňový bonus na děti nevzniká – příjem pod polovinou minimální mzdy (' + kc(P.slevy.bonusMinPrijem) + ').');
      }
      druhDane = 'záloha 15 %' + (danPred > ceil(Math.min(zaklad, H) * P.dan.sazba) ? ' + 23 % nad ' + kc(H) : '') + (v.prohlaseni ? '' : ' bez slev (prohlášení nepodepsáno)');
    }

    const cista = hruba - spZam - zpZam - doplatek - dan + bonus;
    const kVyplate = cista + (v.strava === 'pausal' ? ben.strava : 0);
    const odvodyFirma = spFirma - sleva + zpFirma;
    const naklad = hruba + odvodyFirma + pov + ben.naklad;

    // kontroly
    const hodinova = hodMes ? hruba / hodMes : 0;
    if (hruba > 0 && hodinova < P.minHod - 0.005) varovani.push('Mzda je pod minimální mzdou: ' + hodinova.toFixed(2).replace('.', ',') + ' Kč/h < ' + P.minHod.toFixed(2).replace('.', ',') + ' Kč/h.');
    if (v.typ === 'dpp' && v.hodinTydne * 52 > P.dpp.maxHodinRok) varovani.push('DPP: nejvýš ' + P.dpp.maxHodinRok + ' hodin ročně u jednoho zaměstnavatele (teď ' + Math.round(v.hodinTydne * 52) + ' h).');
    if (v.typ === 'dpc' && v.hodinTydne > v.plnyTyden / 2) varovani.push('DPČ: v průměru nejvýš polovina stanovené týdenní pracovní doby.');
    if (v.typ === 'hpp' && v.hodinTydne > v.plnyTyden) varovani.push('Úvazek je delší než stanovená týdenní pracovní doba.');

    return {
      vstup: v, hruba, vz, ucast, hodMes, hodinova, dnyMes, benefity: ben,
      spZam, zpZam, doplatek, srazkova, druhDane, danPred, slevy, zvyhodneni, dan, bonus, cista, kVyplate,
      spFirma, sleva, slevaDuvody, zp, zpFirma, odvodyFirma, pov, naklad,
      odvodyCelkem: spZam + zpZam + doplatek + dan - bonus + odvodyFirma,
      pomer: cista > 0 ? naklad / cista : null,
      varovani, info
    };
  }

  /* ---------- roční náklad ----------
     Měsíční mzda je placená i za svátky; za dovolenou se platí náhrada průměrným výdělkem (PHV), za prvních 14 dnů nemoci
     náhrada mzdy 60 % redukovaného PHV bez odvodů (§ 192 ZP). PHV odhadem = roční mzda / hodiny v pracovních dnech bez svátků. */
  function rocni(vstup) {
    const v = normVstup(vstup), P = param(v.rok);
    const k = kalendar(v.rok), hodinDen = v.hodinTydne / 5;
    const fondHod = k.vsedni * hodinDen;
    const mzdaHod = fondHod ? v.hruba * 12 / fondHod : 0;   // sazba měsíční mzdy na hodinu fondu
    const phv = k.pracovni && hodinDen ? v.hruba * 12 / (k.pracovni * hodinDen) : 0;
    const zakl = mesic(v);
    const pojisten = zakl.ucast;                           // náhrada mzdy jen při účasti na nemocenském pojištění
    const dovDni = Math.min(k.pracovni, v.dovolenaTydnu * 5);
    const nemDni = Math.min(Math.max(0, k.pracovni - dovDni), v.nemocDni);
    const odpracDni = Math.max(0, k.pracovni - dovDni - nemDni);
    const dovHod = dovDni * hodinDen, nemHod = nemDni * hodinDen, svatHod = k.svatky * hodinDen;

    const nahradaDovolena = dovHod * phv;                   // nahrazuje mzdu za tyto hodiny
    const mzdaZaPraci = (odpracDni * hodinDen) * mzdaHod;
    const mzdaSvatky = svatHod * mzdaHod;
    const nahrHod = pojisten && phv ? DAVKY.nahradaHodina(phv, v.rok).hodina : 0;
    const nahradaNemoc = Math.round(nemHod * nahrHod);
    const mzdaRok = mzdaZaPraci + mzdaSvatky + nahradaDovolena;  // podléhá odvodům
    const m = mesic(v, { hruba: mzdaRok / 12, dnyMes: odpracDni / 12 });

    // strop vyměřovacího základu SP (48× průměrná mzda) – platí pro zaměstnance i zaměstnavatele
    const vzRok = m.vz * 12, vzSP = Math.min(vzRok, P.sp.maxVZ);
    const strop = m.ucast && vzRok > P.sp.maxVZ;
    const spFirma = strop ? ceil(vzSP * P.sp.firma) : m.spFirma * 12;
    const spZam = strop ? ceil(vzSP * P.sp.zam) : m.spZam * 12;
    const pov = Math.round(m.pov * 12);
    const odvodyFirma = spFirma - m.sleva * 12 + m.zpFirma * 12;
    const benefityRok = m.benefity.naklad * 12;
    const naklad = Math.round(mzdaRok + odvodyFirma + pov + benefityRok + nahradaNemoc);
    const hodiny = odpracDni * hodinDen;
    const cistaRok = Math.round(m.cista * 12 + (strop ? m.spZam * 12 - spZam : 0) + nahradaNemoc);

    return {
      vstup: v, kalendar: k, hodinDen, fondHod, phv, mzdaHod, nahrHod,
      dovDni, nemDni, odpracDni, svatkyDni: k.svatky, hodiny, placeneHod: hodiny + dovHod + svatHod,
      mzdaZaPraci, mzdaSvatky, nahradaDovolena, nahradaNemoc, mzdaRok,
      spFirma, spZam, sleva: m.sleva * 12, zpFirma: m.zpFirma * 12, odvodyFirma, pov, benefityRok, strop,
      naklad, cistaRok, mesicPrumer: m,
      nakladMesic: naklad / 12,
      nakladHodina: hodiny ? naklad / hodiny : null,
      nakladHodinaFond: fondHod ? naklad / fondHod : null,
      neproduktivni: fondHod ? 1 - hodiny / fondHod : 0
    };
  }

  /* ---------- zpětný dopočet hrubé mzdy ----------
     cil: 'cista' | 'naklad' (měsíčně). Hledá nejnižší hrubou mzdu, při které veličina dosáhne cílové hodnoty. */
  function hledej(vstup, cil, hodnota) {
    const f = h => mesic(Object.assign({}, vstup, { hruba: h }))[cil];
    hodnota = nez(hodnota, 0);
    if (hodnota <= 0) return 0;
    let lo = 0, hi = Math.max(1000, hodnota * 3);
    while (f(hi) < hodnota && hi < 1e8) hi *= 2;
    while (hi - lo > 0.5) { const s = (lo + hi) / 2; if (f(s) >= hodnota) hi = s; else lo = s; }
    // čistá mzda není monotónní (základ daně na stovky nahoru) → dohledat nejnižší celou korunu o kus níž
    let h = Math.ceil(hi - 1e-9);
    for (let x = h - 1; x >= Math.max(0, h - 300); x--) if (f(x) >= hodnota) h = x;
    return h;
  }

  /* ---------- srovnání HPP × DPP × OSVČ při stejném rozpočtu firmy ----------
     rozpocet = měsíční rozpočet firmy (bez benefitů). OSVČ fakturuje 12× rozpočet (neplátce DPH); odpracované hodiny bereme
     stejné jako u zaměstnance (OSVČ nemá placenou dovolenou ani nemoc). */
  function srovnani(vstup, rozpocet, druhOsvc) {
    const zaklad = Object.assign({}, normVstup(vstup), { strava: 'zadna', volnocasRok: 0, zdraviRok: 0, penzijniMes: 0, slevaUvazek: false });
    rozpocet = nez(rozpocet, 0);
    const vysl = [];
    const hpp = Object.assign({}, zaklad, { typ: 'hpp' });
    hpp.hruba = hledej(hpp, 'naklad', rozpocet);
    const rH = rocni(hpp), mH = mesic(hpp);
    const hodiny = rH.hodiny;
    vysl.push({ id: 'hpp', nazev: 'Zaměstnanec (pracovní poměr)', hruba: hpp.hruba, nakladRok: rH.naklad, cistaRok: rH.cistaRok,
      odvodyStatu: rH.naklad - rH.cistaRok, hodiny, naHodinu: hodiny ? rH.cistaRok / hodiny : 0,
      plusy: ['placená dovolená ' + rH.dovDni + ' dní a svátky', 'náhrada mzdy při nemoci, nemocenská', 'důchod z plného vyměřovacího základu', 'výpovědní doba, odstupné'],
      varovani: mH.varovani });

    const dpp = Object.assign({}, zaklad, { typ: 'dpp' });
    dpp.hruba = hledej(dpp, 'naklad', rozpocet);
    const rD = rocni(dpp), mD = mesic(dpp);
    vysl.push({ id: 'dpp', nazev: 'Dohoda o provedení práce', hruba: dpp.hruba, nakladRok: rD.naklad, cistaRok: rD.cistaRok,
      odvodyStatu: rD.naklad - rD.cistaRok, hodiny: rD.hodiny, naHodinu: rD.hodiny ? rD.cistaRok / rD.hodiny : 0,
      plusy: mD.ucast ? ['nad limitem odvody jako u zaměstnance'] : ['pod limitem bez pojistného – ale bez nároku na nemocenskou a bez doby pojištění pro důchod'],
      varovani: mD.varovani });

    const osvc = OSVC.srovnani({ rok: zaklad.rok, prijmy: rozpocet * 12, vydaje: 0, druh: druhOsvc || '60', deti: zaklad.deti,
      invalidita: zaklad.invalidita });
    const nej = osvc.varianty.find(x => x.id === osvc.nejlepsi);
    const cistaO = rozpocet * 12 - nej.odvody;
    vysl.push({ id: 'osvc', nazev: 'OSVČ (' + nej.nazev + ')', hruba: null, nakladRok: rozpocet * 12, cistaRok: cistaO,
      odvodyStatu: nej.odvody, hodiny, naHodinu: hodiny ? cistaO / hodiny : 0,
      plusy: ['bez placené dovolené a nemoci (nemocenské jen dobrovolně)', 'nízký vyměřovací základ → nižší důchod', 'riziko švarcsystému při závislé práci'],
      varovani: [] });
    return { rozpocet, vysledky: vysl, osvcVarianty: osvc.varianty };
  }

  /* ---------- tým ---------- */
  const SLOUPCE_RADKU = ['nazev', 'typ', 'hruba', 'hodinTydne', 'pocet', 'deti', 'prohlaseni', 'slevaUvazek'];
  function normRadek(r) {
    r = r || {};
    return { nazev: String(r.nazev || 'Zaměstnanec').slice(0, 80), typ: TYPY[r.typ] ? r.typ : 'hpp', hruba: nez(r.hruba, 0),
      hodinTydne: Math.min(80, nez(r.hodinTydne, 40)), pocet: Math.min(9999, Math.max(1, Math.floor(nez(r.pocet, 1)))),
      deti: Math.min(20, Math.floor(nez(r.deti, 0))), prohlaseni: r.prohlaseni !== false, slevaUvazek: !!r.slevaUvazek };
  }
  function tym(radky, firma) {
    const rows = (radky || []).map(normRadek).map(r => {
      const v = Object.assign({}, firma || {}, r);
      const m = mesic(v), roc = rocni(v);
      return { radek: r, mesic: m, rocni: roc };
    });
    const s = { pocet: 0, hruba: 0, cista: 0, nakladMes: 0, nakladRok: 0, hodiny: 0, odvodyFirmaRok: 0, povRok: 0 };
    for (const x of rows) {
      const n = x.radek.pocet;
      s.pocet += n; s.hruba += x.mesic.hruba * n; s.cista += x.mesic.cista * n; s.nakladMes += x.mesic.naklad * n;
      s.nakladRok += x.rocni.naklad * n; s.hodiny += x.rocni.hodiny * n; s.odvodyFirmaRok += x.rocni.odvodyFirma * n; s.povRok += x.rocni.pov * n;
    }
    s.nakladHodina = s.hodiny ? s.nakladRok / s.hodiny : null;
    return { radky: rows, soucet: s };
  }
  function csvTym(t) {
    const q = x => '"' + String(x).replace(/"/g, '""') + '"';
    const r = ['Jméno;Typ;Počet;Hodin týdně;Hrubá mzda;Čistá mzda;Náklad měsíčně (1 os.);Náklad ročně (1 os.);Náklad na hodinu práce;Náklad ročně celkem'];
    for (const x of t.radky) r.push([q(x.radek.nazev), TYPY[x.radek.typ], x.radek.pocet, x.radek.hodinTydne, Math.round(x.mesic.hruba), Math.round(x.mesic.cista),
      Math.round(x.mesic.naklad), x.rocni.naklad, x.rocni.nakladHodina ? x.rocni.nakladHodina.toFixed(2).replace('.', ',') : '', x.rocni.naklad * x.radek.pocet].join(';'));
    r.push(['"Celkem"', '', t.soucet.pocet, '', Math.round(t.soucet.hruba), Math.round(t.soucet.cista), Math.round(t.soucet.nakladMes), '', '', Math.round(t.soucet.nakladRok)].join(';'));
    return '﻿' + r.join('\r\n');
  }

  /* ---------- uložená data ---------- */
  function prazdna() {
    return { verze: VERZE, jednotlivec: Object.assign({}, VYCHOZI), firma: { rok: ROK_TED, pov: 4.2, dovolenaTydnu: 4, nemocDni: 6, strava: 'zadna', stravaKc: 129.5, volnocasRok: 0, zdraviRok: 0, penzijniMes: 0, plnyTyden: 40 },
      tym: [{ nazev: 'Účetní', typ: 'hpp', hruba: 42000, hodinTydne: 40, pocet: 1 }, { nazev: 'Brigádník', typ: 'dpp', hruba: 4000, hodinTydne: 5, pocet: 2, prohlaseni: false }],
      srovnani: { rozpocet: 60000, druh: '60' } };
  }
  function migruj(d) {
    const p = prazdna();
    if (!d || typeof d !== 'object') return p;
    return { verze: VERZE, jednotlivec: Object.assign({}, p.jednotlivec, d.jednotlivec || {}), firma: Object.assign({}, p.firma, d.firma || {}),
      tym: Array.isArray(d.tym) ? d.tym.map(normRadek) : p.tym, srovnani: Object.assign({}, p.srovnani, d.srovnani || {}) };
  }

  const API = { VERZE, KLIC, STAV_K, PARAMETRY, ROKY, POV, TYPY, VYCHOZI, param, velikonoce, svatky, kalendar, normVstup,
    benefity, mesic, rocni, hledej, srovnani, normRadek, tym, csvTym, prazdna, migruj, kc };
  if (uzel) module.exports = API; else window.MzdoveNaklady = API;
})();
