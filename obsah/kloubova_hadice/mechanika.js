/* Kloubová hadice – profi výpočty (bez DOM, spustitelné v node):
   proudeni  – tlaková ztráta a rychlosti (Darcy–Weisbach, Swamee–Jain / laminární, místní ztráty kloubů, patky a ústí),
   drzeni    – momenty od vlastní tíhy (+ kapaliny) v kloubech pro aktuální tvar, nejdelší vodorovné vyložení,
   navrhTvar – nejmenší počet článků a úhly kloubů, aby ústí trysky dosáhlo cíle (souřadnicový sestup v rovině XZ),
   podlozky  – rozdělení dílů na podložky tiskárny (stejné řádkování jako G3D.tiskoveRozlozeni).
   Jednotky: délky mm, tlak Pa, průtok podle média (kapaliny l/min, vzduch m³/h), moment N·mm, hmotnost g. */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const G = uzel ? require('../gen3d/zaklad.js') : window.G3D;
  const g = 9.81, rad = s => s * Math.PI / 180, deg = r => r * 180 / Math.PI;

  /** Hustota (kg/m³) a kinematická viskozita (m²/s) při ~20 °C (olej VG 32 při 40 °C). */
  const MEDIA = {
    voda: { rho: 998, nu: 1.0e-6, plyn: false },
    emulze: { rho: 1000, nu: 1.3e-6, plyn: false },
    olej: { rho: 860, nu: 32e-6, plyn: false },
    vzduch: { rho: 1.2, nu: 15e-6, plyn: true },
  };
  /** Doporučená dopravní rychlost vzduchu při odsávání (m/s): prach a jemné třísky. */
  const ODSAVANI = [18, 25];

  /** Součinitel tření: laminární 64/Re, turbulentní Swamee–Jain (drsnost e a průměr D v metrech). */
  function treni(Re, e, D) {
    if (Re <= 0) return 0;
    if (Re < 2300) return 64 / Re;
    const f = 0.25 / Math.pow(Math.log10(e / (3.7 * D) + 5.74 / Math.pow(Re, 0.9)), 2);
    if (Re >= 4000) return f;
    const t = (Re - 2300) / 1700;                 // přechodová oblast – lineárně mezi laminární a turbulentní
    return (1 - t) * 64 / 2300 + t * f;
  }
  /** Účinná plocha ústí trysky (mm²) – štěrbina × 0,9, otvory sprchy × 0,62 (ostré hrany). */
  function plochaUsti(p, o, T) {
    const q = p.tryska;
    if (q.typ === 'kulata') return Math.PI * T.ru * T.ru;
    if (q.typ === 'plocha') return 0.9 * q.sterbina * (q.sirka - 2 * q.stena);
    if (q.typ === 'sprcha') return 0.62 * q.otvoru * Math.PI * q.otvor * q.otvor / 4;
    if (q.typ === 'hubice') return q.sirka * q.vyska;
    return 0;
  }
  /** Průtok zadaný uživatelem → m³/s (celý přívod). */
  const naM3s = (p, Q) => (MEDIA[p.proud.medium].plyn ? Q / 3600 : Q / 60000);
  const zM3s = (p, q) => (MEDIA[p.proud.medium].plyn ? q * 3600 : q * 60000);

  /** Rozbor proudění pro průtok Qu (jednotky média; výchozí z projektu). null = bez průtoku (magnet, zátka, kanál 0). */
  function proudeni(p, o, P, T, uhly, Qu) {
    if (o.rc <= 0 || p.vstup.typ === 'magnet' || p.tryska.typ === 'zatka') return null;
    const md = MEDIA[p.proud.medium], rho = md.rho, nu = md.nu, e = p.proud.drsnost / 1000;
    const vetvi = p.vstup.typ === 'rozbocka' ? p.vstup.vetvi : 1;
    const Qc = naM3s(p, Qu === undefined ? p.proud.prutok : Qu), Q = Qc / vetvi;
    const D = 2 * o.rc / 1000, A = Math.PI * D * D / 4, v = Q / A, Re = v * D / nu, f = treni(Re, e, D);
    const dyn = x => rho * x * x / 2;
    // tření po délce kanálu (patka + články + krček trysky)
    const Lk = (P.zS + p.retez.pocet * o.L + T.z0) / 1000;
    const dpTreni = f * Lk / D * dyn(v);
    // klouby: zúžení do kanálu koule + rozšíření do dutiny jamky, ohyb přidává
    let zKl = 0;
    for (const u of uhly) zKl += 0.8 + 0.5 * Math.pow(u / 45, 2);
    const dpKlouby = zKl * dyn(v);
    // patka: otvor závitu/trnu užší než kanál (Qc teče otvorem celé patky), rozbočka dělí proud
    let dpPatka = 0;
    const rb = P.rb > 0 ? P.rb : o.rc;
    if (rb < o.rc - 1e-6 || vetvi > 1) {
      const Ab = Math.PI * Math.pow(2 * rb / 1000, 2) / 4, vb = Qc / Ab, pomer = Ab / A;
      dpPatka = (0.5 * Math.max(0, 1 - pomer) + Math.pow(Math.max(0, 1 - pomer), 2)) * dyn(vb) + (vetvi > 1 ? 1.0 * dyn(v) : 0);
    }
    // ústí: zúžení trysky (0,1) + kinetická energie výtoku
    const Au = plochaUsti(p, o, T) / 1e6, vu = Au > 0 ? Q / Au : 0;
    const dpUsti = Au > 0 ? 1.1 * dyn(vu) : 0;
    const dp = dpTreni + dpKlouby + dpPatka + dpUsti;
    return {
      medium: p.proud.medium, plyn: md.plyn, vetvi, Q, Qc, D, v, Re, f, rezim: Re < 2300 ? 'laminární' : Re < 4000 ? 'přechodové' : 'turbulentní',
      vu, Au, dp, casti: { treni: dpTreni, klouby: dpKlouby, patka: dpPatka, usti: dpUsti },
      vykon: dp * Qc,                                          // hydraulický výkon (W)
      // odsávání = vzduch se sací hubicí nebo kulatým ústím širším než kanál; jinak ofuk (přetlak, dopravní rychlost nehraje roli)
      odsavani: md.plyn && (p.tryska.typ === 'hubice' || (p.tryska.typ === 'kulata' && T.ru > o.rc)),
      doporuceno: md.plyn && (p.tryska.typ === 'hubice' || (p.tryska.typ === 'kulata' && T.ru > o.rc)) ? ODSAVANI.map(x => zM3s(p, x * A * vetvi)) : null,
    };
  }
  /** Křivka ztráty Δp(Q) pro graf: n bodů od 0 do Qmax (jednotky média). */
  function krivkaProudeni(p, o, P, T, uhly, Qmax, n = 24) {
    const out = [];
    for (let i = 0; i <= n; i++) { const Q = Qmax * i / n, r = proudeni(p, o, P, T, uhly, Q); if (r) out.push({ Q, dp: r.dp, vu: r.vu }); }
    return out;
  }

  /** Hmotnosti a těžiště dílů (g, mm v místním rámci dílu) – plast + kapalina v kanálu (je-li naplněná kapalinou). */
  function hmoty(p, o, model, hustota) {
    const md = MEDIA[p.proud.medium], kap = p.mech.naplnena && !md.plyn && o.rc > 0 && p.vstup.typ !== 'magnet';
    const mKap = kap ? Math.PI * o.rc * o.rc * o.L * md.rho / 1e6 : 0;          // g na článek (mm³ × kg/m³ / 1e6)
    const cl = { m: model.clanek.objem * hustota / 1000, tez: model.clanek.tez };
    const kapT = kap ? Math.PI * o.rc * o.rc * Math.max(0, model.T.z0) * md.rho / 1e6 : 0;
    const tr = { m: model.tryska.objem * hustota / 1000, tez: model.tryska.tez };
    // spojené těžiště dílu s kapalinou (kapalina v ose, těžiště v půlce délky kanálu)
    const spoj = (d, mk, zk) => ({ m: d.m + mk, tez: d.m + mk > 0 ? [d.tez[0] * d.m / (d.m + mk), d.tez[1] * d.m / (d.m + mk), (d.tez[2] * d.m + zk * mk) / (d.m + mk)] : d.tez });
    return { clanek: spoj(cl, mKap, o.L / 2), tryska: spoj(tr, kapT, model.T.z0 / 2), kapalina: kap };
  }
  /** Moment (N·mm) v každém kloubu větve pro aktuální tvar (tíha ve směru −Z), přetížené klouby a nejdelší vodorovné vyložení. */
  function drzeni(p, o, model, hustota) {
    const H = hmoty(p, o, model, hustota), ramy = model.ramy[0], n = p.retez.pocet;
    const tezSvet = (ram, t) => [ram.P[0] + ram.R[0] * t[0] + ram.R[3] * t[1] + ram.R[6] * t[2], ram.P[1] + ram.R[1] * t[0] + ram.R[4] * t[1] + ram.R[7] * t[2]];
    const casti = ramy.map((r, k) => { const d = k < n ? H.clanek : H.tryska; return { m: d.m, c: tezSvet(r, d.tez) }; });
    const momenty = ramy.map((J, j) => {
      let mx = 0, my = 0;
      for (let k = j; k < casti.length; k++) { mx += casti[k].m * (casti[k].c[0] - J.P[0]); my += casti[k].m * (casti[k].c[1] - J.P[1]); }
      return Math.hypot(mx, my) / 1000 * g;                     // g·mm → N·mm
    });
    const Mk = p.mech.moment;
    const pretizene = Mk > 0 ? momenty.map((M, j) => (M > Mk ? j : -1)).filter(j => j >= 0) : [];
    // vodorovně natažená větev: kolik článků (+ tryska) udrží kloub u patky
    const Mvod = k => g / 1000 * (Array.from({ length: k }, (_, i) => H.clanek.m * (i * o.L + H.clanek.tez[2])).reduce((a, b) => a + b, 0) + H.tryska.m * (k * o.L + H.tryska.tez[2]));
    let vylozeni = null;
    if (Mk > 0) { vylozeni = -1; for (let k = 0; k <= 200; k++) { if (Mvod(k) <= Mk) vylozeni = k; else break; } }
    const hmotnost = H.clanek.m * n + H.tryska.m;
    let jmax = 0; momenty.forEach((M, j) => { if (M > momenty[jmax]) jmax = j; });
    return { momenty, jmax, max: momenty[jmax], pretizene, vylozeni, Mvod, mClanek: H.clanek.m, mTryska: H.tryska.m, hmotnost, kapalina: H.kapalina };
  }

  /** Dopředná kinematika v rovině: úhly kloubů (rad) → ústí trysky [x, z] a směr posledního dílu (rad od svislice). */
  function konec(th, L, zTip, J0) {
    let x = J0[0], z = J0[1], fi = 0;
    for (let k = 0; k < th.length; k++) {
      fi += th[k];
      const d = k < th.length - 1 ? L : zTip;
      x += d * Math.sin(fi); z += d * Math.cos(fi);
    }
    return { x, z, fi };
  }
  /** Návrh tvaru: nejmenší počet článků a úhly, aby ústí trysky dosáhlo cíle (cil.x vodorovně od osy, cil.z nad spodkem patky),
      volitelně i se směrem trysky (cil.smer ° od svislice, kladně ke straně cíle). Rovinný (natočení 0).
      CCD (natáčení kloubů od konce k ústí, s mezemi kloubu) ze dvou startů; při srážce článků nebo s patkou doladění
      souřadnicovým sestupem s penalizací. Chyba se počítá z úhlů zaokrouhlených tak, jak se uloží do projektu (0,01°).
      → {pocet, klouby, chyba (mm), chybaSmeru (°), dosazeno, srazka, duvod: '' | 'daleko' | 'srazka' | 'smer' | 'blizko'} */
  function navrhTvar(p, o, P, T, cil, volby = {}) {
    const max = rad(o.ohybMax), L = o.L, zTip = (T.zVrch !== undefined ? T.zVrch : T.zE);
    const znam = cil.x < 0 ? -1 : 1, cx = Math.abs(cil.x), cz = cil.z, J0 = [0, P.zS];
    const hlid = !!cil.hlidatSmer, smer = rad(cil.smer), w = hlid ? 40 * 40 : 0;     // 1 rad směru ≈ 40 mm polohy
    const cilKoule = [cx - zTip * Math.sin(smer), cz - zTip * Math.cos(smer)];      // kde má být střed koule trysky
    const d2 = (2 * o.Ro * 0.95) ** 2, rPat = Math.max(P.Re || 0, P.R || 0, P.Rkol || 0, o.Ro) + o.Ro, zPat = P.zS;
    const vPatce = (x, z) => (z < zPat && Math.abs(x) < rPat ? (zPat - z) * (rPat - Math.abs(x)) : 0);
    const omez = t => Math.max(-max, Math.min(max, t));
    /** Polohy kloubů J[0..n] a ústí J[n+1]. */
    const polohy = th => {
      const J = [J0.slice()];
      let x = J0[0], z = J0[1], fi = 0;
      for (let k = 0; k < th.length; k++) { fi += th[k]; const dl = k < th.length - 1 ? L : zTip; x += dl * Math.sin(fi); z += dl * Math.cos(fi); J.push([x, z]); }
      return { J, fi };
    };
    /** Srážka: kloub (i ústí) v nesousedním článku nebo v patce. */
    const srazka = th => {
      const { J } = polohy(th);
      let pen = 0;
      for (let k = 2; k < J.length; k++) {
        const kon = k === J.length - 1, dd = kon ? (o.Ro * 1.1) ** 2 : d2;
        for (let i = 0; i < k - (kon ? 2 : 1); i++) { const q = (J[i][0] - J[k][0]) ** 2 + (J[i][1] - J[k][1]) ** 2; if (q < dd) pen += dd - q; }
        pen += vPatce(J[k][0], J[k][1]);
      }
      return pen;
    };
    const cena = th => {
      const { J, fi } = polohy(th), e = J[J.length - 1];
      let hl = 0; for (let k = 1; k < th.length; k++) hl += (th[k] - th[k - 1]) ** 2;
      return (e[0] - cx) ** 2 + (e[1] - cz) ** 2 + w * (fi - smer) ** 2 + 10 * srazka(th) + 4 * hl;
    };
    /** CCD: kloub k se natočí o úhel, který nejlépe přiblíží ústí (a střed koule trysky) k cílům. */
    const ccd = (th, kol) => {
      const n = th.length - 1;
      let stara = Infinity;
      for (let it = 0; it < kol; it++) {
        for (let k = n; k >= 0; k--) {
          const { J } = polohy(th), c = J[k];
          const pary = [[J[n + 1], [cx, cz]]];
          if (hlid) pary.push([J[n], cilKoule]);
          let kr = 0, sk = 0;
          for (const [a, b] of pary) {
            const ax = a[0] - c[0], az = a[1] - c[1], bx = b[0] - c[0], bz = b[1] - c[1];
            kr += az * bx - ax * bz; sk += ax * bx + az * bz;
          }
          th[k] = omez(th[k] + Math.atan2(kr, sk));
        }
        const { J } = polohy(th), e = J[n + 1];
        const err = Math.hypot(e[0] - cx, e[1] - cz) + (hlid ? Math.hypot(J[n][0] - cilKoule[0], J[n][1] - cilKoule[1]) : 0);
        if (err < 0.03) break;
        if (it % 40 === 39) { if (stara - err < 0.02) break; stara = err; }   // uvázlo – další kola nepomohou
      }
      return th;
    };
    /** Doladění se srážkami: souřadnicový sestup zlatým řezem. */
    const dolad = (th, kol) => {
      const r = (Math.sqrt(5) - 1) / 2;
      for (let kolo = 0; kolo < kol; kolo++) {
        for (let k = th.length - 1; k >= 0; k--) {
          let a = -max, b = max, x1 = b - r * (b - a), x2 = a + r * (b - a);
          th[k] = x1; let f1 = cena(th); th[k] = x2; let f2 = cena(th);
          for (let i = 0; i < 24; i++) {
            if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - r * (b - a); th[k] = x1; f1 = cena(th); }
            else { a = x1; x1 = x2; f1 = f2; x2 = a + r * (b - a); th[k] = x2; f2 = cena(th); }
          }
          th[k] = f1 < f2 ? x1 : x2;
        }
      }
      return th;
    };
    const vyhodnot = (th0, n) => {
      const th = th0.map(t => rad(Math.round(deg(t) * 100) / 100));     // jak se uloží do projektu
      const { J, fi } = polohy(th), e = J[n + 1];
      const chyba = Math.hypot(e[0] - cx, e[1] - cz), chybaSmeru = deg(Math.abs(fi - smer)), sr = srazka(th) > 1e-3;
      return { pocet: n, klouby: th.map(t => [Math.round(deg(t) * znam * 100) / 100, 0]), chyba, chybaSmeru, srazka: sr,
        dosazeno: chyba < 1.5 && (!hlid || chybaSmeru < 2) && !sr };
    };
    const lepsi = (a, b) => !b || (a.dosazeno && !b.dosazeno) || (a.dosazeno === b.dosazeno && (a.srazka === b.srazka ? a.chyba + 5 * a.chybaSmeru * hlid < b.chyba + 5 * b.chybaSmeru * hlid : !a.srazka));
    const vzd = Math.hypot(cx - J0[0], cz - J0[1]), nHor = volby.nMax || 60;
    const nMin = Math.max(1, Math.min(nHor, Math.ceil((vzd - zTip) / L) - 1));
    let nejlepsi = null;
    const zkus = n => {
      let nej = null;
      const a0 = Math.atan2(cx - J0[0], cz - J0[1]);
      const starty = [new Array(n + 1).fill(omez(a0 / (n + 1))), new Array(n + 1).fill(0).map((_, k) => omez(k === 0 ? a0 : 0)),
        new Array(n + 1).fill(0).map((_, k) => (k % 2 ? 0.4 : -0.4) * max)];   // cik-cak rozbije souměrnost (cíl přímo nad patkou)
      for (const st of starty) {
        let th = ccd(st.slice(), 300 + 30 * n);
        let kand = vyhodnot(th, n);
        if (kand.srazka && n <= 40 && kand.chyba < 5) { th = dolad(th, 12); th = ccd(th, 50); const k2 = vyhodnot(th, n); if (lepsi(k2, kand)) kand = k2; }
        if (lepsi(kand, nej)) nej = kand;
        if (kand.dosazeno) break;
      }
      if (lepsi(nej, nejlepsi) || (nej.dosazeno && nejlepsi.dosazeno && nej.pocet < nejlepsi.pocet)) nejlepsi = nej;
      return nej.dosazeno;
    };
    // nejmenší počet: postupně od dolního odhadu (CCD se při uváznutí zastaví, takže je to rychlé)
    for (let n = nMin; n <= nHor; n++) if (zkus(n)) break;
    if (!nejlepsi.dosazeno) nejlepsi.duvod = vzd > nHor * L + zTip ? 'daleko' : nejlepsi.srazka ? 'srazka' : hlid && nejlepsi.chyba < 1.5 ? 'smer' : 'blizko';
    else nejlepsi.duvod = '';
    return nejlepsi;
  }

  /** Rozdělí díly (v tiskové poloze, z ≥ 0) na podložky W × H: stejné řádkování jako G3D.tiskoveRozlozeni.
      → [[díly první podložky…], …] (díly už rozmístěné a vystředěné na své podložce). */
  function podlozky(dily, W, H, mezera = 5) {
    const skupiny = [[]];
    let x = 0, y = 0, radek = 0;
    for (const d of dily) {
      const b = G.obal(d.poz), sx = b[3] - b[0], sy = b[4] - b[1];
      if (x > 0 && x + sx > W) { x = 0; y += radek + mezera; radek = 0; }
      if (y > 0 && y + sy > H) { skupiny.push([]); x = 0; y = 0; radek = 0; }
      skupiny[skupiny.length - 1].push(d);
      x += sx + mezera; radek = Math.max(radek, sy);
    }
    return skupiny.map(s => G.tiskoveRozlozeni(s, 1, mezera, W));
  }

  const API = { MEDIA, ODSAVANI, treni, plochaUsti, proudeni, krivkaProudeni, hmoty, drzeni, konec, navrhTvar, podlozky };
  if (uzel) module.exports = API; else window.KHAD_MECH = API;
})();
