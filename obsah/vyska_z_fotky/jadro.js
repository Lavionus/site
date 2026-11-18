/* Výška osoby z fotky – jádro bez DOM (test: _test/vyska_z_fotky_test.js).
   Jednosnímková metrologie podle Criminisi, Reid, Zisserman (2000):
   úběžník svislic + horizont (úběžnice země) + referenční výška → výška libovolného
   svislého úseku, který stojí na zemi. Úběžníky z více úseček metodou nejmenších čtverců,
   vážená kombinace referencí, radiální zkreslení k1, Monte Carlo nejistota, citlivostní analýza,
   sloučení více měření a snímků, porovnání s podezřelými, přichytávání k rohům,
   galerie syntetických ukázkových scén se známou pravdou. */
(function () {
  'use strict';

  const VERZE = 2;

  /* ---------- homogenní geometrie ---------- */
  const krz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sk = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nor = a => Math.hypot(a[0], a[1], a[2]);
  const jed = a => { const n = nor(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
  const hom = p => [p[0], p[1], 1];
  const kart = a => [a[0] / a[2], a[1] / a[2]];

  /* ---------- radiální zkreslení (střed snímku, r normované polovinou úhlopříčky) ----------
     Model: neskreslený = střed + (skreslený − střed)·(1 + k1·r²). k1 > 0 = soudkovité. */
  function odzkresli(p, k1, sirka, vyska) {
    if (!k1) return [p[0], p[1]];
    const cx = sirka / 2, cy = vyska / 2, R = Math.hypot(sirka, vyska) / 2;
    const dx = (p[0] - cx) / R, dy = (p[1] - cy) / R, f = 1 + k1 * (dx * dx + dy * dy);
    return [cx + dx * f * R, cy + dy * f * R];
  }
  function zkresli(p, k1, sirka, vyska) { // inverze: Newton na poloměru ρ(1 + k1ρ²) = r
    if (!k1) return [p[0], p[1]];
    const cx = sirka / 2, cy = vyska / 2, R = Math.hypot(sirka, vyska) / 2;
    const ux = (p[0] - cx) / R, uy = (p[1] - cy) / R, ru = Math.hypot(ux, uy);
    if (ru < 1e-12) return [p[0], p[1]];
    let rho = k1 > 0 ? Math.min(ru, Math.cbrt(ru / k1)) : ru;
    const strop = k1 < 0 ? 1 / Math.sqrt(3 * -k1) : Infinity; // za ním není poduškovitý model prostý
    for (let i = 0; i < 60; i++) {
      const g = rho + k1 * rho * rho * rho - ru, dg = 1 + 3 * k1 * rho * rho;
      if (dg <= 1e-9) break;
      const n = rho - g / dg;
      if (Math.abs(n - rho) < 1e-13) { rho = n; break; }
      rho = Math.max(0, Math.min(strop, n));
    }
    const f = rho / ru;
    return [cx + ux * f * R, cy + uy * f * R];
  }

  /* ---------- nejmenší vlastní číslo symetrické 3×3 (Jacobi) ---------- */
  function nejmensiVlastni(M) {
    const a = M.map(r => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 60; it++) {
      let p = 0, q = 1, max = Math.abs(a[0][1]);
      if (Math.abs(a[0][2]) > max) { p = 0; q = 2; max = Math.abs(a[0][2]); }
      if (Math.abs(a[1][2]) > max) { p = 1; q = 2; max = Math.abs(a[1][2]); }
      if (max < 1e-18) break;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
    }
    let i = 0;
    for (let k = 1; k < 3; k++) if (a[k][k] < a[i][i]) i = k;
    return { vektor: [V[0][i], V[1][i], V[2][i]], hodnota: Math.max(0, a[i][i]) };
  }

  /* ---------- úběžník z úseček (nejmenší čtverce, normované souřadnice, váha = délka) ----------
     segmenty: [[p1, p2], …] v pixelech (už odzkreslené). Vrací v jako jednotkový homogenní vektor
     (v[2] ≈ 0 = úběžník v nekonečnu, tj. úsečky jsou na snímku rovnoběžné). */
  function ubeznik(segmenty, sirka, vyska) {
    const cx = sirka / 2, cy = vyska / 2, s = Math.hypot(sirka, vyska) / 2;
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    let sumW = 0, n = 0;
    for (const [a, b] of segmenty) {
      const A = [(a[0] - cx) / s, (a[1] - cy) / s, 1], B = [(b[0] - cx) / s, (b[1] - cy) / s, 1];
      const l = krz(A, B), d = Math.hypot(l[0], l[1]);
      if (d < 1e-9) continue;
      const w = d; // |A×B| v x,y = délka úsečky v normovaných souřadnicích
      const ln = [l[0] / d, l[1] / d, l[2] / d];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] += w * ln[i] * ln[j];
      sumW += w; n++;
    }
    if (n < 2) return null;
    const { vektor: v, hodnota } = nejmensiVlastni(M);
    const vp = jed([s * v[0] + cx * v[2], s * v[1] + cy * v[2], v[2]]);
    // úhlová odchylka každé úsečky od směru ke společnému úběžníku
    const odchylky = segmenty.map(([a, b]) => {
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const d = [vp[0] - m[0] * vp[2], vp[1] - m[1] * vp[2]], e = [b[0] - a[0], b[1] - a[1]];
      const c = Math.abs(d[0] * e[0] + d[1] * e[1]) / ((Math.hypot(d[0], d[1]) * Math.hypot(e[0], e[1])) || 1);
      return Math.acos(Math.min(1, c)) * 180 / Math.PI;
    });
    return { v: vp, rezidum: hodnota / sumW, odchylky, n };
  }

  /* ---------- případ a snímek ---------- */
  let citac = 0;
  const noveId = () => Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 5);

  function prazdnySnimek(nazev, sirka, vyska) {
    return { id: noveId(), nazev: nazev || 'Snímek', sirka: sirka || 0, vyska: vyska || 0, k1: 0, k1Sigma: 0, sigmaPx: 1,
      svisle: [], vodA: [], vodB: [], horizont: null, reference: [], mereni: [] };
  }
  function prazdnyPripad() {
    return { verze: VERZE, nazev: '', cj: '', zpracovatel: '', poznamka: '', mcN: 2000, snimky: [],
      podezreli: [], porovnat: '', pravda: {}, ukazka: null };
  }
  const cislo = (x, d) => { const n = parseFloat(String(x).replace(',', '.')); return isFinite(n) ? n : d; };
  const bod = p => Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1]) ? [+p[0], +p[1]] : null;
  const usecky = a => Array.isArray(a) ? a.map(s => Array.isArray(s) ? [bod(s[0]), bod(s[1])] : null).filter(s => s && s[0] && s[1]) : [];
  const osobaId = x => String(x == null || x === '' ? 'A' : x).trim().slice(0, 16) || 'A';
  function normKorekce(k) {
    const od = cislo(k && k.od, 0), d = cislo(k && k.do, 0);
    return { nazev: String((k && k.nazev) || 'Korekce'), od: Math.min(od, d), do: Math.max(od, d) };
  }
  function normSnimek(s, pravda) {
    s = s || {};
    const n = prazdnySnimek(String(s.nazev || 'Snímek'), cislo(s.sirka, 0), cislo(s.vyska, 0));
    if (s.id) n.id = String(s.id);
    n.k1 = cislo(s.k1, 0); n.k1Sigma = Math.max(0, cislo(s.k1Sigma, 0)); n.sigmaPx = Math.max(0, cislo(s.sigmaPx, 1));
    n.svisle = usecky(s.svisle); n.vodA = usecky(s.vodA); n.vodB = usecky(s.vodB);
    const h = s.horizont && usecky([s.horizont])[0]; n.horizont = h || null;
    n.reference = (Array.isArray(s.reference) ? s.reference : []).map(r => ({ id: String(r.id || noveId()), nazev: String(r.nazev || 'Reference'),
      vyska: Math.max(0, cislo(r.vyska, 0)), tol: Math.max(0, cislo(r.tol, 0.5)), b: bod(r.b), t: bod(r.t), pouzit: r.pouzit !== false }));
    n.mereni = (Array.isArray(s.mereni) ? s.mereni : []).map(m => {
      const x = { id: String(m.id || noveId()), nazev: String(m.nazev || 'Měření'), osoba: osobaId(m.osoba),
        b: bod(m.b), t: bod(m.t), korekce: (Array.isArray(m.korekce) ? m.korekce : []).map(normKorekce), pouzit: m.pouzit !== false };
      if (pravda && m.pravda != null && isFinite(m.pravda) && pravda[x.osoba] == null) pravda[x.osoba] = +m.pravda; // verze 1
      return x;
    });
    if (s.obrazek) n.obrazek = s.obrazek; // Blob nebo dataURL (řeší UI)
    return n;
  }
  function migruj(d) {
    const p = prazdnyPripad();
    if (!d || typeof d !== 'object') return p;
    for (const k of ['nazev', 'cj', 'zpracovatel', 'poznamka', 'porovnat']) p[k] = String(d[k] || '');
    p.mcN = Math.min(20000, Math.max(200, Math.round(cislo(d.mcN, 2000))));
    if (d.pravda && typeof d.pravda === 'object') for (const k in d.pravda) if (isFinite(d.pravda[k])) p.pravda[osobaId(k)] = +d.pravda[k];
    p.snimky = (Array.isArray(d.snimky) ? d.snimky : []).map(s => normSnimek(s, p.pravda));
    p.podezreli = (Array.isArray(d.podezreli) ? d.podezreli : []).map(x => ({ id: String(x.id || noveId()), jmeno: String(x.jmeno || 'Podezřelý'),
      vyska: Math.max(0, cislo(x.vyska, 0)), tol: Math.max(0, cislo(x.tol, 1)) }));
    if (d.ukazka && typeof d.ukazka === 'object' && d.ukazka.id) p.ukazka = { id: String(d.ukazka.id) };
    return p;
  }

  /* Předvolby korekcí (cm), orientační – uživatel je má upravit podle situace. */
  const PREDVOLBY = [
    { nazev: 'Obuv – běžná (odečíst podpatek)', od: -3, do: -1.5 },
    { nazev: 'Obuv – sportovní', od: -3.5, do: -2 },
    { nazev: 'Obuv – vysoký podpatek', od: -9, do: -5 },
    { nazev: 'Chůze – střední opora', od: 0.5, do: 2 },
    { nazev: 'Chůze – neznámá fáze kroku', od: 0.5, do: 4.5 },
    { nazev: 'Stoj – mírně uvolněný postoj', od: 0, do: 1.5 },
    { nazev: 'Pokrčená kolena / shrbení', od: 1, do: 4 },
    { nazev: 'Hlava skloněná / předsunutá', od: 1, do: 3 },
    { nazev: 'Čepice / kšiltovka (odečíst)', od: -3, do: -1.5 },
    { nazev: 'Objemné vlasy / čepice (odečíst)', od: -3, do: 0 }
  ];
  const predvolba = nazev => Object.assign({}, PREDVOLBY.find(p => p.nazev.startsWith(nazev)));

  /* ---------- kalibrace a výška ---------- */
  function kalibrace(sn) {
    const P = p => odzkresli(p, sn.k1, sn.sirka, sn.vyska);
    const U = seg => seg.map(s => [P(s[0]), P(s[1])]);
    const chyby = [];
    const vs = ubeznik(U(sn.svisle), sn.sirka, sn.vyska);
    if (!vs) chyby.push('Zakreslete aspoň 2 svislé úsečky (hrany zdí, rámy dveří, sloupy).');
    let l = null, zdrojH = '', vA = null, vB = null;
    if (sn.horizont) { l = jed(krz(hom(P(sn.horizont[0])), hom(P(sn.horizont[1])))); zdrojH = 'ručně zakreslený'; }
    else {
      vA = ubeznik(U(sn.vodA), sn.sirka, sn.vyska); vB = ubeznik(U(sn.vodB), sn.sirka, sn.vyska);
      if (vA && vB) { l = jed(krz(vA.v, vB.v)); zdrojH = 'z úběžníků A a B'; }
      else chyby.push('Chybí horizont: zakreslete aspoň 2 + 2 vodorovné úsečky ve dvou směrech na zemi (A, B), nebo horizont ručně.');
    }
    if (vs && l && Math.abs(sk(l, vs.v)) < 1e-6) chyby.push('Úběžník svislic leží na horizontu – svislé úsečky asi nejsou svislé.');
    return { v: vs && vs.v, vs, vA, vB, l, zdrojH, chyby, P };
  }
  // α·Z podle Criminisi: ‖b×t‖ / (|l·b|·‖v×t‖); b, t odzkreslené pixely.
  // Vzorec předpokládá b, t, v na jedné přímce → temeno se kolmo promítne na svislici paty
  // (jinak by boční odchylka kliknutí zkreslovala výsledek podle polohy počátku souřadnic).
  function naSvislici(kal, b, t) {
    const L = krz(hom(b), kal.v), d = L[0] * L[0] + L[1] * L[1];
    if (d < 1e-12) return t;
    const e = (L[0] * t[0] + L[1] * t[1] + L[2]) / d;
    return [t[0] - e * L[0], t[1] - e * L[1]];
  }
  function faktor(kal, b, t) {
    const B = hom(b), T = hom(naSvislici(kal, b, t));
    return nor(krz(B, T)) / (Math.abs(sk(kal.l, B)) * nor(krz(kal.v, T)));
  }
  // bod T (odzkreslený) posunutý o px pixelů po svislici směrem k úběžníku svislic
  function poSvislici(kal, T, px) {
    const smer = [kal.v[0] - T[0] * kal.v[2], kal.v[1] - T[1] * kal.v[2]], d = Math.hypot(smer[0], smer[1]) || 1;
    return [T[0] + smer[0] / d * px, T[1] + smer[1] / d * px];
  }
  // relativní změna faktoru při posunu vrcholu o 1 px (citlivost na kliknutí)
  function relNaPixel(kal, B, T) {
    const f0 = faktor(kal, B, T), f1 = faktor(kal, B, poSvislici(kal, T, 1));
    return f0 ? Math.abs(f1 - f0) / f0 : 0;
  }
  const uplne = x => x.b && x.t;

  /* Výpočet jednoho snímku. vyskaRef(r) → výška reference v cm (MC ji vzorkuje).
     Reference se kombinují váženě: váha = 1 / relativní rozptyl (tolerance výšky + kliknutí). */
  function vyhodnotSnimek(sn, vyskaRef) {
    const kal = kalibrace(sn);
    if (kal.chyby.length) return { chyby: kal.chyby, kal };
    const sg = sn.sigmaPx || 0;
    const vse = sn.reference.filter(r => uplne(r) && r.vyska > 0).map(r => {
      const B = kal.P(r.b), T = kal.P(r.t), f = faktor(kal, B, T), rel = relNaPixel(kal, B, T);
      const varRel = (r.tol / r.vyska) ** 2 / 3 + 2 * sg * sg * rel * rel;
      return { r, f, H: vyskaRef ? vyskaRef(r) : r.vyska, varRel, w: 1 / (varRel + 1e-10), pouzit: r.pouzit !== false };
    });
    const refs = vse.filter(x => x.pouzit);
    if (!refs.length) return { chyby: [vse.length ? 'Všechny reference jsou vyřazené – zapněte aspoň jednu.' : 'Zakreslete referenční objekt se známou výškou (dveře, obklad, sloup se značkou).'], kal };
    const W = refs.reduce((s, x) => s + x.w, 0);
    const alfa = refs.reduce((s, x) => s + x.w * x.f / x.H, 0) / W;
    refs.forEach(x => { x.vaha = x.w / W; });
    const mereni = sn.mereni.filter(uplne).map(m => ({ m, vyska: faktor(kal, kal.P(m.b), kal.P(m.t)) / alfa }));
    // kontrola referencí navzájem: každou změřit pomocí ostatních (použitých)
    const kontrola = [];
    for (const x of vse) {
      const ost = refs.filter(y => y !== x);
      if (!ost.length) continue;
      const Wo = ost.reduce((s, y) => s + y.w, 0), a = ost.reduce((s, y) => s + y.w * y.f / y.H, 0) / Wo;
      const zmereno = x.f / a, chyba = zmereno - x.H;
      const sigma = Math.sqrt(x.H * x.H * (x.varRel + 1 / Wo) + 0.25); // +0,5 cm na kalibraci
      kontrola.push({ r: x.r, zmereno, chyba, sigma, z: chyba / sigma, vaha: x.vaha || 0, pouzit: x.pouzit });
    }
    return { chyby: [], kal, alfa, mereni, kontrola, refs: vse };
  }

  /* Rozlišení: o kolik cm se změní výsledek, když se temeno posune o 1 px po svislici. */
  function cmNaPixelZ(z, m) {
    if (!z || z.chyby.length || !uplne(m)) return null;
    const B = z.kal.P(m.b), T = z.kal.P(m.t);
    return Math.abs(faktor(z.kal, B, poSvislici(z.kal, T, 1)) - faktor(z.kal, B, T)) / z.alfa;
  }
  const cmNaPixel = (sn, m) => cmNaPixelZ(vyhodnotSnimek(sn), m);

  /* Výška pomocí dvojpoměru (jedna reference) – geometrická konstrukce z učebnic, pro kontrolu. */
  function vyskaDvojpomerem(kal, br, tr, Hr, bx, tx) {
    const [Br, Tr, Bx, Tx] = [br, tr, bx, tx].map(p => hom(kal.P(p)));
    const u = krz(krz(Br, Bx), kal.l);            // bod na horizontu
    const trc = krz(krz(Tr, u), krz(Bx, kal.v));  // přenesené temeno reference na svislici osoby
    const v = kal.v, d = (a, b) => Math.hypot(a[0] / a[2] - b[0] / b[2], a[1] / a[2] - b[1] / b[2]);
    return Hr * (d(Tx, Bx) * d(v, trc)) / (d(trc, Bx) * d(v, Tx));
  }

  /* ---------- náhoda a statistika ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  function statistika(arr) {
    const x = arr.filter(isFinite).sort((a, b) => a - b), n = x.length;
    if (!n) return null;
    const pr = x.reduce((s, v) => s + v, 0) / n;
    const sd = Math.sqrt(x.reduce((s, v) => s + (v - pr) * (v - pr), 0) / Math.max(1, n - 1));
    const q = p => { const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return x[lo] + (x[hi] - x[lo]) * (i - lo); };
    return { n, prumer: pr, sd, median: q(0.5), p025: q(0.025), p975: q(0.975), min: x[0], max: x[n - 1] };
  }
  function histogram(arr, kose) {
    const s = statistika(arr); if (!s) return null;
    const od = s.min, sir = (s.max - s.min) / kose || 1, h = new Array(kose).fill(0);
    for (const v of arr) if (isFinite(v)) h[Math.min(kose - 1, Math.floor((v - od) / sir))]++;
    return { od, sirka: sir, h };
  }

  /* Zdroje nejistoty – Monte Carlo je umí zapínat jednotlivě (citlivostní analýza). */
  const ZDROJE = [
    { id: 'kalibrace', nazev: 'Zakreslení čar (úběžníky, horizont)' },
    { id: 'refBody', nazev: 'Body referencí (pata, vrchol)' },
    { id: 'osobaBody', nazev: 'Body osoby (pata, temeno)' },
    { id: 'refTol', nazev: 'Přesnost známé výšky referencí' },
    { id: 'korekce', nazev: 'Korekce (obuv, postoj, pokrývka hlavy)' },
    { id: 'k1', nazev: 'Nejistota zkreslení k1' }
  ];
  const VSE = { kalibrace: true, refBody: true, osobaBody: true, refTol: true, korekce: true, k1: true };

  function rozkmitniSnimek(sn, r, maska) {
    maska = maska || VSE;
    const sg = sn.sigmaPx, j = zap => p => p && zap && sg ? [p[0] + gauss(r) * sg, p[1] + gauss(r) * sg] : p;
    const jk = j(maska.kalibrace), jr = j(maska.refBody), jo = j(maska.osobaBody);
    const seg = a => a.map(s => [jk(s[0]), jk(s[1])]);
    return Object.assign({}, sn, { svisle: seg(sn.svisle), vodA: seg(sn.vodA), vodB: seg(sn.vodB),
      k1: maska.k1 && sn.k1Sigma ? sn.k1 + gauss(r) * sn.k1Sigma : sn.k1,
      horizont: sn.horizont && [jk(sn.horizont[0]), jk(sn.horizont[1])],
      reference: sn.reference.map(x => Object.assign({}, x, { b: jr(x.b), t: jr(x.t) })),
      mereni: sn.mereni.map(x => Object.assign({}, x, { b: jo(x.b), t: jo(x.t) })) });
  }
  const soucetKorekci = (m, r) => m.korekce.reduce((s, k) => s + (r ? k.od + (k.do - k.od) * r() : (k.od + k.do) / 2), 0);

  /* Celé vyhodnocení případu: deterministický výpočet + Monte Carlo.
     Výška osoby v jednom měření = geometrická výška (pata→temeno) + součet korekcí.
     Měření téže osoby (i z více snímků) se slučují váženým průměrem, váhy z kovariance Monte Carlo (vahyGLS)
     (volby.vahy = pevné váhy podle id měření, např. z předchozího plného výpočtu).
     volby: { n, seed, maska, vahy } */
  function vyhodnot(pripad, volby) {
    volby = volby || {};
    const N = volby.n != null ? volby.n : (pripad.mcN || 2000), r = rng(volby.seed || 12345), maska = volby.maska || VSE;
    const snimky = pripad.snimky.map(sn => {
      const z = vyhodnotSnimek(sn);
      return { sn, z, mereni: z.chyby.length ? [] : z.mereni.map(x => {
        const kor = soucetKorekci(x.m);
        return { m: x.m, sn, osoba: osobaId(x.m.osoba), pouzit: x.m.pouzit !== false, geom: x.vyska, korekce: kor, vyska: x.vyska + kor, vzorky: [], cmPx: cmNaPixelZ(z, x.m) };
      }) };
    });
    const vsechna = snimky.flatMap(s => s.mereni);
    if (vsechna.length) for (let i = 0; i < N; i++) {
      for (const s of snimky) {
        if (!s.mereni.length) continue;
        const z = vyhodnotSnimek(rozkmitniSnimek(s.sn, r, maska), ref => ref.vyska + (maska.refTol ? (2 * r() - 1) * ref.tol : 0));
        s.mereni.forEach((x, k) => x.vzorky.push(z.chyby.length ? NaN : z.mereni[k].vyska + soucetKorekci(x.m, maska.korekce ? r : null)));
      }
    }
    for (const m of vsechna) m.stat = statistika(m.vzorky);
    const ids = [...new Set(vsechna.filter(m => m.pouzit).map(m => m.osoba))];
    const osoby = ids.map(id => {
      const ms = vsechna.filter(m => m.pouzit && m.osoba === id);
      const pevne = volby.vahy && ms.every(m => volby.vahy[m.m.id] != null);
      const w = pevne ? ms.map(m => volby.vahy[m.m.id]) : N >= 30 ? vahyGLS(ms.map(m => m.vzorky)) : ms.map(() => 1);
      ms.forEach((m, i) => { m.vahaRaw = w[i]; });
      const W = ms.reduce((s, m) => s + m.vahaRaw, 0) || 1;
      ms.forEach(m => { m.vaha = m.vahaRaw / W; });
      const vz = [];
      for (let i = 0; i < N; i++) {
        let s = 0, w = 0;
        for (const m of ms) { const v = m.vzorky[i]; if (isFinite(v)) { s += m.vaha * v; w += m.vaha; } }
        if (w) vz.push(s / w);
      }
      return { id, mereni: ms, vysledek: ms.reduce((s, m) => s + m.vaha * m.vyska, 0), stat: statistika(vz), histogram: histogram(vz, 30),
        pravda: pripad.pravda && pripad.pravda[id] != null ? pripad.pravda[id] : null };
    });
    const o0 = osoby[0];
    return { snimky, mereni: vsechna, osoby, vysledek: o0 ? o0.vysledek : null, stat: o0 ? o0.stat : null, histogram: o0 ? o0.histogram : null, N };
  }

  /* Váhy sloučení měření jedné osoby z Monte Carlo vzorků (zobecněné nejmenší čtverce):
     w = C⁻¹·1 / (1ᵀC⁻¹1), C = kovariance vzorků. Měření ze stejného snímku sdílejí kalibraci
     a reference, proto jsou korelovaná a prosté 1/σ² by je přecenilo. Záporné váhy se nulují. */
  function vahyGLS(vzorky) {
    const k = vzorky.length;
    if (k === 1) return [1];
    const rad = [];
    for (let i = 0; i < vzorky[0].length; i++) { const r = vzorky.map(v => v[i]); if (r.every(isFinite)) rad.push(r); }
    if (rad.length < 10) return vzorky.map(() => 1);
    const pr = vzorky.map((_, j) => rad.reduce((s, r) => s + r[j], 0) / rad.length);
    const C = vzorky.map((_, a) => vzorky.map((__, b) => rad.reduce((s, r) => s + (r[a] - pr[a]) * (r[b] - pr[b]), 0) / (rad.length - 1)));
    const stopa = C.reduce((s, r, i) => s + r[i], 0) / k;
    for (let i = 0; i < k; i++) C[i][i] += 1e-6 * stopa + 1e-6;
    // Gaussova eliminace C·x = 1
    const M = C.map(r => r.concat(1));
    for (let c = 0; c < k; c++) {
      let piv = c; for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      [M[c], M[piv]] = [M[piv], M[c]];
      if (Math.abs(M[c][c]) < 1e-15) return vzorky.map((_, i) => 1 / Math.max(1e-4, C[i][i]));
      for (let r = 0; r < k; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= k; j++) M[r][j] -= f * M[c][j]; }
    }
    const x = M.map((r, i) => Math.max(0, r[k] / r[i]));
    const s = x.reduce((a, b) => a + b, 0);
    return s > 0 ? x.map(v => v / s) : vzorky.map(() => 1 / k);
  }

  /* Citlivostní analýza: Monte Carlo s jediným zapnutým zdrojem nejistoty → σ od každého zdroje
     a jeho podíl na celkovém rozptylu (podíly se sčítají na 100 %, při lineárním chování součet
     dílčích rozptylů ≈ celkový rozptyl). */
  function citlivost(pripad, volby) {
    volby = volby || {};
    const n = volby.n || 400, seed = volby.seed || 777;
    const plny = volby.plny || vyhodnot(pripad, { n, seed });
    const vahy = {};
    plny.mereni.forEach(m => { if (m.vahaRaw != null) vahy[m.m.id] = m.vahaRaw; });
    const dily = ZDROJE.map(z => ({ z, v: vyhodnot(pripad, { n, seed, maska: { [z.id]: true }, vahy }) }));
    return plny.osoby.map(o => {
      const zdroje = dily.map(({ z, v }) => {
        const q = v.osoby.find(x => x.id === o.id);
        return { id: z.id, nazev: z.nazev, sd: q && q.stat ? q.stat.sd : 0 };
      });
      const sum = zdroje.reduce((s, x) => s + x.sd * x.sd, 0);
      zdroje.forEach(x => { x.podil = sum ? x.sd * x.sd / sum : 0; });
      zdroje.sort((a, b) => b.sd - a.sd);
      return { id: o.id, celkem: o.stat ? o.stat.sd : null, slozene: Math.sqrt(sum), zdroje };
    });
  }

  /* Porovnání odhadu s výškou podezřelého (jeho výška ± tol, např. z dokladu nebo měření).
     z = rozdíl / √(σ² + tol²). |z| ≤ 2 → nelze vyloučit, 2–3 → nepravděpodobné, > 3 → vyloučen.
     Shoda výšky nic neprokazuje – jen nevylučuje. */
  function porovnej(osoba, p) {
    if (!osoba || !osoba.stat || !p || !(p.vyska > 0)) return null;
    const tol = p.tol || 0, d = p.vyska - osoba.vysledek, sigma = Math.sqrt(osoba.stat.sd * osoba.stat.sd + tol * tol);
    const z = sigma > 0 ? d / sigma : (Math.abs(d) < 1e-9 ? 0 : Infinity);
    const a = Math.abs(z);
    return { d, sigma, z, verdikt: a <= 2 ? 'shoda' : a <= 3 ? 'malo' : 'vyloucen' };
  }
  const VERDIKTY = { shoda: 'nelze vyloučit', malo: 'málo pravděpodobné', vyloucen: 'vyloučen' };

  /* ---------- přichytávání k rohu (Shi–Tomasi) ----------
     seda: Uint8Array/Float32Array jasu (sirka × vyska). Hledá v kruhu o poloměru r kolem (x, y)
     pixel s největším menším vlastním číslem strukturního tenzoru (okno 5×5) a zpřesní ho na průsečík hran.
     Vrací {x, y, odezva} v souřadnicích snímku (střed pixelu = i + 0,5), nebo null pod prahem. */
  function rohVOkoli(seda, w, h, x, y, r, prah) {
    r = r || 6; prah = prah == null ? 400 : prah;
    const cx = Math.floor(x), cy = Math.floor(y);
    const L = (px, py) => {
      let sxx = 0, syy = 0, sxy = 0;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const q = (py + j) * w + px + i, gx = (seda[q + 1] - seda[q - 1]) / 2, gy = (seda[q + w] - seda[q - w]) / 2;
        sxx += gx * gx; syy += gy * gy; sxy += gx * gy;
      }
      const t = (sxx + syy) / 2, d = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
      return (t - d) / 25;
    };
    let best = null;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const px = cx + dx, py = cy + dy;
      if (dx * dx + dy * dy > r * r || px < 3 || py < 3 || px >= w - 3 || py >= h - 3) continue;
      const v = L(px, py);
      if (!best || v > best.odezva) best = { px, py, odezva: v };
    }
    if (!best || best.odezva < prah) return null;
    // zpřesnění: bod q, ke kterému jsou kolmé gradienty v okolí (průsečík hran, jako cornerSubPix)
    let qx = best.px + 0.5, qy = best.py + 0.5;
    for (let it = 0; it < 6; it++) {
      let a = 0, b = 0, c = 0, ux = 0, uy = 0;
      const sx = Math.floor(qx), sy = Math.floor(qy);
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
        const px = sx + i, py = sy + j;
        if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
        const q = py * w + px, gx = (seda[q + 1] - seda[q - 1]) / 2, gy = (seda[q + w] - seda[q - w]) / 2;
        const wt = Math.exp(-(i * i + j * j) / 18);
        a += wt * gx * gx; b += wt * gx * gy; c += wt * gy * gy;
        ux += wt * (gx * gx * (px + 0.5) + gx * gy * (py + 0.5)); uy += wt * (gx * gy * (px + 0.5) + gy * gy * (py + 0.5));
      }
      const det = a * c - b * b;
      if (det <= 1e-9 * (a + c) * (a + c)) break;
      const nx = (c * ux - b * uy) / det, ny = (a * uy - b * ux) / det;
      if (Math.hypot(nx - (best.px + 0.5), ny - (best.py + 0.5)) > 3) break;
      const hotovo = Math.hypot(nx - qx, ny - qy) < 0.01;
      qx = nx; qy = ny;
      if (hotovo) break;
    }
    return { x: qx, y: qy, odezva: best.odezva };
  }

  /* ---------- syntetická kamera (svět: X vpravo, Y dopředu, Z nahoru, metry) ---------- */
  function kamera(o) {
    const st = Math.PI / 180, ps = o.yaw * st, th = o.pitch * st, fi = (o.roll || 0) * st;
    const fwd = [Math.sin(ps) * Math.cos(th), Math.cos(ps) * Math.cos(th), -Math.sin(th)];
    const r0 = [Math.cos(ps), -Math.sin(ps), 0], d0 = krz(fwd, r0);
    const r = r0.map((x, i) => x * Math.cos(fi) + d0[i] * Math.sin(fi)), d = d0.map((x, i) => x * Math.cos(fi) - r0[i] * Math.sin(fi));
    return Object.assign({}, o, { fwd, r, d });
  }
  const hloubka = (k, X) => sk([X[0] - k.C[0], X[1] - k.C[1], X[2] - k.C[2]], k.fwd);
  function promitni(k, X) {
    const p = [X[0] - k.C[0], X[1] - k.C[1], X[2] - k.C[2]];
    const z = Math.max(1e-3, sk(p, k.fwd));
    const u = [k.sirka / 2 + k.f * sk(p, k.r) / z, k.vyska / 2 + k.f * sk(p, k.d) / z];
    return zkresli(u, k.k1 || 0, k.sirka, k.vyska);
  }

  /* ---------- stavebnice ukázkových scén ---------- */
  function kreslic(k) {
    const P = [];
    const o = {
      P,
      plocha: (body, barva, obrys) => P.push({ typ: 'plocha', body, barva, obrys }),
      cara: (a, b, barva, sirka) => P.push({ typ: 'cara', body: [a, b], barva, sirka: sirka || 1 }),
      kvadr(x0, x1, y0, y1, z0, z1, barva, obrys) { // jen stěny natočené ke kameře
        const st = [
          [[[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]], [[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]],
          [[[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0]], [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
          [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]]];
        const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
        st.forEach(([b, n], i) => {
          const s = b.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
          if (sk(n, [k.C[0] - s[0], k.C[1] - s[1], k.C[2] - s[2]]) > 0) o.plocha(b, Array.isArray(barva) ? barva[i] || barva[0] : barva, obrys);
        });
        return c;
      },
      dlazba(x0, x1, y0, y1, krok, barva, spara) {
        o.plocha([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], barva);
        for (let x = Math.ceil(x0 / krok) * krok; x <= x1 + 1e-9; x += krok) o.cara([x, y0, 0], [x, y1, 0], spara);
        for (let y = Math.ceil(y0 / krok) * krok; y <= y1 + 1e-9; y += krok) o.cara([x0, y, 0], [x1, y, 0], spara);
      }
    };
    return o;
  }

  /* Osoba jako silueta (billboard natočený ke kameře). o.H = tělesná výška (cm), o.boty zvedají,
     o.chuze snižuje (fáze kroku), o.cepice přidává nad temeno. Viditelný vrchol = vrchOsoby(o). */
  const vrchOsoby = o => (o.H + (o.boty || 0) - (o.chuze || 0) + (o.cepice || 0)) / 100;
  function osobaPrvky(K, k, o) {
    const temeno = (o.H + (o.boty || 0) - (o.chuze || 0)) / 100, s = temeno / 1.8;
    const dx = o.x - k.C[0], dy = o.y - k.C[1], n = Math.hypot(dx, dy), pr = [dy / n, -dx / n];
    const P = ([u, z]) => [o.x + pr[0] * u * s, o.y + pr[1] * u * s, z * s];
    const Pa = ([u, z]) => [o.x + pr[0] * u, o.y + pr[1] * u, z]; // v metrech
    const nohy = o.krok ? [[-0.3, 0], [-0.19, 0], [-0.03, 0.78], [0.03, 0.78], [0.2, 0], [0.31, 0]] : [[-0.16, 0], [-0.07, 0], [-0.04, 0.8], [0.04, 0.8], [0.07, 0], [0.16, 0]];
    const telo = nohy.concat([[0.13, 0.85], [0.17, 0.95], [0.25, 0.9], [0.24, 1.45], [0.07, 1.53], [0.05, 1.58], [-0.05, 1.58], [-0.07, 1.53], [-0.24, 1.45], [-0.25, 0.9], [-0.17, 0.95], [-0.13, 0.85]]).map(P);
    const hlava = []; for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * Math.PI; hlava.push(P([Math.sin(a) * 0.095, 1.69 + Math.cos(a) * 0.11])); }
    K.plocha(telo, o.barva || '#2f3a4a', '#11161d'); K.plocha(hlava, '#d9b48f', '#5a3d22');
    if (o.boty) for (const u of o.krok ? [-0.245, 0.255] : [-0.115, 0.115]) K.plocha([[u - 0.07, 0], [u + 0.07, 0], [u + 0.07, o.boty / 100], [u - 0.07, o.boty / 100]].map(Pa), '#1a1a1a');
    if (o.cepice) {
      const c = o.cepice / 100, sir = 0.105 * s, kap = [];
      for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + i / 16 * Math.PI; kap.push(Pa([Math.sin(a) * sir, temeno - 0.035 + (c + 0.035) * Math.cos(a)])); }
      K.plocha(kap, o.cepiceBarva || '#b8322a', '#4d140f');
      K.plocha([[-sir, temeno - 0.035], [sir + 0.07, temeno - 0.035], [sir + 0.07, temeno - 0.02], [-sir, temeno - 0.02]].map(Pa), '#7a1f19');
    }
  }

  /* Anotace se šumem kliknutí; sada() ořízne úsečky na viditelnou část záběru (krátké vynechá). */
  function anotator(k, seed, sigma) {
    const r = rng(seed), sum = p => [Math.round((p[0] + gauss(r) * sigma) * 10) / 10, Math.round((p[1] + gauss(r) * sigma) * 10) / 10];
    const vidi = X => hloubka(k, X) > 0.3 && (p => p[0] > 8 && p[1] > 8 && p[0] < k.sirka - 8 && p[1] < k.vyska - 8)(promitni(k, X));
    const bodU = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    function orizni(a, b) { // nejdelší viditelný úsek (vzorky po 1 %, okraje zpřesněné půlením)
      let nej = null, od = null;
      for (let i = 0; i <= 101; i++) {
        const v = i <= 100 && vidi(bodU(a, b, i / 100));
        if (v && od == null) od = i;
        if (!v && od != null) { if (!nej || i - 1 - od > nej[1] - nej[0]) nej = [od, i - 1]; od = null; }
      }
      if (!nej) return null;
      const hrana = (vi, ne) => { let x = vi / 100, y = ne / 100; for (let j = 0; j < 20; j++) { const m = (x + y) / 2; if (vidi(bodU(a, b, m))) x = m; else y = m; } return x; };
      const t0 = nej[0] > 0 ? hrana(nej[0], nej[0] - 1) : 0, t1 = nej[1] < 100 ? hrana(nej[1], nej[1] + 1) : 1;
      const A = bodU(a, b, t0), B = bodU(a, b, t1), pa = promitni(k, A), pb = promitni(k, B);
      return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) >= 40 ? [A, B] : null;
    }
    return {
      vidi,
      bod: X => sum(promitni(k, X)),
      sada: list => list.map(([a, b]) => orizni(a, b)).filter(Boolean).map(([a, b]) => [sum(promitni(k, a)), sum(promitni(k, b))]),
      ref: (id, nazev, vyska, tol, Xb, Xt, cmZadano) => ({ id, nazev, vyska: cmZadano != null ? cmZadano : vyska, tol, b: sum(promitni(k, Xb)), t: sum(promitni(k, Xt)) }),
      osoba: (id, nazev, o, korekce) => ({ id, nazev, osoba: o.osoba || 'A', b: sum(promitni(k, [o.x, o.y, 0])), t: sum(promitni(k, [o.x, o.y, vrchOsoby(o)])), korekce: korekce || [] })
    };
  }

  /* Chodba: dlažba 1 m, zadní stěna y = 12, levá stěna x = −6, dveře, okna, sloup se značkou. */
  function chodba(k, o) {
    o = o || {}; const D = o.dvere || 2.05, K = kreslic(k);
    K.dlazba(-6, 12, o.y0 || 2.5, 12, 1, '#9a958b', '#7d786f');
    K.plocha([[-6, 12, 0], [12, 12, 0], [12, 12, 5], [-6, 12, 5]], '#c9b79a');
    K.plocha([[-6, o.y0 || 2.5, 0], [-6, 12, 0], [-6, 12, 5], [-6, o.y0 || 2.5, 5]], '#b8a688');
    K.plocha([[-6, 12, 0], [12, 12, 0], [12, 12, 0.12], [-6, 12, 0.12]], '#8a7a62');
    K.plocha([[1.5, 12, 0], [2.45, 12, 0], [2.45, 12, D], [1.5, 12, D]], '#5b3b22', '#2b1a0c');
    K.plocha([[2.3, 12, 0.95], [2.38, 12, 0.95], [2.38, 12, 1.05], [2.3, 12, 1.05]], '#d8c27a');
    K.plocha([[3.6, 12, 1], [5.2, 12, 1], [5.2, 12, 2.3], [3.6, 12, 2.3]], '#6c8aa3', '#33414d');
    K.plocha([[-6, 6, 0.9], [-6, 8.2, 0.9], [-6, 8.2, 2.1], [-6, 6, 2.1]], '#6c8aa3', '#33414d');
    K.cara([6.5, 12, 0], [6.5, 12, 5], '#8c7b60', 3);
    K.cara([4, 6, 0], [4, 6, 3.6], '#3c3f44', 5);
    K.plocha([[3.75, 6, 2.2], [4.25, 6, 2.2], [4.25, 6, 2.7], [3.75, 6, 2.7]], '#1f5fbf', '#ffffff');
    return K;
  }
  function chodbaCary(o) {
    o = o || {}; const D = o.dvere || 2.05;
    return {
      svisle: [[[-6, 12, 0.2], [-6, 12, 3]], [[1.5, 12, 0], [1.5, 12, D]], [[2.45, 12, 0], [2.45, 12, D]], [[4, 6, 0.1], [4, 6, 2.6]],
        [[-6, 6, 0.9], [-6, 6, 2.1]], [[6.5, 12, 0], [6.5, 12, 3]], [[5.2, 12, 1], [5.2, 12, 2.3]], [[-6, 8.2, 0.9], [-6, 8.2, 2.1]]],
      vodA: [[[-5.5, 4, 0], [6, 4, 0]], [[-5.5, 8, 0], [6.5, 8, 0]], [[-5.5, 11, 0], [6.5, 11, 0]], [[1.5, 12, D], [2.45, 12, D]], [[3.6, 12, 2.3], [5.2, 12, 2.3]]],
      vodB: [[[-4, 4, 0], [-4, 11.5, 0]], [[0, 4, 0], [0, 11.5, 0]], [[5, 4, 0], [5, 11.5, 0]], [[-6, 6, 0.9], [-6, 8.2, 0.9]], [[8, 4, 0], [8, 11.5, 0]]]
    };
  }
  // snímek chodby: kamera, anotace, reference, osoby → {sn, kamera, prvky}
  function snimekChodby(nazev, kam, opt) {
    const k = kamera(kam), K = chodba(k, opt), A = anotator(k, opt.seed || 7, opt.sumPx != null ? opt.sumPx : 0.4);
    (opt.osoby || []).forEach(o => osobaPrvky(K, k, o));
    const sn = prazdnySnimek(nazev, k.sirka, k.vyska);
    sn.id = opt.id || noveId(); sn.k1 = opt.k1Zadane != null ? opt.k1Zadane : (k.k1 || 0); sn.sigmaPx = opt.sigmaPx || 1;
    if (opt.anotovat !== false) {
      const C = chodbaCary(opt);
      sn.svisle = A.sada(C.svisle); sn.vodA = A.sada(C.vodA); sn.vodB = A.sada(C.vodB);
      sn.reference = (opt.reference || ['dvere', 'sloup']).map(r => REF_CHODBA[r](A, opt));
      sn.mereni = (opt.osoby || []).map((o, i) => A.osoba('m' + (i + 1) + sn.id, o.nazev || ('Osoba ' + (o.osoba || 'A')), o, o.korekce));
    }
    return { sn, kamera: k, prvky: K.P, A };
  }
  const REF_CHODBA = {
    dvere: (A, o) => A.ref('rd', 'Dveře – světlá výška', (o.dvere || 2.05) * 100, 0.5, [1.5, 12, 0], [1.5, 12, o.dvere || 2.05], o.dvereZadano),
    sloup: A => A.ref('rs', 'Sloup – spodní hrana značky', 220, 1, [4, 6, 0], [4, 6, 2.2]),
    parapet: A => A.ref('rp', 'Parapet okna na levé stěně', 90, 1, [-6, 7, 0], [-6, 7, 0.9]),
    okno: A => A.ref('ro', 'Okno – horní hrana', 230, 1, [4.6, 12, 0], [4.6, 12, 2.3])
  };

  /* Náměstí: dlažba, fasáda s dveřmi a okny, boční dům, lampa s pruhem. */
  function namesti(k) {
    const K = kreslic(k);
    K.dlazba(-12, 12, 1.5, 20, 1, '#a39e94', '#86817a');
    K.plocha([[-12, 20, 0], [12, 20, 0], [12, 20, 9], [-12, 20, 9]], '#d8c7a5', '#a8977a');
    K.plocha([[-12, 20, 0], [12, 20, 0], [12, 20, 0.5], [-12, 20, 0.5]], '#9b8d77');
    K.plocha([[0, 20, 0], [1.1, 20, 0], [1.1, 20, 2.1], [0, 20, 2.1]], '#4b3420', '#24180d');
    for (const x of [-9, -5, 4, 8]) K.plocha([[x, 20, 1], [x + 1.4, 20, 1], [x + 1.4, 20, 2.4], [x, 20, 2.4]], '#6c8aa3', '#33414d');
    for (const x of [-9, -5, -1, 3, 7]) K.plocha([[x, 20, 4], [x + 1.4, 20, 4], [x + 1.4, 20, 5.6], [x, 20, 5.6]], '#6c8aa3', '#33414d');
    K.plocha([[-7, 8, 0], [-7, 20, 0], [-7, 20, 7], [-7, 8, 7]], '#c4b392', '#8f8068');
    for (const y of [10, 14]) K.plocha([[-7, y, 1.2], [-7, y + 1.6, 1.2], [-7, y + 1.6, 2.6], [-7, y, 2.6]], '#5f7d96', '#33414d');
    K.cara([3.2, 10, 0], [3.2, 10, 4.5], '#2e3236', 5);
    K.plocha([[2.95, 10, 4.5], [3.45, 10, 4.5], [3.45, 10, 4.75], [2.95, 10, 4.75]], '#2e3236');
    K.plocha([[3.06, 10, 2.5], [3.34, 10, 2.5], [3.34, 10, 2.7], [3.06, 10, 2.7]], '#d23a2a', '#ffffff');
    return K;
  }
  const NAMESTI_CARY = {
    svisle: [[[-7, 20, 0.5], [-7, 20, 6.5]], [[-7, 8, 0], [-7, 8, 6.5]], [[0, 20, 0], [0, 20, 2.1]], [[1.1, 20, 0], [1.1, 20, 2.1]],
      [[3.2, 10, 0.2], [3.2, 10, 4.3]], [[4, 20, 1], [4, 20, 2.4]], [[9.4, 20, 1], [9.4, 20, 2.4]], [[-5, 20, 4], [-5, 20, 5.6]]],
    vodA: [[[-5, 4, 0], [6, 4, 0]], [[-5, 7, 0], [7, 7, 0]], [[-5, 11, 0], [8, 11, 0]], [[-6, 15, 0], [9, 15, 0]], [[0, 20, 2.1], [1.1, 20, 2.1]], [[-7, 20, 0.5], [9, 20, 0.5]]],
    vodB: [[[-4, 3, 0], [-4, 16, 0]], [[-1, 3, 0], [-1, 16, 0]], [[2, 3, 0], [2, 16, 0]], [[5, 3, 0], [5, 16, 0]], [[-7, 8, 6.5], [-7, 20, 6.5]], [[-7, 10, 2.6], [-7, 11.6, 2.6]]]
  };

  /* Parkoviště: asfalt, stání, auta, budova s dveřmi, dopravní značka, lampa. */
  function parkoviste(k) {
    const K = kreslic(k);
    K.plocha([[-12, 0, 0], [40, 0, 0], [40, 30, 0], [-20, 30, 0]], '#606366');
    K.plocha([[-20, 29.2, 0], [40, 29.2, 0], [40, 30, 0], [-20, 30, 0]], '#8d8f91');
    for (const x of [-6, -3.5, -1, 1.5, 4]) K.cara([x, 10, 0], [x, 15, 0], '#f2f2f2', 2);
    K.cara([-6, 10, 0], [4, 10, 0], '#f2f2f2', 2); K.cara([-10, 15, 0], [10, 15, 0], '#f2f2f2', 2);
    K.cara([-10, 22, 0], [12, 22, 0], '#e8d36a', 2);
    K.plocha([[-20, 30, 0], [40, 30, 0], [40, 30, 7], [-20, 30, 7]], '#b9a88c', '#8b7d66');
    K.plocha([[2, 30, 0], [3, 30, 0], [3, 30, 2.1], [2, 30, 2.1]], '#3d4c5a', '#1c242b');
    for (const x of [-12, -8, -4, 6, 10, 14, 18, 22]) K.plocha([[x, 30, 1.2], [x + 2, 30, 1.2], [x + 2, 30, 2.6], [x, 30, 2.6]], '#6c8aa3', '#33414d');
    for (const x of [-12, -8, -4, 0, 6, 10, 14, 18, 22]) K.plocha([[x, 30, 4], [x + 2, 30, 4], [x + 2, 30, 5.4], [x, 30, 5.4]], '#6c8aa3', '#33414d');
    K.kvadr(-5.6, -3.9, 10.6, 14.6, 0.15, 1.1, ['#8b1e1e', '#8b1e1e', '#a12626', '#a12626', '#701818']);
    K.kvadr(-5.4, -4.1, 11.6, 13.6, 1.1, 1.5, ['#2c3a46', '#2c3a46', '#33444f', '#33444f', '#6d1515']);
    K.kvadr(-0.6, 1.1, 10.4, 14.4, 0.15, 1.15, ['#2a4f7a', '#2a4f7a', '#30598a', '#30598a', '#21405f']);
    K.kvadr(-0.4, 0.9, 11.3, 13.3, 1.15, 1.55, ['#2c3a46', '#2c3a46', '#33444f', '#33444f', '#1c3550']);
    K.cara([7, 16, 0], [7, 16, 2.8], '#9a9da0', 3);
    K.plocha([[6.7, 16, 2.2], [7.3, 16, 2.2], [7.3, 16, 2.8], [6.7, 16, 2.8]], '#1f5fbf', '#ffffff');
    K.cara([-9, 20, 0], [-9, 20, 6], '#2e3236', 5);
    return K;
  }
  const PARKOVISTE_CARY = {
    svisle: [[[2, 30, 0], [2, 30, 2.1]], [[3, 30, 0], [3, 30, 2.1]], [[7, 16, 0], [7, 16, 2.8]], [[-9, 20, 0.2], [-9, 20, 5.8]],
      [[6, 30, 1.2], [6, 30, 2.6]], [[16, 30, 1.2], [16, 30, 2.6]], [[-12, 30, 4], [-12, 30, 5.4]]],
    vodA: [[[-6, 10, 0], [4, 10, 0]], [[-10, 15, 0], [10, 15, 0]], [[-10, 22, 0], [12, 22, 0]], [[-12, 30, 0], [16, 30, 0]], [[2, 30, 2.1], [3, 30, 2.1]]],
    vodB: [[[-6, 10, 0], [-6, 15, 0]], [[-3.5, 10, 0], [-3.5, 15, 0]], [[-1, 10, 0], [-1, 15, 0]], [[1.5, 10, 0], [1.5, 15, 0]], [[4, 10, 0], [4, 15, 0]]]
  };

  function snimekVenku(nazev, kam, stavba, cary, opt) {
    const k = kamera(kam), K = stavba(k), A = anotator(k, opt.seed || 11, opt.sumPx != null ? opt.sumPx : 0.4);
    (opt.osoby || []).forEach(o => osobaPrvky(K, k, o));
    const sn = prazdnySnimek(nazev, k.sirka, k.vyska);
    sn.id = opt.id || noveId(); sn.k1 = k.k1 || 0; sn.sigmaPx = opt.sigmaPx || 1;
    sn.svisle = A.sada(cary.svisle); sn.vodA = A.sada(cary.vodA); sn.vodB = A.sada(cary.vodB);
    sn.reference = (opt.reference || []).map(f => f(A));
    sn.mereni = (opt.osoby || []).map((o, i) => A.osoba('m' + (i + 1) + sn.id, o.nazev || ('Osoba ' + (o.osoba || 'A')), o, o.korekce));
    return { sn, kamera: k, prvky: K.P, A };
  }

  /* Čerpací stanice v noci (modelový případ 17/2026): betonové dlaždice 1 m, výdejní stojan,
     kombi u stojanu, prodejna se dveřmi a osvětlenými výlohami, sloup přístřešku s pruhem. */
  function cerpaci(k) {
    const K = kreslic(k);
    K.plocha([[-16, -1, 0], [24, -1, 0], [24, 30, 0], [-16, 30, 0]], '#1e2023');
    K.dlazba(-6, 9, 3, 17, 1, '#3d3f42', '#2c2e31');
    K.plocha([[-16, 20, 0], [24, 20, 0], [24, 20, 4.2], [-16, 20, 4.2]], '#2e2d2a', '#1a1917');
    K.plocha([[-16, 20, 3.1], [24, 20, 3.1], [24, 20, 3.9], [-16, 20, 3.9]], '#16532c');
    K.plocha([[3, 20, 3.3], [11, 20, 3.3], [11, 20, 3.7], [3, 20, 3.7]], '#e8e2c4');
    for (const x of [2, 9]) K.plocha([[x, 20, 0.4], [x + 5, 20, 0.4], [x + 5, 20, 2.4], [x, 20, 2.4]], '#d9cf8f', '#4a4636');
    K.plocha([[-0.2, 20, 0], [1.3, 20, 0], [1.3, 20, 2.3], [-0.2, 20, 2.3]], '#3a3a36');
    K.plocha([[0, 20, 0], [1.1, 20, 0], [1.1, 20, 2.1], [0, 20, 2.1]], '#b9c48e', '#20201c');
    K.cara([0.55, 20, 0], [0.55, 20, 2.1], '#20201c', 2);
    K.plocha([[-0.4, 8.9, 0], [2.3, 8.9, 0], [2.3, 11.1, 0], [-0.4, 11.1, 0]], '#8f7d2a');
    K.cara([-2, 12, 0], [-2, 12, 5.2], '#a9acaf', 9);
    K.plocha([[-2.12, 12, 2.5], [-1.88, 12, 2.5], [-1.88, 12, 2.8], [-2.12, 12, 2.8]], '#e03a2a', '#ffffff');
    K.kvadr(0.5, 1.4, 9.7, 10.3, 0, 2.1, ['#c9ccd0', '#c9ccd0', '#a7abb0', '#a7abb0', '#e7e9eb'], '#4b4f54');
    K.plocha([[0.62, 9.7, 1.3], [1.28, 9.7, 1.3], [1.28, 9.7, 1.7], [0.62, 9.7, 1.7]], '#8fd8ff', '#1b3d52');
    K.plocha([[0.5, 9.7, 1.85], [1.4, 9.7, 1.85], [1.4, 9.7, 2.1], [0.5, 9.7, 2.1]], '#16532c');
    K.cara([1.45, 9.9, 1.2], [1.95, 9.2, 0.95], '#111111', 3);
    K.kvadr(2.4, 4.2, 8.6, 13.2, 0.18, 1.0, ['#1d2b44', '#1d2b44', '#22324f', '#22324f', '#17233a']);
    K.kvadr(2.55, 4.05, 9.0, 12.9, 1.0, 1.47, ['#1a2230', '#1a2230', '#202a3a', '#202a3a', '#141c2c']);
    K.plocha([[2.5, 8.6, 0.75], [2.9, 8.6, 0.75], [2.9, 8.6, 0.9], [2.5, 8.6, 0.9]], '#ff3b30');
    K.plocha([[3.7, 8.6, 0.75], [4.1, 8.6, 0.75], [4.1, 8.6, 0.9], [3.7, 8.6, 0.9]], '#ff3b30');
    return K;
  }
  const CERPACI_CARY = {
    svisle: [[[0.5, 9.7, 0], [0.5, 9.7, 2.1]], [[1.4, 9.7, 0], [1.4, 9.7, 2.1]], [[0, 20, 0], [0, 20, 2.1]], [[1.1, 20, 0], [1.1, 20, 2.1]],
      [[2, 20, 0.4], [2, 20, 2.4]], [[7, 20, 0.4], [7, 20, 2.4]], [[9, 20, 0.4], [9, 20, 2.4]], [[-2, 12, 0.1], [-2, 12, 2.4]]],
    vodA: [[[-5.5, 5, 0], [8, 5, 0]], [[-5.5, 7, 0], [8, 7, 0]], [[-5.5, 14, 0], [8.5, 14, 0]], [[-5.5, 16, 0], [8.5, 16, 0]],
      [[0, 20, 2.1], [1.1, 20, 2.1]], [[2, 20, 0.4], [14, 20, 0.4]]],
    vodB: [[[-5, 3.5, 0], [-5, 16.5, 0]], [[-3, 3.5, 0], [-3, 16.5, 0]], [[-1, 3.5, 0], [-1, 16.5, 0]], [[6, 3.5, 0], [6, 16.5, 0]], [[8, 3.5, 0], [8, 16.5, 0]]]
  };
  // podezřelí modelového případu – ze sdíleného spisu (vysetrovani/pripad.js), jinak záložní kopie
  function podezreliPripadu17() {
    const P = typeof window !== 'undefined' && window.MODELOVY_PRIPAD;
    const os = P && Array.isArray(P.osoby) ? P.osoby.filter(o => o.role === 'podezřelý' && o.vyska > 0) : [];
    const zdroj = os.length ? os : [{ id: 'brabec', jmeno: 'Tomáš Brabec', vyska: 187 }, { id: 'fiala', jmeno: 'Lukáš Fiala', vyska: 174 }];
    return zdroj.map(o => ({ id: String(o.id), jmeno: o.jmeno, vyska: o.vyska, tol: 1 }));
  }

  /* ---------- galerie ukázek: každá předvádí jinou schopnost, pravda je známá ---------- */
  const KAM_ZAKLAD = { C: [0, 0, 3.0], yaw: 8, pitch: 19, roll: 1.5, f: 1000, sirka: 1280, vyska: 860, k1: 0.06 };
  const UKAZKY = [
    { id: 'zaklad', ikona: '🚪', nazev: 'Chodba se dveřmi – základní postup',
      popis: 'Kamera ve výšce 3 m s mírným soudkovitým zkreslením (k1 = 0,06, zadané). Dvě reference (dveře, značka na sloupu) a tatáž osoba (180 cm) ve dvou polohách. Všechny čáry jsou zakreslené.',
      ukoly: ['Prohlédněte barevné sady čar a čárkovaná prodloužení k úběžníkům a horizont.', 'Nástrojem ✋ (V) chytněte temeno osoby a posuňte ho – výsledek se mění živě, lupa ukazuje detail.', 'Porovnejte váhy obou poloh ve výsledku: blíž ke kameře = víc pixelů na centimetr = větší váha.', 'Otevřete 📄 Protokol a podívejte se, co obsahuje.'],
      vytvor() {
        const o = { x: 1, y: 7, H: 180, osoba: 'A', nazev: 'Osoba A – poloha 1' }, o2 = { x: -1.6, y: 5, H: 180, osoba: 'A', nazev: 'Osoba A – poloha 2' };
        return { snimky: [snimekChodby('Chodba – kamera 1', KAM_ZAKLAD, { id: 'zakl1', seed: 7, osoby: [o, o2] })], pravda: { A: 180 } };
      } },
    { id: 'zkresleni', ikona: '🐟', nazev: 'Širokoúhlá kamera – oprava zkreslení',
      popis: 'Širokoúhlý objektiv se silným soudkovitým zkreslením (skutečné k1 = 0,22), ale v kalibraci je zadané k1 = 0. Rovné hrany u okrajů jsou prohnuté, a proto se čáry nesbíhají do jednoho bodu. Osoba měří 172 cm.',
      ukoly: ['Všimněte si varování o úsečkách mimo úběžník a odchylky od pravdy.', 'V části 📐 Kalibrace stiskněte 🎯 Odhadnout k1 z čar – odhad hledá k1, při kterém se čáry každé sady nejlépe sbíhají.', 'Porovnejte výsledek před a po opravě; zadejte nejistotu k1 (např. 0,01) a sledujte citlivostní analýzu.'],
      vytvor() {
        const o = { x: -3.1, y: 5.4, H: 172, osoba: 'A', nazev: 'Osoba A' };
        const s = snimekChodby('Širokoúhlá kamera', { C: [0.6, 0.6, 2.4], yaw: 6, pitch: 14, roll: 1, f: 600, sirka: 1280, vyska: 860, k1: 0.22 },
          { id: 'zkr1', seed: 21, y0: 1.6, osoby: [o], k1Zadane: 0, reference: ['dvere', 'sloup'] });
        return { snimky: [s], pravda: { A: 172 } };
      } },
    { id: 'reference', ikona: '⚖️', nazev: 'Tři reference, jedna chybná',
      popis: 'Tři reference: dveře, značka na sloupu a parapet okna. Dveře mají ve skutečnosti 197 cm, ale omylem je zadáno typizovaných 210 cm. Reference se kombinují váženě (podle přesnosti) a navzájem kontrolují. Osoba měří 168 cm.',
      ukoly: ['V části 🚪 Reference najděte, která reference vybočuje z kontroly ostatními (z-skóre, rozdíl v cm).', 'Odškrtněte „použít“ u chybné reference nebo opravte její výšku na 197 cm – výsledek se přiblíží pravdě.', 'Zkuste naopak vyřadit dobré reference a sledujte, jak roste nejistota.'],
      vytvor() {
        const o = { x: 0.6, y: 7.5, H: 168, osoba: 'A', nazev: 'Osoba A', barva: '#3a2f4a' };
        const s = snimekChodby('Chodba – tři reference', Object.assign({}, KAM_ZAKLAD, { C: [-0.6, -0.5, 2.8], yaw: 2, pitch: 15, f: 820 }),
          { id: 'ref1', seed: 31, dvere: 1.97, dvereZadano: 210, osoby: [o], reference: ['dvere', 'sloup', 'parapet'] });
        return { snimky: [s], pravda: { A: 168 } };
      } },
    { id: 'postoj', ikona: '🚶', nazev: 'Chůze, obuv a čepice – korekce postoje',
      popis: 'Venkovní záběr na náměstí. Osoba (tělesná výška 178 cm) jde, má sportovní boty (+2,5 cm) a čepici (+2,5 cm), v kroku je temeno o 2 cm níž. Z fotky se měří viditelný vrchol – tělesnou výšku dají až korekce s nejistotou.',
      ukoly: ['Porovnejte v tabulce „Geom.“ (vrchol nad zemí) a „Výška“ po korekcích.', 'Upravte rozsahy korekcí nebo je smažte a sledujte posun výsledku i šířku intervalu.', 'V citlivostní analýze uvidíte, že korekce postoje tu přispívají k nejistotě nejvíc.'],
      vytvor() {
        const o = { x: -1.5, y: 9, H: 178, boty: 2.5, chuze: 2, cepice: 2.5, krok: true, osoba: 'A', nazev: 'Osoba A – v chůzi', barva: '#2c4a3a',
          korekce: [predvolba('Obuv – sportovní'), predvolba('Chůze – neznámá'), predvolba('Čepice')] };
        const s = snimekVenku('Náměstí', { C: [0.5, -1, 1.9], yaw: -4, pitch: 5, roll: -0.8, f: 1000, sirka: 1280, vyska: 860, k1: 0.03 }, namesti, NAMESTI_CARY,
          { id: 'pos1', seed: 41, osoby: [o], reference: [A => A.ref('rd', 'Dveře domu – výška otvoru', 210, 0.5, [0, 20, 0], [0, 20, 2.1]),
            A => A.ref('rl', 'Lampa – spodní hrana pruhu', 250, 1, [3.2, 10, 0], [3.2, 10, 2.5])] });
        return { snimky: [s], pravda: { A: 178 } };
      } },
    { id: 'vice', ikona: '🎞️', nazev: 'Tři snímky jedné osoby – sloučení',
      popis: 'Tatáž osoba (185 cm) zachycená třemi kamerami: z výšky, vodorovně (svislice jsou na snímku rovnoběžné, úběžník v nekonečnu) a z dálky v nízkém rozlišení s rozmazáním. Odhady se slučují váženým průměrem podle nejistoty.',
      ukoly: ['Přepínejte snímky v poli Snímek v liště.', 'Ve výsledku porovnejte váhy měření – vzdálená kamera s nízkým rozlišením má malou váhu.', 'Vyřaďte (odškrtněte) nejlepší měření a sledujte, jak se rozšíří interval.'],
      vytvor() {
        const H = 185, s1 = snimekChodby('Kamera 1 – z výšky', KAM_ZAKLAD, { id: 'vic1', seed: 51, osoby: [{ x: 0.5, y: 7, H, osoba: 'A', nazev: 'Kamera 1 – osoba A' }] });
        const s2 = snimekChodby('Kamera 2 – vodorovně', { C: [3.2, 1.0, 1.6], yaw: -14, pitch: 0, roll: 0, f: 950, sirka: 1280, vyska: 860, k1: 0 },
          { id: 'vic2', seed: 52, y0: 2, osoby: [{ x: -0.4, y: 7.5, H, osoba: 'A', nazev: 'Kamera 2 – osoba A' }] });
        const s3 = snimekChodby('Kamera 3 – daleko, nízké rozlišení', { C: [-3.5, -3.5, 2.6], yaw: 22, pitch: 9, roll: 0, f: 470, sirka: 640, vyska: 430, k1: 0 },
          { id: 'vic3', seed: 53, sumPx: 1.2, sigmaPx: 2, osoby: [{ x: -1, y: 9.5, H, osoba: 'A', nazev: 'Kamera 3 – osoba A' }] });
        return { snimky: [s1, s2, s3], pravda: { A: H } };
      } },
    { id: 'podezreli', ikona: '🔎', nazev: 'Parkoviště – porovnání s podezřelými',
      popis: 'Bezpečnostní kamera ve výšce 5 m nad parkovištěm, rozlišení 1280 × 720, mírné rozmazání (σ = 1 px). Pachatel (osoba A, 181 cm) a svědkyně (osoba B, 165 cm). Čtyři podezřelí se známou výškou – které lze vyloučit?',
      ukoly: ['V části 🔎 Porovnání s podezřelými sledujte verdikty – shoda výšky nic neprokazuje, jen nevylučuje.', 'Přepněte porovnávanou osobu na B.', 'Citlivostní analýza ukáže, který vstup nejvíc rozšiřuje interval – zkuste ho zlepšit (např. menší σ kliknutí).'],
      vytvor() {
        const A = { x: 2.8, y: 12.6, H: 181, boty: 2.5, osoba: 'A', nazev: 'Pachatel (A)', barva: '#b5651d', korekce: [predvolba('Obuv – běžná'), predvolba('Stoj')] };
        const B = { x: -2.4, y: 8, H: 165, boty: 3, osoba: 'B', nazev: 'Svědkyně (B)', barva: '#6a3b5c', korekce: [predvolba('Obuv – běžná'), predvolba('Stoj')] };
        const s = snimekVenku('Kamera parkoviště', { C: [-6.5, -2, 5], yaw: 21, pitch: 19, roll: 0.5, f: 1000, sirka: 1280, vyska: 720, k1: 0.05 }, parkoviste, PARKOVISTE_CARY,
          { id: 'pod1', seed: 61, sumPx: 0.7, sigmaPx: 1, osoby: [A, B], reference: [
            X => X.ref('rd', 'Dveře budovy', 210, 1, [2, 30, 0], [2, 30, 2.1]),
            X => X.ref('rz', 'Dopravní značka – spodní hrana', 220, 1.5, [7, 16, 0], [7, 16, 2.2])] });
        return { snimky: [s], pravda: { A: 181, B: 165 }, porovnat: 'A',
          podezreli: [{ id: 'p1', jmeno: 'Novák', vyska: 181, tol: 1 }, { id: 'p2', jmeno: 'Král', vyska: 178, tol: 1 },
            { id: 'p3', jmeno: 'Svoboda', vyska: 166, tol: 1 }, { id: 'p4', jmeno: 'Dvořák', vyska: 194, tol: 1.5 }] };
      } },
    { id: 'pripad17', ikona: '🕵️', nazev: 'Modelový případ 17/2026 – řidič u stojanu',
      popis: 'Noční záznam kamery čerpací stanice U Křížku (stopa č. 5, 15. 11. 2026 02:21). Řidič v kapuci tankuje tmavé kombi. Reference: výdejní stojan (210 cm), dveře prodejny (210 cm) a pruh na sloupu přístřešku (250 cm), na zemi betonové dlaždice 1 × 1 m. Kamera v rohu přístřešku ve výšce 4,2 m, šum a rozmazání nočního záznamu. Porovnání s podezřelými T. Brabcem (187 cm) a L. Fialou (174 cm).',
      ukoly: ['V části 🔎 Porovnání s podezřelými zjistěte, kterého podezřelého výška vylučuje – a uvědomte si, že shoda u druhého nic neprokazuje.', 'Kapuce a sportovní obuv zvedají viditelný vrchol: porovnejte „Geom.“ a „Výška“ po korekcích a zkuste rozsahy korekcí změnit.', 'Vyřaďte postupně jednotlivé reference (stojan, dveře, sloup) a sledujte, jak se mění výsledek i interval.', 'Výsledek zapište do 📄 Protokolu – v modelovém případu pak pokračujte časovou analýzou (pruh nahoře).'],
      vytvor() {
        const o = { x: 1.75, y: 8.3, H: 187, boty: 2.5, cepice: 2.5, cepiceBarva: '#30343b', osoba: 'A', nazev: 'Řidič u stojanu (A)', barva: '#25282e',
          korekce: [predvolba('Obuv – sportovní'), predvolba('Čepice'), predvolba('Stoj')] };
        const s = snimekVenku('Kamera 2 – čerpací stanice U Křížku, 02:21', { C: [-5, -2, 4.2], yaw: 25, pitch: 17, roll: 0.6, f: 1050, sirka: 1280, vyska: 720, k1: 0.04, noc: true },
          cerpaci, CERPACI_CARY, { id: 'mp17', seed: 1717, sumPx: 0.8, sigmaPx: 1.5, osoby: [o], reference: [
            X => X.ref('rs', 'Výdejní stojan – horní hrana', 210, 1, [0.5, 9.7, 0], [0.5, 9.7, 2.1]),
            X => X.ref('rd', 'Dveře prodejny – světlá výška', 210, 0.5, [0, 20, 0], [0, 20, 2.1]),
            X => X.ref('rp', 'Sloup přístřešku – spodní hrana pruhu', 250, 1, [-2, 12, 0], [-2, 12, 2.5])] });
        return { snimky: [s], pravda: { A: 187 }, porovnat: 'A', podezreli: podezreliPripadu17() };
      } },
    { id: 'cviceni', ikona: '✏️', nazev: 'Cvičení – změřte sami',
      popis: 'Prázdný snímek chodby bez jediné čáry. Zakreslete všechno sami podle průvodce: svislé hrany, čáry na zemi ve dvou směrech, dveře (205 cm) nebo spodní hranu modré značky (220 cm) a osobu. Pravda se ukáže, až bude osoba změřená.',
      ukoly: ['Postupujte podle 🧭 Průvodce v panelu (zkratky 1, 2, 3, R, O).', 'Pro přesnost přibližte kolečkem a zapněte 🧲 přichytávání k rohům.', 'Zkreslení je zanedbatelné (k1 = 0). Až budete hotovi, porovnejte výsledek s pravdou a zkontrolujte, zda ji 95% interval pokrývá.'],
      vytvor() {
        const s = snimekChodby('Cvičení – chodba', { C: [-1, 0.5, 2.6], yaw: 16, pitch: 16, roll: -1, f: 900, sirka: 1280, vyska: 860, k1: 0 },
          { id: 'cvi1', seed: 71, anotovat: false, osoby: [{ x: 0.3, y: 7.5, H: 174, osoba: 'A' }] });
        return { snimky: [s], pravda: { A: 174 } };
      } }
  ];

  /* Sestaví případ z ukázky: { pripad, sceny: [{kamera, prvky}] } (obrázky vykreslí UI). */
  function vytvorUkazku(id) {
    const u = UKAZKY.find(x => x.id === id);
    if (!u) return null;
    const v = u.vytvor(), p = prazdnyPripad();
    p.nazev = 'Ukázka: ' + u.nazev; p.poznamka = 'Syntetická scéna se známou pravdou (generovaná programem).';
    p.snimky = v.snimky.map(s => s.sn); p.pravda = v.pravda || {}; p.podezreli = v.podezreli || []; p.porovnat = v.porovnat || '';
    p.ukazka = { id: u.id };
    p.mcN = 2000;
    return { pripad: p, sceny: v.snimky.map(s => ({ kamera: s.kamera, prvky: s.prvky })) };
  }

  /* Odhad k1 z přímosti: hledá k1, při kterém se úsečky každé sady nejlépe sejdou v jednom bodě
     (u sad s ≥3 úsečkami; zakřivení z rovných hran se na sbíhavosti projeví). */
  function odhadK1(sn) {
    const sady = [sn.svisle, sn.vodA, sn.vodB].filter(s => s.length >= 3);
    if (!sady.length) return null;
    const cena = k1 => sady.reduce((c, s) => {
      const u = ubeznik(s.map(x => [odzkresli(x[0], k1, sn.sirka, sn.vyska), odzkresli(x[1], k1, sn.sirka, sn.vyska)]), sn.sirka, sn.vyska);
      return c + (u ? u.rezidum : 0);
    }, 0);
    let a = -0.4, b = 0.4; const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a), d = a + g * (b - a), fc = cena(c), fd = cena(d);
    for (let i = 0; i < 60; i++) {
      if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = cena(c); }
      else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = cena(d); }
    }
    return Math.round((a + b) / 2 * 1000) / 1000;
  }

  const VYSKA = { VERZE, krz, sk, jed, hom, kart, odzkresli, zkresli, nejmensiVlastni, ubeznik, prazdnySnimek, prazdnyPripad, normSnimek, migruj, osobaId,
    PREDVOLBY, kalibrace, faktor, naSvislici, poSvislici, vyhodnotSnimek, cmNaPixel, vyskaDvojpomerem, rng, gauss, statistika, histogram,
    ZDROJE, rozkmitniSnimek, vyhodnot, vahyGLS, citlivost, porovnej, VERDIKTY, rohVOkoli,
    kamera, promitni, hloubka, vrchOsoby, UKAZKY, vytvorUkazku, odhadK1, noveId };
  if (typeof module !== 'undefined' && module.exports) module.exports = VYSKA;
  if (typeof window !== 'undefined') window.VYSKA = VYSKA;
})();
