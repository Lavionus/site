/* Modelář 3D – proměnné projektu a vzorce v polích (bez DOM, jde v node).
   Dokument: dok.promenne = [{jmeno, vyraz, popis}] – výraz smí odkazovat na jiné
   proměnné („D/2 + vule“), pořadí nehraje roli, cyklus je chyba.
   Uzel: u.vzorce = {klic: výraz} – pole inspektoru, jehož hodnotu dává výraz:
     'rozmer.0..2', 'poloha.0', 'poloha.1', 'spodek' (Z spodku nad deskou), 'rotace.0..2',
     'param.<klic>' (parametr tvaru, dílu nebo skici), 'odv.<klic>' (odvozené pole tvaru).
   Skupina může mít vlastní u.promenne (parametrický díl z knihovny): její děti
   vidí proměnné projektu i skupiny (skupina má přednost).
   Kóty skici (param.vazby s výrazem) se po změně proměnných vyřeší znovu (jadro/vazby.js).
   M.aplikujVzorce(dok) přepočítá všechna pole se vzorcem – volá se po změně proměnných. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  const MAX_PROMENNYCH = 200, MAX_VZORCU = 60;
  const r6 = x => Math.round(x * 1e6) / 1e6;
  const KLIC_VZORCE = /^(rozmer\.[012]|poloha\.[01]|spodek|rotace\.[012]|param\.\w{1,40}|odv\.\w{1,40})$/;

  /** Opraví seznam proměnných: platná a jedinečná jména (bez ohledu na velikost písmen), texty v mezích. */
  M.normalizujPromenne = function (pole) {
    const out = [], videna = new Set();
    for (const p of Array.isArray(pole) ? pole : []) {
      if (!p || !M.jmenoPromenneOk(p.jmeno)) continue;
      const k = p.jmeno.toLowerCase();
      if (videna.has(k)) continue;
      videna.add(k);
      const vyraz = typeof p.vyraz === 'number' && isFinite(p.vyraz) ? String(p.vyraz) : typeof p.vyraz === 'string' ? p.vyraz.trim().slice(0, 200) : '0';
      const z = { jmeno: p.jmeno, vyraz: vyraz || '0' };
      if (typeof p.popis === 'string' && p.popis.trim()) z.popis = p.popis.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, 80);
      out.push(z);
      if (out.length >= MAX_PROMENNYCH) break;
    }
    return out;
  };

  /** Opraví vzorce uzlu (jen známé klíče a texty); prázdné → null. */
  M.normalizujVzorce = function (v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const out = {};
    let n = 0;
    for (const [k, x] of Object.entries(v)) {
      if (!KLIC_VZORCE.test(k) || typeof x !== 'string' || !x.trim()) continue;
      out[k] = x.trim().slice(0, 200);
      if (++n >= MAX_VZORCU) break;
    }
    return n ? out : null;
  };

  /** Hodnoty proměnných: {hodnoty: Map (jméno malými → číslo, i zděděné), chyby: {jméno: text}}.
      zaklad = hodnoty nadřazeného rozsahu (projekt pro proměnné skupiny). */
  M.vyhodnotPromenne = function (seznam, zaklad = null) {
    const hodnoty = new Map(zaklad || []), chyby = {};
    const zbyva = (seznam || []).slice();
    const vlastni = new Set(zbyva.map(p => p.jmeno.toLowerCase()));
    // vlastní proměnné zakryjí zděděné stejného jména – do vyhodnocení se zděděná hodnota nesmí dostat
    for (const k of vlastni) hodnoty.delete(k);
    let pokrok = true;
    while (zbyva.length && pokrok) {
      pokrok = false;
      for (let i = 0; i < zbyva.length; i++) {
        const p = zbyva[i], potreba = M.promenneVeVyrazu(p.vyraz);
        if (potreba.some(j => !hodnoty.has(j) && vlastni.has(j))) continue;      // čeká na jinou vlastní proměnnou
        const v = M.prectiCislo(p.vyraz, hodnoty);
        if (isFinite(v)) hodnoty.set(p.jmeno.toLowerCase(), v);
        else {
          const nezname = potreba.filter(j => !hodnoty.has(j));
          chyby[p.jmeno] = nezname.length ? 'neznámé jméno: ' + nezname.join(', ') : 'chybný výraz';
        }
        zbyva.splice(i--, 1);
        pokrok = true;
      }
    }
    for (const p of zbyva) chyby[p.jmeno] = 'proměnné na sebe odkazují dokola';
    return { hodnoty, chyby };
  };

  /** Hodnoty proměnných projektu (Map). */
  M.hodnotyPromennych = dok => M.vyhodnotPromenne(dok.promenne || []).hodnoty;

  /** Rozsah proměnných pro uzel id: projekt + proměnné skupin na cestě k němu (nebo null, není-li uzel). */
  M.rozsahUzlu = function (dok, id) {
    const hledej = (uzly, rozsah) => {
      for (const u of uzly) {
        if (u.id === id) return rozsah;
        if (u.deti) {
          const r = hledej(u.deti, u.promenne && u.promenne.length ? M.vyhodnotPromenne(u.promenne, rozsah).hodnoty : rozsah);
          if (r) return r;
        }
      }
      return null;
    };
    return hledej(dok.uzly, M.hodnotyPromennych(dok));
  };

  /** Popis pole tvaru (parametr nebo odvozené pole) pro klíč 'param.x' / 'odv.x'. */
  function popisPole(u, klic) {
    const t = M.popisDruhu(u.druh), k = klic.slice(klic.indexOf('.') + 1);
    return t && t.parametry ? t.parametry.find(d => d.klic === k) : null;
  }
  const vychoziParam = u => Object.assign({}, (M.TVARY[u.druh] || (M.DILY && M.DILY[u.druh]) || {}).param, u.param);

  /** Současná hodnota pole uzlu (jako ji ukazuje inspektor), nebo NaN. */
  M.hodnotaPole = function (u, klic) {
    const [co, k] = klic.split('.');
    if (co === 'rozmer') return u.rozmer[+k];
    if (co === 'poloha') return u.poloha[+k];
    if (co === 'spodek') return M.spodekUzlu(u);
    if (co === 'rotace') return u.rotace[+k];
    if (co === 'param') return typeof u.param[k] === 'number' ? u.param[k] : NaN;
    if (co === 'odv') { const d = popisPole(u, klic); return d && d.odvozeny ? d.cti(u.rozmer, vychoziParam(u)) : NaN; }
    return NaN;
  };

  /** Změna uzlu (objekt pro Object.assign), která nastaví pole klic na v – stejně jako inspektor:
      rozměr drží spodek na místě, parametr dílu / skici zachová počátek a měřítko. null = pole neexistuje. */
  M.zmenaPole = function (u, klic, v) {
    const [co, k] = klic.split('.');
    if (co === 'rozmer') {
      const rozmer = u.rozmer.slice(); rozmer[+k] = M.omez(v, 0.01, 10000);
      return { rozmer, poloha: M.polohaSeSpodkem(Object.assign({}, u, { rozmer }), M.spodekUzlu(u)) };
    }
    if (co === 'poloha') { const poloha = u.poloha.slice(); poloha[+k] = v; return { poloha }; }
    if (co === 'spodek') return { poloha: M.polohaSeSpodkem(u, v) };
    if (co === 'rotace') { const rotace = u.rotace.slice(); rotace[+k] = v; return { rotace }; }
    const d = popisPole(u, klic);
    if (!d) return null;
    if (co === 'param') {
      if (d.odvozeny || d.volby || d.prepinac || d.text) return null;
      const x = M.omez(d.cele ? Math.round(v) : v, d.min, d.max);
      return M.maPrirozene(u) ? M.upravPrirozeny(u, { [k]: x }) : { param: Object.assign({}, u.param, { [k]: x }) };
    }
    if (co === 'odv' && d.odvozeny) {
      const z = d.zapis(u.rozmer, vychoziParam(u), M.omez(v, d.min, d.max)) || {};
      if (M.maPrirozene(u)) return z.param ? M.upravPrirozeny(u, z.param) : null;
      const zmena = {};
      if (z.param) zmena.param = M.normalizujParam(u.druh, Object.assign({}, u.param, z.param));
      if (z.rozmer) {
        zmena.rozmer = z.rozmer.map(x => M.omez(x, 0.01, 10000));
        zmena.poloha = M.polohaSeSpodkem(Object.assign({}, u, zmena), M.spodekUzlu(u));
      }
      return zmena;
    }
    return null;
  };

  /** Uzel se všemi vzorci přepočtenými v rozsahu proměnných; chyby se přidají do pole chyby. */
  function prepocitejUzel(u, rozsah, chyby) {
    let n = u;
    if (u.vzorce) {
      for (const [klic, vyraz] of Object.entries(u.vzorce)) {
        const v = M.prectiCislo(vyraz, rozsah);
        if (!isFinite(v)) { chyby.push({ id: u.id, nazev: u.nazev, klic, vyraz }); continue; }
        const ted = M.hodnotaPole(n, klic);
        if (isFinite(ted) && Math.abs(ted - v) < 1e-9) continue;
        const z = M.zmenaPole(n, klic, v);
        if (z) n = M.normalizujUzel(Object.assign({}, n, z, { id: u.id }));
      }
    }
    // kóty skici s výrazem: vyřešit vazby znovu
    if (n.druh === 'skica' && n.param.vazby && n.param.vazby.some(v => v.vyraz) && M.resVazbySkici) {
      try {
        const r = M.resVazbySkici(n.param.tvary, n.param.vazby, { promenne: rozsah });
        if (r && r.tvary && JSON.stringify(r.tvary) !== JSON.stringify(n.param.tvary))
          n = M.normalizujUzel(Object.assign({}, n, M.upravPrirozeny(n, { tvary: r.tvary }), { id: u.id }));
        if (r && !r.ok) chyby.push({ id: u.id, nazev: u.nazev, klic: 'skica', vyraz: 'vazby skici nejdou splnit' });
      } catch (e) { chyby.push({ id: u.id, nazev: u.nazev, klic: 'skica', vyraz: e.message }); }
    }
    if (n.deti) {
      const r2 = n.promenne && n.promenne.length ? M.vyhodnotPromenne(n.promenne, rozsah).hodnoty : rozsah;
      const deti = n.deti.map(d => prepocitejUzel(d, r2, chyby));
      if (deti.some((d, i) => d !== n.deti[i])) n = M.prestavSkupinu(n, deti);
    }
    return n;
  }

  /** Přepočítá všechna pole se vzorcem (i ve skupinách) a kóty skic s výrazy.
      Vrací {dok, chyby: [{id, nazev, klic, vyraz}], zmenenych}. */
  M.aplikujVzorce = function (dok) {
    const rozsah = M.hodnotyPromennych(dok), chyby = [];
    let zmenenych = 0;
    const uzly = dok.uzly.map(u => { const n = prepocitejUzel(u, rozsah, chyby); if (n !== u) zmenenych++; return n; });
    return { dok: zmenenych ? Object.assign({}, dok, { uzly }) : dok, chyby, zmenenych };
  };

  /** Dokument s novými proměnnými projektu a přepočtenými vzorci. */
  M.dokSPromennymi = function (dok, promenne) {
    const d = Object.assign({}, dok, { promenne: M.normalizujPromenne(promenne) });
    if (!d.promenne.length) delete d.promenne;
    return M.aplikujVzorce(d);
  };

  /** Uzel s nastaveným (vyraz) nebo zrušeným (null) vzorcem pole klic. */
  M.sVzorcem = function (u, klic, vyraz) {
    const v = Object.assign({}, u.vzorce || {});
    if (vyraz) v[klic] = vyraz; else delete v[klic];
    const n = Object.assign({}, u, { vzorce: M.normalizujVzorce(v) });
    if (!n.vzorce) delete n.vzorce;
    return n;
  };

  /** Projde všechny texty s výrazy (vzorce uzlů, kóty skic, proměnné projektu i skupin) funkcí f(text) → text. */
  function prepisVyrazy(dok, f) {
    const pp = pole => pole && pole.map(p => Object.assign({}, p, { vyraz: f(p.vyraz) }));
    const uzel = u => {
      let n = u;
      if (u.vzorce) n = Object.assign({}, n, { vzorce: Object.fromEntries(Object.entries(u.vzorce).map(([k, x]) => [k, f(x)])) });
      if (u.promenne) n = Object.assign({}, n, { promenne: pp(u.promenne) });
      if (u.druh === 'skica' && u.param.vazby) n = Object.assign({}, n, { param: Object.assign({}, n.param, { vazby: u.param.vazby.map(v => v.vyraz ? Object.assign({}, v, { vyraz: f(v.vyraz) }) : v) }) });
      if (u.deti) n = Object.assign({}, n, { deti: u.deti.map(uzel) });
      return n === u ? u : M.normalizujUzel(n);
    };
    const d = Object.assign({}, dok, { uzly: dok.uzly.map(uzel) });
    if (dok.promenne) d.promenne = pp(dok.promenne);
    return d;
  }
  const nahradJmeno = (text, stare, nove) => String(text).replace(/[\p{L}_][\p{L}\p{N}_]*/gu, (m, i, s) =>
    m.toLowerCase() === stare && !(i > 0 && /[\p{N}.]/u.test(s[i - 1]) && /^e\d*$/i.test(m)) ? nove : m);

  /** Přejmenuje proměnnou projektu i ve všech výrazech, které ji používají. */
  M.prejmenujPromennou = function (dok, stare, nove) {
    if (!M.jmenoPromenneOk(nove)) throw new Error(`„${nove}“ nejde použít jako jméno (písmena, číslice a _, ne jednotka ani funkce)`);
    const s = stare.toLowerCase();
    if (s !== nove.toLowerCase() && (dok.promenne || []).some(p => p.jmeno.toLowerCase() === nove.toLowerCase()))
      throw new Error(`proměnná „${nove}“ už existuje`);
    const d = prepisVyrazy(dok, t => nahradJmeno(t, s, nove));
    d.promenne = (d.promenne || []).map(p => p.jmeno.toLowerCase() === s ? Object.assign({}, p, { jmeno: nove }) : p);
    return d;
  };

  /** Kolikrát je proměnná použitá (vzorce uzlů, kóty skic, jiné proměnné). */
  M.pouzitiPromenne = function (dok, jmeno) {
    const s = jmeno.toLowerCase();
    let n = 0;
    prepisVyrazy(dok, t => { if (M.promenneVeVyrazu(t).includes(s)) n++; return t; });
    return n;
  };

  /** Odebere proměnnou; výrazy, které ji používaly, se nahradí čísly (hodnoty zůstanou). */
  M.odeberPromennou = function (dok, jmeno) {
    const s = jmeno.toLowerCase();
    const hodnoty = M.hodnotyPromennych(dok);
    const v = hodnoty.get(s);
    const cislo = isFinite(v) ? String(r6(v)) : '0';
    // výraz s proměnnou: dosadit hodnotu (závorky kvůli přednosti); výraz bez dalších proměnných = jen číslo
    let d = prepisVyrazy(dok, t => M.promenneVeVyrazu(t).includes(s) ? nahradJmeno(t, s, '(' + cislo + ')') : t);
    d.promenne = (d.promenne || []).filter(p => p.jmeno.toLowerCase() !== s);
    // vzorce, ve kterých už žádná proměnná nezůstala, jsou jen čísla – zrušit
    const zjednodus = u => {
      let n = u;
      if (u.vzorce) {
        const vz = Object.fromEntries(Object.entries(u.vzorce).filter(([, x]) => M.promenneVeVyrazu(x).length));
        n = Object.assign({}, n, { vzorce: Object.keys(vz).length ? vz : null });
        if (!n.vzorce) delete n.vzorce;
      }
      if (u.deti) n = Object.assign({}, n, { deti: u.deti.map(zjednodus) });
      return n === u ? u : M.normalizujUzel(n);
    };
    d = Object.assign({}, d, { uzly: d.uzly.map(zjednodus) });
    if (!d.promenne.length) delete d.promenne;
    return d;
  };

  /** Proměnné projektu použité ve vzorcích uzlů (i vnořených a v kótách skic) – pro parametrický díl. */
  M.promenneUzlu = function (uzly) {
    const out = new Set();
    const pridej = t => M.promenneVeVyrazu(t).forEach(j => out.add(j));
    const uzel = u => {
      if (u.vzorce) Object.values(u.vzorce).forEach(pridej);
      if (u.druh === 'skica' && u.param.vazby) u.param.vazby.forEach(v => v.vyraz && pridej(v.vyraz));
      if (u.deti) u.deti.forEach(uzel);
    };
    uzly.forEach(uzel);
    return [...out];
  };

  /** Proměnné potřebné pro jména jmena i s jejich závislostmi (pořadí jako v projektu). */
  M.promenneSeZavislostmi = function (dok, jmena) {
    const vse = dok.promenne || [], chci = new Set(jmena.map(j => j.toLowerCase()));
    let pridano = true;
    while (pridano) {
      pridano = false;
      for (const p of vse) if (chci.has(p.jmeno.toLowerCase())) for (const j of M.promenneVeVyrazu(p.vyraz)) if (!chci.has(j)) { chci.add(j); pridano = true; }
    }
    return vse.filter(p => chci.has(p.jmeno.toLowerCase()));
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
