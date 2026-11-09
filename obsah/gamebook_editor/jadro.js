/* Editor gamebooků – logika bez DOM (test: node _test/gamebook_editor_test.js).
   Pracuje s příběhem v PŘESNĚ stejném formátu jako obsah/gamebook/pribeh*.js, který hraje
   engine obsah/gamebook/jadro.js (GamebookJadro). Obsah:
   - import: bezpečný parser JS literálu (soubor pribeh*.js se nespouští, jen čte) a JSON,
   - export: .js ve tvaru stávajících souborů (jde rovnou vložit do webu) a JSON,
   - graf: hrany voleb, kontroly (vlastní + validuj enginu), statistiky cest, simulace náhodných her,
   - rozložení grafu po vrstvách, přejmenování scén/předmětů/konců, historie zpět/znovu,
   - hraní na zkoušku od libovolné scény s ručně nastaveným stavem (přes engine). */
(function () {
  'use strict';

  const VLASTNOSTI = ['obratnost', 'zdravi', 'stesti', 'olej', 'zlato'];
  const IDENT = /^[A-Za-z_$][\w$]*$/;
  const kopie = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const seznam = x => [].concat(x == null ? [] : x);

  /* =========================================================
     Import – parser JS literálu (objekty, pole, řetězce, čísla, true/false/null, komentáře).
     Cokoli jiného (volání funkcí, proměnné) je chyba: soubor smí obsahovat jen data.
     ========================================================= */
  function parsujLiteral(src, start) {
    let i = start || 0;
    const n = src.length;
    const CISLO = /[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y;
    const SLOVO = /[A-Za-z_$][\w$]*/y;
    function chyba(m) {
      const r = src.slice(0, i).split('\n');
      throw new Error(m + ' (řádek ' + r.length + ', sloupec ' + (r[r.length - 1].length + 1) + ')');
    }
    function mezery() {
      for (;;) {
        const c = src[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\uFEFF' || c === '\u00A0' || c === '\u2028' || c === '\u2029') { i++; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { const k = src.indexOf('*/', i + 2); if (k < 0) chyba('Neukončený komentář'); i = k + 2; continue; }
        return;
      }
    }
    function retezec() {
      const q = src[i++];
      let s = '';
      while (i < n) {
        const c = src[i++];
        if (c === q) return s;
        if (q === '`' && c === '$' && src[i] === '{') chyba('Šablona s výrazem ${…} není dovolená');
        if (c === '\n' && q !== '`') chyba('Nový řádek uvnitř řetězce');
        if (c !== '\\') { s += c; continue; }
        const e = src[i++];
        if (e === 'n') s += '\n';
        else if (e === 't') s += '\t';
        else if (e === 'r') s += '\r';
        else if (e === 'b') s += '\b';
        else if (e === 'f') s += '\f';
        else if (e === 'v') s += '\v';
        else if (e === '0' && !/[0-9]/.test(src[i] || '')) s += '\0';
        else if (e === 'u') {
          if (src[i] === '{') { const k = src.indexOf('}', i); s += String.fromCodePoint(parseInt(src.slice(i + 1, k), 16)); i = k + 1; }
          else { const h = src.substr(i, 4); if (!/^[0-9a-fA-F]{4}$/.test(h)) chyba('Chybná sekvence \\u'); s += String.fromCharCode(parseInt(h, 16)); i += 4; }
        } else if (e === 'x') {
          const h = src.substr(i, 2); if (!/^[0-9a-fA-F]{2}$/.test(h)) chyba('Chybná sekvence \\x'); s += String.fromCharCode(parseInt(h, 16)); i += 2;
        } else if (e === '\r') { if (src[i] === '\n') i++; }
        else if (e === '\n' || e === '\u2028' || e === '\u2029') { /* pokračování řádku */ }
        else s += e;
      }
      chyba('Neukončený řetězec');
    }
    function klic() {
      const c = src[i];
      if (c === '"' || c === "'") return retezec();
      SLOVO.lastIndex = i; let m = SLOVO.exec(src);
      if (m) { i += m[0].length; return m[0]; }
      CISLO.lastIndex = i; m = CISLO.exec(src);
      if (m) { i += m[0].length; return String(Number(m[0])); }
      chyba('Očekávám klíč');
    }
    function objekt() {
      i++;
      const o = {};
      for (;;) {
        mezery();
        if (src[i] === '}') { i++; return o; }
        const k = klic();
        if (k === '__proto__') chyba('Klíč __proto__ není dovolený');
        mezery();
        if (src[i] !== ':') chyba('Očekávám „:“ za klíčem ' + k);
        i++;
        o[k] = hodnota();
        mezery();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return o; }
        chyba('Očekávám „,“ nebo „}“');
      }
    }
    function pole() {
      i++;
      const a = [];
      for (;;) {
        mezery();
        if (src[i] === ']') { i++; return a; }
        a.push(hodnota());
        mezery();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return a; }
        chyba('Očekávám „,“ nebo „]“');
      }
    }
    function hodnota() {
      mezery();
      const c = src[i];
      if (c === '{') return objekt();
      if (c === '[') return pole();
      if (c === '"' || c === "'" || c === '`') return retezec();
      CISLO.lastIndex = i; let m = CISLO.exec(src);
      if (m) { i += m[0].length; return Number(m[0]); }
      SLOVO.lastIndex = i; m = SLOVO.exec(src);
      if (m) {
        const w = m[0]; i += w.length;
        if (w === 'true') return true;
        if (w === 'false') return false;
        if (w === 'null') return null;
        if (w === 'undefined') return undefined;
        i -= w.length; chyba('Nepovolený výraz „' + w + '“ – soubor příběhu smí obsahovat jen data');
      }
      if (i >= n) chyba('Neočekávaný konec souboru');
      chyba('Neočekávaný znak „' + c + '“');
    }
    const hodn = hodnota();
    return { hodnota: hodn, konec: i };
  }

  /* Načte text souboru (pribeh*.js nebo JSON). Vrací {pribeh, hlavicka, globalni, format}. */
  function nactiSoubor(text) {
    const t = String(text).replace(/^\uFEFF/, '');
    const zac = t.trimStart();
    let pribeh, format, hlavicka = '', globalni = 'GAMEBOOK_PRIBEH';
    if (zac[0] === '{') {
      format = 'json';
      try { pribeh = JSON.parse(zac); } catch (e) { pribeh = parsujLiteral(zac, 0).hodnota; }
      if (pribeh && pribeh.pribeh && pribeh.pribeh.sceny && !pribeh.sceny) {   // obálka projektu z editoru
        hlavicka = pribeh.hlavicka || ''; globalni = pribeh.globalni || globalni; pribeh = pribeh.pribeh;
      }
    } else {
      format = 'js';
      const m = /(?:(?:const|let|var)\s+[A-Za-z_$][\w$]*|(?:window|globalThis|self)\.[A-Za-z_$][\w$]*|module\.exports)\s*=\s*\{/.exec(t);
      if (!m) throw new Error('V souboru jsem nenašel objekt příběhu (const PRIBEH = { … }).');
      pribeh = parsujLiteral(t, m.index + m[0].length - 1).hodnota;
      const h = /^\s*(\/\*[\s\S]*?\*\/)/.exec(t);
      if (h) hlavicka = h[1];
      const g = /window\.([A-Za-z_$][\w$]*)\s*=\s*PRIBEH/.exec(t) || /window\.([A-Za-z_$][\w$]*)\s*=/.exec(t);
      if (g) globalni = g[1];
    }
    const vada = kontrolaTvaru(pribeh);
    if (vada) throw new Error(vada);
    // engine i stránka gamebooku sahají na p.predmety[x] a p.konce[k] – bez nich by hra spadla
    if (!pribeh.predmety) pribeh.predmety = {};
    if (!pribeh.konce) pribeh.konce = {};
    return { pribeh, hlavicka, globalni, format };
  }

  /* Hrubá kontrola tvaru (aby editor nespadl na cizích datech). Vrací text chyby nebo ''. */
  function kontrolaTvaru(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Příběh musí být objekt.';
    if (!p.sceny || typeof p.sceny !== 'object' || Array.isArray(p.sceny)) return 'Příběh nemá objekt „sceny“.';
    for (const [id, s] of Object.entries(p.sceny)) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) return 'Scéna ' + id + ' není objekt.';
      if (s.volby != null && !Array.isArray(s.volby)) return 'Scéna ' + id + ': „volby“ musí být pole.';
      for (const v of s.volby || []) if (!v || typeof v !== 'object') return 'Scéna ' + id + ': volba není objekt.';
    }
    for (const k of ['predmety', 'konce']) if (p[k] != null && (typeof p[k] !== 'object' || Array.isArray(p[k]))) return '„' + k + '“ musí být objekt.';
    return '';
  }

  /* =========================================================
     Export – .js ve tvaru stávajících souborů a JSON
     ========================================================= */
  function str(s) {
    return "'" + String(s).replace(/[\\'\n\r\t\u2028\u2029]/g, c => ({ '\\': '\\\\', "'": "\\'", '\n': '\\n', '\r': '\\r', '\t': '\\t', '\u2028': '\\u2028', '\u2029': '\\u2029' })[c]) + "'";
  }
  const klicJs = k => IDENT.test(k) ? k : str(k);
  function lit(v) {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
    if (typeof v === 'object') {
      const k = Object.keys(v).filter(x => v[x] !== undefined);
      return k.length ? '{ ' + k.map(x => klicJs(x) + ': ' + lit(v[x])).join(', ') + ' }' : '{}';
    }
    if (typeof v === 'string') return str(v);
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
    if (typeof v === 'boolean') return String(v);
    return 'null';
  }
  function scenaJs(id, s, od) {
    const ks = Object.keys(s).filter(k => s[k] !== undefined);
    let r = od + str(id) + ': { ' + ks.filter(k => k !== 'volby' && k !== 'boj').map(k => klicJs(k) + ': ' + lit(s[k])).join(', ');
    const dalsi = () => (/\{ $/.test(r) ? '\n' : ',\n') + od + '  ';
    if (s.boj !== undefined) r += dalsi() + 'boj: ' + lit(s.boj);
    if (s.volby !== undefined) {
      r += dalsi() + 'volby: [';
      r += s.volby.length > 1 ? '\n' + s.volby.map(v => od + '    ' + lit(v)).join(',\n') + '\n' + od + '  ]' : s.volby.map(lit).join('') + ']';
    }
    return r + ' }';
  }
  function doJs(p, meta) {
    meta = meta || {};
    const o = '    ';
    const radky = [];
    for (const k of Object.keys(p)) {
      const v = p[k];
      if (v === undefined) continue;
      if ((k === 'predmety' || k === 'konce') && v && typeof v === 'object' && Object.keys(v).length) {
        radky.push(o + k + ': {\n' + Object.keys(v).map(x => o + '  ' + klicJs(x) + ': ' + lit(v[x])).join(',\n') + '\n' + o + '}');
      } else if (k === 'sceny') {
        const ids = Object.keys(v);
        radky.push(o + 'sceny: {' + (ids.length ? '\n' + ids.map(id => scenaJs(id, v[id], o + '  ')).join(',\n') + '\n' + o : '') + '}');
      } else radky.push(o + klicJs(k) + ': ' + lit(v));
    }
    const nazev = String(p.nazev || 'bez názvu').replace(/\*\//g, '* /');
    let hl = meta.hlavicka && /^\/\*[\s\S]*\*\/$/.test(meta.hlavicka.trim()) ? meta.hlavicka.trim() : '';
    if (!hl) hl = '/* Gamebook „' + nazev + '“ – data příběhu (vytvořeno v Editoru gamebooků).\n   Stejný formát jako pribeh.js: sceny {text, obr, efekty, volby [{text, cil | zkouska | boj, pokud, efekty}], boj, konec}. */';
    const g = IDENT.test(meta.globalni || '') ? meta.globalni : 'GAMEBOOK_PRIBEH';
    return hl + "\n(function () {\n  'use strict';\n  const PRIBEH = {\n" + radky.join(',\n') +
      "\n  };\n  if (typeof module !== 'undefined') module.exports = PRIBEH; else window." + g + ' = PRIBEH;\n})();\n';
  }
  const doJson = p => JSON.stringify(p, null, 2) + '\n';

  /* =========================================================
     Graf
     ========================================================= */
  /* Všechny hrany příběhu: {z, do, druh: cil|uspech|neuspech|vyhra|prohra|utek, volba: index (−1 = boj při vstupu), podm}.
     Pořadí jako v enginu: zkouška má přednost před soubojem a ten před cílem. */
  function hrany(p) {
    const out = [];
    for (const [id, s] of Object.entries(p.sceny || {})) {
      (s.volby || []).forEach((v, i) => {
        const podm = !!(v.pokud && Object.keys(v.pokud).length);
        const pr = (druh, c) => { if (c != null && c !== '') out.push({ z: id, do: String(c), druh, volba: i, podm }); };
        if (v.zkouska) { pr('uspech', v.zkouska.uspech); pr('neuspech', v.zkouska.neuspech); }
        else if (v.boj) { pr('vyhra', v.boj.vyhra); pr('prohra', v.boj.prohra); pr('utek', v.boj.utek); }
        else pr('cil', v.cil);
      });
      if (s.boj) for (const d of ['vyhra', 'prohra', 'utek']) if (s.boj[d] != null && s.boj[d] !== '') out.push({ z: id, do: String(s.boj[d]), druh: d, volba: -1, podm: false });
    }
    return out;
  }
  function sousede(p) {
    const ven = {}, dovnitr = {};
    for (const id of Object.keys(p.sceny || {})) { ven[id] = []; dovnitr[id] = []; }
    for (const h of hrany(p)) {
      if (!p.sceny[h.do]) continue;
      if (!ven[h.z].includes(h.do)) ven[h.z].push(h.do);
      if (!dovnitr[h.do].includes(h.z)) dovnitr[h.do].push(h.z);
    }
    return { ven, dovnitr };
  }
  function dosazitelne(p, od) {
    const { ven } = sousede(p);
    const vid = new Set();
    const f = [].concat(od).filter(x => p.sceny[x]);
    f.forEach(x => vid.add(x));
    while (f.length) for (const c of ven[f.shift()]) if (!vid.has(c)) { vid.add(c); f.push(c); }
    return vid;
  }
  /* Tarjan – silně souvislé komponenty. */
  function komponenty(ids, ven) {
    let index = 0;
    const idx = {}, low = {}, naZas = new Set(), zas = [], out = [];
    function spoj(v) {
      idx[v] = low[v] = index++; zas.push(v); naZas.add(v);
      for (const w of ven[v]) {
        if (idx[w] == null) { spoj(w); low[v] = Math.min(low[v], low[w]); }
        else if (naZas.has(w)) low[v] = Math.min(low[v], idx[w]);
      }
      if (low[v] === idx[v]) {
        const k = [];
        let w;
        do { w = zas.pop(); naZas.delete(w); k.push(w); } while (w !== v);
        out.push(k);
      }
    }
    for (const id of ids) if (idx[id] == null) spoj(id);
    return out;
  }

  /* Popis volby pro hlášení: „volba 2 „Jít dál““. */
  function popisVolby(s, i) {
    if (i < 0) return 'souboj při vstupu';
    const v = (s.volby || [])[i] || {};
    const t = String(v.text || '').trim();
    return 'volba ' + (i + 1) + (t ? ' „' + (t.length > 40 ? t.slice(0, 39) + '…' : t) + '“' : '');
  }

  /* Atomy podmínky: [[atom, chci]] – atom 'p:x' = má předmět x, 'f:x' = má příznak x. */
  function atomyPodminky(pk) {
    pk = pk || {};
    return [].concat(
      seznam(pk.ma).map(x => ['p:' + x, true]), seznam(pk.nema).map(x => ['p:' + x, false]),
      seznam(pk.priznak).map(x => ['f:' + x, true]), seznam(pk.bez).map(x => ['f:' + x, false]));
  }
  const ziskyEf = e => e ? seznam(e.predmet).map(x => 'p:' + x).concat(seznam(e.priznak).map(x => 'f:' + x)) : [];
  const ztratyEf = e => e ? seznam(e.odeber).map(x => 'p:' + x) : [];

  /* Co hráč při příchodu do scény MŮŽE mít (moze) a co MÁ JISTĚ (jiste) – toková analýza po hranách grafu.
     Projde se jen dosažitelná část; při průchodu volbou s podmínkou platí, že podmínka byla splněná
     (volba „nema X“ vede jen bez X, „ma X“ jen s X). Příznaky engine nikdy neodebírá; předmět, který jde
     ztratit (odeber, spotřební), se do „jistě“ nepočítá. Vrací {moze: {id: Set}, jiste: {id: Set}}. */
  function stavyScen(p) {
    const sc = p.sceny || {}, pred = p.predmety || {};
    const odebiratelne = new Set();
    for (const [k, d] of Object.entries(pred)) if (d && d.spotrebni) odebiratelne.add('p:' + k);
    for (const s of Object.values(sc)) {
      ztratyEf(s.efekty).forEach(a => odebiratelne.add(a));
      for (const v of s.volby || []) ztratyEf(v.efekty).forEach(a => odebiratelne.add(a));
    }
    for (const d of Object.values(pred)) if (d && d.pouziti) ztratyEf(d.pouziti).forEach(a => odebiratelne.add(a));
    // co může přinést použití předmětu z torby (kdykoli, když ho hráč má)
    const zPouziti = Object.entries(pred).filter(([, d]) => d && d.pouziti).map(([k, d]) => ['p:' + k, ziskyEf(d.pouziti)]);
    const uzaver = m => { let zmena = true; while (zmena) { zmena = false; for (const [k, z] of zPouziti) if (m.has(k)) for (const a of z) if (!m.has(a)) { m.add(a); zmena = true; } } return m; };
    const moze = {}, jiste = {};
    if (!sc[p.start]) return { moze, jiste };
    const zac = seznam((p.zacatek || {}).predmety).map(x => 'p:' + x);
    moze[p.start] = uzaver(new Set(zac));
    jiste[p.start] = new Set(zac.filter(a => !odebiratelne.has(a)));
    const fronta = [p.start], ve = new Set(fronta);
    let kroku = 0;
    while (fronta.length && kroku++ < 200000) {
      const id = fronta.shift(); ve.delete(id);
      const s = sc[id];
      if (!s || s.konec != null) continue;
      const mVstup = new Set([...moze[id], ...ziskyEf(s.efekty)]);
      const jVstup = new Set([...jiste[id], ...ziskyEf(s.efekty).filter(a => !odebiratelne.has(a))]);
      const prechody = [];
      (s.volby || []).forEach(v => {
        const at = atomyPodminky(v.pokud);
        const m = new Set(mVstup), j = new Set(jVstup);
        for (const [a, chci] of at) { if (chci) { m.add(a); if (!odebiratelne.has(a)) j.add(a); } else { m.delete(a); j.delete(a); } }
        ziskyEf(v.efekty).forEach(a => { m.add(a); if (!odebiratelne.has(a)) j.add(a); });
        const cile = v.zkouska ? [v.zkouska.uspech, v.zkouska.neuspech] : v.boj ? [v.boj.vyhra, v.boj.prohra, v.boj.utek] : [v.cil];
        prechody.push([cile, m, j]);
      });
      if (s.boj) prechody.push([[s.boj.vyhra, s.boj.prohra, s.boj.utek], mVstup, jVstup]);
      for (const [cile, m, j] of prechody) for (const c of cile) {
        if (c == null || c === '' || !sc[c]) continue;
        let zmena = false;
        if (!moze[c]) { moze[c] = uzaver(new Set(m)); jiste[c] = new Set(j); zmena = true; }
        else {
          const n = moze[c].size;
          m.forEach(a => moze[c].add(a)); uzaver(moze[c]);
          if (moze[c].size !== n) zmena = true;
          for (const a of [...jiste[c]]) if (!j.has(a)) { jiste[c].delete(a); zmena = true; }
        }
        if (zmena && !ve.has(c)) { ve.add(c); fronta.push(c); }
      }
    }
    return { moze, jiste };
  }

  /* Může volba vůbec někdy být dostupná? Vrací důvod, proč ne, nebo ''. */
  function nikdyDostupna(v, moze, jiste) {
    for (const [a, chci] of atomyPodminky(v.pokud)) {
      const druh = a[0] === 'p' ? 'předmět' : 'příznak', x = a.slice(2);
      if (chci && !moze.has(a)) return druh + ' „' + x + '“ tu hráč mít nemůže';
      if (!chci && jiste.has(a)) return druh + ' „' + x + '“ tu hráč má vždy';
    }
    return '';
  }

  /* Pokrývají podmínky voleb všechny stavy, ve kterých sem hráč může přijít? Projde všechna ohodnocení
     předmětů a příznaků z podmínek (do 12 volných proměnných); atomy, které tu hráč mít nemůže / má jistě,
     jsou pevné. Volba s podmínkou na zlato se počítá jako nejistá. */
  function pokryto(volby, moze, jiste) {
    const atomy = [];
    const pravidla = [];
    for (const v of volby) {
      const pk = v.pokud || {};
      if (pk.zlato != null) continue;
      const r = [];
      let mozna = true;
      for (const [a, chci] of atomyPodminky(pk)) {
        if (moze && !moze.has(a)) { if (chci) mozna = false; continue; }
        if (jiste && jiste.has(a)) { if (!chci) mozna = false; continue; }
        if (!atomy.includes(a)) atomy.push(a);
        r.push([atomy.indexOf(a), chci]);
      }
      if (mozna) pravidla.push(r);
    }
    if (!pravidla.length || atomy.length > 12) return false;
    for (let m = 0; m < (1 << atomy.length); m++) {
      if (!pravidla.some(r => r.every(([k, chci]) => !!(m & (1 << k)) === chci))) return false;
    }
    return true;
  }

  /* Úplná kontrola: {vlastni: [{uroven: chyba|varovani|info, typ, scena, text}], engine: [{scena, text}]} */
  function analyzuj(p, J) {
    const nal = [];
    const pridej = (uroven, typ, scena, text) => nal.push({ uroven, typ, scena: scena == null ? null : scena, text });
    const sc = p.sceny || {};
    const ids = Object.keys(sc);
    const H = hrany(p);
    const predmety = p.predmety || {}, konce = p.konce || {};

    for (const k of ['start', 'smrt', 'tma']) {
      if (p[k] == null || p[k] === '') pridej('chyba', 'povinne', null, 'Chybí povinná položka „' + k + '“ (id scény).');
      else if (!sc[p[k]]) pridej('chyba', 'odkaz', null, '„' + k + '“ odkazuje na neexistující scénu „' + p[k] + '“.');
    }
    for (const h of H) if (!sc[h.do]) pridej('chyba', 'odkaz', h.z, popisVolby(sc[h.z], h.volba) + ' vede na neexistující scénu „' + h.do + '“.');

    for (const id of ids) {
      const s = sc[id];
      if (!String(s.text || '').trim()) pridej('chyba', 'text', id, 'Scéna nemá text.');
      if (s.konec != null && !konce[s.konec]) pridej('chyba', 'konec', id, 'Neznámý typ konce „' + s.konec + '“.');
      if (s.konec != null && ((s.volby || []).length || s.boj)) pridej('varovani', 'konec', id, 'Koncová scéna má volby nebo souboj – engine je ignoruje.');
      if (s.boj && (s.volby || []).length) pridej('varovani', 'boj', id, 'Scéna má souboj při vstupu i volby – během souboje se volby nenabízejí, po něm se odchází cílem souboje.');
      const boje = [];
      if (s.boj) boje.push([s.boj, 'souboj při vstupu']);
      (s.volby || []).forEach((v, i) => {
        const pv = popisVolby(s, i);
        if (!String(v.text || '').trim()) pridej('varovani', 'volba', id, pv + ' nemá text.');
        if (v.zkouska) {
          if (!VLASTNOSTI.includes(v.zkouska.co)) pridej('chyba', 'zkouska', id, pv + ': zkouška neznámé vlastnosti „' + v.zkouska.co + '“.');
          if (!v.zkouska.uspech || !v.zkouska.neuspech) pridej('chyba', 'zkouska', id, pv + ': zkouška musí mít cíl při úspěchu i neúspěchu.');
          if (v.cil || v.boj) pridej('varovani', 'volba', id, pv + ': má zkoušku i jiný cíl – engine použije jen zkoušku.');
        } else if (v.boj) {
          boje.push([v.boj, pv]);
          if (v.cil) pridej('varovani', 'volba', id, pv + ': má souboj i cíl – engine použije jen souboj.');
        } else if (v.cil == null || v.cil === '') pridej('chyba', 'volba', id, pv + ' nikam nevede.');
        const pk = v.pokud || {};
        if (pk.zlato != null && !Number.isFinite(pk.zlato)) pridej('chyba', 'podminka', id, pv + ': podmínka zlata musí být číslo.');
      });
      for (const [b, kde] of boje) {
        if (!b.vyhra) pridej('chyba', 'boj', id, kde + ': souboj nemá cíl při výhře.');
        if (!Number.isFinite(b.obratnost) || !Number.isFinite(b.zdravi) || b.zdravi <= 0) pridej('chyba', 'boj', id, kde + ': soupeř musí mít obratnost a kladné zdraví.');
        if (!String(b.jmeno || '').trim()) pridej('varovani', 'boj', id, kde + ': soupeř nemá jméno.');
      }
    }

    /* dosažitelnost a cesty ke konci */
    const { ven, dovnitr } = sousede(p);
    const dos = dosazitelne(p, p.start);
    const stavy = stavyScen(p);
    for (const id of ids) if (!dos.has(id) && id !== p.smrt && id !== p.tma) pridej('chyba', 'nedosazitelna', id, 'Scéna je nedosažitelná ze startu.');
    for (const id of ids) {
      const s = sc[id];
      if (s.konec == null && !H.some(h => h.z === id)) pridej('chyba', 'slepa', id, 'Slepá ulička: scéna není konec a nevede z ní žádná volba.');
      else if (s.konec == null && !s.boj && (s.volby || []).length && s.volby.every(v => v.pokud && Object.keys(v.pokud).length) && dos.has(id) &&
        !pokryto(s.volby, stavy.moze[id], stavy.jiste[id]))
        pridej('varovani', 'podminene', id, 'Všechny volby mají podmínku – když žádná neplatí, hráč uvízne.');
      if (s.konec == null && stavy.moze[id]) (s.volby || []).forEach((v, i) => {
        const proc = nikdyDostupna(v, stavy.moze[id], stavy.jiste[id]);
        if (proc) pridej('varovani', 'nikdy', id, popisVolby(s, i) + ' se nikdy nenabídne: ' + proc + '.');
      });
    }
    // zpětné BFS od konců: scény, ze kterých nevede cesta k žádnému konci
    const kKonci = new Set(ids.filter(id => sc[id].konec != null));
    const f = [...kKonci];
    while (f.length) for (const z of dovnitr[f.shift()]) if (!kKonci.has(z)) { kKonci.add(z); f.push(z); }
    const bezKonce = ids.filter(id => dos.has(id) && !kKonci.has(id));
    const vSmycce = new Set();
    for (const k of komponenty(ids, ven)) {
      const smycka = k.length > 1 || ven[k[0]].includes(k[0]);
      if (!smycka) continue;
      const mnoz = new Set(k);
      const vychod = k.some(id => sc[id].konec != null || ven[id].some(c => !mnoz.has(c)) || H.some(h => h.z === id && !sc[h.do]));
      if (!vychod) {
        k.forEach(x => vSmycce.add(x));
        const poradi = k.slice().reverse();
        pridej('chyba', 'smycka', poradi[0], 'Smyčka bez východu: ' + poradi.join(' → ') + ' → ' + poradi[0] + ' (z kruhu nevede cesta ven ani ke konci).');
      }
    }
    for (const id of bezKonce) if (!vSmycce.has(id) && sc[id].konec == null && H.some(h => h.z === id)) pridej('varovani', 'bezkonce', id, 'Z této scény nevede žádná cesta k žádnému konci.');

    /* předměty a příznaky: co je potřeba a co se dá získat (jen v dosažitelných scénách) */
    const ziskP = new Set(seznam((p.zacatek || {}).predmety)), ziskF = new Set();
    const potrP = {}, potrF = {}, bezF = {};
    const vsechnyRef = new Set();
    const ef = (e) => { if (!e) return; seznam(e.predmet).forEach(x => ziskP.add(x)); seznam(e.priznak).forEach(x => ziskF.add(x)); };
    const zaznam = (m, x, id) => { (m[x] = m[x] || []).includes(id) || m[x].push(id); };
    for (const id of ids) {
      const s = sc[id];
      const ref = e => { if (e) seznam(e.predmet).concat(seznam(e.odeber)).forEach(x => vsechnyRef.add(x)); };
      ref(s.efekty);
      if (dos.has(id) || id === p.smrt || id === p.tma) ef(s.efekty);
      for (const v of s.volby || []) {
        ref(v.efekty);
        if (dos.has(id)) ef(v.efekty);
        const pk = v.pokud || {};
        seznam(pk.ma).forEach(x => { zaznam(potrP, x, id); vsechnyRef.add(x); });
        seznam(pk.nema).forEach(x => vsechnyRef.add(x));
        seznam(pk.priznak).forEach(x => zaznam(potrF, x, id));
        seznam(pk.bez).forEach(x => zaznam(bezF, x, id));
      }
    }
    for (const d of Object.values(predmety)) if (d && d.pouziti) ef({ priznak: d.pouziti.priznak, predmet: d.pouziti.predmet });
    for (const [x, kde] of Object.entries(potrP)) if (!ziskP.has(x)) pridej('chyba', 'predmet', kde[0], 'Předmět „' + x + '“ je potřeba (scéna ' + kde.join(', ') + '), ale nikde se nedá získat.');
    for (const [x, kde] of Object.entries(potrF)) if (!ziskF.has(x)) pridej('chyba', 'priznak', kde[0], 'Příznak „' + x + '“ je podmínkou (scéna ' + kde.join(', ') + '), ale nikde se nenastavuje.');
    for (const [x, kde] of Object.entries(bezF)) if (!ziskF.has(x)) pridej('info', 'priznak', kde[0], 'Podmínka „bez příznaku ' + x + '“ platí vždy – příznak se nikde nenastavuje.');
    for (const x of new Set([...vsechnyRef, ...seznam((p.zacatek || {}).predmety)])) if (!predmety[x]) pridej('chyba', 'predmet', null, 'Neznámý předmět „' + x + '“ – chybí v seznamu předmětů.');
    if (p.svetlo != null) {
      if (!predmety[p.svetlo]) pridej('chyba', 'predmet', null, 'Předmět světla „' + p.svetlo + '“ neexistuje.');
      else if (!ziskP.has(p.svetlo)) pridej('varovani', 'predmet', null, 'Předmět světla „' + p.svetlo + '“ se nedá získat.');
    }
    for (const x of Object.keys(predmety)) if (!ziskP.has(x)) pridej('info', 'predmet', null, 'Předmět „' + x + '“ je definovaný, ale hráč ho nikdy nezíská.');
    const pouzKonce = new Set(ids.map(id => sc[id].konec).filter(x => x != null));
    for (const k of Object.keys(konce)) if (!pouzKonce.has(k)) pridej('info', 'konec', null, 'Typ konce „' + k + '“ nemá žádnou scénu.');
    for (const [k, d] of Object.entries(konce)) if (d && !['vyhra', 'prohra', 'neutral'].includes(d.typ)) pridej('varovani', 'konec', null, 'Typ konce „' + k + '“ má neznámou kategorii „' + d.typ + '“ (vyhra / prohra / neutral).');

    /* engine */
    const engine = [];
    if (J && J.validuj) {
      try {
        for (const t of J.validuj(p)) {
          const m = /^(.+?)(?: → |: )/.exec(t);
          engine.push({ scena: m && sc[m[1]] ? m[1] : null, text: t });
        }
      } catch (e) { engine.push({ scena: null, text: 'validuj selhal: ' + e.message }); }
    }
    const poradi = { chyba: 0, varovani: 1, info: 2 };
    nal.sort((a, b) => poradi[a.uroven] - poradi[b.uroven]);
    return { vlastni: nal, engine };
  }

  /* =========================================================
     Statistiky
     ========================================================= */
  function statistiky(p) {
    const sc = p.sceny || {};
    const ids = Object.keys(sc);
    const H = hrany(p);
    const { ven } = sousede(p);
    const konce = p.konce || {};
    const st = { scen: ids.length, koncu: 0, konceTyp: { vyhra: 0, prohra: 0, neutral: 0 }, voleb: 0, zkousek: 0, soubojuu: 0, podminenych: 0,
      predmetu: Object.keys(p.predmety || {}).length, slov: 0, dosazitelnych: 0, prumernaCesta: null, nejkratsiVyhra: null, nejdelsiCesta: null };
    for (const id of ids) {
      const s = sc[id];
      st.slov += (String(s.text || '').match(/\S+/g) || []).length;
      if (s.konec != null) { st.koncu++; const t = (konce[s.konec] || {}).typ; if (st.konceTyp[t] != null) st.konceTyp[t]++; }
      if (s.boj) st.soubojuu++;
      for (const v of s.volby || []) {
        st.voleb++;
        if (v.zkouska) st.zkousek++;
        if (v.boj) st.soubojuu++;
        if (v.pokud && Object.keys(v.pokud).length) st.podminenych++;
      }
    }
    if (!sc[p.start]) return st;
    // nejkratší vzdálenosti ze startu (BFS)
    const dist = { [p.start]: 0 }, f = [p.start];
    while (f.length) { const a = f.shift(); for (const c of ven[a]) if (dist[c] == null) { dist[c] = dist[a] + 1; f.push(c); } }
    st.dosazitelnych = Object.keys(dist).length;
    const konceD = Object.keys(dist).filter(id => sc[id].konec != null);
    if (konceD.length) st.prumernaCesta = konceD.reduce((a, id) => a + dist[id], 0) / konceD.length;
    const vyhry = konceD.filter(id => (konce[sc[id].konec] || {}).typ === 'vyhra');
    if (vyhry.length) { const id = vyhry.reduce((a, b) => dist[a] <= dist[b] ? a : b); st.nejkratsiVyhra = { delka: dist[id], cil: id }; }
    // nejdelší cesta bez opakování scén: DFS označí zpětné hrany (smyčky), na zbylém DAG nejdelší cesta ke konci
    const barva = {}, zpet = new Set();
    const zas = [[p.start, 0]]; barva[p.start] = 1;
    while (zas.length) {
      const top = zas[zas.length - 1];
      const [v, i] = top;
      if (i < ven[v].length) {
        top[1]++;
        const w = ven[v][i];
        if (!barva[w]) { barva[w] = 1; zas.push([w, 0]); }
        else if (barva[w] === 1) zpet.add(v + '\u0000' + w);
      } else { barva[v] = 2; zas.pop(); }
    }
    const memo = {};
    const nejdal = v => {
      if (memo[v] !== undefined) return memo[v];
      memo[v] = null;
      let best = sc[v].konec != null ? { d: 0, dalsi: null } : null;
      for (const w of ven[v]) {
        if (zpet.has(v + '\u0000' + w)) continue;
        const r = nejdal(w);
        if (r && (!best || r.d + 1 > best.d)) best = { d: r.d + 1, dalsi: w };
      }
      return (memo[v] = best);
    };
    const r = nejdal(p.start);
    if (r) {
      const cesta = [p.start];
      let v = p.start;
      while (memo[v] && memo[v].dalsi) { v = memo[v].dalsi; cesta.push(v); }
      st.nejdelsiCesta = { delka: r.d, cesta };
    }
    st.hran = H.length;
    return st;
  }

  /* Simulace náhodných her přes engine: rozložení konců, uvíznutí, délka hry. */
  function simuluj(p, J, nast) {
    nast = Object.assign({ her: 200, seed: 1, maxTahu: 400 }, nast);
    let r = nast.seed >>> 0 || 1;
    const nah = () => { r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x6D2B79F5) >>> 0; r ^= r << 13; r >>>= 0; r ^= r >>> 17; r ^= r << 5; r >>>= 0; return r / 4294967296; };
    const vysl = { her: 0, konce: {}, uvizl: {}, zacykleni: 0, chyby: {}, tahu: 0 };
    for (let k = 0; k < nast.her; k++) {
      vysl.her++;
      let st;
      try {
        st = J.novaHra(p, (nast.seed * 7919 + k) | 0);
        let kroky = 0;
        while (!st.konec && kroky++ < nast.maxTahu) {
          if (st.boj) { J.koloBoje(st, p); continue; }
          const lek = st.predmety.find(x => (p.predmety[x] || {}).pouziti && (p.predmety[x].pouziti.zdravi > 0) && st.zdravi <= 6);
          if (lek) J.pouzij(st, p, lek);
          const mozne = J.volby(st, p);
          if (!mozne.length) { vysl.uvizl[st.scena] = (vysl.uvizl[st.scena] || 0) + 1; break; }
          J.zvol(st, p, mozne[Math.floor(nah() * mozne.length)].i);
        }
        if (st.konec) { vysl.konce[st.konec] = (vysl.konce[st.konec] || 0) + 1; vysl.tahu += st.tahy; }
        else if (kroky > nast.maxTahu) vysl.zacykleni++;
      } catch (e) {
        const m = String(e.message);
        vysl.chyby[m] = (vysl.chyby[m] || 0) + 1;
      }
    }
    const dohrane = Object.values(vysl.konce).reduce((a, b) => a + b, 0);
    vysl.prumerTahu = dohrane ? vysl.tahu / dohrane : null;
    return vysl;
  }

  /* =========================================================
     Rozložení grafu po vrstvách (Sugiyama zjednodušeně)
     ========================================================= */
  function rozloz(p, nast) {
    nast = Object.assign({ smer: 'dolu', sirka: 168, vyska: 58, mezX: 34, mezY: 64 }, nast);
    const sc = p.sceny || {};
    const ids = Object.keys(sc);
    const { ven, dovnitr } = sousede(p);
    // DFS ze startu, pak ze zbylých kořenů – zpětné hrany a pořadí objevení
    const barva = {}, zpet = new Set(), objev = [], post = [];
    const koreny = [];
    if (sc[p.start]) koreny.push(p.start);
    ids.forEach(id => { if (!dovnitr[id].length && id !== p.start && sc[id].konec == null) koreny.push(id); });
    ids.forEach(id => koreny.push(id));
    for (const k of koreny) {
      if (barva[k]) continue;
      const zas = [[k, 0]]; barva[k] = 1; objev.push(k);
      while (zas.length) {
        const top = zas[zas.length - 1];
        const v = top[0];
        if (top[1] < ven[v].length) {
          const w = ven[v][top[1]++];
          if (!barva[w]) { barva[w] = 1; objev.push(w); zas.push([w, 0]); }
          else if (barva[w] === 1) zpet.add(v + '\u0000' + w);
        } else { barva[v] = 2; post.push(v); zas.pop(); }
      }
    }
    const dopredu = v => ven[v].filter(w => !zpet.has(v + '\u0000' + w));
    // vrstva = nejdelší cesta od kořene v DAG (topologicky = obrácené post-pořadí)
    const vrstva = {};
    ids.forEach(id => { vrstva[id] = 0; });
    for (const v of post.slice().reverse()) for (const w of dopredu(v)) vrstva[w] = Math.max(vrstva[w], vrstva[v] + 1);
    // konce bez příchozích hran (smrt/tma) na poslední vrstvu
    let maxV = Math.max(0, ...ids.map(id => vrstva[id]));
    ids.forEach(id => { if (!dovnitr[id].length && id !== p.start && sc[id].konec != null) vrstva[id] = maxV; });
    maxV = Math.max(0, ...ids.map(id => vrstva[id]));
    const vrstvy = Array.from({ length: maxV + 1 }, () => []);
    objev.forEach(id => vrstvy[vrstva[id]].push(id));
    // barycentrické přeskupení (omezí křížení)
    const poz = {};
    const preindex = () => vrstvy.forEach(L => L.forEach((id, i) => { poz[id] = i - (L.length - 1) / 2; }));
    preindex();
    const bary = (L, sous) => {
      const b = {};
      L.forEach(id => { const s = sous(id); b[id] = s.length ? s.reduce((a, x) => a + poz[x], 0) / s.length : poz[id]; });
      L.sort((a, c) => b[a] - b[c]);
      L.forEach((id, i) => { poz[id] = i - (L.length - 1) / 2; });
    };
    for (let it = 0; it < 8; it++) {
      for (let l = 1; l <= maxV; l++) bary(vrstvy[l], id => dovnitr[id].filter(x => vrstva[x] < l));
      for (let l = maxV - 1; l >= 0; l--) bary(vrstvy[l], id => ven[id].filter(x => vrstva[x] > l));
    }
    const out = {};
    const krokX = nast.sirka + nast.mezX, krokY = nast.vyska + nast.mezY;
    vrstvy.forEach((L, l) => L.forEach(id => {
      const a = Math.round(poz[id] * krokX), b = l * krokY;
      out[id] = nast.smer === 'vpravo' ? { x: Math.round(l * (nast.sirka + nast.mezY)), y: Math.round(poz[id] * (nast.vyska + nast.mezX)) } : { x: a, y: b };
    }));
    return out;
  }

  /* =========================================================
     Úpravy příběhu
     ========================================================= */
  function noveId(p) {
    const ids = Object.keys(p.sceny || {});
    const cisla = ids.map(Number).filter(Number.isInteger);
    let n = cisla.length ? Math.max(...cisla) + 1 : 1;
    while (p.sceny[String(n)]) n++;
    return String(n);
  }
  /* Odkazy na scénu: [{scena, kde}] */
  function odkazyNa(p, cil) {
    const out = hrany(p).filter(h => h.do === cil).map(h => ({ scena: h.z, kde: popisVolby(p.sceny[h.z], h.volba) }));
    for (const k of ['start', 'smrt', 'tma']) if (p[k] === cil) out.push({ scena: null, kde: k });
    return out;
  }
  function prejmenujScenu(p, stare, nove) {
    nove = String(nove).trim();
    if (!p.sceny[stare]) throw new Error('Scéna ' + stare + ' neexistuje.');
    if (!nove) throw new Error('Prázdné id.');
    if (stare === nove) return 0;
    if (p.sceny[nove]) throw new Error('Scéna ' + nove + ' už existuje.');
    const nova = {};
    for (const k of Object.keys(p.sceny)) nova[k === stare ? nove : k] = p.sceny[k];
    p.sceny = nova;
    let n = 0;
    const zmen = (o, k) => { if (o && o[k] === stare) { o[k] = nove; n++; } };
    for (const s of Object.values(p.sceny)) {
      for (const v of s.volby || []) { zmen(v, 'cil'); if (v.zkouska) { zmen(v.zkouska, 'uspech'); zmen(v.zkouska, 'neuspech'); } if (v.boj) ['vyhra', 'prohra', 'utek'].forEach(k => zmen(v.boj, k)); }
      if (s.boj) ['vyhra', 'prohra', 'utek'].forEach(k => zmen(s.boj, k));
    }
    ['start', 'smrt', 'tma'].forEach(k => zmen(p, k));
    return n;
  }
  /* Přejmenuje předmět všude (podmínky, efekty, začátek, světlo). */
  function prejmenujPredmet(p, stary, novy) {
    if (!p.predmety || !p.predmety[stary]) throw new Error('Předmět ' + stary + ' neexistuje.');
    if (p.predmety[novy]) throw new Error('Předmět ' + novy + ' už existuje.');
    const nove = {};
    for (const k of Object.keys(p.predmety)) nove[k === stary ? novy : k] = p.predmety[k];
    p.predmety = nove;
    let n = 0;
    const zmen = (o, k) => {
      if (!o || o[k] == null) return;
      if (Array.isArray(o[k])) o[k] = o[k].map(x => x === stary ? (n++, novy) : x);
      else if (o[k] === stary) { o[k] = novy; n++; }
    };
    const ef = e => { zmen(e, 'predmet'); zmen(e, 'odeber'); };
    for (const s of Object.values(p.sceny)) {
      ef(s.efekty);
      for (const v of s.volby || []) { ef(v.efekty); zmen(v.pokud, 'ma'); zmen(v.pokud, 'nema'); }
    }
    zmen(p.zacatek, 'predmety');
    zmen(p, 'svetlo');
    for (const d of Object.values(p.predmety)) ef(d.pouziti);
    return n;
  }
  function prejmenujKonec(p, stary, novy) {
    if (!p.konce || !p.konce[stary]) throw new Error('Konec ' + stary + ' neexistuje.');
    if (p.konce[novy]) throw new Error('Konec ' + novy + ' už existuje.');
    const nove = {};
    for (const k of Object.keys(p.konce)) nove[k === stary ? novy : k] = p.konce[k];
    p.konce = nove;
    let n = 0;
    for (const s of Object.values(p.sceny)) if (s.konec === stary) { s.konec = novy; n++; }
    return n;
  }
  /* Kde se předmět / příznak používá: [{scena, kde}] */
  function pouziti(p, x, druh) {
    const out = [];
    const ma = (o, k) => o && seznam(o[k]).includes(x);
    for (const [id, s] of Object.entries(p.sceny || {})) {
      if (druh === 'priznak') {
        if (ma(s.efekty, 'priznak')) out.push({ scena: id, kde: 'nastaví při vstupu' });
        (s.volby || []).forEach((v, i) => {
          if (ma(v.efekty, 'priznak')) out.push({ scena: id, kde: popisVolby(s, i) + ': nastaví' });
          if (ma(v.pokud, 'priznak')) out.push({ scena: id, kde: popisVolby(s, i) + ': vyžaduje' });
          if (ma(v.pokud, 'bez')) out.push({ scena: id, kde: popisVolby(s, i) + ': vyžaduje nepřítomnost' });
        });
      } else {
        if (ma(s.efekty, 'predmet')) out.push({ scena: id, kde: 'získá při vstupu' });
        if (ma(s.efekty, 'odeber')) out.push({ scena: id, kde: 'ztratí při vstupu' });
        (s.volby || []).forEach((v, i) => {
          const pv = popisVolby(s, i);
          if (ma(v.efekty, 'predmet')) out.push({ scena: id, kde: pv + ': získá' });
          if (ma(v.efekty, 'odeber')) out.push({ scena: id, kde: pv + ': odevzdá' });
          if (ma(v.pokud, 'ma')) out.push({ scena: id, kde: pv + ': vyžaduje' });
          if (ma(v.pokud, 'nema')) out.push({ scena: id, kde: pv + ': vyžaduje, aby chyběl' });
        });
      }
    }
    return out;
  }
  /* Všechny příznaky v příběhu (seřazené). */
  function priznaky(p) {
    const m = new Set();
    for (const s of Object.values(p.sceny || {})) {
      seznam((s.efekty || {}).priznak).forEach(x => m.add(x));
      for (const v of s.volby || []) { seznam((v.efekty || {}).priznak).forEach(x => m.add(x)); const pk = v.pokud || {}; seznam(pk.priznak).concat(seznam(pk.bez)).forEach(x => m.add(x)); }
    }
    return [...m].sort((a, b) => a.localeCompare(b, 'cs'));
  }
  /* Typ uzlu pro barvu v grafu. */
  function typUzlu(p, id) {
    const s = p.sceny[id];
    if (!s) return 'chybi';
    if (s.konec != null) { const t = ((p.konce || {})[s.konec] || {}).typ; return t === 'vyhra' ? 'vyhra' : t === 'prohra' ? 'prohra' : 'neutral'; }
    if (id === p.start) return 'start';
    if (s.boj || (s.volby || []).some(v => v.boj)) return 'boj';
    if ((s.volby || []).some(v => v.zkouska)) return 'zkouska';
    return 'scena';
  }
  /* Nastaví/odebere klíč tak, aby se zachovalo pořadí ostatních (prázdné hodnoty se mažou). */
  function nastav(o, k, v) {
    const prazdne = v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    if (prazdne) delete o[k]; else o[k] = v;
    return o;
  }
  /* Seznam z textu „a, b, c“ → 'a' nebo ['a','b','c'] (jeden prvek jako řetězec – jako v původních souborech). */
  function zTextu(t) {
    const a = String(t || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
    return a.length === 0 ? undefined : a.length === 1 ? a[0] : a;
  }
  const doTextu = v => seznam(v).join(', ');
  function prazdnyPribeh() {
    return {
      id: 'novy', nazev: 'Nový gamebook', podtitul: '', ikona: '📖', klic: 'webapp_hra_gamebook_novy',
      start: '1', smrt: '99', tma: '98',
      zacatek: { olej: 10, zlato: 0, predmety: [] },
      predmety: {},
      konce: { vyhra: { nazev: 'Vítězství', typ: 'vyhra', popis: 'Dobrý konec' }, smrt: { nazev: 'Smrt', typ: 'prohra', popis: 'Zranění' }, tma: { nazev: 'Tma', typ: 'prohra', popis: 'Došlo světlo' } },
      sceny: {
        '1': { text: 'Začátek příběhu.', volby: [{ text: 'Pokračovat', cil: '2' }] },
        '2': { konec: 'vyhra', text: 'Šťastný konec.' },
        '98': { konec: 'tma', text: 'Světlo zhaslo.' },
        '99': { konec: 'smrt', text: 'Zranění byla příliš vážná.' }
      }
    };
  }

  /* =========================================================
     Historie zpět / znovu (snímky jako text)
     ========================================================= */
  function Historie(max) { this.max = max || 200; this.zas = []; this.i = -1; }
  Historie.prototype.zapis = function (s) {
    if (this.zas[this.i] === s) return false;
    this.zas.length = this.i + 1;
    this.zas.push(s);
    if (this.zas.length > this.max) this.zas.shift();
    this.i = this.zas.length - 1;
    return true;
  };
  Historie.prototype.nahrad = function (s) { if (this.i >= 0) this.zas[this.i] = s; else this.zapis(s); };
  Historie.prototype.zpet = function () { return this.i > 0 ? this.zas[--this.i] : null; };
  Historie.prototype.znovu = function () { return this.i < this.zas.length - 1 ? this.zas[++this.i] : null; };
  Historie.prototype.lzeZpet = function () { return this.i > 0; };
  Historie.prototype.lzeZnovu = function () { return this.i < this.zas.length - 1; };
  Historie.prototype.vymaz = function (s) { this.zas = []; this.i = -1; if (s != null) this.zapis(s); };

  /* =========================================================
     Hraní na zkoušku – stav enginu od libovolné scény
     nast: {seed, predmety:[...], priznaky:[...], obratnost, zdravi, stesti, olej, zlato}
     ========================================================= */
  function hraOd(p, J, id, nast) {
    nast = nast || {};
    const st = J.novaHra(p, nast.seed == null ? 1 : nast.seed);
    for (const v of VLASTNOSTI) {
      if (nast[v] == null || !Number.isFinite(+nast[v])) continue;
      st[v] = Math.max(0, +nast[v]);
      if (st[v + 'Max'] != null && st[v] > st[v + 'Max']) st[v + 'Max'] = st[v];
    }
    st.predmety = seznam(nast.predmety != null ? nast.predmety : (p.zacatek || {}).predmety).slice();
    st.priznaky = seznam(nast.priznaky).slice();
    st.navstiveno = []; st.denik = []; st.tahy = 0; st.konec = null; st.boj = null; st.posledniZmeny = [];
    J.vstup(st, p, id == null ? p.start : id);
    return st;
  }

  /* =========================================================
     Export pro tisk – papírový gamebook v Markdownu (oddíly s čísly, „jdi na“)
     o: {zamichat: bool, seed: číslo} – zamíchání čísel oddílů (start je vždy 1), aby se nedalo číst dopředu.
     Vrací {md, cisla: {id: číslo}}.
     ========================================================= */
  function doMarkdown(p, o) {
    o = o || {};
    const sc = p.sceny || {}, pred = p.predmety || {}, konce = p.konce || {};
    const bezEmoji = t => String(t == null ? '' : t).replace(/^[^\p{L}\p{N}]+/u, '').trim();
    const nazvyVl = { obratnost: 'obratnost', zdravi: 'zdraví', stesti: 'štěstí', olej: 'olej', zlato: 'zlato' };
    for (const k of ['olej', 'zlato']) if (p.nazvy && p.nazvy[k]) nazvyVl[k] = bezEmoji(p.nazvy[k]).toLowerCase();
    const predmet = x => bezEmoji((pred[x] || {}).nazev) || x;
    // pořadí: start, pak po šířce grafu, pak ostatní (smrt, tma, nedosažitelné)
    const { ven } = sousede(p);
    const poradi = [];
    if (sc[p.start]) {
      const vid = new Set([p.start]), f = [p.start];
      while (f.length) { const a = f.shift(); poradi.push(a); for (const c of ven[a]) if (!vid.has(c)) { vid.add(c); f.push(c); } }
    }
    for (const id of Object.keys(sc)) if (!poradi.includes(id)) poradi.push(id);
    const zbytek = poradi.slice(sc[p.start] ? 1 : 0);
    if (o.zamichat) {
      let r = (o.seed == null ? 1 : o.seed) >>> 0 || 1;
      const nah = () => { r = (r + 0x6D2B79F5) >>> 0; let t = r; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      for (let i = zbytek.length - 1; i > 0; i--) { const j = Math.floor(nah() * (i + 1)); [zbytek[i], zbytek[j]] = [zbytek[j], zbytek[i]]; }
    }
    const cisla = {};
    (sc[p.start] ? [p.start] : []).concat(zbytek).forEach((id, i) => { cisla[id] = i + 1; });
    const odkaz = id => sc[id] ? '**' + cisla[id] + '**' : '**?' + id + '?**';
    const efekty = e => {
      if (!e) return '';
      const c = [];
      for (const v of VLASTNOSTI) if (e[v]) c.push(nazvyVl[v] + ' ' + (e[v] > 0 ? '+' : '−') + Math.abs(e[v]));
      seznam(e.predmet).forEach(x => c.push('získáváš: ' + predmet(x)));
      seznam(e.odeber).forEach(x => c.push('škrtni: ' + predmet(x)));
      seznam(e.priznak).forEach(x => c.push('zapiš si heslo ' + x.toUpperCase()));
      return c.join('; ');
    };
    const podminka = pk => {
      if (!pk) return '';
      const c = [];
      seznam(pk.ma).forEach(x => c.push('máš-li ' + predmet(x)));
      seznam(pk.nema).forEach(x => c.push('nemáš-li ' + predmet(x)));
      seznam(pk.priznak).forEach(x => c.push('máš-li heslo ' + x.toUpperCase()));
      seznam(pk.bez).forEach(x => c.push('nemáš-li heslo ' + x.toUpperCase()));
      if (pk.zlato != null) c.push('máš-li aspoň ' + pk.zlato + ' ' + nazvyVl.zlato);
      return c.join(' a ');
    };
    const velke = t => t ? t[0].toUpperCase() + t.slice(1) : t;
    const boj = b => 'Souboj: ' + (b.jmeno || 'soupeř') + ' – obratnost ' + b.obratnost + ', zdraví ' + b.zdravi + '. ' +
      'Vyhraješ-li, jdi na ' + odkaz(b.vyhra) + '. Prohraješ-li, jdi na ' + odkaz(b.prohra || p.smrt) + '.' +
      (b.utek ? ' Můžeš také utéct (zdraví −2) na ' + odkaz(b.utek) + '.' : '');
    const out = [];
    out.push('# ' + (p.nazev || 'Gamebook'));
    if (p.podtitul) out.push('*' + p.podtitul + '*');
    const z = p.zacatek || {};
    const pravidla = ['# Jak hrát',
      'Hoď jednou kostkou a přičti 6 – to je tvoje **obratnost**. Hoď dvěma kostkami a přičti 12 – to je **zdraví**. Hoď jednou kostkou a přičti 6 – to je **štěstí**. ' +
      'Na začátku máš ' + nazvyVl.olej + ' ' + (z.olej || 10) + ' a ' + nazvyVl.zlato + ' ' + (z.zlato || 0) + '.' +
      (seznam(z.predmety).length ? ' V torbě máš: ' + seznam(z.predmety).map(predmet).join(', ') + '.' : ''),
      '**Zkouška**: hoď dvěma kostkami. Padne-li nejvýš hodnota zkoušené vlastnosti, zkouška se podařila. Každá zkouška štěstí ti ubere 1 štěstí.',
      '**Souboj** probíhá v kolech: ty i soupeř hodíte dvěma kostkami a přičtete obratnost. Kdo má víc, ubere druhému 2 zdraví. Při shodě se nic nestane.',
      'Efekty oddílu platí jen při první návštěvě. Hesla si zapisuj, škrtnuté předměty už nemáš.' +
      (sc[p.smrt] ? ' Klesne-li zdraví na 0, jdi ihned na ' + odkaz(p.smrt) + '.' : '') +
      (sc[p.tma] ? ' Dojde-li ' + nazvyVl.olej + (p.svetlo && pred[p.svetlo] ? ' a nemáš-li ' + predmet(p.svetlo) : '') + ', jdi ihned na ' + odkaz(p.tma) + '.' : '')];
    out.push(...pravidla);
    const pouzitelne = Object.keys(pred).filter(k => pred[k].pouziti);
    if (pouzitelne.length) out.push('Předměty, které jde kdykoli použít: ' + pouzitelne.map(k => predmet(k) + ' (' + efekty(pred[k].pouziti) + (pred[k].spotrebni ? ', pak ho škrtni' : '') + ')').join('; ') + '.');
    out.push('*');
    const podleCisla = Object.keys(cisla).sort((a, b) => cisla[a] - cisla[b]);
    for (const id of podleCisla) {
      const s = sc[id];
      out.push('## ' + cisla[id]);
      String(s.text || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean).forEach(t => out.push(t));
      const ef = efekty(s.efekty);
      if (ef) out.push('*' + velke(ef) + '.*');
      if (s.konec != null) { out.push('**KONEC – ' + (((konce[s.konec] || {}).nazev) || s.konec) + '**'); continue; }
      if (s.boj) out.push(boj(s.boj));
      for (const v of s.volby || []) {
        const pd = podminka(v.pokud), e = efekty(v.efekty);
        let t = (pd ? '*' + velke(pd) + ':* ' : '') + (v.text || 'Pokračovat') + (e ? ' (' + e + ')' : '');
        if (v.zkouska) t += ' – zkouška ' + ({ obratnost: 'obratnosti', zdravi: 'zdraví', stesti: 'štěstí', olej: 'oleje', zlato: 'zlata' }[v.zkouska.co] || v.zkouska.co) + ': uspěješ-li, jdi na ' + odkaz(v.zkouska.uspech) + ', jinak na ' + odkaz(v.zkouska.neuspech) + '.';
        else if (v.boj) t += ' – ' + boj(v.boj);
        else t += ' – jdi na ' + odkaz(v.cil) + '.';
        out.push(t);
      }
    }
    return { md: out.join('\n\n') + '\n', cisla };
  }

  /* =========================================================
     Záloha všech projektů
     ========================================================= */
  const TYP_ZALOHY = 'gamebook_editor_zaloha';
  function zaloha(projekty) { return { typ: TYP_ZALOHY, verze: 1, vytvoreno: new Date().toISOString(), projekty }; }
  function jeZaloha(d) { return !!(d && typeof d === 'object' && d.typ === TYP_ZALOHY); }
  /* Vrátí platné projekty ze zálohy (vadné přeskočí a spočítá). */
  function projektyZeZalohy(d) {
    if (!jeZaloha(d) || !Array.isArray(d.projekty)) throw new Error('Soubor není záloha Editoru gamebooků.');
    const ok = [];
    let vadnych = 0;
    for (const pr of d.projekty) {
      if (!pr || typeof pr !== 'object' || typeof pr.id !== 'string' || kontrolaTvaru(pr.pribeh)) { vadnych++; continue; }
      if (!pr.pribeh.predmety) pr.pribeh.predmety = {};
      if (!pr.pribeh.konce) pr.pribeh.konce = {};
      ok.push(Object.assign({ nazev: pr.pribeh.nazev || 'Příběh', pozice: {}, hlavicka: '', globalni: 'GAMEBOOK_PRIBEH', vytvoreno: Date.now(), upraveno: Date.now() }, pr));
    }
    return { projekty: ok, vadnych };
  }

  const API = {
    VLASTNOSTI, parsujLiteral, nactiSoubor, kontrolaTvaru, doJs, doJson, lit,
    hrany, sousede, dosazitelne, komponenty, stavyScen, nikdyDostupna, pokryto, analyzuj, statistiky, simuluj, rozloz,
    noveId, odkazyNa, prejmenujScenu, prejmenujPredmet, prejmenujKonec, pouziti, priznaky, typUzlu,
    nastav, zTextu, doTextu, prazdnyPribeh, Historie, hraOd, kopie, popisVolby, doMarkdown, zaloha, jeZaloha, projektyZeZalohy
  };
  if (typeof module !== 'undefined') module.exports = API; else window.GamebookEditorJadro = API;
})();
