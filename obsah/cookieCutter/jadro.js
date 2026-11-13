/* ============================================================
   cookieCutter/jadro.js – vykrajovátka na cukroví bez DOM (běží i v node, test _test/cookieCutter_test.js).
   Obrys (předloha / text / obrázek) → odsazené obrysy → síť stěny s límcem a ostřím.

   CC.VYCHOZI, MEZE, VYCTY, KATALOG, NAZVY, normalizuj(q) → {p, hlaseni}
   CC.sestavObrys(v) → {body, aspekt} | null                  (obrys v mm; vlastní obrys v v.vlastni)
   CC.vypocet(p) → {o, poz, idx, objem, troj, rozsah, H, chyba}  (síť v osách tiskárny, Z nahoru)
   CC.stl(poz, idx) / CC.obj(poz, idx) / CC.svg(o, popis)      → Uint8Array / text / text
   CC.obrysZMasky(maska, w, h)                                  (pro text a obrázek z plátna ve stránce)
   ============================================================ */
(function () {
  'use strict';

    /* ==================================================================
       1. OBRYS — práce s uzavřenou lomenou čarou
       ------------------------------------------------------------------
       Obrys je pole bodů {x, y} v pořadí proti směru hodinových ručiček,
       uzavřené implicitně (poslední bod se spojí s prvním). Všechny
       předlohy ho vracejí vystředěný v jednotkovém rámečku (delší strana
       = 1), teprve pak se roztáhne na zadanou šířku a délku.
       ================================================================== */

    const TAU = Math.PI * 2;

    function plocha(b) {
      let s = 0;
      for (let i = 0, n = b.length; i < n; i++) {
        const j = (i + 1) % n;
        s += b[i].x * b[j].y - b[j].x * b[i].y;
      }
      return s / 2;
    }

    function delka(b) {
      let d = 0;
      for (let i = 0, n = b.length; i < n; i++) {
        const j = (i + 1) % n;
        d += Math.hypot(b[j].x - b[i].x, b[j].y - b[i].y);
      }
      return d;
    }

    function rozsah(b) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of b) {
        if (p.x < x0) x0 = p.x;
        if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y;
        if (p.y > y1) y1 = p.y;
      }
      return { x0, x1, y0, y1, sirka: x1 - x0, vyska: y1 - y0 };
    }

    // Vystředí obrys a zmenší ho tak, aby delší strana měřila 1.
    function normalizuj1(b) {
      const r = rozsah(b);
      const m = Math.max(r.sirka, r.vyska) || 1;
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      return b.map(p => ({ x: (p.x - cx) / m, y: (p.y - cy) / m }));
    }

    // Proti směru hodinových ručiček (kladná plocha) — na tom stojí
    // orientace normál i směr odsazení stěny.
    function sjednotSmer(b) {
      return plocha(b) < 0 ? b.slice().reverse() : b;
    }

    // Rovnoměrné přerozdělení bodů po délce obrysu.
    function prevzorkuj(b, pocet) {
      const n = b.length;
      if (n < 3) return b;
      const dl = [];
      let celkem = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const d = Math.hypot(b[j].x - b[i].x, b[j].y - b[i].y);
        dl.push(d);
        celkem += d;
      }
      if (celkem === 0) return b;
      const krok = celkem / pocet;
      const out = [];
      let i = 0, zbytek = 0;
      for (let k = 0; k < pocet; k++) {
        let cil = k * krok;
        // posun na správnou hranu
        while (zbytek + dl[i] < cil && i < n - 1) { zbytek += dl[i]; i++; }
        const t = dl[i] > 0 ? (cil - zbytek) / dl[i] : 0;
        const a = b[i], c = b[(i + 1) % n];
        out.push({ x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t });
      }
      return out;
    }

    // Chaikinovo zaoblování — každý průchod nahradí roh dvěma body na
    // třetinách sousedních hran, obrys se tím zkrátí a vyhladí.
    function chaikin(b, kolikrat) {
      let body = b;
      for (let k = 0; k < kolikrat; k++) {
        const out = [];
        const n = body.length;
        for (let i = 0; i < n; i++) {
          const a = body[i], c = body[(i + 1) % n];
          out.push({ x: a.x * 0.75 + c.x * 0.25, y: a.y * 0.75 + c.y * 0.25 });
          out.push({ x: a.x * 0.25 + c.x * 0.75, y: a.y * 0.25 + c.y * 0.75 });
        }
        body = out;
      }
      return body;
    }

    // Ramer–Douglas–Peucker: vyhodí body, které leží skoro na spojnici
    // sousedů. Používá se na obrysy vytažené z obrázku (jdou po pixelech).
    function zjednodus(b, eps) {
      if (b.length < 4) return b;
      const uchovat = new Uint8Array(b.length);
      uchovat[0] = 1;
      uchovat[b.length - 1] = 1;
      const zasobnik = [[0, b.length - 1]];
      while (zasobnik.length) {
        const [a, c] = zasobnik.pop();
        let nej = -1, nejI = -1;
        const ax = b[a].x, ay = b[a].y, cx = b[c].x, cy = b[c].y;
        const dx = cx - ax, dy = cy - ay;
        const len = Math.hypot(dx, dy) || 1e-9;
        for (let i = a + 1; i < c; i++) {
          const d = Math.abs((b[i].x - ax) * dy - (b[i].y - ay) * dx) / len;
          if (d > nej) { nej = d; nejI = i; }
        }
        if (nej > eps && nejI > 0) {
          uchovat[nejI] = 1;
          zasobnik.push([a, nejI], [nejI, c]);
        }
      }
      return b.filter((_, i) => uchovat[i]);
    }

    // Zaoblení rohů kvadratickou Bézierovou křivkou. Poloměr se u každého
    // rohu zkrátí tak, aby se vešel do kratší ze sousedních hran.
    function zaoblitRohy(b, r, kroku) {
      if (r <= 0) return b;
      const n = b.length;
      const out = [];
      for (let i = 0; i < n; i++) {
        const prev = b[(i - 1 + n) % n], curr = b[i], next = b[(i + 1) % n];
        let v1x = prev.x - curr.x, v1y = prev.y - curr.y;
        let v2x = next.x - curr.x, v2y = next.y - curr.y;
        const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
        if (l1 < 1e-9 || l2 < 1e-9) { out.push(curr); continue; }
        v1x /= l1; v1y /= l1; v2x /= l2; v2y /= l2;
        const cos = Math.max(-1, Math.min(1, v1x * v2x + v1y * v2y));
        const uhel = Math.acos(cos);
        if (uhel > Math.PI - 0.12) { out.push(curr); continue; } // skoro rovně
        let d = r / Math.tan(uhel / 2);
        d = Math.min(d, l1 * 0.48, l2 * 0.48);
        const p1 = { x: curr.x + v1x * d, y: curr.y + v1y * d };
        const p2 = { x: curr.x + v2x * d, y: curr.y + v2y * d };
        for (let k = 0; k <= kroku; k++) {
          const t = k / kroku, u = 1 - t;
          out.push({
            x: u * u * p1.x + 2 * u * t * curr.x + t * t * p2.x,
            y: u * u * p1.y + 2 * u * t * curr.y + t * t * p2.y
          });
        }
      }
      return out;
    }

    function otoc(b, stupne) {
      if (!stupne) return b;
      const a = stupne * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      return b.map(p => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
    }

    function zrcadli(b) {
      return b.map(p => ({ x: -p.x, y: p.y })).reverse();
    }

    // Vzdálenost bodu od nejbližší hrany obrysu.
    function vzdalenostOdObrysu(px, py, b) {
      let nej = Infinity;
      for (let i = 0, n = b.length; i < n; i++) {
        const a = b[i], c = b[(i + 1) % n];
        const dx = c.x - a.x, dy = c.y - a.y;
        const dd = dx * dx + dy * dy;
        let t = dd > 0 ? ((px - a.x) * dx + (py - a.y) * dy) / dd : 0;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
        if (d < nej) nej = d;
      }
      return nej;
    }

    // Paprsek doprava: kolikrát protne obrys, tolikrát se mění strana.
    function bodUvnitr(p, c) {
      let uvnitr = false;
      for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
        if (((c[i].y > p.y) !== (c[j].y > p.y)) &&
            (p.x < (c[j].x - c[i].x) * (p.y - c[i].y) / (c[j].y - c[i].y) + c[i].x)) uvnitr = !uvnitr;
      }
      return uvnitr;
    }

    function prusecik(p1, p2, p3, p4) {
      const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
      const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
      const den = d1x * d2y - d1y * d2x;
      if (Math.abs(den) < 1e-12) return null;
      const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
      const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
      if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
      return { x: p1.x + d1x * t, y: p1.y + d1y * t };
    }

    /* Odsazený obrys se v úžlabinách překříží sám se sebou — vznikne
       smyčka s obrácenou orientací. Najde se průsečík dvou hran a ta část
       obrysu, která má opačné znaménko plochy než celek, se vystřihne. */
    function odstranSmycky(b) {
      const smer = Math.sign(plocha(b)) || 1;
      for (let pruchod = 0; pruchod < 14; pruchod++) {
        const n = b.length;
        if (n < 8) break;
        let nasel = false;
        for (let i = 0; i < n && !nasel; i++) {
          for (let j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue;
            const x = prusecik(b[i], b[(i + 1) % n], b[j], b[(j + 1) % n]);
            if (!x) continue;
            const smycka = b.slice(i + 1, j + 1).concat([x]);
            const zbytek = [x].concat(b.slice(j + 1), b.slice(0, i + 1));
            if (smycka.length < 3 || zbytek.length < 3) continue;
            const aS = plocha(smycka), aZ = plocha(zbytek);
            const okS = Math.sign(aS) === smer, okZ = Math.sign(aZ) === smer;
            // přednost má správná orientace, při shodě větší kus
            if (okS !== okZ) b = okS ? smycka : zbytek;
            else b = Math.abs(aS) >= Math.abs(aZ) ? smycka : zbytek;
            nasel = true;
            break;
          }
        }
        if (!nasel) break;
      }
      return b;
    }

    /* Odsazení obrysu: kladné ven, záporné dovnitř. Každý bod se posune po
       průměrné normále sousedních hran (miter, omezený, aby špičky
       neutíkaly do nekonečna), pak se vyhodí body, které se dostaly blíž
       k původnímu obrysu, než měly (to jsou právě ty v úžlabinách), a
       nakonec se odstraní zbylé smyčky. */
    function posunObrys(b, odsazeni) {
      const n = b.length;
      if (n < 3 || odsazeni === 0) return b.slice();
      const smer = plocha(b) >= 0 ? 1 : -1;  // CCW → normála ven je vlevo
      const hrube = [];
      for (let i = 0; i < n; i++) {
        const prev = b[(i - 1 + n) % n], curr = b[i], next = b[(i + 1) % n];
        const d1x = curr.x - prev.x, d1y = curr.y - prev.y;
        const l1 = Math.hypot(d1x, d1y) || 1e-9;
        const d2x = next.x - curr.x, d2y = next.y - curr.y;
        const l2 = Math.hypot(d2x, d2y) || 1e-9;
        const n1x = d1y / l1 * smer, n1y = -d1x / l1 * smer;
        const n2x = d2y / l2 * smer, n2y = -d2x / l2 * smer;
        let nx = n1x + n2x, ny = n1y + n2y;
        const nl = Math.hypot(nx, ny) || 1e-9;
        nx /= nl; ny /= nl;
        const dot = n1x * n2x + n1y * n2y;
        const miter = Math.min(1 / Math.max(0.35, Math.sqrt((1 + dot) / 2)), 3);
        hrube.push({ x: curr.x + nx * odsazeni * miter, y: curr.y + ny * odsazeni * miter });
      }
      /* Ořez má dvě části. Bod, který se dostal blíž k původnímu obrysu,
         než je odsazení, patří do úžlabiny a musí pryč. A bod, který
         skončil na špatné straně obrysu (odsazení ven skončilo uvnitř,
         dovnitř venku), tam nepatří o to víc — to se stává na ostrých
         vnitřních rozích, kde miter narazil na svůj strop. */
      const mez = Math.abs(odsazeni) * 0.72;
      const ven = odsazeni > 0;
      const orezane = hrube.filter(p =>
        vzdalenostOdObrysu(p.x, p.y, b) >= mez && bodUvnitr(p, b) !== ven);
      return odstranSmycky(orezane.length >= 8 ? orezane : hrube);
    }

    // Protíná obrys sám sebe? U vytaženého tělesa by to znamenalo, že
    // stěna projde skrz sebe — slicer pak tiskne nesmysly.
    function protinaSeSam(c) {
      const n = c.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          if (prusecik(c[i], c[(i + 1) % n], c[j], c[(j + 1) % n])) return true;
        }
      }
      return false;
    }

    /* Otočí pole tak, aby začínalo u bodu nejbližšího zadanému — dvě
       odsazené kopie obrysu pak mají zhruba srovnané indexy a plocha mezi
       nimi (dno, límec, horní hrana) se neproplete. */
    function zarovnej(b, refBod) {
      let nej = Infinity, nejI = 0;
      for (let i = 0; i < b.length; i++) {
        const d = (b[i].x - refBod.x) ** 2 + (b[i].y - refBod.y) ** 2;
        if (d < nej) { nej = d; nejI = i; }
      }
      return b.slice(nejI).concat(b.slice(0, nejI));
    }

    /* ==================================================================
       2. MASKA → OBRYS
       Některé tvary (vločka, obláček) i všechny vlastní předlohy (text,
       obrázek) se snáz popíšou jako plocha než jako čára. Vykreslí se do
       mřížky a obvod největší souvislé plochy se obkrouží po pixelech
       (Mooreovo sousedství), zjednoduší a vyhladí.
       ================================================================== */

    // Kusy menší než 2 % největšího jsou zbytky po rasterizaci, ne části tvaru.
    function nejvetsiPlocha(maska, w, h) {
      const znacky = new Int32Array(w * h).fill(-1);
      let nejZnacka = -1, nejVelikost = 0, znacka = 0;
      const fronta = new Int32Array(w * h);
      for (let start = 0; start < w * h; start++) {
        if (!maska[start] || znacky[start] !== -1) continue;
        let hlava = 0, konec = 0, velikost = 0;
        fronta[konec++] = start;
        znacky[start] = znacka;
        while (hlava < konec) {
          const p = fronta[hlava++];
          velikost++;
          const x = p % w, y = (p - x) / w;
          if (x > 0) { const q = p - 1; if (maska[q] && znacky[q] === -1) { znacky[q] = znacka; fronta[konec++] = q; } }
          if (x < w - 1) { const q = p + 1; if (maska[q] && znacky[q] === -1) { znacky[q] = znacka; fronta[konec++] = q; } }
          if (y > 0) { const q = p - w; if (maska[q] && znacky[q] === -1) { znacky[q] = znacka; fronta[konec++] = q; } }
          if (y < h - 1) { const q = p + w; if (maska[q] && znacky[q] === -1) { znacky[q] = znacka; fronta[konec++] = q; } }
        }
        if (velikost > nejVelikost) { nejVelikost = velikost; nejZnacka = znacka; }
        znacka++;
      }
      let vyznamnych = 0;
      if (nejVelikost > 0) {
        const velikosti = new Map();
        for (let i = 0; i < znacky.length; i++) {
          if (znacky[i] >= 0) velikosti.set(znacky[i], (velikosti.get(znacky[i]) || 0) + 1);
        }
        for (const vel of velikosti.values()) if (vel > nejVelikost * 0.02) vyznamnych++;
      }
      return { znacky, nejZnacka, nejVelikost, pocetPloch: vyznamnych };
    }

    function obkrouzi(maska, w, h) {
      const { znacky, nejZnacka, nejVelikost, pocetPloch } = nejvetsiPlocha(maska, w, h);
      if (nejZnacka < 0 || nejVelikost < 12) return null;
      const je = (x, y) => x >= 0 && y >= 0 && x < w && y < h && znacky[y * w + x] === nejZnacka;

      let sx = -1, sy = -1;
      for (let y = 0; y < h && sx < 0; y++) {
        for (let x = 0; x < w; x++) if (je(x, y)) { sx = x; sy = y; break; }
      }
      const smery = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      const obrys = [{ x: sx, y: sy }];
      let px = sx, py = sy, bx = sx - 1, by = sy;
      const strop = 8 * w * h;
      for (let krok = 0; krok < strop; krok++) {
        let idx = 0;
        for (let k = 0; k < 8; k++) {
          if (px + smery[k][0] === bx && py + smery[k][1] === by) { idx = k; break; }
        }
        let nasel = false;
        for (let k = 1; k <= 8; k++) {
          const s = smery[(idx + k) % 8];
          const nx = px + s[0], ny = py + s[1];
          if (je(nx, ny)) {
            const pred = smery[(idx + k - 1 + 8) % 8];
            bx = px + pred[0]; by = py + pred[1];
            px = nx; py = ny;
            nasel = true;
            break;
          }
        }
        if (!nasel) break;
        if (px === sx && py === sy) break;
        obrys.push({ x: px, y: py });
      }
      if (obrys.length < 12) return null;
      return { obrys, pocetPloch, podilNejvetsi: nejVelikost };
    }

    // Obrys z masky → vyhlazený, vystředěný, v jednotkovém rámečku.
    function obrysZMasky(maska, w, h) {
      const v = obkrouzi(maska, w, h);
      if (!v) return null;
      let b = v.obrys.map(p => ({ x: p.x, y: h - 1 - p.y })); // mřížka má Y dolů
      b = zjednodus(b, 0.9);
      if (b.length < 8) return null;
      b = chaikin(b, 2);
      b = prevzorkuj(b, Math.min(400, Math.max(80, b.length)));
      return { body: normalizuj1(sjednotSmer(b)), pocetPloch: v.pocetPloch };
    }

    /* Vykreslí implicitní funkci (uvnitř = true) do mřížky a obkrouží ji.
       Když se kusy tvaru nedotýkají, obkrouží se jen ten největší a ze
       siluety zbude třeba jen jedno křídlo — proto se to hlásí do konzole
       a testy na to mají kontrolu. */
    function obrysZFunkce(uvnitr, res) {
      const maska = new Uint8Array(res * res);
      for (let y = 0; y < res; y++) {
        const fy = (res - 1 - y) / (res - 1) * 2 - 1;
        for (let x = 0; x < res; x++) {
          const fx = x / (res - 1) * 2 - 1;
          if (uvnitr(fx, fy)) maska[y * res + x] = 1;
        }
      }
      const v = obrysZMasky(maska, res, res);
      if (v && v.pocetPloch > 1) {
        console.warn('Předloha se skládá z ' + v.pocetPloch + ' nespojených kusů, použije se největší.');
      }
      return v ? v.body : null;
    }

    /* ==================================================================
       3. PŘEDLOHY TVARŮ
       Každá vrací obrys v jednotkovém rámečku. Tvary složené z několika
       kusů (vločka, motýl, obláček) se popisují plochou a obkrouží se
       z masky — spojení dvou elips je takhle o hodně kratší práce než
       počítat průsečíky.
       ================================================================== */

    /* --- stavebnice pro plošné tvary -----------------------------------
       Složitou siluetu je nejkratší popsat jako součet jednoduchých kusů:
       kruh, kapsle (úsečka s tloušťkou), obdélník, elipsa, mnohoúhelník.
       Funkce vrací true uvnitř; obrys se z nich obkrouží (obrysZFunkce).
       Souřadnice jsou v rozsahu −1…1, střed tvaru je v nule.           */

    function vzdalenostOdUsecky(x, y, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const dd = dx * dx + dy * dy;
      let t = dd > 0 ? ((x - ax) * dx + (y - ay) * dy) / dd : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
    }

    const kruh = (x, y, cx, cy, r) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;

    const kapsle = (x, y, ax, ay, bx, by, r) => vzdalenostOdUsecky(x, y, ax, ay, bx, by) <= r;

    function elipsaUvnitr(x, y, cx, cy, rx, ry, uhel) {
      const c = Math.cos(-(uhel || 0)), s2 = Math.sin(-(uhel || 0));
      const dx = x - cx, dy = y - cy;
      const u = dx * c - dy * s2, v = dx * s2 + dy * c;
      return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
    }

    // Obdélník se zaoblenými rohy (r = 0 → ostré).
    function obdelnik(x, y, cx, cy, sirka, vyska, r) {
      r = r || 0;
      const dx = Math.abs(x - cx) - (sirka / 2 - r);
      const dy = Math.abs(y - cy) - (vyska / 2 - r);
      if (dx <= 0 || dy <= 0) return Math.max(dx, 0) === 0 ? dy <= r : dx <= r;
      return dx * dx + dy * dy <= r * r;
    }

    // Mezikruží (pro ohyb hůlky) — volitelně jen nad danou výškou.
    const mezikruzi = (x, y, cx, cy, rMin, rMax) => {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      return d >= rMin * rMin && d <= rMax * rMax;
    };

    function mnohouhelnik(x, y, body) {
      let uvnitr = false;
      for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
        const xi = body[i][0], yi = body[i][1], xj = body[j][0], yj = body[j][1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
      }
      return uvnitr;
    }

    // Zrcadlově souměrný tvar stačí popsat zprava; sem se pošle |x|.
    const ax = x => Math.abs(x);

    // Obrys z bodů zadaných zprava, doplněný o levou půlku (proti směru
    // hodinových ručiček: nahoru po pravé straně, dolů po levé).
    function souměrný(pravaStrana) {
      const b = pravaStrana.map(q => ({ x: q[0], y: q[1] }));
      const zpet = pravaStrana.slice().reverse()
        .filter(q => Math.abs(q[0]) > 1e-6)
        .map(q => ({ x: -q[0], y: q[1] }));
      return b.concat(zpet);
    }

    /* ==================================================================
       3. KATALOG PŘEDLOH
       Jeden seznam pro nabídku, galerii náhledů i popisky. Tvary složené
       z několika kusů se počítají z masky, jednoduché parametricky.
       ================================================================== */

    const KATALOG = [
      { id: 'circle', nazev: '⚪ Kruh / ovál', skupina: 'Základní' },
      { id: 'square', nazev: '⬜ Čtverec', skupina: 'Základní' },
      { id: 'polygon', nazev: '⬡ Mnohoúhelník', skupina: 'Základní' },
      { id: 'star', nazev: '⭐ Hvězda', skupina: 'Základní' },
      { id: 'heart', nazev: '❤️ Srdíčko', skupina: 'Základní' },
      { id: 'drop', nazev: '💧 Kapka', skupina: 'Základní' },
      { id: 'diamond', nazev: '💎 Diamant', skupina: 'Základní' },
      { id: 'lightning', nazev: '⚡ Blesk', skupina: 'Základní' },
      { id: 'cloud', nazev: '☁️ Obláček', skupina: 'Základní' },
      { id: 'moon', nazev: '🌙 Měsíc', skupina: 'Základní' },

      { id: 'tree', nazev: '🎄 Stromek', skupina: 'Vánoce' },
      { id: 'bell', nazev: '🔔 Zvoneček', skupina: 'Vánoce' },
      { id: 'gingerbread', nazev: '🧍 Perníček', skupina: 'Vánoce' },
      { id: 'snowflake', nazev: '❄️ Vločka', skupina: 'Vánoce' },
      { id: 'snowman', nazev: '⛄ Sněhulák', skupina: 'Vánoce' },
      { id: 'ornament', nazev: '🔴 Baňka', skupina: 'Vánoce' },
      { id: 'gift', nazev: '🎁 Dárek', skupina: 'Vánoce' },
      { id: 'stocking', nazev: '🧦 Punčocha', skupina: 'Vánoce' },
      { id: 'candycane', nazev: '🍬 Hůlka', skupina: 'Vánoce' },
      { id: 'house', nazev: '🏠 Chaloupka', skupina: 'Vánoce' },

      { id: 'egg', nazev: '🥚 Vejce', skupina: 'Velikonoce' },
      { id: 'bunny', nazev: '🐰 Zajíček', skupina: 'Velikonoce' },
      { id: 'chick', nazev: '🐥 Kuřátko', skupina: 'Velikonoce' },
      { id: 'carrot', nazev: '🥕 Mrkev', skupina: 'Velikonoce' },
      { id: 'tulip', nazev: '🌷 Tulipán', skupina: 'Velikonoce' },

      { id: 'flower', nazev: '🌸 Květ', skupina: 'Příroda' },
      { id: 'leaf', nazev: '🍃 Lístek', skupina: 'Příroda' },
      { id: 'maple', nazev: '🍁 Javorový list', skupina: 'Příroda' },
      { id: 'clover', nazev: '🍀 Čtyřlístek', skupina: 'Příroda' },
      { id: 'sun', nazev: '☀️ Sluníčko', skupina: 'Příroda' },
      { id: 'mushroom', nazev: '🍄 Houbička', skupina: 'Příroda' },
      { id: 'cactus', nazev: '🌵 Kaktus', skupina: 'Příroda' },

      { id: 'butterfly', nazev: '🦋 Motýl', skupina: 'Zvířata' },
      { id: 'paw', nazev: '🐾 Tlapka', skupina: 'Zvířata' },
      { id: 'bone', nazev: '🦴 Kost', skupina: 'Zvířata' },
      { id: 'fish', nazev: '🐟 Rybka', skupina: 'Zvířata' },
      { id: 'cat', nazev: '🐱 Kočka', skupina: 'Zvířata' },
      { id: 'bird', nazev: '🐦 Ptáček', skupina: 'Zvířata' },

      { id: 'apple', nazev: '🍎 Jablko', skupina: 'Jídlo' },
      { id: 'pear', nazev: '🍐 Hruška', skupina: 'Jídlo' },
      { id: 'strawberry', nazev: '🍓 Jahoda', skupina: 'Jídlo' },
      { id: 'cupcake', nazev: '🧁 Košíček', skupina: 'Jídlo' },
      { id: 'icecream', nazev: '🍦 Zmrzlina', skupina: 'Jídlo' },
      { id: 'lollipop', nazev: '🍭 Lízátko', skupina: 'Jídlo' },

      { id: 'crown', nazev: '👑 Koruna', skupina: 'Věci' },
      { id: 'rocket', nazev: '🚀 Raketa', skupina: 'Věci' },
      { id: 'car', nazev: '🚗 Autíčko', skupina: 'Věci' },
      { id: 'plane', nazev: '✈️ Letadlo', skupina: 'Věci' },
      { id: 'boat', nazev: '⛵ Loďka', skupina: 'Věci' },
      { id: 'balloon', nazev: '🎈 Balónek', skupina: 'Věci' },

      { id: 'text', nazev: '🔤 Písmeno / nápis', skupina: 'Vlastní' },
      { id: 'image', nazev: '🖼 Obrázek', skupina: 'Vlastní' }
    ];

    // Rozlišení mřížky pro tvary počítané z plochy. Náhled v galerii si
    // vystačí s hrubší, aby se padesát obrázků spočítalo do mrknutí.
    const maskaRozliseni = v => (v && v.nahled ? 110 : 240);

    const PREDLOHY = {

      /* --- základní ---------------------------------------------------- */

      circle(v) {
        const b = [], kroku = Math.max(64, v.resolution);
        for (let i = 0; i < kroku; i++) {
          const a = (i / kroku) * TAU;
          b.push({ x: Math.cos(a) / 2, y: Math.sin(a) / 2 });
        }
        return b;
      },

      square() {
        const r = 0.12, kroku = 10, b = [];
        const rohy = [[0.5 - r, 0.5 - r, 0], [-0.5 + r, 0.5 - r, 1], [-0.5 + r, -0.5 + r, 2], [0.5 - r, -0.5 + r, 3]];
        for (const [cx, cy, k] of rohy) {
          for (let i = 0; i <= kroku; i++) {
            const a = (k * Math.PI / 2) + (i / kroku) * (Math.PI / 2);
            b.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
          }
        }
        return b;
      },

      polygon(v) {
        const n = v.polySides, b = [];
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + (i / n) * TAU;
          b.push({ x: Math.cos(a) / 2, y: Math.sin(a) / 2 });
        }
        return b;
      },

      star(v) {
        const n = v.starPoints, hloubka = v.starDepth / 100;
        const vnejsi = 0.5, vnitrni = vnejsi * (1 - hloubka), b = [];
        for (let i = 0; i < n * 2; i++) {
          const a = Math.PI / 2 + (i * Math.PI / n);
          b.push({ x: Math.cos(a) * (i % 2 === 0 ? vnejsi : vnitrni), y: Math.sin(a) * (i % 2 === 0 ? vnejsi : vnitrni) });
        }
        return b;
      },

      heart(v) {
        const b = [], kroku = Math.max(90, v.resolution);
        for (let i = 0; i < kroku; i++) {
          const t = (i / kroku) * TAU - Math.PI;
          b.push({
            x: 16 * Math.pow(Math.sin(t), 3) / 34,
            y: (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 34
          });
        }
        return b;
      },

      // Kruh dole a kužel z hrotu, jehož boky se kruhu dotýkají tečně —
      // proto kapka nikde nemá roh.
      drop(v) {
        const hrot = 0.95, stred = -0.34, r = 0.54;
        const d = hrot - stred;
        const tg = r / Math.sqrt(d * d - r * r);
        return obrysZFunkce((x, y) =>
          kruh(x, y, 0, stred, r) ||
          (y <= hrot && y >= stred && Math.abs(x) <= (hrot - y) * tg),
          maskaRozliseni(v));
      },

      diamond() {
        return souměrný([[0, -0.85], [0.62, 0.35], [0.36, 0.78], [0, 0.78]]);
      },

      lightning() {
        return [[0.18, 1], [-0.62, 0.02], [-0.12, 0.02], [-0.38, -1], [0.62, 0.1], [0.08, 0.1]]
          .map(q => ({ x: q[0] / 2, y: q[1] / 2 }));
      },

      cloud(v) {
        const kruhy = [[-0.55, -0.12, 0.34], [-0.18, 0.12, 0.44], [0.25, 0.06, 0.38], [0.6, -0.16, 0.30]];
        return obrysZFunkce((x, y) =>
          (y >= -0.42 && y <= 0 && x >= -0.85 && x <= 0.85) ||
          kruhy.some(([cx, cy, r]) => kruh(x, y, cx, cy, r)),
          maskaRozliseni(v));
      },

      // Srpek jako kruh bez kruhu — hroty vyjdou samy a plynule.
      moon(v) {
        return obrysZFunkce((x, y) => kruh(x, y, 0, 0, 0.95) && !kruh(x, y, 0.46, 0.08, 0.78),
          maskaRozliseni(v));
      },

      /* --- Vánoce ------------------------------------------------------ */

      // Stromek po patrech: každé patro se zvedne a zúží, dole kmen.
      tree(v) {
        const pater = Math.max(2, Math.round(v.treeTiers || 3));
        const dolu = -0.55, nahoru = 1.0, krok = (nahoru - dolu) / pater;
        const sirkaPatra = i => 0.88 * (1 - (i / pater) * 0.66);
        const prava = [[0.13, -1.0], [0.13, dolu]];
        for (let i = 0; i < pater; i++) {
          const y0 = dolu + krok * i, y1 = y0 + krok;
          const sb = sirkaPatra(i);
          prava.push([sb, y0]);
          if (i === pater - 1) { prava.push([0, nahoru]); break; }
          const zarez = sirkaPatra(i + 1) * 0.58;
          prava.push([zarez, y1]);
        }
        return souměrný(prava);
      },

      // Zvonek: kruh a trojúhelník dají profil, obruba dole ho uzavře.
      bell(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, 0, 0.12, 0.58) ||
          mnohouhelnik(x, y, [[-0.8, -0.5], [0.8, -0.5], [0, 0.5]]) ||
          obdelnik(x, y, 0, -0.62, 1.6, 0.26, 0.1) ||
          kruh(x, y, 0, 0.78, 0.15),
          maskaRozliseni(v));
      },

      // Perníček z kruhu a kapslí — kulatější a hladší než lomená čára.
      gingerbread(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, 0, 0.66, 0.29) ||
          kapsle(x, y, 0, 0.3, 0, -0.25, 0.3) ||
          kapsle(x, y, 0, 0.26, -0.78, 0.46, 0.15) ||
          kapsle(x, y, 0, 0.26, 0.78, 0.46, 0.15) ||
          kapsle(x, y, -0.05, -0.2, -0.36, -0.95, 0.17) ||
          kapsle(x, y, 0.05, -0.2, 0.36, -0.95, 0.17),
          maskaRozliseni(v));
      },

      snowflake(v) {
        const n = v.snowArms, tl = 0.075;
        return obrysZFunkce((x, y) => {
          if (kruh(x, y, 0, 0, 0.2)) return true;
          for (let i = 0; i < n; i++) {
            const a = Math.PI / 2 + (i / n) * TAU;
            const hx = Math.cos(a), hy = Math.sin(a);
            if (kapsle(x, y, 0, 0, hx * 0.95, hy * 0.95, tl)) return true;
            for (const [kde, dl] of [[0.42, 0.30], [0.66, 0.22]]) {
              for (const smer of [-1, 1]) {
                const ba = a + smer * Math.PI / 3;
                const zx = hx * kde, zy = hy * kde;
                if (kapsle(x, y, zx, zy, zx + Math.cos(ba) * dl, zy + Math.sin(ba) * dl, tl * 0.8)) return true;
              }
            }
          }
          return false;
        }, v && v.nahled ? 130 : 260);
      },

      snowman(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, 0, -0.58, 0.4) ||
          kruh(x, y, 0, 0.02, 0.31) ||
          kruh(x, y, 0, 0.45, 0.24) ||
          obdelnik(x, y, 0, 0.66, 0.82, 0.09, 0.03) ||
          obdelnik(x, y, 0, 0.82, 0.42, 0.28, 0.04) ||
          kapsle(x, y, 0.22, 0.05, 0.72, 0.36, 0.075) ||
          kapsle(x, y, -0.22, 0.05, -0.72, 0.36, 0.075),
          maskaRozliseni(v));
      },

      ornament(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, 0, -0.14, 0.66) ||
          obdelnik(x, y, 0, 0.58, 0.26, 0.24, 0.05) ||
          kruh(x, y, 0, 0.8, 0.14),
          maskaRozliseni(v));
      },

      gift(v) {
        return obrysZFunkce((x, y) =>
          obdelnik(x, y, 0, -0.28, 1.34, 1.08, 0.1) ||
          elipsaUvnitr(x, y, -0.27, 0.46, 0.28, 0.2, 0.5) ||
          elipsaUvnitr(x, y, 0.27, 0.46, 0.28, 0.2, -0.5) ||
          kruh(x, y, 0, 0.34, 0.13),
          maskaRozliseni(v));
      },

      stocking(v) {
        return obrysZFunkce((x, y) =>
          obdelnik(x, y, -0.02, 0.72, 0.66, 0.3, 0.07) ||
          kapsle(x, y, -0.02, 0.6, -0.06, -0.3, 0.27) ||
          kapsle(x, y, -0.06, -0.42, 0.5, -0.56, 0.26),
          maskaRozliseni(v));
      },

      candycane(v) {
        return obrysZFunkce((x, y) =>
          kapsle(x, y, 0.18, -0.92, 0.18, 0.36, 0.16) ||
          (y >= 0.34 && mezikruzi(x, y, -0.1, 0.36, 0.12, 0.44)) ||
          kapsle(x, y, -0.38, 0.36, -0.38, 0.2, 0.16),
          maskaRozliseni(v));
      },

      house(v) {
        return obrysZFunkce((x, y) =>
          obdelnik(x, y, 0, -0.42, 1.14, 0.88, 0.05) ||
          mnohouhelnik(x, y, [[-0.78, 0.02], [0.78, 0.02], [0, 0.78]]) ||
          obdelnik(x, y, 0.38, 0.5, 0.2, 0.42, 0.03),
          maskaRozliseni(v));
      },

      /* --- Velikonoce -------------------------------------------------- */

      egg(v) {
        const b = [], kroku = Math.max(90, v.resolution);
        for (let i = 0; i < kroku; i++) {
          const t = (i / kroku) * TAU;
          b.push({ x: Math.sin(t) * (0.75 - 0.25 * Math.cos(t)) / 2, y: Math.cos(t) / 2 });
        }
        return b;
      },

      bunny(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, 0, -0.5, 0.44) ||
          kruh(x, y, 0, 0.06, 0.32) ||
          kapsle(x, y, -0.13, 0.22, -0.26, 0.86, 0.11) ||
          kapsle(x, y, 0.13, 0.22, 0.26, 0.86, 0.11) ||
          kruh(x, y, 0.42, -0.72, 0.16),
          maskaRozliseni(v));
      },

      chick(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, -0.04, -0.3, 0.46) ||
          kruh(x, y, -0.12, 0.35, 0.3) ||
          mnohouhelnik(x, y, [[0.04, 0.44], [0.62, 0.3], [0.04, 0.14]]) ||
          mnohouhelnik(x, y, [[-0.3, -0.14], [-0.92, 0.16], [-0.4, -0.5]]) ||
          kapsle(x, y, -0.2, -0.68, -0.2, -0.95, 0.075) ||
          kapsle(x, y, 0.14, -0.68, 0.14, -0.95, 0.075),
          maskaRozliseni(v));
      },

      carrot(v) {
        return obrysZFunkce((x, y) =>
          mnohouhelnik(x, y, [[-0.36, 0.14], [0.36, 0.14], [0.08, -0.9], [-0.08, -0.9]]) ||
          kruh(x, y, 0, -0.88, 0.08) ||
          kapsle(x, y, 0, 0.1, 0, 0.7, 0.12) ||
          kapsle(x, y, -0.04, 0.1, -0.34, 0.56, 0.11) ||
          kapsle(x, y, 0.04, 0.1, 0.34, 0.56, 0.11),
          maskaRozliseni(v));
      },

      tulip(v) {
        return obrysZFunkce((x, y) =>
          mnohouhelnik(x, y, [
            [-0.34, 0.12], [-0.42, 0.66], [-0.19, 0.44], [-0.09, 0.95],
            [0.09, 0.95], [0.19, 0.44], [0.42, 0.66], [0.34, 0.12]]) ||
          kapsle(x, y, 0, 0.2, 0, -0.95, 0.08) ||
          elipsaUvnitr(x, y, -0.27, -0.34, 0.26, 0.09, 0.6) ||
          elipsaUvnitr(x, y, 0.27, -0.5, 0.26, 0.09, -0.6),
          maskaRozliseni(v));
      },

      /* --- příroda ----------------------------------------------------- */

      flower(v) {
        const n = v.flowerPetals, kroku = Math.max(140, v.resolution), b = [];
        for (let i = 0; i < kroku; i++) {
          const a = (i / kroku) * TAU;
          const r = 0.5 * (0.52 + 0.48 * Math.pow(Math.abs(Math.sin(a * n / 2)), 0.65));
          b.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
        }
        return b;
      },

      // Čočka ze dvou kruhů: čím dál od sebe mají středy, tím je lístek
      // užší a špičatější.
      leaf(v) {
        return obrysZFunkce((x, y) =>
          (kruh(x, y, -0.8, 0.1, 1.16) && kruh(x, y, 0.8, 0.1, 1.16)) ||
          kapsle(x, y, 0, -0.66, 0.05, -0.96, 0.055),
          maskaRozliseni(v));
      },

      maple() {
        return souměrný([
          [0.05, -1.0], [0.05, -0.34], [0.30, -0.42], [0.21, -0.12], [0.63, -0.10],
          [0.42, 0.10], [0.70, 0.30], [0.33, 0.34], [0.36, 0.60], [0.15, 0.55],
          [0.16, 0.84], [0.06, 0.78], [0, 1.0]
        ].map(q => [q[0] * 0.5, q[1] * 0.5]));
      },

      clover(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, -0.38, 0.4, 0.36) || kruh(x, y, 0.38, 0.4, 0.36) ||
          kruh(x, y, -0.38, -0.3, 0.36) || kruh(x, y, 0.38, -0.3, 0.36) ||
          kruh(x, y, 0, 0.05, 0.26) ||
          kapsle(x, y, 0, -0.2, 0.08, -0.98, 0.07),
          maskaRozliseni(v));
      },

      sun(v) {
        const paprsku = 10;
        return obrysZFunkce((x, y) => {
          if (kruh(x, y, 0, 0, 0.6)) return true;
          for (let i = 0; i < paprsku; i++) {
            const a = (i / paprsku) * TAU;
            if (kapsle(x, y, Math.cos(a) * 0.5, Math.sin(a) * 0.5,
                             Math.cos(a) * 0.93, Math.sin(a) * 0.93, 0.11)) return true;
          }
          return false;
        }, maskaRozliseni(v));
      },

      mushroom(v) {
        return obrysZFunkce((x, y) =>
          (y >= 0.02 && kruh(x, y, 0, 0.02, 0.8)) ||
          obdelnik(x, y, 0, -0.44, 0.5, 1.0, 0.2),
          maskaRozliseni(v));
      },

      cactus(v) {
        return obrysZFunkce((x, y) =>
          obdelnik(x, y, 0, -0.12, 0.46, 1.62, 0.23) ||
          kapsle(x, y, -0.2, 0.1, -0.58, 0.1, 0.16) ||
          kapsle(x, y, -0.58, 0.1, -0.58, 0.52, 0.16) ||
          kapsle(x, y, 0.2, -0.24, 0.6, -0.24, 0.16) ||
          kapsle(x, y, 0.6, -0.24, 0.6, 0.24, 0.16),
          maskaRozliseni(v));
      },

      /* --- zvířata ----------------------------------------------------- */

      butterfly(v) {
        return obrysZFunkce((x, y) => {
          // Křídla se přes střed nepřekrývají, drží je tělíčko — nahoře tak
          // mezi nimi zůstane zářez. Tělíčko proto musí být o kus širší než
          // mezera ke křídlu, jinak se tvar rozpadne na čtyři kusy.
          if (elipsaUvnitr(x, y, 0, 0.02, 0.14, 0.66)) return true;
          const ax = Math.abs(x);
          return elipsaUvnitr(ax, y, 0.56, 0.44, 0.46, 0.42, -0.35)
              || elipsaUvnitr(ax, y, 0.46, -0.5, 0.36, 0.3, 0.3)
              || kapsle(ax, y, 0.04, 0.34, 0.4, 0.44, 0.1)
              || kapsle(ax, y, 0.04, -0.3, 0.36, -0.46, 0.09);
        }, maskaRozliseni(v));
      },

      paw(v) {
        return obrysZFunkce((x, y) =>
          elipsaUvnitr(x, y, 0, -0.42, 0.5, 0.42) ||
          kruh(ax(x), y, 0.63, 0.24, 0.26) || kruh(ax(x), y, 0.22, 0.6, 0.28) ||
          kapsle(ax(x), y, 0.34, -0.2, 0.63, 0.24, 0.085) ||
          kapsle(ax(x), y, 0.18, -0.06, 0.22, 0.6, 0.085),
          maskaRozliseni(v));
      },

      bone(v) {
        return obrysZFunkce((x, y) =>
          obdelnik(x, y, 0, 0, 1.2, 0.34, 0.16) ||
          kruh(x, y, -0.6, 0.22, 0.27) || kruh(x, y, -0.6, -0.22, 0.27) ||
          kruh(x, y, 0.6, 0.22, 0.27) || kruh(x, y, 0.6, -0.22, 0.27),
          maskaRozliseni(v));
      },

      fish(v) {
        return obrysZFunkce((x, y) =>
          elipsaUvnitr(x, y, 0.22, 0, 0.6, 0.38) ||
          // ocas je klín s výřezem, aby byl vidět rozeklaný konec
          (mnohouhelnik(x, y, [[-0.2, 0], [-0.95, 0.5], [-0.95, -0.5]]) &&
           !mnohouhelnik(x, y, [[-1.0, 0.3], [-0.5, 0], [-1.0, -0.3]])) ||
          mnohouhelnik(x, y, [[0.04, 0.28], [0.32, 0.74], [0.54, 0.2]]),
          maskaRozliseni(v));
      },

      cat(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, 0, -0.12, 0.66) ||
          mnohouhelnik(x, y, [[-0.62, 0.22], [-0.44, 0.92], [-0.1, 0.4]]) ||
          mnohouhelnik(x, y, [[0.62, 0.22], [0.44, 0.92], [0.1, 0.4]]),
          maskaRozliseni(v));
      },

      bird(v) {
        return obrysZFunkce((x, y) =>
          elipsaUvnitr(x, y, -0.04, -0.14, 0.56, 0.44, -0.15) ||
          kruh(x, y, 0.42, 0.34, 0.29) ||
          mnohouhelnik(x, y, [[0.62, 0.4], [0.98, 0.28], [0.62, 0.18]]) ||
          mnohouhelnik(x, y, [[-0.4, -0.1], [-0.96, 0.34], [-0.8, -0.3]]) ||
          kapsle(x, y, -0.12, -0.52, -0.12, -0.78, 0.055) ||
          kapsle(x, y, 0.16, -0.5, 0.16, -0.78, 0.055),
          maskaRozliseni(v));
      },

      /* --- jídlo ------------------------------------------------------- */

      apple(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, -0.3, -0.14, 0.62) || kruh(x, y, 0.3, -0.14, 0.62) ||
          kapsle(x, y, 0, 0.36, 0.06, 0.82, 0.06) ||
          elipsaUvnitr(x, y, 0.28, 0.68, 0.24, 0.13, 0.45),
          maskaRozliseni(v));
      },

      pear(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, 0, -0.44, 0.54) || kruh(x, y, 0, 0.2, 0.3) ||
          kapsle(x, y, 0, 0.42, 0.04, 0.9, 0.05) ||
          elipsaUvnitr(x, y, 0.24, 0.74, 0.22, 0.12, 0.4),
          maskaRozliseni(v));
      },

      strawberry(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, -0.22, 0.24, 0.4) || kruh(x, y, 0.22, 0.24, 0.4) ||
          mnohouhelnik(x, y, [[-0.6, 0.26], [0.6, 0.26], [0, -0.92]]) ||
          elipsaUvnitr(x, y, 0, 0.66, 0.16, 0.14) ||
          elipsaUvnitr(x, y, -0.34, 0.6, 0.26, 0.12, 0.3) ||
          elipsaUvnitr(x, y, 0.34, 0.6, 0.26, 0.12, -0.3) ||
          kapsle(x, y, 0, 0.62, 0, 0.92, 0.05),
          maskaRozliseni(v));
      },

      cupcake(v) {
        return obrysZFunkce((x, y) =>
          mnohouhelnik(x, y, [[-0.52, -0.12], [0.52, -0.12], [0.36, -0.92], [-0.36, -0.92]]) ||
          obdelnik(x, y, 0, -0.08, 1.12, 0.2, 0.06) ||
          kruh(x, y, -0.3, 0.14, 0.34) || kruh(x, y, 0.3, 0.14, 0.34) ||
          kruh(x, y, 0, 0.36, 0.36) || kruh(x, y, 0, 0.64, 0.24),
          maskaRozliseni(v));
      },

      icecream(v) {
        return obrysZFunkce((x, y) =>
          mnohouhelnik(x, y, [[-0.38, 0.16], [0.38, 0.16], [0, -0.95]]) ||
          kruh(x, y, -0.27, 0.3, 0.3) || kruh(x, y, 0.27, 0.3, 0.3) ||
          kruh(x, y, 0, 0.58, 0.3),
          maskaRozliseni(v));
      },

      lollipop(v) {
        return obrysZFunkce((x, y) =>
          kruh(x, y, 0, 0.36, 0.56) ||
          obdelnik(x, y, 0, -0.48, 0.16, 1.0, 0.06),
          maskaRozliseni(v));
      },

      /* --- věci -------------------------------------------------------- */

      crown() {
        return [
          [-0.72, -0.62], [0.72, -0.62], [0.72, 0.18], [0.44, 0.6], [0.22, 0.02],
          [0, 0.75], [-0.22, 0.02], [-0.44, 0.6], [-0.72, 0.18]
        ].map(q => ({ x: q[0] / 2, y: q[1] / 2 }));
      },

      rocket(v) {
        return obrysZFunkce((x, y) =>
          kapsle(x, y, 0, -0.52, 0, 0.2, 0.25) ||
          mnohouhelnik(x, y, [[-0.25, 0.14], [0.25, 0.14], [0, 0.95]]) ||
          mnohouhelnik(x, y, [[-0.22, -0.1], [-0.78, -0.88], [-0.22, -0.78]]) ||
          mnohouhelnik(x, y, [[0.22, -0.1], [0.78, -0.88], [0.22, -0.78]]) ||
          obdelnik(x, y, 0, -0.78, 0.5, 0.2, 0.06),
          maskaRozliseni(v));
      },

      car(v) {
        return obrysZFunkce((x, y) =>
          obdelnik(x, y, 0, -0.14, 1.66, 0.42, 0.14) ||
          mnohouhelnik(x, y, [[-0.46, 0.04], [-0.26, 0.56], [0.16, 0.56], [0.42, 0.04]]) ||
          kruh(x, y, -0.52, -0.46, 0.3) || kruh(x, y, 0.52, -0.46, 0.3),
          maskaRozliseni(v));
      },

      plane(v) {
        return obrysZFunkce((x, y) =>
          kapsle(x, y, 0, -0.82, 0, 0.82, 0.16) ||
          mnohouhelnik(x, y, [[-0.96, -0.24], [0.96, -0.24], [0.56, 0.16], [-0.56, 0.16]]) ||
          mnohouhelnik(x, y, [[-0.42, -0.86], [0.42, -0.86], [0.24, -0.58], [-0.24, -0.58]]),
          maskaRozliseni(v));
      },

      boat(v) {
        return obrysZFunkce((x, y) =>
          mnohouhelnik(x, y, [[-0.95, -0.2], [0.95, -0.2], [0.6, -0.8], [-0.6, -0.8]]) ||
          kapsle(x, y, 0, -0.16, 0, 0.92, 0.07) ||
          mnohouhelnik(x, y, [[0.0, 0.86], [0.0, -0.12], [0.8, -0.12]]) ||
          mnohouhelnik(x, y, [[-0.0, 0.66], [-0.0, -0.12], [-0.62, -0.12]]),
          maskaRozliseni(v));
      },

      balloon(v) {
        return obrysZFunkce((x, y) =>
          elipsaUvnitr(x, y, 0, 0.28, 0.54, 0.64) ||
          mnohouhelnik(x, y, [[-0.12, -0.3], [0.12, -0.3], [0, -0.52]]) ||
          kapsle(x, y, 0, -0.44, 0.1, -0.95, 0.055),
          maskaRozliseni(v));
      }
    };

    /* ==================================================================
       4. GEOMETRIE VYKRAJOVÁTKA
       ------------------------------------------------------------------
       Svisle se skládá ze tří pater:

          ╱‾‾╲  ostří  – stěna se u horní hrany zúží na tloušťku ostří
          │  │  stěna  – svislá, plná tloušťka
         ┌┘  └┐ límec  – rozšíření ven, aby se dalo tlačit prsty

       Síť je rovnou v osách tiskárny (Z nahoru, stojí na Z = 0): bod
       obrysu (x, y) ve výšce h → (x, −y, h). Je to totéž otočení o 90°
       kolem X, jaké dřív dělal export z náhledu s Y nahoru – STL vychází
       bajt po bajtu stejně. Ostřím dolů pak tvar řeže tak, jak je v půdorysu.
       ================================================================== */

    const MIN_STENA_NAHORE = 0.2;

    function pripravObrysy(v, zaklad) {
      const n = zaklad.length;
      const ref = zaklad[0];
      const uprav = (b) => {
        if (!b || b.length < 6) return null;
        return zarovnej(prevzorkuj(b, n), ref);
      };
      const vnitrni = uprav(posunObrys(zaklad, -v.wallThickness));
      const hornistena = uprav(posunObrys(zaklad, -(v.wallThickness - v.bladeThickness)));
      const limec = v.collarOn ? uprav(posunObrys(zaklad, v.collarWidth)) : null;
      /* Vnitřní líc musí ležet celý uvnitř obrysu a límec celý venku.
         V úzkém místě (třeba tělíčko motýla) se odsazení překlopí na
         druhou stranu, aniž by se obrys protnul sám se sebou — stěny by
         pak procházely jednu skrz druhou a poznalo by se to až ve
         sliceru. */
      const mimo = (c, maBytUvnitr) => !c || c.some(p => bodUvnitr(p, zaklad) !== maBytUvnitr);
      const vady = [];
      const merOstri = v.wallThickness - v.bladeThickness;
      if (!vnitrni || !hornistena || protinaSeSam(vnitrni) || protinaSeSam(hornistena)
          || mimo(vnitrni, true) || (merOstri > 0.05 && mimo(hornistena, true))) vady.push('stena');
      if (limec && (protinaSeSam(limec) || mimo(limec, false))) vady.push('limec');
      return { zaklad, vnitrni, hornistena, limec, vady };
    }

    function postavGeometrii(v, o) {
      const { zaklad, vnitrni, hornistena, limec } = o;
      const n = zaklad.length;
      const vyska = v.height;
      const limecV = v.collarOn ? v.collarHeight : 0;
      const ostriV = Math.min(v.bladeHeight, vyska - limecV - 0.2);
      const zlom = vyska - ostriV;

      const vrcholy = [];
      const indexy = [];
      const bod = (p, y) => { vrcholy.push(p.x, -p.y, y); };

      function pas(dolni, dolniY, horni, horniY, ven) {
        const start = vrcholy.length / 3;
        for (let i = 0; i < n; i++) { bod(dolni[i], dolniY); bod(horni[i], horniY); }
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const a = start + i * 2, b = start + i * 2 + 1;
          const c = start + j * 2, d = start + j * 2 + 1;
          if (ven) { indexy.push(a, b, c, b, d, c); }
          else { indexy.push(a, c, b, b, c, d); }
        }
      }

      function prstenec(vnejsiB, vnitrniB, y, nahoru) {
        const start = vrcholy.length / 3;
        for (let i = 0; i < n; i++) bod(vnejsiB[i], y);
        for (let i = 0; i < n; i++) bod(vnitrniB[i], y);
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const o0 = start + i, o1 = start + j;
          const i0 = start + n + i, i1 = start + n + j;
          if (nahoru) { indexy.push(o0, i0, o1, o1, i0, i1); }
          else { indexy.push(o0, o1, i0, i0, o1, i1); }
        }
      }

      // vnější plášť
      pas(zaklad, limecV, zaklad, zlom, true);
      pas(zaklad, zlom, hornistena, vyska, true);
      // vnitřní plášť (od dna až nahoru)
      pas(vnitrni, 0, vnitrni, vyska, false);
      // límec
      if (limec) {
        pas(limec, 0, limec, limecV, true);
        prstenec(limec, zaklad, limecV, true);
        prstenec(limec, vnitrni, 0, false);
      } else {
        prstenec(zaklad, vnitrni, 0, false);
      }
      // horní hrana (ostří)
      prstenec(hornistena, vnitrni, vyska, true);

      const objem = objemMm3(vrcholy, indexy);
      return { poz: new Float32Array(vrcholy), idx: new Uint32Array(indexy), objem, troj: indexy.length / 3 };
    }

    // Objem uzavřené sítě = součet objemů čtyřstěnů k počátku.
    function objemMm3(vrcholy, indexy) {
      let obj = 0;
      for (let i = 0; i < indexy.length; i += 3) {
        const a = indexy[i] * 3, b = indexy[i + 1] * 3, c = indexy[i + 2] * 3;
        const ax = vrcholy[a], ay = vrcholy[a + 1], az = vrcholy[a + 2];
        const bx = vrcholy[b], by = vrcholy[b + 1], bz = vrcholy[b + 2];
        const cx = vrcholy[c], cy = vrcholy[c + 1], cz = vrcholy[c + 2];
        obj += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      }
      return Math.abs(obj);
    }


    /* ==================================================================
       5. EXPORT – síť už je v osách tiskárny (Z nahoru)
       ================================================================== */

    function normala(t) {
      const ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2];
      const vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const d = Math.hypot(nx, ny, nz) || 1;
      return [nx / d, ny / d, nz / d];
    }
    function trojuhelniky(poz, idx) {
      const out = [];
      for (let i = 0; i < idx.length; i += 3) {
        const t = [];
        for (let k = 0; k < 3; k++) { const p = idx[i + k] * 3; t.push([poz[p], poz[p + 1], poz[p + 2]]); }
        out.push(t);
      }
      return out;
    }

    // Binární STL — proti textovému je zhruba pětinový a načte se rychleji.
    function stl(poz, idx) {
      const t = trojuhelniky(poz, idx);
      const buf = new ArrayBuffer(84 + t.length * 50);
      const dv = new DataView(buf);
      const hlavicka = 'Vykrajovatko / generator vykrajovatek';
      for (let i = 0; i < hlavicka.length && i < 80; i++) dv.setUint8(i, hlavicka.charCodeAt(i));
      dv.setUint32(80, t.length, true);
      let p = 84;
      for (const tri of t) {
        const nn = normala(tri);
        dv.setFloat32(p, nn[0], true); dv.setFloat32(p + 4, nn[1], true); dv.setFloat32(p + 8, nn[2], true);
        p += 12;
        for (const vrchol of tri) {
          dv.setFloat32(p, vrchol[0], true);
          dv.setFloat32(p + 4, vrchol[1], true);
          dv.setFloat32(p + 8, vrchol[2], true);
          p += 12;
        }
        dv.setUint16(p, 0, true);
        p += 2;
      }
      return new Uint8Array(buf);
    }

    function obj(poz, idx) {
      const t = trojuhelniky(poz, idx);
      const radky = ['# vykrajovatko (mm, Z nahoru)', 'o vykrajovatko'];
      for (const tri of t) for (const v of tri) radky.push(`v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`);
      for (let i = 0; i < t.length; i++) radky.push(`f ${i * 3 + 1} ${i * 3 + 2} ${i * 3 + 3}`);
      return radky.join('\n') + '\n';
    }

    // Půdorys do SVG — hodí se jako šablona na papír nebo na řezací plotr.
    function svg(o, popis) {
      const vse = [o.limec, o.zaklad, o.vnitrni].filter(Boolean);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of vse) for (const p of c) {
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
      const okraj = 3;
      const w = (x1 - x0) + okraj * 2, h = (y1 - y0) + okraj * 2;
      const cesta = (c, barva, tloustka, dash) =>
        `<path d="${c.map((p, i) => `${i ? 'L' : 'M'}${(p.x - x0 + okraj).toFixed(3)},${(y1 - p.y + okraj).toFixed(3)}`).join(' ')} Z" `
        + `fill="none" stroke="${barva}" stroke-width="${tloustka}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
      const casti = [];
      if (o.limec) casti.push(cesta(o.limec, '#888888', 0.3, '2 1.5'));
      casti.push(cesta(o.zaklad, '#000000', 0.4, ''));
      if (o.vnitrni) casti.push(cesta(o.vnitrni, '#cc3333', 0.3, '1.5 1.5'));
      const text = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">`,
        `<title>${popis}</title>`,
        casti.join(''),
        '</svg>'
      ].join('\n');
      return text;
    }


    /* ==================================================================
       6. PROJEKT – stav stránky je plochý objekt (stejný jako dřív
       v localStorage „vykrajovatko_nastaveni“ i v uložených tvarech),
       vlastní obrys textu / obrázku je v p.vlastni = {typ, body: [[x, y]…]}
       ================================================================== */

    const G = typeof G3D !== 'undefined' ? G3D : require('../gen3d/zaklad.js');
    const HUSTOTA_PLA = 1.24 / 1000;   // g/mm³
    const NAZVY = Object.fromEntries(KATALOG.map(t => [t.id, t.nazev]));
    const PISMA = ['bold 200px Georgia, serif', '900 200px Arial, Helvetica, sans-serif', '200px Georgia, serif',
      'bold italic 200px Georgia, serif', "bold 200px 'Comic Sans MS', 'Segoe Print', cursive"];

    const VYCHOZI = {
      nazev: '',
      shapeType: 'star', starPoints: 5, starDepth: 50, polySides: 6, flowerPetals: 6, snowArms: 6, treeTiers: 3,
      textValue: 'A', textFont: 'bold 200px Georgia, serif', textFat: 14,
      imgThreshold: 50, imgInvert: false,
      shapeRotate: 0, mirrorShape: false, cornerRadius: 0, smoothIter: 0,
      width: 60, length: 60, lockAspect: true, height: 15, wallThickness: 1.2, scalePercent: 100,
      collarOn: true, collarHeight: 1, collarWidth: 1,
      bladeThickness: 0.6, bladeHeight: 2, resolution: 160,
      opacity: 100, objectColor: '#6aa6fd', bgColor: '#1a1a1a', bgAuto: true,
      showGrid: true, showEdges: false
    };
    // meze podle dřívějších polí formuláře (min/max)
    const MEZE = {
      starPoints: [3, 12, 1], starDepth: [15, 75], polySides: [3, 12, 1], flowerPetals: [4, 12, 1], snowArms: [5, 8, 1], treeTiers: [2, 6, 1],
      textFat: [0, 40], imgThreshold: [5, 95], shapeRotate: [-180, 180], cornerRadius: [0, 10], smoothIter: [0, 4, 1],
      width: [10, 250], length: [10, 250], height: [5, 60], wallThickness: [0.4, 5], scalePercent: [50, 200],
      collarHeight: [0.4, 6], collarWidth: [0.4, 8], bladeThickness: [0.2, 3], bladeHeight: [0.5, 10], resolution: [48, 360, 1], opacity: [20, 100, 1]
    };
    const VYCTY = { shapeType: KATALOG.map(t => t.id), textFont: PISMA };

    const zaokrouhli = body => body.map(q => [+(+q[0]).toFixed(4), +(+q[1]).toFixed(4)]);
    function normalizuj(q) {
      const r = G.normalizuj(q, { VYCHOZI, MEZE, VYCTY });
      const v = q && q.vlastni;
      if (v && (v.typ === 'text' || v.typ === 'image') && Array.isArray(v.body) && v.body.length > 8
          && v.body.every(b => Array.isArray(b) && Number.isFinite(+b[0]) && Number.isFinite(+b[1]))) {
        r.p.vlastni = { typ: v.typ, body: zaokrouhli(v.body) };
      }
      return r;
    }
    const vlastniZBodu = (typ, body) => ({ typ, body: zaokrouhli(body.map(b => [b.x, b.y])) });

    /* --- sestavení obrysu ---------------------------------------------- */

    /* Předloha se počítá znovu jen při změně tvaru nebo jeho vlastního
       nastavení. Bez toho by tahání za tloušťku stěny u vločky nebo
       perníčku rozsvěcovalo celou mřížku masky v každém snímku. */
    let pametPredlohy = { klic: null, body: null };

    function zakladniObrys(v) {
      if (v.shapeType === 'text' || v.shapeType === 'image') {
        const vl = v.vlastni;
        return (vl && vl.typ === v.shapeType) ? vl.body.map(q => ({ x: q[0], y: q[1] })) : null;
      }
      const klic = [v.shapeType, v.starPoints, v.starDepth, v.polySides, v.flowerPetals,
                    v.snowArms, v.treeTiers, Math.round(v.resolution)].join('|');
      if (pametPredlohy.klic === klic) return pametPredlohy.body;
      const f = PREDLOHY[v.shapeType];
      const body = f ? f(v) : null;
      pametPredlohy = { klic, body };
      return body;
    }

    /** Obrys v mm a poměr stran natočené předlohy (pro „držet poměr stran“). */
    function sestavObrys(v) {
      let b = zakladniObrys(v);
      if (!b || b.length < 3) return null;
      b = sjednotSmer(normalizuj1(b));
      if (v.mirrorShape) b = zrcadli(b);
      if (v.shapeRotate) b = normalizuj1(otoc(b, v.shapeRotate));

      const r = rozsah(b);
      const aspekt = (r.sirka / r.vyska) || 1;

      const mer = v.scalePercent / 100;
      const sx = (v.width * mer) / (r.sirka || 1);
      const sy = (v.length * mer) / (r.vyska || 1);
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      b = b.map(p => ({ x: (p.x - cx) * sx, y: (p.y - cy) * sy }));

      if (v.cornerRadius > 0) b = zaoblitRohy(b, v.cornerRadius, 6);
      if (v.smoothIter > 0) b = chaikin(b, v.smoothIter);
      b = prevzorkuj(b, Math.round(v.resolution));

      /* Zaoblení, vyhlazení i přerozdělení bodů tvar o kousek zmenší
         (vzorek jen zřídka padne přesně na špičku). Na závěr se proto
         natáhne přesně na zadaný rozměr — kdo chce 60 mm cukroví,
         má dostat 60 mm. */
      const r2 = rozsah(b);
      const sx2 = (v.width * mer) / (r2.sirka || 1);
      const sy2 = (v.length * mer) / (r2.vyska || 1);
      const cx2 = (r2.x0 + r2.x1) / 2, cy2 = (r2.y0 + r2.y1) / 2;
      b = b.map(p => ({ x: (p.x - cx2) * sx2, y: (p.y - cy2) * sy2 }));
      return { body: sjednotSmer(b), aspekt };
    }
    /** Délka při zamčeném poměru stran (stejné zaokrouhlení jako dřív). */
    function delkaPodlePomeru(v) {
      const s = sestavObrys(v);
      if (!s) return v.length;
      return Math.max(10, Math.min(250, Math.round(v.width / s.aspekt * 10) / 10));
    }
    function sirkaPodlePomeru(v) {
      const s = sestavObrys(v);
      if (!s) return v.width;
      return Math.max(10, Math.min(250, Math.round(v.length * s.aspekt * 10) / 10));
    }

    /* --- celý výpočet: kontroly + obrysy + síť ---------------------------
       H = hlášení gen3d {uroven, text, pole}; chyba = model nevznikl.     */
    function vypocet(p) {
      const v = Object.assign({}, p);
      const H = [];
      const hl = (uroven, text, pole) => H.push({ uroven, text, pole: pole || [] });

      // pořadí vrstev musí dávat smysl, jinak by se síť překryla sama sebou
      if (v.bladeThickness > v.wallThickness) {
        v.bladeThickness = v.wallThickness;
        hl('varovani', 'Ostří nemůže být tlustší než stěna — srovnáno na tloušťku stěny.', ['bladeThickness']);
      }
      if (v.wallThickness - v.bladeThickness < 0 || v.bladeThickness < MIN_STENA_NAHORE) {
        v.bladeThickness = Math.max(MIN_STENA_NAHORE, Math.min(v.bladeThickness, v.wallThickness));
      }
      const limecV = v.collarOn ? v.collarHeight : 0;
      if (limecV + v.bladeHeight > v.height - 0.5) {
        v.bladeHeight = Math.max(0.5, v.height - limecV - 0.5);
        hl('varovani', `Na ostří zbývá málo výšky — zkráceno na ${v.bladeHeight.toFixed(1)} mm.`, ['bladeHeight']);
      }

      const s = sestavObrys(v);
      if (!s) {
        const chyba = v.shapeType === 'image' ? 'Nejdřív vyberte obrázek, ze kterého se má obrys vzít.'
          : v.shapeType === 'text' ? 'Z textu se nepodařilo získat obrys — zkuste jiný znak nebo větší ztučnění.'
          : 'Obrys se nepodařilo sestavit.';
        return { v, H, chyba, o: null };
      }
      const o = pripravObrysy(v, s.body);

      /* Kolik dutiny má po odsazení zbýt: plocha zmenšená o pásek stěny
         kolem celého obvodu. Vyjde-li jí výrazně méně, potkaly se stěny
         v nějakém úzkém místě a tvar je tam slepený — na modelu to není
         poznat, ve sliceru ano. */
      const plochaVen = Math.abs(plocha(o.zaklad));
      const plochaVnitr = o.vnitrni ? Math.abs(plocha(o.vnitrni)) : 0;
      const ocekavana = plochaVen - delka(o.zaklad) * v.wallThickness;
      const stenaZanikla = plochaVnitr < plochaVen * 0.03
        || ocekavana <= plochaVen * 0.08
        || plochaVnitr < ocekavana * 0.45;
      if (stenaZanikla || o.vady.includes('stena')) {
        return { v, H, o, chyba: 'Stěna je na tenhle tvar moc tlustá — vnitřní líc se sám protnul, '
          + 'v nejužším místě už na dvě stěny není místo. Zmenšete tloušťku stěny, '
          + 'zvětšete vykrajovátko, zaoblete rohy nebo tvar vyhlaďte.', polePlochy: ['wallThickness'] };
      }
      if (o.vady.includes('limec')) {
        return { v, H, o, chyba: 'Límec je na tenhle tvar moc široký — v úžlabinách by prošel sám sebou. '
          + 'Zmenšete jeho šířku, nebo ho vypněte.', polePlochy: ['collarWidth'] };
      }

      const g = postavGeometrii(v, o);
      const r = rozsah(o.limec || o.zaklad);

      // tiskové poznámky
      if (plochaVnitr < ocekavana * 0.8) hl('varovani', 'V nejužších místech tvaru se stěny potkaly a je tam plno — tam vykrajovátko řezat nebude. Ztenčete stěnu nebo tvar zvětšete.', ['wallThickness']);
      if (v.wallThickness < 0.8) hl('varovani', 'Stěna pod 0,8 mm — v tiskovém programu nastavte jednu obvodovou stěnu, jinak ji nevytiskne.', ['wallThickness']);
      if (v.bladeThickness < 0.4) hl('varovani', 'Ostří pod 0,4 mm tryska 0,4 mm nevytáhne souvisle.', ['bladeThickness']);
      if (Math.max(r.sirka, r.vyska) > 210) hl('varovani', 'Delší strana přes 210 mm — zkontrolujte, že se vejde na podložku.', ['width']);
      if (v.height < 10) hl('varovani', 'Výška pod 10 mm se špatně drží v prstech.', ['height']);

      return { v, H, o, poz: g.poz, idx: g.idx, objem: g.objem, troj: g.troj, rozsah: r, rozsahRezu: rozsah(o.zaklad), aspekt: s.aspekt, gramu: g.objem * HUSTOTA_PLA };
    }

    /** Sváří vrcholy se stejnou polohou (pásy stěny mají vlastní vrcholy) – pro 3MF a kontrolu sítě. */
    function svar(poz, idx) {
      const mapa = new Map(), P = [], novy = new Uint32Array(poz.length / 3);
      for (let i = 0; i < poz.length / 3; i++) {
        const k = Math.round(poz[3 * i] * 1e4) + ',' + Math.round(poz[3 * i + 1] * 1e4) + ',' + Math.round(poz[3 * i + 2] * 1e4);
        let j = mapa.get(k);
        if (j === undefined) { j = P.length / 3; mapa.set(k, j); P.push(poz[3 * i], poz[3 * i + 1], poz[3 * i + 2]); }
        novy[i] = j;
      }
      const I = [];
      for (let t = 0; t < idx.length; t += 3) {
        const a = novy[idx[t]], b = novy[idx[t + 1]], c = novy[idx[t + 2]];
        if (a !== b && b !== c && a !== c) I.push(a, b, c);
      }
      return { poz: new Float32Array(P), idx: new Uint32Array(I) };
    }

    const popis = q => {
      const w = Math.round((q.width || 0) * (q.scalePercent || 100) / 100);
      const l = Math.round((q.length || 0) * (q.scalePercent || 100) / 100);
      return `${NAZVY[q.shapeType] || 'Tvar'} ${w} × ${l} mm`;
    };

    const API = {
      TAU, KATALOG, PREDLOHY, NAZVY, PISMA, VYCHOZI, MEZE, VYCTY, HUSTOTA_PLA, MIN_STENA_NAHORE,
      normalizuj, vlastniZBodu, sestavObrys, delkaPodlePomeru, sirkaPodlePomeru, vypocet, popis,
      plocha, delka, rozsah, normalizujObrys: normalizuj1, sjednotSmer, prevzorkuj, posunObrys, protinaSeSam, bodUvnitr,
      obrysZMasky, pripravObrysy, postavGeometrii, stl, obj, svg, svar,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    else window.CC = API;
})();
