/* Modelář 3D – transformace uzlů (bez DOM, jde v node).
   Všechny funkce berou dokument a vrací nový (neměnné úpravy), zamčené
   uzly se nehýbou. Pracovní rovina: { puvod: [x,y,z], osy: [u, v, n] }
   (ortonormální báze, n je normála); deska = M.ROVINA_DESKY. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const V = THREE.Vector3;

  M.ROVINA_DESKY = { puvod: [0, 0, 0], osy: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };

  /** Kvaternion natočení roviny (lokální X, Y, Z → u, v, n). */
  M.quatRoviny = function (r) {
    const m = new THREE.Matrix4().makeBasis(new V(...r.osy[0]), new V(...r.osy[1]), new V(...r.osy[2]));
    return new THREE.Quaternion().setFromRotationMatrix(m);
  };

  /** Rovina v bodě s normálou n; osa u je průmět světové X (nebo Y). */
  M.rovinaZBodu = function (bod, normala) {
    const n = new V(...normala).normalize();
    let u = new V(1, 0, 0).sub(n.clone().multiplyScalar(n.x));
    if (u.lengthSq() < 1e-6) u = new V(0, 1, 0).sub(n.clone().multiplyScalar(n.y));
    u.normalize();
    const v = new V().crossVectors(n, u);
    const c = x => Math.abs(x) < 1e-12 ? 0 : x;
    return { puvod: bod.slice(), osy: [u.toArray().map(c), v.toArray().map(c), n.toArray().map(c)] };
  };

  const zamcene = (dok, ids) => {
    const set = new Set(ids);
    return dok.uzly.filter(u => set.has(u.id) && !u.zamceno);
  };

  /** Společná světová obálka uzlů. */
  M.obalkaVice = function (uzly) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const u of uzly) {
      const o = M.obalkaUzlu(u);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], o.min[k]); max[k] = Math.max(max[k], o.max[k]); }
    }
    return { min, max, stred: [0, 1, 2].map(k => (min[k] + max[k]) / 2) };
  };

  M.posunUzly = function (dok, ids, d) {
    return M.upravUzly(dok, zamcene(dok, ids).map(u => u.id), u => ({ poloha: u.poloha.map((v, i) => v + d[i]) }));
  };

  /** Otočení kolem světové osy (vektor) procházející bodem stred, úhel ve stupních. */
  M.otocUzly = function (dok, ids, osa, uhel, stred) {
    const qa = new THREE.Quaternion().setFromAxisAngle(new V(...osa).normalize(), uhel * M.st);
    const c = new V(...stred);
    return M.upravUzly(dok, zamcene(dok, ids).map(u => u.id), u => {
      const p = new V(...u.poloha).sub(c).applyQuaternion(qa).add(c);
      return { poloha: p.toArray().map(x => Math.round(x * 1e9) / 1e9), rotace: M.rotaceZQuat(qa.clone().multiply(M.quatUzlu(u))) };
    });
  };

  /** Zrcadlení podle světové osy (0 X, 1 Y, 2 Z) přes rovinu procházející bodem stred.
      S·R·Z(m) = (S·R·L_b)·Z(m ⊕ b): b je lokální osa nejbližší ose zrcadlení,
      takže nenatočené těleso rotaci nezmění. */
  M.zrcadliUzly = function (dok, ids, osa, stred) {
    return M.upravUzly(dok, zamcene(dok, ids).map(u => u.id), u => {
      const R = new THREE.Matrix4().makeRotationFromQuaternion(M.quatUzlu(u));
      const e = R.elements;                         // sloupce = lokální osy ve světě
      let b = 0;
      for (let k = 1; k < 3; k++) if (Math.abs(e[k * 4 + osa]) > Math.abs(e[b * 4 + osa])) b = k;
      const S = new THREE.Matrix4().makeScale(osa === 0 ? -1 : 1, osa === 1 ? -1 : 1, osa === 2 ? -1 : 1);
      const L = new THREE.Matrix4().makeScale(b === 0 ? -1 : 1, b === 1 ? -1 : 1, b === 2 ? -1 : 1);
      const Rn = S.clone().multiply(R).multiply(L);
      const zrcadlo = u.zrcadlo.slice(); zrcadlo[b] = !zrcadlo[b];
      const poloha = u.poloha.slice(); poloha[osa] = 2 * stred[osa] - poloha[osa];
      return { poloha, rotace: M.rotaceZQuat(new THREE.Quaternion().setFromRotationMatrix(Rn)), zrcadlo };
    });
  };

  /** Zarovnání uzlů na společnou obálku: kde = 'min' | 'stred' | 'max'. */
  /** Šum z float32 vrcholů (relativně ~1e-7): hodnota těsně u násobku desetitisíciny mm se na něj dorovná,
      jiné hodnoty zůstanou (na 1e-9). */
  function bezSumu(x) {
    const r = Math.round(x * 1e4) / 1e4;
    return Math.abs(x - r) < 1e-6 * Math.max(1, Math.abs(x)) ? (r === 0 ? 0 : r) : Math.round(x * 1e9) / 1e9;
  }

  M.zarovnejUzly = function (dok, ids, osa, kde, klic = null) {
    const vsechny = dok.uzly.filter(u => ids.includes(u.id));
    if (vsechny.length < 2) return dok;
    // vztažné těleso (klic): ostatní se zarovnají k němu a ono se nehne; jinak k obálce všech
    const vztazne = klic && vsechny.find(u => u.id === klic);
    const ob = vztazne ? M.obalkaUzlu(vztazne) : M.obalkaVice(vsechny);
    if (vztazne) ob.stred = [0, 1, 2].map(i => (ob.min[i] + ob.max[i]) / 2);
    const cil = kde === 'min' ? ob.min[osa] : kde === 'max' ? ob.max[osa] : ob.stred[osa];
    return M.upravUzly(dok, zamcene(dok, ids).filter(u => u.id !== klic).map(u => u.id), u => {
      const o = M.obalkaUzlu(u);
      const ted = kde === 'min' ? o.min[osa] : kde === 'max' ? o.max[osa] : (o.min[osa] + o.max[osa]) / 2;
      // posun z obálek (vrcholy ve float32): šum dorovnat, ať v dokumentu nezůstane 81,10000038
      const poloha = u.poloha.slice(); poloha[osa] = bezSumu(poloha[osa] + cil - ted);
      return { poloha };
    });
  };

  /* Vrcholy spočítaných skupin (klíč geometrie → pozice v souřadnicích skupiny). Spodek skupiny
     se pak bere ze skutečného výsledku: díra nebo průnik může spodní část odříznout a obálka plných
     částí by ležela níž než výsledek (položení na desku by nedosedlo). */
  const vysledkySkupin = new Map();
  M.zapisVysledekSkupiny = function (klic, pozice) {
    vysledkySkupin.delete(klic);
    vysledkySkupin.set(klic, pozice);
    while (vysledkySkupin.size > 40) vysledkySkupin.delete(vysledkySkupin.keys().next().value);
  };
  const vysledekSkupiny = u => u.druh === 'skupina' ? vysledkySkupin.get(M.klicGeometrie(u)) || null : null;

  /** Nejmenší vzdálenost geometrie uzlu od roviny (podél normály). */
  const minCache = new WeakMap();           // uzel → Map(rovina → hodnota); uzly jsou neměnné
  function minNadRovinou(u, r) {
    const klic = r.osy[2].join(',') + '|' + r.puvod.join(',') + (vysledekSkupiny(u) ? '|v' : '');
    let m = minCache.get(u);
    if (!m) { m = new Map(); minCache.set(u, m); }
    if (m.has(klic)) return m.get(klic);
    const v = minNadRovinouVypocet(u, r);
    if (m.size > 8) m.clear();
    m.set(klic, v);
    return v;
  }
  function minNadRovinouVypocet(u, r) {
    const e = M.maticeUzlu(u).elements, p = vysledekSkupiny(u) || M.vrcholyUzlu(u), n = r.osy[2], p0 = r.puvod;
    let min = Infinity;
    for (let i = 0; i < p.length; i += 3) {
      let d = 0;
      for (let k = 0; k < 3; k++) d += (e[k] * p[i] + e[4 + k] * p[i + 1] + e[8 + k] * p[i + 2] + e[12 + k] - p0[k]) * n[k];
      if (d < min) min = d;
    }
    return min;
  }
  M.minNadRovinou = minNadRovinou;

  /** Položí každý uzel na rovinu (spodek obálky podél normály = 0). */
  M.polozNaRovinu = function (dok, ids, r = M.ROVINA_DESKY) {
    const n = r.osy[2];
    return M.upravUzly(dok, zamcene(dok, ids).map(u => u.id), u => {
      const d = minNadRovinou(u, r);
      return { poloha: u.poloha.map((v, i) => bezSumu(v - n[i] * d)) };
    });
  };

  /** Natočí uzel tak, aby stěna se světovou normálou `normala` ležela na rovině, a položí ho. */
  M.polozPlochou = function (dok, id, normala, r = M.ROVINA_DESKY) {
    const u = M.najdiUzel(dok, id);
    if (!u || u.zamceno) return dok;
    const q = new THREE.Quaternion().setFromUnitVectors(new V(...normala).normalize(), new V(...r.osy[2]).negate());
    const d2 = M.upravUzly(dok, [id], { rotace: M.rotaceZQuat(q.multiply(M.quatUzlu(u))) });
    return M.polozNaRovinu(d2, [id], r);
  };

  /** Změna velikosti tahem za úchyt v lokálním (tuhém) rámci uzlu.
      uchyt: { sx, sy, sz } ∈ {−1, 0, 1} – strana, za kterou se táhne
      (protější strana stojí); cil: lokální bod pod kurzorem [x, y, z].
      volby: krok (přichycení rozměru), uniform (zachovat poměry), min.
      Vrací { rozmer, poloha }. */
  M.zmenaVelikosti = function (u, uchyt, cil, volby = {}) {
    const krok = volby.krok || 0, min = volby.min || 0.1;
    const s = [uchyt.sx || 0, uchyt.sy || 0, uchyt.sz || 0];
    const h = u.rozmer.map(v => v / 2);
    const rozmer = u.rozmer.slice(), stred = [0, 0, 0];
    const prichyt = w => Math.max(min, krok > 0 ? Math.round(w / krok) * krok : w);
    for (let i = 0; i < 3; i++) {
      if (!s[i]) continue;
      const o = -s[i] * h[i];                       // protější strana
      rozmer[i] = prichyt((cil[i] - o) * s[i]);
    }
    if (volby.uniform) {
      // nejvíc změněná tažená osa určí poměr pro všechny tři
      let k = 1, nej = -1;
      for (let i = 0; i < 3; i++) if (s[i]) {
        const r = rozmer[i] / u.rozmer[i];
        if (Math.abs(r - 1) > nej) { nej = Math.abs(r - 1); k = r; }
      }
      for (let i = 0; i < 3; i++) rozmer[i] = Math.max(min, u.rozmer[i] * k);
    }
    for (let i = 0; i < 3; i++) {
      // tažená osa: protější strana stojí; netažená: střed, jen Z drží spodek
      if (s[i]) stred[i] = -s[i] * h[i] + s[i] * rozmer[i] / 2;
      else if (i === 2) stred[i] = -h[i] + rozmer[i] / 2;
    }
    const p = new V(...stred).applyMatrix4(M.tuhaMaticeUzlu(u));
    return { rozmer: rozmer.map(v => Math.round(v * 1e9) / 1e9), poloha: p.toArray().map(v => Math.round(v * 1e9) / 1e9) };
  };

  /** Název kopie: automatický „Kvádr 3“ dostane další volné číslo, vlastní název zůstane. */
  M.nazevKopie = function (dok, u) {
    const t = M.popisDruhu(u.druh);
    return new RegExp('^' + t.nazev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\d+$').test(u.nazev) ? M.dalsiNazev(dok, u.druh) : u.nazev;
  };

  /** Kopie uzlů na stejném místě (přidají se na konec seznamu). Vrací {dok, kopie}. */
  M.duplikujUzly = function (dok, ids) {
    const set = new Set(ids), kopie = [], uzly = dok.uzly.slice();
    const zdroje = dok.uzly.filter(u => set.has(u.id)), nove = M.kopieSVazbami(zdroje);
    for (const [i, u] of zdroje.entries()) {
      const k = Object.assign(nove[i], { zamceno: false, nazev: M.nazevKopie({ uzly }, u) });
      kopie.push(k);
      uzly.push(k);
    }
    return { dok: Object.assign({}, dok, { uzly }), kopie: kopie.map(k => k.id) };
  };

  /** Opakování duplikace (Ctrl+D jako v Tinkercadu): kopie se posunula/otočila
      vůči zdroji, další kopie dostane stejnou tuhou transformaci vůči ní.
      zdroje[i] ↔ kopie[i]. Vrací {dok, kopie}. */
  M.opakujDuplikaci = function (dok, zdroje, kopie) {
    const z = M.najdiUzel(dok, zdroje[0]), k = M.najdiUzel(dok, kopie[0]);
    if (!z || !k) return M.duplikujUzly(dok, kopie);
    const X = M.tuhaMaticeUzlu(k).multiply(M.tuhaMaticeUzlu(z).invert());
    const r = M.duplikujUzly(dok, kopie);
    const p = new V(), q = new THREE.Quaternion(), s = new V();
    const d = M.upravUzly(r.dok, r.kopie, u => {
      X.clone().multiply(M.tuhaMaticeUzlu(u)).decompose(p, q, s);
      return { poloha: p.toArray().map(v => Math.round(v * 1e6) / 1e6), rotace: M.rotaceZQuat(q) };
    });
    return { dok: d, kopie: r.kopie };
  };

  // ------------------------------------------------------------ skupiny
  const zaokr = (x, d = 1e9) => { const r = Math.round(x * d) / d; return r === 0 ? 0 : r; };

  /** Seskupí uzly (aspoň 2, nezamčené) do nové skupiny na místě prvního z nich.
      Střed a přirozená velikost skupiny = obálka plných dětí; děti dostanou
      polohu vůči středu. Skupina samých děr je díra. Vrací {dok, id}. */
  M.seskupUzly = function (dok, ids, volby = {}) {
    const set = new Set(ids);
    const vybrane = dok.uzly.filter(u => set.has(u.id) && !u.zamceno);
    if (vybrane.length < 2) return { dok, id: null };
    const plne = vybrane.filter(u => u.role !== 'dira');
    const ob = M.obalkaVice(plne.length ? plne : vybrane);
    const c = ob.stred.map(x => zaokr(x));
    const zaklad = [0, 1, 2].map(i => Math.max(0.01, zaokr(ob.max[i] - ob.min[i])));
    const g = M.normalizujUzel({
      druh: 'skupina', nazev: volby.nazev || M.dalsiNazev(dok, 'skupina'),
      deti: vybrane.map(u => Object.assign({}, u, { poloha: u.poloha.map((x, i) => zaokr(x - c[i])) })),
      zaklad, rozmer: zaklad, poloha: c, rotace: [0, 0, 0],
      role: plne.length ? 'teleso' : 'dira',
      barva: (plne[0] || vybrane[0]).barva, barevne: !!volby.barevne, operace: volby.operace || 'sjednoceni',
    });
    const prvni = dok.uzly.findIndex(u => set.has(u.id) && !u.zamceno);
    const uzly = [];
    dok.uzly.forEach((u, i) => {
      if (i === prvni) uzly.push(g);
      if (!(set.has(u.id) && !u.zamceno)) uzly.push(u);
    });
    return { dok: Object.assign({}, dok, { uzly }), id: g.id };
  };

  /** Uzel s maticí W (svět ← přirozené souřadnice) převedený na polohu,
      rotaci, zrcadlo a rozměr. Přesné, když W nemá zkosení (měřítko skupiny
      podél os dítěte); jinak nejbližší pravoúhlé přiblížení. */
  function uzelZMatice(d, W) {
    const p = new V(), q = new THREE.Quaternion(), s = new V();
    W.decompose(p, q, s);
    const k = [Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)];
    const zaklad = M.maZaklad(d) ? d.zaklad : d.rozmer;
    return M.normalizujUzel(Object.assign({}, d, {
      poloha: p.toArray().map(x => zaokr(x, 1e6)),
      rotace: M.rotaceZQuat(q),
      zrcadlo: [s.x < 0, s.y < 0, s.z < 0],
      rozmer: zaklad.map((r, i) => zaokr(r * k[i], 1e6)),
    }));
  }

  /** Rozdělí vybrané skupiny: děti se vrátí do světa na místě skupiny.
      Vrací {dok, ids} (ids = uvolněné děti). */
  M.rozdelSkupiny = function (dok, ids) {
    const set = new Set(ids), nove = [];
    const uzly = [];
    for (const u of dok.uzly) {
      if (!(set.has(u.id) && u.druh === 'skupina' && !u.zamceno)) { uzly.push(u); continue; }
      const G = M.maticeUzlu(u);
      for (const d of u.deti) {
        const W = G.clone().multiply(M.maticeUzlu(d));
        let n = uzelZMatice(d, W);
        // skupina přepnutá na díru: po rozdělení jsou dírou i její části (jinak by z díry byla tělesa)
        if (u.role === 'dira' && n.role !== 'dira') n = M.normalizujUzel(Object.assign({}, n, { role: 'dira' }));
        nove.push(n.id);
        uzly.push(n);
      }
    }
    return { dok: nove.length ? Object.assign({}, dok, { uzly }) : dok, ids: nove };
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
