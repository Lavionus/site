/* Modelář 3D – kóty posunu při přetahování: během posunu těles myší kóty od původní polohy
   (střed spodku obálky před tahem, označený křížkem) k aktuální – zvlášť ve směru X a Y
   (v pracovní rovině U a V), s posunem se znaménkem. Čáry a obrys štítku mají barvu osy jako kóty
   velikosti (ui/koty.js), štítek je ale světlý a čáry čárkované, ať se kóty nepletou. Štítky se při
   malém posunu navzájem (i s křížkem původní polohy) nepřekrývají – odsunou se kolmo od kóty.
   Data posunu dává vyber.js (M.tahPosunu). Kreslí se do vlastní SVG vrstvy nad plátnem (styl kót
   z ui/koty.js), po puštění zmizí. Jdou vypnout v nabídce Pohled – pak u kurzoru zůstane jen popisek. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const KLIC = 'modelar_rychleKoty';
  const BARVY = ['#e5533c', '#3cae5c'];          // osa X / Y – stejně jako kóty velikosti
  const SVETLE = ['#fde4df', '#ddf3e3'];         // světlá výplň štítku (kóty velikosti mají tmavou)

  M.vytvorRychleKoty = function (S) {
    const plocha = document.getElementById('plocha');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'koty-vrstva rychle-koty');
    svg.setAttribute('aria-hidden', 'true');
    plocha.appendChild(svg);
    let zapnuto = true;
    try { zapnuto = localStorage.getItem(KLIC) !== '0'; } catch (e) { /* bez úložiště */ }
    let posledni = [];
    const el = (jmeno, atr, rodic) => { const e = document.createElementNS(NS, jmeno); for (const [k, v] of Object.entries(atr)) e.setAttribute(k, v); rodic.appendChild(e); return e; };
    const V3 = a => new THREE.Vector3(...a);

    /** Kóta ze světového bodu a do b (čáry hned); štítek vrací k rozmístění {x, y, w, h, nx, ny, txt, osa}. */
    function kota(a, b, txt, osa, g) {
      const barva = BARVY[osa];
      const A = S.naObrazovku(V3(a)), B = S.naObrazovku(V3(b));
      if (!A || !B) return;
      const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
      el('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], class: 'kotovaci posunova', stroke: barva }, g);
      if (l > 16) {
        const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
        for (const [P, s] of [[A, 1], [B, -1]]) el('path', { d: `M${P[0]},${P[1]} l${(s * ux * 7 + nx * 3).toFixed(1)},${(s * uy * 7 + ny * 3).toFixed(1)} M${P[0]},${P[1]} l${(s * ux * 7 - nx * 3).toFixed(1)},${(s * uy * 7 - ny * 3).toFixed(1)}`, class: 'kotovaci', stroke: barva }, g);
        // vynášecí čárky na koncích kolmo ke kótě
        for (const P of [A, B]) el('line', { x1: P[0] - nx * 6, y1: P[1] - ny * 6, x2: P[0] + nx * 6, y2: P[1] + ny * 6, class: 'kotovaci', stroke: barva }, g);
      }
      const nl = l > 1e-6 ? [-dy / l, dx / l] : [0, -1];
      return { x: (A[0] + B[0]) / 2, y: (A[1] + B[1]) / 2, w: txt.length * 7 + 10, h: 18, nx: nl[0], ny: nl[1], txt, osa };
    }
    /** Štítky bez překryvu: výchozí místo kousek od středu kóty, při srážce s jiným štítkem nebo křížkem
        se posouvá kolmo od kóty (na stranu dál od překážky) po 4 px. */
    function rozmistiStitky(stitky, prekazky, g) {
      const hotove = prekazky.slice();
      const srazi = (s, x, y) => hotove.some(o => Math.abs(x - o.x) < (s.w + o.w) / 2 + 3 && Math.abs(y - o.y) < (s.h + o.h) / 2 + 3);
      for (const s of stitky) {
        // výchozí strana: nad kótou (na obrazovce nahoru), pak od překážek
        let zn = s.ny <= 0 ? 1 : -1, x = s.x + s.nx * 14 * zn, y = s.y + s.ny * 14 * zn;
        const blizka = hotove.reduce((m, o) => (!m || Math.hypot(o.x - s.x, o.y - s.y) < Math.hypot(m.x - s.x, m.y - s.y) ? o : m), null);
        if (blizka && srazi(s, x, y)) {
          // strana normály dál od nejbližší překážky
          zn = ((s.x - blizka.x) * s.nx + (s.y - blizka.y) * s.ny) >= 0 ? 1 : -1;
          x = s.x + s.nx * 14 * zn; y = s.y + s.ny * 14 * zn;
        }
        for (let i = 0; i < 40 && srazi(s, x, y); i++) { x += s.nx * 4 * zn; y += s.ny * 4 * zn; }
        hotove.push({ x, y, w: s.w, h: s.h });
        s.kx = x; s.ky = y;
        const st = el('g', { class: 'stitek posunovy', style: `--vypln-posunu: ${SVETLE[s.osa]}`, transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` }, g);
        el('rect', { x: -s.w / 2, y: -s.h / 2, width: s.w, height: s.h, rx: 4, stroke: BARVY[s.osa] }, st);
        el('text', { x: 0, y: 4.5, 'text-anchor': 'middle' }, st).textContent = s.txt;
      }
    }

    function kresli() {
      const t = M.tahPosunu;
      const tahne = zapnuto && t && M.app.uprava && S.renderer.domElement.classList.contains('tah-posun');
      if (!tahne) { if (svg.firstChild) svg.innerHTML = ''; posledni = []; return; }
      svg.innerHTML = '';
      const g = el('g', { class: 'kota posun' }, svg);
      const p0 = t.p0, p1 = p0.map((x, i) => x + t.u[i] * t.du), p2 = p1.map((x, i) => x + t.v[i] * t.dv);
      const zn = x => (x > 0 ? '+' : x < 0 ? '−' : '') + M.mm(Math.abs(x), 2);
      posledni = [];
      const stitky = [];
      if (Math.abs(t.du) > 1e-9) { const s = kota(p0, p1, `${t.rovina ? 'U' : 'X'} ${zn(t.du)}`, 0, g); if (s) stitky.push(s); posledni.push({ osa: 0, posun: t.du }); }
      if (Math.abs(t.dv) > 1e-9) { const s = kota(p1, p2, `${t.rovina ? 'V' : 'Y'} ${zn(t.dv)}`, 1, g); if (s) stitky.push(s); posledni.push({ osa: 1, posun: t.dv }); }
      // původní poloha: křížek v kroužku (štítky se mu vyhnou)
      const O = S.naObrazovku(V3(p0));
      if (O) {
        el('circle', { cx: O[0], cy: O[1], r: 6, class: 'puvod' }, g);
        el('path', { d: `M${O[0] - 9},${O[1]}h18M${O[0]},${O[1] - 9}v18`, class: 'puvod' }, g);
      }
      rozmistiStitky(stitky, O ? [{ x: O[0], y: O[1], w: 20, h: 20 }] : [], g);
      posledni.forEach((k, i) => { const s = stitky.find(q => q.osa === k.osa); if (s) Object.assign(k, { stitek: [s.kx, s.ky, s.w, s.h] }); });
    }
    M.na('kamera', kresli);
    M.na('dokument', kresli);
    M.kotyPosunuZapnute = () => zapnuto;
    M.prepniRychleKoty = function (zap = !zapnuto) {
      zapnuto = !!zap;
      try { localStorage.setItem(KLIC, zapnuto ? '1' : '0'); } catch (e) { /* bez úložiště */ }
      document.querySelectorAll('[data-prikaz=rychleKoty]').forEach(b => b.setAttribute('aria-pressed', zapnuto ? 'true' : 'false'));
      kresli();
    };
    document.querySelectorAll('[data-prikaz=rychleKoty]').forEach(b => b.setAttribute('aria-pressed', zapnuto ? 'true' : 'false'));
    // pro testy
    M.rychleKotyStav = () => posledni.map(k => ({ osa: k.osa, posun: Math.round(k.posun * 1000) / 1000, videt: svg.childNodes.length, stitek: k.stitek }));
  };
})(MDL);
