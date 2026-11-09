/* ============================================================
   prekladac_svetu/abecedy.js – vlastní abecedy (fonty) jazyků.

   Každý jazyk má abecedu = {styl, semeno}. Styl určuje „rukopis“
   (křivky, runy, drápance, plošné spoje…), semeno konkrétní tvary.
   Znak se skládá z tahů na mřížce (u, v ∈ 0…1, y nahoru); tahy se
   obtáhnou Clipperem na obrysy a zapíšou do TTF (export Písmolijny).
   Font mapuje latinku (a–z, A–Z, česká a další písmena s diakritikou
   na základní písmeno), číslice a běžnou interpunkci – text se tedy
   píše a kopíruje latinkou, jen se zobrazí písmem jazyka.

     ABECEDY.STYLY                     – [{id, nazev, …}]
     ABECEDY.znaky(abeceda)            → {znak: [primitivy]}
     ABECEDY.font(abeceda, nazev)      → PSL font (potřebuje PSL a ClipperLib)
     ABECEDY.ttf(abeceda, nazev)       → Uint8Array (TTF)
     ABECEDY.nacti(abeceda, nazev)     → Promise<rodina CSS> (jen prohlížeč)
     ABECEDY.rodina(abeceda)           → název rodiny CSS (i před načtením)
   Primitivy: {c: [[u,v]…], hladka, zavrena} tah, {p: [[u,v]…]} plocha.
   ============================================================ */
