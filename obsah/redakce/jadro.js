/* ============================================================
   redakce/jadro.js – redakční rozbor českého rukopisu (bez DOM).

   REDAKCE.rozeber(text, nastaveni) → {kapitoly, vety, tokeny, nalezy,
     frekvence, spojeni, postavy, souhrn}
   Všechny pozice (od, do) jsou znakové offsety do původního textu
   (Markdownu), aby šly podtrhnout přímo v editoru.

   Čeština bez slovníku: lehký stemmer (Dolamic & Savoy, jako Lucene
   CzechStemmer), slabiky podle samohlásek a slabikotvorného r/l,
   hranice vět s ohledem na zkratky, iniciály a data.
   ============================================================ */
(function (koren, tovarna) {
  const R = tovarna();
  if (typeof module === 'object' && module.exports) module.exports = R;
  else koren.REDAKCE = R;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- typy nálezů ----------
  const TYPY = {
    opakovani: { nazev: 'Opakované slovo', ikona: '🔁' },
    dlouha:    { nazev: 'Dlouhá věta', ikona: '📏' },
    vata:      { nazev: 'Vata a vycpávky', ikona: '🧶' },
    zacal:     { nazev: 'Začal + infinitiv', ikona: '▶' },
    slabe:     { nazev: 'Slabé sloveso', ikona: '🪶' },
    rec:       { nazev: 'Příslovce u slovesa řeči', ikona: '💬' },
    trpny:     { nazev: 'Trpný rod', ikona: '⛓' },
    retez:     { nazev: 'Řetězec podstatných jmen', ikona: '🚃' },
    zacatky:   { nazev: 'Stejné začátky vět', ikona: '🔂' },
  };

  // ---------- funkční slova (do opakování ani četnosti se nepočítají) ----------
  const STOP = new Set(`a i o u v s z k na do od po za pro při před pod nad mezi bez přes skrz proti kvůli podle kolem okolo vedle u
    se si je jsem jsi jsme jste jsou být byl byla bylo byli byly bude budu budeš budeme budete budou by bych bys bychom byste
    ten ta to ti ty toho tomu tom tím tu tou těch těm těmi tento tato toto tyto tenhle tahle tohle tuhle tohohle
    který která které kteří kterou kterého kterému kterým kterých kterými jenž jež již co cože čeho čemu čem čím kdo koho komu kom kým
    že aby když kdyby ale nebo ani jak tak už ještě jen jenom také taky pak tam tady sem kde kdy proč než však totiž tedy ať zda zdali
    on ona ono oni ony jeho její jejich jemu jím ní něj něm nich nim nimi mu mi mě mne mně ho jí ji jim je nás vás nám vám námi vámi
    my vy já ty svůj svá své svého svému svým svou svoje svoji svých můj moje má mé můj mého mému mým mou tvůj tvoje tvá tvé náš naše
    váš vaše sebe sobě sebou ne no jo ano sám sama samo sami všechno vše všichni všechny všem nic nikdo něco někdo nějaký každý
    jako jakoby jestli pokud protože poněvadž neboť zatímco dokud než až i když tož ó ach och hm
    nebyl nebyla nebylo nebyli nebyly není nejsou jeden jedna jedno jednu jednoho jednom jednou žádný žádná žádné žádného žádnou žádní
    nikdy vždy vždycky celý celá celé celou celého teď potom pořád stále znovu zase`.split(/\s+/).filter(Boolean));

  // zkratky, po kterých věta (skoro) nikdy nekončí
  const NETERM = new Set(('např tzv tj resp mj příp popř cca str č čís s sv p pí sl ing mgr bc dr mudr judr phdr rndr paeddr prof doc ' +
    'kpt plk gen npor por mjr pplk škpt ppor rtm des stržm st r hod min ul nám tel viz srov vs t zv kap obr tab odst písm' +
    ' arch akad csc drsc mvdr phmr thdr ved').split(' '));

  const VYCHOZI = {
    okno: 20,            // opakování: kolik slov dozadu hledat stejný kmen
    minDelka: 4,         // opakování: nejkratší sledované slovo
    ignorovatJmena: true,
    prahVety: 30,        // dlouhá věta: více slov než práh
    retezMin: 3,         // řetězec podstatných jmen: aspoň tolik za sebou
    zacatkyMin: 3,       // stejné začátky: aspoň tolik vět po sobě začíná stejným slovem
    rychlost: 220,       // tiché čtení, slov za minutu
    rychlostNahlas: 150, // předčítání nahlas
    recNehlasit: true,   // vatu a slabá slovesa v přímé řeči nehlásit (mluva postav)
    typy: { opakovani: true, dlouha: true, vata: true, zacal: true, slabe: true, rec: true, trpny: true, retez: true, zacatky: true },
    vata: ['vlastně', 'nějak', 'docela', 'trochu', 'trošku', 'jakoby', 'jaksi', 'prostě', 'opravdu', 'skutečně', 'celkem', 'poměrně',
      'víceméně', 'zkrátka', 'vůbec', 'hrozně', 'strašně', 'úplně', 'naprosto', 'absolutně', 'totálně', 'zrovna', 'samozřejmě',
      'rozhodně', 'určitě', 'doopravdy', 'poněkud', 'velmi', 'najednou', 'náhle', 'takříkajíc', 'tak nějak', 'tak trochu',
      'v podstatě', 'do jisté míry', 've skutečnosti', 'v zásadě', 'svým způsobem', 'v jistém smyslu', 'nějakým způsobem', 'takový ten'],
    slaba: ['byl', 'byla', 'bylo', 'byli', 'byly', 'bývá', 'bývalo', 'měl', 'měla', 'mělo', 'měli', 'měly', 'dělal*', 'udělal*',
      'dostal*', 'nacházel*', 'nachází', 'existoval*', 'vypadal*'],
    slovesaReci: ['řekl*', 'odpověděl*', 'odpovídal*', 'zeptal*', 'ptal*', 'zašeptal*', 'šeptal*', 'vykřikl*', 'zakřičel*', 'křičel*',
      'zavolal*', 'dodal*', 'pronesl*', 'zamumlal*', 'mumlal*', 'prohlásil*', 'opáčil*', 'poznamenal*', 'zasyčel*', 'zabručel*',
      'bručel*', 'zavrčel*', 'odvětil*', 'odsekl*', 'říkal*', 'řekne*', 'řeknu', 'říká', 'říkají', 'ptá', 'ptají', 'zeptá', 'zeptají', 'odpoví', 'odpovídá', 'zašeptá', 'zavolá', 'dodá', 'pokračoval*', 'namítl*', 'namítal*', 'vyhrkl*', 'utrousil*', 'hlesl*', 'špitl*'],
    nepocitat: [],       // vlastní slova, která se nehlásí jako opakování ani nepočítají do četnosti
  };

  // ---------- stemmer (lehký, Dolamic & Savoy) ----------
  function palatal(w) {
    const n = w.length;
    for (const k of ['čtě', 'čti', 'čtí']) if (w.endsWith(k)) return w.slice(0, n - 3) + 'ck';
    for (const k of ['ště', 'šti', 'ští']) if (w.endsWith(k)) return w.slice(0, n - 3) + 'sk';
    for (const k of ['ci', 'ce', 'či', 'če']) if (w.endsWith(k)) return w.slice(0, n - 2) + 'k';
    for (const k of ['zi', 'ze', 'ži', 'že']) if (w.endsWith(k)) return w.slice(0, n - 2) + 'h';
    return w.slice(0, n - 1);
  }
  function bezPadu(w) {
    const n = w.length, e = s => w.endsWith(s), nek = a => a.some(e);
    if (n > 7 && e('atech')) return w.slice(0, -5);
    if (n > 6) {
      if (e('ětem')) return palatal(w.slice(0, -3));
      if (e('atům')) return w.slice(0, -4);
    }
    if (n > 5) {
      if (nek(['ech', 'ich', 'ích', 'ého', 'ěmi', 'emi', 'ému', 'ěte', 'ěti', 'iho', 'ího', 'ími', 'imu'])) return palatal(w.slice(0, -2));
      if (nek(['ách', 'ata', 'aty', 'ých', 'ama', 'ami', 'ové', 'ovi', 'ými'])) return w.slice(0, -3);
    }
    if (n > 4) {
      if (e('em')) return palatal(w.slice(0, -1));
      if (nek(['es', 'ém', 'ím'])) return palatal(w.slice(0, -2));
      if (nek(['ům', 'at', 'ám', 'os', 'us', 'ým', 'mi', 'ou'])) return w.slice(0, -2);
    }
    if (n > 3) {
      if (nek(['e', 'i', 'í', 'ě'])) return palatal(w);
      if (nek(['u', 'y', 'ů', 'a', 'o', 'á', 'é', 'ý'])) return w.slice(0, -1);
    }
    return w;
  }
  // slovesa (jen malá písmena – jména jako Pavel nechat): dívala/dívat → dív, mluvil/mluvit → mluv
  const RE_SLOVESO = /(?:al|il|el|ěl|it|ít|et|ět|át)$/;
  function kmen(slovo) {
    let w = slovo.toLowerCase();
    w = bezPadu(w);
    if (w.length > 5 && w.endsWith('ov')) w = w.slice(0, -2);
    else if (w.length > 5 && w.endsWith('in')) w = palatal(w.slice(0, -1));
    if (slovo[0] === w[0] && w.length >= 5 && RE_SLOVESO.test(w)) w = w.slice(0, -2);
    else if (w.length >= 4 && /[^aeiouyáéíóúůýě](?:ek|el)$/.test(w)) w = w.slice(0, -2) + w.slice(-1);   // pohyblivé e: Ješek/Ješka, Pavel/Pavla, domek/domku
    return w;
  }

  // kmen vlastního jména: jen pádové koncovky (Udalrich/Udalricha, Věra/Věře, Ješek/Ješka, Mlýnec/Mlýnce)
  const KONC_JMEN = ['ovi', 'ové', 'ech', 'ami', 'ích', 'em', 'ou', 'ům', 'a', 'u', 'y', 'e', 'ě', 'i', 'o', 'ů', 'í'];
  function kmenJmena(slovo) {
    let w = slovo.toLowerCase();
    // přivlastňovací tvary k majiteli (Kojatův, Henselova, Matějově); dativ -ovi zůstává pádem
    const priv = /(?:ův|ova|ovo|ově|ovu|ovou|ových|ovým|ovými|ovy)$/.exec(w);
    if (priv && w.length - priv[0].length >= 3) return kmenJmena(slovo.slice(0, -priv[0].length));
    for (const k of KONC_JMEN) if (w.endsWith(k) && w.length - k.length >= 2) { w = w.slice(0, -k.length); break; }
    if (w.endsWith('ř')) w = w.slice(0, -1) + 'r';
    if (w.length >= 4 && /[^aeiouyáéíóúůýě]e[klc]$/.test(w)) w = w.slice(0, -2) + w.slice(-1);
    return w;
  }

  // ---------- slabiky ----------
  const SAMOHL = 'aeiouyáéíóúůýě';
  function slabiky(slovo) {
    const w = slovo.toLowerCase().replace(/[^\p{L}]/gu, '');
    if (!w) return 0;
    let n = 0;
    for (let i = 0; i < w.length; i++) {
      const c = w[i];
      if (SAMOHL.includes(c)) {
        // ou, au, eu = jedna slabika (dvojhláska)
        if (c === 'u' && i > 0 && 'oae'.includes(w[i - 1])) continue;
        n++;
      } else if (c === 'r' || c === 'l') {
        // slabikotvorné r/l: mezi souhláskami nebo na konci po souhlásce (vlk, smrt, Petr)
        const pred = w[i - 1], po = w[i + 1];
        const souhl = x => x && !SAMOHL.includes(x);
        if (souhl(pred) && (po === undefined || souhl(po))) n++;
      }
    }
    return Math.max(1, n);
  }

  // ---------- Markdown → bloky (nadpis, předěl, odstavec) ----------
  function bloky(text) {
    const out = [];
    let odst = null, i = 0;
    const flush = () => { if (odst) { out.push(odst); odst = null; } };
    while (i <= text.length) {
      let j = text.indexOf('\n', i); if (j < 0) j = text.length;
      const radek = text.slice(i, j);
      const h = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(radek);
      if (h) { flush(); out.push({ typ: 'nadpis', uroven: h[1].length, nazev: h[2].replace(/[*_]/g, '').trim(), od: i, do: j }); }
      else if (/^\s*$/.test(radek)) flush();
      else if (/^\s*(?:(?:\*\s*)+|(?:-\s*){3,}|(?:_\s*){3,})$/.test(radek)) { flush(); out.push({ typ: 'predel', od: i, do: j }); }
      else if (odst) odst.do = j;
      else odst = { typ: 'odstavec', od: i + (radek.length - radek.trimStart().length), do: j };
      if (j >= text.length) break;
      i = j + 1;
    }
    flush();
    return out;
  }

  const RE_TOKEN = /[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*|\d+(?:[.,:]\d+)*/gu;
  const ZAVIRACI = '“”"»«)’\'*_]';

  // konce vět v úseku textu [od, do) – vrací pole absolutních konců
  function konceVet(text, od, doo) {
    const P = text.slice(od, doo), konce = [];
    const re = /[.!?…]+/g; let m;
    while ((m = re.exec(P))) {
      const i = m.index; let k = i + m[0].length;
      while (k < P.length && ZAVIRACI.includes(P[k])) k++;
      let s = k; while (s < P.length && /\s/.test(P[s])) s++;
      if (s >= P.length) { konce.push(od + k); continue; }
      if (s === k) continue;                         // „3.5“, „např.zde“ – bez mezery to není konec
      let t = s; while (t < P.length - 1 && '*_'.includes(P[t])) t++;
      const dalsi = P[t];
      if (m[0] === '.') {
        const pred = /([\p{L}\d]+)$/u.exec(P.slice(0, i));
        if (pred) {
          const w = pred[1];
          if (NETERM.has(w.toLowerCase())) continue;          // např. / Ing. / str.
          if (/^\p{Lu}$/u.test(w)) continue;                   // iniciála: K. H. Mácha
          if (/^\d+$/.test(w) && /\d/.test(dalsi)) continue;   // datum: 6. 11. 2026
          if (/^\d+$/.test(w) && /\p{Ll}/u.test(dalsi)) continue;
        }
      }
      if (/\p{Lu}/u.test(dalsi) || '„»"(–—-'.includes(dalsi) || /\d/.test(dalsi)) konce.push(od + k);
    }
    return konce;
  }

  // jednoduché dělení na věty (pro testy a mimo rozbor)
  function vety(text) {
    return rozeber(text, { typy: {} }).vety.map(v => text.slice(v.od, v.do));
  }

  // ---------- seznamy slov (přesně, předpona s *, víceslovné fráze) ----------
  function pripravSeznam(polozky) {
    const presne = new Set(), predpony = [], fraze = [];
    for (const raw of polozky || []) {
      const p = String(raw).trim().toLowerCase();
      if (!p || p.startsWith('#')) continue;
      if (/\s/.test(p)) fraze.push(p.split(/\s+/));
      else if (p.endsWith('*')) { if (p.length > 1) predpony.push(p.slice(0, -1)); }
      else presne.add(p);
    }
    fraze.sort((a, b) => b.length - a.length);
    const slovoSedi = (vzor, w) => vzor.endsWith('*') ? w.startsWith(vzor.slice(0, -1)) : w === vzor;
    return {
      ma: w => presne.has(w) || predpony.some(x => w.startsWith(x)),
      fraze,
      fraziSedi: (vzor, slova) => vzor.every((v, i) => slovoSedi(v, slova[i])),
    };
  }

  function nastavSlouc(n) {
    const v = Object.assign({}, VYCHOZI, n || {});
    v.typy = Object.assign({}, (n && n.typy) || VYCHOZI.typy);   // zadané typy platí přesně (chybějící = vypnuto)
    return v;
  }

  // příčestí trpné a slova, která tak jen vypadají
  const RE_PRIC_N = /(?:en|ena|eno|eni|eny|ěn|ěna|ěno|ěni|ěny|án|ána|áno|áni|ány)$/;
  // holé -it/-ut se plete s infinitivem (musel jsem naložit) – jen tvary s koncovkou rodu/čísla
  const RE_PRIC_T = /(?:ita|ito|iti|ity|yta|yto|yti|yty)$/;
  const NE_PRIC = new Set(('žena ženy cena ceny stěna stěny scéna scény jméno seno jeden jelen kámen kořen plamen pramen týden hřeben ' +
    'blázen schopen ochoten povinen hoden pán plán ven jen den sen len zván oběd svět vidět žít chtít mít vzít pít bít šít mýt krýt ' +
    'změna změny směna směny výměna výměny odměna odměny leden únor březen duben květen červen říjen ryt kryt byt vit hit kit cit klid kus').split(' '));
  const POM_TRPNY = new Set('byl byla bylo byli byly být je jsou jsem jsi jsme jste bude budu budeš budeme budete budou bývá bývají býval bývala bývalo bývali bývaly byť'.split(' '));
  const POM_BUDOUCI = new Set('bude budu budeš budeme budete budou být byť'.split(' '));
  // -ní jen u podstatných jmen slovesných (uložení, vedení) – ne přídavná jména (zadní, minimální)
  const RE_ABSTRAKT = /(?:[eáě]ní|[iu]tí|ost|osti|ostí|ostem|ostmi|ace|aci|ací|acemi|ství|stvím|stvích|ismu|ismus|ita|ity|itě)$/;
  const ZACIT = new Set('začal začala začalo začali začaly začne začnu začneš začneme začnete začnou začínal začínala začínalo začínali začínaly začíná začínají počal počala počalo počali počaly'.split(' '));
  const RE_INF = /(?:at|át|et|ět|it|ít|out|ýt|ovat|ést|íst|ást|ct|ci|zt)$/;
  const RE_PRISL = /(?:ně|le|tě|vě|še|ce|ze|dě|[dsthm]ře)$/;   // -ře jen dobře, ostře, chytře, moudře…   // ne -sky/-cky: „řekl česky“ je informace, ne ozdoba
  const NE_PRISL = new Set('ruce noze hlavě ženě tváře dveře chvíle stole škole posteli vodě matce zemi cestě ulice ruka tvé své mé ale pole ně mě sestře dceři ženy matky stejně jistě konečně přesně zase proto teprve hned právě nahoře dole venku uvnitř hodně hlavně zřejmě původně především'.split(' '));
  const MISTNI = new Set('v ve do z ze ze'.split(' '));
  const PREDLOZKY = new Set('v ve na o po při u k ke s se z ze za před pod nad'.split(' '));
  const ZAJMENA = new Set('on ona ono oni ony já ty my vy'.split(' '));

  // ================= hlavní rozbor =================
  function rozeber(text, nastaveni) {
    text = String(text || '');
    const N = nastavSlouc(nastaveni);
    const B = bloky(text);

    // --- kapitoly: nejvyšší úroveň nadpisů, která je aspoň dvakrát ---
    const pocUr = {}; B.forEach(b => { if (b.typ === 'nadpis') pocUr[b.uroven] = (pocUr[b.uroven] || 0) + 1; });
    let L = 0; for (let u = 1; u <= 6; u++) if (pocUr[u] >= 2) { L = u; break; }
    const kapitoly = [];
    let kap = null;
    const novaKap = (nazev, od) => { kap = { nazev, od, do: text.length, slov: 0, vet: 0, pismen: 0, pismenReci: 0, slabik: 0, slovPismen: 0, dlouhychSlov: 0, vetyIdx: [] }; kapitoly.push(kap); };
    for (const b of B) {
      if (b.typ === 'nadpis' && (L ? b.uroven <= L : !kap)) {
        if (kap && !kap.obsah) { kap.nazev = b.nazev || kap.nazev; kap.od = b.od; }   // titul knihy hned před kapitolou
        else { if (kap) kap.do = b.od; novaKap(b.nazev || 'Bez názvu', b.od); }
      } else if (b.typ === 'odstavec') { if (!kap) novaKap(L ? 'Začátek' : 'Celý text', 0); kap.obsah = true; }
      b.kap = kapitoly.length - 1;
    }

    // --- tokeny a věty ---
    const tokeny = [], vetyArr = [];
    for (const b of B) {
      if (b.typ !== 'odstavec') continue;
      const K = kapitoly[b.kap];
      // přímá řeč v odstavci: úseky uvnitř uvozovek
      const rec = [];
      let uvnitr = -1;
      for (let i = b.od; i < b.do; i++) {
        const c = text[i];
        if (uvnitr < 0 && (c === '„' || c === '»' || c === '“' || c === '"')) uvnitr = i;
        else if (uvnitr >= 0 && (c === '“' || c === '”' || c === '«' || c === '"')) { rec.push([uvnitr, i + 1]); uvnitr = -1; }
        if (/\p{L}/u.test(c)) { K.pismen++; if (uvnitr >= 0) K.pismenReci++; }
      }
      if (uvnitr >= 0) rec.push([uvnitr, b.do]);
      const vRec = pos => rec.some(([a, z]) => pos >= a && pos < z);

      const konce = konceVet(text, b.od, b.do);
      if (!konce.length || konce[konce.length - 1] < b.do) konce.push(b.do);
      let start = b.od;
      for (const konec of konce) {
        const usek = text.slice(start, konec);
        const v = { od: start + (usek.length - usek.trimStart().length), do: konec, kap: b.kap, prvni: tokeny.length, slov: 0 };
        RE_TOKEN.lastIndex = 0; let m;
        let predKonec = v.od;
        while ((m = RE_TOKEN.exec(usek))) {
          const od = start + m.index, s = m[0], l = s.toLowerCase();
          const mezi = text.slice(predKonec, od);
          const cislo = /^\d/.test(s);
          tokeny.push({
            s, l, od, do: od + s.length, v: vetyArr.length, k: b.kap, cislo,
            zac: tokeny.length === v.prvni || /[„»":–—]/.test(mezi),
            velke: /^\p{Lu}/u.test(s), rec: vRec(od),
          });
          predKonec = od + s.length;
        }
        v.slov = tokeny.length - v.prvni;
        if (v.slov) {
          vetyArr.push(v); K.vet++; K.vetyIdx.push(vetyArr.length - 1);
        }
        start = konec;
      }
    }
    const T = tokeny;
    for (const t of T) {
      const K = kapitoly[t.k]; K.slov++;
      if (!t.cislo) { const sl = slabiky(t.s); K.slabik += sl; K.slovPismen++; if (sl >= 4) K.dlouhychSlov++; }
    }
    // mezi tokeny i a i+1 jen mezera (žádná interpunkce) a stejná věta
    const tesne = i => i + 1 < T.length && T[i].v === T[i + 1].v && /^\s+$/.test(text.slice(T[i].do, T[i + 1].od));

    // --- jména postav: velké písmeno uvnitř věty ---
    const nepocitat = pripravSeznam(N.nepocitat);
    const nepocitatKmeny = new Set((N.nepocitat || []).filter(x => !/[\s*]/.test(x.trim()) && x.trim()).map(x => kmen(x.trim())));
    const nehlasit = t => nepocitat.ma(t.l) || nepocitatKmeny.has(kmen(t.l));
    const vata = pripravSeznam(N.vata), slaba = pripravSeznam(N.slaba), reci = pripravSeznam(N.slovesaReci);
    const jmenaKmeny = new Map();
    for (const t of T) {
      if (t.velke && !t.zac && !t.cislo && t.s.length >= 2 && !/^\p{Lu}+$/u.test(t.s.length > 1 ? t.s : '') && !STOP.has(t.l)) {
        const k = kmenJmena(t.s);
        jmenaKmeny.set(k, (jmenaKmeny.get(k) || 0) + 1);
      }
    }
    const jeJmeno = t => t.velke && !t.cislo && (jmenaKmeny.get(kmenJmena(t.s)) || 0) >= (t.zac ? 2 : 1);

    const nalezy = [];
    const pridej = (typ, od, doo, zprava, extra) => {
      if (!N.typy[typ]) return;
      nalezy.push(Object.assign({ id: nalezy.length, typ, od, do: doo, text: text.slice(od, doo), zprava, kap: T.length ? kapitolaNa(od) : 0 }, extra || {}));
    };
    const kapitolaNa = pos => { let i = 0; while (i + 1 < kapitoly.length && kapitoly[i + 1].od <= pos) i++; return i; };

    // --- dlouhé věty ---
    for (const v of vetyArr) if (v.slov > N.prahVety)
      pridej('dlouha', v.od, v.do, `Dlouhá věta: ${v.slov} slov (práh ${N.prahVety})`, { slov: v.slov });

    // --- stejné začátky vět (Věra… Věra… Věra…) – jen vyprávění, ne věty začínající přímou řečí ---
    {
      let beh = [];
      const uzavri = () => {
        if (beh.length >= N.zacatkyMin) {
          const [a, ...dal] = beh;
          const n = beh.length, kolik = n < 5 ? `${n} věty po sobě začínají` : `${n} vět po sobě začíná`;
          pridej('zacatky', a.od, a.do, `${kolik} slovem „${a.s}“ – obměňte začátky`,
            { dalsi: dal.map(t => ({ od: t.od, do: t.do })), pocet: beh.length });
        }
        beh = [];
      };
      for (const v of vetyArr) {
        const t = T[v.prvni];
        if (!t || t.rec || t.cislo) { uzavri(); continue; }
        const posl = beh[beh.length - 1];
        if (posl && (posl.k !== t.k || posl.l !== t.l)) uzavri();
        beh.push(t);
      }
      uzavri();
    }

    // --- opakovaná slova v blízkosti ---
    if (N.typy.opakovani) {
      let posl = new Map(), kapPosl = -1;
      for (let i = 0; i < T.length; i++) {
        const t = T[i];
        if (t.k !== kapPosl) { posl = new Map(); kapPosl = t.k; }
        // slovesa řeči a slabá slovesa se neopakují „rušivě“ (řekl…řekla) – slabá hlásí vlastní typ
        if (t.cislo || t.s.length < N.minDelka || STOP.has(t.l) || nehlasit(t) || reci.ma(t.l) || slaba.ma(t.l)) continue;
        if (N.ignorovatJmena && jeJmeno(t)) continue;
        let k = kmen(t.l); if (k.length < 3) k = t.l;
        const j = posl.get(k);
        if (j !== undefined && i - j <= N.okno) {
          pridej('opakovani', t.od, t.do, `Opakování „${t.s}“ – předchozí výskyt před ${i - j} slovy („${T[j].s}“)`,
            { dalsi: [{ od: T[j].od, do: T[j].do }], vzdalenost: i - j, kmen: k });
        }
        posl.set(k, i);
      }
    }

    // --- trpný rod (pomocné sloveso být + příčestí trpné) ---
    const pomocneTrpne = new Set();
    for (let i = 0; i < T.length; i++) {
      const t = T[i];
      if (!POM_TRPNY.has(t.l)) continue;
      for (let d = 1; d <= 2; d++) {
        if (!tesne(i + d - 1)) break;
        const p = T[i + d];
        if (d === 2 && STOP.has(T[i + 1].l) && !POM_TRPNY.has(T[i + 1].l) && !['už', 'již', 'také', 'taky', 'ještě', 'pak', 'tam', 'tu'].includes(T[i + 1].l)) break;   // „byla to žena“
        if (d === 2 && (/[áýéí]$/.test(T[i + 1].l) || RE_INF.test(T[i + 1].l))) break;   // přídavné jméno / infinitiv mezi                         // „byla rezavá pěna“ – přídavné jméno, ne příslovce
        if (p.velke || p.cislo || STOP.has(p.l) || NE_PRIC.has(p.l) || p.l.length < 5 || /men[aoy]?$/.test(p.l)) continue;
        const sedi = RE_PRIC_N.test(p.l) || (!POM_BUDOUCI.has(t.l) && RE_PRIC_T.test(p.l));
        if (sedi) {
          pridej('trpny', t.od, p.do, `Trpný rod: „${text.slice(t.od, p.do)}“ – kdo to dělá?`);
          pomocneTrpne.add(i);
          break;
        }
      }
    }

    // --- vata, slabá slovesa, začal + infinitiv ---
    const tichaRec = t => N.recNehlasit && t.rec;
    for (let i = 0; i < T.length; i++) {
      const t = T[i];
      if (tichaRec(t)) continue;
      // víceslovné fráze vaty (nejdelší první)
      let fraze = null;
      for (const f of vata.fraze) {
        if (i + f.length > T.length) continue;
        let ok = true; for (let d = 0; d < f.length - 1; d++) if (!tesne(i + d)) { ok = false; break; }
        if (ok && vata.fraziSedi(f, T.slice(i, i + f.length).map(x => x.l))) { fraze = f; break; }
      }
      if (fraze) {
        const z = T[i + fraze.length - 1];
        pridej('vata', t.od, z.do, `Vata: „${text.slice(t.od, z.do)}“ – zkuste vypustit`);
        i += fraze.length - 1; continue;
      }
      if (vata.ma(t.l)) { pridej('vata', t.od, t.do, `Vata: „${t.s}“ – zkuste vypustit`); continue; }
      if (ZACIT.has(t.l)) {
        let j = i;
        for (let d = 0; d < 4 && tesne(j); d++) {
          j++;
          if (['se', 'si', 'zase', 'znovu', 'opět', 'pomalu', 'hned'].includes(T[j].l)) continue;
          if (RE_INF.test(T[j].l) && T[j].l.length >= 4) pridej('zacal', t.od, T[j].do, `„${text.slice(t.od, T[j].do)}“ – stačí samotné sloveso`);
          break;
        }
      }
      if (slaba.ma(t.l) && !pomocneTrpne.has(i)) pridej('slabe', t.od, t.do, `Slabé sloveso „${t.s}“ – najde se konkrétnější?`);
    }

    // --- příslovce u sloves řeči (řekl tiše / tiše řekl / řekl Jan tiše) ---
    const PRISL_PRED = new Set('rychle vesele mile zle prudce krátce tvrdě hrdě'.split(' '));
    const jePrislPred = t => jePrisl(t) && (/(?:ně|še|itě)$/.test(t.l) || PRISL_PRED.has(t.l));   // před slovesem jen jasná příslovce způsobu
    const jePrisl = t => t && !t.velke && !t.cislo && t.l.length >= 4 && RE_PRISL.test(t.l) && !STOP.has(t.l) && !NE_PRISL.has(t.l) && !/(?:dce|vce|yně|[aeiouyáéíóúůýě]ce|ize)$/.test(t.l) && !vata.ma(t.l);
    for (let i = 0; i < T.length; i++) {
      const t = T[i];
      if (!reci.ma(t.l)) continue;
      let p = null, v = i;
      if (tesne(v) && (T[v + 1].l === 'se' || T[v + 1].l === 'si')) v++;   // „zeptala se tiše“
      if (tesne(v) && jePrisl(T[v + 1])) p = T[v + 1];
      else if (tesne(v) && (T[v + 1].velke || ZAJMENA.has(T[v + 1].l)) && tesne(v + 1) && jePrisl(T[v + 2])) p = T[v + 2];
      else if (i > 0 && tesne(i - 1) && jePrislPred(T[i - 1]) && !(i > 1 && tesne(i - 2) && PREDLOZKY.has(T[i - 2].l))) p = T[i - 1];   // ne „v dílně řekla“
      if (p) {
        const od = Math.min(t.od, p.od), doo = Math.max(t.do, p.do);
        pridej('rec', od, doo, `Příslovce u slovesa řeči: „${text.slice(od, doo)}“ – ukažte to raději jednáním`);
      }
    }

    // --- řetězce podstatných jmen (nominální styl) ---
    // člen řetězu: abstraktum (-ní, -ost, -ace…) nebo podstatné jméno v 2. pádě (stavu, organizace); aspoň dvě abstrakta
    const jeAbs = t => !t.velke && !t.cislo && t.l.length >= 4 && !STOP.has(t.l) && RE_ABSTRAKT.test(t.l);
    const jeGen = t => !t.velke && !t.cislo && t.l.length >= 4 && !STOP.has(t.l) && /[uyeaůě]$/.test(t.l) && !/(?:l[aoiy]?|t|ti|ce)$/.test(t.l) && !vata.ma(t.l);
    for (let i = 0; i < T.length; i++) {
      if (!jeAbs(T[i])) continue;
      let j = i, abs = 1;
      while (tesne(j) && (jeAbs(T[j + 1]) || jeGen(T[j + 1]))) { j++; if (jeAbs(T[j])) abs++; }
      while (j > i && !jeAbs(T[j]) && !jeGen(T[j])) j--;
      const n = j - i + 1;
      if (n >= N.retezMin && abs >= 2) pridej('retez', T[i].od, T[j].do, `Řetězec ${n} podstatných jmen: „${text.slice(T[i].od, T[j].do)}“ – rozepište slovesem`, { slov: n });
      i = j;
    }

    nalezy.sort((a, b) => a.od - b.od || b.do - a.do);
    nalezy.forEach((n, i) => { n.id = i; });

    // --- četnost slov (podle kmene, zobrazí nejčastější tvar) ---
    const skup = new Map();
    for (const t of T) {
      if (t.cislo || t.s.length < 3 || STOP.has(t.l) || nehlasit(t) || jeJmeno(t)) continue;
      const k = kmen(t.l);
      let g = skup.get(k); if (!g) skup.set(k, g = { pocet: 0, tvary: {} });
      g.pocet++; g.tvary[t.l] = (g.tvary[t.l] || 0) + 1;
    }
    const nejTvar = tv => Object.entries(tv).sort((a, b) => b[1] - a[1])[0][0];
    const frekvence = [...skup.entries()].map(([k, g]) => ({ slovo: nejTvar(g.tvary), kmen: k, pocet: g.pocet, tvary: Object.keys(g.tvary) }))
      .sort((a, b) => b.pocet - a.pocet || a.slovo.localeCompare(b.slovo, 'cs')).slice(0, 100);

    // --- slovní spojení 2–4 slova (aspoň jedno plnovýznamové) ---
    const ngr = new Map();
    for (let i = 0; i < T.length; i++) {
      let obsah = false;
      for (let n = 1; n <= 4; n++) {
        const t = T[i + n - 1];
        if (!t || (n > 1 && !tesne(i + n - 2))) break;
        if (!STOP.has(t.l) && !t.cislo && !jeJmeno(t)) obsah = true;
        if (n >= 2 && obsah) {
          const kl = T.slice(i, i + n).map(x => x.l).join(' ');
          ngr.set(kl, (ngr.get(kl) || 0) + 1);
        }
      }
    }
    const minPocet = T.length > 3000 ? 3 : 2;
    let spojeni = [...ngr.entries()].filter(([, p]) => p >= minPocet).map(([text, pocet]) => ({ text, pocet, n: text.split(' ').length }));
    // kratší spojení, které je jen částí stejně častého delšího, vypustit
    const delsi = spojeni.filter(s => s.n > 2);
    spojeni = spojeni.filter(s => !delsi.some(d => d.n > s.n && d.pocet === s.pocet && (' ' + d.text + ' ').includes(' ' + s.text + ' ')));
    spojeni.sort((a, b) => b.pocet - a.pocet || b.n - a.n || a.text.localeCompare(b.text, 'cs'));
    spojeni = spojeni.slice(0, 60);

    // --- postavy (jména) po kapitolách ---
    // místo = jméno, které stojí často po místní předložce (v Chebu, do Prahy, z Brna); postava skoro nikdy
    const post = new Map();
    for (let i = 0; i < T.length; i++) {
      const t = T[i];
      if (!jeJmeno(t) || STOP.has(t.l)) continue;
      const k = kmenJmena(t.s);
      if ((jmenaKmeny.get(k) || 0) < 2) continue;
      let p = post.get(k); if (!p) post.set(k, p = { kmen: k, celkem: 0, mistni: 0, tvary: {}, poKap: kapitoly.map(() => 0), prvni: t.od });
      p.celkem++; p.tvary[t.s] = (p.tvary[t.s] || 0) + 1; p.poKap[t.k]++;
      if (i > 0 && tesne(i - 1) && MISTNI.has(T[i - 1].l)) p.mistni++;
    }
    const postavy = [...post.values()].filter(p => p.celkem >= 3)
      .map(p => ({ jmeno: nejTvar(p.tvary), kmen: p.kmen, celkem: p.celkem, poKap: p.poKap, prvni: p.prvni, tvary: Object.keys(p.tvary),
        misto: p.mistni / p.celkem >= 0.35 }))
      .sort((a, b) => b.celkem - a.celkem).slice(0, 60);

    // --- souhrny kapitol ---
    for (const K of kapitoly) {
      K.slovNaVetu = K.vet ? K.slov / K.vet : 0;
      K.slabikNaSlovo = K.slovPismen ? K.slabik / K.slovPismen : 0;
      K.podilReci = K.pismen ? K.pismenReci / K.pismen : 0;
      K.minut = K.slov / N.rychlost;
      K.nalezu = 0;
      K.delkyVet = K.vetyIdx.map(i => ({ slov: vetyArr[i].slov, od: vetyArr[i].od, do: vetyArr[i].do }));
      delete K.vetyIdx; delete K.obsah;
    }
    nalezy.forEach(n => { if (kapitoly[n.kap]) kapitoly[n.kap].nalezu++; });
    const sum = f => kapitoly.reduce((a, K) => a + K[f], 0);
    const slov = T.length, vet = vetyArr.length, slovPism = sum('slovPismen'), pism = sum('pismen');
    const souhrn = {
      slov, vet, odstavcu: B.filter(b => b.typ === 'odstavec').length, znaku: text.length,
      slovNaVetu: vet ? slov / vet : 0,
      slabikNaSlovo: slovPism ? sum('slabik') / slovPism : 0,
      podilDlouhychSlov: slovPism ? sum('dlouhychSlov') / slovPism : 0,
      podilReci: pism ? sum('pismenReci') / pism : 0,
      minut: slov / N.rychlost, minutNahlas: slov / N.rychlostNahlas,
      normostran: text.replace(/\s+/g, ' ').length / 1800,
      nejdelsiVeta: vetyArr.reduce((a, v) => Math.max(a, v.slov), 0),
    };
    souhrn.ctivost = hodnoceniCtivosti(souhrn.slovNaVetu);
    return { kapitoly, vety: vetyArr, tokeny: T, nalezy, frekvence, spojeni, postavy, souhrn, nastaveni: N };
  }

  function hodnoceniCtivosti(slovNaVetu) {
    if (!slovNaVetu) return '–';
    if (slovNaVetu <= 10) return 'velmi svižné';
    if (slovNaVetu <= 15) return 'svižné';
    if (slovNaVetu <= 20) return 'běžné';
    if (slovNaVetu <= 25) return 'náročnější';
    return 'náročné';
  }

  // ---------- pomocné: doba, řádek, klíč nálezu ----------
  function doba(minut) {
    const m = Math.round(minut);
    if (m < 1) return '< 1 min';
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${m % 60} min`;
  }
  function radkyIndex(text) {
    const z = [0]; for (let i = 0; i < text.length; i++) if (text[i] === '\n') z.push(i + 1);
    return pos => { let lo = 0, hi = z.length - 1; while (lo < hi) { const s = (lo + hi + 1) >> 1; if (z[s] <= pos) lo = s; else hi = s - 1; } return lo + 1; };
  }
  // klíč nálezu nezávislý na pozici – přežije úpravy jinde v textu
  function klic(n, text) {
    const okoli = text.slice(Math.max(0, n.od - 25), Math.min(text.length, n.do + 25)).replace(/\s+/g, ' ').toLowerCase();
    return n.typ + '|' + n.text.slice(0, 80).toLowerCase() + '|' + okoli.slice(0, 160);
  }
  function kontext(text, n, kolik) {
    kolik = kolik || 40;
    const a = Math.max(0, n.od - kolik), z = Math.min(text.length, n.do + kolik);
    return ((a > 0 ? '…' : '') + text.slice(a, z) + (z < text.length ? '…' : '')).replace(/\s+/g, ' ');
  }

  // ---------- export ----------
  // ignorovane: Set klíčů nebo funkce (nález) → true
  const jeIgnFn = (ign, text) => typeof ign === 'function' ? ign : (n => !!ign && ign.has(klic(n, text)));
  function csv(rozbor, text, ignorovane) {
    const jeIgn = jeIgnFn(ignorovane, text), radek = radkyIndex(text);
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    const r = [['typ', 'kapitola', 'řádek', 'text', 'zpráva', 'kontext'].join(';')];
    for (const n of rozbor.nalezy) {
      if (jeIgn(n)) continue;
      r.push([TYPY[n.typ].nazev, (rozbor.kapitoly[n.kap] || {}).nazev || '', radek(n.od), n.text.replace(/\s+/g, ' '), n.zprava, kontext(text, n)].map(q).join(';'));
    }
    return '\uFEFF' + r.join('\r\n') + '\r\n';
  }

  function procenta(x) { return (x * 100).toFixed(0) + ' %'; }
  function cislo(x, d) { return x.toFixed(d === undefined ? 1 : d).replace('.', ','); }

  function zpravaMd(rozbor, text, nazev, ignorovane) {
    const jeIgn = jeIgnFn(ignorovane, text), S = rozbor.souhrn, radek = radkyIndex(text);
    const platne = rozbor.nalezy.filter(n => !jeIgn(n));
    const o = [];
    o.push(`# Redakční zpráva: ${nazev || 'rukopis'}`, '');
    o.push(`*Vytvořeno ${new Date().toLocaleDateString('cs-CZ')} stránkou Redakční lupa rukopisu.*`, '');
    o.push('## Souhrn', '');
    o.push(`- Slov: **${S.slov}**, vět: ${S.vet}, odstavců: ${S.odstavcu}, normostran: ${cislo(S.normostran)}`);
    o.push(`- Průměr: ${cislo(S.slovNaVetu)} slov ve větě, ${cislo(S.slabikNaSlovo, 2)} slabik ve slově (čtivost: ${S.ctivost})`);
    o.push(`- Nejdelší věta: ${S.nejdelsiVeta} slov; dlouhá slova (4+ slabik): ${procenta(S.podilDlouhychSlov)}`);
    o.push(`- Přímá řeč: ${procenta(S.podilReci)} textu`);
    o.push(`- Doba čtení: ${doba(S.minut)} potichu, ${doba(S.minutNahlas)} nahlas`);
    o.push(`- Nálezů: ${platne.length}${platne.length < rozbor.nalezy.length ? ` (ignorováno ${rozbor.nalezy.length - platne.length})` : ''}`, '');
    o.push('| Typ | Počet |', '|---|---:|');
    for (const [t, d] of Object.entries(TYPY)) {
      const p = platne.filter(n => n.typ === t).length;
      if (p) o.push(`| ${d.nazev} | ${p} |`);
    }
    o.push('', '## Kapitoly', '');
    o.push('| Kapitola | Slov | Vět | Slov/věta | Slabik/slovo | Přímá řeč | Čtení | Nálezů |', '|---|---:|---:|---:|---:|---:|---:|---:|');
    rozbor.kapitoly.forEach((K, i) => {
      const nal = platne.filter(n => n.kap === i).length;
      o.push(`| ${K.nazev.replace(/\|/g, '/')} | ${K.slov} | ${K.vet} | ${cislo(K.slovNaVetu)} | ${cislo(K.slabikNaSlovo, 2)} | ${procenta(K.podilReci)} | ${doba(K.minut)} | ${nal} |`);
    });
    for (const [nadpis, sez] of [['Postavy (výskyty jmen)', rozbor.postavy.filter(p => !p.misto)], ['Místa', rozbor.postavy.filter(p => p.misto)]]) {
      if (!sez.length) continue;
      o.push('', '## ' + nadpis, '');
      o.push('| Jméno | Celkem | ' + rozbor.kapitoly.map((K, i) => String(i + 1)).join(' | ') + ' |');
      o.push('|---|---:|' + rozbor.kapitoly.map(() => '---:').join('|') + '|');
      for (const p of sez.slice(0, 20)) o.push(`| ${p.jmeno} | ${p.celkem} | ${p.poKap.join(' | ')} |`);
    }
    o.push('', '## Nejčastější slova', '', rozbor.frekvence.slice(0, 30).map(f => `${f.slovo} (${f.pocet})`).join(', ') || '–');
    o.push('', '## Opakovaná slovní spojení', '', rozbor.spojeni.slice(0, 25).map(f => `„${f.text}“ (${f.pocet})`).join(', ') || '–');
    o.push('', '## Nálezy', '');
    let kap = -1;
    for (const n of platne) {
      if (n.kap !== kap) { kap = n.kap; o.push('', `### ${(rozbor.kapitoly[kap] || {}).nazev || ''}`, ''); }
      o.push(`- **${TYPY[n.typ].nazev}** (ř. ${radek(n.od)}): ${n.zprava}  \n  > ${kontext(text, n).replace(/[*_#]/g, '')}`);
    }
    return o.join('\n') + '\n';
  }

  return { TYPY, VYCHOZI, STOP, rozeber, vety, bloky, kmen, kmenJmena, slabiky, pripravSeznam, klic, kontext, doba, radkyIndex, csv, zpravaMd, hodnoceniCtivosti };
});
