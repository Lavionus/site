/* S hák – kresba a editor průřezu (plátno #cPrurez).
   Souřadnice průřezu: u = šířka (v tisku osa Z, u = 0 na podložce), v = tloušťka od líce (v = 0 leží na trubce).
   Pohled „k trubce“: u vodorovně, v dolů (líc nahoře, jako na náčrtu). Pohled „tisková poloha“: u nahoru, v doprava.
   Vlastní průřez se kreslí v souřadnicích bodů editoru, ostatní tvary v normalizovaných (u ≥ 0, v ≥ 0). */
/* global SHAK, Dialog */
(function () {
  'use strict';
  const KLIC_PROFILY = 'webapp_s_hak_profily';

  function vytvorEditor(o) {
    const { $, ziskej, zmen, obnov, css, fmt } = o;
    const c = $('cPrurez');
    c.tabIndex = 0;
    const ed = { vybrany: -1, tah: -1, ramec: null, cil: null, ceka: false, typUkaz: 'mouse', zoom: 1, pan: [0, 0], posun: null,
      pohled: 'trubka', mrizka: 0.1, T: null, ramecKresby: null };
    const p = () => ziskej();
    const vlastni = () => p().prurez.typ === 'vlastni';
    const body = () => p().prurez.vlastni.body;

    /* ---------- transformace průřez ↔ plátno ---------- */
    function transformace(b, w, h) {
      const tisk = ed.pohled === 'tisk';
      // e = souřadnice obrazovky v mm před měřítkem: k trubce (u, v), tisk (v, −u)
      const e0 = tisk ? [b[1], -b[2]] : [b[0], b[1]], e1 = tisk ? [b[3], -b[0]] : [b[2], b[3]];
      const s = Math.min((w - 36) / Math.max(1e-6, e1[0] - e0[0]), (h - 36) / Math.max(1e-6, e1[1] - e0[1])) * ed.zoom;
      const cx = (e0[0] + e1[0]) / 2, cy = (e0[1] + e1[1]) / 2;
      const P = (u, v) => { const ex = tisk ? v : u, ey = tisk ? -u : v; return [w / 2 + ed.pan[0] + s * (ex - cx), h / 2 + ed.pan[1] + s * (ey - cy)]; };
      const inv = (x, y) => { const ex = (x - w / 2 - ed.pan[0]) / s + cx, ey = (y - h / 2 - ed.pan[1]) / s + cy; return tisk ? [-ey, ex] : [ex, ey]; };
      return { P, inv, s };
    }
    function pripravPlatno() {
      const dpr = window.__dprTisk || Math.min(window.devicePixelRatio || 1, 3), w = c.clientWidth || 300, h = c.clientHeight || 150;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      return { g, w, h };
    }
    /** Posun normalizovaného průřezu do souřadnic bodů vlastního (nejmenší u + seříznutí, nejmenší v). */
    function posunVlastniho(pr) {
      const r = SHAK.rozmeryVlastni(p().prurez.vlastni);
      return r ? [r.umin + (pr.rez || 0), r.vmin] : [0, 0];
    }
    const cesta = (g, T, Q, d) => { g.beginPath(); Q.forEach((q, i) => { const [x, y] = T.P(q[0] + d[0], q[1] + d[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    const usecka = (g, T, a, b) => { const A = T.P(a[0], a[1]), B = T.P(b[0], b[1]); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); };

    function kresli() {
      const { g, w, h } = pripravPlatno();
      const q = p(), pr = SHAK.prurez(q), vl = q.prurez.vlastni, jeVl = vlastni();
      c.classList.toggle('edit', jeVl);
      if (!jeVl || ed.vybrany >= vl.body.length) ed.vybrany = -1;   // po zpět, převzetí, načtení…
      // rámeček v souřadnicích kresby; při tažení zamrzlý, jinak bod utíká od kurzoru
      let b;
      if (ed.tah >= 0 && ed.ramec) b = ed.ramec;
      else if (jeVl) {
        const B = vl.body.map(x => [x[0], x[1]]).concat(vl.symetricky ? vl.body.map(x => [-x[0], x[1]]) : []);
        b = [Math.min(...B.map(x => x[0])), Math.min(...B.map(x => x[1])), Math.max(...B.map(x => x[0])), Math.max(...B.map(x => x[1]))];
        const ok = Math.max(1, (b[2] - b[0]) * 0.18, (b[3] - b[1]) * 0.18); b = [b[0] - ok, b[1] - ok, b[2] + ok, b[3] + ok];
      } else if (!pr.chyba) {
        const ok = Math.max(pr.sirka, pr.vyska) * 0.16; b = [-ok, -ok, pr.sirka + ok, pr.vyska + ok];
      } else b = [0, 0, 10, 10];
      ed.ramecKresby = b;
      const T = transformace(b, w, h); ed.T = T;
      // mřížka: 1 mm, při velkém přiblížení i krok editoru
      const kreslMriz = (krok, barva) => {
        if (T.s * krok < 7) return;
        const A = T.inv(0, 0), B = T.inv(w, h), C = T.inv(w, 0), D = T.inv(0, h);
        const u0 = Math.min(A[0], B[0], C[0], D[0]), u1 = Math.max(A[0], B[0], C[0], D[0]), v0 = Math.min(A[1], B[1], C[1], D[1]), v1 = Math.max(A[1], B[1], C[1], D[1]);
        g.strokeStyle = barva; g.lineWidth = 1;
        for (let u = Math.ceil(u0 / krok) * krok; u <= u1; u += krok) usecka(g, T, [u, v0], [u, v1]);
        for (let v = Math.ceil(v0 / krok) * krok; v <= v1; v += krok) usecka(g, T, [u0, v], [u1, v]);
      };
      if (jeVl && ed.mrizka < 1) kreslMriz(ed.mrizka, css('--bg-hover'));
      kreslMriz(1, css('--border'));
      g.font = '11px sans-serif';
      if (pr.chyba) { g.fillStyle = css('--danger'); g.fillText(pr.chyba, 8, 18); kresliBody(g, T, vl, jeVl); return; }
      const d = jeVl ? posunVlastniho(pr) : [0, 0];
      // líc (trubka) a podložka tiskárny
      const R = [b[0] - 50, b[1] - 50, b[2] + 50, b[3] + 50];
      g.setLineDash([5, 4]); g.strokeStyle = css('--text-muted');
      usecka(g, T, [R[0], d[1]], [R[2], d[1]]);
      g.setLineDash([]); g.strokeStyle = css('--warn'); g.lineWidth = 2.5;
      usecka(g, T, [d[0], R[1]], [d[0], R[3]]);
      g.lineWidth = 1;
      // původní obrys před doplněním převisů
      if (pr.doplneno) { cesta(g, T, pr.puvodni, d); g.setLineDash([3, 3]); g.strokeStyle = css('--text-faint'); g.stroke(); g.setLineDash([]); }
      if (jeVl) {   // nakreslený obrys tak, jak ho zadal uživatel (bez obálky a doplnění) – je vidět, co se vyplnilo
        const Ob = SHAK.obrysVlastni(vl);
        if (Ob.length > 2) { cesta(g, T, Ob, [0, 0]); g.setLineDash([1, 3]); g.strokeStyle = css('--text-muted'); g.stroke(); g.setLineDash([]); }
      }
      cesta(g, T, pr.body, d);
      g.fillStyle = css('--accent-soft'); g.fill(); g.strokeStyle = css('--accent'); g.lineWidth = 1.6; g.stroke(); g.lineWidth = 1;
      // převisy nad limit (jen když se nedoplňují)
      const pv = SHAK.previsy(pr, q.tisk.uhel);
      g.strokeStyle = css('--danger'); g.lineWidth = 3;
      for (const [a1, b1] of pv.useky) usecka(g, T, [a1[0] + d[0], a1[1] + d[1]], [b1[0] + d[0], b1[1] + d[1]]);
      g.lineWidth = 1;
      // kóty: šířka (podél u) a tloušťka (podél v)
      g.strokeStyle = css('--text-muted'); g.fillStyle = css('--text');
      const kota = (a1, b1, text) => {
        usecka(g, T, a1, b1);
        const A = T.P(a1[0], a1[1]), B = T.P(b1[0], b1[1]);
        for (const X of [A, B]) { g.beginPath(); g.arc(X[0], X[1], 2, 0, 2 * Math.PI); g.fill(); }
        const tw = g.measureText(text).width, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
        g.fillStyle = css('--bg-panel'); g.fillRect(mx - tw / 2 - 3, my - 8, tw + 6, 15);
        g.fillStyle = css('--text'); g.fillText(text, mx - tw / 2, my + 4);
      };
      const ov = pr.vyska + Math.max(pr.sirka, pr.vyska) * 0.08, ou = pr.sirka + Math.max(pr.sirka, pr.vyska) * 0.08;
      kota([d[0], d[1] + ov], [d[0] + pr.sirka, d[1] + ov], `${fmt(pr.sirka, 2)} mm`);
      kota([d[0] + ou, d[1]], [d[0] + ou, d[1] + pr.vyska], `${fmt(pr.vyska, 2)}`);
      // popisky
      g.fillStyle = css('--text-muted');
      const L = T.P(R[0] + 50 + (b[2] - b[0]) * 0.02, d[1]);
      g.fillText('líc k trubce', ed.pohled === 'tisk' ? L[0] + 4 : 6, ed.pohled === 'tisk' ? 14 : Math.max(12, L[1] - 4));
      g.fillStyle = css('--warn');
      const Pd = T.P(d[0], b[1] + (b[3] - b[1]) * 0.5);
      if (ed.pohled === 'tisk') g.fillText('▮ podložka tiskárny', 6, Math.min(h - 6, Pd[1] + 14)); else g.fillText('▮ podložka', Pd[0] + 4, h - 6);
      g.fillStyle = css('--text-muted');
      const info = [`plocha ${fmt(Math.abs(pr.plocha), 2)} mm²`, `na podložce ${fmt(pr.plochaPodlozky, 1)} mm`, `převis max ${fmt(pv.max, 0)}°`];
      g.fillText(info.join(' · '), 6, ed.pohled === 'tisk' ? h - 22 : 14);
      kresliBody(g, T, vl, jeVl);
      $('legPrevis').hidden = !pv.useky.length;
      $('legDoplneno').hidden = !pr.doplneno;
    }
    function kresliBody(g, T, vl, jeVl) {
      if (!jeVl) return;
      if (vl.symetricky) { g.strokeStyle = css('--text-faint'); g.setLineDash([3, 3]); usecka(g, T, [0, -1e3], [0, 1e3]); g.setLineDash([]); }
      vl.body.forEach((x, i) => {
        const [X, Y] = T.P(x[0], x[1]);
        g.beginPath();
        if (x[2]) g.rect(X - 4.5, Y - 4.5, 9, 9); else g.arc(X, Y, 5, 0, 2 * Math.PI);
        g.fillStyle = i === ed.vybrany ? css('--accent') : css('--bg-panel'); g.fill();
        g.strokeStyle = css('--accent'); g.lineWidth = 1.5; g.stroke(); g.lineWidth = 1;
        if (x[3] > 0 && !vl.vyhladit) { g.beginPath(); g.arc(X, Y, Math.max(3, x[3] * T.s), 0, 2 * Math.PI); g.strokeStyle = css('--text-faint'); g.setLineDash([2, 2]); g.stroke(); g.setLineDash([]); }
      });
      if (ed.vybrany >= 0) {
        const x = vl.body[ed.vybrany], [X, Y] = T.P(x[0], x[1]);
        g.fillStyle = css('--text'); g.fillText(`${ed.vybrany + 1}: ${fmt(x[0], 2)}; ${fmt(x[1], 2)}`, X + 8, Y - 8);
      }
    }

    /* ---------- vybraný bod a rozměry ---------- */
    const polBodu = ['f_bu', 'f_bv', 'f_br'];
    function oznac() {
      const jeVl = vlastni(), vl = p().prurez.vlastni, i = ed.vybrany;
      for (const id of ['btnBodSmaz', 'btnBodRoh', 'btnBodPridej', ...polBodu, 'f_bo']) $(id).disabled = !jeVl || i < 0;
      $('f_br').disabled = !jeVl || i < 0 || vl.vyhladit;
      if (jeVl && i >= 0) {
        const x = vl.body[i];
        [x[0], x[1], x[3] || 0].forEach((h, k) => { if (document.activeElement !== $(polBodu[k])) $(polBodu[k]).value = fmt(h, 3); });
        $('f_bo').checked = !!x[2];
        $('nBod').textContent = `Bod ${i + 1} z ${vl.body.length}`;
      } else { polBodu.forEach(id => { $(id).value = ''; }); $('f_bo').checked = false; $('nBod').textContent = 'Vyberte bod klepnutím'; }
      const r = jeVl ? SHAK.rozmeryVlastni(vl) : null;
      for (const [id, h] of [['f_vlW', r && r.sirka], ['f_vlH', r && r.vyska]]) if (document.activeElement !== $(id)) $(id).value = h ? fmt(h, 2) : '';
    }
    polBodu.forEach((id, k) => $(id).addEventListener('change', () => {
      const i = ed.vybrany, h = SHAK.cislo($(id).value, NaN);
      if (i < 0 || !Number.isFinite(h)) { oznac(); return; }
      zmen(x => { const b = x.prurez.vlastni.body[i]; while (b.length < 4) b.push(0); b[k === 2 ? 3 : k] = k === 2 ? Math.max(0, h) : (k === 0 && x.prurez.vlastni.symetricky ? Math.max(0, h) : h); });
      obnov();
    }));
    $('f_bo').addEventListener('change', () => { const i = ed.vybrany; if (i < 0) return; zmen(x => { x.prurez.vlastni.body[i][2] = $('f_bo').checked ? 1 : 0; }); obnov(); });
    for (const id of ['f_vlW', 'f_vlH']) $(id).addEventListener('change', () => {
      const r = SHAK.rozmeryVlastni(p().prurez.vlastni);
      const W = SHAK.cislo($('f_vlW').value, r ? r.sirka : 0), H = SHAK.cislo($('f_vlH').value, r ? r.vyska : 0);
      if (!(W > 0.5 && H > 0.3)) { oznac(); return; }
      zmen(x => { x.prurez.vlastni = SHAK.meritkoVlastni(x.prurez.vlastni, W, H); });
      ed.zoom = 1; ed.pan = [0, 0]; obnov();
    });

    /* ---------- myš a dotyk ---------- */
    const mys = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const prichyt = (x, e) => (e && e.altKey) ? Math.round(x * 1000) / 1000 : Math.round(x / ed.mrizka) * ed.mrizka;
    function najdiBod(x, y) {
      if (!ed.T) return -1;
      let best = -1, bd = 12;
      // body i jejich zrcadla (levá půlka) – zrcadlo se táhne za původní bod
      body().forEach((b, i) => { for (const u of [b[0], -b[0]]) { const [X, Y] = ed.T.P(u, b[1]); const dd = Math.hypot(X - x, Y - y); if (dd < bd) { bd = dd; best = i; } } });
      return best;
    }
    function presunBod(i, u, v) {
      const vl = p().prurez.vlastni;
      if (vl.symetricky) u = (i === 0 || i === vl.body.length - 1) ? 0 : Math.max(0.05, Math.abs(u));
      zmen(x => { const b = x.prurez.vlastni.body[i]; x.prurez.vlastni.body[i] = [u, v, b[2] || 0, b[3] || 0]; }, 'tah');
    }
    // přiblížení kolem bodu plátna (kolečko, dva prsty, tlačítka) – bod pod kurzorem zůstane na místě
    function zoomNa(x, y, novy) {
      if (!ed.T) return;
      const pred = ed.T.inv(x, y);
      ed.zoom = Math.max(0.3, Math.min(40, novy));
      kresli();
      const [X, Y] = ed.T.P(pred[0], pred[1]); ed.pan = [ed.pan[0] + x - X, ed.pan[1] + y - Y]; kresli();
    }
    const dotyky = new Map();
    let stisk = null;   // dva prsty: přiblížení a posun
    c.addEventListener('pointerdown', e => {
      ed.typUkaz = e.pointerType;
      const [x, y] = mys(e);
      dotyky.set(e.pointerId, [x, y]);
      if (dotyky.size === 2) {
        const [a, b] = [...dotyky.values()];
        stisk = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, zoom: ed.zoom, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], pan: ed.pan.slice() };
        ed.tah = -1; ed.ramec = null; ed.posun = null; ed.cil = null;
        c.setPointerCapture(e.pointerId);
        return;
      }
      const i = vlastni() ? najdiBod(x, y) : -1;
      if (i >= 0 && e.button === 0) {
        ed.vybrany = i; ed.tah = i; ed.ramec = ed.ramecKresby;
        c.setPointerCapture(e.pointerId);
      } else if (e.button === 0 || e.button === 1) {
        if (vlastni() && e.button === 0) ed.vybrany = -1;
        ed.posun = { x, y, pan: ed.pan.slice() };   // posun pohledu tažením prázdného místa
        c.setPointerCapture(e.pointerId);
        if (e.button === 1) e.preventDefault();
      }
      kresli(); oznac();
    });
    c.addEventListener('pointermove', e => {
      const [x, y] = mys(e);
      if (dotyky.has(e.pointerId)) dotyky.set(e.pointerId, [x, y]);
      if (stisk && dotyky.size === 2) {
        const [a, b] = [...dotyky.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ed.pan = [stisk.pan[0] + mid[0] - stisk.mid[0], stisk.pan[1] + mid[1] - stisk.mid[1]];
        zoomNa(mid[0], mid[1], stisk.zoom * Math.hypot(a[0] - b[0], a[1] - b[1]) / stisk.d);
        stisk.zoom = ed.zoom; stisk.d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; stisk.mid = mid; stisk.pan = ed.pan.slice();
        return;
      }
      if (ed.posun) { ed.pan = [ed.posun.pan[0] + x - ed.posun.x, ed.posun.pan[1] + y - ed.posun.y]; kresli(); return; }
      if (ed.tah < 0 || !ed.T) return;
      const [u, v] = ed.T.inv(x, y);
      ed.cil = [ed.tah, prichyt(u, e), prichyt(v, e)];
      if (ed.ceka) return;
      ed.ceka = true;
      requestAnimationFrame(() => {   // přepočet nejvýš jednou za snímek
        ed.ceka = false;
        if (!ed.cil) return;
        const [j, uu, vv] = ed.cil; ed.cil = null;
        presunBod(j, uu, vv); $('f_body').value = bodyNaText(p().prurez.vlastni); oznac();
      });
    });
    const konec = e => { dotyky.delete(e.pointerId); if (dotyky.size < 2) stisk = null; ed.posun = null; if (ed.tah < 0) return; ed.tah = -1; ed.ramec = null; kresli(); };
    c.addEventListener('pointerup', konec);
    c.addEventListener('pointercancel', konec);
    c.addEventListener('wheel', e => {
      e.preventDefault();
      const [x, y] = mys(e); zoomNa(x, y, ed.zoom * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    c.addEventListener('dblclick', e => {
      if (!vlastni() || !ed.T) return;
      const [x0, y0] = mys(e), i = najdiBod(x0, y0), vl = p().prurez.vlastni;
      if (i >= 0) { zmen(q => { q.prurez.vlastni.body[i][2] = q.prurez.vlastni.body[i][2] ? 0 : 1; }); obnov(); return; }
      // klik na zrcadlenou půlku: pracovat se zrcadlem kurzoru (body jsou jen na pravé půlce)
      const [u0, v0] = ed.T.inv(x0, y0), [x, y] = vl.symetricky && u0 < 0 ? ed.T.P(-u0, v0) : [x0, y0];
      // vložit do nejbližší úsečky
      const B = vl.body, n = B.length, uz = vl.symetricky ? n - 1 : n;
      let best = 0, bd = Infinity;
      for (let k = 0; k < uz; k++) {
        const [ax, ay] = ed.T.P(B[k][0], B[k][1]), [cx, cy] = ed.T.P(B[(k + 1) % n][0], B[(k + 1) % n][1]);
        const L2 = (cx - ax) ** 2 + (cy - ay) ** 2 || 1, t = Math.max(0, Math.min(1, ((x - ax) * (cx - ax) + (y - ay) * (cy - ay)) / L2));
        const dd = Math.hypot(ax + t * (cx - ax) - x, ay + t * (cy - ay) - y);
        if (dd < bd) { bd = dd; best = k; }
      }
      const [u, v] = ed.T.inv(x, y);
      zmen(q => { q.prurez.vlastni.body.splice(best + 1, 0, [vl.symetricky ? Math.max(0.05, prichyt(u)) : prichyt(u), prichyt(v), 0, 0]); });
      ed.vybrany = best + 1; obnov();
    });
    c.addEventListener('contextmenu', e => {
      if (!vlastni()) return;
      e.preventDefault();
      if (ed.typUkaz !== 'mouse') return;   // dlouhý stisk na dotyku nemaže
      const [x, y] = mys(e); ed.vybrany = najdiBod(x, y); smazBod();
    });
    c.addEventListener('keydown', e => {
      if (e.key === '+') { e.preventDefault(); zoomNa(c.clientWidth / 2, c.clientHeight / 2, ed.zoom * 1.25); return; }
      if (e.key === '-') { e.preventDefault(); zoomNa(c.clientWidth / 2, c.clientHeight / 2, ed.zoom / 1.25); return; }
      if (e.key === '0') { ed.zoom = 1; ed.pan = [0, 0]; kresli(); return; }
      if (!vlastni()) return;
      const n = body().length, i = ed.vybrany;
      // [ ] nebo , . = předchozí / další bod (Tab zůstává prohlížeči – z plátna se musí jít odejít)
      if ((e.key === '[' || e.key === ']' || e.key === ',' || e.key === '.') && n) { e.preventDefault(); const sm = e.key === ']' || e.key === '.' ? 1 : -1; ed.vybrany = ((i < 0 ? (sm > 0 ? -1 : 0) : i) + sm + n) % n; kresli(); oznac(); return; }
      if (e.key === 'Escape') { ed.vybrany = -1; kresli(); oznac(); return; }
      if (i < 0) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); smazBod(); return; }
      if (e.key === 'Insert') { e.preventDefault(); pridejBod(); return; }
      const smer = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!smer) return;
      e.preventDefault();
      const k = ed.mrizka * (e.shiftKey ? 10 : 1), b = body()[i];
      // šipky podle obrazovky: v tiskové poloze je vpravo +v a nahoru +u
      const [du, dv] = ed.pohled === 'tisk' ? [-smer[1] * k, smer[0] * k] : [smer[0] * k, smer[1] * k];
      presunBod(i, Math.round((b[0] + du) * 1000) / 1000, Math.round((b[1] + dv) * 1000) / 1000); obnov();
    });

    /* ---------- úpravy bodů ---------- */
    function smazBod() {
      const i = ed.vybrany;
      if (i < 0 || body().length <= 3) return;
      if (p().prurez.vlastni.symetricky && (i === 0 || i === body().length - 1)) { Dialog.info('Koncové body leží na ose souměrnosti – nejde je smazat, jen posunout po ose.'); return; }
      zmen(x => { x.prurez.vlastni.body.splice(i, 1); });
      ed.vybrany = -1; obnov();
    }
    function pridejBod() {
      const i = ed.vybrany, B = body(); if (i < 0) return;
      const j = i + 1 < B.length ? i + 1 : i - 1, a = B[i], b = B[j];
      const nov = [Math.round((a[0] + b[0]) * 500) / 1000, Math.round((a[1] + b[1]) * 500) / 1000, 0, 0];
      zmen(x => { x.prurez.vlastni.body.splice(Math.max(i, j), 0, nov); });
      ed.vybrany = Math.max(i, j); obnov();
    }
    $('btnBodSmaz').addEventListener('click', smazBod);
    $('btnBodPridej').addEventListener('click', pridejBod);
    $('btnBodRoh').addEventListener('click', () => { const i = ed.vybrany; if (i < 0) return; zmen(x => { x.prurez.vlastni.body[i][2] = x.prurez.vlastni.body[i][2] ? 0 : 1; }); obnov(); });

    /* ---------- body jako text ---------- */
    function bodyNaText(vl) { return (vl && vl.body ? vl.body : []).map(q => `${fmt(q[0], 3)} ${fmt(q[1], 3)}${q[2] ? ' o' : ''}${q[3] > 0 ? ' r' + fmt(q[3], 2) : ''}`).join('\n'); }
    /** Text → body; vrací {B, spatne: [čísla řádků]} – chybný řádek se nezahodí potichu. */
    function textNaBody(t) {
      const B = [], spatne = [];
      t.split('\n').forEach((r0, k) => {
        const r = r0.trim(); if (!r) return;
        const x = r.replace(/;/g, ' ').split(/\s+/);
        const rr = x.find(z => /^r/i.test(z));
        const q = [SHAK.cislo(x[0], NaN), SHAK.cislo(x[1], NaN), x.slice(2).some(z => /^o/i.test(z)) ? 1 : 0, rr ? Math.max(0, SHAK.cislo(rr.slice(1), 0)) : 0];
        if (Number.isFinite(q[0]) && Number.isFinite(q[1])) B.push(q); else spatne.push(k + 1);
      });
      return { B, spatne };
    }
    const hlasBody = t => { $('chybaBody').textContent = t; $('f_body').classList.toggle('spatne', !!t); };
    $('f_body').addEventListener('input', () => {
      const { B, spatne } = textNaBody($('f_body').value);
      if (spatne.length) { hlasBody(`Neplatný řádek ${spatne.join(', ')} – čekám „u v“ (např. 5,2 3), volitelně „o“ a „r1,5“.`); return; }
      if (B.length < 3) { hlasBody('Průřez potřebuje aspoň 3 body.'); return; }
      hlasBody('');
      zmen(x => { x.prurez.vlastni.body = B; }, 'body');
    });
    // po opuštění pole se text srovná s modelem – jen když je v pořádku (chybu nechat uživateli k opravě)
    $('f_body').addEventListener('change', () => { if (!$('f_body').classList.contains('spatne')) $('f_body').value = bodyNaText(p().prurez.vlastni); });
    // ↑/↓ v polích bodu: po kroku mřížky (Shift × 10), poloměr a rozměry po 0,1 / 1
    for (const [id, krok] of [['f_bu', () => ed.mrizka], ['f_bv', () => ed.mrizka], ['f_br', () => 0.1], ['f_vlW', () => 1], ['f_vlH', () => 0.1]]) $(id).addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const h = SHAK.cislo($(id).value, NaN); if (!Number.isFinite(h)) return;
      e.preventDefault();
      $(id).value = fmt(Math.round((h + krok() * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)) * 1000) / 1000, 3);
      $(id).dispatchEvent(new Event('change'));
    });

    /* ---------- lišta editoru ---------- */
    $('selPohled').addEventListener('change', () => { ed.pohled = $('selPohled').value; ed.zoom = 1; ed.pan = [0, 0]; kresli(); });
    $('selMrizka').addEventListener('change', () => { ed.mrizka = +$('selMrizka').value; kresli(); });
    $('btnPrizpusobit').addEventListener('click', () => { ed.zoom = 1; ed.pan = [0, 0]; kresli(); });
    $('btnZoomPlus').addEventListener('click', () => zoomNa(c.clientWidth / 2, c.clientHeight / 2, ed.zoom * 1.25));
    $('btnZoomMinus').addEventListener('click', () => zoomNa(c.clientWidth / 2, c.clientHeight / 2, ed.zoom / 1.25));
    $('btnVelky').addEventListener('click', () => {
      const h = !c.classList.contains('velky'); c.classList.toggle('velky', h); $('btnVelky').setAttribute('aria-pressed', String(h));
    });

    /* ---------- import SVG ---------- */
    function nastavBody(B, zdroj) {
      // průřez musí být souměrný: z obrysu se vezme pravá polovina, levá se zrcadlí
      zmen(x => { x.prurez.vlastni = { symetricky: true, vyhladit: false, body: SHAK.naPolovinu(B) }; x.prurez.typ = 'vlastni'; });
      ed.vybrany = -1; ed.zoom = 1; ed.pan = [0, 0]; obnov();
      Dialog.info(`${zdroj}: použita pravá polovina obrysu (průřez je souměrný). Rozměry upravíte polem Šířka / Tloušťka.`);
    }
    $('btnSvgCesta').addEventListener('click', async () => {
      const d = await Dialog.zeptej('Atribut d cesty SVG (souřadnice v mm, y dolů = od líce):', 'M 0 0 H 12 V 2 L 8 5 H 4 L 0 2 Z');
      if (!d) return;
      try { nastavBody(SHAK.svgCesta(d), 'Cesta SVG'); } catch (err) { Dialog.chyba(err.message); }
    });
    $('btnSvgSoubor').addEventListener('click', () => $('souborSvg').click());
    $('souborSvg').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const doc = new DOMParser().parseFromString(await f.text(), 'image/svg+xml');
        if (doc.querySelector('parsererror')) throw new Error('Soubor není platné SVG.');
        const d = [...doc.querySelectorAll('path')].map(x => x.getAttribute('d')).filter(Boolean)
          .concat([...doc.querySelectorAll('polygon, polyline')].map(x => 'M' + x.getAttribute('points') + 'Z'));
        if (!d.length) throw new Error('V SVG není žádná cesta (path) ani mnohoúhelník.');
        // největší obrys ze všech cest
        let best = null;
        for (const x of d) { try { const B = SHAK.svgCesta(x); if (!best || Math.abs(SHAK.plochaPolygonu(B)) > Math.abs(SHAK.plochaPolygonu(best))) best = B; } catch (er) { /* další cesta */ } }
        if (!best) throw new Error('Cesty v SVG se nepodařilo přečíst (oblouky A převeďte na křivky).');
        nastavBody(best, f.name);
      } catch (err) { Dialog.chyba(err.message); }
    });

    /* ---------- moje profily ---------- */
    const nactiProfily = () => { try { const x = JSON.parse(localStorage.getItem(KLIC_PROFILY) || '[]'); return Array.isArray(x) ? x : []; } catch (er) { return []; } };
    const ulozProfily = P => { try { localStorage.setItem(KLIC_PROFILY, JSON.stringify(P)); return true; } catch (er) { Dialog.chyba('Profil se nepodařilo uložit (plné úložiště?).'); return false; } };
    function naplnProfily() {
      const P = nactiProfily(), sel = $('selProfily');
      sel.innerHTML = P.length ? P.map((x, i) => `<option value="${i}"></option>`).join('') : '<option value="">– zatím žádné –</option>';
      P.forEach((x, i) => { sel.options[i].textContent = x.nazev; });
      $('btnProfilNacist').disabled = $('btnProfilSmazat').disabled = !P.length;
    }
    $('btnProfilUlozit').addEventListener('click', async () => {
      const nazev = (await Dialog.zeptej('Název profilu:', 'Můj profil') || '').trim();
      if (!nazev) return;
      const P = nactiProfily().filter(x => x.nazev !== nazev);
      P.push({ nazev, vlastni: SHAK.kopie(p().prurez.vlastni) });
      if (ulozProfily(P)) { naplnProfily(); $('selProfily').value = String(P.length - 1); Dialog.info(`Profil „${nazev}“ uložen.`); }
    });
    $('btnProfilNacist').addEventListener('click', () => {
      const x = nactiProfily()[+$('selProfily').value]; if (!x) return;
      const n = SHAK.normalizuj({ prurez: { vlastni: x.vlastni } });
      if (n.hlaseni.length) Dialog.info(`Profil „${x.nazev}“: ${n.hlaseni.join('; ')}.`);
      zmen(q => { q.prurez.vlastni = n.p.prurez.vlastni; q.prurez.typ = 'vlastni'; });
      ed.vybrany = -1; ed.zoom = 1; ed.pan = [0, 0]; obnov();
    });
    $('btnProfilSmazat').addEventListener('click', async () => {
      const P = nactiProfily(), i = +$('selProfily').value; if (!P[i]) return;
      if (!await Dialog.potvrd(`Smazat profil „${P[i].nazev}“?`)) return;
      P.splice(i, 1); ulozProfily(P); naplnProfily();
    });
    naplnProfily();

    return { kresli, oznac, bodyNaText, ed };
  }
  window.SHAK_EDITOR = { vytvorEditor };
})();
