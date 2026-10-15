/* Modelář 3D – zarovnání puntíky ve scéně (jako v Tinkercadu).
   Klávesa L nebo tlačítko Zarovnat: kolem vybraných těles se ukážou puntíky –
   pro každou osu tři (začátek, střed, konec). Najetí na puntík ukáže výsledek,
   klik ho provede (jeden krok Zpět) a režim zůstane, dokud uživatel nestiskne
   Esc nebo neklikne mimo. Klik na jedno z vybraných těles z něj udělá vztažné:
   ostatní se pak zarovnávají k němu a ono se nehne. Puntíky X leží podél přední
   hrany, Y podél pravé, Z na svislé čáře v pravém předním rohu (na desce). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const BARVY = ['#e2675c', '#4fae6a', '#5b93e0'];
  const POPIS = { min: ['vlevo', 'dopředu', 'dolů'], stred: ['na střed', 'na střed', 'na střed'], max: ['vpravo', 'dozadu', 'nahoru'] };
  function el(nazev, atr = {}, rodic) {
    const e = document.createElementNS(NS, nazev);
    for (const [k, v] of Object.entries(atr)) e.setAttribute(k, v);
    if (rodic) rodic.appendChild(e);
    return e;
  }

  M.vytvorZarovnani = function (S) {
    const svg = el('svg', { class: 'zarovnani-vrstva', 'aria-hidden': 'true' });
    document.getElementById('plocha').appendChild(svg);
    const hruby = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    let klic = null;              // vztažné těleso
    let nahled = null;            // puntík s rozpracovaným náhledem {osa, kde}

    const aktivni = () => M.app.rezim === 'zarovnani';
    const vybrane = () => M.vybraneVolne().length ? M.vybraneUzly() : [];

    M.prepniZarovnani = function () {
      if (aktivni()) { M.nastavRezim(null); return; }
      if (M.vybraneUzly().length < 2) { Dialog.info('Vyber aspoň dvě tělesa, která se mají zarovnat (Shift + klik).'); return; }
      klic = null;
      M.nastavRezim('zarovnani');
    };
    M.zarovnaniKlic = () => klic;

    /** Náhled zarovnání (dočasná změna dokumentu) a jeho zrušení. */
    function zarovnej(osa, kde, natrvalo) {
      const ids = vybrane().map(u => u.id);
      if (!natrvalo) {
        if (!M.app.uprava) M.zacniUpravu();
        M.zmenDokument(M.zarovnejUzly(M.app.uprava.zaklad, ids, osa, kde, klic), '', { docasne: true });
        nahled = { osa, kde };
        return;
      }
      if (M.app.uprava && nahled) { M.dokonciUpravu(`Zarovnat ${'XYZ'[osa]} ${POPIS[kde][osa]}`); nahled = null; }
      else M.zmenDokument(M.zarovnejUzly(M.app.dok, ids, osa, kde, klic), `Zarovnat ${'XYZ'[osa]} ${POPIS[kde][osa]}`);
      kresli();
    }
    function zrusNahled() {
      if (nahled && M.app.uprava) M.zrusUpravu();
      nahled = null;
    }

    function kresli() {
      svg.innerHTML = '';
      if (!aktivni()) return;
      const uzly = vybrane();
      if (uzly.length < 2) return;
      const vztazne = klic && uzly.find(u => u.id === klic);
      // puntíky leží kolem celého výběru (u malého vztažného tělesa by se slily), poloha puntíku v ose = cíl
      const vse = M.obalkaVice(uzly);
      const ob = vztazne ? M.obalkaUzlu(vztazne) : vse;
      const vel = Math.max(vse.max[0] - vse.min[0], vse.max[1] - vse.min[1], vse.max[2] - vse.min[2]);
      const odstup = vel * 0.12 + 4;
      const st = i => (ob.min[i] + ob.max[i]) / 2;
      const hodnota = (i, kde) => kde === 'min' ? ob.min[i] : kde === 'max' ? ob.max[i] : st(i);
      const naObr = b => S.naObrazovku(new THREE.Vector3(...b));
      const r = hruby ? 11 : 7;
      // vztažné těleso: přerušovaný rámeček kolem jeho obálky na obrazovce
      if (vztazne) {
        const body = [];
        for (let i = 0; i < 8; i++) { const q = naObr([i & 1 ? ob.max[0] : ob.min[0], i & 2 ? ob.max[1] : ob.min[1], i & 4 ? ob.max[2] : ob.min[2]]); if (q) body.push(q); }
        if (body.length) {
          const x0 = Math.min(...body.map(q => q[0])), x1 = Math.max(...body.map(q => q[0])), y0 = Math.min(...body.map(q => q[1])), y1 = Math.max(...body.map(q => q[1]));
          el('rect', { x: x0 - 4, y: y0 - 4, width: x1 - x0 + 8, height: y1 - y0 + 8, class: 'klic', rx: 6 }, svg);
        }
      }
      const polohy = [
        kde => [hodnota(0, kde), vse.min[1] - odstup, vse.min[2]],                    // X: podél přední hrany
        kde => [vse.max[0] + odstup, hodnota(1, kde), vse.min[2]],                    // Y: podél pravé hrany
        kde => [vse.max[0] + odstup, vse.min[1] - odstup, hodnota(2, kde)],            // Z: svisle v rohu
      ];
      for (let osa = 0; osa < 3; osa++) {
        // osa Z jen když má výběr výšku (jinak by puntíky splynuly)
        if (osa === 2 && ob.max[2] - ob.min[2] < 1e-6) continue;
        const body = ['min', 'stred', 'max'].map(kde => ({ kde, q: naObr(polohy[osa](kde)) }));
        if (body.some(b => !b.q)) continue;
        // malé těleso nebo pohled podél osy: puntíky roztáhnout na obrazovce, ať se dají trefit
        const [a, s0, b] = body.map(x => x.q), dl = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (dl < 6 * r) {
          const smer = dl > 1e-6 ? [(b[0] - a[0]) / dl, (b[1] - a[1]) / dl] : [[1, 0], [0.7, -0.7], [0, -1]][osa];
          body[0].q = [s0[0] - smer[0] * 3 * r, s0[1] - smer[1] * 3 * r];
          body[2].q = [s0[0] + smer[0] * 3 * r, s0[1] + smer[1] * 3 * r];
        }
        el('line', { x1: body[0].q[0], y1: body[0].q[1], x2: body[2].q[0], y2: body[2].q[1], class: 'voditko', stroke: BARVY[osa] }, svg);
        for (const { kde, q } of body) {
          const c = el('circle', { cx: q[0], cy: q[1], r, class: 'puntik' + (nahled && nahled.osa === osa && nahled.kde === kde ? ' aktivni' : ''), fill: BARVY[osa] }, svg);
          c.dataset.osa = osa; c.dataset.kde = kde;
          el('title', {}, c).textContent = `Zarovnat ${'XYZ'[osa]} ${POPIS[kde][osa]}` + (vztazne ? ` k „${vztazne.nazev}“` : '');
        }
      }
    }

    let poKliku = null;           // místo posledního kliku (puntík se pod ním překreslí – žádný nový náhled hned po kliku)
    svg.addEventListener('pointerover', e => {
      const c = e.target.closest && e.target.closest('.puntik');
      if (!c || !aktivni()) return;
      const osa = +c.dataset.osa, kde = c.dataset.kde;
      if (nahled && nahled.osa === osa && nahled.kde === kde) return;
      if (poKliku && Math.hypot(e.clientX - poKliku[0], e.clientY - poKliku[1]) < 20) return;
      poKliku = null;
      zrusNahled();
      zarovnej(osa, kde, false);
      c.classList.add('aktivni');
    });
    svg.addEventListener('pointerout', e => {
      const c = e.target.closest && e.target.closest('.puntik');
      if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
      zrusNahled();
      c.classList.remove('aktivni');
    });
    svg.addEventListener('pointerdown', e => {
      const c = e.target.closest && e.target.closest('.puntik');
      if (!c) return;
      e.preventDefault(); e.stopPropagation();
      if (e.button !== 0) return;
      if (document.activeElement && document.activeElement.matches('input, textarea')) document.activeElement.blur();
      const osa = +c.dataset.osa, kde = c.dataset.kde;
      // dotyk nemá najetí: náhled a hned potvrzení
      if (!nahled || nahled.osa !== osa || nahled.kde !== kde) { zrusNahled(); zarovnej(osa, kde, false); }
      zarovnej(osa, kde, true);
      poKliku = [e.clientX, e.clientY];
    });
    svg.addEventListener('wheel', e => { S.renderer.domElement.dispatchEvent(new WheelEvent('wheel', e)); e.preventDefault(); }, { passive: false });
    M.registrujNahled(() => { if (!nahled || !M.app.uprava) return false; zrusNahled(); kresli(); return true; });

    /** Klik do scény v režimu zarovnání (vyber.js): vybrané těleso = vztažné, jinde = konec. */
    M.klikZarovnani = function (zasah) {
      if (zasah && M.app.vyber.includes(zasah.id)) {
        klic = klic === zasah.id ? null : zasah.id;
        kresli();
        return;
      }
      M.nastavRezim(null);
    };

    M.na('rezim', r => { if (r !== 'zarovnani') { zrusNahled(); klic = null; } kresli(); });
    M.na('vyber', () => {
      if (!aktivni()) return;
      if (M.vybraneUzly().length < 2) { M.nastavRezim(null); return; }
      if (klic && !M.app.vyber.includes(klic)) klic = null;
      kresli();
    });
    // během náhledu se puntíky nepřekreslují (zůstanou, kde byly – jako v Tinkercadu)
    M.na('dokument', () => { if (!nahled) kresli(); });
    // pohyb kamery s rozpracovaným náhledem: puntíky by zůstaly na starém místě – náhled zrušit a překreslit
    // (událost chodí s každým snímkem – rozhoduje skutečná změna matice kamery)
    let klicKamery = '';
    M.na('kamera', k => {
      if (!aktivni()) return;
      const a = k.aktivni(), klic = a.matrixWorld.elements.join(',') + '|' + a.projectionMatrix.elements.join(',');
      if (klic === klicKamery) { if (!nahled) kresli(); return; }
      klicKamery = klic;
      if (nahled && M.app.uprava) zrusNahled();
      kresli();
    });
  };
})(MDL);
