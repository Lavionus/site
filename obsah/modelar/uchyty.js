/* Modelář 3D – úchyty vybraných těles (SVG vrstva nad plátnem).
   Body úchytů se každý snímek promítnou ze 3D na obrazovku, takže mají
   stálou velikost v pixelech a chytají se přímo jako prvky DOM.
   Jedno těleso: 4 rohy a 4 středy hran spodní podstavy (šířka/hloubka,
   protější strana stojí), vrchol (výška, spodek stojí), šipka nad tělesem
   (zvednutí podél normály roviny) a tři oblouky otáčení (osy pracovní
   roviny, krok 15°). Víc těles: šipka a oblouky kolem společného středu.
   Během tažení: popisek s hodnotou u kurzoru, při otáčení úhloměr.
   Modifikátory: Shift = zachovat poměry / otáčet po 1°, Ctrl = bez přichycení,
   Esc = zrušit tažení. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const V = THREE.Vector3;
  const NS = 'http://www.w3.org/2000/svg';
  const BARVY_OS = ['#e2675c', '#4fae6a', '#5b93e0'];

  function el(nazev, atributy = {}, rodic) {
    const e = document.createElementNS(NS, nazev);
    for (const [k, v] of Object.entries(atributy)) e.setAttribute(k, v);
    if (rodic) rodic.appendChild(e);
    return e;
  }

  const hrubyUkazatel = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : { matches: false };

  M.vytvorUchyty = function (S, obal) {
    const svg = el('svg', { class: 'uchyty', 'aria-hidden': 'true' });
    obal.appendChild(svg);
    const defs = el('defs', {}, svg);
    BARVY_OS.forEach((b, i) => {
      const m = el('marker', { id: 'sipka' + i, viewBox: '0 0 10 10', refX: '5', refY: '5', markerWidth: '3.2', markerHeight: '3.2', orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', fill: b }, m);
    });
    const vrstvaKresby = el('g', { class: 'kresba' }, svg);
    const vrstvaUchytu = el('g', { class: 'body' }, svg);
    const popisek = el('g', { class: 'popisek' }, svg);
    const popisekRam = el('rect', { rx: 4, ry: 4 }, popisek);
    const popisekText = el('text', {}, popisek);
    popisek.style.display = 'none';

    let tah = null;               // probíhající tažení
    let najeto = null;            // index oblouku otáčení pod myší (náhled úhloměru)
    const predchoziT0 = [null, null, null];     // poslední místo svislých šipek (setrvačnost)
    let uchyty = [];              // [{prvek, druh, …}]

    // ------------------------------------------------------------ pomocné
    const krok = e => (e && e.ctrlKey) ? 0 : Math.max(S.deska.krok, 0);
    function pixel(e) { const r = S.renderer.domElement.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function prusecikRoviny(px, py, bod, normala) {
      const ray = S.kamera.paprsek(px, py), p = new V();
      return ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normala, bod), p) ? p : null;
    }
    /** Parametr t nejbližšího bodu přímky (bod + t·smer) k paprsku z pixelu. */
    function parametrNaPrimce(px, py, bod, smer) {
      const ray = S.kamera.paprsek(px, py);
      const w0 = new V().subVectors(bod, ray.origin);
      const a = smer.dot(smer), b = smer.dot(ray.direction), c = ray.direction.dot(ray.direction);
      const d = smer.dot(w0), e = ray.direction.dot(w0);
      const den = a * c - b * b;
      if (Math.abs(den) < 1e-9) return null;
      return (b * e - c * d) / den;
    }
    M.parametrNaPrimce = parametrNaPrimce;
    M.prusecikRoviny = prusecikRoviny;

    function ukazPopisek(text, x, y) {
      popisek.style.display = '';
      popisekText.textContent = text;
      popisekText.setAttribute('x', x + 16); popisekText.setAttribute('y', y - 14);
      const b = popisekText.getBBox();
      popisekRam.setAttribute('x', b.x - 5); popisekRam.setAttribute('y', b.y - 3);
      popisekRam.setAttribute('width', b.width + 10); popisekRam.setAttribute('height', b.height + 6);
    }
    function skryjPopisek() { popisek.style.display = 'none'; }
    M.ukazPopisek = ukazPopisek;
    M.skryjPopisek = skryjPopisek;

    function osyRoviny() { const r = M.rovina(); return r.osy.map(o => new V(...o)); }

    // ------------------------------------------------------------ kreslení
    function ctverec(x, y, vel, trida, data) {
      if (hrubyUkazatel.matches) vel *= 1.8;          // prst: větší úchyty
      const r = el('rect', { x: x - vel / 2, y: y - vel / 2, width: vel, height: vel, class: 'uchyt ' + trida }, vrstvaUchytu);
      uchyty.push(Object.assign({ prvek: r }, data));
      return r;
    }

    /** Obrys zahnuté dvojité šipky podél lomené čáry (body na obrazovce): pás šířky 2w a hroty na koncích. */
    function zahnutaSipka(body, w) {
      const n = body.length, nor = body.map((p, i) => {
        const a = body[Math.max(0, i - 1)], b = body[Math.min(n - 1, i + 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        return [-dy / l, dx / l];
      });
      // hrot zabere asi pětinu oblouku, nejvýš 18 px
      let k = 1, d = 0;
      while (k < n / 2 - 1 && d < 18) { d += Math.hypot(body[k][0] - body[k - 1][0], body[k][1] - body[k - 1][1]); k++; }
      const b = (i, s) => `${(body[i][0] + nor[i][0] * s).toFixed(1)},${(body[i][1] + nor[i][1] * s).toFixed(1)}`;
      const L = [], P = [];
      for (let i = k; i <= n - 1 - k; i++) { L.push(b(i, w)); P.push(b(i, -w)); }
      return `M${b(0, 0)} L${b(k, 2.4 * w)} L${L.join(' L')} L${b(n - 1 - k, 2.4 * w)} L${b(n - 1, 0)} L${b(n - 1 - k, -2.4 * w)} L${P.reverse().join(' L')} L${b(k, -2.4 * w)} Z`;
    }

    function kresli() {
      for (const c of [...vrstvaUchytu.children]) {
        if (tah && tah.prvek && (c === tah.prvek || c.contains(tah.prvek))) { c.style.visibility = 'hidden'; continue; }   // chycený prvek zůstane (neviditelný)
        c.remove();
      }
      if (!tah || tah.druh !== 'otoceni') vrstvaKresby.textContent = '';
      uchyty = [];
      const uzly = M.vybraneVolne();
      svg.classList.toggle('tazeni', !!tah);
      if (!uzly.length || M.app.rezim) { najeto = null; return; }
      const [u, v, n] = osyRoviny();

      if (uzly.length === 1) {
        const uz = uzly[0], m = M.tuhaMaticeUzlu(uz), h = uz.rozmer.map(x => x / 2);
        const bod = (x, y, z) => S.naObrazovku(new V(x, y, z).applyMatrix4(m));
        // malé těleso na obrazovce: úchyty by ho celé zakryly (prst by nechytil těleso) – méně úchytů
        const vel = 10 * (hrubyUkazatel.matches ? 1.8 : 1);
        const rohy = [];
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) rohy.push({ sx, sy, p: bod(sx * h[0], sy * h[1], -h[2]) });
        let dmin = Infinity;
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (rohy[i].p && rohy[j].p) dmin = Math.min(dmin, Math.hypot(rohy[i].p[0] - rohy[j].p[0], rohy[i].p[1] - rohy[j].p[1]));
        for (const { sx, sy, p } of rohy) {
          if (dmin < 1.6 * vel && !(sx === 1 && sy === 1)) continue;       // natěsno: jen jeden roh
          if (p) ctverec(p[0], p[1], 10, 'roh', { druh: 'velikost', uchyt: { sx, sy }, nazev: `roh${sx}${sy}` });
        }
        // čtyři rohy i nahoře (šířka a hloubka, tažené v rovině horní stěny; se Shiftem v poměru i výška)
        if (dmin >= 1.6 * vel) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          const p = bod(sx * h[0], sy * h[1], h[2]), dole = bod(sx * h[0], sy * h[1], -h[2]);
          // těleso nízké na obrazovce: horní roh by ležel na dolním
          if (!p || !dole || Math.hypot(p[0] - dole[0], p[1] - dole[1]) < 1.2 * vel) continue;
          ctverec(p[0], p[1], 10, 'roh horni', { druh: 'velikost', uchyt: { sx, sy, horni: true }, nazev: `horni${sx}${sy}` });
        }
        for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const p = bod(sx * h[0], sy * h[1], -h[2]);
          // na krátké hraně (malé těleso, pohled z boku) by střed hrany zakrýval těleso
          const k1 = bod(sx ? sx * h[0] : -h[0], sy ? sy * h[1] : -h[1], -h[2]);
          const k2 = bod(sx ? sx * h[0] : h[0], sy ? sy * h[1] : h[1], -h[2]);
          if (!p || !k1 || !k2 || Math.hypot(k1[0] - k2[0], k1[1] - k2[1]) < 3.6 * vel) continue;
          ctverec(p[0], p[1], 8, 'hrana', { druh: 'velikost', uchyt: { sx, sy }, nazev: `hrana${sx}${sy}` });
        }
        const pv = bod(0, 0, h[2]);
        const pd = bod(0, 0, -h[2]);
        // úchyt výšky jen když je těleso na obrazovce dost vysoké (jinak leží přes horní stěnu)
        if (pv && pd && Math.hypot(pv[0] - pd[0], pv[1] - pd[1]) >= 2 * vel) ctverec(pv[0], pv[1], 10, 'vrchol', { druh: 'velikost', uchyt: { sz: 1 }, nazev: 'vrchol' });
      }

      // šipka zvednutí: nad nejvyšším bodem výběru (podél normály roviny)
      const ob = M.obalkaVice(uzly);
      const stred = new V(...ob.stred);
      // nejnižší a nejvyšší bod výběru podél normály roviny
      const r = M.rovina();
      const obracena = { puvod: r.puvod, osy: [r.osy[0], r.osy[1], r.osy[2].map(x => -x)] };
      let minN = Infinity, maxN = -Infinity;
      for (const uz of uzly) {
        minN = Math.min(minN, M.minNadRovinou(uz, r));
        maxN = Math.max(maxN, -M.minNadRovinou(uz, obracena));
      }
      const p0 = new V(...r.puvod);
      const stredN = stred.clone().sub(p0).dot(n);
      const vrch = stred.clone().addScaledVector(n, maxN - stredN);
      const pv = S.naObrazovku(vrch);
      if (pv) {
        const pod = S.naObrazovku(vrch.clone().addScaledVector(n, S.mmNaPixel(vrch)));
        let dx = 0, dy = -1;
        if (pod) { const l = Math.hypot(pod[0] - pv[0], pod[1] - pv[1]); if (l > 1e-6) { dx = (pod[0] - pv[0]) / l; dy = (pod[1] - pv[1]) / l; } }
        const x = pv[0] + dx * 30, y = pv[1] + dy * 30, ux = -dy, uy = dx;
        const t = el('path', { d: `M${x + dx * 9},${y + dy * 9} L${x - dx * 7 + ux * 8},${y - dy * 7 + uy * 8} L${x - dx * 7 - ux * 8},${y - dy * 7 - uy * 8} Z`, class: 'uchyt vyska' }, vrstvaUchytu);
        uchyty.push({ prvek: t, druh: 'vyska', nazev: 'vyska', bod: vrch });
      }

      // oblouky otáčení
      const diag = Math.hypot(ob.max[0] - ob.min[0], ob.max[1] - ob.min[1], ob.max[2] - ob.min[2]);
      // u malého tělesa šipky dál od něj (nejméně ~70 px), ať je nezakryjí úchyty rohů ani druhá šipka
      const R = Math.max(diag * 0.62, S.mmNaPixel(stred) * 70);
      const kam = S.kamera.aktivni().position.clone();
      const pohled = new V().subVectors(stred, kam).normalize();
      const osy = [u, v, n];
      const baze = [[v, n], [n, u], [u, v]];             // b1 × b2 = osa
      // obdélník výběru na obrazovce (šipky se mu vyhýbají) a středy už umístěných šipek
      const obrTelesa = [Infinity, Infinity, -Infinity, -Infinity], stredySipek = [];
      for (let k = 0; k < 8; k++) {
        const q = S.naObrazovku(new V(k & 1 ? ob.max[0] : ob.min[0], k & 2 ? ob.max[1] : ob.min[1], k & 4 ? ob.max[2] : ob.min[2]));
        if (q) { obrTelesa[0] = Math.min(obrTelesa[0], q[0]); obrTelesa[1] = Math.min(obrTelesa[1], q[1]); obrTelesa[2] = Math.max(obrTelesa[2], q[0]); obrTelesa[3] = Math.max(obrTelesa[3], q[1]); }
      }
      for (let i = 0; i < 3; i++) {
        const [b1, b2] = baze[i];
        let t0;
        if (i === 2) {
          // vodorovný oblouk: u podstavy, natočený ke kameře a o kus doleva
          const d = kam.clone().sub(stred);
          t0 = Math.atan2(d.dot(b2), d.dot(b1)) - 40 * M.st;
        } else {
          // svislé oblouky: místo na kružnici, kde je šipka na obrazovce nejdelší (rovina z boku ji jinak zkrátí),
          // neleží na tělese (úchyty rohů) a nekryje se s druhou šipkou; raději nahoře než dole
          let nej = null, skore = -Infinity, nejStred = null;
          for (let k = 0; k < 24; k++) {
            const t = k * 15 * M.st;
            const w = b1.clone().multiplyScalar(Math.cos(t)).addScaledVector(b2, Math.sin(t));
            if (w.dot(n) < -0.2) continue;                       // ne pod desku
            const pts = [];
            for (let j = 0; j <= 8; j++) {
              const tt = t + (j / 8 - 0.5) * 55 * M.st;
              const q = S.naObrazovku(stred.clone().addScaledVector(b1, R * Math.cos(tt)).addScaledVector(b2, R * Math.sin(tt)));
              if (q) pts.push(q);
            }
            if (pts.length < 9) continue;
            let L = 0;
            for (let j = 1; j < pts.length; j++) L += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
            const mid = pts[4];
            let sk = L + 25 * w.dot(n);
            if (mid[0] > obrTelesa[0] - 12 && mid[0] < obrTelesa[2] + 12 && mid[1] > obrTelesa[1] - 12 && mid[1] < obrTelesa[3] + 12) sk -= 400;
            if (stredySipek.some(q => Math.hypot(q[0] - mid[0], q[1] - mid[1]) < 70)) sk -= 300;
            // setrvačnost: dosavadní místo vyhrává, dokud ho jiné nepřekoná zřetelně (šipka jinak při otáčení skáče)
            if (predchoziT0[i] != null && Math.abs(Math.atan2(Math.sin(t - predchoziT0[i]), Math.cos(t - predchoziT0[i]))) < 1e-6) sk += 60;
            if (najeto === i && predchoziT0[i] != null && Math.abs(Math.atan2(Math.sin(t - predchoziT0[i]), Math.cos(t - predchoziT0[i]))) < 1e-6) sk += 1e6;
            if (sk > skore) { skore = sk; nej = t; nejStred = mid; }
          }
          if (nej == null) continue;
          t0 = nej;
          predchoziT0[i] = nej;
          stredySipek.push(nejStred);
        }
        // oblouk osy n leží v rovině spodku výběru, ostatní procházejí středem
        const c = i === 2 ? stred.clone().addScaledVector(n, minN - stredN) : stred;
        const body = [];
        for (let k = 0; k <= 16; k++) {
          const t = t0 + (k / 16 - 0.5) * 55 * M.st;
          const q = S.naObrazovku(c.clone().addScaledVector(b1, R * Math.cos(t)).addScaledVector(b2, R * Math.sin(t)));
          if (!q) { body.length = 0; break; }
          body.push(q.map(x => x.toFixed(1)).join(','));
        }
        if (body.length < 2) continue;
        const g = el('g', { class: 'oblouk osa' + i + (najeto === i && !tah ? ' najeto' : '') }, vrstvaUchytu);
        el('polyline', { points: body.join(' '), class: 'zasah' }, g);
        // zahnutá dvojitá šipka (pás se dvěma hroty), dobře vidět i chytit
        el('path', { d: zahnutaSipka(body.map(b => b.split(',').map(Number)), hrubyUkazatel.matches ? 7 : 5), class: 'cara', fill: BARVY_OS[i] }, g);
        el('title', {}, g).textContent = `Otočit kolem ${'XYZ'[i]}: táhni (uvnitř úhloměru po 15°, vně po 1°), klikni = zadat úhel`;
        // otáčí se kolem bodu otáčení (pivotu), když je zvolený, jinak kolem středu výběru
        const piv = M.app.pivot ? new V(...M.app.pivot) : null;
        // úhloměr kolem vzdáleného bodu otáčení musí dosáhnout až k tělesu (jinak by kurzor byl vždy „vně“)
        const Rk = piv ? Math.max(R, piv.distanceTo(c) + R * 0.35) : R;
        uchyty.push({ prvek: g, druh: 'otoceni', osa: osy[i], b1, b2, stred: (piv || stred).clone(), kresba: (piv || c).clone(), R: Rk, t0, index: i, nazev: 'otoceni' + i });
        // najetí: slabý celý úhloměr, ať je vidět rovina otáčení
        if (najeto === i && !tah) {
          const k = piv || c, kruh = [];
          for (let j = 0; j <= 72; j++) {
            const t = j / 72 * 2 * Math.PI;
            const q = S.naObrazovku(k.clone().addScaledVector(b1, R * Math.cos(t)).addScaledVector(b2, R * Math.sin(t)));
            if (q) kruh.push(q.map(x => x.toFixed(1)).join(','));
          }
          el('polyline', { points: kruh.join(' '), class: 'uhlomer nahled', stroke: BARVY_OS[i] }, vrstvaKresby);
        }
      }
      // bod otáčení (pivot): značka, jen ukazuje (vybírá se příkazem Bod otáčení)
      if (M.app.pivot) {
        const q = S.naObrazovku(new V(...M.app.pivot));
        if (q) {
          const g = el('g', { class: 'pivot' }, vrstvaKresby);
          el('circle', { cx: q[0], cy: q[1], r: 8 }, g);
          el('line', { x1: q[0] - 12, y1: q[1], x2: q[0] + 12, y2: q[1] }, g);
          el('line', { x1: q[0], y1: q[1] - 12, x2: q[0], y2: q[1] + 12 }, g);
        }
      }
      // čtverečky úchytů nahoru (nad oblouky otáčení – horní rohy jinak leží pod obloukem a tah ho chytí)
      for (const r of [...vrstvaUchytu.querySelectorAll('rect.uchyt')]) if (!(tah && tah.prvek === r)) vrstvaUchytu.appendChild(r);
      if (tah) for (const h of uchyty) h.prvek.classList.toggle('aktivni', h.nazev === tah.nazev);
    }

    // ------------------------------------------------------------ tažení
    function zacni(h, e) {
      const ids = M.vybraneVolne().map(u => u.id);
      if (!ids.length) return;
      const [px, py] = pixel(e);
      tah = { nazev: h.nazev, druh: h.druh, ids, zaklad: M.zacniUpravu(), id: e.pointerId };
      // prst je implicitně „zachycený“ prvkem úchytu: kresli() ho proto během tažení nesmí odstranit
      // (pointerup by šel do odpojeného prvku a tažení by nikdy neskončilo)
      tah.prvek = e.target;
      if (h.druh === 'velikost') {
        const u0 = M.najdiUzel(tah.zaklad, ids[0]);
        tah.u0 = u0;
        tah.uchyt = h.uchyt;
        tah.matice = M.tuhaMaticeUzlu(u0);
        tah.inverze = tah.matice.clone().invert();
        const h2 = u0.rozmer.map(x => x / 2);
        if (h.uchyt.sz) {
          tah.osaZ = new V(0, 0, 1).applyQuaternion(M.quatUzlu(u0));
          tah.stred = new V(...u0.poloha);
        } else {
          tah.rovinaBod = new V(0, 0, h.uchyt.horni ? h2[2] : -h2[2]).applyMatrix4(tah.matice);
          tah.rovinaN = new V(0, 0, 1).applyQuaternion(M.quatUzlu(u0));
        }
      } else if (h.druh === 'vyska') {
        tah.n = osyRoviny()[2];
        tah.bod = h.bod.clone();
        tah.t0 = parametrNaPrimce(px, py, tah.bod, tah.n);
        tah.spodek0 = Math.min(...ids.map(id => M.minNadRovinou(M.najdiUzel(tah.zaklad, id), M.rovina())));
      } else if (h.druh === 'otoceni') {
        Object.assign(tah, { osa: h.osa, b1: h.b1, b2: h.b2, stred: h.stred, kresba: h.kresba, R: h.R, index: h.index, px0: px, py0: py, pohnuto: false });
        tah.a0 = uhelKurzoru(px, py);
        tah.posledni = 0; tah.otoceni = 0;
      }
      // úchyty se každý snímek kreslí znovu (prvek zmizí z DOM), proto se tažení
      // nesleduje zachycením na prvku, ale posluchači na dokumentu
      e.preventDefault(); e.stopPropagation();
      M.ovladaniBlokovano = true;
      kresli();
    }

    /** Úhel kurzoru v rovině otáčení (radiány); když je rovina z boku, podle obrazovky. */
    function uhelKurzoru(px, py) {
      const ray = S.kamera.paprsek(px, py);
      // způsob (rovina / obrazovka) se volí jednou na začátku tahu – přepnutí uprostřed by úhel skokem změnilo
      if (tah.rovinou == null) tah.rovinou = Math.abs(ray.direction.dot(tah.osa)) > 0.12;
      if (tah.rovinou) {
        const p = prusecikRoviny(px, py, tah.kresba, tah.osa);
        if (p) { p.sub(tah.kresba); return Math.atan2(p.dot(tah.b2), p.dot(tah.b1)); }
      }
      const c = S.naObrazovku(tah.kresba) || [0, 0];
      const k = S.kamera.aktivni().position.clone().sub(tah.kresba);
      return Math.sign(tah.osa.dot(k) || 1) * Math.atan2(-(py - c[1]), px - c[0]);
    }

    function pohyb(e) {
      if (!tah || e.pointerId !== tah.id) return;
      const [px, py] = pixel(e);
      let dok = tah.zaklad, text = '';
      if (tah.druh === 'velikost') {
        let lok;
        if (tah.uchyt.sz) {
          const t = parametrNaPrimce(px, py, tah.stred, tah.osaZ);
          if (t == null) return;
          lok = [0, 0, t];
        } else {
          const p = prusecikRoviny(px, py, tah.rovinaBod, tah.rovinaN);
          if (!p) return;
          lok = p.applyMatrix4(tah.inverze).toArray();
        }
        const z = M.zmenaVelikosti(tah.u0, tah.uchyt, lok, { krok: krok(e), uniform: e.shiftKey });
        dok = M.upravUzly(tah.zaklad, [tah.u0.id], z);
        text = z.rozmer.map(x => M.mm(x, 2)).join(' × ') + ' mm';
      } else if (tah.druh === 'vyska') {
        const t = parametrNaPrimce(px, py, tah.bod, tah.n);
        if (t == null || tah.t0 == null) return;
        let d = t - tah.t0;
        const k = krok(e);
        if (k) d = Math.round((tah.spodek0 + d) / k) * k - tah.spodek0;   // spodek na mřížku
        dok = M.posunUzly(tah.zaklad, tah.ids, tah.n.clone().multiplyScalar(d).toArray());
        text = 'spodek ' + M.mm(tah.spodek0 + d, 2) + ' mm';
      } else if (tah.druh === 'otoceni') {
        const a = uhelKurzoru(px, py);
        let d = a - tah.a0;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        tah.otoceni += M.rozdilUhlu(tah.posledni, d);
        tah.posledni = d;
        if (Math.hypot(px - tah.px0, py - tah.py0) > 4) tah.pohnuto = true;
        // kurzor vně úhloměru = jemně po 1°, uvnitř po 15° (Shift = 1°, Ctrl = bez přichycení)
        tah.vne = vneUhlomeru(px, py);
        const kr = e.shiftKey || tah.vne ? 1 : (e.ctrlKey ? 0 : 15);
        let st = tah.otoceni / M.st;
        if (kr) st = Math.round(st / kr) * kr;
        dok = M.otocUzly(tah.zaklad, tah.ids, tah.osa.toArray(), st, tah.stred.toArray());
        text = `${'XYZ'[tah.index]} ${M.mm(st, 1)}°`;
        kresliUhlomer(st);
      }
      M.zmenDokument(dok, '', { docasne: true });
      ukazPopisek(text, px, py);
    }

    /** Je kurzor vně úhloměru (dál od středu než 1,08 R)? Rovina z boku: podle obrazovky. */
    function vneUhlomeru(px, py) {
      const ray = S.kamera.paprsek(px, py);
      if (Math.abs(ray.direction.dot(tah.osa)) > 0.12) {
        const p = prusecikRoviny(px, py, tah.kresba, tah.osa);
        if (p) return p.distanceTo(tah.kresba) > tah.R * 1.08;
      }
      const c = S.naObrazovku(tah.kresba), r = S.naObrazovku(tah.kresba.clone().addScaledVector(tah.b1, tah.R));
      return !!(c && r) && Math.hypot(px - c[0], py - c[1]) > Math.hypot(r[0] - c[0], r[1] - c[1]) * 1.08;
    }

    function kresliUhlomer(stupne) {
      vrstvaKresby.textContent = '';
      const kruh = (R, trida) => {
        const body = [];
        for (let k = 0; k <= 96; k++) {
          const t = k / 96 * 2 * Math.PI;
          const q = S.naObrazovku(tah.kresba.clone().addScaledVector(tah.b1, R * Math.cos(t)).addScaledVector(tah.b2, R * Math.sin(t)));
          if (q) body.push(q.map(x => x.toFixed(1)).join(','));
        }
        el('polyline', { points: body.join(' '), class: trida, stroke: BARVY_OS[tah.index] }, vrstvaKresby);
      };
      kruh(tah.R, 'uhlomer');
      kruh(tah.R * 1.08, 'uhlomer vnejsi' + (tah.vne ? ' aktivni' : ''));
      // rysky po 5°, delší po 15°, nejdelší s popisem po 45° (od výchozího úhlu)
      for (let k = 0; k < 72; k++) {
        const t = tah.a0 + k * 5 * M.st, dlouha = k % 9 === 0, stredni = k % 3 === 0;
        const smer = tah.b1.clone().multiplyScalar(Math.cos(t)).addScaledVector(tah.b2, Math.sin(t));
        const a = S.naObrazovku(tah.kresba.clone().addScaledVector(smer, tah.R * (dlouha ? 0.84 : stredni ? 0.91 : 0.955)));
        const b = S.naObrazovku(tah.kresba.clone().addScaledVector(smer, tah.R));
        if (a && b) el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'ryska' + (dlouha ? ' dlouha' : ''), stroke: BARVY_OS[tah.index] }, vrstvaKresby);
        if (dlouha) {
          // popisy vně úhloměru (uvnitř by ležely přes těleso)
          const q = S.naObrazovku(tah.kresba.clone().addScaledVector(smer, tah.R * 1.2));
          const st = k * 5 > 180 ? k * 5 - 360 : k * 5;
          if (q) el('text', { x: q[0], y: q[1] + 4, class: 'stupne' }, vrstvaKresby).textContent = st + '°';
        }
      }
      const cs = S.naObrazovku(tah.kresba);
      if (cs) el('circle', { cx: cs[0], cy: cs[1], r: 3.5, class: 'stred-uhlomeru', fill: BARVY_OS[tah.index] }, vrstvaKresby);
      // výseč otočení od počátečního úhlu
      const pts = [S.naObrazovku(tah.kresba)];
      const a0 = tah.a0, n = Math.max(2, Math.ceil(Math.abs(stupne) / 5));
      for (let k = 0; k <= n; k++) {
        const t = a0 + (stupne * M.st) * k / n;
        pts.push(S.naObrazovku(tah.kresba.clone().addScaledVector(tah.b1, tah.R * Math.cos(t)).addScaledVector(tah.b2, tah.R * Math.sin(t))));
      }
      if (pts.every(Boolean)) el('polygon', { points: pts.map(p => p.join(',')).join(' '), class: 'vysec', fill: BARVY_OS[tah.index] }, vrstvaKresby);
    }

    function konec(e, zrusit = false) {
      if (!tah || (e && e.pointerId !== tah.id)) return;
      const popis = { velikost: 'Změna velikosti', vyska: 'Zvednutí', otoceni: 'Otočení' }[tah.druh];
      // klik na šipku otáčení bez tažení: zadat úhel číslem
      const zadat = !zrusit && tah.druh === 'otoceni' && !tah.pohnuto ? tah : null;
      if (zadat) zrusit = true;
      tah = null;
      M.ovladaniBlokovano = false;
      skryjPopisek();
      vrstvaKresby.textContent = '';
      if (zrusit) M.zrusUpravu(); else M.dokonciUpravu(popis);
      kresli();
      M.prekresli();
      if (zadat) zadejUhel(zadat);
    }

    /** Pole pro úhel u šipky otáčení (Enter = otočit, Esc = zpět). */
    function zadejUhel(t) {
      const plocha = svg.parentNode;
      const stare = plocha.querySelector('.zadani-uhlu');
      if (stare) stare.remove();
      const r = svg.getBoundingClientRect(), pr = plocha.getBoundingClientRect();
      const box = document.createElement('label');
      box.className = 'zadani-uhlu';
      box.style.borderColor = BARVY_OS[t.index];
      box.innerHTML = `<span>${'XYZ'[t.index]}</span><input type="text" inputmode="decimal" value="0" aria-label="Otočit kolem ${'XYZ'[t.index]} o úhel (°)"><span>°</span>`;
      box.style.left = (t.px0 + r.left - pr.left + 14) + 'px';
      box.style.top = (t.py0 + r.top - pr.top - 16) + 'px';
      plocha.appendChild(box);
      const inp = box.querySelector('input');
      inp.focus(); inp.select();
      let hotovo = false;
      let odhlasit = [];
      const zavri = () => { odhlasit.forEach(f => f()); odhlasit = []; if (box.isConnected) box.remove(); const c = S.renderer.domElement; if (document.activeElement === document.body || !document.activeElement) c.focus({ preventScroll: true }); };
      inp.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Escape') { hotovo = true; zavri(); }
        else if (e.key === 'Enter') {
          hotovo = true;
          const st = M.prectiCislo(inp.value);
          zavri();
          if (isFinite(st) && Math.abs(st) > 1e-9) M.zmenDokument(M.otocUzly(M.app.dok, t.ids, t.osa.toArray(), st, t.stred.toArray()), 'Otočení');
        }
      });
      inp.addEventListener('blur', () => { if (!hotovo) zavri(); });
      // pohled, výběr nebo režim se změnil: pole by viselo nad jiným místem – zavřít
      const zrus = () => { if (!hotovo) { hotovo = true; zavri(); } };
      const k0 = S.kamera.aktivni().matrixWorld.clone();
      odhlasit = [M.na('kamera', () => { if (!S.kamera.aktivni().matrixWorld.equals(k0)) zrus(); }), M.na('vyber', zrus), M.na('rezim', zrus)];
    }

    vrstvaUchytu.addEventListener('pointerover', e => {
      const g = e.target.closest && e.target.closest('g.oblouk');
      const i = g ? uchyty.findIndex(h => h.prvek === g) : -1;
      const n = i >= 0 ? uchyty[i].index : null;
      if (n !== najeto && !tah) { najeto = n; kresli(); }
    });
    vrstvaUchytu.addEventListener('pointerout', e => {
      if (najeto == null || tah) return;
      const g = e.target.closest && e.target.closest('g.oblouk');
      if (g && e.relatedTarget && g.contains(e.relatedTarget)) return;
      najeto = null; kresli();
    });
    vrstvaUchytu.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const h = uchyty.find(x => x.prvek === e.target || x.prvek.contains(e.target));
      if (!h) return;
      // rozepsané pole inspektoru potvrdit hned (preventDefault by mu vzal blur a hodnota by pak přepsala tažení)
      if (document.activeElement && document.activeElement.matches('input, textarea')) document.activeElement.blur();
      zacni(h, e);
    });
    document.addEventListener('pointermove', pohyb);
    document.addEventListener('pointerup', e => konec(e));
    document.addEventListener('pointercancel', e => konec(e, true));
    // druhý prst kdekoli (i když první začal na úchytu – ten do gest plátna nepočítá): tažení úchytu zrušit
    document.addEventListener('pointerdown', e => { if (tah && e.pointerType === 'touch' && e.pointerId !== tah.id) konec(null, true); }, true);
    // druhý prst (přiblížení dvěma prsty) rozdělané tažení úchytu zruší, stejně jako posun tělesa
    M.na('gesto', zacalo => { if (zacalo && tah) konec(null, true); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && tah) { konec(null, true); e.preventDefault(); e.stopPropagation(); } }, true);
    // kolečko nad úchytem má dál přibližovat
    svg.addEventListener('wheel', e => {
      S.renderer.domElement.dispatchEvent(new WheelEvent('wheel', e));
      e.preventDefault();
    }, { passive: false });
    svg.addEventListener('contextmenu', e => e.preventDefault());

    M.na('kamera', kresli);
    M.na('vyber', () => M.prekresli());
    M.na('dokument', () => M.prekresli());
    M.na('rovina', () => M.prekresli());

    return {
      svg,
      /** Úchyty pro testy: [{nazev, x, y}] v souřadnicích okna. */
      seznam() {
        const r = svg.getBoundingClientRect();
        return uchyty.map(h => {
          const b = h.prvek.getBoundingClientRect();
          let x = b.left + b.width / 2, y = b.top + b.height / 2;
          if (h.druh === 'otoceni') {          // střed čáry oblouku, ne obálky
            const cara = h.prvek.querySelector('.zasah');
            const p = cara.points.getItem(Math.floor(cara.points.numberOfItems / 2));
            x = r.left + p.x; y = r.top + p.y;
          }
          return { nazev: h.nazev, x, y };
        });
      },
      tahne: () => !!tah,
      /** Bod oblouku osy i posunutý o d stupňů od jeho středu → [x, y] v okně (pro testy). */
      bodOblouku(i, d) {
        const h = uchyty.find(x => x.nazev === 'otoceni' + i);
        if (!h) return null;
        const t = h.t0 + d * M.st;
        const q = S.naObrazovku(h.kresba.clone().addScaledVector(h.b1, h.R * Math.cos(t)).addScaledVector(h.b2, h.R * Math.sin(t)));
        const r = svg.getBoundingClientRect();
        return q && [r.left + q[0], r.top + q[1]];
      },
    };
  };
})(MDL);
