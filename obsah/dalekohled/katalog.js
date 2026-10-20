/* dalekohled/katalog.js – jednotný katalog objektů a hledání.
   Identifikátory: p:<klíč tělesa>, h:<index BSC>, d:<id objektu> (Messier i NGC/IC…), x:<α>,<δ> (souřadnice). */
(function (koren) {
  'use strict';
  const D = koren.DALEK, DATA = koren.DALEK_DATA;
  const NGC = koren.DALEK_NGC || [];

  // všechny plošné objekty: Messier (+ jasné mimo Messiera) a rozšířený katalog
  const DSO = DATA.MESSIER.map(o => o.concat(['M'])).concat(NGC.map(o => o.slice(0, 9).concat([o[9] ? 'N:' + o[9] : 'N'])));
  // o[9] u Messiera = NGC označení; u NGC morfologie
  const DSO_ID = new Map(DSO.map(o => [o[0], o]));

  const TYPY = {
    gc: 'kulová hvězdokupa', oc: 'otevřená hvězdokupa', s: 'spirální galaxie', e: 'eliptická/čočková galaxie', i: 'nepravidelná galaxie',
    sd: 'trpasličí galaxie', pn: 'planetární mlhovina', sfr: 'emisní mlhovina', en: 'emisní mlhovina', rn: 'reflexní mlhovina',
    snr: 'pozůstatek supernovy', pos: 'skupina hvězd', dn: 'temná mlhovina',
  };
  const RECKA = [
    ['α', 'alfa', 'alpha', 'alp'], ['β', 'beta', 'beta', 'bet'], ['γ', 'gama', 'gamma', 'gam'], ['δ', 'delta', 'delta', 'del'],
    ['ε', 'epsilon', 'epsilon', 'eps'], ['ζ', 'zeta', 'zeta', 'zet'], ['η', 'eta', 'eta', 'eta'], ['θ', 'theta', 'theta', 'the'],
    ['ι', 'jota', 'iota', 'iot'], ['κ', 'kappa', 'kappa', 'kap'], ['λ', 'lambda', 'lambda', 'lam'], ['μ', 'mi', 'mu', 'mu'],
    ['ν', 'ni', 'nu', 'nu'], ['ξ', 'ksi', 'xi', 'xi'], ['ο', 'omikron', 'omicron', 'omi'], ['π', 'pi', 'pi', 'pi'], ['ρ', 'ro', 'rho', 'rho'],
    ['σ', 'sigma', 'sigma', 'sig'], ['τ', 'tau', 'tau', 'tau'], ['υ', 'ypsilon', 'upsilon', 'ups'], ['φ', 'fi', 'phi', 'phi'],
    ['χ', 'chi', 'chi', 'chi'], ['ψ', 'psi', 'psi', 'psi'], ['ω', 'omega', 'omega', 'ome'],
  ];
  const HORNI = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  const SOUH = Object.fromEntries(DATA.SOUHVEZDI.map(s => [s.id, s]));

  function normal(t) {
    let s = String(t).toLowerCase();
    for (const [k, v] of Object.entries(HORNI)) s = s.split(k).join(v);
    for (const [sym, cz] of RECKA) s = s.split(sym).join(cz + ' ');
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const [, cz, en, zk] of RECKA) {
      s = s.replace(new RegExp('\\b(' + en + '|' + zk + ')\\b', 'g'), cz);
    }
    return s.replace(/[^a-z0-9.+\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // index pro hledání: {id, nazev, popis, klice: [normalizované řetězce], mag}
  let INDEX = null;
  function postavIndex() {
    const ix = [];
    for (const k of D.KLICE_TELES) {
      const t = D.TELESA[k];
      ix.push({ id: 'p:' + k, nazev: t.jmeno, popis: k === 'mesic' ? 'Měsíc' : 'planeta', klice: [normal(t.jmeno), k], mag: -30 });
    }
    ix.push({ id: 'p:slunce', nazev: 'Slunce', popis: 'pozor – nebezpečné!', klice: ['slunce', 'sun'], mag: -40 });
    const H = DATA.H;
    const potlac = new Set(DATA.DVOJHVEZDY.flatMap(d => d[3] || []));
    for (let i = 0; i < DATA.pocet; i++) {
      if (potlac.has(i)) continue;
      const jm = DATA.JMENA[i], en = DATA.JMENA_EN[i], b = DATA.BAYER[i], pr = DATA.PROMENNE[i];
      const kl = ['hr ' + DATA.HR[i]];
      if (DATA.HD[i]) kl.push('hd ' + DATA.HD[i]);
      if (jm) kl.push(normal(jm));
      if (en) kl.push(normal(en));
      if (b) {
        const [zn, so] = b.split(' ');
        kl.push(normal(b));
        if (/[⁰-⁹¹²³]/.test(zn)) kl.push(normal(zn.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '') + ' ' + so));
        const s = SOUH[so];
        if (s) { const z0 = zn.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ''); kl.push(normal(z0 + ' ' + s.gen)); kl.push(normal(z0 + ' ' + s.cz)); }
      }
      if (pr) kl.push(normal(pr));
      const nazev = jm || en || b || ('HR ' + DATA.HR[i]);
      ix.push({ id: 'h:' + i, nazev, popis: `hvězda ${fmtMag(H[i * 4 + 2])} mag${b && nazev !== b ? ' · ' + b : ''}${pr ? ' · proměnná ' + pr : ''} · HR ${DATA.HR[i]}`, klice: kl, mag: H[i * 4 + 2] });
    }
    for (const [idx, jm] of DATA.DVOJHVEZDY) {
      const z = ix.find(x => x.id === 'h:' + idx);
      if (z) { z.klice.push(normal(jm)); z.popis = 'dvojhvězda · ' + z.popis; }
    }
    for (const o of DSO) {
      const kl = [normal(o[0])];
      if (o[0].startsWith('M')) kl.push(normal('messier ' + o[0].slice(1)));
      if (o[8]) kl.push(normal(o[8]));
      if (o[10] === 'M' && o[9]) for (const n of String(o[9]).split(/[;,]/)) kl.push(normal(n));
      const ngcCislo = o[0].match(/^NGC (\d+)/); if (ngcCislo) kl.push('n' + ngcCislo[1], 'ngc' + ngcCislo[1]);
      const ic = o[0].match(/^IC (\d+)/); if (ic) kl.push('ic' + ic[1]);
      ix.push({ id: 'd:' + o[0], nazev: o[0] + (o[8] ? ' – ' + o[8] : ''), popis: `${TYPY[o[3]] || o[3]}${o[4] < 90 ? ' · ' + fmtMag(o[4]) + ' mag' : ''} · ${fmtRozmer(o)}`, klice: kl, mag: o[4] < 90 ? o[4] : 20 });
    }
    INDEX = ix;
  }

  // souřadnice: „05h35m17s -05°23′28″“, „5 35 17 -5 23 28“, „83.82 -5.39“ (stupně), „RA 5.588h Dec -5.39“
  function souradnice(q) {
    const t = q.replace(/[,;]/g, ' ').trim();
    let m = t.match(/^(\d{1,2})\s*[h:\s]\s*(\d{1,2})\s*[m:\s]\s*(\d{1,2}(?:\.\d+)?)\s*s?\s+([+\-−]?)\s*(\d{1,2})\s*[°d:\s]\s*(\d{1,2})\s*['′m:\s]?\s*(\d{1,2}(?:\.\d+)?)?\s*["″s]?$/i);
    if (m) {
      const ra = (+m[1] + m[2] / 60 + m[3] / 3600) * 15;
      let dec = +m[5] + m[6] / 60 + (m[7] ? m[7] / 3600 : 0);
      if (m[4] === '-' || m[4] === '−') dec = -dec;
      if (ra < 360 && Math.abs(dec) <= 90) return { ra, dec };
    }
    m = t.match(/^(\d{1,2}(?:\.\d+)?)\s*h\s+([+\-−]?\d{1,2}(?:\.\d+)?)\s*°?$/i);
    if (m) return { ra: +m[1] * 15, dec: +m[2].replace('−', '-') };
    m = t.match(/^(\d{1,3}(?:\.\d+)?)\s*°?\s+([+\-−]?\d{1,2}(?:\.\d+)?)\s*°?$/);
    if (m && +m[1] < 360 && Math.abs(+m[2].replace('−', '-')) <= 90) return { ra: +m[1], dec: +m[2].replace('−', '-') };
    return null;
  }

  function hledej(dotaz, limit = 30) {
    if (!INDEX) postavIndex();
    const q = normal(dotaz);
    const out = [];
    const sour = souradnice(dotaz);
    if (sour) out.push({ id: `x:${sour.ra.toFixed(5)},${sour.dec.toFixed(5)}`, nazev: 'Souřadnice ' + fmtRa(sour.ra) + ' ' + fmtDec(sour.dec), popis: 'J2000', skore: 1000 });
    if (!q) return out;
    const qs = q.replace(/\s/g, '');
    for (const e of INDEX) {
      let best = 0;
      for (const k of e.klice) {
        const ks = k.replace(/\s/g, '');
        let s = 0;
        if (k === q || ks === qs) s = 100;
        else if (k.startsWith(q) || ks.startsWith(qs)) s = 70 - Math.min(20, k.length - q.length);
        else if (q.length >= 3 && (' ' + k).includes(' ' + q)) s = 45;
        else if (q.length >= 4 && k.includes(q)) s = 25;
        if (s > best) best = s;
      }
      if (best > 0) out.push({ ...e, skore: best - Math.max(0, e.mag) * 0.6 + (e.id.startsWith('p:') ? 15 : 0) });
    }
    out.sort((a, b) => b.skore - a.skore);
    return out.slice(0, limit);
  }

  /* ---------- objekt podle id ---------- */
  function objekt(id) {
    if (!id) return null;
    const [druh, ...zb] = id.split(':'); const k = zb.join(':');
    if (druh === 'p') return { id, druh, klic: k, nazev: D.TELESA[k] ? D.TELESA[k].jmeno : k };
    if (druh === 'h') {
      const i = +k;
      return { id, druh, i, nazev: DATA.JMENA[i] || DATA.JMENA_EN[i] || DATA.BAYER[i] || 'HR ' + DATA.HR[i], mag: DATA.H[i * 4 + 2], v: D.v3(DATA.H[i * 4], DATA.H[i * 4 + 1]) };
    }
    if (druh === 'd') {
      const o = DSO_ID.get(k); if (!o) return null;
      return { id, druh, o, nazev: o[0] + (o[8] ? ' – ' + o[8] : ''), mag: o[4], v: D.v3(o[1], o[2]) };
    }
    if (druh === 'x') { const [ra, dec] = k.split(',').map(Number); return { id, druh, nazev: 'Souřadnice ' + fmtRa(ra) + ' ' + fmtDec(dec), v: D.v3(ra, dec) }; }
    return null;
  }
  // směr objektu v čase (J2000 jednotkový vektor)
  function smer(id, jd, misto) {
    const o = objekt(id); if (!o) return null;
    if (o.druh === 'p') return D.teleso(o.klic, jd, misto).v;
    return o.v;
  }

  /* ---------- formáty ---------- */
  function fmtMag(m) { return m === undefined || m >= 90 ? '–' : (m < 0 ? '−' : '') + Math.abs(m).toFixed(1).replace('.', ','); }
  function fmtRozmer(o) { return o[5] === o[6] ? `${fmtCislo(o[5])}′` : `${fmtCislo(o[5])}′ × ${fmtCislo(o[6])}′`; }
  function fmtCislo(x, d = 1) { return (+x).toFixed(x < 10 && d ? d : 0).replace('.', ','); }
  function fmtRa(ra) {
    const h = ((ra / 15) % 24 + 24) % 24; let hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = Math.round(((h - hh) * 60 - mm) * 60 * 10) / 10;
    if (ss >= 60) { ss = 0; mm++; } if (mm >= 60) { mm = 0; hh = (hh + 1) % 24; }
    return `${hh}h ${String(mm).padStart(2, '0')}m ${ss.toFixed(1).padStart(4, '0').replace('.', ',')}s`;
  }
  function fmtDec(d) {
    const s = d < 0 ? '−' : '+', a = Math.abs(d); let dd = Math.floor(a), mm = Math.floor((a - dd) * 60), ss = Math.round(((a - dd) * 60 - mm) * 60);
    if (ss >= 60) { ss = 0; mm++; } if (mm >= 60) { mm = 0; dd++; }
    return `${s}${dd}° ${String(mm).padStart(2, '0')}′ ${String(ss).padStart(2, '0')}″`;
  }
  function fmtUhel(s) {
    const a = Math.abs(s);
    return a >= 3600 ? (s / 3600).toFixed(2).replace('.', ',') + '°' : a >= 60 ? (s / 60).toFixed(1).replace('.', ',') + '′' : s.toFixed(a < 10 ? 2 : 1).replace('.', ',') + '″';
  }
  const souhvezdiJmeno = zk => SOUH[zk] ? SOUH[zk].cz : zk;

  koren.DALEK_KAT = { DSO, DSO_ID, TYPY, hledej, objekt, smer, souradnice, normal, fmtMag, fmtRozmer, fmtRa, fmtDec, fmtUhel, fmtCislo, souhvezdiJmeno, SOUH, postavIndex };
})(typeof window !== 'undefined' ? window : globalThis);
