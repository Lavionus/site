/* ============================================================
   Přistání na Měsíci – jádro (bez DOM, testovatelné v node).
   Deterministická fyzika s pevným krokem DT: stejné úrovně, semínko
   a vstupy dají vždy stejný let → ghost = jen zaznamenané vstupy.
   Souřadnice v metrech, y nahoru, úhel 0 = svisle, kladný = náklon
   doprava (tah míří do +x).
   ============================================================ */
(function (koren, tovarna) {
  if (typeof module === 'object' && module.exports) module.exports = tovarna();
  else koren.PRISTANI = tovarna();
})(this, function () {
  'use strict';

  const DT = 1 / 60, G0 = 9.80665, KROK_TERENU = 8;
  const RAD = Math.PI / 180;

  /* Modul „Vážka": suchá hmotnost, body trupu a noh (lokální souřadnice, střed trupu = 0,0). */
  const MODUL = {
    sucha: 1500,
    nohy: [[-3.2, -2.6], [3.2, -2.6]],
    trup: [[-2.2, 2.6], [2.2, 2.6], [-2.4, -1.0], [2.4, -1.0], [0, 3.2]],
    rcsAlfa: 1.6,          // rad/s² při plném vychýlení
    rcsSpotreba: 0.6,      // kg/s při plném vychýlení
  };

  /* Světy: gravitace (m/s²), odpor atmosféry c (1/m, a = c·|v|·v), vítr (m/s). */
  const SVETY = {
    mesic:    { nazev: 'Měsíc',    g: 1.62,  odpor: 0,     vitr: [0, 0] },
    asteroid: { nazev: 'Asteroid', g: 0.35,  odpor: 0,     vitr: [0, 0] },
    mars:     { nazev: 'Mars',     g: 3.71,  odpor: 0.004, vitr: [4, 3] },
    europa:   { nazev: 'Europa',   g: 1.315, odpor: 0,     vitr: [0, 0] },
    titan:    { nazev: 'Titan',    g: 1.352, odpor: 0.02,  vitr: [3, 2] },
    io:       { nazev: 'Io',       g: 1.796, odpor: 0,     vitr: [0, 0] },
    merkur:   { nazev: 'Merkur',   g: 3.70,  odpor: 0,     vitr: [0, 0] },
  };

  const LIMITY = { vy: 2.5, vx: 1.5, uhel: 8 };

  /* Kampaň. plochy = násobiče, styl terénu: hladky | hory | hrebeny | krater. */
  const UROVNE = [
    { id: 'mesic-1', svet: 'mesic', nazev: 'Moře klidu', popis: 'Výcvikový let nad rovnou čedičovou plání. Paliva je dost – nauč se držet rychlost pod kontrolou.',
      seed: 101, styl: 'hladky', drsnost: 0.35, vyska: 160, sirka: 1600, plochy: [1, 2, 3], palivo: 370, tah: 9000, isp: 300, start: { x: 180, nad: 260, vx: 12, vy: 0 } },
    { id: 'mesic-2', svet: 'mesic', nazev: 'Jižní vysočina', popis: 'Zubaté hřebeny a úzké plošiny mezi nimi. Přelétej s rezervou výšky.',
      seed: 202, styl: 'hory', drsnost: 0.8, vyska: 320, sirka: 1600, plochy: [2, 3, 5], palivo: 240, tah: 9000, isp: 300, start: { x: 150, nad: 220, vx: 22, vy: 0 } },
    { id: 'mesic-3', svet: 'mesic', nazev: 'Kráter Hvězdná jizva', popis: 'Plochy leží na dně a valech kráteru. Pozor na strmé stěny.',
      seed: 303, styl: 'krater', drsnost: 0.6, vyska: 300, sirka: 1600, plochy: [3, 5], palivo: 240, tah: 9000, isp: 300, start: { x: 1400, nad: 240, vx: -18, vy: 0 } },
    { id: 'asteroid', svet: 'asteroid', nazev: 'Asteroid 4417 Kamyk', popis: 'Skoro žádná tíže, slabý motor. Každý zbytečný impulz tě odnese daleko.',
      seed: 404, styl: 'hrebeny', drsnost: 0.7, vyska: 200, sirka: 1000, plochy: [2, 4, 6], palivo: 160, tah: 2400, isp: 280, start: { x: 120, nad: 140, vx: 5, vy: 0 } },
    { id: 'mars-1', svet: 'mars', nazev: 'Rudá pláň', popis: 'Mars má řídkou atmosféru: brzdí pád i unáší vítr. Silnější motor, větší tíže.',
      seed: 505, styl: 'hladky', drsnost: 0.45, vyska: 180, sirka: 1600, plochy: [1, 2, 3], palivo: 580, tah: 17000, isp: 310, start: { x: 200, nad: 300, vx: 20, vy: -5 } },
    { id: 'mars-2', svet: 'mars', nazev: 'Kaňon větrů', popis: 'Nárazy větru v kaňonu. Koriguj náklonem dřív, než tě vítr odnese z plochy.',
      seed: 606, styl: 'hory', drsnost: 0.85, vyska: 340, sirka: 1600, plochy: [3, 5], palivo: 680, tah: 17000, isp: 310, vitr: [7, 5], start: { x: 1450, nad: 260, vx: -15, vy: -4 } },
    { id: 'europa', svet: 'europa', nazev: 'Ledové hřbety Europy', popis: 'Ostré ledové hřebeny pod Jupiterem. Plochy jsou malé, mezi nimi praskliny.',
      seed: 707, styl: 'hrebeny', drsnost: 0.9, vyska: 280, sirka: 1600, plochy: [2, 3, 5], palivo: 260, tah: 8000, isp: 300, start: { x: 160, nad: 230, vx: 18, vy: 0 } },
    { id: 'titan', svet: 'titan', nazev: 'Mlhy Titanu', popis: 'Hustá atmosféra – padáš pomalu jako s padákem, ale vítr má velkou sílu.',
      seed: 808, styl: 'hladky', drsnost: 0.55, vyska: 220, sirka: 1600, plochy: [2, 4], palivo: 140, tah: 8000, isp: 300, start: { x: 220, nad: 300, vx: 10, vy: -3 } },
    { id: 'io', svet: 'io', nazev: 'Sirná pole Io', popis: 'Sopečný terén a málo paliva. Najdi nejkratší cestu dolů.',
      seed: 909, styl: 'hory', drsnost: 0.75, vyska: 300, sirka: 1600, plochy: [3, 5], palivo: 180, tah: 10000, isp: 300, start: { x: 800, nad: 260, vx: -10, vy: 0 } },
    { id: 'merkur', svet: 'merkur', nazev: 'Úsvit na Merkuru', popis: 'Tíže jako na Marsu, ale bez atmosféry, která by brzdila. Finále kampaně.',
      seed: 1010, styl: 'krater', drsnost: 0.8, vyska: 320, sirka: 1600, plochy: [4, 6], palivo: 430, tah: 17000, isp: 310, start: { x: 150, nad: 260, vx: 25, vy: -6 } },
  ];

  /* ---------- pomocné ---------- */
  function rng(seed) {                       // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const omez = (v, a, b) => v < a ? a : v > b ? b : v;

  /* Úplný popis úrovně: kampaňová nebo volný let (svět + semínko). */
  function uroven(def) {
    const s = SVETY[def.svet];
    return Object.assign({ odpor: s.odpor, g: s.g, vitr: s.vitr, limity: LIMITY }, def);
  }
  function volnyLet(svet, seed) {
    const r = rng(seed * 7 + 3);
    const styly = ['hladky', 'hory', 'hrebeny', 'krater'];
    const silny = SVETY[svet].g > 2.5;
    const n = 2 + Math.floor(r() * 2);
    const nas = [1, 2, 3, 4, 5, 6].sort(() => r() - 0.5).slice(0, n).sort((a, b) => a - b);
    const x = 150 + r() * 1300;
    return uroven({ id: 'volny-' + svet, svet, nazev: 'Volný let – ' + SVETY[svet].nazev, popis: 'Náhodný terén. Semínko ' + seed + '.',
      seed, styl: styly[Math.floor(r() * 4)], drsnost: 0.4 + r() * 0.5, vyska: 160 + r() * 180, sirka: 1600, plochy: nas,
      palivo: silny ? 650 : svet === 'asteroid' ? 200 : 300, tah: silny ? 17000 : svet === 'asteroid' ? 2400 : 9000, isp: 300,
      start: { x, nad: 240, vx: (x < 800 ? 1 : -1) * (8 + r() * 14), vy: 0 } });
  }

  /* ---------- terén ---------- */
  function sumHodnot(r, n) {                 // hodnotový šum: náhodné body + kosinová interpolace
    const body = Array.from({ length: n + 2 }, () => r());
    return t => {
      const i = Math.floor(t), f = t - i, w = (1 - Math.cos(f * Math.PI)) / 2;
      return body[i] * (1 - w) + body[i + 1] * w;
    };
  }

  function teren(U) {
    const r = rng(U.seed);
    const n = Math.round(U.sirka / KROK_TERENU) + 1;
    const oktavy = [[10, 1], [24, 0.45 * U.drsnost], [60, 0.22 * U.drsnost], [140, 0.1 * U.drsnost]].map(([f, a]) => [f, a, sumHodnot(r, f)]);
    const h = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      let v = 0, suma = 0;
      for (const [f, a, s] of oktavy) {
        let x = s(t * f);
        if (U.styl === 'hrebeny') x = 1 - Math.abs(2 * x - 1);          // ostré hřbety
        if (U.styl === 'hory' && f > 10) x = Math.pow(x, 1.6);
        v += x * a; suma += a;
      }
      v /= suma;
      if (U.styl === 'krater') {                                         // mísa s valem uprostřed
        const d = Math.abs(t - 0.5) / 0.32;
        v = 0.35 * v + (d < 1 ? 0.15 + 0.35 * d * d : 0.5 + 0.5 * Math.exp(-(d - 1) * 3)) ;
      }
      h[i] = 20 + v * U.vyska;
    }
    /* přistávací plochy: šířka podle násobiče, nepřekrývají se, ne u okrajů */
    const plochy = [];
    const sirkaPlochy = m => Math.max(2, Math.round(6 / Math.pow(m, 0.62)));   // v úsecích terénu
    for (const m of U.plochy.slice().sort((a, b) => b - a)) {
      const k = sirkaPlochy(m);
      for (let pokus = 0; pokus < 200; pokus++) {
        const i1 = 6 + Math.floor(r() * (n - k - 13));
        const i2 = i1 + k;
        if (plochy.some(p => i1 < p.i2 + 7 && i2 > p.i1 - 7)) continue;
        let y = 0;
        for (let i = i1; i <= i2; i++) y += h[i];
        y /= (k + 1);
        for (let i = i1; i <= i2; i++) h[i] = y;
        plochy.push({ i1, i2, x1: i1 * KROK_TERENU, x2: i2 * KROK_TERENU, y, nasobic: m });
        break;
      }
    }
    plochy.sort((a, b) => a.x1 - b.x1);
    let min = Infinity, max = -Infinity;
    for (const v of h) { if (v < min) min = v; if (v > max) max = v; }
    return { h, plochy, krok: KROK_TERENU, sirka: (n - 1) * KROK_TERENU, min, max };
  }

  function vyskaTerenu(T, x) {
    const t = omez(x / T.krok, 0, T.h.length - 1.000001);
    const i = Math.floor(t), f = t - i;
    return T.h[i] * (1 - f) + T.h[i + 1] * f;
  }
  function maxTerenu(T, xa, xb) {
    const a = Math.max(0, Math.floor(Math.min(xa, xb) / T.krok)), b = Math.min(T.h.length - 1, Math.ceil(Math.max(xa, xb) / T.krok));
    let m = -Infinity;
    for (let i = a; i <= b; i++) if (T.h[i] > m) m = T.h[i];
    return m;
  }
  const plochaPod = (T, xa, xb) => T.plochy.find(p => xa >= p.x1 && xb <= p.x2) || null;

  /* ---------- stav a krok ---------- */
  function start(U, T) {
    const x = U.start.x;
    const y = maxTerenu(T, x - 60, x + 60) + U.start.nad;
    return { x, y, vx: U.start.vx, vy: U.start.vy, uhel: 0, omega: 0, palivo: U.palivo, cas: 0, kroky: 0, tah: 0, rcs: 0, konec: null };
  }

  /* Vítr: plynulé nárazy z deterministických sinusovek, u země slabší. */
  function vitr(U, t, agl) {
    const [prumer, naraz] = U.vitr || [0, 0];
    if (!prumer && !naraz) return 0;
    const f1 = (U.seed % 97) * 0.13, f2 = (U.seed % 89) * 0.29;
    const w = prumer + naraz * (0.6 * Math.sin(t * 0.31 + f1) + 0.4 * Math.sin(t * 0.83 + f2));
    return w * (0.45 + 0.55 * Math.min(1, Math.max(0, agl) / 120));
  }

  function svetovy(s, [lx, ly]) {
    const c = Math.cos(s.uhel), si = Math.sin(s.uhel);
    return [s.x + lx * c + ly * si, s.y - lx * si + ly * c];
  }

  /* Vstupy se kvantují (tah po 0,1, RCS po 0,1), aby šly uložit jako ghost. */
  function kvantuj(v) {
    return { tah: Math.round(omez(+v.tah || 0, 0, 1) * 10) / 10, rot: Math.round(omez(+v.rot || 0, -1, 1) * 10) / 10, sas: !!v.sas };
  }

  function krok(U, T, s, v) {
    if (s.konec) return s;
    const m = MODUL.sucha + s.palivo;
    const tah = s.palivo > 0 ? v.tah : 0;
    const F = tah * U.tah;
    const agl = s.y - vyskaTerenu(T, s.x);
    let ax = F / m * Math.sin(s.uhel), ay = F / m * Math.cos(s.uhel) - U.g;
    if (U.odpor) {
      const c = U.odpor * Math.exp(-Math.max(0, s.y) / 3000);
      const rx = s.vx - vitr(U, s.cas, agl), ry = s.vy, rv = Math.hypot(rx, ry);
      ax -= c * rv * rx; ay -= c * rv * ry;
    }
    /* RCS: ruční řízení úhlového zrychlení, SAS tlumí rotaci, když hráč nesahá. */
    let alfa = 0;
    if (s.palivo > 0) {
      if (Math.abs(v.rot) > 0.05) alfa = v.rot * MODUL.rcsAlfa;
      else if (v.sas) alfa = omez(-s.omega * 4, -MODUL.rcsAlfa, MODUL.rcsAlfa);
    }
    s.vx += ax * DT; s.vy += ay * DT;
    s.x += s.vx * DT; s.y += s.vy * DT;
    s.omega += alfa * DT; s.uhel += s.omega * DT;
    if (s.uhel > Math.PI) s.uhel -= 2 * Math.PI; else if (s.uhel < -Math.PI) s.uhel += 2 * Math.PI;
    s.palivo = Math.max(0, s.palivo - (F / (U.isp * G0) + Math.abs(alfa) / MODUL.rcsAlfa * MODUL.rcsSpotreba) * DT);
    s.tah = tah; s.rcs = alfa / MODUL.rcsAlfa;
    s.cas += DT; s.kroky++;
    kontakt(U, T, s);
    if (!s.konec && (s.x < 0 || s.x > T.sirka || s.y > T.max + 1500)) s.konec = { druh: 'ztracen', duvod: 'Modul opustil oblast přistání.', body: 0, poskozeni: 0 };
    return s;
  }

  function kontakt(U, T, s) {
    const nohy = MODUL.nohy.map(p => svetovy(s, p));
    const trup = MODUL.trup.map(p => svetovy(s, p));
    const podTerenem = ([x, y]) => y <= vyskaTerenu(T, x);
    const nohaDole = nohy.some(podTerenem), trupDole = trup.some(podTerenem);
    if (!nohaDole && !trupDole) return;
    const L = U.limity;
    const vy = Math.max(0, -s.vy), vx = Math.abs(s.vx), uh = Math.abs(s.uhel) / RAD;
    const pomer = Math.max(vy / L.vy, vx / L.vx, uh / L.uhel);
    const zakladni = { vy, vx, uhel: uh, pomer };
    const havarie = duvod => { s.konec = Object.assign({ druh: 'havarie', duvod, body: 0, poskozeni: 100 }, zakladni); s.vx = s.vy = s.omega = 0; };
    if (trupDole) return havarie('Trup narazil do terénu.');
    const xa = Math.min(nohy[0][0], nohy[1][0]), xb = Math.max(nohy[0][0], nohy[1][0]);
    const plocha = plochaPod(T, xa, xb);
    if (pomer > 2) return havarie(vy / L.vy >= Math.max(vx / L.vx, uh / L.uhel) ? 'Příliš rychlý sestup.' : vx / L.vx >= uh / L.uhel ? 'Příliš velká boční rychlost.' : 'Modul byl příliš nakloněný.');
    const sklon = Math.atan2(Math.abs(vyskaTerenu(T, xb) - vyskaTerenu(T, xa)), xb - xa) / RAD;
    if (!plocha && sklon > 14) return havarie('Svah je příliš strmý, modul se převrátil.');
    const poskozeni = pomer > 1 ? Math.round((pomer - 1) * 100) : 0;
    s.y += Math.max(vyskaTerenu(T, nohy[0][0]) - nohy[0][1], vyskaTerenu(T, nohy[1][0]) - nohy[1][1]);
    s.vx = s.vy = s.omega = 0;
    if (!plocha) { s.konec = Object.assign({ druh: 'mimo', duvod: 'Přistál jsi mimo plochu – let se nepočítá.', body: 0, poskozeni }, zakladni); return; }
    s.konec = Object.assign({ druh: 'pristani', plocha, nasobic: plocha.nasobic, poskozeni, body: body(U, s, plocha.nasobic, pomer, poskozeni),
      duvod: poskozeni ? 'Tvrdé dosednutí – podvozek a trup jsou poškozené.' : 'Modul stojí bezpečně na ploše.' }, zakladni);
  }

  function body(U, s, nasobic, pomer, poskozeni) {
    const jemnost = Math.max(0, 1 - pomer) * 400;
    const palivo = s.palivo / U.palivo * 600;
    return Math.round((600 + jemnost + palivo) * nasobic * (1 - poskozeni / 200));
  }

  /* Údaje pro přístroje a radar. */
  function prehled(U, T, s) {
    const nohy = MODUL.nohy.map(p => svetovy(s, p));
    const agl = Math.min(...nohy.map(([x, y]) => y - vyskaTerenu(T, x)));
    let cil = null;
    for (const p of T.plochy) {
      const dx = (p.x1 + p.x2) / 2 - s.x;
      if (!cil || Math.abs(dx) < Math.abs(cil.dx)) cil = { plocha: p, dx, dy: s.y + MODUL.nohy[0][1] - p.y };
    }
    const vitrNyni = U.odpor ? vitr(U, s.cas, agl) : 0;
    return { agl, vx: s.vx, vy: s.vy, uhel: s.uhel / RAD, palivo: s.palivo / U.palivo, cil, vitr: vitrNyni,
      cas: s.cas, zrychleniMax: U.tah / (MODUL.sucha + s.palivo) };
  }

  /* ---------- ghost: zaznam vstupů (RLE) ---------- */
  const kod = v => Math.round(v.tah * 10) * 42 + (Math.round(v.rot * 10) + 10) * 2 + (v.sas ? 1 : 0);
  const dekod = c => ({ tah: Math.floor(c / 42) / 10, rot: (Math.floor((c % 42) / 2) - 10) / 10, sas: c % 2 === 1 });
  function zakoduj(vstupy) {
    const out = [];
    let prev = -1, n = 0;
    for (const v of vstupy) {
      const c = kod(v);
      if (c === prev) n++;
      else { if (n) out.push(prev.toString(36) + '.' + n.toString(36)); prev = c; n = 1; }
    }
    if (n) out.push(prev.toString(36) + '.' + n.toString(36));
    return out.join(',');
  }
  function dekoduj(text) {
    const out = [];
    if (!text) return out;
    for (const cast of String(text).split(',')) {
      const [c, n] = cast.split('.').map(x => parseInt(x, 36));
      if (!Number.isFinite(c) || !Number.isFinite(n)) continue;
      const v = dekod(c);
      for (let i = 0; i < n; i++) out.push(v);
    }
    return out;
  }

  /* ---------- bot (autopilot) ----------
     Zpětnovazební řízení: vodorovně drží rychlost úměrnou vzdálenosti k ploše,
     svisle drží bezpečnou výšku nad terénem po cestě a nad plochou klesá
     rychlostí, kterou ještě stihne ubrzdit. */
  function bot(U, T, s, plocha) {
    const m = MODUL.sucha + s.palivo, amax = U.tah / m;
    const cx = (plocha.x1 + plocha.x2) / 2, dx = cx - s.x;
    const noha = -MODUL.nohy[0][1];
    const nadPlochou = s.y - noha - plocha.y;
    const rezerva = Math.max(0, (plocha.x2 - plocha.x1) / 2 - 3.6);
    // rychlost k ploše taková, aby šla ubrzdit nakloněným motorem (profil √(2·a·d))
    const ah = Math.max(0.2, amax * 0.45);
    const vxCil = Math.sign(dx) * Math.min(30, Math.sqrt(2 * ah * Math.abs(dx)) * 0.7, Math.abs(dx) * 0.5);
    const blizko = Math.abs(dx) < rezerva * 0.8 + 0.8 && Math.abs(s.vx) < 0.8;
    // výška, kterou je třeba držet nad terénem po cestě k okraji plochy (s předstihem podle rychlosti)
    const predstih = omez(s.vx * 5, -80, 80);
    const vPlose = s.x > plocha.x1 && s.x < plocha.x2;
    const okraj = dx > 0 ? plocha.x1 : plocha.x2;
    const prekazka = vPlose ? plocha.y : maxTerenu(T, Math.min(s.x, s.x + predstih, okraj) - 8, Math.max(s.x, s.x + predstih, okraj) + 8);
    const bezpecna = prekazka + noha + Math.min(25, 6 + Math.abs(dx) * 0.4);
    const brzdeni = Math.max(0.3, amax * 0.8 - U.g);
    let yCil, vdolu;
    if (blizko) { yCil = plocha.y + noha - 5; vdolu = Math.min(18, 0.9 + Math.sqrt(2 * brzdeni * Math.max(0, nadPlochou - 1)) * 0.55); }
    else { yCil = bezpecna; vdolu = Math.min(12, 1 + Math.sqrt(2 * brzdeni * Math.max(0, s.y - yCil)) * 0.5); }
    const vyCil = omez((yCil - s.y) * 0.5, -vdolu, 8);
    const odpor = U.odpor ? 1 : 0;
    const ax = (vxCil - s.vx) * (0.6 + odpor * 0.4);
    const ay = U.g + (vyCil - s.vy) * 1.6;
    const mezUhlu = nadPlochou < 6 && blizko ? 0.12 : nadPlochou < 14 ? 0.25 : 0.7;
    const uCil = omez(Math.atan2(ax, Math.max(ay, 0.25 * U.g + 0.05)), -mezUhlu, mezUhlu);
    const tah = omez((ax * Math.sin(s.uhel) + ay * Math.cos(s.uhel)) / amax, 0, 1);
    const omegaCil = omez((uCil - s.uhel) * 3, -1.2, 1.2);
    const rot = omez((omegaCil - s.omega) * 2.5, -1, 1);
    return { tah, rot, sas: true };
  }

  /* Odehraje úroveň botem; vrací konečný stav a zaznamenané vstupy. */
  function odehrajBotem(U, T, plocha, limitKroku) {
    const s = start(U, T), zaznam = [];
    const max = limitKroku || 60 * 600;
    while (!s.konec && s.kroky < max) {
      const v = kvantuj(bot(U, T, s, plocha));
      zaznam.push(v);
      krok(U, T, s, v);
    }
    return { stav: s, zaznam };
  }

  function prehraj(U, T, vstupy) {
    const s = start(U, T);
    for (const v of vstupy) { if (s.konec) break; krok(U, T, s, v); }
    return s;
  }

  return { DT, G0, MODUL, SVETY, UROVNE, LIMITY, rng, uroven, volnyLet, teren, vyskaTerenu, maxTerenu, start, krok, kvantuj,
    vitr, svetovy, prehled, zakoduj, dekoduj, bot, odehrajBotem, prehraj, body };
});
