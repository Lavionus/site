/* Věšáky – 2D skicář (SVG) pro dva pohledy:
     'bok'  = profil zboku (x = vzdálenost od zdi, y = výška): ramena, vlastní obrysy p.obrysy, štítek z boku, kapsa;
     'cela' = štítek zepředu (x = do šířky, osa uprostřed): tvar štítku p.telo.vlastni, kapsa, úchyt, vruty, siluety ramen.
   Obrysy = body s Bézierovými úchyty (viz jadro.js). Nástroje: Výběr (body, úchyty, úseky, obrysy – Shift = více),
   Pero (klik = roh, tažení = hladký bod; v souměrném režimu stačí pravá polovina od osy k ose), Měření, Podklad (posun
   podkladového obrázku). Přichytávání k mřížce a k bodům, zaoblení rohu, sjednocení / rozdíl / průnik, odsazení,
   přiložení k čelu / na osu, kóty vybraného obrysu a úseku. Úpravy se během tažení kreslí z pracovní kopie a do projektu
   (historie) se zapíší po puštění myši. Úprava štítku, který není vlastní, ho nejdřív převede na vlastní tvar.
   vytvor(kontejner, cfg) – cfg: zmen(fn, klic), stav(text), kurzor(bod), nastroj(n), vyber(v, obrysy), vyberRameno(i), wasm() */
