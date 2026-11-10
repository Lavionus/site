/* Nemocenská, PPM a rodičovský příspěvek – jádro bez DOM (test: _test/davky_test.js).
   Výpočty podle zákona 187/2006 Sb. (nemocenské pojištění), § 192 zákoníku práce (náhrada mzdy)
   a § 30 zákona 117/1995 Sb. (rodičovský příspěvek). Parametry po letech v PARAMETRY – ručně stárnoucí data,
   stav k 11/2026, orientačně. Zaokrouhlení: DVZ na haléře nahoru (§ 18), redukovaný DVZ na celé Kč nahoru (§ 21 odst. 3),
   dávka za den na celé Kč nahoru (§ 110). */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_davky';
  const STAV_K = '11/2026';

  /* Redukční hranice: sdělení MPSV 397/2025 Sb. (2026) a 436/2024 Sb. (2025). Maximální VZ = 48× průměrná mzda.
     Rodičovský příspěvek podle roku narození dítěte (117/1995 Sb. § 30): 2024–2025 vícerčata 525 000 Kč, od 2026 700 000 Kč;
     nejvyšší volba bez stanoveného DVZ 13 000 Kč (2025) / 15 000 Kč (2026). Hodinové hranice pro náhradu mzdy = denní × 0,175. */
  const PARAMETRY = {
    2025: { hranice: [1552, 2328, 4656], maxVZ: 2234736, rodicovsky: { celkem: 350000, vicercata: 525000, bezDvz: 13000 }, zdroj: 'sdělení MPSV 436/2024 Sb.' },
    2026: { hranice: [1633, 2449, 4897], maxVZ: 2350416, rodicovsky: { celkem: 350000, vicercata: 700000, bezDvz: 15000 }, zdroj: 'sdělení MPSV 397/2025 Sb.' }
  };
  const ROKY = Object.keys(PARAMETRY).map(Number);
  const SAZBY = { nemocenske: [0.9, 0.6, 0.3], ppm: [1, 0.6, 0.3] };   // ppm = i otcovská a dlouhodobé ošetřovné
  const DNI = { nahrada: 14, nemocenskeMax: 380, ppm: 196, ppmVice: 238, otcovska: 14, osetrovne: 9, osetrovneSam: 16, dlouhodobe: 90, rodicovskyLet: 3 };
  const PROCENTA = { nemocenske: [[15, 0.6], [31, 0.66], [61, 0.72]], ppm: 0.7, otcovska: 0.7, osetrovne: 0.6, nahrada: 0.6 };
  const OSVC = { ppmDnu: 180, ppmDnu2roky: 270, otcovskaDnu: 90 };   // dobrovolné pojištění OSVČ: účast před nástupem

  const nahoru = (x, des) => { const k = Math.pow(10, des || 0); return Math.ceil(Math.round(x * k * 1e6) / 1e6) / k; };
  const param = rok => PARAMETRY[rok] || PARAMETRY[ROKY[ROKY.length - 1]];

  /* ---------- data ---------- */
  const jeDatum = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const zIso = s => { const [r, m, d] = s.split('-').map(Number); return new Date(r, m - 1, d); };
  const pridejDny = (s, n) => { const d = zIso(s); d.setDate(d.getDate() + n); return iso(d); };
  const pridejMesice = (s, n) => { const d = zIso(s); d.setMonth(d.getMonth() + n); return iso(d); };
  const rozdilDnu = (a, b) => Math.round((zIso(b) - zIso(a)) / 864e5);
  const denVTydnu = s => zIso(s).getDay();
  const formatDatum = s => jeDatum(s) ? zIso(s).toLocaleDateString('cs-CZ') : '';
  const formatKc = (n, des) => (Math.round(n * 100) / 100).toLocaleString('cs-CZ', { minimumFractionDigits: des || 0, maximumFractionDigits: des || 0 }) + ' Kč';

  /* Rozhodné období = 12 kalendářních měsíců před měsícem vzniku sociální události (§ 18 odst. 3). */
  function rozhodneObdobi(vznik) {
    const d = zIso(vznik);
    const od = iso(new Date(d.getFullYear() - 1, d.getMonth(), 1));
    const konec = new Date(d.getFullYear(), d.getMonth(), 0);
    return { od, do: iso(konec), dnu: rozdilDnu(od, iso(konec)) + 1 };
  }

  /* DVZ = úhrn vyměřovacích základů / počet kalendářních dnů; úhrn nejvýše maximální VZ roku. */
  function dvz(mzda, vznik, rok) {
    const ob = rozhodneObdobi(vznik);
    const uhrnPlny = Math.max(0, mzda) * 12;
    const uhrn = Math.min(uhrnPlny, param(rok).maxVZ);
    return { od: ob.od, do: ob.do, dnu: ob.dnu, uhrn, omezeno: uhrn < uhrnPlny, dvz: nahoru(uhrn / ob.dnu, 2) };
  }

  /* Redukce třemi hranicemi; v pásmech haléře, výsledek celé Kč nahoru. druh: 'nemocenske' | 'ppm'. */
  function reduk(zaklad, rok, druh) {
    const h = param(rok).hranice, s = SAZBY[druh] || SAZBY.nemocenske;
    const pasma = [];
    let dolni = 0, soucet = 0;
    for (let i = 0; i < 3; i++) {
      const horni = h[i], cast = Math.max(0, Math.min(zaklad, horni) - dolni);
      const castka = nahoru(cast * s[i], 2);
      pasma.push({ od: dolni, do: horni, sazba: s[i], zaklad: cast, castka });
      soucet += castka; dolni = horni;
    }
    pasma.push({ od: h[2], do: null, sazba: 0, zaklad: Math.max(0, zaklad - h[2]), castka: 0 });
    return { pasma, redukovany: nahoru(soucet, 0) };
  }

  /* Hodinové hranice a náhrada mzdy za hodinu (§ 192 ZP: 60 % redukovaného průměrného hodinového výdělku). */
  function hodinoveHranice(rok) { return param(rok).hranice.map(x => nahoru(x * 0.175, 2)); }
  function nahradaHodina(phv, rok) {
    const h = hodinoveHranice(rok), s = SAZBY.nemocenske;
    let dolni = 0, red = 0;
    const pasma = [];
    for (let i = 0; i < 3; i++) {
      const cast = Math.max(0, Math.min(phv, h[i]) - dolni), castka = nahoru(cast * s[i], 2);
      pasma.push({ od: dolni, do: h[i], sazba: s[i], zaklad: cast, castka });
      red += castka; dolni = h[i];
    }
    red = nahoru(red, 2);
    return { hranice: h, pasma, redukovany: red, hodina: nahoru(red * PROCENTA.nahrada, 2) };
  }

  /* Průměrný hodinový výdělek odhadem z měsíční mzdy (přesně se počítá z předchozího čtvrtletí). */
  const phvZMzdy = (mzda, hodinDen) => mzda / (hodinDen * 5 * (365.25 / 7 / 12));

  function procentoDne(den) {
    let p = 0;
    for (const [od, s] of PROCENTA.nemocenske) if (den >= od) p = s;
    return p;
  }

  /* Nemocenská: dny 1–14 náhrada mzdy od zaměstnavatele za směny (OSVČ nic), od 15. dne nemocenské za kalendářní dny. */
  function nemocenske(o) {
    const rok = o.rok, red = reduk(o.dvz, rok, 'nemocenske');
    const dnu = Math.min(Math.max(1, Math.round(o.dnu || 30)), DNI.nemocenskeMax);
    const hodinDen = o.hodinDen || 8;
    const nahr = o.osvc ? null : nahradaHodina(o.phv != null ? o.phv : phvZMzdy(o.mzda, hodinDen), rok);
    const smena = nahr ? nahoru(nahr.hodina * hodinDen, 0) : 0;
    const dny = [];
    let nahrada = 0, davka = 0, smen = 0;
    for (let i = 1; i <= dnu; i++) {
      const datum = pridejDny(o.zacatek, i - 1);
      if (i <= DNI.nahrada) {
        const pracovni = !o.osvc && denVTydnu(datum) % 6 !== 0;
        if (pracovni) smen++;
        dny.push({ den: i, datum, druh: pracovni ? 'nahrada' : 'nic', castka: pracovni ? smena : 0 });
        nahrada += pracovni ? smena : 0;
      } else {
        const c = nahoru(red.redukovany * procentoDne(i), 0);
        dny.push({ den: i, datum, druh: 'nemocenske', procento: procentoDne(i), castka: c });
        davka += c;
      }
    }
    const sazby = PROCENTA.nemocenske.map(([od, p]) => ({ od, procento: p, denni: nahoru(red.redukovany * p, 0) }));
    return { redukce: red, nahradaHod: nahr, smena, smen, hodinDen, sazby, dny, dnu, nahrada, davka, celkem: nahrada + davka,
      od: o.zacatek, do: pridejDny(o.zacatek, dnu - 1), nemocenskeOd: dnu >= DNI.nahrada + 1 ? pridejDny(o.zacatek, DNI.nahrada) : null,
      mesic: sazby[0].denni * 30, maxDnu: DNI.nemocenskeMax };
  }

  /* Společný tvar dávky za pevný počet dní: PPM, otcovská, ošetřovné. */
  function davkaDnu(zaklad, rok, druh, procento, dnu, zacatek) {
    const red = reduk(zaklad, rok, druh), denni = nahoru(red.redukovany * procento, 0);
    return { redukce: red, procento, denni, dnu, mesic: denni * 30, celkem: denni * dnu, od: zacatek, do: pridejDny(zacatek, dnu - 1) };
  }

  /* PPM: 70 % DVZ (redukce 100/60/30), 196 dní, 238 u dvou a více dětí. OSVČ: 180 dní účasti v posledním roce (+ 270 ve 2 letech). */
  function ppm(o) {
    const dnu = o.vicercata ? DNI.ppmVice : DNI.ppm;
    const r = davkaDnu(o.dvz, o.rok, 'ppm', PROCENTA.ppm, dnu, o.zacatek);
    r.narok = !o.osvc || ((o.dnuUcasti || 0) >= OSVC.ppmDnu);
    r.podminka = o.osvc ? `OSVČ: účast na nemocenském pojištění aspoň ${OSVC.ppmDnu} dní v posledním roce a ${OSVC.ppmDnu2roky} dní v posledních 2 letech před nástupem` : 'zaměstnanec: účast aspoň 270 dní v posledních 2 letech';
    return r;
  }

  /* Otcovská: 70 % (redukce 100/60/30), 14 dní, nástup do 6 týdnů od narození. OSVČ: 3 měsíce účasti. */
  function otcovska(o) {
    const r = davkaDnu(o.dvz, o.rok, 'ppm', PROCENTA.otcovska, DNI.otcovska, o.zacatek);
    r.narok = !o.osvc || ((o.dnuUcasti || 0) >= OSVC.otcovskaDnu);
    r.podminka = o.osvc ? `OSVČ: účast aspoň ${OSVC.otcovskaDnu} dní bezprostředně před nástupem` : 'zaměstnanec: bez čekací doby';
    return r;
  }

  /* Ošetřovné: 60 % (redukce 90/60/30), 9 dní, 16 dní osamělý rodič dítěte do 16 let; OSVČ nárok nemá.
     Dlouhodobé ošetřovné: 60 %, redukce 100/60/30, až 90 dní; OSVČ 3 měsíce účasti. */
  function osetrovne(o) {
    let r;
    if (o.dlouhodobe) {
      r = davkaDnu(o.dvz, o.rok, 'ppm', PROCENTA.osetrovne, Math.min(Math.max(1, Math.round(o.dnu || DNI.dlouhodobe)), DNI.dlouhodobe), o.zacatek);
      r.narok = !o.osvc || ((o.dnuUcasti || 0) >= OSVC.otcovskaDnu);
      r.podminka = 'ošetřovaný byl aspoň 4 dny hospitalizován (u nevyléčitelně nemocných bez hospitalizace); zaměstnanec 90 dní účasti ve 4 měsících, OSVČ 90 dní bezprostředně';
    } else {
      r = davkaDnu(o.dvz, o.rok, 'nemocenske', PROCENTA.osetrovne, o.samozivitel ? DNI.osetrovneSam : DNI.osetrovne, o.zacatek);
      r.narok = !o.osvc;
      r.podminka = o.osvc ? 'OSVČ nárok na ošetřovné nemá (§ 39 odst. 5)' : 'zaměstnanec: bez čekací doby, ne u DPP/DPČ a zaměstnání malého rozsahu';
    }
    return r;
  }

  /* Rodičovský příspěvek: celková částka podle roku narození, měsíční volba nejvýše 70 % 30násobku DVZ (redukce jako PPM),
     bez DVZ nejvýše bezDvz; vícerčata dvojnásobek. Dočerpat nejpozději do 3 let věku dítěte. */
  function rodicovsky(o) {
    const p = param(o.rokNarozeni || o.rok).rodicovsky;
    const celkem = o.vicercata ? p.vicercata : p.celkem;
    const red = o.dvz > 0 ? reduk(o.dvz, o.rok, 'ppm') : null;
    const zDvz = red ? Math.floor(0.7 * 30 * red.redukovany) : 0;
    const nasob = o.vicercata ? 2 : 1;
    const maxMesicne = Math.max(zDvz, p.bezDvz) * nasob;
    const zacatek = o.zacatek, konec3 = pridejMesice(o.narozeni, 12 * DNI.rodicovskyLet);
    // výplata za kalendářní měsíce: první měsíc = měsíc začátku, poslední = měsíc před 3. narozeninami
    const mesicuDo3 = Math.max(0, (zIso(konec3).getFullYear() - zIso(zacatek).getFullYear()) * 12 + zIso(konec3).getMonth() - zIso(zacatek).getMonth());
    const minMesicne = mesicuDo3 > 0 ? Math.ceil(celkem / mesicuDo3) : celkem;
    const radek = volba => {
      const v = Math.max(1, Math.min(volba, maxMesicne));
      const mesicu = Math.ceil(celkem / v), posledni = celkem - v * (mesicu - 1);
      const stihne = mesicu <= mesicuDo3;
      // `do` = měsíc poslední výplaty
      return { volba: v, mesicu, posledni, do: pridejMesice(zacatek, mesicu - 1), stihne, propadne: stihne ? 0 : celkem - v * mesicuDo3 };
    };
    const kandidati = [maxMesicne, 40000, 30000, 25000, 20000, 15000, 13000, 10000, minMesicne]
      .filter((x, i, a) => x >= 1 && x <= maxMesicne && a.indexOf(x) === i).sort((a, b) => b - a);
    return { celkem, maxMesicne, zDvz, bezDvz: p.bezDvz * nasob, minMesicne, mesicuDo3, do3let: konec3, redukce: red,
      volba: o.volba ? radek(o.volba) : null, tabulka: kandidati.map(radek) };
  }

  /* Poslední vstupy v localStorage. */
  const vychozi = () => ({ verze: VERZE, mzda: 40000, osvc: false, hodinDen: 8, rok: ROKY[ROKY.length - 1], dnuUcasti: 365, pohled: 'nemocenska' });
  function migruj(d) {
    const v = vychozi();
    if (!d || typeof d !== 'object') return v;
    for (const k of Object.keys(d)) if (k in v || /^(zacatek|narozeni|dnu|vicercata|samozivitel|dlouhodobe|volba)/.test(k)) v[k] = d[k];
    v.verze = VERZE;
    if (!PARAMETRY[v.rok]) v.rok = ROKY[ROKY.length - 1];
    return v;
  }

  const API = {
    VERZE, KLIC, STAV_K, PARAMETRY, ROKY, SAZBY, DNI, PROCENTA, OSVC,
    nahoru, rozhodneObdobi, dvz, reduk, hodinoveHranice, nahradaHodina, phvZMzdy, procentoDne,
    nemocenske, ppm, otcovska, osetrovne, rodicovsky, vychozi, migruj,
    jeDatum, pridejDny, pridejMesice, rozdilDnu, formatDatum, formatKc
  };
  if (typeof module !== 'undefined') module.exports = API; else window.DavkyJadro = API;
})();
