/* ============================================================
   mapa_souvislosti/jadro.js – datový model a geometrie mapy souvislostí.
   Čistý modul bez DOM (testuje se v node: _test/mapa_souvislosti_test.js).

   Mapa:  { format:'mapa-souvislosti', verze:2, nazev, popis,
            typy:[{id, nazev, ikona, barva, tvar}],
            typyVztahu:[{id, nazev, barva|null, styl, smer}],
            uzly:[{id, nazev, typ, popis, datum, datumDo, tagy[], odkaz, x, y,
                   barva|null, rozbaleny, zamceny, atributy:[[klíč, hodnota]…], obrazek:''|data:image…|https://…}],
            hrany:[{id, od, do, popis, typ:id|null, smer:'->'|'--'|'<->', styl:'plna'|'carkovana'|'teckovana',
                    sila:1..3, barva|null}],
            skupiny:[{id, nazev, barva, uzly:[id…]}]            – rámečky; uzel je nejvýš v jedné skupině
            pribehy:[{id, nazev, kroky:[{id, titulek, poznamka, uzly:[id…]}]}]  – prezentace po krocích }
   Tvary uzlů: 'zaobleny' | 'kapsle' | 'ostry' | 'elipsa'.
   Verze 1 (bez typů vztahů, skupin, atributů, obrázků a příběhů) se načte beze změny významu.

   Geometrie potřebuje měřit text – volající předá funkci mer(text, tucne) → šířka v px:
   tucne = nadpis uzlu (600, 13 px), jinak drobné písmo (400, 11,5 px) popisů a štítků
   (v prohlížeči přes canvas.measureText, v testech odhad podle počtu znaků).
   ============================================================ */