/* global VESAKY, VESAKY_VYKRES */
(function () {
  'use strict';
  const K = window.VESAKY, VK = window.VESAKY_VYKRES, fmt = K.fmt;
  const NS = 'http://www.w3.org/2000/svg';
  const n = v => (Math.round(v * 1000) / 1000).toString();
  const kopie = o => JSON.parse(JSON.stringify(o));
  const r3 = v => Math.round(v * 1000) / 1000;
  const prazdnyVyber = () => ({ ob: null, obs: [], bod: null, usek: null });

  function vytvor(kontejner, cfg) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'profil-svg'); svg.tabIndex = 0;
    svg.setAttribute('aria-label', 'Skicář věšáku – profil zboku a štítek zepředu');
    kontejner.appendChild(svg);
    const g = {}; for (const k of ['podklad', 'mrizka', 'model', 'edit', 'koty']) { g[k] = document.createElementNS(NS, 'g'); svg.appendChild(g[k]); }
    const pohledy = { bok: { cx: 40, cy: 40, s: 4, prvni: true }, cela: { cx: 0, cy: 40, s: 4, prvni: true } };
    let p = null, o = null, prac = null, tah = null, mereni = null, prichyceno = null;
    const podklady = { bok: null, cela: null };   // {src, x, y, sirka, vyska, pruhlednost} – jen v této relaci
    const st = { rezim: 'bok', nastroj: 'vyber', vyber: prazdnyVyber(), pero: null, mrizka: true, krok: 1, body: true, symetrie: true };
    const pohled = () => pohledy[st.rezim];
    const bok = () => st.rezim === 'bok';

    /* ---------- data podle pohledu ---------- */
    const pole = x => (bok() ? x.obrysy : x.telo.vlastni);
    /** Zápis do projektu; úprava štítku nejdřív převede přednastavený tvar na vlastní. */
    function zapis(fn, klic) {
      cfg.zmen(x => {
        if (!bok() && x.telo.tvar !== 'vlastni') { x.telo.vlastni = kopie(K.stitekObrysy(x)); x.telo.tvar = 'vlastni'; cfg.stav('Tvar štítku převeden na vlastní – můžete ho upravovat.'); }
        fn(pole(x), x);
      }, klic);
    }
    function zacniPraci() { prac = kopie(p ? (bok() || p.telo.tvar === 'vlastni' ? pole(p) : K.stitekObrysy(p)) : []); }
    function dokonciPraci() { if (!prac) return; const q = prac; prac = null; zapis((arr, x) => { const cil = pole(x); cil.length = 0; cil.push(...q); }, 'skica'); }
    /** Obrysy, které jde v pohledu upravovat (štítek: vlastní, nebo přednastavený jako předloha). */
    const editovatelne = () => (prac ? prac : !p ? [] : bok() ? p.obrysy : p.telo.tvar === 'vlastni' ? p.telo.vlastni : o.stitek);

    /* ---------- souřadnice ---------- */
    function velikost() { const r = svg.getBoundingClientRect(); return [Math.max(10, r.width), Math.max(10, r.height)]; }
    function nastavViewBox() {
      const [w, h] = velikost(), v = pohled();
      svg.setAttribute('viewBox', `${n(v.cx - w / 2 / v.s)} ${n(-v.cy - h / 2 / v.s)} ${n(w / v.s)} ${n(h / v.s)}`);
    }
    function mm(e) {
      const r = svg.getBoundingClientRect(), [w, h] = velikost(), v = pohled();
      return [v.cx + (e.clientX - r.left - w / 2) / v.s, v.cy - (e.clientY - r.top - h / 2) / v.s];
    }
    const px = v => v / pohled().s;
    /** Body, ke kterým se přichytává (vrcholy obrysů, rohy štítku a kapsy, kořeny ramen). */
    function bodyPrichyceni(vynech) {
      const out = [];
      editovatelne().forEach((ob, i) => ob.body.forEach((P, j) => { if (!(vynech && vynech.ob === i && (vynech.bod == null || vynech.bod === j || vynech.cely))) out.push([P.x, P.y]); }));
      if (!p) return out;
      if (bok()) {
        const D = p.telo.hloubka;
        out.push([0, o.obalStitku[1]], [0, o.obalStitku[3]], [D, o.obalStitku[1]], [D, o.obalStitku[3]]);
        for (const a of o.ramena) { const t = a.body[a.body.length - 1]; out.push([a.body[0].z, a.body[0].y], [t.z, t.y]); }
      } else {
        const b = o.obalStitku; out.push([b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]], [0, b[1]], [0, b[3]]);
      }
      return out;
    }
    /** Přichycení bodu: nejdřív k bodům (do 8 px), pak k mřížce; Alt = volně. */
    function prichyt(pt, e, vynech) {
      prichyceno = null;
      if (e && e.altKey) return [r3(pt[0]), r3(pt[1])];
      if (st.body) {
        let nej = null, dmin = 8 / pohled().s;
        for (const q of bodyPrichyceni(vynech)) { const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]); if (d < dmin) { dmin = d; nej = q; } }
        if (nej) { prichyceno = nej; return [r3(nej[0]), r3(nej[1])]; }
      }
      if (st.mrizka) return [Math.round(pt[0] / st.krok) * st.krok, Math.round(pt[1] / st.krok) * st.krok].map(r3);
      return [r3(pt[0]), r3(pt[1])];
    }
    function el(rodic, jmeno, atr, text) {
      const e = document.createElementNS(NS, jmeno);
      for (const [k, v] of Object.entries(atr)) if (v != null) e.setAttribute(k, v);
      if (text != null) e.textContent = text;
      rodic.appendChild(e); return e;
    }
    const cestaObrysu = ob => VK.cestaObrysu(ob, x => x, y => -y);

    /* ---------- kreslení ---------- */
    function kresliPodklad() {
      g.podklad.innerHTML = '';
      const pk = podklady[st.rezim];
      if (!pk) return;
      el(g.podklad, 'image', { href: pk.src, x: n(pk.x), y: n(-pk.y - pk.vyska), width: n(pk.sirka), height: n(pk.vyska), opacity: pk.pruhlednost, preserveAspectRatio: 'none', class: 'podklad-obr' });
    }
    function kresliMrizku() {
      g.mrizka.innerHTML = '';
      const [w, h] = velikost(), v = pohled(), x0 = v.cx - w / 2 / v.s, x1 = v.cx + w / 2 / v.s, y0 = v.cy - h / 2 / v.s, y1 = v.cy + h / 2 / v.s;
      for (const [k, tr] of [[1, 'm1'], [5, 'm5'], [10, 'm10']].filter(([k]) => k * v.s >= 6)) {
        let d = '';
        for (let x = Math.ceil(x0 / k) * k; x <= x1; x += k) d += `M${n(x)} ${n(-y1)}V${n(-y0)}`;
        for (let y = Math.ceil(y0 / k) * k; y <= y1; y += k) d += `M${n(x0)} ${n(-y)}H${n(x1)}`;
        el(g.mrizka, 'path', { d, class: 'mrizka ' + tr });
      }
      el(g.mrizka, 'path', { d: `M${n(x0)} 0H${n(x1)}`, class: 'osa-y0' });
      if (!bok()) el(g.mrizka, 'path', { d: `M0 ${n(-y1)}V${n(-y0)}`, class: 'osa-sym' + (st.symetrie ? ' zapnuta' : '') });
    }
    function kresliModel() {
      g.model.innerHTML = '';
      if (!p) return;
      return bok() ? modelBok() : modelCela();
    }
    function modelBok() {
      const u = p.uchyt, uch = o.uch, D = p.telo.hloubka, b = o.obalStitku;
      el(g.model, 'rect', { x: -30, y: n(-o.yMax - 400), width: 30, height: n(o.yMax - o.yMin + 800), class: 'zed' });
      p.ramena.forEach((r, i) => {
        const gr = el(g.model, 'g', { class: 'rameno', 'data-rameno': i });
        for (const poly of VK.polygonyRamene(r, o.ramena[i], p.telo)) el(gr, 'path', { d: 'M' + poly.map(([z, y]) => n(z) + ' ' + n(-y)).join('L') + 'Z' });
        el(gr, 'title', {}, `Rameno ${i + 1} – klepnutím vyberete v editoru, kořen lze táhnout nahoru/dolů`);
      });
      // štítek z boku: obal výšky, hloubka D, zkosené čelo
      const hr = Math.max(0, Math.min(p.telo.hrana, D - u.hloubka - u.vule - 0.5));
      el(g.model, 'path', { d: `M0 ${n(-b[1])}H${n(D - hr)}L${n(D)} ${n(-b[1] - hr)}V${n(-b[3] + hr)}L${n(D - hr)} ${n(-b[3])}H0Z`, class: 'telo' });
      editovatelne().forEach((ob, i) => vykresliObrys(ob, i));
      el(g.model, 'path', { d: `M0 ${n(-uch.vrchKapsy)}H${n(u.hloubka + u.vule)}V${n(-b[1] + 1)}`, class: 'skryta' });
      el(g.model, 'rect', { x: 0, y: n(-(uch.dole + u.vyska)), width: n(u.hloubka), height: n(u.vyska), class: 'uchyt' });
      for (const y of uch.srouby) el(g.model, 'path', { d: `M-12 ${n(-(y + uch.dole))}H${n(u.hloubka + 2)}`, class: 'osa' });
      p.ramena.forEach((r, i) => {
        const a = o.ramena[i];
        el(g.model, 'path', { d: 'M' + a.body.map(q => n(q.z) + ' ' + n(-q.y)).join('L'), class: 'pater' });
        el(el(g.model, 'circle', { cx: n(a.body[0].z + K.PRESAH), cy: n(-r.y), r: n(px(5)), class: 'koren', 'data-koren': i }), 'title', {}, `Kořen ramene ${i + 1} – táhněte nahoru/dolů`);
        if (a.drzi) {
          const z = a.zat, yy = z.y + z.t / 2, d = px(6);
          el(el(g.model, 'path', { d: `M${n(z.z)} ${n(-yy)}l${n(-d)} ${n(-1.6 * d)}h${n(2 * d)}Z`, class: 'zatez' }), 'title', {}, `Zátěž ${fmt(p.zatez.kg)} kg – ${fmt(a.odstup, 0)} mm od zdi`);
        }
      });
    }
    function modelCela() {
      const u = p.uchyt, uch = o.uch, W = o.sirkaRamen;
      el(g.model, 'rect', { x: -1000, y: -2000, width: 2000, height: 4000, class: 'zed-cela' });
      // siluety ramen a bočních obrysů (zepředu jen pásy dané šířky)
      o.ramena.forEach((a, i) => { const r = p.ramena[i], s = r.sirka > 0 ? r.sirka : W; el(g.model, 'rect', { x: n(r.x - s / 2), y: n(-a.yMax), width: n(s), height: n(a.yMax - a.yMin), class: 'silueta' }); });
      for (const ob of p.obrysy) if (!ob.dira) { const bb = K.obalObrysu([ob]), s = ob.sirka > 0 ? ob.sirka : W; el(g.model, 'rect', { x: n((ob.x || 0) - s / 2), y: n(-bb[3]), width: n(s), height: n(bb[3] - bb[1]), class: 'silueta' }); }
      const vl = p.telo.tvar === 'vlastni';
      editovatelne().forEach((ob, i) => vykresliObrys(ob, i, !vl && !prac));
      // kapsa (s kanálem zespodu), úchyt po dosednutí, hlavy vrutů
      const sv = uch.sirkaKapsy, y0 = o.obalStitku[1];
      el(g.model, 'path', { d: `M${n(-sv(y0))} ${n(-y0)}L${n(-sv(uch.vrchKapsy))} ${n(-uch.vrchKapsy)}H${n(sv(uch.vrchKapsy))}L${n(sv(y0))} ${n(-y0)}`, class: 'skryta' });
      const sU = y => uch.sirkaV(y) / 2;
      el(g.model, 'path', { d: `M${n(-sU(0))} ${n(-uch.dole)}L${n(-sU(u.vyska))} ${n(-uch.dole - u.vyska)}H${n(sU(u.vyska))}L${n(sU(0))} ${n(-uch.dole)}Z`, class: 'uchyt' });
      for (const y of uch.srouby) el(g.model, 'circle', { cx: 0, cy: n(-(y + uch.dole)), r: n(uch.sr.hlava / 2), class: 'vrut' });
      if (o.kryti.bok < 2 || o.kryti.vrch < 3) el(g.model, 'text', { x: 0, y: n(-uch.vrchKapsy - 6), class: 'varovani-text', 'text-anchor': 'middle', 'font-size': n(px(12)) }, 'kapsa není krytá');
    }
    function vykresliObrys(ob, i, predloha) {
      if (ob.body.length < 2) return;
      const vyb = st.vyber.ob === i || st.vyber.obs.includes(i);
      el(g.model, 'path', { d: cestaObrysu(ob), class: (ob.dira ? 'obrys-dira' : bok() ? 'obrys' : 'obrys stitek') + (vyb ? ' vybrany' : '') + (predloha ? ' predloha' : ''), 'data-ob': i, 'fill-rule': 'nonzero' });
    }
    function kresliEdit() {
      g.edit.innerHTML = ''; g.koty.innerHTML = '';
      const arrE = editovatelne();
      const v = st.vyber, ob = v.ob != null ? arrE[v.ob] : null;
      if (ob) {
        ob.body.forEach((P, i) => {
          const Q = ob.body[(i + 1) % ob.body.length], k = K.usek(ob, i);
          const d = k ? `M${n(P.x)} ${n(-P.y)}C${n(k[1][0])} ${n(-k[1][1])} ${n(k[2][0])} ${n(-k[2][1])} ${n(Q.x)} ${n(-Q.y)}` : `M${n(P.x)} ${n(-P.y)}L${n(Q.x)} ${n(-Q.y)}`;
          el(g.edit, 'path', { d, class: 'usek-hit' + (v.usek === i ? ' vybrany' : ''), 'data-usek': i });
        });
        ob.body.forEach((P, i) => {
          for (const [h, kl] of [[P.a, 'a'], [P.b, 'b']]) if (h) {
            el(g.edit, 'path', { d: `M${n(P.x)} ${n(-P.y)}l${n(h[0])} ${n(-h[1])}`, class: 'uchyt-cara' });
            el(g.edit, 'circle', { cx: n(P.x + h[0]), cy: n(-(P.y + h[1])), r: n(px(4)), class: 'uchyt-bod', 'data-bod': i, 'data-uchyt': kl });
          }
        });
        ob.body.forEach((P, i) => {
          const r = px(i === v.bod ? 6 : 4.5), cl = 'bod' + (i === v.bod ? ' vybrany' : '');
          if (P.hladky) el(g.edit, 'circle', { cx: n(P.x), cy: n(-P.y), r: n(r), class: cl, 'data-bod': i });
          else el(g.edit, 'rect', { x: n(P.x - r), y: n(-P.y - r), width: n(2 * r), height: n(2 * r), class: cl, 'data-bod': i });
        });
        kotyObrysu(ob, v.usek);
      }
      const pe = st.pero;
      if (pe && pe.body.length) {
        const t = { body: pe.body };
        let d = `M${n(pe.body[0].x)} ${n(-pe.body[0].y)}`;
        for (let i = 0; i + 1 < pe.body.length; i++) {
          const k = K.usek(t, i), Q = pe.body[i + 1];
          d += k ? `C${n(k[1][0])} ${n(-k[1][1])} ${n(k[2][0])} ${n(-k[2][1])} ${n(Q.x)} ${n(-Q.y)}` : `L${n(Q.x)} ${n(-Q.y)}`;
        }
        if (pe.kurzor) d += `L${n(pe.kurzor[0])} ${n(-pe.kurzor[1])}`;
        el(g.edit, 'path', { d, class: 'pero-cara' });
        if (!bok() && st.symetrie) el(g.edit, 'path', { d: 'M' + pe.body.map(P => n(-P.x) + ' ' + n(-P.y)).join('L'), class: 'pero-cara zrcadlo' });
        pe.body.forEach((P, i) => el(g.edit, 'rect', { x: n(P.x - px(4)), y: n(-P.y - px(4)), width: n(px(8)), height: n(px(8)), class: 'bod' + (i === 0 ? ' prvni' : '') }));
      }
      if (prichyceno && tah) el(g.edit, 'circle', { cx: n(prichyceno[0]), cy: n(-prichyceno[1]), r: n(px(8)), class: 'prichyceno' });
      if (mereni && mereni.a) {
        const [a, b] = [mereni.a, mereni.b || mereni.k || mereni.a];
        el(g.koty, 'path', { d: `M${n(a[0])} ${n(-a[1])}L${n(b[0])} ${n(-b[1])}`, class: 'mereni' });
        for (const q of [a, b]) el(g.koty, 'circle', { cx: n(q[0]), cy: n(-q[1]), r: n(px(3)), class: 'mereni-bod' });
        const dl = Math.hypot(b[0] - a[0], b[1] - a[1]), uh = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
        stitek((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, `${fmt(dl, 2)} mm · ${fmt(uh, 1)}° · Δx ${fmt(b[0] - a[0], 1)} Δy ${fmt(b[1] - a[1], 1)}`);
      }
      cfg.vyber && cfg.vyber(st.vyber, arrE);
    }
    /** Body jednoho úseku i (bez návratu): úsečka = 2 body, křivka = vzorky. */
    function vzorkyUseku(ob, i, n = 60) {
      const P = ob.body[i], Q = ob.body[(i + 1) % ob.body.length], k = K.usek(ob, i);
      if (!k) return [[P.x, P.y], [Q.x, Q.y]];
      const out = [];
      for (let j = 0; j <= n; j++) { const t = j / n, u = 1 - t; out.push([0, 1].map(c => u * u * u * k[0][c] + 3 * u * u * t * k[1][c] + 3 * u * t * t * k[2][c] + t * t * t * k[3][c])); }
      return out;
    }
    /** Popisek s pozadím ve výkresu (v mm, velikost písma stálá na obrazovce). */
    function stitek(x, y, text) {
      const t = el(g.koty, 'text', { x: n(x), y: n(-y - px(8)), 'font-size': n(px(11)), 'text-anchor': 'middle', class: 'kota-text' }, text);
      try { const bb = t.getBBox(); g.koty.insertBefore(el(g.koty, 'rect', { x: n(bb.x - px(3)), y: n(bb.y - px(1)), width: n(bb.width + px(6)), height: n(bb.height + px(2)), class: 'kota-pozadi' }), t); } catch (e) { /* bez rozvržení */ }
    }
    function kotyObrysu(ob, usek) {
      const b = K.obalObrysu([ob]);
      el(g.koty, 'rect', { x: n(b[0]), y: n(-b[3]), width: n(b[2] - b[0]), height: n(b[3] - b[1]), class: 'obal' });
      stitek((b[0] + b[2]) / 2, b[3], `${fmt(b[2] - b[0], 1)} × ${fmt(b[3] - b[1], 1)} mm`);
      if (usek != null) {
        const P = ob.body[usek], Q = ob.body[(usek + 1) % ob.body.length], k = K.usek(ob, usek);
        let delka = 0;
        const pts = vzorkyUseku(ob, usek, 200);
        for (let i = 0; i + 1 < pts.length; i++) delka += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        stitek((P.x + Q.x) / 2, (P.y + Q.y) / 2, `${k ? 'křivka' : 'úsečka'} ${fmt(delka, 2)} mm`);
      }
    }
    function kresli(np, no) {
      if (np) { p = np; o = no; }
      if (!p) return;
      const arr = editovatelne();
      if (st.vyber.ob != null && !arr[st.vyber.ob]) st.vyber = prazdnyVyber();
      st.vyber.obs = st.vyber.obs.filter(i => arr[i]);
      if (pohled().prvni && svg.getBoundingClientRect().width > 20) { cele(); return; }
      nastavViewBox(); kresliPodklad(); kresliMrizku(); kresliModel(); kresliEdit();
    }
    function cele() {
      if (!o) return;
      const [w, h] = velikost(), v = pohled();
      let x0, x1;
      if (bok()) { x0 = -6; x1 = o.zMax + 6; } else { const s = Math.max(o.obalStitku[2], o.sirkaRamen / 2) + 8; x0 = -s; x1 = s; }
      const y0 = o.yMin - 8, y1 = o.yMax + 8;
      v.s = Math.max(0.5, Math.min(40, Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.92));
      v.cx = (x0 + x1) / 2; v.cy = (y0 + y1) / 2; v.prvni = false; v.rucne = false;
      nastavViewBox(); kresliPodklad(); kresliMrizku(); kresliModel(); kresliEdit();
    }
    // dokud uživatel nepřibližoval ani neposouval, změna velikosti panelu ukáže vše
    new ResizeObserver(() => requestAnimationFrame(() => { if (!pohled().rucne && o && svg.getBoundingClientRect().width > 20) cele(); else kresli(); })).observe(svg);

    /* ---------- geometrické operace ---------- */
    function vlozBod(ob, i, t) {
      const k = K.usek(ob, i), P = ob.body[i], Q = ob.body[(i + 1) % ob.body.length];
      let novy;
      if (!k) novy = { x: r3(P.x + (Q.x - P.x) * t), y: r3(P.y + (Q.y - P.y) * t), a: null, b: null, hladky: false };
      else {
        const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const p01 = L(k[0], k[1]), p12 = L(k[1], k[2]), p23 = L(k[2], k[3]), a = L(p01, p12), b = L(p12, p23), m = L(a, b);
        P.b = [p01[0] - P.x, p01[1] - P.y]; Q.a = [p23[0] - Q.x, p23[1] - Q.y];
        novy = { x: r3(m[0]), y: r3(m[1]), a: [a[0] - m[0], a[1] - m[1]], b: [b[0] - m[0], b[1] - m[1]], hladky: true };
      }
      ob.body.splice(i + 1, 0, novy);
      return i + 1;
    }
    function nejblizsiT(ob, i, bod) {
      let nej = 0.5, dmin = Infinity;
      const kus = vzorkyUseku(ob, i, 80);
      if (kus.length === 2) {   // úsečka: kolmý průmět
        const [a, b] = kus, dx = b[0] - a[0], dy = b[1] - a[1];
        nej = ((bod[0] - a[0]) * dx + (bod[1] - a[1]) * dy) / ((dx * dx + dy * dy) || 1);
      } else kus.forEach((q, j) => { const d = Math.hypot(q[0] - bod[0], q[1] - bod[1]); if (d < dmin) { dmin = d; nej = j / (kus.length - 1); } });
      return Math.min(0.98, Math.max(0.02, nej));
    }
    function prepniHladky(ob, i) {
      const P = ob.body[i], A = ob.body[(i - 1 + ob.body.length) % ob.body.length], B = ob.body[(i + 1) % ob.body.length];
      if (P.hladky) { P.hladky = false; P.a = null; P.b = null; return; }
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, la = Math.hypot(P.x - A.x, P.y - A.y) / 3, lb = Math.hypot(B.x - P.x, B.y - P.y) / 3;
      P.hladky = true; P.a = [-dx / L * la, -dy / L * la]; P.b = [dx / L * lb, dy / L * lb];
    }
    function prepniUsek(ob, i) {
      const P = ob.body[i], Q = ob.body[(i + 1) % ob.body.length];
      if (P.b || Q.a) { P.b = null; Q.a = null; P.hladky = false; Q.hladky = false; return; }
      P.b = [(Q.x - P.x) / 3, (Q.y - P.y) / 3]; Q.a = [(P.x - Q.x) / 3, (P.y - Q.y) / 3];
    }
    /** Zaoblení rohu i poloměrem r: roh nahradí dva body s úchyty (čtvrtkruh u pravého úhlu). */
    function zaobli(ob, i, r) {
      const N = ob.body.length, V = ob.body[i], A = ob.body[(i - 1 + N) % N], B = ob.body[(i + 1) % N];
      const sm = (h, Q) => { const d = h ? h : [Q.x - V.x, Q.y - V.y], l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l, Math.hypot(Q.x - V.x, Q.y - V.y)]; };
      const ua = sm(V.a, A), ub = sm(V.b, B), ra = Math.min(r, ua[2] / 2), rb = Math.min(r, ub[2] / 2);
      const uhel = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1])));
      const k = 4 / 3 * Math.tan((Math.PI - uhel) / 4);   // délka úchytu oblouku (pro 90° = 0,5523)
      const P1 = { x: r3(V.x + ua[0] * ra), y: r3(V.y + ua[1] * ra), a: V.a ? [V.a[0] - ua[0] * ra, V.a[1] - ua[1] * ra] : null, b: [-ua[0] * ra * k, -ua[1] * ra * k], hladky: false };
      const P2 = { x: r3(V.x + ub[0] * rb), y: r3(V.y + ub[1] * rb), a: [-ub[0] * rb * k, -ub[1] * rb * k], b: V.b ? [V.b[0] - ub[0] * rb, V.b[1] - ub[1] * rb] : null, hladky: false };
      ob.body.splice(i, 1, P1, P2);
    }
    function transformuj(ob, f, fu, stred) {
      const b = K.obalObrysu([ob]), cx = stred ? stred[0] : (b[0] + b[2]) / 2, cy = stred ? stred[1] : (b[1] + b[3]) / 2;
      for (const P of ob.body) {
        const [x, y] = f(P.x - cx, P.y - cy); P.x = r3(x + cx); P.y = r3(y + cy);
        if (P.a) P.a = fu(P.a).map(r3); if (P.b) P.b = fu(P.b).map(r3);
      }
    }
    /** Výsledek booleovské operace / odsazení (CrossSection) → obrysy (úsečky, Douglas–Peucker 0,02 mm). */
    function zCs(cs) {
      const out = [];
      for (const pp of cs.toPolygons()) {
        const poly = pp.map(b => (Array.isArray(b) ? b : [b.x, b.y]));   // sestavení se liší: pole nebo {x, y}
        let A = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; A += a[0] * b[1] - b[0] * a[1]; }
        const body = K.zjednodusUzavreny(poly, 0.02);
        if (body.length >= 3 && Math.abs(A) > 0.02) out.push({ dira: A < 0, sirka: 0, nazev: '', body: body.map(([x, y]) => ({ x: r3(x), y: r3(y), a: null, b: null, hladky: false })) });
      }
      return out;
    }
    const vybraneObrysy = () => { const v = st.vyber, s = new Set(v.obs); if (v.ob != null) s.add(v.ob); return [...s].sort((a, b) => a - b); };
    const potrebaObrys = () => { if (st.vyber.ob == null) { cfg.stav('Vyberte obrys.'); return false; } return true; };
    const akce = {
      hladky() { const v = st.vyber; if (v.ob == null || v.bod == null) return cfg.stav('Vyberte bod.'); zapis(a => prepniHladky(a[v.ob], v.bod), 'skica-h'); },
      usek() { const v = st.vyber; if (v.ob == null || v.usek == null) return cfg.stav('Vyberte úsek (klepněte na čáru obrysu).'); zapis(a => prepniUsek(a[v.ob], v.usek), 'skica-u'); },
      dira() { if (!potrebaObrys()) return; const v = st.vyber; zapis(a => { a[v.ob].dira = !a[v.ob].dira; }, 'skica-d'); },
      smaz() {
        const v = st.vyber; if (v.ob == null) return;
        if (v.bod != null && editovatelne()[v.ob].body.length > 3) { zapis(a => a[v.ob].body.splice(v.bod, 1), 'skica-s'); st.vyber.bod = null; }
        else { const sm = vybraneObrysy(); zapis(a => { for (const i of sm.reverse()) a.splice(i, 1); }, 'skica-s'); st.vyber = prazdnyVyber(); }
      },
      zrcadliX() { if (!potrebaObrys()) return; for (const i of vybraneObrysy()) zapis(a => transformuj(a[i], (x, y) => [-x, y], h => [-h[0], h[1]], bok() ? null : [0, 0]), 'skica-t'); },
      zrcadliY() { if (!potrebaObrys()) return; for (const i of vybraneObrysy()) zapis(a => transformuj(a[i], (x, y) => [x, -y], h => [h[0], -h[1]]), 'skica-t'); },
      otoc(stupne) {
        if (!potrebaObrys()) return;
        const c = Math.cos(stupne * Math.PI / 180), s = Math.sin(stupne * Math.PI / 180), R = (x, y) => [x * c - y * s, x * s + y * c];
        for (const i of vybraneObrysy()) zapis(a => transformuj(a[i], R, h => R(h[0], h[1])), 'skica-t');
      },
      meritko(k) { if (!potrebaObrys() || !(k > 0)) return; for (const i of vybraneObrysy()) zapis(a => transformuj(a[i], (x, y) => [x * k, y * k], h => [h[0] * k, h[1] * k]), 'skica-t'); },
      kopie() {
        if (!potrebaObrys()) return;
        if (editovatelne().length >= K.MAX_OBRYSU) return cfg.stav(`Nejvýš ${K.MAX_OBRYSU} obrysů.`);
        const i = st.vyber.ob;
        zapis(a => { const q = kopie(a[i]); for (const P of q.body) { P.x += 5; P.y -= 5; } a.push(q); }, 'skica-k');
        st.vyber = Object.assign(prazdnyVyber(), { ob: editovatelne().length - 1 }); kresli();
      },
      pridej(ob) {
        if (editovatelne().length >= K.MAX_OBRYSU && (bok() || p.telo.tvar === 'vlastni')) return cfg.stav(`Nejvýš ${K.MAX_OBRYSU} obrysů.`);
        zapis(a => { a.push(ob); }, 'skica-n');
        st.vyber = Object.assign(prazdnyVyber(), { ob: editovatelne().length - 1 }); kresli();
      },
      obdelnik() {
        const B = (x, y) => ({ x, y, a: null, b: null, hladky: false });
        const x0 = bok() ? p.telo.hloubka - 2 : -10, y0 = (o.obalStitku[1] + o.obalStitku[3]) / 2 - 5, w = bok() ? 30 : 20;
        akce.pridej({ dira: !bok(), sirka: 0, nazev: '', body: [B(x0, y0), B(x0 + w, y0), B(x0 + w, y0 + 10), B(x0, y0 + 10)] });
      },
      kruh() { const q = K.kruhObrys(bok() ? p.telo.hloubka + 15 : 0, (o.obalStitku[1] + o.obalStitku[3]) / 2 + (bok() ? 0 : 15), bok() ? 8 : 4); q.dira = !bok(); akce.pridej(q); },
      souradnice(osa, h) { const v = st.vyber; if (v.ob == null || v.bod == null || !Number.isFinite(h)) return; zapis(a => { a[v.ob].body[v.bod][osa] = h; }, 'skica-c' + osa); },
      zaobli(r) {
        const v = st.vyber; if (v.ob == null || v.bod == null) return cfg.stav('Vyberte rohový bod.');
        if (!(r > 0)) return;
        zapis(a => zaobli(a[v.ob], v.bod, r), 'skica-z'); st.vyber.bod = null;
      },
      /** Sjednocení / rozdíl (první minus ostatní) / průnik vybraných obrysů. */
      bool(druh) {
        const w = cfg.wasm && cfg.wasm(), sel = vybraneObrysy();
        if (!w) return cfg.stav('Geometrické jádro se ještě načítá.');
        if (sel.length < 2) return cfg.stav('Vyberte aspoň dva obrysy (Shift + klepnutí).');
        const arr = editovatelne(), CS = w.CrossSection, smaz = [];
        // díry: operace nad samými dírami dá díru; rozdíl dědí druh prvního obrysu; smíšené sjednocení / průnik nedává smysl
        const diry = sel.map(i => arr[i].dira), vse = diry.every(Boolean), zadna = !diry.some(Boolean);
        if (!vse && !zadna && druh !== 'odecti') return cfg.stav('Nejde spojit plný obrys s dírou – vyberte jen plné, nebo jen díry (rozdíl jde vždy).');
        const otoc = druh === 'odecti' ? arr[sel[0]].dira : vse;
        try {
          const c = sel.map(i => { const x = new CS([K.obrysNaBody(arr[i])], 'NonZero'); smaz.push(x); return x; });
          let vys;
          if (druh === 'sjednot') vys = CS.union(c);
          else if (druh === 'odecti') { const ost = CS.union(c.slice(1)); smaz.push(ost); vys = c[0].subtract(ost); }
          else vys = CS.intersection(c);
          smaz.push(vys);
          const nove = zCs(vys);
          if (!nove.length) return cfg.stav('Výsledek je prázdný.');
          if (otoc) nove.forEach(x => { x.dira = !x.dira; });
          zapis(a => { for (const i of sel.slice().reverse()) a.splice(i, 1); a.push(...nove); }, 'skica-b');
          st.vyber = Object.assign(prazdnyVyber(), { ob: editovatelne().length - nove.length });
          cfg.stav(`Hotovo: ${nove.length} ${nove.length === 1 ? 'obrys' : 'obrysy'} (křivky převedeny na lomenou čáru).`); kresli();
        } finally { for (const x of smaz) try { x.delete(); } catch (e) { /* už uvolněno */ } }
      },
      odsad(d, ponechat) {
        const w = cfg.wasm && cfg.wasm(); if (!w) return cfg.stav('Geometrické jádro se ještě načítá.');
        if (!potrebaObrys() || !Number.isFinite(d) || !d) return;
        const i = st.vyber.ob, c = new w.CrossSection([K.obrysNaBody(editovatelne()[i])], 'NonZero'), q = c.offset(d, 'Round', 2, 48);
        const nove = zCs(q); c.delete(); q.delete();
        if (!nove.length) return cfg.stav('Po odsazení nic nezbylo.');
        nove.forEach(x => { x.dira = editovatelne()[i].dira; });
        zapis(a => { if (!ponechat) a.splice(i, 1); a.push(...nove); }, 'skica-o');
        st.vyber = prazdnyVyber(); kresli();
      },
      /** Bok: přiložit k čelu štítku (levý okraj 1,5 mm v čele); čelo: vystředit na osu. */
      prilozit() {
        if (!potrebaObrys()) return;
        const sel = vybraneObrysy(), b = K.obalObrysu(sel.map(i => editovatelne()[i]));
        const dx = bok() ? p.telo.hloubka - 1.5 - b[0] : -(b[0] + b[2]) / 2;
        zapis(a => { for (const i of sel) for (const P of a[i].body) P.x = r3(P.x + dx); }, 'skica-p');
      },
      vyberVse() { st.vyber = Object.assign(prazdnyVyber(), { obs: editovatelne().map((_, i) => i), ob: editovatelne().length ? 0 : null }); kresli(); },
    };

    /* ---------- pero ---------- */
    function peroUzavri() {
      const pe = st.pero; st.pero = null;
      if (!pe) return kresliEdit();
      let body = pe.body;
      // souměrné kreslení štítku: od osy k ose → doplnit zrcadlovou polovinu
      if (!bok() && st.symetrie && body.length >= 2 && Math.abs(body[0].x) < 0.6 && Math.abs(body[body.length - 1].x) < 0.6) {
        body[0].x = 0; body[body.length - 1].x = 0;
        const zr = body.slice(1, -1).reverse().map(P => ({ x: -P.x, y: P.y, a: P.b ? [-P.b[0], P.b[1]] : null, b: P.a ? [-P.a[0], P.a[1]] : null, hladky: P.hladky }));
        body = body.concat(zr);
      }
      if (body.length < 3) { kresliEdit(); return cfg.stav('Obrys potřebuje aspoň 3 body.'); }
      akce.pridej({ dira: false, sirka: 0, nazev: '', body });
      cfg.stav(`Obrys uzavřen (${body.length} bodů).`);
    }

    /* ---------- myš ---------- */
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const v = pohled(), [x, y] = mm(e), s = Math.max(0.5, Math.min(60, v.s * Math.exp(-e.deltaY * 0.0015))), q = v.s / s;
      v.rucne = true;
      v.cx = x + (v.cx - x) * q; v.cy = y + (v.cy - y) * q; v.s = s;
      kresli();
    }, { passive: false });
    svg.addEventListener('contextmenu', e => e.preventDefault());
    svg.addEventListener('pointerdown', e => {
      svg.focus({ preventScroll: true });
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
      const t = e.target, bod = mm(e), v = pohled();
      const posun = () => { tah = { druh: 'posun', x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy }; svg.classList.add('posouvam'); };
      if (e.button === 1 || e.button === 2) return posun();
      if (st.nastroj === 'mereni') {
        const q = prichyt(bod, e);
        if (!mereni || mereni.b) mereni = { a: q, b: null }; else mereni.b = q;
        tah = { druh: 'mereni' }; kresliEdit(); return;
      }
      if (st.nastroj === 'podklad') {
        const pk = podklady[st.rezim]; if (!pk) { cfg.stav('Nejdřív načtěte podkladový obrázek.'); return posun(); }
        tah = { druh: 'podklad', start: bod, x: pk.x, y: pk.y }; return;
      }
      if (st.nastroj === 'pero') {
        if (!st.pero) st.pero = { body: [] };
        const pe = st.pero, P0 = pe.body[0];
        if (P0 && pe.body.length >= 3 && Math.hypot(P0.x - bod[0], P0.y - bod[1]) * v.s < 9) { peroUzavri(); return; }
        const q = prichyt(bod, e), novy = { x: q[0], y: q[1], a: null, b: null, hladky: false };
        pe.body.push(novy);
        tah = { druh: 'pero', bod: novy, x0: novy.x, y0: novy.y };
        kresliEdit(); return;
      }
      const ob = t.closest('[data-ob]'), bodEl = t.closest('[data-bod]'), usekEl = t.closest('[data-usek]'), koren = t.closest('[data-koren]'), ram = t.closest('[data-rameno]');
      if (bodEl && st.vyber.ob != null) {
        const i = +bodEl.dataset.bod;
        st.vyber.bod = i; st.vyber.usek = null; zacniPraci();
        const P = prac[st.vyber.ob].body[i];
        // souměrný partner (jen štítek): bod v zrcadlové poloze
        let partner = -1;
        if (!bok() && st.symetrie) partner = prac[st.vyber.ob].body.findIndex((Q, j) => j !== i && Math.hypot(Q.x + P.x, Q.y - P.y) < 0.6);
        tah = { druh: bodEl.dataset.uchyt ? 'uchyt' : 'bod', i, kl: bodEl.dataset.uchyt, start: bod, P: kopie(P), partner, naOse: Math.abs(P.x) < 0.3 };
      } else if (usekEl) {
        st.vyber.usek = +usekEl.dataset.usek; st.vyber.bod = null; kresliEdit();
        if (e.detail >= 2) {
          const oi = st.vyber.ob, i = st.vyber.usek;
          let nove = 0;
          zapis(a => { nove = vlozBod(a[oi], i, nejblizsiT(a[oi], i, bod)); }, 'skica-v');
          st.vyber.bod = nove; st.vyber.usek = null; kresli();
        }
      } else if (koren && bok()) {
        tah = { druh: 'koren', i: +koren.dataset.koren, y0: p.ramena[+koren.dataset.koren].y, start: bod };
      } else if (ob) {
        const i = +ob.dataset.ob;
        if (e.shiftKey) {
          const s = new Set(st.vyber.obs); if (st.vyber.ob != null) s.add(st.vyber.ob);
          if (s.has(i)) s.delete(i); else s.add(i);
          st.vyber = Object.assign(prazdnyVyber(), { obs: [...s], ob: s.size ? (s.has(i) ? i : [...s][0]) : null });
          kresliModel(); kresliEdit(); return;
        }
        if (!st.vyber.obs.includes(i)) st.vyber = Object.assign(prazdnyVyber(), { ob: i, obs: [i] }); else { st.vyber.ob = i; st.vyber.bod = null; st.vyber.usek = null; }
        zacniPraci();
        tah = { druh: 'obrys', start: bod, puv: kopie(prac), sel: vybraneObrysy() };
        kresliModel(); kresliEdit();
      } else if (ram) {
        cfg.vyberRameno && cfg.vyberRameno(+ram.dataset.rameno);
        st.vyber = prazdnyVyber(); kresliEdit(); posun();
      } else { st.vyber = prazdnyVyber(); kresliModel(); kresliEdit(); posun(); }
    });
    svg.addEventListener('pointermove', e => {
      const bod = mm(e), v = pohled();
      cfg.kurzor && cfg.kurzor(bod, st.rezim);
      if (st.pero && !tah) { st.pero.kurzor = prichyt(bod, e); kresliEdit(); }
      if (st.nastroj === 'mereni' && mereni && !mereni.b) { mereni.k = prichyt(bod, e); kresliEdit(); }
      if (!tah) return;
      if (tah.druh === 'posun') { v.rucne = true; v.cx = tah.cx - (e.clientX - tah.x) / v.s; v.cy = tah.cy + (e.clientY - tah.y) / v.s; nastavViewBox(); kresliMrizku(); return; }
      if (tah.druh === 'mereni') return;
      if (tah.druh === 'podklad') { const pk = podklady[st.rezim]; pk.x = r3(tah.x + bod[0] - tah.start[0]); pk.y = r3(tah.y + bod[1] - tah.start[1]); kresliPodklad(); return; }
      if (tah.druh === 'pero') {
        const dx = bod[0] - tah.x0, dy = bod[1] - tah.y0;
        if (Math.hypot(dx, dy) * v.s > 4) { tah.bod.hladky = true; tah.bod.b = [dx, dy]; tah.bod.a = [-dx, -dy]; }
        kresliEdit(); return;
      }
      if (tah.druh === 'koren') {
        const y = prichyt([0, tah.y0 + bod[1] - tah.start[1]], e)[1];
        tah.y = y; cfg.stav(`Kořen ramene ${tah.i + 1}: výška ${fmt(y)} mm`);
        const q = kopie(p); q.ramena[tah.i].y = y; const qp = K.normalizuj(q).p, pp = p, po = o;
        p = qp; o = K.odvozene(qp); kresliModel(); p = pp; o = po;
        return;
      }
      if (tah.druh === 'obrys') {
        const ref = tah.puv[tah.sel[0]].body[0], q = prichyt([ref.x + bod[0] - tah.start[0], ref.y + bod[1] - tah.start[1]], e, { ob: tah.sel[0], cely: true });
        const dx = q[0] - ref.x, dy = q[1] - ref.y;
        for (const i of tah.sel) prac[i].body.forEach((P, j) => { P.x = r3(tah.puv[i].body[j].x + dx); P.y = r3(tah.puv[i].body[j].y + dy); });
      } else if (tah.druh === 'bod') {
        const ob = prac[st.vyber.ob], P = ob.body[tah.i];
        const q = prichyt([tah.P.x + bod[0] - tah.start[0], tah.P.y + bod[1] - tah.start[1]], e, { ob: st.vyber.ob, bod: tah.i });
        P.x = tah.naOse && !bok() && st.symetrie ? 0 : q[0]; P.y = q[1];
        if (tah.partner >= 0) { const Q = ob.body[tah.partner]; Q.x = -P.x; Q.y = P.y; }
        cfg.stav(`Bod ${tah.i + 1}: x ${fmt(P.x, 2)} · y ${fmt(P.y, 2)} mm`);
      } else if (tah.druh === 'uchyt') {
        const ob = prac[st.vyber.ob], P = ob.body[tah.i];
        let h = [bod[0] - P.x, bod[1] - P.y];
        if (e.shiftKey) { const a = Math.round(Math.atan2(h[1], h[0]) / (Math.PI / 12)) * Math.PI / 12, L = Math.hypot(h[0], h[1]); h = [L * Math.cos(a), L * Math.sin(a)]; }
        P[tah.kl] = h;
        const druhy = tah.kl === 'a' ? 'b' : 'a';
        if (P.hladky && P[druhy]) { const L = Math.hypot(P[druhy][0], P[druhy][1]), l = Math.hypot(h[0], h[1]) || 1; P[druhy] = [-h[0] / l * L, -h[1] / l * L]; }
        if (tah.partner >= 0) { const Q = ob.body[tah.partner]; Q.a = P.b ? [-P.b[0], P.b[1]] : null; Q.b = P.a ? [-P.a[0], P.a[1]] : null; }
      }
      kresliModel(); kresliEdit();
    });
    const konec = () => {
      if (!tah) return;
      svg.classList.remove('posouvam');
      const t = tah; tah = null; prichyceno = null;
      if (t.druh === 'koren') { if (t.y != null && t.y !== t.y0) zapis((a, x) => { x.ramena[t.i].y = t.y; }, 'skica-r'); else kresli(); return; }
      if (t.druh === 'mereni') { kresliEdit(); return; }
      if (t.druh === 'podklad') { cfg.podklad && cfg.podklad(st.rezim, podklady[st.rezim]); return; }
      if (t.druh === 'pero' || t.druh === 'posun') return;
      dokonciPraci();
    };
    svg.addEventListener('pointerup', konec); svg.addEventListener('pointercancel', konec);
    svg.addEventListener('dblclick', e => { if (st.nastroj === 'pero') { e.preventDefault(); if (st.pero && st.pero.body.length > 3) st.pero.body.pop(); peroUzavri(); } });
    svg.addEventListener('keydown', e => {
      const k = e.key, kl = k.toLowerCase();
      if (k === 'Escape') { if (st.pero) st.pero = null; else if (mereni) mereni = null; else st.vyber = prazdnyVyber(); kresli(); }
      else if (k === 'Enter' && st.pero) peroUzavri();
      else if ((k === 'Delete' || k === 'Backspace') && st.pero) { st.pero.body.pop(); kresliEdit(); }
      else if (k === 'Delete' || k === 'Backspace') akce.smaz();
      else if ((e.ctrlKey || e.metaKey) && kl === 'a') akce.vyberVse();
      else if ((e.ctrlKey || e.metaKey) && kl === 'd') akce.kopie();
      else if (e.ctrlKey || e.metaKey || e.altKey) return;
      else if (kl === 'v') nastroj('vyber');
      else if (kl === 'p') nastroj('pero');
      else if (kl === 'm') nastroj('mereni');
      else if (kl === 'f') cele();
      else if (kl === 's' && !bok()) { st.symetrie = !st.symetrie; cfg.symetrie && cfg.symetrie(st.symetrie); kresli(); }
      else if (k.startsWith('Arrow') && st.vyber.ob != null) {
        const d = (e.shiftKey ? 5 : 1) * (k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : 1), osa = k === 'ArrowLeft' || k === 'ArrowRight' ? 'x' : 'y', vv = st.vyber, sel = vybraneObrysy();
        zapis(a => { for (const i of sel) for (const P of vv.bod != null && i === vv.ob ? [a[i].body[vv.bod]] : vv.bod != null ? [] : a[i].body) P[osa] = r3(P[osa] + d); }, 'skica-sip');
      } else return;
      e.preventDefault(); e.stopPropagation();
    });

    const NAPOVEDA = {
      vyber: 'Výběr: táhněte body, úchyty (Shift = po 15°) nebo obrysy; Shift + klepnutí = více obrysů; dvojklik na čáru vloží bod; šipky posouvají; Alt = bez přichycení.',
      pero: 'Pero: klepnutí = rohový bod, tažení = hladký bod, klepnutí na první bod nebo Enter = uzavřít, Backspace = zpět o bod, Esc = zrušit.',
      mereni: 'Měření: klepněte na dva body (přichytávají se k vrcholům) – délka, úhel a rozdíly souřadnic.',
      podklad: 'Podklad: táhněte podkladový obrázek na místo; velikost a průhlednost nastavíte v liště.',
    };
    function nastroj(nz) {
      st.nastroj = nz; if (nz !== 'pero') st.pero = null; if (nz !== 'mereni') mereni = null;
      svg.dataset.nastroj = nz;
      cfg.nastroj && cfg.nastroj(nz);
      let t = NAPOVEDA[nz];
      if (nz === 'pero' && !bok() && st.symetrie) t = 'Pero souměrně: nakreslete pravou polovinu od osy k ose a uzavřete Enterem – levá se doplní. ' + t;
      cfg.stav(t);
      kresliEdit();
    }
    function rezim(r) {
      if (r === st.rezim) return;
      st.rezim = r; st.vyber = prazdnyVyber(); st.pero = null; mereni = null; prac = null;
      kresli();
    }
    function podklad(r, data) { podklady[r] = data; if (r === st.rezim) kresliPodklad(); }
    return { kresli, cele, nastroj, rezim, podklad, akce, st, svg, get pracuje() { return !!tah; }, get podklady() { return podklady; } };
  }
  window.VESAKY_PROFIL = { vytvor };
})();
