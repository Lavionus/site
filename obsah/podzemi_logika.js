/* ============================================================
   podzemi_logika.js – čistá logika hry Nekonečné podzemí.

   Nesahá na DOM ani na localStorage, takže se dá celá pustit
   v node (_test/podzemi_test.js). Stránka `podzemi.html` jen
   kreslí a posílá sem akce hráče.

   Patro se nikam neukládá – vzniká vždy znovu ze seedu výpravy
   a čísla patra. Ukládá se jen pozice, prozkoumaná pole a dveře.
   ============================================================ */
(function (koren) {
  'use strict';

  // --- dlaždice -------------------------------------------------
  const T = { SKALA: 0, PODLAHA: 1, CHODBA: 2, DVERE: 3, OTVOR: 4, DOLU: 5, NAHORU: 6, TAJNE: 7 };   // TAJNE = zeď s prasklinou
  // směry: 0 = sever, 1 = východ, 2 = jih, 3 = západ
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  // --- náhoda ---------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function smichej(a, b) {
    let h = (a >>> 0) ^ Math.imul((b + 0x9E3779B9) | 0, 0x85EBCA6B);
    h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
    h = Math.imul(h ^ (a >>> 7), 0x27D4EB2F); h ^= h >>> 15;
    return h >>> 0;
  }
  function nahoda(seed) {
    const f = mulberry32(seed);
    return {
      f,
      int: (a, b) => a + Math.floor(f() * (b - a + 1)),
      vyber: arr => arr[Math.floor(f() * arr.length)],
      sance: p => f() < p,
    };
  }

  // --- prostředí podle hloubky ---------------------------------
  const BIOMY = [
    { od: 1,  nazev: 'Kamenné kobky' },
    { od: 11, nazev: 'Zatopené jeskyně' },
    { od: 21, nazev: 'Trpasličí doly' },
    { od: 31, nazev: 'Krypta' },
    { od: 41, nazev: 'Lávové podzemí' },
    { od: 51, nazev: 'Podivno' },
  ];
  function biom(patro) {
    let b = BIOMY[0];
    for (const x of BIOMY) if (patro >= x.od) b = x;
    return b;
  }

  function velikostPatra(patro) { return Math.min(32, 20 + 2 * Math.floor((patro - 1) / 5)); }

  // --- generátor ------------------------------------------------
  function generujPatro(seedVypravy, patro) {
    const zaklad = smichej(seedVypravy, patro);
    for (let pokus = 0; pokus < 300; pokus++) {
      const p = zkusPatro(smichej(zaklad, pokus), patro);
      if (!p && generujPatro.statistika) generujPatro.statistika[zkusPatro.duvod] = (generujPatro.statistika[zkusPatro.duvod] || 0) + 1;
      if (p) { p.pokus = pokus; p.seedVypravy = seedVypravy >>> 0; return p; }
    }
    throw new Error('Generátor patra selhal (seed ' + seedVypravy + ', patro ' + patro + ')');
  }

  function zkusPatro(seed, patro) {
    const R = nahoda(seed);
    const n = velikostPatra(patro), w = n, h = n;
    const I = (x, y) => y * w + x;
    const mapa = new Uint8Array(w * h);            // vše skála
    const mistnostId = new Int16Array(w * h).fill(-1);
    const prstenec = new Int16Array(w * h).fill(-1); // zeď těsně kolem místnosti

    // 1) místnosti – mezi dvěma místnostmi musí zbýt aspoň zeď, chodba, zeď
    const maxM = Math.min(12, 7 + Math.floor((n - 20) / 4));
    const cil = R.int(5, maxM);
    const mistnosti = [];
    for (let t = 0; t < 500 && mistnosti.length < cil; t++) {
      const mw = R.int(3, n < 24 ? 6 : 7), mh = R.int(3, n < 24 ? 5 : 6);   // na malém patře menší, ať se vejdou
      const x = R.int(2, w - 2 - mw), y = R.int(2, h - 2 - mh);
      let koliduje = false;
      for (const m of mistnosti) {
        if (x < m.x + m.w + 3 && m.x < x + mw + 3 && y < m.y + m.h + 3 && m.y < y + mh + 3) { koliduje = true; break; }
      }
      if (!koliduje) mistnosti.push({ x, y, w: mw, h: mh });
    }
    if (mistnosti.length < 5) return (zkusPatro.duvod = 'mistnosti', null);

    mistnosti.forEach((m, id) => {
      m.id = id;
      for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
        mapa[I(x, y)] = T.PODLAHA; mistnostId[I(x, y)] = id;
      }
      for (let y = m.y - 1; y <= m.y + m.h; y++) for (let x = m.x - 1; x <= m.x + m.w; x++) {
        if (mistnostId[I(x, y)] < 0) prstenec[I(x, y)] = id;
      }
    });

    // 2) které dvojice spojit: minimální kostra + pár smyček navíc
    const stred = m => ({ x: m.x + (m.w - 1) / 2, y: m.y + (m.h - 1) / 2 });
    const hrany = [];
    for (let a = 0; a < mistnosti.length; a++) for (let b = a + 1; b < mistnosti.length; b++) {
      const sa = stred(mistnosti[a]), sb = stred(mistnosti[b]);
      hrany.push({ a, b, d: Math.abs(sa.x - sb.x) + Math.abs(sa.y - sb.y) });
    }
    hrany.sort((p, q) => p.d - q.d);
    const rodic = mistnosti.map((_, i) => i);
    const najdi = i => (rodic[i] === i ? i : (rodic[i] = najdi(rodic[i])));
    const spojit = [], zbytek = [];
    for (const e of hrany) {
      const ra = najdi(e.a), rb = najdi(e.b);
      if (ra !== rb) { rodic[ra] = rb; spojit.push(e); } else zbytek.push(e);
    }
    const smycek = Math.min(zbytek.length, R.int(1, 3));
    const kandidati = zbytek.slice(0, Math.max(smycek, 6));
    for (let k = 0; k < smycek; k++) spojit.push(kandidati.splice(Math.floor(R.f() * kandidati.length), 1)[0]);

    // šum, aby chodby nebyly jen pravítkem rovné „L"
    const sum = new Float32Array(w * h);
    for (let i = 0; i < sum.length; i++) sum[i] = R.f() * 1.6;

    const dvere = [];                        // {x, y, osa: 0 = průchod S–J, 1 = V–Z, mistnost, strana}
    const vnitrni = (x, y) => x >= 1 && y >= 1 && x < w - 1 && y < h - 1;

    function kandidatiDveri(m, strana) {
      const out = [];
      if (strana === 0 || strana === 2) {
        const y = strana === 0 ? m.y - 1 : m.y + m.h;
        for (let x = m.x; x < m.x + m.w; x++) out.push({ x, y });
      } else {
        const x = strana === 3 ? m.x - 1 : m.x + m.w;
        for (let y = m.y; y < m.y + m.h; y++) out.push({ x, y });
      }
      return out.filter(c => {
        const ox = c.x + DX[strana], oy = c.y + DY[strana];
        if (!vnitrni(ox, oy) || mistnostId[I(ox, oy)] >= 0 || prstenec[I(ox, oy)] >= 0) return false;
        if (mapa[I(ox, oy)] === T.SKALA && doplniBlok(ox, oy)) return false;
        // ne těsně vedle jiných dveří
        for (const d of dvere) if (Math.abs(d.x - c.x) + Math.abs(d.y - c.y) <= 1) return false;
        return true;
      });
    }

    function poradiStran(m, cilovy) {
      const a = stred(m), b = stred(cilovy);
      const dx = b.x - a.x, dy = b.y - a.y;
      const hlavni = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      const vedlejsi = Math.abs(dx) > Math.abs(dy) ? (dy > 0 ? 2 : 0) : (dx > 0 ? 1 : 3);
      const ostatni = [0, 1, 2, 3].filter(s => s !== hlavni && s !== vedlejsi);
      return [hlavni, vedlejsi, ...ostatni];
    }

    // výběr dveří: existující na stejné straně občas znovu použijeme
    function vyberDvere(m, strana) {
      const stare = dvere.filter(d => d.mistnost === m.id && d.strana === strana);
      if (stare.length && R.sance(0.5)) return { ...R.vyber(stare), nove: false };
      const k = kandidatiDveri(m, strana);
      if (!k.length) return null;
      // přednost prostředku stěny, ale ne vždy
      k.sort((p, q) => (Math.abs(p.x - (m.x + m.w / 2)) + Math.abs(p.y - (m.y + m.h / 2))) - (Math.abs(q.x - (m.x + m.w / 2)) + Math.abs(q.y - (m.y + m.h / 2))));
      const c = k[Math.min(k.length - 1, Math.floor(R.f() * R.f() * k.length))];
      return { x: c.x, y: c.y, strana, mistnost: m.id, osa: (strana === 0 || strana === 2) ? 0 : 1, nove: true };
    }

    // Dijkstra mezi dvěma venkovními poli; místnosti a jejich zdi jsou zakázané
    function najdiChodbu(sx, sy, cx, cy) {
      const N = w * h, dist = new Float32Array(N).fill(Infinity), odkud = new Int32Array(N).fill(-1);
      const hotovo = new Uint8Array(N);
      const halda = [];
      const push = (i, d) => { halda.push([d, i]); let k = halda.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (halda[p][0] <= halda[k][0]) break; [halda[p], halda[k]] = [halda[k], halda[p]]; k = p; } };
      const pop = () => { const top = halda[0], last = halda.pop(); if (halda.length) { halda[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < halda.length && halda[l][0] < halda[m][0]) m = l; if (r < halda.length && halda[r][0] < halda[m][0]) m = r; if (m === k) break; [halda[m], halda[k]] = [halda[k], halda[m]]; k = m; } } return top; };
      if (mapa[I(sx, sy)] === T.SKALA && doplniBlok(sx, sy)) return null;
      const s = I(sx, sy), c = I(cx, cy);
      dist[s] = 0; push(s, 0);
      while (halda.length) {
        const [d, i] = pop();
        if (hotovo[i]) continue; hotovo[i] = 1;
        if (i === c) break;
        const x = i % w, y = (i / w) | 0;
        for (let k = 0; k < 4; k++) {
          const nx = x + DX[k], ny = y + DY[k];
          if (!vnitrni(nx, ny)) continue;
          const j = I(nx, ny);
          if (mistnostId[j] >= 0 || prstenec[j] >= 0) continue;
          if (tvoriBlok(x, y, nx, ny, k)) continue;
          let cena = mapa[j] === T.CHODBA ? 1 : 3 + sum[j];
          if (mapa[j] !== T.CHODBA) {
            // nelepit chodby k sobě souběžně – vznikaly by široké plochy
            for (let q = 0; q < 4; q++) {
              const ax = nx + DX[q], ay = ny + DY[q];
              if ((ax !== x || ay !== y) && mapa[I(ax, ay)] === T.CHODBA) { cena += 4; break; }
            }
          }
          if (d + cena < dist[j]) { dist[j] = d + cena; odkud[j] = i; push(j, d + cena); }
        }
      }
      if (!hotovo[c]) return null;
      const cesta = [];
      for (let i = c; i !== -1; i = odkud[i]) cesta.push(i);
      return cesta;
    }

    // Krok i→j nesmí vytvořit průchozí blok 2×2 (tlustou chodbu):
    // ani s třemi už otevřenými poli kolem j, ani souběžně s otevřenou dvojicí vedle.
    const otevreno = (x, y) => mapa[I(x, y)] !== T.SKALA;
    function doplniBlok(nx, ny) {
      for (const [ax, ay] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        let n = 0;
        for (const [bx, by] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const px = nx + ax + bx, py = ny + ay + by;
          if ((px !== nx || py !== ny) && otevreno(px, py)) n++;
        }
        if (n === 3) return true;
      }
      return false;
    }
    function tvoriBlok(x, y, nx, ny, k) {
      if (doplniBlok(nx, ny)) return true;
      for (const q of [(k + 1) % 4, (k + 3) % 4]) {
        if (otevreno(x + DX[q], y + DY[q]) && otevreno(nx + DX[q], ny + DY[q])) return true;
      }
      return false;
    }

    function propoj(ma, mb) {
      for (const sa of poradiStran(ma, mb)) {
        const da = vyberDvere(ma, sa);
        if (!da) continue;
        for (const sb of poradiStran(mb, ma)) {
          const db = vyberDvere(mb, sb);
          if (!db) continue;
          const cesta = najdiChodbu(da.x + DX[sa], da.y + DY[sa], db.x + DX[sb], db.y + DY[sb]);
          if (!cesta) continue;
          for (const i of cesta) mapa[i] = T.CHODBA;
          for (const d of [da, db]) if (d.nove) {
            d.nove = false;
            dvere.push({ x: d.x, y: d.y, osa: d.osa, strana: d.strana, mistnost: d.mistnost });
            mapa[I(d.x, d.y)] = T.OTVOR;           // typ se určí na konci
          }
          return true;
        }
      }
      return false;
    }

    for (const e of spojit) if (!propoj(mistnosti[e.a], mistnosti[e.b])) return (zkusPatro.duvod = 'propojeni', null);

    // dveře: zhruba 60 % skutečných dveří, zbytek otevřené průchody
    for (const d of dvere) {
      d.zavrene = R.sance(0.6);
      mapa[I(d.x, d.y)] = d.zavrene ? T.DVERE : T.OTVOR;
    }

    // pojistka: chodba se občas stočí sama k sobě – takové patro zahodíme
    for (let y = 1; y < h - 2; y++) for (let x = 1; x < w - 2; x++) {
      const bl = [I(x, y), I(x + 1, y), I(x, y + 1), I(x + 1, y + 1)];
      if (bl.every(i => mapa[i] !== T.SKALA) && bl.some(i => mistnostId[i] < 0)) return (zkusPatro.duvod = 'blok', null);
    }

    // 3) start a schody
    const startM = R.vyber(mistnosti);
    const sx = startM.x + Math.floor(startM.w / 2), sy = startM.y + Math.floor(startM.h / 2);
    const dist = vzdalenosti(mapa, w, h, sx, sy);
    for (const m of mistnosti) for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
      if (dist[I(x, y)] < 0) return (zkusPatro.duvod = 'souvislost', null);
    }
    let nejdal = null;
    for (const m of mistnosti) {
      if (m === startM) continue;
      const s = stred(m), d = dist[I(Math.round(s.x), Math.round(s.y))];
      if (!nejdal || d > nejdal.d) nejdal = { m, d };
    }
    const cm = nejdal.m;
    const volna = [];
    for (let y = cm.y; y < cm.y + cm.h; y++) for (let x = cm.x; x < cm.x + cm.w; x++) {
      // ne přímo za dveřmi, ať schody neblokují průchod místností
      let uDveri = false;
      for (const d of dvere) if (Math.abs(d.x - x) + Math.abs(d.y - y) <= 1) uDveri = true;
      if (!uDveri) volna.push({ x, y });
    }
    const dolu = volna.length ? R.vyber(volna) : { x: cm.x + (cm.w >> 1), y: cm.y + (cm.h >> 1) };
    mapa[I(dolu.x, dolu.y)] = T.DOLU;
    mapa[I(sx, sy)] = T.NAHORU;

    // 4) tajná místnost: kus skály vedle místnosti nebo chodby, dovnitř jen zdí s prasklinou
    if (R.sance(0.55)) {
      for (let t = 0; t < 300; t++) {
        const tw = R.int(2, 4), th = R.int(2, 4);
        const tx = R.int(2, w - 2 - tw), ty = R.int(2, h - 2 - th);
        let ok = true;
        for (let y = ty - 1; y <= ty + th && ok; y++) for (let x = tx - 1; x <= tx + tw; x++) if (mapa[I(x, y)] !== T.SKALA) { ok = false; break; }
        if (!ok) continue;
        // vstup = pole zdi kolem (ne roh), za kterým je podlaha nebo chodba; po stranách musí zůstat skála
        const vstupy = [];
        for (let x = tx; x < tx + tw; x++) { vstupy.push([x, ty - 1, 0]); vstupy.push([x, ty + th, 2]); }
        for (let y = ty; y < ty + th; y++) { vstupy.push([tx - 1, y, 3]); vstupy.push([tx + tw, y, 1]); }
        const mozne = vstupy.filter(([x, y, k]) => {
          const bx = x + DX[k], by = y + DY[k];
          if (!vnitrni(bx, by)) return false;
          const tb = mapa[I(bx, by)];
          if (tb !== T.PODLAHA && tb !== T.CHODBA) return false;
          return mapa[I(x + DX[(k + 1) % 4], y + DY[(k + 1) % 4])] === T.SKALA && mapa[I(x + DX[(k + 3) % 4], y + DY[(k + 3) % 4])] === T.SKALA;
        });
        if (!mozne.length) continue;
        const [vx, vy, k] = R.vyber(mozne);
        const id = mistnosti.length;
        for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) { mapa[I(x, y)] = T.PODLAHA; mistnostId[I(x, y)] = id; }
        mapa[I(vx, vy)] = T.TAJNE;
        dvere.push({ x: vx, y: vy, osa: (k === 0 || k === 2) ? 0 : 1, strana: k, mistnost: id, tajne: true, zavrene: true });
        mistnosti.push({ x: tx, y: ty, w: tw, h: th, id, tajna: true });
        break;
      }
    }

    // pohled startu: tam, kde je před hráčem nejvíc volného místa
    let smer = 0, nejvic = -1;
    for (let k = 0; k < 4; k++) {
      let delka = 0, x = sx + DX[k], y = sy + DY[k];
      while (x >= 0 && y >= 0 && x < w && y < h && mapa[I(x, y)] !== T.SKALA) { delka++; x += DX[k]; y += DY[k]; }
      if (delka > nejvic) { nejvic = delka; smer = k; }
    }

    return {
      w, h, patro, seed, mapa, mistnosti, dvere, mistnostId,
      start: { x: sx, y: sy, smer },
      nahoru: { x: sx, y: sy },
      dolu,
      biom: biom(patro).nazev,
    };
  }

  function pruchozi(t) { return t !== T.SKALA && t !== T.TAJNE; }

  // BFS po průchozích polích (dveře se počítají jako průchozí)
  function vzdalenosti(mapa, w, h, sx, sy) {
    const dist = new Int32Array(w * h).fill(-1);
    const fronta = [sy * w + sx]; dist[fronta[0]] = 0;
    for (let q = 0; q < fronta.length; q++) {
      const i = fronta[q], x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k], ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (dist[j] < 0 && pruchozi(mapa[j])) { dist[j] = dist[i] + 1; fronta.push(j); }
      }
    }
    return dist;
  }

  // --- postava, zbraně, bestiář ---------------------------------
  const JMENA = [
    ['Sir Cortanus', 'm'], ['Dáma Ivana z Hlubin', 'z'], ['Bořek Zvědavý', 'm'], ['Rytíř Hostivít', 'm'],
    ['Lady Morgana', 'z'], ['Bratr Ondřej', 'm'], ['Zdislava Neohrožená', 'z'], ['Vilém Bezruký', 'm'],
    ['Kateřina Svítilna', 'z'], ['Jaroš z Rokle', 'm'], ['Anežka Hbitá', 'z'], ['Mikuláš Poslední', 'm'],
  ];

  // Jak rychle potvory sílí s patry nad svým `od` (laděno botem v _test/podzemi_boj.js).
  const OBTIZNOST = { hpRust: 0.35, utokRust: 0.8, presnostRust: 0.02 };

  // od/do = rozsah pater; rychlost = akcí za tah (0,6 = občas stojí); uteka = při jaké části zdraví prchá
  const BESTIAR = {
    krysa: {
      nom: 'Krysa', aku: 'krysu', rod: 'z', od: 1, do: 6, hp: 6, utok: [1, 3], obrana: 0, presnost: 0.7,
      zk: 3, rychlost: 1, uteka: 0.35, dvere: false, spi: 0.3, vaha: 6,
      utokText: 'tě kousla', minulText: 'chňapla vedle', smrtText: 'Krysa pištivě pošla.',
      pricina: ['krysa, která měla větší hlad než ty', 'jedna velmi odhodlaná krysa'],
    },
    had: {
      nom: 'Had', aku: 'hada', rod: 'm', od: 1, do: 7, hp: 9, utok: [2, 4], obrana: 0, presnost: 0.7,
      zk: 5, rychlost: 0.8, uteka: 0, dvere: false, spi: 0.5, vaha: 4,
      utokText: 'tě uštkl', minulText: 'syčivě minul', smrtText: 'Had se stočil a znehybněl.',
      pricina: ['had s velmi krátkou trpělivostí', 'hadí polibek, který nebyl z lásky'],
    },
    pavouk: {
      nom: 'Obří pavouk', aku: 'obřího pavouka', rod: 'm', od: 2, do: 9, hp: 12, utok: [2, 5], obrana: 1, presnost: 0.72,
      zk: 8, rychlost: 1.4, uteka: 0, dvere: false, spi: 0.35, vaha: 4,
      utokText: 'tě kousl', minulText: 'cvakl kusadly naprázdno', smrtText: 'Pavouk se zkroutil a zemřel.',
      pricina: ['obří pavouk, který si tě spletl s večeří', 'osm nohou a žádné slitování'],
    },
    goblin: {
      nom: 'Goblin', aku: 'goblina', rod: 'm', od: 4, do: 14, hp: 18, utok: [3, 7], obrana: 1, presnost: 0.72,
      zk: 12, rychlost: 1, uteka: 0.25, dvere: true, spi: 0.25, vaha: 5,
      utokText: 'tě udeřil kyjem', minulText: 'máchl kyjem vedle', smrtText: 'Goblin padl s posledním zachrochtáním.',
      pricina: ['goblin s kyjem a pevným názorem', 'goblin, který si na tebe počkal za rohem'],
    },
    kostlivec: {
      nom: 'Kostlivec', aku: 'kostlivce', rod: 'm', od: 6, do: 16, hp: 24, utok: [4, 9], obrana: 2, presnost: 0.75,
      zk: 16, rychlost: 0.65, uteka: 0, dvere: true, spi: 0.2, vaha: 5,
      utokText: 'tě sekl rezavou sekerou', minulText: 'zachrastil a minul', smrtText: 'Kostlivec se rozsypal na hromádku kostí.',
      pricina: ['kostlivec s velmi přesvědčivým argumentem v podobě sekery', 'kostlivec, kterému už nic nechybělo – kromě tvé hlavy'],
    },
    // 11–20 zatopené jeskyně (orci, utopenci, mágové)
    ork: {
      nom: 'Ork', aku: 'orka', rod: 'm', od: 11, do: 24, hp: 64, utok: [7, 13], obrana: 3, presnost: 0.74,
      zk: 34, rychlost: 1, uteka: 0.15, dvere: true, spi: 0.25, vaha: 5,
      utokText: 'tě sekl zubatou šavlí', minulText: 'máchl šavlí vedle', smrtText: 'Ork se s řevem skácel.',
      pricina: ['ork, který neznal slovo „slitování"', 'zubatá šavle a ještě zubatější ork'],
    },
    utopenec: {
      nom: 'Utopenec', aku: 'utopence', rod: 'm', od: 11, do: 22, hp: 80, utok: [6, 12], obrana: 2, presnost: 0.7,
      zk: 32, rychlost: 0.7, uteka: 0, dvere: true, spi: 0.4, vaha: 4,
      utokText: 'tě sevřel slizkýma rukama', minulText: 'natáhl ruce naprázdno', smrtText: 'Utopenec se rozplynul v louži bahna.',
      pricina: ['utopenec, který si chtěl popovídat pod vodou', 'slizké objetí z hlubin'],
    },
    zabak: {
      nom: 'Obří žabák', aku: 'obřího žabáka', rod: 'm', od: 11, do: 20, hp: 40, utok: [5, 10], obrana: 1, presnost: 0.75,
      zk: 22, rychlost: 1.5, uteka: 0.3, dvere: false, spi: 0.3, vaha: 4,
      utokText: 'tě šlehl jazykem', minulText: 'mlaskl naprázdno', smrtText: 'Žabák naposledy kvákl.',
      pricina: ['obří žabák s nečekaně dlouhým jazykem', 'kvák. A pak ticho.'],
    },
    mag: {
      nom: 'Temný mág', aku: 'temného mága', rod: 'm', od: 13, do: 34, hp: 44, utok: [5, 9], obrana: 1, presnost: 0.72,
      zk: 40, rychlost: 1, uteka: 0.2, dvere: true, spi: 0.3, vaha: 3,
      strelec: { dosah: 5, sance: 0.55, utok: [8, 14], nazev: 'temný blesk' }, drzOdstup: true,
      utokText: 'tě udeřil holí', minulText: 'máchl holí vedle', smrtText: 'Mág se rozpadl v hromádku popela.',
      pricina: ['temný mág, který si na tobě zkoušel nové kouzlo', 'kouzlo, které se nedalo odrazit'],
    },
    // 21–30 trpasličí doly (golemové, démoni)
    golem: {
      nom: 'Kamenný golem', aku: 'kamenného golema', rod: 'm', od: 21, do: 40, hp: 190, utok: [14, 22], obrana: 6, presnost: 0.7,
      zk: 70, rychlost: 0.5, uteka: 0, dvere: false, spi: 0.5, vaha: 3,
      utokText: 'tě rozdrtil kamennou pěstí', minulText: 'udeřil do země vedle tebe', smrtText: 'Golem se rozpadl na hromadu kamení.',
      pricina: ['kamenný golem – nedalo se mu uhnout, jen ho unavit', 'pěst velká jako sud'],
    },
    demon: {
      nom: 'Démon', aku: 'démona', rod: 'm', od: 21, do: 44, hp: 130, utok: [13, 21], obrana: 4, presnost: 0.76,
      zk: 80, rychlost: 1.2, uteka: 0, dvere: true, spi: 0.2, vaha: 4,
      utokText: 'tě rozsekl drápy', minulText: 'zasyčel a minul', smrtText: 'Démon se s jekem propadl zpět do pekel.',
      pricina: ['démon z hlubin, který si přišel pro tvou duši', 'drápy ostré jako tvá lítost'],
    },
    // 31–40 krypta (přízraky, kostliví rytíři)
    prizrak: {
      nom: 'Přízrak', aku: 'přízrak', rod: 'm', od: 31, do: 50, hp: 160, utok: [16, 25], obrana: 5, presnost: 0.78,
      zk: 110, rychlost: 1, uteka: 0, dvere: true, spi: 0.3, vaha: 4, vysava: true,
      utokText: 'ti vysál kus života', minulText: 'proletěl skrz tebe naprázdno', smrtText: 'Přízrak se se steskem rozplynul.',
      pricina: ['přízrak, který ti vzal dech', 'studený dotek z onoho světa'],
    },
    rytir: {
      nom: 'Kostlivý rytíř', aku: 'kostlivého rytíře', rod: 'm', od: 31, do: 50, hp: 230, utok: [20, 30], obrana: 8, presnost: 0.76,
      zk: 120, rychlost: 0.8, uteka: 0, dvere: true, spi: 0.4, vaha: 4,
      utokText: 'tě ťal rezavým mečem', minulText: 'zarachotil brněním a minul', smrtText: 'Kostlivý rytíř se zřítil v hromadě plechu a kostí.',
      pricina: ['kostlivý rytíř, věrný svému pánovi i po smrti', 'meč, který staletí čekal právě na tebe'],
    },
    // 41–50 lávové podzemí (ohniváci, pekelní psi)
    ohnivak: {
      nom: 'Ohnivák', aku: 'ohniváka', rod: 'm', od: 41, do: 999, hp: 260, utok: [24, 34], obrana: 7, presnost: 0.78,
      zk: 160, rychlost: 1, uteka: 0, dvere: false, spi: 0.2, vaha: 4,
      strelec: { dosah: 4, sance: 0.45, utok: [22, 32], nazev: 'ohnivá koule' },
      utokText: 'tě sežehl plamenem', minulText: 'zasyčel plameny kolem tebe', smrtText: 'Ohnivák zhasl jako svíčka.',
      pricina: ['ohnivák – teplo, které nebylo útulné', 'plamen, který si nevybíral'],
    },
    pes: {
      nom: 'Pekelný pes', aku: 'pekelného psa', rod: 'm', od: 41, do: 999, hp: 200, utok: [22, 32], obrana: 6, presnost: 0.8,
      zk: 150, rychlost: 1.6, uteka: 0, dvere: false, spi: 0.3, vaha: 4,
      utokText: 'tě kousl ohnivými zuby', minulText: 'chňapl vedle', smrtText: 'Pekelný pes zavyl a rozpadl se v jiskry.',
      pricina: ['pekelný pes, který nechtěl aportovat', 'tři řady zubů a žádná výchova'],
    },
    // 51+ podivno
    bezejmenny: {
      nom: 'Bezejmenné', aku: 'Bezejmenné', rod: 's', od: 51, do: 999, hp: 400, utok: [30, 44], obrana: 10, presnost: 0.8,
      zk: 260, rychlost: 1, uteka: 0, dvere: true, spi: 0.6, vaha: 5,
      utokText: 'tě pohltilo pohledem', minulText: 'zamžouralo a zaváhalo', smrtText: 'Bezejmenné se rozplynulo. Bylo vůbec?',
      pricina: ['něco, co jsi měl nechat spát', 'Bezejmenné. Víc o tom nevíme.'],
    },

    // --- bossové (každé 10. patro; do náhodných potvor se nedostanou) ---
    krysiKral: {
      nom: 'Krysí král', aku: 'Krysího krále', rod: 'm', od: 10, do: 0, hp: 150, utok: [6, 11], obrana: 2, presnost: 0.76,
      zk: 150, rychlost: 1, uteka: 0, dvere: true, spi: 1, vaha: 0, boss: true,
      vola: { druh: 'krysa', kazdych: 4, max: 4, pocet: 2 },
      vstup: 'Na trůnu z kostí sedí Krysí král. Kolem se hemží jeho poddaní…',
      utokText: 'tě rozdrásal zažloutlými zuby', minulText: 'zapištěl vzteky', smrtText: 'Krysí král padl! Jeho poddaní se rozprchli.',
      pricina: ['Krysí král a jeho věrný lid', 'korunovaná krysa s armádou za zády'],
    },
    kapitan: {
      nom: 'Utopený kapitán', aku: 'Utopeného kapitána', rod: 'm', od: 20, do: 0, hp: 360, utok: [12, 20], obrana: 4, presnost: 0.76,
      zk: 360, rychlost: 1, uteka: 0, dvere: true, spi: 1, vaha: 0, boss: true,
      strelec: { dosah: 4, sance: 0.35, utok: [12, 18], nazev: 'proud ledové vody' },
      vola: { druh: 'utopenec', kazdych: 6, max: 2, pocet: 1 },
      vstup: 'Z černé vody se zvedá Utopený kapitán. Jeho posádka ho neopustila ani po smrti.',
      utokText: 'tě ťal zrezivělou šavlí', minulText: 'zachrčel a minul', smrtText: 'Utopený kapitán se konečně vydal na poslední plavbu.',
      pricina: ['Utopený kapitán, který nikdy nevydal svou loď', 'ledový proud z hlubin'],
    },
    kovar: {
      nom: 'Kovář golemů', aku: 'Kováře golemů', rod: 'm', od: 30, do: 0, hp: 620, utok: [22, 34], obrana: 9, presnost: 0.76,
      zk: 700, rychlost: 0.8, uteka: 0, dvere: true, spi: 1, vaha: 0, boss: true,
      vola: { druh: 'golem', kazdych: 8, max: 2, pocet: 1 },
      vstup: 'V záři výhně buší Kovář golemů do rozžhaveného kamene. Otáčí se k tobě.',
      utokText: 'tě udeřil obřím kladivem', minulText: 'kladivo dopadlo vedle tebe', smrtText: 'Kovář golemů se zřítil a výheň pohasla.',
      pricina: ['Kovář golemů – a jeho kladivo', 'rozžhavené kladivo z hlubin dolů'],
    },
    lich: {
      nom: 'Lich', aku: 'Licha', rod: 'm', od: 40, do: 0, hp: 700, utok: [20, 30], obrana: 8, presnost: 0.78,
      zk: 1000, rychlost: 1, uteka: 0, dvere: true, spi: 1, vaha: 0, boss: true, drzOdstup: true,
      strelec: { dosah: 6, sance: 0.5, utok: [26, 38], nazev: 'mrazivé kouzlo' },
      vola: { druh: 'rytir', kazdych: 7, max: 2, pocet: 1 },
      vstup: 'Lich zvedá kostnatou ruku. „Další duše do mé sbírky…"',
      utokText: 'tě udeřil žezlem', minulText: 'zasyčel kletbu naprázdno', smrtText: 'Lich se s kvílením rozpadl na prach.',
      pricina: ['Lich, sběratel duší', 'kletba starší než samo podzemí'],
    },
    ohnivyDemon: {
      nom: 'Ohnivý démon', aku: 'Ohnivého démona', rod: 'm', od: 50, do: 0, hp: 1100, utok: [34, 48], obrana: 11, presnost: 0.8,
      zk: 1500, rychlost: 1.1, uteka: 0, dvere: true, spi: 1, vaha: 0, boss: true,
      strelec: { dosah: 4, sance: 0.35, utok: [30, 42], nazev: 'pekelný oheň' },
      vola: { druh: 'ohnivak', kazdych: 8, max: 2, pocet: 1 },
      vstup: 'Láva se rozestupuje a z ní vystupuje Ohnivý démon.',
      utokText: 'tě sevřel žhnoucími pařáty', minulText: 'zařval plameny', smrtText: 'Ohnivý démon se s rachotem propadl do lávy.',
      pricina: ['Ohnivý démon, pán lávových hlubin', 'plameny, které nikdy nehasnou'],
    },
    srdce: {
      nom: 'Srdce hlubin', aku: 'Srdce hlubin', rod: 's', od: 60, do: 0, hp: 1600, utok: [40, 56], obrana: 12, presnost: 0.82,
      zk: 2500, rychlost: 1, uteka: 0, dvere: true, spi: 1, vaha: 0, boss: true,
      vola: { druh: 'bezejmenny', kazdych: 7, max: 2, pocet: 1 },
      vstup: 'Něco tu tepe. Pomalu. Hluboko. Srdce hlubin tě vidí.',
      utokText: 'tě zasáhlo vlnou temnoty', minulText: 'zatepalo naprázdno', smrtText: 'Srdce hlubin se zastavilo. Na okamžik je ticho.',
      pricina: ['Srdce hlubin – tam, kde podzemí končí a začíná něco jiného', 'tep, který přehlušil ten tvůj'],
    },
  };
  const BOSSOVE = ['krysiKral', 'kapitan', 'kovar', 'lich', 'ohnivyDemon', 'srdce'];
  const bossZiv = s => s.potvory.some(m => BESTIAR[m.druh].boss);

  // --- předměty -------------------------------------------------
  // Základní druhy: `lvl` = od jaké úrovně předmětu se může objevit. Zbraně: min–max, rychlost (tahy), dosah (luk).
  const ZAKLADY = {
    // meče
    mec1: { typ: 'zbran', ikona: 'mec', nazev: 'Rezavý meč', lvl: 1, min: 3, max: 7, rychlost: 1 },
    mec2: { typ: 'zbran', ikona: 'mec', nazev: 'Železný meč', lvl: 4, min: 5, max: 10, rychlost: 1 },
    mec3: { typ: 'zbran', ikona: 'mec', nazev: 'Trpasličí čepel', lvl: 9, min: 7, max: 14, rychlost: 1 },
    mec4: { typ: 'zbran', ikona: 'mec', nazev: 'Ohnivý meč', lvl: 15, min: 9, max: 17, rychlost: 1, ohen: 3 },
    mec5: { typ: 'zbran', ikona: 'mec', nazev: 'Čepel hlubin', lvl: 24, min: 12, max: 22, rychlost: 1 },
    // dýky – slabší, ale přesnější
    dyka1: { typ: 'zbran', ikona: 'dyka', nazev: 'Dýka', lvl: 1, min: 2, max: 5, rychlost: 1, presnost: 10 },
    dyka2: { typ: 'zbran', ikona: 'dyka', nazev: 'Ocelová dýka', lvl: 6, min: 4, max: 8, rychlost: 1, presnost: 10 },
    dyka3: { typ: 'zbran', ikona: 'dyka', nazev: 'Stínová dýka', lvl: 14, min: 6, max: 12, rychlost: 1, presnost: 15 },
    // sekery – silné, ale útok trvá dva tahy
    sekera1: { typ: 'zbran', ikona: 'sekera', nazev: 'Sekera', lvl: 3, min: 6, max: 13, rychlost: 2 },
    sekera2: { typ: 'zbran', ikona: 'sekera', nazev: 'Válečná sekera', lvl: 10, min: 10, max: 19, rychlost: 2 },
    sekera3: { typ: 'zbran', ikona: 'sekera', nazev: 'Trpasličí sekera', lvl: 18, min: 14, max: 26, rychlost: 2 },
    // luky – střílí přes více polí, potřebují šípy
    luk1: { typ: 'zbran', ikona: 'luk', nazev: 'Krátký luk', lvl: 2, min: 2, max: 6, rychlost: 1, dosah: 4 },
    luk2: { typ: 'zbran', ikona: 'luk', nazev: 'Dlouhý luk', lvl: 8, min: 4, max: 9, rychlost: 1, dosah: 6 },
    luk3: { typ: 'zbran', ikona: 'luk', nazev: 'Elfí luk', lvl: 16, min: 6, max: 13, rychlost: 1, dosah: 7 },
    // ochrana
    stit1: { typ: 'stit', ikona: 'stit', nazev: 'Dřevěný štít', lvl: 1, obrana: 1 },
    stit2: { typ: 'stit', ikona: 'stit', nazev: 'Kovaný štít', lvl: 6, obrana: 2 },
    stit3: { typ: 'stit', ikona: 'stit', nazev: 'Věžový štít', lvl: 14, obrana: 3, zdravi: 5 },
    helma1: { typ: 'helma', ikona: 'helma', nazev: 'Kožená čapka', lvl: 1, obrana: 1 },
    helma2: { typ: 'helma', ikona: 'helma', nazev: 'Železná přilba', lvl: 7, obrana: 2 },
    helma3: { typ: 'helma', ikona: 'helma', nazev: 'Rohatá helma', lvl: 15, obrana: 3 },
    brneni1: { typ: 'brneni', ikona: 'brneni', nazev: 'Prošívanice', lvl: 1, obrana: 1 },
    brneni2: { typ: 'brneni', ikona: 'brneni', nazev: 'Kroužková zbroj', lvl: 5, obrana: 2 },
    brneni3: { typ: 'brneni', ikona: 'brneni', nazev: 'Plátová zbroj', lvl: 12, obrana: 4 },
    brneni4: { typ: 'brneni', ikona: 'brneni', nazev: 'Mithrilová košile', lvl: 22, obrana: 5 },
    boty1: { typ: 'boty', ikona: 'boty', nazev: 'Kožené boty', lvl: 1, obrana: 0, zdravi: 3 },
    boty2: { typ: 'boty', ikona: 'boty', nazev: 'Okované boty', lvl: 8, obrana: 1 },
    amulet: { typ: 'amulet', ikona: 'amulet', nazev: 'Amulet', lvl: 3, zdravi: 5 },
    prsten: { typ: 'prsten', ikona: 'prsten', nazev: 'Prsten', lvl: 2 },
    // spotřební
    chleb: { typ: 'jidlo', ikona: 'chleb', nazev: 'Chléb', lvl: 1, syti: 35 },
    pochoden: { typ: 'pochoden', ikona: 'pochoden', nazev: 'Pochodeň', lvl: 1, palivo: 500 },
    maso: { typ: 'jidlo', ikona: 'maso', nazev: 'Pečené maso', lvl: 1, syti: 50 },
    jablko: { typ: 'jidlo', ikona: 'jablko', nazev: 'Jablko', lvl: 1, syti: 15 },
    sipy: { typ: 'sipy', ikona: 'sipy', nazev: 'Šípy', lvl: 1 },
    lektvar: { typ: 'lektvar', ikona: 'lektvar', nazev: 'Lektvar', lvl: 1 },
    kniha: { typ: 'kniha', ikona: 'kniha', nazev: 'Stará kniha', lvl: 1 },
    // magie: svitek = jedno použití, hůlka = několik nábojů; síla roste s magií
    svitekOhen: { typ: 'svitek', ikona: 'svitek', nazev: 'Svitek ohnivé koule', lvl: 1, kouzlo: 'ohen' },
    svitekLeceni: { typ: 'svitek', ikona: 'svitek', nazev: 'Svitek léčení', lvl: 1, kouzlo: 'leceni' },
    svitekTeleport: { typ: 'svitek', ikona: 'svitek', nazev: 'Svitek přemístění', lvl: 2, kouzlo: 'teleport' },
    svitekMapa: { typ: 'svitek', ikona: 'svitek', nazev: 'Svitek jasnozření', lvl: 2, kouzlo: 'mapa' },
    svitekOdkleti: { typ: 'svitek', ikona: 'svitek', nazev: 'Svitek sejmutí kletby', lvl: 3, kouzlo: 'odkleti' },
    hulkaOhen: { typ: 'hulka', ikona: 'hulka', nazev: 'Hůlka ohně', lvl: 5, kouzlo: 'ohen' },
    hulkaBlesk: { typ: 'hulka', ikona: 'hulka', nazev: 'Hůlka blesků', lvl: 8, kouzlo: 'blesk' },
    hulkaLeceni: { typ: 'hulka', ikona: 'hulka', nazev: 'Hůlka hojení', lvl: 10, kouzlo: 'leceni' },
    klic: { typ: 'klic', ikona: 'klic', nazev: 'Klíč od pokladnice', lvl: 1 },
  };
  const SLOTY = ['zbran', 'luk', 'stit', 'helma', 'brneni', 'boty', 'amulet', 'prsten1', 'prsten2'];
  const MAX_BATOH = 16;
  // větší batohy od obchodníka – kupují se postupně, každý přidá místa k základním 16
  const BATOHY = [
    { nazev: 'Kožená brašna', navic: 4, cena: 150 },
    { nazev: 'Cestovní vak', navic: 8, cena: 400 },
    { nazev: 'Trpasličí krosna', navic: 12, cena: 900 },
  ];
  const kapacita = s => MAX_BATOH + ((BATOHY[(s.hrac.batohStupen || 0) - 1] || {}).navic || 0);
  // v ruce je buď zbraň na blízko, nebo luk (přehazuje se klávesou R)
  const drziLuk = s => s.hrac.drzi === 'luk' && !!s.hrac.vybava.luk;
  const vRuce = s => drziLuk(s) ? s.hrac.vybava.luk : s.hrac.vybava.zbran;
  const VZACNOSTI = [
    { nazev: 'Běžná kvalita', barva: '#c8c8c8' },
    { nazev: 'Neobvyklá kvalita', barva: '#5fd35f' },
    { nazev: 'Vzácná kvalita', barva: '#4fa0ff' },
    { nazev: 'Epická kvalita', barva: '#b565ff' },
    { nazev: 'Legendární kvalita', barva: '#ff9a30' },
  ];
  // kletby: skrytá nevýhoda prokletého předmětu (dokud ho neneseš, nevíš o ní)
  const KLETBY = {
    slabost: { nazev: 'kletba slabosti', text: 'Síla −2' },
    zranitelnost: { nazev: 'kletba zranitelnosti', text: 'Obrana −2' },
    hlad: { nazev: 'kletba hladu', text: 'Hlad přichází dvakrát rychleji' },
  };
  const KLETBY_KLICE = Object.keys(KLETBY);

  // náhodné vlastnosti: jméno přípony (genitiv) a síla podle úrovně předmětu
  const VLASTNOSTI = {
    sila: { pripona: 'síly', text: 'Síla', hodnota: l => 1 + Math.floor(l / 6) },
    obrana: { pripona: 'odolnosti', text: 'Obrana', hodnota: l => 1 + Math.floor(l / 8) },
    magie: { pripona: 'moudrosti', text: 'Magie', hodnota: l => 1 + Math.floor(l / 6) },
    zdravi: { pripona: 'života', text: 'Zdraví', hodnota: l => 4 + Math.floor(l * 0.8) },
    presnost: { pripona: 'přesnosti', text: 'Přesnost', hodnota: l => 5 + Math.floor(l / 3), jednotka: ' %' },
    ohen: { pripona: 'plamene', text: 'Oheň', hodnota: l => 1 + Math.floor(l / 4), jenZbran: true },
  };
  // lektvary: barva se každou výpravu zamíchá, druh se pozná až napitím
  const LEKTVARY = {
    leceni: { nazev: 'Lektvar léčení', vaha: 5 },
    velkeLeceni: { nazev: 'Lektvar velkého léčení', vaha: 1.5, od: 5 },
    sila: { nazev: 'Lektvar síly', vaha: 0.8 },
    odolnost: { nazev: 'Lektvar odolnosti', vaha: 0.8 },
    zkusenost: { nazev: 'Lektvar zkušenosti', vaha: 1 },
    sytost: { nazev: 'Lektvar sytosti', vaha: 1.2 },
    osviceni: { nazev: 'Lektvar osvícení', vaha: 1 },
    jed: { nazev: 'Jed', vaha: 1.3 },
  };
  const BARVY_LEKTVARU = [
    ['Rudý', '#d03030'], ['Zelený', '#40b040'], ['Modrý', '#3070e0'], ['Zlatavý', '#e0b030'], ['Kalný', '#7a6a40'],
    ['Mléčný', '#e8e8e0'], ['Černý', '#3a3040'], ['Stříbrný', '#b0b8c8'], ['Růžový', '#e070b0'],
  ];

  function vazenyVyber(s, polozky) {                 // [[klic, vaha], …]
    const soucet = polozky.reduce((a, p) => a + p[1], 0);
    let r = Rs(s) * soucet;
    for (const [k, v] of polozky) { r -= v; if (r <= 0) return k; }
    return polozky[polozky.length - 1][0];
  }

  function novyPredmet(s, zaklad, o) {
    const z = ZAKLADY[zaklad];
    const p = { id: s.dalsiId = (s.dalsiId || 0) + 1, zaklad, typ: z.typ, uroven: (o && o.uroven) || 1, vzacnost: 0, bonusy: {} };
    if (z.typ === 'sipy') p.pocet = (o && o.pocet) || 10;
    if (z.typ === 'lektvar') p.lektvar = (o && o.lektvar) || 'leceni';
    return p;
  }

  // Náhodný předmět úrovně `uroven`; `druh` omezí výběr ('zbran', 'ochrana', 'jidlo', 'lektvar', …).
  function nahodnyPredmet(s, uroven, druh) {
    uroven = Math.max(1, uroven);
    if (!druh) druh = vazenyVyber(s, [['zbran', 2.2], ['ochrana', 3], ['sperk', 1], ['jidlo', 2.4], ['lektvar', 2.6], ['sipy', 0.8], ['magie', 1.4], ['svetlo', 1.2]]);
    if (druh === 'magie') {
      const mozne = Object.keys(ZAKLADY).filter(k => (ZAKLADY[k].typ === 'svitek' || ZAKLADY[k].typ === 'hulka') && ZAKLADY[k].lvl <= uroven);
      const zaklad = vazenyVyber(s, mozne.map(k => [k, ZAKLADY[k].typ === 'hulka' ? 0.6 : k === 'svitekOhen' || k === 'svitekLeceni' ? 2 : 1]));
      const p = novyPredmet(s, zaklad, { uroven });
      if (p.typ === 'hulka') p.naboje = Ri(s, 3, 6);
      return p;
    }
    if (druh === 'jidlo') return novyPredmet(s, vazenyVyber(s, [['chleb', 3], ['maso', 2], ['jablko', 2]]));
    if (druh === 'svetlo') return novyPredmet(s, 'pochoden');
    if (druh === 'sipy') return novyPredmet(s, 'sipy', { pocet: Ri(s, 6, 14) });
    if (druh === 'lektvar') {
      const lk = vazenyVyber(s, Object.keys(LEKTVARY).filter(k => !LEKTVARY[k].od || uroven >= LEKTVARY[k].od).map(k => [k, LEKTVARY[k].vaha]));
      return novyPredmet(s, 'lektvar', { lektvar: lk });
    }
    const typy = druh === 'zbran' ? ['zbran'] : druh === 'sperk' ? ['amulet', 'prsten'] : ['stit', 'helma', 'brneni', 'boty'];
    // z dostupných základů víc váží ty „nejnovější" pro danou úroveň
    let moznosti = Object.keys(ZAKLADY).filter(k => typy.includes(ZAKLADY[k].typ) && ZAKLADY[k].lvl <= uroven);
    if (!moznosti.length) {                        // na mělkých patrech ještě nic – vezmi nejnižší
      const vse = Object.keys(ZAKLADY).filter(k => typy.includes(ZAKLADY[k].typ));
      const min = Math.min(...vse.map(k => ZAKLADY[k].lvl));
      moznosti = vse.filter(k => ZAKLADY[k].lvl === min);
    }
    const zaklad = vazenyVyber(s, moznosti.map(k => [k, 1 + Math.max(0, 6 - (uroven - ZAKLADY[k].lvl)) * 0.6]));
    const p = novyPredmet(s, zaklad, { uroven });
    // vzácnost: hlubší patra dávají lepší šance
    const r = Rs(s), posun = Math.min(0.25, uroven * 0.008);
    p.vzacnost = r < 0.012 + posun * 0.2 ? 4 : r < 0.05 + posun * 0.5 ? 3 : r < 0.16 + posun ? 2 : r < 0.42 + posun ? 1 : 0;
    if (ZAKLADY[zaklad].typ === 'prsten' || ZAKLADY[zaklad].typ === 'amulet') p.vzacnost = Math.max(1, p.vzacnost);
    // prokletí: láká vyšší kvalitou, pravda vyjde najevo až po nasazení
    if (Rs(s) < Math.min(0.2, 0.08 + 0.003 * uroven)) {
      p.prokleti = KLETBY_KLICE[Ri(s, 0, KLETBY_KLICE.length - 1)];
      p.odhaleno = false;
      p.vzacnost = Math.min(4, p.vzacnost + 1);
    }
    const klice = Object.keys(VLASTNOSTI).filter(k => !VLASTNOSTI[k].jenZbran || ZAKLADY[zaklad].typ === 'zbran');
    for (let i = 0; i < p.vzacnost; i++) {
      const k = klice[Ri(s, 0, klice.length - 1)];
      p.bonusy[k] = (p.bonusy[k] || 0) + VLASTNOSTI[k].hodnota(uroven);
    }
    return p;
  }

  function nazevPredmetu(s, p) {
    const n = nazevBezKletby(s, p);
    return p.prokleti && p.odhaleno ? n + ' ☠' : n;
  }
  function nazevBezKletby(s, p) {
    const z = ZAKLADY[p.zaklad];
    if (p.typ === 'svitek' && s.znameSvitky && !s.znameSvitky.includes(p.zaklad)) return `Svitek „${s.napisySvitku[p.zaklad]}"`;
    if (p.typ === 'lektvar') {
      return s.zname && s.zname.includes(p.lektvar) ? LEKTVARY[p.lektvar].nazev : `${s.barvyLektvaru[p.lektvar][0]} lektvar`;
    }
    if (p.typ === 'sipy') return `Šípy (${p.pocet})`;
    if (p.typ === 'hulka') return `${z.nazev} (${p.naboje})`;
    const klice = Object.keys(p.bonusy);
    if (!klice.length) return z.nazev;
    klice.sort((a, b) => p.bonusy[b] - p.bonusy[a]);
    return `${z.nazev} ${VLASTNOSTI[klice[0]].pripona}`;
  }

  // vlastnosti předmětu pro popis a srovnání (klic → hodnota)
  function vlastnostiPredmetu(p) {
    const z = ZAKLADY[p.zaklad], out = {}, n = 1 + 0.12 * p.vzacnost;
    if (z.typ === 'zbran') {
      out.min = Math.round(z.min * n); out.max = Math.round(z.max * n);
      out.rychlost = z.rychlost;
      if (z.dosah) out.dosah = z.dosah;
    }
    if (z.obrana !== undefined) out.obrana = z.obrana + (p.vzacnost >= 3 ? 1 : 0);
    for (const k of ['zdravi', 'presnost', 'ohen']) if (z[k]) out[k] = z[k];
    for (const k in p.bonusy) out[k] = (out[k] || 0) + p.bonusy[k];
    if (z.syti) out.syti = z.syti;
    return out;
  }

  // jedno číslo „jak je to dobré" – pro šipku lepší/horší a pro bota
  function skorePredmetu(p) {
    if (!p) return 0;
    const v = vlastnostiPredmetu(p);
    let sk = p.prokleti && p.odhaleno ? -8 : 0;
    if (v.max) sk += ((v.min + v.max) / 2 + (v.ohen || 0)) / v.rychlost * (v.dosah ? 0.8 : 1) * 2;
    sk += (v.obrana || 0) * 3 + (v.sila || 0) * 2.5 + (v.zdravi || 0) * 0.4 + (v.presnost || 0) * 0.15 + (v.magie || 0) * 0.8;
    return sk;
  }

  function slotPro(p) {
    if (p.typ === 'zbran' && ZAKLADY[p.zaklad].dosah) return 'luk';
    return p.typ === 'prsten' ? 'prsten' : SLOTY.includes(p.typ) ? p.typ : null;
  }

  // hodnoty hráče včetně výbavy
  function odvozene(s) {
    const h = s.hrac, v = h.vybava, o = { sila: h.sila, obrana: h.obrana, magie: h.magie, maxHp: h.maxHp, presnost: 0, ohen: 0 };
    const vPouzdre = drziLuk(s) ? 'zbran' : 'luk';   // zbraň, která není v ruce, bonusy nedává
    for (const slot of SLOTY) {
      const p = v[slot];
      if (!p || slot === vPouzdre) continue;
      const w = vlastnostiPredmetu(p);
      o.sila += w.sila || 0; o.obrana += w.obrana || 0; o.magie += w.magie || 0;
      o.maxHp += w.zdravi || 0; o.presnost += w.presnost || 0; o.ohen += w.ohen || 0;
    }
    if (ma(s, 'tuhy')) o.maxHp += 15;
    if (ma(s, 'mag')) o.magie += 2;
    if (ma(s, 'stitonos') && v.stit) o.obrana += 1;
    o.hladovost = ma(s, 'skromny') ? 0.5 : 1;
    for (const slot of SLOTY) {
      const k = v[slot] && v[slot].prokleti;
      if (k === 'slabost') o.sila -= 2;
      else if (k === 'zranitelnost') o.obrana -= 2;
      else if (k === 'hlad') o.hladovost *= 2;
    }
    const ruka = vRuce(s);
    const zb = ruka ? vlastnostiPredmetu(ruka) : { min: 1, max: 3, rychlost: 1 };   // pěsti
    o.zbran = { min: zb.min, max: zb.max, rychlost: zb.rychlost, dosah: zb.dosah ? zb.dosah + (ma(s, 'lukostrelec') ? 2 : 0) : 0, nazev: ruka ? nazevPredmetu(s, ruka) : 'Pěsti' };
    o.sipy = h.batoh.filter(p => p.typ === 'sipy').reduce((a, p) => a + p.pocet, 0);
    return o;
  }
  function srovnejZdravi(s) { const m = odvozene(s).maxHp; if (s.hrac.hp > m) s.hrac.hp = m; }

  // přidat do batohu; šípy se sčítají; vrací false, když je plno
  function doBatohu(s, p) {
    const b = s.hrac.batoh;
    if (p.typ === 'sipy') {
      const st = b.find(q => q.typ === 'sipy');
      if (st) { st.pocet += p.pocet; return true; }
    }
    if (b.length >= kapacita(s)) return false;
    b.push(p);
    return true;
  }

  // --- truhly a věci na zemi -----------------------------------------
  function rozmistiKorist(s) {
    const p = s.mapaPatra, R = nahoda(smichej(s.seed ^ 0x7EA5, p.patro));
    const startM = p.mistnostId[p.start.y * p.w + p.start.x];
    const volne = (x, y) => {
      const i = y * p.w + x;
      if (p.mapa[i] !== T.PODLAHA) return false;
      const mid = p.mistnostId[i];
      if (mid >= 0 && (p.mistnosti[mid].tajna || p.mistnosti[mid].ucel === 'pokladnice')) return false;
      if (s.potvory.some(m => m.x === x && m.y === y) || prekazkaNa(s, x, y) || pastNa(s, x, y)) return false;
      if (s.zeme.some(z => z.x === x && z.y === y) || teleportNa(s, x, y)) return false;
      for (const d of p.dvere) if (Math.abs(d.x - x) + Math.abs(d.y - y) <= 1) return false;
      return !(p.dolu.x === x && p.dolu.y === y) && !(p.start.x === x && p.start.y === y);
    };
    // truhly ke zdi místností (ne do startovní), víc v hloubce
    const pocet = Math.min(4, 1 + (R.f() < 0.5 ? 1 : 0) + Math.floor(p.patro / 8));
    const mistnosti = p.mistnosti.filter(m => m.id !== startM);
    const predem = s.truhly.length;                 // truhly z hrobek, doupat a pokladnic se nepočítají
    for (let k = 0; k < pocet * 15 && s.truhly.length - predem < pocet; k++) {
      const m = mistnosti[Math.floor(R.f() * mistnosti.length)];
      const u = R.f() < 0.5;
      const x = u ? m.x + Math.floor(R.f() * m.w) : (R.f() < 0.5 ? m.x : m.x + m.w - 1);
      const y = u ? (R.f() < 0.5 ? m.y : m.y + m.h - 1) : m.y + Math.floor(R.f() * m.h);
      if (!volne(x, y)) continue;
      s.truhly.push({ x, y, otevrena: false });
      if (!souvisle(s)) s.truhly.pop();             // truhla nesmí nic odříznout
    }
    // pár drobností volně na zemi (jídlo, lektvar, šípy)
    const drobnosti = 1 + (R.f() < 0.6 ? 1 : 0);
    for (let k = 0; k < 40 && s.zeme.length < drobnosti; k++) {
      const m = p.mistnosti[Math.floor(R.f() * p.mistnosti.length)];
      const x = m.x + Math.floor(R.f() * m.w), y = m.y + Math.floor(R.f() * m.h);
      if (!volne(x, y) || s.zeme.some(z => z.x === x && z.y === y)) continue;
      s.zeme.push({ x, y, predmety: [nahodnyPredmet(s, p.patro, R.f() < 0.5 ? 'jidlo' : R.f() < 0.7 ? 'lektvar' : 'sipy')], zlato: 0 });
    }
  }
  const truhlaNa = (s, x, y) => s.truhly && s.truhly.find(t => t.x === x && t.y === y);

  function polozNaZem(s, x, y, predmety, zlato) {
    let z = s.zeme.find(q => q.x === x && q.y === y);
    if (!z) { z = { x, y, predmety: [], zlato: 0 }; s.zeme.push(z); }
    z.predmety.push(...predmety); z.zlato += zlato || 0;
  }

  // hráč vstoupil na pole: zlato vždy, předměty dokud je místo
  function seberZeZeme(s, ud) {
    const i = s.zeme.findIndex(z => z.x === s.x && z.y === s.y);
    if (i < 0) return;
    const z = s.zeme[i];
    if (z.zlato) { s.zlato += z.zlato; ud.push({ typ: 'zlato', kolik: z.zlato }); z.zlato = 0; }
    const zbyva = [];
    for (const p of z.predmety) {
      if (doBatohu(s, p)) ud.push({ typ: 'sebral', predmet: p, nazev: nazevPredmetu(s, p) });
      else zbyva.push(p);
    }
    if (zbyva.length) ud.push({ typ: 'plno', pocet: zbyva.length });
    z.predmety = zbyva;
    if (!zbyva.length) s.zeme.splice(i, 1);
  }

  function otevriTruhlu(s, t, ud) {
    t.otevrena = true;
    const lvl = s.patro + Ri(s, 0, 2) + (t.bonus || 0) + (ma(s, 'stastlivec') ? 2 : 0);
    const kolik = Ri(s, 1, 2) + (Rs(s) < 0.25 ? 1 : 0);
    const obsah = [];
    for (let i = 0; i < kolik; i++) obsah.push(nahodnyPredmet(s, lvl, i === 0 ? vazenyVyber(s, [['zbran', 3], ['ochrana', 4], ['sperk', 1.5], ['lektvar', 2]]) : undefined));
    const zlato = Math.round((Ri(s, 3, 12) * s.patro + Ri(s, 0, 10)) * (1 + (t.bonus || 0)) * (ma(s, 'stastlivec') ? 1.5 : 1));
    ud.push({ typ: 'truhla', x: t.x, y: t.y });
    s.zlato += zlato;
    ud.push({ typ: 'zlato', kolik: zlato });
    const zbyva = [];
    for (const p of obsah) {
      if (doBatohu(s, p)) ud.push({ typ: 'sebral', predmet: p, nazev: nazevPredmetu(s, p) });
      else zbyva.push(p);
    }
    if (zbyva.length) { polozNaZem(s, s.x, s.y, zbyva, 0); ud.push({ typ: 'plno', pocet: zbyva.length }); }
  }

  // kořist po zabité potvoře
  function korist(s, m, ud) {
    const predmety = [];
    let zlato = 0;
    if (Rs(s) < 0.4) zlato = Math.round((Ri(s, 1, 6) * s.patro + Ri(s, 0, 5)) * (ma(s, 'stastlivec') ? 1.5 : 1));
    if (Rs(s) < 0.22) predmety.push(nahodnyPredmet(s, s.patro));
    else if (Rs(s) < 0.12) predmety.push(nahodnyPredmet(s, s.patro, 'jidlo'));
    if (predmety.length || zlato) { polozNaZem(s, m.x, m.y, predmety, zlato); ud.push({ typ: 'korist', x: m.x, y: m.y }); }
  }

  // --- místnosti s účelem, překážky, pasti ------------------------------
  const UCELY = {
    hrobka: { nazev: 'Hrobka', od: 3, vaha: 1.2, vstup: 'Vstupuješ do hrobky. Kamenné rakve, prach a ticho.' },
    skladiste: { nazev: 'Skladiště', od: 1, vaha: 1.3, vstup: 'Staré skladiště – sudy, bedny a myší trus.' },
    knihovna: { nazev: 'Knihovna', od: 2, vaha: 1, vstup: 'Knihovna! Police plné plesnivých svazků.' },
    kobka: { nazev: 'Kobka', od: 2, vaha: 1, vstup: 'Kobka. Rezavé klece a pach strachu.' },
    svatyne: { nazev: 'Svatyně', od: 1, vaha: 0.8, max: 1, vstup: 'Svatyně. Na oltáři mihotá věčné světlo.' },
    doupe: { nazev: 'Doupě', od: 2, vaha: 0.9, max: 1, vstup: 'Tady něco žije. Všude kolem se válí kosti…' },
    mriz: { nazev: 'Místnost za mříží', od: 999, vaha: 0, vstup: 'Místnost za mříží. Páka udělala svou práci.' },
    obchod: { nazev: 'Obchod', od: 999, vaha: 0, vstup: 'Obchod! „Vítej, poutníku. Zlato se hodí i v hlubinách."' },
    pokladnice: { nazev: 'Pokladnice', od: 3, vaha: 0.9, max: 1, vstup: 'Pokladnice! Zlato se třpytí ve světle louče.' },
  };
  // překážky; `kosti` jsou jen na zemi a neblokují
  const DEKORACE = {
    obchodnik: 'obchodník', rakev: 'kamenná rakev', sud: 'sud', bedna: 'bedna', police: 'police s knihami', oltar: 'oltář', klec: 'klec', kosti: 'kosti',
  };
  const PASTI = {
    jama: { nazev: 'jáma', vaha: 0.3 },
    sipky: { nazev: 'šipková past', vaha: 0.4 },
    deska: { nazev: 'tlaková deska', vaha: 0.3 },
  };

  // louč na stěně (x, y) ve směru k; sebrané louče už nesvítí
  const SANCE_LOUCE = 0.08;
  function hashSteny(p, a, b, c) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519) ^ p.seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const jeLouc = (s, x, y, k) => hashSteny(s.mapaPatra, x, y, k + 40) < SANCE_LOUCE && !(s.sebraneLouce && s.sebraneLouce.has(`${x},${y},${k}`));
  const MAX_PALIVA = 1000;

  const dekoraceNa = (s, x, y) => s.dekorace && s.dekorace.find(d => d.x === x && d.y === y && d.druh !== 'kosti');
  const pastNa = (s, x, y) => s.pasti && s.pasti.find(t => t.x === x && t.y === y);
  const prekazkaNa = (s, x, y) => truhlaNa(s, x, y) || dekoraceNa(s, x, y);

  // Po položení překážky musí zůstat patro průchozí: dveře, schody i všechna volná pole místností.
  // Dvě podmínky: (1) po odemčení všeho je patro celé průchozí, (2) i se zamčenými dveřmi a mřížemi
  // je dostupné všechno mimo zamčené místnosti a ke schodům se dojde (dřív překážky občas zatarasily jedinou
  // volnou cestu a ke schodům vedla jen zamčená pokladnice).
  function souvisle(s) {
    const p = s.mapaPatra, w = p.w, n = w * p.h, blok = new Uint8Array(n);
    for (const t of s.truhly) blok[t.y * w + t.x] = 1;
    for (const d of s.dekorace) if (d.druh !== 'kosti') blok[d.y * w + d.x] = 1;
    const schody = p.dolu.y * w + p.dolu.x;
    blok[schody] = 1;                       // přes schody se projít nedá (šlápnutí = sestup, na patře s bossem bariéra)
    const zamky = new Set([...(s.zamcene || []), ...(s.mrize || [])]);
    const zamcenaMistnost = new Set();
    for (const d of p.dvere) if (zamky.has(d.y * w + d.x)) zamcenaMistnost.add(d.mistnost);
    const bfs = sZamky => {
      const dist = new Int8Array(n);
      const fronta = [p.start.y * w + p.start.x]; dist[fronta[0]] = 1;
      for (let q = 0; q < fronta.length; q++) {
        const i = fronta[q], x = i % w, y = (i / w) | 0;
        for (let k = 0; k < 4; k++) {
          const j = (y + DY[k]) * w + x + DX[k];
          if (dist[j] || blok[j] || p.mapa[j] === T.SKALA || (sZamky && zamky.has(j))) continue;   // tajné dveře bereme jako průchozí
          dist[j] = 1; fronta.push(j);
        }
      }
      return dist;
    };
    const vse = bfs(false);
    for (let i = 0; i < n; i++) if (p.mapa[i] !== T.SKALA && !blok[i] && !vse[i]) return false;
    if (!zamky.size) return [0, 1, 2, 3].some(k => vse[schody + DY[k] * w + DX[k]]);
    const zamceno = bfs(true);
    for (let i = 0; i < n; i++) {
      if (p.mapa[i] === T.SKALA || blok[i] || zamky.has(i) || zamceno[i]) continue;
      if (zamcenaMistnost.has(p.mistnostId[i])) continue;
      return false;
    }
    return [0, 1, 2, 3].some(k => zamceno[schody + DY[k] * w + DX[k]]);    // ke schodům se dojít dá
  }

  // pole dostupná od startu, když jsou zamčené dveře a mříže zavřené (překážky počítá)
  function dostupneSeZamky(s) {
    const p = s.mapaPatra, w = p.w, n = w * p.h, blok = new Uint8Array(n);
    for (const t of s.truhly) blok[t.y * w + t.x] = 1;
    for (const d of s.dekorace) if (d.druh !== 'kosti') blok[d.y * w + d.x] = 1;
    for (const i of [...s.zamcene, ...s.mrize]) blok[i] = 1;
    blok[p.dolu.y * w + p.dolu.x] = 1;
    const dist = new Int8Array(n), fronta = [p.start.y * w + p.start.x]; dist[fronta[0]] = 1;
    for (let q = 0; q < fronta.length; q++) {
      const i = fronta[q], x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 4; k++) {
        const j = (y + DY[k]) * w + x + DX[k];
        if (dist[j] || blok[j] || !pruchozi(p.mapa[j])) continue;
        dist[j] = 1; fronta.push(j);
      }
    }
    return dist;
  }

  function volnePole(s, x, y) {
    const p = s.mapaPatra, i = y * p.w + x;
    if (p.mapa[i] !== T.PODLAHA) return false;
    if ((x === p.start.x && y === p.start.y) || (x === p.dolu.x && y === p.dolu.y)) return false;
    if (s.potvory.some(m => m.x === x && m.y === y) || prekazkaNa(s, x, y) || pastNa(s, x, y)) return false;
    if (s.zeme.some(z => z.x === x && z.y === y) || teleportNa(s, x, y)) return false;
    return true;
  }
  const uDveri = (s, x, y) => s.mapaPatra.dvere.some(d => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);

  // položit překážku ke zdi místnosti (ne ke dveřím) tak, aby nic neodřízla
  function umisti(s, m, R, druh, doStredu) {
    const kandidati = [];
    for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
      const okraj = x === m.x || y === m.y || x === m.x + m.w - 1 || y === m.y + m.h - 1;
      if ((doStredu || okraj) && volnePole(s, x, y) && !uDveri(s, x, y)) kandidati.push({ x, y });
    }
    for (let k = 0; k < 12 && kandidati.length; k++) {
      const c = kandidati.splice(Math.floor(R.f() * kandidati.length), 1)[0];
      const o = { x: c.x, y: c.y, druh };
      if (druh === 'truhla') { o.otevrena = false; s.truhly.push(o); } else s.dekorace.push(o);
      if (druh === 'kosti' || souvisle(s)) return o;
      if (druh === 'truhla') s.truhly.pop(); else s.dekorace.pop();
    }
    return null;
  }
  const n2 = (R, a, b) => a + Math.floor(R.f() * (b - a + 1));
  const teleportNa = (s, x, y) => !!s.teleporty && s.teleporty.some(([tx, ty]) => tx === x && ty === y);

  function volneVMistnosti(s, m, R) {
    for (let k = 0; k < 30; k++) {
      const x = m.x + Math.floor(R.f() * m.w), y = m.y + Math.floor(R.f() * m.h);
      if (volnePole(s, x, y)) return { x, y };
    }
    return null;
  }

  // dá se místnost zamknout? (bez ní musí zůstat dostupné všechno ostatní i schody)
  function lzeZamknout(s, m) {
    const p = s.mapaPatra, kopie = p.mapa.slice();
    const dvere = p.dvere.filter(d => d.mistnost === m.id && !d.tajne);
    if (!dvere.length) return false;
    for (const d of dvere) kopie[d.y * p.w + d.x] = T.SKALA;
    // počítá i s už rozmístěnými truhlami, překážkami a jinými zámky
    for (const t of s.truhly || []) kopie[t.y * p.w + t.x] = T.SKALA;
    for (const d of s.dekorace || []) if (d.druh !== 'kosti') kopie[d.y * p.w + d.x] = T.SKALA;
    for (const i of [...(s.zamcene || []), ...(s.mrize || [])]) kopie[i] = T.SKALA;
    const dist = vzdalenosti(kopie, p.w, p.h, p.start.x, p.start.y);
    for (const o of p.mistnosti) {
      if (o === m || o.tajna) continue;
      let dosazitelna = false;                        // stačí jedno pole místnosti (roh může blokovat překážka)
      for (let y = o.y; y < o.y + o.h && !dosazitelna; y++) for (let x = o.x; x < o.x + o.w; x++) if (dist[y * p.w + x] >= 0) { dosazitelna = true; break; }
      if (!dosazitelna && !(s.zamcene && [...s.zamcene].some(i => p.dvere.some(d => d.mistnost === o.id && d.y * p.w + d.x === i)))) return false;
    }
    return dist[p.dolu.y * p.w + p.dolu.x] >= 0;
  }

  function zarizeni(s) {
    const p = s.mapaPatra, R = nahoda(smichej(s.seed ^ 0x5A1E, p.patro));
    const startM = p.mistnostId[p.start.y * p.w + p.start.x];
    const pocty = {};
    for (const m of p.mistnosti) {
      m.ucel = null;
      if (m.tajna || m.id === startM || R.f() < 0.42) continue;
      const moznosti = Object.keys(UCELY).filter(k => p.patro >= UCELY[k].od && !(UCELY[k].max && pocty[k] >= UCELY[k].max)
        && !(k === 'pokladnice' && (p.mistnostId[p.dolu.y * p.w + p.dolu.x] === m.id || !lzeZamknout(s, m))));
      if (!moznosti.length) continue;
      const soucet = moznosti.reduce((a, k) => a + UCELY[k].vaha, 0);
      let r = R.f() * soucet, ucel = moznosti[0];
      for (const k of moznosti) { r -= UCELY[k].vaha; if (r <= 0) { ucel = k; break; } }
      m.ucel = ucel; pocty[ucel] = (pocty[ucel] || 0) + 1;
    }
    // pokladnici zamknout hned, ať s tím počítá kontrola průchodnosti u všech překážek
    for (const m of p.mistnosti) if (m.ucel === 'pokladnice') {
      const dv = p.dvere.filter(d => d.mistnost === m.id && !d.tajne), puvodni = dv.map(d => p.mapa[d.y * p.w + d.x]);
      for (const d of dv) { p.mapa[d.y * p.w + d.x] = T.DVERE; d.zavrene = true; s.zamcene.add(d.y * p.w + d.x); }
      if (!souvisle(s)) {                            // zámek by odřízl kus patra – pokladnice nebude
        dv.forEach((d, i) => { p.mapa[d.y * p.w + d.x] = puvodni[i]; d.zavrene = puvodni[i] === T.DVERE; s.zamcene.delete(d.y * p.w + d.x); });
        m.ucel = null;
      }
    }
    const druhyPatra = Object.keys(BESTIAR).filter(k => BESTIAR[k].od <= p.patro && p.patro <= BESTIAR[k].do);
    const pridejPotvoru = (m, druh, spi) => {
      const c = volneVMistnosti(s, m, R);
      if (c) s.potvory.push(novaPotvora(s, druh, c.x, c.y, spi));
    };
    const naZem = (m, predmety, zlato) => {
      const c = volneVMistnosti(s, m, R);
      if (c) s.zeme.push({ x: c.x, y: c.y, predmety, zlato: zlato || 0 });
      return c;
    };
    for (const m of p.mistnosti) {
      const n = (a, b) => a + Math.floor(R.f() * (b - a + 1));
      switch (m.ucel) {
        case 'hrobka':
          for (let i = n(1, 3); i > 0; i--) umisti(s, m, R, 'rakev');
          pridejPotvoru(m, p.patro >= 6 ? 'kostlivec' : 'had', true);
          if (R.f() < 0.5) { const t = umisti(s, m, R, 'truhla'); if (t) t.bonus = 1; }
          break;
        case 'skladiste':
          for (let i = n(2, 4); i > 0; i--) umisti(s, m, R, R.f() < 0.5 ? 'sud' : 'bedna');
          for (let i = n(1, 2); i > 0; i--) naZem(m, [nahodnyPredmet(s, p.patro, 'jidlo')]);
          if (R.f() < 0.6) naZem(m, [nahodnyPredmet(s, p.patro, R.f() < 0.5 ? 'sipy' : 'lektvar')]);
          break;
        case 'knihovna':
          for (let i = n(2, 4); i > 0; i--) umisti(s, m, R, 'police');
          for (let i = n(1, 2); i > 0; i--) naZem(m, [novyPredmet(s, 'kniha')]);
          break;
        case 'kobka':
          for (let i = n(1, 2); i > 0; i--) umisti(s, m, R, 'klec');
          for (let i = n(1, 2); i > 0; i--) pridejPotvoru(m, p.patro >= 5 ? 'goblin' : 'krysa', false);
          naZem(m, [nahodnyPredmet(s, p.patro)]);
          break;
        case 'svatyne':
          umisti(s, m, R, 'oltar');
          break;
        case 'doupe':
          for (let i = 3; i > 0; i--) umisti(s, m, R, 'kosti', true);
          for (let i = n(2, 3); i > 0; i--) pridejPotvoru(m, druhyPatra[Math.floor(R.f() * druhyPatra.length)] || 'krysa', R.f() < 0.5);
          { const t = umisti(s, m, R, 'truhla'); if (t) t.bonus = 2; }
          break;
        case 'pokladnice': {
          for (let i = 0; i < 2; i++) { const t = umisti(s, m, R, 'truhla'); if (t) t.bonus = 3; }
          naZem(m, [], p.patro * n(12, 25));
          // klíč schovat jinam (dveře už jsou zamčené)
          const jinde = p.mistnosti.filter(o => o !== m && !o.tajna && o.id !== startM);
          for (let k = 0; k < 20; k++) {
            const o = jinde[Math.floor(R.f() * jinde.length)];
            if (o && naZem(o, [novyPredmet(s, 'klic')])) break;
          }
          break;
        }
      }
      if (m.tajna) {                                      // odměna za nalezení tajné místnosti
        const t = umisti(s, m, R, 'truhla', true); if (t) t.bonus = 3;
        if (R.f() < 0.5) naZem(m, [], p.patro * n(8, 16));
      }
    }
    // obchodník: zhruba každé třetí patro (ne v patře s bossem), v místnosti bez jiného účelu
    s.obchod = null;
    const los = R.f(), nutny = p.patro - (s.posledniObchod || 0) >= 5;   // nejpozději každé 5. patro
    if (p.patro >= 2 && p.patro % 10 !== 0 && (los < 0.36 || nutny)) {
      const dolM = p.mistnostId[p.dolu.y * p.w + p.dolu.x];
      const kandidati = p.mistnosti.filter(m => !m.tajna && !m.ucel && m.id !== startM && m.id !== dolM);
      const m = kandidati[Math.floor(R.f() * kandidati.length)];
      const o = m && umisti(s, m, R, 'obchodnik');
      if (o) {
        m.ucel = 'obchod';
        s.potvory = s.potvory.filter(q => p.mistnostId[q.y * p.w + q.x] !== m.id);   // v obchodě se nebojuje
        const zbozi = [novyPredmet(s, 'lektvar', { lektvar: 'leceni' }), novyPredmet(s, 'lektvar', { lektvar: 'leceni' }),
          nahodnyPredmet(s, p.patro, 'lektvar'), nahodnyPredmet(s, p.patro, 'jidlo'), nahodnyPredmet(s, p.patro, 'jidlo'),
          nahodnyPredmet(s, p.patro + 1, 'magie'), nahodnyPredmet(s, p.patro + 1, 'zbran'), nahodnyPredmet(s, p.patro + 1, 'ochrana'),
          nahodnyPredmet(s, p.patro + 1, R.f() < 0.5 ? 'ochrana' : 'sperk'), novyPredmet(s, 'sipy', { pocet: 15 })];
        if (p.patro >= 3) zbozi.push(novyPredmet(s, 'svitekOdkleti'));
        for (const q of zbozi) { delete q.prokleti; delete q.odhaleno; if (q.vzacnost !== undefined && slotPro(q)) q.vzacnost = Math.max(1, q.vzacnost); }
        s.posledniObchod = p.patro;
        s.obchod = { x: o.x, y: o.y, mistnost: m.id, zbozi, sleva: 0, hadanka: R.f() < 0.4 ? Math.floor(R.f() * HADANKY.length) : -1 };
      }
    }

    // mříž a páka: místnost s pokladem zavřená mříží, páka je jinde v patře (od 3. patra, 35 %)
    s.mrize = new Set(); s.paka = null;
    const losMrize = R.f();
    if (p.patro >= 3 && p.patro % 10 !== 0 && losMrize < 0.35) {
      const dolM = p.mistnostId[p.dolu.y * p.w + p.dolu.x];
      const kand = p.mistnosti.filter(m => !m.tajna && !m.ucel && m.id !== startM && m.id !== dolM && lzeZamknout(s, m));
      const m = kand[Math.floor(R.f() * kand.length)];
      if (m) {
        // zavřít mříž zkusmo – když odřízne kus patra, místnost zůstane otevřená
        const dv = p.dvere.filter(d => d.mistnost === m.id && !d.tajne), puvodni = dv.map(d => p.mapa[d.y * p.w + d.x]);
        for (const d of dv) { p.mapa[d.y * p.w + d.x] = T.DVERE; s.mrize.add(d.y * p.w + d.x); }
        const ok = souvisle(s), dostupne = ok ? dostupneSeZamky(s) : null;
        if (!ok) { dv.forEach((d, i) => { p.mapa[d.y * p.w + d.x] = puvodni[i]; }); s.mrize.clear(); }
        // páka: stěna u pole dostupného i se zavřenou mříží, aspoň 6 polí od místnosti
        const steny = [];
        for (let y = 1; y < p.h - 1; y++) for (let x = 1; x < p.w - 1; x++) {
          if (p.mapa[y * p.w + x] !== T.SKALA) continue;
          for (let k = 0; k < 4; k++) {
            const nx = x + DX[k], ny = y + DY[k], i = ny * p.w + nx, t = p.mapa[i];
            if ((t !== T.PODLAHA && t !== T.CHODBA) || p.mistnostId[i] === m.id || !dostupne || !dostupne[i]) continue;
            if (p.mistnostId[i] >= 0 && p.mistnosti[p.mistnostId[i]].tajna) continue;
            if (hashSteny(p, x, y, k + 40) < SANCE_LOUCE) continue;       // ne tam, kde visí louč
            if (Math.abs(nx - (m.x + m.w / 2)) + Math.abs(ny - (m.y + m.h / 2)) < 6) continue;
            steny.push({ x, y, k });
          }
        }
        if (ok && steny.length) {
          const st = steny[Math.floor(R.f() * steny.length)];
          s.paka = { x: st.x, y: st.y, k: st.k, zatazena: false, mistnost: m.id };
          m.ucel = 'mriz';
          for (const d of dv) { d.zavrene = true; d.mriz = true; }
          const t = umisti(s, m, R, 'truhla'); if (t) t.bonus = 2;
          if (R.f() < 0.6) naZem(m, [], p.patro * n2(R, 6, 14));
        } else if (ok) {                              // páka se nenašla – mříž zase otevřít
          dv.forEach((d, i) => { p.mapa[d.y * p.w + d.x] = puvodni[i]; });
          s.mrize.clear();
        }
      }
    }

    // teleportní kruhy: dvojice v různých místnostech (od 4. patra, 30 %)
    s.teleporty = null;
    const losTele = R.f();
    if (p.patro >= 4 && losTele < 0.3) {
      const vhodne = p.mistnosti.filter(m => !m.tajna && !['pokladnice', 'obchod', 'mriz'].includes(m.ucel) && !m.boss);
      for (let k = 0; k < 30 && !s.teleporty; k++) {
        const a = vhodne[Math.floor(R.f() * vhodne.length)], b = vhodne[Math.floor(R.f() * vhodne.length)];
        if (!a || !b || a === b) continue;
        const ca = volneVMistnosti(s, a, R), cb = volneVMistnosti(s, b, R);
        if (!ca || !cb || uDveri(s, ca.x, ca.y) || uDveri(s, cb.x, cb.y) || Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y) < 8) continue;
        s.teleporty = [[ca.x, ca.y], [cb.x, cb.y]];
      }
    }

    // pasti: v chodbách i místnostech, ne ve startovní ani v pokladnici
    const kolik = Math.min(6, 1 + Math.floor(p.patro / 3));
    for (let k = 0; k < 200 && s.pasti.length < kolik; k++) {
      const x = 1 + Math.floor(R.f() * (p.w - 2)), y = 1 + Math.floor(R.f() * (p.h - 2)), i = y * p.w + x;
      const t = p.mapa[i];
      if (t !== T.PODLAHA && t !== T.CHODBA) continue;
      const mid = p.mistnostId[i];
      if (mid === startM || (mid >= 0 && (p.mistnosti[mid].ucel === 'pokladnice' || p.mistnosti[mid].tajna))) continue;
      if (Math.abs(x - p.start.x) + Math.abs(y - p.start.y) < 4) continue;
      if (t === T.PODLAHA ? !volnePole(s, x, y) : (s.potvory.some(m => m.x === x && m.y === y) || pastNa(s, x, y))) continue;
      let r = R.f(), druh = 'deska';
      for (const d in PASTI) { r -= PASTI[d].vaha; if (r <= 0) { druh = d; break; } }
      s.pasti.push({ x, y, druh, odhalena: false });
    }
  }

  // --- obchod ------------------------------------------------------------
  const HADANKY = [
    ['Čím víc z ní bereš, tím je větší.', ['díra', 'hromada zlata', 'tma'], 0],
    ['Má zuby, a nekouše.', ['hřeben', 'krysa', 'past'], 0],
    ['Běží, a nemá nohy.', ['voda', 'čas v kobce', 'had'], 0],
    ['Čím je sušší, tím víc mokne.', ['ručník', 'chléb', 'svitek'], 0],
    ['Svítí, a nehřeje.', ['měsíc', 'louč', 'láva'], 0],
    ['Kdo ho dělá, nepotřebuje ho. Kdo ho koupí, nechce ho. Kdo ho používá, neví o tom.', ['rakev', 'klíč', 'štít'], 0],
    ['Patří tobě, a ostatní ho používají víc než ty.', ['jméno', 'meč', 'batoh'], 0],
    ['Čím víc ho je, tím méně vidíš.', ['tma', 'zlato', 'mlha nad lávou'], 0],
  ];
  const CENY_LEKTVARU = { leceni: 30, velkeLeceni: 80, sila: 120, odolnost: 120, zkusenost: 90, sytost: 40, osviceni: 50, jed: 10 };
  // hodnota věci ve zlatě
  function cenaPredmetu(p, s) {
    const z = ZAKLADY[p.zaklad];
    // neznámé lektvary a svitky mají jednotnou cenu – jinak by cena prozradila, co jsou zač
    if (s && p.typ === 'lektvar' && !s.zname.includes(p.lektvar)) return 50;
    if (s && p.typ === 'svitek' && s.znameSvitky && !s.znameSvitky.includes(p.zaklad)) return 50;
    if (p.typ === 'lektvar') return CENY_LEKTVARU[p.lektvar] || 30;
    if (p.typ === 'jidlo') return Math.round(z.syti / 3) + 3;
    if (p.typ === 'sipy') return 2 * p.pocet;
    if (p.typ === 'svitek') return { ohen: 55, leceni: 45, teleport: 60, mapa: 40, odkleti: 70 }[z.kouzlo] || 50;
    if (p.typ === 'hulka') return 60 + 20 * p.naboje;
    if (p.typ === 'kniha') return 30;
    if (p.typ === 'klic') return 0;
    return Math.round((10 + Math.max(0, skorePredmetu(Object.assign({}, p, { odhaleno: false }))) * 6) * (1 + 0.5 * (p.vzacnost || 0)));
  }
  const cenaNakupu = (s, p) => Math.max(1, Math.round(cenaPredmetu(p, s) * (1 - (s.obchod ? s.obchod.sleva : 0)) * (ma(s, 'smlouvac') ? 0.8 : 1)));
  const cenaVykupu = (s, p) => Math.floor(cenaPredmetu(p, s) * (ma(s, 'smlouvac') ? 0.4 : 0.2));
  const cenaOdkleti = s => 40 * s.patro;
  const cenaBatohu = s => {
    const dalsi = BATOHY[s.hrac.batohStupen || 0];
    return dalsi ? Math.round(dalsi.cena * (1 - (s.obchod ? s.obchod.sleva : 0)) * (ma(s, 'smlouvac') ? 0.8 : 1)) : null;
  };
  const uObchodnika = s => !!s.obchod && Math.abs(s.obchod.x - s.x) + Math.abs(s.obchod.y - s.y) === 1;

  function obchodAkce(s, typ, arg, ud) {
    const o = s.obchod;
    if (!uObchodnika(s)) return false;
    if (typ === 'kup') {
      const i = o.zbozi.findIndex(p => p.id === arg);
      if (i < 0) return false;
      const p = o.zbozi[i], cena = cenaNakupu(s, p);
      if (s.zlato < cena) { ud.push({ typ: 'malo', cena }); return false; }
      if (!doBatohu(s, p)) { ud.push({ typ: 'plno', pocet: 1 }); return false; }
      o.zbozi.splice(i, 1); s.zlato -= cena;
      s.stat.utraceno += cena;
      ud.push({ typ: 'koupil', nazev: nazevPredmetu(s, p), cena });
      return true;
    }
    if (typ === 'prodej') {
      const i = najdiVBatohu(s, arg);
      if (i < 0 || s.hrac.batoh[i].typ === 'klic') return false;
      const p = s.hrac.batoh.splice(i, 1)[0], cena = cenaVykupu(s, p);
      s.zlato += cena;
      if (!(p.prokleti && p.odhaleno)) o.zbozi.push(p);        // prokleté si obchodník nevystaví
      ud.push({ typ: 'prodal', nazev: nazevPredmetu(s, p), cena });
      return true;
    }
    if (typ === 'batoh') {
      const dalsi = BATOHY[s.hrac.batohStupen || 0], cena = cenaBatohu(s);
      if (!dalsi) return false;
      if (s.zlato < cena) { ud.push({ typ: 'malo', cena }); return false; }
      s.zlato -= cena; s.stat.utraceno += cena;
      s.hrac.batohStupen = (s.hrac.batohStupen || 0) + 1;
      ud.push({ typ: 'vetsiBatoh', nazev: dalsi.nazev, mist: kapacita(s), cena });
      return true;
    }
    if (typ === 'odklet') {
      const cena = cenaOdkleti(s);
      if (!SLOTY.some(k => s.hrac.vybava[k] && s.hrac.vybava[k].prokleti)) return false;
      if (s.zlato < cena) { ud.push({ typ: 'malo', cena }); return false; }
      s.zlato -= cena;
      sejmiKletby(s); srovnejZdravi(s);
      ud.push({ typ: 'odklel', cena });
      return true;
    }
    if (typ === 'hadanka') {
      if (o.hadanka < 0) return false;
      const spravne = HADANKY[o.hadanka][2] === arg;
      o.hadanka = -2;                                  // odpovídá se jen jednou
      if (spravne) o.sleva = 0.25;
      ud.push({ typ: 'hadanka', spravne });
      return true;
    }
    return false;
  }

  // --- tajné dveře, pasti, oltář, knihy ---------------------------------
  function odhalTajne(s, x, y, ud, jak) {
    const p = s.mapaPatra, i = y * p.w + x;
    p.mapa[i] = T.DVERE;
    s.odhalene.add(i);
    s.tajne++;
    ud.push({ typ: 'tajne', x, y, jak });
  }

  // pozornost: po každém kroku šance všimnout si pasti vedle sebe
  function rozhlednise(s, ud, pozorne) {
    const h = s.hrac, zlodej = ma(s, 'zlodej');
    const sance = zlodej ? 1 : pozorne ? 0.5 : 0.15 + 0.03 * h.uroven, dosah = pozorne || zlodej ? 2 : 1;
    for (const t of s.pasti) {
      if (t.odhalena || Math.abs(t.x - s.x) + Math.abs(t.y - s.y) > dosah) continue;
      if (Rs(s) < sance) { t.odhalena = true; ud.push({ typ: 'pastOdhalena', x: t.x, y: t.y, druh: t.druh }); }
    }
    if (!pozorne) return;
    for (let k = 0; k < 4; k++) {
      const x = s.x + DX[k], y = s.y + DY[k];
      if (dlazdice(s, x, y) === T.TAJNE && Rs(s) < 0.35) odhalTajne(s, x, y, ud, 'hledani');
    }
  }

  function padDolu(s, ud) {
    vstupDoPatra(s, s.patro + 1);
    // dopad na náhodné místo mimo startovní místnost
    const p = s.mapaPatra, startM = p.mistnostId[p.start.y * p.w + p.start.x];
    for (let k = 0; k < 200; k++) {
      const m = p.mistnosti[Ri(s, 0, p.mistnosti.length - 1)];
      if (m.id === startM || m.tajna || m.ucel === 'pokladnice' || m.ucel === 'mriz') continue;   // ne tam, odkud není cesta ven
      const x = m.x + Ri(s, 0, m.w - 1), y = m.y + Ri(s, 0, m.h - 1);
      if (!volnePole(s, x, y)) continue;
      s.x = x; s.y = y; s.smer = Ri(s, 0, 3);
      break;
    }                                             // nenajde-li se místo, zůstává hráč na startu patra
    aktualizujViditelnost(s);
    ud.push({ typ: 'dopad', patro: s.patro });
  }

  // vrací 'pad', když hráč propadl o patro níž
  function slapniNaPast(s, t, ud) {
    const h = s.hrac, o = odvozene(s);
    if (t.odhalena && t.druh !== 'jama' && Rs(s) < 0.7 + 0.03 * h.uroven) { ud.push({ typ: 'pastPrekrocena', druh: t.druh }); return null; }
    t.odhalena = true;
    if (t.druh === 'jama') {
      const dmg = Ri(s, 3, 8) + Math.floor(s.patro / 2);
      h.hp -= dmg;
      ud.push({ typ: 'jama', dmg });
      if (h.hp <= 0) { zemri(s, 'jáma, o které věděla jen tma', 'past', ud); return null; }
      padDolu(s, ud);
      return 'pad';
    }
    if (t.druh === 'sipky') {
      if (Rs(s) < 0.25 + 0.02 * o.obrana) { ud.push({ typ: 'sipkyUhnul' }); return null; }
      const dmg = Math.max(1, Ri(s, 2, 6) + Math.floor(s.patro / 3) - Math.floor(o.obrana / 3));
      h.hp -= dmg;
      ud.push({ typ: 'sipky', dmg });
      if (h.hp <= 0) zemri(s, 'otrávená šipka ze zdi', 'past', ud);
      return null;
    }
    // tlaková deska: poplach, nebo padající kámen
    if (Rs(s) < 0.5) {
      for (const m of s.potvory) { m.stav = 'honi'; m.stopa = 15; }
      ud.push({ typ: 'poplach', pocet: s.potvory.length });
    } else {
      const dmg = Math.max(1, Ri(s, 4, 10) + Math.floor(s.patro / 3) - Math.floor(o.obrana / 2));
      h.hp -= dmg;
      ud.push({ typ: 'kamen', dmg });
      if (h.hp <= 0) zemri(s, 'kámen ze stropu – podzemí nedodržuje BOZP', 'past', ud);
    }
    return null;
  }

  const POZEHNANI = [
    ['Svaté světlo tě uzdravilo.', s => { s.hrac.hp = odvozene(s).maxHp; }],
    ['Cítíš sílu praotců (síla +1).', s => { s.hrac.sila++; }],
    ['Kůže ti ztvrdla jako kámen (obrana +1).', s => { s.hrac.obrana++; }],
    ['V hlavě ti zašeptaly hvězdy (magie +1).', s => { s.hrac.magie++; }],
    ['Hlad i únava zmizely.', s => { s.hrac.sytost = 100; s.hrac.hp = Math.min(odvozene(s).maxHp, s.hrac.hp + 10); }],
  ];
  function modlitba(s, d, ud) {
    d.pouzito = true;
    const h = s.hrac, o = odvozene(s);
    if (Rs(s) < 0.65 + 0.02 * o.magie) {
      const [text, ucinek] = POZEHNANI[Ri(s, 0, POZEHNANI.length - 1)];
      ucinek(s);
      const kletby = sejmiKletby(s);
      ud.push({ typ: 'oltar', dobre: true, text: text + (kletby ? ' Svaté světlo spálilo i kletby.' : '') });
      return;
    }
    const r = Ri(s, 0, 2);
    if (r === 0) {
      const dmg = Math.max(1, Math.round(o.maxHp * 0.3));
      h.hp -= dmg;
      ud.push({ typ: 'oltar', dobre: false, text: `Oltář vzplál a popálil tě (−${dmg}).` });
      if (h.hp <= 0) zemri(s, 'hněv zapomenutého boha', 'oltar', ud);
    } else if (r === 1) {
      const druhy = Object.keys(BESTIAR).filter(k => BESTIAR[k].od <= s.patro && s.patro <= BESTIAR[k].do);
      for (let k = 0; k < 4; k++) {
        const x = s.x + DX[k], y = s.y + DY[k];
        if (!volneProPotvoru(s, x, y, null, { dvere: false })) continue;
        const m = novaPotvora(s, druhy[Ri(s, 0, druhy.length - 1)] || 'krysa', x, y, false);
        m.stav = 'honi'; m.stopa = 15;
        s.potvory.push(m);
        break;
      }
      ud.push({ typ: 'oltar', dobre: false, text: 'Z temnoty se vynořil strážce svatyně!' });
    } else {
      h.sytost = Math.max(0, h.sytost - 40);
      ud.push({ typ: 'oltar', dobre: false, text: 'Oltář ti vysál síly – máš hrozný hlad.' });
    }
  }

  function vstupDoMistnosti(s, ud) {
    const p = s.mapaPatra, mid = p.mistnostId[s.y * p.w + s.x];
    if (mid < 0 || s.navstivene.has(mid)) return;
    s.navstivene.add(mid);
    const m = p.mistnosti[mid];
    if (m.boss && bossZiv(s)) ud.push({ typ: 'mistnost', ucel: 'boss', text: BESTIAR[m.boss].vstup });
    else if (m.tajna) ud.push({ typ: 'mistnost', ucel: 'tajna', text: 'Tajná místnost! Sem už věky nikdo nevkročil.' });
    else if (m.ucel) ud.push({ typ: 'mistnost', ucel: m.ucel, text: UCELY[m.ucel].vstup });
  }

  // --- použití předmětů ---------------------------------------------
  function najdiVBatohu(s, id) { return s.hrac.batoh.findIndex(p => p.id === id); }

  function nasad(s, id, ud) {
    const b = s.hrac.batoh, i = najdiVBatohu(s, id);
    if (i < 0) return false;
    const p = b[i], slotTyp = slotPro(p);
    if (!slotTyp) return false;
    const v = s.hrac.vybava;
    let slot = slotTyp;
    if (slotTyp === 'prsten') {
      const volne = ['prsten1', 'prsten2'].filter(k => !v[k] || !v[k].prokleti);
      slot = !v.prsten1 ? 'prsten1' : !v.prsten2 ? 'prsten2'
        : volne.length === 2 ? (skorePredmetu(v.prsten1) <= skorePredmetu(v.prsten2) ? 'prsten1' : 'prsten2') : volne[0] || 'prsten1';
    }
    if (v[slot] && v[slot].prokleti) {            // prokletá věc nejde sundat, a tak ani vyměnit
      v[slot].odhaleno = true;
      ud.push({ typ: 'prokleto', nazev: nazevPredmetu(s, v[slot]) });
      return false;
    }
    b.splice(i, 1);
    if (v[slot]) b.push(v[slot]);
    v[slot] = p;
    if (slot === 'zbran' || slot === 'luk') s.hrac.drzi = slot;   // nasazenou zbraň bereš rovnou do ruky
    srovnejZdravi(s);
    ud.push({ typ: 'nasadil', nazev: nazevPredmetu(s, p), predmet: p });
    if (p.prokleti && !p.odhaleno) {
      p.odhaleno = true;
      ud.push({ typ: 'kletba', nazev: nazevPredmetu(s, p), kletba: KLETBY[p.prokleti].nazev, text: KLETBY[p.prokleti].text });
    }
    srovnejZdravi(s);
    return true;
  }

  // sejmout kletbu ze všeho, co hráč nese
  function sejmiKletby(s) {
    let n = 0;
    for (const slot of SLOTY) { const p = s.hrac.vybava[slot]; if (p && p.prokleti) { delete p.prokleti; delete p.odhaleno; n++; } }
    for (const p of s.hrac.batoh) if (p.prokleti && p.odhaleno) { delete p.prokleti; delete p.odhaleno; n++; }
    return n;
  }

  function sundej(s, slot, ud) {
    const v = s.hrac.vybava;
    if (!v[slot]) return false;
    if (v[slot].prokleti) { v[slot].odhaleno = true; ud.push({ typ: 'prokleto', nazev: nazevPredmetu(s, v[slot]) }); return false; }
    if (s.hrac.batoh.length >= kapacita(s)) { ud.push({ typ: 'plno', pocet: 1 }); return false; }
    s.hrac.batoh.push(v[slot]);
    ud.push({ typ: 'sundal', nazev: nazevPredmetu(s, v[slot]) });
    v[slot] = null;
    srovnejZdravi(s);
    return true;
  }

  function pouzij(s, id, ud) {
    const b = s.hrac.batoh, i = najdiVBatohu(s, id);
    if (i < 0) return false;
    const p = b[i], h = s.hrac;
    if (p.typ === 'jidlo') {
      b.splice(i, 1);
      h.sytost = Math.min(100, h.sytost + ZAKLADY[p.zaklad].syti);
      ud.push({ typ: 'snedl', nazev: ZAKLADY[p.zaklad].nazev });
      return true;
    }
    if (p.typ === 'pochoden') {
      if (h.pochoden >= MAX_PALIVA) { ud.push({ typ: 'plnaPochoden' }); return false; }
      b.splice(i, 1);
      h.pochoden = Math.min(MAX_PALIVA, h.pochoden + ZAKLADY.pochoden.palivo);
      ud.push({ typ: 'zapalil' });
      return true;
    }
    if (p.typ === 'kniha') {
      b.splice(i, 1);
      const nezname = Object.keys(LEKTVARY).filter(k => !s.zname.includes(k)).map(k => ['l', k])
        .concat(Object.keys(s.napisySvitku || {}).filter(k => !s.znameSvitky.includes(k)).map(k => ['s', k]));
      if (nezname.length) {
        const [druh, k] = nezname[Ri(s, 0, nezname.length - 1)];
        if (druh === 'l') {
          s.zname.push(k);
          ud.push({ typ: 'precetl', text: `Kniha receptur: ${s.barvyLektvaru[k][0].toLowerCase()} lektvar je ${LEKTVARY[k].nazev.toLowerCase()}.` });
        } else {
          s.znameSvitky.push(k);
          ud.push({ typ: 'precetl', text: `Kniha run: nápis „${s.napisySvitku[k]}" znamená ${ZAKLADY[k].nazev.toLowerCase()}.` });
        }
      } else {
        const zk = Math.round(h.zkDalsi * 0.3);
        h.zk += zk;
        ud.push({ typ: 'precetl', text: `Učená pojednání o nestvůrách (+${zk} zkušeností).` });
        povysuj(s, ud);
      }
      return true;
    }
    if (p.typ === 'svitek' || p.typ === 'hulka') {
      if (p.typ === 'svitek' && s.znameSvitky && !s.znameSvitky.includes(p.zaklad)) {
        s.znameSvitky.push(p.zaklad);
        ud.push({ typ: 'poznalSvitek', napis: s.napisySvitku[p.zaklad], nazev: ZAKLADY[p.zaklad].nazev });
      }
      const zachovan = p.typ === 'svitek' && ma(s, 'mag') && Rs(s) < 0.25;
      if (zachovan) ud.push({ typ: 'svitekZustal' });
      if (p.typ === 'svitek' && !zachovan) b.splice(i, 1);
      else if (--p.naboje <= 0) { b.splice(i, 1); ud.push({ typ: 'hulkaVyprazdnena', nazev: ZAKLADY[p.zaklad].nazev }); }
      sesli(s, ZAKLADY[p.zaklad].kouzlo, ud);
      return true;
    }
    if (p.typ !== 'lektvar') return false;
    b.splice(i, 1);
    const znal = s.zname.includes(p.lektvar);
    if (!znal) s.zname.push(p.lektvar);
    const max = odvozene(s).maxHp;
    let ucinek = '';
    switch (p.lektvar) {
      case 'leceni': { const kolik = Math.min(max - h.hp, 12 + Math.round(max * 0.3)); h.hp += kolik; ucinek = `+${kolik} zdraví`; break; }
      case 'velkeLeceni': ucinek = `+${max - h.hp} zdraví`; h.hp = max; break;
      case 'sila': h.sila++; ucinek = 'síla +1 natrvalo'; break;
      case 'odolnost': h.obrana++; ucinek = 'obrana +1 natrvalo'; break;
      case 'zkusenost': { const zk = Math.round(h.zkDalsi * 0.5); h.zk += zk; ucinek = `+${zk} zkušeností`; povysuj(s, ud); break; }
      case 'sytost': h.sytost = 100; ucinek = 'už nemáš hlad'; break;
      case 'osviceni': s.prozkoumano.fill(1); ucinek = 'mapa patra se ti vyjevila'; break;
      case 'jed': {
        const dmg = Ri(s, 4, 10) + Math.floor(s.patro / 3);
        h.hp -= dmg; ucinek = `−${dmg} zdraví`;
        if (h.hp <= 0) zemri(s, 'neznámý lektvar, který nebyl k pití', 'jed', ud);
        break;
      }
    }
    s.stat.lektvary++;
    ud.push({ typ: 'vypil', lektvar: p.lektvar, nazev: LEKTVARY[p.lektvar].nazev, novy: !znal, ucinek, dobre: p.lektvar !== 'jed' });
    return true;
  }

  // --- kouzla ----------------------------------------------------------
  // síla: základ roste s patrem (svitky z hloubky jsou silnější) a magie ji násobí
  const silaKouzla = (s, zaklad) => Math.round(zaklad * (1 + 0.15 * odvozene(s).magie));
  const silaUtocneho = (s, zaklad) => Math.round(silaKouzla(s, zaklad) * (ma(s, 'zaklinac') ? 1.35 : 1));
  function sesli(s, kouzlo, ud) {
    const h = s.hrac, o = odvozene(s);
    if (kouzlo === 'leceni') {
      const kolik = Math.min(o.maxHp - h.hp, silaKouzla(s, 12 + s.patro));
      h.hp += kolik;
      ud.push({ typ: 'kouzlo', kouzlo, text: `Hřejivé světlo tě uzdravilo (+${kolik}).` });
      return;
    }
    if (kouzlo === 'odkleti') {
      const n = sejmiKletby(s);
      ud.push({ typ: 'kouzlo', kouzlo: 'leceni', text: n ? 'Kletby z tebe spadly jako staré hadry.' : 'Zlehka tě ovanulo – nic prokletého u sebe nemáš.' });
      return;
    }
    if (kouzlo === 'mapa') {
      s.prozkoumano.fill(1);
      for (const t of s.pasti) t.odhalena = true;
      ud.push({ typ: 'kouzlo', kouzlo, text: 'Před očima se ti rozvinula mapa celého patra i se všemi pastmi.' });
      return;
    }
    if (kouzlo === 'teleport') {
      const p = s.mapaPatra;
      for (let k = 0; k < 200; k++) {
        const m = p.mistnosti[Ri(s, 0, p.mistnosti.length - 1)];
        if (m.tajna || m.ucel === 'pokladnice' || (m.ucel === 'mriz' && s.mrize.size) || m.boss) continue;
        const x = m.x + Ri(s, 0, m.w - 1), y = m.y + Ri(s, 0, m.h - 1);
        if (!volnePole(s, x, y) || Math.abs(x - s.x) + Math.abs(y - s.y) < 6) continue;
        s.x = x; s.y = y;
        break;
      }
      ud.push({ typ: 'kouzlo', kouzlo, text: 'Svět se zatočil – jsi úplně jinde.' });
      return;
    }
    // ohnivá koule: první potvora v přímce, polovina i sousedům; blesk: všechny v přímce
    const cile = [];
    let d = 1;
    for (; d <= 6; d++) {
      const x = s.x + DX[s.smer] * d, y = s.y + DY[s.smer] * d;
      if (blokujePohled(s, x, y) || prekazkaNa(s, x, y)) break;
      const m = potvoraNa(s, x, y);
      if (m) { cile.push(m); if (kouzlo === 'ohen') break; }
    }
    ud.push({ typ: 'kouzlo', kouzlo, vzdalenost: cile.length ? Math.abs(cile[cile.length - 1].x - s.x) + Math.abs(cile[cile.length - 1].y - s.y) : d,
      text: cile.length ? '' : kouzlo === 'ohen' ? 'Ohnivá koule se roztříštila o zeď.' : 'Blesk se ztratil ve tmě.' });
    if (kouzlo === 'ohen' && cile.length) {
      const hl = cile[0], dmg = silaUtocneho(s, Ri(s, 8, 14) + Math.round(s.patro * 1.5));
      const sousede = s.potvory.filter(m => m !== hl && Math.abs(m.x - hl.x) + Math.abs(m.y - hl.y) === 1);
      zranPotvoru(s, hl, Math.max(1, dmg - Math.floor(BESTIAR[hl.druh].obrana / 3)), ud, true);
      for (const m of sousede) if (m.hp > 0) zranPotvoru(s, m, Math.max(1, Math.round(dmg / 2)), ud, true);
    }
    if (kouzlo === 'blesk') for (const m of cile) if (m.hp > 0) zranPotvoru(s, m, silaUtocneho(s, Ri(s, 5, 10) + s.patro), ud, true);
    hluk(s, 6);
  }

  function zahod(s, id, ud) {
    const b = s.hrac.batoh, i = najdiVBatohu(s, id);
    if (i < 0) return false;
    const p = b.splice(i, 1)[0];
    polozNaZem(s, s.x, s.y, [p], 0);
    ud.push({ typ: 'zahodil', nazev: nazevPredmetu(s, p) });
    return true;
  }

  // náhoda uložená ve stavu výpravy, aby šla výprava přesně zopakovat (testy, bot)
  function Rs(s) {
    const a = s.rng = (s.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const Ri = (s, a, b) => a + Math.floor(Rs(s) * (b - a + 1));
  const omez = (v, a, b) => Math.max(a, Math.min(b, v));

  // povolání hrdiny; kromě rytíře se odemykají úspěchy (odemčení hlídá stránka)
  const TRIDY = {
    rytir: { nazev: 'Rytíř', ikona: '🛡️', popis: 'Vyvážený bojovník s mečem a prošívanicí. Dobrá volba pro začátek.',
      hp: 30, sila: 3, magie: 1, zbran: 'mec1', brneni: 'brneni1', navic: [], schopnost: null, odemceni: null },
    zlodej: { nazev: 'Zloděj', ikona: '🗡️', popis: 'Méně zdraví, ale dýka, krátký luk se šípy a od začátku schopnost Zloděj (útok ze zálohy ×3).',
      hp: 24, sila: 3, magie: 1, zbran: 'dyka1', boty: 'boty1', navic: [['luk1'], ['sipy', { pocet: 15 }]], schopnost: 'zlodej',
      odemceni: { uspech: 'hledac', text: 'Najdi 3 tajné místnosti v jedné výpravě.' } },
    mag: { nazev: 'Mág', ikona: '✨', popis: 'Křehký, ale s hůlkou ohně, dvěma svitky, magií 4 a schopností Mág – kouzla jsou mnohem silnější.',
      hp: 22, sila: 2, magie: 4, zbran: 'dyka1', navic: [['hulkaOhen'], ['svitekLeceni'], ['svitekOhen']], schopnost: 'mag',
      odemceni: { uspech: 'jeskyne', text: 'Dojdi do zatopených jeskyní (11. patro).' } },
    barbar: { nazev: 'Barbar', ikona: '🪓', popis: 'Hodně zdraví a síly se sekerou a schopností Bojovník, ale bez brnění a bez lektvarů.',
      hp: 40, sila: 5, magie: 0, zbran: 'sekera1', navic: [['maso'], ['maso']], schopnost: 'bojovnik', bezLektvaru: true,
      odemceni: { uspech: 'kralovrah', text: 'Poraz Krysího krále.' } },
  };

  // seed denní výpravy z data (pro všechny hráče stejný)
  function seedDne(datum) {
    let h = 0x811C9DC5;
    for (let i = 0; i < datum.length; i++) { h ^= datum.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h ^ 0xDA11) >>> 0;
  }

  function novyHrdina(s) {
    const [jmeno, rod] = JMENA[s.seed % JMENA.length];
    s.jmeno = jmeno; s.rod = rod;
    const tr = TRIDY[s.trida] || TRIDY.rytir;
    s.hrac = {
      hp: tr.hp, maxHp: tr.hp, sila: tr.sila, obrana: 0, magie: tr.magie, uroven: 1, zk: 0, zkDalsi: 15, sytost: 100,
      vybava: { zbran: null, luk: null, stit: null, helma: null, brneni: null, boty: null, amulet: null, prsten1: null, prsten2: null },
      drzi: 'zbran', batohStupen: 0,
      batoh: [], schopnosti: tr.schopnost ? [tr.schopnost] : [], volba: null, kryti: false, pochoden: 800,
    };
    s.zabito = 0; s.tajne = 0; s.zlato = 0; s.bossu = 0;
    s.stat = { zaloha: 0, utraceno: 0, lektvary: 0 };    // počítadla výpravy (pro úspěchy)
    // barvy lektvarů se každou výpravu zamíchají; léčivý zná hrdina odmala
    const barvy = BARVY_LEKTVARU.slice();
    s.barvyLektvaru = {};
    for (const k of Object.keys(LEKTVARY)) s.barvyLektvaru[k] = barvy.splice(Ri(s, 0, barvy.length - 1), 1)[0];
    s.zname = ['leceni'];
    // svitky mají tajemné nápisy, co který dělá, se pozná přečtením (nebo z knihy)
    const SLABIKY = ['XAN', 'DOR', 'ELB', 'ZUM', 'KRI', 'VOL', 'MER', 'THA', 'GOS', 'NIL', 'PRA', 'UKO', 'FEX', 'RUN'];
    s.napisySvitku = {}; s.znameSvitky = [];
    const pouzite = new Set();
    for (const k of Object.keys(ZAKLADY).filter(k => ZAKLADY[k].typ === 'svitek')) {
      let n;
      do { n = SLABIKY[Ri(s, 0, SLABIKY.length - 1)] + ' ' + SLABIKY[Ri(s, 0, SLABIKY.length - 1)]; } while (pouzite.has(n));
      pouzite.add(n); s.napisySvitku[k] = n;
    }
    const v = s.hrac.vybava;
    v.zbran = novyPredmet(s, tr.zbran);
    if (tr.brneni) v.brneni = novyPredmet(s, tr.brneni);
    if (tr.boty) v.boty = novyPredmet(s, tr.boty);
    // rychlá lišta drží druh věci (ne konkrétní kus), takže se po spotřebování sama doplní dalším stejným
    s.rychla = [tr.bezLektvaru ? null : { typ: 'lektvar', lektvar: 'leceni' }, { typ: 'jidlo' }, null];
    s.hrac.batoh.push(novyPredmet(s, 'chleb'), novyPredmet(s, 'chleb'), novyPredmet(s, 'pochoden'));
    if (!tr.bezLektvaru) s.hrac.batoh.push(novyPredmet(s, 'lektvar', { lektvar: 'leceni' }), novyPredmet(s, 'lektvar', { lektvar: 'leceni' }));
    for (const [zaklad, o] of tr.navic) {
      const p = novyPredmet(s, zaklad, o);
      if (slotPro(p) === 'luk' && !v.luk) { v.luk = p; continue; }   // luk rovnou na záda
      if (p.typ === 'hulka') p.naboje = 4;
      if (p.typ === 'svitek') { s.znameSvitky.push(zaklad); if (!s.rychla[2]) s.rychla[2] = { zaklad }; }
      s.hrac.batoh.push(p);
    }
    if (s.trida === 'mag') s.rychla[2] = { zaklad: 'hulkaOhen' };
  }

  // --- schopnosti (volba každou 3. úroveň) ----------------------------
  const SCHOPNOSTI = {
    bojovnik: { nazev: 'Bojovník', ikona: '⚔️', popis: 'Zbraně na blízko zraňují o 25 % víc.' },
    lukostrelec: { nazev: 'Lukostřelec', ikona: '🏹', popis: 'Luk dostřelí o 2 pole dál a šíp se v polovině případů neztratí.' },
    zlodej: { nazev: 'Zloděj', ikona: '🗡️', popis: 'Útok ze zálohy zraňuje trojnásobně a pasti vidíš do dvou polí.' },
    mag: { nazev: 'Mág', ikona: '✨', popis: 'Magie +2 a svitek se ve čtvrtině případů nespotřebuje.' },
    tuhy: { nazev: 'Tuhý kořen', ikona: '❤️', popis: 'Maximální zdraví +15.' },
    hbity: { nazev: 'Hbitý', ikona: '💨', popis: 'Pětina útoků tě mine úplně.' },
    houzevnaty: { nazev: 'Houževnatý', ikona: '🩹', popis: 'Hojíš se skoro dvakrát rychleji.' },
    skromny: { nazev: 'Skromný', ikona: '🍖', popis: 'Hlad přichází o polovinu pomaleji.' },
    smlouvac: { nazev: 'Smlouvač', ikona: '💰', popis: 'U obchodníka o 20 % levněji a výkup za dvojnásobek.' },
    stitonos: { nazev: 'Štítonoš', ikona: '🛡️', popis: 'Štít dává obranu +1 a krytí zastaví 90 % zranění.' },
    zaklinac: { nazev: 'Zaklínač', ikona: '🔥', popis: 'Ohnivá koule a blesk zraňují o 35 % víc.' },
    stastlivec: { nazev: 'Šťastlivec', ikona: '🍀', popis: 'O polovinu víc zlata a vzácnější věci v truhlách.' },
  };
  const ma = (s, k) => !!(s.hrac.schopnosti && s.hrac.schopnosti.includes(k));
  function nabidniSchopnosti(s, ud) {
    const volne = Object.keys(SCHOPNOSTI).filter(k => !ma(s, k));
    const nabidka = [];
    while (nabidka.length < 3 && volne.length) nabidka.push(volne.splice(Ri(s, 0, volne.length - 1), 1)[0]);
    if (!nabidka.length) return;
    s.hrac.volba = nabidka;
    ud.push({ typ: 'volbaSchopnosti', nabidka });
  }

  function povysuj(s, ud) {
    const h = s.hrac;
    while (h.zk >= h.zkDalsi) {
      h.zk -= h.zkDalsi;
      h.uroven++;
      h.zkDalsi = zkDalsi(h.uroven);
      h.maxHp += 5;
      h.hp = Math.min(odvozene(s).maxHp, h.hp + 5 + Math.round(h.maxHp * 0.3));
      h.sila++;
      if (h.uroven % 2 === 0) h.obrana++;
      if (h.uroven % 3 === 0) h.magie++;
      ud.push({ typ: 'uroven', uroven: h.uroven });
      if (h.uroven % 3 === 0 && !h.volba) nabidniSchopnosti(s, ud);
    }
  }

  const PRICINY_HLADU = ['hlad – podzemí nemá hospody', 'prázdný žaludek a plný batoh'];
  function zemri(s, pricina, druh, ud) {
    const h = s.hrac;
    h.hp = 0;
    s.mrtvy = {
      jmeno: s.jmeno, rod: s.rod, patro: s.patro, zabito: s.zabito, tajne: s.tajne, zlato: s.zlato,
      tahu: s.tah, uroven: h.uroven, druh, pricina, bossu: s.bossu || 0, biom: s.mapaPatra.biom, trida: s.trida, denni: s.denni,
    };
    ud.push({ typ: 'smrt', druh });
  }

  function zkDalsi(uroven) { return Math.round(15 * Math.pow(uroven, 1.5)); }

  // potvory patra: počet i druhy podle hloubky, rozmístění ze seedu
  // boss hlídá místnost se schody; schody pustí až po jeho smrti
  function umistiBosse(s) {
    const p = s.mapaPatra, k = Math.floor(p.patro / 10) - 1;
    const druh = BOSSOVE[Math.min(k, BOSSOVE.length - 1)];
    const mid = p.mistnostId[p.dolu.y * p.w + p.dolu.x], m = p.mistnosti[mid];
    m.boss = druh;
    s.potvory = s.potvory.filter(q => p.mistnostId[q.y * p.w + q.x] !== mid);   // aréna patří jen jemu
    let nej = null;
    for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
      if (x === p.dolu.x && y === p.dolu.y) continue;
      const d = Math.abs(x - p.dolu.x) + Math.abs(y - p.dolu.y);
      if (d >= 1 && (!nej || d < nej.d)) nej = { x, y, d };
    }
    const b = novaPotvora(s, druh, nej.x, nej.y, true);
    // za patrem 60 se bossové opakují a sílí
    const navic = Math.max(0, k - (BOSSOVE.length - 1));
    if (navic) { b.hp = b.maxHp = Math.round(b.maxHp * (1 + 0.5 * navic)); b.bonus += 8 * navic; }
    s.potvory.push(b);
  }

  function zalidni(s) {
    const p = s.mapaPatra, R = nahoda(smichej(s.seed ^ 0x0BADC0DE, p.patro));
    const pocet = Math.min(14, 3 + Math.floor(p.patro * 0.7));
    let druhy = Object.keys(BESTIAR).filter(k => BESTIAR[k].od <= p.patro && p.patro <= BESTIAR[k].do);
    if (!druhy.length) druhy = Object.keys(BESTIAR).filter(k => BESTIAR[k].od <= p.patro && !BESTIAR[k].boss);
    const vahy = druhy.map(k => BESTIAR[k].vaha * (p.patro - BESTIAR[k].od < 3 ? 1.4 : 1));
    const soucet = vahy.reduce((a, b) => a + b, 0);
    const startM = p.mistnostId[p.start.y * p.w + p.start.x];
    const volna = [];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x, t = p.mapa[i];
      if (t !== T.PODLAHA && t !== T.CHODBA) continue;
      if (p.mistnostId[i] === startM && startM >= 0) continue;
      if (p.mistnostId[i] >= 0 && p.mistnosti[p.mistnostId[i]].tajna) continue;
      if (Math.abs(x - p.start.x) + Math.abs(y - p.start.y) < 5) continue;
      if (t === T.CHODBA && R.f() < 0.7) continue;     // víc v místnostech než v chodbách
      volna.push({ x, y });
    }
    s.potvory = [];
    for (let k = 0; k < pocet && volna.length; k++) {
      const c = volna.splice(Math.floor(R.f() * volna.length), 1)[0];
      let r = R.f() * soucet, druh = druhy[0];
      for (let i = 0; i < druhy.length; i++) { r -= vahy[i]; if (r <= 0) { druh = druhy[i]; break; } }
      s.potvory.push(novaPotvora(s, druh, c.x, c.y, R.f() < BESTIAR[druh].spi));
    }
  }

  function novaPotvora(s, druh, x, y, spi) {
    const d = BESTIAR[druh], navic = Math.max(0, s.patro - d.od);
    const hp = Math.round(d.hp * (1 + OBTIZNOST.hpRust * navic));
    return {
      id: s.dalsiId = (s.dalsiId || 0) + 1, druh, x, y, hp, maxHp: hp,
      bonus: Math.floor(navic * OBTIZNOST.utokRust), stav: spi ? 'spi' : 'bloudi', energie: 0, stopa: 0,
    };
  }

  const potvoraNa = (s, x, y) => s.potvory.find(m => m.x === x && m.y === y && m.hp > 0);

  // --- stav výpravy --------------------------------------------
  function novaVyprava(seed, trida, denni) {
    const s = { verze: 2, seed: seed >>> 0, patro: 1, tah: 0, nejhlubsi: 1, rng: (seed ^ 0x5EED) | 0, trida: TRIDY[trida] ? trida : 'rytir', denni: denni || null };
    novyHrdina(s);
    vstupDoPatra(s, 1);
    return s;
  }

  function vstupDoPatra(s, patro) {
    const p = generujPatro(s.seed, patro);
    s.patro = patro;
    s.nejhlubsi = Math.max(s.nejhlubsi || 1, patro);
    s.mapaPatra = p;
    s.x = p.start.x; s.y = p.start.y; s.smer = p.start.smer;
    s.prozkoumano = new Uint8Array(p.w * p.h);
    s.otevrene = new Set();                  // indexy otevřených dveří
    s.truhly = []; s.zeme = []; s.dekorace = []; s.pasti = [];
    s.zamcene = new Set(); s.odhalene = new Set(); s.navstivene = new Set(); s.mrize = new Set();
    s.sebraneLouce = new Set(); s.paka = null; s.teleporty = null;
    s.navstivene.add(p.mistnostId[p.start.y * p.w + p.start.x]);
    s.obchodPred = s.posledniObchod || 0;        // stav při vstupu – po načtení se patro postaví stejně
    zalidni(s);
    if (patro % 10 === 0) umistiBosse(s);
    zarizeni(s);
    rozmistiKorist(s);
    aktualizujViditelnost(s);
  }

  function dlazdice(s, x, y) {
    const p = s.mapaPatra;
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return T.SKALA;
    return p.mapa[y * p.w + x];
  }
  function dvereZavrene(s, x, y) {
    return dlazdice(s, x, y) === T.DVERE && !s.otevrene.has(y * s.mapaPatra.w + x);
  }
  function blokujePohled(s, x, y) {
    const t = dlazdice(s, x, y);
    const i = y * s.mapaPatra.w + x;
    return t === T.SKALA || t === T.TAJNE || (t === T.DVERE && !s.otevrene.has(i) && !(s.mrize && s.mrize.has(i)));   // mříží je vidět
  }

  // Prozkoumá pole v zorném kuželu (a vše těsně kolem hráče).
  function aktualizujViditelnost(s, dosah) {
    dosah = dosah || (s.hrac && s.hrac.pochoden <= 0 ? 2 : 5);   // bez pochodně vidíš jen kousek
    const p = s.mapaPatra, fx = DX[s.smer], fy = DY[s.smer];
    const oznac = (x, y) => { if (x >= 0 && y >= 0 && x < p.w && y < p.h) s.prozkoumano[y * p.w + x] = 1; };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) oznac(s.x + dx, s.y + dy);
    for (let y = s.y - dosah - 1; y <= s.y + dosah + 1; y++) for (let x = s.x - dosah - 1; x <= s.x + dosah + 1; x++) {
      const rx = x - s.x, ry = y - s.y;
      const vpred = rx * fx + ry * fy, bok = Math.abs(rx * -fy + ry * fx);
      if (vpred < 0 || vpred > dosah || bok > vpred + 1) continue;
      if (vidi(s, s.x, s.y, x, y)) oznac(x, y);
    }
  }

  // přímka ze středu do středu; mezilehlá pole nesmí blokovat pohled
  function vidi(s, x0, y0, x1, y1) {
    const kroku = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4;
    for (let k = 1; k < kroku; k++) {
      const t = k / kroku;
      const x = Math.floor(x0 + 0.5 + (x1 - x0) * t), y = Math.floor(y0 + 0.5 + (y1 - y0) * t);
      if ((x !== x0 || y !== y0) && (x !== x1 || y !== y1) && blokujePohled(s, x, y)) return false;
    }
    return true;
  }

  // --- akce hráče -----------------------------------------------
  // Vrací { tah, udalost, udalosti: [...] } – `udalosti` jsou pro stránku (zprávy, čísla, zvuky).
  const POHYBY = { vpred: 0, vpravo: 1, vzad: 2, vlevo: 3 };
  function akce(s, typ, arg) {
    const r = akceVnitrni(s, typ, arg);
    if (s.mrtvy) aktualizujViditelnost(s);      // smrt pastí, jedem či u oltáře skončí dřív než tah
    return r;
  }
  function akceVnitrni(s, typ, arg) {
    const ud = [];
    if (s.mrtvy) return { tah: false, udalost: 'mrtvy', udalosti: ud };
    if (typ === 'otocL' || typ === 'otocP') {
      s.smer = (s.smer + (typ === 'otocL' ? 3 : 1)) % 4;
      aktualizujViditelnost(s);
      return { tah: false, udalost: 'otoceni', udalosti: ud };
    }
    if (typ === 'schopnost') {
      const h = s.hrac;
      if (!h.volba || !h.volba.includes(arg)) return { tah: false, udalost: 'nic', udalosti: ud };
      h.schopnosti.push(arg); h.volba = null;
      srovnejZdravi(s);
      if (arg === 'tuhy') h.hp += 15;
      ud.push({ typ: 'schopnost', klic: arg, nazev: SCHOPNOSTI[arg].nazev });
      return { tah: false, udalost: 'schopnost', udalosti: ud };
    }
    if (typ === 'kryt') {
      if (!s.hrac.vybava.stit) return { tah: false, udalost: 'bezStitu', udalosti: ud };
      s.hrac.kryti = true;
      ud.push({ typ: 'kryt' });
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'kryt', udalosti: ud };
    }
    if (typ === 'prehod') {
      // rychlé přehození zbraň ↔ luk – nestojí tah, stejně jako otočka
      const h = s.hrac, na = drziLuk(s) ? 'zbran' : 'luk';
      if (na === 'luk' && !h.vybava.luk) return { tah: false, udalost: 'bezLuku', udalosti: ud };
      h.drzi = na;
      ud.push({ typ: 'prehodil', luk: na === 'luk', nazev: h.vybava[na] ? nazevPredmetu(s, h.vybava[na]) : 'Pěsti' });
      return { tah: false, udalost: 'prehod', udalosti: ud };
    }
    if (typ === 'cekej') {
      rozhlednise(s, ud, true);                   // čekání = pozorné prohledání okolí
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'cekej', udalosti: ud };
    }
    if (typ === 'utok') {
      const o = odvozene(s);
      let m = null;
      if (o.zbran.dosah) {
        // luk: první potvora v přímce, šíp se spotřebuje
        if (o.sipy <= 0) return { tah: false, udalost: 'bezSipu', udalosti: ud };
        let d = 1;
        for (; d <= o.zbran.dosah; d++) {
          const x = s.x + DX[s.smer] * d, y = s.y + DY[s.smer] * d;
          if (blokujePohled(s, x, y) || prekazkaNa(s, x, y)) break;
          if ((m = potvoraNa(s, x, y))) break;
        }
        const st = s.hrac.batoh.find(p => p.typ === 'sipy');
        if (!(ma(s, 'lukostrelec') && Rs(s) < 0.5) && --st.pocet <= 0) s.hrac.batoh.splice(s.hrac.batoh.indexOf(st), 1);
        ud.push({ typ: 'vystrel', vzdalenost: m ? d : Math.min(d, o.zbran.dosah) });
        if (m) utokHrace(s, m, ud, true); else ud.push({ typ: 'sipMinul' });
      } else {
        m = potvoraNa(s, s.x + DX[s.smer], s.y + DY[s.smer]);
        if (m) utokHrace(s, m, ud); else ud.push({ typ: 'mach' });
      }
      hluk(s, 5);
      konecTahu(s, o.zbran.rychlost, ud);
      return { tah: true, udalost: m ? 'utok' : 'mach', udalosti: ud };
    }
    if (typ === 'kup' || typ === 'prodej' || typ === 'odklet' || typ === 'hadanka' || typ === 'batoh') {
      const ok = obchodAkce(s, typ, arg, ud);
      return { tah: false, udalost: ok ? typ : 'nic', udalosti: ud };   // obchodování čas nestojí
    }
    if (typ === 'ohmatat') {
      const x = s.x + DX[s.smer], y = s.y + DY[s.smer], t = dlazdice(s, x, y), stena = (s.smer + 2) % 4;
      if (s.paka && !s.paka.zatazena && s.paka.x === x && s.paka.y === y && s.paka.k === stena) {
        s.paka.zatazena = true;
        for (const i of s.mrize) s.otevrene.add(i);
        s.mrize.clear();
        ud.push({ typ: 'paka' });
      } else if (t === T.SKALA && jeLouc(s, x, y, stena)) {
        s.sebraneLouce.add(`${x},${y},${stena}`);
        s.hrac.pochoden = Math.min(MAX_PALIVA, s.hrac.pochoden + 350);
        ud.push({ typ: 'louc' });
      } else if (t === T.TAJNE) odhalTajne(s, x, y, ud, 'ohmatani');
      else if (t === T.SKALA) ud.push({ typ: 'ohmatal' });
      else return { tah: false, udalost: 'nic', udalosti: ud };
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'ohmatat', udalosti: ud };
    }
    if (typ === 'nasad' || typ === 'sundej' || typ === 'pouzij' || typ === 'zahod') {
      const ok = typ === 'nasad' ? nasad(s, arg, ud) : typ === 'sundej' ? sundej(s, arg, ud)
        : typ === 'pouzij' ? pouzij(s, arg, ud) : zahod(s, arg, ud);
      if (!ok) return { tah: false, udalost: 'nic', udalosti: ud };
      if (!s.mrtvy) konecTahu(s, 1, ud);
      return { tah: true, udalost: typ, udalosti: ud };
    }
    if (!(typ in POHYBY)) return { tah: false, udalost: 'nic', udalosti: ud };
    const k = (s.smer + POHYBY[typ]) % 4;
    const nx = s.x + DX[k], ny = s.y + DY[k];
    const t = dlazdice(s, nx, ny);
    if (t === T.SKALA) return { tah: false, udalost: 'zed', udalosti: ud };
    if (t === T.TAJNE) {                          // náraz do duté zdi ji někdy prozradí
      if (Rs(s) < 0.4) odhalTajne(s, nx, ny, ud, 'naraz');
      return { tah: false, udalost: 'zed', udalosti: ud };
    }
    const m = potvoraNa(s, nx, ny);
    if (m) return { tah: false, udalost: 'blok', potvora: m, udalosti: ud };
    const dek = dekoraceNa(s, nx, ny);
    if (dek && dek.druh === 'obchodnik') return { tah: false, udalost: 'obchod', udalosti: ud };
    if (dek) {
      if (dek.druh === 'oltar' && !dek.pouzito) {
        modlitba(s, dek, ud);
        if (!s.mrtvy) konecTahu(s, 1, ud);
        return { tah: true, udalost: 'oltar', udalosti: ud };
      }
      return { tah: false, udalost: 'prekazka', druh: dek.druh, udalosti: ud };
    }
    const truhla = truhlaNa(s, nx, ny);
    if (truhla) {
      if (truhla.otevrena) return { tah: false, udalost: 'prazdnaTruhla', udalosti: ud };
      otevriTruhlu(s, truhla, ud);
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'truhla', udalosti: ud };
    }
    const past = pastNa(s, nx, ny);
    if (past && past.odhalena && past.druh === 'jama' && s.varovani !== ny * s.mapaPatra.w + nx) {
      s.varovani = ny * s.mapaPatra.w + nx;       // první stisk jen varuje, druhý skočí dolů
      return { tah: false, udalost: 'varovaniJama', udalosti: ud };
    }
    s.varovani = -1;
    if (s.mrize && s.mrize.has(ny * s.mapaPatra.w + nx)) return { tah: false, udalost: 'mriz', udalosti: ud };
    if (dvereZavrene(s, nx, ny)) {
      const idx = ny * s.mapaPatra.w + nx;
      if (s.zamcene.has(idx)) {
        const k = s.hrac.batoh.findIndex(p => p.typ === 'klic');
        if (k < 0) return { tah: false, udalost: 'zamceno', udalosti: ud };
        s.hrac.batoh.splice(k, 1);
        for (const d of s.zamcene) s.otevrene.add(d);   // jeden klíč odemyká všechny dveře pokladnice
        s.zamcene.clear();
        ud.push({ typ: 'odemkl' });
        konecTahu(s, 1, ud);
        return { tah: true, udalost: 'dvere', udalosti: ud };
      }
      s.otevrene.add(ny * s.mapaPatra.w + nx);
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'dvere', udalosti: ud };
    }
    if (t === T.DOLU && bossZiv(s)) return { tah: false, udalost: 'bariera', udalosti: ud };
    const z = { x: s.x, y: s.y };
    s.x = nx; s.y = ny;
    if (t === T.DOLU) {
      s.tah++;
      vstupDoPatra(s, s.patro + 1);
      return { tah: true, udalost: 'sestup', z, udalosti: ud };
    }
    seberZeZeme(s, ud);
    if (past && slapniNaPast(s, past, ud) === 'pad') return { tah: true, udalost: 'pad', udalosti: ud };
    if (teleportNa(s, s.x, s.y)) {
      const [tx, ty] = s.teleporty.find(([a, b]) => a !== s.x || b !== s.y);
      if (!potvoraNa(s, tx, ty)) { ud.push({ typ: 'teleport', z: { x: s.x, y: s.y }, x: tx, y: ty }); s.x = tx; s.y = ty; }
    }
    if (s.mrtvy) return { tah: true, udalost: 'krok', z, udalosti: ud };
    vstupDoMistnosti(s, ud);
    rozhlednise(s, ud, false);
    konecTahu(s, 1, ud);
    return { tah: true, udalost: t === T.NAHORU ? 'nahoru' : 'krok', z, udalosti: ud };
  }

  // Po akci hráče: plyne čas, hráč se pomalu hojí, potvory jednají.
  function konecTahu(s, kol, ud) {
    for (let i = 0; i < kol && !s.mrtvy; i++) {
      s.tah++;
      const h = s.hrac, pred = h.sytost;
      h.sytost = Math.max(0, Math.round((h.sytost - 0.1 * odvozene(s).hladovost) * 10) / 10);
      if (pred > 30 && h.sytost <= 30) ud.push({ typ: 'hlad', stupen: 1 });
      if (pred > 10 && h.sytost <= 10) ud.push({ typ: 'hlad', stupen: 2 });
      if (h.sytost <= 0) {
        if (s.tah % 5 === 0) {
          h.hp--;
          ud.push({ typ: 'hlad', stupen: 3 });
          if (h.hp <= 0) { zemri(s, PRICINY_HLADU[Ri(s, 0, 1)], 'hlad', ud); break; }
        }
      } else if (s.tah % (ma(s, 'houzevnaty') ? 4 : 7) === 0 && h.hp < odvozene(s).maxHp) h.hp++;
      if (h.pochoden > 0) {
        h.pochoden--;
        if (h.pochoden === 100) ud.push({ typ: 'pochoden', stav: 'dohořívá' });
        if (h.pochoden === 0) ud.push({ typ: 'pochoden', stav: 'zhasla' });
      }
      tahPotvor(s, ud);
      h.kryti = false;                            // krytí štítem platí jen na jedno kolo potvor
    }
    aktualizujViditelnost(s);
  }

  function utokHrace(s, m, ud, strela) {
    const h = s.hrac, o = odvozene(s), z = o.zbran, d = BESTIAR[m.druh];
    const sance = omez(0.82 + 0.02 * (h.uroven - 1) + o.presnost / 100 - 0.04 * d.obrana - (h.pochoden > 0 ? 0 : 0.15), 0.4, 0.97);
    if (Rs(s) >= sance) { ud.push({ typ: 'minul', id: m.id, druh: m.druh, x: m.x, y: m.y }); return; }
    const silou = strela ? Math.floor((o.sila - 3) / 4) : Math.floor((o.sila - 3) / 2);
    let dmg = Math.max(1, Ri(s, z.min, z.max) + silou + o.ohen - Math.floor(d.obrana / 2));
    if (!strela && ma(s, 'bojovnik')) dmg = Math.round(dmg * 1.25);
    // ze zálohy: potvora spí, nic netuší, nebo je k tobě zády (ne boss)
    const zezadu = m.smer !== undefined && s.x === m.x - DX[m.smer] && s.y === m.y - DY[m.smer];
    if (!d.boss && (m.stav === 'spi' || m.stav === 'bloudi' || zezadu)) {
      dmg *= ma(s, 'zlodej') ? 3 : 2;
      s.stat.zaloha++;
      ud.push({ typ: 'zaskoceni', id: m.id, druh: m.druh, x: m.x, y: m.y, zezadu: zezadu && m.stav === 'honi' });
    }
    zranPotvoru(s, m, dmg, ud);
  }

  function zranPotvoru(s, m, dmg, ud, kouzlem) {
    const h = s.hrac, d = BESTIAR[m.druh];
    m.hp -= dmg;
    if (m.stav !== 'utika') m.stav = 'honi';
    m.stopa = 8;
    ud.push({ typ: 'zasah', id: m.id, druh: m.druh, dmg, x: m.x, y: m.y, kouzlem: !!kouzlem });
    if (m.hp <= 0) {
      s.potvory = s.potvory.filter(p => p !== m);
      s.zabito++;
      const zk = Math.round(d.zk * (1 + 0.1 * (s.patro - 1)));
      h.zk += zk;
      ud.push({ typ: 'zabita', id: m.id, druh: m.druh, x: m.x, y: m.y, zk });
      if (d.boss) {
        // pomocníci bosse se rozprchnou do tmy
        s.potvory = s.potvory.filter(p => p.pan !== m.id);
        s.bossu = (s.bossu || 0) + 1;
        ud.push({ typ: 'bossPadl', druh: m.druh, x: m.x, y: m.y });
        const kor = [nahodnyPredmet(s, s.patro + 4), nahodnyPredmet(s, s.patro + 4), nahodnyPredmet(s, s.patro + 2, 'magie')];
        for (const p of kor) { delete p.prokleti; delete p.odhaleno; }
        for (const p of kor) if (p.vzacnost !== undefined && L_SLOTOVY(p)) p.vzacnost = Math.max(3, p.vzacnost);
        polozNaZem(s, m.x, m.y, kor, s.patro * Ri(s, 25, 40));
      } else korist(s, m, ud);
      povysuj(s, ud);
    }
  }
  const L_SLOTOVY = p => !!slotPro(p);

  // hluk souboje budí spící potvory v okolí
  function hluk(s, dosah) {
    for (const m of s.potvory) {
      if (m.stav === 'spi' && Math.abs(m.x - s.x) + Math.abs(m.y - s.y) <= dosah && Rs(s) < 0.5) {
        m.stav = 'bloudi';
      }
    }
  }

  // vzdálenosti od hráče pro pronásledování (zavřené dveře jen pro ty, kdo je umí otevřít)
  function poleVzdalenosti(s, dvere) {
    const p = s.mapaPatra, w = p.w, dist = new Int16Array(w * p.h).fill(-1);
    const fronta = [s.y * w + s.x]; dist[fronta[0]] = 0;
    for (let q = 0; q < fronta.length; q++) {
      const i = fronta[q], x = i % w, y = (i / w) | 0;
      if (dist[i] > 30) break;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k], ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= p.h) continue;
        const j = ny * w + nx;
        if (dist[j] >= 0 || p.mapa[j] === T.SKALA || p.mapa[j] === T.TAJNE || s.zamcene.has(j) || s.mrize.has(j)) continue;
        if (!dvere && p.mapa[j] === T.DVERE && !s.otevrene.has(j)) continue;
        dist[j] = dist[i] + 1; fronta.push(j);
      }
    }
    return dist;
  }

  function tahPotvor(s, ud) {
    if (!s.potvory.length) return;
    const pole = [poleVzdalenosti(s, false), poleVzdalenosti(s, true)];
    for (const m of s.potvory.slice()) {
      if (m.hp <= 0) continue;
      const d = BESTIAR[m.druh];
      if (m.stav === 'spi') { jednej(s, m, d, pole, ud); continue; }
      m.energie += d.rychlost;
      while (m.energie >= 1 && !s.mrtvy) { m.energie -= 1; jednej(s, m, d, pole, ud); }
    }
  }

  function volneProPotvoru(s, x, y, m, d) {
    const t = dlazdice(s, x, y);
    if (t === T.SKALA || t === T.TAJNE || t === T.DOLU || t === T.NAHORU) return false;
    if (x === s.x && y === s.y) return false;
    if (prekazkaNa(s, x, y)) return false;       // pasti potvory znají – chodí po nich bez spuštění
    if (dvereZavrene(s, x, y) && (s.zamcene.has(y * s.mapaPatra.w + x) || s.mrize.has(y * s.mapaPatra.w + x))) return false;
    if (dvereZavrene(s, x, y) && !d.dvere) return false;
    const jina = potvoraNa(s, x, y);
    return !jina || jina === m;
  }

  function krokPotvory(s, m, d, x, y, ud) {
    if (dvereZavrene(s, x, y)) {            // goblin a kostlivec umí otevřít dveře – stojí je to akci
      s.otevrene.add(y * s.mapaPatra.w + x);
      ud.push({ typ: 'dvereOtevrela', id: m.id, druh: m.druh, x, y });
      return;
    }
    ud.push({ typ: 'pohyb', id: m.id, z: { x: m.x, y: m.y }, x, y });
    m.smer = [0, 1, 2, 3].find(k => m.x + DX[k] === x && m.y + DY[k] === y);
    m.x = x; m.y = y;
  }

  function jednej(s, m, d, pole, ud) {
    const dx = s.x - m.x, dy = s.y - m.y, blizko = Math.abs(dx) + Math.abs(dy);
    const vidiHrace = Math.max(Math.abs(dx), Math.abs(dy)) <= 7 && vidi(s, m.x, m.y, s.x, s.y);
    if (m.stav === 'spi') {
      if (vidiHrace && blizko <= (d.boss ? 6 : 2)) { m.stav = 'honi'; m.stopa = 8; ud.push({ typ: 'probudila', id: m.id, druh: m.druh, x: m.x, y: m.y, boss: !!d.boss }); }
      return;
    }
    if (d.boss) m.stopa = 30;                        // boss svou arénu neopouští z nepozornosti
    if (vidiHrace) {
      if (m.stav === 'bloudi') { m.stav = 'honi'; ud.push({ typ: 'spatrila', id: m.id, druh: m.druh, x: m.x, y: m.y }); }
      m.stopa = 8;
    } else if (m.stav === 'honi' && --m.stopa <= 0) m.stav = 'bloudi';
    if (m.stav === 'honi' && d.uteka && !m.vzchopila && m.hp < m.maxHp * d.uteka) {
      m.stav = 'utika';
      m.strachDo = s.tah + Ri(s, 4, 9);              // strach po pár tazích přejde
      ud.push({ typ: 'utika', id: m.id, druh: m.druh, x: m.x, y: m.y });
    }
    if (m.stav === 'utika') {
      if (m.strachDo == null) m.strachDo = s.tah + Ri(s, 4, 9);        // starší uložení (po JSON null)
      if (s.tah >= m.strachDo) {
        // vzchopí se a jde znovu do boje – podruhé už neuteče
        m.stav = 'honi'; m.stopa = 8; m.vzchopila = true; delete m.strachDo;
        ud.push({ typ: 'vzchopila', id: m.id, druh: m.druh, x: m.x, y: m.y });
      }
    }

    const pv = pole[d.dvere ? 1 : 0], w = s.mapaPatra.w;
    const tady = pv[m.y * w + m.x];
    if (m.stav === 'honi' && d.vola && s.tah - (m.volal || 0) >= d.vola.kazdych) {
      const sluhu = s.potvory.filter(q => q.pan === m.id).length;
      let privolano = 0;
      for (let k = 0; k < 4 && privolano < d.vola.pocet && sluhu + privolano < d.vola.max; k++) {
        const nx = m.x + DX[k], ny = m.y + DY[k];
        if (!volneProPotvoru(s, nx, ny, null, { dvere: false }) || dvereZavrene(s, nx, ny)) continue;
        const q = novaPotvora(s, d.vola.druh, nx, ny, false);
        q.stav = 'honi'; q.stopa = 15; q.pan = m.id;
        s.potvory.push(q); privolano++;
      }
      m.volal = s.tah;
      if (privolano) { ud.push({ typ: 'privolal', id: m.id, druh: m.druh, sluha: d.vola.druh, pocet: privolano, x: m.x, y: m.y }); return; }
    }
    if (m.stav === 'honi' && d.strelec && vidiHrace && blizko > 1 && blizko <= d.strelec.dosah && Rs(s) < d.strelec.sance) {
      strelaPotvory(s, m, d, ud);
      return;
    }
    if (m.stav === 'honi' && d.drzOdstup && blizko <= 2) {
      // mág ustupuje, aby mohl kouzlit z dálky
      let nej = null, nejD = tady;
      for (let k = 0; k < 4; k++) {
        const nx = m.x + DX[k], ny = m.y + DY[k], v = pv[ny * w + nx];
        if (v > nejD && volneProPotvoru(s, nx, ny, m, d) && !dvereZavrene(s, nx, ny)) { nej = [nx, ny]; nejD = v; }
      }
      if (nej && Rs(s) < 0.7) { krokPotvory(s, m, d, nej[0], nej[1], ud); return; }
    }
    if (m.stav === 'honi') {
      if (blizko === 1) { utokPotvory(s, m, d, ud); return; }
      let nej = null, nejD = tady < 0 ? 999 : tady;
      for (let k = 0; k < 4; k++) {
        const nx = m.x + DX[k], ny = m.y + DY[k], v = pv[ny * w + nx];
        if (v >= 0 && v < nejD && volneProPotvoru(s, nx, ny, m, d)) { nej = [nx, ny]; nejD = v; }
      }
      if (nej) krokPotvory(s, m, d, nej[0], nej[1], ud);
      return;
    }
    if (m.stav === 'utika') {
      let nej = null, nejD = tady;
      for (let k = 0; k < 4; k++) {
        const nx = m.x + DX[k], ny = m.y + DY[k], v = pv[ny * w + nx];
        if ((v > nejD || (v < 0 && tady >= 0)) && volneProPotvoru(s, nx, ny, m, d) && !dvereZavrene(s, nx, ny)) { nej = [nx, ny]; nejD = v < 0 ? 999 : v; }
      }
      if (nej) krokPotvory(s, m, d, nej[0], nej[1], ud);
      else if (blizko === 1) utokPotvory(s, m, d, ud);     // zahnaná do kouta se brání
      return;
    }
    // bloudění
    if (Rs(s) < 0.5) {
      const k = Ri(s, 0, 3), nx = m.x + DX[k], ny = m.y + DY[k];
      if (volneProPotvoru(s, nx, ny, m, d) && !dvereZavrene(s, nx, ny)) krokPotvory(s, m, d, nx, ny, ud);
    }
  }

  function utokPotvory(s, m, d, ud) {
    const h = s.hrac, obrana = odvozene(s).obrana;
    m.smer = [0, 1, 2, 3].find(k => m.x + DX[k] === s.x && m.y + DY[k] === s.y);
    const sance = omez(d.presnost + OBTIZNOST.presnostRust * Math.max(0, s.patro - d.od) - 0.02 * obrana, 0.3, 0.95);
    if (Rs(s) >= sance || (ma(s, 'hbity') && Rs(s) < 0.2)) { ud.push({ typ: 'uhnul', id: m.id, druh: m.druh, x: m.x, y: m.y }); return; }
    let dmg = Math.max(1, Ri(s, d.utok[0], d.utok[1]) + m.bonus - Math.floor(obrana / 2));
    if (h.kryti) {
      const pred = dmg;
      dmg = Math.max(0, Math.round(dmg * (ma(s, 'stitonos') ? 0.1 : 0.3)));
      ud.push({ typ: 'vykryl', id: m.id, druh: m.druh, zadrzel: pred - dmg });
      if (!dmg) return;
    }
    h.hp -= dmg;
    let vysal = 0;
    if (d.vysava) { vysal = Math.min(m.maxHp - m.hp, Math.ceil(dmg / 2)); m.hp += vysal; }
    ud.push({ typ: 'zranen', id: m.id, druh: m.druh, dmg, x: m.x, y: m.y, vysal });
    if (h.hp <= 0) zemri(s, d.pricina[Ri(s, 0, d.pricina.length - 1)], m.druh, ud);
  }

  // střela nebo kouzlo potvory na dálku
  function strelaPotvory(s, m, d, ud) {
    const h = s.hrac, obrana = odvozene(s).obrana, st = d.strelec;
    const sance = omez(d.presnost - 0.02 * obrana, 0.3, 0.9);
    if (Rs(s) >= sance || (ma(s, 'hbity') && Rs(s) < 0.2)) { ud.push({ typ: 'kouzloPotvory', id: m.id, druh: m.druh, nazev: st.nazev, dmg: 0, x: m.x, y: m.y }); return; }
    let dmg = Math.max(1, Ri(s, st.utok[0], st.utok[1]) + m.bonus - Math.floor(obrana / 3));
    if (h.kryti) dmg = Math.max(1, Math.round(dmg * 0.5));
    h.hp -= dmg;
    ud.push({ typ: 'kouzloPotvory', id: m.id, druh: m.druh, nazev: st.nazev, dmg, x: m.x, y: m.y });
    if ((m.druh === 'mag' || m.druh === 'lich') && h.pochoden > 0 && Rs(s) < 0.35) {
      h.pochoden = Math.max(0, h.pochoden - 150);
      ud.push({ typ: 'zhasil', druh: m.druh });
    }
    if (h.hp <= 0) zemri(s, d.pricina[Ri(s, 0, d.pricina.length - 1)], m.druh, ud);
  }

  // --- automatická chůze ------------------------------------------
  // Cesta po prozkoumaných průchozích polích; vyhne se překážkám, známým pastem, zamčeným dveřím,
  // potvorám a schodům (kromě cíle). Vrací pole kroků [[x, y], …] bez výchozího pole, nebo null.
  function najdiCestu(s, cx, cy) {
    const p = s.mapaPatra, w = p.w, n = w * p.h, cil = cy * w + cx;
    if (cx < 0 || cy < 0 || cx >= w || cy >= p.h || !s.prozkoumano[cil] || !pruchozi(p.mapa[cil])) return null;
    if (cx === s.x && cy === s.y) return [];
    const zakazano = i => {
      const x = i % w, y = (i / w) | 0;
      if (!s.prozkoumano[i] || !pruchozi(p.mapa[i])) return true;
      if (i === cil) return !!prekazkaNa(s, x, y);
      if (p.mapa[i] === T.DOLU) return true;
      if (s.zamcene.has(i) && !s.hrac.batoh.some(q => q.typ === 'klic')) return true;
      if (s.mrize.has(i) || teleportNa(s, x, y)) return true;
      if (prekazkaNa(s, x, y) || potvoraNa(s, x, y)) return true;
      const t = pastNa(s, x, y);
      return !!(t && t.odhalena);
    };
    const odkud = new Int32Array(n).fill(-2), start = s.y * w + s.x;
    odkud[start] = -1;
    const fronta = [start];
    for (let q = 0; q < fronta.length; q++) {
      const i = fronta[q];
      if (i === cil) break;
      const x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 4; k++) {
        const j = (y + DY[k]) * w + x + DX[k];
        if (odkud[j] !== -2 || zakazano(j)) continue;
        odkud[j] = i; fronta.push(j);
      }
    }
    if (odkud[cil] === -2) return null;
    const cesta = [];
    for (let i = cil; i !== start; i = odkud[i]) cesta.push([i % w, (i / w) | 0]);
    return cesta.reverse();
  }

  // --- ukládání ------------------------------------------------
  function bityNaHex(u8) {
    let out = '';
    for (let i = 0; i < u8.length; i += 4) {
      out += ((u8[i] ? 8 : 0) | (u8[i + 1] ? 4 : 0) | (u8[i + 2] ? 2 : 0) | (u8[i + 3] ? 1 : 0)).toString(16);
    }
    return out;
  }
  function hexNaBity(hex, n) {
    const u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const c = parseInt(hex[i >> 2] || '0', 16);
      u8[i] = (c >> (3 - (i & 3))) & 1;
    }
    return u8;
  }

  const POLE_POTVORY = ['id', 'druh', 'x', 'y', 'hp', 'maxHp', 'bonus', 'stav', 'energie', 'stopa', 'volal', 'pan', 'smer', 'strachDo', 'vzchopila'];
  function serializuj(s) {
    return JSON.stringify({
      verze: 4, seed: s.seed, patro: s.patro, tah: s.tah, nejhlubsi: s.nejhlubsi, rng: s.rng,
      x: s.x, y: s.y, smer: s.smer,
      prozkoumano: bityNaHex(s.prozkoumano),
      otevrene: [...s.otevrene],
      jmeno: s.jmeno, rod: s.rod, hrac: s.hrac, zabito: s.zabito, tajne: s.tajne, zlato: s.zlato, dalsiId: s.dalsiId, bossu: s.bossu || 0,
      potvory: s.potvory.map(m => POLE_POTVORY.map(k => m[k])),
      barvyLektvaru: s.barvyLektvaru, zname: s.zname, truhly: s.truhly, zeme: s.zeme,
      pasti: s.pasti, dekorace: s.dekorace.map(d => (d.pouzito ? 1 : 0)), odhalene: [...s.odhalene],
      zamcene: [...s.zamcene], navstivene: [...s.navstivene], rychla: s.rychla,
      mrize: [...s.mrize], paka: s.paka, sebraneLouce: [...s.sebraneLouce],
      napisySvitku: s.napisySvitku, znameSvitky: s.znameSvitky, obchod: s.obchod, obchodPred: s.obchodPred, trida: s.trida, denni: s.denni, stat: s.stat,
    });
  }

  function obnov(text) {
    const d = JSON.parse(text);
    if (!d || !(d.verze >= 1 && d.verze <= 4)) return null;
    // posledniObchod musí být známý dřív, než se patro znovu postaví (rozhoduje, jestli v něm obchodník je)
    const s = { verze: 4, seed: d.seed >>> 0, patro: 1, tah: d.tah | 0, nejhlubsi: d.nejhlubsi | 0, rng: d.rng | 0, posledniObchod: d.obchodPred | 0,
      trida: TRIDY[d.trida] ? d.trida : 'rytir', denni: d.denni || null };
    novyHrdina(s);
    vstupDoPatra(s, d.patro | 0 || 1);
    const p = s.mapaPatra;
    if (!(d.x >= 0 && d.y >= 0 && d.x < p.w && d.y < p.h) || !pruchozi(p.mapa[d.y * p.w + d.x])) return null;
    s.x = d.x; s.y = d.y; s.smer = d.smer & 3;
    s.prozkoumano = hexNaBity(d.prozkoumano || '', p.w * p.h);
    s.otevrene = new Set((d.otevrene || []).filter(i => p.mapa[i] === T.DVERE || (d.odhalene || []).includes(i)));
    if (d.verze >= 2) {                          // verze 1 (jen procházení) potvory ani postavu neměla
      const vychozi = s.hrac;
      s.jmeno = d.jmeno; s.rod = d.rod; Object.assign(s.hrac, d.hrac);
      if (d.verze === 2) {                       // verze 2 ještě neměla výbavu – dostane výchozí
        s.hrac.vybava = vychozi.vybava; s.hrac.batoh = vychozi.batoh; s.hrac.sytost = 100;
        delete s.hrac.zbran;
      }
      s.zabito = d.zabito | 0; s.tajne = d.tajne | 0; s.zlato = d.zlato | 0; s.dalsiId = d.dalsiId | 0; s.bossu = d.bossu | 0;
      s.potvory = (d.potvory || []).filter(a => BESTIAR[a[1]]).map(a => {
        const m = {}; POLE_POTVORY.forEach((k, i) => { m[k] = a[i]; }); return m;
      });
    }
    if (d.verze >= 3) {
      s.barvyLektvaru = d.barvyLektvaru; s.zname = d.zname || ['leceni'];
      s.truhly = d.truhly || []; s.zeme = d.zeme || [];
    }
    if (d.mrize) s.mrize = new Set(d.mrize);
    if (d.paka) s.paka = d.paka;
    if (d.sebraneLouce) s.sebraneLouce = new Set(d.sebraneLouce);
    if (s.hrac.pochoden === undefined) s.hrac.pochoden = 800;       // starší uložení pochodeň neznalo
    if (s.hrac.vybava && s.hrac.vybava.luk === undefined) {          // starší uložení: luk byl ve slotu zbraně
      const v = s.hrac.vybava;
      v.luk = null; s.hrac.drzi = 'zbran';
      if (v.zbran && ZAKLADY[v.zbran.zaklad].dosah) { v.luk = v.zbran; v.zbran = null; s.hrac.drzi = 'luk'; }
    }
    if (d.verze >= 4) {
      s.pasti = d.pasti || [];
      (d.dekorace || []).forEach((u, i) => { if (s.dekorace[i]) s.dekorace[i].pouzito = !!u; });
      for (const i of d.odhalene || []) { if (p.mapa[i] === T.TAJNE) { p.mapa[i] = T.DVERE; s.odhalene.add(i); } }
      s.zamcene = new Set(d.zamcene || []);
      s.navstivene = new Set(d.navstivene || []);
    }
    if (Array.isArray(d.rychla)) s.rychla = d.rychla;
    if (d.stat) s.stat = d.stat;
    if (d.napisySvitku) { s.napisySvitku = d.napisySvitku; s.znameSvitky = d.znameSvitky || []; }
    if (d.obchod !== undefined) s.obchod = d.obchod;
    s.rng = d.rng | 0;                           // novyHrdina výše náhodu posunul
    aktualizujViditelnost(s);
    return s;
  }

  // ladicí výpis patra shora
  function ascii(p, hrac) {
    const znak = { [T.SKALA]: '█', [T.PODLAHA]: '.', [T.CHODBA]: ',', [T.DVERE]: '+', [T.OTVOR]: "'", [T.DOLU]: '▼', [T.NAHORU]: '▲', [T.TAJNE]: '▒' };
    let out = '';
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        out += hrac && hrac.x === x && hrac.y === y ? '@' : znak[p.mapa[y * p.w + x]];
      }
      out += '\n';
    }
    return out;
  }

  const API = {
    T, DX, DY, BIOMY, biom, velikostPatra, generujPatro, vzdalenosti, pruchozi,
    novaVyprava, vstupDoPatra, akce, dlazdice, dvereZavrene, blokujePohled, vidi,
    aktualizujViditelnost, serializuj, obnov, ascii, mulberry32, smichej,
    jeLouc, SANCE_LOUCE, MAX_PALIVA, TRIDY, seedDne, SCHOPNOSTI, najdiCestu, HADANKY, KLETBY, cenaPredmetu, cenaNakupu, cenaVykupu, cenaOdkleti, uObchodnika, BESTIAR, BOSSOVE, bossZiv, JMENA, potvoraNa, zkDalsi, OBTIZNOST, UCELY, DEKORACE, PASTI, dekoraceNa, pastNa, prekazkaNa, souvisle,
    ZAKLADY, SLOTY, MAX_BATOH, BATOHY, kapacita, cenaBatohu, drziLuk, vRuce, VZACNOSTI, VLASTNOSTI, LEKTVARY, novyPredmet, nahodnyPredmet, nazevPredmetu,
    vlastnostiPredmetu, skorePredmetu, slotPro, odvozene, truhlaNa, doBatohu,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.PodzemiLogika = API;
})(typeof self !== 'undefined' ? self : this);
