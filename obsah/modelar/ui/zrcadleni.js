/* Modelář 3D – zrcadlení přímo ve scéně (jako v Tinkercadu).
   Klávesa M nebo tlačítko Zrcadlit: kolem vybraných těles se ukážou dvojité
   šipky – pro každou osu jedna, na straně obálky výběru přivrácené ke kameře. Najetí na
   šipku ukáže zrcadlený výsledek, klik ho provede (jeden krok Zpět) a režim
   zůstane, takže jde zrcadlit podle další osy. Esc nebo klik mimo šipky konec.
   Zrcadlí se podle středu výběru, stejně jako v nabídce Zrcadlit. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const BARVY = ['#e2675c', '#4fae6a', '#5b93e0'];
  function el(nazev, atr = {}, rodic) {
    const e = document.createElementNS(NS, nazev);
    for (const [k, v] of Object.entries(atr)) e.setAttribute(k, v);
    if (rodic) rodic.appendChild(e);
    return e;
  }

  M.vytvorZrcadleni = function (S) {
    const svg = el('svg', { class: 'zrcadleni-vrstva', 'aria-hidden': 'true' });
    document.getElementById('plocha').appendChild(svg);
    const hruby = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    let nahled = null;            // osa s rozpracovaným náhledem
    let stred = null;             // střed zrcadlení (pevný po dobu režimu, ať šipky neutíkají)

    const aktivni = () => M.app.rezim === 'zrcadleni';

    M.prepniZrcadleni = function () {
      if (aktivni()) { M.nastavRezim(null); return; }
      if (!M.vybraneVolne().length) { Dialog.info('Vyber těleso, které se má zrcadlit.'); return; }
      stred = null;
      M.nastavRezim('zrcadleni');
    };

    function zrcadli(osa, natrvalo) {
      const ids = M.vybraneVolne().map(u => u.id);
      if (!stred || nahled == null) stred = M.obalkaVice(M.vybraneVolne()).stred;
      const popis = 'Zrcadlit ' + 'XYZ'[osa];
      if (!natrvalo) {
        if (!M.app.uprava) M.zacniUpravu();
        M.zmenDokument(M.zrcadliUzly(M.app.uprava.zaklad, ids, osa, stred), '', { docasne: true });
        nahled = osa;
        return;
      }
      if (M.app.uprava && nahled === osa) { M.dokonciUpravu(popis); nahled = null; }
      else M.zmenDokument(M.zrcadliUzly(M.app.dok, ids, osa, stred), popis);
      kresli();
    }
    function zrusNahled() {
      if (nahled != null && M.app.uprava) M.zrusUpravu();
      nahled = null;
    }

    /** Dvojitá šipka (obrys) se středem c, ve směru jednotkového vektoru d na obrazovce. */
    function sipka(c, d, delka, sirka) {
      const n = [-d[1], d[0]], h = delka / 2, hrot = Math.min(delka * 0.42, sirka * 1.5), w = sirka * 0.32;
      const b = (s, t) => `${(c[0] + d[0] * s + n[0] * t).toFixed(1)},${(c[1] + d[1] * s + n[1] * t).toFixed(1)}`;
      return `M${b(h, 0)} L${b(h - hrot, sirka)} L${b(h - hrot, w)} L${b(-h + hrot, w)} L${b(-h + hrot, sirka)} L${b(-h, 0)}`
        + ` L${b(-h + hrot, -sirka)} L${b(-h + hrot, -w)} L${b(h - hrot, -w)} L${b(h - hrot, -sirka)} Z`;
    }

    function kresli() {
      svg.innerHTML = '';
      if (!aktivni()) return;
      const uzly = M.vybraneVolne();
      if (!uzly.length) return;
      const ob = M.obalkaVice(uzly);
      const c = stred || ob.stred;
      const vel = Math.max(ob.max[0] - ob.min[0], ob.max[1] - ob.min[1], ob.max[2] - ob.min[2]);
      const delka = hruby ? 46 : 34, sirka = hruby ? 12 : 9;
      const kam = S.kamera.aktivni().position;
      for (let osa = 0; osa < 3; osa++) {
        // jedna šipka na osu (zrcadlení podle osy je jen jedno) – na straně obálky přivrácené ke kameře
        for (const strana of [Math.sign(kam.getComponent(osa) - c[osa]) || 1]) {
          const b = c.slice();
          // kus za stěnou obálky (aspoň ~25 px), ať šipka neleží na tělese
          const pxNaMm = 1 / Math.max(1e-6, S.mmNaPixel(new THREE.Vector3(...c)));
          b[osa] = (strana < 0 ? ob.min[osa] : ob.max[osa]) + strana * Math.max(vel * 0.08, 28 / pxNaMm);
          const p = S.naObrazovku(new THREE.Vector3(...b));
          const b2 = b.slice(); b2[osa] += strana * vel * 0.1 + strana * 1e-3;
          const q = S.naObrazovku(new THREE.Vector3(...b2));
          if (!p || !q) continue;
          let d = [q[0] - p[0], q[1] - p[1]], l = Math.hypot(...d);
          // osa míří do obrazovky: šipka šikmo, ať je pořád vidět
          d = l > 1e-3 ? [d[0] / l, d[1] / l] : [0.7071, -0.7071];
          const g = el('g', { class: 'zrc' + (nahled === osa ? ' aktivni' : ''), 'data-osa': osa }, svg);
          el('path', { d: sipka(p, d, delka, sirka), fill: BARVY[osa], class: 'sipka-zrc' }, g);
          el('title', {}, g).textContent = `Zrcadlit podle ${'XYZ'[osa]} (klik)`;
        }
      }
    }

    const osaZ = e => { const g = e.target.closest && e.target.closest('g.zrc'); return g ? +g.dataset.osa : null; };
    let poKliku = null;           // místo posledního kliku: šipka se pod ním překreslí a nový náhled by výsledek hned vrátil
    svg.addEventListener('pointerover', e => {
      const osa = osaZ(e);
      if (osa == null || !aktivni() || nahled === osa) return;
      if (poKliku && Math.hypot(e.clientX - poKliku[0], e.clientY - poKliku[1]) < 40) return;
      poKliku = null;
      zrusNahled();
      zrcadli(osa, false);
      svg.querySelectorAll(`g.zrc[data-osa="${osa}"]`).forEach(g => g.classList.add('aktivni'));
    });
    svg.addEventListener('pointerout', e => {
      const g = e.target.closest && e.target.closest('g.zrc');
      if (!g || (e.relatedTarget && g.contains(e.relatedTarget))) return;
      zrusNahled();
      svg.querySelectorAll('g.zrc').forEach(x => x.classList.remove('aktivni'));
    });
    svg.addEventListener('pointerdown', e => {
      const osa = osaZ(e);
      if (osa == null) return;
      e.preventDefault(); e.stopPropagation();
      if (e.button !== 0) return;
      // dotyk nemá najetí: rovnou provést
      if (document.activeElement && document.activeElement.matches('input, textarea')) document.activeElement.blur();
      if (nahled !== osa) { zrusNahled(); zrcadli(osa, false); }
      zrcadli(osa, true);
      poKliku = [e.clientX, e.clientY];
    });
    M.registrujNahled(() => { if (nahled == null || !M.app.uprava) return false; zrusNahled(); kresli(); return true; });
    svg.addEventListener('wheel', e => { S.renderer.domElement.dispatchEvent(new WheelEvent('wheel', e)); e.preventDefault(); }, { passive: false });

    /** Klik do scény v režimu zrcadlení (vyber.js): konec režimu. */
    M.klikZrcadleni = function () { M.nastavRezim(null); };

    M.na('rezim', r => { if (r !== 'zrcadleni') { zrusNahled(); stred = null; } kresli(); });
    M.na('vyber', () => {
      if (!aktivni()) return;
      if (!M.vybraneVolne().length) { M.nastavRezim(null); return; }
      stred = null;
      kresli();
    });
    M.na('dokument', () => { if (nahled == null) { stred = null; kresli(); } });
    M.na('kamera', () => { if (aktivni()) kresli(); });
  };
})(MDL);
