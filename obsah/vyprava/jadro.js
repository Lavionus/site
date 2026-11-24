/* ============================================================
   Dílna výprav – jadro.js
   Model výpravy (příběh → stanoviště → poklad), šifry pro karty,
   kontrola řetězu a odhad času. Bez DOM – běží i v node
   (`require` vrátí VYPRAVA, test _test/vyprava_test.js).
   ============================================================ */
(function (G) {
  'use strict';
  const V = {};

  /* ---------- hráči a místo ---------- */
  V.VEKY = {
    male: { nazev: 'Malé děti (5–8 let)', maxObtiznost: 2, maxDelka: 25, minutNaStanoviste: 6 },
    deti: { nazev: 'Školáci (9–13 let)', maxObtiznost: 3, maxDelka: 60, minutNaStanoviste: 8 },
    dospeli: { nazev: 'Teenageři a dospělí', maxObtiznost: 5, maxDelka: 160, minutNaStanoviste: 10 }
  };
  V.MISTA = {
    byt: { nazev: 'Byt nebo dům', rada: 'Schovávejte do knih, pod koberec, do kapsy kabátu, za obraz. Nic do trouby, myčky ani ke krbu.' },
    zahrada: { nazev: 'Zahrada a dvůr', rada: 'Pod květináč, do budky, k sudu na vodu, do kůlny. Zkontrolujte, že se tam ráno nebude sekat tráva.' },
    les: { nazev: 'Les a příroda', rada: 'Jen na vlastních nebo veřejně přístupných místech, nic nezakopávat do kořenů a nepoškozovat stromy. Schránky přivázat, ať je neodnese vítr ani zvěř.' },
    mesto: { nazev: 'Město a náves', rada: 'Používejte veřejná a bezpečná místa (lavička, socha, kaplička, informační tabule). Žádné přecházení silnic na čas.' }
  };

  /* ---------- šablony příběhů ---------- */
  V.SABLONY = {
    chram: {
      nazev: '🏛️ Ztracený chrám', poklad: 'zlatá modla',
      uvod: 'Drahý {hrac},\n\nposílám ti poslední stránku z deníku profesora Hartmanna. Před sto lety se vydal za pokladem, kterému se říká {poklad}, a už se nevrátil. Na okraji stránky nechal znamení, kterým nikdo nerozuměl – až dodnes.\n\nPrvní stopu najdeš {prvni}. Věř jen tomu, co rozluštíš. A spěchej – nejsi jediný, kdo ji hledá.\n\nTvůj přítel z univerzity',
      zaver: 'Dokázal jsi, co se nepodařilo ani profesorovi. Poklad je tvůj: {poklad}. Ale pamatuj – chrám své tajemství pustí jen jednou.',
      typy: ['zrcadlo', 'caesar', 'zednarska', 'mrizka']
    },
    pirati: {
      nazev: '🏴‍☠️ Pirátský poklad', poklad: 'truhla kapitána Černovouse',
      uvod: 'Ahoj, {hrac}!\n\nV láhvi na břehu jsem našel tenhle vzkaz. Kapitán Černovous prý zakopal poklad – {poklad} – a cestu k němu rozdělil na kousky, aby ji nikdo nenašel naráz.\n\nPrvní kousek leží {prvni}. Pozor – piráti nikdy nepíšou tak, aby to přečetl každý.\n\nTvůj lodní plavčík',
      zaver: 'Truhla je otevřená! Kapitán Černovous by zuřil – ale podle pirátského zákona patří poklad tomu, kdo ho najde.',
      typy: ['a1z26', 'morse', 'zednarska', 'mrizka']
    },
    archiv: {
      nazev: '🐦 Kniha rodu (Kroniky vyhnanství)', poklad: 'ztracený list z knihy rodu',
      uvod: '{hrac},\n\nv archivu pod převisem chybí jeden list. Merin ho prý schovala, když přišli denní a ptali se po jménech. Stopy, které po sobě nechala, jsou psané ptačím písmem – stopami ptáků ve sněhu.\n\nPrvní stopa je {prvni}. Čti pomalu. Kniha nelže. Jen mlčí.',
      zaver: 'List je zpátky. Merin by kývla hlavou a nic by neřekla – a to je u ní nejvyšší pochvala.',
      typy: ['ptaci', 'zrcadlo', 'ptaci', 'kniha']
    },
    agent: {
      nazev: '🕵️ Tajný agent', poklad: 'ukradené plány',
      uvod: 'PŘÍSNĚ TAJNÉ\n\nAgente {hrac},\n\nnáš člověk ve městě zmizel, ale stihl rozmístit zprávy pro náhradníka. Cíl mise: {poklad}. Musíte být rychlejší než protistrana.\n\nPrvní schránka: {prvni}.\nTuto zprávu po přečtení zničte.\n\nCentrála',
      zaver: 'Mise splněna, agente. Plány jsou v bezpečí a o vašem jménu se nikdy nikdo nedozví.',
      typy: ['morse', 'caesar', 'neviditelny', 'zamek']
    },
    drak: {
      nazev: '🐉 Dračí vejce (pro nejmenší)', poklad: 'dračí vejce',
      uvod: 'Milý {hrac},\n\njsem malý drak a něco jsem ztratil: {poklad}. Neumím psát jako lidé, tak kreslím značky. Pomůžeš mi?\n\nPrvní značka je {prvni}.\n\nTvůj drak Šupinka',
      zaver: 'Našel jsi moje vejce! Děkuju! Až se vylíhne dráček, ponese tvoje jméno.',
      typy: ['zrcadlo', 'a1z26', 'zrcadlo']
    }
  };

  /* ---------- pomocné ---------- */
  const bezDiakritiky = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const velka = s => bezDiakritiky(s).toUpperCase();
  const jenPismena = s => velka(s).replace(/[^A-Z]/g, '');
  V.bezDiakritiky = bezDiakritiky;
  V.jenPismena = jenPismena;
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function posun(s, k) {
    return velka(s).replace(/[A-Z]/g, c => ABC[((c.charCodeAt(0) - 65 + k) % 26 + 26) % 26]);
  }
  /* slova (velká, bez diakritiky, interpunkce pryč) */
  const slova = s => velka(s).replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  V.slova = slova;

  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
    N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
  V.MORSE = MORSE;
  const MORSE_ZPET = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

  /* Zednářská šifra: A–I mřížka #, J–R # s tečkou, S–V kříž X, W–Z X s tečkou */
  V.zednarskaZnak = function (c) {
    const i = ABC.indexOf(c);
    if (i < 0) return null;
    if (i < 18) return { mrizka: '#', pole: i % 9 + 1, tecka: i >= 9 };
    return { mrizka: 'X', pole: (i - 18) % 4 + 1, tecka: i >= 22 };
  };

  /* ---------- typy úkolů ----------
     obtiznost 1–5; pomucka = co hráč potřebuje (tiskne se v sadě);
     klic = šifra potřebuje klíč, který musí hráč odněkud dostat. */
  V.TYPY = {
    zrcadlo: { nazev: '🪞 Zrcadlové písmo', obtiznost: 1, pomucka: null, karta: 'zrcadlo',
      popis: 'Text pozpátku a zrcadlově. Stačí zrcátko nebo podržet papír proti oknu. Pro nejmenší ideální první úkol.' },
    a1z26: { nazev: '🔢 Čísla místo písmen', obtiznost: 1, pomucka: 'a1z26',
      popis: 'A = 1, B = 2 … Z = 26. Přiložte proužek s abecedou, nebo ho schovejte na předchozím stanovišti.' },
    ptaci: { nazev: '🐦 Ptačí písmo', obtiznost: 2, pomucka: 'ptaci', karta: 'ptaci',
      popis: 'Písmo z Kronik vyhnanství – každé písmeno je ptačí stopa. S klíčem zvládne i školák, bez něj je to výzva pro dospělé.' },
    pismo: { nazev: '🔣 Cizí písmo', obtiznost: 3, pomucka: 'pismo', karta: 'pismo',
      popis: 'Zpráva napsaná runami, hlaholicí, tengwarem, ogamem, alfabetou… nebo jakýmkoli fontem z knihovny webu, i vaším vlastním. Klíč písma se vytiskne mezi pomůckami.' },
    zednarska: { nazev: '#️⃣ Zednářská šifra', obtiznost: 2, pomucka: 'zednarska', karta: 'zednarska',
      popis: 'Písmena jako kousky mřížky # a kříže X. Vypadá tajemně, a přitom se dá naučit za pět minut.' },
    morse: { nazev: '📡 Morseovka', obtiznost: 2, pomucka: 'morse',
      popis: 'Tečky a čárky. Dá se i zaťukat, zablikat baterkou nebo zapískat – skvělé pro večerní hru.' },
    atbash: { nazev: '🔄 Atbaš (obrácená abeceda)', obtiznost: 2, pomucka: 'atbash',
      popis: 'A ↔ Z, B ↔ Y… Starověká šifra z Bible. Klíč je jen „abeceda pozpátku“ – dá se napovědět hádankou.' },
    caesar: { nazev: '🎡 Caesarova šifra', obtiznost: 3, pomucka: 'kolecko', klic: true,
      popis: 'Každé písmeno posunuté o pár míst. K hledání patří šifrovací kolečko (vytiskne se) a číslo posunu schované jinde.' },
    plot: { nazev: '🧱 Plotová šifra', obtiznost: 3, pomucka: null,
      popis: 'Písmena napsaná cikcak do dvou řádků a přečtená po řádcích. Nápověda: „čti ob jedno“.' },
    mrizka: { nazev: '🧭 Souřadnice na mapě', obtiznost: 2, pomucka: 'mapa', karta: 'mrizka',
      popis: 'Karta říká jen políčko (např. E5) – místo najdou na mapě pokladu se zapnutou mřížkou.' },
    kniha: { nazev: '📖 Knižní šifra', obtiznost: 4, pomucka: 'kniha', klic: true,
      popis: 'Každé slovo zprávy je dvojice čísel řádek–slovo v textu, který hráč má (stránka knihy, dopis, nápis na tabuli).' },
    vigenere: { nazev: '🗝️ Vigenèrova šifra', obtiznost: 5, pomucka: 'vigenere', klic: true,
      popis: 'Caesar s heslem – každé písmeno se posouvá jinak. Pro dospělé; heslo ukryjte do předchozího úkolu.' },
    neviditelny: { nazev: '🍋 Neviditelný inkoust', obtiznost: 2, pomucka: null, karta: 'rekvizita', rucne: true,
      popis: 'Zpráva psaná citronovou šťávou nebo mlékem se objeví nad teplem. Zahřívá vždy dospělý (žehlička přes papír, ne svíčka).' },
    zamek: { nazev: '🔐 Zámek na číselný kód', obtiznost: 3, pomucka: null, karta: 'rekvizita', rucne: true,
      popis: 'Krabička se zámkem; kód je výsledek předchozí hádanky (počet oken, rok na soše…). Kód napište do pole Řešení.' },
    hadanka: { nazev: '❓ Vlastní hádanka', obtiznost: 2, pomucka: null, karta: 'hadanka',
      popis: 'Rébus, slovní hádanka nebo otázka z místa („kolik schodů vede ke kapli?“). Text karty i řešení píšete sami.' }
  };

  /* ---------- šifrování ----------
     Vrací { zapis, chyby[] } – zápis je text karty (u obrázkových šifer
     slouží k vykreslení), chyby popisují, co se do šifry nevešlo. */
  V.sifruj = function (typ, text, par) {
    const p = par || {}, chyby = [];
    const t = String(text || '');
    switch (typ) {
      case 'zrcadlo': return { zapis: p.pozpatku ? [...t].reverse().join('') : t, chyby };
      case 'a1z26':
        // číslice zprávy v závorce, ať se nepletou s pořadím písmen
        return { zapis: slova(t).map(w => [...w].map(c => /[A-Z]/.test(c) ? ABC.indexOf(c) + 1 : '(' + c + ')').join('-')).join(' / '), chyby };
      case 'morse':
        return { zapis: slova(t).map(w => [...w].map(c => MORSE[c] || '').join(' ')).join(' / '), chyby };
      case 'atbash': return { zapis: velka(t).replace(/[A-Z]/g, c => ABC[25 - ABC.indexOf(c)]), chyby };
      case 'caesar': {
        const k = ((parseInt(p.posun, 10) || 3) % 26 + 26) % 26;
        if (!k) chyby.push('Posun 0 nic nezašifruje.');
        return { zapis: posun(t, k), chyby };
      }
      case 'plot': {
        const w = jenPismena(t);
        let a = '', b = '';
        [...w].forEach((c, i) => { if (i % 2) b += c; else a += c; });
        return { zapis: (a + b).replace(/(.{5})/g, '$1 ').trim(), chyby };
      }
      case 'vigenere': {
        const h = jenPismena(p.heslo || '');
        if (!h) { chyby.push('Chybí heslo.'); return { zapis: velka(t), chyby }; }
        let j = 0;
        return { zapis: velka(t).replace(/[A-Z]/g, c => posun(c, ABC.indexOf(h[j++ % h.length]))), chyby };
      }
      case 'kniha': {
        const zdroj = String(p.zdroj || '').split(/\r?\n/).map(r => slova(r));
        if (!zdroj.some(r => r.length)) { chyby.push('Vložte text, ze kterého se šifruje (stránku knihy, nápis…).'); return { zapis: '', chyby }; }
        const out = [];
        for (const w of slova(t)) {
          let nal = null;
          for (let r = 0; r < zdroj.length && !nal; r++) { const s = zdroj[r].indexOf(w); if (s >= 0) nal = (r + 1) + '-' + (s + 1); }
          if (!nal) chyby.push(`Slovo „${w}“ v textu není.`);
          out.push(nal || '?');
        }
        return { zapis: out.join('  '), chyby };
      }
      case 'pismo': {
        // přepis do jiného písma (fonty/prepis.js v prohlížeči); bez něj zůstane text a kreslí ho font
        const id = p.prepis || 'zadny';
        const P = typeof PREPIS !== 'undefined' ? PREPIS : G.PREPIS;
        if (id !== 'zadny' && P && P.SEZNAM.some(x => x.id === id)) return { zapis: P.preved(id, t), chyby };
        return { zapis: t, chyby };
      }
      case 'ptaci': case 'zednarska':
        return { zapis: typ === 'zednarska' ? velka(t).replace(/[^A-Z\s]/g, '') : t, chyby };
      case 'mrizka': {
        const pole = String(p.pole || '').toUpperCase().replace(/\s/g, '');
        if (!/^[A-H][1-8]$/.test(pole)) chyby.push('Políčko zadejte jako písmeno A–H a číslo 1–8 (např. E5).');
        return { zapis: pole, chyby };
      }
      default: return { zapis: t, chyby };
    }
  };

  /* Zpětné čtení – slouží testům a kontrole (šifra jde opravdu rozluštit). */
  V.desifruj = function (typ, zapis, par) {
    const p = par || {};
    switch (typ) {
      case 'zrcadlo': return p.pozpatku ? [...zapis].reverse().join('') : zapis;
      case 'a1z26': return zapis.split(' / ').map(w => w.split('-').map(n => /^\d+$/.test(n) ? ABC[n - 1] : n.replace(/[()]/g, '')).join('')).join(' ');
      case 'morse': return zapis.split(' / ').map(w => w.split(' ').map(z => MORSE_ZPET[z] || '').join('')).join(' ');
      case 'atbash': return zapis.replace(/[A-Z]/g, c => ABC[25 - ABC.indexOf(c)]);
      case 'caesar': return posun(zapis, -((parseInt(p.posun, 10) || 3) % 26));
      case 'plot': {
        const w = zapis.replace(/\s/g, ''), h = Math.ceil(w.length / 2);
        let out = '';
        for (let i = 0; i < w.length; i++) out += i % 2 ? w[h + (i >> 1)] : w[i >> 1];
        return out;
      }
      case 'vigenere': {
        const h = jenPismena(p.heslo || ''); let j = 0;
        return zapis.replace(/[A-Z]/g, c => posun(c, -ABC.indexOf(h[j++ % h.length])));
      }
      case 'kniha': {
        const zdroj = String(p.zdroj || '').split(/\r?\n/).map(r => slova(r));
        return zapis.split(/\s+/).filter(Boolean).map(x => { const [r, s] = x.split('-').map(Number); return (zdroj[r - 1] || [])[s - 1] || '?'; }).join(' ');
      }
      default: return zapis;
    }
  };

  /* ---------- model ---------- */
  let citac = 0;
  const noveId = () => Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6);
  V.noveId = noveId;
  V.noveStanoviste = function (typ) {
    return { id: noveId(), misto: '', typ: typ || 'zrcadlo', text: '', par: {}, napovedy: [], poznamka: '', uvodKarty: '' };
  };
  V.novaVyprava = function (sablona) {
    const S = V.SABLONY[sablona] || V.SABLONY.chram;
    return {
      id: noveId(), nazev: S.nazev.replace(/^\S+\s/, ''), hrac: '', vek: 'deti', misto: 'zahrada', sablona: sablona || 'chram',
      poklad: S.poklad, uvod: S.uvod, zaver: S.zaver, prvni: '',
      stanoviste: S.typy.map(t => V.noveStanoviste(t)),
      mapa: { nazev: '', seed: Math.floor(Math.random() * 1e6), mrizka: false, znacky: [], styl: 'pergamen' },
      vzhled: V.vychoziVzhled(), start: '',
      zmeneno: Date.now()
    };
  };

  /* Ukázková výprava – vyplněná celá, aby bylo vidět, jak řetěz funguje. */
  V.ukazka = function () {
    const v = V.novaVyprava('chram');
    Object.assign(v, { nazev: 'Chrám pod hrušní', hrac: 'Ondro', vek: 'deti', misto: 'zahrada', poklad: 'zlatá modla (čokoládová)', prvni: 'pod rohožkou u zadních dveří' });
    const st = [
      ['pod rohožkou u zadních dveří', 'zrcadlo', 'Hledej v konvi u záhonu', {}, ['Zkus zrcátko.', 'Čti od konce.']],
      ['v konvi u záhonu', 'caesar', 'Další stopa je v ptačí budce', { posun: 3 }, ['Kolečko otoč o tři písmena.', 'A je D.']],
      ['v ptačí budce', 'zednarska', 'Pod velkým kamenem u plotu', {}, ['Klíč je na zadní straně předchozí karty.']],
      ['pod velkým kamenem u plotu', 'mrizka', '', { pole: 'F6' }, ['Mapa je v kůlně na dveřích.']]
    ];
    v.stanoviste = st.map(([misto, typ, text, par, napovedy]) => Object.assign(V.noveStanoviste(typ), { misto, text, par, napovedy }));
    v.mapa.mrizka = true;
    v.mapa.nazev = 'Chrám pod hrušní';
    v.mapa.znacky = [
      { id: 'a', typ: 'dum', x: 180, y: 520, popis: 'Dům' }, { id: 'b', typ: 'strom', x: 420, y: 230, popis: 'Hrušeň' },
      { id: 'c', typ: 'voda', x: 300, y: 400, popis: 'Záhon' }, { id: 'd', typ: 'skala', x: 610, y: 360, popis: 'Kámen' },
      { id: 'e', typ: 'poklad', x: 640, y: 440, popis: '' }, { id: 'f', typ: 'chram', x: 820, y: 180, popis: 'Kůlna' }
    ];
    v.mapa.trasa = ['a', 'c', 'b', 'd', 'e'];
    return v;
  };

  /* ---------- kontrola řetězu ----------
     Každé stanoviště musí vést na další místo (poslední na poklad), šifra
     musí jít přečíst a obtížnost má sedět věku. Vrací [{uroven, i, text}],
     uroven: 'chyba' | 'varovani' | 'tip'. i = index stanoviště nebo -1. */
  const kmen = w => bezDiakritiky(w).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4);
  const VYPLN = new Set(['pod', 'nad', 'u', 'v', 've', 'na', 'za', 'do', 'k', 'ke', 'od', 'z', 'ze', 'a', 'i', 'se', 'je', 'mezi', 'vedle', 'pred', 'pri', 'po', 'tam', 'kde', 'u']);
  V.vedeNa = function (reseni, misto) {
    const r = new Set(String(reseni || '').split(/[^\p{L}\p{N}]+/u).map(kmen).filter(Boolean));
    const klic = String(misto || '').split(/[^\p{L}\p{N}]+/u).filter(w => w && !VYPLN.has(bezDiakritiky(w).toLowerCase())).map(kmen).filter(k => k.length >= 3);
    return klic.length > 0 && klic.some(k => r.has(k));
  };
  V.reseniStanoviste = function (s) {
    return s.typ === 'mrizka' ? 'políčko ' + (s.par.pole || '?') : s.text;
  };
  V.zkontroluj = function (v) {
    const out = [], add = (uroven, i, text) => out.push({ uroven, i, text });
    const vek = V.VEKY[v.vek] || V.VEKY.deti, st = v.stanoviste || [];
    if (!st.length) add('chyba', -1, 'Výprava nemá žádné stanoviště.');
    if (!String(v.prvni || '').trim() && st.length) add('varovani', -1, 'Úvodní dopis neříká, kde je první stopa (pole „Kde je první stopa“).');
    else if (st.length && st[0].misto && !V.vedeNa(v.prvni, st[0].misto)) add('varovani', 0, `Úvodní dopis posílá „${v.prvni}“, ale první stanoviště je „${st[0].misto}“.`);
    const maMrizku = v.mapa && v.mapa.mrizka;
    st.forEach((s, i) => {
      const T = V.TYPY[s.typ];
      const cislo = `Stanoviště ${i + 1}`;
      if (!T) { add('chyba', i, `${cislo}: neznámý typ úkolu.`); return; }
      if (!String(s.misto || '').trim()) add('chyba', i, `${cislo}: chybí, kde bude schované.`);
      if (s.typ !== 'mrizka' && !String(s.text || '').trim()) add('chyba', i, `${cislo}: chybí text zprávy (řešení).`);
      const r = V.sifruj(s.typ, s.text, s.par);
      r.chyby.forEach(c => add('chyba', i, `${cislo}: ${c}`));
      if (T.obtiznost > vek.maxObtiznost) add('varovani', i, `${cislo}: ${T.nazev.replace(/^\S+\s/, '')} je na ${vek.nazev.toLowerCase()} moc těžká.`);
      const delka = jenPismena(s.text).length;
      if (delka > vek.maxDelka) add('varovani', i, `${cislo}: zpráva má ${delka} písmen – pro tento věk raději do ${vek.maxDelka}.`);
      if (s.typ === 'mrizka' && !maMrizku) add('chyba', i, `${cislo}: souřadnice potřebují mapu se zapnutou mřížkou.`);
      if (s.typ === 'mrizka' && maMrizku && /^[A-H][1-8]$/i.test(s.par.pole || '') && !(v.mapa.znacky || []).some(z => V.xyNaPole(z.x, z.y) === String(s.par.pole).toUpperCase()))
        add('varovani', i, `${cislo}: na mapě na políčku ${String(s.par.pole).toUpperCase()} nic není – přidejte tam značku (třeba ✕).`);
      if ((s.typ === 'hadanka' || s.typ === 'zamek') && !String(s.par.otazka || '').trim()) add('chyba', i, `${cislo}: chybí text hádanky na kartu.`);
      if (s.typ === 'pismo' && (!s.par.prepis || s.par.prepis === 'zadny') && (!s.par.font || s.par.font === (v.vzhled || {}).pismo))
        add('varovani', i, `${cislo}: cizí písmo bez přepisu a ve stejném fontu jako karty není žádná šifra – vyberte přepis nebo jiný font.`);
      if (T.klic && !(s.napovedy || []).some(n => String(n).trim())) add('varovani', i, `${cislo}: šifra potřebuje klíč – napište do nápovědy, kde ho hráč najde.`);
      if (!(s.napovedy || []).some(n => String(n).trim())) add('tip', i, `${cislo}: přidejte aspoň jednu nápovědu do obálky (záložní plán, když se hra zasekne).`);
      if (/[ěščřžýáíéůúťďň]/i.test(s.text) && ['a1z26', 'morse', 'caesar', 'atbash', 'plot', 'vigenere', 'zednarska'].includes(s.typ))
        add('tip', i, `${cislo}: tato šifra nezná háčky a čárky – zpráva se zašifruje bez nich.`);
      // řetěz: řešení musí vést na další místo
      const dalsi = st[i + 1];
      const reseni = V.reseniStanoviste(s);
      if (s.typ === 'mrizka' || T.rucne) return;
      if (dalsi && dalsi.misto && s.text && !V.vedeNa(reseni, dalsi.misto))
        add('varovani', i, `${cislo}: řešení „${s.text}“ nezmiňuje další místo („${dalsi.misto}“). Zkontrolujte, že hráč pozná, kam jít.`);
    });
    const posl = st[st.length - 1];
    if (posl && posl.typ !== 'mrizka' && posl.text && v.poklad && !V.vedeNa(posl.text, v.poklad) && !/poklad|truhl|cil|konec/i.test(bezDiakritiky(posl.text)))
      add('tip', st.length - 1, 'Poslední zpráva by měla dovést k pokladu – zmiňte místo, kde leží.');
    const typy = st.map(s => s.typ);
    for (let i = 1; i < typy.length; i++) if (typy[i] === typy[i - 1] && typy[i] !== 'ptaci') add('tip', i, `Stanoviště ${i} a ${i + 1} mají stejnou šifru – střídání je zábavnější.`);
    const min = V.odhadCasu(v);
    if (min > 90 && v.vek === 'male') add('varovani', -1, `Odhad ${min} minut je na malé děti dlouhý – zkraťte trasu nebo zjednodušte úkoly.`);
    return out;
  };

  /* Minuty na jedno stanoviště: cesta podle místa + luštění podle obtížnosti a délky. */
  V.minutStanoviste = function (v, x) {
    const vek = V.VEKY[v.vek] || V.VEKY.deti, M = { byt: 1, zahrada: 2, les: 6, mesto: 5 }[v.misto] || 3;
    const T = V.TYPY[x.typ] || { obtiznost: 2 };
    return vek.minutNaStanoviste * (0.6 + T.obtiznost * 0.25) + jenPismena(x.text).length * 0.08 + M;
  };
  V.odhadCasu = function (v) {
    return Math.round((v.stanoviste || []).reduce((s, x) => s + V.minutStanoviste(v, x), 3));
  };
  /* Časový plán od začátku hry („14:00“): kdy hráči asi dorazí na které stanoviště a k pokladu. */
  V.harmonogram = function (v) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(v.start || '').trim());
    if (!m) return null;
    let t = +m[1] * 60 + +m[2] + 3;
    const fmt = x => { const r = Math.round(x); return `${Math.floor(r / 60) % 24}:${String(r % 60).padStart(2, '0')}`; };
    const out = (v.stanoviste || []).map(x => { const c = fmt(t); t += V.minutStanoviste(v, x); return c; });
    out.push(fmt(t));
    return out;
  };

  /* Vzhled tisku: písma z knihovny webu (id z fonty.js, i vlastní nahrané), papír, inkoust, pečeť. */
  V.vychoziVzhled = () => ({ pismo: 'imfell', pismoMapy: 'imfell', papir: 'pergamen', inkoust: 'hneda', pecet: '✦', barvaPecete: 'cervena', karet: 2 });
  V.PAPIRY = { pergamen: 'Pergamen', stary: 'Starý tmavý papír', cisty: 'Čistý (úsporný tisk)' };
  V.INKOUSTY = { hneda: ['Sépiová hnědá', '#3d2714'], cerna: ['Černá', '#141414'], modra: ['Duběnková modročerná', '#1f2b4a'], cervena: ['Rudá', '#6e1a12'] };
  V.PECETI = { cervena: ['Červený vosk', '#c3412b', '#7d1a10'], zelena: ['Zelený vosk', '#3f7a3a', '#1d3f1b'], cerna: ['Černý vosk', '#4a4a4a', '#111'], zlata: ['Zlatý vosk', '#d9b24a', '#7a5a14'], zadna: ['Bez pečeti'] };

  /* Úvodní dopis s doplněnými jmény. */
  V.text = function (sablonaTextu, v) {
    return String(sablonaTextu || '').replace(/\{hrac\}/g, v.hrac || 'hledači').replace(/\{poklad\}/g, v.poklad || 'poklad').replace(/\{prvni\}/g, v.prvni || '…');
  };

  /* Mřížka mapy pokladu (A–H × 1–8) – stejná geometrie jako mapa.js. */
  V.MAPA = { W: 1000, H: 700, OKRAJ: 46 };
  V.xyNaPole = function (x, y) {
    const { W, H, OKRAJ } = V.MAPA, sx = (W - 2 * OKRAJ) / 8, sy = (H - 2 * OKRAJ) / 8;
    const c = Math.floor((x - OKRAJ) / sx), r = Math.floor((y - OKRAJ) / sy);
    return c >= 0 && c < 8 && r >= 0 && r < 8 ? String.fromCharCode(65 + c) + (r + 1) : '';
  };

  /* Deterministický náhodný generátor (mapa, roztrhané okraje). */
  V.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  };

  /* Načtení uložené výpravy – doplní chybějící pole (starší verze, cizí soubor). */
  V.normalizuj = function (x) {
    const z = V.novaVyprava(x && x.sablona);
    const v = Object.assign(z, x || {});
    v.mapa = Object.assign({ nazev: '', seed: 1, mrizka: false, znacky: [], styl: 'pergamen', trasa: [] }, v.mapa || {});
    v.vzhled = Object.assign(V.vychoziVzhled(), v.vzhled || {});
    if (![1, 2, 4].includes(+v.vzhled.karet)) v.vzhled.karet = 2;
    if (!Array.isArray(v.mapa.trasa)) v.mapa.trasa = [];
    v.stanoviste = (Array.isArray(v.stanoviste) ? v.stanoviste : []).map(s => Object.assign(V.noveStanoviste(), s, { par: Object.assign({}, s && s.par), napovedy: Array.isArray(s && s.napovedy) ? s.napovedy : [] }));
    return v;
  };

  G.VYPRAVA = V;
  if (typeof module !== 'undefined') module.exports = V;
})(typeof window !== 'undefined' ? window : globalThis);
