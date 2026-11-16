/* Rodinný rozvrh – jádro bez DOM (test: _test/rodinny_rozvrh_test.js).
   Členové rodiny, místa s dobou cesty, opakované aktivity, odvozy (kdo veze koho),
   výjimky (prázdniny, zrušeno, jiný řidič), detekce kolizí a export .ics. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_rodinny_rozvrh';
  const DNY = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  const DNY_DLOUHE = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];
  const KATEGORIE = [
    { id: 'skola', nazev: '🏫 Škola' }, { id: 'krouzek', nazev: '🎨 Kroužek' }, { id: 'trenink', nazev: '⚽ Trénink' },
    { id: 'prace', nazev: '💼 Práce' }, { id: 'jine', nazev: '📌 Jiné' }
  ];
  const KAT = Object.fromEntries(KATEGORIE.map(k => [k.id, k]));
  const OPAKOVANI = { kazdy: 'každý týden', sudy: 'sudé týdny', lichy: 'liché týdny', jednou: 'jednou' };
  const BARVY = ['#e4572e', '#2e86de', '#17a589', '#f39c12', '#8e44ad', '#d81b60', '#6d8b00', '#795548'];
  const DOMOV = { id: 'domov', nazev: '🏠 Domov', cesta: 0 };
  const SAM = 'sam'; // hodnota odvozu: jede sám / autobusem – nikoho nevytěžuje

  /* ---------- datum a čas ---------- */
  const p2 = n => String(n).padStart(2, '0');
  function jeDatum(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
    const [r, m, d] = s.split('-').map(Number), x = new Date(Date.UTC(r, m - 1, d));
    return x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
  }
  const isoZ = x => x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate());
  const utc = s => { const [r, m, d] = s.split('-').map(Number); return new Date(Date.UTC(r, m - 1, d)); };
  function dnesIso(d) { d = d || new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function pridejDny(s, n) { const x = utc(s); x.setUTCDate(x.getUTCDate() + n); return isoZ(x); }
  function rozdilDni(a, b) { return Math.round((utc(b) - utc(a)) / 864e5); }
  function denTydne(s) { return (utc(s).getUTCDay() + 6) % 7; } // 0 = pondělí
  function pondeli(s) { return pridejDny(s, -denTydne(s)); }
  function isoTyden(s) { // číslo týdne podle ISO 8601
    const x = utc(s); x.setUTCDate(x.getUTCDate() + 3 - denTydne(s));
    const r1 = new Date(Date.UTC(x.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((x - r1) / 864e5 - 3 + ((r1.getUTCDay() + 6) % 7)) / 7);
  }
  function formatDatum(s, rok) { if (!jeDatum(s)) return ''; const [r, m, d] = s.split('-').map(Number); return d + '. ' + m + '.' + (rok ? ' ' + r : ''); }
  function jeCas(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')); }
  function naMin(s) { if (!jeCas(s)) return null; return +s.slice(0, 2) * 60 + +s.slice(3); }
  function formatCas(m) { m = Math.round(m); m = ((m % 1440) + 1440) % 1440; return Math.floor(m / 60) + ':' + p2(m % 60); }
  function normCas(s) { // „7.30“, „730“, „7:5“ → „07:30“…
    const t = String(s || '').trim().replace(/[.,h ]/g, ':');
    let m = t.match(/^(\d{1,2}):(\d{1,2})$/) || t.match(/^(\d{1,2})(\d{2})$/) || t.match(/^(\d{1,2})$/);
    if (!m) return '';
    const h = +m[1], mi = m[2] === undefined ? 0 : +m[2];
    return h < 24 && mi < 60 ? p2(h) + ':' + p2(mi) : '';
  }

  /* Velikonoční neděle (gregoriánský výpočet) */
  function velikonoce(r) {
    const a = r % 19, b = Math.floor(r / 100), c = r % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return r + '-' + p2(mes) + '-' + p2(den);
  }
  const SVATKY_PEVNE = { '01-01': 'Nový rok', '05-01': 'Svátek práce', '05-08': 'Den vítězství', '07-05': 'Cyril a Metoděj', '07-06': 'Jan Hus',
    '09-28': 'Den české státnosti', '10-28': 'Vznik Československa', '11-17': 'Den boje za svobodu', '12-24': 'Štědrý den', '12-25': '1. svátek vánoční', '12-26': '2. svátek vánoční' };
  const svatkyCache = {};
  function svatky(r) { // české státní svátky v roce → { iso: název }
    if (svatkyCache[r]) return svatkyCache[r];
    const o = {};
    for (const k in SVATKY_PEVNE) o[r + '-' + k] = SVATKY_PEVNE[k];
    const v = velikonoce(r);
    o[pridejDny(v, -2)] = 'Velký pátek'; o[pridejDny(v, 1)] = 'Velikonoční pondělí';
    return (svatkyCache[r] = o);
  }
  function svatek(s) { return svatky(+s.slice(0, 4))[s] || ''; }

  /* ---------- data ---------- */
  function novyId(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  const txt = (s, n) => String(s == null ? '' : s).trim().slice(0, n || 120);
  const cislo = (v, min, max, vych) => { const x = Number(String(v).replace(',', '.')); return isFinite(x) && String(v).trim() !== '' ? Math.min(max, Math.max(min, Math.round(x))) : vych; };

  function normClen(c, i) {
    c = c || {};
    return { id: txt(c.id, 40) || novyId('c'), jmeno: txt(c.jmeno, 40) || 'Člen', barva: /^#[0-9a-f]{6}$/i.test(c.barva) ? c.barva.toLowerCase() : BARVY[(i || 0) % BARVY.length],
      ridic: !!c.ridic, odvoz: !!c.odvoz };
  }
  function normMisto(m) {
    m = m || {};
    return { id: txt(m.id, 40) || novyId('m'), nazev: txt(m.nazev, 60) || 'Místo', cesta: cislo(m.cesta, 0, 600, 10), adresa: txt(m.adresa, 150) };
  }
  function normOdvozHodnota(v) { return typeof v === 'string' ? v.slice(0, 40) : ''; }
  function normAktivita(a) {
    a = a || {};
    const jednou = a.opakovani === 'jednou' && jeDatum(a.datum);
    const dny = jednou ? [denTydne(a.datum)] : [...new Set((Array.isArray(a.dny) ? a.dny : []).map(Number).filter(d => d >= 0 && d <= 6))].sort();
    let od = jeCas(a.od) ? a.od : '08:00', d = jeCas(a.do) ? a.do : '';
    if (!d || naMin(d) <= naMin(od)) d = formatCas(Math.min(naMin(od) + 60, 1439)).padStart(5, '0');
    const odvoz = {};
    for (const den of dny) {
      const o = (a.odvoz && a.odvoz[den]) || {};
      odvoz[den] = { tam: normOdvozHodnota(o.tam), zpet: normOdvozHodnota(o.zpet) };
    }
    return { id: txt(a.id, 40) || novyId('a'), nazev: txt(a.nazev, 80) || 'Aktivita', kategorie: KAT[a.kategorie] ? a.kategorie : 'jine',
      clenove: [...new Set((Array.isArray(a.clenove) ? a.clenove : []).map(String))], misto: txt(a.misto, 40) || 'domov',
      dny, od, do: d, opakovani: OPAKOVANI[a.opakovani] ? a.opakovani : 'kazdy', datum: jeDatum(a.datum) ? a.datum : '',
      platOd: jeDatum(a.platOd) ? a.platOd : '', platDo: jeDatum(a.platDo) ? a.platDo : '', odvoz, poznamka: txt(a.poznamka, 500) };
  }
  function normVyjimka(v) {
    v = v || {};
    const od = jeDatum(v.od) ? v.od : dnesIso(), d = jeDatum(v.do) && v.do >= od ? v.do : od;
    const pole = x => [...new Set((Array.isArray(x) ? x : []).map(String))];
    return { id: txt(v.id, 40) || novyId('v'), druh: v.druh === 'odvoz' ? 'odvoz' : 'zrusit', nazev: txt(v.nazev, 80), od, do: d,
      kategorie: pole(v.kategorie).filter(k => KAT[k]), aktivity: pole(v.aktivity), clenove: pole(v.clenove),
      tam: v.tam == null ? null : normOdvozHodnota(v.tam), zpet: v.zpet == null ? null : normOdvozHodnota(v.zpet) };
  }
  function prazdna() {
    return { verze: VERZE, clenove: [], mista: [], aktivity: [], vyjimky: [], prejezdy: {},
      nastaveni: { rezerva: 5, navazuje: 30, svatky: true, svatkyKategorie: ['skola', 'krouzek'] } };
  }
  function migruj(d) {
    const r = prazdna();
    if (!d || typeof d !== 'object') return r;
    if (Array.isArray(d.clenove)) r.clenove = d.clenove.map(normClen);
    if (Array.isArray(d.mista)) r.mista = d.mista.map(normMisto).filter(m => m.id !== 'domov');
    if (Array.isArray(d.aktivity)) r.aktivity = d.aktivity.map(normAktivita);
    if (Array.isArray(d.vyjimky)) r.vyjimky = d.vyjimky.map(normVyjimka);
    if (d.prejezdy && typeof d.prejezdy === 'object') for (const k in d.prejezdy) { const v = cislo(d.prejezdy[k], 0, 600, null); if (v != null && k.includes('|')) r.prejezdy[k] = v; }
    const n = d.nastaveni || {};
    r.nastaveni.rezerva = cislo(n.rezerva, 0, 60, 5);
    r.nastaveni.navazuje = cislo(n.navazuje, 0, 240, 30);
    if (n.svatky === false) r.nastaveni.svatky = false;
    if (Array.isArray(n.svatkyKategorie)) r.nastaveni.svatkyKategorie = n.svatkyKategorie.filter(k => KAT[k]);
    // neznámé místo → domov, neznámí členové pryč
    const mista = new Set(r.mista.map(m => m.id).concat('domov')), cl = new Set(r.clenove.map(c => c.id));
    for (const a of r.aktivity) { if (!mista.has(a.misto)) a.misto = 'domov'; a.clenove = a.clenove.filter(c => cl.has(c)); }
    return r;
  }

  /* ---------- místa a přejezdy ---------- */
  function mistoPodleId(data, id) { return id === 'domov' ? DOMOV : data.mista.find(m => m.id === id) || DOMOV; }
  const klicPrejezdu = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  /* Doba přejezdu v minutách: zadaná ručně, jinak odhad přes domov (cesta A + cesta B) – horní mez. */
  function cesta(data, a, b) {
    if (a === b) return 0;
    const k = klicPrejezdu(a, b);
    if (data.prejezdy && data.prejezdy[k] != null) return data.prejezdy[k];
    return mistoPodleId(data, a).cesta + mistoPodleId(data, b).cesta;
  }
  function jeOdhad(data, a, b) { return a !== b && !(data.prejezdy && data.prejezdy[klicPrejezdu(a, b)] != null); }

  /* ---------- výskyty ---------- */
  function platiVDen(a, datum) {
    if (a.opakovani === 'jednou') return a.datum === datum;
    if (!a.dny.includes(denTydne(datum))) return false;
    if (a.platOd && datum < a.platOd) return false;
    if (a.platDo && datum > a.platDo) return false;
    if (a.opakovani === 'sudy' && isoTyden(datum) % 2) return false;
    if (a.opakovani === 'lichy' && !(isoTyden(datum) % 2)) return false;
    return true;
  }
  function vyjimkaSeTyka(v, a, datum) {
    if (datum < v.od || datum > v.do) return false;
    if (v.aktivity.length && !v.aktivity.includes(a.id)) return false;
    if (v.kategorie.length && !v.kategorie.includes(a.kategorie)) return false;
    if (v.clenove.length && !v.clenove.some(c => a.clenove.includes(c))) return false;
    return true;
  }
  /* Všechny výskyty aktivit v daný den (i zrušené, se zruseno=true), seřazené podle začátku. */
  function vyskytyDne(data, datum) {
    const den = denTydne(datum), sv = data.nastaveni.svatky ? svatek(datum) : '', r = [];
    for (const a of data.aktivity) {
      if (!platiVDen(a, datum)) continue;
      const o = a.odvoz[den] || a.odvoz[a.dny[0]] || { tam: '', zpet: '' };
      const v = { id: a.id + '@' + datum, aktivita: a, datum, den, nazev: a.nazev, kategorie: a.kategorie, misto: a.misto,
        od: naMin(a.od), do: naMin(a.do), clenove: a.clenove.slice(), puvodniClenove: a.clenove.slice(),
        tam: o.tam, zpet: o.zpet, zruseno: false, duvod: '', zmenaOdvozu: false };
      if (sv && data.nastaveni.svatkyKategorie.includes(a.kategorie)) { v.zruseno = true; v.duvod = sv; }
      for (const x of data.vyjimky) {
        if (v.zruseno || !vyjimkaSeTyka(x, a, datum)) continue;
        if (x.druh === 'zrusit') {
          if (x.clenove.length) { // omluvení jen někteří členové
            v.clenove = v.clenove.filter(c => !x.clenove.includes(c));
            if (!v.clenove.length) { v.zruseno = true; v.duvod = x.nazev || 'zrušeno'; }
            else v.duvod = x.nazev || 'někdo omluven';
          } else { v.zruseno = true; v.duvod = x.nazev || 'zrušeno'; }
        } else {
          if (x.tam != null) v.tam = x.tam;
          if (x.zpet != null) v.zpet = x.zpet;
          v.zmenaOdvozu = true;
        }
      }
      r.push(v);
    }
    return r.sort((a, b) => a.od - b.od || a.do - b.do || a.nazev.localeCompare(b.nazev, 'cs'));
  }

  /* ---------- odvozy ----------
     Kdo potřebuje odvoz (člen.odvoz = dítě), toho vyzvedne řidič tam, kde je: na místě jeho předchozí
     aktivity téhož dne, pokud skončila nejvýš „navazuje“ minut před začátkem, jinak doma. Zpět veze
     domů – ledaže dítě do „navazuje“ minut začíná další aktivitu; pak se přesun řeší odvozem „tam“
     té další aktivity (a odvoz zpět není potřeba). */
  function jizdyDne(data, datum, vyskyty) {
    vyskyty = vyskyty || vyskytyDne(data, datum);
    const clen = Object.fromEntries(data.clenove.map(c => [c.id, c]));
    const platne = vyskyty.filter(v => !v.zruseno), nav = data.nastaveni.navazuje, rez = data.nastaveni.rezerva;
    const jizdy = [], chybi = [], navaznosti = {}; // navaznosti[vyskytId] = { tam: {cid: předchozí}, zpet: {cid: další} }
    const predchozi = (cid, v) => {
      let best = null;
      for (const w of platne) if (w !== v && w.clenove.includes(cid) && w.do <= v.od && v.od - w.do <= nav && (!best || w.do > best.do)) best = w;
      return best;
    };
    const dalsi = (cid, v) => {
      let best = null;
      for (const w of platne) if (w !== v && w.clenove.includes(cid) && w.od >= v.do && w.od - v.do <= nav && (!best || w.od < best.od)) best = w;
      return best;
    };
    for (const v of platne) {
      const deti = v.clenove.filter(c => clen[c] && clen[c].odvoz);
      navaznosti[v.id] = { tam: {}, zpet: {} };
      if (!deti.length) continue;
      for (const typ of ['tam', 'zpet']) {
        const skupiny = {}; // místo vyzvednutí/cíle → děti
        for (const c of deti) {
          const w = typ === 'tam' ? predchozi(c, v) : dalsi(c, v);
          if (w) navaznosti[v.id][typ][c] = w;
          if (typ === 'zpet' && w) continue; // přesun zajistí odvoz „tam“ další aktivity
          const druhe = typ === 'tam' ? (w ? w.misto : 'domov') : 'domov';
          if (druhe === v.misto) continue; // je už na místě
          (skupiny[druhe] = skupiny[druhe] || []).push(c);
        }
        const hodnota = v[typ], mista = Object.keys(skupiny);
        if (!mista.length || hodnota === SAM) continue;
        const deti2 = mista.flatMap(m => skupiny[m]);
        if (!hodnota || !clen[hodnota]) { chybi.push({ vyskyt: v, typ, deti: deti2 }); continue; }
        // jedna jízda, případně s více zastávkami: z domova první, pak od nejvzdálenějšího
        const trasa = typ === 'tam'
          ? mista.sort((x, y) => (y === 'domov') - (x === 'domov') || cesta(data, y, v.misto) - cesta(data, x, v.misto)).concat(v.misto)
          : [v.misto, 'domov'];
        const t = delkaTrasy(data, trasa);
        const j = typ === 'tam' ? { zac: v.od - t - rez, kon: v.od } : { zac: v.do, kon: v.do + t + rez };
        Object.assign(j, { id: v.id + ':' + typ, typ, ridic: hodnota, pasazeri: deti2, vyskyty: [v], datum, trasa, z: trasa[0], kam: trasa[trasa.length - 1],
          zDomova: trasa[0] === 'domov', cesta: t, odhad: odhadTrasy(data, trasa) });
        // sloučit stejnou jízdu (sourozenci do stejné školy ve stejný čas)
        const stejna = jizdy.find(x => x.ridic === j.ridic && x.typ === j.typ && x.trasa.join('|') === j.trasa.join('|') && x.zac === j.zac && x.kon === j.kon);
        if (stejna) { stejna.pasazeri.push(...j.pasazeri.filter(p => !stejna.pasazeri.includes(p))); stejna.vyskyty.push(v); }
        else jizdy.push(j);
      }
    }
    retez(data, jizdy);
    return { jizdy: jizdy.sort((a, b) => a.zac - b.zac), chybi, navaznosti };
  }

  function delkaTrasy(data, t) { let s = 0; for (let i = 1; i < t.length; i++) s += cesta(data, t[i - 1], t[i]); return s; }
  function odhadTrasy(data, t) { for (let i = 1; i < t.length; i++) if (jeOdhad(data, t[i - 1], t[i])) return true; return false; }
  /* Řetězení jízd jednoho řidiče: ranní rozvoz (děti z domova zůstávají v autě – po zastávce jede rovnou na další cíl)
     a odpolední sběr (vyzvednuté dítě jede s řidičem pro další, domů až nakonec). */
  function retez(data, jizdy) {
    const rez = data.nastaveni.rezerva, nav = data.nastaveni.navazuje;
    const zmen = (j, trasa) => { j.trasa = trasa; j.z = trasa[0]; j.kam = trasa[trasa.length - 1]; j.cesta = delkaTrasy(data, trasa); j.odhad = odhadTrasy(data, trasa); };
    const podleRidice = {};
    for (const j of jizdy.slice().sort((a, b) => a.kon - b.kon)) (podleRidice[j.ridic] = podleRidice[j.ridic] || []).push(j);
    for (const r in podleRidice) {
      const s = podleRidice[r];
      for (let i = 1; i < s.length; i++) { // rozvoz
        const q = s[i - 1], j = s[i];
        if (q.typ !== 'tam' || j.typ !== 'tam' || !q.zDomova || j.trasa[0] !== 'domov' || q.kam === j.kam) continue;
        const trasa = [q.kam].concat(j.trasa.slice(1)), t = delkaTrasy(data, trasa), zac = j.kon - t - rez;
        if (zac >= q.kon && zac - q.kon <= nav) { zmen(j, trasa); j.zac = zac; j.rozvoz = true; }
      }
      s.sort((a, b) => a.zac - b.zac);
      for (let i = s.length - 2; i >= 0; i--) { // sběr (odzadu, aby šlo řetězit víc vyzvednutí)
        const j = s[i], q = s[i + 1];
        if (j.typ !== 'zpet' || q.typ !== 'zpet' || j.kam !== 'domov' || j.z === q.z) continue;
        const trasa = j.trasa.slice(0, -1).concat(q.z), t = delkaTrasy(data, trasa), kon = j.zac + t + rez;
        if (kon <= q.zac && q.zac - kon <= nav) { zmen(j, trasa); j.kon = kon; j.sber = true; }
      }
    }
  }

  /* ---------- kolize ---------- */
  function popisPolozky(data, p) {
    if (p.jizda) return '🚗 ' + (p.jizda.typ === 'tam' ? 'odvoz na ' : 'vyzvednutí z ') + p.jizda.vyskyty[0].nazev;
    return p.vyskyt.nazev;
  }
  function kolizeDne(data, datum) {
    const vyskyty = vyskytyDne(data, datum), od = jizdyDne(data, datum, vyskyty), kolize = [];
    const platne = vyskyty.filter(v => !v.zruseno), rez = data.nastaveni.rezerva;
    for (const c of data.clenove) {
      const pol = [];
      for (const v of platne) if (v.clenove.includes(c.id)) pol.push({ zac: v.od, kon: v.do, z: v.misto, kam: v.misto, vyskyt: v });
      for (const j of od.jizdy) if (j.ridic === c.id) pol.push({ zac: j.zac, kon: j.kon, z: j.z, kam: j.kam, jizda: j });
      pol.sort((a, b) => a.zac - b.zac || a.kon - b.kon);
      let posl = null;
      for (const p of pol) {
        if (posl) {
          const jizda = !!(posl.jizda || p.jizda);
          const misto = n => mistoPodleId(data, n).nazev;
          if (p.zac < posl.kon) {
            kolize.push({ typ: jizda ? 'ridic' : 'prekryv', zavaznost: 'chyba', datum, clen: c.id, polozky: [posl, p],
              text: `${c.jmeno} je současně na dvou místech: ${popisPolozky(data, posl)} (${formatCas(posl.zac)}–${formatCas(posl.kon)}) a ${popisPolozky(data, p)} (${formatCas(p.zac)}–${formatCas(p.kon)}).` });
          } else {
            const t = cesta(data, posl.kam, p.z) + (jizda ? rez : 0), mezera = p.zac - posl.kon;
            if (mezera < t) kolize.push({ typ: jizda ? 'ridic' : 'presun', zavaznost: jizda ? 'chyba' : 'varovani', datum, clen: c.id, polozky: [posl, p],
              text: `${c.jmeno} nestíhá přejezd z ${misto(posl.kam)} (${formatCas(posl.kon)}) na ${misto(p.z)} (${formatCas(p.zac)}): cesta ${t} min, čas jen ${mezera} min${jeOdhad(data, posl.kam, p.z) ? ' (odhad přes domov)' : ''}.` });
          }
        }
        if (!posl || p.kon > posl.kon) posl = p;
      }
    }
    for (const ch of od.chybi) {
      const jm = ch.deti.map(c => (data.clenove.find(x => x.id === c) || {}).jmeno).join(', ');
      kolize.push({ typ: 'bezOdvozu', zavaznost: 'chyba', datum, clen: ch.deti[0], vyskyt: ch.vyskyt, odvozTyp: ch.typ,
        text: `${jm}: ${ch.vyskyt.nazev} (${formatCas(ch.typ === 'tam' ? ch.vyskyt.od : ch.vyskyt.do)}) – nikdo ${ch.typ === 'tam' ? 'neveze tam' : 'nevyzvedává'}.` });
    }
    return { datum, vyskyty, jizdy: od.jizdy, chybi: od.chybi, navaznosti: od.navaznosti, kolize };
  }
  function tyden(data, datum) {
    const po = pondeli(datum), r = [];
    for (let i = 0; i < 7; i++) r.push(kolizeDne(data, pridejDny(po, i)));
    return r;
  }

  /* ---------- úpravy ---------- */
  function smazClena(data, id) {
    data.clenove = data.clenove.filter(c => c.id !== id);
    for (const a of data.aktivity) {
      a.clenove = a.clenove.filter(c => c !== id);
      for (const d in a.odvoz) for (const t of ['tam', 'zpet']) if (a.odvoz[d][t] === id) a.odvoz[d][t] = '';
    }
    for (const v of data.vyjimky) { v.clenove = v.clenove.filter(c => c !== id); if (v.tam === id) v.tam = ''; if (v.zpet === id) v.zpet = ''; }
  }
  function smazMisto(data, id) {
    data.mista = data.mista.filter(m => m.id !== id);
    for (const a of data.aktivity) if (a.misto === id) a.misto = 'domov';
    for (const k of Object.keys(data.prejezdy)) if (k.split('|').includes(id)) delete data.prejezdy[k];
  }
  function smazAktivitu(data, id) {
    data.aktivity = data.aktivity.filter(a => a.id !== id);
    // výjimka jen pro tuto aktivitu by bez ní platila na vše → smazat
    data.vyjimky = data.vyjimky.filter(v => !(v.aktivity.length === 1 && v.aktivity[0] === id));
    for (const v of data.vyjimky) v.aktivity = v.aktivity.filter(a => a !== id);
  }
  function nastavPrejezd(data, a, b, min) {
    const k = klicPrejezdu(a, b);
    if (min === '' || min == null) delete data.prejezdy[k];
    else data.prejezdy[k] = cislo(min, 0, 600, 0);
  }

  /* ---------- export .ics (rozvinuté výskyty v zadaném období) ---------- */
  function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsZalom(radek) { // max 75 oktetů na řádek, nerozdělit znak UTF-8
    const enc = s => unescape(encodeURIComponent(s)).length;
    if (enc(radek) <= 75) return radek;
    const out = []; let akt = '', del = 0, limit = 75;
    for (const ch of radek) {
      const b = enc(ch);
      if (del + b > limit) { out.push(akt); akt = ''; del = 0; limit = 74; }
      akt += ch; del += b;
    }
    out.push(akt);
    return out.join('\r\n ');
  }
  function icsCas(datum, min) {
    const d = min >= 1440 ? pridejDny(datum, 1) : datum, m = min >= 1440 ? min - 1440 : Math.max(0, min);
    return d.replace(/-/g, '') + 'T' + p2(Math.floor(m / 60)) + p2(m % 60) + '00';
  }
  function jmena(data, ids) { return ids.map(c => (data.clenove.find(x => x.id === c) || {}).jmeno).filter(Boolean).join(', '); }
  /* volby: { od: iso, tydnu: n, clen: id|'' , jizdy: bool } */
  function ics(data, volby, razitko) {
    const od = jeDatum(volby.od) ? volby.od : dnesIso(), dni = Math.max(1, Math.min(60, volby.tydnu || 4)) * 7, cl = volby.clen || '';
    const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp//Rodinny rozvrh//CS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsText('Rodinný rozvrh')];
    const ts = razitko || '20000101T000000Z';
    for (let i = 0; i < dni; i++) {
      const datum = pridejDny(od, i), k = kolizeDne(data, datum);
      for (const v of k.vyskyty) {
        if (v.zruseno || (cl && !v.clenove.includes(cl))) continue;
        const m = mistoPodleId(data, v.misto), jezdi = k.jizdy.filter(j => j.vyskyty.includes(v));
        const popis = [jmena(data, v.clenove), KAT[v.kategorie].nazev, ...jezdi.map(j => (j.typ === 'tam' ? 'Tam veze: ' : 'Zpět veze: ') + jmena(data, [j.ridic])), v.aktivita.poznamka].filter(Boolean).join('\n');
        r.push('BEGIN:VEVENT', 'UID:rozvrh-' + v.aktivita.id + '-' + datum.replace(/-/g, '') + '@rodinny-rozvrh.local', 'DTSTAMP:' + ts,
          'DTSTART:' + icsCas(datum, v.od), 'DTEND:' + icsCas(datum, v.do), 'SUMMARY:' + icsText(v.nazev + ' (' + jmena(data, v.clenove) + ')'),
          'LOCATION:' + icsText(m.nazev.replace(/^🏠 /, '') + (m.adresa ? ', ' + m.adresa : '')), 'DESCRIPTION:' + icsText(popis), 'END:VEVENT');
      }
      if (volby.jizdy === false) continue;
      for (const j of k.jizdy) {
        if (cl && j.ridic !== cl && !j.pasazeri.includes(cl)) continue;
        const trasa = j.trasa.map(m => mistoPodleId(data, m).nazev.replace(/^🏠 /, '')).join(' → ');
        r.push('BEGIN:VEVENT', 'UID:odvoz-' + j.id.replace(/[^\w-]/g, '-') + '@rodinny-rozvrh.local', 'DTSTAMP:' + ts,
          'DTSTART:' + icsCas(datum, j.zac), 'DTEND:' + icsCas(datum, j.kon),
          'SUMMARY:' + icsText('🚗 ' + jmena(data, [j.ridic]) + ' veze ' + jmena(data, j.pasazeri) + ': ' + trasa),
          'DESCRIPTION:' + icsText(j.vyskyty.map(v => v.nazev).join(', ') + '\nCesta ' + j.cesta + ' min' + (j.odhad ? ' (odhad)' : '')), 'END:VEVENT');
      }
    }
    r.push('END:VCALENDAR');
    return r.map(icsZalom).join('\r\n') + '\r\n';
  }

  /* ---------- ukázka ---------- */
  function ukazka(dnes) {
    const po = pondeli(dnes || dnesIso());
    const rok = +po.slice(0, 4), m = +po.slice(5, 7), skolniRok = m >= 9 ? rok : rok - 1;
    const d = {
      clenove: [
        { id: 'mama', jmeno: 'Máma', barva: '#d81b60', ridic: true },
        { id: 'tata', jmeno: 'Táta', barva: '#2e86de', ridic: true },
        { id: 'anna', jmeno: 'Anička', barva: '#f39c12', odvoz: true },
        { id: 'petr', jmeno: 'Péťa', barva: '#17a589', odvoz: true }
      ],
      mista: [
        { id: 'skola', nazev: 'Základní škola', cesta: 10 }, { id: 'skolka', nazev: 'Školka', cesta: 8 },
        { id: 'prace_m', nazev: 'Kancelář (máma)', cesta: 20 }, { id: 'prace_t', nazev: 'Firma (táta)', cesta: 35 },
        { id: 'bazen', nazev: 'Bazén', cesta: 15 }, { id: 'zus', nazev: 'ZUŠ', cesta: 12 }, { id: 'hriste', nazev: 'Fotbalové hřiště', cesta: 10 }
      ],
      prejezdy: { 'prace_m|skola': 15, 'skola|skolka': 5, 'prace_m|skolka': 15, 'prace_m|zus': 10, 'skola|zus': 5 },
      aktivity: [
        { id: 'a_skola', nazev: 'Škola', kategorie: 'skola', clenove: ['anna'], misto: 'skola', dny: [0, 1, 2, 3, 4], od: '08:00', do: '13:30',
          platOd: skolniRok + '-09-01', platDo: (skolniRok + 1) + '-06-30',
          odvoz: { 0: { tam: 'mama', zpet: SAM }, 1: { tam: 'mama', zpet: SAM }, 2: { tam: 'tata', zpet: SAM }, 3: { tam: 'mama', zpet: SAM }, 4: { tam: 'mama', zpet: SAM } } },
        { id: 'a_skolka', nazev: 'Školka', kategorie: 'skola', clenove: ['petr'], misto: 'skolka', dny: [0, 1, 2, 3, 4], od: '07:45', do: '15:30',
          odvoz: { 0: { tam: 'mama', zpet: 'mama' }, 1: { tam: 'mama', zpet: 'mama' }, 2: { tam: 'tata', zpet: 'mama' }, 3: { tam: 'mama', zpet: 'mama' }, 4: { tam: 'mama', zpet: 'mama' } } },
        { id: 'a_prace_m', nazev: 'Práce', kategorie: 'prace', clenove: ['mama'], misto: 'prace_m', dny: [0, 1, 2, 3, 4], od: '08:30', do: '14:30' },
        { id: 'a_prace_t', nazev: 'Práce', kategorie: 'prace', clenove: ['tata'], misto: 'prace_t', dny: [0, 1, 2, 3, 4], od: '09:00', do: '17:00' },
        { id: 'a_klavir', nazev: 'Klavír', kategorie: 'krouzek', clenove: ['anna'], misto: 'zus', dny: [1], od: '14:00', do: '14:45', odvoz: { 1: { tam: SAM, zpet: 'mama' } } },
        { id: 'a_plavani', nazev: 'Plavání', kategorie: 'trenink', clenove: ['anna', 'petr'], misto: 'bazen', dny: [2], od: '16:00', do: '17:00', odvoz: { 2: { tam: 'mama', zpet: 'mama' } } },
        { id: 'a_fotbal', nazev: 'Fotbal', kategorie: 'trenink', clenove: ['petr'], misto: 'hriste', dny: [3], od: '16:30', do: '17:30', odvoz: { 3: { tam: 'mama', zpet: '' } } },
        { id: 'a_zapas', nazev: 'Zápas', kategorie: 'trenink', clenove: ['petr', 'tata'], misto: 'hriste', dny: [5], od: '09:00', do: '11:00', opakovani: 'sudy', odvoz: { 5: { tam: 'tata', zpet: 'tata' } } }
      ],
      vyjimky: [{ id: 'v_nem', druh: 'zrusit', nazev: 'Péťa nemocný', od: pridejDny(po, 4), do: pridejDny(po, 4), clenove: ['petr'] }]
    };
    return migruj(d);
  }

  const api = {
    VERZE, KLIC, DNY, DNY_DLOUHE, KATEGORIE, KAT, OPAKOVANI, BARVY, DOMOV, SAM,
    jeDatum, dnesIso, pridejDny, rozdilDni, denTydne, pondeli, isoTyden, formatDatum, jeCas, naMin, formatCas, normCas,
    velikonoce, svatky, svatek, novyId,
    normClen, normMisto, normAktivita, normVyjimka, prazdna, migruj,
    mistoPodleId, klicPrejezdu, cesta, jeOdhad, nastavPrejezd,
    platiVDen, vyskytyDne, jizdyDne, kolizeDne, tyden,
    smazClena, smazMisto, smazAktivitu,
    icsText, icsZalom, ics, jmena, ukazka
  };
  if (typeof module !== 'undefined') module.exports = api;
  else window.RozvrhJadro = api;
})();
