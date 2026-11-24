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
        if (m.zdym[t] || m.stan[t]) return { chyba: 'Přes zdymadlo ani bóji most nevede' };
        most.set(t, vys);
      }
      k = j;
    }
    return { most };
  }

  // --- úhlopříčná kolej ---------------------------------------------------------------------
  /* Tah zhruba po úhlopříčce (kratší strana ≥ polovina delší) dá „schody“: střídavě krok v x a v y.
     Každé schodové pole je oblouk, který se kreslí jako šikmý úsek a vlak jím projede bez brzdění. */
  function caraKoleje(x0, y0, x1, y1) {
    const ax = Math.abs(x1 - x0), ay = Math.abs(y1 - y0);
    if (Math.min(ax, ay) < 1 || Math.min(ax, ay) * 2 < Math.max(ax, ay)) return H.cara(x0, y0, x1, y1);
    const n = Math.round((ax + ay) / 2), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0), p = [[x0, y0]];
    let x = x0, y = y0;
    for (let k = 0; k < n; k++) { x += sx; p.push([x, y]); y += sy; p.push([x, y]); }
    return p;
  }
  // pole je šikmý úsek: přesně dva kolmé bity a soused v jednom z nich je otočené „L“ (pokračování schodů)
  function jeDiag(m, i) {
    const k = m.kolej[i];
    if (!k || m.stan[i] || m.depo[i]) return false;
    let a = -1, b = -1;
    for (let d = 0; d < 4; d++) if (k & BIT(d)) { if (a < 0) a = d; else if (b < 0) b = d; else return false; }
    if (b < 0 || b === OPAK(a)) return false;
    const L = (p, q) => { const j = C.soused(m, i, p); return j >= 0 && m.kolej[j] === (BIT(OPAK(p)) | BIT(OPAK(q))); };
    return L(a, b) || L(b, a);
  }

  // --- stavba koleje ---------------------------------------------------------------------
  function postavKolej(h, x0, y0, x1, y1, jenCena) {
    const m = h.m, pole = caraKoleje(x0, y0, x1, y1);
    if (pole.length < 2) return { ok: false, chyba: 'Táhni kolej aspoň přes dvě pole' };
    const osa = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 1 : 2;
    const sikmo = pole.length > 2 && pole[0][0] !== pole[2][0] && pole[0][1] !== pole[2][1];
    if (sikmo && pole.some(([x, y]) => M.uvnitr(m, x, y) && jeVodaNeboReka(m, y * m.W + x))) return { ok: false, chyba: 'Šikmo přes vodu most postavit nejde – most veď rovně' };
    const mosty = sikmo ? { most: new Map() } : mostyNaCare(m, pole, osa);
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
      if (m.tunel[i] && (b & ~m.kolej[i])) return { ok: false, chyba: `V tunelu ani nad ním kolej odbočit nemůže (${x}, ${y})` };
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

  // --- trolej a rychlostní kolej ---------------------------------------------------------------
  // trolej: tažením přes existující kolej (nádraží a depa taky); vrt: postaví kolej jako postavKolej + označí rychlostní
  function postavTrolej(h, x0, y0, x1, y1, jenCena) {
    const m = h.m, pole = caraKoleje(x0, y0, x1, y1).filter(([x, y]) => M.uvnitr(m, x, y) && m.kolej[y * m.W + x] && !m.elek[y * m.W + x]);
    if (!pole.length) return { ok: false, cena: 0, chyba: 'Tady není kolej bez troleje' };
    if (H.rok(h) < 1925) return { ok: false, chyba: 'Elektrizace přijde až kolem roku 1925' };
    const cena = pole.length * D.CENY.trolej;
    return H.vysledek(h, cena, jenCena, 'stavba', () => {
      for (const [x, y] of pole) m.elek[y * m.W + x] = 1;
      H.zmena(h, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1));
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }
  function postavVrt(h, x0, y0, x1, y1, jenCena) {
    const m = h.m;
    if (H.rok(h) < D.CENY.ROK_VRT) return { ok: false, chyba: `Rychlostní trať jde stavět od roku ${D.CENY.ROK_VRT}` };
    const pole = caraKoleje(x0, y0, x1, y1);
    const nova = postavKolej(h, x0, y0, x1, y1, true);
    if (!nova.ok && nova.chyba !== 'Kolej tu už vede') return nova;
    // platí se jen pole, která se opravdu označí jako rychlostní (ne nádraží, ne už rychlostní)
    const upgrade = pole.filter(([x, y]) => { const i = y * m.W + x; return M.uvnitr(m, x, y) && (m.kolej[i] || nova.ok) && !m.vrt[i] && !m.stan[i]; }).length;
    const cena = (nova.ok ? nova.cena : 0) + upgrade * D.CENY.vrt;
    if (!upgrade && !nova.ok) return { ok: false, cena: 0, chyba: 'Tady už rychlostní kolej vede' };
    if (jenCena) return { ok: true, cena };
    if (h.firma.penize < cena) return { ok: false, cena, chyba: 'Nedostatek peněz' };
    if (nova.ok) postavKolej(h, x0, y0, x1, y1);
    return H.vysledek(h, upgrade * D.CENY.vrt, false, 'stavba', () => {
      for (const [x, y] of pole) if (M.uvnitr(m, x, y) && m.kolej[y * m.W + x] && !m.stan[y * m.W + x]) m.vrt[y * m.W + x] = 1;
      H.zmena(h, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1));
    });
  }

  // --- tunely --------------------------------------------------------------------------------
  /* Rovný tah: první a poslední pole jsou portály (kolej/silnice na povrchu), pole mezi nimi vedou pod kopcem.
     Nad každým vnitřním polem musí být terén aspoň ve výšce portálu a někde výš; vnitřek musí být volný
     (les zůstane). Tunel nese m.tunel (osa) a m.tunelV (výška), kolej/silnice v něm má běžné bity. */
  function postavTunel(h, x0, y0, x1, y1, druh, jenCena) {
    const m = h.m, pole = H.cara(x0, y0, x1, y1), osa = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 1 : 2;
    if (pole.length < 3) return { ok: false, chyba: 'Tunel táhni od úpatí přes kopec k úpatí (aspoň 3 pole)' };
    if (pole.some(([x, y]) => !M.uvnitr(m, x, y))) return { ok: false, chyba: 'Mimo mapu' };
    if (druh === 'kolej' && H.rok(h) < 1850) return { ok: false, chyba: 'Tunely ještě neumíme' };
    const ii = ([x, y]) => y * m.W + x, A = pole[0], B = pole[pole.length - 1];
    const L = Math.max(M.maxR(m, A[0], A[1]), M.maxR(m, B[0], B[1]));
    let nad = false, cena = 0;
    for (const p of [A, B]) {
      const i = ii(p);
      if (jeVodaNeboReka(m, i) || m.dum[i] || m.prum[i] || m.stan[i] || m.depo[i] || m.tunel[i]) return { ok: false, chyba: `Portál tunelu (${p[0]}, ${p[1]}) musí stát na volné souši` };
      if (druh === 'kolej' && m.cesta[i] && !m.kolej[i]) return { ok: false, chyba: `Na portálu (${p[0]}, ${p[1]}) je silnice` };
      if (druh !== 'kolej' && m.kolej[i] && !m.cesta[i]) return { ok: false, chyba: `Na portálu (${p[0]}, ${p[1]}) je kolej` };
      if (!(druh === 'kolej' ? m.kolej[i] : m.cesta[i])) cena += D.CENY.kolej + H.cenaPole(m, p[0], p[1]);   // portál na existující koleji / silnici zdarma
    }
    for (const p of pole.slice(1, -1)) {
      const i = ii(p);
      if (jeVodaNeboReka(m, i)) return { ok: false, chyba: `Pod vodou tunel nevede (${p[0]}, ${p[1]})` };
      if (m.cesta[i] || m.kolej[i] || m.stan[i] || m.depo[i] || m.dum[i] || m.prum[i] || m.tunel[i]) return { ok: false, chyba: `Nad tunelem nesmí nic stát (${p[0]}, ${p[1]})` };
      if (M.minR(m, p[0], p[1]) < L) return { ok: false, chyba: `Tunel by vyšel na povrch (${p[0]}, ${p[1]}) – táhni ho kopcem` };
      if (M.maxR(m, p[0], p[1]) > L) nad = true;
      cena += D.CENY.tunel;
    }
    if (!nad) return { ok: false, chyba: 'Tady není kopec – tunel vede pod vyšším terénem' };
    return H.vysledek(h, cena, jenCena, 'stavba', () => {
      pole.forEach((p, k) => {
        const i = ii(p);
        if (druh === 'kolej') {
          let b = 0;
          if (k > 0) b |= BIT(C.smerMezi(m, i, ii(pole[k - 1])));
          if (k < pole.length - 1) b |= BIT(C.smerMezi(m, i, ii(pole[k + 1])));
          m.kolej[i] |= b;
        } else m.cesta[i] = 2;
        if (k > 0 && k < pole.length - 1) { m.tunel[i] = osa; m.tunelV[i] = L; }
        else { H.vykacet(h, i); m.les[i] = 0; if (m.typ[i] === T.POLE) m.typ[i] = T.TRAVA; }
      });
      H.zmena(h, Math.min(x0, x1) - 1, Math.min(y0, y1) - 1, Math.max(x0, x1) + 1, Math.max(y0, y1) + 1);
      h.sitVerze = (h.sitVerze || 0) + 1;
    });
  }
  // všechna pole tunelu, kterým vede pole i (jen vnitřek)
  function poleTunelu(m, i) {
    const out = [i], osa = m.tunel[i], dd = osa === 1 ? [1, 3] : [0, 2];
    for (const d of dd) { let j = C.soused(m, i, d); while (j >= 0 && m.tunel[j] === osa) { out.push(j); j = C.soused(m, j, d); } }
    return out;
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
      if (m.tunel[i]) return { ok: false, chyba: 'V tunelu nádraží být nemůže' };
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
      if (j < 0 || !m.kolej[j] || m.depo[j] || m.tunel[j]) return false;   // z tunelu se neodbočuje
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
    if (!h.m.cesta[i]) { h.m.tunel[i] = 0; h.m.tunelV[i] = 0; }
    const m = h.m;
    m.elek[i] = 0; m.vrt[i] = 0;
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
      const alt = astarKolej(m, v.cesta[k], dPrichod, c.cile, 40000, zakazane, jeElektro(v));
      if (!alt) return false;
      const nova = v.cesta.slice(0, k).concat(alt.cesta);
      if (c.stId >= 0) naKonecNastupiste(m, nova, alt.d, c.stId);
      const u2 = usekZa(m, nova, k);
      if (!u2.every(volne)) return false;
      v.cesta = nova; usek = u2;
      if (v.ci + 1 < v.cesta.length) v.d = C.smerMezi(m, v.cesta[v.ci], v.cesta[v.ci + 1]);
    }
    for (const i of usek) { if (h.rez[i] !== v.id) { h.rez[i] = v.id; (v.rezervace || (v.rezervace = [])).push(i); } }
    v.povoleni.push(v.cesta[k] * 4 + C.smerMezi(m, v.cesta[k], v.cesta[k + 1]));
    return true;
  }

  // uvolnit rezervace a povolení, které už vlak minul (nejsou v těle ani na cestě před ním)
  function uklidRezervaci(h, v) {
    const pred = new Set(v.telo);
    if (v.cesta) for (let k = v.ci; k < v.cesta.length; k++) pred.add(v.cesta[k]);
    // jen vlastní seznam (procházet celé h.rez pro každý vlak v každém ticku bylo O(vlaků × rezervací))
    if (!v.rezervace) v.rezervace = Object.keys(h.rez).filter(i => h.rez[i] === v.id).map(Number);   // starší uložení
    v.rezervace = v.rezervace.filter(i => {
      if (h.rez[i] !== v.id) return false;
      if (pred.has(i)) return true;
      delete h.rez[i]; return false;
    });
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
  const jeElektro = v => D.VOZIDLA_PODLE_ID[v.typ].trakce === 'elektro';
  const rychlostKoleje = (m, i) => m.vrt[i] ? D.CENY.RYCHLOST_VRT : D.CENY.RYCHLOST_KOLEJ;
  function maxRychlost(v) {
    let r = D.VOZIDLA_PODLE_ID[v.typ].rychlost;
    for (const o of v.oddily) r = Math.min(r, D.VAGONY_PODLE_ID[o.vagon].rychlost);
    return r;
  }

  // --- hledání cesty po kolejích: stav = (pole, směr jízdy) ---------------------------------------------
  // zakazane: Set polí, kam nesmí (obsazená / rezervovaná jiným vlakem)
  function astarKolej(m, startI, startD, cile, maxUzlu = 80000, zakazane = null, elektro = false) {
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
        if (elektro && !m.elek[j] && !m.depo[j]) continue;   // elektrická lokomotiva jen pod trolejí (do depa vždy – z něj vyjede i bez troleje)
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
    if (v.doGaraze || v.doServisu) {
      for (const g of h.depa) if (g && g.druh === 'kolej') cile.add(g.y * m.W + g.x);
      return { cile, cil: { garaz: true, servis: !v.doGaraze }, stId: -1 };
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
    const el = jeElektro(v);
    const vpred = astarKolej(m, hlava, v.d, cile, 80000, null, el);
    let vzad = null, telo = null;
    if (smiObratit) {
      telo = teloIndexy(v).map(k => v.cesta[k]);   // od hlavy k ocasu
      const ocas = telo[telo.length - 1];
      const dOcas = telo.length > 1 ? C.smerMezi(m, telo[telo.length - 2], ocas) : OPAK(v.d);
      vzad = astarKolej(m, ocas, dOcas, cile, 80000, null, el);
    }
    let volba = null;
    if (vpred && (!vzad || vpred.cena <= vzad.cena + 4)) volba = 'vpred';
    else if (vzad) volba = 'vzad';
    if (!volba && v.doServisu) { v.doServisu = false; v.servis -= 30; return naplanujVlak(h, v, smiObratit); }   // depo nedostupné → servis později
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
  const vyskaPole = (m, i) => m.most[i] ? m.mostV[i] : m.tunel[i] ? m.tunelV[i] : (() => { const x = i % m.W, y = (i / m.W) | 0, r = M.rohy(m, x, y); return (r[0] + r[1] + r[2] + r[3]) / 4; })();

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
      if (v.porucha > 0) { v.porucha--; v.rych = 0; continue; }
      if (v.ztracen > 0) { v.ztracen--; if (v.ztracen > 0) continue; }
      const naKonci = v.ci >= v.cesta.length - 1;
      if (!v.cil || (naKonci && v.t === 0 && v.rych === 0)) {
        if (v.cil && naKonci) { H.dojezd(h, v); if (v.stav !== 'jede') { v.rych = 0; v.hlasenoZablokovani = false; continue; } }
        const smiObratit = !!v.odjezd || v.cekaNaVolno > (v.uNavesti ? DT * 20 : DT * 3) || naKonci;
        // cíl jen za vlakem (třeba „do depa“ uprostřed trati): dobrzdit po dosavadní cestě a pak se otočit na místě
        let naplanovano = naplanujVlak(h, v, smiObratit);
        if (!naplanovano && !smiObratit && v.rych === 0) naplanovano = naplanujVlak(h, v, true);
        if (!naplanovano && v.rych > 0) {
          v.rych = v.ci >= v.cesta.length - 1 ? 0 : Math.max(0, v.rych - BRZDA * 1.5);
          // i při dobrzďování nevjet do pole jiného vlaku ani do cizí rezervace
          let volno = Infinity;
          for (let k = v.ci; k < v.cesta.length - 1; k++) {
            const j = v.cesta[k + 1], vl = obs.get(j), rz = h.rez[j];
            if ((vl !== undefined && vl !== v.id) || (rz !== undefined && rz !== v.id)) { volno = k + 1 - 0.62 - (v.ci + v.t); break; }
          }
          if (volno <= 0.001) v.rych = 0;
          v.t += Math.min(H.kmhNaPole(v.rych), Math.max(0, volno));
          while (v.t >= 1 && v.ci < v.cesta.length - 1) { v.t -= 1; v.ci++; if (v.ci < v.cesta.length - 1) v.d = C.smerMezi(m, v.cesta[v.ci], v.cesta[v.ci + 1]); }
          if (v.ci >= v.cesta.length - 1) { v.ci = v.cesta.length - 1; v.t = 0; v.rych = 0; }
          if (v.rych === 0) v.t = 0;   // stojí na středu pole → příští tick se smí otočit
          continue;
        }
        if (!naplanovano) {
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
        if (doOblouku === Infinity && k + 2 < v.cesta.length && !jeDiag(m, j) && C.smerMezi(m, v.cesta[k], j) !== C.smerMezi(m, j, v.cesta[k + 2])) doOblouku = k + 1 - hlava;   // šikmý úsek není oblouk
      }
      // rychlost podle koleje: běžná 160 km/h, rychlostní 320 – brzdit včas před pomalejším úsekem
      let vKolej = Math.min(vmax, rychlostKoleje(m, v.cesta[v.ci]));
      for (let k = v.ci + 1; k < v.cesta.length && k <= v.ci + dohled; k++) {
        const lim = rychlostKoleje(m, v.cesta[k]);
        if (lim < vmax) vKolej = Math.min(vKolej, Math.sqrt(lim * lim + 2500 * BRZDA * Math.max(0, k - 0.5 - hlava)));
      }
      const vOblouk = Math.min(vmax, Math.max(40, vmax * 0.6));
      let vcil = Math.min(vmax, vKolej, Math.sqrt(2500 * BRZDA * Math.max(0, doPrekazky)));
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

  /* polohy vozů pro kreslení: [{x, y, d, k?, druh: 'lok'|'vagon', …}] (x, y v polích); vozy v depu a v tunelu se nekreslí.
     Na šikmém úseku vůz jede rovně mezi středy hran (místo přes střed pole) a k = snímek po 45°. */
  function vozyVlaku(h, v) {
    const m = h.m, out = [];
    if (!v.cesta) return out;
    const c = v.cesta, n = c.length;
    const stred = k => [c[k] % m.W + 0.5, ((c[k] / m.W) | 0) + 0.5];
    const bod = s => {
      if (s < 0 || c[0] === undefined) return null;
      const k = Math.min(n - 1, Math.max(0, Math.round(s))), u = s - k;   // pole k, u ∈ ⟨−0,5; 0,5⟩
      const P = stred(k);
      if (k > 0 && k < n - 1 && jeDiag(m, c[k])) {
        const A = stred(k - 1), B = stred(k + 1);
        const E = [(A[0] + P[0]) / 2, (A[1] + P[1]) / 2], X = [(P[0] + B[0]) / 2, (P[1] + B[1]) / 2], f = u + 0.5;
        const vx = X[0] - E[0], vy = X[1] - E[1];
        return { x: E[0] + vx * f, y: E[1] + vy * f, d: C.smerMezi(m, c[k], c[k + 1]), k: (Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8, i: c[k] };
      }
      // oblouk (pole jen se dvěma kolmými kolejemi): po čtvrtkruhu se středem v rohu, od středu vstupní ke středu výstupní hrany
      if (k > 0 && k < n - 1 && !m.stan[c[k]] && !m.depo[c[k]]) {
        const bity = m.kolej[c[k]], din = C.smerMezi(m, c[k - 1], c[k]), dout = C.smerMezi(m, c[k], c[k + 1]);
        if (din !== dout && bity === (BIT(OPAK(din)) | BIT(dout))) {
          const A = stred(k - 1), B = stred(k + 1);
          const E = [(A[0] + P[0]) / 2, (A[1] + P[1]) / 2], X = [(P[0] + B[0]) / 2, (P[1] + B[1]) / 2], S = [E[0] + X[0] - P[0], E[1] + X[1] - P[1]];
          const t = (u + 0.5) * Math.PI / 2, ca = Math.cos(t), sa = Math.sin(t);
          const ex = E[0] - S[0], ey = E[1] - S[1], xx = X[0] - S[0], xy = X[1] - S[1];
          const vx = -ex * sa + xx * ca, vy = -ey * sa + xy * ca;
          return { x: S[0] + ex * ca + xx * sa, y: S[1] + ey * ca + xy * sa, d: u < 0 ? din : dout, k: (Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8, i: c[k] };
        }
      }
      const j = u >= 0 ? Math.min(k + 1, n - 1) : Math.max(k - 1, 0), Q = stred(j), f = Math.abs(u);
      const d = j !== k ? (u >= 0 ? C.smerMezi(m, c[k], c[j]) : C.smerMezi(m, c[j], c[k])) : v.d;
      return { x: P[0] + (Q[0] - P[0]) * f, y: P[1] + (Q[1] - P[1]) * f, d, i: c[k] };
    };
    const skryty = p => m.depo[p.i] || m.tunel[p.i];
    const hlava = v.ci + v.t;
    const lp = bod(hlava - 0.35);
    if (lp && !skryty(lp)) out.push({ ...lp, druh: 'lok', typ: v.typ, trakce: D.VOZIDLA_PODLE_ID[v.typ].trakce });
    v.oddily.forEach((o, k) => {
      const p = bod(hlava - 0.7 - 0.25 - k * 0.5);
      // otevřené vozy mají naložený model (hromada / klády); cisterna, krytý vůz a hromada v barvě nákladu
      const otevreny = o.vagon === 'vysypny' || o.vagon === 'klanicak', barvaNakl = D.NAKLADY_PODLE_ID[o.typ].barva;
      if (p && !skryty(p)) out.push({ ...p, druh: 'vagon', typ: 'vagon_' + o.vagon + (otevreny && o.n > 0 ? '_plny' : ''), barva: D.VAGONY_PODLE_ID[o.vagon].barva,
        barvaTypu: ['vysypny', 'cisterna', 'kryty'].includes(o.vagon) ? barvaNakl : undefined, plny: o.n > 0, podil: o.kap ? o.n / o.kap : 0, naklad: barvaNakl });
    });
    return out;
  }

  MAG.zeleznice = {
    postavTrolej, postavVrt, jeElektro, rychlostKoleje, caraKoleje, jeDiag, postavTunel, poleTunelu,
    prepniNavest, ziskejPovoleni, uklidRezervaci, cileVlaku,
    mostyNaCare, postavKolej, postavNadrazi, postavDepo, zborKolej, kupVlak, pridejVagon, odeberVagon,
    delkaVlaku, hmotnost, maxRychlost, naplanujVlak, spustVlak, krokVlaku, vozyVlaku, brzdnaDraha, astarKolej,
  };
})(globalThis.MAG = globalThis.MAG || {});
