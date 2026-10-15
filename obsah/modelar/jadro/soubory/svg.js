/* Modelář 3D – import SVG do skici (bez DOM, jde v node; potřebuje ClipperLib).
   Čtení: path (M L H V C S Q T A Z, i relativní), rect (i zaoblený), circle,
   ellipse, polygon, polyline, line; transformace (matrix, translate, scale,
   rotate, skewX, skewY) skládané přes skupiny; fill, stroke, stroke-width,
   fill-rule i ve style=""; display:none se přeskočí, stejně jako defs,
   clipPath, mask, symbol, pattern. Třídy z <style> se nečtou (výchozí výplň
   je černá jako v prohlížeči). Jednotky: viewBox × width/height v mm/cm/in/pt/px,
   bez nich px = 25,4/96 mm. Osa y se otočí (skica má y nahoru).
   Převod na obrysy (clipper, celá čísla v µm):
     plocha  – vyplněné tvary podle jejich fill-rule, pak sjednocení,
     obrys   – tah čar zadanou tloušťkou (nebo stroke-width), kulaté konce a spoje,
     silueta – plocha bez otvorů. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const PI = Math.PI;
  const JEDNOTKY = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, '': 25.4 / 96 };
  const PRESKOCIT = new Set(['defs', 'clipPath', 'mask', 'symbol', 'pattern', 'marker', 'title', 'desc', 'metadata', 'style', 'script', 'linearGradient', 'radialGradient', 'filter']);

  const odescapuj = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1))
      : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()]);

  // ------------------------------------------------------------ afinní matice [a b c d e f]
  const nasob = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const pouzij = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  function transformace(t) {
    let m = [1, 0, 0, 1, 0, 0];
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
    let x;
    while ((x = re.exec(t || ''))) {
      const a = x[2].split(/[\s,]+/).filter(Boolean).map(Number);
      let n;
      switch (x[1]) {
        case 'matrix': n = a.length === 6 ? a : [1, 0, 0, 1, 0, 0]; break;
        case 'translate': n = [1, 0, 0, 1, a[0] || 0, a[1] || 0]; break;
        case 'scale': n = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0]; break;
        case 'rotate': {
          const r = (a[0] || 0) * PI / 180, c = Math.cos(r), s = Math.sin(r);
          n = [c, s, -s, c, 0, 0];
          if (a.length >= 3) n = nasob(nasob([1, 0, 0, 1, a[1], a[2]], n), [1, 0, 0, 1, -a[1], -a[2]]);
          break;
        }
        case 'skewX': n = [1, 0, Math.tan((a[0] || 0) * PI / 180), 1, 0, 0]; break;
        case 'skewY': n = [1, Math.tan((a[0] || 0) * PI / 180), 0, 1, 0, 0]; break;
      }
      if (n.every(isFinite)) m = nasob(m, n);
    }
    return m;
  }

  // ------------------------------------------------------------ cesty
  /** Text atributu d → podcesty [{body: [[x, y]], uzavrena}] (uživatelské jednotky). */
  function cesta(d, presnost) {
    const tok = (d || '').match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
    const out = [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, akt = null, cx = null, cy = null, qx = null, qy = null;
    const cislo = () => { const v = parseFloat(tok[i++]); if (!isFinite(v)) throw new Error('poškozená cesta v SVG'); return v; };
    const novy = () => { akt = { body: [[x, y]], uzavrena: false }; out.push(akt); };
    const bod = (px, py) => { if (!akt) novy(); akt.body.push([px, py]); x = px; y = py; };
    const kroku = (delka) => Math.max(4, Math.min(64, Math.ceil(delka / presnost)));
    const kubicka = (x1, y1, x2, y2, x3, y3) => {
      const n = kroku(Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2));
      const x0 = x, y0 = y;
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        bod(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
      }
    };
    const kvadraticka = (x1, y1, x2, y2) => {
      const n = kroku(Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1));
      const x0 = x, y0 = y;
      for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; bod(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2); }
    };
    const oblouk = (rx, ry, rot, velky, kladny, x2, y2) => {
      // převod z koncových bodů na střed (SVG 1.1, příloha F.6)
      if (rx === 0 || ry === 0) { bod(x2, y2); return; }
      rx = Math.abs(rx); ry = Math.abs(ry);
      const f = rot * PI / 180, cf = Math.cos(f), sf = Math.sin(f);
      const dx = (x - x2) / 2, dy = (y - y2) / 2;
      const x1p = cf * dx + sf * dy, y1p = -sf * dx + cf * dy;
      const l = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
      if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
      const zn = velky === kladny ? -1 : 1;
      const c = zn * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p) / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
      const cxp = c * rx * y1p / ry, cyp = -c * ry * x1p / rx;
      const ccx = cf * cxp - sf * cyp + (x + x2) / 2, ccy = sf * cxp + cf * cyp + (y + y2) / 2;
      const uhel = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      const t1 = uhel(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
      let dt = uhel((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
      if (!kladny && dt > 0) dt -= 2 * PI; else if (kladny && dt < 0) dt += 2 * PI;
      const n = Math.max(4, Math.min(128, Math.ceil(Math.abs(dt) * Math.max(rx, ry) / presnost)));
      for (let k = 1; k <= n; k++) {
        const t = t1 + dt * k / n;
        if (k === n) bod(x2, y2);
        else bod(ccx + rx * Math.cos(t) * cf - ry * Math.sin(t) * sf, ccy + rx * Math.cos(t) * sf + ry * Math.sin(t) * cf);
      }
    };
    while (i < tok.length) {
      if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
      else if (!cmd) throw new Error('poškozená cesta v SVG');
      const rel = cmd === cmd.toLowerCase() && cmd !== 'z' ? 1 : 0;
      const ox = rel ? x : 0, oy = rel ? y : 0;
      switch (cmd.toUpperCase()) {
        case 'M': x = cislo() + ox; y = cislo() + oy; sx = x; sy = y; novy(); cmd = rel ? 'l' : 'L'; break;
        case 'L': bod(cislo() + ox, cislo() + oy); break;
        case 'H': bod(cislo() + ox, y); break;
        case 'V': bod(x, cislo() + oy); break;
        case 'C': { const a = [cislo() + ox, cislo() + oy, cislo() + ox, cislo() + oy, cislo() + ox, cislo() + oy]; kubicka(...a); cx = a[2]; cy = a[3]; continue; }
        case 'S': {
          const x1 = cx != null ? 2 * x - cx : x, y1 = cy != null ? 2 * y - cy : y;
          const a = [cislo() + ox, cislo() + oy, cislo() + ox, cislo() + oy];
          kubicka(x1, y1, ...a); cx = a[0]; cy = a[1]; continue;
        }
        case 'Q': { const a = [cislo() + ox, cislo() + oy, cislo() + ox, cislo() + oy]; kvadraticka(...a); qx = a[0]; qy = a[1]; cx = cy = null; continue; }
        case 'T': {
          const x1 = qx != null ? 2 * x - qx : x, y1 = qy != null ? 2 * y - qy : y;
          kvadraticka(x1, y1, cislo() + ox, cislo() + oy); qx = x1; qy = y1; cx = cy = null; continue;
        }
        case 'A': {
          const rx = cislo(), ry = cislo(), rot = cislo();
          // příznaky mohou být nalepené („a10 10 0 01 5 5“)
          let f1 = tok[i], f2;
          if (/^[01][01]/.test(f1)) { f2 = f1[1]; tok[i] = f1.slice(2) || ''; f1 = f1[0]; if (!tok[i]) i++; } else { i++; f2 = tok[i++]; }
          if (/^[01].+/.test(f2)) { tok.splice(i, 0, f2.slice(1)); f2 = f2[0]; }
          oblouk(rx, ry, rot, f1 === '1', f2 === '1', cislo() + ox, cislo() + oy);
          break;
        }
        case 'Z': if (akt) { akt.uzavrena = true; x = sx; y = sy; akt = null; } break;
        default: throw new Error('neznámý příkaz cesty ' + cmd);
      }
      if (cmd.toUpperCase() !== 'C' && cmd.toUpperCase() !== 'S') { cx = cy = null; }
      if (cmd.toUpperCase() !== 'Q' && cmd.toUpperCase() !== 'T') { qx = qy = null; }
    }
    return out.filter(p => p.body.length >= 2);
  }

  /** Podcesty tvaru prvku (uživatelské jednotky). */
  function geometriePrvku(n, a, presnost) {
    const f = k => parseFloat(a[k]) || 0;
    switch (n) {
      case 'path': return cesta(a.d, presnost);
      case 'rect': {
        const x = f('x'), y = f('y'), w = f('width'), h = f('height');
        if (!(w > 0 && h > 0)) return [];
        let rx = a.rx != null ? f('rx') : a.ry != null ? f('ry') : 0, ry = a.ry != null ? f('ry') : rx;
        rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
        if (rx > 0 && ry > 0) return cesta(`M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`, presnost);
        return [{ body: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], uzavrena: true }];
      }
      case 'circle': case 'ellipse': {
        const cx = f('cx'), cy = f('cy'), rx = n === 'circle' ? f('r') : f('rx'), ry = n === 'circle' ? f('r') : f('ry');
        if (!(rx > 0 && ry > 0)) return [];
        const k = Math.max(16, Math.min(256, Math.ceil(2 * PI * Math.max(rx, ry) / presnost))), b = [];
        for (let i = 0; i < k; i++) b.push([cx + rx * Math.cos(2 * PI * i / k), cy + ry * Math.sin(2 * PI * i / k)]);
        return [{ body: b, uzavrena: true }];
      }
      case 'polygon': case 'polyline': {
        const c = (a.points || '').split(/[\s,]+/).filter(Boolean).map(Number);
        const b = [];
        for (let i = 0; i + 1 < c.length; i += 2) b.push([c[i], c[i + 1]]);
        return b.length >= 2 ? [{ body: b, uzavrena: n === 'polygon' }] : [];
      }
      case 'line': return [{ body: [[f('x1'), f('y1')], [f('x2'), f('y2')]], uzavrena: false }];
    }
    return [];
  }

  /** Prvky s id (pro <use>): id → text prvku i s obsahem. */
  function prvkySId(text) {
    const mapa = new Map();
    const re = /<\s*([\w:.-]+)\b([^>]*?)(\/?)\s*>/g;
    let m;
    while ((m = re.exec(text))) {
      const id = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(m[2]);
      if (!id || m[1][0] === '/') continue;
      const klic = id[1] !== undefined ? id[1] : id[2];
      if (m[3]) { mapa.set(klic, m[0]); continue; }
      // párová značka: najít odpovídající konec (se stejnojmennými vnořenými)
      const jm = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rz = new RegExp('<\\s*(\\/?)' + jm + '\\b[^>]*?(\\/?)\\s*>', 'g');
      rz.lastIndex = re.lastIndex;
      let hloubka = 1, k;
      while (hloubka && (k = rz.exec(text))) { if (k[1]) hloubka--; else if (!k[2]) hloubka++; }
      if (!hloubka) mapa.set(klic, text.slice(m.index, rz.lastIndex));
    }
    return mapa;
  }

  const ZAROVNANI = { min: 0, mid: 0.5, max: 1 };
  /** Matice viewBoxu do okna w × h (preserveAspectRatio, výchozí xMidYMid meet). */
  function viewport(vb, w, h, par) {
    const p = String(par || '').trim().split(/\s+/);
    if (p[0] === 'none') return [w / vb[2], 0, 0, h / vb[3], -vb[0] * w / vb[2], -vb[1] * h / vb[3]];
    const al = /^x(Min|Mid|Max)Y(Min|Mid|Max)$/i.exec(p[0] || '') || [0, 'Mid', 'Mid'];
    const sx = w / vb[2], sy = h / vb[3];
    const k = p[1] === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
    const tx = (w - vb[2] * k) * ZAROVNANI[al[1].toLowerCase()], ty = (h - vb[3] * k) * ZAROVNANI[al[2].toLowerCase()];
    return [k, 0, 0, k, tx - vb[0] * k, ty - vb[1] * k];
  }

  /** Text SVG → {prvky: [{podcesty (mm, y nahoru), vypln, tah, sirka (mm), pravidlo}], sirka, vyska}.
      Umí i vnořené <svg> (vlastní okno a viewBox) a <use> (odkaz na prvek nebo symbol podle id). */
  M.ctiSvg = function (text) {
    if (!/<svg[\s>]/i.test(text)) throw new Error('soubor není SVG');
    const prvky = [];
    const sId = prvkySId(text);
    let koren = null;
    const delka = s => { const q = /^\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(s || ''); return q && q[2] !== '%' ? +q[1] * (JEDNOTKY[q[2]] || JEDNOTKY.px) : null; };
    const cisloUz = s => { const q = /^\s*([-+]?[\d.]+(?:e[-+]?\d+)?)/i.exec(s || ''); return q ? +q[1] : null; };
    /** Délka v uživatelských jednotkách (px): procenta z okna rodiče, mm/cm/in/pt převedené. */
    const delkaUz = (t, rodic) => {
      const q = /^\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(t || '');
      if (!q) return null;
      if (q[2] === '%') return rodic != null ? +q[1] / 100 * rodic : null;
      return q[2] ? +q[1] * (JEDNOTKY[q[2]] || JEDNOTKY.px) / JEDNOTKY.px : +q[1];
    };
    let rozbaleni = 0;                       // počet rozbalení <use> (proti exponenciálnímu vnoření)

    function projdi(fragment, zakladMat, zakladStyl, hloubkaUse, jeSymbol, rozbalovane = new Set(), zakladOkno = null) {
      const zasobnik = [];
      let preskakuj = 0, prvni = true;
      const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\s*(\/?)([\w:.-]+)([^>]*?)(\/?)\s*>/g;
      let m;
      while ((m = re.exec(fragment))) {
        if (!m[2]) continue;
        const zavira = !!m[1], sam = !!m[4];
        let nazev = m[2].replace(/^.*:/, '');
        if (zavira) {
          const z = zasobnik.pop();
          if (z && z.preskoc) preskakuj--;
          continue;
        }
        // symbol vložený přes <use> se kreslí jako skupina
        if (prvni && jeSymbol && nazev === 'symbol') nazev = 'g';
        prvni = false;
        const a = {};
        const ra = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let x;
        while ((x = ra.exec(m[3]))) a[x[1].replace(/^xlink:/, '')] = odescapuj(x[2] !== undefined ? x[2] : x[3]);
        if (a.style) for (const d of a.style.split(';')) { const [k, v] = d.split(':').map(t => t && t.trim()); if (k && v) a[k] = v; }
        const rodic = zasobnik[zasobnik.length - 1];
        const zdedene = rodic ? rodic.styl : zakladStyl;
        const styl = Object.assign({}, zdedene);
        for (const k of ['fill', 'stroke', 'stroke-width', 'fill-rule', 'display', 'visibility']) if (a[k] != null) styl[k] = a[k];
        let mat = rodic ? rodic.mat : zakladMat;
        let okno = rodic ? rodic.okno : zakladOkno;          // velikost okna (pro % u vnořeného svg)
        const preskoc = PRESKOCIT.has(nazev) || styl.display === 'none' || styl.visibility === 'hidden';
        if (nazev === 'svg') {
          const vb = (a.viewBox || '').split(/[\s,]+/).map(Number);
          const maVb = vb.length === 4 && vb.every(isFinite) && vb[2] > 0 && vb[3] > 0;
          if (!koren) {
            // kořen: viewBox a velikost → mm na jednotku; osa y se otočí
            const w = delka(a.width), h = delka(a.height);
            okno = maVb ? [vb[2], vb[3]] : [w ? w / JEDNOTKY.px : 100, h ? h / JEDNOTKY.px : 100];
            let vm;
            if (maVb && w && h) { vm = viewport(vb, w, h, a.preserveAspectRatio); koren = { sirka: w, vyska: h }; }
            else if (maVb) {
              const k = w ? w / vb[2] : h ? h / vb[3] : JEDNOTKY.px;
              vm = [k, 0, 0, k, -vb[0] * k, -vb[1] * k];
              koren = { sirka: vb[2] * k, vyska: vb[3] * k };
            } else { vm = [JEDNOTKY.px, 0, 0, JEDNOTKY.px, 0, 0]; koren = { sirka: w || 0, vyska: h || 0 }; }
            mat = nasob([1, 0, 0, -1, 0, 0], vm);
          } else if (!preskoc) {
            // vnořené svg: vlastní okno x, y, width, height v jednotkách rodiče
            const ow = okno ? okno[0] : null, oh = okno ? okno[1] : null;
            const ox = delkaUz(a.x, ow) || 0, oy = delkaUz(a.y, oh) || 0;
            const w = a.width != null ? delkaUz(a.width, ow) : ow, h = a.height != null ? delkaUz(a.height, oh) : oh;
            let vm = [1, 0, 0, 1, ox, oy];
            if (maVb && w && h) vm = nasob(vm, viewport(vb, w, h, a.preserveAspectRatio));
            mat = nasob(mat, vm);
            okno = maVb ? [vb[2], vb[3]] : [w || ow, h || oh];
          }
        }
        if (!mat) mat = [JEDNOTKY.px, 0, 0, -JEDNOTKY.px, 0, 0];
        if (a.transform) mat = nasob(mat, transformace(a.transform));
        if (preskoc) preskakuj++;
        if (!sam) zasobnik.push({ styl, mat, preskoc, okno });
        else if (preskoc) preskakuj--;
        if (preskakuj > 0 || (preskoc && sam)) continue;
        if (nazev === 'use') {
          const id = String(a.href || '').replace(/^#/, '');
          const cil = sId.get(id);
          // odkaz sám na sebe (i přes další <use>) se přeskočí; celkový počet rozbalení je omezený
          if (cil && hloubkaUse < 8 && !rozbalovane.has(id)) {
            if (++rozbaleni > 10000) throw new Error('SVG je příliš složité (víc než 10 000 kopií přes <use>)');
            const posun = [1, 0, 0, 1, cisloUz(a.x) || 0, cisloUz(a.y) || 0];
            projdi(cil, nasob(mat, posun), styl, hloubkaUse + 1, /^<\s*(?:[\w.-]+:)?symbol\b/.test(cil), new Set([...rozbalovane, id]), okno);
          }
          continue;
        }
        const meritko = Math.sqrt(Math.abs(mat[0] * mat[3] - mat[1] * mat[2]));
        const pod = geometriePrvku(nazev, a, 0.05 / Math.max(meritko, 1e-9));
        if (!pod.length) continue;
        if (prvky.length >= 200000) throw new Error('SVG má příliš mnoho tvarů');
        prvky.push({
          podcesty: pod.map(p => ({ body: p.body.map(([px, py]) => pouzij(mat, px, py)), uzavrena: p.uzavrena })),
          vypln: styl.fill !== 'none' && styl.fill !== 'transparent' && nazev !== 'line' && nazev !== 'polyline',
          tah: styl.stroke !== 'none' && styl.stroke !== 'transparent',
          sirka: (parseFloat(styl['stroke-width']) || 1) * meritko,
          pravidlo: styl['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero',
        });
      }
    }
    projdi(text, null, { fill: '#000', stroke: 'none', 'stroke-width': '1', 'fill-rule': 'nonzero', display: '' }, 0, false);
    if (!prvky.length) throw new Error('v SVG není žádný tvar');
    return { prvky, sirka: koren ? koren.sirka : 0, vyska: koren ? koren.vyska : 0 };
  };

  // ------------------------------------------------------------ obrysy (clipper)
  const S = 1000;                     // µm
  const naClip = b => b.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
  const zClip = p => p.map(q => [q.X / S, q.Y / S]);

  /** Prvky z ctiSvg → obrysy skici {kontury (vycentrované, mm), sirka, vyska}.
      rezim: 'plocha' | 'obrys' | 'silueta'; tloustka = šířka čáry pro obrys (mm, jinak stroke-width). */
  M.svgNaKontury = function (svg, rezim = 'plocha', tloustka = 0) {
    const CL = globalThis.ClipperLib;
    if (!CL) throw new Error('chybí knihovna clipper');
    const sjednot = (cesty, pravidlo) => {
      const c = new CL.Clipper();
      c.AddPaths(cesty, CL.PolyType.ptSubject, true);
      const out = new CL.Paths();
      const ft = pravidlo === 'evenodd' ? CL.PolyFillType.pftEvenOdd : CL.PolyFillType.pftNonZero;
      c.Execute(CL.ClipType.ctUnion, out, ft, ft);
      return out;
    };
    let cesty;
    if (rezim === 'obrys') {
      // tah: prvky s tahem (když žádný nemá, všechny), kulaté spoje a konce
      const sTahem = svg.prvky.filter(p => p.tah);
      const zdroj = sTahem.length ? sTahem : svg.prvky;
      const sirky = new Map();
      for (const p of zdroj) {
        const w = tloustka > 0 ? tloustka : p.sirka;
        const k = Math.round(w * S / 2);
        if (!sirky.has(k)) sirky.set(k, []);
        sirky.get(k).push(p);
      }
      const casti = [];
      for (const [delta, prvky] of sirky) {
        const c = new CL.ClipperOffset(2, 0.02 * S);
        for (const p of prvky) for (const q of p.podcesty)
          c.AddPath(naClip(q.body), CL.JoinType.jtRound, q.uzavrena ? CL.EndType.etClosedLine : CL.EndType.etOpenRound);
        const out = new CL.Paths();
        c.Execute(out, Math.max(1, delta));
        casti.push(...out);
      }
      cesty = sjednot(casti, 'nonzero');
    } else {
      // plocha: vyplněné prvky (když žádný není vyplněný, všechny uzavřené), každý svým pravidlem
      const vypl = svg.prvky.filter(p => p.vypln);
      const zdroj = vypl.length ? vypl : svg.prvky;
      const casti = [];
      for (const p of zdroj) {
        const uz = p.podcesty.filter(q => q.body.length >= 3).map(q => naClip(q.body));
        if (uz.length) casti.push(...sjednot(uz, p.pravidlo));
      }
      cesty = sjednot(casti, 'nonzero');
      if (rezim === 'silueta') cesty = sjednot(cesty.filter(q => CL.Clipper.Orientation(q)), 'nonzero');
    }
    let kontury = cesty.map(zClip).filter(k => k.length >= 3);
    if (!kontury.length) throw new Error(rezim === 'obrys' ? 'SVG neobsahuje žádné čáry' : 'SVG neobsahuje žádnou uzavřenou plochu (zkus režim Obrys)');
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const k of kontury) for (const [x, y] of k) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    kontury = kontury.map(k => k.map(([x, y]) => [Math.round((x - cx) * 1e4) / 1e4, Math.round((y - cy) * 1e4) / 1e4]));
    return { kontury, sirka: x1 - x0, vyska: y1 - y0 };
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
