// Lukavice 3D – jádro bez three.js: výšky terénu, povrch, kolize, chodec a auto.
// Souřadnice: x na východ, z na jih, y nahoru, metry. Data z tools/lukavice_data.py.

const BUNKA = 20;          // m – mřížka pro hledání budov, stromů a cest

export function nahodne(semeno) {   // mulberry32
  let a = semeno >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dmNaM = pole => { const o = new Float32Array(pole.length); for (let i = 0; i < pole.length; i++) o[i] = pole[i] / 10; return o; };

// maska: Uint8Array šířka×výška po data.px metrech (255 les, 120 zahrada)
// koryto: RGBA pixely koryto.png (data.koryto = [š, v]) – jemná vložka koryt potoků, viz tools/lukavice_cuzk.py
// plotyKatastr: obsah ploty.json (tools/lukavice_ploty.py) – nepovinné
export function vytvorSvet(data, vyskyU16, maska, koryto = null, plotyKatastr = null) {
  const { nx, nz, krok, sirka, hloubka, vyskaMin } = data;
  const x0 = -sirka / 2, z0 = -hloubka / 2;
  const H = new Float32Array(nx * nz);
  for (let i = 0; i < H.length; i++) H[i] = vyskaMin + vyskyU16[i] / 10;

  // koryta: odchylka jemného DMR od hrubého terénu (× váha), v síti pixelů koryto.png
  const [kW, kH] = koryto && data.koryto ? data.koryto : [0, 0];
  const korOff = new Float32Array(kW * kH), korMaska = new Uint8Array(kW * kH);
  for (let i = 0; i < kW * kH; i++) {
    korMaska[i] = koryto[i * 4 + 2] > 127 ? 1 : 0;
    korOff[i] = korMaska[i] ? (koryto[i * 4] - 128) * 0.04 * koryto[i * 4 + 1] / 255 : 0;
  }
  const ksx = sirka / (kW || 1), ksz = hloubka / (kH || 1);
  function odchylkaKoryta(x, z) {
    let fi = (x - x0) / ksx - 0.5, fj = (z - z0) / ksz - 0.5;
    if (fi < 0 || fj < 0 || fi >= kW - 1 || fj >= kH - 1) return 0;
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * kW + i;
    return korOff[k] * (1 - u) * (1 - v) + korOff[k + 1] * u * (1 - v) + korOff[k + kW] * (1 - u) * v + korOff[k + kW + 1] * u * v;
  }
  const vyska = kW ? (x, z) => vyskaHruba(x, z) + odchylkaKoryta(x, z) : vyskaHruba;

  // stejné dělení čtverce na trojúhelníky jako síť terénu: úhlopříčka (i+1,j)–(i,j+1)
  function vyskaHruba(x, z) {
    let fx = (x - x0) / krok, fz = (z - z0) / krok;
    fx = Math.min(Math.max(fx, 0), nx - 1.001); fz = Math.min(Math.max(fz, 0), nz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1];
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }

  const gx = Math.ceil(sirka / BUNKA), gz = Math.ceil(hloubka / BUNKA);
  const mrizka = () => Array.from({ length: gx * gz }, () => []);
  const bunka = (x, z) => {
    const i = Math.floor((x - x0) / BUNKA), j = Math.floor((z - z0) / BUNKA);
    return i < 0 || j < 0 || i >= gx || j >= gz ? -1 : j * gx + i;
  };
  function vloz(m, minx, minz, maxx, maxz, co) {
    for (let j = Math.max(0, Math.floor((minz - z0) / BUNKA)); j <= Math.min(gz - 1, Math.floor((maxz - z0) / BUNKA)); j++)
      for (let i = Math.max(0, Math.floor((minx - x0) / BUNKA)); i <= Math.min(gx - 1, Math.floor((maxx - x0) / BUNKA)); i++)
        m[j * gx + i].push(co);
  }

  // budovy
  const budovy = data.budovy.map(([druh, vyskaDm, strecha, b, okapDm = 0, hrebenDm = 0, osa = 0, barva = -1]) => {
    const body = dmNaM(b);
    let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
    for (let k = 0; k < body.length; k += 2) {
      minx = Math.min(minx, body[k]); maxx = Math.max(maxx, body[k]);
      minz = Math.min(minz, body[k + 1]); maxz = Math.max(maxz, body[k + 1]);
    }
    return { druh, vyska: vyskaDm / 10, strecha, body, minx, minz, maxx, maxz, okap: okapDm / 10, hreben: hrebenDm / 10, osa, barva };
  });
  const mBudovy = mrizka();
  budovy.forEach(b => vloz(mBudovy, b.minx, b.minz, b.maxx, b.maxz, b));

  // cesty – úsečky s poloviční šířkou
  const cesty = data.cesty.map(([druh, sirkaDm, zpevnena, b]) => ({ druh, sirka: sirkaDm / 10, zpevnena: !!zpevnena, body: dmNaM(b) }));
  const mCesty = mrizka();
  for (const c of cesty) {
    for (let k = 0; k + 3 < c.body.length; k += 2) {
      const ax = c.body[k], az = c.body[k + 1], bx = c.body[k + 2], bz = c.body[k + 3], r = c.sirka / 2;
      vloz(mCesty, Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r, { ax, az, bx, bz, r, c });
    }
  }

  // ---------- vybavení ulic: chodníky, lampy, zaparkovaná auta, objekty z OSM ----------
  const prekazky = [];        // obdélníky {druh, body, …} – kolize jako budovy
  function prekazka(x, z, smer, delka, sirka, druh) {
    const fx = Math.sin(smer), fz = Math.cos(smer), lx = fz, lz = -fx, d = delka / 2, w = sirka / 2;
    const body = new Float32Array([
      x + fx * d + lx * w, z + fz * d + lz * w, x - fx * d + lx * w, z - fz * d + lz * w,
      x - fx * d - lx * w, z - fz * d - lz * w, x + fx * d - lx * w, z + fz * d - lz * w]);
    const p = { druh, body, minx: Math.min(body[0], body[2], body[4], body[6]), maxx: Math.max(body[0], body[2], body[4], body[6]),
      minz: Math.min(body[1], body[3], body[5], body[7]), maxz: Math.max(body[1], body[3], body[5], body[7]) };
    prekazky.push(p);
    vloz(mBudovy, p.minx, p.minz, p.maxx, p.maxz, p);
  }
  function budovaBlizko(x, z, r) {
    for (let j = Math.floor((z - r - z0) / BUNKA); j <= Math.floor((z + r - z0) / BUNKA); j++)
      for (let i = Math.floor((x - r - x0) / BUNKA); i <= Math.floor((x + r - x0) / BUNKA); i++) {
        if (i < 0 || j < 0 || i >= gx || j >= gz) continue;
        for (const b of mBudovy[j * gx + i]) if (b.vyska && x > b.minx - r && x < b.maxx + r && z > b.minz - r && z < b.maxz + r) return true;
      }
    return false;
  }
  function vPrekazce(x, z, r) {      // kruh zasahuje do budovy nebo překážky
    const b = bunka(x, z);
    return b >= 0 && mBudovy[b].some(o => x > o.minx - r && x < o.maxx + r && z > o.minz - r && z < o.maxz + r && vytlacZPolygonu(x, z, r, o.body));
  }
  const naJineCeste = (x, z, c, okraj) => blizkeCesty(x, z).some(u => u.c !== c && vzdalenostKUsecce(x, z, u.ax, u.az, u.bx, u.bz) < u.r + okraj);
  function nejblizsiCesta(x, z, max, jenZpevnene) {
    let nej = null, nd = max;
    for (let j = Math.floor((z - max - z0) / BUNKA); j <= Math.floor((z + max - z0) / BUNKA); j++)
      for (let i = Math.floor((x - max - x0) / BUNKA); i <= Math.floor((x + max - x0) / BUNKA); i++) {
        if (i < 0 || j < 0 || i >= gx || j >= gz) continue;
        for (const u of mCesty[j * gx + i]) {
          if (jenZpevnene && !u.c.zpevnena) continue;
          const d = vzdalenostKUsecce(x, z, u.ax, u.az, u.bx, u.bz) - u.r;
          if (d < nd) { nd = d; nej = u; }
        }
      }
    if (!nej) return null;
    const dx = nej.bx - nej.ax, dz = nej.bz - nej.az, l = Math.hypot(dx, dz) || 1;
    const t = Math.min(1, Math.max(0, ((x - nej.ax) * dx + (z - nej.az) * dz) / (l * l)));
    const px = nej.ax + dx * t, pz = nej.az + dz * t;
    let strana = Math.sign((x - px) * (dz / l) - (z - pz) * (dx / l)) || 1;   // +1 = vlevo od směru úseku
    return { u: nej, x: px, z: pz, dx: dx / l, dz: dz / l, strana, vzdal: nd + nej.r };
  }

  // úseky ulic v zástavbě po obou stranách silnic; chodník (zvýšený, s obrubníkem) jen u hlavních silnic
  const ULICE = new Set(['secondary', 'tertiary', 'unclassified', 'residential', 'living_street']);
  const S_CHODNIKEM = new Set(['secondary', 'tertiary']);
  const CH_SIRKA = 1.6;
  const ulice = [];           // {body: Float32Array (střed chodníku / okraj vozovky + 0,5 m), ven: jednotkové vektory od silnice, chodnik}
  const mChodniky = mrizka();
  for (const c of cesty) {
    if (!ULICE.has(c.druh)) continue;
    const pts = prevzorkuj(c.body, 3), sChodnikem = S_CHODNIKEM.has(c.druh);
    for (const st of [1, -1]) {
      const d = c.sirka / 2 + (sChodnikem ? 0.12 + CH_SIRKA / 2 : 0.5);
      let run = [];
      const konec = () => {
        if (run.length >= 4) ulice.push({ body: Float32Array.from(run.flatMap(p => [p.x, p.z])), ven: Float32Array.from(run.flatMap(p => [p.ox, p.oz])), cesta: c, strana: st, chodnik: sChodnikem });
        run = [];
      };
      for (const p of pts) {
        const ox = p.dz * st, oz = -p.dx * st, x = p.x + ox * d, z = p.z + oz * d;
        if (budovaBlizko(x, z, sChodnikem ? 25 : 18) && !naJineCeste(x, z, c, 1.0) && !vPrekazce(x, z, sChodnikem ? CH_SIRKA / 2 + 0.2 : 0.5)) run.push({ x, z, ox, oz });
        else konec();
      }
      konec();
    }
  }
  const chodniky = ulice.filter(u => u.chodnik);
  for (const ch of chodniky)
    for (let k = 0; k + 3 < ch.body.length; k += 2) {
      const ax = ch.body[k], az = ch.body[k + 1], bx = ch.body[k + 2], bz = ch.body[k + 3], r = CH_SIRKA / 2;
      vloz(mChodniky, Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r, { ax, az, bx, bz, r });
    }

  // ploty z katastru (kusy po ≤ 3 m; vynechat vozovku, chodník a stěny) – před auty, ať se nepřekrývají
  const plotyK = [], vrata = [];
  if (plotyKatastr) {
    for (const [druh, b] of plotyKatastr.ploty) {
      const body = dmNaM(b);
      let kus = [];
      const hotovo = () => { if (kus.length >= 4) plotyK.push({ druh, body: Float32Array.from(kus) }); kus = []; };
      for (const p of prevzorkuj(body, 3)) {
        const volno = !naJineCeste(p.x, p.z, null, 0.4) && !chodnikBlizko(p.x, p.z, 0.2) && !vPrekazce(p.x, p.z, 0.25);
        if (volno) kus.push(p.x, p.z); else hotovo();
      }
      hotovo();
    }
    for (const pl of plotyK) {
      const b = pl.body;
      for (let k = 0; k + 3 < b.length; k += 2) {
        const ax = b[k], az = b[k + 1], bx = b[k + 2], bz = b[k + 3];
        prekazka((ax + bx) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az), Math.hypot(bx - ax, bz - az), pl.druh === 'zivy' ? 0.7 : 0.15, 'plot');
      }
    }
    for (const [druh, xd, zd, smer, sirkaDm] of plotyKatastr.branky) vrata.push({ druh, x: xd / 10, z: zd / 10, smer, sirka: sirkaDm / 10 });
  }

  const objekty = [];         // {druh, x, z, smer} – smer: lokální +z objektu míří k silnici
  const rndV = nahodne(777);
  const zaparkovana = [];
  // auto na dvoře za vraty (čelem k vratům)
  for (const v of vrata) {
    if (v.druh !== 'vrata' || rndV() > 0.45) continue;
    const nx = Math.cos(v.smer), nz = -Math.sin(v.smer);       // kolmice k plotu
    const n = nejblizsiCesta(v.x, v.z, 25, false);
    const ven = n ? Math.sign((n.x - v.x) * nx + (n.z - v.z) * nz) || 1 : 1;   // +1 = silnice na straně kolmice
    const ax = v.x - nx * ven * 4.2, az = v.z - nz * ven * 4.2, smer = Math.atan2(nx * ven, nz * ven);
    if (!vPrekazce(ax, az, 1.3) && !naJineCeste(ax, az, null, 0.5)) {
      zaparkovana.push({ x: ax, z: az, smer, barva: Math.floor(rndV() * 8) });
      prekazka(ax, az, smer, 4.3, 1.8, 'auto');
    }
  }
  for (const ch of ulice) {
    let delka = 0, posledniAuto = -99;
    for (let k = 0; k < ch.body.length; k += 2) {
      const x = ch.body[k], z = ch.body[k + 1], ox = ch.ven[k], oz = ch.ven[k + 1];
      if (k) delka += Math.hypot(x - ch.body[k - 2], z - ch.body[k - 1]);
      // lampa každých 38 m na vnějším okraji chodníku, rameno nad silnici
      if ((ch.chodnik || ch.strana > 0) && (delka + (ch.strana > 0 ? 8 : 27)) % 38 < 3 && k + 2 < ch.body.length) {
        const lxp = x + ox * (ch.chodnik ? 0.55 : 0.2), lzp = z + oz * (ch.chodnik ? 0.55 : 0.2);
        objekty.push({ druh: 'lampa', x: lxp, z: lzp, smer: Math.atan2(-ox, -oz) });
        prekazka(lxp, lzp, 0, 0.3, 0.3, 'lampa');
      }
      // auto zaparkované před domem
      if (delka - posledniAuto > 30 && rndV() < 0.03) {
        const o = ch.chodnik ? 3.0 : 2.6, ax = x + ox * o, az = z + oz * o, smer = Math.atan2(-oz, ox) + (rndV() < 0.5 ? 0 : Math.PI);
        if (!vPrekazce(ax, az, 2.4) && !naJineCeste(ax, az, null, 1.5) && !chodnikBlizko(ax, az, 1.3)) {
          zaparkovana.push({ x: ax, z: az, smer, barva: Math.floor(rndV() * 8) });
          prekazka(ax, az, smer, 4.3, 1.8, 'auto');
          posledniAuto = delka;
        }
      }
    }
  }
  function chodnikBlizko(x, z, okraj) {
    const b = bunka(x, z);
    return b >= 0 && mChodniky[b].some(u => vzdalenostKUsecce(x, z, u.ax, u.az, u.bx, u.bz) < u.r + okraj);
  }

  // směry vedení v uzlech (pro natočení konzol sloupů)
  const smerVedeni = new Map(), klic = (x, z) => Math.round(x * 10) + ',' + Math.round(z * 10);
  const vedeni = (data.vedeni || []).map(([druh, b]) => {
    const body = dmNaM(b);
    for (let k = 0; k < body.length; k += 2) {
      const a = Math.max(0, k - 2), c = Math.min(body.length - 2, k + 2);
      smerVedeni.set(klic(body[k], body[k + 1]), Math.atan2(body[c] - body[a], body[c + 1] - body[a + 1]));
    }
    return { druh, body };
  });
  const ROZMERY = { zastavka: [3.2, 1.5], lavicka: [1.7, 0.6], kriz: [0.9, 0.9], kaplicka: [1.8, 1.8], pomnik: [1.2, 1.2],
    schranka: [0.4, 0.4], kontejnery: [4.2, 1.6], sloup: [0.35, 0.35], stozar: [5, 5] };
  for (const [druh, xd, zd] of data.objekty || []) {
    let x = xd / 10, z = zd / 10, smer = rndV() * 6.283;
    if (druh === 'prechod') {
      const n = nejblizsiCesta(x, z, 6, true);
      if (n) objekty.push({ druh, x: n.x, z: n.z, smer: Math.atan2(n.dx, n.dz), sirka: n.u.r * 2 });
      continue;
    }
    if (druh === 'prejezd') {          // výstražné kříže po obou stranách silnice
      const n = nejblizsiCesta(x, z, 8, true);
      if (!n) continue;
      for (const st of [1, -1]) {
        const px = n.x + n.dz * st * (n.u.r + 1.3), pz = n.z - n.dx * st * (n.u.r + 1.3);
        objekty.push({ druh, x: px, z: pz, smer: Math.atan2(n.dx, n.dz) + (st > 0 ? 0 : Math.PI) });
        prekazka(px, pz, 0, 0.3, 0.3, druh);
      }
      continue;
    }
    if (druh === 'sloup' || druh === 'stozar') {
      smer = smerVedeni.get(klic(x, z)) ?? smer;
    } else {
      // k silnici: odsadit z vozovky (a chodníku) a natočit čelem k ní
      const n = nejblizsiCesta(x, z, druh === 'zastavka' ? 30 : 10, druh === 'zastavka');
      if (n) {
        const hloubka = ROZMERY[druh][1] / 2, okraj = chodnikBlizko(n.x + n.dz * n.strana * (n.u.r + 1), n.z - n.dx * n.strana * (n.u.r + 1), 0) ? 2.2 : 1.0;
        const min = n.u.r + okraj + hloubka;
        if (druh === 'zastavka' || n.vzdal < min) {
          x = n.x + n.dz * n.strana * min; z = n.z - n.dx * n.strana * min;
        }
        smer = Math.atan2(n.x - x, n.z - z);
      }
    }
    if (ROZMERY[druh]) {
      if (druh !== 'sloup' && druh !== 'stozar' && vPrekazce(x, z, 0.3)) continue;   // spadlo by do domu
      objekty.push({ druh, x, z, smer });
      prekazka(x, z, smer + Math.PI / 2, ...ROZMERY[druh], druh);
    }
  }
  const ploty = (data.ploty || []).map(([druh, b]) => {
    const body = dmNaM(b);
    for (let k = 0; k + 3 < body.length; k += 2) {
      const ax = body[k], az = body[k + 1], bx = body[k + 2], bz = body[k + 3];
      prekazka((ax + bx) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az), Math.hypot(bx - ax, bz - az), druh === 'zivy' ? 0.8 : 0.12, druh);
    }
    return { druh, body };
  });
  for (const o of [...objekty, ...zaparkovana]) o.y = vyska(o.x, o.z);

  // stromy: les ~7,5 m, zahrady řídce; + stromořadí a samostatné stromy z OSM
  const stromy = [];          // {x, z, jehlic, m (měřítko)}
  const mStromy = mrizka();
  const px = data.px, [mw, mh] = data.maska;
  const vMasce = (x, z) => {
    const i = Math.floor((x - x0) / px), j = Math.floor((z - z0) / px);
    return maska && i >= 0 && j >= 0 && i < mw && j < mh ? maska[j * mw + i] : 0;
  };
  const rnd = nahodne(4242);
  for (const [krokS, hodnota, jehlic, sance] of [[7.5, 255, 0.7, 1], [16, 120, 0.15, 0.55]]) {
    for (let z = z0 + 5; z < -z0 - 5; z += krokS) {
      for (let x = x0 + 5; x < -x0 - 5; x += krokS) {
        const sx = x + (rnd() - 0.5) * 0.9 * krokS, sz = z + (rnd() - 0.5) * 0.9 * krokS;
        const j = rnd() < jehlic, m = 0.75 + rnd() * 0.5, ok = rnd() < sance;
        if (ok && vMasce(sx, sz) === hodnota) stromy.push({ x: sx, z: sz, jehlic: j, m });
      }
    }
  }
  for (let k = 0; k < data.stromy.length; k += 3)
    stromy.push({ x: data.stromy[k] / 10, z: data.stromy[k + 1] / 10, jehlic: !!data.stromy[k + 2], m: 1.1 });
  // nesázet do chodníků, aut, plotů, zastávek… ani do koryt s vodou
  const voda = new Set();
  for (const [, b, hladiny] of data.potoky) {
    for (let k = 0; k < b.length / 2; k++) {
      if (!hladiny || !hladiny[k]) continue;
      const ci = Math.floor(b[k * 2] / 20), cj = Math.floor(b[k * 2 + 1] / 20);       // buňky 2 m
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) voda.add((ci + di) + ',' + (cj + dj));
    }
  }
  for (let i = stromy.length - 1; i >= 0; i--) {
    const s = stromy[i];
    if (chodnikBlizko(s.x, s.z, 0.6) || vPrekazce(s.x, s.z, 0.6) || voda.has(Math.floor(s.x / 2) + ',' + Math.floor(s.z / 2))) stromy.splice(i, 1);
  }
  for (const s of stromy) {
    s.y = vyska(s.x, s.z);
    const b = bunka(s.x, s.z);
    if (b >= 0) mStromy[b].push(s);
  }

  function blizkeCesty(x, z) {
    const b = bunka(x, z);
    return b < 0 ? [] : mCesty[b];
  }

  // o kolik je povrch výš než terén: chodník (obrubník) a vozovka (asfalt je zvednutý pás)
  const NAD_CHODNIKEM = 0.3, NAD_VOZOVKOU = 0.15;
  function nadZemi(x, z) {
    if (chodnikBlizko(x, z, 0)) return NAD_CHODNIKEM;
    return blizkeCesty(x, z).some(u => vzdalenostKUsecce(x, z, u.ax, u.az, u.bx, u.bz) < u.r) ? NAD_VOZOVKOU : 0;
  }

  // na čem stojím: 'silnice' (zpevněná), 'cesta' (polní), 'les', 'trava'
  function povrch(x, z) {
    let nejlepsi = null;
    for (const u of blizkeCesty(x, z)) {
      if (vzdalenostKUsecce(x, z, u.ax, u.az, u.bx, u.bz) <= u.r + 0.3) {
        if (u.c.zpevnena) return 'silnice';
        nejlepsi = 'cesta';
      }
    }
    return nejlepsi || (vMasce(x, z) === 255 ? 'les' : 'trava');
  }

  // vytlačí kruh (x,z,r) z budov a kmenů; vrátí {x, z, narazil}
  function kolize(x, z, r, sKmeny = true) {
    let narazil = false;
    for (let pruchod = 0; pruchod < 3; pruchod++) {
      let posun = false;
      const b = bunka(x, z);
      if (b < 0) break;
      for (const bud of mBudovy[b]) {
        if (x < bud.minx - r || x > bud.maxx + r || z < bud.minz - r || z > bud.maxz + r) continue;
        const v = vytlacZPolygonu(x, z, r, bud.body);
        if (v) { x = v[0]; z = v[1]; narazil = posun = true; }
      }
      if (sKmeny) {
        for (const s of mStromy[b]) {
          const dx = x - s.x, dz = z - s.z, rr = r + 0.3 * s.m, d2 = dx * dx + dz * dz;
          if (d2 < rr * rr) {
            const d = Math.sqrt(d2) || 1e-3;
            x = s.x + dx / d * rr; z = s.z + dz / d * rr; narazil = posun = true;
          }
        }
      }
      if (!posun) break;
    }
    const okraj = 15;
    const xx = Math.min(Math.max(x, x0 + okraj), -x0 - okraj), zz = Math.min(Math.max(z, z0 + okraj), -z0 - okraj);
    if (xx !== x || zz !== z) narazil = true;
    return { x: xx, z: zz, narazil };
  }

  function volneMisto(x, z, r) {
    const k = kolize(x, z, r);
    return Math.hypot(k.x - x, k.z - z) < 1e-6;
  }

  // nejbližší bod na zpevněné silnici (pro start auta)
  function naSilnici(x, z) {
    let nej = null, nd = Infinity;
    for (const c of cesty) {
      if (!c.zpevnena || c.sirka < 4) continue;
      for (let k = 0; k + 3 < c.body.length; k += 2) {
        const ax = c.body[k], az = c.body[k + 1], bx = c.body[k + 2], bz = c.body[k + 3];
        const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
        const px2 = ax + dx * t, pz = az + dz * t, d = Math.hypot(px2 - x, pz - z);
        if (d < nd) { nd = d; nej = { x: px2, z: pz, smer: Math.atan2(dx, dz) }; }
      }
    }
    return nej;
  }

  // šířka vody na obě strany od osy (nx, nz = kolmice): krokuje, dokud terén nevystoupí nad hladinu
  function brehyVody(x, z, nx, nz, hladina, max = 3) {
    const strana = s => { let d = 0; while (d < max && vyska(x + nx * s * (d + 0.25), z + nz * s * (d + 0.25)) < hladina) d += 0.25; return d; };
    return [strana(1), strana(-1)];
  }

  // jednotkový vektor od bodu k nejbližší silnici (do 60 m), nebo null
  function smerKSilnici(x, z) {
    const n = nejblizsiCesta(x, z, 60, false);
    if (!n) return null;
    const dx = n.x - x, dz = n.z - z, l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  }

  return { data, x0, z0, sirka, hloubka, H, vyska, vyskaHruba, povrch, plotyK, vrata, smerKSilnici, brehyVody,
    koryta: { kW, kH, korMaska, ksx, ksz }, kolize, volneMisto, naSilnici, nadZemi, NAD_CHODNIKEM,
    budovy, cesty, stromy, chodniky, objekty, zaparkovana, ploty, vedeni, prekazky, mista: data.mista.map(([nazev, x, z, druh]) => ({ nazev, x: x / 10, z: z / 10, druh })) };
}

