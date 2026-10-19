/* Modelář 3D – pohyblivé sestavy: klouby (bez DOM, jde v node).
   dok.klouby = [{id, nazev, typ: 'otoceni' | 'posun', dily: [id těles nejvyšší úrovně],
                  bod: [x, y, z], smer: [x, y, z] (jednotkový), min, max, hodnota}].
   Hodnota je úhel ve stupních (otočení kolem osy bod + t·smer) nebo posun v mm podél smer.
   Dokument drží tělesa vždy v poloze odpovídající současné hodnotě: změna hodnoty
   otočí / posune díly o rozdíl (export i tisk pak vidí sestavu tak, jak je ve scéně).
   Vnořený kloub (všechny jeho díly patří i jinému kloubu) jede se svým „rodičem“:
   otočí se mu bod i směr osy (rameno lampy na otočném podstavci).
   Srážky: dvojice pohyblivý díl × ostatní tělesa s překrytými obálkami; průnik dvojice
   spočítá manifold (skupina s operací průnik), viz ui/sestava.js. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const V = THREE.Vector3;
  const r9 = x => Math.round(x * 1e9) / 1e9;
  const cislo = (v, nahr) => typeof v === 'number' && isFinite(v) ? v : nahr;
  const MAX_KLOUBU = 100;

  /** Opraví klouby: jen existující díly (ids = Set id těles nejvyšší úrovně; null = nekontrolovat), platná osa a meze. */
  M.normalizujKlouby = function (klouby, ids = null) {
    const out = [], videna = new Set();
    for (const k of Array.isArray(klouby) ? klouby : []) {
      if (!k || typeof k !== 'object') continue;
      const dily = [...new Set((Array.isArray(k.dily) ? k.dily : []).filter(id => M.idOk(id) && (!ids || ids.has(id))))];
      if (!dily.length) continue;
      const smer = new V(...[0, 1, 2].map(i => cislo(Array.isArray(k.smer) ? k.smer[i] : NaN, i === 2 ? 1 : 0)));
      if (smer.length() < 1e-9) smer.set(0, 0, 1);
      smer.normalize();
      const typ = k.typ === 'posun' ? 'posun' : 'otoceni';
      const lim = typ === 'posun' ? 10000 : 36000;
      let min = M.omez(cislo(k.min, typ === 'posun' ? 0 : -90), -lim, lim), max = M.omez(cislo(k.max, typ === 'posun' ? 20 : 90), -lim, lim);
      if (max < min) [min, max] = [max, min];
      const id = M.idOk(k.id) && !videna.has(k.id) ? k.id : 'k' + M.noveId();
      videna.add(id);
      out.push({
        id, nazev: typeof k.nazev === 'string' && k.nazev.trim() ? k.nazev.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, 60) : (typ === 'posun' ? 'Posuv' : 'Kloub') + ' ' + (out.length + 1),
        typ, dily,
        bod: [0, 1, 2].map(i => r9(M.omez(cislo(Array.isArray(k.bod) ? k.bod[i] : NaN, 0), -1e5, 1e5))),
        smer: smer.toArray().map(r9), min, max,
        hodnota: r9(M.omez(cislo(k.hodnota, 0), -lim, lim)),
      });
      if (out.length >= MAX_KLOUBU) break;
    }
    return out;
  };

  M.klouby = dok => dok.klouby || [];

  /** Nový kloub z dílů ids: typ, osa (smer) bodem bod, meze. Současná poloha dílů = hodnota 0. */
  M.novyKloub = function (dok, ids, { typ = 'otoceni', bod = null, smer = [0, 0, 1], min, max, nazev } = {}) {
    const dily = dok.uzly.filter(u => ids.includes(u.id));
    if (!dily.length) throw new Error('vyber díly, které se mají pohybovat');
    const b = bod || M.obalkaVice(dily).stred;
    const k = M.normalizujKlouby([{ typ, dily: dily.map(u => u.id), bod: b, smer, min, max, hodnota: 0,
      nazev: nazev || (typ === 'posun' ? 'Posuv ' : 'Kloub ') + (M.klouby(dok).length + 1) }])[0];
    return { dok: Object.assign({}, dok, { klouby: M.klouby(dok).concat([k]) }), id: k.id };
  };

  /** Kloub id s úpravou (nazev, min, max, bod, smer, typ, dily) – bez pohybu dílů. */
  M.upravKloub = function (dok, id, zmena) {
    const kl = M.klouby(dok).map(k => k.id === id ? Object.assign({}, k, zmena, { id }) : k);
    return Object.assign({}, dok, { klouby: M.normalizujKlouby(kl, null) });
  };
  M.smazKloub = function (dok, id) {
    const kl = M.klouby(dok).filter(k => k.id !== id);
    const d = Object.assign({}, dok, { klouby: kl });
    if (!kl.length) delete d.klouby;
    return d;
  };

  /** Vnořené klouby kloubu k: všechny jejich díly patří i k (pojedou s ním). */
  const vnorene = (dok, k) => M.klouby(dok).filter(x => x.id !== k.id && x.dily.every(id => k.dily.includes(id)) && x.dily.length < k.dily.length);

  /** Nastaví kloub id na hodnotu (v mezích): díly se otočí / posunou o rozdíl, vnořené klouby s nimi. */
  M.dokSKloubem = function (dok, id, hodnota) {
    const k = M.klouby(dok).find(x => x.id === id);
    if (!k) return dok;
    const h = r9(M.omez(hodnota, k.min, k.max)), d = h - k.hodnota;
    if (Math.abs(d) < 1e-9) return dok;
    const zamcene = new Set(dok.uzly.filter(u => u.zamceno).map(u => u.id));
    const ids = k.dily.filter(x => !zamcene.has(x));
    let novy;
    const vn = new Set(vnorene(dok, k).map(x => x.id));
    let preved;                 // pohyb bodů a směrů os vnořených kloubů
    if (k.typ === 'posun') {
      const v = k.smer.map(x => x * d);
      novy = M.posunUzly(dok, ids, v);
      preved = x => Object.assign({}, x, { bod: x.bod.map((b, i) => r9(b + v[i])) });
    } else {
      novy = M.otocUzly(dok, ids, k.smer, d, k.bod);
      const q = new THREE.Quaternion().setFromAxisAngle(new V(...k.smer), d * M.st), c = new V(...k.bod);
      preved = x => Object.assign({}, x, {
        bod: new V(...x.bod).sub(c).applyQuaternion(q).add(c).toArray().map(r9),
        smer: new V(...x.smer).applyQuaternion(q).normalize().toArray().map(r9),
      });
    }
    return Object.assign({}, novy, { klouby: M.klouby(dok).map(x => x.id === id ? Object.assign({}, x, { hodnota: h }) : vn.has(x.id) ? preved(x) : x) });
  };

  /** Klouby s díly, které v dokumentu už nejsou (seskupené, smazané) – vyčištěné. */
  M.srovnejKlouby = function (dok) {
    if (!dok.klouby) return dok;
    const ids = new Set(dok.uzly.map(u => u.id));
    const kl = M.normalizujKlouby(dok.klouby, ids);
    if (kl.length === dok.klouby.length && kl.every((k, i) => k.dily.length === dok.klouby[i].dily.length)) return dok;
    const d = Object.assign({}, dok, { klouby: kl });
    if (!kl.length) delete d.klouby;
    return d;
  };

  const prekryv = (a, b, t) => [0, 1, 2].every(i => a.min[i] < b.max[i] + t && a.max[i] > b.min[i] - t);
  /** Dvojice [pohyblivý díl, jiné těleso] s překrytými obálkami (kandidáti srážky). Díry, skryté a díly téhož kloubu se nepočítají. */
  M.dvojiceKeKontrole = function (dok, kloubId, tol = 0.01) {
    const k = M.klouby(dok).find(x => x.id === kloubId);
    if (!k) return [];
    const plne = dok.uzly.filter(u => !u.skryto && u.role !== 'dira');
    const pohyb = plne.filter(u => k.dily.includes(u.id)), ostatni = plne.filter(u => !k.dily.includes(u.id));
    const out = [];
    for (const a of pohyb) {
      const oa = M.obalkaUzlu(a);
      for (const b of ostatni) if (prekryv(oa, M.obalkaUzlu(b), tol)) out.push([a.id, b.id]);
    }
    return out;
  };

  /** Skupina „průnik“ dvou těles (pro výpočet srážky); null, když jedno chybí. */
  M.uzelPrunikuDvojice = function (dok, a, b) {
    const ua = M.najdiUzel(dok, a), ub = M.najdiUzel(dok, b);
    if (!ua || !ub) return null;
    const r = M.seskupUzly({ verze: 1, uzly: [Object.assign({}, ua, { zamceno: false }), Object.assign({}, ub, { zamceno: false })] }, [a, b], { operace: 'prunik', nazev: 'Srážka' });
    return r.id ? r.dok.uzly.find(u => u.id === r.id) : null;
  };

  /** Hodnoty pro projetí rozsahu kloubu (krok podle rozsahu, nejvýš n vzorků). */
  M.vzorkyKloubu = function (k, n = 36) {
    const m = Math.max(2, Math.min(n, Math.ceil((k.max - k.min) / (k.typ === 'posun' ? 0.5 : 2.5)) + 1));
    return Array.from({ length: m }, (_, i) => r9(k.min + (k.max - k.min) * i / (m - 1)));
  };

  /** Souvislé úseky hodnot se srážkou: vzorky [{hodnota, srazky: [[a, b, objem]]}] → [{od, do, dvojice: Set}]. */
  M.useKySrazek = function (vzorky) {
    const out = [];
    let ted = null;
    for (const v of vzorky) {
      if (v.srazky.length) {
        if (!ted) { ted = { od: v.hodnota, do: v.hodnota, dvojice: new Set() }; out.push(ted); }
        ted.do = v.hodnota;
        for (const s of v.srazky) ted.dvojice.add(s[0] + '|' + s[1]);
      } else ted = null;
    }
    return out;
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
