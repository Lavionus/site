/* ============================================================
   Trosečníci – objevy.js: objevy místo výzkumu, výrobky.

   Čistá logika bez DOM. Technologie nevznikají za „body výzkumu",
   ale tím, co výprava na ostrově najde nebo zkusí:
     🧱 hlína        – výprava u řeky           → kopání hlíny, hliněná pec
     🌱 léčivky      – botanik v džungli, vodopád nebo ruiny → sběr léčivek, ošetřovna
     ⛰️ výhled       – výprava na skalách       → rozhledna
     🌋 ruda         – výprava v sopečné oblasti → těžba rudy (s kovárnou)
     ⚒️ kovářství    – šrot z vraku + pec       → kovárna (udice, krumpáč, nářadí, sekera)
     🔨 řemeslo      – postavená pila           → dílna (sítě, nádoby, pochodně)
   Strom je bez slepých uliček: všechny podmínky jdou splnit na každém
   ostrově (řeka, sopka, skály i vrak jsou vždy) – ověřuje test.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { W, TEREN, SOUSEDE4, idx, uvnitr } = T.svet;

  const OBJEVY = {
    hlina: { ikona: '🧱', nazev: 'Hlína',
      text: 'Na břehu řeky se ti noha zabořila do mazlavé šedé hlíny. Dá se z ní plácat – a když se vypálí, vydrží cokoli.',
      napoveda: 'Co asi leží na dně a na březích řek?',
      odemyka: ['⛏️ Kopat hlínu (u řeky)', '🧱 Hliněná pec', '🛢️ Cihlová nádrž (s pecí)'] },
    lecivky: { ikona: '🌱', nazev: 'Léčivé rostliny',
      text: 'Našli jste byliny, které tlumí horečku a hojí rány. Rostou ve vlhkém stínu džungle.',
      napoveda: 'Botanik by v džungli jistě něco našel. Nebo ti starší – kdo žil u vodopádu a v ruinách?',
      odemyka: ['🌱 Sbírat léčivky (v džungli)', '🏥 Ošetřovna'] },
    vyhled: { ikona: '⛰️', nazev: 'Výhled',
      text: 'Ze skal je vidět daleko přes ostrov. Kdyby tu stála vysoká věž, bylo by vidět všechno.',
      napoveda: 'Vylez někam vysoko.',
      odemyka: ['🗼 Rozhledna'] },
    ruda: { ikona: '🌋', nazev: 'Železná ruda',
      text: 'Na úbočí sopky leží těžké rudohnědé kameny. Železná ruda! S kovárnou se z ní dá tavit kov.',
      napoveda: 'Sopka ukrývá víc než popel.',
      odemyka: ['⛏️ Těžit rudu (v sopečné oblasti, s kovárnou): +2 ⚙️'] },
    kovarstvi: { ikona: '⚒️', nazev: 'Kovářství',
      text: 'V žáru hliněné pece se kus šrotu z vraku rozžhavil do ruda a dal se ohnout. Kovárna je na dosah!',
      napoveda: 'Šrot z vraku a pořádný žár…',
      odemyka: ['⚒️ Kovárna', '🪝 Udice, ⛏️ krumpáč, 🔧 nářadí, 🪓 sekera'] },
    remeslo: { ikona: '🔨', nazev: 'Řemeslo',
      text: 'S pilou jdou řezat prkna na míru. Chtělo by to pořádnou dílnu s ponkem.',
      napoveda: 'Nejdřív pořádné nástroje na dřevo.',
      odemyka: ['🔨 Dílna', '🕸️ Sítě, 🏺 hliněné nádoby, 🔥 pochodně', '⛵ Loděnice'] },
  };
  const PORADI = ['hlina', 'lecivky', 'vyhled', 'ruda', 'kovarstvi', 'remeslo'];

  const ma = (s, o) => (s.objevy || []).includes(o);
  function terenyVyprava(s) {
    const { x, y } = s.hrac, v = [s.svet.teren[idx(x, y)]];
    for (const [dx, dy] of SOUSEDE4) if (uvnitr(x + dx, y + dy)) v.push(s.svet.teren[idx(x + dx, y + dy)]);
    return v;
  }
  const lokaceU = (s, typ) => {
    const { x, y } = s.hrac;
    return s.svet.lokace.some(l => l.typ === typ && Math.abs(l.x - x) + Math.abs(l.y - y) <= 1);
  };
  const PODMINKY = {
    hlina: s => terenyVyprava(s).includes(TEREN.REKA),
    lecivky: s => (T.postavy.maProfesi(s, 'botanik', 'vyprava') && s.svet.teren[idx(s.hrac.x, s.hrac.y)] === TEREN.DZUNGLE)
      || lokaceU(s, 'vodopad') || lokaceU(s, 'ruiny'),
    vyhled: s => s.svet.teren[idx(s.hrac.x, s.hrac.y)] === TEREN.SKALY,
    ruda: s => s.svet.teren[idx(s.hrac.x, s.hrac.y)] === TEREN.SOPKA,
    kovarstvi: s => s.predmety.includes('srot') && T.stavby.ma(s, 'pec'),
    remeslo: s => T.stavby.ma(s, 'pila'),
  };
  // zkontroluje podmínky a vrátí nově učiněné objevy
  function kontrola(s) {
    s.objevy = s.objevy || [];
    const nove = [];
    for (const k of PORADI) {
      if (ma(s, k) || !PODMINKY[k](s)) continue;
      s.objevy.push(k); nove.push({ id: k, ...OBJEVY[k] });
    }
    return nove;
  }

  // --- výrobky (kovárna, dílna) --------------------------------------------------------
  const VYROBKY = {
    udice:   { ikona: '🪝', nazev: 'Udice', kde: 'kovarna', cena: { kov: 1, vlakna: 2 }, ab: 2, predmet: true,
      popis: 'Kovový háček: rybaření +15 % a +1 🍖, molo +1 🍖 za noc.' },
    krumpac: { ikona: '⛏️', nazev: 'Krumpáč', kde: 'kovarna', cena: { kov: 2, drevo: 2 }, ab: 2, predmet: true,
      popis: 'Kámen, hlína i ruda +1; kameník v táboře +1 🪨.' },
    naradi:  { ikona: '🔧', nazev: 'Nářadí', kde: 'kovarna', cena: { kov: 3, drevo: 2 }, ab: 3, predmet: true,
      popis: 'Kladivo, dláta a hřebíky: každá stavba o 1 AB méně.' },
    sekera:  { ikona: '🪓', nazev: 'Sekera', kde: 'kovarna', cena: { kov: 2, drevo: 2 }, ab: 2, predmet: true,
      popis: 'Vlastní sekera, když ji nenajdeš jinde.' },
    site:    { ikona: '🕸️', nazev: 'Rybářské sítě', kde: 'dilna', cena: { vlakna: 6 }, ab: 2, predmet: true,
      popis: 'Rybaření +1 🍖, molo +2 🍖 za noc.' },
    nadoby:  { ikona: '🏺', nazev: 'Hliněné nádoby', kde: 'dilna', cena: { hlina: 3, drevo: 1 }, ab: 1, max: 3, pec: true,
      popis: '+4 místa na vodu (až 3 sady). Vypálí se v peci.' },
    pochodne: { ikona: '🔥', nazev: 'Pochodně', kde: 'dilna', cena: { drevo: 1, vlakna: 1 }, ab: 1, pocet: 2,
      popis: '+2 pochodně. Hodí se tam, kam nesvítí slunce.' },
  };

  function prekazkaVyrobku(s, id) {
    const V = VYROBKY[id];
    if (V.predmet && s.predmety.includes(id)) return 'Už máš.';
    if (id === 'sekera' && s.predmety.includes('sekera')) return 'Už máš.';
    if (V.max && (s.nadoby || 0) >= V.max) return `Víc než ${V.max} sady neuskladníš.`;
    if (V.pec && !T.stavby.ma(s, 'pec')) return 'Potřebuješ hliněnou pec na vypálení.';
    const chybi = {};
    for (const k in V.cena) if ((s.zasoby[k] || 0) < V.cena[k]) chybi[k] = V.cena[k] - (s.zasoby[k] || 0);
    if (Object.keys(chybi).length) return 'Ještě chybí ' + T.stavby.popisCeny(chybi) + '.';
    if (s.ab < V.ab) return `Potřeba ${V.ab} AB, zbývá ${s.ab}.`;
    return null;
  }
  // akce výroby na poli kovárny/dílny
  const AKCE = Object.entries(VYROBKY).map(([id, V]) => ({
    id: 'vyrob_' + id, ikona: V.ikona, nazev: `Vyrobit: ${V.nazev.toLowerCase()} (${T.stavby.popisCeny(V.cena)})`, ab: V.ab, vyroba: true,
    kde: (s, i) => { const b = T.stavby.stavbaNa(s, i); return !!b && b.typ === V.kde && !(V.predmet && s.predmety.includes(id)) && !(id === 'sekera' && s.predmety.includes('sekera')); },
    proc: s => { const d = prekazkaVyrobku(s, id); return d && !/AB/.test(d) ? d : null; },
    proved(s) {
      for (const k in V.cena) s.zasoby[k] -= V.cena[k];
      if (V.predmet) { s.predmety.push(id); return `Hotovo: ${V.ikona} ${V.nazev}. ${V.popis}`; }
      if (id === 'nadoby') { s.nadoby = (s.nadoby || 0) + 1; return `Vypálil jsi sadu hliněných nádob (+4 místa na vodu, ${s.nadoby}/${V.max}).`; }
      const z = T.hra.pridejZasoby(s, { pochodne: V.pocet });
      return `Namotal jsi a namočil do pryskyřice pochodně (+${z.pochodne || 0} 🔥).`;
    },
  }));

  // sběr nových surovin
  AKCE.push(
    { id: 'hlina', ikona: '⛏️', nazev: 'Kopat hlínu', ab: 1,
      kde: (s, i, x, y) => ma(s, 'hlina') && terenyVyprava(s).includes(TEREN.REKA),
      proc: (s, i) => (s.vycerpano['h' + i] || 0) > s.den ? 'Tady už je vykopáno, zkus kus dál po proudu.' : null,
      proved(s, i) {
        s.vycerpano['h' + i] = s.den + 2;
        return 'Vykopal jsi hlínu: ' + T.hra.popisZisku(T.hra.pridejZasoby(s, { hlina: 2 + (s.predmety.includes('krumpac') ? 1 : 0) })) + '.';
      } },
    { id: 'lecivky', ikona: '🌱', nazev: 'Sbírat léčivky', ab: 1,
      kde: (s, i) => ma(s, 'lecivky') && (s.svet.teren[i] === TEREN.DZUNGLE || (!s.svet.teren.includes(TEREN.DZUNGLE) && s.svet.teren[i] === TEREN.SAVANA)),
      proc: (s, i) => (s.vycerpano['l' + i] || 0) > s.den ? 'Byliny tu jsou otrhané.' : null,
      proved(s, i) {
        s.vycerpano['l' + i] = s.den + 3;
        const n = 1 + (T.postavy.maProfesi(s, 'botanik', 'vyprava') ? 1 : 0);
        return 'Nasbíral jsi léčivé byliny: ' + T.hra.popisZisku(T.hra.pridejZasoby(s, { lecivky: n })) + '.';
      } },
    { id: 'ruda', ikona: '⛏️', nazev: 'Těžit železnou rudu', ab: 2,
      kde: (s, i) => ma(s, 'ruda') && s.svet.teren[i] === TEREN.SOPKA,
      proc: s => !T.stavby.ma(s, 'kovarna') ? 'Rudu nemá kdo roztavit – postav kovárnu.' : null,
      proved(s) {
        const n = 2 + (s.predmety.includes('krumpac') ? 1 : 0);
        return 'Natěžil jsi rudu a doma ji roztavíš: ' + T.hra.popisZisku(T.hra.pridejZasoby(s, { kov: n })) + '.';
      } },
  );

  T.objevy = { OBJEVY, PORADI, PODMINKY, VYROBKY, AKCE, ma, kontrola, prekazkaVyrobku };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;