// lomená čára → body po ≤ krok m se směrem {x, z, dx, dz}
export function prevzorkuj(body, krok) {
  const out = [];
  for (let k = 0; k + 3 < body.length; k += 2) {
    const ax = body[k], az = body[k + 1], bx = body[k + 2], bz = body[k + 3];
    const l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(l / krok));
    for (let i = 0; i < n; i++) out.push({ x: ax + (bx - ax) * i / n, z: az + (bz - az) * i / n, dx: (bx - ax) / (l || 1), dz: (bz - az) / (l || 1) });
  }
  const p = out[out.length - 1];
  if (p) out.push({ x: body[body.length - 2], z: body[body.length - 1], dx: p.dx, dz: p.dz });
  return out;
}

export function vzdalenostKUsecce(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

function uvnitr(x, z, body) {
  let in_ = false;
  for (let i = 0, j = body.length - 2; i < body.length; j = i, i += 2) {
    const xi = body[i], zi = body[i + 1], xj = body[j], zj = body[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) in_ = !in_;
  }
  return in_;
}

// kruh vs. mnohoúhelník: null, nebo nová poloha těsně vně
function vytlacZPolygonu(x, z, r, body) {
  let nd = Infinity, nx = 0, nz = 0;
  for (let i = 0, j = body.length - 2; i < body.length; j = i, i += 2) {
    const ax = body[j], az = body[j + 1], bx = body[i], bz = body[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < nd) { nd = d; nx = px; nz = pz; }
  }
  const vnitr = uvnitr(x, z, body);
  if (!vnitr && nd >= r) return null;
  let ux = x - nx, uz = z - nz;
  const l = Math.hypot(ux, uz) || 1e-6;
  ux /= l; uz /= l;
  if (vnitr) { ux = -ux; uz = -uz; }
  return [nx + ux * (r + 0.01), nz + uz * (r + 0.01)];
}

// ---------- chodec ----------
export function novyChodec(x, z, svet) {
  return { x, z, y: svet.vyska(x, z), vy: 0, smer: 0, rychlost: 0, faze: 0, naZemi: true };
}

// vstup: {dopredu -1..1, bokem -1..1, beh, skok}, uhelKamery = směr pohledu (rad)
export function krokChodce(ch, vstup, uhelKamery, dt, svet) {
  const delka = Math.hypot(vstup.dopredu, vstup.bokem);
  const cil = delka > 0.05 ? (vstup.beh ? 5.5 : 1.8) * Math.min(1, delka) : 0;
  ch.rychlost += (cil - ch.rychlost) * Math.min(1, dt * 8);
  if (delka > 0.05) {
    const smerPohybu = uhelKamery + Math.atan2(-vstup.bokem, vstup.dopredu);
    let d = smerPohybu - ch.smer;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    ch.smer += d * Math.min(1, dt * 10);
  }
  let x = ch.x + Math.sin(ch.smer) * ch.rychlost * dt;
  let z = ch.z + Math.cos(ch.smer) * ch.rychlost * dt;
  const k = svet.kolize(x, z, 0.35);
  ch.x = k.x; ch.z = k.z;
  const zem = svet.vyska(ch.x, ch.z) + svet.nadZemi(ch.x, ch.z);
  if (vstup.skok && ch.naZemi) { ch.vy = 4.6; ch.naZemi = false; }
  ch.vy -= 9.81 * dt;
  ch.y += ch.vy * dt;
  if (ch.y <= zem) { ch.y = zem; ch.vy = 0; ch.naZemi = true; }
  else if (ch.naZemi && ch.y - zem < 0.4) ch.y = zem;   // sejít ze schodu / svahu
  else ch.naZemi = false;
  ch.faze += ch.rychlost * dt * 1.7;
}

// ---------- auto ----------
export const AUTO = { rozvor: 2.6, rozchod: 1.55, delka: 4.3, sirka: 1.8, maxRejd: 0.6, kolo: 0.33 };
const POVRCHY = {   // max rychlost m/s, odpor, přilnavost
  silnice: [42, 0.012, 1], cesta: [20, 0.08, 0.7], trava: [14, 0.25, 0.55], les: [8, 0.5, 0.45],
};

export function noveAuto(x, z, smer, svet) {
  return { x, z, smer, rychlost: 0, rejd: 0, y: svet.vyska(x, z), klopeni: 0, naklon: 0, kola: 0,
    povrch: 'silnice', naraz: 0 };
}

// vstup: {plyn -1..1, zatoc -1..1 (kladně doleva), brzda (ruční)}
export function krokAuta(a, vstup, dt, svet) {
  const [vmax, odpor, prilnavost] = POVRCHY[a.povrch] || POVRCHY.trava;
  const v = a.rychlost;
  const cilRejd = vstup.zatoc * AUTO.maxRejd / (1 + v * v / 250);
  a.rejd += (cilRejd - a.rejd) * Math.min(1, dt * 6);

  if (vstup.plyn > 0) {
    a.rychlost += (v < -0.5 ? 12 : 5.5 * prilnavost * (1 - Math.max(0, v) / vmax)) * vstup.plyn * dt;
  } else if (vstup.plyn < 0) {
    a.rychlost -= (v > 0.5 ? 12 : 3.5 * (1 + v / 9)) * -vstup.plyn * dt;
  }
  if (vstup.brzda) a.rychlost -= Math.sign(a.rychlost) * Math.min(Math.abs(a.rychlost), 9 * dt);
  // odpor vzduchu, valivý odpor podle povrchu, a překročení max. rychlosti povrchu
  a.rychlost -= a.rychlost * (0.004 * Math.abs(a.rychlost) + odpor) * dt;
  if (Math.abs(a.rychlost) > vmax) a.rychlost -= Math.sign(a.rychlost) * (Math.abs(a.rychlost) - vmax) * dt * 1.5;
  // kopec: složka tíhy podél směru jízdy
  a.rychlost -= 9.81 * Math.sin(a.klopeni) * dt * 0.6;
  if (vstup.plyn === 0 && !vstup.brzda && Math.abs(a.rychlost) < 0.15 && Math.abs(a.klopeni) < 0.15) a.rychlost = 0;

  a.smer += a.rychlost / AUTO.rozvor * Math.tan(a.rejd) * dt * (vstup.brzda ? 1.4 : 1);
  const fx = Math.sin(a.smer), fz = Math.cos(a.smer);
  let x = a.x + fx * a.rychlost * dt, z = a.z + fz * a.rychlost * dt;

  // dva kruhy (předek, zadek) proti budovám a kmenům
  let narazil = false;
  for (const o of [1.25, -1.25]) {
    const k = svet.kolize(x + fx * o, z + fz * o, 0.95);
    if (k.narazil) { x = k.x - fx * o; z = k.z - fz * o; narazil = true; }
  }
  if (narazil) {
    a.naraz = Math.abs(a.rychlost);
    a.rychlost *= -0.25;
  } else a.naraz = 0;
  a.x = x; a.z = z;
  a.povrch = svet.povrch(x, z);

  // poloha na terénu ze 4 kol
  const lx = Math.cos(a.smer), lz = -Math.sin(a.smer), r = AUTO.rozvor / 2, s = AUTO.rozchod / 2;
  const h = (p, q) => { const px = x + fx * p + lx * q, pz = z + fz * p + lz * q; return svet.vyska(px, pz) + svet.nadZemi(px, pz); };
  const pl = h(r, s), pp = h(r, -s), zl = h(-r, s), zp = h(-r, -s);
  a.y = (pl + pp + zl + zp) / 4;
  a.klopeni = Math.atan2((pl + pp - zl - zp) / 2, AUTO.rozvor);   // kladně = čumák nahoru
  a.naklon = Math.atan2((pl + zl - pp - zp) / 2, AUTO.rozchod);   // kladně = levá strana výš
  a.kola += a.rychlost * dt / AUTO.kolo;
}
