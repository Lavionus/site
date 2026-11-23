/* Dopravní magnát – železnice: koleje, mosty, nádraží, železniční depa, vlaky (bez DOM).
   Kolej = bity spojení pole do stran (1 << d); oblouk vznikne, když se na poli potkají dva sousední směry.
   Vlak jede po středech polí (jako silniční vozidla), délka = lokomotiva 0,7 pole + vagon 0,5 pole.
   Bezpečnost bez návěstidel (ta přijdou v etapě 4): vlak si zabírá pole svého těla a brzdnou dráhu před sebou;
   cizí obsazené pole = zastavit před ním. Dva vlaky proti sobě na jedné koleji se po 3 dnech čekání otočí. */
(function (MAG) {
  'use strict';
  const D = MAG.data, M = MAG.mapa, C = MAG.cesty, H = MAG.hra, T = D.T, S4 = M.SOUSEDE4;
  const BIT = d => 1 << d, OPAK = d => (d + 2) & 3;
  const DT = D.DEN_TICKU;
  const BRZDA = 2.5;                // km/h za tick
  const brzdnaDraha = v => v * v / (2500 * BRZDA);   // v km/h → pole

  // --- mosty (společné pro silnici i kolej) ------------------------------------------
  const jeVodaNeboReka = (m, i) => m.typ[i] === T.VODA || m.reka[i];
  /* Na rovné čáře `pole` ([[x,y]…]) najde úseky přes vodu/řeku. Most smí mít nejvýš CENY.MAX_MOST polí
     a musí na obou koncích navazovat na souš v téže čáře. Vrací {chyba} nebo {most: Map(index → výška mostovky)}. */
  function mostyNaCare(m, pole, osa) {
    const most = new Map();
    let k = 0;
    while (k < pole.length) {
      const i = pole[k][1] * m.W + pole[k][0];
      if (!jeVodaNeboReka(m, i) || (m.most[i] && m.most[i] === osa)) { k++; continue; }
      if (m.most[i]) return { chyba: 'Tady už most vede jiným směrem' };
      let j = k;
      while (j < pole.length && jeVodaNeboReka(m, pole[j][1] * m.W + pole[j][0])) j++;
      if (k === 0 || j >= pole.length) return { chyba: 'Most musí na obou stranách končit na souši' };
      if (j - k > D.CENY.MAX_MOST) return { chyba: `Most může mít nejvýš ${D.CENY.MAX_MOST} polí` };
      const [ax, ay] = pole[k - 1], [bx, by] = pole[j];
      const vys = Math.max(1, M.maxR(m, ax, ay), M.maxR(m, bx, by));
      for (let q = k; q < j; q++) {
        const t = pole[q][1] * m.W + pole[q][0];
        if (m.cesta[t] || m.kolej[t]) return { chyba: 'Na mostě už něco je' };
        most.set(t, vys);
      }
      k = j;
    }
    return { most };
  }

  // --- stavba koleje ---------------------------------------------------------------------
  function postavKolej(h, x0, y0, x1, y1, jenCena) {
    const m = h.m, pole = H.cara(x0, y0, x1, y1);
    if (pole.length < 2) return { ok: false, chyba: 'Táhni kolej aspoň přes dvě pole' };
    const osa = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 1 : 2;
    const mosty = mostyNaCare(m, pole, osa);
    if (mosty.chyba) return { ok: false, chyba: mosty.chyba };
    let cena = 0;
    const bity = [];
    for (let k = 0; k < pole.length; k++) {
      const [x, y] = pole[k];
      if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
      const i = y * m.W + x;
      let b = 0;
      if (k > 0) b |= BIT(C.smerMezi(m, i, pole[k - 1][1] * m.W + pole[k - 1][0]));
      if (k < pole.length - 1) b |= BIT(C.smerMezi(m, i, pole[k + 1][1] * m.W + pole[k + 1][0]));
      if (m.dum[i] || m.prum[i]) return { ok: false, chyba: `Pole ${x}, ${y} je zastavěné` };
      if (m.depo[i] && (!m.kolej[i] || (b & ~m.kolej[i]))) return { ok: false, chyba: `Na poli ${x}, ${y} stojí depo` };
      if (m.stan[i]) {
        const podelX = m.osa[i] === 1, povolene = podelX ? (BIT(1) | BIT(3)) : (BIT(0) | BIT(2));
        if (!m.kolej[i] || (b & ~povolene)) return { ok: false, chyba: `Přes zastávku nebo napříč nástupištěm kolej nevede (${x}, ${y})` };
      }
      if (m.cesta[i] && !m.kolej[i]) {
        // přejezd jen přes rovnou silnici napříč
        const podelX = (b & (BIT(1) | BIT(3))) !== 0;
        const silniceX = [1, 3].some(d => { const j = C.soused(m, i, d); return j >= 0 && m.cesta[j]; });
        const silniceY = [0, 2].some(d => { const j = C.soused(m, i, d); return j >= 0 && m.cesta[j]; });
        if (m.most[i] || (podelX ? silniceX : silniceY) || (silniceX && silniceY)) return { ok: false, chyba: `Přejezd jen přes rovnou silnici napříč (${x}, ${y})` };
        cena += 400;
      }
      const nove = b & ~m.kolej[i];
      if (!nove) continue;
      if (mosty.most.has(i)) cena += D.CENY.most;
      else if (!m.kolej[i]) cena += D.CENY.kolej + H.cenaPole(m, x, y);
      else cena += 60;   // jen přidání směru (výhybka, oblouk)
      bity.push([i, b]);
    }
    if (!bity.length) return { ok: false, cena: 0, chyba: 'Kolej tu už vede' };
    return H.vysledek(h, cena, jenCena, 'stavba', () => {
      for (const [i, b] of bity) {
        H.vykacet(h, i);
        m.kolej[i] |= b; m.les[i] = 0;
        if (m.typ[i] === T.POLE) m.typ[i] = T.TRAVA;
        if (mosty.most.has(i)) { m.most[i] = osa; m.mostV[i] = mosty.most.get(i); }
      }
      H.zmena(h, Math.min(x0, x1) - 1, Math.min(y0, y1) - 1, Math.max(x0, x1) + 1, Math.max(y0, y1) + 1);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }

  // --- nádraží ------------------------------------------------------------------------------
  function postavNadrazi(h, x0, y0, x1, y1, jenCena) {
    const m = h.m, pole = H.cara(x0, y0, x1, y1);
    let osa = pole.length > 1 ? (Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 1 : 2) : 0;
    if (!osa) {   // jedno pole: osa podle koleje, jinak podél x
      const i = y0 * m.W + x0, k = m.kolej[i];
      osa = (k & (BIT(0) | BIT(2))) && !(k & (BIT(1) | BIT(3))) ? 2 : 1;
    }
    if (pole.length > 8) return { ok: false, chyba: 'Nástupiště může mít nejvýš 8 polí' };
    const povolene = osa === 1 ? (BIT(1) | BIT(3)) : (BIT(0) | BIT(2));
    let cena = 0;
    for (const [x, y] of pole) {
      if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
      const i = y * m.W + x;
      if (m.stan[i]) return { ok: false, chyba: 'Tady už stanice je' };
      if (m.typ[i] === T.VODA || m.reka[i] || m.most[i]) return { ok: false, chyba: 'Nádraží nejde na vodu ani na most' };
      if (m.dum[i] || m.prum[i] || m.depo[i] || m.cesta[i]) return { ok: false, chyba: `Pole ${x}, ${y} je zastavěné` };
      if (m.kolej[i] & ~povolene) return { ok: false, chyba: 'Nástupiště jen na rovné koleji' };
      if (h.vozidla.some(v => H.aktivni(v) && v.druh === 'vlak' && v.telo && v.telo.includes(i))) return { ok: false, chyba: 'Na koleji stojí vlak' };
      cena += D.CENY.nastupiste + (m.kolej[i] ? 0 : D.CENY.kolej + H.cenaPole(m, x, y));
    }
    const obec = H.povoleniObce(h, pole[0][0], pole[0][1]);
    if (!obec.ok) return obec;
    let st = null;
    for (const [x, y] of pole) for (let dy = -1; dy <= 1 && !st; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!M.uvnitr(m, x + dx, y + dy)) continue;
      const s = m.stan[(y + dy) * m.W + x + dx];
      if (s) { st = h.stanice[s - 1]; break; }
    }
    return H.vysledek(h, cena, jenCena, 'stavba', () => {
      if (!st) {
        const n = H.nazevStanice(h, pole[0][0], pole[0][1]);
        st = { id: h.stanice.length, jmeno: n.jmeno, mesto: n.mesto, x: pole[0][0], y: pole[0][1], casti: [], naklady: {}, prijima: {}, zalozeno: h.den };
        h.stanice.push(st);
      }
      for (const [x, y] of pole) {
        const i = y * m.W + x;
        H.vykacet(h, i);
        m.kolej[i] |= povolene; m.les[i] = 0;
        m.stan[i] = st.id + 1; m.osa[i] = osa;
        st.casti.push({ x, y, druh: 'vlak', osa });
      }
      H.prepocitejPrijem(h, st);
      const R = D.DOSAH_NADRAZI;
      H.zmena(h, Math.min(x0, x1) - R, Math.min(y0, y1) - R, Math.max(x0, x1) + R, Math.max(y0, y1) + R);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }

  // --- železniční depo ---------------------------------------------------------------------------
  function postavDepo(h, x, y, jenCena, chtenySmer) {
    const m = h.m;
    if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
    const i = y * m.W + x;
    if (m.typ[i] === T.VODA || m.reka[i] || m.cesta[i] || m.kolej[i] || m.dum[i] || m.prum[i] || m.depo[i]) return { ok: false, chyba: 'Depo potřebuje volné pole vedle koleje' };
    const zkus = d => {
      const j = C.soused(m, i, d);
      if (j < 0 || !m.kolej[j] || m.depo[j]) return false;
      if (m.stan[j]) return m.osa[j] === 1 ? d % 2 === 1 : d % 2 === 0;   // do nástupiště jen podél osy
      return true;
    };
    let smer = -1;
    if (chtenySmer !== undefined && chtenySmer >= 0 && zkus(chtenySmer)) smer = chtenySmer;
    else for (let d = 0; d < 4; d++) if (zkus(d)) { smer = d; break; }
    if (smer < 0) return { ok: false, chyba: 'Depo musí stát u koleje' };
    const cena = D.CENY.depo + H.cenaPole(m, x, y);
    return H.vysledek(h, cena, jenCena, 'stavba', () => {
      const g = { id: h.depa.length, x, y, smer, druh: 'kolej' };
      h.depa.push(g);
      const j = C.soused(m, i, smer);
      m.depo[i] = g.id + 1; m.smer[i] = smer + 1; m.kolej[i] = BIT(smer); m.les[i] = 0;
      m.kolej[j] |= BIT(OPAK(smer));
      H.zmena(h, x - 1, y - 1, x + 1, y + 1);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }

  // bourání kolejí (volá MAG.hra.zbor pro pole s kolejí): smaže bity a navazující bity sousedů
  function zborKolej(h, i) {
    const m = h.m;
    m.navest[i] = 0; m.navestJ[i] = 0;
    for (let d = 0; d < 4; d++) { const j = C.soused(m, i, d); if (j >= 0 && (m.kolej[i] & BIT(d))) { m.navest[j] &= m.kolej[j] & ~BIT(OPAK(d)); m.navestJ[j] &= m.navest[j]; } }
    for (let d = 0; d < 4; d++) {
      const j = C.soused(m, i, d);
      if (j >= 0 && (m.kolej[i] & BIT(d))) m.kolej[j] &= ~BIT(OPAK(d));
    }
    m.kolej[i] = 0;
    if (m.most[i] && !m.cesta[i]) { m.most[i] = 0; m.mostV[i] = 0; }
  }

  // --- návěstidla ----------------------------------------------------------------------------
  /* Klik na rovnou kolej přepíná: žádné → směr A → směr B → oba (→ žádné); jednosměrná: A → B → žádné.
     Směr A = +x / +y podle osy koleje. Cestové návěstidlo smí vlak minout zezadu, jednosměrné ne. */
  function prepniNavest(h, x, y, jednosmerne, jenCena) {
    const m = h.m;
    if (!M.uvnitr(m, x, y)) return { ok: false, chyba: 'Mimo mapu' };
    const i = y * m.W + x, k = m.kolej[i];
    const podelX = k === (BIT(1) | BIT(3)), podelY = k === (BIT(0) | BIT(2));
    if (!podelX && !podelY) return { ok: false, chyba: 'Návěstidlo jen na rovnou kolej (ne oblouk, výhybku ani konec)' };
    if (m.stan[i] || m.depo[i] || m.most[i]) return { ok: false, chyba: 'Návěstidlo ne na nádraží, depo ani most' };
    const A = podelX ? BIT(1) : BIT(2), B = podelX ? BIT(3) : BIT(0);
    const stav = [m.navest[i], m.navestJ[i]];
    const poradi = jednosmerne ? [[0, 0], [A, A], [B, B]] : [[0, 0], [A, 0], [B, 0], [A | B, 0]];
    let k0 = poradi.findIndex(p => p[0] === stav[0] && p[1] === stav[1]);
    const dalsi = poradi[(k0 + 1) % poradi.length];
    const novych = [0, 1, 2, 3].filter(d => (dalsi[0] & BIT(d)) && !(stav[0] & BIT(d))).length;
    const cena = novych * D.CENY.navest;
    return H.vysledek(h, cena, jenCena, 'stavba', () => {
      m.navest[i] = dalsi[0]; m.navestJ[i] = dalsi[1];
      H.zmena(h, x, y, x, y);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }
  const maNavest = (m, i, d) => (m.navest[i] & BIT(d)) !== 0;

  /* Povolení na návěstidle: vlak v stojí (nebo brzdí) před odjezdem z v.cesta[k] směrem d.
     Úsek = pole za návěstidlem až po další návěstidlo stejného směru (včetně) nebo konec cesty.
     Úsek musí být volný (žádné tělo, rezervace ani dnešní brzdná dráha jiného vlaku); když není,
     hledá se objízdná cesta mimo obsazená pole (výhybna, jiná kolej nástupiště). */
  function usekZa(m, cesta, k) {
    const out = [];
    for (let q = k + 1; q < cesta.length; q++) {
      out.push(cesta[q]);
      if (q + 1 < cesta.length && maNavest(m, cesta[q], C.smerMezi(m, cesta[q], cesta[q + 1]))) break;
    }
    return out;
  }
  function ziskejPovoleni(h, v, k, obs) {
    const m = h.m;
    const volne = i => (h.rez[i] === undefined || h.rez[i] === v.id) && (obs.get(i) === undefined || obs.get(i) === v.id);
    let usek = usekZa(m, v.cesta, k);
    if (!usek.every(volne)) {
      // objízdná cesta: A* z pole návěstidla mimo obsazená pole
      const c = cileVlaku(h, v);
      if (!c || !c.cile.size) return false;
      const zakazane = new Set();
      for (const [i, id] of obs) if (id !== v.id) zakazane.add(i);
      for (const i in h.rez) if (h.rez[i] !== v.id) zakazane.add(+i);
      const dPrichod = k > 0 ? C.smerMezi(m, v.cesta[k - 1], v.cesta[k]) : v.d;
      const alt = astarKolej(m, v.cesta[k], dPrichod, c.cile, 40000, zakazane);
      if (!alt) return false;
      const nova = v.cesta.slice(0, k).concat(alt.cesta);
      if (c.stId >= 0) naKonecNastupiste(m, nova, alt.d, c.stId);
      const u2 = usekZa(m, nova, k);
      if (!u2.every(volne)) return false;
      v.cesta = nova; usek = u2;
      if (v.ci + 1 < v.cesta.length) v.d = C.smerMezi(m, v.cesta[v.ci], v.cesta[v.ci + 1]);
    }
    for (const i of usek) h.rez[i] = v.id;
    v.povoleni.push(v.cesta[k] * 4 + C.smerMezi(m, v.cesta[k], v.cesta[k + 1]));
    return true;
  }

  // uvolnit rezervace a povolení, které už vlak minul (nejsou v těle ani na cestě před ním)
  function uklidRezervaci(h, v) {
    const pred = new Set(v.telo);
    if (v.cesta) for (let k = v.ci; k < v.cesta.length; k++) pred.add(v.cesta[k]);
    for (const i in h.rez) if (h.rez[i] === v.id && !pred.has(+i)) delete h.rez[i];
    v.povoleni = (v.povoleni || []).filter(p => {
      if (!v.cesta) return false;
      for (let k = v.ci + (v.t > 0 ? 1 : 0); k < v.cesta.length - 1; k++) if (v.cesta[k] === p >> 2) return true;
      return false;
    });
  }

  // --- vlaky: nákup a vagony ------------------------------------------------------------------------
  function kupVlak(h, depoId, lokId, jenCena) {
    const g = h.depa[depoId], t = D.VOZIDLA_PODLE_ID[lokId];
    if (!g || g.druh !== 'kolej') return { ok: false, chyba: 'Lokomotivu jde koupit jen v železničním depu' };
    if (!t || t.druh !== 'vlak') return { ok: false, chyba: 'Neznámá lokomotiva' };
    const r = H.rok(h);
    if (r < t.od || r > t.do) return { ok: false, chyba: 'Tato lokomotiva se už (nebo ještě) nevyrábí' };
    return H.vysledek(h, t.cena, jenCena, 'vozidla', () => {
      const cislo = h.cislo.vlak = (h.cislo.vlak || 0) + 1;
      h.vozidla.push({
        id: h.vozidla.length, typ: t.id, druh: 'vlak', jmeno: `Vlak ${cislo}`, oddily: [], depo: g.id,
        stav: 'depo', bezi: false, cesta: null, ci: 0, t: 0, d: g.smer, rych: 0, telo: [],
        rozkazy: [], ri: 0, cil: null, cekani: 0, otocka: 0, cekaNaVolno: 0,
        zisk: { letos: 0, loni: 0 }, stari: 0, koupeno: h.den, cena: t.cena, ztracen: 0,
      });
    });
  }
  function pridejVagon(h, vId, vagonId, naklad, jenCena) {
    const v = h.vozidla[vId], w = D.VAGONY_PODLE_ID[vagonId];
    if (!H.aktivni(v) || v.druh !== 'vlak') return { ok: false, chyba: 'Vagony se přidávají jen k vlaku' };
    if (v.stav !== 'depo') return { ok: false, chyba: 'Vagony jde měnit jen v depu' };
    if (!w || H.rok(h) < w.od) return { ok: false, chyba: 'Tento vagon se ještě nevyrábí' };
    if (v.oddily.length >= 10) return { ok: false, chyba: 'Vlak může mít nejvýš 10 vagonů' };
    const typ = naklad || w.naklady[0];
    if (!w.naklady.includes(typ)) return { ok: false, chyba: 'Vagon tento náklad nevozí' };
    return H.vysledek(h, w.cena, jenCena, 'vozidla', () => {
      v.oddily.push({ typ, kap: w.kapacita, n: 0, od: -1, dni: 0, vagon: w.id });
      v.cena += w.cena;
    });
  }
  function odeberVagon(h, vId, k) {
    const v = h.vozidla[vId];
    if (!H.aktivni(v) || v.stav !== 'depo' || !v.oddily[k]) return { ok: false, chyba: 'Vagony jde měnit jen v depu' };
    const w = D.VAGONY_PODLE_ID[v.oddily[k].vagon];
    const vratka = Math.round(w.cena * 0.6);
    v.oddily.splice(k, 1); v.cena -= w.cena;
    H.zauctuj(h, 'vozidla', vratka);
    return { ok: true, cena: -vratka };
  }
  const delkaVlaku = v => 0.7 + 0.5 * v.oddily.length;
  function hmotnost(v) {
    let s = D.VOZIDLA_PODLE_ID[v.typ].hmotnost;
    for (const o of v.oddily) { const w = D.VAGONY_PODLE_ID[o.vagon]; s += w.hmotnost + o.n * w.naJednotku; }
    return s;
  }
  function maxRychlost(v) {
    let r = D.VOZIDLA_PODLE_ID[v.typ].rychlost;
    for (const o of v.oddily) r = Math.min(r, D.VAGONY_PODLE_ID[o.vagon].rychlost);
    return r;
  }

  // --- hledání cesty po kolejích: stav = (pole, směr jízdy) ---------------------------------------------
  // zakazane: Set polí, kam nesmí (obsazená / rezervovaná jiným vlakem)
  function astarKolej(m, startI, startD, cile, maxUzlu = 80000, zakazane = null) {
    const cx = [], cy = [];
    for (const c of cile) { cx.push(c % m.W); cy.push((c / m.W) | 0); }
    const heur = i => { const x = i % m.W, y = (i / m.W) | 0; let b = Infinity; for (let k = 0; k < cx.length; k++) b = Math.min(b, Math.abs(cx[k] - x) + Math.abs(cy[k] - y)); return b; };
    const k0 = startI * 4 + startD;
    const g = new Map([[k0, 0]]), odkud = new Map(), halda = C.Halda();
    halda.push(heur(startI), k0);
    let uzlu = 0;
    while (halda.size && uzlu++ < maxUzlu) {
      const k = halda.pop(), i = k >> 2, d = k & 3;
      if (cile.has(i) && k !== k0) {
        const cesta = [i]; let q = k;
        while (odkud.has(q)) { q = odkud.get(q); cesta.push(q >> 2); }
        return { cesta: cesta.reverse(), d, cena: g.get(k) };
      }
      const gi = g.get(k);
      for (let e = 0; e < 4; e++) {
        if (e === OPAK(d)) continue;
        const j = C.spojenoK(m, i, e);
        if (j < 0) continue;
        if (m.depo[j] && !cile.has(j)) continue;   // do cizího depa ne
        if (zakazane && zakazane.has(j)) continue;
        if (m.navestJ[j] & BIT(OPAK(e))) continue;   // proti jednosměrnému návěstidlu ne
        const c = gi + 1 + (e !== d ? 0.6 : 0) + (m.stan[j] && !cile.has(j) ? 0.4 : 0);
        const nk = j * 4 + e;
        if (c < (g.get(nk) ?? Infinity)) { g.set(nk, c); odkud.set(nk, k); halda.push(c + heur(j), nk); }
      }
    }
    return null;
  }

  // pole těla vlaku od hlavy dozadu (indexy do v.cesta)
  function teloIndexy(v) {
    const L = delkaVlaku(v), hlava = v.ci + v.t;
    const kmax = Math.min(v.cesta.length - 1, Math.floor(hlava + 0.5)), kmin = Math.max(0, Math.floor(hlava - L + 0.5));
    const out = [];
    for (let k = kmax; k >= kmin; k--) out.push(k);
    return out;
  }

  // prodloužit cíl na konec nástupiště ve směru jízdy
  function naKonecNastupiste(m, cesta, d, stId) {
    let i = cesta[cesta.length - 1];
    for (;;) {
      const j = C.spojenoK(m, i, d);
      if (j < 0 || m.stan[j] !== stId + 1) break;
      cesta.push(j); i = j;
    }
  }

  // cílová pole aktuálního rozkazu (nástupiště stanice) nebo depa
  function cileVlaku(h, v) {
    const m = h.m, cile = new Set();
    if (v.doGaraze) {
      for (const g of h.depa) if (g && g.druh === 'kolej') cile.add(g.y * m.W + g.x);
      return { cile, cil: { garaz: true }, stId: -1 };
    }
    if (!v.rozkazy.length) return null;
    v.ri %= v.rozkazy.length;
    const r = v.rozkazy[v.ri], st = h.stanice[r.st];
    if (!st) { v.rozkazy.splice(v.ri, 1); return null; }
    for (const c of st.casti) if (c.druh === 'vlak') cile.add(c.y * m.W + c.x);
    return { cile, cil: { st: r.st, r: v.ri }, stId: st.id };
  }

  function naplanujVlak(h, v, smiObratit) {
    const m = h.m;
    const c = cileVlaku(h, v);
    if (!c || !c.cile.size) return false;
    const { cile, cil, stId } = c;
    const hlava = v.cesta[v.ci];
    const vpred = astarKolej(m, hlava, v.d, cile);
    let vzad = null, telo = null;
    if (smiObratit) {
      telo = teloIndexy(v).map(k => v.cesta[k]);   // od hlavy k ocasu
      const ocas = telo[telo.length - 1];
      const dOcas = telo.length > 1 ? C.smerMezi(m, telo[telo.length - 2], ocas) : OPAK(v.d);
      vzad = astarKolej(m, ocas, dOcas, cile);
    }
    let volba = null;
    if (vpred && (!vzad || vpred.cena <= vzad.cena + 4)) volba = 'vpred';
    else if (vzad) volba = 'vzad';
    if (!volba) return false;
    const minule = Math.ceil(delkaVlaku(v)) + 2;
    if (volba === 'vpred') {
      const zpet = v.cesta.slice(Math.max(0, v.ci - minule), v.ci);
      v.cesta = zpet.concat(vpred.cesta); v.ci = zpet.length;
      if (stId >= 0) naKonecNastupiste(m, v.cesta, vpred.d, stId);
      if (v.cesta.length > v.ci + 1) v.d = C.smerMezi(m, v.cesta[v.ci], v.cesta[v.ci + 1]);
    } else {
      // obrátit: tělo (od hlavy k ocasu) se stane minulostí, jede se od ocasu
      v.cesta = telo.concat(vzad.cesta.slice(1)); v.ci = telo.length - 1; v.t = 0; v.rych = 0;
      if (stId >= 0) naKonecNastupiste(m, v.cesta, vzad.d, stId);
      v.d = v.cesta.length > v.ci + 1 ? C.smerMezi(m, v.cesta[v.ci], v.cesta[v.ci + 1]) : OPAK(v.d);
      v.otocka = 30;
    }
    v.cil = cil; v.sitVerze = h.sitVerze || 0;
    return true;
  }

  function spustVlak(h, v) {
    const g = h.depa[v.depo];
    v.stav = 'jede'; v.cesta = [g.y * h.m.W + g.x]; v.ci = 0; v.t = 0; v.d = g.smer; v.cil = null; v.doGaraze = false; v.rych = 0;
  }

  // výška středu pole (na mostě mostovka) – pro sklon
  const vyskaPole = (m, i) => m.most[i] ? m.mostV[i] : (() => { const x = i % m.W, y = (i / m.W) | 0, r = M.rohy(m, x, y); return (r[0] + r[1] + r[2] + r[3]) / 4; })();

  function krokVlaku(h) {
    const m = h.m;
    const vlaky = h.vozidla.filter(v => H.aktivni(v) && v.druh === 'vlak' && v.stav !== 'depo');
    if (!vlaky.length) return;
    // obsazenost: těla všech vlaků, pak rezervace brzdné dráhy v pořadí id
    const obs = new Map();
    for (const v of vlaky) { v.telo = teloIndexy(v).map(k => v.cesta[k]); for (const i of v.telo) if (!obs.has(i)) obs.set(i, v.id); }
    if (!h.rez) h.rez = {};
    for (const v of vlaky) {
      if (!v.povoleni) v.povoleni = [];
      uklidRezervaci(h, v);
      if (v.stav === 'naklada') { H.nakladani(h, v); continue; }
      if (!v.bezi) { v.rych = 0; continue; }
      if (v.otocka > 0) { v.otocka--; continue; }
      if (v.ztracen > 0) { v.ztracen--; if (v.ztracen > 0) continue; }
      const naKonci = v.ci >= v.cesta.length - 1;
      if (!v.cil || (naKonci && v.t === 0 && v.rych === 0)) {
        if (v.cil && naKonci) { H.dojezd(h, v); if (v.stav !== 'jede') { v.rych = 0; v.hlasenoZablokovani = false; continue; } }
        const smiObratit = !!v.odjezd || v.cekaNaVolno > (v.uNavesti ? DT * 20 : DT * 3) || naKonci;
        if (!naplanujVlak(h, v, smiObratit)) {
          v.ztracen = DT * 3;
          if (!v.hlasenoZtraceni) { v.hlasenoZtraceni = true; h.zpravy.push({ den: h.den, text: `${v.jmeno} nemůže najít cestu`, vozidlo: v.id }); }
          continue;
        }
        v.odjezd = false; v.hlasenoZtraceni = false; v.cekaNaVolno = 0;
        if (v.otocka > 0) continue;
      }
      // změna sítě: ověřit úsek před námi, jinak přeplánovat
      const a = v.cesta[v.ci], b = v.cesta[v.ci + 1];
      if (b !== undefined && C.spojenoK(m, a, C.smerMezi(m, a, b)) !== b) { v.cesta = v.cesta.slice(0, v.ci + 1); v.t = 0; v.rych = 0; v.cil = null; continue; }
      // vzdálenost k překážce / konci cesty, rezervace volných polí před sebou
      const vmax = maxRychlost(v), hlava = v.ci + v.t;
      let doPrekazky = (v.cesta.length - 1) - hlava, doOblouku = Infinity;
      const dohled = Math.ceil(brzdnaDraha(vmax) + 2);
      v.uNavesti = false;
      for (let k = v.ci; k < v.cesta.length - 1 && k <= v.ci + dohled; k++) {
        // návěstidlo na poli k hlídá odjezd do k+1 (pole pod hlavou jen když stojí na jeho středu)
        if (k > v.ci || v.t < 1e-6) {
          const dOut = C.smerMezi(m, v.cesta[k], v.cesta[k + 1]);
          if (maNavest(m, v.cesta[k], dOut) && !v.povoleni.includes(v.cesta[k] * 4 + dOut) && !ziskejPovoleni(h, v, k, obs)) {
            // stát kousek před středem pole s návěstidlem (na středu by zaokrouhlení „přejelo“ do dalšího pole)
            doPrekazky = Math.min(doPrekazky, k - 0.05 - hlava); v.uNavesti = true; break;
          }
        }
        const j = v.cesta[k + 1], vl = obs.get(j), rz = h.rez[j];
        if ((vl !== undefined && vl !== v.id) || (rz !== undefined && rz !== v.id)) { doPrekazky = Math.min(doPrekazky, k + 1 - 0.62 - hlava); v.blokuje = vl ?? rz; break; }
        obs.set(j, v.id);
        if (doOblouku === Infinity && k + 2 < v.cesta.length && C.smerMezi(m, v.cesta[k], j) !== C.smerMezi(m, j, v.cesta[k + 2])) doOblouku = k + 1 - hlava;
      }
      const vOblouk = Math.min(vmax, Math.max(40, vmax * 0.6));
      let vcil = Math.min(vmax, Math.sqrt(2500 * BRZDA * Math.max(0, doPrekazky)));
      if (doOblouku < Infinity) vcil = Math.min(vcil, Math.sqrt(vOblouk * vOblouk + 2500 * BRZDA * Math.max(0, doOblouku)));
      // zrychlení podle výkonu a hmotnosti, sklon brzdí do kopce
      const lok = D.VOZIDLA_PODLE_ID[v.typ];
      const sklon = b !== undefined ? vyskaPole(m, b) - vyskaPole(m, a) : 0;
      const zrych = 0.33 * lok.vykon / hmotnost(v) - 0.004 * v.rych - sklon * 1.6;
      if (v.rych < vcil) v.rych = Math.min(vcil, v.rych + Math.max(0.05, zrych));
      else v.rych = Math.max(vcil, v.rych - BRZDA * 1.5);
      if (doPrekazky > 0.001) v.rych = Math.max(v.rych, Math.min(4, vmax));   // dojet až k cíli (jinak se k němu blíží donekonečna)
      else v.rych = 0;
      if (v.rych === 0 && doPrekazky < (v.cesta.length - 1) - hlava - 0.01) v.cekaNaVolno++; else v.cekaNaVolno = 0;
      // dva vlaky proti sobě bez návěstidel: poradit hráči (jednou za zablokování)
      if (v.cekaNaVolno === DT * 3 && !v.uNavesti && v.blokuje !== undefined && !v.hlasenoZablokovani) {
        v.hlasenoZablokovani = true;
        const w = h.vozidla[v.blokuje];
        if (w && w.druh === 'vlak' && w.cekaNaVolno > DT) h.zpravy.push({ den: h.den, text: `⚠️ ${v.jmeno} a ${w.jmeno} se zablokovaly na jedné koleji – postav výhybnu s návěstidly`, vozidlo: v.id, zablokovani: true });
      }
      // zablokování: po 3 dnech (u návěstidla po 20) se obrátit a zkusit jinou cestu
      if (v.cekaNaVolno > (v.uNavesti ? DT * 20 : DT * 3)) { v.cil = null; continue; }
      let krok = Math.min(H.kmhNaPole(v.rych), Math.max(0, doPrekazky));
      v.t += krok;
      while (v.t >= 1 && v.ci < v.cesta.length - 1) {
        v.t -= 1; v.ci++;
        if (v.ci < v.cesta.length - 1) v.d = C.smerMezi(m, v.cesta[v.ci], v.cesta[v.ci + 1]);
      }
      if (v.ci >= v.cesta.length - 1 || (v.ci === v.cesta.length - 2 && v.t > 0.995)) { v.ci = v.cesta.length - 1; v.t = 0; v.rych = 0; }
    }
  }

  // polohy vozů pro kreslení: [{x, y, d, druh: 'lok'|'vagon', barva}] (x, y v polích); vozy v depu se nekreslí
  function vozyVlaku(h, v) {
    const m = h.m, out = [];
    if (!v.cesta) return out;
    const bod = s => {
      if (s < 0) return null;
      const k = Math.floor(s), f = s - k;
      const a = v.cesta[k], b = v.cesta[Math.min(k + 1, v.cesta.length - 1)];
      if (a === undefined) return null;
      const ax = a % m.W + 0.5, ay = ((a / m.W) | 0) + 0.5, bx = b % m.W + 0.5, by = ((b / m.W) | 0) + 0.5;
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, d: a !== b ? C.smerMezi(m, a, b) : v.d };
    };
    const hlava = v.ci + v.t;
    const lp = bod(hlava - 0.35);
    if (lp && !m.depo[v.cesta[Math.floor(hlava - 0.35 + 0.5)]]) out.push({ ...lp, druh: 'lok', trakce: D.VOZIDLA_PODLE_ID[v.typ].trakce });
    v.oddily.forEach((o, k) => {
      const s = hlava - 0.7 - 0.25 - k * 0.5;
      const p = bod(s);
      if (p && !m.depo[v.cesta[Math.floor(s + 0.5)]]) out.push({ ...p, druh: 'vagon', barva: D.VAGONY_PODLE_ID[o.vagon].barva, plny: o.n > 0, naklad: D.NAKLADY_PODLE_ID[o.typ].barva });
    });
    return out;
  }

  MAG.zeleznice = {
    prepniNavest, ziskejPovoleni, uklidRezervaci, cileVlaku,
    mostyNaCare, postavKolej, postavNadrazi, postavDepo, zborKolej, kupVlak, pridejVagon, odeberVagon,
    delkaVlaku, hmotnost, maxRychlost, naplanujVlak, spustVlak, krokVlaku, vozyVlaku, brzdnaDraha, astarKolej,
  };
})(globalThis.MAG = globalThis.MAG || {});
