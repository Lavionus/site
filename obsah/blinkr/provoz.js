/* Zrcátko, blinkr, jeď! – provoz a rozhodčí (bez DOM, spustitelné v node).
   sim = vytvor(svet, { seed, autopilot }) ; krok(sim, dt, vstup) ; sim.prestupky = seznam chyb hráče.
   Auta NPC jezdí po drahách dlaždic a dávají přednost podle jádra (jsou vzorem). Hráč jezdí volně
   (fyzika kola) nebo na autopilota (stejná logika jako NPC – tím test ověřuje, že vzorná jízda je bez chyby).
   Nedání přednosti = vozidlo s předností muselo kvůli hráči náhle brzdit (§ 2 písm. a) zákona 361/2000 Sb.). */
(function () {
  'use strict';
  const uzel = typeof module !== 'undefined';
  const J = uzel ? require('./jadro.js') : window.BLINKR_JADRO;
  const SV = uzel ? require('./svet.js') : window.BLINKR_SVET;
  const D = J.SMERY;

  const AUTO = { delka: 4.4, sirka: 1.8, rozvor: 2.6 };
  const A_PLYN = 4.0, A_BRZDA = 8.5;   // výchozí rozjezd a brzdy hráče (m/s²)
  const A_NPC = 3.0;               // rozjezd NPC (m/s²)
  const PRID = 2.4;                // od středu auta k přídi (+ rezerva)
  const NAHLE = 3.0;               // m/s² – od tohoto zpomalení jde o „náhlou změnu rychlosti“
  const KOMFORT = 2.6;             // běžné plánované brzdění NPC
  const VMAX_NPC = 12.5;           // 45 km/h – pod limitem v obou státech
  const BARVY = ['#d94b3d', '#3d7dd9', '#e2b93b', '#4caf6a', '#8e5bd1', '#e07b39', '#5fb6c9', '#ffffff'];   // = sprity aut

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function vytvor(svet, opt = {}) {
    const sim = {
      svet, profil: svet.profil, cas: 0, auta: [], chodci: [], hrac: null,
      prestupky: [], zpravy: [], dalsiId: 1, nahoda: mulberry(opt.seed || 1),
      konec: null, autopilot: !!opt.autopilot, zly: !!opt.zly, srazkyNpc: 0, _klice: new Map(),
      plneni: opt.plneni || null,          // volná jízda: { aut: 8, chodcu: 4 }
      ukoly: (opt.ukoly || []).map(u => ({ ...u, hotovo: false })),
    };
    return sim;
  }

  /* ---------- auta ---------- */

  function nahodnyVyjezd(sim, t, a) {
    const moz = t.ramena.filter(k => k !== a);
    if (!moz.length) return a;
    return moz[Math.floor(sim.nahoda() * moz.length)];
  }

  function doplnFrontu(sim, auto) {
    while (auto.fronta.length < 2) {
      const last = auto.fronta.length ? auto.fronta[auto.fronta.length - 1] : { t: auto.t, b: auto.b };
      if (last.ven) return;
      const n = last.t ? sim.svet.soused(last.t, last.b) : null;
      if (!n) { auto.fronta.push({ ven: true }); continue; }
      const a = (last.b + 2) % 4;
      let b;
      if (!n.box) b = n.ramena.find(k => k !== a) ?? a;
      else if (auto.plan && auto.plan.length) b = auto.plan.shift();
      else b = nahodnyVyjezd(sim, n, a);
      auto.fronta.push({ t: n, a, b });
    }
  }

  // plan = pole ramen výjezdu pro dlaždice počínaje tou startovní (pak náhodně).
  function pridejAuto(sim, { tile, vjezd, plan, s = 0, v = VMAX_NPC * 0.8, barva, vmax = VMAX_NPC, hrac = false, nazev }) {
    const t = typeof tile === 'string' ? sim.svet.dl.get(tile) : tile;
    const p = plan ? plan.slice() : null;
    const b = !t.box ? (t.ramena.find(k => k !== vjezd) ?? vjezd) : p && p.length ? p.shift() : nahodnyVyjezd(sim, t, vjezd);
    const auto = {
      id: hrac ? 0 : sim.dalsiId++, npc: !hrac, hrac, nazev,
      t, a: vjezd, b, c: sim.svet.cesta(t, vjezd, b), s, v, vmax,
      fronta: [], plan: p, barva: barva || BARVY[Math.floor(sim.nahoda() * BARVY.length)],
      stojiDo: arguments[1].stojiDo, blinkr: 'zadny', brzdi: false, zastavilU: null, cekaOd: null, svetlo: null, a_: 0,
    };
    doplnFrontu(sim, auto);
    const pol = SV.polohaNa(auto.c, s);
    auto.x = pol.x; auto.y = pol.y; auto.uhel = pol.uhel;
    if (hrac) sim.hrac = auto; else sim.auta.push(auto);
    return auto;
  }

  // Body před autem po jeho dráze (krok 1 m) – pro hledání překážek.
  function bodyPred(sim, auto, delka) {
    const out = [];
    let c = auto.c, s = auto.s, fi = 0;
    for (let d = 1.2; d <= delka; d += 1) {
      let sx = s + d;
      while (sx > c.delka) {
        const n = auto.fronta[fi];
        if (!n || n.ven) return out;
        sx -= c.delka; s -= c.delka; c = sim.svet.cesta(n.t, n.a, n.b); fi++;
      }
      const p = SV.polohaNa(c, sx);
      out.push({ d, x: p.x, y: p.y });
    }
    return out;
  }

  const kruhyAuta = o => {
    const cx = Math.cos(o.uhel), cy = Math.sin(o.uhel);
    return [[o.x, o.y], [o.x + cx * 1.5, o.y + cy * 1.5], [o.x - cx * 1.5, o.y - cy * 1.5]];
  };

  // Nejbližší překážka na dráze auta: { d, kdo }.
  function prekazkaNaDraze(sim, auto) {
    const delka = Math.min(48, 10 + auto.v * auto.v / (2 * KOMFORT) + auto.v * 1.2);
    const body = bodyPred(sim, auto, delka);
    let nej = { d: Infinity, kdo: null };
    const ostatni = sim.auta.filter(o => o !== auto);
    if (sim.hrac && sim.hrac !== auto) ostatni.push(sim.hrac);
    for (const o of ostatni) {
      if (Math.hypot(o.x - auto.x, o.y - auto.y) > delka + 6) continue;
      const kr = kruhyAuta(o);
      for (const b of body) {
        if (b.d >= nej.d) break;
        if (kr.some(k => Math.hypot(k[0] - b.x, k[1] - b.y) < 2.1)) { nej = { d: Math.max(b.d, 2.4), kdo: o }; break; }
      }
    }
    for (const ch of sim.chodci) {
      if (ch.stav !== 'na_prechodu') continue;
      for (const b of body) {
        if (b.d >= nej.d) break;
        if (Math.hypot(ch.x - b.x, ch.y - b.y) < 1.9) { nej = { d: b.d, kdo: ch }; break; }
      }
    }
    return nej;
  }

  // Nejbližší křižovatka (box) před autem nebo ta, ve které je.
  function dalsiBox(sim, auto) {
    const c = auto.c;
    if (auto.t.box && c.sVstup != null) {
      // Na kruháči je auto „uvnitř“ až na prstenci objezdu (dřív může ještě zastavit a dát přednost).
      const sUvnitr = auto.t.typ === 'kruhac' ? c.kumul[2] - 0.5 : c.sVstup;
      if (auto.s < sUvnitr) return { t: auto.t, a: auto.a, b: auto.b, c, dCara: c.sCara - auto.s, uvnitr: false };
      if (auto.s <= c.sVystup) return { t: auto.t, a: auto.a, b: auto.b, c, dCara: 0, uvnitr: true };
    }
    const n = auto.fronta[0];
    if (n && !n.ven && n.t.box) {
      const c2 = sim.svet.cesta(n.t, n.a, n.b);
      return { t: n.t, a: n.a, b: n.b, c: c2, dCara: (c.delka - auto.s) + c2.sCara, uvnitr: false };
    }
    return null;
  }

  // Vztah vozidla o ke křižovatce box: { stav: 'pred'|'v', d, a, b, moznosti }
  function vztah(sim, o, box) {
    if (!o.t || o.a == null || !o.c) return null;
    const moznosti = o.moznosti || [o.b];
    if (o.t === box) {
      const c = o.c;
      if (c.sVstup == null) return null;
      if (o.s < c.sVstup) return { stav: 'pred', d: c.sCara - o.s, a: o.a, b: o.b, moznosti };
      if (o.s <= c.sVystup) return { stav: 'v', d: 0, a: o.a, b: o.b, moznosti: [o.b] };
      return null;
    }
    const n = o.fronta && o.fronta[0];
    if (n && !n.ven && n.t === box) {
      const c2 = sim.svet.cesta(box, n.a, n.b);
      return { stav: 'pred', d: (o.c.delka - o.s) + c2.sCara, a: n.a, b: n.b, moznosti: n.moznosti || [n.b] };
    }
    // o dlaždici dál (rychlé auto za zatáčkou – při 45 km/h je to ~5 s)
    const n2 = o.fronta && o.fronta[1];
    if (n && !n.ven && !n.t.box && n2 && !n2.ven && n2.t === box) {
      const c1 = sim.svet.cesta(n.t, n.a, n.b), c2 = sim.svet.cesta(box, n2.a, n2.b);
      return { stav: 'pred', d: (o.c.delka - o.s) + c1.delka + c2.sCara, a: n2.a, b: n2.b, moznosti: n2.moznosti || [n2.b] };
    }
    return null;
  }

  function svetloPro(sim, t, a, b) {
    if (!t.semafor) return null;
    const barva = sim.svet.barva(t, a, sim.cas);
    if (barva === 'zelena') return 'plna';
    if (sim.svet.sipkaSviti(t, a, sim.cas) && sim.svet.keKrajnici(a, b)) return 'doplnkova';
    return null;
  }

  // Kde musí auto zastavit kvůli pravidlům na nejbližší křižovatce. Vrací { d, duvod, blokuje }.
  function pravidlaKrizovatky(sim, auto) {
    const box = dalsiBox(sim, auto);
    auto.box = box;
    if (box && box.uvnitr) { auto.cekaNa = null; return cekaniVKrizovatce(sim, auto, box); }
    if (!box || box.dCara > 50) { auto.cekaNa = null; return null; }
    auto.opatrne = null;
    const zaCarou = box.dCara - PRID < -0.3;                 // příď už je za čarou
    if (zaCarou && auto.v > 3) { auto.cekaNa = null; return null; }   // už nezastaví – projede
    const P = sim.profil, t = box.t;
    const ja = { vjezd: box.a, vyjezd: box.b };
    const stuj = (duvod, blokuje) => ({ d: box.dCara - PRID, duvod, blokuje });   // příď zastaví u čáry
    auto.svetlo = null; auto.cekaNa = null;

    // Semafor (kdo je přídí za čarou, je už v křižovatce a světlo ho nezastaví – ostatní s ním musí počítat jako s jedoucím)
    if (t.semafor && zaCarou) { auto.svetlo = 'plna'; ja.svetlo = 'plna'; }
    if (t.semafor && !zaCarou) {
      const barva = sim.svet.barva(t, box.a, sim.cas);
      const sipka = sim.svet.sipkaSviti(t, box.a, sim.cas) && sim.svet.keKrajnici(box.a, box.b);
      if (!auto.zlutaRozhodnuto || auto.zlutaRozhodnuto.klic !== t.klic + box.a) {
        if (barva === 'zluta') auto.zlutaRozhodnuto = { klic: t.klic + box.a, smi: J.smiNaSvetlo(P, 'zluta', { v: auto.v, vzdalenost: box.dCara - PRID }).smi };
      }
      const zlutaSmi = barva === 'zluta' && auto.zlutaRozhodnuto && auto.zlutaRozhodnuto.smi;
      if (!(barva === 'zelena' || sipka || zlutaSmi)) return stuj('svetlo');
      ja.svetlo = barva === 'zelena' || zlutaSmi ? 'plna' : 'doplnkova';
      auto.svetlo = ja.svetlo;
    }

    // STOP: úplně zastavit u čáry
    if (t.rizeni[box.a] === 'stop' && auto.zastavilU !== t.klic + ':' + box.a) {
      if (auto.v < 0.05 && box.dCara - PRID < 2) auto.zastavilU = t.klic + ':' + box.a;
      else return stuj('stop');
    }

    // Přednost
    const blokuje = [];
    const ostatni = sim.auta.filter(o => o !== auto);
    if (sim.hrac && sim.hrac !== auto) ostatni.push(sim.hrac);
    const mojeEta = box.dCara / Math.max(auto.v, 1);
    for (const o of ostatni) {
      const r = vztah(sim, o, t);
      if (!r || r.a === box.a) continue;
      if (t.typ === 'kruhac') {
        if (r.stav === 'v' && naObjezduPredeMnou(sim, t, o, box.a, box.b)) blokuje.push(o);
        // auto těsně před jiným vjezdem, které hned vjede a pojede kolem mého vjezdu (zabránit „současnému vjezdu“)
        else if (r.stav === 'pred' && r.d < PRID + 9 && o.v > 1.5 && vjedePredeMne(sim, r.a, r.b, box.a) && (box.dCara - PRID) > -0.3) blokuje.push(o);
        continue;
      }
      if (t.semafor) {
        const sv = o.npc || sim.autopilot ? (r.stav === 'v' ? 'plna' : o.svetlo) : svetloPro(sim, t, r.a, r.b);
        if (!sv && r.stav === 'pred') continue;          // má červenou – nejede
      }
      const onSvetlo = t.semafor ? (svetloPro(sim, t, r.a, r.b) || 'plna') : undefined;
      let musim = false;
      for (const b of r.moznosti) {
        const on = { vjezd: r.a, vyjezd: b, svetlo: onSvetlo };
        if (!J.stret(P.strana, ja, on)) continue;
        if (r.stav === 'v') {
          // Ve křižovatce: počkám, pokud nečeká on na mě – a jen dokud nemine místo, kde se naše dráhy kříží.
          const p = J.prednost(P, t, ja, on);
          const st = bodStretu(sim.svet, t, box.a, box.b, r.a, b);
          if (st && o.s > st.s2 + 3.2) continue;                       // už minul místo střetu
          // Odbočuje přes protisměr, musí mi dát přednost a je ještě v pásmu, kde smí čekat (nevjel mi do dráhy) → nečekám.
          // Kdo čekací pásmo opustil, už projíždí – na toho se čeká.
          const oCeka = t.typ === 'krizovatka' && o.t === t && J.presProtismer(P, r.a, b) && o.s <= o.c.sVstup + CEKACI + 0.4;
          if (p.kdo === 'ja' && oCeka && (!st || o.s + PRID < st.s2 - 1.0)) continue;
          musim = true;
          continue;
        }
        const p = J.prednost(P, t, ja, on);
        const cekaU = r.d < PRID + 4 && o.v < 0.5;
        // Odhad příjezdu: zrychlující auto počítáme aspoň 7 m/s, jinak jeho skutečnou rychlostí (min. 2 m/s).
        const etaO = r.d / Math.max(o.v, (o.a_ || 0) > 0.3 ? 7 : 2);
        // Kolik času potřebuju já na projetí: z místa rozjezd ~3,6 s, za jízdy délka křižovatky / rychlost; + rezerva.
        const projeti = auto.v < 2 ? 3.6 + Math.max(0, box.dCara - PRID) / 4 : (box.dCara + 2 * J.OKRAJ + 4) / Math.max(auto.v, 4);
        if (p.kdo === 'on' && (etaO < projeti + 1.3 || cekaU)) musim = true;
        // Nikdo nemá přednost: jede ten, kdo k čáře přijel dřív; při remíze nižší id (hráč má 0).
        // Kdo už stojí u čáry, nevyjede jen před autem, které by muselo prudce brzdit (eta < 3 s).
        if (p.kdo === 'nikdo') {
          const jaCekam = box.dCara - PRID < 4 && auto.v < 0.5;
          if (cekaU && jaCekam) {
            const jeho = (o.cekaOd ?? o.stojiOd) ?? sim.cas, moje = auto.cekaOd == null ? sim.cas : auto.cekaOd;
            if (jeho < moje - 0.05 || (Math.abs(jeho - moje) <= 0.05 && o.id < auto.id)) musim = true;
          } else if (jaCekam) { if (etaO < 3) musim = true; }
          else if (cekaU) {
            // on už stojí u čáry; já jedu – zastavím jen, když to jde pohodlně, jinak projedu (on mě pustí)
            const dZast = Math.max(0.1, box.dCara - PRID);
            if (auto.v * auto.v / (2 * dZast) < KOMFORT) musim = true;
          }
          else if (etaO < mojeEta - 0.3 || (Math.abs(etaO - mojeEta) <= 0.3 && o.id < auto.id)) musim = true;
        }
      }
      if (musim && r.stav === 'pred' && o.v < 0.3 && r.d < PRID + 4) {
        // Hráč s předností stojí u čáry a nejede (> 1,2 s) → bere se jako „pouští mě“, jako by mávl.
        if (o.hrac && o.stojiOd != null && sim.cas - o.stojiOd > 1.2) { musim = false; auto.opatrne = t.klic; }
        // Kruh čekání (každý čeká na dalšího, např. 4 auta podle pravé ruky): jede auto s nejnižším id v kruhu.
        else if (!o.hrac) {
          const kruh = kruhCekani(o, auto);
          if (kruh && auto.id < Math.min(...kruh.map(x => x.id))) musim = false;
        }
      }
      if (musim) blokuje.push(o);
    }
    if (blokuje.length) {
      // Pojistka: všichni stojí přes 2,5 s a nikdo nejede → pokračuje auto s nejnižším id.
      const dlouho = auto.cekaOd != null && sim.cas - auto.cekaOd > 2.5;
      if (dlouho && auto.v < 0.2 && blokuje.every(o => o.v < 0.2 && (vztah(sim, o, t) || {}).stav !== 'v' && (o.hrac || o.id > auto.id))) {
        auto.cekaNa = null;
        return null;
      }
      auto.cekaNa = blokuje;
      return stuj('prednost', blokuje);
    }
    auto.cekaNa = null;
    return null;
  }

  // Kde se kříží dráhy (a1→b1) a (a2→b2) na dlaždici t: { s1, s2 } = vzdálenosti od začátku dráhy; při sjíždění
  // do stejného výjezdu bod sjetí. Výsledek v mezipaměti světa.
  function bodStretu(svet, t, a1, b1, a2, b2) {
    const k = t.klic + ':' + a1 + b1 + a2 + b2;
    svet._strety = svet._strety || new Map();
    if (svet._strety.has(k)) return svet._strety.get(k);
    const c1 = svet.cesta(t, a1, b1), c2 = svet.cesta(t, a2, b2);
    let vysl = null;
    for (let i = 1; i < c1.body.length && !vysl; i++) {
      for (let j = 1; j < c2.body.length; j++) {
        const x = prusecikUsecek(c1.body[i - 1], c1.body[i], c2.body[j - 1], c2.body[j]);
        if (x) { vysl = { s1: c1.kumul[i - 1] + x[0] * (c1.kumul[i] - c1.kumul[i - 1]), s2: c2.kumul[j - 1] + x[1] * (c2.kumul[j] - c2.kumul[j - 1]) }; break; }
      }
    }
    if (!vysl && b1 === b2) vysl = { s1: c1.sVystup, s2: c2.sVystup };
    svet._strety.set(k, vysl);
    return vysl;
  }
  function prusecikUsecek(p1, p2, p3, p4) {
    const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1], d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
    const det = d1x * d2y - d1y * d2x;
    if (Math.abs(det) < 1e-9) return null;
    const u = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / det;
    const w = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / det;
    return u >= 0 && u <= 1 && w >= 0 && w <= 1 ? [u, w] : null;
  }

  // Vede řetěz „kdo na koho čeká“ od o zpět ke mně? Vrátí auta v kruhu (bez mě), jinak null.
  function kruhCekani(o, ja) {
    const cesta = [], navst = new Set();
    const hledej = (x, hl) => {
      if (x === ja) return true;
      if (hl > 5 || navst.has(x) || !x.cekaNa || x.v > 0.3) return false;
      navst.add(x); cesta.push(x);
      for (const y of x.cekaNa) if (hledej(y, hl + 1)) return true;
      cesta.pop();
      return false;
    };
    return hledej(o, 0) ? cesta : null;
  }

  // Odbočení přes protisměr: uvnitř křižovatky počkej před protisměrným pruhem (ČR § 22/3 to výslovně dovoluje).
  const CEKACI = 2.2;      // metrů za hranicí křižovatky
  function cekaniVKrizovatce(sim, auto, box) {
    const P = sim.profil, t = box.t;
    if (t.typ !== 'krizovatka' || !J.presProtismer(P, box.a, box.b)) return null;
    const sW = box.c.sVstup + CEKACI;
    if (auto.s > sW + 0.4) return null;                       // už je v protisměru – dokončí odbočení
    const proti = (box.a + 2) % 4;
    const ostatni = sim.auta.filter(o => o !== auto);
    if (sim.hrac && sim.hrac !== auto) ostatni.push(sim.hrac);
    for (const o of ostatni) {
      const r = vztah(sim, o, t);
      if (!r || r.a !== proti) continue;
      if (t.semafor && r.stav === 'pred' && !(o.npc || sim.autopilot ? o.svetlo : svetloPro(sim, t, r.a, r.b))) continue;
      const jedeDo = r.moznosti.some(b => J.stret(P.strana, { vjezd: box.a, vyjezd: box.b }, { vjezd: r.a, vyjezd: b }));
      if (!jedeDo) continue;
      const cekaU = r.stav === 'pred' && r.d < PRID + 4 && o.v < 0.5;
      const eta = r.stav === 'v' ? 0 : r.d / Math.max(o.v, cekaU ? 1 : 6);
      if ((r.stav === 'v' && o.v > 0.3) || (r.stav === 'pred' && !cekaU && eta < 4.5)) {
        auto.cekaNa = [o];
        return { d: sW - auto.s, duvod: 'prednost', blokuje: [o] };
      }
    }
    return null;
  }

  // Chodci na přechodech před autem (zebra: čeká i přechází; místo pro přecházení: jen při odbočení).
  // Vrací vzdálenost, kde zastavit, nebo Infinity.
  function chodciPred(sim, auto) {
    const P = sim.profil;
    let nej = Infinity;
    const useky = [{ c: auto.c, zacatek: -auto.s }];
    const n = auto.fronta[0];
    if (n && !n.ven) useky.push({ c: sim.svet.cesta(n.t, n.a, n.b), zacatek: auto.c.delka - auto.s });
    for (const { c, zacatek } of useky) {
      for (const pr of c.prechody) {
        const d = zacatek + pr.s;                      // vzdálenost středu auta k přechodu
        if (d < 2.6 || d > 45) continue;
        const p = pr.p;
        const chodci = sim.chodci.filter(ch => ch.p === p && (ch.stav === 'na_prechodu' || ch.stav === 'ceka'));
        if (!chodci.length) continue;
        let musi = false;
        if (p.typ === 'zebra') musi = true;
        else if (J.manevr(c.a, c.b) !== 'rovne' && (p.rameno === c.b || (P.id === 'uk' && p.rameno === c.a)))
          musi = chodci.some(ch => ch.stav === 'na_prechodu' || P.id === 'uk');
        if (musi) nej = Math.min(nej, d - 3.2);
      }
    }
    return nej;
  }

  function prechodyPred(sim, auto) {
    const out = [];
    for (const pr of auto.c.prechody) out.push(pr.s - auto.s);
    const n = auto.fronta[0];
    if (n && !n.ven) for (const pr of sim.svet.cesta(n.t, n.a, n.b).prechody) out.push(auto.c.delka - auto.s + pr.s);
    return out.filter(x => x > 0);
  }

  // Jede vozidlo o po objezdu tak, že projede kolem mého vjezdu dřív, než vyjede?
  function naObjezduPredeMnou(sim, t, o, a, b) {
    const P = sim.profil;
    const smer = P.strana > 0 ? -1 : 1;
    const uhelO = Math.atan2(o.y - t.cy, o.x - t.cx);
    const fIn = SV.uhelRamene(a) + smer * 0.45;                   // místo, kde se můj vjezd napojí na objezd
    let k = ((fIn - uhelO) * smer) % (2 * Math.PI);
    if (k < 0) k += 2 * Math.PI;
    if (k > 2 * Math.PI - 0.5) return true;                        // je právě v místě napojení
    const dO = k * SV.KR.stopa;
    if (dO > 30) return false;                                     // je daleko (rozjezd ze stání trvá)
    // Vyjede dřív?
    const fOut = SV.uhelRamene(o.b) - smer * 0.45;
    let kv = ((fOut - uhelO) * smer) % (2 * Math.PI);
    if (kv < 0) kv += 2 * Math.PI;
    return !(kv < k);
  }

  // Auto vjíždějící z ramene aO s výjezdem bO: projede po objezdu kolem místa, kde se napojuje můj vjezd a?
  function vjedePredeMne(sim, aO, bO, a) {
    const smer = sim.profil.strana > 0 ? -1 : 1, pi2 = 2 * Math.PI;
    const fInO = SV.uhelRamene(aO) + smer * 0.45, fIn = SV.uhelRamene(a) + smer * 0.45, fOutO = SV.uhelRamene(bO) - smer * 0.45;
    const k = (((fIn - fInO) * smer) % pi2 + pi2) % pi2, kv = (((fOutO - fInO) * smer) % pi2 + pi2) % pi2;
    return kv > k && k * SV.KR.stopa < 25;
  }

  // Řízení NPC (a hráče na autopilota): zrychlení podle překážek a pravidel.
  function rizeniAuta(sim, auto, dt) {
    let vCil = auto.vmax;
    // Zatáčky: rychlost podle zakřivení dráhy před autem
    const pred = bodyPred(sim, auto, 16);
    if (pred.length > 6) {
      const u1 = Math.atan2(pred[3].y - pred[0].y, pred[3].x - pred[0].x);
      const u2 = Math.atan2(pred[pred.length - 1].y - pred[pred.length - 4].y, pred[pred.length - 1].x - pred[pred.length - 4].x);
      let du = Math.abs(u2 - u1); if (du > Math.PI) du = 2 * Math.PI - du;
      if (du > 0.25) vCil = Math.min(vCil, Math.max(5.5, 12.5 - du * 6));
    }
    if (auto.t.typ === 'kruhac') vCil = Math.min(vCil, 7);
    const bx = dalsiBox(sim, auto);
    if (bx && bx.t.typ === 'kruhac' && !bx.uvnitr && bx.dCara < 30) vCil = Math.min(vCil, 5.5 + bx.dCara * 0.25);
    // pouští mě někdo s předností → do křižovatky opatrně (kdyby se přece jen rozjel)
    if (bx && auto.opatrne === bx.t.klic && !bx.uvnitr && bx.dCara < 25) vCil = Math.min(vCil, 4 + bx.dCara * 0.2);
    if (auto.stojiDo != null && sim.cas < auto.stojiDo) vCil = 0;

    let d = Infinity, pricina = null;
    const pr = sim.zly && auto.hrac ? null : pravidlaKrizovatky(sim, auto);
    if (pr) { d = pr.d; pricina = pr; }
    if (!(sim.zly && auto.hrac)) {
      const dCh = chodciPred(sim, auto);
      if (dCh < d) { d = dCh; pricina = { duvod: 'chodec' }; }
    }
    const ob = prekazkaNaDraze(sim, auto);
    const odstup = ob.kdo && ob.kdo.stav ? 3 : 6.2;
    if (ob.kdo && ob.d - odstup < d) {
      d = ob.d - odstup; pricina = { duvod: 'prekazka', kdo: ob.kdo };
      // Ve frontě nezastavovat na přechodu – raději před ním.
      if (!ob.kdo.stav) for (const dc of prechodyPred(sim, auto)) if (d > dc - 3.2 && d < dc + 3.2 && dc - 3.2 > 0.2) d = dc - 3.2;
    }

    let a;
    if (d < Infinity) {
      const dd = Math.max(d, 0.05);
      const potreba = auto.v * auto.v / (2 * dd);
      if (d <= 0.15) a = -Math.min(9, auto.v / dt);
      else if (potreba > 0.6 * KOMFORT) a = -Math.min(9, potreba);
      else a = Math.min(A_NPC, (Math.min(vCil, Math.sqrt(2 * KOMFORT * dd)) - auto.v) * 1.3);
    } else a = Math.min(A_NPC, (vCil - auto.v) * 1.3);
    if (auto.v > vCil + 0.5 && (!pricina || a > -2)) a = Math.min(a, -2);
    auto.a_ = a; auto.pricina = pricina;
    auto.brzdi = a < -0.8;
    if (auto.v < 0.2 && pricina) { if (auto.cekaOd == null) auto.cekaOd = sim.cas; }
    else if (auto.v > 1) auto.cekaOd = null;
    // Náhlé brzdění kvůli hráči → rozhodčí
    const kvuliHraci = pricina && ((pricina.duvod === 'prekazka' && pricina.kdo === sim.hrac) || (pricina.duvod === 'prednost' && pricina.blokuje && pricina.blokuje.includes(sim.hrac)));
    if (a < -NAHLE && kvuliHraci && auto.npc && auto.v > 2) nahleBrzdeni(sim, auto);
    return a;
  }

  function posunPoDraze(sim, auto, ds) {
    auto.s += ds;
    while (auto.s >= auto.c.delka) {
      const n = auto.fronta.shift();
      if (!n || n.ven) { auto.pryc = true; return; }
      auto.s -= auto.c.delka;
      auto.opustil = { t: auto.t, b: auto.b };
      auto.t = n.t; auto.a = n.a; auto.b = n.b; auto.c = sim.svet.cesta(n.t, n.a, n.b);
      auto.zlutaRozhodnuto = null;
      doplnFrontu(sim, auto);
    }
    const p = SV.polohaNa(auto.c, auto.s);
    auto.x = p.x; auto.y = p.y; auto.uhel = p.uhel;
  }

  // Blinkr vzorného řidiče podle předpisu státu.
  function blinkrVzorny(sim, auto) {
    const box = auto.box;
    if (!box || box.dCara > 35) return 'zadny';
    const t = box.t;
    if (t.typ === 'kruhac') {
      const vKruhu = auto.t === t && auto.s >= box.c.sVstup;
      const faze = !vKruhu ? 'prijezd' : (auto.s >= box.c.sPredVyjezdem ? 'pred_vyjezdem' : 'na_objezdu');
      return J.blinkrKruhac(sim.profil, box.a, box.b, faze).blinkr;
    }
    return J.blinkrOdboceni(sim.profil, box.a, box.b).blinkr;
  }

  /* ---------- hráč ---------- */

  // Fyzika (model kola). vstup = { plyn, brzda, vlevo, vpravo } (0..1)
  function fyzikaHrace(sim, h, vstup, dt) {
    const naSil = SV.naSilnici(sim.svet, h.x, h.y);
    let a = 0;
    // h.aPlyn / h.aBrzda = nastavitelný rozjezd a brzdy (m/s²)
    if (vstup.plyn) a += (h.aPlyn || A_PLYN) * vstup.plyn * (h.v < 14 ? 1 : 0.6);
    if (vstup.brzda) a += h.v > 0.1 ? -(h.aBrzda || A_BRZDA) * vstup.brzda : (h.v > -3 ? -1.5 : 0);
    a += -0.04 * h.v - (h.v > 0 ? 0.25 : h.v < 0 ? -0.25 : 0) * (vstup.plyn ? 0 : 1);
    if (!naSil && Math.abs(h.v) > 4) a += -5 * Math.sign(h.v);
    const vPred = h.v;
    h.v += a * dt;
    if (!vstup.plyn && vPred > 0 && h.v < 0 && !(vstup.brzda && vPred < 0.15)) h.v = 0;
    if (!vstup.plyn && !vstup.brzda && Math.abs(h.v) < 0.15) h.v = 0;
    h.v = Math.max(-3.5, Math.min(22, h.v));
    const dMax = 0.62 / (1 + Math.abs(h.v) / 9);
    const cil = ((vstup.vpravo || 0) - (vstup.vlevo || 0)) * dMax;
    h.volant = (h.volant || 0) + (cil - (h.volant || 0)) * Math.min(1, dt * 7);
    const du = h.v / AUTO.rozvor * Math.tan(h.volant) * dt;
    h.uhel += du;
    const nx = h.x + Math.cos(h.uhel) * h.v * dt, ny = h.y + Math.sin(h.uhel) * h.v * dt;
    // do moře se nevjede (příď i záď)
    const pr = Math.sign(h.v || 1) * 2.3;
    if (sim.svet.znak(nx + Math.cos(h.uhel) * pr, ny + Math.sin(h.uhel) * pr) === '~' && !SV.naSilnici(sim.svet, nx, ny)) {
      h.v = 0;
      if (!sim._vodaZprava || sim.cas - sim._vodaZprava > 4) { sim._vodaZprava = sim.cas; sim.zpravy.push({ cas: sim.cas, typ: 'ok', text: 'Tady už je moře – otoč se.' }); }
    } else { h.x = nx; h.y = ny; }
    h.a_ = a; h.brzdi = !!vstup.brzda && h.v > 0.1;
    // Samovypínání blinkru po odbočení (jako ve skutečném autě)
    if (h.blinkr !== 'zadny') {
      const smer = h.blinkr === 'vpravo' ? 1 : -1;
      h.otoceni = (h.otoceni || 0) + du * smer;
      if (h.otoceni > 0.9 && Math.abs(h.volant) < 0.05) { h.blinkr = 'zadny'; h.otoceni = 0; }
    } else h.otoceni = 0;
  }

  // Logická poloha hráče (dlaždice, vjezd, předpokládaný výjezd, dráha, s) – podle ní ho vidí NPC i rozhodčí.
  function predikce(sim, h) {
    const t = sim.svet.naPozici(h.x, h.y);
    const P = sim.profil;
    if (t !== h.t) {
      const stara = h.t;
      h.predchozi = stara;
      let vjezd = null;
      if (stara && t) {
        for (let k = 0; k < 4; k++) if (stara.x + D[k][0] === t.x && stara.y + D[k][1] === t.y) { vjezd = (k + 2) % 4; h.opustil = { t: stara, b: k }; }
      }
      h.t = t; h.a = vjezd;
      h.vBoxu = false;
      if (vjezd == null || !t || !t.ramena.includes(vjezd)) { h.a = t ? nejblizsiRameno(t, h) : null; }
    }
    if (!t || h.a == null) { h.c = null; h.moznosti = null; h.fronta = []; return; }
    // Možné výjezdy
    const ostatni = t.ramena.filter(k => k !== h.a);
    let moz;
    if (!ostatni.length) moz = [h.a];
    else if (!t.box) moz = ostatni;
    else if (t.typ === 'kruhac') {
      moz = ostatni;
      const r = Math.hypot(h.x - t.cx, h.y - t.cy);
      const vRameni = ramenoPolohy(t, h, SV.KR.okraj);
      if (vRameni != null && vRameni !== h.a) moz = [vRameni];
      else if (r < SV.KR.okraj) moz = [ramenoNaKruhu(sim, t, h)];
    } else {
      const r = Math.max(Math.abs(h.x - t.cx), Math.abs(h.y - t.cy));
      const vRameni = ramenoPolohy(t, h, J.OKRAJ);
      if (vRameni != null && vRameni !== h.a) moz = [vRameni];
      else if (r < J.OKRAJ + 0.5) moz = [kamMiri(t, h, ostatni)];
      else {
        const chce = h.blinkr === 'zadny' ? 'rovne' : h.blinkr;
        const shoda = ostatni.filter(k => J.manevr(h.a, k) === chce);
        moz = shoda.length ? shoda : ostatni;
      }
    }
    // moznosti = co z blinkru a polohy vyčtou ostatní; b = kudy hráč skutečně chce (záměr z navigace/situace)
    h.moznosti = moz;
    const zamer = h.zamer ? h.zamer(t) : null;
    const vRameni = t.box ? ramenoPolohy(t, h, t.typ === 'kruhac' ? SV.KR.okraj : J.OKRAJ) : null;
    const urceno = vRameni != null && vRameni !== h.a;          // už vjel do výjezdového ramene
    h.b = !urceno && zamer != null && ostatni.includes(zamer) ? zamer : moz[0];
    h.c = sim.svet.cesta(t, h.a, h.b);
    const pr = SV.promitni(h.c, h.x, h.y);
    h.s = pr.s;
    // Další dlaždice (pro křižovatku za touto)
    const n = sim.svet.soused(t, h.b);
    if (n) {
      const a2 = (h.b + 2) % 4;
      let oth = n.ramena.filter(k => k !== a2);
      if (!oth.length) oth = [a2];                         // slepá ulice: otočení
      const chce = h.blinkr === 'zadny' ? 'rovne' : h.blinkr;
      const shoda = oth.filter(k => J.manevr(a2, k) === chce);
      const m2 = n.box ? (shoda.length ? shoda : oth) : oth;
      const z2 = h.zamer ? h.zamer(n) : null;
      h.fronta = [{ t: n, a: a2, b: z2 != null && oth.includes(z2) ? z2 : m2[0], moznosti: m2 }];
    } else h.fronta = [{ ven: true }];
    void P;
  }

  // Rameno, ve kterém hráč je (za hranicí křižovatky), jinak null.
  function ramenoPolohy(t, h, okraj) {
    const lx = h.x - t.cx, ly = h.y - t.cy;
    for (const k of t.ramena) if (lx * D[k][0] + ly * D[k][1] > okraj + 0.3 && Math.abs(D[k][0] * ly - D[k][1] * lx) < J.PRUH + 1.5) return k;
    return null;
  }

  // Hráč na objezdu: bliká na výjezd (ČR vpravo, UK vlevo) → nejbližší rameno před ním, jinak jede dál (poslední před vjezdem).
  function ramenoNaKruhu(sim, t, h) {
    const smer = sim.profil.strana > 0 ? -1 : 1;
    const uhel = Math.atan2(h.y - t.cy, h.x - t.cx);
    const vzd = k => { let d = ((SV.uhelRamene(k) - uhel) * smer) % (2 * Math.PI); return d < 0.2 ? d + 2 * Math.PI : d; };
    const kandidati = t.ramena.filter(k => k !== h.a || t.ramena.length === 1).sort((x, y) => vzd(x) - vzd(y));
    const vyjizdi = h.blinkr === (sim.profil.strana > 0 ? 'vpravo' : 'vlevo');
    return vyjizdi ? kandidati[0] : kandidati[kandidati.length - 1];
  }

  function nejblizsiRameno(t, h) {
    let nej = t.ramena[0], m = -Infinity;
    for (const k of t.ramena) {
      const sc = -(Math.cos(h.uhel) * D[k][0] + Math.sin(h.uhel) * D[k][1]);   // jedu proti směru ramene = vjíždím z něj
      if (sc > m) { m = sc; nej = k; }
    }
    return nej;
  }
  function kamMiri(t, h, ramena) {
    let nej = ramena[0], m = -Infinity;
    const hx = Math.cos(h.uhel), hy = Math.sin(h.uhel);
    for (const k of ramena) {
      const px = t.cx + D[k][0] * 15 - h.x, py = t.cy + D[k][1] * 15 - h.y, L = Math.hypot(px, py) || 1;
      const sc = (px * hx + py * hy) / L + 0.6 * (hx * D[k][0] + hy * D[k][1]);
      if (sc > m) { m = sc; nej = k; }
    }
    return nej;
  }

  /* ---------- rozhodčí ---------- */

  const TITULKY = {
    prednost: 'Nedání přednosti', svetlo: 'Jízda na červenou', stop: 'Nezastavil jsi na STOP', blinkr: 'Blinkr',
    rychlost: 'Rychlost', chodec: 'Chodec', strana: 'Jízda v protisměru', smer: 'Špatný směr na kruhovém objezdu',
    zaplnena: 'Zaplněná křižovatka', srazka: 'Srážka',
  };

  function prestupek(sim, kod, info, klic) {
    const prubezne = kod === 'rychlost' || kod === 'strana' || kod === 'smer';
    const k = klic || (prubezne ? kod : kod + ':' + (sim.hrac && sim.hrac.t ? sim.hrac.t.klic : ''));
    if (sim._klice.has(k) && sim.cas - sim._klice.get(k) < 4) return;
    sim._klice.set(k, sim.cas);
    const body = kod === 'srazka' ? 10 : info.zavaznost === 'doporuceni' ? 1 : 3;
    const z = { cas: sim.cas, kod, titulek: TITULKY[kod], citace: info.citace, text: info.text, zavaznost: info.zavaznost || 'povinnost', body, predpis: sim.profil.predpis };
    sim.prestupky.push(z);
    sim.zpravy.push({ ...z, typ: 'chyba' });
  }
  function pochvala(sim, text) { sim.zpravy.push({ cas: sim.cas, typ: 'ok', text }); }

  function nahleBrzdeni(sim, auto) {
    const h = sim.hrac;
    const box = auto.box;
    if (!box) return;
    const t = box.t, P = sim.profil;
    const r = vztah(sim, h, t);
    if (!r) return;
    if (r.stav === 'pred' && Math.abs(h.v) < 0.3) return;          // hráč stál před čarou – nikoho nenutil brzdit
    if (t.typ === 'kruhac') {
      const autoNaObjezdu = auto.t === t && auto.s >= box.c.sVstup;
      if (autoNaObjezdu && r.stav === 'pred' || (autoNaObjezdu && r.stav === 'v' && h.vstupBox && sim.cas - h.vstupBox.cas < 2.5)) {
        const p = J.prednostKruhac(P, !t.bezZnacky);
        if (p.kdo === 'on') prestupek(sim, 'prednost', { ...p, zavaznost: 'povinnost' }, 'prednost:' + auto.id);
      }
      return;
    }
    if (t.semafor && h.vstupBox && h.vstupBox.t === t && h.vstupBox.cervena) return;   // už potrestáno jako červená
    const svetloH = t.semafor ? (h.vstupBox && h.vstupBox.t === t ? h.vstupBox.svetlo : svetloPro(sim, t, r.a, r.b)) || 'plna' : undefined;
    const svetloA = t.semafor ? (auto.svetlo || 'plna') : undefined;
    const p = J.prednost(P, t, { vjezd: box.a, vyjezd: box.b, svetlo: svetloA }, { vjezd: r.a, vyjezd: r.b, svetlo: svetloH });
    if (p.kdo === 'ja') prestupek(sim, 'prednost', { citace: p.citace, text: p.text, zavaznost: 'povinnost' }, 'prednost:' + auto.id);
    else if (p.kdo === 'nikdo' && P.id === 'uk' && (box.uvnitr || (r.stav === 'pred' && box.dCara < r.d))) prestupek(sim, 'prednost', { citace: p.citace, text: p.text + ' Vozidlo kvůli tobě muselo prudce brzdit.', zavaznost: 'doporuceni' }, 'prednost:' + auto.id);
  }

  function sledujHrace(sim, dt) {
    const h = sim.hrac, P = sim.profil, svet = sim.svet;
    const t = h.t;
    // Rychlost
    if (J.prekrocilRychlost(P, h.v)) {
      h.rychleOd = h.rychleOd == null ? sim.cas : h.rychleOd;
      if (sim.cas - h.rychleOd > 1.2) prestupek(sim, 'rychlost', { ...J.RYCHLOST[P.id], zavaznost: 'povinnost' });
    } else h.rychleOd = null;
    if (!t) return;
    const lx = h.x - t.cx, ly = h.y - t.cy;
    const hx = Math.cos(h.uhel), hy = Math.sin(h.uhel);

    // Strana jízdy (mimo křižovatky) a směr na kruháči
    let spatne = false;
    const r = Math.hypot(lx, ly);
    if (t.typ === 'kruhac' && r < SV.KR.vnejsi + 0.5 && r > SV.KR.ostrov && Math.abs(h.v) > 1) {
      const cr = (lx * hy - ly * hx);
      const chci = P.strana > 0 ? -1 : 1;
      if (cr * chci < -0.5 * r) {
        h.smerSpatneOd = h.smerSpatneOd == null ? sim.cas : h.smerSpatneOd;
        if (sim.cas - h.smerSpatneOd > 0.6) prestupek(sim, 'smer', { ...J.SMER_KRUHAC[P.id], zavaznost: 'povinnost' });
      } else h.smerSpatneOd = null;
    } else {
      h.smerSpatneOd = null;
      const okraj = t.typ === 'kruhac' ? SV.KR.okraj + 1 : t.typ === 'krizovatka' ? J.OKRAJ + 1 : t.typ === 'zatacka' ? 8 : -1;
      for (const k of t.ramena) {
        const pod = lx * D[k][0] + ly * D[k][1];
        if (pod < okraj) continue;
        const lat = D[k][0] * ly - D[k][1] * lx;
        if (Math.abs(lat) > J.PRUH + 1.5) continue;
        const podel = hx * D[k][0] + hy * D[k][1];
        if (Math.abs(podel) < 0.7 || Math.abs(h.v) < 0.8) continue;
        const ocek = (podel > 0 ? 1 : -1) * P.strana;         // ven = +strana, dovnitř = −strana
        if (lat * ocek < -0.6 * (h.v > 0 ? 1 : -1) * 1) spatne = true;
      }
      if (spatne) {
        h.spatneOd = h.spatneOd == null ? sim.cas : h.spatneOd;
        if (sim.cas - h.spatneOd > 1.0) prestupek(sim, 'strana', { ...J.STRANA[P.id], zavaznost: 'povinnost' });
      } else h.spatneOd = null;
    }

    // Příští křižovatka (i na předchozí dlaždici) a vzdálenost přídě k její čáře
    const pb = h.c && h.a != null ? dalsiBox(sim, h) : null;
    if (pb && !pb.uvnitr) {
      const klic = pb.t.klic + ':' + pb.a, dPrid = pb.dCara - PRID;
      // Semafor: okamžik, kdy naskočila žlutá (smí pokračovat, jen když už bezpečně zastavit nešlo)
      if (pb.t.semafor && dPrid < 70) {
        const barva = svet.barva(pb.t, pb.a, sim.cas);
        if (barva === 'zluta' && (!h.svetlo || h.svetlo.klic !== klic || h.svetlo.barva !== 'zluta'))
          h.zluta = { klic, smi: J.smiNaSvetlo(P, 'zluta', { v: h.v, vzdalenost: dPrid }).smi };
        h.svetlo = { klic, barva };
      }
      // STOP: nejnižší rychlost, když je příď do 12 m před čarou (zastavit smí kdekoli tam, odkud má rozhled)
      if (h.minVKlic !== klic) { h.minVKlic = klic; h.minV = null; }
      if (dPrid < 12) h.minV = Math.min(h.minV == null ? Infinity : h.minV, Math.abs(h.v));
      if (pb.t === t) h.blinkrPrijezd = h.blinkr;
    }

    // Vstup do křižovatky
    if (t.box && h.c && h.c.sVstup != null && !h.vBoxu && h.s >= h.c.sVstup - 0.2 && h.s <= h.c.sVystup) {
      h.vBoxu = true;
      const vb = { t, a: h.a, cas: sim.cas, blinkr: h.blinkrPrijezd != null ? h.blinkrPrijezd : h.blinkr, cervena: false, svetlo: null, stojiOd: null, zaplnena: false, chyb: sim.prestupky.length };
      if (t.semafor) {
        const barva = svet.barva(t, h.a, sim.cas);
        vb.barva = barva;
        vb.sipka = svet.sipkaSviti(t, h.a, sim.cas);
        if (barva === 'zelena') vb.svetlo = 'plna';
        else if (barva === 'zluta' && (!h.zluta || h.zluta.klic !== t.klic + ':' + h.a || h.zluta.smi)) vb.svetlo = 'plna';   // bez záznamu = žlutá naskočila těsně před čarou
        else if (vb.sipka) vb.svetlo = 'doplnkova';        // směr se ověří při výjezdu
        else {
          vb.cervena = true;
          const z = J.smiNaSvetlo(P, barva, { v: h.v, vzdalenost: 0 });
          prestupek(sim, 'svetlo', { citace: z.citace, text: barva === 'zluta' ? 'Na žlutou jsi měl zastavit – stihl bys to bezpečně.' : z.text, zavaznost: 'povinnost' });
        }
      }
      if (t.rizeni[h.a] === 'stop' && !J.zastavilUStop(h.minVKlic === t.klic + ':' + h.a && h.minV != null ? h.minV : Infinity))
        prestupek(sim, 'stop', { ...J.STOP[P.id], zavaznost: 'povinnost' });
      if (t.typ === 'kruhac') {
        h.blinkrKruhPrijezd = vb.blinkr;
        h.blinkrPredVyjezdem = null;
      }
      h.vstupBox = vb;
      h.minV = null;
    }
    // Kruháč: blinkr těsně před výjezdem (za předchozím výjezdem)
    if (h.vBoxu && t.typ === 'kruhac' && h.c && h.s >= (h.c.sPredVyjezdem || 0)) h.blinkrPredVyjezdem = h.blinkr;

    // Zaplněná křižovatka: stojí uvnitř a před ním stojí auto už za křižovatkou
    const zad = [h.x - Math.cos(h.uhel) * 2.2, h.y - Math.sin(h.uhel) * 2.2];
    if (h.vBoxu === true && h.vstupBox && t.typ === 'krizovatka' && Math.max(Math.abs(zad[0] - t.cx), Math.abs(zad[1] - t.cy)) < J.OKRAJ) {
      if (Math.abs(h.v) < 0.3) {
        const vpredu = sim.auta.find(o => {
          const dx = o.x - h.x, dy = o.y - h.y, d = Math.hypot(dx, dy);
          return d < 8 && (dx * hx + dy * hy) / (d || 1) > 0.8 && Math.max(Math.abs(o.x - t.cx), Math.abs(o.y - t.cy)) > J.OKRAJ - 1 && o.v < 1;
        });
        const cekaPresProtismer = h.b != null && J.presProtismer(P, h.a, h.b);
        if (vpredu && !J.smiVjetDoKrizovatky(P, false, cekaPresProtismer)) {
          h.vstupBox.stojiOd = h.vstupBox.stojiOd == null ? sim.cas : h.vstupBox.stojiOd;
          if (!h.vstupBox.zaplnena && sim.cas - h.vstupBox.stojiOd > 1.5) {
            h.vstupBox.zaplnena = true;
            prestupek(sim, 'zaplnena', { ...J.ZAPLNENA[P.id], zavaznost: 'povinnost' });
          }
        }
      } else if (h.vstupBox) h.vstupBox.stojiOd = null;
    }

    // Přechody: hráč projíždí přechodem, kde čeká nebo přechází chodec
    for (const p of svet.prechody) {
      if (p.tile !== t) continue;
      const vx = p.stred[0] - h.x, vy = p.stred[1] - h.y;
      const podel = vx * hx + vy * hy, napric = Math.abs(vx * hy - vy * hx);
      const klic = 'pr' + p.id;
      if (napric > 6 || Math.abs(h.v) < 0.3) continue;
      if (podel > 0 && podel < 3) h[klic] = true;              // těsně před přechodem
      if (h[klic] && podel <= 0) {                              // právě přes něj přejel
        h[klic] = false;
        hodnotPrechod(sim, h, p);
      }
      if (podel > 6 || podel < -4) h[klic] = false;
    }
  }

  function hodnotPrechod(sim, h, p) {
    const P = sim.profil;
    const lane = [h.x, h.y];
    let stav = 'nic';
    for (const ch of sim.chodci) {
      if (ch.p !== p) continue;
      if (ch.stav === 'na_prechodu') {
        const sx = ch.cilBod[0] - ch.x, sy = ch.cilBod[1] - ch.y;
        const wx = lane[0] - ch.x, wy = lane[1] - ch.y;
        const vzd = Math.hypot(wx, wy);
        const pred = (sx * wx + sy * wy) > 0;
        if (pred || vzd < 2.8) stav = 'na_prechodu';
      } else if (ch.stav === 'ceka' && sim.cas - ch.cekaOd > 1.2 && stav === 'nic') stav = 'ceka';
    }
    if (stav === 'nic') return;
    if (p.typ === 'zebra') {
      const r = J.chodecNaPrechodu(P, stav);
      if (r) prestupek(sim, 'chodec', r, 'chodec' + p.id);
      return;
    }
    // Místo pro přecházení: jen při odbočování (ČR: do silnice, kam odbočuje; UK: i ze které odbočuje)
    const vb = h.vstupBox;
    const odbocka = vb && vb.t === p.tile && h.opustilBox && h.opustilBox.t === p.tile ? h.opustilBox : null;
    let tah = null;
    if (p.rameno != null && h.t === p.tile) {
      if (h.vBoxu !== true && odbocka && odbocka.b === p.rameno) tah = { a: odbocka.a, b: odbocka.b };   // už vyjel do ramene
      else if (!h.vBoxu && h.a === p.rameno && P.id === 'uk') {
        // UK H2 platí i pro silnici, ZE které odbočuje – jestli odbočí, se ale pozná až při výjezdu
        h.chodecPrijezd = { t: p.tile, stav, id: p.id };
        return;
      }
    }
    if (!tah || J.manevr(tah.a, tah.b) === 'rovne') return;
    const r = J.chodecPriOdboceni(P, stav);
    if (r) prestupek(sim, 'chodec', r, 'chodec' + p.id);
  }

  // Výjezd z křižovatky: blinkr, směr doplňkové šipky, pochvala.
  function vyjezdZBoxu(sim, h, t, b) {
    const vb = h.vstupBox;
    if (!vb || vb.t !== t) return;
    const P = sim.profil;
    h.opustilBox = { t, a: vb.a, b };
    if (t.typ === 'kruhac') {
      const pr = J.blinkrKruhac(P, vb.a, b, 'prijezd');
      const dal = h.blinkrKruhPrijezd || 'zadny';
      if (P.id === 'cz' && dal !== 'zadny') prestupek(sim, 'blinkr', pr, 'blinkrK1:' + t.klic);
      if (P.id === 'uk' && pr.blinkr !== 'zadny' && dal !== pr.blinkr)
        prestupek(sim, 'blinkr', pr, 'blinkrK1:' + t.klic);
      const vy = J.blinkrKruhac(P, vb.a, b, 'pred_vyjezdem');
      if ((h.blinkrPredVyjezdem || 'zadny') !== vy.blinkr) prestupek(sim, 'blinkr', vy, 'blinkrK2:' + t.klic);
    } else {
      const pozad = J.blinkrOdboceni(P, vb.a, b);
      if (pozad.blinkr !== 'zadny' && vb.blinkr !== pozad.blinkr)
        prestupek(sim, 'blinkr', { ...pozad, text: (vb.blinkr === 'zadny' ? 'Nedal jsi znamení o změně směru. ' : 'Blinkr ukazoval opačný směr. ') + pozad.text });
      if (vb.svetlo === 'doplnkova' && !sim.svet.keKrajnici(vb.a, b)) {
        const z = J.smiNaSvetlo(P, vb.barva);
        prestupek(sim, 'svetlo', { citace: z.citace, text: 'Šipka svítila jen pro odbočení ' + (P.strana > 0 ? 'vpravo' : 'vlevo') + ' – jiným směrem platila červená.', zavaznost: 'povinnost' });
      }
    }
    // UK: chodec na rameni, ze kterého hráč odbočil (vyhodnoceno teď, kdy je výjezd jistý)
    if (h.chodecPrijezd && h.chodecPrijezd.t === t) {
      if (J.manevr(vb.a, b) !== 'rovne' && t.typ !== 'kruhac') {
        const r = J.chodecPriOdboceni(P, h.chodecPrijezd.stav);
        if (r) prestupek(sim, 'chodec', r, 'chodec' + h.chodecPrijezd.id);
      }
      h.chodecPrijezd = null;
    }
    if (sim.prestupky.length === vb.chyb) pochvala(sim, t.typ === 'kruhac' ? 'Kruhový objezd bez chyby' : 'Křižovatka bez chyby');
  }

  /* ---------- chodci ---------- */

  function pridejChodce(sim, prechodId, strana = 0) {
    const p = sim.svet.prechody[prechodId];
    if (!p) return null;
    const ch = { id: sim.dalsiId++, p, strana, stav: 'jde', u: -0.25, x: 0, y: 0, cekaOd: null, barva: BARVY[Math.floor(sim.nahoda() * BARVY.length)] };
    polohaChodce(ch);
    sim.chodci.push(ch);
    return ch;
  }
  function polohaChodce(ch) {
    const [A, B] = ch.strana ? [ch.p.b, ch.p.a] : [ch.p.a, ch.p.b];
    ch.x = A[0] + (B[0] - A[0]) * ch.u; ch.y = A[1] + (B[1] - A[1]) * ch.u;
    ch.cilBod = B;
    ch.uhel = Math.atan2(B[1] - A[1], B[0] - A[0]);
  }
  function bezpecnePrejit(sim, ch) {
    const vsechna = sim.hrac ? [...sim.auta, sim.hrac] : sim.auta;
    for (const o of vsechna) {
      const hx = Math.cos(o.uhel), hy = Math.sin(o.uhel);
      const vx = ch.p.stred[0] - o.x, vy = ch.p.stred[1] - o.y;
      const d = vx * hx + vy * hy, nap = Math.abs(vx * hy - vy * hx);
      if (nap > 5.5) continue;
      if (d > -3 && d < 2.5) return false;                         // stojí na přechodu
      if (d > 0 && d < 40 && o.v > 1.2 && d / o.v < 5) return false;
    }
    return true;
  }
  function krokChodcu(sim, dt) {
    for (const ch of sim.chodci) {
      const v = 1.4 / (2 * (J.PRUH + 1.6));                         // podíl přechodu za sekundu
      if (ch.stav === 'jde') { ch.u += v * dt; if (ch.u >= 0.08) { ch.u = 0.08; ch.stav = 'ceka'; ch.cekaOd = sim.cas; } }
      else if (ch.stav === 'ceka') {
        if (sim.cas - ch.cekaOd > 0.8 && bezpecnePrejit(sim, ch)) ch.stav = 'na_prechodu';
      } else if (ch.stav === 'na_prechodu') { ch.u += v * dt; if (ch.u >= 0.9) ch.stav = 'odchazi'; }
      else if (ch.stav === 'odchazi') { ch.u += v * dt; if (ch.u > 1.25) ch.pryc = true; }
      polohaChodce(ch);
    }
    sim.chodci = sim.chodci.filter(ch => !ch.pryc);
  }

  /* ---------- srážky ---------- */

  function srazky(sim) {
    const h = sim.hrac;
    const kontrola = (o1, o2) => {
      const k1 = kruhyAuta(o1), k2 = kruhyAuta(o2);
      return k1.some(a => k2.some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.75));
    };
    for (let i = 0; i < sim.auta.length; i++) for (let j = i + 1; j < sim.auta.length; j++) {
      const a = sim.auta[i], b = sim.auta[j];
      if (Math.abs(a.x - b.x) > 6 || Math.abs(a.y - b.y) > 6) continue;
      if (kontrola(a, b)) { const k = 'npc' + a.id + ':' + b.id; if (!sim._klice.has(k)) { sim._klice.set(k, sim.cas); sim.srazkyNpc++; } }
    }
    if (!h) return;
    for (const o of sim.auta) {
      if (Math.abs(o.x - h.x) > 6 || Math.abs(o.y - h.y) > 6) continue;
      if (kontrola(o, h)) srazkaHrace(sim, o);
    }
    for (const ch of sim.chodci) {
      if (kruhyAuta(h).some(k => Math.hypot(k[0] - ch.x, k[1] - ch.y) < 1.3)) srazkaHrace(sim, ch);
    }
  }
  function srazkaHrace(sim, o) {
    const h = sim.hrac;
    prestupek(sim, 'srazka', { ...J.SRAZKA[sim.profil.id], zavaznost: 'povinnost' }, 'srazka' + o.id);
    h.v = 0; if (o.v != null) o.v = 0;
    if (!sim.konec && sim.ukoly.length) sim.konec = 'srazka';
  }

  /* ---------- plnění světa (volná jízda) ---------- */

  function doplnProvoz(sim) {
    const pl = sim.plneni;
    if (!pl) return;
    if (pl.okruh) return doplnKolemHrace(sim, pl);
    if (sim.auta.length < pl.aut && sim.nahoda() < 0.05) {
      const okraje = [...sim.svet.dl.values()].filter(t => t.ven.length);
      const t = okraje[Math.floor(sim.nahoda() * okraje.length)];
      if (t) {
        const k = t.ven[0];
        const p0 = SV.polohaNa(sim.svet.cesta(t, k, t.ramena.find(x => x !== k) ?? k), 0);
        const volno = [...sim.auta, sim.hrac].every(o => !o || Math.hypot(o.x - p0.x, o.y - p0.y) > 14);
        if (volno) pridejAuto(sim, { tile: t, vjezd: k, v: 9 });
      }
    }
    if (sim.chodci.length < pl.chodcu && sim.svet.prechody.length && sim.nahoda() < 0.02) {
      pridejChodce(sim, Math.floor(sim.nahoda() * sim.svet.prechody.length), sim.nahoda() < 0.5 ? 0 : 1);
    }
  }

  // Velká mapa (ostrov): auta a chodci se rodí na silnicích kolem hráče (mimo dohled) a daleko za ním mizí.
  function doplnKolemHrace(sim, pl) {
    const h = sim.hrac;
    if (!h) return;
    const R0 = pl.okruh * 0.45, R1 = pl.okruh;
    for (const a of sim.auta) if (Math.hypot(a.x - h.x, a.y - h.y) > R1 * 1.35) a.pryc = true;
    for (const c of sim.chodci) if (Math.hypot(c.x - h.x, c.y - h.y) > R1 * 1.35) c.pryc = true;
    if (!sim._blizke || sim.cas - sim._blizkeCas > 2) {
      sim._blizke = [...sim.svet.dl.values()].filter(t => !t.box && t.typ !== 'slepa' && (d => d > R0 && d < R1)(Math.hypot(t.cx - h.x, t.cy - h.y)));
      sim._blizkePrechody = sim.svet.prechody.filter(p => (d => d > R0 * 0.6 && d < R1)(Math.hypot(p.stred[0] - h.x, p.stred[1] - h.y)));
      sim._blizkeCas = sim.cas;
    }
    if (sim.auta.length < pl.aut && sim._blizke.length && sim.nahoda() < 0.08) {
      const t = sim._blizke[Math.floor(sim.nahoda() * sim._blizke.length)];
      const k = t.ramena[Math.floor(sim.nahoda() * t.ramena.length)];
      const s = 3 + sim.nahoda() * 20;
      const p0 = SV.polohaNa(sim.svet.cesta(t, k, t.ramena.find(x => x !== k) ?? k), s);
      if ([...sim.auta, h].every(o => Math.hypot(o.x - p0.x, o.y - p0.y) > 16)) pridejAuto(sim, { tile: t, vjezd: k, s, v: 9 });
    }
    if (sim.chodci.length < pl.chodcu && sim._blizkePrechody.length && sim.nahoda() < 0.02) {
      const p = sim._blizkePrechody[Math.floor(sim.nahoda() * sim._blizkePrechody.length)];
      pridejChodce(sim, p.id, sim.nahoda() < 0.5 ? 0 : 1);
    }
  }

  function spustUkoly(sim) {
    for (const u of sim.ukoly) {
      if (u.hotovo) continue;
      let ano = false;
      if (u.cas != null) ano = sim.cas >= u.cas;
      if (u.blizko) {
        const t = sim.svet.dl.get(u.blizko.tile);
        ano = sim.hrac && Math.hypot(sim.hrac.x - t.cx, sim.hrac.y - t.cy) < u.blizko.vzd;
      }
      if (!ano) continue;
      if (u.auto && !u.auto.s) {
        // auto přijíždějící z okraje se objeví, až je místo volné (kolona může sahat až k okraji mapy)
        const t0 = typeof u.auto.tile === 'string' ? sim.svet.dl.get(u.auto.tile) : u.auto.tile;
        const b0 = t0.ramena.find(k => k !== u.auto.vjezd) ?? u.auto.vjezd;
        const p0 = SV.polohaNa(sim.svet.cesta(t0, u.auto.vjezd, t0.box ? (u.auto.plan || [b0])[0] : b0), u.auto.s || 0);
        if ([...sim.auta, sim.hrac].some(o => o && Math.hypot(o.x - p0.x, o.y - p0.y) < 9)) continue;
      }
      u.hotovo = true;
      if (u.auto) pridejAuto(sim, { ...u.auto });
      if (u.chodec) pridejChodce(sim, u.chodec.prechod, u.chodec.strana || 0);
    }
  }

  /* ---------- hlavní krok ---------- */

  function krok(sim, dt, vstup = {}) {
    if (sim.konec && sim.konec !== 'cil-pokracuj') return;
    sim.cas += dt;
    spustUkoly(sim);
    doplnProvoz(sim);
    for (const a of sim.auta) {
      const zr = rizeniAuta(sim, a, dt);
      const vNove = Math.max(0, a.v + zr * dt);
      posunPoDraze(sim, a, (a.v + vNove) / 2 * dt);
      a.v = vNove;
      a.blinkr = blinkrVzorny(sim, a);
    }
    sim.auta = sim.auta.filter(a => !a.pryc);

    const h = sim.hrac;
    if (h) {
      const predT = h.t, predVBoxu = h.vBoxu;
      if (sim.autopilot) {
        const zr = rizeniAuta(sim, h, dt);
        const vNove = Math.max(0, h.v + zr * dt);
        if (!h.pryc) posunPoDraze(sim, h, (h.v + vNove) / 2 * dt);
        h.v = vNove;
        h.blinkr = sim.zly ? 'zadny' : blinkrVzorny(sim, h);
        h.moznosti = [h.b];
        if (h.pryc && !sim.konec) sim.konec = 'cil';
      } else {
        fyzikaHrace(sim, h, vstup, dt);
        predikce(sim, h);
      }
      if (predVBoxu === true && predT && predT.box && (h.t !== predT || (h.c && h.s > h.c.sVystup))) {
        const b = h.t !== predT ? (h.opustil && h.opustil.t === predT ? h.opustil.b : null) : h.b;
        if (b != null) vyjezdZBoxu(sim, h, predT, b);
        h.vBoxu = h.t === predT ? 'ven' : false;
      } else if (h.t !== predT) h.vBoxu = false;
      if (Math.abs(h.v) < 0.3) { if (h.stojiOd == null) h.stojiOd = sim.cas; } else h.stojiOd = null;
      sledujHrace(sim, dt);
      if (sim.cil && h.t === sim.cil && !sim.konec) sim.konec = 'cil';
    }
    krokChodcu(sim, dt);
    srazky(sim);
  }

  // Řidič-bot pro ruční jízdu (testy, ukázka): z logiky NPC spočítá plyn, brzdu, volant a blinkr.
  function ridicBot(sim, h, dt) {
    if (!h.c || h.a == null) return { plyn: 0, brzda: 1 };
    const zr = rizeniAuta(sim, h, dt);
    const Ld = Math.max(5, Math.abs(h.v) * 0.9);
    const body = bodyPred(sim, h, Ld + 1.5);
    const cil = body.length ? body[body.length - 1] : { x: h.x + Math.cos(h.uhel), y: h.y + Math.sin(h.uhel) };
    let alfa = Math.atan2(cil.y - h.y, cil.x - h.x) - h.uhel;
    while (alfa > Math.PI) alfa -= 2 * Math.PI;
    while (alfa < -Math.PI) alfa += 2 * Math.PI;
    const delta = Math.atan(2 * AUTO.rozvor * Math.sin(alfa) / Ld);
    const dMax = 0.62 / (1 + Math.abs(h.v) / 9);
    const vol = Math.max(-1, Math.min(1, delta / dMax));
    h.blinkr = sim.zly ? 'zadny' : blinkrVzorny(sim, h);
    return {
      plyn: Math.max(0, Math.min(1, zr / (h.aPlyn || A_PLYN))), brzda: Math.max(0, Math.min(1, -zr / (h.aBrzda || A_BRZDA))),
      vpravo: vol > 0 ? vol : 0, vlevo: vol < 0 ? -vol : 0,
    };
  }

  const API = { A_PLYN, A_BRZDA, AUTO, NAHLE, VMAX_NPC, BARVY, vytvor, krok, pridejAuto, pridejChodce, predikce, vztah, ridicBot, blinkrVzorny, TITULKY };
  if (uzel) module.exports = API;
  else window.BLINKR_PROVOZ = API;
})();
