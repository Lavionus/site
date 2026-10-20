/* dalekohled/telesa.js – vykreslení disku Měsíce a planet po pixelech:
   ortografická projekce zploštělého tělesa s texturou (Solar System Scope, CC BY 4.0),
   osvětlení ze směru Slunce (fáze, terminátor), Saturnovy prstence se stíny,
   Galileovy měsíce s přechody stínů. Výstup je plátno v orientaci „pouhým okem“
   (sever nahoře, západ vpravo); natočení do okuláru řeší okular.js. */
(function (koren) {
  'use strict';
  const D = koren.DALEK;
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const textury = {};          // klic → {w, h, data} | 'chyba' | Promise

  function nactiTexturu(klic, cesta) {
    if (textury[klic]) return textury[klic] instanceof Promise ? textury[klic] : Promise.resolve(textury[klic]);
    const p = new Promise(res => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(img, 0, 0);
          const d = x.getImageData(0, 0, c.width, c.height);
          textury[klic] = { w: c.width, h: c.height, data: d.data };
        } catch (e) { textury[klic] = 'chyba'; }        // file:// – plátno je „znečištěné“, kreslí se bez textury
        res(textury[klic]);
      };
      img.onerror = () => { textury[klic] = 'chyba'; res('chyba'); };
      img.src = cesta;
    });
    textury[klic] = p;
    return p;
  }
  const textura = klic => (textury[klic] && !(textury[klic] instanceof Promise) && textury[klic] !== 'chyba') ? textury[klic] : null;

  // bilineární vzorek textury, výsledek do pole o
  function vzorek(t, u, v, o) {
    const x = u * t.w - 0.5, y = Math.max(0, Math.min(t.h - 1.001, v * t.h - 0.5));
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const xa = ((x0 % t.w) + t.w) % t.w, xb = (xa + 1) % t.w;
    const i00 = (y0 * t.w + xa) * 4, i10 = (y0 * t.w + xb) * 4, i01 = ((y0 + 1) * t.w + xa) * 4, i11 = ((y0 + 1) * t.w + xb) * 4;
    const d = t.data;
    for (let k = 0; k < 3; k++) {
      const a = d[i00 + k] + (d[i10 + k] - d[i00 + k]) * fx;
      const b = d[i01 + k] + (d[i11 + k] - d[i01 + k]) * fx;
      o[k] = a + (b - a) * fy;
    }
  }

  // radiální profil Saturnových prstenců (r v rovníkových poloměrech): [jas, neprůhlednost]
  function prstenec(r) {
    if (r < 1.239 || r > 2.27) return null;
    if (r < 1.527) return [0.22, 0.12];                          // C (krepový)
    if (r < 1.951) { const s = (r - 1.527) / 0.424; return [0.78 + 0.2 * Math.sin(s * Math.PI), 0.92]; }   // B
    if (r < 2.025) return [0.08, 0.08];                          // Cassiniho dělení
    if (r > 2.209 && r < 2.219) return [0.1, 0.1];               // Enckeho mezera
    return [0.62, 0.62];                                          // A
  }

  // průsečík paprsku P = A + t·B se zploštělým elipsoidem (osy 1,1,f) – vrací největší t nebo null
  function prusecik(A, B, f) {
    const if2 = 1 / (f * f);
    const a = B[0] * B[0] + B[1] * B[1] + B[2] * B[2] * if2;
    const b = 2 * (A[0] * B[0] + A[1] * B[1] + A[2] * B[2] * if2);
    const c = A[0] * A[0] + A[1] * A[1] + A[2] * A[2] * if2 - 1;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    return (-b + Math.sqrt(disc)) / (2 * a);
  }

  /* Vykreslí těleso t (z DALEK.teleso) na plátno; rPx = rovníkový poloměr v pixelech.
     Vrací {canvas, rPx (skutečně použitý), stred} */
  function vykresli(t, rPx, maxStrana = 1400) {
    const tel = D.TELESA[t.klic];
    const rozsah = tel.prstence ? 2.3 : 1.02;
    let S = Math.ceil(2 * rozsah * rPx) + 4;
    if (S > maxStrana) { rPx *= maxStrana / S; S = maxStrana; }
    S = Math.max(S, 6);
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S);
    const px = img.data;
    const b = D.baze(t.v);
    const M = t.rot.M;
    const Xb = D.mxv(M, b.x), Yb = D.mxv(M, b.y), Zb = D.mxv(M, b.z);
    const sb = D.mxv(M, t.kSlunci);
    const f = t.zplosteni;
    const tx = tel.tex ? textura(tel.tex) : null;
    const posun = tel.texPosun !== undefined ? tel.texPosun : 180;
    const barva = tel.barva || [200, 190, 170];
    const mesic = t.klic === 'mesic' || t.klic === 'merkur';
    const k = { mesic: 0, merkur: 0, venuse: 0.72, mars: 0.85, jupiter: 0.88, saturn: 0.9, uran: 0.8, neptun: 0.8 }[t.klic];
    const popelave = t.klic === 'mesic' ? 0.018 * (1 - t.k) : 0;
    const c = [0, 0, 0];
    const pod = tel.prstence ? 3 : 1;          // svislé podvzorky – tenké prstence při malém sklonu
    const stred = S / 2;
    const A = [0, 0, 0], P = [0, 0, 0];

    // je bod P (soustava tělesa) ve stínu prstenců? vrací neprůhlednost
    const stinPrstencu = (p) => {
      if (!tel.prstence || Math.abs(sb[2]) < 1e-4) return 0;
      const tt = -p[2] / sb[2];
      if (tt <= 0) return 0;
      const r = Math.hypot(p[0] + sb[0] * tt, p[1] + sb[1] * tt);
      const pr = prstenec(r);
      return pr ? pr[1] : 0;
    };

    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        let R = 0, G = 0, Bc = 0, Al = 0;
        for (let s = 0; s < pod; s++) {
          const x = (i + 0.5 - stred) / rPx, y = (stred - j - (s + 0.5) / pod) / rPx;
          if (!tel.prstence && x * x + y * y > 1.0005) continue;
          A[0] = x * Xb[0] + y * Yb[0]; A[1] = x * Xb[1] + y * Yb[1]; A[2] = x * Xb[2] + y * Yb[2];
          const tg = prusecik(A, Zb, f);
          let r = 0, g = 0, bb = 0, a = 0;
          if (tg !== null) {
            P[0] = A[0] + tg * Zb[0]; P[1] = A[1] + tg * Zb[1]; P[2] = A[2] + tg * Zb[2];
            // normála elipsoidu
            let nx = P[0], ny = P[1], nz = P[2] / (f * f);
            const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
            const mu0 = nx * sb[0] + ny * sb[1] + nz * sb[2];
            const mu = Math.max(0.02, nx * Zb[0] + ny * Zb[1] + nz * Zb[2]);
            let I;
            if (mesic) I = mu0 > 0 ? 1.7 * mu0 / (mu0 + mu) + 0.15 * mu0 : 0;
            else I = mu0 > 0 ? Math.pow(mu0, k) * Math.pow(mu, k - 1) : 0;
            // měkký terminátor
            if (mu0 > -0.02 && mu0 < 0.03) I *= (mu0 + 0.02) / 0.05;
            I = Math.max(0, I);
            if (I > 0) I *= 1 - 0.85 * stinPrstencu(P);
            if (tx) {
              const lon = Math.atan2(P[1], P[0]) * DEG;
              const lat = Math.asin(Math.max(-1, Math.min(1, P[2] / Math.hypot(P[0], P[1], P[2])))) * DEG;
              let u = (lon + posun) / 360; u -= Math.floor(u);
              vzorek(tx, u, (90 - lat) / 180, c);
            } else { c[0] = barva[0]; c[1] = barva[1]; c[2] = barva[2]; }
            const Ie = I + popelave;
            r = c[0] * Ie; g = c[1] * Ie; bb = c[2] * Ie; a = 1;
          }
          if (tel.prstence && Math.abs(Zb[2]) > 1e-6) {
            const tr = -A[2] / Zb[2];
            if (tg === null || tr > tg) {
              const rx = A[0] + tr * Zb[0], ry = A[1] + tr * Zb[1];
              const pr = prstenec(Math.hypot(rx, ry));
              if (pr) {
                // stín koule na prstencích
                const Q = [rx, ry, 0];
                const vStinu = prusecik(Q, sb, f) !== null && (() => {
                  // průsečík musí ležet ve směru ke Slunci
                  const if2 = 1 / (f * f);
                  const aa = sb[0] * sb[0] + sb[1] * sb[1] + sb[2] * sb[2] * if2;
                  const b2 = 2 * (Q[0] * sb[0] + Q[1] * sb[1]);
                  return -b2 / (2 * aa) > 0;
                })();
                const zezadu = (sb[2] > 0) !== (Zb[2] > 0);            // díváme se na neosvětlenou stranu
                let I = pr[0] * Math.min(1, 0.35 + 3 * Math.abs(sb[2])) * (zezadu ? 0.35 : 1);
                if (vStinu) I *= 0.05;
                const al = pr[1];
                r = r * (1 - al) + 214 * I * al; g = g * (1 - al) + 200 * I * al; bb = bb * (1 - al) + 168 * I * al;
                a = a + (1 - a) * al;
              }
            }
          }
          R += r; G += g; Bc += bb; Al += a;
        }
        if (Al > 0) {
          const o = (j * S + i) * 4;
          px[o] = Math.min(255, R / Al); px[o + 1] = Math.min(255, G / Al); px[o + 2] = Math.min(255, Bc / Al);
          px[o + 3] = Math.min(255, Al / pod * 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: cv, rPx, stred };
  }

  const mesiceJupiteru = t => D.mesiceJupiteru(t);

  const API = { nactiTexturu, textura, vykresli, mesiceJupiteru, prstenec, prusecik };
  koren.DALEK_TELESA = API;
})(typeof window !== 'undefined' ? window : globalThis);
