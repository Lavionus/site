/* Ostrov v obležení – simulace (bez DOM, deterministická).
   Pevný krok KROK sekund. Náhoda jen z hra.R (seedovaná na začátku každé vlny), takže stejný seed
   a stejné povely dají stejnou hru. Pro UI se sbírají události do hra.udalosti (zvuky, částice, bannery);
   UI je po každém snímku vybere. Souřadnice jednotek jsou v polích (střed pole x+0.5, y+0.5). */
(function (OBL) {
  'use strict';
  const KROK = 1 / 30;
  const D = () => OBL.data, O = () => OBL.ostrov, TK = () => OBL.toky;

  /* ================= založení hry ================= */
  function nova(opt) {
    const { OBTIZNOSTI, BIOMY } = D();
    const ob = OBTIZNOSTI[opt.obtiznost] || OBTIZNOSTI.normalni;
    const biom = opt.biom || 'tropy';
    const o = O().generuj(opt.seed >>> 0, biom);
    const art = new Set(opt.artefakty || []);
    const maxP = ob.pevnost + (art.has('kamen') ? 20 : 0);
    const hra = {
      o, seed: o.seed, biom, obtiznost: opt.obtiznost || 'normalni', rezim: opt.rezim || 'nekonecna',
      ostrovIndex: opt.ostrovIndex || 0, maxVln: opt.maxVln || Infinity, bossTyp: opt.boss || BIOMY[biom].boss,
      cas: 0, zlato: opt.zlato != null ? opt.zlato : ob.zlato, skore: opt.skore || 0, vlna: 0, vlnaBezi: false,
      pevnost: { hp: maxP, max: maxP },
      pristav: { hp: 80, max: 80 },
      vesnice: o.vesnice.map(v => ({ x: v.x, y: v.y, hp: 30, max: 30 })),
      veze: [], pasti: [], nepratele: [], strely: [], plochy: [], branderi: [],
      obsazeno: new Int32Array(O().N), // id věže na poli (0 = volno)
      pastNa: new Int32Array(O().N),
      artefakty: art, stat: { zabito: 0, uniklo: 0, ukradeno: 0, postaveno: 0 },
      schopnosti: { salva: { cd: 0 }, brander: { cd: 0 }, zpev: { cd: 0 } },
      zmrazeno: 0, pevnostCd: 0,
      pocasi: { smer: 'V', sila: 1, jev: null, noc: false, priliv: 0 },
      dalsi: null, fronta: [], casVlny: 0,
      R: OBL.Nahoda(OBL.hash(o.seed, 'start')), dalsiId: 1, udalosti: [], konec: null, vyhraOstrova: false,
      opravSklad: 0,
    };
    pripravDalsi(hra);
    hra.pocasi = Object.assign({}, hra.dalsi.pocasi);
    return hra;
  }

  const udalost = (hra, u) => { if (hra.udalosti.length < 400) hra.udalosti.push(u); };
  const stred = v => ({ x: v.x + (v.w || 1) / 2, y: v.y + (v.w || 1) / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ixy = (x, y) => O().idx(Math.max(0, Math.min(O().W - 1, Math.floor(x))), Math.max(0, Math.min(O().H - 1, Math.floor(y))));

  /* ================= budovy ================= */
  function budovy(hra, sPevnosti) {
    const b = [];
    if (hra.pristav.hp > 0) b.push({ kdo: 'pristav', x: hra.o.pristav.x + 0.5, y: hra.o.pristav.y + 0.5, ref: hra.pristav });
    hra.vesnice.forEach((v, i) => { if (v.hp > 0) b.push({ kdo: 'vesnice' + i, x: v.x + 0.5, y: v.y + 0.5, ref: v }); });
    if (sPevnosti) b.push({ kdo: 'pevnost', x: hra.o.pevnost.x + 1, y: hra.o.pevnost.y + 1, ref: hra.pevnost });
    return b;
  }
  const stredPevnosti = hra => ({ x: hra.o.pevnost.x + 1, y: hra.o.pevnost.y + 1 });

  function poskodBudovu(hra, b, dmg, odkud) {
    if (b.hp <= 0) return;
    b.hp = Math.max(0, b.hp - dmg);
    const cil = b === hra.pevnost ? stredPevnosti(hra) : { x: b.x + 0.5, y: b.y + 0.5 };
    if (b === hra.pristav) { cil.x = hra.o.pristav.x + 0.5; cil.y = hra.o.pristav.y + 0.5; }
    udalost(hra, { t: 'budova', x: cil.x, y: cil.y, dmg, pevnost: b === hra.pevnost, odkud });
    if (b.hp <= 0) {
      if (b === hra.pevnost) { hra.konec = 'prohra'; udalost(hra, { t: 'prohra' }); }
      else udalost(hra, { t: 'banner', text: (b === hra.pristav ? '⚓ Přístav' : '🏘️ Vesnice') + ' padl(a)! Mezi vlnami ji můžeš obnovit.', zly: true, x: cil.x, y: cil.y, znicena: true });
    }
  }

  /* ================= věže: statistiky, aury ================= */
  const hodnost = v => { const H = D().HODNOSTI; let r = 0; for (let i = 1; i < H.length; i++) if ((v.xp || 0) >= H[i].xp) r = i; return r; };
  function chebDist(a, b) {
    const aw = a.w || 1, bw = b.w || 1;
    const dc = Math.max(0, b.x - (a.x + aw - 1), a.x - (b.x + bw - 1));
    const dr = Math.max(0, b.y - (a.y + aw - 1), a.y - (b.y + bw - 1));
    return Math.max(dc, dr);
  }
  function dosahAury(v) {
    if (v.typ !== 'prapor' && v.typ !== 'majak') return 1;
    return (v.spec === 1 ? 2 : 1) + (v.super ? 2 : v.mega ? 1 : 0);
  }
  function auraPraporu(v) {
    const l = v.uroven, p = v.super ? 6 : v.mega ? 2.5 : 1;
    return { dmg: Math.pow(1.2 + 0.07 * (l - 1) + (v.spec === 0 ? 0.15 : 0), p), rate: Math.pow(Math.max(0.7, 0.87 - 0.03 * (l - 1)), p), range: Math.pow(1.1 + 0.04 * (l - 1), p) };
  }
  function bonusySousedu(hra, t) {
    const b = { rate: 1, dmg: 1, range: 1, protiLodim: 1, zpomal: false, ohen: 0, omrac: 0, vzduch: false, majak: false, typy: new Set() };
    if (t.typ === 'salupa') return b;
    for (const o of hra.veze) {
      if (o === t || o.typ === 'salupa') continue;
      if (chebDist(t, o) > dosahAury(o)) continue;
      b.typy.add(o.typ);
      if (o.typ === 'prapor') { const a = auraPraporu(o); b.dmg *= a.dmg; b.rate *= a.rate; b.range *= a.range; continue; }
      const kolikrat = o.super ? 4 : o.mega ? 2 : 1;
      for (let k = 0; k < kolikrat; k++) switch (o.typ) {
        case 'straz': b.rate *= 0.88; break;
        case 'delo': b.protiLodim *= 1.12; break;
        case 'mozdir': b.dmg *= 1.10; break;
        case 'balista': b.zpomal = true; break;
        case 'musket': b.rate *= 0.90; break;
        case 'kotel': b.ohen = Math.max(b.ohen, k ? 7 : 4); break;
        case 'mag': b.omrac = Math.max(b.omrac + (k ? 0.04 : 0), 0.08); break;
        case 'majak': b.vzduch = true; b.majak = true; break;
        case 'sklad': b.range *= 1.08; break;
      }
    }
    return b;
  }

  function staty(hra, t) {
    const def = D().VEZE[t.typ], l = t.uroven, nb = bonusySousedu(hra, t);
    const s = {
      dosah: (def.dosah || 0) * (1 + (l - 1) * 0.08) * nb.range,
      dmg: (def.dmg || 0) * Math.pow(1.45, l - 1) * nb.dmg,
      kad: Math.max(0.08, (def.kad || 1) * Math.pow(0.9, l - 1) * nb.rate),
      splash: def.splash ? def.splash * (1 + (l - 1) * 0.12) : 0,
      min: def.min || 0, retez: def.retez || 0, cile: def.cile || '', terce: 1, krit: 0,
      zpomal: def.zpomal || 0, zpomalT: def.zpomalT || 0, ohen: def.ohen ? def.ohen * Math.pow(1.35, l - 1) : 0, ohenT: def.ohenT || 0, ohenR: def.ohenR || 0,
      omrac: nb.omrac, auraZpomal: nb.zpomal, auraOhen: nb.ohen, protiLodim: nb.protiLodim, pruraz: false, kys: false, sit: false, retezK: false,
      majak: nb.majak, zhave: false, navadeni: false, strzeni: false,
    };
    if (nb.vzduch && s.cile && !s.cile.includes('v') && t.typ !== 'delo' && t.typ !== 'salupa') s.cile += 'v';
    const k = t.spec == null ? '' : t.typ + t.spec;
    switch (k) {
      case 'straz0': s.auraOhen = Math.max(s.auraOhen, 6); break;
      case 'straz1': s.dosah *= 1.3; break;
      case 'delo0': s.retezK = true; break;
      case 'delo1': s.dmg *= 1.6; s.pruraz = true; break;
      case 'mozdir0': s.splash *= 1.6; break;
      case 'mozdir1': s.ohen = 10 * Math.pow(1.35, l - 1); s.ohenT = 2.5; s.ohenR = 0.9; break;
      case 'balista0': s.sit = true; break;
      case 'balista1': s.terce = 3; break;
      case 'musket0': s.terce = 2; break;
      case 'musket1': s.krit = 0.25; break;
      case 'kotel0': s.ohenR *= 1.4; s.ohenT *= 1.6; break;
      case 'kotel1': s.kys = true; s.ohen *= 1.4; break;
      case 'mag0': s.retez += 2; break;
      case 'mag1': s.omrac = Math.max(s.omrac, 0.2); break;
      case 'majak1': s.dosah += 1.5; break;
      case 'salupa0': s.splash = Math.max(s.splash, 0.7); break;
      case 'salupa1': s.kad *= 0.8; break;
    }
    if (t.typ === 'majak' && hra.artefakty.has('lampa')) s.dosah += 1.5;
    if (t.super) { s.dmg *= 9; s.dosah *= 1.6; s.kad = Math.max(0.05, s.kad * 0.5); s.splash *= 2; s.retez += 4; s.ohen *= 3.5; }
    else if (t.mega) { s.dmg *= 3; s.dosah *= 1.3; s.kad = Math.max(0.06, s.kad * 0.75); s.splash *= 1.4; s.retez += 2; s.ohen *= 2; }
    const rk = hodnost(t);
    if (rk) { s.dmg *= 1 + 0.08 * rk; s.kad *= 1 - 0.05 * rk; s.dosah *= 1 + 0.04 * rk; if (rk >= 4) s.krit = Math.max(s.krit, 0.1); }
    // terén pod věží
    if (t.typ !== 'salupa' && t.typ !== 'majak') {
      const ter = hra.o.ter[O().idx(t.x, t.y)], T = O().T;
      if (ter === T.KOPEC) s.dosah *= 1.18;
      else if (ter === T.UTES) s.dosah *= t.typ === 'delo' ? 1.3 : 1.1;
      else if (ter === T.LES) s.dosah *= 0.9;
    }
    // synergie dvojic
    if (t.typ === 'delo' && nb.typy.has('kotel')) s.zhave = true;
    if (t.typ === 'musket' && nb.typy.has('balista')) s.strzeni = true;
    if (t.typ === 'mozdir' && nb.typy.has('majak')) s.navadeni = true;
    // počasí
    const P = hra.pocasi;
    if (t.typ !== 'majak') {
      if (P.jev === 'mlha' && !nb.majak) s.dosah *= 0.85;
      if (P.noc && !nb.majak) s.dosah *= hra.artefakty.has('lampa') ? 0.9 : 0.8;
    }
    s.dmg = Math.round(s.dmg * 10) / 10;
    return s;
  }

  /* ================= stavba ================= */
  function cenaStavby(hra, typ, x, y) {
    const def = D().VEZE[typ];
    let c = def.cena;
    if (typ !== 'salupa' && O().uvnitr(x, y)) {
      const t = hra.o.ter[O().idx(x, y)], T = O().T;
      if (t === T.BAZINA) c *= 2;
      if (t === T.PLAZ) c *= 0.9;
    }
    return Math.round(c);
  }

  function lzeStavet(hra, typ, x, y) {
    const def = D().VEZE[typ], o = hra.o, Os = O();
    if (!def) return { ok: false, duvod: 'neznámá stavba' };
    if (typ === 'salupa') {
      if (hra.pristav.hp <= 0) return { ok: false, duvod: 'šalupu lze stavět jen v neporušeném přístavu' };
      if (hra.veze.filter(v => v.typ === 'salupa').length >= def.max) return { ok: false, duvod: 'nejvýš ' + def.max + ' šalupy' };
      if (hra.zlato < def.cena) return { ok: false, duvod: 'málo zlata' };
      return { ok: true, cena: def.cena };
    }
    if (!Os.uvnitr(x, y)) return { ok: false, duvod: 'mimo mapu' };
    const i = Os.idx(x, y), t = o.ter[i], T = Os.T;
    if (Os.jeVodaT(t)) return { ok: false, duvod: 'věž nelze postavit na vodu' };
    if (t === T.SKALA) return { ok: false, duvod: 'na holé skále se stavět nedá' };
    if (o.cesta[i]) return { ok: false, duvod: 'na cestě se nestaví (pasti ano)' };
    if (o.budova[i] >= 0) return { ok: false, duvod: 'tady stojí budova' };
    if (hra.obsazeno[i]) return { ok: false, duvod: 'pole je obsazené' };
    if (def.misto === 'breh' && !Os.pobrezniPole(o, x, y)) return { ok: false, duvod: def.nazev + ' musí stát u vody' };
    if (def.misto === 'louka' && t !== T.LOUKA) return { ok: false, duvod: 'plantáž jen na louce' };
    const cena = cenaStavby(hra, typ, x, y);
    if (hra.zlato < cena) return { ok: false, duvod: 'málo zlata (' + cena + ')' };
    return { ok: true, cena };
  }

  function postav(hra, typ, x, y) {
    const m = lzeStavet(hra, typ, x, y);
    if (!m.ok) return null;
    hra.zlato -= m.cena;
    const v = { id: hra.dalsiId++, typ, x, y, w: 1, uroven: 1, spec: null, xp: 0, zabiti: 0, utraceno: m.cena, cd: 0, uhel: -Math.PI / 2, vyrazena: 0, priorita: 'prvni', mega: false, super: false };
    if (typ === 'salupa') {
      const d = hra.o.pristav.dok;
      v.x = d.x; v.y = d.y; v.px = d.x + 0.5; v.py = d.y + 0.5; v.hlidka = { x: d.x, y: d.y };
    } else hra.obsazeno[O().idx(x, y)] = v.id;
    hra.veze.push(v);
    hra.stat.postaveno++;
    udalost(hra, { t: 'stavba', typ, x: v.px || x + 0.5, y: v.py || y + 0.5 });
    return v;
  }

  const maxUroven = v => D().VEZE[v.typ].maxUr || 5;
  const cenaVylepseni = v => Math.floor(D().VEZE[v.typ].cena * 0.8 * v.uroven * (v.super ? 6 : v.mega ? 2.5 : 1));
  function vylepsi(hra, v) {
    if (v.uroven >= maxUroven(v)) return false;
    const c = cenaVylepseni(v);
    if (hra.zlato < c) return false;
    hra.zlato -= c; v.utraceno += c; v.uroven++;
    udalost(hra, { t: 'vylepseni', x: stredVeze(v).x, y: stredVeze(v).y });
    return true;
  }
  function specializuj(hra, v, k) {
    if (v.uroven < 3 || v.spec != null || !D().VEZE[v.typ].specs[k]) return false;
    v.spec = k;
    udalost(hra, { t: 'vylepseni', x: stredVeze(v).x, y: stredVeze(v).y });
    return true;
  }
  const prodejniCena = v => Math.floor(v.utraceno * 0.7);
  function prodej(hra, v) {
    const i = hra.veze.indexOf(v);
    if (i < 0) return 0;
    const c = prodejniCena(v);
    hra.zlato += c;
    hra.veze.splice(i, 1);
    if (v.typ !== 'salupa') for (let y = v.y; y < v.y + v.w; y++) for (let x = v.x; x < v.x + v.w; x++) hra.obsazeno[O().idx(x, y)] = 0;
    for (const e of hra.nepratele) if (e.obtocena === v.id) { e.obtocena = 0; e.hadCil = null; }
    udalost(hra, { t: 'prodej', x: stredVeze(v).x, y: stredVeze(v).y, n: c });
    return c;
  }
  const stredVeze = v => v.typ === 'salupa' ? { x: v.px, y: v.py } : stred(v);

  // sloučení 4 stejných věží ve čtverci 2×2 (krok = velikost půdorysu): bašta, ze 4 bašt pevnůstka
  function najdiCtverici(hra, t) {
    if (t.super || t.typ === 'salupa' || t.typ === 'plantaz') return null;
    const s = t.w || 1;
    for (let dc = -1; dc <= 0; dc++) for (let dr = -1; dr <= 0; dr++) {
      const c0 = t.x + dc * s, r0 = t.y + dr * s, q = [];
      for (const [oc, or] of [[c0, r0], [c0 + s, r0], [c0, r0 + s], [c0 + s, r0 + s]]) {
        const o = hra.veze.find(v => v.typ === t.typ && (v.w || 1) === s && !v.super && v.x === oc && v.y === or);
        if (!o) break; q.push(o);
      }
      if (q.length === 4) return { x: c0, y: r0, s, q };
    }
    return null;
  }
  function slouc(hra, ctv) {
    const t0 = ctv.q[0], w = ctv.s * 2, sup = w >= 4;
    const nv = { id: hra.dalsiId++, typ: t0.typ, x: ctv.x, y: ctv.y, w, mega: true, super: sup,
      uroven: Math.max(...ctv.q.map(v => v.uroven)), spec: ctv.q.map(v => v.spec).find(s => s != null) ?? null,
      utraceno: ctv.q.reduce((a, v) => a + v.utraceno, 0), xp: ctv.q.reduce((a, v) => a + (v.xp || 0), 0),
      zabiti: ctv.q.reduce((a, v) => a + (v.zabiti || 0), 0), cd: 0, uhel: t0.uhel, vyrazena: 0, priorita: t0.priorita };
    hra.veze = hra.veze.filter(v => !ctv.q.includes(v));
    hra.veze.push(nv);
    for (let y = nv.y; y < nv.y + w; y++) for (let x = nv.x; x < nv.x + w; x++) hra.obsazeno[O().idx(x, y)] = nv.id;
    udalost(hra, { t: 'slouceni', x: nv.x + w / 2, y: nv.y + w / 2, sup });
    udalost(hra, { t: 'banner', text: sup ? '🏛️ Pevnůstka postavena!' : '🏯 Bašta postavena!' });
    return nv;
  }

  /* pasti */
  function lzePast(hra, typ, x, y) {
    const def = D().PASTI[typ], o = hra.o, Os = O();
    if (!def || !Os.uvnitr(x, y)) return { ok: false, duvod: 'mimo mapu' };
    const i = Os.idx(x, y), t = o.ter[i];
    if (hra.pastNa[i]) return { ok: false, duvod: 'tady už past je' };
    if (def.misto === 'cesta' && !o.cesta[i]) return { ok: false, duvod: 'zátarasy patří na cestu' };
    if (def.misto === 'melcina' && !(t === Os.T.MORE && o.hl[i] === 1)) return { ok: false, duvod: 'kůly jen do mělčiny' };
    if (def.misto === 'voda' && t !== Os.T.MORE) return { ok: false, duvod: 'jen na moře' };
    if (hra.zlato < def.cena) return { ok: false, duvod: 'málo zlata' };
    return { ok: true, cena: def.cena };
  }
  function postavPast(hra, typ, x, y) {
    const m = lzePast(hra, typ, x, y);
    if (!m.ok) return null;
    hra.zlato -= m.cena;
    const def = D().PASTI[typ];
    const p = { id: hra.dalsiId++, typ, x, y, uses: def.uses || 0, hp: def.hp || 0, doba: def.doba || 0, aktivni: false };
    hra.pasti.push(p);
    hra.pastNa[O().idx(x, y)] = p.id;
    udalost(hra, { t: 'stavba', typ, x: x + 0.5, y: y + 0.5 });
    return p;
  }
  function odeberPast(hra, p) {
    const i = hra.pasti.indexOf(p);
    if (i >= 0) hra.pasti.splice(i, 1);
    hra.pastNa[O().idx(p.x, p.y)] = 0;
  }
  const pastNaPoli = (hra, i) => { const id = hra.pastNa[i]; return id ? hra.pasti.find(p => p.id === id) : null; };

  /* obnova budov mezi vlnami */
  const CENA_OBNOVY = { pristav: 120, vesnice: 60 };
  function obnov(hra, kdo) {
    if (hra.vlnaBezi) return false;
    const b = kdo === 'pristav' ? hra.pristav : hra.vesnice[+String(kdo).replace('vesnice', '')];
    if (!b || b.hp >= b.max) return false;
    const plna = b.hp <= 0 ? CENA_OBNOVY[kdo === 'pristav' ? 'pristav' : 'vesnice'] : Math.ceil((b.max - b.hp) * 1.5);
    if (hra.zlato < plna) return false;
    hra.zlato -= plna; b.hp = b.max;
    udalost(hra, { t: 'banner', text: (kdo === 'pristav' ? '⚓ Přístav' : '🏘️ Vesnice') + ' opraven(a).' });
    return true;
  }
  const cenaObnovy = (hra, kdo) => {
    const b = kdo === 'pristav' ? hra.pristav : hra.vesnice[+String(kdo).replace('vesnice', '')];
    if (!b || b.hp >= b.max) return 0;
    return b.hp <= 0 ? CENA_OBNOVY[kdo === 'pristav' ? 'pristav' : 'vesnice'] : Math.ceil((b.max - b.hp) * 1.5);
  };

  /* ================= vlny ================= */
  function stupen(hra, n) {
    // G řídí, kdo se smí objevit; k = postup kampaní (síla nepřátel)
    const k = hra.rezim === 'kampan' ? hra.ostrovIndex : hra.rezim === 'den' ? 1 : 0;
    return { G: n + k * 3, k };
  }

  function naklad(def, G, R) {
    if (!def.vysadek) return null;
    const out = [];
    for (const [typ, n] of def.vysadek) for (let i = 0; i < n; i++) {
      let t = typ;
      if (t === 'pirat') {
        const x = R.f();
        if (G >= 15 && x < 0.1) t = 'magN';
        else if (G >= 11 && x < 0.2) t = 'bubenik';
        else if (G >= 8 && x < 0.32) t = 'strelec';
        else if (G >= 6 && x < 0.45) t = 'saper';
        else if (G >= 9 && x < 0.6) t = 'marinak';
      }
      out.push(t);
    }
    return out;
  }

  // ověří, že jednotka z bodu nástupu dopluje ke svému cíli (při dané hladině)
  function doplouva(hra, typ, nastup, pr) {
    const def = D().NEPRATELE[typ], o = hra.o, i = O().idx(nastup.x, nastup.y);
    if (def.druh === 'vzduch') return true;
    const ponor = def.ponor || 1;
    if (def.ukol === 'vysadek' || def.ukol === 'vylez') return TK().poleKPristani(o, ponor, pr).d[i] >= 0;
    if (def.ukol === 'loupez') return TK().polePristav(o, ponor, pr).d[i] >= 0;
    if (def.ukol === 'ostrel') return TK().poleOstrel(o, ponor, pr, budovy(hra, !!def.boss), def.dosahU).d[i] >= 0;
    return TK().poleKCilum(o, [i], 1, pr).d.some(v => v > 2);
  }

  function pripravDalsi(hra) {
    const n = hra.vlna + 1;
    if (n > hra.maxVln) { hra.dalsi = null; return; }
    const { NEPRATELE, NABOR, BIOMY, OBTIZNOSTI, BOSSOVE, SMERY } = D();
    const R = OBL.Nahoda(OBL.hash(hra.seed, hra.ostrovIndex, 'vlna', n));
    const { G, k } = stupen(hra, n);
    const ob = OBTIZNOSTI[hra.obtiznost];
    let hpMul = (1 + (n - 1) * 0.09) * (1 + 0.08 * k) * ob.hp;
    if (hra.rezim === 'nekonecna' && n > 15) hpMul *= Math.pow(1.045, n - 15);
    const boss = n % 10 === 0;
    const priliv = [0, -1, 0, 1][n % 4];
    const pocasi = { smer: R.vyber(SMERY), sila: R.cele(0, 3), jev: null, noc: n % 4 === 0 && !boss, priliv };
    const x = R.f();
    if (x < 0.2) pocasi.jev = 'jasno'; else if (x < 0.36) pocasi.jev = 'mlha'; else if (x < 0.48) pocasi.jev = 'boure';
    let bossTyp = null;
    if (boss) {
      bossTyp = hra.rezim === 'nekonecna' ? BOSSOVE[(n / 10 - 1) % BOSSOVE.length] : hra.bossTyp;
      if (bossTyp === 'holandan') pocasi.jev = 'mlha';
    }
    const vahy = BIOMY[hra.biom].vahy;
    const dostupne = NABOR.filter(([, od]) => od <= G);
    let body = 4.5 + n * 2.1 + k * 1.2 + (hra.rezim === 'nekonecna' ? Math.max(0, n - 20) * 0.8 : 0);
    if (boss) body *= 0.5;
    const nastupy = hra.o.nastupy;
    const skupin = Math.min(nastupy.length, n >= 8 ? 3 : n >= 4 ? 2 : 1);
    const vybrane = R.zamichej(nastupy.map((_, i) => i)).slice(0, skupin);
    const jednotky = [];
    let pojistka = 0;
    while (body > 0.4 && pojistka++ < 200) {
      const moznosti = dostupne.filter(([, , c]) => c <= body + 0.8).map(([t, , c]) => {
        const druh = NEPRATELE[t].druh;
        return [t, (druh === 'vzduch' ? vahy.vzduch : druh === 'tvor' ? vahy.tvor : vahy.lod) / Math.sqrt(c)];
      });
      if (!moznosti.length) break;
      const t = R.vazene(moznosti);
      body -= NABOR.find(a => a[0] === t)[2];
      jednotky.push(t);
    }
    if (bossTyp) jednotky.unshift(bossTyp);
    if (bossTyp === 'admiral') for (let i = 0; i < 4; i++) jednotky.push('kaper');
    // rozdělení do skupin podle bodů nástupu (loď musí umět doplout)
    const fronta = [];
    const casSkupiny = vybrane.map((_, i) => i * 3.5);
    jednotky.forEach((t, j) => {
      let g = j % skupin;
      let nast = nastupy[vybrane[g]];
      if (!doplouva(hra, t, nast, priliv)) {
        const jine = vybrane.findIndex(vi => doplouva(hra, t, nastupy[vi], priliv));
        if (jine >= 0) { g = jine; nast = nastupy[vybrane[g]]; }
        else {
          const kdekoli = nastupy.findIndex(ns => doplouva(hra, t, ns, priliv));
          if (kdekoli < 0 && !NEPRATELE[t].boss) { t = NEPRATELE[t].druh === 'lod' ? 'harpyje' : 'zralok'; }
          else if (kdekoli >= 0) nast = nastupy[kdekoli];
        }
      }
      const def = NEPRATELE[t];
      fronta.push({ typ: t, nx: nast.x, ny: nast.y, smer: nast.smer, cas: casSkupiny[g], hpMul, naklad: naklad(def, G, R) });
      casSkupiny[g] += def.boss ? 2.5 : def.druh === 'vzduch' ? 0.7 : 1.2;
    });
    fronta.sort((a, b) => a.cas - b.cas);
    hra.dalsi = { n, fronta, pocasi, boss: bossTyp, smery: [...new Set(fronta.map(f => f.smer))] };
  }

  function nahled(hra) {
    if (!hra.dalsi) return null;
    const pocty = {};
    for (const f of hra.dalsi.fronta) pocty[f.typ] = (pocty[f.typ] || 0) + 1;
    // přesné směry vždy s kompasem, jinak do 6. vlny přesně, potom jen přibližně (polovina mapy)
    const presne = hra.artefakty.has('kompas') || hra.dalsi.n <= 6;
    const smery = presne ? hra.dalsi.smery : [...new Set(hra.dalsi.smery.map(s => s.includes('S') ? 'sever' : s.includes('J') ? 'jih' : s === 'V' ? 'východ' : 'západ'))];
    return { n: hra.dalsi.n, pocty, pocasi: hra.dalsi.pocasi, boss: hra.dalsi.boss, smery, presne };
  }

  function spustVlnu(hra) {
    if (hra.vlnaBezi || hra.konec || !hra.dalsi || hra.vyhraOstrova) return false;
    hra.vlna = hra.dalsi.n;
    hra.vlnaBezi = true;
    hra.pocasi = Object.assign({}, hra.dalsi.pocasi);
    hra.fronta = hra.dalsi.fronta.map(f => Object.assign({}, f));
    hra.casVlny = 0;
    hra.opravSklad = 0; hra.pevnostCd = 0; hra.zmrazeno = 0; // stav nezávislý na tom, co se neukládá
    hra.R = OBL.Nahoda(OBL.hash(hra.seed, hra.ostrovIndex, 'boj', hra.vlna));
    hra.zlato += 25;
    for (const p of hra.pasti) if (p.typ === 'zatarasy') { p.aktivni = false; p.doba = D().PASTI.zatarasy.doba; }
    hra.dalsi = null;
    udalost(hra, { t: 'vlna', n: hra.vlna, boss: hra.fronta.some(f => D().NEPRATELE[f.typ].boss) });
    return true;
  }

  function konecVlny(hra) {
    hra.vlnaBezi = false;
    let prijem = 0;
    const polozky = [];
    if (hra.pristav.hp > 0) { prijem += 30; polozky.push('⚓ 30'); }
    const ves = hra.vesnice.filter(v => v.hp > 0).length;
    if (ves) { prijem += 15 * ves; polozky.push('🏘️ ' + 15 * ves); }
    let pl = 0;
    for (const v of hra.veze) {
      if (v.typ === 'plantaz') pl += Math.round(20 * (1 + 0.5 * (v.uroven - 1)) * (v.super ? 9 : v.mega ? 3 : 1));
      if (v.typ === 'sklad' && v.spec === 1) pl += 15 * (v.super ? 9 : v.mega ? 3 : 1);
    }
    if (pl) { prijem += pl; polozky.push('🌾 ' + pl); }
    hra.zlato += prijem;
    hra.pevnost.hp = Math.min(hra.pevnost.max, hra.pevnost.hp + 5);
    hra.skore += 10 * hra.vlna;
    hra.branderi = [];
    hra.plochy = [];
    hra.strely = [];
    for (const v of hra.veze) v.vyrazena = 0;
    if (hra.vlna >= hra.maxVln) {
      hra.vyhraOstrova = true;
      udalost(hra, { t: 'vyhra', prijem });
    } else udalost(hra, { t: 'konecVlny', n: hra.vlna, prijem, polozky });
    pripravDalsi(hra);
    // mezi vlnami už platí hladina a počasí příští vlny (hráč vidí nové mělčiny, když staví)
    if (hra.dalsi) hra.pocasi = Object.assign({}, hra.dalsi.pocasi);
  }

  /* ================= nepřátelé ================= */
  function vlastnosti(R) {
    const { KLICE_IMUNIT, UTOCNE } = D();
    const imm = R.vyber(KLICE_IMUNIT);
    const pool = UTOCNE.filter(k => k !== 'salupa'), res = {};
    const n = R.f() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) { const k = pool.splice(Math.floor(R.f() * pool.length), 1)[0]; res[k] = 0.25 + Math.floor(R.f() * 5) * 0.05; }
    return { imm, res };
  }

  function vytvorNepritele(hra, typ, x, y, hpMul, extra) {
    const def = D().NEPRATELE[typ];
    const tr = def.boss ? { imm: def.imunita || 'omraceni', res: {} } : vlastnosti(hra.R);
    if (def.imunita && !def.boss) tr.imm = def.imunita;
    const hp = Math.round(def.hp * (hpMul || 1));
    const e = Object.assign({
      id: hra.dalsiId++, typ, def, druh: def.druh, x, y, uhel: 0, hp, max: hp, ukol: def.ukol,
      imm: tr.imm, res: tr.res, zpomalF: 1, zpomalT: 0, omracT: 0, dot: null, stit: 0, utokCd: 0.5, krok: -1,
      vynoren: 0, obtocena: 0, navstivene: [], casovac: 0, casovac2: 0, zpozdeni: 0, ponor: def.ponor || 1,
    }, extra || {});
    hra.nepratele.push(e);
    return e;
  }

  function vylod(hra, e, p) {
    const kdo = e.naklad || [];
    kdo.forEach((typ, j) => {
      const n = vytvorNepritele(hra, typ, p.x + 0.5, p.y + 0.5, e.hpMul, { zpozdeni: j * 0.45 });
      n.krok = -1;
    });
    if (kdo.length) udalost(hra, { t: 'vysadek', x: p.x + 0.5, y: p.y + 0.5, n: kdo.length });
  }

  // nejbližší silniční pole k bodu (shoz z balonu, vylezlý krab)
  function nejblizsiCesta(hra, x, y) {
    const o = hra.o, { N, W } = O();
    let nej = -1, nd = Infinity;
    const pole = TK().poleCesty(o);
    for (let i = 0; i < N; i++) {
      if (!o.cesta[i] || pole.d[i] < 0) continue;
      const d = Math.hypot(i % W + 0.5 - x, ((i / W) | 0) + 0.5 - y);
      if (d < nd) { nd = d; nej = i; }
    }
    return nej < 0 ? null : { x: nej % W, y: (nej / W) | 0 };
  }

  function rychlost(hra, e) {
    if (e.omracT > 0 || e.zpozdeni > 0) return 0;
    if (hra.zmrazeno > 0 && e.druh !== 'pesi') return 0;
    let v = e.def.v * e.zpomalF;
    if (hra.pocasi.jev === 'boure') v *= 1.12;
    if (e.bubny) v *= 1.2;
    if ((e.druh === 'lod') && hra.pocasi.sila) {
      const vu = D().SMER_UHEL(hra.pocasi.smer);
      // vítr: SMER je odkud? Bereme „kam fouká“ – plachetnice po větru rychleji
      v *= 1 + 0.08 * hra.pocasi.sila * Math.cos(e.uhel - vu);
    }
    return v;
  }

  // pohyb po poli toků; vrací 'cil' (stojí na cílovém poli), 'jede', nebo 'uvizl'
  function pluj(hra, e, pole, dt, jenD4) {
    const o = hra.o, W = O().W;
    let i = ixy(e.x, e.y);
    if (e.krok < 0 || pole.d[e.krok] < 0) {
      if (pole.d[i] === 0) { e.krok = -1; return 'cil'; }
      if (pole.d[i] < 0) {
        // mimo pole (třeba výsadek mimo cestu): najdi nejbližší pole, které v něm je
        let nej = -1, nd = Infinity;
        for (let j = 0; j < pole.d.length; j++) if (pole.d[j] >= 0) { const d = Math.hypot(j % W + 0.5 - e.x, ((j / W) | 0) + 0.5 - e.y); if (d < nd) { nd = d; nej = j; } }
        if (nej < 0 || nd > 2.5) return 'uvizl';
        e.krok = nej;
      } else {
        e.krok = TK().dalsi(o, pole, i, jenD4);
        if (e.krok < 0) return 'uvizl';
      }
    }
    const tx = e.krok % W + 0.5, ty = ((e.krok / W) | 0) + 0.5;
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    const v = rychlost(hra, e) * dt;
    if (d > 0.001) {
      const cil = Math.atan2(dy, dx);
      let du = cil - e.uhel; while (du > Math.PI) du -= 2 * Math.PI; while (du < -Math.PI) du += 2 * Math.PI;
      e.uhel += du * Math.min(1, dt * (e.druh === 'pesi' ? 12 : 4));
    }
    if (v <= 0) return 'jede';
    if (d <= v) {
      e.x = tx; e.y = ty;
      const k = e.krok;
      e.krok = -1;
      vstupNaPole(hra, e, k);
      if (pole.d[k] === 0) return 'cil';
    } else { e.x += dx / d * v; e.y += dy / d * v; }
    return 'jede';
  }

  // pasti při vstupu na pole
  function vstupNaPole(hra, e, i) {
    const p = pastNaPoli(hra, i);
    if (!p) return;
    const def = D().PASTI[p.typ];
    if (e.druh === 'pesi') {
      if (p.typ === 'zatarasy') {
        if (e.def.saper) { odeberPast(hra, p); udalost(hra, { t: 'saper', x: p.x + 0.5, y: p.y + 0.5 }); return; }
        p.aktivni = true;
      }
      return;
    }
    if (e.druh !== 'lod' && e.druh !== 'tvor') return;
    if (p.typ === 'kuly') {
      poskod(hra, e, def.dmg, null, { past: true });
      if (--p.uses <= 0) odeberPast(hra, p);
    } else if (p.typ === 'mina') {
      udalost(hra, { t: 'vybuch', x: p.x + 0.5, y: p.y + 0.5, r: def.splash, voda: true });
      for (const n of hra.nepratele) if ((n.druh === 'lod' || n.druh === 'tvor') && Math.hypot(n.x - p.x - 0.5, n.y - p.y - 0.5) <= def.splash) poskod(hra, n, def.dmg, null, { past: true, pruraz: true });
      odeberPast(hra, p);
    }
  }

  // řetěz na dalším poli zastaví větší lodě
  function retezPred(hra, e) {
    if (e.druh !== 'lod' || e.ponor < 2 || e.krok < 0) return null;
    const p = pastNaPoli(hra, e.krok);
    return p && p.typ === 'retez' ? p : null;
  }

  function odhalen(hra, e, majaky) {
    for (const m of majaky) if (Math.hypot(e.x - m.x, e.y - m.y) <= m.r) return true;
    return false;
  }

  function viditelny(hra, e, majaky) {
    if (e.zpozdeni > 0) return false;
    if (e.def.ponoreny && !e.vynoren && !e.obtocena) return odhalen(hra, e, majaky);
    if (e.def.skryty && hra.pocasi.jev === 'mlha') return odhalen(hra, e, majaky);
    return true;
  }

  function aktualizujNepritele(hra, dt, majaky) {
    const o = hra.o, pr = hra.pocasi.priliv;
    const pevnost = stredPevnosti(hra);
    // bubeníci a mágové
    const pesi = hra.nepratele.filter(e => e.druh === 'pesi' && e.zpozdeni <= 0);
    for (const e of pesi) e.bubny = false;
    for (const b of pesi) {
      if (b.def.bubny) for (const e of pesi) if (e !== b && Math.hypot(e.x - b.x, e.y - b.y) <= 1.5) e.bubny = true;
      if (b.def.stity) {
        b.casovac2 -= dt;
        if (b.casovac2 <= 0) {
          b.casovac2 = 6;
          for (const e of pesi) if (Math.hypot(e.x - b.x, e.y - b.y) <= 1.5) e.stit = Math.max(e.stit, 2);
          udalost(hra, { t: 'stit', x: b.x, y: b.y });
        }
      }
    }
    for (const e of hra.nepratele.slice()) {
      if (e.hp <= 0) continue;
      if (e.zpozdeni > 0) { e.zpozdeni -= dt; continue; }
      if (e.omracT > 0) e.omracT -= dt;
      if (e.zpomalT > 0) { e.zpomalT -= dt; if (e.zpomalT <= 0) e.zpomalF = 1; }
      if (e.dot) {
        const dmg = e.dot.dps * dt;
        poskod(hra, e, dmg, e.dot.zdroj, { dot: true, pruraz: e.dot.kys, ohen: true });
        e.dot.t -= dt;
        if (e.dot && e.dot.t <= 0) e.dot = null;
        if (e.hp <= 0) continue;
      }
      e.utokCd -= dt;
      const def = e.def;
      if (e.druh === 'lod' || e.druh === 'tvor') aktualizujLod(hra, e, dt, pr, majaky);
      else if (e.druh === 'vzduch') aktualizujLetce(hra, e, dt, pevnost);
      else aktualizujPesiho(hra, e, dt, pevnost);
      if (e.pryc) { odeber(hra, e); continue; }
      // zvláštnosti bossů a některých druhů
      if (def.ohnivyDech) {
        e.casovac -= dt;
        if (e.casovac <= 0) {
          e.casovac = def.boss ? 4 : 5;
          let n = 0;
          for (const v of hra.veze) if (v.typ !== 'salupa' && dist(stred(v), e) <= 1.3 + (v.w || 1) / 2) { v.vyrazena = Math.max(v.vyrazena, 4); n++; }
          if (n) udalost(hra, { t: 'dech', x: e.x, y: e.y });
        }
      }
      if (def.mladata) {
        e.casovac2 -= dt;
        if (e.casovac2 <= 0) { e.casovac2 = 12; for (let k = 0; k < 2; k++) vytvorNepritele(hra, 'mlade', e.x + (k ? 0.4 : -0.4), e.y, e.hpMul * 0.8); }
      }
      if (def.zarVez) {
        e.casovac -= dt;
        if (e.casovac <= 0) {
          e.casovac = 4;
          for (const v of hra.veze) if (v.typ !== 'salupa' && dist(stred(v), e) <= 1.6 + (v.w || 1) / 2) v.vyrazena = Math.max(v.vyrazena, 2);
          udalost(hra, { t: 'dech', x: e.x, y: e.y, titan: true });
        }
      }
      if (def.chapadla && e.ukol === 'ostrel_stoji') {
        e.casovac -= dt;
        if (e.casovac <= 0) {
          e.casovac = 8;
          const blizke = hra.veze.filter(v => v.typ !== 'salupa' && dist(stred(v), e) <= 5.5).sort((a, b) => dist(stred(a), e) - dist(stred(b), e)).slice(0, 2);
          for (const v of blizke) { v.vyrazena = Math.max(v.vyrazena, 4); udalost(hra, { t: 'chapadlo', x: stred(v).x, y: stred(v).y }); }
        }
      }
      if (def.ponoreny && !def.chapadla) e.vynoren = Math.max(0, e.vynoren - dt);
    }
  }

  function aktualizujLod(hra, e, dt, pr, majaky) {
    const o = hra.o, def = e.def;
    if (hra.zmrazeno > 0) return;
    // admirál na polovině výdrže spustí čluny s mariňáky
    if (e.typ === 'admiral' && !e.spustilCluny && e.hp < e.max / 2) {
      e.spustilCluny = true;
      for (let k = 0; k < 2; k++) vytvorNepritele(hra, 'clun', e.x, e.y + (k ? 0.5 : -0.5), e.hpMul, { naklad: ['marinak', 'marinak', 'marinak'], hpMul: e.hpMul });
      udalost(hra, { t: 'banner', text: '⚓ Admirál spouští čluny s mariňáky!' });
    }
    if (def.teleport && e.ukol === 'vysadek') {
      e.casovac -= dt;
      if (e.casovac <= 0) {
        e.casovac = 10;
        const pole = TK().poleKPristani(o, e.ponor, pr), W = O().W;
        const mista = [];
        for (let i = 0; i < pole.d.length; i++) if (pole.d[i] >= 3 && pole.d[i] <= 8) mista.push(i);
        if (mista.length) {
          const i = mista[Math.floor(hra.R.f() * mista.length)];
          udalost(hra, { t: 'teleport', x: e.x, y: e.y });
          e.x = i % W + 0.5; e.y = ((i / W) | 0) + 0.5; e.krok = -1;
          udalost(hra, { t: 'teleport', x: e.x, y: e.y });
        }
      }
    }
    const ret = retezPred(hra, e);
    if (ret) {
      // zastaví se a přerazí řetěz
      ret.hp -= 25 * dt * (def.boss ? 4 : 1);
      if (ret.hp <= 0) { odeberPast(hra, ret); udalost(hra, { t: 'vybuch', x: ret.x + 0.5, y: ret.y + 0.5, r: 0.5, voda: true }); }
      return;
    }
    switch (e.ukol) {
      case 'vysadek': case 'vylez': {
        const pole = TK().poleKPristani(o, e.ponor, pr);
        const st = pluj(hra, e, pole, dt);
        if (st === 'cil') {
          const i = ixy(e.x, e.y);
          let p = TK().pristaniU(o, i, e.ponor);
          if (!p) p = o.pristani.slice().sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0];
          if (e.ukol === 'vylez') {
            // krab vyleze na pláž a jde po cestě dál
            e.druh = 'pesi'; e.ukol = 'pevnost'; e.x = p.x + 0.5; e.y = p.y + 0.5; e.krok = -1;
            udalost(hra, { t: 'vysadek', x: e.x, y: e.y, n: 1 });
            return;
          }
          if (def.opakovany) {
            e.casovac2 -= dt;
            if (e.casovac2 <= 0) { e.casovac2 = 12; vylod(hra, e, p); }
            return;
          }
          vylod(hra, e, p);
          e.ukol = 'odjezd'; e.krok = -1;
        } else if (st === 'uvizl') { e.ukol = 'odjezd'; e.krok = -1; }
        break;
      }
      case 'ostrel': {
        const cile = budovy(hra, !!e.def.boss);
        if (!cile.length) { e.ukol = 'odjezd'; e.krok = -1; break; }
        const pole = TK().poleOstrel(o, e.ponor, pr, cile, def.dosahU);
        const st = pluj(hra, e, pole, dt);
        if (st === 'cil') { e.ukol = 'ostrel_stoji'; e.krok = -1; e.vynoren = 1; }
        else if (st === 'uvizl') { e.ukol = 'odjezd'; e.krok = -1; }
        break;
      }
      case 'ostrel_stoji': {
        const cile = budovy(hra, !!e.def.boss).filter(b => dist(b, e) <= def.dosahU + 0.2);
        if (!cile.length) { e.ukol = budovy(hra, !!e.def.boss).length ? 'ostrel' : 'odjezd'; e.krok = -1; break; }
        if (def.chapadla) { e.casovac2 += dt; e.vynoren = (e.casovac2 % 10) < 6 ? 1 : 0; }
        // natočit bokem k cíli (plná salva jde z boku)
        const b = cile.sort((a, c) => dist(a, e) - dist(c, e))[0];
        const bok = Math.atan2(b.y - e.y, b.x - e.x) + Math.PI / 2;
        let du = bok - e.uhel; while (du > Math.PI) du -= 2 * Math.PI; while (du < -Math.PI) du += 2 * Math.PI;
        if (Math.abs(du) > Math.PI / 2) du = du > 0 ? du - Math.PI : du + Math.PI;
        e.uhel += du * Math.min(1, dt * 1.5);
        if (e.utokCd <= 0 && Math.abs(du) < 0.5) {
          let kad = def.kadU;
          if (majaky.some(m => m.oslepuje && Math.hypot(e.x - m.x, e.y - m.y) <= m.r)) kad /= 0.6;
          e.utokCd = kad;
          poskodBudovu(hra, b.ref, def.utok, { x: e.x, y: e.y, typ: e.typ });
          udalost(hra, { t: 'ostrel', x: e.x, y: e.y, tx: b.x, ty: b.y, kraken: e.typ === 'kraken' });
        }
        break;
      }
      case 'loupez': {
        if (hra.pristav.hp <= 0) { e.ukol = 'odjezd'; e.krok = -1; break; }
        const st = pluj(hra, e, TK().polePristav(o, e.ponor, pr), dt);
        if (st === 'cil') {
          if (def.utok) { e.ukol = 'hryze'; break; }
          const kolik = Math.min(hra.zlato, 25 + 3 * hra.vlna);
          hra.zlato -= kolik; hra.stat.ukradeno += kolik;
          poskodBudovu(hra, hra.pristav, 6, { x: e.x, y: e.y, typ: e.typ });
          udalost(hra, { t: 'loupez', x: e.x, y: e.y, n: kolik });
          e.ukol = 'odjezd'; e.krok = -1;
        } else if (st === 'uvizl') { e.ukol = 'odjezd'; e.krok = -1; }
        break;
      }
      case 'hryze': {
        if (hra.pristav.hp <= 0) { e.ukol = 'odjezd'; e.krok = -1; break; }
        if (e.utokCd <= 0) { e.utokCd = def.kadU; poskodBudovu(hra, hra.pristav, def.utok, { x: e.x, y: e.y, typ: e.typ }); }
        break;
      }
      case 'had': {
        // obtočit pobřežní věž; dokud had žije, věž mlčí
        if (e.obtocena) {
          const v = hra.veze.find(t => t.id === e.obtocena);
          e.casovac2 += dt;
          // po 20 s věž pustí a odpluje (jinak by vlna neskončila, když na něj nikdo nedostřelí)
          if (!v || e.casovac2 > 20) { e.obtocena = 0; e.hadCil = null; if (v) { e.ukol = 'odjezd'; e.krok = -1; } break; }
          v.vyrazena = Math.max(v.vyrazena, 0.2);
          e.vynoren = 1;
          break;
        }
        if (!e.hadCil || !hra.veze.some(v => v.id === e.hadCil.id)) {
          const obsazene = new Set(hra.nepratele.filter(n => n !== e && n.hadCil).map(n => n.hadCil.id));
          const kand = hra.veze.filter(v => v.typ !== 'salupa' && !obsazene.has(v.id) && O().uMore(o, v.x, v.y));
          if (!kand.length) { e.ukol = 'loupez'; e.def = Object.assign({}, def, { utok: 5, kadU: 1.5 }); e.krok = -1; break; }
          kand.sort((a, b) => dist(stred(a), e) - dist(stred(b), e));
          const v = kand[0], cile = [];
          for (let y = v.y - 1; y <= v.y + v.w; y++) for (let x = v.x - 1; x <= v.x + v.w; x++) if (O().uvnitr(x, y) && o.ter[O().idx(x, y)] === O().T.MORE) cile.push(O().idx(x, y));
          e.hadCil = { id: v.id, pole: TK().poleKCilum(o, cile, 1, pr) };
          e.krok = -1;
        }
        const st = pluj(hra, e, e.hadCil.pole, dt);
        if (st === 'cil') { e.obtocena = e.hadCil.id; udalost(hra, { t: 'banner', text: '🐍 Mořský had obtočil věž! Dokud žije, věž mlčí.', zly: true }); }
        else if (st === 'uvizl') { e.hadCil = null; e.ukol = 'odjezd'; }
        break;
      }
      case 'odjezd': default: {
        const st = pluj(hra, e, TK().poleOdjezd(o, 1, 1), dt);
        if (st === 'cil' || st === 'uvizl') e.pryc = true;
        break;
      }
    }
  }

  function aktualizujLetce(hra, e, dt, pevnost) {
    const def = e.def;
    if (hra.zmrazeno > 0 || e.omracT > 0) return;
    let cil;
    if (e.ukol === 'vez') {
      if (e.sedi > 0) {
        e.sedi -= dt;
        const v = hra.veze.find(t => t.id === e.sediNa);
        if (v) v.vyrazena = Math.max(v.vyrazena, 0.2);
        if (e.sedi <= 0 || !v) { e.navstivene.push(e.sediNa); e.sediNa = 0; if (e.navstivene.length >= 2) e.ukol = 'pevnost'; }
        return;
      }
      const kand = hra.veze.filter(v => v.typ !== 'salupa' && !e.navstivene.includes(v.id) && !hra.nepratele.some(n => n !== e && n.sediNa === v.id));
      if (!kand.length) { e.ukol = 'pevnost'; return; }
      let nej = kand[0], nd = Infinity;
      for (const v of kand) { const d = dist(stred(v), e); if (d < nd) { nd = d; nej = v; } }
      cil = stred(nej); e.cilVez = nej.id;
    } else if (e.ukol === 'shoz') {
      if (!e.cilBod) e.cilBod = (() => {
        const o = hra.o, pole = TK().poleCesty(o), W = O().W, mista = [];
        for (let i = 0; i < pole.d.length; i++) if (pole.d[i] >= 3 && pole.d[i] <= 9) mista.push(i);
        if (!mista.length) return pevnost;
        const i = mista[Math.floor(hra.R.f() * mista.length)];
        return { x: i % W + 0.5, y: ((i / W) | 0) + 0.5 };
      })();
      cil = e.cilBod;
    } else if (e.ukol === 'odlet') {
      cil = e.odletBod;
    } else cil = pevnost;
    const dx = cil.x - e.x, dy = cil.y - e.y, d = Math.hypot(dx, dy);
    const dosah = e.ukol === 'pevnost' ? 0.9 : 0.25;
    if (d <= dosah) {
      if (e.ukol === 'pevnost') vtrhni(hra, e);
      else if (e.ukol === 'vez') { e.sedi = 3; e.sediNa = e.cilVez; udalost(hra, { t: 'harpyje', x: e.x, y: e.y }); }
      else if (e.ukol === 'shoz') {
        const c = nejblizsiCesta(hra, e.x, e.y);
        if (c) vylod(hra, e, c);
        e.naklad = [];
        e.ukol = 'odlet';
        e.odletBod = { x: e.x < O().W / 2 ? -1 : O().W + 1, y: e.y };
      } else if (e.ukol === 'odlet') e.pryc = true;
      return;
    }
    let v = rychlost(hra, e);
    let vx = dx / d * v, vy = dy / d * v;
    const sila = hra.pocasi.sila * (hra.pocasi.jev === 'boure' ? 1.5 : 1);
    if (sila && def.unos) {
      const u = D().SMER_UHEL(hra.pocasi.smer);
      vx += Math.cos(u) * sila * def.unos * 0.12; vy += Math.sin(u) * sila * def.unos * 0.12;
    }
    e.x += vx * dt; e.y += vy * dt;
    if (e.ukol === 'odlet' && (e.x < -0.8 || e.x > O().W + 0.8)) e.pryc = true;
    e.uhel = Math.atan2(vy, vx);
  }

  // pěšák nebo letec u pevnosti: vtrhne dovnitř, ubere výdrž a zmizí (jako únik v TD)
  function vtrhni(hra, e) {
    const p = stredPevnosti(hra);
    poskodBudovu(hra, hra.pevnost, e.def.vtrh || 2, { x: e.x, y: e.y, typ: e.typ });
    udalost(hra, { t: 'vtrh', x: e.x, y: e.y, tx: p.x, ty: p.y, n: e.def.vtrh || 2 });
    hra.stat.uniklo++;
    e.pryc = true;
  }

  function aktualizujPesiho(hra, e, dt, pevnost) {
    const def = e.def;
    // střelec zůstane stát na dostřel a pálí na pevnost, dokud ho něco nezastřelí
    if (def.dosahU && (e.ukol === 'utoci' || dist(e, pevnost) <= def.dosahU)) {
      e.ukol = 'utoci';
      if (e.utokCd <= 0 && e.omracT <= 0) { e.utokCd = def.kadU; poskodBudovu(hra, hra.pevnost, def.utok, { x: e.x, y: e.y, typ: e.typ }); udalost(hra, { t: 'utok', x: e.x, y: e.y, tx: pevnost.x, ty: pevnost.y, strela: true }); }
      return;
    }
    if (e.ukol === 'utoci') { vtrhni(hra, e); return; }
    // zátarasy na poli pod ním
    const i = ixy(e.x, e.y);
    const p = pastNaPoli(hra, i);
    if (p && p.typ === 'zatarasy' && p.aktivni && e.imm !== 'zpomaleni') { e.zpomalF = Math.min(e.zpomalF, D().PASTI.zatarasy.zpomal); e.zpomalT = Math.max(e.zpomalT, 0.15); }
    const st = pluj(hra, e, TK().poleCesty(hra.o), dt, true);
    if (st === 'cil') vtrhni(hra, e);
    else if (st === 'uvizl') {
      // mimo cestu (nemělo by nastat): jdi přímo k pevnosti
      const dx = pevnost.x - e.x, dy = pevnost.y - e.y, d = Math.hypot(dx, dy), v = rychlost(hra, e) * dt;
      if (d < 1.2) vtrhni(hra, e); else { e.x += dx / d * v; e.y += dy / d * v; }
    }
  }

  function odeber(hra, e) {
    const i = hra.nepratele.indexOf(e);
    if (i >= 0) hra.nepratele.splice(i, 1);
  }

  /* ================= poškození ================= */
  function poskod(hra, e, dmg, zdroj, opt) {
    if (e.hp <= 0) return;
    opt = opt || {};
    const def = e.def, druh = e.druh;
    if (!opt.dot && e.stit > 0) { e.stit--; udalost(hra, { t: 'stitZasah', x: e.x, y: e.y }); return; }
    if (opt.ohen && e.imm === 'ohen') return;
    let d = dmg;
    if (zdroj && e.res[zdroj.typ]) d *= 1 - e.res[zdroj.typ];
    if (opt.ohen && def.slabyOhen) d *= 1.5;
    if ((druh === 'lod' || druh === 'tvor')) {
      if (hra.artefakty.has('inkoust')) d *= 1.12;
      if (opt.protiLodim) d *= opt.protiLodim;
    }
    if (druh === 'vzduch' && hra.artefakty.has('pero')) d *= 1.15;
    if (opt.krit && e.imm !== 'krit' && hra.R.f() < opt.krit) { d *= 3; udalost(hra, { t: 'krit', x: e.x, y: e.y }); }
    if (def.pancir && !opt.pruraz && !opt.dot) d = Math.max(d * 0.25, d - def.pancir);
    e.hp -= d;
    if (zdroj && zdroj.typ !== 'salupa' && opt.past == null) zdroj.dmg = (zdroj.dmg || 0) + d;
    if (e.def.ponoreny && !opt.dot) e.vynoren = Math.max(e.vynoren, 1.5);
    if (e.hp <= 0) zabij(hra, e, zdroj);
  }

  function zabij(hra, e, zdroj) {
    const def = e.def;
    let zl = def.odmena * 1.3;
    if (hra.pocasi.jev === 'jasno') zl *= 1.25;
    if (hra.artefakty.has('poklad')) zl *= 1.15;
    zl = Math.round(zl);
    hra.zlato += zl; hra.skore += def.odmena; hra.stat.zabito++;
    udalost(hra, { t: 'smrt', x: e.x, y: e.y, druh: e.druh, typ: e.typ, zlato: zl, boss: !!def.boss });
    if (zdroj && hra.veze.includes(zdroj)) { zdroj.zabiti = (zdroj.zabiti || 0) + 1; ziskejXP(hra, zdroj, def.odmena * 2); }
    // sestřelený balon shodí polovinu výsadku
    if (e.typ === 'balon' && e.naklad && e.naklad.length) {
      const c = nejblizsiCesta(hra, e.x, e.y);
      if (c) vylod(hra, Object.assign({}, e, { naklad: e.naklad.slice(0, Math.ceil(e.naklad.length / 2)) }), c);
    }
    if (def.boss) {
      udalost(hra, { t: 'boss', typ: e.typ });
      hra.bossPadl = (hra.bossPadl || 0) + 1;
    }
    if (e.obtocena) e.obtocena = 0;
    odeber(hra, e);
  }

  function ziskejXP(hra, src, kolik) {
    const pred = hodnost(src);
    src.xp = (src.xp || 0) + kolik;
    if (hodnost(src) > pred) udalost(hra, { t: 'povyseni', x: stredVeze(src).x, y: stredVeze(src).y, h: D().HODNOSTI[hodnost(src)].n, typ: src.typ });
    const podil = Math.round(kolik * 0.3);
    if (!podil || src.typ === 'salupa') return;
    for (const o of hra.veze) {
      if (o === src || o.typ === 'salupa') continue;
      if (chebDist(src, o) > Math.max(dosahAury(o), dosahAury(src))) continue;
      const p = hodnost(o);
      o.xp = (o.xp || 0) + podil;
      if (hodnost(o) > p) udalost(hra, { t: 'povyseni', x: stred(o).x, y: stred(o).y, h: D().HODNOSTI[hodnost(o)].n, typ: o.typ });
    }
  }

  /* ================= střelba věží ================= */
  function lzeZasahnout(e, cile, hra, majaky) {
    if (e.hp <= 0 || e.zpozdeni > 0) return false;
    if (e.druh === 'vzduch') return cile.includes('v');
    if (e.druh === 'pesi') return cile.includes('s');
    if (!cile.includes('m')) return false;
    return viditelny(hra, e, majaky);
  }
  function zbyva(hra, e) {
    if (e.druh === 'pesi') { const d = TK().poleCesty(hra.o).d[ixy(e.x, e.y)]; return d >= 0 ? d : 30; }
    return dist(e, stredPevnosti(hra));
  }
  function vyberCile(hra, v, s, pos, majaky, n) {
    const kand = [];
    for (const e of hra.nepratele) {
      if (!lzeZasahnout(e, s.cile, hra, majaky)) continue;
      const d = dist(e, pos);
      if (d > s.dosah + e.def.vel * 0.4) continue;
      if (s.min && d < s.min) continue;
      kand.push(e);
    }
    if (!kand.length) return kand;
    const pr = v.priorita || 'prvni';
    const klic = pr === 'silny' ? e => -e.hp : pr === 'slaby' ? e => e.hp : pr === 'blizko' ? e => dist(e, pos) : e => zbyva(hra, e) - (e.def.boss ? 0.5 : 0);
    kand.sort((a, b) => klic(a) - klic(b));
    return kand.slice(0, n);
  }

  function strelba(hra, dt, majaky) {
    for (const v of hra.veze) {
      const def = D().VEZE[v.typ];
      if (v.vyrazena > 0) v.vyrazena -= dt;
      if (def.podpora) continue;
      v.cd -= dt;
      if (v.typ === 'salupa') pohniSalupou(hra, v, dt, majaky);
      if (v.vyrazena > 0 || v.cd > 0) continue;
      const s = staty(hra, v), pos = stredVeze(v);
      const cile = vyberCile(hra, v, s, pos, majaky, s.terce);
      if (!cile.length) continue;
      v.cd = s.kad;
      v.uhel = Math.atan2(cile[0].y - pos.y, cile[0].x - pos.x);
      for (const e of cile) vystrel(hra, v, s, pos, e, majaky);
    }
    // vlastní dělo pevnosti
    hra.pevnostCd -= dt;
    if (hra.pevnostCd <= 0 && hra.pevnost.hp > 0) {
      const p = stredPevnosti(hra);
      let nej = null, nd = 3.2;
      for (const e of hra.nepratele) { if (e.zpozdeni > 0 || (e.druh !== 'pesi' && e.druh !== 'vzduch')) continue; const d = dist(e, p); if (d < nd) { nd = d; nej = e; } }
      if (nej) {
        hra.pevnostCd = 1.2;
        hra.strely.push({ druh: 'koule', x: p.x, y: p.y - 0.3, cil: nej.id, dmg: 10, v: 7, zdroj: null, s: {} });
        udalost(hra, { t: 'vystrel', typ: 'pevnost', x: p.x, y: p.y });
      }
    }
  }

  function vystrel(hra, v, s, pos, e, majaky) {
    const def = D().VEZE[v.typ];
    udalost(hra, { t: 'vystrel', typ: v.typ, x: pos.x, y: pos.y, tx: e.x, ty: e.y, mega: v.mega });
    const zakl = { zdroj: v, s, dmg: s.dmg };
    switch (def.strela) {
      case 'kulka': {
        poskod(hra, e, s.strzeni && e.druh === 'vzduch' ? s.dmg * 1.6 : s.dmg, v, { krit: s.krit });
        poZasahu(hra, e, v, s);
        break;
      }
      case 'blesk': {
        const body = [{ x: pos.x, y: pos.y - 0.3 }];
        let akt = e; const zasazene = new Set();
        let dmg = s.dmg;
        for (let k = 0; k <= s.retez && akt; k++) {
          zasazene.add(akt.id);
          body.push({ x: akt.x, y: akt.y });
          poskod(hra, akt, dmg, v, { krit: s.krit });
          if (hra.R.f() < s.omrac && akt.imm !== 'omraceni') akt.omracT = Math.max(akt.omracT, 0.8);
          poZasahu(hra, akt, v, s);
          dmg *= 0.85;
          let dalsi = null, nd = 1.8;
          for (const n of hra.nepratele) { if (zasazene.has(n.id) || !lzeZasahnout(n, s.cile, hra, majaky)) continue; const d = dist(n, akt); if (d < nd) { nd = d; dalsi = n; } }
          akt = dalsi;
        }
        udalost(hra, { t: 'blesk', body });
        break;
      }
      case 'granat': {
        // obloukem na místo, kde cíl bude za dobu letu (hrubý odhad), bouře rozhodí mušku
        const t = 0.9;
        let tx = e.x, ty = e.y;
        if (e.krok >= 0) { const W = O().W, kx = e.krok % W + 0.5, ky = ((e.krok / W) | 0) + 0.5, dd = Math.hypot(kx - e.x, ky - e.y) || 1, sp = rychlost(hra, e) * t * 0.7; tx += (kx - e.x) / dd * Math.min(sp, dd); ty += (ky - e.y) / dd * Math.min(sp, dd); }
        if (hra.pocasi.jev === 'boure') { tx += (hra.R.f() - 0.5) * 0.8; ty += (hra.R.f() - 0.5) * 0.8; }
        hra.strely.push(Object.assign({ druh: 'granat', x: pos.x, y: pos.y, sx: pos.x, sy: pos.y, tx, ty, t: 0, T: t, cile: s.cile, navadeni: s.navadeni }, zakl));
        break;
      }
      case 'ohen': {
        hra.strely.push(Object.assign({ druh: 'ohen', x: pos.x, y: pos.y, sx: pos.x, sy: pos.y, tx: e.x, ty: e.y, t: 0, T: 0.55 }, zakl));
        break;
      }
      default: // sip, koule, harpuna – samonaváděné
        hra.strely.push(Object.assign({ druh: def.strela, x: pos.x, y: pos.y, cil: e.id, v: def.strela === 'koule' ? 7.5 : 10 }, zakl));
    }
  }

  function poZasahu(hra, e, v, s) {
    if (e.hp <= 0) return;
    if (s.auraZpomal && e.imm !== 'zpomaleni') { e.zpomalF = Math.min(e.zpomalF, 0.8); e.zpomalT = Math.max(e.zpomalT, 0.8); }
    if (s.auraOhen && e.imm !== 'ohen') e.dot = { dps: Math.max(e.dot ? e.dot.dps : 0, s.auraOhen), t: 2, zdroj: v, kys: false };
    if (s.omrac && v.typ !== 'mag' && e.imm !== 'omraceni' && hra.R.f() < s.omrac) e.omracT = Math.max(e.omracT, 0.6);
  }

  function aktualizujStrely(hra, dt, majaky) {
    for (const p of hra.strely.slice()) {
      if (p.druh === 'granat' || p.druh === 'ohen') {
        p.t += dt;
        const k = Math.min(1, p.t / p.T);
        p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k; p.z = Math.sin(k * Math.PI) * (p.druh === 'granat' ? 1.4 : 0.8);
        if (k >= 1) {
          hra.strely.splice(hra.strely.indexOf(p), 1);
          if (p.druh === 'granat') {
            udalost(hra, { t: 'vybuch', x: p.tx, y: p.ty, r: p.s.splash, voda: O().jeVodaT(hra.o.ter[ixy(p.tx, p.ty)]) });
            for (const e of hra.nepratele.slice()) {
              if (e.druh === 'vzduch' || e.zpozdeni > 0) continue;
              if ((e.druh === 'lod' || e.druh === 'tvor') && !p.navadeni && !viditelny(hra, e, majaky)) continue;
              if (e.druh === 'pesi' && !p.cile.includes('s')) continue;
              const d = Math.hypot(e.x - p.tx, e.y - p.ty);
              if (d <= p.s.splash + e.def.vel * 0.3) { poskod(hra, e, p.dmg * (d < 0.35 ? 1 : 0.7), p.zdroj, { krit: p.s.krit }); poZasahu(hra, e, p.zdroj, p.s); }
            }
            if (p.s.ohen) hra.plochy.push({ x: p.tx, y: p.ty, r: p.s.ohenR, dps: p.s.ohen, t: p.s.ohenT, T: p.s.ohenT, zdroj: p.zdroj, kys: false });
          } else {
            hra.plochy.push({ x: p.tx, y: p.ty, r: p.s.ohenR, dps: p.s.ohen, t: p.s.ohenT, T: p.s.ohenT, zdroj: p.zdroj, kys: p.s.kys });
            udalost(hra, { t: 'zapaleni', x: p.tx, y: p.ty });
          }
        }
        continue;
      }
      const e = hra.nepratele.find(n => n.id === p.cil);
      if (!e) { hra.strely.splice(hra.strely.indexOf(p), 1); continue; }
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy), krok = p.v * dt;
      p.uhel = Math.atan2(dy, dx);
      if (d <= krok + 0.1) {
        hra.strely.splice(hra.strely.indexOf(p), 1);
        const s = p.s;
        if (p.zdroj == null) { poskod(hra, e, p.dmg, null, {}); continue; }
        if (s.splash) {
          udalost(hra, { t: 'vybuch', x: e.x, y: e.y, r: s.splash, voda: e.druh !== 'pesi' && e.druh !== 'vzduch', male: true });
          for (const n of hra.nepratele.slice()) {
            if (n === e || n.druh === 'vzduch' || n.druh === 'pesi' && !s.cile.includes('s')) continue;
            if (Math.hypot(n.x - e.x, n.y - e.y) <= s.splash) poskod(hra, n, p.dmg * 0.5, p.zdroj, { pruraz: s.pruraz, protiLodim: s.protiLodim });
          }
        }
        poskod(hra, e, p.dmg, p.zdroj, { pruraz: s.pruraz, krit: s.krit, protiLodim: s.protiLodim });
        if (e.hp > 0) {
          if (p.druh === 'harpuna') {
            if (e.imm !== 'zpomaleni') { e.zpomalF = Math.min(e.zpomalF, s.zpomal || 0.7); e.zpomalT = Math.max(e.zpomalT, s.zpomalT || 1); }
            if (s.sit && e.druh === 'vzduch' && e.imm !== 'omraceni') e.omracT = Math.max(e.omracT, 1.5);
          }
          if (s.retezK && e.druh === 'lod' && e.imm !== 'zpomaleni') { e.zpomalF = Math.min(e.zpomalF, 0.5); e.zpomalT = Math.max(e.zpomalT, 2); }
          if (s.zhave && e.imm !== 'ohen') e.dot = { dps: Math.max(e.dot ? e.dot.dps : 0, 8 + p.dmg * 0.1), t: 3, zdroj: p.zdroj, kys: false };
          poZasahu(hra, e, p.zdroj, s);
        }
      } else { p.x += dx / d * krok; p.y += dy / d * krok; }
    }
    // hořící plochy
    for (const f of hra.plochy.slice()) {
      f.t -= dt;
      if (f.t <= 0) { hra.plochy.splice(hra.plochy.indexOf(f), 1); continue; }
      for (const e of hra.nepratele.slice()) {
        if (e.druh === 'vzduch' || e.zpozdeni > 0) continue;
        if (Math.hypot(e.x - f.x, e.y - f.y) <= f.r + e.def.vel * 0.3) poskod(hra, e, f.dps * dt, hra.veze.includes(f.zdroj) ? f.zdroj : null, { dot: true, ohen: true, pruraz: f.kys });
      }
    }
  }

  /* ================= šalupa ================= */
  function pohniSalupou(hra, v, dt, majaky) {
    const o = hra.o, pr = hra.pocasi.priliv, s = staty(hra, v);
    const ponor = 2, rych = D().VEZE.salupa.rychlost * (v.spec === 1 ? 1.5 : 1);
    const hl = { x: v.hlidka.x + 0.5, y: v.hlidka.y + 0.5 };
    // cíl: nepřítel na moři do 4 polí od místa hlídky, jinak samotné místo hlídky
    let cil = null, nd = Infinity;
    for (const e of hra.nepratele) {
      if (!(e.druh === 'lod' || e.druh === 'tvor') || !viditelny(hra, e, majaky)) continue;
      if (dist(e, hl) > 4.5) continue;
      const d = dist(e, { x: v.px, y: v.py });
      if (d < nd) { nd = d; cil = e; }
    }
    const kam = cil && nd > s.dosah * 0.8 ? cil : (!cil ? hl : null);
    if (!kam) return;
    const ci = ixy(kam.x, kam.y);
    const klic = 'salupa:' + ci + ':' + pr, M = o._toky || (o._toky = new Map());
    let pole = M.get(klic);
    if (!pole) { pole = TK().poleKCilum(o, [ci], ponor, pr); if (M.size > 120) M.clear(); M.set(klic, pole); }
    const i = ixy(v.px, v.py);
    if (pole.d[i] <= 0) return;
    const n = TK().dalsi(o, pole, i, false);
    if (n < 0) return;
    const W = O().W, tx = n % W + 0.5, ty = ((n / W) | 0) + 0.5;
    const dx = tx - v.px, dy = ty - v.py, d = Math.hypot(dx, dy), k = rych * dt;
    v.smer = Math.atan2(dy, dx);
    if (d <= k) { v.px = tx; v.py = ty; } else { v.px += dx / d * k; v.py += dy / d * k; }
    v.x = Math.floor(v.px); v.y = Math.floor(v.py);
  }
  function nastavHlidku(hra, v, x, y) {
    if (v.typ !== 'salupa' || !O().uvnitr(x, y) || hra.o.ter[O().idx(x, y)] !== O().T.MORE) return false;
    if (!O().splavne(hra.o, O().idx(x, y), 2, hra.pocasi.priliv)) return false;
    v.hlidka = { x, y };
    return true;
  }

  /* ================= schopnosti ================= */
  function nabijeni(hra, k) { return D().SCHOPNOSTI[k].max * (hra.artefakty.has('roh') ? 0.75 : 1); }
  function salva(hra, x, y) {
    const s = hra.schopnosti.salva;
    if (s.cd > 0 || hra.konec) return false;
    // jen na moře a pobřeží: do 2 polí od vody
    const o = hra.o;
    let blizkoVody = false;
    for (let yy = Math.floor(y) - 2; yy <= Math.floor(y) + 2; yy++) for (let xx = Math.floor(x) - 2; xx <= Math.floor(x) + 2; xx++) if (O().uvnitr(xx, yy) && O().jeVodaT(o.ter[O().idx(xx, yy)])) blizkoVody = true;
    if (!blizkoVody) return false;
    s.cd = nabijeni(hra, 'salva');
    udalost(hra, { t: 'salva', x, y });
    for (const e of hra.nepratele.slice()) if (e.druh !== 'vzduch' && e.zpozdeni <= 0 && Math.hypot(e.x - x, e.y - y) <= 1.6) poskod(hra, e, 140, null, { pruraz: true });
    return true;
  }
  function brander(hra) {
    const s = hra.schopnosti.brander;
    if (s.cd > 0 || hra.konec || hra.pristav.hp <= 0) return false;
    s.cd = nabijeni(hra, 'brander');
    const d = hra.o.pristav.dok;
    hra.branderi.push({ x: d.x + 0.5, y: d.y + 0.5, t: 25, uhel: 0 });
    udalost(hra, { t: 'brander', x: d.x + 0.5, y: d.y + 0.5 });
    return true;
  }
  function zpev(hra) {
    const s = hra.schopnosti.zpev;
    if (s.cd > 0 || hra.konec) return false;
    s.cd = nabijeni(hra, 'zpev');
    hra.zmrazeno = 4;
    udalost(hra, { t: 'zpev' });
    return true;
  }
  function aktualizujBrandery(hra, dt) {
    const o = hra.o;
    for (const b of hra.branderi.slice()) {
      b.t -= dt;
      let cil = null, nd = Infinity;
      for (const e of hra.nepratele) { if (e.druh !== 'lod' && e.druh !== 'tvor') continue; const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < nd) { nd = d; cil = e; } }
      if (!cil || b.t <= 0) { if (b.t <= 0) hra.branderi.splice(hra.branderi.indexOf(b), 1); continue; }
      if (nd < 0.5) {
        hra.branderi.splice(hra.branderi.indexOf(b), 1);
        udalost(hra, { t: 'vybuch', x: b.x, y: b.y, r: 1.2, voda: true, velky: true });
        for (const e of hra.nepratele.slice()) if (e.druh !== 'vzduch' && e.druh !== 'pesi' && Math.hypot(e.x - b.x, e.y - b.y) <= 1.3) poskod(hra, e, 260, null, { pruraz: true, ohen: false });
        continue;
      }
      // pluje po vodě k cíli (pole toků ponoru 1)
      const ci = ixy(cil.x, cil.y);
      const klic = 'brander:' + ci, M = o._toky || (o._toky = new Map());
      let pole = M.get(klic);
      if (!pole) { pole = TK().poleKCilum(o, [ci], 1, 1); M.set(klic, pole); }
      const i = ixy(b.x, b.y);
      let tx = cil.x, ty = cil.y;
      if (pole.d[i] > 1) { const n = TK().dalsi(o, pole, i, false); if (n >= 0) { tx = n % O().W + 0.5; ty = ((n / O().W) | 0) + 0.5; } }
      const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1, k = 3 * dt;
      b.uhel = Math.atan2(dy, dx);
      b.x += dx / d * Math.min(k, d); b.y += dy / d * Math.min(k, d);
    }
  }

  /* ================= hlavní krok ================= */
  function majakyHry(hra) {
    const m = [];
    for (const v of hra.veze) if (v.typ === 'majak') { const s = staty(hra, v); m.push({ x: v.x + v.w / 2, y: v.y + v.w / 2, r: s.dosah, oslepuje: v.spec === 0 }); }
    return m;
  }

  function krok(hra) {
    if (hra.konec) return;
    const dt = KROK;
    hra.cas += dt;
    for (const k in hra.schopnosti) if (hra.schopnosti[k].cd > 0) hra.schopnosti[k].cd = Math.max(0, hra.schopnosti[k].cd - dt);
    if (hra.zmrazeno > 0) hra.zmrazeno -= dt;
    if (!hra.vlnaBezi) {
      // mezi vlnami jen dojedou šalupy na místo hlídky
      const m = majakyHry(hra);
      for (const v of hra.veze) if (v.typ === 'salupa') pohniSalupou(hra, v, dt, m);
      return;
    }
    hra.casVlny += dt;
    while (hra.fronta.length && hra.fronta[0].cas <= hra.casVlny) {
      const f = hra.fronta.shift();
      let sx = f.nx + 0.5, sy = f.ny + 0.5;
      if (D().NEPRATELE[f.typ].druh === 'pesi') {
        // pěší boss (titán) se vynoří z moře na nejbližší pláži
        const p = hra.o.pristani.slice().sort((a, b) => Math.hypot(a.x - f.nx, a.y - f.ny) - Math.hypot(b.x - f.nx, b.y - f.ny))[0];
        sx = p.x + 0.5; sy = p.y + 0.5;
        udalost(hra, { t: 'vysadek', x: sx, y: sy, n: 1 });
      }
      const e = vytvorNepritele(hra, f.typ, sx, sy, f.hpMul, { naklad: f.naklad, hpMul: f.hpMul });
      e.uhel = Math.atan2(O().H / 2 - e.y, O().W / 2 - e.x);
      if (e.def.boss) udalost(hra, { t: 'banner', text: '⚠️ ' + e.def.ikona + ' ' + e.def.nazev + ' se blíží!', zly: true });
    }
    // pojistka: po 4 minutách vlny se lodě a tvorové stáhnou (kromě bossů)
    if (hra.casVlny > 240) for (const e of hra.nepratele) if ((e.druh === 'lod' || e.druh === 'tvor') && !e.def.boss && e.ukol !== 'odjezd') { e.ukol = 'odjezd'; e.krok = -1; e.obtocena = 0; }
    const majaky = majakyHry(hra);
    aktualizujNepritele(hra, dt, majaky);
    strelba(hra, dt, majaky);
    aktualizujStrely(hra, dt, majaky);
    aktualizujBrandery(hra, dt);
    // sklady opravují budovy
    const sklady = hra.veze.filter(v => v.typ === 'sklad');
    if (sklady.length) {
      hra.opravSklad += dt * sklady.reduce((a, v) => a + (v.spec === 0 ? 2 : 1) * (v.super ? 9 : v.mega ? 3 : 1) * (1 + 0.25 * (v.uroven - 1)), 0);
      while (hra.opravSklad >= 8) {
        hra.opravSklad -= 8;
        for (const b of [hra.pevnost, hra.pristav, ...hra.vesnice]) if (b.hp > 0 && b.hp < b.max) b.hp = Math.min(b.max, b.hp + 1);
      }
    }
    if (hra.konec) return;
    if (!hra.fronta.length && !hra.nepratele.length) konecVlny(hra);
  }

  /* ================= ukládání ================= */
  function serializuj(hra) {
    return {
      verze: 1, seed: hra.seed, biom: hra.biom, obtiznost: hra.obtiznost, rezim: hra.rezim, ostrovIndex: hra.ostrovIndex,
      maxVln: hra.maxVln === Infinity ? null : hra.maxVln, boss: hra.bossTyp, zlato: hra.zlato, skore: hra.skore, vlna: hra.vlna,
      pevnost: hra.pevnost, pristav: hra.pristav, vesnice: hra.vesnice, artefakty: [...hra.artefakty], stat: hra.stat,
      veze: hra.veze.map(v => { const c = Object.assign({}, v); delete c.dmg; return c; }),
      pasti: hra.pasti, dalsiId: hra.dalsiId, vyhraOstrova: hra.vyhraOstrova,
    };
  }
  function obnovZeZaznamu(z) {
    const hra = nova({ seed: z.seed, biom: z.biom, obtiznost: z.obtiznost, rezim: z.rezim, ostrovIndex: z.ostrovIndex, maxVln: z.maxVln || Infinity, boss: z.boss, zlato: z.zlato, skore: z.skore, artefakty: z.artefakty });
    hra.vlna = z.vlna; hra.pevnost = z.pevnost; hra.pristav = z.pristav; hra.vesnice = z.vesnice; hra.stat = z.stat;
    hra.dalsiId = z.dalsiId; hra.vyhraOstrova = !!z.vyhraOstrova;
    for (const v of z.veze) {
      const n = Object.assign({}, v, { cd: 0, vyrazena: 0 });
      hra.veze.push(n);
      if (n.typ !== 'salupa') for (let y = n.y; y < n.y + n.w; y++) for (let x = n.x; x < n.x + n.w; x++) hra.obsazeno[O().idx(x, y)] = n.id;
    }
    for (const p of z.pasti) { hra.pasti.push(Object.assign({}, p)); hra.pastNa[O().idx(p.x, p.y)] = p.id; }
    pripravDalsi(hra);
    if (hra.dalsi) hra.pocasi = Object.assign({}, hra.dalsi.pocasi);
    return hra;
  }

  OBL.sim = {
    KROK, nova, krok, spustVlnu, nahled, pripravDalsi,
    lzeStavet, postav, cenaStavby, vylepsi, cenaVylepseni, maxUroven, specializuj, prodej, prodejniCena,
    najdiCtverici, slouc, lzePast, postavPast, odeberPast, obnov, cenaObnovy, nastavHlidku,
    salva, brander, zpev, nabijeni, staty, bonusySousedu, hodnost, dosahAury, chebDist, stredVeze, stredPevnosti,
    viditelny, majakyHry, budovy, serializuj, obnovZeZaznamu, poskod,
  };
})(globalThis.OBL = globalThis.OBL || {});
