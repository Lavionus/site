/* ============================================================
   Krumpáč – bossové (bez DOM). Potřebuje hra.js a nepratele.js.
   Každý boss: novy(st, pozice), krok(st, b), telo(b), slapnout(b), zranitelnost(b) = násobek poškození.
   Po porážce se odemkne východ (st.cilZamceno = false).
   ============================================================ */
var KRUMPAC = (typeof KRUMPAC !== 'undefined') ? KRUMPAC : (typeof global !== 'undefined' && global.KRUMPAC) || {};
if (typeof global !== 'undefined') global.KRUMPAC = KRUMPAC;

(function (K) {
  'use strict';
  const T = 16, DT = 1 / 60;
  const BODY_BOSS = 2000;

  function zaklad(typ, nazev, poz, w, h, hp) {
    return { typ, nazev, x: poz.x - w / 2, y: poz.y - h, w, h, vx: 0, vy: 0, hp, max: hp, stav: 'uvod', cas: 0,
      smer: -1, nezranitelny: 0, mrtvy: 0, faze: 0, druhaFaze: false, naZemi: false };
  }
  const stredX = o => o.x + o.w / 2;
  const kHraci = (st, b) => Math.sign(stredX(st.hrac) - stredX(b)) || b.smer;
  function gravitace(st, b, g) {
    const { posun, F } = K._;
    b.vy = Math.min(b.vy + (g || F.gravitace) * DT, 500);
    const r = posun(st, b, b.vx * DT, b.vy * DT, true);
    if (r.zeme) { b.vy = 0; } b.naZemi = r.zeme;
    return r;
  }
  function vlny(st, b) {   // rázová vlna po dupnutí do obou stran
    const { vystrel, udalost } = K._;
    const y = b.y + b.h - 6;
    vystrel(st, 'vlna', b.x - 4, y, -K.STRELY.vlna.v, 0);
    vystrel(st, 'vlna', b.x + b.w + 4, y, K.STRELY.vlna.v, 0);
    udalost(st, 'dupnuti', b.x, b.y);
  }
  function hodNaHrace(st, x, y, letCas, rozptyl) {   // kámen po parabole tak, aby dopadl na hráče
    const h = st.hrac, g = K.STRELY.kamen.g;
    const dx = (stredX(h) + (rozptyl || 0)) - x, dy = (h.y + h.h / 2) - y;
    K._.vystrel(st, 'kamen', x, y, dx / letCas, (dy - 0.5 * g * letCas * letCas) / letCas);
  }

  const BOSSOVE = {
    // ---------- svět 1: gobliní náčelník ----------
    goblin: {
      novy: (st, poz) => zaklad('goblin', 'Gobliní náčelník', poz, 24, 32, 14),
      telo: b => ({ x: b.x, y: b.y, w: b.w, h: b.h }),
      slapnout: b => b.stav !== 'naraz',
      zranitelnost: b => b.stav === 'omraceny' ? 2 : 1,
      krok(st, b) {
        const { udalost } = K._;
        b.cas += DT;
        if (b.stav === 'uvod') { b.vx = 0; gravitace(st, b); if (b.cas > 1.2) { b.stav = 'chuze'; b.cas = 0; } return; }
        if (b.stav === 'chuze') {
          b.smer = kHraci(st, b); b.vx = b.smer * (b.druhaFaze ? 60 : 45);
          if (b.cas > (b.druhaFaze ? 1.4 : 2.0)) { b.cas = 0; b.stav = b.druhaFaze && Math.random() < 0.45 ? 'skok' : 'napriah'; if (b.stav === 'skok') { b.vy = -380; b.vx = kHraci(st, b) * 90; udalost(st, 'boss_skok', b.x, b.y); } }
        } else if (b.stav === 'napriah') { b.vx = 0; b.smer = kHraci(st, b); if (b.cas > 0.55) { b.stav = 'naraz'; b.cas = 0; udalost(st, 'boss_rev', b.x, b.y); } }
        else if (b.stav === 'naraz') {
          b.vx = b.smer * 230;
          if (b.cas > 1.3) { b.stav = 'chuze'; b.cas = 0; }
        } else if (b.stav === 'omraceny') { b.vx = 0; if (b.cas > 1.5) { b.stav = 'chuze'; b.cas = 0; } }
        else if (b.stav === 'skok') { if (b.naZemi && b.cas > 0.15) { vlny(st, b); b.stav = 'chuze'; b.cas = 0; b.vx = 0; } }
        const r = gravitace(st, b);
        if (b.stav === 'naraz' && r.stena) { b.stav = 'omraceny'; b.cas = 0; udalost(st, 'naraz', b.x, b.y); }
        if (!b.druhaFaze && b.hp <= b.max / 2) {
          b.druhaFaze = true; udalost(st, 'boss_faze', b.x, b.y);
          for (const x of [3 * T, (st.sirka - 4) * T]) st.nepratele.push(K.novyNepritel('g', x, (st.vyska - 4) * T));
        }
      },
    },

    // ---------- svět 2: ledová pavoučice ----------
    pavouk: {
      novy: (st, poz) => {
        const b = zaklad('pavouk', 'Ledová pavoučice', poz, 24, 32, 14);
        let ty = 1; while (ty < st.vyska - 1 && K._.pevna(K._.dlazdice(st, Math.floor(poz.x / T), ty))) ty++;
        b.strop = ty * T; b.y = b.strop; b.stav = 'strop'; return b;
      },
      telo: b => ({ x: b.x, y: b.y, w: b.w, h: b.h }),
      slapnout: b => b.stav === 'dole',
      zranitelnost: b => b.stav === 'dole' ? 2 : 1,
      krok(st, b) {
        const { udalost, posun } = K._;
        b.cas += DT; b.faze += DT;
        if (b.stav === 'strop') {
          b.smer = kHraci(st, b);
          const cilX = stredX(st.hrac) - b.w / 2;
          b.vx = Math.max(-70, Math.min(70, (cilX - b.x) * 2));
          posun(st, b, b.vx * DT, 0, false);
          const interval = b.druhaFaze ? 0.8 : 1.2;
          if (Math.floor(b.cas / interval) !== Math.floor((b.cas - DT) / interval)) {
            for (const vx of b.druhaFaze ? [-55, 0, 55] : [0]) K._.vystrel(st, 'led', stredX(b), b.y + b.h + 4, vx, 20);
            udalost(st, 'led', b.x, b.y);
          }
          if (b.cas > 3.2) { b.stav = 'spousti'; b.cas = 0; udalost(st, 'pavouk', b.x, b.y); }
        } else if (b.stav === 'spousti') {
          const r = posun(st, b, 0, 140 * DT, false);
          if (r.zeme) { b.stav = 'dole'; b.cas = 0; udalost(st, 'dupnuti', b.x, b.y);
            if (b.druhaFaze && st.nepratele.filter(n => !n.mrtvy).length < 3) st.nepratele.push(K.novyNepritel('s', stredX(b), b.y + b.h)); }
        } else if (b.stav === 'dole') {
          b.vx = kHraci(st, b) * 25; posun(st, b, b.vx * DT, 0, false);
          if (b.cas > 2.2) { b.stav = 'stoupa'; b.cas = 0; }
        } else if (b.stav === 'stoupa') {
          b.y = Math.max(b.strop, b.y - 70 * DT);
          if (b.y <= b.strop) { b.stav = 'strop'; b.cas = 0; }
        }
        if (!b.druhaFaze && b.hp <= b.max / 2) { b.druhaFaze = true; udalost(st, 'boss_faze', b.x, b.y); }
      },
    },

    // ---------- svět 3: obří úhoř ----------
    uhor: {
      novy: (st, poz) => { const b = zaklad('uhor', 'Obří úhoř', poz, 34, 12, 12); b.stav = 'plave'; b.hladina = null; return b; },
      telo: b => ({ x: b.x, y: b.y, w: b.w, h: b.h }),
      slapnout: b => b.stav === 'vynor',
      zranitelnost: b => (b.stav === 'vynor' || b.stav === 'skok') ? 1 : 0.5,
      krok(st, b) {
        const { udalost, dlazdice } = K._;
        b.cas += DT; b.faze += DT;
        if (b.hladina === null) {   // najít hladinu vody pod bossem
          let ty = Math.floor((b.y + b.h) / T);
          while (ty > 0 && dlazdice(st, Math.floor(stredX(b) / T), ty - 1) === 'W') ty--;
          b.hladina = ty * T; b.dno = b.hladina + 2 * T;
          let a = Math.floor(stredX(b) / T), c = a;
          while (dlazdice(st, a - 1, Math.floor(b.hladina / T) + 1) === 'W') a--;
          while (dlazdice(st, c + 1, Math.floor(b.hladina / T) + 1) === 'W') c++;
          b.xmin = a * T; b.xmax = (c + 1) * T - b.w;   // pozor: b.max je maximum zdraví
        }
        const cilX = Math.max(b.xmin, Math.min(b.xmax, stredX(st.hrac) - b.w / 2));
        if (b.stav === 'plave') {
          b.y += ((b.hladina + T) - b.y) * 3 * DT;
          b.x += Math.max(-80, Math.min(80, (cilX - b.x) * 2)) * DT; b.smer = Math.sign(cilX - b.x) || b.smer;
          if (b.cas > (b.druhaFaze ? 1.6 : 2.4)) { b.cas = 0; b.stav = Math.random() < 0.5 ? 'vynor' : 'skok';
            if (b.stav === 'skok') { b.vx = kHraci(st, b) * 120; b.vy = -360; udalost(st, 'cak', b.x, b.hladina); } else udalost(st, 'cak', b.x, b.hladina); }
        } else if (b.stav === 'vynor') {
          b.y += ((b.hladina - b.h - 6) - b.y) * 5 * DT; b.smer = kHraci(st, b);
          // výpad přes okraj jezírka po hráči na břehu
          const vypad = Math.max(b.xmin - 14, Math.min(b.xmax + 14, stredX(st.hrac) - b.w / 2));
          b.x += Math.max(-90, Math.min(90, (vypad - b.x) * 3)) * DT;
          if (b.cas > 1.8) { b.stav = 'plave'; b.cas = 0; }
        } else if (b.stav === 'skok') {
          b.vy += 600 * DT; b.x = Math.max(b.xmin - T, Math.min(b.xmax + T, b.x + b.vx * DT)); b.y += b.vy * DT;
          if (b.vy > 0 && b.y > b.hladina) { b.stav = 'plave'; b.cas = 0; b.x = Math.max(b.xmin, Math.min(b.xmax, b.x)); udalost(st, 'cak', b.x, b.hladina); }
        }
        if (!b.druhaFaze && b.hp <= b.max / 2) { b.druhaFaze = true; udalost(st, 'boss_faze', b.x, b.y);
          st.nepratele.push(K.novyNepritel('r', b.xmin + T, b.hladina + T + 8)); }
      },
    },

    // ---------- svět 4: kamenný golem ----------
    golem: {
      novy: (st, poz) => zaklad('golem', 'Kamenný golem', poz, 28, 38, 18),
      telo: b => ({ x: b.x, y: b.y, w: b.w, h: b.h }),
      slapnout: b => b.stav === 'jadro',
      zranitelnost: b => b.stav === 'jadro' ? 2 : 0.5,
      krok(st, b) {
        const { udalost } = K._;
        b.cas += DT;
        if (b.stav === 'uvod') { gravitace(st, b); if (b.cas > 1.2) { b.stav = 'chuze'; b.cas = 0; } return; }
        if (b.stav === 'chuze') {
          b.smer = kHraci(st, b); b.vx = b.smer * 28;
          if (b.cas > 1.8) { b.stav = 'hod'; b.cas = 0; b.hody = 0; b.vx = 0; }
        } else if (b.stav === 'hod') {
          b.vx = 0; b.smer = kHraci(st, b);
          const interval = 0.7;
          if (b.cas > interval) {
            b.cas = 0; b.hody++;
            const n = b.druhaFaze ? 3 : 1;
            for (let i = 0; i < n; i++) hodNaHrace(st, stredX(b) + b.smer * 10, b.y + 6, 1.0, (i - (n - 1) / 2) * 40);
            udalost(st, 'hod_kamen', b.x, b.y);
            if (b.hody >= 2) { b.stav = 'skok'; b.cas = 0; b.vy = -300; b.vx = kHraci(st, b) * 60; }
          }
        } else if (b.stav === 'skok') { if (b.naZemi && b.cas > 0.15) { vlny(st, b); b.stav = 'jadro'; b.cas = 0; b.vx = 0; } }
        else if (b.stav === 'jadro') { b.vx = 0; if (b.cas > 2.2) { b.stav = 'chuze'; b.cas = 0; } }
        gravitace(st, b);
        if (!b.druhaFaze && b.hp <= b.max / 2) { b.druhaFaze = true; udalost(st, 'boss_faze', b.x, b.y); }
      },
    },
  };

  function krokBosse(st) {
    const b = st.boss;
    if (!b) return;
    b.nezranitelny = Math.max(0, b.nezranitelny - DT);
    if (b.mrtvy) { b.mrtvy += DT; return; }
    BOSSOVE[b.typ].krok(st, b);
    if (b.y > st.vyska * T + 40) { b.y = 4 * T; b.vy = 0; }   // pojistka: nikdy nespadne z mapy
  }

  // zásah bosse; poškození násobí jeho momentální zranitelnost
  function zasahBosse(st, dmg, smer) {
    const { udalost, castice } = K._;
    const b = st.boss;
    if (!b || b.mrtvy || b.nezranitelny > 0) return false;
    const skut = Math.max(0.5, dmg * BOSSOVE[b.typ].zranitelnost(b));
    b.hp = Math.max(0, b.hp - skut);
    b.nezranitelny = 0.35;
    castice(st, b.x + b.w / 2, b.y + b.h / 3, '#ffffff', 8, 90);
    udalost(st, 'boss_zasah', b.x, b.y);
    if (b.hp <= 0) {
      b.mrtvy = DT; st.cilZamceno = false; st.body += BODY_BOSS;
      castice(st, b.x + b.w / 2, b.y + b.h / 2, '#ffd27a', 30, 160);
      udalost(st, 'boss_porazen', b.x + b.w / 2, b.y, BODY_BOSS);
      for (const n of st.nepratele) if (!n.mrtvy) K.zabijNepritele(st, n, b.x);
    }
    return true;
  }

  K.bossove = BOSSOVE;
  K.krokBosse = krokBosse;
  K.zasahBosse = zasahBosse;
  if (typeof module !== 'undefined') module.exports = K;
})(KRUMPAC);