(function () {
  'use strict';

  const FORMAT = 'mapa-souvislosti';
  const VERZE = 2;

  const VYCHOZI_TYPY = [
    { id: 'pojem', nazev: 'Pojem', ikona: '💡', barva: '#3987e5', tvar: 'zaobleny' },
    { id: 'udalost', nazev: 'Událost', ikona: '📅', barva: '#d95926', tvar: 'ostry' },
    { id: 'osoba', nazev: 'Osoba', ikona: '👤', barva: '#199e70', tvar: 'kapsle' },
    { id: 'technologie', nazev: 'Technologie', ikona: '⚙️', barva: '#9085e9', tvar: 'zaobleny' },
    { id: 'misto', nazev: 'Místo', ikona: '📍', barva: '#c98500', tvar: 'elipsa' },
    { id: 'organizace', nazev: 'Organizace', ikona: '🏛️', barva: '#d55181', tvar: 'ostry' },
    { id: 'zdroj', nazev: 'Zdroj', ikona: '📚', barva: '#7b8794', tvar: 'zaobleny' }
  ];
  const VYCHOZI_TYPY_VZTAHU = [
    { id: 'pricina', nazev: 'příčina', barva: '#d95926', styl: 'plna', smer: '->' },
    { id: 'vliv', nazev: 'vliv', barva: '#3987e5', styl: 'carkovana', smer: '->' },
    { id: 'soucast', nazev: 'je součástí', barva: '#199e70', styl: 'plna', smer: '->' },
    { id: 'spoluprace', nazev: 'spolupráce', barva: '#9085e9', styl: 'plna', smer: '--' },
    { id: 'protiklad', nazev: 'protiklad', barva: '#e34948', styl: 'teckovana', smer: '<->' },
    { id: 'priklad', nazev: 'příklad', barva: '#c98500', styl: 'carkovana', smer: '->' }
  ];
  const BARVY_SKUPIN = ['#3987e5', '#199e70', '#d95926', '#9085e9', '#c98500', '#d55181', '#7b8794'];
  const TVARY = ['zaobleny', 'kapsle', 'ostry', 'elipsa'];
  const SMERY = ['->', '--', '<->'];
  const STYLY = ['plna', 'carkovana', 'teckovana'];

  /* ---------- pomocné ---------- */
  const kopie = o => JSON.parse(JSON.stringify(o));
  const txt = (v, max) => (v == null ? '' : String(v)).slice(0, max || 20000);
  const cislo = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const jeBarva = v => typeof v === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v);
  /* obrázek uzlu: vložený data:image (bez SVG – mohl by nést skript) nebo http(s) adresa */
  const jeObrazek = v => typeof v === 'string' && v.length <= 800000 &&
    (/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || /^https?:\/\/[^\s"'<>]+$/i.test(v));

  function noveId(predpona, existujici) {
    let i = existujici.size + 1;
    while (existujici.has(predpona + i)) i++;
    return predpona + i;
  }

  /* deterministický generátor (mulberry32) – rozmístění musí být opakovatelné */
  function nahoda(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- model ---------- */
  function novaMapa(nazev) {
    return { format: FORMAT, verze: VERZE, nazev: nazev || 'Nová mapa', popis: '',
      typy: kopie(VYCHOZI_TYPY), typyVztahu: kopie(VYCHOZI_TYPY_VZTAHU), uzly: [], hrany: [], skupiny: [], pribehy: [] };
  }

  const typVztahu = (mapa, h) => (h && h.typ && mapa.typyVztahu ? mapa.typyVztahu.find(t => t.id === h.typ) || null : null);
  /* text na čáře: vlastní popis, jinak název typu vztahu */
  function stitekHrany(mapa, h) { if (h.popis) return h.popis; const t = typVztahu(mapa, h); return t ? t.nazev : ''; }
  function barvaHrany(mapa, h) { if (h.barva) return h.barva; const t = typVztahu(mapa, h); return t && t.barva ? t.barva : null; }
  const skupinaUzlu = (mapa, id) => (mapa.skupiny || []).find(s => s.uzly.indexOf(id) >= 0) || null;

  function pridejSkupinu(mapa, nazev, uzly) {
    mapa.skupiny = mapa.skupiny || [];
    const ids = new Set(mapa.skupiny.map(s => s.id));
    const sk = { id: noveId('s', ids), nazev: txt(nazev, 120).trim() || 'Skupina', barva: BARVY_SKUPIN[mapa.skupiny.length % BARVY_SKUPIN.length], uzly: [] };
    mapa.skupiny.push(sk);
    for (const id of uzly || []) vlozDoSkupiny(mapa, sk.id, id);
    return sk;
  }
  function vlozDoSkupiny(mapa, skId, uzelId) {
    if (!najdiUzel(mapa, uzelId)) return;
    for (const s of mapa.skupiny) s.uzly = s.uzly.filter(i => i !== uzelId);
    const sk = mapa.skupiny.find(s => s.id === skId);
    if (sk) sk.uzly.push(uzelId);
  }
  function odeberZeSkupin(mapa, ids) {
    const s = new Set(ids);
    for (const sk of mapa.skupiny || []) sk.uzly = sk.uzly.filter(i => !s.has(i));
  }

  function typUzlu(mapa, uzel) {
    return mapa.typy.find(t => t.id === uzel.typ) || mapa.typy[0] || VYCHOZI_TYPY[0];
  }

  function pridejUzel(mapa, data) {
    const ids = new Set(mapa.uzly.map(u => u.id));
    const u = normalizujUzel(Object.assign({}, data), mapa, ids);
    mapa.uzly.push(u);
    return u;
  }

  function pridejHranu(mapa, od, doU, data) {
    if (od === doU) return null;
    if (!najdiUzel(mapa, od) || !najdiUzel(mapa, doU)) return null;
    const ids = new Set(mapa.hrany.map(h => h.id));
    const h = normalizujHranu(Object.assign({}, data, { od, do: doU }), ids, mapa);
    mapa.hrany.push(h);
    return h;
  }

  const najdiUzel = (mapa, id) => mapa.uzly.find(u => u.id === id) || null;
  const najdiHranu = (mapa, id) => mapa.hrany.find(h => h.id === id) || null;

  function odeberUzly(mapa, ids) {
    const s = new Set(ids);
    mapa.uzly = mapa.uzly.filter(u => !s.has(u.id));
    mapa.hrany = mapa.hrany.filter(h => !s.has(h.od) && !s.has(h.do));
    odeberZeSkupin(mapa, ids);
    for (const p of mapa.pribehy || []) for (const k of p.kroky) k.uzly = k.uzly.filter(i => !s.has(i));
  }
  function odeberHrany(mapa, ids) {
    const s = new Set(ids);
    mapa.hrany = mapa.hrany.filter(h => !s.has(h.id));
  }

  /* sloučí uzly do prvního: hrany se přepojí, duplicity a smyčky zmizí, popisy a tagy se spojí */
  function sloucUzly(mapa, ids) {
    if (ids.length < 2) return null;
    const cil = najdiUzel(mapa, ids[0]);
    if (!cil) return null;
    const ostatni = new Set(ids.slice(1));
    for (const u of mapa.uzly) {
      if (!ostatni.has(u.id)) continue;
      if (u.popis && cil.popis.indexOf(u.popis) < 0) cil.popis = cil.popis ? cil.popis + '\n\n' + u.popis : u.popis;
      for (const t of u.tagy) if (cil.tagy.indexOf(t) < 0) cil.tagy.push(t);
      if (!cil.odkaz && u.odkaz) cil.odkaz = u.odkaz;
      if (!cil.datum && u.datum) { cil.datum = u.datum; cil.datumDo = u.datumDo; }
      if (!cil.obrazek && u.obrazek) cil.obrazek = u.obrazek;
      for (const [k, v] of u.atributy || []) if (!(cil.atributy || []).some(a => a[0] === k)) (cil.atributy = cil.atributy || []).push([k, v]);
    }
    for (const sk of mapa.skupiny || []) {
      const mel = sk.uzly.some(i => ostatni.has(i));
      sk.uzly = sk.uzly.filter(i => !ostatni.has(i));
      if (mel && !skupinaUzlu(mapa, cil.id)) sk.uzly.push(cil.id);
    }
    for (const p of mapa.pribehy || []) for (const k of p.kroky) {
      k.uzly = [...new Set(k.uzly.map(i => ostatni.has(i) ? cil.id : i))];
    }
    for (const h of mapa.hrany) {
      if (ostatni.has(h.od)) h.od = cil.id;
      if (ostatni.has(h.do)) h.do = cil.id;
    }
    mapa.uzly = mapa.uzly.filter(u => !ostatni.has(u.id));
    const videne = new Set();
    mapa.hrany = mapa.hrany.filter(h => {
      if (h.od === h.do) return false;
      const k = h.od + '\u0001' + h.do + '\u0001' + h.popis;
      if (videne.has(k)) return false;
      videne.add(k); return true;
    });
    return cil;
  }

  function normalizujUzel(d, mapa, ids) {
    let id = d.id != null && String(d.id) !== '' ? String(d.id).slice(0, 80) : '';
    if (!id || ids.has(id)) id = noveId('u', ids);
    ids.add(id);
    const typ = mapa.typy.some(t => t.id === d.typ) ? d.typ : (mapa.typy[0] ? mapa.typy[0].id : 'pojem');
    let tagy = Array.isArray(d.tagy) ? d.tagy : (typeof d.tagy === 'string' ? d.tagy.split(',') : []);
    tagy = tagy.map(t => txt(t, 60).trim()).filter(Boolean).slice(0, 40);
    return {
      id, nazev: txt(d.nazev, 300).trim() || 'Bez názvu', typ,
      popis: txt(d.popis), datum: txt(d.datum, 40).trim(), datumDo: txt(d.datumDo, 40).trim(),
      tagy, odkaz: txt(d.odkaz, 2000).trim(),
      x: cislo(d.x, NaN), y: cislo(d.y, NaN),
      barva: jeBarva(d.barva) ? d.barva : null,
      rozbaleny: !!d.rozbaleny, zamceny: !!d.zamceny,
      atributy: normalizujAtributy(d.atributy),
      obrazek: jeObrazek(d.obrazek) ? d.obrazek : ''
    };
  }

  /* atributy jako pole dvojic (pořadí se zachová); přijme i objekt {klíč: hodnota} */
  function normalizujAtributy(a) {
    let p = [];
    if (Array.isArray(a)) p = a.filter(x => Array.isArray(x) && x.length >= 1).map(x => [x[0], x[1]]);
    else if (a && typeof a === 'object') p = Object.entries(a);
    const videne = new Set();
    return p.map(([k, v]) => [txt(k, 80).trim(), txt(v == null ? '' : v, 500).trim()])
      .filter(([k]) => k && !videne.has(k) && videne.add(k)).slice(0, 60);
  }

  function normalizujHranu(d, ids, mapa) {
    let id = d.id != null && String(d.id) !== '' ? String(d.id).slice(0, 80) : '';
    if (!id || ids.has(id)) id = noveId('h', ids);
    ids.add(id);
    const typ = d.typ != null && mapa && (mapa.typyVztahu || []).some(t => t.id === String(d.typ)) ? String(d.typ) : null;
    return {
      id, od: String(d.od), do: String(d.do), popis: txt(d.popis, 300).trim(), typ,
      smer: SMERY.indexOf(d.smer) >= 0 ? d.smer : '->',
      styl: STYLY.indexOf(d.styl) >= 0 ? d.styl : 'plna',
      sila: Math.max(1, Math.min(3, Math.round(cislo(d.sila, 1)))),
      barva: jeBarva(d.barva) ? d.barva : null
    };
  }

  /* Přijme vlastní formát i běžné grafové formáty:
       { nodes:[{id,label|name}], edges|links:[{source,target,label}] }   (d3, vis.js, Gephi JSON)
       { elements:{ nodes:[{data:{…}}], edges:[{data:{…}}] } } i elements jako pole (Cytoscape)
     Vrací { mapa, varovani[] }; při nesmyslném vstupu vyhodí chybu. */
  function nactiData(vstup) {
    let d = vstup;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) { throw new Error('Soubor není platný JSON: ' + e.message); }
    }
    if (!d || typeof d !== 'object') throw new Error('Soubor neobsahuje mapu.');
    const varovani = [];
    let uzly, hrany, typy, typyVztahu, nazev = d.nazev || d.name || d.title || 'Importovaná mapa', popis = d.popis || '';
    const vlastni = d.format === FORMAT || Array.isArray(d.uzly);

    if (vlastni) {
      uzly = d.uzly || []; hrany = d.hrany || []; typy = d.typy; typyVztahu = d.typyVztahu;
      if (d.verze > VERZE) varovani.push('Soubor je z novější verze editoru – něco se nemusí načíst.');
    } else {
      let el = d.elements;
      let N = d.nodes, E = d.edges || d.links;
      if (el) {
        if (Array.isArray(el)) {
          N = el.filter(e => e.group === 'nodes' || (e.data && e.data.source == null));
          E = el.filter(e => e.group === 'edges' || (e.data && e.data.source != null));
        } else { N = el.nodes; E = el.edges; }
      }
      if (!Array.isArray(N)) throw new Error('V souboru nejsou uzly (čekám „uzly“, „nodes“ nebo „elements“).');
      const dat = o => (o && o.data) ? Object.assign({}, o.data, o.position || {}) : (o || {});
      uzly = N.map((o, i) => {
        const v = typeof o === 'string' ? { id: o } : dat(o);
        const id = v.id != null ? v.id : (v.key != null ? v.key : 'n' + i);
        return { id, nazev: v.label || v.name || v.title || v.nazev || String(id), typ: v.typ || v.type || v.group,
          popis: v.description || v.popis || v.title_long || '', x: v.x, y: v.y, odkaz: v.url || v.href || '',
          datum: v.date || v.datum || '', tagy: v.tags || v.tagy };
      });
      hrany = (E || []).map(o => {
        const v = dat(o);
        const s = v.source != null && typeof v.source === 'object' ? v.source.id : v.source;
        const t = v.target != null && typeof v.target === 'object' ? v.target.id : v.target;
        return { id: v.id, od: s != null ? s : v.from, do: t != null ? t : v.to, popis: v.label || v.relation || v.type || '',
          smer: v.directed === false || d.directed === false ? '--' : '->' };
      });
    }

    const mapa = novaMapa(txt(nazev, 200));
    mapa.popis = txt(popis, 5000);
    if (Array.isArray(typy) && typy.length) {
      const videne = new Set();
      mapa.typy = typy.filter(t => t && t.id != null && !videne.has(String(t.id)) && videne.add(String(t.id))).map(t => ({
        id: String(t.id).slice(0, 40), nazev: txt(t.nazev || t.id, 60), ikona: txt(t.ikona, 8),
        barva: jeBarva(t.barva) ? t.barva : '#7b8794', tvar: TVARY.indexOf(t.tvar) >= 0 ? t.tvar : 'zaobleny'
      }));
    }
    if (Array.isArray(typyVztahu)) {
      const videne = new Set();
      mapa.typyVztahu = typyVztahu.filter(t => t && t.id != null && !videne.has(String(t.id)) && videne.add(String(t.id))).map(t => ({
        id: String(t.id).slice(0, 40), nazev: txt(t.nazev || t.id, 60),
        barva: jeBarva(t.barva) ? t.barva : null,
        styl: STYLY.indexOf(t.styl) >= 0 ? t.styl : 'plna', smer: SMERY.indexOf(t.smer) >= 0 ? t.smer : '->'
      }));
    }
    /* neznámé typy z cizích formátů doplnit jako nové typy (barvy dokola z výchozí palety) */
    const pal = VYCHOZI_TYPY.map(t => t.barva);
    for (const u of uzly) {
      if (u && u.typ != null && u.typ !== '' && !mapa.typy.some(t => t.id === String(u.typ))) {
        const id = String(u.typ).slice(0, 40);
        mapa.typy.push({ id, nazev: id, ikona: '', barva: pal[mapa.typy.length % pal.length], tvar: 'zaobleny' });
      }
      if (u && u.typ != null) u.typ = String(u.typ);
    }
    const puvodniNaNove = new Map();
    const ids = new Set();
    for (const u of uzly) {
      if (!u || typeof u !== 'object') { varovani.push('Přeskočen neplatný uzel.'); continue; }
      const puv = u.id != null ? String(u.id) : null;
      if (puv != null && puvodniNaNove.has(puv)) varovani.push('Duplicitní id uzlu „' + puv + '“ – přejmenováno.');
      const n = normalizujUzel(u, mapa, ids);
      if (puv != null && !puvodniNaNove.has(puv)) puvodniNaNove.set(puv, n.id);
      mapa.uzly.push(n);
    }
    const hids = new Set();
    let vynechane = 0;
    for (const h of hrany) {
      if (!h || h.od == null || h.do == null) { vynechane++; continue; }
      const od = puvodniNaNove.get(String(h.od)), doU = puvodniNaNove.get(String(h.do));
      if (!od || !doU || od === doU) { vynechane++; continue; }
      mapa.hrany.push(normalizujHranu(Object.assign({}, h, { od, do: doU }), hids, mapa));
    }
    if (vynechane) varovani.push(vynechane + ' vztahů odkazovalo na neexistující uzel nebo samo na sebe – vynecháno.');
    const prevod = list => (Array.isArray(list) ? list : []).map(i => puvodniNaNove.get(String(i))).filter(Boolean);
    if (vlastni && Array.isArray(d.skupiny)) {
      const sids = new Set();
      for (const s of d.skupiny) {
        if (!s || typeof s !== 'object') continue;
        let id = s.id != null && !sids.has(String(s.id)) ? String(s.id).slice(0, 80) : noveId('s', sids);
        sids.add(id);
        const sk = { id, nazev: txt(s.nazev, 120).trim() || 'Skupina', barva: jeBarva(s.barva) ? s.barva : BARVY_SKUPIN[mapa.skupiny.length % BARVY_SKUPIN.length], uzly: [] };
        mapa.skupiny.push(sk);
        for (const u of prevod(s.uzly)) vlozDoSkupiny(mapa, sk.id, u);
      }
    }
    if (vlastni && Array.isArray(d.pribehy)) {
      const pids = new Set();
      for (const p of d.pribehy) {
        if (!p || typeof p !== 'object') continue;
        const id = p.id != null && !pids.has(String(p.id)) ? String(p.id).slice(0, 80) : noveId('p', pids);
        pids.add(id);
        const kids = new Set();
        mapa.pribehy.push({ id, nazev: txt(p.nazev, 120).trim() || 'Prezentace',
          kroky: (Array.isArray(p.kroky) ? p.kroky : []).filter(k => k && typeof k === 'object').slice(0, 300).map(k => {
            const kid = k.id != null && !kids.has(String(k.id)) ? String(k.id).slice(0, 80) : noveId('k', kids);
            kids.add(kid);
            return { id: kid, titulek: txt(k.titulek, 200), poznamka: txt(k.poznamka, 5000), uzly: [...new Set(prevod(k.uzly))] };
          }) });
      }
    }
    if (d.pohled && typeof d.pohled === 'object') {
      mapa.pohled = { x: cislo(d.pohled.x, 0), y: cislo(d.pohled.y, 0), z: Math.max(0.05, Math.min(8, cislo(d.pohled.z, 1))), w: cislo(d.pohled.w, 0), h: cislo(d.pohled.h, 0) };
    }
    return { mapa, varovani };
  }

  function naJSON(mapa) {
    const m = kopie(mapa);
    m.format = FORMAT; m.verze = VERZE;
    for (const u of m.uzly) { u.x = Math.round(cislo(u.x, 0) * 10) / 10; u.y = Math.round(cislo(u.y, 0) * 10) / 10; }
    return JSON.stringify(m, null, 2);
  }

  /* ---------- rychlé zadání textem ----------
     Uzel:      Název [typ] | popis          (typ i popis jsou nepovinné, typ = id nebo název typu)
     Vztah:     A -> B : popis {typ vztahu}    A -- B    A <-> B    A <- B
     Pokračování popisu uzlu:  řádek začínající „  “ nebo „> “ pod uzlem
     Atribut uzlu:  odsazené  @klíč: hodnota
     Skupina:   ## Název skupiny   (uzly deklarované pod ní do ní patří; samotné ## skupinu ukončí)
     Komentář:  # …                                                      */
  function parsujText(text, mapa) {
    const m = mapa || novaMapa();
    const chyby = [];
    const podleNazvu = new Map(m.uzly.map(u => [u.nazev.toLowerCase(), u]));
    const najdiTyp = s => {
      const k = s.trim().toLowerCase();
      return m.typy.find(t => t.id.toLowerCase() === k || t.nazev.toLowerCase() === k) || null;
    };
    const rozeber = s => {
      let nazev = s.trim(), typ = null, popis = '';
      const p = nazev.indexOf('|');
      if (p >= 0) { popis = nazev.slice(p + 1).trim(); nazev = nazev.slice(0, p).trim(); }
      const t = nazev.match(/\[([^\]]+)\]\s*$/);
      if (t) { typ = najdiTyp(t[1]); nazev = nazev.slice(0, t.index).trim(); if (!typ) typ = { neznamy: t[1] }; }
      return { nazev, typ, popis };
    };
    const zajisti = (r, cislo) => {
      if (!r.nazev) return null;
      if (r.typ && r.typ.neznamy) { chyby.push('Řádek ' + cislo + ': neznámý typ „' + r.typ.neznamy + '“.'); r.typ = null; }
      let u = podleNazvu.get(r.nazev.toLowerCase());
      if (!u) {
        u = pridejUzel(m, { nazev: r.nazev, typ: r.typ ? r.typ.id : undefined, popis: r.popis });
        podleNazvu.set(r.nazev.toLowerCase(), u);
      } else {
        if (r.typ) u.typ = r.typ.id;
        if (r.popis) u.popis = r.popis;
      }
      return u;
    };
    m.skupiny = m.skupiny || []; m.typyVztahu = m.typyVztahu || [];
    const najdiTypVztahu = s => {
      const k = s.trim().toLowerCase();
      return m.typyVztahu.find(t => t.id.toLowerCase() === k || t.nazev.toLowerCase() === k) || null;
    };
    let posledni = null, skupina = null;
    const radky = String(text).split(/\r?\n/);
    radky.forEach((radek, i) => {
      const c = i + 1;
      if (!radek.trim()) return;
      const sk = radek.match(/^\s*##(?!#)\s*(.*)$/);
      if (sk) {
        const n = sk[1].trim();
        skupina = !n ? null : (m.skupiny.find(s => s.nazev.toLowerCase() === n.toLowerCase()) || pridejSkupinu(m, n, []));
        posledni = null;
        return;
      }
      if (/^\s*#/.test(radek)) return;
      if (posledni && /^(\s{2,}|\t|\s*>\s)/.test(radek)) {
        const doslovne = /^\s*>\s/.test(radek);   /* „> “ = text popisu, i když začíná @ */
        const s = radek.replace(/^\s*>?\s*/, '');
        const at = doslovne ? null : s.match(/^@([^:]+):\s*(.*)$/);
        if (at) {
          const k = at[1].trim();
          const ex = posledni.atributy.find(a => a[0] === k);
          if (ex) ex[1] = at[2].trim(); else posledni.atributy.push([k, at[2].trim()]);
          return;
        }
        posledni.popis = posledni.popis ? posledni.popis + '\n' + s : s;
        return;
      }
      let v = radek.match(/^(.*?)\s+(<->|->|<-|--)\s+(.*?)(?:\s+:\s+(.*))?$/) || radek.match(/^(.*?)\s*(<->|->|<-|--)\s*(.*?)(?:\s*:\s*(.*))?$/);
      if (v && !v[4]) {
        const tv = v[3].match(/\s*(\{[^}]+\})\s*$/);
        if (tv) { v = v.slice(); v[3] = v[3].slice(0, tv.index); v[4] = tv[1]; }
      }
      if (v && v[1].trim() && v[3].trim()) {
        const a = zajisti(rozeber(v[1]), c), b = zajisti(rozeber(v[3]), c);
        if (!a || !b || a === b) { chyby.push('Řádek ' + c + ': vztah potřebuje dva různé uzly.'); return; }
        let od = a, doU = b, smer = v[2];
        if (smer === '<-') { od = b; doU = a; smer = '->'; }
        let popis = (v[4] || '').trim(), typ = null;
        /* {typ vztahu} na konci – za popisem, nebo i bez popisu (pak je ve v[3]) */
        const tv = popis.match(/\{([^}]+)\}\s*$/);
        if (tv) { popis = popis.slice(0, tv.index).trim(); typ = najdiTypVztahu(tv[1]); if (!typ) chyby.push('Řádek ' + c + ': neznámý typ vztahu „' + tv[1] + '“.'); }
        pridejHranu(m, od.id, doU.id, { popis, smer, typ: typ ? typ.id : null });   /* směr ze šipky má přednost před směrem typu */
        posledni = null;
        return;
      }
      if (/(^|\s)(<->|->|<-|--)\s*$/.test(radek) || /^\s*(<->|->|<-|--)(\s|$)/.test(radek)) {
        chyby.push('Řádek ' + c + ': neúplný vztah – chybí jeden z uzlů.'); posledni = null; return;
      }
      posledni = zajisti(rozeber(radek), c);
      if (posledni && skupina) vlozDoSkupiny(m, skupina.id, posledni.id);
    });
    return { mapa: m, chyby };
  }

  function naText(mapa) {
    const radky = ['# ' + mapa.nazev];
    const jmeno = new Map(mapa.uzly.map(u => [u.id, u.nazev]));
    const nejasne = new Set();
    const pocty = new Map();
    for (const u of mapa.uzly) pocty.set(u.nazev.toLowerCase(), (pocty.get(u.nazev.toLowerCase()) || 0) + 1);
    for (const [k, n] of pocty) if (n > 1) nejasne.add(k);
    const uzel = u => {
      const t = typUzlu(mapa, u);
      let r = u.nazev + ' [' + t.id + ']';
      const pop = u.popis.split('\n');
      if (pop[0]) r += ' | ' + pop[0];
      radky.push(r);
      for (const p of pop.slice(1)) radky.push('  ' + (p.startsWith('@') ? '> ' : '') + p);
      for (const [k, v] of u.atributy || []) radky.push('  @' + k + ': ' + v);
    };
    const veSkupine = new Set((mapa.skupiny || []).flatMap(s => s.uzly));
    for (const u of mapa.uzly) if (!veSkupine.has(u.id)) uzel(u);
    for (const s of mapa.skupiny || []) {
      radky.push('', '## ' + s.nazev);
      for (const id of s.uzly) { const u = najdiUzel(mapa, id); if (u) uzel(u); }
      radky.push('##');
    }
    if (mapa.hrany.length) radky.push('');
    for (const h of mapa.hrany) {
      const t = typVztahu(mapa, h);
      radky.push(jmeno.get(h.od) + ' ' + h.smer + ' ' + jmeno.get(h.do) + (h.popis ? ' : ' + h.popis : '') + (t ? ' {' + t.id + '}' : ''));
    }
    if (nejasne.size) radky.push('', '# Pozor: některé uzly mají stejný název a v textu splynou.');
    return radky.join('\n');
  }

  /* ---------- graf ---------- */
  function sousedstvi(mapa, respektujSmer) {
    const s = new Map(mapa.uzly.map(u => [u.id, []]));
    for (const h of mapa.hrany) {
      if (!s.has(h.od) || !s.has(h.do)) continue;
      s.get(h.od).push({ id: h.do, hrana: h.id });
      if (!respektujSmer || h.smer !== '->') s.get(h.do).push({ id: h.od, hrana: h.id });
    }
    return s;
  }

  /* uzly do vzdálenosti `hloubka` od výchozích (Map id → vzdálenost) */
  function okoli(mapa, startIds, hloubka) {
    const s = sousedstvi(mapa, false);
    const d = new Map();
    let fronta = [];
    for (const id of startIds) if (s.has(id)) { d.set(id, 0); fronta.push(id); }
    for (let k = 1; k <= hloubka && fronta.length; k++) {
      const dalsi = [];
      for (const id of fronta) for (const n of s.get(id)) if (!d.has(n.id)) { d.set(n.id, k); dalsi.push(n.id); }
      fronta = dalsi;
    }
    return d;
  }

  /* nejkratší cesta BFS → { uzly:[id…], hrany:[id…] } nebo null */
  function nejkratsiCesta(mapa, a, b, respektujSmer) {
    const s = sousedstvi(mapa, !!respektujSmer);
    if (!s.has(a) || !s.has(b)) return null;
    const pred = new Map([[a, null]]);
    const fronta = [a];
    while (fronta.length) {
      const id = fronta.shift();
      if (id === b) break;
      for (const n of s.get(id)) if (!pred.has(n.id)) { pred.set(n.id, { z: id, hrana: n.hrana }); fronta.push(n.id); }
    }
    if (!pred.has(b)) return null;
    const uzly = [b], hrany = [];
    let k = b;
    while (pred.get(k)) { const p = pred.get(k); hrany.unshift(p.hrana); uzly.unshift(p.z); k = p.z; }
    return { uzly, hrany };
  }

  function statistika(mapa) {
    const st = new Map(mapa.uzly.map(u => [u.id, 0]));
    for (const h of mapa.hrany) {
      if (st.has(h.od)) st.set(h.od, st.get(h.od) + 1);
      if (st.has(h.do)) st.set(h.do, st.get(h.do) + 1);
    }
    /* komponenty */
    const s = sousedstvi(mapa, false);
    const komp = new Map();
    let nk = 0;
    for (const u of mapa.uzly) {
      if (komp.has(u.id)) continue;
      const z = [u.id]; komp.set(u.id, nk);
      while (z.length) { const id = z.pop(); for (const n of s.get(id)) if (!komp.has(n.id)) { komp.set(n.id, nk); z.push(n.id); } }
      nk++;
    }
    const podleTypu = {};
    for (const u of mapa.uzly) podleTypu[u.typ] = (podleTypu[u.typ] || 0) + 1;
    const nejpropojenejsi = mapa.uzly.slice().sort((p, q) => st.get(q.id) - st.get(p.id) || p.nazev.localeCompare(q.nazev, 'cs'))
      .slice(0, 5).filter(u => st.get(u.id) > 0).map(u => ({ id: u.id, nazev: u.nazev, stupen: st.get(u.id) }));
    const n = mapa.uzly.length;
    return {
      uzlu: n, hran: mapa.hrany.length, komponent: nk,
      osamocene: mapa.uzly.filter(u => st.get(u.id) === 0).map(u => u.id),
      prumernyStupen: n ? 2 * mapa.hrany.length / n : 0,
      hustota: n > 1 ? mapa.hrany.length / (n * (n - 1) / 2) : 0,
      podleTypu, nejpropojenejsi, stupne: st
    };
  }

  function hledej(mapa, dotaz) {
    const q = bezDiakritiky(String(dotaz || '').trim().toLowerCase());
    if (!q) return [];
    const vysl = [];
    for (const u of mapa.uzly) {
      const nz = bezDiakritiky(u.nazev.toLowerCase());
      let skore = 0;
      if (nz === q) skore = 100; else if (nz.startsWith(q)) skore = 60; else if (nz.indexOf(q) >= 0) skore = 40;
      else if (u.tagy.some(t => bezDiakritiky(t.toLowerCase()).indexOf(q) >= 0)) skore = 25;
      else if ((u.atributy || []).some(a => bezDiakritiky((a[0] + ' ' + a[1]).toLowerCase()).indexOf(q) >= 0)) skore = 15;
      else if (bezDiakritiky(u.popis.toLowerCase()).indexOf(q) >= 0) skore = 10;
      if (skore) vysl.push({ id: u.id, skore });
    }
    return vysl.sort((a, b) => b.skore - a.skore).map(v => v.id);
  }
  function bezDiakritiky(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /* ---------- data ---------- */
  /* „1969“, „1969-07“, „1969-07-20“, „20. 7. 1969“, „-500“ (př. n. l.), „500 př. n. l.“ → desetinný rok nebo NaN */
  function rokZData(s) {
    s = String(s || '').trim();
    if (!s) return NaN;
    let m = s.match(/^(-?\d{1,6})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);
    if (m) return +m[1] + ((m[2] ? +m[2] - 1 : 0) + (m[3] ? (+m[3] - 1) / 31 : 0)) / 12;
    m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(-?\d{1,6})$/);
    if (m) return +m[3] + (+m[2] - 1 + (+m[1] - 1) / 31) / 12;
    m = s.match(/^(\d{1,2})\.\s*(\d{4})$/);
    if (m) return +m[2] + (+m[1] - 1) / 12;
    m = s.match(/^(\d{1,6})\s*(př\.?\s*n\.?\s*l\.?|bc|BC|př\.\s*Kr\.?)$/);
    if (m) return -(+m[1]);
    m = s.match(/(-?\d{3,4})/);
    if (m) return +m[1];
    return NaN;
  }

  /* ---------- geometrie uzlů ---------- */
  const PISMO = 13, RADEK = 17, PISMO_MALE = 11.5, RADEK_MALY = 15;
  const SIRKA_SBALENY = 190, SIRKA_ROZBALENY = 280, PAD = 10, SIPKA = 12;   /* SIPKA = místo pro ▸ vpravo od názvu */

  function zalom(text, maxW, mer, tucne, maxRadku) {
    const vysl = [];
    for (const odst of String(text).split('\n')) {
      const slova = odst.split(/\s+/).filter(Boolean);
      if (!slova.length) { vysl.push(''); continue; }
      let r = '';
      for (let s of slova) {
        while (mer(s, tucne) > maxW && s.length > 1) {
          /* příliš dlouhé slovo rozdělit */
          if (r) { vysl.push(r); r = ''; }
          let k = s.length - 1;
          while (k > 1 && mer(s.slice(0, k), tucne) > maxW) k--;
          vysl.push(s.slice(0, k)); s = s.slice(k);
        }
        const zk = r ? r + ' ' + s : s;
        if (mer(zk, tucne) <= maxW) r = zk;
        else { vysl.push(r); r = s; }
      }
      if (r) vysl.push(r);
    }
    if (maxRadku && vysl.length > maxRadku) {
      const v = vysl.slice(0, maxRadku);
      let p = v[maxRadku - 1];
      while (p && mer(p + '…', tucne) > maxW) p = p.slice(0, -1);
      v[maxRadku - 1] = p + '…';
      return v;
    }
    return vysl;
  }

  /* Rozměry a obsah vykreslení uzlu.
     info: { stupen, meritko (zvětšení podle metriky, 1 = běžné), obrazekPomer (šířka/výška obrázku) }
     Vrací { w, h, k, w0, h0, tvar, radky:[{t, y, styl}], odsazeni } – w, h jsou po zvětšení (pro hrany a kolize),
     w0, h0 a souřadnice řádků před zvětšením (kreslí se ve skupině se scale(k)). */
  function geometrieUzlu(mapa, uzel, mer, info) {
    info = info || {};
    const typ = typUzlu(mapa, uzel);
    const ikona = typ.ikona ? typ.ikona + ' ' : '';
    const rozb = uzel.rozbaleny;
    const maxW = (rozb ? SIRKA_ROZBALENY : SIRKA_SBALENY) - 2 * PAD;
    const tit = zalom(ikona + uzel.nazev, maxW - SIPKA, mer, true, rozb ? 4 : 3);
    const radky = [];
    let y = PAD + PISMO;
    let sirka = 0;
    for (const t of tit) { radky.push({ t, y, styl: 'nadpis' }); sirka = Math.max(sirka, mer(t, true)); y += RADEK; }
    if (rozb) {
      const meta = [typ.nazev];
      if (uzel.datum) meta.push(uzel.datum + (uzel.datumDo ? ' – ' + uzel.datumDo : ''));
      if (info.stupen != null) meta.push(info.stupen + ' ' + sklon(info.stupen, 'vztah', 'vztahy', 'vztahů'));
      y += 2;
      for (const t of zalom(meta.join(' · '), maxW, mer, false, 2)) { radky.push({ t, y, styl: 'meta' }); y += RADEK_MALY; }
      if (uzel.obrazek) {
        const pomer = info.obrazekPomer > 0 ? info.obrazekPomer : 1.6;
        const ih = Math.round(Math.max(40, Math.min(170, maxW / pomer)));
        radky.push({ t: '', y: y - 6, h: ih, w: maxW, styl: 'obrazek' });
        y += ih + 4;
      }
      if (uzel.popis) {
        y += 4;
        radky.push({ t: '', y: y - 6, styl: 'cara' });
        for (const t of zalom(uzel.popis, maxW, mer, false, 14)) { radky.push({ t, y: y + 4, styl: 'popis' }); y += RADEK_MALY; }
        y += 4;
      }
      if (uzel.atributy && uzel.atributy.length) {
        y += 2;
        for (const [k, v] of uzel.atributy.slice(0, 12)) {
          const rr = zalom(k + ': ' + v, maxW, mer, false, 3);
          rr.forEach((t, n) => { radky.push({ t, y: y + 2, styl: 'atribut', klic: n === 0 ? k : '' }); y += RADEK_MALY; });
        }
        if (uzel.atributy.length > 12) { radky.push({ t: '… a ' + (uzel.atributy.length - 12) + ' dalších', y: y + 2, styl: 'tagy' }); y += RADEK_MALY; }
        y += 2;
      }
      if (uzel.tagy.length) {
        for (const t of zalom(uzel.tagy.map(t => '#' + t).join('  '), maxW, mer, false, 3)) { radky.push({ t, y: y + 2, styl: 'tagy' }); y += RADEK_MALY; }
      }
      if (uzel.odkaz) {
        let dom = uzel.odkaz.replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '');
        radky.push({ t: '🔗 ' + (dom || uzel.odkaz).slice(0, 40), y: y + 2, styl: 'odkaz' }); y += RADEK_MALY;
      }
      sirka = maxW;
    }
    let w = Math.max(rozb ? SIRKA_ROZBALENY : 70, Math.ceil(sirka) + 2 * PAD + (rozb ? 0 : SIPKA));
    let h = Math.ceil(y - RADEK + PAD + 5);
    if (!rozb && radky.length === 1) h = Math.max(h, 36);
    if (typ.tvar === 'kapsle' && !rozb) w += 14;
    let odsazeni = 0;
    if (typ.tvar === 'elipsa') {
      /* do elipsy se vepsaný obdélník vejde, když je elipsa √2× větší */
      const ew = Math.ceil(w * 1.3), eh = Math.ceil(h * 1.45);
      odsazeni = (ew - w) / 2;
      const dy = (eh - h) / 2;
      for (const r of radky) r.y += dy;
      w = ew; h = eh;
    }
    const k = info.meritko > 0 ? Math.max(0.5, Math.min(3, info.meritko)) : 1;
    return { w: w * k, h: h * k, k, w0: w, h0: h, tvar: typ.tvar, radky, odsazeni };
  }

  /* Vnitřek uzlu jako SVG (v souřadnicích před zvětšením, levý horní roh 0,0).
     barvy = null → třídy pro CSS stránky; jinak objekt barev → vše natvrdo (samostatný soubor).
     obrazky: Map url → náhradní data URL (export vkládá obrázky dovnitř souboru). */
  function svgUzlu(mapa, uzel, g, barvy, obrazky) {
    const typ = typUzlu(mapa, uzel);
    const c = uzel.barva || typ.barva;
    const W = g.w0, H = g.h0;
    const o = [];
    const t = cestaTvaru({ w: W, h: H, tvar: g.tvar }, 0, 0);
    const atr = Object.entries(t.a).map(([k, v]) => k + '="' + v + '"').join(' ');
    o.push(barvy ? '<' + t.el + ' ' + atr + ' fill="' + barvy.panel + '" stroke="' + c + '" stroke-width="2"/>' : '<' + t.el + ' class="tvar" ' + atr + '/>');
    if (g.tvar === 'zaobleny' || g.tvar === 'ostry') {
      const k = g.tvar === 'ostry' ? 1 : 5;
      o.push('<rect' + (barvy ? ' fill="' + c + '"' : ' class="pruh"') + ' x="' + k + '" y="1" width="' + f(W - 2 * k) + '" height="4" rx="2"/>');
    }
    const ox = (g.odsazeni || 0) + PAD;
    const css = {
      nadpis: 'font-size="' + PISMO + '" font-weight="600" fill="' + (barvy && barvy.text) + '"',
      meta: 'font-size="' + PISMO_MALE + '" font-weight="600" fill="' + (barvy && barvy.tlumeny) + '"',
      popis: 'font-size="' + PISMO_MALE + '" fill="' + (barvy && barvy.tlumeny) + '"',
      atribut: 'font-size="' + PISMO_MALE + '" fill="' + (barvy && barvy.tlumeny) + '"',
      tagy: 'font-size="' + PISMO_MALE + '" font-style="italic" fill="' + (barvy && barvy.tlumeny) + '"',
      odkaz: 'font-size="' + PISMO_MALE + '" fill="' + (barvy && (barvy.odkaz || barvy.tlumeny)) + '"'
    };
    for (const r of g.radky) {
      if (r.styl === 'cara') { o.push('<line' + (barvy ? ' stroke="' + c + '" stroke-opacity="0.35"' : ' class="cara"') + ' x1="' + f(ox) + '" y1="' + f(r.y) + '" x2="' + f(W - ox) + '" y2="' + f(r.y) + '"/>'); continue; }
      if (r.styl === 'obrazek') {
        const href = (obrazky && obrazky.get(uzel.obrazek)) || uzel.obrazek;
        o.push('<image' + (barvy ? '' : ' class="obr"') + ' href="' + esc(href) + '" x="' + f(ox) + '" y="' + f(r.y) + '" width="' + f(r.w) + '" height="' + f(r.h) + '" preserveAspectRatio="xMidYMid meet"/>');
        continue;
      }
      let obsah = esc(r.t);
      if (r.styl === 'atribut' && r.klic && r.t.indexOf(r.klic + ':') === 0) {
        obsah = '<tspan font-weight="600"' + (barvy ? ' fill="' + barvy.text + '"' : ' class="klic"') + '>' + esc(r.klic + ':') + '</tspan>' + esc(r.t.slice(r.klic.length + 1));
      }
      o.push('<text ' + (barvy ? css[r.styl] : 'class="' + r.styl + '"') + ' x="' + f(ox) + '" y="' + f(r.y) + '" xml:space="preserve">' + obsah + '</text>');
    }
    return o.join('');
  }

  /* Rámeček skupiny kolem jejích uzlů → {x, y, w, h} nebo null */
  const SKUPINA_OKRAJ = 18, SKUPINA_HLAVA = 24;
  function obalSkupiny(mapa, geo, sk, vidi) {
    const ids = sk.uzly.filter(id => geo.has(id) && (!vidi || vidi.has(id)));
    if (!ids.length) return null;
    const ob = obal(mapa, geo, ids);
    return { x: ob.x - SKUPINA_OKRAJ, y: ob.y - SKUPINA_OKRAJ - SKUPINA_HLAVA, w: ob.w + 2 * SKUPINA_OKRAJ, h: ob.h + 2 * SKUPINA_OKRAJ + SKUPINA_HLAVA };
  }

  function sklon(n, a, b, c) { return n === 1 ? a : (n >= 2 && n <= 4 ? b : c); }

  /* průsečík polopřímky ze středu tvaru ve směru (dx,dy) s jeho okrajem */
  function naOkraji(cx, cy, g, dx, dy) {
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    let t;
    if (g.tvar === 'elipsa') {
      const a = g.w / 2, b = g.h / 2;
      t = 1 / Math.sqrt((ux * ux) / (a * a) + (uy * uy) / (b * b));
    } else {
      const tx = Math.abs(ux) > 1e-9 ? (g.w / 2) / Math.abs(ux) : Infinity;
      const ty = Math.abs(uy) > 1e-9 ? (g.h / 2) / Math.abs(uy) : Infinity;
      t = Math.min(tx, ty);
    }
    return { x: cx + ux * t, y: cy + uy * t };
  }

  /* Geometrie všech hran: rovné, nebo oblouky u více hran mezi stejnou dvojicí.
     geo: Map id uzlu → {w,h,tvar}. Vrací Map id hrany → { d, x1,y1,x2,y2, cx,cy, lx,ly, sipkaKonec, sipkaZacatek } */
  function geometrieHran(mapa, geo) {
    const skupiny = new Map();
    for (const h of mapa.hrany) {
      const k = h.od < h.do ? h.od + '\u0001' + h.do : h.do + '\u0001' + h.od;
      if (!skupiny.has(k)) skupiny.set(k, []);
      skupiny.get(k).push(h);
    }
    const uz = new Map(mapa.uzly.map(u => [u.id, u]));
    const vysl = new Map();
    for (const [, sk] of skupiny) {
      sk.forEach((h, i) => {
        const A = uz.get(h.od), B = uz.get(h.do);
        if (!A || !B || !geo.has(A.id) || !geo.has(B.id)) return;
        const n = sk.length;
        /* posun kolmo na spojnici; orientace podle kanonického pořadí, aby se protisměrné hrany nepřekryly */
        let off = (i - (n - 1) / 2) * 46;
        if (h.od > h.do) off = -off;
        const dx = B.x - A.x, dy = B.y - A.y;
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L;
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        const cx = mx + nx * off * 2, cy = my + ny * off * 2; /* řídicí bod kvadratické křivky */
        const p1 = off ? naOkraji(A.x, A.y, geo.get(A.id), cx - A.x, cy - A.y) : naOkraji(A.x, A.y, geo.get(A.id), dx, dy);
        const p2 = off ? naOkraji(B.x, B.y, geo.get(B.id), cx - B.x, cy - B.y) : naOkraji(B.x, B.y, geo.get(B.id), -dx, -dy);
        /* uzly přes sebe – hranu nekreslit */
        const prekryv = Math.abs(dx) < (geo.get(A.id).w + geo.get(B.id).w) / 2 && Math.abs(dy) < (geo.get(A.id).h + geo.get(B.id).h) / 2;
        let r;
        if (!off) {
          r = { d: 'M' + f(p1.x) + ' ' + f(p1.y) + 'L' + f(p2.x) + ' ' + f(p2.y), x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
            lx: (p1.x + p2.x) / 2, ly: (p1.y + p2.y) / 2, tx1: p2.x - p1.x, ty1: p2.y - p1.y, tx2: p2.x - p1.x, ty2: p2.y - p1.y };
        } else {
          r = { d: 'M' + f(p1.x) + ' ' + f(p1.y) + 'Q' + f(cx) + ' ' + f(cy) + ' ' + f(p2.x) + ' ' + f(p2.y),
            x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
            lx: 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x, ly: 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y,
            tx1: cx - p1.x, ty1: cy - p1.y, tx2: p2.x - cx, ty2: p2.y - cy };
        }
        r.skryta = prekryv;
        const vel = 7 + h.sila * 2;
        if (h.smer === '->' || h.smer === '<->') r.sipkaKonec = sipka(r.x2, r.y2, r.tx2, r.ty2, vel);
        if (h.smer === '<->') r.sipkaZacatek = sipka(r.x1, r.y1, -r.tx1, -r.ty1, vel);
        vysl.set(h.id, r);
      });
    }
    return vysl;
  }
  function sipka(x, y, tx, ty, vel) {
    const L = Math.hypot(tx, ty) || 1;
    const ux = tx / L, uy = ty / L;
    const bx = x - ux * vel, by = y - uy * vel;
    const s = vel * 0.5;
    return 'M' + f(x) + ' ' + f(y) + 'L' + f(bx - uy * s) + ' ' + f(by + ux * s) + 'L' + f(bx + uy * s) + ' ' + f(by - ux * s) + 'Z';
  }
  const f = v => (Math.round(v * 10) / 10).toString();

  /* ---------- rozmístění ---------- */
  /* Silová simulace (Fruchterman–Reingold s odpuzováním podle velikosti obdélníků).
     geo: Map id → {w,h}. pevne: Set id, které se nehýbou. Vrací objekt { krok(n) → energie }. */
  function silovaSimulace(mapa, geo, volby) {
    volby = volby || {};
    const pevne = volby.pevne || new Set(mapa.uzly.filter(u => u.zamceny).map(u => u.id));
    const rnd = nahoda(volby.seed || 7);
    const N = mapa.uzly;
    const delka = volby.delka || 150;
    const ODPUZ = volby.odpuzovani != null ? volby.odpuzovani : 0.15, PRUZ = volby.pruznost != null ? volby.pruznost : 0.6, GRAV = volby.gravitace != null ? volby.gravitace : 0.1;
    /* uzly bez pozice: k sousedovi s pozicí, jinak náhodně */
    const s = sousedstvi(mapa, false);
    const poz = new Map();
    for (const u of N) if (isFinite(u.x) && isFinite(u.y)) poz.set(u.id, u);
    const R0 = Math.sqrt(N.length) * delka * 0.6 + 50;
    for (const u of N) {
      if (poz.has(u.id)) continue;
      const soused = s.get(u.id).map(n => poz.get(n.id)).find(Boolean);
      if (soused) { const a = rnd() * Math.PI * 2; u.x = soused.x + Math.cos(a) * delka; u.y = soused.y + Math.sin(a) * delka; }
      else { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R0; u.x = Math.cos(a) * r; u.y = Math.sin(a) * r; }
      poz.set(u.id, u);
    }
    const idx = new Map(N.map((u, i) => [u.id, i]));
    const E = mapa.hrany.map(h => [idx.get(h.od), idx.get(h.do)]).filter(e => e[0] != null && e[1] != null);
    const vx = new Float64Array(N.length), vy = new Float64Array(N.length);
    let teplota = volby.teplota != null ? volby.teplota : 1;
    const ochlazeni = volby.ochlazeni || 0.985;
    const pol = N.map(u => { const g = geo.get(u.id) || { w: 120, h: 40 }; return { w: g.w, h: g.h }; });

    function krok(n) {
      let energie = 0;
      for (let it = 0; it < (n || 1); it++) {
        const fx = new Float64Array(N.length), fy = new Float64Array(N.length);
        /* odpuzování všech dvojic (n² – pro stovky uzlů stačí) */
        for (let i = 0; i < N.length; i++) {
          for (let j = i + 1; j < N.length; j++) {
            let dx = N[i].x - N[j].x, dy = N[i].y - N[j].y;
            if (dx === 0 && dy === 0) { dx = rnd() - 0.5; dy = rnd() - 0.5; }
            /* vzdálenost mezi okraji obdélníků (záporná = překryv) */
            const ox = Math.abs(dx) - (pol[i].w + pol[j].w) / 2 - 24;
            const oy = Math.abs(dy) - (pol[i].h + pol[j].h) / 2 - 24;
            const d2 = dx * dx + dy * dy;
            const d = Math.sqrt(d2);
            let F = (delka * delka) / Math.max(d, 1) * ODPUZ;
            if (ox < 0 && oy < 0) F += Math.min(-ox, -oy) * 6; /* překryv: silný tlak od sebe */
            if (d > delka * 6) F *= 0.25;
            const ux = dx / d, uy = dy / d;
            fx[i] += ux * F; fy[i] += uy * F; fx[j] -= ux * F; fy[j] -= uy * F;
          }
        }
        /* přitažlivost hran (pružina k délce podle velikosti uzlů) */
        for (const [a, b] of E) {
          const dx = N[b].x - N[a].x, dy = N[b].y - N[a].y;
          const d = Math.hypot(dx, dy) || 1;
          const L = delka + (pol[a].w + pol[b].w) / 4;
          const F = (d - L) * PRUZ;
          const ux = dx / d, uy = dy / d;
          fx[a] += ux * F; fy[a] += uy * F; fx[b] -= ux * F; fy[b] -= uy * F;
        }
        /* slabé gravitační centrum, ať se komponenty nerozutíkají */
        let sx = 0, sy = 0;
        for (const u of N) { sx += u.x; sy += u.y; }
        sx /= N.length || 1; sy /= N.length || 1;
        for (let i = 0; i < N.length; i++) { fx[i] -= (N[i].x - sx) * GRAV; fy[i] -= (N[i].y - sy) * GRAV; }
        energie = 0;
        const maxPosun = 60 * teplota + 0.5;
        for (let i = 0; i < N.length; i++) {
          if (pevne.has(N[i].id)) continue;
          vx[i] = (vx[i] + fx[i] * 0.08) * 0.6; vy[i] = (vy[i] + fy[i] * 0.08) * 0.6;
          const v = Math.hypot(vx[i], vy[i]);
          if (v > maxPosun) { vx[i] *= maxPosun / v; vy[i] *= maxPosun / v; }
          N[i].x += vx[i]; N[i].y += vy[i];
          energie += vx[i] * vx[i] + vy[i] * vy[i];
        }
        teplota *= ochlazeni;
      }
      return energie / (N.length || 1);
    }
    return { krok, get teplota() { return teplota; } };
  }

  function rozmistiSilove(mapa, geo, volby) {
    const sim = silovaSimulace(mapa, geo, volby);
    const n = (volby && volby.iterace) || 400;
    let e = 0;
    for (let i = 0; i < n; i++) { e = sim.krok(1); if (i > 60 && e < 0.01) break; }
    /* husté mapy: dorovnání opakovat, dokud něco zbývá (každé kolo rozstrčí i nově vzniklé dvojice) */
    for (let kolo = 0; kolo < 6 && odstranPrekryvy(mapa, geo, volby && volby.pevne); kolo++) { /* další kolo */ }
    return e;
  }

  /* Dorovnání po simulaci: překrývající se dvojice rozstrčí po ose menšího průniku.
     Vrací počet zbylých překryvů (0 = čisto). */
  function odstranPrekryvy(mapa, geo, pevne, mezera) {
    pevne = pevne || new Set(mapa.uzly.filter(u => u.zamceny).map(u => u.id));
    mezera = mezera == null ? 12 : mezera;
    const N = mapa.uzly;
    const G = N.map(u => geo.get(u.id) || { w: 120, h: 40 });
    let zbyva = 0;
    for (let it = 0; it < 60; it++) {
      zbyva = 0;
      /* zametání podle x: porovnávají se jen dvojice, které se mohou překrývat vodorovně */
      const por = N.map((u, i) => i).sort((a, b) => (N[a].x - G[a].w / 2) - (N[b].x - G[b].w / 2));
      for (let p = 0; p < por.length; p++) {
        const i = por[p];
        for (let q = p + 1; q < por.length; q++) {
          const j = por[q];
          if (N[j].x - G[j].w / 2 > N[i].x + G[i].w / 2 + mezera) break;
          const dx = N[j].x - N[i].x, dy = N[j].y - N[i].y;
          const px = (G[i].w + G[j].w) / 2 + mezera - Math.abs(dx);
          const py = (G[i].h + G[j].h) / 2 + mezera - Math.abs(dy);
          if (px <= 0 || py <= 0) continue;
          zbyva++;
          const fi = pevne.has(N[i].id), fj = pevne.has(N[j].id);
          if (fi && fj) continue;
          const ki = fi ? 0 : fj ? 1 : 0.5, kj = fj ? 0 : fi ? 1 : 0.5;
          if (px < py) { const sx = (dx >= 0 ? 1 : -1) * (px + 0.5); N[i].x -= sx * ki; N[j].x += sx * kj; }
          else { const sy = (dy >= 0 ? 1 : -1) * (py + 0.5); N[i].y -= sy * ki; N[j].y += sy * kj; }
        }
      }
      if (!zbyva) break;
    }
    if (!zbyva) return 0;
    /* skutečný zbytek po posledním kole (počet výše je z kola před odstrčením) */
    let k = 0;
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      if (Math.abs(N[i].x - N[j].x) < (G[i].w + G[j].w) / 2 && Math.abs(N[i].y - N[j].y) < (G[i].h + G[j].h) / 2) k++;
    }
    return k;
  }

  /* Kruhově kolem středu: soustředné kružnice po vzdálenosti v grafu, v kružnici seřazeno podle předka. */
  function rozmistiKruhove(mapa, geo, stredId) {
    const s = sousedstvi(mapa, false);
    if (!s.has(stredId)) return;
    const stred = najdiUzel(mapa, stredId);
    const cx = isFinite(stred.x) ? stred.x : 0, cy = isFinite(stred.y) ? stred.y : 0;
    const vrstva = new Map([[stredId, 0]]), uhel = new Map([[stredId, 0]]);
    let fronta = [stredId], k = 0;
    const vrstvy = [[stredId]];
    while (fronta.length) {
      const dalsi = [];
      for (const id of fronta) for (const n of s.get(id)) if (!vrstva.has(n.id)) { vrstva.set(n.id, k + 1); dalsi.push(n.id); }
      if (!dalsi.length) break;
      k++; vrstvy.push(dalsi); fronta = dalsi;
    }
    const zbytek = mapa.uzly.filter(u => !vrstva.has(u.id)).map(u => u.id);
    if (zbytek.length) vrstvy.push(zbytek);
    let r = 0;
    for (let v = 1; v < vrstvy.length; v++) {
      const ids = vrstvy[v];
      /* pořadí podle úhlu předka, ať se čáry nekříží */
      const klic = id => {
        const p = s.get(id).find(n => vrstva.get(n.id) === v - 1);
        return p ? uhel.get(p.id) : 10;
      };
      ids.sort((a, b) => klic(a) - klic(b));
      const obvod = ids.reduce((sum, id) => sum + (geo.get(id) || { w: 120 }).w + 40, 0);
      const maxDim = Math.max(...ids.map(id => { const g = geo.get(id) || { w: 120, h: 40 }; return Math.max(g.w, g.h); }));
      r = Math.max(r + maxDim + 80, obvod / (2 * Math.PI), 200 * v);
      let a = -Math.PI / 2;
      for (const id of ids) {
        const w = (geo.get(id) || { w: 120 }).w + 40;
        const da = w / obvod * Math.PI * 2;
        const ua = a + da / 2;
        const u = najdiUzel(mapa, id);
        u.x = cx + Math.cos(ua) * r; u.y = cy + Math.sin(ua) * r;
        uhel.set(id, ua); a += da;
      }
    }
    stred.x = cx; stred.y = cy;
  }

  /* Časová osa: uzly s datem na ose x (pruhy podle typu), ostatní pod osou silově k sousedům. */
  function rozmistiCasove(mapa, geo) {
    const sDatem = mapa.uzly.filter(u => isFinite(rokZData(u.datum)));
    if (!sDatem.length) return false;
    sDatem.sort((a, b) => rokZData(a.datum) - rokZData(b.datum));
    const typy = [...new Set(sDatem.map(u => u.typ))];
    /* Čistě lineární osa by velké mezery (např. 60 let bez události) roztáhla a zbytek namačkala.
       Krok mezi sousedními daty je proto úměrný času, ale stlačený do 0–240 px
       (měřítko tak, aby medián kroku byl ~90 px); pořadí zůstává zachované. */
    const roky = sDatem.map(u => rokZData(u.datum));
    const kroky = [];
    for (let i = 1; i < roky.length; i++) if (roky[i] > roky[i - 1]) kroky.push(roky[i] - roky[i - 1]);
    kroky.sort((a, b) => a - b);
    const median = kroky.length ? kroky[kroky.length >> 1] : 1;
    const pxRok = 90 / median;
    const osa = [0];
    for (let i = 1; i < roky.length; i++) osa.push(osa[i - 1] + Math.min(240, (roky[i] - roky[i - 1]) * pxRok));
    const sirka = osa[osa.length - 1] || 900;
    /* pruhy podle typu; výška pruhu podle nejvyššího uzlu v něm (rozbalené uzly jsou vysoké) */
    const vysky = typy.map(t => Math.max(...sDatem.filter(u => u.typ === t).map(u => (geo.get(u.id) || { h: 40 }).h)));
    const yPruhu = [];
    let yy = 0;
    for (const v of vysky) { yPruhu.push(yy + v / 2); yy += v + 50; }
    const posledniX = new Map();
    for (let i = 0; i < sDatem.length; i++) {
      const u = sDatem[i];
      const g = geo.get(u.id) || { w: 150, h: 40 };
      const pruh = typy.indexOf(u.typ);
      let x = osa[i];
      const p = posledniX.get(pruh);
      if (p != null && x < p + 20) x = p + 20;
      u.x = x + g.w / 2; u.y = yPruhu[pruh];
      posledniX.set(pruh, x + g.w);
    }
    const yOsy = yy - 10;
    /* značky let na ose: u levého okraje uzlu, ne hustěji než 70 px */
    const znacky = [];
    for (const u of sDatem.slice().sort((a, b) => (a.x - (geo.get(a.id) || { w: 150 }).w / 2) - (b.x - (geo.get(b.id) || { w: 150 }).w / 2))) {
      const x = u.x - (geo.get(u.id) || { w: 150 }).w / 2;
      const popis = popisRoku(rokZData(u.datum));
      if (znacky.length && (x - znacky[znacky.length - 1].x < 70 || znacky[znacky.length - 1].popis === popis)) continue;
      znacky.push({ x, popis });
    }
    const ostatni = mapa.uzly.filter(u => !isFinite(rokZData(u.datum)));
    const yDole = yOsy + 110;
    const sMap = sousedstvi(mapa, false);
    const rnd = nahoda(3);
    ostatni.forEach((u, i) => {
      const sous = sMap.get(u.id).map(n => najdiUzel(mapa, n.id)).filter(n => isFinite(rokZData(n.datum)));
      u.x = sous.length ? sous.reduce((s, n) => s + n.x, 0) / sous.length : (i / Math.max(1, ostatni.length - 1)) * sirka;
      u.y = yDole + rnd() * 200;
    });
    const pevne = new Set(sDatem.map(u => u.id));
    const sim = silovaSimulace(mapa, geo, { pevne, teplota: 0.6 });
    const nahore = u => yDole - 40 + (geo.get(u.id) || { h: 40 }).h / 2;
    for (let i = 0; i < 250; i++) {
      sim.krok(1);
      for (const u of ostatni) if (u.y < nahore(u)) u.y = nahore(u);
    }
    odstranPrekryvy(mapa, geo, pevne);
    for (const u of ostatni) if (u.y < nahore(u)) u.y = nahore(u);
    odstranPrekryvy(mapa, geo, pevne);
    const x1 = Math.min(...sDatem.map(u => u.x - (geo.get(u.id) || { w: 150 }).w / 2));
    const x2 = Math.max(...sDatem.map(u => u.x + (geo.get(u.id) || { w: 150 }).w / 2));
    return { yOsy, x1, x2, znacky };
  }
  function popisRoku(r) {
    const c = Math.floor(r);
    return c < 0 ? (-c) + ' př. n. l.' : String(c);
  }

  function rozmistiMrizku(mapa, geo) {
    const N = mapa.uzly.slice().sort((a, b) => a.typ.localeCompare(b.typ) || a.nazev.localeCompare(b.nazev, 'cs'));
    const sl = Math.ceil(Math.sqrt(N.length * 1.6));
    const sw = Math.max(...N.map(u => (geo.get(u.id) || { w: 150 }).w), 100) + 50;
    const sh = Math.max(...N.map(u => (geo.get(u.id) || { h: 40 }).h), 30) + 50;
    N.forEach((u, i) => { u.x = (i % sl) * sw; u.y = Math.floor(i / sl) * sh; });
  }

  function obal(mapa, geo, ids) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const s = ids ? new Set(ids) : null;
    for (const u of mapa.uzly) {
      if (s && !s.has(u.id)) continue;
      const g = geo.get(u.id) || { w: 100, h: 40 };
      x1 = Math.min(x1, u.x - g.w / 2); y1 = Math.min(y1, u.y - g.h / 2);
      x2 = Math.max(x2, u.x + g.w / 2); y2 = Math.max(y2, u.y + g.h / 2);
    }
    if (!isFinite(x1)) return { x: -200, y: -150, w: 400, h: 300 };
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /* ---------- SVG ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function cestaTvaru(g, x, y) {
    const w = g.w, h = g.h;
    if (g.tvar === 'elipsa') return { el: 'ellipse', a: { cx: f(x + w / 2), cy: f(y + h / 2), rx: f(w / 2), ry: f(h / 2) } };
    const r = g.tvar === 'kapsle' ? Math.min(h / 2, 22) : g.tvar === 'ostry' ? 2 : 9;
    return { el: 'rect', a: { x: f(x), y: f(y), width: f(w), height: f(h), rx: f(r) } };
  }

  /* Samostatný SVG soubor celé mapy (nebo jen vybraných uzlů).
     volby: { barvy:{pozadi, panel, text, tlumeny, hrana, stitekPozadi, odkaz}, pismo, jen:[id…], legenda, nadpis,
              meritka: Map id → zvětšení, pomery: Map id → poměr obrázku, obrazky: Map url → data URL } */
  function exportSVG(mapa, mer, volby) {
    volby = volby || {};
    const b = Object.assign({ pozadi: '#ffffff', panel: '#ffffff', text: '#24292f', tlumeny: '#4b535b', hrana: '#6e7781', stitekPozadi: '#ffffff', odkaz: '#2862bb' }, volby.barvy || {});
    const pismo = volby.pismo || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const ids = volby.jen ? new Set(volby.jen) : null;
    const m = ids ? Object.assign({}, mapa, { uzly: mapa.uzly.filter(u => ids.has(u.id)), hrany: mapa.hrany.filter(h => ids.has(h.od) && ids.has(h.do)) }) : mapa;
    const st = statistika(m).stupne;
    const geo = new Map(m.uzly.map(u => [u.id, geometrieUzlu(m, u, mer, { stupen: st.get(u.id),
      meritko: volby.meritka ? volby.meritka.get(u.id) : 1, obrazekPomer: volby.pomery ? volby.pomery.get(u.id) : 0 })]));
    const vidi = new Set(m.uzly.map(u => u.id));
    const ramy = (m.skupiny || []).map(sk => ({ sk, r: obalSkupiny(m, geo, sk, vidi) })).filter(x => x.r);
    let ob = obal(m, geo);
    for (const { r } of ramy) {
      const x1 = Math.min(ob.x, r.x), y1 = Math.min(ob.y, r.y);
      ob = { x: x1, y: y1, w: Math.max(ob.x + ob.w, r.x + r.w) - x1, h: Math.max(ob.y + ob.h, r.y + r.h) - y1 };
    }
    const okraj = 40;
    const hlava = volby.nadpis !== false && m.nazev ? 34 : 0;
    const legenda = volby.legenda !== false;
    const X = ob.x - okraj, Y = ob.y - okraj - hlava, W = ob.w + 2 * okraj, H = ob.h + 2 * okraj + hlava + (legenda ? 10 : 0);
    const o = [];
    o.push('<?xml version="1.0" encoding="UTF-8"?>');
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [X, Y, W, H].map(f).join(' ') + '" width="' + Math.ceil(W) + '" height="' + Math.ceil(H) + '" font-family="' + esc(pismo) + '">');
    o.push('<title>' + esc(m.nazev) + '</title>');
    if (m.popis) o.push('<desc>' + esc(m.popis) + '</desc>');
    o.push('<rect x="' + f(X) + '" y="' + f(Y) + '" width="' + f(W) + '" height="' + f(H) + '" fill="' + b.pozadi + '"/>');
    if (hlava) o.push('<text x="' + f(X + okraj) + '" y="' + f(Y + okraj + 4) + '" font-size="20" font-weight="700" fill="' + b.text + '">' + esc(m.nazev) + '</text>');
    if (ramy.length) {
      o.push('<g class="skupiny">');
      for (const { sk, r } of ramy) {
        o.push('<rect x="' + f(r.x) + '" y="' + f(r.y) + '" width="' + f(r.w) + '" height="' + f(r.h) + '" rx="12" fill="' + sk.barva + '" fill-opacity="0.07" stroke="' + sk.barva + '" stroke-opacity="0.55" stroke-width="1.5" stroke-dasharray="6 4"/>');
        o.push('<text x="' + f(r.x + 12) + '" y="' + f(r.y + 17) + '" font-size="12.5" font-weight="700" fill="' + sk.barva + '">' + esc(sk.nazev) + '</text>');
      }
      o.push('</g>');
    }
    const gh = geometrieHran(m, geo);
    o.push('<g class="hrany">');
    for (const h of m.hrany) {
      const g = gh.get(h.id);
      if (!g || g.skryta) continue;
      const c = barvaHrany(m, h) || b.hrana;
      const dash = h.styl === 'carkovana' ? ' stroke-dasharray="8 5"' : h.styl === 'teckovana' ? ' stroke-dasharray="2 4" stroke-linecap="round"' : '';
      o.push('<path d="' + g.d + '" fill="none" stroke="' + c + '" stroke-width="' + (1 + h.sila * 0.6).toFixed(1) + '"' + dash + '/>');
      if (g.sipkaKonec) o.push('<path d="' + g.sipkaKonec + '" fill="' + c + '"/>');
      if (g.sipkaZacatek) o.push('<path d="' + g.sipkaZacatek + '" fill="' + c + '"/>');
    }
    for (const h of m.hrany) {
      const g = gh.get(h.id);
      const st = stitekHrany(m, h);
      if (!g || g.skryta || !st) continue;
      const w = mer(st, false) + 10;
      o.push('<rect x="' + f(g.lx - w / 2) + '" y="' + f(g.ly - 9) + '" width="' + f(w) + '" height="18" rx="4" fill="' + b.stitekPozadi + '" opacity="0.92"/>');
      o.push('<text x="' + f(g.lx) + '" y="' + f(g.ly + 4) + '" font-size="' + PISMO_MALE + '" text-anchor="middle" fill="' + b.tlumeny + '"' + (h.popis ? '' : ' font-style="italic"') + '>' + esc(st) + '</text>');
    }
    o.push('</g><g class="uzly">');
    for (const u of m.uzly) {
      const g = geo.get(u.id);
      const odkaz = u.odkaz && /^https?:\/\//i.test(u.odkaz);
      o.push('<g transform="translate(' + f(u.x - g.w / 2) + ' ' + f(u.y - g.h / 2) + ')' + (g.k !== 1 ? ' scale(' + g.k.toFixed(3) + ')' : '') + '">');
      if (odkaz) o.push('<a href="' + esc(u.odkaz) + '">');
      o.push(svgUzlu(m, u, g, b, volby.obrazky));
      if (odkaz) o.push('</a>');
      o.push('</g>');
    }
    o.push('</g>');
    if (legenda) {
      const pouzite = m.typy.filter(t => m.uzly.some(u => u.typ === t.id));
      const vztahy = (m.typyVztahu || []).filter(t => m.hrany.some(h => h.typ === t.id));
      let lx = X + okraj;
      const ly = Y + H - 16;
      for (const t of pouzite) {
        const s = (t.ikona ? t.ikona + ' ' : '') + t.nazev;
        o.push('<rect x="' + f(lx) + '" y="' + f(ly - 9) + '" width="10" height="10" rx="2" fill="' + t.barva + '"/>');
        o.push('<text x="' + f(lx + 15) + '" y="' + f(ly) + '" font-size="11" fill="' + b.tlumeny + '">' + esc(s) + '</text>');
        lx += 15 + mer(s, false) + 18;
      }
      for (const t of vztahy) {
        const c = t.barva || b.hrana;
        const dash = t.styl === 'carkovana' ? ' stroke-dasharray="6 4"' : t.styl === 'teckovana' ? ' stroke-dasharray="2 3"' : '';
        o.push('<line x1="' + f(lx) + '" y1="' + f(ly - 4) + '" x2="' + f(lx + 18) + '" y2="' + f(ly - 4) + '" stroke="' + c + '" stroke-width="2"' + dash + '/>');
        o.push('<text x="' + f(lx + 23) + '" y="' + f(ly) + '" font-size="11" fill="' + b.tlumeny + '">' + esc(t.nazev) + '</text>');
        lx += 23 + mer(t.nazev, false) + 18;
      }
    }
    o.push('</svg>');
    return o.join('\n');
  }

  const API = {
    FORMAT, VERZE, VYCHOZI_TYPY, VYCHOZI_TYPY_VZTAHU, BARVY_SKUPIN, TVARY, SMERY, STYLY, PAD, SKUPINA_HLAVA,
    novaMapa, typUzlu, typVztahu, stitekHrany, barvaHrany, skupinaUzlu, pridejSkupinu, vlozDoSkupiny, odeberZeSkupin,
    normalizujAtributy, jeObrazek, svgUzlu, obalSkupiny, pridejUzel, pridejHranu, najdiUzel, najdiHranu, odeberUzly, odeberHrany, sloucUzly,
    nactiData, naJSON, parsujText, naText,
    sousedstvi, okoli, nejkratsiCesta, statistika, hledej, bezDiakritiky, rokZData,
    zalom, geometrieUzlu, naOkraji, geometrieHran, cestaTvaru,
    silovaSimulace, rozmistiSilove, odstranPrekryvy, rozmistiKruhove, rozmistiCasove, rozmistiMrizku, obal,
    exportSVG, esc, nahoda
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.MapaJadro = API;
})();
