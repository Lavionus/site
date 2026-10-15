/* Modelář 3D – příprava tisku v rozhraní: údaj ve stavovém řádku (hmotnost a délka
   filamentu výběru nebo celého modelu), panel Kontrola tisku (materiál, průměr struny,
   výplň, objem a hmotnost, převisy, seznam problémů s opravou, rozmístění na desce)
   a zvýraznění převisů ve scéně (plochy, které při tisku potřebují podpěry). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'modelar_tisk';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cz = (x, des = 1) => Number(x).toLocaleString('cs', { minimumFractionDigits: des, maximumFractionDigits: des });

  M.vytvorTisk = function (S, T) {
    let nast = { material: 'PLA', prumer: 1.75, vypln: 20, uhel: 45 };
    try { Object.assign(nast, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* bez úložiště */ }
    if (!M.MATERIALY[nast.material]) nast.material = 'PLA';
    const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* bez úložiště */ } };

    // ------------------------------------------------------------ objem (sítě ve světě; skupiny až po dopočítání)
    const pamet = new Map();
    function objemUzlu(u) {
      const g = M.pocitaWorker(u) ? T.geometrieObjektu(u.id) : null;
      if (g && (g.ceka || g.chyba)) return null;
      const klic = u.id + '|' + M.klicGeometrie(u) + '|' + u.rozmer.join(',');
      if (pamet.has(klic)) return pamet.get(klic);
      const sit = T.svetovaSit(u.id);
      if (!sit) return null;
      const v = Math.abs(M.objemSite(sit));
      if (pamet.size > 500) pamet.clear();
      pamet.set(klic, v);
      return v;
    }
    /** Tisknutelná tělesa: vybraná, nebo všechna (bez skrytých a samostatných děr). */
    const telesa = () => {
      const vyber = M.vybraneUzly().filter(u => !u.skryto && u.role !== 'dira');
      return { uzly: vyber.length ? vyber : M.telesaKExportu(M.app.dok), vyber: vyber.length > 0 };
    };
    function souhrn() {
      const { uzly, vyber } = telesa();
      let V = 0, ceka = false;
      for (const u of uzly) { const v = objemUzlu(u); if (v == null) ceka = true; else V += v; }
      return { V, ceka, vyber, pocet: uzly.length, ...M.udajeTisku(V, nast.material, nast.prumer, nast.vypln) };
    }

    // ------------------------------------------------------------ stavový řádek
    const stav = $('stavTisk');
    let planovano = false;
    function obnovStav() {
      planovano = false;
      if (!stav) return;
      const s = souhrn();
      if (!s.pocet) { stav.textContent = ''; stav.hidden = true; return; }
      stav.hidden = false;
      stav.textContent = `⚖ ${s.ceka ? '≈' : ''}${cz(s.hmotnost, s.hmotnost < 10 ? 1 : 0)} g · ${cz(s.delka, 2)} m ${M.MATERIALY[nast.material].nazev.split(' ')[0]}`;
      stav.title = `${s.vyber ? 'Výběr' : 'Celý model'}: objem ${cz(s.objemCm3, 2)} cm³, plné těleso ${cz(s.hmotnostPlna, 1)} g; odhad při výplni ${nast.vypln} % (klik = Kontrola tisku)`;
    }
    const naplanuj = () => { if (!planovano) { planovano = true; setTimeout(obnovStav, 120); } };
    M.na('dokument', e => { if (!e || !e.docasne) naplanuj(); });
    M.na('vyber', naplanuj);
    M.na('geometrie', naplanuj);
    if (stav) { stav.classList.add('klikaci'); stav.addEventListener('click', () => M.otevriKontroluTisku()); }

    // ------------------------------------------------------------ převisy ve scéně
    let prevesyZapnute = false;
    const matPrevisu = new THREE.ShaderMaterial({
      uniforms: { mez: { value: -Math.sin(nast.uhel * Math.PI / 180) } },
      vertexShader: `varying vec3 vN; varying float vZ;
        void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vZ = w.z;
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float mez; varying vec3 vN; varying float vZ;
        void main() { if (normalize(vN).z >= mez || vZ < 0.2) discard; gl_FragColor = vec4(0.95, 0.18, 0.12, 0.72); }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
    /** Ke každému tělesu (ne díra) průhledný překryv se stejnou geometrií; při výměně geometrie se srovná. */
    function srovnejPrevesy() {
      if (!prevesyZapnute) return;
      S.model.traverse(o => {
        if (!o.isMesh || o.userData.previs || !o.material || !o.material.isMeshStandardMaterial || o.material.transparent) return;
        let p = o.children.find(c => c.userData.previs);
        if (!p) { p = new THREE.Mesh(o.geometry, matPrevisu); p.userData.previs = true; p.renderOrder = 2; o.add(p); }
        if (p.geometry !== o.geometry) p.geometry = o.geometry;
      });
    }
    function odeberPrevesy() {
      const pryc = [];
      S.model.traverse(o => { if (o.userData.previs) pryc.push(o); });
      for (const o of pryc) o.parent.remove(o);
    }
    M.prepniPrevesy = function (zap = !prevesyZapnute) {
      prevesyZapnute = !!zap;
      if (prevesyZapnute) srovnejPrevesy(); else odeberPrevesy();
      document.querySelectorAll('[data-prikaz=prevesy]').forEach(b => b.setAttribute('aria-pressed', prevesyZapnute ? 'true' : 'false'));
      const t = $('tiskPrevesy'); if (t) t.setAttribute('aria-pressed', prevesyZapnute ? 'true' : 'false');
      M.prekresli();
    };
    M.prevesyZapnute = () => prevesyZapnute;
    M.na('kamera', srovnejPrevesy);

    // ------------------------------------------------------------ panel Kontrola tisku
    const okno = $('oknoTisk');
    const deska = () => ({ sirka: S.deska.sirka, hloubka: S.deska.hloubka });
    function obnovPanel() {
      if (!okno || !okno.open) return;
      const s = souhrn();
      $('tiskSouhrn').innerHTML = !s.pocet ? '<p class="poznamka">Na desce není nic k tisku.</p>' : `
        <table class="tisk-tab"><tbody>
          <tr><th>${s.vyber ? 'Výběr' : 'Celý model'}</th><td>${M.pocet(s.pocet, 'těleso', 'tělesa', 'těles')}${s.ceka ? ' (některá se ještě počítají)' : ''}</td></tr>
          <tr><th>Objem</th><td>${cz(s.objemCm3, 2)} cm³</td></tr>
          <tr><th>Hmotnost</th><td><b>${cz(s.hmotnost, 1)} g</b> při výplni ${nast.vypln} % <span class="pozn">(plné ${cz(s.hmotnostPlna, 1)} g)</span></td></tr>
          ${s.delka ? `<tr><th>Filament</th><td>${cz(s.delka, 2)} m (⌀ ${cz(nast.prumer, 2)} mm)</td></tr>` : ''}
        </tbody></table>`;
      // převisy
      let pv = 0, pl = 0;
      for (const u of telesa().uzly) { const sit = T.svetovaSit(u.id); if (!sit) continue; const r = M.prevesySite(sit, nast.uhel); pv += r.prevesy; pl += r.celkem; }
      $('tiskPrevesyInfo').textContent = !pl ? '' : pv < 1
        ? `Převisy nad ${nast.uhel}°: žádné – tiskne se bez podpěr.`
        : `Převisy nad ${nast.uhel}°: ${cz(pv / 100, 1)} cm² (${cz(pv / pl * 100, 0)} % povrchu) – potřebují podpěry, nebo těleso otoč (F = položit plochou).`;
      // problémy
      const problemy = M.kontrolaTisku(M.app.dok, deska());
      const chyby = T.info().chyby;
      const seznam = $('tiskProblemy');
      seznam.innerHTML = (problemy.length || chyby.length) ? problemy.map((p, i) => `<li class="problem-${p.druh}">
          <span>${esc(p.text)}</span>
          <span class="tisk-akce"><button type="button" class="tl" data-vybrat="${i}">Vybrat</button>${p.oprava ? `<button type="button" class="tl hlavni-tl" data-opravit="${i}">${p.oprava === 'polozit' ? 'Položit na desku' : 'Posunout na desku'}</button>` : ''}</span>
        </li>`).join('') + chyby.slice(0, 3).map(c => `<li class="problem-chyba"><span>⚠ ${esc(c)}</span></li>`).join('')
        : '<li class="ok">✓ Žádné problémy – model je připravený k exportu.</li>';
      seznam._problemy = problemy;
    }
    M.otevriKontroluTisku = function () {
      if (!okno) return;
      $('tiskMaterial').value = nast.material; $('tiskPrumer').value = String(nast.prumer); $('tiskVypln').value = String(nast.vypln);
      M.otevriPanel(okno);
      obnovPanel();
    };
    if (okno) {
      $('tiskMaterial').innerHTML = Object.entries(M.MATERIALY).map(([k, m]) => `<option value="${k}">${esc(m.nazev)} – ${cz(m.hustota, 2)} g/cm³</option>`).join('');
      const zmena = () => {
        nast.material = $('tiskMaterial').value;
        nast.prumer = parseFloat($('tiskPrumer').value) || 1.75;
        nast.vypln = M.omez(Math.round(M.prectiCislo($('tiskVypln').value)) || 0, 0, 100);
        uloz(); obnovPanel(); obnovStav();
      };
      ['tiskMaterial', 'tiskPrumer', 'tiskVypln'].forEach(id => $(id).addEventListener('change', zmena));
      $('tiskSeznamZavrit').onclick = () => okno.close();
      okno.addEventListener('cancel', e => { e.preventDefault(); okno.close(); });
      $('tiskPrevesy').onclick = () => M.prepniPrevesy();
      $('tiskRozmistit').onclick = () => M.spustPrikaz('rozmistit');
      $('tiskProblemy').addEventListener('click', e => {
        const b = e.target.closest('[data-vybrat], [data-opravit]');
        const p = b && $('tiskProblemy')._problemy[+(b.dataset.vybrat ?? b.dataset.opravit)];
        if (!p) return;
        if (b.dataset.vybrat != null) { M.nastavVyber(p.ids); return; }
        const dok = p.oprava === 'polozit' ? M.polozNaRovinu(M.app.dok, p.ids) : M.posunNaDesku(M.app.dok, p.ids, deska());
        M.zmenDokument(dok, p.oprava === 'polozit' ? 'Položit na desku' : 'Posunout na desku');
      });
      M.na('dokument', e => { if (!e || !e.docasne) obnovPanel(); });
      M.na('vyber', obnovPanel);
      M.na('geometrie', () => { if (okno.open) obnovPanel(); });
    }

    /** Rozmístí tělesa (vybraná, jinak všechna viditelná) vedle sebe na desce. */
    M.rozmistitNaDesce = function () {
      const vyber = M.vybraneVolne().filter(u => !u.skryto);
      const ids = (vyber.length > 1 ? vyber : M.app.dok.uzly.filter(u => !u.skryto && !u.zamceno)).map(u => u.id);
      if (!ids.length) return;
      const r = M.rozlozNaDesce(M.app.dok, ids, deska(), 5);
      M.zmenDokument(r.dok, 'Rozmístit na desce');
      if (!r.vejde) Dialog.info('Všechna tělesa se na desku nevešla – část leží za okrajem. Zvětši desku, nebo tiskni ve víc dávkách.');
    };
    obnovStav();
  };
})(MDL);
