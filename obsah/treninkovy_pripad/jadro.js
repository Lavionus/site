/* Tréninkový případ – jádro: index výroků, vyhodnocení rozporů, nápovědy,
   bodování, kontrola konzistence dat a tabulka výsledků.
   Bez DOM – testuje se v node (_test/treninkovy_pripad_test.js). */
(function (koren) {
  'use strict';

  const TYPY = {
    oznameni: { nazev: 'Oznámení', ikona: '📞', druh: 't' },
    zaznam: { nazev: 'Úřední záznam', ikona: '📝', druh: 'o' },
    ohledani: { nazev: 'Protokol o ohledání', ikona: '🔍', druh: 'o' },
    stopy: { nazev: 'Seznam stop', ikona: '🗃️', druh: 'o' },
    foto: { nazev: 'Fotodokumentace', ikona: '📷', druh: 'o' },
    kamera: { nazev: 'Záznam z kamery', ikona: '🎥', druh: 'o' },
    vypoved: { nazev: 'Výpověď', ikona: '🗣️', druh: 't' },
    hovory: { nazev: 'Výpis hovorů', ikona: '📱', druh: 'o' },
    poloha: { nazev: 'Polohová data', ikona: '📍', druh: 'o' },
    uctenka: { nazev: 'Účtenka / doklad', ikona: '🧾', druh: 'o' },
    data: { nazev: 'Technický výpis', ikona: '💾', druh: 'o' },
    ucetni: { nazev: 'Účetní doklady', ikona: '📒', druh: 'o' }
  };
  const SVG = ['zamek', 'stojan', 'kleste', 'okno', 'slapota', 'pneu', 'trezor', 'rukavice', 'regal'];

  /* bodování */
  const BODY = {
    rozpor: 10,          // nalezený rozpor
    falesny: -4,         // dvojice, která si neodporuje
    zdanlivy: -2,        // zdánlivý rozpor (má vysvětlení) – menší chyba
    napoveda: [1, 2, 4], // cena 1., 2. a 3. stupně nápovědy
    trideniMax: 10, trideniMin: -5,
    otazka: 5, dukazMax: 2, dukazMin: -2,
    casMax: 10
  };

  const OBECNE_POUCENI = [
    'Tunelové vidění: jakmile si vybereš podezřelého, začneš přehlížet, co se nehodí. Vždy si polož otázku „co by muselo platit, kdyby to byl někdo jiný?“.',
    'Konfirmační zkreslení: hledej i údaje, které tvou verzi VYVRACEJÍ. Jeden silný protipříklad váží víc než pět potvrzení.',
    'Ověřené × tvrzení: co někdo říká, je tvrzení, dokud ho nepotvrdí nezávislý zdroj (záznam, měření, doklad).',
    'Nezávislost zdrojů: dva kamarádi, kteří říkají totéž, nejsou dva nezávislé zdroje. Výpis operátora a účtenka z obchodu ano.',
    'Časová razítka mají přesnost a mohou být posunutá. Než je porovnáš, zjisti, z jakých hodin pocházejí.',
    'Ke každé stopě hledej alternativní vysvětlení. Teprve když žádné neobstojí, je stopa silná.'
  ];

  const HODNOCENI = [
    [85, '🏅 Výborně – uvažuješ jako vyšetřovatel'],
    [65, '👍 Dobře – pár věcí ti uteklo'],
    [40, '🔎 Slušný začátek – projdi si rozbor'],
    [0, '📚 Ještě trénuj – rozbor ukáže, kde hledat']
  ];

  /* ---------- index výroků ---------- */
  function index(p) {
    if (p._v) return p._v;
    const m = new Map();
    for (const d of p.dokumenty) {
      const vychozi = (TYPY[d.typ] || {}).druh || 'o';
      const pridej = (v, radek) => {
        const [id, obsah, druh, svg] = v;
        const text = radek ? obsah.join(' · ') : obsah;
        m.set(id, { id, text, bunky: radek ? obsah : null, druh: druh || vychozi, svg: radek ? null : (svg || null), doc: d.id, dokument: d });
      };
      (d.text || []).forEach(odst => odst.forEach(v => pridej(v, false)));
      if (d.tabulka) d.tabulka.radky.forEach(r => pridej(r, true));
      (d.pozn || []).forEach(v => pridej(v, false));
    }
    Object.defineProperty(p, '_v', { value: m, enumerable: false });
    return m;
  }
  const vyrok = (p, id) => index(p).get(id) || null;
  const dokument = (p, id) => p.dokumenty.find(d => d.id === id) || null;
  const klicParu = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

  /* ---------- vyhodnocení dvojice ---------- */
  function vyhodnotPar(p, a, b) {
    const k = klicParu(a, b);
    for (const r of p.rozpory) if (r.pary.some(([x, y]) => klicParu(x, y) === k)) return { typ: 'rozpor', id: r.id };
    for (const z of p.zdanlive || []) if (z.pary.some(([x, y]) => klicParu(x, y) === k)) return { typ: 'zdanlivy', vysvetleni: z.vysvetleni };
    return { typ: 'falesny' };
  }

  /* které rozpory hráč už označil (pro nápovědy) */
  function nalezene(p, hra) {
    const s = new Set();
    for (const [a, b] of hra.rozpory || []) {
      const v = vyhodnotPar(p, a, b);
      if (v.typ === 'rozpor') s.add(v.id);
    }
    return s;
  }

  /* ---------- nápověda po stupních ---------- */
  function dalsiNapoveda(p, hra) {
    const najite = nalezene(p, hra), stupne = hra.napovedy || {};
    const r = p.rozpory.find(x => !najite.has(x.id) && (stupne[x.id] || 0) < 3);
    if (!r) return null;
    const stupen = (stupne[r.id] || 0) + 1;
    return { rozpor: r.id, stupen, cena: BODY.napoveda[stupen - 1], ...textNapovedy(p, r, stupen) };
  }
  function textNapovedy(p, r, stupen) {
    const [a, b] = r.pary[0];
    const va = vyrok(p, a), vb = vyrok(p, b);
    if (stupen === 1) return { text: r.napoveda, vyrok: null };
    if (stupen === 2) {
      const da = va.dokument.nazev, db = vb.dokument.nazev;
      return { text: da === db ? `Hledej uvnitř dokumentu „${da}“.` : `Porovnej dokumenty „${da}“ a „${db}“.`, vyrok: null };
    }
    return { text: `Jedna strana rozporu: „${va.text}“ (${va.dokument.nazev}). Najdi, co jí odporuje.`, vyrok: a };
  }

  /* ---------- hodnocení ---------- */
  function hodnot(p, hra, casMs) {
    const nalez = new Map(), falesne = [];
    let duplicitni = 0;
    for (const [a, b] of hra.rozpory || []) {
      const v = vyhodnotPar(p, a, b);
      if (v.typ === 'rozpor') {
        if (nalez.has(v.id)) duplicitni++; else nalez.set(v.id, [a, b]);
      } else falesne.push({ par: [a, b], typ: v.typ, vysvetleni: v.typ === 'zdanlivy' ? v.vysvetleni : 'Tyto dva údaje si neodporují – mohou platit současně.' });
    }
    const stupne = hra.napovedy || {};
    const rozpory = p.rozpory.map(r => ({ id: r.id, nazev: r.nazev, vysvetleni: r.vysvetleni, nalezen: nalez.has(r.id), par: nalez.get(r.id) || r.pary[0], napoveda: stupne[r.id] || 0 }));

    // třídění ověřené × tvrzení
    let spravne = 0, spatne = 0;
    const chyby = [];
    for (const [id, druh] of Object.entries(hra.trideni || {})) {
      const v = vyrok(p, id);
      if (!v) continue;
      if (v.druh === druh) spravne++; else { spatne++; chyby.push(id); }
    }
    const bTrideni = Math.max(BODY.trideniMin, Math.min(BODY.trideniMax, spravne - spatne));

    // závěr
    const zaver = p.zaver.map(q => {
      const o = (hra.zaver || {})[q.id] || {};
      const ok = o.odp === q.spravne;
      const dk = (o.dukazy || []).filter(id => vyrok(p, id));
      const dOk = dk.filter(id => q.dukazy.includes(id)), dKl = dk.filter(id => (q.klamne || []).includes(id));
      let bDukazy = Math.min(BODY.dukazMax, dOk.length) - dKl.length;
      bDukazy = Math.max(BODY.dukazMin, ok ? bDukazy : Math.min(0, bDukazy));
      return { id: q.id, otazka: q.otazka, odp: o.odp || null, spravne: q.spravne, ok, dukazy: dk, dukazyOk: dOk, dukazyKlamne: dKl, body: (ok ? BODY.otazka : 0) + bDukazy, vysvetleni: q.vysvetleni };
    });

    const limit = (p.limitMin || 20) * 60000;
    const cas = Math.max(0, casMs || 0);
    const casBonus = Math.round(BODY.casMax * Math.max(0, 1 - cas / limit));
    const napovedy = Object.values(stupne).reduce((s, n) => s + BODY.napoveda.slice(0, n).reduce((x, y) => x + y, 0), 0);
    const slozky = {
      rozpory: nalez.size * BODY.rozpor,
      falesne: falesne.filter(f => f.typ === 'falesny').length * BODY.falesny,
      zdanlive: falesne.filter(f => f.typ === 'zdanlivy').length * BODY.zdanlivy,
      napovedy: -napovedy,
      trideni: bTrideni,
      zaver: zaver.reduce((s, q) => s + q.body, 0),
      cas: casBonus
    };
    const max = p.rozpory.length * BODY.rozpor + BODY.trideniMax + p.zaver.length * (BODY.otazka + BODY.dukazMax) + BODY.casMax;
    const body = Math.max(0, Object.values(slozky).reduce((s, x) => s + x, 0));
    const procenta = Math.round(100 * body / max);
    return {
      rozpory, falesne, duplicitni, trideni: { spravne, spatne, chyby, body: bTrideni }, zaver,
      casMs: cas, casBonus, slozky, body, max, procenta,
      hodnoceni: HODNOCENI.find(([hr]) => procenta >= hr)[1]
    };
  }

  /* ---------- tabulka výsledků (úložiště předané zvenku: localStorage nebo náhrada) ---------- */
  const KLIC_VYSLEDKY = 'webapp_treninkovy_pripad_vysledky';
  const MAX_VYSLEDKU = 300;
  function serad(seznam) {
    return seznam.slice().sort((a, b) => (!!a.lektor - !!b.lektor) || (b.procenta - a.procenta) || (b.body - a.body) || (a.casMs - b.casMs));
  }
  /* záznamy z úložiště mohou být poškozené nebo podvržené → jen platné objekty, čísla jako čísla, text jako text */
  const cislo = v => (Number.isFinite(+v) ? +v : 0);
  function nactiVysledky(ul) {
    let s;
    try { s = JSON.parse(ul.getItem(KLIC_VYSLEDKY) || '[]'); } catch (e) { return []; }
    if (!Array.isArray(s)) return [];
    return s.filter(z => z && typeof z === 'object' && typeof z.pripad === 'string').map(z => ({
      jmeno: String(z.jmeno == null ? 'Anonym' : z.jmeno).slice(0, 40), pripad: z.pripad,
      body: cislo(z.body), max: cislo(z.max), procenta: cislo(z.procenta), casMs: Math.max(0, cislo(z.casMs)),
      datum: typeof z.datum === 'string' ? z.datum : '', lektor: !!z.lektor
    }));
  }
  function ulozVysledek(ul, z) {
    const s = nactiVysledky(ul);
    const zaznam = {
      jmeno: String(z.jmeno || 'Anonym').trim().slice(0, 40) || 'Anonym', pripad: z.pripad,
      body: z.body, max: z.max, procenta: z.procenta, casMs: Math.round(z.casMs || 0),
      datum: z.datum || new Date().toISOString(), lektor: !!z.lektor
    };
    s.push(zaznam);
    // při přeplnění zahodit nejstarší
    s.sort((a, b) => a.datum < b.datum ? -1 : 1);
    while (s.length > MAX_VYSLEDKU) s.shift();
    ul.setItem(KLIC_VYSLEDKY, JSON.stringify(s));
    return zaznam;
  }
  function smazVysledky(ul) { ul.removeItem(KLIC_VYSLEDKY); }
  function poradi(seznam, zaznam) {
    const s = serad(seznam.filter(x => x.pripad === zaznam.pripad));
    return s.findIndex(x => x.datum === zaznam.datum && x.jmeno === zaznam.jmeno) + 1;
  }

  function formatCas(ms) {
    const s = Math.max(0, Math.floor((ms || 0) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
  }

  /* ---------- kontrola konzistence dat ---------- */
  const RX_CAS = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
  const RX_DATUM = /(\d{1,2})\.\s(\d{1,2})\.(?:\s(\d{4}))?/g;
  function platneDatum(d, m, r) {
    const x = new Date(r, m - 1, d);
    return x.getFullYear() === r && x.getMonth() === m - 1 && x.getDate() === d;
  }
  /* "13. 11. 21:16" | "14:31:50" → minuty od začátku roku (pro řazení) */
  function casBunky(s, rok) {
    const m = /^(?:(\d{1,2})\. (\d{1,2})\. )?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(s).trim());
    if (!m) return null;
    const den = m[1] ? Date.UTC(rok, +m[2] - 1, +m[1]) / 60000 : 0;
    return den + (+m[3]) * 60 + (+m[4]) + (m[5] ? +m[5] / 60 : 0);
  }
  function retezce(o, out = []) {
    if (typeof o === 'string') out.push(o);
    else if (Array.isArray(o)) o.forEach(x => retezce(x, out));
    else if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (k[0] !== '_') retezce(o[k], out); });
    return out;
  }
  function kontrola(p) {
    const ch = [];
    const e = t => ch.push(`[${p.id}] ${t}`);
    if (!p.id || !p.nazev || !p.uvod) e('chybí id, název nebo úvod');
    if (![1, 2, 3].includes(p.obtiznost)) e('obtížnost musí být 1–3');
    if (!(p.dokumenty.length >= 8 && p.dokumenty.length <= 15)) e(`dokumentů je ${p.dokumenty.length} (má být 8–15)`);
    if (!(p.rozpory.length >= 4 && p.rozpory.length <= 8)) e(`rozporů je ${p.rozpory.length} (má být 4–8)`);
    // jedinečná ID dokumentů a výroků
    const idDok = new Set(), idV = new Set();
    for (const d of p.dokumenty) {
      if (idDok.has(d.id)) e(`duplicitní dokument ${d.id}`); idDok.add(d.id);
      if (!TYPY[d.typ]) e(`${d.id}: neznámý typ ${d.typ}`);
      if (!d.nazev) e(`${d.id}: chybí název`);
      const vs = [].concat(...(d.text || []), d.tabulka ? d.tabulka.radky : [], d.pozn || []);
      if (!vs.length) e(`${d.id}: dokument bez výroků`);
      for (const v of vs) {
        if (idV.has(v[0])) e(`duplicitní výrok ${v[0]}`); idV.add(v[0]);
        if (v[2] && !['o', 't'].includes(v[2])) e(`${v[0]}: druh musí být o/t`);
        if (v[3] && !SVG.includes(v[3])) e(`${v[0]}: neznámá ilustrace ${v[3]}`);
        if (d.tabulka && d.tabulka.radky.includes(v) && v[1].length !== d.tabulka.sloupce.length) e(`${v[0]}: počet buněk neodpovídá sloupcům`);
        if (!(d.tabulka && d.tabulka.radky.includes(v)) && !(typeof v[1] === 'string' && v[1].length > 5)) e(`${v[0]}: prázdný text`);
      }
      // časový sloupec musí být platný a vzestupný
      if (d.tabulka && d.tabulka.cas != null) {
        let pred = -Infinity;
        for (const r of d.tabulka.radky) {
          const t = casBunky(r[1][d.tabulka.cas], p.rok);
          if (t == null) { e(`${r[0]}: neplatný čas „${r[1][d.tabulka.cas]}“`); continue; }
          if (t < pred) e(`${r[0]}: čas není vzestupně`);
          pred = t;
        }
      }
    }
    index(p);
    const existuje = id => idV.has(id);
    // rozpory a zdánlivé rozpory
    const pouzite = new Map();
    const hlidejPar = (a, b, kde) => {
      if (!existuje(a)) e(`${kde}: neexistující výrok ${a}`);
      if (!existuje(b)) e(`${kde}: neexistující výrok ${b}`);
      if (a === b) e(`${kde}: dvojice ze stejného výroku ${a}`);
      const k = klicParu(a, b);
      if (pouzite.has(k)) e(`${kde}: dvojice ${k} už je v ${pouzite.get(k)}`);
      pouzite.set(k, kde);
    };
    const idR = new Set();
    for (const r of p.rozpory) {
      if (idR.has(r.id)) e(`duplicitní rozpor ${r.id}`); idR.add(r.id);
      if (!r.nazev) e(`${r.id}: chybí název`);
      if (!r.napoveda || r.napoveda.length < 15) e(`${r.id}: chybí nápověda`);
      if (!r.vysvetleni || r.vysvetleni.length < 60) e(`${r.id}: chybí nebo je krátké vysvětlení`);
      if (!r.pary || !r.pary.length) e(`${r.id}: bez dvojic`);
      (r.pary || []).forEach(([a, b]) => hlidejPar(a, b, r.id));
    }
    (p.zdanlive || []).forEach((z, i) => {
      if (!z.vysvetleni || z.vysvetleni.length < 40) e(`zdánlivý ${i}: chybí vysvětlení`);
      z.pary.forEach(([a, b]) => hlidejPar(a, b, 'zdánlivý ' + i));
    });
    // závěr
    if (!p.zaver || p.zaver.length < 3) e('závěr má mít aspoň 3 otázky');
    const idQ = new Set();
    for (const q of p.zaver || []) {
      if (idQ.has(q.id)) e(`duplicitní otázka ${q.id}`); idQ.add(q.id);
      const ids = q.moznosti.map(m => m[0]);
      if (new Set(ids).size !== ids.length) e(`${q.id}: duplicitní možnosti`);
      if (!ids.includes(q.spravne)) e(`${q.id}: správná odpověď ${q.spravne} není mezi možnostmi`);
      if (q.moznosti.length < 3) e(`${q.id}: málo možností`);
      if (!q.dukazy || q.dukazy.length < 2) e(`${q.id}: málo důkazů`);
      (q.dukazy || []).concat(q.klamne || []).forEach(id => { if (!existuje(id)) e(`${q.id}: neexistující výrok ${id}`); });
      (q.klamne || []).forEach(id => { if (q.dukazy.includes(id)) e(`${q.id}: ${id} je zároveň důkaz i klamný`); });
      if (!q.vysvetleni || q.vysvetleni.length < 40) e(`${q.id}: chybí vysvětlení`);
    }
    if (!p.pouceni || p.pouceni.length < 2) e('chybí poučení');
    // časy a data ve všech textech
    for (const s of retezce(p)) {
      for (const m of s.matchAll(RX_CAS)) {
        if (+m[1] > 23 || +m[2] > 59 || (m[3] && +m[3] > 59)) e(`neplatný čas „${m[0]}“ v „${s.slice(0, 50)}“`);
      }
      for (const m of s.matchAll(RX_DATUM)) {
        if (!platneDatum(+m[1], +m[2], m[3] ? +m[3] : p.rok)) e(`neplatné datum „${m[0]}“ v „${s.slice(0, 50)}“`);
      }
    }
    return ch;
  }

  const API = {
    TYPY, SVG, BODY, OBECNE_POUCENI, KLIC_VYSLEDKY,
    index, vyrok, dokument, klicParu, vyhodnotPar, nalezene, dalsiNapoveda, textNapovedy, hodnot,
    nactiVysledky, ulozVysledek, smazVysledky, serad, poradi, formatCas, casBunky, kontrola
  };
  koren.TPJADRO = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
