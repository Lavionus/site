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
    let nast = { material: 'PLA', prumer: 1.75, vypln: 20, uhel: 45, cena: 500 };
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
    const telesa = (sVyberem = true) => {
      const vyber = sVyberem ? M.vybraneUzly().filter(u => !u.skryto && u.role !== 'dira') : [];
      return { uzly: vyber.length ? vyber : M.telesaKExportu(M.app.dok), vyber: vyber.length > 0 };
    };
    /** Souhrn: stavový řádek bere výběr (je-li), panel Kontroly tisku celý model – nebo výběr, když je zaškrtnuto. */
    function souhrn(proPanel = false) {
      const { uzly, vyber } = telesa(!proPanel || !!nast.jenVyber);
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
      const kc = M.cenaTisku(s.hmotnost, nast.cena);
      stav.textContent = `⚖ ${s.ceka ? '≈' : ''}${cz(s.hmotnost, s.hmotnost < 10 ? 1 : 0)} g · ${cz(s.delka, 2)} m ${M.MATERIALY[nast.material].nazev.split(' ')[0]}${nast.cena > 0 ? ` · ${cz(kc, kc < 10 ? 2 : kc < 100 ? 1 : 0)} Kč` : ''}`;
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
      // mez = převis (červeně), mez2 = o 10° mírnější – na hraně, tiskne se, ale hůř (žlutě)
      uniforms: { mez: { value: -Math.sin(nast.uhel * Math.PI / 180) }, mez2: { value: -Math.sin((nast.uhel - 10) * Math.PI / 180) } },
      // normála ve světě inverzní transpozicí (roztažená skupina); řez pohledem ořízne i překryv
      vertexShader: `#include <clipping_planes_pars_vertex>
        varying vec3 vN; varying float vZ;
        void main() { vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vZ = w.z;
          vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <clipping_planes_vertex>
        }`,
      fragmentShader: `#include <clipping_planes_pars_fragment>
        uniform float mez; uniform float mez2; varying vec3 vN; varying float vZ;
        void main() {
          #include <clipping_planes_fragment>
          float nz = normalize(vN).z;
          if (nz >= mez2 || vZ < 0.2) discard;
          gl_FragColor = nz < mez ? vec4(0.95, 0.18, 0.12, 0.72) : vec4(0.98, 0.78, 0.15, 0.55); }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, clipping: true,
    });
    /** Ke každému tělesu (ne díra) průhledný překryv se stejnou geometrií; při výměně geometrie se srovná. */
    function srovnejPrevesy() {
      if (!prevesyZapnute) return;
      const pryc = [];
      S.model.traverse(o => {
        if (!o.isMesh || o.userData.previs) return;
        const p0 = o.children.find(c => c.userData.previs);
        // díra, průhledné nebo skryté těleso: překryv pryč (těleso přepnuté na díru by zůstalo červené)
        if (!o.material || !o.material.isMeshStandardMaterial || o.material.transparent || !o.visible) { if (p0) pryc.push(p0); return; }
        let p = p0;
        if (!p) { p = new THREE.Mesh(o.geometry, matPrevisu); p.userData.previs = true; p.renderOrder = 2; o.add(p); }
        if (p.geometry !== o.geometry) p.geometry = o.geometry;
        // řez pohledem: stejné roviny ořezu jako těleso
        if (matPrevisu.clippingPlanes !== o.material.clippingPlanes) { matPrevisu.clippingPlanes = o.material.clippingPlanes; matPrevisu.needsUpdate = true; }
      });
      for (const o of pryc) o.parent.remove(o);
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

    // ------------------------------------------------------------ podpěry (odhad objemu a náhled sloupů)
    let podperyVrstva = null, podperyKlic = '';
    const matPodper = new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
    function zrusPodpery() {
      if (podperyVrstva) { S.scena.remove(podperyVrstva); podperyVrstva.geometry.dispose(); podperyVrstva = null; }
      podperyKlic = '';
      const b = $('tiskPodpery'); if (b) b.setAttribute('aria-pressed', 'false');
      M.prekresli();
    }
    /** Spočítá podpěry tisknutelných těles (výběru) – objem a hmotnost; ukazat = modré sloupy ve scéně. */
    M.spocitejPodpery = function (ukazat = true) {
      zrusPodpery();
      const site = [];
      let ceka = 0;
      // podpěra smí stát na kterémkoli tělese na desce, převisy se počítají jen u tisknutých
      for (const u of telesa().uzly) { const s = T.svetovaSit(u.id); if (s) site.push(s); else ceka++; }
      const r = M.podperySite(site, nast.uhel);
      const m = M.MATERIALY[nast.material] || { hustota: 1.24 };
      // podpěry se tisknou řídce (asi 15 % objemu)
      const g = r.objem / 1000 * 0.15 * m.hustota;
      if (ukazat && r.sloupy) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(r.sloupy.poz, 3));
        geo.setIndex(new THREE.BufferAttribute(r.sloupy.idx, 1));
        podperyVrstva = new THREE.Mesh(geo, matPodper);
        podperyVrstva.renderOrder = 4;
        podperyVrstva.userData.prekryv = true;
        S.scena.add(podperyVrstva);
        podperyKlic = klicTenkych();
        $('tiskPodpery').setAttribute('aria-pressed', 'true');
      }
      const info = $('tiskPodperyInfo');
      if (info) info.textContent = !r.objem ? (ceka ? 'Některá tělesa se ještě počítají.' : 'Podpěry nejsou potřeba. ✓')
        : `Podpěry ≈ ${cz(r.objem / 1000, 1)} cm³ prostoru pod převisy, ≈ ${cz(g, 1)} g materiálu (při 15% hustotě podpěr)${r.sloupy || !ukazat ? '' : ' – sloupů je moc na náhled'}. Natočení tělesa (🧭) je může zmenšit.`;
      M.prekresli();
      return { objem: r.objem, plocha: r.plocha, hmotnost: g };
    };

    // ------------------------------------------------------------ tenké stěny (na požádání – výpočet je dražší)
    let tenkeVrstva = null, tenkeKlic = '';
    const matTenke = new THREE.MeshBasicMaterial({ color: 0xff2a6d, transparent: true, opacity: 0.75, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide });
    function zrusTenke() {
      if (tenkeVrstva) { S.scena.remove(tenkeVrstva); tenkeVrstva.geometry.dispose(); tenkeVrstva = null; }
      tenkeKlic = '';
      const b = $('tiskTenke'); if (b) b.setAttribute('aria-pressed', 'false');
      const i = $('tiskTenkeInfo'); if (i) i.textContent = '';
      M.prekresli();
    }
    /** Spočítá tenká místa všech tisknutelných těles (nebo výběru) a ukáže je červeně. */
    M.ukazTenkeSteny = function (minimum) {
      zrusTenke();
      const { uzly } = telesa();
      const poz = [], popisy = [];
      let nejtensi = Infinity, ceka = 0;
      for (const u of uzly) {
        const sit = T.svetovaSit(u.id);
        if (!sit) { ceka++; continue; }
        const r = M.tenkeSteny(sit, minimum);
        if (!r.plocha) continue;
        nejtensi = Math.min(nejtensi, r.nejtensi);
        popisy.push(`„${u.nazev}“ ${cz(r.plocha / 100, 1)} cm²`);
        for (let f = 0; f < r.tenke.length; f++) if (r.tenke[f]) for (let j = 0; j < 3; j++) { const v = sit.idx[f * 3 + j] * 3; poz.push(sit.poz[v], sit.poz[v + 1], sit.poz[v + 2]); }
      }
      const info = $('tiskTenkeInfo');
      if (poz.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
        tenkeVrstva = new THREE.Mesh(g, matTenke);
        tenkeVrstva.renderOrder = 3;
        tenkeVrstva.userData.prekryv = true;           // do náhledu projektu nepatří
        S.scena.add(tenkeVrstva);
        tenkeKlic = klicTenkych();
        info.textContent = `Tenčí než ${cz(minimum, 2)} mm (nejtenčí ${cz(nejtensi, 2)} mm): ${popisy.slice(0, 3).join(', ')}${popisy.length > 3 ? ' …' : ''} – zesil stěny, nebo je tryska nevytiskne.`;
      } else info.textContent = ceka ? 'Některá tělesa se ještě počítají – zkus to za chvíli.' : `Žádná stěna tenčí než ${cz(minimum, 2)} mm. ✓`;
      $('tiskTenke').setAttribute('aria-pressed', poz.length ? 'true' : 'false');
      M.prekresli();
      return { plocha: poz.length / 9, nejtensi };
    };
    // změna modelu: červená místa by lhala – pryč (znovu jedním klikem)
    const klicTenkych = () => M.app.dok.uzly.map(u => M.klicGeometrie(u) + u.poloha.join(',') + u.rotace.join(',') + u.rozmer.join(',')).join('|');
    M.na('dokument', e => { if (tenkeVrstva && (!e || !e.docasne) && klicTenkych() !== tenkeKlic) zrusTenke(); });
    M.na('dokument', e => { if (podperyVrstva && (!e || !e.docasne) && klicTenkych() !== podperyKlic) { zrusPodpery(); const i = $('tiskPodperyInfo'); if (i) i.textContent = ''; } });

    // ------------------------------------------------------------ panel Kontrola tisku
    const okno = $('oknoTisk');
    const deska = () => ({ sirka: S.deska.sirka, hloubka: S.deska.hloubka });
    const pametPrekryvu = new Map();
    function obnovPanel() {
      if (!okno || !okno.open) return;
      const s = souhrn(true);
      $('tiskSouhrn').innerHTML = !s.pocet ? '<p class="poznamka">Na desce není nic k tisku.</p>' : `
        <table class="tisk-tab"><tbody>
          <tr><th>${s.vyber ? 'Výběr' : 'Celý model'}</th><td>${M.pocet(s.pocet, 'těleso', 'tělesa', 'těles')}${s.ceka ? ' (některá se ještě počítají)' : ''}</td></tr>
          <tr><th>Objem</th><td>${cz(s.objemCm3, 2)} cm³</td></tr>
          <tr><th>Hmotnost</th><td><b>${cz(s.hmotnost, 1)} g</b> při výplni ${nast.vypln} % <span class="pozn">(plné ${cz(s.hmotnostPlna, 1)} g)</span></td></tr>
          ${s.delka ? `<tr><th>Filament</th><td>${cz(s.delka, 2)} m (⌀ ${cz(nast.prumer, 2)} mm)</td></tr>` : ''}
          ${nast.cena > 0 ? `<tr><th>Cena materiálu</th><td><b>${cz(M.cenaTisku(s.hmotnost, nast.cena), 2)} Kč</b> <span class="pozn">(cívka ${cz(nast.cena, 0)} Kč/kg)</span></td></tr>` : ''}
        </tbody></table>`;
      // převisy
      let pv = 0, pl = 0;
      for (const u of telesa().uzly) { const sit = T.svetovaSit(u.id); if (!sit) continue; const r = M.prevesySite(sit, nast.uhel); pv += r.prevesy; pl += r.celkem; }
      $('tiskPrevesyInfo').textContent = !pl ? '' : pv < 1
        ? `Převisy nad ${nast.uhel}°: žádné – tiskne se bez podpěr.`
        : `Převisy nad ${nast.uhel}°: ${cz(pv / 100, 1)} cm² (${cz(pv / pl * 100, 0)} % povrchu) – potřebují podpěry, nebo těleso otoč (F = položit plochou).`;
      // problémy
      // překryvy hledat mezi všemi tělesy na desce (ne jen vybranými)
      // sítě až na požádání (dvojice v paměti je nepotřebují – kopie celé sítě je u velkých modelů drahá)
      const nactene = new Map();
      const site = { get: id => { if (!nactene.has(id)) nactene.set(id, T.svetovaSit(id)); return nactene.get(id); } };
      // „jen vybraná tělesa“: problémy jen těch (překryvy hledá kontrola mezi všemi, ukázat ty s výběrem)
      const vsechny = M.kontrolaTisku(M.app.dok, deska(), site, pametPrekryvu), vyb = new Set(M.app.vyber);
      const problemy = nast.jenVyber && vyb.size ? vsechny.filter(p => !p.ids || p.ids.some(id => vyb.has(id))) : vsechny;
      const chyby = T.info().chyby;
      const seznam = $('tiskProblemy');
      seznam.innerHTML = (problemy.length || chyby.length) ? problemy.map((p, i) => `<li class="problem-${p.druh}">
          <span>${esc(p.text)}</span>
          <span class="tisk-akce"><button type="button" class="tl" data-vybrat="${i}">Vybrat</button>${p.oprava ? `<button type="button" class="tl hlavni-tl" data-opravit="${i}">${{ polozit: 'Položit na desku', dovnitr: 'Posunout na desku', rozmistit: 'Rozmístit' }[p.oprava]}</button>` : ''}</span>
        </li>`).join('') + chyby.slice(0, 3).map(c => `<li class="problem-chyba"><span>⚠ ${esc(c)}</span></li>`).join('')
        : '<li class="ok">✓ Žádné problémy – model je připravený k exportu.</li>';
      seznam._problemy = problemy;
    }
    M.otevriKontroluTisku = function () {
      if (!okno) return;
      $('tiskMaterial').value = nast.material; $('tiskPrumer').value = String(nast.prumer); $('tiskVypln').value = String(nast.vypln);
      $('tiskCena').value = cz(nast.cena, 0);
      $('tiskJenVyber').checked = !!nast.jenVyber;
      M.otevriPanel(okno);
      obnovPanel();
    };
    if (okno) {
      $('tiskMaterial').innerHTML = Object.entries(M.MATERIALY).map(([k, m]) => `<option value="${k}">${esc(m.nazev)} – ${cz(m.hustota, 2)} g/cm³</option>`).join('');
      const zmena = () => {
        nast.material = $('tiskMaterial').value;
        nast.prumer = parseFloat($('tiskPrumer').value) || 1.75;
        nast.vypln = M.omez(Math.round(M.prectiCislo($('tiskVypln').value)) || 0, 0, 100);
        nast.jenVyber = $('tiskJenVyber').checked;
        const c = M.prectiCislo($('tiskCena').value);
        nast.cena = isFinite(c) ? M.omez(c, 0, 100000) : nast.cena;
        uloz(); obnovPanel(); obnovStav();
      };
      ['tiskMaterial', 'tiskPrumer', 'tiskVypln', 'tiskCena', 'tiskJenVyber'].forEach(id => $(id).addEventListener('change', zmena));
      $('tiskSeznamZavrit').onclick = () => okno.close();
      okno.addEventListener('cancel', e => { e.preventDefault(); okno.close(); });
      $('tiskPrevesy').onclick = () => M.prepniPrevesy();
      $('tiskPodpery').onclick = () => { if (podperyVrstva) { zrusPodpery(); $('tiskPodperyInfo').textContent = ''; } else M.spocitejPodpery(true); };
      $('tiskRozmistit').onclick = () => M.spustPrikaz('rozmistit');
      $('tiskOrientace').onclick = () => M.spustPrikaz('orientace');
      $('tiskTenke').onclick = () => {
        if (tenkeVrstva) { zrusTenke(); return; }
        const m = M.prectiCislo($('tiskStena').value);
        if (!(m > 0 && m <= 20)) { M.oznamPole($('tiskStena'), 'Nejtenčí stěna musí být 0,05 až 20 mm.'); return; }
        $('tiskTenkeInfo').textContent = '⏳ Měřím tloušťku stěn…';
        setTimeout(() => M.ukazTenkeSteny(m), 30);
      };
      $('tiskProblemy').addEventListener('click', e => {
        const b = e.target.closest('[data-vybrat], [data-opravit]');
        const p = b && $('tiskProblemy')._problemy[+(b.dataset.vybrat ?? b.dataset.opravit)];
        if (!p) return;
        if (b.dataset.vybrat != null) { M.nastavVyber(p.ids); return; }
        if (p.oprava === 'rozmistit') { M.nastavVyber(p.ids); M.rozmistitNaDesce(); return; }
        const dok = p.oprava === 'polozit' ? M.polozNaRovinu(M.app.dok, p.ids) : M.posunNaDesku(M.app.dok, p.ids, deska());
        M.zmenDokument(dok, p.oprava === 'polozit' ? 'Položit na desku' : 'Posunout na desku');
      });
      // odloženě: převisy všech těles (kopie sítí) by brzdily šipky a Zpět u velkých modelů
      let planPanel = 0;
      const naplanujPanel = () => { if (okno.open && !planPanel) planPanel = setTimeout(() => { planPanel = 0; obnovPanel(); }, 200); };
      M.na('dokument', e => { if (!e || !e.docasne) naplanujPanel(); });
      M.na('vyber', naplanujPanel);
      M.na('geometrie', naplanujPanel);
    }

    /** Natočí tělesa (vybraná, jinak všechna viditelná) do nejlepší orientace pro tisk a položí je na desku. */
    M.orientujProTisk = function () {
      const vyber = M.vybraneVolne().filter(u => !u.skryto && u.role !== 'dira');
      const uzly = vyber.length ? vyber : M.app.dok.uzly.filter(u => !u.skryto && !u.zamceno && u.role !== 'dira');
      let dok = M.app.dok, zmeneno = 0, ceka = 0;
      const popisy = [];
      for (const u of uzly) {
        const g = M.pocitaWorker(u) ? T.geometrieObjektu(u.id) : null;
        const sit = g && (g.ceka || g.chyba) ? null : T.svetovaSit(u.id);
        if (!sit) { ceka++; continue; }
        const kand = M.orientaceProTisk(sit, nast.uhel), nej = kand[0];
        if (!nej) continue;
        // současná poloha (dolů −Z) je skoro stejně dobrá (souměrné těleso, šum triangulace): jen položit
        const ted = kand.find(c => c.dolu[2] < -0.9995);
        const sum = ted && ted.prevesy - nej.prevesy < 1 + 0.02 * ted.prevesy && ted.kontakt >= 0.95 * nej.kontakt;
        let d2;
        if (nej.dolu[2] < -0.9995 || sum) d2 = M.polozNaRovinu(dok, [u.id]);
        else {
          // otočení kolem polohy tělesa: směr dolů a natočení kolem Z s nejmenším půdorysem
          const q = M.otoceniProTisk(sit, nej.dolu).multiply(M.quatUzlu(M.najdiUzel(dok, u.id)));
          d2 = M.polozNaRovinu(M.upravUzly(dok, [u.id], { rotace: M.rotaceZQuat(q) }), [u.id]);
        }
        if (d2 !== dok) { dok = d2; zmeneno++; }
        popisy.push(`„${u.nazev}“: převisy ${cz(nej.prevesy / 100, 1)} cm², na desce ${cz(nej.kontakt / 100, 1)} cm²`);
      }
      if (dok !== M.app.dok) M.zmenDokument(dok, 'Nejlepší orientace');
      if (ceka) Dialog.info(`${M.pocet(ceka, 'těleso', 'tělesa', 'těles')} se ještě ${ceka === 1 || ceka > 4 ? 'počítá' : 'počítají'} – zkus to za chvíli znovu.`);
      else Dialog.info(zmeneno ? 'Natočeno pro tisk. ' + popisy.slice(0, 2).join('; ') + (popisy.length > 2 ? ' …' : '') : 'Tělesa už jsou natočená nejlépe.');
    };

    /** Rozmístí tělesa (vybraná, jinak všechna viditelná) vedle sebe na desce. */
    M.rozmistitNaDesce = function () {
      const vyber = M.vybraneVolne().filter(u => !u.skryto);
      const ids = (vyber.length > 1 ? vyber : M.app.dok.uzly.filter(u => !u.skryto && !u.zamceno)).map(u => u.id);
      if (!ids.length) return;
      const r = M.rozlozNaDesce(M.app.dok, ids, deska(), 5, { otacet: true });
      M.zmenDokument(r.dok, 'Rozmístit na desce');
      if (!r.vejde) Dialog.info('Všechna tělesa se na desku nevešla – část leží za okrajem. Zvětši desku, nebo tiskni ve víc dávkách.');
      if (r.prekazi && r.prekazi.length) {
        const n = r.prekazi.length, dve = n >= 2 && n <= 4;
        Dialog.info(`${M.pocet(n, 'zamčené těleso', 'zamčená tělesa', 'zamčených těles')} ${dve ? 'zůstala' : 'zůstalo'} na místě a ${dve ? 'překážejí' : 'překáží'} rozložení – ${n === 1 ? 'odemkni ho' : 'odemkni je'} (nebo vyber jen ostatní).`);
      }
    };
    obnovStav();
  };
})(MDL);
