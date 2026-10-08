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
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a); return l > 1e-300 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };

  /* =====================================================================
     NAČTENÍ
     ===================================================================== */
  function parseSTL(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength >= 84) {
      const n = dv.getUint32(80, true);
      if (84 + n * 50 === buf.byteLength) {
        const out = new Float32Array(n * 9);
        for (let i = 0; i < n; i++) {
          const o = 84 + i * 50 + 12;
          for (let k = 0; k < 9; k++) out[i * 9 + k] = dv.getFloat32(o + k * 4, true);
        }
        return out;
      }
    }
    const text = new TextDecoder().decode(new Uint8Array(buf));
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
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
      if (s.startsWith('v ')) { const q = s.split(/\s+/); v.push([+q[1], +q[2], +q[3]]); }
      else if (s.startsWith('f ')) {
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
  function svar(soup) {
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < soup.length; i += 3) for (let k = 0; k < 3; k++) {
      if (soup[i + k] < mn[k]) mn[k] = soup[i + k];
      if (soup[i + k] > mx[k]) mx[k] = soup[i + k];
    }
    const tol = Math.max(1e-9, len(sub(mx, mn)) * 1e-7);
    const mapa = new Map(), pos = [], tri = [];
    const id = i => {
      const k = Math.round(soup[i] / tol) + ',' + Math.round(soup[i + 1] / tol) + ',' + Math.round(soup[i + 2] / tol);
      let v = mapa.get(k);
      if (v === undefined) { v = pos.length / 3; pos.push(soup[i], soup[i + 1], soup[i + 2]); mapa.set(k, v); }
      return v;
    };
    for (let i = 0; i < soup.length; i += 9) {
      const a = id(i), b = id(i + 3), c = id(i + 6);
      if (a !== b && b !== c && a !== c) tri.push(a, b, c);
    }
    return { pos: Float64Array.from(pos), tri: Uint32Array.from(tri) };
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
      this.h = new Map();
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
    _registruj(ti) {
      for (let k = 0; k < 3; k++) {
        const kk = klic(this.t[3 * ti + k], this.t[3 * ti + (k + 1) % 3]);
        const e = this.h.get(kk);
        if (e === undefined) this.h.set(kk, ti);
        else if (typeof e === 'number') this.h.set(kk, [e, ti]);
        else e.push(ti);
      }
    }
    _odregistruj(ti) {
      for (let k = 0; k < 3; k++) {
        const kk = klic(this.t[3 * ti + k], this.t[3 * ti + (k + 1) % 3]);
        const e = this.h.get(kk);
        if (e === ti) this.h.delete(kk);
        else if (Array.isArray(e)) {
          const i = e.indexOf(ti);
          if (i >= 0) e.splice(i, 1);
          if (e.length === 1) this.h.set(kk, e[0]); else if (!e.length) this.h.delete(kk);
        }
      }
    }
    trojuhelnikyHrany(kk) {
      const e = this.h.get(kk);
      return e === undefined ? [] : typeof e === 'number' ? [e] : e.slice();
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
        // čtyřúhelník a, p, q, c – kratší úhlopříčka
        const dAQ = len(sub(this.bod(a), this.bod(q))), dPC = len(sub(this.bod(p), this.bod(c)));
        if (dAQ <= dPC) { this.pridejT(a, p, q, o); this.pridejT(a, q, c, o); }
        else { this.pridejT(a, p, c, o); this.pridejT(p, q, c, o); }
      }
    }

    /* Zjemnění půlením nejdelší hrany (Rivara): označí se hrany podle
       `delit(a, b, delka)`; trojúhelník s označenou hranou si vždy rozpůlí
       i svou nejdelší, takže tvar trojúhelníků zůstává rozumný. */
    zjemni(delit, maxKol, limitT, kandidat) {
      for (let kolo = 0; kolo < (maxKol || 40); kolo++) {
        const oznac = new Set();
        const nT = this.pocetT;
        for (let ti = 0; ti < nT; ti++) {
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
        this.rozdel(deleni);
        if (limitT && this.pocetZivych() > limitT * 1.3) return false;
      }
      return true;
    }
    _delka(a, b) {
      const p = this.p;
      return Math.hypot(p[3 * a] - p[3 * b], p[3 * a + 1] - p[3 * b + 1], p[3 * a + 2] - p[3 * b + 2]);
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
        out.push({ rid, op, P0, P1, L, d, nA, nB, a, b, cA: dot(nA, P0), cB: dot(nB, P0), fi: fiC, t, R, konv, rA: s.rA, rB: s.rB, va: s.a, vb: s.b, i: out.length });
      }
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

  /* Řezy: v každé ze dvou stěn segmentu se síť rozřízne rovinami
     rovnoběžnými s hranou ve vzdálenostech s (tečná čára + řady oblouku). */
  function odstupyRad(s) {
    if (s.op.typ !== 'zaobl') return [s.t];
    const M = Math.max(1, Math.ceil((s.op.segmenty || 8) / 2));
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
        vzdalenostKSegmentu(x, s) <= s.t * 1.0005 + tol &&
        dot(s.nA, x) - s.cA <= tol * 4 && dot(s.nB, x) - s.cB <= tol * 4);
      if (!kand.length) continue;
      // skupiny podle druhu (vypouklé zvlášť, vyduté zvlášť) a operace
      const skup = new Map();
      for (const s of kand) {
        const k = (s.konv ? 'k' : 'v') + s.op.typ + s.R;
        if (!skup.has(k)) skup.set(k, []);
        skup.get(k).push(s);
      }
      const poradi = [...skup.values()].sort((p, q) => (q[0].konv - p[0].konv) || (q[0].R - p[0].R));
      // Roh s různými poloměry: vrchol v dosahu obou dostane jen ten větší
      // (dvojí promítnutí za sebou by trojúhelníky v rohu přeložilo).
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
  function posunNaHranu(x, g, tol) {
    const typ = g[0].op.typ, R = g[0].R;
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
      pridej(m, dot(m, add(s.P0, mul(s.a, s.t))));
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
    let fce, nC;
    if (o.tvar === 'valec' && (d.projekce || 'auto') !== 'rovina') {
      const dc = sub(c, o.osaBod), thc = Math.atan2(dot(dc, o.e2), dot(dc, o.e1)), vc = dot(dc, o.osa);
      fce = x => {
        const dx = sub(x, o.osaBod);
        let dth = Math.atan2(dot(dx, o.e2), dot(dx, o.e1)) - thc;
        if (dth > Math.PI) dth -= 2 * Math.PI; if (dth < -Math.PI) dth += 2 * Math.PI;
        return naMape(dth * o.polomer, dot(dx, o.osa) - vc);
      };
    } else {
      nC = d.normala || o.normala;
      const { u, v } = zakladRoviny(nC);
      fce = (x, n) => {
        if (n && dot(n, nC) < 0.25) return 0;            // neprosvítit na odvrácenou stranu
        const dx = sub(x, c);
        return naMape(dot(dx, u), dot(dx, v));
      };
    }
    return { h: fce, smer: d.smer || 'ven', hloubka: d.hloubka, bod: c, R: Math.hypot(w, h) / 2 };
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
    const pas = (s, x) => {
      const od = s.pasOd, doo = s.pasDo;
      if (!(od > 0 || doo > 0)) return 1;
      const z = x[2] - zMin;
      const dolni = od > 0 ? z - od : Infinity, horni = doo > 0 ? doo - z : Infinity;
      const dz = Math.min(dolni, horni);
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
      for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (let k = k0 - 1; k <= k0 + 1; k++) {
        const l = m.get(hashBunky(i, j, k));
        if (l) for (const w of l) {
          const d = Math.hypot(sit.p[3 * w] - x[0], sit.p[3 * w + 1] - x[1], sit.p[3 * w + 2] - x[2]);
          if (d < best) best = d;
        }
      }
      return best;
    };
  }
  const hladce = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

  function aplikujStruktury(sit, model, VY, pohnuto) {
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
      // hranice dvou ploch, které obě mají vzor: vrchol se posune do průsečíku
      // obou posunutých ploch; jinak (soused bez vzoru, 3+ ploch) stojí
      if (reg2[v] >= 0 && VY.maPlochu(reg[v]) && VY.maPlochu(reg2[v])) rohovy[v] = 1;
      else if (VY.maPlochu(reg[v]) || (reg2[v] >= 0 && VY.maPlochu(reg2[v]))) pevny[v] = 1;
    }
    let maxOkraj = 0, maxHl = 0;
    for (const [, q] of VY.proj) { maxOkraj = Math.max(maxOkraj, q.s.okraj || 0); maxHl = Math.max(maxHl, q.s.hloubka); }
    const vzdHr = maxOkraj > 0 ? mrizkaBodu(sit, pevny, maxOkraj) : null;
    // plynulý náběh k zaoblení/sražení: aspoň 1,5× hloubka vzoru
    const rZaobl = Math.max(maxOkraj, 1.5 * maxHl);
    const vzdZa = pohnuto && rZaobl > 0 ? mrizkaBodu(sit, pohnuto, rZaobl) : null;
    const rohN = normalyRohu(model);
    const posun = new Float64Array(nV * 3);
    const uRohu = new Uint8Array(nV);          // vrcholy u rohu obtočeného vzoru (úklid jehel)
    const pritlaceny = new Uint8Array(nV);     // přitlačené na rovinu sousední stěny
    for (let v = 0; v < nV; v++) {
      const r = reg[v];
      if (r < 0 || pevny[v] || (pohnuto && pohnuto[v]) || !VY.maPlochu(r)) continue;
      if (reg2[v] !== -1 && !rohovy[v]) continue;
      const x = sit.bod(v);
      if (rohovy[v] && !VY.maPlochu(r)) continue;
      const q = VY.proj.get(r);
      let f = 1;
      if (q && q.s.okraj > 0 && vzdHr) f *= hladce(vzdHr(x) / q.s.okraj);
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
          const sd = dot(sb.n, x) - sb.c;
          if (Math.abs(sd) > 2.5 * VY.hRef(r) + 1e-9 || Math.abs(sd) < 1e-9) continue;
          // hloubka sousední stěny v průmětu bodu na její rovinu (u rohu = na hraně)
          const offS = VY.maPlochu(sb.rid) ? VY.posun(sb.rid, sub(x, mul(sb.n, sd)), sb.n) : 0;
          const val = dot(sb.n, add(x, w)) - (sb.c + offS);
          if ((sd < 0 && val > 0) || (sd > 0 && val < 0)) { w = sub(w, mul(sb.n, val)); uRohu[v] = 1; pritlaceny[v] = 1; }
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
        if (bw >= 0 && best < rr) { sit.p[3 * v] = sit.p[3 * bw]; sit.p[3 * v + 1] = sit.p[3 * bw + 1]; sit.p[3 * v + 2] = sit.p[3 * bw + 2]; }
      }
    }
    return uRohu;
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
    const struktury = zadani.struktury || new Map();
    const hrany = zadani.hrany || new Map();
    const VY = pripravVysky(model, zadani, volby);
    const segs = pripravSegmenty(model, hrany);
    // 0) kontrola tloušťky stěny pod vzorem, který se do ní ryje
    for (const rid of new Set([...VY.proj.keys(), ...VY.obtPodle.keys()])) {
      const q = VY.proj.get(rid);
      let hl = q && q.s.smer !== 'ven' ? q.s.hloubka : 0;
      for (const d of VY.obtPodle.get(rid) || []) if (d.smer !== 'ven') hl = Math.max(hl, d.hloubka);
      if (!hl) continue;
      const t = nejtensi(model, rid);
      if (isFinite(t) && hl > t * 0.6) varovani.push(`Pozor: na ploše ${rid + 1} je stěna silná jen ${t.toFixed(1)} mm a vzor se ryje ${hl.toFixed(1)} mm hluboko – ` + (hl >= t ? 'stěnu prorazí!' : 'zůstane velmi tenká.') + ' Zmenšete hloubku nebo zvolte „Vystoupit“.');
    }
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
        const krok = s.op.typ === 'zaobl' ? s.t / Math.max(1, Math.ceil((s.op.segmenty || 8) / 2)) * 1.6 : s.t * 0.75;
        const e = sub(B, A), podel = Math.abs(dot(e, s.d)), napric = len(sub(e, mul(s.d, dot(e, s.d))));
        // na zakřiveném řetězci (krátké segmenty) se nesmí překlenout oblouk
        return napric > krok || podel > Math.max(krok, Math.min(Math.max(krok * 6, s.t * 2), s.L * 1.5));
      }, 14, volby.limitT);
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
        const jLim = Math.sqrt(plochaStruktur(model, struktury, zadani.obtisky) / (HUSTOTA * volby.limitT));
        if (jLim > jd) {
          varovani.push(`Jemnost zvětšena na ${jLim.toFixed(2)} mm, aby síť nepřesáhla ${Math.round(volby.limitT / 1000)} tisíc trojúhelníků.`);
          jd = jLim;
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
      if (!ok) { varovani.push('Síť narazila na limit počtu trojúhelníků – struktura je hrubší. Zvětšete „Jemnost“ nebo zmenšete plochu.'); return; }
      prubeh(0.3, 'Doostřuji vzor');
      // hranice pásů výšky rovně (řez rovinou)
      const zMin = model.box.min[2];
      for (const [rid, q] of VY.proj) for (const z of [q.s.pasOd, q.s.pasDo]) {
        if (z > 0) rezRovinou(sit, [0, 0, 1], zMin + z, ti => model.oblast[sit.o[ti]] === rid, tol);
      }
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
      if (r.neslo) varovani.push(`U ${r.neslo} vrcholů se zaoblení nevešlo (poloměr je větší než stěna) – zkuste menší rozměr.`);
    }
    prubeh(0.75, 'Vtlačuji vzor');
    // 4) struktura a obtisky
    let uRohu = null;
    if (VY.proj.size || VY.obtPodle.size) uRohu = aplikujStruktury(sit, model, VY, pohnuto);
    prubeh(0.9, 'Uklízím síť');
    let v = sit.vystup();
    // úklid přeložených drobných trojúhelníků u zaoblení a rohů vzoru
    let maxR = 0;
    for (const q of segs) maxR = Math.max(maxR, q.t);
    for (const [, q] of VY.proj) maxR = Math.max(maxR, q.s.hloubka);
    let maska = null;
    for (const m of [pohnuto, uRohu]) if (m) { if (!maska) maska = new Uint8Array(sit.pocetV); for (let i = 0; i < m.length; i++) if (m[i]) maska[i] = 1; }
    if (maska) v = uklidPrelozene(v, tol, model, maxR, maska);
    v = vycisti(v, tol * 0.05);
    v.varovani = varovani;
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
      for (let i = 0; i < pohnuto.length; i++) if (pohnuto[i]) np[r.mapa[i]] = 1;
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
    const nV = pos.length / 3, mapa = new Int32Array(nV);
    const bunky = new Map();
    const novePos = new Float64Array(nV * 3);
    let n = 0;
    for (let i = 0; i < nV; i++) {
      const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
      const bi = Math.floor(x / tol), bj = Math.floor(y / tol), bk = Math.floor(z / tol);
      let j = -1;
      for (let di = -1; di <= 1 && j < 0; di++) for (let dj = -1; dj <= 1 && j < 0; dj++) for (let dk = -1; dk <= 1 && j < 0; dk++) {
        const l = bunky.get(hashBunky(bi + di, bj + dj, bk + dk));
        if (l) for (const q of l) {
          if (Math.abs(novePos[3 * q] - x) <= tol && Math.abs(novePos[3 * q + 1] - y) <= tol && Math.abs(novePos[3 * q + 2] - z) <= tol) { j = q; break; }
        }
      }
      if (j < 0) {
        j = n++;
        novePos[3 * j] = x; novePos[3 * j + 1] = y; novePos[3 * j + 2] = z;
        const h = hashBunky(bi, bj, bk), l = bunky.get(h);
        if (l) l.push(j); else bunky.set(h, [j]);
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

  // průměrná plocha trojúhelníku po zjemnění ≈ HUSTOTA · jemnost² (změřeno)
  const HUSTOTA = 0.2;
  function plochaStruktur(model, struktury, obtisky) {
    let plocha = 0;
    for (const [rid] of struktury) if (model.oblasti[rid]) plocha += model.oblasti[rid].plocha;
    for (const d of obtisky || []) if (d.sirka > 0) plocha += Math.pow(d.sirka * 1.3, 2);
    return plocha;
  }
  function odhadTrojuhelniku(model, struktury, jemnost, obtisky) {
    return Math.round(plochaStruktur(model, struktury, obtisky) / (HUSTOTA * jemnost * jemnost)) + model.tri.length / 3;
  }

  /* =====================================================================
     KONTROLY A EXPORT
     ===================================================================== */
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
    parseSTL, parseOBJ, parse3MF, nactiSoubor, svar, priprav, sestav, odhadTrojuhelniku,
    kontrola, exportSTL, exportOBJ, export3MF, zip, ukazka, UKAZKY, Sit, klic, projektor, plochaStruktur, HUSTOTA,
    tloustka, paprsek, nejtensi,
  };
}
povrchJadro(typeof window !== 'undefined' ? window : globalThis);
