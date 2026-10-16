/* Modelář 3D – 3D scéna: renderer, světla, deska, kamera a ovládání myší.
   Vykresluje se jen na požádání (M.prekresli), ne v nekonečné smyčce:
   stojící scéna nežere procesor a headless testy nepadají na timeout.
   Myš jako v Tinkercadu: pravé tlačítko otáčí, prostřední nebo Shift + pravé
   posouvá, kolečko přibližuje k bodu pod kurzorem. Levé tlačítko patří
   výběru a úchytům (etapa 2–3). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  M.vytvorScenu = function (obal, nastaveni) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'platno3d';
    // scéna jde označit klávesnicí (Tab): šipky pak posouvají vybraná tělesa
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Pracovní plocha 3D – šipky posouvají vybraná tělesa, Delete maže');
    renderer.domElement.setAttribute('role', 'application');
    obal.appendChild(renderer.domElement);

    const scena = new THREE.Scene();
    const kamera = new M.Kamera(obal.clientWidth, obal.clientHeight);
    const deska = M.vytvorDesku(nastaveni.sirka, nastaveni.hloubka, nastaveni.krok);
    scena.add(deska.objekt);
    // pracovní rovina položená na stěnu tělesa (oranžová mřížka), jinak skrytá
    const rovina = M.vytvorDesku(nastaveni.sirka, nastaveni.hloubka, nastaveni.krok, true);
    rovina.objekt.visible = false;
    rovina.objekt.renderOrder = 1;
    scena.add(rovina.objekt);

    // světla: rozptýlené z oblohy a „čelovka“ od kamery mírně shora,
    // aby stěny natočené ke kameře byly vždy dobře čitelné
    const nebe = new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.1);
    nebe.position.set(0, 0, 1);
    scena.add(nebe);
    const celovka = new THREE.DirectionalLight(0xffffff, 1.6);
    scena.add(celovka, celovka.target);

    // skupina pro tělesa modelu (plní etapa 2)
    const model = new THREE.Group();
    model.name = 'model';
    scena.add(model);

    const S = { renderer, scena, kamera, deska, rovina, model, snimku: 0 };

    /** Pracovní rovina: přenese velikost a krok z desky a polohu z M.app.rovina. */
    S.ukazRovinu = function () {
      const r = M.app.rovina;
      rovina.objekt.visible = !!r;
      if (r) {
        rovina.nastav(deska.sirka, deska.hloubka, deska.krok);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(...r.puvod), M.quatRoviny(r),
          new THREE.Vector3(deska.sirka, deska.hloubka, 1));
        rovina.objekt.matrixAutoUpdate = false;
        rovina.objekt.matrix.copy(m);
        rovina.objekt.matrixWorldNeedsUpdate = true;
      }
      M.prekresli();
    };
    M.na('rovina', S.ukazRovinu);

    /** Kolik mm odpovídá jednomu CSS pixelu v daném bodě (perspektiva i orto). */
    S.mmNaPixel = function (bod) {
      const k = kamera.aktivni();
      if (kamera.ortograficka) return 2 * kamera.pulVysky() / kamera.vyska;
      const hloubka = new THREE.Vector3().copy(bod).sub(k.position).dot(new THREE.Vector3(0, 0, -1).applyQuaternion(k.quaternion));
      return 2 * Math.max(hloubka, 1e-3) * Math.tan(kamera.fov * M.st / 2) / kamera.vyska;
    };

    /** Bod ve světě → [x, y] v CSS px vůči plátnu (null za kamerou). */
    S.naObrazovku = function (bod) {
      const v = new THREE.Vector3().copy(bod).project(kamera.aktivni());
      if (v.z > 1 || v.z < -1) return null;
      return [(v.x + 1) / 2 * kamera.sirka, (1 - v.y) / 2 * kamera.vyska];
    };
    M.scena = S;

    // --- vykreslování na požádání
    let cekaSnimek = false;
    M.prekresli = function () {
      if (cekaSnimek) return;
      cekaSnimek = true;
      requestAnimationFrame(snimek);
    };
    function snimek() {
      cekaSnimek = false;
      const bezi = kamera.krok();
      const k = kamera.aktivni();
      deska.zespodu(k.position.z < 0);                  // zespodu průsvitná deska (tělesa nad ní vidět celá)
      const smer = M.smerPohledu(kamera.az, kamera.el);
      celovka.position.copy(kamera.cil).addScaledVector(smer, 1000).add(new THREE.Vector3(0, 0, 300));
      celovka.target.position.copy(kamera.cil);
      renderer.render(scena, k);
      S.snimku++;
      if (S.kostka) S.kostka.vykresli();
      M.vysli('kamera', kamera);
      if (bezi) M.prekresli();
    }

    // --- velikost
    function velikost() {
      const w = obal.clientWidth, h = obal.clientHeight;
      if (!w || !h) return;
      // přiblížení prohlížeče nebo jiný monitor mění devicePixelRatio – plátno jinak rozmazané
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (renderer.getPixelRatio() !== dpr) { renderer.setPixelRatio(dpr); if (S.kostka && S.kostka.renderer) S.kostka.renderer.setPixelRatio(dpr); }
      renderer.setSize(w, h, false);
      kamera.nastavVelikost(w, h);
      M.prekresli();
    }
    new ResizeObserver(velikost).observe(obal);
    // změna DPI bez změny velikosti okna (Ctrl+/−, přetažení na jiný monitor)
    (function hlidejDpr() {
      if (typeof matchMedia !== 'function') return;
      const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener('change', () => { velikost(); hlidejDpr(); }, { once: true });
    })();

    // --- motiv webu (světlý/tmavý) se může změnit za běhu
    S.motiv = function () {
      const b = deska.motiv();
      rovina.motiv();
      // pozadí s jemným přechodem shora dolů (textura 2 × 256 px, roztažená přes plátno)
      if (scena.background && scena.background.isTexture) scena.background.dispose();
      const c = document.createElement('canvas'); c.width = 2; c.height = 256;
      const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, b.pozadi); gr.addColorStop(1, b.pozadi2 || b.pozadi);
      g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
      const tx = new THREE.CanvasTexture(c);
      tx.colorSpace = THREE.SRGBColorSpace;
      scena.background = tx;
      nebe.groundColor.set(M.svetlaScena() ? 0x9aa3b2 : 0x50586a);
      if (S.kostka) S.kostka.motiv();
      M.prekresli();
    };
    new MutationObserver(S.motiv).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // --- ovládání myší
    const el = renderer.domElement;
    let tah = null;
    function pixel(e) {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    el.addEventListener('contextmenu', e => e.preventDefault());
    // nabídka prohlížeče nikde nad plochou (překryvné vrstvy, inspektor mimo textová pole) a ani tam,
    // kde pravé tlačítko skončilo po otáčení pohledem (Windows ji posílá až po puštění, nad jiným prvkem)
    let konecPravehoTahu = 0;
    document.addEventListener('contextmenu', e => {
      const t = e.target;
      const nadPlochou = t && t.closest && t.closest('#plocha') && !t.closest('input, textarea, select, [contenteditable]');
      if (nadPlochou || tah || performance.now() - konecPravehoTahu < 600) e.preventDefault();
    }, true);

    // --- dotyk: dva prsty = přiblížení (roztažení) a posun pohledu (střed prstů);
    // jeden prst obsluhuje vyber.js (těleso posune, prázdné místo otáčí pohledem)
    const prsty = new Map();
    let gesto = null;
    const stredPrstu = () => { const p = [...prsty.values()]; return [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]; };
    const vzdalenostPrstu = () => { const p = [...prsty.values()]; return Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); };
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      prsty.set(e.pointerId, pixel(e));
      if (prsty.size === 2) {
        gesto = { stred: stredPrstu(), vzd: Math.max(1, vzdalenostPrstu()) };
        M.gesto = true;
        M.vysli('gesto', true);                    // vyber.js zruší rozdělaný tah jedním prstem
      }
    }, true);
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch' || !prsty.has(e.pointerId)) return;
      prsty.set(e.pointerId, pixel(e));
      if (!gesto || prsty.size < 2) return;
      const s = stredPrstu(), d = Math.max(1, vzdalenostPrstu());
      kamera.posun(s[0] - gesto.stred[0], s[1] - gesto.stred[1]);
      kamera.zoom(gesto.vzd / d, s[0], s[1]);
      gesto.stred = s; gesto.vzd = d;
      M.prekresli();
    }, true);
    const konecPrstu = e => {
      if (e.pointerType !== 'touch') return;
      prsty.delete(e.pointerId);
      if (gesto && prsty.size < 2) {
        gesto = null;
        // gesto končí až zvednutím všech prstů – zbylý prst nesmí začít nový tah
        if (!prsty.size) { M.gesto = false; M.vysli('gesto', false); }
      } else if (!prsty.size && M.gesto) { M.gesto = false; M.vysli('gesto', false); }
    };
    el.addEventListener('pointerup', konecPrstu, true);
    el.addEventListener('pointercancel', konecPrstu, true);
    S.dotyk = () => ({ prstu: prsty.size, gesto: !!gesto });

    // pravé/prostřední tlačítko i nad překryvnou vrstvou (úchyty, puntíky, hrany) otáčí a posouvá pohled
    document.addEventListener('pointerdown', e => {
      if ((e.button === 1 || e.button === 2) && e.target !== el && e.target.closest && e.target.closest('#plocha svg')) zacniTahPohledu(e);
    }, true);
    el.addEventListener('pointerdown', e => zacniTahPohledu(e));
    function zacniTahPohledu(e) {
      let druh = null;
      // Shift (nebo Ctrl – Firefox se Shiftem vždy ukáže svou nabídku) + pravé = posun
      if (e.button === 2) druh = e.shiftKey || e.ctrlKey ? 'posun' : 'otoc';
      else if (e.button === 1) druh = 'posun';
      if (!druh) return;
      e.preventDefault();
      tah = { druh, x: e.clientX, y: e.clientY, id: e.pointerId };
      el.setPointerCapture(e.pointerId);
      el.classList.add(druh === 'otoc' ? 'tah-otoc' : 'tah-posun');
    }
    el.addEventListener('pointermove', e => {
      const [px, py] = pixel(e);
      M.vysli('kurzor', kamera.bodNaRovine(px, py, 0));
      if (!tah || e.pointerId !== tah.id) return;
      const dx = e.clientX - tah.x, dy = e.clientY - tah.y;
      tah.x = e.clientX; tah.y = e.clientY;
      if (tah.druh === 'otoc') kamera.otoc(dx, dy, S.stredOtaceni()); else kamera.posun(dx, dy);
      M.prekresli();
    });
    function konecTahu(e) {
      if (!tah || e.pointerId !== tah.id) return;
      tah = null;
      konecPravehoTahu = performance.now();
      el.classList.remove('tah-otoc', 'tah-posun');
    }
    el.addEventListener('pointerup', konecTahu);
    el.addEventListener('pointercancel', konecTahu);
    el.addEventListener('pointerleave', () => M.vysli('kurzor', null));
    el.addEventListener('wheel', e => {
      e.preventDefault();
      // deltaMode 1 = řádky (Firefox), 2 = stránky
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      const [px, py] = pixel(e);
      kamera.zoom(Math.exp(M.omez(d, -200, 200) * 0.0015), px, py);
      M.prekresli();
    }, { passive: false });

    // --- kostka pohledů
    S.kostka = M.vytvorKostku(obal, kamera,
      smer => { kamera.pohledZeSmeru(smer); M.prekresli(); },
      (dx, dy) => { kamera.otoc(dx, dy, S.stredOtaceni()); M.prekresli(); });

    /** Střed otáčení pohledu: střed vybraných těles, bez výběru střed pracovní desky. */
    S.stredOtaceni = function () {
      const uzly = M.app && M.app.dok ? M.app.dok.uzly.filter(u => M.app.vyber.includes(u.id) && !u.skryto) : [];
      return uzly.length ? new THREE.Vector3(...M.obalkaVice(uzly).stred) : new THREE.Vector3(0, 0, 0);
    };
    /** Pohled „Domů“ na celou desku. */
    /** Šířka plátna zakrytá zleva a zprava panely (inspektor, otevřené nástroje). */
    S.okrajePanelu = function () {
      const r = renderer.domElement.getBoundingClientRect(), okraje = { vlevo: 0, vpravo: 0 };
      for (const el of document.querySelectorAll('#inspektor, dialog.okno.vedle[open]')) {
        if (!el.offsetParent && el.tagName !== 'DIALOG') continue;
        const b = el.getBoundingClientRect();
        if (b.width < 10 || b.width > r.width * 0.6 || b.bottom < r.top + r.height * 0.5 || b.top > r.top + r.height * 0.5) continue;
        if (b.left - r.left < 40) okraje.vlevo = Math.max(okraje.vlevo, b.right - r.left);
        else if (r.right - b.right < 40) okraje.vpravo = Math.max(okraje.vpravo, r.right - b.left);
      }
      return okraje;
    };
    S.domu = function (ms = 400) {
      // panely, které leží přes plátno (inspektor na úzké obrazovce): deska do volné části
      const r = renderer.domElement.getBoundingClientRect();
      kamera.domu(new THREE.Vector3(0, 0, 0), deska.rohy(), ms, r.width < 800 ? S.okrajePanelu() : null);     // širší plátno: vpravo leží panely nástrojů
      M.prekresli();
    };
    /** Zaměřit výběr: stejný směr pohledu, výběr vyplní volnou část plátna (mimo inspektor a panely nástrojů). */
    S.zamerit = function (ids, ms = 400) {
      const uzly = M.app.dok.uzly.filter(u => ids.includes(u.id) && !u.skryto);
      if (!uzly.length) return false;
      const ob = M.obalkaVice(uzly), rohy = [];
      for (let i = 0; i < 8; i++) rohy.push(new THREE.Vector3(i & 1 ? ob.max[0] : ob.min[0], i & 2 ? ob.max[1] : ob.min[1], i & 4 ? ob.max[2] : ob.min[2]));
      const st = new THREE.Vector3(...ob.stred), ok = S.okrajePanelu();
      const volno = Math.max(0.3, (kamera.sirka - ok.vlevo - ok.vpravo) / kamera.sirka);
      // malé těleso nepřiblížit až k nesmyslu: aspoň 60 mm kolem
      const vzd = Math.max(kamera.vzdalenostProBody(rohy, kamera.az, kamera.el, st, 0.75, 0.75 * volno), kamera.vzdalenostProKouli(30));
      const c = (ok.vlevo - ok.vpravo) / kamera.sirka;
      const pul = vzd * Math.tan(kamera.fov * M.st / 2);
      const vpravo = new THREE.Vector3(Math.cos(kamera.az), Math.sin(kamera.az), 0);
      kamera.animujNa({ az: kamera.az, el: kamera.el, cil: st.clone().addScaledVector(vpravo, -c * pul * kamera.sirka / kamera.vyska), vzd }, ms);
      M.prekresli();
      return true;
    };
    /** Je obálka výběru na obrazovce schovaná pod panelem (střed pod ním)? */
    S.vyberZakryty = function (ids) {
      const uzly = M.app.dok.uzly.filter(u => ids.includes(u.id) && !u.skryto);
      if (!uzly.length) return false;
      const p = S.naObrazovku(new THREE.Vector3(...M.obalkaVice(uzly).stred));
      if (!p) return true;
      const r = renderer.domElement.getBoundingClientRect(), ok = S.okrajePanelu();
      return p[0] < ok.vlevo || p[0] > r.width - ok.vpravo || p[0] < 0 || p[1] < 0 || p[0] > r.width || p[1] > r.height;
    };
    /** Pohled z pojmenovaného směru. */
    const SMERY = {
      zepredu: [0, -1, 0], zezadu: [0, 1, 0], zprava: [1, 0, 0], zleva: [-1, 0, 0],
      shora: [0, 0, 1], zdola: [0, 0, -1],
    };
    S.pohled = function (jmeno, ms = 400) {
      const s = SMERY[jmeno];
      if (!s) return;
      kamera.pohledZeSmeru(new THREE.Vector3(...s), ms);
      M.prekresli();
    };
    S.projekce = function (orto) {
      kamera.ortograficka = !!orto;
      kamera.aktualizuj();
      M.vysli('projekce', kamera.ortograficka);
      M.prekresli();
    };

    /** Náhled projektu (PNG data URL): tělesa šikmo zepředu, bez desky a rámečků. */
    S.vytvorNahled = function (w = 240, h = 180) {
      const viditelne = M.app.dok.uzly.filter(u => !u.skryto);
      const k = new M.Kamera(w, h);
      if (viditelne.length) {
        const ob = M.obalkaVice(viditelne);
        const body = [];
        for (let i = 0; i < 8; i++) body.push(new THREE.Vector3(i & 1 ? ob.max[0] : ob.min[0], i & 2 ? ob.max[1] : ob.min[1], i & 4 ? ob.max[2] : ob.min[2]));
        k.domu(new THREE.Vector3(...ob.stred), body, 0);
      } else k.domu(new THREE.Vector3(0, 0, 0), deska.rohy(), 0);
      const rt = new THREE.WebGLRenderTarget(w * 2, h * 2, { samples: 4 });
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      const skryte = [deska.objekt, rovina.objekt];
      const ramy = [];
      // rámečky výběru a červené převisy do náhledu nepatří
      model.traverse(o => { if (o.visible && (o.userData.previs || (o.isLineSegments && o.material && o.material.depthTest === false))) ramy.push(o); });
      scena.children.forEach(o => { if (o.visible && o.userData.prekryv) ramy.push(o); });
      const puvodni = skryte.map(o => o.visible);
      skryte.concat(ramy).forEach(o => { o.visible = false; });
      const pozadi = scena.background, orez = renderer.localClippingEnabled;
      scena.background = null;
      renderer.localClippingEnabled = false;                  // náhled projektu bez řezu pohledem
      celovka.position.copy(k.cil).addScaledVector(M.smerPohledu(k.az, k.el), 1000).add(new THREE.Vector3(0, 0, 300));
      celovka.target.position.copy(k.cil);
      try {
        renderer.setRenderTarget(rt);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(scena, k.aktivni());
        const px = new Uint8Array(w * 2 * h * 2 * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, w * 2, h * 2, px);
        const c = document.createElement('canvas');
        c.width = w * 2; c.height = h * 2;
        const g = c.getContext('2d'), img = g.createImageData(w * 2, h * 2);
        for (let y = 0; y < h * 2; y++) img.data.set(px.subarray((h * 2 - 1 - y) * w * 8, (h * 2 - y) * w * 8), y * w * 8);   // otočit Y
        g.putImageData(img, 0, 0);
        const m = document.createElement('canvas');
        m.width = w; m.height = h;
        m.getContext('2d').drawImage(c, 0, 0, w, h);
        return m.toDataURL('image/png');
      } finally {
        renderer.setRenderTarget(null);
        rt.dispose();
        scena.background = pozadi;
        renderer.localClippingEnabled = orez;
        skryte.forEach((o, i) => { o.visible = puvodni[i]; });
        ramy.forEach(o => { o.visible = true; });
        // plátno se nepřekresluje: náhled šel do textury, obrazovka se nezměnila
      }
    };

    velikost();
    S.motiv();
    kamera.domu(new THREE.Vector3(0, 0, 0), deska.rohy(), 0);
    return S;
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
