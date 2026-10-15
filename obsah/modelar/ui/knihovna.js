/* Modelář 3D – knihovna tvarů v panelu.
   Ikony se vykreslí ze stejných generátorů jako tělesa (jeden dočasný
   renderer, pak se uvolní). Tvar jde přetáhnout na desku: nad plátnem se
   ukazuje poloprůhledný náhled přichycený k mřížce, a když je pod kurzorem
   vodorovná plocha jiného tělesa, položí se na ni. Klik bez tažení přidá
   tvar doprostřed pohledu. Esc tažení zruší. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  /** Ikony tvarů jako data URL (velikost v CSS px). */
  function vykresliIkony(vel) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ikony = {};
    let r;
    try {
      r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { return ikony; }
    r.setPixelRatio(dpr);
    r.setSize(vel, vel, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scena = new THREE.Scene();
    scena.add(new THREE.HemisphereLight(0xffffff, 0x707884, 1.2));
    const sv = new THREE.DirectionalLight(0xffffff, 1.7);
    sv.position.set(-1, -2, 3);
    scena.add(sv);
    const kam = new THREE.PerspectiveCamera(30, 1, 1, 1000);
    kam.up.set(0, 0, 1);
    for (const [druh, t] of Object.entries(M.TVARY)) {
      const geom = M.geometrieProZobrazeni(M.sitTvaru(druh, t.rozmer, t.param), 30);
      const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: t.barva, roughness: 0.6 }));
      scena.add(mesh);
      geom.computeBoundingSphere();
      const rr = geom.boundingSphere.radius;
      kam.position.copy(M.smerPohledu(-30 * M.st, 28 * M.st).multiplyScalar(rr / Math.sin(15 * M.st) * 1.02));
      kam.lookAt(0, 0, 0);
      r.render(scena, kam);
      ikony[druh] = r.domElement.toDataURL('image/png');
      scena.remove(mesh);
      geom.dispose(); mesh.material.dispose();
    }
    r.dispose();
    r.forceContextLoss();
    return ikony;
  }

  M.vytvorKnihovnu = function (S, T, mriz, mrizDily, mrizRozsirene) {
    // výchozí uzel druhu (rozměry dílů plynou z norem, ne z katalogu tvarů)
    const vychozi = new Map();
    const vzor = druh => { if (!vychozi.has(druh)) vychozi.set(druh, M.novyUzel(druh)); return vychozi.get(druh); };
    const ikony = vykresliIkony(52);
    M.ikonyTvaru = ikony;
    const platno = S.renderer.domElement;
    mriz.innerHTML = '';
    if (mrizRozsirene) mrizRozsirene.innerHTML = '';
    for (const [druh, t] of Object.entries(M.TVARY)) {
      const b = document.createElement('button');
      b.className = 'dlazdice';
      b.type = 'button';
      b.dataset.druh = druh;
      b.title = `${t.nazev}: přetáhni na desku nebo klikni`;
      b.innerHTML = (ikony[druh] ? `<img src="${ikony[druh]}" alt="" draggable="false">` : `<span class="ik">${t.ikona}</span>`)
        + `<span>${t.nazev}</span>`;
      (t.sada === 'rozsirene' && mrizRozsirene ? mrizRozsirene : mriz).appendChild(b);
    }

    // zvláštní dlaždice: skica (otevře editor) a import SVG
    for (const [akce, ik, nazev, tit] of [['skica', '✏️', 'Skica', 'Nakreslit 2D tvar a vytáhnout ho nebo otočit kolem osy'],
                                          ['svg', '🖋️', 'SVG…', 'Načíst kresbu SVG jako skicu']]) {
      const b = document.createElement('button');
      b.className = 'dlazdice zvlastni';
      b.type = 'button';
      b.dataset.akce = akce;
      b.title = tit;
      b.innerHTML = `<span class="ik">${ik}</span><span>${nazev}</span>`;
      b.onclick = () => { if (akce === 'skica') M.otevriSkicar(null); else document.getElementById('vstupSouboru').click(); };
      mriz.appendChild(b);
    }

    // díly: dlaždice s ikonou (geometrie dílu se počítá ve workeru, ikona je znak)
    if (mrizDily) {
      mrizDily.innerHTML = '';
      for (const [druh, d] of Object.entries(M.DILY)) {
        if (d.skryty) continue;                       // vzniká jen z jiného nástroje (ovinutý vzor ze SVG)
        const b = document.createElement('button');
        b.className = 'dlazdice dil';
        b.type = 'button';
        b.dataset.druh = druh;
        b.title = `${d.nazev}: přetáhni na desku nebo klikni`;
        b.innerHTML = `<span class="ik">${d.ikona}</span><span>${d.nazev}</span>`;
        mrizDily.appendChild(b);
      }
    }

    /** Kam padne tvar puštěný v pixelu plátna: {poloha, rotace} nebo null.
        S pracovní rovinou leží tvar na ní (natočený podle ní), jinak na desce,
        nebo na vodorovné horní stěně tělesa pod kurzorem. */
    function misto(druh, px, py) {
      const t = vzor(druh);
      const krok = Math.max(S.deska.krok, 0.5);
      const r = M.app.rovina;
      if (r) {
        const [u, v, n] = r.osy.map(o => new THREE.Vector3(...o));
        const p0 = new THREE.Vector3(...r.puvod);
        const p = M.prusecikRoviny(px, py, p0, n);
        if (!p) return null;
        p.sub(p0);
        const a = Math.round(p.dot(u) / krok) * krok, b = Math.round(p.dot(v) / krok) * krok;
        const poloha = p0.clone().addScaledVector(u, a).addScaledVector(v, b).addScaledVector(n, t.rozmer[2] / 2);
        return { poloha: poloha.toArray().map(x => Math.round(x * 1e6) / 1e6), rotace: M.rotaceZQuat(M.quatRoviny(r)) };
      }
      const zasah = T.zasah(px, py);
      let x, y, z = 0;
      if (zasah && zasah.normala.z > 0.7) {
        [x, y, z] = [zasah.bod.x, zasah.bod.y, zasah.bod.z];
      } else {
        const b = S.kamera.bodNaRovine(px, py, 0);
        if (!b) return null;
        [x, y] = [b.x, b.y];
      }
      x = Math.round(x / krok) * krok; y = Math.round(y / krok) * krok;
      return { poloha: [x, y, Math.round((z + t.rozmer[2] / 2) * 1e6) / 1e6], rotace: [0, 0, 0] };   // bez šumu typu 29,99999999
    }

    /** Volné místo poblíž středu pohledu (klik na dlaždici). */
    function mistoUprostred(druh) {
      const t = vzor(druh);
      // s pracovní rovinou padne tvar na ni (nejbližší bod roviny ke středu pohledu), natočený podle ní
      const rv = M.app.rovina;
      if (rv) {
        const [u, v, n] = rv.osy.map(o => new THREE.Vector3(...o));
        const p0 = new THREE.Vector3(...rv.puvod), krok = Math.max(S.deska.krok, 0.5);
        const d = S.kamera.cil.clone().sub(p0);
        const a0 = Math.round(d.dot(u) / krok) * krok, b0 = Math.round(d.dot(v) / krok) * krok;
        const rotace = M.rotaceZQuat(M.quatRoviny(rv));
        // volné místo i na rovině: kruhy kolem středu pohledu, kolize podle obálky ve světě
        const obalky = M.app.dok.uzly.filter(x => !x.skryto).map(x => M.obalkaUzlu(x));
        const rozestup = Math.ceil((Math.max(t.rozmer[0], t.rozmer[1]) + 5) / krok) * krok;
        const naMiste = (a, b) => {
          const poloha = p0.clone().addScaledVector(u, a).addScaledVector(v, b).addScaledVector(n, t.rozmer[2] / 2).toArray().map(x => Math.round(x * 1e6) / 1e6);
          const o = M.obalkaUzlu(M.normalizujUzel(Object.assign({}, t, { poloha, rotace })));
          const volno = !obalky.some(q => [0, 1, 2].every(i => q.min[i] < o.max[i] - 0.01 && q.max[i] > o.min[i] + 0.01));
          return { poloha, volno };
        };
        for (let kruh = 0; kruh <= 8; kruh++)
          for (let i = -kruh; i <= kruh; i++) for (let j = -kruh; j <= kruh; j++) {
            if (Math.max(Math.abs(i), Math.abs(j)) !== kruh) continue;
            const m = naMiste(a0 + i * rozestup, b0 + j * rozestup);
            if (m.volno) return { poloha: m.poloha, rotace };
          }
        return { poloha: naMiste(a0, b0).poloha, rotace };
      }
      const krok = Math.max(S.deska.krok, 0.5);
      const x0 = Math.round(S.kamera.cil.x / krok) * krok, y0 = Math.round(S.kamera.cil.y / krok) * krok;
      // volné místo co nejblíž středu pohledu: kruhy kolem něj, jen na desce (dřív se šlo pořád doprava mimo desku)
      const obalky = M.app.dok.uzly.filter(u => !u.skryto).map(u => M.obalkaUzlu(u));
      const volno = (x, y) => !obalky.some(o => o.min[0] < x + t.rozmer[0] / 2 + 2 && o.max[0] > x - t.rozmer[0] / 2 - 2
        && o.min[1] < y + t.rozmer[1] / 2 + 2 && o.max[1] > y - t.rozmer[1] / 2 - 2 && o.min[2] < t.rozmer[2]);
      const naDesce = (x, y) => Math.abs(x) + t.rozmer[0] / 2 <= S.deska.sirka / 2 && Math.abs(y) + t.rozmer[1] / 2 <= S.deska.hloubka / 2;
      const rozestup = Math.ceil((Math.max(t.rozmer[0], t.rozmer[1]) + 5) / krok) * krok;
      let x = x0, y = y0;
      hledej: for (let kruh = 0; kruh <= 12; kruh++) {
        for (let i = -kruh; i <= kruh; i++) for (let j = -kruh; j <= kruh; j++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== kruh) continue;
          const cx = x0 + i * rozestup, cy = y0 + j * rozestup;
          if ((kruh === 0 || naDesce(cx, cy)) && volno(cx, cy)) { x = cx; y = cy; break hledej; }
        }
      }
      return { poloha: [x, y, t.rozmer[2] / 2], rotace: [0, 0, 0] };
    }

    let tah = null;
    const duch = document.createElement('div');
    duch.className = 'duch-tvaru';
    duch.hidden = true;
    document.body.appendChild(duch);

    function nadPlatnem(e) {
      const r = platno.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
      // kostka pohledů v rohu se nepočítá
      const k = S.kostka.renderer.domElement.getBoundingClientRect();
      if (e.clientX >= k.left && e.clientX <= k.right && e.clientY >= k.top && e.clientY <= k.bottom) return null;
      // na telefonu leží panel přes plátno – pod prstem musí být opravdu plocha, ne panel knihovny
      const pod = document.elementFromPoint(e.clientX, e.clientY);
      if (pod && (!pod.closest('#plocha') || pod.closest('#inspektor'))) return null;     // ne panel ani karta inspektoru
      return [e.clientX - r.left, e.clientY - r.top];
    }

    function zrus() {
      if (!tah) return;
      tah = null;
      duch.hidden = true;
      T.ukazNahled(null);
      M.ovladaniBlokovano = false;
      nabidka.classList.remove('tahne');
    }

    // stejná obsluha pro mřížku tvarů i dílů (arguments: vnitřní proměnná se jmenuje stejně jako parametr)
    for (const mriz of [arguments[2], arguments[3], arguments[4]].filter(Boolean)) {
      mriz.addEventListener('pointerdown', e => {
        const b = e.target.closest('.dlazdice:not(.zvlastni)');
        if (!b || e.button !== 0) return;
        const dotyk = e.pointerType === 'touch';
        // prst: svislý tah posouvá seznam (touch-action: pan-y, prohlížeč pak pošle pointercancel); tvar se táhne
        // jen vodorovně ven z panelu – proto bez preventDefault a zachycení až po rozhodnutí
        // rozepsané pole inspektoru potvrdit (preventDefault by mu vzal blur a přestavba inspektoru text zahodila)
        if (document.activeElement && document.activeElement.matches('#inspektor input')) document.activeElement.blur();
        if (!dotyk) { e.preventDefault(); b.setPointerCapture(e.pointerId); }
        tah = { druh: b.dataset.druh, x0: e.clientX, y0: e.clientY, tazeno: false, id: e.pointerId, misto: null, dotyk, dlazdice: b };
        M.ovladaniBlokovano = true;
      });
      mriz.addEventListener('pointermove', e => {
        if (!tah || e.pointerId !== tah.id) return;
        const dx = e.clientX - tah.x0, dy = e.clientY - tah.y0;
        tah.pohyb = Math.max(tah.pohyb || 0, Math.hypot(dx, dy));
        // prst: tah začne jen převážně vodorovným pohybem (svislý = posun seznamu, prohlížeč ho za chvíli zruší)
        if (!tah.tazeno && tah.dotyk && Math.abs(dy) > Math.abs(dx)) return;
        if (!tah.tazeno && Math.hypot(dx, dy) > (tah.dotyk ? 12 : 5)) {
          tah.tazeno = true;
          nabidka.classList.add('tahne');                 // nabídka zprůhlední, ať je vidět deska pod ní
          if (tah.dotyk) {
            try { tah.dlazdice.setPointerCapture(e.pointerId); } catch (x) { /* ukazatel skončil */ }
            tah.panelSchovan = document.body.classList.contains('panel-ukazany');
            document.body.classList.remove('panel-ukazany');      // telefon: schovat panel, ať je vidět deska
          }
          duch.innerHTML = ikony[tah.druh] ? `<img src="${ikony[tah.druh]}" alt="">` : M.popisDruhu(tah.druh).ikona;
        }
        if (!tah.tazeno) return;
        const p = nadPlatnem(e);
        tah.misto = p ? misto(tah.druh, p[0], p[1]) : null;
        if (tah.misto) {
          duch.hidden = true;
          T.ukazNahled(Object.assign({}, vzor(tah.druh), { poloha: tah.misto.poloha, rotace: tah.misto.rotace }));
          M.vysli('kurzor', new THREE.Vector3(tah.misto.poloha[0], tah.misto.poloha[1], 0));
        } else {
          T.ukazNahled(null);
          duch.hidden = false;
          duch.style.left = e.clientX + 'px';
          duch.style.top = e.clientY + 'px';
        }
      });
      mriz.addEventListener('pointerup', e => {
        if (!tah || e.pointerId !== tah.id) return;
        const t = tah;
        zrus();
        if (t.tazeno) M.posledniTahKnihovny = performance.now();     // puštění nad lištou není klik na tlačítko
        // po vložení nabídku zavřít (Shift + klik ji nechá otevřenou pro další tvar)
        if (!e.shiftKey || t.tazeno) zavriNabidku();
        // klepnutí přidá tvar; prst, který se pohnul (pokus o posun seznamu), nic nepřidá
        if (!t.tazeno) { if (!(t.dotyk && (t.pohyb || 0) > 8)) M.pridejTvar(t.druh, mistoUprostred(t.druh)); }
        else if (t.misto) M.pridejTvar(t.druh, t.misto);
      });
      mriz.addEventListener('pointercancel', () => {
        // prohlížeč tah převzal (posun seznamu): schovaný panel zase ukázat
        if (tah && tah.panelSchovan) document.body.classList.add('panel-ukazany');
        zrus();
      });
      // klávesnice: Enter/mezerník na dlaždici přidá tvar doprostřed
      mriz.addEventListener('keydown', e => {
        const b = e.target.closest('.dlazdice:not(.zvlastni)');
        if (b && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault(); M.pridejTvar(b.dataset.druh, mistoUprostred(b.dataset.druh));
          // fokus na scénu: šipky pak hned posouvají nový tvar (Shift+Enter nechá nabídku otevřenou pro další tvar)
          if (!e.shiftKey) { zavriNabidku(); S.renderer.domElement.focus({ preventScroll: true }); }
        }
      });
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') zrus(); });

    M.mistoProTvar = mistoUprostred;               // i pro paletu příkazů

    // ------------------------------------------------------------ nabídka Tvary v liště
    const nabidka = document.getElementById('nabTvary') || document.createElement('div');
    const hledat = document.getElementById('hledatTvar');
    function zavriNabidku() {
      nabidka.classList.remove('tahne');
      if (!nabidka.hidden) M.zavriNabidku(nabidka);
      // fokus ze zavřené nabídky (hledání) na scénu – klávesy pak hned platí pro nový tvar
      if (nabidka.contains(document.activeElement) || document.activeElement === document.body) S.renderer.domElement.focus({ preventScroll: true });
    }
    /** Esc během přetahování tvaru: tah zrušit (nic se nepřidá); vrací, jestli nějaký byl. */
    M.zrusTahKnihovny = () => { if (!tah) return false; zrus(); return true; };
    M.otevriTvary = () => { const b = document.getElementById('btnTvary'); if (b && nabidka.hidden) b.click(); };
    // otevřená nabídka: fokus do hledání (rovnou psát), staré hledání pryč
    new MutationObserver(() => {
      if (nabidka.hidden) { nabidka.classList.remove('tahne'); return; }
      if (hledat) { hledat.value = ''; filtruj(); if (!matchMedia('(pointer: coarse)').matches) hledat.focus({ preventScroll: true }); }
    }).observe(nabidka, { attributes: true, attributeFilter: ['hidden'] });
    const bezDiakritiky = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    function filtruj() {
      const q = hledat ? bezDiakritiky(hledat.value.trim()) : '';
      let nic = true;
      nabidka.querySelectorAll('.nab-tvary-telo section').forEach(sek => {
        let n = 0;
        sek.querySelectorAll('.dlazdice').forEach(b => {
          const ok = !q || bezDiakritiky(b.textContent + ' ' + (b.dataset.druh || '')).includes(q);
          (b.closest('.dlazdice-obal') || b).hidden = !ok;
          if (ok) n++;
        });
        sek.hidden = !!q && !n;
        if (n) nic = false;
      });
      const zadne = document.getElementById('tvaryNic');
      if (zadne) zadne.hidden = !q || !nic;
    }
    if (hledat) {
      hledat.addEventListener('input', filtruj);
      hledat.addEventListener('keydown', e => {
        const prvni = [...nabidka.querySelectorAll('.dlazdice')].find(b => !b.hidden && !(b.closest('.dlazdice-obal') || {}).hidden && !b.closest('section').hidden);
        if (e.key === 'ArrowDown' && prvni) { e.preventDefault(); prvni.focus(); }
        else if (e.key === 'Enter' && prvni) {
          e.preventDefault();
          // tvary a díly se vkládají přes pointerup/Enter na dlaždici (ne click); zvláštní dlaždice (skica, SVG, vlastní) klikem
          if (prvni.dataset.druh && !prvni.classList.contains('zvlastni')) {
            M.pridejTvar(prvni.dataset.druh, mistoUprostred(prvni.dataset.druh));
            if (!e.shiftKey) zavriNabidku();
          } else prvni.click();
        }
      });
    }
    // skoky na sekce v nabídce (bez změny adresy stránky)
    nabidka.querySelectorAll('.nab-tvary-skoky a').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const cil = document.querySelector(a.getAttribute('href'));
      if (cil) cil.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }));
    // klik na dlaždici jinou cestou (vlastní tvary, skica, SVG) nabídku také zavře; Shift + klik ji nechá
    nabidka.addEventListener('click', e => {
      const b = e.target.closest('.dlazdice');
      if (b && !e.shiftKey && !e.target.closest('.smaz-tvar')) setTimeout(zavriNabidku, 0);
    });
    return { misto, mistoUprostred };
  };
})(MDL);
