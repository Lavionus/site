/* Země v kostce – jádro bez DOM (test: _test/zeme_v_kostce_test.js).
   Rozbor řádků z data.js, slučitelnost zásuvek a napětí mezi dvěma zeměmi,
   časový posun (Intl), hledání a kontrolní seznam před cestou.
   V prohlížeči window.ZVK, v node module.exports. */
(function () {
  'use strict';

  const OBLASTI = { E: 'Evropa', A: 'Asie', F: 'Afrika', S: 'Severní a Střední Amerika', J: 'Jižní Amerika', O: 'Oceánie' };
  const SPROPITNE = [
    'není zvykem',
    'zaokrouhlit nebo nechat drobné (asi 5–10 %)',
    'obvykle kolem 10 %, pokud není v účtu',
    'očekává se 15–20 %'
  ];
  const VODA = {
    a: 'kohoutková voda je běžně pitná',
    c: 'obvykle pitná, místně (venkov, staré rozvody) raději balená',
    n: 'kohoutkovou nepít – balená nebo převařená'
  };
  const NEJISTE = { t: 'tísňová čísla', z: 'typy zásuvek', v: 'napětí', s: 'spropitné', w: 'voda' };
  // EU + EHP: roaming za domácí ceny, EHIC kartička
  const EHP = 'AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE,IS,LI,NO'.split(',');

  /* Které zásuvky vidlice daného typu bez adaptéru přijmou (IEC World Plugs).
     E a F bereme jako dnešní hybridní vidlici E/F; plochá Europlug C projde mnoha zásuvkami. */
  const PASUJE = {
    A: 'AB', B: 'B', C: 'CEFHJKLN', D: 'D', E: 'EF', F: 'EF', G: 'G', H: 'H', I: 'I',
    J: 'J', K: 'K', L: 'L', M: 'M', N: 'N', O: 'O'
  };
  const TYPY = Object.keys(PASUJE).join('');
  const POPIS_TYPU = {
    A: 'dva ploché kolíky (USA, Japonsko)',
    B: 'dva ploché kolíky + kulatý zemnicí (USA)',
    C: 'Europlug – dva kulaté kolíky bez uzemnění',
    D: 'tři silné kulaté kolíky do trojúhelníku (Indie, staré britské)',
    E: 'dva kulaté kolíky, zemnicí kolík v zásuvce (ČR, Francie)',
    F: 'Schuko – dva kulaté kolíky, zemnicí pera po stranách (Německo)',
    G: 'tři obdélníkové kolíky (Velká Británie)',
    H: 'tři kolíky do V (Izrael)',
    I: 'dva šikmé ploché kolíky + zemnicí (Austrálie, Čína)',
    J: 'tři kulaté kolíky, zemnicí mimo osu (Švýcarsko)',
    K: 'dva kulaté kolíky + půlkruhový zemnicí (Dánsko)',
    L: 'tři kulaté kolíky v řadě (Itálie)',
    M: 'tři silné kulaté kolíky, 15 A (Jižní Afrika)',
    N: 'tři kulaté kolíky v šestiúhelníkové zásuvce (Brazílie)',
    O: 'dva kulaté kolíky + zemnicí (Thajsko)'
  };

  /** Rozbor jednoho řádku data.js → objekt země. */
  function rozeberRadek(radek) {
    const p = radek.split('|');
    if (p.length !== 15) throw new Error('Špatný počet polí: ' + radek);
    const [kod, oblast, z, v, f, j, t, e, m, pr, tz, l, s, w, q] = p;
    return {
      kod, oblast, zasuvky: z.split(''), napeti: v.split('/').map(Number), hz: f.split('/').map(Number),
      jizda: j, tisnova: t.split(',').map(x => x === '-' ? '' : x), jednotne: e,
      meny: m.split('+'), predvolba: '+' + pr.replace('-', ' '), pasma: tz.split('+'), jazyky: l.split('+'),
      spropitne: +s, voda: w, nejiste: q.split('')
    };
  }

  /** Všechny země z dat {radky: [...], vinety} → pole seřazené podle kódu. */
  function nactiZeme(data) {
    const zeme = data.radky.map(rozeberRadek);
    for (const z of zeme) z.vineta = (data.vinety || {})[z.kod] || '';
    return zeme.sort((a, b) => a.kod.localeCompare(b.kod));
  }

  /** Které vidlice země A projdou zásuvkami země B. stav: 'ne' (adaptér netřeba), 'cast', 'ano'. */
  function adapter(a, b) {
    const vidlice = a.zasuvky.map(typ => ({ typ, pasuje: b.zasuvky.some(s => PASUJE[typ].includes(s)) }));
    const n = vidlice.filter(x => x.pasuje).length;
    const stav = n === vidlice.length ? 'ne' : n ? 'cast' : 'ano';
    const ploche = a.zasuvky.includes('C') && b.zasuvky.some(s => PASUJE.C.includes(s));
    // adaptér pro zásuvky, kam neprojdou všechny vidlice domova; čistě plochou C jen když nic jiného není
    const chybi = b.zasuvky.filter(z => !a.zasuvky.every(t => PASUJE[t].includes(z)));
    const bezC = chybi.filter(z => z !== 'C');
    return { stav, vidlice, ploche, doporucene: stav === 'ne' ? [] : (bezC.length ? bezC : chybi) };
  }

  /** Napětí a kmitočet: 'ok' do ±10 %, jinak 'menic'; hz true = jiný kmitočet. */
  function napeti(a, b) {
    const blizko = a.napeti.some(x => b.napeti.some(y => Math.abs(x - y) / x <= 0.1));
    const hz = !a.hz.some(x => b.hz.includes(x));
    return { stav: blizko ? 'ok' : 'menic', hz };
  }

  /** Posun pásma vůči UTC v minutách k danému okamžiku (Intl). */
  function posunUtc(pasmo, kdy) {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: pasmo, timeZoneName: 'longOffset' })
      .formatToParts(kdy || new Date()).find(x => x.type === 'timeZoneName').value;
    const m = /GMT([+-])(\d\d):?(\d\d)?/.exec(s);
    return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0;
  }

  /** Rozdíl času pásma b oproti a v minutách (b − a). */
  function rozdilCasu(a, b, kdy) { return posunUtc(b, kdy) - posunUtc(a, kdy); }

  /** „+5 h 30 min“, „−1 h“, „stejný čas“. */
  function formatRozdil(min) {
    if (!min) return 'stejný čas';
    const z = min < 0 ? '−' : '+', a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
    return z + (h ? h + ' h' : '') + (m ? (h ? ' ' : '') + m + ' min' : '');
  }

  /** Bez diakritiky, malá písmena – pro hledání. */
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  /** Hledání podle názvů (pole řetězců od volajícího), kódu, měny, předvolby. */
  function hledej(zeme, dotaz, nazvy) {
    const q = norm(dotaz);
    if (!q) return zeme.slice();
    const cislo = q.replace(/^\+|^00/, '').replace(/\s/g, '');
    return zeme.filter(z => {
      if (z.kod.toLowerCase() === q || z.meny.some(m => m.toLowerCase() === q)) return true;
      if (/^\d+$/.test(cislo) && z.predvolba.replace(/\D/g, '') === cislo) return true;
      return (nazvy(z) || []).some(n => norm(n).includes(q));
    });
  }

  const vEhp = kod => EHP.includes(kod);
  const volnyPohyb = kod => vEhp(kod) || kod === 'CH';   // OP i EHIC platí i ve Švýcarsku
  /** Platí se za dálnice osobním autem? (text nezačíná „Bez poplatků“ / „Osobní auta bez poplatků“) */
  const placeneSilnice = z => !!z.vineta && !/^(Bez poplatků|Osobní auta (zatím )?bez poplatků)/.test(z.vineta);

  /* názvy kódů z ockovani.js a silnice.js */
  const OCKOVANI = { hepA: 'hepatitida A', hepB: 'hepatitida B', tyfus: 'břišní tyfus', vzteklina: 'vzteklina', zz: 'žlutá zimnice', je: 'japonská encefalitida',
    kliste: 'klíšťová encefalitida', meningo: 'meningokok', polio: 'přeočkování proti dětské obrně', cholera: 'cholera' };
  const VYBAVA = { vesta: 'reflexní vesta', trojuhelnik: 'výstražný trojúhelník', lekarnicka: 'lékárnička', hasicak: 'hasicí přístroj', zarovky: 'náhradní žárovky',
    alkohol: 'alkohol tester', snehove: 'sněhové řetězy (v zimě)', kolo: 'rezervní kolo / sada', tazne: 'tažné lano', nalepka: 'označení státu (CZ / EU SPZ)' };
  const VSTUP = { op: 'stačí občanský průkaz', pas: 'cestovní pas, bez víza', eta: 'pas + elektronické povolení předem', evisa: 'pas + e-vízum předem',
    vop: 'pas + vízum při příjezdu', vizum: 'pas + vízum předem (velvyslanectví)' };
  /** Seznam očkování pro zemi: [{k, nazev, uroven: 'povinne'|'doporuceno'|'zvazit'}] (z objektu ockovani.js). */
  function ockovaniZeme(o) {
    if (!o) return [];
    const v = [];
    for (const k of Object.keys(OCKOVANI)) {
      const x = o[k];
      if (!x) continue;
      const uroven = x === 'povinne' ? 'povinne' : k === 'zz' && x === 'prijezd' ? 'prijezd' : ['vzteklina', 'je', 'cholera', 'meningo', 'hepB'].includes(k) ? 'zvazit' : 'doporuceno';
      v.push({ k, nazev: OCKOVANI[k], uroven });
    }
    const poradi = { povinne: 0, doporuceno: 1, prijezd: 2, zvazit: 3 };
    return v.sort((p, q) => poradi[p.uroven] - poradi[q.uroven]);
  }
  /** Potřebuje cesta z a do b pas? (opt.vstup = data vstup.js, platí jen pro domov CZ) */
  function pasNutny(a, b, opt) {
    const v = opt && opt.vstup && a.kod === 'CZ' && opt.vstup[b.kod];
    if (v) return v[0] !== 'op';
    return !(volnyPohyb(b.kod) && volnyPohyb(a.kod));
  }

  /** Kontrolní seznam před cestou z domova (a) do cíle (b): [{id, text, dulezite, detail}].
      opt: {kdy, vstup, ock, sil} – volitelná data vstup.js / ockovani.js / silnice.js (objekty .zeme). */
  function kontrolniSeznam(a, b, opt) {
    opt = opt || {};
    const s = [];
    const pridej = (id, text, dulezite, detail) => s.push({ id, text, dulezite: !!dulezite, detail: detail || '' });
    pridej('doklad', pasNutny(a, b, opt) ? 'Platný cestovní pas (často 6 měsíců po návratu) a víza podle cestovních doporučení MZV' : 'Platný občanský průkaz nebo pas', true);
    const vs = opt.vstup && a.kod === 'CZ' && opt.vstup[b.kod];
    if (vs && !['op', 'pas'].includes(vs[0])) pridej('vstup-' + vs[0], { eta: 'Elektronické povolení ke vstupu (vyřídit online předem)', evisa: 'E-vízum (vyřídit online předem)', vop: 'Vízum při příjezdu (hotovost, fotografie)', vizum: 'Vízum přes velvyslanectví – vyřídit s předstihem' }[vs[0]], true, vs[1]);
    pridej('pojisteni', volnyPohyb(b.kod) ? 'Cestovní pojištění léčebných výloh + evropský průkaz zdravotního pojištění (EHIC)' : 'Cestovní pojištění léčebných výloh', true);
    if (!vEhp(b.kod)) pridej('drozd', 'Registrace v systému DROZD (MZV)');
    const ock = ockovaniZeme(opt.ock && opt.ock[b.kod]).filter(x => x.uroven !== 'prijezd');
    if (!vEhp(b.kod) || ock.length) pridej('ockovani', 'Očkování a léky – konzultace v centru cestovní medicíny (4–8 týdnů předem)', ock.some(x => x.uroven === 'povinne'), ock.map(x => x.nazev + (x.uroven === 'povinne' ? ' (povinné)' : '')).join(', '));
    const mal = opt.ock && opt.ock[b.kod] && opt.ock[b.kod].malarie;
    if (mal) pridej('malarie', 'Malárie – repelent, síť, antimalarika podle lékaře', mal === 'vysoke', mal === 'vysoke' ? 'riziko ve většině země' : 'riziko jen místně');
    const vyb = opt.sil && opt.sil[b.kod] && opt.sil[b.kod].vybava;
    if (vyb && vyb.length) pridej('vybava', 'Povinná výbava auta', false, vyb.map(v => VYBAVA[v] || v).join(', '));
    const pr = opt.prav && opt.prav(b.kod);
    if (pr && pr.dron && pr.dron[0] === 'ne') pridej('dron', 'Dron nechat doma – v zemi zakázaný', true, pr.dron[1]);
    else if (pr && pr.dron && pr.dron[0] === 'omezeno') pridej('dron', 'Dron – ověřit registraci a zakázané zóny', false, pr.dron[1]);
    if (pr && pr.alkohol && pr.alkohol[0] === 'ne') pridej('alkohol', 'Alkohol na veřejnosti (ulice, pláž, park) zakázán', false, pr.alkohol[1]);
    const ad = adapter(a, b);
    if (ad.stav !== 'ne') pridej('adapter', 'Cestovní adaptér pro zásuvky typu', ad.stav === 'ano', ad.doporucene.join(', '));
    const nap = napeti(a, b);
    if (nap.stav === 'menic') pridej('menic', 'Zkontrolovat štítky spotřebičů (100–240 V), jinak měnič napětí', true);
    pridej('mena', 'Hotovost nebo karta pro měnu', false, b.meny.join(' / '));
    if (placeneSilnice(b)) pridej('vineta', 'Dálniční poplatek', false, b.vineta);
    if (b.jizda !== a.jizda) pridej('jizda', b.jizda === 'L' ? 'Jezdí se vlevo – pozor při řízení i přecházení' : 'Jezdí se vpravo');
    pridej('tisnova', 'Uložit si tísňová čísla do telefonu');
    pridej('roaming', vEhp(b.kod) ? 'Roaming za domácí ceny (EU) – ověřit limit dat' : 'Roaming mimo EU – zjistit ceny operátora nebo pořídit místní SIM/eSIM');
    if (b.voda === 'n') pridej('voda', 'Pitná voda: balená, filtr nebo tablety');
    const h = Math.abs(rozdilCasu(a.pasma[0], b.pasma[0], opt.kdy)) / 60;
    if (h >= 3) pridej('cas', 'Časový posun ' + Math.round(h) + ' h – počítat s únavou z přeletu');
    return s;
  }

  /** Nejmenší sada adaptérů pro víc zemí (hladový výběr): [{typ, zeme: [kódy]}].
      Země, kam vidlice z domova projdou, se nepočítají. */
  function sadaAdapteru(a, cile) {
    let zbyva = cile.map(b => ({ kod: b.kod, typy: adapter(a, b).doporucene })).filter(x => x.typy.length);
    const sada = [];
    while (zbyva.length) {
      const pocet = {};
      for (const x of zbyva) for (const t of x.typy) pocet[t] = (pocet[t] || 0) + 1;
      const typ = Object.keys(pocet).sort((p, q) => pocet[q] - pocet[p] || p.localeCompare(q))[0];
      sada.push({ typ, zeme: zbyva.filter(x => x.typy.includes(typ)).map(x => x.kod) });
      zbyva = zbyva.filter(x => !x.typy.includes(typ));
    }
    return sada;
  }

  /** Kontrolní seznam pro cestu přes víc zemí – sloučený podle id, přísnější varianta vyhrává
      (země mimo EU/EHP se projdou první, takže „pas“ přebije „občanský průkaz“). */
  function kontrolniSeznamTrasy(a, cile, opt) {
    const poradi = cile.slice().sort((p, q) => pasNutny(a, q, opt) - pasNutny(a, p, opt));
    const vysl = [], podleId = {};
    for (const b of poradi) {
      for (const p of kontrolniSeznam(a, b, opt)) {
        const x = podleId[p.id];
        if (!x) { podleId[p.id] = Object.assign({}, p, { detaily: p.detail ? [p.detail] : [], zeme: [b.kod] }); vysl.push(podleId[p.id]); continue; }
        x.dulezite = x.dulezite || p.dulezite;
        x.zeme.push(b.kod);
        if (p.detail && !x.detaily.includes(p.detail)) x.detaily.push(p.detail);
        if (p.id === 'cas' && parseInt(p.text.replace(/\D+/, ''), 10) > parseInt(x.text.replace(/\D+/, ''), 10)) x.text = p.text;
      }
    }
    const sada = sadaAdapteru(a, cile);
    for (const x of vysl) {
      if (x.id === 'adapter') { x.detail = sada.map(s => s.typ).join(', '); x.dulezite = cile.some(b => adapter(a, b).stav === 'ano'); }
      else if (x.id === 'mena') x.detail = [...new Set(cile.flatMap(b => b.meny))].join(' / ');
      else if (x.id === 'vineta') x.detail = x.zeme.join(', ');
      else if (x.id === 'pojisteni' && !/EHIC/.test(x.text) && cile.some(b => volnyPohyb(b.kod))) { x.text += ' + evropský průkaz zdravotního pojištění (EHIC) pro země EU/EHP a Švýcarsko'; x.detail = x.detaily.join(' · '); }
      else x.detail = x.detaily.join(' · ');
      delete x.detaily;
    }
    return vysl;
  }

  /** Místní čas (rok, měsíc 1–12, den, hodina, minuta) v pásmu → Date (UTC). Dvě iterace kvůli letnímu času. */
  function mistniNaUtc(r, mes, d, h, min, pasmo) {
    const zaklad = Date.UTC(r, mes - 1, d, h, min || 0);
    let t = zaklad - posunUtc(pasmo, new Date(zaklad)) * 60000;
    t = zaklad - posunUtc(pasmo, new Date(t)) * 60000;
    return new Date(t);
  }

  /** Místní hodina a den v pásmu k okamžiku: {h, min, den: 'YYYY-MM-DD'}. */
  function mistniCas(pasmo, kdy) {
    const t = new Date(kdy.getTime() + posunUtc(pasmo, kdy) * 60000);
    return { h: t.getUTCHours(), min: t.getUTCMinutes(), den: t.toISOString().slice(0, 10) };
  }

  /** Míry a teplota tam, kde se liší od metrických a °C. */
  const JEDNOTKY = {
    US: 'imperiální: míle, stopy, palce, libry, galony (US); teplota ve °F',
    LR: 'převážně imperiální (míle, libry, galony); teplota ve °F',
    MM: 'místní a imperiální jednotky (viss, míle) vedle metrických',
    GB: 'metrické, ale silnice v mílích (mph), pivo a mléko v pintách',
    BS: 'metrické i imperiální, teplota ve °F', BZ: 'imperiální i metrické, teplota ve °F',
    PW: 'teplota ve °F', FM: 'teplota ve °F', MH: 'teplota ve °F',
    AG: 'silnice v mílích', LC: 'silnice v mílích', VC: 'silnice v mílích', KN: 'silnice v mílích', GD: 'silnice v mílích', DM: 'silnice v mílích', WS: 'silnice v mílích'
  };
  const jednotky = kod => JEDNOTKY[kod] || 'metrické, teplota ve °C';

  /** Převod částky: kurzy = {MĚNA: počet jednotek za 1 základní}. Chybí-li kurz, null. */
  function prevedMenu(castka, z, na, kurzy) {
    if (z === na) return castka;
    const a = kurzy[z], b = kurzy[na];
    return a > 0 && b > 0 ? castka / a * b : null;
  }

  /* ---------- itinerář: zastávky {kod, od, do} s volitelnými daty 'YYYY-MM-DD' ---------- */
  const DEN = 864e5;
  const dnyMezi = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DEN);
  const pridejDny = (d, n) => new Date(Date.parse(d) + n * DEN).toISOString().slice(0, 10);

  /** Kontrola termínů: {varovani: [{i, typ, text}], od, do, dni, noci: [počet nocí po zastávkách]}. */
  function kontrolaZastavek(zast) {
    const varovani = [], noci = [];
    let od = '', doo = '';
    zast.forEach((z, i) => {
      noci.push(z.od && z.do ? dnyMezi(z.od, z.do) : null);
      for (const d of [z.od, z.do]) if (d) { if (!od || d < od) od = d; if (!doo || d > doo) doo = d; }
      if (z.od && z.do && z.do < z.od) varovani.push({ i, typ: 'chyba', text: 'odjezd je dřív než příjezd' });
      const pred = zast[i - 1];
      if (pred && pred.do && z.od) {
        if (z.od < pred.do) varovani.push({ i, typ: 'chyba', text: 'překrývá se s předchozí zastávkou' });
        else if (z.od > pred.do) { const n = dnyMezi(pred.do, z.od); varovani.push({ i, typ: 'info', text: `mezera ${n} ${n === 1 ? 'den' : n < 5 ? 'dny' : 'dní'} bez plánu` }); }
      }
    });
    return { varovani, od, do: doo, dni: od && doo ? dnyMezi(od, doo) + 1 : 0, noci };
  }

  /** Nová zastávka navazuje na konec předchozí. */
  function novaZastavka(zast, kod) {
    const pred = zast[zast.length - 1];
    return { kod, od: pred && pred.do ? pred.do : '', do: '' };
  }

  /** Po změně odjezdu se příjezd do další zastávky doplní, je-li prázdný nebo navazoval na starý odjezd. */
  function navazOdjezd(zast, i, novy) {
    const stary = zast[i].do;
    zast[i].do = novy;
    const dalsi = zast[i + 1];
    if (dalsi && novy && (!dalsi.od || dalsi.od === stary)) dalsi.od = novy;
    return zast;
  }

  /** Přesun zastávky z indexu a na index b. */
  function presun(zast, a, b) {
    if (a === b || a < 0 || b < 0 || a >= zast.length || b >= zast.length) return zast;
    const [x] = zast.splice(a, 1);
    zast.splice(b, 0, x);
    return zast;
  }

  /** Dny cesty pro časovou osu: [{den, kody: [kódy zemí toho dne]}] od příjezdu do první zastávky po odjezd z poslední.
      Den přejezdu (odjezd = příjezd další) patří oběma zemím. Bez termínů → []. */
  function dnyCesty(zast) {
    const k = kontrolaZastavek(zast);
    if (!k.od || !k.do || k.dni > 400) return [];
    const vysl = [];
    for (let d = k.od; d <= k.do; d = pridejDny(d, 1)) {
      const kody = zast.filter(z => z.od && z.od <= d && (z.do ? d <= z.do : d === z.od)).map(z => z.kod);
      vysl.push({ den: d, kody });
    }
    return vysl;
  }
  /** Změny posunu od UTC v pásmu mezi dny od..do (letní/zimní čas): [{den, z, na}] v minutách. */
  function zmenyCasu(pasmo, od, doo) {
    const v = [];
    if (!od || !doo) return v;
    const poledne = d => posunUtc(pasmo, new Date(d + 'T12:00:00Z'));
    let pred = poledne(od);
    for (let d = pridejDny(od, 1); d <= doo; d = pridejDny(d, 1)) {
      const p = poledne(d);
      if (p !== pred) v.push({ den: d, z: pred, na: p });
      pred = p;
    }
    return v;
  }
  /** Plán proti jet lagu pro posun (min, kladný = cíl je na východ). Pravidla: posun do 2 h bez opatření;
      před cestou posouvat spánek o 1 h denně (nejvýš 3 dny) – na východ dřív, na západ později;
      přivykání v cíli zhruba 1 den na hodinu na východ, 1 den na 1,5 h na západ. */
  function jetlag(posun) {
    if (Math.abs(posun) > 720) posun -= Math.sign(posun) * 1440;   // přes datovou hranici je kratší opačný směr (Samoa +13 h = −11 h)
    const h = Math.round(Math.abs(posun) / 60);
    if (h < 3) return null;
    const smer = posun > 0 ? 'vychod' : 'zapad';
    return { hodin: h, smer, dnyPred: Math.min(3, h), dnyAdaptace: Math.max(1, Math.round(smer === 'vychod' ? h : h / 1.5)) };
  }
  /** Rozpočet cesty: zast [{kod, mena, dni, denne, jedn}] → {polozky: [{kod, mena, castka}], podleMen: {mena: částka}} */
  function rozpocet(polozky) {
    const podleMen = {};
    const v = polozky.map(p => {
      const castka = Math.max(0, (+p.denne || 0) * Math.max(0, +p.dni || 0) + (+p.jedn || 0));
      if (castka) podleMen[p.mena] = (podleMen[p.mena] || 0) + castka;
      return { kod: p.kod, mena: p.mena, castka };
    });
    return { polozky: v, podleMen };
  }

  /** Odkaz: „AT.20270701.20270705,SI“ ↔ zastávky (data volitelná). */
  function kodujTrasu(zast) {
    return zast.map(z => [z.kod, (z.od || '').replace(/-/g, ''), (z.do || '').replace(/-/g, '')].join('.').replace(/\.+$/, '')).join(',');
  }
  function dekodujTrasu(text, zname) {
    const datum = s => /^\d{8}$/.test(s || '') ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : '';
    const videno = new Set();
    return String(text || '').split(',').map(c => {
      const [kod, od, doo] = c.trim().split('.');
      return { kod: (kod || '').toUpperCase(), od: datum(od), do: datum(doo) };
    }).filter(z => (!zname || zname(z.kod)) && !videno.has(z.kod) && videno.add(z.kod));
  }

  /** Východ a západ slunce (rovnice východu slunce, přesnost ~1–2 min). den 'RRRR-MM-DD', délka na východ kladná.
      Vrací Date v UTC; polární den/noc → stav 'den'/'noc' a vychod/zapad null. */
  function slunce(sirka, delka, den) {
    const R = Math.PI / 180, [y, m, d] = den.split('-').map(Number);
    const n = Math.round(Date.UTC(y, m - 1, d, 12) / 864e5 + 2440587.5 - 2451545 + 0.0008);
    const Jh = n - delka / 360;
    const M = (357.5291 + 0.98560028 * Jh) % 360;
    const C = 1.9148 * Math.sin(M * R) + 0.02 * Math.sin(2 * M * R) + 0.0003 * Math.sin(3 * M * R);
    const lam = (M + C + 282.9372) % 360;
    const Jt = 2451545 + Jh + 0.0053 * Math.sin(M * R) - 0.0069 * Math.sin(2 * lam * R);
    const dekl = Math.asin(Math.sin(lam * R) * Math.sin(23.4397 * R));
    const cosW = (Math.sin(-0.833 * R) - Math.sin(sirka * R) * Math.sin(dekl)) / (Math.cos(sirka * R) * Math.cos(dekl));
    const naDate = J => new Date((J - 2440587.5) * 864e5);
    if (cosW < -1) return { stav: 'den', vychod: null, zapad: null, poledne: naDate(Jt), delka: 1440 };
    if (cosW > 1) return { stav: 'noc', vychod: null, zapad: null, poledne: naDate(Jt), delka: 0 };
    const w = Math.acos(cosW) / R / 360;
    return { stav: '', vychod: naDate(Jt - w), zapad: naDate(Jt + w), poledne: naDate(Jt), delka: Math.round(w * 2 * 1440) };
  }

  const api = {
    OBLASTI, SPROPITNE, VODA, NEJISTE, EHP, PASUJE, TYPY, POPIS_TYPU, JEDNOTKY,
    rozeberRadek, nactiZeme, adapter, napeti, posunUtc, rozdilCasu, formatRozdil,
    norm, hledej, vEhp, placeneSilnice, kontrolniSeznam,
    sadaAdapteru, kontrolniSeznamTrasy, mistniNaUtc, mistniCas, jednotky, prevedMenu,
    kontrolaZastavek, novaZastavka, navazOdjezd, presun, kodujTrasu, dekodujTrasu, dnyMezi, pridejDny, slunce,
    OCKOVANI, VYBAVA, VSTUP, ockovaniZeme, pasNutny, dnyCesty, zmenyCasu, jetlag, rozpocet
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.ZVK = api;
})();
