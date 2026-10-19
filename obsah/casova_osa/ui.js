/* ============================================================
   casova_osa/ui.js – kreslení osy na plátno a ovládání stránky.
   Výpočty (kalendáře, značky, rozložení) jsou v jadro.js.
   ============================================================ */
(function () {
  'use strict';
  const O = window.OSA;
  const $ = s => document.querySelector(s);
  const KLIC_STAV = 'webapp_casova_osa_stav', KLIC_VLASTNI = 'webapp_casova_osa_vlastni';
  const PALETA = ['#4e8fd8', '#d9822b', '#2fa37a', '#c45bb0', '#c9a227', '#d65151', '#7a6fe0', '#3aa6b9', '#8c9a3a', '#b0703c'];

  /* ---------- rozměry ---------- */
  const OSA_V = 50, MINI_V = 30, RADEK_V = 20, BODY_V = 48, PAD_V = 7;
  const sirkaHlavy = W => (W < 620 ? 92 : 156);

  /* ---------- data ---------- */
  const ted = O.ted();
  let vestavene = (window.CASOVA_OSA_DATA || []).slice();
  let vlastni = nactiJSON(KLIC_VLASTNI, []);
  if (!Array.isArray(vlastni)) vlastni = [];
  const pripravene = new Map();
  function vsechnyStopy() { return vestavene.concat(vlastni); }
  function stopaPodleId(id) { return vsechnyStopy().find(s => s.id === id); }
  function priprav(id) {
    if (pripravene.has(id)) return pripravene.get(id);
    const s = stopaPodleId(id);
    if (!s) return null;
    const p = O.pripravStopu(s, ted);
    if (!p.barva) p.barva = PALETA[vsechnyStopy().indexOf(s) % PALETA.length];
    if (p.chyby.length) console.warn('Časová osa – chyby v datech:', p.chyby);
    p.vlastni = vlastni.includes(s);
    pripravene.set(id, p);
    return p;
  }
  function zneplatni(id) { if (id) pripravene.delete(id); else pripravene.clear(); }

  /* ---------- stav ---------- */
  const SROVNANI = window.CASOVA_OSA_SROVNANI || [];
  const S = {
    T0: 0, T1: 1, rezim: 'smiseny', viditelne: [], zarovnat: false, kotvy: {},
    scrollY: 0, vybrana: null, vybranaStopa: null, kurzor: null, pripnuto: null,
    mereni: null, rezimMereni: false, karta: 'detail', ulozenyAbs: null,
  };
  function vychozi() {
    const p = SROVNANI[0];
    S.viditelne = p ? p.stopy.slice() : vestavene.slice(0, 5).map(s => s.id);
    const a = O.ctiDatum(p ? p.od : '-3500'), b = O.ctiDatum(p ? p.do : '2030');
    S.T0 = a.T0; S.T1 = b.T1;
  }
  (function nactiStav() {
    vychozi();
    const ul = nactiJSON(KLIC_STAV, null);
    if (ul && typeof ul === 'object') {
      if (Array.isArray(ul.viditelne)) S.viditelne = ul.viditelne;
      if (isFinite(ul.T0) && isFinite(ul.T1) && ul.T1 > ul.T0) { S.T0 = ul.T0; S.T1 = ul.T1; }
      if (['smiseny', 'gregoriansky', 'juliansky'].includes(ul.rezim)) S.rezim = ul.rezim;
      if (ul.zarovnat) { S.zarovnat = true; S.ulozenyAbs = ul.ulozenyAbs || null; }
      if (ul.kotvy && typeof ul.kotvy === 'object') S.kotvy = ul.kotvy;
    }
    const h = O.zHashe(location.hash);
    if (h.stopy) S.viditelne = h.stopy;
    if (h.rezim) S.rezim = h.rezim;
    if (h.zarovnat != null) S.zarovnat = !!h.zarovnat;
    if (h.T0 != null) { S.T0 = h.T0; S.T1 = h.T1; }
    S.viditelne = S.viditelne.filter((id, i, a) => stopaPodleId(id) && a.indexOf(id) === i);
    if (!S.zarovnat) [S.T0, S.T1] = O.omez(S.T0, S.T1);
  })();
  let casUlozeni = 0;
  function ulozStav() {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => {
      try {
        localStorage.setItem(KLIC_STAV, JSON.stringify({
          viditelne: S.viditelne, T0: S.T0, T1: S.T1, rezim: S.rezim, zarovnat: S.zarovnat, kotvy: S.kotvy, ulozenyAbs: S.ulozenyAbs,
        }));
      } catch (e) { /* úložiště nedostupné */ }
      try { history.replaceState(null, '', O.doHashe({ T0: S.T0, T1: S.T1, stopy: S.viditelne, rezim: S.rezim, zarovnat: S.zarovnat })); } catch (e) { /* file:// */ }
    }, 350);
  }
  function nactiJSON(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function ulozVlastni() { try { localStorage.setItem(KLIC_VLASTNI, JSON.stringify(vlastni)); } catch (e) { Dialog.chyba('Vlastní stopy se nepodařilo uložit (úložiště prohlížeče je plné nebo zakázané).'); } }

  /* ---------- zarovnání stop ---------- */
  const kotva = st => (S.zarovnat ? (S.kotvy[st.id] != null ? S.kotvy[st.id] : st.min) : 0);
  const naOsu = (st, T) => T - kotva(st);           // absolutní T → souřadnice osy
  const zOsy = (st, u) => u + kotva(st);

  /* ---------- barvy ---------- */
  let B = {};
  function nactiBarvy() {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    B = {
      tmave: document.documentElement.dataset.theme !== 'light',
      bg: v('--bg-deep') || '#121212', panel: v('--bg-panel') || '#242424', el: v('--bg-elevated') || '#2d2d2d',
      text: v('--text') || '#e0e0e0', muted: v('--text-muted') || '#b0b0b0', faint: v('--text-faint') || '#9e9e9e',
      border: v('--border') || '#404040', silna: v('--border-strong') || '#4a4a4a', accent: v('--accent') || '#6aa6fd',
      warn: v('--warn') || '#e0a63f', danger: v('--danger') || '#f07575',
      font: getComputedStyle(document.body).fontFamily || 'sans-serif',
    };
    mixCache.clear();
  }
  function rgb(c) {
    c = String(c).trim();
    let m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return m[1].split('').map(x => parseInt(x + x, 16));
    m = /^#([0-9a-f]{6})/i.exec(c);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16));
    m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) return m[1].split(',').slice(0, 3).map(x => parseFloat(x));
    return [128, 128, 128];
  }
  const mixCache = new Map();
  function mix(a, b, t) {
    const k = a + '|' + b + '|' + t;
    if (mixCache.has(k)) return mixCache.get(k);
    const x = rgb(a), y = rgb(b);
    const r = x.map((v, i) => Math.round(v * t + y[i] * (1 - t)));
    const out = { css: `rgb(${r[0]},${r[1]},${r[2]})`, jas: (0.2126 * lin(r[0]) + 0.7152 * lin(r[1]) + 0.0722 * lin(r[2])) };
    mixCache.set(k, out);
    return out;
  }
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  const textNa = jas => (jas > 0.22 ? '#111' : '#fff');

  /* ---------- plátno ---------- */
  const obal = $('#osa-obal'), cv = $('#platno'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, hity = [], vyskaObsahu = 0;
  function velikost() {
    const r = obal.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    prekresli();
  }
  let rafId = 0;
  function prekresli() { if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; kresliVse(); }); }
  function kresliVse() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = kresli(ctx, W, H, { scrollY: S.scrollY, mini: true });
    hity = r.hity; vyskaObsahu = r.vyska;
    const max = Math.max(0, vyskaObsahu - (H - OSA_V - MINI_V));
    if (S.scrollY > max) { S.scrollY = max; return kresliVse(); }
    $('#meritko').textContent = (S.zarovnat ? 'Zarovnáno · ' : '') + 'Výřez ' + O.textTrvani(S.T1 - S.T0);
    if (window.__osaPoKresleni) window.__osaPoKresleni();
  }

  function vyskaStopy(st) { return PAD_V + Math.max(1, st.radku) * RADEK_V + (st.body.length ? BODY_V : 0) + PAD_V - (st.radku ? 0 : RADEK_V); }

  /**
   * Nakreslí osu do kontextu c (W×Hc v CSS pixelech). Vrací {hity, vyska}.
   * Používá se i pro export PNG (o.vse = všechny stopy bez rolování, bez minimapy).
   */
  function kresli(c, Wc, Hc, o) {
    const L = sirkaHlavy(Wc), Rk = Wc;
    const sp = S.T1 - S.T0, kx = (Rk - L) / sp;
    const x = u => L + (u - S.T0) * kx;
    const out = [];
    const font = (vel, tucne) => (tucne ? '600 ' : '') + vel + 'px ' + B.font;
    c.fillStyle = B.bg; c.fillRect(0, 0, Wc, Hc);

    const stopy = S.viditelne.map(priprav).filter(Boolean);
    const dolni = o.mini ? MINI_V : 0;
    const top = OSA_V + (o.horni || 0);

    // značky (kvůli mřížce dřív než stopy)
    const zn = S.zarovnat ? O.znackyRelativni(S.T0, S.T1, Rk - L, 84) : O.znacky(S.T0, S.T1, Rk - L, S.rezim, 84);

    // mřížka
    c.save();
    c.beginPath(); c.rect(L, top, Rk - L, Hc - top - dolni); c.clip();
    c.strokeStyle = B.border; c.lineWidth = 1; c.globalAlpha = 0.55;
    c.beginPath();
    for (const z of zn.male) { const xx = Math.round(x(z.T)) + 0.5; c.moveTo(xx, top); c.lineTo(xx, Hc - dolni); }
    c.stroke();
    c.globalAlpha = 1;
    c.strokeStyle = B.silna;
    c.beginPath();
    for (const z of zn.velke) { const xx = Math.round(x(z.T)) + 0.5; c.moveTo(xx, top); c.lineTo(xx, Hc - dolni); }
    c.stroke();
    c.restore();

    // stopy
    let y = top - (o.scrollY || 0);
    const yStop = [];
    c.save();
    c.beginPath(); c.rect(0, top, Wc, Hc - top - dolni); c.clip();
    stopy.forEach((st, si) => {
      const h = vyskaStopy(st);
      yStop.push({ st, y, h });
      if (y + h >= top && y <= Hc - dolni) kresliStopu(c, st, y, h, L, Rk, x, out, font, si);
      y += h;
    });
    const vyska = y + (o.scrollY || 0) - top;
    if (!stopy.length) {
      c.fillStyle = B.faint; c.font = font(14); c.textAlign = 'center';
      c.fillText('Žádná stopa není zobrazená – vyberte je v panelu Stopy nebo Srovnání.', L + (Rk - L) / 2, top + 60);
      c.textAlign = 'left';
    }

    // dnešek
    if (!S.zarovnat && ted >= S.T0 && ted <= S.T1) {
      const xx = Math.round(x(ted)) + 0.5;
      c.strokeStyle = B.warn; c.setLineDash([4, 4]); c.lineWidth = 1;
      c.beginPath(); c.moveTo(xx, top); c.lineTo(xx, Hc - dolni); c.stroke(); c.setLineDash([]);
    }
    // měření
    if (S.mereni && o.mini) {
      const a = Math.min(S.mereni.a, S.mereni.b), b = Math.max(S.mereni.a, S.mereni.b);
      const xa = x(a), xb = x(b);
      c.fillStyle = B.accent; c.globalAlpha = 0.13; c.fillRect(xa, top, xb - xa, Hc - top - dolni); c.globalAlpha = 1;
      c.strokeStyle = B.accent; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(xa, top); c.lineTo(xa, Hc - dolni); c.moveTo(xb, top); c.lineTo(xb, Hc - dolni); c.stroke();
      const t = O.textTrvani(b - a);
      c.font = font(13, true);
      const tw = c.measureText(t).width + 14, xm = Math.max(L + 4, Math.min(Rk - tw - 4, (xa + xb) / 2 - tw / 2));
      c.fillStyle = B.accent; roundRect(c, xm, top + 8, tw, 22, 5); c.fill();
      c.fillStyle = textNa(mix(B.accent, B.accent, 1).jas); c.fillText(t, xm + 7, top + 24);
    }
    // připíchnutý a pohyblivý kurzor
    for (const [u, barva, sila] of [[S.pripnuto, B.accent, 1.5], [S.kurzor, B.faint, 1]]) {
      if (u == null || !o.mini || u < S.T0 || u > S.T1) continue;
      const xx = Math.round(x(u)) + 0.5;
      c.strokeStyle = barva; c.lineWidth = sila;
      c.beginPath(); c.moveTo(xx, top); c.lineTo(xx, Hc - dolni); c.stroke();
    }
    // posuvník
    const viditelna = Hc - top - dolni;
    if (o.mini && vyska > viditelna) {
      const pod = viditelna / vyska, hb = Math.max(24, viditelna * pod), yb = top + (o.scrollY / (vyska - viditelna)) * (viditelna - hb);
      c.fillStyle = B.silna; roundRect(c, Wc - 5, yb, 3, hb, 2); c.fill();
    }
    c.restore();

    // hlavičky stop (levý sloupec)
    c.save();
    c.beginPath(); c.rect(0, top, L, Hc - top - dolni); c.clip();
    c.fillStyle = B.panel; c.fillRect(0, top, L, Hc - top - dolni);
    for (const { st, y: ys, h } of yStop) {
      if (ys + h < top || ys > Hc - dolni) continue;
      const vyb = S.vybranaStopa === st.id;
      if (vyb) { c.fillStyle = mix(st.barva, B.panel, 0.18).css; c.fillRect(0, ys, L, h); }
      c.fillStyle = st.barva; c.fillRect(0, ys + 3, 4, h - 6);
      c.fillStyle = B.text; c.font = font(L < 120 ? 11.5 : 12.5, true);
      const radky = zalom(c, st.nazev, L - 16, 3);
      radky.forEach((t, i) => c.fillText(t, 10, ys + 17 + i * 15));
      if (S.zarovnat) {
        c.fillStyle = B.faint; c.font = font(10.5);
        c.fillText('0 = ' + O.textDataKratce(kotva(st), 'rok', S.rezim), 10, ys + 17 + radky.length * 15);
      }
      c.strokeStyle = B.border; c.beginPath(); c.moveTo(0, ys + h - 0.5); c.lineTo(Wc, ys + h - 0.5); c.stroke();
      out.push({ x0: 0, y0: Math.max(ys, top), x1: L, y1: Math.min(ys + h, Hc - dolni), druh: 'hlava', st });
    }
    c.strokeStyle = B.border; c.beginPath(); c.moveTo(L - 0.5, top); c.lineTo(L - 0.5, Hc - dolni); c.stroke();
    c.restore();

    // osa nahoře
    kresliOsu(c, Wc, L, Rk, x, zn, font, o);

    // minimapa
    if (o.mini) kresliMinimapu(c, Wc, Hc, L, stopy, font, out);
    return { hity: out, vyska };
  }

  function kresliStopu(c, st, y0, h, L, Rk, x, out, font, si) {
    if (si % 2) { c.fillStyle = B.tmave ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.022)'; c.fillRect(L, y0, Rk - L, h); }
    const U0 = S.T0, U1 = S.T1;
    const vyb = S.vybrana;
    // období a osoby
    for (const p of st.obdobi) {
      const u0 = naOsu(st, p.t0), u1 = naOsu(st, p.t1);
      if (u1 < U0 || u0 > U1) continue;
      let xa = x(u0), xb = x(u1);
      if (xb - xa < 2) { const s = (xa + xb) / 2; xa = s - 1; xb = s + 1; }
      const yy = y0 + PAD_V + p.radek * RADEK_V, hh = RADEK_V - 4;
      const osoba = p.typ === 'osoba';
      const fill = osoba ? mix(st.barva, B.bg, B.tmave ? 0.32 : 0.22) : mix(st.barva, B.bg, B.tmave ? 0.62 : 0.42);
      const xa2 = Math.max(xa, L - 20), xb2 = Math.min(xb, Rk + 20);
      c.fillStyle = fill.css;
      roundRect(c, xa2, yy, xb2 - xa2, hh, osoba ? hh / 2 : 3); c.fill();
      if (p.cca) {
        // neurčité hranice: vybledlé konce
        const fw = Math.min(14, (xb - xa) / 4);
        for (const [xs, smer] of [[xa, 1], [xb, -1]]) {
          if (xs < L - 20 || xs > Rk + 20) continue;
          const g = c.createLinearGradient(xs, 0, xs + smer * fw, 0);
          g.addColorStop(0, B.bg); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.globalAlpha = 0.7; c.fillRect(Math.min(xs, xs + smer * fw), yy, fw, hh); c.globalAlpha = 1;
        }
      }
      const jeVyb = vyb && vyb.stopa === st.id && vyb.i === p.i;
      if (osoba || jeVyb) {
        c.strokeStyle = jeVyb ? B.accent : st.barva; c.lineWidth = jeVyb ? 2 : 1;
        roundRect(c, xa2 + 0.5, yy + 0.5, xb2 - xa2 - 1, hh - 1, osoba ? hh / 2 : 3); c.stroke();
      }
      if (p.dnes && xb <= Rk + 20) { c.fillStyle = fill.css; c.beginPath(); c.moveTo(xb, yy); c.lineTo(xb + 7, yy + hh / 2); c.lineTo(xb, yy + hh); c.fill(); }
      // popisek přilepený k levému okraji viditelné části
      const vx0 = Math.max(xa, L) + (osoba ? 7 : 5), vx1 = Math.min(xb, Rk) - 4;
      if (vx1 - vx0 > 18) {
        c.font = font(11.5, !osoba);
        c.fillStyle = osoba ? B.text : textNa(fill.jas);
        const t = zkrat(c, p.nazev + (p.cca ? ' (cca)' : ''), vx1 - vx0);
        if (t) c.fillText(t, vx0, yy + hh - 4.5);
      }
      out.push({ x0: xa, y0: yy, x1: xb, y1: yy + hh, druh: 'pol', st, p });
    }
    // události
    if (st.body.length) {
      const yb = y0 + PAD_V + st.radku * RADEK_V + 8;
      c.strokeStyle = B.border; c.lineWidth = 1;
      c.beginPath(); c.moveTo(L, yb + 0.5); c.lineTo(Rk, yb + 0.5); c.stroke();
      const radky = [-Infinity, -Infinity];
      c.font = font(11);
      for (const p of st.body) {
        const u0 = naOsu(st, p.t0);
        if (u0 < U0 - (U1 - U0) * 0.3 || u0 > U1) continue;
        const xx = x(u0), xk = x(naOsu(st, p.t0Konec));
        if (xx > Rk + 5) continue;
        if (xk - xx > 8) {
          // nejistota údaje (rok/měsíc/den) jako pruh
          c.fillStyle = st.barva; c.globalAlpha = 0.28; c.fillRect(xx, yb - 3, xk - xx, 7); c.globalAlpha = 1;
        }
        const jeVyb = vyb && vyb.stopa === st.id && vyb.i === p.i;
        if (xx >= L - 6) {
          c.fillStyle = jeVyb ? B.accent : st.barva;
          c.beginPath(); c.moveTo(xx, yb - 5.5); c.lineTo(xx + 5.5, yb + 0.5); c.lineTo(xx, yb + 6.5); c.lineTo(xx - 5.5, yb + 0.5); c.closePath(); c.fill();
          c.strokeStyle = B.bg; c.lineWidth = 1; c.stroke();
          out.push({ x0: xx - 7, y0: yb - 8, x1: xx + 7, y1: yb + 9, druh: 'pol', st, p, bod: true });
        }
        // popisek do prvního volného ze dvou řádků
        const t = (p.cca ? '~' : '') + p.nazev;
        const tw = Math.min(c.measureText(t).width, 190);
        const lx = Math.max(xx - 2, L + 2);
        for (let r = 0; r < 2; r++) {
          if (lx > radky[r] + 6 && lx < Rk - 20) {
            const ly = yb + 20 + r * 15;
            c.strokeStyle = st.barva; c.globalAlpha = 0.45;
            c.beginPath(); c.moveTo(xx + 0.5, yb + 7); c.lineTo(xx + 0.5, ly - 9); c.stroke(); c.globalAlpha = 1;
            c.fillStyle = jeVyb ? B.accent : B.text;
            const s = zkrat(c, t, Math.min(190, Rk - lx - 4));
            c.fillText(s, lx + 2, ly);
            const sw = c.measureText(s).width;
            radky[r] = lx + 2 + sw;
            out.push({ x0: lx, y0: ly - 11, x1: lx + 4 + sw, y1: ly + 3, druh: 'pol', st, p, bod: true });
            break;
          }
        }
        void tw;
      }
    }
  }

  function kresliOsu(c, Wc, L, Rk, x, zn, font, o) {
    c.fillStyle = B.panel; c.fillRect(0, 0, Wc, OSA_V);
    c.strokeStyle = B.border; c.beginPath(); c.moveTo(0, OSA_V - 0.5); c.lineTo(Wc, OSA_V - 0.5); c.moveTo(0, 22.5); c.lineTo(Wc, 22.5); c.stroke();
    c.save(); c.beginPath(); c.rect(L, 0, Rk - L, OSA_V); c.clip();
    // velké (kontext)
    c.font = font(12, true); c.fillStyle = B.text;
    zn.velke.forEach((z, i) => {
      const xx = x(z.T), dalsi = i + 1 < zn.velke.length ? x(zn.velke[i + 1].T) : Rk + 400;
      if (dalsi < L) return;
      c.strokeStyle = B.silna; c.beginPath(); c.moveTo(Math.round(xx) + 0.5, 0); c.lineTo(Math.round(xx) + 0.5, 22); c.stroke();
      const tw = c.measureText(z.text).width;
      let lx = Math.max(xx + 5, L + 6);
      if (lx + tw > dalsi - 4) lx = dalsi - 4 - tw;          // odjede s koncem úseku
      if (lx + tw > xx) c.fillText(z.text, lx, 16);
    });
    // malé
    c.font = font(11.5); c.fillStyle = B.muted; c.strokeStyle = B.faint;
    let posl = -Infinity;
    for (const z of zn.male) {
      const xx = Math.round(x(z.T)) + 0.5;
      c.beginPath(); c.moveTo(xx, OSA_V - 7); c.lineTo(xx, OSA_V); c.stroke();
      const tw = c.measureText(z.text).width;
      if (xx + 3 > posl + 6) { c.fillText(z.text, xx + 3, OSA_V - 12); posl = xx + 3 + tw; }
    }
    // bublina kurzoru
    const u = S.kurzor != null ? S.kurzor : null;
    if (u != null && o.mini && u >= S.T0 && u <= S.T1) {
      const t = textKurzoru(u);
      c.font = font(11.5, true);
      const tw = c.measureText(t).width + 12, xx = Math.max(L + 2, Math.min(Rk - tw - 2, x(u) - tw / 2));
      c.fillStyle = B.el; roundRect(c, xx, 25, tw, 19, 4); c.fill();
      c.strokeStyle = B.silna; c.stroke();
      c.fillStyle = B.text; c.fillText(t, xx + 6, 39);
    }
    c.restore();
    c.fillStyle = B.faint; c.font = font(10.5);
    c.fillText(S.zarovnat ? 'od začátku stopy' : nazevKalendare(), 8, 16);
    c.fillText(S.zarovnat ? 'posun' : 'datum', 8, OSA_V - 12);
  }
  const nazevKalendare = () => ({ smiseny: 'jul. → greg.', gregoriansky: 'gregoriánský', juliansky: 'juliánský' })[S.rezim];
  function presnostZoomu() {
    const sp = S.T1 - S.T0;
    return sp < 4 ? 'minuta' : sp < 500 ? 'den' : sp < 40 * O.ROK ? 'mesic' : 'rok';
  }
  function textKurzoru(u) {
    if (S.zarovnat) return O.textPosunu(u);
    return O.textData(u, presnostZoomu(), S.rezim);
  }

  function kresliMinimapu(c, Wc, Hc, L, stopy, font, out) {
    const y0 = Hc - MINI_V;
    c.fillStyle = B.panel; c.fillRect(0, y0, Wc, MINI_V);
    c.strokeStyle = B.border; c.beginPath(); c.moveTo(0, y0 + 0.5); c.lineTo(Wc, y0 + 0.5); c.stroke();
    const [m0, m1] = rozsahMinimapy(stopy);
    const k = (Wc - L - 10) / (m1 - m0), mx = u => L + (u - m0) * k;
    const n = Math.max(1, stopy.length), rh = Math.max(1.5, Math.min(4, (MINI_V - 8) / n));
    stopy.forEach((st, i) => {
      c.fillStyle = st.barva;
      const yy = y0 + 4 + i * rh;
      for (const p of st.obdobi) { const a = mx(naOsu(st, p.t0)), b = mx(naOsu(st, p.t1)); c.fillRect(a, yy, Math.max(1, b - a), rh - 0.5); }
      for (const p of st.body) c.fillRect(mx(naOsu(st, p.t0)), yy, 1, rh - 0.5);
    });
    const a = Math.max(L, mx(S.T0)), b = Math.min(Wc - 10, mx(S.T1));
    c.fillStyle = B.accent; c.globalAlpha = 0.16; c.fillRect(a, y0 + 1, Math.max(3, b - a), MINI_V - 2); c.globalAlpha = 1;
    c.strokeStyle = B.accent; c.lineWidth = 1.5; c.strokeRect(a, y0 + 2, Math.max(3, b - a), MINI_V - 4); c.lineWidth = 1;
    c.fillStyle = B.faint; c.font = font(10.5);
    c.fillText('přehled', 8, y0 + 19);
    out.push({ x0: L, y0, x1: Wc, y1: Hc, druh: 'mini', m0, m1, k });
  }
  function rozsahMinimapy(stopy) {
    let a = Infinity, b = -Infinity;
    for (const st of stopy) { a = Math.min(a, naOsu(st, st.min)); b = Math.max(b, naOsu(st, st.max)); }
    if (!isFinite(a)) { a = S.T0; b = S.T1; }
    a = Math.min(a, S.T0); b = Math.max(b, S.T1);
    const p = (b - a) * 0.02;
    return [a - p, b + p];
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function zkrat(c, t, max) {
    if (c.measureText(t).width <= max) return t;
    if (max < 14) return '';
    let lo = 0, hi = t.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c.measureText(t.slice(0, m) + '…').width <= max) lo = m; else hi = m - 1; }
    return lo ? t.slice(0, lo).trimEnd() + '…' : '';
  }
  function zalom(c, t, max, maxRadku) {
    const slova = t.split(' '), r = [];
    let akt = '';
    for (const s of slova) {
      const z = akt ? akt + ' ' + s : s;
      if (c.measureText(z).width <= max || !akt) akt = z; else { r.push(akt); akt = s; }
    }
    if (akt) r.push(akt);
    if (r.length > maxRadku) { r.length = maxRadku; r[maxRadku - 1] = zkrat(c, r[maxRadku - 1] + '…', max); }
    return r.map(s => zkrat(c, s, max));
  }

  /* ---------- pohyb pohledu ---------- */
  function nastavPohled(T0, T1) {
    if (S.zarovnat) {
      const roz = Math.min(O.MAX_ROZPETI, Math.max(O.MIN_ROZPETI, T1 - T0));
      const s = (T0 + T1) / 2; T0 = s - roz / 2; T1 = s + roz / 2;
      const lim = 20000 * O.ROK;
      if (T0 < -lim) { T0 = -lim; T1 = T0 + roz; }
      if (T1 > lim) { T1 = lim; T0 = T1 - roz; }
    } else [T0, T1] = O.omez(T0, T1);
    S.T0 = T0; S.T1 = T1;
    prekresli(); ulozStav(); planujSoucasne();
  }
  let animace = 0;
  function animujNa(T0, T1, ms) {
    cancelAnimationFrame(animace);
    const a0 = S.T0, a1 = S.T1, s0 = (a0 + a1) / 2, s1 = (T0 + T1) / 2, l0 = Math.log(a1 - a0), l1 = Math.log(T1 - T0);
    const start = performance.now(), dur = ms == null ? 420 : ms;
    if (dur <= 0 || document.hidden) return nastavPohled(T0, T1);
    const krok = now => {
      const t = Math.min(1, (now - start) / dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // logaritmická interpolace rozpětí – plynulé i přes tisíciletí
      const roz = Math.exp(l0 + (l1 - l0) * e), st = s0 + (s1 - s0) * e;
      nastavPohled(st - roz / 2, st + roz / 2);
      if (t < 1) animace = requestAnimationFrame(krok);
    };
    animace = requestAnimationFrame(krok);
  }
  function zoomKolem(u, f, anim) {
    const [a, b] = zoomOsy(S.T0, S.T1, u, f);
    if (anim) animujNa(a, b, 260); else nastavPohled(a, b);
  }
  function zoomOsy(T0, T1, u, f) {
    if (!S.zarovnat) return O.zoom(T0, T1, u, f);
    const roz = Math.min(O.MAX_ROZPETI, Math.max(O.MIN_ROZPETI, (T1 - T0) / f)), pod = (u - T0) / (T1 - T0);
    return [u - pod * roz, u - pod * roz + roz];
  }
  function cele(anim) {
    const stopy = S.viditelne.map(priprav).filter(Boolean);
    if (!stopy.length) return;
    let a = Infinity, b = -Infinity;
    for (const st of stopy) { a = Math.min(a, naOsu(st, st.min)); b = Math.max(b, naOsu(st, st.max)); }
    const p = (b - a) * 0.04 || 1;
    if (anim === false) nastavPohled(a - p, b + p); else animujNa(a - p, b + p);
  }
  function naPolozku(st, p) {
    const a = naOsu(st, p.t0), b = naOsu(st, p.bod ? p.t0Konec : p.t1);
    let roz = Math.max(b - a, O.MIN_ROZPETI);
    if (p.bod) roz = Math.max(roz * 6, p.presnostOd === 'rok' ? 30 * O.ROK : p.presnostOd === 'mesic' ? 2 * O.ROK : p.presnostOd === 'den' ? 60 : 1);
    const s = (a + b) / 2, pul = roz * (p.bod ? 0.5 : 0.62);
    animujNa(s - pul, s + pul);
    // stopu vyrolovat do pohledu
    let y = 0;
    for (const id of S.viditelne) {
      const s2 = priprav(id); if (!s2) continue;
      if (s2.id === st.id) { const vh = H - OSA_V - MINI_V; if (y < S.scrollY || y + vyskaStopy(s2) > S.scrollY + vh) S.scrollY = Math.max(0, y - 20); break; }
      y += vyskaStopy(s2);
    }
  }
  function naStopu(st) {
    const a = naOsu(st, st.min), b = naOsu(st, st.max), p = (b - a) * 0.05;
    animujNa(a - p, b + p);
  }

  /* ---------- zarovnání ---------- */
  function prepniZarovnani(zap) {
    if (zap === S.zarovnat) return;
    if (zap) {
      S.ulozenyAbs = [S.T0, S.T1];
      S.zarovnat = true; S.pripnuto = null; S.mereni = null;
      cele(false);
    } else {
      S.zarovnat = false; S.pripnuto = null; S.mereni = null;
      const u = S.ulozenyAbs;
      if (u) nastavPohled(u[0], u[1]); else cele(false);
    }
    $('#b-zarovnat').classList.toggle('zap', S.zarovnat);
    $('#b-zarovnat').setAttribute('aria-pressed', S.zarovnat);
    vykresliPanel(); prekresli(); ulozStav();
  }

  /* ---------- myš a dotyk ---------- */
  const ukazatele = new Map();
  let tah = null, stiskCas = 0;
  const lokal = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const uZX = px => S.T0 + (px - sirkaHlavy(W)) / (W - sirkaHlavy(W)) * (S.T1 - S.T0);
  function hit(px, py) {
    for (let i = hity.length - 1; i >= 0; i--) {
      const h = hity[i];
      if (px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1) {
        if (h.druh === 'pol' && (py < OSA_V || py > H - MINI_V || px < sirkaHlavy(W))) continue;
        return h;
      }
    }
    return null;
  }
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    obal.focus({ preventScroll: true });
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* syntetická událost */ }
    const p = lokal(e);
    ukazatele.set(e.pointerId, p);
    cancelAnimationFrame(animace);
    if (ukazatele.size === 2) {
      const [a, b] = [...ukazatele.values()];
      tah = { druh: 'stisk', d0: Math.hypot(a.x - b.x, a.y - b.y), T0: S.T0, T1: S.T1, u: uZX((a.x + b.x) / 2) };
      return;
    }
    const h = hit(p.x, p.y);
    if (h && h.druh === 'mini') { tah = { druh: 'mini', h }; posunMinimapou(h, p.x); return; }
    if ((S.rezimMereni || e.shiftKey) && p.y > OSA_V && p.x > sirkaHlavy(W)) {
      const u = uZX(p.x);
      tah = { druh: 'mer' }; S.mereni = { a: u, b: u }; prekresli(); return;
    }
    tah = { druh: 'pan', x: p.x, y: p.y, T0: S.T0, T1: S.T1, sy: S.scrollY, posun: false, h };
    stiskCas = performance.now();
  });
  cv.addEventListener('pointermove', e => {
    const p = lokal(e);
    if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, p);
    if (tah && tah.druh === 'stisk' && ukazatele.size === 2) {
      const [a, b] = [...ukazatele.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (tah.d0 > 10) { const [x0, x1] = zoomOsy(tah.T0, tah.T1, tah.u, d / tah.d0); nastavPohled(x0, x1); }
      return;
    }
    if (tah && tah.druh === 'mini') { posunMinimapou(tah.h, p.x); return; }
    if (tah && tah.druh === 'mer') { S.mereni.b = uZX(p.x); S.kurzor = S.mereni.b; prekresli(); return; }
    if (tah && tah.druh === 'pan') {
      const dx = p.x - tah.x, dy = p.y - tah.y;
      if (!tah.posun && Math.abs(dx) + Math.abs(dy) > 5) { tah.posun = true; cv.classList.add('tah'); skryjTip(); }
      if (tah.posun) {
        const k = (tah.T1 - tah.T0) / (W - sirkaHlavy(W));
        nastavPohled(tah.T0 - dx * k, tah.T1 - dx * k);
        S.scrollY = Math.max(0, tah.sy - dy);
        return;
      }
    }
    if (!tah) najetí(p, e);
  });
  function konecTahu(e) {
    ukazatele.delete(e.pointerId);
    if (!tah) return;
    const t = tah;
    if (t.druh === 'stisk') { if (ukazatele.size === 0) tah = null; return; }
    tah = null; cv.classList.remove('tah');
    if (e.type === 'pointercancel') return;
    if (t.druh === 'mer') {
      if (Math.abs(S.mereni.b - S.mereni.a) < (S.T1 - S.T0) / 400) S.mereni = null;
      prekresli(); vykresliPanel(); return;
    }
    if (t.druh === 'pan' && !t.posun) klik(lokal(e), t.h);
  }
  cv.addEventListener('pointerup', konecTahu);
  cv.addEventListener('pointercancel', konecTahu);
  cv.addEventListener('pointerleave', () => { if (!tah) { S.kurzor = null; skryjTip(); cv.classList.remove('nad'); prekresli(); } });
  cv.addEventListener('dblclick', e => {
    const p = lokal(e), h = hit(p.x, p.y);
    if (h && h.druh === 'pol') naPolozku(h.st, h.p);
    else if (h && h.druh === 'hlava') naStopu(h.st);
    else if (p.y > OSA_V && p.x > sirkaHlavy(W) && p.y < H - MINI_V) zoomKolem(uZX(p.x), e.shiftKey ? 0.5 : 2.5, true);
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const p = lokal(e);
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
    const dx = e.deltaX * k, dy = e.deltaY * k;
    if (e.shiftKey && !e.ctrlKey) { S.scrollY = Math.max(0, S.scrollY + (dy || dx)); prekresli(); return; }
    if (Math.abs(dx) > Math.abs(dy) && !e.ctrlKey) {
      const kk = (S.T1 - S.T0) / (W - sirkaHlavy(W));
      nastavPohled(S.T0 + dx * kk, S.T1 + dx * kk); return;
    }
    const u = p.x > sirkaHlavy(W) ? uZX(p.x) : (S.T0 + S.T1) / 2;
    zoomKolem(u, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), false);
  }, { passive: false });

  function posunMinimapou(h, px) {
    const u = h.m0 + (px - h.x0) / h.k, roz = S.T1 - S.T0;
    nastavPohled(u - roz / 2, u + roz / 2);
  }

  function najetí(p, e) {
    const L = sirkaHlavy(W);
    S.kurzor = p.x > L && p.y < H - MINI_V ? uZX(p.x) : null;
    const h = hit(p.x, p.y);
    cv.classList.toggle('nad', !!h && h.druh !== 'mini');
    cv.classList.toggle('mer', S.rezimMereni || e.shiftKey);
    if (h && h.druh === 'pol') ukazTip(p, h.st, h.p); else skryjTip();
    prekresli();
  }
  const tip = $('#tip');
  function ukazTip(p, st, q) {
    tip.innerHTML = `<b>${esc(q.nazev)}</b><span class="d">${esc(textIntervalu(q))}</span>` +
      (q.bod ? '' : `<br><span class="d">${esc(O.textTrvani(q.t1 - q.t0))}</span>`) + `<br><span class="d" style="color:${st.barva}">${esc(st.nazev)}</span>`;
    tip.style.display = 'block';
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(W - tw - 6, p.x + 14) + 'px';
    tip.style.top = (p.y + 18 + th > H ? p.y - th - 10 : p.y + 18) + 'px';
  }
  function skryjTip() { tip.style.display = 'none'; }

  function klik(p, h) {
    if (h && h.druh === 'pol') { vyber(h.st, h.p); return; }
    if (h && h.druh === 'hlava') { S.vybranaStopa = h.st.id; S.vybrana = null; prepniKartu('detail'); prekresli(); return; }
    if (p.y > OSA_V - 30 && p.x > sirkaHlavy(W) && p.y < H - MINI_V) {
      // klik do prázdna: připíchnout čas pro „Současně“ (druhý klik blízko = odepnout)
      const u = uZX(p.x);
      const blizko = S.pripnuto != null && Math.abs((S.pripnuto - u) / (S.T1 - S.T0)) * (W - sirkaHlavy(W)) < 6;
      S.pripnuto = blizko ? null : u;
      S.vybrana = null; S.vybranaStopa = null;
      if (S.pripnuto != null) prepniKartu('soucasne'); else vykresliPanel();
      prekresli();
    }
  }
  function vyber(st, p) {
    S.vybrana = { stopa: st.id, i: p.i }; S.vybranaStopa = null;
    prepniKartu('detail'); prekresli();
  }

  /* ---------- klávesnice ---------- */
  obal.addEventListener('keydown', e => {
    const roz = S.T1 - S.T0;
    let hotovo = true;
    switch (e.key) {
      case 'ArrowLeft': nastavPohled(S.T0 - roz * (e.shiftKey ? 0.5 : 0.1), S.T1 - roz * (e.shiftKey ? 0.5 : 0.1)); break;
      case 'ArrowRight': nastavPohled(S.T0 + roz * (e.shiftKey ? 0.5 : 0.1), S.T1 + roz * (e.shiftKey ? 0.5 : 0.1)); break;
      case 'ArrowUp': S.scrollY = Math.max(0, S.scrollY - 40); prekresli(); break;
      case 'ArrowDown': S.scrollY += 40; prekresli(); break;
      case '+': case '=': zoomKolem((S.T0 + S.T1) / 2, 1.6, true); break;
      case '-': case '_': zoomKolem((S.T0 + S.T1) / 2, 1 / 1.6, true); break;
      case 'Home': cele(); break;
      case 'Escape': S.mereni = null; S.pripnuto = null; S.vybrana = null; S.vybranaStopa = null; nastavMereni(false); vykresliPanel(); prekresli(); break;
      default:
        if (e.code === 'NumpadAdd') zoomKolem((S.T0 + S.T1) / 2, 1.6, true);
        else if (e.code === 'NumpadSubtract') zoomKolem((S.T0 + S.T1) / 2, 1 / 1.6, true);
        else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'z' || e.key === 'Z')) prepniZarovnani(!S.zarovnat);
        else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'm' || e.key === 'M')) nastavMereni(!S.rezimMereni);
        else hotovo = false;
    }
    if (hotovo) e.preventDefault();
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !$('#editor').open) { e.preventDefault(); $('#hledat').focus(); }
  });
  window.addEventListener('keyup', e => { if (e.key === 'Shift') cv.classList.toggle('mer', S.rezimMereni); });

  /* ---------- panel ---------- */
  const panel = $('#panel');
  document.querySelectorAll('.karty button').forEach(b => b.addEventListener('click', () => prepniKartu(b.dataset.karta)));
  function prepniKartu(k) {
    S.karta = k;
    document.querySelectorAll('.karty button').forEach(b => { b.classList.toggle('akt', b.dataset.karta === k); b.setAttribute('aria-selected', b.dataset.karta === k); });
    vykresliPanel();
  }
  function vykresliPanel() {
    if (S.karta === 'detail') panelDetail();
    else if (S.karta === 'soucasne') panelSoucasne();
    else if (S.karta === 'stopy') panelStopy();
    else panelSrovnani();
  }
  let casSoucasne = 0;
  function planujSoucasne() {
    if (S.karta !== 'soucasne' || S.pripnuto != null) return;
    clearTimeout(casSoucasne); casSoucasne = setTimeout(panelSoucasne, 120);
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const typText = { obdobi: 'Období', udalost: 'Událost', osoba: 'Osobnost' };

  function textIntervalu(p) {
    const a = O.textData(p.t0, p.presnostOd, S.rezim);
    if (p.bod) return (p.cca ? 'cca ' : '') + a;
    const b = p.dnes ? 'dosud' : O.textData(p.t1Zacatek, p.presnostDo, S.rezim);
    return (p.cca ? 'cca ' : '') + a + ' – ' + b;
  }
  function textPred(T) {
    const d = ted - T;
    if (Math.abs(d) < 1) return 'dnes';
    return d > 0 ? 'před ' + O.textTrvani(d).replace(/ let$/, ' lety').replace(/ roky$/, ' roky').replace(/ rok$/, ' rokem').replace(/ dní$/, ' dny').replace(/ den$/, ' dnem').replace(/ měsíců$/, ' měsíci').replace(/ měsíc$/, ' měsícem')
      : 'za ' + O.textTrvani(-d);
  }
  function jinyKalendar(T, presnost, kal) {
    if (presnost === 'rok' || presnost === 'mesic') return '';
    // po reformě má smysl jen u zemí, které ji přijaly pozdě (Rusko – kal 'g')
    if (T >= O.REFORMA && kal !== 'g' && S.rezim === 'smiseny') return '';
    const jul = O.textData(T, presnost, 'juliansky'), greg = O.textData(T, presnost, 'gregoriansky');
    if (jul === greg) return '';
    const akt = O.textData(T, presnost, S.rezim);
    return akt === jul ? 'gregoriánsky ' + greg : 'juliánsky ' + jul;
  }
  function wikiOdkaz(p) {
    const q = p.wiki || p.nazev;
    return 'https://cs.wikipedia.org/w/index.php?search=' + encodeURIComponent(q);
  }

  function panelDetail() {
    if (S.vybranaStopa) return panelStopa(priprav(S.vybranaStopa));
    const v = S.vybrana && priprav(S.vybrana.stopa);
    const p = v && v.pol.find(q => q.i === S.vybrana.i);
    if (!p) {
      panel.innerHTML = `<p class="prazdne">Klikněte na období, osobu nebo událost na ose. Klik do prázdna připíchne čas a v kartě <b>Současně</b> ukáže, co se v tu chvíli dělo ve všech zobrazených stopách.</p>
        <h3>Ovládání</h3>
        <ul class="klavesy">
          <li>tažení – posun (i svisle mezi stopami)</li>
          <li>kolečko / sevření prstů – zoom, <kbd>Shift</kbd>+kolečko – rolování stop</li>
          <li>dvojklik – přiblížit, na položce zaostřit</li>
          <li><kbd>Shift</kbd>+tažení nebo <b>📏 Měřit</b> – délka úseku</li>
          <li><kbd>←</kbd><kbd>→</kbd> posun, <kbd>+</kbd><kbd>−</kbd> zoom, <kbd>Home</kbd> celé, <kbd>Z</kbd> zarovnat, <kbd>M</kbd> měřit, <kbd>/</kbd> hledat, <kbd>Esc</kbd> zrušit</li>
        </ul>
        ${S.mereni ? panelMereniHtml() : ''}
        <h3>Jak číst osu</h3>
        <ul class="klavesy">
          <li>pruhy = období a vlády, zaoblené obrysy = život osobnosti</li>
          <li>vybledlé konce a „~“ = přibližné datum</li>
          <li>světlý pruh u kosočtverce = přesnost údaje (rok, měsíc)</li>
          <li>čárkovaná oranžová = dnešek</li>
        </ul>`;
      vazTlacitka();
      return;
    }
    const delka = p.bod ? '' : p.typ === 'osoba' ? vekText(p) : O.textTrvani(p.t1 - p.t0);
    const jk = jinyKalendar(p.t0, p.presnostOd, p.kal);
    const soubeh = S.viditelne.filter(id => id !== v.id).map(priprav).filter(Boolean).map(st => {
      const T = p.bod ? p.t0 : (p.t0 + p.t1) / 2;
      const b = st.obdobi.filter(q => q.t0 <= T && q.t1 > T && q.typ !== 'osoba');
      if (!b.length) return '';
      return `<div class="soubeh" style="--c:${st.barva}"><div class="jm"><span>${esc(st.nazev)}</span></div>${b.slice(0, 3).map(q => `<button class="odk" data-vyber="${st.id}:${q.i}">${esc(q.nazev)}</button>`).join(', ')}</div>`;
    }).join('');
    panel.innerHTML = `
      <h2>${esc(p.nazev)}</h2>
      <span class="stitek"><span class="tecka" style="background:${v.barva}"></span>${esc(v.nazev)}</span>
      <span class="stitek">${typText[p.typ] || 'Položka'}</span>${p.cca ? ' <span class="stitek">přibližné datum</span>' : ''}
      <dl class="fakta">
        <dt>${p.bod ? 'Datum' : p.typ === 'osoba' ? 'Život' : 'Trvání'}</dt><dd>${esc(textIntervalu(p))}</dd>
        ${jk ? `<dt></dt><dd class="prazdne" style="font-size:.8rem">${esc(jk)}</dd>` : ''}
        ${delka ? `<dt>${p.typ === 'osoba' ? 'Dožil(a) se' : 'Délka'}</dt><dd>${esc(delka)}</dd>` : ''}
        <dt>Od dneška</dt><dd>${esc(textPred(p.t0))}</dd>
        ${p.kal === 'g' ? '<dt></dt><dd class="prazdne" style="font-size:.8rem">datum uvedeno gregoriánsky</dd>' : ''}
      </dl>
      ${p.popis ? `<p>${esc(p.popis)}</p>` : ''}
      <div class="tlacitka">
        <button class="btn" data-akce="zaostrit">🔍 Přiblížit</button>
        <button class="btn" data-akce="soucasne">Co se dělo současně</button>
        ${S.zarovnat ? '<button class="btn" data-akce="kotva">⇤ Zarovnat stopu sem</button>' : ''}
        ${v.vlastni ? '<button class="btn" data-akce="upravit">✎ Upravit stopu</button>' : ''}
        <a class="btn" href="${wikiOdkaz(p)}" target="_blank" rel="noopener">Wikipedie ↗</a>
      </div>
      ${soubeh ? `<h3>Ve stejné době jinde</h3>${soubeh}` : ''}
      ${S.mereni ? panelMereniHtml() : ''}`;
    vazTlacitka({
      zaostrit: () => naPolozku(v, p),
      soucasne: () => { S.pripnuto = naOsu(v, p.bod ? p.t0 : p.t0); prepniKartu('soucasne'); prekresli(); },
      kotva: () => { S.kotvy[v.id] = p.t0; prekresli(); ulozStav(); vykresliPanel(); },
      upravit: () => otevriEditor(stopaPodleId(v.id)),
    });
  }
  function vekText(p) {
    if (p.presnostOd === 'den' && p.presnostDo === 'den' && !p.dnes) {
      const r = O.rozdilKalendarni(p.t0, p.t1Zacatek);
      return r.r + ' ' + O.sklon(r.r, 'rok', 'roky', 'let');
    }
    const r = Math.round(((p.dnes ? ted : p.t1Zacatek) - p.t0) / O.ROK);
    return (p.presnostOd === 'den' ? '' : 'asi ') + r + ' ' + O.sklon(r, 'rok', 'roky', 'let');
  }
  function panelMereniHtml() {
    const a = Math.min(S.mereni.a, S.mereni.b), b = Math.max(S.mereni.a, S.mereni.b);
    const pr = presnostZoomu();
    return `<h3>Měření</h3><dl class="fakta">
      <dt>Délka</dt><dd><b>${esc(O.textTrvani(b - a))}</b></dd>
      ${S.zarovnat ? '' : `<dt>Od</dt><dd>${esc(O.textData(a, pr, S.rezim))}</dd><dt>Do</dt><dd>${esc(O.textData(b, pr, S.rezim))}</dd>`}
      </dl><button class="btn" data-akce="zrusMereni">Zrušit měření</button>`;
  }
  function panelStopa(st) {
    if (!st) { S.vybranaStopa = null; return panelDetail(); }
    const idx = S.viditelne.indexOf(st.id);
    const obd = st.pol.filter(p => p.typ === 'obdobi').length, os = st.pol.filter(p => p.typ === 'osoba').length;
    panel.innerHTML = `
      <h2>${esc(st.nazev)}</h2>
      <span class="stitek"><span class="tecka" style="background:${st.barva}"></span>${esc(st.skupina || 'Vlastní')}</span>
      ${st.popis ? `<p>${esc(st.popis)}</p>` : ''}
      <dl class="fakta">
        <dt>Rozsah</dt><dd>${isFinite(st.min) ? esc(O.textDataKratce(st.min, 'rok', S.rezim) + ' – ' + O.textDataKratce(st.max - 1, 'rok', S.rezim)) : '—'}</dd>
        <dt>Délka</dt><dd>${isFinite(st.min) ? esc(O.textTrvani(st.max - st.min)) : '—'}</dd>
        <dt>Položky</dt><dd>${st.pol.length} (${obd} období, ${st.body.length} událostí, ${os} osob)</dd>
      </dl>
      ${st.chyby.length ? `<p style="color:var(--danger)">${st.chyby.length} položek má chybné datum a nezobrazují se.</p>` : ''}
      <div class="tlacitka">
        <button class="btn" data-akce="naStopu">🔍 Celá stopa</button>
        <button class="btn" data-akce="nahoru" ${idx <= 0 ? 'disabled' : ''}>▲</button>
        <button class="btn" data-akce="dolu" ${idx < 0 || idx >= S.viditelne.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="btn" data-akce="jen">Jen tato</button>
        <button class="btn" data-akce="skryt">Skrýt</button>
        ${S.zarovnat && S.kotvy[st.id] != null ? '<button class="btn" data-akce="kotvaZpet">⇤ Zarovnat na začátek</button>' : ''}
        ${st.vlastni ? '<button class="btn" data-akce="upravit">✎ Upravit</button>' : ''}
      </div>`;
    vazTlacitka({
      naStopu: () => naStopu(st),
      nahoru: () => { presun(st.id, -1); panelStopa(st); },
      dolu: () => { presun(st.id, 1); panelStopa(st); },
      jen: () => { S.viditelne = [st.id]; S.scrollY = 0; prekresli(); ulozStav(); },
      skryt: () => { S.viditelne = S.viditelne.filter(x => x !== st.id); S.vybranaStopa = null; prekresli(); ulozStav(); vykresliPanel(); },
      kotvaZpet: () => { delete S.kotvy[st.id]; prekresli(); ulozStav(); vykresliPanel(); },
      upravit: () => otevriEditor(stopaPodleId(st.id)),
    });
  }
  function presun(id, smer) {
    const i = S.viditelne.indexOf(id), j = i + smer;
    if (i < 0 || j < 0 || j >= S.viditelne.length) return;
    [S.viditelne[i], S.viditelne[j]] = [S.viditelne[j], S.viditelne[i]];
    prekresli(); ulozStav();
  }

  function panelSoucasne() {
    const u = S.pripnuto != null ? S.pripnuto : (S.T0 + S.T1) / 2;
    const stopy = S.viditelne.map(priprav).filter(Boolean);
    const okno = (S.T1 - S.T0) / 2;
    const pr = presnostZoomu();
    let hlava;
    if (S.zarovnat) hlava = `<div class="cas-hlava">${esc(O.textPosunu(u))} od začátku stop<small>Stopy jsou zarovnané – každá má vlastní nulu.</small></div>`;
    else {
      const jk = jinyKalendar(u, pr);
      hlava = `<div class="cas-hlava">${esc(O.textData(u, pr, S.rezim))}<small>${S.pripnuto != null ? 'připíchnutý čas · klikněte znovu nebo Esc pro uvolnění' : 'střed pohledu · klikem do osy čas připíchnete'}${jk ? ' · ' + esc(jk) : ''}</small></div>`;
    }
    const radky = stopy.map(st => {
      const T = zOsy(st, u);
      const s = O.soucasne(st, T, okno);
      const obd = s.bezi.filter(p => p.typ !== 'osoba'), os = s.bezi.filter(p => p.typ === 'osoba');
      const pol = [];
      for (const p of obd) pol.push(`<li><button class="odk" data-vyber="${st.id}:${p.i}">${esc(p.nazev)}</button> <span class="d">${esc(O.textTrvani(T - p.t0))} z ${esc(p.dnes ? 'dosud ' + O.textTrvani(p.t1 - p.t0) : O.textTrvani(p.t1 - p.t0))}</span></li>`);
      if (os.length) pol.push(`<li>${os.slice(0, 8).map(p => `<button class="odk" data-vyber="${st.id}:${p.i}">${esc(p.nazev)}</button> <span class="d">(${Math.max(0, Math.floor((T - p.t0) / O.ROK))})</span>`).join(', ')}${os.length > 8 ? ' …' : ''}</li>`);
      const ud = [];
      if (s.pred) ud.push(`<li>◂ <button class="odk" data-vyber="${st.id}:${s.pred.i}">${esc(s.pred.nazev)}</button> <span class="d">${esc(O.textTrvani(T - s.pred.t0))} předtím</span></li>`);
      if (s.po) ud.push(`<li>▸ <button class="odk" data-vyber="${st.id}:${s.po.i}">${esc(s.po.nazev)}</button> <span class="d">za ${esc(O.textTrvani(s.po.t0 - T))}</span></li>`);
      const prazdno = !pol.length && !ud.length;
      return `<div class="soubeh" style="--c:${st.barva}">
        <div class="jm"><span>${esc(st.nazev)}</span>${S.zarovnat ? `<span class="d">${esc(O.textData(T, 'rok', S.rezim))}</span>` : ''}</div>
        ${prazdno ? '<span class="d">nic zaznamenaného</span>' : `<ul>${pol.join('')}${ud.join('')}</ul>`}
      </div>`;
    }).join('');
    panel.innerHTML = hlava + '<h3>Ve zobrazených stopách</h3>' + (radky || '<p class="prazdne">Žádné zobrazené stopy.</p>') +
      (S.mereni ? panelMereniHtml() : '');
    vazTlacitka();
  }

  function panelStopy() {
    const skupiny = new Map();
    for (const s of vsechnyStopy()) {
      const k = vlastni.includes(s) ? 'Vlastní' : (s.skupina || 'Ostatní');
      if (!skupiny.has(k)) skupiny.set(k, []);
      skupiny.get(k).push(s);
    }
    const radek = (s, poradi) => {
      const st = priprav(s.id), zap = S.viditelne.includes(s.id);
      return `<div class="stopa-r">
        <label><input type="checkbox" data-stopa="${s.id}" ${zap ? 'checked' : ''}><span class="tecka" style="background:${st.barva}"></span><span class="n">${esc(s.nazev)}</span><span class="poc">${st.pol.length}</span></label>
        ${poradi ? `<button class="mini" data-nahoru="${s.id}" title="Výš" aria-label="Posunout výš">▲</button><button class="mini" data-dolu="${s.id}" title="Níž" aria-label="Posunout níž">▼</button>` : ''}
        <button class="mini" data-info="${s.id}" title="Podrobnosti stopy" aria-label="Podrobnosti">ⓘ</button>
        ${st.vlastni ? `<button class="mini" data-upravit="${s.id}" title="Upravit" aria-label="Upravit">✎</button>` : ''}
      </div>`;
    };
    panel.innerHTML = `
      <div class="tlacitka" style="margin-top:0"><button class="btn" data-akce="nic">Skrýt vše</button><button class="btn" data-akce="nova">+ Vlastní stopa</button></div>
      <h3>Zobrazené – pořadí</h3>
      <div class="poradi">${S.viditelne.map(id => stopaPodleId(id)).filter(Boolean).map(s => radek(s, true)).join('') || '<p class="prazdne">nic</p>'}</div>
      ${[...skupiny].map(([k, arr]) => `<div class="skupina-stop"><h3>${esc(k)}</h3>${arr.map(s => radek(s, false)).join('')}</div>`).join('')}`;
    panel.querySelectorAll('input[data-stopa]').forEach(ch => ch.addEventListener('change', () => {
      const id = ch.dataset.stopa;
      if (ch.checked) { if (!S.viditelne.includes(id)) S.viditelne.push(id); }
      else S.viditelne = S.viditelne.filter(x => x !== id);
      prekresli(); ulozStav(); panelStopy();
    }));
    panel.querySelectorAll('[data-nahoru]').forEach(b => b.addEventListener('click', () => { presun(b.dataset.nahoru, -1); panelStopy(); }));
    panel.querySelectorAll('[data-dolu]').forEach(b => b.addEventListener('click', () => { presun(b.dataset.dolu, 1); panelStopy(); }));
    panel.querySelectorAll('[data-info]').forEach(b => b.addEventListener('click', () => { S.vybranaStopa = b.dataset.info; prepniKartu('detail'); prekresli(); }));
    panel.querySelectorAll('[data-upravit]').forEach(b => b.addEventListener('click', () => otevriEditor(stopaPodleId(b.dataset.upravit))));
    vazTlacitka({ nic: () => { S.viditelne = []; prekresli(); ulozStav(); panelStopy(); }, nova: () => otevriEditor(null) });
  }

  function panelSrovnani() {
    panel.innerHTML = `<p class="prazdne" style="margin-top:0">Připravené pohledy: vybere stopy a přiblíží osu. Pak lze dál zoomovat, přidávat stopy nebo zapnout <b>⇤ Zarovnat</b>.</p>
      <div class="srovnani-seznam">${SROVNANI.map(s => `<button data-srovnani="${s.id}"><b>${esc(s.nazev)}</b><span>${esc(s.popis)}</span></button>`).join('')}</div>`;
    panel.querySelectorAll('[data-srovnani]').forEach(b => b.addEventListener('click', () => pouzijSrovnani(SROVNANI.find(s => s.id === b.dataset.srovnani))));
  }
  function pouzijSrovnani(s) {
    if (!s) return;
    if (S.zarovnat) prepniZarovnani(false);
    S.viditelne = s.stopy.filter(id => stopaPodleId(id));
    S.scrollY = 0; S.pripnuto = null; S.mereni = null; S.vybrana = null; S.vybranaStopa = null;
    const a = O.ctiDatum(s.od), b = O.ctiDatum(s.do);
    animujNa(a.T0, b.T1, 500);
    prekresli(); ulozStav();
  }

  function vazTlacitka(akce) {
    akce = Object.assign({ zrusMereni: () => { S.mereni = null; prekresli(); vykresliPanel(); } }, akce || {});
    panel.querySelectorAll('[data-akce]').forEach(b => { const f = akce[b.dataset.akce]; if (f) b.addEventListener('click', f); });
    panel.querySelectorAll('[data-vyber]').forEach(b => b.addEventListener('click', () => {
      const [sid, i] = b.dataset.vyber.split(':');
      const st = priprav(sid), p = st && st.pol.find(q => q.i === +i);
      if (p) { vyber(st, p); naPolozku(st, p); }
    }));
  }

  /* ---------- nástrojová lišta ---------- */
  $('#b-cele').addEventListener('click', () => cele());
  $('#b-dnes').addEventListener('click', () => {
    if (S.zarovnat) prepniZarovnani(false);
    const roz = Math.min(S.T1 - S.T0, 200 * O.ROK);
    animujNa(ted - roz * 0.8, ted + roz * 0.2);
  });
  $('#b-zarovnat').addEventListener('click', () => prepniZarovnani(!S.zarovnat));
  function nastavMereni(zap) {
    S.rezimMereni = zap;
    $('#b-merit').classList.toggle('zap', zap); $('#b-merit').setAttribute('aria-pressed', zap);
    cv.classList.toggle('mer', zap);
  }
  $('#b-merit').addEventListener('click', () => nastavMereni(!S.rezimMereni));
  $('#b-plus').addEventListener('click', () => zoomKolem((S.T0 + S.T1) / 2, 2, true));
  $('#b-minus').addEventListener('click', () => zoomKolem((S.T0 + S.T1) / 2, 0.5, true));
  const selKal = $('#kalendar');
  selKal.value = S.rezim;
  selKal.addEventListener('change', () => { S.rezim = selKal.value; prekresli(); vykresliPanel(); ulozStav(); });

  /* ---------- hledání ---------- */
  const inp = $('#hledat'), vys = $('#vysledky');
  let nalezy = [], aktNalez = 0;
  inp.addEventListener('input', () => ukazNalezy());
  inp.addEventListener('focus', () => { if (inp.value) ukazNalezy(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { aktNalez = Math.min(nalezy.length - 1, aktNalez + 1); oznac(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { aktNalez = Math.max(0, aktNalez - 1); oznac(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (nalezy[aktNalez]) jdiNa(nalezy[aktNalez]); e.preventDefault(); }
    else if (e.key === 'Escape') { vys.classList.remove('vid'); inp.blur(); obal.focus(); }
  });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.hledani')) vys.classList.remove('vid'); });
  function ukazNalezy() {
    const stopy = vsechnyStopy().map(s => priprav(s.id)).filter(Boolean);
    nalezy = O.hledej(stopy, inp.value, 40); aktNalez = 0;
    if (!inp.value.trim()) { vys.classList.remove('vid'); return; }
    vys.innerHTML = nalezy.length ? nalezy.map((n, i) => `<button role="option" data-i="${i}"><span class="bar" style="background:${n.stopa.barva}"></span>${esc(n.p.nazev)}<div class="d">${esc(textIntervalu(n.p))} · ${esc(n.stopa.nazev)}${S.viditelne.includes(n.stopa.id) ? '' : ' (skrytá stopa)'}</div></button>`).join('') : '<div class="nic">Nic nenalezeno.</div>';
    vys.classList.add('vid'); oznac();
    vys.querySelectorAll('button').forEach(b => b.addEventListener('click', () => jdiNa(nalezy[+b.dataset.i])));
  }
  function oznac() { vys.querySelectorAll('button').forEach((b, i) => b.classList.toggle('akt', i === aktNalez)); const a = vys.querySelector('.akt'); if (a) a.scrollIntoView({ block: 'nearest' }); }
  function jdiNa(n) {
    vys.classList.remove('vid');
    if (!S.viditelne.includes(n.stopa.id)) S.viditelne.push(n.stopa.id);
    if (S.zarovnat) prepniZarovnani(false);
    vyber(n.stopa, n.p); naPolozku(n.stopa, n.p); ulozStav();
  }

  /* ---------- editor vlastních stop ---------- */
  const dlg = $('#editor'), tb = $('#ed-radky');
  let upravovana = null;
  function otevriEditor(st) {
    upravovana = st;
    $('#ed-nazev').value = st ? st.nazev : '';
    $('#ed-barva').value = st && /^#[0-9a-f]{6}$/i.test(st.barva || '') ? st.barva : PALETA[vlastni.length % PALETA.length];
    $('#ed-popis').value = st ? st.popis || '' : '';
    tb.innerHTML = '';
    (st ? st.polozky : [{}, {}, {}]).forEach(p => pridejRadek(p));
    $('#ed-smazat').style.display = st ? '' : 'none';
    dlg.showModal();
    $('#ed-nazev').focus();
  }
  function pridejRadek(p) {
    p = p || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="e-od" value="${esc(datumProEditor(p.od))}" placeholder="např. 1348"><div class="vyklad"></div></td>
      <td><input type="text" class="e-do" value="${esc(p.do === 'dnes' ? 'dnes' : datumProEditor(p.do))}" placeholder="(událost)"><div class="vyklad"></div></td>
      <td><input type="text" class="e-nazev" value="${esc(p.nazev || '')}" maxlength="80"></td>
      <td><select class="e-typ"><option value="">auto</option><option value="obdobi">období</option><option value="udalost">událost</option><option value="osoba">osoba</option></select></td>
      <td style="text-align:center"><input type="checkbox" class="e-cca" ${p.cca ? 'checked' : ''} aria-label="přibližné"></td>
      <td><input type="text" class="e-popis" value="${esc(p.popis || '')}"></td>
      <td><button type="button" class="btn ikona e-x" title="Odebrat řádek" aria-label="Odebrat řádek">✕</button></td>`;
    tr.querySelector('.e-typ').value = p.typ || '';
    tr.querySelector('.e-x').addEventListener('click', () => tr.remove());
    for (const k of ['.e-od', '.e-do']) {
      const i = tr.querySelector(k), v = i.nextElementSibling;
      const ob = () => {
        const t = i.value.trim();
        if (!t) { v.textContent = ''; v.classList.remove('chyba'); return; }
        if (k === '.e-do' && /^(dnes|trvá|trva)$/i.test(t)) { v.textContent = 'dosud'; v.classList.remove('chyba'); return; }
        const d = O.ctiVolne(t);
        v.textContent = d ? O.textData(d.T0, d.presnost, 'smiseny') : 'nečitelné datum';
        v.classList.toggle('chyba', !d);
      };
      i.addEventListener('input', ob); ob();
    }
    tb.appendChild(tr);
  }
  function datumProEditor(z) {
    if (!z) return '';
    const d = O.ctiDatum(z);
    if (!d) return z;
    return O.textDataKratce(d.T0, d.presnost, 'smiseny').replace(/ (\d+:\d\d)$/, ' $1');
  }
  $('#ed-pridat').addEventListener('click', () => { pridejRadek({}); tb.lastElementChild.querySelector('.e-od').focus(); });
  $('#ed-zrusit').addEventListener('click', () => dlg.close());
  $('#ed-smazat').addEventListener('click', async () => {
    if (!upravovana || !(await Dialog.potvrd(`Smazat stopu „${upravovana.nazev}“ se všemi položkami?`))) return;
    vlastni = vlastni.filter(s => s !== upravovana);
    S.viditelne = S.viditelne.filter(id => id !== upravovana.id);
    zneplatni(upravovana.id); ulozVlastni(); dlg.close(); S.vybranaStopa = null; S.vybrana = null;
    prekresli(); ulozStav(); vykresliPanel();
  });
  $('#ed-form').addEventListener('submit', e => {
    e.preventDefault();
    const nazev = $('#ed-nazev').value.trim();
    if (!nazev) { $('#ed-nazev').focus(); return; }
    const polozky = [], chyby = [];
    [...tb.children].forEach((tr, n) => {
      const g = c => tr.querySelector(c).value.trim();
      if (!g('.e-od') && !g('.e-nazev')) return;
      const od = O.ctiVolne(g('.e-od'));
      if (!od) { chyby.push(`řádek ${n + 1}: nečitelné „Od“`); return; }
      const p = { od: od.zapis, nazev: g('.e-nazev') || '(bez názvu)' };
      if (g('.e-do')) {
        if (/^(dnes|trvá|trva)$/i.test(g('.e-do'))) p.do = 'dnes';
        else {
          const d = O.ctiVolne(g('.e-do'));
          if (!d) { chyby.push(`řádek ${n + 1}: nečitelné „Do“`); return; }
          if (d.T1 <= od.T0) { chyby.push(`řádek ${n + 1}: konec je před začátkem`); return; }
          p.do = d.zapis;
        }
      }
      if (g('.e-typ')) p.typ = g('.e-typ');
      if (tr.querySelector('.e-cca').checked || od.cca) p.cca = true;
      if (g('.e-popis')) p.popis = g('.e-popis');
      polozky.push(p);
    });
    if (chyby.length) { Dialog.chyba(chyby.slice(0, 5).join('\n')); return; }
    const stopa = upravovana || { id: unikatniId('v_' + O.slug(nazev)), skupina: 'Vlastní' };
    stopa.nazev = nazev; stopa.barva = $('#ed-barva').value; stopa.popis = $('#ed-popis').value.trim(); stopa.polozky = polozky;
    if (!upravovana) vlastni.push(stopa);
    if (!S.viditelne.includes(stopa.id)) S.viditelne.push(stopa.id);
    zneplatni(stopa.id); ulozVlastni(); dlg.close();
    const st = priprav(stopa.id);
    S.vybranaStopa = stopa.id; S.vybrana = null; prepniKartu('detail');
    if (st.pol.length && (st.max < S.T0 || st.min > S.T1) && !S.zarovnat) naStopu(st);
    prekresli(); ulozStav();
    Dialog.info(`Stopa „${nazev}“ uložena (${polozky.length} položek).`);
  });
  function unikatniId(z) { let id = z, n = 2; while (stopaPodleId(id)) id = z + '_' + n++; return id; }
  $('#b-nova').addEventListener('click', () => otevriEditor(null));

  /* ---------- import / export ---------- */
  $('#b-import').addEventListener('click', () => $('#soubor').click());
  $('#soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let text;
    try { text = await f.text(); } catch (_) { Dialog.chyba('Soubor nejde přečíst.'); return; }
    importuj(text, f.name);
  });
  function importuj(text, jmeno) {
    let stopy = [], chyby = [];
    if (/\.csv$/i.test(jmeno || '') || !/^\s*[[{]/.test(text)) {
      const r = O.zCSV(text); stopy = r.stopy; chyby = r.chyby;
    } else {
      try {
        const j = JSON.parse(text);
        stopy = Array.isArray(j) ? j : Array.isArray(j.stopy) ? j.stopy : [j];
      } catch (_) { Dialog.chyba('Soubor není platný JSON.'); return 0; }
      stopy = stopy.filter(s => { const ch = O.overStopu(s); if (ch.length) chyby.push(`${(s && s.nazev) || 'stopa'}: ${ch.slice(0, 3).join(', ')}`); return !ch.length; });
    }
    let n = 0;
    for (const s of stopy) {
      const kopie = { id: unikatniId(stopaPodleId(s.id) ? 'v_' + O.slug(s.id) : s.id), nazev: String(s.nazev).slice(0, 80), skupina: 'Vlastní', barva: /^#[0-9a-f]{6}$/i.test(s.barva || '') ? s.barva : PALETA[(vlastni.length) % PALETA.length], popis: s.popis || '', polozky: s.polozky };
      vlastni.push(kopie);
      if (!S.viditelne.includes(kopie.id)) S.viditelne.push(kopie.id);
      n++;
    }
    if (n) { ulozVlastni(); prekresli(); ulozStav(); vykresliPanel(); cele(); }
    if (chyby.length) Dialog.chyba(`Načteno ${n} stop. Problémy:\n` + chyby.slice(0, 6).join('\n') + (chyby.length > 6 ? `\n… a dalších ${chyby.length - 6}` : ''));
    else Dialog.info(`Načteno ${n} ${O.sklon(n, 'stopa', 'stopy', 'stop')}.`);
    return n;
  }
  $('#export').addEventListener('change', e => {
    const v = e.target.value; e.target.value = '';
    if (v === 'png') exportPNG();
    else if (v === 'json') {
      const data = vlastni.length ? vlastni : S.viditelne.map(stopaPodleId).filter(Boolean);
      stahni(new Blob([JSON.stringify({ format: 'casova-osa', verze: 1, stopy: data }, null, 1)], { type: 'application/json' }), 'casova_osa.json');
      if (!vlastni.length) Dialog.info('Nemáte vlastní stopy – exportovány zobrazené stopy jako vzor.');
    } else if (v === 'csv') {
      stahni(new Blob(['﻿' + O.doCSV(S.viditelne.map(stopaPodleId).filter(Boolean))], { type: 'text/csv' }), 'casova_osa.csv');
    } else if (v === 'odkaz') {
      const url = location.href.split('#')[0] + O.doHashe({ T0: S.T0, T1: S.T1, stopy: S.viditelne, rezim: S.rezim, zarovnat: S.zarovnat });
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => Dialog.info('Odkaz na pohled zkopírován.'), () => Dialog.zeptej('Odkaz na tento pohled:', url));
    }
  });
  function stahni(blob, jmeno) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function exportPNG() {
    const stopy = S.viditelne.map(priprav).filter(Boolean);
    const Wc = Math.max(1200, W), hor = 34;
    const Hc = Math.min(8000, OSA_V + hor + stopy.reduce((s, st) => s + vyskaStopy(st), 0) + 26);
    const k = 2, c2 = document.createElement('canvas');
    c2.width = Wc * k; c2.height = Hc * k;
    const c = c2.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0);
    const puvodni = { kurzor: S.kurzor };
    S.kurzor = null;
    c.save(); c.translate(0, hor);
    kresli(c, Wc, Hc - hor, { scrollY: 0, mini: false });
    c.restore();
    S.kurzor = puvodni.kurzor;
    c.fillStyle = B.panel; c.fillRect(0, 0, Wc, hor);
    c.fillStyle = B.text; c.font = '600 15px ' + B.font;
    const rozsah = S.zarovnat ? 'zarovnané stopy' : O.textData(S.T0, presnostZoomu(), S.rezim) + ' – ' + O.textData(S.T1, presnostZoomu(), S.rezim);
    c.fillText('Historická časová osa · ' + rozsah, 10, 22);
    c.fillStyle = B.faint; c.font = '11px ' + B.font;
    c.fillText('lavionus.github.io/site', Wc - 140, Hc - 8);
    c2.toBlob(b => b && stahni(b, 'casova_osa.png'), 'image/png');
  }

  /* ---------- start ---------- */
  nactiBarvy();
  new MutationObserver(() => { nactiBarvy(); prekresli(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.ResizeObserver) new ResizeObserver(velikost).observe(obal); else window.addEventListener('resize', velikost);
  window.matchMedia && matchMedia('(resolution: 1dppx)').addEventListener && window.addEventListener('resize', velikost);
  $('#b-zarovnat').classList.toggle('zap', S.zarovnat);
  $('#b-zarovnat').setAttribute('aria-pressed', S.zarovnat);
  velikost();
  vykresliPanel();
  window.addEventListener('hashchange', () => {
    const h = O.zHashe(location.hash);
    if (h.stopy) S.viditelne = h.stopy.filter(id => stopaPodleId(id));
    if (h.T0 != null) nastavPohled(h.T0, h.T1);
    prekresli();
  });

  // pro testy
  window.__osa = { S, priprav, nastavPohled, cele, vyber, prepniZarovnani, pouzijSrovnani, importuj, hity: () => hity, prepniKartu, kresliVse, otevriEditor, vlastni: () => vlastni, uZX, sirkaHlavy: () => sirkaHlavy(W), naPolozku };
})();