(function (G) {
  'use strict';

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function nahoda(semeno) {
    let a = semeno >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const vyber = (a, r) => a[Math.floor(r() * a.length)];
  const kruh = (st, rad, n) => Array.from({ length: n || 20 }, (_, i) => [st[0] + rad * Math.cos(2 * Math.PI * i / (n || 20)), st[1] + rad * Math.sin(2 * Math.PI * i / (n || 20))]);
  const oblouk = (st, rad, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [st[0] + rad * Math.cos(a), st[1] + rad * Math.sin(a)]; });
  const ctverec = (st, d) => [[st[0] - d, st[1] - d], [st[0] - d, st[1] + d], [st[0] + d, st[1] + d], [st[0] + d, st[1] - d]];
  const tecka = (st, rad) => ({ p: kruh(st, rad || 0.075, 14) });
  const vzd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const V4 = [0, 1 / 3, 2 / 3, 1], U3 = [0, 0.5, 1];

  // body na mřížce bez opakování sousedních
  function cesta(r, n, us, vs, minVzd) {
    const b = [];
    for (let pokus = 0; b.length < n && pokus < 50; pokus++) {
      const p = [vyber(us, r), vyber(vs, r)];
      if (!b.length || vzd(b[b.length - 1], p) >= (minVzd || 0.3)) b.push(p);
    }
    return b;
  }

  /* ---------- styly ---------- */
  const STYLY = [
    { id: 'vlnite', nazev: 'Vlnité (elfí)', tloustka: 66, konce: 'kulate', sklon: 0.16,
      // kaligrafie: prohnutý dřík + jedno či dvě bříška (oblouky) + znaménko nad písmenem
      gen(r) {
        const out = [];
        const vlevo = r() < 0.3;                       // bříška vlevo od dříku (zrcadlově)
        const us = vlevo ? vyber([0.7, 0.85], r) : vyber([0.15, 0.3], r), smer = vlevo ? -1 : 1;
        const vh = vyber([0.62, 1, 1], r), vd = vyber([0, 0, -0.28], r);
        if (r() < 0.85) out.push({ c: [[us + 0.06, vh], [us - 0.04, (vh + vd) / 2], [us + 0.03, vd]], hladka: true });
        const bricha = 1 + (r() < 0.35 ? 1 : 0);
        const vysky = [[0.31, 0.31], [0.31, 0.2], [0.42, 0.21], [0.62, 0.2]];
        for (let i = 0; i < bricha; i++) {
          const [st, rad] = bricha === 2 ? [[0.17, 0.47][i], 0.17] : vyber(vysky, r);
          const otevrene = r() < 0.5;
          let a0 = vyber([-Math.PI / 2, -Math.PI / 2, 0], r), a1 = Math.PI / 2 + (otevrene ? 0 : Math.PI * 0.4);
          if (vlevo) [a0, a1] = [Math.PI - a1, Math.PI - a0];
          out.push({ c: oblouk([us + smer * (rad + 0.02), st], rad, a0, a1, 14) });
          if (r() < 0.3) out.push({ c: [[us + smer * 2 * rad, st], [us + smer * (2 * rad + 0.25), st - rad - 0.05]] });
        }
        const z = r();
        if (z < 0.25) out.push(tecka([0.5, 1.15], 0.06));
        else if (z < 0.45) out.push({ c: oblouk([0.5, 1.02], 0.13, Math.PI * 0.1, Math.PI * 0.95, 8) });
        else if (z < 0.6) out.push({ c: [[0.3, 1.1], [0.55, 1.22], [0.8, 1.12]], hladka: true });
        return out;
      } },
    { id: 'runove', nazev: 'Runové (trpasličí)', tloustka: 78, konce: 'ostre', sklon: 0,
      gen(r) {
        const dve = r() < 0.3, sloupy = dve ? [0.1, 0.9] : [vyber([0.2, 0.5, 0.8], r)];
        const out = sloupy.map(u => ({ c: [[u, 0], [u, 1]] }));
        const n = 1 + Math.floor(r() * (dve ? 2 : 3));
        for (let i = 0; i < n; i++) {
          const u0 = vyber(sloupy, r), v0 = vyber(V4, r);
          const u1 = vyber(U3.filter(u => Math.abs(u - u0) > 0.25), r), v1 = vyber(V4.filter(v => v !== v0), r);
          out.push({ c: [[u0, v0], [u1, v1]] });   // runy nemají vodorovné tahy
        }
        return out;
      } },
    { id: 'drapy', nazev: 'Drápance (skřetí)', tloustka: 92, konce: 'ostre', sklon: -0.06,
      gen(r) {
        const out = [];
        const n = 2 + (r() < 0.35 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const b = [];
          for (let pokus = 0; b.length < 3 + Math.floor(r() * 2) && pokus < 60; pokus++) {
            const p = [Math.round(r() * 10) / 10, Math.round(r() * 10) / 10];
            if (!b.length || vzd(b[b.length - 1], p) > 0.4) b.push(p);
          }
          out.push({ c: b });
        }
        if (r() < 0.4) { const x = 0.2 + r() * 0.6; out.push({ p: [[x - 0.12, 1], [x + 0.12, 1], [x + (r() - 0.5) * 0.3, 1.25]] }); }
        return out;
      } },
    { id: 'draci', nazev: 'Dračí háky', tloustka: 58, konce: 'kulate', sklon: 0.1,
      gen(r) {
        const u0 = 0.2 + Math.round(r() * 6) / 10, strana = vyber([0, 1], r);
        const out = [{ c: [[u0, 1], [strana, 0.55], [1 - strana * 0.6, 0.15 + Math.round(r() * 2) / 10]], hladka: true }];
        if (r() < 0.6) out.push({ c: cesta(r, 2, [0, 0.3, 0.7, 1], [0.1, 0.5, 0.9], 0.45), hladka: false });
        else out.push({ c: cesta(r, 3, [0, 0.5, 1], [0, 0.4, 0.8], 0.4), hladka: true });
        const kolik = 1 + (r() < 0.4 ? 1 : 0);
        for (let i = 0; i < kolik; i++) {   // tesák: úzký trojúhelník
          const z = [vyber([0.1, 0.5, 0.9], r), vyber([0.2, 0.6, 1], r)], s = vyber([-1, 1], r);
          out.push({ p: [[z[0] - 0.07, z[1]], [z[0] + 0.07, z[1]], [z[0] + s * 0.18, z[1] - 0.32]] });
        }
        return out;
      } },
    { id: 'kruhy', nazev: 'Kroužky pod linkou (mimozemské)', tloustka: 52, konce: 'kulate', sklon: 0, pevnaSirka: true,
      gen(r) {
        const out = [{ c: [[-0.13, 1], [1.13, 1]], linka: true }];   // spojovací linka – na sebe navazuje
        const body = [[0, 0], [0.5, 0], [1, 0], [0, 0.45], [0.5, 0.45], [1, 0.45], [0.2, 0.9], [0.5, 0.9], [0.8, 0.9]];
        const n = 1 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
          const a = vyber(body, r), b = vyber(body.filter(p => vzd(p, a) > 0.4), r);
          out.push({ c: [a, b] });
        }
        if (r() < 0.65) out.push({ c: kruh(vyber(body.slice(0, 6), r), 0.15), zavrena: true });
        else out.push(tecka(vyber(body.slice(0, 6), r), 0.08));
        return out;
      } },
    { id: 'obvod', nazev: 'Plošné spoje (robotí)', tloustka: 56, konce: 'ostre', sklon: 0,
      gen(r) {
        const out = [], us = [0, 1 / 3, 2 / 3, 1], vs = [0, 0.25, 0.5, 0.75, 1];
        const n = 1 + (r() < 0.55 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          let p = [vyber(us, r), vyber(vs, r)];
          const b = [p];
          let vodorovne = r() < 0.5;
          for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
            const q = vodorovne ? [vyber(us.filter(u => u !== p[0]), r), p[1]] : [p[0], vyber(vs.filter(v => v !== p[1]), r)];
            b.push(q); p = q; vodorovne = !vodorovne;
          }
          out.push({ c: b });
          out.push({ p: ctverec(b[0], 0.08) }, { p: ctverec(b[b.length - 1], 0.08) });
        }
        return out;
      } },
    { id: 'geometr', nazev: 'Geometrické tvary (galaktické)', tloustka: 60, konce: 'kulate', sklon: 0,
      gen(r) {
        const ZAKLAD = [
          { c: kruh([0.5, 0.5], 0.48, 28), zavrena: true },
          { c: [[0, 0], [0, 1], [1, 1], [1, 0]], zavrena: true },
          { c: [[0, 0], [0.5, 1], [1, 0]], zavrena: true },
          { c: [[0, 1], [0.5, 0], [1, 1]], zavrena: true },
          { c: [[0.5, 0], [0, 0.5], [0.5, 1], [1, 0.5]], zavrena: true },
          { c: oblouk([0.5, 0.5], 0.48, 0, Math.PI, 16) },
          { c: oblouk([0.5, 0.5], 0.48, Math.PI, 2 * Math.PI, 16) },
          { c: [[0, 1], [0, 0], [1, 0], [1, 1]] },
          { c: [[0, 0], [0, 1], [1, 1], [1, 0]] },
        ];
        const out = [vyber(ZAKLAD, r)];
        const VNITREK = [() => tecka([0.5, 0.5], 0.09), () => ({ c: [[0.5, 0.2], [0.5, 0.8]] }), () => ({ c: [[0.2, 0.5], [0.8, 0.5]] }),
          () => ({ c: kruh([0.5, 0.5], 0.17), zavrena: true }), () => tecka([0.5, 1.2], 0.07), () => ({ c: [[0.2, 0.2], [0.8, 0.8]] })];
        const n = Math.floor(r() * 3);
        for (let i = 0; i < n; i++) out.push(vyber(VNITREK, r)());
        return out;
      } },
    { id: 'pecet', nazev: 'Pečetě a sigily (magické)', tloustka: 48, konce: 'kulate', sklon: 0,
      gen(r) {
        const out = [];
        if (r() < 0.55) out.push({ c: [[0.5, 0], [0.5, 1]] });
        else { const a0 = r() * Math.PI * 2; out.push({ c: oblouk([0.5, 0.5], 0.42, a0, a0 + Math.PI * (1 + r() * 0.6), 18) }); }
        const n = 1 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) {
          const kon = [vyber([0, 0.5, 1], r), vyber([0, 0.5, 1], r)];
          if (vzd(kon, [0.5, 0.5]) < 0.3) continue;
          out.push({ c: [[0.5, 0.5], kon] });
          if (r() < 0.6) out.push({ c: kruh(kon, 0.09, 14), zavrena: true });
          else { const dx = kon[1] - 0.5, dy = -(kon[0] - 0.5), d = Math.hypot(dx, dy) || 1; out.push({ c: [[kon[0] - dx / d * 0.12, kon[1] - dy / d * 0.12], [kon[0] + dx / d * 0.12, kon[1] + dy / d * 0.12]] }); }
        }
        if (r() < 0.3) out.push({ c: [[0.3, 1.15], [0.7, 1.15]] });
        return out;
      } },
  ];
  const STYL = Object.fromEntries(STYLY.map(s => [s.id, s]));

  // interpunkce – stejná pro všechny styly (kreslí se tloušťkou a konci stylu)
  function interpunkce(hranate) {
    const t = (st, rad) => (hranate ? { p: ctverec(st, (rad || 0.075) * 0.9) } : tecka(st, rad));
    return {
      '.': [t([0.5, 0.05])], ',': [{ c: [[0.55, 0.08], [0.4, -0.2]] }], ':': [t([0.5, 0.05]), t([0.5, 0.55])],
      ';': [t([0.5, 0.55]), { c: [[0.55, 0.08], [0.4, -0.2]] }], '!': [{ c: [[0.5, 1], [0.5, 0.35]] }, t([0.5, 0.05])],
      '?': [{ c: [[0.15, 0.8], [0.5, 1], [0.85, 0.8], [0.5, 0.55], [0.5, 0.35]], hladka: !hranate }, t([0.5, 0.05])],
      '-': [{ c: [[0.15, 0.45], [0.85, 0.45]] }], "'": [{ c: [[0.5, 1.05], [0.45, 0.78]] }],
      '"': [{ c: [[0.3, 1.05], [0.27, 0.78]] }, { c: [[0.7, 1.05], [0.67, 0.78]] }],
      '(': [{ c: oblouk([1.1, 0.45], 0.75, Math.PI * 0.62, Math.PI * 1.38, 10) }], ')': [{ c: oblouk([-0.1, 0.45], 0.75, -Math.PI * 0.38, Math.PI * 0.38, 10) }],
    };
  }

  const PISMENA = 'abcdefghijklmnopqrstuvwxyz0123456789';
  // podpis tvaru na hrubé mřížce (čtvrtiny) – znaky, které by vypadaly skoro stejně, se vygenerují znovu
