/* ============================================================
   nutricni_recept/jadro.js – čistá logika stránky Nutriční hodnoty receptu (bez DOM).
   Rozbor textu, párování a databázi přebírá z jádra Deníku jídla (potraviny/jadro.js,
   DENIK_JADRO) – tady jsou jen jednotky, přepočty na gramy, součty, zaokrouhlení
   podle nařízení EU 1169/2011 a uložené recepty.
   V prohlížeči window.NUTREC (po potraviny/jadro.js), v node module.exports
   (test _test/nutricni_recept_test.js).
   ============================================================ */
(function (koren, D) {
  'use strict';
  if (!D) throw new Error('Chybí jádro Deníku jídla (potraviny/jadro.js)');

  const KLIC = 'webapp_nutricni_recept';
  const VERZE = 1;

  /* ---------- jednotky ----------
     hm = gramy na jednotku, obj = mililitry na jednotku (české míry: lžíce 15 ml, lžička 5 ml, hrnek 250 ml) */
  const JEDNOTKY = {
    g: { n: 'g', hm: 1 }, dkg: { n: 'dkg', hm: 10 }, kg: { n: 'kg', hm: 1000 },
    ml: { n: 'ml', obj: 1 }, dl: { n: 'dl', obj: 100 }, l: { n: 'l', obj: 1000 },
    lzicka: { n: 'lžička', obj: 5 }, lzice: { n: 'lžíce', obj: 15 }, hrnek: { n: 'hrnek', obj: 250 },
    spetka: { n: 'špetka' }, ks: { n: 'kus / balení' },
  };
  const SPETKA_G = 0.5;   // bez porce „špetka“ v databázi (stejně jako Deník jídla)
  // hustota tekutin, které Deník vede na 100 ml (stejné hodnoty jako HUSTOTA v potraviny/jadro.js)
  const HUSTOTA = { mleko: 1.03, dzus: 1.04, pivo: 1.01, vino: 0.99, destilat: 0.95 };
  function hustota(f) { return f && f.ml ? (HUSTOTA[D.druhNapoje(f)] || 1) : 1; }

  // řádek z D.rozeberSuroviny → { mn, j, gKus } (gKus = gramy na kus u hrsti, plátku, stroužku…)
  function jednotkaZRozboru(r) {
    if (r.mnozstvi === null || r.mnozstvi === undefined) {
      if (/^(špet|štipk)/i.test(r.radek || '')) return { mn: 1, j: 'spetka', gKus: null };   // „špetka soli“
      return { mn: null, j: 'g', gKus: null };
    }
    const mn = r.mnozstvi;
    const dr = { 'lžíce': 'lzice', 'lžička': 'lzicka', hrnek: 'hrnek', 'špetka': 'spetka' }[r.druh];
    if (dr) return { mn, j: dr, gKus: null };
    if (r.druh) return { mn, j: 'ks', gKus: r.g !== null && r.g !== undefined && mn > 0 ? r.g / mn : null };
    const t = D.norm(r.jednotka || '').replace(/\.$/, '');
    if (/^(kg|kila?|kilogram)/.test(t)) return { mn, j: 'kg', gKus: null };
    if (/^(dkg|deka|dag)$/.test(t)) return { mn, j: 'dkg', gKus: null };
    if (/^mg$/.test(t)) return { mn: mn / 1000, j: 'g', gKus: null };
    if (/^(g|gr|gram)/.test(t)) return { mn, j: 'g', gKus: null };
    if (/^(ml|mililitr)/.test(t)) return { mn, j: 'ml', gKus: null };
    if (/^cl$/.test(t)) return { mn: mn * 10, j: 'ml', gKus: null };
    if (/^(dl|deci)/.test(t)) return { mn, j: 'dl', gKus: null };
    if (/^(l|litr)/.test(t)) return { mn, j: 'l', gKus: null };
    return { mn, j: 'ks', gKus: r.g !== null && r.g !== undefined && mn > 0 ? r.g / mn : null };
  }

  // gramy na 1 ml potraviny, která není vedená na ml: z porcí s objemem („hrnek (240 ml)“), lžíce, lžičky
  function gramyNaMl(f) {
    const porce = (f && f.porce) || [];
    for (const p of porce) { const m = /\((\d+(?:[.,]\d+)?) ml\)/.exec(p.n); if (m && p.g > 0) return { d: p.g / D.cislo(m[1]), zdroj: p.n }; }
    const lz = porce.find(p => /^lžíce(\s*\(|$)/.test(p.n));
    if (lz) return { d: lz.g / 15, zdroj: lz.n };
    const lc = porce.find(p => /^lžička(\s*\(|$)/.test(p.n));
    if (lc) return { d: lc.g / 5, zdroj: lc.n };
    return null;
  }

  // položka { mn, j, gKus, radek, nazev, druh, jednotka } + potravina f →
  // { m: množství v jednotce databáze (g, u tekutin ml), g: hmotnost v gramech, odhad, pozn }
  function prepocet(p, f) {
    const mn = D.cislo(p.mn);
    if (!f) return { m: null, g: null, odhad: true, pozn: 'bez potraviny' };
    if (mn === null || mn <= 0) return { m: null, g: null, odhad: true, pozn: 'chybí množství' };
    const ro = hustota(f);
    const vys = (m, odhad, pozn) => ({ m: D.zaokrouhli(m, 2), g: D.zaokrouhli(f.ml ? m * ro : m, 2), odhad: !!odhad, pozn: pozn || '' });
    const zGramu = (g, odhad, pozn) => vys(f.ml ? g / ro : g, odhad, pozn);
    const jd = JEDNOTKY[p.j];
    if (jd && jd.hm) return zGramu(mn * jd.hm);
    if (jd && jd.obj) {
      const ml = mn * jd.obj;
      if (f.ml) return vys(ml);
      // lžíce a lžičky přednostně podle naměřené porce suroviny
      const lz = p.j === 'lzice' ? (f.porce || []).find(x => /^lžíce(\s*\(|$)/.test(x.n)) : p.j === 'lzicka' ? (f.porce || []).find(x => /^lžička(\s*\(|$)/.test(x.n)) : null;
      if (lz) return vys(mn * lz.g, false, '1 ' + jd.n + ' = ' + D.formatCislo(lz.g, 1) + ' g');
      const h = gramyNaMl(f);
      if (h) return vys(ml * h.d, false, '1 ' + jd.n + ' ≈ ' + D.formatCislo(jd.obj * h.d, 1) + ' g (podle porce „' + h.zdroj + '“)');
      return vys(ml, true, 'hustotu neznám – počítám 1 ml = 1 g');
    }
    if (p.j === 'spetka') {
      const s = (f.porce || []).find(x => /^špetka/.test(x.n));
      return s ? vys(mn * s.g) : zGramu(mn * SPETKA_G, true, 'špetka ≈ ' + D.formatCislo(SPETKA_G, 1) + ' g');
    }
    const pm = /^p(\d+)$/.exec(p.j || '');
    if (pm) {
      const por = (f.porce || [])[+pm[1]];
      if (por) return vys(mn * por.g);
    }
    if (p.gKus > 0) return zGramu(mn * p.gKus);
    // kusy, balení: podle porcí potraviny (logika Deníku jídla)
    const gs = D.gramySuroviny({ radek: p.radek || p.nazev || '', nazev: p.nazev || '', mnozstvi: mn, druh: p.druh || 'kus', jednotka: p.jednotka || null, g: null }, f);
    if (gs.g === null) return { m: null, g: null, odhad: true, pozn: 'neznám hmotnost kusu – zadej gramy' };
    return vys(gs.g, gs.odhad, gs.odhad ? 'hmotnost kusu odhadnuta (100 g) – zkontroluj' : '');
  }

  // volby jednotek pro konkrétní potravinu: základní + porce z databáze
  function volbyJednotek(f) {
    const v = Object.keys(JEDNOTKY).map(k => ({ id: k, n: JEDNOTKY[k].n }));
    ((f && f.porce) || []).forEach((p, i) => v.push({ id: 'p' + i, n: p.n + ' (' + D.formatCislo(p.g, 1) + ' ' + (f.ml ? 'ml' : 'g') + ')' }));
    return v;
  }

  /* ---------- rozpoznání textu ---------- */
  // najdi(nazev) → potravina z databáze nebo null
  function rozpoznej(text, najdi) {
    // „2 vejce, ½ l mléka“ – Deník dělí na čárce jen před číslicí, zlomky ½ ¼ ¾ ⅓ ⅔ doplníme
    text = String(text || '').replace(/,(?=\s*[½¼¾⅓⅔])/g, '\n');
    return D.rozeberSuroviny(text).map(r => {
      const j = jednotkaZRozboru(r);
      return { radek: r.radek, nazev: r.nazev, druh: r.druh, jednotka: r.jednotka, mn: j.mn, j: j.j, gKus: j.gKus, f: najdi ? najdi(r.nazev) || null : null, rucne: false };
    });
  }

  /* ---------- energie a součty ---------- */
  // přepočítací faktory EU (nařízení 1169/2011, příloha XIV): tuk 37 kJ / 9 kcal, sacharidy a bílkoviny 17/4,
  // vláknina 8/2, alkohol 29/7. Když makroživiny chybí, bere se energie z databáze.
  function energieEU(n) {
    if (['tuk', 'sacharidy', 'bilkoviny'].every(k => Number.isFinite(n[k]))) {
      const v = n.vlaknina || 0, a = n.alk || 0;
      return { kj: 37 * n.tuk + 17 * n.sacharidy + 17 * n.bilkoviny + 8 * v + 29 * a, kcal: 9 * n.tuk + 4 * n.sacharidy + 4 * n.bilkoviny + 2 * v + 7 * a, zMaker: true };
    }
    if (Number.isFinite(n.kcal)) return { kj: n.kcal * 4.184, kcal: n.kcal, zMaker: false };
    return { kj: 0, kcal: 0, zMaker: false };
  }
  const ZIVINY = ['tuk', 'nasycene', 'sacharidy', 'cukry', 'vlaknina', 'bilkoviny', 'sul'];
  const NAZVY = { kcal: 'Energie', tuk: 'Tuky', nasycene: 'nasycené MK', sacharidy: 'Sacharidy', cukry: 'cukry', vlaknina: 'Vláknina', bilkoviny: 'Bílkoviny', sul: 'Sůl' };

  // polozky: [{ f, m, g, ... }] → { radky: [{ i, f, m, g, v: {kj,kcal,tuk,…} }], celkem, syrova, chybi: {k: [názvy]}, pocet }
  function soucet(polozky) {
    const celkem = { kj: 0, kcal: 0 };
    for (const k of ZIVINY) celkem[k] = 0;
    const chybi = {}, radky = [];
    let syrova = 0;
    polozky.forEach((p, i) => {
      if (!p.f || !(p.m > 0)) return;
      const n = D.zivinyZa(p.f.n || {}, p.m);
      const e = energieEU(n);
      const v = { kj: e.kj, kcal: e.kcal };
      for (const k of ZIVINY) {
        if (Number.isFinite(n[k])) v[k] = n[k];
        else (chybi[k] = chybi[k] || []).push(p.f.nazev);
      }
      if (!e.zMaker) (chybi.makra = chybi.makra || []).push(p.f.nazev);
      D.secti(celkem, v);
      syrova += p.g || 0;
      radky.push({ i, f: p.f, m: p.m, g: p.g, v });
    });
    return { radky, celkem, syrova, chybi, pocet: radky.length };
  }

  // volby: { porci, rezim: 'soucet'|'ztrata'|'hmotnost', ztrata (% hmotnosti, která se odpaří), hmotnost (g hotového jídla) }
  function vysledek(polozky, volby) {
    volby = volby || {};
    const s = soucet(polozky);
    const porci = Math.max(1, Math.round(D.cislo(volby.porci) || 1));
    let hotova = s.syrova;
    if (volby.rezim === 'ztrata') { const z = Math.min(95, Math.max(-300, D.cislo(volby.ztrata) || 0)); hotova = s.syrova * (1 - z / 100); }
    else if (volby.rezim === 'hmotnost' && D.cislo(volby.hmotnost) > 0) hotova = D.cislo(volby.hmotnost);
    const deleno = d => { const o = {}; for (const k in s.celkem) o[k] = d > 0 ? s.celkem[k] / d : 0; return o; };
    const na100 = hotova > 0 ? deleno(hotova / 100) : deleno(0);
    const naPorci = deleno(porci);
    return { ...s, porci, hotova, porceG: hotova / porci, na100, naPorci, riPorce: procentaRI(naPorci), ri100: procentaRI(na100),
      koeficient: s.syrova > 0 ? hotova / s.syrova : 1 };
  }

  /* ---------- etiketa podle nařízení EU 1169/2011 ---------- */
  // referenční hodnoty příjmu (příloha XIII, část B)
  const RI = { kj: 8400, kcal: 2000, tuk: 70, nasycene: 20, sacharidy: 260, cukry: 90, bilkoviny: 50, sul: 6 };
  function procentaRI(n) { const o = {}; for (const k in RI) o[k] = (n[k] || 0) / RI[k] * 100; return o; }
  const fmt = (v, d) => v.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
  // zaokrouhlení podle pokynů Komise k tolerancím (12/2012): energie na celé kJ/kcal; tuky, sacharidy, cukry, bílkoviny,
  // vláknina ≥ 10 g na celé g, < 10 g na 0,1 g, ≤ 0,5 g „< 0,5“; nasycené ≤ 0,1 g „< 0,1“; sůl ≥ 1 g na 0,1 g, jinak na 0,01 g, ≤ 0,0125 g „< 0,01“
  function hodnotaEU(k, v) {
    if (!Number.isFinite(v)) return '–';
    if (k === 'kj' || k === 'kcal') return fmt(Math.round(v), 0);
    if (k === 'sul') { if (v <= 0.0125) return v <= 0 ? '0' : '< 0,01'; return D.zaokrouhli(v, 2) >= 1 ? fmt(D.zaokrouhli(v, 1), 1) : fmt(D.zaokrouhli(v, 2), 2); }
    const prah = k === 'nasycene' ? 0.1 : 0.5;
    if (v <= prah) return v <= 0 ? '0' : '< ' + fmt(prah, 1);
    return D.zaokrouhli(v, 1) >= 10 ? fmt(Math.round(v), 0) : fmt(D.zaokrouhli(v, 1), 1);
  }
  // řádky etikety v pořadí přílohy XV (vláknina je nepovinná – vynechá se, když ji nezná žádná surovina)
  function radkyEtikety(vys) {
    const r = [
      { k: 'energie', n: 'Energie', pod: false },
      { k: 'tuk', n: 'Tuky', pod: false }, { k: 'nasycene', n: 'z toho nasycené mastné kyseliny', pod: true },
      { k: 'sacharidy', n: 'Sacharidy', pod: false }, { k: 'cukry', n: 'z toho cukry', pod: true },
      { k: 'vlaknina', n: 'Vláknina', pod: false }, { k: 'bilkoviny', n: 'Bílkoviny', pod: false }, { k: 'sul', n: 'Sůl', pod: false },
    ];
    return r.filter(x => x.k !== 'vlaknina' || (vys.chybi.vlaknina || []).length < vys.pocet).map(x => {
      const hod = n => x.k === 'energie' ? hodnotaEU('kj', n.kj) + ' kJ / ' + hodnotaEU('kcal', n.kcal) + ' kcal' : hodnotaEU(x.k, n[x.k]) + ' g';
      const ri = x.k === 'energie' ? vys.riPorce.kj : vys.riPorce[x.k];
      return { ...x, na100: hod(vys.na100), naPorci: hod(vys.naPorci), ri: Number.isFinite(ri) ? fmt(Math.round(ri), 0) + ' %' : '' };
    });
  }

  /* ---------- uložené recepty ---------- */
  function prazdna() { return { verze: VERZE, recepty: {} }; }
  const ZAKAZANE = new Set(['__proto__', 'constructor', 'prototype']);
  function normPolozka(p) {
    if (!p || typeof p !== 'object') return null;
    const f = p.f && typeof p.f === 'object' && typeof p.f.nazev === 'string' && p.f.n && typeof p.f.n === 'object' ? p.f : null;
    const mn = D.cislo(p.mn);
    return {
      radek: String(p.radek || '').slice(0, 200), nazev: String(p.nazev || '').slice(0, 120),
      druh: typeof p.druh === 'string' ? p.druh : null, jednotka: typeof p.jednotka === 'string' ? p.jednotka : null,
      mn: mn !== null && mn >= 0 && mn < 1e6 ? mn : null,
      j: JEDNOTKY[p.j] || /^p\d{1,2}$/.test(p.j) ? p.j : 'g', gKus: D.cislo(p.gKus) > 0 ? D.cislo(p.gKus) : null,
      f: f ? D.snimek(f) : null, rucne: !!p.rucne,
    };
  }
  function normRecept(r) {
    if (!r || typeof r !== 'object') return null;
    const polozky = (Array.isArray(r.polozky) ? r.polozky : []).slice(0, 150).map(normPolozka).filter(Boolean);
    return {
      id: typeof r.id === 'string' && /^[a-z0-9_-]{1,40}$/i.test(r.id) ? r.id : D.noveId('n'),
      nazev: String(r.nazev || '').trim().slice(0, 120) || 'Recept',
      text: String(r.text || '').slice(0, 20000),
      porci: Math.min(500, Math.max(1, Math.round(D.cislo(r.porci) || 1))),
      rezim: ['soucet', 'ztrata', 'hmotnost'].includes(r.rezim) ? r.rezim : 'soucet',
      ztrata: D.cislo(r.ztrata) !== null ? Math.min(95, Math.max(-300, D.cislo(r.ztrata))) : 0,
      hmotnost: D.cislo(r.hmotnost) > 0 ? D.cislo(r.hmotnost) : null,
      polozky, zmeneno: Number.isFinite(r.zmeneno) ? r.zmeneno : Date.now(),
    };
  }
  function migruj(x) {
    const d = prazdna();
    if (!x || typeof x !== 'object' || !x.recepty || typeof x.recepty !== 'object') return d;
    for (const k of Object.keys(x.recepty)) {
      if (ZAKAZANE.has(k)) continue;
      const r = normRecept({ ...x.recepty[k], id: k });
      if (r) d.recepty[r.id] = r;
    }
    return d;
  }
  function ulozRecept(data, r) {
    const x = normRecept({ ...r, zmeneno: Date.now() });
    data.recepty[x.id] = x;
    return x;
  }
  function seznamReceptu(data) {
    return Object.values(data.recepty).sort((a, b) => b.zmeneno - a.zmeneno);
  }

  /* ---------- výstupy ---------- */
  // balík pro Deník jídla (formát sdílení receptu ds1 – Deník ho přijme přes odkaz potraviny.html#sdileni=…)
  function balikProDenik(r, vys) {
    const suroviny = r.polozky.map(p => ({ p, x: prepocet(p, p.f) })).filter(o => o.p.f && o.x.m > 0).map(o => ({ f: o.p.f, g: o.x.m }));
    if (!suroviny.length) throw new Error('Recept nemá žádnou spárovanou surovinu s množstvím.');
    const stav = { recepty: { x: { nazev: (r.nazev || 'Recept').trim() || 'Recept', porci: vys.porci, hmotnost: r.rezim !== 'soucet' && vys.hotova > 0 ? Math.round(vys.hotova) : null, postup: '', suroviny } } };
    return D.balikSdileni(stav, 'r', 'x');
  }
  const csvBunka = v => { const s = typeof v === 'number' ? String(D.zaokrouhli(v, 2)).replace('.', ',') : String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function csvRozpadu(vys) {
    const hl = ['Surovina', 'Hmotnost (g)', 'Energie (kJ)', 'Energie (kcal)', 'Tuky (g)', 'Nasycené MK (g)', 'Sacharidy (g)', 'Cukry (g)', 'Vláknina (g)', 'Bílkoviny (g)', 'Sůl (g)'];
    const radek = (nazev, g, v) => [nazev, g, v.kj, v.kcal, ...ZIVINY.map(k => Number.isFinite(v[k]) ? v[k] : '')].map(csvBunka).join(';');
    const r = [hl.join(';')];
    for (const x of vys.radky) r.push(radek(x.f.nazev + (x.f.znacka ? ' (' + x.f.znacka + ')' : ''), x.g, x.v));
    r.push(radek('Celkem', vys.syrova, vys.celkem));
    r.push(radek('Na porci', vys.porceG, vys.naPorci));
    r.push(radek('Na 100 g', 100, vys.na100));
    return '﻿' + r.join('\r\n');
  }

  const API = { KLIC, VERZE, JEDNOTKY, HUSTOTA, RI, ZIVINY, NAZVY, hustota, jednotkaZRozboru, gramyNaMl, prepocet, volbyJednotek, rozpoznej,
    energieEU, soucet, vysledek, procentaRI, hodnotaEU, radkyEtikety, prazdna, normPolozka, normRecept, migruj, ulozRecept, seznamReceptu,
    balikProDenik, csvRozpadu };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.NUTREC = API;
})(typeof window !== 'undefined' ? window : this,
  typeof module !== 'undefined' && module.exports ? require('../potraviny/jadro.js') : (typeof window !== 'undefined' ? window.DENIK_JADRO : null));
