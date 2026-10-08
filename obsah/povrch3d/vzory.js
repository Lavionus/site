/* vzory.js – výškové mapy povrchových struktur pro povrch3d.html.
   Každý vzor je funkce f(x, y) na jedné dlaždici x, y ∈ <0, 1), která vrací
   výšku 0 (spára, dno) … 1 (líc). Dlaždice se opakuje bez švu, proto se
   šum i Voronoi počítají na periodické mřížce. Poměr stran dlaždice
   (výška / šířka) je `pomer`; funkce ho dostávají jako `a`, aby spáry
   vycházely stejně široké vodorovně i svisle.
   Modul nepotřebuje DOM – testuje se v node. */
/* Modul je pojmenovaná funkce: stránka z jejího textu (toString) sestaví
   Web Worker i při otevření ze souboru (file://), kde nejde stáhnout skript. */
function povrchVzory(G) {
  'use strict';

  /* ---------- pomocné funkce ---------- */
  const fr = v => v - Math.floor(v);
  const md = (v, n) => ((v % n) + n) % n;
  const sstep = (a, b, v) => { if (b === a) return v < a ? 0 : 1; const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  function hash(i, j, s) {
    let h = (i * 374761393 + j * 668265263 + (s | 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  // periodický hodnotový šum: mřížka P×Q buněk přes celou dlaždici
  function sum(x, y, P, Q, s) {
    const X = x * P, Y = y * Q;
    const i = Math.floor(X), j = Math.floor(Y);
    const u = X - i, v = Y - j;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const h = (a, b) => hash(md(a, P), md(b, Q), s);
    const a0 = h(i, j) + (h(i + 1, j) - h(i, j)) * su;
    const a1 = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * su;
    return a0 + (a1 - a0) * sv;
  }
  function fbm(x, y, P, Q, okt, s) {
    let v = 0, amp = 0.5, celk = 0;
    for (let o = 0; o < okt; o++) {
      v += amp * sum(x, y, P << o, Q << o, s + o * 17);
      celk += amp; amp *= 0.5;
    }
    return v / celk;
  }
  /* Periodický Voronoi: G×H buněk, v každé jeden bod. Souřadnice se počítají
     ve fyzickém měřítku (y násobené poměrem a), aby buňky nebyly protáhlé.
     Vrací vzdálenost k nejbližší hranici buňky (přesně, přes osu úsečky),
     vzdálenost ke středu a náhodné číslo buňky. `cheb` = čtvercová metrika
     (kostky). */
  function voronoi(x, y, a, Gx, Gy, jit, s, cheb) {
    const cx = x * Gx, cy = y * Gy;
    const ix = Math.floor(cx), iy = Math.floor(cy);
    const sx = 1 / Gx, sy = a / Gy;            // fyzický rozměr buňky
    const px = x, py = y * a;
    let b1 = 1e9, bx = 0, by = 0, bi = 0, bj = 0;
    const body = [];
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const i = ix + di, j = iy + dj;
      const mi = md(i, Gx), mj = md(j, Gy);
      const qx = (i + 0.5 + (hash(mi, mj, s) - 0.5) * jit) * sx;
      const qy = (j + 0.5 + (hash(mi, mj, s + 7) - 0.5) * jit) * sy;
      body.push(qx, qy, mi, mj);
      const dx = px - qx, dy = py - qy;
      const d = cheb ? Math.max(Math.abs(dx) / sx, Math.abs(dy) / sy) * Math.min(sx, sy) : Math.hypot(dx, dy);
      if (d < b1) { b1 = d; bx = qx; by = qy; bi = mi; bj = mj; }
    }
    let hr = 1e9;
    for (let k = 0; k < body.length; k += 4) {
      const qx = body[k], qy = body[k + 1];
      if (qx === bx && qy === by) continue;
      if (cheb) {
        // čtvercové buňky: hranice ve směru, kde soused leží
        const dx = qx - bx, dy = qy - by;
        if (Math.abs(dx) > Math.abs(dy) * 1.5) hr = Math.min(hr, Math.abs((px - (bx + qx) / 2)));
        else if (Math.abs(dy) > Math.abs(dx) * 1.5) hr = Math.min(hr, Math.abs((py - (by + qy) / 2)));
        else {
          const ux = qx - bx, uy = qy - by, l = Math.hypot(ux, uy);
          hr = Math.min(hr, ((px - (bx + qx) / 2) * -ux + (py - (by + qy) / 2) * -uy) / l);
        }
        continue;
      }
      const ux = qx - bx, uy = qy - by, l = Math.hypot(ux, uy);
      if (l < 1e-9) continue;
      const d = ((bx + qx) / 2 - px) * ux / l + ((by + qy) / 2 - py) * uy / l;
      if (d < hr) hr = d;
    }
    return { hrana: Math.max(0, hr), stred: b1, r: hash(bi, bj, s + 3), bunka: Math.min(sx, sy) };
  }
  const tri = v => 1 - Math.abs(2 * fr(v) - 1);         // trojúhelníková vlna 0..1..0
  const vzdObd = (u, v, w, h) => Math.min(Math.min(u, w - u), Math.min(v, h - v)); // k okraji obdélníku

  /* ---------- vzory ----------
     parametry: id, název, min, max, krok, výchozí. Délky jsou v jednotkách
     šířky dlaždice (1 = celá dlaždice). */
  const SEZNAM = [
    {
      id: 'cihly', nazev: 'Cihly', ikona: '🧱', barva: '#b5603f', pomer: 0.6,
      popis: 'Vazba na půl cihly; dlaždice = 2 cihly × 4 řady',
      parametry: [
        { id: 'spara', nazev: 'Spára', min: 0.005, max: 0.08, krok: 0.005, vych: 0.03 },
        { id: 'zkoseni', nazev: 'Zaoblení hran cihly', min: 0, max: 0.05, krok: 0.005, vych: 0.012 },
        { id: 'nahoda', nazev: 'Nerovnost cihel', min: 0, max: 1, krok: 0.05, vych: 0.4 },
      ],
      f(x, y, p, a) {
        const R = 4, C = 2;
        const radek = Math.floor(y * R), yy = y * R - radek;
        const xs = x * C + (radek % 2 ? 0.5 : 0);
        const bx = md(Math.floor(xs), C), xx = fr(xs);
        const d = Math.min(Math.min(xx, 1 - xx) / C, Math.min(yy, 1 - yy) * a / R);
        let h = sstep(p.spara / 2, p.spara / 2 + p.zkoseni + 1e-4, d);
        const r = hash(bx, radek, 11);
        h *= 1 - p.nahoda * 0.25 * r;
        h -= p.nahoda * 0.06 * fbm(x, y, 16, 16, 3, 5) * h;
        return h;
      },
    },
    {
      id: 'kamen', nazev: 'Kamenná zeď', ikona: '🪨', barva: '#8f8778', pomer: 1,
      popis: 'Nepravidelné oblé kameny ve spárách',
      parametry: [
        { id: 'pocet', nazev: 'Kamenů na šířku', min: 2, max: 10, krok: 1, vych: 4 },
        { id: 'spara', nazev: 'Spára', min: 0.005, max: 0.08, krok: 0.005, vych: 0.025 },
        { id: 'oblost', nazev: 'Vypouklost', min: 0, max: 1, krok: 0.05, vych: 0.6 },
        { id: 'nahoda', nazev: 'Nepravidelnost', min: 0, max: 1, krok: 0.05, vych: 0.85 },
        { id: 'seminko', nazev: 'Rozmístění (číslo)', min: 1, max: 99, krok: 1, vych: 7 },
      ],
      f(x, y, p, a) {
        const Gx = Math.round(p.pocet), Gy = Math.max(1, Math.round(p.pocet * a));
        const v = voronoi(x, y, a, Gx, Gy, p.nahoda, p.seminko);
        const okr = sstep(p.spara / 2, p.spara / 2 + v.bunka * 0.35 * p.oblost + 1e-4, v.hrana);
        let h = okr * (1 - 0.25 * v.r);
        h += 0.08 * (fbm(x, y, 12, Math.max(1, Math.round(12 * a)), 3, p.seminko) - 0.5) * okr;
        return Math.max(0, h);
      },
    },
    {
      id: 'kvadry', nazev: 'Kamenné kvádry', ikona: '🏰', barva: '#a39b8a', pomer: 1,
      popis: 'Řady opracovaných bloků nestejné délky i výšky',
      parametry: [
        { id: 'rad', nazev: 'Řad v dlaždici', min: 2, max: 8, krok: 1, vych: 4 },
        { id: 'spara', nazev: 'Spára', min: 0.005, max: 0.06, krok: 0.005, vych: 0.02 },
        { id: 'zkoseni', nazev: 'Zkosení hran', min: 0, max: 0.06, krok: 0.005, vych: 0.015 },
        { id: 'seminko', nazev: 'Rozmístění (číslo)', min: 1, max: 99, krok: 1, vych: 3 },
      ],
      f(x, y, p, a) {
        const R = Math.round(p.rad);
        // výšky řad: náhodné, součet 1
        const vy = []; let s = 0;
        for (let i = 0; i < R; i++) { const v = 0.7 + 0.6 * hash(i, 0, p.seminko); vy.push(v); s += v; }
        let y0 = 0, r = 0;
        for (; r < R - 1; r++) { const y1 = y0 + vy[r] / s; if (y < y1) break; y0 = y1; }
        const vh = vy[r] / s, yy = y - y0;
        // řezy v řadě: 2–3 bloky, posunuté
        const n = 2 + Math.floor(hash(r, 1, p.seminko) * 2);
        const pos = [];
        for (let i = 0; i < n; i++) pos.push(fr(i / n + (hash(r, i + 2, p.seminko) - 0.5) * 0.35 / n + hash(r, 9, p.seminko)));
        pos.sort((q, w) => q - w);
        let dx = 1, ib = 0;
        for (let i = 0; i < n; i++) {
          let d = Math.abs(x - pos[i]); d = Math.min(d, 1 - d);
          if (d < dx) dx = d;
          if (x >= pos[i]) ib = i + 1;
        }
        const d = Math.min(dx, Math.min(yy, vh - yy) * a);
        let h = sstep(p.spara / 2, p.spara / 2 + p.zkoseni + 1e-4, d);
        h *= 1 - 0.12 * hash(r, ib % n, p.seminko + 5);
        h -= 0.05 * fbm(x, y, 10, Math.max(1, Math.round(10 * a)), 3, 4) * h;
        return h;
      },
    },
    {
      id: 'dlazba', nazev: 'Dlaždice', ikona: '🔲', barva: '#c8c2b6', pomer: 1,
      popis: 'Čtvercové obklady se spárou',
      parametry: [
        { id: 'pocet', nazev: 'Dlaždic na šířku', min: 1, max: 8, krok: 1, vych: 2 },
        { id: 'spara', nazev: 'Spára', min: 0.005, max: 0.1, krok: 0.005, vych: 0.03 },
        { id: 'zkoseni', nazev: 'Zaoblení hran', min: 0, max: 0.08, krok: 0.005, vych: 0.01 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet), m = Math.max(1, Math.round(n * a));
        const u = fr(x * n) / n, v = fr(y * m) * a / m;
        const d = vzdObd(u, v, 1 / n, a / m);
        return sstep(p.spara / 2, p.spara / 2 + p.zkoseni + 1e-4, d);
      },
    },
    {
      id: 'sestiuhelnik', nazev: 'Šestiúhelníky', ikona: '⬡', barva: '#7f9bb0', pomer: Math.sqrt(3),
      popis: 'Včelí plástev, šestiboká dlažba',
      parametry: [
        { id: 'pocet', nazev: 'Buněk na šířku', min: 1, max: 6, krok: 1, vych: 2 },
        { id: 'spara', nazev: 'Spára', min: 0.005, max: 0.15, krok: 0.005, vych: 0.04 },
        { id: 'zkoseni', nazev: 'Zaoblení', min: 0, max: 0.15, krok: 0.005, vych: 0.02 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet);
        const X = x * n, Y = y * n * a;                 // buňka má rozteč 1
        const s3 = Math.sqrt(3);
        let best = 9, bx = 0, by = 0;
        for (const [ox, oy] of [[0, 0], [0.5, s3 / 2]]) {
          const i = Math.round(X - ox), j = Math.round((Y - oy) / s3);
          for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
            const cx = (i + di) + ox, cy = (j + dj) * s3 + oy;
            const d = Math.hypot(X - cx, Y - cy);
            if (d < best) { best = d; bx = X - cx; by = Y - cy; }
          }
        }
        let m = 0;
        for (let k = 0; k < 3; k++) {
          const u = Math.cos(k * Math.PI / 3), v = Math.sin(k * Math.PI / 3);
          m = Math.max(m, Math.abs(bx * u + by * v));
        }
        const d = (0.5 - m) / n;
        return sstep(p.spara / 2, p.spara / 2 + p.zkoseni + 1e-4, d);
      },
    },
    {
      id: 'rybikost', nazev: 'Rybí kost', ikona: '🐟', barva: '#9c6b43', pomer: 1,
      popis: 'Parkety nebo dlažba do rybí kosti (2:1)',
      parametry: [
        { id: 'pocet', nazev: 'Velikost (opakování)', min: 1, max: 4, krok: 1, vych: 1 },
        { id: 'spara', nazev: 'Spára', min: 0.002, max: 0.05, krok: 0.002, vych: 0.012 },
        { id: 'zkoseni', nazev: 'Zaoblení', min: 0, max: 0.04, krok: 0.002, vych: 0.006 },
        { id: 'nahoda', nazev: 'Nerovnost prvků', min: 0, max: 1, krok: 0.05, vych: 0.3 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet);
        const X = fr(x * n) * 4, Y = fr(y * n) * 4;     // dlaždice = 4×4 buňky
        // pás (strand) po úhlopříčce; viz komentář v souboru s odvozením
        const i = Math.floor(X), j = Math.floor(Y);
        const d = i - j, s = Math.floor((d + 2) / 4), dl = d - 4 * s;
        const xs = X - 4 * s;
        let x0, y0, w, h, id;
        if (dl === 0 || dl === 1) { const k = j; x0 = k; y0 = k; w = 2; h = 1; id = md(k, 4); }
        else { const k = i - 4 * s; x0 = k; y0 = k + 1; w = 1; h = 2; id = 4 + md(k, 4); }
        const dd = vzdObd(xs - x0, Y - y0, w, h) / 4 / n;
        let v = sstep(p.spara / 2, p.spara / 2 + p.zkoseni + 1e-4, dd);
        v *= 1 - 0.2 * p.nahoda * hash(id, 0, 21);
        return v;
      },
    },
    {
      id: 'prkna', nazev: 'Prkna', ikona: '🪵', barva: '#a0703f', pomer: 1,
      popis: 'Podlahová prkna s letokruhy, střídavé délky',
      parametry: [
        { id: 'rad', nazev: 'Prken v dlaždici', min: 2, max: 10, krok: 1, vych: 5 },
        { id: 'spara', nazev: 'Spára', min: 0.002, max: 0.04, krok: 0.002, vych: 0.01 },
        { id: 'kresba', nazev: 'Hloubka kresby dřeva', min: 0, max: 1, krok: 0.05, vych: 0.5 },
      ],
      f(x, y, p, a) {
        const R = Math.round(p.rad);
        const r = Math.floor(y * R), yy = fr(y * R) * a / R;
        const posun = hash(r, 3, 31);
        const xs = fr(x + posun);
        const d = Math.min(Math.min(xs, 1 - xs), Math.min(yy, a / R - yy));
        let h = sstep(p.spara / 2, p.spara / 2 + 0.003, d);
        const zrno = fbm(x, y, 2, Math.max(2, R * 8), 4, 40 + r);
        const leto = 0.5 + 0.5 * Math.sin((y * R * 6 + zrno * 6) * Math.PI);
        h -= p.kresba * 0.18 * leto * h;
        return h;
      },
    },
    {
      id: 'kostky', nazev: 'Dlažební kostky', ikona: '🟫', barva: '#7d7a74', pomer: 1,
      popis: 'Žulové kostky, mírně nepravidelné a oblé',
      parametry: [
        { id: 'pocet', nazev: 'Kostek na šířku', min: 2, max: 10, krok: 1, vych: 5 },
        { id: 'spara', nazev: 'Spára', min: 0.005, max: 0.06, krok: 0.005, vych: 0.02 },
        { id: 'oblost', nazev: 'Oblost', min: 0, max: 1, krok: 0.05, vych: 0.5 },
        { id: 'seminko', nazev: 'Rozmístění (číslo)', min: 1, max: 99, krok: 1, vych: 2 },
      ],
      f(x, y, p, a) {
        const Gx = Math.round(p.pocet), Gy = Math.max(1, Math.round(p.pocet * a));
        const v = voronoi(x, y, a, Gx, Gy, 0.35, p.seminko, true);
        let h = sstep(p.spara / 2, p.spara / 2 + v.bunka * 0.4 * p.oblost + 1e-4, v.hrana);
        h *= 1 - 0.18 * v.r;
        return h;
      },
    },
    {
      id: 'supiny', nazev: 'Šupiny', ikona: '🐉', barva: '#5f8f6f', pomer: 1,
      popis: 'Překrývající se oblé šupiny, střešní bobrovky',
      parametry: [
        { id: 'pocet', nazev: 'Šupin na šířku', min: 2, max: 10, krok: 1, vych: 4 },
        { id: 'hrana', nazev: 'Výška okraje', min: 0, max: 1, krok: 0.05, vych: 0.7 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet), m = Math.max(2, 2 * Math.round(n * a));
        const X = x * n, Y = y * m;                      // řada = 1 jednotka v Y
        // shora dolů: vyšší řada leží navrch (překrývá spodní)
        const sy = a * n / m;                            // poměr výšky řady k šířce šupiny
        for (let j = Math.floor(Y) + 1; j >= Math.floor(Y) - 2; j--) {
          const ox = md(j, 2) ? 0.5 : 0;
          const i = Math.round(X - ox);
          for (const ii of [i - 1, i, i + 1]) {
            const cx = ii + ox, cy = j;                  // spodní okraj šupiny = oblouk
            const dx = X - cx, dy = (Y - cy) * sy;
            const r = 0.5 * 1.08;
            const d = Math.hypot(dx, dy * 0.9);
            if (dy <= 0.02 && d < r) {
              const t = d / r;
              return 1 - p.hrana * 0.85 * t * t * t + 0.0 * dy;
            }
          }
        }
        return 0.1;
      },
    },
    {
      id: 'tkanina', nazev: 'Pletení', ikona: '🧺', barva: '#b39b6a', pomer: 1,
      popis: 'Košíková vazba – střídavě vodorovné a svislé pásky',
      parametry: [
        { id: 'pocet', nazev: 'Polí na šířku', min: 2, max: 8, krok: 2, vych: 4 },
        { id: 'pasku', nazev: 'Pásků v poli', min: 1, max: 4, krok: 1, vych: 3 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet), m = Math.max(2, Math.round(n * a / 2) * 2);
        const i = Math.floor(x * n), j = Math.floor(y * m);
        const u = fr(x * n), v = fr(y * m), k = Math.round(p.pasku);
        const svisle = (i + j) % 2 === 0;
        const t = svisle ? u : v, podel = svisle ? v : u;
        const pr = Math.sin(Math.PI * fr(t * k));        // příčný profil pásku
        const ohyb = 0.75 + 0.25 * Math.sin(Math.PI * podel);
        return Math.pow(pr, 0.5) * ohyb;
      },
    },
    {
      id: 'vrub', nazev: 'Vroubkování', ikona: '◇', barva: '#9aa3ad', pomer: 1,
      popis: 'Křížový vroub (rukojeti, knoflíky) – jehlánky',
      parametry: [
        { id: 'pocet', nazev: 'Zubů na šířku', min: 2, max: 16, krok: 1, vych: 6 },
        { id: 'plosky', nazev: 'Plošky na špičkách', min: 0, max: 0.6, krok: 0.05, vych: 0.1 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet), m = Math.max(1, Math.round(n * a));
        const h = Math.min(tri(x * n + y * m), tri(x * n - y * m));
        return Math.min(1, h / (1 - p.plosky));
      },
    },
    {
      id: 'slza', nazev: 'Slzičkový plech', ikona: '🔩', barva: '#a6adb4', pomer: 1,
      popis: 'Protiskluzový plech se střídavě natočenými slzičkami',
      parametry: [
        { id: 'pocet', nazev: 'Polí na šířku', min: 1, max: 8, krok: 1, vych: 3 },
        { id: 'delka', nazev: 'Délka slzičky', min: 0.3, max: 1, krok: 0.05, vych: 0.8 },
        { id: 'sirka', nazev: 'Šířka slzičky', min: 0.06, max: 0.35, krok: 0.01, vych: 0.2 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet), m = Math.max(1, Math.round(n * a));
        let best = 0;
        // dvě slzičky v poli (šachovnice 2×2 v poli o rozteči 1/2)
        const X = x * n * 2, Y = y * m * 2;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const i = Math.floor(X) + di, j = Math.floor(Y) + dj;
          const cx = i + 0.5, cy = j + 0.5;
          const uhel = (md(i + j, 2) ? 1 : -1) * Math.PI / 4;
          const dx = X - cx, dy = Y - cy;
          const u = dx * Math.cos(uhel) + dy * Math.sin(uhel), v = -dx * Math.sin(uhel) + dy * Math.cos(uhel);
          const e = Math.hypot(u / (p.delka * 0.62), v / (p.sirka * 0.6));
          best = Math.max(best, sstep(1, 0.6, e) * (1 - 0.2 * Math.min(1, e)));
        }
        return best;
      },
    },
    {
      id: 'hrbolky', nazev: 'Hrbolky', ikona: '⚪', barva: '#c99b5b', pomer: Math.sqrt(3),
      popis: 'Polokulové výstupky v šestiúhelníkové mřížce (Lego, protiskluz)',
      parametry: [
        { id: 'pocet', nazev: 'Hrbolků na šířku', min: 1, max: 10, krok: 1, vych: 3 },
        { id: 'velikost', nazev: 'Velikost hrbolku', min: 0.2, max: 1, krok: 0.05, vych: 0.7 },
        { id: 'tvar', nazev: 'Plochost (0 = koule, 1 = válec)', min: 0, max: 1, krok: 0.05, vych: 0.2 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet);
        const X = x * n, Y = y * n * a, s3 = Math.sqrt(3);
        let best = 9;
        for (const [ox, oy] of [[0, 0], [0.5, s3 / 2]]) {
          const i = Math.round(X - ox), j = Math.round((Y - oy) / s3);
          for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++)
            best = Math.min(best, Math.hypot(X - (i + di) - ox, Y - (j + dj) * s3 - oy));
        }
        const r = 0.5 * p.velikost, t = best / r;
        if (t >= 1) return 0;
        const koule = Math.sqrt(1 - t * t);
        return p.tvar * sstep(1, 0.85, t) + (1 - p.tvar) * koule;
      },
    },
    {
      id: 'ryhy', nazev: 'Rýhy', ikona: '☰', barva: '#8d9aa8', pomer: 1,
      popis: 'Rovnoběžné drážky (lamely, protiskluz, obložení)',
      parametry: [
        { id: 'pocet', nazev: 'Rýh v dlaždici', min: 1, max: 20, krok: 1, vych: 6 },
        { id: 'sirka', nazev: 'Šířka rýhy', min: 0.05, max: 0.9, krok: 0.05, vych: 0.35 },
        { id: 'profil', nazev: 'Profil (0 = hranatý, 1 = oblý)', min: 0, max: 1, krok: 0.05, vych: 0.3 },
      ],
      f(x, y, p, a) {
        const t = fr(y * Math.round(p.pocet));
        const d = Math.abs(t - 0.5) * 2;                   // 0 uprostřed rýhy
        const w = p.sirka;
        if (d > w) return 1;
        const q = d / w;
        return p.profil * (1 - Math.sqrt(Math.max(0, 1 - q * q))) + (1 - p.profil) * sstep(0.8, 1, q);
      },
    },
    {
      id: 'vlny', nazev: 'Vlny', ikona: '〰', barva: '#5d8fb5', pomer: 1,
      popis: 'Vlnitý plech nebo zvlněné linky',
      parametry: [
        { id: 'pocet', nazev: 'Vln v dlaždici', min: 1, max: 16, krok: 1, vych: 5 },
        { id: 'zvlneni', nazev: 'Zvlnění linek', min: 0, max: 0.5, krok: 0.02, vych: 0.12 },
        { id: 'opakovani', nazev: 'Počet zvlnění', min: 1, max: 6, krok: 1, vych: 2 },
      ],
      f(x, y, p, a) {
        const t = y * Math.round(p.pocet) + p.zvlneni * Math.sin(2 * Math.PI * x * Math.round(p.opakovani));
        return 0.5 + 0.5 * Math.cos(2 * Math.PI * t);
      },
    },
    {
      id: 'kuze', nazev: 'Kůže', ikona: '👜', barva: '#7a4b32', pomer: 1,
      popis: 'Zrnitá kůže s jemnými záhyby',
      parametry: [
        { id: 'pocet', nazev: 'Zrn na šířku', min: 4, max: 30, krok: 1, vych: 14 },
        { id: 'zahyby', nazev: 'Hloubka záhybů', min: 0, max: 1, krok: 0.05, vych: 0.6 },
      ],
      f(x, y, p, a) {
        const Gx = Math.round(p.pocet), Gy = Math.max(1, Math.round(p.pocet * a));
        const v = voronoi(x, y, a, Gx, Gy, 0.95, 13);
        const zahyb = 1 - Math.exp(-v.hrana / (v.bunka * 0.12));
        return (1 - p.zahyby) * 0.7 + p.zahyby * 0.85 * zahyb + 0.15 * fbm(x, y, Gx * 2, Gy * 2, 2, 9);
      },
    },
    {
      id: 'pisek', nazev: 'Pískování / šum', ikona: '🏖', barva: '#c8b48a', pomer: 1,
      popis: 'Náhodná zrnitost – omítka, pískovaný povrch',
      parametry: [
        { id: 'meritko', nazev: 'Velikost zrna (menší = jemnější)', min: 1, max: 6, krok: 1, vych: 3 },
        { id: 'oktavy', nazev: 'Členitost', min: 1, max: 6, krok: 1, vych: 4 },
        { id: 'seminko', nazev: 'Varianta (číslo)', min: 1, max: 99, krok: 1, vych: 1 },
      ],
      f(x, y, p, a) {
        const P = 1 << (7 - Math.round(p.meritko)), Q = Math.max(1, Math.round(P * a));
        const v = fbm(x, y, P, Q, Math.round(p.oktavy), p.seminko);
        return Math.min(1, Math.max(0, (v - 0.5) * 2.2 + 0.5));
      },
    },
    {
      id: 'mozaika', nazev: 'Mozaika', ikona: '🧩', barva: '#6f9a9a', pomer: 1,
      popis: 'Drobné nepravidelné kamínky (opus incertum)',
      parametry: [
        { id: 'pocet', nazev: 'Kamínků na šířku', min: 4, max: 20, krok: 1, vych: 9 },
        { id: 'spara', nazev: 'Spára', min: 0.002, max: 0.03, krok: 0.002, vych: 0.008 },
        { id: 'seminko', nazev: 'Rozmístění (číslo)', min: 1, max: 99, krok: 1, vych: 4 },
      ],
      f(x, y, p, a) {
        const Gx = Math.round(p.pocet), Gy = Math.max(1, Math.round(p.pocet * a));
        const v = voronoi(x, y, a, Gx, Gy, 0.9, p.seminko);
        return sstep(p.spara / 2, p.spara / 2 + 0.004, v.hrana) * (1 - 0.15 * v.r);
      },
    },
    {
      id: 'palisada', nazev: 'Palisáda', ikona: '🪵', barva: '#8a6a45', pomer: 1,
      popis: 'Svislé kulatiny vedle sebe – srub, plot, obklad z půlkulatin',
      parametry: [
        { id: 'pocet', nazev: 'Kmenů v dlaždici', min: 2, max: 12, krok: 1, vych: 5 },
        { id: 'spara', nazev: 'Mezera', min: 0, max: 0.2, krok: 0.01, vych: 0.04 },
        { id: 'kura', nazev: 'Hrubost kůry', min: 0, max: 1, krok: 0.05, vych: 0.4 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet), i = Math.floor(x * n);
        const t = fr(x * n) * 2 - 1;                        // -1..1 přes kmen
        const r = 1 - p.spara;
        if (Math.abs(t) >= r) return 0;
        const q = t / r;
        let h = Math.sqrt(1 - q * q);                        // půlkulatina
        h *= 1 - 0.08 * hash(i, 0, 51);
        h -= p.kura * 0.12 * fbm(x, y, n * 3, Math.max(4, Math.round(n * 24 * a)), 3, 50 + i) * h;
        return Math.max(0, h);
      },
    },
    {
      id: 'sindel', nazev: 'Šindel', ikona: '🏚', barva: '#7b6655', pomer: 1,
      popis: 'Překrývající se obdélníkové šindele (střecha, fasáda), mírně nepravidelné',
      parametry: [
        { id: 'pocet', nazev: 'Šindelů na šířku', min: 2, max: 10, krok: 1, vych: 4 },
        { id: 'rad', nazev: 'Řad v dlaždici', min: 2, max: 10, krok: 1, vych: 4 },
        { id: 'nahoda', nazev: 'Nepravidelnost', min: 0, max: 1, krok: 0.05, vych: 0.5 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet), R = Math.round(p.rad);
        const j = Math.floor(y * R), yy = fr(y * R);           // 0 dole … 1 nahoře v řadě
        const xs = x * n + (j % 2 ? 0.5 : 0) + (hash(j, 7, 61) - 0.5) * 0.3 * p.nahoda;
        const i = Math.floor(xs), xx = fr(xs);
        // šindel se ke spodnímu okraji zesiluje (klín), mezi šindeli spára
        let h = 0.35 + 0.65 * (1 - yy);
        const spara = 0.035 * n;
        if (xx < spara || xx > 1 - spara) h *= 0.15;
        h *= 1 - 0.15 * p.nahoda * hash(md(i, n), md(j, R), 62);
        h -= 0.05 * fbm(x, y, n * 2, R * 6, 2, 63) * h;
        return Math.max(0, Math.min(1, h));
      },
    },
    {
      id: 'bunky', nazev: 'Buňky (Voronoi)', ikona: '🕸', barva: '#6b8f7a', pomer: 1,
      popis: 'Vystouplá síť nepravidelných buněk – organický, technický vzhled',
      parametry: [
        { id: 'pocet', nazev: 'Buněk na šířku', min: 2, max: 14, krok: 1, vych: 5 },
        { id: 'stena', nazev: 'Tloušťka stěn', min: 0.005, max: 0.08, krok: 0.005, vych: 0.02 },
        { id: 'seminko', nazev: 'Rozmístění (číslo)', min: 1, max: 99, krok: 1, vych: 9 },
      ],
      f(x, y, p, a) {
        const Gx = Math.round(p.pocet), Gy = Math.max(1, Math.round(p.pocet * a));
        const v = voronoi(x, y, a, Gx, Gy, 0.9, p.seminko);
        return 1 - sstep(p.stena / 2, p.stena / 2 + 0.006, v.hrana);
      },
    },
    {
      id: 'diamanty', nazev: 'Diamantová bosáž', ikona: '💎', barva: '#9c9488', pomer: 1,
      popis: 'Jehlanové kvádry – renesanční bosáž, diamantové hroty',
      parametry: [
        { id: 'pocet', nazev: 'Kvádrů na šířku', min: 1, max: 8, krok: 1, vych: 3 },
        { id: 'spara', nazev: 'Spára', min: 0, max: 0.08, krok: 0.005, vych: 0.02 },
        { id: 'vazba', nazev: 'Vazba (0 = nad sebou, 1 = na střih)', min: 0, max: 1, krok: 1, vych: 1 },
        { id: 'plosky', nazev: 'Ploška na vrcholu', min: 0, max: 0.8, krok: 0.05, vych: 0.15 },
      ],
      f(x, y, p, a) {
        const n = Math.round(p.pocet), m = Math.max(1, Math.round(n * a));
        const j = Math.floor(y * m);
        const xs = x * n + (p.vazba >= 0.5 && j % 2 ? 0.5 : 0);
        const u = fr(xs), v = fr(y * m);
        const du = Math.min(u, 1 - u), dv = Math.min(v, 1 - v);
        const g = p.spara * n / 2;
        if (du < g || dv * (a * n / m) < g) return 0;
        // jehlan: výška podle vzdálenosti k nejbližší hraně kvádru
        const hrot = Math.min((du - g) / (0.5 - g), (dv * (a * n / m) - g) / (0.5 * (a * n / m) - g));
        return Math.min(1, 0.15 + 0.85 * hrot / Math.max(0.2, 1 - p.plosky));
      },
    },
  ];
  const PODLE_ID = new Map(SEZNAM.map(v => [v.id, v]));

  function vychoziParametry(id) {
    const v = PODLE_ID.get(id);
    const o = {};
    if (v) for (const q of v.parametry) o[q.id] = q.vych;
    return o;
  }

  /* Výšková mapa: Float32Array N×M (řádky odspodu, y roste nahoru). Mapy se
     ukládají do mezipaměti podle vzoru a parametrů. */
  const cache = new Map();
  function mapa(id, parametry, N) {
    N = N || 256;
    const v = PODLE_ID.get(id);
    if (!v) return null;
    const p = Object.assign(vychoziParametry(id), parametry || {});
    const k = id + '|' + N + '|' + JSON.stringify(p);
    if (cache.has(k)) return cache.get(k);
    const a = v.pomer;
    const M = Math.max(8, Math.round(N * Math.min(4, a)));
    const data = new Float32Array(N * M);
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
      const h = v.f((i + 0.5) / N, (j + 0.5) / M, p, a);
      data[j * N + i] = h < 0 ? 0 : h > 1 ? 1 : h;
    }
    const m = { N, M, data, pomer: a };
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    cache.set(k, m);
    return m;
  }

  /* Vlastní výšková mapa z obrázku (pole jasu 0..1, w×h, řádky shora dolů
     jako v ImageData). Volitelně rozmazání a vyrovnání kontrastu. */
  function zObrazku(jas, w, h, volby) {
    volby = volby || {};
    const data = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data[(h - 1 - j) * w + i] = jas[j * w + i];
    let d = data;
    const r = Math.round(volby.rozmazani || 0);
    for (let k = 0; k < r; k++) d = rozmaz(d, w, h);
    let mn = 1, mx = 0;
    for (const v of d) { if (v < mn) mn = v; if (v > mx) mx = v; }
    const roz = mx - mn > 1e-6 ? mx - mn : 1;
    for (let i = 0; i < d.length; i++) d[i] = (d[i] - mn) / roz;
    return { N: w, M: h, data: d, pomer: h / w };
  }
  function rozmaz(d, w, h) {
    const o = new Float32Array(d.length);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++)
        s += d[md(j + dj, h) * w + md(i + di, w)] * (di || dj ? (di && dj ? 1 : 2) : 4);
      o[j * w + i] = s / 16;
    }
    return o;
  }

  /* Bilineární vzorkování s opakováním; u, v v dlaždicích. */
  function vzorek(m, u, v) {
    const x = fr(u) * m.N - 0.5, y = fr(v) * m.M - 0.5;
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const i0 = md(i, m.N), i1 = md(i + 1, m.N), j0 = md(j, m.M), j1 = md(j + 1, m.M);
    const d = m.data;
    const a = d[j0 * m.N + i0] + (d[j0 * m.N + i1] - d[j0 * m.N + i0]) * fx;
    const b = d[j1 * m.N + i0] + (d[j1 * m.N + i1] - d[j1 * m.N + i0]) * fx;
    return a + (b - a) * fy;
  }

  G.VZORY = { SEZNAM, podleId: id => PODLE_ID.get(id), vychoziParametry, mapa, zObrazku, vzorek };
}
povrchVzory(typeof window !== 'undefined' ? window : globalThis);
