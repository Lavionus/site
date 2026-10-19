/* ============================================================
   Technický generátor pro tisk – jádro (bez DOM, testuje se v node).
   Každý generátor vrací „kresbu“: { w, h, prvky, nazev, info }.
   Vše je v milimetrech, počátek vlevo nahoře, osa y dolů (jako SVG).

   Prvky:
     {t:'cara',  x1,y1,x2,y2, s, v}
     {t:'kruh',  cx,cy,r, s, v, vypln}
     {t:'oblouk',cx,cy,r, t1,t2, s, v}       úhly „hodinové“: 0° nahoře, + po směru hodin, t1 < t2
     {t:'cesta', body:[[x,y]…], uzavrena, s, v}
     {t:'text',  x,y, txt, vel, zar:'s'|'l'|'p', rot, v}
                 (x,y) = střed výšky verzálek; vel = výška verzálek/číslic v mm;
                 rot = otočení ve stupních po směru hodin
   s = tloušťka čáry (mm), v = vrstva: 'kresba' | 'rez' (obrys k vystřižení/řezu) | 'pomoc'
   b = volitelná barva (#rrggbb), jinak barva vrstvy.
   ============================================================ */
(function (koren) {
  'use strict';
  const TT = {};
  const PI = Math.PI;
  const rad = (d) => d * PI / 180;

  /* ---------- formát čísel (česky) ---------- */
  function fmt(n, des) {
    if (!isFinite(n)) return '–';
    if (des == null) des = 3;
    let s = (Math.round(n * Math.pow(10, des)) / Math.pow(10, des)).toFixed(des);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.replace('-', '−').replace('.', ',');
  }
  TT.fmt = fmt;
  /* číslo pro SVG/DXF (tečka, bez zbytečných nul) */
  TT.n = (x) => { const s = (Math.round(x * 10000) / 10000).toString(); return s === '-0' ? '0' : s; };

  /* Bezpečný výraz z pole formuláře: „128,5/2“, „3*25.4“, „1in“, „2,54“. */
  function vyraz(s) {
    if (typeof s === 'number') return s;
    if (s == null) return NaN;
    let t = String(s).trim().replace(/−/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
    if (!t) return NaN;
    t = t.replace(/(\d(?:\.\d*)?|\.\d+)(in|")/g, '($1*25.4)').replace(/(\d(?:\.\d*)?|\.\d+)mm/g, '$1').replace(/(\d(?:\.\d*)?|\.\d+)cm/g, '($1*10)');
    if (!/^[0-9+\-*/().]+$/.test(t)) return NaN;
    // vlastní parser (žádné eval)
    let i = 0;
    const cis = () => { const m = /^(\d+\.?\d*|\.\d+)/.exec(t.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
    const fak = () => {
      if (t[i] === '-') { i++; return -fak(); }
      if (t[i] === '+') { i++; return fak(); }
      if (t[i] === '(') { i++; const v = sou(); if (t[i] !== ')') throw 0; i++; return v; }
      return cis();
    };
    const sou2 = () => { let v = fak(); while (t[i] === '*' || t[i] === '/') { const o = t[i++]; const w = fak(); v = o === '*' ? v * w : v / w; } return v; };
    const sou = () => { let v = sou2(); while (t[i] === '+' || t[i] === '-') { const o = t[i++]; const w = sou2(); v = o === '+' ? v + w : v - w; } return v; };
    try { const v = sou(); return i === t.length && isFinite(v) ? v : NaN; } catch (e) { return NaN; }
  }
  TT.vyraz = vyraz;

  /* ---------- konstruktory prvků ---------- */
  const cara = (x1, y1, x2, y2, s, v, b) => ({ t: 'cara', x1, y1, x2, y2, s, v: v || 'kresba', b });
  const kruh = (cx, cy, r, s, v, vypln) => ({ t: 'kruh', cx, cy, r, s, v: v || 'kresba', vypln: !!vypln });
  const oblouk = (cx, cy, r, t1, t2, s, v) => ({ t: 'oblouk', cx, cy, r, t1, t2, s, v: v || 'kresba' });
  const cesta = (body, uzavrena, s, v) => ({ t: 'cesta', body, uzavrena: !!uzavrena, s, v: v || 'kresba' });
  const text = (x, y, txt, vel, o) => ({ t: 'text', x, y, txt: String(txt), vel, zar: (o && o.zar) || 's', rot: (o && o.rot) || 0, v: (o && o.v) || 'kresba', b: o && o.b });
  TT.prvky = { cara, kruh, oblouk, cesta, text };

  /* bod na kružnici, úhel hodinový (0 nahoře, po směru hodin) */
  const bodK = (cx, cy, r, t) => [cx + r * Math.sin(rad(t)), cy - r * Math.cos(rad(t))];
  TT.bodK = bodK;

  /* Přibližná šířka textu (Liberation Sans / Arial; číslice 0,556 em). Pro obálku a kolize. */
  const KAP = 0.716;                         // výška číslic / em (Liberation Sans)
  TT.KAP = KAP;
  function sirkaTextu(txt, vel) {
    const em = vel / KAP; let w = 0;
    for (const ch of String(txt)) {
      if (/[0-9]/.test(ch)) w += 0.556;
      else if (/[ ,.:;'|!il]/.test(ch)) w += 0.278;
      else if (/[−\-]/.test(ch)) w += 0.584;
      else if (/[mwMW]/.test(ch)) w += 0.833;
      else if (/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ⌀]/.test(ch)) w += 0.667;
      else w += 0.52;
    }
    return w * em;
  }
  TT.sirkaTextu = sirkaTextu;

  /* oblouk → kubické Bézierovy křivky (po ≤ 90°), body ve stejných souřadnicích */
  function obloukBezier(cx, cy, r, t1, t2) {
    const seg = Math.max(1, Math.ceil(Math.abs(t2 - t1) / 90 - 1e-9));
    const d = (t2 - t1) / seg, k = 4 / 3 * Math.tan(rad(d) / 4);
    const out = [];
    for (let i = 0; i < seg; i++) {
      const a = t1 + i * d, b = a + d;
      const p0 = bodK(cx, cy, r, a), p3 = bodK(cx, cy, r, b);
      // tečna hodinového úhlu: d/dt (sin t, −cos t) = (cos t, sin t)
      const p1 = [p0[0] + k * r * Math.cos(rad(a)), p0[1] + k * r * Math.sin(rad(a))];
      const p2 = [p3[0] - k * r * Math.cos(rad(b)), p3[1] - k * r * Math.sin(rad(b))];
      out.push([p0, p1, p2, p3]);
    }
    return out;
  }
  TT.obloukBezier = obloukBezier;

  /* Obálka prvků. */
  function obal(prvky) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    for (const e of prvky) {
      const h = (e.s || 0) / 2;
      if (e.t === 'cara') { p(e.x1 - h, e.y1 - h); p(e.x2 + h, e.y2 + h); p(e.x1 + h, e.y1 + h); p(e.x2 - h, e.y2 - h); }
      else if (e.t === 'kruh') { p(e.cx - e.r - h, e.cy - e.r - h); p(e.cx + e.r + h, e.cy + e.r + h); }
      else if (e.t === 'oblouk') {
        const pts = [e.t1, e.t2]; for (let a = Math.ceil(e.t1 / 90) * 90; a < e.t2; a += 90) pts.push(a);
        for (const a of pts) { const q = bodK(e.cx, e.cy, e.r, a); p(q[0] - h, q[1] - h); p(q[0] + h, q[1] + h); }
      } else if (e.t === 'cesta') { for (const q of e.body) { p(q[0] - h, q[1] - h); p(q[0] + h, q[1] + h); } }
      else if (e.t === 'text') {
        const w = sirkaTextu(e.txt, e.vel), hh = e.vel * 0.75;
        const ax = e.zar === 'l' ? 0 : e.zar === 'p' ? -w : -w / 2;
        const c = Math.cos(rad(e.rot)), s = Math.sin(rad(e.rot));
        for (const [u, v] of [[ax, -hh], [ax + w, -hh], [ax, hh], [ax + w, hh]]) p(e.x + u * c - v * s, e.y + u * s + v * c);
      }
    }
    if (x0 === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  TT.obal = obal;

  function posun(prvky, dx, dy) {
    for (const e of prvky) {
      if (e.t === 'cara') { e.x1 += dx; e.x2 += dx; e.y1 += dy; e.y2 += dy; }
      else if (e.t === 'kruh' || e.t === 'oblouk') { e.cx += dx; e.cy += dy; }
      else if (e.t === 'cesta') e.body = e.body.map((q) => [q[0] + dx, q[1] + dy]);
      else if (e.t === 'text') { e.x += dx; e.y += dy; }
    }
    return prvky;
  }
  TT.posun = posun;

  /* Zabalí prvky do kresby: posune je k (okraj, okraj) a spočte rozměr.
     Je-li zadán `ramec` (skutečný rozměr objektu – např. obrys pravítka), obálka se počítá z prvků
     a rámec slouží jen do informace. */
  function kresba(prvky, nazev, info, okraj, navic) {
    const o = obal(prvky), m = okraj == null ? 0.5 : okraj;
    posun(prvky, m - o.x, m - o.y);
    const k = { w: o.w + 2 * m, h: o.h + 2 * m, prvky, nazev, info: info || [], posun: [m - o.x, m - o.y] };
    return Object.assign(k, navic || {});
  }
  TT.kresba = kresba;

  /* ============================================================
     LINEÁRNÍ STUPNICE
     Vrací rysky {x (mm na papíře od nuly), u (úroveň 0 = nejdelší), hod (hodnota), popis?}
     ============================================================ */
  const RADA = [1, 2, 5];
  function hezkyKrok(min) {           // nejmenší z řady 1–2–5 × 10^k, který je ≥ min
    const e = Math.floor(Math.log10(min));
    for (let k = e; k <= e + 1; k++) for (const r of RADA) { const v = r * Math.pow(10, k); if (v >= min * (1 - 1e-9)) return v; }
    return 10 * Math.pow(10, e + 1);
  }
  TT.hezkyKrok = hezkyKrok;

  /* metrická (i v měřítku 1:M) nebo π-páska (hodnota = průměr, x = π·d/M) */
  function stupniceMetricka(delka, o) {
    const M = o.meritko || 1, pi = o.system === 'pi';
    const f = (pi ? PI : 1) / M;                 // mm papíru na jednotku hodnoty (mm skutečnosti)
    const minRys = o.minRozestup || 0.95;
    const m = hezkyKrok(minRys / f);             // nejjemnější krok hodnoty
    const mant = Math.round(m / Math.pow(10, Math.floor(Math.log10(m) + 1e-9)));
    const hlavni = mant === 1 ? 10 * m : mant === 2 ? 5 * m : 2 * m;
    const stredni = mant === 1 ? 5 * m : null;
    // krok popisků: z hierarchie rysek, rozestup na papíře ≥ minPopis
    const kand = [];
    if (stredni) kand.push(stredni);
    for (const k of [1, 2, 5, 10, 20, 50, 100]) kand.push(hlavni * k);
    const minPopis = o.minPopis || 8;
    let popKrok = kand.find((k) => k * f >= minPopis - 1e-9) || kand[kand.length - 1];
    if (o.popisKazdy) popKrok = o.popisKazdy;
    const jednotka = o.jednotka || 'auto';
    // dělitel popisků podle jednotky
    let del = 1, jedn = 'mm';
    if (jednotka === 'cm') { del = 10; jedn = 'cm'; }
    else if (jednotka === 'm') { del = 1000; jedn = 'm'; }
    else if (jednotka === 'mm') { del = 1; jedn = 'mm'; }
    else if (M >= 20 && !pi) { del = 1000; jedn = 'm'; }
    else if (!pi && popKrok >= 10 && popKrok % 10 === 0 && M < 20) { del = 10; jedn = 'cm'; }
    const rysky = [];
    const n = Math.floor(delka / (m * f) + 1e-6);
    for (let i = 0; i <= n; i++) {
      const hod = i * m, x = hod * f;
      const jeH = Math.abs(hod / hlavni - Math.round(hod / hlavni)) < 1e-6;
      const jeS = stredni && Math.abs(hod / stredni - Math.round(hod / stredni)) < 1e-6;
      const u = jeH ? 0 : jeS ? 1 : 2;
      const r = { x, u, hod };
      if (Math.abs(hod / popKrok - Math.round(hod / popKrok)) < 1e-6) r.popis = fmt(hod / del, 3);
      rysky.push(r);
    }
    return { rysky, jednotka: pi ? 'mm' : jedn, krok: m, hlavni, stredni, popKrok, f, urovne: 3 };
  }

  /* palcová: 'in16' (dělení 1/16"), 'in32', 'in10' (desetinné palce) */
  function stupnicePalcova(delka, o) {
    const IN = 25.4;
    const sys = o.system, del = sys === 'in32' ? 32 : sys === 'in10' ? 10 : 16;
    const krok = IN / del, n = Math.floor(delka / krok + 1e-6), rysky = [];
    for (let i = 0; i <= n; i++) {
      let u;
      if (del === 10) u = i % 10 === 0 ? 0 : i % 5 === 0 ? 1 : 2;
      else { u = 0; let q = del; while (q > 1 && i % q !== 0) { q /= 2; u++; } }
      const r = { x: i * krok, u, hod: i / del };
      if (i % del === 0) r.popis = String(i / del);
      rysky.push(r);
    }
    return { rysky, jednotka: 'in', krok, urovne: del === 10 ? 3 : Math.log2(del) + 1 };
  }

  function stupniceLin(delka, o) {
    if (o.system === 'in16' || o.system === 'in32' || o.system === 'in10') return stupnicePalcova(delka, o);
    return stupniceMetricka(delka, o);
  }
  TT.stupniceLin = stupniceLin;

  /* délky rysek podle úrovně (poměr k nejdelší) */
  function delkaRysky(u, urovne) {
    if (urovne <= 3) return [1, 0.75, 0.5][u] || 0.5;
    return [1, 0.8, 0.64, 0.5, 0.38, 0.28][u] || 0.28;
  }

  /* ============================================================
     PRAVÍTKO
     ============================================================ */
  TT.VYCHOZI = {};
  TT.VYCHOZI.pravitko = {
    delka: 150, nabeh: 6, dobeh: 6, sirka: 28, horni: 'mm', dolni: 'zadna', meritko: 1, jednotka: 'auto',
    meritkoDolni: 0, stredNula: false, smer: 'zleva', rysky: 6, pismo: 2.6, tl: 0.15, obrys: true, rohy: 2, otvor: 0, popisek: '',
  };
  TT.pravitko = function (vst) {
    const o = Object.assign({}, TT.VYCHOZI.pravitko, vst);
    const P = [], chyby = [];
    const L = Math.max(1, +o.delka), nab = Math.max(0, +o.nabeh), dob = Math.max(0, +o.dobeh), S = Math.max(5, +o.sirka);
    const W = nab + L + dob;
    const T = Math.max(1, +o.rysky), vel = Math.max(1, +o.pismo), tl = Math.max(0.05, +o.tl);
    const mezera = Math.max(0.8, vel * 0.45);
    if (o.obrys) {
      const r = Math.min(+o.rohy || 0, S / 2, W / 2);
      if (r > 0.01) P.push(...obdelnikZaobleny(0, 0, W, S, r, 0.2, 'rez'));
      else P.push(cesta([[0, 0], [W, 0], [W, S], [0, S]], true, 0.2, 'rez'));
    }
    const nula = o.stredNula ? nab + L / 2 : (o.smer === 'zprava' ? nab + L : nab);
    const zn = o.smer === 'zprava' ? -1 : 1;
    const strany = [];
    const M0 = +o.meritko || 1, M1 = +o.meritkoDolni > 0 ? +o.meritkoDolni : M0;
    if (o.horni && o.horni !== 'zadna') strany.push({ sys: o.horni, y0: 0, sm: 1, M: M0 });
    if (o.dolni && o.dolni !== 'zadna') strany.push({ sys: o.dolni, y0: S, sm: -1, M: M1 });
    const potrebne = strany.length * (T + mezera + vel + 0.8);
    if (potrebne > S + 1e-6) chyby.push(`Šířka pravítka ${fmt(S)} mm je na zvolené rysky a písmo malá (potřeba ≥ ${fmt(potrebne, 1)} mm).`);
    const popisJednotek = [];
    for (const st of strany) {
      const delkaStr = o.stredNula ? L / 2 : L;
      const sk = stupniceLin(delkaStr, { system: st.sys, meritko: st.M, jednotka: o.jednotka, minPopis: Math.max(6, sirkaTextu('000', vel) + 2.5) });
      const smery = o.stredNula ? [1, -1] : [zn];
      for (const sm of smery) {
        for (const r of sk.rysky) {
          if (o.stredNula && sm === -1 && r.x === 0) continue;
          const x = nula + sm * r.x, d = T * delkaRysky(r.u, sk.urovne);
          P.push(cara(x, st.y0, x, st.y0 + st.sm * d, r.u === 0 ? tl * 1.4 : tl));
          if (r.popis != null) {
            const y = st.y0 + st.sm * (T + mezera + vel / 2);
            let zar = 's', xx = x;
            // krajní popisky nesmí vylézt z pravítka
            const w = sirkaTextu(r.popis, vel);
            if (x - w / 2 < 0.8) { zar = 'l'; xx = Math.max(0.8, x - w / 2); }
            if (x + w / 2 > W - 0.8) { zar = 'p'; xx = Math.min(W - 0.8, x + w / 2); }
            P.push(text(xx, y, r.popis, vel, { zar }));
          }
        }
      }
      let jn = sk.jednotka === 'in' ? 'in' : sk.jednotka;
      if (st.sys === 'pi') jn = 'Ø mm';
      const M = st.M;
      if (M !== 1 && st.sys !== 'in16' && st.sys !== 'in32' && st.sys !== 'in10') jn += ` · 1:${fmt(M)}`;
      popisJednotek.push({ txt: jn, y: st.y0 + st.sm * (T + mezera + vel + mezera + vel * 0.35), sm: st.sm });
    }
    // jednotky k nule (malým písmem), nad/pod popisky
    const malVel = vel * 0.7;
    for (const pj of popisJednotek) {
      const x = o.stredNula ? nula : nula + zn * 1.2;
      const yy = pj.y + pj.sm * (malVel * 0.2);
      if (Math.abs(yy - S / 2) < S / 2 - 0.5) P.push(text(x, yy, pj.txt, malVel, { zar: o.stredNula ? 's' : (zn > 0 ? 'l' : 'p') }));
    }
    if (o.popisek) {
      const yy = strany.length === 2 ? S / 2 : (strany.length && strany[0].sm === 1 ? S - vel * 0.9 - 1.5 : vel * 0.9 + 1.5);
      P.push(text(nab + L / 2, yy, o.popisek, vel * 0.85, {}));
    }
    if (+o.otvor > 0) {
      const xo = o.smer === 'zprava' && !o.stredNula ? Math.max(+o.otvor, nab / 2) : W - Math.max(+o.otvor, dob / 2);
      P.push(kruh(xo, S / 2, +o.otvor / 2, 0.2, 'rez'));
      if (dob < +o.otvor + 2 && !(o.smer === 'zprava')) chyby.push('Otvor pro zavěšení zasahuje do stupnice – zvětšete doběh.');
    }
    const mer = [...new Set(strany.filter((st) => !/^in/.test(st.sys)).map((st) => st.M))].filter((m) => m !== 1);
    const info = [`Pravítko ${fmt(L)} mm${mer.length ? ' · měřítko ' + mer.map((m) => '1:' + fmt(m)).join(' a ') : ''}`, `obrys ${fmt(W)} × ${fmt(S)} mm`];
    return kresba(P, 'Pravítko', info, 0.6, { chyby, obrys: { w: W, h: S } });
  };

  function obdelnikZaobleny(x, y, w, h, r, s, v) {
    const P = [];
    P.push(cara(x + r, y, x + w - r, y, s, v), cara(x + w, y + r, x + w, y + h - r, s, v));
    P.push(cara(x + w - r, y + h, x + r, y + h, s, v), cara(x, y + h - r, x, y + r, s, v));
    P.push(oblouk(x + w - r, y + r, r, 0, 90, s, v), oblouk(x + w - r, y + h - r, r, 90, 180, s, v));
    P.push(oblouk(x + r, y + h - r, r, 180, 270, s, v), oblouk(x + r, y + r, r, 270, 360, s, v));
    return P;
  }
  TT.obdelnikZaobleny = obdelnikZaobleny;

  /* ============================================================
     KRUHOVÉ RYSKY – společné pro úhloměr i kruhové stupnice
     o: cx,cy,r, dovnitr, t0 (hodinový úhel počátku), smer (+1 po směru hodin),
        rozsah (°), dilky [{pocet, delka, s}] od nejjemnějších
     ============================================================ */
  function ryskyKruh(P, o) {
    const n = o.pocet, krokU = o.rozsah / n, uzavreno = Math.abs(o.rozsah - 360) < 1e-9;
    const konec = uzavreno ? n - 1 : n;
    for (let i = 0; i <= konec; i++) {
      let d = o.delky[o.delky.length - 1], s = o.tlusty[o.tlusty.length - 1];
      for (let k = 0; k < o.kazdy.length; k++) if (i % o.kazdy[k] === 0) { d = o.delky[k]; s = o.tlusty[k]; break; }
      const t = o.t0 + o.smer * i * krokU;
      const a = bodK(o.cx, o.cy, o.r, t), b = bodK(o.cx, o.cy, o.dovnitr ? o.r - d : o.r + d, t);
      P.push(cara(a[0], a[1], b[0], b[1], s));
    }
  }

  /* ============================================================
     ÚHLOMĚR
     ============================================================ */
  TT.JEDNOTKY_UHLU = {
    deg: { plny: 360, nazev: 'stupně', zn: '°' },
    gon: { plny: 400, nazev: 'gradiány (gon)', zn: 'g' },
    mil: { plny: 6400, nazev: 'dílce NATO (6400)', zn: '' },
  };
  TT.VYCHOZI.uhlomer = {
    r: 80, rozsah: 180, jednotka: 'deg', jemne: 'auto', dvojite: true, zakladna: 10, otvor: 0, kriz: true,
    paprsky: true, rysky: 6, pismo: 2.6, tl: 0.15, obrys: true, popisek: '',
  };
  TT.uhlomer = function (vst) {
    const o = Object.assign({}, TT.VYCHOZI.uhlomer, vst);
    const P = [], chyby = [];
    const R = Math.max(15, +o.r), plny = (TT.JEDNOTKY_UHLU[o.jednotka] || TT.JEDNOTKY_UHLU.deg).plny;
    const pul = +o.rozsah !== 360;
    const rozsahJ = pul ? plny / 2 : plny;            // rozsah v jednotkách
    // jemné dělení: nejmenší krok s obloukem ≥ 0,7 mm
    const obl1 = R * 2 * PI / plny;                   // mm oblouku na 1 jednotku
    let krok;
    if (o.jemne !== 'auto' && +o.jemne > 0) krok = +o.jemne;
    else krok = o.jednotka === 'mil' ? hezkyKrok(0.75 / obl1) : [0.5, 1, 2, 5, 10].find((k) => k * obl1 >= 0.9) || 10;
    const pocet = Math.round(rozsahJ / krok);
    // hierarchie: hlavní (popis) / střední / jemné
    let hlavniJ, stredniJ;
    if (o.jednotka === 'mil') { hlavniJ = 100; stredniJ = 50; }
    else { hlavniJ = 10; stredniJ = 5; }
    if (krok >= stredniJ) stredniJ = hlavniJ;
    const kazdy = [Math.round(hlavniJ / krok), Math.max(1, Math.round(stredniJ / krok))];
    const T = Math.max(2, +o.rysky), vel = Math.max(1, +o.pismo), tl = Math.max(0.05, +o.tl);
    const cx = 0, cy = 0;
    // úhel v jednotkách a → hodinový úhel: 0 vpravo, roste proti směru hodin
    const tz = (a) => 90 - a * 360 / plny;
    ryskyKruh(P, { cx, cy, r: R, dovnitr: true, t0: 90, smer: -1, rozsah: pul ? 180 : 360, pocet,
      kazdy, delky: [T, T * 0.72, T * 0.48], tlusty: [tl * 1.4, tl, tl] });
    P.push(oblouk(cx, cy, R, pul ? -90 : 0, pul ? 90 : 360, tl));
    // popisky
    let popisJ = o.jednotka === 'mil' ? 200 : 10;
    const r1 = R - T - 0.9 - vel / 2;
    const obvodPop = r1 * 2 * PI * popisJ / plny;
    if (obvodPop < sirkaTextu('000', vel) + 1) popisJ *= 2;
    const r2 = r1 - vel - 1.2;
    const fmtJ = (a) => o.jednotka === 'mil' ? fmt(a / 100) : fmt(a);
    for (let a = 0; a <= rozsahJ + 1e-9; a += popisJ) {
      if (!pul && Math.abs(a - plny) < 1e-9) continue;
      const t = tz(a);
      const p = bodK(cx, cy, r1, t);
      P.push(text(p[0], p[1], fmtJ(a), vel, { rot: t }));
      if (o.dvojite) {
        const b = pul ? rozsahJ - a : (plny - a) % plny;
        const q = bodK(cx, cy, r2, t);
        P.push(text(q[0], q[1], fmtJ(b), vel * 0.82, { rot: t, b: '#c0392b' }));
      }
    }
    const rIn = (o.dvojite ? r2 - vel * 0.82 / 2 - 1 : r1 - vel / 2 - 1);
    // paprsky po 10/45 jednotkách – pomocné tenké čáry od středu
    if (o.paprsky) {
      const krokP = o.jednotka === 'mil' ? 800 : o.jednotka === 'gon' ? 50 : 45;
      for (let a = 0; a <= rozsahJ + 1e-9; a += krokP) {
        if (!pul && Math.abs(a - plny) < 1e-9) continue;
        const t = tz(a), p = bodK(cx, cy, Math.min(R * 0.12 + 3, rIn), t), q = bodK(cx, cy, rIn, t);
        P.push(cara(p[0], p[1], q[0], q[1], tl * 0.7, 'kresba', '#7f8c8d'));
      }
    }
    // střed
    const kr = Math.min(6, R * 0.08);
    if (o.kriz) { P.push(cara(cx - kr, cy, cx + kr, cy, tl), cara(cx, cy - kr, cx, cy + (pul ? 0 : kr), tl)); }
    if (+o.otvor > 0) P.push(kruh(cx, cy, +o.otvor / 2, 0.2, 'rez'));
    else P.push(kruh(cx, cy, 0.35, 0.1, 'kresba', true));
    // základna a obrys
    const zak = Math.max(0, +o.zakladna);
    if (pul) {
      // nulová čára: uvnitř popisků souvisle, vně jen rysky 0° a 180° (čára nesmí škrtat čísla)
      P.push(cara(cx - rIn, cy, cx + rIn, cy, tl));
      if (o.obrys) {
        const Ro = R + 1.5;
        P.push(oblouk(cx, cy, Ro, -90, 90, 0.2, 'rez'));
        P.push(cara(cx - Ro, cy, cx - Ro, cy + zak, 0.2, 'rez'), cara(cx + Ro, cy, cx + Ro, cy + zak, 0.2, 'rez'), cara(cx - Ro, cy + zak, cx + Ro, cy + zak, 0.2, 'rez'));
      }
      if (zak >= vel + 2) {
        const zn = TT.JEDNOTKY_UHLU[o.jednotka] || TT.JEDNOTKY_UHLU.deg;
        P.push(text(cx, cy + zak / 2 + 0.3, o.popisek || `úhloměr · ${zn.nazev} · r ${fmt(R)} mm`, Math.min(vel * 0.85, zak * 0.45)));
      }
    } else if (o.obrys) P.push(kruh(cx, cy, R + 1.5, 0.2, 'rez'));
    if (!pul && o.popisek) P.push(text(cx, cy + R * 0.42, o.popisek, vel * 0.85));
    if (krok * obl1 < 0.6) chyby.push('Jemné rysky jsou hustší než 0,6 mm – při tisku splynou. Zvětšete poloměr nebo krok.');
    const info = [`Úhloměr ${pul ? '180°' : '360°'} · r ${fmt(R)} mm · ${(TT.JEDNOTKY_UHLU[o.jednotka] || {}).nazev}`, `nejjemnější dílek ${fmt(krok)} (${fmt(krok * obl1, 2)} mm na obvodu)`];
    return kresba(P, 'Úhloměr', info, 0.6, { chyby });
  };

  /* ============================================================
     KRUHOVÁ STUPNICE / ČÍSELNÍK / DĚLICÍ KOTOUČ
     ============================================================ */
  TT.VYCHOZI.kruhova = {
    r: 48, dilku: 36, pod: 1, rozsah: 360, t0: 0, smer: 'cw', od: 0, krok: 10, desetin: 'auto', popisKazdy: 1,
    orientace: 'tecna', rysky: 5, pismo: 2.5, tl: 0.18, ven: false, kruznice: true, vnejsiD: 104, otvor: 8, kriz: true,
    indexD: 0, indexR: 30, ukazatel: true, popisek: '',
  };
  TT.kruhova = function (vst) {
    const o = Object.assign({}, TT.VYCHOZI.kruhova, vst);
    const P = [], chyby = [];
    const R = Math.max(5, +o.r), N = Math.max(1, Math.round(+o.dilku)), pod = Math.max(1, Math.round(+o.pod));
    const rozsah = Math.min(360, Math.max(1, +o.rozsah)), uzavreno = Math.abs(rozsah - 360) < 1e-9;
    const sm = o.smer === 'ccw' ? -1 : 1, t0 = +o.t0 || 0;
    const T = Math.max(1, +o.rysky), vel = Math.max(0.8, +o.pismo), tl = Math.max(0.05, +o.tl);
    const dovnitr = !o.ven;
    const pocet = N * pod;
    const kazdy = [pod];
    if (pod % 2 === 0) kazdy.push(pod / 2);
    const delky = [T, T * 0.72, T * 0.5].slice(0, kazdy.length).concat([pod > 1 ? (pod % 2 === 0 ? T * 0.5 : T * 0.6) : T]);
    const tlusty = [tl * 1.4, tl, tl].slice(0, kazdy.length).concat([tl]);
    ryskyKruh(P, { cx: 0, cy: 0, r: R, dovnitr, t0, smer: sm, rozsah, pocet, kazdy, delky, tlusty });
    if (o.kruznice) {
      if (uzavreno) P.push(kruh(0, 0, R, tl));
      else { const a = sm > 0 ? t0 : t0 - rozsah; P.push(oblouk(0, 0, R, a, a + rozsah, tl)); }
    }
    const krokSt = rozsah / N;
    let des = o.desetin === 'auto' ? Math.max(0, Math.min(4, -Math.floor(Math.log10(Math.abs(+o.krok || 1) + 1e-12) + 1e-9))) : +o.desetin;
    if (o.desetin === 'auto') { const k = +o.krok; for (des = 0; des < 4 && Math.abs(k * Math.pow(10, des) - Math.round(k * Math.pow(10, des))) > 1e-9; des++); }
    const rp = dovnitr ? R - T - 1 - vel / 2 : R + T + 1 + vel / 2;
    const kaz = Math.max(1, Math.round(+o.popisKazdy));
    let popisu = 0, nejmensiRozestup = Infinity;
    const konec = uzavreno ? N - 1 : N;
    for (let i = 0; i <= konec; i += kaz) {
      const t = t0 + sm * i * krokSt;
      const hod = (+o.od) + i * (+o.krok);
      const txt = (hod < 0 ? '−' : '') + Math.abs(hod).toFixed(des).replace('.', ',');
      const txtN = +o.nulaJako && Math.abs(hod) < 1e-9 ? String(o.nulaJako) : txt;
      const p = bodK(0, 0, rp, t);
      let rot = 0, zar = 's', xx = p[0], yy = p[1];
      if (o.orientace === 'tecna') {
        // po obvodu; ve spodní polovině otočit o 180°, aby čísla nebyla vzhůru nohama
        const tn = ((t % 360) + 360) % 360;
        rot = tn > 90 + 1e-9 && tn < 270 - 1e-9 ? t + 180 : t;
      }
      else if (o.orientace === 'radialni') {
        // text podél poloměru, čte se od středu ven; na levé polovině otočit, aby nebyl vzhůru nohama
        const tn = ((t % 360) + 360) % 360;
        rot = tn <= 180 ? t - 90 : t + 90;
        const w = sirkaTextu(txtN, vel);
        const rr = dovnitr ? R - T - 1 - w / 2 : R + T + 1 + w / 2;
        [xx, yy] = bodK(0, 0, rr, t);
      }
      P.push(text(xx, yy, txtN, vel, { rot, zar }));
      popisu++;
      const w = o.orientace === 'radialni' ? vel : sirkaTextu(txt, vel);
      nejmensiRozestup = Math.min(nejmensiRozestup, rp * rad(krokSt * kaz) - w);
    }
    if (nejmensiRozestup < 0.3) chyby.push('Popisky se překrývají – zvolte popis každého 2. nebo 5. dílku, menší písmo nebo větší poloměr.');
    const oblJemny = R * rad(rozsah / pocet);
    if (oblJemny < 0.6) chyby.push(`Jemné rysky jsou od sebe jen ${fmt(oblJemny, 2)} mm – při tisku splynou.`);
    // dělicí otvory (dělicí kotouč) – jeden na každý hlavní dílek
    if (+o.indexD > 0) {
      for (let i = 0; i <= konec; i++) {
        const t = t0 + sm * i * krokSt, p = bodK(0, 0, +o.indexR, t);
        P.push(kruh(p[0], p[1], +o.indexD / 2, 0.2, 'rez'));
        const kr = +o.indexD / 2 + 1.2;
        P.push(cara(p[0] - kr, p[1], p[0] + kr, p[1], 0.1, 'kresba', '#7f8c8d'), cara(p[0], p[1] - kr, p[0], p[1] + kr, 0.1, 'kresba', '#7f8c8d'));
      }
      P.push(kruh(0, 0, +o.indexR, 0.1, 'kresba', false));
      P[P.length - 1].b = '#7f8c8d';
    }
    if (o.ukazatel) {
      // trojúhelníková značka nuly vně stupnice (na pevné části / jako kontrola)
      const rr = dovnitr ? R + 1 : R + T + vel + 3;
      const a = bodK(0, 0, rr, t0), b = bodK(0, 0, rr + 3.2, t0 - 2.2 * 40 / Math.max(rr, 20)), c = bodK(0, 0, rr + 3.2, t0 + 2.2 * 40 / Math.max(rr, 20));
      P.push(cesta([a, b, c], true, 0.1, 'kresba')); P[P.length - 1].vypln = true;
    }
    if (o.kriz) { const k = Math.max(2.5, Math.min(6, R * 0.1)); P.push(cara(-k, 0, k, 0, tl), cara(0, -k, 0, k, tl)); }
    if (+o.otvor > 0) P.push(kruh(0, 0, +o.otvor / 2, 0.2, 'rez'));
    if (+o.vnejsiD > 0) {
      P.push(kruh(0, 0, +o.vnejsiD / 2, 0.2, 'rez'));
      const nejdal = dovnitr ? R : R + T + 1 + vel + 0.5;
      if (+o.vnejsiD / 2 < nejdal) chyby.push('Vnější obrys protíná stupnici – zvětšete jeho průměr.');
    }
    if (o.popisek) P.push(text(0, Math.min(R * 0.5, R - T - vel * 2.5), o.popisek, vel * 0.8));
    const info = [`Kruhová stupnice ${N} dílků${pod > 1 ? ` × ${pod}` : ''} · ${fmt(rozsah)}° · r ${fmt(R)} mm`, `hlavní dílek ${fmt(krokSt, 4)}°, oblouk ${fmt(R * rad(krokSt), 2)} mm`];
    return kresba(P, 'Kruhová stupnice', info, 0.6, { chyby });
  };

  /* ============================================================
     MŘÍŽKY
     ============================================================ */
  TT.VYCHOZI.mrizka = {
    typ: 'kart', w: 180, h: 260, krok: 1, stredni: 5, hlavni: 10, pocatek: 'vlevo-dole', popisy: true, popisKazdy: 10,
    osy: true, barva: 'seda', tlJemna: 0.06, tlHlavni: 0.22, pismo: 2, rKrok: 5, rHlavni: 5, uhel: 15, uhelJemny: 5, ramec: true,
  };
  const SCHEMATA = {
    cerna: { jemna: '#000000', stredni: '#000000', hlavni: '#000000', osa: '#000000', text: '#000000' },
    seda: { jemna: '#b4b8bd', stredni: '#80868d', hlavni: '#3d434a', osa: '#000000', text: '#202428' },
    modra: { jemna: '#a9cbe8', stredni: '#6fa6d6', hlavni: '#2c6fb1', osa: '#0c3d73', text: '#0c3d73' },
    oranzova: { jemna: '#f5c9a0', stredni: '#eda266', hlavni: '#d0671c', osa: '#8a3c05', text: '#8a3c05' },
  };
  TT.SCHEMATA_MRIZKY = SCHEMATA;
  TT.mrizka = function (vst) {
    const o = Object.assign({}, TT.VYCHOZI.mrizka, vst);
    const P = [], chyby = [];
    const W = Math.max(5, +o.w), H = Math.max(5, +o.h), b = SCHEMATA[o.barva] || SCHEMATA.seda;
    const tj = Math.max(0.02, +o.tlJemna), th = Math.max(tj, +o.tlHlavni), ts = (tj + th) / 2;
    const vel = Math.max(0.8, +o.pismo);
    const lc = (x1, y1, x2, y2, s, barva) => { const e = cara(x1, y1, x2, y2, s, 'kresba', barva); P.push(e); };
    let info;
    if (o.typ === 'kart' || o.typ === 'tecky') {
      const k = Math.max(0.1, +o.krok), ks = Math.max(1, Math.round(+o.stredni)), kh = Math.max(1, Math.round(+o.hlavni));
      // počátek (souřadnice papíru) a směr osy y
      let x0 = 0, y0 = H, yNahoru = true;
      if (o.pocatek === 'stred') { x0 = W / 2; y0 = H / 2; }
      else if (o.pocatek === 'vlevo-nahore') { x0 = 0; y0 = 0; yNahoru = false; }
      // čáry se kladou od počátku oběma směry (počátek leží na hlavní čáře)
      const iMinX = Math.ceil(-x0 / k - 1e-9), iMaxX = Math.floor((W - x0) / k + 1e-9);
      const iMinY = Math.ceil(-y0 / k - 1e-9), iMaxY = Math.floor((H - y0) / k + 1e-9);
      const uroven = (i) => (i % kh === 0 ? 2 : i % ks === 0 ? 1 : 0);
      const pocetTecek = (iMaxX - iMinX + 1) * (iMaxY - iMinY + 1);
      if (o.typ === 'tecky' && pocetTecek > 120000) chyby.push(`Rastr by měl ${pocetTecek} teček – zvětšete krok (limit 120 000).`);
      else if (o.typ === 'tecky') {
        for (let i = iMinX; i <= iMaxX; i++) for (let j = iMinY; j <= iMaxY; j++) {
          const u = Math.min(uroven(i), uroven(j));
          const r = [tj, ts, th][u] * 1.1;
          P.push(Object.assign(kruh(x0 + i * k, y0 + j * k, r, 0, 'kresba', true), { b: [b.jemna, b.stredni, b.hlavni][u] }));
        }
      } else {
        for (const u of [0, 1, 2]) {                // jemné nejdřív, ať hlavní leží navrch
          for (let i = iMinX; i <= iMaxX; i++) if (uroven(i) === u && !(o.osy && i === 0)) lc(x0 + i * k, 0, x0 + i * k, H, [tj, ts, th][u], [b.jemna, b.stredni, b.hlavni][u]);
          for (let j = iMinY; j <= iMaxY; j++) if (uroven(j) === u && !(o.osy && j === 0)) lc(0, y0 + j * k, W, y0 + j * k, [tj, ts, th][u], [b.jemna, b.stredni, b.hlavni][u]);
        }
      }
      if (o.osy) {
        if (x0 >= 0 && x0 <= W) lc(x0, 0, x0, H, th * 1.5, b.osa);
        if (y0 >= 0 && y0 <= H) lc(0, y0, W, y0, th * 1.5, b.osa);
      }
      if (o.popisy) {
        const pk = Math.max(1, Math.round(+o.popisKazdy));
        const mez = 1.2;
        for (let i = iMinX; i <= iMaxX; i++) if (i % pk === 0) {
          const t = fmt(i * k, 3);
          P.push(text(x0 + i * k, H + mez + vel / 2, t, vel, { b: b.text }));
        }
        for (let j = iMinY; j <= iMaxY; j++) if (j % pk === 0) {
          const hod = yNahoru ? -j * k : j * k;
          P.push(text(-mez, y0 + j * k, fmt(hod, 3), vel, { zar: 'p', b: b.text }));
        }
        P.push(text(W, H + mez + vel * 2.1, 'mm', vel * 0.8, { zar: 'p', b: b.text }));
      }
      info = [`${o.typ === 'tecky' ? 'Tečkový rastr' : 'Mřížka'} ${fmt(W)} × ${fmt(H)} mm · krok ${fmt(k)} mm`, `zvýraznění po ${ks} a ${kh} krocích`];
      if (k < 0.8 && o.typ === 'kart') chyby.push('Krok pod 0,8 mm tiskárna většinou nevykreslí čitelně.');
    } else if (o.typ === 'iso') {
      const k = Math.max(0.5, +o.krok * Math.max(1, Math.round(+o.stredni)));  // rozestup rovnoběžek
      const kh = Math.max(1, Math.round(+o.hlavni / Math.max(1, Math.round(+o.stredni))));
      // svislé čáry + dvě osnovy pod ±30° k vodorovné; rozestup kolmý k čarám = k
      const dx = k / Math.cos(rad(30));
      let i = 0;
      for (let x = 0; x <= W + 1e-9; x += dx, i++) lc(x, 0, x, H, i % kh === 0 ? th : tj, i % kh === 0 ? b.hlavni : b.jemna);
      const tg = Math.tan(rad(30));
      const dy = k / Math.cos(rad(30));       // svislý rozestup šikmých čar
      for (const smer of [1, -1]) {
        const cmin = smer > 0 ? -W * tg : 0, cmax = smer > 0 ? H : H + W * tg;
        let j = 0;
        for (let c = Math.floor(cmin / dy) * dy; c <= cmax + 1e-9; c += dy, j++) {
          // přímka y = c + smer*tg*x, oříznutí na obdélník
          const body = [];
          const y = (x) => c + smer * tg * x, xz = (yy) => (yy - c) / (smer * tg);
          for (const [px, py] of [[0, y(0)], [W, y(W)], [xz(0), 0], [xz(H), H]]) if (px >= -1e-9 && px <= W + 1e-9 && py >= -1e-9 && py <= H + 1e-9) body.push([px, py]);
          if (body.length >= 2) {
            body.sort((a, bb) => a[0] - bb[0]);
            const jj = Math.round(c / dy);
            const hl = ((jj % kh) + kh) % kh === 0;
            lc(body[0][0], body[0][1], body[body.length - 1][0], body[body.length - 1][1], hl ? th : tj, hl ? b.hlavni : b.jemna);
          }
        }
      }
      info = [`Izometrická mřížka ${fmt(W)} × ${fmt(H)} mm`, `rozestup čar ${fmt(k)} mm (30°)`];
    } else { // polární
      const cx = W / 2, cy = H / 2, Rmax = Math.min(W, H) / 2;
      const rk = Math.max(0.5, +o.rKrok), rh = Math.max(1, Math.round(+o.rHlavni));
      const uh = Math.max(1, +o.uhel), uj = Math.max(0.5, +o.uhelJemny);
      let i = 1;
      for (let r = rk; r <= Rmax + 1e-9; r += rk, i++) P.push(Object.assign(kruh(cx, cy, r, i % rh === 0 ? th : tj), { b: i % rh === 0 ? b.hlavni : b.jemna }));
      const nj = Math.round(360 / uj);
      for (let j = 0; j < nj; j++) {
        const t = j * uj, hl = Math.abs(t / uh - Math.round(t / uh)) < 1e-6;
        const r0 = hl ? rk : Math.min(rk * rh, Rmax);
        const a = bodK(cx, cy, r0, t), c = bodK(cx, cy, Rmax, t);
        lc(a[0], a[1], c[0], c[1], hl ? ts : tj, hl ? b.stredni : b.jemna);
        if (hl && o.popisy) {
          const p = bodK(cx, cy, Rmax + 1.2 + vel / 2, t);
          // úhel matematicky: 0° vpravo, proti směru hodin
          const mat = ((90 - t) % 360 + 360) % 360;
          P.push(text(p[0], p[1], fmt(mat) + '°', vel, { rot: t, b: b.text }));
        }
      }
      if (o.osy) { lc(cx - Rmax, cy, cx + Rmax, cy, th, b.osa); lc(cx, cy - Rmax, cx, cy + Rmax, th, b.osa); }
      if (o.popisy) for (let r = rk * rh; r <= Rmax + 1e-9; r += rk * rh) P.push(text(cx + r + 0.6, cy + vel * 0.9, fmt(r), vel * 0.85, { zar: 'l', b: b.text }));
      info = [`Polární mřížka Ø ${fmt(2 * Rmax)} mm`, `kružnice po ${fmt(rk)} mm, paprsky po ${fmt(uj)}° (zvýrazněné po ${fmt(uh)}°)`];
    }
    if (o.ramec && o.typ !== 'polar') P.push(cesta([[0, 0], [W, 0], [W, H], [0, H]], true, th, 'kresba'));
    return kresba(P, 'Mřížka', info, 0.4, { chyby });
  };

  /* ============================================================
     ROZTEČE OTVORŮ – vzory a předvolby
     Souřadnice otvorů: technická konvence X doprava, Y nahoru (mm), d = průměr.
     ============================================================ */
  TT.VUL = { M2: 2.4, 'M2.5': 2.9, M3: 3.4, M4: 4.5, M5: 5.5, M6: 6.6, M8: 9, M10: 11, M12: 13.5 }; // ISO 273 střední řada

  function vzorOtvory(p) {
    const d = +p.d || 0, out = [];
    const ox = +p.x || 0, oy = +p.y || 0, ot = rad(+p.uhel || 0);
    const rotuj = (x, y) => [ox + x * Math.cos(ot) - y * Math.sin(ot), oy + x * Math.sin(ot) + y * Math.cos(ot)];
    if (p.typ === 'kruh') {
      const n = Math.max(1, Math.round(+p.n)), R = (+p.D || 0) / 2, a0 = +p.a0 || 0, sm = p.smer === 'cw' ? -1 : 1;
      for (let i = 0; i < n; i++) { const a = rad(a0 + sm * i * 360 / n); out.push({ x: ox + R * Math.cos(a), y: oy + R * Math.sin(a), d, uhel: ((a0 + sm * i * 360 / n) % 360 + 360) % 360 }); }
    } else if (p.typ === 'oblouk') {
      const n = Math.max(1, Math.round(+p.n)), R = (+p.D || 0) / 2, a1 = +p.a1 || 0, a2 = +p.a2;
      for (let i = 0; i < n; i++) { const t = n === 1 ? a1 : a1 + (a2 - a1) * i / (n - 1), a = rad(t); out.push({ x: ox + R * Math.cos(a), y: oy + R * Math.sin(a), d, uhel: t }); }
    } else if (p.typ === 'rada') {
      const n = Math.max(1, Math.round(+p.n));
      let roz = +p.roztec || 0, x0 = 0;
      if (p.rezim === 'rozdelit') { const L = +p.L || 0, e = +p.okraj || 0; roz = n > 1 ? (L - 2 * e) / (n - 1) : 0; x0 = n > 1 ? e : L / 2; }
      for (let i = 0; i < n; i++) { const q = rotuj(x0 + i * roz, 0); out.push({ x: q[0], y: q[1], d }); }
    } else if (p.typ === 'mrizka') {
      const nx = Math.max(1, Math.round(+p.nx)), ny = Math.max(1, Math.round(+p.ny)), px = +p.px || 0, py = +p.py || 0;
      for (let j = 0; j < ny; j++) {
        const pos = p.stridat && j % 2 === 1 ? px / 2 : 0, kolik = p.stridat && j % 2 === 1 && p.zkratit ? nx - 1 : nx;
        for (let i = 0; i < kolik; i++) { const q = rotuj(pos + i * px, j * py); out.push({ x: q[0], y: q[1], d }); }
      }
    } else if (p.typ === 'body') {
      for (const r of TT.ctiBody(p.text || '').body) out.push({ x: ox + r.x, y: oy + r.y, d: r.d != null ? r.d : d, popis: r.popis });
    } else if (p.typ === 'predvolba') {
      const pv = TT.PREDVOLBY.find((q) => q.id === p.id);
      if (pv) for (const h of pv.otvory()) { const q = rotuj(h[0], h[1]); out.push({ x: q[0], y: q[1], d: h[2], popis: h[3] }); }
    }
    const pop = p.popis || '';
    for (const h of out) if (pop && !h.popis) h.popis = pop;
    return out;
  }
  TT.vzorOtvory = vzorOtvory;

  /* „x y d popis“ / „x;y;d“ – řádek po řádku, # komentář; d smí chybět (vezme se výchozí) */
  TT.ctiBody = function (txt) {
    const body = [], chyby = [];
    String(txt).split(/\r?\n/).forEach((radek, i) => {
      const r = radek.replace(/#.*$/, '').trim();
      if (!r) return;
      const casti = r.split(/\s*[;\t]\s*|\s+/).filter((s) => s !== '');
      const x = vyraz(casti[0]), y = vyraz(casti[1]);
      if (!isFinite(x) || !isFinite(y)) { chyby.push(`řádek ${i + 1}: „${radek.trim()}“ – čekám „x y [průměr] [popis]“`); return; }
      let d = null, popis = '';
      if (casti.length > 2) {
        const dd = vyraz(String(casti[2]).replace(/^[⌀Øø]/, ''));
        if (isFinite(dd)) { d = dd; popis = casti.slice(3).join(' '); } else popis = casti.slice(2).join(' ');
      }
      body.push({ x, y, d, popis });
    });
    return { body, chyby };
  };

  /* Předvolby – rozteče podle norem / výrobců. otvory() vrací [x, y, d, popis] kolem středu (0,0). */
  const ctverec = (a, d, pop) => [[-a / 2, -a / 2, d, pop], [a / 2, -a / 2, d, pop], [a / 2, a / 2, d, pop], [-a / 2, a / 2, d, pop]];
  const obd = (a, b, d, pop) => [[-a / 2, -b / 2, d, pop], [a / 2, -b / 2, d, pop], [a / 2, b / 2, d, pop], [-a / 2, b / 2, d, pop]];
  TT.PREDVOLBY = [
    { id: 'vesa75', sk: 'VESA (monitory, TV)', nazev: 'VESA 75 × 75 (M4)', otvory: () => ctverec(75, 4.5, 'M4') },
    { id: 'vesa100', sk: 'VESA (monitory, TV)', nazev: 'VESA 100 × 100 (M4)', otvory: () => ctverec(100, 4.5, 'M4') },
    { id: 'vesa200x100', sk: 'VESA (monitory, TV)', nazev: 'VESA 200 × 100 (M6)', otvory: () => obd(200, 100, 6.6, 'M6') },
    { id: 'vesa200', sk: 'VESA (monitory, TV)', nazev: 'VESA 200 × 200 (M6)', otvory: () => ctverec(200, 6.6, 'M6') },
    { id: 'vesa300', sk: 'VESA (monitory, TV)', nazev: 'VESA 300 × 300 (M6)', otvory: () => ctverec(300, 6.6, 'M6') },
    { id: 'vesa400', sk: 'VESA (monitory, TV)', nazev: 'VESA 400 × 400 (M8)', otvory: () => ctverec(400, 9, 'M8') },
    { id: 'nema14', sk: 'Krokové motory NEMA', nazev: 'NEMA 14 – rozteč 26 mm, M3, nákružek ⌀22', otvory: () => [[0, 0, 22.2, 'nákružek']].concat(ctverec(26, 3.4, 'M3')) },
    { id: 'nema17', sk: 'Krokové motory NEMA', nazev: 'NEMA 17 – rozteč 31 mm, M3, nákružek ⌀22', otvory: () => [[0, 0, 22.2, 'nákružek']].concat(ctverec(31, 3.4, 'M3')) },
    { id: 'nema23', sk: 'Krokové motory NEMA', nazev: 'NEMA 23 – rozteč 47,14 mm, ⌀5,2, nákružek ⌀38,1', otvory: () => [[0, 0, 38.3, 'nákružek']].concat(ctverec(47.14, 5.2, '')) },
    { id: 'nema34', sk: 'Krokové motory NEMA', nazev: 'NEMA 34 – rozteč 69,6 mm, ⌀6,5, nákružek ⌀73', otvory: () => [[0, 0, 73.2, 'nákružek']].concat(ctverec(69.6, 6.5, '')) },
    ...[[40, 32, 3.4], [50, 40, 4.3], [60, 50, 4.3], [70, 60, 4.3], [80, 71.5, 4.3], [92, 82.5, 4.3], [120, 105, 4.3], [140, 124.5, 4.3]].map(([v, a, d]) => ({
      id: 'vent' + v, sk: 'Ventilátory (rámeček)', nazev: `Ventilátor ${v} mm – rozteč ${fmt(a)} mm`,
      otvory: () => [[0, 0, v - 2, 'výřez']].concat(ctverec(a, d, '')),
    })),
    { id: 'rpi4', sk: 'Desky (elektronika)', nazev: 'Raspberry Pi 3B/4/5 – 58 × 49 mm, M2,5', otvory: () => obd(58, 49, 2.7, 'M2,5') },
    { id: 'rpizero', sk: 'Desky (elektronika)', nazev: 'Raspberry Pi Zero – 58 × 23 mm, M2,5', otvory: () => obd(58, 23, 2.7, 'M2,5') },
    { id: 'pico', sk: 'Desky (elektronika)', nazev: 'Raspberry Pi Pico – 47 × 11,4 mm, ⌀2,1', otvory: () => obd(47, 11.4, 2.1, '') },
    // Arduino Uno R3: otvory v milech od levého dolního rohu desky (68,6 × 53,3 mm); střed desky = počátek
    { id: 'uno', sk: 'Desky (elektronika)', nazev: 'Arduino Uno R3 (deska 68,6 × 53,3 mm)', otvory: () => [[550, 100], [600, 2000], [2600, 300], [2600, 1400]].map(([x, y]) => [x * 0.0254 - 34.29, y * 0.0254 - 26.67, 3.2, 'M3']) },
    ...[64, 96, 128, 160, 192, 224, 256, 320].map((a) => ({ id: 'uchytka' + a, sk: 'Nábytek', nazev: `Úchytka – rozteč ${a} mm (šrouby M4)`, otvory: () => [[-a / 2, 0, 5, 'M4'], [a / 2, 0, 5, 'M4']] })),
    { id: 'pant35', sk: 'Nábytek', nazev: 'Miska závěsu ⌀35 + kolíky 45 / 9,5 mm (ověřte u výrobce)', otvory: () => [[0, 0, 35, 'miska'], [-22.5, -9.5, 8, 'kolík'], [22.5, -9.5, 8, 'kolík']] },
    { id: 'de9', sk: 'Konektory', nazev: 'D-Sub DE-9 – šrouby 24,99 mm', otvory: () => [[-12.495, 0, 3.1, '4-40'], [12.495, 0, 3.1, '4-40']] },
    { id: 'db25', sk: 'Konektory', nazev: 'D-Sub DB-25 – šrouby 47,04 mm', otvory: () => [[-23.52, 0, 3.1, '4-40'], [23.52, 0, 3.1, '4-40']] },
  ];

  /* Tabulka výpočtu rozteče (vzdálenosti, tětivy). */
  TT.tabulkaRozteci = function (otvory, p) {
    const rad2 = otvory.map((h, i) => {
      const prev = i > 0 ? otvory[i - 1] : null;
      return { i: i + 1, x: h.x, y: h.y, d: h.d, uhel: h.uhel, popis: h.popis || '',
        odPredch: prev ? Math.hypot(h.x - prev.x, h.y - prev.y) : null,
        odPrvniho: i > 0 ? Math.hypot(h.x - otvory[0].x, h.y - otvory[0].y) : null };
    });
    const souhrn = [];
    if (p && p.typ === 'kruh') {
      const n = Math.max(1, Math.round(+p.n)), D = +p.D;
      souhrn.push(['Úhlová rozteč', fmt(360 / n, 4) + '°']);
      souhrn.push(['Tětiva mezi sousedy', fmt(D * Math.sin(PI / n), 3) + ' mm']);
      souhrn.push(['Oblouk mezi sousedy', fmt(PI * D / n, 3) + ' mm']);
      if (n % 2 === 0) souhrn.push(['Protilehlé otvory', fmt(D, 3) + ' mm']);
      else souhrn.push(['Nejdelší vzdálenost (lichý počet)', fmt(D * Math.sin(PI * Math.floor(n / 2) / n), 3) + ' mm']);
    } else if (p && p.typ === 'oblouk') {
      const n = Math.max(1, Math.round(+p.n)), D = +p.D, k = n > 1 ? (+p.a2 - +p.a1) / (n - 1) : 0;
      souhrn.push(['Úhlová rozteč', fmt(k, 4) + '°']);
      souhrn.push(['Tětiva mezi sousedy', fmt(D * Math.sin(rad(Math.abs(k)) / 2), 3) + ' mm']);
    } else if (p && p.typ === 'rada') {
      const n = Math.max(1, Math.round(+p.n));
      const roz = p.rezim === 'rozdelit' ? (n > 1 ? ((+p.L || 0) - 2 * (+p.okraj || 0)) / (n - 1) : 0) : +p.roztec;
      souhrn.push(['Rozteč', fmt(roz, 3) + ' mm']);
      souhrn.push(['Vzdálenost krajních os', fmt(roz * (n - 1), 3) + ' mm']);
    } else if (p && p.typ === 'mrizka') {
      souhrn.push(['Počet otvorů', String(otvory.length)]);
      if (p.stridat) souhrn.push(['Šikmá vzdálenost (střídání)', fmt(Math.hypot(+p.px / 2, +p.py), 3) + ' mm']);
    }
    return { radky: rad2, souhrn };
  };

  /* ============================================================
     VRTACÍ ŠABLONA
     o.otvory: [{x,y,d,popis}] (Y nahoru)
     ============================================================ */
  TT.VYCHOZI.sablona = {
    obrys: 'auto', w: 120, h: 80, D: 100, rohy: 3, okraj: 12, kriz: 3, kotovani: 'tabulka', pismo: 2.2, tl: 0.18,
    zarazka: true, cislovat: true, popisek: '', stredBod: true,
  };
  TT.sablona = function (otvory, vst) {
    const o = Object.assign({}, TT.VYCHOZI.sablona, vst);
    const P = [], chyby = [];
    const vel = Math.max(0.8, +o.pismo), tl = Math.max(0.05, +o.tl), kr = Math.max(0, +o.kriz);
    // obrys v souřadnicích Y nahoru → převod na papír (y dolů): Y_papír = −y
    let ox0, oy0, ox1, oy1;               // obrys (Y nahoru)
    if (o.obrys === 'obd') { ox0 = 0; oy0 = 0; ox1 = +o.w; oy1 = +o.h; }
    else if (o.obrys === 'kruh') { const R = +o.D / 2; ox0 = -R; oy0 = -R; ox1 = R; oy1 = R; }
    else if (otvory.length) {
      ox0 = Math.min(...otvory.map((h) => h.x - h.d / 2)) - +o.okraj; ox1 = Math.max(...otvory.map((h) => h.x + h.d / 2)) + +o.okraj;
      oy0 = Math.min(...otvory.map((h) => h.y - h.d / 2)) - +o.okraj; oy1 = Math.max(...otvory.map((h) => h.y + h.d / 2)) + +o.okraj;
    } else { ox0 = 0; oy0 = 0; ox1 = 50; oy1 = 50; }
    const X = (x) => x, Y = (y) => -y;
    if (o.obrys === 'obd' || o.obrys === 'auto') {
      const r = Math.min(+o.rohy || 0, (ox1 - ox0) / 2, (oy1 - oy0) / 2);
      if (o.obrys === 'obd' || o.obrysAuto !== false) {
        if (r > 0.01) P.push(...obdelnikZaobleny(X(ox0), Y(oy1), ox1 - ox0, oy1 - oy0, r, 0.2, 'rez'));
        else P.push(cesta([[X(ox0), Y(oy1)], [X(ox1), Y(oy1)], [X(ox1), Y(oy0)], [X(ox0), Y(oy0)]], true, 0.2, 'rez'));
      }
    } else if (o.obrys === 'kruh') P.push(kruh(0, 0, +o.D / 2, 0.2, 'rez'));
    // vztažné hrany (zarážka): u obdélníku levá a spodní hrana; prodloužené tečkované čáry
    if (o.zarazka && o.obrys === 'obd') {
      P.push(cara(X(ox0), Y(oy0), X(ox0), Y(oy1), tl * 2.2), cara(X(ox0), Y(oy0), X(ox1), Y(oy0), tl * 2.2));
      P.push(text(X(ox0) + 1.2, Y(oy0) - vel * 0.9, '0,0', vel * 0.8, { zar: 'l' }));
    }
    if (o.obrys === 'kruh' || o.obrys === 'zadny' || o.obrys === 'auto') {
      // počátek souřadnic – malý křížek
      if (o.zarazka) { const k = 4; P.push(cara(-k, 0, k, 0, tl, 'kresba', '#7f8c8d'), cara(0, -k, 0, k, tl, 'kresba', '#7f8c8d')); }
    }
    // otvory
    otvory.forEach((h, i) => {
      const cx = X(h.x), cy = Y(h.y), r = Math.max(0, h.d / 2);
      if (r > 0) P.push(kruh(cx, cy, r, tl, 'kresba'));
      const k = r + kr;
      if (k > 0) P.push(cara(cx - k, cy, cx + k, cy, tl * 0.8), cara(cx, cy - k, cx, cy + k, tl * 0.8));
      if (o.stredBod) P.push(kruh(cx, cy, 0.3, 0.05, 'kresba', true));
      const lx = cx + Math.max(r, 0.7) * 0.72 + 0.8, ly = cy - Math.max(r, 0.7) * 0.72 - 0.8 - vel / 2;
      if (o.cislovat) P.push(text(lx, ly, String(i + 1), vel, { zar: 'l', b: '#c0392b' }));
      if (o.kotovani === 'souradnice' || o.kotovani === 'obe') {
        P.push(text(lx, ly + vel * 1.5 + (o.cislovat ? 0 : -vel * 1.5), `${fmt(h.x, 2)}; ${fmt(h.y, 2)}${r > 0 ? ' Ø' + fmt(h.d, 2) : ''}`, vel * 0.8, { zar: 'l' }));
      }
    });
    // kontrola překryvu otvorů
    for (let i = 0; i < otvory.length; i++) for (let j = i + 1; j < otvory.length; j++) {
      const a = otvory[i], b = otvory[j], dd = Math.hypot(a.x - b.x, a.y - b.y);
      if (dd < 1e-6) chyby.push(`Otvory ${i + 1} a ${j + 1} leží na stejném místě.`);
      else if (dd < (a.d + b.d) / 2 && !(dd + Math.min(a.d, b.d) / 2 <= Math.max(a.d, b.d) / 2)) chyby.push(`Otvory ${i + 1} a ${j + 1} se protínají (osy ${fmt(dd, 2)} mm).`);
    }
    if (o.obrys === 'obd' || o.obrys === 'kruh') {
      otvory.forEach((h, i) => {
        const ven = o.obrys === 'obd' ? (h.x - h.d / 2 < ox0 - 1e-6 || h.x + h.d / 2 > ox1 + 1e-6 || h.y - h.d / 2 < oy0 - 1e-6 || h.y + h.d / 2 > oy1 + 1e-6) : Math.hypot(h.x, h.y) + h.d / 2 > +o.D / 2 + 1e-6;
        if (ven) chyby.push(`Otvor ${i + 1} přesahuje obrys šablony.`);
      });
    }
    // rozměr obrysu
    const rozmer = o.obrys === 'kruh' ? `Ø ${fmt(+o.D)} mm` : `${fmt(ox1 - ox0, 2)} × ${fmt(oy1 - oy0, 2)} mm`;
    if (o.obrys !== 'zadny') {
      P.push(text((X(ox0) + X(ox1)) / 2, Y(oy0) + 2 + vel / 2, (o.popisek ? o.popisek + ' · ' : '') + 'obrys ' + rozmer, vel * 0.9));
    } else if (o.popisek) P.push(text((X(ox0) + X(ox1)) / 2, Y(oy0) + 2 + vel / 2, o.popisek, vel * 0.9));
    // tabulka otvorů vpravo od obrysu
    if ((o.kotovani === 'tabulka' || o.kotovani === 'obe') && otvory.length) {
      const tx = X(ox1) + 8, ty = Y(oy1);
      const sl = [{ n: 'č.', w: sirkaTextu('000', vel) + 2 }, { n: 'X', w: sirkaTextu('−000,00', vel) + 2 }, { n: 'Y', w: sirkaTextu('−000,00', vel) + 2 }, { n: 'Ø', w: sirkaTextu('000,00', vel) + 2 }];
      const maPopis = otvory.some((h) => h.popis);
      if (maPopis) sl.push({ n: 'popis', w: Math.max(sirkaTextu('popis', vel), ...otvory.map((h) => sirkaTextu(h.popis || '', vel))) + 2 });
      const rh = vel * 1.9, sirka = sl.reduce((a, s) => a + s.w, 0);
      const radky = [sl.map((s) => s.n)].concat(otvory.map((h, i) => {
        const r = [String(i + 1), fmt(h.x, 2), fmt(h.y, 2), h.d > 0 ? fmt(h.d, 2) : '–'];
        if (maPopis) r.push(h.popis || '');
        return r;
      }));
      radky.forEach((r, j) => {
        let x = tx;
        const y = ty + j * rh + rh / 2;
        r.forEach((t, k) => {
          const vlevo = k === 4;
          P.push(text(vlevo ? x + 1 : x + sl[k].w - 1, y, t, vel, { zar: vlevo ? 'l' : 'p', b: j === 0 || k === 0 ? '#c0392b' : undefined }));
          x += sl[k].w;
        });
        P.push(cara(tx, ty + (j + 1) * rh, tx + sirka, ty + (j + 1) * rh, j === 0 ? tl * 1.4 : tl * 0.5));
      });
      P.push(cara(tx, ty, tx + sirka, ty, tl * 1.4));
      P.push(text(tx, ty - vel * 1.2, 'Souřadnice od počátku (X →, Y ↑), mm', vel * 0.8, { zar: 'l' }));
    }
    const info = [`Vrtací šablona · ${otvory.length} otvorů`, 'obrys ' + rozmer];
    return kresba(P, 'Vrtací šablona', info, 0.6, { chyby, otvory });
  };

  /* CSV souřadnic otvorů (desetinná čárka, středník). */
  TT.csvOtvory = function (otvory) {
    const r = ['č.;X [mm];Y [mm];průměr [mm];popis'];
    otvory.forEach((h, i) => r.push([i + 1, fmt(h.x, 3), fmt(h.y, 3), fmt(h.d, 3), '"' + String(h.popis || '').replace(/"/g, '""') + '"'].join(';').replace(/−/g, '-')));
    return r.join('\r\n') + '\r\n';
  };

  /* ============================================================
     REGISTR ROZŠIŘUJÍCÍCH REŽIMŮ
     Modul (samostatný soubor) zavolá TT.registruj({...}) a stránka ho sama zařadí:
       id, ikona, nazev, popis, poradi (číslo pro řazení záložek),
       vychozi: {…}           výchozí parametry
       schema: […]            formulář (TT.pole.F/C/H – viz níže)
       predvolby: [[název, {…částečné parametry…}], …]
       gen: (o) => kresba      o = vychozi + změny uživatele
     Pole formuláře:
       H('Nadpis')                              mezititulek
       C(id, popis, jednotka, {min,max,cele,pul,kdy,napoveda})   číslo (povolené výrazy 3*25,4)
       F(id,'vyber',popis,{moznosti:[[hod,popis(,skupina)]], cislo:true?, pul, kdy})
       F(id,'zaskrt',popis,{pul,kdy}) · F(id,'text',popis) · F(id,'textarea',popis,{napoveda})
       kdy: (o) => bool  – pole se ukáže jen když platí
     ============================================================ */
  TT.REZIMY = [];
  TT.registruj = function (r) {
    if (!r || !r.id || typeof r.gen !== 'function') throw new Error('TT.registruj: chybí id nebo gen');
    const i = TT.REZIMY.findIndex((q) => q.id === r.id);
    if (i >= 0) TT.REZIMY[i] = r; else TT.REZIMY.push(r);
    TT.REZIMY.sort((a, b) => (a.poradi || 100) - (b.poradi || 100));
    return r;
  };
  const pF = (id, typ, popis, x) => Object.assign({ id, typ, popis }, x || {});
  TT.pole = {
    F: pF,
    H: (nadpis) => ({ nadpis }),
    C: (id, popis, jedn, x) => pF(id, 'cislo', popis, Object.assign({ jedn }, x || {})),
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TT;
  else koren.TT = TT;
})(typeof window !== 'undefined' ? window : globalThis);
