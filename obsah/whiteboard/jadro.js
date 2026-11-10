/* ============================================================
   whiteboard/jadro.js – vektorový model tabule bez DOM
   Objekty (souřadnice ve světě, ne na obrazovce):
     tah    {body:[x0,y0,x1,y1…], zvyr}                 pero / zvýrazňovač
     cara   {x1,y1,x2,y2, sipkaZ, sipkaK, styl, trasa,   čára / šipka / spojnice
             zac, kon, osa, text, velikost, pismo}      zac/kon = id připojených objektů
     tvar   {druh, x,y,w,h, vypln, styl, text, velikost, pismo}
     text   {x,y, text, velikost, pismo}
     listek {x,y,w,h, text, velikost, pismo}            barva = podklad lístku
     obr    {x,y,w,h, obr}                              obr = id v tabule.obrazky
     ram    {x,y,w,h, nazev}                            rám = snímek prezentace / stránka PDF
     krivka {body, uzavrena, hladka, vypln, styl}       lomená čára / mnohoúhelník / hladká křivka
     oblast {kruhy:[[x,y…],…]}                          výplň z kbelíku (sudá–lichá = díry)
   tah navíc: stetec ('fix'|'stetec'|'kaligrafie'|'sprej'), tl = šířky bodů štětce 0–1
   Společné: id, typ, barva, alfa, sirka, skupina, zamek
   window.WB_JADRO (v node module.exports)
   ============================================================ */
