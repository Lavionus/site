/* jadro.js – geometrie pro povrch3d.html (bez DOM, testuje se v node).

   Průběh výpočtu výsledku:
     1. načtení (STL/OBJ/3MF) → „polévka“ trojúhelníků → svaření vrcholů,
     2. rozdělení na plochy: sousední trojúhelníky se slučují, dokud úhel
        jejich normál nepřekročí práh (válec = jedna plocha, víčko druhá),
     3. hrany = řetězce ostrých hran mezi dvojicí ploch,
     4. sražení / zaoblení: síť se nejdřív rozřízne rovinami rovnoběžnými
        s hranou (tečná čára a řady oblouku), pak se každý vrchol v dosahu
        promítne na zaoblení. Zaoblení = „kutálená koule“: vrchol se promítne
        na těleso zmenšené o poloměr (průnik poloprostorů stěn) a z něj se
        posune zpět o poloměr. Rohy, kde se potká víc hran, tak vyjdou samy
        (kulový roh), a funguje to i pro vyduté hrany (počítá se se
        vzduchem místo materiálu),
     5. struktura: vybrané plochy se zjemní půlením nejdelší hrany (síť
        zůstává bez T-spojů), pak se každý vrchol posune po normále podle
        výškové mapy vzoru. Vrcholy na hranici plochy a v sražení stojí,
        takže síť zůstane uzavřená.
   Síť se celou dobu drží jako indexovaná a těsná: dělení hrany se vždy
   promítne do obou trojúhelníků, které ji sdílejí. */
/* Modul je pojmenovaná funkce: stránka z jejího textu (toString) sestaví
   Web Worker i při otevření ze souboru (file://), kde nejde stáhnout skript. */
