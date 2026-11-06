/* Volná místa – sestavení dat z otevřené sady MPSV přímo v prohlížeči (Worker stahovani.js) i v node (test).
   Vstup: podklady.json + obce.json (stálé, z tools/prace_data.py) a inzeráty z volna-mista.json.
   Výstup: { meta, radky, detaily[DAVKY] } – formát čte jadro.js (pořadí sloupců v meta.pole). */
(function (koren) {
  'use strict';

  const DAVKY = 64;   // detail podle portalId % DAVKY
  const POLE = ['id', 'nazev', 'firma', 'ico', 'isco', 'obec', 'lat', 'lon', 'okresy', 'presnost',
    'mzdaOd', 'mzdaDo', 'hodinova', 'hodin', 'pocet', 'vzdelani', 'smennost', 'vztahy',
    'vhodnost', 'vyhody', 'obory', 'dovednosti', 'jazyky', 'priznaky', 'vlozeno', 'zmena',
    'nastup', 'konec', 'expirace'];
  const PRIZNAKY = ['cizinecMimoEu', 'azylant', 'zamestnaneckaKarta', 'modraKarta', 'statniSpravaSamosprava',
    'agentura', 'anonymni', 'eures', 'url'];
  const ZDROJ = 'MPSV / Úřad práce ČR – otevřená data „Volná místa za celou ČR“ (data.mpsv.cz); souřadnice RÚIAN © ČÚZK';

  /* {id: 'Smennost/jednoSm'} → 'jednoSm' */
  const kod = o => (o && o.id ? o.id.slice(o.id.indexOf('/') + 1) : null);
  const text = o => ((o && o.cs) || '').replace(/\r\n/g, '\n').trim();
  const dny = d => (d ? Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000) : 0);
  const spoj = (casti, odd) => casti.filter(Boolean).join(odd);

  function adresaText(a) {
    if (!a) return '';
    const cislo = spoj([a.cisloDomovni, a.cisloOrientacni].map(x => (x ? String(x) : '')), '/');
    return spoj([(a.ulice && a.ulice.nazev) || '', cislo], ' ') || a.dodatekAdresy || '';
  }

  function kontakt(k) {
    if (!k) return null;
    const ven = {};
    const kdo = k.komuSeHlasit || {};
    const kde = k.kdeSeHlasit || {};
    const a = kde.adresa || {};
    [['jmeno', spoj([kdo.titulPredJmenem, kdo.jmeno, kdo.prijmeni, kdo.titulZaJmenem], ' ')],
      ['pozice', kdo.poziceVeSpolecnosti], ['tel', kdo.telefon], ['email', kdo.email],
      ['misto', kde.mistoKontaktu], ['tel2', kde.telefon], ['email2', kde.email],
      ['adresa', adresaText(kde.adresa)], ['obec', kod(a.obec)]]
      .forEach(([k2, v]) => { if (v) ven[k2] = v; });
    return Object.keys(ven).length ? ven : null;
  }

  /* Prázdné hodnoty (null, '', [], false) se do detailu nezapisují – jako v původním Python skriptu. */
  function bezPrazdnych(o) {
    const ven = {};
    for (const k in o) {
      const v = o[k];
      if (v && !(Array.isArray(v) && !v.length)) ven[k] = v;
    }
    return ven;
  }

  function novy(podklady, obce) {
    const P = podklady;
    const poradi = seznam => new Map(seznam.map((x, i) => [x[0], i]));
    const vzd = poradi(P.vzdelani), smen = poradi(P.smennost), vztahy = poradi(P.vztahy);
    const vhod = poradi(P.vhodnost), vyh = poradi(P.vyhody), uro = poradi(P.uroven);
    const obecOkres = new Map(), stredy = new Map();
    for (const o of obce) {
      obecOkres.set(o[0], o[2]);
      if (o[3] != null) stredy.set(o[0], [o[3], o[4]]);
    }
    // kód → pořadí podle číselníku (stálé napříč dny – uložený filtr jazyků drží pořadová čísla); neznámé na konec
    const dovednosti = new Map(Object.keys(P.dovednosti).map((k, i) => [k, i]));
    const jazyky = new Map(Object.keys(P.jazyky).map((k, i) => [k, i]));
    const pouziteIsco = new Set(), pouziteKkov = new Set();
    const radky = [], detaily = Array.from({ length: DAVKY }, () => ({}));
    let datum = '';

    const maska = (seznam, por) => (seznam || []).reduce((s, v) => (por.has(kod(v)) ? s | (1 << por.get(kod(v))) : s), 0);
    const pridejKod = (mapa, k) => { if (!mapa.has(k)) mapa.set(k, mapa.size); return mapa.get(k); };

    function pridej(x) {
      const m = x.mistoVykonuPrace || {};
      const prac = (m.pracoviste && m.pracoviste[0]) || {};
      const a = prac.adresa || {};
      const obec = +(kod(a.obec) || kod(m.obec) || 0);
      const okresySet = new Set((m.okresy || []).map(o => +kod(o)));
      if (obecOkres.has(obec)) okresySet.add(obecOkres.get(obec));
      let okresy = [...okresySet].sort((p, q) => p - q);
      const typ = kod(m.typMistaVykonuPrace);
      if (((typ === 'celaCR' || typ === 'neurceno') && !obec) || okresy.length >= 70) okresy = [];   // celá ČR
      const ka = a.kodAdresnihoMista;
      let ll = [null, null], presnost;
      if (ka && P.adresy[ka]) { ll = P.adresy[ka]; presnost = 'a'; }
      else if (stredy.has(obec)) { ll = stredy.get(obec); presnost = 'o'; }
      else presnost = okresy.length ? 'k' : 'c';
      const isco = kod(x.profeseCzIsco) || '';
      pouziteIsco.add(isco);
      const povolani = (x.pozadovanePovolani || []).map(kod);   // praxe v oboru = kódy CZ-ISCO
      povolani.forEach(k => pouziteIsco.add(k));
      const dov = (x.pozadovanaDovednost || []).filter(d => d.dovednost).map(d => pridejKod(dovednosti, kod(d.dovednost)));
      const jaz = (x.pozadovanaJazykovaZnalost || []).filter(j => j.jazyk).map(j => {
        const u = uro.get(kod(j.urovenZnalosti));
        return [pridejKod(jazyky, kod(j.jazyk)), u == null ? 1 : u];
      });
      const zverejn = kod(x.zverejnovat);
      const prizn = {
        cizinecMimoEu: x.cizinecMimoEu, azylant: x.azylant, zamestnaneckaKarta: x.zamestnaneckaKarta,
        modraKarta: x.modraKarta, statniSpravaSamosprava: x.statniSpravaSamosprava,
        agentura: x.souhlasAgenturyUzivatel, anonymni: zverejn === 'anosp', eures: zverejn === 'anoeu',
        url: !!x.urlAdresa,
      };
      const zam = x.zamestnavatel || {};
      const oboryIsco = (P.isco[isco] || [])[1] || [];
      const smennost = smen.get(kod(x.smennost));
      radky.push([
        x.portalId, text(x.pozadovanaProfese), zam.nazev || '', zam.ico || '', isco,
        obec, ll[0], ll[1], okresy, presnost,
        x.mesicniMzdaOd || 0, x.mesicniMzdaDo || 0, kod(x.typMzdy) === 'hod' ? 1 : 0,
        x.pocetHodinTydne || 0, x.pocetMist || 1,
        vzd.get(kod(x.minPozadovaneVzdelani)) || 0, smennost == null ? P.smennost.length - 1 : smennost,
        maska(x.pracovnePravniVztahy, vztahy), maska(x.vhodnostiPracovnihoMista, vhod),
        maska((x.vyhodyVolnehoMista || []).filter(v => v.vyhoda).map(v => v.vyhoda), vyh),
        oboryIsco.reduce((s, o) => s | (1 << o), 0),
        dov, jaz, PRIZNAKY.reduce((s, k, i) => (prizn[k] ? s | (1 << i) : s), 0),
        dny(x.datumVlozeni), dny(x.datumZmeny), dny(x.terminZahajeniPracovnihoPomeru),
        dny(x.terminUkonceniPracovnihoPomeru), dny(x.expirace),
      ]);
      const pv = x.pozadovaneVzdelani;
      const kkov = Array.isArray(pv) ? pv.map(kod) : (pv ? [kod(pv)] : []);
      kkov.forEach(k => pouziteKkov.add(k));
      const sPopisem = (seznam, klic) => (seznam || []).filter(v => v[klic] && v.popis).map(v => [kod(v[klic]), v.popis]);
      detaily[x.portalId % DAVKY][x.portalId] = bezPrazdnych({
        ref: x.referencniCislo, text: text(x.upresnujiciInformace), url: x.urlAdresa,
        pracoviste: prac.nazev, adresa: adresaText(a) || m.adresaText, psc: a.psc,
        kontakt: kontakt(x.prvniKontaktSeZamestnavatelem),
        prac_tel: prac.telefon, prac_email: prac.email,
        up: kod(x.kontaktniPracoviste),
        vyhody: sPopisem(x.vyhodyVolnehoMista, 'vyhoda'),
        dovednosti: sPopisem(x.pozadovanaDovednost, 'dovednost'),
        jazyky: sPopisem(x.pozadovanaJazykovaZnalost, 'jazyk'),
        kkov, praxe: povolani,
      });
      if (x.datumZmeny && x.datumZmeny > datum) datum = x.datumZmeny;
    }

    function hotovo() {
      // CZ-ISCO: použité kódy + všichni předci (kvůli stromu oborů)
      const isco = {};
      const predci = new Set();
      pouziteIsco.forEach(k => { if (k) for (let i = 1; i <= k.length; i++) predci.add(k.slice(0, i)); });
      [...predci].sort().forEach(k => { if (P.isco[k]) isco[k] = P.isco[k][0]; });
      const kkov = {};
      for (const k in P.kkov) if (pouziteKkov.has(k)) kkov[k] = P.kkov[k];
      const nazvy = seznam => seznam.map(x => x[1]);
      const meta = {
        datum: datum.slice(0, 10), sestaveno: new Date().toISOString().slice(0, 16),
        pocet: radky.length, mist: radky.reduce((s, r) => s + r[14], 0), davky: DAVKY,
        zdroj: ZDROJ, minimalni: P.minimalni, pole: POLE, priznaky: PRIZNAKY,
        vzdelani: nazvy(P.vzdelani), smennost: nazvy(P.smennost), vztahy: nazvy(P.vztahy),
        vhodnost: nazvy(P.vhodnost), vyhody: nazvy(P.vyhody), vyhodyKod: P.vyhody.map(x => x[0]),
        uroven: nazvy(P.uroven), obory: P.obory,
        dovednosti: [...dovednosti.keys()].map(k => P.dovednosti[k] || k), dovednostiKod: [...dovednosti.keys()],
        jazyky: [...jazyky.keys()].map(k => P.jazyky[k] || k), jazykyKod: [...jazyky.keys()],
        isco, kraje: P.kraje, okresy: P.okresy, up: P.up, kkov,
      };
      return { meta, radky, detaily };
    }

    return { pridej, hotovo };
  }

  /* Proudové dělení {"polozky":[{…},{…}]} na jednotlivé inzeráty (celý soubor má ~190 MB,
     najednou by se do paměti telefonu nevešel). vloz(kus textu) → pole textů objektů. */
  function delic() {
    let hloubka = 0, vRetezci = false, unik = false, zbytek = '';
    return function vloz(kus) {
      const s = zbytek + kus;
      const ven = [];
      let zacatek = zbytek ? 0 : -1;
      for (let i = zbytek.length; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (vRetezci) {
          if (unik) unik = false;
          else if (c === 92) unik = true;          // \
          else if (c === 34) vRetezci = false;     // "
        } else if (c === 34) vRetezci = true;
        else if (c === 123 || c === 91) {          // { [
          if (hloubka === 2 && c === 123) zacatek = i;
          hloubka++;
        } else if (c === 125 || c === 93) {        // } ]
          hloubka--;
          if (hloubka === 2 && c === 125) { ven.push(s.slice(zacatek, i + 1)); zacatek = -1; }
        }
      }
      zbytek = zacatek >= 0 ? s.slice(zacatek) : '';
      return ven;
    };
  }

  const api = { novy, delic, DAVKY, POLE, PRIZNAKY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else koren.PRACE_SESTAV = api;
})(typeof self !== 'undefined' ? self : this);
