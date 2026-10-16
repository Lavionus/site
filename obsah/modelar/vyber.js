/* Modelář 3D – levé tlačítko myši na ploše: výběr, posun, režimy.
   Klik na těleso ho vybere (Shift/Ctrl přidá nebo odebere), klik do prázdna
   výběr zruší, tažení z prázdného místa kreslí obdélník (vybere tělesa,
   kterých se dotkne). Tažení tělesa ho posouvá v pracovní rovině
   s přichycením na mřížku: Shift = jen v jedné ose, Ctrl = bez přichycení,
   Alt = posunout kopii (originál zůstane), Esc = zrušit.
   Režimy (M.app.rezim): 'rovina' – klik na stěnu položí pracovní rovinu,
   klik vedle ji vrátí na desku; 'plochou' – klik na stěnu tělesa ho
   natočí touto stěnou dolů a položí. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const V = THREE.Vector3;

  M.vytvorVyber = function (S, T, obal) {
    const el = S.renderer.domElement;
    const obdelnik = document.createElement('div');
    obdelnik.className = 'vyber-obdelnik';
    obdelnik.hidden = true;
    obal.appendChild(obdelnik);

    let tah = null;
    const pixel = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    // ------------------------------------------------------------ režimy klikání
    M.nastavRezim = function (rezim) {
      M.app.rezim = rezim || null;
      el.classList.toggle('rezim', !!M.app.rezim);
      M.vysli('rezim', M.app.rezim);
      M.prekresli();
    };
    function klikVRezimu(zasah, px, py) {
      if (M.app.rezim === 'mereni' || M.app.rezim === 'poznamka') { M.klikDilna(zasah, px, py); return; }
      if (M.app.rezim === 'zarovnani') { M.klikZarovnani(zasah); return; }
      if (M.app.rezim === 'zrcadleni') { M.klikZrcadleni(zasah); return; }
      if (M.app.rezim === 'pivot') { M.klikPivot(zasah, px, py); return; }
      // hrany chytá SVG vrstva přesných úprav; klik na rovnou plochu vedle hran = celý její obrys
      if (M.app.rezim === 'hrany') { if (M.klikObrysPlochy) M.klikObrysPlochy(zasah); return; }
      if (M.app.rezim === 'plochy') { M.klikOcct(zasah); return; }
      if (M.app.rezim === 'rovina') {
        if (zasah) {
          // počátek v rovině stěny na krok mřížky (ve směru normály zůstává přesně na stěně)
          const k = Math.max(S.deska.krok, 0.1), n = zasah.normala;
          const bod = zasah.bod.toArray().map((x, i) => Math.abs(n.getComponent(i)) < 1e-6 ? Math.round(x / k) * k : Math.round(x * 1e6) / 1e6);
          const r = M.rovinaZBodu(bod, n.toArray());
          // téměř vodorovná horní stěna: rovina jen posunutá nahoru, osy jako deska
          M.nastavRovinu(zasah.normala.z > 0.9999 ? { puvod: r.puvod, osy: M.ROVINA_DESKY.osy } : r);
        } else M.nastavRovinu(null);
      } else if (M.app.rezim === 'vzorDer' && zasah) {
        M.nastavRezim(null);
        M.otevriVzorDer(zasah);
        return;
      } else if (M.app.rezim === 'struktura' && zasah) {
        M.nastavRezim(null);
        M.otevriStrukturu(zasah);
        return;
      } else if (M.app.rezim === 'plochou' && zasah) {
        const u = M.najdiUzel(M.app.dok, zasah.id);
        if (u && !u.zamceno) {
          M.zmenDokument(M.polozPlochou(M.app.dok, u.id, zasah.normala.toArray(), M.rovina()), 'Položit plochou');
          M.nastavVyber([u.id]);
        }
      }
      M.nastavRezim(null);
    }

    // ------------------------------------------------------------ posun tažením
    function zacniPosun(e) {
      const t = tah;
      if (!M.app.vyber.includes(t.zasah.id)) {
        if (t.pridat) M.prepniVyber(t.zasah.id); else M.nastavVyber([t.zasah.id]);
      }
      const uzel = M.najdiUzel(M.app.dok, t.zasah.id);
      if (!uzel || uzel.zamceno) { t.druh = 'nic'; return; }
      t.zaklad = M.zacniUpravu();
      M.ovladaniBlokovano = true;             // během tažení žádné klávesové příkazy (zapsaly by do dočasného stavu)
      t.ids = M.vybraneVolne().map(u => u.id);
      t.kopie = false;
      if (e.altKey) {
        const r = M.duplikujUzly(t.zaklad, t.ids);
        t.zaklad = r.dok;
        t.ids = r.kopie;
        t.kopie = true;
        M.zmenDokument(r.dok, '', { docasne: true });
        M.nastavVyber(r.kopie);
      }
      const [u, v, n] = M.rovina().osy.map(o => new V(...o));
      Object.assign(t, { druh: 'posun', u, v, n, bod0: t.zasah.bod.clone() });
      // referenční bod pro přichycení: střed spodku tělesa v rovině
      const p0 = new V(...M.rovina().puvod);
      const st = new V(...uzel.poloha).sub(p0);
      t.ref = [st.dot(u), st.dot(v)];
      el.classList.add('tah-posun');
    }

    function posun(e) {
      const t = tah;
      const p = M.prusecikRoviny(t.x, t.y, t.bod0, t.n);
      if (!p) return;
      const d = p.sub(t.bod0);
      let du = d.dot(t.u), dv = d.dot(t.v);
      if (e.shiftKey) { if (Math.abs(du) > Math.abs(dv)) dv = 0; else du = 0; }
      const k = e.ctrlKey ? 0 : S.deska.krok;
      if (k) {
        // přichytí se poloha středu tělesa, ne jen posun
        du = Math.round((t.ref[0] + du) / k) * k - t.ref[0];
        dv = Math.round((t.ref[1] + dv) / k) * k - t.ref[1];
      }
      const posunuti = t.u.clone().multiplyScalar(du).addScaledVector(t.v, dv);
      M.zmenDokument(M.posunUzly(t.zaklad, t.ids, posunuti.toArray()), '', { docasne: true });
      M.ukazPopisek(`${M.app.rovina ? 'U' : 'X'} ${du >= 0 ? '+' : ''}${M.mm(du, 2)}  ${M.app.rovina ? 'V' : 'Y'} ${dv >= 0 ? '+' : ''}${M.mm(dv, 2)} mm`, t.x, t.y);
    }

    // ------------------------------------------------------------ události
    // klik do scény (i na úchyt nebo kótu nad plátnem) jí dá fokus: šipky a Delete pak jdou na tělesa
    // (fokus by jinak zůstal na tlačítku lišty)
    el.parentNode.addEventListener('pointerdown', () => {
      const a = document.activeElement;
      if (a !== el && !M.modalniOkno() && !(a && a.matches && a.matches('input, textarea, select'))) el.focus({ preventScroll: true });
    }, true);
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || M.ovladaniBlokovano || M.gesto) return;
      const [px, py] = pixel(e);
      const zasah = T.zasah(px, py);
      // dotyk: tah prstem po prázdném místě otáčí pohledem (místo výběru obdélníkem)
      tah = { px, py, x: px, y: py, zasah, pridat: e.shiftKey || e.ctrlKey || e.metaKey, id: e.pointerId, druh: null, dotyk: e.pointerType === 'touch' };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!tah || e.pointerId !== tah.id) return;
      const [ox, oy] = [tah.x, tah.y];
      [tah.x, tah.y] = pixel(e);
      const daleko = Math.hypot(tah.x - tah.px, tah.y - tah.py) > (tah.dotyk ? 8 : 4);
      if (daleko) tah.daleko = true;
      if (!tah.druh && daleko && !M.app.rezim) {
        if (tah.zasah) zacniPosun(e); else tah.druh = tah.dotyk ? 'otoc' : 'obdelnik';
      } else if (!tah.druh && daleko && tah.dotyk && M.app.rezim) tah.druh = 'otoc';
      if (tah.druh === 'otoc') { S.kamera.otoc(tah.x - ox, tah.y - oy, S.stredOtaceni()); M.prekresli(); return; }
      if (tah.druh === 'posun') posun(e);
      else if (tah.druh === 'obdelnik') {
        const x0 = Math.min(tah.px, tah.x), y0 = Math.min(tah.py, tah.y);
        Object.assign(obdelnik.style, { left: x0 + 'px', top: y0 + 'px',
          width: Math.abs(tah.x - tah.px) + 'px', height: Math.abs(tah.y - tah.py) + 'px' });
        obdelnik.hidden = false;
      }
    });
    function konec(e, zrusit) {
      if (!tah || (e && e.pointerId !== tah.id)) return;
      const t = tah;
      tah = null;
      obdelnik.hidden = true;
      el.classList.remove('tah-posun');
      M.skryjPopisek();
      if (t.druh === 'posun') {
        M.ovladaniBlokovano = false;
        if (zrusit) M.zrusUpravu(); else M.dokonciUpravu(t.kopie ? 'Duplikovat a posunout' : 'Posun');
        return;
      }
      if (t.druh === 'otoc') return;
      if (zrusit) return;
      if (t.druh === 'obdelnik') {
        const x0 = Math.min(t.px, t.x), x1 = Math.max(t.px, t.x), y0 = Math.min(t.py, t.y), y1 = Math.max(t.py, t.y);
        const zasazene = M.app.dok.uzly.filter(u => {
          const b = T.obalkaNaObrazovce(u.id);
          return b && b[0] <= x1 && b[2] >= x0 && b[1] <= y1 && b[3] >= y0;
        }).map(u => u.id);
        M.nastavVyber(t.pridat ? M.app.vyber.concat(zasazene) : zasazene);
        return;
      }
      if (t.druh) return;
      // v režimu klikání: tažení myší není klik (nezrušit omylem rovinu, zarovnání…)
      if (M.app.rezim) { if (!t.daleko) klikVRezimu(t.zasah, t.px, t.py); return; }
      if (t.zasah) {
        if (t.pridat) M.prepniVyber(t.zasah.id);
        else M.nastavVyber([t.zasah.id]);
      } else if (!t.pridat) M.nastavVyber([]);
    }
    el.addEventListener('pointerup', e => konec(e, false));
    // druhý prst: rozdělaný tah prvním prstem se zruší (posun tělesa se vrátí)
    M.na('gesto', zacalo => { if (zacalo && tah) konec(null, true); });
    el.addEventListener('pointercancel', e => konec(e, true));
    // Esc: rozdělané tažení, jinak konec režimu – ne když píše do pole (to si Esc vrátí samo),
    // ne pod modálním oknem a ne s otevřenou nabídkou (tu zavře její obsluha)
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (tah) { konec(null, true); e.preventDefault(); e.stopPropagation(); return; }
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
      if (M.modalniOkno() || document.querySelector('.nabidka:not([hidden])')) return;
      if (M.app.rezim) { M.nastavRezim(null); e.preventDefault(); e.stopPropagation(); }
    }, true);

    // kurzor: ruka nad tělesem (raycast nejvýš jednou za snímek – myš posílá události častěji)
    let kurzorBod = null;
    el.addEventListener('pointermove', e => {
      if (tah || e.buttons) return;
      const planovano = !!kurzorBod;
      kurzorBod = pixel(e);
      if (planovano) return;
      requestAnimationFrame(() => {
        const b = kurzorBod; kurzorBod = null;
        if (b && !tah) el.classList.toggle('nad-telesem', !!T.zasah(b[0], b[1]));
      });
    });
  };
})(MDL);
