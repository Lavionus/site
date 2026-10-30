/* ============================================================
   Šablony pro horní frézku – výstupy (bez DOM): scéna dílu, SVG, DXF (R12, oblouky jako vydutí), strany PDF, PDF (jsPDF parametrem)
   prvek: {t:'l', b:[[x,y]..], z, s, c, d:'c'|'o', v} | {t:'k', k: kontura, s, c, d, v} | {t:'txt', x, y, h, txt, a, u, c, v}
   Vrstvy (v): rez (řezat), tvar (výsledný řez – reference), osa (dráha středu kroužku), doraz, hrana, gravura, zahloubeni, popis
   ============================================================ */
(function (koren) {
  'use strict';
  const SF = koren.SF || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const G = koren.SFG || (typeof require !== 'undefined' ? require('./geom.js') : null);
  const n3 = (x) => (Math.round(x * 1000) / 1000).toString();
  const cz = SF.cz;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const BARVY = { rez: '#000000', tvar: '#777777', osa: '#1f5fa8', doraz: '#8a5a20', hrana: '#d04a00', gravura: '#2c7a3a', zahloubeni: '#2c7a3a', popis: '#000000' };

  /* ---------------- scéna ---------------- */
  function scena(dil, nast, o) {
    o = o || {};
    const N = SF.normNast(nast), pr = [], V = dil.V;
    const L = (b, z, v, s, d) => pr.push({ t: 'l', b, z, s: s || 0.25, c: BARVY[v] || '#000', d, v });
    const K = (k, v, s, d) => pr.push({ t: 'k', k, s: s || 0.3, c: BARVY[v] || '#000', d, v });
    const T = (x, y, txt, h, a, u, v) => pr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', u: u || 0, c: BARVY[v || 'popis'], v: v || 'popis' });
    // obrys k řezání
    if (dil.deska.kontury) for (const k of dil.deska.kontury) K(k, 'rez', 0.35);
    else for (const p of dil.deska.polys) L(p, true, 'rez', 0.35);
    // dorazy (zespodu)
    for (const d of dil.dorazy || []) for (const p of d.polys) L(p, true, 'doraz', 0.25, 'c');
    for (const s of dil.srouby || []) if (s.zahl > s.d) K(G.kruhKontura(s.c, s.zahl / 2), 'zahloubeni', 0.2, 'c');
    // reference: výsledný řez a dráha středu kroužku
    if (N.drahy !== false && !o.bezDrah) {
      if (dil.tvar && dil.druh === 'sablona') {
        if (dil.tvar.kontury) for (const k of dil.tvar.kontury) K(k, 'tvar', 0.18, 'c');
        else for (const p of dil.tvar.polys) L(p, true, 'tvar', 0.18, 'c');
      }
      for (const p of dil.stred || []) L(p, true, 'osa', 0.18, 'o');
      if (dil.typ === 'voditko' && dil.rez) for (const p of dil.rez) L(p, true, 'tvar', 0.18, 'c');
    }
    for (const z of dil.znacky || []) L(z.b, false, z.v || 'gravura', z.v === 'hrana' ? 0.3 : 0.3, z.c ? 'c' : null);
    for (const t of dil.texty || []) T(t.x, t.y, t.txt, t.h || 3, t.a, t.u, t.v || 'gravura');
    // popis
    const ob = dil.deska.obal;
    if (!o.bezPopisu) {
      const vedP = V ? `${V.lozisko ? 'ložisko' : 'kroužek'} Ø${cz(V.Dv, 2)} · fréza Ø${cz(V.Df, 2)} · o = ${cz(V.o, 2)} mm` : '';
      const radky = [`${dil.id} – ${dil.nazev}`, dil.druh === 'sablona' ? `${dil.kop === 'vnejsi' ? 'VNĚJŠÍ' : 'VNITŘNÍ'} kopírování · ${vedP}` : vedP, dil.popis || ''].filter(Boolean);
      // umístit do volného místa v desce, jinak pod díl
      const h = 3, w = Math.max(...radky.map((r) => r.length)) * h * 0.52, hv = radky.length * h * 1.45;
      let pos = null;
      const plne = dil.deska.polys;
      for (let y = ob.y1 - hv - 4; y >= ob.y0 + 3 && !pos; y -= 3) for (let x = ob.x0 + 4; x + w <= ob.x1 - 3; x += 3) {
        if (G.plochaOblasti(G.rozdil([[[x - 1, y - 1], [x + w + 1, y - 1], [x + w + 1, y + hv + 1], [x - 1, y + hv + 1]]], plne)) < 1e-3) { pos = [x, y + hv - h]; break; }
      }
      const p0 = pos || [ob.x0, ob.y0 - 5];
      radky.forEach((r, i) => T(p0[0], p0[1] - i * h * 1.45, r, i ? 2.4 : h, 'l', 0, 'popis'));
    }
    const vse = [];
    for (const e of pr) { if (e.t === 'l') vse.push(e.b); else if (e.t === 'k') vse.push(G.konturaNaBody(e.k, 0.1)); }
    const b = G.obal(vse.length ? vse : [[[0, 0], [1, 1], [0, 1]]]);
    return { prvky: pr, x0: Math.min(b.x0, ob.x0) - 2, y0: Math.min(b.y0, ob.y0) - (pos0(pr, ob) ? 10 : 2), x1: Math.max(b.x1, ob.x1) + 2, y1: Math.max(b.y1, ob.y1) + 2 };
  }
  const pos0 = (pr, ob) => pr.some((e) => e.t === 'txt' && e.y < ob.y0);

  /* ---------------- SVG ---------------- */
  function svgPrvek(e, o) {
    const c = o && o.cerne ? '#000' : e.c, sw = Math.max(0.05, o && o.laser && e.v === 'rez' ? 0.1 : e.s);
    const dash = e.d === 'c' ? ` stroke-dasharray="${n3(sw * 10 + 1)} ${n3(sw * 7 + 0.8)}"` : e.d === 'o' ? ` stroke-dasharray="${n3(sw * 30 + 3)} ${n3(sw * 8 + 1)} ${n3(sw * 3 + 0.4)} ${n3(sw * 8 + 1)}"` : '';
    const lay = ` data-vrstva="${e.v || ''}"`;
    if (e.t === 'l') return `<path${lay} d="${e.b.map((q, i) => (i ? 'L' : 'M') + n3(q[0]) + ' ' + n3(-q[1])).join('')}${e.z ? 'Z' : ''}" fill="none" stroke="${o && o.laser && e.v === 'rez' ? '#ff0000' : c}" stroke-width="${n3(sw)}" stroke-linejoin="round"${dash}/>`;
    if (e.t === 'k') return `<path${lay} d="${G.konturaNaSvg(e.k, n3)}" fill="none" stroke="${o && o.laser && e.v === 'rez' ? '#ff0000' : c}" stroke-width="${n3(sw)}"${dash}/>`;
    if (e.t === 'txt') {
      const an = e.a === 'r' ? 'end' : e.a === 'c' ? 'middle' : 'start', rot = e.u ? ` transform="rotate(${n3(-e.u)} ${n3(e.x)} ${n3(-e.y)})"` : '';
      return `<text${lay} x="${n3(e.x)}" y="${n3(-e.y)}" font-size="${n3(e.h)}" text-anchor="${an}" dominant-baseline="${e.a === 'c' && e.v === 'gravura' ? 'central' : 'auto'}" fill="${c}"${rot}>${esc(e.txt)}</text>`;
    }
    return '';
  }
  /** o: {okraj, pozadi, sirkaPx, laser (řez červeně 0,1 mm), vrstvy: Set povolených, pod, navic} */
  function svg(sc, o) {
    o = Object.assign({ okraj: 3, pozadi: '#ffffff' }, o || {});
    const m = o.okraj, x = sc.x0 - m, y = -sc.y1 - m, w = sc.x1 - sc.x0 + 2 * m, h = sc.y1 - sc.y0 + 2 * m;
    const rozm = o.sirkaPx ? 'width="100%"' : `width="${n3(w)}mm" height="${n3(h)}mm"`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" ${rozm} viewBox="${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)}" font-family="Liberation Sans, Arial, Helvetica, sans-serif">`;
    if (o.pozadi) s += `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" fill="${o.pozadi}"/>`;
    if (o.pod) s += o.pod;
    const sk = {};
    for (const e of sc.prvky) { if (o.vrstvy && !o.vrstvy.has(e.v)) continue; (sk[e.v] = sk[e.v] || []).push(svgPrvek(e, o)); }
    for (const v of Object.keys(sk)) s += `<g id="${v}">${sk[v].join('')}</g>`;
    if (o.navic) s += o.navic;
    return s + '</svg>';
  }

  /* ---------------- DXF R12 ---------------- */
  const DXF_VRSTVY = { rez: 7, tvar: 8, osa: 5, doraz: 30, hrana: 1, gravura: 3, zahloubeni: 3, popis: 8 };
  function dxf(sc) {
    const out = [], g = (k, v) => { out.push(String(k)); out.push(String(v)); };
    const vrstvy = Object.keys(DXF_VRSTVY);
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, vrstvy.length);
    for (const v of vrstvy) { g(0, 'LAYER'); g(2, v.toUpperCase()); g(70, 0); g(62, DXF_VRSTVY[v]); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ø/g, '%%c').replace(/[−–]/g, '-').replace(/[^\x20-\x7e]/g, '');
    const poly = (ly, body, zav) => {
      g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, zav ? 1 : 0);
      for (const q of body) { g(0, 'VERTEX'); g(8, ly); g(10, n3(q.x)); g(20, n3(q.y)); g(30, 0); if (Math.abs(q.b) > 1e-12) g(42, Math.round(q.b * 1e9) / 1e9); }
      g(0, 'SEQEND'); g(8, ly);
    };
    for (const e of sc.prvky) {
      const ly = String(e.v || 'rez').toUpperCase();
      if (e.t === 'l') {
        if (e.b.length === 2 && !e.z) { g(0, 'LINE'); g(8, ly); g(10, n3(e.b[0][0])); g(20, n3(e.b[0][1])); g(30, 0); g(11, n3(e.b[1][0])); g(21, n3(e.b[1][1])); g(31, 0); continue; }
        poly(ly, e.b.map((q) => ({ x: q[0], y: q[1], b: 0 })), e.z);
      } else if (e.t === 'k') {
        if (e.k.length === 1 && e.k[0].t === 'o' && Math.abs(Math.abs(e.k[0].u1 - e.k[0].u0) - 2 * Math.PI) < 1e-9) { g(0, 'CIRCLE'); g(8, ly); g(10, n3(e.k[0].c[0])); g(20, n3(e.k[0].c[1])); g(30, 0); g(40, n3(e.k[0].r)); continue; }
        // oblouky delší než 180° rozdělit (vydutí ≤ 1)
        const k = [];
        for (const s of e.k) {
          if (s.t === 'o' && Math.abs(s.u1 - s.u0) > Math.PI * 0.999) { const n = Math.ceil(Math.abs(s.u1 - s.u0) / (Math.PI * 0.99)); for (let i = 0; i < n; i++) k.push({ t: 'o', c: s.c, r: s.r, u0: s.u0 + (s.u1 - s.u0) * i / n, u1: s.u0 + (s.u1 - s.u0) * (i + 1) / n }); }
          else k.push(s);
        }
        poly(ly, G.konturaNaVyduti(k), true);
      } else if (e.t === 'txt') {
        const al = e.a === 'l' ? 0 : e.a === 'r' ? 2 : 1;
        g(0, 'TEXT'); g(8, ly); g(10, n3(e.x)); g(20, n3(e.y)); g(30, 0); g(40, n3(e.h * 0.72)); g(1, ascii(e.txt));
        if (e.u) g(50, n3(e.u));
        if (al) { g(72, al); g(11, n3(e.x)); g(21, n3(e.y)); g(31, 0); }
      }
    }
    g(0, 'ENDSEC'); g(0, 'EOF');
    return out.join('\r\n') + '\r\n';
  }

  /* ---------------- strany PDF (mm papíru, y dolů) ---------------- */
  function strany(nv, nast, o) {
    o = o || {};
    const S = SF.normNast(nast), [pw, ph] = SF.rozmerPapiru(S), ok = S.okrajTisku, out = [];
    const Kk = SF.korekceMeritka(S.kalibX, S.kalibY);
    const pt = (W, H) => ({ W, H, obsah: [], navrch: [], clip: null });
    const Lp = (arr, b, s, c, d) => arr.push({ t: 'l', b, s, c: c || '#000000', d });
    const Tp = (arr, x, y, txt, h, a, u, c) => arr.push({ t: 'txt', x, y, txt: String(txt), h, a: a || 'l', u: u || 0, c: c || '#000000' });
    const meritka = (st, W, H, kx, ky, mapka) => {
      const y = H - ok - 3.2, x0 = ok;
      st.navrch.push({ t: 'm', x0, y, x1: x0 + 100 * kx, osa: 'x' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[x0 + i * 10 * kx, y], [x0 + i * 10 * kx, y - (i % 5 ? 1.5 : 3)]], 0.2);
      Tp(st.navrch, x0, y - 3.6, '0', 2, 'c'); Tp(st.navrch, x0 + 50 * kx, y - 3.6, '50', 2, 'c'); Tp(st.navrch, x0 + 100 * kx, y - 3.6, '100 mm', 2, 'c');
      Tp(st.navrch, x0 + 100 * kx + 7, y - 4.2, 'Kontrola: úsečky musí mít přesně 50 a 100 mm vodorovně i svisle.', 2.2);
      Tp(st.navrch, x0 + 100 * kx + 7, y - 1, (Kk.kx !== 1 || Kk.ky !== 1) ? `Korekce tisku X ×${Kk.kx.toFixed(4).replace('.', ',')}, Y ×${Kk.ky.toFixed(4).replace('.', ',')}.` : 'Jinak změřte a zadejte do Kalibrace.', 2.2);
      const xs = W - ok - 2.5, ys = ok;
      st.navrch.push({ t: 'm', x0: xs, y: ys, y1: ys + 100 * ky, osa: 'y' });
      for (let i = 0; i <= 10; i++) Lp(st.navrch, [[xs, ys + i * 10 * ky], [xs - (i % 5 ? 1.5 : 3), ys + i * 10 * ky]], 0.2);
      Tp(st.navrch, xs - 3.6, ys + 0.8, '0', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 50 * ky + 0.7, '50', 2, 'r'); Tp(st.navrch, xs - 3.6, ys + 100 * ky + 0.7, '100', 2, 'r');
      Tp(st.navrch, xs - 1, ys + 100 * ky + 6, 'svisle 100 mm', 2.2, 'r', 90);
      if (mapka) {
        const { nx, ny, r, c } = mapka, mx = W - ok - SF.PRAVY_PAS - 3.2 * nx, my = H - ok - 14.5;
        for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) st.navrch.push({ t: 'r', x: mx + j * 3.2, y: my + i * 3.2, w: 2.8, h: 2.8, s: 0.15, c: '#000000', f: i === r && j === c });
      }
    };
    const dily = nv.dily.filter((d) => !o.jenDil || d.id === o.jenDil);
    for (const d of dily) {
      const sc = scena(d, S);
      const rv = SF.rozvrhListu(sc, pw, ph, S), Nl = rv.listy.length;
      for (const l of rv.listy) {
        const st = pt(rv.W, rv.H); st.typ = 'sablona'; st.dil = d.id; st.list = l; st.rozvrh = rv;
        const X = (x) => ok + (x - l.x0) * rv.kx, Y = (y) => ok + (l.y1 - y) * rv.ky;
        st.clip = { x: ok, y: ok, w: rv.uw, h: rv.uh };
        for (const e of sc.prvky) {
          if (e.t === 'l') st.obsah.push({ t: 'l', b: e.b.map((q) => [X(q[0]), Y(q[1])]), s: e.s, c: e.c, d: e.d, z: e.z });
          else if (e.t === 'k') st.obsah.push({ t: 'l', b: G.konturaNaBody(e.k, 0.02).map((q) => [X(q[0]), Y(q[1])]), s: e.s, c: e.c, d: e.d, z: true });
          else if (e.t === 'txt') st.obsah.push({ t: 'txt', x: X(e.x), y: Y(e.y), txt: e.txt, h: e.h, a: e.a, u: e.u, c: e.c });
        }
        if (!rv.jeden) {
          const gx = rv.g * rv.kx, gy = rv.g * rv.ky;
          if (l.c < rv.nx - 1) Lp(st.navrch, [[ok + rv.uw - gx, ok], [ok + rv.uw - gx, ok + rv.uh]], 0.2, '#888888', 'c');
          if (l.r < rv.ny - 1) Lp(st.navrch, [[ok, ok + rv.uh - gy], [ok + rv.uw, ok + rv.uh - gy]], 0.2, '#888888', 'c');
          for (const [x, y] of [[ok, ok], [ok + rv.uw, ok], [ok, ok + rv.uh], [ok + rv.uw, ok + rv.uh]]) { Lp(st.navrch, [[x - 3, y], [x + 3, y]], 0.2); Lp(st.navrch, [[x, y - 3], [x, y + 3]], 0.2); }
          if (l.c > 0 || l.r > 0) Tp(st.navrch, ok + 4, ok - 2.2, 'ořízněte ' + (l.c > 0 ? 'levý' : '') + (l.c > 0 && l.r > 0 ? ' a ' : '') + (l.r > 0 ? 'horní' : '') + ' okraj a přiložte na čárkovanou čáru sousedního listu', 2.4, 'l', 0, '#555555');
        }
        Tp(st.navrch, ok, rv.H - ok - SF.PATA + 4.5, `${o.nazev ? o.nazev + ' · ' : ''}${d.id} – ${d.nazev}${Nl > 1 ? ` · list ${l.r * rv.nx + l.c + 1}/${Nl} (řádek ${l.r + 1}, sloupec ${l.c + 1})` : ''} · tiskněte ve skutečné velikosti (100 %)`, 2.6);
        meritka(st, rv.W, rv.H, rv.kx, rv.ky, Nl > 1 ? { nx: rv.nx, ny: rv.ny, r: l.r, c: l.c } : null);
        out.push(st);
      }
    }
    // textová strana: výpočet, varování, kusovník, postup, kontrolní čtverec
    const W = pw, H = ph, sir = W - 2 * ok;
    let st = null, y = 0;
    const nova = () => { st = pt(W, H); st.typ = 'text'; out.push(st); y = ok + 6; };
    const radek = (txt, h, c) => { if (!st || y > H - ok - 8) nova(); Tp(st.navrch, ok, y, txt, h || 3, 'l', 0, c); y += (h || 3) * 1.5; };
    // v jiném jazyce webu (i18n.js) přeložit celý odstavec ještě před zalomením do řádků
    const odstavec = (txt, h) => { if (window.I18N) txt = I18N.preloz(String(txt)); const max = Math.floor(sir / ((h || 3) * 0.5)); let r = ''; for (const s of String(txt).split(' ')) { if ((r + ' ' + s).length > max) { radek(r, h); r = s; } else r = r ? r + ' ' + s : s; } if (r) radek(r, h); };
    nova();
    radek(`${o.nazev || 'Šablona pro horní frézku'}`, 5); y += 1;
    if (nv.info) odstavec(nv.info, 3);
    for (const v of nv.varovani || []) odstavec((window.I18N ? I18N.preloz('Pozor:') : 'Pozor:') + ' ' + (window.I18N ? I18N.preloz(v) : v), 2.8);
    y += 2;
    radek('Kusovník', 4);
    for (const r of SF.kusovnik(nv)) odstavec(`${r.polozka} – ${r.ks} ks – ${r.rozmer}${r.pozn ? ' (' + r.pozn + ')' : ''}`, 2.7);
    y += 3;
    radek('Postup', 4);
    for (const t of (o.postup || [
      '1. Vytiskněte 100 % (bez „přizpůsobit stránce“), změřte kontrolní úsečky 100 mm v X i Y. Při odchylce zadejte naměřené hodnoty do Kalibrace.',
      '2. Listy slepte podle čárkovaných čar, nalepte na desku (MDF/překližka), vyřízněte těsně vedle plné čáry a dobruste přesně na čáru. Pro laser/CNC použijte DXF/SVG.',
      '3. Šablonu i obrobek pevně upněte (svěrky, oboustranná páska, vruty do odpadu). Kroužek vystřeďte.',
      '4. Frézujte po vrstvách (viz hloubka třísky), kroužek celou dobu přitlačený k hraně šablony; směr posuvu proti otáčení frézy (nesousledně).',
    ])) odstavec(t, 2.8);
    y += 4;
    if (y > H - ok - 62) nova();
    radek('Kontrolní čtverec 50 × 50 mm', 3);
    st.navrch.push({ t: 'r', x: ok, y, w: 50 * Kk.kx, h: 50 * Kk.ky, s: 0.25, c: '#000000' });
    Tp(st.navrch, ok + 25 * Kk.kx, y + 25 * Kk.ky + 1, '50 × 50 mm', 3.4, 'c');
    return out;
  }

  /* ---------------- PDF ---------------- */
  const bezDiakritiky = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[−–]/g, '-').replace(/[„“]/g, '"').replace(/°/g, ' st.').replace(/Ø/g, 'O').replace(/×/g, 'x').replace(/[⊕⊖]/g, '+');
  function rgb(hex) { const v = parseInt(String(hex || '#000000').slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  /** o: {pismo (TTF base64), nazev} – Liberation nemá Ø ani ⊕, proto se Ø nahrazuje kresbou nebo „O“ */
  function pdf(jsPDF, str, o) {
    o = o || {};
    let doc = null, uni = false;
    const T = (s) => (uni ? String(s).replace(/[⊕⊖]/g, '±') : bezDiakritiky(s));
    for (const st of str) {
      const orient = st.W > st.H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [st.W, st.H], orientation: orient, compress: true });
        if (o.pismo) { try { doc.addFileToVFS('LiberationSans-Regular.ttf', o.pismo); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true; } catch (e) { doc.setFont('helvetica', 'normal'); } }
        doc.setProperties({ title: o.nazev || 'Šablona pro horní frézku', creator: 'Šablony pro horní frézku – tisk 1:1' });
      } else doc.addPage([st.W, st.H], orient);
      const kresli = (e) => {
        const c = rgb(e.c); doc.setDrawColor(...c); doc.setFillColor(...c);
        if (e.t === 'l') {
          doc.setLineWidth(Math.max(0.05, e.s || 0.2));
          const s = Math.max(0.12, e.s || 0.2);
          if (e.d === 'c') doc.setLineDashPattern([s * 10 + 1, s * 7 + 0.8], 0); else if (e.d === 'o') doc.setLineDashPattern([s * 30 + 3, s * 8 + 1, s * 3 + 0.4, s * 8 + 1], 0);
          if (e.b.length === 2 && !e.z) doc.line(e.b[0][0], e.b[0][1], e.b[1][0], e.b[1][1]);
          else { const seg = []; for (let i = 1; i < e.b.length; i++) seg.push([e.b[i][0] - e.b[i - 1][0], e.b[i][1] - e.b[i - 1][1]]); doc.lines(seg, e.b[0][0], e.b[0][1], [1, 1], 'S', !!e.z); }
          if (e.d) doc.setLineDashPattern([], 0);
        } else if (e.t === 'r') { doc.setLineWidth(Math.max(0.05, e.s || 0.2)); doc.rect(e.x, e.y, e.w, e.h, e.f ? 'FD' : 'S'); }
        else if (e.t === 'm') {
          doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
          if (e.osa === 'x') doc.line(e.x0, e.y, e.x1, e.y); else doc.line(e.x0, e.y, e.x0, e.y1);
        } else if (e.t === 'txt') {
          if (uni) doc.setFont('LS', 'normal'); else doc.setFont('helvetica', 'normal');
          doc.setFontSize(e.h / 0.3528); doc.setTextColor(...c);
          // znak Ø Liberation nemá → kreslený kroužek s čárou
          const casti = String(e.txt).split('Ø');
          let t = T(casti.join(uni ? ' ' : 'O'));
          const w = doc.getTextWidth(t), u = (e.u || 0) * Math.PI / 180, kk = e.a === 'r' ? w : e.a === 'c' ? w / 2 : 0;
          const x = e.x - Math.cos(u) * kk, y = e.y + Math.sin(u) * kk;
          doc.text(t, x, y, e.u ? { angle: e.u } : undefined);
          if (uni && casti.length > 1 && !e.u) {
            let pos = 0;
            for (let i = 0; i < casti.length - 1; i++) {
              pos += doc.getTextWidth(casti[i]);
              const sw = doc.getTextWidth(' '), cx = x + pos + sw / 2, cy = y - e.h * 0.36, r = e.h * 0.3;
              doc.setLineWidth(Math.max(0.08, e.h * 0.07)); doc.setDrawColor(...c); doc.circle(cx, cy, r, 'S'); doc.line(cx - r * 1.2, cy + r * 1.2, cx + r * 1.2, cy - r * 1.2);
              pos += sw;
            }
          }
        }
      };
      if (st.clip) { doc.saveGraphicsState(); doc.rect(st.clip.x, st.clip.y, st.clip.w, st.clip.h, null); doc.clip(); doc.discardPath(); }
      for (const e of st.obsah) kresli(e);
      if (st.clip) doc.restoreGraphicsState();
      for (const e of st.navrch) kresli(e);
    }
    if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4' });
    return doc;
  }

  const API = { scena, svg, svgPrvek, dxf, strany, pdf, bezDiakritiky, BARVY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.SFV = API;
})(typeof window !== 'undefined' ? window : globalThis);
