/* ============================================================
   Síně pod horou – priroda.js: stabilita stropu, voda, magma,
   prameny a pumpy (pohled shora).

   Stabilita: každé pole, které vytesali trpaslíci (hra.vykopane),
   musí mít oporu do R polí (Čebyševova vzdálenost – i šikmo). Opora
   je skála, zeď, suť a sloup. R podle horniny: hlína a jíl 2, vápenec
   3, čedič a hlubinný kámen 4, žula a obsidián 5. Přírodní jeskyně
   drží vždy. Strop bez opory praská (varování s místem), po 600 tazích
   se zřítí: pole se zasypou sutí, zasypaní ztratí 35 zdraví, stavby
   zaniknou, věci se vysypou vedle.
   Kapaliny: kap 0–7 na poli (≥ 4 hluboká). Automat jen na aktivních
   polích (spí, když se nic nehýbe): jednotka padá dírou, šachtou,
   žebříkem i schodištěm o patro níž, jinak teče k sousedovi s nižší
   hladinou (o 2+). Dveře a zdi nepustí. Voda na povrchu (potok) je
   nehybná. Magma teče pomaleji, pálí věci, stavby a trpaslíky,
   s vodou ztuhne na obsidián. Pramen ve vápenci (1,5 % při tesání)
   vydá 16 jednotek vody. Pumpa odčerpá vodu do 3 polí.
   Pořadí zpracování je podle indexu pole → deterministické.
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O, K, P } = SV, C = S.cesty, PR = S.prace;
  const DOBA_PRASKANI = 600, ZAVAL_ZDRAVI = 35;
  const KROK = { [K.VODA]: 4, [K.MAGMA]: 12 };
  const DOSAH = { [M.HLINA]: 2, [M.JIL]: 2, [M.VAPENEC]: 3, [M.ZULA]: 5, [M.CEDIC]: 4, [M.HLUBINNY]: 4, [M.OBSIDIAN]: 5, [M.SUT]: 2, [M.CIHLA]: 4, [M.RUNA]: 6, [M.PODLOZI]: 9 };
  const dosah = m => DOSAH[m] || 3;

  // --- stabilita ----------------------------------------------------------------------
  const opora = (sv, g) => sv.teren[g] !== M.VOLNO || sv.obj[g] === O.SLOUP;
  // vzdálenost k opoře v patře p (Čebyšev, dvouprůchodový chamfer); navic = pole brána jako vytesaná (náhled)
  function vzdalenosti(hra, p, navic) {
    const sv = hra.sv, { W, H, N } = sv, z = p * N, d = new Uint16Array(N);
    for (let l = 0; l < N; l++) d[l] = opora(sv, z + l) && !(navic && navic.has(z + l)) ? 0 : 999;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const l = y * W + x; let v = d[l]; if (!v) continue;
      if (x > 0) v = Math.min(v, d[l - 1] + 1);
      if (y > 0) { v = Math.min(v, d[l - W] + 1); if (x > 0) v = Math.min(v, d[l - W - 1] + 1); if (x < W - 1) v = Math.min(v, d[l - W + 1] + 1); }
      d[l] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const l = y * W + x; let v = d[l]; if (!v) continue;
      if (x < W - 1) v = Math.min(v, d[l + 1] + 1);
      if (y < H - 1) { v = Math.min(v, d[l + W] + 1); if (x < W - 1) v = Math.min(v, d[l + W + 1] + 1); if (x > 0) v = Math.min(v, d[l + W - 1] + 1); }
      d[l] = v;
    }
    return d;
  }
  // nepodepřená vytesaná pole (seřazená); navic = náhled plánovaného kopání
  function nepodeprena(hra, p, navic) {
    const sv = hra.sv, N = sv.N, z = p * N, d = vzdalenosti(hra, p, navic), r = [];
    for (let l = 0; l < N; l++) {
      const g = z + l;
      if (!(hra.vykopane[g] || (navic && navic.has(g)))) continue;
      if (d[l] > dosah(sv.zaklad[g])) r.push(g);
    }
    return r;
  }
  // skupiny nepodepřených polí (8-sousedství)
  function skupiny(sv, pole) {
    const set = new Set(pole), vid = new Set(), r = [];
    for (const s of pole) {
      if (vid.has(s)) continue;
      const sk = [s]; vid.add(s);
      for (let k = 0; k < sk.length; k++) {
        const g = sk[k], l = g % sv.N, x = l % sv.W, y = (l / sv.W) | 0;
        for (const [dx, dy] of C.SMERY) {
          const X = x + dx, Y = y + dy, h = g + dy * sv.W + dx;
          if (X < 0 || Y < 0 || X >= sv.W || Y >= sv.H || !set.has(h) || vid.has(h)) continue;
          vid.add(h); sk.push(h);
        }
      }
      sk.sort((a, b) => a - b);
      r.push(sk);
    }
    return r;
  }
  function hlidejStropy(hra) {
    if (hra._stabVerze === hra.verzeTerenu) return;
    hra._stabVerze = hra.verzeTerenu;
    const sv = hra.sv, patra = new Set();
    for (let g = 0; g < hra.vykopane.length; g++) if (hra.vykopane[g]) patra.add((g / sv.N) | 0);
    const nove = [];
    for (const p of patra) for (const sk of skupiny(sv, nepodeprena(hra, p))) nove.push(sk);
    const stare = hra.praskani;
    hra.praskani = nove.map(bunky => {
      // skupina, která se překrývá se starou, zdědí odpočet a nehlásí se znovu
      const set = new Set(bunky), p0 = stare.find(q => q.bunky.some(g => set.has(g)));
      if (p0) return { bunky, do: p0.do, g: bunky[bunky.length >> 1] };
      const g = bunky[bunky.length >> 1];
      PR.zvuk(hra, 'praskani', g);
      PR.zprava(hra, 'varovani', `⚠️ Strop praská! ${bunky.length} ${bunky.length < 5 ? 'pole' : 'polí'} bez opory (${SV.MATERIAL[sv.zaklad[g]].nazev} unese ${dosah(sv.zaklad[g])} pole). Postav sloupy, než se zřítí.`, g);
      return { bunky, do: hra.tik + DOBA_PRASKANI, g };
    });
    const pred = stare.length, po = hra.praskani.length;
    if (pred && !po) PR.zprava(hra, 'stavba', '✅ Strop drží – všechna praskající místa jsou podepřená.');
  }
  function zavaly(hra) {
    for (const pr of hra.praskani.slice()) {
      if (hra.tik < pr.do) continue;
      hra.praskani.splice(hra.praskani.indexOf(pr), 1);
      zaval(hra, pr.bunky);
    }
  }
  // zával: pole se zasypou sutí (dál nepodepřená, ostatní zůstanou)
  function zaval(hra, bunky) {
    const sv = hra.sv, ST = S.stavby, HR = S.hra, set = new Set(bunky), zasypani = [];
    for (const g of bunky) {
      // stavby zaniknou (materiál je pryč), plány se zruší, značky a zóny zmizí
      const b = ST.budovaNa(hra, g);
      if (b) znicBudovu(hra, b);
      const pl = hra.planNa.has(g) && ST.planPodle(hra, hra.planNa.get(g));
      if (pl) ST.zrusPlan(hra, pl);
      if (sv.obj[g] === O.SCHODY_DOLU && sv.obj[g + sv.N] === O.SCHODY_NAHORU) sv.obj[g + sv.N] = O.NIC;
      if (sv.obj[g] === O.SCHODY_NAHORU && g >= sv.N && sv.obj[g - sv.N] === O.SCHODY_DOLU) sv.obj[g - sv.N] = O.NIC;
      sv.obj[g] = O.NIC; sv.kap[g] = 0; sv.teren[g] = M.SUT; sv.otes[g] = 0;
      hra.vykopane[g] = 0; hra.oznac[g] = 0; hra.prio[g] = 0; hra.zona[g] = 0; hra.uroda[g] = 0; PR.oznZmena(hra); S.stavby.zonZmena(hra);
      PR.zmenaTerenu(hra, g);
    }
    S.stavby.uklidZony(hra);
    // trpaslíci a věci pod sutí se vysypou na nejbližší volné pole
    for (const t of hra.trpaslici.slice()) {
      if (!set.has(t.g) && !set.has(t.dalsi)) continue;
      HR.pustPraci(hra, t);
      t.krokDoba = 0; t.dalsi = -1;
      if (set.has(t.g)) t.g = ven(hra, t.g);
      t.zdravi -= ZAVAL_ZDRAVI; zasypani.push(t);
    }
    for (const v of hra.veci) if (v.g >= 0 && set.has(v.g)) v.g = ven(hra, v.g);
    hra.zmenaPraci++;
    const g = bunky[bunky.length >> 1];
    PR.zvuk(hra, 'zaval', g, bunky.length);
    PR.zprava(hra, 'smrt', `ZÁVAL! Strop se zřítil (${bunky.length} ${bunky.length < 5 ? 'pole' : 'polí'}).` + (zasypani.length ? ' Zasypalo: ' + zasypani.map(t => t.jmeno).join(', ') + '.' : ''), g);
    for (const t of zasypani) if (t.zdravi <= 0) HR.umri(hra, t, 'zával');
  }
  function ven(hra, g) {
    const sv = hra.sv;
    const r = C.hledej(hra, PR.stojiskaKolem(sv, g).concat(sousedniVolna(sv, g)), h => C.pruchozi(sv, h), 4000);
    if (r) return r.cil;
    const s = sousedniVolna(sv, g); return s.length ? s[0] : g;
  }
  function sousedniVolna(sv, g) {
    const r = [], l = g % sv.N, x = l % sv.W, y = (l / sv.W) | 0;
    for (let k = 1; k < 6 && !r.length; k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= sv.W || Y >= sv.H) continue;
      const h = g + dy * sv.W + dx; if (C.pruchozi(sv, h)) r.push(h);
    }
    return r;
  }
  // stavba zničená závalem nebo magmatem: materiál propadne (účetnictví: spotřeba)
  function znicBudovu(hra, b) {
    const ST = S.stavby, d = ST.STAVBY[b.typ];
    if (!ST.zbourej(hra, b)) return;
    // zbourej vrátil materiál a zásobu na zem – ty teď zmizí
    const kam = ST.poleVedle(hra, b.bunky);
    const vratilo = Object.values(d.mat).reduce((a, n) => a + n, 0) + (b.mista ? b.mista.reduce((a, m) => a + Object.values(m.zasoba).reduce((x, n) => x + n, 0), 0) : 0);
    let n = 0;
    for (let i = hra.veci.length - 1; i >= 0 && n < vratilo; i--) if (hra.veci[i].g === kam) { PR.odeberVec(hra, hra.veci[i]); hra.spotrebovano++; n++; }
  }

  // --- kapaliny -----------------------------------------------------------------------
  const DOLU = new Set([O.DIRA, O.ZEBRIK, O.SACHTA, O.SCHODY_DOLU]);
  const pusti = (hra, g) => hra.sv.teren[g] === M.VOLNO && !(hra.budovaNa[g] && S.mistnosti.jeDvere(hra, g));
  // aktivní pole: za běhu množina hra._kapSet, v uložené hře seřazené pole hra.kapAktivni
  const mnozina = hra => hra._kapSet || (hra._kapSet = new Set(hra.kapAktivni));
  function aktivuj(hra, g) {
    const sv = hra.sv;
    if (g < sv.N) return;                                    // povrch: nehybná voda
    const a = mnozina(hra);
    const vloz = h => { if (h >= sv.N && h < sv.teren.length && sv.kap[h]) a.add(h); };
    vloz(g);
    const l = g % sv.N, x = l % sv.W, y = (l / sv.W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < sv.W && Y < sv.H) vloz(g + dy * sv.W + dx); }
    if (g >= 2 * sv.N) vloz(g - sv.N);                       // co je nad dírou, spadne
  }
  // změna hladiny: prah hluboké vody nebo suchého pole mění chůzi a kresbu
  function nastavKap(hra, g, kap, typ) {
    const sv = hra.sv, pred = sv.kap[g], kosPred = pred === 0 ? 0 : pred < SV.HLUBOKA ? 1 : 2, kosPo = kap === 0 ? 0 : kap < SV.HLUBOKA ? 1 : 2;
    sv.kap[g] = kap; if (kap) sv.kapTyp[g] = typ; else sv.kapTyp[g] = K.NIC;
    if (kosPred !== kosPo) { hra.verzeTerenu++; PR.zmena(hra, g); }
    else if ((hra.tik & 31) === 0) PR.zmena(hra, g);
  }
  // přesun jedné jednotky kapaliny typ z a do b; řeší magma × voda a co magma spálí
  function presun(hra, a, b, typ, n) {
    const sv = hra.sv;
    if (sv.kap[b] && sv.kapTyp[b] !== typ) { ztuhni(hra, b); nastavKap(hra, a, Math.max(0, sv.kap[a] - 1), typ); return; }
    nastavKap(hra, a, sv.kap[a] - n, typ);
    nastavKap(hra, b, sv.kap[b] + n, typ);
    if (typ === K.MAGMA) spal(hra, b);
    else { const bd = S.stavby.budovaNa(hra, b); if (bd && (bd.typ === 'louc')) { znicBudovu(hra, bd); PR.zprava(hra, 'varovani', 'Voda uhasila louč.', b); } }
    aktivuj(hra, a); aktivuj(hra, b);
  }
  function ztuhni(hra, g) {
    const sv = hra.sv;
    nastavKap(hra, g, 0, K.NIC);
    sv.teren[g] = M.OBSIDIAN; sv.otes[g] = 0; sv.obj[g] = O.NIC; hra.vykopane[g] = 0;
    PR.zvuk(hra, 'syceni', g);
    for (const t of hra.trpaslici.slice()) if (t.g === g) { t.g = ven(hra, g); t.krokDoba = 0; t.dalsi = -1; }
    for (const v of hra.veci) if (v.g === g) v.g = ven(hra, g);
    PR.zmenaTerenu(hra, g);
    if (!hra._parou || hra.tik - hra._parou > 300) { hra._parou = hra.tik; PR.zprava(hra, 'objev', 'Syčí pára – magma se setkalo s vodou a ztuhlo na obsidián.', g); }
  }
  // magma pálí věci, stavby a trpaslíky na poli
  function spal(hra, g) {
    const sv = hra.sv, ST = S.stavby;
    for (const v of hra.veci.slice()) if (v.g === g) { PR.odeberVec(hra, v); hra.spotrebovano++; }
    const b = ST.budovaNa(hra, g); if (b) znicBudovu(hra, b);
    if (sv.obj[g] === O.MOST || sv.obj[g] === O.ZEBRIK || sv.obj[g] === O.SACHTA) { sv.obj[g] = sv.obj[g] === O.MOST ? O.NIC : O.DIRA; PR.zmenaTerenu(hra, g); }
    const pl = hra.planNa.has(g) && ST.planPodle(hra, hra.planNa.get(g)); if (pl) ST.zrusPlan(hra, pl);
    for (const t of hra.trpaslici.slice()) if (t.g === g || t.dalsi === g) S.hra.umri(hra, t, 'shořel v magmatu');
  }
  // Krok kapaliny typ: pro každé aktivní těleso (souvislá pole s touž kapalinou, 4-sousedství) nejdřív pád
  // dírou / šachtou / schodištěm o patro níž, jinak vyrovnání hladiny: jednotka z nejvyššího pole tělesa na
  // nejnižší pole tělesa nebo jeho okraje (suché průchozí pole), dokud je rozdíl aspoň 2 – hladina se tak
  // srovná a automat se zastaví. Přírodní jezero drží ve své pánvi: na suchý břeh jeskyně nevteče, jen do
  // vytesaných polí. Setkání s jinou kapalinou = obsidián.
  function krokKapalin(hra, typ) {
    const sv = hra.sv, N = sv.N, W = sv.W, a = mnozina(hra);
    if (!a.size) return 0;
    const seznam = [];
    for (const g of a) { if (!sv.kap[g]) a.delete(g); else if (sv.kapTyp[g] === typ) { seznam.push(g); a.delete(g); } }
    seznam.sort((x, y) => x - y);
    const vid = new Set();
    let pohyb = 0;
    for (const g0 of seznam) {
      if (vid.has(g0) || !sv.kap[g0] || sv.kapTyp[g0] !== typ) continue;
      // těleso a jeho okraj
      const telo = [g0], okraj = new Set(), cizi = new Set();
      vid.add(g0);
      for (let k = 0; k < telo.length; k++) {
        const g = telo[k], p = (g / N) | 0, l = g - p * N, x = l % W, y = (l / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= W || Y >= sv.H) continue;
          const h = g + dy * W + dx;
          if (!pusti(hra, h)) continue;
          if (sv.kap[h]) {
            if (sv.kapTyp[h] !== typ) cizi.add(h);
            else if (!vid.has(h)) { vid.add(h); telo.push(h); }
          } else if (hra.vykopane[h] || !(sv.oblast[h] && sv.oblasti[sv.oblast[h]].typ === 'jezero')) okraj.add(h);
        }
      }
      telo.sort((x, y) => x - y);
      let hnuto = false;
      // setkání s jinou kapalinou
      if (cizi.size) { for (const h of [...cizi].sort((x, y) => x - y)) ztuhni(hra, h); hnuto = true; }
      // pád o patro níž
      for (const g of telo) {
        const p = (g / N) | 0;
        if (sv.kap[g] && DOLU.has(sv.obj[g]) && p < sv.P - 1 && pusti(hra, g + N) && sv.kap[g + N] < 7) {
          presun(hra, g, g + N, typ, Math.min(sv.kap[g], 7 - sv.kap[g + N], 2)); hnuto = true; pohyb++;
        }
      }
      if (!hnuto) {
        // vyrovnání hladiny: nejvýš čtvrtina tělesa přesunů za krok (aspoň jeden)
        const kandidati = telo.concat([...okraj].sort((x, y) => x - y));
        const tahu = Math.max(1, telo.length >> 2);
        // odtok: suché pole s dírou dolů (kam kapalina dál padá) bere i při rozdílu 1 – voda dírou vyteče celá
        const odtok = kandidati.find(c => !sv.kap[c] && DOLU.has(sv.obj[c]) && ((c / N) | 0) < sv.P - 1 && pusti(hra, c + N) && sv.kap[c + N] < 7);
        for (let m = 0; m < tahu; m++) {
          let max = -1, min = -1;
          for (const c of telo) if (sv.kap[c] && sv.kapTyp[c] === typ && c !== odtok && (max < 0 || sv.kap[c] > sv.kap[max])) max = c;
          if (odtok !== undefined && !sv.kap[odtok] && max >= 0) { if (!telo.includes(odtok)) telo.push(odtok); presun(hra, max, odtok, typ, 1); pohyb++; hnuto = true; break; }
          for (const c of kandidati) if ((!sv.kap[c] || sv.kapTyp[c] === typ) && (min < 0 || sv.kap[c] < sv.kap[min])) min = c;
          if (max < 0 || min < 0 || sv.kap[max] - sv.kap[min] < 2) break;
          if (!sv.kap[min]) telo.push(min);
          presun(hra, max, min, typ, 1); pohyb++; hnuto = true;
        }
      }
      if (!hnuto) for (const c of telo) a.delete(c);          // klidné těleso spí
    }
    return pohyb;
  }
  // pramen při tesání vápence (2.–3. patro)
  function moznaPramen(hra, g) {
    const sv = hra.sv, p = (g / sv.N) | 0;
    if (p < 2 || p > 3 || sv.zaklad[g] !== M.VAPENEC) return;
    if (PR.nahoda(hra) >= 0.015) return;
    hra.prameny.push({ g, zbyva: 16, dalsi: hra.tik });
    PR.zprava(hra, 'varovani', 'Z pukliny ve vápenci vytryskl pramen! Voda poteče, dokud se zdroj nevyčerpá.', g);
  }
  function prameny(hra) {
    const sv = hra.sv;
    hra.prameny = hra.prameny.filter(pr => {
      if (hra.tik < pr.dalsi) return true;
      pr.dalsi = hra.tik + 40;
      if (sv.teren[pr.g] !== M.VOLNO) return false;
      if (sv.kap[pr.g] >= 7) return true;
      if (sv.kap[pr.g] && sv.kapTyp[pr.g] === K.MAGMA) { ztuhni(hra, pr.g); return false; }
      nastavKap(hra, pr.g, sv.kap[pr.g] + 1, K.VODA); aktivuj(hra, pr.g);
      return --pr.zbyva > 0;
    });
  }
  // utonutí: trpaslík v hluboké vodě ztrácí zdraví a plave k nejbližšímu průchozímu poli
  function topeni(hra) {
    const sv = hra.sv;
    for (const t of hra.trpaslici.slice()) {
      if (!(sv.kap[t.g] >= SV.HLUBOKA && sv.kapTyp[t.g] === K.VODA) || C.pruchozi(sv, t.g)) continue;
      t.zdravi -= 0.4;
      if (t.zdravi <= 0) { S.hra.umri(hra, t, 'utonul'); continue; }
      if (hra.tik % 4) continue;
      S.hra.pustPraci(hra, t); t.krokDoba = 0; t.dalsi = -1;
      // o pole blíž ke břehu
      const vzd = new Map([[t.g, 0]]), fr = [t.g];
      let breh = -1;
      for (let k = 0; k < fr.length && k < 400 && breh < 0; k++) {
        const g = fr[k], l = g % sv.N, x = l % sv.W, y = (l / sv.W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= sv.W || Y >= sv.H) continue;
          const h = g + dy * sv.W + dx; if (vzd.has(h) || !pusti(hra, h)) continue;
          vzd.set(h, g); fr.push(h);
          if (C.pruchozi(sv, h)) { breh = h; break; }
        }
      }
      if (breh >= 0) { let k = breh; while (vzd.get(k) !== t.g && vzd.get(k) !== 0) k = vzd.get(k); t.g = k; }
    }
  }

  // --- pumpa a studna -------------------------------------------------------------------
  // nejplnější pole s vodou do 3 polí od pumpy (stejné patro, známé)
  function vodaUPumpy(hra, b) {
    const sv = hra.sv, l = b.g % sv.N, x0 = l % sv.W, y0 = (l / sv.W) | 0, z = b.g - l;
    let nej = -1;
    for (let y = y0 - 3; y <= y0 + 3; y++) for (let x = x0 - 3; x <= x0 + 3; x++) {
      if (x < 0 || y < 0 || x >= sv.W || y >= sv.H) continue;
      const g = z + y * sv.W + x;
      if (sv.kap[g] && sv.kapTyp[g] === K.VODA && sv.zn[g] && g >= sv.N && (nej < 0 || sv.kap[g] > sv.kap[nej])) nej = g;
    }
    return nej;
  }
  function odcerpej(hra, b) {
    const g = vodaUPumpy(hra, b);
    if (g < 0) return false;
    nastavKap(hra, g, hra.sv.kap[g] - 1, K.VODA); aktivuj(hra, g);
    hra.odcerpano = (hra.odcerpano || 0) + 1;
    return true;
  }
  // studna: stojí u vody nebo nad vodou v patře pod (vrtaná); pije se z polí kolem ní
  function studnaMa(hra, b) {
    const sv = hra.sv, g = b.g;
    if (g + sv.N < sv.teren.length && sv.kap[g + sv.N] && sv.kapTyp[g + sv.N] === K.VODA) return true;
    const l = g % sv.N, x = l % sv.W, y = (l / sv.W) | 0;
    for (const [dx, dy] of C.SMERY) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < sv.W && Y < sv.H) { const h = g + dy * sv.W + dx; if (sv.kap[h] && sv.kapTyp[h] === K.VODA) return true; } }
    return false;
  }

  function tik(hra) {
    if (hra.tik % 50 === 0) hlidejStropy(hra);
    if (hra.praskani.length) zavaly(hra);
    if (hra.prameny.length) prameny(hra);
    if (mnozina(hra).size) {
      if (hra.tik % KROK[K.VODA] === 0) krokKapalin(hra, K.VODA);
      if (hra.tik % KROK[K.MAGMA] === 0) krokKapalin(hra, K.MAGMA);
    }
    if (hra.tik % 2 === 0) topeni(hra);
  }

  const aktivni = hra => [...mnozina(hra)].sort((a, b) => a - b);
  S.priroda = { aktivni, DOBA_PRASKANI, DOSAH, dosah, vzdalenosti, nepodeprena, skupiny, hlidejStropy, zaval, aktivuj, krokKapalin,
                moznaPramen, vodaUPumpy, odcerpej, studnaMa, nastavKap, znicBudovu, tik };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;
