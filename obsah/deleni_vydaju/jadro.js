/* Dělení společných výdajů – jádro bez DOM (test: _test/deleni_vydaju_test.js).
   Skupiny, členové, výdaje (kdo platil, za koho, jak dělit), více měn s kurzem,
   bilance, vyrovnání minimem převodů, sdílení přes odkaz a CSV.
   Všechny částky se počítají v celých haléřích (nejmenších jednotkách měny),
   takže součet podílů vždy přesně sedí na celkovou částku. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_deleni_vydaju';

  /* Měny: počet desetinných míst a značka. Jiný třípísmenný kód se bere se 2 místy. */
  const MENY = {
    CZK: [2, 'Kč'], EUR: [2, '€'], USD: [2, '$'], GBP: [2, '£'], PLN: [2, 'zł'], HUF: [2, 'Ft'],
    CHF: [2, 'CHF'], SEK: [2, 'kr'], NOK: [2, 'kr'], DKK: [2, 'kr'], HRK: [2, 'kn'], RON: [2, 'lei'],
    BGN: [2, 'лв'], TRY: [2, '₺'], JPY: [0, '¥'], CAD: [2, 'C$'], AUD: [2, 'A$']
  };
  const desetin = m => (MENY[m] ? MENY[m][0] : 2);
  const znacka = m => (MENY[m] ? MENY[m][1] : m);

  const KATEGORIE = [
    { id: 'jidlo', nazev: '🍽️ Jídlo a pití' }, { id: 'nakup', nazev: '🛒 Nákupy' },
    { id: 'ubytovani', nazev: '🏨 Ubytování' }, { id: 'doprava', nazev: '🚗 Doprava' },
    { id: 'palivo', nazev: '⛽ Palivo' }, { id: 'zabava', nazev: '🎟️ Zábava a vstupné' },
    { id: 'najem', nazev: '🏠 Nájem' }, { id: 'energie', nazev: '💡 Energie a služby' },
    { id: 'darek', nazev: '🎁 Dárky' }, { id: 'ostatni', nazev: '📦 Ostatní' }
  ];
  const KATEGORIE_MAPA = Object.fromEntries(KATEGORIE.map(k => [k.id, k]));
  const TYPY = [
    { id: 'vylet', nazev: '🏕️ Výlet / dovolená' }, { id: 'byt', nazev: '🏠 Sdílený byt' },
    { id: 'oslava', nazev: '🎉 Oslava' }, { id: 'jine', nazev: '👥 Jiná skupina' }
  ];
  const ZPUSOBY = { rovne: 'rovným dílem', podily: 'podíly', castky: 'přesné částky', procenta: 'procenta' };

  /* ---------- pomocné ---------- */
  let citac = 0;
  function noveId() { return Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6); }
  const dvoj = n => String(n).padStart(2, '0');
  function dnesIso(d) { d = d || new Date(); return d.getFullYear() + '-' + dvoj(d.getMonth() + 1) + '-' + dvoj(d.getDate()); }
  function jeDatum(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

  /** „1 250,50“ / „1250.5“ / 12 → číslo, jinak NaN. */
  function parsujCislo(s) {
    if (typeof s === 'number') return s;
    let t = String(s == null ? '' : s).replace(/[\s  ']/g, '');
    if (!t) return NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
    t = t.replace(',', '.');
    return /^-?\d*\.?\d+$/.test(t) ? Number(t) : NaN;
  }
  /** Částka v měně → celé nejmenší jednotky. */
  function naHal(castka, mena) { return Math.round(parsujCislo(castka) * Math.pow(10, desetin(mena))); }
  function zHal(hal, mena) { return hal / Math.pow(10, desetin(mena)); }
  /** 123450 → „1 234,50 Kč“ */
  function formatCastka(hal, mena, bezZnacky) {
    const d = desetin(mena), zap = hal < 0;
    const s = (Math.abs(hal) / Math.pow(10, d)).toFixed(d);
    const [cele, des] = s.split('.');
    const t = (zap ? '−' : '') + cele.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (des ? ',' + des : '');
    return bezZnacky ? t : t + ' ' + znacka(mena);
  }
  function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

  /* ---------- dělení s haléřovým zaokrouhlením ---------- */
  /**
   * Rozdělí celé číslo `celkem` podle vah metodou největších zbytků:
   * součet výsledku je přesně `celkem`, každý díl se od přesného podílu liší o méně než 1.
   * Shody zbytků rozhoduje pořadí počínaje indexem `posun` (aby „haléř navíc“ nedostával vždy první).
   */
  function rozdelHal(celkem, vahy, posun) {
    const n = vahy.length, suma = vahy.reduce((a, b) => a + b, 0);
    if (!n || !(suma > 0) || vahy.some(v => !(v >= 0))) throw new Error('Neplatné váhy dělení.');
    const presne = vahy.map(v => celkem * v / suma);
    const vys = presne.map(Math.floor);
    let zbyva = celkem - vys.reduce((a, b) => a + b, 0);
    const p = (posun || 0) % n;
    const poradi = presne.map((x, i) => i).sort((a, b) => {
      const d = (presne[b] - vys[b]) - (presne[a] - vys[a]);
      return Math.abs(d) > 1e-9 ? d : ((a - p + n) % n) - ((b - p + n) % n);
    });
    for (let k = 0; zbyva > 0; k = (k + 1) % n, zbyva--) vys[poradi[k]]++;
    return vys;
  }

  /** Celková částka výdaje v měně skupiny (haléře). */
  function castkaSkupiny(v, sk) {
    const kurz = v.mena === sk.mena ? 1 : v.kurz;
    return Math.round(v.castka * kurz * Math.pow(10, desetin(sk.mena)));
  }

  /** Kontrola výdaje → seznam chyb (prázdný = v pořádku). */
  function zkontrolujVydaj(v, sk) {
    const ch = [];
    const ids = new Set(sk.clenove.map(c => c.id));
    if (!(v.castka > 0)) ch.push('Částka musí být kladné číslo.');
    else if (naHal(v.castka, v.mena) !== Math.round(v.castka * Math.pow(10, desetin(v.mena)) * 1e6) / 1e6) ch.push('Částka má víc desetinných míst, než měna dovoluje.');
    if (v.mena !== sk.mena && !(v.kurz > 0)) ch.push('Zadej kurz ' + v.mena + ' → ' + sk.mena + '.');
    if (!ids.has(v.platil)) ch.push('Vyber, kdo platil.');
    const uc = Object.keys(v.ucastnici || {}).filter(id => ids.has(id));
    if (!uc.length) ch.push('Vyber aspoň jednoho člověka, za kterého se platilo.');
    if (v.typ === 'splatka' && uc.length === 1 && uc[0] === v.platil) ch.push('Splátka nemůže jít sám sobě.');
    if (ch.length) return ch;
    const hod = uc.map(id => parsujCislo(v.ucastnici[id]));
    if (v.zpusob === 'podily' || v.zpusob === 'procenta') {
      if (hod.some(x => !(x >= 0))) ch.push('Podíly musí být nezáporná čísla.');
      else if (!(hod.reduce((a, b) => a + b, 0) > 0)) ch.push('Součet podílů je nula.');
      if (v.zpusob === 'procenta' && !ch.length && Math.abs(hod.reduce((a, b) => a + b, 0) - 100) > 0.001)
        ch.push('Procenta dávají dohromady ' + String(+hod.reduce((a, b) => a + b, 0).toFixed(3)).replace('.', ',') + ' %, mají dát 100 %.');
    }
    if (v.zpusob === 'castky') {
      const hal = hod.map(x => Math.round(x * Math.pow(10, desetin(v.mena))));
      if (hal.some(x => !(x >= 0))) ch.push('Částky musí být nezáporná čísla.');
      else {
        const rozdil = naHal(v.castka, v.mena) - hal.reduce((a, b) => a + b, 0);
        if (rozdil !== 0) ch.push((rozdil > 0 ? 'Nerozděleno zbývá ' : 'Rozděleno je o ') + formatCastka(Math.abs(rozdil), v.mena) + (rozdil > 0 ? '.' : ' víc, než je celková částka.'));
      }
    }
    return ch;
  }

  /**
   * Podíly výdaje v měně skupiny: {clenId: haléře}; součet = castkaSkupiny.
   * U přesných částek v cizí měně se přepočtený celek dělí v poměru zadaných částek.
   */
  function podilyVydaje(v, sk) {
    const ch = zkontrolujVydaj(v, sk);
    if (ch.length) throw new Error(ch[0]);
    const ids = new Set(sk.clenove.map(c => c.id));
    const uc = sk.clenove.map(c => c.id).filter(id => id in v.ucastnici && ids.has(id));
    let vahy;
    if (v.zpusob === 'rovne') vahy = uc.map(() => 1);
    else if (v.zpusob === 'castky') vahy = uc.map(id => Math.round(parsujCislo(v.ucastnici[id]) * Math.pow(10, desetin(v.mena))));
    else vahy = uc.map(id => parsujCislo(v.ucastnici[id]));
    const dily = rozdelHal(castkaSkupiny(v, sk), vahy, hash(v.id));
    const vys = {};
    uc.forEach((id, i) => { vys[id] = dily[i]; });
    return vys;
  }

  /* ---------- bilance ---------- */
  /** Pro každého člena: zaplatil (výdaje), podil (spotřeba), odeslal/prijal (splátky), saldo (+ = má dostat). */
  function bilance(sk) {
    const b = {};
    sk.clenove.forEach(c => { b[c.id] = { id: c.id, jmeno: c.jmeno, zaplatil: 0, podil: 0, odeslal: 0, prijal: 0, saldo: 0 }; });
    const chybne = [];
    for (const v of sk.vydaje) {
      let p;
      try { p = podilyVydaje(v, sk); } catch (e) { chybne.push(v.id); continue; }
      const celkem = castkaSkupiny(v, sk);
      if (v.typ === 'splatka') {
        b[v.platil].odeslal += celkem;
        for (const id in p) b[id].prijal += p[id];
      } else {
        b[v.platil].zaplatil += celkem;
        for (const id in p) b[id].podil += p[id];
      }
      b[v.platil].saldo += celkem;
      for (const id in p) b[id].saldo -= p[id];
    }
    const radky = sk.clenove.map(c => b[c.id]);
    radky.chybne = chybne;
    return radky;
  }

  /* ---------- vyrovnání ---------- */
  /** Hladový párovač: největší dlužník platí největšímu věřiteli. */
  function hladove(polozky) {
    const dl = polozky.filter(x => x.s < 0).map(x => ({ id: x.id, s: -x.s }));
    const ve = polozky.filter(x => x.s > 0).map(x => ({ id: x.id, s: x.s }));
    const prevody = [];
    while (dl.length && ve.length) {
      dl.sort((a, b) => b.s - a.s); ve.sort((a, b) => b.s - a.s);
      const d = dl[0], v = ve[0], m = Math.min(d.s, v.s);
      prevody.push({ od: d.id, komu: v.id, castka: m });
      d.s -= m; v.s -= m;
      if (!d.s) dl.shift();
      if (!v.s) ve.shift();
    }
    return prevody;
  }

  /**
   * Vyrovnání salda {id: haléře} co nejmenším počtem převodů.
   * Nejmenší počet = n − (největší počet skupin s nulovým součtem). Do 16 nenulových
   * zůstatků se skupiny hledají přesně (dynamické programování přes podmnožiny),
   * uvnitř skupiny pak stačí hladový párovač (k lidí → nejvýš k−1 převodů).
   * Nad 16 lidí jen hladově (výsledek je vždy správný, jen nemusí být nejkratší).
   */
  function vyrovnani(salda) {
    const pol = Object.keys(salda).filter(id => salda[id]).map(id => ({ id, s: salda[id] }));
    const soucet = pol.reduce((a, x) => a + x.s, 0);
    if (soucet !== 0) throw new Error('Zůstatky nedávají dohromady nulu (' + soucet + ').');
    const n = pol.length;
    if (n > 16) return hladove(pol);
    const plna = (1 << n) - 1, sum = new Int32Array(1 << n), dp = new Int8Array(1 << n);
    for (let m = 1; m <= plna; m++) {
      const i = 31 - Math.clz32(m & -m);
      sum[m] = sum[m & (m - 1)] + pol[i].s;
      let nej = 0;
      for (let k = m; k; k &= k - 1) { const j = dp[m & ~(k & -k)]; if (j > nej) nej = j; }
      dp[m] = nej + (sum[m] === 0 ? 1 : 0);
    }
    // rekonstrukce: odebírat prvky tak, aby zůstala optimální cesta; nulové prefixy = skupiny
    const poradi = [];
    let m = plna;
    while (m) {
      const cil = dp[m] - (sum[m] === 0 ? 1 : 0);
      for (let k = m; k; k &= k - 1) {
        const bit = k & -k;
        if (dp[m & ~bit] === cil) { poradi.push(31 - Math.clz32(bit)); m &= ~bit; break; }
      }
    }
    poradi.reverse();
    const prevody = [];
    let skup = [], s = 0;
    for (const i of poradi) {
      skup.push(pol[i]); s += pol[i].s;
      if (s === 0) { prevody.push(...hladove(skup)); skup = []; }
    }
    return prevody;
  }

  /** Kontrola: po provedení převodů musí mít všichni nulu a žádný převod nesmí být nekladný. */
  function overVyrovnani(salda, prevody) {
    const z = Object.assign({}, salda);
    for (const p of prevody) {
      if (!(p.castka > 0) || p.od === p.komu || !(p.od in z) || !(p.komu in z)) return false;
      z[p.od] += p.castka; z[p.komu] -= p.castka;
    }
    return Object.values(z).every(x => x === 0);
  }

  /** Návrh vyrovnání skupiny – převody s kontrolou. */
  function navrhVyrovnani(sk) {
    const salda = {};
    bilance(sk).forEach(r => { salda[r.id] = r.saldo; });
    const prevody = vyrovnani(salda);
    if (!overVyrovnani(salda, prevody)) throw new Error('Kontrola vyrovnání selhala.');
    return prevody;
  }

  /* ---------- data a migrace ---------- */
  function normClen(c) {
    c = c || {};
    return { id: String(c.id || noveId()), jmeno: String(c.jmeno || 'Bez jména').trim().slice(0, 60) || 'Bez jména', ucet: String(c.ucet || '').trim().slice(0, 60) };
  }
  function normMena(m, vychozi) { m = String(m || '').toUpperCase().trim(); return /^[A-Z]{3}$/.test(m) ? m : vychozi; }
  function normVydaj(v, sk) {
    v = v || {};
    const mena = normMena(v.mena, sk.mena);
    const uc = {};
    if (v.ucastnici && typeof v.ucastnici === 'object') for (const k in v.ucastnici) uc[String(k)] = typeof v.ucastnici[k] === 'number' ? v.ucastnici[k] : (parsujCislo(v.ucastnici[k]) || 0);
    const castka = parsujCislo(v.castka);
    const kurz = parsujCislo(v.kurz);
    return {
      id: String(v.id || noveId()),
      typ: v.typ === 'splatka' ? 'splatka' : 'vydaj',
      datum: jeDatum(v.datum) ? v.datum : dnesIso(),
      popis: String(v.popis || '').slice(0, 200),
      kategorie: KATEGORIE_MAPA[v.kategorie] ? v.kategorie : 'ostatni',
      castka: castka > 0 ? castka : 0,
      mena,
      kurz: mena === sk.mena ? 1 : (kurz > 0 ? kurz : 0),
      platil: String(v.platil || ''),
      zpusob: ZPUSOBY[v.zpusob] ? v.zpusob : 'rovne',
      ucastnici: uc,
      poznamka: String(v.poznamka || '').slice(0, 500)
    };
  }
  function normSkupina(s) {
    s = s || {};
    const sk = {
      id: String(s.id || noveId()),
      nazev: String(s.nazev || 'Skupina').trim().slice(0, 80) || 'Skupina',
      typ: TYPY.some(t => t.id === s.typ) ? s.typ : 'jine',
      mena: normMena(s.mena, 'CZK'),
      kurzy: {},
      clenove: Array.isArray(s.clenove) ? s.clenove.map(normClen) : [],
      vydaje: [],
      vytvoreno: jeDatum(s.vytvoreno) ? s.vytvoreno : dnesIso()
    };
    if (s.kurzy && typeof s.kurzy === 'object') for (const k in s.kurzy) { const x = parsujCislo(s.kurzy[k]); if (x > 0 && /^[A-Z]{3}$/.test(k)) sk.kurzy[k] = x; }
    if (Array.isArray(s.vydaje)) sk.vydaje = s.vydaje.map(v => normVydaj(v, sk));
    return sk;
  }
  function prazdna() { return { verze: VERZE, skupiny: [], aktivni: '' }; }
  function migruj(d) {
    if (!d || typeof d !== 'object') return prazdna();
    const vys = prazdna();
    vys.skupiny = Array.isArray(d.skupiny) ? d.skupiny.map(normSkupina) : [];
    vys.aktivni = vys.skupiny.some(s => s.id === d.aktivni) ? d.aktivni : (vys.skupiny[0] ? vys.skupiny[0].id : '');
    return vys;
  }
  function novaSkupina(nazev, typ, mena, jmena) {
    return normSkupina({ nazev, typ, mena, clenove: (jmena || []).filter(j => String(j).trim()).map(j => ({ jmeno: j })) });
  }
  function clenPouzit(sk, id) { return sk.vydaje.some(v => v.platil === id || id in v.ucastnici); }
  function seradVydaje(sk) { return sk.vydaje.slice().sort((a, b) => b.datum.localeCompare(a.datum) || sk.vydaje.indexOf(b) - sk.vydaje.indexOf(a)); }

  /** Splátka od → komu (haléře v měně skupiny). */
  function splatka(sk, od, komu, hal, datum) {
    return normVydaj({ typ: 'splatka', popis: 'Vyrovnání', platil: od, ucastnici: { [komu]: zHal(hal, sk.mena) }, zpusob: 'castky', castka: zHal(hal, sk.mena), mena: sk.mena, datum: datum || dnesIso() }, sk);
  }

  /* ---------- přehledy ---------- */
  function statistika(sk) {
    const kat = {}, osoby = {};
    let celkem = 0;
    for (const v of sk.vydaje) {
      if (v.typ === 'splatka') continue;
      let p; try { p = podilyVydaje(v, sk); } catch (e) { continue; }
      const c = castkaSkupiny(v, sk);
      celkem += c;
      kat[v.kategorie] = (kat[v.kategorie] || 0) + c;
      for (const id in p) osoby[id] = (osoby[id] || 0) + p[id];
    }
    return {
      celkem,
      kategorie: Object.keys(kat).map(id => ({ id, nazev: KATEGORIE_MAPA[id].nazev, castka: kat[id] })).sort((a, b) => b.castka - a.castka),
      osoby
    };
  }

  /* ---------- CSV ---------- */
  function csvBunka(x) { const s = String(x == null ? '' : x); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  const cisloCsv = (hal, mena) => zHal(hal, mena).toFixed(desetin(mena)).replace('.', ',');
  function csv(sk) {
    const jm = id => (sk.clenove.find(c => c.id === id) || { jmeno: '?' }).jmeno;
    const hl = ['Datum', 'Typ', 'Popis', 'Kategorie', 'Částka', 'Měna', 'Kurz', 'Částka ' + sk.mena, 'Platil', 'Dělení'].concat(sk.clenove.map(c => c.jmeno));
    const radky = [hl];
    for (const v of seradVydaje(sk).reverse()) {
      let p = {}; try { p = podilyVydaje(v, sk); } catch (e) { /* chybný výdaj – bez podílů */ }
      radky.push([v.datum, v.typ === 'splatka' ? 'splátka' : 'výdaj', v.popis, KATEGORIE_MAPA[v.kategorie].nazev.replace(/^\S+\s/, ''),
        String(v.castka).replace('.', ','), v.mena, String(v.kurz).replace('.', ','), cisloCsv(castkaSkupiny(v, sk), sk.mena), jm(v.platil), ZPUSOBY[v.zpusob]]
        .concat(sk.clenove.map(c => (c.id in p ? cisloCsv(p[c.id], sk.mena) : ''))));
    }
    radky.push([]);
    radky.push(['Bilance', '', '', '', '', '', '', '', 'Člen', 'Zaplatil', 'Podíl', 'Splátky odeslané', 'Splátky přijaté', 'Zůstatek']);
    for (const r of bilance(sk)) radky.push(['', '', '', '', '', '', '', '', r.jmeno, cisloCsv(r.zaplatil, sk.mena), cisloCsv(r.podil, sk.mena), cisloCsv(r.odeslal, sk.mena), cisloCsv(r.prijal, sk.mena), cisloCsv(r.saldo, sk.mena)]);
    return '﻿' + radky.map(r => r.map(csvBunka).join(';')).join('\r\n') + '\r\n';
  }

  /* ---------- sdílení přes odkaz ---------- */
  function b64url(bajty) {
    let s = '';
    for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode.apply(null, bajty.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function zB64url(t) {
    const s = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  async function proud(bajty, komprimuj) {
    const s = new Blob([bajty]).stream().pipeThrough(komprimuj ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  /** Skupina → text do hashe odkazu: „z“ + deflate + base64url, bez komprese „j“ + base64url. */
  async function zakoduj(sk) {
    const bajty = new TextEncoder().encode(JSON.stringify(sk));
    if (typeof CompressionStream === 'function') return 'z' + b64url(await proud(bajty, true));
    return 'j' + b64url(bajty);
  }
  async function dekoduj(t) {
    t = String(t || '').trim();
    let bajty = zB64url(t.slice(1));
    if (t[0] === 'z') bajty = await proud(bajty, false);
    else if (t[0] !== 'j') throw new Error('Neznámý formát odkazu.');
    return normSkupina(JSON.parse(new TextDecoder().decode(bajty)));
  }

  const API = {
    VERZE, KLIC, MENY, KATEGORIE, KATEGORIE_MAPA, TYPY, ZPUSOBY, desetin, znacka, noveId, dnesIso,
    parsujCislo, naHal, zHal, formatCastka, rozdelHal, castkaSkupiny, zkontrolujVydaj, podilyVydaje,
    bilance, vyrovnani, hladove, overVyrovnani, navrhVyrovnani, normVydaj, normSkupina, prazdna, migruj,
    novaSkupina, clenPouzit, seradVydaje, splatka, statistika, csv, zakoduj, dekoduj
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.DeleniJadro = API;
})();
