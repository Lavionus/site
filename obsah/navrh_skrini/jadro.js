/* ============================================================
   Návrh skříní a korpusů – jádro (bez DOM, čisté funkce)
   Souřadnice korpusu v mm: x doprava (0 = levá vnější plocha), y nahoru (0 = podlaha / spodek korpusu),
   z dopředu (0 = zadní plocha u zdi, hloubka D = přední hrana korpusu; čela na doraz leží v z ∈ ⟨D, D + tl⟩).
   Sestava (linka): dolní řada od x = 0 vedle sebe, horní řada zavěšená ve výšce linka.horniSpodek.
   Každý dílec = osově zarovnaný kvádr (box) + osa tloušťky + osa vláken; díry = vstupní bod + směr (osa se znaménkem).
   Export: window.NS i module.exports.
   ============================================================ */
(function (koren) {
  'use strict';
  const OSY = ['x', 'y', 'z'];
  const IX = { x: 0, y: 1, z: 2 };
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const kopie = (o) => JSON.parse(JSON.stringify(o));
  const cislo = (v, d) => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : +v; return isFinite(n) ? n : d; };

  /* ---------------- materiály a dekory ---------------- */
  const MATERIALY = {
    DTD: { nazev: 'DTD laminovaná (dřevotříska)', kratce: 'DTD', deska: [2800, 2070], tl: [10, 12, 16, 18, 22, 25, 28, 36, 38] },
    MDF: { nazev: 'MDF (lakovaná / fóliovaná)', kratce: 'MDF', deska: [2800, 2070], tl: [6, 8, 10, 12, 16, 18, 19, 22, 25] },
    preklizka: { nazev: 'Překližka (bříza)', kratce: 'Překližka', deska: [2500, 1250], tl: [4, 6, 9, 12, 15, 18, 21, 24], vlakna: true },
    masiv: { nazev: 'Spárovka – masiv', kratce: 'Spárovka', deska: [2400, 600], tl: [18, 20, 26, 27, 30, 40], vlakna: true },
    HDF: { nazev: 'HDF / sololit', kratce: 'HDF', deska: [2800, 2070], tl: [3, 4, 5, 6, 8] },
    pracovni: { nazev: 'Pracovní deska (postforming)', kratce: 'Prac. deska', deska: [4100, 600], tl: [28, 38, 40] },
  };
  const DEKORY = {
    bila: { nazev: 'bílá', barva: '#f1f0eb' },
    seda: { nazev: 'světle šedá', barva: '#c4c6c8' },
    antracit: { nazev: 'antracit', barva: '#4a4d52' },
    cerna: { nazev: 'černá', barva: '#2a2a2c' },
    dub: { nazev: 'dub (dekor)', barva: '#c9a26b', vlakna: true },
    orech: { nazev: 'ořech (dekor)', barva: '#7d5537', vlakna: true },
    buk: { nazev: 'buk (dekor)', barva: '#dbb488', vlakna: true },
    briza: { nazev: 'bříza / přírodní', barva: '#e4d1aa', vlakna: true },
    surova: { nazev: 'surová (nelakovaná)', barva: '#d7c9a6' },
  };
  const maVlakna = (m) => !!((MATERIALY[m.druh] || {}).vlakna || (DEKORY[m.dekor] || {}).vlakna) && m.druh !== 'HDF';
  const popisMaterialu = (m) => `${(MATERIALY[m.druh] || { kratce: m.druh }).kratce} ${String(m.tl).replace('.', ',')} mm ${(DEKORY[m.dekor] || { nazev: m.dekor }).nazev}`;
  const klicMaterialu = (m) => `${m.druh}|${m.tl}|${m.dekor}`;

  const NAZEV_STRANY = { '+x': 'pravá', '-x': 'levá', '+y': 'horní', '-y': 'spodní', '+z': 'přední', '-z': 'zadní' };

  /* ---------------- výchozí nastavení (typické hodnoty, vše editovatelné) ---------------- */
  function vychoziNastaveni() {
    return {
      korpusMat: { druh: 'DTD', dekor: 'bila', tl: 18 },
      celaMat: { druh: 'DTD', dekor: 'dub', tl: 18 },
      zadaMat: { druh: 'HDF', dekor: 'bila', tl: 3 },
      zasMat: { druh: 'DTD', dekor: 'bila', tl: 16 },
      dnoZasMat: { druh: 'HDF', dekor: 'bila', tl: 3 },
      pracMat: { druh: 'pracovni', dekor: 'dub', tl: 38 },
      cela: { montaz: 'doraz', spara: 3, uchytka: 128, odHranyUchytky: 40, vlaknaZasuvek: 'vodorovne' },
      zavesy: { miska: 35, hlMisky: 13, odHrany: 22, odKraje: 100, prahy: [900, 1600, 2000, 2400], doRastru: true, podlozka: 5, hlPodlozky: 12 },
      zasuvky: { vysuv: 'kulickovy', vule: 12.5, mezeraDole: 10, mezeraNahore: 22, rezervaVzadu: 10, dno: 'drazka', drazkaOd: 10, hlDrazky: 8, delky: [250, 300, 350, 400, 450, 500, 550, 600], osaVysuvu: 25, diraVysuvu: 2.5, hlDiryVysuvu: 10 },
      s32: { odCela: 37, krok: 32, d: 5, hl: 12, odZad: 37, prvni: 32, okraj: 50 },
      spoje: { odKraje: 50, roztec: 250, konfirmat: { delka: 50, dLicni: 7, dCep: 5 }, kolik: { d: 8, delka: 35, hlLicni: 12 }, excentr: { d: 15, hl: 13, odHrany: 34, dSvornik: 5, hlSvornik: 11, dCep: 8 } },
      police: { vule: 1, odsazeni: 2, nadOsou: 3, maxRozpeti: 800 },
      zada: { drazkaHl: 8, odsazeni: 16, vule: 1 },
      hrany: { cela: 2, korpus: 1, skryte: 0, odecist: true },
      traverza: 100,
      nozicky: { lista: true },
      linka: { deska: true, presahPredni: 20, presahL: 0, presahP: 0, horniSpodek: 1450, horniOdsazeni: 0 },
      rezani: { prorez: 4, okraj: 10, formaty: {} },
    };
  }
  const VYSUVY = {
    kulickovy: { nazev: 'kuličkový (boční)', vule: 12.5 },
    rolnickovy: { nazev: 'rolničkový (boční, spodní)', vule: 12.5 },
    skryty: { nazev: 'skrytý / podvěšený (plnovýsuv)', vule: 5 },
  };

  function novySloupec(o) { return Object.assign({ sirka: 0, zasuvky: 0, vyskaZas: 0, pomeryZas: '', police: 1, typPolic: 'stavitelne', dvirka: 'L' }, o || {}); }
  function novyKorpus(o) {
    const k = Object.assign({
      nazev: 'Skříňka', rada: 'dolni', sirka: 600, vyska: 870, hloubka: 560, mezeraPred: 0,
      dno: 'mezi', strop: 'traverzy', sokl: { typ: 'nozicky', vyska: 150, odsazeni: 50 }, zada: 'drazka', spoj: 'konfirmat', podDeskou: true,
      sloupce: [novySloupec()],
    }, o || {});
    k.sloupce = (k.sloupce || [novySloupec()]).map(novySloupec);
    k.sokl = Object.assign({ typ: 'nozicky', vyska: 150, odsazeni: 50 }, k.sokl || {});
    return k;
  }

  /* ---------------- předvolby typických projektů ---------------- */
  const PREDVOLBY = {
    linka: {
      nazev: 'Kuchyňská linka 2,4 m', popis: 'Čtyři dolní skříňky na nožičkách s pracovní deskou a čtyři horní skříňky (dvířka dub, korpus bílý).',
      nast: { celaMat: { druh: 'DTD', dekor: 'dub', tl: 18 } },
      korpusy: [
        { nazev: 'Zásuvková 60', sirka: 600, sloupce: [{ zasuvky: 3, police: 0, dvirka: 'zadne', pomeryZas: '1:1:1' }] },
        { nazev: 'Dřezová 60', sirka: 600, sloupce: [{ police: 0, dvirka: 'dvoje' }] },
        { nazev: 'Skříňka 40', sirka: 400, sloupce: [{ zasuvky: 1, vyskaZas: 140, police: 1, dvirka: 'P' }] },
        { nazev: 'Skříňka 80', sirka: 800, sloupce: [{ police: 1, dvirka: 'dvoje' }] },
        { nazev: 'Horní 60', rada: 'horni', sirka: 600, vyska: 720, hloubka: 320, strop: 'mezi', podDeskou: false, sloupce: [{ police: 2, dvirka: 'L' }] },
        { nazev: 'Horní 60 – digestoř', rada: 'horni', sirka: 600, vyska: 720, hloubka: 320, strop: 'mezi', podDeskou: false, sloupce: [{ police: 1, dvirka: 'dvoje' }] },
        { nazev: 'Horní 40', rada: 'horni', sirka: 400, vyska: 720, hloubka: 320, strop: 'mezi', podDeskou: false, sloupce: [{ police: 2, dvirka: 'P' }] },
        { nazev: 'Horní 80', rada: 'horni', sirka: 800, vyska: 720, hloubka: 320, strop: 'mezi', podDeskou: false, sloupce: [{ police: 2, dvirka: 'dvoje' }] },
      ],
    },
    skrinka: {
      nazev: 'Skříňka s policemi', popis: 'Samostatná skříňka 800 × 900 × 400 s jednou zásuvkou a dvoukřídlými dvířky.',
      nast: { celaMat: { druh: 'DTD', dekor: 'bila', tl: 18 }, linka: { deska: false } },
      korpusy: [{ nazev: 'Skříňka', sirka: 800, vyska: 900, hloubka: 400, strop: 'nad', sokl: { typ: 'boky', vyska: 80, odsazeni: 30 }, podDeskou: false,
        sloupce: [{ zasuvky: 1, vyskaZas: 150, police: 1, dvirka: 'dvoje' }] }],
    },
    komoda: {
      nazev: 'Komoda se zásuvkami', popis: 'Komoda 1000 × 850 × 450, dva sloupce po čtyřech zásuvkách, dekor dub.',
      nast: { korpusMat: { druh: 'DTD', dekor: 'dub', tl: 18 }, celaMat: { druh: 'DTD', dekor: 'dub', tl: 18 }, linka: { deska: false } },
      korpusy: [{ nazev: 'Komoda', sirka: 1000, vyska: 850, hloubka: 450, strop: 'nad', sokl: { typ: 'boky', vyska: 60, odsazeni: 30 }, podDeskou: false, spoj: 'excentr',
        sloupce: [{ zasuvky: 4, police: 0, dvirka: 'zadne', pomeryZas: '1.5:1.3:1:1' }, { zasuvky: 4, police: 0, dvirka: 'zadne', pomeryZas: '1.5:1.3:1:1' }] }],
    },
    satna: {
      nazev: 'Šatní skříň 100', popis: 'Šatní skříň 1000 × 2200 × 600 se střední příčkou, dvoje dvířka (4 závěsy), stavitelné police, záda v drážce.',
      nast: { celaMat: { druh: 'DTD', dekor: 'bila', tl: 18 }, linka: { deska: false } },
      korpusy: [{ nazev: 'Šatní skříň', sirka: 1000, vyska: 2200, hloubka: 600, strop: 'mezi', sokl: { typ: 'boky', vyska: 80, odsazeni: 40 }, podDeskou: false,
        sloupce: [{ police: 4, dvirka: 'L' }, { police: 4, dvirka: 'P' }] }],
    },
    knihovna: {
      nazev: 'Knihovna (otevřená)', popis: 'Regál 800 × 2000 × 300 bez dvířek, pevné police na konfirmáty, záda přibitá.',
      nast: { korpusMat: { druh: 'DTD', dekor: 'orech', tl: 18 }, linka: { deska: false } },
      korpusy: [{ nazev: 'Knihovna', sirka: 800, vyska: 2000, hloubka: 300, strop: 'nad', dno: 'mezi', zada: 'pribita', sokl: { typ: 'boky', vyska: 60, odsazeni: 20 }, podDeskou: false,
        sloupce: [{ police: 5, typPolic: 'pevne', dvirka: 'zadne' }] }],
    },
    nocni: {
      nazev: 'Noční stolek', popis: 'Stolek 450 × 550 × 400 z překližky, dvě zásuvky a otevřená přihrádka.',
      nast: { korpusMat: { druh: 'preklizka', dekor: 'briza', tl: 18 }, celaMat: { druh: 'preklizka', dekor: 'briza', tl: 18 }, linka: { deska: false } },
      korpusy: [{ nazev: 'Noční stolek', sirka: 450, vyska: 550, hloubka: 400, strop: 'nad', dno: 'pod', sokl: { typ: 'nozicky', vyska: 100, odsazeni: 40 }, podDeskou: false, spoj: 'kolik',
        sloupce: [{ zasuvky: 2, vyskaZas: 260, police: 0, dvirka: 'zadne' }] }],
    },
    spiz: {
      nazev: 'Vysoká skříň (spíž)', popis: 'Spíž 600 × 2100 × 560 s jednokřídlými dvířky (5 závěsů) a pěti stavitelnými policemi.',
      nast: { linka: { deska: false } },
      korpusy: [{ nazev: 'Spíž', sirka: 600, vyska: 2100, hloubka: 560, strop: 'mezi', sokl: { typ: 'nozicky', vyska: 100, odsazeni: 50 }, podDeskou: false,
        sloupce: [{ police: 5, dvirka: 'L' }] }],
    },
  };
  function sloucitHluboce(cil, zdroj) {
    for (const k of Object.keys(zdroj || {})) {
      const v = zdroj[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && cil[k] && typeof cil[k] === 'object' && !Array.isArray(cil[k])) sloucitHluboce(cil[k], v);
      else cil[k] = kopie(v);
    }
    return cil;
  }
  function projektZPredvolby(id) {
    const p = PREDVOLBY[id] || PREDVOLBY.linka;
    return { nazev: p.nazev, predvolba: id, N: sloucitHluboce(vychoziNastaveni(), p.nast || {}), korpusy: p.korpusy.map((k) => novyKorpus(kopie(k))) };
  }
  const vychoziProjekt = () => projektZPredvolby('linka');
  /** doplní chybějící klíče (starší uložené projekty) */
  function normalizuj(P) {
    const Q = { nazev: P && P.nazev || '', predvolba: P && P.predvolba || '', N: sloucitHluboce(vychoziNastaveni(), (P && P.N) || {}), korpusy: [] };
    for (const k of (P && P.korpusy) || []) Q.korpusy.push(novyKorpus(kopie(k)));
    if (!Q.korpusy.length) Q.korpusy.push(novyKorpus());
    return Q;
  }

  /* ---------------- pomocné výpočty ---------------- */
  /** počet závěsů podle výšky dvířek (u výklopných podle šířky): 2 + počet překročených prahů */
  function pocetZavesu(vyska, prahy) {
    const p = (prahy || [900, 1600, 2000, 2400]).slice().sort((a, b) => a - b);
    let n = 2;
    for (const q of p) if (vyska > q) n++;
    return n;
  }
  /** polohy závěsů od spodní hrany dvířek */
  function polohyZavesu(vyska, n, odKraje) {
    const a = Math.min(odKraje, vyska / 4);
    if (n <= 1) return [vyska / 2];
    const out = [];
    for (let i = 0; i < n; i++) out.push(a + (vyska - 2 * a) * i / (n - 1));
    return out;
  }
  /** polohy spojů podél spáry délky L od l0 */
  function polohySpoju(l0, l1, odKraje, roztec) {
    const L = l1 - l0;
    if (L <= 0) return [];
    if (L < 120) return [l0 + L / 2];
    const a = Math.min(odKraje, L / 4), n = Math.max(2, Math.ceil((L - 2 * a) / roztec) + 1), out = [];
    for (let i = 0; i < n; i++) out.push(l0 + a + (L - 2 * a) * i / (n - 1));
    return out;
  }
  function pomery(s, n) {
    let a = String(s || '').split(/[:;\s]+/).map((x) => cislo(x, NaN)).filter((x) => x > 0);
    if (a.length !== n) a = new Array(n).fill(1);
    const sum = a.reduce((x, y) => x + y, 0);
    return a.map((x) => x / sum);
  }
  /** největší standardní délka výsuvu, která se vejde */
  function delkaVysuvu(dostupna, delky) {
    const d = (delky || []).slice().sort((a, b) => b - a).find((x) => x <= dostupna + 1e-6);
    return d || 0;
  }
  const boxRozmer = (b, o) => b[o + '1'] - b[o + '0'];

  /* ============================================================
     Korpus → dílce, díry, čela, zásuvky (v souřadnicích korpusu)
     ============================================================ */
  function korpus(k, N, ki) {
    const t = +N.korpusMat.tl, tz = +N.zadaMat.tl, tf = +N.celaMat.tl, sp = +N.cela.spara;
    const W = +k.sirka, H = +k.vyska, D = +k.hloubka;
    const pre = `K${ki + 1}`;
    const vys = { dilce: [], diry: [], kovani: {}, cela: [], zasuvky: [], otvory: [], varovani: [], sloupce: [] };
    const V = (s) => vys.varovani.push(`${pre} ${k.nazev}: ${s}`);
    const kov = (nazev, ks, pozn) => { if (!ks) return; const x = vys.kovani[nazev] || (vys.kovani[nazev] = { nazev, ks: 0, pozn: pozn || '' }); x.ks += ks; };
    const horni = k.rada === 'horni';
    const sokl = horni ? { typ: 'zadny', vyska: 0, odsazeni: 0 } : k.sokl;
    const sv = sokl.typ === 'zadny' ? 0 : +sokl.vyska;
    const yb = sokl.typ === 'nozicky' ? sv : 0;          // spodek boků
    const yd = sokl.typ === 'zadny' ? 0 : sv;             // spodek dna
    const dno = sokl.typ === 'boky' ? 'mezi' : k.dno;
    const strop = k.strop;
    const zada = k.zada;
    const dnoTop = yd + t;
    const bokY0 = dno === 'pod' ? dnoTop : yb, bokY1 = strop === 'nad' ? H - t : H;
    const yi0 = dnoTop, yi1 = H - t;                     // světlá výška vnitřku
    const zK0 = zada === 'pribita' ? tz : 0;             // začátek boků/dna v hloubce
    const o = +N.zada.odsazeni, hd = +N.zada.drazkaHl, vz = +N.zada.vule;
    const zi0 = zada === 'drazka' ? o + tz : tz;          // přední plocha zad = začátek užitné hloubky
    const inset = N.cela.montaz === 'vlozena';
    const zCelo = inset ? D - tf : D;                     // kam sahají vnitřní díly vpředu
    const viditelnyVrch = !horni && !(k.podDeskou && N.linka.deska);
    const hK = +N.hrany.korpus, hC = +N.hrany.cela, hS = +N.hrany.skryte;
    if (H - yd < 3 * t + 60) V('korpus je příliš nízký.');
    if (D < 3 * t + 40) V('korpus je příliš mělký.');

    /* ---- dílce ---- */
    function pridej(id, nazev, typNazev, skupina, mat, b, osaT, osaVl, hrany, extra) {
      const d = Object.assign({ id: `${pre}-${id}`, korpus: ki, nazev, typNazev, skupina, mat, box: b, osaT, osaVlaken: osaVl, hranyStrany: hrany || {}, drazky: [] }, extra || {});
      const os = OSY.filter((q) => q !== osaT);
      if (maVlakna(mat) && osaVl && osaVl !== osaT) { d.osaD = osaVl; d.smerVlaken = 'delka'; }
      else { d.osaD = boxRozmer(b, os[0]) >= boxRozmer(b, os[1]) ? os[0] : os[1]; d.smerVlaken = 'volny'; }
      d.osaS = os.find((q) => q !== d.osaD);
      for (const q of OSY) if (boxRozmer(b, q) <= 0.01) V(`dílec ${nazev} má nulový nebo záporný rozměr.`);
      vys.dilce.push(d);
      return d;
    }
    const B = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1 });
    const hr = (pole) => { const m = {}; for (const [s, v] of pole) if (v > 0) m[s] = v; return m; };
    const dira = (dil, p, n, d, hl, typ, popis) => vys.diry.push({ dil: dil.id, p, n, d, hl: hl || null, typ, popis });
    const KM = N.korpusMat;

    // boky
    const hrBok = (strana) => hr([['+z', hK], ['+y', strop === 'nad' ? hS : (viditelnyVrch ? hK : hS)], ['-y', horni && dno !== 'pod' ? hK : hS], ['-z', hS]]);
    const bokL = pridej('BL', 'Bok levý', 'Bok', 'korpus', KM, B(0, bokY0, zK0, t, bokY1, D), 'x', 'y', hrBok());
    const bokP = pridej('BP', 'Bok pravý', 'Bok', 'korpus', KM, B(W - t, bokY0, zK0, W, bokY1, D), 'x', 'y', hrBok());
    // dno
    const dnoD = pridej('DN', 'Dno', 'Dno', 'korpus', KM, dno === 'pod' ? B(0, yd, zK0, W, dnoTop, D) : B(t, yd, zK0, W - t, dnoTop, D), 'y', 'x',
      hr([['+z', hK], ['-x', dno === 'pod' ? hK : 0], ['+x', dno === 'pod' ? hK : 0], ['-z', hS]]));
    // strop / traverzy
    let stropy = [];
    const tw = Math.min(+N.traverza, (D - zi0) / 2);
    if (strop === 'traverzy') {
      stropy.push(pridej('TP', 'Traverza přední', 'Traverza', 'korpus', KM, B(t, H - t, D - tw, W - t, H, D), 'y', 'x', hr([['+z', hK]])));
      stropy.push(pridej('TZ', 'Traverza zadní', 'Traverza', 'korpus', KM, B(t, H - t, zi0, W - t, H, zi0 + tw), 'y', 'x', {}));
    } else {
      stropy.push(pridej('ST', 'Strop', 'Strop', 'korpus', KM, strop === 'nad' ? B(0, H - t, zK0, W, H, D) : B(t, H - t, zK0, W - t, H, D), 'y', 'x',
        hr([['+z', hK], ['-x', strop === 'nad' ? hK : 0], ['+x', strop === 'nad' ? hK : 0], ['-z', hS]])));
    }
    // záda
    let zadaD = null;
    if (zada === 'drazka') {
      const y0 = dnoTop - hd + vz, y1 = strop === 'traverzy' ? H - vz : H - t + hd - vz;
      zadaD = pridej('ZA', 'Záda (v drážce)', 'Záda', 'zada', N.zadaMat, B(t - hd + vz, y0, o, W - t + hd - vz, y1, o + tz), 'z', 'y', {});
      const dr = (dil, b) => dil.drazky.push(b);
      dr(bokL, B(t - hd, bokY0, o, t, bokY1, o + tz)); dr(bokP, B(W - t, bokY0, o, W - t + hd, bokY1, o + tz));
      dr(dnoD, B(dnoD.box.x0, dnoTop - hd, o, dnoD.box.x1, dnoTop, o + tz));
      if (strop !== 'traverzy') dr(stropy[0], B(stropy[0].box.x0, H - t, o, stropy[0].box.x1, H - t + hd, o + tz));
      if (o < 8) V('záda v drážce: odsazení od zadní hrany je menší než 8 mm (zbytek boku se může vylomit).');
    } else if (zada === 'pribita') {
      zadaD = pridej('ZA', 'Záda (přibitá)', 'Záda', 'zada', N.zadaMat, B(0, yd, 0, W, H, tz), 'z', 'y', {});
      kov('Sponky / hřebíčky pro záda', Math.ceil(2 * (W + H - yd) / 100), 'po ~100 mm po obvodu, + lepidlo');
    } else {
      zadaD = pridej('ZA', 'Záda (vložená)', 'Záda', 'zada', N.zadaMat, B(t, dnoTop, 0, W - t, strop === 'traverzy' ? H : H - t, tz), 'z', 'y', {});
      kov('Vruty pro vložená záda 3,5 × 16', Math.ceil(2 * (W + H) / 200), 'do lišt / přes boky po ~200 mm');
      if (tz < 8) V('vložená záda tenčí než 8 mm se špatně šroubují – zvolte tlustší materiál zad nebo záda do drážky.');
    }
    // sokl
    if (sokl.typ === 'boky') {
      const z1 = D - +sokl.odsazeni;
      pridej('SO', 'Soklová lišta', 'Sokl', 'sokl', KM, B(t, 0, z1 - t, W - t, yd, z1), 'z', 'x', hr([['-y', hS]]));
    } else if (sokl.typ === 'nozicky') {
      const n = W > 900 ? 6 : 4;
      kov('Nábytkové nožičky (rektifikační)', n, `výška ${sv} mm`);
      if (N.nozicky.lista) {
        const z1 = D - +sokl.odsazeni;
        pridej('SO', 'Sokl (klipovaný)', 'Sokl', 'sokl', N.celaMat, B(0, 0, z1 - tf, W, sv, z1), 'z', 'x', hr([['-y', hS]]));
        kov('Klipy soklu', 2, 'na přední nožičky');
      }
    }
    if (horni) kov('Závěs horní skříňky (pár) + lišta', 1, 'stavitelný, nosnost dle výrobce');

    /* ---- sloupce a příčky ---- */
    const n = Math.max(1, k.sloupce.length);
    const volne = W - 2 * t - (n - 1) * t;
    const pevne = k.sloupce.reduce((s, c) => s + (+c.sirka > 0 ? +c.sirka : 0), 0);
    const auto = k.sloupce.filter((c) => !(+c.sirka > 0)).length;
    let sirky = k.sloupce.map((c) => (+c.sirka > 0 ? +c.sirka : (auto ? (volne - pevne) / auto : 0)));
    if (!auto && Math.abs(pevne - volne) > 0.01) { V(`součet šířek sloupců (${r1(pevne)}) nesedí na světlou šířku ${r1(volne)} mm – poslední sloupec se dorovná.`); sirky[n - 1] += volne - pevne; }
    if (sirky.some((s) => s < 60)) V('některý sloupec je užší než 60 mm.');
    const sloupce = [];
    let x = t;
    for (let i = 0; i < n; i++) {
      const c = { i, cx0: x, cx1: x + sirky[i], def: k.sloupce[i] };
      sloupce.push(c);
      x += sirky[i];
      if (i < n - 1) {
        c.pricka = pridej(`PR${i + 1}`, `Příčka ${i + 1}`, 'Příčka', 'korpus', KM, B(x, dnoTop, zi0, x + t, yi1, D), 'x', 'y', hr([['+z', hK]]));
        x += t;
      }
    }
    for (let i = 0; i < n; i++) {
      const c = sloupce[i];
      c.levy = i === 0 ? bokL : sloupce[i - 1].pricka;
      c.pravy = i === n - 1 ? bokP : c.pricka;
      c.fx0 = i === 0 ? 0 : c.cx0 - t / 2;
      c.fx1 = i === n - 1 ? W : c.cx1 + t / 2;
    }
    const fy0 = yd, fy1 = H;

    /* ---- spoje ---- */
    const S = N.spoje;
    const pt = (m) => [m.x, m.y, m.z];
    let pocKonf = 0, pocKolik = 0, pocExc = 0;
    /**
     * A = lícní díl (skrz něj jde spojovník), Bd = díl spojovaný čelem.
     * osa/c/s: rovina styku osa = c, Bd leží ve směru s (±1). osaB/m/tB: osa tloušťky Bd, střed tloušťky, tloušťka.
     * osaL, l0, l1: podél spáry. cam: strana pouzdra excentru v Bd (±1 po osaB).
     */
    function spoj(typ, A, Bd, osa, c, s, tA, osaB, m, tB, osaL, l0, l1, cam, o2) {
      o2 = o2 || {};
      let pol = o2.polohy || polohySpoju(l0, l1, Math.min(S.odKraje, (l1 - l0) / 3), S.roztec);
      if (o2.posun) pol = pol.map((p) => Math.max(l0 + 15, Math.min(l1 - 15, p + o2.posun)));
      const zn = (q) => (q > 0 ? '+' : '-') + osa;
      pol.forEach((l, i) => {
        const bod = (a, b) => { const M = {}; M[osa] = a; M[osaB] = b; M[osaL] = l; return pt(M); };
        let t2 = typ;
        if (typ === 'excentr' && pol.length > 2 && i > 0 && i < pol.length - 1) t2 = 'kolik';
        if (t2 === 'konfirmat') {
          dira(A, bod(c - s * tA, m), zn(s), S.konfirmat.dLicni, null, 'konfirmat', `konfirmát ${S.konfirmat.delka} – Ø${S.konfirmat.dLicni} skrz + zahloubení`);
          dira(Bd, bod(c, m), zn(s), S.konfirmat.dCep, S.konfirmat.delka - tA + 3, 'konfirmat', `konfirmát – Ø${S.konfirmat.dCep} do čela`);
          pocKonf++;
        } else if (t2 === 'kolik') {
          const hl = Math.min(S.kolik.hlLicni, tA - 5);
          dira(A, bod(c, m), zn(-s), S.kolik.d, hl, 'kolik', `kolík Ø${S.kolik.d}×${S.kolik.delka}`);
          dira(Bd, bod(c, m), zn(s), S.kolik.d, S.kolik.delka - hl + 2, 'kolik', `kolík Ø${S.kolik.d}×${S.kolik.delka} – do čela`);
          pocKolik++;
        } else if (t2 === 'excentr') {
          const E = S.excentr, Mc = {}; Mc[osa] = c + s * E.odHrany; Mc[osaB] = m + cam * tB / 2; Mc[osaL] = l;
          dira(Bd, pt(Mc), (cam > 0 ? '-' : '+') + osaB, E.d, Math.min(E.hl, tB - 3), 'excentr', `excentr Ø${E.d} – pouzdro`);
          dira(Bd, bod(c, m), zn(s), E.dCep, E.odHrany, 'excentr', `excentr – Ø${E.dCep} pro svorník`);
          dira(A, bod(c, m), zn(-s), E.dSvornik, E.hlSvornik, 'excentr', `svorník – Ø${E.dSvornik}`);
          pocExc++;
        }
      });
      if (typ === 'excentr' && pol.length === 2) {
        const l = (pol[0] + pol[1]) / 2;
        spoj('kolik', A, Bd, osa, c, s, tA, osaB, m, tB, osaL, l0, l1, cam, { polohy: [l] });
      }
    }
    const typSpoje = k.spoj || 'konfirmat';
    // dno
    if (dno === 'pod') {
      spoj(typSpoje, dnoD, bokL, 'y', dnoTop, 1, t, 'x', t / 2, t, 'z', zi0, D, 1);
      spoj(typSpoje, dnoD, bokP, 'y', dnoTop, 1, t, 'x', W - t / 2, t, 'z', zi0, D, -1);
    } else {
      spoj(typSpoje, bokL, dnoD, 'x', t, 1, t, 'y', yd + t / 2, t, 'z', zi0, D, -1);
      spoj(typSpoje, bokP, dnoD, 'x', W - t, -1, t, 'y', yd + t / 2, t, 'z', zi0, D, -1);
    }
    // strop
    if (strop === 'nad') {
      spoj(typSpoje, stropy[0], bokL, 'y', H - t, -1, t, 'x', t / 2, t, 'z', zi0, D, 1);
      spoj(typSpoje, stropy[0], bokP, 'y', H - t, -1, t, 'x', W - t / 2, t, 'z', zi0, D, -1);
    } else {
      for (const st of stropy) {
        spoj(typSpoje, bokL, st, 'x', t, 1, t, 'y', H - t / 2, t, 'z', st.box.z0, st.box.z1, 1);
        spoj(typSpoje, bokP, st, 'x', W - t, -1, t, 'y', H - t / 2, t, 'z', st.box.z0, st.box.z1, 1);
      }
    }
    // příčky do dna a stropu
    for (const c of sloupce) if (c.pricka) {
      const pm = c.pricka.box.x0 + t / 2;
      spoj(typSpoje, dnoD, c.pricka, 'y', dnoTop, 1, t, 'x', pm, t, 'z', zi0, D, 1);
      for (const st of stropy) spoj(typSpoje, st, c.pricka, 'y', H - t, -1, t, 'x', pm, t, 'z', Math.max(zi0, st.box.z0), st.box.z1, 1);
    }
    // soklová lišta mezi boky
    if (sokl.typ === 'boky') {
      const so = vys.dilce.find((d) => d.typNazev === 'Sokl'), zm = so.box.z0 + t / 2;
      spoj(typSpoje === 'excentr' ? 'konfirmat' : typSpoje, bokL, so, 'x', t, 1, t, 'z', zm, t, 'y', 0, yd, 1);
      spoj(typSpoje === 'excentr' ? 'konfirmat' : typSpoje, bokP, so, 'x', W - t, -1, t, 'z', zm, t, 'y', 0, yd, 1);
    }
    // pevná police mezi levým a pravým dílem sloupce
    const pevnaPolice = (c, y0, nazev, typN, id) => {
      const p = pridej(id, nazev, typN, 'korpus', KM, B(c.cx0, y0, zi0, c.cx1, y0 + t, zCelo), 'y', 'x', hr([['+z', hK]]));
      const ym = y0 + t / 2;
      spoj(typSpoje, c.levy, p, 'x', c.cx0, 1, t, 'y', ym, t, 'z', zi0, zCelo, -1, { posun: c.levy.typNazev === 'Příčka' ? -20 : 0 });
      spoj(typSpoje, c.pravy, p, 'x', c.cx1, -1, t, 'y', ym, t, 'z', zi0, zCelo, -1, { posun: c.pravy.typNazev === 'Příčka' ? 20 : 0 });
      if (c.cx1 - c.cx0 > N.police.maxRozpeti) V(`${nazev}: rozpětí ${r1(c.cx1 - c.cx0)} mm je větší než ${N.police.maxRozpeti} mm – hrozí průhyb, přidejte příčku.`);
      return p;
    };

    /* ---- systém 32: řady děr ---- */
    const s32 = N.s32, g0 = dnoTop + +s32.prvni, krok = +s32.krok;
    const zPredni = D - +s32.odCela;
    const kZad = Math.floor((zPredni - (zi0 + +s32.odZad)) / krok);
    const radyZ = kZad >= 1 ? [zPredni, zPredni - kZad * krok] : [zPredni];
    const rastrY = (y0, y1) => { const out = []; let j = Math.ceil((y0 - g0) / krok - 1e-9); for (; g0 + j * krok <= y1 + 1e-9; j++) out.push(g0 + j * krok); return out; };
    vys.s32 = { g0, krok, radyZ };
    const diryRady = (c, ys) => {
      for (const y of ys) for (const z of radyZ) {
        dira(c.levy, [c.cx0, y, z], '-x', s32.d, s32.hl, 's32', `systém 32 – Ø${s32.d}`);
        dira(c.pravy, [c.cx1, y, z], '+x', s32.d, s32.hl, 's32', `systém 32 – Ø${s32.d}`);
      }
    };

    /* ---- obsah sloupců ---- */
    const uchytky = (celo, svisle, xKraj) => {
      const r = +N.cela.uchytka;
      if (!(r > 0)) return;
      const b = celo.box, zR = b.z0;
      const P = [];
      if (svisle) {
        const yc = horni ? b.y0 + 100 : (H > 1300 ? Math.min(b.y1 - 100, Math.max(b.y0 + 100, 1050 - (k.oy || 0))) : b.y1 - 100);
        if (r === 1) P.push([xKraj, yc]); else { P.push([xKraj, yc - r / 2]); P.push([xKraj, yc + r / 2]); }
      } else {
        const xc = (b.x0 + b.x1) / 2, yc = (b.y0 + b.y1) / 2;
        if (r === 1) P.push([xc, yc]); else { P.push([xc - r / 2, yc]); P.push([xc + r / 2, yc]); }
      }
      for (const [x2, y2] of P) dira(celo, [x2, y2, b.z1], '-z', 5, null, 'uchytka', 'úchytka – Ø5 skrz');
      kov(r === 1 ? 'Knopky (úchytky jednobodové)' : `Úchytky rozteč ${r} mm`, 1, 'šrouby M4 dle tloušťky čela');
    };
    const dekorCelZ = N.celaMat;
    for (const c of sloupce) {
      const s = c.def, nz = Math.max(0, Math.round(+s.zasuvky || 0)), np = Math.max(0, Math.round(+s.police || 0));
      const sirkaC = c.cx1 - c.cx0;
      const info = { i: c.i, cx0: c.cx0, cx1: c.cx1, sirka: sirkaC };
      vys.sloupce.push(info);
      let zasTop = yi0, horniBottom = yi0, fyMid = fy0;
      const jenZas = nz > 0 && s.dvirka === 'zadne' && np === 0;
      if (nz > 0) {
        if (jenZas) zasTop = yi1;
        else {
          const hz = +s.vyskaZas > 0 ? +s.vyskaZas : Math.round((yi1 - yi0) * 0.45);
          zasTop = yi0 + hz;
          if (zasTop + t > yi1 - 60) { V(`sloupec ${c.i + 1}: zóna zásuvek je příliš vysoká.`); zasTop = Math.max(yi0 + 60, yi1 - 60 - t); }
          pevnaPolice(c, zasTop, `Dělicí police ${c.i + 1}`, 'Police pevná', `DP${c.i + 1}`);
          horniBottom = zasTop + t;
          fyMid = zasTop + t / 2;
        }
        // čela zásuvek
        const w = pomery(s.pomeryZas, nz);
        const polia = [];
        if (!inset) {
          const fA = fy0, fB = jenZas ? fy1 : fyMid;
          let yA = fA;
          for (let j = 0; j < nz; j++) { const yB = j === nz - 1 ? fB : yA + (fB - fA) * w[j]; polia.push({ pole: [c.fx0, yA, c.fx1, yB], celo: [c.fx0 + sp / 2, yA + sp / 2, c.fx1 - sp / 2, yB - sp / 2], slot: [Math.max(yi0, yA), Math.min(zasTop, yB)] }); yA = yB; }
        } else {
          const vol = zasTop - yi0 - (nz + 1) * sp;
          let yA = yi0 + sp;
          for (let j = 0; j < nz; j++) { const h = vol * w[j]; polia.push({ pole: [c.cx0, yA - sp / 2, c.cx1, yA + h + sp / 2], celo: [c.cx0 + sp, yA, c.cx1 - sp, yA + h], slot: [j === 0 ? yi0 : yA - sp / 2, j === nz - 1 ? zasTop : yA + h + sp / 2] }); yA += h + sp; }
        }
        polia.forEach((q, j) => {
          const [x0, y0, x1, y1] = q.celo, zc0 = inset ? D - tf : D, zc1 = zc0 + tf;
          const celo = pridej(`CZ${c.i + 1}${j + 1}`, `Čelo zásuvky ${c.i + 1}.${j + 1}`, 'Čelo zásuvky', 'celo', dekorCelZ, B(x0, y0, zc0, x1, y1, zc1), 'z',
            N.cela.vlaknaZasuvek === 'svisle' ? 'y' : 'x', hr([['+x', hC], ['-x', hC], ['+y', hC], ['-y', hC]]), { pohyb: { typ: 'zasuvka', id: `${pre}-Z${c.i + 1}${j + 1}` } });
          uchytky(celo, false);
          vys.cela.push({ dil: celo.id, typ: 'zasuvka', pole: q.pole, korpus: ki });
          // korpus zásuvky
          const tb = +N.zasMat.tl, tdz = +N.dnoZasMat.tl, vule = +N.zasuvky.vule;
          const bx0 = c.cx0 + vule, bx1 = c.cx1 - vule, bw = bx1 - bx0;
          const z1 = zCelo, Ldost = z1 - zi0 - +N.zasuvky.rezervaVzadu;
          const L = delkaVysuvu(Ldost, N.zasuvky.delky);
          const by0 = q.slot[0] + +N.zasuvky.mezeraDole, h = Math.floor(q.slot[1] - +N.zasuvky.mezeraNahore - by0);
          const zid = `${pre}-Z${c.i + 1}${j + 1}`;
          const zinfo = { id: zid, korpus: ki, sloupec: c.i, otvor: { x0: c.cx0, x1: c.cx1, y0: q.slot[0], y1: q.slot[1], z0: zi0, z1 }, box: null, L, vule, h, celo: celo.id, dilce: [] };
          vys.zasuvky.push(zinfo);
          if (!L) { V(`zásuvka ${c.i + 1}.${j + 1}: žádná standardní délka výsuvu se nevejde do hloubky ${r1(Ldost)} mm.`); return; }
          if (h < 50) { V(`zásuvka ${c.i + 1}.${j + 1}: korpus zásuvky by měl jen ${h} mm – zvětšete čelo.`); return; }
          const z0 = z1 - L;
          zinfo.box = B(bx0, by0, z0, bx1, by0 + h, z1);
          const ext = { pohyb: { typ: 'zasuvka', id: zid } };
          const ZM = N.zasMat;
          const hrB = hr([['+y', hK]]);
          let yy0 = by0;
          if (N.zasuvky.dno === 'pribite') {
            const dz = pridej(`ZD${c.i + 1}${j + 1}`, `Dno zásuvky ${c.i + 1}.${j + 1}`, 'Dno zásuvky', 'zasuvka', N.dnoZasMat, B(bx0, by0, z0, bx1, by0 + tdz, z1), 'y', 'z', {}, ext);
            zinfo.dilce.push(dz.id); yy0 = by0 + tdz;
            kov('Sponky pro dna zásuvek', Math.ceil(2 * (bw + L) / 80), 'po ~80 mm + lepidlo');
          }
          const bl = pridej(`ZL${c.i + 1}${j + 1}`, `Bok zásuvky L ${c.i + 1}.${j + 1}`, 'Bok zásuvky', 'zasuvka', ZM, B(bx0, yy0, z0, bx0 + tb, by0 + h, z1), 'x', 'z', hrB, ext);
          const bp = pridej(`ZP${c.i + 1}${j + 1}`, `Bok zásuvky P ${c.i + 1}.${j + 1}`, 'Bok zásuvky', 'zasuvka', ZM, B(bx1 - tb, yy0, z0, bx1, by0 + h, z1), 'x', 'z', hrB, ext);
          const pr = pridej(`ZC${c.i + 1}${j + 1}`, `Přední stěna zásuvky ${c.i + 1}.${j + 1}`, 'Přední/zadní stěna zásuvky', 'zasuvka', ZM, B(bx0 + tb, yy0, z1 - tb, bx1 - tb, by0 + h, z1), 'z', 'x', hrB, ext);
          const za = pridej(`ZZ${c.i + 1}${j + 1}`, `Zadní stěna zásuvky ${c.i + 1}.${j + 1}`, 'Přední/zadní stěna zásuvky', 'zasuvka', ZM, B(bx0 + tb, yy0, z0, bx1 - tb, by0 + h, z0 + tb), 'z', 'x', hrB, ext);
          zinfo.dilce.push(bl.id, bp.id, pr.id, za.id);
          if (N.zasuvky.dno !== 'pribite') {
            const hz = +N.zasuvky.hlDrazky, yD = by0 + +N.zasuvky.drazkaOd, v = 1;
            const dz = pridej(`ZD${c.i + 1}${j + 1}`, `Dno zásuvky ${c.i + 1}.${j + 1}`, 'Dno zásuvky', 'zasuvka', N.dnoZasMat, B(bx0 + tb - hz + v, yD, z0 + tb - hz + v, bx1 - tb + hz - v, yD + tdz, z1 - tb + hz - v), 'y', 'z', {}, ext);
            zinfo.dilce.push(dz.id);
            bl.drazky.push(B(bx0 + tb - hz, yD, z0, bx0 + tb, yD + tdz, z1)); bp.drazky.push(B(bx1 - tb, yD, z0, bx1 - tb + hz, yD + tdz, z1));
            pr.drazky.push(B(bx0 + tb, yD, z1 - tb, bx1 - tb, yD + tdz, z1 - tb + hz)); za.drazky.push(B(bx0 + tb, yD, z0 + tb - hz, bx1 - tb, yD + tdz, z0 + tb));
          }
          // spoje korpusu zásuvky (boky přes přední a zadní stěnu)
          const tz2 = typSpoje === 'excentr' ? 'kolik' : typSpoje;
          for (const [A2, s2, xc] of [[bl, 1, bx0 + tb], [bp, -1, bx1 - tb]]) {
            spoj(tz2, A2, pr, 'x', xc, s2, tb, 'z', z1 - tb / 2, tb, 'y', yy0, by0 + h, 1, {});
            spoj(tz2, A2, za, 'x', xc, s2, tb, 'z', z0 + tb / 2, tb, 'y', yy0, by0 + h, 1, {});
          }
          kov(`Výsuv ${VYSUVY[N.zasuvky.vysuv] ? VYSUVY[N.zasuvky.vysuv].nazev : N.zasuvky.vysuv} ${L} mm (pár)`, 1, `vůle ${String(vule).replace('.', ',')} mm na stranu (typicky, ověřte u výrobce)`);
          kov('Vruty 3,5 × 16 (výsuvy, čela)', 16, '6 + 6 na výsuvy, 4 na připevnění čela');
          // díry pro výsuvy na boku / příčce
          const ys = by0 + +N.zasuvky.osaVysuvu;
          const zs = []; for (let zz = z1 - 37; zz >= z0 + 20; zz -= 32) zs.push(zz);
          const vyb = zs.length <= 3 ? zs : [zs[0], zs[Math.round((zs.length - 1) / 2)], zs[zs.length - 1]];
          // posun předvrtu o násobek 32, pokud by se potkal s jinou dírou na téže ploše (např. pouzdro excentru)
          const volna = (panel, x0, zn, zz) => {
            const cizi = vys.diry.filter((q) => q.dil === panel.id && q.n === zn && Math.abs(q.p[0] - x0) < 0.01);
            for (const m of [0, -1, 1, -2, 2, -3, 3]) {
              const z2 = zz + m * 32;
              if (z2 < z0 + 15 || z2 > z1 - 15) continue;
              if (cizi.every((q) => Math.hypot(q.p[1] - ys, q.p[2] - z2) >= (q.d + +N.zasuvky.diraVysuvu) / 2 + 1)) return z2;
            }
            return null;
          };
          for (const zz0 of vyb) {
            const zL = volna(c.levy, c.cx0, '-x', zz0), zP = volna(c.pravy, c.cx1, '+x', zz0);
            if (zL == null || zP == null) V(`zásuvka ${c.i + 1}.${j + 1}: předvrt výsuvu koliduje s jinou dírou – posuňte ho ručně.`);
            if (zL != null) dira(c.levy, [c.cx0, ys, zL], '-x', N.zasuvky.diraVysuvu, N.zasuvky.hlDiryVysuvu, 'vysuv', `výsuv – předvrt Ø${String(N.zasuvky.diraVysuvu).replace('.', ',')}`);
            if (zP != null) dira(c.pravy, [c.cx1, ys, zP], '+x', N.zasuvky.diraVysuvu, N.zasuvky.hlDiryVysuvu, 'vysuv', `výsuv – předvrt Ø${String(N.zasuvky.diraVysuvu).replace('.', ',')}`);
          }
        });
        info.zasuvky = nz;
      }
      // horní zóna: police + dvířka
      const zoneY0 = horniBottom, zoneY1 = yi1, hz2 = zoneY1 - zoneY0;
      if (!jenZas && hz2 > 0) {
        if (np > 0) {
          if (s.typPolic === 'pevne') {
            const g = (hz2 - np * t) / (np + 1);
            for (let j = 1; j <= np; j++) pevnaPolice(c, zoneY0 + j * g + (j - 1) * t, `Police pevná ${c.i + 1}.${j}`, 'Police pevná', `PP${c.i + 1}${j}`);
          } else {
            const ys = rastrY(zoneY0 + +s32.okraj, zoneY1 - +s32.okraj);
            diryRady(c, ys);
            const v = +N.police.vule, nad = +N.police.nadOsou;
            const g = (hz2 - np * t) / (np + 1);
            const pouzite = [];
            for (let j = 1; j <= np; j++) {
              const ideal = zoneY0 + j * g + (j - 1) * t - nad;
              let best = null;
              for (const y of ys) if (!pouzite.includes(y) && y + nad + t <= zoneY1 - 5 && (best == null || Math.abs(y - ideal) < Math.abs(best - ideal))) best = y;
              if (best == null) { V(`sloupec ${c.i + 1}: pro stavitelnou polici ${j} nezbyla díra v rastru.`); continue; }
              pouzite.push(best);
              const yp = best + nad;
              pridej(`PS${c.i + 1}${j}`, `Police stavitelná ${c.i + 1}.${j}`, 'Police stavitelná', 'korpus', KM, B(c.cx0 + v, yp, zi0, c.cx1 - v, yp + t, zCelo - +N.police.odsazeni), 'y', 'x', hr([['+z', hK]]));
              kov('Podpěrky polic Ø5', 4, 'kovové kolíčky do systému 32');
              if (sirkaC > N.police.maxRozpeti) V(`police ${c.i + 1}.${j}: rozpětí ${r1(sirkaC)} mm je větší než ${N.police.maxRozpeti} mm – hrozí průhyb.`);
            }
          }
          info.police = np;
        }
        // dvířka
        if (s.dvirka && s.dvirka !== 'zadne') {
          const dv = [];
          if (!inset) {
            const yA = nz > 0 ? fyMid : fy0, yB = fy1;
            if (s.dvirka === 'dvoje') { const xm = (c.fx0 + c.fx1) / 2; dv.push({ b: [c.fx0 + sp / 2, yA + sp / 2, xm - sp / 2, yB - sp / 2], zaves: 'L', pole: [c.fx0, yA, xm, yB] }, { b: [xm + sp / 2, yA + sp / 2, c.fx1 - sp / 2, yB - sp / 2], zaves: 'P', pole: [xm, yA, c.fx1, yB] }); }
            else dv.push({ b: [c.fx0 + sp / 2, yA + sp / 2, c.fx1 - sp / 2, yB - sp / 2], zaves: s.dvirka, pole: [c.fx0, yA, c.fx1, yB] });
          } else {
            const yA = zoneY0 + sp, yB = zoneY1 - sp;
            if (s.dvirka === 'dvoje') { const w2 = (sirkaC - 3 * sp) / 2; dv.push({ b: [c.cx0 + sp, yA, c.cx0 + sp + w2, yB], zaves: 'L', pole: [c.cx0, zoneY0, c.cx0 + sp * 1.5 + w2, zoneY1] }, { b: [c.cx1 - sp - w2, yA, c.cx1 - sp, yB], zaves: 'P', pole: [c.cx1 - sp * 1.5 - w2, zoneY0, c.cx1, zoneY1] }); }
            else dv.push({ b: [c.cx0 + sp, yA, c.cx1 - sp, yB], zaves: s.dvirka, pole: [c.cx0, zoneY0, c.cx1, zoneY1] });
          }
          dv.forEach((q, j) => {
            const [x0, y0, x1, y1] = q.b, zc0 = inset ? D - tf : D;
            const id = `DV${c.i + 1}${dv.length > 1 ? (j ? 'P' : 'L') : ''}`;
            const dil = pridej(id, `Dvířka ${c.i + 1}${dv.length > 1 ? (j ? ' pravá' : ' levá') : ''}`, 'Dvířka', 'celo', N.celaMat, B(x0, y0, zc0, x1, y1, zc0 + tf), 'z', 'y',
              hr([['+x', hC], ['-x', hC], ['+y', hC], ['-y', hC]]), { pohyb: { typ: 'dvere', zaves: q.zaves } });
            vys.cela.push({ dil: dil.id, typ: 'dvere', pole: q.pole, korpus: ki, zaves: q.zaves });
            if (x1 - x0 > 600) V(`${dil.nazev}: šířka ${r1(x1 - x0)} mm je víc než 600 mm – zvažte dvoje dvířka.`);
            // závěsy
            const hD = y1 - y0, nZ = pocetZavesu(hD, N.zavesy.prahy);
            let pol = polohyZavesu(hD, nZ, +N.zavesy.odKraje).map((p) => y0 + p);
            if (N.zavesy.doRastru) pol = pol.map((yc) => { const q2 = g0 + Math.round((yc - 16 - g0) / krok) * krok + 16; return q2 - 16 >= y0 + 30 && q2 + 16 <= y1 - 30 ? q2 : yc; });
            const xHr = q.zaves === 'P' ? x1 : x0, smer = q.zaves === 'P' ? -1 : 1;
            const panel = q.zaves === 'P' ? c.pravy : c.levy, xPan = q.zaves === 'P' ? c.cx1 : c.cx0, nPan = q.zaves === 'P' ? '+x' : '-x';
            const zPod = (inset ? D - tf : D) - 37;
            for (const yc of pol) {
              dira(dil, [xHr + smer * +N.zavesy.odHrany, yc, zc0], '+z', +N.zavesy.miska, +N.zavesy.hlMisky, 'miska', `miska závěsu Ø${N.zavesy.miska}`);
              for (const dy of [-16, 16]) dira(panel, [xPan, yc + dy, zPod], nPan, +N.zavesy.podlozka, +N.zavesy.hlPodlozky, 'zaves', `podložka závěsu – Ø${N.zavesy.podlozka}`);
            }
            dil.zavesy = pol.map((p) => r1(p));
            kov(inset ? 'Závěs miskový Ø35 – vložený (s podložkou)' : 'Závěs miskový Ø35 – na doraz (s podložkou)', nZ, 'typ podle polohy dvířek, tlumení dle volby');
            kov('Vruty 3,5 × 16 (závěsy) / euro šrouby', nZ * 4, '2 do misky, 2 do podložky');
            uchytky(dil, true, q.zaves === 'P' ? x0 + +N.cela.odHranyUchytky : x1 - +N.cela.odHranyUchytky);
          });
        }
      }
      vys.otvory.push({ sloupec: c.i, x0: c.cx0, x1: c.cx1, y0: yi0, y1: yi1, z0: zi0, z1: D });
    }

    kov('Konfirmáty 7 × 50', pocKonf, 'stupňovitý vrták 5/7 + zahloubení');
    kov('Kolíky Ø8 × 35', pocKolik, 'lepidlo D2/D3');
    kov('Excentry Ø15 + svorníky', pocExc, 'svorník šroubovací (typicky)');
    if (pocExc + pocKonf > 0) kov('Krytky (konfirmát / excentr)', pocKonf + pocExc, 'barva dle dekoru');
    vys.rozmery = { W, H, D, t, yd, yb, dnoTop, yi0, yi1, zi0, zCelo, fy0, fy1, sv, sokl: sokl.typ };
    return vys;
  }

  /* ---------------- posun boxů a děr do souřadnic sestavy ---------------- */
  function posunBox(b, dx, dy, dz) { return { x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0 + dy, y1: b.y1 + dy, z0: b.z0 + dz, z1: b.z1 + dz }; }

  /* ---------------- rozměry dílce, hrany ---------------- */
  function rozmeryDilce(d, N) {
    const b = d.box, L = boxRozmer(b, d.osaD), S2 = boxRozmer(b, d.osaS), T = boxRozmer(b, d.osaT);
    const H = d.hranyStrany || {};
    const hrany = { d1: H['-' + d.osaS] || 0, d2: H['+' + d.osaS] || 0, s1: H['-' + d.osaD] || 0, s2: H['+' + d.osaD] || 0 };
    const od = N && N.hrany && N.hrany.odecist;
    return { delka: r1(L), sirka: r1(S2), tl: r1(T), hrany, rezDelka: r1(od ? L - hrany.s1 - hrany.s2 : L), rezSirka: r1(od ? S2 - hrany.d1 - hrany.d2 : S2) };
  }

  /* ============================================================
     Celý projekt
     ============================================================ */
  function vypocet(P0) {
    const P = normalizuj(P0), N = P.N;
    const out = { projekt: P, korpusy: [], dilce: [], diry: [], cela: [], zasuvky: [], varovani: [], kovaniMapa: {} };
    let xD = 0, xH = +N.linka.horniOdsazeni || 0;
    P.korpusy.forEach((k, ki) => {
      const horni = k.rada === 'horni';
      const ox = (horni ? xH : xD) + (+k.mezeraPred || 0), oy = horni ? +N.linka.horniSpodek : 0;
      k.oy = oy;
      const v = korpus(k, N, ki);
      if (horni) xH = ox + +k.sirka; else xD = ox + +k.sirka;
      for (const d of v.dilce) { d.box = posunBox(d.box, ox, oy, 0); d.drazky = d.drazky.map((b) => posunBox(b, ox, oy, 0)); }
      for (const q of v.diry) q.p = [q.p[0] + ox, q.p[1] + oy, q.p[2]];
      for (const z of v.zasuvky) { if (z.box) z.box = posunBox(z.box, ox, oy, 0); z.otvor = posunBox(z.otvor, ox, oy, 0); }
      for (const c of v.cela) c.pole = [c.pole[0] + ox, c.pole[1] + oy, c.pole[2] + ox, c.pole[3] + oy];
      for (const o of v.otvory) Object.assign(o, posunBox(o, ox, oy, 0));
      out.korpusy.push({ index: ki, k, ox, oy, rozmery: v.rozmery, sloupce: v.sloupce, otvory: v.otvory, s32: v.s32 });
      out.dilce.push(...v.dilce); out.diry.push(...v.diry); out.cela.push(...v.cela); out.zasuvky.push(...v.zasuvky); out.varovani.push(...v.varovani);
      for (const x of Object.values(v.kovani)) { const y = out.kovaniMapa[x.nazev] || (out.kovaniMapa[x.nazev] = { nazev: x.nazev, ks: 0, pozn: x.pozn }); y.ks += x.ks; }
    });
    // pracovní deska nad souvislými úseky dolních skříněk „pod deskou“
    out.pracovniDesky = [];
    if (N.linka.deska) {
      const dol = out.korpusy.filter((q) => q.k.rada !== 'horni' && q.k.podDeskou).sort((a, b) => a.ox - b.ox);
      let usek = null;
      const uzavri = () => {
        if (!usek) return;
        const tP = +N.pracMat.tl, x0 = usek.x0 - +N.linka.presahL, x1 = usek.x1 + +N.linka.presahP;
        const hl = usek.D + (N.cela.montaz === 'vlozena' ? 0 : +N.celaMat.tl) + +N.linka.presahPredni;
        const id = `PD${out.pracovniDesky.length + 1}`;
        const d = { id, korpus: -1, nazev: `Pracovní deska ${out.pracovniDesky.length + 1}`, typNazev: 'Pracovní deska', skupina: 'deska', mat: N.pracMat,
          box: { x0, x1, y0: usek.H, y1: usek.H + tP, z0: 0, z1: hl }, osaT: 'y', osaVlaken: 'x', hranyStrany: {}, drazky: [] };
        d.osaD = 'x'; d.osaS = 'z'; d.smerVlaken = maVlakna(N.pracMat) ? 'delka' : 'volny';
        out.dilce.push(d); out.pracovniDesky.push(d);
        if (usek.ruzne) out.varovani.push(`${d.nazev}: skříňky pod deskou mají různou výšku nebo hloubku – deska leží na nejvyšší.`);
        usek = null;
      };
      for (const q of dol) {
        const H = +q.k.vyska, D = +q.k.hloubka;
        if (usek && Math.abs(q.ox - usek.x1) < 0.5) { usek.ruzne = usek.ruzne || H !== usek.H || D !== usek.D; usek.x1 = q.ox + +q.k.sirka; usek.H = Math.max(usek.H, H); usek.D = Math.max(usek.D, D); }
        else { uzavri(); usek = { x0: q.ox, x1: q.ox + +q.k.sirka, H, D }; }
      }
      uzavri();
      if (out.pracovniDesky.length) out.kovaniMapa['Spojovací pásek / lišta ukončení pracovní desky'] = { nazev: 'Lišta ukončení pracovní desky (pár)', ks: out.pracovniDesky.length, pozn: 'boční ukončení, silikon' };
      for (const d of out.pracovniDesky) if (boxRozmer(d.box, 'x') > MATERIALY.pracovni.deska[0]) out.varovani.push(`${d.nazev} je delší než ${MATERIALY.pracovni.deska[0]} mm – bude potřeba spoj desky.`);
    }
    // kontrola výšky horních skříněk nad deskou
    const hd = out.pracovniDesky.length ? Math.max(...out.pracovniDesky.map((d) => d.box.y1)) : 0;
    if (hd && out.korpusy.some((q) => q.k.rada === 'horni') && N.linka.horniSpodek - hd < 450) out.varovani.push(`Horní skříňky jsou jen ${r1(N.linka.horniSpodek - hd)} mm nad pracovní deskou (obvykle 500–600 mm).`);
    // rozměry dílců
    for (const d of out.dilce) d.rozmer = rozmeryDilce(d, N);
    out.diry = sjednotDiry(out.diry, out.dilce);
    out.kolizeDer = kontrolaDer(out);
    if (out.kolizeDer.length) out.varovani.push(`${out.kolizeDer.length}× se díry na dílci překrývají – zkontrolujte plán vrtání (${out.kolizeDer.slice(0, 3).map((q) => q.dil).join(', ')}…).`);
    out.kovani = Object.values(out.kovaniMapa).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    out.kusovnik = kusovnik(out.dilce, N);
    out.sestava = obalka(out.dilce);
    out.kolize = kolize(out.dilce);
    if (out.kolize.length) out.varovani.push(`Kolize dílců: ${out.kolize.slice(0, 3).map((q) => q.a + ' × ' + q.b).join(', ')}${out.kolize.length > 3 ? '…' : ''}`);
    return out;
  }

  /* ---------------- obálka, kolize ---------------- */
  function obalka(dilce) {
    const o = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
    for (const d of dilce) for (const q of OSY) { o[q + '0'] = Math.min(o[q + '0'], d.box[q + '0']); o[q + '1'] = Math.max(o[q + '1'], d.box[q + '1']); }
    return o;
  }
  function prunik(a, b) {
    const r = {};
    for (const q of OSY) { r[q + '0'] = Math.max(a[q + '0'], b[q + '0']); r[q + '1'] = Math.min(a[q + '1'], b[q + '1']); if (r[q + '1'] - r[q + '0'] <= 1e-6) return null; }
    return r;
  }
  const obsahuje = (vnejsi, b, eps) => OSY.every((q) => b[q + '0'] >= vnejsi[q + '0'] - eps && b[q + '1'] <= vnejsi[q + '1'] + eps);
  /** páry dílců, jejichž kvádry se protínají objemem (dotyk nevadí); průnik uvnitř drážky jednoho z dílců je v pořádku */
  function kolize(dilce, eps) {
    eps = eps == null ? 1e-6 : eps;
    const out = [];
    for (let i = 0; i < dilce.length; i++) for (let j = i + 1; j < dilce.length; j++) {
      const a = dilce[i], b = dilce[j], p = prunik(a.box, b.box);
      if (!p) continue;
      if (a.drazky.some((g) => obsahuje(g, p, 1e-6)) || b.drazky.some((g) => obsahuje(g, p, 1e-6))) continue;
      const obj = OSY.reduce((s, q) => s * (p[q + '1'] - p[q + '0']), 1);
      if (obj > eps) out.push({ a: a.id, b: b.id, objem: obj });
    }
    return out;
  }

  /* ---------------- díry v lokálních souřadnicích dílce ---------------- */
  /**
   * lokální souřadnice: u = podél délky (osaD), v = podél šířky (osaS), w = tloušťka (osaT), vše od minima kvádru.
   * plocha: 'A' (vrtá se z plochy w = 0), 'B' (z plochy w = T), nebo hrana 'd1','d2','s1','s2'.
   */
  function lokalniDira(dil, q) {
    const b = dil.box, P = { x: q.p[0], y: q.p[1], z: q.p[2] };
    const u = P[dil.osaD] - b[dil.osaD + '0'], v = P[dil.osaS] - b[dil.osaS + '0'], w = P[dil.osaT] - b[dil.osaT + '0'];
    const osa = q.n[1], zn = q.n[0];
    let plocha;
    if (osa === dil.osaT) plocha = zn === '+' ? 'A' : 'B';
    else if (osa === dil.osaS) plocha = zn === '+' ? 'd1' : 'd2';
    else plocha = zn === '+' ? 's1' : 's2';
    return { u: r2(u), v: r2(v), w: r2(w), plocha, d: q.d, hl: q.hl, typ: q.typ, popis: q.popis };
  }
  /** spojí duplicitní díry (stejná plocha, poloha, průměr) a protilehlé slepé díry, které by se potkaly, na průchozí */
  function sjednotDiry(diry, dilce) {
    const mapa = new Map(dilce.map((d) => [d.id, d]));
    const out = [], klice = new Map();
    for (const q of diry) {
      const d = mapa.get(q.dil);
      if (!d) continue;
      const L = lokalniDira(d, q);
      const k = `${q.dil}|${L.plocha}|${Math.round(L.u * 2)}|${Math.round(L.v * 2)}|${Math.round(L.w * 2)}`;
      const ex = klice.get(k);
      if (ex) { if (ex.d < q.d) Object.assign(ex, { d: q.d, typ: q.typ, popis: q.popis }); if (ex.hl != null && (q.hl == null || q.hl > ex.hl)) ex.hl = q.hl; continue; }
      const nq = Object.assign({}, q);
      klice.set(k, nq); out.push(nq);
    }
    // protilehlé slepé díry na téže ose
    const plosne = new Map();
    for (const q of out) {
      const d = mapa.get(q.dil), L = lokalniDira(d, q);
      if (L.plocha !== 'A' && L.plocha !== 'B') continue;
      const k = `${q.dil}|${Math.round(L.u * 2)}|${Math.round(L.v * 2)}`;
      if (!plosne.has(k)) plosne.set(k, []);
      plosne.get(k).push({ q, L, T: boxRozmer(d.box, d.osaT) });
    }
    const smaz = new Set();
    for (const arr of plosne.values()) {
      const A = arr.filter((x) => x.L.plocha === 'A'), Bq = arr.filter((x) => x.L.plocha === 'B');
      for (const a of A) for (const b of Bq) {
        if (smaz.has(a.q) || smaz.has(b.q)) continue;
        const ha = a.q.hl == null ? a.T : a.q.hl, hb = b.q.hl == null ? b.T : b.q.hl;
        if (ha + hb > a.T - 1) {
          if (a.q.d === b.q.d) { a.q.hl = null; a.q.popis += ' (průchozí – společná pro obě strany)'; smaz.add(b.q); }
          else { const mensi = a.q.d < b.q.d ? a.q : b.q; mensi.kolize = true; }
        }
      }
    }
    return out.filter((q) => !smaz.has(q));
  }
  /** díry na téže ploše dílce, které se překrývají (vzdálenost středů < součet poloměrů) */
  function kontrolaDer(V) {
    const mapa = new Map(V.dilce.map((d) => [d.id, d])), skup = new Map(), out = [];
    for (const q of V.diry) {
      const d = mapa.get(q.dil), L = lokalniDira(d, q), k = q.dil + '|' + L.plocha;
      if (!skup.has(k)) skup.set(k, []);
      skup.get(k).push({ q, L });
    }
    for (const [k, arr] of skup) {
      const hranova = !/\|[AB]$/.test(k);
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i].L, b = arr[j].L;
        const dist = hranova ? Math.hypot((a.plocha[0] === 'd' ? a.u - b.u : a.v - b.v), a.w - b.w) : Math.hypot(a.u - b.u, a.v - b.v);
        if (dist < (a.d + b.d) / 2 - 0.01) out.push({ dil: arr[i].q.dil, a: arr[i].q.popis, b: arr[j].q.popis, vzd: r2(dist) });
      }
    }
    return out;
  }
  function diryDilce(V, id) {
    const d = V.dilce.find((x) => x.id === id);
    if (!d) return [];
    return V.diry.filter((q) => q.dil === id).map((q) => Object.assign(lokalniDira(d, q), { kolize: !!q.kolize }));
  }

  /* ---------------- kusovník ---------------- */
  function kusovnik(dilce, N) {
    const mapa = new Map(), out = [];
    for (const d of dilce) {
      const r = d.rozmer || rozmeryDilce(d, N);
      const h = r.hrany;
      const k = [d.typNazev, klicMaterialu(d.mat), r.delka, r.sirka, r.tl, h.d1, h.d2, h.s1, h.s2, d.smerVlaken].join('|');
      let x = mapa.get(k);
      if (!x) {
        x = { nazev: d.typNazev, delka: r.delka, sirka: r.sirka, tl: r.tl, ks: 0, material: popisMaterialu(d.mat), mat: d.mat, smerVlaken: d.smerVlaken, hrany: h, rezDelka: r.rezDelka, rezSirka: r.rezSirka, dilce: [], skupina: d.skupina };
        mapa.set(k, x); out.push(x);
      }
      x.ks++; x.dilce.push(d.id);
    }
    const poradi = ['korpus', 'sokl', 'zada', 'celo', 'zasuvka', 'deska'];
    out.sort((a, b) => poradi.indexOf(a.skupina) - poradi.indexOf(b.skupina) || a.material.localeCompare(b.material, 'cs') || b.delka - a.delka || b.sirka - a.sirka);
    out.forEach((x, i) => { x.pozice = i + 1; x.plocha = r2(x.delka * x.sirka * x.ks / 1e6); });
    return out;
  }
  /** délky hran podle tloušťky (bm) */
  function souhrnHran(kus) {
    const m = {};
    for (const x of kus) {
      const pridat = (tl, L) => { if (tl > 0) m[tl] = (m[tl] || 0) + L * x.ks / 1000; };
      pridat(x.hrany.d1, x.delka); pridat(x.hrany.d2, x.delka); pridat(x.hrany.s1, x.sirka); pridat(x.hrany.s2, x.sirka);
    }
    return Object.keys(m).sort((a, b) => a - b).map((tl) => ({ tl: +tl, bm: r2(m[tl]) }));
  }
  function souhrnMaterialu(kus) {
    const m = new Map();
    for (const x of kus) { const k = x.material; const y = m.get(k) || { material: k, mat: x.mat, plocha: 0, ks: 0 }; y.plocha += x.delka * x.sirka * x.ks / 1e6; y.ks += x.ks; m.set(k, y); }
    return [...m.values()].map((y) => Object.assign(y, { plocha: r2(y.plocha) }));
  }

  /**
   * Export pro obsah/rezny_plan.html (formát „kusovnik-v1“, který stránka Řezný plán importuje):
   * {format, zdroj, projekt, dilce: [...], hrany_typy: [{id, nazev, tloustka, sirka}], desky: [{material, delka, sirka, tloustka, vlakna}]}
   * dílec: {nazev, delka, sirka, ks, material, smerVlaken, hrany, tl, vlakna, hranyMm, rezDelka, rezSirka, pozn}
   *  delka/sirka = HOTOVÝ rozměr (Řezný plán sám odečte tloušťku hran podle hrany_typy); delka = rozměr podél vláken, když smerVlaken = "delka"
   *  smerVlaken: "delka" (vlákna podél délky, neotáčet) | "volny"; vlakna = smerVlaken === "delka"
   *  hrany: {d1, d2, s1, s2} = id typu hrany z hrany_typy ('' = bez hrany); d1/d2 dlouhé hrany (podél délky), s1/s2 krátké
   *  hranyMm: totéž v mm tloušťky; rezDelka/rezSirka = řezný rozměr spočtený touto stránkou
   */
  function exportReznyPlan(kus, o) {
    o = o || {};
    const typy = new Map();
    const idHrany = (tl, tlDesky) => {
      if (!(tl > 0)) return '';
      const sirka = tlDesky > 20 ? 43 : 22, id = `ABS${String(tl).replace('.', '_')}x${sirka}`;
      if (!typy.has(id)) typy.set(id, { id, nazev: `ABS ${String(tl).replace('.', ',')} mm / ${sirka}`, tloustka: tl, sirka });
      return id;
    };
    const desky = new Map();
    const dilce = kus.map((x) => {
      if (!desky.has(x.material)) { const f = (MATERIALY[x.mat.druh] || MATERIALY.DTD).deska; desky.set(x.material, { material: x.material, delka: f[0], sirka: f[1], tloustka: x.tl, vlakna: maVlakna(x.mat) }); }
      return {
        nazev: x.nazev, delka: x.delka, sirka: x.sirka, ks: x.ks, material: x.material, smerVlaken: x.smerVlaken,
        hrany: { d1: idHrany(x.hrany.d1, x.tl), d2: idHrany(x.hrany.d2, x.tl), s1: idHrany(x.hrany.s1, x.tl), s2: idHrany(x.hrany.s2, x.tl) },
        tl: x.tl, vlakna: x.smerVlaken === 'delka', hranyMm: Object.assign({}, x.hrany), rezDelka: x.rezDelka, rezSirka: x.rezSirka,
        pozn: x.dilce.slice(0, 12).join(', ') + (x.dilce.length > 12 ? '…' : ''),
      };
    });
    return { format: 'kusovnik-v1', zdroj: 'Návrh skříní', projekt: o.projekt || '', dilce, hrany_typy: [...typy.values()], desky: [...desky.values()] };
  }

  /* ============================================================
     Jednoduchý řezný plán – gilotinové dělení (best area fit)
     ============================================================ */
  function reznyPlan(kus, N) {
    const R = (N && N.rezani) || { prorez: 4, okraj: 10, formaty: {} };
    const pr = +R.prorez, ok = +R.okraj;
    const skupiny = new Map();
    for (const x of kus) {
      const k = x.material;
      if (!skupiny.has(k)) skupiny.set(k, { material: k, mat: x.mat, dily: [] });
      for (let i = 0; i < x.ks; i++) skupiny.get(k).dily.push({ nazev: x.nazev, pozice: x.pozice, w: x.rezDelka, h: x.rezSirka, volny: x.smerVlaken !== 'delka' });
    }
    const out = [];
    for (const g of skupiny.values()) {
      const f = (R.formaty && R.formaty[g.mat.druh]) || (MATERIALY[g.mat.druh] || MATERIALY.DTD).deska;
      const ok2 = g.mat.druh === 'pracovni' ? 0 : ok, SW = +f[0], SH = +f[1], UW = SW - 2 * ok2, UH = SH - 2 * ok2;
      const desky = [], nevejde = [];
      g.dily.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
      const novaDeska = () => { const d = { w: SW, h: SH, volne: [{ x: ok2, y: ok2, w: UW, h: UH }], dily: [] }; desky.push(d); return d; };
      const zkus = (d, p) => {
        let best = null;
        for (let i = 0; i < d.volne.length; i++) {
          const r = d.volne[i];
          for (const rot of p.volny ? [false, true] : [false]) {
            const w = rot ? p.h : p.w, h = rot ? p.w : p.h;
            if (w <= r.w + 1e-6 && h <= r.h + 1e-6) {
              const sk = r.w * r.h - w * h;
              if (!best || sk < best.sk) best = { i, rot, w, h, sk };
            }
          }
        }
        return best;
      };
      for (const p of g.dily) {
        if (!(p.w <= UW || (p.volny && p.h <= UW)) || !(Math.min(p.w, p.h) <= Math.max(UW, UH))) { /* kontrola níže */ }
        let kde = null, deska = null;
        for (const d of desky) { const b = zkus(d, p); if (b && (!kde || b.sk < kde.sk)) { kde = b; deska = d; } }
        if (!kde) { const d = novaDeska(); const b = zkus(d, p); if (!b) { desky.pop(); nevejde.push(p); continue; } kde = b; deska = d; }
        const r = deska.volne.splice(kde.i, 1)[0];
        deska.dily.push({ x: r.x, y: r.y, w: kde.w, h: kde.h, otoceno: kde.rot, nazev: p.nazev, pozice: p.pozice });
        // gilotinový řez: dělit podél kratšího zbytku
        const zbW = r.w - kde.w - pr, zbH = r.h - kde.h - pr;
        let a, b;
        if (zbW < zbH) { a = { x: r.x + kde.w + pr, y: r.y, w: zbW, h: kde.h }; b = { x: r.x, y: r.y + kde.h + pr, w: r.w, h: zbH }; }
        else { a = { x: r.x + kde.w + pr, y: r.y, w: zbW, h: r.h }; b = { x: r.x, y: r.y + kde.h + pr, w: kde.w, h: zbH }; }
        for (const q of [a, b]) if (q.w > 20 && q.h > 20) deska.volne.push(q);
      }
      for (const d of desky) { d.vyuziti = r2(d.dily.reduce((s, q) => s + q.w * q.h, 0) / (SW * SH) * 100); delete d.volne; }
      out.push({ material: g.material, mat: g.mat, format: [SW, SH], desky, nevejde, prorez: pr, okraj: ok });
    }
    return out;
  }

  /* ---------------- kontroly pro testy a UI ---------------- */
  /** čela korpusu se spárami (rozšířená o polovinu spáry) dlaždicují pole čel bez překryvu */
  function kontrolaCel(V, N) {
    const sp = +N.cela.spara, inset = N.cela.montaz === 'vlozena', chyby = [];
    const mapa = new Map(V.dilce.map((d) => [d.id, d]));
    for (const c of V.cela) {
      const d = mapa.get(c.dil), b = d.box, [x0, y0, x1, y1] = c.pole;
      if (!inset) {
        if (Math.abs((b.x0 - x0) - sp / 2) > 0.01 || Math.abs((x1 - b.x1) - sp / 2) > 0.01 || Math.abs((b.y0 - y0) - sp / 2) > 0.01 || Math.abs((y1 - b.y1) - sp / 2) > 0.01) chyby.push(`${d.id}: spáry nesedí`);
      } else if (b.x0 < x0 + sp / 2 - 0.01 || b.x1 > x1 - sp / 2 + 0.01 || b.y0 < y0 + sp / 2 - 0.01 || b.y1 > y1 - sp / 2 + 0.01) chyby.push(`${d.id}: vložené čelo nemá spáru`);
    }
    return chyby;
  }

  const API = {
    MATERIALY, DEKORY, VYSUVY, PREDVOLBY, NAZEV_STRANY, OSY,
    vychoziNastaveni, vychoziProjekt, projektZPredvolby, normalizuj, novyKorpus, novySloupec,
    vypocet, korpus, pocetZavesu, polohyZavesu, polohySpoju, delkaVysuvu, pomery,
    rozmeryDilce, kusovnik, souhrnHran, souhrnMaterialu, exportReznyPlan, reznyPlan,
    kolize, prunik, obalka, lokalniDira, diryDilce, sjednotDiry, kontrolaDer, kontrolaCel,
    maVlakna, popisMaterialu, boxRozmer, r1, r2, cislo, kopie,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.NS = API;
})(typeof window !== 'undefined' ? window : globalThis);
