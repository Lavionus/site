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

  /** Kontrolní seznam před cestou z domova (a) do cíle (b): [{id, text, dulezite, detail}]. */
  function kontrolniSeznam(a, b, opt) {
    opt = opt || {};
    const s = [];
    const pridej = (id, text, dulezite, detail) => s.push({ id, text, dulezite: !!dulezite, detail: detail || '' });
    pridej('doklad', volnyPohyb(b.kod) && volnyPohyb(a.kod) ? 'Platný občanský průkaz nebo pas' : 'Platný cestovní pas (často 6 měsíců po návratu) a víza podle cestovních doporučení MZV', true);
    pridej('pojisteni', volnyPohyb(b.kod) ? 'Cestovní pojištění léčebných výloh + evropský průkaz zdravotního pojištění (EHIC)' : 'Cestovní pojištění léčebných výloh', true);
    if (!vEhp(b.kod)) pridej('drozd', 'Registrace v systému DROZD (MZV)');
    if (!vEhp(b.kod)) pridej('ockovani', 'Očkování a léky – konzultace v centru cestovní medicíny');
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

  const api = {
    OBLASTI, SPROPITNE, VODA, NEJISTE, EHP, PASUJE, TYPY, POPIS_TYPU,
    rozeberRadek, nactiZeme, adapter, napeti, posunUtc, rozdilCasu, formatRozdil,
    norm, hledej, vEhp, placeneSilnice, kontrolniSeznam
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.ZVK = api;
})();
