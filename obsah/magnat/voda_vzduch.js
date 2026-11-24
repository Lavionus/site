/* Dopravní magnát – lodě a letadla (bez DOM).
   Přístav (část stanice 'lod') a loděnice (depo 'lod') stojí na pobřežní souši; loď kotví na vodním poli před nimi
   (part.voda / g.voda). Lodě plují po moři a jezerech i úhlopříčně (diagonála jen mezi dvěma vodními poli),
   navzájem se neblokují. Letiště (část 'let', 3 × 3 pole) je zároveň hangár (v.letiste = id stanice);
   letadlo letí přímou čarou nad krajinou, rychlost × 0,25 jako ve žánru, výška jen pro kreslení.
   Nakládání, platby, spolehlivost a servis sdílí s ostatními vozidly (MAG.hra). */
(function (MAG) {
  'use strict';
  const D = MAG.data, M = MAG.mapa, C = MAG.cesty, H = MAG.hra, T = D.T, S4 = M.SOUSEDE4;
  const DT = D.DEN_TICKU;
  const SOUSEDE8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  const jeVoda = (m, i) => m.typ[i] === T.VODA && !m.most[i];
  /* Splavná řeka: rovné pole řeky (i pod mostem) nebo svažité se zdymadlem. Po řece se pluje jen rovně (4 směry). */
  const plavne = (m, i) => jeVoda(m, i) || (!!m.reka[i] && (!!m.zdym[i] || M.jeRovne(m, i % m.W, (i / m.W) | 0)));
  const vodaKotviste = (m, i) => jeVoda(m, i) || (!!m.reka[i] && !m.most[i] && M.jeRovne(m, i % m.W, (i / m.W) | 0));
  const LET_ZPOMALENI = 0.25;

  // --- stavby ----------------------------------------------------------------------------
  // pobřežní pole: volná souš (bez řeky), soused ve směru d je voda; vrací {d, voda} nebo null
  function pobrezi(m, x, y, chteny) {
    if (!M.uvnitr(m, x, y)) return null;
    const i = y * m.W + x;
    if (!M.volnaZeme(m, x, y) || m.reka[i]) return null;
    const zkus = d => { const j = C.soused(m, i, d); return j >= 0 && vodaKotviste(m, j) ? { d, voda: j } : null; };
    if (chteny !== undefined && chteny >= 0 && zkus(chteny)) return zkus(chteny);
    for (let d = 0; d < 4; d++) { const r = zkus(d); if (r) return r; }
    return null;
  }
  function pripojStanici(h, pole, druhNazvu) {
    const m = h.m;
    for (const [x, y] of pole) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!M.uvnitr(m, x + dx, y + dy)) continue;
      const s = m.stan[(y + dy) * m.W + x + dx];
      if (s) return h.stanice[s - 1];
    }
    const n = H.nazevStanice(h, pole[0][0], pole[0][1]);
    const st = { id: h.stanice.length, jmeno: n.jmeno + (druhNazvu || ''), mesto: n.mesto, x: pole[0][0], y: pole[0][1], casti: [], naklady: {}, prijima: {}, zalozeno: h.den };
    h.stanice.push(st);
    return st;
  }
  function postavPristav(h, x, y, jenCena, chteny) {
    const m = h.m, p = pobrezi(m, x, y, chteny);
    if (!p) return { ok: false, chyba: 'Přístav se staví na volné pobřeží (souš vedle moře, jezera nebo rovného úseku řeky)' };
    const obec = H.povoleniObce(h, x, y);
    if (!obec.ok) return obec;
    const cena = D.CENY.pristav + H.cenaPole(m, x, y);
    return H.vysledek(h, cena, jenCena, 'stavba', () => {
      const i = y * m.W + x, st = pripojStanici(h, [[x, y]]);
      H.vykacet(h, i);
      st.casti.push({ x, y, druh: 'lod', osa: 3, smer: p.d, voda: p.voda });
      m.stan[i] = st.id + 1; m.osa[i] = 3; m.smer[i] = p.d + 1; m.les[i] = 0;
      H.prepocitejPrijem(h, st);
      H.zmena(h, x - D.DOSAH_NADRAZI, y - D.DOSAH_NADRAZI, x + D.DOSAH_NADRAZI, y + D.DOSAH_NADRAZI);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }
  function postavLodenici(h, x, y, jenCena, chteny) {
    const m = h.m, p = pobrezi(m, x, y, chteny);
    if (!p) return { ok: false, chyba: 'Loděnice se staví na volné pobřeží (souš vedle moře, jezera nebo rovného úseku řeky)' };
    const cena = D.CENY.lodenice + H.cenaPole(m, x, y);
    return H.vysledek(h, cena, jenCena, 'stavba', () => {
      const i = y * m.W + x, g = { id: h.depa.length, x, y, smer: p.d, druh: 'lod', voda: p.voda };
      h.depa.push(g);
      H.vykacet(h, i);
      m.depo[i] = g.id + 1; m.smer[i] = p.d + 1; m.les[i] = 0;
      H.zmena(h, x, y, x, y);
    });
  }
  /* Letiště: malé 3 × 3, velké 4 × 4 (od 1955, proudová letadla na něm nehavarují), heliport 1 × 1 (od 1950, jen vrtulníky).
     Volná souš, terén se zarovná (chráněné rohy průmyslu jako u stavby podniku). */
  const TYPY_LETIST = { male: { n: 3, od: 0, cena: 1, nazev: 'Letiště' }, velke: { n: 4, od: 1955, cena: 2.4, nazev: 'Velké letiště' }, heli: { n: 1, od: 1950, cena: 0.3, nazev: 'Heliport' } };
  function postavLetiste(h, x, y, jenCena, typ = 'male') {
    const m = h.m, TL = TYPY_LETIST[typ] || TYPY_LETIST.male, n = TL.n;
    if (H.rok(h) < TL.od) return { ok: false, chyba: `${TL.nazev} jde stavět od roku ${TL.od}` };
    if (x < 1 || y < 1 || x + n >= m.W || y + n >= m.H) return { ok: false, chyba: `${TL.nazev} je moc blízko okraje mapy` };
    let cena = Math.round(D.CENY.letiste * TL.cena), soucet = 0, mn = 99, mx = 0;
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
      const qx = x + dx, qy = y + dy, i = qy * m.W + qx;
      if (!M.volnaZeme(m, qx, qy) || m.reka[i] || m.stan[i]) return { ok: false, chyba: `${TL.nazev} potřebuje ${n} × ${n} volná pole (překáží ${qx}, ${qy})` };
      cena += H.cenaPole(m, qx, qy);
    }
    for (let dy = 0; dy <= n; dy++) for (let dx = 0; dx <= n; dx++) { const v = m.v[(y + dy) * m.R + x + dx]; soucet += v; mn = Math.min(mn, v); mx = Math.max(mx, v); }
    if (mx - mn > 2) return { ok: false, chyba: 'Na letiště je terén moc kopcovitý' };
    const obec = H.povoleniObce(h, x + 1, y + 1);
    if (!obec.ok) return obec;
    return H.vysledek(h, cena, jenCena, 'stavba', () => {
      const vys = Math.max(1, Math.round(soucet / ((n + 1) * (n + 1)))), pevne = new Map(), chranene = new Set();
      for (let dy = 0; dy <= n; dy++) for (let dx = 0; dx <= n; dx++) pevne.set((y + dy) * m.R + x + dx, vys);
      for (const o of m.prumysl) if (!o.zrusen) for (let dy = 0; dy <= o.h; dy++) for (let dx = 0; dx <= o.w; dx++) chranene.add((o.y + dy) * m.R + o.x + dx);
      M.terraformuj(m, pevne, chranene);
      const pole = []; for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) pole.push([x + dx, y + dy]);
      const st = pripojStanici(h, pole), osa = typ === 'heli' ? 6 : 4;
      st.casti.push({ x, y, w: n, h: n, druh: 'let', osa, typLet: typ });
      for (const [qx, qy] of pole) { const i = qy * m.W + qx; H.vykacet(h, i); m.stan[i] = st.id + 1; m.osa[i] = osa; m.les[i] = 0; if (m.typ[i] === T.POLE) m.typ[i] = T.TRAVA; }
      H.prepocitejPrijem(h, st);
      H.zmena(h, x - D.DOSAH_NADRAZI - 1, y - D.DOSAH_NADRAZI - 1, x + n + D.DOSAH_NADRAZI, y + n + D.DOSAH_NADRAZI);
    });
  }
  const vrtulnik = v => !!(v && D.VOZIDLA_PODLE_ID[v.typ] && D.VOZIDLA_PODLE_ID[v.typ].vrtulnik);
  // část letiště stanice, kde smí vozidlo v přistát (bez v: jakákoli); letadlo ne na heliport, velké přednostně na velké
  const letisteStanice = (st, v) => {
    if (!st) return undefined;
    const ok = st.casti.filter(c => c.druh === 'let' && (!v || vrtulnik(v) || c.typLet !== 'heli'));
    return ok.find(c => c.typLet === 'velke') || ok[0];
  };

  // --- nákup a spuštění --------------------------------------------------------------------------
  function kup(h, depoId, typId, naklad, jenCena) {
    const t = D.VOZIDLA_PODLE_ID[typId], r = H.rok(h);
    if (r < t.od || r > t.do) return { ok: false, chyba: 'Tento model se už (nebo ještě) nevyrábí' };
    if (t.druh === 'lod') {
      const g = h.depa[depoId];
      if (!g || g.druh !== 'lod') return { ok: false, chyba: 'Loď jde koupit jen v loděnici' };
      if (naklad && !t.naklady.includes(naklad)) return { ok: false, chyba: 'Loď tento náklad nevozí' };
      return H.vysledek(h, t.cena, jenCena, 'vozidla', () => {
        const cislo = h.cislo.lod = (h.cislo.lod || 0) + 1;
        h.vozidla.push(novy(h, t, `Loď ${cislo}`, { depo: g.id, oddily: [{ typ: naklad || t.naklady[0], kap: t.kapacita, n: 0, od: -1, dni: 0 }] }));
      });
    }
    const st = h.stanice[depoId];
    if (!letisteStanice(st)) return { ok: false, chyba: 'Letadlo jde koupit jen na letišti' };
    if (!letisteStanice(st, { typ: t.id })) return { ok: false, chyba: 'Na heliportu jde koupit jen vrtulník' };
    return H.vysledek(h, t.cena, jenCena, 'vozidla', () => {
      const cislo = h.cislo.let = (h.cislo.let || 0) + 1;
      h.vozidla.push(novy(h, t, `${t.vrtulnik ? 'Vrtulník' : 'Letadlo'} ${cislo}`, { letiste: st.id, oddily: [
        { typ: 'lide', kap: t.kapacita, n: 0, od: -1, dni: 0 }, { typ: 'posta', kap: t.kapacitaPosta, n: 0, od: -1, dni: 0 }] }));
    });
  }
  function novy(h, t, jmeno, dalsi) {
    return { id: h.vozidla.length, typ: t.id, druh: t.druh, jmeno, stav: 'depo', bezi: false, cesta: null, ci: 0, t: 0, d: 1, k: 0,
      rozkazy: [], ri: 0, cil: null, cekani: 0, otocka: 0, zisk: { letos: 0, loni: 0 }, stari: 0, koupeno: h.den, cena: t.cena, ztracen: 0, ...dalsi };
  }
  function stredLetiste(st, v) { const c = letisteStanice(st, v); return c ? { x: c.x + (c.w || 3) / 2, y: c.y + (c.h || 3) / 2 } : { x: st.x + 0.5, y: st.y + 0.5 }; }
  function spust(h, v) {
    v.stav = 'jede'; v.cil = null; v.doGaraze = false;
    if (v.druh === 'lod') { const g = h.depa[v.depo]; v.cesta = [g.voda]; v.ci = 0; v.t = 0; }
    else { const p = stredLetiste(h.stanice[v.letiste], v); v.poz = { x: p.x, y: p.y, vyska: 0 }; v.start = { ...p }; }
  }

  // --- lodě ---------------------------------------------------------------------------------------
  function cestaPoVode(m, start, cile) {
    return C.astar(m, start, cile, i => {
      const x = i % m.W, y = (i / m.W) | 0, out = [];
      for (const [dx, dy] of SOUSEDE8) {
        const nx = x + dx, ny = y + dy;
        if (!M.uvnitr(m, nx, ny)) continue;
        const j = ny * m.W + nx;
        if (!plavne(m, j) && !cile.has(j)) continue;
        if (dx && dy && !(jeVoda(m, i) && jeVoda(m, j) && jeVoda(m, y * m.W + nx) && jeVoda(m, ny * m.W + x))) continue;   // úhlopříčně jen po otevřené vodě
        out.push([j, (dx && dy ? 1.414 : 1) + (m.zdym[j] ? 2 : 0)]);
      }
      return out;
    }, 120000);
  }
  function cileLodi(h, v) {
    const cile = new Set();
    if (v.doGaraze || v.doServisu) {
      for (const g of h.depa) if (g && g.druh === 'lod') cile.add(g.voda);
      return { cile, cil: { garaz: true, servis: !v.doGaraze } };
    }
    if (!v.rozkazy.length) return null;
    v.ri %= v.rozkazy.length;
    const r = v.rozkazy[v.ri], st = h.stanice[r.st];
    if (!st) { v.rozkazy.splice(v.ri, 1); return null; }
    for (const c of st.casti) if (c.druh === 'lod' || c.druh === 'boje') cile.add(c.voda);
    return { cile, cil: { st: r.st, r: v.ri } };
  }
  function naplanujLod(h, v) {
    const c = cileLodi(h, v);
    if (!c || !c.cile.size) return false;
    const p = cestaPoVode(h.m, v.cesta[v.ci], c.cile);
    if (!p && v.doServisu) { v.doServisu = false; v.servis -= 30; return naplanujLod(h, v); }
    if (!p) return false;
    v.cesta = p; v.ci = 0; v.t = 0; v.cil = c.cil;
    return true;
  }
  function prijezd(h, v) {
    if (v.cil.garaz) {
      if (v.cil.servis) { H.servis(h, v); v.doServisu = false; v.cil = null; v.odjezd = true; return; }
      if (v.druh === 'lod') { const g = h.depa.find(g => g && g.druh === 'lod' && g.voda === v.cesta[v.ci]); if (g) v.depo = g.id; }
      v.stav = 'depo'; v.bezi = false; v.doGaraze = false; v.cil = null;
      H.vGarazi(h, v, `${v.jmeno} čeká v ${v.druh === 'lod' ? 'loděnici' : 'hangáru'}`);
      return;
    }
    v.stav = 'naklada'; v.cekani = 0; v.vylozeno = false; v.prijezdy = (v.prijezdy || 0) + 1;
  }
  function krokLodi(h, v) {
    const m = h.m;
    if (!v.cil || v.ci >= v.cesta.length - 1) {
      if (v.cil && v.ci >= v.cesta.length - 1) {
        const st = v.cil.st !== undefined && h.stanice[v.cil.st];
        if (st && !st.casti.some(c => c.druh === 'lod')) { v.ri = (v.ri + 1) % v.rozkazy.length; v.cil = null; return; }   // bóje: jen proplout
        prijezd(h, v); return;
      }
      if (!naplanujLod(h, v)) {
        v.ztracen = DT * 3;
        if (!v.hlasenoZtraceni) { v.hlasenoZtraceni = true; h.zpravy.push({ den: h.den, text: `${v.jmeno} nemůže najít cestu po vodě`, vozidlo: v.id }); }
        return;
      }
      v.hlasenoZtraceni = false;
      if (v.cesta.length === 1) { prijezd(h, v); return; }
    }
    const a = v.cesta[v.ci], b = v.cesta[v.ci + 1];
    const dx = b % m.W - a % m.W, dy = ((b / m.W) | 0) - ((a / m.W) | 0), delka = dx && dy ? 1.414 : 1;
    v.k = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
    const zdym = m.zdym[a] || m.zdym[b] ? 0.3 : 1;   // zdymadlem pomalu (napouštění komory)
    v.t += H.kmhNaPole(D.VOZIDLA_PODLE_ID[v.typ].rychlost) * (v.porucha > 0 ? 0.3 : 1) * zdym / delka;
    if (v.porucha > 0) v.porucha--;
    if (v.t >= 1) { v.t = 0; v.ci++; }
  }

  // --- bóje a zdymadla ---------------------------------------------------------------------------------
  // bóje: vlastní „stanice“ na vodě (moře, jezero, rovná řeka) – průjezdní bod do rozkazů lodí, nic se nenakládá
  function postavBoji(h, x, y, jenCena) {
    const m = h.m;
    if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
    const i = y * m.W + x;
    if (!vodaKotviste(m, i) || m.stan[i] || m.depo[i]) return { ok: false, chyba: 'Bóje se kotví na volné vodě' };
    return H.vysledek(h, D.CENY.boje, jenCena, 'stavba', () => {
      const n = H.nazevStanice(h, x, y);
      const cislo = h.stanice.filter(s => s && s.casti.some(c => c.druh === 'boje')).length + 1;
      const st = { id: h.stanice.length, jmeno: `Bóje ${cislo}`, mesto: n.mesto, x, y, casti: [{ x, y, druh: 'boje', osa: 5, voda: i }], naklady: {}, prijima: {}, zalozeno: h.den, boje: true };
      h.stanice.push(st);
      m.stan[i] = st.id + 1; m.osa[i] = 5;
      H.zmena(h, x - 1, y - 1, x + 1, y + 1);
    });
  }
  // zdymadlo: svažité pole řeky na rovném úseku (řeka/voda před i za v jedné ose), bez mostu
  function postavZdymadlo(h, x, y, jenCena) {
    const m = h.m;
    if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
    const i = y * m.W + x;
    if (!m.reka[i]) return { ok: false, chyba: 'Zdymadlo se staví na řeku' };
    if (m.zdym[i]) return { ok: false, cena: 0, chyba: 'Zdymadlo tu už je' };
    if (m.most[i] || m.stan[i]) return { ok: false, chyba: 'Na mostě ani u zastávky zdymadlo nejde' };
    if (M.jeRovne(m, x, y)) return { ok: false, chyba: 'Tady je řeka rovná – zdymadlo patří na svah' };
    const voda = d => { const j = C.soused(m, i, d); return j >= 0 && (m.reka[j] || m.typ[j] === T.VODA); };
    const osa = voda(1) && voda(3) ? 1 : voda(0) && voda(2) ? 2 : 0;
    if (!osa) return { ok: false, chyba: 'Zdymadlo jen na rovném úseku řeky (ne v zákrutu)' };
    return H.vysledek(h, D.CENY.zdymadlo, jenCena, 'stavba', () => {
      m.zdym[i] = osa;
      H.zmena(h, x - 1, y - 1, x + 1, y + 1);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }

  // --- letadla ------------------------------------------------------------------------------------
  function cilLetadla(h, v) {
    if (v.doGaraze || v.doServisu) {
      // nejbližší vlastní letiště
      let nej = null, nd = Infinity;
      for (const st of h.stanice) if (letisteStanice(st, v)) { const p = stredLetiste(st, v), d = Math.hypot(p.x - v.poz.x, p.y - v.poz.y); if (d < nd) { nd = d; nej = st; } }
      return nej && { st: nej.id, garaz: true, servis: !v.doGaraze };
    }
    if (!v.rozkazy.length) return null;
    v.ri %= v.rozkazy.length;
    const r = v.rozkazy[v.ri], st = h.stanice[r.st];
    if (!st || !letisteStanice(st, v)) { v.rozkazy.splice(v.ri, 1); return null; }
    return { st: r.st, r: v.ri };
  }
  function krokLetadla(h, v) {
    if (!v.cil) {
      v.cil = cilLetadla(h, v);
      if (!v.cil) { v.ztracen = DT; return; }
      v.start = { x: v.poz.x, y: v.poz.y };
    }
    if (!h.stanice[v.cil.st] || !letisteStanice(h.stanice[v.cil.st], v)) { v.cil = null; return; }
    const cil = stredLetiste(h.stanice[v.cil.st], v);
    const dx = cil.x - v.poz.x, dy = cil.y - v.poz.y, d = Math.hypot(dx, dy);
    const krok = H.kmhNaPole(D.VOZIDLA_PODLE_ID[v.typ].rychlost) * LET_ZPOMALENI * (v.porucha > 0 ? 0.5 : 1);
    if (v.porucha > 0) v.porucha--;
    if (d <= krok) {
      v.poz.x = cil.x; v.poz.y = cil.y; v.poz.vyska = 0;
      if (v.cil.garaz) {
        if (v.cil.servis) { H.servis(h, v); v.doServisu = false; v.cil = null; return; }
        v.letiste = v.cil.st; v.stav = 'depo'; v.bezi = false; v.doGaraze = false; v.cil = null;
        H.vGarazi(h, v, `${v.jmeno} čeká v hangáru`);
        return;
      }
      // havárie (volitelné): proudové letadlo na malém letišti
      const st = h.stanice[v.cil.st], c = letisteStanice(st, v);
      if (h.volby && h.volby.havarie && D.VOZIDLA_PODLE_ID[v.typ].velke && c.typLet !== 'velke' && h.nah.f() < 1 / 30) {
        H.havarie(h, v, `💥 ${v.jmeno} havarovalo při přistání na malém letišti ${st.jmeno} – proudová letadla patří na velké letiště`);
        return;
      }
      prijezd(h, v);
      return;
    }
    v.poz.x += dx / d * krok; v.poz.y += dy / d * krok;
    v.k = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
    // výška: vzlet a přistání na 1,5 pole, mezi tím letová hladina
    const odStartu = Math.hypot(v.poz.x - v.start.x, v.poz.y - v.start.y);
    const stoupani = vrtulnik(v) ? 0.4 : 1.5;   // vrtulník svisle
    v.poz.vyska = Math.min(1, odStartu / stoupani, d / stoupani);
  }

  function krok(h) {
    for (const v of h.vozidla) {
      if (!H.aktivni(v) || (v.druh !== 'lod' && v.druh !== 'let') || v.stav === 'depo' || !v.bezi) continue;
      if (v.stav === 'naklada') { H.nakladani(h, v); if (v.stav === 'jede' && v.druh === 'let') v.start = { x: v.poz.x, y: v.poz.y }; continue; }
      if (v.ztracen > 0) { v.ztracen--; if (v.ztracen > 0) continue; }
      if (v.druh === 'lod') krokLodi(h, v); else krokLetadla(h, v);
    }
  }

  // poloha pro kreslení a výběr: {x, y, k (snímek 0–7), vyska 0–1}
  function poloha(h, v) {
    const m = h.m;
    if (v.stav === 'depo') return null;
    if (v.druh === 'let') return v.poz ? { x: v.poz.x, y: v.poz.y, k: v.k || 0, vyska: v.poz.vyska || 0 } : null;
    if (!v.cesta) return null;
    const a = v.cesta[v.ci], b = v.cesta[v.ci + 1];
    let x = a % m.W + 0.5, y = ((a / m.W) | 0) + 0.5;
    if (b !== undefined) { x += (b % m.W - a % m.W) * v.t; y += (((b / m.W) | 0) - ((a / m.W) | 0)) * v.t; }
    return { x, y, k: v.k || 0, vyska: 0 };
  }
  // má vozidlo kde na servis?
  function maServis(h, v) {
    if (v.druh === 'lod') return h.depa.some(g => g && g.druh === 'lod');
    if (v.druh === 'let') return h.stanice.some(st => letisteStanice(st, v));
    return false;
  }

  MAG.vodaVzduch = { postavBoji, postavZdymadlo, plavne, vodaKotviste, pobrezi, postavPristav, postavLodenici, postavLetiste, letisteStanice, kup, spust, krok, poloha, maServis,
    cestaPoVode, stredLetiste, LET_ZPOMALENI, TYPY_LETIST, vrtulnik };
})(globalThis.MAG = globalThis.MAG || {});
