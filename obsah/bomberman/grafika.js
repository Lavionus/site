/* Bomberman – pixelartová grafika kreslená kódem (žádné obrázky).
   Vše se kreslí do malého bufferu 240×224 (16 px na políčko + 16 px lišta)
   a ten se pak celočíselně zvětší na plátno. */
var BOMB = globalThis.BOMB || (globalThis.BOMB = {});
(function (B) {
'use strict';

const T = 16, LISTA = 16;
const SW = B.W * T, SH = B.H * T + LISTA;

function platno(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const cache = new Map();
function sprite(klic, w, h, kresli) {
  let c = cache.get(klic);
  if (!c) { c = platno(w, h); const g = c.getContext('2d'); kresli(g); cache.set(klic, c); }
  return c;
}
function px(g, x, y, w, h, barva) { g.fillStyle = barva; g.fillRect(x, y, w, h); }
/* vyplněná elipsa po pixelech (ostré hrany) */
function elipsa(g, cx, cy, rx, ry, barva) {
  g.fillStyle = barva;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
    }
}

/* ---------- dlaždice ---------- */
const BARVY_POD = { trava: '#3d8a35', trava2: '#378030', stin: '#2b6527' };
function podlaha() {
  return sprite('podlaha', T, T, g => {
    px(g, 0, 0, T, T, BARVY_POD.trava);
    // jemná textura trávy
    const body = [[2, 3], [9, 2], [13, 6], [5, 9], [11, 12], [3, 13], [7, 6], [14, 14]];
    for (const [x, y] of body) px(g, x, y, 1, 2, BARVY_POD.trava2);
    px(g, 0, 0, T, 1, '#43943b');
  });
}
function zed(okraj) {
  return sprite('zed' + (okraj ? 'O' : ''), T, T, g => {
    const z = okraj ? '#6f6f7c' : '#9c9cab', sv = okraj ? '#a5a5b3' : '#dcdce6', tm = okraj ? '#41414c' : '#5c5c6a';
    px(g, 0, 0, T, T, z);
    px(g, 0, 0, T, 2, sv); px(g, 0, 0, 2, T, sv);
    px(g, 0, T - 2, T, 2, tm); px(g, T - 2, 0, 2, T, tm);
    px(g, 4, 4, 8, 8, okraj ? '#787886' : '#a8a8b8');
    px(g, 4, 4, 8, 1, tm); px(g, 4, 4, 1, 8, tm);
    px(g, 5, 11, 7, 1, sv); px(g, 11, 5, 1, 7, sv);
  });
}
function bedna() {
  return sprite('bedna', T, T, g => {
    px(g, 0, 0, T, T, '#7a4a22');
    px(g, 1, 1, 14, 14, '#c58945');
    for (const y of [5, 10]) px(g, 1, y, 14, 1, '#93602d');      // prkna
    px(g, 1, 1, 14, 1, '#e6b070'); px(g, 1, 1, 1, 14, '#e6b070');
    px(g, 1, 14, 14, 1, '#7a4a22');
    // úhlopříčná vzpěra
    for (let i = 0; i < 12; i++) { px(g, 2 + i, 13 - i, 2, 1, '#9b6630'); }
    px(g, 2, 2, 1, 1, '#5a3418'); px(g, 13, 2, 1, 1, '#5a3418'); px(g, 2, 13, 1, 1, '#5a3418'); px(g, 13, 13, 1, 1, '#5a3418');
  });
}

/* ---------- předměty ---------- */
const IKONY = {
  bomba(g) { elipsa(g, 8, 9, 4, 4, '#111'); px(g, 6, 7, 2, 1, '#777'); px(g, 9, 3, 1, 3, '#a87a3a'); px(g, 10, 2, 1, 1, '#ffd23a'); },
  plamen(g) {
    elipsa(g, 8, 10, 4, 3.6, '#e03a10'); px(g, 6, 4, 2, 4, '#e03a10'); px(g, 9, 3, 2, 5, '#e03a10');
    elipsa(g, 8, 10.5, 2.6, 2.4, '#ffa418'); px(g, 8, 6, 2, 3, '#ffa418'); elipsa(g, 8, 11, 1.4, 1.4, '#fff3b0');
  },
  rychlost(g) {   // kolečková brusle
    px(g, 5, 3, 3, 6, '#2f7de0'); px(g, 5, 8, 7, 3, '#2f7de0'); px(g, 6, 4, 1, 4, '#8fc4ff');
    px(g, 5, 11, 8, 1, '#555'); px(g, 5, 12, 2, 2, '#ddd'); px(g, 10, 12, 2, 2, '#ddd');
  },
  kopani(g) {     // bota
    px(g, 5, 3, 4, 7, '#7a3cc8'); px(g, 5, 9, 8, 3, '#7a3cc8'); px(g, 6, 4, 1, 5, '#c39af0');
    px(g, 4, 12, 9, 1, '#2a1048'); px(g, 11, 9, 2, 1, '#c39af0');
  },
  dalkova(g) {    // rozbuška
    px(g, 3, 7, 10, 6, '#555'); px(g, 3, 7, 10, 1, '#888'); px(g, 7, 3, 2, 4, '#999'); px(g, 5, 2, 6, 2, '#c22');
    px(g, 5, 9, 2, 2, '#e33'); px(g, 9, 9, 2, 2, '#3c3');
  },
};
function predmet(typ, blik) {
  return sprite('pr' + typ + blik, T, T, g => {
    px(g, 1, 1, 14, 14, blik ? '#f6c040' : '#e07a20');
    px(g, 2, 2, 12, 12, '#2b2b40');
    px(g, 1, 1, 14, 1, '#ffe09a'); px(g, 1, 1, 1, 14, '#ffe09a');
    px(g, 1, 14, 14, 1, '#8a3a08'); px(g, 14, 1, 1, 14, '#8a3a08');
    g.save(); g.translate(0, 0); IKONY[typ](g); g.restore();
  });
}
function dvere(otevrene) {
  return sprite('dvere' + otevrene, T, T, g => {
    px(g, 0, 0, T, T, '#6e6e7a');
    px(g, 1, 1, 14, 14, '#8d8d99');
    px(g, 3, 3, 10, 12, otevrene ? '#111' : '#7a4a1e');
    px(g, 4, 2, 8, 1, otevrene ? '#111' : '#7a4a1e');
    if (otevrene) { px(g, 5, 5, 6, 10, '#2a2a6a'); px(g, 6, 7, 4, 8, '#4a4ad0'); px(g, 7, 9, 2, 6, '#9a9aff'); }
    else { px(g, 7, 3, 1, 12, '#5a3414'); px(g, 10, 9, 1, 2, '#ffd23a'); }
    px(g, 1, 1, 14, 1, '#b4b4c0');
  });
}

/* ---------- bomba ---------- */
function bomba(faze, dalkova) {
  return sprite('bomba' + faze + dalkova, T, T, g => {
    const r = faze ? 6 : 5.4;
    elipsa(g, 8, 9.5, r, r, '#101018');
    elipsa(g, 6, 7.5, 1.8, 1.4, '#5a5a70');
    px(g, 5, 7, 1, 1, '#c8c8d8');
    px(g, 8, 2, 2, 2, '#b08040'); px(g, 10, 1, 1, 2, '#b08040');
    px(g, 11, 0, 2, 2, faze ? '#ffe040' : '#ff6020');
    if (dalkova) { px(g, 6, 9, 5, 1, '#e02828'); px(g, 8, 8, 1, 3, '#e02828'); }
  });
}

/* ---------- hráči ---------- */
const OBLEKY = {
  bila:    { helma: '#f4f4f4', helmaT: '#b8b8c8', oblek: '#3a6ee0', pas: '#1e3c8a', boty: '#e0507a' },
  cerna:   { helma: '#4a4a52', helmaT: '#2a2a30', oblek: '#d8d8d8', pas: '#808080', boty: '#2a2a30' },
  cervena: { helma: '#f05050', helmaT: '#a02828', oblek: '#f4f4f4', pas: '#a02828', boty: '#7a1a1a' },
  modra:   { helma: '#4a8af0', helmaT: '#2050a8', oblek: '#ffd84a', pas: '#b08a10', boty: '#2050a8' },
};
const KUZE = '#f8c8a0';
function hrac(barva, smer, faze) {
  return sprite('h' + barva + smer + faze, T, T + 4, g => {
    const O = OBLEKY[barva] || OBLEKY.bila;
    const zrcadlo = smer === 3;
    if (zrcadlo) { g.translate(T, 0); g.scale(-1, 1); }
    const bok = smer === 1 || smer === 3;
    const krok = faze === 1 ? 1 : faze === 2 ? -1 : 0;
    // nohy
    if (bok) {
      px(g, 6 + krok, 16, 3, 3, O.boty); px(g, 8 - krok, 16, 3, 3, O.boty);
    } else {
      px(g, 4, 16 + (krok > 0 ? 0 : 1), 3, krok > 0 ? 3 : 2, O.boty);
      px(g, 9, 16 + (krok < 0 ? 0 : 1), 3, krok < 0 ? 3 : 2, O.boty);
    }
    // tělo
    px(g, 4, 11, 8, 5, O.oblek); px(g, 4, 14, 8, 1, O.pas);
    px(g, 5, 11, 1, 3, 'rgba(255,255,255,0.35)');
    // ruce
    if (bok) px(g, 7 - krok, 12, 3, 3, KUZE);
    else { px(g, 2, 12 + (krok > 0 ? -1 : 0), 2, 3, KUZE); px(g, 12, 12 + (krok < 0 ? -1 : 0), 2, 3, KUZE); }
    // hlava (helma)
    elipsa(g, 8, 6.5, 6, 5, O.helmaT);
    elipsa(g, 8, 6.2, 5.5, 4.6, O.helma);
    px(g, 7, 0, 2, 2, '#ff6aa0'); px(g, 7, 2, 2, 1, O.helmaT);    // anténka
    if (smer === 2) {          // dolů – obličej
      px(g, 4, 5, 8, 4, KUZE); px(g, 5, 4, 6, 1, KUZE); px(g, 5, 9, 6, 1, KUZE);
      px(g, 6, 5, 1, 3, '#111'); px(g, 9, 5, 1, 3, '#111');
    } else if (bok) {
      px(g, 8, 5, 5, 4, KUZE); px(g, 9, 4, 3, 1, KUZE); px(g, 9, 9, 3, 1, KUZE);
      px(g, 11, 5, 1, 3, '#111');
    } else {                   // nahoru – záda helmy
      px(g, 6, 9, 4, 1, O.helmaT);
    }
    px(g, 4, 3, 2, 1, 'rgba(255,255,255,0.6)');
  });
}

/* ---------- nepřátelé ---------- */
function oci(g, x1, x2, y, zornice) {
  px(g, x1, y, 2, 3, '#fff'); px(g, x2, y, 2, 3, '#fff');
  px(g, x1 + (zornice || 1), y + 1, 1, 2, '#111'); px(g, x2 + (zornice || 1), y + 1, 1, 2, '#111');
}
const NEPR = {
  balon(g, f) {
    const sq = f ? 0.6 : 0;
    elipsa(g, 8, 8, 6.5 + sq, 6.5 - sq, '#c84a10');
    elipsa(g, 8, 7.6, 6 + sq, 6 - sq, '#ff8a2a');
    elipsa(g, 5.6, 5, 1.6, 1.2, '#ffd2a0');
    oci(g, 5, 9, 6);
    px(g, 6, 11, 4, 1, '#7a2a00'); px(g, 5, 10, 1, 1, '#7a2a00'); px(g, 10, 10, 1, 1, '#7a2a00');
    px(g, 8, 14, 1, 2, '#c84a10');
  },
  cibule(g, f) {
    elipsa(g, 8, 10, 6, 5, '#2a5ab8');
    elipsa(g, 8, 9.6, 5.5, 4.6, '#5a8cf0');
    px(g, 7, 2, 2, 4, '#2a5ab8'); px(g, 7, 3, 2, 3, '#5a8cf0');
    px(g, f ? 9 : 5, 0, 2, 3, '#3cbc3c'); px(g, f ? 5 : 9, 1, 2, 2, '#2a9a2a');
    oci(g, 5, 9, 8, f ? 0 : 1);
    px(g, 7, 12, 2, 1, '#102a6a');
  },
  kapka(g, f) {
    const h = f ? 1 : 0;
    elipsa(g, 8, 9 + h * 0.5, 6.5, 5.5 - h * 0.5, '#0f8a8a');
    elipsa(g, 8, 8.6 + h * 0.5, 6, 5 - h * 0.5, '#3ad8d0');
    px(g, 7, 2 + h, 2, 3, '#3ad8d0');
    for (let x = 2; x < 14; x += 3) px(g, x + (f ? 1 : 0), 13, 2, 2, '#0f8a8a');
    elipsa(g, 5, 7, 1.4, 1, '#c8fff8');
    oci(g, 5, 9, 8);
  },
  duch(g, f) {
    g.globalAlpha = 0.82;
    elipsa(g, 8, 7, 6, 6, '#e8e8f8');
    px(g, 2, 7, 12, 6, '#e8e8f8');
    for (let x = 2; x < 14; x += 4) { px(g, x + (f ? 2 : 0), 13, 2, 2, '#e8e8f8'); }
    g.globalAlpha = 1;
    px(g, 5, 6, 2, 3, '#20203a'); px(g, 9, 6, 2, 3, '#20203a');
    px(g, 7, 10, 2, 2, '#20203a');
  },
  mince(g, f) {
    const sirky = [6.5, 4.5, 2, 4.5];
    const rx = sirky[f % 4];
    elipsa(g, 8, 8, rx, 6.5, '#a87808');
    elipsa(g, 8, 8, Math.max(1, rx - 1), 5.6, '#ffd23a');
    if (rx > 4) { px(g, 6, 6, 1, 2, '#c00'); px(g, 9, 6, 1, 2, '#c00'); px(g, 6, 10, 4, 1, '#7a5000'); px(g, 5, 9, 1, 1, '#7a5000'); px(g, 10, 9, 1, 1, '#7a5000'); }
    else px(g, 8, 4, 1, 8, '#fff6b0');
  },
};
function nepritel(typ, faze) {
  return sprite('n' + typ + faze, T, T, g => NEPR[typ](g, faze));
}

/* ---------- plameny ---------- */
function kresliPlamen(g, x0, y0, tvar, k, tik, i) {
  // k: zbývající podíl života plamene (1 → 0)
  const vek = 1 - k;
  const s = vek < 0.15 ? 0.4 + vek / 0.15 * 0.6 : 1 - (vek - 0.15) / 0.85 * 0.65;
  const chv = ((tik >> 2) + i) % 2 ? 0.5 : 0;
  const vrstvy = [[7.5 * s + chv, '#e83a10'], [5 * s + chv * 0.5, '#ffa020'], [2.4 * s, '#fff6c0']];
  const cx = x0 + 8, cy = y0 + 8;
  for (const [r, barva] of vrstvy) {
    const rr = Math.max(0.5, r);
    g.fillStyle = barva;
    g.fillRect(Math.round(cx - rr), Math.round(cy - rr), Math.round(rr * 2), Math.round(rr * 2));
    if (tvar & 1) g.fillRect(Math.round(cx - rr), y0, Math.round(rr * 2), 8);
    if (tvar & 4) g.fillRect(Math.round(cx - rr), y0 + 8, Math.round(rr * 2), 8);
    if (tvar & 8) g.fillRect(x0, Math.round(cy - rr), 8, Math.round(rr * 2));
    if (tvar & 2) g.fillRect(x0 + 8, Math.round(cy - rr), 8, Math.round(rr * 2));
  }
}

/* ---------- celá scéna ---------- */
function scena(g, S, anim) {
  const W = B.W, H = B.H, tik = S.tik;
  g.imageSmoothingEnabled = false;
  // pole
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, m = S.m[i], X = x * T, Y = y * T + LISTA;
    if (m === B.ZED) { g.drawImage(zed(x === 0 || y === 0 || x === W - 1 || y === H - 1), X, Y); continue; }
    g.drawImage(podlaha(), X, Y);
    const nad = y > 0 ? S.m[i - W] : B.ZED;
    if (nad === B.ZED || nad === B.BEDNA) px(g, X, Y, T, 3, BARVY_POD.stin);
    const pr = S.predmety[i];
    if (pr === 'dvere') g.drawImage(dvere(!S.nepratele.some(n => n.ziv)), X, Y);
    else if (pr) g.drawImage(predmet(pr, (tik >> 3) % 2), X, Y);
    if (m === B.BEDNA) g.drawImage(bedna(), X, Y);
    else if (m === B.HORI) {
      const k = S.plamenCas[i] / B.PLAMEN_CAS;
      g.globalAlpha = Math.max(0, k);
      g.drawImage(bedna(), X, Y);
      g.globalAlpha = 1;
      px(g, X, Y, T, T, 'rgba(40,10,0,' + (0.6 * (1 - k)).toFixed(2) + ')');
      kresliPlamen(g, X, Y, 0, Math.max(0.3, k), tik, i);
    }
  }
  // bomby
  for (const b of S.bomby) {
    const rychle = b.cas < 0.8 && !b.dalkova;
    const faze = Math.floor(S.cas * (rychle ? 10 : 4)) % 2;
    g.drawImage(bomba(faze, b.dalkova ? 1 : 0), Math.round(b.x * T), Math.round(b.y * T + LISTA));
  }
  // plameny
  for (let i = 0; i < W * H; i++) {
    if (S.plamenCas[i] <= 0 || S.m[i] === B.HORI) continue;
    const x = i % W, y = (i - x) / W;
    kresliPlamen(g, x * T, y * T + LISTA, S.plamenTvar[i] & 15, S.plamenCas[i] / B.PLAMEN_CAS, tik, i);
  }
  // postavy seřazené podle y (kdo je níž, je vepředu)
  const postavy = [];
  for (const h of S.hraci) if (h.ziv || h.smrtCas < 1.2) postavy.push({ y: h.y, h });
  for (const n of S.nepratele) postavy.push({ y: n.y, n });
  postavy.sort((a, b) => a.y - b.y);
  for (const p of postavy) {
    if (p.h) {
      const h = p.h;
      const faze = h.pohyb ? 1 + (Math.floor(h.krokAnim * 3) % 2) : 0;
      let smer = h.smer;
      const X = Math.round(h.x * T), Y = Math.round(h.y * T + LISTA - 6);
      if (!h.ziv) {
        // smrt: točení a mizení
        smer = [2, 1, 0, 3][Math.floor(h.smrtCas * 12) % 4];
        g.globalAlpha = Math.max(0, 1 - h.smrtCas / 1.2);
        g.drawImage(hrac(h.barva, smer, 0), X, Y + Math.round(h.smrtCas * 6));
        g.globalAlpha = 1;
        continue;
      }
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(X + 3, Y + 19, 10, 2);
      g.drawImage(hrac(h.barva, smer, faze), X, Y);
    } else {
      const n = p.n, X = Math.round(n.x * T), Y = Math.round(n.y * T + LISTA - 1);
      const faze = n.typ === 'mince' ? Math.floor(n.anim * 8) % 4 : Math.floor(n.anim * 4) % 2;
      if (!n.ziv) {
        // zásah: rozplynutí se a smrsknutí
        const k = Math.max(0, 1 - n.smrtCas / 1.2), r = Math.round(8 * (1 - k));
        g.globalAlpha = k;
        g.drawImage(nepritel(n.typ, 0), X + r / 2, Y + r, T - r, T - r);
        g.globalAlpha = 1;
        continue;
      }
      if (n.nesmrtelny > 0 && (tik >> 2) % 2) g.globalAlpha = 0.5;
      g.drawImage(nepritel(n.typ, faze), X, Y);
      g.globalAlpha = 1;
    }
  }
  g.globalAlpha = 1;
  // lišta (podklad; texty dokreslí UI ostře v plném rozlišení)
  px(g, 0, 0, SW, LISTA, '#1b1b22');
  px(g, 0, LISTA - 1, SW, 1, '#3a3a48');
}

/* malé ikonky na liště */
function hlavicka(barva) {
  return sprite('hl' + barva, 12, 12, g => {
    const O = OBLEKY[barva] || OBLEKY.bila;
    elipsa(g, 6, 6, 5.5, 5, O.helmaT); elipsa(g, 6, 5.8, 5, 4.5, O.helma);
    px(g, 3, 4, 6, 4, KUZE); px(g, 4, 5, 1, 2, '#111'); px(g, 7, 5, 1, 2, '#111');
  });
}

B.Gr = { T, LISTA, SW, SH, platno, scena, hrac, nepritel, predmet, bomba, hlavicka, OBLEKY };

})(BOMB);
