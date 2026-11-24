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
  // každé pásmo deseti pater má dvě prostředí (od 23. 11. 2026); tvar mapy na prostředí nezávisí
  const BIOMY = [
    { od: 1,  nazev: 'Kamenné kobky' },
    { od: 6,  nazev: 'Houbový les' },
    { od: 11, nazev: 'Zatopené jeskyně' },
    { od: 16, nazev: 'Ledové jeskyně' },
    { od: 21, nazev: 'Trpasličí doly' },
    { od: 26, nazev: 'Trpasličí město' },
    { od: 31, nazev: 'Krypta' },
    { od: 36, nazev: 'Zapomenutý chrám' },
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
  // jméno hrdiny ze seedu: křestní jméno a přídomek ve správném rodě
  const KRESTNI = {
    m: ['Bořek', 'Hostivít', 'Ondřej', 'Vilém', 'Jaroš', 'Mikuláš', 'Radomír', 'Ctibor', 'Lubor', 'Dobeš', 'Kryštof', 'Vratislav', 'Matouš', 'Zbyšek', 'Oldřich', 'Bohuslav', 'Hynek', 'Přemek'],
    z: ['Ivana', 'Morgana', 'Zdislava', 'Kateřina', 'Anežka', 'Ludmila', 'Dobroslava', 'Johana', 'Eliška', 'Milada', 'Božena', 'Radka', 'Vlasta', 'Hedvika', 'Kunhuta', 'Bohdana', 'Jitka', 'Markéta'],
  };
  const PRIDOMKY = [
    ['Zvědavý', 'Zvědavá'], ['Neohrožený', 'Neohrožená'], ['Bezruký', 'Bezruká'], ['Hbitý', 'Hbitá'], ['Poslední', 'Poslední'], ['Svítivý', 'Svítivá'],
    ['Kamenný', 'Kamenná'], ['Tichý', 'Tichá'], ['Šedivý', 'Šedivá'], ['Rudovousý', 'Rudovlasá'], ['Bdělý', 'Bdělá'], ['Prostořeký', 'Prostořeká'],
    ['z Hlubin', 'z Hlubin'], ['z Rokle', 'z Rokle'], ['od Studny', 'od Studny'], ['ze Skály', 'ze Skály'], ['z Doupěte', 'z Doupěte'], ['Loučník', 'Loučnice'],
  ];
  function jmenoHrdiny(seed) {
    const R = nahoda(smichej(seed, 0x4A3E));
    const rod = R.f() < 0.5 ? 'm' : 'z', jm = R.vyber(KRESTNI[rod]), pr = R.vyber(PRIDOMKY)[rod === 'm' ? 0 : 1];
    return [`${jm} ${pr}`, rod, Math.floor(R.f() * 2)];          // [jméno, rod, varianta portrétu]
  }
  const JMENA = [
    ['Sir Cortanus', 'm'], ['Dáma Ivana z Hlubin', 'z'], ['Bořek Zvědavý', 'm'], ['Rytíř Hostivít', 'm'],
    ['Lady Morgana', 'z'], ['Bratr Ondřej', 'm'], ['Zdislava Neohrožená', 'z'], ['Vilém Bezruký', 'm'],
    ['Kateřina Svítilna', 'z'], ['Jaroš z Rokle', 'm'], ['Anežka Hbitá', 'z'], ['Mikuláš Poslední', 'm'],
  ];

  // Jak rychle potvory sílí s patry nad svým `od` (laděno botem v _test/podzemi_boj.js).
  // vyladěno 29. 9. 2026 na rozumného bota s hromádkami, kovárnou a taktikou potvor:
  // medián všech výprav 10. patro, průměrná smrt 11,4., do 40. patra ~5 %
  // 20. 11. 2026 (večer): začátek mírnější, od 12. patra potvory rostou rychleji (bot: medián 10, do 40. patra ~2 %, dřív medián 8 / 8 %)
  const OBTIZNOST = { hpRust: 0.65, utokRust: 1.5, presnostRust: 0.031, pozdniOd: 12, hpPozdni: 0.4, utokPozdni: 1.05 };   // 23. 11.: kouzla se navádějí – pozdní patra tvrdší

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
      zk: 12, rychlost: 1, uteka: 0.25, dvere: true, spi: 0.25, vaha: 5, smecka: true,
      utokText: 'tě udeřil kyjem', minulText: 'máchl kyjem vedle', smrtText: 'Goblin padl s posledním zachrochtáním.',
      pricina: ['goblin s kyjem a pevným názorem', 'goblin, který si na tebe počkal za rohem'],
    },
    // zlatý goblin: jen náhodná událost (od 999 – generátor ho nevybírá), pořád utíká a za čas zmizí
    zlatyGoblin: {
      nom: 'Zlatý goblin', aku: 'zlatého goblina', rod: 'm', od: 999, do: 999, kodexOd: 2, hp: 12, utok: [1, 2], obrana: 1, presnost: 0.5,
      zk: 20, rychlost: 1, uteka: 1, dvere: true, spi: 0, vaha: 0,
      utokText: 'tě kousl do prstu', minulText: 'kvikl a uskočil', smrtText: 'Zlatý goblin padl – z měšce se vysypalo zlato!',
      pricina: ['zlatý goblin a jeho nečekaně ostré zuby'],
    },
    // goblin lučištník: drží se na dostřel a ustupuje; šaman léčí zraněné spojence a do boje nechodí
    lucistnik: {
      nom: 'Goblin lučištník', aku: 'goblina lučištníka', rod: 'm', od: 5, do: 16, hp: 13, utok: [2, 5], obrana: 0, presnost: 0.72,
      zk: 14, rychlost: 1, uteka: 0.3, dvere: true, spi: 0.25, vaha: 3, smecka: true, drzOdstup: true,
      strelec: { dosah: 4, sance: 0.5, utok: [2, 6], nazev: 'šíp' },
      utokText: 'tě praštil lukem', minulText: 'ohnal se lukem vedle', smrtText: 'Lučištník padl i se svým lukem.',
      pricina: ['goblin lučištník, který mířil lépe, než vypadal', 'šíp odněkud ze tmy'],
    },
    saman: {
      nom: 'Goblin šaman', aku: 'goblina šamana', rod: 'm', od: 7, do: 22, hp: 18, utok: [2, 5], obrana: 1, presnost: 0.65,
      zk: 22, rychlost: 1, uteka: 0.45, dvere: true, spi: 0.3, vaha: 2, smecka: true, drzOdstup: true,
      leci: { dosah: 5, podil: 0.35, kazdych: 3, mana: 4 },   // mana = kolikrát vyléčí (pak 1 za 15 tahů)
      utokText: 'tě šlehl holí', minulText: 'zamával holí', smrtText: 'Šamanovi zhasla koule na holi.',
      pricina: ['goblin šaman, který vyléčil celou bandu', 'šaman a jeho nesmrtelní kumpáni'],
    },
    kostlivec: {
      nom: 'Kostlivec', aku: 'kostlivce', rod: 'm', od: 6, do: 16, hp: 24, utok: [4, 9], obrana: 2, presnost: 0.75,
      zk: 16, rychlost: 0.65, uteka: 0, dvere: true, spi: 0.2, vaha: 5,
      utokText: 'tě sekl rezavým mečem', minulText: 'zachrastil a minul', smrtText: 'Kostlivec se rozsypal na hromádku kostí.',
      pricina: ['kostlivec s velmi přesvědčivým argumentem v podobě rezavého meče', 'kostlivec, kterému už nic nechybělo – kromě tvé hlavy'],
    },
    // 11–20 zatopené jeskyně (orci, utopenci, mágové)
    ork: {
      nom: 'Ork', aku: 'orka', rod: 'm', od: 11, do: 24, hp: 64, utok: [7, 13], obrana: 3, presnost: 0.74,
      zk: 34, rychlost: 1, uteka: 0.15, dvere: true, spi: 0.25, vaha: 5, smecka: true,
      utokText: 'tě sekl těžkou sekerou', minulText: 'máchl sekerou vedle', smrtText: 'Ork se s řevem skácel.',
      pricina: ['ork, který neznal slovo „slitování"', 'těžká sekera a ještě těžší ork'],
    },
    utopenec: {
      nom: 'Utopenec', aku: 'utopence', rod: 'm', od: 11, do: 22, hp: 80, utok: [6, 12], obrana: 2, presnost: 0.7,
      zk: 32, rychlost: 0.7, uteka: 0, dvere: true, spi: 0.4, vaha: 4,
      utokText: 'tě sevřel slizkýma rukama', minulText: 'natáhl ruce naprázdno', smrtText: 'Utopenec se rozplynul v louži bahna.',
      pricina: ['utopenec, který si chtěl popovídat pod vodou', 'slizké objetí z hlubin'],
    },
    // nová prostředí (23. 11. 2026): `biom` = žijí jen tam
    houbar: {
      nom: 'Houbař', aku: 'houbaře', rod: 'm', od: 6, do: 10, hp: 16, utok: [2, 5], obrana: 0, presnost: 0.72, biom: 'Houbový les',
      zk: 9, rychlost: 1, uteka: 0.2, dvere: false, spi: 0.4, vaha: 6, smecka: true,
      utokText: 'tě bodl kopím z větve', minulText: 'píchl do mechu', smrtText: 'Houbař se rozpadl na spóry.',
      pricina: ['houbař s nečekaně ostrým klackem', 'tichá smečka houbových mužíčků'],
    },
    sporovec: {
      nom: 'Spórový brouk', aku: 'spórového brouka', rod: 'm', od: 6, do: 10, hp: 22, utok: [2, 5], obrana: 2, presnost: 0.7, biom: 'Houbový les',
      zk: 11, rychlost: 0.8, uteka: 0, dvere: false, spi: 0.5, vaha: 4,
      utokText: 'tě obalil spórami', minulText: 'kýchl spóry vedle', smrtText: 'Brouk se převrátil na krovky.',
      pricina: ['spóry, které se usadily v plicích', 'brouk s houbou na zádech'],
    },
    ledDuch: {
      nom: 'Ledový duch', aku: 'ledového ducha', rod: 'm', od: 16, do: 20, hp: 34, utok: [6, 11], obrana: 1, presnost: 0.78, biom: 'Ledové jeskyně',
      zk: 30, rychlost: 1.1, uteka: 0, dvere: true, spi: 0.2, vaha: 4, strelec: { dosah: 4, sance: 0.35, nazev: 'ledový dech', utok: [4, 8] },
      utokText: 'tě sevřel mrazem', minulText: 'ovanul tě chladem', smrtText: 'Duch se rozplynul v jinovatku.',
      pricina: ['mráz, který přišel zevnitř', 'ledový duch bez slitování'],
    },
    yeti: {
      nom: 'Yeti', aku: 'yetiho', rod: 'm', od: 16, do: 20, hp: 70, utok: [8, 15], obrana: 2, presnost: 0.72, biom: 'Ledové jeskyně',
      zk: 40, rychlost: 0.9, uteka: 0, dvere: false, spi: 0.5, vaha: 3,
      utokText: 'tě udeřil obří tlapou', minulText: 'máchl do sněhu', smrtText: 'Yeti se svalil jako lavina.',
      pricina: ['yeti, o kterém všichni tvrdili, že neexistuje', 'lavina chlupů a svalů'],
    },
    ledPavouk: {
      nom: 'Ledový pavouk', aku: 'ledového pavouka', rod: 'm', od: 16, do: 20, hp: 30, utok: [5, 10], obrana: 3, presnost: 0.8, biom: 'Ledové jeskyně',
      zk: 28, rychlost: 1.3, uteka: 0, dvere: false, spi: 0.3, vaha: 4,
      utokText: 'tě kousl mrazivými kusadly', minulText: 'cvakl do ledu', smrtText: 'Pavouk se roztříštil na střepy.',
      pricina: ['pavouk z ledu a hladu', 'mrazivé kousnutí'],
    },
    automat: {
      nom: 'Trpasličí automat', aku: 'trpasličí automat', rod: 'm', od: 26, do: 30, hp: 90, utok: [10, 18], obrana: 5, presnost: 0.75, biom: 'Trpasličí město',
      zk: 60, rychlost: 0.8, uteka: 0, dvere: true, spi: 0.6, vaha: 3,
      utokText: 'tě praštil parním kladivem', minulText: 'zasyčel párou', smrtText: 'Automat zaskřípal a zhasl.',
      pricina: ['trpasličí stroj, který zapomněl vypnout', 'pára, ozubená kola a kladivo'],
    },
    trpDuch: {
      nom: 'Trpasličí duch', aku: 'trpasličího ducha', rod: 'm', od: 26, do: 30, hp: 55, utok: [9, 16], obrana: 2, presnost: 0.8, biom: 'Trpasličí město',
      zk: 50, rychlost: 1.1, uteka: 0, dvere: true, spi: 0.2, vaha: 4,
      utokText: 'tě sekl přízračnou sekerou', minulText: 'zaúpěl v prázdnu', smrtText: 'Duch trpaslíka konečně odpočívá.',
      pricina: ['trpaslík, který neodešel ani po smrti', 'přízračná sekera'],
    },
    runovyStrazce: {
      nom: 'Runový strážce', aku: 'runového strážce', rod: 'm', od: 26, do: 30, hp: 110, utok: [11, 19], obrana: 6, presnost: 0.7, biom: 'Trpasličí město',
      zk: 70, rychlost: 0.7, uteka: 0, dvere: false, spi: 0.7, vaha: 2,
      utokText: 'tě udeřil kamennou pěstí', minulText: 'runy zablikaly naprázdno', smrtText: 'Runy pohasly a socha se rozpadla.',
      pricina: ['kámen, který si pamatoval rozkaz', 'runový strážce trpasličí brány'],
    },
    kultista: {
      nom: 'Kultista', aku: 'kultistu', rod: 'm', od: 36, do: 40, hp: 70, utok: [12, 20], obrana: 3, presnost: 0.82, biom: 'Zapomenutý chrám',
      zk: 70, rychlost: 1.1, uteka: 0.15, dvere: true, spi: 0.2, vaha: 5, smecka: true,
      utokText: 'tě bodl obětní dýkou', minulText: 'zamumlal kletbu', smrtText: 'Kultista padl na oltář vlastní víry.',
      pricina: ['kultista, který potřeboval oběť', 'obětní dýka'],
    },
    chramStrazce: {
      nom: 'Chrámový strážce', aku: 'chrámového strážce', rod: 'm', od: 36, do: 40, hp: 120, utok: [13, 22], obrana: 7, presnost: 0.75, biom: 'Zapomenutý chrám',
      zk: 85, rychlost: 0.8, uteka: 0, dvere: false, spi: 0.6, vaha: 3,
      utokText: 'tě probodl zlatým kopím', minulText: 'zaduněl štítem', smrtText: 'Zlatá socha se zhroutila.',
      pricina: ['strážce, který nikoho nepustí', 'zlaté kopí'],
    },
    serafin: {
      nom: 'Padlý serafín', aku: 'padlého serafína', rod: 'm', od: 36, do: 40, hp: 95, utok: [14, 24], obrana: 4, presnost: 0.85, biom: 'Zapomenutý chrám',
      zk: 100, rychlost: 1.2, uteka: 0, dvere: true, spi: 0.2, vaha: 2, strelec: { dosah: 5, sance: 0.4, nazev: 'temný paprsek', utok: [10, 17] },
      utokText: 'tě šlehl temným křídlem', minulText: 'zašuměl křídly', smrtText: 'Serafín se rozpadl v popel a peří.',
      pricina: ['anděl, který padl hlouběji než ty', 'temný paprsek z výšky'],
    },
    sliz: {
      nom: 'Velký sliz', aku: 'velký sliz', rod: 's', od: 3, do: 25, hp: 30, utok: [3, 7], obrana: 0, presnost: 0.7,
      zk: 14, rychlost: 0.7, uteka: 0, dvere: false, spi: 0.5, vaha: 2,
      utokText: 'tě pohltilo slizem', minulText: 'čvachtlo vedle', smrtText: 'Sliz se rozlil po podlaze.',
      pricina: ['sliz, který tě rozpustil', 'zelená rosolovitá smrt'],
    },
    malySliz: {
      nom: 'Malý sliz', aku: 'malý sliz', rod: 's', od: 999, do: 999, kodexOd: 3, kodexDo: 25, hp: 12, utok: [2, 4], obrana: 0, presnost: 0.7,
      zk: 5, rychlost: 1, uteka: 0, dvere: false, spi: 0, vaha: 0,
      utokText: 'tě ožahlo slizem', minulText: 'čvachtlo naprázdno', smrtText: 'Malý sliz splaskl.',
      pricina: ['malý sliz s velkými ambicemi'],
    },
    // potvory s vlastním trikem (24. 11. 2026)
    kapsar: {
      nom: 'Kapsář', aku: 'kapsáře', rod: 'm', od: 3, do: 14, hp: 14, utok: [2, 4], obrana: 1, presnost: 0.8, kradez: true,
      zk: 10, rychlost: 1.4, uteka: 0, dvere: true, spi: 0.3, vaha: 3,
      utokText: 'tě šťouchl dýkou', minulText: 'sáhl vedle', smrtText: 'Kapsář pustil kořist z prstů.',
      pricina: ['kapsář, kterému nestačilo zlato', 'drobná dýka v rukou zloděje'],
    },
    jezek: {
      nom: 'Ostnatec', aku: 'ostnatce', rod: 'm', od: 4, do: 15, hp: 26, utok: [3, 6], obrana: 4, presnost: 0.7, trny: 0.35,
      zk: 14, rychlost: 0.8, uteka: 0, dvere: false, spi: 0.5, vaha: 3,
      utokText: 'tě napíchl bodlinami', minulText: 'zachrastil bodlinami', smrtText: 'Ostnatec se svinul a znehybněl.',
      pricina: ['bodliny, na které se nesahá', 'ostnatec, kterého někdo kopl'],
    },
    mimik: {
      // od/do 999: nikdy se nelosuje mezi běžné potvory (přepadení, bloudící, posily) – jen truhla se v něj promění (5. patro+)
      nom: 'Mimik', aku: 'mimika', rod: 'm', od: 999, do: 999, kodexOd: 5, rustOd: 5, hp: 34, utok: [6, 11], obrana: 3, presnost: 0.85,
      zk: 28, rychlost: 1, uteka: 0, dvere: false, spi: 1, vaha: 0,
      utokText: 'tě kousl víkem plným zubů', minulText: 'sklapl víko naprázdno', smrtText: 'Mimik se rozpadl na prkna a zuby.',
      pricina: ['truhla, která měla hlad', 'chamtivost a jedna zubatá truhla'],
    },
    nadymka: {
      nom: 'Nadýmka', aku: 'nadýmku', rod: 'z', od: 6, do: 18, hp: 18, utok: [2, 5], obrana: 0, presnost: 0.7, vybuchPriSmrti: true,
      zk: 12, rychlost: 0.7, uteka: 0, dvere: false, spi: 0.4, vaha: 3,
      utokText: 'tě ovanula spórami', minulText: 'zafuněla vedle', smrtText: 'Nadýmka praskla v oblaku spór!',
      pricina: ['nadýmka, která praskla příliš blízko', 'oblak jedovatých spór'],
    },
    stin: {
      nom: 'Stín', aku: 'stín', rod: 'm', od: 12, do: 35, hp: 34, utok: [7, 12], obrana: 2, presnost: 0.85, neviditelny: true,
      zk: 32, rychlost: 1.2, uteka: 0, dvere: true, spi: 0.2, vaha: 3,
      utokText: 'tě sekl drápy ze tmy', minulText: 'zašuměl ve tmě', smrtText: 'Stín se rozplynul ve světle.',
      pricina: ['stín, který nebyl vidět', 'drápy ze tmy'],
    },
    bazilisek: {
      nom: 'Bazilišek', aku: 'baziliška', rod: 'm', od: 14, do: 32, hp: 50, utok: [8, 14], obrana: 4, presnost: 0.78, zkamenuje: true,
      zk: 45, rychlost: 0.9, uteka: 0, dvere: false, spi: 0.4, vaha: 2,
      utokText: 'tě kousl jedovatou tlamou', minulText: 'zasyčel', smrtText: 'Baziliškovy oči pohasly.',
      pricina: ['pohled, který tě proměnil v kámen', 'bazilišek a jeho oči'],
    },
    vyvolavac: {
      nom: 'Vyvolávač', aku: 'vyvolávače', rod: 'm', od: 20, do: 42, hp: 55, utok: [8, 13], obrana: 2, presnost: 0.78, oziveni: true, drzOdstup: true,
      zk: 55, rychlost: 1, uteka: 0, dvere: true, spi: 0.3, vaha: 2,
      utokText: 'tě udeřil kostěnou holí', minulText: 'zachroptěl zaříkadlo', smrtText: 'Vyvolávač se rozsypal na prach.',
      pricina: ['vyvolávač a jeho kostěná armáda', 'mrtví, kteří nezůstali mrtví'],
    },
    upirPan: {
      nom: 'Upíří pán', aku: 'upířího pána', rod: 'm', od: 28, do: 48, hp: 90, utok: [12, 20], obrana: 4, presnost: 0.85, regenerace: 4, vysava: true,
      zk: 90, rychlost: 1.1, uteka: 0, dvere: true, spi: 0.3, vaha: 2,
      utokText: 'se ti zakousl do krku', minulText: 'zasyčel a ucukl', smrtText: 'Upíří pán se rozpadl v popel.',
      pricina: ['upíří pán, který měl žízeň', 'věčný hlad po krvi'],
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
      utokText: 'tě zasáhl magickým výbojem', minulText: 'minul magickým výbojem', smrtText: 'Mág se rozpadl v hromádku popela.',
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
  // druhy zranění: sek, drt (drtivé), bod, strela, ohen, mraz, blesk, jed, svetlo, magie
  // násobek zranění podle potvory (chybí = 1); 0 = imunní. Bestiář si odhalené slabiny pamatuje.
  const ODOLNOSTI_POTVOR = {
    had: { jed: 0 }, pavouk: { ohen: 1.5 }, zabak: { jed: 0.5 }, mag: { magie: 0.75 }, kapitan: { blesk: 1.5 },
    kostlivec: { drt: 1.5, sek: 0.75, bod: 0.5, svetlo: 1.5, jed: 0 },
    prizrak: { sek: 0.25, drt: 0.25, bod: 0.25, strela: 0.25, magie: 1.5, svetlo: 2, jed: 0 },
    ohnivak: { ohen: 0, mraz: 1.75 }, demon: { ohen: 0.5, svetlo: 1.5 }, ohnivyDemon: { ohen: 0, mraz: 1.5, svetlo: 1.25 },
    golem: { sek: 0.5, bod: 0.5, drt: 1.3, blesk: 0.5, jed: 0 }, rytir: { sek: 0.75, bod: 0.75, drt: 1.25, blesk: 1.3 },
    lich: { svetlo: 2, jed: 0, mraz: 0.5 }, utopenec: { ohen: 0.5, blesk: 1.5, jed: 0 }, bezejmenny: { svetlo: 1.5, jed: 0 }, srdce: { jed: 0 },
    kovar: { ohen: 0, mraz: 1.5, drt: 0.75 },
    houbar: { ohen: 1.75, jed: 0 }, sporovec: { ohen: 1.5, jed: 0 },
    ledDuch: { ohen: 2, mraz: 0, sek: 0.5, drt: 0.5, bod: 0.5, strela: 0.5 }, yeti: { ohen: 1.5, mraz: 0 }, ledPavouk: { ohen: 1.75, mraz: 0, drt: 1.5 },
    automat: { blesk: 1.75, jed: 0, sek: 0.5, drt: 1.25 }, trpDuch: { sek: 0.25, drt: 0.25, bod: 0.25, strela: 0.25, svetlo: 2, jed: 0 },
    runovyStrazce: { sek: 0.5, bod: 0.5, strela: 0.5, drt: 1.5, magie: 0.75, jed: 0 },
    kultista: { svetlo: 1.5 }, chramStrazce: { sek: 0.5, bod: 0.75, drt: 1.3, blesk: 1.3, jed: 0 }, serafin: { svetlo: 0.5, ohen: 0.75, magie: 1.25 },
    sliz: { sek: 0.75, ohen: 1.5, jed: 0 }, malySliz: { ohen: 1.5, jed: 0 },
    stin: { sek: 0.5, drt: 0.5, bod: 0.5, strela: 0.5, svetlo: 2 }, upirPan: { svetlo: 2, ohen: 1.5, jed: 0 }, jezek: { drt: 1.25, bod: 0.75 },
    nadymka: { ohen: 2, jed: 0 }, bazilisek: { jed: 0.5 }, vyvolavac: { svetlo: 1.75, jed: 0 }, mimik: { ohen: 1.5, sek: 0.75 },
  };
  const STOPA_POTVORY = { kostlivec: 'kosti', lich: 'kosti', rytir: 'kosti', prizrak: 'popel', ohnivak: 'popel', ohnivyDemon: 'popel', demon: 'popel', kovar: 'popel', serafin: 'popel',
    sliz: 'sliz', malySliz: 'sliz', zabak: 'sliz', utopenec: 'sliz', ledDuch: 'led', ledPavouk: 'led', yeti: 'krev', houbar: 'spory', sporovec: 'spory', golem: 'kamen', runovyStrazce: 'kamen',
    chramStrazce: 'kamen', automat: 'olej', trpDuch: 'popel', bezejmenny: 'sliz', srdce: 'popel',
    stin: 'popel', nadymka: 'spory', vyvolavac: 'kosti', upirPan: 'popel', jezek: 'krev', kapsar: 'krev', bazilisek: 'krev', mimik: 'kamen' };
  const NEMRTVI = new Set(['vyvolavac', 'upirPan', 'kostlivec', 'prizrak', 'lich', 'utopenec', 'trpDuch', 'ledDuch', 'bezejmenny']);
  const nasobekZraneni = (druh, typ) => { const o = ODOLNOSTI_POTVOR[druh]; return o && typ && o[typ] !== undefined ? o[typ] : 1; };
  const TYP_KOUZLA = { jiskra: 'ohen', ohen: 'ohen', meteor: 'ohen', led: 'mraz', vanice: 'mraz', blesk: 'blesk', retez: 'blesk', jed: 'jed', upir: 'magie', otres: 'drt', svetloKnez: 'svetlo' };
  function typZbrane(p, strela) {
    if (strela) return 'strela';
    if (!p) return 'drt';                                  // pěsti
    const z = ZAKLADY[p.zaklad];
    if (z.ikona === 'dyka' || z.bodne) return 'bod';
    if (z.omraci || z.ikona === 'hulka') return 'drt';
    return 'sek';
  }
  // stavy hrdiny: otrava, krvácení, omrzlina – [stav, šance, tahů]
  const NAKAZY = {
    had: ['otrava', 0.35, 6], pavouk: ['otrava', 0.3, 6], sporovec: ['otrava', 0.4, 6], zabak: ['otrava', 0.2, 4],
    pes: ['krvaceni', 0.3, 5], krysa: ['krvaceni', 0.15, 3], kultista: ['krvaceni', 0.35, 5], yeti: ['krvaceni', 0.25, 4],
    ledDuch: ['omrzlina', 0.4, 6], ledPavouk: ['omrzlina', 0.3, 5], upirPan: ['krvaceni', 0.35, 5], bazilisek: ['otrava', 0.3, 6],
  };
  const STAVY = {
    otrava: { nazev: 'Otrava', ikona: '🤢', popis: 'každé 2 tahy −1 zdraví (hlouběji víc)', lek: 'protijed' },
    krvaceni: { nazev: 'Krvácení', ikona: '🩸', popis: 'každý tah −1 zdraví', lek: 'obvaz' },
    omrzlina: { nazev: 'Omrzlina', ikona: '🥶', popis: 'přesnost −15 %, neuhneš', lek: 'teplo (lektvar léčení, táborák)' },
  };
  // na 50. patře čeká Srdce hlubin – cíl výpravy (dál pokračuje nekonečný režim)
  const BOSSOVE = ['krysiKral', 'kapitan', 'kovar', 'lich', 'srdce', 'ohnivyDemon'];
  const CIL_PATRO = 50;
  // deník mistra Ondřeje: stránka č. k leží na patře 3k (16 stránek)
  const STRANKY = [
    'Den první. Vesničané tvrdí, že hora dýchá. Já, Ondřej z Brodu, mapař a hledač, jdu zjistit proč. Kdo najde tento deník, ať jde za mnou.',
    'Krysy tu nejsou obyčejné. Jsou chytré a táhnou dolů, jako by je něco volalo. Slyším pod podlahou tlukot – pomalý, hluboký.',
    'Našel jsem houby, které svítí. Houbaři – malí mužíci z klobouků – mě nechali projít, když jsem jim dal chleba. Na oplátku mi ukázali cestu níž.',
    'Krysí král je mrtvý. Jeho koruna byla z mosazi trpasličí výroby. Kde ji vzal? Trpaslíci prý odešli z hor před dvěma sty lety.',
    'Voda. Všude voda a utonulí, kteří se neutopili sami. Kapitán dole nosí klíč, na kterém je stejná runa jako na koruně.',
    'Led v hloubce, kde by mělo být teplo. Něco tu kradě žár z kamene. Tlukot je silnější – cítím ho v zubech.',
    'Trpasličí doly! Kolejnice vedou jen dolů. Na stěnách píšou: „Kopali jsme pro srdce hory a ono nás našlo."',
    'Kovář z rozžhaveného železa nebyl trpaslík. Byl to jejich stroj – a ten pořád kuje. Pro koho?',
    'Trpasličí město je prázdné, ale ne mrtvé. Duchové trpaslíků opakují poslední směnu. Jeden mi řekl: „Nekopej hlouběji."',
    'Kopu hlouběji. Krypta pod městem je starší než trpaslíci. Lich na trůnu znal Srdce jménem.',
    'Chrám. Fresky ukazují lidi, kteří Srdci obětovali světlo – a Srdce jim dalo věčnost. Kultisté tu pořád jsou. Věčnost nevypadá dobře.',
    'Serafín padl, když chtěl Srdce zastavit. Jeho peří je černé. Mám strach, ale nohy jdou dál samy.',
    'Láva. Hora tu krvácí. Teď už vím: Srdce hlubin je živé a roste – každou výpravou, každou smrtí tady dole.',
    'Podivno. Stěny se mění, když se nedívám. Moje mapy přestaly sedět. Tlukot je všude.',
    'Vidím ho. Obrovský krystal s žilami magmatu. Každý úder vytlačí do chodeb další nestvůry. Kdo ho rozbije, osvobodí horu.',
    'Nemám sil. Nechávám tu deník pro tebe, poutníku. Padesáté patro. Rozbij ho. A pak – pokud chceš – jdi ještě hlouběji. Hora je nekonečná.',
  ];
  function strankaPatra(s) {                // stránka deníku na patře 3, 6, … 48 (vlastní náhoda, ukládá se se zemí)
    const p = s.mapaPatra;
    if (p.patro % 3 || p.patro > 48) return;
    const R = nahoda(smichej(s.seed ^ 0x57A7, p.patro)), cislo = p.patro / 3;
    const mistnosti = p.mistnosti.filter(m => !m.tajna && !m.boss && !['obchod', 'kovarna'].includes(m.ucel));
    const m = mistnosti[Math.floor(R.f() * mistnosti.length)];
    if (!m) return;
    const c = volneVMistnosti(s, m, R);
    if (!c) return;
    const q = novyPredmet(s, 'stranka'); q.cislo = cislo;
    s.zeme.push({ x: c.x, y: c.y, predmety: [q], zlato: 0 });
  }
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
    ruda: { typ: 'surovina', ikona: 'ruda', nazev: 'Železná ruda', lvl: 1 },
    // klíčové předměty: krumpáč prokope zeď, lano = nouzový sestup o patro, lucerna šetří pochodeň a svítí dál
    krumpac: { typ: 'nastroj', ikona: 'krumpac', nazev: 'Krumpáč', lvl: 3, vydrz: 6 },
    lano: { typ: 'nastroj', ikona: 'lano', nazev: 'Lano', lvl: 2 },
    lucerna: { typ: 'nastroj', ikona: 'lucerna', nazev: 'Lucerna', lvl: 4 },
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
    // palcáty – zásah může potvoru omráčit (ztratí tah)
    palcat1: { typ: 'zbran', ikona: 'sekera', nazev: 'Palcát', lvl: 2, min: 4, max: 8, rychlost: 1, omraci: 0.2 },
    palcat2: { typ: 'zbran', ikona: 'sekera', nazev: 'Ocelový palcát', lvl: 9, min: 7, max: 13, rychlost: 1, omraci: 0.22 },
    palcat3: { typ: 'zbran', ikona: 'sekera', nazev: 'Trpasličí kladivo', lvl: 17, min: 11, max: 20, rychlost: 1, omraci: 0.25 },
    // kopí – dosáhnou i na potvoru o pole dál
    kopi1: { typ: 'zbran', ikona: 'mec', nazev: 'Kopí', lvl: 2, min: 3, max: 7, rychlost: 1, bodne: true },
    kopi2: { typ: 'zbran', ikona: 'mec', nazev: 'Ocelové kopí', lvl: 8, min: 6, max: 11, rychlost: 1, bodne: true },
    kopi3: { typ: 'zbran', ikona: 'mec', nazev: 'Elfí kopí', lvl: 16, min: 9, max: 16, rychlost: 1, bodne: true },
    // kuše – silné střely, ale nabití stojí tah navíc
    kuse1: { typ: 'zbran', ikona: 'luk', nazev: 'Lehká kuše', lvl: 4, min: 6, max: 11, rychlost: 2, dosah: 5 },
    kuse2: { typ: 'zbran', ikona: 'luk', nazev: 'Těžká kuše', lvl: 11, min: 10, max: 18, rychlost: 2, dosah: 6 },
    kuse3: { typ: 'zbran', ikona: 'luk', nazev: 'Opakovací kuše', lvl: 19, min: 13, max: 22, rychlost: 2, dosah: 6 },
    // hole – slabé rány, ale posílí magii
    hul1: { typ: 'zbran', ikona: 'hulka', nazev: 'Sukovitá hůl', lvl: 2, min: 2, max: 5, rychlost: 1, magie: 1 },
    hul2: { typ: 'zbran', ikona: 'hulka', nazev: 'Hůl mága', lvl: 9, min: 3, max: 7, rychlost: 1, magie: 3 },
    hul3: { typ: 'zbran', ikona: 'hulka', nazev: 'Hůl arcimága', lvl: 18, min: 5, max: 10, rychlost: 1, magie: 5 },
    // byliny pro alchymii (vaří se u kotle, táboráku nebo alchymistického stolu)
    bylina: { typ: 'bylina', ikona: 'jablko', nazev: 'Léčivé byliny', lvl: 1 },
    houba: { typ: 'bylina', ikona: 'jablko', nazev: 'Svítící houba', lvl: 1 },
    kvet: { typ: 'bylina', ikona: 'jablko', nazev: 'Ohnivý květ', lvl: 3 },
    mech: { typ: 'bylina', ikona: 'jablko', nazev: 'Měsíční mech', lvl: 5 },
    // legendární unikáty: pevné vlastnosti, vždy legendární kvalita
    uZora: { typ: 'zbran', ikona: 'mec', nazev: 'Zora, plamen úsvitu', lvl: 12, min: 11, max: 19, rychlost: 1, ohen: 4, unikat: { sila: 2 } },
    uSepot: { typ: 'zbran', ikona: 'dyka', nazev: 'Šepot stínu', lvl: 10, min: 8, max: 14, rychlost: 1, presnost: 20, unikat: { presnost: 10 } },
    uMraz: { typ: 'zbran', ikona: 'sekera', nazev: 'Mrazivý zub', lvl: 14, min: 16, max: 28, rychlost: 2, unikat: { sila: 3, obrana: 1 } },
    uSvetostrom: { typ: 'zbran', ikona: 'luk', nazev: 'Luk Světového stromu', lvl: 13, min: 8, max: 15, rychlost: 1, dosah: 7, unikat: { presnost: 15 } },
    uSlunce: { typ: 'zbran', ikona: 'sekera', nazev: 'Slunečné kladivo', lvl: 15, min: 13, max: 22, rychlost: 1, omraci: 0.35, unikat: { zdravi: 10 } },
    uHrom: { typ: 'zbran', ikona: 'mec', nazev: 'Hromové kopí', lvl: 15, min: 11, max: 19, rychlost: 1, bodne: true, ohen: 3, unikat: { sila: 2 } },
    uDrak: { typ: 'stit', ikona: 'stit', nazev: 'Dračí štít', lvl: 12, obrana: 4, unikat: { zdravi: 12, obrana: 1 } },
    uSlza: { typ: 'amulet', ikona: 'amulet', nazev: 'Slza světice', lvl: 10, zdravi: 5, unikat: { zdravi: 15, magie: 2 } },
    uOko: { typ: 'prsten', ikona: 'prsten', nazev: 'Žhnoucí oko', lvl: 10, unikat: { sila: 2, presnost: 10, magie: 1 } },
    uHvezda: { typ: 'zbran', ikona: 'hulka', nazev: 'Hvězdná hůl', lvl: 14, min: 6, max: 12, rychlost: 1, magie: 6, unikat: { zdravi: 8 } },
    // sady: bonus za 2 a 3 nasazené kusy (SADY)
    sTrpHelma: { typ: 'helma', ikona: 'helma', nazev: 'Koruna trpasličího krále', lvl: 9, obrana: 3, sada: 'trpaslik', unikat: {} },
    sTrpBrneni: { typ: 'brneni', ikona: 'brneni', nazev: 'Zbroj trpasličího krále', lvl: 11, obrana: 5, sada: 'trpaslik', unikat: {} },
    sTrpBoty: { typ: 'boty', ikona: 'boty', nazev: 'Boty trpasličího krále', lvl: 9, obrana: 2, zdravi: 5, sada: 'trpaslik', unikat: {} },
    sHraBrneni: { typ: 'brneni', ikona: 'brneni', nazev: 'Plášť hraničáře', lvl: 8, obrana: 2, presnost: 10, sada: 'hranicar', unikat: {} },
    sHraHelma: { typ: 'helma', ikona: 'helma', nazev: 'Kápě hraničáře', lvl: 8, obrana: 1, presnost: 5, sada: 'hranicar', unikat: {} },
    sHraBoty: { typ: 'boty', ikona: 'boty', nazev: 'Holínky hraničáře', lvl: 8, obrana: 1, zdravi: 5, sada: 'hranicar', unikat: {} },
    // runy: vkládají se do drážek zbraní a zbroje (vzácnější věc = víc drážek)
    runaOhen: { typ: 'runa', ikona: 'svitek', nazev: 'Runa ohně', lvl: 4, runa: 'ohen' },
    runaMraz: { typ: 'runa', ikona: 'svitek', nazev: 'Runa mrazu', lvl: 4, runa: 'mraz' },
    runaVysavani: { typ: 'runa', ikona: 'svitek', nazev: 'Runa vysávání', lvl: 6, runa: 'vysavani' },
    runaStesti: { typ: 'runa', ikona: 'svitek', nazev: 'Runa štěstí', lvl: 4, runa: 'stesti' },
    runaSila: { typ: 'runa', ikona: 'svitek', nazev: 'Runa síly', lvl: 4, runa: 'sila' },
    runaOchrana: { typ: 'runa', ikona: 'svitek', nazev: 'Runa ochrany', lvl: 4, runa: 'ochrana' },
    runaHbitost: { typ: 'runa', ikona: 'svitek', nazev: 'Runa hbitosti', lvl: 5, runa: 'hbitost' },
    runaSvetlo: { typ: 'runa', ikona: 'svitek', nazev: 'Runa světla', lvl: 5, runa: 'svetlo' },
    // léky na stavy, příběh, předměty povolání
    protijed: { typ: 'lek', ikona: 'lektvar', nazev: 'Protijed', lvl: 1, leci: 'otrava' },
    obvaz: { typ: 'lek', ikona: 'chleb', nazev: 'Obvaz', lvl: 1, leci: 'krvaceni' },
    stranka: { typ: 'stranka', ikona: 'kniha', nazev: 'Stránka deníku', lvl: 1 },
    srdceHlubin: { typ: 'trofej', ikona: 'srdceIk', nazev: 'Srdce hlubin', lvl: 1 },
    svecenaVoda: { typ: 'lek', ikona: 'lektvar', nazev: 'Svěcená voda', lvl: 1, leci: 'vse' },
    klic: { typ: 'klic', ikona: 'klic', nazev: 'Klíč od pokladnice', lvl: 1 },
    denikUkol: { typ: 'ukol', ikona: 'kniha', nazev: 'Deník padlého dobrodruha', lvl: 1 },
  };
  const SLOTY = ['zbran', 'luk', 'stit', 'helma', 'brneni', 'boty', 'amulet', 'prsten1', 'prsten2'];
  const SADY = {
    trpaslik: { nazev: 'Výstroj trpasličího krále', bonus: { 2: { zdravi: 15 }, 3: { obrana: 2, sila: 2 } }, popis: '2 kusy: zdraví +15 · 3 kusy: obrana +2, síla +2' },
    hranicar: { nazev: 'Výstroj hraničáře', bonus: { 2: { presnost: 10 }, 3: { dosah: 1, uhyb: 5 } }, popis: '2 kusy: přesnost +10 % · 3 kusy: luk dostřelí o pole dál, úhyb +5 %' },
  };
  // společník: věrný pes nebo žoldák (najímá se u obchodníka); roste s úrovní hrdiny
  const SPOLECNICI = {
    pes: { nazev: 'Věrný pes', hp: 20, hpUr: 5, utok: [2, 5], obrana: 1, cena: 120 },
    zoldak: { nazev: 'Žoldák', hp: 34, hpUr: 7, utok: [4, 8], obrana: 3, cena: 260 },
    vlk: { nazev: 'Stínový vlk', hp: 16, hpUr: 4, utok: [3, 7], obrana: 1, cena: 0, vyvolany: true },
    kostlivec: { nazev: 'Kostlivec-sluha', hp: 18, hpUr: 5, utok: [4, 7], obrana: 2, cena: 0, vyvolany: true },
  };
  const cenaSpolecnika = (s, k) => Math.round((SPOLECNICI[k].cena + 18 * s.patro) * (ma(s, 'smlouvac') ? 0.8 : 1));
  const cenaZapomneni = s => 40 + 25 * s.hrac.uroven;
  function srovnejSpolecnika(s, vynutit) {
    const c = s.spolecnik; if (!c) return;
    const D = SPOLECNICI[c.druh], u = s.hrac.uroven;
    if (c.uroven !== u || vynutit) {
      const pred = c.maxHp, v = c.vybava ? vlastnostiPredmetu(c.vybava) : {};
      c.uroven = u; c.maxHp = D.hp + D.hpUr * (u - 1) + (v.zdravi || 0); c.hp = Math.min(c.maxHp, c.hp + Math.max(0, c.maxHp - pred));
    }
  }
  const obranaSpolecnika = c => SPOLECNICI[c.druh].obrana + Math.floor(c.uroven / 3) + (c.vybava ? (vlastnostiPredmetu(c.vybava).obrana || 0) : 0);
  // tah společníka: stojí na poli hrdiny a útočí na probuzenou potvoru vedle něj
  function tahSpolecnika(s, ud) {
    const c = s.spolecnik; if (!c || s.mrtvy) return;
    if (c.docasny && s.tah >= c.docasny) { ud.push({ typ: 'vlkZmizel', x: c.x, y: c.y }); s.spolecnik = null; return; }
    srovnejSpolecnika(s);
    c.x = s.x; c.y = s.y;                          // stojí na stejném poli jako hrdina (nepřekáží v chodbách)
    const D = SPOLECNICI[c.druh];
    if (s.tah % 5 === 0 && c.hp < c.maxHp) c.hp++;
    let cil = null;                                // probuzená potvora vedle hrdiny, nejdřív ta před ním
    for (const k of [s.smer, (s.smer + 1) % 4, (s.smer + 3) % 4, (s.smer + 2) % 4]) { const m = potvoraNa(s, s.x + DX[k], s.y + DY[k]); if (m && m.stav !== 'spi') { cil = m; break; } }
    if (cil) {
      const b = BESTIAR[cil.druh], dmg = Math.max(1, Ri(s, D.utok[0], D.utok[1]) + Math.floor(c.uroven / 2) - Math.floor(b.obrana / 2));
      ud.push({ typ: 'spolecnikUtok', druh: c.druh, id: cil.id, x: cil.x, y: cil.y, dmg });
      const od = ud.length;
      zranPotvoru(s, cil, dmg, ud, false, c.druh === 'zoldak' || c.druh === 'kostlivec' ? 'sek' : 'bod');
      for (let i = od; i < ud.length; i++) if (ud[i].typ === 'zasah' && ud[i].id === cil.id) ud[i].spolecnik = true;   // číslo zásahu patří společníkovi
      if (cil.hp > 0 && (c.druh === 'pes' || c.druh === 'vlk') && c.uroven >= 8 && !b.boss && Rs(s) < 0.2) { cil.energie = Math.min(cil.energie, -1); ud.push({ typ: 'omracen', id: cil.id, druh: cil.druh, x: cil.x, y: cil.y }); }
      return;
    }
  }
  function zranSpolecnika(s, m, ud) {
    const c = s.spolecnik, D = SPOLECNICI[c.druh], d = BESTIAR[m.druh];
    let dmg = Math.max(1, Ri(s, d.utok[0], d.utok[1]) + m.bonus - Math.floor(obranaSpolecnika(c) / 2));
    if (c.druh === 'zoldak' && c.uroven >= 8 && Rs(s) < 0.25) dmg = Math.ceil(dmg / 2);   // zkušený žoldák kryje štítem
    c.hp -= dmg;
    ud.push({ typ: 'spolecnikZranen', druh: c.druh, id: m.id, dmg, x: c.x, y: c.y });
    if (c.hp <= 0) { ud.push({ typ: 'spolecnikPadl', druh: c.druh, nazev: D.nazev, x: c.x, y: c.y }); s.spolecnik = null; }
  }
  const UNIKATY = () => Object.keys(ZAKLADY).filter(k => ZAKLADY[k].unikat);
  function novyUnikat(s, k) {
    const p = novyPredmet(s, k, { uroven: ZAKLADY[k].lvl });
    p.vzacnost = 4; p.unikat = true; p.bonusy = Object.assign({}, ZAKLADY[k].unikat);
    return p;
  }
  // receptury alchymie: dvě přísady → lektvar (uvařený lektvar hrdina pozná)
  const RECEPTY = {
    leceni: { prisady: ['bylina', 'bylina'] },
    velkeLeceni: { prisady: ['bylina', 'houba'] },
    sytost: { prisady: ['houba', 'houba'] },
    sila: { prisady: ['kvet', 'houba'] },
    odolnost: { prisady: ['kvet', 'bylina'] },
    osviceni: { prisady: ['mech', 'bylina'] },
    zkusenost: { prisady: ['mech', 'kvet'] },
    mana: { prisady: ['houba', 'mech'] },
  };
  const VARNY = ['kotel', 'taborak', 'alchymie'];
  const uVarny = s => s.dekorace.some(d => VARNY.includes(d.druh) && !d.rozbito && Math.abs(d.x - s.x) + Math.abs(d.y - s.y) <= 1);
  const maPrisady = (s, rec) => { const b = s.hrac.batoh, potreba = {}; for (const q of RECEPTY[rec].prisady) potreba[q] = (potreba[q] || 0) + 1;
    return Object.entries(potreba).every(([z, n]) => b.filter(p => p.zaklad === z).reduce((a, p) => a + kusu(p), 0) >= n); };
  // obtížnost výpravy (volí se při založení) a kletby hlubokých pater (od 41. patra)
  const OBTIZNOSTI = {
    lehka: { nazev: 'Lehká', hp: 0.75, utok: -1, popis: 'potvory slabší' },
    normalni: { nazev: 'Normální', hp: 1, utok: 0, popis: 'jak to bylo vždycky' },
    tezka: { nazev: 'Těžká', hp: 1.3, utok: 2, popis: 'potvory silnější, víc zkušeností' },
  };
  const KLETBY_PATRA = {
    tma: { nazev: 'Patro temnoty', popis: 'pochodeň hoří dvakrát rychleji' },
    hlad: { nazev: 'Patro hladu', popis: 'hlad přichází dvakrát rychleji' },
    zurivost: { nazev: 'Patro zuřivosti', popis: 'potvory útočí silněji' },
    odolnost: { nazev: 'Patro kamenných kůží', popis: 'potvory mají o polovinu víc zdraví' },
    bezmagie: { nazev: 'Mrtvé patro', popis: 'mana se neobnovuje' },
  };
  // kletba patra se určí ze seedu a čísla patra (nic se neukládá); odměna: zkušenosti a zlato ×1,5
  function kletbaPatra(s) {
    if (!s || s.patro <= 40 || s.patro % 10 === 0) return null;
    const R = nahoda(smichej(s.seed ^ 0xC0FFEE, s.patro));
    if (R.f() >= 0.6) return null;
    const k = Object.keys(KLETBY_PATRA); return k[Math.floor(R.f() * k.length)];
  }
  const MAX_BATOH = 16;
  // větší batohy od obchodníka – kupují se postupně, každý přidá místa k základním 16
  const BATOHY = [
    { nazev: 'Kožená brašna', navic: 4, cena: 150 },
    { nazev: 'Cestovní vak', navic: 8, cena: 400 },
    { nazev: 'Trpasličí krosna', navic: 12, cena: 900 },
  ];
  const kapacita = s => MAX_BATOH + ((BATOHY[(s.hrac.batohStupen || 0) - 1] || {}).navic || 0) + (s.hrac.taborMista || 0);
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
    mana: { nazev: 'Lektvar many', vaha: 1.6 },
  };
  const BARVY_LEKTVARU = [
    ['Rudý', '#d03030'], ['Zelený', '#40b040'], ['Modrý', '#3070e0'], ['Zlatavý', '#e0b030'], ['Kalný', '#7a6a40'],
    ['Mléčný', '#e8e8e0'], ['Černý', '#3a3040'], ['Stříbrný', '#b0b8c8'], ['Růžový', '#e070b0'],
  ];
  // pevná barva každého druhu (od 24. 11. 2026, dřív se losovala s výpravou): mana modrá, léčení rudé…
  const BARVA_DRUHU = { leceni: 'Rudý', velkeLeceni: 'Růžový', mana: 'Modrý', jed: 'Zelený', zkusenost: 'Zlatavý',
    odolnost: 'Stříbrný', osviceni: 'Mléčný', sytost: 'Kalný', sila: 'Černý' };
  const barvyLektvaru = () => Object.fromEntries(Object.keys(LEKTVARY).map((k, i) => [k, BARVY_LEKTVARU.find(b => b[0] === BARVA_DRUHU[k]) || BARVY_LEKTVARU[i % BARVY_LEKTVARU.length]]));

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
    if (z.vydrz) p.naboje = z.vydrz;
    return p;
  }

  // Náhodný předmět úrovně `uroven`; `druh` omezí výběr ('zbran', 'ochrana', 'jidlo', 'lektvar', …).
  function nahodnyPredmet(s, uroven, druh) {
    uroven = Math.max(1, uroven);
    if (!druh) druh = vazenyVyber(s, [['zbran', 2.2], ['ochrana', 3], ['sperk', 1], ['jidlo', 2.4], ['lektvar', 2.6], ['sipy', 0.8], ['magie', 1.4], ['svetlo', 1.2], ['surovina', 1], ['nastroj', 0.45], ['bylina', 1.1], ['lek', 0.8], ['runa', uroven >= 4 ? 0.35 : 0]]);
    if (druh === 'lek') return novyPredmet(s, vazenyVyber(s, [['protijed', 1], ['obvaz', 1.2]]));
    if (druh === 'runa') { const mozne = Object.keys(ZAKLADY).filter(k => ZAKLADY[k].typ === 'runa' && ZAKLADY[k].lvl <= uroven); return novyPredmet(s, mozne[Ri(s, 0, mozne.length - 1)]); }
    if (druh === 'bylina') {
      const p = novyPredmet(s, vazenyVyber(s, [['bylina', 3], ['houba', 2.2]].concat(uroven >= 3 ? [['kvet', 1.3]] : [], uroven >= 5 ? [['mech', 1]] : [])));
      p.pocet = Ri(s, 1, 2); return p;
    }
    if (druh === 'nastroj') {
      const mozne = ['lano', 'krumpac', 'lucerna'].filter(k => ZAKLADY[k].lvl <= uroven);
      return novyPredmet(s, mozne[Ri(s, 0, mozne.length - 1)] || 'lano');
    }
    if (druh === 'surovina') { const r = novyPredmet(s, 'ruda'); r.pocet = Ri(s, 1, 2 + Math.floor(uroven / 6)); return r; }
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
    if (uroven >= 8 && Rs(s) < 0.012) {                // vzácně legendární unikát nebo kus sady
      const u = UNIKATY().filter(k => typy.includes(ZAKLADY[k].typ) && ZAKLADY[k].lvl <= uroven);
      if (u.length) return novyUnikat(s, u[Ri(s, 0, u.length - 1)]);
    }
    // z dostupných základů víc váží ty „nejnovější" pro danou úroveň
    let moznosti = Object.keys(ZAKLADY).filter(k => typy.includes(ZAKLADY[k].typ) && ZAKLADY[k].lvl <= uroven && !ZAKLADY[k].unikat);
    if (!moznosti.length) {                        // na mělkých patrech ještě nic – vezmi nejnižší
      const vse = Object.keys(ZAKLADY).filter(k => typy.includes(ZAKLADY[k].typ) && !ZAKLADY[k].unikat);
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
    const n = nazevBezKletby(s, p) + (p.kovani ? ` +${p.kovani}` : '');
    return p.prokleti && p.odhaleno ? n + ' ☠' : n;
  }
  function nazevBezKletby(s, p) {
    const z = ZAKLADY[p.zaklad];
    if (p.typ === 'svitek' && s.znameSvitky && !s.znameSvitky.includes(p.zaklad)) return `Svitek „${s.napisySvitku[p.zaklad]}"`;
    if (p.typ === 'lektvar') {
      return s.zname && s.zname.includes(p.lektvar) ? LEKTVARY[p.lektvar].nazev : `${s.barvyLektvaru[p.lektvar][0]} lektvar`;
    }
    if (p.typ === 'sipy') return `Šípy (${p.pocet})`;
    if (p.typ === 'hulka' || p.zaklad === 'krumpac') return `${z.nazev} (${p.naboje})`;
    if (z.unikat) return z.nazev;
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
    if (p.kovani) {                                  // ukováno u kováře: +1 poškození nebo +1 obrana za stupeň
      if (z.typ === 'zbran') { out.min += p.kovani; out.max += p.kovani; }
      else out.obrana = (out.obrana || 0) + p.kovani;
    }
    for (const k of ['zdravi', 'presnost', 'ohen', 'magie']) if (z[k]) out[k] = z[k];
    for (const ru of p.runy || []) {                 // vložené runy
      if (ru === 'ohen') out.ohen = (out.ohen || 0) + 3;
      else if (ru === 'sila') out.sila = (out.sila || 0) + 1;
      else if (ru === 'ochrana') out.obrana = (out.obrana || 0) + 1;
      else if (ru === 'hbitost') out.uhyb = (out.uhyb || 0) + 3;
      else out['runa_' + ru] = (out['runa_' + ru] || 0) + 1;
    }
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

  const drazky = p => !slotPro(p) ? 0 : (p.unikat || p.vzacnost >= 3) ? 2 : p.vzacnost >= 1 ? 1 : 0;
  function slotPro(p) {
    if (p.typ === 'zbran' && ZAKLADY[p.zaklad].dosah) return 'luk';
    return p.typ === 'prsten' ? 'prsten' : SLOTY.includes(p.typ) ? p.typ : null;
  }

  // hodnoty hráče včetně výbavy
  function odvozene(s) {
    const h = s.hrac, v = h.vybava, o = { sila: h.sila, obrana: h.obrana, magie: h.magie, maxHp: h.maxHp, presnost: 0, ohen: 0, runy: {} };
    const vPouzdre = drziLuk(s) ? 'zbran' : 'luk';   // zbraň, která není v ruce, bonusy nedává
    for (const slot of SLOTY) {
      const p = v[slot];
      if (!p || slot === vPouzdre) continue;
      const w = vlastnostiPredmetu(p);
      o.sila += w.sila || 0; o.obrana += w.obrana || 0; o.magie += w.magie || 0;
      o.maxHp += w.zdravi || 0; o.presnost += w.presnost || 0; o.ohen += w.ohen || 0;
      o.uhybRuny = (o.uhybRuny || 0) + (w.uhyb || 0);
      for (const ru of ['mraz', 'vysavani', 'stesti', 'svetlo']) if (w['runa_' + ru]) o.runy[ru] = (o.runy[ru] || 0) + w['runa_' + ru];
    }
    if (ma(s, 'tuhy')) o.maxHp += 15;
    o.obratnost = h.obratnost || 0;
    o.sady = {}; o.uhybNavic = 0;
    for (const slot of SLOTY) { const p = v[slot], sa = p && ZAKLADY[p.zaklad].sada; if (sa && slot !== vPouzdre) o.sady[sa] = (o.sady[sa] || 0) + 1; }
    for (const [sa, n] of Object.entries(o.sady)) for (const [prah, b] of Object.entries(SADY[sa].bonus)) if (n >= +prah) {
      o.maxHp += b.zdravi || 0; o.obrana += b.obrana || 0; o.sila += b.sila || 0; o.presnost += b.presnost || 0; o.uhybNavic += b.uhyb || 0; o.dosahNavic = (o.dosahNavic || 0) + (b.dosah || 0);
    }
    if (ma(s, 'legenda')) { o.sila += 2; o.obratnost += 2; o.magie += 2; o.maxHp += 20; }
    if (ma(s, 'nezlomny')) o.obrana += 4;
    o.maxHp += 2 * navic(s, 'odolnost');
    if (h.kuze > 0) o.obrana += 3;
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
    const zz = ruka ? ZAKLADY[ruka.zaklad] : {};
    o.zbran = { min: zb.min, max: zb.max, rychlost: zb.rychlost, dosah: zb.dosah ? zb.dosah + (ma(s, 'lukostrelec') ? 2 : 0) + (o.dosahNavic || 0) : 0, nazev: ruka ? nazevPredmetu(s, ruka) : 'Pěsti',
      omraci: zz.omraci || 0, bodne: !!zz.bodne };
    o.sipy = h.batoh.filter(p => p.typ === 'sipy').reduce((a, p) => a + p.pocet, 0);
    o.presnost += (o.zbran.dosah ? 2 * navic(s, 'strelba') : navic(s, 'boj')) + 3 * o.obratnost;
    o.maxMana = maxMany(s, o);
    return o;
  }
  function srovnejZdravi(s) { const m = odvozene(s).maxHp; if (s.hrac.hp > m) s.hrac.hp = m; }

  // hromádky: jídlo, lektvary, svitky a pochodně stejného druhu zabírají jedno místo (nejvýš MAX_HROMADKA kusů)
  const MAX_HROMADKA = 9;
  const hromadi = p => p.typ === 'bylina' || p.typ === 'lek' || p.typ === 'runa' || p.typ === 'jidlo' || p.typ === 'lektvar' || p.typ === 'svitek' || p.typ === 'pochoden' || p.typ === 'surovina' || p.zaklad === 'lano';
  const stejnyDruh = (a, b) => a.typ === b.typ && a.zaklad === b.zaklad && a.lektvar === b.lektvar;
  const kusu = p => p.pocet || 1;
  // přidá kusy p na hromádky v seznamu; nové hromádky dostanou nové id; vrací, kolik kusů se nevešlo
  // (volne = kolik nových míst smí vzniknout)
  function naHromadku(s, seznam, p, volne) {
    let zbyva = kusu(p);
    for (const q of seznam) {
      if (!zbyva) break;
      if (!stejnyDruh(q, p) || kusu(q) >= MAX_HROMADKA) continue;
      const k = Math.min(zbyva, MAX_HROMADKA - kusu(q));
      q.pocet = kusu(q) + k; zbyva -= k;
    }
    while (zbyva && volne > 0) {
      const k = Math.min(zbyva, MAX_HROMADKA);
      seznam.push(Object.assign({}, p, { pocet: k, id: s.dalsiId = (s.dalsiId || 0) + 1 }));
      zbyva -= k; volne--;
    }
    return zbyva;
  }
  // úklid: nedoplněné hromádky téhož druhu se slijí (první v pořadí se doplní, prázdné zmizí).
  // Běží po každé akci i po načtení, takže uložení je vždy ve stejném tvaru.
  function srovnejHromadky(b) {
    for (let i = 0; i < b.length; i++) {
      const p = b[i];
      if (!hromadi(p) || kusu(p) >= MAX_HROMADKA) continue;
      for (let j = i + 1; j < b.length && kusu(p) < MAX_HROMADKA; j++) {
        const q = b[j];
        if (!stejnyDruh(p, q)) continue;
        const k = Math.min(kusu(q), MAX_HROMADKA - kusu(p));
        p.pocet = kusu(p) + k;
        if (kusu(q) - k <= 0) { b.splice(j, 1); j--; } else q.pocet = kusu(q) - k;
      }
    }
  }
  // odebere jeden kus z hromádky (poslední kus odebere celou položku)
  function odeberKus(b, i) {
    const p = b[i];
    if (kusu(p) > 1) p.pocet--; else b.splice(i, 1);
  }
  // přidat do batohu; šípy se sčítají, spotřební věci na hromádky; vrací false, když je plno
  function doBatohu(s, p) {
    const b = s.hrac.batoh;
    if (p.typ === 'sipy') {
      const st = b.find(q => q.typ === 'sipy');
      if (st) { st.pocet += p.pocet; return true; }
    }
    if (hromadi(p)) {
      const zbyva = naHromadku(s, b, p, kapacita(s) - b.length);
      if (zbyva) { p.pocet = zbyva; return false; }   // co se nevešlo, zůstane v p (leží dál na zemi)
      return true;
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

  const NAVRAT_SIPU = 0.5;                       // šance, že vystřelený šíp půjde sebrat
  function polozNaZem(s, x, y, predmety, zlato) {
    let z = s.zeme.find(q => q.x === x && q.y === y);
    if (!z) { z = { x, y, predmety: [], zlato: 0 }; s.zeme.push(z); }
    for (const p of predmety) {
      const st = p.typ === 'sipy' && z.predmety.find(q => q.typ === 'sipy');   // šípy na hromádku
      if (st) st.pocet += p.pocet;
      else if (hromadi(p)) naHromadku(s, z.predmety, p, Infinity);
      else z.predmety.push(p);
    }
    z.zlato += zlato || 0;
  }

  // hráč vstoupil na pole: zlato vždy, předměty dokud je místo
  // vse = i věci, které hráč sám položil (ty se při šlápnutí nezvedají – jen klávesou X)
  function seberZeZeme(s, ud, x, y, vse) {
    if (x === undefined) { x = s.x; y = s.y; }
    const i = s.zeme.findIndex(z => z.x === x && z.y === y);
    if (i < 0) return false;
    const z = s.zeme[i];
    let neco = false;
    if (z.zlato) { s.zlato += z.zlato; ud.push({ typ: 'zlato', kolik: z.zlato }); z.zlato = 0; neco = true; }
    const zbyva = [];
    for (const p of z.predmety) {
      if (p.polozeno && !vse) { zbyva.push(p); continue; }
      neco = true;
      delete p.polozeno;
      if (p.typ === 'ukol') { ud.push({ typ: 'sebral', predmet: p, nazev: nazevPredmetu(s, p) }); postupUkolu(s, 'denik', ud); continue; }
      if (doBatohu(s, p)) ud.push({ typ: 'sebral', predmet: p, nazev: nazevPredmetu(s, p) });
      else { if (vse || !p.polozeno) ud.push({ typ: 'plno', pocet: 1 }); zbyva.push(p); }
    }
    z.predmety = zbyva;
    if (!zbyva.length) s.zeme.splice(i, 1);
    return neco;
  }

  function otevriTruhlu(s, t, ud) {
    t.otevrena = true;
    const lvl = s.patro + Ri(s, 0, 2) + (t.bonus || 0) + (ma(s, 'stastlivec') ? 2 : 0);
    const kolik = Ri(s, 1, 2) + (Rs(s) < 0.25 ? 1 : 0) + (ma(s, 'pokladnik') ? 1 : 0);
    const obsah = [];
    for (let i = 0; i < kolik; i++) obsah.push(nahodnyPredmet(s, lvl, i === 0 ? vazenyVyber(s, [['zbran', 3], ['ochrana', 4], ['sperk', 1.5], ['lektvar', 2]]) : undefined));
    const zlato = Math.round((Ri(s, 3, 12) * s.patro + Ri(s, 0, 10)) * (1 + (t.bonus || 0)) * (ma(s, 'stastlivec') ? 1.5 : 1) * (1 + 0.02 * navic(s, 'vsimavost')) * (1 + 0.15 * (odvozene(s).runy.stesti || 0)));
    cvic(s, 'vsimavost', ud, 2);
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
    if (Rs(s) < 0.4) zlato = Math.round((Ri(s, 1, 6) * s.patro + Ri(s, 0, 5)) * (ma(s, 'stastlivec') ? 1.5 : 1) * (ma(s, 'pokladnik') ? 1.33 : 1) * (kletbaPatra(s) ? 1.5 : 1));
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
    kovarna: { nazev: 'Kovárna', od: 999, vaha: 0, vstup: 'Kovárna! Zvoní kladivo. „Ukuju ti cokoli – za zlato, nebo za rudu."' },
    pokladnice: { nazev: 'Pokladnice', od: 3, vaha: 0.9, max: 1, vstup: 'Pokladnice! Zlato se třpytí ve světle louče.' },
    poi: { nazev: 'Zajímavé místo', od: 999, vaha: 0, vstup: 'Tohle místo je jiné než ostatní… Něco tu na tebe čeká.' },
  };
  // překážky; `kosti` jsou jen na zemi a neblokují
  const DEKORACE = {
    obchodnik: 'obchodník', mistrKovar: 'kovář', rakev: 'kamenná rakev', sud: 'sud', bedna: 'bedna', police: 'police s knihami', oltar: 'oltář', klec: 'klec', kosti: 'kosti',
    studna: 'vyschlá studna', socha: 'socha', alchymie: 'alchymistický stůl', koule: 'věštecká koule', hrob: 'hrob', taborak: 'vyhaslý táborák',
    kostkar: 'goblin', fontana: 'fontána', houby: 'houbový háj', zrcadlo: 'zrcadlo',
  };
  // --- zajímavá místa (POI): v patře nejvýš jedno, každé jde použít jednou (studna a kostky víckrát) ---
  // vznikají až na konci stavby patra s vlastní náhodou (staré uložené hry zůstanou stejné)
  const ZAJIMAVOSTI = {
    studna: { nazev: 'Studna přání', od: 1, vaha: 1, popis: 'Stará kamenná studna. Z hlubin se ozývá tiché zurčení – prý plní přání, když do ní hodíš minci.' },
    socha: { nazev: 'Socha zapomenutého hrdiny', od: 2, vaha: 0.8, popis: 'Kamenný hrdina s mečem. V očních důlcích se lesknou dva drahokamy.' },
    alchymie: { nazev: 'Alchymistický stůl', od: 2, vaha: 0.9, popis: 'Baňky, křivule a kotlík, pod kterým ještě doutnají uhlíky.' },
    koule: { nazev: 'Věštecká koule', od: 3, vaha: 0.7, popis: 'Křišťálová koule na zdobeném podstavci. Uvnitř se převalují obrazy chodeb.' },
    hrob: { nazev: 'Hrob padlého dobrodruha', od: 3, vaha: 0.9, popis: 'Mohyla z kamení, v ní zapíchnutý meč a rezavá přilba. Někdo tu skončil před tebou.' },
    taborak: { nazev: 'Táborák', od: 1, vaha: 1, popis: 'Kruh kamenů, dohasínající oheň a srolovaná houně. Místo k odpočinku – když je klid.' },
    kostkar: { nazev: 'Goblin s kostkami', od: 4, vaha: 0.7, popis: '„Hej, cizinče! Zahraješ si? Kdo hodí víc, bere všechno."' },
    fontana: { nazev: 'Fontána', od: 2, vaha: 0.8, popis: 'Z kamenné tlamy crčí čistá voda. Nebo aspoň vypadá čistě.' },
    houby: { nazev: 'Houbový háj', od: 6, vaha: 0.7, popis: 'Obří houby září teplým oranžovým světlem. Voní jako pečený chléb.' },
    zrcadlo: { nazev: 'Magické zrcadlo', od: 5, vaha: 0.6, popis: 'Ve zlatém rámu se nezrcadlíš ty – ale někdo, kdo se ti podobá.' },
  };
  const jePoi = d => !!d && !!ZAJIMAVOSTI[d.druh];
  const cenaPrani = s => 5 + 3 * s.patro;
  const sazkaKostek = s => 10 * s.patro;
  function zajimavosti(s) {
    const p = s.mapaPatra, R = nahoda(smichej(s.seed ^ 0x9015, p.patro));
    if (R.f() >= 0.4) return;
    const startM = p.mistnostId[p.start.y * p.w + p.start.x], dolM = p.mistnostId[p.dolu.y * p.w + p.dolu.x];
    // i do obyčejných místností se zařízením (skladiště, knihovna…), ne do obchodu, kovárny, pokladnice apod.
    const kandidati = p.mistnosti.filter(m => !m.tajna && !m.boss && m.id !== startM && m.id !== dolM
      && (!m.ucel || ['skladiste', 'knihovna', 'kobka', 'hrobka'].includes(m.ucel)));
    const druhy = Object.keys(ZAJIMAVOSTI).filter(k => ZAJIMAVOSTI[k].od <= p.patro);
    const soucet = druhy.reduce((a, k) => a + ZAJIMAVOSTI[k].vaha, 0);
    let r = R.f() * soucet, druh = druhy[0];
    for (const k of druhy) { r -= ZAJIMAVOSTI[k].vaha; if (r <= 0) { druh = k; break; } }
    for (let k = 0; k < 4 && kandidati.length; k++) {
      const m = kandidati.splice(Math.floor(R.f() * kandidati.length), 1)[0];
      const o = umisti(s, m, R, druh, true);
      if (!o) continue;
      if (!m.ucel) m.ucel = 'poi';
      if (druh === 'kostkar') s.potvory = s.potvory.filter(q => p.mistnostId[q.y * p.w + q.x] !== m.id);   // u hráče se nebojuje
      return;
    }
  }
  // strážce vyvolaný oltářem, sochou, hrobem…: hned vedle hráče a rovnou honí
  function vyvolejStrazce(s, druh) {
    if (!druh) {
      const druhy = Object.keys(BESTIAR).filter(k => !BESTIAR[k].boss && BESTIAR[k].od <= s.patro && s.patro <= BESTIAR[k].do);
      druh = druhy[Ri(s, 0, druhy.length - 1)] || 'krysa';
    }
    for (let k = 0; k < 4; k++) {
      const x = s.x + DX[k], y = s.y + DY[k];
      if (!volneProPotvoru(s, x, y, null, { dvere: false })) continue;
      const m = novaPotvora(s, druh, x, y, false);
      m.stav = 'honi'; m.stopa = 15;
      s.potvory.push(m);
      return m;
    }
    return null;
  }
  // co se dá u místa dělat: [{id, text, lze}] (stránka z toho udělá tlačítka)
  function moznostiPoi(s, d) {
    if (!jePoi(d) || d.pouzito) return [];
    const h = s.hrac, nezname = h.batoh.some(q => q.typ === 'lektvar' && !s.zname.includes(q.lektvar));
    switch (d.druh) {
      case 'studna': return [{ id: 'prani', text: `Hodit minci (${cenaPrani(s)} 💰)`, lze: s.zlato >= cenaPrani(s) }];
      case 'socha': return [{ id: 'poklek', text: 'Pokleknout a pomodlit se', lze: true }, { id: 'kamen', text: 'Vylomit drahokamy z očí', lze: true }];
      case 'alchymie': return [{ id: 'poznej', text: 'Prozkoumat lektvary z batohu', lze: nezname },
        { id: 'svar', text: 'Svařit léčivý lektvar z jídla', lze: h.batoh.some(q => q.typ === 'jidlo') }];
      case 'koule': return [{ id: 'pohled', text: 'Pohlédnout do koule', lze: true }];
      case 'hrob': return [{ id: 'ucta', text: 'Vzdát úctu padlému', lze: true }, { id: 'kopat', text: 'Vykopat hrob', lze: true }];
      case 'taborak': return [{ id: 'odpocinek', text: 'Odpočinout si u ohně', lze: true }];
      case 'kostkar': return [{ id: 'hra', text: `Vsadit ${sazkaKostek(s)} 💰`, lze: s.zlato >= sazkaKostek(s) }];
      case 'fontana': return [{ id: 'napit', text: 'Napít se', lze: true }];
      case 'houby': return [{ id: 'snist', text: 'Sníst svítící houbu', lze: true }];
      case 'zrcadlo': return [{ id: 'pohled', text: 'Pohlédnout do zrcadla', lze: true }];
    }
    return [];
  }
  function dejPredmet(s, p) { if (!doBatohu(s, p)) polozNaZem(s, s.x, s.y, [p], 0); }
  const STATY = [['sila', 'síla'], ['obrana', 'obrana'], ['magie', 'magie']];
  function poiAkce(s, arg, ud) {
    const d = arg && s.dekorace[arg.i];
    if (!jePoi(d) || d.pouzito || Math.abs(d.x - s.x) + Math.abs(d.y - s.y) !== 1) return false;
    if (!moznostiPoi(s, d).some(v => v.id === arg.volba && v.lze)) return false;
    const h = s.hrac, o = odvozene(s), P = s.patro;
    const vysledek = (dobre, text) => ud.push({ typ: 'poi', druh: d.druh, dobre, text, x: d.x, y: d.y });
    let pouzito = true;
    s.stat.poi = (s.stat.poi || 0) + 1;
    switch (d.druh + ':' + arg.volba) {
      case 'studna:prani': {
        s.zlato -= cenaPrani(s); s.stat.utraceno += cenaPrani(s);
        d.hody = (d.hody || 0) + 1; pouzito = d.hody >= 3;
        const r = Rs(s);
        if (r < 0.3) { const q = nahodnyPredmet(s, P + 2); if (q.vzacnost !== undefined && slotPro(q)) q.vzacnost = Math.max(1, q.vzacnost); dejPredmet(s, q); vysledek(true, `Z hlubin vyplaval dar: ${nazevPredmetu(s, q)}!`); }
        else if (r < 0.55) { h.hp = o.maxHp; h.mana = o.maxMana; vysledek(true, 'Ze studny vystoupala teplá pára – jsi zdravý jako rybička.'); }
        else if (r < 0.65) { const z = cenaPrani(s) * 4; s.zlato += z; vysledek(true, `Studna ti vrátila víc, než dostala (+${z} 💰).`); }
        else vysledek(false, 'Šplouchnutí… a nic. Možná příště.');
        if (pouzito) ud.push({ typ: 'poiKonec', text: 'Studna vyschla.' });
        break;
      }
      case 'socha:poklek': {
        if (Rs(s) < 0.6) { const [k, n] = STATY[Ri(s, 0, 2)]; h[k]++; vysledek(true, `Hrdina ti požehnal – ${n} +1.`); }
        else { h.hp = Math.min(o.maxHp, h.hp + 10 + P); vysledek(true, 'Kamenná ruka ti spočinula na rameni. Cítíš se líp.'); }
        break;
      }
      case 'socha:kamen': {
        const z = P * Ri(s, 14, 22);
        s.zlato += z;
        if (Rs(s) < 0.5) { vyvolejStrazce(s, P >= 12 ? 'golem' : 'kostlivec'); vysledek(false, `Drahokamy jsou tvoje (+${z} 💰), ale socha se pohnula a vyslala strážce!`); }
        else vysledek(true, `Drahokamy jsou tvoje (+${z} 💰). Socha mlčí.`);
        break;
      }
      case 'alchymie:poznej': {
        const nove = [...new Set(h.batoh.filter(q => q.typ === 'lektvar' && !s.zname.includes(q.lektvar)).map(q => q.lektvar))];
        s.zname.push(...nove);
        vysledek(true, `Poznal jsi ${nove.length === 1 ? 'nový lektvar' : nove.length + ' nové lektvary'}: ${nove.map(k => LEKTVARY[k].nazev).join(', ')}.`);
        break;
      }
      case 'alchymie:svar': {
        const i = h.batoh.findIndex(q => q.typ === 'jidlo');
        odeberKus(h.batoh, i);
        dejPredmet(s, novyPredmet(s, 'lektvar', { lektvar: P >= 8 ? 'velkeLeceni' : 'leceni' }));
        vysledek(true, `Z jídla a bylin se ti podařilo svařit ${P >= 8 ? 'Lektvar velkého léčení' : 'Lektvar léčení'}.`);
        break;
      }
      case 'koule:pohled':
        s.prozkoumano.fill(1);
        for (const t of s.pasti) t.odhalena = true;
        vysledek(true, 'V kouli se ti ukázalo celé patro – i všechny pasti.');
        break;
      case 'hrob:ucta':
        h.zk += 6 * P;
        vysledek(true, `Duch padlého ti pošeptal, co ho zabilo (+${6 * P} zkušeností).`);
        povysuj(s, ud);
        break;
      case 'hrob:kopat': {
        const q = nahodnyPredmet(s, P + 3, Rs(s) < 0.5 ? 'zbran' : 'ochrana');
        q.vzacnost = Math.max(1, q.vzacnost || 0);
        dejPredmet(s, q);
        if (Rs(s) < 0.6) { vyvolejStrazce(s, P >= 13 ? 'prizrak' : 'kostlivec'); vysledek(false, `Vykopal jsi ${nazevPredmetu(s, q)} – a mrtvý se zvedl, aby si ho vzal zpátky!`); }
        else vysledek(true, `Vykopal jsi ${nazevPredmetu(s, q)}. Odpočívej v pokoji.`);
        break;
      }
      case 'taborak:odpocinek':
        if (s.potvory.some(m => m.stav !== 'spi' && !BESTIAR[m.druh].boss && Math.abs(m.x - s.x) + Math.abs(m.y - s.y) <= 8)) {
          ud.push({ typ: 'poiNelze', text: 'Nablízku se něco pohybuje – teď odpočívat nemůžeš.' });
          s.stat.poi--;
          return false;
        }
        h.hp = o.maxHp; h.mana = o.maxMana; h.pochoden = Math.min(MAX_PALIVA, h.pochoden + 300); h.sytost = Math.max(0, h.sytost - 15);
        s.tah += 20;
        if (Rs(s) < 0.35) { vyvolejStrazce(s); vysledek(false, 'Prospal ses u ohně – a oheň přilákal nezvaného hosta!'); }
        else vysledek(true, 'Prospal ses u ohně. Zdraví plné, pochodeň opravená.');
        break;
      case 'kostkar:hra': {
        const sazka = sazkaKostek(s), ty = Ri(s, 1, 6) + Ri(s, 1, 6), on = Ri(s, 1, 6) + Ri(s, 1, 6);
        d.hody = (d.hody || 0) + 1; pouzito = d.hody >= 3;
        if (ty > on) { s.zlato += sazka; vysledek(true, `Hodil jsi ${ty}, goblin ${on}. Vyhráváš ${sazka} 💰!`); }
        else if (ty < on) { s.zlato -= sazka; s.stat.utraceno += sazka; vysledek(false, `Hodil jsi ${ty}, goblin ${on}. Prohráváš ${sazka} 💰.`); }
        else vysledek(true, `Oba jste hodili ${ty}. Remíza.`);
        if (pouzito) ud.push({ typ: 'poiKonec', text: '„Dost, dost! Musím jít." Goblin sbalil kostky a zmizel.' });
        break;
      }
      case 'fontana:napit': {
        const r = Rs(s);
        if (r < 0.5) { h.hp = Math.min(o.maxHp, h.hp + Math.round(o.maxHp / 3)); h.mana = o.maxMana; h.sytost = Math.min(100, h.sytost + 20); vysledek(true, 'Studená voda tě osvěžila a uzdravila.'); }
        else if (r < 0.75) { s.prozkoumano.fill(1); vysledek(true, 'Voda ti zbystřila smysly – vidíš celé patro.'); }
        else if (r < 0.9) { const [k, n] = STATY[Ri(s, 0, 2)]; h[k]++; vysledek(true, `Voda je kouzelná – ${n} +1.`); }
        else { const dmg = Math.max(1, Math.round(o.maxHp * 0.15)); h.hp -= dmg; vysledek(false, `Fuj, zkažená voda! (−${dmg})`); if (h.hp <= 0) zemri(s, 'zkažená voda z fontány', 'poi', ud); }
        break;
      }
      case 'houby:snist': {
        const r = Rs(s);
        h.sytost = Math.min(100, h.sytost + 40);
        if (r < 0.45) { h.hp = Math.min(o.maxHp, h.hp + 15 + P); vysledek(true, 'Chutná jako pečený chléb! Sytost i zdraví nahoru.'); }
        else if (r < 0.7) { h.magie++; vysledek(true, 'Svět se rozzářil barvami… magie +1.'); }
        else if (r < 0.85) { h.pochoden = Math.min(MAX_PALIVA, h.pochoden + 200); vysledek(true, 'Svítivé výtrusy ti obalily pochodeň – hoří jasněji.'); }
        else { const dmg = Math.max(1, Math.round(o.maxHp * 0.2)); h.hp -= dmg; vysledek(false, `Tahle byla jedovatá! (−${dmg})`); if (h.hp <= 0) zemri(s, 'jedovatá houba', 'poi', ud); }
        break;
      }
      case 'zrcadlo:pohled': {
        const n = sejmiKletby(s);
        if (n) vysledek(true, 'Odraz z tebe stáhl všechny kletby a zmizel s nimi v rámu.');
        else if (Rs(s) < 0.5) { h.obrana++; vysledek(true, 'Odraz ti ukázal tvé slabiny – obrana +1.'); }
        else { vyvolejStrazce(s, 'prizrak'); vysledek(false, 'Odraz vystoupil ze zrcadla – a není přátelský!'); }
        break;
      }
      default: s.stat.poi--; return false;
    }
    d.pouzito = pouzito;
    srovnejZdravi(s);
    return true;
  }
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
  const jeLouc = (s, x, y, k) => hashSteny(s.mapaPatra, x, y, k + 40) < SANCE_LOUCE && !(s.sebraneLouce && s.sebraneLouce.has(`${x},${y},${k}`)) && !uDveriSteny(s.mapaPatra, x, y, k);
  // stěna u dveří nebo průchodu: louč by zasahovala do dveří (zeď sousedí s dveřmi, nebo se z nich na ni díváme)
  function uDveriSteny(p, x, y, k) {
    const dv = (a, b) => { if (a < 0 || b < 0 || a >= p.w || b >= p.h) return false; const t = p.mapa[b * p.w + a]; return t === T.DVERE || t === T.OTVOR; };
    if (dv(x + DX[k], y + DY[k])) return true;
    for (let q = 0; q < 4; q++) if (dv(x + DX[q], y + DY[q]) || dv(x + DX[k] + DX[q], y + DY[k] + DY[q])) return true;
    return false;
  }
  const MAX_PALIVA = 1000;

  // stojí = překáží (kosti jsou jen na zemi, rozbitá věc zmizela)
  const stoji = d => d.druh !== 'kosti' && d.druh !== 'deska' && !d.rozbito;
  const dekoraceNa = (s, x, y) => s.dekorace && s.dekorace.find(d => d.x === x && d.y === y && stoji(d));
  // rozbitné věci: kolik zásahů vydrží podle materiálu (klec, oltář, postavy a zajímavá místa rozbít nejdou)
  const ODOLNOST = {
    bedna: [1, 'dřevo'], amfora: [1, 'hlína'], pytle: [1, 'plátno'], lebky: [1, 'kost'],
    sudOlej: [1, 'dřevo'], sud: [2, 'dřevo'], stul: [2, 'dřevo'], svicen: [2, 'železo'], stojan: [2, 'dřevo'],
    police: [3, 'dřevo'], vozik: [3, 'dřevo a železo'], sut: [3, 'kámen'],
    kotel: [4, 'železo'], krystaly: [4, 'krystal'],
    rakev: [5, 'kámen'], nahrobek: [5, 'kámen'], stalagmit: [5, 'kámen'],
    sloup: [6, 'kámen'], chrlic: [6, 'kámen'], trun: [6, 'kámen'],
  };
  const NADOBY = new Set(['bedna', 'sud', 'amfora', 'pytle', 'vozik', 'kotel']);
  function uderDoVeci(s, d, ud) {
    const [vydrz, material] = ODOLNOST[d.druh];
    d.zasahy = (d.zasahy || 0) + 1;
    if (d.zasahy < vydrz) { ud.push({ typ: 'rana', druh: d.druh, x: d.x, y: d.y, zbyva: vydrz - d.zasahy, material }); return; }
    d.rozbito = true; delete d.zasahy;
    ud.push({ typ: 'rozbito', druh: d.druh, x: d.x, y: d.y, material });
    if (d.druh === 'sudOlej') { vybuchSudu(s, d, ud); return; }
    if (d.druh === 'rakev' && Rs(s) < 0.3) {     // z rozbitého sarkofágu občas vstane kostlivec – a hned útočí
      const k = novaPotvora(s, 'kostlivec', d.x, d.y, false); k.stav = 'honi'; k.stopa = 12; k.energie = -1;
      s.potvory.push(k);
      ud.push({ typ: 'zRakve', id: k.id, druh: 'kostlivec', x: d.x, y: d.y });
    }
    if (d.druh === 'police' && Rs(s) < 0.35) {   // z rozbité police s knihami občas vypadne kniha (nebo svitek)
      polozNaZem(s, d.x, d.y, [Rs(s) < 0.75 ? novyPredmet(s, 'kniha') : nahodnyPredmet(s, s.patro, 'magie')], 0);
      ud.push({ typ: 'korist', x: d.x, y: d.y, kniha: true });
      return;
    }
    // v nádobách a nábytku občas něco je
    if (Rs(s) < (NADOBY.has(d.druh) ? 0.45 : 0.15)) {
      const r = Rs(s), zlato = r < 0.35 ? Ri(s, 2, 6) * s.patro : 0;
      const veci = r < 0.35 ? [] : [nahodnyPredmet(s, s.patro, r < 0.6 ? 'jidlo' : r < 0.75 ? 'sipy' : r < 0.9 ? 'lektvar' : undefined)];
      polozNaZem(s, d.x, d.y, veci, zlato);
      ud.push({ typ: 'korist', x: d.x, y: d.y });
    }
  }
  const pastNa = (s, x, y) => s.pasti && s.pasti.find(t => t.x === x && t.y === y);
  // sud s olejem: vybuchne po ráně nebo od ohně – zraní vše v sousedních polích (i hrdinu), zapálí další sudy
  function vybuchSudu(s, d, ud) {
    d.rozbito = true;
    const dmg = 10 + 2 * s.patro;
    ud.push({ typ: 'vybuchSudu', x: d.x, y: d.y });
    for (const m of s.potvory.slice()) if (m.hp > 0 && Math.max(Math.abs(m.x - d.x), Math.abs(m.y - d.y)) <= 1) zranPotvoru(s, m, dmg, ud, true, 'ohen');
    if (Math.max(Math.abs(s.x - d.x), Math.abs(s.y - d.y)) <= 1 && !s.mrtvy) {
      const h = s.hrac, z = Math.ceil(dmg / 2); h.hp -= z; ud.push({ typ: 'vybuchZranil', dmg: z });
      if (h.hp <= 0) zemri(s, 'sud s olejem, u kterého se nemělo kouzlit', 'past', ud);
    }
    const c = s.spolecnik;
    if (c && Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) <= 1) { c.hp -= Math.ceil(dmg / 2); if (c.hp <= 0) { ud.push({ typ: 'spolecnikPadl', druh: c.druh, nazev: SPOLECNICI[c.druh].nazev, x: c.x, y: c.y }); s.spolecnik = null; } }
    for (const q of s.dekorace) if (q.druh === 'sudOlej' && !q.rozbito && Math.max(Math.abs(q.x - d.x), Math.abs(q.y - d.y)) <= 1) vybuchSudu(s, q, ud);
  }
  function zapalSudy(s, x, y, ud) {
    for (const q of s.dekorace) if (q.druh === 'sudOlej' && !q.rozbito && Math.max(Math.abs(q.x - x), Math.abs(q.y - y)) <= 1) vybuchSudu(s, q, ud);
  }
  // balvan: X ho odvalí o pole dál; na potvoru ji rozdrtí, do jámy ji zasype
  function tlacBalvan(s, d, ud) {
    const nx = d.x + DX[s.smer], ny = d.y + DY[s.smer], m = potvoraNa(s, nx, ny);
    if (m) {
      zranPotvoru(s, m, 15 + 3 * s.patro, ud, false, 'drt');
      ud.push({ typ: 'balvan', x: d.x, y: d.y, rozdrtil: m.hp <= 0 });
      if (m.hp <= 0) { d.x = nx; d.y = ny; }
      return true;
    }
    const pa = pastNa(s, nx, ny);
    if (pa && pa.druh === 'jama') { s.pasti.splice(s.pasti.indexOf(pa), 1); d.rozbito = true; ud.push({ typ: 'balvanJama', x: nx, y: ny }); return true; }
    const t = dlazdice(s, nx, ny);
    if (!pruchozi(t) || t === T.DOLU || t === T.NAHORU || dvereZavrene(s, nx, ny) || prekazkaNa(s, nx, ny) || (s.spolecnik && s.spolecnik.x === nx && s.spolecnik.y === ny)) {
      ud.push({ typ: 'balvanNejde' }); return false;
    }
    d.x = nx; d.y = ny;
    ud.push({ typ: 'balvan', x: nx, y: ny });
    return true;
  }
  // páky s hádankou: tři páky se symboly, správné pořadí je vyryté ve zdi místnosti
  const SYMBOLY = ['◆', '●', '▲'];
  function zatahniPaku3(s, d, ud) {
    const hp = s.hadankaPak;
    if (!hp || hp.hotovo) { ud.push({ typ: 'pakaHotovo', uz: true }); return; }
    hp.zadano.push(d.symbol);
    const n = hp.zadano.length;
    if (hp.poradi.slice(0, n).join('') !== hp.zadano.join('')) {
      hp.zadano = [];
      const dmg = 3 + Math.floor(s.patro / 3); s.hrac.hp -= dmg;
      ud.push({ typ: 'pakaSpatne', dmg });
      if (s.hrac.hp <= 0) zemri(s, 'páka, která chtěla jiné pořadí', 'past', ud);
      return;
    }
    if (n < hp.poradi.length) { ud.push({ typ: 'pakaKlik', symbol: d.symbol, n }); return; }
    hp.hotovo = true;
    const m = s.mapaPatra.mistnosti[hp.mid], R = nahoda(smichej(s.seed ^ 0x9AC4, s.patro)), c = m && volneVMistnosti(s, m, R);
    if (c) s.truhly.push({ x: c.x, y: c.y, otevrena: false, bonus: 1 });
    ud.push({ typ: 'pakaHotovo', x: c ? c.x : d.x, y: c ? c.y : d.y });
  }
  // tlaková deska: šlápnutí odhalí nejbližší tajné dveře
  function slapniNaDesku(s, ud) {
    const d = s.dekorace.find(q => q.druh === 'deska' && q.x === s.x && q.y === s.y && !q.pouzito);
    if (!d) return;
    d.pouzito = true;
    const p = s.mapaPatra; let nej = null, nv = 99;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.mapa[y * p.w + x] === T.TAJNE) { const v = Math.abs(x - s.x) + Math.abs(y - s.y); if (v < nv) { nv = v; nej = [x, y]; } }
    ud.push({ typ: 'deska', nalezeno: !!nej });
    if (nej) odhalTajne(s, nej[0], nej[1], ud, 'deska');
  }
  // rozmístění: sudy s olejem, balvany, páky s hádankou, tlakové desky (na konci stavby patra, vlastní náhoda)
  function interaktivni(s) {
    const p = s.mapaPatra, R = nahoda(smichej(s.seed ^ 0x1A7E, p.patro));
    s.hadankaPak = null;
    if (p.patro >= 5) for (const tr of s.truhly.slice()) {
      if (tr.bonus || tr.otevrena || R.f() >= 0.13) continue;
      const mid = p.mistnostId[tr.y * p.w + tr.x], mi = mid >= 0 && p.mistnosti[mid];
      if (mi && (['obchod', 'kovarna', 'poi'].includes(mi.ucel) || s.dekorace.some(d => jePoi(d) && p.mistnostId[d.y * p.w + d.x] === mid))) continue;
      const i = s.truhly.indexOf(tr);
      s.truhly.splice(i, 1);
      if (!souvisle(s)) { s.truhly.splice(i, 0, tr); continue; }   // truhla v kapse za jinou věcí – zůstane truhlou
      s.potvory.push(novaPotvora(s, 'mimik', tr.x, tr.y, true));
    }
    s.stavimOzdoby = true;
    const bezne = p.mistnosti.filter(m => !m.tajna && !m.boss && !['obchod', 'kovarna', 'pokladnice', 'mriz', 'poi'].includes(m.ucel) && p.mistnostId[p.start.y * p.w + p.start.x] !== m.id);
    for (const m of bezne) {
      if (R.f() < 0.22) umisti(s, m, R, 'sudOlej');
      if (R.f() < 0.12) umisti(s, m, R, 'balvan');
    }
    if (p.patro >= 4 && R.f() < 0.4) {
      const m = bezne.filter(q => q.w * q.h >= 16)[Math.floor(R.f() * bezne.length)];
      if (m) {
        const pak = [];
        for (const sym of SYMBOLY) { const o = umisti(s, m, R, 'paka3'); if (o) { o.symbol = sym; pak.push(o); } }
        if (pak.length === 3) {
          const poradi = SYMBOLY.slice();
          for (let i = 2; i > 0; i--) { const j = Math.floor(R.f() * (i + 1)); [poradi[i], poradi[j]] = [poradi[j], poradi[i]]; }
          s.hadankaPak = { mid: m.id, poradi, zadano: [], hotovo: false };
        } else for (const o of pak) s.dekorace.splice(s.dekorace.indexOf(o), 1);
      }
    }
    let tajne = null;
    for (let i = 0; i < p.mapa.length && !tajne; i++) if (p.mapa[i] === T.TAJNE) tajne = [i % p.w, (i / p.w) | 0];
    if (tajne && R.f() < 0.6) {
      const kand = [];
      for (let y = 1; y < p.h - 1; y++) for (let x = 1; x < p.w - 1; x++) {
        const v = Math.abs(x - tajne[0]) + Math.abs(y - tajne[1]);
        if (v >= 2 && v <= 6 && p.mapa[y * p.w + x] === T.PODLAHA && !prekazkaNa(s, x, y) && !pastNa(s, x, y) && !(x === p.start.x && y === p.start.y)) kand.push([x, y]);
      }
      if (kand.length) { const [x, y] = kand[Math.floor(R.f() * kand.length)]; s.dekorace.push({ x, y, druh: 'deska' }); }
    }
    delete s.stavimOzdoby;
  }
  const prekazkaNa = (s, x, y) => truhlaNa(s, x, y) || dekoraceNa(s, x, y);

  // Po položení překážky musí zůstat patro průchozí: dveře, schody i všechna volná pole místností.
  // Dvě podmínky: (1) po odemčení všeho je patro celé průchozí, (2) i se zamčenými dveřmi a mřížemi
  // je dostupné všechno mimo zamčené místnosti a ke schodům se dojde (dřív překážky občas zatarasily jedinou
  // volnou cestu a ke schodům vedla jen zamčená pokladnice).
  function souvisle(s) {
    const p = s.mapaPatra, w = p.w, n = w * p.h, blok = new Uint8Array(n);
    for (const t of s.truhly) blok[t.y * w + t.x] = 1;
    for (const d of s.dekorace) if (stoji(d)) blok[d.y * w + d.x] = 1;
    for (const t of s.pasti || []) if (t.druh === 'jama') blok[t.y * w + t.x] = 1;   // jámou se projít nedá (propadneš se)
    // ozdoby se staví až po teleportech: runový kruh se nesmí stát jedinou cestou (šlápnutí na něj přenáší)
    const tele = new Set(s.stavimOzdoby && s.teleporty ? s.teleporty.map(([x, y]) => y * w + x) : []);   // na kruh vstoupit lze, projít ne
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
        if (q && tele.has(i)) continue;
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
    for (const d of s.dekorace) if (stoji(d)) blok[d.y * w + d.x] = 1;
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
  const uSchodu = (p, c) => Math.abs(c.x - p.dolu.x) + Math.abs(c.y - p.dolu.y) <= 1;   // runový kruh nesmí být jediná cesta ke schodům
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
    for (const d of s.dekorace || []) if (stoji(d)) kopie[d.y * p.w + d.x] = T.SKALA;
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
        zbozi.push(novyPredmet(s, 'lektvar', { lektvar: 'mana' }));
        zbozi.push(nahodnyPredmet(s, p.patro, 'nastroj'));   // lano, krumpáč nebo lucerna (bez další náhody generátoru)
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
      const vhodne = p.mistnosti.filter(m => !m.tajna && !['pokladnice', 'obchod', 'mriz', 'kovarna'].includes(m.ucel) && !m.boss);
      for (let k = 0; k < 30 && !s.teleporty; k++) {
        const a = vhodne[Math.floor(R.f() * vhodne.length)], b = vhodne[Math.floor(R.f() * vhodne.length)];
        if (!a || !b || a === b) continue;
        const ca = volneVMistnosti(s, a, R), cb = volneVMistnosti(s, b, R);
        if (!ca || !cb || uDveri(s, ca.x, ca.y) || uDveri(s, cb.x, cb.y) || uSchodu(p, ca) || uSchodu(p, cb) || Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y) < 8) continue;
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
      if (druh === 'jama' && !souvisle(s)) s.pasti[s.pasti.length - 1].druh = 'deska';   // jáma by odřízla kus patra
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
  const CENY_LEKTVARU = { mana: 55, leceni: 30, velkeLeceni: 80, sila: 120, odolnost: 120, zkusenost: 90, sytost: 40, osviceni: 50, jed: 10 };
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
    if (p.typ === 'surovina') return 15;
    if (p.typ === 'nastroj') return { krumpac: 25 + 15 * (p.naboje || 0), lano: 45, lucerna: 160 }[p.zaklad] || 40;
    if (p.typ === 'klic') return 0;
    return Math.round((10 + Math.max(0, skorePredmetu(Object.assign({}, p, { odhaleno: false }))) * 6) * (1 + 0.5 * (p.vzacnost || 0)));
  }
  // lektvary jsou v hlubinách dražší (obchodník ví, že dole jsou k nezaplacení) – jinak v pozdní hře zlato nemá cenu
  const DRAHOTA_LEKTVARU = 0.06;
  const cenaNakupu = (s, p) => Math.max(1, Math.round(cenaPredmetu(p, s) * (1 - (s.obchod ? s.obchod.sleva : 0)) * (ma(s, 'smlouvac') ? 0.8 : 1) * (1 - (s.hrac.taborSleva || 0))
    * (p.typ === 'lektvar' ? 1 + DRAHOTA_LEKTVARU * Math.max(0, (s.patro || 1) - 1) : 1)));
  const cenaVykupu = (s, p) => Math.floor(cenaPredmetu(p, s) * (ma(s, 'kupec') ? 0.5 : ma(s, 'smlouvac') ? 0.4 : 0.2));
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
      // z hromádky se prodává po kusu
      const b = s.hrac.batoh, cela = kusu(b[i]) <= 1;
      const p = cela ? b.splice(i, 1)[0] : Object.assign({}, b[i], { pocet: 1, id: s.dalsiId = (s.dalsiId || 0) + 1 });
      if (!cela) b[i].pocet--;
      const cena = cenaVykupu(s, p);
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
    if (typ === 'zapomenout') {                   // Kniha zapomnění: vrátí rozdělené body vlastností
      const h = s.hrac, r2 = h.rozdeleno || {}, n = Object.values(r2).reduce((a, b) => a + b, 0), cena = cenaZapomneni(s);
      if (!n) return false;
      if (s.zlato < cena) { ud.push({ typ: 'malo', cena }); return false; }
      s.zlato -= cena; s.stat.utraceno += cena;
      h.sila -= r2.sila || 0; h.obratnost = (h.obratnost || 0) - (r2.obratnost || 0); h.magie -= r2.magie || 0;
      h.maxHp -= 5 * (r2.vydrz || 0); h.mana = Math.min(h.mana, maxMany(s)); srovnejZdravi(s);
      h.body = (h.body || 0) + n; h.rozdeleno = {};
      ud.push({ typ: 'zapomnel', body: n, cena });
      return true;
    }
    if (typ === 'najmout') {                      // věrný pes nebo žoldák
      const D = SPOLECNICI[arg], cena = cenaSpolecnika(s, arg);
      if (!D || s.spolecnik) return false;
      if (s.zlato < cena) { ud.push({ typ: 'malo', cena }); return false; }
      s.zlato -= cena; s.stat.utraceno += cena;
      s.spolecnik = { druh: arg, x: s.x, y: s.y, hp: 0, maxHp: 0, uroven: 0 };   // stojí na poli hrdiny
      srovnejSpolecnika(s); s.spolecnik.hp = s.spolecnik.maxHp;
      ud.push({ typ: 'najal', druh: arg, nazev: D.nazev, cena });
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
    cvic(s, 'vsimavost', ud, 5);
    ud.push({ typ: 'tajne', x, y, jak });
  }

  // pozornost: po každém kroku šance všimnout si pasti vedle sebe
  function rozhlednise(s, ud, pozorne) {
    const h = s.hrac, zlodej = ma(s, 'zlodej');
    const lucerna = maLucernu(s) && h.pochoden > 0;         // v jejím světle jsou praskliny a pasti líp vidět
    const sance = zlodej ? 1 : (pozorne ? 0.5 : 0.15 + 0.03 * h.uroven + (lucerna ? 0.2 : 0)) + 0.03 * navic(s, 'vsimavost'), dosah = pozorne || zlodej || lucerna ? 2 : 1;
    for (const t of s.pasti) {
      if (t.odhalena || Math.abs(t.x - s.x) + Math.abs(t.y - s.y) > dosah) continue;
      if (Rs(s) < sance) { t.odhalena = true; cvic(s, 'vsimavost', ud, 3); ud.push({ typ: 'pastOdhalena', x: t.x, y: t.y, druh: t.druh }); }
    }
    if (!pozorne && !lucerna) return;
    for (let k = 0; k < 4; k++) {
      const x = s.x + DX[k], y = s.y + DY[k];
      if (dlazdice(s, x, y) === T.TAJNE && Rs(s) < (pozorne ? 0.35 : 0.12)) odhalTajne(s, x, y, ud, pozorne ? 'hledani' : 'lucerna');
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
      for (const m of s.potvory) if (!(m.druh === 'mimik' && m.stav === 'spi')) { m.stav = 'honi'; m.stopa = 15; }   // mimik dál čeká v truhle
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
      vyvolejStrazce(s);
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
    prepadeni(s, m, ud);
  }

  // --- použití předmětů ---------------------------------------------
  function najdiVBatohu(s, id) { return s.hrac.batoh.findIndex(p => p.id === id); }

  function nasad(s, id, ud, cilSlot) {
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
      if (cilSlot === 'prsten1' || cilSlot === 'prsten2') slot = cilSlot;
    }
    if (v[slot] && v[slot].prokleti) {            // prokletá věc nejde sundat, a tak ani vyměnit
      v[slot].odhaleno = true;
      ud.push({ typ: 'prokleto', nazev: nazevPredmetu(s, v[slot]) });
      return false;
    }
    if (v[slot]) b.splice(i, 1, v[slot]); else b.splice(i, 1);   // výměna: sundaná věc zaujme místo nasazené
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
    if (p.typ === 'lek') {
      const z = ZAKLADY[p.zaklad];
      if (!vylec(s, z.leci, ud)) { ud.push({ typ: 'lekZbytecny', nazev: z.nazev }); return false; }
      if (p.zaklad === 'svecenaVoda') h.hp = Math.min(odvozene(s).maxHp, h.hp + 10);
      odeberKus(b, i);
      return true;
    }
    if (p.typ === 'stranka') {
      b.splice(i, 1);
      ud.push({ typ: 'stranka', cislo: p.cislo || 1, text: STRANKY[(p.cislo || 1) - 1] || STRANKY[0] });
      return true;
    }
    if (p.typ === 'jidlo') {
      odeberKus(b, i);
      h.sytost = Math.min(100, h.sytost + ZAKLADY[p.zaklad].syti);
      if (ma(s, 'hodovnik')) h.hp = Math.min(odvozene(s).maxHp, h.hp + 8);
      ud.push({ typ: 'snedl', nazev: ZAKLADY[p.zaklad].nazev });
      return true;
    }
    if (p.typ === 'pochoden') {
      if (h.pochoden >= MAX_PALIVA) { ud.push({ typ: 'plnaPochoden' }); return false; }
      odeberKus(b, i);
      h.pochoden = Math.min(MAX_PALIVA, h.pochoden + ZAKLADY.pochoden.palivo);
      ud.push({ typ: 'zapalil' });
      return true;
    }
    if (p.zaklad === 'krumpac') return kopej(s, p, ud);
    if (p.zaklad === 'lano') {
      if (bossZiv(s)) { ud.push({ typ: 'lanoBoss' }); return false; }
      odeberKus(b, i);
      s.stat.lanem = (s.stat.lanem || 0) + 1;
      vstupDoPatra(s, s.patro + 1);
      ud.push({ typ: 'slanil' });
      return true;
    }
    if (p.zaklad === 'lucerna') { ud.push({ typ: 'lucernaInfo' }); return false; }
    if (p.typ === 'kniha') {
      b.splice(i, 1);
      const nezname = Object.keys(LEKTVARY).filter(k => !s.zname.includes(k)).map(k => ['l', k])
        .concat(Object.keys(s.napisySvitku || {}).filter(k => !s.znameSvitky.includes(k)).map(k => ['s', k]));
      if (nezname.length) {
        const [druh, k] = nezname[Ri(s, 0, nezname.length - 1)];
        if (druh === 'l') {
          s.zname.push(k);
          ud.push({ typ: 'precetl', druh: 'lektvar', klic: k, nazev: LEKTVARY[k].nazev, barva: s.barvyLektvaru[k][0],
            text: `Kniha receptur: ${s.barvyLektvaru[k][0].toLowerCase()} lektvar je ${LEKTVARY[k].nazev.toLowerCase()}.` });
        } else {
          s.znameSvitky.push(k);
          ud.push({ typ: 'precetl', druh: 'svitek', klic: k, nazev: ZAKLADY[k].nazev, napis: s.napisySvitku[k],
            text: `Kniha run: nápis „${s.napisySvitku[k]}" znamená ${ZAKLADY[k].nazev.toLowerCase()}.` });
        }
      } else {
        const zk = Math.round(h.zkDalsi * 0.3);
        h.zk += zk;
        ud.push({ typ: 'precetl', druh: 'zk', zk, text: `Učená pojednání o nestvůrách (+${zk} zkušeností).` });
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
      if (p.typ === 'svitek' && !zachovan) odeberKus(b, i);
      else if (--p.naboje <= 0) { b.splice(i, 1); ud.push({ typ: 'hulkaVyprazdnena', nazev: ZAKLADY[p.zaklad].nazev }); }
      sesli(s, ZAKLADY[p.zaklad].kouzlo, ud);
      return true;
    }
    if (p.typ !== 'lektvar') return false;
    odeberKus(b, i);
    const znal = s.zname.includes(p.lektvar);
    if (!znal) s.zname.push(p.lektvar);
    const max = odvozene(s).maxHp;
    let ucinek = '';
    switch (p.lektvar) {
      case 'leceni': { const kolik = Math.min(max - h.hp, 12 + Math.round(max * 0.3)); h.hp += kolik; ucinek = `+${kolik} zdraví`; vylec(s, 'krvaceni', ud); vylec(s, 'omrzlina', ud); break; }
      case 'velkeLeceni': ucinek = `+${max - h.hp} zdraví`; h.hp = max; break;
      case 'sila': h.sila++; ucinek = 'síla +1 natrvalo'; break;
      case 'odolnost': h.obrana++; ucinek = 'obrana +1 natrvalo'; break;
      case 'zkusenost': { const zk = Math.round(h.zkDalsi * 0.5); h.zk += zk; ucinek = `+${zk} zkušeností`; povysuj(s, ud); break; }
      case 'sytost': h.sytost = 100; ucinek = 'už nemáš hlad'; break;
      case 'osviceni': s.prozkoumano.fill(1); ucinek = 'mapa patra se ti vyjevila'; break;
      case 'mana': { const mm = maxMany(s), kolik = Math.max(0, Math.min(mm - (h.mana || 0), 4 + Math.round(mm * 0.35))); h.mana = (h.mana || 0) + kolik; ucinek = `+${kolik} many`; break; }
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
  // magie: +15 % za bod do 6, dál +6 % (body vlastností by jinak kouzla rozjely)
  const nasobekMagie = m => 1 + 0.15 * Math.min(m, 6) + 0.035 * Math.max(0, m - 6);
  const silaKouzla = (s, zaklad) => Math.round(zaklad * nasobekMagie(odvozene(s).magie) * (1 + 0.04 * navic(s, 'kouzleni')));
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
    if (!cile.length) { const c = cilKouzla(s, 6); if (c.m) cile.push(c.m); }   // nikdo v přímce: kouzlo se navede šikmo
    const posl = cile[cile.length - 1];
    ud.push({ typ: 'kouzlo', kouzlo, ...kamCil(posl), vzdalenost: cile.length ? Math.abs(cile[cile.length - 1].x - s.x) + Math.abs(cile[cile.length - 1].y - s.y) : d,
      text: cile.length ? '' : kouzlo === 'ohen' ? 'Ohnivá koule se roztříštila o zeď.' : 'Blesk se ztratil ve tmě.' });
    if (kouzlo === 'ohen') { const c0 = cile[0] || { x: s.x + DX[s.smer] * d, y: s.y + DY[s.smer] * d }; zapalSudy(s, c0.x, c0.y, ud); }
    if (kouzlo === 'ohen' && cile.length) {
      const hl = cile[0], dmg = silaUtocneho(s, Ri(s, 8, 14) + Math.round(s.patro * 1.5));
      const sousede = s.potvory.filter(m => m !== hl && Math.abs(m.x - hl.x) + Math.abs(m.y - hl.y) === 1);
      zranPotvoru(s, hl, Math.max(1, dmg - Math.floor(BESTIAR[hl.druh].obrana / 3)), ud, true, TYP_KOUZLA[kouzlo] || 'magie');
      for (const m of sousede) if (m.hp > 0) zranPotvoru(s, m, Math.max(1, Math.round(dmg / 2)), ud, true, TYP_KOUZLA[kouzlo] || 'magie');
    }
    if (kouzlo === 'blesk') for (const m of cile) if (m.hp > 0) zranPotvoru(s, m, silaUtocneho(s, Ri(s, 5, 10) + s.patro), ud, true, TYP_KOUZLA[kouzlo] || 'magie');
    hluk(s, 6);
  }

  const maLucernu = s => !!s.hrac && s.hrac.batoh.some(q => q.zaklad === 'lucerna');
  // krumpáč: prokope zeď před hráčem (ne okraj mapy, ne zeď s pákou); práce stojí 5 tahů a je slyšet
  function kopej(s, p, ud) {
    const m = s.mapaPatra, x = s.x + DX[s.smer], y = s.y + DY[s.smer], i = y * m.w + x, t = dlazdice(s, x, y);
    if (x < 1 || y < 1 || x > m.w - 2 || y > m.h - 2 || (t !== T.SKALA && t !== T.TAJNE)) { ud.push({ typ: 'nelzeKopat', proc: t === T.SKALA ? 'okraj' : 'nezed' }); return false; }
    if (s.paka && s.paka.x === x && s.paka.y === y) { ud.push({ typ: 'nelzeKopat', proc: 'paka' }); return false; }
    if (t === T.TAJNE) odhalTajne(s, x, y, ud, 'krumpac');
    else { m.mapa[i] = T.CHODBA; (s.prokopano = s.prokopano || new Set()).add(i); }
    ud.push({ typ: 'prokopal', x, y });
    if (--p.naboje <= 0) { s.hrac.batoh.splice(s.hrac.batoh.indexOf(p), 1); ud.push({ typ: 'krumpacZlomen' }); }
    hluk(s, 7);
    konecTahu(s, 4, ud);                         // + 1 tah za použití = 5
    return true;
  }

  // lepší věci z batohu: pro každý slot ta nejlepší, pokud je lepší než nasazená (odhalené kletby ne, prokleté nasazené nejde sundat)
  function lepsiVybava(s) {
    const v = s.hrac.vybava, plan = [];
    const kand = typ => s.hrac.batoh.filter(p => slotPro(p) === typ && !(p.prokleti && p.odhaleno)).sort((a, b) => skorePredmetu(b) - skorePredmetu(a));
    for (const typ of ['zbran', 'luk', 'stit', 'helma', 'brneni', 'boty', 'amulet']) {
      const p = kand(typ)[0];
      if (p && !(v[typ] && v[typ].prokleti) && skorePredmetu(p) > skorePredmetu(v[typ]) + 0.01) plan.push([p.id, typ]);
    }
    const prsteny = kand('prsten'), sloty = ['prsten1', 'prsten2'].filter(k => !(v[k] && v[k].prokleti)).sort((a, b) => skorePredmetu(v[a]) - skorePredmetu(v[b]));
    for (const k of sloty) { const p = prsteny[0]; if (p && skorePredmetu(p) > skorePredmetu(v[k]) + 0.01) { plan.push([p.id, k]); prsteny.shift(); } }
    return plan;
  }
  function nasadLepsi(s, ud) {
    let n = 0;
    for (const [id, slot] of lepsiVybava(s)) if (nasad(s, id, ud, slot)) n++;
    return n;
  }
  // výbava v batohu, která není lepší než to, co hráč nosí (prázdný slot = nic není horší; prsteny proti slabšímu z obou)
  function horsiVybava(s) {
    const v = s.hrac.vybava;
    return s.hrac.batoh.filter(p => {
      const slot = slotPro(p);
      if (!slot) return false;
      const proti = slot === 'prsten' ? (v.prsten1 && v.prsten2 ? [v.prsten1, v.prsten2].reduce((a, b) => (skorePredmetu(a) <= skorePredmetu(b) ? a : b)) : null) : v[slot];
      return !!proti && skorePredmetu(p) <= skorePredmetu(proti);
    }).map(p => p.id);
  }
  function zahod(s, id, ud) {
    const b = s.hrac.batoh, i = najdiVBatohu(s, id);
    if (i < 0) return false;
    const p = b.splice(i, 1)[0];
    p.polozeno = true;
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
    zlodej: { nazev: 'Zloděj', ikona: '🗡️', popis: 'Méně zdraví, ale obratnost 3, plíží se (méně budí spící potvory), dýka, krátký luk se šípy a schopnost Zloděj (útok ze zálohy ×3).',
      hp: 26, sila: 3, magie: 1, obratnost: 3, zbran: 'dyka1', boty: 'boty1', navic: [['luk1'], ['sipy', { pocet: 15 }]], schopnost: 'zlodej',
      odemceni: { uspech: 'hledac', text: 'Najdi 3 tajné místnosti v jedné výpravě.' } },
    mag: { nazev: 'Mág', ikona: '✨', popis: 'Křehký, ale s hůlkou ohně, dvěma svitky, magií 4 a schopností Mág – kouzla jsou mnohem silnější.',
      hp: 22, sila: 2, magie: 4, zbran: 'dyka1', navic: [['hulkaOhen'], ['svitekLeceni'], ['svitekOhen'], ['lektvar', { lektvar: 'mana' }]], schopnost: 'mag',
      odemceni: { uspech: 'jeskyne', text: 'Dojdi do zatopených jeskyní (11. patro).' } },
    knez: { nazev: 'Kněz', ikona: '☀️', popis: 'Léčí, svítí a pálí nemrtvé Svatým světlem. Hůl, prošívanice a svěcená voda, která vyléčí každý neduh.',
      hp: 26, sila: 2, magie: 3, zbran: 'hul1', brneni: 'brneni1', navic: [['svecenaVoda'], ['obvaz']], schopnost: null,
      odemceni: { uspech: 'jeskyne', text: 'Dojdi do zatopených jeskyní (11. patro).' } },
    hranicar: { nazev: 'Hraničář', ikona: '🏹', popis: 'Lukem a šípy na dálku, obratnost 2 a od začátku věrný pes po boku.',
      hp: 26, sila: 3, magie: 1, obratnost: 2, zbran: 'dyka1', boty: 'boty1', navic: [['luk1'], ['sipy', { pocet: 30 }], ['obvaz']], schopnost: 'lukostrelec', spolecnik: 'pes',
      odemceni: null },
    nekromant: { nazev: 'Nekromant', ikona: '💀', popis: 'Křehký vládce smrti: probouzí kostlivce, vysává život a otravuje. Magie 4.',
      hp: 22, sila: 2, magie: 4, zbran: 'dyka1', navic: [['protijed'], ['lektvar', { lektvar: 'mana' }]], schopnost: null,
      odemceni: { uspech: 'doly', text: 'Dojdi do trpasličích dolů (21. patro).' } },
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
    const [jmeno, rod, tvar] = jmenoHrdiny(s.seed);
    s.jmeno = jmeno; s.rod = rod; s.tvar = tvar;
    const tr = TRIDY[s.trida] || TRIDY.rytir;
    s.hrac = {
      hp: tr.hp, maxHp: tr.hp, sila: tr.sila, obrana: 0, magie: tr.magie, obratnost: tr.obratnost || 0, uroven: 1, zk: 0, zkDalsi: 15, sytost: 100,
      vybava: { zbran: null, luk: null, stit: null, helma: null, brneni: null, boty: null, amulet: null, prsten1: null, prsten2: null },
      drzi: 'zbran', batohStupen: 0,
      batoh: [], schopnosti: tr.schopnost ? [tr.schopnost] : [], volba: null, kryti: false, pochoden: 800,
    };
    s.zabito = 0; s.tajne = 0; s.zlato = 0; s.bossu = 0;
    s.stat = { zaloha: 0, utraceno: 0, lektvary: 0 };    // počítadla výpravy (pro úspěchy)
    // barvy lektvarů jsou pevné podle druhu (BARVA_DRUHU); léčivý zná hrdina odmala
    s.barvyLektvaru = barvyLektvaru();
    s.zname = ['leceni'];
    if (s.trida === 'mag') s.zname.push('mana');          // mág lektvar many pozná na první pohled
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
    // sloty 4–6: přednastavená kouzla (dokud je hrdina neumí, jsou zamčená)
    s.rychla = [tr.bezLektvaru ? null : { typ: 'lektvar', lektvar: 'leceni' }, { typ: 'jidlo' }, null, { kouzlo: 'jiskra' }, { kouzlo: 'hojeni' }, { kouzlo: 'ohen' }];
    for (const q of [novyPredmet(s, 'chleb'), novyPredmet(s, 'chleb'), novyPredmet(s, 'pochoden')]) doBatohu(s, q);
    if (!tr.bezLektvaru) for (let i = 0; i < 2; i++) doBatohu(s, novyPredmet(s, 'lektvar', { lektvar: 'leceni' }));
    for (const [zaklad, o] of tr.navic) {
      const p = novyPredmet(s, zaklad, o);
      if (slotPro(p) === 'luk' && !v.luk) { v.luk = p; continue; }   // luk rovnou na záda
      if (p.typ === 'hulka') p.naboje = 4;
      if (p.typ === 'svitek') { s.znameSvitky.push(zaklad); if (!s.rychla[2]) s.rychla[2] = { zaklad }; }
      doBatohu(s, p);
    }
    if (s.trida === 'mag') s.rychla[2] = { zaklad: 'hulkaOhen' };
    pripravMagii(s);
  }

  const RYCHLYCH = 6;                     // sloty rychlé lišty
  // --- ozdoby místností: nábytek a předměty podle prostředí (jen vzhled a překážka, nic nedávají) ---
  // až na konci stavby patra s vlastní náhodou (staré uložené hry: nové ozdoby přibudou na konec seznamu)
  const OZDOBY = {
    svicen: 'svícen', lebky: 'hromada lebek', vozik: 'důlní vozík', stul: 'stůl', sloup: 'zlomený sloup', kotel: 'kotel',
    stojan: 'stojan se zbraněmi', pytle: 'pytle s obilím', stalagmit: 'krápník', krystaly: 'krystaly', nahrobek: 'náhrobek',
    amfora: 'amfora', sut: 'hromada sutě', chrlic: 'chrlič', trun: 'kamenný trůn',
  };
  Object.assign(DEKORACE, OZDOBY);
  const OZDOBY_BIOMU = {
    'Kamenné kobky': ['svicen', 'stul', 'stojan', 'pytle', 'amfora', 'sut', 'lebky'],
    'Zatopené jeskyně': ['stalagmit', 'stalagmit', 'sut', 'amfora', 'kotel'],
    'Trpasličí doly': ['vozik', 'sut', 'pytle', 'stojan', 'stul', 'svicen'],
    'Krypta': ['nahrobek', 'lebky', 'svicen', 'amfora', 'chrlic', 'sloup'],
    'Lávové podzemí': ['sloup', 'kotel', 'lebky', 'chrlic', 'sut'],
    'Podivno': ['krystaly', 'sloup', 'krystaly', 'chrlic'],
    'Houbový les': ['stalagmit', 'kotel', 'pytle', 'amfora', 'sut'],
    'Ledové jeskyně': ['stalagmit', 'stalagmit', 'sut', 'krystaly'],
    'Trpasličí město': ['sloup', 'svicen', 'stojan', 'stul', 'vozik'],
    'Zapomenutý chrám': ['sloup', 'svicen', 'nahrobek', 'chrlic', 'amfora'],
  };
  function ozdoby(s) {
    const p = s.mapaPatra, R = nahoda(smichej(s.seed ^ 0x02D0B, p.patro));
    const sada = OZDOBY_BIOMU[p.biom] || OZDOBY_BIOMU['Kamenné kobky'];
    s.stavimOzdoby = true;
    for (const m of p.mistnosti) {
      if (m.tajna || m.boss || ['obchod', 'kovarna', 'pokladnice', 'mriz'].includes(m.ucel) || R.f() < 0.45) continue;
      const n = 1 + (m.w * m.h >= 20 && R.f() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        let druh = sada[Math.floor(R.f() * sada.length)];
        if (R.f() < 0.04) druh = 'trun';
        umisti(s, m, R, druh);
      }
    }
    delete s.stavimOzdoby;
  }
  // --- magie u postavy: mana a kniha kouzel (kouzlit umí každý, mág nejvíc) ----------------
  // smerem = letí ve směru pohledu; od = od jaké úrovně se kouzlo dá naučit
  // kouzla po sekcích; nazev = vlastní jméno kouzla, druh = co dělá (pro nováčka)
  const SEKCE_KOUZEL = {
    utok: { nazev: 'Útočná', ikona: '🔥' }, leceni: { nazev: 'Léčivá', ikona: '💚' }, ochrana: { nazev: 'Ochranná', ikona: '🛡️' },
    mysl: { nazev: 'Mysl a stíny', ikona: '🌀' }, svetlo: { nazev: 'Světlo a poznání', ikona: '🕯️' }, vyvolani: { nazev: 'Vyvolávání', ikona: '✨' },
  };
  const KOUZLA = {
    jiskra: { nazev: 'Uhlíková jiskra', druh: 'jiskra', sekce: 'utok', ikona: '✨', mana: 3, od: 1, smerem: true, popis: 'Ohnivá jiskra zasáhne první potvoru v přímce (do 5 polí).' },
    led: { nazev: 'Mrazivý hrot', druh: 'ledový šíp', sekce: 'utok', ikona: '❄️', mana: 7, od: 3, smerem: true, popis: 'Zraní první potvoru v přímce a na chvíli ji zpomalí.' },
    jed: { nazev: 'Bažinný dech', druh: 'jedovatý mrak', sekce: 'utok', ikona: '☠️', mana: 6, od: 2, smerem: true, popis: 'Otráví první potvoru v přímce – 5 tahů ji jed spaluje.' },
    upir: { nazev: 'Polibek upíra', druh: 'vysátí života', sekce: 'utok', ikona: '🩸', mana: 9, od: 5, smerem: true, popis: 'Zraní první potvoru v přímce a polovinu zranění ti vrátí jako zdraví.' },
    ohen: { nazev: 'Dračí dech', druh: 'ohnivá koule', sekce: 'utok', ikona: '🔥', mana: 10, od: 4, smerem: true, popis: 'Výbuch zasáhne první potvoru v přímce i její sousedy.' },
    blesk: { nazev: 'Hromový šíp', druh: 'blesk', sekce: 'utok', ikona: '⚡', mana: 12, od: 6, smerem: true, popis: 'Zasáhne všechny potvory v přímce před tebou.' },
    otres: { nazev: 'Hněv hory', druh: 'otřes země', sekce: 'utok', ikona: '🌋', mana: 13, od: 8, popis: 'Zraní všechny potvory do dvou polí od tebe.' },
    hojeni: { nazev: 'Hojivý dotek', druh: 'léčení', sekce: 'leceni', ikona: '💚', mana: 5, od: 1, popis: 'Uzdraví část zdraví; síla roste s magií.' },
    uzdraveni: { nazev: 'Slzy světice', druh: 'velké léčení', sekce: 'leceni', ikona: '💧', mana: 14, od: 6, popis: 'Uzdraví hodně zdraví a zažene hlad; síla roste s magií.' },
    kuze: { nazev: 'Kamenná kůže', druh: 'obrana +3', sekce: 'ochrana', ikona: '🪨', mana: 6, od: 2, popis: 'Obrana +3 na 12 tahů.' },
    stit: { nazev: 'Runový štít', druh: 'magický štít', sekce: 'ochrana', ikona: '🔷', mana: 8, od: 6, popis: 'Štít z run pohltí příští zranění (síla roste s magií).' },
    strach: { nazev: 'Hrůzný šepot', druh: 'děs', sekce: 'mysl', ikona: '😱', mana: 5, od: 3, smerem: true, popis: 'Potvora v přímce dostane strach a na pár tahů uteče (boss ne).' },
    spanek: { nazev: 'Ukolébavka stínů', druh: 'uspání', sekce: 'mysl', ikona: '🌙', mana: 8, od: 4, smerem: true, popis: 'Uspí potvoru v přímce na 6 tahů – pak ji zasáhneš ze zálohy (boss ne).' },
    teleport: { nazev: 'Krok skrze stín', druh: 'přemístění', sekce: 'mysl', ikona: '🌀', mana: 9, od: 5, popis: 'Přenese tě jinam v patře.' },
    svetlo: { nazev: 'Svíčka poutníka', druh: 'oživení pochodně', sekce: 'svetlo', ikona: '🕯️', mana: 2, od: 1, popis: 'Rozjasní pochodeň o 15 %.' },
    lumen: { nazev: 'Slunce podzemí', druh: 'magické světlo', sekce: 'svetlo', ikona: '☀️', mana: 8, od: 2, popis: 'Nad hlavou ti vzplane koule světla – svítí víc než louč a daleko. Čím vyšší magie, tím déle (30 tahů + 12 za každý bod magie).' },
    odhaleni: { nazev: 'Lucerna mudrců', druh: 'odhalení', sekce: 'svetlo', ikona: '🏮', mana: 7, od: 3, popis: 'Odhalí pasti a tajné dveře v okolí 6 polí.' },
    mapa: { nazev: 'Oko věštce', druh: 'jasnozření', sekce: 'svetlo', ikona: '👁️', mana: 14, od: 7, popis: 'Ukáže celé patro i s pastmi.' },
    sipy: { nazev: 'Toulec z mlhy', druh: 'vyčaruj šípy', sekce: 'vyvolani', ikona: '🏹', mana: 5, od: 1, popis: 'Vyčaruje šípy (8 + magie).' },
    jidlo: { nazev: 'Chléb poutníka', druh: 'vyčaruj jídlo', sekce: 'vyvolani', ikona: '🍞', mana: 9, od: 3, popis: 'Vyčaruje bochník chleba, s vyšší magií pečené maso.' },
    // 23. 11. 2026: další kouzla
    retez: { nazev: 'Řetězový blesk', druh: 'řetěz blesků', sekce: 'utok', ikona: '🌩️', mana: 17, od: 7, smerem: true, popis: 'Blesk zasáhne cíl a přeskočí až na 3 další potvory poblíž – každý skok o čtvrtinu slabší.' },
    vanice: { nazev: 'Ledová vánice', druh: 'mrazivá bouře', sekce: 'utok', ikona: '🌨️', mana: 12, od: 6, popis: 'Zraní a zpomalí všechny potvory do 2 polí kolem tebe.' },
    meteor: { nazev: 'Pád hvězdy', druh: 'meteor', sekce: 'utok', ikona: '☄️', mana: 25, od: 10, smerem: true, popis: 'Na cíl dopadne žhnoucí kámen – velké zranění a polovina všem kolem něj.' },
    miza: { nazev: 'Živá míza', druh: 'obnova', sekce: 'leceni', ikona: '🌿', mana: 8, od: 3, popis: '15 tahů tě každý tah hojí (s vyšší magií víc).' },
    odraz: { nazev: 'Zrcadlová kůže', druh: 'odraz', sekce: 'ochrana', ikona: '🪞', mana: 10, od: 5, popis: '10 tahů vrací útočníkům polovinu zranění, které ti udělají.' },
    zavoj: { nazev: 'Závoj tmy', druh: 'ztracení stopy', sekce: 'mysl', ikona: '🌫️', mana: 9, od: 4, popis: 'Potvory do 5 polí tě ztratí z očí a přestanou tě honit; 5 tahů tě vidí jen ta, která stojí hned vedle.' },
    koreny: { nazev: 'Kořenová pouta', druh: 'spoutání', sekce: 'mysl', ikona: '🌱', mana: 6, od: 2, smerem: true, popis: 'Kořeny spoutají potvoru – na 3 tahy se nehne (boss jen na 1).' },
    oslneni: { nazev: 'Oslepující záblesk', druh: 'oslnění', sekce: 'svetlo', ikona: '🔆', mana: 7, od: 3, popis: 'Oslní potvory v dohledu do 4 polí – 6 tahů často minou.' },
    svetloKnez: { nazev: 'Svaté světlo', druh: 'paprsek světla', sekce: 'svetlo', ikona: '🌟', mana: 5, od: 4, smerem: true, popis: 'Paprsek světla spálí cíl (nemrtvé dvakrát víc) a tebe trochu vyléčí.' },
    kostlivec: { nazev: 'Probuzení kostí', druh: 'vyvolání', sekce: 'vyvolani', ikona: '💀', mana: 12, od: 8, popis: 'Vyvolá kostlivce-sluhu, který 40 tahů (+4 za bod magie) bojuje za tebe. Jen bez jiného společníka.' },
    ocista: { nazev: 'Očista', druh: 'vyléčí stavy', sekce: 'leceni', ikona: '✨', mana: 6, od: 3, popis: 'Zbaví tě otravy, krvácení i omrzliny.' },
    vlk: { nazev: 'Stínový vlk', druh: 'vyvolání', sekce: 'vyvolani', ikona: '🐺', mana: 15, od: 6, popis: 'Přivolá ze stínů vlka, který s tebou bojuje 25 tahů (+3 za bod magie). Jen když nemáš jiného společníka.' },
  };
  const KOUZLA_TRIDY = { rytir: ['jiskra', 'hojeni'], zlodej: ['jiskra', 'svetlo', 'sipy'], mag: ['jiskra', 'hojeni', 'ohen', 'kuze', 'lumen'], barbar: ['jiskra'],
    knez: ['hojeni', 'svetloKnez', 'ocista', 'svetlo'], hranicar: ['jiskra', 'sipy'], nekromant: ['jiskra', 'kostlivec', 'jed', 'upir'] };
  const MANA_TRIDY = { rytir: 6, zlodej: 8, mag: 22, barbar: 4, knez: 16, hranicar: 8, nekromant: 20 };

  // --- dovednosti: zlepšují se samy tím, jak je hráč používá (hráč vidí jen zvýšení) ---------
  const DOVEDNOSTI = {
    boj: { nazev: 'Boj zblízka', ikona: '⚔️', popis: 'za stupeň +3 % poškození a +1 % přesnost zbraní na blízko' },
    strelba: { nazev: 'Lukostřelba', ikona: '🏹', popis: 'za stupeň +4 % poškození a +2 % přesnost luku' },
    kouzleni: { nazev: 'Kouzlení', ikona: '✨', popis: 'za stupeň +2 many a +4 % síla kouzel' },
    odolnost: { nazev: 'Odolnost', ikona: '🛡️', popis: 'za stupeň +2 maximální zdraví' },
    kryti: { nazev: 'Krytí štítem', ikona: '🔰', popis: 'za stupeň zadrží krytí o 2 % víc zranění' },
    vsimavost: { nazev: 'Všímavost', ikona: '👁️', popis: 'za stupeň +3 % šance všimnout si pasti a +2 % zlata z truhel' },
  };
  // tituly podle stupně dovednosti (oznámí se při dosažení)
  const TITULY = [[20, 'velmistr'], [15, 'mistr'], [10, 'tovaryš'], [5, 'učeň'], [1, 'začátečník']];
  const titulDovednosti = u => TITULY.find(([od]) => u >= od)[1];
  const MAX_DOVEDNOST = 20;
  const potrebaDovednosti = u => Math.round(10 * Math.pow(u, 1.8));
  // stupeň dovednosti nad výchozí 1 (0 = nic navíc)
  const navic = (s, k) => { const d = s.hrac.dovednosti && s.hrac.dovednosti[k]; return d ? d.u - 1 : 0; };
  function cvic(s, k, ud, kolik) {
    const h = s.hrac;
    if (!h.dovednosti) h.dovednosti = {};
    const d = h.dovednosti[k] || (h.dovednosti[k] = { u: 1, zk: 0 });
    if (d.u >= MAX_DOVEDNOST) return;
    d.zk += kolik || 1;
    while (d.zk >= potrebaDovednosti(d.u) && d.u < MAX_DOVEDNOST) {
      d.zk -= potrebaDovednosti(d.u); d.u++;
      if (k === 'odolnost') h.hp += 2;
      ud.push({ typ: 'dovednost', klic: k, uroven: d.u, titul: d.u % 5 === 0 ? titulDovednosti(d.u) : null });
    }
  }
  function maxMany(s, o) {
    const h = s.hrac;
    return (h.manaZaklad || 0) + 2 * (o ? o.magie : odvozene(s).magie) + 2 * navic(s, 'kouzleni');
  }
  function naucKouzlo(s, ud) {
    const h = s.hrac, zname = h.kouzla || (h.kouzla = []);
    const mozna = Object.keys(KOUZLA).filter(k => !zname.includes(k) && KOUZLA[k].od <= h.uroven);
    if (!mozna.length) return;
    const k = mozna[Ri(s, 0, mozna.length - 1)];
    zname.push(k);
    // nové kouzlo hned do rychlé lišty, je-li volný slot (a ještě tam není)
    let slot = -1;
    if (Array.isArray(s.rychla) && !s.rychla.some(q => q && q.kouzlo === k)) {
      slot = s.rychla.findIndex(q => !q);
      if (slot >= 0) s.rychla[slot] = { kouzlo: k };
    }
    ud.push({ typ: 'noveKouzlo', klic: k, nazev: KOUZLA[k].nazev, slot });
  }
  // první potvora v přímce před hráčem (do `dosah` polí) a vzdálenost, kam kouzlo doletí
  function cilVPrimce(s, dosah) {
    let d = 1;
    for (; d <= dosah; d++) {
      const x = s.x + DX[s.smer] * d, y = s.y + DY[s.smer] * d;
      if (blokujePohled(s, x, y) || prekazkaNa(s, x, y)) break;
      const m = potvoraNa(s, x, y);
      if (m) return { m, d };
    }
    return { m: null, d: Math.max(1, d - 1) };
  }
  // cíl kouzla: první potvora v přímce; jinak nejbližší viditelná potvora před hrdinou (i šikmo) nebo hned vedle
  // – jako střelci a mágové, kteří na hrdinu míří odkudkoli, kam vidí
  function cilKouzla(s, dosah) {
    const pr = cilVPrimce(s, dosah);
    if (pr.m) return pr;
    let nej = null, nejV = 1e9;
    const fx = DX[s.smer], fy = DY[s.smer];
    for (const m of s.potvory) {
      if (m.hp <= 0) continue;
      const dx = m.x - s.x, dy = m.y - s.y, ch = Math.max(Math.abs(dx), Math.abs(dy));
      if (!ch || ch > dosah) continue;
      const pred = dx * fx + dy * fy;
      if (pred < 0 || (pred === 0 && ch > 1)) continue;   // za zády ne, z boku jen sousední
      if (!vidi(s, s.x, s.y, m.x, m.y)) continue;
      const v = dx * dx + dy * dy - 0.5 * pred;
      if (v < nejV) { nejV = v; nej = m; }
    }
    return nej ? { m: nej, d: Math.max(Math.abs(nej.x - s.x), Math.abs(nej.y - s.y)), navedeno: true } : pr;
  }
  const kamCil = m => (m ? { cx: m.x, cy: m.y } : {});
  function seslatKouzlo(s, k, ud) {
    const h = s.hrac, o = odvozene(s);
    if (k === 'ohen' || k === 'blesk' || k === 'teleport' || k === 'mapa') { sesli(s, k, ud); return; }
    if (k === 'hojeni') {
      const kolik = Math.min(o.maxHp - h.hp, silaKouzla(s, 6 + Math.floor(s.patro / 2)));
      h.hp += kolik;
      ud.push({ typ: 'kouzlo', kouzlo: 'leceni', text: `Hojivý dotek tě uzdravil (+${kolik}).` });
      return;
    }
    if (k === 'lumen') {
      h.lumen = 30 + 12 * Math.max(0, o.magie);
      ud.push({ typ: 'kouzlo', kouzlo: 'lumen', text: `Nad hlavou ti vzplálo Slunce podzemí (${h.lumen} tahů).` });
      return;
    }
    if (k === 'sipy') {
      const n = 8 + Math.max(0, o.magie);
      const st = h.batoh.find(q => q.typ === 'sipy');
      if (st) st.pocet += n; else { const p = novyPredmet(s, 'sipy', { pocet: n }); if (!doBatohu(s, p)) polozNaZem(s, s.x, s.y, [p], 0); }
      ud.push({ typ: 'kouzlo', kouzlo: 'sipy', text: `Z mlhy se zhmotnilo ${n} šípů.` });
      return;
    }
    if (k === 'jidlo') {
      const p = novyPredmet(s, o.magie >= 5 ? 'maso' : 'chleb');
      if (!doBatohu(s, p)) polozNaZem(s, s.x, s.y, [p], 0);
      ud.push({ typ: 'kouzlo', kouzlo: 'jidlo', text: `Vyčaroval jsi: ${nazevPredmetu(s, p)}.` });
      return;
    }
    if (k === 'uzdraveni') {
      const kolik = Math.min(o.maxHp - h.hp, silaKouzla(s, 16 + s.patro));
      h.hp += kolik; h.sytost = Math.min(100, h.sytost + 25);
      ud.push({ typ: 'kouzlo', kouzlo: 'leceni', text: `Slzy světice tě uzdravily (+${kolik}) a zahnaly hlad.` });
      return;
    }
    if (k === 'svetlo') {
      h.pochoden = Math.min(MAX_PALIVA, h.pochoden + 150);
      ud.push({ typ: 'kouzlo', kouzlo: 'svetlo', text: 'Plamen pochodně se rozzářil.' });
      return;
    }
    if (k === 'kuze') {
      h.kuze = 12;
      ud.push({ typ: 'kouzlo', kouzlo: 'kuze', text: 'Kůže ti zkameněla – obrana +3.' });
      return;
    }
    if (k === 'stit') {
      h.stitMag = (h.stitMag || 0) + silaKouzla(s, 8 + Math.floor(s.patro / 2));
      ud.push({ typ: 'kouzlo', kouzlo: 'stit', text: `Kolem tebe se rozzářil štít z run (pohltí ${h.stitMag} zranění).` });
      return;
    }
    if (k === 'retez') {                          // řetězový blesk: cíl a až 3 skoky na nejbližší další potvory
      const { m, d } = cilKouzla(s, 6);
      const cesta = [];
      if (m) {
        let dmg = silaUtocneho(s, Ri(s, 6, 11) + s.patro), akt = m;
        const zasazene = new Set();
        for (let i = 0; i < 4 && akt; i++) {
          cesta.push([akt.x, akt.y]); zasazene.add(akt);
          const pred = akt;
          zranPotvoru(s, akt, Math.max(1, dmg - Math.floor(BESTIAR[akt.druh].obrana / 3)), ud, true, TYP_KOUZLA[k] || 'magie');
          dmg = Math.round(dmg * 0.75);
          akt = null;
          let nejV = 99;
          for (const q of s.potvory) {
            if (q.hp <= 0 || zasazene.has(q)) continue;
            const v = Math.max(Math.abs(q.x - pred.x), Math.abs(q.y - pred.y));
            if (v <= 3 && v < nejV && vidi(s, pred.x, pred.y, q.x, q.y)) { nejV = v; akt = q; }
          }
        }
      }
      ud.push(Object.assign({ typ: 'kouzlo', kouzlo: 'retez', vzdalenost: d, cesta, text: m ? (cesta.length > 1 ? `Blesk přeskočil ${cesta.length - 1}×.` : '') : 'Blesk se ztratil ve tmě.' }, kamCil(m)));
      hluk(s, 6);
      return;
    }
    if (k === 'vanice') {
      const cile = s.potvory.filter(m => Math.max(Math.abs(m.x - s.x), Math.abs(m.y - s.y)) <= 2 && vidi(s, s.x, s.y, m.x, m.y));
      ud.push({ typ: 'kouzlo', kouzlo: 'vanice', text: cile.length ? 'Kolem tebe se zvedla ledová vánice!' : 'Vánice se zvedla – nikoho nezasáhla.' });
      for (const m of cile) if (m.hp > 0) { zranPotvoru(s, m, silaUtocneho(s, Ri(s, 4, 8) + Math.floor(s.patro * 0.8)), ud, true, TYP_KOUZLA[k] || 'magie'); if (m.hp > 0) m.energie = Math.min(m.energie, -1.2); }
      hluk(s, 5);
      return;
    }
    if (k === 'meteor') {
      const { m, d } = cilKouzla(s, 7);
      ud.push(Object.assign({ typ: 'kouzlo', kouzlo: 'meteor', vzdalenost: d, text: m ? '' : 'Hvězda dopadla do prázdna.' }, kamCil(m)));
      if (m) {
        const dmg = silaUtocneho(s, Ri(s, 14, 22) + 2 * s.patro), kolem = s.potvory.filter(q => q !== m && Math.max(Math.abs(q.x - m.x), Math.abs(q.y - m.y)) <= 1);
        zranPotvoru(s, m, Math.max(1, dmg - Math.floor(BESTIAR[m.druh].obrana / 3)), ud, true, TYP_KOUZLA[k] || 'magie');
        for (const q of kolem) if (q.hp > 0) zranPotvoru(s, q, Math.max(1, Math.round(dmg / 2)), ud, true, TYP_KOUZLA[k] || 'magie');
        zapalSudy(s, m.x, m.y, ud);
      }
      hluk(s, 8);
      return;
    }
    if (k === 'miza') {
      h.miza = 15;
      ud.push({ typ: 'kouzlo', kouzlo: 'miza', text: 'Žilami ti proudí živá míza – 15 tahů se hojíš.' });
      return;
    }
    if (k === 'odraz') {
      h.odraz = 10;
      ud.push({ typ: 'kouzlo', kouzlo: 'odraz', text: 'Kůže se ti zaleskla jako zrcadlo – 10 tahů vracíš zranění.' });
      return;
    }
    if (k === 'zavoj') {
      let n = 0;
      h.skryt = s.tah + 6;
      for (const m of s.potvory) if (m.stav === 'honi' && !BESTIAR[m.druh].boss && Math.abs(m.x - s.x) + Math.abs(m.y - s.y) <= 5) { m.stav = 'bloudi'; m.stopa = 0; n++; }
      ud.push({ typ: 'kouzlo', kouzlo: 'zavoj', text: n ? `Závoj tmy tě skryl – ${n} ${n === 1 ? 'potvora tě ztratila' : n <= 4 ? 'potvory tě ztratily' : 'potvor tě ztratilo'}.` : 'Závoj tmy tě zahalil – nikdo tě nehonil.' });
      return;
    }
    if (k === 'koreny') {
      const { m, d } = cilKouzla(s, 5);
      ud.push(Object.assign({ typ: 'kouzlo', kouzlo: 'koreny', vzdalenost: d, text: m ? `${BESTIAR[m.druh].nom}: kořeny ${BESTIAR[m.druh].boss ? 'ho na chvíli zdržely' : 'ji spoutaly'}.` : 'Kořeny se zavrtaly do prázdna.' }, kamCil(m)));
      if (m) m.energie = Math.min(m.energie, BESTIAR[m.druh].boss ? -1 : -3);
      return;
    }
    if (k === 'oslneni') {
      let n = 0;
      for (const m of s.potvory) if (Math.max(Math.abs(m.x - s.x), Math.abs(m.y - s.y)) <= 4 && vidi(s, s.x, s.y, m.x, m.y)) { m.oslepen = s.tah + 6; n++; }
      ud.push({ typ: 'kouzlo', kouzlo: 'oslneni', text: n ? `Záblesk oslnil ${n} ${n === 1 ? 'potvoru' : n <= 4 ? 'potvory' : 'potvor'}.` : 'Záblesk ozářil prázdnou chodbu.' });
      return;
    }
    if (k === 'svetloKnez') {
      const { m, d } = cilKouzla(s, 5);
      ud.push(Object.assign({ typ: 'kouzlo', kouzlo: 'svetloKnez', vzdalenost: d, text: m ? '' : 'Světlo ozářilo prázdnou chodbu.' }, kamCil(m)));
      if (m) zranPotvoru(s, m, Math.max(1, silaUtocneho(s, Ri(s, 4, 8) + Math.floor(s.patro * 0.8)) - Math.floor(BESTIAR[m.druh].obrana / 3)), ud, true, 'svetlo');
      h.hp = Math.min(o.maxHp, h.hp + 2 + Math.floor(Math.max(0, o.magie) / 2));
      return;
    }
    if (k === 'ocista') {
      const n = vylec(s, 'vse', ud);
      ud.push({ typ: 'kouzlo', kouzlo: 'leceni', text: n ? 'Očista z tebe smyla všechny neduhy.' : 'Nic tě netrápí – očista jen zahřála.' });
      return;
    }
    if (k === 'kostlivec' || k === 'vlk') {
      if (s.spolecnik) { ud.push({ typ: 'kouzlo', kouzlo: k, text: 'Nikdo nepřišel – už máš společníka.' }); return; }
      const kost = k === 'kostlivec';
      s.spolecnik = { druh: kost ? 'kostlivec' : 'vlk', x: s.x, y: s.y, hp: 0, maxHp: 0, uroven: 0, docasny: s.tah + (kost ? 40 + 4 * Math.max(0, o.magie) : 25 + 3 * Math.max(0, o.magie)) };
      srovnejSpolecnika(s); s.spolecnik.hp = s.spolecnik.maxHp;
      ud.push({ typ: 'kouzlo', kouzlo: k, text: kost ? `Ze země se vyhrabal kostlivec-sluha (${s.spolecnik.docasny - s.tah} tahů).` : `Ze stínů vystoupil vlk (${s.spolecnik.docasny - s.tah} tahů).` });
      return;
    }
    if (k === 'vlk') {
      if (s.spolecnik) { ud.push({ typ: 'kouzlo', kouzlo: 'vlk', text: 'Vlk nepřišel – už máš společníka.' }); return; }
      s.spolecnik = { druh: 'vlk', x: s.x, y: s.y, hp: 0, maxHp: 0, uroven: 0, docasny: s.tah + 25 + 3 * Math.max(0, o.magie) };
      srovnejSpolecnika(s); s.spolecnik.hp = s.spolecnik.maxHp;
      ud.push({ typ: 'kouzlo', kouzlo: 'vlk', text: `Ze stínů vystoupil vlk (${s.spolecnik.docasny - s.tah} tahů).` });
      return;
    }
    if (k === 'otres') {
      const cile = s.potvory.filter(m => Math.abs(m.x - s.x) + Math.abs(m.y - s.y) <= 2);
      ud.push({ typ: 'kouzlo', kouzlo: 'otres', text: cile.length ? 'Země se otřásla!' : 'Země se otřásla – nikoho to nezasáhlo.' });
      for (const m of cile) if (m.hp > 0) zranPotvoru(s, m, silaUtocneho(s, Ri(s, 4, 8) + s.patro), ud, true, TYP_KOUZLA[k] || 'magie');
      hluk(s, 8);
      return;
    }
    if (k === 'odhaleni') {
      const p = s.mapaPatra;
      let n = 0;
      for (const t of s.pasti) if (!t.odhalena && Math.abs(t.x - s.x) + Math.abs(t.y - s.y) <= 6) { t.odhalena = true; n++; }
      for (let y = s.y - 6; y <= s.y + 6; y++) for (let x = s.x - 6; x <= s.x + 6; x++) {
        if (x > 0 && y > 0 && x < p.w - 1 && y < p.h - 1 && p.mapa[y * p.w + x] === T.TAJNE && Math.abs(x - s.x) + Math.abs(y - s.y) <= 6) { odhalTajne(s, x, y, ud, 'kouzlo'); n++; }
      }
      ud.push({ typ: 'kouzlo', kouzlo: 'odhaleni', text: n ? `Runy se rozzářily – odhalených tajemství: ${n}.` : 'Nic skrytého tu není.' });
      return;
    }
    // jed, děs, uspání: působí na první potvoru v přímce (do 6 polí)
    if (k === 'jed' || k === 'strach' || k === 'spanek') {
      const { m, d } = cilKouzla(s, 6);
      ud.push(Object.assign({ typ: 'kouzlo', kouzlo: k, vzdalenost: d, text: m ? '' : 'Kouzlo se rozplynulo o zeď.' }, kamCil(m)));
      if (!m) return;
      const b = BESTIAR[m.druh];
      if (k === 'jed') { m.jed = { dmg: Math.max(1, silaUtocneho(s, 2 + Math.floor(s.patro / 3))), zbyva: 5 }; ud.push({ typ: 'kouzloUcinek', text: `${b.nom}: jed začíná působit.` }); }
      else if (b.boss) ud.push({ typ: 'kouzloUcinek', text: `${b.nom} kouzlu odolal.` });
      else if (k === 'strach') { m.stav = 'utika'; m.strachDo = s.tah + 8; ud.push({ typ: 'utika', id: m.id, druh: m.druh, x: m.x, y: m.y }); }
      else { m.stav = 'spi'; m.spankem = s.tah + 6; ud.push({ typ: 'kouzloUcinek', text: `${b.nom} usnul${b.rod === 'z' ? 'a' : b.rod === 's' ? 'o' : ''}.` }); }
      if (m.stav !== 'spi' || k !== 'spanek') hluk(s, 3);
      return;
    }
    // jiskra, ledový šíp, vysátí: první potvora v přímce
    const { m, d } = cilKouzla(s, 5);
    ud.push(Object.assign({ typ: 'kouzlo', kouzlo: k, vzdalenost: d, text: m ? '' : 'Kouzlo se rozplynulo o zeď.' }, kamCil(m)));
    if (m) {
      const b = BESTIAR[m.druh], zaklad = k === 'led' || k === 'upir' ? Ri(s, 5, 9) + s.patro : Ri(s, 3, 6) + Math.floor(s.patro * 0.6);
      const dmg = Math.max(1, silaUtocneho(s, zaklad) - Math.floor(b.obrana / 3));
      zranPotvoru(s, m, dmg, ud, true, TYP_KOUZLA[k] || 'magie');
      if (k === 'upir') { const kolik = Math.min(odvozene(s).maxHp - h.hp, Math.ceil(dmg / 2)); h.hp += kolik; if (kolik) ud.push({ typ: 'kouzloUcinek', text: `Vysátý život tě posílil (+${kolik}).` }); }
      if (k === 'led' && m.hp > 0) m.energie = Math.min(m.energie, -1.5);       // zmrzlá potvora pár tahů nejedná
      if (k === 'jiskra') zapalSudy(s, m.x, m.y, ud);
    }
    hluk(s, 4);
  }

  // --- náhodné prvky v patře: elitní potvory, přepadení, zlatý goblin ----------------------
  const ELITY = {
    zurivy: { nazev: 'Zuřivý', popis: 'silnější útok' },
    obrneny: { nazev: 'Obrněný', popis: 'dvakrát víc zdraví' },
    rychly: { nazev: 'Rychlý', popis: 'jedná o polovinu častěji' },
  };
  // elity se losují až na konci stavby patra s vlastní náhodou (staré uložené hry se nezmění)
  function elity(s) {
    const p = s.mapaPatra, R = nahoda(smichej(s.seed ^ 0xE117E, p.patro));
    if (p.patro < 3) return;
    const druhy = Object.keys(ELITY);
    for (const m of s.potvory) {
      if (BESTIAR[m.druh].boss || m.nacelnik || R.f() >= 0.07) continue;
      udelejElitu(m, druhy[Math.floor(R.f() * druhy.length)], p.patro);
    }
  }
  function udelejElitu(m, druh, patro) {
    m.elita = druh;
    if (druh === 'obrneny') { m.maxHp = m.hp = Math.round(m.maxHp * 2); }
    else { m.maxHp = m.hp = Math.round(m.maxHp * 1.3); }
    if (druh === 'zurivy') m.bonus += 2 + Math.floor(patro / 5);
  }
  // přepadení: při vstupu do neprobádané místnosti se ze stínů občas vynoří smečka
  function prepadeni(s, m, ud) {
    if (s.patro < 2 || m.tajna || m.boss || m.ucel === 'obchod' || m.ucel === 'kovarna' || m.ucel === 'poi' || Rs(s) >= 0.07) return;
    const druhy = Object.keys(BESTIAR).filter(k => !BESTIAR[k].boss && BESTIAR[k].od <= s.patro && s.patro <= BESTIAR[k].do);
    if (!druhy.length) return;
    const druh = druhy[Ri(s, 0, druhy.length - 1)];
    let n = 0;
    for (let k = 0; k < 4 && n < (s.patro >= 8 ? 2 : 1); k++) {
      const x = s.x + DX[(s.smer + 2 + k) % 4] * 2, y = s.y + DY[(s.smer + 2 + k) % 4] * 2;   // nejdřív za zády
      if (!volneProPotvoru(s, x, y, null, { dvere: false }) || !vidi(s, s.x, s.y, x, y)) continue;
      const q = novaPotvora(s, druh, x, y, false);
      q.stav = 'honi'; q.stopa = 12;
      s.potvory.push(q); n++;
    }
    if (n) ud.push({ typ: 'prepadeni', druh, pocet: n });
  }
  // zlatý goblin: vzácně se objeví, utíká a za pár tahů zmizí; kdo ho chytí, zbohatne
  const SANCE_ZLATEHO = 1 / 450;
  function zlatyGoblin(s, ud) {
    const p = s.mapaPatra;
    if (s.patro < 2 || L_BOSS(s) || s.potvory.some(m => m.druh === 'zlatyGoblin')) return;
    for (let k = 0; k < 40; k++) {
      const x = Ri(s, 1, p.w - 2), y = Ri(s, 1, p.h - 2), dd = Math.abs(x - s.x) + Math.abs(y - s.y);
      if (dd < 3 || dd > 7 || !vidi(s, s.x, s.y, x, y) || !volneProPotvoru(s, x, y, null, { dvere: false })) continue;
      const m = novaPotvora(s, 'zlatyGoblin', x, y, false);
      m.hp = m.maxHp = 10 + 3 * s.patro;
      m.stav = 'utika'; m.strachDo = s.tah + 999; m.zmizi = s.tah + 35;
      s.potvory.push(m);
      ud.push({ typ: 'zlatyGoblin', id: m.id, x, y });
      return;
    }
  }
  const L_BOSS = s => s.potvory.some(m => BESTIAR[m.druh].boss);

  // mana a kouzla podle povolání (i pro starší uložené hry, které je neznaly)
  function pripravMagii(s) {
    const h = s.hrac;
    if (h.manaZaklad === undefined) h.manaZaklad = MANA_TRIDY[s.trida] || 6;
    if (!h.kouzla) h.kouzla = (KOUZLA_TRIDY[s.trida] || KOUZLA_TRIDY.rytir).slice();
    if (!h.dovednosti) h.dovednosti = {};
    if (h.mana === undefined) h.mana = maxMany(s);
  }
  // --- schopnosti (volba každou 3. úroveň) ----------------------------
  // strom schopností: stupeň 1 od 3. úrovně, stupeň 2 (mistrovství) od 9. úrovně a jen po své základní schopnosti,
  // stupeň 3 (legendární) od 15. úrovně po aspoň jedné schopnosti 2. stupně
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
    // 2. stupeň – mistrovství navazující na základní schopnost
    mistrZbrani: { nazev: 'Mistr zbraní', ikona: '🗡️', stupen: 2, vyzaduje: 'bojovnik', popis: 'Zbraně na blízko: 15 % zásahů je kritických (dvojnásobné zranění).' },
    odstrelovac: { nazev: 'Odstřelovač', ikona: '🎯', stupen: 2, vyzaduje: 'lukostrelec', popis: 'Šípy zraňují o 30 % víc a 15 % zásahů je kritických.' },
    vrah: { nazev: 'Vrah ze stínů', ikona: '🌑', stupen: 2, vyzaduje: 'zlodej', popis: 'Potvora zabitá útokem ze zálohy dá dvojnásobek zkušeností a vrátí ti 5 zdraví.' },
    arcimag: { nazev: 'Arcimág', ikona: '🔮', stupen: 2, vyzaduje: 'mag', popis: 'Kouzla z knihy stojí o pětinu méně many.' },
    druhyDech: { nazev: 'Druhý dech', ikona: '💖', stupen: 2, vyzaduje: 'tuhy', popis: 'Jednou za patro přežiješ smrtelný zásah – zůstane ti čtvrtina zdraví.' },
    tanecnik: { nazev: 'Tanečník s čepelí', ikona: '🌀', stupen: 2, vyzaduje: 'hbity', popis: 'Po úhybu je tvůj další útok jistý a o polovinu silnější.' },
    krvezizen: { nazev: 'Krvežíznivý', ikona: '🩸', stupen: 2, vyzaduje: 'houzevnaty', popis: 'Každá zabitá potvora ti vrátí 3 zdraví.' },
    hodovnik: { nazev: 'Hodovník', ikona: '🍗', stupen: 2, vyzaduje: 'skromny', popis: 'Každé jídlo navíc léčí 8 zdraví.' },
    kupec: { nazev: 'Kupec', ikona: '⚖️', stupen: 2, vyzaduje: 'smlouvac', popis: 'Výkup za polovinu ceny a kování o třetinu levnější.' },
    basta: { nazev: 'Bašta', ikona: '🏰', stupen: 2, vyzaduje: 'stitonos', popis: 'Krytím štítem vrátíš útočníkovi polovinu zadrženého zranění.' },
    pyromant: { nazev: 'Pyromant', ikona: '☄️', stupen: 2, vyzaduje: 'zaklinac', popis: 'Zásah kouzlem potvoru zapálí – 3 tahy hoří.' },
    pokladnik: { nazev: 'Hledač pokladů', ikona: '💎', stupen: 2, vyzaduje: 'stastlivec', popis: 'V truhlách je o věc víc a potvory nechávají o třetinu víc zlata.' },
    // 3. stupeň – legendární
    legenda: { nazev: 'Živoucí legenda', ikona: '👑', stupen: 3, popis: 'Síla +2, obratnost +2, magie +2 a zdraví +20.' },
    neuprosny: { nazev: 'Neúprosný', ikona: '⚡', stupen: 3, popis: 'Každá zabitá potvora ti doplní 2 zdraví a 3 many.' },
    nezlomny: { nazev: 'Nezlomný', ikona: '🗿', stupen: 3, popis: 'Obrana +4.' },
  };
  const OD_STUPNE = [0, 3, 9, 15];
  const stupenSchopnosti = k => SCHOPNOSTI[k].stupen || 1;
  // může si hráč schopnost vybrat? vrací null, nebo důvod, proč ne
  function proc_nelze(s, k) {
    const h = s.hrac, S = SCHOPNOSTI[k], st = stupenSchopnosti(k);
    if (ma(s, k)) return 'už ji máš';
    if (h.uroven < OD_STUPNE[st]) return `od ${OD_STUPNE[st]}. úrovně`;
    if (S.vyzaduje && !ma(s, S.vyzaduje)) return `vyžaduje ${SCHOPNOSTI[S.vyzaduje].nazev}`;
    if (st === 3 && !(h.schopnosti || []).some(q => stupenSchopnosti(q) === 2)) return 'vyžaduje schopnost 2. stupně';
    return null;
  }
  // body vlastností: za každou úroveň 2 body k rozdělení (zbytek růstu je automatický)
  const BODY_VLASTNOSTI = {
    sila: { nazev: 'Síla', ikona: '💪', popis: 'silnější rány zbraní i luku' },
    obratnost: { nazev: 'Obratnost', ikona: '🎯', popis: '+3 % přesnost, +1,5 % šance uhnout, silnější šípy' },
    vydrz: { nazev: 'Výdrž', ikona: '❤️', popis: '+5 maximální zdraví' },
    magie: { nazev: 'Magie', ikona: '✨', popis: '+2 many, silnější kouzla, rychlejší obnova many' },
  };
  const BODU_ZA_UROVEN = 2;
  // úhyb: Hbitý 20 %, obratnost +1 % za bod (náhoda se losuje jen když je šance – staré výpravy se nezmění)
  function uhne(s) {
    const o = odvozene(s);
    if (s.hrac.stavy && s.hrac.stavy.omrzlina > 0) return false;      // zmrzlý neuhne
    const sance = (ma(s, 'hbity') ? 0.2 : 0) + 0.015 * (o.obratnost || 0) + 0.01 * (o.uhybNavic || 0) + 0.01 * (o.uhybRuny || 0);
    return sance > 0 && Rs(s) < Math.min(0.45, sance);
  }
  const cenaKouzla = (s, k) => ma(s, 'arcimag') ? Math.ceil(KOUZLA[k].mana * 0.8) : KOUZLA[k].mana;
  const ma = (s, k) => !!(s.hrac.schopnosti && s.hrac.schopnosti.includes(k));
  function nabidniSchopnosti(s, ud) {
    const volne = Object.keys(SCHOPNOSTI).filter(k => !proc_nelze(s, k));
    const nabidka = [];
    // je-li dostupné mistrovství (2.–3. stupeň), jedno z nich je v nabídce vždy
    const vyssi = volne.filter(k => stupenSchopnosti(k) > 1);
    if (vyssi.length) { const k = vyssi[Ri(s, 0, vyssi.length - 1)]; nabidka.push(k); volne.splice(volne.indexOf(k), 1); }
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
      // automaticky: +3 zdraví, obrana každou 3. úrovní; zbytek si hráč rozdělí (2 body)
      h.maxHp += 3;
      h.hp = Math.min(odvozene(s).maxHp, h.hp + 5 + Math.round(h.maxHp * 0.3));
      if (h.uroven % 3 === 0) h.obrana++;
      h.body = (h.body || 0) + BODU_ZA_UROVEN;
      ud.push({ typ: 'uroven', uroven: h.uroven, body: h.body });
      if (h.uroven % 3 === 0 && !h.volba) nabidniSchopnosti(s, ud);
      if (h.uroven % 2 === 0) naucKouzlo(s, ud);
    }
  }

  const PRICINY_HLADU = ['hlad – podzemí nemá hospody', 'prázdný žaludek a plný batoh'];
  function zemri(s, pricina, druh, ud) {
    const h = s.hrac;
    if (ma(s, 'druhyDech') && h.druhyDech !== s.patro && druh !== 'hlad' && druh !== 'vitezstvi') {   // jednou za patro přežije
      h.druhyDech = s.patro;
      h.hp = Math.max(1, Math.round(odvozene(s).maxHp / 4));
      ud.push({ typ: 'druhyDech', hp: h.hp });
      return;
    }
    h.hp = 0;
    s.mrtvy = {
      jmeno: s.jmeno, rod: s.rod, patro: s.patro, zabito: s.zabito, tajne: s.tajne, zlato: s.zlato,
      tahu: s.tah, uroven: h.uroven, druh, pricina, bossu: s.bossu || 0, biom: s.mapaPatra.biom, trida: s.trida, denni: s.denni,
      // pro síň slávy: podoba hrdiny, schopnosti, výbava (název + vzácnost), dovednosti, seed
      tvar: s.tvar || 0, seed: s.seed, schopnosti: (h.schopnosti || []).slice(), kouzel: (h.kouzla || []).length,
      vybava: SLOTY.map(k => h.vybava[k] && [k, nazevPredmetu(s, h.vybava[k]), h.vybava[k].vzacnost || 0]).filter(Boolean),
      dovednosti: Object.fromEntries(Object.entries(h.dovednosti || {}).map(([k, d]) => [k, d.u])),
      zaloh: (s.stat && s.stat.zaloha) || 0, poi: (s.stat && s.stat.poi) || 0,
      obtiznost: s.obtiznost || 'normalni', zelezny: !!s.zelezny, spolecnik: s.spolecnik ? s.spolecnik.druh : null,
      prubeh: (s.prubeh || []).slice(-60), vitezstvi: !!s.vitezstvi,
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
    let druhy = Object.keys(BESTIAR).filter(k => BESTIAR[k].od <= p.patro && p.patro <= BESTIAR[k].do && (!BESTIAR[k].biom || BESTIAR[k].biom === p.biom));
    if (!druhy.length) druhy = Object.keys(BESTIAR).filter(k => BESTIAR[k].od <= p.patro && !BESTIAR[k].boss && !BESTIAR[k].biom);
    const vahy = druhy.map(k => BESTIAR[k].vaha * (p.patro - BESTIAR[k].od < 3 ? 1.4 : 1) * (BESTIAR[k].biom ? 1.8 : 1));
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
    const d = BESTIAR[druh], navic = Math.max(0, s.patro - (d.rustOd ?? d.od)), pozde = Math.max(0, s.patro - OBTIZNOST.pozdniOd);
    const ob = OBTIZNOSTI[s.obtiznost] || OBTIZNOSTI.normalni, kl = kletbaPatra(s);
    const hp = Math.round(d.hp * (1 + OBTIZNOST.hpRust * navic + OBTIZNOST.hpPozdni * pozde) * ob.hp * (kl === 'odolnost' ? 1.5 : 1));   // od pozdniOd potvory rostou rychleji
    return {
      id: s.dalsiId = (s.dalsiId || 0) + 1, druh, x, y, hp, maxHp: hp,
      bonus: Math.max(0, Math.floor(navic * OBTIZNOST.utokRust + pozde * OBTIZNOST.utokPozdni) + ob.utok + (kl === 'zurivost' ? 3 + Math.floor(s.patro / 10) : 0)), stav: spi ? 'spi' : 'bloudi', energie: 0, stopa: 0,
    };
  }

  const potvoraNa = (s, x, y) => s.potvory.find(m => m.x === x && m.y === y && m.hp > 0);

  // --- stav výpravy --------------------------------------------
  function novaVyprava(seed, trida, denni, volby) {
    const s = { verze: 2, seed: seed >>> 0, patro: 1, tah: 0, nejhlubsi: 1, rng: (seed ^ 0x5EED) | 0, trida: TRIDY[trida] ? trida : 'rytir', denni: denni || null,
      obtiznost: volby && OBTIZNOSTI[volby.obtiznost] ? volby.obtiznost : 'normalni', zelezny: !!(volby && volby.zelezny) };
    novyHrdina(s);
    vstupDoPatra(s, 1);
    const tr = TRIDY[s.trida];
    if (tr.spolecnik) { s.spolecnik = { druh: tr.spolecnik, x: s.x, y: s.y, hp: 0, maxHp: 0, uroven: 0 }; srovnejSpolecnika(s); s.spolecnik.hp = s.spolecnik.maxHp; }
    if (volby && volby.tabor && !denni) pouzijTabor(s, volby.tabor);
    return s;
  }
  // tábor nahoře: trvalá vylepšení zaplacená relikviemi z dřívějších výprav (úroveň 0–5)
  const TABOR = {
    zlato: { nazev: 'Pokladnice tábora', ikona: '💰', popis: '+60 zlata na začátku', za: 60 },
    mista: { nazev: 'Brašnář', ikona: '🎒', popis: '+2 místa v batohu', za: 2 },
    lektvary: { nazev: 'Bylinkářka', ikona: '🧪', popis: '+1 lektvar léčení na cestu', za: 1 },
    zdravi: { nazev: 'Výcvik', ikona: '❤️', popis: '+5 maximálního zdraví', za: 5 },
    sleva: { nazev: 'Dohoda s obchodníky', ikona: '⚖️', popis: '−4 % ceny u obchodníka', za: 4 },
    pochoden: { nazev: 'Smolař', ikona: '🔥', popis: 'pochodeň o 100 tahů delší', za: 100 },
  };
  const MAX_TABOR = 5;
  const cenaTabor = uroven => 3 * (uroven + 1);
  function pouzijTabor(s, ur) {
    const h = s.hrac, n = k => Math.max(0, Math.min(MAX_TABOR, ur[k] | 0));
    s.zlato += 60 * n('zlato');
    h.taborMista = 2 * n('mista');
    for (let i = 0; i < n('lektvary'); i++) doBatohu(s, novyPredmet(s, 'lektvar', { lektvar: 'leceni' }));
    h.maxHp += 5 * n('zdravi'); h.hp += 5 * n('zdravi');
    h.taborSleva = 0.04 * n('sleva');
    h.pochoden += 100 * n('pochoden');
  }
  // relikvie za výpravu: hloubka, bossové a vítězství
  const relikvieZa = m => Math.floor(m.patro / 5) + 2 * (m.bossu || 0) + (m.vitezstvi ? 15 : 0);

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
    s.sebraneLouce = new Set(); s.paka = null; s.teleporty = null; s.prokopano = new Set();
    s.navstivene.add(p.mistnostId[p.start.y * p.w + p.start.x]);
    s.obchodPred = s.posledniObchod || 0;        // stav při vstupu – po načtení se patro postaví stejně
    zalidni(s);
    if (patro % 10 === 0) umistiBosse(s);
    zarizeni(s);
    rozmistiKorist(s);
    kovarna(s);
    zadejUkol(s);
    zajimavosti(s);
    elity(s);
    ozdoby(s);
    interaktivni(s);
    s.stopy = [];
    strankaPatra(s);
    if (s.spolecnik) { s.spolecnik.x = s.x; s.spolecnik.y = s.y; }
    aktualizujViditelnost(s);
  }

  // --- úkoly v patře: náčelník, ztracený deník, lov -------------------------------------------------
  // Jako kovárna až na konci a s vlastní náhodou; stav úkolu se ukládá s výpravou.
  function zadejUkol(s) {
    const p = s.mapaPatra, R = nahoda(smichej(s.seed ^ 0x0B0C0B, p.patro));
    s.ukol = null;
    if (p.patro < 2 || p.patro % 10 === 0 || R.f() >= 0.45) return;
    const startM = p.mistnostId[p.start.y * p.w + p.start.x];
    const mimoStart = q => p.mistnostId[q.y * p.w + q.x] !== startM && Math.abs(q.x - p.start.x) + Math.abs(q.y - p.start.y) >= 6;
    const druh = ['nacelnik', 'denik', 'lov'][Math.floor(R.f() * 3)];
    if (druh === 'nacelnik') {
      const kandidati = s.potvory.filter(q => !BESTIAR[q.druh].boss && mimoStart(q)).sort((a, b) => b.maxHp - a.maxHp);
      const m = kandidati[Math.floor(R.f() * Math.min(3, kandidati.length))];
      if (!m) return;
      m.nacelnik = true; m.hp = m.maxHp = Math.round(m.maxHp * 2); m.bonus += 2;
      s.ukol = { typ: 'nacelnik', druh: m.druh, id: m.id, hotovo: 0, cil: 1 };
    } else if (druh === 'denik') {
      const volna = [];
      for (let y = 1; y < p.h - 1; y++) for (let x = 1; x < p.w - 1; x++) {
        const i = y * p.w + x, mid = p.mistnostId[i];
        if (p.mapa[i] !== T.PODLAHA || mid < 0 || mid === startM || p.mistnosti[mid].tajna || p.mistnosti[mid].ucel) continue;
        if (!mimoStart({ x, y }) || !volnePole(s, x, y) || s.zeme.some(z => z.x === x && z.y === y)) continue;
        volna.push({ x, y });
      }
      const c = volna[Math.floor(R.f() * volna.length)];
      if (!c) return;
      const d = { id: s.dalsiId = (s.dalsiId || 0) + 1, zaklad: 'denikUkol', typ: 'ukol', uroven: 1, vzacnost: 0, bonusy: {} };
      s.zeme.push({ x: c.x, y: c.y, predmety: [d], zlato: 0 });
      s.ukol = { typ: 'denik', hotovo: 0, cil: 1 };
    } else {
      const n = Math.min(6, Math.max(3, Math.floor(s.potvory.length * 0.6)));
      if (s.potvory.length < 3) return;
      s.ukol = { typ: 'lov', hotovo: 0, cil: n };
    }
  }
  // popis úkolu pro HUD a zprávy
  function popisUkolu(s) {
    const u = s.ukol;
    if (!u) return '';
    if (u.typ === 'nacelnik') return `Zabij náčelníka – ${BESTIAR[u.druh].aku}`;
    if (u.typ === 'denik') return 'Najdi deník padlého dobrodruha';
    return `Vyhub ${u.cil} potvor v patře (${u.hotovo}/${u.cil})`;
  }
  function postupUkolu(s, typ, ud, m) {
    const u = s.ukol;
    if (!u || u.hotovo >= u.cil || u.typ !== typ) return;
    if (typ === 'nacelnik' && (!m || !m.nacelnik)) return;
    u.hotovo++;
    if (u.hotovo < u.cil) { ud.push({ typ: 'ukolPostup', text: popisUkolu(s) }); return; }
    // odměna: zlato a předmět o dvě úrovně lepší (do batohu, jinak k nohám)
    const zlato = s.patro * Ri(s, 12, 20) + 20;
    const p = nahodnyPredmet(s, s.patro + 2, vazenyVyber(s, [['zbran', 1], ['ochrana', 1.4], ['sperk', 0.8], ['magie', 0.3]]));
    delete p.prokleti; delete p.odhaleno;
    if (p.vzacnost !== undefined && slotPro(p)) p.vzacnost = Math.max(1, p.vzacnost);
    s.zlato += zlato;
    if (!doBatohu(s, p)) polozNaZem(s, s.x, s.y, [p], 0);
    s.stat.ukolu = (s.stat.ukolu || 0) + 1;
    ud.push({ typ: 'ukolSplnen', zlato, nazev: nazevPredmetu(s, p), ukol: u.typ });
  }

  // --- kovárna: kovář vylepšuje zbraně a zbroj (+1 poškození / obrana za stupeň, nejvýš +5) ---------
  // Umisťuje se až po všem ostatním a s vlastní náhodou – dřívější uložení se po načtení postaví stejně.
  const MAX_KOVANI = 5;
  const KOVATELNE = ['zbran', 'luk', 'stit', 'helma', 'brneni', 'boty'];
  function kovarna(s) {
    const p = s.mapaPatra, R = nahoda(smichej(s.seed ^ 0x60A7F0, p.patro));
    s.kovar = null;
    if (p.patro < 3 || p.patro % 10 === 0 || R.f() >= 0.32) return;
    const startM = p.mistnostId[p.start.y * p.w + p.start.x], dolM = p.mistnostId[p.dolu.y * p.w + p.dolu.x];
    const kandidati = p.mistnosti.filter(m => !m.tajna && !m.ucel && !m.boss && m.id !== startM && m.id !== dolM);
    const m = kandidati[Math.floor(R.f() * kandidati.length)];
    const o = m && umisti(s, m, R, 'mistrKovar');
    if (!o) return;
    m.ucel = 'kovarna';
    s.potvory = s.potvory.filter(q => p.mistnostId[q.y * p.w + q.x] !== m.id);   // v kovárně se nebojuje
    s.kovar = { x: o.x, y: o.y, mistnost: m.id };
  }
  const uKovare = s => !!s.kovar && Math.abs(s.kovar.x - s.x) + Math.abs(s.kovar.y - s.y) === 1;
  const kovatelny = p => !!p && KOVATELNE.includes(slotPro(p) || '') && (p.kovani || 0) < MAX_KOVANI;
  const cenaKovani = (s, p) => Math.round(70 * Math.pow((p.kovani || 0) + 1, 2) * (1 + 0.08 * s.patro) * (ma(s, 'smlouvac') ? 0.8 : 1) * (ma(s, 'kupec') ? 0.67 : 1));
  const rudyNaKovani = p => 2 * ((p.kovani || 0) + 1);
  const rudyVBatohu = s => s.hrac.batoh.filter(q => q.typ === 'surovina').reduce((a, q) => a + kusu(q), 0);
  function kovat(s, arg, ud) {
    if (!uKovare(s) || !arg) return false;
    const h = s.hrac, p = SLOTY.map(k => h.vybava[k]).concat(h.batoh).find(q => q && q.id === arg.id);
    if (!kovatelny(p)) return false;
    if (arg.platba === 'ruda') {
      const n = rudyNaKovani(p);
      if (rudyVBatohu(s) < n) { ud.push({ typ: 'maloRudy', kolik: n }); return false; }
      for (let zbyva = n; zbyva > 0;) {
        const i = h.batoh.findIndex(q => q.typ === 'surovina');
        const k = Math.min(zbyva, kusu(h.batoh[i]));
        if (k >= kusu(h.batoh[i])) h.batoh.splice(i, 1); else h.batoh[i].pocet -= k;
        zbyva -= k;
      }
    } else {
      const cena = cenaKovani(s, p);
      if (s.zlato < cena) { ud.push({ typ: 'malo', cena }); return false; }
      s.zlato -= cena; s.stat.utraceno += cena;
    }
    p.kovani = (p.kovani || 0) + 1;
    srovnejZdravi(s);
    ud.push({ typ: 'kovano', nazev: nazevPredmetu(s, p), stupen: p.kovani, platba: arg.platba === 'ruda' ? 'ruda' : 'zlato' });
    return true;
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
    dosah = dosah || (s.hrac && s.hrac.pochoden <= 0 ? 2 : maLucernu(s) ? 6 : 5);   // bez pochodně vidíš jen kousek, s lucernou dál
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
  // každá akce končí úklidem hromádek v batohu
  function akce(s, typ, arg) {
    const r = akceBezUklidu(s, typ, arg);
    if (s.spolecnik) { s.spolecnik.x = s.x; s.spolecnik.y = s.y; }   // společník stojí vždy na poli hrdiny
    srovnejHromadky(s.hrac.batoh);
    return r;
  }
  const TAHOVE = new Set(['vpred', 'vzad', 'vlevo', 'vpravo', 'utok', 'kouzlo', 'kryt', 'cekej', 'pouzij', 'ohmatat', 'skok', 'varit']);
  function akceBezUklidu(s, typ, arg) {
    if (s.hrac && s.hrac.zkamenen > 0 && TAHOVE.has(typ) && !s.mrtvy) {
      s.hrac.zkamenen = 0;
      const ud = [{ typ: 'zkamenelyTah' }];
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'zkamenen', udalosti: ud };
    }
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
    if (typ === 'odejitVitezne') {                // po porážce Srdce hlubin: výprava končí vítězstvím (zapíše se do síně)
      if (!s.vitezstvi) return { tah: false, udalost: 'nic', udalosti: ud };
      const h = s.hrac;
      zemri(s, 'nic – vrátil se nahoru jako vítěz', 'vitezstvi', ud);
      if (s.mrtvy) { s.mrtvy.pricina = `nic – ${s.rod === 'z' ? 'vrátila' : 'vrátil'} se nahoru ${s.rod === 'z' ? 'jako vítězka' : 'jako vítěz'}`; h.hp = Math.max(1, h.hp); }
      return { tah: false, udalost: 'konec', udalosti: ud };
    }
    if (typ === 'plizit') {
      s.hrac.plizi = !s.hrac.plizi;
      ud.push({ typ: 'plizeni', zapnuto: s.hrac.plizi });
      return { tah: false, udalost: 'plizeni', udalosti: ud };
    }
    if (typ === 'vybavSpolecnika') {              // obojek (amulet) psovi a vlkovi, zbroj žoldákovi a kostlivci
      const c = s.spolecnik, b = s.hrac.batoh, i = b.findIndex(p => p.id === arg);
      if (!c || i < 0) return { tah: false, udalost: 'nic', udalosti: ud };
      const p = b[i], chce = c.druh === 'pes' || c.druh === 'vlk' ? 'amulet' : 'brneni';
      if (p.typ !== chce) { ud.push({ typ: 'spolecnikNechce', druh: c.druh, chce }); return { tah: false, udalost: 'nic', udalosti: ud }; }
      b.splice(i, 1);
      if (c.vybava) b.push(c.vybava);
      c.vybava = p; srovnejSpolecnika(s, true);
      ud.push({ typ: 'spolecnikVybaven', nazev: nazevPredmetu(s, p) });
      return { tah: false, udalost: 'vybavSpolecnika', udalosti: ud };
    }
    if (typ === 'vlozRunu') {                     // {runa: id, predmet: id}
      const b = s.hrac.batoh, ir = b.findIndex(p => p.id === (arg && arg.runa));
      const p = b.find(q => q.id === (arg && arg.predmet)) || SLOTY.map(k => s.hrac.vybava[k]).find(q => q && q.id === (arg && arg.predmet));
      if (ir < 0 || !p) return { tah: false, udalost: 'nic', udalosti: ud };
      if ((p.runy || []).length >= drazky(p)) { ud.push({ typ: 'runaNelze' }); return { tah: false, udalost: 'nic', udalosti: ud }; }
      const ru = ZAKLADY[b[ir].zaklad].runa;
      (p.runy = p.runy || []).push(ru); odeberKus(b, ir); srovnejZdravi(s);
      ud.push({ typ: 'runaVlozena', runa: ru, nazev: nazevPredmetu(s, p) });
      return { tah: false, udalost: 'vlozRunu', udalosti: ud };
    }
    if (typ === 'varit') {                        // alchymie: dvě přísady → lektvar (u kotle, táboráku nebo alchymistického stolu)
      const R = RECEPTY[arg];
      if (!R) return { tah: false, udalost: 'nic', udalosti: ud };
      if (!uVarny(s)) { ud.push({ typ: 'varitNelze', proc: 'varna' }); return { tah: false, udalost: 'nic', udalosti: ud }; }
      if (!maPrisady(s, arg)) { ud.push({ typ: 'varitNelze', proc: 'prisady' }); return { tah: false, udalost: 'nic', udalosti: ud }; }
      const b = s.hrac.batoh;
      for (const z of R.prisady) odeberKus(b, b.findIndex(p => p.zaklad === z));
      const lek = novyPredmet(s, 'lektvar', { lektvar: arg });
      if (!doBatohu(s, lek)) { lek.polozeno = true; polozNaZem(s, s.x, s.y, [lek], 0); ud.push({ typ: 'plnyBatoh' }); }   // plno: lektvar zůstane u nohou
      if (!s.zname.includes(arg)) s.zname.push(arg);
      ud.push({ typ: 'uvaril', lektvar: arg, nazev: LEKTVARY[arg].nazev });
      konecTahu(s, 2, ud);
      return { tah: true, udalost: 'varit', udalosti: ud };
    }
    if (typ === 'bod') {                          // rozdělit bod vlastnosti (nestojí tah)
      const h = s.hrac;
      if (!(h.body > 0) || !BODY_VLASTNOSTI[arg]) return { tah: false, udalost: 'nic', udalosti: ud };
      h.body--;
      h.rozdeleno = h.rozdeleno || {}; h.rozdeleno[arg] = (h.rozdeleno[arg] || 0) + 1;
      if (arg === 'sila') h.sila++;
      else if (arg === 'obratnost') h.obratnost = (h.obratnost || 0) + 1;
      else if (arg === 'magie') { h.magie++; h.mana = (h.mana || 0) + 2; }
      else { h.maxHp += 5; h.hp += 5; }
      ud.push({ typ: 'bod', klic: arg, zbyva: h.body });
      return { tah: false, udalost: 'bod', udalosti: ud };
    }
    if (typ === 'schopnost') {
      const h = s.hrac;
      if (!h.volba || !h.volba.includes(arg)) return { tah: false, udalost: 'nic', udalosti: ud };
      h.schopnosti.push(arg); h.volba = null;
      srovnejZdravi(s);
      if (arg === 'tuhy') h.hp += 15;
      if (arg === 'legenda') h.hp += 20;
      ud.push({ typ: 'schopnost', klic: arg, nazev: SCHOPNOSTI[arg].nazev });
      return { tah: false, udalost: 'schopnost', udalosti: ud };
    }
    if (typ === 'skok') {                         // přeskočit odhalenou nástrahu nebo jámu před sebou (2 tahy)
      const p = s.mapaPatra, ax = s.x + DX[s.smer], ay = s.y + DY[s.smer], bx = ax + DX[s.smer], by = ay + DY[s.smer];
      const past = pastNa(s, ax, ay);
      if (!past || !past.odhalena) { ud.push({ typ: 'skokNelze', proc: 'nic' }); return { tah: false, udalost: 'nic', udalosti: ud }; }
      const tb = dlazdice(s, bx, by), cil = pastNa(s, bx, by);
      if (!pruchozi(tb) || tb === T.DOLU || dvereZavrene(s, bx, by) || potvoraNa(s, bx, by) || potvoraNa(s, ax, ay) || prekazkaNa(s, bx, by)
        || (s.mrize && s.mrize.has(by * p.w + bx)) || (cil && cil.druh === 'jama')) {
        ud.push({ typ: 'skokNelze', proc: 'dopad' }); return { tah: false, udalost: 'nic', udalosti: ud };
      }
      const z = { x: s.x, y: s.y };
      s.x = bx; s.y = by; s.varovani = -1;
      s.hrac.sytost = Math.max(0, s.hrac.sytost - 1);
      ud.push({ typ: 'skok', druh: past.druh });
      seberZeZeme(s, ud);
      if (cil && slapniNaPast(s, cil, ud) === 'pad') return { tah: true, udalost: 'pad', udalosti: ud };
      if (!s.mrtvy) { vstupDoMistnosti(s, ud); rozhlednise(s, ud, false); konecTahu(s, 2, ud); }
      return { tah: true, udalost: 'skok', z, udalosti: ud };
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
        if (!m) {                                    // nikdo v přímce: šíp se navede na potvoru šikmo vpředu (jako kouzla)
          const c = cilKouzla(s, o.zbran.dosah);
          if (c.m && c.navedeno) { m = c.m; d = c.d; }
        }
        const st = s.hrac.batoh.find(p => p.typ === 'sipy');
        const zachovan = ma(s, 'lukostrelec') && Rs(s) < 0.5;
        if (!zachovan && --st.pocet <= 0) s.hrac.batoh.splice(s.hrac.batoh.indexOf(st), 1);
        // vystřelený šíp často zůstane ležet – pod zasaženou potvorou, nebo kde dopadl
        const dopad = m ? [m.x, m.y] : d > 1 ? [s.x + DX[s.smer] * (d - 1), s.y + DY[s.smer] * (d - 1)] : null;
        const lezi = !zachovan && dopad && Rs(s) < NAVRAT_SIPU;
        if (lezi) polozNaZem(s, dopad[0], dopad[1], [novyPredmet(s, 'sipy', { pocet: 1 })], 0);
        ud.push({ typ: 'vystrel', vzdalenost: m ? d : Math.min(d, o.zbran.dosah), ...kamCil(m) });
        if (m) utokHrace(s, m, ud, true); else ud.push({ typ: 'sipMinul', lezi });
      } else {
        m = potvoraNa(s, s.x + DX[s.smer], s.y + DY[s.smer]);
        if (!m && o.zbran.bodne) {                 // kopí dosáhne i o pole dál (je-li mezi tím volno)
          const x1 = s.x + DX[s.smer], y1 = s.y + DY[s.smer];
          if (!blokujePohled(s, x1, y1) && !prekazkaNa(s, x1, y1) && !dvereZavrene(s, x1, y1)) m = potvoraNa(s, x1 + DX[s.smer], y1 + DY[s.smer]);
        }
        const vec = !m && dekoraceNa(s, s.x + DX[s.smer], s.y + DY[s.smer]);
        if (m) utokHrace(s, m, ud);
        else if (vec && ODOLNOST[vec.druh]) uderDoVeci(s, vec, ud);
        else if (vec) ud.push({ typ: 'nerozbitne', druh: vec.druh });
        else ud.push({ typ: 'mach' });
      }
      hluk(s, 5);
      konecTahu(s, o.zbran.rychlost, ud);
      return { tah: true, udalost: m ? 'utok' : 'mach', udalosti: ud };
    }
    if (typ === 'kouzlo') {                       // kouzlo z knihy kouzel – stojí manu a tah
      const k = KOUZLA[arg], h = s.hrac;
      if (!k || !(h.kouzla || []).includes(arg)) return { tah: false, udalost: 'nic', udalosti: ud };
      const cena = cenaKouzla(s, arg);
      if (h.mana < cena) { ud.push({ typ: 'maloMany', klic: arg, chybi: cena - h.mana }); return { tah: false, udalost: 'maloMany', udalosti: ud }; }
      h.mana -= cena;
      seslatKouzlo(s, arg, ud);
      cvic(s, 'kouzleni', ud, 1 + Math.floor(k.mana / 6));
      if (!s.mrtvy) konecTahu(s, 1, ud);
      return { tah: true, udalost: 'kouzlo', udalosti: ud };
    }
    if (typ === 'zahodHorsi') {                   // položit na zem všechnu výbavu z batohu horší než ta na sobě (jeden tah)
      const ids = new Set(horsiVybava(s));
      if (!ids.size) return { tah: false, udalost: 'nic', udalosti: ud };
      const pryc = s.hrac.batoh.filter(p => ids.has(p.id));
      for (const p of pryc) p.polozeno = true;
      s.hrac.batoh = s.hrac.batoh.filter(p => !ids.has(p.id));
      polozNaZem(s, s.x, s.y, pryc, 0);
      ud.push({ typ: 'zahodilHorsi', pocet: pryc.length, nazvy: pryc.map(p => nazevPredmetu(s, p)) });
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'zahodHorsi', udalosti: ud };
    }
    if (typ === 'seradit') {                      // seřadit batoh podle druhu (čas nestojí)
      const PORADI = ['zbran', 'luk', 'stit', 'helma', 'brneni', 'boty', 'amulet', 'prsten', 'lektvar', 'svitek', 'hulka', 'jidlo', 'pochoden', 'sipy', 'nastroj', 'surovina', 'kniha', 'klic', 'ukol'];
      const misto = p => { const i = PORADI.indexOf(p.typ); return i < 0 ? 99 : i; };
      const podleDruhu = (a, b) => misto(a) - misto(b) || skorePredmetu(b) - skorePredmetu(a) || a.zaklad.localeCompare(b.zaklad);
      const RAZENI = {
        druh: podleDruhu,
        cena: (a, b) => cenaPredmetu(b, s) * kusu(b) - cenaPredmetu(a, s) * kusu(a) || podleDruhu(a, b),
        vzacnost: (a, b) => (b.vzacnost || 0) - (a.vzacnost || 0) || skorePredmetu(b) - skorePredmetu(a) || podleDruhu(a, b),
        nazev: (a, b) => nazevPredmetu(s, a).localeCompare(nazevPredmetu(s, b), 'cs'),
      };
      s.hrac.batoh.sort(RAZENI[arg] || podleDruhu);
      return { tah: false, udalost: 'presun', udalosti: ud };
    }
    if (typ === 'presun') {                       // přeskládání batohu (čas nestojí)
      const b = s.hrac.batoh, z = arg && arg.z, na = arg && arg.na;
      if (!(z >= 0 && z < b.length && na >= 0 && na < kapacita(s)) || z === na) return { tah: false, udalost: 'nic', udalosti: ud };
      const [q] = b.splice(z, 1);
      b.splice(Math.min(na, b.length), 0, q);
      return { tah: false, udalost: 'presun', udalosti: ud };
    }
    if (typ === 'poi') {                          // volba u zajímavého místa stojí tah
      if (!poiAkce(s, arg, ud)) return { tah: false, udalost: 'nic', udalosti: ud };
      if (!s.mrtvy) konecTahu(s, 1, ud);
      return { tah: true, udalost: 'poiAkce', udalosti: ud };
    }
    if (typ === 'kovat') {
      const ok = kovat(s, arg, ud);
      return { tah: false, udalost: ok ? 'kovat' : 'nic', udalosti: ud };   // kování čas nestojí
    }
    if (typ === 'prodejHorsi') {                  // u obchodníka prodat všechnu horší výbavu z batohu (čas nestojí)
      let n = 0;
      for (const id of horsiVybava(s)) if (obchodAkce(s, 'prodej', id, ud)) n++;
      return { tah: false, udalost: n ? 'prodej' : 'nic', udalosti: ud };
    }
    if (typ === 'kup' || typ === 'prodej' || typ === 'odklet' || typ === 'hadanka' || typ === 'batoh' || typ === 'zapomenout' || typ === 'najmout') {
      const ok = obchodAkce(s, typ, arg, ud);
      return { tah: false, udalost: ok ? typ : 'nic', udalosti: ud };   // obchodování čas nestojí
    }
    if (typ === 'ohmatat') {
      const x = s.x + DX[s.smer], y = s.y + DY[s.smer], t = dlazdice(s, x, y), stena = (s.smer + 2) % 4;
      const mim = potvoraNa(s, x, y);
      if (mim && mim.druh === 'mimik' && mim.stav === 'spi') { prozradMimika(s, mim, ud); konecTahu(s, 1, ud); return { tah: true, udalost: 'mimik', udalosti: ud }; }
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
      else if (dekoraceNa(s, x, y) && ['balvan', 'paka3'].includes(dekoraceNa(s, x, y).druh)) {
        const d = dekoraceNa(s, x, y);
        if (d.druh === 'balvan' && !tlacBalvan(s, d, ud)) return { tah: false, udalost: 'nic', udalosti: ud };
        if (d.druh === 'paka3') zatahniPaku3(s, d, ud);
      }
      else if (dvereZavrene(s, x, y) || truhlaNa(s, x, y) || dekoraceNa(s, x, y)) {
        // dveře, truhla, obchodník, zajímavé místo, oltář…: stejně jako když do nich vejdeš
        const r = akceVnitrni(s, 'vpred');
        if (r.udalost === 'prekazka') ud.push({ typ: 'prohlidl', druh: r.druh, vydrz: ODOLNOST[r.druh] ? ODOLNOST[r.druh][0] - (dekoraceNa(s, x, y).zasahy || 0) : 0, material: ODOLNOST[r.druh] ? ODOLNOST[r.druh][1] : '' });
        return r;
      } else if (s.zeme.some(z => z.x === x && z.y === y) && !potvoraNa(s, x, y)) {
        if (!seberZeZeme(s, ud, x, y, true)) return { tah: false, udalost: 'nic', udalosti: ud };
      } else if (s.zeme.some(z => z.x === s.x && z.y === s.y)) {
        if (!seberZeZeme(s, ud, s.x, s.y, true)) return { tah: false, udalost: 'nic', udalosti: ud };
      } else return { tah: false, udalost: 'nic', udalosti: ud };
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'ohmatat', udalosti: ud };
    }
    if (typ === 'nasadLepsi') {                   // nasadit z batohu všechno lepší než nasazené (jeden tah)
      const n = nasadLepsi(s, ud);
      if (!n) return { tah: false, udalost: 'nic', udalosti: ud };
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'nasadLepsi', udalosti: ud };
    }
    if (typ === 'nasad' && arg && typeof arg === 'object') {     // přetažení na konkrétní slot
      if (!nasad(s, arg.id, ud, arg.slot)) return { tah: false, udalost: 'nic', udalosti: ud };
      konecTahu(s, 1, ud);
      return { tah: true, udalost: 'nasad', udalosti: ud };
    }
    if (typ === 'nasad' || typ === 'sundej' || typ === 'pouzij' || typ === 'zahod') {
      const ok = typ === 'nasad' ? nasad(s, arg, ud) : typ === 'sundej' ? sundej(s, arg, ud)
        : typ === 'pouzij' ? pouzij(s, arg, ud) : zahod(s, arg, ud);
      if (!ok) return { tah: false, udalost: 'nic', udalosti: ud };
      if (ud.some(u => u.typ === 'slanil')) return { tah: true, udalost: 'sestup', udalosti: ud };   // lano: nové patro
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
    if (m && m.druh === 'mimik' && m.stav === 'spi') { prozradMimika(s, m, ud); konecTahu(s, 1, ud); return { tah: true, udalost: 'mimik', udalosti: ud }; }
    if (m) return { tah: false, udalost: 'blok', potvora: m, udalosti: ud };
    const dek = dekoraceNa(s, nx, ny);
    if (dek && dek.druh === 'obchodnik') return { tah: false, udalost: 'obchod', udalosti: ud };
    if (dek && dek.druh === 'mistrKovar') return { tah: false, udalost: 'kovar', udalosti: ud };
    if (dek) {
      if (jePoi(dek) && !dek.pouzito) return { tah: false, udalost: 'poi', druh: dek.druh, i: s.dekorace.indexOf(dek), udalosti: ud };
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
    slapniNaDesku(s, ud);
    konecTahu(s, s.hrac.plizi && s.trida !== 'zlodej' && s.trida !== 'hranicar' ? 2 : 1, ud);   // plížení je pomalé
    return { tah: true, udalost: t === T.NAHORU ? 'nahoru' : 'krok', z, udalosti: ud };
  }

  // Po akci hráče: plyne čas, hráč se pomalu hojí, potvory jednají.
  // potulné potvory: patro se po vyčištění nestane bezpečným místem k nekonečnému odpočinku
  const SANCE_POTULNE = 1 / 110;
  function potulnaPotvora(s, ud) {
    const p = s.mapaPatra;
    if (s.potvory.filter(m => !BESTIAR[m.druh].boss).length >= Math.min(14, 3 + Math.floor(p.patro * 0.7))) return;
    let druhy = Object.keys(BESTIAR).filter(k => !BESTIAR[k].boss && BESTIAR[k].od <= p.patro && p.patro <= BESTIAR[k].do && (!BESTIAR[k].biom || BESTIAR[k].biom === p.biom));
    if (!druhy.length) druhy = Object.keys(BESTIAR).filter(k => !BESTIAR[k].boss && BESTIAR[k].od <= p.patro && !BESTIAR[k].biom);
    for (let k = 0; k < 30; k++) {
      const x = Ri(s, 1, p.w - 2), y = Ri(s, 1, p.h - 2), i = y * p.w + x, t = p.mapa[i];
      if (t !== T.PODLAHA && t !== T.CHODBA) continue;
      if (Math.abs(x - s.x) + Math.abs(y - s.y) < 8 || vidi(s, s.x, s.y, x, y)) continue;
      const mid = p.mistnostId[i];
      if (mid >= 0 && (p.mistnosti[mid].tajna || p.mistnosti[mid].boss || ['pokladnice', 'obchod', 'mriz', 'kovarna'].includes(p.mistnosti[mid].ucel))) continue;
      if (!volneProPotvoru(s, x, y, null, { dvere: false }) || dvereZavrene(s, x, y) || (s.mrize && s.mrize.has(i))) continue;
      const m = novaPotvora(s, druhy[Ri(s, 0, druhy.length - 1)], x, y, false);
      s.potvory.push(m);
      ud.push({ typ: 'potulna', id: m.id, druh: m.druh, x, y });
      return;
    }
  }
  function konecTahu(s, kol, ud) {
    for (let i = 0; i < kol && !s.mrtvy; i++) {
      s.tah++;
      if (Rs(s) < SANCE_POTULNE) potulnaPotvora(s, ud);
      if (Rs(s) < SANCE_ZLATEHO) zlatyGoblin(s, ud);
      const h = s.hrac, pred = h.sytost;
      const mm = maxMany(s);
      const kl = kletbaPatra(s);
      if (kl !== 'bezmagie') h.manaReg = (h.manaReg || 0) + 0.025 + 0.008 * h.magie;
      if (h.manaReg >= 1) { h.manaReg -= 1; if (h.mana < mm) h.mana++; }
      if (h.mana > mm) h.mana = mm;
      if (h.kuze > 0 && --h.kuze === 0) ud.push({ typ: 'kuzeKonec' });
      if (h.lumen > 0 && --h.lumen === 0) ud.push({ typ: 'lumenKonec' });
      if (h.miza > 0) { h.hp = Math.min(odvozene(s).maxHp, h.hp + 1 + Math.floor(Math.max(0, h.magie) / 3)); if (--h.miza === 0) ud.push({ typ: 'kouzloKonec', kouzlo: 'miza' }); }
      if (h.odraz > 0 && --h.odraz === 0) ud.push({ typ: 'kouzloKonec', kouzlo: 'odraz' });
      if (h.stavy) {
        if (h.stavy.otrava > 0) { if (s.tah % 2 === 0) h.hp -= 1 + Math.floor(s.patro / 15); if (--h.stavy.otrava === 0) ud.push({ typ: 'stavKonec', stav: 'otrava' }); }
        if (h.stavy.krvaceni > 0) { h.hp -= 1; if (--h.stavy.krvaceni === 0) ud.push({ typ: 'stavKonec', stav: 'krvaceni' }); }
        if (h.stavy.omrzlina > 0) {
          if (s.dekorace.some(d => d.druh === 'taborak' && Math.abs(d.x - s.x) + Math.abs(d.y - s.y) <= 2)) h.stavy.omrzlina = 1;   // u ohně rozmrzne
          if (--h.stavy.omrzlina === 0) ud.push({ typ: 'stavKonec', stav: 'omrzlina' });
        }
        if (h.hp <= 0) { zemri(s, h.stavy.otrava > 0 ? 'jed, který prošel žilami až k srdci' : 'krev, která už nechtěla zůstat uvnitř', h.stavy.otrava > 0 ? 'jed' : 'krvaceni', ud); break; }
      }
      h.sytost = Math.max(0, Math.round((h.sytost - 0.1 * odvozene(s).hladovost * (kl === 'hlad' ? 2 : 1)) * 10) / 10);
      if (pred > 30 && h.sytost <= 30) ud.push({ typ: 'hlad', stupen: 1 });
      if (pred > 10 && h.sytost <= 10) ud.push({ typ: 'hlad', stupen: 2 });
      if (h.sytost <= 0) {
        if (s.tah % 5 === 0) {
          h.hp--;
          ud.push({ typ: 'hlad', stupen: 3 });
          if (h.hp <= 0) { zemri(s, PRICINY_HLADU[Ri(s, 0, 1)], 'hlad', ud); break; }
        }
      } else if (s.tah % (ma(s, 'houzevnaty') ? 4 : 7) === 0 && h.hp < odvozene(s).maxHp) h.hp++;
      if (h.pochoden > 0 && !(maLucernu(s) && s.tah % 3)) {   // s lucernou dohořívá třikrát pomaleji
        h.pochoden--;
        if (kl === 'tma' && h.pochoden > 0) h.pochoden--;
        if (h.pochoden === 100) ud.push({ typ: 'pochoden', stav: 'dohořívá' });
        if (h.pochoden === 0) ud.push({ typ: 'pochoden', stav: 'zhasla' });
      }
      tahSpolecnika(s, ud);
      ud.push({ typ: 'tahPotvor' });              // značka pro rozhraní: odsud jedná podzemí (útoky potvor se ukážou se zpožděním)
      tahPotvor(s, ud);
      h.kryti = false;                            // krytí štítem platí jen na jedno kolo potvor
      if (s.tah % 25 === 0) { s.prubeh = s.prubeh || []; s.prubeh.push([s.tah, s.patro, Math.max(0, h.hp), odvozene(s).maxHp]); if (s.prubeh.length > 240) s.prubeh = s.prubeh.filter((_, i) => i % 2 === 0); }
    }
    aktualizujViditelnost(s);
  }

  function utokHrace(s, m, ud, strela) {
    const h = s.hrac, o = odvozene(s), z = o.zbran, d = BESTIAR[m.druh];
    const sance = omez(0.82 + 0.02 * (h.uroven - 1) + o.presnost / 100 - 0.04 * d.obrana - (h.pochoden > 0 ? 0 : 0.15) - (h.stavy && h.stavy.omrzlina > 0 ? 0.15 : 0), 0.4, 0.97);
    const protiutok = !!h.protiutok; h.protiutok = false;
    if (!protiutok && Rs(s) >= sance) { ud.push({ typ: 'minul', id: m.id, druh: m.druh, x: m.x, y: m.y }); return; }
    const silou = strela ? Math.floor((o.sila - 3) / 4) + Math.floor((o.obratnost || 0) / 2) : Math.floor((o.sila - 3) / 2);
    let dmg = Math.max(1, Ri(s, z.min, z.max) + silou + o.ohen - Math.floor(d.obrana / 2));
    if (!strela && ma(s, 'bojovnik')) dmg = Math.round(dmg * 1.25);
    if (strela && ma(s, 'odstrelovac')) dmg = Math.round(dmg * 1.3);
    if (protiutok) { dmg = Math.round(dmg * 1.5); ud.push({ typ: 'protiutok' }); }
    if ((strela ? ma(s, 'odstrelovac') : ma(s, 'mistrZbrani')) && Rs(s) < 0.15) { dmg *= 2; ud.push({ typ: 'kriticky', id: m.id, x: m.x, y: m.y }); }
    dmg = Math.round(dmg * (1 + (strela ? 0.04 * navic(s, 'strelba') : 0.03 * navic(s, 'boj'))));
    cvic(s, strela ? 'strelba' : 'boj', ud);
    // ze zálohy: potvora spí, nic netuší, nebo je k tobě zády (ne boss)
    const zezadu = m.smer !== undefined && s.x === m.x - DX[m.smer] && s.y === m.y - DY[m.smer];
    let zaloha = false;
    if (!d.boss && (m.stav === 'spi' || m.stav === 'bloudi' || zezadu)) {
      dmg *= ma(s, 'zlodej') ? 3 : 2;
      s.stat.zaloha++; zaloha = true;
      ud.push({ typ: 'zaskoceni', id: m.id, druh: m.druh, x: m.x, y: m.y, zezadu: zezadu && m.stav === 'honi' });
    }
    if (o.runy.svetlo && NEMRTVI.has(m.druh)) dmg = Math.round(dmg * 1.5);
    zranPotvoru(s, m, dmg, ud, false, typZbrane(strela ? h.vybava.luk : vRuce(s), strela));
    if (m.hp > 0 && o.runy.mraz && Rs(s) < 0.2) m.energie = Math.min(m.energie, -1);
    if (o.runy.vysavani && dmg > 0) h.hp = Math.min(o.maxHp, h.hp + Math.max(1, Math.round(dmg * 0.12)));
    if (!strela && d.trny && dmg > 0 && !s.mrtvy) {       // ostnatec: bodliny vrátí část rány
      const t2 = Math.max(1, Math.round(dmg * d.trny)); h.hp -= t2;
      ud.push({ typ: 'trny', druh: m.druh, dmg: t2 });
      if (h.hp <= 0) zemri(s, d.pricina[0], m.druh, ud);
    }
    if (!strela && z.omraci && m.hp > 0 && !d.boss && Rs(s) < z.omraci) {   // palcát: omráčená potvora vynechá tah
      m.energie = Math.min(m.energie, -1.2);
      ud.push({ typ: 'omracen', id: m.id, druh: m.druh, x: m.x, y: m.y });
    }
    if (zaloha && m.hp <= 0 && ma(s, 'vrah')) {             // vrah ze stínů: dvojnásobek zkušeností a trocha zdraví
      const zk = Math.round(d.zk * (1 + 0.1 * (s.patro - 1)));
      h.zk += zk; h.hp = Math.min(odvozene(s).maxHp, h.hp + 5);
      ud.push({ typ: 'vrah', zk });
      povysuj(s, ud);
    }
  }

  function zranPotvoru(s, m, dmg, ud, kouzlem, typ) {
    const h = s.hrac, d = BESTIAR[m.druh];
    const nas = nasobekZraneni(m.druh, typ);
    if (d.regenerace && (typ === 'ohen' || typ === 'svetlo')) m.bezRegen = s.tah + 3;
    if (m.druh === 'mimik' && m.stav === 'spi') ud.push({ typ: 'mimik', id: m.id, x: m.x, y: m.y });
    if (nas !== 1) { dmg = Math.max(0, Math.round(dmg * nas)); ud.push({ typ: 'slabina', druh: m.druh, druhZraneni: typ, nasobek: nas, x: m.x, y: m.y }); }
    m.hp -= dmg;
    if (m.druh === 'sliz' && typ === 'sek' && m.hp > 6) {    // sek rozpůlí velký sliz – vedle se objeví malý
      for (let k = 0; k < 4; k++) {
        const nx = m.x + DX[k], ny = m.y + DY[k];
        if (!volneProPotvoru(s, nx, ny, null, { dvere: false }) || dvereZavrene(s, nx, ny)) continue;
        const q = novaPotvora(s, 'malySliz', nx, ny, false); q.hp = q.maxHp = Math.ceil(m.hp / 2); q.stav = 'honi'; q.stopa = 8;
        m.hp = Math.ceil(m.hp / 2); s.potvory.push(q);
        ud.push({ typ: 'rozdelil', id: m.id, druh: m.druh, x: nx, y: ny });
        break;
      }
    }
    if (m.stav !== 'utika') m.stav = 'honi';
    m.stopa = 8;
    ud.push({ typ: 'zasah', id: m.id, druh: m.druh, dmg, x: m.x, y: m.y, kouzlem: !!kouzlem, nasobek: nas });   // nasobek = účinnost proti odolnostem
    if (d.boss && m.hp > 0 && !m.faze && m.hp <= m.maxHp / 2) {   // boss v polovině zdraví zuří a volá posily
      m.faze = 2; m.bonus += 2 + 2 * Math.floor(s.patro / 10);
      const druhy = Object.keys(BESTIAR).filter(k => !BESTIAR[k].boss && BESTIAR[k].od <= s.patro && s.patro <= BESTIAR[k].do);
      let n = 0;
      for (let k = 0; k < 4 && n < 2 && druhy.length; k++) {
        const nx = m.x + DX[k], ny = m.y + DY[k];
        if (!volneProPotvoru(s, nx, ny, null, { dvere: false }) || dvereZavrene(s, nx, ny)) continue;
        const q = novaPotvora(s, druhy[Ri(s, 0, druhy.length - 1)], nx, ny, false);
        q.stav = 'honi'; q.stopa = 15; q.pan = m.id; s.potvory.push(q); n++;
      }
      ud.push({ typ: 'bossFaze', id: m.id, druh: m.druh, posily: n, x: m.x, y: m.y });
    }
    if (kouzlem && m.hp > 0 && !m.jed && ma(s, 'pyromant')) { m.jed = { dmg: Math.max(1, Math.ceil(dmg / 4)), zbyva: 3, typ: 'ohen' }; ud.push({ typ: 'hori', id: m.id, druh: m.druh }); }
    if (m.hp <= 0) {
      s.potvory = s.potvory.filter(p => p !== m);
      s.zabito++;
      postupUkolu(s, 'lov', ud);
      if (m.nacelnik) postupUkolu(s, 'nacelnik', ud, m);
      const zk = Math.round(d.zk * (1 + 0.1 * (s.patro - 1)) * (m.nacelnik ? 2 : 1) * (s.obtiznost === 'tezka' ? 1.25 : 1) * (kletbaPatra(s) ? 1.5 : 1));
      h.zk += zk;
      ud.push({ typ: 'zabita', id: m.id, druh: m.druh, x: m.x, y: m.y, zk });
      if (m.lup) { polozNaZem(s, m.x, m.y, [], m.lup); ud.push({ typ: 'lupZpet', zlato: m.lup, x: m.x, y: m.y }); }
      if (d.vybuchPriSmrti) {                                // nadýmka praskne: jedovaté spóry na sousedy i hrdinu
        const dmg2 = 6 + s.patro;
        ud.push({ typ: 'nadymka', x: m.x, y: m.y });
        for (const q of s.potvory.slice()) if (q.hp > 0 && Math.max(Math.abs(q.x - m.x), Math.abs(q.y - m.y)) <= 1) zranPotvoru(s, q, dmg2, ud, true, 'jed');
        if (Math.max(Math.abs(s.x - m.x), Math.abs(s.y - m.y)) <= 1 && !s.mrtvy) {
          h.hp -= Math.ceil(dmg2 / 2); h.stavy = h.stavy || {}; h.stavy.otrava = Math.max(h.stavy.otrava || 0, 5);
          ud.push({ typ: 'stav', stav: 'otrava', druh: m.druh });
          if (h.hp <= 0) zemri(s, d.pricina[1], m.druh, ud);
        }
      }
      s.stopy = s.stopy || [];
      s.stopy.push([m.x, m.y, STOPA_POTVORY[m.druh] || 'krev', (m.id * 7 + m.x) & 3]);
      if (s.stopy.length > 50) s.stopy.shift();
      const leci = (ma(s, 'krvezizen') ? 3 : 0) + (ma(s, 'neuprosny') ? 2 : 0);
      if (leci && h.hp > 0) h.hp = Math.min(odvozene(s).maxHp, h.hp + leci);
      if (ma(s, 'neuprosny')) h.mana = Math.min(maxMany(s), (h.mana || 0) + 3);
      if (m.druh === 'srdce' && !s.vitezstvi) {            // cíl výpravy splněn
        s.vitezstvi = true;
        polozNaZem(s, m.x, m.y, [novyPredmet(s, 'srdceHlubin')], 0);
        ud.push({ typ: 'vitezstvi', patro: s.patro });
      }
      if (d.boss) {
        // pomocníci bosse se rozprchnou do tmy
        s.potvory = s.potvory.filter(p => p.pan !== m.id);
        s.bossu = (s.bossu || 0) + 1;
        ud.push({ typ: 'bossPadl', druh: m.druh, x: m.x, y: m.y });
        const kor = [nahodnyPredmet(s, s.patro + 4), nahodnyPredmet(s, s.patro + 4), nahodnyPredmet(s, s.patro + 2, 'magie')];
        if (s.patro >= 20) { const u = UNIKATY(); kor.push(novyUnikat(s, u[Ri(s, 0, u.length - 1)])); }   // hlubší bossové nesou legendu
        for (const p of kor) { delete p.prokleti; delete p.odhaleno; }
        for (const p of kor) if (p.vzacnost !== undefined && L_SLOTOVY(p)) p.vzacnost = Math.max(3, p.vzacnost);
        polozNaZem(s, m.x, m.y, kor, s.patro * Ri(s, 25, 40));
      } else korist(s, m, ud);
      if (m.elita || m.druh === 'zlatyGoblin') {             // elita a zlatý goblin nesou víc
        const q = nahodnyPredmet(s, s.patro + 2);
        if (slotPro(q)) q.vzacnost = Math.max(2, q.vzacnost || 0);
        polozNaZem(s, m.x, m.y, [q], s.patro * (m.druh === 'zlatyGoblin' ? Ri(s, 25, 45) : Ri(s, 4, 9)));
        h.zk += zk;                                           // dvojnásobek zkušeností
      }
      povysuj(s, ud);
    }
  }
  const L_SLOTOVY = p => !!slotPro(p);

  // hluk souboje budí spící potvory v okolí (mimik ne – ten čeká v truhle, až na něj sáhneš)
  function hluk(s, dosah) {
    for (const m of s.potvory) {
      if (m.stav === 'spi' && m.druh !== 'mimik' && Math.abs(m.x - s.x) + Math.abs(m.y - s.y) <= dosah && Rs(s) < (s.trida === 'zlodej' ? 0.2 : 0.5)) {   // zloděj se plíží
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
      if (d.regenerace && m.hp < m.maxHp && !(m.bezRegen > s.tah)) m.hp = Math.min(m.maxHp, m.hp + d.regenerace + Math.floor(s.patro / 10));   // upíří pán se hojí, dokud ho nepálí oheň/světlo
      if (m.jed) {                                     // jed z kouzla spaluje potvoru
        zranPotvoru(s, m, m.jed.dmg, ud, true, m.jed.typ || 'jed');
        if (m.jed && --m.jed.zbyva <= 0) delete m.jed;
        if (m.hp <= 0) continue;
      }
      if (m.stav === 'spi') { jednej(s, m, d, pole, ud); continue; }
      const c = s.spolecnik;
      // potvora u hrdiny občas udeří společníka, který stojí s ním na poli
      if (c && m.stav === 'honi' && Math.abs(m.x - s.x) + Math.abs(m.y - s.y) === 1 && !BESTIAR[m.druh].boss && Rs(s) < 0.3) {
        m.energie = (m.energie || 0) - 1; zranSpolecnika(s, m, ud); continue;
      }
      if (m.zmizi && s.tah >= m.zmizi) {
        s.potvory = s.potvory.filter(q => q !== m);
        ud.push({ typ: 'zmizel', id: m.id, druh: m.druh, x: m.x, y: m.y });
        continue;
      }
      m.energie += d.rychlost * (m.elita === 'rychly' ? 1.5 : 1);
      while (m.energie >= 1 && !s.mrtvy) { m.energie -= 1; jednej(s, m, d, pole, ud); }
    }
  }

  function volneProPotvoru(s, x, y, m, d) {
    const t = dlazdice(s, x, y);
    if (t === T.SKALA || t === T.TAJNE || t === T.DOLU || t === T.NAHORU) return false;
    if (x === s.x && y === s.y) return false;
    if (s.spolecnik && s.spolecnik.x === x && s.spolecnik.y === y) return false;
    if (prekazkaNa(s, x, y)) return false;       // pasti potvory znají – chodí po nich bez spuštění
    if (!(m && LETAJICI.has(m.druh))) { const pa = pastNa(s, x, y); if (pa && pa.druh === 'jama') return false; }   // jámou by propadly
    if (dvereZavrene(s, x, y) && (s.zamcene.has(y * s.mapaPatra.w + x) || s.mrize.has(y * s.mapaPatra.w + x))) return false;
    if (dvereZavrene(s, x, y) && !d.dvere) return false;
    const jina = potvoraNa(s, x, y);
    return !jina || jina === m;
  }

  const LETAJICI = new Set(['prizrak', 'ohnivak', 'bezejmenny', 'srdce', 'lich']);
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

  // smečka: kdo tě zahlédne, vzbudí a svolá své druhy v okolí (do 5 polí)
  function burcuj(s, m, d, ud) {
    if (!d.smecka) return;
    let n = 0;
    for (const q of s.potvory) {
      if (q === m || (q.stav !== 'spi' && q.stav !== 'bloudi') || !BESTIAR[q.druh].smecka) continue;
      if (Math.abs(q.x - m.x) + Math.abs(q.y - m.y) > 5) continue;
      q.stav = 'honi'; q.stopa = 8; n++;
    }
    if (n) ud.push({ typ: 'burcuje', id: m.id, druh: m.druh, x: m.x, y: m.y, pocet: n });
  }
  // šaman: vyléčí nejzraněnějšího spojence na dohled
  function lecitel(s, m, d, ud) {
    if (!d.leci || s.tah - (m.lecil || -99) < d.leci.kazdych) return false;
    if (m.mana === undefined || m.mana === null) m.mana = d.leci.mana;
    // mana šamana: pár léčení, pak se doplňuje jen pomalu (1 za 15 tahů od posledního léčení)
    if (m.mana < d.leci.mana && m.lecil != null && s.tah - m.lecil >= 15) {
      const obnova = Math.floor((s.tah - m.lecil) / 15);
      m.mana = Math.min(d.leci.mana, m.mana + obnova); m.lecil += obnova * 15;
    }
    if (m.mana <= 0) return false;                    // došla mana – jen čeká, než se mu trochu vrátí
    let cil = null;
    for (const q of s.potvory) {
      if (q === m || q.hp >= q.maxHp * 0.7 || Math.abs(q.x - m.x) + Math.abs(q.y - m.y) > d.leci.dosah) continue;
      if (!vidi(s, m.x, m.y, q.x, q.y)) continue;
      if (!cil || q.hp / q.maxHp < cil.hp / cil.maxHp) cil = q;
    }
    if (!cil) return false;
    const kolik = Math.min(cil.maxHp - cil.hp, Math.round(cil.maxHp * d.leci.podil));
    cil.hp += kolik; m.lecil = s.tah; m.mana--;
    ud.push({ typ: 'vylecil', id: m.id, druh: m.druh, x: m.x, y: m.y, cil: cil.druh, cilId: cil.id, cx: cil.x, cy: cil.y, kolik });
    return true;
  }
  // jak daleko potvory hrdinu vidí: plížením a bez světla méně (zloděj a hraničář se plíží bez zpomalení)
  function dohledPotvor(s) {
    const h = s.hrac, tma = h.pochoden <= 0 && !(h.lumen > 0);
    return h.plizi ? (tma ? 2 : 3) : (tma ? 4 : 7);
  }
  function jednej(s, m, d, pole, ud) {
    const dx = s.x - m.x, dy = s.y - m.y, blizko = Math.abs(dx) + Math.abs(dy);
    const vidiHrace = Math.max(Math.abs(dx), Math.abs(dy)) <= dohledPotvor(s) && vidi(s, m.x, m.y, s.x, s.y)
      && !(s.hrac.skryt > s.tah && Math.abs(dx) + Math.abs(dy) > 1);   // Závoj tmy: hrdinu vidí jen ten, kdo stojí hned vedle
    if (m.stav === 'spi' && m.spankem && s.tah < m.spankem) return;      // uspaná kouzlem nevnímá
    if (m.druh === 'mimik' && m.stav === 'spi') return;                 // mimik čeká, až na něj sáhneš
    if (m.stav === 'spi') {
      if (vidiHrace && blizko <= (d.boss ? 6 : s.hrac.plizi ? 1 : 2)) { m.stav = 'honi'; m.stopa = 8; ud.push({ typ: 'probudila', id: m.id, druh: m.druh, x: m.x, y: m.y, boss: !!d.boss }); burcuj(s, m, d, ud); }
      return;
    }
    if (d.boss) m.stopa = 30;                        // boss svou arénu neopouští z nepozornosti
    if (vidiHrace) {
      if (m.stav === 'bloudi') { m.stav = 'honi'; ud.push({ typ: 'spatrila', id: m.id, druh: m.druh, x: m.x, y: m.y }); burcuj(s, m, d, ud); }
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
    if (m.stav === 'honi' && d.zkamenuje && vidiHrace && blizko <= 4 && s.tah - (m.zkamenil || -99) >= 7 && Rs(s) < 0.35) {
      m.zkamenil = s.tah; s.hrac.zkamenen = 1;                         // pohled baziliška: příští tah hrdina nehne ani prstem
      ud.push({ typ: 'zkamenen', id: m.id, druh: m.druh, x: m.x, y: m.y });
      return;
    }
    if (m.stav === 'honi' && d.oziveni && s.tah - (m.volal || 0) >= 6 && s.stopy && s.stopy.length) {
      const i = s.stopy.findIndex(([x, y, dr]) => (dr === 'kosti' || dr === 'krev') && Math.abs(x - m.x) + Math.abs(y - m.y) <= 5 && volneProPotvoru(s, x, y, null, { dvere: false }));
      if (i >= 0) {
        const [x, y] = s.stopy[i]; s.stopy.splice(i, 1);
        const q = novaPotvora(s, 'kostlivec', x, y, false); q.stav = 'honi'; q.stopa = 12; q.pan = m.id; s.potvory.push(q);
        m.volal = s.tah;
        ud.push({ typ: 'oziveni', id: m.id, druh: m.druh, x, y });
        return;
      }
    }
    if (m.stav === 'honi' && lecitel(s, m, d, ud)) return;
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
      // utíká ke svým: nejbližší spojenec, který neutíká; u něj strach rychle přejde
      let kamos = null, kd = 13;
      for (const q of s.potvory) {
        if (q === m || q.stav === 'utika' || BESTIAR[q.druh].boss) continue;
        const dd = Math.abs(q.x - m.x) + Math.abs(q.y - m.y);
        if (dd < kd) { kd = dd; kamos = q; }
      }
      if (kamos && kd <= 1) m.strachDo = Math.min(m.strachDo, s.tah + 1);
      if (kamos && kd > 1) {
        let nej = null, nejK = kd;
        for (let k = 0; k < 4; k++) {
          const nx = m.x + DX[k], ny = m.y + DY[k], v = pv[ny * w + nx];
          const kk = Math.abs(kamos.x - nx) + Math.abs(kamos.y - ny);
          // blíž ke kamarádovi, ale ne blíž k hráči
          if (kk < nejK && (v >= tady || v < 0) && volneProPotvoru(s, nx, ny, m, d) && !dvereZavrene(s, nx, ny)) { nej = [nx, ny]; nejK = kk; }
        }
        if (nej) { krokPotvory(s, m, d, nej[0], nej[1], ud); return; }
      }
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

  function prozradMimika(s, m, ud) {
    m.stav = 'honi'; m.stopa = 10;
    ud.push({ typ: 'mimik', id: m.id, x: m.x, y: m.y });
    utokPotvory(s, m, BESTIAR.mimik, ud, true);     // kousne hned a jistě, jak sáhneš na víko
  }
  function nakaz(s, druh, ud) {
    const n = NAKAZY[druh], h = s.hrac;
    if (!n || h.hp <= 0 || Rs(s) >= n[1]) return;
    h.stavy = h.stavy || {};
    const novy = !(h.stavy[n[0]] > 0);
    h.stavy[n[0]] = Math.max(h.stavy[n[0]] || 0, n[2] + Math.floor(s.patro / 10));
    if (novy) ud.push({ typ: 'stav', stav: n[0], druh });
  }
  function vylec(s, stav, ud) {               // stav = 'vse' nebo klíč stavu; vrací, jestli něco vyléčil
    const h = s.hrac; if (!h.stavy) return false;
    let n = 0;
    for (const k of Object.keys(h.stavy)) if ((stav === 'vse' || stav === k) && h.stavy[k] > 0) { h.stavy[k] = 0; n++; ud.push({ typ: 'stavKonec', stav: k, vylecen: true }); }
    return n > 0;
  }
  function utokPotvory(s, m, d, ud, jisty) {
    const h = s.hrac, obrana = odvozene(s).obrana;
    m.smer = [0, 1, 2, 3].find(k => m.x + DX[k] === s.x && m.y + DY[k] === s.y);
    const sance = omez(d.presnost + OBTIZNOST.presnostRust * Math.max(0, s.patro - d.od) - 0.02 * obrana - (m.oslepen > s.tah ? 0.35 : 0), 0.15, 0.95);
    if (!jisty && (Rs(s) >= sance || uhne(s))) {
      if (ma(s, 'tanecnik')) h.protiutok = true;
      ud.push({ typ: 'uhnul', id: m.id, druh: m.druh, x: m.x, y: m.y }); return;
    }
    if (d.kradez && s.zlato > 0 && !m.lup && Rs(s) < 0.5) {   // kapsář: ukradne zlato a uteče
      const kolik = Math.min(s.zlato, 15 + 6 * s.patro);
      s.zlato -= kolik; m.lup = kolik; m.stav = 'utika'; m.strachDo = s.tah + 25;
      ud.push({ typ: 'kradez', id: m.id, druh: m.druh, zlato: kolik, x: m.x, y: m.y });
      return;
    }
    let dmg = Math.max(1, Ri(s, d.utok[0], d.utok[1]) + m.bonus - Math.floor(obrana / 2));
    if (h.stitMag > 0) {                            // magický štít pohltí zranění
      const pohlti = Math.min(h.stitMag, dmg);
      h.stitMag -= pohlti; dmg -= pohlti;
      ud.push({ typ: 'stitMag', pohltil: pohlti, zbyva: h.stitMag });
      if (!dmg) return;
    }
    if (h.kryti) {
      const pred = dmg;
      dmg = Math.max(0, Math.round(dmg * (ma(s, 'stitonos') ? 0.1 : 0.3) * (1 - 0.02 * navic(s, 'kryti'))));
      ud.push({ typ: 'vykryl', id: m.id, druh: m.druh, zadrzel: pred - dmg });
      cvic(s, 'kryti', ud);
      if (ma(s, 'basta') && pred - dmg > 1) zranPotvoru(s, m, Math.ceil((pred - dmg) / 2), ud);
      if (!dmg) return;
    }
    h.hp -= dmg;
    cvic(s, 'odolnost', ud);
    if (h.odraz > 0 && dmg > 1) zranPotvoru(s, m, Math.ceil(dmg / 2), ud, true);   // zrcadlová kůže
    nakaz(s, m.druh, ud);
    let vysal = 0;
    if (d.vysava) { vysal = Math.min(m.maxHp - m.hp, Math.ceil(dmg / 2)); m.hp += vysal; }
    ud.push({ typ: 'zranen', id: m.id, druh: m.druh, dmg, x: m.x, y: m.y, vysal });
    if (h.hp <= 0) zemri(s, d.pricina[Ri(s, 0, d.pricina.length - 1)], m.druh, ud);
  }

  // střela nebo kouzlo potvory na dálku
  function strelaPotvory(s, m, d, ud) {
    const h = s.hrac, obrana = odvozene(s).obrana, st = d.strelec;
    const sance = omez(d.presnost - 0.02 * obrana - (m.oslepen > s.tah ? 0.35 : 0), 0.15, 0.9);
    if (Rs(s) >= sance || uhne(s)) { ud.push({ typ: 'kouzloPotvory', id: m.id, druh: m.druh, nazev: st.nazev, dmg: 0, x: m.x, y: m.y }); return; }
    let dmg = Math.max(1, Ri(s, st.utok[0], st.utok[1]) + m.bonus - Math.floor(obrana / 3));
    if (h.kryti) dmg = Math.max(1, Math.round(dmg * 0.5));
    h.hp -= dmg;
    if (dmg) nakaz(s, m.druh, ud);
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

  const POLE_POTVORY = ['id', 'druh', 'x', 'y', 'hp', 'maxHp', 'bonus', 'stav', 'energie', 'stopa', 'volal', 'pan', 'smer', 'strachDo', 'vzchopila', 'lecil', 'nacelnik', 'elita', 'zmizi', 'jed', 'spankem', 'mana', 'faze', 'oslepen', 'lup', 'bezRegen', 'zkamenil'];
  function serializuj(s) {
    return JSON.stringify({
      verze: 4, seed: s.seed, patro: s.patro, tah: s.tah, nejhlubsi: s.nejhlubsi, rng: s.rng,
      x: s.x, y: s.y, smer: s.smer,
      prozkoumano: bityNaHex(s.prozkoumano),
      otevrene: [...s.otevrene],
      jmeno: s.jmeno, rod: s.rod, hrac: s.hrac, zabito: s.zabito, tajne: s.tajne, zlato: s.zlato, dalsiId: s.dalsiId, bossu: s.bossu || 0,
      potvory: s.potvory.map(m => POLE_POTVORY.map(k => m[k])),
      barvyLektvaru: s.barvyLektvaru, zname: s.zname, truhly: s.truhly, zeme: s.zeme,
      pasti: s.pasti, dekorace: s.dekorace.map(d => (d.rozbito ? 100 : d.zasahy ? 200 + d.zasahy : d.pouzito ? 1 : d.hody ? 10 + d.hody : 0)), odhalene: [...s.odhalene], prokopano: [...(s.prokopano || [])],
      zamcene: [...s.zamcene], navstivene: [...s.navstivene], rychla: s.rychla,
      mrize: [...s.mrize], paka: s.paka, sebraneLouce: [...s.sebraneLouce],
      napisySvitku: s.napisySvitku, znameSvitky: s.znameSvitky, obchod: s.obchod, obchodPred: s.obchodPred, ukol: s.ukol, trida: s.trida, denni: s.denni, stat: s.stat,
      obtiznost: s.obtiznost, zelezny: s.zelezny, spolecnik: s.spolecnik || null, prubeh: s.prubeh || [], poznamky: s.poznamky || {}, vitezstvi: !!s.vitezstvi, hadankaPak: s.hadankaPak, stopy: s.stopy || [],
    });
  }

  function obnov(text) {
    const d = JSON.parse(text);
    if (!d || !(d.verze >= 1 && d.verze <= 4)) return null;
    // posledniObchod musí být známý dřív, než se patro znovu postaví (rozhoduje, jestli v něm obchodník je)
    const s = { verze: 4, seed: d.seed >>> 0, patro: 1, tah: d.tah | 0, nejhlubsi: d.nejhlubsi | 0, rng: d.rng | 0, posledniObchod: d.obchodPred | 0,
      trida: TRIDY[d.trida] ? d.trida : 'rytir', denni: d.denni || null, obtiznost: OBTIZNOSTI[d.obtiznost] ? d.obtiznost : 'normalni', zelezny: !!d.zelezny };
    novyHrdina(s);
    vstupDoPatra(s, d.patro | 0 || 1);
    const p = s.mapaPatra;
    // hráč smí stát i na odhalené tajné zdi (dveře) nebo na prokopaném poli – ty se obnoví až níž
    const iHrace = d.y * p.w + d.x;
    if (!(d.x >= 0 && d.y >= 0 && d.x < p.w && d.y < p.h) || !(pruchozi(p.mapa[iHrace]) || (d.odhalene || []).includes(iHrace) || (d.prokopano || []).includes(iHrace))) return null;
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
      s.barvyLektvaru = barvyLektvaru(); s.zname = d.zname || ['leceni'];   // barvy jsou pevné – i starší uložení dostane nové
      s.truhly = d.truhly || []; s.zeme = d.zeme || [];
    }
    if (d.mrize) s.mrize = new Set(d.mrize);
    if (d.paka) s.paka = d.paka;
    if (d.sebraneLouce) s.sebraneLouce = new Set(d.sebraneLouce);
    if (s.hrac.pochoden === undefined) s.hrac.pochoden = 800;       // starší uložení pochodeň neznalo
    srovnejHromadky(s.hrac.batoh);                            // i starší uložení: spotřební věci na hromádky
    if (s.hrac.vybava && s.hrac.vybava.luk === undefined) {          // starší uložení: luk byl ve slotu zbraně
      const v = s.hrac.vybava;
      v.luk = null; s.hrac.drzi = 'zbran';
      if (v.zbran && ZAKLADY[v.zbran.zaklad].dosah) { v.luk = v.zbran; v.zbran = null; s.hrac.drzi = 'luk'; }
    }
    if (d.verze >= 4) {
      s.pasti = d.pasti || [];
      (d.dekorace || []).forEach((u, i) => { const q = s.dekorace[i]; if (!q) return; if (u >= 200) q.zasahy = u - 200; else if (u === 100) q.rozbito = true; else if (u >= 10) q.hody = u - 10; else q.pouzito = !!u; });
      for (const i of d.odhalene || []) { if (p.mapa[i] === T.TAJNE) { p.mapa[i] = T.DVERE; s.odhalene.add(i); } }
      s.prokopano = new Set(d.prokopano || []);
      for (const i of s.prokopano) if (p.mapa[i] === T.SKALA) p.mapa[i] = T.CHODBA;
      s.zamcene = new Set(d.zamcene || []);
      s.navstivene = new Set(d.navstivene || []);
    }
    if (Array.isArray(d.rychla)) s.rychla = d.rychla.concat(Array(Math.max(0, RYCHLYCH - d.rychla.length)).fill(null));   // dřív jen 3 sloty
    if (d.stat) s.stat = d.stat;
    if (d.napisySvitku) { s.napisySvitku = d.napisySvitku; s.znameSvitky = d.znameSvitky || []; }
    if (d.obchod !== undefined) s.obchod = d.obchod;
    s.ukol = d.ukol || null;                      // starší uložení úkoly neznalo
    s.spolecnik = d.spolecnik || null;
    s.prubeh = d.prubeh || [];
    s.poznamky = d.poznamky || {};
    s.vitezstvi = !!d.vitezstvi;
    if (d.hadankaPak && s.hadankaPak) { s.hadankaPak.zadano = d.hadankaPak.zadano || []; s.hadankaPak.hotovo = !!d.hadankaPak.hotovo; }
    s.stopy = d.stopy || [];
    pripravMagii(s);
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
    ODOLNOSTI_POTVOR, NEMRTVI, nasobekZraneni, typZbrane, NAKAZY, STAVY, STRANKY, CIL_PATRO, TABOR, MAX_TABOR, cenaTabor, relikvieZa, drazky, SYMBOLY, dohledPotvor, STOPA_POTVORY,
    cilKouzla, SADY, RECEPTY, VARNY, uVarny, maPrisady, OBTIZNOSTI, KLETBY_PATRA, kletbaPatra, SPOLECNICI, cenaSpolecnika, cenaZapomneni, novyUnikat,
    BODY_VLASTNOSTI, BODU_ZA_UROVEN, OD_STUPNE, stupenSchopnosti, proc_nelze, cenaKouzla, titulDovednosti, uhne,
    jeLouc, SANCE_LOUCE, MAX_PALIVA, TRIDY, seedDne, SCHOPNOSTI, najdiCestu, HADANKY, KLETBY, cenaPredmetu, cenaNakupu, cenaVykupu, cenaOdkleti, uObchodnika, BESTIAR, BOSSOVE, bossZiv, JMENA, potvoraNa, zkDalsi, OBTIZNOST, UCELY, DEKORACE, PASTI, dekoraceNa, pastNa, prekazkaNa, souvisle,
    maLucernu, popisUkolu, MAX_HROMADKA, hromadi, kusu, MAX_KOVANI, KOVATELNE, uKovare, kovatelny, cenaKovani, rudyNaKovani, rudyVBatohu, ZAKLADY, SLOTY, MAX_BATOH, BATOHY, kapacita, cenaBatohu, drziLuk, vRuce, VZACNOSTI, VLASTNOSTI, LEKTVARY, novyPredmet, nahodnyPredmet, nazevPredmetu,
    vlastnostiPredmetu, skorePredmetu, slotPro, odvozene, truhlaNa, doBatohu, ZAJIMAVOSTI, jePoi, moznostiPoi,
    KOUZLA, SEKCE_KOUZEL, DOVEDNOSTI, potrebaDovednosti, MAX_DOVEDNOST, ELITY, cilVPrimce, OZDOBY, RYCHLYCH, horsiVybava, ODOLNOST, stoji, lepsiVybava, jmenoHrdiny,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.PodzemiLogika = API;
})(typeof self !== 'undefined' ? self : this);
