/* Zrcátko, blinkr, jeď! – jádro pravidel silničního provozu (bez DOM, spustitelné v node).
   Dva státy: Česko (jízda vpravo, zákon č. 361/2000 Sb.) a Velká Británie (jízda vlevo, The Highway Code).
   Zdroje a srovnávací tabulka: docs/plany/Blinkr_PLAN.md (znění ověřeno 20. 11. 2026).

   Souřadnice jako na obrazovce: x doprava (východ), y dolů (jih), metry.
   Ramena křižovatky: 0 = sever, 1 = východ, 2 = jih, 3 = západ (po směru hodin).
   Vozidlo „z ramene a“ do křižovatky vjíždí z ramene a, „do ramene b“ z ní vyjíždí.
   strana: +1 = jízda vpravo (ČR), −1 = jízda vlevo (UK). */
(function () {
  'use strict';

  const PRUH = 3.5;                 // šířka jízdního pruhu (m)
  const OKRAJ = 9.5;                // vzdálenost hranice křižovatky od středu (m)
  const MPH = 0.44704;              // 1 mph v m/s

  // Závaznost: 'povinnost' = zákon / MUST, 'doporuceni' = Highway Code „should“.
  const PROFILY = {
    cz: {
      id: 'cz', stat: 'Česko', strana: +1, predpis: 'zákon č. 361/2000 Sb.',
      jednotka: 'km/h', naJednotku: v => v * 3.6, zJednotky: x => x / 3.6,
      limitObec: 50 / 3.6, limitText: '50 km/h', citaceLimit: '§ 18 odst. 4',
    },
    uk: {
      id: 'uk', stat: 'Velká Británie', strana: -1, predpis: 'The Highway Code',
      jednotka: 'mph', naJednotku: v => v / MPH, zJednotky: x => x * MPH,
      limitObec: 30 * MPH, limitText: '30 mph', citaceLimit: 'pravidlo 124',
    },
  };

  /* ---------- geometrie ---------- */

  const SMERY = [[0, -1], [1, 0], [0, 1], [-1, 0]];    // ven ze středu k ramenům 0..3
  const vpravoOd = ([x, y]) => [-y, x];                 // pravá ruka při jízdě ve směru (x, y)

  // Druh manévru z ramene a do ramene b (geometricky, nezávisí na straně jízdy).
  function manevr(a, b) {
    return ['otoceni', 'vlevo', 'rovne', 'vpravo'][(b - a + 4) % 4];
  }

  // Odbočení, při kterém vozidlo kříží protisměr: v ČR vlevo, v UK vpravo.
  function presProtismer(profil, a, b) {
    return manevr(a, b) === (profil.strana > 0 ? 'vlevo' : 'vpravo');
  }

  // Bod v pruhu na rameni: vzdálenost d od středu, pruh pro vjezd (dovnitř) nebo výjezd (ven).
  function bodPruhu(strana, rameno, d, dovnitr) {
    const ven = SMERY[rameno];
    const jizda = dovnitr ? [-ven[0], -ven[1]] : ven;
    const p = vpravoOd(jizda);
    const o = strana * PRUH / 2;
    return [ven[0] * d + p[0] * o, ven[1] * d + p[1] * o];
  }

  // Průsečík dvou přímek (bod + směr); null, jsou-li rovnoběžné.
  function prusecikPrimek(p, u, q, v) {
    const det = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(det) < 1e-9) return null;
    const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / det;
    return [p[0] + u[0] * t, p[1] + u[1] * t];
  }

  // Dráha vozidla křižovatkou z ramene a do ramene b jako lomená čára (od hranice k hranici).
  function draha(strana, a, b, kroku = 16) {
    const z = bodPruhu(strana, a, OKRAJ, true);
    const k = bodPruhu(strana, b, OKRAJ, false);
    const u = [-SMERY[a][0], -SMERY[a][1]];
    const c = manevr(a, b) === 'rovne' || a === b ? null : prusecikPrimek(z, u, k, SMERY[b]);
    const body = [];
    for (let i = 0; i <= kroku; i++) {
      const t = i / kroku;
      if (!c) body.push([z[0] + (k[0] - z[0]) * t, z[1] + (k[1] - z[1]) * t]);
      else {
        const s = 1 - t;
        body.push([s * s * z[0] + 2 * s * t * c[0] + t * t * k[0], s * s * z[1] + 2 * s * t * c[1] + t * t * k[1]]);
      }
    }
    return body;
  }

  function useckySeKrizi(p1, p2, p3, p4) {
    const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }

  // Střetnou se dráhy dvou vozidel? Křížení drah nebo společný výjezd (zařazení do stejného pruhu).
  // Stejný vjezd = jedou za sebou, nejde o přednost.
  function stret(strana, ja, on) {
    if (ja.vjezd === on.vjezd) return false;
    if (ja.vyjezd === on.vyjezd) return true;
    const A = draha(strana, ja.vjezd, ja.vyjezd), B = draha(strana, on.vjezd, on.vyjezd);
    for (let i = 1; i < A.length; i++)
      for (let j = 1; j < B.length; j++)
        if (useckySeKrizi(A[i - 1], A[i], B[j - 1], B[j])) return true;
    return false;
  }

  /* ---------- přednost na křižovatce ---------- */

  const C = {
    cz: {
      vedlejsi: { citace: '§ 22 odst. 1', text: 'Přijíždíš po vedlejší silnici (značka Dej přednost v jízdě! nebo STOP) – přednost mají vozidla na hlavní.' },
      pravaRuka: { citace: '§ 22 odst. 2', text: 'Neoznačená křižovatka: dáváš přednost vozidlům přijíždějícím zprava (pravidlo pravé ruky).' },
      protismer: { citace: '§ 21 odst. 5', text: 'Při odbočování vlevo dáváš přednost protijedoucím vozidlům.' },
      sipka: { citace: '§ 70 odst. 2 písm. g)', text: 'Jedeš na doplňkovou zelenou šipku – přednost mají vozidla jedoucí ve volném směru.' },
      kruhac: { citace: '§ 22 odst. 5', text: 'Kruhový objezd se značkou Dej přednost v jízdě!: přednost mají vozidla na objezdu.' },
      kruhacBezZnacky: { citace: '§ 22 odst. 2', text: 'Kruhový objezd bez značky Dej přednost v jízdě! je neoznačená křižovatka – platí pravidlo pravé ruky a vjíždějící má přednost.' },
    },
    uk: {
      vedlejsi: { citace: 'pravidla 171 a 172', text: 'Vyjíždíš z vedlejší silnice (Give Way / Stop) – přednost má provoz na hlavní (MUST).' },
      nikdo: { citace: 'pravidlo 146', text: 'Neoznačená křižovatka: nikdo nemá přednost („nobody has priority“) – projeď jen tehdy, když nikoho neomezíš.' },
      protismer: { citace: 'pravidlo 180', text: 'Při odbočování vpravo počkej na bezpečnou mezeru v protijedoucím provozu.' },
      sipka: { citace: 'Light signals controlling traffic', text: 'Zelená šipka: jet smíš, jen když je cesta volná („if the way is clear“).' },
      kruhac: { citace: 'pravidlo 185', text: 'Na kruhovém objezdu dáváš přednost provozu přijíždějícímu zprava.' },
    },
  };

  // Výsledek: { kdo: 'ja'|'on'|'nikdo'|'bez_stretu', citace, text }
  //   'ja' = přednost mám já, 'on' = musím dát přednost jemu, 'nikdo' = nikdo nemá přednost (UK).
  // krizovatka.rizeni[i] = 'hlavni' | 'dej_prednost' | 'stop' | 'neoznacena' | 'semafor' | undefined (rameno není)
  // U semaforu: ja.svetlo / on.svetlo = 'plna' (zelená plná nebo zelená směrová šipka ve směru jízdy)
  //   nebo 'doplnkova' (doplňková šipka při červené / žluté). Vozidlo bez povolení jet do přednosti nevstupuje.
  function prednost(profil, krizovatka, ja, on) {
    const t = C[profil.id];
    const s = profil.strana;
    if (!stret(s, ja, on)) return { kdo: 'bez_stretu' };
    const vysl = (kdo, c) => ({ kdo, citace: c.citace, text: c.text });

    if (krizovatka.typ === 'kruhac') throw new Error('Pro kruhový objezd použij prednostKruhac().');

    const rJa = krizovatka.rizeni[ja.vjezd], rOn = krizovatka.rizeni[on.vjezd];

    if (rJa === 'semafor' || rOn === 'semafor') {
      if (ja.svetlo === 'doplnkova' && on.svetlo === 'plna') return vysl('on', t.sipka);
      if (on.svetlo === 'doplnkova' && ja.svetlo === 'plna') return vysl('ja', t.sipka);
      return protismerne(profil, ja, on) || vysl('nikdo', profil.id === 'cz' ? t.pravaRuka : t.nikdo);
    }

    const vedlejsi = r => r === 'dej_prednost' || r === 'stop';
    if (vedlejsi(rJa) && rOn === 'hlavni') return vysl('on', t.vedlejsi);
    if (rJa === 'hlavni' && vedlejsi(rOn)) return vysl('ja', t.vedlejsi);

    // Oba na stejně důležitých silnicích (obě hlavní, obě vedlejší, nebo neoznačená křižovatka).
    const proti = protismerne(profil, ja, on);
    if (proti) return proti;
    if (profil.id === 'uk') return vysl('nikdo', t.nikdo);
    // ČR § 22 odst. 2: přednost má ten, kdo přijíždí zprava.
    if (on.vjezd === (ja.vjezd + 3) % 4) return vysl('on', t.pravaRuka);
    if (ja.vjezd === (on.vjezd + 3) % 4) return vysl('ja', t.pravaRuka);
    return vysl('nikdo', t.pravaRuka);
  }

  // Protijedoucí vozidla: ten, kdo odbočuje přes protisměr, dává přednost (ČR § 21/5, UK 180).
  function protismerne(profil, ja, on) {
    if ((ja.vjezd + 2) % 4 !== on.vjezd) return null;
    const t = C[profil.id].protismer;
    const jaPres = presProtismer(profil, ja.vjezd, ja.vyjezd), onPres = presProtismer(profil, on.vjezd, on.vyjezd);
    if (jaPres && !onPres) return { kdo: 'on', citace: t.citace, text: t.text };
    if (onPres && !jaPres) return { kdo: 'ja', citace: t.citace, text: t.text };
    return null;
  }

  /* ---------- kruhový objezd ---------- */

  // Směr objíždění: v ČR proti směru hodinových ručiček, v UK po směru.
  const kruhacPoHodinach = profil => profil.strana < 0;

  // Vjíždějící vozidlo vůči vozidlu, které už jede po objezdu.
  // sDejPrednost: u vjezdu je „Kruhový objezd“ + „Dej přednost v jízdě!“ (v UK vždy Give Way).
  function prednostKruhac(profil, sDejPrednost = true) {
    const t = C[profil.id];
    if (profil.id === 'uk' || sDejPrednost) return { kdo: 'on', citace: t.kruhac.citace, text: t.kruhac.text };
    // ČR bez značky: § 22 odst. 2 – vozidlo na objezdu přijíždí zleva, takže přednost má vjíždějící.
    return { kdo: 'ja', citace: t.kruhacBezZnacky.citace, text: t.kruhacBezZnacky.text };
  }

  // Pořadí výjezdu (1 = první výjezd po vjezdu) na kruháči se 4 rameny.
  function poradiVyjezdu(profil, vjezd, vyjezd) {
    const krok = kruhacPoHodinach(profil) ? 1 : -1;     // pohyb po objezdu = změna indexu ramene
    // Projíždí se ramena ve směru objíždění; v ČR (proti hodinám) z jihu (2) první přijde východ (1).
    for (let k = 1; k <= 4; k++) if ((vjezd + krok * k + 8) % 4 === vyjezd) return k;
    return 4;
  }

  // Jaký blinkr má svítit na kruháči. faze: 'prijezd' | 'na_objezdu' | 'pred_vyjezdem'
  // ('pred_vyjezdem' = už minul výjezd před tím svým, nebo hned po vjezdu, je-li jeho výjezd první).
  // Vrací { blinkr: 'zadny'|'vlevo'|'vpravo', zavaznost, citace }.
  function blinkrKruhac(profil, vjezd, vyjezd, faze) {
    if (profil.id === 'cz') {
      const citace = '§ 30 odst. 5';
      if (faze === 'pred_vyjezdem') return { blinkr: 'vpravo', zavaznost: 'povinnost', citace, text: 'Při vyjíždění z kruhového objezdu musíš dát znamení o změně směru.' };
      return { blinkr: 'zadny', zavaznost: 'povinnost', citace, text: 'Při vjíždění na kruhový objezd a při jízdě po něm se znamení o změně směru nedává.' };
    }
    const citace = 'pravidlo 186';
    const m = manevr(vjezd, vyjezd);   // UK: vlevo = první výjezd, rovně = druhý, vpravo / otočení = dál
    if (faze === 'pred_vyjezdem' || m === 'vlevo')
      return { blinkr: 'vlevo', zavaznost: 'doporuceni', citace, text: m === 'vlevo'
        ? 'Výjezd vlevo: blinkr vlevo už při příjezdu a nech ho svítit až do výjezdu.'
        : 'Za výjezdem před tím svým dej blinkr vlevo.' };
    if (m === 'rovne') return { blinkr: 'zadny', zavaznost: 'doporuceni', citace, text: 'Jedeš rovně: při příjezdu obvykle neblikáš, blinkr vlevo až za předchozím výjezdem.' };
    return { blinkr: 'vpravo', zavaznost: 'doporuceni', citace, text: 'Výjezd vpravo: při příjezdu a na objezdu blinkr vpravo, za předchozím výjezdem přepni vlevo.' };
  }

  /* ---------- odbočování a blinkr ---------- */

  function blinkrOdboceni(profil, a, b) {
    const m = manevr(a, b);
    const blinkr = m === 'rovne' ? 'zadny' : m === 'vpravo' ? 'vpravo' : 'vlevo';
    // Otáčení: blinkr na stranu otáčení, tj. přes protisměr.
    const b2 = m === 'otoceni' ? (profil.strana > 0 ? 'vlevo' : 'vpravo') : blinkr;
    return profil.id === 'cz'
      ? { blinkr: b2, zavaznost: 'povinnost', citace: '§ 21 odst. 1', text: 'Při odbočování na křižovatce musíš dávat znamení o změně směru jízdy.' }
      : { blinkr: b2, zavaznost: 'doporuceni', citace: 'pravidla 179 a 182', text: 'Před odbočením se podívej do zrcátek a dej znamení (Mirrors – Signal – Manoeuvre).' };
  }

  /* ---------- chodci ---------- */

  // stav: 'na_prechodu' (už přechází) | 'ceka' (stojí u kraje a zjevně chce přejít) | 'nic'
  function chodecNaPrechodu(profil, stav) {
    if (stav === 'nic') return null;
    if (profil.id === 'cz')
      return { zavaznost: 'povinnost', citace: '§ 5 odst. 2 písm. f)', text: 'Musíš umožnit přejití chodci na přechodu i tomu, kdo zjevně hodlá přejít; v případě potřeby zastav.' };
    return stav === 'na_prechodu'
      ? { zavaznost: 'povinnost', citace: 'pravidlo 195', text: 'Chodec už vstoupil na přechod (zebru) – musíš mu dát přednost (MUST).' }
      : { zavaznost: 'doporuceni', citace: 'pravidlo 195', text: 'Chodec čeká u přechodu (zebry) – měl bys mu dát přednost (should).' };
  }

  // Chodec přechází (nebo čeká u) silnici, do které odbočuješ, mimo přechod.
  function chodecPriOdboceni(profil, stav) {
    if (stav === 'nic') return null;
    if (profil.id === 'cz')
      return stav === 'na_prechodu'
        ? { zavaznost: 'povinnost', citace: '§ 5 odst. 2 písm. g)', text: 'Při odbočování nesmíš ohrozit chodce, který přechází silnici, do které odbočuješ.' }
        : null;    // čekající chodec mimo přechod přednost nemá
    return { zavaznost: 'doporuceni', citace: 'pravidlo H2', text: stav === 'na_prechodu'
      ? 'Chodec už přechází silnici, do které odbočuješ – má přednost, počkej.'
      : 'Chodec čeká, že přejde silnici, do které odbočuješ – dej mu přednost.' };
  }

  // Zelená plná a chodci ve volném směru (na přechodu přes rameno, kam odbočuješ).
  function chodecNaZelenou(profil) {
    return profil.id === 'cz'
      ? { zavaznost: 'povinnost', citace: '§ 70 odst. 2 písm. c)', text: 'Při odbočování na zelenou musíš dát přednost chodcům přecházejícím ve volném směru.' }
      : { zavaznost: 'povinnost', citace: 'Light signals controlling traffic', text: 'Na zelenou při odbočování dej přednost chodcům, kteří přecházejí.' };
  }

  /* ---------- semafory ---------- */

  // Fáze jsou v obou státech stejné, liší se význam červené se žlutou jen popisem (obojí = nejet).
  // Červená = celá doba zelené druhé skupiny + 1 s „všude červená“ na každé straně.
  const FAZE = [
    { barva: 'cervena', delka: 19 },
    { barva: 'cervena_zluta', delka: 2 },
    { barva: 'zelena', delka: 12 },
    { barva: 'zluta', delka: 3 },
  ];
  const CYKLUS = FAZE.reduce((s, f) => s + f.delka, 0);

  // Barva v čase t (s) pro skupinu 0/1 (skupiny se střídají – jedna má zelenou, druhá červenou).
  function barvaSemaforu(t, skupina) {
    const posun = skupina ? CYKLUS - (FAZE[0].delka - 1) : 0;
    let x = ((t + posun) % CYKLUS + CYKLUS) % CYKLUS;
    for (const f of FAZE) { if (x < f.delka) return f.barva; x -= f.delka; }
    return 'cervena';
  }

  // Brzdná dráha (reakce 1 s + zpomalení 4 m/s²).
  const brzdnaDraha = v => v * 1 + v * v / (2 * 4);

  // Smí vozidlo přejet čáru? sipka = svítí doplňková / zelená šipka ve směru jízdy.
  // vzdalenost = metrů k čáře, v = rychlost (m/s). Vrací { smi, citace, text }.
  function smiNaSvetlo(profil, barva, { sipka = false, vzdalenost = Infinity, v = 0 } = {}) {
    const cz = profil.id === 'cz';
    if (barva === 'zelena') return { smi: true };
    if (sipka) return { smi: true, svetlo: 'doplnkova', citace: cz ? '§ 70 odst. 2 písm. g)' : 'Light signals controlling traffic', text: cz
      ? 'Doplňková zelená šipka: smíš jet jen ve směru šipky a dát přednost vozidlům ve volném směru.'
      : 'Zelená šipka: smíš jet ve směru šipky, ať svítí cokoli jiného, ale jen když je cesta volná.' };
    if (barva === 'zluta') {
      if (brzdnaDraha(v) > vzdalenost) return { smi: true, citace: cz ? '§ 70 odst. 2 písm. d)' : 'pravidlo 175', text: 'Žlutá naskočila tak blízko, že už bezpečně zastavit nejde – smíš pokračovat.' };
      return { smi: false, citace: cz ? '§ 70 odst. 2 písm. d)' : 'pravidlo 175', text: 'Žlutá znamená zastavit před čárou, pokud to jde bezpečně.' };
    }
    if (barva === 'cervena_zluta') return { smi: false, citace: cz ? '§ 70 odst. 2 písm. b)' : 'Light signals controlling traffic', text: cz
      ? 'Červená se žlutou: připrav se k jízdě, ale ještě nejeď.'
      : 'Červená se žlutou také znamená stůj – jeď až na zelenou.' };
    return { smi: false, citace: cz ? '§ 70 odst. 2 písm. a)' : 'pravidla 175 a 176', text: 'Červená: zastav před čárou.' };
  }

  /* ---------- další povinnosti ---------- */

  const STOP = {
    cz: { citace: '§ 22 odst. 4', text: 'U značky STOP musíš zastavit (úplně stát) na místě s rozhledem.' },
    uk: { citace: 'pravidlo 171', text: 'U značky STOP musíš zastavit za plnou čarou (MUST).' },
  };
  // Zastavil řidič u STOP? minRychlost = nejnižší rychlost v úseku před čarou (m/s).
  const zastavilUStop = minRychlost => minRychlost < 0.1;

  const ZAPLNENA = {
    cz: { citace: '§ 22 odst. 3', text: 'Do křižovatky nevjíždíš, když bys v ní musel zastavit (za ní není místo).' },
    uk: { citace: 'pravidla 174 a 176', text: 'Do křižovatky jeď jen tehdy, když ji můžeš bezpečně opustit (box junction: výjezd musí být volný).' },
  };
  // Smí vjet, když za křižovatkou není místo? Výjimka: čekání na odbočení přes protisměr.
  function smiVjetDoKrizovatky(profil, vyjezdVolny, cekamNaOdboceniPresProtismer) {
    return vyjezdVolny || cekamNaOdboceniPresProtismer;
  }

  const STRANA = {
    cz: { citace: '§ 11 odst. 1', text: 'V Česku se jezdí vpravo.' },
    uk: { citace: 'pravidlo 160', text: 'Ve Velké Británii se drž vlevo („keep to the left“).' },
  };

  const SRAZKA = {
    cz: { citace: '§ 4 písm. a)', text: 'Srážka – každý je povinen chovat se ohleduplně a ukázněně, aby neohrožoval život, zdraví ani majetek jiných.' },
    uk: { citace: 'pravidlo 144', text: 'Srážka – nesmíš řídit nebezpečně ani bez náležité pozornosti a ohledu na ostatní (MUST NOT).' },
  };
  const SMER_KRUHAC = {
    cz: { citace: 'značka C 1 (vyhl. 294/2015 Sb.)', text: 'Kruhový objezd se objíždí ve směru šipek – v Česku proti směru hodinových ručiček.' },
    uk: { citace: 'pravidla 185 a 188', text: 'Kruhový objezd se objíždí kolem středu ve směru hodinových ručiček.' },
  };
  const RYCHLOST = {
    cz: { citace: '§ 18 odst. 4', text: 'V obci smíš jet nejvýše 50 km/h.' },
    uk: { citace: 'pravidlo 124', text: 'V obci (silnice s pouličním osvětlením) smíš jet nejvýše 30 mph (MUST NOT exceed).' },
  };

  // Rychlost: překročení limitu o víc než měřicí toleranci 1 jednotky.
  function prekrocilRychlost(profil, v, limit = profil.limitObec) {
    return profil.naJednotku(v) > profil.naJednotku(limit) + 1;
  }

  const API = {
    PRUH, OKRAJ, MPH, PROFILY, SMERY, FAZE, CYKLUS, STOP, ZAPLNENA, STRANA, SRAZKA, SMER_KRUHAC, RYCHLOST,
    manevr, presProtismer, bodPruhu, draha, stret, prednost,
    kruhacPoHodinach, prednostKruhac, poradiVyjezdu, blinkrKruhac, blinkrOdboceni,
    chodecNaPrechodu, chodecPriOdboceni, chodecNaZelenou,
    barvaSemaforu, brzdnaDraha, smiNaSvetlo, zastavilUStop, smiVjetDoKrizovatky, prekrocilRychlost,
  };
  if (typeof module !== 'undefined') module.exports = API;
  else window.BLINKR_JADRO = API;
})();
