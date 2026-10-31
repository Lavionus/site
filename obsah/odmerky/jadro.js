/* Odměrky do kuchyně – jádro bez DOM (spustitelné v node).
   Objem → rozměry dutiny (přesně, včetně korekce mnohoúhelníku při rotaci), kontroly, stavba přes manifold-3d,
   rysky stupnice, popisky z písma, rozmístění sady a odhad tisku.
   Souřadnice: mm, osa Z nahoru, odměrka stojí dnem na podložce (z = 0), rukojeť míří do +X, stupnice do +Y.
   postav(w, p, font) → { kus, kusy, dily, duchy, upozorneni }
   w = inicializovaný manifold (po setup()), font = opentype Font nebo null (pak bez popisků a čísel). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const NOZ = uzel ? require('../nozicky/jadro.js') : window.NOZ;      // rozloz, obal, fmt, cislo, kopie, vezmi, poloz
  const klic = () => (uzel ? require('../klicenky/jadro.js') : window.KLIC);   // rozvrhniText
  const { fmt, cislo, kopie, vezmi, poloz } = NOZ;
  const VERZE_FORMATU = 1;
  const RAD = Math.PI / 180;

  /* ---------- jednotky a suroviny ---------- */
  const JEDNOTKY = {
    ml: { nazev: 'ml', ml: 1, kratce: 'ml' },
    dl: { nazev: 'dl', ml: 100, kratce: 'dl' },
    l: { nazev: 'l', ml: 1000, kratce: 'l' },
    hrnek: { nazev: 'hrnek (250 ml)', ml: 250, kratce: 'hrnek' },
    cup: { nazev: 'cup (US, 236,6 ml)', ml: 236.5882, kratce: 'cup' },
    tbsp: { nazev: 'lžíce – tbsp (14,8 ml)', ml: 14.7868, kratce: 'tbsp' },
    tsp: { nazev: 'lžička – tsp (4,93 ml)', ml: 4.9289, kratce: 'tsp' },
    floz: { nazev: 'fl oz (US, 29,6 ml)', ml: 29.5735, kratce: 'fl oz' },
    g: { nazev: 'gramy suroviny', ml: null, kratce: 'g' },
  };
  /** Další zápisy jednotky v seznamu sady („1 lžíce“, „100 g“…). */
  const ALIASY = { lzice: 'tbsp', 'lžíce': 'tbsp', 'lžička': 'tsp', lzicka: 'tsp', 'fl oz': 'floz', 'cups': 'cup', 'hrnky': 'hrnek', 'hrnku': 'hrnek', 'hrnků': 'hrnek' };
  /** Orientační sypná hmotnost g/ml (nasypáno lžící, zarovnáno; setřesením až o 15 % víc). */
  const SUROVINY = {
    mouka_hladka: { nazev: 'Mouka hladká', gml: 0.53 },
    mouka_polohruba: { nazev: 'Mouka polohrubá', gml: 0.62 },
    mouka_hruba: { nazev: 'Mouka hrubá', gml: 0.66 },
    cukr_krupice: { nazev: 'Cukr krupice', gml: 0.85 },
    cukr_moucka: { nazev: 'Cukr moučka', gml: 0.52 },
    sul: { nazev: 'Sůl jemná', gml: 1.2 },
    ryze: { nazev: 'Rýže', gml: 0.8 },
    vlocky: { nazev: 'Ovesné vločky', gml: 0.38 },
    krupice: { nazev: 'Krupice', gml: 0.68 },
    cocka: { nazev: 'Čočka', gml: 0.8 },
    kakao: { nazev: 'Kakao', gml: 0.42 },
    kava: { nazev: 'Káva mletá', gml: 0.36 },
    mak: { nazev: 'Mák mletý', gml: 0.5 },
    kokos: { nazev: 'Kokos strouhaný', gml: 0.35 },
    strouhanka: { nazev: 'Strouhanka', gml: 0.45 },
    voda: { nazev: 'Voda', gml: 1 },
    mleko: { nazev: 'Mléko', gml: 1.03 },
    olej: { nazev: 'Olej', gml: 0.92 },
    med: { nazev: 'Med', gml: 1.42 },
  };
  const MATERIALY = {
    PETG: { nazev: 'PETG', hustota: 1.27, prutok: 7, barva: '#2f8f83' },
    PLA: { nazev: 'PLA', hustota: 1.24, prutok: 8, barva: '#d98c2b' },
    PP: { nazev: 'PP (polypropylen)', hustota: 0.9, prutok: 5, barva: '#6f8fd0' },
  };
  const TYPY = { odmerka: 'Odměrka', sada: 'Sada odměrek' };

  const VYCHOZI = {
    verze: VERZE_FORMATU, nazev: 'Odměrka', typ: 'odmerka', material: 'PETG', kusu: 1, mezera: 8,
    jednotka: 'ml', surovina: 'mouka_hladka',
    objem: { mnozstvi: '250' },
    sada: { seznam: '1; 1/2; 1/3; 1/4' },
    tvar: { tvar: 'valec', urceni: 'pomer', pomer: 0.8, prumer: 70, uhel: 10, hloubka: 1, zaobleni: 4 },
    stena: { stena: 2, dno: 2.4, nadmira: 0, kompenzace: 0.1 },
    rukojet: { druh: 'plocha', delka: 60, sirka: 18, tl: 3.5, dirka: true, prumerDirky: 6 },
    okraj: { druh: 'zaobleni', velikost: 0.8, strany: 'obe' },
    vylevka: { pouzit: false, delka: 8, hloubka: 4 },
    popisek: { kde: 'rukojet', text: '', velikost: 7, hloubka: 0.6, obsah: '', obsahKde: 'bok', obsahVelikost: 9, velka: true },
    stupnice: { pouzit: false, krok: '50', hlavni: 2, cisla: true },
    tisk: { previs: 45 },
  };
  const MEZE = {
    kusu: [1, 24], mezera: [2, 40],
    'tvar.pomer': [0.15, 3], 'tvar.prumer': [8, 250], 'tvar.uhel': [0, 40], 'tvar.hloubka': [0.2, 1], 'tvar.zaobleni': [0, 30],
    'stena.stena': [0.4, 10], 'stena.dno': [0.4, 15], 'stena.nadmira': [0, 60], 'stena.kompenzace': [-0.5, 1],
    'rukojet.delka': [10, 200], 'rukojet.sirka': [6, 60], 'rukojet.tl': [1.2, 15], 'rukojet.prumerDirky': [2, 30],
    'popisek.velikost': [2, 30], 'popisek.hloubka': [0.2, 3], 'popisek.obsahVelikost': [3, 30],
    'okraj.velikost': [0.2, 6], 'vylevka.delka': [3, 30], 'vylevka.hloubka': [1, 25],
    'stupnice.hlavni': [1, 10], 'tisk.previs': [20, 70],
  };
  const VYCTY = {
    typ: Object.keys(TYPY), material: Object.keys(MATERIALY), jednotka: Object.keys(JEDNOTKY), surovina: Object.keys(SUROVINY),
    'tvar.tvar': ['valec', 'kuzel', 'miska'], 'tvar.urceni': ['pomer', 'prumer'],
    'rukojet.druh': ['plocha', 'ucho', 'zadna'], 'popisek.kde': ['rukojet', 'dno', 'nikde'], 'popisek.obsahKde': ['bok', 'popisek'],
    'okraj.druh': ['rovny', 'zaobleni', 'srazeni'], 'okraj.strany': ['obe', 'vne', 'uvnitr'],
  };
  const TEXTY = new Set(['nazev', 'objem.mnozstvi', 'sada.seznam', 'popisek.text', 'popisek.obsah', 'stupnice.krok']);
  /** Nabídka k poli „Na co je“. */
  const OBSAHY = ['sůl', 'cukr', 'mouka', 'rýže', 'káva', 'čaj', 'kakao', 'vločky', 'krupice', 'čočka', 'mák', 'kokos', 'strouhanka',
    'droždí', 'prášek do pečiva', 'koření', 'pepř', 'těstoviny', 'luštěniny', 'semínka', 'ořechy', 'granule', 'prací prášek'];
  const CELA = new Set(['kusu', 'stupnice.hlavni']);

  /** Doplní chybějící hodnoty, ořízne meze a výčty; hlaseni = co se změnilo. */
  function normalizuj(vstup) {
    const p = kopie(VYCHOZI), hlaseni = [];
    const v = vstup && typeof vstup === 'object' ? vstup : {};
    const projdi = (vzor, zdroj, cesta) => {
      for (const k of Object.keys(vzor)) {
        const c = cesta ? cesta + '.' + k : k, h = zdroj ? zdroj[k] : undefined;
        if (vzor[k] && typeof vzor[k] === 'object') { projdi(vzor[k], h && typeof h === 'object' ? h : null, c); continue; }
        if (h === undefined) continue;
        if (typeof vzor[k] === 'boolean') { poloz(p, c, !!h); continue; }
        if (TEXTY.has(c)) { poloz(p, c, String(h).slice(0, 200)); continue; }
        if (VYCTY[c]) { if (VYCTY[c].includes(h)) poloz(p, c, h); else hlaseni.push(`neznámá volba ${c} = ${h}`); continue; }
        let x = cislo(h, NaN);
        if (!Number.isFinite(x)) { hlaseni.push(`${c}: neplatné číslo`); continue; }
        const m = MEZE[c];
        if (CELA.has(c)) x = Math.round(x);
        if (m && (x < m[0] || x > m[1])) { const y = Math.min(m[1], Math.max(m[0], x)); hlaseni.push(`${c} omezeno na ${fmt(y, 2)}`); x = y; }
        poloz(p, c, x);
      }
    };
    projdi(VYCHOZI, v, '');
    p.verze = VERZE_FORMATU;
    return { p, hlaseni };
  }

  /* ---------- množství: „250“, „0,5“, „1/3“, „1 1/2“, „1½“, volitelně s jednotkou („2 tbsp“) ---------- */
  const ZLOMKY = { '½': ' 1/2', '⅓': ' 1/3', '⅔': ' 2/3', '¼': ' 1/4', '¾': ' 3/4', '⅛': ' 1/8' };
  function ctiCislo(s) {
    const t = String(s ?? '').replace(/[½⅓⅔¼¾⅛]/g, z => ZLOMKY[z]).replace(/,/g, '.').trim();
    const m = t.match(/^(?:(\d+(?:\.\d+)?)\s+)?(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/);
    if (!m || (m[1] && !m[3])) return NaN;
    const x = m[3] ? Number(m[2]) / Number(m[3]) : Number(m[2]);
    return (m[1] ? Number(m[1]) : 0) + x;
  }
  /** Položka „množství [jednotka]“ → { hodnota, jednotka, ml, text } nebo { chyba }. */
  function ctiMnozstvi(s, vychoziJedn, surovina) {
    const t = String(s ?? '').trim();
    const m = t.match(/^(.*?)\s*([a-zA-Zá-žÁ-Ž][a-zA-Zá-žÁ-Ž .]*)?$/);
    const jm = m && m[2] ? m[2].trim().toLowerCase() : '';
    const jedn = jm ? (JEDNOTKY[jm] ? jm : ALIASY[jm] || (jm === 'floz' ? 'floz' : null)) : vychoziJedn;
    if (!jedn) return { chyba: `neznámá jednotka „${m[2].trim()}“` };
    const x = ctiCislo(m ? m[1] : '');
    if (!(x > 0)) return { chyba: t ? `„${t}“ není kladné množství` : 'chybí množství' };
    const J = JEDNOTKY[jedn];
    const ml = J.ml ? x * J.ml : x / SUROVINY[surovina].gml;
    const cislo = (m[1] || '').trim().replace(/\s+/g, ' ');
    return { hodnota: x, jednotka: jedn, ml, text: `${cislo} ${J.kratce}` };
  }
  /** Číslo jako zlomek (½, ⅓, ¼, ⅛ – jako „1/2“) nebo desetinné. */
  function zlomek(x) {
    const cele = Math.floor(x + 1e-9), zb = x - cele;
    if (zb < 1e-6) return String(cele);
    for (const d of [2, 3, 4, 8]) {
      const n = Math.round(zb * d);
      if (Math.abs(zb - n / d) < 1e-6) { let a = n, b = d; while (b) [a, b] = [b, a % b]; return (cele ? cele + ' ' : '') + `${n / a}/${d / a}`; }
    }
    return fmt(x, 2);
  }

  /* ---------- dutina: profil (r, z) od osy na dně až po jmenovitou hladinu ---------- */
  const segKruh = r => Math.max(48, Math.min(180, Math.ceil(2 * Math.PI * Math.abs(r) / 0.5)));
  /** Revolve dělá vepsaný n-úhelník – poloměry se zvětší, aby objem seděl s kruhem. */
  const opravaKruhu = n => Math.sqrt(2 * Math.PI / (n * Math.sin(2 * Math.PI / n)));
  /** Objem rotačního tělesa pod lomenou čarou (z neklesá), volitelně jen do výšky zDo. */
  function objemProfilu(pts, zDo = Infinity) {
    let V = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      let [r1, z1] = pts[i], [r2, z2] = pts[i + 1];
      if (z1 >= zDo || z2 <= z1) continue;
      if (z2 > zDo) { r2 = r1 + (r2 - r1) * (zDo - z1) / (z2 - z1); z2 = zDo; }
      V += Math.PI / 3 * (z2 - z1) * (r1 * r1 + r1 * r2 + r2 * r2);
    }
    return V;
  }
  /** Poloměr lomené čáry ve výšce z (nad nejvyšším bodem = poslední poloměr). */
  function polomerV(pts, z) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [r1, z1] = pts[i], [r2, z2] = pts[i + 1];
      if (z2 > z1 && z >= z1 && z <= z2) return r1 + (r2 - r1) * (z - z1) / (z2 - z1);
    }
    return pts[pts.length - 1][0];
  }
  function profilDutiny(tv, prm) {
    if (tv.tvar === 'miska') {
      const { Rs, q } = prm, a0 = -Math.PI / 2, a1 = Math.asin(q - 1);
      const n = Math.max(8, Math.ceil((a1 - a0) * Rs / 0.5)), pts = [[0, 0]];
      for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([Rs * Math.cos(a), Rs + Rs * Math.sin(a)]); }
      return pts;
    }
    const { R0, h } = prm, al = (tv.tvar === 'kuzel' ? tv.uhel : 0) * RAD, ta = Math.tan(al);
    const tp = Math.tan((Math.PI / 2 - al) / 2);
    const f = Math.min(tv.zaobleni, h * 0.45, R0 * 0.8 / tp);
    if (f < 0.05) return [[0, 0], [R0, 0], [R0 + h * ta, h]];
    const d = f * tp, pts = [[0, 0]], n = 10;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI / 2 - al) * i / n; pts.push([R0 - d + f * Math.cos(a), f + f * Math.sin(a)]); }
    pts.push([R0 + h * ta, h]);
    return pts;
  }
  /** Horní hrana stěny: konec lomené čáry se zaoblí / srazí do vodorovného okraje.
      smer +1 = vnitřní hrana (dutina se rozšiřuje ven), −1 = vnější (stěna se stahuje dovnitř). */
  function hrana(pts, s, druh, smer) {
    const top = pts[pts.length - 1][1];
    s = Math.min(s, 0.4 * (top - pts[0][1]));
    if (druh === 'rovny' || !(s > 0.05)) return pts;
    const zA = top - s, out = [];
    for (const q of pts) { if (q[1] < zA - 1e-9) out.push(q); else break; }
    const rA = polomerV(pts, zA);
    out.push([rA, zA]);
    if (druh === 'srazeni') out.push([rA + smer * s, top]);
    else for (let i = 1; i <= 8; i++) { const a = Math.PI / 2 * i / 8; out.push([rA + smer * s * (1 - Math.cos(a)), zA + s * Math.sin(a)]); }
    return out;
  }
  const chybaPole = (text, pole) => Object.assign(new Error(text), { pole });
  /** Bisekce rostoucí funkce. */
  function pulka(fn, a, b, cil) {
    for (let i = 0; i < 100; i++) { const m = (a + b) / 2; if (fn(m) < cil) a = m; else b = m; }
    return (a + b) / 2;
  }
  /** Rozměry dutiny pro objem V (mm³); hr = { s, druh } – zaoblená/sražená vnitřní hrana započtená do objemu.
      → { pts (i s hranou), h, rTop (stěna nahoře bez hrany), rDno } */
  function navrhDutiny(tv, V, hr) {
    const sHranou = pts => (hr ? hrana(pts, hr.s, hr.druh, 1) : pts);
    const vys = prm => { const pts = sHranou(profilDutiny(tv, prm)); return { pts, V: objemProfilu(pts) }; };
    let prm;
    if (tv.tvar === 'miska') {
      if (tv.urceni === 'pomer') {
        const q = tv.hloubka, f = Rs => vys({ Rs, q }).V;
        if (f(400) < V) throw chybaPole('Objem je na kulovou misku příliš velký.', 'objem.mnozstvi');
        prm = { Rs: pulka(f, 0.2, 400, V), q };
      } else {
        const a = tv.prumer / 2, P = q => ({ Rs: a / Math.sqrt(q * (2 - q)), q }), f = q => vys(P(q)).V;
        if (f(1) < V) throw chybaPole(`Do kulové misky o průměru ${fmt(tv.prumer)} mm se vejde nejvýš ${fmt(f(1) / 1000, 1)} ml (polokoule) – zvětšete průměr.`, 'tvar.prumer');
        prm = P(pulka(f, 0.01, 1, V));
      }
    } else {
      const ta = tv.tvar === 'kuzel' ? Math.tan(tv.uhel * RAD) : 0;
      if (tv.urceni === 'pomer') {
        const z = 1 - 2 * tv.pomer * ta;
        if (z < 0.15) throw chybaPole('Kužel s tímto úhlem a poměrem by se ke dnu zúžil do špičky – zmenšete úhel stěny nebo poměr výšky.', ta > 0.2 ? 'tvar.uhel' : 'tvar.pomer');
        const P = Rt => ({ R0: Rt * z, h: 2 * tv.pomer * Rt }), f = Rt => vys(P(Rt)).V;
        if (f(400) < V) throw chybaPole('Objem je příliš velký.', 'objem.mnozstvi');
        prm = P(pulka(f, 0.2, 400, V));
      } else {
        const Rt = tv.prumer / 2, hMax = ta > 0 ? Math.min(1000, Rt * 0.85 / ta) : 1000;
        const P = h => ({ R0: Rt - h * ta, h }), f = h => vys(P(h)).V;
        if (f(hMax) < V) throw chybaPole(ta > 0 ? `Při průměru ${fmt(tv.prumer)} mm se objem nevejde (kužel by se ke dnu zúžil do špičky) – zvětšete průměr nebo zmenšete úhel.`
          : `Při průměru ${fmt(tv.prumer)} mm se objem nevejde – zvětšete průměr.`, 'tvar.prumer');
        prm = P(pulka(f, 0.01, hMax, V));
      }
    }
    const zakl = profilDutiny(tv, prm), top = zakl[zakl.length - 1];
    return { pts: sHranou(zakl), h: top[1], rTop: top[0], rDno: tv.tvar === 'miska' ? 0 : prm.R0, prm };
  }

  /* ---------- odvozené hodnoty ---------- */
  /** Seznam kusů: [{ ml, text, popis }] + chyby položek. */
  function polozky(p) {
    const vstup = p.typ === 'sada' ? String(p.sada.seznam).split(/[;\n]|,\s+/).map(s => s.trim()).filter(Boolean) : [p.objem.mnozstvi];
    const out = [], chyby = [];
    for (const s of vstup) {
      const m = ctiMnozstvi(s, p.jednotka, p.surovina);
      if (m.chyba) chyby.push(m.chyba);
      else out.push(Object.assign(m, { popis: m.text + (m.jednotka === 'g' ? ' – ' + SUROVINY[p.surovina].nazev.toLowerCase() : '') }));
    }
    if (p.typ === 'odmerka' && out[0] && p.popisek.text.trim()) out[0].text = p.popisek.text.trim();
    return { out: out.slice(0, 16), chyby: vstup.length > 16 ? [...chyby, 'sada má nejvýš 16 odměrek – další se vynechají'] : chyby };
  }

  /** Geometrie jednoho kusu (bez manifoldu). */
  function geometrie(p, pol) {
    const tv = p.tvar, st = p.stena, t = st.stena, dno = st.dno, ok = p.okraj;
    // horní okraj: obě hrany se vejdou do šířky stěny (zmenšené o kompenzaci)
    const sirOkraje = t - Math.max(0, st.kompenzace), dvojice = ok.strany === 'obe';
    const sOkraj = ok.druh === 'rovny' ? 0 : Math.min(ok.velikost, sirOkraje * (dvojice ? 0.48 : 0.9));
    const hrIn = sOkraj > 0 && ok.strany !== 'vne' ? { s: sOkraj, druh: ok.druh } : null;
    const hrOut = sOkraj > 0 && ok.strany !== 'uvnitr' ? { s: sOkraj, druh: ok.druh } : null;
    const dut = navrhDutiny(tv, pol.ml * 1000, st.nadmira > 0 ? null : hrIn);
    const al = tv.tvar === 'kuzel' ? tv.uhel * RAD : 0, ta = Math.tan(al);
    const hTot = dut.h + st.nadmira, zTop = dno + hTot;
    const rTopTot = tv.tvar === 'kuzel' ? dut.rTop + st.nadmira * ta : dut.rTop;
    // dutina v souřadnicích odměrky (s nadměrkem nad hladinou)
    let dutina = dut.pts.map(([r, z]) => [r, z + dno]);
    if (st.nadmira > 0) { dutina.push([rTopTot, zTop]); if (hrIn) dutina = hrana(dutina, hrIn.s, hrIn.druh, 1); }
    let vnejsi, rOut;
    const g0 = {};
    if (tv.tvar === 'miska') {
      let rb = 0.5 * rTopTot;
      for (const [r, z] of dutina) rb = Math.max(rb, r + t - z);
      const rv = rTopTot + t, zk = rv - rb;
      rOut = z => (zk <= 0.01 ? rb : Math.min(rb + z, rv));
      vnejsi = zk <= 0.01 ? [[0, 0], [rb, 0], [rb, zTop]] : [[0, 0], [rb, 0], [rv, zk], [rv, zTop]];
      g0.pasOd = zk;
    } else {
      const tw = t / Math.cos(al), r0 = dut.rDno - dno * ta + tw, c = Math.min(0.6, r0 * 0.2, dno * 0.5);
      rOut = z => r0 + z * ta;
      vnejsi = [[0, 0], [r0 - c, 0], [rOut(c), c], [rOut(zTop), zTop]];
      g0.pasOd = c;
    }
    if (hrOut) vnejsi = hrana(vnejsi, hrOut.s, hrOut.druh, -1);
    vnejsi.push([0, zTop]);
    g0.pasDo = zTop - (hrOut ? hrOut.s : 0);
    const rMax = rOut(zTop);
    const V = pol.ml * 1000;
    // citlivost: o kolik % se změní objem, když je dutina o 0,1 mm širší na poloměru i hlubší
    const citlivost = 100 * ((objemProfilu(dut.pts.map(([r, z]) => [r > 0 ? r + 0.1 : 0, z])) + Math.PI * dut.rTop ** 2 * 0.1) / V - 1);
    const g = Object.assign(g0, { pol, dut, dutina, vnejsi, rOut, rMax, hTot, zTop, dno, t, al, ta, rTopTot, citlivost, sOkraj,
      sOkrajChtene: ok.druh === 'rovny' ? 0 : ok.velikost });

    // ucho: obrys v rovině XZ, spodek pod 45°, otvor se střechou 45° (tisk bez podpor)
    const ru = p.rukojet;
    if (ru.druh === 'ucho') {
      const zHigh = zTop - Math.max(1, hrOut ? hrOut.s : 0), zLow = Math.max(dno + 1, zHigh - Math.max(ru.tl * 2 + 12, 0.75 * hTot));
      const xw = rOut(zLow) - Math.min(1, t * 0.5), xe = rOut(zHigh) + ru.delka;
      const x0 = rOut(zHigh), x1 = xe - ru.tl, z0 = zLow + ru.tl, z1 = zHigh - ru.tl, zr = z1 - (x1 - x0) / 2;
      g.ucho = { zLow, zHigh, xw, xe, x0, x1, z0, z1, zr, svetlost: [x1 - x0, z1 - z0] };
    }
    if (ru.druh === 'plocha') {
      const rH = rOut(ru.tl), xEnd = rH + ru.delka - ru.sirka / 2;
      g.rukojet = { rH, xEnd, textOd: rH + 2, textDo: ru.dirka ? xEnd - ru.prumerDirky / 2 - 2 : xEnd + ru.sirka / 2 - 2.5, textV: ru.sirka - 3 };
    }

    // stupnice (jen u jedné odměrky): rysky po kroku v jednotce odměrky
    if (p.typ === 'odmerka' && p.stupnice.pouzit) {
      const krok = ctiMnozstvi(p.stupnice.krok, pol.jednotka, p.surovina);
      g.rysky = [];
      if (!krok.chyba) {
        const mlNaJedn = pol.ml / pol.hodnota, krokMl = krok.ml, Vn = objemProfilu(dut.pts);
        for (let i = 1; i * krokMl < pol.ml * (1 - 1e-6) && i <= 200; i++) {
          const v = i * krokMl * 1000, z = pulka(zz => objemProfilu(dut.pts, zz), 0, dut.h, v * Vn / V);
          g.rysky.push({ z: z + dno, dlouha: i % p.stupnice.hlavni === 0, text: zlomek(i * krokMl / mlNaJedn) });
        }
        if (st.nadmira > 0) g.rysky.push({ z: zTop - st.nadmira, dlouha: true, text: zlomek(pol.hodnota) });
        g.krokZ = g.rysky.length > 1 ? Math.min(...g.rysky.slice(1).map((r, i) => r.z - g.rysky[i].z)) : dut.h;
        g.rysky = g.rysky.filter(r => r.z > dno + 1.5);
      } else g.krokChyba = krok.chyba;
    }
    return g;
  }

  function odvozene(p) {
    const { out, chyby } = polozky(p);
    const o = { mat: MATERIALY[p.material], chybyPolozek: chyby, kusy: [], chyba: null };
    if (!out.length) { o.chyba = { text: chyby[0] || 'Zadejte objem.', pole: p.typ === 'sada' ? 'sada.seznam' : 'objem.mnozstvi' }; return o; }
    try { o.kusy = out.map(pol => geometrie(p, pol)); } catch (e) { o.chyba = { text: e.message, pole: e.pole || null }; }
    return o;
  }

  /** Text „na co to je“ (sůl, mouka…), případně velkými písmeny. */
  const textObsahu = p => { const t = p.popisek.obsah.trim(); return p.popisek.velka ? t.toLocaleUpperCase('cs') : t; };

  /* ---------- kontroly ---------- */
  function kontroly(p) {
    const h = [];
    const add = (uroven, text, pole) => h.push({ uroven, text, pole: pole || null });
    const o = odvozene(p);
    const poleObjemu = p.typ === 'sada' ? 'sada.seznam' : 'objem.mnozstvi';
    for (const c of o.chybyPolozek) add('chyba', 'Objem: ' + c + '.', poleObjemu);
    if (o.chyba) { add('chyba', o.chyba.text, o.chyba.pole); return h; }
    const st = p.stena, ru = p.rukojet, pk = p.popisek;
    for (const g of o.kusy) {
      if (g.pol.ml < 1) add('chyba', `${g.pol.popis}: méně než 1 ml se tiskem odměřit nedá.`, poleObjemu);
      else if (g.citlivost > 3) add('varovani', `${g.pol.popis}: malá odměrka – odchylka tisku 0,1 mm změní objem o ${fmt(g.citlivost, 1)} %. Ověřte vážením vody a dolaďte kompenzaci.`, 'stena.kompenzace');
      if (g.pol.ml > 2000) add('info', `${g.pol.popis}: velká odměrka – tisk potrvá dlouho, zvažte širší trysku.`, poleObjemu);
    }
    if (st.stena < 0.8) add('chyba', 'Stěna pod 0,8 mm – odměrka bude prosakovat a praskat.', 'stena.stena');
    else if (st.stena < 1.2) add('varovani', 'Tenká stěna – aspoň 1,2 mm (3 perimetry s tryskou 0,4), jinak je odměrka křehká.', 'stena.stena');
    if (st.dno < 0.8) add('chyba', 'Dno pod 0,8 mm – bude prosakovat.', 'stena.dno');
    else if (st.dno < 1.2) add('varovani', 'Tenké dno – doporučeno aspoň 1,2 mm.', 'stena.dno');
    if (p.tvar.tvar === 'kuzel' && p.tvar.uhel > p.tisk.previs) add('varovani', `Stěna kužele (${fmt(p.tvar.uhel)}°) přesahuje největší převis tiskárny ${fmt(p.tisk.previs)}° – bude potřebovat podpěry.`, 'tvar.uhel');
    if (p.tvar.tvar !== 'miska' && p.tvar.urceni === 'pomer' && p.tvar.pomer > 2) add('info', 'Úzká a vysoká odměrka se špatně plní i myje.', 'tvar.pomer');
    const g0 = o.kusy[0];
    if (ru.druh === 'plocha') {
      if (ru.dirka && ru.prumerDirky > ru.sirka - 3) add('chyba', 'Dírka na kroužek je širší než rukojeť minus 2 × 1,5 mm.', 'rukojet.prumerDirky');
      if (ru.tl < 2.5) add('varovani', 'Tenká rukojeť se může ohnout – aspoň 2,5 mm.', 'rukojet.tl');
    }
    if (ru.druh === 'ucho') {
      for (const g of o.kusy) {
        const u = g.ucho;
        if (u.x1 - u.x0 < 3 || u.zr - u.z0 < 2) { add('chyba', `${g.pol.popis}: ucho je na tak nízkou odměrku příliš malé – zvětšete vyložení nebo zvolte plochou rukojeť.`, 'rukojet.delka'); break; }
        if (u.svetlost[0] < 10 || u.svetlost[1] < 16) { add('varovani', `${g.pol.popis}: do ucha se nevejde prst (světlost ${fmt(u.svetlost[0])} × ${fmt(u.svetlost[1])} mm).`, 'rukojet.delka'); break; }
      }
    }
    const ok = p.okraj, vy = p.vylevka;
    if (ok.druh !== 'rovny' && g0.sOkraj < g0.sOkrajChtene - 1e-6) add('info', `${ok.druh === 'zaobleni' ? 'Zaoblení' : 'Sražení'} okraje zmenšeno na ${fmt(g0.sOkraj, 2)} mm – víc se do stěny nevejde.`, 'okraj.velikost');
    if (vy.pouzit) {
      if (vy.hloubka > st.nadmira + 1e-9) add('varovani', `Žlábek výlevky (${fmt(vy.hloubka)} mm) je hlouběji než ryska – po okraj se vejde méně. Nastavte nadměrek aspoň ${fmt(vy.hloubka)} mm, nebo žlábek změlčete.`, 'vylevka.hloubka');
      if (ru.druh === 'plocha') add('info', 'Výlevka je naproti rukojeti; s plochou rukojetí u dna se lije hůř – zvažte ucho.', 'rukojet.druh');
    }
    const obsah = textObsahu(p);
    if (obsah && pk.obsahKde === 'bok' && pk.hloubka > st.stena - st.kompenzace - 0.8) add('varovani', `Nápis na boku se vyryje jen ${fmt(Math.max(0.3, st.stena - st.kompenzace - 0.8), 1)} mm hluboko – ve stěně musí zůstat aspoň 0,8 mm.`, 'popisek.hloubka');
    if (obsah && pk.obsahKde === 'popisek' && pk.kde === 'nikde') add('info', 'Nápis „k popisku“ potřebuje zapnutý popisek (na rukojeť nebo do dna) – jinak se vyryje na bok.', 'popisek.obsahKde');
    if (pk.kde !== 'nikde') {
      const kde = pk.kde === 'rukojet' && ru.druh === 'plocha' ? 'rukojet' : 'dno';
      if (pk.kde === 'rukojet' && ru.druh !== 'plocha') add('info', 'Popisek jde na rukojeť jen u ploché – vyryje se do dna (zrcadlově, čte se zespodu).', 'popisek.kde');
      if (kde === 'dno' && pk.hloubka > st.dno - 0.8) add('chyba', 'Popisek ve dně by se prořízl skoro skrz – zmenšete hloubku nebo zesilte dno.', 'popisek.hloubka');
      if (kde === 'rukojet' && pk.hloubka > ru.tl - 1.2) add('chyba', 'Popisek v rukojeti je hlubší, než rukojeť snese (zbude méně než 1,2 mm).', 'popisek.hloubka');
    }
    if (p.typ === 'odmerka' && p.stupnice.pouzit) {
      if (g0.krokChyba) add('chyba', 'Krok stupnice: ' + g0.krokChyba + '.', 'stupnice.krok');
      else if (!g0.rysky.length) add('varovani', 'Krok stupnice je větší než objem – žádná ryska.', 'stupnice.krok');
      else if (g0.rysky.length > 40) add('varovani', `${g0.rysky.length} rysek je moc – zvětšete krok.`, 'stupnice.krok');
      else if (g0.krokZ < 2.5) add('varovani', `Rysky jsou jen ${fmt(g0.krokZ)} mm od sebe – splynou.`, 'stupnice.krok');
      if (p.stupnice.cisla && st.stena - st.kompenzace < 1.6) add('varovani', 'Čísla stupnice se vyrývají zvenku proti ryskám – stěna pod 1,6 mm je pro ně tenká (čísla se vynechají).', 'stena.stena');
      if (p.tvar.tvar === 'miska') add('info', 'Stupnice v kulové misce: rysky u dna jsou vodorovné a hůř se čtou.', 'tvar.tvar');
    }
    if (p.material === 'PLA') add('info', 'PLA měkne kolem 55 °C – nemýt v myčce ani horkou vodou, nenabírat horké.', 'material');
    if (!h.some(x => x.uroven === 'chyba' || x.uroven === 'varovani')) h.unshift({ uroven: 'ok', text: 'Bez chyb a varování – odměrka se tiskne dnem dolů bez podpor.', pole: null });
    add('info', 'Do styku s potravinami: filament s certifikací pro potraviny, tryska bez olova, hlavně na suché suroviny; spáry mezi vrstvami se špatně myjí.', null);
    return h;
  }

  /* ---------- stavba přes manifold ---------- */
  function postav(w, p, font) {
    const { Manifold: M, CrossSection: CS } = w;
    const smaz = [];
    const k = x => { smaz.push(x); return x; };
    const o = odvozene(p);
    if (o.chyba) throw new Error(o.chyba.text);
    const upozorneni = [];
    const sit = (m, nazev, barva, druh) => {
      const st = m.status();
      if (st !== 'NoError') throw new Error(`${nazev}: manifold hlásí ${st}`);
      if (m.isEmpty()) throw new Error(`${nazev}: výsledné těleso je prázdné – zkontrolujte rozměry`);
      const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
      const poz = new Float32Array(vp.length / np * 3);
      for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { poz[j] = vp[i]; poz[j + 1] = vp[i + 1]; poz[j + 2] = vp[i + 2]; }
      return { nazev, barva, druh, poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), plocha: m.surfaceArea(), rod: m.genus() };
    };
    /** Text z písma jako 2D (výška verzálky cap, volitelně zrcadlově). */
    const rozvrh = text => (font ? klic().rozvrhniText(font, text, {}) : null);
    const textCS = (roz, cap, zrcadlo) => {
      const poly = roz.obrysy.map(ob => ob.map(([x, y]) => [(zrcadlo ? -x : x) * cap, y * cap]));
      return k(k(new CS(poly, 'NonZero')).simplify(0.004));
    };
    /** Text vyrytý do vnějšího pláště, obtočený po obvodu: střed na úhlu uhel (°) a výšce zc, hloubka hl.
        Text se zjemní a ohne přes warp (x → úhel, y → výška, tloušťka → poloměr), takže hloubka je všude stejná. */
    const rytinaPlast = (g, roz, cap, uhel, zc, hl) => {
      const R0 = g.rOut(zc), a0 = uhel * RAD;
      const m = k(k(textCS(roz, cap, false).extrude(hl + 1)).refineToLength(0.8));
      return k(m.warp(v => {
        const z = zc + v[1], rho = g.rOut(z) - hl + v[2], a = a0 + v[0] / R0;
        v[0] = rho * Math.cos(a); v[1] = rho * Math.sin(a); v[2] = z;
      }));
    };
    const pk = p.popisek, ru = p.rukojet;

    function postavKus(g) {
      const n = segKruh(g.rMax), c = opravaKruhu(n);
      const rev = (pts, stupne) => k(M.revolve(k(new CS([pts.map(([r, z]) => [Math.max(0, r) * c, z])], 'NonZero')), n, stupne || 360));
      let telo = rev(g.vnejsi);
      const pridat = [], odeb = [];
      if (ru.druh === 'plocha') {
        const r = g.rukojet, s = ru.sirka;
        const tvar = k(k(k(CS.square([r.xEnd, s])).translate([0, -s / 2])).add(k(k(CS.circle(s / 2, 48)).translate([r.xEnd, 0]))));
        pridat.push(k(tvar.extrude(ru.tl)));
        if (ru.dirka) odeb.push(k(k(k(CS.circle(ru.prumerDirky / 2, 40)).extrude(ru.tl + 2)).translate([r.xEnd, 0, -1])));
      }
      if (ru.druh === 'ucho') {
        const u = g.ucho, d = u.xe - u.xw;
        let obr = k(new CS([[[u.xw, u.zLow - d], [u.xe, u.zLow], [u.xe, u.zHigh], [u.xw, u.zHigh]]], 'NonZero'));
        obr = k(k(obr.offset(-1.5, 'Round', 2, 24)).offset(1.5, 'Round', 2, 24));
        obr = k(obr.intersect(k(k(CS.square([d + 4, u.zHigh + 2])).translate([u.xw - 2, 0]))));
        if (u.x1 - u.x0 >= 3 && u.zr - u.z0 >= 2) {
          const otvor = k(new CS([[[u.x0, u.z0], [u.x1, u.z0], [u.x1, u.zr], [(u.x0 + u.x1) / 2, u.z1], [u.x0, u.zr]]], 'NonZero'));
          obr = k(obr.subtract(otvor));
        }
        pridat.push(k(k(k(obr.extrude(ru.sirka)).rotate([90, 0, 0])).translate([0, ru.sirka / 2, 0])));
      }

      // dutina (kompenzace zvětší poloměr, dno zůstává) + 1 mm nad okraj
      const km = p.stena.kompenzace, dut = g.dutina.map(([r, z]) => [r > 0 ? r + km : 0, z]);
      const vrch = dut[dut.length - 1];
      odeb.push(rev([...dut, [vrch[0] + g.ta, vrch[1] + 1], [0, vrch[1] + 1]]));

      // popisek (objem, případně i „na co to je“ jako druhý řádek) na rukojeť nebo zrcadlově do dna
      const obsah = textObsahu(p), naBok = obsah && (pk.obsahKde === 'bok' || pk.kde === 'nikde');
      const radky = pk.kde === 'nikde' ? [] : [g.pol.text, obsah && !naBok ? obsah : ''].filter(Boolean);
      if ((radky.length || naBok || (g.rysky && g.rysky.length && p.stupnice.cisla)) && !font) upozorneni.push({ uroven: 'info', text: 'Písmo se ještě načítá – popisky a čísla se doplní.', pole: null });
      if (radky.length && font) {
        const roz = rozvrh(radky.join('\n'));
        if (roz.chybi.length) upozorneni.push({ uroven: 'varovani', text: `Písmo nemá znaky ${roz.chybi.join(' ')} – vynechají se.`, pole: 'popisek.text' });
        if (roz.obrysy.length) {
          if (pk.kde === 'rukojet' && ru.druh === 'plocha') {
            const r = g.rukojet, sir = r.textDo - r.textOd;
            const cap = Math.min(pk.velikost, sir / roz.sirka, r.textV / roz.vyska);
            if (cap < 2.5) upozorneni.push({ uroven: 'varovani', text: `${g.pol.popis}: popisek se na rukojeť nevejde (výška písma by byla ${fmt(cap)} mm) – prodlužte rukojeť nebo zkraťte text.`, pole: 'rukojet.delka' });
            else odeb.push(k(k(textCS(roz, cap, false).extrude(pk.hloubka + 1)).translate([(r.textOd + r.textDo) / 2, 0, ru.tl - pk.hloubka])));
          } else {
            const Rf = g.rOut(0) - 2.5, cap = Math.min(pk.velikost, 2 * Rf / Math.hypot(roz.sirka, roz.vyska));
            if (cap < 2.5) upozorneni.push({ uroven: 'varovani', text: `${g.pol.popis}: popisek se na dno nevejde (výška písma ${fmt(cap)} mm).`, pole: 'popisek.velikost' });
            else odeb.push(k(k(textCS(roz, cap, true).extrude(pk.hloubka + 1)).translate([0, 0, -1])));
          }
        }
      }

      // nápis na boku (strana −Y, naproti stupnici): obtočený po plášti
      if (naBok && font) {
        const roz = rozvrh(obsah);
        if (roz.chybi.length) upozorneni.push({ uroven: 'varovani', text: `Písmo nemá znaky ${roz.chybi.join(' ')} – vynechají se.`, pole: 'popisek.obsah' });
        const zOd = Math.max(g.pasOd, ru.druh === 'plocha' ? ru.tl : 0) + 1.5, zDo = g.pasDo - 1.5, zc = (zOd + zDo) / 2;
        const R = g.rOut(zc), oblouk = R * 110 * RAD;       // nejvýš 110° – nezasáhne ucho ani výlevku
        const cap = roz.obrysy.length ? Math.min(pk.obsahVelikost, (zDo - zOd) / roz.vyska, oblouk / roz.sirka) : 0;
        const hl = Math.max(0.3, Math.min(pk.hloubka, p.stena.stena - km - 0.8));
        if (cap < 3) upozorneni.push({ uroven: 'varovani', text: `${g.pol.popis}: nápis „${obsah}“ se na bok nevejde (výška písma ${fmt(cap)} mm) – zkraťte ho nebo dejte k popisku.`, pole: 'popisek.obsah' });
        else odeb.push(rytinaPlast(g, roz, cap, -90, zc, hl));
      }

      // výlevka naproti rukojeti (−X): zobáček se spodkem pod 45° a žlábek V 45°
      if (p.vylevka.pouzit) {
        const vy = p.vylevka, zT = g.zTop, rO = g.rOut(zT), rI = g.rTopTot + km;
        const w = Math.max(10, Math.min(36, 0.5 * rI)), xs = -(rI - 1), xt = -(rO + vy.delka);   // tělo začíná v dutině, ta ho pak ořízne
        const zTipDole = zT - vy.hloubka - 1.6, zStenaDole = Math.max(0, zTipDole - (xs - xt)), tw = Math.max(2.5, w * 0.25);
        pridat.push(k(M.hull([[xs, -w / 2, zT], [xs, w / 2, zT], [xs, -w / 2, zStenaDole], [xs, w / 2, zStenaDole],
          [xt, -tw, zT], [xt, tw, zT], [xt, -tw, Math.max(0, zTipDole)], [xt, tw, Math.max(0, zTipDole)]])));
        const zl = (x, pul) => { const b = Math.max(0, pul - vy.hloubka - 1); return [[x, -pul, zT + 1], [x, pul, zT + 1], [x, -b, zT - vy.hloubka], [x, b, zT - vy.hloubka]]; };
        odeb.push(k(M.hull([...zl(-(rI - 1), w / 2 - 1.6), ...zl(xt - 1, Math.max(1.2, tw - 1.2))])));
      }

      // stupnice: rysky uvnitř (žlábek V 45°) na straně +Y, čísla zvenku vedle dlouhých rysek
      if (g.rysky && g.rysky.length) {
        const hl = 0.5, cisla = p.stupnice.cisla && font && p.stena.stena - km >= 1.6;
        for (const r of g.rysky) {
          const ri = polomerV(dut, r.z), uhel = r.dlouha ? 50 : 25;
          const zl = rev([[ri - 0.3, r.z - 0.8], [ri + hl, r.z], [ri - 0.3, r.z + 0.8]], uhel);
          odeb.push(k(zl.rotate([0, 0, 90 - uhel / 2])));
          if (!cisla || !r.dlouha) continue;
          const roz = rozvrh(r.text);
          if (!roz.obrysy.length) continue;
          const cap = Math.min(5, Math.max(2.5, g.krokZ * p.stupnice.hlavni * 0.6));
          const sir = roz.sirka * cap, ro = g.rOut(r.z);
          const posun = 25 + 3 + (sir / 2 + 1) / ro / RAD;     // vpravo od konce rysky (při pohledu zvenku)
          odeb.push(rytinaPlast(g, roz, cap, 90 + posun, r.z, 0.5));
        }
      }
      if (pridat.length) telo = k(M.union([telo, ...pridat]));
      telo = k(M.difference([telo, ...odeb]));
      // nulové plátky po hullu (výlevka na rovině okraje) zahodit
      const casti = telo.decompose();
      casti.forEach(k);
      if (casti.length > 1) telo = k(M.compose(casti.filter(m => m.volume() > 1e-3)));
      return sit(telo, p.typ === 'sada' ? 'Odměrka ' + g.pol.text : p.nazev || 'Odměrka ' + g.pol.text, o.mat.barva, 'hlavni');
    }

    try {
      const kusy = o.kusy.map(g => [postavKus(g)]);
      const seznam = [];
      if (p.typ === 'sada') kusy.forEach(d => seznam.push(...d));
      else for (let i = 0; i < p.kusu; i++) seznam.push(...kusy[0].map(d => Object.assign({}, d, { nazev: p.kusu > 1 ? `${d.nazev} (${i + 1})` : d.nazev })));
      const dily = NOZ.rozloz(seznam, p.mezera);
      const unik = [], videno = new Set();
      for (const u of upozorneni) if (!videno.has(u.text)) { videno.add(u.text); unik.push(u); }
      return { kus: p.typ === 'sada' ? dily : kusy[0], kusy, dily, duchy: [], upozorneni: unik, odv: o };
    } finally {
      for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } }
    }
  }

  /* ---------- odhad hmotnosti a času (stěny tenké = plné) ---------- */
  function odhad(p, dily) {
    const mat = MATERIALY[p.material];
    let V = 0, s = 0;
    for (const d of dily) { V += d.objem; const b = NOZ.obal(d.poz); s += d.objem / mat.prutok + (b[5] - b[2]) / 0.2 * 1.5; }
    const g = V / 1000 * mat.hustota;
    return { objem: V, hmotnost: g, filament: g / mat.hustota * 1000 / (Math.PI * 0.875 * 0.875) / 1000, cas: s + 120 };
  }

  /* ---------- předvolby ---------- */
  const PREDVOLBY = [
    { nazev: 'Odměrka 250 ml s rukojetí', popis: 'válec, plochá rukojeť s dírkou a popiskem',
      p: { typ: 'odmerka', nazev: 'Odměrka 250 ml', jednotka: 'ml', objem: { mnozstvi: '250' }, tvar: { tvar: 'valec', urceni: 'pomer', pomer: 0.8, zaobleni: 4 } } },
    { nazev: 'Odměrný hrnek 500 ml se stupnicí', popis: 'mírný kužel, ucho, výlevka, rysky po 50 ml, čísla po 100 ml',
      p: { typ: 'odmerka', nazev: 'Hrnek 500 ml', jednotka: 'ml', objem: { mnozstvi: '500' }, tvar: { tvar: 'kuzel', urceni: 'pomer', pomer: 1, uhel: 6, zaobleni: 5 },
        stena: { stena: 2.4, dno: 2.4, nadmira: 10 }, okraj: { druh: 'zaobleni', velikost: 1 }, vylevka: { pouzit: true, delka: 12, hloubka: 6 },
        rukojet: { druh: 'ucho', delka: 26, sirka: 12, tl: 6 }, popisek: { kde: 'dno' }, stupnice: { pouzit: true, krok: '50', hlavni: 2, cisla: true } } },
    { nazev: 'Sada US cups 1 · ½ · ⅓ · ¼', popis: 'americké recepty, válce s rukojetí',
      p: { typ: 'sada', nazev: 'Cups', jednotka: 'cup', sada: { seznam: '1; 1/2; 1/3; 1/4' }, tvar: { tvar: 'valec', urceni: 'pomer', pomer: 0.6, zaobleni: 4 },
        rukojet: { druh: 'plocha', delka: 55, sirka: 18, tl: 3.5 } } },
    { nazev: 'Sada lžic a lžiček', popis: '1 tbsp, ½ tbsp, 1 tsp, ½ tsp, ¼ tsp – kulové misky',
      p: { typ: 'sada', nazev: 'Lžíce', jednotka: 'tsp', sada: { seznam: '1 tbsp; 1/2 tbsp; 1 tsp; 1/2 tsp; 1/4 tsp' }, tvar: { tvar: 'miska', urceni: 'pomer', hloubka: 0.85 },
        stena: { stena: 1.8, dno: 1.6 }, rukojet: { druh: 'plocha', delka: 50, sirka: 14, tl: 3, prumerDirky: 5 }, popisek: { velikost: 6, hloubka: 0.5 } } },
    { nazev: 'Metrická sada 250 – 25 ml', popis: '250, 125, 100, 50 a 25 ml, kužel 8°',
      p: { typ: 'sada', nazev: 'Metrická sada', jednotka: 'ml', sada: { seznam: '250; 125; 100; 50; 25' }, tvar: { tvar: 'kuzel', urceni: 'pomer', pomer: 0.7, uhel: 8, zaobleni: 3 } } },
    { nazev: 'Odměrka na 100 g hladké mouky', popis: 'objem podle sypné hmotnosti (≈ 189 ml)',
      p: { typ: 'odmerka', nazev: 'Mouka 100 g', jednotka: 'g', surovina: 'mouka_hladka', objem: { mnozstvi: '100' }, popisek: { obsah: 'mouka', obsahKde: 'bok' } } },
    { nazev: 'Odměrka na cukr s nápisem', popis: '100 g cukru krupice, nápis CUKR obtočený po boku, sražený okraj',
      p: { typ: 'odmerka', nazev: 'Cukr 100 g', jednotka: 'g', surovina: 'cukr_krupice', objem: { mnozstvi: '100' }, tvar: { tvar: 'kuzel', urceni: 'pomer', pomer: 0.75, uhel: 5, zaobleni: 4 },
        stena: { stena: 2.4 }, okraj: { druh: 'srazeni', velikost: 0.8 }, popisek: { obsah: 'cukr', obsahKde: 'bok', obsahVelikost: 10, hloubka: 0.8 } } },
    { nazev: 'Rýže na porci 75 g', popis: 'odměrka s uchem, „75 g RÝŽE“ na dně',
      p: { typ: 'odmerka', nazev: 'Rýže 75 g', jednotka: 'g', surovina: 'ryze', objem: { mnozstvi: '75' }, tvar: { tvar: 'valec', urceni: 'pomer', pomer: 0.9 },
        rukojet: { druh: 'ucho', delka: 22, sirka: 10, tl: 5 }, popisek: { kde: 'dno', obsah: 'rýže', obsahKde: 'popisek' } } },
    { nazev: 'Odměrka na kávu 7 g', popis: 'kulová miska na espresso, dlouhá rukojeť s nápisem',
      p: { typ: 'odmerka', nazev: 'Káva 7 g', jednotka: 'g', surovina: 'kava', objem: { mnozstvi: '7' }, tvar: { tvar: 'miska', urceni: 'pomer', hloubka: 0.8 },
        stena: { stena: 1.8, dno: 1.6 }, rukojet: { druh: 'plocha', delka: 70, sirka: 14, tl: 3 }, popisek: { velikost: 6, obsah: 'káva', obsahKde: 'popisek' } } },
  ];
  const vychoziProjekt = i => normalizuj(PREDVOLBY[i] ? PREDVOLBY[i].p : {}).p;

  /* ---------- projekt JSON ---------- */
  function ulozProjekt(p) {
    return JSON.stringify({ format: 'webapp_odmerky', verze: VERZE_FORMATU, ulozeno: new Date().toISOString(), projekt: p }, null, 2);
  }
  function nactiProjekt(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    if (!o || o.format !== 'webapp_odmerky') throw new Error('Soubor není projekt Odměrek (chybí "format": "webapp_odmerky").');
    if (!(o.verze >= 1) || o.verze > VERZE_FORMATU) throw new Error(`Nepodporovaná verze projektu ${o.verze}.`);
    return normalizuj(o.projekt);
  }

  const API = {
    VERZE_FORMATU, JEDNOTKY, SUROVINY, MATERIALY, TYPY, VYCHOZI, MEZE, VYCTY, PREDVOLBY,
    OBSAHY, kopie, vezmi, poloz, cislo, fmt, normalizuj, hrana, textObsahu, ctiCislo, ctiMnozstvi, zlomek, polozky,
    objemProfilu, polomerV, profilDutiny, navrhDutiny, segKruh, opravaKruhu, odvozene, kontroly, postav, odhad,
    vychoziProjekt, ulozProjekt, nactiProjekt,
  };
  if (uzel) module.exports = API; else window.ODM = API;
})();
