/* ============================================================
   Srdce hory – hrozby.js: tvorové, nájezdy a boj.

   Tvorové:
     netopýr – létá kudykoli volným prostorem (slabý, otravný)
     pavouk  – leze po stěnách i stropech (silný, líný)
     goblin  – chodí jako trpaslík, vyráží dveře, krade (nájezdy)
   Tvorové spí ve skrytých jeskyních a probudí se, když se do jeskyně
   prokope. Goblinní nájezdy chodí od 36. dne zhruba každých 18–26 dní,
   silnější se slávou a hloubkou; tunelem, když už je odkrytý, jinak údolím.
   Boj: kdo stojí vedle nepřítele, bije (jednou za 10 tahů). Poškození
   = útok × dovednost × náhoda, zbroj ho sníží. Strážci nepřátele loví,
   bez nepřátel cvičí ve zbrojnici. Dveře netvory nepustí (goblin je
   vyrazí), padací mříž nepustí nikoho, past zraní netvora.
   Čistá logika bez DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const { W, H, M, pevne } = T.hora;
  const P = T.prace, S = T.stavby, C = T.cesty;
  const N = W * H;

  const DRUHY = {
    netopyr: { nazev: 'netopýr', zdravi: 12, utok: 3, krok: 3, pohyb: 'let' },
    pavouk:  { nazev: 'obří pavouk', zdravi: 45, utok: 6, krok: 6, pohyb: 'leze', lup: 'hedvabi' },
    goblin:  { nazev: 'goblin', zdravi: 30, utok: 6, krok: 5, pohyb: 'chuze', lup: 'cepel' },
    spac:    { nazev: 'Pradávný spáč', zdravi: 420, utok: 20, krok: 7, pohyb: 'leze', lup: 'hvezdna' },
  };
  const PRODLEVA_UTOKU = 10, DOSAH_HLEDANI = 900;

  const nah = hra => P.nahoda(hra);
  const vzd = (a, b) => Math.max(Math.abs(a % W - b % W), Math.abs((a / W | 0) - (b / W | 0)));
  const vedle = (a, b) => vzd(a, b) <= 1;

  // --- pohyb tvorů ---------------------------------------------------------------------------
  function prochozi(hra, j, druh) {
    const t = hra.hora.teren[j];
    if (t !== M.VZDUCH) return false;
    if (hra.zavreno[j]) return false;                           // zavřená mříž
    if (hra.stavba[j] === S.K.DVERE) return druh === 'goblin' ? 'dvere' : false;
    return true;
  }
  function sousedeTvora(hra, i, druh, fn) {
    const x = i % W, D = DRUHY[druh];
    if (D.pohyb === 'chuze') {
      C.sousede(hra, i, (j, pres) => {
        const p = prochozi(hra, j, druh); if (!p) return;
        if (pres >= 0 && !prochozi(hra, pres, druh)) return;
        fn(j, pres, p === 'dvere');
      });
      // dveře: goblin k nim dojde, i když za nimi nestojí (pak je vyrazí)
      for (const dx of [-1, 1]) {
        const j = i + dx;
        if (x + dx >= 0 && x + dx < W && hra.stavba[j] === S.K.DVERE && hra.hora.teren[j] === M.VZDUCH) fn(j, -1, true);
      }
      return;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, j = i + dy * W + dx;
      if (xx < 0 || xx >= W || j < 0 || j >= N || prochozi(hra, j, druh) !== true) continue;
      if (dx && dy && (prochozi(hra, i + dx, druh) !== true || prochozi(hra, i + dy * W, druh) !== true)) continue;   // přes roh ne
      if (D.pohyb === 'leze' && !uStěny(hra, j) && uStěny(hra, i)) continue;   // od stěny se neodlepí (kdo visí ve vzduchu, dolétne ke stěně)
      fn(j, -1, false);
    }
  }
  function uStěny(hra, j) {
    const x = j % W;
    for (const k of [j - W, j + W, x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1]) if (k >= 0 && k < N && pevne(hra.hora.teren[k])) return true;
    return false;
  }
  // BFS pro tvora: cil(i) → hodnota; vrací { i, hodnota, cesta }
  function hledejTvor(hra, start, druh, cil, limit) {
    const pred = new Map([[start, -1]]), pres = new Map(), fronta = [start];
    for (let h = 0; h < fronta.length && h < (limit || DOSAH_HLEDANI); h++) {
      const i = fronta[h], v = cil(i);
      if (v) {
        const c = []; let k = i;
        while (k !== start) { c.push(k); if (pres.get(k) >= 0) c.push(pres.get(k)); k = pred.get(k); }
        return { i, hodnota: v, cesta: c.reverse() };
      }
      sousedeTvora(hra, i, druh, (j, p) => { if (!pred.has(j)) { pred.set(j, i); pres.set(j, p); fronta.push(j); } });
    }
    return null;
  }

  // --- vznik tvorů -----------------------------------------------------------------------------
  function novyTvor(hra, druh, i) {
    const D = DRUHY[druh];
    const t = { id: hra.dalsiId++, druh, i, o: i, t: 0, dur: 0, zdravi: D.zdravi, cesta: [], smer: 1, utok: 0, hledej: 0,
                nese: 0, cil: 0, stav: 'nic' };
    hra.tvorove.push(t);
    return t;
  }
  // prokopnutí do jeskyně probudí, co v ní spí
  function probudJeskyni(hra, o, zprava) {
    const bunky = (o.bunky || []).filter(i => hra.hora.teren[i] === M.VZDUCH);
    if (!bunky.length) return;
    const vyber = () => bunky[Math.floor(nah(hra) * bunky.length)];
    const pridej = (druh, n) => { for (let k = 0; k < n; k++) novyTvor(hra, druh, vyber()); return n; };
    let n = 0, kdo = '';
    if (o.typ === 'krapnikova' || o.typ === 'jeskyne') { n = pridej('netopyr', 1 + Math.floor(nah(hra) * 3)); kdo = 'Z jeskyně vylétli netopýři!'; }
    if (o.typ === 'jeskyne' || o.typ === 'hlubinna') { const k = pridej('pavouk', 1 + Math.floor(nah(hra) * 2)); if (k) { n += k; kdo = 'V jeskyni se pohnuli obří pavouci!'; } }
    if (o.typ === 'houbova' && nah(hra) < 0.5) { n += pridej('pavouk', 1); kdo = 'Mezi houbami číhá obří pavouk!'; }
    if (o.typ === 'tunel') {
      n += pridej('goblin', 2 + Math.floor(nah(hra) * 2)); kdo = 'Tunel patří goblinům – a jsou doma!';
      hra.dalsiNajezd = Math.min(hra.dalsiNajezd, hra.tik + 4 * T.hra.TAHU_ZA_DEN);
    }
    if (n) zprava('smrt', '⚔️ ' + kdo);
  }
  function najezd(hra, zprava) {
    const sila = Math.min(6, 1 + Math.floor((hra.slava || 0) / 60) + Math.floor(hra.nejhloubeji / 80));
    const tunel = hra.hora.oblasti.find(o => o.typ === 'tunel');
    const odkryty = tunel && hra.objeveno[tunel.cislo];
    let mista;
    if (odkryty) mista = tunel.bunky.filter(i => hra.hora.teren[i] === M.VZDUCH && C.stojne(hra, i));
    if (!mista || !mista.length) mista = [T.obdobi.naOkraji(hra)];
    for (let k = 0; k < sila; k++) novyTvor(hra, 'goblin', mista[Math.floor(nah(hra) * mista.length)]);
    T.hra.zvuk(hra, 'roh');
    zprava('smrt', `⚔️ Goblinní nájezd! ${sila} goblinů ${odkryty ? 'vylezlo z tunelu' : 'přichází údolím k bráně'}. Zavři dveře a pošli strážce.`);
    hra.najezdu = (hra.najezdu || 0) + 1;
  }

  // --- boj ---------------------------------------------------------------------------------------
  const ZBRAN = { valecna_sekera: 14, krumpac: 6, sekera: 8, kladivo: 7 };
  function utokTrpaslika(t, hra) {
    const zb = t.zbran ? ZBRAN[t.zbran.druh] || 8 : t.nastroj ? ZBRAN[t.nastroj.druh] || 4 : 4;
    const kov = (t.zbran || t.nastroj || {}).mat === 'med' ? 0.8 : 1;
    return zb * kov * (1 + 0.1 * (t.dov.boj || 0)) * (hra && T.pribeh ? T.pribeh.utokKlanu(hra) : 1);
  }
  function ochrana(t) { return t.zbroj ? (t.zbroj.mat === 'med' ? 0.25 : 0.4) : 0; }
  function zasah(hra, cil, sila, jeTrpaslik) {
    const dmg = Math.max(1, Math.round(sila * (0.7 + nah(hra) * 0.6) * (jeTrpaslik ? 1 - ochrana(cil) : 1)));
    cil.zdravi -= dmg;
    return dmg;
  }
  function zabijTvora(hra, u, zprava, kdo) {
    hra.tvorove.splice(hra.tvorove.indexOf(u), 1);
    const D = DRUHY[u.druh];
    if (u.nese) { const v = hra.veci.find(v => v.id === u.nese); if (v) { v.nese = 0; v.rez = 0; v.i = u.i; } }
    if (D.lup && nah(hra) < 0.6) P.novaVec(hra, D.lup, u.i, 0);
    P.usadVeci(hra);
    hra.zabito = (hra.zabito || 0) + 1;
    T.hra.zvuk(hra, 'padl', u.i);
    const koho = { pavouk: 'obřího pavouka', spac: 'Pradávného spáče', goblin: 'goblina', netopyr: 'netopýra' }[u.druh];
    if (u.druh !== 'netopyr' || nah(hra) < 0.3) zprava('objev', `${kdo ? kdo.jmeno : 'Past'} zabil ${koho}.`);
  }
  // trpaslík bije souseda-nepřítele (volá se každý tah trpaslíka, i při práci)
  function branSe(hra, t, zprava) {
    if (t.utok > 0) { t.utok--; return false; }
    if (t.stav === 'spi' || t.zuri > hra.tik) return false;
    const u = hra.tvorove.find(u => vedle(u.i, t.i));
    if (!u) return false;
    // nevyzbrojený a zraněný trpaslík utíká (o krok dál od nepřítele)
    if (!t.zbran && !t.povoleno.hlidat && t.zdravi < 40) {
      let nej = -1, nejV = vzd(u.i, t.i);
      C.sousede(hra, t.i, (j, pres) => { if (pres < 0 && vzd(u.i, j) > nejV) { nejV = vzd(u.i, j); nej = j; } });
      if (nej >= 0) { T.hra.pustPraci(hra, t); const dx = nej % W - t.i % W; if (dx) t.smer = dx > 0 ? 1 : -1; t.o = t.i; t.i = nej; t.t = 0; t.dur = 4; t.stav = 'utika'; t.cekej = 10; return true; }
    }
    t.utok = PRODLEVA_UTOKU;
    zasah(hra, u, utokTrpaslika(t, hra), false);
    T.hra.zvuk(hra, 'boj', u.i, t.zbran ? 1 : 0);
    if (t.povoleno.hlidat && (t.dov.boj || 0) < 10 && nah(hra) < 0.08) t.dov.boj = (t.dov.boj || 0) + 1;
    if (u.zdravi <= 0) zabijTvora(hra, u, zprava, t);
    return true;
  }

  // --- tah tvora -----------------------------------------------------------------------------------
  function presunTvor(u, j, doba) {
    const dx = j % W - u.i % W; if (dx) u.smer = dx > 0 ? 1 : -1;
    u.o = u.i; u.i = j; u.t = 0; u.dur = doba;
  }
  function krokTvora(hra, u, zprava) {
    if (u.t < u.dur) { u.t++; if (u.t < u.dur) return; }
    u.o = u.i; u.t = u.dur = 0;
    const D = DRUHY[u.druh];
    // chodec padá
    if (D.pohyb === 'chuze' && !C.stojne(hra, u.i) && hra.hora.teren[u.i + W] === M.VZDUCH) { presunTvor(u, u.i + W, 2); return; }
    if (hra.hora.teren[u.i] === M.MAGMA) { zabijTvora(hra, u, zprava, null); return; }
    // past
    if (hra.stavba[u.i] === S.K.PAST && !hra.stavbaStav[u.i]) {
      u.zdravi -= 25; hra.stavbaStav[u.i] = 1; hra.pastiNapnout.push({ i: u.i, tik: hra.tik + 300 });
      if (u.zdravi <= 0) { zabijTvora(hra, u, zprava, null); return; }
    }
    if (u.utok > 0) u.utok--;
    // útok na souseda
    const obet = hra.trpaslici.find(t => vedle(t.i, u.i));
    if (obet) {
      if (u.utok <= 0) {
        u.utok = PRODLEVA_UTOKU + (D.pohyb === 'let' ? 5 : 0);
        zasah(hra, obet, D.utok, true);
        T.hra.zvuk(hra, u.druh === 'spac' ? 'rev' : 'zasah', obet.i);
        if (obet.zdravi <= 0) T.hra.umri(hra, obet, `${obet.jmeno} padl v boji s: ${D.nazev}.`);
        else if (!obet.poplach || obet.poplach < hra.tik) { obet.poplach = hra.tik + 600; zprava('zraneni', `${D.nazev[0].toUpperCase() + D.nazev.slice(1)} napadl: ${obet.jmeno}!`); }
      }
      return;
    }
    // cesta
    if (u.cesta.length) {
      const dalsi = u.cesta.shift();
      if (hra.stavba[dalsi] === S.K.DVERE && u.druh === 'goblin') {             // vyrazit dveře
        u.cesta.unshift(dalsi);
        if (u.utok <= 0) {
          u.utok = PRODLEVA_UTOKU;
          if (++hra.stavbaStav[dalsi] >= 8) { S.zbourej(hra, dalsi, () => {}); hra.stavbaStav[dalsi] = 0; zprava('smrt', '⚔️ Goblini vyrazili dveře!'); }
        }
        return;
      }
      const ok = D.pohyb === 'chuze' ? prochozi(hra, dalsi, u.druh) : prochozi(hra, dalsi, u.druh) === true;
      if (!ok || vzd(dalsi, u.i) > 2) { u.cesta = []; return; }
      presunTvor(u, dalsi, D.krok);
      return;
    }
    if (u.hledej > 0) { u.hledej--; return; }
    u.hledej = 15 + (u.id % 7);
    // cíl: nejbližší trpaslík; goblin bez cíle krade; netopýr poletuje
    const obsazeno = new Set(hra.trpaslici.map(t => t.i));
    const r = hledejTvor(hra, u.i, u.druh, i => {
      for (const t of hra.trpaslici) if (vedle(t.i, i)) return 1;
      return 0;
    }, D.pohyb === 'leze' ? 400 : DOSAH_HLEDANI);
    if (r) { u.cesta = r.cesta; return; }
    void obsazeno;
    if (u.druh === 'goblin') {
      if (!u.nese) {
        const r2 = hledejTvor(hra, u.i, 'goblin', i => hra.veci.find(v => !v.nese && v.i === i && S.jeSklad(hra, i)) ? 1 : 0);
        if (r2) { if (!r2.cesta.length) krast(hra, u, zprava); else u.cesta = r2.cesta; }
      } else {
        const ven = T.obdobi.naOkraji(hra);
        if (u.i === ven) { utekl(hra, u, zprava); return; }
        const r3 = hledejTvor(hra, u.i, 'goblin', i => i === ven ? 1 : 0, 3000);
        if (r3) u.cesta = r3.cesta; else utekl(hra, u, zprava);
      }
    } else if (u.druh === 'netopyr' && nah(hra) < 0.5) {
      const kam = [];
      sousedeTvora(hra, u.i, u.druh, j => kam.push(j));
      if (kam.length) u.cesta = [kam[Math.floor(nah(hra) * kam.length)]];
    }
  }
  function krast(hra, u, zprava) {
    const vv = hra.veci.filter(v => !v.nese && v.i === u.i);
    if (!vv.length) return;
    vv.sort((a, b) => (T.obdobi.HODNOTA[b.druh] || 1) - (T.obdobi.HODNOTA[a.druh] || 1));
    const v = vv[0];
    v.nese = u.id; v.rez = -1; u.nese = v.id;
    zprava('zraneni', `Goblin krade ze skladu: ${P.VECI[v.druh].nazev}!`);
  }
  function utekl(hra, u, zprava) {
    if (u.nese) { const v = hra.veci.find(v => v.id === u.nese); if (v) hra.veci.splice(hra.veci.indexOf(v), 1); zprava('zraneni', 'Goblin utekl i s kořistí.'); }
    hra.tvorove.splice(hra.tvorove.indexOf(u), 1);
  }

  // --- strážci --------------------------------------------------------------------------------------
  // najde práci strážce: lov nepřítele, jinak výcvik ve zbrojnici
  function praceStrazce(hra, t) {
    if (!t.povoleno.hlidat) return null;
    if (hra.tvorove.length) {
      const r = C.hledej(hra, t.i, i => hra.tvorove.some(u => vedle(u.i, i)) ? 1 : 0, 1500);
      if (r) return { hodnota: { typ: 'lov', pos: r.i }, cesta: r.cesta };
    }
    if (!hra.tvorove.length && (t.dov.boj || 0) < 10) {
      const r = C.hledej(hra, t.i, i => {
        if (hra.stavba[i] !== S.K.DILNA || !C.stojne(hra, i)) return 0;
        const d = S.dilnaNa(hra, i);
        return d && d.typ === 'zbrojnice' && !hra.trpaslici.some(u => u !== t && u.prace && u.prace.typ === 'cvicit' && u.prace.pos === i) ? 1 : 0;
      }, 1500);
      if (r) return { hodnota: { typ: 'cvicit', pos: r.i }, cesta: r.cesta };
    }
    return null;
  }

  function tik(hra, zprava) {
    // nájezdy
    if (hra.tik >= hra.dalsiNajezd && hra.trpaslici.length) {
      najezd(hra, zprava);
      hra.dalsiNajezd = hra.tik + Math.round((18 + nah(hra) * 8) * T.hra.TAHU_ZA_DEN);
    }
    for (const u of hra.tvorove.slice()) if (hra.tvorove.includes(u)) krokTvora(hra, u, zprava);
    // pasti se samy napnou
    if (hra.pastiNapnout.length) hra.pastiNapnout = hra.pastiNapnout.filter(p => { if (p.tik > hra.tik) return true; hra.stavbaStav[p.i] = 0; return false; });
  }

  T.hrozby = { DRUHY, ZBRAN, novyTvor, probudJeskyni, najezd, utokTrpaslika, ochrana, branSe, zabijTvora, praceStrazce,
               hledejTvor, sousedeTvora, tik, vedle };
})(TRP);

if (typeof module !== 'undefined') module.exports = TRP;
