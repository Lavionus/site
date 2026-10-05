/* ============================================================
   Síně pod horou – pribeh.js: příběh předků, artefakty, Spáč, finále.

   Runové desky leží ve strážnicích (3.–5. patro) a v Síni předků
   (6. patro). Přečte je řemeslník (práce „číst“, stupeň řemesla):
   první odemkne runovou kovárnu, druhá recepty na artefakty, objevení
   Srdce hory přidá poslední úlomek. Poklad předků vynese nosič.
   Artefakty (každý jen jednou) mají trvalý účinek pro celý klan:
     kladivo – stavba a výroba 1,3× rychleji
     lampa   – v podzemí už není úplná tma (světlo aspoň 0,4)
     roh     – útok trpaslíků 1,3×
     klíč    – věc; s ní se zažehne Výheň předků = vítězství; ukovat jde
               až po dvou ze tří ostatních artefaktů
   Pradávný spáč: v 7. patře hora duní (varování). Kdo tesá v 8. patře
   bez Klíče nebo objeví Srdce bez Klíče, probudí ho předčasně (hora je
   pak neklidná: nájezdy častěji a silněji). Jinak se probudí při
   zažíhání Výhně. Zažíhání trvá 1 den (600 tahů); za něj vylezou
   z puklin Srdce dvě vlny pavouků a jdou po tom, kdo zažíhá. Nájezdy
   během zažíhání počkají. Spáč je široký: chodbou širokou 1 pole
   neprojde. Strážci na něj jdou nejméně ve třech.
   Konec: vítězství (Výheň hoří), nebo zahyne celý klan. Po vítězství
   lze hrát dál ve volném režimu (tam lze Spáče vyzvat jako bosse).
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O } = SV, C = S.cesty, PR = S.prace;
  const DEN = () => S.hra.TAHU_ZA_DEN;

  const PATRO_VAROVANI = 7, PATRO_SPACE = 8, DOBA_ZAZEHNUTI = 600, VLNY = [150, 380];
  const DEDICTVI = ['kladivo', 'lampa', 'roh'], DEDICTVI_NA_KLIC = 2;
  // odolnost Spáče = útok ozbrojených strážců / 45 (jako Srdce hory; bot: dělitel 40 a 520 ♥ = 2 z 8 her prohra ve finále)
  const SKUPINA_NA_SPACE = 3, BLIZKO_SPACE = 8, ODOLNOST_UTOK = 45;
  const ULOMKY = [
    { nadpis: 'Deska strážců', text: '„Strážili jsme cestu k Srdci. Z hlubin přišel Spáč a my mu zavřeli oči kamenem a písní. ' +
      'Kdo sestoupí do pásma Srdce bez Klíče, probudí ho. Ukujte hvězdnou ocel v runové kovárně – její plán je vyrytý pod touto runou.“',
      odemkne: 'runovaKovarna' },
    { nadpis: 'Deska Síně předků', text: '„Výheň předků hasne, když ji nikdo nekrmí hvězdnou ocelí. Klíč přijme jen klan, který znovu ' +
      'ukoval dědictví předků – aspoň dvě ze tří věcí: kladivo, lampu a roh. Pak ukujte Klíč ze tří hvězdných prutů a šperku, ' +
      'doneste ho do Srdce a zažehněte oheň. Tak se hora znovu probudí – a Spáč s ní. Buďte připraveni.“',
      odemkne: 'artefakty' },
    { nadpis: 'Runy Srdce hory', text: 'Na stěnách Srdce svítí poslední runa: „Oheň, který zažehnete, bude hořet, dokud bude žít klan.“' },
  ];
  const ARTEFAKTY = {
    kladivo: { nazev: 'Durinovo kladivo', ikona: '🔨', popis: 'stavba a výroba celého klanu 1,3× rychleji' },
    lampa:   { nazev: 'Lampa předků', ikona: '🏮', popis: 'v podzemí už není úplná tma' },
    roh:     { nazev: 'Roh hory', ikona: '📯', popis: 'útok všech trpaslíků 1,3×' },
    klic:    { nazev: 'Klíč k Srdci', ikona: '🗝️', popis: 'zažehne Výheň předků' },
  };
  const kampan = hra => hra.rezim !== 'volny';
  const zprava = (hra, typ, text, g) => PR.zprava(hra, typ, text, g);
  const xy = (sv, g) => { const l = g % sv.N; return [l % sv.W, (l / sv.W) | 0, (g / sv.N) | 0]; };
  const vyhenG = hra => { const s = hra.sv.srdce; return s.p * hra.sv.N + s.y * hra.sv.W + s.x; };
  const srdceZname = hra => !!hra.objeveno[hra.sv.srdce.oblast];
  const maKlic = hra => hra.veci.some(v => v.druh === 'klic');

  function vychozi(hra) {
    Object.assign(hra, { rezim: hra.rezim || 'kampan', prectene: [], deskyPrectene: [], artefakty: {}, zazehnuti: 0, vyhenHori: false,
      spac: { probuzen: false, porazen: false, brzy: false, id: 0, duni: -1e9, zazTik: -1e9 }, maxTrp: 0, dohrano: null });
  }

  // --- desky a poklady (jednotky práce) ------------------------------------------------------
  function jednotky(hra, pridej) {
    const sv = hra.sv;
    for (const g of hra._desky || (hra._desky = najdi(sv, O.DESKA))) {
      if (hra.deskyPrectene.includes(g) || !sv.zn[g] || !hra.objeveno[sv.oblast[g]]) continue;
      const st = PR.stojiskaKolem(sv, g, true); if (st.length) pridej({ klic: 'r' + g, druh: 'cist', cil: g, stojiste: st, prio: true });
    }
    for (const g of hra._poklady || (hra._poklady = najdi(sv, O.POKLAD))) {
      if (sv.obj[g] !== O.POKLAD || !sv.zn[g] || !hra.objeveno[sv.oblast[g]]) continue;
      const st = PR.stojiskaKolem(sv, g, true); if (st.length) pridej({ klic: 'p' + g, druh: 'poklad', cil: g, stojiste: st, prio: false });
    }
  }
  function najdi(sv, o) { const r = []; for (let g = 0; g < sv.obj.length; g++) if (sv.obj[g] === o) r.push(g); return r; }
  function prectiUlomek(hra, k) {
    if (hra.prectene.includes(k)) return;
    hra.prectene.push(k);
    const u = ULOMKY[k];
    zprava(hra, 'pribeh', `📜 ${u.nadpis}: ${u.text}`);
    if (u.odemkne) {
      hra.odemceno[u.odemkne] = true;
      zprava(hra, 'objev', u.odemkne === 'runovaKovarna' ? 'Odemčeno: runová kovárna (🔨 Stavět → Kovy a oheň).' : 'Odemčeno: artefakty v runové kovárně.');
    }
    if (k <= 1 && kampan(hra)) { const v = voditko(hra); if (v.text) zprava(hra, 'pribeh', '🧭 ' + v.text, v.g); }
  }
  function prectiDesku(hra, g) {
    if (hra.deskyPrectene.includes(g)) return;
    hra.deskyPrectene.push(g);
    hra.slavaBonus = (hra.slavaBonus || 0) + 10;
    prectiUlomek(hra, hra.prectene.includes(0) ? 1 : 0);
    hra.zmenaPraci++;
  }
  const POKLAD = { zlato: 3, drahokam: 3, prut_stribro: 1, sperk: 1 };
  function vynesPoklad(hra, g, t) {
    const sv = hra.sv;
    if (sv.obj[g] !== O.POKLAD) return;
    sv.obj[g] = O.NIC; PR.zmenaTerenu(hra, g);
    const kam = C.pruchozi(sv, g) ? g : t.g;
    for (const [d, n] of Object.entries(POKLAD)) for (let k = 0; k < n; k++) PR.novaVec(hra, d, kam);
    hra.slavaBonus = (hra.slavaBonus || 0) + 15;
    zprava(hra, 'objev', `💰 ${t.jmeno} otevřel poklad předků: zlato, drahokamy, stříbro a šperk (sláva +15).`, g);
    hra.zmenaPraci++;
  }

  // --- vodítko: kam dál (s patrem a směrem od podesty schodiště předků) -------------------------------
  function smer(dx, dy) {
    const a = Math.atan2(dy, dx) * 180 / Math.PI, s = ['na východ', 'na jihovýchod', 'na jih', 'na jihozápad', 'na západ', 'na severozápad', 'na sever', 'na severovýchod'];
    return s[((Math.round(a / 45) % 8) + 8) % 8];
  }
  function popisMista(hra, o) {
    const sv = hra.sv, q = sv.schody.find(s => s.p === 1) || { x: sv.W >> 1, y: sv.H >> 1 };
    const dx = o.sx - q.x, dy = o.sy - q.y, d = Math.round(Math.hypot(dx, dy) / 5) * 5;
    return `v ${o.p}. patře, asi ${Math.max(5, d)} polí ${smer(dx, dy)} od schodiště předků`;
  }
  // { cil, text, g } – nepřečtená deska v objevených ruinách, neobjevené ruiny, Srdce
  function voditko(hra) {
    const r0 = { cil: null, text: '', g: -1 }, sv = hra.sv;
    if (!kampan(hra) || hra.vyhenHori) return r0;
    if (hra.prectene.length < 2 && !maKlic(hra) && !hra.zazehnuti) {
      for (const g of hra._desky || (hra._desky = najdi(sv, O.DESKA))) if (!hra.deskyPrectene.includes(g) && hra.objeveno[sv.oblast[g]])
        return { cil: 'deska', g, text: `Runová deska ${popisMista(hra, sv.oblasti[sv.oblast[g]])} čeká na přečtení – dojde k ní řemeslník.` };
      const typ = hra.prectene.length ? 'sin_predku' : 'straznice';
      const o = sv.oblasti.filter(o => o && o.typ === typ && !hra.objeveno[o.id]).sort((a, b) => a.p - b.p)[0]
        || sv.oblasti.find(o => o && (o.typ === 'straznice' || o.typ === 'sin_predku') && !hra.objeveno[o.id]);
      if (o) return { cil: 'ruiny', g: o.p * sv.N + Math.floor(o.sy) * sv.W + Math.floor(o.sx),
        text: `${hra.prectene.length ? 'Druhá deska leží v Síni předků' : 'Nejbližší runová deska leží ve strážnici předků'} ${popisMista(hra, o)}.` };
    }
    // hvězdná žíla: runy Síně předků ukazují, kde leží (dokud klan nemá hvězdnou ocel na Klíč)
    if (hra.odemceno.artefakty && !maKlic(hra) && !hra.artefakty.klic && hvezdnych(hra) + hra.veci.filter(v => v.druh === 'hvezdna').length < 7) {
      const z = zila(hra);
      if (z) return { cil: 'hvezdna', g: z.g, text: `Runy ukazují hvězdnou žílu ${popisMista(hra, z)} – vytěž ji (tavírna z ní taví hvězdné pruty).` };
    }
    const sr = sv.oblasti[sv.srdce.oblast], gs = vyhenG(hra);
    if (srdceZname(hra)) return maKlic(hra) ? { cil: 'vyhen', g: gs, text: 'Srdce hory je otevřené – dones Klíč k Výhni předků.' } : r0;
    return { cil: 'srdce', g: gs, text: `Srdce hory leží ${popisMista(hra, sr)}.${maKlic(hra) ? '' : ' Bez Klíče do 8. patra netesej – probudíš Spáče.'}` };
  }

  // nejbližší nevytěžená hvězdná žíla ke schodišti předků (střed a patro), jako „oblast“ pro popisMista
  function zila(hra) {
    const sv = hra.sv, q = sv.schody.find(s => s.p === 1) || { x: sv.W >> 1, y: sv.H >> 1 };
    let nej = null, nd = Infinity;
    for (let g = 0; g < sv.ruda.length; g++) {
      if (sv.ruda[g] !== SV.R.HVEZDNA || sv.teren[g] === M.VOLNO) continue;
      const [x, y, p] = xy(sv, g), d = Math.hypot(x - q.x, y - q.y) + 40 * Math.abs(p - 7);
      if (d < nd) { nd = d; nej = { g, p, sx: x + 0.5, sy: y + 0.5 }; }
    }
    return nej;
  }
  // --- artefakty a Klíč ---------------------------------------------------------------------------
  const klicPodminka = hra => { const ma = DEDICTVI.filter(k => hra.artefakty[k]).length; return { ok: ma >= DEDICTVI_NA_KLIC, ma, potreba: DEDICTVI_NA_KLIC }; };
  // smí dílna zakázku vyrábět? (artefakty jen po odemčení, každý jednou, Klíč po 2 ze 3)
  function zakazano(hra, vyrobek) {
    if (!vyrobek.startsWith('art_')) return false;
    const k = vyrobek.slice(4);
    if (!hra.odemceno.artefakty || hra.artefakty[k]) return true;
    if (k === 'klic') return !klicPodminka(hra).ok || maKlic(hra) || hra.vyhenHori;
    return false;
  }
  function vyroben(hra, druh, g) {
    const k = druh.slice(4);
    if (k === 'klic') PR.novaVec(hra, 'klic', g);
    hra.artefakty[k] = true;
    hra.slavaBonus = (hra.slavaBonus || 0) + 25;
    if (k === 'lampa' && S.svetlo) hra.verzeTerenu++;
    zprava(hra, 'objev', `✨ ${ARTEFAKTY[k].ikona} ${ARTEFAKTY[k].nazev} je hotov – ${ARTEFAKTY[k].popis}!`, g);
    if (k === 'klic' && kampan(hra)) { const v = voditko(hra); if (v.text) zprava(hra, 'pribeh', '🧭 ' + v.text, v.g); }
  }
  const faktor = (hra, prace) => hra.artefakty && hra.artefakty.kladivo && (prace === 'stavet' || prace === 'vyrobit') ? 1.3 : 1;
  const utokKlanu = hra => hra.artefakty && hra.artefakty.roh ? 1.3 : 1;
  // kusovník Klíče: co je ještě potřeba (hotové výrobky se počítají)
  const ART_VSTUP = { kladivo: 'prut_zelezo', lampa: 'brus', roh: 'pohar' };
  function kusovnik(hra) {
    if (!kampan(hra) || hra.vyhenHori || hra.artefakty.klic || !hra.odemceno.runovaKovarna) return null;
    const ma = {}; for (const v of hra.veci) ma[v.druh] = (ma[v.druh] || 0) + 1;
    const hotovo = DEDICTVI.filter(k => hra.artefakty[k]);
    const artefakty = DEDICTVI.filter(k => !hotovo.includes(k)).slice(0, Math.max(0, DEDICTVI_NA_KLIC - hotovo.length));
    const potreba = { prut_hvezdny: 3 + 2 * artefakty.length, sperk: 1 };
    for (const k of artefakty) potreba[ART_VSTUP[k]] = (potreba[ART_VSTUP[k]] || 0) + 1;
    if (!hra.budovy.some(b => b.typ === 'runova_kovarna')) potreba.prut_zlato = 2;
    const polozky = Object.entries(potreba).map(([druh, n]) => ({ druh, nazev: PR.VECI[druh].nazev, ikona: PR.VECI[druh].ikona, potreba: n, ma: Math.min(n, ma[druh] || 0) }));
    return { polozky, artefakty, hotovo: polozky.every(p => p.ma >= p.potreba) };
  }

  // --- Spáč ------------------------------------------------------------------------------------------
  const spacNa = hra => hra.tvorove.find(u => u.druh === 'spac') || null;
  function odolnostSpace(hra) {
    let u = 0;
    for (const t of hra.trpaslici) if (t.povoleno.hlidat && t.zbran) u += S.hrozby.utokTrpaslika(hra, t) / utokKlanu(hra);
    return Math.max(1, Math.round(u / ODOLNOST_UTOK * 100) / 100);
  }
  function mistaVSrdci(hra, odStredu) {
    const sv = hra.sv, sr = sv.oblasti[sv.srdce.oblast], gs = vyhenG(hra), r = [];
    for (let y = sr.y0; y <= sr.y1; y++) for (let x = sr.x0; x <= sr.x1; x++) {
      const g = sr.p * sv.N + y * sv.W + x;
      if (sv.oblast[g] === sr.id && C.pruchozi(sv, g) && S.hrozby.vzd(sv, g, gs) >= (odStredu || 2)) r.push(g);
    }
    return r;
  }
  function probudSpace(hra, proc) {
    if (hra.spac.probuzen || (!kampan(hra) && proc !== 'vyzva')) return;
    hra.spac.probuzen = true;
    const m = mistaVSrdci(hra, 2);
    const s = S.hrozby.novyTvor(hra, 'spac', m.length ? m[Math.floor(PR.nahoda(hra) * m.length)] : vyhenG(hra) + 1);
    s.odolnost = odolnostSpace(hra);
    hra.spac.id = s.id;
    if (proc === 'brzy') hra.spac.brzy = true;
    hra.dalsiNajezd = Math.max(hra.dalsiNajezd, hra.tik + 3 * DEN());       // hora se otřásla – goblini se chvíli drží zpátky
    zprava(hra, 'boj', (proc === 'brzy' ? '🌋 Země se zachvěla. Tesali jste v pásmu Spáče bez Klíče – v Srdci hory otevřel oči PRADÁVNÝ SPÁČ! Hora bude neklidná.'
      : proc === 'vyzva' ? '🌋 Klan vyzval PRADÁVNÉHO SPÁČE! Probouzí se v Srdci hory.'
      : '🌋 Výheň se rozhořívá a hora duní. PRADÁVNÝ SPÁČ se probouzí – braňte oheň!') +
      ' Úzkou chodbou (1 pole) neprojde. Ozbrojení strážci na něj jdou aspoň ve třech, ostatní utíkají.', s.g);
  }
  const lzeVyzvatSpace = hra => !kampan(hra) && !hra.spac.probuzen && srdceZname(hra);
  function vyzviSpace(hra) { if (!lzeVyzvatSpace(hra)) return false; probudSpace(hra, 'vyzva'); return true; }
  function spacPorazen(hra) {
    if (hra.spac.porazen) return;
    hra.spac.porazen = true;
    hra.slavaBonus = (hra.slavaBonus || 0) + 40;
    zprava(hra, 'objev', '🏆 Pradávný spáč padl! Hora je volná (sláva +40).', vyhenG(hra));
  }
  // na Spáče se jde, když je u něj dost zdravých ozbrojených strážců, nebo když už bojuje a strážce je blízko
  function naSpaceVSkupine(hra, s, t) {
    const sv = hra.sv, HZ = S.hrozby;
    if (s.zautocil > hra.tik - 60 && HZ.vzd(sv, t.g, s.g) <= 2 * BLIZKO_SPACE) return true;
    let n = 0;
    for (const u of hra.trpaslici) if (u.povoleno.hlidat && u.zbran && u.zdravi >= 35 && HZ.vzd(sv, u.g, s.g) <= BLIZKO_SPACE) n++;
    return n >= SKUPINA_NA_SPACE;
  }
  // tesání v pásmu: 7. patro varuje, 8. patro bez Klíče probudí (volá prace.vykopej)
  function hlidejHloubku(hra, g) {
    if (!kampan(hra) || hra.spac.probuzen || maKlic(hra) || hra.zazehnuti) return;
    const p = (g / hra.sv.N) | 0;
    if (p >= PATRO_SPACE) { probudSpace(hra, 'brzy'); return; }
    if (p >= PATRO_VAROVANI && hra.tik - hra.spac.duni > 3 * DEN()) {
      hra.spac.duni = hra.tik;
      zprava(hra, 'varovani', `🌋 Hora duní… V ${p}. patře je pod nohama horníků cítit těžký dech. Tesat v ${PATRO_SPACE}. patře bez Klíče znamená probudit Spáče!`, g);
    }
  }
  const budiSpace = (hra, p) => kampan(hra) && p >= PATRO_SPACE && !hra.spac.probuzen && !maKlic(hra) && !hra.zazehnuti;
  function objevenoSrdce(hra) {
    prectiUlomek(hra, 2);
    if (!maKlic(hra)) probudSpace(hra, 'brzy');
  }

  // --- zažehnutí ---------------------------------------------------------------------------------------
  // osobní práce: vzít Klíč, donést ho k Výhni a zažíhat; jen jeden trpaslík naráz
  function ukolZazehnout(hra, t) {
    if (!kampan(hra) && !hra.zazehnuti) return null;
    if (hra.vyhenHori || !srdceZname(hra) || hra.trpaslici.some(u => u !== t && u.prace && u.prace.osobni === 'zazehnout')) return null;
    const v = hra.veci.find(v => v.druh === 'klic' && v.g >= 0);
    if (!v) return null;
    // Spáč bdí: k Výhni jen pod ochranou – aspoň 3 zdraví ozbrojení strážci u něj (jinak by šli zažíhající na smrt jeden po druhém)
    const sp = spacNa(hra);
    if (sp && hra.trpaslici.filter(u => u.povoleno.hlidat && u.zbran && u.zdravi >= 35 && S.hrozby.vzd(hra.sv, u.g, sp.g) <= BLIZKO_SPACE).length < SKUPINA_NA_SPACE) return null;
    const r = v.g === t.g ? { cesta: [] } : C.hledej(hra, [t.g], g => g === v.g, 20000);
    return r ? { prace: { osobni: 'zazehnout', klic: 'osobni', faze: 'k_veci', vec: v.id }, cesta: r.cesta } : null;
  }
  // příchod na konec cesty; vrací true, když má trpaslík dál zažíhat (tah spotřebován)
  function zazehnutiPrisel(hra, t) {
    const p = t.prace, sv = hra.sv, gs = vyhenG(hra);
    if (p.faze === 'k_veci') {
      const v = PR.vecPodle(hra, p.vec);
      if (!v || v.g !== t.g) return false;
      v.g = -1; t.nese = v.id; hra.zmenaPraci++;
      const st = new Set(PR.stojiskaKolem(sv, gs));
      const r = st.has(t.g) ? { cesta: [] } : C.hledej(hra, [t.g], g => st.has(g), 20000);
      if (!r) return false;
      p.faze = 'k_vyhni'; t.cesta = r.cesta;
      return true;
    }
    if (S.hrozby.vzd(sv, t.g, gs) > 1) return false;
    p.faze = 'zazehni';
    return zazehni(hra, t);
  }
  function zazehni(hra, t) {
    if (!hra.zazehnuti) { hra.zazehnuti = 1; zprava(hra, 'pribeh', `🔥 ${t.jmeno} vkládá Klíč do Výhně předků…`, t.g); if (!hra.spac.porazen) probudSpace(hra, 'finale'); }
    hra.zazehnuti++;
    hra.spac.zazTik = hra.tik;
    if (VLNY.includes(hra.zazehnuti)) vlnaZHlubin(hra);
    if (hra.zazehnuti < DOBA_ZAZEHNUTI) return true;
    hra.vyhenHori = true;
    const v = PR.vecPodle(hra, t.nese);
    if (v) { PR.odeberVec(hra, v); hra.spotrebovano++; }
    t.nese = 0; t.prace = null; t.faze = ''; t.hledej = hra.tik;
    hra.slavaBonus = (hra.slavaBonus || 0) + 60;
    hra.verzeTerenu++;                                  // výheň svítí
    PR.zvuk(hra, 'fanfara');
    zprava(hra, 'objev', '🔥🔥🔥 VÝHEŇ PŘEDKŮ HOŘÍ! Srdce hory znovu bije.', vyhenG(hra));
    if (kampan(hra) && !hra.konec) konec(hra, true);
    return false;
  }
  const zazehnujici = hra => hra.zazehnuti && !hra.vyhenHori ? hra.trpaslici.find(t => t.prace && t.prace.osobni === 'zazehnout' && t.prace.faze === 'zazehni') || null : null;
  const finaleBezi = hra => !!hra.zazehnuti && !hra.vyhenHori && (hra.tik - hra.spac.zazTik < 2 * DEN() || !!zazehnujici(hra));
  const pavoukuVeVlne = hra => Math.min(4, 1 + Math.floor(hra.trpaslici.filter(t => t.povoleno.hlidat && t.zbran).length / 3));
  function vlnaZHlubin(hra) {
    const m = mistaVSrdci(hra, 4);
    if (!m.length) return 0;
    const n = pavoukuVeVlne(hra);
    let kde = -1;
    for (let k = 0; k < n; k++) { const u = S.hrozby.novyTvor(hra, 'pavouk', m[Math.floor(PR.nahoda(hra) * m.length)]); u.vlna = 1; kde = u.g; }
    zprava(hra, 'boj', `🕷️ Hora se probouzí – z puklin Srdce lezou obří pavouci (${n})! Braňte toho, kdo zažíhá Výheň.`, kde);
    return n;
  }

  // --- konec hry a epilog --------------------------------------------------------------------------
  function statistiky(hra) {
    return { dni: Math.floor(hra.tik / DEN()) + 1, roky: S.obdobi.rok(hra), zije: hra.trpaslici.length, nejvic: hra.maxTrp || hra.trpaslici.length,
      padlo: hra.padlo || 0, slava: hra.slava || 0, hloubka: hra.nejhloubeji, vykopano: hra.vykopano, zabito: hra.zabito || 0,
      najezdu: hra.najezdu || 0, artefakty: Object.keys(hra.artefakty).length, spac: hra.spac.porazen ? 'poražen' : hra.spac.probuzen ? 'žije' : 'spí' };
  }
  function konec(hra, vitezstvi) {
    hra.konec = { vitezstvi, tik: hra.tik, stat: statistiky(hra) };
    zprava(hra, vitezstvi ? 'objev' : 'smrt', vitezstvi ? 'KONEC HRY: vítězství! Srdce hory bije.' : 'KONEC HRY: v hoře už nežije žádný trpaslík.');
  }
  function epilog(hra) {
    const k = hra.konec || hra.dohrano; if (!k) return '';
    const s = k.stat, jm = hra.sv.jmeno;
    if (!k.vitezstvi) return `Hora ${jm} znovu utichla. Klan vydržel ${s.dni} dní a nejhlouběji došel do ${s.hloubka} m. ` +
      'Možná jednou přijdou jiní a najdou po něm schody, síně a vyhaslé louče.';
    return `Po ${s.dni} dnech (${s.roky}. rok) zažehl klan Výheň předků v Srdci hory ${jm}. ` +
      (s.spac === 'poražen' ? 'Pradávný spáč leží poražen a ' : 'Pradávný spáč dál dřímá pod horou a ') +
      `v síních žije ${s.zije} trpaslíků. Písně o jejich slávě (${s.slava}) se ponesou horami ještě stovky let.`;
  }
  // po vítězství: hra pokračuje ve volném režimu (Spáče lze vyzvat, nájezdy dál)
  function hratDal(hra) {
    if (!hra.konec || !hra.konec.vitezstvi) return false;
    hra.dohrano = hra.konec; hra.konec = null; hra.rezim = 'volny';
    zprava(hra, 'pribeh', '♾️ Hora žije dál. Volný režim: stav, kopej a braň síně, jak dlouho chceš.');
    return true;
  }

  // --- „Co dál?“: první nesplněný krok od první síně po zažehnutí Výhně ---------------------------------
  const maBudovu = (hra, typ) => hra.budovy.some(b => b.typ === typ);
  const pocetBudov = (hra, typ) => hra.budovy.filter(b => b.typ === typ).length;
  const maZonu = (hra, ...typy) => hra.zony.some(z => typy.includes(z.typ));
  const ozbrojenych = hra => hra.trpaslici.filter(t => t.povoleno.hlidat && t.zbran).length;
  const hvezdnych = hra => hra.veci.filter(v => v.druh === 'prut_hvezdny').length + 2 * DEDICTVI.filter(k => hra.artefakty[k]).length;
  const UKOLY = [
    { text: '⛏️ Vytesej v 1. patře u podesty síň (nástroj Kopat, K) – aspoň 20 polí. V hlíně drží strop 2 pole od stěny: síň vysoká 4 pole nebo sloupy.', hotovo: h => h.vykopano >= 20 },
    { text: '🪚 Postav tesařskou dílnu (🔨 Stavět → Dílny) – vyrábí postele, stoly a židle.', hotovo: h => maBudovu(h, 'tesarna') },
    { text: '🛏️ Udělej ložnici: místnost s dveřmi, zónu ložnice (Z) a aspoň 3 postele.', hotovo: h => maZonu(h, 'loznice') && pocetBudov(h, 'postel') >= 3 },
    { text: '🍄 Založ houbárnu v podzemí nebo pole ječmene v rokli (Z) a postav kuchyni.', hotovo: h => maZonu(h, 'houbarna', 'pole') && maBudovu(h, 'kuchyne') },
    { text: '🍺 Postav pivovar – bez piva trpaslíci ztrácejí náladu.', hotovo: h => maBudovu(h, 'pivovar') },
    { text: '🔥 Rozvěš louče na stěny – ve tmě se pracuje pomalu a špatně spí.', hotovo: h => pocetBudov(h, 'louc') >= 2 },
    { text: '⛰️ Vytesej schodiště (Schody dolů, L) aspoň do 3. patra.', hotovo: h => h.nejhloubeji >= 60 },
    { text: '🧱 Najdi železnou rudu (3.–5. patro), postav milíř a tavírnu.', hotovo: h => !!h.nalezeno.zelezo && maBudovu(h, 'tavirna') && maBudovu(h, 'milir') },
    { text: '⚔️ Postav kovárnu a zbrojnici, zapni trpaslíkům ⚔️ hlídání a ukuj zbraně – goblini přijdou 36. den.', hotovo: h => maBudovu(h, 'kovarna') && ozbrojenych(h) >= 2 },
    { text: '📜 Najdi strážnici předků (3.–5. patro) a přečti runovou desku.', hotovo: h => h.prectene.length >= 1 },
    { text: '✴️ Postav runovou kovárnu (2 zlaté pruty; zlato leží v 5. patře).', hotovo: h => maBudovu(h, 'runova_kovarna') },
    { text: '📜 Přečti druhou desku v Síni předků (6. patro) – odemkne artefakty.', hotovo: h => !!h.odemceno.artefakty },
    { text: '🌟 Vytěž hvězdnou rudu (7. patro) – na 2 artefakty a Klíč je potřeba 7 hvězdných prutů (tavírna nebo magmatická výheň).', hotovo: h => hvezdnych(h) >= 7 || !!h.artefakty.klic },
    { text: '✨ Ukuj v runové kovárně 2 ze 3 artefaktů: 🔨 kladivo, 🏮 lampa (broušený drahokam), 📯 roh (stříbrný pohár).', hotovo: h => klicPodminka(h).ok || !!h.artefakty.klic },
    { text: '🗝️ Vybrus šperk (brusírna: zlatý prut + drahokam) a ukuj Klíč k Srdci.', hotovo: h => !!h.artefakty.klic },
    { text: '❤️‍🔥 Teprve s Klíčem se prokopej do Srdce hory (8. patro). Připrav aspoň 4 ozbrojené strážce se zbrojí – Spáč se probudí.', hotovo: h => srdceZname(h) },
    { text: '🔥 Dones Klíč k Výhni předků a ubraň ji, dokud se nerozhoří (1 den).', hotovo: h => !!h.vyhenHori },
  ];
  const VOLNE_CILE = [
    { text: '⛰️ Prokopej se do 5. patra – níž leží zlato, stříbro a drahokamy.', hotovo: h => h.nejhloubeji >= 100 },
    { text: '🏛️ Vybuduj velkou jídelnu: aspoň 24 polí, kvalita „pěkná“ nebo lepší.', hotovo: h => h.zony.some(z => { if (z.typ !== 'jidelna') return false; const g = h.zona.indexOf(z.id), m = g >= 0 ? S.mistnosti.mistnostNa(h, g) : null; return m && m.pole >= 24 && S.mistnosti.kvalita(h, m, 'jidelna').hodnota >= 9; }) },
    { text: '🛡️ Opevni horu: dveře nebo padací mříž, 2 pasti a 4 ozbrojení strážci.', hotovo: h => (maBudovu(h, 'dvere') || maBudovu(h, 'mriz')) && pocetBudov(h, 'past') >= 2 && ozbrojenych(h) >= 4 },
    { text: '🎺 Dosáhni slávy 250.', hotovo: h => (h.slava || 0) >= 250 },
    { text: '🌋 Najdi Srdce hory (8. patro) a vyzvi Pradávného spáče (volitelný boss, sláva +40).', hotovo: h => !!h.spac.porazen },
    { text: '👑 Dosáhni slávy 500.', hotovo: h => (h.slava || 0) >= 500 },
  ];
  const KROKY_VODITKA = new Set([9, 11, 15]), KROKY_KUSOVNIKU = new Set([10, 11, 12, 13, 14]);
  function coDal(hra) {
    const volny = !kampan(hra), seznam = volny ? UKOLY.slice(0, 9).concat(VOLNE_CILE) : UKOLY;
    for (let k = 0; k < seznam.length; k++) if (!seznam[k].hotovo(hra)) {
      const r = { krok: k + 1, z: seznam.length, text: seznam[k].text };
      if (!volny && KROKY_VODITKA.has(k)) { const v = voditko(hra); if (v.text) { r.voditko = v; } }
      if (!volny && KROKY_KUSOVNIKU.has(k)) r.kusovnik = kusovnik(hra);
      return r;
    }
    if (volny) { const s = (Math.floor((hra.slava || 0) / 100) + 1) * 100; return { krok: seznam.length + 1, z: seznam.length + 1, text: `♾️ Sláva ${s} (teď ${hra.slava || 0}) a další odražené nájezdy – hora nikdy nespí.` }; }
    return null;
  }

  function tik(hra) {
    if (hra.trpaslici.length > (hra.maxTrp || 0)) hra.maxTrp = hra.trpaslici.length;
    if (!hra.trpaslici.length && !hra.konec && hra.tik > 1) konec(hra, false);
    if (hra.spac.probuzen && !hra.spac.porazen && !hra.tvorove.some(u => u.id === hra.spac.id)) spacPorazen(hra);
    if (finaleBezi(hra)) hra.dalsiNajezd = Math.max(hra.dalsiNajezd, hra.tik + DEN() + 1);
  }

  S.pribeh = { ULOMKY, ARTEFAKTY, DEDICTVI, VLNY, DOBA_ZAZEHNUTI, PATRO_VAROVANI, PATRO_SPACE, POKLAD, kampan, vychozi, jednotky, prectiDesku,
               prectiUlomek, vynesPoklad, voditko, klicPodminka, zakazano, vyroben, faktor, utokKlanu, kusovnik, odolnostSpace, probudSpace,
               lzeVyzvatSpace, vyzviSpace, spacPorazen, naSpaceVSkupine, hlidejHloubku, budiSpace, objevenoSrdce, ukolZazehnout,
               zazehnutiPrisel, zazehni, zazehnujici, finaleBezi, vlnaZHlubin, statistiky, konec, epilog, hratDal, tik, spacNa, UKOLY, VOLNE_CILE, coDal };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;
