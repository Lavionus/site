/* Bludiště v kostce a kouli – jádro bez DOM a bez three.js (spustitelné v node).
   Parametry a jejich meze, generátor bludiště se semínkem (DFS / Wilson) na válci, v kostce a na desce,
   řešení a statistika obtížnosti, odvozené rozměry dílů, kontroly, rozmístění na podložku, projekt JSON.
   Geometrii skládá geometrie.js přes manifold-3d. */
(function () {
  'use strict';
  const VERZE_FORMATU = 1;
  const kopie = o => JSON.parse(JSON.stringify(o));
  const cislo = (x, d) => { const n = typeof x === 'string' ? parseFloat(x.replace(/\s/g, '').replace(',', '.').replace('−', '-')) : Number(x); return Number.isFinite(n) ? n : d; };
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '—';
    const k = Math.pow(10, des), r = Math.round(x * k) / k;
    return String(Object.is(r, -0) ? 0 : r).replace('.', ',').replace('-', '−');
  }
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }

  const REZIMY = {
    valec: { nazev: 'Válcová krabička', znak: '🎁', popis: 'dárková krabička – čep pouzdra vede drážkami na vnitřním válci' },
    kostka: { nazev: 'Kostka s kuličkou', znak: '🧊', popis: 'prostorové bludiště po vrstvách se zámky, kulička uvnitř' },
    deska: { nazev: 'Deska s kuličkou', znak: '▦', popis: 'plochý labyrint, víko z plexi nebo tištěné' },
  };
  const MATERIALY = {
    PLA: { nazev: 'PLA', hustota: 1.24 },
    PETG: { nazev: 'PETG', hustota: 1.27 },
    ASA: { nazev: 'ASA / ABS', hustota: 1.07 },
  };
  const OBTIZNOST = { lehka: 0.35, stredni: 0.7, tezka: 1 };

  const VYCHOZI = {
    nazev: 'Dárková krabička',
    rezim: 'valec',
    seed: 2026,
    algoritmus: 'dfs',
    obtiznost: 'tezka',
    kulicka: 3.5,       // ⌀ čepu (válec) nebo kuličky (kostka, deska)
    vule: 0.35,         // vůle na stranu
    stena: 1.6,         // stěna mezi chodbami
    material: 'PLA',
    valec: { prumer: 56, vyska: 70, hloubka: 2, stenaNadoby: 1.6, dno: 2, patka: 5, stenaPouzdra: 2, strop: 2, cep: 'kosoctverec' },
    kostka: { bunek: 5, podlaha: 1.6, okraj: 5, kolik: 2.5 },
    deska: { x: 12, y: 9, dno: 1.6, okraj: 7, viko: 'plexi', plexi: 2, ramecek: 2, kolik: 2.5 },
  };
  const ROZSAHY = {
    seed: [0, 999999999], kulicka: [1.5, 20], vule: [0, 1.5], stena: [0.6, 10],
    'valec.prumer': [20, 200], 'valec.vyska': [20, 250], 'valec.hloubka': [0.8, 6], 'valec.stenaNadoby': [0.8, 10],
    'valec.dno': [0.8, 10], 'valec.patka': [1, 30], 'valec.stenaPouzdra': [0.8, 10], 'valec.strop': [0.8, 10],
    'kostka.bunek': [2, 10], 'kostka.podlaha': [0.8, 6], 'kostka.okraj': [2, 20], 'kostka.kolik': [1.2, 8],
    'deska.x': [2, 40], 'deska.y': [2, 40], 'deska.dno': [0.8, 6], 'deska.okraj': [3, 30], 'deska.plexi': [0.5, 6],
    'deska.ramecek': [0.8, 6], 'deska.kolik': [1.2, 8],
  };
  const CELA = new Set(['seed', 'kostka.bunek', 'deska.x', 'deska.y']);
  const VYBERY = {
    rezim: Object.keys(REZIMY), algoritmus: ['dfs', 'wilson'], obtiznost: Object.keys(OBTIZNOST),
    material: Object.keys(MATERIALY), 'valec.cep': ['kosoctverec', 'valec'], 'deska.viko': ['plexi', 'tistene'],
  };

  /** Doplní chybějící hodnoty, omezí rozsahy. Vrací {p, hlaseni} – hlášení jen u změněných uložených dat. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hlaseni = [];
    const v = vstup && typeof vstup === 'object' ? vstup : {};
    if (typeof v.nazev === 'string') p.nazev = v.nazev.slice(0, 120);
    for (const [c, mozne] of Object.entries(VYBERY)) {
      const h = vezmi(v, c);
      if (h === undefined) continue;
      if (mozne.includes(h)) poloz(p, c, h); else hlaseni.push(`neznámá volba ${c} = ${h}`);
    }
    for (const [c, [a, b]] of Object.entries(ROZSAHY)) {
      const h = vezmi(v, c);
      if (h === undefined) continue;
      let n = cislo(h, NaN);
      if (!Number.isFinite(n)) { hlaseni.push(`${c}: neplatné číslo`); continue; }
      if (CELA.has(c)) n = Math.round(n);
      const o = Math.min(b, Math.max(a, n));
      if (o !== n) hlaseni.push(`${c} omezeno na ${fmt(o, 2)}`);
      poloz(p, c, o);
    }
    return { p, hlaseni };
  }

  /* ---------- náhoda se semínkem ---------- */
  function rng(seed) {
    let a = (seed >>> 0) ^ 0x9e3779b9;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const zamichej = (pole, r) => { for (let i = pole.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pole[i], pole[j]] = [pole[j], pole[i]]; } return pole; };

  /* ---------- mřížky ----------
     graf = {N, sousede(i) → [j…], start, kandidati (možné cíle), popis(i)} */
  function mrizkaValec(nC, nR) {
    return {
      N: nC * nR, nC, nR,
      sousede: i => { const c = i % nC, r = (i - c) / nC, s = [r * nC + (c + 1) % nC, r * nC + (c + nC - 1) % nC]; if (r > 0) s.push(i - nC); if (r < nR - 1) s.push(i + nC); return s; },
      start: (nR - 1) * nC,                               // horní řada, sloupec 0 – pod vstupem
      kandidati: Array.from({ length: nC }, (_, c) => c),  // spodní řada = zavřená krabička
    };
  }
  function mrizkaDeska(nx, ny) {
    return {
      N: nx * ny, nx, ny,
      sousede: i => { const x = i % nx, y = (i - x) / nx, s = []; if (x > 0) s.push(i - 1); if (x < nx - 1) s.push(i + 1); if (y > 0) s.push(i - nx); if (y < ny - 1) s.push(i + nx); return s; },
      start: 0,
      kandidati: Array.from({ length: nx * ny - 1 }, (_, i) => i + 1),
    };
  }
  function mrizkaKostka(n) {
    const n2 = n * n;
    return {
      N: n2 * n, n,
      sousede: i => {
        const x = i % n, y = Math.floor(i / n) % n, z = Math.floor(i / n2), s = [];
        if (x > 0) s.push(i - 1); if (x < n - 1) s.push(i + 1); if (y > 0) s.push(i - n); if (y < n - 1) s.push(i + n);
        if (z > 0) s.push(i - n2); if (z < n - 1) s.push(i + n2);
        return s;
      },
      start: (n - 1) * n2,                                  // horní vrstva, roh
      kandidati: Array.from({ length: n2 }, (_, i) => i),   // spodní vrstva
    };
  }

  /* ---------- generátory kostry (strom přes všechny buňky) ---------- */
  function dfs(g, r) {
    const navst = new Uint8Array(g.N), hrany = [], zasob = [g.start];
    navst[g.start] = 1;
    while (zasob.length) {
      const a = zasob[zasob.length - 1], volne = g.sousede(a).filter(b => !navst[b]);
      if (!volne.length) { zasob.pop(); continue; }
      const b = volne[Math.floor(r() * volne.length)];
      navst[b] = 1; hrany.push([a, b]); zasob.push(b);
    }
    return hrany;
  }
  /** Wilson: náhodná procházka s vymazáním smyček – rovnoměrně náhodná kostra (víc krátkých slepých uliček). */
  function wilson(g, r) {
    const ve = new Uint8Array(g.N), dalsi = new Int32Array(g.N).fill(-1), hrany = [];
    ve[g.start] = 1;
    for (const s of zamichej(Array.from({ length: g.N }, (_, i) => i), r)) {
      let u = s;
      while (!ve[u]) { const so = g.sousede(u); dalsi[u] = so[Math.floor(r() * so.length)]; u = dalsi[u]; }
      u = s;
      while (!ve[u]) { ve[u] = 1; hrany.push([u, dalsi[u]]); u = dalsi[u]; }
    }
    return hrany;
  }

  /** Bludiště: strom, vzdálenosti od startu, cíl podle obtížnosti, cesta a statistika. */
  function bludiste(g, p) {
    const r = rng(p.seed * 7919 + g.N);
    const hrany = (p.algoritmus === 'wilson' ? wilson : dfs)(g, r);
    const adj = Array.from({ length: g.N }, () => []);
    for (const [a, b] of hrany) { adj[a].push(b); adj[b].push(a); }
    const dist = new Int32Array(g.N).fill(-1), rodic = new Int32Array(g.N).fill(-1), fronta = [g.start];
    dist[g.start] = 0;
    for (let h = 0; h < fronta.length; h++) for (const b of adj[fronta[h]]) if (dist[b] < 0) { dist[b] = dist[fronta[h]] + 1; rodic[b] = fronta[h]; fronta.push(b); }
    const kand = g.kandidati.filter(i => i !== g.start).sort((a, b) => dist[a] - dist[b] || a - b);
    const cil = kand[Math.round(OBTIZNOST[p.obtiznost] * (kand.length - 1))];
    const cesta = [];
    for (let u = cil; u >= 0; u = rodic[u]) cesta.push(u);
    cesta.reverse();
    const stupen = adj.map(s => s.length);
    const slepe = stupen.filter((s, i) => s === 1 && i !== g.start && i !== cil).length;
    const rozhodnuti = cesta.filter(i => stupen[i] >= 3).length;
    return { hrany, adj, start: g.start, cil, cesta, dist, slepe, rozhodnuti, maxDist: Math.max(...dist) };
  }

  /* ---------- odvozený model ---------- */
  function model(vstup) {
    const p = normalizuj(vstup).p;
    const d = p.kulicka, v = p.vule, w = d + 2 * v, s = p.stena, pz = w + s;
    const m = { p, d, v, w, s, pz };
    if (p.rezim === 'valec') {
      const q = p.valec, Ro = q.prumer / 2, Rv = Ro - q.stenaPouzdra - v, r0 = Rv - q.hloubka, Ri = r0 - q.stenaNadoby;
      const nR = Math.floor((q.vyska - q.patka - v - q.strop) / pz), nC = Math.floor(2 * Math.PI * Rv / pz);
      Object.assign(m, { Ro, Rv, r0, Ri, Rs: Rv + v, nR, nC, H: nR * pz, alfa: 2 * Math.PI / Math.max(1, nC) });
      if (nR < 2) m.chyba = `Na výšku se vejdou jen ${Math.max(0, nR)} řady chodeb – zvětšete výšku nebo zmenšete čep, vůli či stěnu.`;
      else if (nC < 4) m.chyba = `Po obvodu se vejdou jen ${nC} sloupce chodeb – zvětšete průměr.`;
      else if (Ri < 2) m.chyba = `Uvnitř nezbývá prostor (vnitřní ⌀ ${fmt(2 * Ri)} mm) – zvětšete průměr nebo zmenšete hloubku drážek a stěny.`;
      if (m.chyba) return m;
      // zbytek výšky po celých řadách chodeb přejde do patky – zavřená krabička má zadanou výšku
      m.patka = q.vyska - m.H - v - q.strop;
      m.zavrena = q.vyska;
      m.hloubkaNadoby = m.patka + m.H - q.dno;
      m.vyskaPouzdra = m.H + v + q.strop;
      // segmenty obvodu: celistvý násobek sloupců, aby se vrcholy dílů i otočeného pouzdra kryly
      m.ks = Math.max(2, Math.ceil(Math.max(120, 2 * Math.PI * Ro / 0.7) / nC));
      m.K = m.ks * nC;
      m.g = mrizkaValec(nC, nR);
    } else if (p.rezim === 'kostka') {
      const q = p.kostka, n = q.bunek;
      const L = 2 * q.okraj + n * w + (n - 1) * s;
      const hk = Math.min(2.5, q.podlaha + w - 1.2), tv = Math.max(q.podlaha, hk + v + 0.6);   // výška kolíku zámku, tloušťka víka
      Object.assign(m, { n, L, krok: q.podlaha + w, hk, tv, Hc: n * (q.podlaha + w) + tv });
      m.g = mrizkaKostka(n);
    } else {
      const q = p.deska;
      const Lx = 2 * q.okraj + q.x * w + (q.x - 1) * s, Ly = 2 * q.okraj + q.y * w + (q.y - 1) * s;
      const prekryv = Math.min(q.okraj / 3, 3);   // jak daleko plexi zasahuje pod rám
      const hs = w, Hz = q.dno + hs + (q.viko === 'plexi' ? q.plexi : 0);
      const hk = Math.min(2.5, Hz - q.dno - v - 0.6);
      Object.assign(m, { Lx, Ly, hs, Hz, prekryv, hk, Hc: Hz + q.ramecek });
      m.g = mrizkaDeska(q.x, q.y);
      if (q.x * q.y < 3) m.chyba = 'Deska potřebuje aspoň 3 buňky.';
      if (m.chyba) return m;
    }
    m.b = bludiste(m.g, p);
    return m;
  }

  /* ---------- souřadnice buněk ---------- */
  /** Střed buňky v souřadnicích sestavy (válec: na poloměru r, výchozí = střed hloubky drážky). */
  function stredBunky(m, i, r) {
    const p = m.p;
    if (p.rezim === 'valec') {
      const c = i % m.nC, rr = (i - c) / m.nC, R = r === undefined ? (m.r0 + m.Rv) / 2 : r, a = c * m.alfa;
      return [R * Math.cos(a), R * Math.sin(a), m.patka + (rr + 0.5) * m.pz];
    }
    if (p.rezim === 'kostka') {
      const n = m.n, x = i % n, y = Math.floor(i / n) % n, z = Math.floor(i / (n * n)), o = p.kostka.okraj + m.w / 2;
      return [o + x * m.pz, o + y * m.pz, z * m.krok + p.kostka.podlaha + m.w / 2];
    }
    const nx = p.deska.x, x = i % nx, y = (i - x) / nx, o = p.deska.okraj + m.w / 2;
    return [o + x * m.pz, o + y * m.pz, p.deska.dno + m.hs / 2];
  }
  /** Lomená čára řešení v sestavě (na válci oblouky po obvodu, vstup až nad horní hranu). */
  function bodyReseni(m, r) {
    const B = m.b.cesta.map(i => stredBunky(m, i, r)), out = [];
    if (m.p.rezim !== 'valec') return B;
    const R = r === undefined ? (m.r0 + m.Rv) / 2 : r;
    const uhel = i => (i % m.nC) * m.alfa;
    for (let k = 0; k < m.b.cesta.length; k++) {
      if (k) {
        const a0 = uhel(m.b.cesta[k - 1]); let da = uhel(m.b.cesta[k]) - a0;
        if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) > 1e-9) for (let j = 1; j < 8; j++) { const a = a0 + da * j / 8; out.push([R * Math.cos(a), R * Math.sin(a), B[k][2]]); }
      }
      out.push(B[k]);
    }
    // vstup: od cíle (zavřeno) přes celou cestu k hornímu okraji – řešení vede od startu, proto vstup na začátek
    const s0 = out[0];
    out.unshift([s0[0], s0[1], m.patka + m.H + 2]);
    return out;
  }

  /* ---------- kontroly ---------- */
  function kontroly(m) {
    const H = [], p = m.p;
    const add = (uroven, text, pole, oprava) => H.push({ uroven, text, pole: pole || [], oprava });
    const cu = p.rezim === 'valec' ? 'čepu' : 'kuličky';
    if (m.chyba) { add('chyba', m.chyba, p.rezim === 'valec' ? ['valec.vyska', 'valec.prumer', 'kulicka'] : ['kulicka']); return H; }
    if (p.vule < 0.15) add('varovani', `Vůle ${fmt(p.vule, 2)} mm je pro tisk malá – ${cu} se zadře. Doporučeno 0,25–0,5 mm.`, ['vule'], { pole: 'vule', hodnota: 0.35, text: 'Vůle 0,35 mm' });
    if (p.stena < 1.2) add('varovani', `Stěna mezi chodbami ${fmt(p.stena, 2)} mm je tenká (méně než 3 tryskové dráhy 0,4 mm) – může se ulomit.`, ['stena'], { pole: 'stena', hodnota: 1.2, text: 'Stěna 1,2 mm' });
    const rozmer = p.rezim === 'valec' ? Math.max(2 * m.Ro, m.zavrena) : p.rezim === 'kostka' ? Math.max(m.L, m.Hc) : Math.max(m.Lx, m.Ly);
    if (rozmer > 220) add('varovani', `Největší rozměr ${fmt(rozmer, 0)} mm se nemusí vejít na podložku běžné tiskárny (220 mm).`, p.rezim === 'deska' ? ['deska.x', 'deska.y'] : p.rezim === 'kostka' ? ['kostka.bunek'] : ['valec.prumer', 'valec.vyska']);
    if (p.rezim === 'valec') {
      const q = p.valec;
      // nejužší místo: drážka se k ose zužuje stejně jako čep, vůle u špičky čepu klesá úměrně poloměru
      const vuleSpicka = p.vule * (m.r0 + p.vule) / m.Rv;
      if (vuleSpicka < 0.12 && p.vule >= 0.15) add('varovani', `U dna drážky klesne boční vůle čepu na ${fmt(vuleSpicka, 2)} mm – zmenšete hloubku drážky nebo zvětšete průměr.`, ['valec.hloubka', 'vule']);
      if (q.hloubka > 2.5) add('varovani', `Strop vodorovných drážek je převis ${fmt(q.hloubka, 1)} mm (tisk nastojato). Do 2,5 mm se tiskne bez podpor, hlubší drážky mohou mít strop otřepený.`, ['valec.hloubka']);
      if (q.hloubka < 1.2) add('varovani', `Drážka ${fmt(q.hloubka, 1)} mm je mělká – čep může při tlaku přeskočit stěnu.`, ['valec.hloubka'], { pole: 'valec.hloubka', hodnota: 1.6, text: 'Hloubka 1,6 mm' });
      if (q.stenaNadoby < 1.2) add('varovani', `Stěna nádoby za drážkami ${fmt(q.stenaNadoby, 1)} mm je tenká.`, ['valec.stenaNadoby']);
      if (q.stenaPouzdra < 1.2) add('varovani', `Stěna pouzdra ${fmt(q.stenaPouzdra, 1)} mm je tenká – čep se při násilí vylomí.`, ['valec.stenaPouzdra']);
      if (p.kulicka < 2.5) add('varovani', `Čep ⌀ ${fmt(p.kulicka, 1)} mm je křehký – doporučeno aspoň 3 mm.`, ['kulicka']);
      if (q.cep === 'valec') add('info', 'Kulatý čep tiskne pouzdro (dnem dolů) s převisem pod čepem; kosočtverečný čep se tiskne bez podpor.', ['valec.cep']);
      if (m.hloubkaNadoby < 3) add('chyba', 'Dno nádoby je vyšší než celá nádoba.', ['valec.dno']);
      if (m.patka - q.patka > 0.05) add('info', `${m.nR} řad chodeb; zbytek výšky (${fmt(m.patka - q.patka)} mm) přešel do patky (${fmt(m.patka)} mm).`, ['valec.vyska']);
    } else if (p.rezim === 'kostka') {
      const q = p.kostka, dira = q.kolik + 2 * p.vule;
      if (q.podlaha < 1.2) add('varovani', `Podlaha vrstvy ${fmt(q.podlaha, 1)} mm je tenká.`, ['kostka.podlaha']);
      if (dira + 1.2 > q.okraj) add('chyba', `Zámek ⌀ ${fmt(q.kolik, 1)} mm se s vůlí nevejde do okraje ${fmt(q.okraj, 1)} mm (potřeba ${fmt(dira + 1.2, 1)} mm).`, ['kostka.okraj', 'kostka.kolik'], { pole: 'kostka.okraj', hodnota: Math.ceil((dira + 1.2) * 10) / 10, text: `Okraj ${fmt(Math.ceil((dira + 1.2) * 10) / 10)} mm` });
      if (q.bunek >= 8) add('info', `Kostka ${q.bunek}³ = ${m.g.N} buněk – výpočet geometrie chvíli trvá.`, ['kostka.bunek']);
      add('info', 'Víko i vrstvy lze tisknout z průhledného PETG – kulička je pak vidět. Okénko ve víku = start, okénko ve dně = cíl.', []);
    } else {
      const q = p.deska, dira = q.kolik + 2 * p.vule;
      const pas = q.viko === 'plexi' ? q.okraj - m.prekryv - p.vule : q.okraj;
      if (dira + 1.2 > pas) add('chyba', `Zámek víka ⌀ ${fmt(q.kolik, 1)} mm se s vůlí nevejde do rámu (volný pás ${fmt(pas, 1)} mm, potřeba ${fmt(dira + 1.2, 1)} mm).`, ['deska.okraj', 'deska.kolik']);
      if (q.dno < 1.2) add('varovani', `Dno ${fmt(q.dno, 1)} mm je tenké.`, ['deska.dno']);
      if (q.viko === 'plexi') add('info', `Plexi deska: ${fmt(m.Lx - 2 * q.okraj + 2 * m.prekryv, 1)} × ${fmt(m.Ly - 2 * q.okraj + 2 * m.prekryv, 1)} × ${fmt(q.plexi, 1)} mm (vyřízněte nebo nechte nařezat), drží ji tištěný rámeček.`, ['deska.plexi']);
    }
    if (m.b) {
      const pomer = m.b.cesta.length / m.g.N;
      if (pomer < 0.08) add('info', `Řešení vede jen přes ${fmt(100 * pomer, 0)} % buněk – pro těžší hádanku zvolte obtížnost Těžká nebo jiné semínko.`, ['obtiznost', 'seed']);
    }
    if (!H.some(h => h.uroven === 'chyba' || h.uroven === 'varovani')) add('ok', 'Geometrie je v pořádku – chodby jsou průchozí a díly do sebe pasují s vůlí.', []);
    return H;
  }

  /* ---------- tisk a export ---------- */
  function obal(P) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
    return b;
  }
  /** Díly do tiskové polohy (převrácení podle `prevratit`) a vedle sebe na podložku, z = 0, bez překryvu. */
  function rozmisti(dily, mezera = 8, sirkaPodlozky = 220) {
    const polohy = dily.map(d => {
      const P = new Float32Array(d.poz);
      if (d.prevratit) for (let i = 0; i < P.length; i += 3) { P[i + 1] = -P[i + 1]; P[i + 2] = -P[i + 2]; }   // 180° kolem X
      return { d, P, b: obal(P) };
    });
    let x = 0, y = 0, radek = 0;
    return polohy.map(({ d, P, b }) => {
      const sx = b[3] - b[0], sy = b[4] - b[1];
      if (x > 0 && x + sx > sirkaPodlozky) { x = 0; y += radek + mezera; radek = 0; }
      const dx = x - b[0], dy = y - b[1], dz = -b[2];
      for (let i = 0; i < P.length; i += 3) { P[i] += dx; P[i + 1] += dy; P[i + 2] += dz; }
      x += sx + mezera; radek = Math.max(radek, sy);
      return Object.assign({}, d, { poz: P });
    });
  }
  /** Hrubý odhad: hmotnost plného dílu, filament 1,75 mm, doba tisku (stěny + 20 % výplně, ~ 8 mm³/s). */
  function odhadTisku(objem, plocha, material) {
    const mat = MATERIALY[material] || MATERIALY.PLA;
    const skorepina = Math.min(objem, plocha * 1.2);              // 3 obvody / vrstvy po 0,4 mm
    const tisk = skorepina + 0.2 * Math.max(0, objem - skorepina); // mm³ skutečně vytištěno
    return { gramy: tisk / 1000 * mat.hustota, metry: tisk / (Math.PI * 0.875 * 0.875) / 1000, hodiny: tisk / 8 / 3600 * 1.25 };
  }

  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_bludiste3d', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== 'webapp_bludiste3d') throw new Error('Soubor není projekt bludiště (chybí "format": "webapp_bludiste3d").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const PREDVOLBY = [
    { nazev: 'Dárková krabička ⌀ 56', popis: 'na prstýnek nebo srolovanou bankovku, čep 3,5 mm',
      p: { rezim: 'valec', kulicka: 3.5, vule: 0.35, stena: 1.6, obtiznost: 'tezka', algoritmus: 'dfs', valec: { prumer: 56, vyska: 70, hloubka: 2 } } },
    { nazev: 'Velká krabička ⌀ 80 × 100', popis: 'na peníze nebo vstupenky, Wilson = hodně slepých uliček',
      p: { rezim: 'valec', kulicka: 4, vule: 0.4, stena: 2, obtiznost: 'tezka', algoritmus: 'wilson', valec: { prumer: 80, vyska: 100, hloubka: 2.2, stenaPouzdra: 2.4 } } },
    { nazev: 'Malá hádanka ⌀ 40', popis: 'lehká, rychle vytištěná',
      p: { rezim: 'valec', kulicka: 3, vule: 0.3, stena: 1.4, obtiznost: 'lehka', algoritmus: 'dfs', valec: { prumer: 40, vyska: 45, hloubka: 1.6, patka: 4 } } },
    { nazev: 'Kostka 4 × 4 × 4, kulička 6 mm', popis: 'ložisková kulička ⌀ 6, střední obtížnost',
      p: { rezim: 'kostka', kulicka: 6, vule: 0.4, stena: 1.6, obtiznost: 'stredni', algoritmus: 'dfs', kostka: { bunek: 4, podlaha: 1.6, okraj: 5, kolik: 2.5 } } },
    { nazev: 'Kostka 6 × 6 × 6, kulička 5 mm', popis: 'těžká, víc vrstev',
      p: { rezim: 'kostka', kulicka: 5, vule: 0.35, stena: 1.4, obtiznost: 'tezka', algoritmus: 'wilson', kostka: { bunek: 6, podlaha: 1.4, okraj: 5, kolik: 2.5 } } },
    { nazev: 'Deska 12 × 9, plexi 2 mm', popis: 'kulička ⌀ 8, víko z plexi s tištěným rámečkem',
      p: { rezim: 'deska', kulicka: 8, vule: 0.5, stena: 2, obtiznost: 'tezka', algoritmus: 'dfs', deska: { x: 12, y: 9, okraj: 8, viko: 'plexi', plexi: 2 } } },
    { nazev: 'Kapesní deska 8 × 8', popis: 'kulička ⌀ 4, tištěné víko (průhledné PETG)',
      p: { rezim: 'deska', kulicka: 4, vule: 0.35, stena: 1.4, obtiznost: 'stredni', algoritmus: 'wilson', deska: { x: 8, y: 8, okraj: 5, viko: 'tistene', ramecek: 1.6, kolik: 2 } } },
  ];
  /** Předvolba přes výchozí hodnoty (zachová název a semínko projektu). */
  function predvolba(i, puvodni) {
    const v = PREDVOLBY[i], q = kopie(VYCHOZI);
    for (const k of Object.keys(v.p)) { if (typeof v.p[k] === 'object') Object.assign(q[k], v.p[k]); else q[k] = v.p[k]; }
    q.nazev = v.nazev; if (puvodni) q.seed = puvodni.seed;
    return normalizuj(q).p;
  }

  const API = {
    VERZE_FORMATU, REZIMY, MATERIALY, OBTIZNOST, VYCHOZI, ROZSAHY, PREDVOLBY, predvolba, kopie, cislo, fmt, vezmi, poloz,
    normalizuj, rng, mrizkaValec, mrizkaDeska, mrizkaKostka, dfs, wilson, bludiste, model, stredBunky, bodyReseni,
    kontroly, obal, rozmisti, odhadTisku, ulozProjekt, nactiProjekt,
  };
  if (typeof module !== 'undefined') module.exports = API; else window.BLUD = API;
})();
