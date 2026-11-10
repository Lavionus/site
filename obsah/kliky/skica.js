/* Kliky – skica vlastního tvaru ramene (SVG, tažení myší / prstem). Obrys knobu a krčku kreslí kliky/editor_profilu.js.
   Klika: dva pohledy na rameno – shora (prohnutí ke dveřím + tloušťka) a zepředu (pokles + výška průřezu).
     ● bod osy: svisle = prohnutí / pokles, vodorovně = poloha po délce; ■ okraj = tloušťka / výška průřezu.
   Dvojklik do plochy přidá bod, dvojklik na bod ho odebere. Změny jdou do p.klika.vlastni
   přes api.zmen (průběžně při tažení, jeden krok historie na jedno tažení).
   Během tažení zůstává měřítko pohledu pevné, aby bod neujížděl ukazateli. */
/* global KLIKY */
(function () {
  'use strict';
  const K = KLIKY, SVGNS = 'http://www.w3.org/2000/svg';
  const n2 = v => (+v).toFixed(2);
  const kopie = o => JSON.parse(JSON.stringify(o));

  function vytvor(el, api) {
    let tah = null, casovac = 0, klikNaBod = 0, posledniStisk = { i: -1, cas: 0 };

    function bodSvg(svg, e) {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    /** Promítnutí do modelu: průběžně nejvýš ~8× za s, při puštění hned. */
    function zapis(typ, v, hned) {
      clearTimeout(casovac);
      const proved = () => api.zmen(x => { x.klika.vlastni = kopie(v); }, 'skica');
      if (hned) proved(); else casovac = setTimeout(proved, 120);
    }

    /* ---------- klika: jeden pohled (osa 'dz' = shora, 'dy' = zepředu) ---------- */
    function mezeKliky(v, osa) {
      const p = api.p(), q = p.klika, half = osa === 'dz' ? q.tloustka / 2 : q.vyska / 2, mer = osa === 'dz' ? 'st' : 'sh';
      const o = api.o(), arm = o.pat.vz.filter(x => x.u0 !== undefined && x.u0 < 1).slice(-1)[0];
      const Lm = Math.max(40, arm ? arm.c[0] : q.delka);
      const ys = [];
      for (let i = 0; i <= 40; i++) { const u = i / 40, s = K.interpoluj(v.body, osa, u, true), m = K.interpoluj(v.body, mer, u, false); ys.push(s + half * m, s - half * m); }
      return { Lm, half, mer, y0: Math.min(...ys) - 8, y1: Math.max(...ys) + 8 };
    }
    function pohledKliky(v, osa, meze, slot) {
      const { Lm, half, mer, y0, y1 } = meze, B = v.body, x0 = -12, x1 = Lm + 8;
      const sx = u => u * Lm, sy = y => y1 + y0 - y;     // kladné y nahoru
      const vz = []; for (let i = 0; i <= 60; i++) { const u = i / 60; vz.push({ u, s: K.interpoluj(B, osa, u, true), m: Math.max(0.2, K.interpoluj(B, mer, u, false)) }); }
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('viewBox', `${n2(x0)} ${n2(y0)} ${n2(x1 - x0)} ${n2(y1 - y0)}`);
      svg.setAttribute('class', 'skica-svg'); svg.dataset.slot = slot;
      svg.setAttribute('aria-label', osa === 'dz' ? 'Skica shora' : 'Skica zepředu');
      const pas = vz.map(w => `${n2(sx(w.u))} ${n2(sy(w.s + half * w.m))}`).concat(vz.slice().reverse().map(w => `${n2(sx(w.u))} ${n2(sy(w.s - half * w.m))}`));
      let h = `<line class="skica-nula" x1="${x0}" x2="${x1}" y1="${n2(sy(0))}" y2="${n2(sy(0))}"/>`
        + `<rect class="skica-krcek" x="-10" width="10" y="${n2(sy(half + 2))}" height="${n2(2 * half + 4)}"/>`
        + `<path class="skica-pas" d="M${pas.join('L')}Z"/>`
        + `<polyline class="skica-osa" points="${vz.map(w => `${n2(sx(w.u))},${n2(sy(w.s))}`).join(' ')}"/>`
        + `<text class="skica-popis" x="${n2(x0 + 1)}" y="${n2(y1 - 2)}">${osa === 'dz' ? 'ke dveřím ↓' : 'dolů ↓'}</text>`;
      B.forEach((b, i) => {
        h += `<rect class="skica-uchyt mer" data-i="${i}" data-co="${mer}" x="${n2(sx(b.u) - 1.7)}" y="${n2(sy(b[osa] + half * b[mer]) - 1.7)}" width="3.4" height="3.4"><title>${osa === 'dz' ? 'tloušťka' : 'výška'} × ${K.fmt(b[mer], 2)}</title></rect>`;
        h += `<circle class="skica-uchyt osa${i === 0 ? ' pevny' : ''}" data-i="${i}" data-co="${osa}" cx="${n2(sx(b.u))}" cy="${n2(sy(b[osa]))}" r="2.2"><title>${osa === 'dz' ? 'prohnutí' : 'pokles'} ${K.fmt(b[osa], 1)} mm</title></circle>`;
      });
      svg.innerHTML = h;
      return svg;
    }
    /** Vykreslí skicu; během tažení z rozpracovaného tvaru a s pevnými mezemi. */
    function kresli() {
      const p = api.p(), v = tah ? tah.v : p.klika.vlastni;
      el.innerHTML = '';
      const obal = (nazev, svg) => {
        const f = document.createElement('figure'), c = document.createElement('figcaption');
        c.textContent = nazev; f.append(c, svg); el.appendChild(f);
      };
      const mz = tah ? tah.meze : [mezeKliky(v, 'dz'), mezeKliky(v, 'dy')];
      obal('Shora – prohnutí ke dveřím (●) a tloušťka (■)', pohledKliky(v, 'dz', mz[0], 0));
      obal('Zepředu – pokles (●) a výška průřezu (■)', pohledKliky(v, 'dy', mz[1], 1));
    }

    // tažení: začne na úchytu, pokračuje na celém okně (SVG se při překreslení vymění)
    el.addEventListener('pointerdown', e => {
      const t = e.target.closest('.skica-uchyt'); if (!t) return;
      e.preventDefault();
      const p = api.p(), svg = t.ownerSVGElement, slot = +svg.dataset.slot;
      const v = kopie(p.klika.vlastni), i = +t.dataset.i;
      // dvojklik na bod = smazat (dblclick by netrefil, pokud se SVG mezitím přestaví); pointerdown nemá počet kliků → vlastní měření
      const dvoj = posledniStisk.i === i && posledniStisk.slot === slot && Date.now() - posledniStisk.cas < 450;
      posledniStisk = { i, slot, cas: Date.now() }; klikNaBod = Date.now();
      if (dvoj) { posledniStisk = { i: -1, cas: 0 }; tah = null; if (i > 0 && i < v.body.length - 1 && v.body.length > 3) { v.body.splice(i, 1); zapis('klika', v, true); } return; }
      tah = { typ: 'klika', v, i, co: t.dataset.co, slot, meze: [mezeKliky(v, 'dz'), mezeKliky(v, 'dy')], x0: e.clientX, y0: e.clientY, pohnuto: false };
    });
    window.addEventListener('pointermove', e => {
      if (!tah) return;
      if (!tah.pohnuto && Math.hypot(e.clientX - tah.x0, e.clientY - tah.y0) < 3) return;   // klik bez pohybu SVG nepřestaví
      tah.pohnuto = true;
      const svg = el.querySelector(`svg[data-slot="${tah.slot}"]`); if (!svg) return;
      const P = bodSvg(svg, e), b = tah.v.body, i = tah.i;
      const mz = tah.meze[tah.slot], osa = tah.slot === 0 ? 'dz' : 'dy', y = mz.y1 + mz.y0 - P.y;
      if (tah.co === osa) {
        if (i > 0) b[i][osa] = Math.round(Math.max(-45, Math.min(osa === 'dz' ? 25 : 45, y)) * 10) / 10;
        if (i > 0 && i < b.length - 1) b[i].u = Math.round(Math.min(b[i + 1].u - 0.03, Math.max(b[i - 1].u + 0.03, P.x / mz.Lm)) * 1000) / 1000;
      } else b[i][tah.co] = Math.round(Math.max(0.3, Math.min(2.5, (y - b[i][osa]) / mz.half)) * 100) / 100;
      kresli(); zapis(tah.typ, tah.v, false);
    });
    const pust = () => { if (!tah) return; const t = tah; tah = null; if (t.pohnuto) zapis(t.typ, t.v, true); };
    window.addEventListener('pointerup', pust); window.addEventListener('pointercancel', pust);
    el.addEventListener('dblclick', e => {
      if (Date.now() - klikNaBod < 600) return;   // dvojklik na bod vyřídil pointerdown
      const svg = e.target.closest('svg'); if (!svg) return;
      const p = api.p();
      const v = kopie(p.klika.vlastni), b = v.body, mz = mezeKliky(v, +svg.dataset.slot === 0 ? 'dz' : 'dy');
      {
        const u = Math.max(0.03, Math.min(0.97, bodSvg(svg, e).x / mz.Lm));
        if (b.some(x => Math.abs(x.u - u) < 0.03) || b.length >= 40) return;
        const nb = { u: Math.round(u * 1000) / 1000 };
        for (const k of ['dz', 'dy', 'sh', 'st']) nb[k] = Math.round(K.interpoluj(p.klika.vlastni.body, k, u, k === 'dz' || k === 'dy') * 100) / 100;
        b.push(nb); b.sort((a, c) => a.u - c.u);
      }
      zapis('klika', v, true);
    });
    return { kresli, tahne: () => !!tah };
  }
  window.KLIKY_SKICA = { vytvor };
})();
