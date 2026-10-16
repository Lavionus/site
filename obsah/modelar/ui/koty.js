/* Modelář 3D – kóty vybraného tělesa přímo ve scéně: šířka, hloubka a výška podél os tělesa
   (u natočeného podle jeho natočení), u více vybraných těles celková obálka. Klik na číslo kóty
   otevře pole: nová velikost se zapíše jako v inspektoru (spodek zůstane na místě, X a Y kolem
   středu); pole bere i výpočty (60/2, 3 cm). Kóty jdou vypnout v nabídce Pohled (pamatuje si to
   prohlížeč). Kreslí se jako SVG nad plátnem, kóta se staví k té hraně obálky, která je k divákovi
   blíž, a odsadí se od tělesa ven. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const KLIC = 'modelar_koty';
  const BARVY = ['#e5533c', '#3cae5c', '#2f8fd8'];
  const OSA = ['šířka X', 'hloubka Y', 'výška Z'];

  M.vytvorKoty = function (S) {
    const plocha = document.getElementById('plocha');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'koty-vrstva');
    svg.setAttribute('aria-hidden', 'true');
    // pod úchyty (ty mají přednost, když se překryjí)
    const uchyty = plocha.querySelector('svg.uchyty');
    plocha.insertBefore(svg, uchyty || null);
    let zapnuto = true;
    try { zapnuto = localStorage.getItem(KLIC) !== '0'; } catch (e) { /* bez úložiště */ }
    let klic = '', koty = [];
    const el = (jmeno, atr, rodic) => {
      const e = document.createElementNS(NS, jmeno);
      for (const [k, v] of Object.entries(atr)) e.setAttribute(k, v);
      if (rodic) rodic.appendChild(e);
      return e;
    };

    /** Rámec kót: {ram (lokální → svět), vel [x, y, z], uzel (jen u jednoho tělesa – jde upravit)}. */
    function ramKot() {
      const uzly = M.vybraneUzly().filter(u => !u.skryto);
      if (!uzly.length) return null;
      if (uzly.length === 1) {
        const u = uzly[0];
        // rozměr tělesa leží kolem jeho polohy (přirozená geometrie je vystředěná)
        return { ram: M.tuhaMaticeUzlu(u), vel: u.rozmer.slice(), uzel: u };
      }
      const ob = M.obalkaVice(uzly);
      return { ram: new THREE.Matrix4().makeTranslation(...ob.stred), vel: [0, 1, 2].map(i => ob.max[i] - ob.min[i]), uzel: null };
    }

    function kresli(vynutit) {
      // při otáčení úchytem kóty schovat (úhloměr a jeho čísla by se s nimi překrývaly)
      const r = !zapnuto || M.app.rezim || M.modalniOkno() || M.otaciUchytem ? null : ramKot();
      const k = S.kamera.aktivni();
      const novy = M.otaciUchytem ? 'otaceni' : r ? k.matrixWorld.elements.join(',') + '|' + k.projectionMatrix.elements[0] + '|' + r.ram.elements.join(',') + '|' + r.vel.join(',') + '|' + (r.uzel ? r.uzel.id + (r.uzel.zamceno ? 'z' : '') : 'v') + '|' + S.kamera.sirka + 'x' + S.kamera.vyska : '';
      if (novy === klic && !vynutit) return;
      klic = novy;
      svg.innerHTML = ''; koty = [];
      if (!r) return;
      const { ram, vel } = r;
      const h = vel.map(x => x / 2);
      const svet = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(ram);
      const obr = p => S.naObrazovku(p);
      // kamera v rámci tělesa: kóty na stranu k divákovi, dole (zespodu nahoře)
      const oko = k.position.clone().applyMatrix4(ram.clone().invert());
      const sx = oko.x >= 0 ? 1 : -1, sy = oko.y >= 0 ? 1 : -1, sz = oko.z >= -h[2] ? -1 : 1;
      // střed obálky na obrazovce (odsazení kót ven od něj)
      const st = obr(svet(0, 0, 0));
      if (!st) return;
      const hrany = [
        [svet(-h[0], sy * h[1], sz * h[2]), svet(h[0], sy * h[1], sz * h[2])],
        [svet(sx * h[0], -h[1], sz * h[2]), svet(sx * h[0], h[1], sz * h[2])],
      ];
      // výška: svislá hrana na obrysu – roh, který je na obrazovce nejvíc vpravo (nebo vlevo, když je u okraje)
      let nejZ = null, xMax = -Infinity;
      for (const [cx, cy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = obr(svet(cx * h[0], cy * h[1], -h[2]));
        if (a && a[0] > xMax) { xMax = a[0]; nejZ = [cx, cy]; }
      }
      hrany.push(nejZ ? [svet(nejZ[0] * h[0], nejZ[1] * h[1], -h[2]), svet(nejZ[0] * h[0], nejZ[1] * h[1], h[2])] : null);
      hrany.forEach((hr, osa) => {
        if (!hr) return;
        const a = obr(hr[0]), b = obr(hr[1]);
        if (!a || !b) return;
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        if (L < 16) return;                                   // hrana skoro do oka: kóta by se nevešla
        // kolmice ven od středu tělesa
        let nx = -dy / L, ny = dx / L;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if ((mx - st[0]) * nx + (my - st[1]) * ny < 0) { nx = -nx; ny = -ny; }
        const o = 34;                                         // ven za úchyty a šipky otáčení
        const A = [a[0] + nx * o, a[1] + ny * o], B = [b[0] + nx * o, b[1] + ny * o];
        const g = el('g', { class: 'kota osa' + osa }, svg);
        el('line', { x1: a[0] + nx * 4, y1: a[1] + ny * 4, x2: A[0] + nx * 5, y2: A[1] + ny * 5, class: 'vynaseci' }, g);
        el('line', { x1: b[0] + nx * 4, y1: b[1] + ny * 4, x2: B[0] + nx * 5, y2: B[1] + ny * 5, class: 'vynaseci' }, g);
        el('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], class: 'kotovaci', stroke: BARVY[osa] }, g);
        // šipky (krátké čárky šikmo jako na výkresu)
        const ux = dx / L, uy = dy / L;
        for (const [P, s] of [[A, 1], [B, -1]]) el('path', { d: `M${P[0]},${P[1]} l${(s * ux * 7 + nx * 3).toFixed(1)},${(s * uy * 7 + ny * 3).toFixed(1)} M${P[0]},${P[1]} l${(s * ux * 7 - nx * 3).toFixed(1)},${(s * uy * 7 - ny * 3).toFixed(1)}`, class: 'kotovaci', stroke: BARVY[osa] }, g);
        const text = M.mm(vel[osa], 2);
        const tx = (A[0] + B[0]) / 2 + nx * 2, ty = (A[1] + B[1]) / 2 + ny * 2;
        const w = 8 + text.length * 7.2;
        const stitek = el('g', { class: 'stitek' + (r.uzel && !r.uzel.zamceno ? ' upravitelny' : ''), 'data-osa': osa, transform: `translate(${tx.toFixed(1)},${ty.toFixed(1)})` }, g);
        el('rect', { x: -w / 2, y: -9, width: w, height: 18, rx: 4, stroke: BARVY[osa] }, stitek);
        const t = el('text', { x: 0, y: 4.5, 'text-anchor': 'middle' }, stitek);
        t.textContent = text;
        const tit = el('title', {}, stitek);
        tit.textContent = `${OSA[osa]}: ${text} mm` + (r.uzel ? (r.uzel.zamceno ? ' (zamčené)' : ' – klik = zadat novou velikost') : ' (obálka výběru)');
        koty.push({ osa, x: tx, y: ty, prvek: stitek, text });
      });
    }

    // ------------------------------------------------------------ úprava kliknutím na číslo
    function zadej(osa, x, y) {
      const u = M.vybraneUzly()[0];
      if (!u || u.zamceno || M.vybraneUzly().length !== 1) return;
      const stare = plocha.querySelector('.zadani-koty');
      if (stare) stare.remove();
      const r = svg.getBoundingClientRect(), pr = plocha.getBoundingClientRect();
      const box = document.createElement('label');
      box.className = 'zadani-uhlu zadani-koty';
      box.style.borderColor = BARVY[osa];
      box.innerHTML = `<span>${'XYZ'[osa]}</span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Nová ${OSA[osa]} (mm)"><span>mm</span>`;
      box.style.left = (x + r.left - pr.left - 50) + 'px';
      box.style.top = (y + r.top - pr.top - 16) + 'px';
      plocha.appendChild(box);
      const inp = box.querySelector('input');
      inp.value = M.mm(u.rozmer[osa], 3);
      inp.focus(); inp.select();
      let hotovo = false, odhlasit = [];
      const zavri = () => {
        odhlasit.forEach(f => f()); odhlasit = [];
        if (box.isConnected) box.remove();
        if (document.activeElement === document.body || !document.activeElement) S.renderer.domElement.focus({ preventScroll: true });
      };
      inp.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Escape') { hotovo = true; zavri(); }
        else if (e.key === 'Enter') {
          hotovo = true;
          const text = inp.value.trim(), v = M.prectiCislo(text);
          zavri();
          if (!isFinite(v)) { if (text) M.oznamPole(null, `„${text}“ není číslo – piš třeba 25, 12,5, 60/2 nebo 3 cm.`); return; }
          const o = M.omez(v, 0.01, 10000);
          if (o !== v) Dialog.info(`${M.mm(v, 3)} je mimo rozsah – použito ${M.mm(o, 3)} mm.`);
          if (Math.abs(o - u.rozmer[osa]) < 1e-9) return;
          M.upravVybrane(x2 => {
            const rozmer = x2.rozmer.slice(); rozmer[osa] = o;
            return { rozmer, poloha: M.polohaSeSpodkem(Object.assign({}, x2, { rozmer }), M.spodekUzlu(x2)) };
          }, 'Rozměr');
        }
      });
      inp.addEventListener('blur', () => { if (!hotovo) { hotovo = true; zavri(); } });
      const zrus = () => { if (!hotovo) { hotovo = true; zavri(); } };
      const k0 = S.kamera.aktivni().matrixWorld.clone(), vel0 = S.kamera.sirka + 'x' + S.kamera.vyska;
      odhlasit = [M.na('kamera', () => { if (!S.kamera.aktivni().matrixWorld.equals(k0) || S.kamera.sirka + 'x' + S.kamera.vyska !== vel0) zrus(); }), M.na('vyber', zrus), M.na('rezim', zrus)];
    }
    svg.addEventListener('pointerdown', e => {
      const s = e.target.closest && e.target.closest('.stitek.upravitelny');
      if (!s || e.button !== 0 || M.app.uprava) return;
      e.stopPropagation(); e.preventDefault();
      // rozepsané pole inspektoru nejdřív potvrdit (jinak by kóta ukázala starý rozměr)
      if (document.activeElement && document.activeElement.matches && document.activeElement.matches('#inspektor input')) document.activeElement.blur();
      const k = koty.find(x => x.prvek === s);
      if (k) zadej(k.osa, k.x, k.y);
    });
    svg.addEventListener('wheel', e => { S.renderer.domElement.dispatchEvent(new WheelEvent('wheel', e)); e.preventDefault(); }, { passive: false });

    M.prepniKoty = function (stav = !zapnuto) {
      zapnuto = !!stav;
      try { localStorage.setItem(KLIC, zapnuto ? '1' : '0'); } catch (e) { /* bez úložiště */ }
      document.querySelectorAll('[data-prikaz=koty]').forEach(b => b.setAttribute('aria-pressed', zapnuto ? 'true' : 'false'));
      kresli(true);
      return zapnuto;
    };
    M.kotyZapnute = () => zapnuto;
    /** Kóty na obrazovce (pro testy a nápovědu): [{osa, x, y, text}]. */
    M.kotyNaObrazovce = () => koty.map(k => ({ osa: k.osa, x: k.x, y: k.y, text: k.text }));
    M.zadejKotu = (osa) => { const k = koty.find(x => x.osa === osa); if (k) zadej(k.osa, k.x, k.y); };
    document.querySelectorAll('[data-prikaz=koty]').forEach(b => b.setAttribute('aria-pressed', zapnuto ? 'true' : 'false'));
    for (const u of ['kamera', 'vyber', 'dokument', 'rezim']) M.na(u, () => kresli());
    // zavřené modální okno (dotaz bez změny): kóty zase ukázat – jinak by čekaly na další pohyb
    document.addEventListener('close', e => { if (e.target && e.target.tagName === 'DIALOG') setTimeout(() => kresli(true), 0); }, true);
  };
})(MDL);
