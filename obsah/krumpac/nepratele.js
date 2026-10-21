/* ============================================================
   Krumpáč – nepřátelé (bez DOM). Potřebuje hra.js (K._ = pomocné funkce).
   g goblin, s sliz, b netopýr, p pavouk na vlákně, k kostlivec lučištník,
   m krtek, r ryba (jen ve vodě)
   ============================================================ */
var KRUMPAC = (typeof KRUMPAC !== 'undefined') ? KRUMPAC : (typeof global !== 'undefined' && global.KRUMPAC) || {};
if (typeof global !== 'undefined') global.KRUMPAC = KRUMPAC;

(function (K) {
  'use strict';
  const T = 16, DT = 1 / 60;

  const DEF = {
    g: { w: 14, h: 18, hp: 2, rychlost: 38, beh: 60, body: 50, barva: '#7aa64a' },
    s: { w: 14, h: 10, hp: 1, rychlost: 0, body: 40, barva: '#6fd46a' },
    b: { w: 14, h: 10, hp: 1, rychlost: 55, body: 60, barva: '#a070d0', leta: true },
    p: { w: 12, h: 10, hp: 1, rychlost: 95, body: 60, barva: '#3a3a44', leta: true },
    k: { w: 12, h: 20, hp: 2, rychlost: 0, body: 80, barva: '#e8e2d0', interval: 2.2, dostrel: 210 },
    m: { w: 14, h: 12, hp: 1, rychlost: 0, body: 70, barva: '#8a5a3a' },
    r: { w: 14, h: 8, hp: 1, rychlost: 45, body: 50, barva: '#5aa0e0', leta: true },
  };

  function novyNepritel(druh, x, yPata) {
    const d = DEF[druh];
    const n = {
      druh, x: x - d.w / 2, y: yPata - d.h, w: d.w, h: d.h, hp: d.hp,
      vx: druh === 'g' || druh === 'r' ? -d.rychlost : 0, vy: 0, smer: -1, naZemi: false,
      zasah: 0, faze: Math.random() * 6, stav: druh === 'b' ? 'spi' : 'jde', cekani: 0.6 + Math.random(), klid: 0,
      domovX: x, domovY: yPata - d.h, mrtvy: 0,
    };
    if (druh === 'p') { n.y = Math.floor(yPata / T - 1) * T; n.kotva = n.y; n.domovY = n.y; n.stav = 'nahore'; }
    if (druh === 'm') { n.stav = 'schovany'; n.vynor = 0; }
    if (druh === 'k') { n.cekani = 1 + Math.random(); }
    return n;
  }

  // krtek pod zemí a pavouk nahoře nejdou zasáhnout
  const zasazitelny = n => !(n.druh === 'm' && n.stav === 'schovany');
  // kontakt zraňuje? (schovaný krtek ne)
  const nebezpecny = n => !(n.druh === 'm' && n.stav === 'schovany');

  function krokNepritele(st, n) {
    const { posun, dlazdice, pevna, volnaCesta, vLave, veVode, vystrel, castice, udalost, F } = K._;
    const h = st.hrac;
    n.faze += DT;
    n.zasah = Math.max(0, n.zasah - DT);
    if (n.mrtvy) { n.mrtvy += DT; n.vy += F.gravitace * DT; n.y += n.vy * DT; n.x += n.vx * DT; return; }
    const d = DEF[n.druh];
    const hx = h.x + h.w / 2, nx = n.x + n.w / 2;
    if (n.druh === 'g') {
      // honička: hráč na stejné úrovni a blízko → „!“, krátké zaváhání, pak běh proti němu
      n.klid = Math.max(0, n.klid - DT);
      const vyskaRozdil = Math.abs((h.y + h.h) - (n.y + n.h));
      const vidi = !h.mrtvy && !n.klid && Math.abs(hx - nx) < 110 && vyskaRozdil < 20 && volnaCesta(st, nx, hx, n.y + n.h / 2);
      if (n.stav === 'jde' && vidi && n.naZemi) { n.stav = 'pozor'; n.cekani = 0.5; n.smer = Math.sign(hx - nx) || n.smer; udalost(st, 'pozor', n.x, n.y); }
      else if (n.stav === 'pozor') { n.cekani -= DT; if (n.cekani <= 0) n.stav = 'honi'; }
      else if (n.stav === 'honi') {
        if (!vidi && (Math.abs(hx - nx) > 170 || vyskaRozdil > 40 || n.klid)) n.stav = 'jde';
        else n.smer = Math.sign(hx - nx) || n.smer;
      }
      const rychlost = n.stav === 'honi' ? d.beh : n.stav === 'pozor' ? 0 : d.rychlost;
      if (n.zasah > 0.15) { /* odhozen */ } else n.vx = n.smer * rychlost;
      n.vy = Math.min(n.vy + F.gravitace * DT, F.maxPad);
      const r = posun(st, n, n.vx * DT, n.vy * DT, true);
      if (r.zeme) n.vy = 0;
      n.naZemi = r.zeme;
      if (r.stena && n.stav !== 'honi') n.smer = -n.smer;
      // na hraně se otočí (při honičce jen zastaví a čeká)
      if (n.naZemi && n.zasah <= 0) {
        const predX = n.smer > 0 ? n.x + n.w + 1 : n.x - 1;
        const pod = dlazdice(st, Math.floor(predX / T), Math.floor((n.y + n.h + 1) / T));
        if (!pevna(pod) && pod !== '=' && pod !== '~') {
          if (n.stav === 'honi') { n.x -= n.vx * DT; n.vx = 0; } else n.smer = -n.smer;
        }
      }
    } else if (n.druh === 's') {
      n.vy = Math.min(n.vy + F.gravitace * DT, F.maxPad);
      if (n.naZemi) {
        n.vx = 0;
        n.cekani -= DT;
        if (n.cekani <= 0) {
          const blizko = Math.abs(hx - nx) < 120 && Math.abs(h.y - n.y) < 60;
          n.smer = blizko ? Math.sign(hx - nx) || 1 : (Math.random() < 0.5 ? -1 : 1);
          n.vx = n.smer * (blizko ? 70 : 40); n.vy = -(blizko ? 230 : 160);
          n.cekani = 0.8 + Math.random() * 0.8; n.naZemi = false;
          udalost(st, 'cvak', n.x, n.y);
        }
      }
      const r = posun(st, n, n.vx * DT, n.vy * DT, true);
      if (r.stena) n.vx = -n.vx;
      if (r.zeme) { n.vy = 0; n.naZemi = true; } else if (n.vy !== 0) n.naZemi = false;
    } else if (n.druh === 'b') {
      if (n.stav === 'spi') {
        if (Math.abs(hx - nx) < 110 && Math.abs(h.y - n.y) < 110) n.stav = 'leti';
      } else {
        const cilX = hx, cilY = h.y + 4 + Math.sin(n.faze * 3) * 18;
        const dx = cilX - nx, dy = cilY - (n.y + n.h / 2);
        const dd = Math.hypot(dx, dy) || 1;
        if (n.zasah > 0.15) { /* odhozen */ }
        else { n.vx += (dx / dd * d.rychlost - n.vx) * 2.5 * DT; n.vy += (dy / dd * d.rychlost - n.vy) * 2.5 * DT; }
        n.smer = n.vx >= 0 ? 1 : -1;
        const r = posun(st, n, n.vx * DT, n.vy * DT, false);
        if (r.stena) n.vx = -n.vx * 0.5;
        if (r.zeme || r.strop) n.vy = -n.vy * 0.5;
      }
    } else if (n.druh === 'p') {
      // pavouk: visí u stropu, když je hráč pod ním, spustí se po vlákně a zase vyšplhá
      const pod = Math.abs(hx - nx) < 34 && h.y > n.kotva;
      if (n.stav === 'nahore') { n.vy = 0; if (pod && !h.mrtvy) { n.stav = 'dolu'; udalost(st, 'pavouk', n.x, n.y); } }
      else if (n.stav === 'dolu') {
        n.vy = d.rychlost;
        const r = posun(st, n, 0, n.vy * DT, false);
        if (r.zeme || n.y + n.h >= h.y + h.h - 2) { n.stav = 'ceka'; n.cekani = 0.9; }
      } else if (n.stav === 'ceka') { n.cekani -= DT; if (n.cekani <= 0) n.stav = 'nahoru'; }
      else if (n.stav === 'nahoru') { n.y = Math.max(n.kotva, n.y - 40 * DT); if (n.y <= n.kotva) n.stav = 'nahore'; }
      if (n.zasah > 0) n.x += Math.sin(n.faze * 40) * 0.3;
    } else if (n.druh === 'k') {
      // kostlivec: stojí, otáčí se za hráčem a střílí šípy, když na něj vidí
      n.vy = Math.min(n.vy + F.gravitace * DT, F.maxPad);
      const r = posun(st, n, 0, n.vy * DT, true); if (r.zeme) n.vy = 0;
      const vidi = !h.mrtvy && Math.abs(hx - nx) < d.dostrel && Math.abs((h.y + h.h / 2) - (n.y + 6)) < 30 && volnaCesta(st, nx, hx, n.y + 6);
      if (vidi) n.smer = Math.sign(hx - nx) || n.smer;
      n.cekani -= DT;
      if (n.cekani < 0.35 && n.cekani + DT >= 0.35 && vidi) n.napina = true;
      if (n.cekani <= 0) {
        if (vidi) { vystrel(st, 'sip', nx + n.smer * 8, n.y + 6, n.smer * K.STRELY.sip.v, 0); udalost(st, 'sip', n.x, n.y); }
        n.napina = false; n.cekani = d.interval;
      }
    } else if (n.druh === 'm') {
      // krtek: pod zemí, u hráče vyleze, chvíli kouše a zase zaleze
      if (n.stav === 'schovany') {
        n.cekani -= DT;
        if (n.cekani <= 0 && !h.mrtvy && Math.abs(hx - nx) < 56 && Math.abs((h.y + h.h) - (n.y + n.h)) < 24) {
          n.stav = 'leze'; n.vynor = 0; udalost(st, 'krtek', n.x, n.y); castice(st, nx, n.y + n.h, '#6b4a2f', 8, 60);
        }
      } else if (n.stav === 'leze') { n.vynor = Math.min(1, n.vynor + DT / 0.25); if (n.vynor >= 1) { n.stav = 'venku'; n.cekani = 1.3; } }
      else if (n.stav === 'venku') { n.smer = Math.sign(hx - nx) || n.smer; n.cekani -= DT; if (n.cekani <= 0) n.stav = 'zaleza'; }
      else if (n.stav === 'zaleza') { n.vynor = Math.max(0, n.vynor - DT / 0.3); if (n.vynor <= 0) { n.stav = 'schovany'; n.cekani = 1.6; } }
    } else if (n.druh === 'r') {
      // ryba: pluje sem a tam, jen ve vodě
      if (n.zasah <= 0.15) n.vx = n.smer * d.rychlost;
      n.vy = Math.sin(n.faze * 2) * 10;
      const pred = { x: n.x + n.vx * DT * 4, y: n.y, w: n.w, h: n.h };
      if (!veVode(st, pred) || pevna(dlazdice(st, Math.floor((n.x + (n.smer > 0 ? n.w + 2 : -2)) / T), Math.floor((n.y + n.h / 2) / T)))) { n.smer = -n.smer; n.vx = -n.vx; }
      const r = posun(st, n, n.vx * DT, n.vy * DT, false);
      if (r.stena) n.smer = -n.smer;
    }
    if (n.y > st.vyska * T + 40) n.mrtvy = 9;
    else if (!d.leta && vLave(st, n)) { castice(st, n.x + n.w / 2, n.y + n.h, '#ff8a2a', 10, 100); n.mrtvy = 1.2; n.vy = -120; udalost(st, 'lava', n.x, n.y); }
  }

  function zabijNepritele(st, n, odX) {
    const { castice, udalost } = K._;
    n.mrtvy = DT; n.vy = -180; n.vx = (n.x + n.w / 2 < odX ? -1 : 1) * 60;
    st.body += DEF[n.druh].body;
    udalost(st, 'body', n.x + n.w / 2, n.y, DEF[n.druh].body);
    castice(st, n.x + n.w / 2, n.y + n.h / 2, DEF[n.druh].barva, 12, 100);
    udalost(st, 'zabiti', n.x, n.y);
  }

  // zásah zbraní (krumpáč, oštěp, sekera); smer = odkud přišel
  function zasahNepritele(st, n, dmg, smer) {
    const { castice, udalost } = K._;
    n.hp -= dmg;
    n.zasah = 0.3;
    if (n.hp <= 0) zabijNepritele(st, n, n.x + n.w / 2 - smer * 10);
    else {
      if (n.druh !== 'p' && n.druh !== 'm' && n.druh !== 'k') { n.vx = smer * 160; n.vy = -120; }
      udalost(st, 'zasah', n.x, n.y); castice(st, n.x + n.w / 2, n.y + 4, '#ffffff', 5, 70);
    }
  }

  K.NEPRITEL_DEF = DEF;
  K.novyNepritel = novyNepritel;
  K.krokNepritele = krokNepritele;
  K.zabijNepritele = zabijNepritele;
  K.zasahNepritele = zasahNepritele;
  K.zasazitelny = zasazitelny;
  K.nebezpecny = nebezpecny;
  if (typeof module !== 'undefined') module.exports = K;
})(KRUMPAC);
