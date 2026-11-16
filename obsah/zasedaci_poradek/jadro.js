/* Zasedací pořádek a jmenovky – jádro bez DOM (test: _test/zasedaci_poradek_test.js).
   Projekt = hosté (skupiny, dieta, děti, doprovod), vazby „chce / nesmí sedět s“, stoly v sále
   (souřadnice v metrech), usazení host → {stul, misto}. Místa u stolu a sousedství se počítají
   z tvaru stolu; automatické rozsazení = simulované žíhání nad trestnými body párových pravidel.
   Rozložení stanových jmenovek na papír v milimetrech a přizpůsobení písma (měření přes callback). */
(function () {
  'use strict';

  const VERZE = 1;
  const ROZESTUP = 0.6;           // m na jedno místo u stolu
  const ODSTUP = 0.32;            // m od hrany stolu ke středu židle

  /* trestné body (vyšší = horší) */
  const VAHY = {
    nesmi: 100,        // dvojice „nesmí sedět spolu“ u jednoho stolu
    chce: 20,          // dvojice „chce sedět s“ u různých stolů
    chceSoused: 2,     // … u stejného stolu, ale ne vedle sebe
    doprovod: 50,      // doprovod/partner u jiného stolu
    doprovodSoused: 8, // … u stejného stolu, ale ne vedle sebe
    dite: 50,          // dítě u jiného stolu než rodič
    diteSoused: 4,
    skupina: 6,        // rozdělená skupina (rozpočítáno na dvojice)
    nerozsazen: 200    // host bez místa
  };

  const TVARY = { kulaty: '⚪ Kulatý', obdelnik: '▭ Obdélníkový', prvek: '⬚ Prvek sálu (parket, bar…)' };
  const DIETY = ['vegetarián', 'vegan', 'bezlepková', 'bez laktózy', 'bez ořechů', 'bez vepřového', 'halal', 'košer', 'dětské menu'];
  const BARVY = ['#c0392b', '#2471a3', '#239b56', '#8e44ad', '#d68910', '#17a589', '#a04000', '#2e4053', '#c71585', '#7d6608', '#1f618d', '#6c3483'];

  /* ---------- pomocné ---------- */
  let citac = 0;
  function novyId(p) { return (p || 'x') + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 5); }
  function bezDiakritiky(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  const cislo = (v, d, min, max) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);
  function nahoda(seed) {          // mulberry32 – stejné semínko = stejný výsledek
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- data ---------- */
  function normHost(h) {
    h = h || {};
    return {
      id: text(h.id, 40) || novyId('h'), jmeno: text(h.jmeno, 120) || 'Bez jména', skupina: text(h.skupina, 60),
      dieta: text(h.dieta, 60), alergie: text(h.alergie, 120), dite: !!h.dite, k: text(h.k, 40),
      poznamka: text(h.poznamka, 300), zamceny: !!h.zamceny
    };
  }
  function normStul(s) {
    s = s || {};
    const tvar = TVARY[s.tvar] ? s.tvar : 'kulaty';
    return {
      id: text(s.id, 40) || novyId('s'), tvar, nazev: text(s.nazev, 60), cislo: Math.round(cislo(s.cislo, 0, 0, 999)),
      mist: tvar === 'prvek' ? 0 : Math.round(cislo(s.mist, 8, 1, 60)),
      x: cislo(s.x, 2, -50, 250), y: cislo(s.y, 2, -50, 250), uhel: ((Math.round(cislo(s.uhel, 0, -3600, 3600)) % 360) + 360) % 360,
      jednostranny: !!s.jednostranny, cela: !!s.cela, hlavni: !!s.hlavni, rucne: !!s.rucne,
      sirka: cislo(s.sirka, 4, 0.5, 60), hloubka: cislo(s.hloubka, 3, 0.5, 60)
    };
  }
  function prazdny(nazev) {
    return { verze: VERZE, id: novyId('p'), nazev: nazev || 'Nová akce', datum: '', zmeneno: 0,
      sal: { sirka: 20, hloubka: 14 }, hoste: [], vazby: [], stoly: [], usazeni: {},
      jmenovky: {}, menu: { nadpis: 'Menu', text: '' } };
  }
  function migruj(d) {
    const p = prazdny();
    if (!d || typeof d !== 'object') return p;
    p.id = text(d.id, 40) || p.id; p.nazev = text(d.nazev, 120) || p.nazev; p.datum = text(d.datum, 10);
    p.zmeneno = Number(d.zmeneno) || 0;
    if (d.sal) p.sal = { sirka: cislo(d.sal.sirka, 20, 3, 200), hloubka: cislo(d.sal.hloubka, 14, 3, 200) };
    p.hoste = (Array.isArray(d.hoste) ? d.hoste : []).map(normHost);
    const ids = new Set(p.hoste.map(h => h.id));
    p.hoste.forEach(h => { if (h.k && (!ids.has(h.k) || h.k === h.id)) h.k = ''; });
    p.vazby = (Array.isArray(d.vazby) ? d.vazby : []).filter(v => v && ids.has(v.a) && ids.has(v.b) && v.a !== v.b)
      .map(v => ({ id: text(v.id, 40) || novyId('v'), a: v.a, b: v.b, typ: v.typ === 'nesmi' ? 'nesmi' : 'chce' }));
    p.stoly = (Array.isArray(d.stoly) ? d.stoly : []).map(normStul);
    const stoly = Object.fromEntries(p.stoly.map(s => [s.id, s]));
    const obsazeno = new Set();
    for (const [hid, u] of Object.entries(d.usazeni || {})) {
      const s = u && stoly[u.stul], m = u && Math.round(u.misto);
      if (!ids.has(hid) || !s || !(m >= 0 && m < s.mist) || obsazeno.has(s.id + ':' + m)) continue;
      obsazeno.add(s.id + ':' + m); p.usazeni[hid] = { stul: s.id, misto: m };
    }
    if (d.jmenovky && typeof d.jmenovky === 'object') p.jmenovky = Object.assign({}, d.jmenovky);
    if (d.menu) p.menu = { nadpis: text(d.menu.nadpis, 80), text: text(d.menu.text, 3000) };
    return p;
  }

  /* ---------- jména ---------- */
  const TITULY = /^(ing|mgr|bc|mudr|judr|phdr|rndr|paeddr|mvdr|doc|prof|dr|pan|paní|pani|sl|slečna|mga|bca|ph\.d|csc|dis|mba|ll\.m|phd)\.?$/i;
  function castiJmena(jmeno) {
    return String(jmeno || '').replace(/,.*$/, '').split(/\s+/).filter(w => w && !TITULY.test(w.replace(/\.$/, '')));
  }
  function prijmeni(jmeno) { const c = castiJmena(jmeno); return c.length > 1 ? c[c.length - 1] : (c[0] || ''); }
  function krestni(jmeno) { const c = castiJmena(jmeno); return c[0] || String(jmeno || ''); }
  const porovnej = (a, b) => a.localeCompare(b, 'cs', { sensitivity: 'base' });

  /* ---------- import hostů ---------- */
  const SLOUPCE = {
    jmeno: /^(jm[eé]no|host|name|guest|cel[eé] jm[eé]no)/i, skupina: /^(skupina|group|strana|kategorie)/i,
    dieta: /^(dieta|diet|strava|menu)/i, alergie: /^(alergie|allerg)/i, dite: /^(d[ií]t[eě]|child|kid|v[eě]k)/i,
    k: /^(doprovod|partner|k |rodi[cč]|patř[ií]|with|plus)/i, poznamka: /^(pozn[aá]mka|note)/i
  };
  function rozdelRadek(r, sep) {
    if (!sep) return [r];
    const out = []; let cur = '', uv = false;
    for (let i = 0; i < r.length; i++) {
      const c = r[i];
      if (c === '"') { if (uv && r[i + 1] === '"') { cur += '"'; i++; } else uv = !uv; }
      else if (c === sep && !uv) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }
  const ano = v => /^(1|a|ano|y|yes|true|x|✓|d[ií]t[eě])$/i.test(String(v || '').trim()) || /^\d{1,2}$/.test(String(v || '').trim()) && Number(v) < 15 && Number(v) > 1;
  /* Text nebo CSV → hosté. Řádek „Jan Novák + 1“ přidá doprovod, „Jan Novák + Eva Nováková“ dvojici,
     „… + dítě Anička“ dítě. Sloupce se poznají podle hlavičky, jinak pořadí jméno;skupina;dieta;alergie;dítě;doprovod. */
  function parsujHosty(vstup, existujici) {
    const radky = String(vstup || '').replace(/^﻿/, '').split(/\r?\n/).map(r => r.trim()).filter(r => r && !r.startsWith('#'));
    if (!radky.length) return { hoste: [], chyby: [] };
    const sep = ['\t', ';', ','].find(s => radky.slice(0, 5).some(r => r.includes(s))) || '';
    let poradi = ['jmeno', 'skupina', 'dieta', 'alergie', 'dite', 'k', 'poznamka'];
    const hl = rozdelRadek(radky[0], sep);
    if (sep && hl.some(b => SLOUPCE.jmeno.test(b))) {
      poradi = hl.map(b => Object.keys(SLOUPCE).find(k => SLOUPCE[k].test(b)) || '');
      radky.shift();
    }
    const hoste = [], chyby = [], odkazy = [];
    const podleJmena = new Map((existujici || []).map(h => [bezDiakritiky(h.jmeno), h.id]));
    radky.forEach((r, i) => {
      const b = rozdelRadek(r, sep), z = {};
      poradi.forEach((k, j) => { if (k && b[j] != null && b[j] !== '') z[k] = b[j]; });
      if (!z.jmeno) { chyby.push(`řádek ${i + 1}: chybí jméno`); return; }
      const dily = z.jmeno.split(/\s+\+\s*|\s*\+\s+/).map(s => s.trim()).filter(Boolean);
      const hlavni = normHost({ jmeno: dily[0].replace(/\s*\+\s*\d*$/, ''), skupina: z.skupina, dieta: z.dieta, alergie: z.alergie, dite: ano(z.dite), poznamka: z.poznamka });
      hoste.push(hlavni); podleJmena.set(bezDiakritiky(hlavni.jmeno), hlavni.id);
      if (z.k) odkazy.push([hlavni, z.k]);
      const plus = /\+\s*(\d+)\s*$/.exec(z.jmeno);
      const dalsi = dily.slice(1);
      if (plus) for (let n = 0; n < Number(plus[1]); n++) dalsi.push('');
      dalsi.forEach(d => {
        if (/^\d+$/.test(d)) { for (let n = 0; n < Number(d); n++) dalsi.push(''); return; }
        const dite = /^(d[ií]t[eě]|syn|dcera)\s*/i.test(d);
        const jm = d.replace(/^(d[ií]t[eě]|syn|dcera)\s*/i, '').trim() || (dite ? 'Dítě' : 'Doprovod') + ' (' + hlavni.jmeno + ')';
        hoste.push(normHost({ jmeno: jm, skupina: hlavni.skupina, dite, k: hlavni.id }));
      });
    });
    for (const [h, nazev] of odkazy) {
      const id = podleJmena.get(bezDiakritiky(nazev));
      if (id && id !== h.id) h.k = id;
      else chyby.push(`„${h.jmeno}“: doprovod/rodič „${nazev}“ nenalezen`);
    }
    return { hoste, chyby };
  }

  /* ---------- geometrie stolů (metry, střed stolu = 0,0, před otočením) ---------- */
  function rozmery(s) {
    if (s.tvar === 'prvek') return { w: s.sirka, h: s.hloubka };
    if (s.tvar === 'kulaty') { const r = Math.max(0.45, s.mist * ROZESTUP / (2 * Math.PI)); return { w: 2 * r, h: 2 * r, r }; }
    const bok = s.mist - (s.cela && s.mist > 2 ? 2 : 0);
    const nahore = s.jednostranny ? bok : Math.ceil(bok / 2);
    return { w: Math.max(1, nahore) * ROZESTUP + 0.2, h: s.jednostranny ? 0.7 : 0.9 };
  }
  /* místa: {x, y, strana}; pořadí kolem stolu (nahoře zleva doprava, pravé čelo, dole zprava doleva, levé čelo) */
  function mista(s) {
    const r = rozmery(s), out = [];
    if (s.tvar === 'prvek') return out;
    if (s.tvar === 'kulaty') {
      const R = r.r + ODSTUP;
      for (let i = 0; i < s.mist; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / s.mist; out.push({ x: R * Math.cos(a), y: R * Math.sin(a), strana: 0 }); }
      return out;
    }
    const cela = s.cela && s.mist > 2 ? 2 : 0, bok = s.mist - cela;
    const nahore = s.jednostranny ? bok : Math.ceil(bok / 2), dole = bok - nahore;
    const x0 = -r.w / 2 + 0.1 + ROZESTUP / 2;
    for (let i = 0; i < nahore; i++) out.push({ x: x0 + i * ROZESTUP, y: -r.h / 2 - ODSTUP, strana: 1 });
    if (cela) out.push({ x: r.w / 2 + ODSTUP, y: 0, strana: 2 });
    for (let i = dole - 1; i >= 0; i--) out.push({ x: x0 + i * ROZESTUP + (nahore - dole) * ROZESTUP / 2, y: r.h / 2 + ODSTUP, strana: 3 });
    if (cela) out.push({ x: -r.w / 2 - ODSTUP, y: 0, strana: 4 });
    return out;
  }
  /* sousedé = vedle sebe (u kulatého dokola; u obdélníku na téže straně a čelo s rohovými místy) */
  function sousedi(s) {
    const m = mista(s), n = m.length, sous = m.map(() => []);
    if (s.tvar === 'kulaty') { if (n > 1) for (let i = 0; i < n; i++) { sous[i].push((i + 1) % n); if (n > 2) sous[i].push((i + n - 1) % n); } return sous; }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = m[i], b = m[j];
      const vedle = (a.strana === b.strana && Math.abs(a.x - b.x) < ROZESTUP * 1.01 && a.strana !== 2 && a.strana !== 4) ||
        ((a.strana === 2 || a.strana === 4 || b.strana === 2 || b.strana === 4) && a.strana !== b.strana && Math.hypot(a.x - b.x, a.y - b.y) < 1.3);
      if (vedle) { sous[i].push(j); sous[j].push(i); }
    }
    return sous;
  }
  function doSalu(s, b) {            // bod stolu → souřadnice sálu
    const a = s.uhel * Math.PI / 180, c = Math.cos(a), si = Math.sin(a);
    return { x: s.x + b.x * c - b.y * si, y: s.y + b.x * si + b.y * c };
  }
  const popisStolu = s => s.nazev || (s.hlavni ? 'Hlavní stůl' : s.tvar === 'prvek' ? 'Prvek' : 'Stůl ' + (s.cislo || '?'));
  const kapacita = p => p.stoly.reduce((a, s) => a + (s.tvar === 'prvek' ? 0 : s.mist), 0);
  function dalsiCislo(p) { return p.stoly.reduce((m, s) => Math.max(m, s.cislo || 0), 0) + 1; }
  function precisluj(p) {   // čísla stolů podle polohy (zleva doprava, shora dolů), hlavní stůl bez čísla
    const st = p.stoly.filter(s => s.tvar !== 'prvek' && !s.hlavni).sort((a, b) => Math.round(a.y) - Math.round(b.y) || a.x - b.x);
    st.forEach((s, i) => { s.cislo = i + 1; });
  }
  function rozmistiStoly(p, pocet, tvar, mist) {  // nové stoly do mřížky ve volné části sálu
    const nove = [];
    const vzor = normStul({ tvar, mist }), r = rozmery(vzor), krok = Math.max(r.w, r.h) + 2 * ODSTUP + 1.0;
    const sl = Math.max(1, Math.floor((p.sal.sirka - 1) / krok));
    for (let i = 0; i < pocet; i++) {
      const s = normStul({ tvar, mist, cislo: dalsiCislo(p), x: 0.5 + krok / 2 + (i % sl) * krok, y: 0.5 + krok / 2 + Math.floor(i / sl) * krok + (p.stoly.length ? 1 : 0) });
      p.stoly.push(s); nove.push(s);
    }
    return nove;
  }

  /* ---------- pravidla a skóre ---------- */
  /* pro každého hosta seznam párových vztahů {j, ne (trest, když nesedí u stejného stolu),
     soused (trest, když nesedí vedle), nesmi (trest, když sedí u stejného stolu), druh} */
  function vztahy(p) {
    const idx = new Map(p.hoste.map((h, i) => [h.id, i]));
    const rel = p.hoste.map(() => []);
    const pridej = (i, j, o) => { if (i == null || j == null || i === j) return; rel[i].push(Object.assign({ j }, o)); rel[j].push(Object.assign({ j: i }, o)); };
    p.hoste.forEach((h, i) => {
      if (!h.k) return;
      if (h.dite) pridej(i, idx.get(h.k), { ne: VAHY.dite, soused: VAHY.diteSoused, nesmi: 0, druh: 'dite' });
      else pridej(i, idx.get(h.k), { ne: VAHY.doprovod, soused: VAHY.doprovodSoused, nesmi: 0, druh: 'doprovod' });
    });
    for (const v of p.vazby) {
      if (v.typ === 'nesmi') pridej(idx.get(v.a), idx.get(v.b), { ne: 0, soused: 0, nesmi: VAHY.nesmi, druh: 'nesmi' });
      else pridej(idx.get(v.a), idx.get(v.b), { ne: VAHY.chce, soused: VAHY.chceSoused, nesmi: 0, druh: 'chce' });
    }
    const skup = new Map();
    p.hoste.forEach((h, i) => { if (h.skupina) { const k = bezDiakritiky(h.skupina); if (!skup.has(k)) skup.set(k, []); skup.get(k).push(i); } });
    for (const cl of skup.values()) {
      if (cl.length < 2) continue;
      const w = VAHY.skupina / (cl.length - 1);
      for (let a = 0; a < cl.length; a++) for (let b = a + 1; b < cl.length; b++) pridej(cl[a], cl[b], { ne: w, soused: 0, nesmi: 0, druh: 'skupina' });
    }
    return { rel, idx, skup };
  }

  /* globální seznam míst: stul (index), misto, sousedé (globální indexy); virtuální místa = „nerozsazen“ */
  function sit(p, pocetHostu) {
    const seats = [], start = new Map();
    p.stoly.forEach((s, si) => {
      if (s.tvar === 'prvek') return;
      start.set(s.id, seats.length);
      const sous = sousedi(s), base = seats.length;
      for (let m = 0; m < s.mist; m++) seats.push({ stul: si, sid: s.id, misto: m, sous: sous[m].map(x => base + x), rucne: s.rucne });
    });
    const real = seats.length;
    for (let i = 0; i < Math.max(0, pocetHostu - real); i++) seats.push({ stul: -1 - i, sid: '', misto: -1, sous: [], rucne: false, virt: true });
    return { seats, start, real };
  }

  function cenaPar(seats, a, b, r) {   // a, b = indexy míst
    const sa = seats[a], sb = seats[b], spolu = sa.stul === sb.stul;
    if (spolu) return r.nesmi + (r.soused && !sa.sous.includes(b) ? r.soused : 0);
    return r.ne + r.soused;
  }

  /* skóre aktuálního usazení + vysvětlení porušení (čitelné texty) */
  function skore(p) {
    const { rel, skup } = vztahy(p);
    const stoly = Object.fromEntries(p.stoly.map(s => [s.id, s]));
    const sousMap = Object.fromEntries(p.stoly.map(s => [s.id, sousedi(s)]));
    const kde = p.hoste.map(h => p.usazeni[h.id] || null);
    const poruseni = []; let celkem = 0;
    const jm = i => p.hoste[i].jmeno;
    const nazevStolu = u => u ? popisStolu(stoly[u.stul]) : 'bez místa';
    let nerozsazeno = 0;
    p.hoste.forEach((h, i) => {
      if (!kde[i]) { nerozsazeno++; celkem += VAHY.nerozsazen; }
    });
    if (nerozsazeno) poruseni.push({ druh: 'nerozsazen', body: nerozsazeno * VAHY.nerozsazen, text: `Bez místa zůstává hostů: ${nerozsazeno}`, hoste: p.hoste.filter((h, i) => !kde[i]).map(h => h.id) });
    rel.forEach((rs, i) => rs.forEach(r => {
      if (r.j < i || r.druh === 'skupina') return;
      const a = kde[i], b = kde[r.j];
      let body = 0, txt = '';
      const spolu = a && b && a.stul === b.stul, vedle = spolu && sousMap[a.stul][a.misto].includes(b.misto);
      if (!a || !b) return;     // nerozsazení už jsou započtení
      if (r.druh === 'nesmi' && spolu) { body = r.nesmi; txt = `${jm(i)} a ${jm(r.j)} nesmí sedět spolu – oba u stolu ${nazevStolu(a)}`; }
      else if (r.druh !== 'nesmi' && !spolu) {
        body = r.ne + r.soused;
        txt = r.druh === 'dite' ? `Dítě ${jm(p.hoste[i].dite && p.hoste[i].k === p.hoste[r.j].id ? i : r.j)} sedí jinde než rodič (${nazevStolu(a)} × ${nazevStolu(b)})`
          : r.druh === 'doprovod' ? `${jm(i)} a doprovod ${jm(r.j)} sedí u různých stolů (${nazevStolu(a)} × ${nazevStolu(b)})`
            : `${jm(i)} chce sedět s ${jm(r.j)}, ale sedí u různých stolů (${nazevStolu(a)} × ${nazevStolu(b)})`;
      } else if (r.soused && spolu && !vedle) {
        body = r.soused;
        txt = r.druh === 'chce' ? `${jm(i)} a ${jm(r.j)} jsou u stejného stolu, ale ne vedle sebe` : r.druh === 'dite' ? `Dítě a rodič (${jm(i)}, ${jm(r.j)}) nesedí vedle sebe` : `${jm(i)} a doprovod ${jm(r.j)} nesedí vedle sebe`;
      }
      if (body) { celkem += body; poruseni.push({ druh: r.druh, body, text: txt, hoste: [p.hoste[i].id, p.hoste[r.j].id] }); }
    }));
    for (const [, cl] of skup) {
      if (cl.length < 2) continue;
      const usaz = cl.filter(i => kde[i]);
      const poc = new Map();
      usaz.forEach(i => poc.set(kde[i].stul, (poc.get(kde[i].stul) || 0) + 1));
      if (poc.size < 2) continue;
      let par = 0; const w = VAHY.skupina / (cl.length - 1);
      const v = [...poc.values()];
      for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) par += v[a] * v[b];
      const body = Math.round(par * w * 10) / 10;
      celkem += par * w;
      poruseni.push({ druh: 'skupina', body, text: `Skupina „${p.hoste[cl[0]].skupina}“ je rozdělena na ${poc.size} stoly (${v.sort((a, b) => b - a).join(' + ')})`, hoste: usaz.map(i => p.hoste[i].id) });
    }
    poruseni.sort((a, b) => b.body - a.body);
    const pravidel = rel.reduce((a, rs, i) => a + rs.filter(r => r.j > i && r.druh !== 'skupina').length, 0);
    const porusenoPravidel = poruseni.filter(x => x.druh !== 'skupina' && x.druh !== 'nerozsazen').length;
    return { celkem: Math.round(celkem * 10) / 10, poruseni, nerozsazeno, kapacita: kapacita(p), hostu: p.hoste.length, pravidel, porusenoPravidel };
  }

  /* ---------- automatické rozsazení ---------- */
  /* Vrátí nové usazení (projekt nemění). Zamčení hosté a hosté u stolů „jen ručně“ zůstávají.
     odNuly: ostatní se nejdřív zvednou a rozsadí hladově po shlucích (doprovod, děti, skupiny). */
  function rozsad(p, o) {
    o = o || {};
    const restartu = o.restartu || 6, seed = o.seed == null ? 12345 : o.seed;
    let nej = null;
    for (let k = 0; k < restartu; k++) {
      const v = rozsad1(p, Object.assign({}, o, { seed: seed + k * 7919 }));
      if (!nej || v.cena < nej.cena) nej = v;
      if (nej.cena === 0) break;
    }
    return nej;
  }
  function rozsad1(p, o) {
    const rnd = nahoda(o.seed == null ? 12345 : o.seed);
    const n = p.hoste.length;
    const { rel } = vztahy(p);
    const { seats, start } = sit(p, n);
    const S = seats.length;
    const hostNa = new Array(S).fill(-1), mistoHosta = new Array(n).fill(-1), pevny = new Array(n).fill(false);
    p.hoste.forEach((h, i) => {
      const u = p.usazeni[h.id];
      const g = u && start.has(u.stul) ? start.get(u.stul) + u.misto : -1;
      if (g < 0) return;
      if (h.zamceny || seats[g].rucne) { pevny[i] = true; hostNa[g] = i; mistoHosta[i] = g; }
      else if (!o.odNuly) { hostNa[g] = i; mistoHosta[i] = g; }
    });
    const volna = []; for (let g = 0; g < S; g++) if (!seats[g].rucne && hostNa[g] < 0) volna.push(g);
    const pohyblivi = []; for (let i = 0; i < n; i++) if (!pevny[i]) pohyblivi.push(i);
    const dovolena = []; for (let g = 0; g < S; g++) if (!seats[g].rucne && (hostNa[g] < 0 || !pevny[hostNa[g]])) dovolena.push(g);

    // hladové usazení nerozsazených: shluky přes doprovod/děti/skupiny/chce, po stolech
    const bezMista = pohyblivi.filter(i => mistoHosta[i] < 0);
    if (bezMista.length) {
      const vBez = new Set(bezMista), poradi = [], videno = new Set();
      const priorita = r => r.druh === 'nesmi' ? -1 : r.druh === 'skupina' ? 1 : 2;
      for (const i0 of bezMista) {
        if (videno.has(i0)) continue;
        const fronta = [i0]; videno.add(i0);
        while (fronta.length) {
          const i = fronta.shift(); poradi.push(i);
          rel[i].filter(r => priorita(r) > 0 && vBez.has(r.j) && !videno.has(r.j)).sort((a, b) => priorita(b) - priorita(a))
            .forEach(r => { if (!videno.has(r.j)) { videno.add(r.j); fronta.push(r.j); } });
        }
      }
      const realna = volna.filter(g => !seats[g].virt).concat(volna.filter(g => seats[g].virt));
      poradi.forEach((i, k) => { const g = realna[k]; if (g != null) { hostNa[g] = i; mistoHosta[i] = g; } });
    }

    const cenaHosta = (i, krome) => {
      const g = mistoHosta[i];
      let c = seats[g].virt ? VAHY.nerozsazen : 0;
      for (const r of rel[i]) { if (r.j === krome) continue; c += cenaPar(seats, g, mistoHosta[r.j], r); }
      return c;
    };
    const parCena = (i, j) => { let c = 0; for (const r of rel[i]) if (r.j === j) c += cenaPar(seats, mistoHosta[i], mistoHosta[j], r); return c; };
    let cena = 0;
    for (let i = 0; i < n; i++) if (mistoHosta[i] >= 0) { cena += seats[mistoHosta[i]].virt ? VAHY.nerozsazen : 0; for (const r of rel[i]) if (r.j > i) cena += cenaPar(seats, mistoHosta[i], mistoHosta[r.j], r); }

    const iteraci = o.iteraci || Math.min(150000, Math.max(15000, n * 800));
    let T = o.T0 || 10; const Tk = 0.02, chlad = Math.pow(Tk / T, 1 / iteraci);
    let nejCena = cena, nej = mistoHosta.slice();
    if (pohyblivi.length && dovolena.length > 1) {
      for (let it = 0; it < iteraci; it++, T *= chlad) {
        const i = pohyblivi[(rnd() * pohyblivi.length) | 0];
        const g1 = mistoHosta[i], g2 = dovolena[(rnd() * dovolena.length) | 0];
        if (g1 === g2) continue;
        const j = hostNa[g2];
        if (j >= 0 && pevny[j]) continue;
        if (seats[g1].virt && seats[g2].virt) continue;
        const pred = cenaHosta(i) + (j >= 0 ? cenaHosta(j) - parCena(i, j) : 0);
        hostNa[g1] = j; hostNa[g2] = i; mistoHosta[i] = g2; if (j >= 0) mistoHosta[j] = g1;
        const po = cenaHosta(i) + (j >= 0 ? cenaHosta(j) - parCena(i, j) : 0);
        const d = po - pred;
        if (d <= 0 || rnd() < Math.exp(-d / T)) {
          cena += d;
          if (cena < nejCena - 1e-9) { nejCena = cena; nej = mistoHosta.slice(); }
        } else { hostNa[g2] = j; hostNa[g1] = i; mistoHosta[i] = g1; if (j >= 0) mistoHosta[j] = g2; }
      }
    }
    const usazeni = {};
    nej.forEach((g, i) => { if (g >= 0 && !seats[g].virt) usazeni[p.hoste[i].id] = { stul: seats[g].sid, misto: seats[g].misto }; });
    return { usazeni, cena: Math.round(nejCena * 10) / 10, iteraci };
  }

  /* posadit hosta na místo (prohodí s tím, kdo tam sedí; ten jde na původní místo nebo bez místa) */
  function posad(p, hostId, stulId, misto) {
    const kdo = Object.keys(p.usazeni).find(id => p.usazeni[id].stul === stulId && p.usazeni[id].misto === misto);
    const puvodni = p.usazeni[hostId];
    if (kdo === hostId) return;
    if (kdo) { if (puvodni) p.usazeni[kdo] = puvodni; else delete p.usazeni[kdo]; }
    p.usazeni[hostId] = { stul: stulId, misto };
  }
  function kdoSedi(p) {   // stulId → pole hostId podle míst
    const m = {};
    for (const s of p.stoly) m[s.id] = new Array(s.mist).fill(null);
    for (const [id, u] of Object.entries(p.usazeni)) if (m[u.stul]) m[u.stul][u.misto] = id;
    return m;
  }
  /* po změně počtu míst / smazání stolu vyhodit neplatná usazení */
  function uklid(p) {
    const st = Object.fromEntries(p.stoly.map(s => [s.id, s])), ids = new Set(p.hoste.map(h => h.id)), obs = new Set();
    for (const [id, u] of Object.entries(p.usazeni)) {
      const k = u.stul + ':' + u.misto;
      if (!ids.has(id) || !st[u.stul] || u.misto >= st[u.stul].mist || obs.has(k)) delete p.usazeni[id];
      else obs.add(k);
    }
    p.vazby = p.vazby.filter(v => ids.has(v.a) && ids.has(v.b));
    p.hoste.forEach(h => { if (h.k && !ids.has(h.k)) h.k = ''; });
  }

  /* ---------- seznamy pro tisk ---------- */
  function abecedne(p) {
    const st = Object.fromEntries(p.stoly.map(s => [s.id, s]));
    return p.hoste.map(h => {
      const u = p.usazeni[h.id], s = u && st[u.stul];
      return { id: h.id, jmeno: h.jmeno, klic: prijmeni(h.jmeno) + ' ' + krestni(h.jmeno), stul: s ? popisStolu(s) : '', cislo: s ? s.cislo : 0, misto: u ? u.misto + 1 : 0 };
    }).sort((a, b) => porovnej(a.klic, b.klic) || porovnej(a.jmeno, b.jmeno));
  }
  /* písmeno pro rejstřík (Ch jako samostatné) */
  function pismeno(s) { const t = String(s || '').trim(); if (/^ch/i.test(t)) return 'Ch'; return t.charAt(0).toUpperCase(); }
  function poStolech(p) {
    const kdo = kdoSedi(p), hm = Object.fromEntries(p.hoste.map(h => [h.id, h]));
    return p.stoly.filter(s => s.tvar !== 'prvek').slice().sort((a, b) => (b.hlavni - a.hlavni) || a.cislo - b.cislo || porovnej(popisStolu(a), popisStolu(b)))
      .map(s => {
        const hoste = kdo[s.id].filter(Boolean).map(id => hm[id]);
        const diety = {};
        hoste.forEach(h => { if (h.dieta) diety[h.dieta] = (diety[h.dieta] || 0) + 1; });
        return { stul: s, nazev: popisStolu(s), hoste, deti: hoste.filter(h => h.dite).length, diety };
      });
  }
  function souhrnDiet(p) {
    const d = {};
    p.hoste.forEach(h => { if (h.dieta) d[h.dieta] = (d[h.dieta] || 0) + 1; });
    return { diety: d, deti: p.hoste.filter(h => h.dite).length, alergie: p.hoste.filter(h => h.alergie).length };
  }
  function csvVystup(p) {
    const st = Object.fromEntries(p.stoly.map(s => [s.id, s])), hm = Object.fromEntries(p.hoste.map(h => [h.id, h]));
    const q = v => /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
    const rad = [['jméno', 'skupina', 'dieta', 'alergie', 'dítě', 'doprovod', 'stůl', 'místo', 'poznámka']];
    p.hoste.forEach(h => { const u = p.usazeni[h.id]; rad.push([h.jmeno, h.skupina, h.dieta, h.alergie, h.dite ? 'ano' : '', h.k && hm[h.k] ? hm[h.k].jmeno : '', u ? popisStolu(st[u.stul]) : '', u ? u.misto + 1 : '', h.poznamka]); });
    return '﻿' + rad.map(r => r.map(q).join(';')).join('\r\n');
  }

  /* ---------- rozložení na papír (mm) ---------- */
  const PAPIRY = { a4: { n: 'A4', w: 210, h: 297 }, a3: { n: 'A3', w: 297, h: 420 }, letter: { n: 'Letter', w: 215.9, h: 279.4 } };
  /* stanová jmenovka: šířka w, výška jedné poloviny h → na listu zabírá w × 2h (horní polovina vzhůru nohama) */
  function rozlozeni(o) {
    const pap = PAPIRY[o.papir] || PAPIRY.a4;
    const W = o.naSirku ? pap.h : pap.w, H = o.naSirku ? pap.w : pap.h;
    const okraj = o.okraj == null ? 8 : o.okraj, mez = o.mezera == null ? 0 : o.mezera;
    const kw = o.w, kh = o.stan === false ? o.h : 2 * o.h;
    const sl = Math.floor((W - 2 * okraj + mez) / (kw + mez)), ra = Math.floor((H - 2 * okraj + mez) / (kh + mez));
    if (sl < 1 || ra < 1) return { W, H, sloupcu: 0, radku: 0, naList: 0, pozice: [], kw, kh };
    const ox = (W - (sl * kw + (sl - 1) * mez)) / 2, oy = (H - (ra * kh + (ra - 1) * mez)) / 2;
    const pozice = [];
    for (let r = 0; r < ra; r++) for (let c = 0; c < sl; c++) pozice.push({ x: Math.round((ox + c * (kw + mez)) * 100) / 100, y: Math.round((oy + r * (kh + mez)) * 100) / 100 });
    return { W, H, sloupcu: sl, radku: ra, naList: sl * ra, pozice, kw, kh };
  }
  function listu(pocet, naList) { return naList > 0 ? Math.ceil(pocet / naList) : 0; }
  /* velikost písma (mm) tak, aby se text vešel do šířky maxW; mer(text) = šířka při písmu 1 mm */
  function velikostPisma(textJ, mer, maxW, maxH) {
    const w1 = mer(String(textJ || ' ')) || 0.5;
    return Math.max(2, Math.min(maxH, maxW / w1));
  }
  /* rozdělit dlouhé jméno na dva řádky (u mezery nejblíž středu), když je to tak čitelnější */
  function dvaRadky(jm) {
    const t = String(jm || '').trim(), mez = [];
    for (let i = 0; i < t.length; i++) if (t[i] === ' ') mez.push(i);
    if (!mez.length) return [t];
    const st = mez.reduce((a, b) => Math.abs(b - t.length / 2) < Math.abs(a - t.length / 2) ? b : a);
    return [t.slice(0, st), t.slice(st + 1)];
  }
  function textJmenovky(h, format) {
    if (format === 'krestni') return krestni(h.jmeno);
    if (format === 'bezTitulu') return castiJmena(h.jmeno).join(' ') || h.jmeno;
    return h.jmeno;
  }

  /* ---------- ukázka ---------- */
  function ukazka() {
    const p = prazdny('Svatba Jany a Petra'); p.datum = '2027-06-12';
    p.sal = { sirka: 22, hloubka: 15 };
    const txt = `jméno;skupina;dieta;alergie;dítě;doprovod
Jana Dvořáková;Novomanželé;;;;
Petr Dvořák;Novomanželé;;;;Jana Dvořáková
Marie Svobodová;Rodina nevěsty;;;;
Karel Svoboda;Rodina nevěsty;;;;Marie Svobodová
Anička Svobodová;Rodina nevěsty;dětské menu;;ano;Marie Svobodová
Tomáš Svoboda;Rodina nevěsty;;ořechy;ano;Karel Svoboda
Babička Věra;Rodina nevěsty;bezlepková;;;
Eva Dvořáková;Rodina ženicha;;;;
Josef Dvořák;Rodina ženicha;;;;Eva Dvořáková
Lucie Dvořáková;Rodina ženicha;vegetarián;;;
Martin Král;Rodina ženicha;;;;Lucie Dvořáková
Strýc Pavel;Rodina ženicha;;;;
Teta Hana;Rodina ženicha;;;;Strýc Pavel
Ing. Jiří Malý;Kolegové;;;;
Kateřina Malá;Kolegové;vegan;;;Ing. Jiří Malý
Ondřej Beneš;Kolegové;;;;
Veronika Horáková;Kolegové;;laktóza;;
Filip Černý;Přátelé;;;;
Barbora Černá;Přátelé;vegetarián;;;Filip Černý
Lukáš Procházka;Přátelé;;;;
Tereza Kučerová;Přátelé;;;;
Jakub Veselý;Přátelé;;;;
Klára Veselá;Přátelé;;;;Jakub Veselý
Michal Pokorný;Přátelé;;;;`;
    p.hoste = parsujHosty(txt).hoste;
    const id = jm => p.hoste.find(h => h.jmeno === jm).id;
    p.vazby.push({ id: novyId('v'), a: id('Strýc Pavel'), b: id('Karel Svoboda'), typ: 'nesmi' });
    p.vazby.push({ id: novyId('v'), a: id('Lukáš Procházka'), b: id('Tereza Kučerová'), typ: 'chce' });
    p.stoly.push(normStul({ tvar: 'obdelnik', mist: 6, jednostranny: true, hlavni: true, rucne: true, x: 11, y: 2 }));
    p.stoly.push(normStul({ tvar: 'prvek', nazev: 'Taneční parket', sirka: 6, hloubka: 4, x: 11, y: 7.5 }));
    p.stoly.push(normStul({ tvar: 'prvek', nazev: 'Vchod', sirka: 2, hloubka: 0.6, x: 11, y: 14.6 }));
    [[4, 5], [4, 10.5], [18, 5], [18, 10.5]].forEach(([x, y], i) => p.stoly.push(normStul({ tvar: 'kulaty', mist: 6, x, y, cislo: i + 1 })));
    p.stoly.push(normStul({ tvar: 'obdelnik', mist: 4, cela: false, x: 11, y: 12, cislo: 5 }));
    const hl = p.stoly[0];
    posad(p, id('Petr Dvořák'), hl.id, 2); posad(p, id('Jana Dvořáková'), hl.id, 3);
    p.hoste.find(h => h.jmeno === 'Petr Dvořák').zamceny = true; p.hoste.find(h => h.jmeno === 'Jana Dvořáková').zamceny = true;
    p.menu = { nadpis: 'Svatební menu', text: 'Hovězí vývar s játrovými knedlíčky\n\nSvíčková na smetaně, houskový knedlík\nalternativa: grilovaná zelenina s kuskusem\n\nSvatební dort\n\nKáva, čaj, domácí limonáda' };
    return p;
  }

  const api = {
    VERZE, VAHY, TVARY, DIETY, BARVY, PAPIRY, ROZESTUP,
    novyId, bezDiakritiky, nahoda, normHost, normStul, prazdny, migruj,
    castiJmena, prijmeni, krestni, parsujHosty, rozdelRadek,
    rozmery, mista, sousedi, doSalu, popisStolu, kapacita, dalsiCislo, precisluj, rozmistiStoly,
    vztahy, skore, rozsad, posad, kdoSedi, uklid,
    abecedne, pismeno, poStolech, souhrnDiet, csvVystup,
    rozlozeni, listu, velikostPisma, dvaRadky, textJmenovky, ukazka
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.ZasedaciJadro = api;
})();
