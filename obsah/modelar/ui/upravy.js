/* Modelář 3D – okna úprav: Pole, Rozdělit rovinou, Vzor děr na ploše, Ovinout SVG kolem válce.
   Pole i rozdělení ukazují živý náhled (pole jako „úprava“ – Zrušit vrátí stav,
   rozdělení průsvitnou rovinou ve scéně). Vzor děr: režim klikání na plochu,
   pak okno s 2D náhledem a počtem děr. Obalení SVG: vybraný válec + soubor SVG. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const cti = id => M.prectiCislo($(id).value);
  const vybrano = (okno, jmeno) => okno.querySelector(`input[name=${jmeno}]:checked`).value;

  /** SVG náhled 2D obrysů (pole kontur) do prvku. */
  function nahled2D(el, skupiny) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const g of skupiny) for (const k of g.kontury) for (const [x, y] of k) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (!isFinite(x0)) { el.innerHTML = ''; return; }
    const o = Math.max(x1 - x0, y1 - y0) * 0.05 + 0.1;
    el.innerHTML = `<svg viewBox="${x0 - o} ${-y1 - o} ${x1 - x0 + 2 * o} ${y1 - y0 + 2 * o}">${skupiny.map(g =>
      `<path class="${g.trida}" fill-rule="evenodd" d="${g.kontury.map(k => 'M' + k.map(p => `${p[0].toFixed(3)},${(-p[1]).toFixed(3)}`).join('L') + 'Z').join('')}"/>`).join('')}</svg>`;
  }

  M.vytvorUpravy = function (S) {
    // ------------------------------------------------------------ pole
    const oknoPole = $('oknoPole');
    let pole = null;
    function aktualizujPole() {
      const typ = vybrano(oknoPole, 'poleTyp');
      oknoPole.querySelectorAll('[data-typ]').forEach(el => { el.hidden = !el.dataset.typ.split(' ').includes(typ); });
      const v = typ === 'linearni'
        ? { typ, pocet: [cti('poleNx'), cti('poleNy'), cti('poleNz')].map(n => M.omez(Math.round(n) || 1, 1, 100)), rozestup: [cti('poleDx'), cti('poleDy'), cti('poleDz')].map(x => x || 0) }
        : { typ, pocet: M.omez(Math.round(cti('polePocet')) || 2, 1, 360), uhel: M.omez(isFinite(cti('poleUhel')) && cti('poleUhel') !== 0 ? cti('poleUhel') : 360, -3600, 3600),
            uhelKrok: M.omez(isFinite(cti('poleUhelKrok')) && cti('poleUhelKrok') !== 0 ? cti('poleUhelKrok') : 30, -360, 360),
            stoupaniKrok: cti('poleStoupani') || 0, polomerKrok: cti('polePolomer') || 0, stred: [cti('poleSx') || 0, cti('poleSy') || 0], natacet: $('poleNatacet').checked };
      const kusu = typ === 'linearni' ? v.pocet[0] * v.pocet[1] * v.pocet[2] : v.pocet;
      if (kusu * pole.ids.length > 2000) {
        // náhled zpět na původní stav a Vytvořit vypnout (jinak by potvrdil starý náhled)
        pole.kopie = [];
        M.zmenDokument(pole.zaklad, '', { docasne: true });
        $('poleInfo').textContent = '⚠ Víc než 2000 kopií – zmenši počet.';
        $('poleOk').disabled = true;
        return;
      }
      $('poleOk').disabled = false;
      const r = M.poleUzlu(pole.zaklad, pole.ids, v);
      pole.kopie = r.kopie;
      M.zmenDokument(r.dok, '', { docasne: true });
      const omezeno = typ === 'linearni' ? [cti('poleNx'), cti('poleNy'), cti('poleNz')].some(n => n > 100) : cti('polePocet') > 360;
      $('poleInfo').textContent = `${M.pocet(r.kopie.length, 'kopie', 'kopie', 'kopií')} (celkem ${M.pocet(kusu, 'prvek', 'prvky', 'prvků')} pole)`
        + (omezeno ? (typ === 'linearni' ? ' – nejvýš 100 v jedné ose' : ' – nejvýš 360 kusů') : '');
    }
    M.otevriPole = function () {
      const ids = M.vybraneVolne().map(u => u.id);
      if (!ids.length) return;
      const ob = M.obalkaVice(M.vybraneUzly());
      $('poleDx').value = M.mm(ob.max[0] - ob.min[0] + 5, 2); $('poleDy').value = M.mm(ob.max[1] - ob.min[1] + 5, 2); $('poleDz').value = '0';
      pole = { ids, zaklad: M.zacniUpravu(), kopie: [] };
      oknoPole.showModal();
      const prvni = oknoPole.querySelector('input:not([type=radio]):not([hidden])');
      if (prvni) { prvni.focus(); prvni.select && prvni.select(); }
      aktualizujPole();
    };
    oknoPole.addEventListener('input', () => { if (pole) aktualizujPole(); });
    oknoPole.addEventListener('change', () => { if (pole) aktualizujPole(); });
    const zavriPole = ok => {
      if (!pole) return;
      const p = pole; pole = null;
      oknoPole.close();
      if (!ok) { M.zrusUpravu(); return; }
      let vyber = p.ids.concat(p.kopie);
      // seskupení je součástí téže úpravy: celé pole = jeden krok Zpět
      if ($('poleSeskupit').checked && vyber.length > 1) {
        const r = M.seskupUzly(M.app.dok, vyber, { nazev: 'Pole' });
        if (r.id) { M.zmenDokument(r.dok, '', { docasne: true }); vyber = [r.id]; }
      }
      M.nastavVyber(vyber);
      M.dokonciUpravu('Pole');
    };
    $('poleOk').onclick = () => zavriPole(true);
    $('poleZrusit').onclick = () => zavriPole(false);
    oknoPole.addEventListener('cancel', e => { e.preventDefault(); zavriPole(false); });

    // ------------------------------------------------------------ rozdělit rovinou
    const oknoRez = $('oknoRez');
    let rez = null, rovinaMesh = null;
    function aktualizujRez() {
      const u = M.najdiUzel(M.app.dok, rez.id);
      const r = M.rovinaRozdeleni(u, vybrano(oknoRez, 'rezOsa'), cti('rezPoloha') || 0, [cti('rezA') || 0, cti('rezB') || 0]);
      rez.rovina = r;
      const ob = M.obalkaUzlu(u);
      const vel = Math.hypot(ob.max[0] - ob.min[0], ob.max[1] - ob.min[1], ob.max[2] - ob.min[2]) * 1.2 + 5;
      if (!rovinaMesh) {
        rovinaMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
        rovinaMesh.renderOrder = 5;
        S.scena.add(rovinaMesh);
      }
      rovinaMesh.scale.set(vel, vel, 1);
      rovinaMesh.position.set(...r.bod);
      rovinaMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...r.normala));
      M.prekresli();
    }
    function zavriRez(ok) {
      if (!rez) return;
      const r = rez; rez = null;
      oknoRez.close();
      if (rovinaMesh) { S.scena.remove(rovinaMesh); rovinaMesh.geometry.dispose(); rovinaMesh.material.dispose(); rovinaMesh = null; M.prekresli(); }
      if (!ok) return;
      let v;
      try { v = M.rozdelRovinou(M.app.dok, r.id, r.rovina, M.omez(cti('rezMezera') || 0, 0, 1000)); }
      catch (e) { Dialog.chyba(e.message); return; }
      if (!v.ids.length) return;
      M.zmenDokument(v.dok, 'Rozdělit rovinou');
      M.nastavVyber(v.ids);
      Dialog.info('Těleso rozděleno na dvě části (skupiny – jdou dál upravovat; zrušením seskupení se vrátí jejich části).');
    }
    M.otevriRez = function () {
      const u = M.vybraneVolne();
      if (u.length !== 1) { Dialog.chyba('Vyber jedno těleso, které chceš rozdělit.'); return; }
      rez = { id: u[0].id };
      oknoRez.showModal();
      aktualizujRez();
    };
    oknoRez.addEventListener('input', () => { if (rez) aktualizujRez(); });
    oknoRez.addEventListener('change', () => { if (rez) aktualizujRez(); });
    $('rezOk').onclick = () => zavriRez(true);
    $('rezZrusit').onclick = () => zavriRez(false);
    oknoRez.addEventListener('cancel', e => { e.preventDefault(); zavriRez(false); });

    // ------------------------------------------------------------ vzor děr
    const oknoDer = $('oknoDer');
    let der = null;
    const volbyDer = () => ({ tvar: $('derTvar').value, velikost: M.omez(cti('derVelikost') || 3, 0.3, 500), rozestup: M.omez(cti('derRozestup') || 6, 0.3, 2000),
      rozlozeni: vybrano(oknoDer, 'derRozlozeni'), okraj: Math.max(0, cti('derOkraj') || 0), hloubka: Math.max(0, cti('derHloubka') || 0),
      pocet: vybrano(oknoDer, 'derRezim') === 'pocet' ? [M.omez(Math.round(cti('derPocetX') || 1), 1, 200), M.omez(Math.round(cti('derPocetY') || 1), 1, 200)] : null });
    function aktualizujDer() {
      const v = volbyDer();
      const poctem = vybrano(oknoDer, 'derRezim') === 'pocet';
      $('derRadekRozestup').hidden = poctem; $('derRadekPocet').hidden = !poctem;
      // rozměr plochy (obálka oblasti) – ať je jasné, kolik děr se vejde
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const k of der.plocha.oblast) for (const [x, y] of k) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      $('derPlocha').textContent = `Plocha ${M.mm(x1 - x0, 1)} × ${M.mm(y1 - y0, 1)} mm`;
      try { der.stredy = M.stredyDer(der.plocha.oblast, v); }
      catch (e) {
        der.stredy = [];
        nahled2D($('derNahled'), [{ trida: 'oblast', kontury: der.plocha.oblast }]);
        $('derInfo').textContent = '⚠ ' + e.message;
        $('derOk').disabled = true;
        return;
      }
      nahled2D($('derNahled'), [{ trida: 'oblast', kontury: der.plocha.oblast }, { trida: 'diry', kontury: der.stredy.map(([x, y]) => M.obrysDiry(v.tvar, x, y, v.velikost)) }]);
      $('derInfo').textContent = !der.stredy.length ? '⚠ Na plochu se nevejde žádná díra – zmenši okraj, velikost nebo rozestup.'
        : der.stredy.length === 1 && !v.pocet ? '1 díra – při tomto rozestupu a odstupu od kraje se víc nevejde. Zmenši rozestup nebo odstup, nebo zvol „Počtem děr po celé ploše“.'
        : M.pocet(der.stredy.length, 'díra', 'díry', 'děr');
      $('derOk').disabled = !der.stredy.length;
    }
    M.otevriVzorDer = function (zasah) {
      const u = M.najdiUzel(M.app.dok, zasah.id);
      if (!u || u.zamceno || u.role === 'dira') { Dialog.chyba('Klikni na plochu plného (nezamčeného) tělesa.'); return; }
      const sit = S.telesa.svetovaSit(u.id);
      if (!sit || zasah.trojuhelnik == null) return;
      const plocha = M.oblastPlochy(sit, zasah.trojuhelnik);
      if (!plocha.oblast.length) { Dialog.chyba('Tady není rovná plocha.'); return; }
      der = { id: u.id, plocha };
      oknoDer.showModal();
      aktualizujDer();
    };
    oknoDer.addEventListener('input', () => { if (der) aktualizujDer(); });
    oknoDer.addEventListener('change', () => { if (der) aktualizujDer(); });
    $('derOk').onclick = () => {
      const d = der; der = null;
      oknoDer.close();
      const r = M.vzorDer(M.app.dok, d.id, d.plocha, volbyDer());
      if (!r.id) return;
      M.zmenDokument(r.dok, 'Vzor děr');
      M.nastavVyber([r.id]);
      Dialog.info(`${r.pocet === 1 ? 'Vyvrtána' : r.pocet <= 4 ? 'Vyvrtány' : 'Vyvrtáno'} ${M.pocet(r.pocet, 'díra', 'díry', 'děr')} (skupina – díry jsou uvnitř jako skica, jde upravit dvojklikem po zrušení seskupení).`);
    };
    $('derZrusit').onclick = () => { der = null; oknoDer.close(); };
    oknoDer.addEventListener('cancel', () => { der = null; });

    // ------------------------------------------------------------ obalit SVG kolem válce
    const oknoObal = $('oknoObal');
    let obal = null;
    const vstupObal = document.createElement('input');
    vstupObal.type = 'file'; vstupObal.accept = '.svg'; vstupObal.hidden = true; vstupObal.id = 'vstupObal';
    document.body.appendChild(vstupObal);
    function aktualizujObal() {
      $('obalTloustkaRadek').hidden = vybrano(oknoObal, 'obalCo') !== 'obrys';
      try { obal.kontury = M.svgNaKontury(obal.svg, vybrano(oknoObal, 'obalCo'), cti('obalTloustka') || 0); }
      catch (e) { obal.kontury = null; $('obalChyba').textContent = '⚠ ' + e.message; $('obalOk').disabled = true; $('obalNahled').innerHTML = ''; return; }
      $('obalChyba').textContent = '';
      const sirka = cti('obalSirka') > 0 ? cti('obalSirka') : obal.kontury.sirka;
      const k = sirka / obal.kontury.sirka;
      obal.konturyMm = obal.kontury.kontury.map(o => o.map(([x, y]) => [x * k, y * k]));
      const obvod = 2 * Math.PI * obal.R;
      $('obalInfo').textContent = `Válec ⌀ ${M.mm(obal.R * 2, 1)} mm (obvod ${M.mm(obvod, 1)} mm), vzor ${M.mm(sirka, 1)} × ${M.mm(obal.kontury.vyska * k, 1)} mm`;
      const moc = sirka > obvod * 0.97;
      if (moc) $('obalChyba').textContent = '⚠ Vzor je delší než obvod válce – zmenši šířku.';
      $('obalOk').disabled = moc;
      nahled2D($('obalNahled'), [{ trida: 'diry', kontury: obal.konturyMm }]);
    }
    M.otevriObal = function () {
      const u = M.vybraneVolne();
      if (u.length !== 1) { Dialog.chyba('Vyber jeden válec (nebo jiné těleso s osou Z), kolem kterého se má vzor ovinout.'); return; }
      obal = { id: u[0].id, R: u[0].rozmer[0] / 2 };
      vstupObal.click();
    };
    vstupObal.addEventListener('change', async () => {
      const f = vstupObal.files[0];
      vstupObal.value = '';
      if (!f || !obal) return;
      try { obal.svg = M.ctiSvg(await f.text()); } catch (e) { Dialog.chyba(f.name + ': ' + e.message); return; }
      obal.nazev = f.name.replace(/\.[^.]+$/, '');
      const u = M.najdiUzel(M.app.dok, obal.id);
      $('obalVyska').value = M.mm(u.rozmer[2] / 2, 2);
      $('obalSirka').value = '';
      oknoObal.showModal();
      aktualizujObal();
    });
    /** Ovine vzor (obrysy v mm) kolem válce id; pro testy volatelné přímo. */
    M.obalitVzorem = function (id, konturyMm, volby) {
      const u = M.najdiUzel(M.app.dok, id);
      const R = u.rozmer[0] / 2, vyryty = volby.rezim === 'vyryty';
      const o = M.normalizujUzel({ druh: 'obalSvg', nazev: volby.nazev || 'Ovinutý vzor', role: vyryty ? 'dira' : 'teleso',
        barva: volby.barva || '#e5533c', param: { kontury: konturyMm, polomer: R, hloubka: volby.hloubka, rezim: volby.rezim }, poloha: [0, 0, 0] });
      // osa vzoru = osa válce (lokální Z), výška středu vzoru nad spodkem válce, natočení kolem osy
      const q = M.quatUzlu(u).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (volby.natoceni || 0) * Math.PI / 180));
      const pocatek = new THREE.Vector3(0, 0, -u.rozmer[2] / 2 + volby.vyska).applyMatrix4(M.tuhaMaticeUzlu(u));
      const n = M.normalizujUzel(Object.assign({}, o, { rotace: M.rotaceZQuat(q), poloha: new THREE.Vector3(...o.stred).applyQuaternion(q).add(pocatek).toArray() }));
      const r = M.seskupUzly(M.pridejUzly(M.app.dok, [n]), [id, n.id], { nazev: u.nazev + ' se vzorem', barevne: !vyryty });
      M.zmenDokument(r.dok, 'Ovinout vzorem');
      M.nastavVyber([r.id]);
      return r.id;
    };
    oknoObal.addEventListener('input', () => { if (obal && obal.svg) aktualizujObal(); });
    oknoObal.addEventListener('change', () => { if (obal && obal.svg) aktualizujObal(); });
    $('obalOk').onclick = () => {
      const o = obal; obal = null;
      oknoObal.close();
      const u = M.najdiUzel(M.app.dok, o.id), h = u ? u.rozmer[2] : 1000;
      M.obalitVzorem(o.id, o.konturyMm, { rezim: vybrano(oknoObal, 'obalRezim'), hloubka: M.omez(cti('obalHloubka') || 1, 0.05, 100),
        vyska: M.omez(cti('obalVyska') || 0, 0, h), natoceni: cti('obalNatoceni') || 0, nazev: o.nazev });
    };
    $('obalZrusit').onclick = () => { obal = null; oknoObal.close(); };
    oknoObal.addEventListener('cancel', () => { obal = null; });
  };
})(MDL);
