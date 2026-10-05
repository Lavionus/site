/* ============================================================
   Síně pod horou – hrozby.js: tvorové, boj, střelba, obrana, nájezdy
   (pravidla a čísla ze Srdce hory, pohyb a střelba pohledem shora).

   Tvorové:
     netopýr  – létá nad dírami i vodou (slabý, otravný)
     pavouk   – leze přes díry a po síti přes vodu (silný)
     goblin   – chodí, vyráží dveře (8 ran), krade
     lukostřelec – goblin s lukem, střílí do 5 polí přes zorné pole
     troll    – hodně zdraví, dveře vyrazí na 3 rány, nevejde se do
                chodby široké 1 pole (úzké chodby jsou obrana)
   Tvorové spí ve skrytých jeskyních a probudí se, když se do jeskyně
   prokope. Nájezdy: první 36. den, pak 18–26 dní; den předem varování;
   druhy od 6. nájezdu: útok, loupež, obléhání rokle (2 dny, lukostřelci
   na cestě), podkop z hlubin. Přicházejí po cestě roklí z jihu (opravený
   most se zavřenou bránou je zastaví – troll ji rozbíjí, v zimě se jde
   po ledu), odkrytým goblinním tunelem v 8. patře, nebo podkopem.
   Boj: úder do sousedního pole (8 směrů) jednou za 10 tahů, poškození =
   útok × dovednost × náhoda, zbroj ho sníží. Strážci loví známé
   nepřátele, bez nich cvičí ve zbrojnici; s kuší střílí do 6 polí (ze
   strážní věže do 8). Poplach: civilisté se schovají do uzavřené
   místnosti s dveřmi. Past zraní netvora (25 ♥, napne se za 300 tahů),
   padací mříž (zavřená) nepustí nikoho.
   Čistá logika bez DOM.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, O, K } = SV, C = S.cesty, PR = S.prace;

  const DRUHY = {
    netopyr: { nazev: 'netopýr', zdravi: 12, utok: 3, krok: 3, pohyb: 'let' },
    pavouk: { nazev: 'obří pavouk', zdravi: 45, utok: 6, krok: 6, pohyb: 'leze', lup: 'hedvabi' },
    goblin: { nazev: 'goblin', zdravi: 30, utok: 6, krok: 5, pohyb: 'chuze', lup: 'cepel', dvere: 8, krade: true },
    lukostrelec: { nazev: 'goblinní lukostřelec', zdravi: 24, utok: 5, krok: 5, pohyb: 'chuze', lup: 'cepel', dvere: 8, krade: true, dosah: 5 },
    trol: { nazev: 'horský troll', zdravi: 130, utok: 11, krok: 8, pohyb: 'chuze', lup: 'drahokam', dvere: 3, siroky: true },
    spac: { nazev: 'Pradávný spáč', zdravi: 480, utok: 22, krok: 7, pohyb: 'leze', lup: 'hvezdna', siroky: true },
  };
  const PRODLEVA = 10, DOSAH_HLEDANI = 1200, MARNE = 120, ZDRAVI_USTUP = 35, ZDRAVI_LOV = 40;
  const ZBRAN = { valecna_sekera: 14, krumpac: 6, sekera: 8, kladivo: 7 };
  const KUSE = { dosah: 6, vez: 8, utok: 9, prodleva: 15 };
  const OBLEH_DNI = 2, OBLEH_DOSAH = 150;
  const DEN = () => S.hra.TAHU_ZA_DEN;
  const nah = hra => PR.nahoda(hra);
  const xy = (sv, g) => { const l = g % sv.N; return [l % sv.W, (l / sv.W) | 0, (g / sv.N) | 0]; };
  function vzd(sv, a, b) { const [ax, ay, ap] = xy(sv, a), [bx, by, bp] = xy(sv, b); return ap !== bp ? 999 : Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }

  // --- průchodnost pro tvory --------------------------------------------------------------
  // vrací false | true | 'dvere' (zavřená překážka, kterou tvor umí vyrazit)
  function prochozi(hra, g, D) {
    const sv = hra.sv;
    if (sv.teren[g] !== M.VOLNO) return false;
    const b = hra.budovaNa[g] ? S.stavby.budovaNa(hra, g) : null;
    if (b) {
      if (b.typ === 'dvere') return D.dvere ? 'dvere' : false;
      if (b.typ === 'mriz' && b.zavreno) return D.dvere && D.siroky ? 'dvere' : false;
      if (b.typ === 'vez') return false;
      if (sv.blok[g]) return false;
    }
    const o = sv.obj[g];
    if (D.pohyb !== 'chuze' && (o === O.DIRA || o === O.ZEBRIK || o === O.SACHTA || o === O.MOST_ROZBITY)) return true;   // přes díru přeletí / přeleze
    if (C.BLOKUJE[o]) return false;
    if (sv.kap[g] >= SV.HLUBOKA && sv.kapTyp[g] === K.MAGMA) return false;
    if (sv.kap[g] >= SV.HLUBOKA && o !== O.MOST && D.pohyb === 'chuze' && !(sv.obdobi === 3 && g < sv.N)) return false;
    if (D.siroky && uzkaChodba(hra, g)) return false;
    return true;
  }
  // chodba široká 1 pole: zleva i zprava, nebo shora i zdola skála
  function uzkaChodba(hra, g) {
    const sv = hra.sv, [x, y] = xy(sv, g), sk = (X, Y) => X < 0 || Y < 0 || X >= sv.W || Y >= sv.H || sv.teren[g + (Y - y) * sv.W + (X - x)] !== M.VOLNO;
    return (sk(x - 1, y) && sk(x + 1, y)) || (sk(x, y - 1) && sk(x, y + 1));
  }
  function sousedeTvora(hra, g, D, fn) {
    const sv = hra.sv, [x, y, p] = xy(sv, g);
    for (const [dx, dy] of C.SMERY) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= sv.W || Y >= sv.H) continue;
      const h = g + dy * sv.W + dx, v = prochozi(hra, h, D);
      if (!v) continue;
      if (dx && dy && (prochozi(hra, g + dx, D) !== true || prochozi(hra, g + dy * sv.W, D) !== true)) continue;
      fn(h, v === 'dvere');
    }
    // patra: schodiště, žebřík (ne šachta); netopýr a pavouk i dírou
    const o = sv.obj[g];
    if (p < sv.P - 1 && (o === O.SCHODY_DOLU || o === O.ZEBRIK || (D.pohyb !== 'chuze' && o === O.DIRA)) && prochozi(hra, g + sv.N, D) === true) fn(g + sv.N, false);
    if (p > 0) { const n = sv.obj[g - sv.N]; if ((n === O.SCHODY_DOLU || n === O.ZEBRIK || (D.pohyb !== 'chuze' && n === O.DIRA)) && prochozi(hra, g - sv.N, D) === true) fn(g - sv.N, false); }
  }
  // BFS tvora: cil(g) → true; vrací { g, cesta } nebo null
  function hledejTvor(hra, start, D, cil, limit) {
    const pred = new Map([[start, -1]]), fronta = [start];
    for (let k = 0; k < fronta.length && k < (limit || DOSAH_HLEDANI); k++) {
      const g = fronta[k];
      if (k && cil(g)) { const c = []; for (let h = g; h !== start; h = pred.get(h)) c.push(h); return { g, cesta: c.reverse() }; }
      sousedeTvora(hra, g, D, h => { if (!pred.has(h)) { pred.set(h, g); fronta.push(h); } });
    }
    return null;
  }
  // zorné pole pro střelbu (skála, sloupy, zavřené dveře kryjí)
  function vidi(hra, a, b) {
    const sv = hra.sv, [ax, ay, ap] = xy(sv, a), [bx, by, bp] = xy(sv, b);
    if (ap !== bp) return false;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)), z = ap * sv.N;
    for (let k = 1; k < n; k++) {
      const g = z + Math.round(ay + (by - ay) * k / n) * sv.W + Math.round(ax + (bx - ax) * k / n);
      if (S.svetlo.nepruhledne(hra, g)) return false;
    }
    return true;
  }

  // --- vznik tvorů -------------------------------------------------------------------------
  function novyTvor(hra, druh, g) {
    const u = { id: hra.dalsiId++, druh, g, dalsi: -1, krok: 0, krokDoba: 0, zdravi: DRUHY[druh].zdravi, cesta: [], smer: 0, utok: 0, hledej: 0, nese: 0 };
    hra.tvorove.push(u);
    return u;
  }
  // prokopnutí do jeskyně probudí, co v ní spí
  function probudJeskyni(hra, o) {
    const sv = hra.sv, bunky = [];
    for (let y = o.y0; y <= o.y1; y++) for (let x = o.x0; x <= o.x1; x++) {
      const g = o.p * sv.N + y * sv.W + x;
      if (sv.oblast[g] === o.id && sv.teren[g] === M.VOLNO && !sv.kap[g] && !C.BLOKUJE[sv.obj[g]]) bunky.push(g);
    }
    if (!bunky.length) return;
    const vyber = () => bunky[Math.floor(nah(hra) * bunky.length)];
    const pridej = (druh, n) => { for (let k = 0; k < n; k++) novyTvor(hra, druh, vyber()); return n; };
    let n = 0, kdo = '';
    if (o.typ === 'krapnikova' || o.typ === 'jeskyne') { n += pridej('netopyr', 1 + Math.floor(nah(hra) * 3)); kdo = 'Z jeskyně vylétli netopýři!'; }
    if (o.typ === 'jeskyne' || o.typ === 'hlubinna') { const k = pridej('pavouk', 1 + Math.floor(nah(hra) * 2)); if (k) { n += k; kdo = 'V jeskyni se pohnuli obří pavouci!'; } }
    if (o.typ === 'houbova' && nah(hra) < 0.5) { n += pridej('pavouk', 1); kdo = 'Mezi houbami číhá obří pavouk!'; }
    if (o.typ === 'tunel') { n += pridej('goblin', 2 + Math.floor(nah(hra) * 2)); kdo = 'Tunel patří goblinům – a jsou doma!'; hra.dalsiNajezd = Math.min(hra.dalsiNajezd, hra.tik + 4 * DEN()); }
    if (n && hra.tvorove.some(u => u.druh === 'netopyr')) PR.zvuk(hra, 'netopyr', hra.tvorove[hra.tvorove.length - 1].g);
    if (n) PR.zprava(hra, 'boj', '⚔️ ' + kdo, hra.tvorove[hra.tvorove.length - 1].g);
  }

  // --- nájezdy --------------------------------------------------------------------------------
  function neklid(hra) {
    const hl = Math.max(0, Math.min(1, ((hra.nejhloubeji || 0) - 60) / 90));
    return Math.min(1, 0.7 * hl + 0.1 * Object.keys(hra.artefakty || {}).length + (hra.spac && hra.spac.brzy ? 0.3 : 0));
  }
  const strazce = t => t.povoleno.hlidat && t.zbran;
  const obrnenych = hra => hra.trpaslici.filter(t => strazce(t) && t.zbroj).length;
  const LAKADLO_SLAVA = 200, LAKADLO_MAX = 4, MAX_SILA = 18;
  const lakadlo = hra => Math.min(LAKADLO_MAX, (hra.slava || 0) / LAKADLO_SLAVA);
  function silaNajezdu(hra) {
    const k = hra.najezdu || 0, n = hra.trpaslici.length, sir = Math.pow(hra.sv.W / 96, 0.25);
    if (!k) return n >= 10 ? 3 : 2;
    return Math.max(2, Math.min(MAX_SILA, Math.max(3, Math.ceil(0.6 * n)), Math.round((1 + n / 9 + lakadlo(hra) + k / 7 + neklid(hra)) * sir)));
  }
  const trolluNa = (hra, sila) => (hra.najezdu || 0) && sila >= 7 ? Math.min(3, Math.floor(obrnenych(hra) / 4), Math.floor((sila - 3) / 3)) : 0;
  const TYPY_NAJEZDU = {
    utok: { nazev: 'útok', popis: 'tlupa jde na trpaslíky' },
    kradez: { nazev: 'loupež', popis: 'zloději jdou po cennostech ve skladech' },
    obleh: { nazev: 'obléhání', popis: 'tlupa s lukostřelci 2 dny obléhá rokli, pak zaútočí' },
    podkop: { nazev: 'podkop', popis: 'goblini se prokopou z hlubin k nejhlubším trpaslíkům' },
  };
  function zvolTypNajezdu(hra) {
    if ((hra.najezdu || 0) < 6) return 'utok';
    const v = [['utok', 4], ['kradez', 2], ['obleh', 2], ['podkop', (hra.nejhloubeji || 0) >= 60 ? 2 : 0]];
    let r = nah(hra) * v.reduce((a, x) => a + x[1], 0);
    for (const [typ, w] of v) { r -= w; if (r < 0) return typ; }
    return 'utok';
  }
  function tunelProNajezd(hra) {
    const sv = hra.sv, tunel = sv.oblasti.find(o => o && o.typ === 'tunel');
    if (!tunel || !hra.objeveno[tunel.id] || hra.odemceno.tunelVycisten || !tunel.vstup) return null;
    const g = 8 * sv.N + tunel.vstup.y * sv.W + tunel.vstup.x;
    return sv.teren[g] === M.VOLNO ? g : null;
  }
  function mistoPodkopu(hra) {
    const sv = hra.sv;
    const t = hra.trpaslici.reduce((a, u) => !a || u.g > a.g ? u : a, null);
    if (!t || ((t.g / sv.N) | 0) < 3) return -1;
    const r = C.hledej(hra, [t.g], g => { const d = vzd(sv, g, t.g); return d >= 10 && d <= 30 && !hra.trpaslici.some(u => vzd(sv, u.g, g) <= 6); }, 3000);
    return r ? r.cil : -1;
  }
  function sestavaNajezdu(hra, sila, typ) {
    const rok = S.obdobi.rok(hra), k = hra.najezdu || 0, out = [];
    let body = sila;
    if (typ !== 'kradez') for (let n = trolluNa(hra, sila); n > 0; n--) { out.push('trol'); body -= 3; }
    const luk = typ === 'obleh' ? 0.5 : 0.3;
    for (; body > 0; body--) out.push(k >= 2 && rok >= 2 && nah(hra) < luk ? 'lukostrelec' : 'goblin');
    return out;
  }
  function predpovedNajezdu(hra) {
    const zaTahu = Math.max(0, hra.dalsiNajezd - hra.tik), typ = hra.dalsiNajezdTyp || 'utok';
    let sila = silaNajezdu(hra); if (typ === 'kradez') sila = Math.max(2, Math.ceil(sila * 0.6));
    const troll = typ === 'kradez' ? 0 : trolluNa(hra, sila);
    return { tik: hra.dalsiNajezd, zaDni: zaTahu / DEN(), sila, trollu: troll, goblinu: Math.max(0, sila - 3 * troll), prvni: !hra.najezdu,
             odkud: typ === 'podkop' ? 'z hlubin' : tunelProNajezd(hra) !== null ? 'z goblinního tunelu' : 'roklí od jihu', typ, typNazev: TYPY_NAJEZDU[typ].nazev,
             typPopis: TYPY_NAJEZDU[typ].popis, ohlaseno: zaTahu <= DEN() };
  }
  // sila: pevný počet goblinů (testy)
  function najezd(hra, sila) {
    const sv = hra.sv, prvni = !hra.najezdu;
    let typ = sila ? 'utok' : hra.dalsiNajezdTyp || 'utok';
    let silaN = silaNajezdu(hra);
    if (typ === 'kradez') silaN = Math.max(2, Math.ceil(silaN * 0.6));
    const druhy = sila ? Array(sila).fill('goblin') : sestavaNajezdu(hra, silaN, typ);
    let start = -1, odkud = '';
    if (typ === 'podkop') { start = mistoPodkopu(hra); if (start >= 0) odkud = `se prokopali z hlubin (${(start / sv.N) | 0}. patro)`; else typ = 'utok'; }
    if (start < 0) { const t = tunelProNajezd(hra); if (t !== null) { start = t; odkud = 'vylézá z goblinního tunelu'; if (typ === 'obleh') typ = 'utok'; } }
    if (start < 0) { start = S.obdobi.naOkraji(hra); odkud = 'přichází roklí od jihu'; }
    for (const d of druhy) {
      const u = novyTvor(hra, d, start);
      if (prvni && !sila) u.zdravi = 20;
      u.najezd = 1;
      if (typ === 'kradez' && DRUHY[d].krade) u.zlodej = 1;
      if (typ === 'obleh') u.obleh = hra.tik + OBLEH_DNI * DEN();
    }
    if (typ === 'obleh') hra.oblehani = { do: hra.tik + OBLEH_DNI * DEN() };
    const pocty = {}; for (const d of druhy) pocty[d] = (pocty[d] || 0) + 1;
    const popis = Object.entries(pocty).map(([d, n]) => d === 'goblin' ? (n < 5 ? `${n} goblini` : `${n} goblinů`) : d === 'lukostrelec' ? `${n}× lukostřelec` : n > 1 ? `${n} trollové` : 'troll').join(', ');
    const uvod = typ === 'kradez' ? '⚔️ Goblinní lupiči!' : typ === 'obleh' ? '⚔️ Goblini obléhají rokli!' : typ === 'podkop' ? '⚔️ Podkop!' : '⚔️ Goblinní nájezd!';
    const rada = typ === 'kradez' ? 'Jdou po cennostech ve skladech – pošli strážce ke skladům.' : typ === 'obleh' ? 'Dva dny čekají na cestě (karavana neprojde), pak zaútočí.' : 'Zavři dveře, vyhlas poplach a pošli strážce.';
    PR.zvuk(hra, 'roh');
    PR.zprava(hra, 'boj', `${uvod} ${prvni && !sila ? 'Hrstka vyhladovělých goblinů' : popis} ${odkud}. ${rada}`, start);
    hra.najezdu = (hra.najezdu || 0) + 1;
  }
  function varujNajezd(hra) {
    const n = hra.najezdu ? silaNajezdu(hra) : 0, typ = hra.dalsiNajezdTyp || 'utok';
    const kolik = !hra.najezdu ? 'Jen pár vyhladovělých – ale klan zatím nemá zbraně.' : n <= 4 ? 'Malá tlupa.' : n <= 9 ? 'Velká tlupa!' : 'Celé vojsko!';
    const trol = typ !== 'kradez' && trolluNa(hra, n) ? ' Mezi nimi je vidět trolla.' : '';
    if (typ === 'podkop') { PR.zprava(hra, 'varovani', `👂 Horníci v hlubinách slyší cizí krumpáče – zítra se goblini prokopou k nejhlubším chodbám. ${kolik}${trol}`); return; }
    const t = tunelProNajezd(hra);
    PR.zprava(hra, 'varovani', `👁️ Hlídka vidí gobliny – zítra zaútočí ${t !== null ? 'z goblinního tunelu' : 'roklí od jihu'}. ${kolik}${trol} Vyzbroj strážce, zavři bránu mostu a připrav dveře.`, t !== null ? t : S.obdobi.naOkraji(hra));
  }
  function tvorZHlubin(hra) {
    const sv = hra.sv, jj = sv.oblasti.filter(o => o && hra.objeveno[o.id] && (o.typ === 'hlubinna' || o.typ === 'jeskyne'));
    if (!jj.length) return;
    const o = jj[Math.floor(nah(hra) * jj.length)];
    const g = o.p * sv.N + Math.floor(o.sy) * sv.W + Math.floor(o.sx);
    const r = hledejTvor(hra, g, DRUHY.pavouk, () => true, 50);
    if (sv.teren[g] !== M.VOLNO && !r) return;
    const pav = novyTvor(hra, 'pavouk', sv.teren[g] === M.VOLNO ? g : r.g);
    PR.zprava(hra, 'boj', '🕷️ Hora se neklidně zachvěla – z hlubin vylezl obří pavouk.', pav.g);
  }

  // --- boj ---------------------------------------------------------------------------------------
  function utokTrpaslika(hra, t) {
    const zb = t.zbran ? ZBRAN[t.zbran.druh] || 8 : t.nastroj ? ZBRAN[t.nastroj.druh] || 4 : 4;
    const kov = (t.zbran || t.nastroj || {}).mat === 'med' ? 0.8 : 1;
    return zb * kov * (1 + 0.1 * (t.dov.boj || 0)) * (S.pribeh ? S.pribeh.utokKlanu(hra) : 1);
  }
  const ochrana = t => t.zbroj ? (t.zbroj.mat === 'med' ? 0.25 : 0.4) : 0;
  function zasah(hra, cil, sila, jeTrpaslik) {
    const dmg = Math.max(1, Math.round(sila * (0.7 + nah(hra) * 0.6) * (jeTrpaslik ? 1 - ochrana(cil) : 1 / (cil.odolnost || 1))));
    cil.zdravi -= dmg;
    return dmg;
  }
  const KOHO = { pavouk: 'obřího pavouka', spac: 'Pradávného spáče', goblin: 'goblina', netopyr: 'netopýra', lukostrelec: 'goblinního lukostřelce', trol: 'horského trolla' };
  function zabijTvora(hra, u, kdo) {
    const i = hra.tvorove.indexOf(u); if (i < 0) return;
    hra.tvorove.splice(i, 1);
    const D = DRUHY[u.druh];
    if (u.nese) { const v = PR.vecPodle(hra, u.nese); if (v) v.g = kamPolozit(hra, u.g); }
    if (D.lup && nah(hra) < 0.6) PR.novaVec(hra, D.lup, kamPolozit(hra, u.g));
    hra.zabito = (hra.zabito || 0) + 1;
    PR.zvuk(hra, 'padl', u.g);
    if (u.druh !== 'netopyr' || nah(hra) < 0.3) PR.zprava(hra, 'objev', `${kdo ? kdo.jmeno : 'Past'} zabil ${KOHO[u.druh]}.`, u.g);
    if (u.druh === 'spac' && S.pribeh) S.pribeh.spacPorazen(hra);
    hra.zmenaPraci++;
  }
  const kamPolozit = (hra, g) => { if (C.pruchozi(hra.sv, g)) return g; const v = S.hra.volnaMistaKolem(hra, g, 1)[0]; return v === undefined ? hra.zakladna : v; };
  function strela(hra, z, na, druh) { (hra.strely || (hra.strely = [])).push({ z, na, tik: hra.tik, druh }); if (hra.strely.length > 40) hra.strely.shift(); }

  // trpaslík se brání: bije souseda, nebo střílí kuší; civilista utíká. Vrací true, když tah spotřeboval.
  function branSe(hra, t) {
    if (t.utok > 0) { t.utok--; return false; }
    if (t.spi || t.krokDoba) return false;
    const sv = hra.sv;
    const u = hra.tvorove.find(u => vzd(sv, u.g, t.g) <= 1 && sv.zn[u.g]);
    if (!u) {
      // kuše: střelba do 6 polí (ze strážní věže 8)
      if (strazce(t) && t.zbran && t.zbran.druh === 'kuse') {
        const b = S.stavby.budovaNa(hra, t.g), dosah = b && b.typ === 'vez' ? KUSE.vez : KUSE.dosah;
        const c = hra.tvorove.find(u => sv.zn[u.g] && vzd(sv, u.g, t.g) <= dosah && (vidi(hra, t.g, u.g) || (b && b.typ === 'vez')));
        if (c) {
          t.utok = KUSE.prodleva; strela(hra, t.g, c.g, 'sip'); PR.zvuk(hra, 'sip', t.g);
          zasah(hra, c, KUSE.utok * (1 + 0.1 * (t.dov.boj || 0)), false);
          if (c.zdravi <= 0) zabijTvora(hra, c, t);
          if ((t.dov.boj || 0) < 10 && nah(hra) < 0.06) t.dov.boj = (t.dov.boj || 0) + 1;
          return true;
        }
      }
      return false;
    }
    const zuri = t.zuri > hra.tik;
    const utect = !zuri && ((!t.zbran && !t.povoleno.hlidat && (t.zdravi < 60 || u.druh === 'trol' || u.druh === 'spac')) || (t.povoleno.hlidat && t.zdravi < ZDRAVI_USTUP) ||
      (u.druh === 'spac' && !strazce(t) && !(t.prace && t.prace.osobni === 'zazehnout')));
    if (utect && ustup(hra, t, u)) return true;
    t.utok = PRODLEVA;
    PR.zvuk(hra, 'boj', u.g, !!t.zbran);
    zasah(hra, u, utokTrpaslika(hra, t), false);
    if (t.povoleno.hlidat && (t.dov.boj || 0) < 10 && nah(hra) < 0.08) t.dov.boj = (t.dov.boj || 0) + 1;
    if (u.zdravi <= 0) zabijTvora(hra, u, t);
    return true;
  }
  function ustup(hra, t, u) {
    const sv = hra.sv;
    let nej = -1, nejV = vzd(sv, u.g, t.g);
    for (const s of PR.stojiskaKolem(sv, t.g)) { const d = vzd(sv, u.g, s); if (d > nejV) { nejV = d; nej = s; } }
    if (nej < 0) return false;
    S.hra.pustPraci(hra, t);
    t.dalsi = nej; t.krok = 0; t.krokDoba = 4; t.cesta = []; t.hledej = hra.tik + 8;
    return true;
  }

  // --- tah tvora ----------------------------------------------------------------------------------
  function krokTvora(hra, u) {
    const sv = hra.sv, D = DRUHY[u.druh];
    if (u.krokDoba) {
      if (++u.krok < u.krokDoba) return;
      if (prochozi(hra, u.dalsi, D) === true) u.g = u.dalsi;          // cíl kroku mezitím zastavěli: zůstane stát
      u.dalsi = -1; u.krok = 0; u.krokDoba = 0;
    }
    // zazděný nebo zasypaný tvor: vysype se na nejbližší volné pole, jinak zahyne
    if (sv.teren[u.g] !== M.VOLNO || sv.blok[u.g]) {
      const kam = S.hra.volnaMistaKolem(hra, u.g, 1)[0];
      if (kam === undefined) { zabijTvora(hra, u, null); return; }
      u.g = kam; u.cesta = [];
    }
    if (sv.kap[u.g] && sv.kapTyp[u.g] === K.MAGMA) { zabijTvora(hra, u, null); return; }
    // past
    const b0 = S.stavby.budovaNa(hra, u.g);
    if (b0 && b0.typ === 'past' && !(b0.napnout > hra.tik)) {
      u.zdravi -= 25; b0.napnout = hra.tik + 300;
      if (u.zdravi <= 0) { zabijTvora(hra, u, null); return; }
    }
    if (u.utok > 0) u.utok--;
    // útok na souseda, lukostřelec i na dálku
    const zazeh = (u.druh === 'spac' || u.vlna) && S.pribeh ? S.pribeh.zazehnujici(hra) : null;
    const obet = (zazeh && vzd(sv, zazeh.g, u.g) <= 1 ? zazeh : null) || hra.trpaslici.find(t => vzd(sv, t.g, u.g) <= 1 && !vezChrani(hra, t)) ||
      (D.dosah && hra.trpaslici.find(t => vzd(sv, t.g, u.g) <= D.dosah && vidi(hra, u.g, t.g)));
    if (obet) {
      if (u.utok <= 0) {
        u.utok = PRODLEVA + (D.pohyb === 'let' ? 5 : 0) + (D.dosah ? 5 : 0);
        u.zautocil = hra.tik;
        if (D.dosah && vzd(sv, obet.g, u.g) > 1) { strela(hra, u.g, obet.g, 'sip'); PR.zvuk(hra, 'sip', u.g); }
        PR.zvuk(hra, u.druh === 'spac' ? 'rev' : 'zasah', obet.g);
        zasah(hra, obet, D.utok, true);
        if (obet.zdravi <= 0) S.hra.umri(hra, obet, `padl v boji s: ${D.nazev}`);
        else {
          if (obet.spi) S.hra.pustPraci(hra, obet);
          if (!(obet.poplachZprava > hra.tik)) { obet.poplachZprava = hra.tik + 600; PR.zprava(hra, 'zraneni', `${D.nazev[0].toUpperCase() + D.nazev.slice(1)} ${D.dosah && vzd(sv, obet.g, u.g) > 1 ? 'postřelil' : 'napadl'}: ${obet.jmeno}!`, obet.g); }
        }
      }
      return;
    }
    // cesta
    if (u.cesta.length) {
      const dalsi = u.cesta[0], v = prochozi(hra, dalsi, D);
      if (v === 'dvere') {                                      // vyrazit dveře / bránu
        if (u.utok <= 0) {
          u.utok = PRODLEVA;
          const b = S.stavby.budovaNa(hra, dalsi);
          if (b) {
            b.poskozeni = (b.poskozeni || 0) + Math.round(8 / D.dvere); PR.zvuk(hra, 'dvere', dalsi);
            if (b.poskozeni >= 8) { S.priroda.znicBudovu(hra, b); PR.zprava(hra, 'boj', u.druh === 'trol' ? `⚔️ Troll rozbil ${b.typ === 'dvere' ? 'dveře' : 'padací mříž'}!` : '⚔️ Goblini vyrazili dveře!', dalsi); }
          }
        }
        return;
      }
      if (!v || (vzd(sv, dalsi, u.g) > 1 && Math.abs(dalsi - u.g) !== sv.N)) { u.cesta = []; return; }
      u.cesta.shift();
      u.dalsi = dalsi; u.krok = 0; u.krokDoba = D.krok;
      const [ax, ay] = xy(sv, u.g), [bx, by] = xy(sv, dalsi); if (ax !== bx || ay !== by) u.smer = Math.round(Math.atan2(by - ay, bx - ax) / (Math.PI / 4) + 8) % 8;
      return;
    }
    if (u.hledej > 0) { u.hledej--; return; }
    u.hledej = 15 + (u.id % 7);
    // lupič: po cennostech ve skladu, s kořistí pryč
    if (u.zlodej && D.krade) {
      if (u.nese) { odnesKorist(hra, u); return; }
      const r0 = hledejTvor(hra, u.g, D, g => S.stavby.prijme(hra, g, 'kamen') !== undefined && hra.veci.some(v => v.g === g && (S.obdobi.HODNOTA[v.druh] || 1) >= 8), 3000);
      if (r0) { if (!r0.cesta.length) krast(hra, u); else u.cesta = r0.cesta; return; }
      delete u.zlodej;
    }
    if (u.obleh > hra.tik) {                                   // obléhající čekají na cestě, střílí, kdo přijde blízko
      const r = hledejTvor(hra, u.g, D, g => hra.trpaslici.some(t => vzd(sv, t.g, g) <= 1), OBLEH_DOSAH);
      if (r) u.cesta = r.cesta;
      return;
    }
    // k nejbližšímu trpaslíkovi (k zažíhajícímu přednostně)
    const kolem = new Set();
    for (const t of zazeh ? [zazeh] : hra.trpaslici) { if (vezChrani(hra, t)) continue; for (const s of [t.g, ...PR.stojiskaKolem(sv, t.g)]) kolem.add(s); }
    const r = hledejTvor(hra, u.g, D, g => kolem.has(g), D.pohyb === 'leze' ? 600 : DOSAH_HLEDANI);
    if (r) { u.cesta = r.cesta; u.marne = 0; return; }
    if (u.najezd && !u.nese && (u.marne = (u.marne || 0) + 1) > MARNE) {
      hra.tvorove.splice(hra.tvorove.indexOf(u), 1);
      if (!hra.tvorove.some(v => v.najezd)) PR.zprava(hra, 'boj', 'Nájezdníci to vzdali a stáhli se – ke klanu se nedostali.', u.g);
      return;
    }
    if (D.krade && u.najezd) {
      if (!u.nese) { const r2 = hledejTvor(hra, u.g, D, g => hra.veci.some(v => v.g === g && S.stavby.prijme(hra, g, v.druh))); if (r2) { if (!r2.cesta.length) krast(hra, u); else u.cesta = r2.cesta; } }
      else odnesKorist(hra, u);
    } else if (u.druh === 'netopyr' && nah(hra) < 0.5) {
      const kam = []; sousedeTvora(hra, u.g, D, h => kam.push(h));
      if (kam.length) u.cesta = [kam[Math.floor(nah(hra) * kam.length)]];
    }
  }
  // strážce ve strážní věži: tvorové na něj nedosáhnou (stojí nad nimi)
  const vezChrani = (hra, t) => { const b = hra.budovaNa[t.g] && S.stavby.budovaNa(hra, t.g); return !!b && b.typ === 'vez'; };
  function odnesKorist(hra, u) {
    const ven = S.obdobi.naOkraji(hra);
    if (u.g === ven) { utekl(hra, u); return; }
    const r = hledejTvor(hra, u.g, DRUHY[u.druh], g => g === ven, 4000);
    if (r) u.cesta = r.cesta; else utekl(hra, u);
  }
  function krast(hra, u) {
    const vv = hra.veci.filter(v => v.g === u.g && v.druh !== 'klic').sort((a, b) => (S.obdobi.HODNOTA[b.druh] || 1) - (S.obdobi.HODNOTA[a.druh] || 1));
    if (!vv.length) return;
    const v = vv[0]; v.g = -2; u.nese = v.id; hra.zmenaPraci++;          // g −2 = nese tvor
    PR.zprava(hra, 'boj', `Goblin krade ze skladu: ${PR.VECI[v.druh].nazev}!`, u.g);
  }
  function utekl(hra, u) {
    if (u.nese) { const v = PR.vecPodle(hra, u.nese); if (v) { PR.odeberVec(hra, v); hra.spotrebovano++; PR.zprava(hra, 'boj', 'Goblin utekl i s kořistí.'); } }
    hra.tvorove.splice(hra.tvorove.indexOf(u), 1);
  }

  // --- strážci a poplach -------------------------------------------------------------------------
  const znamyNepritel = hra => hra.tvorove.some(u => hra.sv.zn[u.g]);
  // práce strážce: lov známého dosažitelného nepřítele; vrací { prace, cesta } nebo null
  function lov(hra, t) {
    if (!t.povoleno.hlidat || t.zdravi < ZDRAVI_LOV || !znamyNepritel(hra) || t.lovBlok > hra.tik) return null;
    const sv = hra.sv, cile = new Set(), s = hra.tvorove.find(u => u.druh === 'spac');
    const naSpace = s && t.zbran && S.pribeh && S.pribeh.naSpaceVSkupine(hra, s, t);
    for (const u of hra.tvorove) if (sv.zn[u.g] && (u.druh !== 'spac' || naSpace)) for (const st of PR.stojiskaKolem(sv, u.g, true)) cile.add(st);
    // na Spáče se ozbrojení strážci nejdřív shromáždí kousek od něj (3–6 polí) a jdou až ve skupině
    const shromazdiste = new Set();
    if (s && t.zbran && !naSpace && sv.zn[s.g]) {
      const [sx, sy, sp] = xy(sv, s.g);
      for (let y = sy - 6; y <= sy + 6; y++) for (let x = sx - 6; x <= sx + 6; x++) {
        if (x < 0 || y < 0 || x >= sv.W || y >= sv.H || Math.max(Math.abs(x - sx), Math.abs(y - sy)) < 3) continue;
        const g = sp * sv.N + y * sv.W + x; if (C.pruchozi(sv, g)) { cile.add(g); shromazdiste.add(g); }
      }
      if (shromazdiste.has(t.g)) return { prace: { osobni: 'cekat', klic: 'osobni', faze: 'cekat' }, cesta: [] };   // čeká na shromaždišti na ostatní
    }
    const r = cile.size ? C.hledej(hra, [t.g], g => cile.has(g), 8000) : null;
    if (r) return { prace: { osobni: 'lov', klic: 'osobni', faze: 'jit' }, cesta: r.cesta };
    t.lovBlok = hra.tik + 60;
    return null;
  }
  // výcvik ve zbrojnici (bez ní na místě pomaleji)
  function vycvik(hra, t) {
    if (!t.povoleno.hlidat || (t.dov.boj || 0) >= 10) return null;
    const zb = hra.budovy.filter(b => b.typ === 'zbrojnice');
    const mista = new Set();
    for (const b of zb) for (const g of S.stavby.predniPole(hra.sv, b)) if (C.pruchozi(hra.sv, g) && !hra.trpaslici.some(u => u !== t && u.prace && u.prace.osobni === 'cvicit' && u.prace.misto === g)) mista.add(g);
    if (!mista.size) return null;
    const r = C.hledej(hra, [t.g], g => mista.has(g), 4000);
    return r ? { prace: { osobni: 'cvicit', klic: 'osobni', faze: 'jit', misto: r.cil }, cesta: r.cesta } : null;
  }
  // úkryt při poplachu: uzavřená místnost s dveřmi (nejbližší pole), jinak nic
  function ukryt(hra, t) {
    const MI = S.mistnosti, mm = MI.mistnosti(hra);
    const m = MI.mistnostNa(hra, t.g);
    if (m && m.uzavrena && m.dvere) return null;              // už je v úkrytu
    const r = C.hledej(hra, [t.g], g => { const x = mm.id[g] && mm.seznam[mm.id[g]]; return !!x && x.uzavrena && x.dvere > 0; }, 8000);
    return r ? { prace: { osobni: 'ukryt', klic: 'osobni', faze: 'jit' }, cesta: r.cesta } : null;
  }
  // vybavení strážce: zbraň (válečná sekera, kuše) a zbroj ze skladu
  function vybavStrazce(hra, t) {
    if (!t.povoleno.hlidat) return null;
    const chce = v => v.g >= 0 && ((!t.zbran && (v.druh === 'valecna_sekera' || v.druh === 'kuse')) || (!t.zbroj && v.druh === 'zbroj'));
    const vzate = new Set(hra.trpaslici.filter(u => u !== t && u.prace && u.prace.vec).map(u => u.prace.vec));
    const naPoli = new Map(); for (const v of hra.veci) if (chce(v) && !vzate.has(v.id)) naPoli.set(v.g, v);
    if (!naPoli.size) return null;
    const r = C.hledej(hra, [t.g], g => naPoli.has(g), 6000);
    return r ? { prace: { osobni: 'vybavit', vec: naPoli.get(r.cil).id, klic: 'osobni', faze: 'k_veci' }, cesta: r.cesta } : null;
  }

  // --- tah hrozeb ---------------------------------------------------------------------------------
  function tik(hra) {
    for (const u of hra.tvorove.slice()) krokTvora(hra, u);
    if (hra.strely && hra.strely.length && hra.tik % 30 === 0) hra.strely = hra.strely.filter(s => hra.tik - s.tik < 30);
    // nájezdy: varování den předem, pak nájezd (za finále počká)
    if (!hra.konec && hra.trpaslici.length) {
      if (hra.tik === hra.dalsiNajezd - DEN()) varujNajezd(hra);
      if (hra.tik >= hra.dalsiNajezd) {
        if (S.pribeh && S.pribeh.finaleBezi(hra)) hra.dalsiNajezd = hra.tik + DEN();
        else {
          najezd(hra);
          hra.dalsiNajezd = hra.tik + Math.round((18 + nah(hra) * 8) * (1 - 0.3 * neklid(hra)) * Math.pow(96 / hra.sv.W, 0.25) * DEN());
          hra.dalsiNajezdTyp = zvolTypNajezdu(hra);
        }
      }
    }
    if (hra.oblehani && hra.tik >= hra.oblehani.do) { hra.oblehani = null; PR.zprava(hra, 'boj', '⚔️ Obléhání skončilo – goblini z rokle útočí!'); }
    // v hlubinách při neklidu občas vyleze pavouk
    if (hra.tik % DEN() === 300 && neklid(hra) > 0.4 && nah(hra) < neklid(hra) * 0.15) tvorZHlubin(hra);
  }

  S.hrozby = { DRUHY, ZBRAN, KUSE, TYPY_NAJEZDU, prochozi, uzkaChodba, hledejTvor, vidi, novyTvor, probudJeskyni, neklid, silaNajezdu,
               trolluNa, predpovedNajezdu, najezd, varujNajezd, tvorZHlubin, utokTrpaslika, ochrana, zasah, zabijTvora, branSe,
               krokTvora, znamyNepritel, lov, vycvik, ukryt, vybavStrazce, strazce, tik, vzd };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;
