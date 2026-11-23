/* Zrcátko, blinkr, jeď! – výukové situace a mapa městečka pro volnou jízdu.
   Situace se popisují relativně (zprava, přes protisměr, ke krajnici), takže se pro ČR i UK
   postaví správně: v ČR je „přes protisměr“ vlevo, v UK vpravo.
   Každá situace: postav(profil) → { mapa, krizovatky, hrac, cil, ukoly, ... } */
(function () {
  'use strict';
  const J = typeof module !== 'undefined' ? require('./jadro.js') : window.BLINKR_JADRO;

  // Hráč přijíždí vždy z jihu (rameno 2) ke křižovatce uprostřed '2,2'.
  const S = 0, V = 1, JIH = 2, Z = 3;
  const pres = p => (p.strana > 0 ? Z : V);           // odbočení přes protisměr
  const kraj = p => (p.strana > 0 ? V : Z);           // odbočení ke krajnici
  const KRIZ = ['..r..', '..r..', 'rrrrr', '..r..', '..r..'];
  const T_KRIZ = ['.....', '..p..', 'rrrrr', '..r..', '..r..'];
  const CIL = { [S]: '2,0', [V]: '4,2', [JIH]: '2,4', [Z]: '0,2' };
  const start = (extra = {}) => ({ tile: '2,4', vjezd: JIH, s: 2, v: 0, ...extra });   // ze stání
  // NPC z okraje: rameno k, plán výjezdů (první = výjezd z okrajové dlaždice, pak křižovatka, pak dál)
  const odkraje = (k, vyjezdKriz, extra = {}) => {
    const tile = CIL[k];
    return { tile, vjezd: k, plan: [vyjezdKriz], s: 0, v: 11, ...extra };
  };

  const SITUACE = [
    {
      id: 'vedlejsi', nazev: 'Vedlejší silnice',
      postav: p => ({
        mapa: KRIZ, krizovatky: { '2,2': { rizeni: ['dej_prednost', 'hlavni', 'dej_prednost', 'hlavni'] } },
        hrac: start(), cil: CIL[S], smer: 'rovne',
        ukoly: [
          { cas: 0, auto: odkraje(V, Z) }, { cas: 1.2, auto: odkraje(Z, V) }, { cas: 3, auto: odkraje(V, Z) },
          { cas: 4.4, auto: odkraje(Z, V) }, { cas: 6.2, auto: odkraje(V, Z) }, { cas: 7.6, auto: odkraje(Z, V) },
        ],
        ukol: 'Projeď rovně přes hlavní silnici.',
        rada: p.id === 'cz'
          ? 'Na vedlejší silnici je značka „Dej přednost v jízdě!“ – pusť všechna auta na hlavní, zprava i zleva (§ 22 odst. 1).'
          : 'Před křižovatkou je značka Give Way a dvojitá přerušovaná čára – provoz na hlavní má přednost. Počkej na bezpečnou mezeru (pravidlo 172).',
      }),
    },
    {
      id: 'stop', nazev: 'STOP',
      postav: p => ({
        mapa: T_KRIZ, krizovatky: { '2,2': { rizeni: [undefined, 'hlavni', 'stop', 'hlavni'] } },
        hrac: start(), cil: CIL[kraj(p)], smer: 'kraj',
        ukoly: [{ cas: 1.5, auto: odkraje(p.strana > 0 ? Z : V, kraj(p)) }, { cas: 5, auto: odkraje(kraj(p), pres(p)) }],
        ukol: (p.strana > 0 ? 'Odboč vpravo na hlavní silnici.' : 'Odboč vlevo na hlavní silnici.'),
        rada: p.id === 'cz'
          ? 'U značky STOP musíš úplně zastavit (rychloměr na nule), až potom se rozjeď – a dej přednost autům na hlavní (§ 22 odst. 4).'
          : 'U značky STOP musíš (MUST) úplně zastavit za čarou – rychloměr na nule – a jet, až je to bezpečné (pravidlo 171).',
      }),
    },
    {
      id: 'neoznacena', nazev: p => (p && p.id === 'uk' ? 'Neoznačená křižovatka (nikdo nemá přednost)' : 'Pravidlo pravé ruky'),
      postav: p => ({
        mapa: KRIZ, krizovatky: {},
        hrac: start(), cil: CIL[S], smer: 'rovne',
        ukoly: [
          { cas: 0.2, auto: odkraje(V, Z, { v: 10.5 }) },     // zprava
          { cas: 2.5, auto: odkraje(Z, V, { v: 9 }) },        // zleva
        ],
        ukol: 'Projeď rovně přes křižovatku bez značek.',
        rada: p.id === 'cz'
          ? 'Křižovatka nemá značky – platí pravidlo pravé ruky: auto zprava má přednost, auto zleva dává přednost tobě (§ 22 odst. 2).'
          : 'Neoznačená křižovatka: nikdo nemá přednost (pravidlo 146). Zpomal, rozhlédni se a jeď, jen když kvůli tobě nikdo nemusí brzdit. Pravidlo pravé ruky tu neplatí.',
      }),
    },
    {
      id: 'protismer', nazev: p => (p && p.id === 'uk' ? 'Odbočení vpravo přes protisměr' : 'Odbočení vlevo přes protisměr'),
      postav: p => ({
        mapa: KRIZ, krizovatky: { '2,2': { rizeni: ['hlavni', 'dej_prednost', 'hlavni', 'dej_prednost'] } },
        hrac: start(), cil: CIL[pres(p)], smer: 'pres',
        ukoly: [
          { cas: 0, auto: odkraje(S, JIH) }, { cas: 2.2, auto: odkraje(S, JIH) },
          { cas: 4.4, auto: odkraje(S, kraj(p) === V ? Z : V) }, { cas: 8, auto: odkraje(S, JIH) },
        ],
        ukol: (p.strana > 0 ? 'Jedeš po hlavní – odboč vlevo.' : 'Jedeš po hlavní – odboč vpravo.'),
        rada: p.id === 'cz'
          ? 'Dej blinkr vlevo, zařaď se k ose a pusť všechna protijedoucí auta (§ 21 odst. 5). Ve křižovatce smíš na mezeru počkat.'
          : 'Dej blinkr vpravo, zařaď se těsně vlevo od středu silnice a počkej na bezpečnou mezeru v protisměru (pravidla 179–180).',
      }),
    },
    {
      id: 'semafor', nazev: 'Semafor',
      postav: p => ({
        mapa: KRIZ, krizovatky: { '2,2': { semafor: true, posun: 9 } },
        hrac: start(), cil: CIL[S], smer: 'rovne',
        ukoly: [{ cas: 2, auto: odkraje(V, Z) }, { cas: 3.6, auto: odkraje(Z, V) }, { cas: 13, auto: odkraje(S, JIH) }],
        ukol: 'Projeď rovně křižovatkou se semafory.',
        rada: p.id === 'cz'
          ? 'Na červenou stůj. Červená se žlutou znamená „připrav se“, ale ještě nejeď. Na žlutou zastav, pokud to jde bezpečně (§ 70).'
          : 'Červená se žlutou v Británii také znamená STŮJ – jeď až na zelenou. Na žlutou zastav, pokud nejsi tak blízko, že bys nezastavil bezpečně (pravidlo 175).',
      }),
    },
    {
      id: 'sipka', nazev: p => (p && p.id === 'uk' ? 'Zelená šipka' : 'Doplňková zelená šipka'),
      postav: p => ({
        mapa: KRIZ, krizovatky: { '2,2': { semafor: true, posun: 0, sipky: [JIH] } },
        hrac: start(), cil: CIL[kraj(p)], smer: 'kraj',
        ukoly: [{ cas: 1.5, auto: odkraje(pres(p), kraj(p)) }, { cas: 3.5, auto: odkraje(pres(p), kraj(p)) }, { cas: 7, auto: odkraje(pres(p), kraj(p)) }],
        ukol: (p.strana > 0 ? 'Na červenou svítí zelená šipka vpravo – odboč.' : 'Na červenou svítí zelená šipka vlevo – odboč.'),
        rada: p.id === 'cz'
          ? 'Doplňková zelená šipka dovoluje odbočit i na červenou, ale musíš dát přednost autům, která mají zelenou, a nesmíš ohrozit chodce (§ 70 odst. 2 písm. g).'
          : 'Zelená šipka dovoluje jet ve směru šipky, ať svítí cokoli jiného – ale jen když je cesta volná.',
      }),
    },
    {
      id: 'kruhac', nazev: 'Kruhový objezd a blinkr',
      postav: p => ({
        mapa: ['..r..', '..r..', 'rrOrr', '..r..', '..r..'], krizovatky: {},
        hrac: start(), cil: CIL[pres(p)], smer: 'pres',
        ukoly: [
          { cas: 0.5, auto: odkraje(kraj(p), JIH) },
          { cas: 2.5, auto: odkraje(S, kraj(p)) },
          { cas: 5.5, auto: odkraje(kraj(p), pres(p)) },
        ],
        ukol: (p.strana > 0 ? 'Vyjeď z kruhového objezdu třetím výjezdem (vlevo).' : 'Vyjeď z kruhového objezdu třetím výjezdem (vpravo).'),
        rada: p.id === 'cz'
          ? 'Při vjezdu na kruháč NEblikej a dej přednost autům na objezdu (§ 22 odst. 5). Blinkr vpravo zapni až za předchozím výjezdem, při vyjíždění (§ 30 odst. 5).'
          : 'Výjezd vpravo: blinkr vpravo už při příjezdu a nech ho svítit na objezdu, dej přednost provozu zprava; za výjezdem před tím svým přepni blinkr vlevo (pravidla 185–186).',
      }),
    },
    {
      id: 'zebra', nazev: 'Přechod pro chodce',
      postav: p => ({
        mapa: ['..r..', '..r..', '..z..', '..r..', '..r..'], krizovatky: {},
        hrac: start(), cil: CIL[S], smer: 'rovne', bezKrizovatky: true,
        ukoly: [
          { blizko: { tile: '2,2', vzd: 48 }, chodec: { prechod: 0, strana: p.strana > 0 ? 1 : 0 } },
          { cas: 14, chodec: { prechod: 0, strana: 0 } },
        ],
        ukol: 'Projeď ulicí s přechodem pro chodce.',
        rada: p.id === 'cz'
          ? 'Chodci na přechodu i tomu, kdo zjevně chce přejít (čeká u kraje), musíš umožnit nerušené přejití – i zastavením (§ 5 odst. 2 písm. f).'
          : 'Chodci, který už vstoupil na zebru, musíš (MUST) dát přednost; tomu, kdo u ní čeká, bys ji dát měl (should) – pravidlo 195.',
      }),
    },
    {
      id: 'chodci_odboceni', nazev: 'Chodci při odbočování',
      postav: p => ({
        mapa: KRIZ, krizovatky: { '2,2': { rizeni: ['hlavni', 'dej_prednost', 'hlavni', 'dej_prednost'], mista: [kraj(p)] } },
        hrac: start(), cil: CIL[kraj(p)], smer: 'kraj',
        ukoly: [
          { blizko: { tile: '2,2', vzd: 40 }, chodec: { prechod: 0, strana: 0 } },
          { blizko: { tile: '2,2', vzd: 30 }, chodec: { prechod: 0, strana: 1 } },
        ],
        ukol: (p.strana > 0 ? 'Odboč vpravo – na rohu jsou chodci.' : 'Odboč vlevo – na rohu jsou chodci.'),
        rada: p.id === 'cz'
          ? 'Při odbočování nesmíš ohrozit chodce, který už přechází silnici, do které odbočuješ (§ 5 odst. 2 písm. g). Na čekajícího chodce mimo přechod zastavit nemusíš.'
          : 'Dej přednost chodcům, kteří přecházejí NEBO čekají, že přejdou silnici, do které odbočuješ (pravidlo H2). Když už přecházejí, mají přednost.',
      }),
    },
    {
      id: 'zaplnena', nazev: 'Zaplněná křižovatka',
      postav: p => ({
        mapa: KRIZ, krizovatky: { '2,2': { rizeni: ['hlavni', 'dej_prednost', 'hlavni', 'dej_prednost'] } },
        hrac: start(), cil: CIL[S], smer: 'rovne',
        ukoly: [
          { cas: 0, auto: { tile: '2,1', vjezd: JIH, plan: [S, S], s: 16, v: 0, stojiDo: 13 } },
          { cas: 0, auto: { tile: '2,1', vjezd: JIH, plan: [S, S], s: 9.6, v: 0, stojiDo: 13.4 } },
          { cas: 0, auto: { tile: '2,1', vjezd: JIH, plan: [S, S], s: 3.2, v: 0, stojiDo: 13.8 } },
        ],
        ukol: 'Za křižovatkou stojí kolona – projeď rovně.',
        rada: p.id === 'cz'
          ? 'Do křižovatky nevjížděj, pokud bys v ní musel zastavit – počkej před ní, dokud se za ní neuvolní místo (§ 22 odst. 3).'
          : 'Do křižovatky vjeď, jen když ji můžeš opustit – počkej před ní, dokud se za ní neuvolní místo (pravidla 174 a 176).',
      }),
    },
    {
      id: 'kruhac_prvni', nazev: 'Kruhový objezd – první výjezd',
      postav: p => ({
        mapa: ['..r..', '..r..', 'rrOrr', '..r..', '..r..'], krizovatky: {},
        hrac: start(), cil: CIL[kraj(p)], smer: 'kraj',
        ukoly: [
          { cas: 0.5, auto: odkraje(pres(p), JIH) }, { cas: 2.5, auto: odkraje(S, pres(p)) },
          { cas: 4.5, auto: odkraje(pres(p), kraj(p)) },
        ],
        ukol: (p.strana > 0 ? 'Vyjeď z kruhového objezdu hned prvním výjezdem (vpravo).' : 'Vyjeď z kruhového objezdu hned prvním výjezdem (vlevo).'),
        rada: p.id === 'cz'
          ? 'I když vyjíždíš hned prvním výjezdem, při vjezdu se NEbliká (§ 30 odst. 5). Dej přednost autům na objezdu a blinkr vpravo zapni hned po vjezdu – to už vyjíždíš.'
          : 'Výjezd vlevo (první): blinkr vlevo už při příjezdu, drž se vlevo a nech ho svítit až do výjezdu (pravidlo 186). Přednost má provoz zprava.',
      }),
    },
    {
      id: 'kruhac_rovne', nazev: 'Kruhový objezd – rovně',
      postav: p => ({
        mapa: ['..r..', '..r..', 'rrOrr', '..r..', '..r..'], krizovatky: {},
        hrac: start(), cil: CIL[S], smer: 'rovne',
        ukoly: [
          { cas: 0.5, auto: odkraje(kraj(p), pres(p)) }, { cas: 2.8, auto: odkraje(pres(p), JIH) },
          { cas: 5, auto: odkraje(kraj(p), JIH) },
        ],
        ukol: 'Projeď kruhovým objezdem rovně (druhý výjezd).',
        rada: p.id === 'cz'
          ? 'Při vjezdu neblikej a dej přednost autům na objezdu (§ 22 odst. 5). Až mineš první výjezd, dej blinkr vpravo – vyjíždíš (§ 30 odst. 5).'
          : 'Jedeš rovně: při příjezdu obvykle neblikáš, dej přednost provozu zprava; za prvním výjezdem dej blinkr vlevo (pravidlo 186).',
      }),
    },
    {
      id: 'vedlejsi_pres', nazev: p => (p && p.id === 'uk' ? 'Z vedlejší vpravo na hlavní' : 'Z vedlejší vlevo na hlavní'),
      postav: p => ({
        mapa: T_KRIZ, krizovatky: { '2,2': { rizeni: [undefined, 'hlavni', 'dej_prednost', 'hlavni'] } },
        hrac: start(), cil: CIL[pres(p)], smer: 'pres',
        ukoly: [
          { cas: 0, auto: odkraje(kraj(p), pres(p)) }, { cas: 1.5, auto: odkraje(pres(p), kraj(p)) },
          { cas: 3.6, auto: odkraje(kraj(p), pres(p)) }, { cas: 5.4, auto: odkraje(pres(p), kraj(p)) },
          { cas: 7.2, auto: odkraje(kraj(p), pres(p)) },
        ],
        ukol: (p.strana > 0 ? 'Vyjeď z vedlejší silnice vlevo – přes oba jízdní pruhy hlavní.' : 'Vyjeď z vedlejší silnice vpravo – přes oba jízdní pruhy hlavní.'),
        rada: p.id === 'cz'
          ? 'Musíš pustit auta z obou směrů – zleva i zprava (§ 22 odst. 1). Vyjeď, až je volno v obou pruzích, a dej blinkr vlevo.'
          : 'Před vjezdem na hlavní musíš (MUST) dát přednost provozu z obou směrů (pravidlo 172). Dej blinkr vpravo a počkej na mezeru v obou pruzích.',
      }),
    },
    {
      id: 'neoznacena_pres', nazev: p => (p && p.id === 'uk' ? 'Neoznačená křižovatka – odbočení vpravo' : 'Pravá ruka a odbočení vlevo'),
      postav: p => ({
        mapa: KRIZ, krizovatky: {},
        hrac: start(), cil: CIL[pres(p)], smer: 'pres',
        ukoly: [
          { cas: 1.5, auto: odkraje(V, Z) },          // zprava
          { cas: 2.6, auto: odkraje(S, JIH) },        // protijedoucí rovně
          { cas: 4.4, auto: odkraje(V, Z) },
          { cas: 5.6, auto: odkraje(S, JIH) },
        ],
        ukol: (p.strana > 0 ? 'Odboč vlevo na křižovatce bez značek.' : 'Odboč vpravo na křižovatce bez značek.'),
        rada: p.id === 'cz'
          ? 'Dvě pravidla najednou: auto zprava má přednost (§ 22 odst. 2) a při odbočení vlevo pouštíš i protijedoucí (§ 21 odst. 5). Odboč, až kvůli tobě nikdo nemusí brzdit.'
          : 'Nikdo nemá přednost (pravidlo 146), ale při odbočení vpravo vždy počkej na mezeru v protisměru (pravidlo 180). Zpomal a jeď, až kvůli tobě nikdo nebrzdí.',
      }),
    },
    {
      id: 'semafor_pres', nazev: p => (p && p.id === 'uk' ? 'Semafor – odbočení vpravo' : 'Semafor – odbočení vlevo'),
      postav: p => ({
        mapa: KRIZ, krizovatky: { '2,2': { semafor: true, posun: 21 } },
        hrac: start(), cil: CIL[pres(p)], smer: 'pres',
        ukoly: [
          ...[0, 1.6, 3.2, 4.8, 6.4, 8, 9.6, 11.2].map(c => ({ cas: c, auto: odkraje(S, JIH) })),
        ],
        ukol: (p.strana > 0 ? 'Na zelenou odboč vlevo – proti tobě jede kolona.' : 'Na zelenou odboč vpravo – proti tobě jede kolona.'),
        rada: p.id === 'cz'
          ? 'Zelená neznamená přednost: při odbočení vlevo pouštíš protijedoucí (§ 21 odst. 5). Smíš vjet do křižovatky a počkat v ní (§ 22 odst. 3) – dokončíš, až protisměr zastaví nebo se uvolní.'
          : 'Na zelenou smíš vjet a zařadit se k odbočení vpravo (pravidlo 176), ale počkej na mezeru v protisměru (pravidlo 180). Až protisměr zastaví, dokonči odbočení.',
      }),
    },
    {
      id: 'zelena_chodci', nazev: 'Zelená a chodci',
      postav: p => ({
        mapa: KRIZ, krizovatky: { '2,2': { semafor: true, posun: 15, mista: [kraj(p)] } },
        hrac: start(), cil: CIL[kraj(p)], smer: 'kraj',
        ukoly: [
          { blizko: { tile: '2,2', vzd: 85 }, chodec: { prechod: 0, strana: 0 } },
          { blizko: { tile: '2,2', vzd: 60 }, chodec: { prechod: 0, strana: 1 } },
          { blizko: { tile: '2,2', vzd: 30 }, chodec: { prechod: 0, strana: 0 } },
        ],
        ukol: (p.strana > 0 ? 'Na zelenou odboč vpravo – přes silnici jdou chodci.' : 'Na zelenou odboč vlevo – přes silnici jdou chodci.'),
        rada: p.id === 'cz'
          ? 'Při odbočování na zelenou dáváš přednost chodcům, kteří přecházejí ve volném směru (§ 70 odst. 2 písm. c) – nesmíš je ohrozit (§ 5 odst. 2 písm. g).'
          : 'I na zelenou dej přednost chodcům, kteří přecházejí silnici, do které odbočuješ – a měl bys pustit i ty, kdo čekají (pravidlo H2).',
      }),
    },
  ];

  const MESTO = {
    mapa: [
      '...r...r...',
      'rrrOrrrrrrr',
      '...r.p.z...',
      '...r...r.pp',
      'rrrrrrrrrrr',
      'pp.z...r...',
      '...rrrrr...',
      '...r.......',
    ],
    krizovatky: {
      '7,1': { rizeni: ['stop', 'hlavni', 'dej_prednost', 'hlavni'] },
      '3,4': { mista: [1] },
      '7,4': { semafor: true, sipky: [2], mista: [1] },
      '3,6': { rizeni: ['hlavni', 'dej_prednost', 'hlavni', undefined] },
    },
    hrac: { tile: '0,4', vjezd: 3, s: 4, v: 0 },
  };

  const nazevSituace = (s, p) => (typeof s.nazev === 'function' ? s.nazev(p) : s.nazev);

  const API = { SITUACE, MESTO, nazevSituace };
  if (typeof module !== 'undefined') module.exports = API;
  else window.BLINKR_SITUACE = API;
  void J;
})();
