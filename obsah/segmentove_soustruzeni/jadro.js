/* ============================================================
   Segmentové soustružení – jádro výpočtu (bez DOM, čisté funkce)
   Souřadnice nádoby: z = výška od spodní plochy dna (mm, nahoru), r = poloměr (mm), φ = úhel (rad).
   Profil: vnější křivka r(z) z řídicích bodů (kubický Hermite s tečnami Catmull-Rom, bod může být „ostrý“),
   vnitřní křivka = odsazení vnější o tloušťku stěny (eroze kruhem, tj. přesná kolmá vzdálenost)
   nebo vlastní body. Dno má tloušťku tb (vnitřek začíná ve výšce tb).
   Kroužky leží od z = −přídavek; každý kroužek = vrstva prkna tloušťky h, rozdělená na n segmentů.
   Kus (segment, dýha ve spáře, blok otevřeného segmentování) = konvexní čtyřúhelník omezený čtyřmi přímkami:
     – In / Out: kolmice ke směru θ (osa kusu) ve vzdálenosti aIn / aOut od středu,
     – L / R: přímky {a, c} = body p s −sin(a)·px + cos(a)·py = c (radiála pro c = 0, rovnoběžka pro c ≠ 0);
       kus leží mezi nimi, na kružnici r má úhly φ ∈ [a_L + asin(c_L/r), a_R + asin(c_R/r)].
   ============================================================ */
