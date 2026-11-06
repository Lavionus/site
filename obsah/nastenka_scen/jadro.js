/* Nástěnka scén – jádro bez DOM: model projektu, přesuny, šablony, čas v příběhu,
   pruhy postav, statistiky, import/export Markdownu a počítání slov rukopisu.
   V prohlížeči window.NastenkaJadro, v node module.exports. */
(function (koren, tovarna) {
  if (typeof module === 'object' && module.exports) module.exports = tovarna();
  else koren.NastenkaJadro = tovarna();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STAVY = { napad: 'nápad', rozepsano: 'rozepsáno', hotovo: 'hotovo' };
  const BARVY = ['', 'cervena', 'oranzova', 'zluta', 'zelena', 'tyrkys', 'modra', 'fialova', 'ruzova', 'seda'];
  const VERZE = 1;

  let citac = 0;
  function noveId(predpona) {
    return (predpona || 'x') + Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ---------- model ----------
  function novyProjekt(nazev) {
    const ted = new Date().toISOString();
    return { id: noveId('p'), verze: VERZE, nazev: nazev || 'Nový román', sloupce: [], sceny: [], vytvoreno: ted, upraveno: ted };
  }

  function novaScena(data) {
    const s = Object.assign({
      id: noveId('s'), sloupec: '', nazev: 'Nová scéna', shrnuti: '', pov: '', postavy: [], misto: '', cas: '',
      barva: '', stitky: [], stav: 'napad', cilSlov: 0, slov: 0, napeti: 5, poznamky: '', beat: ''
    }, data || {});
    return normalizujScenu(s);
  }

  function seznam(x) {
    if (Array.isArray(x)) return x.map(v => String(v).trim()).filter(Boolean);
    return String(x || '').split(/[,;]/).map(v => v.trim()).filter(Boolean);
  }
  function cislo(x, min, max, vychozi) {
    const n = Math.round(Number(x));
    if (!isFinite(n)) return vychozi;
    return Math.max(min, Math.min(max, n));
  }

  function normalizujScenu(s) {
    s.nazev = String(s.nazev == null ? '' : s.nazev);
    for (const k of ['shrnuti', 'pov', 'misto', 'cas', 'poznamky', 'beat', 'barva']) s[k] = String(s[k] == null ? '' : s[k]);
    s.postavy = Array.from(new Set(seznam(s.postavy)));
    s.stitky = Array.from(new Set(seznam(s.stitky)));
    if (!STAVY[s.stav]) s.stav = 'napad';
    if (BARVY.indexOf(s.barva) < 0) s.barva = '';
    s.cilSlov = cislo(s.cilSlov, 0, 1e7, 0);
    s.slov = cislo(s.slov, 0, 1e7, 0);
    s.napeti = cislo(s.napeti, 0, 10, 5);
    return s;
  }

  /** Ověří a doplní projekt načtený ze zálohy; vyhodí chybu, když to projekt není. */
  function normalizujProjekt(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.sloupce) || !Array.isArray(p.sceny)) throw new Error('Soubor neobsahuje projekt nástěnky scén.');
    p.id = p.id || noveId('p');
    p.nazev = String(p.nazev || 'Bez názvu');
    p.verze = VERZE;
    p.sloupce = p.sloupce.filter(c => c && c.id).map(c => ({ id: String(c.id), nazev: String(c.nazev || '') }));
    if (!p.sloupce.length && p.sceny.length) p.sloupce.push({ id: noveId('c'), nazev: 'Scény' });
    const ids = new Set(p.sloupce.map(c => c.id));
    p.sceny = p.sceny.filter(s => s && typeof s === 'object').map(s => {
      s = novaScena(s);
      if (!ids.has(s.sloupec)) s.sloupec = p.sloupce[0].id;
      return s;
    });
    p.vytvoreno = p.vytvoreno || new Date().toISOString();
    p.upraveno = p.upraveno || p.vytvoreno;
    return p;
  }

  function najdi(p, id) { return p.sceny.find(s => s.id === id) || null; }
  function scenySloupce(p, idSloupce) { return p.sceny.filter(s => s.sloupec === idSloupce); }

  /** Scény v pořadí čtení: po sloupcích zleva doprava, ve sloupci shora dolů. */
  function poradi(p) {
    const out = [];
    for (const c of p.sloupce) for (const s of p.sceny) if (s.sloupec === c.id) out.push(s);
    return out;
  }

  function pridejSloupec(p, nazev, index) {
    const c = { id: noveId('c'), nazev: nazev || 'Kapitola ' + (p.sloupce.length + 1) };
    if (index == null || index > p.sloupce.length) p.sloupce.push(c); else p.sloupce.splice(Math.max(0, index), 0, c);
    return c;
  }

  function prejmenujSloupec(p, id, nazev) {
    const c = p.sloupce.find(x => x.id === id);
    if (c) c.nazev = String(nazev);
    return c;
  }

  /** Smaže sloupec; jeho scény přesune do sousedního (nebo smaže, když je `smazatSceny`). */
  function smazSloupec(p, id, smazatSceny) {
    const i = p.sloupce.findIndex(c => c.id === id);
    if (i < 0) return false;
    p.sloupce.splice(i, 1);
    if (smazatSceny || !p.sloupce.length) p.sceny = p.sceny.filter(s => s.sloupec !== id);
    else {
      const cil = p.sloupce[Math.max(0, i - 1)].id;
      const presun = p.sceny.filter(s => s.sloupec === id);
      p.sceny = p.sceny.filter(s => s.sloupec !== id);
      presun.forEach(s => { s.sloupec = cil; p.sceny.push(s); });
    }
    return true;
  }

  function presunSloupec(p, id, novyIndex) {
    const i = p.sloupce.findIndex(c => c.id === id);
    if (i < 0) return false;
    const [c] = p.sloupce.splice(i, 1);
    p.sloupce.splice(Math.max(0, Math.min(p.sloupce.length, novyIndex)), 0, c);
    return i !== novyIndex;
  }

  /** Vloží scénu do sloupce na pozici `index` (mezi scénami toho sloupce; null = na konec). */
  function vlozScenu(p, scena, idSloupce, index) {
    scena.sloupec = idSloupce;
    const ve = scenySloupce(p, idSloupce);
    if (index == null || index >= ve.length) {
      // za poslední scénu sloupce, aby pole zůstalo seskupené
      const posl = ve[ve.length - 1];
      const kam = posl ? p.sceny.indexOf(posl) + 1 : p.sceny.length;
      p.sceny.splice(kam, 0, scena);
    } else {
      p.sceny.splice(p.sceny.indexOf(ve[Math.max(0, index)]), 0, scena);
    }
    return scena;
  }

  function pridejScenu(p, idSloupce, data, index) {
    if (!p.sloupce.length) pridejSloupec(p, 'Kapitola 1');
    const sl = idSloupce && p.sloupce.some(c => c.id === idSloupce) ? idSloupce : p.sloupce[0].id;
    return vlozScenu(p, novaScena(data), sl, index);
  }

  function smazScenu(p, id) {
    const i = p.sceny.findIndex(s => s.id === id);
    if (i < 0) return null;
    return p.sceny.splice(i, 1)[0];
  }

  function duplikujScenu(p, id) {
    const s = najdi(p, id);
    if (!s) return null;
    const kopie = novaScena(JSON.parse(JSON.stringify(Object.assign({}, s, { id: undefined }))));
    kopie.id = noveId('s');
    kopie.nazev = s.nazev + ' (kopie)';
    const ve = scenySloupce(p, s.sloupec);
    return vlozScenu(p, kopie, s.sloupec, ve.indexOf(s) + 1);
  }

  /** Přesune scénu do sloupce na index (index se počítá v cílovém sloupci bez přesouvané scény). */
  function presunScenu(p, id, idSloupce, index) {
    const s = najdi(p, id);
    if (!s || !p.sloupce.some(c => c.id === idSloupce)) return false;
    smazScenu(p, id);
    vlozScenu(p, s, idSloupce, index);
    return true;
  }

  /** Posun o krok: smer 'nahoru'|'dolu'|'vlevo'|'vpravo' (klávesnicová alternativa tažení). */
  function posunScenu(p, id, smer) {
    const s = najdi(p, id);
    if (!s) return false;
    const ve = scenySloupce(p, s.sloupec), i = ve.indexOf(s);
    const ci = p.sloupce.findIndex(c => c.id === s.sloupec);
    if (smer === 'nahoru') {
      if (i > 0) return presunScenu(p, id, s.sloupec, i - 1);
      if (ci > 0) return presunScenu(p, id, p.sloupce[ci - 1].id, null);
      return false;
    }
    if (smer === 'dolu') {
      if (i < ve.length - 1) return presunScenu(p, id, s.sloupec, i + 1);
      if (ci < p.sloupce.length - 1) return presunScenu(p, id, p.sloupce[ci + 1].id, 0);
      return false;
    }
    const cj = smer === 'vlevo' ? ci - 1 : ci + 1;
    if (cj < 0 || cj >= p.sloupce.length) return false;
    const cil = p.sloupce[cj].id;
    return presunScenu(p, id, cil, Math.min(i, scenySloupce(p, cil).length));
  }

  // ---------- šablony struktury ----------
  // beat: [název, popis, napětí, poloha v příběhu v %]
  const SABLONY = {
    tri: {
      nazev: 'Tři dějství',
      sloupce: [
        ['1. dějství – Expozice', [
          ['Úvod', 'Hrdina v běžném světě, jeho touha a slabina.', 3, 0],
          ['Rozněcující událost', 'Něco naruší rovnováhu a otevře hlavní otázku příběhu.', 5, 12],
          ['První zlom', 'Hrdina se rozhodne a vstoupí do konfliktu; cesty zpět není.', 6, 25]]],
        ['2. dějství – Konfrontace', [
          ['Stoupající komplikace', 'Pokusy a nezdary, sázky rostou.', 6, 37],
          ['Střed', 'Zvrat uprostřed: hrdina pochopí, oč doopravdy jde, z oběti se stává aktér.', 7, 50],
          ['Druhý zlom', 'Nejhlubší bod: vše se zdá ztracené, nová informace dává poslední šanci.', 8, 75]]],
        ['3. dějství – Rozuzlení', [
          ['Vyvrcholení', 'Rozhodující střet, hrdina uplatní, co se naučil.', 10, 88],
          ['Rozuzlení', 'Nová rovnováha, odpověď na hlavní otázku.', 3, 98]]]
      ]
    },
    cesta: {
      nazev: 'Hrdinova cesta',
      sloupce: [
        ['Odloučení', [
          ['Běžný svět', 'Hrdina doma, před změnou.', 2, 0],
          ['Volání k dobrodružství', 'Výzva nebo problém.', 4, 8],
          ['Odmítnutí volání', 'Strach a váhání.', 4, 12],
          ['Setkání s mentorem', 'Rada, dar, odvaha.', 4, 17],
          ['Překročení prvního prahu', 'Hrdina vstupuje do neznámého světa.', 6, 25]]],
        ['Zasvěcení', [
          ['Zkoušky, spojenci a nepřátelé', 'Učí se pravidla nového světa.', 5, 33],
          ['Přiblížení k nejhlubší jeskyni', 'Příprava na hlavní zkoušku.', 6, 45],
          ['Zkouška ohněm', 'Střet se smrtí nebo největším strachem.', 9, 55],
          ['Odměna', 'Hrdina získá, pro co šel.', 6, 65]]],
        ['Návrat', [
          ['Cesta zpět', 'Následky, pronásledování, nové rozhodnutí.', 7, 75],
          ['Vzkříšení', 'Poslední, nejtěžší zkouška a proměna.', 10, 88],
          ['Návrat s elixírem', 'Hrdina přináší domů změnu.', 3, 97]]]
      ]
    },
    kocka: {
      nazev: 'Save the Cat (15 beatů)',
      sloupce: [
        ['1. dějství', [
          ['Úvodní obraz', 'Snímek světa a hrdiny na začátku.', 2, 0],
          ['Vyslovené téma', 'Někdo nahlas řekne, o čem příběh je.', 2, 5],
          ['Expozice', 'Hrdina, jeho svět a co mu chybí.', 3, 5],
          ['Katalyzátor', 'Událost, která všechno změní.', 5, 10],
          ['Debata', 'Hrdina váhá: mám jít?', 4, 15]]],
        ['2. dějství A', [
          ['Přechod do 2. dějství', 'Hrdina se rozhodne a vstoupí do nového světa.', 6, 20],
          ['Vedlejší zápletka', 'Nová postava nebo vztah nese téma.', 4, 22],
          ['Zábava a hry', 'Slib premisy, hrdina v novém světě.', 5, 30],
          ['Střed', 'Falešné vítězství nebo falešná porážka, sázky rostou.', 7, 50]]],
        ['2. dějství B', [
          ['Padouši se blíží', 'Vnější tlak a vnitřní pochyby sílí.', 7, 55],
          ['Vše je ztraceno', 'Nejhorší okamžik, „pach smrti“.', 8, 75],
          ['Temná noc duše', 'Hrdina na dně, hledá odpověď.', 4, 77]]],
        ['3. dějství', [
          ['Přechod do 3. dějství', 'Řešení: spojení zápletky A a B.', 6, 80],
          ['Finále', 'Hrdina provede plán a promění se.', 10, 90],
          ['Závěrečný obraz', 'Zrcadlo úvodního obrazu: co se změnilo.', 2, 99]]]
      ]
    },
    sedm: {
      nazev: 'Sedm bodů',
      sloupce: [
        ['Začátek', [
          ['Výchozí stav', 'Opak konce: hrdina před proměnou.', 3, 0],
          ['Zlom 1', 'Událost, která rozběhne příběh.', 6, 25],
          ['Sevření 1', 'Tlak protivníka, hrdina musí jednat.', 6, 37]]],
        ['Střed', [
          ['Střed', 'Hrdina přestane reagovat a začne jednat.', 7, 50]]],
        ['Konec', [
          ['Sevření 2', 'Nejtěžší tlak, ztráta pomocníka či plánu.', 8, 62],
          ['Zlom 2', 'Poslední díl skládačky: hrdina má, co potřebuje.', 8, 75],
          ['Rozuzlení', 'Vyvrcholení a nový stav.', 10, 95]]]
      ]
    }
  };

  /** Doplní do projektu sloupce a kartičky beatů šablony (beaty mají štítek „beat“ a stav nápad). */
  function pouzijSablonu(p, klic) {
    const sab = SABLONY[klic];
    if (!sab) throw new Error('Neznámá šablona: ' + klic);
    for (const [nazevSl, beaty] of sab.sloupce) {
      const c = pridejSloupec(p, nazevSl);
      for (const [nazev, popis, napeti, proc] of beaty) {
        pridejScenu(p, c.id, { nazev, shrnuti: popis, napeti, beat: nazev + ' (' + proc + ' %)', stitky: ['beat'] });
      }
    }
    return p;
  }

  // ---------- čas v příběhu ----------
  /** Převede volný zápis času na číslo v minutách pro řazení; null = nerozpoznáno.
     Umí: „2024-05-12 14:30“, „12. 5. 1888 8:00“, „3. den 14:00“, „den 3“, „D3“, „1. 5.“ (bez roku), samotné číslo (= den). */
  function casKlic(text) {
    const t = String(text || '').trim().toLowerCase();
    if (!t) return null;
    let min = 0;
    const hm = t.match(/(\d{1,2})[:.](\d{2})(?!\d|\.\s*\d)/);
    const zbytek = hm ? t.replace(hm[0], ' ') : t;
    if (hm) min = Number(hm[1]) * 60 + Number(hm[2]);
    let m;
    const den = d => Math.floor(d.getTime() / 864e5) * 1440;
    if ((m = zbytek.match(/(-?\d{1,4})-(\d{1,2})-(\d{1,2})/))) {
      const d = new Date(Date.UTC(0, Number(m[2]) - 1, Number(m[3]))); d.setUTCFullYear(Number(m[1]));
      return den(d) + min;
    }
    if ((m = zbytek.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(-?\d{1,4})/))) {
      const d = new Date(Date.UTC(0, Number(m[2]) - 1, Number(m[1]))); d.setUTCFullYear(Number(m[3]));
      return den(d) + min;
    }
    if ((m = zbytek.match(/(\d+)\.\s*den|(?:den|day)\s*(\d+)|\bd\s*(\d+)\b/))) {
      return Number(m[1] || m[2] || m[3]) * 1440 + min;
    }
    if ((m = zbytek.match(/^\s*(\d{1,2})\.\s*(\d{1,2})\.\s*$/))) {   // den a měsíc bez roku
      return ((Number(m[2]) - 1) * 31 + Number(m[1])) * 1440 + min;
    }
    if ((m = zbytek.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*$/))) return Math.round(Number(m[1].replace(',', '.')) * 1440) + min;
    if (hm && !/\d/.test(zbytek)) return min;
    return null;
  }

  /** Scény seřazené podle času v příběhu. retro = scéna se čte později, ale děje dřív než už přečtené (retrospektiva). */
  function casovaOsa(p) {
    const cteni = poradi(p);
    let maxDosud = -Infinity;
    const sCasem = [], bez = [];
    cteni.forEach((s, i) => {
      const k = casKlic(s.cas);
      if (k == null) { bez.push({ scena: s, poradi: i + 1, klic: null, retro: false }); return; }
      sCasem.push({ scena: s, poradi: i + 1, klic: k, retro: k < maxDosud });
      if (k > maxDosud) maxDosud = k;
    });
    sCasem.sort((a, b) => a.klic - b.klic || a.poradi - b.poradi);
    return { polozky: sCasem, bezCasu: bez };
  }

  // ---------- postavy, štítky, filtr ----------
  function postavySceny(s) {
    const v = s.pov ? [s.pov] : [];
    for (const x of s.postavy) if (v.indexOf(x) < 0) v.push(x);
    return v;
  }

  function vsechnyPostavy(p) {
    const pocty = new Map();
    for (const s of p.sceny) for (const x of postavySceny(s)) pocty.set(x, (pocty.get(x) || 0) + 1);
    return [...pocty.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'cs')).map(e => e[0]);
  }

  function vsechnyStitky(p) {
    const m = new Map();
    for (const s of p.sceny) for (const t of s.stitky) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'cs')).map(([nazev, pocet]) => ({ nazev, pocet }));
  }

  /** Pruhy postav: pro každou postavu výskyty v pořadí čtení (index scény, pov ano/ne) a nejdelší mezera. */
  function pruhyPostav(p) {
    const sceny = poradi(p);
    const postavy = vsechnyPostavy(p).map(jmeno => {
      const vyskyty = [];
      sceny.forEach((s, i) => {
        if (s.pov === jmeno) vyskyty.push({ i, pov: true });
        else if (s.postavy.indexOf(jmeno) >= 0) vyskyty.push({ i, pov: false });
      });
      let mezera = 0;
      for (let k = 1; k < vyskyty.length; k++) mezera = Math.max(mezera, vyskyty[k].i - vyskyty[k - 1].i - 1);
      return {
        jmeno, vyskyty, celkem: vyskyty.length, pov: vyskyty.filter(v => v.pov).length,
        prvni: vyskyty.length ? vyskyty[0].i : -1, posledni: vyskyty.length ? vyskyty[vyskyty.length - 1].i : -1, mezera,
        slovPov: sceny.filter(s => s.pov === jmeno).reduce((a, s) => a + s.slov, 0)
      };
    });
    return { sceny, postavy };
  }

  function bezDiakritiky(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  /** Filtr: {text, postava, stitek, stav, barva}. Vrátí Set id vyhovujících scén. */
  function filtruj(p, f) {
    f = f || {};
    const slova = bezDiakritiky(f.text || '').split(/\s+/).filter(Boolean);
    const out = new Set();
    for (const s of p.sceny) {
      if (f.postava && postavySceny(s).indexOf(f.postava) < 0) continue;
      if (f.stitek && s.stitky.indexOf(f.stitek) < 0) continue;
      if (f.stav && s.stav !== f.stav) continue;
      if (f.barva && s.barva !== f.barva) continue;
      if (slova.length) {
        const kde = bezDiakritiky([s.nazev, s.shrnuti, s.pov, s.postavy.join(' '), s.misto, s.cas, s.stitky.join(' '), s.poznamky, s.beat].join(' '));
        if (!slova.every(w => kde.indexOf(w) >= 0)) continue;
      }
      out.add(s.id);
    }
    return out;
  }

  // ---------- statistiky ----------
  function statistiky(p) {
    const sceny = poradi(p);
    const st = {
      scen: sceny.length, sloupcu: p.sloupce.length,
      stavy: { napad: 0, rozepsano: 0, hotovo: 0 },
      cil: 0, slov: 0, scenSCilem: 0, slovSCilem: 0, cilSeSlovy: 0,
      bezPov: 0, bezCasu: 0, prumerNapeti: 0,
      sloupce: p.sloupce.map(c => ({ id: c.id, nazev: c.nazev, scen: 0, cil: 0, slov: 0, hotovo: 0 })),
      pov: {}
    };
    const podle = new Map(st.sloupce.map(c => [c.id, c]));
    for (const s of sceny) {
      st.stavy[s.stav]++;
      st.cil += s.cilSlov; st.slov += s.slov;
      if (s.cilSlov) { st.scenSCilem++; st.slovSCilem += Math.min(s.slov, s.cilSlov); st.cilSeSlovy += s.cilSlov; }
      if (!s.pov) st.bezPov++; else st.pov[s.pov] = (st.pov[s.pov] || 0) + 1;
      if (casKlic(s.cas) == null) st.bezCasu++;
      st.prumerNapeti += s.napeti;
      const c = podle.get(s.sloupec);
      if (c) { c.scen++; c.cil += s.cilSlov; c.slov += s.slov; if (s.stav === 'hotovo') c.hotovo++; }
    }
    st.prumerNapeti = sceny.length ? Math.round(st.prumerNapeti / sceny.length * 10) / 10 : 0;
    // plnění cíle: u scén s cílem se započítá nejvýš cíl (přepsaná scéna nevyváží nenapsanou)
    st.plneni = st.cilSeSlovy ? Math.round(st.slovSCilem / st.cilSeSlovy * 1000) / 10 : 0;
    st.hotovoProc = sceny.length ? Math.round(st.stavy.hotovo / sceny.length * 1000) / 10 : 0;
    return st;
  }

  /** Body grafu napětí v pořadí čtení; x je index scény, nebo kumulovaná slova (podleSlov). */
  function krivkaNapeti(p, podleSlov) {
    const sceny = poradi(p);
    let x = 0;
    return sceny.map((s, i) => {
      const bod = { i, x: podleSlov ? x : i, y: s.napeti, scena: s };
      x += Math.max(s.slov || s.cilSlov, 1);
      return bod;
    });
  }

  // ---------- slova a Markdown ----------
  function textBezZnacek(md) {
    return String(md || '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/^\s{0,3}#{1,6}\s.*$/gm, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`>#~|]/g, ' ');
  }
  function pocetSlov(md) {
    const m = textBezZnacek(md).match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
    return m ? m.length : 0;
  }

  const PREDEL = /^\s*(?:\*\s*){1,3}$|^\s*(?:-\s*){3,}$|^\s*#\s*$/;
  const KLICE = { 'shrnutí': 'shrnuti', 'shrnuti': 'shrnuti', 'pov': 'pov', 'postavy': 'postavy', 'místo': 'misto', 'misto': 'misto',
    'čas': 'cas', 'cas': 'cas', 'stav': 'stav', 'cíl slov': 'cilSlov', 'cil slov': 'cilSlov', 'slov': 'slov', 'štítky': 'stitky', 'stitky': 'stitky',
    'barva': 'barva', 'napětí': 'napeti', 'napeti': 'napeti', 'poznámky': 'poznamky', 'poznamky': 'poznamky', 'beat': 'beat' };
  const STAV_Z_TEXTU = { 'nápad': 'napad', 'napad': 'napad', 'rozepsáno': 'rozepsano', 'rozepsano': 'rozepsano', 'hotovo': 'hotovo' };

  /** Rozebere komentář <!-- klíč: hodnota … --> exportovaný nástěnkou. Řádek bez klíče pokračuje předchozí hodnotou. */
  function rozeberKomentar(obsah) {
    const out = {};
    let posl = null;
    for (const r of obsah.split('\n')) {
      const m = r.match(/^\s*([^:]{2,12}):\s?(.*)$/);
      const k = m && KLICE[m[1].trim().toLowerCase()];
      if (k) { out[k] = m[2].trim(); posl = k; }
      else if (posl && r.trim()) out[posl] += '\n' + r.trim();
    }
    if (out.stav) out.stav = STAV_Z_TEXTU[out.stav.toLowerCase()] || 'napad';
    if (out.cilSlov) out.cilSlov = parseInt(out.cilSlov, 10) || 0;
    if (out.slov) out.slov = parseInt(out.slov, 10) || 0;
    if (out.napeti) out.napeti = parseInt(out.napeti, 10);
    return out;
  }

  /** Rozdělí Markdown na kapitoly (#) a scény (##, předěl *). Vrací [{nazev, sceny:[{nazev, text, meta, nadpis}]}].
     nadpis = scéna začíná vlastním nadpisem ##; jinak jde o úvod kapitoly nebo úsek za předělem. */
  function rozdelMarkdown(md) {
    const radky = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const kapitoly = [];
    let kap = null, sc = null, vKomentari = false;
    const novaKap = nazev => { kap = { nazev, sceny: [] }; kapitoly.push(kap); sc = { nazev: '', text: [], nadpis: false, uvod: true }; kap.sceny.push(sc); };
    const novaSc = (nazev, nadpis) => { if (!kap) novaKap(''); sc = { nazev, text: [], nadpis, uvod: false }; kap.sceny.push(sc); };
    for (const r of radky) {
      if (vKomentari) { sc.text.push(r); if (r.indexOf('-->') >= 0) vKomentari = false; continue; }
      if (r.indexOf('<!--') >= 0 && r.indexOf('-->') < 0) { if (!kap) novaKap(''); vKomentari = true; sc.text.push(r); continue; }
      let m;
      if ((m = r.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/))) { novaKap(m[1]); continue; }
      if ((m = r.match(/^\s{0,3}##\s+(.+?)\s*#*\s*$/))) { novaSc(m[1], true); continue; }
      if (PREDEL.test(r)) { novaSc('', false); continue; }
      if (!kap) novaKap('');
      sc.text.push(r);
    }
    for (const k of kapitoly) {
      k.sceny = k.sceny.map(s => {
        const text = s.text.join('\n');
        const meta = {};
        let komentar = false;
        text.replace(/<!--([\s\S]*?)-->/g, (_, obsah) => { const o = rozeberKomentar(obsah); if (Object.keys(o).length) komentar = true; Object.assign(meta, o); return ''; });
        return { nazev: s.nazev, nadpis: s.nadpis, uvod: s.uvod, text: text.trim(), meta, komentar, slov: pocetSlov(text) };
      }).filter(s => s.nadpis || s.slov > 0 || s.komentar);
    }
    return kapitoly.filter(k => k.nazev || k.sceny.length);
  }

  function prvniVety(text, maxSlov) {
    const cisty = textBezZnacek(text).replace(/\s+/g, ' ').trim();
    const vety = cisty.match(/[^.!?…]+[.!?…]+["“”«»]?|\S[^.!?…]*$/g) || [];
    let out = '';
    for (const v of vety) {
      if (out && (out + v).split(' ').length > maxSlov) break;
      out += (out ? ' ' : '') + v.trim();
      if (out.split(' ').length >= maxSlov) break;
    }
    const w = out.split(' ');
    return w.length > maxSlov ? w.slice(0, maxSlov).join(' ') : out;
  }

  const PROZA = 60;   // nad tolik slov se text pod nadpisem bere jako rukopis, ne shrnutí

  /** Import osnovy z Markdownu do nového projektu. # = sloupec, ## a předěl * = scéna.
     Text pod scénou: komentář nástěnky → pole kartičky; krátký text → shrnutí; delší (rukopis) → shrnutí z prvních vět + skutečná slova. */
  function importMarkdown(md, nazevProjektu) {
    const kapitoly = rozdelMarkdown(md);
    const p = novyProjekt(nazevProjektu || 'Importovaná osnova');
    for (const k of kapitoly) {
      const c = pridejSloupec(p, k.nazev || 'Kapitola ' + (p.sloupce.length + 1));
      let n = 0;
      for (const s of k.sceny) {
        n++;
        const data = Object.assign({}, s.meta);
        const prosty = textBezZnacek(s.text.replace(/<!--[\s\S]*?-->/g, '')).replace(/\s+/g, ' ').trim();
        const slovTextu = pocetSlov(s.text);
        if (!data.shrnuti && prosty) data.shrnuti = slovTextu > PROZA ? prvniVety(s.text, 30) + ' …' : prosty;
        if (slovTextu > PROZA) { data.slov = slovTextu; if (!data.stav) data.stav = 'rozepsano'; }
        data.nazev = s.nazev || (s.uvod ? (k.nazev || 'Scéna') + (k.sceny.length > 1 ? ' – 1' : '') : (k.nazev ? k.nazev + ' – ' : 'Scéna ') + n);
        pridejScenu(p, c.id, data);
      }
    }
    if (!p.sloupce.length) pridejSloupec(p, 'Kapitola 1');
    return p;
  }

  function jedenRadek(t) { return String(t || '').replace(/-->/g, '—>'); }

  /** Export kostry rukopisu: # sloupce, ## scény, metadata a shrnutí v komentáři (čtenář je nevidí, import je načte). */
  function exportMarkdown(p, volby) {
    volby = volby || {};
    const r = ['<!-- Nástěnka scén: ' + jedenRadek(p.nazev) + ' – kostra rukopisu. Komentáře se v textu knihy nezobrazí. -->', ''];
    for (const c of p.sloupce) {
      r.push('# ' + (c.nazev || 'Bez názvu'), '');
      for (const s of scenySloupce(p, c.id)) {
        r.push('## ' + (s.nazev || 'Scéna'), '');
        const m = [];
        if (s.shrnuti) m.push('shrnutí: ' + jedenRadek(s.shrnuti).replace(/\n+/g, '\n  '));
        if (s.pov) m.push('POV: ' + jedenRadek(s.pov));
        if (s.postavy.length) m.push('postavy: ' + jedenRadek(s.postavy.join(', ')));
        if (s.misto) m.push('místo: ' + jedenRadek(s.misto));
        if (s.cas) m.push('čas: ' + jedenRadek(s.cas));
        m.push('stav: ' + STAVY[s.stav]);
        if (s.cilSlov) m.push('cíl slov: ' + s.cilSlov);
        if (s.stitky.length) m.push('štítky: ' + jedenRadek(s.stitky.join(', ')));
        if (s.barva) m.push('barva: ' + s.barva);
        m.push('napětí: ' + s.napeti);
        if (s.beat) m.push('beat: ' + jedenRadek(s.beat));
        if (volby.poznamky !== false && s.poznamky) m.push('poznámky: ' + jedenRadek(s.poznamky).replace(/\n+/g, '\n  '));
        r.push('<!--', ...m, '-->', '');
      }
    }
    return r.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function klicNazvu(t) { return bezDiakritiky(t).replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }

  /** Spočítá skutečná slova scén podle rukopisu. Párování: 1) stejný název scény (## nadpis),
     2) kapitola se stejným názvem jako sloupec → scény podle pořadí, 3) stejný počet kapitol a sloupců → podle pořadí,
     4) zbylé scény a úseky textu ve stejném počtu → v pořadí čtení.
     Mění p (slov), vrátí {sparovano, nesparovaneSceny:[nazev], nesparovanyText:[popis], slov}. */
  function spocitejRukopis(p, md, volby) {
    volby = volby || {};
    const kapitoly = rozdelMarkdown(md);
    const useky = [];
    kapitoly.forEach((k, ki) => k.sceny.forEach((s, si) => useky.push({ k, ki, s, si, pouzit: false })));
    const podleNazvu = new Map();
    for (const u of useky) if (u.s.nadpis) {
      const kl = klicNazvu(u.s.nazev);
      if (!podleNazvu.has(kl)) podleNazvu.set(kl, []);
      podleNazvu.get(kl).push(u);
    }
    const prirazeni = new Map();
    // 1) názvy scén
    for (const s of poradi(p)) {
      const kand = (podleNazvu.get(klicNazvu(s.nazev)) || []).find(u => !u.pouzit);
      if (kand) { kand.pouzit = true; prirazeni.set(s.id, kand); }
    }
    // 2) a 3) sloupec ↔ kapitola
    const kapPodleNazvu = new Map();
    kapitoly.forEach((k, i) => { const kl = klicNazvu(k.nazev); if (kl && !kapPodleNazvu.has(kl)) kapPodleNazvu.set(kl, i); });
    p.sloupce.forEach((c, ci) => {
      let ki = kapPodleNazvu.get(klicNazvu(c.nazev));
      if (ki == null && kapitoly.length === p.sloupce.length) ki = ci;
      if (ki == null) return;
      const volne = useky.filter(u => u.ki === ki && !u.pouzit);
      for (const s of scenySloupce(p, c.id)) {
        if (prirazeni.has(s.id)) continue;
        const u = volne.shift();
        if (!u) break;
        u.pouzit = true; prirazeni.set(s.id, u);
      }
    });
    // 4) zbývá-li stejně scén jako úseků textu, spárovat je v pořadí čtení
    const zbyleSceny = poradi(p).filter(s => !prirazeni.has(s.id));
    const zbyleUseky = useky.filter(u => !u.pouzit && u.s.slov > 0);
    if (zbyleSceny.length && zbyleSceny.length === zbyleUseky.length) {
      zbyleSceny.forEach((s, i) => { zbyleUseky[i].pouzit = true; prirazeni.set(s.id, zbyleUseky[i]); });
    }
    let celkem = 0;
    const nesparovaneSceny = [];
    for (const s of p.sceny) {
      const u = prirazeni.get(s.id);
      if (u) {
        s.slov = u.s.slov; celkem += u.s.slov;
        if (volby.stav !== false && s.slov > 0 && s.stav === 'napad') s.stav = 'rozepsano';
      } else nesparovaneSceny.push(s.nazev);
    }
    const nesparovanyText = useky.filter(u => !u.pouzit && u.s.slov > 0)
      .map(u => (u.k.nazev || 'bez kapitoly') + ' › ' + (u.s.nazev || (u.s.uvod ? 'úvod' : 'úsek ' + (u.si + 1))) + ' (' + u.s.slov + ' slov)');
    return { sparovano: prirazeni.size, nesparovaneSceny, nesparovanyText, slov: celkem };
  }

  // ---------- undo/redo ----------
  /** Historie stavů jako JSON snímky. zapis(stav) před změnou, zpet(aktualni) → předchozí, vpred(aktualni) → další. */
  function Historie(limit) {
    this.limit = limit || 100; this.zpetZasobnik = []; this.vpredZasobnik = [];
  }
  Historie.prototype.zapis = function (stav) {
    const j = JSON.stringify(stav);
    if (this.zpetZasobnik[this.zpetZasobnik.length - 1] === j) return;
    this.zpetZasobnik.push(j);
    if (this.zpetZasobnik.length > this.limit) this.zpetZasobnik.shift();
    this.vpredZasobnik = [];
  };
  Historie.prototype.zpet = function (aktualni) {
    if (!this.zpetZasobnik.length) return null;
    this.vpredZasobnik.push(JSON.stringify(aktualni));
    return JSON.parse(this.zpetZasobnik.pop());
  };
  Historie.prototype.vpred = function (aktualni) {
    if (!this.vpredZasobnik.length) return null;
    this.zpetZasobnik.push(JSON.stringify(aktualni));
    return JSON.parse(this.vpredZasobnik.pop());
  };
  Historie.prototype.vymaz = function () { this.zpetZasobnik = []; this.vpredZasobnik = []; };
  Object.defineProperty(Historie.prototype, 'lzeZpet', { get() { return this.zpetZasobnik.length > 0; } });
  Object.defineProperty(Historie.prototype, 'lzeVpred', { get() { return this.vpredZasobnik.length > 0; } });

  // ---------- záloha ----------
  function zaloha(projekty) {
    return { format: 'nastenka_scen', verze: VERZE, ulozeno: new Date().toISOString(), projekty };
  }
  /** Přečte zálohu (celou, jeden projekt nebo pole projektů) → pole normalizovaných projektů. */
  function nactiZalohu(text) {
    let d;
    try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { throw new Error('Soubor není platný JSON.'); }
    const pole = Array.isArray(d) ? d : d && Array.isArray(d.projekty) ? d.projekty : [d];
    return pole.map(normalizujProjekt);
  }

  return {
    STAVY, BARVY, SABLONY, PROZA,
    noveId, novyProjekt, novaScena, normalizujProjekt, normalizujScenu,
    najdi, scenySloupce, poradi,
    pridejSloupec, prejmenujSloupec, smazSloupec, presunSloupec,
    pridejScenu, smazScenu, duplikujScenu, presunScenu, posunScenu,
    pouzijSablonu, casKlic, casovaOsa,
    postavySceny, vsechnyPostavy, vsechnyStitky, pruhyPostav, filtruj,
    statistiky, krivkaNapeti,
    pocetSlov, rozdelMarkdown, importMarkdown, exportMarkdown, spocitejRukopis, klicNazvu,
    Historie, zaloha, nactiZalohu
  };
});
