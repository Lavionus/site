/* Dopravní magnát – mapa: výšky v rozích polí, povrch, řeky, lesy, města a průmysl.
   Bez DOM (jde do node). Náhoda jen z MAG.Nahoda (seed), nikdy Math.random.

   Výšky jsou v ROZÍCH polí: v[(y)*(W+1)+x], pole (x,y) má rohy
   0 = (x,y) horní, 1 = (x+1,y) pravý, 2 = (x+1,y+1) dolní, 3 = (x,y+1) levý (v izometrii).
   Sousední rohy (i úhlopříčně) se liší nejvýš o 1 → každé pole je rovné, nebo mírný svah.
   Moře = pole se všemi rohy ve výšce 0. */
(function (MAG) {
  'use strict';
  const D = MAG.data, T = D.T;

  function novaMapa(W, H) {
    return {
      W, H, R: W + 1,
      v: new Uint8Array((W + 1) * (H + 1)),
      typ: new Uint8Array(W * H),
      les: new Uint8Array(W * H),     // hustota stromů 0–3
      reka: new Uint8Array(W * H),
      cesta: new Uint8Array(W * H),   // silnice: 1 = obecní, 2 = hráčova
      stan: new Int16Array(W * H),    // id stanice + 1 (zastávka / nákladní stanoviště na silnici)
      osa: new Uint8Array(W * H),     // osa zastávky: 1 = podél x, 2 = podél y
      depo: new Int16Array(W * H),    // id garáže + 1
      smer: new Uint8Array(W * H),    // výjezd garáže / depa: index SOUSEDE4 + 1
      kolej: new Uint8Array(W * H),   // bity spojení koleje do stran (1 << d)
      most: new Uint8Array(W * H),    // most přes vodu/řeku: osa 1 = podél x, 2 = podél y
      mostV: new Uint8Array(W * H),   // výška mostovky (stupně)
      navest: new Uint8Array(W * H),  // návěstidla: bit d = hlídá odjezd z pole směrem d
      navestJ: new Uint8Array(W * H), // jednosměrná: bit d = proti směru d se nesmí jet
      elek: new Uint8Array(W * H),    // 1 = elektrizovaná kolej (trolej)
      vrt: new Uint8Array(W * H),     // 1 = rychlostní kolej
      tunel: new Uint8Array(W * H),   // vnitřek tunelu (kolej/silnice pod terénem): osa 1 = podél x, 2 = podél y
      tunelV: new Uint8Array(W * H),  // výška tunelu (stupně)
      zdym: new Uint8Array(W * H),    // zdymadlo na svažité řece: osa 1 = podél x, 2 = podél y
      tram: new Uint8Array(W * H),    // 1 = tramvajová kolej v silnici (nebo v garáži)
      dum: new Int32Array(W * H),     // index domu + 1
      prum: new Int16Array(W * H),    // index průmyslu + 1
      domy: [], mesta: [], prumysl: [],
    };
  }

  // --- dotazy -------------------------------------------------------------
  const idx = (m, x, y) => y * m.W + x;
  const uvnitr = (m, x, y) => x >= 0 && y >= 0 && x < m.W && y < m.H;
  function rohy(m, x, y) {
    const R = m.R, i = y * R + x;
    return [m.v[i], m.v[i + 1], m.v[i + R + 1], m.v[i + R]];
  }
  function minR(m, x, y) { const r = rohy(m, x, y); return Math.min(r[0], r[1], r[2], r[3]); }
  function maxR(m, x, y) { const r = rohy(m, x, y); return Math.max(r[0], r[1], r[2], r[3]); }
  const jeRovne = (m, x, y) => minR(m, x, y) === maxR(m, x, y);
  const jeVoda = (m, x, y) => m.typ[idx(m, x, y)] === T.VODA;
  const SOUSEDE4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  function zjistiVodu(m, x0, y0, x1, y1) {
    for (let y = Math.max(0, y0); y <= Math.min(m.H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(m.W - 1, x1); x++) {
      const i = idx(m, x, y), voda = maxR(m, x, y) === 0;
      if (voda) { m.typ[i] = T.VODA; m.les[i] = 0; m.reka[i] = 0; }
      else if (m.typ[i] === T.VODA) m.typ[i] = T.TRAVA;
    }
  }

  /* Úprava terénu: rohy `pevne` (Map index → výška) se nastaví, okolní se dorovnají
     tak, aby se sousední rohy lišily nejvýš o 1 (šíří se do šířky). Vrací obdélník změn.
     `chranene` (Set indexů rohů): kdyby se musel změnit některý z nich, vše se vrátí a vrací null. */
  function terraformuj(m, pevne, chranene) {
    const R = m.R, Hh = m.H + 1, fronta = [];
    if (chranene && m.tunel) for (let i = 0; i < m.W * m.H; i++) if (m.tunel[i]) { const x = i % m.W, y = (i / m.W) | 0; for (const c of [y * R + x, y * R + x + 1, (y + 1) * R + x, (y + 1) * R + x + 1]) chranene.add(c); }   // terén nad tunelem se nemění
    const zaloha = chranene ? { v: m.v.slice(), typ: m.typ.slice(), les: m.les.slice(), reka: m.reka.slice() } : null;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    const zmena = i => { const x = i % R, y = (i / R) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    for (const [i, h] of pevne) { m.v[i] = h; fronta.push(i); zmena(i); }
    while (fronta.length) {
      const c = fronta.pop(), cx = c % R, cy = (c / R) | 0;
      // roh posunutý vlnou z jiné strany může odskočit od pevného souseda → přitáhnout zpět
      if (!pevne.has(c)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy, n = ny * R + nx;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < R && ny < Hh && pevne.has(n)) m.v[c] = Math.max(m.v[n] - 1, Math.min(m.v[n] + 1, m.v[c]));
      }
      const hc = m.v[c];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= R || ny >= Hh) continue;
        const n = ny * R + nx;
        if (pevne.has(n)) continue;
        const nova = m.v[n] > hc + 1 ? hc + 1 : m.v[n] + 1 < hc ? hc - 1 : -1;
        if (nova < 0) continue;
        if (chranene && chranene.has(n)) { m.v.set(zaloha.v); m.typ.set(zaloha.typ); m.les.set(zaloha.les); m.reka.set(zaloha.reka); return null; }
        m.v[n] = nova; fronta.push(n); zmena(n);
      }
    }
    if (x1 >= 0) zjistiVodu(m, x0 - 1, y0 - 1, x1, y1);
    return { x0, y0, x1, y1 };
  }

  // --- generátor ------------------------------------------------------------
  function teren(m, nah, seed, opt) {
    const { W, H, R } = m, kr = D.KRAJINA[opt.krajina] || D.KRAJINA.kopce;
    const sum = MAG.fbm(MAG.hash(seed, 'vyska'), 6), sum2 = MAG.fbm(MAG.hash(seed, 'hrbet'), 3);
    const f = 1 / (24 * kr.meritko) * (64 / Math.max(64, Math.min(W, H))) ** 0.35;
    const syrove = new Float32Array((W + 1) * (H + 1));
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
      // hřbety: |šum − ½| dá pásma hor
      const z = sum(x * f, y * f) * 0.8 + (1 - Math.abs(sum2(x * f * 0.7, y * f * 0.7) - 0.5) * 2) * 0.2;
      syrove[y * R + x] = z;
    }
    const serazene = Float32Array.from(syrove).sort();
    const hladina = serazene[Math.floor(serazene.length * (D.VODA[opt.voda] ?? D.VODA.stredne))];
    const vrch = serazene[serazene.length - 1];
    for (let i = 0; i < syrove.length; i++) {
      const z = syrove[i];
      if (z <= hladina) { m.v[i] = 0; continue; }
      const t = (z - hladina) / (vrch - hladina || 1);
      m.v[i] = Math.min(D.MAX_VYSKA, 1 + Math.floor(t ** kr.mocnina * kr.max));
    }
    // vyrovnat: sousední rohy (i úhlopříčně) nejvýš o 1 → dvě chamfer pasáže snižováním
    for (let pruchod = 0; pruchod < 4; pruchod++) {
      let zmena = false;
      for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
        const i = y * R + x;
        let mn = m.v[i];
        if (x > 0) mn = Math.min(mn, m.v[i - 1] + 1);
        if (y > 0) { mn = Math.min(mn, m.v[i - R] + 1); if (x > 0) mn = Math.min(mn, m.v[i - R - 1] + 1); if (x < W) mn = Math.min(mn, m.v[i - R + 1] + 1); }
        if (mn < m.v[i]) { m.v[i] = mn; zmena = true; }
      }
      for (let y = H; y >= 0; y--) for (let x = W; x >= 0; x--) {
        const i = y * R + x;
        let mn = m.v[i];
        if (x < W) mn = Math.min(mn, m.v[i + 1] + 1);
        if (y < H) { mn = Math.min(mn, m.v[i + R] + 1); if (x < W) mn = Math.min(mn, m.v[i + R + 1] + 1); if (x > 0) mn = Math.min(mn, m.v[i + R - 1] + 1); }
        if (mn < m.v[i]) { m.v[i] = mn; zmena = true; }
      }
      if (!zmena) break;
    }
    zjistiVodu(m, 0, 0, W - 1, H - 1);
  }

  function povrch(m, seed) {
    const { W, H } = m;
    let vrch = 0;
    for (let i = 0; i < m.v.length; i++) if (m.v[i] > vrch) vrch = m.v[i];
    m.vrch = vrch;
    const snezna = vrch >= 9 ? Math.round(vrch * 0.78) : 99, skalni = vrch >= 6 ? Math.round(vrch * 0.6) : 99;
    const sumLes = MAG.fbm(MAG.hash(seed, 'les'), 4), sumSk = MAG.fbm(MAG.hash(seed, 'skala'), 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(m, x, y);
      if (m.typ[i] === T.VODA) continue;
      const r = rohy(m, x, y), avg = (r[0] + r[1] + r[2] + r[3]) / 4;
      if (avg >= snezna) m.typ[i] = T.SNIH;
      else if (avg >= skalni && sumSk(x / 6, y / 6) > 0.5) m.typ[i] = T.SKALA;
      else if (Math.min(...r) === 0 && avg <= 0.75 && SOUSEDE4.some(([dx, dy]) => uvnitr(m, x + dx, y + dy) && jeVoda(m, x + dx, y + dy))
        && sumSk(x / 3 + 50, y / 3) > 0.42) m.typ[i] = T.PISEK;
      if (m.typ[i] === T.TRAVA || (m.typ[i] === T.SNIH && avg < snezna + 1)) {
        const l = sumLes(x / 11, y / 11);
        if (l > 0.56) m.les[i] = l > 0.68 ? 3 : l > 0.61 ? 2 : 1;
      }
    }
  }

  function reky(m, nah) {
    const { W, H } = m;
    const pocet = Math.round(W * H / 3600) + nah.cele(1, 2);
    let hotovo = 0;
    // pramen v horní polovině výšek (na rovině stačí 2 stupně)
    const prah = Math.max(2, Math.round(m.vrch * 0.38));
    for (let pokus = 0; pokus < pocet * 60 && hotovo < pocet; pokus++) {
      const sx = nah.cele(2, W - 3), sy = nah.cele(2, H - 3);
      if (m.typ[idx(m, sx, sy)] === T.VODA || m.reka[idx(m, sx, sy)]) continue;
      if (minR(m, sx, sy) < prah) continue;
      const cesta = [], navst = new Set();
      let x = sx, y = sy, ok = false;
      for (let krok = 0; krok < W * H / 4; krok++) {
        cesta.push(idx(m, x, y)); navst.add(idx(m, x, y));
        const tady = minR(m, x, y) + maxR(m, x, y);
        let nej = null, nejH = Infinity;
        for (const [dx, dy] of SOUSEDE4) {
          const nx = x + dx, ny = y + dy;
          if (!uvnitr(m, nx, ny) || navst.has(idx(m, nx, ny))) continue;
          if (jeVoda(m, nx, ny) || (m.reka[idx(m, nx, ny)] && cesta.length > 3)) { ok = true; break; }
          const h = minR(m, nx, ny) + maxR(m, nx, ny) + nah.f() * 0.6;
          // mírné stoupání (≤ 1 stupeň) povolené: přes plochou rovinu se řeka prodere k moři
          if (h <= tady + 1.2 && h < nejH) { nejH = h; nej = [nx, ny]; }
        }
        if (ok || !nej) break;
        [x, y] = nej;
      }
      if (!ok || cesta.length < 8) continue;
      for (const i of cesta) { m.reka[i] = 1; m.les[i] = 0; if (m.typ[i] !== T.SNIH) m.typ[i] = T.TRAVA; }
      hotovo++;
    }
  }

  function jmenoMesta(nah, pouzita) {
    const S = D.SLABIKY;
    for (let p = 0; p < 200; p++) {
      // na švech slabik nezdvojovat samohlásku (Mira+ava → Mirava), uvnitř slabiky ano (brook)
      let j = '';
      for (const c of [nah.vyber(S.zac), nah.vyber(S.stred), nah.vyber(S.kon)]) j += /[aeiou]$/.test(j) && c[0] === j[j.length - 1] ? c.slice(1) : c;
      if (j.length <= 11 && !pouzita.has(j)) { pouzita.add(j); return j; }
    }
    const j = 'Město ' + (pouzita.size + 1); pouzita.add(j); return j;
  }

  const volnaZeme = (m, x, y) => {
    if (!uvnitr(m, x, y)) return false;
    const i = idx(m, x, y);
    return m.typ[i] !== T.VODA && !m.reka[i] && !m.cesta[i] && !m.dum[i] && !m.prum[i] && !m.depo[i] && !m.kolej[i];
  };

  function postavMesto(m, nah, cx, cy, cil, jmeno) {
    const mesto = { id: m.mesta.length, jmeno, x: cx, y: cy, obyv: 0, domu: 0 };
    m.mesta.push(mesto);
    const silnice = [];
    const polozSilnici = (x, y) => { const i = idx(m, x, y); m.cesta[i] = 1; m.les[i] = 0; silnice.push([x, y]); };
    polozSilnici(cx, cy);
    const delka = Math.round(3 + Math.sqrt(cil) / 7);
    for (const [dx, dy] of SOUSEDE4) {
      const L = nah.cele(Math.max(2, delka - 2), delka + 1);
      for (let k = 1; k <= L; k++) {
        const x = cx + dx * k, y = cy + dy * k;
        if (!volnaZeme(m, x, y) || x < 1 || y < 1 || x >= m.W - 1 || y >= m.H - 1) break;
        polozSilnici(x, y);
        // příčné ulice
        if (k % 3 === 0 && cil > 250) for (const s of [-1, 1]) {
          const L2 = nah.cele(1, Math.min(4, 1 + (cil / 400 | 0)));
          for (let j = 1; j <= L2; j++) {
            const qx = x + dy * s * j, qy = y + dx * s * j;
            if (!volnaZeme(m, qx, qy) || qx < 1 || qy < 1 || qx >= m.W - 1 || qy >= m.H - 1) break;
            polozSilnici(qx, qy);
          }
        }
      }
    }
    // domy podél silnic, od středu ven
    const kandidati = [], videno = new Set();
    for (const [x, y] of silnice) for (const [dx, dy] of SOUSEDE4) {
      const nx = x + dx, ny = y + dy, i = uvnitr(m, nx, ny) ? idx(m, nx, ny) : -1;
      if (i < 0 || videno.has(i) || !volnaZeme(m, nx, ny) || m.typ[i] === T.SKALA) continue;
      videno.add(i);
      kandidati.push([nx, ny, Math.hypot(nx - cx, ny - cy) + nah.f() * 1.5]);
    }
    kandidati.sort((a, b) => a[2] - b[2]);
    let kostel = cil >= 500;
    for (const [x, y, d] of kandidati) {
      if (mesto.obyv >= cil) break;
      let typ;
      if (kostel && d < 4) { typ = D.DOMY[3]; kostel = false; }
      else {
        const centrum = 1 - Math.min(1, d / (2 + Math.sqrt(cil) / 4));
        typ = cil > 900 && centrum > 0.45 && nah.sance(0.7) ? D.DOMY[2] : cil > 250 && centrum > 0.15 && nah.sance(0.7) ? D.DOMY[1] : D.DOMY[0];
      }
      const obyv = typ.obyv[1] ? nah.cele(typ.obyv[0], typ.obyv[1]) : 0;
      const i = idx(m, x, y);
      m.domy.push({ mesto: mesto.id, typ: typ.id, obyv, barva: nah.vyber(typ.barvy), strecha: nah.vyber(typ.strecha), x, y });
      m.dum[i] = m.domy.length; m.les[i] = 0;
      if (m.typ[i] === T.SNIH && maxR(m, x, y) < m.vrch) m.typ[i] = T.TRAVA;
      mesto.obyv += obyv; mesto.domu++;
    }
    return mesto;
  }

  function mesta(m, nah, opt) {
    const { W, H } = m;
    const tab = D.POCET_MEST[W] || D.POCET_MEST[128];
    const pocet = tab[{ malo: 0, stredne: 1, hodne: 2 }[opt.mesta] ?? 1];
    const minVzd = Math.max(7, Math.sqrt(W * H / pocet) * 0.55);
    const pouzita = new Set();
    // kandidáti: souš bez řeky, s rovinatým okolím
    const kand = [];
    for (let y = 5; y < H - 5; y += 1) for (let x = 5; x < W - 5; x += 1) {
      if (!volnaZeme(m, x, y) || m.typ[idx(m, x, y)] === T.SKALA || m.typ[idx(m, x, y)] === T.SNIH) continue;
      let dobre = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const i = idx(m, x + dx, y + dy);
        if (m.typ[i] !== T.VODA && !m.reka[i] && maxR(m, x + dx, y + dy) - minR(m, x + dx, y + dy) === 0) dobre++;
      }
      kand.push([x, y, dobre + nah.f() * 20, dobre]);
    }
    kand.sort((a, b) => b[2] - a[2]);
    const max = W >= 256 ? 9000 : W >= 128 ? 4000 : 1800;
    // 1. kolo: rovinatá místa s plným odstupem; další kola povolí hrbolatější a bližší
    for (const [minRovne, odstup] of [[14, 1], [6, 0.8], [0, 0.6]]) for (const [x, y, , dobre] of kand) {
      if (m.mesta.length >= pocet) break;
      if (dobre < minRovne || !volnaZeme(m, x, y)) continue;
      if (m.mesta.some(c => Math.hypot(c.x - x, c.y - y) < minVzd * odstup)) continue;
      // první město velké, ostatní podle náhody se sklonem k menším
      const cil = m.mesta.length === 0 ? nah.cele(max * 0.4, max) : Math.round(120 + nah.f() ** 2.2 * max * 0.6);
      postavMesto(m, nah, x, y, cil, jmenoMesta(nah, pouzita));
    }
  }

  function vhodneMisto(m, p, x, y, mapaVrch, duvod) {
    const ne = t => { if (duvod) duvod.text = t; return false; };
    const [w, h] = p.rozmer;
    if (x < 2 || y < 2 || x + w > m.W - 2 || y + h > m.H - 2) return ne('Moc blízko okraje mapy');
    let soucet = 0, mn = 99, mx = 0;
    for (let dy = -1; dy <= h; dy++) for (let dx = -1; dx <= w; dx++) {
      const qx = x + dx, qy = y + dy;
      if (!volnaZeme(m, qx, qy)) return ne(`Pozemek i s okrajem 1 pole musí být volný (překáží ${qx}, ${qy})`);
      const i = idx(m, qx, qy);
      if (dx >= 0 && dy >= 0 && dx < w && dy < h) {
        if (m.typ[i] === T.SNIH) return ne('Na sněhu nejde stavět');
        const r = rohy(m, qx, qy);
        for (const v of r) { soucet += v; if (v < mn) mn = v; if (v > mx) mx = v; }
      }
    }
    if (mx - mn > 2) return ne('Terén je moc kopcovitý');
    const stred = [x + w / 2, y + h / 2];
    // odstup od jiného průmyslu (zavřený se nepočítá)
    for (const q of m.prumysl) if (!q.zrusen && x < q.x + q.w + 3 && q.x < x + w + 3 && y < q.y + q.h + 3 && q.y < y + h + 3) return ne('Moc blízko jiného podniku (aspoň 3 pole odstup)');
    const vzdMesta = Math.min(...m.mesta.map(c => Math.hypot(c.x - stred[0], c.y - stred[1])), 999);
    if (p.misto === 'mesto') { if (vzdMesta < 5 || vzdMesta > 16) return ne('Patří 5–16 polí od středu města'); }
    else if (vzdMesta < 7) return ne('Moc blízko města (aspoň 7 polí od středu)');
    if (p.misto === 'kopce' && soucet / (w * h * 4) < Math.max(2, mapaVrch * 0.4)) return ne('Patří do kopců (výš)');
    if (p.misto === 'rovina' && (mx - mn > 1 || soucet / (w * h * 4) > Math.max(2, mapaVrch * 0.5))) return ne('Patří na rovinu v nížině');
    if (p.misto === 'les') {
      let l = 0;
      for (let dy = -3; dy <= h + 2; dy++) for (let dx = -3; dx <= w + 2; dx++)
        if (uvnitr(m, x + dx, y + dy) && m.les[idx(m, x + dx, y + dy)]) l++;
      if (l < 14) return ne('Patří do lesa');
    }
    if (p.misto === 'voda') {   // vodárna u moře, jezera nebo řeky
      let voda = false;
      for (let dy = -3; dy <= h + 2 && !voda; dy++) for (let dx = -3; dx <= w + 2; dx++)
        if (uvnitr(m, x + dx, y + dy) && (jeVoda(m, x + dx, y + dy) || m.reka[idx(m, x + dx, y + dy)])) { voda = true; break; }
      if (!voda) return ne('Patří k vodě (moře, jezero nebo řeka do 3 polí)');
    }
    if (p.misto === 'pobrezi') {
      let voda = false;
      for (let dy = -5; dy <= h + 4 && !voda; dy++) for (let dx = -5; dx <= w + 4; dx++)
        if (uvnitr(m, x + dx, y + dy) && jeVoda(m, x + dx, y + dy)) { voda = true; break; }
      if (!voda) return ne('Patří k moři (do 5 polí)');
    }
    return true;
  }

  function postavPrumysl(m, nah, p, x, y) {
    const [w, h] = p.rozmer;
    let soucet = 0;
    for (let dy = 0; dy <= h; dy++) for (let dx = 0; dx <= w; dx++) soucet += m.v[(y + dy) * m.R + x + dx];
    const vys = Math.max(1, Math.round(soucet / ((w + 1) * (h + 1))));
    const pevne = new Map();
    for (let dy = 0; dy <= h; dy++) for (let dx = 0; dx <= w; dx++) pevne.set((y + dy) * m.R + x + dx, vys);
    const chranene = new Set();
    for (const o of m.prumysl) for (let dy = 0; dy <= o.h; dy++) for (let dx = 0; dx <= o.w; dx++) chranene.add((o.y + dy) * m.R + o.x + dx);
    if (!terraformuj(m, pevne, chranene)) return null;
    const nejblizsi = m.mesta.reduce((a, c) => !a || Math.hypot(c.x - x, c.y - y) < Math.hypot(a.x - x, a.y - y) ? c : a, null);
    const zaklad = `${p.nazev} ${nejblizsi ? nejblizsi.jmeno : ''}`.trim();
    let jmeno = zaklad, n = 2;
    while (m.prumysl.some(q => !q.zrusen && q.jmeno === jmeno)) jmeno = `${zaklad} ${['', '', 'II', 'III', 'IV', 'V', 'VI'][n++] || n}`;
    const q = { id: m.prumysl.length, typ: p.id, x, y, w, h, jmeno, mesto: nejblizsi ? nejblizsi.id : -1, vyroba: { ...p.vyroba }, zaklad: { ...p.vyroba } };
    m.prumysl.push(q);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const i = idx(m, x + dx, y + dy);
      m.prum[i] = m.prumysl.length; m.les[i] = 0; m.typ[i] = T.TRAVA;
    }
    if (p.pole) for (let dy = -2; dy < h + 2; dy++) for (let dx = -2; dx < w + 2; dx++) {
      const qx = x + dx, qy = y + dy;
      if (volnaZeme(m, qx, qy) && m.typ[idx(m, qx, qy)] === T.TRAVA && nah.sance(0.8)) { m.typ[idx(m, qx, qy)] = T.POLE; m.les[idx(m, qx, qy)] = 0; }
    }
    return q;
  }

  function prumysl(m, nah, opt) {
    const tab = D.POCET_PRUMYSLU[m.W] || D.POCET_PRUMYSLU[128];
    const pocet = tab[{ malo: 0, stredne: 1, hodne: 2 }[opt.prumysl] ?? 1];
    // nejdřív páry řetězců (aby měl každý výrobce odběratele), pak zbytek podle vah
    const fronta = [];
    for (const [a, b] of D.RETEZCE) fronta.push(b, a);
    if (m.W >= 128) fronta.push('tovarna', 'vodarna');
    const vahy = { dul: 3, elektrarna: 1.5, tezba: 2.5, pila: 1, rudnydul: 1.5, ocelarna: 0.8, tovarna: 1, farma: 3, potravinarna: 1.2, vrt: 1.5, rafinerie: 0.6, vodarna: 0.7 };
    while (fronta.length < pocet) fronta.push(nah.vazene(Object.entries(vahy)));
    const odberatel = Object.fromEntries(D.RETEZCE);
    for (const id of fronta.slice(0, Math.max(pocet, D.RETEZCE.length * 2))) {
      const p = D.PRUMYSL_PODLE_ID[id];
      // výrobce bez odběratele nedává smysl (třeba vrt na mapě bez pobřeží pro rafinerii)
      if (odberatel[id] && !m.prumysl.some(q => q.typ === odberatel[id])) continue;
      for (let pokus = 0; pokus < 500; pokus++) {
        const x = nah.cele(2, m.W - 3 - p.rozmer[0]), y = nah.cele(2, m.H - 3 - p.rozmer[1]);
        if (vhodneMisto(m, p, x, y, m.vrch) && postavPrumysl(m, nah, p, x, y)) break;
      }
    }
  }

  // ostrovy souše (4-sousedství, řeka je souš – přejde se mostem)
  function pevniny(m) {
    const kus = new Int32Array(m.W * m.H).fill(-1);
    let n = 0;
    for (let s = 0; s < kus.length; s++) {
      if (kus[s] >= 0 || m.typ[s] === T.VODA) continue;
      const st = [s]; kus[s] = n;
      while (st.length) {
        const i = st.pop(), x = i % m.W, y = (i / m.W) | 0;
        for (const [dx, dy] of SOUSEDE4) {
          const nx = x + dx, ny = y + dy;
          if (!uvnitr(m, nx, ny)) continue;
          const j = idx(m, nx, ny);
          if (kus[j] < 0 && m.typ[j] !== T.VODA) { kus[j] = n; st.push(j); }
        }
      }
      n++;
    }
    return { kus, pocet: n };
  }

  // Výhrady k hratelnosti (prázdné pole = mapa je v pořádku)
  function hratelnost(m, opt) {
    const vady = [];
    const tab = D.POCET_MEST[m.W] || D.POCET_MEST[128];
    const chtene = tab[{ malo: 0, stredne: 1, hodne: 2 }[opt.mesta] ?? 1];
    if (m.mesta.length < Math.ceil(chtene * 0.75)) vady.push(`málo měst ${m.mesta.length}/${chtene}`);
    for (const [a, b] of D.RETEZCE) {
      if (m.prumysl.some(q => q.typ === a) && !m.prumysl.some(q => q.typ === b)) vady.push(`řetězec ${a}→${b} bez odběratele`);
    }
    if (!m.prumysl.some(q => q.typ === 'dul') || !m.prumysl.some(q => q.typ === 'elektrarna')) vady.push('chybí uhlí → elektrárna');
    const { kus } = pevniny(m);
    const podle = new Map();
    for (const c of m.mesta) { const k = kus[idx(m, c.x, c.y)]; podle.set(k, (podle.get(k) || 0) + 1); }
    const nejvic = Math.max(0, ...podle.values());
    if (nejvic < m.mesta.length * 0.5) vady.push('města rozházená po ostrovech');
    return vady;
  }

  // Kontrola invariantů (pro testy) – prázdné pole = v pořádku
  function zavady(m) {
    const z = [], R = m.R;
    for (let y = 0; y <= m.H; y++) for (let x = 0; x <= m.W; x++) {
      const h = m.v[y * R + x];
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx > m.W || ny > m.H) continue;
        if (Math.abs(m.v[ny * R + nx] - h) > 1) { z.push(`skok výšky u rohu ${x},${y}`); if (z.length > 5) return z; }
      }
    }
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const i = idx(m, x, y), voda = maxR(m, x, y) === 0;
      if (voda !== (m.typ[i] === T.VODA)) z.push(`voda nesedí na ${x},${y}`);
      if (m.typ[i] === T.VODA && (m.dum[i] || m.prum[i] || m.reka[i] || m.les[i] || ((m.cesta[i] || m.kolej[i]) && !m.most[i]))) z.push(`objekt ve vodě ${x},${y}`);
      if (m.kolej[i] && (m.dum[i] || m.prum[i])) z.push(`kolej v budově ${x},${y}`);
      if ((m.navest[i] | m.navestJ[i]) & ~m.kolej[i]) z.push(`návěstidlo mimo kolej ${x},${y}`);
      if (m.navestJ[i] & ~m.navest[i]) z.push(`jednosměrnost bez návěstidla ${x},${y}`);
      if ((m.elek[i] || m.vrt[i]) && !m.kolej[i]) z.push(`trolej nebo rychlostní kolej bez koleje ${x},${y}`);
      if (m.zdym[i] && !m.reka[i]) z.push(`zdymadlo mimo řeku ${x},${y}`);
      if (m.tram[i] && !m.cesta[i] && !m.depo[i]) z.push(`tramvajová kolej bez silnice ${x},${y}`);
      if (m.tunel[i] && ((!m.kolej[i] && !m.cesta[i]) || minR(m, x, y) < m.tunelV[i])) z.push(`tunel bez koleje/silnice nebo nad terénem ${x},${y}`);
      for (let d = 0; d < 4; d++) if (m.kolej[i] & (1 << d)) {
        // bit směrem ven z mapy je chyba; k sousedovi bez opačného bitu je slepá kolej (smí být)
        const nx = x + SOUSEDE4[d][0], ny = y + SOUSEDE4[d][1];
        if (!uvnitr(m, nx, ny)) z.push(`kolej mimo mapu ${x},${y}`);
      }
      if ((m.cesta[i] ? 1 : 0) + (m.dum[i] ? 1 : 0) + (m.prum[i] ? 1 : 0) > 1) z.push(`dva objekty na ${x},${y}`);
      if (m.reka[i] && (m.dum[i] || m.prum[i] || ((m.cesta[i] || m.kolej[i]) && !m.most[i]))) z.push(`stavba na řece ${x},${y}`);
      if (m.stan[i] && ((!m.cesta[i] && !m.kolej[i] && m.osa[i] < 3) || !m.osa[i])) z.push(`zastávka mimo silnici i kolej ${x},${y}`);
      if (m.depo[i] && (m.cesta[i] || m.dum[i] || m.prum[i] || !m.smer[i])) z.push(`garáž na obsazeném poli ${x},${y}`);
    }
    for (const q of m.prumysl) {
      if (q.zrusen) { for (let dy = 0; dy < q.h; dy++) for (let dx = 0; dx < q.w; dx++) if (m.prum[idx(m, q.x + dx, q.y + dy)] === q.id + 1) z.push(`zavřený podnik ${q.jmeno} drží pole`); continue; }
      const h0 = m.v[q.y * R + q.x];
      for (let dy = 0; dy <= q.h; dy++) for (let dx = 0; dx <= q.w; dx++) if (m.v[(q.y + dy) * R + q.x + dx] !== h0) z.push(`průmysl ${q.jmeno} není rovný`);
      for (let dy = 0; dy < q.h; dy++) for (let dx = 0; dx < q.w; dx++) if (m.prum[idx(m, q.x + dx, q.y + dy)] !== q.id + 1) z.push(`průmysl ${q.jmeno} nemá pole`);
    }
    const jmena = new Set(m.mesta.map(c => c.jmeno));
    if (jmena.size !== m.mesta.length) z.push('dvě města stejného jména');
    for (const c of m.mesta) {
      const s = m.domy.filter(d => d.mesto === c.id).reduce((a, d) => a + d.obyv, 0);
      if (s !== c.obyv) z.push(`součet obyvatel ${c.jmeno}`);
    }
    return z;
  }

  const VYCHOZI = { velikost: 128, krajina: 'kopce', voda: 'stredne', mesta: 'stredne', prumysl: 'stredne' };

  // jeden pokus o mapu (bez kontroly hratelnosti)
  function pokus(seed, opt) {
    opt = { ...VYCHOZI, ...opt };
    const W = D.VELIKOSTI.includes(+opt.velikost) ? +opt.velikost : 128;
    const m = novaMapa(W, W);
    const nah = MAG.Nahoda(MAG.hash(seed, 'mapa'));
    teren(m, nah, seed, opt);
    povrch(m, seed);
    reky(m, nah);
    mesta(m, nah, opt);
    prumysl(m, nah, opt);
    m.seed = seed; m.opt = opt;
    return m;
  }

  // mapa se zárukou hratelnosti: když pokus neprojde, zkusí se další seed odvozený z původního
  function generuj(seed, opt) {
    let m = null;
    for (let i = 0; i < 12; i++) {
      m = pokus(i ? MAG.hash(seed, 'znovu', i) % 1073741824 : seed, opt);
      m.vady = hratelnost(m, m.opt);
      if (!m.vady.length) break;
    }
    m.seedZadany = seed;
    return m;
  }

  MAG.mapa = {
    novaMapa, generuj, pokus, hratelnost, zavady, terraformuj, pevniny,
    idx, uvnitr, rohy, minR, maxR, jeRovne, jeVoda, SOUSEDE4, VYCHOZI, volnaZeme, postavMesto, vhodneMisto, postavPrumysl,
  };
})(globalThis.MAG = globalThis.MAG || {});
