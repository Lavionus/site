/* Tepelné ztráty a skladby konstrukcí – jádro bez DOM (test: _test/tepelne_ztraty_test.js).
   Skladba konstrukce → U (ČSN EN ISO 6946, i nehomogenní vrstva kombinovanou metodou), porovnání
   s ČSN 73 0540-2, teplotní a tlakový průběh, kondenzace Glaserovou metodou po měsících
   (ČSN EN ISO 13788), teplotní faktor fRsi, tepelné ztráty místností (zjednodušeně podle
   ČSN EN 12831-1), návrh zdroje tepla. Všechny tabulkové hodnoty jsou orientační – viz ZDROJE. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_tepelne_ztraty';
  const DELTA0 = 2e-10;            // difuzní vodivost vzduchu kg/(m·s·Pa), ČSN EN ISO 13788
  const RHO_C_VZD = 0.34;          // Wh/(m³·K), objemová tepelná kapacita vzduchu
  const DNY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  const STAV_DAT = '11/2026';

  const ZDROJE = {
    csn: 'ČSN 73 0540-3 (tabulkové hodnoty; ověřeno 17. 11. 2026 přes TZB-info tab. 58 a výtah FSv ČVUT)',
    iso: 'ČSN EN ISO 10456 (tabulkové hodnoty, orientačně)',
    vyr: 'typická hodnota z technických listů výrobců – ověřte u konkrétního výrobku',
    fol: 'typická hodnota sd z technických listů fólií – ověřte u výrobku',
    vlastni: 'vlastní hodnota uživatele'
  };

  /* Knihovna materiálů: λ [W/(m·K)], μ [–], ρ [kg/m³], c [J/(kg·K)].
     Ověření 17. 11. 2026: položky 'csn' proti TZB-info „Hodnoty fyzikálních veličin vybraných stavebních materiálů“
     (výtah ČSN 73 0540-3) a seznamu λ FSv ČVUT (Zdivo CP 1800 = 0,86; Dlažba keramická 2000 = 1,01); položky 'vyr'
     jsou typické deklarované hodnoty výrobců (EPS, MW, PIR, tvárnice, pórobeton) – liší se podle výrobku.
     Rozpory: pískovec – ISO 10456 λ 2,3 (2600 kg/m³) × ČSN 73 0540-3 λ 1,7 (2600) / 1,4 (2400); ponechána ISO.
     Asfaltové pásy – ČSN μ = 8000 (oxidované pásy), modifikované SBS pásy výrobci 20 000–50 000. */
  const M = (id, nazev, kat, lam, mu, rho, c, zdroj) => ({ id, nazev, kat, lam, mu, rho, c, zdroj });
  const MATERIALY = [
    M('om_vc', 'Omítka vápenocementová', 'Omítky a desky', 0.99, 19, 2000, 790, 'csn'),
    M('om_v', 'Omítka vápenná', 'Omítky a desky', 0.88, 6, 1600, 840, 'csn'),
    M('om_sadr', 'Omítka sádrová', 'Omítky a desky', 0.57, 10, 1300, 1000, 'iso'),
    M('om_tep', 'Tepelněizolační omítka', 'Omítky a desky', 0.10, 8, 350, 1000, 'vyr'),
    M('om_hlina', 'Hliněná omítka', 'Omítky a desky', 0.80, 8, 1700, 1000, 'vyr'),
    M('om_ten', 'Tenkovrstvá omítka (silikonová)', 'Omítky a desky', 0.70, 40, 1800, 920, 'vyr'),
    M('lepidlo', 'Lepicí a stěrková hmota ETICS', 'Omítky a desky', 0.80, 20, 1400, 900, 'vyr'),
    M('sdk', 'Sádrokartonová deska', 'Omítky a desky', 0.22, 9, 750, 1060, 'vyr'),
    M('sdv', 'Sádrovláknitá deska', 'Omítky a desky', 0.32, 13, 1150, 1100, 'vyr'),
    M('cp', 'Zdivo z cihel plných pálených (MVC)', 'Zdivo', 0.86, 8.5, 1800, 900, 'csn'),
    M('ktv44mw', 'Keramická tvárnice broušená 44 cm s minerální vatou', 'Zdivo', 0.080, 7, 650, 900, 'vyr'),
    M('ktv44', 'Keramická tvárnice broušená 44 cm (bez výplně)', 'Zdivo', 0.11, 7, 650, 900, 'vyr'),
    M('ktv30', 'Keramická tvárnice broušená 30 cm', 'Zdivo', 0.20, 7, 800, 900, 'vyr'),
    M('ktv_pr', 'Keramická příčkovka 11,5 cm', 'Zdivo', 0.32, 7, 950, 900, 'vyr'),
    M('pb350', 'Pórobeton 350 kg/m³', 'Zdivo', 0.085, 5, 350, 1000, 'vyr'),
    M('pb400', 'Pórobeton 400 kg/m³', 'Zdivo', 0.10, 5, 400, 1000, 'vyr'),
    M('pb500', 'Pórobeton 500 kg/m³', 'Zdivo', 0.13, 7, 500, 1000, 'vyr'),
    M('vps', 'Vápenopískové zdivo 1800 kg/m³', 'Zdivo', 0.82, 20, 1800, 1000, 'vyr'),
    M('piskovec', 'Kámen – pískovec 2600 kg/m³', 'Zdivo', 2.3, 40, 2600, 1000, 'iso'),
    M('zb', 'Železobeton', 'Beton a potěry', 1.58, 29, 2400, 1020, 'csn'),
    M('bet', 'Beton hutný (prostý)', 'Beton a potěry', 1.23, 17, 2100, 1020, 'csn'),
    M('poter', 'Cementový potěr / mazanina', 'Beton a potěry', 1.16, 19, 2000, 840, 'csn'),
    M('anhydrit', 'Anhydritový potěr', 'Beton a potěry', 1.20, 15, 2100, 1000, 'vyr'),
    M('dlazba', 'Keramická dlažba', 'Beton a potěry', 1.01, 200, 2000, 840, 'csn'),
    M('lamin', 'Plovoucí podlaha (laminát, dřevo)', 'Beton a potěry', 0.15, 100, 800, 1700, 'vyr'),
    M('eps70', 'EPS 70 F fasádní (bílý)', 'Tepelné izolace', 0.039, 30, 15, 1270, 'vyr'),
    M('eps_g', 'EPS 70 F fasádní šedý (grafit)', 'Tepelné izolace', 0.032, 30, 15, 1270, 'vyr'),
    M('eps100', 'EPS 100 S (podlahový)', 'Tepelné izolace', 0.037, 40, 20, 1270, 'vyr'),
    M('eps150', 'EPS 150 S (podlahový, zátěžový)', 'Tepelné izolace', 0.035, 50, 25, 1270, 'vyr'),
    M('perimetr', 'EPS Perimetr (sokl, do země)', 'Tepelné izolace', 0.034, 50, 30, 1270, 'vyr'),
    M('xps', 'XPS extrudovaný polystyren', 'Tepelné izolace', 0.035, 100, 32, 2060, 'vyr'),
    M('mw_fas', 'Minerální vata kamenná fasádní', 'Tepelné izolace', 0.036, 1, 120, 840, 'vyr'),
    M('mw_kr', 'Minerální vata do krovu (role, desky)', 'Tepelné izolace', 0.035, 1, 20, 840, 'vyr'),
    M('pir', 'PIR deska (s textilií)', 'Tepelné izolace', 0.023, 60, 32, 1400, 'vyr'),
    M('dvd', 'Dřevovláknitá izolační deska', 'Tepelné izolace', 0.040, 5, 160, 2100, 'vyr'),
    M('celuloza', 'Foukaná celulóza', 'Tepelné izolace', 0.039, 1.5, 50, 2000, 'vyr'),
    M('konopi', 'Konopná izolace', 'Tepelné izolace', 0.040, 1.5, 35, 1600, 'vyr'),
    M('penosklo', 'Pěnové sklo (desky)', 'Tepelné izolace', 0.041, 70000, 120, 840, 'vyr'),
    M('heraklit', 'Dřevocementová deska (heraklit)', 'Tepelné izolace', 0.090, 5, 360, 1800, 'vyr'),
    M('drevo', 'Dřevo měkké (smrk, borovice) ⊥ vlákna', 'Dřevo a desky', 0.13, 50, 500, 1600, 'iso'),
    M('osb', 'OSB deska', 'Dřevo a desky', 0.13, 50, 650, 1700, 'iso'),
    M('prekliz', 'Překližka', 'Dřevo a desky', 0.13, 200, 500, 1600, 'iso'),
    M('cetris', 'Cementotřísková deska', 'Dřevo a desky', 0.23, 50, 1200, 1500, 'iso'),
    M('pe', 'Parozábrana PE fólie (sd ≈ 30 m při 0,2 mm)', 'Fólie a hydroizolace', 0.35, 150000, 920, 1800, 'fol'),
    M('pz_al', 'Parozábrana s hliníkem (sd ≈ 1500 m při 0,2 mm)', 'Fólie a hydroizolace', 0.35, 7500000, 1000, 1800, 'fol'),
    M('difuz', 'Difuzně otevřená fólie (sd ≈ 0,02 m při 0,5 mm)', 'Fólie a hydroizolace', 0.30, 40, 400, 1800, 'fol'),
    M('asf', 'Asfaltový pás modifikovaný (SBS)', 'Fólie a hydroizolace', 0.21, 40000, 1400, 1470, 'vyr'),
    M('pvc', 'Střešní fólie mPVC', 'Fólie a hydroizolace', 0.16, 15000, 1350, 960, 'vyr')
  ];

  /* Požadované a doporučené U podle ČSN 73 0540-2:2011 + Z1:2012, tab. 3, pro θim 18–22 °C včetně.
     UN = požadovaná, Urec = doporučená (UrecL = doporučená pro lehkou konstrukci < 100 kg/m²),
     pas = doporučené hodnoty pro pasivní budovy (rozmezí).
     Ověřeno 17. 11. 2026 proti: TZB-info tab. 136 „Normové hodnoty součinitele prostupu tepla UN,20 … ČSN 73 0540-2:2011“
     a Z. Svoboda (FSv ČVUT): „Součinitel prostupu tepla“, tab. 1 – oba zdroje se shodují.
     POZOR: od 1. 9. 2025 platí nové vydání ČSN 73 0540-2:2025. Podle dostupných výtahů (hazmuka.com, stavit.cz,
     TZB-info) zůstaly vnější konstrukce beze změny, hranice ploché/strmé střechy se posunula na 60°, „pasivní“
     hodnoty se jmenují cílové a změnily se požadavky na vnitřní konstrukce (k nevytápěným prostorům, mezi budovami,
     mezi prostory s rozdílem teplot) – ty zde zatím nejsou, plné znění nového vydání nebylo ověřeno. */
  const T = (id, nazev, UN, Urec, pas, tok, okraj, extra) => Object.assign({ id, nazev, UN, Urec, pas, tok, okraj }, extra || {});
  const TYPY = [
    T('stena', 'Stěna vnější', 0.30, 0.25, [0.18, 0.12], 'h', 'venku', { UrecL: 0.20 }),
    T('strecha', 'Střecha plochá a šikmá se sklonem do 45° vč.', 0.24, 0.16, [0.15, 0.10], 'nahoru', 'venku'),
    T('strecha_strma', 'Střecha strmá se sklonem nad 45°', 0.30, 0.20, [0.18, 0.12], 'nahoru', 'venku'),
    T('strop_venek', 'Strop s podlahou nad venkovním prostorem', 0.24, 0.16, [0.15, 0.10], 'dolu', 'venku'),
    T('strop_puda', 'Strop pod nevytápěnou půdou (střecha bez tepelné izolace)', 0.30, 0.20, [0.15, 0.10], 'nahoru', 'nevytap'),
    T('stena_puda', 'Stěna k nevytápěné půdě (střecha bez tepelné izolace)', 0.30, 0.25, [0.18, 0.12], 'h', 'nevytap', { UrecL: 0.20 }),
    T('zemina', 'Podlaha a stěna vytápěného prostoru přilehlá k zemině', 0.45, 0.30, [0.22, 0.15], 'dolu', 'zemina'),
    T('k_nevytap', 'Strop a stěna vnitřní z vytápěného k nevytápěnému prostoru', 0.60, 0.40, [0.30, 0.20], 'h', 'nevytap'),
    T('k_temper', 'Strop a stěna vnitřní z vytápěného k temperovanému prostoru', 0.75, 0.50, [0.38, 0.25], 'h', 'nevytap'),
    T('temper_venek', 'Strop a stěna vnější z temperovaného prostoru k venkovnímu prostředí', 0.75, 0.50, [0.38, 0.25], 'h', 'venku'),
    T('temper_zemina', 'Podlaha a stěna temperovaného prostoru přilehlá k zemině', 0.85, 0.60, [0.45, 0.30], 'dolu', 'zemina'),
    T('mezi_budovami', 'Stěna mezi sousedními budovami', 1.05, 0.70, [0.5], 'h', 'nevytap'),
    T('strop_10', 'Strop mezi prostory s rozdílem teplot do 10 °C vč.', 1.05, 0.70, null, 'nahoru', 'nevytap'),
    T('stena_10', 'Stěna mezi prostory s rozdílem teplot do 10 °C vč.', 1.30, 0.90, null, 'h', 'nevytap'),
    T('strop_5', 'Strop vnitřní mezi prostory s rozdílem teplot do 5 °C vč.', 2.2, 1.45, null, 'nahoru', 'nevytap'),
    T('stena_5', 'Stěna vnitřní mezi prostory s rozdílem teplot do 5 °C vč.', 2.7, 1.80, null, 'h', 'nevytap')
  ];
  const TYPY_MAPA = Object.fromEntries(TYPY.map(t => [t.id, t]));
  /* Výplně otvorů (tamtéž, tab. 3) – jen pro informaci u prvků místností */
  const VYPLNE = [
    { nazev: 'Výplň otvoru ve vnější stěně a strmé střeše (kromě dveří)', UN: 1.5, Urec: 1.2, pas: [0.8, 0.6] },
    { nazev: 'Šikmá výplň otvoru se sklonem do 45° (střešní okno)', UN: 1.4, Urec: 1.1, pas: [0.9] },
    { nazev: 'Dveřní výplň do venkovního prostředí (vč. rámu)', UN: 1.7, Urec: 1.2, pas: [0.9] },
    { nazev: 'Výplň z vytápěného do temperovaného prostoru', UN: 3.5, Urec: 2.3, pas: [1.7] }
  ];
  const NORMA = 'ČSN 73 0540-2:2011 + Z1:2012';
  const NORMA_POZN = 'Od 1. 9. 2025 platí ČSN 73 0540-2:2025 – požadavky na vnější konstrukce zůstaly, u vnitřních konstrukcí se změnily (ověřeno ' + STAV_DAT + ').';

  const RSI = { h: 0.13, nahoru: 0.10, dolu: 0.17 };          // ČSN EN ISO 6946
  const TOKY = { h: 'vodorovný (stěny)', nahoru: 'nahoru (stropy, střechy)', dolu: 'dolů (podlahy)' };
  const OKRAJE = { venku: 'venkovní vzduch (Rse = 0,04)', odvetrano: 'odvětraná vrstva (Rse = Rsi)', nevytap: 'nevytápěný prostor (Rse = Rsi)', zemina: 'zemina (Rse = 0)' };
  const RSI_POVRCH = 0.25;                                       // pro fRsi a plísně (ČSN EN ISO 13788)
  function rse(okraj, tok) { return okraj === 'venku' ? 0.04 : okraj === 'zemina' ? 0 : RSI[tok] || 0.13; }

  /* Výpočtové venkovní teploty θe – ČSN EN 12831 (národní příloha), tab. NA.1 (= hodnoty ČSN 06 0210 / ČSN 38 3350).
     Sloupce: místo, výška klimatické stanice h [m], θe [°C], v = větrná oblast, průměrná venkovní teplota otopného
     období θm,e [°C] a počet otopných dní d pro mez vytápění θhp,e = 13 °C.
     Ověřeno 17. 11. 2026 proti: tab. NA.1 (výtah ČVUT FSv, tzb.fsv.cvut.cz … vnitrni-a-venkovni-vypoctove-teploty-dle-csn-en-12831),
     TZB-info „Venkovní výpočtové teploty a otopná období dle lokalit“ a ČVUT „Výpočet tepelných ztrát dle ČSN 06 0210“.
     Rozpor: Olomouc v tabulce ČSN 06 0210 (ČVUT) −12 °C, v NA.1 i TZB-info −15 °C → použito −15 °C.
     Pozor: ČSN 73 0540-3 (posouzení konstrukcí) určuje θe jinak – z mapy teplotních oblastí a nadmořské výšky objektu
     (např. Praha −13 °C); pro tepelné ztráty podle ČSN EN 12831 platí tato tabulka. */
  const MESTA = [
    ['Benešov', 327, -15, 0, 3.9, 245], ['Beroun', 229, -12, 0, 4.1, 236], ['Blansko', 273, -15, 0, 3.7, 241],
    ['Brno', 227, -12, 1, 4.0, 232], ['Bruntál', 546, -18, 1, 3.3, 271], ['Břeclav', 159, -12, 0, 4.4, 224],
    ['Česká Lípa', 276, -15, 0, 3.8, 245], ['České Budějovice', 384, -15, 0, 3.8, 244], ['Český Krumlov', 489, -18, 1, 3.5, 254],
    ['Domažlice', 428, -15, 1, 3.8, 247], ['Děčín', 141, -12, 0, 4.2, 236], ['Frýdek-Místek', 300, -15, 1, 3.8, 236],
    ['Havlíčkův Brod', 422, -15, 1, 3.3, 253], ['Hodonín', 162, -12, 0, 4.2, 215], ['Hradec Králové', 244, -12, 0, 3.9, 242],
    ['Cheb', 448, -15, 0, 3.6, 262], ['Chomutov', 330, -12, 1, 4.1, 233], ['Chrudim', 276, -12, 1, 4.1, 238],
    ['Jablonec nad Nisou', 502, -18, 1, 3.6, 256],
    ['Jeseník', 432, -18, 0, null, null, 'není v tab. NA.1 – odhad (sousední Bruntál −18v, Šumperk −15v; nad 400 m n. m.), ověřte'],
    ['Jihlava', 516, -15, 0, 3.5, 257], ['Jindřichův Hradec', 478, -15, 0, 3.5, 256], ['Jičín', 278, -15, 0, 3.9, 234],
    ['Karlovy Vary', 379, -15, 1, 3.8, 254], ['Karviná', 230, -15, 0, 4.0, 234], ['Kladno', 380, -15, 0, 4.5, 258],
    ['Klatovy', 409, -15, 1, 3.9, 248], ['Kolín', 223, -12, 1, 4.4, 226], ['Kroměříž', 207, -12, 0, 3.9, 227],
    ['Kutná Hora', 253, -12, 1, 4.4, 226], ['Liberec', 357, -18, 0, 3.6, 256], ['Litoměřice', 171, -12, 1, 4.1, 232],
    ['Louny', 201, -12, 0, 4.1, 229], ['Mladá Boleslav', 230, -12, 0, 3.9, 235], ['Most', 230, -12, 1, 4.1, 233],
    ['Mělník', 155, -12, 0, 4.1, 229], ['Nový Jičín', 284, -15, 1, 3.8, 242], ['Nymburk', 186, -12, 1, 4.2, 228],
    ['Náchod', 344, -15, 0, 3.7, 250], ['Olomouc', 226, -15, 0, 3.8, 231], ['Opava', 258, -15, 0, 3.9, 239],
    ['Ostrava', 217, -15, 0, 4.0, 229], ['Pardubice', 223, -12, 1, 4.1, 234], ['Pelhřimov', 499, -15, 1, 3.6, 257],
    ['Plzeň', 311, -12, 0, 3.6, 242], ['Prachatice', 574, -18, 1, 3.8, 267], ['Praha', 181, -12, 0, 4.3, 225],
    ['Prostějov', 226, -15, 0, 3.8, 230], ['Písek', 348, -15, 0, 3.7, 247], ['Přerov', 212, -12, 0, 3.9, 228],
    ['Příbram', 502, -15, 0, 3.5, 252], ['Rakovník', 332, -15, 0, 4.0, 250], ['Rokycany', 363, -15, 0, 3.5, 252],
    ['Rychnov nad Kněžnou', 325, -15, 0, 3.5, 254], ['Semily', 334, -18, 1, 3.4, 259], ['Sokolov', 405, -15, 1, 3.9, 254],
    ['Strakonice', 392, -15, 0, 3.8, 249], ['Svitavy', 447, -15, 0, 3.4, 248], ['Šumperk', 317, -15, 1, 3.5, 242],
    ['Tachov', 496, -15, 0, 3.6, 250], ['Teplice', 205, -12, 1, 4.1, 230], ['Trutnov', 428, -18, 0, 3.3, 257],
    ['Tábor', 480, -15, 0, 3.5, 250], ['Třebíč', 406, -15, 0, 3.1, 263], ['Uherské Hradiště', 181, -12, 1, 3.6, 233],
    ['Ústí nad Labem', 145, -12, 1, 3.9, 229], ['Ústí nad Orlicí', 332, -15, 1, 3.6, 251], ['Vsetín', 346, -15, 0, 3.6, 236],
    ['Vyškov', 245, -12, 0, 3.7, 229], ['Zlín', 234, -12, 0, 4.0, 226], ['Znojmo', 289, -12, 0, 3.9, 226],
    ['Žďár nad Sázavou', 572, -15, 0, 3.1, 270]
  ].map(([n, h, te, v, tes, dni, pozn]) => Object.assign({ n, h, te, v: !!v, tes, dni }, pozn ? { pozn } : {}))
    .sort((a, b) => a.n.localeCompare(b.n, 'cs'));
  const MESTA_ZDROJ = 'ČSN EN 12831, národní příloha, tab. NA.1 (ověřeno 17. 11. 2026)';

  /* Měsíční klima referenční stanice – normály 1991–2020 stanice Praha-Ruzyně (WMO 11518, 364 m n. m.), jak je ČHMÚ
     předal WMO: „WMO Climate Normals 1991–2020“, NOAA NCEI archiv 0253808, soubor PrahaRuzyne_11518.csv
     (parametr 5 Daily_Mean_Temperature a 7 Mean_Vapor_Pressure). Ověřeno 17. 11. 2026.
     Relativní vlhkost normál neuvádí – φe je dopočtena z průměrného tlaku páry e: φe = e / psat(θe), zaokrouhleno.
     Zachová tak správný průměrný částečný tlak páry pe, který Glaserova metoda potřebuje (průměr měřené φ bývá
     v zimě asi o 3–5 % nižší, např. leden ≈ 85 %). Tlak páry e [Pa]: 517 523 617 776 1074 1349 1462 1444 1185 938 720 565.
     Pro jinou nadmořskou výšku se teploty orientačně posouvají o −0,55 °C na 100 m (pro projekt použijte
     tab. H.3 ČSN 73 0540-3 nebo data ČHMÚ pro lokalitu). */
  const KLIMA_REF = {
    stanice: 'Praha-Ruzyně', vyska: 364,
    t: [-0.7, 0.3, 4.0, 9.2, 13.6, 17.0, 18.9, 18.7, 13.9, 8.7, 3.8, 0.4],
    phi: [90, 84, 76, 67, 69, 70, 67, 67, 75, 83, 90, 90],
    zdroj: 'normály 1991–2020 (ČHMÚ / WMO, ověřeno 17. 11. 2026); φe dopočtena z průměrného tlaku vodní páry'
  };
  const GRADIENT = 0.0055;
  /* Vlhkostní třídy interiéru podle ČSN EN ISO 13788:2013 (EN ISO 13788:2012), příl. A: Δp při θe ≤ 0 °C, lineárně
     k nule při θe = 20 °C; ve výpočtu se násobí bezpečnostním součinitelem 1,1. Ověřeno 17. 11. 2026 (Z. Svoboda,
     FSv ČVUT: Okrajové podmínky pro tepelně technické výpočty, obr. 11 a tab. 5). Pozn.: ČSN 73 0540-3 předepisuje
     pro běžné budovy 4. třídu podle staršího vydání EN ISO 13788:2001 – té po revizi 2012 odpovídá třída 3. */
  const TRIDY = [
    { n: 1, dp: 270, popis: 'sklady' }, { n: 2, dp: 540, popis: 'kanceláře, obchody' },
    { n: 3, dp: 810, popis: 'byty s nízkým obsazením' }, { n: 4, dp: 1080, popis: 'byty s vysokým obsazením, sportovní haly, kuchyně' },
    { n: 5, dp: 1350, popis: 'zvláštní budovy (prádelny, bazény)' }
  ];
  const TEPLOTY_MISTNOSTI = [
    { n: 'Obytná místnost', t: 20 }, { n: 'Kuchyně', t: 20 }, { n: 'Koupelna', t: 24 }, { n: 'WC', t: 20 },
    { n: 'Chodba, předsíň (vytápěná)', t: 15 }, { n: 'Schodiště (vytápěné)', t: 10 }
  ];
  const HRANICE = { venku: 'venkovní vzduch', zemina: 'zemina', nevytap: 'nevytápěný prostor', mistnost: 'jiná místnost' };

  /* ---------- pomocné ---------- */
  const cislo = (v, vych) => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : vych; };
  const omez = (v, a, b) => Math.min(b, Math.max(a, v));
  function novyId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmt(x, des = 2) {
    if (x == null || !isFinite(x)) return '–';
    return x.toFixed(des).replace('-', '−').replace('.', ',');
  }

  /* bezpečný výpočet výrazu plochy: čísla, + − * / a závorky, desetinná čárka */
  function vyraz(s) {
    const t = String(s == null ? '' : s).replace(/,/g, '.').replace(/[×x]/g, '*').replace(/\s+/g, '');
    if (!t) return NaN;
    let i = 0;
    const cti = () => { const m = /^\d+(\.\d+)?|^\.\d+/.exec(t.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
    function prvek() {
      if (t[i] === '-') { i++; return -prvek(); }
      if (t[i] === '+') { i++; return prvek(); }
      if (t[i] === '(') { i++; const v = soucet(); if (t[i] !== ')') throw 0; i++; return v; }
      return cti();
    }
    function soucin() { let v = prvek(); while (t[i] === '*' || t[i] === '/') { const o = t[i++]; const b = prvek(); v = o === '*' ? v * b : v / b; } return v; }
    function soucet() { let v = soucin(); while (t[i] === '+' || t[i] === '-') { const o = t[i++]; const b = soucin(); v = o === '+' ? v + b : v - b; } return v; }
    try { const v = soucet(); return i === t.length && isFinite(v) ? v : NaN; } catch (e) { return NaN; }
  }

  /* ---------- vlhkost ---------- */
  function psat(t) { return t >= 0 ? 610.5 * Math.exp(17.269 * t / (237.3 + t)) : 610.5 * Math.exp(21.875 * t / (265.5 + t)); }
  function teplotaZTlaku(p) {
    if (!(p > 0)) return -100;
    const x = Math.log(p / 610.5);
    return p >= 610.5 ? 237.3 * x / (17.269 - x) : 265.5 * x / (21.875 - x);
  }

  /* ---------- materiály a vrstvy ---------- */
  function mapaMaterialu(projekt) {
    const m = Object.fromEntries(MATERIALY.map(x => [x.id, x]));
    for (const x of (projekt && projekt.materialy) || []) m[x.id] = x;
    return m;
  }
  function vrstva(v, mapa) {
    const m = mapa[v.mat]; const d = cislo(v.d, 0) / 1000;
    if (!m || !(d > 0)) return null;
    const m2 = v.mat2 && cislo(v.podil, 0) > 0 ? mapa[v.mat2] : null;
    const f = m2 ? omez(cislo(v.podil, 0), 0, 100) / 100 : 0;
    let lam = m.lam, mu = m.mu, rho = m.rho, c = m.c;
    if (m2) {
      lam = (1 - f) * m.lam + f * m2.lam;                  // dolní mez (izotermické roviny)
      mu = 1 / ((1 - f) / m.mu + f / m2.mu);               // plošně vážená propustnost
      rho = (1 - f) * m.rho + f * m2.rho;
      c = ((1 - f) * m.rho * m.c + f * m2.rho * m2.c) / rho;
    }
    return { d, lam, mu, rho, c, R: d / lam, sd: mu * d, hmotnost: rho * d, m, m2, f };
  }

  /* ---------- skladba ---------- */
  function okrajoveOdpory(s) { const tok = RSI[s.tok] ? s.tok : 'h'; return { Rsi: RSI[tok], Rse: rse(s.okraj, tok) }; }

  /* Zaokrouhlení přepočtených požadavků podle ČSN 73 0540-2:2011 čl. 5.2: do 0,4 na setiny, od 0,4 do 2,0 na pět setin,
     od 2,0 na desetiny (Z. Svoboda, FSv ČVUT: Součinitel prostupu tepla). */
  function zaokrouhliU(u) {
    const krok = u < 0.4 ? 0.01 : u < 2 ? 0.05 : 0.1;
    return Math.round(Math.round(u / krok) * krok * 1000) / 1000;
  }
  function pozadavky(typId, thetaIm, lehka) {
    const t = TYPY_MAPA[typId]; if (!t) return null;
    const ti = cislo(thetaIm, 20);
    // ČSN 73 0540-2:2011 čl. 5.2.1: pro θim mimo 18–22 °C UN = UN,20 · e1, e1 = 16 / (θim − 4) (stejně Urec a Upas)
    const e1 = ti >= 18 && ti <= 22 ? 1 : ti > 4 ? 16 / (ti - 4) : NaN;
    const prepocet = u => e1 === 1 ? u : zaokrouhliU(u * e1);
    const urec = lehka && t.UrecL ? t.UrecL : t.Urec;
    return { typ: t, e1, UN: prepocet(t.UN), Urec: prepocet(urec), pas: t.pas ? t.pas.map(prepocet) : null };
  }

  function vypocitejSkladbu(s, mapa, thetaIm) {
    const { Rsi, Rse } = okrajoveOdpory(s);
    const vr = (s.vrstvy || []).map(v => vrstva(v, mapa)).filter(Boolean);
    const varovani = [];
    const Rkon = vr.reduce((a, v) => a + v.R, 0);
    const Rdolni = Rsi + Rse + Rkon;
    let Rhorni = Rdolni;
    const mix = vr.filter(v => v.m2);
    if (mix.length) {
      const fs = [...new Set(mix.map(v => v.f))];
      if (fs.length === 1) {
        const f = fs[0];
        const Ra = Rsi + Rse + vr.reduce((a, v) => a + v.d / v.m.lam, 0);
        const Rb = Rsi + Rse + vr.reduce((a, v) => a + v.d / (v.m2 ? v.m2.lam : v.m.lam), 0);
        Rhorni = 1 / ((1 - f) / Ra + f / Rb);
        if (Rhorni / Rdolni > 1.5) varovani.push('Poměr horní a dolní meze odporu je větší než 1,5 – zjednodušená metoda ČSN EN ISO 6946 je nepřesná, posuďte tepelné mosty podrobně (2D výpočtem).');
      } else varovani.push('Nehomogenní vrstvy mají různé podíly – použita jen dolní mez odporu (na straně bezpečnosti).');
    }
    const RT = (Rhorni + Rdolni) / 2;
    const U = vr.length ? 1 / RT : NaN;
    const hmotnost = vr.reduce((a, v) => a + v.hmotnost, 0);
    const sd = vr.reduce((a, v) => a + v.sd, 0);
    const lehka = hmotnost < 100;
    const poz = pozadavky(s.typ, thetaIm, lehka);
    // potřebná tloušťka nejlépe izolující homogenní vrstvy pro dosažení cílů
    let izol = null;
    vr.forEach((v, i) => { if (!v.m2 && (!izol || v.lam < izol.v.lam)) izol = { v, i }; });
    const tloustka = cil => {
      if (!izol || !(cil > 0)) return null;
      if (1 / RT <= cil) return 0;                          // už splněno
      const d = izol.v.d + izol.v.lam * (1 / cil - RT);
      return d > 0 ? d : 0;
    };
    const cile = poz ? { UN: tloustka(poz.UN), Urec: tloustka(poz.Urec), pas: poz.pas ? tloustka(poz.pas[0]) : null } : null;
    return { vrstvy: vr, Rsi, Rse, Rkon, Rdolni, Rhorni, RT, R: RT - Rsi - Rse, U, hmotnost, sd, lehka, poz, izol: izol && { index: izol.i, nazev: izol.v.m.nazev, d: izol.v.d, cile }, varovani };
  }

  /* ---------- teplotní faktor a plísně ---------- */
  function fRsi(U) { return 1 - U * RSI_POVRCH; }
  /* Požadovaný teplotní faktor fRsi,N = fRsi,cr podle ČSN 73 0540-2:2011 (+Z1), čl. 5.1:
     kritická povrchová vlhkost 80 % (plísně; u výplní otvorů 100 % – kondenzace, jen doporučeno),
     návrhová vlhkost φi,r = φi + Δφi, Δφi = 5 % (přirážka), a u prostorů bez řízené vlhkosti se φi snižuje o 1 %
     za každý °C, o který je θe pod −5 °C, nejvýše však na φi,r = 45 % (snizeni = true).
     Ověřeno 17. 11. 2026: TZB-info „Nová ČSN 73 0540-2 … Požadavky“ (příklad Praha θe −13 °C: 50 − 8 + 5 = 47 %,
     fRsi,N = 0,753; Tábor −17 °C: φi,r 45 %, θsi,N 11,96 °C při θai 21 °C), Atelier DEK „Změna ČSN 73 0540-2“,
     posudek osazení oken (montazokna.cz): φi,r = φi + 100·Δφr·(θe + 5) + Δφi, pro θe = −15 °C φi,r = 45 %.
     ti má být návrhová teplota vnitřního vzduchu θai = θi + Δθai (ČSN 73 0540-3, tab. I.2; např. 20 + 0,6 až 1 °C). */
  function fRsiPozadovany(ti, phiProc, te, prirazkaProc, snizeni) {
    const phiI = cislo(phiProc, 50), dphi = cislo(prirazkaProc, 0), tE = cislo(te, -12);
    let phiR = phiI + dphi;
    if (snizeni !== false && tE < -5) phiR = Math.max(phiI - (-5 - tE) + dphi, Math.min(45, phiR));
    const phi = Math.min(100, phiR) / 100;
    const pi = phi * psat(ti);
    const tcr = teplotaZTlaku(pi / 0.8);
    return { phiR: phi * 100, pi, tcr, tRosa: teplotaZTlaku(pi), f: (tcr - tE) / (ti - tE) };
  }
  /* Návrhová relativní vlhkost venkovního vzduchu podle ČSN 73 0540-3 (vztah platí pro θe od −21 do 25 °C):
     φe = (93·θe − 3153,5) / (θe − 39,17) [%] (Z. Svoboda, FSv ČVUT: Okrajové podmínky…, vztah 3; pro −15 °C ≈ 84 %). */
  function phiENavrh(te) { const t = omez(cislo(te, -15), -21, 25); return (93 * t - 3153.5) / (t - 39.17); }

  /* ---------- průběh v konstrukci a Glaser ---------- */
  // rozhraní 0 = vnitřní povrch, n = vnější povrch
  function rozhrani(vr, Rsi, Rse, ti, te) {
    const RT = Rsi + Rse + vr.reduce((a, v) => a + v.R, 0);
    const q = (ti - te) / RT;
    const x = [0], R = [Rsi], sd = [0];
    vr.forEach(v => { x.push(x[x.length - 1] + v.d); R.push(R[R.length - 1] + v.R); sd.push(sd[sd.length - 1] + v.sd); });
    const theta = R.map(r => ti - q * r);
    return { x, sd, theta, ps: theta.map(psat), q, RT };
  }

  // dolní konvexní obálka mezi kotvami a a b (tlak nesmí přesáhnout psat) – vrací body dotyku
  function obalka(sd, ps, a, pa, b, pb, p) {
    const dotyky = [];
    while (a < b) {
      let nej = b, sklon = (pb - pa) / (sd[b] - sd[a]);
      for (let j = a + 1; j < b; j++) { const s = (ps[j] - pa) / (sd[j] - sd[a]); if (s < sklon - 1e-12) { sklon = s; nej = j; } }
      const pn = nej === b ? pb : ps[nej];
      for (let j = a + 1; j <= nej; j++) p[j] = pa + (pn - pa) * (sd[j] - sd[a]) / (sd[nej] - sd[a]);
      if (nej !== b) dotyky.push(nej);
      a = nej; pa = pn;
    }
    return dotyky;
  }

  /* Jeden ustálený stav: tlaky p (s kondenzací), bez kondenzace p0, rychlost kondenzace g[j] (kg/(m²·s), záporná = vypařování).
     mokra = rozhraní, kde je nahromaděná voda (tlak pevně psat). */
  function stav(vr, Rsi, Rse, ti, te, pi, pe, mokra) {
    const r = rozhrani(vr, Rsi, Rse, ti, te), n = vr.length;
    const sdT = r.sd[n] || 1e-9;
    const p0 = r.sd.map(s => pi - (pi - pe) * s / sdT);
    const kotvy = [0].concat((mokra || []).filter(j => j > 0 && j < n).sort((a, b) => a - b), [n]);
    const p = r.sd.slice(); p[0] = pi; p[n] = pe;
    const hodnota = j => j === 0 ? pi : j === n ? pe : r.ps[j];
    let uzly = [0];
    for (let k = 1; k < kotvy.length; k++) {
      const d = obalka(r.sd, r.ps, kotvy[k - 1], hodnota(kotvy[k - 1]), kotvy[k], hodnota(kotvy[k]), p);
      uzly = uzly.concat(d, [kotvy[k]]);
    }
    uzly = [...new Set(uzly)].sort((a, b) => a - b);
    const g = new Array(n + 1).fill(0);
    for (let k = 1; k < uzly.length - 1; k++) {
      const a = uzly[k - 1], j = uzly[k], b = uzly[k + 1];
      g[j] = DELTA0 * ((p[a] - p[j]) / (r.sd[j] - r.sd[a]) - (p[j] - p[b]) / (r.sd[b] - r.sd[j]));
    }
    const tok = DELTA0 * (pi - pe) / sdT;  // difuzní tok bez kondenzace
    return Object.assign(r, { p, p0, g, pi, pe, tok, kondenzace: g.some(x => x > 1e-14) });
  }

  function vnitrniTlak(vnitrni, ti, te, pe) {
    if (vnitrni.rezim === 'trida') {
      const tr = TRIDY.find(t => t.n === cislo(vnitrni.trida, 3)) || TRIDY[2];
      const dp = tr.dp * omez((20 - te) / 20, 0, 1) * 1.1;   // ČSN EN ISO 13788: bezpečnostní součinitel 1,1
      return Math.min(pe + dp, 0.95 * psat(ti));
    }
    return omez(cislo(vnitrni.phi, 50), 0, 100) / 100 * psat(ti);
  }

  function klimaLokality(vyska, vlastni) {
    if (Array.isArray(vlastni) && vlastni.length === 12) return vlastni.map(m => ({ t: cislo(m.t, 0), phi: omez(cislo(m.phi, 80), 1, 100) }));
    const dh = cislo(vyska, KLIMA_REF.vyska) - KLIMA_REF.vyska;
    return KLIMA_REF.t.map((t, i) => ({ t: Math.round((t - GRADIENT * dh) * 10) / 10, phi: KLIMA_REF.phi[i] }));
  }

  /* Roční bilance zkondenzované vodní páry po měsících (ČSN EN ISO 13788) */
  function bilance(s, mapa, klima, vnitrni) {
    const vr = (s.vrstvy || []).map(v => vrstva(v, mapa)).filter(Boolean);
    const { Rsi, Rse } = okrajoveOdpory(s);
    const n = vr.length, ti = cislo(vnitrni.ti, 20);
    const podm = klima.map(k => { const pe = k.phi / 100 * psat(k.t); return { te: k.t, phi: k.phi, pe, pi: vnitrniTlak(vnitrni, ti, k.t, pe) }; });
    const vysledek = { mesice: [], start: -1, Mmax: 0, Mkonec: 0, Mc: 0, Mev: 0, rozhrani: new Set(), hromadi: false };
    if (!n) return vysledek;
    const sKond = podm.map(c => stav(vr, Rsi, Rse, ti, c.te, c.pi, c.pe, []).kondenzace);
    if (!sKond.some(Boolean)) {
      vysledek.mesice = podm.map((c, i) => Object.assign({ mesic: i, g: 0, M: 0, fmin: fminMesic(c, ti) }, c));
      return vysledek;
    }
    let start = sKond.findIndex((k, i) => k && !sKond[(i + 11) % 12]);
    if (start < 0) { start = 0; vysledek.hromadi = true; }
    vysledek.start = start;
    const Mj = new Array(n + 1).fill(0);
    const radky = new Array(12);
    for (let rok = 0; rok < 2; rok++) {
      for (let k = 0; k < 12; k++) {
        const i = (start + k) % 12, c = podm[i], dt = DNY[i] * 86400;
        const mokra = Mj.map((m, j) => m > 0 ? j : -1).filter(j => j > 0);
        const st = stav(vr, Rsi, Rse, ti, c.te, c.pi, c.pe, mokra);
        let gm = 0;
        for (let j = 1; j < n; j++) {
          if (!st.g[j]) continue;
          const pred = Mj[j];
          Mj[j] = Math.max(0, Mj[j] + st.g[j] * dt);
          const zmena = Mj[j] - pred; gm += zmena;
          if (rok === 0) { if (zmena > 0) { vysledek.Mc += zmena; vysledek.rozhrani.add(j); } else vysledek.Mev -= zmena; }
        }
        const M = Mj.reduce((a, b) => a + b, 0);
        if (rok === 0) {
          radky[i] = Object.assign({ mesic: i, g: gm, M, fmin: fminMesic(c, ti), stav: st }, c);
          vysledek.Mmax = Math.max(vysledek.Mmax, M);
        }
      }
      if (rok === 0) vysledek.Mkonec = Mj.reduce((a, b) => a + b, 0);
    }
    if (vysledek.Mkonec > 1e-6) vysledek.hromadi = true;
    vysledek.mesice = radky;
    return vysledek;
  }
  // nejmenší teplotní faktor, který ještě nezpůsobí plísně v daném měsíci (ČSN EN ISO 13788, kap. 5)
  function fminMesic(c, ti) {
    if (ti - c.te < 1) return null;
    const tmin = teplotaZTlaku(c.pi / 0.8);
    return (tmin - c.te) / (ti - c.te);
  }

  /* Limity ČSN 73 0540-2:2011 čl. 6.2 pro roční množství kondenzátu Mc,a (vždy nižší z hodnot):
     prisna (výchozí) – jednoplášťové střechy, konstrukce s dřevěnými prvky, kontaktní zateplení a konstrukce s difuzně
     málo propustnou vnější vrstvou: 0,10 kg/(m²·a) nebo 3 % (ρ ≤ 100 kg/m³: 6 %) plošné hmotnosti materiálu v místě kondenzace;
     ostatní konstrukce: 0,50 kg/(m²·a) nebo 5 % (ρ ≤ 100 kg/m³: 10 %).
     Ověřeno 17. 11. 2026: Z. Svoboda (FSv ČVUT) „Difúze vodní páry a její kondenzace uvnitř konstrukcí“, izolace-info.cz.
     Vyhodnocuje se přísnější ze sousedních vrstev rozhraní. */
  function limitKondenzace(s, mapa, rozhraniSet, prisna) {
    const vr = (s.vrstvy || []).map(v => vrstva(v, mapa)).filter(Boolean);
    const p = prisna === false;
    let lim = p ? 0.5 : 0.1;
    for (const j of rozhraniSet || []) {
      for (const v of [vr[j - 1], vr[j]]) if (v) lim = Math.min(lim, v.hmotnost * (v.rho > 100 ? (p ? 0.05 : 0.03) : (p ? 0.10 : 0.06)));
    }
    return lim;
  }

  /* ---------- tepelné ztráty ---------- */
  function vysledkySkladeb(projekt, mapa) {
    const ti = cislo(projekt.kondenzace && projekt.kondenzace.ti, 20);
    return Object.fromEntries((projekt.skladby || []).map(s => [s.id, vypocitejSkladbu(s, mapa, ti)]));
  }

  function ztraty(projekt, mapa) {
    const L = projekt.lokalita || {}, te = cislo(L.te, -12), tme = cislo(L.tme, 8);
    const dU = cislo(L.dU, 0.05), Gw = cislo(L.Gw, 1), prir = cislo(L.prirazka, 0) / 100;
    const eta = omez(cislo(L.eta, 0), 0, 95) / 100, ninf = cislo(L.ninf, 0);
    const sk = vysledkySkladeb(projekt, mapa);
    const budova = { HT: 0, HV: 0, PhiT: 0, PhiV: 0, Phi: 0, plocha: 0, objem: 0 };
    const mistnosti = (projekt.mistnosti || []).map(m => {
      const ti = cislo(m.t, 20), plocha = cislo(m.plocha, 0), vyska = cislo(m.vyska, 2.6), V = plocha * vyska;
      let PhiT = 0, PhiTven = 0, HT = 0;
      const prvky = (m.prvky || []).map(p => {
        const zs = p.skladba && sk[p.skladba];
        const U = zs ? zs.U : cislo(p.U, NaN);
        const A = vyraz(p.A);
        let dT, Uk = U, H;
        if (p.hranice === 'mistnost') { dT = ti - cislo(p.t, 20); }
        else {
          Uk = U + dU;
          dT = p.hranice === 'zemina' ? 1.45 * Gw * (ti - tme) : ti - (p.hranice === 'nevytap' ? cislo(p.t, 5) : te);
        }
        const ok = isFinite(Uk) && isFinite(A);
        const Phi = ok ? A * Uk * dT : 0;
        if (ok) {
          PhiT += Phi;
          if (p.hranice !== 'mistnost') { PhiTven += Phi; H = A * Uk * dT / (ti - te || 1); HT += H; }
        }
        return { nazev: p.nazev, U, Uk, A, dT, Phi, chyba: !ok };
      });
      const n = cislo(m.n, 0.5) * (1 - eta) + ninf;
      const HV = RHO_C_VZD * V * n;
      const PhiV = HV * (ti - te);
      const Phi = (PhiT + PhiV) * (1 + prir);
      budova.HT += HT; budova.HV += HV; budova.PhiT += PhiTven; budova.PhiV += PhiV; budova.plocha += plocha; budova.objem += V;
      budova.Phi += (PhiTven + PhiV) * (1 + prir);
      return { id: m.id, nazev: m.nazev, t: ti, plocha, V, n, prvky, PhiT, PhiV, Phi, Wm2: plocha > 0 ? Phi / plocha : NaN };
    });
    budova.H = budova.HT + budova.HV;
    budova.Wm2 = budova.plocha > 0 ? budova.Phi / budova.plocha : NaN;
    budova.Wm3 = budova.objem > 0 ? budova.Phi / budova.objem : NaN;
    // průměrná vnitřní teplota (z H): Φ = H·(θi,m − θe)
    budova.tim = budova.H > 0 ? te + (budova.PhiT + budova.PhiV) / budova.H : 20;
    return { te, mistnosti, budova, soucet: mistnosti.reduce((a, m) => a + m.Phi, 0) };
  }

  /* ---------- zdroj tepla ---------- */
  function zdroj(z, budova, te) {
    const Phi = budova.Phi / 1000;  // kW
    const tm = cislo(z.mez, 20);
    const zatez = t => Math.max(0, Phi * (tm - t) / (tm - te));
    const QTVden = cislo(z.osoby, 0) * cislo(z.litry, 40) * (cislo(z.tTV, 55) - 10) * 1.163 / 1000; // kWh/den
    const PTV = QTVden / Math.max(1, cislo(z.tOhrev, 6));
    const blok = omez(cislo(z.blokace, 0), 0, 12);
    const kBlok = 24 / (24 - blok);
    const rez = 1 + cislo(z.rezerva, 10) / 100;
    const vysl = {
      Phi, PTV, QTVden, kBlok, zatez,
      body: [te, -7, -5, 2, 7].map(t => ({ t, P: zatez(t) * kBlok })),
      kotel: Phi * rez, kotelTV: Phi * rez + PTV
    };
    // tepelné čerpadlo: přímka výkonu ze dvou bodů A−7 a A2
    const p7 = cislo(z.tc7, NaN), p2 = cislo(z.tc2, NaN);
    if (isFinite(p7) && isFinite(p2) && p7 > 0 && p2 > 0) {
      const k = (p2 - p7) / 9, tc = t => Math.max(0, p7 + k * (t + 7));
      vysl.tc = tc;
      // bod bivalence: Φ(t)·kBlok = tc(t)
      let biv = null;
      for (let t = 20; t >= te - 15; t -= 0.1) { if (zatez(t) * kBlok >= tc(t)) { biv = Math.round(t * 10) / 10; break; } }
      vysl.bivalence = biv;
      vysl.dohrev = Math.max(0, zatez(te) * kBlok - tc(te));
    }
    const D = cislo(z.dni, 225) * (budova.tim - cislo(z.tes, 4));
    vysl.D = D;
    vysl.Qrok = budova.H * 24 * D / 1000;        // kWh, bez vnitřních a solárních zisků
    vysl.QTVrok = QTVden * 365;
    return vysl;
  }

  /* ---------- projekt ---------- */
  function vrstvaN(v) { return { mat: String(v && v.mat || 'om_vc'), d: cislo(v && v.d, 10), mat2: String(v && v.mat2 || ''), podil: cislo(v && v.podil, 0) }; }
  function skladbaN(s) {
    s = s || {};
    const typ = TYPY_MAPA[s.typ] ? s.typ : 'stena';
    return {
      id: String(s.id || novyId()), nazev: String(s.nazev || 'Skladba'), typ,
      tok: RSI[s.tok] ? s.tok : TYPY_MAPA[typ].tok, okraj: OKRAJE[s.okraj] ? s.okraj : TYPY_MAPA[typ].okraj,
      vrstvy: Array.isArray(s.vrstvy) ? s.vrstvy.map(vrstvaN) : []
    };
  }
  function prvekN(p) {
    p = p || {};
    return { nazev: String(p.nazev || ''), skladba: String(p.skladba || ''), U: p.U == null ? '' : String(p.U), A: String(p.A == null ? '' : p.A), hranice: HRANICE[p.hranice] ? p.hranice : 'venku', t: p.t == null ? '' : String(p.t) };
  }
  function mistnostN(m) {
    m = m || {};
    return { id: String(m.id || novyId()), nazev: String(m.nazev || 'Místnost'), t: cislo(m.t, 20), plocha: cislo(m.plocha, 0), vyska: cislo(m.vyska, 2.6), n: cislo(m.n, 0.5), prvky: Array.isArray(m.prvky) ? m.prvky.map(prvekN) : [] };
  }
  function materialN(x) {
    return { id: String(x.id || 'u_' + novyId()), nazev: String(x.nazev || 'Vlastní materiál'), kat: 'Vlastní', lam: Math.max(0.001, cislo(x.lam, 1)), mu: Math.max(1, cislo(x.mu, 1)), rho: Math.max(0, cislo(x.rho, 1000)), c: Math.max(0, cislo(x.c, 1000)), zdroj: String(x.zdroj || 'vlastni') };
  }
  const LOKALITA = { mesto: 'Praha', te: -12, vyska: 300, tme: 8, dU: 0.05, Gw: 1, eta: 0, ninf: 0, prirazka: 0 };
  const KONDENZACE = { ti: 21, phi: 50, rezim: 'konst', trida: 3, phie: 84, prirazka: 5, prisna: 'ano' };
  const ZDROJ = { osoby: 4, litry: 40, tTV: 55, tOhrev: 6, blokace: 0, rezerva: 10, tc7: '', tc2: '', mez: 20, dni: 225, tes: 4 };
  function projektN(p) {
    p = p && typeof p === 'object' ? p : {};
    const spoj = (vych, x) => { const o = Object.assign({}, vych); for (const k in vych) if (x && x[k] != null && x[k] !== '') o[k] = typeof vych[k] === 'number' ? cislo(x[k], vych[k]) : x[k]; return o; };
    const proj = {
      verze: VERZE, id: String(p.id || novyId()), nazev: String(p.nazev || 'Nový projekt'), upraveno: String(p.upraveno || ''),
      lokalita: spoj(LOKALITA, p.lokalita), kondenzace: spoj(KONDENZACE, p.kondenzace), zdroj: spoj(ZDROJ, p.zdroj),
      klima: Array.isArray(p.klima) && p.klima.length === 12 ? p.klima.map(m => ({ t: cislo(m.t, 0), phi: cislo(m.phi, 80) })) : null,
      materialy: Array.isArray(p.materialy) ? p.materialy.map(materialN) : [],
      skladby: Array.isArray(p.skladby) ? p.skladby.map(skladbaN) : [],
      mistnosti: Array.isArray(p.mistnosti) ? p.mistnosti.map(mistnostN) : []
    };
    // hodnoty ZDROJ tc7/tc2 jsou volitelné texty
    ['tc7', 'tc2'].forEach(k => { proj.zdroj[k] = p.zdroj && p.zdroj[k] != null ? String(p.zdroj[k]) : ''; });
    return proj;
  }

  function vzorovyProjekt() {
    const s = (id, nazev, typ, vrstvy) => ({ id, nazev, typ, vrstvy: vrstvy.map(([mat, d, mat2, podil]) => ({ mat, d, mat2, podil })) });
    const pr = (nazev, A, hranice, zdroj, t) => Object.assign({ nazev, A, hranice, t }, typeof zdroj === 'string' ? { skladba: zdroj } : { U: zdroj });
    return projektN({
      nazev: 'Vzorový rodinný dům', lokalita: { mesto: 'Praha', te: -12, vyska: 300 },
      skladby: [
        s('st', 'Obvodová stěna – tvárnice 30 + šedý EPS 160', 'stena', [['om_vc', 15], ['ktv30', 300], ['lepidlo', 5], ['eps_g', 160], ['lepidlo', 4], ['om_ten', 2]]),
        s('sp', 'Strop pod půdou – SDK, MW 300 mezi trámy', 'strop_puda', [['sdk', 12.5], ['pe', 0.2], ['mw_kr', 100], ['mw_kr', 200, 'drevo', 10]]),
        s('pd', 'Podlaha na terénu – EPS 150', 'zemina', [['dlazba', 10], ['anhydrit', 50], ['eps150', 120], ['asf', 4], ['bet', 150]])
      ],
      mistnosti: [
        { nazev: 'Obývací pokoj s kuchyní', t: 20, plocha: 32, vyska: 2.7, n: 0.5, prvky: [
          pr('Stěna jih', '8*2.7 - 2*1.5*1.5 - 2.2*2.1', 'venku', 'st'), pr('Stěna západ', '4*2.7', 'venku', 'st'),
          pr('Okna jih', '2*1.5*1.5', 'venku', 0.9), pr('Posuvné dveře na terasu', '2.2*2.1', 'venku', 0.9),
          pr('Podlaha', '32', 'zemina', 'pd'), pr('Strop pod půdou', '32', 'nevytap', 'sp', -5)] },
        { nazev: 'Ložnice', t: 20, plocha: 14, vyska: 2.7, n: 0.5, prvky: [
          pr('Stěna sever', '4*2.7 - 1.2*1.5', 'venku', 'st'), pr('Stěna západ', '3.5*2.7', 'venku', 'st'), pr('Okno', '1.2*1.5', 'venku', 0.9),
          pr('Podlaha', '14', 'zemina', 'pd'), pr('Strop pod půdou', '14', 'nevytap', 'sp', -5)] },
        { nazev: 'Koupelna', t: 24, plocha: 7, vyska: 2.7, n: 0.5, prvky: [
          pr('Stěna sever', '2.8*2.7 - 0.6*0.9', 'venku', 'st'), pr('Okno', '0.6*0.9', 'venku', 0.9),
          pr('Příčka k chodbě', '2.5*2.7', 'mistnost', 1.9, 15), pr('Podlaha', '7', 'zemina', 'pd'), pr('Strop pod půdou', '7', 'nevytap', 'sp', -5)] },
        { nazev: 'Chodba a zádveří', t: 15, plocha: 9, vyska: 2.7, n: 0.5, prvky: [
          pr('Stěna východ', '2.5*2.7 - 1.1*2.1', 'venku', 'st'), pr('Vchodové dveře', '1.1*2.1', 'venku', 1.1),
          pr('Příčka ke koupelně', '2.5*2.7', 'mistnost', 1.9, 24),
          pr('Podlaha', '9', 'zemina', 'pd'), pr('Strop pod půdou', '9', 'nevytap', 'sp', -5)] }
      ]
    });
  }

  /* CSV ztrát (středník, desetinná čárka) */
  function csvZtrat(z) {
    const r = [['Místnost', 'θi [°C]', 'Plocha [m²]', 'Objem [m³]', 'Prostup ΦT [W]', 'Větrání ΦV [W]', 'Celkem Φ [W]', 'W/m²']];
    z.mistnosti.forEach(m => r.push([m.nazev, fmt(m.t, 1), fmt(m.plocha, 1), fmt(m.V, 1), fmt(m.PhiT, 0), fmt(m.PhiV, 0), fmt(m.Phi, 0), fmt(m.Wm2, 1)]));
    r.push(['Budova (bez přenosů mezi místnostmi)', '', fmt(z.budova.plocha, 1), fmt(z.budova.objem, 1), fmt(z.budova.PhiT, 0), fmt(z.budova.PhiV, 0), fmt(z.budova.Phi, 0), fmt(z.budova.Wm2, 1)]);
    return r.map(x => x.map(v => /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v).replace('−', '-')).join(';')).join('\r\n');
  }

  const api = {
    VERZE, KLIC, DELTA0, DNY, MESICE, STAV_DAT, ZDROJE, MATERIALY, TYPY, TYPY_MAPA, VYPLNE, NORMA, NORMA_POZN, RSI, TOKY, OKRAJE, RSI_POVRCH,
    MESTA, KLIMA_REF, GRADIENT, TRIDY, TEPLOTY_MISTNOSTI, HRANICE,
    cislo, fmt, vyraz, novyId, psat, teplotaZTlaku, rse, mapaMaterialu, vrstva, okrajoveOdpory, pozadavky, vypocitejSkladbu,
    fRsi, fRsiPozadovany, phiENavrh, zaokrouhliU, MESTA_ZDROJ, rozhrani, stav, vnitrniTlak, klimaLokality, bilance, limitKondenzace,
    vysledkySkladeb, ztraty, zdroj, projektN, skladbaN, mistnostN, prvekN, vrstvaN, materialN, vzorovyProjekt, csvZtrat
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.TZJ = api;
})();
