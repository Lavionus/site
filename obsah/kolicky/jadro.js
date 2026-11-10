/* Kolíčky na prádlo – jádro bez DOM (běží i v node).
   Parametry a meze, předvolby, boční profil ramen (parametrický nebo ze skicáře), pružiny
   (kovová z dřevěného / plastového kolíčku, tištěné oko, jazýček, V pružina, hadovitá, gumička),
   kloub s čepem, háček / oko / klip na zavěšení, mechanika (síla stisku a prstů podle rozevření),
   pevnost, kontroly zadání, kusovník, projekt JSON.
   Obecné funkce tisku (převisy, odhad hmotnosti a času) bere ze spojky/jadro.js, tělesa skládá kolicky/geometrie.js.

   Souřadnice: x podél kolíčku (0 = špička čelistí, x roste k rukojetím), y = směr rozevření (horní rameno y > 0),
   z = šířka (−W/2 … W/2). Kolíček se staví zavřený (čelisti na sebe dosedají v rovině y = 0);
   čep / opěrný bod leží v (xp, 0). Boční profil se vytáhne do šířky, takže díly leží při tisku na boku bez podpor. */
(function () {
  'use strict';
  const SP = typeof module !== 'undefined' ? require('../spojky/jadro.js') : window.SPOJKY;
  const { kopie, cislo, fmt, vezmi, poloz, V, previsy, potrebujePodpory, odhadTisku } = SP;
  const VERZE_FORMATU = 1;
  const RAD = Math.PI / 180;
  const DATUM_DAT = '11/2026';

  /* ---------- tabulky ---------- */
  const DRUHY = {
    kov_drevo: { nazev: 'Kovová z dřevěného kolíčku', znak: '🪵', kov: true, kloub: false,
      popis: 'Cívka sedí v zářezech uprostřed ramen a je zároveň opěrným bodem; nohy leží v drážkách na vnější straně čelistí a tlačí je k sobě.' },
    kov_plast: { nazev: 'Kovová z plastového kolíčku', znak: '🧷', kov: true, kloub: true, civka: true,
      popis: 'Cívka je navlečená na čepu kloubu, nohy se opírají zevnitř o rukojeti a roztlačují je.' },
    kov_trmen: { nazev: 'Pružina s třmenem (plastový kolíček)', znak: '⫛', kov: true, kloub: false, trmen: true,
      popis: 'Jako běžný plastový kolíček z obchodu: stejný princip jako dřevěný – průchozí cívka v ose mezi rameny je opěrným bodem – jen nohy vedou po bocích: jedna po jednom boku nahoru a přes horní stranu, druhá po druhém boku dolů a přes spodní stranu (třmen v příčném zářezu).' },
    omega: { nazev: 'Tištěné pružné oko (1 díl)', znak: 'Ω', tistena: true, kloub: false, jednodil: true,
      popis: 'Celý kolíček je jeden výtisk: ramena spojuje pružný kroužek, uvnitř se o sebe opírají dva hroty (opěrný bod). Bez montáže.' },
    jazycek: { nazev: 'Tištěný pružný jazýček', znak: '⌒', tistena: true, kloub: true,
      popis: 'Na dolní rukojeti je pružný jazýček, který zevnitř tlačí na horní rukojeť. Dva díly a čep.' },
    listova: { nazev: 'Tištěná V pružina', znak: '<', tistena: true, kloub: true,
      popis: 'Samostatně tištěná pružina tvaru V vložená mezi rukojeti do kapes. Tři díly a čep – pružina jde vyměnit.' },
    meandr: { nazev: 'Tištěná hadovitá pružina', znak: '≷', tistena: true, kloub: true,
      popis: 'Samostatná klikatá (meandrová) pružina mezi rukojeťmi – měkká a s velkým zdvihem.' },
    tlacna: { nazev: 'Tlačná pružina (z propisky / koupená)', znak: '⌇', kloub: true,
      popis: 'Vinutá tlačná pružinka mezi rukojeťmi, konce sedí v jamkách. Z propisky nebo za pár korun ze železářství – silná a skoro nezničitelná.' },
    dratU: { nazev: 'Ohnutý ocelový drát (U sponka)', znak: '∪', kloub: true,
      popis: 'Kus pružinového drátu (struna, drát z kancelářské sponky na slabší kolíček) ohnutý do U; ramínka leží v drážkách mezi rukojeťmi. Jednoduchá, silná a trvanlivá.' },
    pasek: { nazev: 'Pásek pružinové oceli', znak: '▬', kloub: true,
      popis: 'Plochý ocelový pásek (spárová měrka, pásek pružinové oceli) zasunutý do štěrbiny v dolní rukojeti; volný konec tlačí na horní. Pevný a trvanlivý.' },
    tpu: { nazev: 'Pružný váleček z TPU', znak: '●', kloub: true,
      popis: 'Váleček nebo trubička vytištěná z pružného filamentu TPU, stlačená mezi rukojeťmi v jamkách. Bez kovu, nerezaví a únavě odolává dobře.' },
    ocka: { nazev: 'Tištěná očka (prstencová pružina)', znak: '◎', tistena: true, kloub: true,
      popis: 'Jedno až tři pružná očka nad sebou mezi rukojeťmi (kruh, elipsa, kosočtverec, ovál). Ohyb se rozloží po celém obvodu – vydrží hodně stisků.' },
    oblouk: { nazev: 'Tištěný oblouk na konci rukojeti', znak: '⊃', tistena: true, kloub: true,
      popis: 'Rukojeť pokračuje za koncem do oblouku, jeho volné rameno se zevnitř opírá o druhou rukojeť. Dlouhá ohnutá pružina – velký zdvih, malé napětí, tiskne se s ramenem.' },
    gumicka: { nazev: 'Gumička / O‑kroužek', znak: '⭕', kloub: true,
      popis: 'Čelisti stahuje gumička nebo O‑kroužek v drážce. Gumička se snadno vymění; ramena drží kloub s čepem.' },
  };
  // pružiny ze stávajících kolíčků – typické rozměry, před tiskem svou pružinu změřte posuvkou
  const KOVOVE = {
    drevo: { nazev: 'z dřevěného kolíčku 7 cm (typická)', drat: 1.2, prumer: 5.6, zavitu: 3, noha: 22, volnyUhel: 5 },
    drevo_maly: { nazev: 'z malého dřevěného kolíčku 4–5 cm', drat: 0.9, prumer: 4.2, zavitu: 3, noha: 14, volnyUhel: 12 },
    trmen: { nazev: 's třmenem z plastového kolíčku (průchozí cívka)', drat: 1.2, prumer: 5.5, zavitu: 7, noha: 14, volnyUhel: 20 },
    plast: { nazev: 'z plastového kolíčku (typická)', drat: 1.1, prumer: 6.0, zavitu: 3.5, noha: 18, volnyUhel: 42 },
    plast_velky: { nazev: 'z velkého plastového kolíčku / klipu na deku', drat: 1.5, prumer: 8.0, zavitu: 3.5, noha: 26, volnyUhel: 42 },
    vlastni: { nazev: 'vlastní – změřená', drat: null },
  };
  // tlačné pružinky – typické rozměry, svou změřte posuvkou
  const TLACNE = {
    mala: { nazev: 'koupená 0,7 × 6 × 15 mm', drat: 0.7, prumer: 6, delka: 15, zavitu: 7 },
    stredni: { nazev: 'koupená 0,9 × 7 × 20 mm', drat: 0.9, prumer: 7, delka: 20, zavitu: 7 },
    propiska: { nazev: 'z propisky (typická)', drat: 0.45, prumer: 4.2, delka: 24, zavitu: 22 },
    vlastni: { nazev: 'vlastní – změřená', drat: null },
  };
  const TVARY_OCEK = { kruh: 'kruh', elipsa: 'elipsa naležato', kosoctverec: 'kosočtverec', oval: 'ovál (stadion)' };
  const KONCE = { rovny: 'rovný', kulaty: 'kulatý', sikmy: 'sražený' };
  const TVARY = {
    klasicky: { nazev: 'Klasický', znak: '▬', popis: 'rovná vnější strana, čelist zúžená ke špičce (jako dřevěný kolíček)' },
    rovny: { nazev: 'Rovný hranol', znak: '▭', popis: 'stejná tloušťka po celé délce, jen sražená špička' },
    ergo: { nazev: 'Ergonomický', znak: '◡', popis: 'prohlubeň na prst na rukojeti' },
    kapka: { nazev: 'Kapka', znak: '◖', popis: 'zesílený u čepu, oba konce zúžené' },
    stihly: { nazev: 'Štíhlý', znak: '╱', popis: 'rukojeť se ke konci ztenčuje' },
  };
  const PROFILY_CELISTI = {
    rovne: 'rovné', zuby: 'zoubky – zaoblené, zapadají do sebe', vlnky: 'vlnky (měkčí, nepoškodí látku)', drazka: 'pero a drážka (drží i šňůrky)',
    kulate: 'vypouklé – šetrné, svírají v čáře', zobak: 'zobáček – špička přesahuje', kapsa: 'kapsa na gumovou vložku',
  };
  const SDILENA_PLOCHA = ['zuby', 'vlnky', 'drazka'];
  const CEPY = {
    tisteny: { nazev: 'tištěný čep (přiložen v sadě)', pevny: false },
    filament: { nazev: 'kus filamentu 1,75 mm (konce zatavit)', d: 1.75 },
    drat: { nazev: 'drát / hřebík / kolík (vlastní Ø)' },
    sroub: { nazev: 'šroub (do dolního ramene se zařízne)' },
  };
  const HACKY = { hacek: 'háček (J)', oko: 'oko na hřebík / kroužek', klip: 'klip – nacvakne se na tyč' };
  // orientační hodnoty pro FDM tisk (vrstva 0,2 mm, ve směru vrstev), ručně stárnoucí data – DATUM_DAT
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24, E: 3300, mez: 50, cyklus: 15, pozn: 'tuhé, ale pružiny z PLA časem povolí (tečení) a na slunci měknou – na tištěné pružiny nevhodné.' },
    PETG: { nazev: 'PETG', hustota: 1.27, E: 2000, mez: 45, cyklus: 25, pozn: 'houževnaté a venku odolné – dobrá volba na kolíčky i tištěné pružiny.' },
    ASA: { nazev: 'ASA', hustota: 1.07, E: 2000, mez: 40, cyklus: 22, pozn: 'odolné UV a teplu – kolíčky trvale venku.' },
    ABS: { nazev: 'ABS', hustota: 1.04, E: 2100, mez: 40, cyklus: 22, pozn: 'odolné teplu, tiskne se v uzavřené tiskárně.' },
    PA: { nazev: 'PA (nylon)', hustota: 1.14, E: 1400, mez: 45, cyklus: 32, pozn: 'nejlepší na pružné díly – vydrží nejvíc cyklů; nasává vlhkost.' },
    PC: { nazev: 'PC', hustota: 1.2, E: 2300, mez: 60, cyklus: 30, pozn: 'pevné a teplu odolné, náročný tisk.' },
  };
  const E_OCEL = 200000, SIGMA_DRAT = 1700;   // pružinová ocel: modul pružnosti, dovolené ohybové napětí drátu (odhad pro neznámý drát)
  const E_GUMA = 5;                           // NBR 70 Shore A, sečný modul při protažení ~ 30 % (orientačně)
  const G_OCEL = 79300, TAU_DRAT = 650;       // tlačné pružiny: modul ve smyku, dovolené smykové napětí (neznámý drát)
  const SIGMA_OHYB = 1300, SIGMA_PASEK = 1100; // ohnutý drát (ohyb zeslabí), kalený pásek – opakovaný ohyb
  const E_TPU = 26, TPU_STLACENI = 30;        // TPU 95A: modul v tlaku [MPa], trvale snese stlačení ≈ 30 %

  const VYCHOZI = {
    nazev: 'Kolíček',
    pruzina: 'kov_drevo',
    telo: { delka: 72, sirka: 10, tloustka: 6.2, spicka: 3, cep: 31, celist: 14, mezeraCep: 1, rozevreni: 9, tvar: 'klasicky', zaobleni: 0.8, vroubky: true,
      tloustkaDolni: 0, prolis: 0, vypouklost: 0, konec: 'rovny', otvorKonec: 0, odlehceni: false },
    celisti: { profil: 'rovne', pocet: 5, hloubka: 0.8, nabeh: 1.5, nabehVyska: 0, snura2: 0, snuraPoloha2: 0, snura: true, snuraPrumer: 5, snuraPoloha: 0, magnet: 'zadny', magnetPrumer: 8, magnetVyska: 3, magnetPoloha: 0 },
    kov: { predloha: 'drevo', drat: 1.2, prumer: 5.6, zavitu: 3, noha: 22, volnyUhel: 5, vule: 0.2 },
    cep: { druh: 'tisteny', prumer: 3, vule: 0.2, lis: 0.05, stena: 2 },
    omega: { polomer: 6.5, tloustka: 0.9, mezera: 0.4 },
    jazycek: { delka: 28, tloustka: 0.8, predpeti: 1.2, zuzeni: false },
    listova: { delka: 24, tloustka: 1.1, predpeti: 2, zuzeni: false },
    ocka: { tvar: 'elipsa', pocet: 2, sirka: 12, tloustka: 0.9, predpeti: 1.5, poloha: 0.5 },
    oblouk: { rameno: 'dolni', tvar: 'oblouk', posun: 3, polomer: 0, tloustka: 1.2, tloustkaOblouku: 0, sirka: 0, presah: 0, delka: 26, predpeti: 2, zuzeni: false },
    meandr: { zavitu: 3, tloustka: 0.8, sirka: 10, predpeti: 2 },
    gumicka: { prurez: 2, vnitrni: 0, poloha: 8 },
    tlacna: { predloha: 'mala', drat: 0.7, prumer: 6, delka: 15, zavitu: 7, poloha: 0.15, hloubka: 0 },
    dratU: { drat: 1, delka: 24, ohyb: 2, predpeti: 3 },
    pasek: { tloustka: 0.3, sirka: 0, delka: 22, predpeti: 1.5, zasunuti: 8 },
    tpu: { prumer: 4, stena: 0, poloha: 0, predpeti: 0.5, hloubka: 0 },
    hacek: { zapnuty: false, rameno: 'horni', tvar: 'hacek', prumer: 22, delka: 6, tloustka: 4, smer: 'ven', uhel: 0, zahnuti: 30, zatizeni: 1, hloubka: 0, sirka: 0, prechod: 0, zarovnani: 'podlozka', otvor: 0 },
    skica: { zapnuta: false, hladka: true, soumerna: true, horni: [], dolni: [] },
    tisk: { material: 'PETG', vypln: 100, kusu: 1, latka: 1.5 },
  };
  const ROZSAHY = {
    'telo.delka': [30, 160], 'telo.sirka': [4, 30], 'telo.tloustka': [2.5, 20], 'telo.spicka': [0.8, 12], 'telo.cep': [10, 120],
    'telo.celist': [3, 70], 'telo.mezeraCep': [0, 8], 'telo.rozevreni': [0, 40], 'telo.zaobleni': [0, 4],
    'telo.tloustkaDolni': [0, 20], 'telo.prolis': [0, 4], 'telo.vypouklost': [-3, 4], 'telo.otvorKonec': [0, 15], 'celisti.nabeh': [0, 10],
    'tlacna.drat': [0.2, 3], 'tlacna.prumer': [2, 16], 'tlacna.delka': [3, 60], 'tlacna.zavitu': [2, 60], 'tlacna.poloha': [0, 1], 'tlacna.hloubka': [0, 15],
    'dratU.drat': [0.4, 3], 'dratU.delka': [8, 60], 'dratU.ohyb': [0.5, 8], 'dratU.predpeti': [0, 12],
    'pasek.tloustka': [0.1, 1.5], 'pasek.sirka': [0, 30], 'pasek.delka': [6, 60], 'pasek.predpeti': [0, 8], 'pasek.zasunuti': [3, 25],
    'ocka.pocet': [1, 3], 'ocka.sirka': [3, 30], 'ocka.tloustka': [0.4, 3], 'ocka.predpeti': [0, 10], 'ocka.poloha': [0, 1],
    'oblouk.polomer': [0, 30], 'oblouk.posun': [-20, 30], 'oblouk.tloustkaOblouku': [0, 5], 'oblouk.sirka': [0, 30], 'oblouk.presah': [0, 30], 'oblouk.tloustka': [0.5, 4], 'oblouk.delka': [6, 70], 'oblouk.predpeti': [0, 10],
    'celisti.snura2': [0, 20], 'celisti.snuraPoloha2': [0, 120], 'celisti.nabehVyska': [0, 8], 'hacek.sirka': [0, 30], 'hacek.otvor': [0, 60], 'hacek.prechod': [0, 40],
    'tpu.prumer': [2, 20], 'tpu.stena': [0, 6], 'tpu.poloha': [0, 1], 'tpu.predpeti': [0, 6], 'tpu.hloubka': [0, 15], 'hacek.hloubka': [0, 60],
    'celisti.pocet': [1, 30], 'celisti.hloubka': [0.2, 3], 'celisti.snuraPrumer': [1, 20], 'celisti.snuraPoloha': [0, 120],
    'celisti.magnetPrumer': [2, 25], 'celisti.magnetVyska': [0.5, 10], 'celisti.magnetPoloha': [0, 160],
    'kov.drat': [0.4, 3], 'kov.prumer': [2, 20], 'kov.zavitu': [0.5, 12], 'kov.noha': [4, 80], 'kov.volnyUhel': [-90, 180], 'kov.vule': [0, 1],
    'cep.prumer': [1, 8], 'cep.vule': [0, 0.6], 'cep.lis': [-0.3, 0.3], 'cep.stena': [1, 6],
    'omega.polomer': [2.5, 15], 'omega.tloustka': [0.4, 3], 'omega.mezera': [0.15, 2],
    'jazycek.delka': [6, 60], 'jazycek.tloustka': [0.6, 4], 'jazycek.predpeti': [0, 10],
    'listova.delka': [6, 60], 'listova.tloustka': [0.6, 4], 'listova.predpeti': [0, 12],
    'meandr.zavitu': [2, 12], 'meandr.tloustka': [0.5, 3], 'meandr.sirka': [4, 30], 'meandr.predpeti': [0, 12],
    'gumicka.prurez': [0.8, 5], 'gumicka.vnitrni': [0, 60], 'gumicka.poloha': [1, 60],
    'hacek.prumer': [2, 80], 'hacek.delka': [0, 80], 'hacek.tloustka': [1.5, 15], 'hacek.uhel': [-60, 60], 'hacek.zahnuti': [0, 120], 'hacek.zatizeni': [0, 50],
    'tisk.vypln': [10, 100], 'tisk.kusu': [1, 40], 'tisk.latka': [0.1, 15],
  };

  const PREDVOLBY = [
    { nazev: 'Klasický – pružina z dřevěného kolíčku', popis: 'recyklace: ze starého dřevěného kolíčku přendáte pružinu', p: {} },
    { nazev: 'S háčkem na tyč', popis: 'dřevěná pružina, horní rameno prodloužené do háčku Ø 22 mm',
      p: { telo: { delka: 72 }, hacek: { zapnuty: true, rameno: 'horni', tvar: 'hacek', prumer: 22, delka: 6, tloustka: 4.5 } } },
    { nazev: 'Plastový styl – pružina z plastového kolíčku', popis: 'kloub s čepem, cívka na čepu, zoubkované čelisti',
      p: { pruzina: 'kov_plast', kov: { predloha: 'plast' }, telo: { delka: 70, sirka: 11, tloustka: 6, cep: 30, celist: 16, rozevreni: 10, tvar: 'ergo' },
        celisti: { profil: 'zuby', pocet: 6, hloubka: 0.8, snura: true } } },
    { nazev: 'Jednodílný s pružným okem', popis: 'tisk bez montáže – PETG nebo nylon',
      p: { pruzina: 'omega', omega: { polomer: 6.5, tloustka: 0.8 }, telo: { delka: 74, sirka: 10, tloustka: 6, cep: 33, celist: 14, rozevreni: 5.5, tvar: 'kapka' }, celisti: { profil: 'vlnky', snura: false } } },
    { nazev: 'Pružný jazýček', popis: 'dva tištěné díly a čep z filamentu',
      p: { pruzina: 'jazycek', cep: { druh: 'filament' }, telo: { tloustka: 6.5, rozevreni: 9, tvar: 'ergo' }, celisti: { profil: 'zuby' } } },
    { nazev: 'Vložená V pružina', popis: 'vyměnitelná tištěná pružina, čep z hřebíku Ø 2,5',
      p: { pruzina: 'listova', cep: { druh: 'drat', prumer: 2.5 }, telo: { rozevreni: 12, tloustka: 6.5 } } },
    { nazev: 'Hadovitá pružina', popis: 'měkký stisk, velký zdvih',
      p: { pruzina: 'meandr', telo: { delka: 84, rozevreni: 16, tloustka: 6.5, cep: 33 }, meandr: { zavitu: 5, sirka: 14, tloustka: 0.7, predpeti: 1.5 } } },
    { nazev: 'Plastový kolíček s třmenem', popis: 'jako z obchodu: průchozí cívka, nohy po bocích přes horní a spodní stranu, dva otvory na šňůru, klínové špičky',
      p: { pruzina: 'kov_trmen', kov: { predloha: 'trmen' }, telo: { delka: 73, sirka: 11, tloustka: 7.5, spicka: 3.5, cep: 40, celist: 12, mezeraCep: 1, rozevreni: 8, tvar: 'stihly', vroubky: false },
        celisti: { profil: 'rovne', snura: true, snuraPrumer: 6, snuraPoloha: 15, snura2: 3.2, snuraPoloha2: 23.5, nabeh: 2.5, nabehVyska: 1.6 } } },
    { nazev: 'Tištěná očka', popis: 'tři pružné elipsy nad sebou mezi rukojeťmi – bez kovu',
      p: { pruzina: 'ocka', ocka: { tvar: 'elipsa', tloustka: 0.5, sirka: 18, pocet: 3, predpeti: 0.5 }, telo: { delka: 78, tloustka: 6.5, rozevreni: 14 } } },
    { nazev: 'Oblouk na konci rukojeti', popis: 'dolní rukojeť se za koncem stočí do oblouku a tlačí na horní',
      p: { pruzina: 'oblouk', oblouk: { tloustka: 1.9, delka: 20, predpeti: 0.5 }, telo: { delka: 74, tloustka: 6.5, rozevreni: 12, vroubky: false } } },
    { nazev: 'Smyčka na konci rukojeti', popis: 'velká smyčka za koncem dolní rukojeti, přetáhne se pod horní – dlouhá pružina, malé napětí',
      p: { pruzina: 'oblouk', oblouk: { tvar: 'smycka', polomer: 7, presah: 16, posun: 4, tloustka: 2.2, tloustkaOblouku: 2.5, delka: 12, predpeti: 1.5 }, telo: { delka: 74, tloustka: 6.5, rozevreni: 12, vroubky: false } } },
    { nazev: 'Zúžený jazýček', popis: 'nosník stálé pevnosti – vydrží víc stisků než rovný',
      p: { pruzina: 'jazycek', jazycek: { zuzeni: true, tloustka: 1.8, delka: 34, predpeti: 2.5 }, cep: { druh: 'filament' }, telo: { tloustka: 6.5, rozevreni: 10, tvar: 'ergo' } } },
    { nazev: 'Tlačná pružinka', popis: 'koupená pružinka 0,7 × 6 × 15 mm mezi rukojeťmi – silná a trvanlivá',
      p: { pruzina: 'tlacna', tlacna: { poloha: 0.15 }, telo: { delka: 76, tloustka: 7, rozevreni: 12, cep: 32 } } },
    { nazev: 'Ocelová U sponka', popis: 'pružinový drát Ø 1,4 ohnutý do U, leží v drážkách',
      p: { pruzina: 'dratU', dratU: { drat: 1.4, delka: 40, predpeti: 1, ohyb: 1.5 }, cep: { prumer: 2.5 }, telo: { delka: 82, tloustka: 7, rozevreni: 14 } } },
    { nazev: 'Pásek pružinové oceli', popis: 'spárová měrka / pásek 0,8 mm zasunutý do dolní rukojeti',
      p: { pruzina: 'pasek', pasek: { tloustka: 0.8, delka: 24, predpeti: 1 }, telo: { delka: 76, tloustka: 7, rozevreni: 11 } } },
    { nazev: 'Váleček z TPU', popis: 'bez kovu – pružina z pružného filamentu',
      p: { pruzina: 'tpu', tpu: { prumer: 5, stena: 1, predpeti: 1.4 }, cep: { prumer: 2.5 }, telo: { tloustka: 7.5, rozevreni: 10 } } },
    { nazev: 'Gumička / O‑kroužek', popis: 'stahuje čelisti, nejjednodušší výměna',
      p: { pruzina: 'gumicka', cep: { druh: 'drat', prumer: 2.5, stena: 1.8 }, telo: { tloustka: 7.5, rozevreni: 10 }, gumicka: { prurez: 2, poloha: 8 } } },
    { nazev: 'Magnetický klip na lednici', popis: 'kapsa na magnet Ø 8 × 3 v dolním rameni, široké rovné čelisti',
      p: { pruzina: 'kov_plast', kov: { predloha: 'plast' }, telo: { delka: 64, sirka: 16, tloustka: 6.5, cep: 30, celist: 18, tvar: 'rovny' },
        celisti: { profil: 'vlnky', snura: false, magnet: 'dolni', magnetPrumer: 8, magnetVyska: 3 } } },
    { nazev: 'Velký kolíček na deku', popis: '100 mm, pružina z velkého plastového klipu',
      p: { pruzina: 'kov_plast', kov: { predloha: 'plast_velky' }, cep: { prumer: 4 },
        telo: { delka: 100, sirka: 14, tloustka: 8.5, spicka: 4, cep: 44, celist: 22, rozevreni: 14, tvar: 'ergo' },
        celisti: { profil: 'zuby', pocet: 7, hloubka: 1, snura: true, snuraPrumer: 7 } } },
    { nazev: 'Malý kolíček 45 mm', popis: 'na fotky a dekorace, pružina z malého dřevěného kolíčku',
      p: { kov: { predloha: 'drevo_maly' }, telo: { delka: 45, sirka: 7, tloustka: 4.4, spicka: 2.4, cep: 20, celist: 8, rozevreni: 6, mezeraCep: 0.8, zaobleni: 0.6 },
        celisti: { snura: false } } },
    { nazev: 'Odlehčený s kulatým koncem', popis: 'odlehčené rukojeti, otvor Ø 4 na konci, zoubky s náběhem',
      p: { telo: { delka: 76, tloustka: 7, rozevreni: 7.5, konec: 'kulaty', otvorKonec: 4, odlehceni: true, vroubky: false }, celisti: { profil: 'zuby', hloubka: 0.5 } } },
    { nazev: 'Šetrný se zobáčkem', popis: 'zobáček přes špičku, vypouklé rukojeti – na jemné prádlo',
      p: { telo: { vypouklost: 1, prolis: 1 }, celisti: { profil: 'zobak', hloubka: 1.2, snura: false } } },
    { nazev: 'S okem na hřebík', popis: 'spodní rameno zakončené okem Ø 6 mm',
      p: { hacek: { zapnuty: true, rameno: 'dolni', tvar: 'oko', prumer: 6, delka: 2, tloustka: 3.5 } } },
  ];

  /* ---------- drobnosti ---------- */
  const jeObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  // slučuje jen typově shodné hodnoty (poškozený projekt nesmí přepsat sekci číslem nebo null)
  const sl = (o, z) => {
    for (const k of Object.keys(z)) {
      const a = o[k], b = z[k];
      if (jeObj(a)) { if (jeObj(b)) sl(a, b); }
      else if (a == null || Array.isArray(a) ? b == null || Array.isArray(b) || a == null : typeof b !== 'object' || b === null) o[k] = b;
    }
    return o;
  };
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));
  const hladce = u => { u = omez(u, 0, 1); return u * u * (3 - 2 * u); };
  const jeBod = b => Array.isArray(b) && b.length >= 2 && Number.isFinite(+b[0]) && Number.isFinite(+b[1]);
  const cistiBody = a => (Array.isArray(a) ? a.filter(jeBod).slice(0, 400).map(b => (b[2] ? [+b[0], +b[1], 1] : [+b[0], +b[1]])) : []);

  /** Doplní chybějící hodnoty, omezí rozsahy. Vrací {p, hlaseni: [texty o úpravách]}. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hl = [];
    if (vstup && typeof vstup === 'object') sl(p, kopie(vstup));
    if (!DRUHY[p.pruzina]) p.pruzina = VYCHOZI.pruzina;
    if (!TVARY[p.telo.tvar]) p.telo.tvar = 'klasicky';
    if (!PROFILY_CELISTI[p.celisti.profil]) p.celisti.profil = 'rovne';
    if (!['zadny', 'horni', 'dolni'].includes(p.celisti.magnet)) p.celisti.magnet = 'zadny';
    if (!KOVOVE[p.kov.predloha]) p.kov.predloha = 'vlastni';
    if (!TLACNE[p.tlacna.predloha]) p.tlacna.predloha = 'vlastni';
    if (!KONCE[p.telo.konec]) p.telo.konec = 'rovny';
    if (!TVARY_OCEK[p.ocka.tvar]) p.ocka.tvar = 'elipsa';
    p.jazycek.zuzeni = !!p.jazycek.zuzeni; p.listova.zuzeni = !!p.listova.zuzeni; p.oblouk.zuzeni = !!p.oblouk.zuzeni;
    if (!['dolni', 'horni'].includes(p.oblouk.rameno)) p.oblouk.rameno = 'dolni';
    if (!['oblouk', 'smycka'].includes(p.oblouk.tvar)) p.oblouk.tvar = 'oblouk';
    if (!CEPY[p.cep.druh]) p.cep.druh = 'tisteny';
    if (!HACKY[p.hacek.tvar]) p.hacek.tvar = 'hacek';
    if (!['horni', 'dolni'].includes(p.hacek.rameno)) p.hacek.rameno = 'horni';
    if (!['ven', 'dovnitr'].includes(p.hacek.smer)) p.hacek.smer = 'ven';
    if (!['podlozka', 'stred'].includes(p.hacek.zarovnani)) p.hacek.zarovnani = 'podlozka';
    if (!MATERIALY[p.tisk.material]) p.tisk.material = 'PETG';
    p.nazev = String(p.nazev == null ? '' : p.nazev).slice(0, 120);
    for (const k of ['vroubky', 'odlehceni']) p.telo[k] = !!p.telo[k];
    p.celisti.snura = !!p.celisti.snura; p.hacek.zapnuty = !!p.hacek.zapnuty;
    p.skica = { zapnuta: !!p.skica.zapnuta, hladka: p.skica.hladka !== false, soumerna: p.skica.soumerna !== false,
      horni: cistiBody(p.skica.horni), dolni: cistiBody(p.skica.dolni) };
    // vybraná předloha pružiny přepíše rozměry (ruční rozměry přepíná na „vlastní“ UI a nactiProjekt)
    const kv = KOVOVE[p.kov.predloha];
    if (kv && kv.drat) for (const k of ['drat', 'prumer', 'zavitu', 'noha', 'volnyUhel']) p.kov[k] = kv[k];
    const tv = TLACNE[p.tlacna.predloha];
    if (tv && tv.drat) for (const k of ['drat', 'prumer', 'delka', 'zavitu']) p.tlacna[k] = tv[k];
    for (const [c, [mn, mx]] of Object.entries(ROZSAHY)) {
      let h = cislo(vezmi(p, c), vezmi(VYCHOZI, c));
      if (h < mn || h > mx) { const o = Math.min(mx, Math.max(mn, h)); hl.push(`${c} ${fmt(h, 2)} → ${fmt(o, 2)}`); h = o; }
      poloz(p, c, h);
    }
    if (p.telo.cep > p.telo.delka - 8) { const c = Math.max(ROZSAHY['telo.cep'][0], p.telo.delka - 8); hl.push(`telo.cep ${fmt(p.telo.cep, 2)} → ${fmt(c, 2)}`); p.telo.cep = c; }
    p.celisti.pocet = Math.round(p.celisti.pocet); p.meandr.zavitu = Math.round(p.meandr.zavitu); p.ocka.pocet = Math.round(p.ocka.pocet); p.tisk.kusu = Math.round(p.tisk.kusu);
    return { p, hlaseni: hl };
  }
  function zPredvolby(i) {
    const v = PREDVOLBY[i] || PREDVOLBY[0], p = normalizuj({}).p;
    sl(p, kopie(v.p));
    p.nazev = v.nazev.split(' – ')[0];
    return normalizuj(p).p;
  }

  /* ---------- 2D geometrie (mnohoúhelníky [[x, y], …]) ---------- */
  function plocha2(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  const ccw = P => (plocha2(P) < 0 ? P.slice().reverse() : P);
  const zrcadliY = P => ccw(P.map(b => [b[0], -b[1]]));
  /** y všech průsečíků svislé přímky x s obrysem (seřazené). */
  function prusecikyX(P, x) {
    const ys = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) ys.push(a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]));
    }
    return ys.sort((u, v) => u - v);
  }
  function uvnitr2(P, x, y) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function vzdalUsecka(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? omez(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
  }
  function vzdalObrys(P, x, y) { let d = Infinity; for (let i = 0; i < P.length; i++) d = Math.min(d, vzdalUsecka(x, y, P[i], P[(i + 1) % P.length])); return d; }
  /** Kříží se obrys sám se sebou? */
  function krizi(P) {
    const n = P.length;
    const sek = (a, b, c, d) => {
      const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
      return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && Math.abs(d1) > 1e-12 && Math.abs(d2) > 1e-12;
    };
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (sek(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return true;
    }
    return false;
  }
  const rotace = (b, c, a) => { const s = Math.sin(a), k = Math.cos(a), x = b[0] - c[0], y = b[1] - c[1]; return [c[0] + k * x - s * y, c[1] + s * x + k * y]; };

  /** Uzavřená Catmull‑Romova křivka přes body skici; bod s příznakem [x, y, 1] je ostrý roh. */
  function hladkyObrys(body, hladka, kroku = 8) {
    const n = body.length;
    if (!hladka || n < 3) return body.map(b => [b[0], b[1]]);
    const out = [];
    for (let i = 0; i < n; i++) {
      const p1 = body[i], p2 = body[(i + 1) % n];
      let p0 = body[(i - 1 + n) % n], p3 = body[(i + 2) % n];
      if (p1[2]) p0 = [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
      if (p2[2]) p3 = [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
      for (let k = 0; k < kroku; k++) {
        const t = k / kroku, t2 = t * t, t3 = t2 * t;
        const f = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
        out.push([f(0), f(1)]);
      }
    }
    return out;
  }
  /** Ramer–Douglas–Peucker pro otevřenou lomenou čáru. */
  function zjednodus(P, tol) {
    if (P.length < 3) return P.slice();
    let m = 0, im = 0;
    for (let i = 1; i < P.length - 1; i++) { const d = vzdalUsecka(P[i][0], P[i][1], P[0], P[P.length - 1]); if (d > m) { m = d; im = i; } }
    if (m <= tol) return [P[0], P[P.length - 1]];
    return zjednodus(P.slice(0, im + 1), tol).slice(0, -1).concat(zjednodus(P.slice(im), tol));
  }
  /** Parametrický obrys → body skici (zjednodušené, rohy ostré). */
  function obrysNaSkicu(P, tol = 0.12) {
    let i0 = 0, i1 = 0;
    P.forEach((b, i) => { if (b[0] < P[i0][0] || (b[0] === P[i0][0] && b[1] > P[i0][1])) i0 = i; if (b[0] > P[i1][0]) i1 = i; });
    const cyk = (a, b) => { const o = []; for (let i = a; ; i = (i + 1) % P.length) { o.push(P[i]); if (i === b) break; } return o; };
    const A = zjednodus(cyk(i0, i1), tol), B = zjednodus(cyk(i1, i0), tol);
    const body = A.concat(B.slice(1, -1));
    // ostré rohy: ohyb přes 40°
    return body.map((b, i) => {
      const a = body[(i - 1 + body.length) % body.length], c = body[(i + 1) % body.length];
      const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
      const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1);
      const r = [Math.round(b[0] * 100) / 100, Math.round(b[1] * 100) / 100];
      return cos < Math.cos(40 * RAD) ? r.concat(1) : r;
    });
  }

  /* ---------- parametrický profil ramene ---------- */
  /** Tloušťka ramene (od vnitřní plochy ven) v místě x. */
  function tloustkaV(t, x, L, xp, boule, bSirka) {
    L = Math.max(L, xp + 1);
    const T = t.tloustka, Ts = Math.min(t.spicka, T), Lc = Math.max(3, t.celist);
    let h;
    switch (t.tvar) {
      case 'rovny': h = Ts + (T - Ts) * hladce(x / Math.min(4, Lc)); break;
      case 'ergo': {
        h = Ts + (T - Ts) * hladce(x / (0.9 * Lc));
        const a = xp + 0.22 * (L - xp), b = L - Math.min(7, 0.2 * (L - xp));
        if (x > a && x < b) h -= (t.prolis > 0 ? t.prolis : Math.min(1.5, 0.22 * T)) * Math.sin(Math.PI * (x - a) / (b - a)) ** 2;
        break;
      }
      case 'kapka': {
        const Tm = T * 1.15;
        h = x < xp ? Ts + (Tm - Ts) * hladce(x / xp) : Tm - (Tm - 0.78 * T) * hladce((x - xp) / (L - xp));
        break;
      }
      case 'stihly': h = x < xp ? Ts + (T - Ts) * hladce(x / (0.95 * xp)) : T - 0.25 * T * hladce((x - xp) / (L - xp)); break;
      default: h = Ts + (T - Ts) * hladce(x / (0.9 * Lc));
    }
    if (t.tvar !== 'ergo' && t.prolis > 0) {
      const a = xp + 0.22 * (L - xp), b = L - Math.min(7, 0.2 * (L - xp));
      if (x > a && x < b) h -= t.prolis * Math.sin(Math.PI * (x - a) / (b - a)) ** 2;
    }
    if (t.vypouklost && x > xp) h += t.vypouklost * Math.sin(Math.PI * (x - xp) / (L - xp));
    if (boule > 0 && Math.abs(x - xp) < bSirka) h += boule * 0.5 * (1 + Math.cos(Math.PI * (x - xp) / bSirka));
    return Math.max(0.6, h);
  }
  /** Vnitřní plocha horního ramene (vzdálenost od roviny y = 0). */
  function vnitrniV(t, x, L, xp, Lc) {
    if (x <= Lc) return 0;
    if (x < xp) return t.mezeraCep / 2 * hladce((x - Lc) / (xp - Lc));
    return t.mezeraCep / 2 + (t.rozevreni / 2 - t.mezeraCep / 2) * (x - xp) / Math.max(1, L - xp);
  }
  function parametrickyObrys(t, boule, bSirka) {
    const L = t.delka, xp = t.cep, Lc = Math.min(t.celist, xp - 1), n = Math.max(40, Math.ceil(L / 0.5));
    const horni = [], dolni = [];
    for (let i = 0; i <= n; i++) {
      const x = L * i / n, yi = vnitrniV(t, x, L, xp, Lc);
      horni.push([x, yi + tloustkaV(t, x, L, xp, boule, bSirka)]);
      dolni.push([x, yi]);
    }
    // tvar konce rukojeti
    const tK = horni[n][1] - dolni[n][1];
    if (t.konec === 'kulaty') {
      const r = tK / 2, cy = (horni[n][1] + dolni[n][1]) / 2;
      for (let i = 0; i <= n; i++) {
        const dx = horni[i][0] - (L - r); if (dx <= 0) continue;
        const v = Math.sqrt(Math.max(0.0025, r * r - dx * dx));
        horni[i][1] = Math.min(horni[i][1], cy + v); dolni[i][1] = Math.max(dolni[i][1], cy - v);
      }
    } else if (t.konec === 'sikmy') {
      const c = 0.6 * tK, y0 = horni[n][1];
      for (let i = 0; i <= n; i++) { const dx = horni[i][0] - (L - c); if (dx > 0) horni[i][1] = Math.min(horni[i][1], y0 - dx); }
    }
    return ccw(horni.concat(dolni.reverse()));
  }

  /* ---------- odvozené rozměry ---------- */
  function odvozene(p) {
    const t = p.telo, dr = DRUHY[p.pruzina], mat = MATERIALY[p.tisk.material];
    const o = { druh: p.pruzina, dr, W: t.sirka, xp: t.cep, Lc: Math.min(t.celist, t.cep - 1), mat, chybySkici: [] };
    // ---- kloub / zářez – co se kolem osy vyřízne z ramen
    let rRez = 0;
    if (dr.kov) {
      const k = p.kov;
      o.drat = { d: k.drat, D: k.prumer, Dm: k.prumer - k.drat, Di: k.prumer - 2 * k.drat, n: k.zavitu, noha: k.noha, delka: (k.zavitu + 1) * k.drat };
    }
    if (dr.kloub) {
      const c = p.cep, d = c.druh === 'filament' ? 1.75 : c.prumer;
      const rDiraU = d / 2 + c.vule, rk = rDiraU + c.stena;
      o.kloub = { d, rDiraU, rDiraL: c.druh === 'sroub' ? 0.42 * d : d / 2 + (c.druh === 'filament' ? c.vule : -c.lis), rk, rKc: rk + 0.35,
        pin: c.druh === 'tisteny' ? { d: d - 0.05, delka: t.sirka } : null };
      if (dr.civka) {
        o.kloub.rCivka = o.drat.D / 2 + 0.5;
        const g = o.drat.delka + 0.8;
        o.kloub.zony = { U: [-t.sirka / 2, -g / 2], C: [-g / 2, g / 2], L: [g / 2, t.sirka / 2] };
      } else o.kloub.zony = { U: [-t.sirka / 2, 0], L: [0, t.sirka / 2] };
      rRez = Math.max(o.kloub.rKc, o.kloub.rCivka || 0);
    } else if (p.pruzina === 'kov_drevo' || dr.trmen) {
      // průchozí cívka v zářezu přes celou šířku (polovina v každém rameni) – je opěrným bodem
      o.zarez = { r: o.drat.D / 2 + p.kov.vule };
      rRez = o.zarez.r;
    } else if (p.pruzina === 'omega') {
      const q = p.omega;
      o.oko = { R: q.polomer, t: q.tloustka, mezera: q.mezera, rRez: q.polomer + q.tloustka / 2 + q.mezera, spice: Math.max(1.6, 1.8 * q.tloustka), hrot: Math.min(1.2, (q.polomer - q.tloustka / 2) * 0.35) };
      rRez = o.oko.rRez;
    }
    o.rRez = rRez;
    o.posun = p.pruzina === 'omega' ? p.omega.mezera / 2 : 0;

    // ---- obrysy ramen
    const bSirka = rRez + 5;
    const boule = tt => {
      const potreba = rRez > 0 ? rRez + Math.max(2.5, 0.4 * tt.tloustka) - tt.mezeraCep / 2 : 0;
      return Math.max(0, potreba - tloustkaV(tt, tt.cep, tt.delka, tt.cep, 0, 1));
    };
    o.boule = boule(t);
    o.parametricky = parametrickyObrys(t, o.boule, bSirka);
    let horni = o.parametricky, dolni = zrcadliY(o.parametricky);
    if (t.tloustkaDolni > 0) {
      const td = Object.assign({}, t, { tloustka: t.tloustkaDolni, spicka: Math.min(t.spicka, t.tloustkaDolni) });
      o.parametrickyDolni = zrcadliY(parametrickyObrys(td, boule(td), bSirka));
      dolni = o.parametrickyDolni;
    }
    o.zeSkici = false;
    if (p.skica.zapnuta) {
      const sk = p.skica, H = hladkyObrys(sk.horni, sk.hladka);
      const D = sk.soumerna ? null : hladkyObrys(sk.dolni, sk.hladka);
      const vadny = P => !P || P.length < 3 ? 'má méně než 3 body' : krizi(P) ? 'obrys se kříží sám se sebou' : Math.abs(plocha2(P)) < 4 ? 'má skoro nulovou plochu' : null;
      const vh = vadny(H), vd = sk.soumerna ? null : vadny(D);
      if (vh) o.chybySkici.push(`Skica horního ramene ${vh} – použit parametrický tvar.`);
      if (vd) o.chybySkici.push(`Skica dolního ramene ${vd} – použit zrcadlený horní.`);
      if (!vh) { horni = ccw(H); dolni = zrcadliY(horni); o.zeSkici = true; }
      if (!vh && !sk.soumerna && !vd) dolni = ccw(D);
    }
    if (o.posun) { horni = horni.map(b => [b[0], b[1] + o.posun]); dolni = dolni.map(b => [b[0], b[1] - o.posun]); }
    o.obrys = { horni, dolni };
    const mez = P => P.reduce((a, b) => [Math.min(a[0], b[0]), Math.max(a[1], b[0]), Math.min(a[2], b[1]), Math.max(a[3], b[1])], [Infinity, -Infinity, Infinity, -Infinity]);
    o.mez = { horni: mez(horni), dolni: mez(dolni) };
    o.L = Math.max(o.mez.horni[1], o.mez.dolni[1]);
    o.x0 = Math.min(o.mez.horni[0], o.mez.dolni[0]);
    // plochy ramen: s = +1 horní, −1 dolní; vnitřní = blíž rovině y = 0, vnější = dál
    o.plochy = (s, x) => {
      const ys = prusecikyX(s > 0 ? horni : dolni, x);
      if (!ys.length) return null;
      return s > 0 ? { vni: ys[0], vne: ys[ys.length - 1] } : { vni: ys[ys.length - 1], vne: ys[0] };
    };
    const vni = (s, x) => { const q = o.plochy(s, x); return q ? Math.abs(q.vni) : null; };
    const vne = (s, x) => { const q = o.plochy(s, x); return q ? Math.abs(q.vne) : null; };
    o.vni = vni; o.vne = vne;
    o.konec = { horni: o.mez.horni[1], dolni: o.mez.dolni[1] };
    // zaoblení hran nesmí být větší než polovina nejtenčího místa – jinak by zaoblení tenkou špičku úplně umazalo
    let tmin = Infinity;
    for (const sg of [1, -1]) for (let x = o.mez[sg > 0 ? 'horni' : 'dolni'][0] + 0.3; x < o.konec[sg > 0 ? 'horni' : 'dolni'] - 0.3; x += 0.25) {
      const q = o.plochy(sg, x); if (q) tmin = Math.min(tmin, Math.abs(q.vne - q.vni));
    }
    o.zaobleni = Math.min(t.zaobleni, Math.max(0, 0.42 * tmin - 0.02));
    // použitelná délka rukojeti: bez zaobleného / sraženého konce (vnitřní plocha tam prudce stoupá)
    const kon = Math.min(o.konec.horni, o.konec.dolni), qk = o.plochy(1, kon - 6), tK = qk ? Math.abs(qk.vne - qk.vni) : t.tloustka;
    o.rukojetDo = kon - (o.zeSkici ? 0 : t.konec === 'kulaty' ? 0.55 * tK : t.konec === 'sikmy' ? 0.3 * tK : 0);
    o.xc = Math.max(1, o.Lc / 2);                                     // střed sevření
    o.xh = o.L - Math.min(9, (o.L - o.xp) / 3);                       // kam se tlačí prsty

    // ---- šňůra, zoubky, magnet
    const c = p.celisti;
    if (c.snura) {
      const r = c.snuraPrumer / 2, auto = (o.Lc + (o.xp - rRez)) / 2;
      o.snura = { r, x: c.snuraPoloha > 0 ? c.snuraPoloha : Math.max(o.Lc + r * 0.3, auto) };
      if (c.snura2 > 0) {
        const r2 = c.snura2 / 2, a2 = (o.snura.x + o.snura.r + (o.xp - rRez)) / 2;
        o.snura2 = { r: r2, x: c.snuraPoloha2 > 0 ? c.snuraPoloha2 : a2 };
      }
    }
    // náběh u špičky: klín, který čelisti u špičky rozevře – látka vjede bez zadrhnutí
    const tlSpicky = Math.min(...[1, -1].map(sg => { const q = o.plochy(sg, Math.max(0.3, Math.min(c.nabeh, o.Lc) / 2)); return q ? Math.abs(q.vne - q.vni) : 1; }));
    if (c.nabeh > 0.2) o.nabeh = { delka: Math.min(c.nabeh, o.Lc * 0.6), h: c.nabehVyska > 0 ? Math.min(c.nabehVyska, 0.75 * tlSpicky) : Math.min(0.4 * tlSpicky, 0.3 * c.nabeh + 0.15) };
    if (c.profil !== 'rovne') {
      const od = Math.max(0.5, o.nabeh ? o.nabeh.delka * 0.8 : 0.5);
      const do_ = o.Lc - (o.snura && o.snura.x - o.snura.r < o.Lc ? Math.max(0, o.Lc - (o.snura.x - o.snura.r)) : 0);
      o.celist = { typ: c.profil, od, do: Math.max(od + 1, do_), pocet: c.pocet, h: c.hloubka, sdilena: SDILENA_PLOCHA.includes(c.profil) };
      if (c.profil === 'zuby') {
        // zaoblené zuby: boky nejvýš 45° (výška ≤ 0,23 rozteče), jinak by látka zachytávala o hrany
        const rozt = (o.celist.do - o.celist.od) / c.pocet;
        o.celist.h = Math.min(c.hloubka, 0.23 * rozt);
        o.celist.zmirneno = o.celist.h < c.hloubka - 1e-9;
      }
    }
    if (c.magnet !== 'zadny') {
      const s = c.magnet === 'horni' ? 1 : -1;
      const x = c.magnetPoloha > 0 ? c.magnetPoloha : (o.xp + o.L) / 2;
      o.magnet = { s, x, r: c.magnetPrumer / 2 + 0.1, h: c.magnetVyska + 0.2 };
    }
    if (t.otvorKonec > 0) {
      const r = t.otvorKonec / 2;
      o.otvor = [1, -1].filter(sg => !(p.pruzina === 'oblouk' && sg === (p.oblouk.rameno === 'horni' ? 1 : -1))).map(sg => {
        const x = o.konec[sg > 0 ? 'horni' : 'dolni'] - r - Math.max(1.8, 0.3 * r) - (t.konec === 'kulaty' ? 0.6 : 0), q = o.plochy(sg, x);
        return q ? { s: sg, x, y: (q.vni + q.vne) / 2, r, stena: (Math.abs(q.vne - q.vni) - 2 * r) / 2 } : { s: sg, chybi: true };
      });
    }
    if (p.telo.vroubky) {
      const a = o.xp + Math.max(rRez + 3, 0.3 * (o.L - o.xp)), b = o.L - 3, n = Math.max(0, Math.floor((b - a) / 2.2));
      o.vroubky = { x: Array.from({ length: n }, (_, i) => a + (i + 0.5) * (b - a) / n), r: 0.55 };
    }

    // ---- pružina
    // ---- háček (před pružinou – oblouk se mu vyhýbá)
    if (p.hacek.zapnuty) hacek(p, o);
    pruzina(p, o);
    // ---- odlehčení rukojetí (otvory skrz šířku tam, kde nic jiného není)
    if (t.odlehceni) odlehceni(p, o);
    // ---- mechanika
    o.mech = mechanika(p, o);
    o.dily = seznamDilu(p, o);
    return o;
  }

  /** Bod vnější plochy, kde je od středu (xp, 0) vzdálenost noha (hledá se od čepu ke špičce / k rukojeti). */
  function dosahNohy(o, s, noha, smer, plocha) {
    const krok = 0.25;
    for (let x = o.xp; smer < 0 ? x > o.x0 : x < o.konec[s > 0 ? 'horni' : 'dolni']; x += smer * krok) {
      const y = plocha(s, x);
      if (y == null) continue;
      if (Math.hypot(x - o.xp, y) >= noha) return { x, y };
    }
    return null;
  }

  /** Konzola libovolného tvaru (osa od volného konce ke vetknutí, body [x, y, t]), svislá síla na konci:
      poddajnost c [mm/N] a napětí na 1 N s [MPa/N] (Castigliano: δ = ∫ M² / (E I F) ds, M = F · vodorovná vzdálenost). */
  function konzola(osa, b, E) {
    const xt = osa[0][0]; let c = 0, smax = 0;
    for (let i = 0; i + 1 < osa.length; i++) {
      const a = osa[i], q = osa[i + 1], ds = Math.hypot(q[0] - a[0], q[1] - a[1]), t = (a[2] + q[2]) / 2, x = Math.abs((a[0] + q[0]) / 2 - xt);
      c += x * x * ds / (E * b * t ** 3 / 12);
      for (const r of [a, q]) smax = Math.max(smax, 6 * Math.abs(r[0] - xt) / (b * r[2] ** 2));
    }
    return { c, s: smax };
  }
  /** Tloušťka zúženého nosníku (stálé pevnosti): t0·√(vzdálenost od konce / délka), nejméně polovina. */
  const zuzena = (t0, u, zap) => (zap ? t0 * Math.max(0.5, Math.sqrt(Math.max(0, 1 - u))) : t0);
  /** Čtvrtina osy očka od vrcholu (0, h/2) k boku (w/2, 0). */
  function ctvrtkaOcka(tvar, w, h, n = 40) {
    const P = [];
    if (tvar === 'kosoctverec') {
      for (let i = 0; i <= n; i++) { const u = i / n; P.push([u * w / 2, (1 - u) * h / 2]); }   // rohy zaoblí tloušťka pásku
      return P;
    }
    if (tvar === 'oval' && w > h) {
      const rr = h / 2, a = w / 2 - rr;
      for (let i = 0; i <= n / 2; i++) P.push([a * i / (n / 2), rr]);
      for (let i = 1; i <= n / 2; i++) { const f = Math.PI / 2 * (1 - i / (n / 2)); P.push([a + rr * Math.cos(f), rr * Math.sin(f)]); }
      return P;
    }
    const ww = tvar === 'kruh' ? h : w;
    for (let i = 0; i <= n; i++) { const f = Math.PI / 2 * (1 - i / n); P.push([ww / 2 * Math.cos(f), h / 2 * Math.sin(f)]); }
    return P;
  }
  /** Celá osa očka (uzavřená) se středem v (0, 0). */
  function osaOcka(tvar, w, h) {
    const q = ctvrtkaOcka(tvar, w, h);
    const s2 = q.slice().reverse().map(([x, y]) => [x, -y]), s3 = q.map(([x, y]) => [-x, -y]), s4 = q.slice().reverse().map(([x, y]) => [-x, y]);
    return q.concat(s2.slice(1), s3.slice(1), s4.slice(1, -1));
  }
  /** Očko stlačené silou F ve vrcholech: poddajnost [mm/N] a největší moment na 1 N [mm]; ohybová tuhost EI. */
  function poddajnostOcka(tvar, w, h, EI) {
    const q = ctvrtkaOcka(tvar, w, h, 80);
    let L = 0, Ix = 0;
    const ds = [], xs = [];
    for (let i = 0; i + 1 < q.length; i++) { const d = Math.hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]); ds.push(d); xs.push((q[i][0] + q[i + 1][0]) / 2); L += d; Ix += xs[i] * d; }
    const M0 = 0.5 * Ix / L;   // z podmínky nulového natočení ve vrcholu a na boku
    let c = 0, mmax = 0;
    for (let i = 0; i < ds.length; i++) { const M = 0.5 * xs[i] - M0; c += M * M * ds[i]; mmax = Math.max(mmax, Math.abs(M)); }
    mmax = Math.max(mmax, M0, Math.abs(0.5 * q[q.length - 1][0] - M0));
    return { c: 4 * c / EI, m: mmax };
  }

  /** Poloha pružiny mezi rukojeťmi: 0 = hned za kloubem, 1 = u konce rukojeti. */
  function polohaMezi(o, frac, pul) {
    const a = o.xp + (o.kloub ? o.kloub.rKc : 0) + 1.5 + pul, b = o.rukojetDo - 2 - pul;
    return a + frac * Math.max(0, b - a);
  }
  function pruzina(p, o) {
    const d = o.drat, xp = o.xp;
    if (p.pruzina === 'tlacna') {
      const q = p.tlacna, xk = polohaMezi(o, q.poloha, q.prumer / 2 + 0.8), tu = o.plochy(1, xk), tl = o.plochy(-1, xk);
      if (!tu || !tl) { o.vinuta = { chybi: true, xk }; return; }
      const tlU = Math.abs(tu.vne - tu.vni), tlL = Math.abs(tl.vne - tl.vni);
      // automatická hloubka jamek: pružina v klidu stlačená o čtvrtinu svého zdvihu (Ls = závity na sobě)
      const Ls = (q.zavitu + 2) * q.drat, mezera = Math.abs(tu.vni) + Math.abs(tl.vni);
      const hs = q.hloubka > 0 ? q.hloubka : Math.max(1.5, Math.min(Math.min(tlU, tlL) - 1.4, (q.delka - 0.25 * (q.delka - Ls) - mezera) / 2));
      const yu = Math.abs(tu.vni) + hs, yl = -(Math.abs(tl.vni) + hs);
      o.vinuta = { xk, D: q.prumer, d: q.drat, Dm: q.prumer - q.drat, n: q.zavitu, L0: q.delka, hs, yu, yl, Li: yu - yl, vyska: yu - yl,
        Ls: (q.zavitu + 2) * q.drat, rJamky: q.prumer / 2 + 0.3, tlU, tlL };
      return;
    }
    if (p.pruzina === 'ocka') {
      const q = p.ocka, ws = o.W - 2.4, pat = 1, hk = 0.8;
      const w = q.tvar === 'kruh' ? null : q.sirka;
      // u kruhu je šířka = výška, poloha podle odhadu výšky
      const xk = polohaMezi(o, q.poloha, (w || 8) / 2 + q.tloustka);
      const vu = o.vni(1, xk), vl = o.vni(-1, xk);
      if (vu == null || vl == null) { o.ocka = { chybi: true, xk }; return; }
      const yu = vu + hk, yl = -(vl + hk), vyska = yu - yl, volna = vyska + q.predpeti;
      const hr = (volna - 2 * pat) / q.pocet, hrI = (vyska - 2 * pat) / q.pocet;
      o.ocka = { xk, tvar: q.tvar, n: q.pocet, t: q.tloustka, w: w || hr, wI: w || hrI, hr, hrI, ws, pat, hk, yu, yl, vyska, volna, predpeti: q.predpeti,
        sirkaPadu: Math.max(3, 0.45 * (w || hr)), stlaceni: q.pocet * Math.max(0, 0.9 * (hr - 2 * q.tloustka - 0.3)) };
      if (q.tvar !== 'kruh') { const x2 = polohaMezi(o, q.poloha, w / 2 + q.tloustka); o.ocka.xk = x2; }
      return;
    }
    if (p.pruzina === 'oblouk') {
      // oblouk z konce nosného ramene (c = −1 dolní, +1 horní): vetknutí v rameni, oblouk za koncem, volné rameno pod druhou rukojetí.
      // Počítá se v místních souřadnicích Y (kladně směrem k druhému rameni), skutečné y = −c·Y.
      const q = p.oblouk, c = q.rameno === 'horni' ? 1 : -1, t = q.tloustka, tb = q.tloustkaOblouku > 0 ? q.tloustkaOblouku : t;
      const jm = c > 0 ? 'horni' : 'dolni', xe = o.konec[jm], qn = o.plochy(c, xe - 1.2), qu = o.vni(-c, xe - 0.5);
      const b = q.sirka > 0 ? Math.min(q.sirka, o.W) : o.W, naY = Y => -c * Y;
      if (!qn || qu == null) { o.oblouk = { chybi: true }; return; }
      const xk = xe - q.delka, vk = o.vni(-c, xk), vkd = o.vni(c, xk);
      if (vk == null || vkd == null || xk < o.xp + (o.kloub ? o.kloub.rKc : 0) + 2) { o.oblouk = { chybi: true, xk }; return; }
      const YK = vk - t / 2, Ymid = -c * (qn.vni + qn.vne) / 2, Yin = -Math.abs(qn.vni);
      // vrchol oblouku tak nízko, aby celé volné rameno vedlo pod druhou rukojetí (dotek jen koncem)
      let YT = qu - tb / 2 - 0.6;
      for (let x = xk + 1; x < xe; x += 0.5) { const f = o.vni(-c, x); if (f != null) YT = Math.min(YT, YK + (f - t / 2 - 0.3 - YK) * (xe - xk) / (x - xk)); }
      // háček na stejném rameni vychází ze středu konce: kořen oblouku se posune k vnitřní straně, aby šel vedle háčku
      const h = o.hacek && !o.hacek.chybi ? o.hacek : null;
      let Yb = Ymid, posun = false;
      if (h && h.rameno === jm) {
        const Yh = -c * h.P0[1], Yp = Yh + h.t / 2 + tb / 2 + 0.45;   // horní hrana háčku v místních souřadnicích
        if (Yp > Yb) { Yb = Math.min(Yp, Yin - 0.3); posun = true; }
      }
      if (YT - Yb < tb + 0.5) { o.oblouk = { chybi: true, xk, nizky: true }; return; }
      const vyska = YT - Yb, Yc = (YT + Yb) / 2;
      /** Osa oblouku v místních souřadnicích podle tvaru: 'elipsa' (poloosa a), 'omega' (kruh R > výška/2), 'U' (rohy R, svislá část v xv). */
      const tvarOsy = (tvar, a, Rk) => {
        const P = [];
        if (tvar === 'smycka') {
          // smyčka: kružnice (střed za koncem, posunutý ven pod nosné rameno), tečny ke kořeni a k volnému rameni;
          // od kořene dolů, spodkem ven, vzhůru po vzdálené straně a horem zpět k volnému ramenu (proti směru hodin)
          // volné rameno vede rovně od svého konce (v tiskové poloze) tečně do smyčky
          const Rk2 = Math.max(1, Rk), C = [xe + Math.max(a, 2 * Rk2) - Rk2, Yc - q.posun], P0 = [xe, Yb], T = [xk, YK + q.predpeti];
          const tecny = Pt => { const dx = Pt[0] - C[0], dy = Pt[1] - C[1], d = Math.hypot(dx, dy); if (d <= Rk2 + 0.05) return null;
            const f = Math.atan2(dy, dx), al = Math.acos(Rk2 / d); return [f + al, f - al].map(g => [C[0] + Rk2 * Math.cos(g), C[1] + Rk2 * Math.sin(g), g]); };
          const smerCW = Qp => [-(Qp[1] - C[1]) / Rk2, (Qp[0] - C[0]) / Rk2];   // směr oběhu proti hodinám
          const t0 = tecny(P0), t1 = tecny(T);
          if (!t0 || !t1) return null;
          const Q1 = t0.find(Qp => { const v = smerCW(Qp), w = [Qp[0] - P0[0], Qp[1] - P0[1]], l = Math.hypot(...w) || 1; return (v[0] * w[0] + v[1] * w[1]) / l > 0.98; });
          const Q2 = t1.find(Qp => { const v = smerCW(Qp), w = [T[0] - Qp[0], T[1] - Qp[1]], l = Math.hypot(...w) || 1; return (v[0] * w[0] + v[1] * w[1]) / l > 0.98; });
          if (!Q1 || !Q2) return null;
          let sw = Q2[2] - Q1[2]; while (sw <= 0.05) sw += 2 * Math.PI; while (sw > 2 * Math.PI) sw -= 2 * Math.PI;
          const vpred = [[Q1[0], Q1[1]]], n = Math.max(12, Math.ceil(sw / (6 * RAD)));
          for (let i = 1; i <= n; i++) { const g = Q1[2] + sw * i / n; vpred.push([C[0] + Rk2 * Math.cos(g), C[1] + Rk2 * Math.sin(g)]); }
          // body od vrcholu (u volného ramene) ke kořeni, s rovnými tečnami
          const d0 = Math.hypot(Q1[0] - P0[0], Q1[1] - P0[1]);
          P.push(...vpred.reverse());   // první bod = Q2, kam vede volné rameno
          for (let i = 1; i <= Math.ceil(d0 / 1.5); i++) P.push([Q1[0] + (P0[0] - Q1[0]) * i / Math.ceil(d0 / 1.5), Q1[1] + (P0[1] - Q1[1]) * i / Math.ceil(d0 / 1.5)]);
          return P;
        }
        if (tvar === 'omega') {
          const al = Math.asin(Math.min(1, vyska / 2 / Rk)), xcO = xe + Math.sqrt(Math.max(0, Rk * Rk - vyska * vyska / 4)) + 0.3, sw = 2 * Math.PI - 2 * al;
          for (let i = 1; i <= 32; i++) { const f = Math.PI - al - sw * i / 32; P.push([xcO + Rk * Math.cos(f), Yc + Rk * Math.sin(f)]); }
        } else if (tvar === 'U') {
          const xv = xe + 0.3 + Math.max(a, Rk);
          P.push([xv - Rk, YT]);
          for (let i = 1; i <= 8; i++) { const f = Math.PI / 2 - Math.PI / 2 * i / 8; P.push([xv - Rk + Rk * Math.cos(f), YT - Rk + Rk * Math.sin(f)]); }
          for (let i = 0; i <= 8; i++) { const f = -Math.PI / 2 * i / 8; P.push([xv - Rk + Rk * Math.cos(f), Yb + Rk + Rk * Math.sin(f)]); }
        } else for (let i = 1; i <= 20; i++) { const f = Math.PI / 2 - Math.PI * i / 20; P.push([xe + 0.3 + a * Math.cos(f), Yc + vyska / 2 * Math.sin(f)]); }
        return P;
      };
      let tvar = q.tvar === 'smycka' ? 'smycka' : q.polomer <= 0 ? 'elipsa' : q.polomer >= vyska / 2 ? 'omega' : 'U';
      let a = q.presah > 0 ? q.presah : (tvar === 'elipsa' ? vyska / 2 : tvar === 'smycka' ? 2 * (q.polomer || 6) : q.polomer);
      const Rsm = q.polomer > 0 ? q.polomer : 6;
      // vyhnutí háčku: oblouk se zplošťuje do užší elipsy, dokud se háčku nedotýká
      // části schované v rameni (za jeho koncem) se nepočítají – tam se oba spojí s ramenem
      const koliduje = P => !!h && P.some(([x, Y]) => x > xe + 0.3 && h.body.some(bh => bh[0] > xe + 0.3 && Math.hypot(bh[0] - x, bh[1] - naY(Y)) < (tb + h.t) / 2 + 0.3));
      let smycka = tvarOsy(tvar, a, tvar === 'smycka' ? Rsm : q.polomer), zplosteni = 1, kol, neplatna = false;
      if (!smycka) { neplatna = true; tvar = 'elipsa'; a = vyska / 2; smycka = tvarOsy('elipsa', a, 0); }
      kol = koliduje(smycka);
      if (kol && tvar === 'smycka') {
        // smyčka se háčku vyhne zmenšením (poloměr i přesah úměrně)
        let f = 1, P2 = smycka;
        while (kol && f > 0.35) { f *= 0.9; const P3 = tvarOsy('smycka', a * f, Rsm * f); if (P3) { P2 = P3; kol = koliduje(P2); } }
        smycka = P2; zplosteni = f;
      } else if (kol) {
        const a0 = tvar === 'omega' ? q.polomer : a, amin = Math.max(1.5 * tb, 0.25 * vyska / 2);
        tvar = tvar === 'U' ? 'U' : 'elipsa';
        let aa = a0;
        while (kol && aa > amin) { aa = Math.max(amin, aa * 0.88); smycka = tvarOsy(tvar, aa, Math.min(q.polomer || aa, aa)); kol = koliduje(smycka); }
        zplosteni = aa / a0; a = aa;
      }
      // osa od volného konce: rameno (volitelně zúžené), oblouk, krátké vetknutí do ramene
      const osa = [], vrchol = tvar === 'smycka' ? smycka[0] : [xe - 0.2, YT];
      for (let i = 0; i <= 16; i++) { const u = i / 16; osa.push([xk + u * (vrchol[0] - xk), YK + q.predpeti * (1 - u) + u * (vrchol[1] - YK), zuzena(t, 1 - u, q.zuzeni)]); }
      for (const [x, Y] of (tvar === 'smycka' ? smycka.slice(1) : smycka)) osa.push([x, Y, tb]);
      osa.push([xe - 2.5, Yb, tb]);
      // nejmenší poloměr křivosti oblouku (pro pevnost v ohybu)
      const b2 = vyska / 2, rMin = tvar === 'smycka' ? Rsm * zplosteni : tvar === 'omega' ? q.polomer : tvar === 'U' ? Math.min(q.polomer, a) : Math.min(a * a / b2, b2 * b2 / a);
      const xMax = Math.max(...smycka.map(P => P[0]));
      o.oblouk = { c, rameno: jm, xk, xe, tvar, a, R: b2, rMin, t, tb, b, YT, Yb, YK, predpeti: q.predpeti, L: vrchol[0] - xk, xr: vrchol[0], y0: naY(vrchol[1]), yK: naY(YK),
        osa: osa.map(([x, Y, tt]) => [x, naY(Y), tt]), zdvih: YK - (-vkd) - t / 2 - 0.3, presah: xMax + tb / 2 - xe, posun, zplosteni, koliduje: kol, neplatna,
        delkaPruziny: osa.slice(1).reduce((sm, r, i2) => sm + Math.hypot(r[0] - osa[i2][0], r[1] - osa[i2][1]), 0) };
      return;
    }
    if (p.pruzina === 'tpu') {
      const q = p.tpu, xk = polohaMezi(o, q.poloha, q.prumer / 2 + 0.6), tu = o.plochy(1, xk), tl = o.plochy(-1, xk);
      if (!tu || !tl) { o.tpu = { chybi: true, xk }; return; }
      const vu = Math.abs(tu.vni), vl = Math.abs(tl.vni), tlU = Math.abs(tu.vne - tu.vni), tlL = Math.abs(tl.vne - tl.vni);
      const hs = q.hloubka > 0 ? q.hloubka : Math.max(1, Math.min(tlU, tlL) - 1.4);
      const yu = vu + hs, yl = -(vl + hs), hi = yu - yl, h0 = hi + q.predpeti, D = q.prumer, Di = q.stena > 0 ? Math.max(0, D - 2 * q.stena) : 0;
      const A = Math.PI * (D * D - Di * Di) / 4, S = A / (Math.PI * (D + Di) * h0);
      o.tpu = { xk, D, Di, hs, yu, yl, vyska: hi, h0, A, S, Ec: E_TPU * (1 + 1.2 * S * S), rJamky: D / 2 + 0.4, predpeti: q.predpeti, tlU, tlL };
      return;
    }
    if (p.pruzina === 'dratU') {
      const q = p.dratU, dd = q.drat, ra = Math.max(q.ohyb, dd), xa = xp + o.kloub.rKc + ra + dd / 2 + 0.8, xk = xa + q.delka, hk = 0.6 * dd;
      const vu = o.vni(1, xk), vl = o.vni(-1, xk);
      if (vu == null || vl == null) { o.dratU = { chybi: true, xa, xk }; return; }
      const yu = vu + hk - dd / 2, yl = -(vl + hk - dd / 2);
      o.dratU = { xa, xk, ra, d: dd, L: q.delka, hk, yu, yl, sevreni: (yu - yl) - (2 * ra + dd), predpeti: q.predpeti, delkaDratu: 2 * q.delka + Math.PI * ra + 4 };
      return;
    }
    if (p.pruzina === 'pasek') {
      const q = p.pasek, t = q.tloustka, b = q.sirka > 0 ? q.sirka : o.W - 2, hl = t + 0.3;
      const xk = xp + o.kloub.rKc + 3, xr = xk + q.delka, xz = xr + q.zasunuti;
      const vk = o.vni(1, xk), vr = o.vni(-1, xr), vkd = o.vni(-1, xk), vz = o.vni(-1, xz), oz = o.vne(-1, xz);
      if (vk == null || vr == null || vkd == null || vz == null) { o.pasek = { chybi: true, xk, xr, xz }; return; }
      const y0 = -vr - 0.6 - t / 2, yKontakt = vk - t / 2, yVolny = yKontakt + q.predpeti;
      const sklon = (yVolny - y0) / (xk - xr), ySterbina = y0 + sklon * (xz - xr);
      o.pasek = { xk, xr, xz, t, b, hl, L: q.delka, y0, yKontakt, yVolny, predpeti: q.predpeti, sklon, ySterbina,
        dnoKapsy: -vkd - 0.6, zdvih: yKontakt - (-vkd - 0.6 + t / 2), zbyva: ySterbina - t / 2 - 0.15 - (-oz) };
      return;
    }
    if (p.pruzina === 'kov_drevo' || p.pruzina === 'kov_trmen') {
      // u třmenu leží nohy na povrchu (po bocích), jen konec vede příčným zářezem přes celou šířku
      const hd = p.pruzina === 'kov_trmen' ? 0 : 0.65 * d.d, sirka = d.d + 0.4;
      o.nohy = [1, -1].map(s => {
        const b = dosahNohy(o, s, d.noha, -1, o.vne);
        if (!b) return { s, chybi: true };
        return { s, x: b.x, y: b.y, phi: Math.atan2(b.y - hd + d.d / 2, xp - b.x) };
      });
      o.dreva = { hd, sirka, trmen: p.pruzina === 'kov_trmen', zarezSpicky: { sirka: d.d + 0.5, hloubka: Math.min(0.85 * d.d + 0.2, 2) } };
      if (o.nohy.every(n => !n.chybi)) o.montaz = o.nohy[0].phi + o.nohy[1].phi;
      return;
    }
    if (p.pruzina === 'kov_plast') {
      const hd = 0.6 * d.d;
      const kanal = s => (s2, x) => { const v = o.vni(s2, x); return v == null ? null : v + hd; };
      o.nohy = [1, -1].map(s => {
        const b = dosahNohy(o, s, d.noha, 1, kanal(s));
        if (!b) return { s, chybi: true };
        return { s, x: b.x, y: b.y, phi: Math.atan2(b.y - d.d / 2, b.x - xp) };
      });
      o.kanalNohou = { hd };
      if (o.nohy.every(n => !n.chybi)) o.montaz = o.nohy[0].phi + o.nohy[1].phi;
      return;
    }
    const rk = o.kloub ? o.kloub.rKc : 0;
    if (p.pruzina === 'jazycek') {
      const q = p.jazycek, xr = xp + rk + 1.5, xk = xr + q.delka, hl = q.tloustka + 0.35;
      const yr = o.vni(-1, xr), yk = o.vni(1, xk), ykD = o.vni(-1, xk);
      if (yr == null || yk == null || ykD == null) { o.jazyk = { chybi: true, xr, xk }; return; }
      // kořen na dně kapsy, konec v klidu nad horní plochou o předpětí; ve stisku leží jazýček v kapse
      const y0 = -yr - hl + q.tloustka / 2;            // osa u kořene (dolní rameno má y < 0)
      const yKontakt = yk - q.tloustka / 2;             // osa konce, když se dotýká horní rukojeti
      o.jazyk = { xr, xk, t: q.tloustka, L: q.delka, y0, yKontakt, yVolny: yKontakt + q.predpeti, hl,
        // nejvíc se jazýček ohne, když leží na dně kapsy
        zdvih: yKontakt - (-ykD - hl + q.tloustka / 2), predpeti: q.predpeti };
      return;
    }
    if (p.pruzina === 'listova') {
      const q = p.listova, ra = Math.max(1, 0.8 * q.tloustka), xa = xp + rk + ra + q.tloustka / 2 + 0.8, xk = xa + q.delka;
      const hk = 0.8, yu = o.vni(1, xk), yl = o.vni(-1, xk);
      if (yu == null || yl == null) { o.vpruz = { chybi: true, xa, xk }; return; }
      const yuo = yu + hk - q.tloustka / 2, ylo = -(yl + hk - q.tloustka / 2);
      o.vpruz = { xa, xk, ra, t: q.tloustka, L: q.delka, hk, kapsa: 3.6, ws: o.W - 2.4,
        yu: yuo, yl: ylo, yuVolny: yuo + q.predpeti / 2, ylVolny: ylo - q.predpeti / 2, sevreni: (yuo - ylo) - (2 * ra + q.tloustka), predpeti: q.predpeti };
      return;
    }
    if (p.pruzina === 'meandr') {
      const q = p.meandr, xk = xp + rk + q.sirka / 2 + 2.5 + 0.55 * Math.max(0, o.rukojetDo - xp - rk - q.sirka - 6);
      const hk = 0.8, yu = o.vni(1, xk), yl = o.vni(-1, xk), pat = 1;
      if (yu == null || yl == null) { o.had = { chybi: true, xk }; return; }
      const vyska = yu + yl + 2 * hk, volna = vyska + q.predpeti;
      o.had = { xk, b: q.sirka, t: q.tloustka, n: q.zavitu, hk, pat, ws: o.W - 2.4, yu: yu + hk, yl: -(yl + hk), vyska, volna,
        roztec: (volna - 2 * pat) / q.zavitu, plna: q.zavitu * (q.tloustka + 0.25) + 2 * pat, predpeti: q.predpeti };
      return;
    }
    if (p.pruzina === 'gumicka') {
      const q = p.gumicka, xb = q.poloha, cs = q.prurez, gd = 0.45 * cs;
      const yu = o.vne(1, xb), yl = o.vne(-1, xb);
      if (yu == null || yl == null) { o.guma = { chybi: true, xb }; return; }
      const H = yu + yl - 2 * gd + cs, Wg = o.W - 2 * gd + cs;      // obvod středu průřezu gumy
      const obvod = 2 * (H + Wg) - (8 - 2 * Math.PI) * (cs / 2 + 0.5);
      const doporuc = Math.max(3, Math.round((obvod / (1.3 * Math.PI) - cs) * 2) / 2);
      const ID = q.vnitrni > 0 ? q.vnitrni : doporuc;
      o.guma = { xb, cs, gd, H, Wg, obvod, ID, doporuc, volny: Math.PI * (ID + cs), yu, yl };
    }
  }

  /** Háček / oko / klip: osa (lomená čára) a kroužek v 2D, na konci zvoleného ramene. */
  function hacek(p, o) {
    const h = p.hacek, s = h.rameno === 'horni' ? 1 : -1, P = o.obrys[h.rameno];
    const xe = o.konec[h.rameno], x0 = xe - Math.min(2.5, h.tloustka * 0.6);
    const q = o.plochy(s, x0);
    if (!q) { o.hacek = { chybi: true }; return; }
    // s obloukem na stejném rameni vychází háček od vnější strany ramene (oblouk jde od vnitřní)
    const sObloukem = p.pruzina === 'oblouk' && p.oblouk.rameno === h.rameno;
    const ym = sObloukem ? q.vne - s * Math.min(h.tloustka / 2 + 0.1, Math.abs(q.vne - q.vni) / 2) : (q.vni + q.vne) / 2, ven = h.smer === 'ven' ? s : -s;
    const a = ven * h.uhel * RAD, d = [Math.cos(a), Math.sin(a)], n = [-d[1] * ven, d[0] * ven];   // n míří na stranu ohybu
    const P0 = [x0, ym], P1 = [xe + h.delka * d[0], ym + h.delka * d[1] + (xe - x0) * d[1]];
    const R = h.prumer / 2 + h.tloustka / 2, osa = [P0, P1];
    const out = { s, rameno: h.rameno, tvar: h.tvar, t: h.tloustka, R, rIn: h.prumer / 2, P0, P1, d, n, osa, kruh: null };
    if (h.tvar === 'hacek') {
      // želva: půlkruh kolem tyče, rovná vratná část (hloubka), zahnutí špičky
      const smer = n[0] * d[1] - n[1] * d[0] < 0 ? 1 : -1;            // otáčení tak, aby oblouk navázal tečně
      let P = P1, dir = d;
      const oblouk = (r, uhel) => {
        const C = [P[0] + n2(dir)[0] * r, P[1] + n2(dir)[1] * r], a0 = Math.atan2(P[1] - C[1], P[0] - C[0]), kroku = Math.max(1, Math.ceil(uhel / (8 * RAD)));
        for (let i = 1; i <= kroku; i++) { const f = a0 + smer * uhel * i / kroku; osa.push([C[0] + r * Math.cos(f), C[1] + r * Math.sin(f)]); }
        P = osa[osa.length - 1]; dir = [Math.cos(Math.atan2(dir[1], dir[0]) + smer * uhel), Math.sin(Math.atan2(dir[1], dir[0]) + smer * uhel)];
        return C;
      };
      const n2 = v => (smer > 0 ? [-v[1], v[0]] : [v[1], -v[0]]);
      out.C = oblouk(R, Math.PI);
      if (h.hloubka > 0) { P = [P[0] + dir[0] * h.hloubka, P[1] + dir[1] * h.hloubka]; osa.push(P); }
      if (h.zahnuti > 0) oblouk(R, h.zahnuti * RAD);
    } else if (h.tvar === 'klip') {
      // klip: pásek po oblouku se zaoblenými konci, otvor ven; konce mírně rozevřené do trychtýře, aby se klip snadno nacvakl
      const C = [P1[0] + d[0] * R, P1[1] + d[1] * R], tl = h.tloustka, g = h.otvor > 0 ? h.otvor : 0.8 * h.prumer;
      const al = Math.asin(Math.min(0.97, (g + tl) / (2 * R))), tn = Math.atan2(n[1], n[0]), kroku = Math.ceil((2 * Math.PI - 2 * al) / (6 * RAD));
      const bod = f => [C[0] + R * Math.cos(f), C[1] + R * Math.sin(f)];
      // rozevření konce do trychtýře: od konce ven podél osy otvoru, od ní o 25° do strany – otvor se jen rozšiřuje
      const flare = f => {
        const P = bod(f), v = [P[0] - C[0], P[1] - C[1]], podel = v[0] * n[0] + v[1] * n[1];
        let bok = [v[0] - podel * n[0], v[1] - podel * n[1]]; const lb = Math.hypot(...bok) || 1; bok = [bok[0] / lb, bok[1] / lb];
        const u = [n[0] * Math.cos(25 * RAD) + bok[0] * Math.sin(25 * RAD), n[1] * Math.cos(25 * RAD) + bok[1] * Math.sin(25 * RAD)];
        return [[P[0] + u[0] * 0.6 * tl, P[1] + u[1] * 0.6 * tl], [P[0] + u[0] * 1.2 * tl, P[1] + u[1] * 1.2 * tl]];
      };
      const klip = flare(tn + al).reverse();
      for (let i = 0; i <= kroku; i++) klip.push(bod(tn + al + (2 * Math.PI - 2 * al) * i / kroku));
      klip.push(...flare(tn - al));
      out.C = C; out.klip = klip; out.otvorKlipu = 2 * R * Math.sin(al) - tl;
    } else {
      const C = [P1[0] + d[0] * R, P1[1] + d[1] * R];
      out.C = C; out.kruh = { C, rIn: h.prumer / 2, rOut: h.prumer / 2 + h.tloustka };
    }
    // pásy osy pro kontrolu kolize a 2D kreslení
    out.body = [];
    for (let i = 0; i + 1 < osa.length; i++) {
      const A = osa[i], B = osa[i + 1], l = Math.hypot(B[0] - A[0], B[1] - A[1]), k = Math.max(1, Math.ceil(l / 0.8));
      for (let j = 0; j <= k; j++) out.body.push([A[0] + (B[0] - A[0]) * j / k, A[1] + (B[1] - A[1]) * j / k]);
    }
    if (out.klip) for (let i = 0; i + 1 < out.klip.length; i++) { const A = out.klip[i], B = out.klip[i + 1]; for (let j = 0; j < 3; j++) out.body.push([A[0] + (B[0] - A[0]) * j / 3, A[1] + (B[1] - A[1]) * j / 3]); }
    if (out.kruh) for (let i = 0; i < 48; i++) { const f = 2 * Math.PI * i / 48, rr = (out.kruh.rIn + out.kruh.rOut) / 2; out.body.push([out.C[0] + rr * Math.cos(f), out.C[1] + rr * Math.sin(f)]); }
    // nosnost: J a klip ≈ ohyb momentem F·2R, oko ≈ 0,32·F·R
    const sig = MATERIALY[p.tisk.material].cyklus * 1.6, W = h.sirka > 0 ? Math.min(h.sirka, o.W) : o.W, tl = h.tloustka;
    out.sirka = W;
    const Fdov = h.tvar === 'oko' ? sig * W * tl * tl / (6 * 0.32 * R) : sig * W * tl * tl / (12 * R);
    out.nosnost = Fdov / 9.81;   // kg
    o.hacek = out;
  }

  /** Odlehčení: podlouhlé otvory skrz šířku v rukojetích, mimo pružiny, kapsy a otvory. */
  function odlehceni(p, o) {
    const blok = [], b = (a, c) => blok.push([a, c]);
    const v = o.vpruz || o.dratU;
    if (v && !v.chybi) b(v.xa - v.ra - 1.5, v.xk + 3);
    if (o.jazyk && !o.jazyk.chybi) b(o.jazyk.xr - 1.5, o.jazyk.xk + 2);
    if (o.had && !o.had.chybi) b(o.had.xk - o.had.b / 2 - 2, o.had.xk + o.had.b / 2 + 2);
    for (const q of [o.vinuta, o.tpu]) if (q && !q.chybi) b(q.xk - q.D / 2 - 2, q.xk + q.D / 2 + 2);
    if (o.pasek && !o.pasek.chybi) b(o.pasek.xk - 2, o.pasek.xz + 2);
    if (o.ocka && !o.ocka.chybi) b(o.ocka.xk - o.ocka.w / 2 - 2, o.ocka.xk + o.ocka.w / 2 + 2);
    if (o.oblouk && !o.oblouk.chybi) b(o.oblouk.xk - 2, 1e9);
    if (o.kanalNohou && o.nohy) for (const n of o.nohy) if (!n.chybi) b(n.x - 6, n.x + 2.5);
    if (o.magnet) b(o.magnet.x - o.magnet.r - 2, o.magnet.x + o.magnet.r + 2);
    if (o.otvor) for (const q of o.otvor) if (!q.chybi) b(q.x - q.r - 2, q.x + q.r + 2);
    if (o.hacek && !o.hacek.chybi) b(o.konec[o.hacek.rameno] - 5, 1e9);
    const zac = o.xp + o.rRez + 3, kon = Math.min(o.konec.horni, o.konec.dolni) - 4, stena = 1.6 + (p.telo.vroubky ? 0.7 : 0);
    blok.sort((x, y) => x[0] - y[0]);
    const volne = []; let x = zac;
    for (const [a, c] of blok) { if (a > x) volne.push([x, Math.min(a, kon)]); x = Math.max(x, c); }
    if (x < kon) volne.push([x, kon]);
    o.odlehceni = [];
    for (const [a, c] of volne) {
      if (c - a < 7) continue;
      for (const sg of [1, -1]) {
        let r = 3; const mid = [];
        for (let xx = a; xx <= c + 1e-9; xx += (c - a) / Math.ceil(c - a)) {
          const q = o.plochy(sg, xx); if (!q) { r = 0; break; }
          r = Math.min(r, (Math.abs(q.vne - q.vni) - 2 * stena) / 2); mid.push([xx, (q.vni + q.vne) / 2]);
        }
        if (r < 0.9) continue;
        const body = mid.filter(b2 => b2[0] >= a + r + 0.4 && b2[0] <= c - r - 0.4);
        if (body.length >= 2) o.odlehceni.push({ s: sg, r, body });
      }
    }
  }

  /* ---------- mechanika ---------- */
  /** Moment pružiny M(θ) v ose [N·mm] podle celkového rozevření ramen θ [rad], napětí σ(θ) [MPa] a dovolené napětí. */
  function mechanika(p, o) {
    const mat = MATERIALY[p.tisk.material], xp = o.xp, m = { M: () => 0, sigma: () => 0, dov: mat.cyklus, poznamky: [], typ: p.pruzina };
    const d = o.drat;
    if (o.dr.kov && d) {
      const C = Math.max(2.5, d.Dm / d.d), Ki = (4 * C * C - C - 1) / (4 * C * (C - 1));
      const na = d.n + 2 * d.noha / (3 * Math.PI * d.Dm);
      m.k = d.d ** 4 * E_OCEL / (67.86 * d.Dm * na);                 // N·mm/rad (Shigley, vč. tření závitů)
      const znam = o.montaz != null;
      m.montaz = znam ? o.montaz : 0;
      const civek = 1;
      m.predpeti = p.pruzina === 'kov_drevo' || p.pruzina === 'kov_trmen' ? m.montaz - p.kov.volnyUhel * RAD : p.kov.volnyUhel * RAD - m.montaz;
      const k1 = m.k;                                     // tuhost jedné cívky
      m.M = th => (znam && d.Dm / d.d >= 2.5 ? Math.max(0, civek * k1 * (m.predpeti + th)) : 0);
      m.znam = znam;
      m.sigma = th => Ki * 32 * m.M(th) / civek / (Math.PI * d.d ** 3);
      m.k = civek * k1;
      m.dov = SIGMA_DRAT; m.material = 'ocelový drát';
    } else if (p.pruzina === 'omega' && o.oko) {
      const q = o.oko, I = o.W * q.t ** 3 / 12, l = Math.max(1, Math.PI * q.R - q.spice);
      m.k = 2 * 4 * mat.E * I / l;
      m.M = th => m.k * Math.max(0, th);
      m.sigma = th => 2 * mat.E * q.t * Math.max(0, th) / l;
      m.predpeti = 0; m.mezera = q.mezera;
    } else if (p.pruzina === 'jazycek' && o.jazyk && !o.jazyk.chybi) {
      const q = o.jazyk, ram = q.xk - xp, kz = konzola(Array.from({ length: 41 }, (_, i) => { const u = 1 - i / 40; return [q.xr + u * q.L, 0, zuzena(q.t, u, p.jazycek.zuzeni)]; }), o.W, mat.E);
      const F = th => (q.predpeti + th * ram) / kz.c;
      m.M = th => F(th) * ram; m.F = F; m.sigma = th => kz.s * F(th);
      m.k = ram * ram / kz.c; m.predpeti = q.predpeti / ram;
      m.thetaPruz = Math.max(0, (q.zdvih - q.predpeti) / ram);
    } else if (p.pruzina === 'listova' && o.vpruz && !o.vpruz.chybi) {
      const q = o.vpruz, ram = q.xk - xp, kz = konzola(Array.from({ length: 41 }, (_, i) => { const u = 1 - i / 40; return [q.xa + u * q.L, 0, zuzena(q.t, u, p.listova.zuzeni)]; }), q.ws, mat.E);
      const F = th => ((q.predpeti + th * ram) / 2) / kz.c;
      m.M = th => F(th) * ram; m.F = F; m.sigma = th => kz.s * F(th);
      m.k = ram * ram / (2 * kz.c); m.predpeti = q.predpeti / ram;
      m.thetaPruz = Math.max(0, q.sevreni / ram);
    } else if (p.pruzina === 'ocka' && o.ocka && !o.ocka.chybi) {
      const q = o.ocka, ram = q.xk - xp, I = q.ws * q.t ** 3 / 12, po = poddajnostOcka(q.tvar, q.w, q.hr, mat.E * I);
      const F = th => (q.predpeti + th * ram) / (q.n * po.c);
      m.M = th => F(th) * ram; m.F = F; m.sigma = th => po.m * F(th) * (q.t / 2) / I;
      m.k = ram * ram / (q.n * po.c); m.predpeti = q.predpeti / ram;
      m.thetaPruz = Math.max(0, (q.stlaceni - q.predpeti) / ram);
    } else if (p.pruzina === 'oblouk' && o.oblouk && !o.oblouk.chybi) {
      const q = o.oblouk, ram = q.xk - xp, kz = konzola(q.osa, q.b, mat.E);
      const F = th => (q.predpeti + th * ram) / kz.c;
      m.M = th => F(th) * ram; m.F = F; m.sigma = th => kz.s * F(th);
      m.k = ram * ram / kz.c; m.predpeti = q.predpeti / ram;
      m.thetaPruz = Math.max(0, (q.zdvih - q.predpeti) / ram);
    } else if (p.pruzina === 'meandr' && o.had && !o.had.chybi) {
      const q = o.had, I = q.ws * q.t ** 3 / 12, ram = q.xk - xp, kl = 12 * mat.E * I / (q.n * q.b ** 3);
      const F = th => kl * (q.predpeti + th * ram);
      m.M = th => F(th) * ram; m.F = F;
      m.sigma = th => F(th) * q.b / 2 * (q.t / 2) / I;
      m.k = kl * ram * ram; m.predpeti = q.predpeti / ram;
      m.thetaPruz = Math.max(0, (q.vyska - q.plna) / ram);
    } else if (p.pruzina === 'gumicka' && o.guma && !o.guma.chybi && o.xp - o.guma.xb > 1) {
      const g = o.guma, A = Math.PI * g.cs * g.cs / 4, ram = xp - g.xb;
      const eps = th => Math.max(0, (g.obvod + 2 * th * ram) / g.volny - 1);
      const T = th => E_GUMA * A * eps(th);
      m.M = th => 2 * T(th) * ram;
      m.eps = eps; m.T = T;
      m.sigma = th => eps(th) * 100;   // pro gumu: protažení v %
      m.dov = 80; m.jednotka = '%'; m.material = 'pryž';
      m.k = 2 * E_GUMA * A * 2 * ram * ram / g.volny; m.predpeti = eps(0) * g.volny / (2 * ram);
    } else if (p.pruzina === 'tlacna' && o.vinuta && !o.vinuta.chybi && o.vinuta.Dm / o.vinuta.d >= 2.5) {
      const v = o.vinuta, ram = v.xk - xp, k = G_OCEL * v.d ** 4 / (8 * v.Dm ** 3 * v.n), C = v.Dm / v.d, Kw = (4 * C - 1) / (4 * C - 4) + 0.615 / C;
      const F = th => k * Math.max(0, v.L0 - v.Li + th * ram);
      m.F = F; m.M = th => F(th) * ram; m.sigma = th => Kw * 8 * F(th) * v.Dm / (Math.PI * v.d ** 3);
      m.dov = TAU_DRAT; m.material = 'ocelový drát'; m.kLin = k; m.k = k * ram * ram; m.predpeti = (v.L0 - v.Li) / ram;
      m.thetaPruz = Math.max(0, (v.Li - 1.05 * v.Ls) / ram);
    } else if (p.pruzina === 'tpu' && o.tpu && !o.tpu.chybi) {
      const v = o.tpu, ram = v.xk - xp, eps = th => Math.max(0, (v.predpeti + th * ram) / v.h0);
      m.eps = eps; m.M = th => v.Ec * v.A * eps(th) * ram; m.sigma = th => 100 * eps(th);
      m.dov = TPU_STLACENI; m.jednotka = '%'; m.material = 'TPU 95A'; m.k = v.Ec * v.A / v.h0 * ram * ram; m.predpeti = v.predpeti / ram;
      m.thetaPruz = Math.max(0, (0.5 * v.h0 - v.predpeti) / ram);
    } else if (p.pruzina === 'dratU' && o.dratU && !o.dratU.chybi) {
      const v = o.dratU, I = Math.PI * v.d ** 4 / 64, ram = v.xk - xp;
      const F = th => 3 * E_OCEL * I * ((v.predpeti + th * ram) / 2) / v.L ** 3;
      m.F = F; m.M = th => F(th) * ram; m.sigma = th => F(th) * v.L * (v.d / 2) / I;
      m.dov = SIGMA_OHYB; m.material = 'pružinový drát'; m.k = 1.5 * E_OCEL * I * ram * ram / v.L ** 3; m.predpeti = v.predpeti / ram;
      m.thetaPruz = Math.max(0, v.sevreni / ram);
    } else if (p.pruzina === 'pasek' && o.pasek && !o.pasek.chybi) {
      const v = o.pasek, I = v.b * v.t ** 3 / 12, ram = v.xk - xp;
      const F = th => 3 * E_OCEL * I * (v.predpeti + th * ram) / v.L ** 3;
      m.F = F; m.M = th => F(th) * ram; m.sigma = th => 3 * E_OCEL * v.t * (v.predpeti + th * ram) / (2 * v.L ** 2);
      m.dov = SIGMA_PASEK; m.material = 'pružinová ocel'; m.k = 3 * E_OCEL * I * ram * ram / v.L ** 3; m.predpeti = v.predpeti / ram;
      m.thetaPruz = Math.max(0, (v.zdvih - v.predpeti) / ram);
    }
    // geometrická mez: rukojeti se dotknou (nebo pružina dosedne)
    let tg = Infinity;
    for (let x = xp + 4; x <= o.L; x += 0.5) {
      const u = o.vni(1, x), l = o.vni(-1, x);
      if (u == null || l == null) continue;
      tg = Math.min(tg, Math.atan2(u, x - xp) + Math.atan2(l, x - xp));
    }
    if (!Number.isFinite(tg)) tg = 0;
    m.thetaRukojeti = tg;
    if (m.thetaPruz != null) tg = Math.min(tg, m.thetaPruz);
    m.thetaGeom = Math.max(0, tg);
    // mez napětí: θ, kde σ = dovolené
    if (m.sigma(m.thetaGeom) > m.dov) {
      let a = 0, b = m.thetaGeom;
      for (let i = 0; i < 40; i++) { const c = (a + b) / 2; if (m.sigma(c) > m.dov) b = c; else a = c; }
      m.thetaMat = a;
    } else m.thetaMat = Infinity;
    m.thetaMax = m.thetaGeom;
    m.otevreni = th => 2 * xp * Math.sin(th / 2) + 2 * o.posun;
    // sevření látky
    const f = p.tisk.latka, ramC = xp - o.xc, ramH = o.xh - xp;
    m.thLatka = Math.max(0, (f - 2 * o.posun) / ramC);
    m.sila = th => m.M(th) / ramC;             // síla čelistí ve středu sevření
    m.prsty = th => m.M(th) / ramH;            // síla prstů na rukojeti
    m.Fsevreni = m.sila(Math.min(m.thLatka, m.thetaMax));
    m.Fklid = m.sila(0);
    m.Fprsty = m.prsty(m.thetaMax);
    m.ramC = ramC; m.ramH = ramH;
    m.krivka = [];
    for (let i = 0; i <= 24; i++) { const th = m.thetaMax * i / 24; m.krivka.push({ th, otevreni: m.otevreni(th), sila: m.sila(th), prsty: m.prsty(th), sigma: m.sigma(th) }); }
    // pevnost ramene v nejslabším místě u osy
    const vne = o.vne(1, xp), vneL = o.vne(-1, xp);
    const h = vne == null || vneL == null ? NaN : Math.min(vne, vneL) - Math.max(o.rRez, p.telo.mezeraCep / 2 + o.posun);
    m.slabsiDolni = vneL != null && vne != null && vneL < vne;
    m.ramenoH = h;
    m.sigmaRamene = !Number.isFinite(h) ? 0 : h > 0 ? 6 * m.M(m.thetaMax) / (o.W * (o.kloub ? 0.75 : 1) * h * h) : Infinity;
    m.dovRamene = mat.mez * 0.6;
    return m;
  }

  /* ---------- díly ---------- */
  function seznamDilu(p, o) {
    const ks = p.tisk.kusu, d = [];
    if (p.pruzina === 'omega') d.push({ dil: 'kolicek', nazev: 'Kolíček (jeden díl)', ks });
    else { d.push({ dil: 'horni', nazev: 'Horní rameno', ks }); d.push({ dil: 'dolni', nazev: 'Dolní rameno', ks }); }
    if (p.pruzina === 'listova') d.push({ dil: 'vpruzina', nazev: 'V pružina', ks });
    if (p.pruzina === 'meandr') d.push({ dil: 'had', nazev: 'Hadovitá pružina', ks });
    if (p.pruzina === 'tpu') d.push({ dil: 'tpu', nazev: 'Váleček z TPU', ks });
    if (p.pruzina === 'ocka') d.push({ dil: 'ocka', nazev: 'Očka (pružina)', ks });
    if (o.kloub && o.kloub.pin) d.push({ dil: 'cep', nazev: 'Čep', ks });
    return d;
  }

  /* ---------- kontroly ---------- */
  function kontroly(p, o) {
    const H = [], t = p.telo, m = o.mech, mat = MATERIALY[p.tisk.material];
    const pridej = (uroven, text, ...pole) => H.push({ uroven, text, pole });
    // oprava k poslednímu hlášení: {zmeny: {cesta: hodnota}} nebo {akce: 'navrh'}
    const oprav = (text, zmeny, akce) => { H[H.length - 1].oprava = { text, zmeny, akce }; };
    for (const ch of o.chybySkici) pridej('chyba', ch, 'skica.zapnuta');
    if (o.xp <= o.Lc + 2) pridej('chyba', `Čep (${fmt(o.xp)} mm od špičky) musí ležet za čelistí (${fmt(o.Lc)} mm) – zkraťte čelist nebo posuňte čep.`, 'telo.cep', 'telo.celist');
    if (o.xp > o.L - 8) pridej('chyba', `Čep je ${fmt(Math.max(0, o.L - o.xp))} mm od konce – na rukojeť nezbývá místo.`, 'telo.cep', 'telo.delka');
    const pomer = (o.L - o.xp) / Math.max(1, o.xp);
    if (pomer < 0.9) pridej(pomer < 0.7 ? 'varovani' : 'info', `Rukojeť je kratší než čelist (páka ${fmt(pomer, 2)} : 1) – kolíček půjde ztuha otevřít.`, 'telo.cep');
    if (!o.zeSkici) {
      if (t.spicka > t.tloustka) pridej('info', 'Špička je silnější než rameno – použije se tloušťka ramene.', 'telo.spicka');
      if (t.spicka < 1.2) pridej('varovani', `Špička ${fmt(t.spicka)} mm je křehká – tiskněte aspoň 1,2 mm.`, 'telo.spicka');
    }
    if (o.zaobleni < p.telo.zaobleni - 1e-9) pridej('info', `Zaoblení hran sníženo na ${fmt(o.zaobleni, 2)} mm – větší by umazalo tenkou špičku.`, 'telo.zaobleni');
    if (o.boule > 0.3 && !o.zeSkici) pridej('info', `Kolem ${o.kloub ? 'kloubu' : o.zarez ? 'zářezu' : 'oka'} je rameno zesílené o ${fmt(o.boule)} mm, aby zbyla aspoň ${fmt(Math.max(2.5, 0.4 * t.tloustka))} mm silná stěna.`);
    // tloušťka ramen
    let tmin = Infinity, xmin = 0;
    for (let x = Math.max(2, o.x0 + 2); x < o.L - 1; x += 0.5) for (const s of [1, -1]) {
      const q = o.plochy(s, x); if (!q) continue;
      const tl = Math.abs(q.vne - q.vni); if (tl < tmin) { tmin = tl; xmin = x; }
    }
    if (tmin < 1.5) pridej('chyba', `Rameno je v ${fmt(xmin)} mm od špičky tenké jen ${fmt(tmin)} mm – praskne.`, 'telo.tloustka');
    else if (tmin < 2.5) pridej('varovani', `Nejtenčí místo ramene ${fmt(tmin)} mm (v ${fmt(xmin)} mm) – drží, ale pruží.`, 'telo.tloustka');
    if (o.zeSkici) {
      for (const [jm, s] of [['horní', 1], ['dolní', -1]]) {
        let dot = 0;
        for (let x = o.Lc * 0.2; x <= o.Lc * 0.8; x += 0.5) { const q = o.plochy(s, x); if (q && Math.abs(q.vni) - o.posun < 0.25) dot++; }
        if (!dot) pridej('varovani', `Skica: ${jm} čelist nedosedá do roviny y = 0 – kolíček nebude svírat. Vnitřní plochu čelisti táhněte na čáru dosednutí.`, 'skica.zapnuta');
      }
    }
    // čelisti
    const zb = o.celist && o.celist.typ === 'zuby' ? o.celist : null;
    if (zb && zb.h > Math.max(0.4, 0.45 * Math.min(t.spicka, t.tloustka))) pridej('varovani', `Zoubky ${fmt(o.zuby.h)} mm jsou na tenkou špičku hluboké.`, 'celisti.hloubka');
    for (const s of [o.snura2].filter(Boolean)) {
      if (s.x - s.r < o.snura.x + o.snura.r + 1) pridej('chyba', 'Druhý otvor na šňůru se překrývá s prvním – posuňte ho dál od špičky.', 'celisti.snuraPoloha2');
      if (s.x + s.r > o.xp - o.rRez - 0.8) pridej('chyba', `Druhý otvor Ø ${fmt(2 * s.r)} zasahuje do opěrného bodu – zmenšete ho nebo posuňte.`, 'celisti.snura2', 'celisti.snuraPoloha2');
      for (const sg of [1, -1]) { const q = o.plochy(sg, s.x); if (q && Math.abs(q.vne) - s.r < 1.4) { pridej('chyba', `Nad druhým otvorem na šňůru zbývá jen ${fmt(Math.max(0, Math.abs(q.vne) - s.r))} mm materiálu.`, 'celisti.snura2'); break; } }
    }
    if (o.snura) {
      const s = o.snura;
      if (s.x - s.r < 1) pridej('chyba', 'Drážka na šňůru zasahuje do špičky.', 'celisti.snuraPoloha');
      if (s.x + s.r > o.xp - o.rRez - 0.8) pridej('chyba', `Drážka na šňůru Ø ${fmt(2 * s.r)} zasahuje do ${o.kloub ? 'kloubu' : 'zářezu pružiny'} – zmenšete ji nebo posuňte čep dál.`, 'celisti.snuraPrumer', 'telo.cep');
      for (const sg of [1, -1]) { const q = o.plochy(sg, s.x); if (q && Math.abs(q.vne) - s.r < 1.4) { pridej('chyba', `Nad drážkou na šňůru zbývá jen ${fmt(Math.max(0, Math.abs(q.vne) - s.r))} mm materiálu.`, 'celisti.snuraPrumer'); break; } }
    }
    if (o.magnet) {
      const g = o.magnet, q = o.plochy(g.s, g.x);
      if (!q) pridej('chyba', 'Kapsa na magnet leží mimo rameno.', 'celisti.magnetPoloha');
      else {
        const tl = Math.abs(q.vne - q.vni);
        if (g.h > tl - 0.8) pridej('chyba', `Magnet ${fmt(2 * g.r - 0.2)} × ${fmt(g.h - 0.2)} mm se do ramene silného ${fmt(tl)} mm nevejde.`, 'celisti.magnetVyska', 'celisti.magnetPoloha');
        if (2 * g.r > o.W - 1.2) pridej('chyba', `Magnet Ø ${fmt(2 * g.r - 0.2)} je širší než kolíček (${fmt(o.W)} mm).`, 'celisti.magnetPrumer', 'telo.sirka');
        if (Math.abs(g.x - o.xp) < g.r + o.rRez + 0.5) pridej('varovani', 'Kapsa na magnet je těsně u čepu – oslabí rameno; posuňte ji.', 'celisti.magnetPoloha');
      }
    }
    // pružiny
    const d = o.drat;
    if (p.pruzina === 'kov_drevo' || p.pruzina === 'kov_trmen') {
      if (o.nohy.some(n => n.chybi)) pridej('chyba', `Nohy pružiny (${fmt(d.noha)} mm) jsou delší než čelist – přesahují špičku. Posuňte čep dál od špičky.`, 'kov.noha', 'telo.cep');
      const hl = o.zarez.r - t.mezeraCep / 2;
      if (hl < d.D / 4) pridej('varovani', `Zářezy pro cívku jsou mělké (${fmt(Math.max(0, hl))} mm) – cívka může vyskočit. Zmenšete mezeru u čepu.`, 'telo.mezeraCep');
      if (t.mezeraCep > d.D - 2 * d.d) pridej('chyba', `Mezera u čepu ${fmt(t.mezeraCep)} mm je větší než cívka – ramena by se nemohla o cívku opřít.`, 'telo.mezeraCep');
      if (d.delka > o.W + 0.5) pridej('varovani', `Cívka (${fmt(d.delka)} mm) je delší než šířka kolíčku – bude přečnívat.`, 'telo.sirka');
      if (p.pruzina === 'kov_trmen' && d.delka < o.W - 3) pridej('info', `Cívka (${fmt(d.delka)} mm) je o dost kratší než šířka ${fmt(o.W)} mm – nohy povedou k bokům šikmo; u plastových kolíčků bývá přes celou šířku.`, 'kov.zavitu');
    }
    if (p.pruzina === 'kov_plast') {
      if (o.nohy.some(n => n.chybi)) pridej('chyba', `Nohy pružiny (${fmt(d.noha)} mm) nedosáhnou na rukojeti – prodlužte kolíček.`, 'kov.noha', 'telo.delka');
      if (d.Di < o.kloub.d + 0.15) pridej('chyba', `Čep Ø ${fmt(o.kloub.d, 2)} se do cívky (vnitřní Ø ${fmt(d.Di, 2)}) nevejde – zmenšete čep.`, 'cep.prumer', 'kov.prumer');
      const z = o.kloub.zony;
      if (z.U[1] - z.U[0] < 2) pridej('chyba', `Na kloub vedle cívky zbývá jen ${fmt(Math.max(0, z.U[1] - z.U[0]))} mm – rozšiřte kolíček.`, 'telo.sirka');
    }
    if (d && o.dr.kov && d.Dm / d.d < 3) pridej('chyba', `Drát Ø ${fmt(d.d, 2)} je na pružinu Ø ${fmt(d.D, 1)} moc silný (poměr ${fmt(Math.max(0, d.Dm / d.d), 1)}, vinout jde od 3) – zvětšete průměr nebo ztenčete drát.`, 'kov.drat', 'kov.prumer');
    if (d && o.dr.kov && m.znam && d.Dm / d.d >= 2.5) {
      if (m.predpeti <= 0) pridej('chyba', `Pružina nemá předpětí (${fmt(m.predpeti / RAD, 0)}°) – kolíček by nedržel. ${p.pruzina !== 'kov_plast' ? 'Volný úhel nohou musí být menší než úhel v kolíčku' : 'Volný úhel nohou musí být větší než úhel v kolíčku'} (${fmt(m.montaz / RAD, 0)}°).`, 'kov.volnyUhel');
      if (m.predpeti <= 0) oprav(`volný úhel ${fmt(Math.round((m.montaz / RAD + (p.pruzina !== 'kov_plast' ? -25 : 25))), 0)}°`, { 'kov.predloha': 'vlastni', 'kov.volnyUhel': Math.round(m.montaz / RAD + (p.pruzina !== 'kov_plast' ? -25 : 25)) });
      if (m.sigma(m.thetaMax) > SIGMA_DRAT) pridej('varovani', `Při plném otevření je drát namáhán ${fmt(m.sigma(m.thetaMax), 0)} MPa – pružina se trvale ohne.`, 'kov.volnyUhel');
    }
    if (o.kloub) {
      const k = o.kloub;
      if (p.cep.druh === 'filament' && p.cep.vule < 0.05) pridej('info', 'Filament potřebuje otvor aspoň o 0,1 mm větší (vůle 0,05 mm na stranu).', 'cep.vule');
      if (k.rDiraL >= k.rDiraU && p.cep.druh !== 'filament') pridej('info', 'Čep drží v obou ramenech volně – zajistěte ho lepidlem nebo zatavením konců.', 'cep.lis');
    }
    if (p.pruzina === 'omega') {
      const q = o.oko;
      if (q.R - q.t / 2 < q.hrot * 2 + q.mezera + 0.5) pridej('chyba', 'Oko je moc malé na opěrné hroty uvnitř – zvětšete poloměr.', 'omega.polomer');
      if (q.mezera < 0.3) { pridej('varovani', `Mezera ${fmt(q.mezera, 2)} mm – při tisku se ramena mohou slít. Bezpečně 0,3–0,5 mm.`, 'omega.mezera'); oprav('mezera 0,4 mm', { 'omega.mezera': 0.4 }); }
    }
    for (const [jm, x] of [['jazyk', 'jazycek'], ['vpruz', 'listova'], ['had', 'meandr'], ['guma', 'gumicka'], ['vinuta', 'tlacna'], ['tpu', 'tpu'], ['dratU', 'dratU'], ['pasek', 'pasek'], ['ocka', 'ocka'], ['oblouk', 'oblouk']]) {
      if (o[jm] && o[jm].chybi && o[jm].nizky) pridej('chyba', 'Mezi rukojeťmi není pro oblouk místo na výšku – zvětšete rozevření rukojetí nebo ztenčete oblouk.', 'telo.rozevreni', 'oblouk.tloustkaOblouku');
      else if (o[jm] && o[jm].chybi) pridej('chyba', `Pružina (${DRUHY[x].nazev.toLowerCase()}) se mezi rukojeti nevejde – prodlužte kolíček nebo ji zkraťte.`, 'telo.delka');
    }
    if (o.jazyk && !o.jazyk.chybi) {
      const j = o.jazyk;
      if (j.xk > o.rukojetDo - 2) pridej('chyba', 'Jazýček přesahuje konec rukojeti – zkraťte ho.', 'jazycek.delka');
      if (j.zdvih <= j.predpeti) pridej('chyba', 'Jazýček nemá kam ustoupit – mezera mezi rukojeťmi je menší než jeho předpětí.', 'jazycek.predpeti', 'telo.rozevreni');
      const zbyv = o.vne(-1, j.xr + 1) - (o.vni(-1, j.xr + 1) + j.hl);
      if (zbyv < 1.5) pridej('chyba', `Pod kapsou jazýčku zbývá jen ${fmt(Math.max(0, zbyv))} mm ramene.`, 'jazycek.tloustka', 'telo.tloustka');
    }
    if (o.vpruz && !o.vpruz.chybi) {
      if (o.vpruz.xk + o.vpruz.kapsa / 2 > o.rukojetDo - 1.5) pridej('chyba', 'V pružina přesahuje rukojeti – zkraťte ji.', 'listova.delka');
      if (o.vpruz.sevreni <= 0) pridej('chyba', 'Mezi rukojeťmi není pro V pružinu místo – zvětšete rozevření rukojetí.', 'telo.rozevreni');
    }
    if (o.had && !o.had.chybi) {
      const h = o.had;
      if (h.roztec < h.t + 0.4) pridej('chyba', `Závity hadovité pružiny jsou nahusto (rozteč ${fmt(h.roztec, 2)} mm) – slijí se. Uberte závity nebo zvětšete rozevření.`, 'meandr.zavitu', 'telo.rozevreni');
      if (h.xk + h.b / 2 > o.rukojetDo - 2) pridej('chyba', 'Hadovitá pružina přesahuje konec rukojeti – zmenšete její šířku.', 'meandr.sirka');
    }
    if (o.guma && !o.guma.chybi) {
      const g = o.guma, e0 = m.eps ? m.eps(0) : 1;
      if (g.xb + g.cs > o.xp - o.rRez - 1) pridej('chyba', 'Gumička leží za čepem – musí obepínat čelisti (poloha blíž ke špičce).', 'gumicka.poloha');
      if (g.xb - g.cs < 0.5) pridej('chyba', 'Gumička by sklouzla ze špičky – posuňte ji dál.', 'gumicka.poloha');
      if (e0 <= 0.03) pridej('chyba', `O‑kroužek vnitřní Ø ${fmt(g.ID)} je volný – nebude svírat. Doporučeno ${fmt(g.doporuc)} mm.`, 'gumicka.vnitrni');
      if (e0 <= 0.03) oprav(`O‑kroužek Ø ${fmt(g.doporuc)}`, { 'gumicka.vnitrni': g.doporuc });
      else if (m.eps && m.eps(m.thetaMax) > 0.8) pridej('varovani', `Gumička se při otevření natáhne o ${fmt(100 * m.eps(m.thetaMax), 0)} % – brzy praskne. Doporučený vnitřní Ø ${fmt(g.doporuc)} mm.`, 'gumicka.vnitrni');
      if (e0 > 0.03 && m.eps && m.eps(m.thetaMax) > 0.8) oprav('navrhnout gumičku', null, 'navrh');
    }
    if (o.vinuta && !o.vinuta.chybi) {
      const v = o.vinuta;
      if (v.Dm / v.d < 3) pridej('chyba', `Drát Ø ${fmt(v.d, 2)} je na pružinu Ø ${fmt(v.D, 1)} moc silný (poměr ${fmt(Math.max(0, v.Dm / v.d), 1)}, vinout jde od 3).`, 'tlacna.drat', 'tlacna.prumer');
      if (v.D + 0.6 > o.W - 1.2) pridej('chyba', `Pružina Ø ${fmt(v.D)} se do kolíčku širokého ${fmt(o.W)} mm nevejde.`, 'tlacna.prumer', 'telo.sirka');
      if (v.hs > Math.min(v.tlU, v.tlL) - 1) pridej('chyba', `Jamka ${fmt(v.hs)} mm by prorazila rameno (silné ${fmt(Math.min(v.tlU, v.tlL))} mm).`, 'tlacna.hloubka');
      if (v.L0 <= v.Li) {
        pridej('chyba', `Pružina (${fmt(v.L0)} mm) je kratší než mezera mezi dny jamek (${fmt(v.Li)} mm) – netlačí.`, 'tlacna.delka', 'tlacna.hloubka');
        const hs = v.hs - (v.Li - v.L0) / 2 - 1;
        if (hs >= 1) oprav(`jamky ${fmt(hs)} mm`, { 'tlacna.hloubka': Math.round(hs * 10) / 10 });
      } else if (v.Li < 1.05 * v.Ls) { pridej('chyba', `Pružina by byla stlačená na doraz (mezera ${fmt(v.Li)} mm, závity na sobě ${fmt(v.Ls)} mm) – posuňte ji ke konci rukojeti nebo změlčete jamky.`, 'tlacna.poloha', 'tlacna.hloubka'); oprav('navrhnout polohu', null, 'navrh'); }
      if (v.hs < 1.5) pridej('varovani', `Jamky jsou mělké (${fmt(v.hs)} mm) – pružina může vyskočit.`, 'tlacna.hloubka');
      if (v.L0 / v.Dm > 4) pridej('info', 'Dlouhá štíhlá pružina by se volně vybočila – jamky ji vedou, nechte je co nejhlubší.', 'tlacna.hloubka');
    }
    if (o.ocka && !o.ocka.chybi) {
      const q = o.ocka;
      if (q.hrI - 2 * q.t < 0.8) { pridej('chyba', `Očka jsou na tloušťku ${fmt(q.t, 2)} mm moc nízká (${fmt(q.hrI, 1)} mm) – uberte očka nebo zvětšete rozevření rukojetí.`, 'ocka.pocet', 'telo.rozevreni'); if (q.n > 1) oprav(`${q.n - 1} očka`, { 'ocka.pocet': q.n - 1 }); }
      if (q.xk + q.w / 2 + q.t > o.rukojetDo - 1) pridej('chyba', 'Očka přesahují konec rukojeti – zmenšete jejich šířku nebo je posuňte ke kloubu.', 'ocka.sirka', 'ocka.poloha');
      if (q.tvar !== 'kruh' && q.w < q.hr * 0.6) pridej('info', 'Úzká očka se při stisku vybočí do strany – raději širší než vyšší.', 'ocka.sirka');
    }
    if (o.oblouk && !o.oblouk.chybi) {
      const q = o.oblouk;
      if (q.zdvih <= q.predpeti) pridej('chyba', 'Rameno oblouku nemá kam ustoupit – zmenšete předpětí nebo zvětšete rozevření rukojetí.', 'oblouk.predpeti', 'telo.rozevreni');
      if (q.koliduje) pridej('chyba', 'Oblouk se háčku nevyhne ani zploštělý – háček skloňte ven, prodlužte jeho rovnou část nebo dejte háček na druhé rameno.', 'hacek.uhel', 'hacek.delka', 'hacek.rameno');
      else if (q.zplosteni < 0.999) pridej('info', q.tvar === 'smycka' ? `Smyčka je kvůli háčku zmenšená na ${fmt(100 * q.zplosteni, 0)} %.` : `Oblouk je kvůli háčku zploštělý do elipsy (na ${fmt(100 * q.zplosteni, 0)} % přesahu).`, 'oblouk.presah');
      if (q.posun) pridej('info', 'Kořen oblouku je posunutý k vnitřní straně ramene, aby háček vycházel vedle něj.', 'hacek.rameno');
      if (p.hacek.zapnuty && p.hacek.smer === 'dovnitr' && p.hacek.rameno === q.rameno) pridej('chyba', 'Háček ohnutý dovnitř by vedl skrz oblouk – ohněte ho ven.', 'hacek.smer');
      // smyčka nesmí zasáhnout do druhého ramene
      const druhe = o.obrys[q.rameno === 'dolni' ? 'horni' : 'dolni'];
      if (q.neplatna) pridej('chyba', 'Smyčku s tímto poloměrem nejde napojit (kořen nebo volné rameno leží uvnitř kružnice) – zmenšete poloměr nebo zvětšete přesah.', 'oblouk.polomer', 'oblouk.presah');
      const vlastni = o.obrys[q.rameno];
      const koren = q.osa[q.osa.length - 1];
      if (q.tvar === 'smycka' && q.osa.slice(17).some(b => Math.hypot(b[0] - koren[0], b[1] - koren[1]) > 2 * q.tb + 3.5 && (uvnitr2(vlastni, b[0], b[1]) || vzdalObrys(vlastni, b[0], b[1]) < b[2] / 2 + 0.2)))
        pridej('chyba', 'Smyčka zasahuje do vlastního ramene – posuňte ji víc za konec (přesah) nebo zmenšete posun ven.', 'oblouk.presah', 'oblouk.posun');
      // volné rameno v sestavě (sklopené na druhou rukojeť) nesmí vést skrz ni – dotýká se jen koncem
      const ramenoSestava = q.osa.slice(4, 17).map((b, i) => { const u = (i + 4) / 16; return [b[0], q.yK + u * (q.y0 - q.yK), b[2]]; });
      if (ramenoSestava.some(b => uvnitr2(druhe, b[0], b[1]) || vzdalObrys(druhe, b[0], b[1]) < b[2] / 2 - 0.05)) pridej('chyba', 'Volné rameno oblouku vede skrz druhou rukojeť – zmenšete posun ven nebo poloměr smyčky, případně prodlužte rameno.', 'oblouk.posun', 'oblouk.polomer', 'oblouk.delka');
      if (q.osa.slice(17).some(b => uvnitr2(druhe, b[0], b[1]) || vzdalObrys(druhe, b[0], b[1]) < b[2] / 2 + 0.2)) pridej('chyba', 'Oblouk zasahuje do druhého ramene – zmenšete poloměr nebo přesah.', 'oblouk.polomer', 'oblouk.presah');
      if (q.rMin < q.tb * 1.5) pridej('varovani', `Oblouk je na svou tloušťku moc sevřený (nejmenší poloměr ${fmt(q.rMin, 1)} mm, tloušťka ${fmt(q.tb, 1)} mm) – v ohybu praskne; ztenčete ho nebo zvětšete poloměr či přesah.`, 'oblouk.tloustkaOblouku', 'oblouk.polomer');
      if (q.b < o.W && q.b < 3) pridej('varovani', `Úzký oblouk (${fmt(q.b, 1)} mm) se při stisku vykroutí do strany.`, 'oblouk.sirka');
      if (q.presah > 25) pridej('info', `Oblouk přečnívá ${fmt(q.presah, 0)} mm za konec rukojeti.`, 'oblouk.presah');
    }
    if (o.tpu && !o.tpu.chybi) {
      if (o.tpu.D + 0.8 > o.W - 1.2) pridej('chyba', `Váleček Ø ${fmt(o.tpu.D)} je širší než kolíček.`, 'tpu.prumer');
      if (o.tpu.predpeti <= 0) pridej('info', 'Váleček bez předpětí – čelisti začnou svírat až látkou.', 'tpu.predpeti');
      if (o.tpu.hs > Math.min(o.tpu.tlU, o.tpu.tlL) - 1) pridej('chyba', `Jamka ${fmt(o.tpu.hs)} mm by prorazila rameno.`, 'tpu.hloubka');
    }
    if (o.dratU && !o.dratU.chybi) {
      if (o.dratU.xk > o.rukojetDo - 1.5) pridej('chyba', 'U sponka přesahuje rukojeti – zkraťte ramínka.', 'dratU.delka');
      if (o.dratU.sevreni <= 0) pridej('chyba', 'Mezi rukojeťmi není pro U sponku místo – zvětšete rozevření rukojetí nebo zmenšete ohyb.', 'telo.rozevreni', 'dratU.ohyb');
    }
    if (o.pasek && !o.pasek.chybi) {
      const v = o.pasek;
      if (v.xz > o.rukojetDo - 1.5) pridej('chyba', 'Pásek se štěrbinou přesahuje dolní rukojeť – zkraťte ho nebo zasunutí.', 'pasek.delka', 'pasek.zasunuti');
      if (v.zbyva < 1.2) pridej('chyba', `Štěrbina pro pásek by prorazila spodek ramene (zbývá ${fmt(Math.max(0, v.zbyva))} mm) – zkraťte zasunutí nebo zesilte rameno.`, 'pasek.zasunuti', 'telo.tloustka');
      if (v.b > o.W - 1.2) pridej('chyba', `Pásek ${fmt(v.b)} mm je moc široký – štěrbina potřebuje stěny (kolíček ${fmt(o.W)} mm).`, 'pasek.sirka');
      if (v.zdvih <= v.predpeti) pridej('chyba', 'Pásek nemá kam ustoupit – zmenšete předpětí nebo zvětšete rozevření rukojetí.', 'pasek.predpeti', 'telo.rozevreni');
    }
    if (o.celist && o.celist.zmirneno) pridej('info', `Zoubky jsou snížené na ${fmt(o.celist.h, 2)} mm, aby měly zaoblené boky do 45° a látka po nich klouzala bez zadrhnutí; vyšší zuby chtějí méně zubů.`, 'celisti.hloubka', 'celisti.pocet');
    if (o.celist && o.celist.typ === 'kapsa') {
      const q = o.plochy(1, (o.celist.od + o.celist.do) / 2), q2 = o.plochy(-1, (o.celist.od + o.celist.do) / 2);
      const tl = Math.min(q ? Math.abs(q.vne - q.vni) : 0, q2 ? Math.abs(q2.vne - q2.vni) : 0);
      if (o.celist.h > tl - 1.2) pridej('chyba', `Kapsa na vložku ${fmt(o.celist.h)} mm je v čelisti silné ${fmt(tl)} mm moc hluboká.`, 'celisti.hloubka');
    }
    if (o.otvor) for (const q of o.otvor) if (!q.chybi && q.stena < 1.2) {
      pridej('chyba', `Kolem otvoru na konci ramene zbývá jen ${fmt(Math.max(0, q.stena))} mm.`, 'telo.otvorKonec');
      const d = Math.floor((2 * q.r + 2 * q.stena - 2.6) * 2) / 2;
      if (d >= 1.5) oprav(`otvor Ø ${fmt(d)}`, { 'telo.otvorKonec': d });
      break;
    }
    if (p.telo.odlehceni && o.odlehceni && !o.odlehceni.length) pridej('info', 'Na odlehčení není v rukojetích místo (tenká ramena nebo samé pružiny a otvory).', 'telo.odlehceni');

    // mechanika
    const deg = th => fmt(th / RAD, 1);
    if (m.thetaGeom < 3 * RAD) {
      pridej('chyba', `Kolíček se otevře jen o ${deg(m.thetaGeom)}° (${fmt(m.otevreni(m.thetaGeom))} mm) – zvětšete rozevření rukojetí.`, 'telo.rozevreni');
      if (!o.zeSkici) oprav(`rozevření ${fmt(Math.ceil(p.telo.rozevreni * 1.6), 0)} mm`, { 'telo.rozevreni': Math.min(40, Math.ceil(p.telo.rozevreni * 1.6)) });
    } else if (m.otevreni(m.thetaGeom) < 4) pridej('varovani', `Čelisti se rozevřou jen na ${fmt(m.otevreni(m.thetaGeom))} mm – na silnější látku málo.`, 'telo.rozevreni');
    if (Number.isFinite(m.thetaMat) && o.dr.tistena) pridej('varovani', `Tištěná pružina vydrží bez únavy rozevření jen ${deg(m.thetaMat)}° z ${deg(m.thetaGeom)}° – při plném stisku je ${fmt(m.sigma(m.thetaGeom), 0)} MPa (${mat.nazev} ≈ ${mat.cyklus} MPa). Ztenčete ji nebo prodlužte.`,
      p.pruzina === 'omega' ? 'omega.tloustka' : p.pruzina + '.tloustka');
    if (Number.isFinite(m.thetaMat) && o.dr.tistena) oprav('navrhnout pružinu', null, 'navrh');
    if (Number.isFinite(m.thetaMat) && ['tlacna', 'dratU', 'pasek', 'tpu'].includes(p.pruzina)) {
      const j = m.jednotka === '%' ? ' %' : ' MPa';
      pridej('varovani', `Pružina (${m.material}) je při plném otevření přetížená: ${fmt(m.sigma(m.thetaGeom), 0)}${j}, trvale snese ${fmt(m.dov, 0)}${j} – vydrží jen ${deg(m.thetaMat)}° z ${deg(m.thetaGeom)}°.`,
        p.pruzina + '.' + ({ tlacna: 'poloha', dratU: 'drat', pasek: 'tloustka', tpu: 'prumer' })[p.pruzina]);
      oprav('navrhnout pružinu', null, 'navrh');
    }
    if (o.dr.tistena && p.tisk.material === 'PLA') { pridej('varovani', 'Pružina z PLA časem povolí (tečení) – použijte PETG nebo nylon.', 'tisk.material'); oprav('PETG', { 'tisk.material': 'PETG' }); }
    if (m.Fsevreni < 1.5 && !(p.pruzina === 'omega' && p.tisk.latka <= o.oko.mezera)) pridej(o.dr.tistena ? 'info' : 'varovani', `Sevření ${fmt(m.Fsevreni)} N je slabé – udrží jen lehké prádlo.`, p.pruzina === 'omega' ? 'omega.tloustka' : 'telo.cep');
    if (m.Fsevreni < 1.5 && o.dr.tistena && !Number.isFinite(m.thetaMat) && !(p.pruzina === 'omega' && p.tisk.latka <= o.oko.mezera)) oprav('navrhnout silnější pružinu', null, 'navrh');
    if (p.pruzina === 'omega' && p.tisk.latka <= o.oko.mezera) pridej('info', `Látka do ${fmt(o.oko.mezera, 2)} mm projde mezerou mezi čelistmi bez sevření (jednodílný kolíček nemá předpětí).`, 'tisk.latka');
    if (m.Fprsty > 45) pridej('varovani', `Na plné otevření je potřeba ${fmt(m.Fprsty, 0)} N na rukojeti – ztuha (pohodlně do ≈ 30 N).`);
    if (m.sigmaRamene > m.dovRamene) pridej('chyba', `Rameno u ${o.kloub ? 'kloubu' : 'osy'} je přetížené (${fmt(m.sigmaRamene, 0)} MPa, ${mat.nazev} snese ≈ ${fmt(m.dovRamene, 0)} MPa) – zesilte ho.`, 'telo.tloustka');
    if (m.sigmaRamene > m.dovRamene && !o.zeSkici) {
      // odhad z σ ~ 1/h²: potřebná výška průřezu, pak ověřit nejvýš třemi přepočty
      const cesta = m.slabsiDolni && p.telo.tloustkaDolni > 0 ? 'telo.tloustkaDolni' : 'telo.tloustka', T0 = vezmi(p, cesta) || p.telo.tloustka;
      const dh = m.ramenoH > 0 ? m.ramenoH * (Math.sqrt(m.sigmaRamene / (0.9 * m.dovRamene)) - 1) : 2;
      let T = Math.ceil((T0 + Math.max(0.25, dh)) * 4) / 4;
      for (let i = 0; i < 3 && T <= ROZSAHY[cesta][1]; i++, T += 0.5) {
        const q = kopie(p); poloz(q, cesta, T); const mq = odvozene(q).mech;
        if (mq.sigmaRamene <= mq.dovRamene * 0.95) { oprav(`rameno ${fmt(T, 2)} mm`, { [cesta]: T }); break; }
      }
    }
    // háček
    if (o.hacek) {
      const h = o.hacek;
      if (h.chybi) pridej('chyba', 'Háček nemá kde začít – konec ramene nebyl nalezen.', 'hacek.zapnuty');
      else {
        const druhe = o.obrys[h.rameno === 'horni' ? 'dolni' : 'horni'];
        const koliduje = th => h.body.some(b => {
          const r = rotace(b, [o.xp, 0], -h.s * th);      // rameno s háčkem se otáčí proti druhému
          return uvnitr2(druhe, r[0], r[1]) || vzdalObrys(druhe, r[0], r[1]) < h.t / 2 + 0.3;
        });
        if (koliduje(0)) { pridej('chyba', 'Háček zasahuje do druhého ramene – otočte ho ven nebo prodlužte rovnou část.', 'hacek.smer', 'hacek.delka'); if (p.hacek.smer !== 'ven') oprav('ohnout ven', { 'hacek.smer': 'ven' }); }
        else if (koliduje(m.thetaMax)) pridej('varovani', 'Při stisku narazí háček na druhé rameno a kolíček se neotevře naplno.', 'hacek.smer', 'hacek.delka');
        if (h.t > 2 * (h.rIn != null ? h.rIn : p.hacek.prumer / 2)) pridej('info', 'Háček je silnější než jeho otvor.', 'hacek.tloustka');
        if (p.hacek.zatizeni > h.nosnost) pridej('varovani', `Háček unese asi ${fmt(h.nosnost, 1)} kg, chcete ${fmt(p.hacek.zatizeni, 1)} kg – zesilte ho.`, 'hacek.tloustka', 'hacek.zatizeni');
        if (h.tvar === 'klip') {
          if (h.otvorKlipu >= p.hacek.prumer) pridej('varovani', `Otvor klipu ${fmt(h.otvorKlipu, 1)} mm je stejně velký jako tyč Ø ${fmt(p.hacek.prumer)} – nebude držet; zmenšete ho.`, 'hacek.otvor');
          else if (h.otvorKlipu < 0.6 * p.hacek.prumer) pridej('varovani', `Otvor klipu ${fmt(h.otvorKlipu, 1)} mm je na tyč Ø ${fmt(p.hacek.prumer)} úzký – klip praskne při nasazování.`, 'hacek.otvor');
          else pridej('info', `Klip má mezi zaoblenými konci otvor ${fmt(h.otvorKlipu, 1)} mm – na tyč Ø ${fmt(p.hacek.prumer)} se nacvakne.`, 'hacek.otvor');
        }
      }
    }
    if (o.W > 24 && p.pruzina === 'kov_drevo') pridej('info', 'Široký kolíček s jednou pružinou – nohy tlačí jen uprostřed čelisti.');
    return H;
  }

  /* ---------- návrh tištěné pružiny / gumičky ---------- */
  // prohledávaný prostor: [od, do, krok]
  const PROSTOR = {
    omega: { 'omega.tloustka': [0.5, 1.8, 0.05], 'omega.polomer': [4, 10, 0.5] },
    jazycek: { 'jazycek.zuzeni': [0, 1, 1], 'jazycek.tloustka': [0.6, 1.8, 0.1], 'jazycek.delka': [12, 44, 2], 'jazycek.predpeti': [0.5, 3.5, 0.5] },
    listova: { 'listova.zuzeni': [0, 1, 1], 'listova.tloustka': [0.6, 1.8, 0.1], 'listova.delka': [12, 40, 2], 'listova.predpeti': [0.5, 4, 0.5] },
    meandr: { 'meandr.tloustka': [0.5, 1.2, 0.1], 'meandr.zavitu': [2, 7, 1], 'meandr.sirka': [6, 20, 2], 'meandr.predpeti': [0.5, 3.5, 1] },
    gumicka: { 'gumicka.prurez': [1.5, 3, 0.5], 'gumicka.vnitrni': [3, 40, 0.5] },
    ocka: { 'ocka.tloustka': [0.5, 1.6, 0.15], 'ocka.sirka': [6, 18, 4], 'ocka.pocet': [1, 3, 1], 'ocka.poloha': [0, 1, 0.5], 'ocka.predpeti': [0.5, 3.5, 1] },
    oblouk: { 'oblouk.tloustkaOblouku': [0, 2.5, 0.5], 'oblouk.zuzeni': [0, 1, 1], 'oblouk.tloustka': [0.6, 2.2, 0.1], 'oblouk.delka': [12, 40, 4], 'oblouk.predpeti': [0.5, 4, 0.5] },
    tlacna: { 'tlacna.poloha': [0, 1, 0.05], 'tlacna.hloubka': [0, 6, 0.5] },
    dratU: { 'dratU.drat': [0.6, 2, 0.1], 'dratU.delka': [12, 40, 2], 'dratU.predpeti': [1, 6, 1] },
    pasek: { 'pasek.tloustka': [0.15, 0.8, 0.05], 'pasek.delka': [10, 40, 2], 'pasek.predpeti': [0.5, 3, 0.5] },
    tpu: { 'tpu.prumer': [3, 8, 1], 'tpu.stena': [0, 1, 1], 'tpu.poloha': [0, 0.6, 0.15], 'tpu.predpeti': [0.2, 1.4, 0.4] },
  };
  /** Nejsilnější sevření, které pružina vydrží bez únavy, otevře kolíček aspoň na 75 % meze rukojetí (nebo jako dosud) a jde stisknout (prsty ≤ 35 N).
      Vrací {p, F, F0, zmeny: [[cesta, stará, nová]]} nebo null. */
  function navrhniPruzinu(p0) {
    const g = navrhniKroky(p0);
    for (;;) { const k = g.next(); if (k.done) return k.value; }
  }
  /** Totéž jako generátor: po dávkách vrací {hotovo, celkem}, aby stránka mohla průběžně kreslit (plné prohledání trvá u oblouku desítky sekund). */
  function* navrhniKroky(p0, davka = 150) {
    const prostor = PROSTOR[p0.pruzina];
    if (!prostor) return null;
    const cesty = Object.keys(prostor), o0 = odvozene(p0), F0 = o0.mech.Fsevreni;
    const osy = cesty.map(c => {
      const [a, b, k] = prostor[c], v = [];
      for (let x = a; x <= b + 1e-9; x += k) v.push(Math.round(x * 100) / 100);
      return v;
    });
    const celkem = osy.reduce((n, v) => n * v.length, 1), kandidati = [];
    for (let i = 0; i < celkem; i++) {
      const q = kopie(p0);
      for (let j = cesty.length - 1, r = i; j >= 0; j--) { poloz(q, cesty[j], osy[j][r % osy[j].length]); r = Math.floor(r / osy[j].length); }
      const n = normalizuj(q).p, o = odvozene(n), m = o.mech;
      if (i % davka === davka - 1) yield { hotovo: i + 1, celkem };
      if (!(m.thetaGeom >= Math.min(0.75 * m.thetaRukojeti, 0.98 * o0.mech.thetaGeom) && m.thetaGeom > 3 * RAD)) continue;
      if (m.sigma(m.thetaGeom) > m.dov || m.Fprsty > 35 || !(m.Fsevreni > 0)) continue;
      if (p0.pruzina === 'gumicka' && !(m.eps(0) > 0.05)) continue;
      kandidati.push({ p: n, F: m.Fsevreni });
    }
    kandidati.sort((a, b) => b.F - a.F);
    for (const k of kandidati.slice(0, 60)) {
      const H = kontroly(k.p, odvozene(k.p));
      if (H.some(h => h.uroven === 'chyba' || h.uroven === 'varovani')) continue;
      return { p: k.p, F: k.F, F0, zmeny: cesty.map(c => [c, vezmi(p0, c), vezmi(k.p, c)]).filter(z => Math.abs(z[1] - z[2]) > 1e-9) };
    }
    return null;
  }
  /** Přepne druh pružiny; u kovové vybere pružinu ze stejného druhu kolíčku. */
  function prepniDruh(p, druh) {
    p.pruzina = druh;
    if (druh === 'kov_drevo' && /^plast/.test(p.kov.predloha)) p.kov.predloha = 'drevo';
    if (druh === 'kov_plast' && /^(drevo|trmen)/.test(p.kov.predloha)) p.kov.predloha = 'plast';
    if (druh === 'kov_trmen') p.kov.predloha = 'trmen';
    if (druh === 'kov_drevo' && p.kov.predloha === 'trmen') p.kov.predloha = 'drevo';
    return p;
  }
  /** Stejný kolíček s každým druhem pružiny – pro srovnání. */
  function porovnejPruziny(p) {
    return Object.keys(DRUHY).map(druh => {
      const q = normalizuj(prepniDruh(kopie(p), druh)).p, o = odvozene(q), m = o.mech, H = kontroly(q, o);
      return { druh, Fs: m.Fsevreni, Fp: m.Fprsty, otevreni: m.otevreni(m.thetaMax), unava: Number.isFinite(m.thetaMat), dilu: o.dily.length,
        chyb: H.filter(h => h.uroven === 'chyba').length, varovani: H.filter(h => h.uroven === 'varovani').length };
    });
  }

  /* ---------- náhodný kolíček ---------- */
  /** Náhodný kolíček ze semínka: druh pružiny z vyladěné předvolby, náhodné tělo, čelisti, otvory, háček…
      Vrací jen kolíček bez chyb a varování (zkouší až 60 variant), jinak předvolbu. */
  function nahodnyKolicek(seminko) {
    let st = (seminko >>> 0) || 1;
    const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const mezi = (a, b) => a + (b - a) * rnd(), vyber = a => a[Math.floor(rnd() * a.length)], ano = pr => rnd() < pr, zaokr = (x, k = 0.5) => Math.round(x / k) * k;
    const druhy = Object.keys(DRUHY);
    for (let pokus = 0; pokus < 60; pokus++) {
      const druh = vyber(druhy);
      const kandidati = PREDVOLBY.map((v, i) => [v, i]).filter(([v]) => (v.p.pruzina || VYCHOZI.pruzina) === druh);
      const [pv, iv] = vyber(kandidati);
      const p = zPredvolby(iv), t = p.telo;
      void pv;
      t.delka = zaokr(t.delka * mezi(0.92, 1.12), 1); t.sirka = zaokr(mezi(8, 14), 0.5);
      t.tvar = vyber(Object.keys(TVARY)); t.vroubky = ano(0.5); t.konec = vyber(Object.keys(KONCE));
      t.otvorKonec = ano(0.25) ? zaokr(mezi(3, 5)) : 0; t.odlehceni = ano(0.3);
      t.vypouklost = ano(0.2) ? zaokr(mezi(0, 1.5), 0.1) : 0; t.prolis = ano(0.2) ? zaokr(mezi(0.5, 1.5), 0.1) : 0;
      t.tloustka = zaokr(t.tloustka + mezi(-0.3, 0.8), 0.1);
      const c = p.celisti;
      c.profil = vyber(Object.keys(PROFILY_CELISTI));
      c.hloubka = { rovne: 0.8, zuby: 0.6, vlnky: 0.7, drazka: 0.8, kulate: 1, zobak: 1.2, kapsa: 1 }[c.profil];
      c.pocet = c.profil === 'drazka' ? 1 + Math.floor(rnd() * 3) : 4 + Math.floor(rnd() * 4);
      c.nabeh = zaokr(mezi(0, 2.5), 0.1);
      if (ano(0.6)) { c.snura = true; c.snuraPrumer = zaokr(mezi(4, 7)); c.snura2 = ano(0.3) ? zaokr(mezi(2.5, 3.5), 0.1) : 0; } else c.snura = false;
      c.magnet = ano(0.1) ? vyber(['horni', 'dolni']) : 'zadny';
      const h = p.hacek;
      if (ano(0.35)) {
        Object.assign(h, { zapnuty: true, tvar: vyber(Object.keys(HACKY)), rameno: vyber(['horni', 'dolni']), smer: 'ven', prumer: zaokr(mezi(6, 25)),
          delka: zaokr(mezi(2, 10)), tloustka: zaokr(mezi(3.5, 4.5), 0.1), uhel: 0, sirka: ano(0.3) ? zaokr(mezi(5, 7)) : 0, hloubka: ano(0.3) ? zaokr(mezi(3, 10)) : 0 });
        if (druh === 'oblouk') h.rameno = p.oblouk.rameno === 'dolni' ? 'horni' : 'dolni';
      } else h.zapnuty = false;
      p.tisk.material = druh === 'tpu' ? 'PETG' : vyber(['PETG', 'PETG', 'ASA', 'PA']);
      const n = normalizuj(p).p, o = odvozene(n), H = kontroly(n, o);
      if (H.some(x => x.uroven === 'chyba' || x.uroven === 'varovani')) continue;
      n.nazev = `Náhodný kolíček ${seminko}`;
      return n;
    }
    return zPredvolby(0);
  }

  /* ---------- kusovník ---------- */
  function kusovnik(p, o) {
    const ks = p.tisk.kusu, out = [], d = o.drat;
    if (p.pruzina === 'kov_drevo') out.push({ ks, co: `Pružina z dřevěného kolíčku – drát Ø ${fmt(d.d, 2)}, cívka Ø ${fmt(d.D)}, ${fmt(d.n)} záv., nohy ${fmt(d.noha)} mm`, pozn: 'vyndejte ji ze starého kolíčku kleštěmi' });
    if (p.pruzina === 'kov_plast') out.push({ ks, co: `Pružina z plastového kolíčku – drát Ø ${fmt(d.d, 2)}, cívka Ø ${fmt(d.D)} (vnitřní ${fmt(d.Di, 1)}), nohy ${fmt(d.noha)} mm`, pozn: 'navlékne se na čep mezi ramena' });
    if (o.kloub) {
      const k = o.kloub, c = p.cep;
      if (c.druh === 'tisteny') out.push({ ks, co: `Tištěný čep Ø ${fmt(k.d, 2)} × ${fmt(o.W)} mm`, pozn: 'je v exportu; do dolního ramene jde ztuha' });
      else if (c.druh === 'filament') out.push({ ks, co: `Filament Ø 1,75 × ${fmt(o.W + 1)} mm`, pozn: 'konce zatavte páječkou nebo zapalovačem' });
      else if (c.druh === 'drat') out.push({ ks, co: `Drát / hřebík Ø ${fmt(k.d, 2)}, délka ${fmt(o.W)} mm`, pozn: 'zkrátit a začistit pilníkem' });
      else out.push({ ks, co: `Šroub Ø ${fmt(k.d, 1)} × ${fmt(Math.ceil(o.W))} mm (např. M${fmt(k.d, 0)} nebo vrut do plastu)`, pozn: 'v dolním rameni se zařízne' });
    }
    if (p.pruzina === 'kov_trmen') out.push({ ks, co: `Pružina s třmenem – drát Ø ${fmt(d.d, 2)}, cívka Ø ${fmt(d.D, 1)}, ${fmt(d.n)} záv., nohy ${fmt(d.noha)} mm`, pozn: 'z plastového kolíčku; cívka do zářezu v ose, nohy po bocích přes horní a spodní stranu do zářezů' });
    if (o.vinuta && !o.vinuta.chybi) out.push({ ks, co: `Tlačná pružina – drát Ø ${fmt(o.vinuta.d, 2)}, vnější Ø ${fmt(o.vinuta.D, 1)}, délka ${fmt(o.vinuta.L0)} mm, ${fmt(o.vinuta.n)} záv.`, pozn: 'z propisky nebo železářství; konce do jamek' });
    if (o.dratU && !o.dratU.chybi) out.push({ ks, co: `Pružinový drát Ø ${fmt(o.dratU.d, 2)} × ${fmt(Math.ceil(o.dratU.delkaDratu))} mm`, pozn: `ohnout do U (poloměr ${fmt(o.dratU.ra, 1)} mm) podle bočního profilu 1:1` });
    if (o.pasek && !o.pasek.chybi) out.push({ ks, co: `Pásek pružinové oceli ${fmt(o.pasek.t, 2)} × ${fmt(o.pasek.b, 1)} × ${fmt(Math.ceil(o.pasek.L + p.pasek.zasunuti + 1))} mm`, pozn: 'spárová měrka nebo pásek; zasunout do štěrbiny, kapka lepidla' });
    if (o.celist && o.celist.typ === 'kapsa') out.push({ ks: 2 * ks, co: `Gumová / korková vložka ${fmt(o.celist.do - o.celist.od - 1, 1)} × ${fmt(o.W, 1)} × ${fmt(o.celist.h + 0.4, 1)} mm`, pozn: 'vlepit do kapes čelistí, přečnívá 0,4 mm' });
    if (p.pruzina === 'gumicka' && o.guma && !o.guma.chybi) out.push({ ks, co: `O‑kroužek ${fmt(o.guma.ID)} × ${fmt(o.guma.cs, 1)} mm (NBR) nebo gumička`, pozn: `obvod drážky ${fmt(o.guma.obvod, 0)} mm, doporučeno ${fmt(o.guma.doporuc)} × ${fmt(o.guma.cs, 1)}` });
    if (o.magnet) out.push({ ks, co: `Magnet Ø ${fmt(2 * o.magnet.r - 0.2)} × ${fmt(o.magnet.h - 0.2)} mm (neodymový)`, pozn: 'vlepit vteřinovým lepidlem' });
    return out;
  }

  /* ---------- popis, projekt ---------- */
  /** Krátký souhrn; části se překládají zvlášť (celek by ve slovníku nebyl). */
  function popis(p) {
    const t = p.telo, tr = x => (typeof I18N !== 'undefined' && I18N.preloz ? I18N.preloz(x) : x);
    const druh = tr(DRUHY[p.pruzina].nazev), hacek = { hacek: 'háček', oko: 'oko', klip: 'klip' }[p.hacek.tvar];
    return `${fmt(t.delka)} × ${fmt(t.sirka)} mm, ${druh.charAt(0).toLowerCase() + druh.slice(1)}${p.hacek.zapnuty ? ', ' + tr(hacek) : ''}${p.skica.zapnuta ? ', ' + tr('tvar ze skici') : ''}`;
  }
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_kolicky', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || typeof o !== 'object') throw new Error('Soubor neobsahuje objekt projektu.');
    if (o.format !== 'webapp_kolicky') throw new Error('Soubor není projekt kolíčku (chybí "format": "webapp_kolicky").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    // ručně upravené rozměry pružiny v souboru = vlastní pružina (předloha by je tiše přepsala)
    const pr = o.projekt;
    if (pr && typeof pr === 'object') for (const [sek, tab, kl] of [['kov', KOVOVE, ['drat', 'prumer', 'zavitu', 'noha', 'volnyUhel']], ['tlacna', TLACNE, ['drat', 'prumer', 'delka', 'zavitu']]]) {
      const z = pr[sek], v = z && typeof z === 'object' ? tab[z.predloha] : null;
      if (v && v.drat && kl.some(k => z[k] != null && Number.isFinite(+z[k]) && Math.abs(+z[k] - v[k]) > 1e-9)) z.predloha = 'vlastni';
    }
    return normalizuj(o.projekt);
  }
  const tridaBezpecnosti = k => (k >= 2 ? 'ok' : k >= 1.2 ? 'mez' : 'chyba');

  const API = {
    VERZE_FORMATU, DATUM_DAT, RAD, DRUHY, KOVOVE, TLACNE, KONCE, SDILENA_PLOCHA, TVARY_OCEK, osaOcka, poddajnostOcka, konzola, zuzena, TVARY, PROFILY_CELISTI, CEPY, HACKY, MATERIALY, VYCHOZI, ROZSAHY, PREDVOLBY, E_OCEL, SIGMA_DRAT,
    kopie, cislo, fmt, vezmi, poloz, V, previsy, potrebujePodpory, odhadTisku,
    normalizuj, zPredvolby, odvozene, kontroly, kusovnik, nahodnyKolicek, navrhniPruzinu, navrhniKroky, porovnejPruziny, prepniDruh, PROSTOR, popis, ulozProjekt, nactiProjekt, tridaBezpecnosti,
    plocha2, ccw, zrcadliY, prusecikyX, uvnitr2, vzdalObrys, krizi, rotace, hladkyObrys, zjednodus, obrysNaSkicu, parametrickyObrys, hladce,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KOLICKY = API;
})();
