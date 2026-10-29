/* Gamebook – engine bez DOM (testuje se v node: _test/gamebook_test.js).
   Příběh je čistá data (gamebook/pribeh.js); tady jsou pravidla: vlastnosti, podmínky voleb,
   efekty, zkoušky (2k6), souboj po kolech, světlo v kahanu, předměty a validace příběhu.
   Náhoda je deterministická (seed ve stavu), takže uložená hra se po načtení chová stejně. */
(function () {
  'use strict';

  /* ---------- náhoda: mulberry32, stav = jedno číslo ---------- */
  function nahoda(st) {
    let t = (st.seed = (st.seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function k6(st) { return 1 + Math.floor(nahoda(st) * 6); }
  function k2(st) { const a = k6(st), b = k6(st); return [a, b]; }

  const VLASTNOSTI = ['obratnost', 'zdravi', 'stesti', 'olej', 'zlato'];

  function novaHra(p, seed) {
    const st = {
      verze: 1, seed: (seed == null ? Math.floor(Math.random() * 2 ** 31) : seed) | 0,
      scena: null, predmety: [], priznaky: [], navstiveno: [], denik: [], boj: null, konec: null, tahy: 0
    };
    const z = p.zacatek || {};
    st.obratnost = st.obratnostMax = 6 + k6(st);
    st.zdravi = st.zdraviMax = 12 + k6(st) + k6(st);
    st.stesti = st.stestiMax = 6 + k6(st);
    st.olej = st.olejMax = z.olej || 10;
    st.zlato = z.zlato || 0;
    st.predmety = (z.predmety || []).slice();
    vstup(st, p, p.start);
    return st;
  }

  /* ---------- podmínky a efekty ---------- */
  function splneno(st, pokud) {
    if (!pokud) return true;
    if (pokud.ma && !st.predmety.includes(pokud.ma)) return false;
    if (pokud.nema && st.predmety.includes(pokud.nema)) return false;
    if (pokud.priznak && !st.priznaky.includes(pokud.priznak)) return false;
    if (pokud.bez && st.priznaky.includes(pokud.bez)) return false;
    if (pokud.zlato != null && st.zlato < pokud.zlato) return false;
    return true;
  }
  /* Vrací seznam změn pro zobrazení (např. „Zdraví −2“). */
  function proved(st, ef) {
    const zmeny = [];
    if (!ef) return zmeny;
    for (const v of VLASTNOSTI) {
      if (!ef[v]) continue;
      const max = st[v + 'Max'];
      const pred = st[v];
      st[v] = Math.max(0, max != null ? Math.min(max, st[v] + ef[v]) : st[v] + ef[v]);
      if (st[v] !== pred) zmeny.push({ co: v, o: st[v] - pred });
    }
    for (const x of [].concat(ef.predmet || [])) { st.predmety.push(x); zmeny.push({ co: 'predmet', x, o: 1 }); }
    for (const x of [].concat(ef.odeber || [])) {
      const i = st.predmety.indexOf(x);
      if (i >= 0) { st.predmety.splice(i, 1); zmeny.push({ co: 'predmet', x, o: -1 }); }
    }
    for (const x of [].concat(ef.priznak || [])) if (!st.priznaky.includes(x)) st.priznaky.push(x);
    return zmeny;
  }

  /* Vstup do sekce: efekty jen při první návštěvě, pak kontrola smrti a tmy. */
  function vstup(st, p, id) {
    const s = p.sceny[id];
    if (!s) throw new Error('Neexistující sekce ' + id);
    st.scena = id; st.boj = null; st.tahy++;
    st.denik.push(id);
    let zmeny = [];
    if (!st.navstiveno.includes(id)) { st.navstiveno.push(id); zmeny = proved(st, s.efekty); }
    st.posledniZmeny = zmeny;
    if (s.konec) { st.konec = id; return st; }
    if (st.zdravi <= 0) return vstup(st, p, p.smrt);
    if (st.olej <= 0 && !(p.svetlo && st.predmety.includes(p.svetlo))) return vstup(st, p, p.tma);
    if (s.boj) zacniBoj(st, s.boj);
    return st;
  }

  function volby(st, p) {
    const s = p.sceny[st.scena];
    if (!s || s.konec || st.boj) return [];
    return (s.volby || []).map((v, i) => ({ v, i })).filter(o => splneno(st, o.v.pokud));
  }

  /* Zvolí volbu podle indexu v `scena.volby`. Vrátí popis toho, co se stalo (hody, výsledek). */
  function zvol(st, p, i) {
    const s = p.sceny[st.scena];
    const v = s && s.volby && s.volby[i];
    if (!v || st.boj || st.konec || !splneno(st, v.pokud)) throw new Error('Volba není dostupná');
    const out = { zmeny: proved(st, v.efekty) };
    if (v.zkouska) {
      const z = v.zkouska, hod = k2(st), soucet = hod[0] + hod[1];
      const hodnota = st[z.co];
      const ok = soucet <= hodnota;
      out.zkouska = { co: z.co, hod, soucet, hodnota, ok };
      if (z.co === 'stesti') st.stesti = Math.max(0, st.stesti - 1);  // každá zkouška štěstí ho ubere
      vstup(st, p, ok ? z.uspech : z.neuspech);
    } else if (v.boj) {
      zacniBoj(st, v.boj);
    } else vstup(st, p, v.cil);
    return out;
  }

  /* ---------- souboj: kolo = 2k6 + obratnost obou, nižší ztrácí 2 zdraví ---------- */
  function zacniBoj(st, b) {
    st.boj = { jmeno: b.jmeno, obratnost: b.obratnost, zdravi: b.zdravi, zdraviMax: b.zdravi, vyhra: b.vyhra, prohra: b.prohra || null, utek: b.utek || null, kolo: 0, log: [] };
  }
  function koloBoje(st, p) {
    const b = st.boj; if (!b) throw new Error('Neprobíhá souboj');
    b.kolo++;
    const h = k2(st), n = k2(st);
    const ja = h[0] + h[1] + st.obratnost, on = n[0] + n[1] + b.obratnost;
    const k = { kolo: b.kolo, ja, on, vysledek: ja > on ? 'zasah' : ja < on ? 'zraneni' : 'remiza' };
    if (ja > on) b.zdravi = Math.max(0, b.zdravi - 2);
    else if (ja < on) st.zdravi = Math.max(0, st.zdravi - 2);
    b.log.push(k);
    if (b.zdravi <= 0) { k.konec = 'vyhra'; vstup(st, p, b.vyhra); }
    else if (st.zdravi <= 0) { k.konec = 'prohra'; vstup(st, p, b.prohra || p.smrt); }
    return k;
  }
  function utec(st, p) {
    const b = st.boj; if (!b || !b.utek) throw new Error('Utéct nejde');
    st.zdravi = Math.max(0, st.zdravi - 2);
    vstup(st, p, b.utek);
  }

  /* ---------- předměty ---------- */
  function pouzij(st, p, predmet) {
    const d = p.predmety[predmet];
    if (!d || !d.pouziti || !st.predmety.includes(predmet) || st.konec) throw new Error('Předmět nejde použít');
    const zm = proved(st, d.pouziti);
    if (d.spotrebni) proved(st, { odeber: predmet });
    return zm;
  }

  /* ---------- kontrola příběhu: odkazy, dosažitelnost, slepé uličky ---------- */
  function cile(s) {
    const c = [];
    for (const v of s.volby || []) {
      if (v.cil) c.push(v.cil);
      if (v.zkouska) c.push(v.zkouska.uspech, v.zkouska.neuspech);
      if (v.boj) c.push(v.boj.vyhra, v.boj.prohra, v.boj.utek);
    }
    if (s.boj) c.push(s.boj.vyhra, s.boj.prohra, s.boj.utek);
    return c.filter(Boolean);
  }
  function validuj(p) {
    const chyby = [];
    const ids = Object.keys(p.sceny);
    for (const k of [p.start, p.smrt, p.tma]) if (!p.sceny[k]) chyby.push('chybí sekce ' + k);
    for (const id of ids) {
      const s = p.sceny[id];
      if (!s.text) chyby.push(id + ': bez textu');
      if (!s.konec && !cile(s).length) chyby.push(id + ': slepá ulička');
      for (const c of cile(s)) if (!p.sceny[c]) chyby.push(id + ' → ' + c + ': neexistuje');
      for (const v of s.volby || []) {
        const pd = v.pokud && (v.pokud.ma || v.pokud.nema);
        if (pd && !p.predmety[pd]) chyby.push(id + ': neznámý předmět ' + pd);
      }
      const ef = s.efekty || {};
      for (const x of [].concat(ef.predmet || [], ef.odeber || [])) if (!p.predmety[x]) chyby.push(id + ': neznámý předmět ' + x);
      if (s.konec && !p.konce[s.konec]) chyby.push(id + ': neznámý typ konce ' + s.konec);
    }
    const vid = new Set([p.start]), fronta = [p.start];
    while (fronta.length) { const s = p.sceny[fronta.shift()]; if (!s) continue; for (const c of cile(s)) if (!vid.has(c)) { vid.add(c); fronta.push(c); } }
    for (const id of ids) if (!vid.has(id) && id !== p.smrt && id !== p.tma) chyby.push(id + ': nedosažitelná');
    return chyby;
  }

  /* Uložená hra z localStorage – základní kontrola tvaru (cizí/poškozená data → null). */
  function nactiStav(p, d) {
    if (!d || typeof d !== 'object' || !p.sceny[d.scena] || !Array.isArray(d.predmety) || !Array.isArray(d.denik)) return null;
    for (const v of VLASTNOSTI) if (!Number.isFinite(d[v])) return null;
    return d;
  }

  const API = { nahoda, k6, novaHra, splneno, proved, vstup, volby, zvol, koloBoje, utec, pouzij, validuj, cile, nactiStav, VLASTNOSTI };
  if (typeof module !== 'undefined') module.exports = API; else window.GamebookJadro = API;
})();
