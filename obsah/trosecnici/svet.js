/* ============================================================
   Trosečníci – svet.js: procedurální generátor ostrova.

   Čistá logika bez DOM. generuj(seed) vrátí svět 60×60:
     teren   – typ pole (TEREN.*)
     obj     – drobný objekt na poli (OBJ.* – palma, strom, keř, balvan)
     lokace  – zvláštní místa [{typ, x, y}], lokNa[i] = index do lokace nebo -1
     start   – pole na pláži u vraku, kde hra začíná
   Stejný seed dá vždy stejný ostrov.
   ============================================================ */
var TROS = globalThis.TROS = globalThis.TROS || {};

(function (T) {
  'use strict';
  const { Nahoda, fbm, smichej } = T.nahoda;

  const W = 60, H = 60;

  const TEREN = { HLUBINA: 0, MORE: 1, LAGUNA: 2, REKA: 3, PLAZ: 4, SAVANA: 5, DZUNGLE: 6, SKALY: 7, SOPKA: 8, LAVA: 9 };
  const OBJ = { NIC: 0, PALMA: 1, STROM: 2, KER: 3, BALVAN: 4 };

  const TEREN_INFO = [
    { nazev: 'Hluboké moře', chodit: false, popis: 'Tmavá voda. Bez lodi sem nesmíš.' },
    { nazev: 'Mělké moře',   chodit: false, popis: 'Průzračná voda u břehu – ryby, krabi, občas něco vyplaveného.' },
    { nazev: 'Laguna',       chodit: false, popis: 'Klidná slaná voda chráněná útesem. Ideální místo pro rybaření.' },
    { nazev: 'Řeka',         chodit: true,  popis: 'Sladká voda! Dá se tu nabrat pití a přebrodit.' },
    { nazev: 'Pláž',         chodit: true,  popis: 'Bílý písek, kokosy a to, co vyplaví moře.' },
    { nazev: 'Savana',       chodit: true,  popis: 'Vysoká tráva a keře. Vlákna, bobule, občas zvěř.' },
    { nazev: 'Džungle',      chodit: true,  popis: 'Hustý porost – dřevo, ovoce, ale i hadi.' },
    { nazev: 'Skály',        chodit: true,  popis: 'Holý kámen. Kámen na stavbu a dobrý výhled.' },
    { nazev: 'Sopečná oblast', chodit: true, popis: 'Černý popel a teplá půda. Něco tu doutná.' },
    { nazev: 'Kráter',       chodit: false, popis: 'Rozžhavené nitro sopky. Sem ani krok.' },
  ];

  const OBJ_INFO = [
    null,
    { nazev: 'Kokosová palma', popis: 'Kokosy – jídlo i trocha tekutiny.' },
    { nazev: 'Strom',          popis: 'Pořádné dřevo na stavbu.' },
    { nazev: 'Keř',            popis: 'Bobule a vlákna.' },
    { nazev: 'Balvan',         popis: 'Kámen, který se dá otloukat.' },
  ];

  const LOKACE_INFO = {
    vrak:    { nazev: 'Vrak lodi',         popis: 'Tvoje loď, rozlomená na útesu. Při odlivu se k ní dá dobrodit – v podpalubí ještě něco zbylo.' },
    jeskyne: { nazev: 'Jeskyně',           popis: 'Tmavý otvor ve skále. Zevnitř táhne studený vzduch.' },
    vodopad: { nazev: 'Vodopád',           popis: 'Řeka tu padá přes skalní stupeň. Čistá voda a za clonou… stín?' },
    tabor:   { nazev: 'Opuštěný tábor',    popis: 'Zbytky přístřešku a ohniště. Někdo tu žil před tebou.' },
    hlava:   { nazev: 'Kamenná hlava',     popis: 'Obrovská tvář vytesaná z kamene hledí k moři. Kdo ji postavil?' },
    ruiny:   { nazev: 'Ruiny',             popis: 'Porostlé zdi z opracovaných kamenů. Na jednom jsou vyryté symboly.' },
  };

  const CHODIT = TEREN_INFO.map(t => t.chodit);
  const JE_VODA = t => t <= TEREN.LAGUNA;           // slaná voda (moře, laguna)

  const idx = (x, y) => y * W + x;
  const uvnitr = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const SOUSEDE4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  // BFS po polích splňujících podmínku; vrací Int16Array vzdáleností (-1 = nedosažitelné)
  function bfs(zdroje, lze) {
    const d = new Int16Array(W * H).fill(-1);
    const fronta = new Int32Array(W * H);
    let hlava = 0, konec = 0;
    for (const i of zdroje) { if (d[i] < 0) { d[i] = 0; fronta[konec++] = i; } }
    while (hlava < konec) {
      const i = fronta[hlava++], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of SOUSEDE4) {
        const nx = x + dx, ny = y + dy;
        if (!uvnitr(nx, ny)) continue;
        const j = idx(nx, ny);
        if (d[j] >= 0 || !lze(j)) continue;
        d[j] = d[i] + 1; fronta[konec++] = j;
      }
    }
    return d;
  }

  // Souvislé komponenty souše (4-sousednost) – vrací pole komponent (pole indexů)
  function komponenty(jeSous) {
    const vid = new Uint8Array(W * H), vysl = [];
    for (let s = 0; s < W * H; s++) {
      if (vid[s] || !jeSous(s)) continue;
      const komp = [s]; vid[s] = 1;
      for (let k = 0; k < komp.length; k++) {
        const i = komp[k], x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of SOUSEDE4) {
          const nx = x + dx, ny = y + dy;
          if (!uvnitr(nx, ny)) continue;
          const j = idx(nx, ny);
          if (!vid[j] && jeSous(j)) { vid[j] = 1; komp.push(j); }
        }
      }
      vysl.push(komp);
    }
    return vysl;
  }

  const NAZVY_A = ['Ostrov', 'Ostrov', 'Ostrov', 'Atol', 'Souostroví'];
  const NAZVY_B = ['Tichých palem', 'Ztracených', 'Kamenných tváří', 'Bílých racků', 'Šepotu',
    'Rudého korálu', 'Posledního přístavu', 'Mlhy', 'Zelené želvy', 'Kouřící hory', 'Zapomenutých',
    'Divokých orchidejí', 'Mořských panen', 'Černého písku'];

  function generuj(seed) {
    seed = seed >>> 0;
    const rnd = Nahoda(smichej(seed, 1, 0));
    const nV = fbm(smichej(seed, 2, 0), 5);
    const nM = fbm(smichej(seed, 3, 0), 4);
    const nWx = fbm(smichej(seed, 4, 0), 3), nWy = fbm(smichej(seed, 5, 0), 3);

    // --- tvar ostrova: rotace, protažení, sopka mimo střed ---
    const uhel = rnd.dalsi() * Math.PI, protaz = 0.78 + rnd.dalsi() * 0.3;
    const cu = Math.cos(uhel), su = Math.sin(uhel);
    const sUhel = rnd.dalsi() * Math.PI * 2, sR = 5 + rnd.dalsi() * 8;
    const sopka = { x: Math.round(W / 2 + Math.cos(sUhel) * sR), y: Math.round(H / 2 + Math.sin(sUhel) * sR) };

    const h = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let nx = (x + 0.5) / W * 2 - 1, ny = (y + 0.5) / H * 2 - 1;
      // zvlnění pobřeží
      nx += (nWx(x * 0.07, y * 0.07) - 0.5) * 0.45;
      ny += (nWy(x * 0.07, y * 0.07) - 0.5) * 0.45;
      const rx = (nx * cu - ny * su), ry = (nx * su + ny * cu) / protaz;
      const r = Math.sqrt(rx * rx + ry * ry);
      let v = nV(x * 0.085, y * 0.085) * 0.95 + 0.33 - r * r * 1.05 - r * 0.28;
      const dv = Math.hypot(x - sopka.x, y - sopka.y);
      v += 0.5 * Math.pow(Math.max(0, 1 - dv / 9), 1.4);
      // okraj mapy je vždy moře
      const okraj = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (okraj < 4) v -= (4 - okraj) * 0.12;
      h[i2(x, y)] = v;
    }
    function i2(x, y) { return y * W + x; }

    // --- ponechat hlavní ostrov + větší ostrůvky, drobky potopit ---
    let komp = komponenty(i => h[i] > 0);
    komp.sort((a, b) => b.length - a.length);
    for (let k = 1; k < komp.length; k++) if (komp[k].length < 8) for (const i of komp[k]) h[i] = -0.03;

    const teren = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) teren[i] = h[i] > 0 ? TEREN.SAVANA : TEREN.MORE;

    // --- laguna: zátoka vykousnutá do pobřeží ---
    let dMore = bfs(range().filter(i => teren[i] === TEREN.MORE), i => teren[i] !== TEREN.MORE);
    {
      const kand = range().filter(i => dMore[i] === 3 && Math.hypot(i % W - sopka.x, (i / W | 0) - sopka.y) > 10);
      if (kand.length) {
        const c = rnd.vyber(kand), cx = c % W, cy = (c / W) | 0, R = 2 + rnd.dalsi() * 1.3;
        for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
          if (uvnitr(x, y) && Math.hypot(x - cx, y - cy) <= R) teren[idx(x, y)] = TEREN.LAGUNA;
        }
        // úzký průliv k moři (sestup po gradientu vzdálenosti)
        let i = c;
        for (let krok = 0; krok < 10 && dMore[i] > 0; krok++) {
          const x = i % W, y = (i / W) | 0;
          let nej = -1;
          for (const [dx, dy] of SOUSEDE4) {
            const j = idx(x + dx, y + dy);
            if (uvnitr(x + dx, y + dy) && dMore[j] < dMore[i] && (nej < 0 || dMore[j] < dMore[nej])) nej = j;
          }
          if (nej < 0) break;
          i = nej;
          if (teren[i] !== TEREN.MORE) teren[i] = TEREN.LAGUNA;
        }
      }
    }

    // --- hloubka moře ---
    const dSous = bfs(range().filter(i => teren[i] >= TEREN.REKA), i => teren[i] === TEREN.MORE);
    for (let i = 0; i < W * H; i++) if (teren[i] === TEREN.MORE && (dSous[i] < 0 || dSous[i] > 2)) teren[i] = TEREN.HLUBINA;

    const jeSous = i => teren[i] >= TEREN.REKA;
    dMore = bfs(range().filter(i => JE_VODA(teren[i])), jeSous);

    // --- percentil výšky na souši ---
    const sous = range().filter(jeSous);
    const serazene = sous.slice().sort((a, b) => h[a] - h[b]);
    const hp = new Float32Array(W * H);
    serazene.forEach((i, k) => { hp[i] = k / Math.max(1, serazene.length - 1); });

    // --- řeky: od skal po nejnižších sousedech k moři ---
    const reky = [];
    function tecReka(zdroj) {
      const cesta = [zdroj], v = new Set([zdroj]);
      let i = zdroj;
      for (let krok = 0; krok < 250; krok++) {
        const x = i % W, y = (i / W) | 0;
        let nej = -1, nejH = Infinity;
        for (const [dx, dy] of SOUSEDE4) {
          const nx = x + dx, ny = y + dy;
          if (!uvnitr(nx, ny)) continue;
          const j = idx(nx, ny);
          if (JE_VODA(teren[j])) return cesta;      // ústí do moře/laguny
          if (v.has(j) || teren[j] === TEREN.REKA) continue;
          // tok se nesmí dotknout vlastního koryta (jinak vznikají „rybníky")
          let dotyk = 0;
          for (const [ex, ey] of SOUSEDE4) {
            const k = idx(nx + ex, ny + ey);
            if (uvnitr(nx + ex, ny + ey) && k !== i && v.has(k)) dotyk++;
          }
          if (dotyk) continue;
          const hh = h[j] + (smichej(seed, j, 7) / 4294967296) * 0.004;
          if (hh < nejH) { nejH = hh; nej = j; }
        }
        if (nej < 0) return null;
        cesta.push(nej); v.add(nej); i = nej;
      }
      return null;
    }
    const zdroje = rnd.zamichej(sous.filter(i => hp[i] > 0.78 && hp[i] < 0.95 &&
      Math.hypot(i % W - sopka.x, (i / W | 0) - sopka.y) > 5));
    const pocetRek = rnd.sance(0.45) ? 2 : 1;
    for (const z of zdroje) {
      if (reky.length >= pocetRek) break;
      if (reky.some(r => r.some(j => Math.hypot(j % W - z % W, (j / W | 0) - (z / W | 0)) < 10))) continue;
      const c = tecReka(z);
      if (c && c.length >= 10) { reky.push(c); for (const j of c) teren[j] = TEREN.REKA; }
    }
    if (!reky.length) {                  // nouzově: nejdelší tok z libovolného vyššího místa
      let nej = null;
      for (const z of zdroje.concat(serazene.slice(-40)).slice(0, 80)) {
        const c = tecReka(z);
        if (c && (!nej || c.length > nej.length)) nej = c;
      }
      if (nej) { reky.push(nej); for (const j of nej) teren[j] = TEREN.REKA; }
    }
    const dReka = bfs(range().filter(i => teren[i] === TEREN.REKA), () => true);

    // --- biomy ---
    for (const i of sous) {
      if (teren[i] === TEREN.REKA) continue;
      const x = i % W, y = (i / W) | 0;
      const dv = Math.hypot(x - sopka.x, y - sopka.y) + (nM(x * 0.3, y * 0.3) - 0.5) * 2;
      const m = nM(x * 0.11, y * 0.11) + (dReka[i] >= 0 && dReka[i] <= 2 ? 0.14 : 0) - hp[i] * 0.15;
      let t;
      if (dv < 1.3 && hp[i] > 0.9) t = TEREN.LAVA;
      else if (dv < 4.2 && hp[i] > 0.55) t = TEREN.SOPKA;
      else if (hp[i] > 0.86) t = TEREN.SKALY;
      else if (dMore[i] <= 1 && hp[i] < 0.42) t = TEREN.PLAZ;
      else if (dMore[i] === 2 && hp[i] < 0.12) t = TEREN.PLAZ;
      else t = m > 0.43 ? TEREN.DZUNGLE : TEREN.SAVANA;
      teren[i] = t;
    }
    // kráter vždy aspoň jedno pole na vrcholu sopky
    {
      let vrchol = -1;
      for (const i of sous) if (Math.hypot(i % W - sopka.x, (i / W | 0) - sopka.y) < 3 &&
        teren[i] !== TEREN.REKA && (vrchol < 0 || h[i] > h[vrchol])) vrchol = i;
      if (vrchol >= 0) {
        teren[vrchol] = TEREN.LAVA; sopka.x = vrchol % W; sopka.y = (vrchol / W) | 0;
        for (const [dx, dy] of SOUSEDE4.concat([[1, 1], [-1, -1], [1, -1], [-1, 1]])) {
          const x = sopka.x + dx, y = sopka.y + dy;
          if (uvnitr(x, y) && jeSous(idx(x, y)) && teren[idx(x, y)] !== TEREN.REKA && teren[idx(x, y)] !== TEREN.LAVA) teren[idx(x, y)] = TEREN.SOPKA;
        }
      }
    }

    // --- start: pláž u moře, sladká voda na dosah, daleko od sopky ---
    const chodit = i => CHODIT[teren[i]];
    komp = komponenty(chodit).sort((a, b) => b.length - a.length);
    const hlavni = new Uint8Array(W * H);
    for (const i of komp[0]) hlavni[i] = 1;
    const dPiti = bfs(range().filter(i => teren[i] === TEREN.REKA), chodit);
    const uMore = i => SOUSEDE4.some(([dx, dy]) => {
      const x = i % W + dx, y = ((i / W) | 0) + dy;
      return uvnitr(x, y) && teren[idx(x, y)] === TEREN.MORE;
    });
    let start = -1;
    const podminky = [[5, 14, 14], [3, 18, 10], [2, 26, 6], [0, 99, 0]];
    for (const [dMin, dMax, dSop] of podminky) {
      const kand = komp[0].filter(i => teren[i] === TEREN.PLAZ && uMore(i) &&
        dPiti[i] >= dMin && dPiti[i] <= dMax && Math.hypot(i % W - sopka.x, (i / W | 0) - sopka.y) >= dSop);
      if (kand.length) { start = rnd.vyber(kand); break; }
    }
    if (start < 0) start = komp[0].find(i => uMore(i)) ?? komp[0][0];

    const lokace = [];
    const lokNa = new Int16Array(W * H).fill(-1);
    function pridej(typ, i) { lokNa[i] = lokace.length; lokace.push({ typ, x: i % W, y: (i / W) | 0 }); }

    // vrak na mělčině u startu – co nejvíc „venku" (nejvíc vodních sousedů)
    {
      const sx = start % W, sy = (start / W) | 0;
      let nej = -1, nejS = -1;
      for (const [dx, dy] of SOUSEDE4) {
        const x = sx + dx, y = sy + dy;
        if (!uvnitr(x, y) || teren[idx(x, y)] !== TEREN.MORE) continue;
        let s = 0;
        for (const [ex, ey] of SOUSEDE4) if (uvnitr(x + ex, y + ey) && JE_VODA(teren[idx(x + ex, y + ey)])) s++;
        if (s > nejS) { nejS = s; nej = idx(x, y); }
      }
      if (nej >= 0) pridej('vrak', nej);
    }

    const dStart = bfs([start], chodit);
    const dalekoOdLokaci = (i, min) => lokace.every(l => Math.hypot(l.x - i % W, l.y - ((i / W) | 0)) >= min);
    function umisti(typ, podminka, dMin) {
      for (const [koef, rozestup] of [[1, 7], [0.7, 5], [0.45, 3], [0, 2]]) {
        const kand = range().filter(i => hlavni[i] && lokNa[i] < 0 && i !== start && dStart[i] >= dMin * koef &&
          podminka(i) && dalekoOdLokaci(i, rozestup));
        if (kand.length) { pridej(typ, rnd.vyber(kand)); return true; }
      }
      return false;
    }

    // vodopád: největší spád na řece
    for (const r of reky) {
      let nej = -1, nejS = -Infinity;
      for (let k = 2; k < r.length - 2; k++) {
        const s = h[r[k - 1]] - h[r[k + 1]];
        if (s > nejS && hlavni[r[k]]) { nejS = s; nej = r[k]; }
      }
      if (nej >= 0 && !lokace.some(l => l.typ === 'vodopad')) pridej('vodopad', nej);
    }
    const sousedi = (i, podm) => SOUSEDE4.some(([dx, dy]) => {
      const x = i % W + dx, y = ((i / W) | 0) + dy;
      return uvnitr(x, y) && podm(teren[idx(x, y)]);
    });
    umisti('jeskyne', i => teren[i] === TEREN.SKALY && sousedi(i, t => t === TEREN.SAVANA || t === TEREN.DZUNGLE || t === TEREN.PLAZ), 14)
      || umisti('jeskyne', i => teren[i] === TEREN.SKALY || teren[i] === TEREN.SOPKA, 10);
    umisti('ruiny', i => teren[i] === TEREN.DZUNGLE && dMore[i] >= 3, 18)
      || umisti('ruiny', i => teren[i] === TEREN.DZUNGLE || teren[i] === TEREN.SAVANA, 12);
    umisti('hlava', i => (teren[i] === TEREN.SAVANA || teren[i] === TEREN.PLAZ) && hp[i] > 0.35, 12)
      || umisti('hlava', i => teren[i] !== TEREN.REKA, 8);
    umisti('tabor', i => (teren[i] === TEREN.PLAZ || teren[i] === TEREN.SAVANA) && dMore[i] <= 2, 22)
      || umisti('tabor', i => teren[i] !== TEREN.REKA, 10);

    // --- drobné objekty ---
    const obj = new Uint8Array(W * H);
    const varianta = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      varianta[i] = smichej(seed, i, 11) & 3;
      if (i === start || lokNa[i] >= 0) continue;
      const p = rnd.dalsi();
      switch (teren[i]) {
        case TEREN.PLAZ:    if (p < 0.16) obj[i] = OBJ.PALMA; break;
        case TEREN.SAVANA:  if (p < 0.11) obj[i] = OBJ.KER; else if (p < 0.16) obj[i] = OBJ.PALMA; else if (p < 0.19) obj[i] = OBJ.BALVAN; break;
        case TEREN.DZUNGLE: if (p < 0.52) obj[i] = OBJ.STROM; else if (p < 0.64) obj[i] = OBJ.KER; else if (p < 0.70) obj[i] = OBJ.PALMA; break;
        case TEREN.SKALY:   if (p < 0.2) obj[i] = OBJ.BALVAN; break;
        case TEREN.SOPKA:   if (p < 0.07) obj[i] = OBJ.BALVAN; break;
      }
    }

    const nazev = rnd.vyber(NAZVY_A) + ' ' + rnd.vyber(NAZVY_B);
    return {
      seed, w: W, h: H, nazev, teren, obj, varianta, vyska: h, lokace, lokNa,
      start: { x: start % W, y: (start / W) | 0 }, sopka, reky, hlavni,
    };
  }

  function range() { const a = new Array(W * H); for (let i = 0; i < W * H; i++) a[i] = i; return a; }

  // --- mlha: 0 = neznámé, 1 = objevené --------------------------------------
  function novaMlha() { return new Uint8Array(W * H); }
  function odkryj(mlha, x, y, r) {
    let nove = 0;
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
      if (!uvnitr(xx, yy) || (xx - x) ** 2 + (yy - y) ** 2 > r * r + r) continue;
      const i = idx(xx, yy);
      if (!mlha[i]) { mlha[i] = 1; nove++; }
    }
    return nove;
  }

  // Cena vstupu na pole v akčních bodech (hustý porost, kamení a brod stojí víc)
  const CENA_KROKU = [0, 0, 0, 2, 1, 1, 2, 2, 2, 0];
  function cenaKroku(t) { return CENA_KROKU[t]; }

  /* Nejlevnější cesta po známých schůdných polích (Dijkstra s cenou vstupu na pole).
     Vrací pole kroků [{x, y, cena}] bez startu, včetně cíle; null = nelze.
     cena(t) – volitelně vlastní cena podle terénu (výchozí CENA_KROKU). */
  function cesta(svet, mlha, ax, ay, bx, by, cena) {
    cena = cena || cenaKroku;
    const cil = idx(bx, by);
    if (!uvnitr(bx, by) || !mlha[cil] || !CHODIT[svet.teren[cil]]) return null;
    const s = idx(ax, ay);
    const dist = new Float64Array(W * H).fill(Infinity), odkud = new Int32Array(W * H).fill(-1);
    dist[s] = 0;
    const halda = [[0, s]];                      // binární halda (vzdálenost, pole)
    const vloz = (d, i) => {
      halda.push([d, i]);
      let k = halda.length - 1;
      while (k > 0) { const r = (k - 1) >> 1; if (halda[r][0] <= halda[k][0]) break; [halda[r], halda[k]] = [halda[k], halda[r]]; k = r; }
    };
    const vyjmi = () => {
      const top = halda[0], posl = halda.pop();
      if (halda.length) {
        halda[0] = posl; let k = 0;
        for (;;) {
          const l = 2 * k + 1, p = l + 1; let m = k;
          if (l < halda.length && halda[l][0] < halda[m][0]) m = l;
          if (p < halda.length && halda[p][0] < halda[m][0]) m = p;
          if (m === k) break;
          [halda[m], halda[k]] = [halda[k], halda[m]]; k = m;
        }
      }
      return top;
    };
    while (halda.length) {
      const [d, i] = vyjmi();
      if (d > dist[i]) continue;
      if (i === cil) break;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of SOUSEDE4) {
        const nx = x + dx, ny = y + dy;
        if (!uvnitr(nx, ny)) continue;
        const j = idx(nx, ny);
        if (!mlha[j] || !CHODIT[svet.teren[j]]) continue;
        const nd = d + cena(svet.teren[j], j);
        if (nd < dist[j]) { dist[j] = nd; odkud[j] = i; vloz(nd, j); }
      }
    }
    if (cil !== s && odkud[cil] < 0) return null;
    const c = [];
    for (let i = cil; i !== s; i = odkud[i]) c.push({ x: i % W, y: (i / W) | 0, cena: cena(svet.teren[i], i) });
    return c.reverse();
  }

  T.svet = {
    W, H, TEREN, OBJ, TEREN_INFO, OBJ_INFO, LOKACE_INFO, CHODIT, JE_VODA,
    generuj, novaMlha, odkryj, cesta, cenaKroku, CENA_KROKU, bfs, komponenty, idx, uvnitr, SOUSEDE4,
  };
})(TROS);

if (typeof module !== 'undefined') module.exports = TROS;
