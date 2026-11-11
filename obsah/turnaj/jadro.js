/* Turnajový pavouk a rozlosování – jádro bez DOM (test: _test/turnaj_test.js).
   Turnaj = účastníci + seznam zápasů. Zápas nemá hráče natvrdo, ale „zdroje“ slotů:
     {u: id} účastník · {v: idZápasu} vítěz · {p: idZápasu} poražený · {g: skupina, m: místo} místo ve skupině · null = volný los.
   prepocti() projde zápasy v pořadí (zdroje jsou vždy dřív) a dosadí hráče; když se hráč ve slotu změní a zápas už měl
   výsledek, výsledek smaže → oprava výsledku sama přepočítá navazující zápasy. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_turnaj';
  const VOLNO = '~';           // volný los / nepotřebný zápas
  const SYSTEMY = [
    { id: 'ko', nazev: '🏆 Vyřazovací (pavouk)' },
    { id: 'de', nazev: '🔁 Dvojí vyřazovací' },
    { id: 'rr', nazev: '🔄 Každý s každým' },
    { id: 'sw', nazev: '🇨🇭 Švýcarský systém' },
    { id: 'sk', nazev: '🏟️ Skupiny + play-off' }
  ];
  const SEKCE = { W: 'Pavouk', L: 'Pavouk poražených', F: 'Velké finále', O3: 'O 3. místo', RR: 'Každý s každým', SW: 'Švýcarský systém', G: 'Skupiny' };

  /* ---------- seedovaný PRNG ---------- */
  function hashSeed(s) {
    let h = 1779033703 ^ String(s).length;
    for (const ch of String(s)) { h = Math.imul(h ^ ch.codePointAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function prng(seed) { // mulberry32
    let a = hashSeed(seed);
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function novySeed(rnd) {
    rnd = rnd || Math.random;
    const z = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
    for (let i = 0; i < 6; i++) s += z[Math.floor(rnd() * z.length)];
    return s;
  }
  function zamichej(pole, rnd) {
    const a = pole.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- nasazení ---------- */
  const mocnina2 = n => { let s = 1; while (s < n) s *= 2; return s; };

  /* Standardní rozložení: pořadí nasazených v pavouku (1, 16, 8, 9, …) – 1 a 2 se potkají až ve finále.
     Nasazení větší než n = volný los (null). */
  function nasazeniVyrazovaci(n) {
    const vel = Math.max(2, mocnina2(n));
    let p = [1, 2];
    while (p.length < vel) { const d = p.length * 2 + 1; p = p.flatMap(s => [s, d - s]); }
    return p.map(s => (s <= n ? s : null));
  }

  /* Pořadí účastníků pro los: nasazení (číslo) vzestupně, pak nenasazení – náhodně (seed) nebo v zadaném pořadí. */
  function poradiLosu(ucastnici, zpusob, rnd) {
    const nas = ucastnici.filter(u => u.nasazeni > 0).sort((a, b) => a.nasazeni - b.nasazeni);
    let ost = ucastnici.filter(u => !(u.nasazeni > 0));
    if (zpusob === 'nahodne') ost = zamichej(ost, rnd || Math.random);
    return nas.concat(ost);
  }

  /* ---------- tvorba zápasů ---------- */
  const zdroj = z => (z == null ? null : typeof z === 'string' ? { u: z } : z);
  function zapas(id, sekce, kolo, zA, zB, x) {
    return Object.assign({ id, sekce, kolo, zA: zdroj(zA), zB: zdroj(zB), a: undefined, b: undefined, vys: null, cas: '', kurt: '' }, x || {});
  }

  /* Vyřazovací pavouk. zdroje[i] = účastník (id) nebo zdroj s nasazením i+1. */
  function vytvorVyrazovaci(zdroje, volby) {
    volby = volby || {};
    const pre = volby.prefix || 'w', sekce = volby.sekce || 'W';
    const roz = nasazeniVyrazovaci(zdroje.length), vel = roz.length, k = Math.log2(vel);
    const z = [];
    let predchozi = [];
    for (let i = 0; i < vel / 2; i++) {
      const sa = roz[2 * i], sb = roz[2 * i + 1];
      const m = zapas(pre + '1_' + (i + 1), sekce, 1, sa ? zdroje[sa - 1] : null, sb ? zdroje[sb - 1] : null, { nasA: sa, nasB: sb });
      z.push(m); predchozi.push(m.id);
    }
    for (let r = 2; r <= k; r++) {
      const ted = [];
      for (let i = 0; i < predchozi.length / 2; i++) {
        const m = zapas(pre + r + '_' + (i + 1), sekce, r, { v: predchozi[2 * i] }, { v: predchozi[2 * i + 1] });
        z.push(m); ted.push(m.id);
      }
      predchozi = ted;
    }
    if (volby.o3 && k >= 2) {
      const sf = z.filter(m => m.kolo === k - 1);
      z.push(zapas(pre + 'o3', 'O3', k, { p: sf[0].id }, { p: sf[1].id }));
    }
    return z;
  }

  /* Dvojí vyřazovací: pavouk vítězů (W), poražených (L), velké finále (F) a případný reset. */
  function vytvorDvojite(zdroje, volby) {
    volby = volby || {};
    // vytvorVyrazovaci bere zdroje podle nasazení; při 3 hráčích doplníme velikost na 4 volným losem
    const zdr = zdroje.slice(); while (zdr.length < 4) zdr.push(null);
    const W = vytvorVyrazovaci(zdr, { prefix: 'w', sekce: 'W' });
    const vel = mocnina2(Math.max(4, zdroje.length)), k = Math.log2(vel);
    const kolo = r => W.filter(m => m.kolo === r).map(m => m.id);
    const L = [];
    // L1: poražení z W1 po dvojicích
    let pred = [];
    const w1 = kolo(1);
    for (let i = 0; i < w1.length / 2; i++) {
      const m = zapas('l1_' + (i + 1), 'L', 1, { p: w1[2 * i] }, { p: w1[2 * i + 1] }); L.push(m); pred.push(m.id);
    }
    let lk = 1;
    for (let r = 2; r <= k; r++) {
      // sestupové kolo: vítězové L proti poraženým z W r (střídavě obráceně, ať se neopakují dvojice)
      const wr = kolo(r), ted = [];
      lk++;
      for (let i = 0; i < pred.length; i++) {
        const j = r % 2 === 0 ? wr.length - 1 - i : i;
        const m = zapas('l' + lk + '_' + (i + 1), 'L', lk, { v: pred[i] }, { p: wr[j] }); L.push(m); ted.push(m.id);
      }
      pred = ted;
      if (r < k) {
        lk++;
        const ted2 = [];
        for (let i = 0; i < pred.length / 2; i++) {
          const m = zapas('l' + lk + '_' + (i + 1), 'L', lk, { v: pred[2 * i] }, { v: pred[2 * i + 1] }); L.push(m); ted2.push(m.id);
        }
        pred = ted2;
      }
    }
    const wf = kolo(k)[0], lf = pred[0];
    const F = [zapas('gf', 'F', 1, { v: wf }, { v: lf })];
    if (volby.reset !== false) F.push(zapas('gf2', 'F', 2, null, null, { reset: 'gf' }));
    return W.concat(L, F);
  }

  /* Bergerovy tabulky: n hráčů (indexy 0..n-1), u lichého počtu má v každém kole jeden volno (-1). */
  function berger(n) {
    if (n < 2) return [];
    const m = n % 2 ? n + 1 : n, h = m / 2, kola = [];
    let pary = [];
    for (let i = 1; i <= h; i++) pary.push([i, m + 1 - i]);
    for (let r = 1; r < m; r++) {
      const kolo = pary.map(([x, y]) => {
        if (x === m || y === m) { const o = x === m ? y : x; return r % 2 === 0 ? [m, o] : [o, m]; }
        return [x, y];
      });
      kola.push(kolo.map(([x, y]) => [x > n ? -1 : x - 1, y > n ? -1 : y - 1]));
      const pos = k => (k === m ? m : ((k - 1 + h) % (m - 1)) + 1);
      pary = pary.map(([x, y]) => [pos(x), pos(y)]);
    }
    return kola;
  }

  function vytvorKazdy(ids, volby) {
    volby = volby || {};
    const pre = volby.prefix || 'r', sekce = volby.sekce || 'RR', x = volby.x || {};
    const kola = berger(ids.length), z = [];
    const pridej = (kolaPole, posun, otoc) => kolaPole.forEach((kolo, r) => kolo.forEach(([i, j], q) => {
      if (i < 0 && j < 0) return;
      let A = i < 0 ? null : ids[i], B = j < 0 ? null : ids[j];
      if (A == null) { A = B; B = null; }
      if (otoc && B != null) [A, B] = [B, A];
      z.push(zapas(pre + (r + 1 + posun) + '_' + (q + 1), sekce, r + 1 + posun, A, B, x));
    }));
    pridej(kola, 0, false);
    if (volby.odvety) pridej(kola, kola.length, true);
    return z;
  }

  /* Rozdělení do skupin: hadovitě podle pořadí losu (koše po `pocet`), hráči ze stejného klubu do různých skupin, pokud to jde. */
  function skupiny(hraci, pocet) {
    pocet = Math.max(1, Math.min(pocet, hraci.length));
    const sk = Array.from({ length: pocet }, () => []);
    const klub = h => (h.klub || '').trim().toLowerCase();
    for (let r = 0; r * pocet < hraci.length; r++) {
      const kos = hraci.slice(r * pocet, (r + 1) * pocet);
      const had = Array.from({ length: pocet }, (_, i) => (r % 2 ? pocet - 1 - i : i));
      // backtracking: přiřadit hráče koše do různých skupin, nejdřív hadovité pořadí, minimum střetů klubů
      let nej = null, nejKonf = Infinity, kroku = 0;
      const prir = [], pouzite = new Set();
      (function zkus(i, konf) {
        if (konf >= nejKonf || ++kroku > 20000) return;
        if (i === kos.length) { nej = prir.slice(); nejKonf = konf; return; }
        const pref = had.slice(i).concat(had.slice(0, i));
        for (const g of pref) {
          if (pouzite.has(g)) continue;
          const c = klub(kos[i]) && sk[g].some(h => klub(h) === klub(kos[i])) ? 1 : 0;
          pouzite.add(g); prir.push(g);
          zkus(i + 1, konf + c);
          pouzite.delete(g); prir.pop();
          if (nejKonf === 0) return;
        }
      })(0, 0);
      kos.forEach((h, i) => sk[nej[i]].push(h));
    }
    return sk.map(s => s.map(h => h.id));
  }

  /* Švýcarské párování. hraci = [{id, body, souperi:[id], volno:bool}] seřazení podle pořadí (body, pak nasazení).
     Volno dostane nejníže postavený hráč, který ho ještě neměl. Ve skupině se stejnými body horní polovina proti dolní,
     při opakování soupeře backtracking. Když to bez opakování nejde vůbec, povolí opakování. */
  function svycarPary(hraci, kolo) {
    void kolo;
    const ser = hraci.map((h, i) => Object.assign({ _i: i }, h))
      .sort((a, b) => (b.body || 0) - (a.body || 0) || a._i - b._i);
    const hrali = (a, b) => (a.souperi || []).includes(b.id) || (b.souperi || []).includes(a.id);

    function sparuj(list, povolOpak) {
      let kroku = 0;
      const ven = [];
      function rek(zbyva) {
        if (!zbyva.length) return true;
        if (++kroku > 200000) return false;
        const p = zbyva[0], rest = zbyva.slice(1);
        const sk = rest.filter(h => (h.body || 0) === (p.body || 0));
        const idx = Math.max(0, Math.floor((sk.length + 1) / 2) - 1); // první z dolní poloviny skupiny (sk je bez p)
        const kand = sk.slice(idx).concat(sk.slice(0, idx).reverse(), rest.filter(h => (h.body || 0) !== (p.body || 0)));
        for (const q of kand) {
          if (!povolOpak && hrali(p, q)) continue;
          ven.push([p.id, q.id]);
          if (rek(rest.filter(h => h !== q))) return true;
          ven.pop();
        }
        return false;
      }
      return rek(list) ? ven : null;
    }

    const lichy = ser.length % 2 === 1;
    const kandVolno = lichy ? ser.filter(h => !h.volno).reverse().concat(ser.filter(h => h.volno).reverse()) : [null];
    for (const povolOpak of [false, true]) {
      for (const v of kandVolno) {
        const list = v ? ser.filter(h => h !== v) : ser;
        const pary = sparuj(list, povolOpak);
        if (pary) return { pary, volno: v ? v.id : null, opakovani: povolOpak };
      }
    }
    return { pary: [], volno: null, opakovani: false };
  }

  /* ---------- výsledky a postup ---------- */
  const znamy = x => x != null && x !== VOLNO;
  function vitez(m) {
    const a = m.a, b = m.b;
    if (a === VOLNO && b === VOLNO) return VOLNO;
    if (a === VOLNO) return b == null ? null : b;
    if (b === VOLNO) return a == null ? null : a;
    if (a == null || b == null || !m.vys) return null;
    const v = m.vys;
    if (v.a > v.b) return a;
    if (v.b > v.a) return b;
    return v.v === 'a' ? a : v.v === 'b' ? b : null;
  }
  function porazeny(m) {
    if (m.a === VOLNO || m.b === VOLNO) return VOLNO;
    const w = vitez(m);
    if (w == null) return null;
    return w === m.a ? m.b : m.a;
  }
  const jeVyrazovaci = m => m.sekce === 'W' || m.sekce === 'L' || m.sekce === 'F' || m.sekce === 'O3';

  function skupinaHotova(t, g) {
    const z = t.zapasy.filter(m => m.sekce === 'G' && m.sk === g && znamy(m.a) && znamy(m.b));
    return z.length > 0 && z.every(m => m.vys);
  }
  function tabulkaSkupiny(t, g) {
    const ids = (t.skupiny || [])[g] || [];
    return tabulka(t.zapasy.filter(m => m.sekce === 'G' && m.sk === g), Object.assign({}, pravidla(t), { hraci: ids }));
  }

  /* Dosadí hráče do všech zápasů. Vrací id zápasů, kterým se smazal výsledek (změnil se v nich hráč). */
  function prepocti(t) {
    const mapa = {}, smazane = [], cacheSk = {};
    const res = zd => {
      if (zd == null) return VOLNO;
      if (zd.u != null) return zd.u;
      if (zd.v != null) return mapa[zd.v] ? vitez(mapa[zd.v]) : null;
      if (zd.p != null) return mapa[zd.p] ? porazeny(mapa[zd.p]) : null;
      if (zd.g != null) {
        const ids = (t.skupiny || [])[zd.g] || [];
        if (zd.m > ids.length) return VOLNO;
        if (!skupinaHotova(t, zd.g)) return null;
        if (!cacheSk[zd.g]) cacheSk[zd.g] = tabulkaSkupiny(t, zd.g);
        const r = cacheSk[zd.g][zd.m - 1];
        return r ? r.id : VOLNO;
      }
      return null;
    };
    for (const m of t.zapasy) {
      let a, b;
      if (m.reset) {
        const gf = mapa[m.reset], w = gf ? vitez(gf) : null;
        if (w == null) { a = b = null; } else if (w === gf.a || !znamy(gf.a) || !znamy(gf.b)) { a = b = VOLNO; } else { a = gf.a; b = gf.b; }
      } else { a = res(m.zA); b = res(m.zB); }
      if (m.a !== undefined && (a !== m.a || b !== m.b) && m.vys) { smazane.push(m.id); m.vys = null; }
      if ((a === VOLNO || b === VOLNO) && m.vys) { smazane.push(m.id); m.vys = null; }
      m.a = a; m.b = b;
      mapa[m.id] = m;
    }
    return smazane;
  }

  function najdi(t, id) { return t.zapasy.find(m => m.id === id); }
  const klonuj = o => JSON.parse(JSON.stringify(o));

  /* Zapíše výsledek (vys = {a, b, v?} nebo null = smazat) a přepočítá navazující zápasy. */
  function zapisVysledek(t, id, vys) {
    const m = najdi(t, id);
    if (!m) throw new Error('Zápas nenalezen');
    if (vys) {
      if (!znamy(m.a) || !znamy(m.b)) throw new Error('Zápas ještě nemá oba soupeře');
      const a = Number(vys.a), b = Number(vys.b);
      if (!isFinite(a) || !isFinite(b) || a < 0 || b < 0) throw new Error('Neplatné skóre');
      const v = { a, b };
      if (a === b && (vys.v === 'a' || vys.v === 'b')) v.v = vys.v;
      if (jeVyrazovaci(m) && a === b && !v.v) throw new Error('Ve vyřazovací části musí být vítěz – při remíze vyberte, kdo postupuje');
      m.vys = v;
    } else m.vys = null;
    return prepocti(t).filter(x => x !== id);
  }
  /* Které navazující zápasy s výsledkem by změna smazala (pro potvrzení). */
  function dopadZmeny(t, id, vys) {
    const k = klonuj(t);
    try { return zapisVysledek(k, id, vys); } catch (e) { return []; }
  }

  /* ---------- tabulka ---------- */
  function pravidla(t) {
    const n = (t && t.nastaveni) || {};
    const body = n.body || {};
    const sw = t && t.system === 'sw';
    return {
      vyhra: body.v != null ? +body.v : (sw ? 1 : 3),
      remiza: body.r != null ? +body.r : (sw ? 0.5 : 1),
      prohra: body.p != null ? +body.p : 0,
      volnoBody: sw ? (body.v != null ? +body.v : 1) : null,
      kriteria: sw ? ['body', 'buchholz', 'sb', 'vyhry'] : ['body', 'vzajemne', 'rozdil', 'dal'].concat(n.buchholz ? ['buchholz'] : [])
    };
  }

  /* tabulka(zapasy, pravidla) → řádky seřazené podle kritérií; vzájemný zápas se počítá jen mezi hráči shodnými
     ve všech předchozích kritériích (minitabulka). Úplně shodní sdílejí místo. */
  function tabulka(zapasy, pr) {
    pr = Object.assign({ vyhra: 3, remiza: 1, prohra: 0, volnoBody: null, kriteria: ['body', 'vzajemne', 'rozdil', 'dal'] }, pr || {});
    const R = {};
    const radek = id => R[id] || (R[id] = { id, z: 0, v: 0, r: 0, p: 0, volno: 0, dal: 0, dostal: 0, body: 0, souperi: [], vysledky: [] });
    (pr.hraci || []).forEach(radek);
    for (const m of zapasy) {
      if (znamy(m.a)) radek(m.a);
      if (znamy(m.b)) radek(m.b);
      if (!m.vys) {
        if (pr.volnoBody != null && ((m.a === VOLNO) !== (m.b === VOLNO))) {
          const h = radek(m.a === VOLNO ? m.b : m.a); if (znamy(h.id)) { h.volno++; h.body += pr.volnoBody; }
        }
        continue;
      }
      if (!znamy(m.a) || !znamy(m.b)) continue;
      const A = radek(m.a), B = radek(m.b), sa = +m.vys.a, sb = +m.vys.b;
      const w = vitez(m);
      A.z++; B.z++; A.dal += sa; A.dostal += sb; B.dal += sb; B.dostal += sa;
      A.souperi.push(m.b); B.souperi.push(m.a);
      if (w === m.a) { A.v++; B.p++; A.body += pr.vyhra; B.body += pr.prohra; A.vysledky.push([m.b, 1]); B.vysledky.push([m.a, 0]); }
      else if (w === m.b) { B.v++; A.p++; B.body += pr.vyhra; A.body += pr.prohra; A.vysledky.push([m.b, 0]); B.vysledky.push([m.a, 1]); }
      else { A.r++; B.r++; A.body += pr.remiza; B.body += pr.remiza; A.vysledky.push([m.b, 0.5]); B.vysledky.push([m.a, 0.5]); }
    }
    const rows = Object.values(R).filter(r => znamy(r.id));
    rows.forEach(r => {
      r.rozdil = r.dal - r.dostal;
      r.buchholz = r.souperi.reduce((s, o) => s + (R[o] ? R[o].body : 0), 0);
      r.sb = r.vysledky.reduce((s, [o, f]) => s + f * (R[o] ? R[o].body : 0), 0);
    });
    const klic = (k, skupina) => {
      if (k === 'vzajemne') {
        const ids = new Set(skupina.map(r => r.id)), mini = {};
        skupina.forEach(r => { mini[r.id] = [0, 0]; });
        for (const m of zapasy) {
          if (!m.vys || !ids.has(m.a) || !ids.has(m.b)) continue;
          const w = vitez(m), sa = +m.vys.a, sb = +m.vys.b;
          if (w === m.a) { mini[m.a][0] += pr.vyhra; mini[m.b][0] += pr.prohra; }
          else if (w === m.b) { mini[m.b][0] += pr.vyhra; mini[m.a][0] += pr.prohra; }
          else { mini[m.a][0] += pr.remiza; mini[m.b][0] += pr.remiza; }
          mini[m.a][1] += sa - sb; mini[m.b][1] += sb - sa;
        }
        return r => mini[r.id][0] * 1e6 + mini[r.id][1];
      }
      return r => r[k] || 0;
    };
    const vysl = [];
    (function tridit(skupina, ki) {
      if (skupina.length <= 1 || ki >= pr.kriteria.length) { vysl.push(skupina); return; }
      const f = klic(pr.kriteria[ki], skupina);
      const s = skupina.map(r => [r, f(r)]).sort((x, y) => y[1] - x[1]);
      let i = 0;
      while (i < s.length) {
        let j = i; while (j < s.length && s[j][1] === s[i][1]) j++;
        tridit(s.slice(i, j).map(x => x[0]), ki + 1);
        i = j;
      }
    })(rows, 0);
    const ven = []; let misto = 1;
    vysl.forEach(sk => { sk.forEach(r => { r.misto = misto; ven.push(r); }); misto += sk.length; });
    return ven;
  }

  /* ---------- turnaj ---------- */
  function normUcastnik(u, i) {
    return { id: String(u.id || 'u' + (i + 1)), jmeno: String(u.jmeno || '').slice(0, 80) || 'Účastník ' + (i + 1),
      nasazeni: u.nasazeni > 0 ? Math.floor(u.nasazeni) : null, klub: String(u.klub || '').slice(0, 60) };
  }
  /* Řádky „Jméno ; klub ; nasazení“ (oddělovač ; nebo tabulátor), prázdné řádky se přeskočí. */
  function parsujUcastniky(text, stavajici) {
    const podleJmena = {};
    (stavajici || []).forEach(u => { podleJmena[u.jmeno] = u.id; });
    const pouzite = new Set();
    let dalsi = 1 + (stavajici || []).reduce((mx, u) => Math.max(mx, +(String(u.id).replace(/\D/g, '')) || 0), 0);
    return String(text || '').split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(r => {
      const c = r.split(/\s*[;\t]\s*/);
      let jmeno = c[0], klub = c[1] || '', nas = c[2] || '';
      if (/^\d+$/.test(klub) && !nas) { nas = klub; klub = ''; }
      let id = podleJmena[jmeno];
      if (!id || pouzite.has(id)) id = 'u' + dalsi++;
      pouzite.add(id);
      return normUcastnik({ id, jmeno, klub, nasazeni: parseInt(nas, 10) || null });
    });
  }
  function textUcastniku(u) {
    return (u || []).map(x => [x.jmeno, x.klub || '', x.nasazeni || ''].join(' ; ').replace(/(\s;\s)+$/, '').replace(/ ; $/, '')).join('\n');
  }

  function novyTurnaj(o) {
    o = o || {};
    return {
      id: o.id || 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      nazev: o.nazev || 'Turnaj', sport: o.sport || '', system: o.system || 'ko',
      losovani: o.losovani || 'nahodne', seed: o.seed || novySeed(),
      ucastnici: (o.ucastnici || []).map(normUcastnik),
      nastaveni: Object.assign({ o3: false, reset: true, odvety: false, body: { v: null, r: null, p: null }, buchholz: false, kol: 0, skupin: 2, postup: 2 }, o.nastaveni || {}),
      skupiny: null, zapasy: [], vytvoren: o.vytvoren || new Date().toISOString().slice(0, 10)
    };
  }

  function doporucenaKola(n) { return Math.max(1, Math.ceil(Math.log2(Math.max(2, n)))); }

  /* Postupující ze skupin jako zdroje nasazení: všichni první, pak druzí… Pořadí dalších košů se posune tak,
     aby se v 1. kole play-off nepotkali hráči ze stejné skupiny. */
  function zdrojePlayoff(pocetSk, postup) {
    let nej = null, nejKonf = Infinity;
    for (let s = 0; s < Math.max(1, pocetSk) && nejKonf; s++) {
      for (const obr of [false, true]) {
        const zdr = [];
        for (let m = 1; m <= postup; m++) {
          let poradi = Array.from({ length: pocetSk }, (_, g) => g);
          if (m > 1) { poradi = poradi.map(g => (g + s * (m - 1)) % pocetSk); if (obr) poradi.reverse(); }
          poradi.forEach(g => zdr.push({ g, m }));
        }
        const roz = nasazeniVyrazovaci(zdr.length);
        let konf = 0;
        for (let i = 0; i < roz.length; i += 2) if (roz[i] && roz[i + 1] && zdr[roz[i] - 1].g === zdr[roz[i + 1] - 1].g) konf++;
        if (konf < nejKonf) { nej = zdr; nejKonf = konf; }
      }
    }
    return nej;
  }

  /* Vylosuje a vytvoří zápasy podle systému (deterministicky ze seedu). */
  function vylosuj(t) {
    const rnd = prng(t.seed);
    const por = poradiLosu(t.ucastnici, t.losovani, rnd);
    const ids = por.map(u => u.id), n = t.nastaveni;
    t.skupiny = null;
    if (ids.length < 2) { t.zapasy = []; return t; }
    if (t.system === 'ko') t.zapasy = vytvorVyrazovaci(ids, { o3: n.o3 });
    else if (t.system === 'de') t.zapasy = vytvorDvojite(ids, { reset: n.reset });
    else if (t.system === 'rr') t.zapasy = vytvorKazdy(ids, { odvety: n.odvety });
    else if (t.system === 'sw') {
      if (!(n.kol > 0)) n.kol = doporucenaKola(ids.length);
      t.zapasy = [];
      dalsiKoloSvycar(t, por);
    } else if (t.system === 'sk') {
      const pocet = Math.max(1, Math.min(+n.skupin || 2, Math.floor(ids.length / 2)));
      t.skupiny = skupiny(por, pocet);
      t.zapasy = [];
      t.skupiny.forEach((g, gi) => { t.zapasy.push(...vytvorKazdy(g, { prefix: 'g' + gi + '_', sekce: 'G', odvety: n.odvety, x: { sk: gi } })); });
      const postup = Math.max(1, Math.min(+n.postup || 2, Math.min(...t.skupiny.map(g => g.length))));
      const zdr = zdrojePlayoff(pocet, postup);
      if (zdr.length >= 2) t.zapasy.push(...vytvorVyrazovaci(zdr, { o3: n.o3 }));
    }
    prepocti(t);
    return t;
  }

  function hotovoKolo(t, kolo) { return t.zapasy.filter(m => m.kolo === kolo && znamy(m.a) && znamy(m.b)).every(m => m.vys); }
  function posledniKolo(t) { return t.zapasy.reduce((mx, m) => Math.max(mx, m.kolo || 0), 0); }

  /* Švýcar: vylosuje další kolo z aktuálního pořadí. Vrací false, když nejde (kolo nedohrané / všechna kola). */
  function dalsiKoloSvycar(t, poradiLosuUc) {
    const kolo = posledniKolo(t);
    if (kolo >= t.nastaveni.kol) return false;
    if (kolo > 0 && !hotovoKolo(t, kolo)) return false;
    const por = poradiLosuUc || poradiLosu(t.ucastnici, t.losovani, prng(t.seed));
    const pr = pravidla(t);
    const tab = tabulka(t.zapasy, Object.assign({}, pr, { hraci: por.map(u => u.id) }));
    const R = Object.fromEntries(tab.map(r => [r.id, r]));
    const hraci = por.map(u => ({ id: u.id, body: R[u.id] ? R[u.id].body : 0, souperi: R[u.id] ? R[u.id].souperi : [], volno: R[u.id] ? R[u.id].volno > 0 : false }));
    const { pary, volno } = svycarPary(hraci, kolo + 1);
    const k = kolo + 1;
    pary.forEach(([a, b], i) => t.zapasy.push(zapas('s' + k + '_' + (i + 1), 'SW', k, a, b)));
    if (volno) t.zapasy.push(zapas('s' + k + '_v', 'SW', k, volno, null));
    prepocti(t);
    return true;
  }

  /* Krok (časová vrstva) zápasu = 1 + nejvyšší krok zdrojů; pro rozpis a časy. */
  function kroky(t) {
    const k = {}, maxG = t.zapasy.filter(m => m.sekce === 'G').reduce((mx, m) => Math.max(mx, m.kolo), 0);
    const kz = zd => (!zd ? 0 : zd.v != null ? k[zd.v] || 0 : zd.p != null ? k[zd.p] || 0 : zd.g != null ? maxG : 0);
    for (const m of t.zapasy) {
      if (m.sekce === 'RR' || m.sekce === 'SW' || m.sekce === 'G') k[m.id] = m.kolo;
      else if (m.reset) k[m.id] = (k[m.reset] || 0) + 1;
      else k[m.id] = 1 + Math.max(kz(m.zA), kz(m.zB));
    }
    return k;
  }

  /* Hraný zápas = není jasný volný los (oba sloty nejsou VOLNO). */
  const hrany = m => m.a !== VOLNO && m.b !== VOLNO;

  /* Časy a kurty: zápasy podle kroků, v kroku postupně po kurtech. */
  function rozvrh(t, o) {
    o = Object.assign({ zacatek: '09:00', delka: 20, pauza: 5, kurty: 1 }, o || {});
    const [hh, mm] = String(o.zacatek).split(':').map(Number);
    let min = (hh || 0) * 60 + (mm || 0);
    const kr = kroky(t), kurty = Math.max(1, +o.kurty || 1), slot = (+o.delka || 0) + (+o.pauza || 0);
    const poKr = {};
    t.zapasy.forEach(m => { if (!m.reset && hrany(m)) (poKr[kr[m.id]] = poKr[kr[m.id]] || []).push(m); else { m.cas = ''; m.kurt = ''; } });
    Object.keys(poKr).map(Number).sort((a, b) => a - b).forEach(k => {
      poKr[k].forEach((m, i) => {
        if (i && i % kurty === 0) min += slot;
        m.cas = String(Math.floor(min / 60) % 24).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
        m.kurt = String((i % kurty) + 1);
      });
      min += slot;
    });
    return t;
  }

  /* Konečné pořadí vyřazovací části: [{id, misto}] – vypadlí v pozdější fázi jsou výš, ve stejné fázi sdílí místo. */
  function poradiVyrazovaci(t) {
    const z = t.zapasy.filter(jeVyrazovaci);
    if (!z.length) return [];
    const ven = [], videni = new Set();
    const pridej = (id, misto) => { if (znamy(id) && !videni.has(id)) { videni.add(id); ven.push({ id, misto }); } };
    const F = z.filter(m => m.sekce === 'F'), W = z.filter(m => m.sekce === 'W'), L = z.filter(m => m.sekce === 'L');
    const maxW = W.reduce((mx, m) => Math.max(mx, m.kolo), 0), maxL = L.reduce((mx, m) => Math.max(mx, m.kolo), 0);
    // místo vypadlých v kole = 1 + počet hráčů, kteří vypadli později (každý hraný zápas vyřadí jednoho) + vítěz
    const pozdeji = (Z, r, max) => { let s = 0; for (let i = r + 1; i <= max; i++) s += Z.filter(m => m.kolo === i && hrany(m)).length; return s; };
    if (F.length) {
      const gf = F[0], gf2 = F[1];
      const fin = gf2 && znamy(gf2.a) ? gf2 : gf;
      if (vitez(fin) && (fin === gf2 || !gf2 || gf2.a === VOLNO)) { pridej(vitez(fin), 1); pridej(porazeny(fin), 2); }
      for (let r = maxL; r >= 1; r--) L.filter(m => m.kolo === r).forEach(m => pridej(porazeny(m), 3 + pozdeji(L, r, maxL)));
    } else {
      const fin = W.find(m => m.kolo === maxW);
      if (vitez(fin)) { pridej(vitez(fin), 1); pridej(porazeny(fin), 2); }
      const o3 = z.find(m => m.sekce === 'O3');
      if (o3) { if (vitez(o3) && vitez(o3) !== VOLNO) { pridej(vitez(o3), 3); pridej(porazeny(o3), 4); } }
      for (let r = maxW - 1; r >= 1; r--) {
        if (o3 && r === maxW - 1) continue;
        W.filter(m => m.kolo === r).forEach(m => pridej(porazeny(m), 2 + pozdeji(W, r, maxW)));
      }
    }
    return ven.sort((a, b) => a.misto - b.misto);
  }

  /* Celkové pořadí turnaje (pro pohled Pořadí): [{id, misto, …řádek tabulky}] */
  function poradi(t) {
    if (t.system === 'rr') return tabulka(t.zapasy, Object.assign({}, pravidla(t), { hraci: t.ucastnici.map(u => u.id) }));
    if (t.system === 'sw') return tabulka(t.zapasy, Object.assign({}, pravidla(t), { hraci: t.ucastnici.map(u => u.id) }));
    const po = poradiVyrazovaci(t);
    if (t.system !== 'sk') return po;
    // skupiny: play-off nahoře, ostatní podle místa ve skupině, pak bodů
    const videni = new Set(po.map(r => r.id)), ost = [];
    (t.skupiny || []).forEach((g, gi) => tabulkaSkupiny(t, gi).forEach(r => { if (!videni.has(r.id)) ost.push(r); }));
    ost.sort((a, b) => a.misto - b.misto || b.body - a.body || b.rozdil - a.rozdil || b.dal - a.dal);
    // místa za play-off: počet postupujících (sloty 1. kola play-off)
    const posun = t.zapasy.filter(m => m.sekce === 'W' && m.kolo === 1).reduce((s, m) => s + (m.zA ? 1 : 0) + (m.zB ? 1 : 0), 0);
    let misto = posun + 1;
    let pred = null;
    const ven = po.slice();
    ost.forEach((r, i) => {
      const kl = [r.misto, r.body, r.rozdil, r.dal].join();
      if (kl !== pred) misto = posun + 1 + i;
      pred = kl;
      ven.push({ id: r.id, misto });
    });
    return ven;
  }

  /* Názvy kol vyřazovací části */
  function nazevKola(t, sekce, kolo) {
    if (sekce === 'O3') return 'O 3. místo';
    if (sekce === 'F') return kolo === 1 ? 'Velké finále' : 'Rozhodující finále';
    if (sekce === 'L') return kolo + '. kolo poražených';
    if (sekce === 'W') {
      const maxW = t.zapasy.filter(m => m.sekce === 'W').reduce((mx, m) => Math.max(mx, m.kolo), 0);
      const zb = maxW - kolo;
      const de = t.system === 'de';
      if (zb === 0) return de ? 'Finále vítězů' : 'Finále';
      if (zb === 1) return de ? 'Semifinále vítězů' : 'Semifinále';
      if (zb === 2) return 'Čtvrtfinále';
      if (zb === 3) return 'Osmifinále';
      return kolo + '. kolo';
    }
    return kolo + '. kolo';
  }
  const pismenoSk = g => String.fromCharCode(65 + (g % 26)) + (g >= 26 ? Math.floor(g / 26) : '');

  /* Popis zdroje pro prázdný slot („Vítěz Z5“, „1. sk. A“) */
  function popisZdroje(t, zd, cisla) {
    if (zd == null) return 'volný los';
    if (zd.v != null) return 'Vítěz ' + (cisla && cisla[zd.v] ? 'Z' + cisla[zd.v] : zd.v);
    if (zd.p != null) return 'Poražený ' + (cisla && cisla[zd.p] ? 'Z' + cisla[zd.p] : zd.p);
    if (zd.g != null) return zd.m + '. sk. ' + pismenoSk(zd.g);
    return '';
  }
  /* Čísla zápasů pro zobrazení (jen hrané zápasy, v pořadí kroků) */
  function cislaZapasu(t) {
    const kr = kroky(t), c = {};
    let i = 1;
    t.zapasy.map((m, ix) => [m, ix]).sort((x, y) => kr[x[0].id] - kr[y[0].id] || x[1] - y[1])
      .forEach(([m]) => { if (m.a !== VOLNO && m.b !== VOLNO) c[m.id] = i++; });
    return c;
  }

  /* ---------- uložení a sdílení ---------- */
  function prazdna() { return { verze: VERZE, turnaje: [], aktivni: null }; }
  function normTurnaj(t) {
    const n = novyTurnaj(t);
    n.skupiny = Array.isArray(t.skupiny) ? t.skupiny : null;
    n.zapasy = (Array.isArray(t.zapasy) ? t.zapasy : []).map(m => Object.assign({ cas: '', kurt: '', vys: null }, m, { a: undefined, b: undefined }));
    if (t.ctiJen) n.ctiJen = true;
    prepocti(n);
    return n;
  }
  function migruj(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.turnaje)) return prazdna();
    return { verze: VERZE, turnaje: d.turnaje.map(normTurnaj), aktivni: d.aktivni || null };
  }
  /* Pro export/sdílení: bez dopočítaných hráčů v zápasech */
  function kompaktni(t) {
    const k = klonuj(t);
    k.zapasy.forEach(m => { delete m.a; delete m.b; if (!m.cas) delete m.cas; if (!m.kurt) delete m.kurt; if (!m.vys) delete m.vys; });
    delete k.ctiJen;
    return k;
  }

  const b64url = bytes => {
    let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const zB64url = s => {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };
  async function proud(bytes, Trida, druh) {
    const st = new Blob([bytes]).stream().pipeThrough(new Trida(druh));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  /* Turnaj → krátký řetězec do URL (#t=…): JSON → deflate-raw → base64url */
  async function zabal(t) {
    const json = new TextEncoder().encode(JSON.stringify(kompaktni(t)));
    return b64url(await proud(json, CompressionStream, 'deflate-raw'));
  }
  async function rozbal(s) {
    const json = new TextDecoder().decode(await proud(zB64url(s), DecompressionStream, 'deflate-raw'));
    return normTurnaj(JSON.parse(json));
  }

  const API = {
    VERZE, KLIC, VOLNO, SYSTEMY, SEKCE,
    hashSeed, prng, novySeed, zamichej, mocnina2,
    nasazeniVyrazovaci, poradiLosu, vytvorVyrazovaci, vytvorDvojite, berger, vytvorKazdy, skupiny, svycarPary,
    vitez, porazeny, znamy, hrany, jeVyrazovaci, prepocti, zapisVysledek, dopadZmeny, najdi,
    pravidla, tabulka, tabulkaSkupiny, skupinaHotova,
    normUcastnik, parsujUcastniky, textUcastniku, novyTurnaj, doporucenaKola, zdrojePlayoff, vylosuj,
    hotovoKolo, posledniKolo, dalsiKoloSvycar, kroky, rozvrh, poradiVyrazovaci, poradi,
    nazevKola, pismenoSk, popisZdroje, cislaZapasu,
    prazdna, normTurnaj, migruj, kompaktni, zabal, rozbal
  };
  if (typeof module !== 'undefined') module.exports = API; else window.TurnajJadro = API;
})();
