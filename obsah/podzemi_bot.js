/* ============================================================
   podzemi_bot.js – bot pro Nekonečné podzemí.
   Rozhoduje nad čistou logikou (podzemi_logika.js): k sousední potvoře se otočí a bije, jí, pije,
   obléká lepší věci, otvírá blízké truhly, nakupuje u obchodníka, jinak jde ke schodům.
   Používá ho test vyvážení (_test/podzemi_boj.js) i hra (tlačítko 🤖 – ukázková výprava).
   Volby: { chytry – nosí max 4 jídla, prodává horší výbavu a kupuje větší batoh,
            slaby – nekouzlí, nesbírá, nezkouší neznámé lektvary, bezBatohu,
            akce(typ, arg) – kudy pouštět okamžité akce u obchodníka (výchozí L.akce) }
   ============================================================ */
(function (koren) {
  'use strict';
  function vytvor(L) {
  const { T, DX, DY } = L;
  // bot: k sousední potvoře se otočí a bije, jí, pije, obléká lepší věci, otvírá blízké truhly, jinak jde ke schodům
  function cestaK(s, cx, cy, sTeleporty) {
    const p = s.mapaPatra, m = p.mapa.slice();
    for (const t of s.truhly) m[t.y * p.w + t.x] = 0;          // truhly a překážky jsou zeď
    for (const d of s.dekorace) if (d.druh !== 'kosti') m[d.y * p.w + d.x] = 0;
    if (!s.hrac.batoh.some(q => q.typ === 'klic')) for (const i of s.zamcene) m[i] = 0;
    for (const i of s.mrize) m[i] = 0;                                 // mříž
    if (s.teleporty && !sTeleporty) for (const [x, y] of s.teleporty) if (x !== cx || y !== cy) m[y * p.w + x] = 0;
    if (L.bossZiv(s) && !(cx === p.dolu.x && cy === p.dolu.y)) m[p.dolu.y * p.w + p.dolu.x] = 0;   // bariéra
    m[cy * p.w + cx] = p.mapa[cy * p.w + cx] || 1;
    return L.vzdalenosti(m, p.w, p.h, cx, cy);
  }
  function krokK(s, dist) {
    const p = s.mapaPatra;
    let best = -1, bd = 1e9;
    for (let k = 0; k < 4; k++) { const i = (s.y + DY[k]) * p.w + s.x + DX[k]; if (dist[i] >= 0 && dist[i] < bd) { bd = dist[i]; best = k; } }
    if (best < 0) return null;
    return best === s.smer ? 'vpred' : ((best - s.smer + 4) % 4 === 3 ? 'otocL' : 'otocP');
  }
  function rozhodni(s, stat, volby) {
    volby = volby || {};
    const SLABY = !!volby.slaby, CHYTRY = !!volby.chytry;
    const akce = volby.akce || ((typ, arg) => L.akce(s, typ, arg));   // okamžité akce u obchodníka (UI je pouští přes sebe)
    stat = stat || {};
    for (const k of ['odpocinek', 'lektvaru', 'nasazeno', 'snedeno', 'kouzel', 'nakupu']) stat[k] = stat[k] || 0;
    const h = s.hrac, o = L.odvozene(s), b = h.batoh;
    const vedle = s.potvory.find(m => Math.abs(m.x - s.x) + Math.abs(m.y - s.y) === 1);
    const honi = s.potvory.some(m => m.stav === 'honi');
    if (h.volba) {                                // schopnost podle priority
      const PORADI = ['tuhy', 'bojovnik', 'hbity', 'houzevnaty', 'stastlivec', 'zaklinac', 'mag', 'stitonos', 'zlodej', 'skromny', 'smlouvac', 'lukostrelec'];
      stat.schopnosti = (stat.schopnosti || 0) + 1;
      return ['schopnost', PORADI.find(k => h.volba.includes(k))];
    }
    const lek = b.find(p => p.typ === 'lektvar' && s.zname.includes(p.lektvar) && (p.lektvar === 'leceni' || p.lektvar === 'velkeLeceni'));
    if (h.hp < o.maxHp * 0.35 && lek) { stat.lektvaru++; return ['pouzij', lek.id]; }
    const kouzlo = druh => b.find(q => (q.typ === 'svitek' || q.typ === 'hulka') && L.ZAKLADY[q.zaklad].kouzlo === druh);
    // nouzový únik lanem: dochází zdraví, není čím se léčit a potvora je u tebe
    const lano = b.find(q => q.zaklad === 'lano');
    if (lano && vedle && h.hp < o.maxHp * 0.25 && !lek && !kouzlo('leceni') && !L.bossZiv(s)) { stat.lanem = (stat.lanem || 0) + 1; return ['pouzij', lano.id]; }
    const hojeni = kouzlo('leceni');
    if (h.hp < o.maxHp * 0.35 && hojeni && !SLABY) { stat.kouzel++; return ['pouzij', hojeni.id]; }
    // útočné kouzlo na silnou potvoru v přímce před sebou
    const utocne = kouzlo('ohen') || kouzlo('blesk');
    if (utocne && !SLABY) {
      for (let d = 1; d <= 5; d++) {
        const x = s.x + DX[s.smer] * d, y = s.y + DY[s.smer] * d;
        if (L.blokujePohled(s, x, y)) break;
        const m = L.potvoraNa(s, x, y);
        if (m) { if (m.hp > 25 || L.BESTIAR[m.druh].boss) { stat.kouzel++; return ['pouzij', utocne.id]; } break; }
      }
    }
    if (vedle && h.vybava.stit && h.hp < o.maxHp * 0.3 && !lek && !SLABY && s.tah % 2 === 0) { stat.kryti = (stat.kryti || 0) + 1; return ['kryt']; }
    if (vedle) {
      const k = [0, 1, 2, 3].find(k => s.x + DX[k] === vedle.x && s.y + DY[k] === vedle.y);
      return [k === s.smer ? 'utok' : ((k - s.smer + 4) % 4 === 3 ? 'otocL' : 'otocP')];
    }
    // střelec nebo léčitel na dohled: jít po něm (jinak by bot stál pod palbou, nebo by šaman léčil donekonečna)
    if (!SLABY) {
      let cil = null, cd = 7;
      for (const m of s.potvory) {
        const d = L.BESTIAR[m.druh];
        if ((!d.strelec && !d.leci) || d.boss || m.stav === 'spi') continue;
        const dd = Math.abs(m.x - s.x) + Math.abs(m.y - s.y);
        if (dd < cd && L.vidi(s, s.x, s.y, m.x, m.y)) { cd = dd; cil = m; }
      }
      if (cil) { const a = krokK(s, cestaK(s, cil.x, cil.y)); if (a) return [a]; }
    }
    // světlo: doplnit pochodeň, případně sundat louč ze zdi vedle sebe
    if (h.pochoden < 150) {
      const poch = b.find(q => q.typ === 'pochoden');
      if (poch) { stat.pochodni = (stat.pochodni || 0) + 1; return ['pouzij', poch.id]; }
      for (let k = 0; k < 4; k++) {
        const x = s.x + DX[k], y = s.y + DY[k];
        if (L.dlazdice(s, x, y) === T.SKALA && L.jeLouc(s, x, y, (k + 2) % 4)) {
          return [k === s.smer ? 'ohmatat' : ((k - s.smer + 4) % 4 === 3 ? 'otocL' : 'otocP')];
        }
      }
    }
    const jidlo = b.find(p => p.typ === 'jidlo');
    if (h.sytost < 25 && jidlo) { stat.snedeno++; return ['pouzij', jidlo.id]; }
    // lepší výbava (sloty s prokletou věcí přeskočit – nejde ji sundat)
    for (const p of b) {
      const slot = L.slotPro(p);
      if (!slot) continue;
      if (slot === 'prsten' ? (h.vybava.prsten1 || {}).prokleti && (h.vybava.prsten2 || {}).prokleti : (h.vybava[slot] || {}).prokleti) continue;
      if (p.prokleti && p.odhaleno) continue;
      // u prstenů se srovnává jen s tím, který jde vyměnit (prokletý ne)
      const vymenitelne = ['prsten1', 'prsten2'].map(k => h.vybava[k]).filter(q => !q || !q.prokleti);
      const ted = slot === 'prsten' ? (vymenitelne.some(q => !q) ? 0 : Math.min(...vymenitelne.map(L.skorePredmetu))) : L.skorePredmetu(h.vybava[slot]);
      const luk = L.ZAKLADY[p.zaklad].typ === 'zbran' && L.vlastnostiPredmetu(p).dosah;
      if (luk) continue;                                    // bot lukem nestřílí
      if (L.skorePredmetu(p) > ted + 0.5) { stat.nasazeno++; return ['nasad', p.id]; }
    }
    // jídla nosí nejvýš 4 (jako hráč) – jinak ucpe batoh a na lektvary nezbude místo
    const jidla = b.filter(p => p.typ === 'jidlo');
    if (CHYTRY && jidla.length > 4 && b.length >= L.kapacita(s) - 1) return ['zahod', jidla.sort((x, y) => L.ZAKLADY[x.zaklad].syti - L.ZAKLADY[y.zaklad].syti)[0].id];
    if (b.length >= L.kapacita(s)) {
      const smeti = b.filter(p => L.slotPro(p) || p.typ === 'sipy').sort((x, y) => L.skorePredmetu(x) - L.skorePredmetu(y))[0];
      if (smeti) return ['zahod', smeti.id];
    }
    if (!honi && h.hp >= o.maxHp * 0.8 && !SLABY) {
      const nezname = b.find(p => p.typ === 'lektvar' && !s.zname.includes(p.lektvar));
      if (nezname) return ['pouzij', nezname.id];
    }
    if (h.hp < o.maxHp * 0.5 && !honi && h.sytost > 15) { stat.odpocinek++; return ['cekej']; }
    // blízká truhla
    const p = s.mapaPatra;
    for (const t of SLABY ? [] : s.truhly) {
      if (t.otevrena) continue;
      if (Math.abs(t.x - s.x) + Math.abs(t.y - s.y) === 1) {
        const k = [0, 1, 2, 3].find(k => s.x + DX[k] === t.x && s.y + DY[k] === t.y);
        return [k === s.smer ? 'vpred' : ((k - s.smer + 4) % 4 === 3 ? 'otocL' : 'otocP')];
      }
      // blízkost podle délky cesty (vzdušná vzdálenost způsobovala přeskakování mezi cíli)
      const dist = cestaK(s, t.x, t.y), tady = dist[s.y * p.w + s.x];
      if (tady < 0 || tady > 16) continue;
      const a = krokK(s, dist);
      if (a) return [a];
    }
    // blízké věci na zemi (jídlo ze skladiště, knihy…)
    if (b.length < L.kapacita(s) - 1 && !SLABY) for (const z of s.zeme) {
      if ((!z.predmety.length && !z.zlato) || (z.x === s.x && z.y === s.y)) continue;   // co pod sebou nesebral, se nevejde
      const dist = cestaK(s, z.x, z.y), tady = dist[s.y * p.w + s.x];
      if (tady < 0 || tady > 10) continue;
      const a = krokK(s, dist);
      if (a) return [a];
    }
    const kniha = b.find(q => q.typ === 'kniha');
    if (kniha && !honi) return ['pouzij', kniha.id];
    // obchod: nakoupit léčivé lektvary, sejmout kletbu (jednou za patro)
    if (s.obchod && s.botObchod !== s.patro && !SLABY && s.zlato >= 30) {
      if (L.uObchodnika(s)) {
        s.botObchod = s.patro;
        if (L.SLOTY.some(k => h.vybava[k] && h.vybava[k].prokleti) && s.zlato >= L.cenaOdkleti(s)) akce('odklet');
        // prodat výbavu, která není lepší než ta nasazená (jako by to udělal hráč)
        if (CHYTRY) for (const q of h.batoh.filter(p => p.typ === 'jidlo').slice(4)) akce('prodej', q.id);
        if (CHYTRY) for (const q of h.batoh.slice()) {
          const sl = L.slotPro(q);
          if (!sl || sl === 'luk') continue;
          const ted = sl === 'prsten' ? Math.min(L.skorePredmetu(h.vybava.prsten1), L.skorePredmetu(h.vybava.prsten2)) : L.skorePredmetu(h.vybava[sl]);
          if (L.skorePredmetu(q) <= ted) akce('prodej', q.id);
        }
        for (const z of s.obchod.zbozi.slice()) {
          if (z.typ === 'lektvar' && z.lektvar === 'leceni' && s.zlato >= L.cenaNakupu(s, z)) { akce('kup', z.id); stat.nakupu++; }
        }
        // větší batoh, když zbude rezerva
        const cb = L.cenaBatohu(s);
        if (cb && CHYTRY && !volby.bezBatohu && s.zlato >= cb + 100) { akce('batoh'); stat.batohu = (stat.batohu || 0) + 1; }
        return ['cekej'];
      }
      const dist = cestaK(s, s.obchod.x, s.obchod.y), tady = dist[s.y * p.w + s.x];
      if (tady > 0 && tady < 40) { const a = krokK(s, dist); if (a) return [a]; }
    }
    // kovárna: ukovat zbraň a zbroj, když na to je ruda nebo zlato s rezervou (jednou za patro)
    if (CHYTRY && s.kovar && s.botKovar !== s.patro) {
      const kovat = ['zbran', 'brneni', 'stit', 'helma', 'boty'].map(k => h.vybava[k]).filter(L.kovatelny);
      const lzeZaplatit = q => L.rudyVBatohu(s) >= L.rudyNaKovani(q) || s.zlato >= L.cenaKovani(s, q) + 150;
      if (kovat.some(lzeZaplatit)) {
        if (L.uKovare(s)) {
          s.botKovar = s.patro;
          for (const q of kovat) {
            while (L.kovatelny(q) && lzeZaplatit(q)) {
              const pred = q.kovani || 0;
              akce('kovat', { id: q.id, platba: L.rudyVBatohu(s) >= L.rudyNaKovani(q) ? 'ruda' : 'zlato' });
              if ((q.kovani || 0) === pred) break;
              stat.kovani = (stat.kovani || 0) + 1;
            }
          }
          return ['cekej'];
        }
        const dist = cestaK(s, s.kovar.x, s.kovar.y), tady = dist[s.y * p.w + s.x];
        if (tady > 0 && tady < 40) { const a = krokK(s, dist); if (a) return [a]; }
      }
    }
    // boss hlídá schody – nejdřív on
    const boss = s.potvory.find(m => L.BESTIAR[m.druh].boss);
    if (boss) { const a = krokK(s, cestaK(s, boss.x, boss.y)); if (a) return [a]; }
    const a = krokK(s, cestaK(s, p.dolu.x, p.dolu.y)) || krokK(s, cestaK(s, p.dolu.x, p.dolu.y, true));   // když jinudy nevede cesta, i přes teleport
    return [a || 'cekej'];
  }
    return { rozhodni, cestaK, krokK };
  }
  const API = { vytvor };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.PodzemiBot = API;
})(typeof self !== 'undefined' ? self : this);
