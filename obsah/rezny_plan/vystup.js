/* ============================================================
   Řezný plán – výstupy (bez DOM): scéna desky, SVG, DXF, CSV, štítky, PDF (jsPDF a qrcode parametrem)
   Scéna desky je v mm desky (y nahoru); text a čáry se dimenzují v mm papíru přes `m` (mm papíru na mm desky).
   prvek: {t:'r', x,y,w,h, f, c, s, d} | {t:'l', b:[[x,y]..], c, s, d} | {t:'txt', x,y, txt, h, a, u, c, tucne} | {t:'k', x,y,r, f, c, s}
   ============================================================ */
(function (koren) {
  'use strict';
  const RP = koren.RP || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const fmt = RP.fmt;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const PALETA = ['#cfe3f7', '#f9dcc0', '#d6efd2', '#f3d2e4', '#e6e0f7', '#fbeeb8', '#cdeeed', '#f2d6cf', '#dfe8c4', '#e3d7c8', '#c9dcf2', '#f6cfd6'];
  const OBRYS = '#334155', REZ = '#c2410c', HRANA = '#1d4ed8', ZBYTEK = '#15803d';
  const barvaDilce = (di) => PALETA[di % PALETA.length];
  const oznaceni = (di, c) => `${di + 1}.${c + 1}`;
  const rozmerTxt = (w, h) => `${fmt(w, 1)} × ${fmt(h, 1)}`;

  /* ---------------- scéna jedné desky ---------------- */
  /** o: {m (mm papíru / mm desky), cisla, rezy (čísla řezů), koty, zbytky, hrany, vybrany ({di,c})} */
  function scenaDesky(pr, d, o) {
    o = Object.assign({ m: 0.1, cisla: true, rezy: true, koty: true, zbytky: true, hrany: true }, o || {});
    const m = o.m, P = (mm) => mm / m, el = [];
    const hm = RP.mapaHran(pr);
    // deska a okraj
    el.push({ t: 'r', x: 0, y: 0, w: d.W, h: d.H, f: '#f4ead8', c: OBRYS, s: 0.35, v: 'deska' });
    if (d.okraj > 0) el.push({ t: 'r', x: d.okraj, y: d.okraj, w: d.W - 2 * d.okraj, h: d.H - 2 * d.okraj, c: '#a08c6a', s: 0.15, d: 'c', v: 'okraj' });
    if (d.typ.vlakna) {   // směr vláken / dekoru
      const y = d.H + P(2.2), x0 = d.W - P(32), x1 = d.W - P(4);
      el.push({ t: 'l', b: [[x0, y], [x1, y]], c: '#8a6d3b', s: 0.3 }, { t: 'l', b: [[x1 - P(1.6), y + P(0.9)], [x1, y], [x1 - P(1.6), y - P(0.9)]], c: '#8a6d3b', s: 0.3 });
      el.push({ t: 'txt', x: x0 - P(1), y: y - P(0.9), txt: 'směr vláken', h: P(2.2), a: 'r', c: '#8a6d3b' });
    }
    // zbytky
    if (o.zbytky) for (const z of d.zbytky || []) {
      el.push({ t: 'r', x: z.x, y: z.y, w: z.w, h: z.h, f: z.pouzitelny ? '#e3f4e1' : '#eeeeee', c: z.pouzitelny ? ZBYTEK : '#999999', s: 0.15, d: 'c', v: 'zbytek' });
      if (z.pouzitelny && P(5) < Math.min(z.w, z.h)) {
        const svis = z.h > z.w * 1.8 && P(40) > z.w;
        el.push({ t: 'txt', x: z.x + z.w / 2, y: z.y + z.h / 2 - P(1), txt: `zbytek ${fmt(z.w, 0)} × ${fmt(z.h, 0)}`, h: P(Math.min(2.6, Math.max(1.6, Math.min(z.w, z.h) * m * 0.25))), a: 'c', u: svis ? 90 : 0, c: ZBYTEK });
      }
    }
    // dílce
    for (const q of d.dily) {
      const D = pr.dilce[q.di] || {};
      const sel = o.vybrany && o.vybrany.di === q.di && o.vybrany.c === q.c;
      el.push({ t: 'r', x: q.x, y: q.y, w: q.w, h: q.h, f: sel ? '#ffd166' : barvaDilce(q.di), c: OBRYS, s: sel ? 0.5 : 0.25, v: 'dil', di: q.di, ci: q.c });
      // hrany: tlustá čára těsně uvnitř obrysu
      if (o.hrany) {
        const H = D.hrany || {}, ins = P(0.6);
        const strany = q.rot
          ? { d1: [[q.x + q.w - ins, q.y], [q.x + q.w - ins, q.y + q.h]], d2: [[q.x + ins, q.y], [q.x + ins, q.y + q.h]], s1: [[q.x, q.y + ins], [q.x + q.w, q.y + ins]], s2: [[q.x, q.y + q.h - ins], [q.x + q.w, q.y + q.h - ins]] }
          : { d1: [[q.x, q.y + ins], [q.x + q.w, q.y + ins]], d2: [[q.x, q.y + q.h - ins], [q.x + q.w, q.y + q.h - ins]], s1: [[q.x + ins, q.y], [q.x + ins, q.y + q.h]], s2: [[q.x + q.w - ins, q.y], [q.x + q.w - ins, q.y + q.h]] };
        for (const s of ['d1', 'd2', 's1', 's2']) if (H[s] && hm[H[s]]) el.push({ t: 'l', b: strany[s], c: HRANA, s: hm[H[s]].tl >= 1 ? 0.75 : 0.4 });
      }
      if (o.cisla) {
        const wp = q.w * m, hp = q.h * m, svis = hp > wp * 1.4 && wp < 26;
        const dl = svis ? hp : wp, kr = svis ? wp : hp;
        const hC = Math.max(1.6, Math.min(5, kr * 0.34, dl * 0.2)), hR = Math.max(1.3, Math.min(2.6, kr * 0.2, dl / 11));
        const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
        const dw = q.rot ? D.h : D.w, dh = q.rot ? D.w : D.h;
        if (kr >= 3) {
          const nazev = String(D.nazev || '');
          const radky = kr > hC + hR * 2.6 + 2 ? 3 : kr > hC + hR + 1.5 ? 2 : 1;
          const off = (i) => (svis ? [P(i), 0] : [0, -P(i)]);
          const pos = (dy) => { const [ox, oy] = off(dy); return [cx + ox, cy + oy]; };
          const u = svis ? 90 : 0;
          if (radky === 1) { const [x, y] = pos(hC * 0.35); el.push({ t: 'txt', x, y, txt: oznaceni(q.di, q.c), h: P(Math.min(hC, kr * 0.7)), a: 'c', u, c: '#000000', tucne: true }); }
          else {
            const tot = radky === 3 ? hC + hR * 2.4 : hC + hR * 1.3;
            let [x, y] = pos(-tot / 2 + hC * 0.8);
            el.push({ t: 'txt', x, y, txt: oznaceni(q.di, q.c), h: P(hC), a: 'c', u, c: '#000000', tucne: true });
            [x, y] = pos(-tot / 2 + hC + hR * 1.05);
            el.push({ t: 'txt', x, y, txt: rozmerTxt(dw, dh) + (q.rot ? ' ⟲' : ''), h: P(hR), a: 'c', u, c: '#222222' });
            if (radky === 3 && nazev) {
              [x, y] = pos(-tot / 2 + hC + hR * 2.3);
              const maxZn = Math.max(4, Math.floor(dl / (hR * 0.56)));
              el.push({ t: 'txt', x, y, txt: nazev.length > maxZn ? nazev.slice(0, maxZn - 1) + '…' : nazev, h: P(hR * 0.95), a: 'c', u, c: '#444444' });
            }
          }
        }
        if (D.vlakna && d.typ.vlakna && Math.min(wp, hp) > 9) {
          // šipka směru vláken v dílci (vždy podél x desky)
          const y = q.y + P(2.2), x1 = q.x + q.w - P(2), x0 = x1 - Math.min(P(9), q.w * 0.3);
          el.push({ t: 'l', b: [[x0, y], [x1, y]], c: '#8a6d3b', s: 0.22 }, { t: 'l', b: [[x1 - P(1), y + P(0.6)], [x1, y], [x1 - P(1), y - P(0.6)]], c: '#8a6d3b', s: 0.22 });
        }
      }
    }
    // řezy (pořadí)
    if (o.rezy && d.rezy && d.rezy.length) {
      const k = d.rez;
      for (const r of d.rezy) {
        const q = r.kus, st = r.typ === 'zarovnani' ? 'c' : null;
        const b = r.o === 'H' ? [[q.x, r.p + k / 2], [q.x + q.w, r.p + k / 2]] : [[r.p + k / 2, q.y], [r.p + k / 2, q.y + q.h]];
        el.push({ t: 'l', b, c: REZ, s: 0.2, d: st, v: 'rez' });
      }
      // čísla řezů – kroužky na čáře, aby se nepřekrývaly: posun podél čáry podle stupně
      const R = 1.7;
      for (const r of d.rezy) {
        const q = r.kus;
        const delka = r.o === 'H' ? q.w : q.h;
        if (delka * m < 2 * R + 1) continue;
        const t = Math.min(0.5, Math.max(0.12, (P(R * 2 + 3)) / delka)) + ((r.stupen || 0) % 2) * 0.12;
        const f = Math.min(0.88, t);
        const x = r.o === 'H' ? q.x + q.w * f : r.p + d.rez / 2, y = r.o === 'H' ? r.p + d.rez / 2 : q.y + q.h * f;
        el.push({ t: 'k', x, y, r: P(R), f: '#ffffff', c: REZ, s: 0.25, v: 'cislorezu' });
        el.push({ t: 'txt', x, y: y - P(0.75), txt: String(r.n), h: P(r.n > 99 ? 1.6 : 2.0), a: 'c', c: REZ, tucne: true });
      }
    }
    // kóty: řetězec 1. stupně (pruhy) a rozměr desky
    if (o.koty) {
      const ofs = P(5), c = '#1f5fa8';
      const kotaH = (x0, x1, y, txt) => {
        el.push({ t: 'l', b: [[x0, y], [x1, y]], c, s: 0.18 }, { t: 'l', b: [[x0, y - P(1.2)], [x0, y + P(1.2)]], c, s: 0.18 }, { t: 'l', b: [[x1, y - P(1.2)], [x1, y + P(1.2)]], c, s: 0.18 });
        if ((x1 - x0) * m > 6) el.push({ t: 'txt', x: (x0 + x1) / 2, y: y + P(0.8), txt, h: P(2), a: 'c', c });
      };
      const kotaV = (y0, y1, x, txt) => {
        el.push({ t: 'l', b: [[x, y0], [x, y1]], c, s: 0.18 }, { t: 'l', b: [[x - P(1.2), y0], [x + P(1.2), y0]], c, s: 0.18 }, { t: 'l', b: [[x - P(1.2), y1], [x + P(1.2), y1]], c, s: 0.18 });
        if ((y1 - y0) * m > 6) el.push({ t: 'txt', x: x - P(0.8), y: (y0 + y1) / 2, txt, h: P(2), a: 'c', u: 90, c });
      };
      kotaH(0, d.W, -ofs * 2.2, fmt(d.W, 1));
      kotaV(0, d.H, -ofs * 2.2, fmt(d.H, 1));
      const prvni = (d.rezy || []).filter((r) => r.stupen === 1);
      if (prvni.length) {
        const o1 = prvni[0].o;
        const poz = [d.okraj].concat(prvni.map((r) => r.p)).concat([]);
        const body = [];
        let a = d.okraj;
        for (const r of prvni) { body.push([a, r.p]); a = r.p + d.rez; }
        for (const [x0, x1] of body) if (x1 - x0 > 0.5) { if (o1 === 'V') kotaH(x0, x1, -ofs, fmt(x1 - x0, 1)); else kotaV(x0, x1, -ofs, fmt(x1 - x0, 1)); }
        void poz;
      }
    }
    return el;
  }

  /* ---------------- SVG ---------------- */
  function svgPrvek(e, X, Y, m) {
    const sw = (s) => (s || 0.2) / m;
    const dash = (e2) => (e2.d === 'c' ? ` stroke-dasharray="${3 / m} ${2 / m}"` : '');
    if (e.t === 'r') return `<rect x="${X(e.x)}" y="${Y(e.y + e.h)}" width="${e.w}" height="${e.h}" fill="${e.f || 'none'}" stroke="${e.c || 'none'}" stroke-width="${sw(e.s)}"${dash(e)}${e.v === 'dil' ? ` class="dil" data-di="${e.di}" data-c="${e.ci}"` : e.v ? ` class="${e.v}"` : ''}/>`;
    if (e.t === 'l') return `<polyline points="${e.b.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="none" stroke="${e.c}" stroke-width="${sw(e.s)}"${dash(e)} stroke-linecap="round"${e.v ? ` class="${e.v}"` : ''}/>`;
    if (e.t === 'k') return `<circle cx="${X(e.x)}" cy="${Y(e.y)}" r="${e.r}" fill="${e.f || 'none'}" stroke="${e.c}" stroke-width="${sw(e.s)}"/>`;
    if (e.t === 'txt') {
      const an = e.a === 'c' ? 'middle' : e.a === 'r' ? 'end' : 'start';
      const tr = e.u ? ` transform="rotate(${-e.u} ${X(e.x)} ${Y(e.y)})"` : '';
      return `<text x="${X(e.x)}" y="${Y(e.y)}" font-size="${e.h}" text-anchor="${an}" fill="${e.c}"${e.tucne ? ' font-weight="700"' : ''}${tr}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** SVG jedné desky v mm desky; o.sirkaPx pro dimenzování textu (výchozí 900 px) */
  function svgDesky(pr, d, o) {
    o = Object.assign({ sirkaPapiru: 260 }, o || {});
    const m = o.sirkaPapiru / (d.W * 1.08);
    const el = scenaDesky(pr, d, Object.assign({}, o, { m }));
    const okr = 14 / m, vx = -okr, vy = -6 / m, vw = d.W + okr + 4 / m, vh = d.H + okr + 6 / m;
    const X = (x) => +x.toFixed(2), Y = (y) => +(d.H - y).toFixed(2);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" font-family="Liberation Sans, Arial, sans-serif"${o.mm ? ` width="${vw.toFixed(1)}mm" height="${vh.toFixed(1)}mm"` : ''}>` +
      el.map((e) => svgPrvek(e, X, Y, m)).join('') + '</svg>';
  }
  /** SVG 1D – tyče jedné skupiny pod sebou */
  function svg1D(pr, sk, o) {
    o = o || {};
    const maxL = Math.max(1, ...sk.tyce.map((t) => t.L)), sirka = 800, vyska = 36, mez = 14, k = sirka / maxL;
    let y = 4, h = '';
    for (const t of sk.tyce) {
      h += `<text x="0" y="${y + 9}" font-size="10" fill="#334155" font-weight="700">${t.cislo}. ${esc(t.typ.nazev || '')} – ${fmt(t.L, 0)} mm</text>`;
      y += 12;
      h += `<rect x="0" y="${y}" width="${t.L * k}" height="${vyska - 14}" fill="#f4ead8" stroke="#334155" stroke-width="0.8"/>`;
      if (t.okraj > 0) h += `<rect x="0" y="${y}" width="${(t.okraj - t.rez) * k}" height="${vyska - 14}" fill="#dddddd"/>`;
      for (const q of t.kusy) {
        const Q = pr.kusy1D[q.qi] || {};
        h += `<rect x="${q.x * k}" y="${y}" width="${q.L * k}" height="${vyska - 14}" fill="${barvaDilce(q.qi)}" stroke="#334155" stroke-width="0.6" class="kus1d" data-qi="${q.qi}"/>`;
        const txt = q.L * k > 70 ? `${q.qi + 1}.${q.c + 1} ${fmt(q.L, 1)}` : q.L * k > 30 ? fmt(q.L, 0) : '';
        if (txt) h += `<text x="${(q.x + q.L / 2) * k}" y="${y + 13.5}" font-size="9.5" text-anchor="middle" fill="#000">${esc(txt)}</text>`;
        if (q.L * k > 120 && Q.nazev) h += `<title>${esc(Q.nazev)}</title>`;
      }
      if (t.zbytek > 0) {
        const x0 = (t.konec + t.rez) * k;
        h += `<rect x="${x0}" y="${y}" width="${t.zbytek * k}" height="${vyska - 14}" fill="${t.pouzitelny ? '#e3f4e1' : '#eeeeee'}" stroke="${t.pouzitelny ? '#15803d' : '#999'}" stroke-dasharray="3 2" stroke-width="0.6"/>`;
        if (t.zbytek * k > 50) h += `<text x="${x0 + t.zbytek * k / 2}" y="${y + 13.5}" font-size="9" text-anchor="middle" fill="${t.pouzitelny ? '#15803d' : '#666'}">${t.pouzitelny ? 'zbytek ' : ''}${fmt(t.zbytek, 0)}</text>`;
      }
      y += vyska - 14 + mez;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 0 ${sirka + 4} ${Math.max(20, y)}" font-family="Liberation Sans, Arial, sans-serif">${h}</svg>`;
  }

  /* ---------------- DXF (desky vedle sebe, mm) ---------------- */
  function dxf(pr, v, o) {
    o = o || {};
    const L = [];
    const p = (...a) => { for (const x of a) L.push(String(x)); };
    const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
    p(0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC');
    p(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, 6);
    for (const [jm, bar] of [['DESKA', 8], ['OKRAJ', 9], ['DILCE', 7], ['ZBYTKY', 3], ['REZY', 1], ['TEXT', 5]]) p(0, 'LAYER', 2, jm, 70, 0, 62, bar, 6, 'CONTINUOUS');
    p(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
    const obd = (x, y, w, h, vrstva) => { p(0, 'LWPOLYLINE', 8, vrstva, 90, 4, 70, 1); for (const [a, b] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) p(10, n3(a), 20, n3(b)); };
    const txt = (x, y, h, s, vrstva) => p(0, 'TEXT', 8, vrstva || 'TEXT', 10, n3(x), 20, n3(y), 30, 0, 40, n3(h), 1, String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/×/g, 'x'), 72, 1, 11, n3(x), 21, n3(y));
    let ox = 0;
    for (const sk of v.d2.skupiny) for (const d of sk.desky) {
      obd(ox, 0, d.W, d.H, 'DESKA');
      if (d.okraj > 0) obd(ox + d.okraj, d.okraj, d.W - 2 * d.okraj, d.H - 2 * d.okraj, 'OKRAJ');
      txt(ox + d.W / 2, d.H + 40, 30, `${sk.material} c. ${d.cislo} ${fmt(d.W, 0)}x${fmt(d.H, 0)}`);
      for (const q of d.dily) {
        obd(ox + q.x, q.y, q.w, q.h, 'DILCE');
        if (o.texty !== false) txt(ox + q.x + q.w / 2, q.y + q.h / 2, Math.max(8, Math.min(40, Math.min(q.w, q.h) * 0.18)), oznaceni(q.di, q.c));
      }
      for (const z of d.zbytky || []) if (z.pouzitelny) obd(ox + z.x, z.y, z.w, z.h, 'ZBYTKY');
      for (const r of d.rezy || []) {
        const c = r.p + d.rez / 2, q = r.kus;
        p(0, 'LINE', 8, 'REZY');
        if (r.o === 'H') p(10, n3(ox + q.x), 20, n3(c), 30, 0, 11, n3(ox + q.x + q.w), 21, n3(c), 31, 0);
        else p(10, n3(ox + c), 20, n3(q.y), 30, 0, 11, n3(ox + c), 21, n3(q.y + q.h), 31, 0);
      }
      ox += d.W + 200;
    }
    p(0, 'ENDSEC', 0, 'EOF');
    return L.join('\n') + '\n';
  }

  /* ---------------- CSV ---------------- */
  const csvPole = (x) => { const s = String(x == null ? '' : x); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csvRadek = (a) => a.map(csvPole).join(';');
  const c2 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  function csvDilce(pr, v) {
    const hm = RP.mapaHran(pr), out = [csvRadek(['označení', 'název', 'materiál', 'deska', 'hotová délka', 'hotová šířka', 'řezná délka', 'řezná šířka', 'x', 'y', 'otočeno', 'hrana D1', 'hrana D2', 'hrana Š1', 'hrana Š2', 'poznámka'])];
    for (const sk of v.d2.skupiny) {
      for (const d of sk.desky) for (const q of d.dily) {
        const D = pr.dilce[q.di], rr = RP.rozmerRezu(D, hm, pr.nast), H = D.hrany || {};
        out.push(csvRadek([oznaceni(q.di, q.c), D.nazev, sk.material, d.cislo, c2(D.w), c2(D.h), c2(rr.w), c2(rr.h), c2(q.x), c2(q.y), q.rot ? 'ano' : 'ne',
          ...['d1', 'd2', 's1', 's2'].map((s) => (H[s] && hm[H[s]] ? hm[H[s]].nazev : '')), D.pozn || '']));
      }
      for (const q of sk.nezarazeno) { const D = pr.dilce[q.di]; out.push(csvRadek([oznaceni(q.di, q.c), D.nazev, sk.material, 'NEZAŘAZENO: ' + q.duvod, c2(D.w), c2(D.h)])); }
    }
    return '﻿' + out.join('\r\n') + '\r\n';
  }
  /** řezy s nastavením pravítka (šířka odřezávaného pruhu od hrany kusu) */
  function popisRezu(r, d) {
    const q = r.kus;
    const odmer = r.o === 'H' ? r.p - q.y : r.p - q.x;
    return { n: r.n, smer: r.o === 'H' ? 'podélný' : 'příčný', typ: r.typ === 'zarovnani' ? 'zarovnání' : r.stupen === 1 ? 'pruh' : 'dělení', odmer, delka: r.o === 'H' ? q.w : q.h, kus: `${fmt(q.w, 1)} × ${fmt(q.h, 1)}`, stupen: r.stupen, deska: d.cislo };
  }
  function csvRezy(pr, v) {
    const out = [csvRadek(['materiál', 'deska', 'řez', 'směr', 'typ', 'stupeň', 'pravítko (mm)', 'délka řezu (mm)', 'dělený kus'])];
    for (const sk of v.d2.skupiny) for (const d of sk.desky) for (const r of d.rezy || []) {
      const p = popisRezu(r, d);
      out.push(csvRadek([sk.material, d.cislo, p.n, p.smer, p.typ, p.stupen, c2(p.odmer), c2(p.delka), p.kus]));
    }
    return '﻿' + out.join('\r\n') + '\r\n';
  }
  function csv1D(pr, v) {
    const out = [csvRadek(['profil', 'tyč', 'polotovar', 'délka polotovaru', 'pořadí', 'označení', 'název', 'délka kusu', 'od (mm)', 'zbytek'])];
    for (const sk of v.d1.skupiny) {
      for (const t of sk.tyce) t.kusy.forEach((q, i) => {
        const Q = pr.kusy1D[q.qi];
        out.push(csvRadek([sk.profil, t.cislo, t.typ.nazev || '', c2(t.L), i + 1, oznaceni(q.qi, q.c), Q.nazev, c2(q.L), c2(q.x), i === t.kusy.length - 1 ? c2(t.zbytek) : '']));
      });
      for (const q of sk.nezarazeno) { const Q = pr.kusy1D[q.qi]; out.push(csvRadek([sk.profil, 'NEZAŘAZENO: ' + q.duvod, '', '', '', oznaceni(q.qi, q.c), Q.nazev, c2(Q.L)])); }
    }
    return '﻿' + out.join('\r\n') + '\r\n';
  }

  /* ---------------- štítky ---------------- */
  function stitky(pr, v) {
    const out = [], hm = RP.mapaHran(pr);
    for (const sk of v.d2.skupiny) {
      for (const d of sk.desky) for (const q of d.dily) {
        const D = pr.dilce[q.di], H = D.hrany || {};
        out.push({ ozn: oznaceni(q.di, q.c), nazev: D.nazev || '', w: D.w, h: D.h, material: sk.material, deska: `deska ${d.cislo}/${sk.desky.length}`, vlakna: !!(D.vlakna && sk.vlakna),
          hrany: { d1: H.d1 && hm[H.d1] ? hm[H.d1] : null, d2: H.d2 && hm[H.d2] ? hm[H.d2] : null, s1: H.s1 && hm[H.s1] ? hm[H.s1] : null, s2: H.s2 && hm[H.s2] ? hm[H.s2] : null },
          pozn: D.pozn || '', projekt: pr.nazev || '' });
      }
    }
    return out;
  }
  const FORMATY_STITKU = {
    a4_3x8: { nazev: 'A4 – 3 × 8 (70 × 37 mm)', W: 210, H: 297, sl: 3, ra: 8, w: 70, h: 37, ox: 0, oy: 0.5, gx: 0, gy: 0 },
    a4_3x7: { nazev: 'A4 – 3 × 7 (70 × 42,3 mm)', W: 210, H: 297, sl: 3, ra: 7, w: 70, h: 42.3, ox: 0, oy: 0, gx: 0, gy: 0 },
    a4_2x8: { nazev: 'A4 – 2 × 8 (105 × 37 mm)', W: 210, H: 297, sl: 2, ra: 8, w: 105, h: 37, ox: 0, oy: 0.5, gx: 0, gy: 0 },
    a4_2x6: { nazev: 'A4 – 2 × 6 (105 × 48 mm)', W: 210, H: 297, sl: 2, ra: 6, w: 105, h: 48, ox: 0, oy: 4.5, gx: 0, gy: 0 },
    a4_4x10: { nazev: 'A4 – 4 × 10 (48,5 × 25,4 mm)', W: 210, H: 297, sl: 4, ra: 10, w: 48.5, h: 25.4, ox: 8, oy: 21.5, gx: 0, gy: 0 },
    role_62x29: { nazev: 'Role 62 × 29 mm (štítkovač)', W: 62, H: 29, sl: 1, ra: 1, w: 62, h: 29, ox: 0, oy: 0, gx: 0, gy: 0 },
  };

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/×/g, 'x').replace(/⟲/g, '(o)').replace(/…/g, '...');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function pripravDoc(jsPDF, o, orient) {
    const doc = new jsPDF({ unit: 'mm', format: o.format || 'a4', orientation: orient || 'l', compress: true });
    let uni = false;
    if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
    const T = (s) => {
      let t = String(s);
      if (!uni) return bezDiakritiky(t);
      return t.replace(/⟲/g, '(otočeno)');
    };
    const font = (tucne) => { if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', tucne ? 'bold' : 'normal'); };
    return { doc, T, font, uni };
  }
  /** vykreslí prvky scény desky do PDF: x0,y0 levý horní roh desky na papíře, m mm/mm */
  function kresliScenu(ctx, el, x0, y0, m, H) {
    const { doc, T, font } = ctx;
    const X = (x) => x0 + x * m, Y = (y) => y0 + (H - y) * m;
    for (const e of el) {
      const c = rgb(e.c);
      doc.setDrawColor(...c);
      if (e.d === 'c') doc.setLineDashPattern([1.2, 0.8], 0);
      if (e.t === 'r') {
        doc.setLineWidth(Math.max(0.05, e.s || 0.2));
        if (e.f) doc.setFillColor(...rgb(e.f));
        doc.rect(X(e.x), Y(e.y + e.h), e.w * m, e.h * m, e.f ? (e.c ? 'FD' : 'F') : 'S');
      } else if (e.t === 'l') {
        doc.setLineWidth(Math.max(0.05, e.s || 0.2));
        for (let i = 1; i < e.b.length; i++) doc.line(X(e.b[i - 1][0]), Y(e.b[i - 1][1]), X(e.b[i][0]), Y(e.b[i][1]));
      } else if (e.t === 'k') {
        doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.setFillColor(...rgb(e.f || '#ffffff'));
        doc.circle(X(e.x), Y(e.y), e.r * m, 'FD');
      } else if (e.t === 'txt') {
        font(e.tucne); doc.setFontSize(e.h * m / 0.3528); doc.setTextColor(...c);
        const t = T(e.txt), w = doc.getTextWidth(t), u = (e.u || 0) * Math.PI / 180;
        const kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
        // svislé ukotvení: y scény je účaří posunuté o ~třetinu výšky
        const bx = X(e.x), by = Y(e.y);
        doc.text(t, bx - Math.cos(u) * kk, by + Math.sin(u) * kk, e.u ? { angle: e.u } : undefined);
      }
      if (e.d) doc.setLineDashPattern([], 0);
    }
  }
  function tabulka(ctx, x, y, sloupce, radky, o) {
    const { doc, T, font } = ctx;
    o = Object.assign({ h: 4.6, fs: 8, maxY: 200 }, o || {});
    let yy = y;
    const hlav = () => {
      font(true); doc.setFontSize(o.fs); doc.setTextColor(60, 60, 60);
      let xx = x; for (const s of sloupce) { const tx = s.a === 'r' ? xx + s.w - 1 : xx + 1; doc.text(T(s.n), tx, yy + o.h - 1.4, s.a === 'r' ? { align: 'right' } : undefined); xx += s.w; }
      doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.25); doc.line(x, yy + o.h, xx, yy + o.h); yy += o.h;
    };
    hlav();
    font(false); doc.setTextColor(0, 0, 0);
    for (const r of radky) {
      if (yy + o.h > o.maxY) { if (!o.novaStrana) break; o.novaStrana(); yy = o.y0 || 15; hlav(); font(false); doc.setTextColor(0, 0, 0); }
      let xx = x;
      doc.setFontSize(o.fs);
      sloupce.forEach((s, i) => {
        let t = T(r[i] == null ? '' : r[i]);
        while (t.length > 1 && doc.getTextWidth(t) > s.w - 1.6) t = t.slice(0, -2) + '…';
        const tx = s.a === 'r' ? xx + s.w - 1 : xx + 1;
        doc.text(t, tx, yy + o.h - 1.4, s.a === 'r' ? { align: 'right' } : undefined); xx += s.w;
      });
      doc.setDrawColor(215, 215, 215); doc.setLineWidth(0.1); doc.line(x, yy + o.h, xx, yy + o.h);
      yy += o.h;
    }
    return yy;
  }
  function meritko50(ctx, x, y) {
    const { doc, T, font } = ctx;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25); doc.rect(x, y, 50, 50, 'S');
    font(false); doc.setFontSize(7); doc.setTextColor(0, 0, 0); doc.text(T('kontrola tisku 50 × 50 mm'), x + 25, y + 26, { align: 'center' });
  }

  /** řezný plán: titulní souhrn, strana na desku (náhled + pořadí řezů), strany 1D */
  function pdfPlan(jsPDF, pr, v, o) {
    o = o || {};
    const ctx = pripravDoc(jsPDF, o, 'l'), { doc, T, font } = ctx;
    const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight(), M = 10;
    doc.setProperties({ title: (pr.nazev || 'Řezný plán'), creator: 'Řezný plán – optimalizace dělení' });
    const S = RP.souhrn(pr, v), dnes = new Date().toLocaleDateString('cs-CZ');
    const hlavicka = (txt, str) => {
      font(true); doc.setFontSize(13); doc.setTextColor(0, 0, 0); doc.text(T(txt), M, M + 4);
      font(false); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
      doc.text(T(`${pr.nazev || ''} · ${dnes}${str ? ' · ' + str : ''}`), PW - M, M + 4, { align: 'right' });
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.2); doc.line(M, M + 6, PW - M, M + 6);
    };
    // 1) souhrn
    hlavicka('Řezný plán – souhrn');
    font(false); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    const n = pr.nast;
    const radkyInfo = [
      `Režim: ${pr.rezim2d === 'volne' ? 'volné uložení (CNC)' : 'gilotinové řezy (formátovací / ruční pila s vodítkem)'} · šířka řezu ${fmt(n.rez, 1)} mm · okraj (zarovnání) ${fmt(n.okraj, 1)} mm`,
      `Desek: ${S.desek} · využití ${fmt(S.vyuziti * 100, 1)} % · cena desek ${fmt(S.cenaDesek, 0)} Kč · hrany ${fmt(S.cenaHran, 0)} Kč · tyče ${fmt(S.cenaTyci, 0)} Kč · celkem ${fmt(S.cenaCelkem, 0)} Kč`,
      `Řezů celkem: ${S.rezu} (${fmt(S.delkaRezu / 1000, 1)} m) · nezařazeno: ${S.nezarazeno2D + S.nezarazeno1D} ks`,
    ];
    radkyInfo.forEach((r, i) => doc.text(T(r), M, M + 13 + i * 4.6));
    let y = M + 29;
    y = tabulka(ctx, M, y, [{ n: 'Materiál', w: 70 }, { n: 'Desek', w: 16, a: 'r' }, { n: 'Formáty', w: 60 }, { n: 'Využití', w: 18, a: 'r' }, { n: 'Cena Kč', w: 22, a: 'r' }, { n: 'Metoda', w: 80 }],
      v.d2.skupiny.map((s) => {
        const f = {}; for (const d of s.desky) { const k = `${fmt(d.W, 0)}×${fmt(d.H, 0)}${d.typ.zbytek ? ' (zbytek)' : ''}`; f[k] = (f[k] || 0) + 1; }
        return [s.material, s.desky.length, Object.entries(f).map(([k, c]) => `${c}× ${k}`).join(', '), fmt(s.vyuziti * 100, 1) + ' %', fmt(s.cena, 0), s.metoda];
      }), { maxY: PH - M });
    if (v.d2.hrany.length) {
      y += 4;
      y = tabulka(ctx, M, y, [{ n: 'Hrana', w: 70 }, { n: 'Tl.', w: 14, a: 'r' }, { n: 'Šířka', w: 16, a: 'r' }, { n: 'Kusů hran', w: 20, a: 'r' }, { n: 'Metrů', w: 18, a: 'r' }, { n: 's rezervou', w: 22, a: 'r' }, { n: 'Cena Kč', w: 22, a: 'r' }],
        v.d2.hrany.map((h) => [h.nazev, fmt(h.tl, 1), fmt(h.sirka, 0), h.kusuHran, fmt(h.metru, 2), fmt(h.metruSRezervou, 2), fmt(h.cena, 0)]), { maxY: PH - M });
    }
    if (v.d1.skupiny.length) {
      y += 4;
      y = tabulka(ctx, M, y, [{ n: 'Profil (1D)', w: 70 }, { n: 'Tyčí', w: 14, a: 'r' }, { n: 'Délka m', w: 20, a: 'r' }, { n: 'Využití', w: 18, a: 'r' }, { n: 'Cena Kč', w: 22, a: 'r' }, { n: 'Metoda', w: 100 }],
        v.d1.skupiny.map((s) => [s.profil, s.tyce.length, fmt(s.delka / 1000, 2), fmt(s.vyuziti * 100, 1) + ' %', fmt(s.cena, 0), s.metoda]), { maxY: PH - M });
    }
    meritko50(ctx, PW - M - 50, PH - M - 50);
    // kusovník
    const hm = RP.mapaHran(pr);
    const hrTxt = (D) => ['d1', 'd2', 's1', 's2'].map((s) => (D.hrany && D.hrany[s] && hm[D.hrany[s]] ? s.toUpperCase().replace('S', 'Š') : '')).filter(Boolean).join(' ');
    if (pr.dilce.length) {
      doc.addPage('a4', 'l'); hlavicka('Kusovník dílců');
      tabulka(ctx, M, M + 10, [{ n: '#', w: 10, a: 'r' }, { n: 'Název', w: 60 }, { n: 'Materiál', w: 50 }, { n: 'Délka', w: 18, a: 'r' }, { n: 'Šířka', w: 18, a: 'r' }, { n: 'Ks', w: 10, a: 'r' }, { n: 'Řez. délka', w: 20, a: 'r' }, { n: 'Řez. šířka', w: 20, a: 'r' }, { n: 'Vlákna', w: 14 }, { n: 'Hrany', w: 24 }, { n: 'Poznámka', w: 33 }],
        pr.dilce.map((D, i) => { const rr = RP.rozmerRezu(D, hm, pr.nast); return [i + 1, D.nazev, D.material, fmt(D.w, 1), fmt(D.h, 1), D.ks, fmt(rr.w, 1), fmt(rr.h, 1), D.vlakna ? 'ano' : '', hrTxt(D), D.pozn || '']; }),
        { maxY: PH - M, novaStrana: () => { doc.addPage('a4', 'l'); hlavicka('Kusovník dílců (pokr.)'); }, y0: M + 10 });
    }
    // 2) desky
    for (const sk of v.d2.skupiny) sk.desky.forEach((d) => {
      doc.addPage('a4', 'l');
      hlavicka(`${sk.material} – deska ${d.cislo}/${sk.desky.length}`, `${fmt(d.W, 0)} × ${fmt(d.H, 0)} mm${d.typ.zbytek ? ' (zbytek ze skladu)' : ''} · využití ${fmt(d.vyuziti * 100, 1)} %`);
      const maRezy = d.rezy && d.rezy.length;
      const sirkaTab = maRezy ? 78 : 0;
      const oblW = PW - 2 * M - sirkaTab - 14, oblH = PH - 2 * M - 22;
      const m = Math.min(oblW / d.W, oblH / d.H);
      const el = scenaDesky(pr, d, { m, cisla: true, rezy: true, koty: true, zbytky: true, hrany: true });
      kresliScenu(ctx, el, M + 14, M + 16, m, d.H);
      font(false); doc.setFontSize(7); doc.setTextColor(80, 80, 80);
      doc.text(T(`Měřítko 1 : ${Math.round(1 / m)} · čísla dílců „řádek.kus“ · modře hrany · oranžově řezy v pořadí · zeleně čárkovaně použitelné zbytky`), M, PH - M + 2);
      if (maRezy) {
        const x = PW - M - sirkaTab;
        const rad = d.rezy.map((r) => { const p = popisRezu(r, d); return [p.n, p.smer, p.typ, fmt(p.odmer, 1), p.kus]; });
        tabulka(ctx, x, M + 10, [{ n: 'Řez', w: 9, a: 'r' }, { n: 'Směr', w: 15 }, { n: 'Typ', w: 16 }, { n: 'Pravítko', w: 15, a: 'r' }, { n: 'Dělený kus', w: 23 }], rad,
          { fs: 6.6, h: 3.5, maxY: PH - M - 4, novaStrana: () => { doc.addPage('a4', 'l'); hlavicka(`${sk.material} – deska ${d.cislo} – řezy (pokr.)`); }, y0: M + 10 });
      }
    });
    // 3) 1D
    for (const sk of v.d1.skupiny) {
      doc.addPage('a4', 'l'); hlavicka(`Dělení tyčí – ${sk.profil}`, `${sk.tyce.length} ks · využití ${fmt(sk.vyuziti * 100, 1)} %`);
      const maxL = Math.max(1, ...sk.tyce.map((t) => t.L)), sir = PW - 2 * M - 40, k = sir / maxL;
      let yy = M + 12;
      for (const t of sk.tyce) {
        if (yy > PH - M - 16) { doc.addPage('a4', 'l'); hlavicka(`Dělení tyčí – ${sk.profil} (pokr.)`); yy = M + 12; }
        font(true); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
        doc.text(T(`${t.cislo}. ${t.typ.nazev || ''} ${fmt(t.L, 0)} mm${t.typ.zbytek ? ' (zbytek)' : ''}`), M, yy + 3);
        yy += 4.5;
        doc.setDrawColor(51, 65, 85); doc.setLineWidth(0.25); doc.setFillColor(244, 234, 216); doc.rect(M, yy, t.L * k, 7, 'FD');
        for (const q of t.kusy) {
          doc.setFillColor(...rgb(barvaDilce(q.qi))); doc.rect(M + q.x * k, yy, q.L * k, 7, 'FD');
          if (q.L * k > 14) { font(false); doc.setFontSize(6.8); doc.setTextColor(0, 0, 0); doc.text(T(`${oznaceni(q.qi, q.c)}  ${fmt(q.L, 1)}`), M + (q.x + q.L / 2) * k, yy + 4.6, { align: 'center' }); }
        }
        if (t.zbytek > 0) { doc.setLineDashPattern([1, 0.7], 0); doc.setDrawColor(21, 128, 61); doc.rect(M + (t.konec + t.rez) * k, yy, t.zbytek * k, 7, 'S'); doc.setLineDashPattern([], 0); }
        font(false); doc.setFontSize(7); doc.setTextColor(60, 60, 60);
        doc.text(T(`zbytek ${fmt(t.zbytek, 0)} mm${t.pouzitelny ? ' ✓' : ''}`), M + sir + 2, yy + 4.6);
        yy += 11;
      }
    }
    return doc;
  }

  /** štítky na etikety; o.qr = funkce qrcode (volitelně) */
  function pdfStitky(jsPDF, pr, v, o) {
    o = o || {};
    const F = Object.assign({}, FORMATY_STITKU[o.format] || FORMATY_STITKU.a4_3x8, o.vlastni || {});
    const ctx = pripravDoc(jsPDF, Object.assign({}, o, { format: [F.W, F.H] }), F.W > F.H ? 'l' : 'p'), { doc, T, font } = ctx;
    doc.setProperties({ title: (pr.nazev || 'Řezný plán') + ' – štítky' });
    const st = stitky(pr, v), naList = F.sl * F.ra;
    const pos = Math.max(0, Math.min(naList - 1, (o.zacatek || 1) - 1));
    st.forEach((s, i0) => {
      const i = i0 + pos;
      if (i0 > 0 && i % naList === 0) doc.addPage([F.W, F.H], F.W > F.H ? 'l' : 'p');
      const j = i % naList, sl = j % F.sl, ra = Math.floor(j / F.sl);
      const x = F.ox + sl * (F.w + F.gx), y = F.oy + ra * (F.h + F.gy), w = F.w, h = F.h, pad = Math.min(3, h * 0.08);
      if (o.ramecky) { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1); doc.rect(x, y, w, h, 'S'); }
      let qrW = 0;
      if (o.qr) {
        try {
          o.qr.stringToBytes = o.qr.stringToBytesFuncs && o.qr.stringToBytesFuncs['UTF-8'] ? o.qr.stringToBytesFuncs['UTF-8'] : o.qr.stringToBytes;
          const q = o.qr(0, 'M'); q.addData(`RP;${s.ozn};${s.nazev};${s.w}x${s.h};${s.material};${s.deska}`, 'Byte'); q.make();
          const nM = q.getModuleCount(); qrW = Math.min(h - 2 * pad, w * 0.34);
          const c = qrW / nM; doc.setFillColor(0, 0, 0);
          for (let r = 0; r < nM; r++) for (let cc = 0; cc < nM; cc++) if (q.isDark(r, cc)) doc.rect(x + w - pad - qrW + cc * c, y + pad + r * c, c + 0.01, c + 0.01, 'F');
        } catch (e) { qrW = 0; }
      }
      const tw = w - 2 * pad - (qrW ? qrW + 1.5 : 0);
      const fz = Math.min(1, h / 37);
      font(true); doc.setFontSize(15 * fz); doc.setTextColor(0, 0, 0);
      doc.text(T(s.ozn), x + pad, y + pad + 5 * fz);
      font(false); doc.setFontSize(8.5 * fz);
      const fit = (t, maxW) => { t = T(t); while (t.length > 1 && doc.getTextWidth(t) > maxW) t = t.slice(0, -2) + '…'; return t; };
      const ozW = doc.getTextWidth(T(s.ozn)) * 15 / 8.5 + 2;
      doc.text(fit(s.nazev, tw - ozW), x + pad + ozW, y + pad + 4.6 * fz);
      font(true); doc.setFontSize(10 * fz);
      doc.text(T(`${fmt(s.w, 1)} × ${fmt(s.h, 1)} mm`), x + pad, y + pad + 10.5 * fz);
      font(false); doc.setFontSize(7 * fz); doc.setTextColor(50, 50, 50);
      doc.text(fit(`${s.material} · ${s.deska}`, tw), x + pad, y + pad + 14.5 * fz);
      if (h > 30) doc.text(fit(s.projekt, tw), x + pad, y + pad + 18 * fz);
      // nákres dílce s hranami (d1 dole, d2 nahoře, š1 vlevo, š2 vpravo)
      const sh = Math.max(5, h - pad * 2 - 20 * fz), sw = Math.min(tw * 0.55, sh * Math.max(0.8, Math.min(2.4, s.w / Math.max(1, s.h))));
      const sx = x + pad, sy = y + h - pad - sh;
      if (sh > 4) {
        doc.setDrawColor(90, 90, 90); doc.setLineWidth(0.2); doc.rect(sx, sy, sw, sh, 'S');
        doc.setDrawColor(29, 78, 216);
        const L = (h2, a, b, c, d) => { if (!h2) return; doc.setLineWidth(h2.tl >= 1 ? 0.9 : 0.45); doc.line(a, b, c, d); };
        L(s.hrany.d1, sx, sy + sh, sx + sw, sy + sh); L(s.hrany.d2, sx, sy, sx + sw, sy); L(s.hrany.s1, sx, sy, sx, sy + sh); L(s.hrany.s2, sx + sw, sy, sx + sw, sy + sh);
        if (s.vlakna) { doc.setDrawColor(138, 109, 59); doc.setLineWidth(0.25); const yy = sy + sh / 2; doc.line(sx + sw * 0.2, yy, sx + sw * 0.8, yy); doc.line(sx + sw * 0.8 - 1, yy - 0.6, sx + sw * 0.8, yy); doc.line(sx + sw * 0.8 - 1, yy + 0.6, sx + sw * 0.8, yy); }
        const hr = ['d1', 'd2', 's1', 's2'].filter((k) => s.hrany[k]).map((k) => k.toUpperCase().replace('S', 'Š'));
        doc.setFontSize(6.2 * fz); doc.setTextColor(29, 78, 216);
        if (hr.length) doc.text(fit('hrany ' + hr.join(' '), tw - sw - 2), sx + sw + 2, sy + sh - 0.5);
      }
    });
    return doc;
  }

  const API = { scenaDesky, svgDesky, svgPrvek, svg1D, dxf, csvDilce, csvRezy, csv1D, popisRezu, stitky, FORMATY_STITKU, pdfPlan, pdfStitky, barvaDilce, oznaceni, bezDiakritiky, PALETA };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.RPV = API;
})(typeof window !== 'undefined' ? window : globalThis);