(function (koren) {
  'use strict';
  const PI = Math.PI, RAD = PI / 180, DEG = 180 / PI;
  const r2 = (x) => Math.round(x * 100) / 100;
  const r1 = (x) => Math.round(x * 10) / 10;
  const cislo = (v, d) => { const x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : d; };
  const omez = (x, a, b) => Math.max(a, Math.min(b, x));
  const asinB = (x) => Math.asin(omez(x, -1, 1));

  /* ---------------- dřeviny (typické hodnoty, editovatelné) ---------------- */
  /** hustota = typická objemová hmotnost při vlhkosti ~12 % (kg/m³) – orientační, upravte podle svého materiálu */
  const DREVINY = [
    { id: 'javor', nazev: 'javor', barva: '#e8d6b0', hustota: 650 },
    { id: 'orech', nazev: 'ořech', barva: '#6e4a31', hustota: 640 },
    { id: 'tresen', nazev: 'třešeň', barva: '#b8734b', hustota: 600 },
    { id: 'buk', nazev: 'buk', barva: '#d9a878', hustota: 720 },
    { id: 'dub', nazev: 'dub', barva: '#c6a066', hustota: 700 },
    { id: 'jasan', nazev: 'jasan', barva: '#dcc79e', hustota: 690 },
    { id: 'svestka', nazev: 'švestka', barva: '#8e4c3a', hustota: 800 },
    { id: 'akat', nazev: 'akát', barva: '#c8a84e', hustota: 770 },
    { id: 'briza', nazev: 'bříza', barva: '#e6d3a8', hustota: 650 },
    { id: 'lipa', nazev: 'lípa', barva: '#ecdcb8', hustota: 530 },
    { id: 'olse', nazev: 'olše', barva: '#c98b5d', hustota: 530 },
    { id: 'hruska', nazev: 'hrušeň', barva: '#c49a7c', hustota: 700 },
    { id: 'wenge', nazev: 'wenge', barva: '#3e2c21', hustota: 870 },
    { id: 'padouk', nazev: 'padouk', barva: '#ad4528', hustota: 750 },
    { id: 'sapelli', nazev: 'sapelli (mahagon)', barva: '#8b4a33', hustota: 640 },
    { id: 'zebrano', nazev: 'zebrano', barva: '#cfa66b', hustota: 740 },
    { id: 'eben', nazev: 'eben (makassar)', barva: '#2b201b', hustota: 1050 },
  ];

  const NASTAVENI = {
    tlPrkna: 19,          // výchozí tloušťka prkna = výška vrstvy
    n: 12,                // výchozí počet segmentů v kroužku
    pridavek: 3,          // přídavek na soustružení radiálně (vně i uvnitř)
    pridavekV: 2,         // přídavek na srovnání spodní plochy (stoh začíná v z = −pridavekV)
    prorez: 2.5,          // šířka řezu pilového kotouče (kerf)
    maxLista: 1000,       // nejdelší lišta, kterou ještě pohodlně řežete
    minPrekryv: 6,        // minimální lepená plocha mezi kroužky (radiálně)
    sloucit: 0,           // sloučit lišty, liší-li se šířka nejvýš o (mm)
    otaceni: true,        // střídavé otáčení lišty (lichoběžníky bez odpadu)
    cihla: true,          // cihlová vazba: každý druhý kroužek pootočit o půl segmentu
    minOtvor: 12,         // menší dutina než tento poloměr → kroužek z plné desky
    odpad: 15,            // odpad na začátku lišty (zarovnání čela)
    maxSirka: 150,        // nejširší lišta, kterou máte (varování)
    papir: 'a4', papirW: 210, papirH: 297, okraj: 8, prekryv: 15, kalibX: 100, kalibY: 100,
    klinDelka: 120, klinVyska: 20, klinHrot: 3, klinDiry: true, dorazDelka: 70, dorazVyska: 30, stlText: true, vule: 0.2,
  };

  const PROFIL = {
    vnejsi: [{ r: 45, z: 0 }, { r: 72, z: 10 }, { r: 108, z: 38 }, { r: 124, z: 68 }, { r: 126, z: 90 }],
    vnitrni: [],
    rezimVnitrni: 'odsazeni',
    stena: 6,
    dno: 8,
  };

  /* ---------------- interpolace profilu ---------------- */
  /** body seřadí podle z, vynutí z0 = 0 a rostoucí z (min. 0,5 mm) a kladné r */
  function normalizujBody(body, odNuly) {
    const b = (body || []).map((q) => ({ r: Math.max(0.5, cislo(q.r, 10)), z: Math.max(0, cislo(q.z, 0)), ostry: !!q.ostry }))
      .sort((a, c) => a.z - c.z);
    if (!b.length) return [];
    if (odNuly) b[0].z = 0;
    for (let i = 1; i < b.length; i++) if (b[i].z < b[i - 1].z + 0.5) b[i].z = b[i - 1].z + 0.5;
    return b;
  }
  /** kubický Hermite r(z) s tečnami Catmull-Rom (nerovnoměrné), ostrý bod = jednostranné tečny */
  function krivka(body) {
    const n = body.length;
    if (n === 0) return () => 0;
    if (n === 1) return () => body[0].r;
    const sm = (i, j) => (body[j].r - body[i].r) / (body[j].z - body[i].z);
    const tL = [], tR = [];
    for (let i = 0; i < n; i++) {
      if (i === 0) { tL[i] = tR[i] = sm(0, 1); continue; }
      if (i === n - 1) { tL[i] = tR[i] = sm(n - 2, n - 1); continue; }
      if (body[i].ostry) { tL[i] = sm(i - 1, i); tR[i] = sm(i, i + 1); continue; }
      tL[i] = tR[i] = (body[i + 1].r - body[i - 1].r) / (body[i + 1].z - body[i - 1].z);
    }
    // konce: tečna z paraboly přes tři body (méně zploštělá než jednostranná)
    if (n >= 3) {
      if (!body[1].ostry) { const s = 2 * sm(0, 1) - tR[1]; tL[0] = tR[0] = s; }
      if (!body[n - 2].ostry) { const s = 2 * sm(n - 2, n - 1) - tL[n - 2]; tL[n - 1] = tR[n - 1] = s; }
    }
    return function (z) {
      if (z <= body[0].z) return body[0].r + tR[0] * (z - body[0].z) * 0;
      if (z >= body[n - 1].z) return body[n - 1].r;
      let i = 0;
      while (i < n - 2 && z > body[i + 1].z) i++;
      const h = body[i + 1].z - body[i].z, t = (z - body[i].z) / h, t2 = t * t, t3 = t2 * t;
      const v = (2 * t3 - 3 * t2 + 1) * body[i].r + (t3 - 2 * t2 + t) * h * tR[i] + (-2 * t3 + 3 * t2) * body[i + 1].r + (t3 - t2) * h * tL[i + 1];
      return Math.max(0.3, v);
    };
  }

  /**
   * Vzorkování profilu. Vrací {H, tb, dz, zs, ro, ri (NaN = plné), rOut(z), rIn(z), maxOut(a,b), minIn(a,b), minStena, body, vnitrniBody}
   * rIn(z) = 0 pod dnem (z < tb), NaN nad okrajem.
   */
  function vzorkujProfil(prof, varovani) {
    const p = Object.assign({}, PROFIL, prof || {});
    const body = normalizujBody(p.vnejsi, true);
    if (body.length < 2) throw new Error('Profil potřebuje aspoň 2 body.');
    const H = body[body.length - 1].z;
    if (H < 5) throw new Error('Nádoba je nižší než 5 mm.');
    const t = Math.max(1, cislo(p.stena, 6));
    const vlastni = p.rezimVnitrni === 'vlastni' && (p.vnitrni || []).length >= 2;
    const vb = vlastni ? normalizujBody(p.vnitrni, false) : [];
    let tb = vlastni ? vb[0].z : Math.max(0, cislo(p.dno, 8));
    if (tb >= H - 1) { tb = Math.max(0, H - 2); if (varovani) varovani.push('Dno je tlustší než výška nádoby – zmenšeno.'); }
    const Nz = Math.max(40, Math.ceil(H / 0.5)), dz = H / Nz;
    const fo = krivka(body), zs = new Float64Array(Nz + 1), ro = new Float64Array(Nz + 1), ri = new Float64Array(Nz + 1);
    for (let i = 0; i <= Nz; i++) { zs[i] = i * dz; ro[i] = fo(zs[i]); }
    if (vlastni) {
      const fi = krivka(vb), zMax = vb[vb.length - 1].z;
      for (let i = 0; i <= Nz; i++) {
        const z = zs[i];
        ri[i] = z < tb - 1e-9 ? 0 : Math.min(fi(Math.min(z, zMax)), ro[i] - 0.5);
        if (ri[i] < 0) ri[i] = 0;
      }
    } else {
      // eroze kruhem poloměru t: vnitřní bod má od vnější křivky kolmou vzdálenost ≥ t
      const k = Math.ceil(t / dz);
      for (let i = 0; i <= Nz; i++) {
        const z = zs[i];
        if (z < tb - 1e-9) { ri[i] = 0; continue; }
        let m = Infinity;
        for (let j = Math.max(0, i - k); j <= Math.min(Nz, i + k); j++) {
          const d = zs[j] - z, q = t * t - d * d;
          if (q < 0) continue;
          const v = ro[j] - Math.sqrt(q);
          if (v < m) m = v;
        }
        ri[i] = Math.max(0, m);
      }
    }
    // skutečná minimální tloušťka stěny (kolmá vzdálenost vnitřní → vnější křivka), jen nad dnem
    let minStena = Infinity;
    const okno = Math.ceil(Math.max(t * 3, 30) / dz);
    for (let i = 0; i <= Nz; i += 2) {
      if (zs[i] < tb || ri[i] <= 0) continue;
      for (let j = Math.max(0, i - okno); j <= Math.min(Nz, i + okno); j++) {
        const d = Math.hypot(ro[j] - ri[i], zs[j] - zs[i]);
        if (d < minStena) minStena = d;
      }
    }
    if (varovani && vlastni && minStena < 2) varovani.push(`Vlastní vnitřní křivka je místy jen ${r1(minStena)} mm od vnější – stěna by se prosoustružila.`);
    const idx = (z) => omez(z / dz, 0, Nz);
    const interp = (arr, z) => { const f = idx(z), i = Math.floor(f), j = Math.min(Nz, i + 1), u = f - i; return arr[i] * (1 - u) + arr[j] * u; };
    const rOut = (z) => (z < -1e-9 || z > H + 1e-9 ? NaN : interp(ro, z));
    const rIn = (z) => (z > H + 1e-9 ? NaN : z < tb - 1e-9 ? 0 : interp(ri, Math.max(z, tb)));
    function maxOut(a, b) {
      a = Math.max(0, a); b = Math.min(H, b); if (b < a) return 0;
      let m = Math.max(rOut(a), rOut(b));
      for (let i = Math.ceil(a / dz); i <= Math.floor(b / dz); i++) if (ro[i] > m) m = ro[i];
      return m;
    }
    /** nejmenší vnitřní poloměr v pásmu (0, když pásmo zasahuje do plného dna) */
    function minIn(a, b) {
      a = Math.max(0, a); b = Math.min(H, b); if (b < a) return 0;
      if (a < tb - 1e-9) return 0;
      let m = Math.min(rIn(a), rIn(b));
      for (let i = Math.ceil(a / dz); i <= Math.floor(b / dz); i++) if (ri[i] < m) m = ri[i];
      return m;
    }
    return { H, tb, t, dz, Nz, zs, ro, ri, rOut, rIn, maxOut, minIn, minStena, body, vnitrniBody: vb, vlastni };
  }

  /** objem dutiny (ml) – kolik se do nádoby vejde po okraj */
  function objemDutiny(P) {
    let v = 0;
    for (let i = 0; i < P.Nz; i++) {
      const z = (P.zs[i] + P.zs[i + 1]) / 2;
      if (z < P.tb) continue;
      const r = P.rIn(z); v += PI * r * r * P.dz;
    }
    return v / 1000;
  }

  /* ---------------- kroužky ---------------- */
  const VYCHOZI_KROUZEK = { h: null, n: null, typ: 'auto', vzor: 'jedna', sekv: [0], podvrstvy: 2, podil: 0.5, dyhaTl: 0, dyhaDruh: 1, posun: null };
  function normalizujKrouzek(c) {
    const k = Object.assign({}, VYCHOZI_KROUZEK, c || {});
    k.sekv = (Array.isArray(k.sekv) && k.sekv.length ? k.sekv : [0]).map((x) => Math.max(0, Math.round(cislo(x, 0))));
    return k;
  }
  /** srovná seznam konfigurací kroužků s výškou nádoby: doplní výchozí, odebere přebytečné nad okrajem */
  function srovnejKrouzky(krouzky, H, nast) {
    const N = Object.assign({}, NASTAVENI, nast || {}), out = [];
    let z = -Math.max(0, cislo(N.pridavekV, 2));
    const src = (krouzky || []).map(normalizujKrouzek);
    for (let i = 0; z < H - 1e-6 && i < 400; i++) {
      const c = src[i] || normalizujKrouzek({});
      out.push(c);
      z += Math.max(0.5, cislo(c.h, N.tlPrkna));
    }
    return out;
  }

  /* ---------------- geometrie kusu ---------------- */
  /** průsečík přímky {a, c} (−sin a·x + cos a·y = c) s kolmicí ke směru θ ve vzdálenosti d */
  function prusecik(pr, th, d) {
    const sa = Math.sin(pr.a), ca = Math.cos(pr.a), st = Math.sin(th), ct = Math.cos(th);
    const det = -sa * st - ca * ct;
    return [(pr.c * st - ca * d) / det, (-sa * d - ct * pr.c) / det];
  }
  /** rohy kusu [In∩L, Out∩L, Out∩R, In∩R] (proti směru hodinových ručiček) */
  function rohy(k) {
    return [prusecik(k.L, k.th, k.aIn), prusecik(k.L, k.th, k.aOut), prusecik(k.R, k.th, k.aOut), prusecik(k.R, k.th, k.aIn)];
  }
  /** úhlový rozsah kusu na kružnici r */
  function uhly(k, r) {
    if (k.typ === 'disk') return [0, 2 * PI];
    return [k.L.a + asinB(k.L.c / r), k.R.a + asinB(k.R.c / r)];
  }
  function plocha(b) { let s = 0; for (let i = 0; i < b.length; i++) { const p = b[i], q = b[(i + 1) % b.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; }
  function plochaKusu(k) { return k.typ === 'disk' ? PI * (k.R * k.R - k.Rin * k.Rin) : plocha(rohy(k)); }
  /** rozměry kusu: Lout, Lin (délky vnější a vnitřní hrany), W (šířka lišty), Lspara (délka spáry) */
  function rozmeryKusu(k) {
    if (k.typ === 'disk') return { Lout: 2 * k.R, Lin: 2 * k.Rin, W: 2 * k.R, Lspara: 0 };
    const q = rohy(k), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    return { Lout: d(q[1], q[2]), Lin: d(q[0], q[3]), W: k.aOut - k.aIn, Lspara: d(q[0], q[1]) };
  }

  /** druh dřeva segmentu j ve vrstvě s podle vzoru */
  function druhSegmentu(c, j, s) {
    const q = c.sekv, n = q.length;
    if (c.vzor === 'jedna') return q[0];
    if (c.vzor === 'sachovnice') return q[(j + s) % n];
    return q[j % n];
  }

  /* ---------------- návrh ---------------- */
  function normalizujProjekt(S0) {
    const S = JSON.parse(JSON.stringify(S0 || {}));
    S.nast = Object.assign({}, NASTAVENI, S.nast || {});
    S.profil = Object.assign({}, PROFIL, S.profil || {});
    if (!Array.isArray(S.dreviny) || !S.dreviny.length) S.dreviny = vychoziDreviny();
    S.dreviny = S.dreviny.map((d, i) => ({ id: d.id || 'd' + i, nazev: String(d.nazev || 'dřevo ' + (i + 1)), barva: /^#[0-9a-f]{6}$/i.test(d.barva) ? d.barva : '#c8a070', hustota: Math.max(100, cislo(d.hustota, 650)) }));
    S.krouzky = (S.krouzky || []).map(normalizujKrouzek);
    return S;
  }
  function vychoziDreviny() { return ['javor', 'orech', 'tresen', 'padouk', 'wenge'].map((id) => Object.assign({}, DREVINY.find((d) => d.id === id))); }

  /**
   * Hlavní výpočet. Vstup: projekt {profil, nast, dreviny, krouzky}.
   * Výstup: {P (profil), krouzky:[...], plan, souhrn, varovani, konfig (srovnané kroužky)}.
   */
  function navrh(S0) {
    const S = normalizujProjekt(S0), N = S.nast, varovani = [];
    const P = vzorkujProfil(S.profil, varovani);
    const konfig = srovnejKrouzky(S.krouzky, P.H, N);
    const nD = S.dreviny.length, druh = (x) => omez(x, 0, nD - 1);
    const p = Math.max(0, cislo(N.pridavek, 3));
    let z = -Math.max(0, cislo(N.pridavekV, 2)), kSeg = 0;
    const krouzky = [];
    konfig.forEach((c, i) => {
      const h = Math.max(0.5, cislo(c.h, N.tlPrkna)), z0 = z, z1 = z + h; z = z1;
      const a = Math.max(0, z0), b = Math.min(P.H, z1);
      const rOutMax = P.maxOut(a, b), rInMin = P.minIn(a, b), rOutMin = Math.min(P.rOut(a), P.rOut(b), ...rozsah(P.ro, a, b, P.dz));
      const n = Math.round(omez(cislo(c.n, N.n), 3, 96));
      const beta = 2 * PI / n;
      const rv = rInMin - p;                 // poloměr, za který nesmí vrchol vnitřního mnohoúhelníku
      let typ = c.typ === 'deska' ? 'deska' : c.typ === 'mezivrstva' ? 'mezivrstva' : c.vzor === 'otevreny' ? 'otevreny' : 'segmenty';
      const K = { i, cislo: i + 1, z0, z1, h, n, beta, uhelRezu: 180 / n, rOutMax, rOutMin, rInMin, rv, c, varovani: [], vrstvy: [] };
      if ((typ === 'segmenty' || typ === 'otevreny') && rv < Math.max(1, cislo(N.minOtvor, 12))) {
        if (c.typ !== 'auto' || c.vzor === 'otevreny') K.varovani.push(`Dutina je tu jen r = ${r1(rInMin)} mm – kroužek je z plné desky.`);
        typ = 'deska';
      }
      K.typ = typ;
      const aOut = rOutMax + p;
      K.aOut = aOut;
      let phi0 = 0;
      if (typ === 'segmenty' || typ === 'otevreny') {
        const pos = c.posun == null || c.posun === '' ? null : cislo(c.posun, null);
        phi0 = pos != null ? pos * RAD : (N.cihla ? (kSeg % 2) * beta / 2 : 0);
        kSeg++;
      }
      K.posun = phi0;
      const tv = typ === 'segmenty' ? Math.max(0, cislo(c.dyhaTl, 0)) : 0;
      K.dyhaTl = tv;
      if (typ === 'segmenty') {
        const aIn = rv * Math.cos(beta / 2);
        K.aIn = aIn;
        const k = c.vzor === 'sachovnice' ? Math.round(omez(cislo(c.podvrstvy, 2), 2, 6)) : 1;
        for (let s = 0; s < k; s++) {
          const kusy = [];
          for (let j = 0; j < n; j++) {
            const aj = phi0 + j * beta;
            kusy.push({ typ: 'seg', j, druh: druh(druhSegmentu(c, j, s)), th: aj + beta / 2, aIn, aOut, L: { a: aj, c: tv / 2 }, R: { a: aj + beta, c: -tv / 2 } });
            if (tv > 0) kusy.push({ typ: 'dyha', j, druh: druh(c.dyhaDruh), th: aj, aIn: rv - Math.max(1, tv), aOut: aOut / Math.cos(beta / 2) + Math.max(1, tv), L: { a: aj, c: -tv / 2 }, R: { a: aj, c: tv / 2 } });
          }
          K.vrstvy.push({ s, z0: z0 + s * h / k, z1: z0 + (s + 1) * h / k, h: h / k, kusy });
        }
        const m = rozmeryKusu(K.vrstvy[0].kusy[0]);
        Object.assign(K, { Lout: m.Lout, Lin: m.Lin, W: m.W, Lspara: m.Lspara });
        if (m.Lin < 4) K.varovani.push(`Vnitřní hrana segmentu je jen ${r1(m.Lin)} mm – snižte počet segmentů.`);
        if (tv > 0 && tv * 3 > m.Lin) K.varovani.push('Dýha ve spáře je vůči segmentu příliš tlustá.');
      } else if (typ === 'otevreny') {
        const f = omez(cislo(c.podil, 0.5), 0.15, 0.9);
        const Lb = f * 2 * aOut * Math.tan(beta / 2);
        let aIn = rv > Lb / 2 ? Math.sqrt(rv * rv - Lb * Lb / 4) : 0;
        if (rv <= Lb / 2) K.varovani.push('Blok otevřeného segmentování je delší než průměr dutiny – zmenšete podíl nebo zvyšte počet.');
        K.aIn = aIn; K.podil = f;
        const kusy = [];
        for (let j = 0; j < n; j++) {
          const th = phi0 + (j + 0.5) * beta;
          kusy.push({ typ: 'blok', j, druh: druh(druhSegmentu(c, j, 0)), th, aIn, aOut, L: { a: th, c: -Lb / 2 }, R: { a: th, c: Lb / 2 } });
        }
        K.vrstvy.push({ s: 0, z0, z1, h, kusy });
        if (aIn > 0 && Lb / (2 * aIn) >= Math.tan(beta / 2)) K.varovani.push('Bloky se na vnitřní straně dotýkají – zmenšete podíl (mezera mezi bloky).');
        Object.assign(K, { Lout: Lb, Lin: Lb, W: aOut - aIn, Lspara: aOut - aIn, mezera: 2 * PI * P.rOut((a + b) / 2) / n - Lb });
      } else {
        const Rin = typ === 'mezivrstva' && rv >= Math.max(1, cislo(N.minOtvor, 12)) ? rv : 0;
        K.aIn = Rin;
        K.vrstvy.push({ s: 0, z0, z1, h, kusy: [{ typ: 'disk', j: 0, druh: druh(c.sekv[0]), R: aOut, Rin }] });
        Object.assign(K, { Lout: 2 * aOut, Lin: 2 * Rin, W: aOut - Rin, Lspara: 0 });
      }
      if (K.W > cislo(N.maxSirka, 150)) K.varovani.push(`Lišta široká ${r1(K.W)} mm je širší než vaše maximum ${N.maxSirka} mm.`);
      // objemy a hmotnost
      let hruby = 0, hotovy = 0, mHruba = 0, mHotova = 0;
      const podleDruhu = {};
      for (const v of K.vrstvy) for (const q of v.kusy) {
        const ro = S.dreviny[q.druh].hustota * 1e-9;
        const vh = plochaKusu(q) * v.h, vf = objemKusuHotovy(P, q, v.z0, v.z1);
        hruby += vh; hotovy += vf; mHruba += vh * ro; mHotova += vf * ro;
        podleDruhu[q.druh] = (podleDruhu[q.druh] || 0) + vf;
      }
      Object.assign(K, { objemHruby: hruby, objemHotovy: hotovy, hmotnostHruba: mHruba, hmotnostHotova: mHotova, podleDruhu });
      krouzky.push(K);
    });
    // lepená plocha mezi sousedními kroužky
    for (let i = 1; i < krouzky.length; i++) {
      const A = krouzky[i - 1], B = krouzky[i];
      const vin = (K) => (K.typ === 'segmenty' ? K.rv : K.typ === 'otevreny' ? Math.hypot(K.aIn, K.Lout / 2) : K.aIn);
      const prekryv = Math.min(A.aOut, B.aOut) - Math.max(vin(A), vin(B));
      B.prekryv = prekryv;
      if (prekryv < cislo(N.minPrekryv, 6)) B.varovani.push(`Lepená plocha s kroužkem ${A.cislo} je jen ${r1(prekryv)} mm – profil je tu příliš strmý pro tloušťku ${r1(B.h)} mm (použijte tenčí prkno nebo větší přídavek).`);
    }
    for (const K of krouzky) for (const v of K.varovani) varovani.push(`Kroužek ${K.cislo}: ${v}`);
    const posl = krouzky[krouzky.length - 1];
    if (posl && posl.z1 - P.H < cislo(N.pridavekV, 2) - 1e-6) varovani.push(`Horní kroužek přesahuje okraj jen o ${r1(posl.z1 - P.H)} mm – zvětšete jeho tloušťku, nebo snižte nádobu.`);
    if (posl && posl.z1 - P.H > posl.h * 0.6 + 2) varovani.push(`Horní kroužek přesahuje okraj o ${r1(posl.z1 - P.H)} mm – stačí tenčí prkno.`);
    if (krouzky.some((K) => K.typ !== 'deska' && K.typ !== 'mezivrstva' && K.n % 2)) varovani.push('Lichý počet segmentů nejde slepit po polovinách – lepte celý kroužek najednou (stahovací pásek).');
    if (P.minStena < P.t - 0.3 && !P.vlastni) varovani.push(`Stěna je místy jen ${r1(P.minStena)} mm.`);
    const plan = rezPlan(krouzky, S, N);
    const souhrn = souhrnNavrhu(krouzky, S, P, plan);
    return { S, P, N, konfig, krouzky, plan, souhrn, varovani, dreviny: S.dreviny };
  }
  function rozsah(arr, a, b, dz) { const o = []; for (let i = Math.ceil(a / dz); i <= Math.floor(b / dz); i++) o.push(arr[i]); return o; }

  /** objem kusu po soustružení v pásmu [z0, z1] (mm³): ∫∫ šířka úhlu(r)·r dr dz mezi rIn(z) a rOut(z) */
  function objemKusuHotovy(P, k, z0, z1) {
    const a = Math.max(0, z0), b = Math.min(P.H, z1);
    if (b <= a) return 0;
    const nz = Math.max(3, Math.ceil((b - a) / 1.5)), nr = 12;
    let v = 0;
    for (let iz = 0; iz < nz; iz++) {
      const z = a + (iz + 0.5) * (b - a) / nz, ro = P.rOut(z), ri = Math.max(0, P.rIn(z) || 0);
      if (!(ro > ri)) continue;
      let s = 0;
      for (let ir = 0; ir < nr; ir++) {
        const r = ri + (ir + 0.5) * (ro - ri) / nr;
        let w;
        if (k.typ === 'disk') w = r >= k.Rin && r <= k.R ? 2 * PI : 0;
        else { const u = uhly(k, r); w = Math.max(0, u[1] - u[0]); }
        s += w * r;
      }
      v += s * (ro - ri) / nr * (b - a) / nz;
    }
    return v;
  }

  /**
   * Kontrola: hotový profil (s přídavkem p) leží v každé vrstvě uvnitř hrubých kusů.
   * Vrací {ok, rezerva (nejmenší vůle mm), pokryti (nejhorší odchylka součtu úhlů od 2π na kružnicích uvnitř stěny)}.
   */
  function kontrolaPridavku(nav, p) {
    const P = nav.P;
    if (p == null) p = cislo(nav.N.pridavek, 3);
    let rezerva = Infinity, pokryti = 0;
    for (const K of nav.krouzky) for (const v of K.vrstvy) {
      const a = Math.max(0, v.z0), b = Math.min(P.H, v.z1);
      if (b < a) continue;
      for (let z = a; z <= b + 1e-9; z += Math.max(0.25, (b - a) / 24)) {
        const ro = P.rOut(z) + p, ri0 = P.rIn(z), ri = ri0 > 0 ? ri0 - p : 0;
        for (const r of [ri, (ri + ro) / 2, ro]) {
          if (r <= 0.01) {                      // osa: jen plná deska
            if (!v.kusy.some((q) => q.typ === 'disk' && q.Rin === 0)) rezerva = Math.min(rezerva, -1);
            continue;
          }
          let suma = 0;
          for (const q of v.kusy) {
            if (q.typ === 'disk') { if (r >= q.Rin - 1e-9 && r <= q.R + 1e-9) { suma += 2 * PI; rezerva = Math.min(rezerva, q.R - r, q.Rin > 0 ? r - q.Rin : Infinity); } continue; }
            const u = uhly(q, r);
            if (u[1] <= u[0]) continue;
            if (q.typ !== 'dyha') suma += u[1] - u[0]; else suma += u[1] - u[0];
            for (let t = 0; t <= 8; t++) {
              const f = u[0] + (u[1] - u[0]) * t / 8, uu = r * Math.cos(f - q.th);
              // u = vzdálenost bodu ve směru osy kusu; musí ležet mezi aIn a aOut (dýha mezi vrcholovými poloměry)
              rezerva = Math.min(rezerva, q.aOut - uu, uu - q.aIn);
            }
          }
          if (K.typ === 'segmenty' || K.typ === 'deska' || K.typ === 'mezivrstva') pokryti = Math.max(pokryti, Math.abs(suma - 2 * PI));
        }
      }
    }
    return { ok: rezerva >= -1e-6 && pokryti < 1e-6, rezerva, pokryti };
  }

  /* ---------------- řezný plán ---------------- */
  /**
   * Položky lišt: segmenty (lichoběžníky), bloky (obdélníky), dýhy; desky zvlášť.
   * Rozteč na liště: s otáčením (Lout + Lin)/2 + prořez, bez otáčení Lout + prořez.
   * Lišty se plní postupně (první volná se stejnou dřevinou, tloušťkou a šířkou ±sloucit), max. délka maxLista.
   */
  function rezPlan(krouzky, S, N) {
    const pr = Math.max(0, cislo(N.prorez, 2.5)), Lmax = Math.max(200, cislo(N.maxLista, 1000)), odp = Math.max(0, cislo(N.odpad, 15));
    const tol = Math.max(0, cislo(N.sloucit, 0)), otac = N.otaceni !== false;
    const polozky = [], desky = [], dyhy = [];
    for (const K of krouzky) for (const v of K.vrstvy) {
      const sk = {};
      for (const q of v.kusy) { const key = q.typ + ':' + q.druh; (sk[key] = sk[key] || { typ: q.typ, druh: q.druh, ks: 0, q }).ks++; }
      for (const g of Object.values(sk)) {
        const m = rozmeryKusu(g.q);
        const zakl = { krouzek: K.cislo, vrstva: v.s, vrstev: K.vrstvy.length, druh: g.druh, ks: g.ks, tl: r2(v.h) };
        if (g.typ === 'seg') {
          const roz = otac ? (m.Lout + m.Lin) / 2 + pr : m.Lout + pr, start = odp + (otac ? (m.Lout - m.Lin) / 2 : 0);
          polozky.push(Object.assign(zakl, { typ: 'seg', W: Math.ceil(m.W * 2) / 2, Lout: m.Lout, Lin: m.Lin, uhel: K.uhelRezu, roztec: roz, start, rozBez: m.Lout + pr }));
        } else if (g.typ === 'blok') {
          polozky.push(Object.assign(zakl, { typ: 'blok', W: Math.ceil(m.W * 2) / 2, Lout: m.Lout, Lin: m.Lin, uhel: 0, roztec: m.Lout + pr, start: odp, rozBez: m.Lout + pr }));
        } else if (g.typ === 'dyha') {
          dyhy.push(Object.assign(zakl, { tl: r2(K.dyhaTl), delka: r1(m.Lspara + 2), sirka: r1(v.h + 1), plocha: g.ks * (m.Lspara + 2) * (v.h + 1) }));
        } else {
          const a = Math.ceil(2 * g.q.R + 4);
          desky.push(Object.assign(zakl, { typ: K.typ, a, R: g.q.R, Rin: g.q.Rin, objem: a * a * v.h }));
        }
      }
    }
    // plnění lišt
    const listy = [];
    const poradi = polozky.slice().sort((a, b) => a.druh - b.druh || b.tl - a.tl || b.W - a.W || a.krouzek - b.krouzek);
    for (const it of poradi) {
      let zbyva = it.ks;
      while (zbyva > 0) {
        const maxKs = Math.max(1, Math.floor((Lmax - it.start) / it.roztec));
        const ks = Math.min(zbyva, maxKs), delka = it.start + ks * it.roztec;
        let L = listy.find((l) => l.druh === it.druh && Math.abs(l.tl - it.tl) < 0.05 && l.W >= it.W && l.W - it.W <= tol + 1e-9 && l.delka + delka <= Lmax + 1e-9);
        if (!L) { L = { id: 'L' + (listy.length + 1), druh: it.druh, tl: it.tl, W: it.W, delka: 0, polozky: [] }; listy.push(L); }
        L.polozky.push({ krouzek: it.krouzek, vrstva: it.vrstva, vrstev: it.vrstev, typ: it.typ, ks, Lout: it.Lout, Lin: it.Lin, uhel: it.uhel, od: L.delka, delka });
        L.delka += delka; zbyva -= ks;
      }
    }
    for (const L of listy) L.delkaZaokr = Math.ceil((L.delka + 5) / 10) * 10;
    // souhrn podle dřevin
    const druhy = {};
    const D = (i) => (druhy[i] = druhy[i] || { druh: i, delkaList: 0, objem: 0, listu: 0, desek: 0, dyhaPlocha: 0, segmentu: 0 });
    for (const L of listy) { const d = D(L.druh); d.delkaList += L.delkaZaokr; d.objem += L.delkaZaokr * L.W * L.tl; d.listu++; d.segmentu += L.polozky.reduce((s, q) => s + q.ks, 0); }
    for (const q of desky) { const d = D(q.druh); d.desek++; d.objem += q.objem; }
    for (const q of dyhy) { const d = D(q.druh); d.dyhaPlocha += q.plocha; d.objem += q.plocha * q.tl; }
    for (const d of Object.values(druhy)) d.hmotnost = d.objem * 1e-9 * S.dreviny[d.druh].hustota;
    const sOtac = polozky.reduce((s, q) => s + q.start + q.ks * q.roztec, 0);
    const bezOtac = polozky.reduce((s, q) => s + odp + q.ks * q.rozBez, 0);
    return { listy, desky, dyhy, polozky, druhy: Object.values(druhy).sort((a, b) => a.druh - b.druh), delkaCelkem: sOtac, delkaBezOtaceni: bezOtac, uspora: bezOtac - sOtac };
  }

  function souhrnNavrhu(krouzky, S, P, plan) {
    const s = { kroužků: krouzky.length, segmentu: 0, spar: 0, hmotnostHruba: 0, hmotnostHotova: 0, objemHruby: 0, objemHotovy: 0 };
    for (const K of krouzky) {
      s.hmotnostHruba += K.hmotnostHruba; s.hmotnostHotova += K.hmotnostHotova; s.objemHruby += K.objemHruby; s.objemHotovy += K.objemHotovy;
      for (const v of K.vrstvy) for (const q of v.kusy) if (q.typ === 'seg' || q.typ === 'blok') { s.segmentu++; if (q.typ === 'seg') s.spar++; }
    }
    s.vyska = P.H; s.prumerMax = 2 * Math.max(...Array.from(P.ro)); s.prumerOkraj = 2 * P.ro[P.Nz]; s.prumerPaty = 2 * P.ro[0];
    s.objemDutiny = objemDutiny(P);
    s.delkaList = plan.listy.reduce((a, l) => a + l.delkaZaokr, 0);
    s.odpad = s.objemHruby > 0 ? 1 - s.objemHotovy / s.objemHruby : 0;
    return s;
  }

  /* ---------------- chyba úhlu ---------------- */
  /**
   * Chyba úhlu δ (°) na každém řezu: segment má dva řezy, kroužek 2n řezů → součet úhlů 360° + 2nδ.
   * Při lepení celého kroužku se chyba sejde v jedné spáře: klín 2nδ, mezera = Lspáry·tan|2nδ|.
   * Po polovinách: každá polovina nese nδ; po srovnání ploch polovin na brusce zmizí.
   * δ > 0 (segmenty „tlusté“) → kroužek dosedne venku a spára zeje uvnitř; δ < 0 → zeje venku.
   */
  function mezeraZChyby(n, delta, Lspara) {
    const celk = 2 * n * delta;
    return {
      soucet: n * 2 * (180 / n + delta), celkem: celk,
      mezeraCely: Lspara * Math.tan(Math.abs(celk) * RAD),
      mezeraPolovina: Lspara * Math.tan(Math.abs(n * delta) * RAD),
      kde: delta > 0 ? 'uvnitř' : delta < 0 ? 'venku' : '–',
    };
  }
  /** nejvyšší přípustná chyba úhlu pro mezeru e (mm) na spáře délky L */
  function tolerance(n, Lspara, e) { return Math.atan(e / Lspara) * DEG / (2 * n); }

  /* ---------------- předvolby ---------------- */
  const K = (o) => o;
  const PREDVOLBY = {
    misa: { nazev: 'Mísa Ø 250', popis: 'Klasická mísa na ovoce, 12 segmentů, cihlová vazba, ozdobný pás.',
      profil: { vnejsi: [{ r: 45, z: 0 }, { r: 72, z: 10 }, { r: 108, z: 38 }, { r: 124, z: 68 }, { r: 126, z: 90 }], stena: 6, dno: 8, rezimVnitrni: 'odsazeni' },
      krouzky: [K({}), K({}), K({ sekv: [1] }), K({ vzor: 'stridani', sekv: [0, 3], h: 19 }), K({ sekv: [1] }), K({})], nast: { tlPrkna: 19, n: 12 } },
    vaza: { nazev: 'Váza 265', popis: 'Štíhlá váza s břichem a hrdlem, 16 segmentů, tenké prkno 16 mm.',
      profil: { vnejsi: [{ r: 38, z: 0 }, { r: 62, z: 40 }, { r: 82, z: 100 }, { r: 70, z: 170 }, { r: 40, z: 225 }, { r: 38, z: 245 }, { r: 47, z: 265 }], stena: 6, dno: 10, rezimVnitrni: 'odsazeni' },
      krouzky: [K({}), K({}), K({}), K({}), K({}), K({ vzor: 'stridani', sekv: [0, 1] }), K({}), K({}), K({}), K({}), K({}), K({}), K({ sekv: [1] })], nast: { tlPrkna: 16, n: 16 } },
    talir: { nazev: 'Mělká mísa Ø 320', popis: 'Široká mělká mísa – kroužky s velkým přesahem, plné dno.',
      profil: { vnejsi: [{ r: 70, z: 0 }, { r: 110, z: 8 }, { r: 148, z: 30 }, { r: 160, z: 58 }], stena: 7, dno: 9, rezimVnitrni: 'odsazeni' },
      krouzky: [K({}), K({ sekv: [1] }), K({}), K({ vzor: 'stridani', sekv: [3, 0] })], nast: { tlPrkna: 16, n: 16 } },
    sachovnice: { nazev: 'Mísa se šachovnicí', popis: 'Ozdobný pás šachovnice ze dvou podvrstev a dýhy ve spárách.',
      profil: { vnejsi: [{ r: 50, z: 0 }, { r: 80, z: 15 }, { r: 115, z: 50 }, { r: 128, z: 85 }, { r: 130, z: 105 }], stena: 6, dno: 8, rezimVnitrni: 'odsazeni' },
      krouzky: [K({}), K({}), K({}), K({ vzor: 'sachovnice', sekv: [0, 4], podvrstvy: 2, h: 20, n: 24 }), K({ sekv: [1], dyhaTl: 1, dyhaDruh: 0 }), K({}), K({})], nast: { tlPrkna: 19, n: 12 } },
    otevrena: { nazev: 'Otevřené segmenty', popis: 'Váza s pásem otevřeného segmentování (bloky s mezerami).',
      profil: { vnejsi: [{ r: 45, z: 0 }, { r: 75, z: 45 }, { r: 92, z: 110 }, { r: 85, z: 175 }, { r: 70, z: 220 }, { r: 74, z: 240 }], stena: 7, dno: 10, rezimVnitrni: 'odsazeni' },
      krouzky: [K({}), K({}), K({}), K({ sekv: [1] }), K({ vzor: 'otevreny', podil: 0.5, sekv: [0], n: 16 }), K({ vzor: 'otevreny', podil: 0.5, sekv: [0], n: 16 }), K({ vzor: 'otevreny', podil: 0.5, sekv: [0], n: 16 }), K({ vzor: 'otevreny', podil: 0.5, sekv: [0], n: 16 }), K({ sekv: [1] }), K({}), K({}), K({}), K({ sekv: [1] })], nast: { tlPrkna: 19, n: 16 } },
    doza: { nazev: 'Dóza (uzavřená forma)', popis: 'Kulovitá uzavřená forma s úzkým otvorem, vlastní vnitřní křivka.',
      profil: { vnejsi: [{ r: 35, z: 0 }, { r: 75, z: 30 }, { r: 95, z: 85 }, { r: 82, z: 140 }, { r: 45, z: 175 }, { r: 36, z: 182 }],
        vnitrni: [{ r: 30, z: 10 }, { r: 68, z: 33 }, { r: 88, z: 85 }, { r: 76, z: 135 }, { r: 40, z: 168 }, { r: 28, z: 182 }], stena: 7, dno: 10, rezimVnitrni: 'vlastni' },
      krouzky: [K({}), K({}), K({}), K({ vzor: 'stridani', sekv: [2, 0] }), K({}), K({}), K({}), K({ sekv: [1] }), K({}), K({}), K({})], nast: { tlPrkna: 19, n: 12 } },
  };
  function vychoziProjekt(klic) {
    const pv = PREDVOLBY[klic || 'misa'] || PREDVOLBY.misa;
    return {
      nazev: '', predvolba: klic || 'misa',
      profil: JSON.parse(JSON.stringify(Object.assign({}, PROFIL, pv.profil))),
      nast: Object.assign({}, NASTAVENI, pv.nast || {}),
      dreviny: vychoziDreviny(),
      krouzky: JSON.parse(JSON.stringify(pv.krouzky || [])),
    };
  }

  /* ---------------- tisk ---------------- */
  function korekceMeritka(namerenoX, namerenoY, nominal) {
    const Nn = nominal || 100, mx = cislo(namerenoX, Nn), my = cislo(namerenoY, Nn);
    const k = (m) => (m > Nn * 0.8 && m < Nn * 1.2 ? Nn / m : 1);
    return { kx: k(mx), ky: k(my) };
  }
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  function rozmerPapiru(n) {
    if (n.papir === 'vlastni') return [Math.max(80, cislo(n.papirW, 210)), Math.max(80, cislo(n.papirH, 297))];
    return PAPIRY[n.papir] || PAPIRY.a4;
  }
  const PATA = 17, PRAVY_PAS = 13;
  /** rozvrh listů pro oblast (mm modelu, y nahoru) na papír pw × ph s přesahem pro lepení */
  function rozvrhListu(obl, pw, ph, nast) {
    const n = Object.assign({}, NASTAVENI, nast || {}), Kk = korekceMeritka(n.kalibX, n.kalibY), ok = cislo(n.okraj, 8);
    const sw = obl.x1 - obl.x0, sh = obl.y1 - obl.y0;
    const varianta = (W, H) => {
      const uw = W - 2 * ok - PRAVY_PAS, uh = H - 2 * ok - PATA, uwM = uw / Kk.kx, uhM = uh / Kk.ky;
      if (sw <= uwM + 1e-6 && sh <= uhM + 1e-6) return { W, H, uw, uh, uwM, uhM, nx: 1, ny: 1, g: 0, jeden: true };
      const g = Math.min(Math.max(cislo(n.prekryv, 15), 10), uwM * 0.4, uhM * 0.4);
      const nx = sw <= uwM + 1e-6 ? 1 : Math.ceil((sw - g) / (uwM - g) - 1e-9), ny = sh <= uhM + 1e-6 ? 1 : Math.ceil((sh - g) / (uhM - g) - 1e-9);
      return { W, H, uw, uh, uwM, uhM, nx, ny, g, jeden: false };
    };
    const a = varianta(pw, ph), b = varianta(ph, pw), v = b.nx * b.ny < a.nx * a.ny ? b : a;
    const cw = v.nx === 1 ? v.uwM : v.nx * (v.uwM - v.g) + v.g, chh = v.ny === 1 ? v.uhM : v.ny * (v.uhM - v.g) + v.g;
    const ox = obl.x0 - (cw - sw) / 2, top = obl.y1 + (chh - sh) / 2, listy = [];
    for (let r = 0; r < v.ny; r++) for (let c = 0; c < v.nx; c++) {
      const x0 = ox + c * (v.uwM - v.g), y1 = top - r * (v.uhM - v.g);
      listy.push({ x0, x1: x0 + v.uwM, y0: y1 - v.uhM, y1, r, c });
    }
    return Object.assign(v, { listy, kx: Kk.kx, ky: Kk.ky, ok });
  }

  const API = {
    DREVINY, NASTAVENI, PROFIL, PREDVOLBY, VYCHOZI_KROUZEK, PAPIRY, PATA, PRAVY_PAS,
    cislo, normalizujBody, krivka, vzorkujProfil, objemDutiny, srovnejKrouzky, normalizujKrouzek, normalizujProjekt, vychoziDreviny,
    prusecik, rohy, uhly, plochaKusu, rozmeryKusu, druhSegmentu, navrh, objemKusuHotovy, kontrolaPridavku, rezPlan,
    mezeraZChyby, tolerance, vychoziProjekt, korekceMeritka, rozmerPapiru, rozvrhListu,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SEGJ = API;
})(typeof window !== 'undefined' ? window : globalThis);
