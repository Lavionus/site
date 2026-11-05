/* Volná místa – jádro bez DOM: příprava řádků z obsah/prace/data, filtry, řazení, stav ⇄ URL.
   V prohlížeči window.PRACE_JADRO, v node module.exports (test _test/prace_test.js). */
(function (koren) {
  'use strict';

  const TYDNU_V_MESICI = 52 / 12;
  const DEN_MS = 86400000;

  function bezDiakritiky(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function dnesDny(datum) {
    return Math.floor((datum ? new Date(datum) : new Date()).getTime() / DEN_MS);
  }

  function datumZDnu(d) {
    return d ? new Date(d * DEN_MS) : null;
  }

  /* Hodinová mzda → měsíční. Hodinová nad 1000 Kč je v datech chybně zadaná měsíční. */
  function mesicni(castka, hodinova, hodinTydne) {
    if (!castka) return 0;
    if (!hodinova || castka >= 1000) return castka;
    return Math.round(castka * (hodinTydne || 40) * TYDNU_V_MESICI);
  }

  function vzdalenostKm(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  }

  /* meta.json + mista.json → pole objektů s odvozenými poli (mzdaMes, horni, kraje, hledej). */
  function priprav(meta, radky) {
    const pole = meta.pole;
    const okresKraj = {};
    for (const k in meta.okresy) okresKraj[k] = meta.okresy[k][1];
    return radky.map(r => {
      const m = {};
      pole.forEach((p, i) => { m[p] = r[i]; });
      m.mzdaMes = mesicni(m.mzdaOd, m.hodinova, m.hodin);
      m.mzdaMesDo = mesicni(m.mzdaDo, m.hodinova, m.hodin);
      m.horni = Math.max(m.mzdaMes, m.mzdaMesDo);
      m.kraje = [...new Set(m.okresy.map(o => okresKraj[o]).filter(Boolean))];
      if (m.vzdelani === meta.vzdelani.length - 1) m.vzdelani = 0;   // „Nezadáno“ = bez požadavku
      m.hledej = bezDiakritiky([m.nazev, m.firma, meta.isco[m.isco] || '',
        ...m.dovednosti.map(d => meta.dovednosti[d])].join(' '));
      return m;
    });
  }

  /* Vzdálenost inzerátu od bodu: přesná poloha / střed obce, u „jen okres“ nejbližší střed okresu. */
  function vzdalenost(m, bod, meta) {
    if (!bod) return null;
    if (m.lat != null) return vzdalenostKm(bod.lat, bod.lon, m.lat, m.lon);
    let min = null;
    for (const o of m.okresy) {
      const ok = meta.okresy[o];
      if (ok && ok[2] != null) {
        const d = vzdalenostKm(bod.lat, bod.lon, ok[2], ok[3]);
        if (min == null || d < min) min = d;
      }
    }
    return min;
  }

  const PRAZDNY = {
    q: '', kraj: '', okres: '', domov: null, okruh: 0, celaCR: true,
    isco: '', obor: 0, mzda: 0, nadMinimum: false, vzdelani: -1, smennost: [], vztahy: 0,
    vhodnost: 0, vyhody: 0, priznaky: 0, bezAgentur: false, bezAnonymnich: false,
    nove: 0, jazyky: null, razeni: 'nove',
  };

  function novyFiltr(f) {
    return Object.assign({}, PRAZDNY, f || {});
  }

  function bit(meta, jmeno) {
    return 1 << meta.priznaky.indexOf(jmeno);
  }

  /* Hledaný výraz: slova musí být všechna, „-slovo“ nesmí být. */
  function rozlozDotaz(q) {
    const slova = bezDiakritiky(q).split(/\s+/).filter(Boolean);
    return {
      ano: slova.filter(s => s[0] !== '-'),
      ne: slova.filter(s => s[0] === '-' && s.length > 1).map(s => s.slice(1)),
    };
  }

  function filtruj(mista, f, meta, dnes) {
    f = novyFiltr(f);
    const dotaz = rozlozDotaz(f.q);
    const kraj = f.kraj ? +f.kraj : 0;
    const okres = f.okres ? +f.okres : 0;
    const agentura = bit(meta, 'agentura');
    const anonymni = bit(meta, 'anonymni');
    const smennost = new Set(f.smennost);
    const umim = f.jazyky ? new Set(f.jazyky) : null;
    const odDne = f.nove ? (dnes != null ? dnes : dnesDny()) - f.nove : 0;
    const ven = [];
    for (const m of mista) {
      const celaCR = m.presnost === 'c';
      if (celaCR && !f.celaCR) continue;
      if (kraj && !celaCR && !m.kraje.includes(kraj)) continue;
      if (okres && !celaCR && !m.okresy.includes(okres)) continue;
      let km = null;
      if (f.domov) {
        km = vzdalenost(m, f.domov, meta);
        if (f.okruh && !celaCR && (km == null || km > f.okruh)) continue;
      }
      if (f.isco && !m.isco.startsWith(f.isco)) continue;
      if (f.obor && !(m.obory & (1 << f.obor))) continue;
      if (f.mzda && m.horni < f.mzda) continue;
      if (f.nadMinimum && m.horni <= meta.minimalni) continue;
      if (f.vzdelani >= 0 && m.vzdelani > f.vzdelani) continue;
      if (smennost.size && !smennost.has(m.smennost)) continue;
      if (f.vztahy && !(m.vztahy & f.vztahy)) continue;
      if ((m.vhodnost & f.vhodnost) !== f.vhodnost) continue;
      if ((m.vyhody & f.vyhody) !== f.vyhody) continue;
      if ((m.priznaky & f.priznaky) !== f.priznaky) continue;
      if (f.bezAgentur && (m.priznaky & agentura)) continue;
      if (f.bezAnonymnich && (m.priznaky & anonymni)) continue;
      if (odDne && m.vlozeno < odDne) continue;
      if (umim && m.jazyky.some(j => !umim.has(j[0]))) continue;
      if (dotaz.ano.length || dotaz.ne.length) {
        if (!dotaz.ano.every(s => m.hledej.includes(s))) continue;
        if (dotaz.ne.some(s => m.hledej.includes(s))) continue;
      }
      ven.push(km == null ? m : Object.assign(Object.create(m), { km }));
    }
    return seradit(ven, f.razeni);
  }

  const RAZENI = {
    nove: (a, b) => b.vlozeno - a.vlozeno || b.id - a.id,
    zmena: (a, b) => b.zmena - a.zmena || b.id - a.id,
    mzda: (a, b) => b.horni - a.horni || b.vlozeno - a.vlozeno,
    blizko: (a, b) => (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km) || b.vlozeno - a.vlozeno,
    mist: (a, b) => b.pocet - a.pocet || b.vlozeno - a.vlozeno,
  };

  function seradit(mista, podle) {
    return mista.sort(RAZENI[podle] || RAZENI.nove);
  }

  /* Filtr ⇄ query string (jen odlišné hodnoty od prázdného filtru; domov jako „lat,lon“). */
  function doUrl(f) {
    const p = new URLSearchParams();
    for (const k in PRAZDNY) {
      const v = f[k];
      if (v == null || JSON.stringify(v) === JSON.stringify(PRAZDNY[k])) continue;
      if (k === 'domov') p.set(k, v.lat.toFixed(4) + ',' + v.lon.toFixed(4) + (v.nazev ? ',' + v.nazev : ''));
      else if (Array.isArray(v)) p.set(k, v.join('.'));
      else if (typeof v === 'boolean') p.set(k, v ? '1' : '0');
      else p.set(k, v);
    }
    return p.toString();
  }

  function zUrl(s) {
    const p = new URLSearchParams(s);
    const f = novyFiltr();
    for (const [k, v] of p) {
      if (!(k in PRAZDNY)) continue;
      const vzor = PRAZDNY[k];
      if (k === 'domov') {
        const [lat, lon, ...nazev] = v.split(',');
        if (isFinite(lat) && isFinite(lon)) f.domov = { lat: +lat, lon: +lon, nazev: nazev.join(',') || '' };
      } else if (k === 'jazyky' || Array.isArray(vzor)) f[k] = v ? v.split('.').map(Number) : [];
      else if (typeof vzor === 'boolean') f[k] = v === '1';
      else if (typeof vzor === 'number') f[k] = +v || 0;
      else f[k] = v;
    }
    return f;
  }

  function davkaDetailu(id, meta) {
    return String(id % meta.davky).padStart(2, '0');
  }

  /* Číslo bez desetin s mezerami po tisících (stejně v node i prohlížeči). */
  function kc(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  }

  function textMzdy(m) {
    if (!m.mzdaOd) return '';
    const jedn = m.hodinova && m.mzdaOd < 1000 ? ' Kč/h' : ' Kč';
    return kc(m.mzdaOd) + (m.mzdaDo && m.mzdaDo !== m.mzdaOd ? '–' + kc(m.mzdaDo) : '') + jedn;
  }

  const api = {
    bezDiakritiky, dnesDny, datumZDnu, mesicni, vzdalenostKm, vzdalenost, priprav,
    novyFiltr, filtruj, seradit, doUrl, zUrl, davkaDetailu, kc, textMzdy, PRAZDNY,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else koren.PRACE_JADRO = api;
})(typeof window !== 'undefined' ? window : this);
