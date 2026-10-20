/* ============================================================
   Dřevo – pohyb, průhyb, povrchy · DATA (bez DOM)
   Všechny hodnoty jsou TYPICKÉ a v aplikaci editovatelné.
   Zdroje:
   - USDA FPL: Wood Handbook – Wood as an Engineering Material, GTR-190 (2010), public domain:
     tab. 4-5 (koeficienty rozměrové změny C_R, C_T na 1 % vlhkosti, platí cca 6–14 %),
     tab. 5-3a (modul pružnosti v ohybu a měrná hmotnost při 12 %; hustota = ρ_rel × 1000 × 1,12).
   - Evropské dřeviny: typické hodnoty diferenciálního sesychání a hustoty z běžné
     dřevařské literatury (učebnice nauky o dřevě) – orientační, rozptyl ±15 %.
   - Desky a k_def: EN 1995-1-1 (Eurokód 5) tab. 3.2 – součinitel dotvarování pro třídu provozu 1,
     moduly pružnosti typické pro EN 12369-1 / technické listy – orientační.
   ============================================================ */
(function (koren) {
  'use strict';

  /* Dřeviny: ct, cr = poměrná změna rozměru na 1 % změny vlhkosti (např. 0.00369 = 0,369 %/%),
     rho = hustota při 12 % (kg/m³), E = modul pružnosti v ohybu podél vláken při 12 % (MPa),
     fm = orientační charakteristická pevnost v ohybu řeziva s vadami (MPa; čisté vzorky mají 2–3× víc), zdroj = 'usda' | 'eu' */
  const DREVINY = [
    // evropské (typické literární hodnoty)
    { id: 'smrk', nazev: 'Smrk ztepilý', ct: 0.0035, cr: 0.0017, rho: 450, E: 11000, fm: 24, zdroj: 'eu' },
    { id: 'jedle', nazev: 'Jedle bělokorá', ct: 0.0030, cr: 0.0014, rho: 450, E: 10500, fm: 22, zdroj: 'eu' },
    { id: 'borovice', nazev: 'Borovice lesní', ct: 0.0033, cr: 0.0017, rho: 520, E: 11500, fm: 26, zdroj: 'eu' },
    { id: 'modrin', nazev: 'Modřín opadavý', ct: 0.0030, cr: 0.0014, rho: 590, E: 12500, fm: 30, zdroj: 'eu' },
    { id: 'dub', nazev: 'Dub (letní/zimní)', ct: 0.0033, cr: 0.0018, rho: 690, E: 11500, fm: 30, zdroj: 'eu' },
    { id: 'buk', nazev: 'Buk lesní', ct: 0.0041, cr: 0.0020, rho: 720, E: 13500, fm: 40, zdroj: 'eu' },
    { id: 'jasan', nazev: 'Jasan ztepilý', ct: 0.0036, cr: 0.0020, rho: 690, E: 12500, fm: 38, zdroj: 'eu' },
    { id: 'javor', nazev: 'Javor klen', ct: 0.0030, cr: 0.0020, rho: 630, E: 10500, fm: 32, zdroj: 'eu' },
    { id: 'orech', nazev: 'Ořešák královský', ct: 0.0029, cr: 0.0018, rho: 640, E: 11000, fm: 32, zdroj: 'eu' },
    { id: 'tresen', nazev: 'Třešeň ptačí', ct: 0.0030, cr: 0.0016, rho: 600, E: 10000, fm: 30, zdroj: 'eu' },
    { id: 'briza', nazev: 'Bříza bělokorá', ct: 0.0032, cr: 0.0022, rho: 650, E: 12500, fm: 34, zdroj: 'eu' },
    { id: 'lipa', nazev: 'Lípa', ct: 0.0031, cr: 0.0019, rho: 530, E: 8500, fm: 24, zdroj: 'eu' },
    { id: 'olse', nazev: 'Olše lepkavá', ct: 0.0027, cr: 0.0016, rho: 530, E: 9500, fm: 26, zdroj: 'eu' },
    { id: 'akat', nazev: 'Akát (trnovník)', ct: 0.0024, cr: 0.0016, rho: 770, E: 13500, fm: 42, zdroj: 'eu' },
    // USDA Wood Handbook (2010) – tab. 4-5 a 5-3a
    { id: 'us_whiteoak', nazev: 'Dub bílý (white oak)', ct: 0.00365, cr: 0.00180, rho: 770, E: 12300, fm: 34, zdroj: 'usda' },
    { id: 'us_redoak', nazev: 'Dub červený (red oak)', ct: 0.00369, cr: 0.00158, rho: 700, E: 12500, fm: 33, zdroj: 'usda' },
    { id: 'us_hardmaple', nazev: 'Javor cukrový (hard maple)', ct: 0.00353, cr: 0.00165, rho: 705, E: 12600, fm: 36, zdroj: 'usda' },
    { id: 'us_cherry', nazev: 'Třešeň pozdní (black cherry)', ct: 0.00248, cr: 0.00126, rho: 560, E: 10300, fm: 28, zdroj: 'usda' },
    { id: 'us_walnut', nazev: 'Ořešák černý (black walnut)', ct: 0.00274, cr: 0.00190, rho: 610, E: 11600, fm: 33, zdroj: 'usda' },
    { id: 'us_whiteash', nazev: 'Jasan americký (white ash)', ct: 0.00274, cr: 0.00169, rho: 670, E: 12000, fm: 33, zdroj: 'usda' },
    { id: 'us_beech', nazev: 'Buk americký (American beech)', ct: 0.00431, cr: 0.00190, rho: 720, E: 11900, fm: 32, zdroj: 'usda' },
    { id: 'us_yellowbirch', nazev: 'Bříza žlutá (yellow birch)', ct: 0.00338, cr: 0.00256, rho: 690, E: 13900, fm: 35, zdroj: 'usda' },
    { id: 'us_poplar', nazev: 'Liliovník (yellow-poplar)', ct: 0.00289, cr: 0.00158, rho: 470, E: 10900, fm: 22, zdroj: 'usda' },
    { id: 'us_basswood', nazev: 'Lípa americká (basswood)', ct: 0.00330, cr: 0.00230, rho: 415, E: 10100, fm: 18, zdroj: 'usda' },
    { id: 'us_whitepine', nazev: 'Borovice vejmutovka (eastern white pine)', ct: 0.00212, cr: 0.00071, rho: 400, E: 8500, fm: 17, zdroj: 'usda' },
    { id: 'us_douglas', nazev: 'Douglaska (Douglas-fir, coast)', ct: 0.00267, cr: 0.00165, rho: 530, E: 13400, fm: 30, zdroj: 'usda' },
    { id: 'us_sitka', nazev: 'Smrk sitka (Sitka spruce)', ct: 0.00263, cr: 0.00148, rho: 450, E: 10800, fm: 22, zdroj: 'usda' },
  ];

  /* Materiály polic: E (MPa) ve směru rozpětí, rho (kg/m³), kdef = EN 1995-1-1 tab. 3.2 (třída provozu 1),
     fm = orientační pevnost v ohybu (MPa). Desky: typické, orientační – zkontrolujte technický list. */
  const MATERIALY_POLIC = [
    { id: 'dtd', nazev: 'DTD / lamino (dřevotříska P2)', E: 2800, rho: 650, kdef: 2.25, fm: 11 },
    { id: 'dtd_p5', nazev: 'DTD P5 / P6 (konstrukční)', E: 3500, rho: 680, kdef: 2.25, fm: 15 },
    { id: 'mdf', nazev: 'MDF', E: 3000, rho: 720, kdef: 2.25, fm: 20 },
    { id: 'osb', nazev: 'OSB/3 (hlavní osa)', E: 4900, rho: 620, kdef: 1.5, fm: 18 },
    { id: 'prekl_pod', nazev: 'Překližka bříza – vlákna povrchu podél rozpětí', E: 8500, rho: 680, kdef: 0.8, fm: 45 },
    { id: 'prekl_napric', nazev: 'Překližka bříza – vlákna povrchu napříč', E: 5500, rho: 680, kdef: 0.8, fm: 30 },
    { id: 'sparovka_smrk', nazev: 'Spárovka smrk', E: 10000, rho: 450, kdef: 0.6, fm: 24 },
    { id: 'sparovka_buk', nazev: 'Spárovka buk', E: 12500, rho: 720, kdef: 0.6, fm: 36 },
    { id: 'sparovka_dub', nazev: 'Spárovka dub', E: 11000, rho: 690, kdef: 0.6, fm: 30 },
  ];
  // masivy z tabulky dřevin (podél vláken)
  for (const d of DREVINY) MATERIALY_POLIC.push({ id: 'm_' + d.id, nazev: 'Masiv – ' + d.nazev, E: d.E, rho: d.rho, kdef: 0.6, fm: d.fm });

  /* Zatížení polic – typické hodnoty na 1 m délky police (orientační, vážit vlastní). */
  const ZATIZENI = [
    { id: 'brozovane', nazev: 'Knihy brožované (paperback)', kgm: 20 },
    { id: 'vazane', nazev: 'Knihy vázané', kgm: 30 },
    { id: 'velke', nazev: 'Velké knihy, atlasy, encyklopedie', kgm: 45 },
    { id: 'lp', nazev: 'LP desky (vinyl)', kgm: 40 },
    { id: 'cd', nazev: 'CD / DVD', kgm: 15 },
    { id: 'nadobi', nazev: 'Talíře, nádobí', kgm: 40 },
    { id: 'spajz', nazev: 'Sklenice, konzervy (spíž)', kgm: 60 },
    { id: 'dilna', nazev: 'Dílna – nářadí, krabice šroubů', kgm: 70 },
    { id: 'dekorace', nazev: 'Dekorace, lehké předměty', kgm: 8 },
  ];

  /* Limity průhybu (poměr rozpětí / průhyb). */
  const LIMITY = [
    { id: 300, nazev: 'L/300 (≈ 1 mm na 300 mm) – běžná police' },
    { id: 200, nazev: 'L/200 – dílna, sklad (méně přísné)' },
    { id: 360, nazev: 'L/360 – přísnější (viditelné, sklo)' },
    { id: 600, nazev: 'L/600 (≈ 0,02″/stopu, styl Sagulatoru)' },
  ];

  /* Povrchové úpravy – typické hodnoty pro jednu vrstvu na hoblovaném a broušeném dřevě.
     vyd = vydatnost m²/l na vrstvu, prvni = násobek spotřeby první vrstvy (nasákavost),
     schnuti = h do další vrstvy, vytvrzeni = dny do plného zatížení, zrno = mezibroušení,
     priprava = konečná zrnitost přípravy, voda = vodou ředitelné (doporučeno zvednout vlákno),
     setrit = po nanesení setřít přebytek po N minutách. */
  const NATERY = [
    { id: 'olejvosk', nazev: 'Tvrdý voskový olej (hardwax oil)', vyd: 22, prvni: 1.3, vrstvy: 2, schnuti: 10, vytvrzeni: 7, zrno: 'P240 / brusná rouna', priprava: 'P180', voda: false, setrit: 20, typ: 'olej' },
    { id: 'olej', nazev: 'Penetrační olej (dánský, lněný, tungový)', vyd: 18, prvni: 1.5, vrstvy: 3, schnuti: 24, vytvrzeni: 14, zrno: 'P320 / rouno (na mokro olejem)', priprava: 'P180', voda: false, setrit: 20, typ: 'olej' },
    { id: 'vosk', nazev: 'Vosk (pasta)', vyd: 35, prvni: 1.2, vrstvy: 2, schnuti: 2, vytvrzeni: 2, zrno: '— (vyleštit hadrem)', priprava: 'P220', voda: false, setrit: 20, typ: 'vosk' },
    { id: 'lak_voda', nazev: 'Lak vodou ředitelný (akrylát / PU)', vyd: 10, prvni: 1.1, vrstvy: 3, schnuti: 3, vytvrzeni: 7, zrno: 'P240', priprava: 'P180', voda: true, setrit: 0, typ: 'lak' },
    { id: 'lak_pu', nazev: 'Lak polyuretanový rozpouštědlový', vyd: 11, prvni: 1.1, vrstvy: 3, schnuti: 12, vytvrzeni: 7, zrno: 'P320', priprava: 'P180', voda: false, setrit: 0, typ: 'lak' },
    { id: 'nitro', nazev: 'Nitrocelulózový lak', vyd: 9, prvni: 1.1, vrstvy: 3, schnuti: 1, vytvrzeni: 3, zrno: 'P320', priprava: 'P220', voda: false, setrit: 0, typ: 'lak' },
    { id: 'selak', nazev: 'Šelak (štětcem, ne politura)', vyd: 12, prvni: 1.1, vrstvy: 3, schnuti: 1, vytvrzeni: 2, zrno: 'P400', priprava: 'P220', voda: false, setrit: 0, typ: 'lak' },
    { id: 'morido_voda', nazev: 'Mořidlo vodou ředitelné', vyd: 10, prvni: 1.0, vrstvy: 1, schnuti: 12, vytvrzeni: 0, zrno: '— (mořidlo nebrousit)', priprava: 'P180', voda: true, setrit: 5, typ: 'moridlo' },
    { id: 'morido_lih', nazev: 'Mořidlo lihové / rozpouštědlové', vyd: 12, prvni: 1.0, vrstvy: 1, schnuti: 2, vytvrzeni: 0, zrno: '— (mořidlo nebrousit)', priprava: 'P180', voda: false, setrit: 0, typ: 'moridlo' },
    { id: 'lazura', nazev: 'Lazura tenkovrstvá (exteriér)', vyd: 12, prvni: 1.2, vrstvy: 3, schnuti: 12, vytvrzeni: 3, zrno: 'P180 (lehce)', priprava: 'P120', voda: false, setrit: 0, typ: 'lazura' },
    { id: 'zaklad', nazev: 'Plnič pórů / základ (sanding sealer)', vyd: 10, prvni: 1.2, vrstvy: 1, schnuti: 2, vytvrzeni: 0, zrno: 'P240', priprava: 'P180', voda: false, setrit: 0, typ: 'lak' },
  ];

  /* Způsob nanášení – násobek spotřeby (ztráty, prostřik). Typické. */
  const NANASENI = [
    { id: 'stetec', nazev: 'štětec', k: 1.0, rychlost: 5 },
    { id: 'valecek', nazev: 'váleček', k: 1.05, rychlost: 10 },
    { id: 'hadr', nazev: 'hadr / houba (olej, vosk)', k: 1.0, rychlost: 6 },
    { id: 'hvlp', nazev: 'stříkání HVLP', k: 1.35, rychlost: 15 },
    { id: 'vzduch', nazev: 'stříkání vzduchové (konvenční)', k: 1.6, rychlost: 18 },
  ];

  /* Klima – 12 měsíců (I–XII): t = °C, rh = % */
  const KLIMATA = [
    { id: 'byt', nazev: 'Vytápěný byt / dům (střední Evropa)', t: [21, 21, 21, 21.5, 22, 23.5, 24.5, 24.5, 22.5, 21.5, 21, 21], rh: [32, 32, 36, 42, 50, 56, 59, 60, 56, 47, 40, 34] },
    { id: 'klima', nazev: 'Klimatizovaná kancelář (řízená vlhkost)', t: [21, 21, 21, 22, 23, 24, 24, 24, 23, 22, 21, 21], rh: [40, 40, 42, 45, 48, 50, 50, 50, 48, 45, 42, 40] },
    { id: 'chata', nazev: 'Nevytápěná chata / garáž', t: [1, 2, 5, 9, 14, 17, 19, 19, 15, 10, 5, 2], rh: [85, 82, 76, 70, 70, 71, 71, 73, 79, 84, 87, 87] },
    { id: 'venku', nazev: 'Venku pod střechou (Praha, dlouhodobý průměr)', t: [-0.5, 0.5, 4, 9, 14, 17, 19, 18.5, 14, 9, 4, 0.5], rh: [85, 80, 74, 67, 67, 68, 67, 69, 75, 81, 86, 87] },
  ];

  /* Ceny řeziva – ILUSTRATIVNÍ (Kč/m³), vždy přepište podle dodavatele. */
  const CENY = { smrk: 12000, jedle: 12000, borovice: 13000, modrin: 18000, dub: 45000, buk: 25000, jasan: 30000, javor: 32000, orech: 60000, tresen: 45000, briza: 22000, lipa: 20000, olse: 20000, akat: 40000 };

  const BALENI = [0.125, 0.25, 0.375, 0.5, 0.75, 1, 2.5, 5];

  const D = { DREVINY, MATERIALY_POLIC, ZATIZENI, LIMITY, NATERY, NANASENI, KLIMATA, CENY, BALENI, MESICE: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'], MESICE_DLOUHE: ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'] };
  koren.DVD = D;
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
