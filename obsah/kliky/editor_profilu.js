/* Editor profilu (skica obrysu) – hlava knobu i krček, sdílí stránka kliky a knob.
   Body {u, r, typ, h1, h2}: u = výška (0 … 1), r = poloměr (u hlavy násobek R, u krčku násobek poloměru krčku).
   Typy bodů: hladký (úchyty se dopočítají), roh (bez úchytů – ostrý zlom), Bézier (spojité úchyty), uzel (nezávislé úchyty).
   Ovládání: tažení bodů a úchytů, klik = výběr, dvojklik do plochy = nový bod na nejbližším úseku, dvojklik na bod = smazat,
   šipky posunou vybraný bod (Shift × 10), Delete smaže, [ a ] (PageUp / PageDown) vyberou předchozí / další bod. Panel nástrojů: typ bodu, přidat / smazat, číselné r a z v mm,
   přichytávání k mřížce, větší plocha. Během tažení zůstává měřítko pevné.
   api = { ziskej() → {body, sx, sy, hlava (póly), ram: [[x0, y0, x1, y1]…] doplňky v mm, pevne: (i) → {u, r} pevné osy},
           zapis(body, hned) } */
/* global KLIKY */
(function () {
  'use strict';
  const K = KLIKY, SVGNS = 'http://www.w3.org/2000/svg';
  const n2 = v => (+v).toFixed(2), kopie = o => JSON.parse(JSON.stringify(o));
  const TYPY = { hladky: '⌒ Hladký', roh: '◢ Roh', bezier: '∿ Bézier', uzel: '⋎ Zlom' };

  function vytvor(el, api) {
    let vyber = -1, tah = null, mrizka = false, velky = false, casovac = 0;
    el.classList.add('editor-profilu');
    el.innerHTML = `<div class="ep-lista" role="toolbar" aria-label="Nástroje skici">
        <div class="ep-typy">${Object.entries(TYPY).map(([k, v]) => `<button type="button" class="tl" data-typ="${k}">${v}</button>`).join('')}</div>
        <button type="button" class="tl" data-akce="pridat" title="Vložit bod za vybraný">＋ bod</button>
        <button type="button" class="tl" data-akce="smazat" title="Smazat vybraný bod (Delete)">🗑</button>
        <label class="ep-zaskrt"><input type="checkbox" data-akce="mrizka"> mřížka 1 mm</label>
        <label class="ep-zaskrt"><input type="checkbox" data-akce="velky"> větší plocha</label>
      </div>
      <div class="ep-plocha"></div>
      <div class="ep-bod"><span class="ep-cislo">bod –</span>
        <label>r <input type="text" inputmode="decimal" data-osa="r"> mm</label>
        <label>z <input type="text" inputmode="decimal" data-osa="z"> mm</label></div>`;
    const plocha = el.querySelector('.ep-plocha');

    const data = () => api.ziskej();
    function zapis(body, hned) {
      clearTimeout(casovac);
      if (hned) api.zapis(kopie(body), true); else casovac = setTimeout(() => api.zapis(kopie(body), false), 120);
    }
    const bodSvg = (svg, e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; };
    const prichyt = (v, krok) => (mrizka ? Math.round(v / krok) * krok : v);

    /** Úchyty bodu i (pro zobrazení): uložené u Bézier / zlomu, jinak dopočítané. */
    function uchyty(body, i, hlava) {
      const P = hlava ? [{ u: 0, r: 0, typ: 'pol0' }].concat(body, [{ u: 1, r: 0, typ: 'pol1' }]) : body;
      const j = hlava ? i + 1 : i, b = P[j];
      if (b.typ === 'bezier' || b.typ === 'uzel') return { in: { du: b.h1.du, dr: b.h1.dr }, out: { du: b.h2.du, dr: b.h2.dr } };
      if (b.typ === 'roh') return { in: { du: 0, dr: 0 }, out: { du: 0, dr: 0 } };
      const a = P[Math.max(0, j - 1)], c = P[Math.min(P.length - 1, j + 1)];
      return { in: { du: -(c.u - a.u) / 6, dr: -(c.r - a.r) / 6 }, out: { du: (c.u - a.u) / 6, dr: (c.r - a.r) / 6 } };
    }
    function meze(d) {
      const L = K.krivkaProfilu(d.body, d.hlava), xs = L.map(q => q[0] * d.sx).concat(d.body.map(b => b.r * d.sx), [0]);
      const ys = L.map(q => q[1] * d.sy).concat([0, d.sy]);
      for (const r of d.ram || []) { xs.push(r[2]); ys.push(r[1], r[3]); }
      return { x0: -Math.max(...xs) - 4, x1: Math.max(...xs) + 6, y0: Math.min(...ys) - 4, y1: Math.max(...ys) + 4 };
    }

    function kresli() {
      const d = data(), body = tah ? tah.body : d.body, m = tah ? tah.meze : meze(Object.assign({}, d, { body }));
      if (vyber >= body.length) vyber = -1;   // po Zpět / předvolbě může být bodů méně
      const sy = y => m.y1 + m.y0 - y;   // y nahoru
      const L = K.krivkaProfilu(body, d.hlava);
      const obrys = L.map(([r, u]) => `${n2(r * d.sx)} ${n2(sy(u * d.sy))}`), zrcadlo = L.slice().reverse().map(([r, u]) => `${n2(-r * d.sx)} ${n2(sy(u * d.sy))}`);
      let h = '';
      if (mrizka) for (let x = Math.ceil(m.x0 / 5) * 5; x <= m.x1; x += 5) h += `<line class="ep-mriz" x1="${x}" x2="${x}" y1="${n2(m.y0)}" y2="${n2(m.y1)}"/>`;
      if (mrizka) for (let y = Math.ceil(m.y0 / 5) * 5; y <= m.y1; y += 5) h += `<line class="ep-mriz" y1="${n2(sy(y))}" y2="${n2(sy(y))}" x1="${n2(m.x0)}" x2="${n2(m.x1)}"/>`;
      for (const r of d.ram || []) h += `<rect class="skica-krcek" x="${n2(r[0])}" y="${n2(sy(r[3]))}" width="${n2(r[2] - r[0])}" height="${n2(r[3] - r[1])}"/>`;
      h += `<line class="skica-nula" x1="0" x2="0" y1="${n2(m.y0)}" y2="${n2(m.y1)}"/>`;
      h += `<path class="skica-pas" d="M${obrys.concat(zrcadlo).join('L')}Z"/>`;
      h += `<polyline class="ep-krivka" points="${L.map(([r, u]) => `${n2(r * d.sx)},${n2(sy(u * d.sy))}`).join(' ')}"/>`;
      // úchyty vybraného bodu (a všech Bézierových)
      body.forEach((b, i) => {
        if (!(i === vyber || b.typ === 'bezier' || b.typ === 'uzel')) return;
        const U = uchyty(body, i, d.hlava), x = b.r * d.sx, y = sy(b.u * d.sy);
        for (const [k, hh] of [['h1', U.in], ['h2', U.out]]) {
          const hx = (b.r + hh.dr) * d.sx, hy = sy((b.u + hh.du) * d.sy);
          if (Math.abs(hh.dr) + Math.abs(hh.du) < 1e-6) continue;
          h += `<line class="ep-rameno" x1="${n2(x)}" y1="${n2(y)}" x2="${n2(hx)}" y2="${n2(hy)}"/>`;
          h += `<rect class="ep-uchyt" data-i="${i}" data-h="${k}" x="${n2(hx - 1.3)}" y="${n2(hy - 1.3)}" width="2.6" height="2.6"/>`;
        }
      });
      body.forEach((b, i) => {
        const pevny = d.pevne && d.pevne(i, body.length);
        h += `<circle class="skica-uchyt osa ep-${b.typ || 'hladky'}${i === vyber ? ' vybrany' : ''}${pevny && pevny.u && pevny.r ? ' pevny' : ''}" data-i="${i}" cx="${n2(b.r * d.sx)}" cy="${n2(sy(b.u * d.sy))}" r="1.9"/>`;
      });
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('viewBox', `${n2(m.x0)} ${n2(m.y0)} ${n2(m.x1 - m.x0)} ${n2(m.y1 - m.y0)}`);
      svg.setAttribute('class', 'skica-svg ep-svg' + (velky ? ' velky' : '')); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Skica obrysu – body táhněte myší; z klávesnice [ a ] vyberou bod, šipky ho posunou, Delete smaže');
      svg.innerHTML = h;
      plocha.innerHTML = ''; plocha.appendChild(svg);
      // panel vybraného bodu
      const b = body[vyber];
      el.querySelector('.ep-cislo').textContent = b ? `bod ${vyber + 1} / ${body.length}` : `${body.length} bodů – klepněte na bod`;
      for (const inp of el.querySelectorAll('[data-osa]')) {
        inp.disabled = !b;
        if (document.activeElement !== inp) inp.value = b ? K.fmt(inp.dataset.osa === 'r' ? b.r * d.sx : b.u * d.sy, 2) : '';
      }
      el.querySelectorAll('[data-typ]').forEach(t => t.setAttribute('aria-pressed', String(!!b && (b.typ || 'hladky') === t.dataset.typ)));
      el._meze = m;
    }

    /** Výška bodu v mezích: u hlavy těsně mezi póly, u seřazené skici (krček) mezi sousedy – pořadí se nikdy nepřehodí. */
    function nastavU(body, i, u, d) {
      let v = Math.max(d.hlava ? 0.005 : 0, Math.min(d.hlava ? 0.995 : 1, u));
      if (d.serazene) { const a = body[i - 1], c = body[i + 1]; if (a) v = Math.max(v, a.u + 0.01); if (c) v = Math.min(v, c.u - 0.01); }
      body[i].u = Math.round(v * 10000) / 10000;
    }
    const nastavR = (body, i, r, d) => { body[i].r = Math.round(Math.max(d.rMin || 0.02, Math.min(d.rMax || 1, r)) * 10000) / 10000; };
    /** Vybraný bod jen zvýraznit (bez přestavby SVG – jinak by klik a dvojklik netrefily bod). */
    function zvyrazniVyber() {
      plocha.querySelectorAll('circle.skica-uchyt').forEach(c => c.classList.toggle('vybrany', +c.dataset.i === vyber));
    }

    // tažení bodu nebo úchytu; SVG se přestavuje až při skutečném pohybu
    let klikNaBod = 0, posledniStisk = { i: -1, cas: 0 };
    plocha.addEventListener('pointerdown', e => {
      const t = e.target.closest('.skica-uchyt, .ep-uchyt'); if (!t) return;
      e.preventDefault(); el.focus({ preventScroll: true });
      const d = data(), i = +t.dataset.i;
      // dvojklik na bod = smazat; pointerdown nemá v Chromiu počet kliků (detail = 0), proto vlastní měření času
      const dvoj = !t.dataset.h && posledniStisk.i === i && Date.now() - posledniStisk.cas < 450;
      posledniStisk = { i: t.dataset.h ? -1 : i, cas: Date.now() }; klikNaBod = Date.now();
      if (dvoj) { tah = null; posledniStisk = { i: -1, cas: 0 }; smaz(i); return; }
      vyber = i; zvyrazniVyber();
      tah = { body: kopie(d.body), i, h: t.dataset.h || null, meze: el._meze, d, x0: e.clientX, y0: e.clientY, pohnuto: false };
    });
    window.addEventListener('pointermove', e => {
      if (!tah) return;
      if (!tah.pohnuto && Math.hypot(e.clientX - tah.x0, e.clientY - tah.y0) < 3) return;
      tah.pohnuto = true;
      const svg = plocha.querySelector('svg'); if (!svg) return;
      const P = bodSvg(svg, e), d = tah.d, m = tah.meze, b = tah.body[tah.i];
      const x = prichyt(P.x, 1), y = prichyt(m.y1 + m.y0 - P.y, 1);
      const pevny = d.pevne ? d.pevne(tah.i, tah.body.length) || {} : {};
      if (tah.h) {
        // úchyt: Bézier drží protější úchyt v zákrytu (stejný směr, vlastní délka)
        if (b.typ !== 'bezier' && b.typ !== 'uzel') { const U = uchyty(tah.body, tah.i, d.hlava); b.typ = 'bezier'; b.h1 = U.in; b.h2 = U.out; }
        const novy = { dr: x / d.sx - b.r, du: y / d.sy - b.u };
        b[tah.h] = novy;
        if (b.typ === 'bezier') {
          const druhy = tah.h === 'h1' ? 'h2' : 'h1', o = b[druhy], delka = Math.hypot(o.dr * d.sx, o.du * d.sy) || 1, n = Math.hypot(novy.dr * d.sx, novy.du * d.sy) || 1;
          b[druhy] = { dr: -novy.dr * delka / n, du: -novy.du * delka / n };
        }
      } else {
        if (!pevny.r) nastavR(tah.body, tah.i, x / d.sx, d);
        if (!pevny.u) nastavU(tah.body, tah.i, y / d.sy, d);
      }
      kresli(); zapis(tah.body, false);
    });
    const pust = () => {
      if (!tah) return;
      const t = tah; tah = null;
      if (t.pohnuto) zapis(t.body, true); else kresli();   // pouhý klik: ukázat úchyty a panel bodu
    };
    window.addEventListener('pointerup', pust); window.addEventListener('pointercancel', pust);
    plocha.addEventListener('click', e => {
      if (Date.now() - klikNaBod < 500 || e.target.closest('.skica-uchyt, .ep-uchyt') || tah) return;
      vyber = -1; kresli();
    });

    /** Vloží nový bod na úsek křivky nejbližší bodu (x, y) v mm a vybere ho. */
    function vlozNa(x, y) {
      const d = data(), body = kopie(d.body);
      if (body.length >= 40) return;
      let nej = Infinity, kam = body.length;
      const P = d.hlava ? [{ u: 0, r: 0 }].concat(body, [{ u: 1, r: 0 }]) : body;
      for (let i = 0; i + 1 < P.length; i++) {
        const a = [P[i].r * d.sx, P[i].u * d.sy], c = [P[i + 1].r * d.sx, P[i + 1].u * d.sy];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * (c[0] - a[0]) + (y - a[1]) * (c[1] - a[1])) / (((c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2) || 1)));
        const dd = Math.hypot(x - a[0] - t * (c[0] - a[0]), y - a[1] - t * (c[1] - a[1]));
        if (dd < nej) { nej = dd; kam = d.hlava ? i : i + 1; }
      }
      if (!d.hlava) kam = Math.max(1, Math.min(body.length - 1, kam));
      const novy = { u: 0.5, r: 0.5 };
      body.splice(kam, 0, novy);
      nastavR(body, kam, x / d.sx, d); nastavU(body, kam, y / d.sy, d);
      vyber = body.indexOf(novy);
      zapis(body, true);
    }
    function smaz(i) {
      const d = data(), body = kopie(d.body), pevny = d.pevne ? d.pevne(i, body.length) || {} : {};
      if (i < 0 || i >= body.length || body.length <= 2 || (pevny.u && pevny.r) || (!d.hlava && (i === 0 || i === body.length - 1))) return;
      body.splice(i, 1); vyber = Math.min(i, body.length - 1); zapis(body, true);
    }
    plocha.addEventListener('dblclick', e => {
      if (Date.now() - klikNaBod < 600) return;   // dvojklik na bod vyřídil pointerdown
      const svg = plocha.querySelector('svg'); if (!svg) return;
      const P = bodSvg(svg, e), m = el._meze;
      vlozNa(Math.abs(P.x), m.y1 + m.y0 - P.y);
    });
    el.querySelectorAll('[data-typ]').forEach(b => b.addEventListener('click', () => {
      const d = data(); if (vyber < 0 || vyber >= d.body.length) return;
      const body = kopie(d.body), bod = body[vyber], typ = b.dataset.typ;
      if (typ === 'bezier' || typ === 'uzel') { if (!bod.h1) { const U = uchyty(body, vyber, d.hlava); bod.h1 = U.in; bod.h2 = U.out; } }
      else { delete bod.h1; delete bod.h2; }
      if (typ === 'hladky') delete bod.typ; else bod.typ = typ;
      zapis(body, true);
    }));
    el.querySelector('[data-akce="pridat"]').addEventListener('click', () => {
      const d = data(), b = d.body, i = vyber >= 0 ? vyber : b.length - 2, c = b[i + 1] || { u: d.hlava ? 1 : b[i].u, r: d.hlava ? 0 : b[i].r }, a = b[i] || { u: 0, r: 0 };
      vlozNa((a.r + c.r) / 2 * d.sx, (a.u + c.u) / 2 * d.sy);
    });
    el.querySelector('[data-akce="smazat"]').addEventListener('click', () => smaz(vyber));
    el.querySelector('[data-akce="mrizka"]').addEventListener('change', e => { mrizka = e.target.checked; kresli(); });
    el.querySelector('[data-akce="velky"]').addEventListener('change', e => { velky = e.target.checked; kresli(); });
    for (const inp of el.querySelectorAll('[data-osa]')) inp.addEventListener('change', () => {
      const d = data(), v = K.cislo(inp.value, NaN); if (!Number.isFinite(v) || vyber < 0) return;
      const body = kopie(d.body), pevny = d.pevne ? d.pevne(vyber, body.length) || {} : {};
      if (vyber >= body.length) return;
      if (inp.dataset.osa === 'r' && !pevny.r) nastavR(body, vyber, v / d.sx, d);
      if (inp.dataset.osa === 'z' && !pevny.u) nastavU(body, vyber, v / d.sy, d);
      zapis(body, true);
    });
    el.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const d = data(), n = d.body.length;
      if (vyber >= n) vyber = -1;
      // [ ] nebo PageUp / PageDown = předchozí / další bod (výběr z klávesnice)
      if (['[', ']', 'PageUp', 'PageDown'].includes(e.key)) { e.preventDefault(); vyber = (vyber < 0 ? 0 : (vyber + ((e.key === ']' || e.key === 'PageDown') ? 1 : n - 1)) % n); kresli(); return; }
      if (vyber < 0) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); smaz(vyber); return; }
      const krok = (e.shiftKey ? 5 : 0.5), dx = { ArrowLeft: -krok, ArrowRight: krok }[e.key] || 0, dy = { ArrowDown: -krok, ArrowUp: krok }[e.key] || 0;
      if (!dx && !dy) return;
      e.preventDefault();
      const body = kopie(d.body), b = body[vyber], pevny = d.pevne ? d.pevne(vyber, n) || {} : {};
      if (!pevny.r) nastavR(body, vyber, b.r + dx / d.sx, d);
      if (!pevny.u) nastavU(body, vyber, b.u + dy / d.sy, d);
      zapis(body, true);
    });
    el.tabIndex = 0;
    return { kresli, tahne: () => !!tah };
  }
  window.EDITOR_PROFILU = { vytvor };
})();
