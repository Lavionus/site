/* ============================================================
   Srdce hory – hra.js: stav hry a jeden tah simulace.

   Simulace běží v pevných tazích (10 tahů = 1 s při rychlosti 1×),
   je deterministická ze seedu a nesahá na DOM – dá se spustit
   v node libovolně rychle. Den = 600 tahů (minuta při 1×).

   Práce, které si trpaslík sám najde (nejbližší vyhrává):
     kopat   – označené pole v dosahu
     kacet   – označený strom vedle sebe
     stavet  – plán stavby, na který už je donesený všechen materiál
     donest  – věc, kterou potřebuje plán stavby nebo rozpracovaný výrobek v dílně
     vyrobit – výroba v dílně, kam už je donesený všechen materiál (jen řemeslník dílny)
     vybavit – vyzvednout si nástroj, který se hodí k řemeslu (krumpáč, sekera, kladivo)
     odnes   – věc, která neleží ve skladu, který ji přijímá
     pole    – zasít nebo sklidit pole v zóně pole/houbárna
   Potřeby (jist, pit, spat) mají přednost; kritický hlad práci přeruší.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, UDOLI, O } = T.hora;
  const C = T.cesty, P = T.prace, S = T.stavby, POT = T.potreby;
  const N = W * H;
  const TAHU_ZA_DEN = 600;
  const DOBA = { chuze: 4, nese: 5, pad: 3, preskok: 7, schod: 6, lez: 6, dolu: 5, padani: 2, zvednout: 4, kacet: 40 };

  const JMENA = ['Durin', 'Dvalin', 'Nár', 'Náin', 'Dáin', 'Bívor', 'Bávor', 'Bombur', 'Nóri', 'Ánar', 'Óin', 'Glóin',
    'Dóri', 'Ori', 'Fíli', 'Kíli', 'Torin', 'Víli', 'Skirfir', 'Virfir', 'Alfr', 'Hanar', 'Frár', 'Hornbori',
    'Lóni', 'Jari', 'Eikin', 'Grerr', 'Brokk', 'Sindri', 'Alvís', 'Andvari', 'Fjalar', 'Galar', 'Regin', 'Hreidmar'];
  const PROFESE = {
    hornik:  { nazev: 'horník', barva: '#d6a82a', kopani: 6 },
    tesar:   { nazev: 'tesař', barva: '#3f7f3a', kopani: 1 },
    kamenik: { nazev: 'kameník', barva: '#8a8f9a', kopani: 3 },
    kovar:   { nazev: 'kovář', barva: '#b23a2a', kopani: 2 },
    sladek:  { nazev: 'sládek', barva: '#b8732e', kopani: 1 },
    farmar:  { nazev: 'farmář', barva: '#7c9a2a', kopani: 1 },
    strazce: { nazev: 'strážce', barva: '#3456a0', kopani: 2 },
  };
  const VOUSY = ['#7a4a22', '#b5542a', '#2a2420', '#8f8a82', '#d98a3a', '#e8e2d6', '#c9a560'];

  function novaHra(seed, rezim) {
    const hora = T.hora.generuj(seed);
    const hra = {
      verze: 9, seed: hora.seed, hora, rezim: 'kampan',
      prectene: [], deskyPrectene: [], odemceno: {}, artefakty: {}, spac: { probuzen: false, porazen: false, id: 0 },
      zazehnuti: 0, vyhenHori: false, konec: null, maxTrp: 7, padlo: 0,
      znamo: T.hora.pocatecniZnamo(hora),
      lez: new Uint8Array(N),                    // 1 = vytesané schodiště, 2 = žebřík
      oznac: new Uint8Array(N),                  // označené práce (P.OZN)
      stavba: new Uint8Array(N),                 // postavené stavby (S.K)
      zona: new Uint8Array(N),                   // číslo zóny (sklad, místnost, farma)
      prio: new Uint8Array(N),                   // přednostní kopání (⭐)
      uroda: new Uint8Array(N),                  // farmy: 0 prázdné, 1–100 roste, 101 zralé
      svetloZmena: 0,                            // zvýší se při změně tvaru hory nebo loučí
      vykopane: new Uint8Array(N),               // pole vykopaná trpaslíky (přírodní jeskyně drží)
      tvorove: [], dalsiNajezd: 36 * TAHU_ZA_DEN, pastiNapnout: [], zabito: 0, najezdu: 0,
      zavreno: new Uint8Array(N), stavbaStav: new Uint8Array(N),   // zavřené mříže; stav pastí a poškození dveří
      praskani: [], prameny: [], stabilitaZmena: 1, stabilitaKlid: 0, vodaKlid: false, klidKroku: 0, odteklo: 0, odcerpano: 0,
      zony: [], plany: [], dilny: [], parezy: [],
      planNa: new Map(), materialNa: new Map(),  // odvozené: pole → plán, pole → materiál nábytku
      trpaslici: [], veci: [], rez: new Map(),   // rez: pole → id trpaslíka, který ho kope / kácí
      tik: 0, dalsiId: 1, rng: (hora.seed ^ 0x2545F491) | 0,
      denik: [], nalezeno: {}, objeveno: {}, vykopano: 0, nejhloubeji: 0,
      slava: 0, slavaBonus: 0, karavana: null, udalost: null, posledniDar: 0,
    };
    const { brana } = hora;
    // výchozí sklad: podlaha předsíně
    S.novaZona(hra, brana.x + 1, brana.y, brana.x + 5, brana.y, 'sklad', 'vse');
    const prof = ['hornik', 'hornik', 'kamenik', 'tesar', 'kovar', 'sladek', 'farmar'];
    const jmena = JMENA.slice();
    for (let k = 0; k < prof.length; k++) {
      const j = jmena.splice(Math.floor(P.nahoda(hra) * jmena.length), 1)[0];
      const x = k < 3 ? brana.x - 3 + k : brana.x + 1 + (k - 3);
      pridejTrpaslika(hra, j, prof[k], brana.y * W + x);
    }
    // zásoby, se kterými klan přišel: dřevo na první žebříky a dílnu, jídlo a pivo zhruba na pět dní
    for (let k = 0; k < 6; k++) P.novaVec(hra, 'drevo', brana.y * W + brana.x + 1 + (k % 3), 'drevo');
    for (let k = 0; k < 30; k++) P.novaVec(hra, 'jidlo', brana.y * W + brana.x + 4 + (k & 1), 0);
    for (let k = 0; k < 30; k++) P.novaVec(hra, 'pivo', brana.y * W + brana.x + 2 + (k & 1), 0);
    for (let k = 0; k < 2; k++) P.novaVec(hra, 'krumpac', brana.y * W + brana.x + 1, 'med');   // staré měděné krumpáče
    zprava(hra, 'pribeh', `Klan dorazil k Bráně předků hory ${hora.nazev}. Hora mlčí.`);
    if (rezim === 'volny') hra.rezim = 'volny';
    return hra;
  }
  function pridejTrpaslika(hra, jmeno, prof, i) {
    const t = {
      id: hra.dalsiId++, jmeno, prof,
      vous: VOUSY[Math.floor(P.nahoda(hra) * VOUSY.length)],
      i, o: i, t: 0, dur: 0, smer: P.nahoda(hra) < 0.5 ? 1 : -1,
      stav: 'nic', prace: null, cesta: [], nese: 0, akce: 0, akceDoba: 0,
      zdravi: 100, dov: { kopani: PROFESE[prof].kopani }, zkusenost: 0, pad: 0, cekej: 0, hledej: 0, uvizl: false,
    };
    POT.vychozi(t);
    t.nastroj = null; t.zbran = null; t.zbroj = null; t.dov.boj = prof === 'strazce' ? 3 : 0; t.utok = 0;
    t.povoleno = { kopat: 1, kacet: 1, stavet: 1, nosit: 1, pole: 1, remeslo: 1, hlidat: prof === 'strazce' ? 1 : 0 };
    hra.trpaslici.push(t);
    return t;
  }

  function noveJmeno(hra, vyloucit) {
    const pouzita = new Set(hra.trpaslici.map(t => t.jmeno).concat(vyloucit || []));
    const volna = JMENA.filter(j => !pouzita.has(j));
    if (volna.length) return volna[Math.floor(P.nahoda(hra) * volna.length)];
    return JMENA[Math.floor(P.nahoda(hra) * JMENA.length)] + ' ' + ['mladší', 'z Údolí', 'Kamenný', 'Rudovous'][Math.floor(P.nahoda(hra) * 4)];
  }
  function nahodnaProfese(hra) { const k = Object.keys(PROFESE); return k[Math.floor(P.nahoda(hra) * k.length)]; }
  // zvukové a vizuální události pro prohlížeč (neukládají se; UI je každý snímek vybere)
  function zvuk(hra, typ, i, x) {
    const z = hra._zvuky || (hra._zvuky = []);
    if (z.length < 80) z.push({ typ, i: i === undefined ? -1 : i, x });
  }
  function zprava(hra, typ, text) {
    if (typ === 'objev' || typ === 'nalez') zvuk(hra, 'objev');
    else if (typ === 'smrt') zvuk(hra, 'smrt');
    hra.denik.push({ tik: hra.tik, typ, text });
    if (hra.denik.length > 200) hra.denik.shift();
  }

  // --- pomocné -------------------------------------------------------------------------
  const vecPodle = (hra, id) => hra.veci.find(v => v.id === id);
  const dilnaPodle = (hra, id) => hra.dilny.find(d => d.id === id);
  function smiVDilne(hra, t, d) {                 // dílnu obsluhuje její řemeslník, jen když žádný není, kdokoli
    const prof = S.PROFESE_DILNY[d.typ];
    return hra.trpaslici.some(u => u.prof === prof) ? t.prof === prof : true;
  }
  const receptPro = (d, z) => S.RECEPTY[d.typ][z.r];
  // počty věcí podle druhu (i nesených) – pro trvalé zakázky „udržuj zásobu"
  function pocty(hra) { const m = {}; for (const v of hra.veci) m[v.druh] = (m[v.druh] || 0) + 1; return m; }
  function aktivni(d, z, pocet) {
    const vRobe = d.vRobe && d.vRobe.zak === z.id ? 1 : 0;
    if (z.trvala) { const rc = receptPro(d, z); return (pocet[rc.vyrobek] || 0) + vRobe * (rc.pocet || 1) < z.cil; }
    return z.zbyva - vRobe > 0;
  }
  // dílna bez rozpracovaného výrobku si vezme první zakázku, na kterou je materiál
  function pripravDilny(hra) {
    let volne = null, pocet = null;
    for (const d of hra.dilny) {
      if (d.vRobe || !d.fronta.length) continue;
      if (!volne) {
        volne = {}; pocet = pocty(hra);
        for (const v of hra.veci) if (!v.nese && !v.rez) volne[v.druh] = (volne[v.druh] || 0) + 1;
      }
      d.fronta = d.fronta.filter(z => !T.pribeh.artefaktZakazany(hra, receptPro(d, z).vyrobek));
      for (const z of d.fronta) {
        if (!aktivni(d, z, pocet)) continue;
        const m = S.materialReceptu(receptPro(d, z));
        if (Object.entries(m).some(([druh, n]) => (volne[druh] || 0) < n)) continue;
        d.vRobe = { zak: z.id, doneseno: {}, vCeste: {} };
        for (const druh of Object.keys(m)) { d.vRobe.doneseno[druh] = 0; d.vRobe.vCeste[druh] = 0; volne[druh] -= m[druh]; }
        break;
      }
    }
  }
  function chybiDilne(hra, d, druh) {
    if (!d.vRobe) return 0;
    const z = d.fronta.find(z => z.id === d.vRobe.zak);
    if (!z) return 0;
    return (S.materialReceptu(receptPro(d, z))[druh] || 0) - (d.vRobe.doneseno[druh] || 0) - (d.vRobe.vCeste[druh] || 0);
  }
  function dilnaPripravena(d) {
    if (!d.vRobe) return false;
    const z = d.fronta.find(z => z.id === d.vRobe.zak);
    if (!z) return false;
    return Object.entries(S.materialReceptu(receptPro(d, z))).every(([druh, n]) => (d.vRobe.doneseno[druh] || 0) >= n);
  }
  // nástroje
  function faktorNastroje(t, prace) {
    const n = t.nastroj, d = n && S.NASTROJE[n.druh];
    return d && d.prace.includes(prace) ? d[n.mat] || 1 : 1;
  }
  function opotrebuj(hra, t, prace) {
    const n = t.nastroj;
    if (!n || !S.NASTROJE[n.druh].prace.includes(prace)) return;
    n.stav -= S.OPOTREBENI[n.mat] || 2;
    if (n.stav <= 0) {
      zprava(hra, 'nalez', `${t.jmeno} zlomil ${P.VECI[n.druh].nazev === 'kladivo' ? 'kladivo' : P.VECI[n.druh].nazev}. Bude potřeba nový.`);
      t.nastroj = null;
    }
  }

  // --- pohyb ------------------------------------------------------------------------
  function presun(t, cil, doba) {
    const dx = cil % W - t.i % W;
    if (dx) t.smer = dx > 0 ? 1 : -1;
    t.o = t.i; t.i = cil; t.t = 0; t.dur = doba;
  }
  function pustPraci(hra, t) {
    const p = t.prace;
    if (p) {
      if ((p.typ === 'kopat' || p.typ === 'kacet' || p.typ === 'pole' || p.typ === 'pumpovat' || p.typ === 'cist') && hra.rez.get(p.c) === t.id) hra.rez.delete(p.c);
      if (p.vec) { const v = vecPodle(hra, p.vec); if (v && v.rez === t.id) v.rez = 0; }
      if (p.typ === 'stavet') { const pl = S.planPodle(hra, p.plan); if (pl && pl.rez === t.id) pl.rez = 0; }
      if (p.typ === 'donest' && p.vCeste && p.plan) { const pl = S.planPodle(hra, p.plan); if (pl) pl.vCeste[p.druh]--; }
      if (p.typ === 'donest' && p.vCeste && p.dilna) { const d = dilnaPodle(hra, p.dilna); if (d && d.vRobe) d.vRobe.vCeste[p.druh]--; }
      if (p.typ === 'vyrobit') { const d = dilnaPodle(hra, p.dilna); if (d && d.rez === t.id) d.rez = 0; }
    }
    if (t.nese) {                                // co nese, položí, kde stojí
      const v = vecPodle(hra, t.nese);
      if (v) { v.nese = 0; v.rez = 0; v.i = t.i; }
      t.nese = 0;
      P.usadVeci(hra);
    }
    t.prace = null; t.cesta = []; t.akce = 0; t.stav = 'nic';
  }

  function deskaKPrecteni(hra) {
    for (const o of hra.hora.ruiny) if (hra.objeveno[o.cislo])
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) {
        const i = y * W + x;
        if (hra.hora.obj[i] === O.DESKA && hra.znamo[i] && !hra.deskyPrectene.includes(i) && !hra.rez.has(i)) return true;
      }
    return false;
  }

  function najdiPraci(hra, t) {
    // volné věci podle pole
    const naPoli = new Map();
    for (const v of hra.veci) {
      if (v.nese || v.rez || v.blok > hra.tik) continue;
      const a = naPoli.get(v.i); if (a) a.push(v); else naPoli.set(v.i, [v]);
    }
    // kdo co potřebuje (plány staveb, zakázky dílen)
    const potreba = new Map();
    const pridej = (druh, s) => { const a = potreba.get(druh); if (a) a.push(s); else potreba.set(druh, [s]); };
    for (const p of hra.plany) {
      if (p.blok > hra.tik) continue;             // na plán se teď nikdo nedostane
      if (!C.volne(hra, p.i)) continue;             // pole se teprve vykope – materiál až potom
      for (const druh of Object.keys(S.STAVBY[p.typ].mat)) if (S.chybi(p, druh) > 0) pridej(druh, { plan: p });
    }
    const pov = t.povoleno;
    if (!pov.nosit) potreba.clear();
    else for (const d of hra.dilny) if (d.vRobe) for (const druh of Object.keys(d.vRobe.doneseno)) if (chybiDilne(hra, d, druh) > 0) pridej(druh, { dilna: d });
    const pref = !t.nastroj && S.PREFERUJE[t.prof];
    const zimaTed = T.obdobi.zima(hra);
    // které druhy nějaký sklad přijímá
    const prijima = new Set();
    for (const z of hra.zony) if (z.typ === 'sklad') for (const d of (z.druh === 'vse' ? Object.keys(P.VECI) : S.SKUPINY[z.druh].druhy)) prijima.add(d);

    // přednostní kopání má přednost před vším ostatním
    if (pov.kopat && hra.prio.some(v => v)) {
      const rp = C.hledej(hra, t.i, i => { const c = P.cilKopani(hra, i, hra.rez, true); return c >= 0 ? { typ: 'kopat', c, pos: i } : 0; });
      if (rp) { hra.rez.set(rp.hodnota.c, t.id); t.prace = rp.hodnota; t.cesta = rp.cesta; t.stav = 'jde'; t.akce = 0; return true; }
    }
    // Klíč k Srdci: jakmile je Srdce objevené, zažehnutí má přednost
    const klic = pov.remeslo && !hra.vyhenHori && !(t.klicBlok > hra.tik) && hra.znamo[hra.hora.srdce.y * W + hra.hora.srdce.x] && hra.veci.find(v => v.druh === 'klic' && !v.nese && !v.rez && !(v.blok > hra.tik));
    if (klic) {
      const rk = C.hledej(hra, t.i, i => i === klic.i ? { typ: 'zazehnout', vec: klic.id, pos: i, faze: 'k_veci' } : 0);
      if (rk) { klic.rez = t.id; t.prace = rk.hodnota; t.cesta = rk.cesta; t.stav = 'jde'; t.akce = 0; return true; }
      t.klicBlok = hra.tik + 100;
    }
    // nalezenou runovou desku jde řemeslník přečíst přednostně
    if (pov.remeslo && !(hra.deskaBlok > hra.tik) && hra.hora.ruiny.some(o => hra.objeveno[o.cislo]) && deskaKPrecteni(hra)) {
      const rd = C.hledej(hra, t.i, i => hra.hora.obj[i] === O.DESKA && hra.znamo[i] && !hra.deskyPrectene.includes(i) && !hra.rez.has(i) && C.stojne(hra, i) ? { typ: 'cist', c: i, pos: i } : 0);
      if (rd) { hra.rez.set(rd.hodnota.c, t.id); t.prace = rd.hodnota; t.cesta = rd.cesta; t.stav = 'jde'; t.akce = 0; return true; }
      hra.deskaBlok = hra.tik + 100;                // zatím se k ní nikdo nedostane
    }
    // materiál, na který čeká dílna nebo plán, se nosí dřív než úklid do skladu
    const donest = i => {
      const vv = naPoli.get(i);
      if (vv) for (const v of vv) {
        const kdo = (potreba.get(v.druh) || []).find(s => s.plan ? S.chybi(s.plan, v.druh) > 0 : chybiDilne(hra, s.dilna, v.druh) > 0);
        if (kdo) return kdo.plan ? { typ: 'donest', vec: v.id, druh: v.druh, plan: kdo.plan.id, pos: i, faze: 'k_veci' }
                                 : { typ: 'donest', vec: v.id, druh: v.druh, dilna: kdo.dilna.id, pos: i, faze: 'k_veci' };
      }
      return 0;
    };
    // plán s donesenou vším materiálem se staví dřív než ostatní práce (materiál by jinak ležel ladem)
    const stavet = i => {
      const x = i % W;
      for (const [dx, dy] of S.STAV_DOSAH) {
        const j = i + dy * W + dx;
        if (j < 0 || j >= N || Math.abs((j % W) - x) > 1) continue;
        const pid = hra.planNa.get(j);
        if (!pid) continue;
        const p = S.planPodle(hra, pid);
        if (p && !p.rez && S.pripraven(p) && S.planVDosahu(hra, i, p) && C.volne(hra, p.i)) return { typ: 'stavet', plan: p.id, pos: i };
      }
      return 0;
    };
    let r = null;
    if (pov.stavet && !(t.stavetBlok > hra.tik) && hra.plany.some(p => !p.rez && S.pripraven(p) && C.volne(hra, p.i))) {
      r = C.hledej(hra, t.i, stavet);
      if (!r) t.stavetBlok = hra.tik + 60;
    }
    if (!r && potreba.size && !(t.donestBlok > hra.tik)) {
      r = C.hledej(hra, t.i, donest);
      if (!r) t.donestBlok = hra.tik + 60;
    }
    if (!r) r = C.hledej(hra, t.i, i => {
      if (pov.kopat) { const c = P.cilKopani(hra, i, hra.rez); if (c >= 0) return { typ: 'kopat', c, pos: i }; }
      const x = i % W;
      if (pov.kacet) for (const j of [i, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
        if (j >= 0 && hra.oznac[j] === P.OZN.KACET && hra.hora.obj[j] === O.STROM && !hra.rez.has(j)) return { typ: 'kacet', c: j, pos: i };
      }
      if (pov.remeslo && hra.hora.obj[i] === O.DESKA && hra.znamo[i] && !hra.deskyPrectene.includes(i) && !hra.rez.has(i) && C.stojne(hra, i))
        return { typ: 'cist', c: i, pos: i };
      if (pov.nosit && hra.stavba[i] === S.K.PUMPA && !hra.rez.has(i) && T.priroda.vodaUPumpy(hra, i) >= 0) return { typ: 'pumpovat', c: i, pos: i };
      if (pov.remeslo && hra.stavba[i] === S.K.DILNA) {
        const d = S.dilnaNa(hra, i);
        if (d && !d.rez && dilnaPripravena(d) && smiVDilne(hra, t, d) && C.stojne(hra, i)) return { typ: 'vyrobit', dilna: d.id, pos: i };
      }
      if (pov.pole && hra.zona[i] && hra.uroda[i] % 101 === 0 && !hra.rez.has(i)) {
        const z = S.zonaNa(hra, i);
        if (z && S.FARMY[z.typ] && C.stojne(hra, i) && !(z.typ === 'pole' && zimaTed)) return { typ: 'pole', c: i, pos: i };
      }
      if (pov.stavet) { const st = stavet(i); if (st) return st; }
      const dn = donest(i); if (dn) return dn;
      const vv = naPoli.get(i);
      if (vv) for (const v of vv) {
        if (v.druh === 'klic' && pov.remeslo && !hra.vyhenHori && hra.znamo[hra.hora.srdce.y * W + hra.hora.srdce.x])
          return { typ: 'zazehnout', vec: v.id, pos: i, faze: 'k_veci' };
        if (pref && v.druh === pref) return { typ: 'vybavit', vec: v.id, pos: i, faze: 'k_veci' };
        if (pov.hlidat && ((!t.zbran && v.druh === 'valecna_sekera') || (!t.zbroj && v.druh === 'zbroj'))) return { typ: 'vybavit', vec: v.id, pos: i, faze: 'k_veci' };
        if (pov.nosit && !S.prijme(hra, i, v.druh) && prijima.has(v.druh)) return { typ: 'odnes', vec: v.id, pos: i, faze: 'k_veci' };
      }
      return 0;
    });
    if (!r) return false;
    const p = r.hodnota;
    if (p.typ === 'kopat' || p.typ === 'kacet' || p.typ === 'pole' || p.typ === 'pumpovat' || p.typ === 'cist') hra.rez.set(p.c, t.id);
    else if (p.typ === 'stavet') S.planPodle(hra, p.plan).rez = t.id;
    else if (p.typ === 'vyrobit') dilnaPodle(hra, p.dilna).rez = t.id;
    else {
      vecPodle(hra, p.vec).rez = t.id;
      if (p.typ === 'donest' && p.plan) { S.planPodle(hra, p.plan).vCeste[p.druh]++; p.vCeste = 1; }
      if (p.typ === 'donest' && p.dilna) { dilnaPodle(hra, p.dilna).vRobe.vCeste[p.druh]++; p.vCeste = 1; }
    }
    t.prace = p; t.cesta = r.cesta; t.stav = 'jde'; t.akce = 0;
    return true;
  }
  // nová cesta ke stejnému cíli (když se svět změnil)
  function preplanuj(hra, t) {
    const cil = t.prace.pos;
    const r = C.hledej(hra, t.i, i => i === cil ? 1 : 0);
    if (!r) return false;
    t.cesta = r.cesta;
    return true;
  }
  // zvednutí věci, kterou má trpaslík v práci (vrací věc, nebo null když tu už není)
  function zvedni(hra, t, p) {
    const v = vecPodle(hra, p.vec);
    if (!v || v.nese || v.i !== t.i) { pustPraci(hra, t); return null; }
    t.stav = 'zveda';
    if (++t.akce < DOBA.zvednout) return false;
    t.akce = 0;
    v.nese = t.id; t.nese = v.id;
    return v;
  }
  function jdi(hra, t, p, cil, zaseknuto) {      // naplánuje cestu k prvnímu poli, kde cil(i)
    const r = C.hledej(hra, t.i, i => cil(i) ? 1 : 0);
    if (!r) { zaseknuto(); return false; }
    p.pos = r.i; p.faze = 'k_cili'; t.cesta = r.cesta;
    return true;
  }
  function poloz(hra, t) {                        // položí nesenou věc na místo, kde stojí
    const v = vecPodle(hra, t.nese);
    if (v) { v.nese = 0; v.rez = 0; v.i = t.i; }
    t.nese = 0;
    P.usadVeci(hra);
  }
  function hotovo(t, pauza) { t.prace = null; t.akce = 0; t.stav = 'nic'; t.cekej = pauza || 1; }

  function krokTrpaslika(hra, t) {
    if (t.t < t.dur) { t.t++; if (t.t < t.dur) return; }
    t.o = t.i; t.t = t.dur = 0;
    // gravitace
    if (!C.stojne(hra, t.i)) {
      const d = t.i + W;
      if (d < N && C.volne(hra, d)) { presun(t, d, DOBA.padani); t.pad++; t.stav = 'pada'; return; }
    }
    if (t.pad) {
      const vyska = t.pad; t.pad = 0;
      if (vyska > C.MAX_PAD) {
        t.zdravi -= 15 * (vyska - C.MAX_PAD);
        if (t.zdravi <= 0) { umri(hra, t, `${t.jmeno} spadl z výšky ${vyska} polí a zabil se.`); return; }
        zprava(hra, 'zraneni', `${t.jmeno} spadl z výšky ${vyska} polí a zranil se.`);
      }
      t.stav = t.prace ? 'jde' : 'nic';
    }
    const y = t.i / W | 0;
    if (y - UDOLI > hra.nejhloubeji) hra.nejhloubeji = y - UDOLI;
    hlidejUviznuti(hra, t);
    const smrt = POT.tik(hra, t);
    if (smrt) { umri(hra, t, `${t.jmeno} zemřel ${smrt}.`); return; }
    if (t.hledejPotrebu > 0) t.hledejPotrebu--;
    // nemocný leží (horečka z události)
    if (t.nemoc > hra.tik) { if (t.prace) pustPraci(hra, t); t.stav = 'spi'; t.spanek = Math.min(100, t.spanek + 0.3); return; }
    // záchvat vzteku po dlouhé zlé náladě; druhý v témž období = odchod z hory
    if (t.zlost >= 1200 && !(t.zuri > hra.tik)) {
      pustPraci(hra, t); t.zlost = 0;
      t.zachvaty = (t.zachvaty || 0) + 1;
      if (t.zachvaty >= 2) { odejdi(hra, t); return; }
      t.zuri = hra.tik + 400;
      zprava(hra, 'zraneni', `${t.jmeno} má záchvat vzteku! Kope do zdí a nechce pracovat.`);
    }
    if (t.zuri > hra.tik) { t.stav = 'zuri'; toulej(hra, t, true); return; }
    if (hra.tvorove.length && T.hrozby.branSe(hra, t, (typ, text) => zprava(hra, typ, text))) { t.stav = 'bojuje'; return; }
    if (t.prace && t.prace.typ === 'cvicit' && hra.tvorove.length) pustPraci(hra, t);
    if (t.cekej > 0) { t.cekej--; return; }
    // kritická potřeba přeruší práci
    const potrebova = p0 => p0 && (p0.typ === 'jist' || p0.typ === 'pit' || p0.typ === 'spat');
    if (t.prace && !potrebova(t.prace) && POT.kriticke(hra, t) && !t.hledejPotrebu) pustPraci(hra, t);

    if (!t.prace) {
      if (POT.potrebuje(hra, t) && !t.hledejPotrebu) {
        const r = POT.najdi(hra, t);
        if (r) {
          const p = r.hodnota;
          if (p.vec) vecPodle(hra, p.vec).rez = t.id;
          t.prace = p; t.cesta = r.cesta; t.stav = 'jde'; t.akce = 0;
        } else t.hledejPotrebu = 60;
      }
    }
    if (!t.prace && t.povoleno.hlidat && (hra.tvorove.length || hra.tik % 30 === t.id % 30)) {
      const r = T.hrozby.praceStrazce(hra, t);
      if (r) { t.prace = r.hodnota; t.cesta = r.cesta; t.stav = 'jde'; t.akce = 0; }
    }
    if (!t.prace) {
      if (t.hledej > 0) { t.hledej--; toulej(hra, t); return; }
      if (!najdiPraci(hra, t)) { t.hledej = 15 + (t.id % 5); toulej(hra, t); return; }
    }
    const p = t.prace;
    // cesta
    while (t.cesta.length && t.cesta[0] === t.i) t.cesta.shift();
    if (t.cesta.length) {
      const dalsi = t.cesta[0];
      const typ = C.krok(hra, t.i, dalsi);
      if (!typ) { if (!preplanuj(hra, t)) { pustPraci(hra, t); t.hledej = 5; } return; }
      t.cesta.shift();
      t.stav = t.nese ? 'nese' : 'jde';
      presun(t, dalsi, typ === 'chuze' && t.nese ? DOBA.nese : DOBA[typ]);
      return;
    }
    if (t.i !== p.pos) { if (!preplanuj(hra, t)) { pustPraci(hra, t); t.hledej = 5; } return; }

    // práce na místě
    const natoc = c => { const dx = c % W - t.i % W; if (dx) t.smer = dx > 0 ? 1 : -1; };
    if (p.typ === 'kopat') {
      if (!hra.oznac[p.c] || hra.oznac[p.c] === P.OZN.KACET || !P.lzeKopat(hra, p.c) || !P.vDosahu(hra, t.i, p.c)) { pustPraci(hra, t); return; }
      if (!t.akce) t.akceDoba = Math.max(3, Math.round(P.dobaKopani(hra, p.c, t) / POT.rychlost(t) / faktorNastroje(t, 'kopat')));
      t.stav = 'kope'; natoc(p.c);
      if (t.akce % 8 === 4) zvuk(hra, 'uder', p.c, hra.hora.ruda[p.c] ? 100 + hra.hora.ruda[p.c] : hra.hora.teren[p.c]);
      if (++t.akce < t.akceDoba) return;
      hra.rez.delete(p.c);
      hotovo(t);
      zvuk(hra, 'vykop', p.c, hra.hora.teren[p.c]);
      P.vykopej(hra, p.c, (typ, text) => zprava(hra, typ, text));
      opotrebuj(hra, t, 'kopat');
      if (++t.zkusenost >= 6 + 2 * t.dov.kopani) { t.zkusenost = 0; if (t.dov.kopani < 20) t.dov.kopani++; }
      return;
    }
    if (p.typ === 'kacet') {
      if (hra.oznac[p.c] !== P.OZN.KACET || hra.hora.obj[p.c] !== O.STROM || Math.abs(p.c - t.i) > 1) { pustPraci(hra, t); return; }
      t.akceDoba = Math.round(DOBA.kacet / POT.rychlost(t) / faktorNastroje(t, 'kacet')); t.stav = 'kope'; natoc(p.c);
      if (t.akce % 8 === 4) zvuk(hra, 'sekera', p.c);
      if (++t.akce < t.akceDoba) return;
      hra.rez.delete(p.c);
      hotovo(t);
      opotrebuj(hra, t, 'kacet');
      P.skacej(hra, p.c);
      return;
    }
    if (p.typ === 'stavet') {
      const pl = S.planPodle(hra, p.plan);
      if (!pl || !S.pripraven(pl) || !S.planVDosahu(hra, t.i, pl) || !C.volne(hra, pl.i)) { pustPraci(hra, t); return; }
      t.akceDoba = Math.round(S.STAVBY[pl.typ].doba / POT.rychlost(t) / faktorNastroje(t, 'stavet') / T.pribeh.faktor(hra, 'stavet')); t.stav = 'kope'; natoc(pl.i);
      if (t.akce % 10 === 5) zvuk(hra, 'kladivo', pl.i);
      if (++t.akce < t.akceDoba) return;
      hotovo(t, 2);
      opotrebuj(hra, t, 'stavet');
      S.dokonci(hra, pl, t, (typ, text) => zprava(hra, typ, text));
      return;
    }
    if (p.typ === 'odnes') {
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        // nejbližší pole skladu, které věc přijme a kde ještě není plná hromada; jinak kterékoli, které ji přijme
        const pocet = new Map();
        for (const w of hra.veci) if (!w.nese) pocet.set(w.i, (pocet.get(w.i) || 0) + 1);
        const r = C.hledej(hra, t.i, i => S.prijme(hra, i, v.druh) && (pocet.get(i) || 0) < S.MAX_NA_POLI ? 1 : 0) ||
                  C.hledej(hra, t.i, i => S.prijme(hra, i, v.druh) ? 1 : 0);
        if (!r) {                                  // ke skladu se nedostane – položí věc a chvíli ji nechá být
          v.blok = hra.tik + 600;
          pustPraci(hra, t); t.hledej = 20; return;
        }
        p.faze = 'k_cili'; p.pos = r.i; t.cesta = r.cesta;
        return;
      }
      poloz(hra, t); hotovo(t, 2);
      return;
    }
    if (p.typ === 'donest' && p.dilna) {
      const d = dilnaPodle(hra, p.dilna);
      if (!d || !d.vRobe) { pustPraci(hra, t); return; }
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        jdi(hra, t, p, i => S.dilnaNa(hra, i) === d && C.stojne(hra, i), () => { vecPodle(hra, p.vec).blok = hra.tik + 300; pustPraci(hra, t); t.hledej = 20; });
        return;
      }
      if (S.dilnaNa(hra, t.i) !== d) { pustPraci(hra, t); return; }
      const v = vecPodle(hra, t.nese);
      hra.veci.splice(hra.veci.indexOf(v), 1);
      t.nese = 0;
      d.vRobe.doneseno[p.druh]++; d.vRobe.vCeste[p.druh]--;
      hotovo(t);
      return;
    }
    if (p.typ === 'donest') {
      const pl = S.planPodle(hra, p.plan);
      if (!pl) { pustPraci(hra, t); return; }
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        jdi(hra, t, p, i => S.planVDosahu(hra, i, pl), () => { pl.blok = hra.tik + 600; pustPraci(hra, t); t.hledej = 20; });
        return;
      }
      if (!S.planVDosahu(hra, t.i, pl)) { pustPraci(hra, t); return; }
      const v = vecPodle(hra, t.nese);
      hra.veci.splice(hra.veci.indexOf(v), 1);   // materiál se spotřebuje
      t.nese = 0;
      pl.doneseno[p.druh]++; pl.vCeste[p.druh]--;
      if (S.STAVBY[pl.typ].nabytek) pl.mat = v.mat;
      hotovo(t);
      return;
    }
    if (p.typ === 'vyrobit') {
      const d = dilnaPodle(hra, p.dilna);
      const z = d && d.vRobe && d.fronta.find(z => z.id === d.vRobe.zak);
      if (!z || !dilnaPripravena(d) || S.dilnaNa(hra, t.i) !== d) { pustPraci(hra, t); return; }
      const rc = receptPro(d, z);
      t.akceDoba = Math.round(rc.doba / POT.rychlost(t) / faktorNastroje(t, 'vyrobit') / T.pribeh.faktor(hra, 'vyrobit')); t.stav = 'kope';
      if (t.akce % 10 === 5) zvuk(hra, ['tavirna', 'kovarna', 'magmovyhen', 'runova_kovarna'].includes(d.typ) ? 'kovadlina' : 'dilna', t.i);
      if (++t.akce < t.akceDoba) return;
      if (rc.vyrobek.startsWith('art_')) T.pribeh.vyroben(hra, rc.vyrobek, t.i);
      else for (let k = 0; k < (rc.pocet || 1); k++) P.novaVec(hra, rc.vyrobek, t.i, rc.vmat);
      P.usadVeci(hra);
      d.vRobe = null; d.rez = 0;
      if (!z.trvala && --z.zbyva <= 0) d.fronta.splice(d.fronta.indexOf(z), 1);
      hotovo(t, 2);
      opotrebuj(hra, t, 'vyrobit');
      return;
    }
    if (p.typ === 'lov') { hotovo(t); return; }
    if (p.typ === 'cist') {
      if (hra.hora.obj[p.c] !== O.DESKA) { pustPraci(hra, t); return; }
      t.stav = 'ji';
      if (++t.akce < 120) return;
      hra.rez.delete(p.c); hotovo(t);
      T.pribeh.prectiDesku(hra, p.c);
      return;
    }
    if (p.typ === 'zazehnout') {
      const srdce = hra.hora.srdce.y * W + hra.hora.srdce.x;
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        jdi(hra, t, p, i => i === srdce, () => { vecPodle(hra, p.vec).blok = hra.tik + 600; pustPraci(hra, t); t.hledej = 30; });
        return;
      }
      if (t.i !== srdce || hra.vyhenHori) { pustPraci(hra, t); return; }
      t.stav = 'kope';
      if (T.pribeh.zazehni(hra, t)) { t.nese = 0; hotovo(t, 5); }
      return;
    }          // na místě: útok řeší obrana, jinak hledat dál
    if (p.typ === 'cvicit') {
      t.stav = 'kope';
      if (++t.akce < 300) return;
      t.dov.boj = Math.min(10, (t.dov.boj || 0) + 1);
      hotovo(t);
      return;
    }
    if (p.typ === 'pumpovat') {
      if (hra.stavba[p.c] !== S.K.PUMPA) { pustPraci(hra, t); return; }
      t.stav = 'kope';
      if (++t.akce % 12) return;
      if (!T.priroda.odcerpej(hra, p.c) || t.akce > 1200) { hra.rez.delete(p.c); hotovo(t); }
      return;
    }
    if (p.typ === 'vybavit') {
      const v = zvedni(hra, t, p); if (!v) return;
      hra.veci.splice(hra.veci.indexOf(v), 1);
      t.nese = 0;
      const kus = { druh: v.druh, mat: v.mat || 'zelezo', stav: 100 };
      if (v.druh === 'valecna_sekera') t.zbran = kus; else if (v.druh === 'zbroj') t.zbroj = kus; else t.nastroj = kus;
      hotovo(t);
      return;
    }
    if (p.typ === 'pole') {
      const z = S.zonaNa(hra, p.c), plodina = z && S.FARMY[z.typ];
      if (!plodina || hra.uroda[p.c] % 101 !== 0) { pustPraci(hra, t); return; }
      t.akceDoba = Math.round(20 / POT.rychlost(t)); t.stav = 'kope';
      if (++t.akce < t.akceDoba) return;
      hra.rez.delete(p.c);
      if (hra.uroda[p.c] === 101) { hra.uroda[p.c] = 0; P.novaVec(hra, plodina, p.c); P.novaVec(hra, plodina, p.c); P.usadVeci(hra); }
      else hra.uroda[p.c] = 1;
      hotovo(t);
      return;
    }
    if (p.typ === 'jist') {
      if (p.faze === 'k_veci') {
        const v = zvedni(hra, t, p); if (!v) return;
        const r = C.hledej(hra, t.i, i => POT.uStolu(hra, i) ? 1 : 0, 900);
        if (r) { p.faze = 'k_cili'; p.pos = r.i; p.stul = true; t.cesta = r.cesta; }
        else { p.faze = 'ji'; p.pos = t.i; }
        return;
      }
      if (p.faze === 'k_cili') p.faze = 'ji';
      t.stav = 'ji';
      if (++t.akce < 30) return;
      const v = vecPodle(hra, t.nese);
      if (v) {
        hra.veci.splice(hra.veci.indexOf(v), 1);
        t.jidlo = Math.min(100, t.jidlo + POT.NASYCENI[v.druh]);
        if (v.druh !== 'jidlo') POT.vzpominka(hra, t, 'jedl syrové ' + (v.druh === 'houby' ? 'houby' : 'zrní'), -5, 1);
        else if (p.stul) POT.vzpominka(hra, t, 'jedl u stolu v jídelně', 6, 1);
        else POT.vzpominka(hra, t, 'jedl na zemi', -3, 1);
      }
      t.nese = 0; hotovo(t);
      return;
    }
    if (p.typ === 'pit') {
      if (!p.voda && p.faze === 'k_veci') { const v = zvedni(hra, t, p); if (!v) return; p.faze = 'pije'; return; }
      t.stav = 'ji';
      const led = p.voda && POT.ledova(hra, t.i);
      if (++t.akce < (p.voda ? (led ? 45 : 25) : 20)) return;
      if (led) { t.piti = Math.min(100, t.piti + POT.NASYCENI.voda); POT.vzpominka(hra, t, 'prosekal led a pil ledovou vodu', -9, 1); }
      else if (p.voda) { t.piti = Math.min(100, t.piti + POT.NASYCENI.voda); POT.vzpominka(hra, t, 'pil jen vodu – žádné pivo!', -6, 1); }
      else {
        const v = vecPodle(hra, t.nese);
        if (v) hra.veci.splice(hra.veci.indexOf(v), 1);
        t.nese = 0;
        t.piti = Math.min(100, t.piti + POT.NASYCENI.pivo);
        POT.vzpominka(hra, t, 'dal si dobré pivo', 4, 0.5);
      }
      hotovo(t);
      return;
    }
    if (p.typ === 'spat') {
      const postel = p.postel >= 0 && hra.stavba[p.postel] === S.K.POSTEL;
      if (p.postel >= 0 && !postel) { pustPraci(hra, t); return; }
      t.stav = 'spi';
      t.spanek = Math.min(100, t.spanek + (postel ? 0.5 : 0.3));
      if (t.spanek >= 98 || (!POT.noc(hra) && t.spanek >= 80)) {
        if (!postel) POT.vzpominka(hra, t, 'spal na tvrdé zemi', -6, 1);
        else {
          const z = S.zonaNa(hra, p.postel);
          POT.vzpominka(hra, t, z && z.typ === 'loznice' ? 'vyspal se v ložnici' : 'vyspal se v posteli', z && z.typ === 'loznice' ? 8 : 5, 1);
        }
        hotovo(t);
      }
    }
  }
  // trpaslík, který se nedostane k žádnému skladu, uvízl (typicky v šachtě bez schodiště)
  function hlidejUviznuti(hra, t) {
    if (hra.tik < (t.kontrola || 0)) return;
    t.kontrola = hra.tik + 150;
    const venku = !!C.hledej(hra, t.i, i => S.jeSklad(hra, i) ? 1 : 0);
    if (!venku && !t.uvizl && !(t.hlaseno > hra.tik)) {
      zprava(hra, 'uvizl', `${t.jmeno} uvízl a nedostane se zpátky. Postav k němu žebřík nebo vytesej schodiště.`);
      t.hlaseno = hra.tik + 1200;
    }
    t.uvizl = !venku;
  }
  // nečinný trpaslík občas přešlápne na vedlejší pole
  function toulej(hra, t, zuri) {
    if (!zuri) t.stav = 'nic';
    if (P.nahoda(hra) > 0.04) return;
    const n = t.i + (P.nahoda(hra) < 0.5 ? -1 : 1);
    if (n % W === 0 || n % W === W - 1) return;
    if (C.krok(hra, t.i, n) === 'chuze') presun(t, n, DOBA.chuze + 2);
  }
  function odejdi(hra, t) {
    pustPraci(hra, t);
    if (t.nastroj) { P.novaVec(hra, t.nastroj.druh, t.i, t.nastroj.mat); P.usadVeci(hra); t.nastroj = null; }
    hra.trpaslici.splice(hra.trpaslici.indexOf(t), 1);
    zprava(hra, 'smrt', `${t.jmeno} sebral své věci a odešel z hory. Tady už to nevydržel.`);
    for (const u of hra.trpaslici) POT.vzpominka(hra, u, `odešel ${t.jmeno}`, -4, 2);
  }
  function umri(hra, t, text) {
    pustPraci(hra, t);
    for (const k of ['nastroj', 'zbran', 'zbroj']) if (t[k]) { P.novaVec(hra, t[k].druh, t.i, t[k].mat); t[k] = null; }
    P.usadVeci(hra);
    hra.trpaslici.splice(hra.trpaslici.indexOf(t), 1);
    zprava(hra, 'smrt', text);
    hra.padlo = (hra.padlo || 0) + 1;
    for (const u of hra.trpaslici) POT.vzpominka(hra, u, `truchlí: zemřel ${t.jmeno}`, -12, 3);
  }

  function krok(hra) {
    hra.tik++;
    T.obdobi.tik(hra);
    T.udalosti.tik(hra);
    T.priroda.tik(hra, (typ, text) => zprava(hra, typ, text));
    T.hrozby.tik(hra, (typ, text) => zprava(hra, typ, text));
    T.pribeh.tik(hra);
    for (const t of hra.trpaslici.slice()) krokTrpaslika(hra, t);
    // pařezy a obří houby dorůstají
    if (hra.tik % 60 === 0 && hra.parezy.length) {
      const zima = T.obdobi.zima(hra);
      hra.parezy = hra.parezy.filter(p => {
        if (p.tik > hra.tik || (zima && !p.houba)) return true;   // v zimě stromy nedorůstají
        const volno = !hra.stavba[p.i] && !hra.planNa.has(p.i) && !hra.lez[p.i] && hra.hora.teren[p.i] === T.hora.M.VZDUCH;
        if (p.houba) { if (volno && !hra.hora.obj[p.i]) hra.hora.obj[p.i] = O.HOUBA; }
        else if (hra.hora.obj[p.i] === O.PAREZ && volno) hra.hora.obj[p.i] = O.STROM;
        return false;
      });
    }
    if (hra.tik % 20 === 0) pripravDilny(hra);
    // úroda roste (zhruba 1 000 tahů od zasetí ke zralosti)
    if (hra.tik % 30 === 0) {
      const u = hra.uroda, rustPole = T.obdobi.OBDOBI[T.obdobi.obdobi(hra)].rust;
      for (let i = 0; i < N; i++) {
        if (!u[i] || u[i] === 101) continue;
        const z = hra.zona[i] && S.zonaNa(hra, i);
        if (!z || !S.FARMY[z.typ]) { u[i] = 0; continue; }
        u[i] = Math.min(101, u[i] + (z.typ === 'pole' ? rustPole : 3));
      }
    }
    // varování před hladem jednou za den
    if (hra.tik % TAHU_ZA_DEN === 300 && hra.trpaslici.length) {
      const z = pocty(hra), n = hra.trpaslici.length;
      if ((z.jidlo || 0) + ((z.houby || 0) + (z.jecmen || 0)) / 2 < 2 * n) zprava(hra, 'uvizl', 'Docházejí zásoby jídla! Založ pole nebo houbárnu a postav kuchyni.');
      if ((z.pivo || 0) < 2 * n) zprava(hra, 'uvizl', 'Dochází pivo! Pivovar vaří z ječmene nebo z hub.');
    }
  }

  // --- zakázky dílen (volá UI) ------------------------------------------------------------
  // r = index receptu; trvalá zakázka udržuje zásobu `pocet` kusů výrobku
  function pridejZakazku(hra, dilna, r, pocet, trvala) {
    const rc = S.RECEPTY[dilna.typ][r];
    if (T.pribeh.artefaktZakazany(hra, rc.vyrobek)) return false;
    if (rc.vyrobek.startsWith('art_')) { if (dilna.fronta.some(z => z.r === r)) return false; pocet = 1; trvala = false; }
    const z = dilna.fronta.find(z => z.r === r && !!z.trvala === !!trvala);
    if (z && trvala) z.cil = Math.max(0, z.cil + pocet);
    else if (z) z.zbyva += pocet;
    else dilna.fronta.push({ id: hra.dalsiId++, r, trvala: !!trvala, cil: trvala ? pocet : 0, zbyva: trvala ? 0 : pocet });
  }
  function zrusZakazku(hra, dilna, id) {
    const z = dilna.fronta.find(z => z.id === id);
    if (!z) return;
    dilna.fronta.splice(dilna.fronta.indexOf(z), 1);
    if (dilna.vRobe && dilna.vRobe.zak === id) {            // rozpracovaný výrobek: materiál vypadne na zem
      for (const t of hra.trpaslici) if (t.prace && t.prace.dilna === dilna.id) { t.prace.vCeste = 0; pustPraci(hra, t); }
      for (const [druh, n] of Object.entries(dilna.vRobe.doneseno)) for (let k = 0; k < n; k++) P.novaVec(hra, druh, dilna.i, 0);
      dilna.vRobe = null; dilna.rez = 0;
      P.usadVeci(hra);
    }
  }
  function prepniMriz(hra, i) {
    if (hra.stavba[i] !== S.K.MRIZ) return false;
    hra.zavreno[i] ^= 1;
    if (hra.zavreno[i]) for (const t of hra.trpaslici) if (t.i === i) hra.zavreno[i] = 0;   // na trpaslíka ji nespustíme
    return !!hra.zavreno[i];
  }
  // zrušení plánů v obdélníku (donesený materiál zůstane ležet)
  function zrusPlany(hra, x0, y0, x1, y1) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    const zrusit = new Set();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const id = hra.planNa.get(y * W + x); if (id) zrusit.add(id); }
    for (const id of zrusit) {
      const p = S.planPodle(hra, id);
      for (const t of hra.trpaslici) if (t.prace && t.prace.plan === id) { t.prace.vCeste = 0; pustPraci(hra, t); }
      S.zrusPlan(hra, p, (druh, i, mat) => P.novaVec(hra, druh, i, mat !== undefined ? mat : druh === 'drevo' ? 'drevo' : 0));
    }
    P.usadVeci(hra);
    return zrusit.size;
  }

  function den(hra) { return Math.floor(hra.tik / TAHU_ZA_DEN) + 1; }
  function hodina(hra) { return (6 + (hra.tik % TAHU_ZA_DEN) / TAHU_ZA_DEN * 24) % 24; }   // den začíná v 6:00
  function popisCinnosti(hra, t) {
    const p = t.prace;
    if (t.stav === 'pada') return 'padá!';
    if (t.zuri > hra.tik) return 'zuří! (nepracuje)';
    if (t.stav === 'bojuje') return 'bojuje!';
    if (t.stav === 'utika') return 'utíká před nepřítelem!';
    if (t.nemoc > hra.tik) return 'leží s horečkou';
    if (!p) return t.uvizl ? 'uvízl – potřebuje žebřík' : 'odpočívá';
    if (p.typ === 'spat') return t.stav === 'spi' ? (p.postel >= 0 ? 'spí v posteli' : 'spí na zemi') : 'jde spát';
    if (p.typ === 'pit') return t.stav === 'ji' ? (p.voda ? 'pije vodu' : 'pije pivo') : (p.voda ? 'jde se napít k vodě' : 'jde na pivo');
    if (p.typ === 'jist') return t.stav === 'ji' ? 'jí' : p.faze === 'k_cili' ? 'nese jídlo ke stolu' : 'jde se najíst';
    if (p.typ === 'pole') return (t.stav === 'kope' ? '' : 'jde ') + (hra.uroda[p.c] === 101 ? 'sklízet' : 'sít');
    if (p.typ === 'vyrobit') {
      const d = dilnaPodle(hra, p.dilna), z = d && d.vRobe && d.fronta.find(z => z.id === d.vRobe.zak), rc = z && receptPro(d, z);
      return (t.stav === 'kope' ? 'vyrábí ' : 'jde vyrábět ') + (rc ? rc.nazev || P.VECI[rc.vyrobek].nazev : '');
    }
    if (p.typ === 'kopat') {
      const co = hra.hora.ruda[p.c] ? T.hora.RUDA[hra.hora.ruda[p.c]].nazev : T.hora.MATERIAL[hra.hora.teren[p.c]].nazev;
      return (t.stav === 'kope' ? 'kope ' : 'jde kopat ') + co + (hra.oznac[p.c] === P.OZN.SCHODY ? ' (schodiště)' : '');
    }
    if (p.typ === 'kacet') return t.stav === 'kope' ? 'kácí jedli' : 'jde kácet';
    if (p.typ === 'stavet') {
      const pl = S.planPodle(hra, p.plan);
      return (t.stav === 'kope' ? 'staví ' : 'jde stavět ') + (pl ? S.STAVBY[pl.typ].nazev : '');
    }
    const v = vecPodle(hra, p.vec);
    const co = v ? P.VECI[v.druh].nazev : 'věc';
    if (p.faze === 'k_veci') return 'jde pro ' + co;
    if (p.typ === 'donest') { const pl = S.planPodle(hra, p.plan); return 'nese ' + co + ' na stavbu' + (pl ? ' (' + S.STAVBY[pl.typ].nazev + ')' : ''); }
    if (p.typ === 'pumpovat') return t.stav === 'kope' ? 'pumpuje vodu' : 'jde k pumpě';
    if (p.typ === 'lov') return 'jde na nepřítele';
    if (p.typ === 'cist') return t.stav === 'ji' ? 'luští runy předků' : 'jde číst runovou desku';
    if (p.typ === 'zazehnout') return p.faze === 'k_veci' ? 'jde pro Klíč k Srdci' : t.i === hra.hora.srdce.y * W + hra.hora.srdce.x ? 'zažíhá Výheň předků!' : 'nese Klíč do Srdce hory';
    if (p.typ === 'cvicit') return t.stav === 'kope' ? 'cvičí se zbraní' : 'jde cvičit';
    if (p.typ === 'vybavit') return 'jde si pro ' + co;
    if (p.typ === 'donest' && p.dilna) { const d = dilnaPodle(hra, p.dilna); return 'nese ' + co + ' do dílny' + (d ? ' (' + S.STAVBY[d.typ].nazev + ')' : ''); }
    return 'nese ' + co + ' do skladu';
  }

  T.hra = { TAHU_ZA_DEN, DOBA, PROFESE, novaHra, krok, den, hodina, popisCinnosti, zprava, zvuk, pridejTrpaslika, noveJmeno, nahodnaProfese,
            pridejZakazku, zrusZakazku, zrusPlany, pustPraci, umri, prepniMriz, faktorNastroje, dilnaPripravena, chybiDilne };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