(function (koren) {
  'use strict';

  const PISMA = {
    sans: "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'DejaVu Sans Mono', Consolas, 'Courier New', monospace",
    rucni: "'Comic Sans MS', 'Comic Neue', 'Segoe Print', 'Chalkboard SE', cursive"
  };
  const DRUHY = ['obdelnik', 'zaobleny', 'elipsa', 'kosoctverec', 'trojuhelnik', 'sestiuhelnik', 'hvezda'];
  // jaká část šířky tvaru je k dispozici pro popisek a o kolik je posunutý dolů
  const PROSTOR = { obdelnik: [0.9, 0], zaobleny: [0.88, 0], elipsa: [0.72, 0], kosoctverec: [0.55, 0], trojuhelnik: [0.5, 0.17], sestiuhelnik: [0.72, 0], hvezda: [0.4, 0.04] };
  const RADEK = 1.25;          // výška řádku textu × velikost písma
  const OKRAJ_LISTKU = 12;
  const ZVYR_ALFA = 0.35;
  const TITULEK_RAMU = 16;     // velikost písma názvu rámu
  const MEZERA_SPOJNICE = 6;   // odstup konce spojnice od tvaru

  // měření šířky textu – aplikace dosadí measureText z plátna, v testu odhad
  let mer = (text, velikost) => text.length * velikost * 0.55;

  const pismo = (o) => `${o.velikost || 20}px ${PISMA[o.pismo] || PISMA.sans}`;

  let citac = 0;
  const noveId = () => Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- text ----------
  function radkyTextu(o) { return String(o.text || '').split('\n'); }
  // nejširší řádek (smyčkou – Math.max(...pole) padá na statisících řádků)
  function sirkaRadku(radky, vel, pis) { let m = 0; for (const t of radky) m = Math.max(m, mer(t, vel, pis)); return m; }

  // zalomení textu do šířky (slova delší než řádek se lámou po znacích)
  function zalom(text, sirka, o) {
    const vel = o.velikost || 20;
    const ven = [];
    for (const odst of String(text || '').split('\n')) {
      let radek = '';
      for (const slovo of odst.split(/(\s+)/)) {
        const zkus = radek + slovo;
        if (radek && mer(zkus, vel, o.pismo) > sirka) { ven.push(radek.trimEnd()); radek = slovo.trimStart(); }
        else radek = zkus;
        while (radek.length > 1 && mer(radek, vel, o.pismo) > sirka) {
          // nejdelší začátek, který se vejde (binárně – dlouhé slovo bez mezer jinak zamrazí kreslení)
          let lo = 1, hi = radek.length - 1;
          while (lo < hi) { const m = (lo + hi + 1) >> 1; if (mer(radek.slice(0, m), vel, o.pismo) <= sirka) lo = m; else hi = m - 1; }
          ven.push(radek.slice(0, lo));
          radek = radek.slice(lo);
        }
      }
      ven.push(radek);
    }
    return ven;
  }

  // popisek uvnitř tvaru: zalomené řádky kolem středu
  function popisekTvaru(o) {
    const [f, dolu] = PROSTOR[o.druh] || PROSTOR.obdelnik;
    const vel = o.velikost || 20;
    const sirka = Math.max(vel, o.w * f - 8);
    return { radky: zalom(o.text, sirka, o), sirka, cx: o.x + o.w / 2, cy: o.y + o.h / 2 + o.h * dolu, lh: vel * RADEK };
  }

  // ---------- trasa čáry ----------
  function bodyCary(o) {
    if (o.trasa !== 'lomena') return [o.x1, o.y1, o.x2, o.y2];
    const dx = o.x2 - o.x1, dy = o.y2 - o.y1;
    const osa = (o.zac || o.kon) && o.osa ? o.osa : (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y');
    if (osa === 'x') { const mx = (o.x1 + o.x2) / 2; return [o.x1, o.y1, mx, o.y1, mx, o.y2, o.x2, o.y2]; }
    const my = (o.y1 + o.y2) / 2;
    return [o.x1, o.y1, o.x1, my, o.x2, my, o.x2, o.y2];
  }

  // střed čáry pro popisek (střed prostředního úseku)
  function stredCary(o) {
    const b = bodyCary(o);
    const i = b.length === 4 ? 0 : 2;
    return { x: (b[i] + b[i + 2]) / 2, y: (b[i + 1] + b[i + 3]) / 2 };
  }

  // poslední nenulový úsek ve směru konce → hrot šipky
  function smerKonce(b, odKonce) {
    const n = b.length;
    if (odKonce) {
      for (let i = n - 4; i >= 0; i -= 2) if (b[i] !== b[n - 2] || b[i + 1] !== b[n - 1]) return [b[i], b[i + 1], b[n - 2], b[n - 1]];
      return [b[0], b[1], b[n - 2], b[n - 1]];
    }
    for (let i = 2; i < n; i += 2) if (b[i] !== b[0] || b[i + 1] !== b[1]) return [b[i], b[i + 1], b[0], b[1]];
    return [b[2], b[3], b[0], b[1]];
  }

  // ---------- hranice ----------
  const cache = new WeakMap();
  const zneplatni = o => { cache.delete(o); cesty.delete(o); };

  function hraniceHole(o) {
    switch (o.typ) {
      case 'tah': case 'krivka': case 'oblast': {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const zdroj = o.typ === 'krivka' && o.hladka ? { typ: 'tah', body: vzorkyKrivky(o) } : o;   // hladká se vyboulí mimo body
        proBody(zdroj, (b, i) => {
          if (b[i] < x0) x0 = b[i]; if (b[i] > x1) x1 = b[i];
          if (b[i + 1] < y0) y0 = b[i + 1]; if (b[i + 1] > y1) y1 = b[i + 1];
        });
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      case 'cara':
        return { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2), w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
      case 'text': {
        const r = radkyTextu(o);
        const w = Math.max(o.velikost * 0.5, sirkaRadku(r, o.velikost, o.pismo));
        return { x: o.x, y: o.y, w, h: r.length * o.velikost * RADEK };
      }
      default:
        return { x: o.x, y: o.y, w: o.w, h: o.h };
    }
  }

  // hranice včetně tloušťky čáry a titulku rámu (pro výběr, ořez a export)
  function hranice(o) {
    let h = cache.get(o);
    if (h) return h;
    h = hraniceHole(o);
    if (o.typ === 'ram') h = { x: h.x, y: h.y - TITULEK_RAMU * 1.6, w: h.w, h: h.h + TITULEK_RAMU * 1.6 };
    const p = okrajObjektu(o);
    h = { x: h.x - p, y: h.y - p, w: h.w + 2 * p, h: h.h + 2 * p };
    const pop = obdelnikPopisku(o);
    if (pop) h = sjednot(h, pop);
    cache.set(o, h);
    return h;
  }

  const sjednot = (a, b) => {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  // obdélník popisku čáry / tvaru (může přesahovat samotný objekt)
  function obdelnikPopisku(o) {
    if (!o.text || (o.typ !== 'cara' && o.typ !== 'tvar')) return null;
    if (o.typ === 'cara') {
      const m = stredCary(o), vel = o.velikost || 20, radky = radkyTextu(o);
      const w = sirkaRadku(radky, vel, o.pismo) + vel * 0.6, v = radky.length * vel * RADEK;
      return { x: m.x - w / 2, y: m.y - v / 2, w, h: v };
    }
    const p = popisekTvaru(o), v = p.radky.length * p.lh;
    return { x: p.cx - p.sirka / 2, y: p.cy - v / 2, w: p.sirka, h: v };
  }

  function hraniceVsech(objekty) {
    if (!objekty.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const o of objekty) {
      const h = hranice(o);
      x0 = Math.min(x0, h.x); y0 = Math.min(y0, h.y);
      x1 = Math.max(x1, h.x + h.w); y1 = Math.max(y1, h.y + h.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  const prekryva = (a, b) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
  const obsahuje = (vnejsi, h) => h.x >= vnejsi.x && h.y >= vnejsi.y && h.x + h.w <= vnejsi.x + vnejsi.w && h.y + h.h <= vnejsi.y + vnejsi.h;

  const sirkaCary = o => o.typ === 'tah' && o.zvyr ? Math.max(8, o.sirka * 3) : (o.sirka || 0);
  const delkaSipky = o => Math.max(12, o.sirka * 3);

  // ---------- zásah myší ----------
  function vzdUsecka(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  function vzdLomena(px, py, b, uzavrit) {
    let m = Infinity;
    const n = b.length;
    for (let i = 0; i + 3 < n; i += 2) m = Math.min(m, vzdUsecka(px, py, b[i], b[i + 1], b[i + 2], b[i + 3]));
    if (uzavrit && n >= 4) m = Math.min(m, vzdUsecka(px, py, b[n - 2], b[n - 1], b[0], b[1]));
    if (n === 2) m = Math.hypot(px - b[0], py - b[1]);
    return m;
  }

  function uvnitrMnohouhelniku(px, py, b) {
    let ano = false;
    for (let i = 0, j = b.length - 2; i < b.length; j = i, i += 2) {
      if ((b[i + 1] > py) !== (b[j + 1] > py) &&
          px < (b[j] - b[i]) * (py - b[i + 1]) / (b[j + 1] - b[i + 1]) + b[i]) ano = !ano;
    }
    return ano;
  }

  function obrysTvaru(o) {
    const { x, y, w, h } = o;
    switch (o.druh) {
      case 'kosoctverec': return [x + w / 2, y, x + w, y + h / 2, x + w / 2, y + h, x, y + h / 2];
      case 'trojuhelnik': return [x + w / 2, y, x + w, y + h, x, y + h];
      case 'sestiuhelnik': return [x + w * 0.25, y, x + w * 0.75, y, x + w, y + h / 2, x + w * 0.75, y + h, x + w * 0.25, y + h, x, y + h / 2];
      case 'hvezda': {
        const b = [], cx = x + w / 2, cy = y + h / 2;
        for (let i = 0; i < 10; i++) {
          const u = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.4 : 1;
          b.push(cx + Math.cos(u) * w / 2 * r, cy + Math.sin(u) * h / 2 * r + h * 0.05);
        }
        return b;
      }
      default: return [x, y, x + w, y, x + w, y + h, x, y + h];
    }
  }
  const polomerZaobleni = o => Math.min(24, o.w / 4, o.h / 4);

  function zasah(o, px, py, tol) {
    const hr = hranice(o);
    if (px < hr.x - tol || py < hr.y - tol || px > hr.x + hr.w + tol || py > hr.y + hr.h + tol) return false;
    const s = sirkaCary(o) / 2 + tol;
    switch (o.typ) {
      case 'tah': return vzdLomena(px, py, o.body, false) <= polomerTahu(o) + tol;
      case 'krivka': {
        const v = vzorkyKrivky(o);
        if (o.uzavrena && o.vypln && uvnitrMnohouhelniku(px, py, v)) return true;
        return vzdLomena(px, py, v, false) <= s;
      }
      case 'oblast': return o.kruhy.reduce((a, k) => a !== uvnitrMnohouhelniku(px, py, k), false);
      case 'cara': {
        if (vzdLomena(px, py, bodyCary(o), false) <= s) return true;
        const r = obdelnikPopisku(o);
        return !!r && px >= r.x - tol && px <= r.x + r.w + tol && py >= r.y - tol && py <= r.y + r.h + tol;
      }
      case 'tvar': {
        const plny = o.vypln || o.text;
        if (o.druh === 'elipsa') {
          const rx = o.w / 2, ry = o.h / 2;
          if (rx < 0.5 || ry < 0.5) return true;
          const nx = (px - o.x - rx) / rx, ny = (py - o.y - ry) / ry;
          const r = Math.hypot(nx, ny);
          if (plny && r <= 1) return true;
          return Math.abs(r - 1) * Math.min(rx, ry) <= s;
        }
        const b = obrysTvaru(o);
        if (plny && uvnitrMnohouhelniku(px, py, b)) return true;
        return vzdLomena(px, py, b, true) <= s;
      }
      case 'ram': {
        // rám se chytá jen za okraj a titulek – vnitřek patří obsahu
        const t = Math.max(mer(o.nazev || '', TITULEK_RAMU), 40);
        if (px >= o.x && px <= o.x + t && py >= o.y - TITULEK_RAMU * 1.6 && py <= o.y) return true;
        return vzdLomena(px, py, obrysTvaru(o), true) <= tol + 2;
      }
      default: return true;      // text, lístek, obrázek – celý obdélník
    }
  }

  // nejvrchnější objekt pod bodem (rámy až po ostatních – leží vespod)
  function najdi(objekty, px, py, tol, preskoc) {
    let ram = null;
    for (let i = objekty.length - 1; i >= 0; i--) {
      const o = objekty[i];
      if (preskoc && preskoc(o)) continue;
      if (!zasah(o, px, py, tol)) continue;
      if (o.typ !== 'ram') return o;
      if (!ram) ram = o;
    }
    return ram;
  }

  // ---------- spojnice ----------
  function stred(o) { const h = hraniceHole(o); return { x: h.x + h.w / 2, y: h.y + h.h / 2 }; }

  // průsečík paprsku ze středu objektu k bodu (tx, ty) s jeho obrysem + mezera
  function prusecik(o, tx, ty, mezera) {
    const h = hraniceHole(o), cx = h.x + h.w / 2, cy = h.y + h.h / 2;
    const dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
    if (d < 1e-9) return { x: cx, y: cy };
    let t;
    if (o.typ === 'tvar' && o.druh === 'elipsa') {
      t = 1 / Math.hypot(dx / Math.max(h.w / 2, 1e-9), dy / Math.max(h.h / 2, 1e-9));
    } else if (o.typ === 'tvar' && !['obdelnik', 'zaobleny'].includes(o.druh)) {
      const b = obrysTvaru(o);
      t = 0;
      for (let i = 0; i < b.length; i += 2) {
        const ax = b[i], ay = b[i + 1], bx = b[(i + 2) % b.length], by = b[(i + 3) % b.length];
        const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const tt = ((ax - cx) * ey - (ay - cy) * ex) / den, u = ((ax - cx) * dy - (ay - cy) * dx) / den;
        if (tt > 0 && u >= 0 && u <= 1) t = Math.max(t, tt);
      }
    } else {
      t = Math.min(Math.abs(dx) > 1e-9 ? h.w / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? h.h / 2 / Math.abs(dy) : Infinity);
    }
    return { x: cx + dx * t + dx / d * mezera, y: cy + dy * t + dy / d * mezera };
  }

  function bodNaStrane(o, osa, smer, mezera) {
    const h = hraniceHole(o);
    if (osa === 'x') return { x: smer > 0 ? h.x + h.w + mezera : h.x - mezera, y: h.y + h.h / 2 };
    return { x: h.x + h.w / 2, y: smer > 0 ? h.y + h.h + mezera : h.y - mezera };
  }

  const lzePripojit = o => o && o.typ !== 'cara' && o.typ !== 'tah' && o.typ !== 'oblast';

  // přepočítá konce připojených čar (cary = jen tyto, jinak všechny)
  function prepoj(objekty, cary) {
    let mapa = null;
    for (const c of cary || objekty) {
      if (c.typ !== 'cara' || (!c.zac && !c.kon)) continue;
      if (!mapa) mapa = new Map(objekty.map(o => [o.id, o]));
      const A = c.zac ? mapa.get(c.zac) : null, B = c.kon ? mapa.get(c.kon) : null;
      if (c.zac && (!lzePripojit(A) || A === B)) c.zac = null;
      if (c.kon && (!lzePripojit(B) || A === B)) c.kon = null;
      const a = c.zac ? A : null, b = c.kon ? B : null;
      if (!a && !b) continue;
      const ca = a ? stred(a) : { x: c.x1, y: c.y1 }, cb = b ? stred(b) : { x: c.x2, y: c.y2 };
      const mez = MEZERA_SPOJNICE + (c.sirka || 0) / 2;
      let p1, p2;
      if (c.trasa === 'lomena') {
        const osa = Math.abs(cb.x - ca.x) >= Math.abs(cb.y - ca.y) ? 'x' : 'y';
        c.osa = osa;
        const sm = osa === 'x' ? Math.sign(cb.x - ca.x) || 1 : Math.sign(cb.y - ca.y) || 1;
        p1 = a ? bodNaStrane(a, osa, sm, mez) : ca;
        p2 = b ? bodNaStrane(b, osa, -sm, mez) : cb;
      } else {
        p1 = a ? prusecik(a, cb.x, cb.y, mez) : ca;
        p2 = b ? prusecik(b, ca.x, ca.y, mez) : cb;
      }
      if (c.x1 !== p1.x || c.y1 !== p1.y || c.x2 !== p2.x || c.y2 !== p2.y) {
        c.x1 = p1.x; c.y1 = p1.y; c.x2 = p2.x; c.y2 = p2.y;
        zneplatni(c);
      }
    }
  }

  // kopie objektů s novými id; spojnice a skupiny se přemapují uvnitř kopie
  function klonuj(objekty) {
    const ids = new Map(objekty.map(o => [o.id, noveId()]));
    const skup = new Map();
    return objekty.map(o => {
      const k = JSON.parse(JSON.stringify(o));
      k.id = ids.get(o.id);
      if (k.zac) k.zac = ids.get(k.zac) || null;
      if (k.kon) k.kon = ids.get(k.kon) || null;
      if (k.skupina) { if (!skup.has(k.skupina)) skup.set(k.skupina, 'g' + noveId()); k.skupina = skup.get(k.skupina); }
      return k;
    });
  }

  // ---------- voditka ----------
  // posun (dx, dy) hranice h tak, aby hrany/středy lícovaly s ostatními; tol ve světových jednotkách
  function voditka(h, dx, dy, ostatni, tol) {
    const sx = [h.x + dx, h.x + dx + h.w / 2, h.x + dx + h.w], sy = [h.y + dy, h.y + dy + h.h / 2, h.y + dy + h.h];
    let bx = null, by = null;
    for (const o of ostatni) {
      const q = hranice(o);
      const cx = [q.x, q.x + q.w / 2, q.x + q.w], cy = [q.y, q.y + q.h / 2, q.y + q.h];
      for (const c of cx) for (const s of sx) { const d = c - s; if (Math.abs(d) <= tol && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, c }; }
      for (const c of cy) for (const s of sy) { const d = c - s; if (Math.abs(d) <= tol && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, c }; }
    }
    return { dx: dx + (bx ? bx.d : 0), dy: dy + (by ? by.d : 0), x: bx && bx.c, y: by && by.c };
  }

  // ---------- transformace ----------
  function premisti(o, dx, dy) {
    if (o.typ === 'tah' || o.typ === 'krivka' || o.typ === 'oblast') proBody(o, (b, i) => { b[i] += dx; b[i + 1] += dy; });
    else if (o.typ === 'cara') { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; }
    else { o.x += dx; o.y += dy; }
    zneplatni(o);
  }

  // změna velikosti kolem kotvy (ax, ay); u textu se mění velikost písma (|sy|)
  function skaluj(o, ax, ay, sx, sy) {
    const X = x => ax + (x - ax) * sx, Y = y => ay + (y - ay) * sy;
    if (o.typ === 'tah' || o.typ === 'krivka' || o.typ === 'oblast') proBody(o, (b, i) => { b[i] = X(b[i]); b[i + 1] = Y(b[i + 1]); });
    else if (o.typ === 'cara') { o.x1 = X(o.x1); o.y1 = Y(o.y1); o.x2 = X(o.x2); o.y2 = Y(o.y2); }
    else if (o.typ === 'text') {
      const s = Math.abs(sy) || Math.abs(sx);
      const h = hraniceHole(o);
      o.velikost = Math.max(4, o.velikost * s);
      o.x = Math.min(X(h.x), X(h.x + h.w)); o.y = Math.min(Y(h.y), Y(h.y + h.h));
    } else {
      const x1 = X(o.x), x2 = X(o.x + o.w), y1 = Y(o.y), y2 = Y(o.y + o.h);
      o.x = Math.min(x1, x2); o.y = Math.min(y1, y2);
      o.w = Math.abs(x2 - x1); o.h = Math.abs(y2 - y1);
    }
    zneplatni(o);
  }

  // vynechá body bližší než prah (zmenší tah bez viditelné změny)
  function zredukuj(body, prah) {
    if (body.length <= 4) return body.slice();
    const ven = [body[0], body[1]];
    let px = body[0], py = body[1];
    for (let i = 2; i < body.length - 2; i += 2) {
      if (Math.hypot(body[i] - px, body[i + 1] - py) >= prah) { ven.push(body[i], body[i + 1]); px = body[i]; py = body[i + 1]; }
    }
    ven.push(body[body.length - 2], body[body.length - 1]);
    return ven.map(v => Math.round(v * 10) / 10);
  }

  // Shift: čáry po 45°, tvary čtvercové
  function omez(typ, x0, y0, x, y) {
    const dx = x - x0, dy = y - y0;
    if (typ === 'cara') {
      const d = Math.hypot(dx, dy), u = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      return { x: x0 + Math.cos(u) * d, y: y0 + Math.sin(u) * d };
    }
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: x0 + Math.sign(dx || 1) * s, y: y0 + Math.sign(dy || 1) * s };
  }

  // zarovnání a rozmístění vybraných objektů
  function zarovnej(objekty, jak) {
    if (objekty.length < 2) return;
    const c = hraniceVsech(objekty);
    for (const o of objekty) {
      const h = hranice(o);
      const dx = jak === 'vlevo' ? c.x - h.x : jak === 'vpravo' ? c.x + c.w - h.x - h.w : jak === 'stredX' ? c.x + c.w / 2 - h.x - h.w / 2 : 0;
      const dy = jak === 'nahoru' ? c.y - h.y : jak === 'dolu' ? c.y + c.h - h.y - h.h : jak === 'stredY' ? c.y + c.h / 2 - h.y - h.h / 2 : 0;
      if (dx || dy) premisti(o, dx, dy);
    }
  }

  function rozmisti(objekty, osa) {
    if (objekty.length < 3) return;
    const X = osa === 'x';
    const s = objekty.slice().sort((a, b) => X ? hranice(a).x - hranice(b).x : hranice(a).y - hranice(b).y);
    const c = hraniceVsech(s);
    const soucet = s.reduce((t, o) => t + (X ? hranice(o).w : hranice(o).h), 0);
    const mezera = ((X ? c.w : c.h) - soucet) / (s.length - 1);
    let poz = X ? c.x : c.y;
    for (const o of s) {
      const h = hranice(o);
      premisti(o, X ? poz - h.x : 0, X ? 0 : poz - h.y);
      poz += (X ? h.w : h.h) + mezera;
    }
  }

  // rámy v pořadí snímků: po řádcích shora, v řádku zleva
  function poradiRamu(objekty) {
    const ramy = objekty.filter(o => o.typ === 'ram').sort((a, b) => a.y - b.y);
    const radky = [];
    for (const r of ramy) {
      const posl = radky[radky.length - 1];
      if (posl && r.y - posl.y0 < posl.hmin / 2) { posl.ramy.push(r); posl.hmin = Math.min(posl.hmin, r.h); }
      else radky.push({ y0: r.y, hmin: r.h, ramy: [r] });
    }
    return radky.flatMap(r => r.ramy.sort((a, b) => a.x - b.x));
  }

  // ---------- barvy ----------
  function jas(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 1;
    const n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }
  const textNaPodklad = hex => jas(hex) > 0.55 ? '#1e1e1e' : '#ffffff';
  const barvaPopisku = o => o.typ === 'tvar' && o.vypln ? textNaPodklad(o.vypln) : o.barva;

  function carkovani(o) {
    const s = Math.max(1, o.sirka);
    if (o.styl === 'carky') return [s * 4, s * 3];
    if (o.styl === 'tecky') return [0.01, s * 2.2];
    return [];
  }

  // ---------- štětce ----------
  const STETCE = ['fix', 'stetec', 'kaligrafie', 'sprej'];
  function polomerTahu(o) {
    if (o.stetec === 'sprej') return o.sirka * 2 + 2;
    if (o.stetec === 'stetec') return o.sirka * 0.75 + 1;
    if (o.stetec === 'kaligrafie') return o.sirka / 2 + 1;
    return sirkaCary(o) / 2;
  }
  function okrajObjektu(o) {
    if (o.typ === 'tah') return polomerTahu(o);
    if (o.typ === 'cara') return sirkaCary(o) / 2 + (o.sipkaZ || o.sipkaK ? delkaSipky(o) / 2 : 0);
    if (o.typ === 'tvar') return sirkaCary(o) / 2;
    if (o.typ === 'krivka') return sirkaCary(o) / 2;
    return 0;
  }
  // všechny body objektu po dvojicích (tah, křivka, plocha z kbelíku)
  function proBody(o, fn) {
    if (o.typ === 'oblast') { for (const k of o.kruhy) for (let i = 0; i < k.length; i += 2) fn(k, i); }
    else for (let i = 0; i < o.body.length; i += 2) fn(o.body, i);
  }

  // pseudonáhodná čísla se semínkem – sprej vypadá po každém překreslení stejně
  function nahoda(semeno) {
    let a = semeno >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const semenoId = id => { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

  const cesty = new WeakMap();      // spočtené tvary štětců (maže je zneplatni)

  // kapky spreje: [x, y, velikost, …] v pravidelných krocích podél tahu
  function kapkySpreje(o) {
    let k = cesty.get(o);
    if (k) return k;
    const b = o.body, r = o.sirka * 2, vel = Math.max(0.8, o.sirka * 0.09);
    let delka = 0;
    for (let i = 2; i < b.length; i += 2) delka += Math.hypot(b[i] - b[i - 2], b[i + 1] - b[i - 1]);
    const krok = Math.max(1, o.sirka * 0.35, delka / 20000);     // nejvýš ~140 tisíc kapek
    const rnd = nahoda(semenoId(o.id));
    k = [];
    const pridej = (x, y) => {
      for (let j = 0; j < 7; j++) {
        const u = rnd() * Math.PI * 2, d = r * Math.sqrt(rnd());
        k.push(x + Math.cos(u) * d, y + Math.sin(u) * d, vel * (0.6 + rnd() * 0.8));
      }
    };
    pridej(b[0], b[1]);
    let t = krok;
    for (let i = 2; i < b.length; i += 2) {
      const dx = b[i] - b[i - 2], dy = b[i + 1] - b[i - 1], d = Math.hypot(dx, dy);
      while (t < d) { pridej(b[i - 2] + dx * t / d, b[i - 1] + dy * t / d); t += krok; }
      t -= d;
    }
    cesty.set(o, k);
    return k;
  }

  // obrys štětce s proměnnou šířkou: levá strana tam, pravá zpět
  function obrysStetce(o) {
    let k = cesty.get(o);
    if (k) return k;
    const b = o.body, n = b.length / 2, tl = o.tl || [], w = o.sirka * 0.75;
    const sir = i => w * (tl[i] == null ? 1 : tl[i]);
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), c = Math.min(n - 1, i + 1);
      let dx = b[2 * c] - b[2 * a], dy = b[2 * c + 1] - b[2 * a + 1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const r = sir(i);
      L.push(b[2 * i] - dy * r, b[2 * i + 1] + dx * r);
      R.push(b[2 * i] + dy * r, b[2 * i + 1] - dx * r);
    }
    const obrys = L.slice();
    for (let i = R.length - 2; i >= 0; i -= 2) obrys.push(R[i], R[i + 1]);
    k = { obrys, rZac: sir(0), rKon: sir(n - 1) };
    cesty.set(o, k);
    return k;
  }

  // kaligrafické pero: plochý hrot pod 45°, čtyřúhelník na každý úsek
  function ctyruhelnikyKaligrafie(o) {
    const b = o.body, vx = Math.cos(-Math.PI / 4) * o.sirka / 2, vy = Math.sin(-Math.PI / 4) * o.sirka / 2, q = [];
    if (b.length === 2) return [[b[0] + vx, b[1] + vy, b[0] + vx + 0.5, b[1] + vy, b[0] - vx + 0.5, b[1] - vy, b[0] - vx, b[1] - vy]];
    for (let i = 2; i < b.length; i += 2) q.push([b[i - 2] + vx, b[i - 1] + vy, b[i] + vx, b[i + 1] + vy, b[i] - vx, b[i + 1] - vy, b[i - 2] - vx, b[i - 1] - vy]);
    return q;
  }

  // ---------- křivka: hladká = Catmull-Rom (prochází klikanými body) ----------
  function segmentyKrivky(o) {      // [x0,y0, c1x,c1y, c2x,c2y, x1,y1]
    const b = o.body, n = b.length / 2, s = [];
    const P = i => {
      const j = o.uzavrena ? (i + n) % n : Math.max(0, Math.min(n - 1, i));
      return [b[2 * j], b[2 * j + 1]];
    };
    const m = o.uzavrena ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      s.push([p1[0], p1[1], p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]]);
    }
    return s;
  }
  // body podél křivky (zásah myší, výplň)
  function vzorkyKrivky(o) {
    const b = o.body;
    if (!o.hladka || b.length < 6) return o.uzavrena ? b.concat([b[0], b[1]]) : b;
    const v = [];
    for (const [x0, y0, ax, ay, bx, by, x1, y1] of segmentyKrivky(o)) {
      for (let k = 0; k < 10; k++) {
        const t = k / 10, u = 1 - t;
        v.push(u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x1,
          u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y1);
      }
    }
    if (o.uzavrena) v.push(b[0], b[1]); else v.push(b[b.length - 2], b[b.length - 1]);
    return v;
  }
  function cestaKrivky(ctx, o) {
    const b = o.body;
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    if (o.hladka && b.length >= 6) for (const s of segmentyKrivky(o)) ctx.bezierCurveTo(s[2], s[3], s[4], s[5], s[6], s[7]);
    else for (let i = 2; i < b.length; i += 2) ctx.lineTo(b[i], b[i + 1]);
    if (o.uzavrena) ctx.closePath();
  }
  function cestaKrivkySVG(o) {
    const b = o.body;
    let d = `M${c1(b[0])},${c1(b[1])}`;
    if (o.hladka && b.length >= 6) for (const s of segmentyKrivky(o)) d += ` C${c1(s[2])},${c1(s[3])} ${c1(s[4])},${c1(s[5])} ${c1(s[6])},${c1(s[7])}`;
    else for (let i = 2; i < b.length; i += 2) d += ` L${c1(b[i])},${c1(b[i + 1])}`;
    return d + (o.uzavrena ? ' Z' : '');
  }

  // ---------- kbelík: zaplavení oblasti v rastru → vektorový obrys ----------
  // Douglas–Peucker pro lomenou čáru [x,y,…]
  function zjednodus(b, tol) {
    const n = b.length / 2;
    if (n <= 2) return b.slice();
    const drz = new Uint8Array(n);
    drz[0] = drz[n - 1] = 1;
    const zas = [[0, n - 1]];
    while (zas.length) {
      const [a, z] = zas.pop();
      let max = -1, im = -1;
      for (let i = a + 1; i < z; i++) {
        const d = vzdUsecka(b[2 * i], b[2 * i + 1], b[2 * a], b[2 * a + 1], b[2 * z], b[2 * z + 1]);
        if (d > max) { max = d; im = i; }
      }
      if (max > tol) { drz[im] = 1; zas.push([a, im], [im, z]); }
    }
    const ven = [];
    for (let i = 0; i < n; i++) if (drz[i]) ven.push(b[2 * i], b[2 * i + 1]);
    return ven;
  }

  // rozšíření masky o r pixelů (čtvercové okolí, dva průchody s klouzavým oknem)
  function rozsir(m, W, H, r) {
    if (r <= 0) return m;
    const t = new Uint8Array(W * H), v = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const o = y * W;
      let pocet = 0;
      for (let x = -r; x < W; x++) {
        if (x + r < W && m[o + x + r]) pocet++;
        if (x - r - 1 >= 0 && m[o + x - r - 1]) pocet--;
        if (x >= 0) t[o + x] = pocet > 0 ? 1 : 0;
      }
    }
    for (let x = 0; x < W; x++) {
      let pocet = 0;
      for (let y = -r; y < H; y++) {
        if (y + r < H && t[(y + r) * W + x]) pocet++;
        if (y - r - 1 >= 0 && t[(y - r - 1) * W + x]) pocet--;
        if (y >= 0) v[y * W + x] = pocet > 0 ? 1 : 0;
      }
    }
    return v;
  }

  // data = RGBA vykreslené scény; zeď = barva jiná než v bodě kliknutí (o víc než tol).
  // mezera = škvíry do této šířky (px) se berou jako zavřené. Vrátí masku oblasti
  // (o pixel přesahující pod okraje), nebo null, když oblast dosáhne okraje obrázku.
  function zaplav(data, W, H, sx, sy, tol = 48, mezera = 0) {
    sx = Math.floor(sx); sy = Math.floor(sy);
    if (sx < 1 || sy < 1 || sx >= W - 1 || sy >= H - 1) return null;
    const N = W * H, i0 = (sy * W + sx) * 4;
    const r0 = data[i0], g0 = data[i0 + 1], b0 = data[i0 + 2], a0 = data[i0 + 3];
    const zedPuv = new Uint8Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      if (Math.abs(data[j] - r0) > tol || Math.abs(data[j + 1] - g0) > tol || Math.abs(data[j + 2] - b0) > tol || Math.abs(data[j + 3] - a0) > tol) zedPuv[i] = 1;
    }
    let zed = zedPuv;
    if (mezera > 0) {
      zed = rozsir(zedPuv, W, H, mezera);
      if (zed[sy * W + sx]) { zed = zedPuv; mezera = 0; }      // klik do úzké škvíry – bez zavírání mezer
    }
    const m = new Uint8Array(N), zasob = new Int32Array(N);
    let vrch = 0;
    m[sy * W + sx] = 1; zasob[vrch++] = sy * W + sx;
    while (vrch) {
      const i = zasob[--vrch], x = i % W;
      if (x === 0 || x === W - 1 || i < W || i >= N - W) return null;
      if (!m[i - 1] && !zed[i - 1]) { m[i - 1] = 1; zasob[vrch++] = i - 1; }
      if (!m[i + 1] && !zed[i + 1]) { m[i + 1] = 1; zasob[vrch++] = i + 1; }
      if (!m[i - W] && !zed[i - W]) { m[i - W] = 1; zasob[vrch++] = i - W; }
      if (!m[i + W] && !zed[i + W]) { m[i + W] = 1; zasob[vrch++] = i + W; }
    }
    // zpět k původním okrajům (jen přes nezeď, aby výplň nepřelezla tenkou čáru)
    let ven = m;
    for (let k = 0; k < mezera; k++) {
      const d = rozsir(ven, W, H, 1);
      for (let i = 0; i < N; i++) if (zedPuv[i] && !ven[i]) d[i] = 0;
      ven = d;
    }
    return rozsir(ven, W, H, 1);       // o pixel pod okraj – bez světlého lemu u vyhlazených čar
  }

  // obrysy masky po hranách pixelů → uzavřené smyčky [x,y,…] (pixely)
  function obrysy(m, W, H) {
    const W1 = W + 1, dalsi = new Map();
    const hrana = (x0, y0, x1, y1) => {
      const a = y0 * W1 + x0, b = y1 * W1 + x1, l = dalsi.get(a);
      if (l === undefined) dalsi.set(a, b);
      else if (Array.isArray(l)) l.push(b);
      else dalsi.set(a, [l, b]);
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!m[i]) continue;
        if (y === 0 || !m[i - W]) hrana(x, y, x + 1, y);
        if (x === W - 1 || !m[i + 1]) hrana(x + 1, y, x + 1, y + 1);
        if (y === H - 1 || !m[i + W]) hrana(x + 1, y + 1, x, y + 1);
        if (x === 0 || !m[i - 1]) hrana(x, y + 1, x, y);
      }
    }
    const vezmi = a => {
      const l = dalsi.get(a);
      if (l === undefined) return -1;
      if (!Array.isArray(l)) { dalsi.delete(a); return l; }
      const b = l.pop();
      if (l.length === 1) dalsi.set(a, l[0]);
      return b;
    };
    const smycky = [];
    while (dalsi.size) {
      const start = dalsi.keys().next().value;
      const b = [];
      let cur = start;
      do {
        b.push(cur % W1, (cur - cur % W1) / W1);
        cur = vezmi(cur);
      } while (cur !== start && cur !== -1);
      // vynechat body uprostřed rovných úseků
      const c = [];
      const n = b.length / 2;
      for (let i = 0; i < n; i++) {
        const p = (i + n - 1) % n, q = (i + 1) % n;
        const rovne = (b[2 * p] === b[2 * i] && b[2 * i] === b[2 * q]) || (b[2 * p + 1] === b[2 * i + 1] && b[2 * i + 1] === b[2 * q + 1]);
        if (!rovne) c.push(b[2 * i], b[2 * i + 1]);
      }
      if (c.length >= 6) smycky.push(c);
    }
    return smycky;
  }

  // ---------- rozpoznání tvaru z tahu ----------
  // → null | {typ:'cara',x1..} | {typ:'tvar',druh,x,y,w,h} | {typ:'krivka',body,uzavrena:true}
  function rozpoznej(b) {
    const n = b.length / 2;
    if (n < 4) return null;
    let delka = 0;
    for (let i = 2; i < b.length; i += 2) delka += Math.hypot(b[i] - b[i - 2], b[i + 1] - b[i - 1]);
    const h = hraniceHole({ typ: 'tah', body: b }), diag = Math.hypot(h.w, h.h);
    if (diag < 15) return null;
    const ch = Math.hypot(b[b.length - 2] - b[0], b[b.length - 1] - b[1]);
    if (delka < ch * 1.06) return { typ: 'cara', x1: b[0], y1: b[1], x2: b[b.length - 2], y2: b[b.length - 1] };
    if (ch > delka * 0.2) return null;                      // neuzavřený tah
    const cx = h.x + h.w / 2, cy = h.y + h.h / 2, rx = h.w / 2, ry = h.h / 2;
    let chyba = 1;
    if (rx > 3 && ry > 3) {
      chyba = 0;
      for (let i = 0; i < b.length; i += 2) chyba += Math.abs(Math.hypot((b[i] - cx) / rx, (b[i + 1] - cy) / ry) - 1);
      chyba /= n;
    }
    const elipsa = { typ: 'tvar', druh: 'elipsa', x: h.x, y: h.y, w: h.w, h: h.h };
    if (chyba < 0.08) return elipsa;
    // rohy: zjednodušení uzavřeného tahu a vynechání bodů na přímce (začátek uprostřed hrany)
    const tol = diag * 0.08;
    let r = zjednodus(b.concat([b[0], b[1]]), tol).slice(0, -2);
    for (let opak = true; opak && r.length > 6;) {
      opak = false;
      const k = r.length / 2;
      for (let i = 0; i < k; i++) {
        const p = (i + k - 1) % k, q = (i + 1) % k;
        if (vzdUsecka(r[2 * i], r[2 * i + 1], r[2 * p], r[2 * p + 1], r[2 * q], r[2 * q + 1]) < tol) { r.splice(2 * i, 2); opak = true; break; }
      }
    }
    const k = r.length / 2;
    if (k === 4) {
      let osove = true;
      for (let i = 0; i < 4; i++) {
        const dx = r[(2 * i + 2) % 8] - r[2 * i], dy = r[(2 * i + 3) % 8] - r[2 * i + 1];
        const u = Math.abs(Math.atan2(dy, dx)) % (Math.PI / 2);
        if (Math.min(u, Math.PI / 2 - u) > 0.22) osove = false;
      }
      if (osove) return { typ: 'tvar', druh: 'obdelnik', x: h.x, y: h.y, w: h.w, h: h.h };
    }
    if (k >= 3 && k <= 6) return { typ: 'krivka', body: r, uzavrena: true };
    if (chyba < 0.16) return elipsa;
    return null;
  }

  // ---------- symetrické kreslení ----------
  // vrátí transformace (bez identity) kolem středu (cx, cy)
  function symetrie(rezim, cx, cy) {
    const t = [];
    const otoc = (n, zrcadlit) => {
      for (let k = 0; k < n; k++) {
        const u = 2 * Math.PI * k / n, c = Math.cos(u), s = Math.sin(u);
        if (k) t.push((x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
        if (zrcadlit) t.push((x, y) => { const mx = cx - x; return [cx + mx * c - (y - cy) * s, cy + mx * s + (y - cy) * c]; });
      }
    };
    if (rezim === 'svisle') t.push((x, y) => [2 * cx - x, y]);
    else if (rezim === 'vodorovne') t.push((x, y) => [x, 2 * cy - y]);
    else if (rezim === 'kaleidoskop') otoc(6, true);
    else if (+rezim > 1) otoc(+rezim, false);
    return t;
  }
  function transformuj(o, f) {
    proBody(o, (b, i) => { const [x, y] = f(b[i], b[i + 1]); b[i] = x; b[i + 1] = y; });
    zneplatni(o);
  }


  // ---------- kreslení na plátno ----------
  function cestaTahu(ctx, b) {
    ctx.moveTo(b[0], b[1]);
    if (b.length === 4) { ctx.lineTo(b[2], b[3]); return; }
    for (let i = 2; i < b.length - 2; i += 2) {
      ctx.quadraticCurveTo(b[i], b[i + 1], (b[i] + b[i + 2]) / 2, (b[i + 1] + b[i + 3]) / 2);
    }
    ctx.lineTo(b[b.length - 2], b[b.length - 1]);
  }

  function hrotSipky(x1, y1, x2, y2, d) {
    const u = Math.atan2(y2 - y1, x2 - x1);
    return [x2, y2,
      x2 - d * Math.cos(u - Math.PI / 6), y2 - d * Math.sin(u - Math.PI / 6),
      x2 - d * Math.cos(u + Math.PI / 6), y2 - d * Math.sin(u + Math.PI / 6)];
  }

  function hrotyCary(o) {
    const b = bodyCary(o), d = delkaSipky(o), ven = [];
    if (o.sipkaK) { const s = smerKonce(b, true); ven.push(hrotSipky(s[0], s[1], s[2], s[3], d)); }
    if (o.sipkaZ) { const s = smerKonce(b, false); ven.push(hrotSipky(s[0], s[1], s[2], s[3], d)); }
    return ven;
  }

  function cestaTvaru(ctx, o) {
    ctx.beginPath();
    if (o.druh === 'elipsa') ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
    else if (o.druh === 'zaobleny') {
      const r = polomerZaobleni(o);
      if (ctx.roundRect) ctx.roundRect(o.x, o.y, o.w, o.h, r);
      else ctx.rect(o.x, o.y, o.w, o.h);
    } else { const b = obrysTvaru(o); ctx.moveTo(b[0], b[1]); for (let i = 2; i < b.length; i += 2) ctx.lineTo(b[i], b[i + 1]); ctx.closePath(); }
  }

  function kresliRadky(ctx, radky, cx, cy, lh) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    radky.forEach((t, i) => ctx.fillText(t, cx, cy + (i - (radky.length - 1) / 2) * lh));
  }

  // env: { obrazek(id) → Image|null, pozadi, bezRamu }
  function kresli(ctx, o, env) {
    if (o.typ === 'ram' && env && env.bezRamu) return;
    ctx.save();
    ctx.globalAlpha = (o.alfa == null ? 1 : o.alfa) * (o.typ === 'tah' && o.zvyr ? ZVYR_ALFA : 1);
    ctx.strokeStyle = ctx.fillStyle = o.barva;
    ctx.lineWidth = sirkaCary(o);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (o.typ) {
      case 'tah': {
        const b = o.body;
        if (o.stetec === 'sprej') {
          const k = kapkySpreje(o);
          ctx.beginPath();
          for (let i = 0; i < k.length; i += 3) ctx.rect(k[i] - k[i + 2] / 2, k[i + 1] - k[i + 2] / 2, k[i + 2], k[i + 2]);
          ctx.fill();
          break;
        }
        if (o.stetec === 'kaligrafie') {
          ctx.beginPath();
          for (const q of ctyruhelnikyKaligrafie(o)) { ctx.moveTo(q[0], q[1]); for (let i = 2; i < 8; i += 2) ctx.lineTo(q[i], q[i + 1]); ctx.closePath(); }
          ctx.fill(); ctx.lineWidth = 0.75; ctx.stroke();
          break;
        }
        if (o.stetec === 'stetec' && b.length >= 4) {
          const s = obrysStetce(o), ob = s.obrys, n = b.length;
          ctx.beginPath(); ctx.moveTo(ob[0], ob[1]);
          for (let i = 2; i < ob.length; i += 2) ctx.lineTo(ob[i], ob[i + 1]);
          ctx.closePath();
          ctx.moveTo(b[0] + s.rZac, b[1]); ctx.arc(b[0], b[1], s.rZac, 0, Math.PI * 2);
          ctx.moveTo(b[n - 2] + s.rKon, b[n - 1]); ctx.arc(b[n - 2], b[n - 1], s.rKon, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        if (b.length === 2) { ctx.beginPath(); ctx.arc(b[0], b[1], Math.max(ctx.lineWidth / 2, 0.5), 0, Math.PI * 2); ctx.fill(); break; }
        ctx.beginPath(); cestaTahu(ctx, b); ctx.stroke();
        break;
      }
      case 'krivka': {
        if (o.body.length < 4) break;
        cestaKrivky(ctx, o);
        if (o.vypln && o.uzavrena) { ctx.fillStyle = o.vypln; ctx.fill(); }
        if (o.sirka > 0) { ctx.setLineDash(carkovani(o)); ctx.stroke(); ctx.setLineDash([]); }
        break;
      }
      case 'oblast': {
        ctx.beginPath();
        for (const k of o.kruhy) { ctx.moveTo(k[0], k[1]); for (let i = 2; i < k.length; i += 2) ctx.lineTo(k[i], k[i + 1]); ctx.closePath(); }
        ctx.fill('evenodd');
        break;
      }
      case 'cara': {
        const b = bodyCary(o);
        ctx.setLineDash(carkovani(o));
        ctx.beginPath(); ctx.moveTo(b[0], b[1]);
        for (let i = 2; i < b.length; i += 2) ctx.lineTo(b[i], b[i + 1]);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const h of hrotyCary(o)) { ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(h[2], h[3]); ctx.lineTo(h[4], h[5]); ctx.closePath(); ctx.fill(); }
        if (o.text) {
          const m = stredCary(o), vel = o.velikost || 20, radky = radkyTextu(o);
          ctx.font = pismo(o);
          const w = sirkaRadku(radky, vel, o.pismo) + vel * 0.6, h = radky.length * vel * RADEK;
          if (env && env.pozadi) { ctx.fillStyle = env.pozadi; ctx.fillRect(m.x - w / 2, m.y - h / 2, w, h); }
          ctx.fillStyle = o.barva;
          kresliRadky(ctx, radky, m.x, m.y, vel * RADEK);
        }
        break;
      }
      case 'tvar': {
        cestaTvaru(ctx, o);
        if (o.vypln) { ctx.fillStyle = o.vypln; ctx.fill(); }
        if (o.sirka > 0) { ctx.setLineDash(carkovani(o)); ctx.stroke(); ctx.setLineDash([]); }
        if (o.text) {
          const p = popisekTvaru(o);
          ctx.font = pismo(o); ctx.fillStyle = barvaPopisku(o);
          kresliRadky(ctx, p.radky, p.cx, p.cy, p.lh);
        }
        break;
      }
      case 'text': {
        ctx.font = pismo(o); ctx.textBaseline = 'top';
        radkyTextu(o).forEach((t, i) => ctx.fillText(t, o.x, o.y + i * o.velikost * RADEK + o.velikost * (RADEK - 1) / 2));
        break;
      }
      case 'listek': {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
        ctx.fillStyle = textNaPodklad(o.barva); ctx.font = pismo(o); ctx.textBaseline = 'top';
        zalom(o.text, o.w - 2 * OKRAJ_LISTKU, o).forEach((t, i) =>
          ctx.fillText(t, o.x + OKRAJ_LISTKU, o.y + OKRAJ_LISTKU + i * o.velikost * RADEK));
        ctx.restore();
        break;
      }
      case 'obr': {
        const img = env && env.obrazek(o.obr);
        if (img && (o.zrcX || o.zrcY)) {
          ctx.translate(o.x + (o.zrcX ? o.w : 0), o.y + (o.zrcY ? o.h : 0));
          ctx.scale(o.zrcX ? -1 : 1, o.zrcY ? -1 : 1);
          ctx.drawImage(img, 0, 0, o.w, o.h);
        } else if (img) ctx.drawImage(img, o.x, o.y, o.w, o.h);
        else { ctx.globalAlpha *= 0.3; ctx.fillStyle = '#888'; ctx.fillRect(o.x, o.y, o.w, o.h); }
        break;
      }
      case 'ram': {
        ctx.globalAlpha *= 0.06; ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.globalAlpha /= 0.06;
        ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.font = `600 ${TITULEK_RAMU}px ${PISMA.sans}`; ctx.textBaseline = 'bottom';
        ctx.fillText(o.nazev || '', o.x, o.y - TITULEK_RAMU * 0.4);
        break;
      }
    }
    ctx.restore();
  }

  // ---------- SVG ----------
  // XML 1.0 nesnese řídicí znaky ani osamocené surrogaty – celé SVG by se neotevřelo
  const esc = s => String(s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, ' ')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const c1 = v => Math.round(v * 10) / 10;

  function cestaTahuSVG(b) {
    let d = `M${c1(b[0])},${c1(b[1])}`;
    if (b.length === 4) return d + ` L${c1(b[2])},${c1(b[3])}`;
    for (let i = 2; i < b.length - 2; i += 2) {
      d += ` Q${c1(b[i])},${c1(b[i + 1])} ${c1((b[i] + b[i + 2]) / 2)},${c1((b[i + 1] + b[i + 3]) / 2)}`;
    }
    return d + ` L${c1(b[b.length - 2])},${c1(b[b.length - 1])}`;
  }

  function radkySVG(radky, cx, cy, lh, o, barva) {
    const spany = radky.map((t, i) => `<tspan x="${c1(cx)}" y="${c1(cy + (i - (radky.length - 1) / 2) * lh)}">${esc(t) || ' '}</tspan>`).join('');
    return `<text font-family="${esc(PISMA[o.pismo] || PISMA.sans)}" font-size="${c1(o.velikost || 20)}" fill="${barva}" text-anchor="middle" dominant-baseline="central" xml:space="preserve">${spany}</text>`;
  }

  function objektSVG(o, obrazky, pozadi) {
    const a = c1((o.alfa == null ? 1 : o.alfa) * (o.typ === 'tah' && o.zvyr ? ZVYR_ALFA : 1) * 100) / 100;
    const op = a < 1 ? ` opacity="${a}"` : '';
    const dash = o.typ === 'cara' || o.typ === 'tvar' || o.typ === 'krivka' ? carkovani(o) : [];
    const da = dash.length ? ` stroke-dasharray="${dash.map(c1).join(' ')}"` : '';
    switch (o.typ) {
      case 'tah': {
        const w = c1(sirkaCary(o)), b = o.body;
        if (o.stetec === 'sprej') {
          const k = kapkySpreje(o);
          let d = '';
          for (let i = 0; i < k.length; i += 3) { const v = c1(k[i + 2]); d += `M${c1(k[i] - k[i + 2] / 2)},${c1(k[i + 1] - k[i + 2] / 2)}h${v}v${v}h${-v}z`; }
          return `<path d="${d}" fill="${o.barva}"${op}/>`;
        }
        if (o.stetec === 'kaligrafie') {
          const d = ctyruhelnikyKaligrafie(o).map(q => `M${c1(q[0])},${c1(q[1])}L${c1(q[2])},${c1(q[3])}L${c1(q[4])},${c1(q[5])}L${c1(q[6])},${c1(q[7])}Z`).join('');
          return `<path d="${d}" fill="${o.barva}" stroke="${o.barva}" stroke-width="0.75" stroke-linejoin="round"${op}/>`;
        }
        if (o.stetec === 'stetec' && b.length >= 4) {
          const s = obrysStetce(o), ob = s.obrys, n = b.length;
          const kruh = (x, y, r) => `M${c1(x - r)},${c1(y)}a${c1(r)},${c1(r)} 0 1,0 ${c1(2 * r)},0a${c1(r)},${c1(r)} 0 1,0 ${c1(-2 * r)},0`;
          let d = `M${c1(ob[0])},${c1(ob[1])}`;
          for (let i = 2; i < ob.length; i += 2) d += `L${c1(ob[i])},${c1(ob[i + 1])}`;
          d += 'Z' + kruh(b[0], b[1], s.rZac) + kruh(b[n - 2], b[n - 1], s.rKon);
          return `<path d="${d}" fill="${o.barva}"${op}/>`;
        }
        if (b.length === 2) return `<circle cx="${c1(b[0])}" cy="${c1(b[1])}" r="${c1(w / 2)}" fill="${o.barva}"${op}/>`;
        return `<path d="${cestaTahuSVG(b)}" fill="none" stroke="${o.barva}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op}/>`;
      }
      case 'cara': {
        const b = bodyCary(o);
        const hroty = hrotyCary(o).map(h => `<polygon points="${h.map(c1).join(' ')}" fill="${o.barva}"/>`).join('');
        let popisek = '';
        if (o.text) {
          const m = stredCary(o), vel = o.velikost || 20, radky = radkyTextu(o);
          const w = sirkaRadku(radky, vel, o.pismo) + vel * 0.6, h = radky.length * vel * RADEK;
          if (pozadi) popisek += `<rect x="${c1(m.x - w / 2)}" y="${c1(m.y - h / 2)}" width="${c1(w)}" height="${c1(h)}" fill="${pozadi}"/>`;
          popisek += radkySVG(radky, m.x, m.y, vel * RADEK, o, o.barva);
        }
        return `<g${op}><polyline points="${b.map(c1).join(' ')}" fill="none" stroke="${o.barva}" stroke-width="${o.sirka}" stroke-linecap="round" stroke-linejoin="round"${da}/>${hroty}${popisek}</g>`;
      }
      case 'tvar': {
        const st = `fill="${o.vypln || 'none'}" stroke="${o.sirka > 0 ? o.barva : 'none'}" stroke-width="${o.sirka}" stroke-linejoin="round"${da}`;
        let tvar;
        if (o.druh === 'elipsa') tvar = `<ellipse cx="${c1(o.x + o.w / 2)}" cy="${c1(o.y + o.h / 2)}" rx="${c1(o.w / 2)}" ry="${c1(o.h / 2)}" ${st}/>`;
        else if (o.druh === 'zaobleny') tvar = `<rect x="${c1(o.x)}" y="${c1(o.y)}" width="${c1(o.w)}" height="${c1(o.h)}" rx="${c1(polomerZaobleni(o))}" ${st}/>`;
        else tvar = `<polygon points="${obrysTvaru(o).map(c1).join(' ')}" ${st}/>`;
        if (!o.text) return op ? `<g${op}>${tvar}</g>` : tvar;
        const p = popisekTvaru(o);
        return `<g${op}>${tvar}${radkySVG(p.radky, p.cx, p.cy, p.lh, o, barvaPopisku(o))}</g>`;
      }
      case 'text': {
        const spany = radkyTextu(o).map((t, i) =>
          `<tspan x="${c1(o.x)}" y="${c1(o.y + i * o.velikost * RADEK + o.velikost * (RADEK - 1) / 2)}">${esc(t) || ' '}</tspan>`).join('');
        return `<text font-family="${esc(PISMA[o.pismo] || PISMA.sans)}" font-size="${c1(o.velikost)}" fill="${o.barva}" dominant-baseline="text-before-edge" xml:space="preserve"${op}>${spany}</text>`;
      }
      case 'listek': {
        const radky = zalom(o.text, o.w - 2 * OKRAJ_LISTKU, o).map((t, i) =>
          `<tspan x="${c1(o.x + OKRAJ_LISTKU)}" y="${c1(o.y + OKRAJ_LISTKU + i * o.velikost * RADEK)}">${esc(t) || ' '}</tspan>`).join('');
        return `<g${op}><rect x="${c1(o.x)}" y="${c1(o.y)}" width="${c1(o.w)}" height="${c1(o.h)}" fill="${o.barva}"/>` +
          `<text font-family="${esc(PISMA[o.pismo] || PISMA.sans)}" font-size="${c1(o.velikost)}" fill="${textNaPodklad(o.barva)}" dominant-baseline="text-before-edge" xml:space="preserve">${radky}</text></g>`;
      }
      case 'krivka':
        if (o.body.length < 4) return '';
        return `<path d="${cestaKrivkySVG(o)}" fill="${o.vypln && o.uzavrena ? o.vypln : 'none'}" stroke="${o.sirka > 0 ? o.barva : 'none'}" stroke-width="${o.sirka}" stroke-linecap="round" stroke-linejoin="round"${da}${op}/>`;
      case 'oblast': {
        const d = o.kruhy.map(k => 'M' + k.map(c1).reduce((t, v, i) => t + (i ? (i % 2 ? ',' : ' L') : '') + v, '') + 'Z').join('');
        return `<path d="${d}" fill="${o.barva}" fill-rule="evenodd"${op}/>`;
      }
      case 'obr': {
        const src = obrazky && obrazky[o.obr];
        if (!src) return '';
        if (o.zrcX || o.zrcY) {
          return `<image href="${esc(src)}" x="0" y="0" width="${c1(o.w)}" height="${c1(o.h)}" preserveAspectRatio="none" transform="translate(${c1(o.x + (o.zrcX ? o.w : 0))} ${c1(o.y + (o.zrcY ? o.h : 0))}) scale(${o.zrcX ? -1 : 1} ${o.zrcY ? -1 : 1})"${op}/>`;
        }
        return `<image href="${esc(src)}" x="${c1(o.x)}" y="${c1(o.y)}" width="${c1(o.w)}" height="${c1(o.h)}" preserveAspectRatio="none"${op}/>`;
      }
      case 'ram':
        return `<g${op}><rect x="${c1(o.x)}" y="${c1(o.y)}" width="${c1(o.w)}" height="${c1(o.h)}" fill="${o.barva}" fill-opacity="0.06" stroke="${o.barva}" stroke-width="2"/>` +
          `<text x="${c1(o.x)}" y="${c1(o.y - TITULEK_RAMU * 0.4)}" font-family="${esc(PISMA.sans)}" font-size="${TITULEK_RAMU}" font-weight="600" fill="${o.barva}">${esc(o.nazev || '')}</text></g>`;
    }
    return '';
  }

  // celé SVG; pozadi = barva nebo null (průhledné)
  function svg(objekty, { obrazky = {}, pozadi = null, okraj = 20 } = {}) {
    const h = hraniceVsech(objekty) || { x: 0, y: 0, w: 100, h: 100 };
    const x = c1(h.x - okraj), y = c1(h.y - okraj), w = c1(h.w + 2 * okraj), v = c1(h.h + 2 * okraj);
    const casti = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${v}" viewBox="${x} ${y} ${w} ${v}">`];
    if (pozadi) casti.push(`<rect x="${x}" y="${y}" width="${w}" height="${v}" fill="${pozadi}"/>`);
    const ramy = objekty.filter(o => o.typ === 'ram'), ostatni = objekty.filter(o => o.typ !== 'ram');
    for (const o of ramy.concat(ostatni)) { const s = objektSVG(o, obrazky, pozadi); if (s) casti.push(s); }
    casti.push('</svg>');
    return casti.join('\n');
  }

  // obrázky, na které objekty odkazují (ostatní se při uložení zahodí)
  function pouziteObrazky(objekty, obrazky) {
    const ven = {};
    for (const o of objekty) if (o.typ === 'obr' && obrazky[o.obr]) ven[o.obr] = obrazky[o.obr];
    return ven;
  }

  // krátký otisk řetězce (id obrázku – stejný obrázek vložený 2× se uloží jednou)
  function otisk(s) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 + c, 2246822519) ^ (h2 >>> 13);
    }
    return 'i' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length.toString(36);
  }

  // kontrola dat z importu / schránky – jen známé typy s čísly na svém místě
  // barva jen jako #rgb/#rrggbb(aa) nebo rgb()/rgba() – jde přímo do atributů SVG
  const platnaBarva = v => typeof v === 'string' && (/^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d\s.,%]+\)$/i.test(v));
  const MEZ = 1e7;            // souřadnice dál od středu nedávají smysl (a rozbíjí přesnost kamery)
  // prisne = data zvenčí (import, schránka) – i rozsahy hodnot; vlastní uložené tabule jen tvar dat,
  // ať se po zpřísnění mezí nic tiše neztratí
  function platnyObjekt(o, prisne = true) {
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !o.id || !platnaBarva(o.barva)) return false;
    if (o.vypln != null && !platnaBarva(o.vypln)) return false;
    if (prisne) {
      for (const k of ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2']) if (o[k] != null && !(Math.abs(o[k]) <= MEZ)) return false;
      if (o.w != null && o.w < 0 || o.h != null && o.h < 0) return false;
      if (o.sirka != null && !(o.sirka >= 0 && o.sirka <= 500)) return false;
      if (o.velikost != null && !(o.velikost >= 1 && o.velikost <= 2000)) return false;
      if (o.alfa != null && !(o.alfa >= 0 && o.alfa <= 1)) return false;
    }
    const mez = prisne ? MEZ : Infinity;
    const cislo = (...k) => k.every(n => Number.isFinite(o[n]));
    const retezec = (...k) => k.every(n => o[n] == null || typeof o[n] === 'string');
    if (!retezec('id', 'skupina', 'text', 'nazev', 'zac', 'kon', 'pismo', 'styl', 'trasa', 'osa', 'vypln', 'stetec')) return false;
    const cisla = (a, min) => Array.isArray(a) && a.length >= min && a.length % 2 === 0 && a.every(v => Math.abs(v) <= mez);
    if (o.velikost != null && !cislo('velikost')) return false;
    switch (o.typ) {
      case 'tah': return cisla(o.body, 2) && o.sirka > 0 && (o.stetec == null || STETCE.includes(o.stetec)) &&
        (o.tl == null || (Array.isArray(o.tl) && o.tl.every(v => prisne ? v >= 0 && v <= 1 : Number.isFinite(v))));
      case 'krivka': return cisla(o.body, 4) && cislo('sirka');
      case 'oblast': return Array.isArray(o.kruhy) && o.kruhy.length > 0 && o.kruhy.every(k => cisla(k, 6));
      case 'cara': return cislo('x1', 'y1', 'x2', 'y2') && o.sirka > 0;
      case 'tvar': return cislo('x', 'y', 'w', 'h', 'sirka') && DRUHY.includes(o.druh);
      case 'text': return cislo('x', 'y', 'velikost') && typeof o.text === 'string';
      case 'listek': return cislo('x', 'y', 'w', 'h', 'velikost') && typeof o.text === 'string';
      case 'obr': return cislo('x', 'y', 'w', 'h') && typeof o.obr === 'string';
      case 'ram': return cislo('x', 'y', 'w', 'h');
    }
    return false;
  }

  // text objektu pro hledání
  const textObjektu = o => o.typ === 'ram' ? (o.nazev || '') : (o.text || '');

  const api = {
    PISMA, DRUHY, RADEK, OKRAJ_LISTKU, TITULEK_RAMU, noveId,
    nastavMereni(fn) { mer = fn; },
    pismo, zalom, popisekTvaru, bodyCary, stredCary, hranice, hraniceHole, hraniceVsech, zneplatni, prekryva, obsahuje,
    zasah, najdi, prepoj, prusecik, lzePripojit, klonuj, voditka, premisti, skaluj, zredukuj, omez, zarovnej, rozmisti, poradiRamu,
    jas, textNaPodklad, barvaPopisku, kresli, svg, objektSVG, pouziteObrazky, otisk, platnyObjekt, textObjektu,
    STETCE, polomerTahu, kapkySpreje, vzorkyKrivky, zjednodus, rozsir, zaplav, obrysy, rozpoznej, symetrie, transformuj
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else koren.WB_JADRO = api;
})(typeof window !== 'undefined' ? window : globalThis);