const zaokrouhli = prim => JSON.stringify(prim, (k, v) => (typeof v === 'number' ? Math.round(v * 4) / 4 : v));

  function znaky(abeceda) {
    const styl = STYL[abeceda.styl] || STYLY[0];
    const r = nahoda(hash(styl.id + '|' + (abeceda.semeno || 1)));
    const out = {}, videno = new Set();
    for (const ch of PISMENA) {
      let p;
      for (let pokus = 0; pokus < 300; pokus++) {
        p = styl.gen(r);
        const podpis = zaokrouhli(p.filter(x => !x.linka));
        if (!videno.has(podpis)) { videno.add(podpis); break; }
      }
      out[ch] = p;
    }
    Object.assign(out, interpunkce(styl.konce === 'ostre'));
    return out;
  }

  /* ---------- tahy → obrysy (Clipper) ---------- */
  const VYSKA = 700, SIRKA = 520, OKRAJ = 70, SIRKA_PIS = 660, SIRKA_INT = 330, MER = 4;
  function hladce(b) {   // Catmull-Rom přes body
    if (b.length < 3) return b;
    const out = [];
    for (let i = 0; i < b.length - 1; i++) {
      const p0 = b[Math.max(0, i - 1)], p1 = b[i], p2 = b[i + 1], p3 = b[Math.min(b.length - 1, i + 2)];
      for (let k = 0; k < 10; k++) {
        const t = k / 10, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(b[b.length - 1]);
    return out;
  }

  function obrysyZnaku(prim, styl, interp) {
    const L = G.ClipperLib;
    if (!L) throw new Error('Chybí knihovna Clipper.');
    const naBod = ([u, v]) => interp
      ? { X: Math.round((SIRKA_INT / 2 + (u - 0.5) * 200 + styl.sklon * v * VYSKA * 0.6) * MER), Y: Math.round(v * VYSKA * MER) }
      : { X: Math.round((OKRAJ + u * SIRKA + styl.sklon * v * VYSKA) * MER), Y: Math.round(v * VYSKA * MER) };
    const co = new L.ClipperOffset(2, 0.25 * MER);
    const spoj = styl.konce === 'ostre' ? L.JoinType.jtMiter : L.JoinType.jtRound;
    for (const p of prim) {
      if (p.p) co.AddPath(p.p.map(naBod), spoj, L.EndType.etClosedPolygon);
      else {
        const body = (p.hladka ? hladce(p.c) : p.c).map(naBod);
        const konec = p.zavrena ? L.EndType.etClosedLine : styl.konce === 'ostre' ? L.EndType.etOpenSquare : L.EndType.etOpenRound;
        co.AddPath(body, spoj, konec);
      }
    }
    const reseni = new L.Paths();
    co.Execute(reseni, styl.tloustka / 2 * MER);
    // Clipper: vnější obrysy proti směru hodin (y nahoru); TrueType chce po směru → obrátit všechny
    return L.Clipper.CleanPolygons(reseni, 0.5 * MER).filter(c => c.length >= 3)
      .map(c => c.slice().reverse().map(b => ({ x: Math.round(b.X / MER), y: Math.round(b.Y / MER), t: 'l', s: false })));
  }

  // všechny kódy znaků, které se zobrazí daným glyfem (velká písmena a diakritika → základní písmeno)
  const KODY = (function () {
    const m = {};
    const pridej = (ch, cp) => { (m[ch] = m[ch] || []).push(cp); };
    for (const ch of PISMENA) { pridej(ch, ch.charCodeAt(0)); if (/[a-z]/.test(ch)) pridej(ch, ch.toUpperCase().charCodeAt(0)); }
    for (let cp = 0xC0; cp <= 0x24F; cp++) {
      const z = String.fromCodePoint(cp).normalize('NFD')[0].toLowerCase();
      if (/[a-z]/.test(z) && cp !== 0xD7 && cp !== 0xF7) pridej(z, cp);
    }
    pridej("'", 0x2019); pridej("'", 0x2018); pridej('"', 0x201E); pridej('"', 0x201C); pridej('"', 0x201D); pridej('-', 0x2013); pridej('-', 0x2014);
    return m;
  })();

  function font(abeceda, nazev) {
    const P = G.PSL;
    if (!P) throw new Error('Chybí jádro Písmolijny (PSL).');
    const styl = STYL[abeceda.styl] || STYLY[0];
    const rodina = (nazev || 'Abeceda').normalize('NFD').replace(/[^\x20-\x7E]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim() || 'Abeceda';
    const f = P.novyFont({ rodina, upm: 1000, ascender: 900, descender: -250, lineGap: 150, xVyska: VYSKA, vyskaVerzalek: VYSKA,
      designer: 'Překladač světů', popis: `Abeceda ${styl.nazev}, semínko ${abeceda.semeno}`, verzeFontu: '1.000' });
    f.glyfy.space.sirka = 300;
    const z = znaky(abeceda);
    for (const ch in z) {
      const interp = !/[a-z0-9]/.test(ch);
      const kody = KODY[ch] || [ch.charCodeAt(0)];
      const g = P.novyGlyf(P.nazevProUnicode(kody[0]), kody, interp ? SIRKA_INT : SIRKA_PIS + Math.round(styl.sklon * VYSKA * 0.5));
      const obrysy = obrysyZnaku(z[ch], styl, interp);
      if (!styl.pevnaSirka && obrysy.length) {
        // šířka podle skutečného tvaru: stejné mezery mezi znaky
        let x0 = Infinity, x1 = -Infinity;
        for (const o of obrysy) for (const b of o) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); }
        const mezera = interp ? 50 : 70, dx = mezera - x0;
        for (const o of obrysy) for (const b of o) b.x += dx;
        g.sirka = Math.max(interp ? 200 : 300, Math.round(x1 - x0 + 2 * mezera));
      }
      g.obrysy = obrysy.map(body => ({ body }));
      P.pridejGlyf(f, g);
    }
    return f;
  }
  const ttf = (abeceda, nazev) => G.PSL.exportTTF(font(abeceda, nazev));

  // prohlížeč: font se zaregistruje jednou pro každou kombinaci stylu a semínka
  const nactene = new Map();
  const rodina = abeceda => 'Abeceda ' + abeceda.styl + '_' + (abeceda.semeno || 1);
  function nacti(abeceda, nazev) {
    const klic = rodina(abeceda);
    if (!nactene.has(klic)) {
      nactene.set(klic, (async () => {
        const ff = new FontFace(klic, ttf(abeceda, nazev).buffer);
        await ff.load();
        document.fonts.add(ff);
        return klic;
      })());
    }
    return nactene.get(klic);
  }

  G.ABECEDY = { STYLY, STYL, znaky, font, ttf, nacti, rodina, PISMENA };
})(typeof window !== 'undefined' ? window : globalThis);
