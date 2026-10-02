/* ============================================================
   Srdce hory – ulozeni.js: uložení a obnova hry.

   Hora se po načtení vygeneruje znovu ze seedu a přepíšou se jen
   pole, která se hrou mění (terén, rudy, objekty, znalost, stavby…).
   Pole se ukládají jako RLE (hodnota, délka běhu) v base64 – většina
   hory jsou dlouhé běhy stejných hodnot, uložená hra má desítky kB.
   Čistá logika bez DOM (base64 přes btoa/atob, v node přes Buffer).
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  // 10: stupně práce 1–3 v povoleno, nouze; 11: věci po sloupcích, tok zásob; 12: výtah (lez 3), studna (K.STUDNA,
  // stavbaStav 1/2), poplach 2, šířka hory, otesaný líc (pole tesano), počty padlých podle příčiny, prostředí klanu
  const VERZE = 12;
  const CTE = [9, 10, 11, 12];                    // verze, které se ještě dají načíst (starší se převedou)
  const POLE = ['teren', 'ruda', 'obj', 'pozadi'];              // v hra.hora (pozadi: otesané stěny; starší uložení ho nemají)
  const POLE_HRY = ['znamo', 'lez', 'oznac', 'stavba', 'zona', 'uroda', 'vykopane', 'zavreno', 'stavbaStav', 'prio', 'tesano'];  // v hra
  const NOVA_POLE = ['tesano'];                   // starší uložení je nemají (zůstanou nulová)

  const naB64 = u8 => typeof btoa === 'function'
    ? btoa(Array.from(u8, c => String.fromCharCode(c)).join('')) : Buffer.from(u8).toString('base64');
  const zB64 = s => typeof atob === 'function'
    ? Uint8Array.from(atob(s), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(s, 'base64'));

  function rle(a) {
    const out = [];
    for (let i = 0; i < a.length;) {
      const v = a[i]; let n = 1;
      while (i + n < a.length && a[i + n] === v && n < 255) n++;
      out.push(v, n); i += n;
    }
    return naB64(Uint8Array.from(out));
  }
  function zRle(s, delka) {
    const b = zB64(s), a = new Uint8Array(delka);
    let k = 0;
    for (let j = 0; j < b.length; j += 2) { a.fill(b[j], k, k + b[j + 1]); k += b[j + 1]; }
    if (k !== delka) throw new Error('poškozená data pole');
    return a;
  }

  // klíče stavu hry, které se ukládají tak, jak jsou (JSON); _tok = tok zásob pro bilanci a nouzi,
  // deskaBlok/tesatBlok = krátké blokace hledání (bez nich by se načtená hra chovala jinak než nepřerušená)
  const KLICE = ['tik', 'dalsiId', 'rng', 'vykopano', 'nejhloubeji', 'nalezeno', 'objeveno', 'denik', 'svetloZmena',
                 'zony', 'plany', 'dilny', 'parezy', 'trpaslici', 'slava', 'slavaBonus', 'karavana', 'udalost', 'posledniDar',
                 'praskani', 'prameny', 'stabilitaZmena', 'stabilitaKlid', 'vodaKlid', 'klidKroku', 'odteklo', 'odcerpano', 'varovaniStrop', 'cyklus', 'tvorove', 'dalsiNajezd', 'pastiNapnout', 'zabito', 'najezdu',
                 'rezim', 'prectene', 'deskyPrectene', 'odemceno', 'artefakty', 'spac', 'zazehnuti', 'vyhenHori', 'konec', 'maxTrp', 'padlo', 'nouze',
                 '_tok', 'deskaBlok', 'tesatBlok', 'poplach', '_cas',   // poplach: vyhlášený hráčem; _cas: čím klan tráví čas (TRP.hra.casKlanu)
                 'padloPodle', 'prostrediStav'];   // padlí podle příčiny; prostředí klanu (počítá se jednou za 60 tahů, viz potreby.prostredi)
  // klíče, které se ukládají zvlášť (pole jako RLE, mapy jako dvojice, věci po sloupcích) – pro test úplnosti uložení
  const ZVLAST = ['seed', 'hora', 'veci', 'rez', 'materialNa', 'planNa'].concat(POLE_HRY);

  // Věci po sloupcích (verze 11): { k: [klíče], s: [sloupce] }. Číselný sloupec = čísla (id jako rozdíly od
  // předchozího), jinak slovník hodnot + indexy. Chybějící klíč = null. Pořadí i id zůstanou přesně stejné.
  function veciNaSloupce(veci) {
    const klice = [];
    for (const v of veci) for (const k of Object.keys(v)) if (!klice.includes(k)) klice.push(k);
    const s = klice.map(k => {
      const hod = veci.map(v => k in v ? v[k] : null);
      if (hod.every(x => x === null || typeof x === 'number')) {
        if (k !== 'id') return hod;
        let pred = 0; return { r: hod.map(x => { const r = x - pred; pred = x; return r; }) };
      }
      const slovnik = [], idx = new Map();
      const ix = hod.map(x => { const kl = JSON.stringify(x); if (!idx.has(kl)) { idx.set(kl, slovnik.length); slovnik.push(x); } return idx.get(kl); });
      return { d: slovnik, i: ix };
    });
    return { k: klice, s };
  }
  function veciZeSloupcu(o) {
    if (Array.isArray(o)) return o;                         // starší uložení: pole objektů
    if (!o || !Array.isArray(o.k) || !Array.isArray(o.s) || o.k.length !== o.s.length) throw new Error('poškozený seznam věcí');
    const sl = o.s.map(c => {
      if (Array.isArray(c)) return c;
      if (c && Array.isArray(c.r)) { let pred = 0; return c.r.map(r => (pred += r)); }
      if (c && Array.isArray(c.d) && Array.isArray(c.i)) return c.i.map(j => c.d[j]);
      throw new Error('poškozený seznam věcí');
    });
    const n = sl.length ? sl[0].length : 0;
    if (sl.some(c => c.length !== n)) throw new Error('poškozený seznam věcí');
    const veci = [];
    for (let j = 0; j < n; j++) {
      const v = {};
      o.k.forEach((k, m) => { if (sl[m][j] !== null) v[k] = sl[m][j]; });
      veci.push(v);
    }
    return veci;
  }

  function serializuj(hra) {
    const d = { hra: 'srdce-hory', verze: VERZE, seed: hra.seed, sirka: T.hora.W, pole: {} };
    for (const k of POLE) d.pole[k] = rle(hra.hora[k]);
    for (const k of POLE_HRY) d.pole[k] = rle(hra[k]);
    for (const k of KLICE) d[k] = hra[k];
    d.veci = veciNaSloupce(hra.veci);
    d.rez = [...hra.rez];
    d.materialNa = [...hra.materialNa];
    return JSON.stringify(d);
  }
  // kontrola struktury načtených dat – raději srozumitelná chyba hned než pád uprostřed hry
  function over(podm, co) { if (!podm) throw new Error(`uložená hra je poškozená (${co}), nedá se načíst`); }
  function overStav(hra, N) {
    const cislo = x => typeof x === 'number' && Number.isFinite(x);
    const pole = x => x >= 0 && x < N && Number.isInteger(x);
    for (const k of ['tik', 'dalsiId', 'rng']) over(cislo(hra[k]), k);
    for (const k of ['zony', 'plany', 'dilny', 'parezy', 'trpaslici', 'veci', 'denik', 'praskani', 'prameny', 'tvorove', 'pastiNapnout', 'prectene', 'deskyPrectene'])
      over(hra[k] === undefined || Array.isArray(hra[k]), k);
    for (const t of hra.trpaslici) over(t && typeof t === 'object' && pole(t.i) && t.povoleno && typeof t.povoleno === 'object' &&
      Array.isArray(t.vzpominky) && Array.isArray(t.cesta) && cislo(t.id) && t.dov && typeof t.dov === 'object', 'trpaslík');
    for (const v of hra.veci) over(v && cislo(v.id) && typeof v.druh === 'string' && pole(v.i), 'věc');
    for (const p of hra.plany) over(p && T.stavby.STAVBY[p.typ] && pole(p.i) && p.doneseno && p.vCeste, 'plán stavby');
    for (const d of hra.dilny) over(d && T.stavby.STAVBY[d.typ] && pole(d.i) && Array.isArray(d.fronta), 'dílna');
    for (const z of hra.zony) over(z && cislo(z.id) && T.stavby.ZONY[z.typ], 'zóna');
    for (const u of hra.tvorove || []) over(u && pole(u.i), 'tvor');
  }
  function obnov(text) {
    let d;
    try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { throw new Error('uložená hra je poškozená (neplatný JSON), nedá se načíst'); }
    if (!d || d.hra !== 'srdce-hory') throw new Error('to není uložená hra Srdce hory');
    if (d.verze > VERZE) throw new Error(`uložená hra je z novější verze (${d.verze}), nedá se načíst – obnov stránku`);
    if (!CTE.includes(d.verze)) throw new Error(`uložená hra je ze starší verze (${d.verze}), nedá se načíst`);
    over(typeof d.seed === 'number', 'seed');
    over(d.pole && typeof d.pole === 'object' && POLE_HRY.every(k => typeof d.pole[k] === 'string' || (NOVA_POLE.includes(k) && d.verze < 12)), 'mapa');
    for (const k of ['tik', 'dalsiId', 'rng', 'trpaslici', 'veci', 'zony', 'plany', 'dilny', 'rez']) over(k in d, k);
    // jiná velikost mapy: stránka se musí načíst znovu s tou velikostí (UI to udělá podle e.sirka)
    if ((d.sirka || 96) !== T.hora.W) { const e = new Error(`uložená hora má jinou velikost (šířka ${d.sirka || 96})`); e.sirka = d.sirka || 96; throw e; }
    const hra = T.hra.novaHra(d.seed);
    const N = hra.hora.teren.length;
    try {
      for (const k of POLE) if (d.pole[k]) hra.hora[k] = zRle(d.pole[k], N);
      for (const k of POLE_HRY) if (d.pole[k]) hra[k] = zRle(d.pole[k], N);
    } catch (e) { throw new Error('uložená hra je poškozená (mapa), nedá se načíst'); }
    for (const k of KLICE) if (k in d) hra[k] = d[k];
    hra.veci = veciZeSloupcu(d.veci);
    hra.nouze = d.nouze || {};
    hra.poplach = d.poplach === 2 ? 2 : !!d.poplach;                       // starší uložení poplach nemají
    if (!hra.padloPodle || typeof hra.padloPodle !== 'object') hra.padloPodle = {};
    overStav(hra, N);
    over(Array.isArray(d.rez) && Array.isArray(d.materialNa || []), 'rezervace');
    if (d.verze === 9) for (const t of hra.trpaslici) {   // verze 9: povoleno 0/1 → stupně (hlavní práce 1, ostatní 2)
      const hl = T.hra.HLAVNI_PRACE[t.prof] || [];
      for (const k of Object.keys(t.povoleno)) if (t.povoleno[k] === 1 && !hl.includes(k) && !['hlidat', 'nosit', 'pole'].includes(k)) t.povoleno[k] = 2;
    }
    hra.rez = new Map(d.rez);
    hra.materialNa = new Map(d.materialNa || []);
    hra.planNa = new Map();
    for (const p of hra.plany) for (const j of T.stavby.bunkyPlanu(p.typ, p.i)) hra.planNa.set(j, p.id);
    if (!d.prostrediStav) T.potreby.obnovProstredi(hra);      // starší uložení: spočítat z načteného stavu
    return hra;
  }

  T.ulozeni = { VERZE, KLICE, ZVLAST, serializuj, obnov };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
