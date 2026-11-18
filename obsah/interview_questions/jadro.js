/* Příprava výslechu – jádro bez DOM (test: _test/interview_questions_test.js).
   Fáze podle modelu PEACE, banka otázek a pokynů podle role, techniky kognitivního rozhovoru,
   heuristická klasifikace typu otázky v češtině, kontrola plánu, přesuny, export/import JSON.
   Klasifikace je pomůcka: hledá typické jazykové vzorce, nerozumí kontextu a umí jen češtinu. */
(function () {
  'use strict';

  const FORMAT = 'webapp-priprava-vyslechu', VERZE = 1;

  /* ---------- fáze PEACE ---------- */
  // Account (vyprávění) je rozdělená na tři kroky: volné vyprávění → upřesnění → konfrontace se zjištěními
  const FAZE = [
    { id: 'P', pismeno: 'P', nazev: 'Plánování a příprava', en: 'Planning and preparation',
      popis: 'Co víme, co potřebujeme zjistit, co nesmí zaznít předčasně. Úkoly pro vyslýchajícího před rozhovorem.' },
    { id: 'E', pismeno: 'E', nazev: 'Navázání kontaktu a vysvětlení', en: 'Engage and explain',
      popis: 'Představení, účel a průběh rozhovoru, poučení, pravidla (nehádat, smí říct „nevím“, smí opravit vyslýchajícího).' },
    { id: 'A1', pismeno: 'A', nazev: 'Volné vyprávění', en: 'Account – free recall',
      popis: 'Jedna otevřená výzva a pak nepřerušovat. Vyslýchaný mluví, vyslýchající poslouchá a zapisuje témata k upřesnění.' },
    { id: 'A2', pismeno: 'A', nazev: 'Upřesnění', en: 'Account – clarify',
      popis: 'Postupně po tématech z vyprávění: nejdřív otevřeně, pak upřesňující otázky (kdo, co, kde, kdy, jak). Uzavřené až nakonec tématu.' },
    { id: 'A3', pismeno: 'A', nazev: 'Konfrontace se zjištěními', en: 'Account – challenge',
      popis: 'Až po vyčerpání vyprávění: rozpory a zjištění předkládat postupně, neutrálně a po každém nechat prostor pro vysvětlení.' },
    { id: 'C', pismeno: 'C', nazev: 'Uzavření', en: 'Closure',
      popis: 'Shrnutí výpovědi vlastními slovy vyslýchaného, prostor k doplnění a opravě, další postup.' },
    { id: 'Ev', pismeno: 'E', nazev: 'Vyhodnocení', en: 'Evaluation',
      popis: 'Po rozhovoru: co výpověď přinesla, co ověřit, jak proběhl rozhovor (vlastní otázky, sugesce).' }
  ];
  const FAZE_ID = FAZE.map(f => f.id);

  const ROLE = {
    svedek: 'Svědek',
    poskozeny: 'Poškozený',
    podezrely: 'Podezřelý / obviněný'
  };

  // připomenutí poučení – jen obecně; přesné znění podle platného předpisu a formuláře útvaru
  const POUCENI = {
    svedek: [
      'Povinnost vypovídat pravdu a nic nezamlčet; upozornění na následky křivé výpovědi.',
      'Právo odepřít výpověď za podmínek stanovených zákonem (např. kdyby výpovědí způsobil nebezpečí trestního stíhání sobě nebo osobě blízké).'
    ],
    poskozeny: [
      'Poškozený se zpravidla vyslýchá v postavení svědka – platí poučení svědka včetně práva odepřít výpověď za zákonných podmínek.',
      'Navíc poučení o právech poškozeného (např. uplatnit nárok na náhradu škody, právo na informace).'
    ],
    podezrely: [
      'Právo nevypovídat (odepřít výpověď / vysvětlení) a nesmí být k výpovědi ani k doznání nucen.',
      'Právo zvolit si obhájce a radit se s ním.',
      'Podání vysvětlení podezřelého a výslech obviněného jsou odlišné procesní úkony – postupujte podle příslušného formuláře poučení.'
    ]
  };

  /* ---------- techniky kognitivního rozhovoru (svědek, poškozený) ---------- */
  const TECHNIKY = {
    kontext: {
      nazev: 'Navození kontextu',
      text: 'Zkuste se v duchu vrátit na místo, kde jste tehdy byl/a. Vybavte si, kde jste stál/a, jaké bylo světlo, zvuky a jak jste se cítil/a. Až budete připraven/a, popište, co se dělo.',
      proc: 'Vzpomínky se lépe vybavují, když se obnoví okolnosti, za kterých vznikly (fyzické i emoční).',
      meze: 'Dát čas, netlačit. U traumatizovaných osob opatrně – vybavování emocí může být zatěžující. Zavření očí nabídnout, nevyžadovat.'
    },
    vse: {
      nazev: 'Řekněte vše',
      text: 'Řekněte prosím všechno, co si vybavíte, i drobnosti, které vám připadají nedůležité. Když si něco nepamatujete, klidně to řekněte – nemusíte nic domýšlet.',
      proc: 'Vyslýchaný sám neví, co je pro vyšetřování podstatné; drobnosti pomáhají ověřit výpověď a vybavit si další.',
      meze: 'Výslovně dovolit „nevím“ – tlak na úplnost bez tohoto upozornění může vést k domýšlení (konfabulaci).'
    },
    poradi: {
      nazev: 'Změna pořadí',
      text: 'Zkuste teď události popsat v jiném pořadí – třeba od konce k začátku, nebo od okamžiku, který si vybavujete nejlépe.',
      proc: 'Jiná cesta paměti může vybavit podrobnosti, které při chronologickém vyprávění zapadly.',
      meze: 'Kognitivně náročné; až po volném vyprávění. Odchylky v pořadí samy o sobě nesvědčí o nepravdivosti.'
    },
    perspektiva: {
      nazev: 'Změna perspektivy',
      text: 'Zkuste popsat, co mohl z místa vidět nebo slyšet někdo, kdo stál jinde (např. u vchodu).',
      proc: 'Původní metoda ji uvádí jako další cestu k vybavení podrobností.',
      meze: 'Sporná technika: může svádět k domýšlení toho, co osoba sama nevnímala. Některé novější postupy ji vynechávají nebo používají jen výjimečně; u dětí se nedoporučuje. Výsledek oddělit od vlastního vnímání.'
    }
  };

  /* ---------- banka ---------- */
  // druh: otazka (klasifikuje se) | pokyn (úkol pro vyslýchajícího) | technika (pokyn vyslýchanému, kognitivní rozhovor)
  // v: true = výchozí součást nové přípravy
  const P_UKOLY = [
    { t: 'Prostudovat spis: co je zjištěno, z jakých zdrojů a co dosud nikdo neověřil.', v: 1 },
    { t: 'Stanovit cíle výslechu – co má výslech objasnit.', v: 1 },
    { t: 'Sepsat zjištění, která nesmí zaznít předčasně (aby nebyla výpověď ovlivněna).', v: 1 },
    { t: 'Ověřit zvláštní potřeby: věk, zdravotní stav, tlumočník, opatrovník, důvěrník.', v: 1 },
    { t: 'Rozhodnout o způsobu záznamu (protokol, audio, video) a připravit místnost.' },
    { t: 'Připravit formulář poučení podle procesního postavení osoby.', v: 1 }
  ];
  const EV_UKOLY = [
    { t: 'Porovnat výpověď se zjištěními a s ostatními výpověďmi.', v: 1 },
    { t: 'Zapsat nová témata a stopy k prověření.', v: 1 },
    { t: 'Zhodnotit vlastní postup: uzavřené či sugestivní otázky, přerušování, nevyužitá témata.', v: 1 },
    { t: 'Rozhodnout o dalším postupu (doplňující výslech, konfrontace, rekognice).' }
  ];
  const E_SPOLECNE = [
    { t: 'Představit se, vysvětlit účel a průběh rozhovoru a způsob záznamu.', v: 1 },
    { t: 'Poučit osobu podle procesního postavení a ověřit, že poučení porozuměla.', v: 1 }
  ];
  const E_PRAVIDLA = { t: 'Vysvětlit pravidla: mluví hlavně vyslýchaný, nemá hádat, smí říct „nevím“ a smí vyslýchajícího opravit.', v: 1 };
  const C_SPOLECNE = [
    { t: 'Shrnout výpověď a nechat vyslýchaného shrnutí opravit.', v: 1 },
    { t: 'Vysvětlit další postup a předat kontakt.', v: 1 }
  ];

  const BANKA_ZDROJ = {
    svedek: {
      E: [...E_SPOLECNE, E_PRAVIDLA,
        { q: 'Uveďte prosím jméno, datum narození a adresu.', v: 1 },
        { q: 'Jaký je váš vztah k osobám, kterých se věc týká?' },
        { q: 'Kdy jste o věci vypovídal/a už dříve?' }],
      A1: [{ q: 'Popište vlastními slovy všechno, co jste viděl/a nebo slyšel/a, od začátku do konce.', v: 1 },
        { tech: 'kontext' }, { tech: 'vse' },
        { q: 'Co se dělo potom?' }],
      A2: [{ q: 'Kde přesně jste se nacházel/a, když k události došlo?', v: 1 },
        { q: 'Z jaké vzdálenosti jste událost sledoval/a?' },
        { q: 'Jaké bylo osvětlení a počasí?' },
        { q: 'Co vám mohlo vnímání ztížit (zrak, sluch, rozptýlení)?' },
        { q: 'Jak jste určil/a, kolik bylo hodin?' },
        { q: 'Jak dlouho událost trvala?' },
        { q: 'Popište vzhled osob, které jste viděl/a – postavu, oblečení, chování.', v: 1 },
        { q: 'Kdo další byl v tu dobu na místě?' },
        { q: 'Podle čeho byste osobu poznal/a?' },
        { q: 'Jak jste se o tom, co uvádíte, dozvěděl/a?' },
        { tech: 'poradi' }, { tech: 'perspektiva' }],
      A3: [{ t: 'Rozpory s jinými zjištěními předkládat až po vyčerpání vyprávění, neutrálně a bez obviňování.' },
        { q: 'Jiné zjištění se od vaší výpovědi liší v čase. Jak si rozdíl vysvětlujete?' }],
      C: [{ q: 'Na co jsme se nezeptali a vy to považujete za důležité?', v: 1 },
        { q: 'Chcete ke své výpovědi něco doplnit?', v: 1 },
        ...C_SPOLECNE]
    },
    poskozeny: {
      E: [...E_SPOLECNE, E_PRAVIDLA,
        { q: 'Uveďte prosím jméno, datum narození, adresu a kontakt pro další komunikaci.', v: 1 },
        { t: 'Zjistit, zda poškozený potřebuje podporu (doprovod, pomoc obětem) a jak se právě cítí.' }],
      A1: [{ q: 'Popište průběh události vlastními slovy od začátku do konce.', v: 1 },
        { tech: 'kontext' }, { tech: 'vse' },
        { q: 'Co se dělo potom?' }],
      A2: [{ q: 'Jak jste zjistil/a, že k události došlo?' },
        { q: 'Jaká škoda vám vznikla – majetková, zdravotní nebo jiná?', v: 1 },
        { q: 'Jakými doklady můžete výši škody doložit?' },
        { q: 'V jaké výši uplatňujete nárok na náhradu škody?' },
        { q: 'Kdo kromě vás byl u události přítomen?', v: 1 },
        { q: 'Jaké ošetření jste po události potřeboval/a?' },
        { q: 'Popište osobu, která vám škodu způsobila – vzhled, oblečení, chování.' },
        { q: 'Jaký vztah jste měl/a před událostí k osobě, která vám škodu způsobila?' },
        { tech: 'poradi' }, { tech: 'perspektiva' }],
      A3: [{ t: 'Rozpory s jinými zjištěními předkládat až po vyčerpání vyprávění, neutrálně a bez obviňování.' },
        { q: 'Jiné zjištění se od vaší výpovědi liší. Jak si rozdíl vysvětlujete?' }],
      C: [{ q: 'Na co jsme se nezeptali a vy to považujete za důležité?', v: 1 },
        { q: 'Chcete ke své výpovědi něco doplnit?', v: 1 },
        ...C_SPOLECNE]
    },
    podezrely: {
      E: [...E_SPOLECNE,
        { t: 'Ověřit, zda chce osoba obhájce, a pokud ano, umožnit jeho přítomnost.', v: 1 },
        { q: 'Uveďte prosím jméno, datum narození, adresu a zaměstnání.', v: 1 },
        { q: 'Chcete se k věci vyjádřit?', v: 1 }],
      A1: [{ q: 'Popište, jak jste strávil/a dobu, o kterou jde – od začátku do konce.', v: 1 },
        { q: 'Popište vlastními slovy, co o věci víte.' },
        { q: 'Co se dělo potom?' }],
      A2: [{ q: 'Kdo může vaši přítomnost na uvedeném místě potvrdit?', v: 1 },
        { q: 'Jaký je váš vztah k poškozenému a k ostatním osobám ve věci?' },
        { q: 'Kde jste byl/a před událostí?' },
        { q: 'Jaké předměty jste měl/a v té době u sebe?' },
        { q: 'Kdo kromě vás používá váš telefon a vozidlo?' },
        { q: 'S kým jste byl/a v té době v kontaktu?', v: 1 }],
      A3: [{ t: 'Zjištění předkládat postupně, jedno po druhém; nejdřív se zeptat, pak předložit, a po každém nechat prostor pro vysvětlení.', v: 1 },
        { q: 'Podle zjištění … . Jak to vysvětlíte?' }],
      C: [{ q: 'Chcete k výpovědi ještě něco doplnit?', v: 1 },
        ...C_SPOLECNE]
    }
  };

  // sestavení banky: [{id, faze, druh, text, tech?, vychozi}]
  const BANKA = {};
  for (const role of Object.keys(BANKA_ZDROJ)) {
    const r = [];
    const pridej = (faze, x, i) => {
      const druh = x.tech ? 'technika' : x.q ? 'otazka' : 'pokyn';
      const text = x.tech ? TECHNIKY[x.tech].text : (x.q || x.t);
      r.push({ id: role + '-' + faze + '-' + i, faze, druh, text, tech: x.tech || null, vychozi: !!x.v });
    };
    P_UKOLY.forEach((x, i) => pridej('P', x, i));
    for (const f of ['E', 'A1', 'A2', 'A3', 'C']) BANKA_ZDROJ[role][f].forEach((x, i) => pridej(f, x, i));
    EV_UKOLY.forEach((x, i) => pridej('Ev', x, i));
    BANKA[role] = r;
  }

  /* ---------- klasifikace otázek ---------- */
  const TYPY = {
    otevrena:    { nazev: 'otevřená', uroven: 'ok', popis: 'Výzva k vlastnímu vyprávění („Popište…“, „Co se stalo…“). Nejméně ovlivňuje odpověď.' },
    upresnujici: { nazev: 'upřesňující (5W)', uroven: 'ok', popis: 'Ptá se kdo, co, kde, kdy, jak, proč, kolik. Vhodná ve fázi upřesnění.' },
    uzavrena:    { nazev: 'uzavřená ano/ne', uroven: 'pozor', popis: 'Odpověď ano/ne nebo výběr z nabídnutých možností. Až na konci tématu, ne ve volném vyprávění.' },
    sugestivni:  { nazev: 'sugestivní', uroven: 'riziko', popis: 'Naznačuje očekávanou odpověď. Může zkreslit výpověď a snížit její hodnotu.' },
    vicenasobna: { nazev: 'vícenásobná', uroven: 'riziko', popis: 'Dvě otázky v jedné – není jasné, na kterou vyslýchaný odpověděl.' },
    predpoklad:  { nazev: 's předpokladem', uroven: 'riziko', popis: 'Předpokládá skutečnost, kterou vyslýchaný sám neuvedl (např. „ten nůž“).' },
    jine:        { nazev: 'sdělení / jiné', uroven: 'ok', popis: 'Není otázkou ani výzvou (např. předložení zjištění) – kontrola nic nehodnotí.' },
    neurceno:    { nazev: 'neklasifikováno', uroven: 'ok', popis: 'Text nevypadá česky – heuristika pracuje jen s češtinou.' },
    pokyn:       { nazev: 'úkol', uroven: 'ok', popis: 'Úkol pro vyslýchajícího, neklasifikuje se.' }
  };
  const PORADI_TYPU = ['sugestivni', 'vicenasobna', 'predpoklad', 'uzavrena', 'upresnujici', 'otevrena', 'jine', 'neurceno'];

  const TAZACI = new Set(('kdo koho komu kom kým co čeho čemu čem čím kde kdy jak jaký jaká jaké jakou jakého jakém jakým jakých jakými jací jakému ' +
    'který která které kterou kterého kterém kterým kterých kterými kteří kterému proč kolik kolikrát kolikátého čí čího čí čímž odkud kam kudy nakolik dokdy odkdy').split(' '));
  const PREDLOZKY = new Set('s se z ze v ve na do od po k ke o u za před pro při mezi nad pod přes kvůli podle během'.split(' '));
  const UVOD_VYPUSTIT = new Set('a tak dobře prosím nyní teď pak dále pane paní'.split(' '));
  const VYZVY = new Set(('popište popiš popisujte řekněte řekni vyprávějte vyprávěj vysvětlete vysvětli vylíčte vylič přibližte zkuste zkus ' +
    'představte vraťte začněte pokračujte rozveďte doplňte vybavte zamyslete projděte').split(' '));
  const ZDVORILE = new Set('dokážete můžete mohl mohla mohli zkusil zkusila chtěl chtěla byste'.split(' '));
  const VYPRAVET = new Set('popsat říct říci vylíčit vyprávět vysvětlit přiblížit rozvést popsal popsala'.split(' '));
  const SLOVESA_2OS = new Set('jste jsi máte víte znáte chcete můžete budete byste umíte vidíte myslíte'.split(' '));
  const ZAJMENA_UKAZ = new Set('ten ta tu toho tomu tím té ty těch tou tento tato toto tuto tohoto tomto této tyto těchto tenhle tahle tuhle tomhle'.split(' '));
  const NE_VYJIMKY = new Set('nebo než nejdřív nejprve nedávno nejen nejvíc nejlépe nejméně nejspíš neboť nejdéle nejblíž nejbližší nejdůležitější'.split(' '));
  const NAZOROVA = new Set('přece přeci určitě jistě samozřejmě vždyť'.split(' '));
  // podstatná jména, u nichž ukazovací zájmeno odkazuje na samotnou vyšetřovanou událost (tu noc, v té době…)
  const BILE_KMENY = ['dob', 'chvíl', 'den', 'dn', 'noc', 'večer', 'rán', 'okamžik', 'moment', 'událost', 'věc', 'míst', 'případ',
    'protokol', 'výpov', 'otázk', 'dotaz', 'situac', 'období', 'čas', 'dnes', 'zjištěn', 'rozdíl', 'rozpor'];
  const NEJSOU_PODST = new Set('jsem jsi je jsme jste jsou byl byla bylo byli se si mi ti mu ho jí a i nebo že který která které co kdo jak kde kdy už ještě také taky jen'.split(' '));

  const CZ_ZNAKY = /[ěščřžýůťďňĚŠČŘŽÝŮŤĎŇ]/;
  const CZ_SLOVA = new Set('jste jsi je se co kde kdy jak proč kdo a v na že to byl byla jsem vám vás nebo popište řekněte uveďte tam kolik jaký jaká jaké'.split(' '));

  function slova(s) {
    return (s.toLowerCase().replace(/\/\p{L}+/gu, '').match(/[\p{L}\d]+/gu) || []);
  }
  function vypadaCesky(text) {
    const s = String(text || '');
    if (CZ_ZNAKY.test(s)) return true;
    const w = slova(s);
    if (!w.length) return false;
    const n = w.filter(x => CZ_SLOVA.has(x)).length;
    return n >= 1 && n / w.length >= 0.15;
  }
  // věty včetně koncového znaménka
  function vety(text) {
    return (String(text).match(/[^.!?…]+[.!?…]*/g) || []).map(x => x.trim()).filter(Boolean);
  }
  const jePricesti = w => /(l|la|lo|li|ly)$/.test(w) && w.length >= 3;

  function klasifikuj(text, druh) {
    const vystup = { typ: 'jine', zaklad: 'jine', uroven: 'ok', pravidla: [], navrhy: [] };
    if (druh === 'pokyn') return Object.assign(vystup, { typ: 'pokyn', zaklad: 'pokyn' });
    const puvodni = String(text || '').trim();
    if (!puvodni) return vystup;
    if (!vypadaCesky(puvodni)) return Object.assign(vystup, { typ: 'neurceno', zaklad: 'neurceno' });

    const pravidlo = (id, typ, popis, uryvek) => vystup.pravidla.push({ id, typ, popis, uryvek: uryvek || '' });
    const vs = vety(puvodni);
    const otazky = vs.filter(v => /\?\s*$/.test(v));
    const pocetOtazniku = (puvodni.match(/\?/g) || []).length;
    // klasifikuje se poslední otázka (předchozí věty bývají předložené zjištění), jinak první věta
    const hlavni = otazky.length ? otazky[otazky.length - 1] : vs[0];
    const kontextPred = puvodni.slice(0, puvodni.lastIndexOf(hlavni)).toLowerCase();
    const jeOtazka = /\?\s*$/.test(hlavni);
    const w = slova(hlavni);
    let i = 0;
    while (i < w.length - 1 && UVOD_VYPUSTIT.has(w[i])) i++;
    const prvni = w[i] || '', druhe = w[i + 1] || '';
    const zbytek = w.slice(i + 1);
    const hl = ' ' + w.join(' ') + ' ';

    // --- základní tvar ---
    let zaklad;
    if (VYZVY.has(prvni)) { zaklad = 'otevrena'; pravidlo('vyzva', 'otevrena', 'začíná výzvou k vyprávění', prvni); }
    else if (ZDVORILE.has(prvni) && zbytek.slice(0, 4).some(x => VYPRAVET.has(x))) {
      zaklad = 'otevrena'; pravidlo('zdvorila-vyzva', 'otevrena', 'zdvořilá výzva k popisu („Můžete popsat…“)', prvni + ' … ' + zbytek.slice(0, 4).find(x => VYPRAVET.has(x)));
    } else if (prvni === 'uveďte' || prvni === 'uveď') { zaklad = 'upresnujici'; pravidlo('uvedte', 'upresnujici', 'žádost o konkrétní údaje', prvni); }
    else {
      const taz = TAZACI.has(prvni) ? prvni : (PREDLOZKY.has(prvni) && TAZACI.has(druhe) ? druhe : null);
      if (taz) {
        if (taz === 'co' && / (se stalo|se dělo|následovalo|dalšího|vybavujete|pamatujete|víte o|můžete říct|můžete uvést) /.test(hl)) {
          zaklad = 'otevrena'; pravidlo('co-se-stalo', 'otevrena', 'otevřená otázka na děj („Co se stalo / dělo…“)', 'co …');
        } else if (taz === 'jak' && / (probíhal|probíhala|probíhalo|vypadal|vypadala|vypadalo|to celé) /.test(hl)) {
          zaklad = 'otevrena'; pravidlo('jak-probihalo', 'otevrena', 'otevřená otázka na průběh či popis', 'jak …');
        } else { zaklad = 'upresnujici'; pravidlo('tazaci', 'upresnujici', 'začíná tázacím slovem (kdo, co, kde, kdy, jak…)', (taz !== prvni ? prvni + ' ' : '') + taz); }
      } else if (jeOtazka) {
        zaklad = 'uzavrena'; pravidlo('bez-tazaciho', 'uzavrena', 'otázka nezačíná tázacím slovem – odpověď ano/ne', w.slice(i, i + 2).join(' '));
        if (/,\s*(nebo|anebo|či)\s/i.test(hlavni)) pravidlo('alternativa', 'uzavrena', 'alternativní otázka – nabízí jen zadané možnosti', (hlavni.match(/,\s*(nebo|anebo|či)\s+\S+/i) || [''])[0]);
      } else zaklad = 'jine';
    }
    vystup.zaklad = zaklad;
    const vyzva = zaklad === 'otevrena' && vystup.pravidla.some(p => p.id === 'vyzva' || p.id === 'zdvorila-vyzva');

    // --- sugestivní ---
    if (jeOtazka) {
      if (/^ne\p{L}{2,}$/u.test(prvni) && !NE_VYJIMKY.has(prvni) && !TAZACI.has(prvni)) pravidlo('zapor', 'sugestivni', 'záporná otázka („Nebyl to…?“) naznačuje očekávanou odpověď', w.slice(i, i + 3).join(' '));
      const tag = hlavni.match(/,\s*(že|ne|nebo ne|viďte|viď|pravda|ano|správně|že jo|jo)\s*\?\s*$/i);
      if (tag) pravidlo('dovetek', 'sugestivni', 'dovětek „…, že?“ žádá souhlas', tag[0].trim());
    }
    const tvrz = hlavni.match(/^(a\s+)?(je pravda,? že|že|takže|souhlasíte,? že|přiznáváte,? že|potvrzujete,? že|připouštíte,? že|víte přece|ale vždyť)\b/i);
    if (tvrz) pravidlo('tvrzeni', 'sugestivni', 'otázka je ve skutečnosti tvrzení, se kterým má vyslýchaný souhlasit', tvrz[0]);
    const naz = w.find(x => NAZOROVA.has(x));
    if (naz && (jeOtazka || zaklad !== 'otevrena')) pravidlo('nazor', 'sugestivni', 'hodnotící slovo vnáší očekávání vyslýchajícího', naz);

    // --- vícenásobná ---
    if (pocetOtazniku >= 2) pravidlo('dva-otazniky', 'vicenasobna', 'v textu jsou dva a více otazníků', pocetOtazniku + '× „?“');
    if (!vyzva) {
      const spojky = new Set(['a', 'i', 'nebo', 'anebo', 'či']);
      const tazIdx = w.map((x, k) => TAZACI.has(x) ? k : -1).filter(k => k >= 0);
      let nalezeno = false;
      for (const k of tazIdx.filter(k => k > 0)) {
        const pred = w.slice(Math.max(0, k - 2), k);
        const sp = pred.find(x => spojky.has(x));
        const slovesoPred = w.slice(0, k - 1).some(x => SLOVESA_2OS.has(x) || /(áte|íte|ete|ěte)$/.test(x) && x.length >= 5);
        if (sp && (tazIdx[0] < k - 1 || slovesoPred)) { pravidlo('dve-tazaci', 'vicenasobna', 'spojka připojuje druhou otázku', w.slice(Math.max(0, k - 2), k + 1).join(' ')); nalezeno = true; break; }
      }
      if (!nalezeno) {
        for (let k = 1; k < w.length - 1; k++) {
          if (!spojky.has(w[k])) continue;
          const dal = w.slice(k + 1, k + 3);
          const sl = dal.find(x => SLOVESA_2OS.has(x) || (/(áte|íte|ete|ěte)$/.test(x) && x.length >= 5));
          const predtim = w.slice(0, k).some(x => SLOVESA_2OS.has(x) || /(áte|íte|ete|ěte)$/.test(x) && x.length >= 5);
          if (sl && predtim) { pravidlo('dve-vety', 'vicenasobna', 'spojka spojuje dvě věty s vlastním slovesem', w.slice(k, k + 3).join(' ')); break; }
        }
      }
    }

    // --- předpoklad ---
    for (let k = 0; k < w.length - 1; k++) {
      const n = w[k + 1];
      // „to“ samo bývá zájmeno (Co to bylo?) – jen před přídavným jménem („to modré auto“)
      const toPridavne = w[k] === 'to' && /(é|ý|á|í)$/.test(n) && n.length >= 4 && k + 2 < w.length && !NEJSOU_PODST.has(w[k + 2]) && !/(l|la|lo|li|ly)$/.test(w[k + 2]);
      if (!ZAJMENA_UKAZ.has(w[k]) && !toPridavne) continue;
      if (NEJSOU_PODST.has(n) || TAZACI.has(n) || n.length < 3 || /\d/.test(n)) continue;
      if (/(ěl|il|al|yl|ul|el|la|lo|li|ly)$/.test(n) || /(áte|íte|ete|ěte|ám|ím|eme|íme|ou)$/.test(n) && n.length > 4 && SLOVESA_2OS.has(n)) continue;
      if (BILE_KMENY.some(km => n.startsWith(km))) continue;
      const kmen = n.slice(0, Math.max(3, n.length - 2));
      if (kontextPred.includes(kmen)) continue;   // věc už zazněla v předchozí větě (předložené zjištění)
      pravidlo('ukazovaci', 'predpoklad', 'ukazovací zájmeno předpokládá, že věc už je známá', w.slice(k, toPridavne ? k + 3 : k + 2).join(' '));
      break;
    }
    if (jeOtazka) {
      const proc = hlavni.match(/(?:^|\s)proč\s+(jste|jsi)\s+(?:(?:ho|ji|je|mu|jí|to|se|si|tam)\s+)?(\p{L}+)/iu);
      if (proc && jePricesti(proc[2].toLowerCase())) pravidlo('proc-jste', 'predpoklad', '„Proč jste…“ předpokládá, že jednání proběhlo – jen pokud ho vyslýchaný sám uvedl', proc[0].trim());
      const pr = w.find(x => /^(přestal|přestala|přestali|zase|opět)$/.test(x));
      if (pr) pravidlo('opakovani', 'predpoklad', 'slovo předpokládá dřívější jednání', pr);
    }

    // --- výsledný typ ---
    const typy = new Set(vystup.pravidla.map(p => p.typ));
    vystup.typ = PORADI_TYPU.find(t => typy.has(t)) || zaklad;
    if (['otevrena', 'upresnujici'].includes(vystup.typ) === false && vystup.typ === 'jine') vystup.typ = zaklad;
    const urovne = vystup.pravidla.map(p => TYPY[p.typ].uroven);
    vystup.uroven = urovne.includes('riziko') ? 'riziko' : urovne.includes('pozor') ? 'pozor' : 'ok';
    vystup.navrhy = navrhni(hlavni, w, i, vystup, puvodni);
    return vystup;
  }

  // návrhy otevřenější formulace – jen šablony, vyslýchající je musí přizpůsobit
  function navrhni(hlavni, w, i, v, puvodni) {
    const typy = new Set(v.pravidla.map(p => p.typ));
    const out = [];
    if (typy.has('vicenasobna')) {
      const casti = puvodni.split(/\?\s*/).map(x => x.trim()).filter(Boolean);
      if (casti.length >= 2) out.push('Rozdělte na samostatné otázky: ' + casti.map((c, k) => (k + 1) + ') ' + c + '?').join(' '));
      else {
        const m = hlavni.match(/^(.*?)(,?\s+(?:a|i|nebo|anebo|či)\s+)(.*?)\??$/i);
        if (m) out.push('Rozdělte na samostatné otázky: 1) ' + m[1].replace(/[,\s]+$/, '') + '? 2) ' + (s => s.charAt(0).toUpperCase() + s.slice(1))(m[3].replace(/^(jste|jsi)\s+(\S+)/, '$2 $1')) + '?');
        else out.push('Rozdělte na samostatné otázky a ptejte se postupně.');
      }
    }
    const ukaz = v.pravidla.find(p => p.id === 'ukazovaci');
    if (ukaz) out.push('Nezmiňujte „' + ukaz.uryvek + '“, dokud to neuvede sám vyslýchaný. Např.: „Popište, co jste viděl/a.“ – a pak: „Co měla osoba u sebe?“');
    const dov = v.pravidla.find(p => p.id === 'dovetek');
    if (dov) out.push('Bez dovětku a otevřeně, např.: „Popište, jak to bylo.“');
    if (typy.has('sugestivni') || typy.has('uzavrena')) {
      let s = w[i] || '';
      if (/^ne/.test(s) && !NE_VYJIMKY.has(s)) s = s.slice(2);
      const druheSlovo = w[i + 1] || '';
      if (jePricesti(s) && (druheSlovo === 'jste' || druheSlovo === 'jsi')) {
        if (/^byl/.test(s)) out.push('Otevřeněji: „Popište, kde jste byl/a a co jste tam dělal/a.“');
        else out.push('Otevřeněji: „Popište, co jste ' + s + (s.endsWith('l') ? '/a' : '') + '.“');
      } else if (/^(byl|byla|bylo|byli)$/.test(s) && druheSlovo === 'to') out.push('Otevřeněji: „Kdo to byl?“ nebo „Popište osobu, kterou jste viděl/a.“');
      else if (typy.has('sugestivni') || v.zaklad === 'uzavrena') out.push('Otevřeněji: „Popište vlastními slovy, co se stalo.“ nebo upřesňující otázkou „Kdo / co / kde / kdy / jak…?“');
    }
    if (v.pravidla.some(p => p.id === 'proc-jste')) out.push('Nejdřív ověřte, že jednání vyslýchaný sám uvedl; jinak: „Popište, co jste v tu dobu dělal/a.“');
    if (v.pravidla.some(p => p.id === 'tvrzeni' || p.id === 'nazor')) out.push('Vypusťte hodnocení a tvrzení – zeptejte se na skutečnost, ne na souhlas.');
    if (typy.has('predpoklad') && !out.length) out.push('Ověřte, že tuto skutečnost uvedl sám vyslýchaný; jinak se ptejte otevřeně a bez ní.');
    return [...new Set(out)];
  }

  /* ---------- příprava (plán výslechu) ---------- */
  let citac = 0;
  const novyId = p => (p || 'q') + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 5);

  function polozkaZBanky(b) {
    return { id: novyId('q'), faze: b.faze, druh: b.druh, text: b.text, tech: b.tech || null, zdroj: 'banka', bankaId: b.id, pozn: '' };
  }
  function novaPolozka(faze, text, druh) {
    return { id: novyId('q'), faze: FAZE_ID.includes(faze) ? faze : 'A2', druh: druh || 'otazka', text: String(text || '').trim(), tech: null, zdroj: 'vlastni', bankaId: null, pozn: '' };
  }
  function novaPriprava(role, nazev) {
    role = ROLE[role] ? role : 'svedek';
    return {
      id: novyId('p'), nazev: nazev || 'Nová příprava', osoba: '', role, cil: '', temata: '', datum: new Date().toISOString().slice(0, 10),
      polozky: BANKA[role].filter(b => b.vychozi).map(polozkaZBanky), zmeneno: Date.now()
    };
  }
  // modelový případ: role a otázky ze spisu (MODELOVY_PRIPAD.vyslech), volné vyprávění → konfrontace na konci
  function modelovaPriprava(P) {
    const v = P.vyslech;
    const pr = novaPriprava(v.role, 'Modelový případ 17/2026 – ' + v.osoba);
    pr.id = 'pripad17';
    pr.osoba = v.osoba;
    pr.cil = 'Ověřit alibi „celou noc doma“ proti polohové historii telefonu a objasnit hovory s T. Brabcem a R. Křížem.';
    pr.temata = ['Poloha telefonu 01:58–02:14 (Horní Lhota × Dolní Lhota)', 'Hovor s T. Brabcem ve 01:31', 'Hovor s R. Křížem ve 03:05 (cca 4 min)', 'Kdo má přístup k telefonu'].join('\n');
    pr.polozky = pr.polozky.filter(p => !(p.faze === 'A1' && p.druh === 'otazka') && !(p.faze === 'A3' && p.druh === 'otazka'));
    const vlozZa = (faze, texty) => {
      let idx = -1;
      pr.polozky.forEach((p, k) => { if (FAZE_ID.indexOf(p.faze) <= FAZE_ID.indexOf(faze)) idx = k; });
      const nove = texty.map(t => Object.assign(novaPolozka(faze, t), { zdroj: 'pripad' }));
      pr.polozky.splice(idx + 1, 0, ...nove);
    };
    vlozZa('A1', v.otevrene);
    vlozZa('A3', v.konfrontace);
    return pr;
  }

  // položky seřazené po fázích (pořadí uvnitř fáze zůstává)
  function poFazich(pr) {
    const m = {};
    FAZE_ID.forEach(f => { m[f] = []; });
    pr.polozky.forEach(p => (m[p.faze] || m.A2).push(p));
    return m;
  }
  function srovnej(pr) {
    const m = poFazich(pr);
    pr.polozky = FAZE_ID.flatMap(f => m[f]);
    return pr;
  }
  // posun o jedno místo v rámci fáze
  function posun(pr, id, smer) {
    srovnej(pr);
    const k = pr.polozky.findIndex(p => p.id === id);
    if (k < 0) return false;
    const j = k + (smer < 0 ? -1 : 1);
    if (j < 0 || j >= pr.polozky.length || pr.polozky[j].faze !== pr.polozky[k].faze) return false;
    [pr.polozky[k], pr.polozky[j]] = [pr.polozky[j], pr.polozky[k]];
    return true;
  }
  // přesun do fáze před položku predId (null = na konec fáze)
  function presunNa(pr, id, faze, predId) {
    const k = pr.polozky.findIndex(p => p.id === id);
    if (k < 0 || !FAZE_ID.includes(faze) || id === predId) return false;
    const [p] = pr.polozky.splice(k, 1);
    p.faze = faze;
    srovnej(pr);
    let j = predId ? pr.polozky.findIndex(x => x.id === predId) : -1;
    if (j < 0 || pr.polozky[j].faze !== faze) {
      j = -1;
      pr.polozky.forEach((x, n) => { if (FAZE_ID.indexOf(x.faze) <= FAZE_ID.indexOf(faze)) j = n; });
      j++;
    }
    pr.polozky.splice(j, 0, p);
    return true;
  }

  // metodická kontrola plánu – upozornění, ne zákazy
  function kontrolaPlanu(pr) {
    const m = poFazich(pr), out = [];
    const tridy = p => klasifikuj(p.text, p.druh);
    const otazkyA1 = m.A1.filter(p => p.druh !== 'pokyn');
    if (!otazkyA1.length) out.push({ uroven: 'pozor', text: 'Fáze volného vyprávění je prázdná – výslech by měl začít otevřenou výzvou k vyprávění.' });
    otazkyA1.forEach(p => {
      const k = tridy(p);
      if (!['otevrena', 'upresnujici', 'jine', 'neurceno'].includes(k.typ)) out.push({ uroven: 'pozor', id: p.id, text: 'Ve volném vyprávění je ' + TYPY[k.typ].nazev + ' otázka: „' + zkrat(p.text) + '“ – patří spíš do upřesnění.' });
    });
    if (m.A3.some(p => p.druh !== 'pokyn') && m.A2.filter(p => p.druh !== 'pokyn').length === 0 && otazkyA1.length === 0)
      out.push({ uroven: 'pozor', text: 'Konfrontace bez předchozího vyprávění a upřesnění – zjištění by měla přijít až nakonec.' });
    let rizik = 0;
    pr.polozky.forEach(p => { if (p.druh !== 'pokyn' && tridy(p).uroven === 'riziko') rizik++; });
    if (rizik) out.push({ uroven: 'riziko', text: 'Rizikové formulace (sugestivní, vícenásobné, s předpokladem): ' + rizik + '. Zkontrolujte označené otázky.' });
    if (!m.C.length) out.push({ uroven: 'pozor', text: 'Chybí uzavření – shrnutí a prostor k doplnění.' });
    return out;
  }
  const zkrat = (t, n = 60) => t.length > n ? t.slice(0, n - 1) + '…' : t;

  // prostý text plánu (náhled, schránka, test)
  function textPlanu(pr) {
    const m = poFazich(pr), r = [];
    r.push('PŘÍPRAVA VÝSLECHU – ' + pr.nazev);
    if (pr.osoba) r.push('Osoba: ' + pr.osoba);
    r.push('Postavení: ' + ROLE[pr.role] + (pr.datum ? ' · datum: ' + pr.datum : ''));
    if (pr.cil) r.push('Cíl: ' + pr.cil);
    r.push('', 'POUČENÍ (připomenutí): ' + POUCENI[pr.role].join(' '));
    const temata = String(pr.temata || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (temata.length) r.push('', 'TÉMATA K OVĚŘENÍ:', ...temata.map(t => '  [ ] ' + t));
    let n = 0;
    FAZE.forEach(f => {
      if (!m[f.id].length) return;
      r.push('', f.pismeno + ' – ' + f.nazev.toUpperCase() + ' (' + f.en + ')');
      m[f.id].forEach(p => {
        const k = klasifikuj(p.text, p.druh);
        r.push(p.druh === 'pokyn' ? '  [ ] ' + p.text : '  ' + (++n) + '. ' + p.text + '  [' + TYPY[k.typ].nazev + ']');
        if (p.pozn) r.push('      pozn.: ' + p.pozn);
      });
    });
    return r.join('\n');
  }

  /* ---------- export / import ---------- */
  // id jde do atributů data-* a selektorů → jen bezpečné znaky (importovaný JSON nesmí vložit HTML)
  const platneId = x => typeof x === 'string' && /^[\w-]{1,80}$/.test(x);
  function normalizuj(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.polozky)) throw new Error('chybí seznam položek');
    const role = ROLE[o.role] ? o.role : 'svedek';
    const pouzite = new Set();
    const idPolozky = x => { const id = platneId(x) && !pouzite.has(x) ? x : novyId('q'); pouzite.add(id); return id; };
    return {
      id: platneId(o.id) ? o.id : novyId('p'),
      nazev: String(o.nazev || 'Příprava').slice(0, 200), osoba: String(o.osoba || '').slice(0, 200), role,
      cil: String(o.cil || '').slice(0, 2000), temata: String(o.temata || '').slice(0, 5000), datum: String(o.datum || '').slice(0, 10),
      polozky: o.polozky.filter(p => p && typeof p.text === 'string').map(p => ({
        id: idPolozky(p.id),
        faze: FAZE_ID.includes(p.faze) ? p.faze : 'A2',
        druh: ['otazka', 'pokyn', 'technika'].includes(p.druh) ? p.druh : 'otazka',
        text: p.text.slice(0, 2000), tech: TECHNIKY[p.tech] ? p.tech : null,
        zdroj: ['banka', 'vlastni', 'pripad'].includes(p.zdroj) ? p.zdroj : 'vlastni',
        bankaId: typeof p.bankaId === 'string' ? p.bankaId : null, pozn: String(p.pozn || '').slice(0, 2000)
      })),
      zmeneno: Number(o.zmeneno) || Date.now()
    };
  }
  function exportuj(pripravy) {
    return JSON.stringify({ format: FORMAT, verze: VERZE, exportovano: new Date().toISOString(), pripravy }, null, 2);
  }
  // vrací pole normalizovaných příprav; kolize id s existujícími řeší novým id
  function importuj(text, existujiciId) {
    const o = JSON.parse(text);
    let seznam;
    if (o && o.format === FORMAT && Array.isArray(o.pripravy)) seznam = o.pripravy;
    else if (o && Array.isArray(o.polozky)) seznam = [o];
    else throw new Error('soubor není export přípravy výslechu');
    const obsazene = new Set(existujiciId || []);
    return seznam.map(normalizuj).map(p => {
      if (obsazene.has(p.id)) p.id = novyId('p');
      obsazene.add(p.id);
      return p;
    });
  }

  const api = { FORMAT, VERZE, FAZE, FAZE_ID, ROLE, POUCENI, TECHNIKY, BANKA, TYPY, klasifikuj, vypadaCesky, vety,
    novaPriprava, polozkaZBanky, novaPolozka, modelovaPriprava, poFazich, srovnej, posun, presunNa, kontrolaPlanu, textPlanu,
    normalizuj, exportuj, importuj };
  if (typeof window !== 'undefined') window.VYSLECH = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
