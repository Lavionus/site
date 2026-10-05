/* ============================================================
   Síně pod horou – prace.js: značky prací, pracovní jednotky,
   účinky práce a věci na zemi.

   Hráč označuje pole (hra.oznac):
     KOPAT  – vytesat skálu (trpaslík stojí na sousedním poli, šikmo jen bez rohu)
     SCHODY – schodiště do patra pod: vytesá se horní i dolní pole
              (dá se kopat shora i zdola – tím se zachraňují uvízlí)
     DIRA   – prorazit podlahu do patra pod (pod ní se vytesá malá prostora)
     OTESAT – surová podlaha → dlažba, okolní skála → zdivo, ruda ve stěně se vytěží
     KACET  – jedle nebo obří houba
   Plány staveb (žebřík a šachta do díry) potřebují donést dřevo.
   Z označení se staví „jednotky práce“ s místy, odkud se dají dělat
   (stojiště). Hledání práce pak prochází stojiště od trpaslíka.
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O, P, R, K } = SV, C = S.cesty;

  const OZN = { NIC: 0, KOPAT: 1, SCHODY: 2, DIRA: 3, OTESAT: 4, KACET: 5 };
  const OZN_NAZEV = { 1: 'kopat', 2: 'schodiště', 3: 'díra', 4: 'otesat', 5: 'kácet' };
  // druh jednotky → skupina práce (stupně priority trpaslíka)
  const SKUPINA = { kopat: 'kopat', schody: 'kopat', dira: 'kopat', otesat: 'tesat', kacet: 'kacet', donest: 'nosit', odnest: 'nosit', stavet: 'stavet', vyrobit: 'remeslo', zasit: 'pole', sklidit: 'pole', pumpovat: 'nosit', cist: 'remeslo', poklad: 'nosit' };

  const VECI = {
    kamen: { nazev: 'kámen', ikona: '🪨' }, jil: { nazev: 'jíl', ikona: '🟫' }, uhli: { nazev: 'uhlí', ikona: '⚫' },
    zelezo: { nazev: 'železná ruda', ikona: '🟥' }, med: { nazev: 'měděná ruda', ikona: '🟧' },
    stribro: { nazev: 'stříbro', ikona: '⚪' }, zlato: { nazev: 'zlato', ikona: '🟡' }, drahokam: { nazev: 'drahokam', ikona: '💎' },
    hvezdna: { nazev: 'hvězdná ruda', ikona: '✨' }, drevo: { nazev: 'dřevo', ikona: '🪵' }, houby: { nazev: 'houby', ikona: '🍄' },
    jecmen: { nazev: 'ječmen', ikona: '🌾' }, ryba: { nazev: 'ryba', ikona: '🐟' },
    jidlo: { nazev: 'jídlo', ikona: '🍖' }, pivo: { nazev: 'pivo', ikona: '🍺' },
    krumpac: { nazev: 'krumpáč', ikona: '⛏️' }, sekera: { nazev: 'sekera', ikona: '🪓' }, kladivo: { nazev: 'kladivo', ikona: '🔨' },
    prut_zelezo: { nazev: 'železný prut', ikona: '🔩' }, prut_med: { nazev: 'měděný prut', ikona: '🟠' },
    prut_stribro: { nazev: 'stříbrný prut', ikona: '🥈' }, prut_zlato: { nazev: 'zlatý prut', ikona: '🥇' },
    postel: { nazev: 'postel', ikona: '🛏️' }, stul: { nazev: 'stůl', ikona: '🍽️' }, zidle: { nazev: 'židle', ikona: '🪑' },
    lavice: { nazev: 'lavice', ikona: '🪑' }, socha: { nazev: 'socha', ikona: '🗿' }, truhla: { nazev: 'truhla', ikona: '🧰' },
    sud: { nazev: 'sud', ikona: '🛢️' }, dlazba: { nazev: 'dlažba', ikona: '⬜' }, prkna: { nazev: 'prkna', ikona: '🟫' },
    koberec: { nazev: 'koberec', ikona: '🟥' }, mozaika: { nazev: 'mozaika', ikona: '💠' }, platno: { nazev: 'stanové plátno', ikona: '⛺' },
    svicen: { nazev: 'svícen', ikona: '🕯️' }, kuse: { nazev: 'kuše', ikona: '🏹' }, sipy: { nazev: 'šípy', ikona: '➶' },
    valecna_sekera: { nazev: 'válečná sekera', ikona: '🪓' }, zbroj: { nazev: 'zbroj', ikona: '🛡️' },
    brus: { nazev: 'broušený drahokam', ikona: '💠' }, sperk: { nazev: 'šperk', ikona: '💍' }, pohar: { nazev: 'stříbrný pohár', ikona: '🏆' },
    hedvabi: { nazev: 'pavoučí hedvábí', ikona: '🕸️' },
    prut_hvezdny: { nazev: 'hvězdný prut', ikona: '🌟' }, cepel: { nazev: 'goblinní čepel', ikona: '🗡️' }, klic: { nazev: 'Klíč k Srdci', ikona: '🗝️' },
  };
  const Z_RUDY = { [R.UHLI]: 'uhli', [R.ZELEZO]: 'zelezo', [R.MED]: 'med', [R.STRIBRO]: 'stribro',
                   [R.ZLATO]: 'zlato', [R.DRAHOKAM]: 'drahokam', [R.HVEZDNA]: 'hvezdna' };
  // --- pomocníci --------------------------------------------------------------------
  // seřazený seznam označených polí (mezipaměť; každý zápis do hra.oznac musí zavolat oznZmena)
  const oznZmena = hra => { hra._oznVerze = (hra._oznVerze || 0) + 1; };
  function znacky(hra) {
    if (hra._znacky && hra._znackyVerze === hra._oznVerze) return hra._znacky;
    const r = [], o = hra.oznac;
    for (let g = 0; g < o.length; g++) if (o[g]) r.push(g);
    hra._znacky = r; hra._znackyVerze = hra._oznVerze;
    return r;
  }
  const pevne = (sv, g) => sv.teren[g] !== M.VOLNO;
  const kopatelne = (sv, g) => pevne(sv, g) && sv.teren[g] !== M.PODLOZI;
  const souradnice = (sv, g) => { const p = (g / sv.N) | 0, l = g - p * sv.N; return { p, x: l % sv.W, y: (l / sv.W) | 0 }; };
  function nahoda(hra) {                     // mulberry32 nad hra.rng (ukládá se jako číslo)
    let t = hra.rng = (hra.rng + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ t >>> 15, 1 | t);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  // průchozí sousedé pole g, ze kterých se na g dosáhne (šikmo jen bez rohu)
  function stojiskaKolem(sv, g, vcetne) {
    const { W, H, N } = sv, p = (g / N) | 0, l = g - p * N, x = l % W, y = (l / W) | 0, r = [];
    if (vcetne && C.pruchozi(sv, g)) r.push(g);
    for (const [dx, dy] of C.SMERY) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const s = g + dy * W + dx;
      if (!C.pruchozi(sv, s)) continue;
      if (dx && dy && (!C.pruchozi(sv, g + dx) || !C.pruchozi(sv, g + dy * W))) continue;
      r.push(s);
    }
    return r;
  }

  // --- označování -------------------------------------------------------------------
  // lzeOznacit(hra, g, druh) → '' nebo důvod, proč ne
  function lzeOznacit(hra, g, druh) {
    const sv = hra.sv, N = sv.N, p = (g / N) | 0, o = sv.obj[g];
    switch (druh) {
      case OZN.KOPAT: return kopatelne(sv, g) ? '' : 'není co tesat';
      case OZN.SCHODY:
        if (p >= sv.P - 1) return 'níž už hora nevede';
        if (sv.teren[g] === M.PODLOZI || sv.teren[g + N] === M.PODLOZI) return 'kořen hory';
        if (!pevne(sv, g) && (o !== O.NIC || hra.budovaNa[g] || hra.planNa.has(g))) return 'pole je obsazené';
        if (!pevne(sv, g + N) && sv.obj[g + N] !== O.NIC) return 'pod polem je překážka';
        if (!pevne(sv, g + N) && sv.kap[g + N] >= SV.HLUBOKA) return 'pod polem je hluboká voda';
        return '';
      case OZN.DIRA:
        if (p >= sv.P - 1) return 'níž už hora nevede';
        if (pevne(sv, g) || o !== O.NIC || sv.kap[g]) return 'díra jde jen do volné suché podlahy';
        if (hra.budovaNa[g] || hra.planNa.has(g)) return 'na poli je stavba';
        if (sv.teren[g + N] === M.PODLOZI) return 'kořen hory';
        return '';
      case OZN.OTESAT:
        if (pevne(sv, g) || sv.otes[g] || sv.kap[g]) return 'otesat jde jen surovou suchou podlahu';
        if (p === 0 && !sv.oblast[g]) return '';
        return '';
      case OZN.KACET: return o === O.JEDLE || o === O.HOUBA ? '' : 'není co kácet';
    }
    return 'neznámá práce';
  }
  function oznac(hra, g, druh) {
    if (druh === OZN.NIC) { zrusOznaceni(hra, g); return true; }
    if (hra.oznac[g] === druh || lzeOznacit(hra, g, druh)) return false;
    zrusOznaceni(hra, g);
    hra.oznac[g] = druh; oznZmena(hra);
    hra.zmenaPraci++;
    zmena(hra, g);
    return true;
  }
  function zrusOznaceni(hra, g) {
    if (!hra.oznac[g] && !hra.prio[g]) return;
    hra.oznac[g] = 0; hra.prio[g] = 0; hra.zachrana[g] = 0; oznZmena(hra);
    hra.zmenaPraci++; zmena(hra, g);
  }
  function prednost(hra, g, ano) {
    if (!hra.oznac[g]) return false;
    hra.prio[g] = ano ? 1 : 0; hra.zmenaPraci++; zmena(hra, g);
    return true;
  }
  // --- věci -------------------------------------------------------------------------
  function novaVec(hra, druh, g, mat) {
    const v = { id: hra.dalsiId++, druh, g };
    if (mat) v.mat = mat;
    hra.vytvoreno++;
    hra.veci.push(v);
    hra.zmenaPraci++;
    return v;
  }
  function vecPodle(hra, id) { return hra.veci.find(v => v.id === id) || null; }
  function odeberVec(hra, v) { const i = hra.veci.indexOf(v); if (i >= 0) hra.veci.splice(i, 1); hra.zmenaPraci++; }

  // --- jednotky práce a stojiště ----------------------------------------------------
  // jednotka: { klic, druh, cil (pole práce), stojiste: [g…], prio, zachrana, vec?, plan? }
  function prestavJednotky(hra) {
    if (hra._jedVerze === hra.zmenaPraci + ':' + hra.verzeTerenu) return hra._stojiska;
    const sv = hra.sv, N = sv.N, mapa = new Map(), komp = C.komponenty(hra), vKomp = new Map();
    const pridej = j => {
      const ks = new Set();
      for (const s of j.stojiste) {
        let a = mapa.get(s); if (!a) mapa.set(s, a = []);
        a.push(j);
        ks.add(komp[s]);
      }
      for (const k of ks) { let a = vKomp.get(k); if (!a) vKomp.set(k, a = []); a.push(j); }   // oblast → jednotky
    };
    for (const g of znacky(hra)) {
      const z = hra.oznac[g];
      if (!z) continue;
      const prio = !!hra.prio[g], zach = !!hra.zachrana[g];
      if (z === OZN.KOPAT) {
        if (!kopatelne(sv, g)) { hra.oznac[g] = 0; oznZmena(hra); continue; }
        pridej({ klic: 'k' + g, druh: 'kopat', cil: g, stojiste: stojiskaKolem(sv, g), prio, zachrana: zach });
      } else if (z === OZN.SCHODY) {
        // horní a dolní část zvlášť: každá se tesá ze svého patra, nebo z druhé části, je-li už volná
        const d = g + N;
        if (!pevne(sv, g) && !pevne(sv, d)) {
          pridej({ klic: 's' + g, druh: 'schody', cil: g, horni: g, dokoncit: true, stojiste: stojiskaKolem(sv, g, true), prio, zachrana: zach });
          continue;
        }
        if (pevne(sv, g)) {
          const st = stojiskaKolem(sv, g);
          if (!pevne(sv, d)) for (const s of stojiskaKolem(sv, d, true)) st.push(s);
          pridej({ klic: 's' + g, druh: 'schody', cil: g, horni: g, stojiste: st, prio, zachrana: zach });
        }
        if (pevne(sv, d)) {
          const st = stojiskaKolem(sv, d);
          if (!pevne(sv, g)) for (const s of stojiskaKolem(sv, g, true)) st.push(s);
          pridej({ klic: 's' + d, druh: 'schody', cil: d, horni: g, stojiste: st, prio, zachrana: zach });
        }
      } else if (z === OZN.DIRA) {
        pridej({ klic: 'd' + g, druh: 'dira', cil: g, stojiste: stojiskaKolem(sv, g), prio, zachrana: zach });
      } else if (z === OZN.OTESAT) {
        pridej({ klic: 'o' + g, druh: 'otesat', cil: g, stojiste: stojiskaKolem(sv, g, true), prio, zachrana: zach });
      } else if (z === OZN.KACET) {
        if (sv.obj[g] !== O.JEDLE && sv.obj[g] !== O.HOUBA) { hra.oznac[g] = 0; oznZmena(hra); continue; }
        pridej({ klic: 'c' + g, druh: 'kacet', cil: g, stojiste: stojiskaKolem(sv, g), prio, zachrana: zach });
      }
    }
    S.stavby.jednotky(hra, pridej);
    if (S.pribeh) S.pribeh.jednotky(hra, pridej);
    let bonus = 0; for (const js of mapa.values()) for (const j of js) bonus = Math.max(bonus, (j.prio ? 300 : 0) + (j.zachrana ? 600 : 0));
    hra._jedBonus = bonus;                         // největší sleva za přednost a záchranu (ořezání hledání práce)
    hra._stojiska = mapa; hra._vKomp = vKomp;
    hra._jedVerze = hra.zmenaPraci + ':' + hra.verzeTerenu;
    return mapa;
  }

  // --- doby a účinky -----------------------------------------------------------------
  const TVRDA = 4, BEZ_ZELEZA = 1.8;
  function dobaKopani(hra, g, t) {
    const sv = hra.sv, mat = SV.MATERIAL[sv.teren[g]];
    const tv = mat.tvrdost === Infinity ? 99 : mat.tvrdost || 1;
    const zelezny = t.nastroj && t.nastroj.druh === 'krumpac' && t.nastroj.mat === 'zelezo';
    const ruda = sv.ruda[g] ? 1.3 : 1, tvrda = tv >= TVRDA && !zelezny ? BEZ_ZELEZA : 1;   // tvrdá skála bez železného krumpáče pomaleji
    return Math.max(4, Math.round(14 * tv * ruda * tvrda / (1 + 0.08 * t.dov.kopani)));
  }
  function dobaJednotky(hra, j, t) {
    switch (j.druh) {
      case 'kopat': case 'schody': return j.dokoncit ? 30 : dobaKopani(hra, j.cil, t);
      case 'dira': { const d = j.cil + hra.sv.N; return 20 + (pevne(hra.sv, d) ? dobaKopani(hra, d, t) : 20); }
      case 'otesat': return t.prof === 'kamenik' ? 20 : 30;
      case 'kacet': return 40;
      case 'cist': return 120;
      case 'poklad': return 60;
      case 'stavet': { const pl = S.stavby.planPodle(hra, j.plan); return pl ? S.stavby.STAVBY[pl.typ].doba : 10; }
      case 'vyrobit': { const d = S.stavby.budovaPodle(hra, j.dilna), m = d && d.mista[j.misto]; return m && m.aktivni ? S.stavby.RECEPTY[d.typ][m.aktivni.r].doba : 10; }
      case 'donest': case 'odnest': return 4;
      case 'zasit': return 20;
      case 'pumpovat': return 12;
      case 'sklidit': return 25;
    }
    return 10;
  }

  // vykopání pole g; kam = kam padne věc (výchozí g)
  function vykopej(hra, g, kam) {
    const sv = hra.sv;
    const t = sv.teren[g], r = sv.ruda[g];
    sv.teren[g] = M.VOLNO; sv.podlaha[g] = P.SUROVA; sv.otes[g] = 0; sv.ruda[g] = R.NIC;
    if (t === M.CIHLA || t === M.RUNA) sv.podlaha[g] = P.DLAZBA;
    if (hra.oznac[g] === OZN.KOPAT) { hra.oznac[g] = 0; hra.prio[g] = 0; hra.zachrana[g] = 0; oznZmena(hra); }
    if (kam === undefined) kam = g;
    // co padá: ruda vždy, zdivo 60 %, kámen 35 %, jíl 50 %, hlína nic
    if (r && Z_RUDY[r]) {
      novaVec(hra, Z_RUDY[r], kam);
      if (!hra.nalezeno[Z_RUDY[r]]) { hra.nalezeno[Z_RUDY[r]] = 1; zprava(hra, 'nalez', `Našli jsme ${VECI[Z_RUDY[r]].nazev}!`, g); }
    } else if (t === M.CIHLA || t === M.RUNA) { if (nahoda(hra) < 0.6) novaVec(hra, 'kamen', kam); }
    else if (t === M.JIL) { if (nahoda(hra) < 0.5) novaVec(hra, 'jil', kam); }
    else if (t !== M.HLINA && t !== M.SUT) { if (nahoda(hra) < 0.35) novaVec(hra, 'kamen', kam); }
    hra.vykopano++;
    hra.vykopane[g] = 1;
    zmenaTerenu(hra, g);
    odhalOkoli(hra, g);
    S.priroda.moznaPramen(hra, g);
    S.priroda.aktivuj(hra, g);
    // sloup naplánovaný do pole ke kopání: tesá se rovnou ze skály (bez materiálu)
    const pl = hra.planNa.has(g) && S.stavby.planPodle(hra, hra.planNa.get(g));
    if (pl && pl.zeSkaly) { S.stavby.zrusPlan(hra, pl); sv.obj[g] = O.SLOUP; zmenaTerenu(hra, g); }
  }
  function zmenaTerenu(hra, g) { hra.verzeTerenu++; zmena(hra, g); }
  // změněná pole pro kreslení; bez odběratele (node) se seznam po čase zahodí a nahradí příznakem „vše“
  function zmena(hra, g) {
    if (hra.zmeny.length > 50000) { hra.zmeny.length = 0; hra.zmenyVse = true; }
    hra.zmeny.push(g);
  }

  function dokonci(hra, j, t) {
    const sv = hra.sv, N = sv.N, g = j.cil;
    if (S.pribeh && (j.druh === 'kopat' || j.druh === 'schody' || j.druh === 'dira')) S.pribeh.hlidejHloubku(hra, j.druh === 'dira' ? g + N : g);
    switch (j.druh) {
      case 'kopat':
        if (kopatelne(sv, g)) vykopej(hra, g);
        break;
      case 'schody': {
        const horni = j.horni;
        if (!j.dokoncit && kopatelne(sv, g)) vykopej(hra, g);
        if (!pevne(sv, horni) && !pevne(sv, horni + N) && hra.oznac[horni] === OZN.SCHODY) {
          sv.obj[horni] = O.SCHODY_DOLU; sv.obj[horni + N] = O.SCHODY_NAHORU;
          hra.oznac[horni] = 0; hra.prio[horni] = 0; hra.zachrana[horni] = 0; oznZmena(hra);
          const a = souradnice(sv, horni);
          sv.schody.push({ p: a.p, x: a.x, y: a.y, smer: 1 }, { p: a.p + 1, x: a.x, y: a.y, smer: -1 });
          zmenaTerenu(hra, horni); zmenaTerenu(hra, horni + N);
          zprava(hra, 'stavba', `Schodiště do ${a.p + 1}. patra je hotové.`, horni);
        }
        break;
      }
      case 'dira': {
        if (hra.oznac[g] !== OZN.DIRA || pevne(sv, g)) break;
        hra.oznac[g] = 0; hra.prio[g] = 0; hra.zachrana[g] = 0; oznZmena(hra);
        if (kopatelne(sv, g + N)) vykopej(hra, g + N);
        sv.obj[g] = O.DIRA;
        zmenaTerenu(hra, g);
        S.priroda.aktivuj(hra, g); S.priroda.aktivuj(hra, g + N);
        for (const v of hra.veci) if (v.g === g) v.g = g + N;          // věci propadnou
        for (const x of hra.trpaslici) if (x.g === g && !x.mrtvy) S.hra.spadni(hra, x);
        break;
      }
      case 'otesat': {
        if (hra.oznac[g] !== OZN.OTESAT || pevne(sv, g)) break;
        hra.oznac[g] = 0; hra.prio[g] = 0; oznZmena(hra);
        sv.otes[g] = 1; if (sv.podlaha[g] === P.SUROVA || sv.podlaha[g] === P.HLINA || sv.podlaha[g] === P.STERK || sv.podlaha[g] === P.MECH) sv.podlaha[g] = P.DLAZBA;
        const { W, H } = sv, a = souradnice(sv, g);
        for (const [dx, dy] of C.SMERY) {
          const X = a.x + dx, Y = a.y + dy;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const h = g + dy * W + dx;
          if (!SV.prirodni(sv.teren[h])) continue;
          if (sv.ruda[h] && Z_RUDY[sv.ruda[h]]) novaVec(hra, Z_RUDY[sv.ruda[h]], g);
          sv.teren[h] = M.CIHLA; sv.ruda[h] = R.NIC;
          zmena(hra, h);
        }
        zmenaTerenu(hra, g);
        break;
      }
      case 'cist': S.pribeh.prectiDesku(hra, g); break;
      case 'poklad': S.pribeh.vynesPoklad(hra, g, t); break;
      case 'kacet': {
        const o = sv.obj[g];
        if (o !== O.JEDLE && o !== O.HOUBA) break;
        hra.oznac[g] = 0; hra.prio[g] = 0; oznZmena(hra);
        if (o === O.JEDLE) {
          sv.obj[g] = O.PAREZ;
          for (let k = 0; k < 3; k++) novaVec(hra, 'drevo', t.g);
          hra.parezy.push({ g, kdy: hra.tik + 4 * S.hra.TAHU_ZA_DEN });
        } else {
          sv.obj[g] = O.NIC;
          for (let k = 0; k < 2; k++) { novaVec(hra, 'houby', t.g); novaVec(hra, 'drevo', t.g); }
        }
        zmenaTerenu(hra, g);
        break;
      }
      case 'stavet': {
        const plan = S.stavby.planPodle(hra, j.plan);
        if (plan && S.stavby.kompletni(plan)) S.stavby.postav(hra, plan);
        break;
      }
      case 'zasit': S.stavby.zasej(hra, g); break;
      case 'pumpovat': { const b = S.stavby.budovaPodle(hra, j.pumpa); if (b) S.priroda.odcerpej(hra, b); break; }
      case 'sklidit': S.stavby.sklid(hra, g, t); break;
      case 'vyrobit': {
        const d = S.stavby.budovaPodle(hra, j.dilna);
        if (d) S.stavby.vyrob(hra, d, j.misto, t);
        break;
      }
    }
    hra.zmenaPraci++;
  }

  // --- viditelnost ------------------------------------------------------------------
  function poznej(hra, g) {
    if (hra.sv.zn[g]) return false;
    hra.sv.zn[g] = 1; zmena(hra, g);
    if (hra.sv.teren[g] === M.VOLNO) hra.verzeTerenu++;          // průchodnost mění jen poznané volné pole
    return true;
  }
  // po vykopání: pole a jeho sousedé jsou známí; prorazí-li se do jeskyně, odhalí se celá
  function odhalOkoli(hra, g) {
    const sv = hra.sv, { W, H } = sv, a = souradnice(sv, g);
    poznej(hra, g);
    for (const [dx, dy] of C.SMERY) {
      const X = a.x + dx, Y = a.y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const h = g + dy * W + dx;
      poznej(hra, h);
      const ob = sv.oblast[h];
      if (ob && sv.teren[h] === M.VOLNO && !hra.objeveno[ob]) odhalOblast(hra, ob);
    }
  }
  function odhalOblast(hra, id) {
    const sv = hra.sv, o = sv.oblasti[id], { W, H, N } = sv;
    hra.objeveno[id] = 1;
    for (let y = Math.max(0, o.y0 - 1); y <= Math.min(H - 1, o.y1 + 1); y++) for (let x = Math.max(0, o.x0 - 1); x <= Math.min(W - 1, o.x1 + 1); x++) {
      const g = o.p * N + y * W + x;
      let blizko = sv.oblast[g] === id;
      if (!blizko) for (const [dx, dy] of C.SMERY) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && sv.oblast[g + dy * W + dx] === id) { blizko = true; break; }
      }
      if (blizko) poznej(hra, g);
    }
    if (o.p > 0 && o.typ !== 'schody') zprava(hra, 'objev', `Objevili jsme: ${SV.TYPY_OBLASTI[o.typ]} (${o.p}. patro).`, o.p * N + Math.floor(o.sy) * W + Math.floor(o.sx));
    if (o.p > 0 && S.hrozby && !hra.bezTvoru) S.hrozby.probudJeskyni(hra, o);
    if (S.pribeh && sv.srdce && id === sv.srdce.oblast) S.pribeh.objevenoSrdce(hra);
  }
  // zorné pole trpaslíka (paprsky do vzdálenosti r, skála zastaví pohled, ale sama je vidět)
  const PAPRSKY = (() => {
    const r = 8, v = [];
    for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; v.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return v;
  })();
  function rozhledni(hra, g) {
    const sv = hra.sv, { W, H, N } = sv, a = souradnice(sv, g), zaklad = a.p * N;
    for (const [ex, ey] of PAPRSKY) {
      const kroku = Math.ceil(Math.max(Math.abs(ex), Math.abs(ey)));
      for (let k = 1; k <= kroku; k++) {
        const X = Math.round(a.x + ex * k / kroku), Y = Math.round(a.y + ey * k / kroku);
        if (X < 0 || Y < 0 || X >= W || Y >= H) break;
        const h = zaklad + Y * W + X;
        poznej(hra, h);
        if (sv.teren[h] !== M.VOLNO) break;
      }
    }
  }

  // zvukové události pro prohlížeč (neukládají se; UI je každý snímek vybere a zahraje, přidá částice)
  function zvuk(hra, typ, g, x) {
    const z = hra._zvuky || (hra._zvuky = []);
    if (z.length < 80) z.push({ typ, g: g === undefined ? -1 : g, x });
  }
  const ZVUK_ZPRAVY = { objev: 'objev', smrt: 'smrt', varovani: 'varovani' };
  function zprava(hra, typ, text, g) {
    const zv = typ === 'boj' && /SPÁČ/.test(text) ? 'rev' : typ === 'pribeh' && text.startsWith('📜') ? 'deska' : ZVUK_ZPRAVY[typ];
    if (zv) zvuk(hra, zv);
    hra.denik.push({ tik: hra.tik, typ, text, g: g === undefined ? -1 : g });
    if (hra.denik.length > 200) hra.denik.shift();
  }

  S.prace = { OZN, OZN_NAZEV, SKUPINA, VECI, nahoda, souradnice, pevne, kopatelne, stojiskaKolem,
              lzeOznacit, oznac, zrusOznaceni, prednost,
              Z_RUDY, novaVec, vecPodle, odeberVec, prestavJednotky, dobaKopani, dobaJednotky, dokonci, vykopej,
              zmenaTerenu, zmena, poznej, odhalOkoli, odhalOblast, rozhledni, zprava, zvuk, znacky, oznZmena };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;
