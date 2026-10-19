/* Modelář 3D – geometrické vazby a kóty 2D skici s numerickým řešičem (bez DOM,
   jde v node, v prohlížeči i ve workeru).
   Vazba: {id, typ, a, b?, c?, hodnota?, vyraz?, smer?, ref?}
     a, b, c = odkazy na entity skici:
       bod      {t: idTvaru, b: k}   k = index vrcholu cesty, 's' střed (obdélník, kruh,
                                     n-úhelník, text, polygony), 'r0'..'r3' rohy obdélníku
                                     ([-w/2,-h/2], [+,-], [+,+], [-,+]), 'v0'.. vrcholy n-úhelníku
       usecka   {t: idTvaru, u: k}   úsek cesty body[k] → body[(k+1) % n] (tětiva), hrana k
                                     obdélníku (roh k → roh k+1), hrana n-úhelníku (v k → v k+1)
       kruznice {t: idTvaru, k: 1}   kruh (poloměr rx) nebo n-úhelník (opsaná kružnice r)
     hodnota = číslo kóty (mm, u úhlu stupně; u 'pevny' [x, y]), vyraz = text s proměnnými
     projektu (má přednost, když jde vyhodnotit), smer = ±1 strana u vzdalX/vzdalY,
     ref = referenční kóta (jen ukazuje, neřídí).
   Řešič: Gauss–Newton / Levenberg–Marquardt s krokem nejmenší normy
     dx = −Jᵀ (J Jᵀ + λI)⁻¹ r, Jakobián numericky (centrální diference, jen přes proměnné,
     na kterých reziduum závisí – řídce). Tah myší = měkký cíl řešený v nulovém prostoru
     tvrdých vazeb (vazby se kvůli tahu nikdy neporuší). Volnost = počet proměnných − hodnost
     Jakobiánu (Gram–Schmidt s pivotací po řádcích). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const PI = Math.PI, RAD = PI / 180;
  const MAX_VAZEB = 2000;
  const TOL = 1e-10;            // cílová přesnost reziduí (mm, rad)
  const TOL_OK = 1e-7;          // nad tím je vazba nesplněná
  const MAX_ITERACI = 50;

  // ------------------------------------------------------------ popis typů
  /** Typy vazeb: vstupy = varianty druhů entit (v pořadí a, b, c), hodnota = kóta. */
  M.TYPY_VAZEB = {
    vodorovne:   { popis: 'Vodorovně', vstupy: [['usecka'], ['bod', 'bod']], hodnota: false, klavesa: 'H', ikona: '—' },
    svisle:      { popis: 'Svisle', vstupy: [['usecka'], ['bod', 'bod']], hodnota: false, klavesa: 'V', ikona: '|' },
    rovnobezne:  { popis: 'Rovnoběžně', vstupy: [['usecka', 'usecka']], hodnota: false, klavesa: 'P', ikona: '∥' },
    kolme:       { popis: 'Kolmo', vstupy: [['usecka', 'usecka']], hodnota: false, klavesa: 'K', ikona: '⊥' },
    stejne:      { popis: 'Stejně', vstupy: [['usecka', 'usecka'], ['kruznice', 'kruznice']], hodnota: false, klavesa: 'E', ikona: '=' },
    splyva:      { popis: 'Splývá', vstupy: [['bod', 'bod']], hodnota: false, klavesa: 'C', ikona: '●' },
    pevny:       { popis: 'Pevný bod', vstupy: [['bod']], hodnota: false, klavesa: 'F', ikona: '📌' },
    naPrimce:    { popis: 'Bod na přímce', vstupy: [['bod', 'usecka']], hodnota: false, klavesa: '', ikona: '∈' },
    stredUsecky: { popis: 'Střed úsečky', vstupy: [['bod', 'usecka']], hodnota: false, klavesa: '', ikona: '½' },
    tecna:       { popis: 'Tečna', vstupy: [['usecka', 'kruznice']], hodnota: false, klavesa: '', ikona: '⌒' },
    symetrie:    { popis: 'Symetrie', vstupy: [['bod', 'bod', 'usecka']], hodnota: false, klavesa: '', ikona: '⇔' },
    delka:       { popis: 'Délka', vstupy: [['usecka'], ['bod', 'bod']], hodnota: true, klavesa: 'D', ikona: '↔', jednotka: 'mm' },
    vzdalX:      { popis: 'Vzdálenost X', vstupy: [['bod', 'bod']], hodnota: true, klavesa: '', ikona: '⟷', jednotka: 'mm' },
    vzdalY:      { popis: 'Vzdálenost Y', vstupy: [['bod', 'bod']], hodnota: true, klavesa: '', ikona: '↕', jednotka: 'mm' },
    prumer:      { popis: 'Průměr', vstupy: [['kruznice']], hodnota: true, klavesa: '', ikona: '⌀', jednotka: 'mm' },
    uhel:        { popis: 'Úhel', vstupy: [['usecka', 'usecka']], hodnota: true, klavesa: '', ikona: '∠', jednotka: '°' },
  };
  // vazby, u kterých nezáleží na pořadí stejných entit (pro hledání duplicit)
  const SOUMERNE = new Set(['vodorovne', 'svisle', 'rovnobezne', 'kolme', 'stejne', 'splyva', 'delka', 'uhel']);

  // ------------------------------------------------------------ odkazy na entity
  const ID_RE = /^[\w-]{1,24}$/;
  const druhOdkazu = r => !r || typeof r !== 'object' ? null : r.b !== undefined ? 'bod' : r.u !== undefined ? 'usecka' : r.k !== undefined ? 'kruznice' : null;
  const klicOdkazu = r => r.t + (r.b !== undefined ? ':b' + r.b : r.u !== undefined ? ':u' + r.u : ':k');
  const celeCislo = v => {
    if (typeof v === 'string' && /^\d+$/.test(v)) v = +v;
    return Number.isInteger(v) && v >= 0 ? v : null;
  };

  /** Opravený odkaz (nebo null), když v tvary existuje. */
  function normalizujOdkaz(r, mapa) {
    const druh = druhOdkazu(r);
    if (!druh || typeof r.t !== 'string') return null;
    const t = mapa.get(r.t);
    if (!t) return null;
    if (druh === 'bod') {
      if (t.typ === 'cesta') { const k = celeCislo(r.b); return k !== null && k < t.body.length ? { t: r.t, b: k } : null; }
      if (r.b === 's') return { t: r.t, b: 's' };
      const m = /^([rv])(\d+)$/.exec(String(r.b));
      if (!m) return null;
      const k = +m[2];
      if (m[1] === 'r' && t.typ === 'obdelnik' && k < 4) return { t: r.t, b: 'r' + k };
      if (m[1] === 'v' && t.typ === 'nuhelnik' && k < t.n) return { t: r.t, b: 'v' + k };
      return null;
    }
    if (druh === 'usecka') {
      const k = celeCislo(r.u);
      if (k === null) return null;
      const n = t.typ === 'cesta' ? t.body.length : t.typ === 'obdelnik' ? 4 : t.typ === 'nuhelnik' ? t.n : 0;
      return k < n ? { t: r.t, u: k } : null;
    }
    return t.typ === 'kruh' || t.typ === 'nuhelnik' ? { t: r.t, k: 1 } : null;
  }

  /** Koncové body úsečky jako odkazy na body. */
  function konceUsecky(t, r) {
    const k = r.u;
    if (t.typ === 'cesta') return [{ t: r.t, b: k }, { t: r.t, b: (k + 1) % t.body.length }];
    if (t.typ === 'obdelnik') return [{ t: r.t, b: 'r' + k }, { t: r.t, b: 'r' + ((k + 1) % 4) }];
    return [{ t: r.t, b: 'v' + k }, { t: r.t, b: 'v' + ((k + 1) % t.n) }];
  }

  const ZNAM_OBDELNIKU = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  /** Souřadnice bodu z hodnot tvaru (g = getter klíče, gb = getter vrcholu cesty). */
  function souradniceBodu(t, b, g, gb) {
    if (t.typ === 'cesta') return gb(b);
    if (b === 's') return [g('x'), g('y')];
    const k = +b.slice(1);
    if (b[0] === 'r') { const z = ZNAM_OBDELNIKU[k]; return [g('x') + z[0] * g('w') / 2, g('y') + z[1] * g('h') / 2]; }
    const a = PI / 2 + g('natoceni') * RAD + 2 * PI * k / t.n;
    return [g('x') + g('r') * Math.cos(a), g('y') + g('r') * Math.sin(a)];
  }
  const mapaTvaru = tvary => { const m = new Map(); for (const t of tvary || []) if (t && t.id) m.set(t.id, t); return m; };

  /** Souřadnice bodu skici [x, y] (null, když odkaz neplatí). */
  M.bodSkici = function (tvary, ref) {
    const t = mapaTvaru(tvary).get(ref && ref.t);
    const r = t && normalizujOdkaz(ref, new Map([[t.id, t]]));
    if (!r || druhOdkazu(r) !== 'bod') return null;
    return souradniceBodu(t, r.b, k => t[k], j => [t.body[j].x, t.body[j].y]);
  };
  /** Krajní body úsečky [[x, y], [x, y]] (null, když odkaz neplatí). */
  M.usekSkici = function (tvary, ref) {
    const t = mapaTvaru(tvary).get(ref && ref.t);
    const r = t && normalizujOdkaz(ref, new Map([[t.id, t]]));
    if (!r || druhOdkazu(r) !== 'usecka') return null;
    return konceUsecky(t, r).map(p => M.bodSkici([t], p));
  };
  /** Kružnice {x, y, r} (null, když odkaz neplatí). */
  M.kruzniceSkici = function (tvary, ref) {
    const t = mapaTvaru(tvary).get(ref && ref.t);
    const r = t && normalizujOdkaz(ref, new Map([[t.id, t]]));
    if (!r || druhOdkazu(r) !== 'kruznice') return null;
    return { x: t.x, y: t.y, r: t.typ === 'kruh' ? t.rx : t.r };
  };

  // ------------------------------------------------------------ hodnoty a měření
  const wrap = a => { a = (a + PI) % (2 * PI); if (a < 0) a += 2 * PI; return a - PI; };
  /** Mají úsečky společný koncový bod? Vrací [i, j] (index společného konce v každé) nebo null. */
  function spolecnyKonec(k1, k2) {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (klicOdkazu(k1[i]) === klicOdkazu(k2[j])) return [i, j];
    return null;
  }
  /** Směry dvou úseček pro úhel: u společného vrcholu oba od něj (úhel = úhel ve vrcholu). */
  function smeryProUhel(p1, q1, p2, q2, spol) {
    let d1 = [q1[0] - p1[0], q1[1] - p1[1]], d2 = [q2[0] - p2[0], q2[1] - p2[1]];
    if (spol) { if (spol[0] === 1) d1 = [-d1[0], -d1[1]]; if (spol[1] === 1) d2 = [-d2[0], -d2[1]]; }
    return [d1, d2];
  }
  const uhelSmeru = (d1, d2) => Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1]);

  /** Aktuální změřená hodnota kóty (mm, úhel ve stupních 0…180; null u vazby bez hodnoty). */
  M.zmerVazbu = function (tvary, v) {
    if (!v || !M.TYPY_VAZEB[v.typ] || !M.TYPY_VAZEB[v.typ].hodnota) return null;
    const bod = r => M.bodSkici(tvary, r), usek = r => M.usekSkici(tvary, r);
    switch (v.typ) {
      case 'delka': {
        const [p, q] = druhOdkazu(v.a) === 'usecka' ? usek(v.a) || [] : [bod(v.a), bod(v.b)];
        return p && q ? Math.hypot(q[0] - p[0], q[1] - p[1]) : null;
      }
      case 'vzdalX': case 'vzdalY': {
        const p = bod(v.a), q = bod(v.b), i = v.typ === 'vzdalX' ? 0 : 1;
        return p && q ? Math.abs(q[i] - p[i]) : null;
      }
      case 'prumer': { const k = M.kruzniceSkici(tvary, v.a); return k ? 2 * k.r : null; }
      case 'uhel': {
        const s1 = usek(v.a), s2 = usek(v.b);
        if (!s1 || !s2) return null;
        const m = mapaTvaru(tvary);
        const spol = spolecnyKonec(konceUsecky(m.get(v.a.t), v.a), konceUsecky(m.get(v.b.t), v.b));
        const [d1, d2] = smeryProUhel(s1[0], s1[1], s2[0], s2[1], spol);
        return Math.abs(uhelSmeru(d1, d2)) / RAD;
      }
    }
    return null;
  };

  /** Platná hodnota kóty: výraz s proměnnými projektu, jinak uložené číslo (null u vazeb bez hodnoty). */
  M.hodnotaVazby = function (v, promenne) {
    if (!v || !M.TYPY_VAZEB[v.typ] || !M.TYPY_VAZEB[v.typ].hodnota) return null;
    if (v.vyraz && M.prectiCislo) {
      const x = M.prectiCislo(v.vyraz, promenne || null);
      if (isFinite(x)) return x;
    }
    return typeof v.hodnota === 'number' && isFinite(v.hodnota) ? v.hodnota : NaN;
  };

  /** Krátký český popis vazby („Vodorovně“, „Délka 25 mm“…). */
  M.popisVazby = function (v, promenne) {
    const d = v && M.TYPY_VAZEB[v.typ];
    if (!d) return '?';
    if (!d.hodnota) return d.popis;
    const h = M.hodnotaVazby(v, promenne);
    const cislo = isFinite(h) ? (M.mm ? M.mm(h, 3) : String(+h.toFixed(3))) : '?';
    let s = (v.typ === 'prumer' ? 'Průměr ⌀' : d.popis) + ' ' + cislo + (d.jednotka === '°' ? '°' : ' mm');
    if (v.vyraz) s += ' (' + v.vyraz + ')';
    if (v.ref) s += ' (ref.)';
    return s;
  };
  /** Jeden znak pro zobrazení vazby. */
  M.ikonaVazby = typ => (M.TYPY_VAZEB[typ] || {}).ikona || '?';

  /** Přiřadí odkazy k variantě vstupů typu (bez ohledu na pořadí výběru); vrací [a, b, c] nebo null. */
  function priradVstupy(typ, odkazy) {
    const d = M.TYPY_VAZEB[typ];
    if (!d) return null;
    const druhy = odkazy.map(druhOdkazu);
    for (const var_ of d.vstupy) {
      if (var_.length !== odkazy.length) continue;
      const pouzite = new Set(), out = [];
      for (const druh of var_) {
        const i = druhy.findIndex((x, j) => x === druh && !pouzite.has(j));
        if (i < 0) break;
        pouzite.add(i); out.push(odkazy[i]);
      }
      if (out.length === var_.length) return out;
    }
    return null;
  }

  /** Typy vazeb, které jde přidat k výběru entit (pole odkazů). */
  M.mozneVazby = function (vybrane) {
    const odkazy = (Array.isArray(vybrane) ? vybrane : []).filter(r => druhOdkazu(r));
    if (!odkazy.length || odkazy.length !== (vybrane || []).length) return [];
    const klice = new Set(odkazy.map(klicOdkazu));
    if (klice.size !== odkazy.length) return [];
    return Object.keys(M.TYPY_VAZEB).filter(typ => priradVstupy(typ, odkazy));
  };

  /** Nová vazba typu typ z vybraných entit (pořadí srovná, kótu předvyplní změřenou hodnotou,
      u vzdalX/vzdalY si zapamatuje stranu); null, když typ k výběru nesedí. */
  M.vytvorVazbu = function (tvary, typ, vybrane, hodnota) {
    const p = priradVstupy(typ, vybrane || []);
    if (!p) return null;
    const v = { typ, a: p[0] };
    if (p[1]) v.b = p[1];
    if (p[2]) v.c = p[2];
    if (typ === 'pevny') v.hodnota = M.bodSkici(tvary, v.a);
    if (M.TYPY_VAZEB[typ].hodnota) {
      const z = M.zmerVazbu(tvary, v);
      v.hodnota = typeof hodnota === 'number' && isFinite(hodnota) ? hodnota : z;
    }
    if (typ === 'vzdalX' || typ === 'vzdalY') {
      const i = typ === 'vzdalX' ? 0 : 1, a = M.bodSkici(tvary, v.a), b = M.bodSkici(tvary, v.b);
      v.smer = a && b && b[i] < a[i] ? -1 : 1;
    }
    if (typ === 'uhel') {
      const m = mapaTvaru(tvary), s1 = M.usekSkici(tvary, v.a), s2 = M.usekSkici(tvary, v.b);
      const [d1, d2] = smeryProUhel(s1[0], s1[1], s2[0], s2[1], spolecnyKonec(konceUsecky(m.get(v.a.t), v.a), konceUsecky(m.get(v.b.t), v.b)));
      v.smer = uhelSmeru(d1, d2) < 0 ? -1 : 1;
    }
    const n = M.normalizujVazbySkici([v], tvary);
    return n.length ? (delete n[0].id, n[0]) : null;
  };

  // ------------------------------------------------------------ normalizace
  /** Platné vazby: odkazy na existující tvary a indexy, správné druhy entit, čísla;
      id doplněná 'z1', 'z2'…, duplicity pryč, nejvýš 2000. */
  M.normalizujVazbySkici = function (vazby, tvary) {
    if (!Array.isArray(vazby) || !vazby.length) return [];
    const mapa = mapaTvaru(tvary), out = [], klice = new Set(), ids = new Set();
    for (const v of vazby) {
      if (out.length >= MAX_VAZEB) break;
      if (!v || typeof v !== 'object') continue;
      const d = M.TYPY_VAZEB[v.typ];
      if (!d) continue;
      const odkazy = [v.a, v.b, v.c].filter(r => r !== undefined && r !== null).map(r => normalizujOdkaz(r, mapa));
      if (!odkazy.length || odkazy.some(r => !r)) continue;
      if (new Set(odkazy.map(klicOdkazu)).size !== odkazy.length) continue;     // dvakrát totéž = nesmysl
      const p = priradVstupy(v.typ, odkazy);
      if (!p) continue;
      // dvě hrany téhož obdélníku/stejné úsečky jako kružnice apod. jsou v pořádku; kontroly hodnot:
      const z = { id: typeof v.id === 'string' && ID_RE.test(v.id) ? v.id : null, typ: v.typ, a: p[0] };
      if (p[1]) z.b = p[1];
      if (p[2]) z.c = p[2];
      if (v.typ === 'pevny') {
        const h = Array.isArray(v.hodnota) && v.hodnota.length === 2 && v.hodnota.every(x => typeof x === 'number' && isFinite(x))
          ? v.hodnota.map(x => M.omez(x, -1e5, 1e5)) : M.bodSkici(tvary, z.a);
        z.hodnota = h;
      }
      if (d.hodnota) {
        let h = typeof v.hodnota === 'number' && isFinite(v.hodnota) ? v.hodnota : M.zmerVazbu(tvary, z);
        if (h === null || !isFinite(h)) continue;
        if (v.typ === 'uhel') h = M.omez(h, -360, 360);
        else h = M.omez(h, 0, 1e5);
        z.hodnota = h;
        if (typeof v.vyraz === 'string' && v.vyraz.trim()) z.vyraz = v.vyraz.trim().slice(0, 200);
        if (v.ref) z.ref = true;
      }
      if (v.typ === 'uhel' && (v.smer === 1 || v.smer === -1)) z.smer = v.smer;
      if (v.typ === 'vzdalX' || v.typ === 'vzdalY') {
        let s = v.smer === -1 || v.smer === 1 ? v.smer : 0;
        if (!s) { const i = v.typ === 'vzdalX' ? 0 : 1, a = M.bodSkici(tvary, z.a), b = M.bodSkici(tvary, z.b); s = b[i] < a[i] ? -1 : 1; }
        z.smer = s;
      }
      let kk = [z.a, z.b, z.c].filter(Boolean).map(klicOdkazu);
      if (SOUMERNE.has(z.typ)) kk = kk.slice().sort();
      else if (z.typ === 'symetrie') kk = kk.slice(0, 2).sort().concat(kk[2]);
      const klic = z.typ + '|' + kk.join('|') + '|' + JSON.stringify([z.hodnota, z.vyraz, z.ref, z.smer]);
      if (klice.has(klic)) continue;
      klice.add(klic);
      if (z.id && ids.has(z.id)) z.id = null;
      if (z.id) ids.add(z.id);
      out.push(z);
    }
    let dalsi = 1;
    for (const z of out) if (!z.id) { while (ids.has('z' + dalsi)) dalsi++; z.id = 'z' + dalsi++; ids.add(z.id); }
    // id na první místo (čitelnější JSON)
    return out.map(z => Object.assign({ id: z.id }, z));
  };

  /** Vazby bez těch, které odkazují na některý z tvarů ids (pole, Set nebo jedno id). */
  M.odeberVazbyTvaru = function (vazby, ids) {
    const s = ids instanceof Set ? ids : new Set(Array.isArray(ids) ? ids : [ids]);
    return (vazby || []).filter(v => ![v.a, v.b, v.c].some(r => r && s.has(r.t))).map(v => Object.assign({}, v));
  };

  /** Vazby po vložení/smazání vrcholů cesty idTvaru: mapa[starý index] = nový index, nebo −1
      (smazaný). Úsek k přežije, když oba jeho konce přežijí a v nové cestě sousedí; jinak
      (smazaný bod nebo úsek rozdělený vloženým bodem) vazba zmizí. pocetNovy = počet bodů
      nové cesty (výchozí: největší nový index + 1). */
  M.precislujVazby = function (vazby, idTvaru, mapa, pocetNovy) {
    const nove = k => { const x = mapa[k]; return Number.isInteger(x) && x >= 0 ? x : -1; };
    const stare = Object.keys(mapa).map(Number).filter(Number.isInteger);
    const nStary = stare.length ? Math.max(...stare) + 1 : 0;
    let nNovy = pocetNovy;
    if (!Number.isInteger(nNovy)) { nNovy = 0; for (const k of stare) nNovy = Math.max(nNovy, nove(k) + 1); }
    const out = [];
    for (const v of vazby || []) {
      let platna = true;
      const prevod = r => {
        if (!r || r.t !== idTvaru) return r;
        if (r.b !== undefined && typeof r.b === 'number') {
          const k = nove(r.b);
          if (k < 0) platna = false;
          return { t: r.t, b: k };
        }
        if (r.u !== undefined) {
          const a = nove(r.u), b = nove((r.u + 1) % nStary);
          if (a < 0 || b < 0 || (a + 1) % nNovy !== b) platna = false;
          return { t: r.t, u: a };
        }
        return r;
      };
      const z = Object.assign({}, v);
      for (const k of ['a', 'b', 'c']) if (z[k]) z[k] = prevod(z[k]);
      if (platna) out.push(z);
    }
    return out;
  };

  // ------------------------------------------------------------ soustava rovnic
  const KLICE = { obdelnik: ['x', 'y', 'w', 'h'], kruh: ['x', 'y', 'rx', 'ry'], nuhelnik: ['x', 'y', 'r', 'natoceni'], text: ['x', 'y'], polygony: ['x', 'y'] };
  const MIN_KLADNE = { w: 0.01, h: 0.01, rx: 0.005, ry: 0.005, r: 0.005 };

  /** Proměnné všech tvarů: X (hodnoty), info [{ti, klic | j, osa}], ix[ti] = {klic: index} nebo {base}. */
  function promenneTvaru(tvary) {
    const info = [], ix = [], hodnoty = [];
    tvary.forEach((t, ti) => {
      if (t.typ === 'cesta') {
        ix[ti] = { base: hodnoty.length };
        t.body.forEach((b, j) => { info.push({ ti, j, osa: 0 }, { ti, j, osa: 1 }); hodnoty.push(b.x, b.y); });
      } else {
        const m = {};
        for (const k of KLICE[t.typ] || []) { m[k] = hodnoty.length; info.push({ ti, klic: k }); hodnoty.push(t[k]); }
        ix[ti] = m;
      }
    });
    return { X: Float64Array.from(hodnoty), info, ix };
  }

  /** Sestaví rezidua vazeb nad proměnnými. Vrací {skupiny: [{vazba, deps, f, n}]}. */
  function sestavRezidua(tvary, vazby, P, promenne) {
    const indexTvaru = new Map();
    tvary.forEach((t, ti) => { if (t.id) indexTvaru.set(t.id, ti); });
    const X0 = P.X;
    // bod: {deps, f(X) → [x, y]}
    const bod = r => {
      const ti = indexTvaru.get(r.t), t = tvary[ti], ix = P.ix[ti];
      if (t.typ === 'cesta') { const i = ix.base + 2 * r.b; return { deps: [i, i + 1], f: X => [X[i], X[i + 1]] }; }
      const deps = r.b === 's' ? [ix.x, ix.y] : r.b[0] === 'r' ? [ix.x, ix.y, ix.w, ix.h] : [ix.x, ix.y, ix.r, ix.natoceni];
      return { deps, f: X => souradniceBodu(t, r.b, k => X[ix[k]], null) };
    };
    const usecka = r => {
      const t = tvary[indexTvaru.get(r.t)], konce = konceUsecky(t, r);
      return { p: bod(konce[0]), q: bod(konce[1]), konce };
    };
    const kruznice = r => {
      const ti = indexTvaru.get(r.t), t = tvary[ti], ix = P.ix[ti], ri = t.typ === 'kruh' ? ix.rx : ix.r;
      return { c: bod({ t: r.t, b: 's' }), ri, ryi: t.typ === 'kruh' ? ix.ry : -1 };
    };
    const sjednot = s => [...new Set([s].flat(3))];
    const skupiny = [];
    const pridej = (v, deps, f, n) => skupiny.push({ vazba: v, deps: sjednot(deps), f, n });
    const delkaV = (p, q) => Math.max(1e-12, Math.hypot(q[0] - p[0], q[1] - p[1]));
    const krizne = (d1, d2) => d1[0] * d2[1] - d1[1] * d2[0];

    for (const v of vazby) {
      if (v.ref) continue;
      const D = M.TYPY_VAZEB[v.typ];
      let h = D.hodnota ? M.hodnotaVazby(v, promenne) : null;
      if (D.hodnota && !isFinite(h)) continue;
      const dA = druhOdkazu(v.a);
      // dvojice bodů (pro vodorovne/svisle/delka z bodů i úsečky)
      const dvojice = () => dA === 'usecka' ? (() => { const u = usecka(v.a); return [u.p, u.q]; })() : [bod(v.a), bod(v.b)];
      switch (v.typ) {
        case 'vodorovne': case 'svisle': case 'vzdalX': case 'vzdalY': {
          const [p, q] = dvojice(), osa = v.typ === 'vodorovne' || v.typ === 'vzdalY' ? 1 : 0;
          // hrana obdélníku ve „své“ ose je splněná vždy – žádná rovnice
          if (dA === 'usecka' && tvary[indexTvaru.get(v.a.t)].typ === 'obdelnik' && (v.a.u % 2 === 0) === (osa === 1)) break;
          const cil = v.typ === 'vzdalX' || v.typ === 'vzdalY' ? (v.smer || 1) * h : 0;
          pridej(v, [p.deps, q.deps], X => [q.f(X)[osa] - p.f(X)[osa] - cil], 1);
          break;
        }
        case 'delka': {
          const [p, q] = dvojice();
          pridej(v, [p.deps, q.deps], X => [delkaV(p.f(X), q.f(X)) - h], 1);
          break;
        }
        case 'rovnobezne': case 'kolme': {
          const u1 = usecka(v.a), u2 = usecka(v.b), kolme = v.typ === 'kolme';
          pridej(v, [u1.p.deps, u1.q.deps, u2.p.deps, u2.q.deps], X => {
            const a = u1.p.f(X), b = u1.q.f(X), c = u2.p.f(X), d = u2.q.f(X);
            const l1 = delkaV(a, b), l2 = delkaV(c, d);
            const d1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], d2 = [(d[0] - c[0]) / l2, (d[1] - c[1]) / l2];
            return [kolme ? d1[0] * d2[0] + d1[1] * d2[1] : krizne(d1, d2)];
          }, 1);
          break;
        }
        case 'stejne': {
          if (dA === 'usecka') {
            const u1 = usecka(v.a), u2 = usecka(v.b);
            pridej(v, [u1.p.deps, u1.q.deps, u2.p.deps, u2.q.deps], X => [delkaV(u1.p.f(X), u1.q.f(X)) - delkaV(u2.p.f(X), u2.q.f(X))], 1);
          } else {
            const k1 = kruznice(v.a), k2 = kruznice(v.b);
            pridej(v, [k1.ri, k2.ri], X => [X[k1.ri] - X[k2.ri]], 1);
          }
          break;
        }
        case 'splyva': {
          const p = bod(v.a), q = bod(v.b);
          pridej(v, [p.deps, q.deps], X => { const a = p.f(X), b = q.f(X); return [b[0] - a[0], b[1] - a[1]]; }, 2);
          break;
        }
        case 'pevny': {
          const p = bod(v.a), c = v.hodnota;
          pridej(v, p.deps, X => { const a = p.f(X); return [a[0] - c[0], a[1] - c[1]]; }, 2);
          break;
        }
        case 'naPrimce': {
          const p = bod(v.a), u = usecka(v.b);
          pridej(v, [p.deps, u.p.deps, u.q.deps], X => {
            const s = p.f(X), a = u.p.f(X), b = u.q.f(X);
            return [krizne([b[0] - a[0], b[1] - a[1]], [s[0] - a[0], s[1] - a[1]]) / delkaV(a, b)];
          }, 1);
          break;
        }
        case 'stredUsecky': {
          const p = bod(v.a), u = usecka(v.b);
          pridej(v, [p.deps, u.p.deps, u.q.deps], X => {
            const s = p.f(X), a = u.p.f(X), b = u.q.f(X);
            return [s[0] - (a[0] + b[0]) / 2, s[1] - (a[1] + b[1]) / 2];
          }, 2);
          break;
        }
        case 'tecna': {
          const u = usecka(v.a), k = kruznice(v.b);
          const vzd = X => { const a = u.p.f(X), b = u.q.f(X), c = k.c.f(X); return krizne([b[0] - a[0], b[1] - a[1]], [c[0] - a[0], c[1] - a[1]]) / delkaV(a, b); };
          const s = vzd(X0) < 0 ? -1 : 1;              // střed zůstane na své straně přímky
          pridej(v, [u.p.deps, u.q.deps, k.c.deps, [k.ri]], X => [s * vzd(X) - X[k.ri]], 1);
          break;
        }
        case 'symetrie': {
          const p = bod(v.a), q = bod(v.b), u = usecka(v.c);
          pridej(v, [p.deps, q.deps, u.p.deps, u.q.deps], X => {
            const s = p.f(X), t = q.f(X), a = u.p.f(X), b = u.q.f(X), l = delkaV(a, b);
            const e = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], m = [(s[0] + t[0]) / 2 - a[0], (s[1] + t[1]) / 2 - a[1]];
            return [krizne(e, m), e[0] * (t[0] - s[0]) + e[1] * (t[1] - s[1])];
          }, 2);
          break;
        }
        case 'prumer': {
          const k = kruznice(v.a);
          pridej(v, [k.ri], X => [2 * X[k.ri] - h], 1);
          if (k.ryi >= 0) pridej(v, [k.ri, k.ryi], X => [X[k.ryi] - X[k.ri]], 1);
          break;
        }
        case 'uhel': {
          const u1 = usecka(v.a), u2 = usecka(v.b), spol = spolecnyKonec(u1.konce, u2.konce);
          const uhel = X => { const [d1, d2] = smeryProUhel(u1.p.f(X), u1.q.f(X), u2.p.f(X), u2.q.f(X), spol); return uhelSmeru(d1, d2); };
          // znaménko (orientace) zapamatované při vytvoření, jinak podle současné polohy
          const zn = v.smer === 1 || v.smer === -1 ? v.smer : uhel(X0) < 0 ? -1 : 1, cil = zn * Math.abs(h) * RAD;
          pridej(v, [u1.p.deps, u1.q.deps, u2.p.deps, u2.q.deps], X => [wrap(uhel(X) - cil)], 1);
          break;
        }
      }
    }
    return skupiny;
  }

  // ------------------------------------------------------------ lineární algebra
  /** Rezidua a řídký Jakobián (centrální diference jen přes závislosti). */
  function vyhodnot(skupiny, X, sJakobianem) {
    let m = 0;
    for (const g of skupiny) m += g.n;
    const r = new Float64Array(m), radky = sJakobianem ? new Array(m) : null;
    let i = 0;
    for (const g of skupiny) {
      const f0 = g.f(X);
      for (let k = 0; k < g.n; k++) r[i + k] = f0[k];
      if (sJakobianem) {
        const hodn = [];
        for (let k = 0; k < g.n; k++) hodn.push(new Float64Array(g.deps.length));
        g.deps.forEach((d, j) => {
          const x = X[d], h = 1e-6 * Math.max(1, Math.abs(x));
          X[d] = x + h; const fp = g.f(X);
          X[d] = x - h; const fm = g.f(X);
          X[d] = x;
          for (let k = 0; k < g.n; k++) hodn[k][j] = (fp[k] - fm[k]) / (2 * h);
        });
        for (let k = 0; k < g.n; k++) radky[i + k] = { idx: g.deps, val: hodn[k] };
      }
      i += g.n;
    }
    return { r, radky };
  }

  /** K = J Jᵀ + λ·s·I (husté m×m, s = průměr diagonály) a jeho Choleského rozklad. */
  function rozlozJJt(radky, n, lambda) {
    const m = radky.length, K = new Float64Array(m * m);
    const sloupce = Array.from({ length: n }, () => []);
    radky.forEach((rd, i) => { for (let j = 0; j < rd.idx.length; j++) if (rd.val[j] !== 0) sloupce[rd.idx[j]].push(i, rd.val[j]); });
    for (const s of sloupce) for (let a = 0; a < s.length; a += 2) for (let b = a; b < s.length; b += 2) {
      const i = s[a], k = s[b], v = s[a + 1] * s[b + 1];
      K[i * m + k] += v; if (i !== k) K[k * m + i] += v;
    }
    let st = 0;
    for (let i = 0; i < m; i++) st += K[i * m + i];
    st = st / Math.max(1, m) || 1;
    const lam = lambda * st + 1e-300;
    for (let i = 0; i < m; i++) K[i * m + i] += lam;
    // Cholesky na místě (dolní trojúhelník)
    for (let j = 0; j < m; j++) {
      let s = K[j * m + j];
      for (let k = 0; k < j; k++) s -= K[j * m + k] * K[j * m + k];
      if (!(s > 0)) s = lam > 0 ? lam : 1e-300;
      const d = Math.sqrt(s);
      K[j * m + j] = d;
      for (let i = j + 1; i < m; i++) {
        let t = K[i * m + j];
        for (let k = 0; k < j; k++) t -= K[i * m + k] * K[j * m + k];
        K[i * m + j] = t / d;
      }
    }
    return { L: K, m };
  }
  function resCholesky(R, b) {
    const { L, m } = R, y = Float64Array.from(b);
    for (let i = 0; i < m; i++) { let s = y[i]; for (let k = 0; k < i; k++) s -= L[i * m + k] * y[k]; y[i] = s / L[i * m + i]; }
    for (let i = m - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < m; k++) s -= L[k * m + i] * y[k]; y[i] = s / L[i * m + i]; }
    return y;
  }
  /** Jᵀ y (hustý vektor délky n). */
  function JtKrat(radky, y, n) {
    const out = new Float64Array(n);
    radky.forEach((rd, i) => { const c = y[i]; if (c) for (let j = 0; j < rd.idx.length; j++) out[rd.idx[j]] += rd.val[j] * c; });
    return out;
  }
  /** J x (x hustý). */
  function JKrat(radky, x) {
    const out = new Float64Array(radky.length);
    radky.forEach((rd, i) => { let s = 0; for (let j = 0; j < rd.idx.length; j++) s += rd.val[j] * x[rd.idx[j]]; out[i] = s; });
    return out;
  }
  const norma2 = r => { let s = 0; for (let i = 0; i < r.length; i++) s += r[i] * r[i]; return s; };
  const maxAbs = r => { let s = 0; for (let i = 0; i < r.length; i++) s = Math.max(s, Math.abs(r[i])); return s; };

  // ------------------------------------------------------------ řešič
  /** Je stav platný (konečná čísla, kladné rozměry)? */
  function platnyStav(X, P) {
    for (let i = 0; i < X.length; i++) {
      if (!isFinite(X[i]) || Math.abs(X[i]) > 1e6) return false;
      const k = P.info[i].klic;
      if (k && MIN_KLADNE[k] && X[i] < MIN_KLADNE[k]) return false;
    }
    return true;
  }

  /** Levenberg–Marquardt s krokem nejmenší normy na tvrdých vazbách. Mění X. */
  function resTvrde(skupiny, X, P, maxIter) {
    const n = X.length;
    let lambda = 1e-12, iter = 0;
    let { r, radky } = vyhodnot(skupiny, X, true), F = norma2(r);
    while (iter++ < maxIter && maxAbs(r) > TOL) {
      let prijato = false;
      for (let pokus = 0; pokus < 12 && !prijato; pokus++) {
        const R = rozlozJJt(radky, n, lambda);
        const dx = JtKrat(radky, resCholesky(R, r), n);
        const Xn = Float64Array.from(X);
        for (let i = 0; i < n; i++) Xn[i] -= dx[i];
        if (platnyStav(Xn, P)) {
          const rn = vyhodnot(skupiny, Xn, false).r, Fn = norma2(rn);
          if (Fn < F) { X.set(Xn); prijato = true; lambda = Math.max(1e-12, lambda / 10); break; }
        }
        lambda = Math.max(lambda * 10, 1e-9);
      }
      if (!prijato) break;
      ({ r, radky } = vyhodnot(skupiny, X, true));
      const Fn = norma2(r);
      if (F - Fn < 1e-30 * (1 + F) && maxAbs(r) > TOL) { F = Fn; if (iter > 3) break; }
      F = Fn;
    }
    return r;
  }

  /** Tah: měkká rezidua (bod − cíl) zmenšovaná v nulovém prostoru tvrdých vazeb. Mění X. */
  function resTah(skupiny, mekke, X, P, maxIter) {
    const n = X.length;
    let tvrde = vyhodnot(skupiny, X, true), mek = vyhodnot(mekke, X, true);
    let F1 = norma2(tvrde.r), F2 = norma2(mek.r);
    for (let iter = 0; iter < maxIter; iter++) {
      if (F2 < TOL * TOL) break;
      const m1 = tvrde.radky.length;
      const R = m1 ? rozlozJJt(tvrde.radky, n, 1e-12) : null;
      const dx1 = m1 ? JtKrat(tvrde.radky, resCholesky(R, tvrde.r), n).map(x => -x) : new Float64Array(n);
      // řádky měkkého Jakobiánu promítnuté do nulového prostoru tvrdých vazeb
      const J2dx1 = JKrat(mek.radky, dx1);
      const A = [], b = [];
      mek.radky.forEach((rd, i) => {
        let puvodni = 0;
        for (let k = 0; k < rd.val.length; k++) puvodni += rd.val[k] * rd.val[k];
        const j = new Float64Array(n);
        for (let k = 0; k < rd.idx.length; k++) j[rd.idx[k]] += rd.val[k];
        if (m1) {
          const opr = JtKrat(tvrde.radky, resCholesky(R, JKrat(tvrde.radky, j)), n);
          for (let k = 0; k < n; k++) j[k] -= opr[k];
        }
        // směr, kterým vazby nedovolí hnout (zbylo jen numerické prosáknutí), se zahodí
        if (norma2(j) > 1e-8 * puvodni) { A.push(j); b.push(-(mek.r[i] + J2dx1[i])); }
      });
      if (!A.length && F1 < TOL * TOL) break;
      const m2 = A.length, G = new Float64Array(m2 * m2);
      for (let i = 0; i < m2; i++) for (let k = 0; k < m2; k++) { let s = 0; for (let q = 0; q < n; q++) s += A[i][q] * A[k][q]; G[i * m2 + k] = s; }
      for (let i = 0; i < m2; i++) G[i * m2 + i] += 1e-12 * (1 + G[i * m2 + i]);
      // malá soustava (2×2) Gaussovou eliminací
      const y = resMalou(G, Float64Array.from(b), m2);
      const dx = Float64Array.from(dx1);
      for (let i = 0; i < m2; i++) for (let q = 0; q < n; q++) dx[q] += A[i][q] * y[i];
      let prijato = false;
      for (let alfa = 1; alfa > 1e-4; alfa /= 2) {
        const Xn = Float64Array.from(X);
        for (let q = 0; q < n; q++) Xn[q] += alfa * dx[q];
        if (!platnyStav(Xn, P)) continue;
        // krok po tečně nulového prostoru vazby trochu poruší (zakřivení) – vrátit je na přesnost
        if (skupiny.length) resTvrde(skupiny, Xn, P, 10);
        const F1n = norma2(vyhodnot(skupiny, Xn, false).r), F2n = norma2(vyhodnot(mekke, Xn, false).r);
        if (F1n <= Math.max(F1, TOL * TOL) * (1 + 1e-9) && F2n < F2 * (1 - 1e-9)) { X.set(Xn); prijato = true; break; }
      }
      if (!prijato) break;
      tvrde = vyhodnot(skupiny, X, true); mek = vyhodnot(mekke, X, true);
      const F2n = norma2(mek.r);
      F1 = norma2(tvrde.r);
      if (F2 - F2n < 1e-24 * (1 + F2)) { F2 = F2n; break; }
      F2 = F2n;
    }
  }
  function resMalou(G, b, m) {
    const A = Float64Array.from(G);
    for (let c = 0; c < m; c++) {
      let p = c;
      for (let i = c + 1; i < m; i++) if (Math.abs(A[i * m + c]) > Math.abs(A[p * m + c])) p = i;
      if (p !== c) { for (let k = 0; k < m; k++) { const t = A[c * m + k]; A[c * m + k] = A[p * m + k]; A[p * m + k] = t; } const t = b[c]; b[c] = b[p]; b[p] = t; }
      const d = A[c * m + c] || 1e-300;
      for (let i = c + 1; i < m; i++) { const f = A[i * m + c] / d; for (let k = c; k < m; k++) A[i * m + k] -= f * A[c * m + k]; b[i] -= f * b[c]; }
    }
    const x = new Float64Array(m);
    for (let i = m - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < m; k++) s -= A[i * m + k] * x[k]; x[i] = s / (A[i * m + i] || 1e-300); }
    return x;
  }

  /** Volnost: hodnost Jakobiánu (Choleského rozklad Gramovy matice normovaných řádků
      s pivotací) a určené tvary (proměnné celé v řádkovém prostoru = mimo nulový prostor). */
  function volnostZ(radky, P, tvary) {
    const n = P.X.length;
    const R = [];
    for (const rd of radky) {
      let s = 0;
      for (let k = 0; k < rd.val.length; k++) s += rd.val[k] * rd.val[k];
      if (s > 1e-18) { const c = 1 / Math.sqrt(s); R.push({ idx: rd.idx, val: Array.from(rd.val, x => x * c) }); }
    }
    const m = R.length;
    // Gramova matice G = J Jᵀ přes sloupce (řídce)
    const G = new Float64Array(m * m), sloupce = Array.from({ length: n }, () => []);
    R.forEach((rd, i) => { for (let j = 0; j < rd.idx.length; j++) if (rd.val[j] !== 0) sloupce[rd.idx[j]].push(i, rd.val[j]); });
    for (const s of sloupce) for (let a = 0; a < s.length; a += 2) for (let b = a; b < s.length; b += 2) {
      const i = s[a], k = s[b], v = s[a + 1] * s[b + 1];
      G[i * m + k] += v; if (i !== k) G[k * m + i] += v;
    }
    // Cholesky s pivotací: d = kvadrát zbytku řádku po odečtení už vybraných
    const d = new Float64Array(m), Lr = [], piv = [], zbyva = new Set();
    for (let i = 0; i < m; i++) { d[i] = G[i * m + i]; Lr.push(new Float64Array(m)); zbyva.add(i); }
    while (zbyva.size) {
      let p = -1;
      for (const q of zbyva) if (p < 0 || d[q] > d[p]) p = q;
      if (d[p] < 1e-11) break;                         // zbytek řádku pod ~3e-6: lineárně závislý
      const j = piv.length, Lp = Lr[p], lpp = Math.sqrt(d[p]);
      Lp[j] = lpp; zbyva.delete(p); piv.push(p);
      for (const q of zbyva) {
        const Lq = Lr[q];
        let s = G[q * m + p];
        for (let l = 0; l < j; l++) s -= Lq[l] * Lp[l];
        Lq[j] = s / lpp;
        d[q] -= Lq[j] * Lq[j];
      }
    }
    const r = piv.length;
    // diagonála projektoru na řádkový prostor: cₖ = sloupec k vybraných řádků, |L⁻¹ cₖ|²
    const poziceRadku = new Int32Array(m).fill(-1);
    piv.forEach((p, j) => { poziceRadku[p] = j; });
    const volne = new Set(), z = new Float64Array(r);
    for (let k = 0; k < n; k++) {
      const s = sloupce[k];
      let i0 = r;
      z.fill(0, 0, r);
      for (let a = 0; a < s.length; a += 2) { const j = poziceRadku[s[a]]; if (j >= 0) { z[j] += s[a + 1]; i0 = Math.min(i0, j); } }
      let diag = 0;
      for (let i = i0; i < r; i++) {
        const Li = Lr[piv[i]];
        let t = z[i];
        for (let l = i0; l < i; l++) t -= Li[l] * z[l];
        z[i] = t / Li[i];
        diag += z[i] * z[i];
      }
      if (diag < 1 - 1e-6) volne.add(P.info[k].ti);
    }
    const urcene = tvary.filter((t, ti) => !volne.has(ti) && t.id).map(t => t.id);
    return { volnost: n - r, urcene };
  }

  /** Nové tvary s hodnotami proměnných X. */
  function tvaryZ(tvary, P, X) {
    return tvary.map((t, ti) => {
      const z = Object.assign({}, t), ix = P.ix[ti];
      if (t.typ === 'cesta') z.body = t.body.map((b, j) => Object.assign({}, b, { x: X[ix.base + 2 * j], y: X[ix.base + 2 * j + 1] }));
      else for (const k of KLICE[t.typ] || []) z[k] = X[ix[k]];
      return z;
    });
  }

  /** Vyřeší vazby skici. volby: {promenne, tah: {ref: bod, x, y}}.
      Vrací {tvary, ok, zbytek, konflikt: [id], volnost, urcene: [id tvarů]}. */
  M.resVazbySkici = function (tvary, vazby, volby = {}) {
    tvary = Array.isArray(tvary) ? tvary : [];
    const V = M.normalizujVazbySkici(vazby, tvary);
    const P = promenneTvaru(tvary);
    const skupiny = sestavRezidua(tvary, V, P, volby.promenne);
    const X = Float64Array.from(P.X);
    // nejdřív vazby (nejmenší změna), potom případný tah v jejich nulovém prostoru
    if (skupiny.length) resTvrde(skupiny, X, P, MAX_ITERACI);
    const tah = volby.tah;
    const tahRef = tah && isFinite(tah.x) && isFinite(tah.y) ? normalizujOdkaz(tah.ref, mapaTvaru(tvary)) : null;
    if (tahRef && druhOdkazu(tahRef) === 'bod') {
      const pomocne = sestavRezidua(tvary, [{ typ: 'pevny', a: tahRef, hodnota: [+tah.x, +tah.y] }], P, null);
      resTah(skupiny, pomocne, X, P, MAX_ITERACI);
    }
    let { r, radky } = vyhodnot(skupiny, X, true);
    let zbytek = maxAbs(r);
    // bez řešení (nekonečna apod.) zůstanou původní tvary
    if (!platnyStav(X, P)) { X.set(P.X); ({ r, radky } = vyhodnot(skupiny, X, true)); zbytek = maxAbs(r); }
    const ok = zbytek < TOL_OK;
    const konflikt = [];
    if (!ok) {
      let i = 0;
      for (const g of skupiny) {
        let max = 0;
        for (let k = 0; k < g.n; k++) max = Math.max(max, Math.abs(r[i + k]));
        if (max >= TOL_OK && !konflikt.includes(g.vazba.id)) konflikt.push(g.vazba.id);
        i += g.n;
      }
    }
    const vol = volnostZ(radky || [], P, tvary);
    return { tvary: tvaryZ(tvary, P, X), ok, zbytek, konflikt, volnost: vol.volnost, urcene: vol.urcene };
  };

  /** Stupně volnosti skici a plně určené tvary (bez řešení, v současné poloze). */
  M.volnostSkici = function (tvary, vazby, promenne) {
    tvary = Array.isArray(tvary) ? tvary : [];
    const P = promenneTvaru(tvary);
    const skupiny = sestavRezidua(tvary, M.normalizujVazbySkici(vazby, tvary), P, promenne);
    return volnostZ(vyhodnot(skupiny, Float64Array.from(P.X), true).radky, P, tvary);
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