function povrchJadro(G) {
  'use strict';

  /* ---------- vektory (pole [x, y, z]) ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const len = a => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);   // Math.hypot je ve V8 několikrát pomalejší
  const norm = a => { const l = len(a); return l > 1e-300 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };

  /* =====================================================================
     NAČTENÍ
     ===================================================================== */
  /* STL: textové poznáme podle „solid … facet … vertex“, jinak binární.
     Binární s useknutým koncem (přerušený přenos) se načte po poslední celý
     trojúhelník a počet chybějících se poznamená v .useknuto. */
  function parseSTL(buf) {
    const u8 = new Uint8Array(buf);
    const zacatek = new TextDecoder().decode(u8.subarray(0, Math.min(u8.length, 1024)));
    const textove = /^\s*solid/i.test(zacatek) && /facet|vertex/i.test(zacatek);
    if (!textove && buf.byteLength >= 84) {
      const dv = new DataView(buf);
      const n = dv.getUint32(80, true);
      const k = Math.min(n, Math.floor((buf.byteLength - 84) / 50));
      if (k > 0) {
        const out = new Float32Array(k * 9);
        for (let i = 0; i < k; i++) {
          const o = 84 + i * 50 + 12;
          for (let q = 0; q < 9; q++) out[i * 9 + q] = dv.getFloat32(o + q * 4, true);
        }
        if (k < n) out.useknuto = n - k;
        return out;
      }
    }
    const text = new TextDecoder().decode(u8);
    const re = /vertex\s+([-+\d.eE]+|nan|inf)\s+([-+\d.eE]+|nan|inf)\s+([-+\d.eE]+|nan|inf)/gi;
    const v = [];
    let m;
    while ((m = re.exec(text))) v.push(+m[1], +m[2], +m[3]);
    if (!v.length) throw new Error('Soubor nevypadá jako STL.');
    return new Float32Array(v.slice(0, v.length - v.length % 9));
  }

  function parseOBJ(text) {
    const v = [], out = [];
    for (const radek of text.split(/\r?\n/)) {
      const s = radek.trim();
      // oddělovač může být mezera i tabulátor
      if (/^v\s/.test(s)) { const q = s.split(/\s+/); v.push([+q[1], +q[2], +q[3]]); }
      else if (/^f\s/.test(s)) {
        const idx = s.split(/\s+/).slice(1).map(t => { const i = parseInt(t, 10); return i < 0 ? v.length + i : i - 1; });
        for (let k = 1; k + 1 < idx.length; k++) {
          const a = v[idx[0]], b = v[idx[k]], c = v[idx[k + 1]];
          if (a && b && c) out.push(...a, ...b, ...c);
        }
      }
    }
    if (!out.length) throw new Error('V souboru OBJ nejsou žádné plochy.');
    return new Float32Array(out);
  }

  /* 3MF = ZIP s XML. Čte se centrální adresář, „deflate“ rozbalí
     DecompressionStream (v prohlížeči i v node 18+). */
  async function rozbalZip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let e = buf.byteLength - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Poškozený ZIP.');
    const pocet = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const soubory = {};
    for (let i = 0; i < pocet; i++) {
      const metoda = dv.getUint16(p + 10, true), vel = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), kl = dv.getUint16(p + 32, true);
      const lh = dv.getUint32(p + 42, true);
      const jmeno = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + xl + kl;
      const d0 = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true);
      const data = u8.subarray(d0, d0 + vel);
      soubory[jmeno] = { metoda, data };
    }
    const nacti = async jm => {
      const s = soubory[jm];
      if (s.metoda === 0) return s.data;
      if (s.metoda !== 8) throw new Error('Nepodporovaná komprese v 3MF.');
      const ds = new Blob([s.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(ds).arrayBuffer());
    };
    return { jmena: Object.keys(soubory), nacti };
  }
  async function parse3MF(buf) {
    const z = await rozbalZip(buf);
    const modely = z.jmena.filter(j => /\.model$/i.test(j));
    if (!modely.length) throw new Error('V 3MF není žádný model.');
    const out = [];
    for (const jm of modely) {
      const xml = new TextDecoder().decode(await z.nacti(jm));
      // objekty se sítí; transformace položek sestavy (build item) se použijí
      const objekty = new Map();
      const reObj = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
      let m;
      while ((m = reObj.exec(xml))) {
        const id = (m[1].match(/\bid="(\d+)"/) || [])[1];
        const telo = m[2];
        const vv = [];
        const reV = /<vertex\b[^>]*?x="([^"]+)"[^>]*?y="([^"]+)"[^>]*?z="([^"]+)"/g;
        let q;
        while ((q = reV.exec(telo))) vv.push([+q[1], +q[2], +q[3]]);
        const tt = [];
        const reT = /<triangle\b[^>]*?v1="(\d+)"[^>]*?v2="(\d+)"[^>]*?v3="(\d+)"/g;
        while ((q = reT.exec(telo))) tt.push([+q[1], +q[2], +q[3]]);
        const komp = [];
        const reK = /<component\b([^>]*)\/?>/g;
        while ((q = reK.exec(telo))) komp.push({ id: (q[1].match(/objectid="(\d+)"/) || [])[1], t: matice(q[1]) });
        objekty.set(id, { vv, tt, komp });
      }
      const vloz = (id, M, hloubka) => {
        const o = objekty.get(id);
        if (!o || hloubka > 8) return;
        for (const t of o.tt) for (const k of t) { const p = o.vv[k]; if (p) out.push(...transformuj(M, p)); else return; }
        for (const k of o.komp) vloz(k.id, nasob(M, k.t), hloubka + 1);
      };
      const polozky = [...xml.matchAll(/<item\b([^>]*)\/?>/g)];
      if (polozky.length) for (const it of polozky) vloz((it[1].match(/objectid="(\d+)"/) || [])[1], matice(it[1]), 0);
      else for (const id of objekty.keys()) vloz(id, null, 0);
    }
    if (!out.length) throw new Error('Model v 3MF neobsahuje trojúhelníky.');
    return new Float32Array(out);
  }
  function matice(attr) {
    const m = attr.match(/transform="([^"]+)"/);
    if (!m) return null;
    const v = m[1].trim().split(/\s+/).map(Number);
    return v.length === 12 ? v : null;
  }
  function transformuj(M, p) {
    if (!M) return p;
    return [p[0] * M[0] + p[1] * M[3] + p[2] * M[6] + M[9], p[0] * M[1] + p[1] * M[4] + p[2] * M[7] + M[10], p[0] * M[2] + p[1] * M[5] + p[2] * M[8] + M[11]];
  }
  function nasob(A, B) {           // nejdřív B (vnořená komponenta), pak A
    if (!A) return B; if (!B) return A;
    const r = new Array(12);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      let s = i === 3 ? A[9 + j] : 0;
      for (let k = 0; k < 3; k++) s += B[i * 3 + k] * A[k * 3 + j];
      r[i * 3 + j] = s;
    }
    return r;
  }

  async function nactiSoubor(jmeno, buf) {
    const pr = (jmeno.split('.').pop() || '').toLowerCase();
    if (pr === 'stl') return parseSTL(buf);
    if (pr === 'obj') return parseOBJ(new TextDecoder().decode(new Uint8Array(buf)));
    if (pr === '3mf') return parse3MF(buf);
    throw new Error('Podporované formáty jsou STL, OBJ a 3MF.');
  }

  /* Svaření „polévky“ na indexovanou síť; degenerované trojúhelníky pryč. */
  /* Svaření „polévky“ na indexovanou síť; degenerované trojúhelníky pryč.
     Tolerance se bere z rozměru „většiny“ modelu (1.–99. percentil), aby jeden
     ulétlý vrchol (poškozený soubor) nezvětšil toleranci tak, že by se celý
     model slil do bodu. Trojúhelníky s neplatnými nebo hrubě ulétlými
     souřadnicemi se vyhodí – jejich počet je ve .vyhozeno. */
  function svar(soup) {
    const nV = soup.length / 3;
    const krok = Math.max(1, Math.floor(nV / 30000));
    const osy = [[], [], []];
    for (let i = 0; i < nV; i += krok) for (let k = 0; k < 3; k++) { const c = soup[3 * i + k]; if (isFinite(c)) osy[k].push(c); }
    const lo = [], hi = [];
    for (let k = 0; k < 3; k++) {
      const a = osy[k].sort((x, y) => x - y);
      lo.push(a.length ? a[Math.floor(a.length * 0.01)] : 0);
      hi.push(a.length ? a[Math.min(a.length - 1, Math.floor(a.length * 0.99))] : 0);
    }
    const diag = Math.max(1e-9, len(sub(hi, lo)));
    const okraj = diag * 100;            // dál než 100× rozměr modelu = nesmysl
    const platny = i => {
      for (let k = 0; k < 3; k++) { const c = soup[i + k]; if (!isFinite(c) || c < lo[k] - okraj || c > hi[k] + okraj) return false; }
      return true;
    };
    const tol = Math.max(1e-9, diag * 1e-7);
    const mapa = new Map(), pos = [], tri = [];
    let vyhozeno = 0;
    const id = i => {
      const k = Math.round(soup[i] / tol) + ',' + Math.round(soup[i + 1] / tol) + ',' + Math.round(soup[i + 2] / tol);
      let v = mapa.get(k);
      if (v === undefined) { v = pos.length / 3; pos.push(soup[i], soup[i + 1], soup[i + 2]); mapa.set(k, v); }
      return v;
    };
    for (let i = 0; i < soup.length; i += 9) {
      if (!platny(i) || !platny(i + 3) || !platny(i + 6)) { vyhozeno++; continue; }
      const a = id(i), b = id(i + 3), c = id(i + 6);
      if (a !== b && b !== c && a !== c) tri.push(a, b, c);
    }
    return { pos: Float64Array.from(pos), tri: Uint32Array.from(tri), vyhozeno };
  }

  /* =====================================================================
     ZJEDNODUŠENÍ SÍTĚ (slučování hran podle kvadrik – Garland & Heckbert)
     Hrana s nejmenší chybou se stáhne do bodu (konec nebo střed). Okraje
     otevřených sítí a hrany sdílené víc než dvěma trojúhelníky zůstávají;
     stažení, které by porušilo topologii (podmínka spojení) nebo převrátilo
     trojúhelník, se přeskočí – uzavřená síť zůstane uzavřená.
     ===================================================================== */
  function zjednodus(pos0, tri0, cil, prubeh) {
    const nV = pos0.length / 3, nT0 = tri0.length / 3;
    const pos = Float64Array.from(pos0), tri = Int32Array.from(tri0);
    const ziva = new Uint8Array(nT0).fill(1), zivy = new Uint8Array(nV).fill(1), verze = new Int32Array(nV);
    let nT = nT0;
    // vrchol → trojúhelníky
    const okolo = Array.from({ length: nV }, () => []);
    for (let t = 0; t < nT0; t++) for (let k = 0; k < 3; k++) okolo[tri[3 * t + k]].push(t);
    // kvadriky (a² ab ac ad b² bc bd c² cd d²), váha = plocha
    const Q = new Float64Array(nV * 10);
    for (let t = 0; t < nT0; t++) {
      const a = P(pos, tri[3 * t]), b = P(pos, tri[3 * t + 1]), c = P(pos, tri[3 * t + 2]);
      const n = cross(sub(b, a), sub(c, a)), l = len(n);
      if (l < 1e-20) continue;
      const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l, d = -(nx * a[0] + ny * a[1] + nz * a[2]), w = l / 2;
      const q = [nx * nx, nx * ny, nx * nz, nx * d, ny * ny, ny * nz, ny * d, nz * nz, nz * d, d * d];
      for (let k = 0; k < 3; k++) { const o = 10 * tri[3 * t + k]; for (let i = 0; i < 10; i++) Q[o + i] += q[i] * w; }
    }
    // okrajové a nejednoznačné hrany → jejich vrcholy se nehýbou
    const hrany = new Map();
    for (let t = 0; t < nT0; t++) for (let k = 0; k < 3; k++) { const kk = klic(tri[3 * t + k], tri[3 * t + (k + 1) % 3]); hrany.set(kk, (hrany.get(kk) || 0) + 1); }
    const pevny = new Uint8Array(nV);
    for (const [kk, n] of hrany) if (n !== 2) { pevny[Math.floor(kk / KL)] = 1; pevny[kk % KL] = 1; }
    const chyba = (q, x, y, z) => q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y + q[7] * z * z + 2 * q[8] * z + q[9];
    // halda (min) nad hranami: cena, vrcholy, verze vrcholů v době výpočtu
    let hc = new Float64Array(1 << 16), ha = new Int32Array(1 << 16), hb = new Int32Array(1 << 16), hva = new Int32Array(1 << 16), hvb = new Int32Array(1 << 16), hn = 0;
    const nahoru = i => { while (i > 0) { const p = (i - 1) >> 1; if (hc[p] <= hc[i]) break; prohod(i, p); i = p; } };
    const dolu = i => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hn && hc[l] < hc[m]) m = l; if (r < hn && hc[r] < hc[m]) m = r; if (m === i) break; prohod(i, m); i = m; } };
    const prohod = (i, j) => { for (const A of [hc, ha, hb, hva, hvb]) { const t = A[i]; A[i] = A[j]; A[j] = t; } };
    const q = new Float64Array(10);
    const cilovyBod = (a, b) => {
      for (let i = 0; i < 10; i++) q[i] = Q[10 * a + i] + Q[10 * b + i];
      const kand = pevny[a] ? [a] : pevny[b] ? [b] : null;
      let best = Infinity, bx = 0, by = 0, bz = 0;
      const zkus = (x, y, z) => { const e = chyba(q, x, y, z); if (e < best) { best = e; bx = x; by = y; bz = z; } };
      if (kand) zkus(pos[3 * kand[0]], pos[3 * kand[0] + 1], pos[3 * kand[0] + 2]);
      else {
        zkus(pos[3 * a], pos[3 * a + 1], pos[3 * a + 2]); zkus(pos[3 * b], pos[3 * b + 1], pos[3 * b + 2]);
        zkus((pos[3 * a] + pos[3 * b]) / 2, (pos[3 * a + 1] + pos[3 * b + 1]) / 2, (pos[3 * a + 2] + pos[3 * b + 2]) / 2);
      }
      return [best, bx, by, bz];
    };
    const vloz = (a, b) => {
      if (pevny[a] && pevny[b]) return;
      if (hn === hc.length) {
        const r = A => { const n = new A.constructor(A.length * 2); n.set(A); return n; };
        hc = r(hc); ha = r(ha); hb = r(hb); hva = r(hva); hvb = r(hvb);
      }
      hc[hn] = cilovyBod(a, b)[0]; ha[hn] = a; hb[hn] = b; hva[hn] = verze[a]; hvb[hn] = verze[b];
      nahoru(hn++);
    };
    for (const [kk, n] of hrany) if (n === 2) vloz(Math.floor(kk / KL), kk % KL);
    hrany.clear();
    const sousede = v => { const s = new Set(); for (const t of okolo[v]) if (ziva[t]) for (let k = 0; k < 3; k++) if (tri[3 * t + k] !== v) s.add(tri[3 * t + k]); return s; };
    const normala = (t, v, x, y, z) => {
      const p = [0, 1, 2].map(k => { const i = tri[3 * t + k]; return i === v ? [x, y, z] : P(pos, i); });
      return cross(sub(p[1], p[0]), sub(p[2], p[0]));
    };
    let kroku = 0;
    while (nT > cil && hn > 0) {
      const a0 = ha[0], b0 = hb[0], va = hva[0], vb = hvb[0];
      hn--; if (hn > 0) { for (const A of [hc, ha, hb, hva, hvb]) A[0] = A[hn]; dolu(0); }
      if (!zivy[a0] || !zivy[b0] || verze[a0] !== va || verze[b0] !== vb) continue;
      // b se stáhne do a (pevný vrchol zůstává na místě)
      let a = a0, b = b0;
      if (pevny[b] && !pevny[a]) { a = b0; b = a0; }
      const [, x, y, z] = cilovyBod(a, b);
      const spolecne = okolo[a].filter(t => ziva[t] && (tri[3 * t] === b || tri[3 * t + 1] === b || tri[3 * t + 2] === b));
      if (spolecne.length !== 2) continue;
      // podmínka spojení: společní sousedé jen dva (protější vrcholy)
      const sa = sousede(a), sb = sousede(b);
      let spol = 0;
      for (const w of sa) if (sb.has(w)) spol++;
      if (spol !== 2) continue;
      // žádný trojúhelník se nesmí převrátit ani zdegenerovat
      let ok = true;
      for (const v of [a, b]) {
        for (const t of okolo[v]) {
          if (!ziva[t] || spolecne.includes(t)) continue;
          const n0 = normala(t, -1, 0, 0, 0), n1 = normala(t, v, x, y, z);
          const l0 = len(n0), l1 = len(n1);
          if (l1 < l0 * 1e-3 || dot(n0, n1) < 0.2 * l0 * l1) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (!ok) continue;
      // provést
      for (const t of spolecne) { ziva[t] = 0; nT--; }
      for (const t of okolo[b]) {
        if (!ziva[t]) continue;
        for (let k = 0; k < 3; k++) if (tri[3 * t + k] === b) tri[3 * t + k] = a;
        okolo[a].push(t);
      }
      okolo[a] = okolo[a].filter(t => ziva[t]);
      okolo[b] = [];
      zivy[b] = 0;
      pos[3 * a] = x; pos[3 * a + 1] = y; pos[3 * a + 2] = z;
      for (let i = 0; i < 10; i++) Q[10 * a + i] += Q[10 * b + i];
      verze[a]++;
      for (const w of sousede(a)) vloz(a, w);
      if (prubeh && ++kroku % 20000 === 0) prubeh(1 - (nT - cil) / Math.max(1, nT0 - cil));
    }
    // zhustit
    const mapa = new Int32Array(nV).fill(-1), np = [], nt = [];
    for (let t = 0; t < nT0; t++) if (ziva[t]) for (let k = 0; k < 3; k++) {
      const v = tri[3 * t + k];
      if (mapa[v] < 0) { mapa[v] = np.length / 3; np.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]); }
      nt.push(mapa[v]);
    }
    return { pos: Float64Array.from(np), tri: Uint32Array.from(nt) };
  }

  /* =====================================================================
     ROZBOR SÍTĚ: plochy, hrany, řetězce
     ===================================================================== */
  const hashBunky = (i, j, k) => ((i * 73856093) ^ (j * 19349663) ^ (k * 83492791)) | 0;
  const KL = 67108864;                       // klíč hrany = a·KL + b (a < b)
  const klic = (a, b) => a < b ? a * KL + b : b * KL + a;

  function normalyTri(pos, tri) {
    const n = tri.length / 3, N = new Float64Array(n * 3), A = new Float64Array(n);
    for (let t = 0; t < n; t++) {
      const a = tri[3 * t] * 3, b = tri[3 * t + 1] * 3, c = tri[3 * t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
      const l = Math.hypot(x, y, z);
      A[t] = l / 2;
      if (l > 0) { N[3 * t] = x / l; N[3 * t + 1] = y / l; N[3 * t + 2] = z / l; }
    }
    return { N, A };
  }

  function mapaHran(tri) {
    const m = new Map();
    for (let t = 0; t < tri.length / 3; t++) for (let k = 0; k < 3; k++) {
      const a = tri[3 * t + k], b = tri[3 * t + (k + 1) % 3];
      const kk = klic(a, b);
      const e = m.get(kk);
      if (e) e.push(t); else m.set(kk, [t]);
    }
    return m;
  }

  function priprav(sit, uhelStup) {
    const { pos, tri } = sit;
    const nT = tri.length / 3;
    const { N, A } = normalyTri(pos, tri);
    const hrany = mapaHran(tri);
    const cosPrah = Math.cos(uhelStup * Math.PI / 180);
    // plochy: union-find přes hladké hrany
    const rodic = new Int32Array(nT).map((_, i) => i);
    const najdi = i => { while (rodic[i] !== i) { rodic[i] = rodic[rodic[i]]; i = rodic[i]; } return i; };
    let otevrene = 0, nemanif = 0;
    for (const [, ts] of hrany) {
      if (ts.length === 1) { otevrene++; continue; }
      if (ts.length > 2) { nemanif++; continue; }
      const [p, q] = ts;
      const c = N[3 * p] * N[3 * q] + N[3 * p + 1] * N[3 * q + 1] + N[3 * p + 2] * N[3 * q + 2];
      if (c >= cosPrah) { const a = najdi(p), b = najdi(q); if (a !== b) rodic[a] = b; }
    }
    const oblast = new Int32Array(nT);
    const koreny = new Map(), oblasti = [];
    for (let t = 0; t < nT; t++) {
      const r = najdi(t);
      let id = koreny.get(r);
      if (id === undefined) { id = oblasti.length; koreny.set(r, id); oblasti.push({ id, tri: [], plocha: 0 }); }
      oblast[t] = id;
      oblasti[id].tri.push(t);
      oblasti[id].plocha += A[t];
    }
    for (const o of oblasti) popisOblast(o, pos, tri, N, A);

    // ostré hrany → řetězce podle dvojice ploch a návaznosti
    const segmenty = [];
    for (const [kk, ts] of hrany) {
      if (ts.length !== 2) continue;
      const [p, q] = ts;
      if (oblast[p] === oblast[q]) continue;
      const a = Math.floor(kk / KL), b = kk % KL;
      // p je trojúhelník, ve kterém jde hrana a→b (orientace)
      let tA = p, tB = q;
      if (!maOrientovanouHranu(tri, p, a, b)) { tA = q; tB = p; }
      segmenty.push({ a, b, tA, tB, rA: oblast[tA], rB: oblast[tB], konvexni: jeKonvexni(pos, tri, N, tA, tB, a, b) });
    }
    const retezy = slozRetezy(segmenty, pos);
    let objem = 0;
    for (let t = 0; t < nT; t++) {
      const a = tri[3 * t] * 3, b = tri[3 * t + 1] * 3, c = tri[3 * t + 2] * 3;
      objem += (pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
        - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
        + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c])) / 6;
    }
    const box = obal(pos);
    return { pos, tri, N, A, oblast, oblasti, retezy, otevrene, nemanif, objem, box, uhel: uhelStup };
  }
  function maOrientovanouHranu(tri, t, a, b) {
    for (let k = 0; k < 3; k++) if (tri[3 * t + k] === a && tri[3 * t + (k + 1) % 3] === b) return true;
    return false;
  }
  function tretiVrchol(tri, t, a, b) {
    for (let k = 0; k < 3; k++) { const v = tri[3 * t + k]; if (v !== a && v !== b) return v; }
    return -1;
  }
  const P = (pos, i) => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
  const Nt = (N, t) => [N[3 * t], N[3 * t + 1], N[3 * t + 2]];
  function jeKonvexni(pos, tri, N, tA, tB, a, b) {
    const c = tretiVrchol(tri, tB, a, b);
    return dot(sub(P(pos, c), P(pos, a)), Nt(N, tA)) < 0;
  }
  function obal(pos) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
      if (pos[i + k] < mn[k]) mn[k] = pos[i + k];
      if (pos[i + k] > mx[k]) mx[k] = pos[i + k];
    }
    return { min: mn, max: mx, rozmer: sub(mx, mn), uhlopricka: len(sub(mx, mn)) };
  }

  /* Popis plochy: průměrná normála, zda je rovinná / válcová, osa válce. */
  function popisOblast(o, pos, tri, N, A) {
    let n = [0, 0, 0], c = [0, 0, 0];
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const t of o.tri) {
      const w = A[t], nt = Nt(N, t);
      n = add(n, mul(nt, w));
      const s = mul(add(add(P(pos, tri[3 * t]), P(pos, tri[3 * t + 1])), P(pos, tri[3 * t + 2])), 1 / 3);
      c = add(c, mul(s, w));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += w * nt[i] * nt[j];
    }
    const W = o.plocha || 1;
    o.stred = mul(c, 1 / W);
    o.normala = norm(n);
    let maxOdch = 0;
    for (const t of o.tri) maxOdch = Math.max(maxOdch, Math.acos(Math.min(1, Math.max(-1, dot(Nt(N, t), o.normala)))));
    o.rovinna = maxOdch < 3 * Math.PI / 180;
    o.tvar = o.rovinna ? 'rovina' : 'obecna';
    if (!o.rovinna) {
      const { vlastniCisla, vektory } = jacobi(C.map(r => r.map(v => v / W)));
      const iMin = vlastniCisla.indexOf(Math.min(...vlastniCisla));
      let k = vektory[iMin];
      if (k[2] < 0 || (k[2] === 0 && k[1] < 0)) k = mul(k, -1);
      let maxK = 0;
      for (const t of o.tri) maxK = Math.max(maxK, Math.abs(dot(Nt(N, t), k)));
      if (maxK < 0.26) {                       // normály kolmé k ose → válec
        // osa: bod, kterým procházejí přímky normál (nejmenší čtverce v rovině ⊥ k)
        const e1 = norm(Math.abs(k[0]) < 0.9 ? cross(k, [1, 0, 0]) : cross(k, [0, 1, 0]));
        const e2 = cross(k, e1);
        let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
        for (const t of o.tri) {
          const s = mul(add(add(P(pos, tri[3 * t]), P(pos, tri[3 * t + 1])), P(pos, tri[3 * t + 2])), 1 / 3);
          const nt = Nt(N, t);
          const nx = dot(nt, e1), ny = dot(nt, e2), l = Math.hypot(nx, ny) || 1;
          const ux = nx / l, uy = ny / l;
          const px = dot(s, e1), py = dot(s, e2);
          const w = A[t];
          // (I - u uᵀ)(c - p) = 0
          const m11 = 1 - ux * ux, m12 = -ux * uy, m22 = 1 - uy * uy;
          a11 += w * m11; a12 += w * m12; a22 += w * m22;
          b1 += w * (m11 * px + m12 * py); b2 += w * (m12 * px + m22 * py);
        }
        const det = a11 * a22 - a12 * a12;
        if (Math.abs(det) > 1e-12 * (a11 + a22) * (a11 + a22)) {
          const cx = (b1 * a22 - b2 * a12) / det, cy = (a11 * b2 - a12 * b1) / det;
          const st = add(add(mul(e1, cx), mul(e2, cy)), mul(k, dot(o.stred, k)));
          let r = 0, uhly = [];
          for (const t of o.tri) {
            const s = mul(add(add(P(pos, tri[3 * t]), P(pos, tri[3 * t + 1])), P(pos, tri[3 * t + 2])), 1 / 3);
            const d = sub(s, st);
            r += A[t] * Math.hypot(dot(d, e1), dot(d, e2));
            uhly.push(Math.atan2(dot(d, e2), dot(d, e1)));
          }
          uhly.sort((x, y) => x - y);
          let mezera = uhly.length ? uhly[0] + 2 * Math.PI - uhly[uhly.length - 1] : 7;
          for (let i = 1; i < uhly.length; i++) mezera = Math.max(mezera, uhly[i] - uhly[i - 1]);
          o.tvar = 'valec';
          o.osa = k; o.osaBod = st; o.e1 = e1; o.e2 = e2; o.polomer = r / W;
          o.uzavreny = mezera < 0.6;
        }
      }
    }
  }
  function jacobi(S) {
    const a = S.map(r => r.slice()), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 50; it++) {
      let p = 0, q = 1, m = Math.abs(a[0][1]);
      if (Math.abs(a[0][2]) > m) { p = 0; q = 2; m = Math.abs(a[0][2]); }
      if (Math.abs(a[1][2]) > m) { p = 1; q = 2; m = Math.abs(a[1][2]); }
      if (m < 1e-14) break;
      const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
      const c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
    return { vlastniCisla: [a[0][0], a[1][1], a[2][2]], vektory: [0, 1, 2].map(j => [v[0][j], v[1][j], v[2][j]]) };
  }

  /* Řetězce: segmenty se stejnou dvojicí ploch, spojené přes vrcholy. */
  function slozRetezy(seg, pos) {
    const skup = new Map();
    seg.forEach((s, i) => {
      const k = Math.min(s.rA, s.rB) + ':' + Math.max(s.rA, s.rB);
      if (!skup.has(k)) skup.set(k, []);
      skup.get(k).push(i);
    });
    const retezy = [];
    for (const [, idx] of skup) {
      const podleV = new Map();
      for (const i of idx) for (const v of [seg[i].a, seg[i].b]) { if (!podleV.has(v)) podleV.set(v, []); podleV.get(v).push(i); }
      const hotovo = new Set();
      for (const i0 of idx) {
        if (hotovo.has(i0)) continue;
        const komp = [], fronta = [i0];
        hotovo.add(i0);
        while (fronta.length) {
          const i = fronta.pop(); komp.push(i);
          for (const v of [seg[i].a, seg[i].b]) for (const j of podleV.get(v)) if (!hotovo.has(j)) { hotovo.add(j); fronta.push(j); }
        }
        let delka = 0, konv = 0;
        for (const i of komp) {
          delka += len(sub(P(pos, seg[i].a), P(pos, seg[i].b)));
          konv += seg[i].konvexni ? 1 : -1;
        }
        retezy.push({ id: retezy.length, segmenty: komp.map(i => seg[i]), rA: seg[i0].rA, rB: seg[i0].rB, delka, konvexni: konv >= 0 });
      }
    }
    return retezy;
  }

  /* =====================================================================
     PRACOVNÍ SÍŤ s průběžnou mapou hran (dělení bez T-spojů)
     ===================================================================== */
  class Sit {
    /* Pole rostou zdvojením (typovaná pole místo běžných polí JS zaberou
       zhruba čtvrtinu paměti a jsou rychlejší). */
    constructor(pos, tri, puvod) {
      const nV = pos.length / 3, nT = tri.length / 3;
      this.nV = nV; this.nT = nT; this.nZ = nT;
      this.p = new Float64Array(Math.max(16, nV * 2) * 3); this.p.set(pos);
      this.t = new Uint32Array(Math.max(16, nT * 2) * 3); this.t.set(tri);
      this.o = new Int32Array(Math.max(16, nT * 2));
      if (puvod) this.o.set(puvod); else for (let i = 0; i < nT; i++) this.o[i] = i;
      this.zivy = new Uint8Array(Math.max(16, nT * 2)); this.zivy.fill(1, 0, nT);
      this._hranyInit(Math.max(1024, nT * 4));
      for (let i = 0; i < nT; i++) this._registruj(i);
    }
    get pocetV() { return this.nV; }
    get pocetT() { return this.nT; }
    bod(i) { return [this.p[3 * i], this.p[3 * i + 1], this.p[3 * i + 2]]; }
    pridejV(x, y, z) {
      if ((this.nV + 1) * 3 > this.p.length) { const n = new Float64Array(this.p.length * 2); n.set(this.p); this.p = n; }
      const i = this.nV++;
      this.p[3 * i] = x; this.p[3 * i + 1] = y; this.p[3 * i + 2] = z;
      return i;
    }
    /* Mapa hran → trojúhelníky: typovaná hašovací tabulka s otevřeným
       adresováním (klíč = dvojice vrcholů a < b, nejvýš dva trojúhelníky;
       třetí a další u nemanifoldních hran v `hX`). Map s číselnými klíči
       a·KL + b (mimo malá celá čísla) byla nejpomalejší částí zjemnění. */
    _hranyInit(min) {
      let vel = 1024; while (vel < min * 2) vel *= 2;
      this.hA = new Int32Array(vel).fill(-1);        // -1 prázdno, -2 smazáno
      this.hB = new Int32Array(vel);
      this.h1 = new Int32Array(vel); this.h2 = new Int32Array(vel);
      this.hMaska = vel - 1; this.hPlno = 0; this.hX = null;
    }
    _hSlot(a, b) {
      const A = this.hA, B = this.hB, m = this.hMaska;
      let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) & m;
      while (A[h] !== -1) { if (A[h] === a && B[h] === b) return h; h = (h + 1) & m; }
      return -1 - h;                                  // nenalezeno: -1 - první prázdné místo
    }
    _hRozsir() {
      const A = this.hA, B = this.hB, T1 = this.h1, T2 = this.h2, n = A.length;
      let zive = 0; for (let i = 0; i < n; i++) if (A[i] >= 0) zive++;
      this._hranyInit(Math.max(zive * 2, n / 4));
      const hX = this.hX;
      for (let i = 0; i < n; i++) if (A[i] >= 0) {
        const s = -1 - this._hSlot(A[i], B[i]);
        this.hA[s] = A[i]; this.hB[s] = B[i]; this.h1[s] = T1[i]; this.h2[s] = T2[i]; this.hPlno++;
      }
      this.hX = hX;
    }
    _hPridej(a, b, ti) {
      if (a > b) { const x = a; a = b; b = x; }
      let s = this._hSlot(a, b);
      if (s >= 0) {
        if (this.h1[s] < 0) this.h1[s] = ti;
        else if (this.h2[s] < 0) this.h2[s] = ti;
        else { if (!this.hX) this.hX = new Map(); const k = a * KL + b, l = this.hX.get(k); if (l) l.push(ti); else this.hX.set(k, [ti]); }
        return;
      }
      if ((this.hPlno + 1) * 2 > this.hA.length) { this._hRozsir(); s = this._hSlot(a, b); }
      s = -1 - s;
      this.hA[s] = a; this.hB[s] = b; this.h1[s] = ti; this.h2[s] = -1; this.hPlno++;
    }
    _hOdeber(a, b, ti) {
      if (a > b) { const x = a; a = b; b = x; }
      const s = this._hSlot(a, b);
      if (s < 0) return;
      const k = a * KL + b, l = this.hX && this.hX.get(k);
      if (l) {
        const i = l.indexOf(ti);
        if (i >= 0) { l.splice(i, 1); if (!l.length) this.hX.delete(k); return; }
      }
      const nahrada = l && l.length ? l.pop() : -1;
      if (l && !l.length) this.hX.delete(k);
      if (this.h1[s] === ti) { this.h1[s] = this.h2[s]; this.h2[s] = nahrada; }
      else if (this.h2[s] === ti) this.h2[s] = nahrada;
      if (this.h1[s] < 0) this.hA[s] = -2;            // smazáno (sondování jde přes ně dál)
    }
    _registruj(ti) {
      const t = this.t, a = t[3 * ti], b = t[3 * ti + 1], c = t[3 * ti + 2];
      this._hPridej(a, b, ti); this._hPridej(b, c, ti); this._hPridej(c, a, ti);
    }
    _odregistruj(ti) {
      const t = this.t, a = t[3 * ti], b = t[3 * ti + 1], c = t[3 * ti + 2];
      this._hOdeber(a, b, ti); this._hOdeber(b, c, ti); this._hOdeber(c, a, ti);
    }
    trojuhelnikyHrany(kk) {
      const a = Math.floor(kk / KL), b = kk % KL, s = this._hSlot(a, b);
      if (s < 0 || this.h1[s] < 0) return [];
      const r = [this.h1[s]];
      if (this.h2[s] >= 0) r.push(this.h2[s]);
      const l = this.hX && this.hX.get(kk);
      if (l) for (const x of l) r.push(x);
      return r;
    }
    pridejT(a, b, c, o) {
      if (this.nT + 1 > this.o.length) {
        const k = this.o.length * 2;
        const t = new Uint32Array(k * 3); t.set(this.t); this.t = t;
        const oo = new Int32Array(k); oo.set(this.o); this.o = oo;
        const z = new Uint8Array(k); z.set(this.zivy); this.zivy = z;
      }
      const ti = this.nT++;
      this.t[3 * ti] = a; this.t[3 * ti + 1] = b; this.t[3 * ti + 2] = c; this.o[ti] = o; this.zivy[ti] = 1; this.nZ++;
      this._registruj(ti);
      if (this.mm) this._doMrizky(ti);
      return ti;
    }
    /* Prostorová mřížka trojúhelníků (podle obalového kvádru) – řezy pro
       sražení pak nemusí procházet celou síť. Nové trojúhelníky se do ní
       vkládají samy; zrušené se odfiltrují při dotazu. */
    zapniMrizku(h) {
      this.mh = h; this.mm = new Map();
      for (let ti = 0; ti < this.pocetT; ti++) if (this.zivy[ti]) this._doMrizky(ti);
    }
    _bunky(mn, mx, f) {
      const h = this.mh;
      const i0 = Math.floor(mn[0] / h), i1 = Math.floor(mx[0] / h), j0 = Math.floor(mn[1] / h), j1 = Math.floor(mx[1] / h);
      const k0 = Math.floor(mn[2] / h), k1 = Math.floor(mx[2] / h);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) f(hashBunky(i, j, k));
    }
    _doMrizky(ti) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let q = 0; q < 3; q++) {
        const v = this.t[3 * ti + q];
        for (let k = 0; k < 3; k++) { const c = this.p[3 * v + k]; if (c < mn[k]) mn[k] = c; if (c > mx[k]) mx[k] = c; }
      }
      this._bunky(mn, mx, key => { const l = this.mm.get(key); if (l) l.push(ti); else this.mm.set(key, [ti]); });
    }
    vOblasti(mn, mx) {
      const out = new Set();
      this._bunky(mn, mx, key => { const l = this.mm.get(key); if (l) for (const ti of l) if (this.zivy[ti]) out.add(ti); });
      return out;
    }
    zrus(ti) { if (!this.zivy[ti]) return; this._odregistruj(ti); this.zivy[ti] = 0; this.nZ--; }

    /* Rozdělí hrany podle mapy klíč → index nového vrcholu (bod na hraně).
       Každý dotčený trojúhelník se přetrojúhelníkuje; obě strany hrany
       dostanou stejný vrchol, takže nevznikne T-spoj. */
    rozdel(deleni) {
      const dotcene = new Set();
      for (const kk of deleni.keys()) for (const ti of this.trojuhelnikyHrany(kk)) dotcene.add(ti);
      for (const ti of dotcene) {
        if (!this.zivy[ti]) continue;
        const v = [this.t[3 * ti], this.t[3 * ti + 1], this.t[3 * ti + 2]];
        const s = [0, 1, 2].map(k => deleni.get(klic(v[k], v[(k + 1) % 3])));
        const o = this.o[ti];
        const n = s.filter(x => x !== undefined).length;
        if (!n) continue;
        this.zrus(ti);
        if (n === 3) {
          const [p, q, r] = s;
          this.pridejT(v[0], p, r, o); this.pridejT(p, v[1], q, o);
          this.pridejT(r, q, v[2], o); this.pridejT(p, q, r, o);
          continue;
        }
        if (n === 1) {
          const k = s.findIndex(x => x !== undefined);
          const a = v[k], b = v[(k + 1) % 3], c = v[(k + 2) % 3], m = s[k];
          this.pridejT(a, m, c, o); this.pridejT(m, b, c, o);
          continue;
        }
        // dvě dělené hrany: otočit tak, aby nedělená byla c→a
        const k = s.findIndex(x => x === undefined);      // nedělená hrana k: v[k]→v[k+1]
        const a = v[(k + 1) % 3], b = v[(k + 2) % 3], c = v[k];
        const p = s[(k + 1) % 3], q = s[(k + 2) % 3];     // p na a→b, q na b→c
        this.pridejT(p, b, q, o);
        // čtyřúhelník a, p, q, c: úhlopříčka, po které oba trojúhelníky zachovají
        // orientaci (u nekonvexního čtyřúhelníku – řez těsně u vrcholu – by
        // kratší úhlopříčka dala trojúhelník přeložený naruby); z platných kratší
        const A = this.bod(a), Pp = this.bod(p), Q = this.bod(q), C = this.bod(c);
        const n0 = cross(sub(this.bod(b), A), sub(C, A));
        const kladny = (x, y, z) => dot(cross(sub(y, x), sub(z, x)), n0) > 0;
        const v1 = kladny(A, Pp, Q) && kladny(A, Q, C), v2 = kladny(A, Pp, C) && kladny(Pp, Q, C);
        const prvni = v1 && v2 ? len(sub(A, Q)) <= len(sub(Pp, C)) : v1 || !v2 && len(sub(A, Q)) <= len(sub(Pp, C));
        if (prvni) { this.pridejT(a, p, q, o); this.pridejT(a, q, c, o); }
        else { this.pridejT(a, p, c, o); this.pridejT(p, q, c, o); }
      }
    }

    /* Zjemnění půlením nejdelší hrany (Rivara): označí se hrany podle
       `delit(a, b, delka)`; trojúhelník s označenou hranou si vždy rozpůlí
       i svou nejdelší, takže tvar trojúhelníků zůstává rozumný. */
    zjemni(delit, maxKol, limitT, kandidat) {
      // Podmínka dělení závisí jen na hraně a jejím původním trojúhelníku:
      // trojúhelník, který kolo přežil beze změny, se už dělit nebude –
      // další kola tedy procházejí jen nově vzniklé (indexy od `od`).
      let od = 0;
      for (let kolo = 0; kolo < (maxKol || 40); kolo++) {
        const oznac = new Set();
        const nT = this.pocetT;
        for (let ti = od; ti < nT; ti++) {
          if (!this.zivy[ti] || (kandidat && !kandidat(ti))) continue;
          for (let k = 0; k < 3; k++) {
            const a = this.t[3 * ti + k], b = this.t[3 * ti + (k + 1) % 3];
            const kk = klic(a, b);
            if (oznac.has(kk)) continue;
            if (delit(a, b, this._delka(a, b), ti)) oznac.add(kk);
          }
        }
        if (!oznac.size) return true;
        // šíření na nejdelší hranu
        const fronta = [];
        for (const kk of oznac) for (const ti of this.trojuhelnikyHrany(kk)) fronta.push(ti);
        while (fronta.length) {
          const ti = fronta.pop();
          const kk = this._nejdelsi(ti);
          if (!oznac.has(kk)) { oznac.add(kk); for (const tj of this.trojuhelnikyHrany(kk)) fronta.push(tj); }
        }
        const deleni = new Map();
        for (const kk of oznac) {
          const a = Math.floor(kk / KL), b = kk % KL;
          deleni.set(kk, this.pridejV((this.p[3 * a] + this.p[3 * b]) / 2, (this.p[3 * a + 1] + this.p[3 * b + 1]) / 2, (this.p[3 * a + 2] + this.p[3 * b + 2]) / 2));
        }
        od = this.pocetT;
        this.rozdel(deleni);
        if (limitT && this.pocetZivych() > limitT * 1.3) return false;
      }
      return true;
    }
    _delka(a, b) {
      const p = this.p;
      const x = p[3 * a] - p[3 * b], y = p[3 * a + 1] - p[3 * b + 1], z = p[3 * a + 2] - p[3 * b + 2];
      return Math.sqrt(x * x + y * y + z * z);
    }
    _nejdelsi(ti) {
      let best = -1, kk = 0;
      for (let k = 0; k < 3; k++) {
        const a = this.t[3 * ti + k], b = this.t[3 * ti + (k + 1) % 3];
        const d = this._delka(a, b);
        // shodné délky: rozhodne klíč, aby obě strany hrany zvolily stejně
        const kl = klic(a, b);
        if (d > best + 1e-12 || (Math.abs(d - best) <= 1e-12 && kl < kk)) { best = d; kk = kl; }
      }
      return kk;
    }
    pocetZivych() { return this.nZ; }

    /* Výstup: typovaná pole jen s živými trojúhelníky. */
    vystup() {
      const nT = this.pocetZivych();
      const tri = new Uint32Array(nT * 3), puvod = new Int32Array(nT);
      let j = 0;
      for (let ti = 0; ti < this.pocetT; ti++) {
        if (!this.zivy[ti]) continue;
        tri[3 * j] = this.t[3 * ti]; tri[3 * j + 1] = this.t[3 * ti + 1]; tri[3 * j + 2] = this.t[3 * ti + 2];
        puvod[j++] = this.o[ti];
      }
      return { pos: this.p.slice(0, this.nV * 3), tri, puvod };
    }
  }

  /* =====================================================================
     SRAŽENÍ A ZAOBLENÍ HRAN
     ===================================================================== */
  /* Pro každý segment vybraných řetězců připraví geometrii: body, směr,
     normály stěn, směry „do stěny“, odstup tečné čáry. */
  function pripravSegmenty(model, operace) {
    const { pos, tri, N } = model;
    const out = [];
    for (const [rid, op] of operace) {
      const r = model.retezy[rid];
      if (!r || !(op.velikost > 0)) continue;
      for (const s of r.segmenty) {
        const P0 = P(pos, s.a), P1 = P(pos, s.b);
        const L = len(sub(P1, P0));
        if (L < 1e-12) continue;
        const d = mul(sub(P1, P0), 1 / L);
        let nA = Nt(N, s.tA), nB = Nt(N, s.tB);
        const cosF = Math.max(-1, Math.min(1, dot(nA, nB)));
        const fi = Math.acos(cosF);                         // úhel mezi normálami
        if (fi < 2 * Math.PI / 180) continue;               // skoro rovné – nic
        const konv = s.konvexni;
        // směry do stěn: kolmo na hranu, v rovině stěny, od hrany
        const cA = P(pos, tretiVrchol(tri, s.tA, s.a, s.b)), cB = P(pos, tretiVrchol(tri, s.tB, s.a, s.b));
        let a = norm(cross(nA, d)); if (dot(a, sub(cA, P0)) < 0) a = mul(a, -1);
        let b = norm(cross(nB, d)); if (dot(b, sub(cB, P0)) < 0) b = mul(b, -1);
        // vydutá hrana: počítá se se vzduchem → otočené normály
        if (!konv) { nA = mul(nA, -1); nB = mul(nB, -1); }
        const fiC = Math.min(fi, 170 * Math.PI / 180);
        const R = op.velikost;
        const t = op.typ === 'zaobl' ? R * Math.tan(fiC / 2) : R;   // odstup tečné čáry
        // dílky oblouku: kolik chce uživatel, ale dílek ne kratší než 0,05 mm
        // (menší tiskárna nerozliší a síť by zbytečně narostla)
        const M = op.typ === 'zaobl' ? Math.max(1, Math.min(Math.ceil((op.segmenty || 8) / 2), Math.ceil(R * fiC / 0.1))) : 1;
        out.push({ rid, op, P0, P1, L, d, nA, nB, a, b, cA: dot(nA, P0), cB: dot(nB, P0), fi: fiC, t, R, M, konv, rA: s.rA, rB: s.rB, va: s.a, vb: s.b, i: out.length });
      }
    }
    /* Rohy, kde se potkají hrany s různou úpravou (jiný poloměr nebo
       zaoblení × sražení): větší úprava se k takovému rohu plynule zúží na
       nejmenší z nich (při různém typu na nulu) na délce 2× šířka úpravy.
       V rohu pak mají všechny hrany stejnou úpravu a hladce se potkají –
       průsečnice dvou různých zaoblení by v síti nebyla a plochy by se
       prořízly. */
    {
      const uVrcholu = new Map();
      for (const q of out) for (const v of [q.va, q.vb]) { if (!uVrcholu.has(v)) uVrcholu.set(v, []); uVrcholu.get(v).push(q); }
      const konflikty = [];
      for (const [v, l] of uVrcholu) {
        const typy = new Set(l.map(q => q.op.typ)), Rs = new Set(l.map(q => q.R));
        if (typy.size === 1 && Rs.size === 1) continue;
        konflikty.push({ bod: P(pos, v), Rmin: typy.size > 1 ? 0 : Math.min(...l.map(q => q.R)) });
      }
      for (const q of out) {
        q.Ltr = 2 * q.t;
        q.konf = konflikty.filter(c => c.Rmin < q.R && vzdalenostKSegmentu(c.bod, q) < q.Ltr + q.t);
      }
    }
    // příliš velká úprava: odstup tečné čáry přes půl stěny (sražení/zaoblení
    // z protější hrany se potkají a stěna zmizí)
    const rozsah = (rid, P0, smer) => {
      const o = model.oblasti[rid];
      if (!o._vrcholy) {
        const vv = new Set();
        const krok = Math.max(1, Math.floor(o.tri.length / 4000));
        for (let i = 0; i < o.tri.length; i += krok) for (let k = 0; k < 3; k++) vv.add(tri[3 * o.tri[i] + k]);
        o._vrcholy = [...vv];
      }
      let m = 0;
      for (const v of o._vrcholy) m = Math.max(m, dot(sub(P(pos, v), P0), smer));
      return m;
    };
    for (const s of out) {
      s.prilis = s.t > 0.5 * rozsah(s.rA, s.P0, s.a) + 1e-9 || s.t > 0.5 * rozsah(s.rB, s.P0, s.b) + 1e-9;
    }
    // návaznost: přesah řezu za konec segmentu podle zatočení řetězce
    const podleV = new Map();
    for (const s of out) for (const v of [s.va, s.vb]) { if (!podleV.has(v)) podleV.set(v, []); podleV.get(v).push(s); }
    for (const s of out) {
      s.ext = [s.t, s.t];
      [s.va, s.vb].forEach((v, k) => {
        for (const q of podleV.get(v)) {
          if (q === s || q.rid !== s.rid) continue;
          const c = Math.abs(dot(q.d, s.d));
          const uhel = Math.acos(Math.min(1, c));
          if (uhel < 35 * Math.PI / 180) s.ext[k] = Math.min(s.t, s.t * Math.tan(uhel / 2) * 1.3 + s.t * 0.02);
        }
      });
    }
    return out;
  }

  const krokZaobleni = s => s.op.typ === 'zaobl' ? s.t / s.M * 1.6 : s.t * 0.75;
  /* Odhad počtu trojúhelníků, které přidá sražení/zaoblení (pásy podél hran
     a kulové rohy). Kalibrováno na kostkách a válcích. */
  function odhadZaobleni(segs) {
    let n = 0;
    const vRohu = new Map();
    for (const s of segs) {
      const krok = krokZaobleni(s);
      const podel = Math.max(krok, Math.min(Math.max(krok * 6, s.t * 2), s.L * 1.5));
      n += Math.ceil(s.L / podel) * Math.ceil(3 * s.t / krok) * 2;
      for (const v of [s.va, s.vb]) vRohu.set(v, Math.max(vRohu.get(v) || 0, Math.pow(2 * s.t / krok, 2) * 2));
    }
    for (const [, k] of vRohu) n += k;
    return n * ODHAD_ZAOBLENI;
  }
  let ODHAD_ZAOBLENI = 5;            // vzorec podhodnocuje 1,4–7,7× (rohy, okolí pásů)

  /* Řezy: v každé ze dvou stěn segmentu se síť rozřízne rovinami
     rovnoběžnými s hranou ve vzdálenostech s (tečná čára + řady oblouku). */
  function odstupyRad(s) {
    if (s.op.typ !== 'zaobl') return [s.t];
    const M = s.M;
    const r = [];
    for (let k = 0; k < M; k++) {
      const beta = (s.fi / 2) * k / M;
      r.push(s.t - s.R * Math.tan(beta));
    }
    return r.filter(v => v > s.t * 0.02);
  }

  function rozrizni(sit, model, segs, tol) {
    const oblastT = ti => model.oblast[sit.o[ti]];
    let maxT = 0;
    for (const s of segs) maxT = Math.max(maxT, s.t);
    sit.zapniMrizku(Math.max(maxT * 3, model.box.uhlopricka / 200));
    for (const s of segs) {
      for (const strana of [0, 1]) {
        const reg = strana ? s.rB : s.rA;
        const n = strana ? s.nB : s.nA, c = strana ? s.cB : s.cA, smer = strana ? s.b : s.a;
        const n2 = strana ? s.nA : s.nB, c2 = strana ? s.cA : s.cB;
        const sign = s.konv ? 1 : -1;     // normála stěny skutečná (pro „leží v rovině“)
        const r = s.t + Math.max(s.ext[0], s.ext[1]) + tol;
        const mn = [0, 1, 2].map(k => Math.min(s.P0[k], s.P1[k]) - r), mx = [0, 1, 2].map(k => Math.max(s.P0[k], s.P1[k]) + r);
        for (const odst of odstupyRad(s)) {
          const k0 = dot(smer, s.P0) + odst;      // rovina řezu: smer·x = k0
          const deleni = new Map();
          for (const ti of sit.vOblasti(mn, mx)) {
            if (oblastT(ti) !== reg) continue;
            // rychlé síto: trojúhelník musí rovinu protínat
            let mn = Infinity, mx = -Infinity;
            for (let k = 0; k < 3; k++) {
              const v = sit.t[3 * ti + k];
              const d = smer[0] * sit.p[3 * v] + smer[1] * sit.p[3 * v + 1] + smer[2] * sit.p[3 * v + 2] - k0;
              if (d < mn) mn = d; if (d > mx) mx = d;
            }
            if (mn > -tol || mx < tol) continue;
            for (let k = 0; k < 3; k++) {
              const va = sit.t[3 * ti + k], vb = sit.t[3 * ti + (k + 1) % 3];
              const kk = klic(va, vb);
              if (deleni.has(kk)) continue;
              const A = sit.bod(va), B = sit.bod(vb);
              const da = dot(smer, A) - k0, db = dot(smer, B) - k0;
              if (!((da < -tol && db > tol) || (da > tol && db < -tol))) continue;
              const u = da / (da - db);
              const X = add(A, mul(sub(B, A), u));
              // bod musí ležet v rovině stěny, v pásu segmentu a uvnitř tělesa
              if (Math.abs(sign * (dot(n, X) - c)) > tol * 4) continue;
              const pr = dot(sub(X, s.P0), s.d);
              if (pr < -s.ext[0] - tol || pr > s.L + s.ext[1] + tol) continue;
              if (dot(n2, X) - c2 > tol * 4) continue;
              deleni.set(kk, sit.pridejV(X[0], X[1], X[2]));
            }
          }
          if (deleni.size) sit.rozdel(deleni);
        }
      }
    }
  }

  /* Promítnutí bodu na průnik poloprostorů {x: n·x ≤ c} – výčtem aktivních
     množin (stačí pro pár rovin, je přesné). Vrací null, je-li prázdný. */
  function promitni(v, roviny, tol) {
    const uvnitr = x => roviny.every(r => dot(r.n, x) - r.c <= tol);
    if (uvnitr(v)) return v;
    let best = null, bd = Infinity;
    const zkus = x => { if (x && uvnitr(x)) { const d = len(sub(x, v)); if (d < bd) { bd = d; best = x; } } };
    const R = roviny.length;
    for (let i = 0; i < R; i++) {
      const r = roviny[i];
      zkus(sub(v, mul(r.n, dot(r.n, v) - r.c)));
    }
    for (let i = 0; i < R; i++) for (let j = i + 1; j < R; j++) zkus(naDvou(v, roviny[i], roviny[j]));
    if (R >= 3 && R <= 12) for (let i = 0; i < R; i++) for (let j = i + 1; j < R; j++) for (let k = j + 1; k < R; k++) zkus(naTrech(roviny[i], roviny[j], roviny[k]));
    return best;
  }
  function naDvou(v, r1, r2) {
    const g12 = dot(r1.n, r2.n);
    const det = 1 - g12 * g12;
    if (det < 1e-10) return null;
    const e1 = dot(r1.n, v) - r1.c, e2 = dot(r2.n, v) - r2.c;
    const l1 = (e1 - g12 * e2) / det, l2 = (e2 - g12 * e1) / det;
    return sub(sub(v, mul(r1.n, l1)), mul(r2.n, l2));
  }
  function naTrech(r1, r2, r3) {
    const c23 = cross(r2.n, r3.n);
    const det = dot(r1.n, c23);
    if (Math.abs(det) < 1e-8) return null;
    const x = add(add(mul(c23, r1.c), mul(cross(r3.n, r1.n), r2.c)), mul(cross(r1.n, r2.n), r3.c));
    return mul(x, 1 / det);
  }

  /* Prostorová mřížka segmentů – rychlé hledání segmentů v dosahu bodu. */
  function mrizkaSegmentu(segs) {
    let maxT = 0;
    for (const s of segs) maxT = Math.max(maxT, s.t);
    const h = Math.max(maxT * 2, 1e-6);
    const m = new Map();
    const kl = hashBunky;
    for (const s of segs) {
      const mn = [0, 1, 2].map(k => Math.min(s.P0[k], s.P1[k]) - s.t), mx = [0, 1, 2].map(k => Math.max(s.P0[k], s.P1[k]) + s.t);
      for (let i = Math.floor(mn[0] / h); i <= Math.floor(mx[0] / h); i++)
        for (let j = Math.floor(mn[1] / h); j <= Math.floor(mx[1] / h); j++)
          for (let k = Math.floor(mn[2] / h); k <= Math.floor(mx[2] / h); k++) {
            const key = kl(i, j, k);
            const l = m.get(key);
            if (!l) m.set(key, [s]); else if (!l.includes(s)) l.push(s);
          }
    }
    return x => m.get(kl(Math.floor(x[0] / h), Math.floor(x[1] / h), Math.floor(x[2] / h))) || [];
  }

  function vzdalenostKSegmentu(x, s) {
    const pr = Math.max(0, Math.min(s.L, dot(sub(x, s.P0), s.d)));
    return len(sub(x, add(s.P0, mul(s.d, pr))));
  }

  /* Posun vrcholů na sražení / zaoblení. Vrací Uint8Array „pohnuto“. */
  function promitniVrcholy(sit, segs, tol) {
    const najdi = mrizkaSegmentu(segs);
    const pohnuto = new Uint8Array(sit.pocetV);
    let neslo = 0;
    for (let vi = 0; vi < sit.pocetV; vi++) {
      let x = sit.bod(vi);
      const kand = najdi(x).filter(s =>
        vzdalenostKSegmentu(x, s) <= tEf(s, Ref(s, x)) * 1.0005 + tol &&
        dot(s.nA, x) - s.cA <= tol * 4 && dot(s.nB, x) - s.cB <= tol * 4);
      if (!kand.length) continue;
      // skupiny podle druhu (vypouklé zvlášť, vyduté zvlášť) a operace
      const skup = new Map();
      for (const s of kand) {
        const k = (s.konv ? 'k' : 'v') + s.op.typ;     // poloměr se v rohu sjednotí (Ref)
        if (!skup.has(k)) skup.set(k, []);
        skup.get(k).push(s);
      }
      const poradi = [...skup.values()].sort((p, q) => (q[0].konv - p[0].konv) || (q[0].R - p[0].R));
      // Zaoblení i sražení u téhož vrcholu (jen v pásu přechodu, kde se obě
      // ztenčují k nule): vezme se to, které posune víc.
      const hotovo = new Set();
      for (const g of poradi) {
        if (hotovo.has(g[0].konv)) continue;
        hotovo.add(g[0].konv);
        const y = posunNaHranu(x, g, tol);
        if (y === null) { neslo++; continue; }
        if (len(sub(y, x)) > tol * 0.01) { x = y; pohnuto[vi] = 1; }
      }
      sit.p[3 * vi] = x[0]; sit.p[3 * vi + 1] = x[1]; sit.p[3 * vi + 2] = x[2];
    }
    return { pohnuto, neslo };
  }
  /* Poloměr (šířka) úpravy segmentu v bodě x – u konfliktního rohu zúžený. */
  function Ref(s, x) {
    let R = s.R;
    if (s.konf) for (const c of s.konf) {
      const d = len(sub(x, c.bod));
      if (d < s.Ltr) R = Math.min(R, c.Rmin + (s.R - c.Rmin) * hladce(d / s.Ltr));
    }
    return R;
  }
  const tEf = (s, R) => s.op.typ === 'zaobl' ? R * Math.tan(s.fi / 2) : R;
  function posunNaHranu(x, g, tol) {
    const typ = g[0].op.typ;
    // společný poloměr skupiny v tomto bodě (u konfliktních rohů zúžený)
    let R = Infinity;
    for (const s of g) R = Math.min(R, Ref(s, x));
    if (!(R > 1e-9)) return x;
    // roviny stěn (bez duplicit)
    const roviny = [];
    const pridej = (n, c) => {
      for (const r of roviny) if (dot(r.n, n) > 1 - 1e-9 && Math.abs(r.c - c) < tol) return;
      roviny.push({ n, c });
    };
    if (typ === 'zaobl') {
      for (const s of g) { pridej(s.nA, s.cA - R); pridej(s.nB, s.cB - R); }
      const q = promitni(x, roviny, tol * 0.01);
      if (!q) return null;
      const d = sub(x, q), l = len(d);
      if (l < 1e-12) return null;
      return add(q, mul(d, R / l));
    }
    // sražení: stěny + roviny srážky (normála = osa úhlu, prochází tečnou čarou)
    for (const s of g) { pridej(s.nA, s.cA); pridej(s.nB, s.cB); }
    for (const s of g) {
      const m = norm(add(s.nA, s.nB));
      pridej(m, dot(m, add(s.P0, mul(s.a, tEf(s, R)))));
    }
    return promitni(x, roviny, tol * 0.01);
  }

  /* =====================================================================
     STRUKTURA (posun po normále podle výškové mapy)
     ===================================================================== */
  /* Promítací souřadnice (mm) bodu x na ploše o. */
  function zakladRoviny(n) {
    let v;
    if (Math.abs(n[2]) < 0.9) v = norm(sub([0, 0, 1], mul(n, n[2])));
    else v = norm(sub([0, 1, 0], mul(n, n[1])));
    const u = cross(v, n);
    return { u, v };
  }
  /* Projekce vzoru na plochu → souřadnice v dlaždicích (u, v).
     Počátek je společný pro celý model (spodní roh obalového kvádru), takže
     řady cihel na sousedních stěnách vycházejí ve stejné výšce. u0 = posun
     podél stěny, když vzor obtáčí roh (navazuje na sousední stěnu). */
  function projektor(model, o, nast, u0, okruh) {
    let typ = nast.projekce || 'auto';
    if (typ === 'auto') typ = o.tvar === 'rovina' ? 'rovina' : o.tvar === 'valec' ? 'valec' : 'troj';
    if (typ === 'valec' && o.tvar !== 'valec') typ = 'troj';
    const rot = (nast.rotace || 0) * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
    let sirka = nast.sirka, vyska = nast.vyska;
    const pu = nast.posunU || 0, pv = nast.posunV || 0;
    const O = model.box.min;
    // Bez švu: posun o celý obvod C (válec, nebo okruh stěn s obtočeným
    // vzorem) musí v dlaždicích dát celá čísla, tj. C·cos/šířka = a a
    // C·sin/výška = b. Rozměry se proto nepatrně upraví.
    const C = typ === 'valec' && o.uzavreny ? 2 * Math.PI * o.polomer : typ === 'rovina' && okruh ? okruh : 0;
    if (C > 0) {
      if (Math.abs(sr) < 1e-6) sirka = C / Math.max(1, Math.round(C / sirka));
      else if (Math.abs(cr) < 1e-6) vyska = C / Math.max(1, Math.round(C / vyska));
      else {
        const a = Math.max(1, Math.round(C * Math.abs(cr) / sirka)), b = Math.max(1, Math.round(C * Math.abs(sr) / vyska));
        sirka = C * Math.abs(cr) / a; vyska = C * Math.abs(sr) / b;
      }
    }
    const uv = (u, v) => {
      const ru = u * cr - v * sr, rv = u * sr + v * cr;
      return [ru / sirka + pu, rv / vyska + pv];
    };
    if (typ === 'rovina') {
      const { u, v } = zakladRoviny(o.normala);
      const posun = u0 || 0;
      return { typ, u, v, sirka, vyska, uv: x => { const d = sub(x, O); return [uv(dot(d, u) + posun, dot(d, v))]; } };
    }
    if (typ === 'valec') {
      return {
        typ, sirka, vyska, uv: x => {
          const d = sub(x, o.osaBod);
          const th = Math.atan2(dot(d, o.e2), dot(d, o.e1));
          return [uv(th * o.polomer, dot(sub(x, O), o.osa))];
        },
      };
    }
    // trojrovinná: tři průměty, váhy podle normály
    return {
      typ: 'troj', sirka, vyska, uv: x => {
        const d = sub(x, O);
        return [uv(d[1], d[2]), uv(d[0], d[2]), uv(d[0], d[1])];
      },
    };
  }

  /* Obtočení vzoru kolem rohů: svislé rovné stěny se stejným vzorem a
     zapnutým „obtočit“ se rozvinou do jednoho pásu – u každé stěny se
     dopočítá posun u0 tak, aby vzor na společné hraně navazoval.
     Vrací Map(plocha → { u0, skupina }). */
  function obtoceni(model, struktury) {
    const out = new Map();
    const klicNast = s => JSON.stringify([s.vzor, s.parametry, s.sirka, s.vyska, s.rotace, s.posunU, s.posunV, s.smer, s.hloubka, s.invert]);
    const kandidat = rid => {
      const s = struktury.get(rid), o = model.oblasti[rid];
      return s && s.obtocit !== false && o && o.tvar === 'rovina' && Math.abs(o.normala[2]) < 0.2 && (s.projekce || 'auto') !== 'troj';
    };
    // sousedství přes řetězce hran (svislé hrany mezi stěnami)
    const sous = new Map();
    for (const r of model.retezy) {
      if (!kandidat(r.rA) || !kandidat(r.rB)) continue;
      if (klicNast(struktury.get(r.rA)) !== klicNast(struktury.get(r.rB))) continue;
      const s0 = r.segmenty[0], A = P(model.pos, s0.a), B = P(model.pos, s0.b);
      if (Math.abs(A[2] - B[2]) < 0.5 * len(sub(A, B))) continue;      // jen svislé hrany
      for (const [x, y] of [[r.rA, r.rB], [r.rB, r.rA]]) {
        if (!sous.has(x)) sous.set(x, []);
        sous.get(x).push({ druha: y, bod: A });
      }
    }
    const O = model.box.min;
    let skupina = 0;
    for (const start of sous.keys()) {
      if (out.has(start)) continue;
      out.set(start, { u0: 0, skupina });
      const fronta = [start], clenove = [start];
      let okruh = 0;
      while (fronta.length) {
        const x = fronta.shift();
        const ux = zakladRoviny(model.oblasti[x].normala).u;
        for (const { druha, bod } of sous.get(x)) {
          const uy = zakladRoviny(model.oblasti[druha].normala).u;
          const d = sub(bod, O);
          const u0 = dot(d, ux) + out.get(x).u0 - dot(d, uy);
          if (out.has(druha)) {
            // hrana uzavírá okruh: rozdíl posunů = délka obvodu
            const roz = Math.abs(u0 - out.get(druha).u0);
            if (roz > 1e-6) okruh = Math.max(okruh, roz);
            continue;
          }
          out.set(druha, { u0, skupina });
          clenove.push(druha);
          fronta.push(druha);
        }
      }
      for (const c of clenove) out.get(c).okruh = okruh;
      skupina++;
    }
    return out;
  }

  /* Obtisk (nápis, logo): jeden výskyt výškové mapy (bez opakování) se
     středem v bodě `bod` na ploše. Na rovině a obecné ploše se promítá
     kolmo podle normály v místě obtisku, na válci se obtáčí po obvodu. */
  function pripravObtisk(model, o, d) {
    const rot = (d.rotace || 0) * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
    const w = d.sirka, h = d.vyska || d.sirka * (d.mapa.pomer || d.mapa.M / d.mapa.N);
    const c = d.bod;
    const naMape = (u, v) => {
      const ru = u * cr + v * sr, rv = -u * sr + v * cr;
      const x = ru / w + 0.5, y = rv / h + 0.5;
      if (x <= 0 || x >= 1 || y <= 0 || y >= 1) return 0;
      return vzorekBezOpak(d.mapa, x, y);
    };
    // bod mapy (x, y ∈ 0..1) → poloha v mm na ploše (u, v), opak naMape
    const zMapy = (x, y) => {
      const ru = (x - 0.5) * w, rv = (y - 0.5) * h;
      return [ru * cr - rv * sr, ru * sr + rv * cr];
    };
    let fce, nC, naPovrch;
    if (o.tvar === 'valec' && (d.projekce || 'auto') !== 'rovina') {
      const dc = sub(c, o.osaBod), thc = Math.atan2(dot(dc, o.e2), dot(dc, o.e1)), vc = dot(dc, o.osa);
      naPovrch = (x, y) => {
        const [u, v] = zMapy(x, y), th = thc + u / o.polomer;
        const rad = add(mul(o.e1, Math.cos(th)), mul(o.e2, Math.sin(th)));
        return { bod: add(add(o.osaBod, mul(rad, o.polomer)), mul(o.osa, vc + v)), n: rad };
      };
      fce = x => {
        const dx = sub(x, o.osaBod);
        let dth = Math.atan2(dot(dx, o.e2), dot(dx, o.e1)) - thc;
        if (dth > Math.PI) dth -= 2 * Math.PI; if (dth < -Math.PI) dth += 2 * Math.PI;
        return naMape(dth * o.polomer, dot(dx, o.osa) - vc);
      };
    } else {
      nC = d.normala || o.normala;
      const { u, v } = zakladRoviny(nC);
      naPovrch = (x, y) => { const [a, b] = zMapy(x, y); return { bod: add(add(c, mul(u, a)), mul(v, b)), n: nC }; };
      fce = (x, n) => {
        if (n && dot(n, nC) < 0.25) return 0;            // neprosvítit na odvrácenou stranu
        const dx = sub(x, c);
        return naMape(dot(dx, u), dot(dx, v));
      };
    }
    return { h: fce, smer: d.smer || 'ven', hloubka: d.hloubka, bod: c, R: Math.hypot(w, h) / 2, naPovrch, mapa: d.mapa, plocha: d.plocha };
  }
  /* Kolik „inkoustu“ obtisku leží mimo jeho plochu (0..1): vzorky mapy, kde
     je písmo, se promítnou na povrch a paprskem se zjistí, na kterou plochu
     dopadnou. Mimo plochu se obtisk ořízne (plochy se vzorem stojí na hranici). */
  function presahObtisku(model, ob) {
    const eps = model.box.uhlopricka * 0.01;
    let vse = 0, mimo = 0;
    for (let j = 0; j < 10; j++) for (let i = 0; i < 24; i++) {
      const x = (i + 0.5) / 24, y = (j + 0.5) / 10;
      if (vzorekBezOpak(ob.mapa, x, y) < 0.4) continue;
      vse++;
      const p = ob.naPovrch(x, y);
      const z = paprsek(model, add(p.bod, mul(p.n, eps)), mul(p.n, -1), eps * 3);
      if (z.trojuhelnik < 0 || model.oblast[z.trojuhelnik] !== ob.plocha || Math.abs(z.vzdalenost - eps) > eps * 0.5) mimo++;
    }
    return vse ? mimo / vse : 0;
  }
  function vzorekBezOpak(m, u, v) {
    const x = Math.min(m.N - 1, Math.max(0, u * m.N - 0.5)), y = Math.min(m.M - 1, Math.max(0, v * m.M - 0.5));
    const i = Math.min(m.N - 2, Math.floor(x)), j = Math.min(m.M - 2, Math.floor(y)), fx = x - i, fy = y - j;
    const d = m.data, N = m.N;
    const a = d[j * N + i] + (d[j * N + i + 1] - d[j * N + i]) * fx;
    const b = d[(j + 1) * N + i] + (d[(j + 1) * N + i + 1] - d[(j + 1) * N + i]) * fx;
    return a + (b - a) * fy;
  }

  /* Vše, co určuje posun povrchu: struktury (opakovaný vzor) a obtisky.
     posun(plocha, x, n) → posun v mm po normále (bez náběhu u okrajů). */
  /* Výřez = konvexní čtyřúhelník (4 body v rovině plochy) → hrany jako
     poloroviny v rovině: m = jednotková normála dovnitř, k = m·bod. */
  function hranyVyrezu(s) {
    const b = s && s.vyrez;
    if (!Array.isArray(b) || b.length < 3) return null;
    if (s._vyrezH && s._vyrezZ === b) return s._vyrezH;
    const n = norm(cross(sub(b[2], b[0]), sub(b[b.length - 1], b[1])));
    const c = mul(b.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / b.length);
    const h = [];
    for (let i = 0; i < b.length; i++) {
      const p = b[i], q = b[(i + 1) % b.length];
      let m = norm(cross(n, sub(q, p)));
      if (dot(m, sub(c, p)) < 0) m = mul(m, -1);
      if (len(m) > 0.5) h.push({ m, k: dot(m, p) });
    }
    Object.defineProperty(s, '_vyrezH', { value: h, writable: true, configurable: true, enumerable: false });
    Object.defineProperty(s, '_vyrezZ', { value: b, writable: true, configurable: true, enumerable: false });
    return h;
  }
  function pripravVysky(model, zadani, volby) {
    const struktury = zadani.struktury || new Map(), obtisky = zadani.obtisky || [];
    const obt = obtoceni(model, struktury);
    const proj = new Map();
    for (const [rid, s] of struktury) {
      const o = model.oblasti[rid];
      if (!o) continue;
      const q = obt.get(rid);
      proj.set(rid, { p: projektor(model, o, s, q ? q.u0 : 0, q ? q.okruh : 0), s, mapa: volby.mapa ? volby.mapa(s) : null, skupina: q ? q.skupina : -1 });
    }
    const obtPodle = new Map();
    for (const d of obtisky) {
      const o = model.oblasti[d.plocha];
      if (!o || !d.mapa || !(d.sirka > 0)) continue;
      if (!obtPodle.has(d.plocha)) obtPodle.set(d.plocha, []);
      obtPodle.get(d.plocha).push(pripravObtisk(model, o, d));
    }
    const zMin = model.box.min[2];
    // pás výšky: 1 uvnitř, 0 venku, s náběhem `okraj`
    // pás výšky a výřez (čtyřúhelník v rovině plochy): vzdálenost dovnitř,
    // < 0 = venku; náběh přes `okraj`
    const pas = (s, x) => {
      let dz = Infinity;
      let od = s.pasOd, doo = s.pasDo;
      if (od > 0 || doo > 0) {
        if (od > 0 && doo > 0 && od > doo) [od, doo] = [doo, od];     // prohozené meze
        const z = x[2] - zMin;
        dz = Math.min(od > 0 ? z - od : Infinity, doo > 0 ? doo - z : Infinity);
      }
      const vr = hranyVyrezu(s);
      if (vr) for (const h of vr) dz = Math.min(dz, dot(h.m, x) - h.k);
      if (dz === Infinity) return 1;
      if (dz < 0) return 0;
      if (!(s.okraj > 0)) return 1;
      const t = Math.min(1, dz / s.okraj);
      return t * t * (3 - 2 * t);
    };
    const texH = (q, x, n) => {
      const uvs = q.p.uv(x);
      let h;
      if (q.p.typ === 'troj') {
        const w = vahyTroj(n);
        h = 0; for (let k = 0; k < 3; k++) if (w[k] > 1e-4) h += w[k] * volby.vzorek(q.mapa, uvs[k][0], uvs[k][1]);
      } else h = volby.vzorek(q.mapa, uvs[0][0], uvs[0][1]);
      return q.s.invert ? 1 - h : h;
    };
    function posun(rid, x, n) {
      let off = 0;
      const q = proj.get(rid);
      if (q && q.mapa) {
        const f = pas(q.s, x);
        if (f > 0) {
          const h = texH(q, x, n), hl = q.s.hloubka;
          off += f * (q.s.smer === 'ven' ? hl * h : -hl * (1 - h));
        }
      }
      const ob = obtPodle.get(rid);
      if (ob) for (const d of ob) {
        const h = d.h(x, n);
        if (h > 0) off += d.smer === 'ven' ? d.hloubka * h : -d.hloubka * h;
      }
      return off;
    }
    function hRef(rid) {
      let m = 0;
      const q = proj.get(rid);
      if (q) m = q.s.hloubka;
      const ob = obtPodle.get(rid);
      if (ob) for (const d of ob) m = Math.max(m, d.hloubka);
      return m;
    }
    const maPlochu = rid => proj.has(rid) || obtPodle.has(rid);
    // rovné sousední plochy každé plochy se vzorem: jejich (posunuté) roviny
    // hlídají, aby se vzor u rohu nepřeložil přes sousední stěnu
    const sousede = new Map();
    for (const rr of model.retezy) for (const [a, b] of [[rr.rA, rr.rB], [rr.rB, rr.rA]]) {
      if (!maPlochu(a) || model.oblasti[b].tvar !== 'rovina') continue;
      if (!sousede.has(a)) sousede.set(a, []);
      const l = sousede.get(a);
      if (l.some(x => x.rid === b)) continue;
      const n = model.oblasti[b].normala;
      l.push({ rid: b, n, c: dot(n, model.oblasti[b].stred) });
    }
    return { proj, obtPodle, posun, hRef, maPlochu, pas, sousede };
  }

  /* Normály v rozích původních trojúhelníků: průměr (váha = plocha) přes
     trojúhelníky téže plochy kolem vrcholu. */
  function normalyRohu(model) {
    if (model._rohN) return model._rohN;
    const { tri, N, A, oblast } = model;
    const nT = tri.length / 3, nV = model.pos.length / 3;
    const start = new Int32Array(nV + 1);
    for (const v of tri) start[v + 1]++;
    for (let i = 0; i < nV; i++) start[i + 1] += start[i];
    const kolem = new Int32Array(tri.length), plneni = start.slice(0, nV);
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) kolem[plneni[tri[3 * t + k]]++] = t;
    const rohN = new Float64Array(nT * 9);
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
      const v = tri[3 * t + k];
      let x = 0, y = 0, z = 0;
      for (let i = start[v]; i < start[v + 1]; i++) {
        const u = kolem[i];
        if (oblast[u] !== oblast[t]) continue;
        x += N[3 * u] * A[u]; y += N[3 * u + 1] * A[u]; z += N[3 * u + 2] * A[u];
      }
      const l = Math.hypot(x, y, z) || 1;
      rohN[9 * t + 3 * k] = x / l; rohN[9 * t + 3 * k + 1] = y / l; rohN[9 * t + 3 * k + 2] = z / l;
    }
    model._rohN = rohN;
    return rohN;
  }
  function interpolujNormalu(model, rohN, t, x) {
    if (t < 0) return null;
    const { pos, tri } = model;
    const a = P(pos, tri[3 * t]), b = P(pos, tri[3 * t + 1]), c = P(pos, tri[3 * t + 2]);
    const v0 = sub(b, a), v1 = sub(c, a), v2 = sub(x, a);
    const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1);
    const den = d00 * d11 - d01 * d01;
    if (Math.abs(den) < 1e-30) return null;
    let wb = (d11 * d20 - d01 * d21) / den, wc = (d00 * d21 - d01 * d20) / den;
    wb = Math.max(0, Math.min(1, wb)); wc = Math.max(0, Math.min(1 - wb, wc));
    const wa = 1 - wb - wc, o = 9 * t;
    return norm([
      wa * rohN[o] + wb * rohN[o + 3] + wc * rohN[o + 6],
      wa * rohN[o + 1] + wb * rohN[o + 4] + wc * rohN[o + 7],
      wa * rohN[o + 2] + wb * rohN[o + 5] + wc * rohN[o + 8],
    ]);
  }

  function vahyTroj(n) {
    const w = [Math.pow(Math.abs(n[0]), 4), Math.pow(Math.abs(n[1]), 4), Math.pow(Math.abs(n[2]), 4)];
    const s = w[0] + w[1] + w[2] || 1;
    return w.map(x => x / s);
  }

  /* Prostorová mřížka bodů: vzdálenost k nejbližšímu bodu do poloměru r. */
  function mrizkaBodu(sit, vyber, r) {
    const m = new Map();
    let n = 0;
    for (let v = 0; v < sit.pocetV; v++) if (vyber[v]) {
      const k = hashBunky(Math.floor(sit.p[3 * v] / r), Math.floor(sit.p[3 * v + 1] / r), Math.floor(sit.p[3 * v + 2] / r));
      const l = m.get(k); if (l) l.push(v); else m.set(k, [v]);
      n++;
    }
    if (!n) return null;
    return x => {
      const i0 = Math.floor(x[0] / r), j0 = Math.floor(x[1] / r), k0 = Math.floor(x[2] / r);
      let best = Infinity;
      const p = sit.p, x0 = x[0], x1 = x[1], x2 = x[2];
      for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (let k = k0 - 1; k <= k0 + 1; k++) {
        const l = m.get(hashBunky(i, j, k));
        if (l) for (let q = 0; q < l.length; q++) {
          const w = l[q], dx = p[3 * w] - x0, dy = p[3 * w + 1] - x1, dz = p[3 * w + 2] - x2, d = dx * dx + dy * dy + dz * dz;
          if (d < best) best = d;
        }
      }
      return Math.sqrt(best);
    };
  }
  const hladce = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

  /* tlum(x) ∈ [0,1]: 1 = roh obtočeného vzoru se posouvá do průsečíku obou
     reliéfů, 0 = vzor k rohové hraně plynule nabíhá (dokázaně bez průniku,
     viz rHr níže). Sestav() ho sníží tam, kde kontrola našla průnik. */
  function aplikujStruktury(sit, model, VY, pohnuto, tlum) {
    const nV = sit.pocetV;
    // vrcholy → plochy (nejvýš dvě si pamatujeme, -3 = tři a víc)
    const reg = new Int32Array(nV).fill(-1), reg2 = new Int32Array(nV).fill(-1);
    const t1 = new Int32Array(nV).fill(-1), t2 = new Int32Array(nV).fill(-1);
    for (let ti = 0; ti < sit.pocetT; ti++) {
      if (!sit.zivy[ti]) continue;
      const r = model.oblast[sit.o[ti]];
      for (let k = 0; k < 3; k++) {
        const v = sit.t[3 * ti + k];
        if (reg[v] === -1) { reg[v] = r; t1[v] = sit.o[ti]; }
        else if (reg[v] === r) continue;
        else if (reg2[v] === -1) { reg2[v] = r; t2[v] = sit.o[ti]; }
        else if (reg2[v] !== r) reg2[v] = -3;
      }
    }
    // pevné vrcholy (hranice ploch) a rohové (hranice dvou stěn obtočeného vzoru)
    const pevny = new Uint8Array(nV), rohovy = new Uint8Array(nV);
    for (let v = 0; v < nV; v++) {
      if (reg[v] < 0 || reg2[v] === -1) continue;
      // Roh dvou stěn s obtočeným vzorem (vzor na hraně navazuje): vrchol se
      // posune do průsečíku obou posunutých ploch. Jinde (soused bez vzoru,
      // jiný vzor, vodorovná plocha, 3+ ploch) hranice stojí a vzor k ní
      // plynule nabíhá – průsečík dvou nesouvisejících reliéfů by se přeložil.
      const qa = VY.proj.get(reg[v]), qb = reg2[v] >= 0 ? VY.proj.get(reg2[v]) : null;
      if (qa && qb && qa.skupina >= 0 && qa.skupina === qb.skupina) rohovy[v] = 1;
      else if (VY.maPlochu(reg[v]) || (reg2[v] >= 0 && VY.maPlochu(reg2[v]))) pevny[v] = 1;
    }
    let maxOkraj = 0, maxHl = 0;
    for (const [, q] of VY.proj) { maxOkraj = Math.max(maxOkraj, q.s.okraj || 0); maxHl = Math.max(maxHl, q.s.hloubka); }
    for (const [, l] of VY.obtPodle) for (const d of l) maxHl = Math.max(maxHl, d.hloubka);
    // Náběh k pevné hranici: aspoň 2× hloubka. Pak posun u hrany nikdy
    // nepřesáhne vzdálenost od ní (smoothstep: d·f(s)/s ≤ 1,125·d/r, a rohový
    // vrchol obtočeného vzoru se posouvá až √2× víc → r ≥ 1,6·d) a reliéfy
    // dvou sousedních ploch se nemůžou protnout.
    const rHr = Math.max(maxOkraj, 2 * maxHl);
    const vzdHr = rHr > 0 ? mrizkaBodu(sit, pevny, rHr) : null;
    // plynulý náběh k zaoblení/sražení: aspoň 1,5× hloubka vzoru
    const rZaobl = Math.max(maxOkraj, 1.5 * maxHl);
    const vzdZa = pohnuto && rZaobl > 0 ? mrizkaBodu(sit, pohnuto, rZaobl) : null;
    const rohN = normalyRohu(model);
    const vzdRoh = tlum ? mrizkaBodu(sit, rohovy, rHr) : null;
    const posun = new Float64Array(nV * 3);
    const uRohu = new Uint8Array(nV);          // vrcholy u rohu obtočeného vzoru (úklid jehel)
    const pritlaceny = new Float64Array(nV);   // o kolik byl vrchol přitlačen na rovinu sousední stěny
    for (let v = 0; v < nV; v++) {
      const r = reg[v];
      if (r < 0 || pevny[v] || (pohnuto && pohnuto[v]) || !VY.maPlochu(r)) continue;
      if (reg2[v] !== -1 && !rohovy[v]) continue;
      const x = sit.bod(v);
      if (rohovy[v] && !VY.maPlochu(r)) continue;
      const q = VY.proj.get(r);
      let f = 1;
      if (vzdHr) { const rr = Math.max(q ? q.s.okraj || 0 : 0, 2 * VY.hRef(r)); if (rr > 0) f *= hladce(vzdHr(x) / rr); }
      if (vzdZa) {
        const rr = Math.max(q ? q.s.okraj || 0 : 0, 1.5 * VY.hRef(r));
        if (rr > 0) f *= hladce(vzdZa(x) / rr);
      }
      if (f <= 0) continue;
      const nA = interpolujNormalu(model, rohN, t1[v], x) || Nt(model.N, t1[v]);
      const off = VY.posun(r, x, nA) * f;
      if (!off) continue;
      let w;
      if (rohovy[v]) {
        // roh: w·nA = offA a w·nB = offB (průsečík obou posunutých ploch)
        const nB = interpolujNormalu(model, rohN, t2[v], x) || Nt(model.N, t2[v]);
        const offB = VY.posun(reg2[v], x, nB) * f;
        const c = dot(nA, nB), d = 1 - c * c;
        if (d < 0.02) w = mul(norm(add(nA, nB)), (off + offB) / 2);       // skoro rovné pokračování
        else if (c < -0.85) w = [0, 0, 0];                               // ostrý břit – nechat
        else w = add(mul(nA, (off - c * offB) / d), mul(nB, (offB - c * off) / d));
        uRohu[v] = 1;
      } else {
        w = mul(nA, off);
        // U rohu nesmí vrchol přejít za (posunutou) rovinu sousední stěny –
        // jinak by se vzor na rohu přeložil přes sebe.
        for (const sb of VY.sousede.get(r) || []) {
          // jen sousední stěna téhož obtočeného vzoru (jinde stačí náběh)
          const qs = VY.proj.get(sb.rid);
          if (!q || !qs || q.skupina < 0 || qs.skupina !== q.skupina) continue;
          const sd = dot(sb.n, x) - sb.c;
          if (Math.abs(sd) > 2.5 * VY.hRef(r) + 1e-9 || Math.abs(sd) < 1e-9) continue;
          // hloubka sousední stěny v průmětu bodu na její rovinu (u rohu = na hraně)
          const offS = VY.maPlochu(sb.rid) ? VY.posun(sb.rid, sub(x, mul(sb.n, sd)), sb.n) : 0;
          const val = dot(sb.n, add(x, w)) - (sb.c + offS);
          if ((sd < 0 && val > 0) || (sd > 0 && val < 0)) {
            w = sub(w, mul(sb.n, val)); uRohu[v] = 1;
            // přichytávat jen mimo pás náběhu (tam jsou posuny malé a přichycení
            // na řídké rohové vrcholy by trojúhelníky přetáhlo přes sebe)
            if (f > 0.98) pritlaceny[v] = Math.max(pritlaceny[v], Math.abs(val));
          }
        }
      }
      if (tlum) {
        const l = tlum(x);
        if (l < 1) {
          // bezpečná varianta: rohová hrana stojí, vzor k ní nabíhá na 2× hloubku
          let fs = 0;
          if (!rohovy[v]) { fs = 1; const rr = 2 * VY.hRef(r); if (vzdRoh && rr > 0) fs = hladce(vzdRoh(x) / rr); }
          w = add(mul(w, l), mul(nA, off * fs * (1 - l)));
          pritlaceny[v] = 0;
        }
      }
      posun[3 * v] = w[0]; posun[3 * v + 1] = w[1]; posun[3 * v + 2] = w[2];
    }
    for (let i = 0; i < nV * 3; i++) sit.p[i] += posun[i];
    // Přitlačené vrcholy leží na rohové linii mezi rohovými vrcholy; obě stěny
    // by tam tvořily dvojitou „ploutev“ nulové tloušťky. Přichytí se proto
    // na nejbližší rohový vrchol – ploutve se zdegenerují a úklid je vyhodí.
    let maxOff = 0;
    for (const [, q] of VY.proj) maxOff = Math.max(maxOff, q.s.hloubka);
    const rohy = new Uint8Array(nV);
    for (let v = 0; v < nV; v++) if (rohovy[v] || pevny[v]) rohy[v] = 1;
    if (maxOff > 0) {
      const rr = maxOff * 3, m = new Map();
      for (let v = 0; v < nV; v++) if (rohy[v]) {
        const k = hashBunky(Math.floor(sit.p[3 * v] / rr), Math.floor(sit.p[3 * v + 1] / rr), Math.floor(sit.p[3 * v + 2] / rr));
        const l = m.get(k); if (l) l.push(v); else m.set(k, [v]);
      }
      for (let v = 0; v < nV; v++) if (pritlaceny[v]) {
        const x = sit.bod(v);
        const i0 = Math.floor(x[0] / rr), j0 = Math.floor(x[1] / rr), k0 = Math.floor(x[2] / rr);
        let best = Infinity, bw = -1;
        for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (let k = k0 - 1; k <= k0 + 1; k++) {
          const l = m.get(hashBunky(i, j, k));
          if (l) for (const w of l) { const d = len(sub(sit.bod(w), x)); if (d < best) { best = d; bw = w; } }
        }
        // přichytit jen na blízký rohový vrchol (o tolik, o kolik se přitlačil)
        if (bw >= 0 && best < Math.min(rr, 8 * pritlaceny[v] + 1e-6)) { sit.p[3 * v] = sit.p[3 * bw]; sit.p[3 * v + 1] = sit.p[3 * bw + 1]; sit.p[3 * v + 2] = sit.p[3 * bw + 2]; }
      }
    }
    uRohu.rohove = [];
    for (let v = 0; v < nV; v++) if (rohovy[v]) uRohu.rohove.push(sit.p[3 * v] - posun[3 * v], sit.p[3 * v + 1] - posun[3 * v + 1], sit.p[3 * v + 2] - posun[3 * v + 2]);
    return uRohu;
  }

  /* Průniky trojúhelníků (bez společného vrcholu) mezi těmi, které mají
     vrchol blízko některého z bodů `kolem` (do vzdálenosti r). Vrací středy
     protínajících se dvojic. Obecná poloha: hrana prochází vnitřkem druhého;
     ve stejné rovině: hrany se ostře kříží nebo vrchol leží uvnitř. */
  function prunikyKolem(v, kolem, r, model) {
    const P = v.pos, T = v.tri, nT = T.length / 3;
    if (!kolem.length) return [];
    const blizko = new Map();
    for (let i = 0; i < kolem.length; i += 3) {
      const k = hashBunky(Math.floor(kolem[i] / r), Math.floor(kolem[i + 1] / r), Math.floor(kolem[i + 2] / r));
      const l = blizko.get(k); if (l) l.push(i); else blizko.set(k, [i]);
    }
    const jeBlizko = (x, y, z) => {
      const i0 = Math.floor(x / r), j0 = Math.floor(y / r), k0 = Math.floor(z / r);
      for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (let k = k0 - 1; k <= k0 + 1; k++) {
        const l = blizko.get(hashBunky(i, j, k));
        if (l) for (const q of l) { const dx = kolem[q] - x, dy = kolem[q + 1] - y, dz = kolem[q + 2] - z; if (dx * dx + dy * dy + dz * dz < r * r) return true; }
      }
      return false;
    };
    const vyb = [];
    let delka = 0;
    const blizV = new Uint8Array(P.length / 3);
    for (let i = 0; i < blizV.length; i++) if (jeBlizko(P[3 * i], P[3 * i + 1], P[3 * i + 2])) blizV[i] = 1;
    for (let t = 0; t < nT; t++) if (blizV[T[3 * t]] || blizV[T[3 * t + 1]] || blizV[T[3 * t + 2]]) vyb.push(t);
    if (!vyb.length) return [];
    const bod = t => [0, 1, 2].map(k => P.subarray(3 * T[3 * t + k], 3 * T[3 * t + k] + 3));
    const vysl = [];
    // převrácené trojúhelníky (normála víc než 120° proti původní ploše)
    if (model && v.puvod) for (const t of vyb) {
      const q = bod(t), n = cross(sub(q[1], q[0]), sub(q[2], q[0])), l = len(n), o = v.puvod[t];
      if (l > 2e-3 && dot(n, Nt(model.N, o)) < -0.5 * l) vysl.push(mul(add(add(q[0], q[1]), q[2]), 1 / 3));
    }
    const bb = new Float64Array(vyb.length * 6);
    vyb.forEach((t, i) => {
      for (let o = 0; o < 3; o++) {
        const a = P[3 * T[3 * t] + o], b = P[3 * T[3 * t + 1] + o], c = P[3 * T[3 * t + 2] + o];
        bb[6 * i + o] = Math.min(a, b, c); bb[6 * i + 3 + o] = Math.max(a, b, c);
      }
      delka += bb[6 * i + 3] - bb[6 * i] + bb[6 * i + 4] - bb[6 * i + 1] + bb[6 * i + 5] - bb[6 * i + 2];
    });
    const h = Math.max(delka / vyb.length / 2, 1e-6);
    const g = new Map();
    const bunky = (i, f) => {
      for (let a = Math.floor(bb[6 * i] / h); a <= Math.floor(bb[6 * i + 3] / h); a++)
        for (let b = Math.floor(bb[6 * i + 1] / h); b <= Math.floor(bb[6 * i + 4] / h); b++)
          for (let c = Math.floor(bb[6 * i + 2] / h); c <= Math.floor(bb[6 * i + 5] / h); c++) f(hashBunky(a, b, c));
    };
    for (let i = 0; i < vyb.length; i++) bunky(i, k => { const l = g.get(k); if (l) l.push(i); else g.set(k, [i]); });
    // souřadnice a normály vybraných trojúhelníků v typovaných polích – test
    // dvojic bez alokací (kontrola běží v každém kole opravy rohů)
    const X = new Float64Array(vyb.length * 9), NX = new Float64Array(vyb.length * 4);
    vyb.forEach((t, i) => {
      for (let k = 0; k < 3; k++) for (let o = 0; o < 3; o++) X[9 * i + 3 * k + o] = P[3 * T[3 * t + k] + o];
      const o = 9 * i, ux = X[o + 3] - X[o], uy = X[o + 4] - X[o + 1], uz = X[o + 5] - X[o + 2];
      const wx = X[o + 6] - X[o], wy = X[o + 7] - X[o + 1], wz = X[o + 8] - X[o + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      NX[4 * i] = nx; NX[4 * i + 1] = ny; NX[4 * i + 2] = nz; NX[4 * i + 3] = Math.sqrt(nx * nx + ny * ny + nz * nz);
    });
    // úsečka (a, b) prochází vnitřkem trojúhelníku j (Möller–Trumbore, tolerance jako v testu)
    const segTriS = (ax, ay, az, bx, by, bz, j) => {
      const o = 9 * j, qx = X[o], qy = X[o + 1], qz = X[o + 2];
      const e1x = X[o + 3] - qx, e1y = X[o + 4] - qy, e1z = X[o + 5] - qz, e2x = X[o + 6] - qx, e2y = X[o + 7] - qy, e2z = X[o + 8] - qz;
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-9 * Math.sqrt((dx * dx + dy * dy + dz * dz) * (e1x * e1x + e1y * e1y + e1z * e1z) * (e2x * e2x + e2y * e2y + e2z * e2z))) return false;
      const tx = ax - qx, ty = ay - qy, tz = az - qz, u = (tx * px + ty * py + tz * pz) / det;
      if (u < 1e-7 || u > 1 - 1e-7) return false;
      const cx = ty * e1z - tz * e1y, cy = tz * e1x - tx * e1z, cz = tx * e1y - ty * e1x, w = (dx * cx + dy * cy + dz * cz) / det;
      if (w < 1e-7 || u + w > 1 - 1e-7) return false;
      const s = (e2x * cx + e2y * cy + e2z * cz) / det;
      return s > 1e-7 && s < 1 - 1e-7;
    };
    // všechny vrcholy trojúhelníku j ostře na jedné straně roviny i → nemůžou se protnout
    const strana = (i, j) => {
      const nx = NX[4 * i], ny = NX[4 * i + 1], nz = NX[4 * i + 2], c = nx * X[9 * i] + ny * X[9 * i + 1] + nz * X[9 * i + 2];
      const eps = 1e-12 * NX[4 * i + 3] * (1 + Math.abs(X[9 * i]) + Math.abs(X[9 * i + 1]) + Math.abs(X[9 * i + 2]));
      let kl = 0, zp = 0;
      for (let k = 0; k < 3; k++) {
        const d = nx * X[9 * j + 3 * k] + ny * X[9 * j + 3 * k + 1] + nz * X[9 * j + 3 * k + 2] - c;
        if (d > eps) kl++; else if (d < -eps) zp++;
      }
      return kl === 3 || zp === 3;
    };
    const segTri = (a, b, q) => {
      const d = sub(b, a), e1 = sub(q[1], q[0]), e2 = sub(q[2], q[0]), pv = cross(d, e2), det = dot(e1, pv);
      if (Math.abs(det) < 1e-9 * len(d) * len(e1) * len(e2)) return false;
      const tv = sub(a, q[0]), u = dot(tv, pv) / det; if (u < 1e-7 || u > 1 - 1e-7) return false;
      const qv = cross(tv, e1), w = dot(d, qv) / det; if (w < 1e-7 || u + w > 1 - 1e-7) return false;
      const s = dot(e2, qv) / det; return s > 1e-7 && s < 1 - 1e-7;
    };
    const v2 = (n, x) => { const ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : (Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2); return ax === 0 ? [x[1], x[2]] : ax === 1 ? [x[0], x[2]] : [x[0], x[1]]; };
    const o2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const koplanarni = (qa, qb, n) => {
      const A = qa.map(x => v2(n, x)), B = qb.map(x => v2(n, x));
      let mer = 1; for (const x of [...A, ...B]) mer = Math.max(mer, Math.abs(x[0]), Math.abs(x[1]));
      const eps = 1e-9 * mer * mer;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const a1 = A[i], a2 = A[(i + 1) % 3], b1 = B[j], b2 = B[(j + 1) % 3];
        const d1 = o2(a1, a2, b1), d2 = o2(a1, a2, b2), d3 = o2(b1, b2, a1), d4 = o2(b1, b2, a2);
        if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) return true;
      }
      const uvnitr = (x, T3) => { const s = Math.sign(o2(T3[0], T3[1], T3[2])); return [0, 1, 2].every(k => s * o2(T3[k], T3[(k + 1) % 3], x) > eps); };
      return A.some(x => uvnitr(x, B)) || B.some(x => uvnitr(x, A));
    };
    // kandidáti z buněk, které trojúhelník i překrývá; každá dvojice jednou (j > i,
    // razítko), kolize hašů buněk přidají jen pár kandidátů navíc
    const razitko = new Int32Array(vyb.length).fill(-1);
    for (let i = 0; i < vyb.length; i++) {
      const kand = [];
      bunky(i, k => { const l = g.get(k); if (l) for (const j of l) if (j > i && razitko[j] !== i) { razitko[j] = i; kand.push(j); } });
      for (const j of kand) {
        if (bb[6 * i] > bb[6 * j + 3] || bb[6 * j] > bb[6 * i + 3] || bb[6 * i + 1] > bb[6 * j + 4] || bb[6 * j + 1] > bb[6 * i + 4] || bb[6 * i + 2] > bb[6 * j + 5] || bb[6 * j + 2] > bb[6 * i + 5]) continue;
        const a = vyb[i], b = vyb[j];
        const ta = T[3 * a], tb = T[3 * a + 1], tc = T[3 * a + 2], ua = T[3 * b], ub = T[3 * b + 1], uc = T[3 * b + 2];
        if (ta === ua || ta === ub || ta === uc || tb === ua || tb === ub || tb === uc || tc === ua || tc === ub || tc === uc) continue;
        const la = NX[4 * i + 3], lb = NX[4 * j + 3];
        if (la < 1e-18 || lb < 1e-18) continue;
        const nn = NX[4 * i] * NX[4 * j] + NX[4 * i + 1] * NX[4 * j + 1] + NX[4 * i + 2] * NX[4 * j + 2];
        const rovnob = Math.abs(nn) > (1 - 1e-9) * la * lb;
        let hit = false;
        if (rovnob) {
          const qa = bod(a), qb = bod(b), na = [NX[4 * i], NX[4 * i + 1], NX[4 * i + 2]];
          if (Math.abs(dot(sub(qb[0], qa[0]), na)) / la < 1e-6 * Math.max(1, Math.abs(qa[0][0]), Math.abs(qa[0][1]), Math.abs(qa[0][2]))) hit = koplanarni(qa, qb, na);
          else for (let k = 0; k < 3 && !hit; k++) if (segTri(qa[k], qa[(k + 1) % 3], qb) || segTri(qb[k], qb[(k + 1) % 3], qa)) hit = true;
        } else if (!strana(i, j) && !strana(j, i)) {
          for (let k = 0; k < 3 && !hit; k++) {
            const k2 = (k + 1) % 3, oi = 9 * i, oj = 9 * j;
            if (segTriS(X[oi + 3 * k], X[oi + 3 * k + 1], X[oi + 3 * k + 2], X[oi + 3 * k2], X[oi + 3 * k2 + 1], X[oi + 3 * k2 + 2], j) ||
                segTriS(X[oj + 3 * k], X[oj + 3 * k + 1], X[oj + 3 * k + 2], X[oj + 3 * k2], X[oj + 3 * k2 + 1], X[oj + 3 * k2 + 2], i)) hit = true;
          }
        }
        if (hit) { const qa = bod(a), qb = bod(b); vysl.push(mul(add(add(qa[0], qa[1]), add(qa[2], add(add(qb[0], qb[1]), qb[2]))), 1 / 6)); }
      }
    }
    return vysl;
  }

  /* Tloušťka stěny pod bodem x (paprsek proti normále n k protější stěně).
     Mřížka trojúhelníků původního modelu se staví jednou. */
  function mrizkaModelu(model) {
    if (model._mrizka) return model._mrizka;
    const { pos, tri } = model;
    const h = Math.max(model.box.uhlopricka / 48, 1e-6);
    const m = new Map();
    for (let t = 0; t < tri.length / 3; t++) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let q = 0; q < 3; q++) for (let k = 0; k < 3; k++) { const c = pos[3 * tri[3 * t + q] + k]; if (c < mn[k]) mn[k] = c; if (c > mx[k]) mx[k] = c; }
      for (let i = Math.floor(mn[0] / h); i <= Math.floor(mx[0] / h); i++)
        for (let j = Math.floor(mn[1] / h); j <= Math.floor(mx[1] / h); j++)
          for (let k = Math.floor(mn[2] / h); k <= Math.floor(mx[2] / h); k++) {
            const key = hashBunky(i, j, k), l = m.get(key);
            if (l) l.push(t); else m.set(key, [t]);
          }
    }
    model._mrizka = { h, m };
    return model._mrizka;
  }
  function paprsek(model, o, d, maxD) {
    const { h, m } = mrizkaModelu(model);
    const { pos, tri } = model;
    const videno = new Set();
    let best = Infinity, bestT = -1;
    const krok = h * 0.5;
    for (let s = 0; s <= maxD + h; s += krok) {
      if (s > best + h) break;
      const x = add(o, mul(d, s));
      const l = m.get(hashBunky(Math.floor(x[0] / h), Math.floor(x[1] / h), Math.floor(x[2] / h)));
      if (!l) continue;
      for (const t of l) {
        if (videno.has(t)) continue;
        videno.add(t);
        const a = P(pos, tri[3 * t]), b = P(pos, tri[3 * t + 1]), c = P(pos, tri[3 * t + 2]);
        const e1 = sub(b, a), e2 = sub(c, a), pv = cross(d, e2), det = dot(e1, pv);
        if (Math.abs(det) < 1e-14) continue;
        const tv = sub(o, a), u = dot(tv, pv) / det;
        if (u < -1e-9 || u > 1 + 1e-9) continue;
        const qv = cross(tv, e1), v = dot(d, qv) / det;
        if (v < -1e-9 || u + v > 1 + 1e-9) continue;
        const dist = dot(e2, qv) / det;
        if (dist > 1e-9 && dist < best) { best = dist; bestT = t; }
      }
    }
    return { vzdalenost: best, trojuhelnik: bestT };
  }
  function tloustka(model, x, n) {
    const eps = model.box.uhlopricka * 1e-5;
    return paprsek(model, sub(x, mul(n, eps)), mul(n, -1), model.box.uhlopricka * 1.5).vzdalenost + eps;
  }
  /* Nejmenší zbytek stěny pod plochou, když se do ní ryje z obou stran:
     tloušťka − hloubka(rid, bod) − hloubka(protější plochy, protější bod).
     hl(rid, x) → mm v tom místě (0 mimo výřez / pás / nápis). Vzorky: zadané
     body (výřez) nebo ~80 těžišť trojúhelníků plochy. */
  function zbytekSteny(model, rid, hl, vzorky) {
    const o = model.oblasti[rid];
    const eps = model.box.uhlopricka * 1e-5;
    if (!vzorky) {
      vzorky = [];
      const krok = Math.max(1, Math.floor(o.tri.length / 80));
      for (let i = 0; i < o.tri.length; i += krok) {
        const t = o.tri[i];
        vzorky.push({ c: mul(add(add(P(model.pos, model.tri[3 * t]), P(model.pos, model.tri[3 * t + 1])), P(model.pos, model.tri[3 * t + 2])), 1 / 3), n: Nt(model.N, t) });
      }
    }
    let best = null;
    for (const { c, n } of vzorky) {
      const h = hl(rid, c);
      if (!(h > 0)) continue;
      const r = paprsek(model, sub(c, mul(n, eps)), mul(n, -1), model.box.uhlopricka * 1.5);
      if (!isFinite(r.vzdalenost)) continue;
      const tl = r.vzdalenost + eps, protejsi = model.oblast[r.trojuhelnik];
      const h2 = protejsi !== rid ? hl(protejsi, sub(c, mul(n, tl))) : 0;
      const z = tl - h - h2;
      if (!best || z < best.zbytek) best = { zbytek: z, tloustka: tl, protejsi, obe: h2 > 0 };
    }
    return best;
  }
  /* Nejtenčí místo pod plochou (vzorek ~60 trojúhelníků). */
  function nejtensi(model, rid) {
    const o = model.oblasti[rid];
    const krok = Math.max(1, Math.floor(o.tri.length / 60));
    let min = Infinity;
    for (let i = 0; i < o.tri.length; i += krok) {
      const t = o.tri[i];
      const c = mul(add(add(P(model.pos, model.tri[3 * t]), P(model.pos, model.tri[3 * t + 1])), P(model.pos, model.tri[3 * t + 2])), 1 / 3);
      min = Math.min(min, tloustka(model, c, Nt(model.N, t)));
    }
    return min;
  }

  /* Rozříznutí sítě rovinou n·x = k v trojúhelnících, které projdou filtrem
     (hranice pásu výšky – aby byla rovná, ne zubatá podle sítě). */
  function rezRovinou(sit, n, k, filtr, tol) {
    const deleni = new Map();
    for (let ti = 0; ti < sit.pocetT; ti++) {
      if (!sit.zivy[ti] || !filtr(ti)) continue;
      for (let q = 0; q < 3; q++) {
        const va = sit.t[3 * ti + q], vb = sit.t[3 * ti + (q + 1) % 3];
        const kk = klic(va, vb);
        if (deleni.has(kk)) continue;
        const A = sit.bod(va), B = sit.bod(vb);
        const da = dot(n, A) - k, db = dot(n, B) - k;
        if (!((da < -tol && db > tol) || (da > tol && db < -tol))) continue;
        const X = add(A, mul(sub(B, A), da / (da - db)));
        deleni.set(kk, sit.pridejV(X[0], X[1], X[2]));
      }
    }
    if (deleni.size) sit.rozdel(deleni);
  }

  /* =====================================================================
     SESTAVENÍ VÝSLEDKU
     ===================================================================== */
  /* zadani: { struktury: Map(oblast → nastavení), hrany: Map(řetězec → {typ, velikost, segmenty}) }
     volby:  { jemnost (mm), limitT, mapa(nast) → výšková mapa, vzorek(mapa,u,v) } */
  function sestav(model, zadani, volby) {
    const tol = Math.max(1e-7, model.box.uhlopricka * 2e-6);
    const prubeh = volby.prubeh || (() => {});
    const sit = new Sit(model.pos, model.tri);
    const varovani = [];
    let omezeno = false;                 // síť zhrubla kvůli limitu trojúhelníků
    const struktury = zadani.struktury || new Map();
    const hrany = zadani.hrany || new Map();
    const VY = pripravVysky(model, zadani, volby);
    const segs = pripravSegmenty(model, hrany);
    // příliš velké sražení / zaoblení (přes půl stěny)
    {
      const r = new Set(segs.filter(q => q.prilis).map(q => q.rid));
      if (r.size) varovani.push(`${r.size} ${r.size === 1 ? 'hrana má' : r.size < 5 ? 'hrany mají' : 'hran má'} sražení nebo zaoblení větší než polovina sousední stěny – úpravy z protějších hran se potkají a tvar se změní víc, než asi chcete. Zmenšete velikost.`);
    }
    // limit trojúhelníků i pro zaoblení: když by síť přesáhla limit, dílky
    // oblouku se rovnoměrně zhrubí (a dá se vědět)
    if (segs.length && volby.limitT) {
      const rozpocet = Math.max(volby.limitT * 0.8 - model.tri.length / 3, volby.limitT * 0.1);
      let odh = odhadZaobleni(segs);
      if (odh > rozpocet) {
        const q = Math.sqrt(rozpocet / odh);
        const puv = Math.max(...segs.map(s => s.M));
        for (const s of segs) if (s.op.typ === 'zaobl') s.M = Math.max(1, Math.floor(s.M * q));
        odh = odhadZaobleni(segs);
        const nove = Math.max(...segs.map(s => s.M));
        varovani.push(odh > rozpocet
          ? `Hran se zaoblením je na limit ${Math.round(volby.limitT / 1000)} tisíc trojúhelníků příliš mnoho – zaoblení je zjednodušené a může být nepřesné.`
          : `Zaoblení zhrubeno na ${2 * nove} ${2 * nove < 5 ? 'dílky' : 'dílků'} oblouku (místo ${2 * puv}), aby se síť vešla do limitu ${Math.round(volby.limitT / 1000)} tisíc trojúhelníků.`);
        omezeno = true;
        if (odh > rozpocet) segs.zjednodusit = true;
      }
    }
    // 0) kontrola tloušťky stěny pod vzorem, který se do ní ryje – i z obou
    //    stran (vnější a vnitřní stěna hrnku se vzorem: hloubky se sčítají)
    {
      const hlR = rid => {
        const q = VY.proj.get(rid);
        let h = q && q.s.smer !== 'ven' ? q.s.hloubka : 0;
        for (const d of VY.obtPodle.get(rid) || []) if (d.smer !== 'ven') h = Math.max(h, d.hloubka);
        return h;
      };
      // hloubka v konkrétním bodě: vzor jen uvnitř výřezu / pásu, nápis jen pod sebou
      const hlBod = (rid, x) => {
        const q = VY.proj.get(rid), o = model.oblasti[rid];
        let h = q && q.s.smer !== 'ven' && VY.pas(q.s, x) > 0 ? q.s.hloubka : 0;
        for (const d of VY.obtPodle.get(rid) || []) if (d.smer !== 'ven' && d.h(x, o.normala) > 0) h = Math.max(h, d.hloubka);
        return h;
      };
      // vzorky uvnitř výřezu (mřížka 7 × 7 přes čtyřúhelník), jinak po ploše
      const vzorkyVyrezu = rid => {
        const q = VY.proj.get(rid), b = q && q.s.vyrez;
        if (!Array.isArray(b) || b.length !== 4) return null;
        const n = model.oblasti[rid].normala, out = [];
        for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
          const u = (i + 0.5) / 7.5, v = (j + 0.5) / 7.5;
          const c = add(mul(add(mul(b[0], 1 - u), mul(b[1], u)), 1 - v), mul(add(mul(b[3], 1 - u), mul(b[2], u)), v));
          out.push({ c, n });
        }
        return out;
      };
      const hotovo = new Set();
      for (const rid of new Set([...VY.proj.keys(), ...VY.obtPodle.keys()])) {
        const hl = hlR(rid);
        if (!hl || hotovo.has(rid)) continue;
        const z = zbytekSteny(model, rid, hlBod, vzorkyVyrezu(rid));
        if (!z) continue;
        const obe = z.obe;
        const celkem = z.tloustka - z.zbytek;
        if (obe) hotovo.add(z.protejsi);
        // zbytek pod 0,8 mm (dva obvody trysky 0,4) nebo pod pětinu stěny
        if (z.zbytek < Math.max(0.8, 0.2 * z.tloustka)) varovani.push(`Pozor: na ploše ${rid + 1} je stěna silná jen ${z.tloustka.toFixed(1)} mm a ` + (obe ? `vzor se do ní ryje z obou stran (s plochou ${z.protejsi + 1}) celkem ${celkem.toFixed(1)} mm` : `vzor se ryje ${celkem.toFixed(1)} mm hluboko`) + ' – ' + (z.zbytek <= 0 ? 'stěnu prorazí!' : `zůstane jen ${z.zbytek.toFixed(1)} mm.`) + ' Zmenšete hloubku nebo zvolte „Vystoupit“.');
      }
    }
    // tisk v této poloze: spodní plocha leží na podložce
    {
      const dno = model.oblasti.filter(o => o.tvar === 'rovina' && o.normala[2] < -0.99 && Math.abs(o.stred[2] - model.box.min[2]) < model.box.uhlopricka * 1e-4).map(o => o.id);
      const naDne = dno.filter(rid => VY.maPlochu(rid));
      if (naDne.length) varovani.push(`Tip pro tisk: ${naDne.length > 1 ? 'plochy ' + naDne.map(r => r + 1).join(', ') + ' leží' : 'plocha ' + (naDne[0] + 1) + ' leží'} na podložce a ${naDne.length > 1 ? 'mají' : 'má'} vzor nebo nápis – první vrstva nebude rovná a model se hůř přichytí. Spodní plochu nechte hladkou, nebo model otočte.`);
      let zaobleneDno = 0;
      for (const r of model.retezy) {
        const u = hrany.get(r.id);
        if (u && u.typ === 'zaobl' && u.velikost >= 1 && (dno.includes(r.rA) || dno.includes(r.rB))) zaobleneDno++;
      }
      if (zaobleneDno) varovani.push(`Tip pro tisk: ${zaobleneDno} ${zaobleneDno === 1 ? 'hrana u podložky je zaoblená' : zaobleneDno < 5 ? 'hrany u podložky jsou zaoblené' : 'hran u podložky je zaoblených'} – spodek oblouku se tiskne jako převis a okraj se může zvlnit. U podložky je lepší sražení (fazeta 45°).`);
    }
    // spáry užší než tryska (0,4 mm) se nevytisknou
    {
      const uzke = [];
      for (const [rid, q] of VY.proj) {
        const inf = G.VZORY && G.VZORY.podleId(q.s.vzor);
        const def = inf && inf.parametry.find(x => x.id === 'spara');
        if (!def) continue;
        const sp = ((q.s.parametry && q.s.parametry.spara) ?? def.vych) * q.s.sirka;
        if (sp < 0.4 && !uzke.some(x => x.vzor === q.s.vzor && Math.abs(x.sp - sp) < 1e-6)) uzke.push({ vzor: q.s.vzor, nazev: inf.nazev, sp, rid });
      }
      for (const u of uzke) varovani.push(`Tip pro tisk: spáry vzoru „${u.nazev}“ jsou široké jen ${u.sp.toFixed(2).replace('.', ',')} mm – tryska 0,4 mm je nevykreslí a svislé spáry zmizí. Zvětšete vzor nebo spáru (aspoň 0,4–0,5 mm).`);
    }
    // obtisky, které přesahují svou plochu (na hraně se oříznou)
    (zadani.obtisky || []).forEach((d, i) => {
      const ob = (VY.obtPodle.get(d.plocha) || []).find(q => q.bod === d.bod);
      if (!ob) return;
      const f = presahObtisku(model, ob);
      if (f > 0.03) varovani.push(`Nápis ${d.popis ? '„' + d.popis + '“ ' : (i + 1) + ' '}přesahuje plochu, na které je (asi ${Math.round(f * 100)} % mimo) – na hraně se ořízne. Zmenšete ho nebo posuňte.`);
    });
    prubeh(0.05, 'Zjemňuji síť');
    // 1) zjemnění ploch se strukturou – na původní síti vyjdou rovnoměrné
    //    trojúhelníky; na síti rozřezané pro zaoblení by tenké vějíře
    //    zjemnění rozbujely (až 4× víc trojúhelníků)
    zjemniStruktury();
    prubeh(0.55, 'Zaobluji hrany');
    // 2) řezy pro sražení/zaoblení
    if (segs.length) {
      rozrizni(sit, model, segs, tol);
      // jemnější dělení podél zaoblení (oblouk na zakřivených řetězcích)
      const najdi = mrizkaSegmentu(segs);
      // Žádný trojúhelník nesmí v pásu překlenout víc řad oblouku, jinak se
      // po promítnutí přeloží (vějíře víček, rohy). Podél hrany stačí hrubší.
      sit.zjemni((a, b, l) => {
        const A = sit.bod(a), B = sit.bod(b), M = mul(add(A, B), 0.5);
        let best = null, bd = Infinity;
        for (const s of najdi(M)) {
          const d = vzdalenostKSegmentu(M, s);
          if (d <= s.t * 1.5 && d < bd) { bd = d; best = s; }
        }
        if (!best) return false;
        const s = best;
        let krok = krokZaobleni(s);
        const e = sub(B, A), podel = Math.abs(dot(e, s.d)), napric = len(sub(e, mul(s.d, dot(e, s.d))));
        // pás přechodu u rohu s různými úpravami: úprava se tu zužuje, síť musí
        // být jemná ve všech směrech, jinak velké trojúhelníky zúžení nesledují
        if (s.konf && s.konf.some(c => len(sub(M, c.bod)) < s.Ltr + s.t)) { krok = Math.min(krok, s.t * 0.3); return l > krok; }
        // na zakřiveném řetězci (krátké segmenty) se nesmí překlenout oblouk
        return napric > krok || podel > Math.max(krok, Math.min(Math.max(krok * 6, s.t * 2), s.L * 1.5));
      }, segs.zjednodusit ? 4 : 14, volby.limitT);
    }
    function zjemniStruktury() {
      if (!VY.proj.size && !VY.obtPodle.size) return;
      // „jemnost“ = délka hrany v detailech vzoru; rovná místa stačí 3× řidší
      // a hrany cihel, spáry apod. se pak doostří adaptivně
      const ostr = volby.doostrit !== false;
      let jd = volby.jemnost;
      // Jemnost se předem zvětší, aby se síť vešla do limitu – zjemnění
      // utnuté v půlce by bylo nerovnoměrné (viditelné švy).
      if (volby.limitT) {
        const jLim = jemnostProLimit(model, struktury, zadani.obtisky, jd, volby.limitT);
        if (jLim > jd * 1.001) {
          varovani.push(`Jemnost zvětšena na ${jLim.toFixed(2)} mm, aby síť nepřesáhla ${Math.round(volby.limitT / 1000)} tisíc trojúhelníků.`);
          jd = jLim; omezeno = true;
        }
      }
      const j = ostr ? jd * 3 : jd;
      // obtisk zjemňuje jen svoje okolí, struktura celou plochu
      const blizko = (rid, x) => {
        const ob = VY.obtPodle.get(rid);
        if (ob) for (const d of ob) if (len(sub(x, d.bod)) < d.R + 3 * j) return true;
        return false;
      };
      const maStr = ti => VY.maPlochu(model.oblast[sit.o[ti]]);
      const vZone = (a, b, ti) => {
        const r = model.oblast[sit.o[ti]];
        return VY.proj.has(r) || blizko(r, mul(add(sit.bod(a), sit.bod(b)), 0.5));
      };
      const ok = sit.zjemni((a, b, l, ti) => l > j && vZone(a, b, ti), 40, volby.limitT, maStr);
      if (!ok) { omezeno = true; varovani.push('Síť narazila na limit počtu trojúhelníků – struktura je hrubší. Zvětšete „Jemnost“ nebo zmenšete plochu.'); return; }
      prubeh(0.3, 'Doostřuji vzor');
      // hranice pásů výšky rovně (řez rovinou)
      const zMin = model.box.min[2];
      for (const [rid, q] of VY.proj) for (const z of [q.s.pasOd, q.s.pasDo]) {
        if (z > 0) rezRovinou(sit, [0, 0, 1], zMin + z, ti => model.oblast[sit.o[ti]] === rid, tol);
      }
      // hranice výřezu rovně (řez rovinou kolmou na plochu podél každé hrany)
      for (const [rid, q] of VY.proj) for (const h of hranyVyrezu(q.s) || []) rezRovinou(sit, h.m, h.k, ti => model.oblast[sit.o[ti]] === rid, tol);
      if (!ostr) return;
      const posunV = (x, t) => VY.posun(model.oblast[t], x, Nt(model.N, t));
      const cache = new Map();
      const h = (v, ti) => { let x = cache.get(v); if (x === undefined) { x = posunV(sit.bod(v), sit.o[ti]); cache.set(v, x); } return x; };
      const jMin = jd * 1.05;
      sit.zjemni((a, b, l, ti) => {
        if (l <= jMin) return false;
        const ref = VY.hRef(model.oblast[sit.o[ti]]);
        if (!ref) return false;
        const ha = h(a, ti), hb = h(b, ti);
        if (Math.abs(ha - hb) > 0.22 * ref) return true;
        const hm = posunV(mul(add(sit.bod(a), sit.bod(b)), 0.5), sit.o[ti]);
        return Math.abs(hm - (ha + hb) / 2) > 0.18 * ref;
      }, 4, volby.limitT ? volby.limitT * 1.2 : 0, maStr);
    }
    // 3) posun vrcholů na sražení / zaoblení
    let pohnuto = null;
    if (segs.length) {
      const r = promitniVrcholy(sit, segs, tol);
      pohnuto = r.pohnuto;
      if (r.neslo) varovani.push(model.nemanif
        ? `Model má ${model.nemanif} ${model.nemanif === 1 ? 'hranu' : 'hran'}, kde se stýkají víc než dvě plochy (např. dvě tělesa dotýkající se hranou) – tam zaoblení ani sražení nejde. Upravte model tak, aby tělesa byla oddělená nebo spojená.`
        : `U ${r.neslo} vrcholů se zaoblení nevešlo (poloměr je větší než stěna) – zkuste menší rozměr.`);
    }
    prubeh(0.75, 'Vtlačuji vzor');
    // 4) struktura a obtisky
    let maxR = 0, maxHl = 0;
    for (const q of segs) maxR = Math.max(maxR, q.t);
    for (const [, q] of VY.proj) { maxR = Math.max(maxR, q.s.hloubka); maxHl = Math.max(maxHl, q.s.hloubka); }
    const maStruktury = VY.proj.size || VY.obtPodle.size;
    const p0 = maStruktury ? sit.p.slice(0, sit.pocetV * 3) : null;
    let v, tlum = null;
    // Roh obtočeného vzoru: vrcholy se posunou do průsečíku obou reliéfů. U
    // hlubokého reliéfu by správně drážka jedné stěny prošla skrz druhou, což
    // výšková mapa stěny neumí – síť se tam může protnout. Proto kontrola:
    // kde se najde průnik, nastoupí v okolí plynulý náběh k hraně (dokázaně
    // bez průniku); okolí 2·h, pak 6·h, nakonec náběh na všech obtočených rozích.
    const body = [];
    let rohove = null;
    for (let kolo = 0; ; kolo++) {
      let uRohu = null;
      if (maStruktury) uRohu = aplikujStruktury(sit, model, VY, pohnuto, tlum);
      prubeh(0.9, 'Uklízím síť');
      v = sit.vystup();
      // úklid přeložených drobných trojúhelníků u zaoblení a rohů vzoru
      let maska = null;
      for (const m of [pohnuto, uRohu]) if (m) { if (!maska) maska = new Uint8Array(sit.pocetV); for (let i = 0; i < m.length; i++) if (m[i]) maska[i] = 1; }
      if (maska) v = uklidPrelozene(v, tol, model, maxR, maska);
      v = vycisti(v, tol * 0.05);
      if (uRohu && uRohu.rohove.length) rohove = uRohu.rohove;
      if (!uRohu || !uRohu.rohove.length || volby.kontrolaRohu === false || kolo === 3) break;
      const pr = prunikyKolem(v, uRohu.rohove, 3 * maxHl + volby.jemnost * 2, model);
      if (!pr.length) break;
      prubeh(0.92, 'Opravuji rohy vzoru');
      for (const x of pr) body.push(x);
      if (kolo === 2) { tlum = () => 0; tlum.vsude = true; }         // nakonec náběh na všech obtočených rozích (bez kontroly – dokázané)
      else {
        const rho = 2 * maxHl * (kolo ? 3 : 1), m = new Map();
        // problémové body se slijí po buňkách rho/8 (průniky jdou v hloučcích po
        // stovkách – útlum počítaný přes všechny trval u hlubokého kamene 4 s)
        const jemne = new Set(), q = rho / 8;
        for (const x of body) {
          const fi = Math.floor(x[0] / q), fj = Math.floor(x[1] / q), fk = Math.floor(x[2] / q), kf = fi + ',' + fj + ',' + fk;
          if (jemne.has(kf)) continue;
          jemne.add(kf);
          const c = [(fi + 0.5) * q, (fj + 0.5) * q, (fk + 0.5) * q];
          const k = hashBunky(Math.floor(c[0] / rho), Math.floor(c[1] / rho), Math.floor(c[2] / rho)); const l = m.get(k); if (l) l.push(c); else m.set(k, [c]);
        }
        const rho2 = rho * rho;
        tlum = x => {
          const i0 = Math.floor(x[0] / rho), j0 = Math.floor(x[1] / rho), k0 = Math.floor(x[2] / rho);
          let d2 = Infinity;
          for (let i = i0 - 2; i <= i0 + 2; i++) for (let j = j0 - 2; j <= j0 + 2; j++) for (let k = k0 - 2; k <= k0 + 2; k++) {
            const l = m.get(hashBunky(i, j, k));
            if (l) for (const b of l) {
              const dx = b[0] - x[0], dy = b[1] - x[1], dz = b[2] - x[2], e = dx * dx + dy * dy + dz * dz;
              if (e < d2) { d2 = e; if (d2 <= rho2) return 0; }
            }
          }
          const d = Math.sqrt(d2);
          return hladce((d - rho) / rho);   // do rho náběh, za 2·rho původní roh
        };
      }
      sit.p.set(p0);
    }
    // hlásit, jen když náběh zasáhl podstatnou část rohů (drobné opravy pár
    // míst by byly jen planý poplach)
    let podil = 0;
    if (tlum && rohove) { let n = 0; for (let i = 0; i < rohove.length; i += 3) if (tlum([rohove[i], rohove[i + 1], rohove[i + 2]]) < 0.5) n++; podil = n / (rohove.length / 3); }
    if (tlum && (tlum.vsude || podil > 0.15)) varovani.push(tlum.vsude
      ? 'Reliéf je na obtočení kolem rohů moc hluboký – vzor na rozích plynule nabíhá k hraně místo obtočení (jinak by se roh sám protnul). Mělčí vzor se obtočí celý.'
      : 'Na některých místech rohů je reliéf na obtočení moc hluboký – vzor tam k hraně plynule nabíhá (jinak by se roh sám protnul). Mělčí vzor se obtočí celý.');
    v.varovani = varovani; v.omezeno = omezeno;
    prubeh(1, 'Hotovo');
    return v;
  }

  /* Úklid po zaoblení: na mnohoúhelníkových válcích zůstane pár drobných
     „přeložených“ trojúhelníků (normála proti okolí nebo otočená o víc než
     120° proti původní ploše – zaoblení hrany do 120° to nikdy neudělá).
     Jejich nejkratší hrana se stáhne do bodu a vycisti() pak vyhodí vzniklé
     nulové trojúhelníky. Hledá se jen u vrcholů, které zaoblení posunulo. */
  function uklidPrelozene(v, tol, model, maxR, pohnuto) {
    const malaPlocha = maxR * maxR * 0.3;
    // nejdřív sloučit vrcholy se shodnou polohou (přichycené na roh)
    {
      const r = vycisti(v, tol * 0.05, true);
      const np = new Uint8Array(r.pos.length / 3);
      for (let i = 0; i < pohnuto.length; i++) if (pohnuto[i] && r.mapa[i] >= 0) np[r.mapa[i]] = 1;
      pohnuto = np; v = r;
    }
    for (let kolo = 0; kolo < 12; kolo++) {
      const { pos, tri } = v;
      const nT = tri.length / 3, nV = pos.length / 3;
      const N = new Float64Array(nT * 3), vn = new Float64Array(nV * 3);
      for (let t = 0; t < nT; t++) {
        const a = tri[3 * t] * 3, b = tri[3 * t + 1] * 3, c = tri[3 * t + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const wx = pos[c] - pos[a], wy = pos[c + 1] - pos[a + 1], wz = pos[c + 2] - pos[a + 2];
        const x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx;
        N[3 * t] = x; N[3 * t + 1] = y; N[3 * t + 2] = z;
        for (const i of [a, b, c]) { vn[i] += x; vn[i + 1] += y; vn[i + 2] += z; }
      }
      const sbalit = [];
      const pouzity = new Uint8Array(nV);
      for (let t = 0; t < nT; t++) {
        const ia = tri[3 * t], ib = tri[3 * t + 1], ic = tri[3 * t + 2];
        if (!pohnuto[ia] && !pohnuto[ib] && !pohnuto[ic]) continue;
        const nt = [N[3 * t], N[3 * t + 1], N[3 * t + 2]], lt = len(nt);
        if (lt < 1e-14) continue;
        let o = [0, 0, 0];
        for (const i of [ia, ib, ic]) o = add(o, sub([vn[3 * i], vn[3 * i + 1], vn[3 * i + 2]], nt));
        const proti = dot(nt, o) < -0.3 * lt * len(o);
        const otoceny = lt / 2 < malaPlocha && dot(nt, Nt(model.N, v.puvod[t])) < -0.5 * lt;
        if (!proti && !otoceny) continue;
        let best = Infinity, ka = 0, kb = 0;
        for (let k = 0; k < 3; k++) {
          const i = tri[3 * t + k], j = tri[3 * t + (k + 1) % 3];
          const d = len(sub(P(pos, i), P(pos, j)));
          if (d < best) { best = d; ka = i; kb = j; }
        }
        if (pouzity[ka] || pouzity[kb]) continue;
        pouzity[ka] = pouzity[kb] = 1;
        sbalit.push(ka, kb);
      }
      if (!sbalit.length) break;
      // stažení hrany: vrchol j se přečísluje na i (známé dvojice – bez hledání
      // shodných poloh), trojúhelníky, které tím zdegenerují, zmizí
      const prec = new Int32Array(nV);
      for (let i = 0; i < nV; i++) prec[i] = i;
      for (let q = 0; q < sbalit.length; q += 2) {
        const i = sbalit[q], j = sbalit[q + 1];
        for (let k = 0; k < 3; k++) pos[3 * i + k] = (pos[3 * i + k] + pos[3 * j + k]) / 2;
        prec[j] = i;
      }
      const nt = new Uint32Array(tri.length), np = new Int32Array(nT);
      let m = 0;
      for (let t = 0; t < nT; t++) {
        const a = prec[tri[3 * t]], b = prec[tri[3 * t + 1]], c = prec[tri[3 * t + 2]];
        if (a === b || b === c || a === c) continue;
        nt[3 * m] = a; nt[3 * m + 1] = b; nt[3 * m + 2] = c; np[m++] = v.puvod[t];
      }
      v = { pos, tri: nt.slice(0, m * 3), puvod: np.slice(0, m) };
    }
    return v;
  }

  /* Sloučí vrcholy, které sražení stáhlo do jednoho bodu, a vyhodí
     trojúhelníky s nulovou plochou, které tím vzniknou. Číselná mřížka
     (klíč buňky) + kontrola sousedních buněk, ne textové klíče. */
  function vycisti(v, tol, sMapou) {
    const { pos, tri, puvod } = v;
    const nV = pos.length / 3, mapa = new Int32Array(nV).fill(-1);
    const pouzity = new Uint8Array(nV);
    for (let i = 0; i < tri.length; i++) pouzity[tri[i]] = 1;   // nepoužité vrcholy se nepřenesou (OBJ by je vypsal)
    // buňky v typované hašovací tabulce (otevřené adresování): klíč = souřadnice
    // buňky, hodnota = první vrchol; další vrcholy buňky v řetězu `dalsi`
    let vel = 1024; while (vel < nV * 2) vel *= 2;
    const KI = new Int32Array(vel * 3), hlava = new Int32Array(vel).fill(-1), dalsi = new Int32Array(nV);
    const maska = vel - 1;
    const slot = (i, j, k) => {
      let h = hashBunky(i, j, k) & maska;
      while (hlava[h] >= 0 && (KI[3 * h] !== i || KI[3 * h + 1] !== j || KI[3 * h + 2] !== k)) h = (h + 1) & maska;
      return h;
    };
    const novePos = new Float64Array(nV * 3), c2 = 2 * tol;
    let n = 0;
    for (let i = 0; i < nV; i++) {
      if (!pouzity[i]) continue;
      const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
      // buňka 2·tol: soused do tol leží jen v buňce na bližší straně → 8 buněk místo 27
      const fx = x / c2, fy = y / c2, fz = z / c2;
      const bi = Math.floor(fx), bj = Math.floor(fy), bk = Math.floor(fz);
      const si = fx - bi < 0.5 ? -1 : 1, sj = fy - bj < 0.5 ? -1 : 1, sk = fz - bk < 0.5 ? -1 : 1;
      let j = -1;
      for (let di = 0; di <= 1 && j < 0; di++) for (let dj = 0; dj <= 1 && j < 0; dj++) for (let dk = 0; dk <= 1 && j < 0; dk++) {
        const h = slot(bi + di * si, bj + dj * sj, bk + dk * sk);
        for (let q = hlava[h]; q >= 0; q = dalsi[q]) {
          if (Math.abs(novePos[3 * q] - x) <= tol && Math.abs(novePos[3 * q + 1] - y) <= tol && Math.abs(novePos[3 * q + 2] - z) <= tol) { j = q; break; }
        }
      }
      if (j < 0) {
        j = n++;
        novePos[3 * j] = x; novePos[3 * j + 1] = y; novePos[3 * j + 2] = z;
        const h = slot(bi, bj, bk);
        if (hlava[h] < 0) { KI[3 * h] = bi; KI[3 * h + 1] = bj; KI[3 * h + 2] = bk; }
        dalsi[j] = hlava[h]; hlava[h] = j;
      }
      mapa[i] = j;
    }
    const nt = new Uint32Array(tri.length), np = new Int32Array(tri.length / 3);
    let m = 0;
    for (let t = 0; t < tri.length / 3; t++) {
      const a = mapa[tri[3 * t]], b = mapa[tri[3 * t + 1]], c = mapa[tri[3 * t + 2]];
      if (a === b || b === c || a === c) continue;
      nt[3 * m] = a; nt[3 * m + 1] = b; nt[3 * m + 2] = c; np[m++] = puvod[t];
    }
    const out = { pos: novePos.slice(0, n * 3), tri: nt.slice(0, m * 3), puvod: np.slice(0, m) };
    if (sMapou) out.mapa = mapa;
    return out;
  }

  // průměrná plocha trojúhelníku po zjemnění ≈ HUSTOTA · jemnost² (změřeno;
  // dnes jen pro okolí obtisků – vzor na ploše odhaduje simulace půlení)
  const HUSTOTA = 0.2;
  /* Kolik trojúhelníků dá půlení nejdelší hrany, dokud nejsou všechny hrany
     ≤ l (jeden trojúhelník zvlášť). Tenké trojúhelníky (pruhy válců, vějíře
     víček) se půlí doopravdy – dají mnohonásobně víc, než odpovídá ploše;
     dobře tvarované se dopočítají (≈ 6·A/l², změřeno). */
  // Počet závisí jen na tvaru a poměru velikosti k l a půlení vyrábí pořád
  // tytéž tvary – výsledek se pamatuje podle (seřazené poměry hran, log₂ m/l²).
  const pametListu = new Map();
  function listyTroj(p, q, r, l2) {
    const x = dist2(p, q), y = dist2(q, r), z = dist2(r, p), m = Math.max(x, y, z);
    if (m <= l2) return 1;
    const A = len(cross(sub(q, p), sub(r, p))) / 2;
    if (m < 6 * A) return Math.max(1, 6 * A / l2);
    const ser = [x / m, y / m, z / m].sort((u, v) => u - v);
    const kl = ser[0].toFixed(4) + ',' + ser[1].toFixed(4) + ',' + Math.round(Math.log2(m / l2) * 16);
    const zn = pametListu.get(kl);
    if (zn !== undefined) return zn;
    let n;
    if (m === x) { const s = mul(add(p, q), 0.5); n = listyTroj(p, s, r, l2) + listyTroj(s, q, r, l2); }
    else if (m === y) { const s = mul(add(q, r), 0.5); n = listyTroj(q, s, p, l2) + listyTroj(s, r, p, l2); }
    else { const s = mul(add(r, p), 0.5); n = listyTroj(r, s, q, l2) + listyTroj(s, p, q, l2); }
    if (pametListu.size > 200000) pametListu.clear();
    pametListu.set(kl, n);
    return n;
  }
  function listyPuleni(model, t, l2) {
    const { pos, tri } = model;
    return listyTroj(P(pos, tri[3 * t]), P(pos, tri[3 * t + 1]), P(pos, tri[3 * t + 2]), l2);
  }
  // skutečný počet po zjemnění a doostření je 0,5–1× počet listů (změřeno na
  // ukázkách 0,4–1,5 mm, cihly/kámen) – bere se horní polovina
  const PODIL_LISTU = 0.8;
  function odhadTrojuhelniku(model, struktury, jemnost, obtisky) {
    const l2 = jemnost * jemnost;
    let n = 0, sVzorem = 0;
    for (const [rid, s] of struktury) {
      const o = model.oblasti[rid];
      if (!o) continue;
      let m = 0;
      for (const t of o.tri) m += PODIL_LISTU * listyPuleni(model, t, l2);
      // výřez: jen jeho část plochy (s rezervou na zjemnění podél okraje)
      const b = s && Array.isArray(s.vyrez) && s.vyrez.length >= 3 ? s.vyrez : null;
      if (b && o.plocha > 0) {
        let a = [0, 0, 0];
        for (let i = 1; i + 1 < b.length; i++) a = add(a, cross(sub(b[i], b[0]), sub(b[i + 1], b[0])));
        m *= Math.min(1, 1.3 * len(a) / 2 / o.plocha);
      }
      n += m;
      sVzorem += o.tri.length;
    }
    let pl = 0;
    for (const d of obtisky || []) if (d.sirka > 0) pl += Math.pow(d.sirka * 1.3, 2);
    return Math.round(n + pl / (HUSTOTA * l2) + model.tri.length / 3 - sVzorem);
  }
  /* Nejmenší jemnost ≥ j, při které odhad nepřesáhne limit. */
  function jemnostProLimit(model, struktury, obtisky, j, limit) {
    if (odhadTrojuhelniku(model, struktury, j, obtisky) <= limit) return j;
    let lo = j, hi = j * 2;
    while (odhadTrojuhelniku(model, struktury, hi, obtisky) > limit && hi < model.box.uhlopricka) { lo = hi; hi *= 2; }
    for (let i = 0; i < 12; i++) { const m = Math.sqrt(lo * hi); if (odhadTrojuhelniku(model, struktury, m, obtisky) > limit) lo = m; else hi = m; }
    return hi;
  }

  /* =====================================================================
     KONTROLY A EXPORT
     ===================================================================== */
  /* =====================================================================
     ROZDĚLENÍ ROVINOU (velký model na dva díly pro tisk)
     ===================================================================== */
  /* Triangulace mnohoúhelníků s dírami ve 2D (ořezávání uší). smycky = pole
     smyček indexů do xy (Float64Array 2·n); vnější smyčky jsou proti směru
     hodinových ručiček, díry po směru. Díry se napojí „mostem“ na nejbližší
     viditelný vrchol vnější smyčky. Vrací trojice indexů. */
  function triangulujSDirami(xy, smycky) {
    const X = i => xy[2 * i], Y = i => xy[2 * i + 1];
    const plocha = l => { let a = 0; for (let i = 0; i < l.length; i++) { const p = l[i], q = l[(i + 1) % l.length]; a += X(p) * Y(q) - X(q) * Y(p); } return a / 2; };
    const uvnitr = (x, y, l) => {
      let c = false;
      for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
        const xi = X(l[i]), yi = Y(l[i]), xj = X(l[j]), yj = Y(l[j]);
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const o2 = (a, b, c) => (X(b) - X(a)) * (Y(c) - Y(a)) - (Y(b) - Y(a)) * (X(c) - X(a));
    const krizi = (a, b, c, d) => {                      // úsečky ab a cd se ostře kříží
      const d1 = o2(a, b, c), d2 = o2(a, b, d), d3 = o2(c, d, a), d4 = o2(c, d, b);
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    };
    const vnejsi = smycky.filter(l => l.length >= 3 && plocha(l) > 0).map(l => ({ l, A: plocha(l), diry: [] }));
    for (const l of smycky) {
      if (l.length < 3 || plocha(l) >= 0) continue;
      // nejmenší vnější smyčka, která díru obsahuje
      let best = null;
      for (const o of vnejsi) if (uvnitr(X(l[0]), Y(l[0]), o.l) && (!best || o.A < best.A)) best = o;
      if (best) best.diry.push(l);
    }
    const vysl = [];
    for (const o of vnejsi) {
      let poly = o.l.slice();
      // díry od té nejvíc vpravo
      o.diry.sort((a, b) => Math.max(...b.map(X)) - Math.max(...a.map(X)));
      for (const d of o.diry) {
        let mi = 0;
        for (let i = 1; i < d.length; i++) if (X(d[i]) > X(d[mi])) mi = i;
        const M = d[mi];
        const hrany = [];
        for (let i = 0; i < poly.length; i++) hrany.push([poly[i], poly[(i + 1) % poly.length]]);
        for (const e of o.diry) for (let i = 0; i < e.length; i++) hrany.push([e[i], e[(i + 1) % e.length]]);
        const kand = poly.map((p, i) => ({ i, d: (X(p) - X(M)) ** 2 + (Y(p) - Y(M)) ** 2 })).sort((a, b) => a.d - b.d);
        let pi = kand[0].i;
        for (const k of kand) {
          const P2 = poly[k.i];
          if (!hrany.some(([a, b]) => a !== P2 && b !== P2 && a !== M && b !== M && krizi(M, P2, a, b))) { pi = k.i; break; }
        }
        const dr = d.slice(mi).concat(d.slice(0, mi));
        poly = poly.slice(0, pi + 1).concat(dr, [M, poly[pi]], poly.slice(pi + 1));
      }
      // ořezávání uší
      const zbyva = poly.slice();
      let pojistka = zbyva.length * zbyva.length + 10;
      while (zbyva.length > 3 && pojistka-- > 0) {
        let nasel = false;
        for (let i = 0; i < zbyva.length; i++) {
          const a = zbyva[(i + zbyva.length - 1) % zbyva.length], b = zbyva[i], c = zbyva[(i + 1) % zbyva.length];
          if (o2(a, b, c) <= 1e-14) continue;              // nekonvexní nebo plochý vrchol
          let ucho = true;
          for (const q of zbyva) {
            if (q === a || q === b || q === c) continue;
            if (X(q) === X(a) && Y(q) === Y(a) || X(q) === X(b) && Y(q) === Y(b) || X(q) === X(c) && Y(q) === Y(c)) continue;
            if (o2(a, b, q) >= 0 && o2(b, c, q) >= 0 && o2(c, a, q) >= 0) { ucho = false; break; }
          }
          if (!ucho) continue;
          vysl.push(a, b, c); zbyva.splice(i, 1); nasel = true; break;
        }
        if (!nasel) {                                     // degenerovaný zbytek: vyhodit plochý vrchol
          let k = 0, m = Infinity;
          for (let i = 0; i < zbyva.length; i++) { const v = Math.abs(o2(zbyva[(i + zbyva.length - 1) % zbyva.length], zbyva[i], zbyva[(i + 1) % zbyva.length])); if (v < m) { m = v; k = i; } }
          zbyva.splice(k, 1);
        }
      }
      if (zbyva.length === 3 && o2(zbyva[0], zbyva[1], zbyva[2]) > 0) vysl.push(zbyva[0], zbyva[1], zbyva[2]);
    }
    return vysl;
  }

  /* Rozdělí uzavřenou síť rovinou x[osa] = c na dva uzavřené díly (řez se
     zavře víčkem). Vrací { dolni, horni } – každý { pos, tri } (svařené),
     nebo null, když je některý díl prázdný. */
  function rozdelRovinou(pos, tri, osa, c) {
    const nV = pos.length / 3;
    let rozsah = 0;
    for (let i = 0; i < nV; i++) rozsah = Math.max(rozsah, Math.abs(pos[3 * i + osa] - c));
    const eps = Math.max(1e-9, rozsah * 1e-7);
    const d = new Float64Array(nV), st = new Int8Array(nV);
    for (let i = 0; i < nV; i++) { d[i] = pos[3 * i + osa] - c; st[i] = d[i] > eps ? 1 : d[i] < -eps ? -1 : 0; }
    const P = Array.from(pos);
    for (let i = 0; i < nV; i++) if (!st[i]) P[3 * i + osa] = c;   // vrcholy u roviny přesně na ni
    const body = new Map();                            // průsečík hrany s rovinou (sdílený)
    const bod = (a, b) => {
      const k = a < b ? a * nV + b : b * nV + a;
      let i = body.get(k);
      if (i === undefined) {
        const t = d[a] / (d[a] - d[b]);
        i = P.length / 3;
        for (let q = 0; q < 3; q++) P.push(q === osa ? c : P[3 * a + q] + t * (P[3 * b + q] - P[3 * a + q]));
        body.set(k, i);
      }
      return i;
    };
    const dily = [[], []];                              // 0 = dolní (≤ c), 1 = horní
    const pridejPoly = (dil, l) => { for (let i = 1; i + 1 < l.length; i++) dily[dil].push(l[0], l[i], l[i + 1]); };
    for (let t = 0; t < tri.length / 3; t++) {
      const v = [tri[3 * t], tri[3 * t + 1], tri[3 * t + 2]], s = v.map(i => st[i]);
      if (!s.some(x => x > 0)) { if (s.some(x => x < 0)) dily[0].push(...v); continue; }   // celý dole (trojúhelník v rovině se zahodí)
      if (!s.some(x => x < 0)) { dily[1].push(...v); continue; }
      const dole = [], nahore = [];
      for (let k = 0; k < 3; k++) {
        const a = v[k], b = v[(k + 1) % 3];
        if (s[k] <= 0) dole.push(a);
        if (s[k] >= 0) nahore.push(a);
        if (s[k] * s[(k + 1) % 3] < 0) { const m = bod(a, b); dole.push(m); nahore.push(m); }
      }
      pridejPoly(0, dole); pridejPoly(1, nahore);
    }
    if (!dily[0].length || !dily[1].length) return null;
    const vystup = dil => {
      const T = dily[dil];
      // okrajové hrany dílu (použité jednou) leží v rovině řezu; víčko má hranu obráceně
      const pocet = new Map();
      for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
        const a = T[t + k], b = T[t + (k + 1) % 3], kl = a < b ? a * 1e7 + b : b * 1e7 + a;
        pocet.set(kl, (pocet.get(kl) || 0) + 1);
      }
      const dalsi = new Map();                         // obrácená okrajová hrana b → a
      for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
        const a = T[t + k], b = T[t + (k + 1) % 3], kl = a < b ? a * 1e7 + b : b * 1e7 + a;
        // jen hrany v rovině řezu (u otevřeného modelu zůstanou jeho díry dírami)
        if (pocet.get(kl) === 1 && Math.abs(P[3 * a + osa] - c) <= eps && Math.abs(P[3 * b + osa] - c) <= eps) { if (!dalsi.has(b)) dalsi.set(b, []); dalsi.get(b).push(a); }
      }
      const smycky = [];
      for (const [z] of dalsi) {
        while (dalsi.get(z) && dalsi.get(z).length) {
          const l = [z];
          let x = dalsi.get(z).pop();
          while (x !== z && x !== undefined && l.length < 1e7) { l.push(x); const n = dalsi.get(x); x = n && n.length ? n.pop() : undefined; }
          if (x === z && l.length >= 3) smycky.push(l);
        }
      }
      // 2D souřadnice v rovině řezu; víčko dolního dílu míří nahoru (+osa)
      const u = (osa + 1) % 3, w = (osa + 2) % 3;
      const xy = new Float64Array(P.length / 3 * 2);
      for (let i = 0; i < P.length / 3; i++) { xy[2 * i] = P[3 * i + u]; xy[2 * i + 1] = P[3 * i + w]; }
      // u horního dílu víčko míří dolů: zrcadlit 2D, aby vnější smyčky vyšly kladně
      if (dil === 1) for (let i = 0; i < P.length / 3; i++) xy[2 * i] = -xy[2 * i];
      const vicko = triangulujSDirami(xy, smycky);
      const vse = T.concat(vicko);
      return { tri: vse, smycek: smycky.length };
    };
    const dl = vystup(0), hr = vystup(1);
    const sbal = T => {                                // jen použité vrcholy
      const mapa = new Map(), p = [], t = [];
      for (const i of T) { let j = mapa.get(i); if (j === undefined) { j = p.length / 3; mapa.set(i, j); p.push(P[3 * i], P[3 * i + 1], P[3 * i + 2]); } t.push(j); }
      return { pos: Float64Array.from(p), tri: Uint32Array.from(t) };
    };
    return { dolni: sbal(dl.tri), horni: sbal(hr.tri), smycek: dl.smycek };
  }

  /* =====================================================================
     POLOHA PRO TISK
     ===================================================================== */
  // otočení, které pošle jednotkový vektor n dolů (na −Z): Rodrigues
  function rotaceDolu(n) {
    const c = -n[2];
    if (c > 1 - 1e-9) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    if (c < -1 + 1e-9) return [[1, 0, 0], [0, -1, 0], [0, 0, -1]];
    const v = [-n[1], n[0], 0];
    const K = [[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]];
    return [0, 1, 2].map(i => [0, 1, 2].map(j => (i === j ? 1 : 0) + K[i][j] + (K[i][0] * K[0][j] + K[i][1] * K[1][j] + K[i][2] * K[2][j]) / (1 + c)));
  }
  /* Převisy sítě při tisku po otočení R: plocha trojúhelníků, které hledí
     dolů víc než 45° od svislice a neleží na podložce; zároveň plocha na
     podložce a z toho plocha „se vzorem“ (vzor(t) → true). */
  function previsy(pos, tri, R, vzor) {
    const nV = pos.length / 3, nT = tri.length / 3, r = R[2];
    const z = new Float64Array(nV);
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < nV; i++) { const q = r[0] * pos[3 * i] + r[1] * pos[3 * i + 1] + r[2] * pos[3 * i + 2]; z[i] = q; if (q < zMin) zMin = q; if (q > zMax) zMax = q; }
    const tolZ = Math.max(0.05, (zMax - zMin) * 1e-3);
    let previs = 0, podlozka = 0, podlozkaVzor = 0;
    for (let t = 0; t < nT; t++) {
      const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
      const ux = pos[3 * b] - pos[3 * a], uy = pos[3 * b + 1] - pos[3 * a + 1], uz = pos[3 * b + 2] - pos[3 * a + 2];
      const vx = pos[3 * c] - pos[3 * a], vy = pos[3 * c + 1] - pos[3 * a + 1], vz = pos[3 * c + 2] - pos[3 * a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (!(l > 0)) continue;
      const nz2 = r[0] * nx + r[1] * ny + r[2] * nz;            // z-složka otočené normály
      if (nz2 > -0.7071 * l) continue;
      if (z[a] < zMin + tolZ && z[b] < zMin + tolZ && z[c] < zMin + tolZ) { podlozka += l / 2; if (vzor && vzor(t)) podlozkaVzor += l / 2; }
      else previs += l / 2;
    }
    return { previs, podlozka, podlozkaVzor, vyska: zMax - zMin };
  }
  /* Nejlepší poloha: kandidáti = „plocha dolů“ pro největší rovné plochy
     modelu (do 40) a šest směrů os. Skóre = převisy + 3 × vzor na podložce
     − 20 % opěrné plochy (1 cm² převisu = 5 cm² opory; při shodě nejmenší otočení). Počítá se na
     síti `vysledek` (se vzorem a hranami), plochy bere z modelu. */
  function nejlepsiPoloha(model, vysledek, sVzorem) {
    const v = vysledek || model;
    const kand = [];
    const ploch = model.oblasti.filter(o => o.tvar === 'rovina').sort((a, b) => b.plocha - a.plocha).slice(0, 40);
    for (const o of ploch) kand.push({ n: o.normala, plocha: o.id });
    for (const n of [[0, 0, -1], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) if (!kand.some(k => dot(k.n, n) > 0.999)) kand.push({ n, plocha: -1 });
    const vzor = !sVzorem || !sVzorem.size ? null : v.puvod ? t => sVzorem.has(model.oblast[v.puvod[t]]) : t => sVzorem.has(model.oblast[t]);
    const vys = kand.map(k => {
      const n = norm(k.n), R = rotaceDolu(n), p = previsy(v.pos, v.tri, R, vzor);
      return { ...k, n, R, ...p, skore: p.previs + 3 * p.podlozkaVzor - 0.2 * p.podlozka + 1e-4 * p.vyska };
    });
    // při shodě (do 0,5 % povrchu) vyhraje nejmenší otočení – nepřeklápět zbytečně
    let povrch = 0;
    for (const o of model.oblasti) povrch += o.plocha;
    const min = Math.min(...vys.map(x => x.skore)), tol = 0.005 * povrch + 1e-9;
    return vys.filter(x => x.skore <= min + tol).sort((a, b) => b.n[2] * -1 - a.n[2] * -1)[0];
  }

  function kontrola(sit) {
    const { pos, tri } = sit;
    const m = new Map();
    for (let t = 0; t < tri.length / 3; t++) for (let k = 0; k < 3; k++) {
      const a = tri[3 * t + k], b = tri[3 * t + (k + 1) % 3];
      const kk = klic(a, b);
      const e = m.get(kk) || [0, 0];
      e[0]++; e[1] += a < b ? 1 : -1;
      m.set(kk, e);
    }
    let otevrene = 0, spatne = 0;
    for (const [, e] of m) { if (e[0] === 1) otevrene++; else if (e[1] !== 0) spatne++; }
    let objem = 0;
    for (let t = 0; t < tri.length / 3; t++) {
      const a = P(pos, tri[3 * t]), b = P(pos, tri[3 * t + 1]), c = P(pos, tri[3 * t + 2]);
      objem += dot(a, cross(b, c)) / 6;
    }
    return { otevrene, spatne, objem, trojuhelniku: tri.length / 3 };
  }

  function exportSTL(sit, nazev) {
    const { pos, tri } = sit;
    const n = tri.length / 3;
    const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
    const hl = (nazev || 'povrch3d').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i) & 0x7f);
    dv.setUint32(80, n, true);
    for (let t = 0; t < n; t++) {
      const o = 84 + t * 50;
      const a = P(pos, tri[3 * t]), b = P(pos, tri[3 * t + 1]), c = P(pos, tri[3 * t + 2]);
      const nn = norm(cross(sub(b, a), sub(c, a)));
      for (let k = 0; k < 3; k++) dv.setFloat32(o + k * 4, nn[k], true);
      [a, b, c].forEach((p, j) => { for (let k = 0; k < 3; k++) dv.setFloat32(o + 12 + j * 12 + k * 4, p[k], true); });
    }
    return new Uint8Array(buf);
  }
  function exportOBJ(sit, nazev) {
    const { pos, tri } = sit;
    const r = ['# ' + (nazev || 'povrch3d'), 'o ' + (nazev || 'povrch3d').replace(/\s+/g, '_')];
    for (let i = 0; i < pos.length; i += 3) r.push(`v ${+pos[i].toFixed(5)} ${+pos[i + 1].toFixed(5)} ${+pos[i + 2].toFixed(5)}`);
    for (let t = 0; t < tri.length; t += 3) r.push(`f ${tri[t] + 1} ${tri[t + 1] + 1} ${tri[t + 2] + 1}`);
    return new TextEncoder().encode(r.join('\n') + '\n');
  }
  /* 3MF: vrcholy se nejdřív zhustí (nepoužité pryč). */
  function export3MF(sit, nazev) {
    const { pos, tri } = sit;
    const mapa = new Int32Array(pos.length / 3).fill(-1);
    const vv = [];
    for (const v of tri) if (mapa[v] < 0) { mapa[v] = vv.length; vv.push(v); }
    const casti = [];
    for (const v of vv) casti.push(`<vertex x="${+pos[3 * v].toFixed(5)}" y="${+pos[3 * v + 1].toFixed(5)}" z="${+pos[3 * v + 2].toFixed(5)}"/>`);
    const tt = [];
    for (let t = 0; t < tri.length; t += 3) tt.push(`<triangle v1="${mapa[tri[t]]}" v2="${mapa[tri[t + 1]]}" v3="${mapa[tri[t + 2]]}"/>`);
    const jm = (nazev || 'povrch3d').replace(/[<&"]/g, '');
    const model = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<model unit="millimeter" xml:lang="cs-CZ" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
      + `<metadata name="Title">${jm}</metadata><resources><object id="1" name="${jm}" type="model"><mesh><vertices>`
      + casti.join('') + '</vertices><triangles>' + tt.join('') + '</triangles></mesh></object></resources>'
      + '<build><item objectid="1"/></build></model>';
    const typy = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
    const enc = new TextEncoder();
    return zip([
      { jmeno: '[Content_Types].xml', data: enc.encode(typy) },
      { jmeno: '_rels/.rels', data: enc.encode(rels) },
      { jmeno: '3D/3dmodel.model', data: enc.encode(model) },
    ]);
  }
  /* ZIP bez komprese („uloženo“) + CRC32. */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(d) { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(soubory) {
    const enc = new TextEncoder();
    const casti = [], centralni = [];
    let pos = 0;
    for (const s of soubory) {
      const jm = enc.encode(s.jmeno);
      const crc = crc32(s.data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, s.data.length, true); h.setUint32(22, s.data.length, true);
      h.setUint16(26, jm.length, true);
      casti.push(new Uint8Array(h.buffer), jm, s.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(14, 0x21, true);
      c.setUint32(16, crc, true); c.setUint32(20, s.data.length, true); c.setUint32(24, s.data.length, true);
      c.setUint16(28, jm.length, true); c.setUint32(42, pos, true);
      centralni.push(new Uint8Array(c.buffer), jm);
      pos += 30 + jm.length + s.data.length;
    }
    const velC = centralni.reduce((a, b) => a + b.length, 0);
    const k = new DataView(new ArrayBuffer(22));
    k.setUint32(0, 0x06054b50, true); k.setUint16(8, soubory.length, true); k.setUint16(10, soubory.length, true);
    k.setUint32(12, velC, true); k.setUint32(16, pos, true);
    const vse = [...casti, ...centralni, new Uint8Array(k.buffer)];
    const out = new Uint8Array(vse.reduce((a, b) => a + b.length, 0));
    let o = 0;
    for (const v of vse) { out.set(v, o); o += v.length; }
    return out;
  }

  /* =====================================================================
     UKÁZKOVÉ MODELY (mm, osa Z nahoru)
     ===================================================================== */
  function hranol(poly, z0, z1) {
    // poly: konvexní mnohoúhelník proti směru hodinek (při pohledu shora)
    const out = [];
    const n = poly.length;
    const T = (a, b, c) => out.push(...a, ...b, ...c);
    for (let i = 1; i + 1 < n; i++) {
      T([...poly[0], z1], [...poly[i], z1], [...poly[i + 1], z1]);
      T([...poly[0], z0], [...poly[i + 1], z0], [...poly[i], z0]);
    }
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      T([...a, z0], [...b, z0], [...b, z1]);
      T([...a, z0], [...b, z1], [...a, z1]);
    }
    return out;
  }
  function rotacni(profil, n) {
    // profil: uzavřený mnohoúhelník [r, z] (r ≥ 0) proti směru hodinek v rovině r–z
    const out = [];
    const bod = (p, i) => { const f = 2 * Math.PI * i / n; return [p[0] * Math.cos(f), p[0] * Math.sin(f), p[1]]; };
    for (let k = 0; k < profil.length; k++) {
      const p = profil[k], q = profil[(k + 1) % profil.length];
      for (let i = 0; i < n; i++) {
        const a = bod(p, i), b = bod(q, i), c = bod(q, i + 1), d = bod(p, i + 1);
        out.push(...a, ...d, ...c, ...a, ...c, ...b);
      }
    }
    return out;
  }
  function koule(r, del) {
    const t = (1 + Math.sqrt(5)) / 2;
    let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let d = 0; d < del; d++) {
      const st = new Map(), nf = [];
      const mid = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if (!st.has(k)) { st.set(k, v.length); v.push(norm(add(v[a], v[b]))); } return st.get(k); };
      for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      f = nf;
    }
    const out = [];
    for (const [a, b, c] of f) out.push(...mul(v[a], r), ...mul(v[b], r), ...mul(v[c], r));
    return out;
  }
  function kruh(r, n, f0) { const o = []; for (let i = 0; i < n; i++) { const f = (f0 || 0) + 2 * Math.PI * i / n; o.push([r * Math.cos(f), r * Math.sin(f)]); } return o; }
  function prohodYZ(soup) {                 // (x, y, z) → (x, -z, y): hranol ležící na boku postaví
    const o = soup.slice();
    for (let i = 0; i < o.length; i += 3) { const y = o[i + 1], z = o[i + 2]; o[i + 1] = -z; o[i + 2] = y; }
    return o;
  }
  const UKAZKY = {
    kostka: { nazev: 'Kostka', fce: () => hranol([[-20, -20], [20, -20], [20, 20], [-20, 20]], 0, 40) },
    valec: { nazev: 'Válec', fce: () => hranol(kruh(20, 72), 0, 40) },
    domecek: {
      nazev: 'Domeček', fce: () => {
        // štít v rovině x–z, vytažený podél y
        const stit = [[-25, 0], [25, 0], [25, 28], [0, 46], [-25, 28]];
        return prohodYZ(hranol(stit, -18, 18));
      },
    },
    sestiboky: { nazev: 'Šestiboký sloupek', fce: () => hranol(kruh(18, 6, Math.PI / 6), 0, 45) },
    koule: { nazev: 'Koule', fce: () => koule(22, 4).map((v, i) => i % 3 === 2 ? v + 22 : v) },
    trubka: {
      nazev: 'Trubka', fce: () => rotacni([[15, 0], [20, 0], [20, 60], [15, 60]], 96),
    },
    hrnek: {
      nazev: 'Květináč', fce: () => rotacni([[0, 0], [20, 0], [26, 44], [23, 44], [17.5, 3], [0, 3]], 96),
    },
  };
  function ukazka(id) { return new Float32Array(UKAZKY[id].fce()); }

  G.POVRCH = {
    parseSTL, parseOBJ, parse3MF, nactiSoubor, svar, priprav, sestav, odhadTrojuhelniku, jemnostProLimit,
    kontrola, zakladRoviny, rotaceDolu, previsy, nejlepsiPoloha, rozdelRovinou, triangulujSDirami, exportSTL, exportOBJ, export3MF, zip, ukazka, UKAZKY, Sit, klic, projektor, HUSTOTA,
    tloustka, paprsek, nejtensi, presahObtisku, pripravObtisk, zjednodus,
    _ladeni: { pripravSegmenty, odhadZaobleni, nastavOdhad: k => { ODHAD_ZAOBLENI = k; }, rozrizni, promitniVrcholy, mrizkaSegmentu, uklidPrelozene, vycisti },
  };
}
povrchJadro(typeof window !== 'undefined' ? window : globalThis);
