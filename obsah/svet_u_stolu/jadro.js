/* Svět u stolu – jádro: výpočet dat (pevné i pohyblivé svátky), dotazy nad daty.
   Bez DOM, testuje se v node (_test/svet_u_stolu_test.js). */
(function (koren) {
  'use strict';
  const DEN = 86400000;

  /* ---------- datumy jako 'YYYY-MM-DD' (UTC, bez časových pásem) ---------- */
  const dvoj = n => String(n).padStart(2, '0');
  const klic = (r, m, d) => r + '-' + dvoj(m) + '-' + dvoj(d);
  const zKlice = k => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  const naKlic = ms => { const t = new Date(ms); return klic(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
  const posun = (k, dny) => naKlic(zKlice(k) + dny * DEN);
  const denTydne = k => new Date(zKlice(k)).getUTCDay();
  const dnesKlic = () => { const t = new Date(); return klic(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
  const dniVMesici = (r, m) => new Date(Date.UTC(r, m, 0)).getUTCDate();

  /* ---------- Velikonoce ---------- */
  function velikonoce(r) {            // gregoriánský computus (Meeus/Jones/Butcher)
    const a = r % 19, b = Math.floor(r / 100), c = r % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return klic(r, mes, den);
  }
  function pravoslavneVelikonoce(r) { // juliánský computus + rozdíl kalendářů
    const a = r % 4, b = r % 7, c = r % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
    const mes = Math.floor((d + e + 114) / 31), den = ((d + e + 114) % 31) + 1;
    const rozdil = Math.floor(r / 100) - Math.floor(r / 400) - 2;  // 13 dní pro 1900–2099
    return posun(klic(r, mes, den), rozdil);
  }

  /* ---------- lunární kalendáře přes Intl ---------- */
  const formatovace = {};
  function form(kal) {
    if (!formatovace[kal]) {
      try {
        formatovace[kal] = new Intl.DateTimeFormat('en-u-ca-' + kal,
          { timeZone: 'UTC', month: kal === 'hebrew' ? 'long' : 'numeric', day: 'numeric' });
      } catch (e) { formatovace[kal] = null; }
    }
    return formatovace[kal];
  }
  const INTL_KAL = { cinsky: 'chinese', islamsky: 'islamic-umalqura', zidovsky: 'hebrew' };
  const mapyRoku = {};               // 'cinsky|2026' → { 'm|d': [klíče] }
  function mapaRoku(typ, r) {
    const id = typ + '|' + r;
    if (mapyRoku[id]) return mapyRoku[id];
    const f = form(INTL_KAL[typ]), mapa = {};
    const T = koren.SUS_CINSKY;
    if (typ === 'cinsky' && T && r > T.od && r <= T.do) {   // tabulka HKO (ICU se občas plete o den)
      const M = T.mesice;
      for (let i = 0; i + 1 < M.length; i++) {
        const [zac, c] = M[i];
        if (c < 0 || zac.slice(0, 4) < String(r - 1) || zac.slice(0, 4) > String(r)) continue;
        const delka = Math.round((zKlice(M[i + 1][0]) - zKlice(zac)) / DEN);
        for (let d = 0; d < delka; d++) {
          const k = posun(zac, d);
          if (k.slice(0, 4) === String(r)) (mapa[c + '|' + (d + 1)] = mapa[c + '|' + (d + 1)] || []).push(k);
        }
      }
      return (mapyRoku[id] = mapa);
    }
    if (f) {
      for (let ms = Date.UTC(r, 0, 1), konec = Date.UTC(r + 1, 0, 1); ms < konec; ms += DEN) {
        let m = '', d = '';
        for (const p of f.formatToParts(new Date(ms + DEN / 2))) {
          if (p.type === 'month') m = p.value; else if (p.type === 'day') d = p.value;
        }
        if (/bis/.test(m)) continue;                       // přestupný čínský měsíc – svátky se v něm neslaví
        (mapa[m + '|' + (+d)] = mapa[m + '|' + (+d)] || []).push(naKlic(ms));
      }
    }
    return (mapyRoku[id] = mapa);
  }
  function lunarni(typ, m, d, r) {
    const mapa = mapaRoku(typ, r);
    if (typ === 'zidovsky' && m === 'Adar') {            // v přestupném roce se Purim slaví v Adar II
      return mapa['Adar II|' + d] || mapa['Adar|' + d] || [];
    }
    return mapa[m + '|' + d] || [];
  }
  const intlOk = () => !!(form('chinese') && form('islamic-umalqura') && form('hebrew'));

  /* ---------- výskyty položky v roce ---------- */
  // vrací pole {od:'YYYY-MM-DD', delka:n} – začátky v roce r
  function zacatky(kdy, r) {
    const delka = kdy.delka || 1;
    const jeden = k => k ? [{ od: k, delka }] : [];
    switch (kdy.typ) {
      case 'pevne':
      case 'obdobi':
        if (kdy.m === 2 && kdy.d === 29 && dniVMesici(r, 2) < 29) return [];
        return jeden(klic(r, kdy.m, kdy.d));
      case 'velikonoce': return jeden(posun(velikonoce(r), kdy.posun || 0));
      case 'pravoslavne': return jeden(posun(pravoslavneVelikonoce(r), kdy.posun || 0));
      case 'cinsky': case 'islamsky': case 'zidovsky':
        return lunarni(kdy.typ, String(kdy.m), kdy.d, r).map(od => ({ od, delka }));
      case 'tyden': {
        let k;
        if (kdy.n > 0) {
          const prvni = klic(r, kdy.m, 1);
          k = posun(prvni, ((kdy.wd - denTydne(prvni) + 7) % 7) + 7 * (kdy.n - 1));
          if (+k.slice(5, 7) !== kdy.m) return [];
        } else {
          const posl = klic(r, kdy.m, dniVMesici(r, kdy.m));
          k = posun(posl, -((denTydne(posl) - kdy.wd + 7) % 7));
        }
        return jeden(posun(k, kdy.posun || 0));
      }
      case 'vrozsahu': {
        const od = klic(r, kdy.m, kdy.od);
        return jeden(posun(od, (kdy.wd - denTydne(od) + 7) % 7));
      }
      case 'slunecni': {             // sluneční člen čínského kalendáře (pekingský čas), jinak přibližně
        const T = koren.SUS_CINSKY, seznam = T && T.cleny[kdy.clen];
        const k = seznam && seznam.find(x => x.slice(0, 4) === String(r));
        return jeden(k || (PRIBLIZNE_CLENY[kdy.clen] ? r + '-' + PRIBLIZNE_CLENY[kdy.clen] : null));
      }
      case 'tabulka': {
        const v = kdy.data && kdy.data[String(r)];
        return v ? jeden(r + '-' + v) : [];
      }
      default: return [];
    }
  }
  const PRIBLIZNE_CLENY = { 'Spring Equinox': '03-20', 'Clear and Bright': '04-05', 'Summer Solstice': '06-21', 'Autumnal Equinox': '09-23', 'Winter Solstice': '12-22', 'Beginning of Spring': '02-04' };
  const DLOUHE = 4;                   // od kolika dnů je položka „období“ (zobrazuje se zvlášť)
  const jeObdobi = p => p.kdy.typ === 'obdobi' || (p.kdy.delka || 1) >= DLOUHE;

  // všechny výskyty položky, které zasahují do roku r
  function vyskyty(p, r) {
    const out = [];
    for (const rr of [r - 1, r]) {
      for (const v of zacatky(p.kdy, rr)) {
        const konec = posun(v.od, v.delka - 1);
        if (konec.slice(0, 4) >= String(r) && v.od.slice(0, 4) <= String(r)) out.push({ od: v.od, do: konec, delka: v.delka });
      }
    }
    return out;
  }
  const maTabulku = (p, r) => p.kdy.typ !== 'tabulka' || !!(p.kdy.data && p.kdy.data[String(r)]);

  /* ---------- index roku ---------- */
  const indexy = new WeakMap();      // pole dat → { rok: index } (filtrované pole = nové pole = nový index)
  function indexRoku(data, r) {
    let roky = indexy.get(data);
    if (!roky) indexy.set(data, roky = {});
    if (roky[r]) return roky[r];
    const dny = {};                   // klíč dne → [{p, od, do, den (1..), delka}]
    for (const p of data) {
      for (const v of vyskyty(p, r)) {
        for (let i = 0; i < v.delka; i++) {
          const k = posun(v.od, i);
          if (k.slice(0, 4) !== String(r)) continue;
          (dny[k] = dny[k] || []).push({ p, od: v.od, do: v.do, den: i + 1, delka: v.delka });
        }
      }
    }
    return (roky[r] = dny);
  }
  // položky dne rozdělené na „dnes“ a „probíhá“ (dlouhá období)
  function naDen(data, k) {
    const vse = indexRoku(data, +k.slice(0, 4))[k] || [];
    return {
      den: vse.filter(z => !jeObdobi(z.p)),
      obdobi: vse.filter(z => jeObdobi(z.p))
    };
  }
  // nejbližší výskyty položky od dne k (pro detail a „příště“)
  function pristi(p, k) {
    const r = +k.slice(0, 4);
    for (const rr of [r, r + 1, r + 2]) {
      const v = vyskyty(p, rr).filter(x => x.do >= k).sort((a, b) => a.od < b.od ? -1 : 1)[0];
      if (v) return v;
    }
    return null;
  }

  /* ---------- texty ---------- */
  const MESICE_2P = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  const MESICE_6P = ['lednu', 'únoru', 'březnu', 'dubnu', 'květnu', 'červnu', 'červenci', 'srpnu', 'září', 'říjnu', 'listopadu', 'prosinci'];
  const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  // jazyk stránky (i18n.js nastaví <html lang>); mimo češtinu formátuje Intl – i18n.js přesměruje 'cs' na jazyk stránky
  const jazyk = () => (typeof document !== 'undefined' && document.documentElement.lang) || 'cs';
  const intl = volby => new Intl.DateTimeFormat('cs', Object.assign({ timeZone: 'UTC' }, volby));
  const datumText = k => jazyk() === 'cs' ? (+k.slice(8, 10)) + '. ' + (+k.slice(5, 7)) + '. ' + k.slice(0, 4)
    : intl({ day: 'numeric', month: 'numeric', year: 'numeric' }).format(zKlice(k));
  const datumDlouze = k => jazyk() === 'cs' ? (+k.slice(8, 10)) + '. ' + MESICE_2P[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4)
    : intl({ day: 'numeric', month: 'long', year: 'numeric' }).format(zKlice(k));
  const mesicNazev = m => jazyk() === 'cs' ? MESICE[m - 1] : intl({ month: 'long' }).format(Date.UTC(2026, m - 1, 15));
  const denNazev = wd => jazyk() === 'cs' ? DNY[wd] : intl({ weekday: 'long' }).format(Date.UTC(2026, 1, 1 + wd)); // 1. 2. 2026 = neděle
  const denZkratka = wd => jazyk() === 'cs' ? ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'][wd] : intl({ weekday: 'short' }).format(Date.UTC(2026, 1, 1 + wd));
  const rozsahText = (od, dok) => od === dok ? datumText(od)
    : (od.slice(0, 4) === dok.slice(0, 4) ? (+od.slice(8, 10)) + '. ' + (+od.slice(5, 7)) + '. – ' : datumText(od) + ' – ') + datumText(dok);

  const NAZVY_ZIDOVSKE = { Tishri: 'tišri', Heshvan: 'chešvan', Kislev: 'kislev', Tevet: 'tevet', Shevat: 'švat', Adar: 'adar', Nisan: 'nisan', Iyar: 'ijar', Sivan: 'sivan', Tamuz: 'tamuz', Av: 'av', Elul: 'elul' };
  const NAZVY_ISLAMSKE = ['muharram', 'safar', 'rabí al-awwal', 'rabí as-sání', 'džumáda al-úlá', 'džumáda al-áchira', 'radžab', 'ša‘bán', 'ramadán', 'šawwál', 'zú al-ka‘da', 'zú al-hidždža'];
  const NAZVY_TYDNE = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  const PORADI = ['', '1.', '2.', '3.', '4.', '5.'];
  function pravidloText(kdy) {
    const d = kdy.delka && kdy.delka > 1 ? ' (' + kdy.delka + ' dní)' : '';
    const p = kdy.posun || 0;
    const posunT = (n, co) => n === 0 ? co : (Math.abs(n) + (Math.abs(n) === 1 ? ' den ' : Math.abs(n) < 5 ? ' dny ' : ' dní ') + (n < 0 ? 'před ' : 'po ') + co);
    switch (kdy.typ) {
      case 'pevne': return 'každý rok ' + kdy.d + '. ' + MESICE_2P[kdy.m - 1] + d;
      case 'obdobi': return 'období od ' + kdy.d + '. ' + MESICE_2P[kdy.m - 1] + d;
      case 'velikonoce': return posunT(p, 'Velikonoční nedělí (západní)');
      case 'pravoslavne': return posunT(p, 'pravoslavnou Velikonoční nedělí');
      case 'cinsky': return kdy.d + '. den ' + kdy.m + '. měsíce čínského lunárního kalendáře' + d;
      case 'islamsky': return kdy.d + '. ' + NAZVY_ISLAMSKE[kdy.m - 1] + ' (islámský kalendář)' + d;
      case 'zidovsky': return kdy.d + '. ' + (NAZVY_ZIDOVSKE[kdy.m] || kdy.m) + ' (židovský kalendář)' + d;
      case 'tyden': return (kdy.n > 0 ? PORADI[kdy.n] : 'poslední') + ' ' + NAZVY_TYDNE[kdy.wd] + ' v ' + MESICE_6P[kdy.m - 1] + (p ? (p < 0 ? ' − ' : ' + ') + Math.abs(p) + (Math.abs(p) === 1 ? ' den' : Math.abs(p) < 5 ? ' dny' : ' dní') : '') + d;
      case 'vrozsahu': return NAZVY_TYDNE[kdy.wd] + ' mezi ' + kdy.od + '. a ' + (kdy.od + 6) + '. ' + MESICE_2P[kdy.m - 1];
      case 'slunecni': return ({ 'Winter Solstice': 'zimní slunovrat', 'Summer Solstice': 'letní slunovrat', 'Spring Equinox': 'jarní rovnodennost', 'Autumnal Equinox': 'podzimní rovnodennost', 'Clear and Bright': 'sluneční člen Čching-ming', 'Beginning of Spring': 'začátek jara (Li-čchun)' })[kdy.clen] + ' podle čínského kalendáře';
      case 'tabulka': return 'podle lunisolárního kalendáře, data z tabulky' + d;
      default: return '';
    }
  }

  /* ---------- země ---------- */
  const ZVLASTNI = {
    'GB-SCT': { n: 'Skotsko', v: '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}', mapa: 'GB' },
    'GB-WLS': { n: 'Wales', v: '🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}', mapa: 'GB' },
    'GB-ENG': { n: 'Anglie', v: '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', mapa: 'GB' }
  };
  const nazvy = {};
  function nazvyZemi() {
    const j = jazyk();
    if (!(j in nazvy)) {
      try { nazvy[j] = new Intl.DisplayNames([j, 'cs'], { type: 'region' }); } catch (e) { nazvy[j] = null; /* starý prohlížeč */ }
    }
    return nazvy[j];
  }
  const vlajka = kod => ZVLASTNI[kod] ? ZVLASTNI[kod].v
    : /^[A-Z]{2}$/.test(kod) ? String.fromCodePoint(...[...kod].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🏳️';
  const nazevZeme = kod => ZVLASTNI[kod] ? ZVLASTNI[kod].n : (nazvyZemi() ? nazvyZemi().of(kod) : kod);
  const mapovyKod = kod => ZVLASTNI[kod] ? ZVLASTNI[kod].mapa : kod.slice(0, 2);

  const KULTURY = {
    krestanske: { n: 'Křesťanské', e: '✝️' },
    pravoslavne: { n: 'Pravoslavné', e: '☦️' },
    zidovske: { n: 'Židovské', e: '✡️' },
    islamske: { n: 'Islámské', e: '☪️' },
    hinduisticke: { n: 'Hinduistické', e: '🕉️' },
    vychodoasijske: { n: 'Východoasijské', e: '🏮' },
    persko: { n: 'Perské', e: '🌱' },
    lidove: { n: 'Lidové', e: '🌾' },
    statni: { n: 'Státní svátky', e: '🎆' },
    novodobe: { n: 'Novodobé dny', e: '🛒' },
    pohanske: { n: 'Pohanské a antické', e: '🔥' }
  };
  // historické epochy (pole `doba` položky); s = skupina pro nabídku a časovou osu
  const DOBY = {
    'egypt': { n: 'Starověký Egypt', od: -3100, do: -30, e: '🔺', s: 'starovek' },
    'mezopotamie': { n: 'Mezopotámie', od: -3500, do: -539, e: '🏺', s: 'starovek' },
    'indie-stara': { n: 'Starověká Indie', od: -1500, do: 500, e: '🪷', s: 'starovek' },
    'recko': { n: 'Antické Řecko', od: -800, do: -146, e: '🏛️', s: 'starovek' },
    'persie-stara': { n: 'Starověká Persie', od: -550, do: 651, e: '🦁', s: 'starovek' },
    'keltove': { n: 'Keltové', od: -800, do: 100, e: '🌀', s: 'starovek' },
    'rim': { n: 'Antický Řím', od: -753, do: 476, e: '🏟️', s: 'starovek' },
    'cina-stara': { n: 'Čína dynastií Chan až Tchang', od: -206, do: 907, e: '🐉', s: 'starovek' },
    'mezoamerika': { n: 'Mayové a Aztékové', od: -1000, do: 1521, e: '🌽', s: 'starovek' },
    'byzanc': { n: 'Byzanc', od: 330, do: 1453, e: '☦️', s: 'stredovek' },
    'slovane': { n: 'Předkřesťanští Slované', od: 500, do: 1000, e: '🌾', s: 'stredovek' },
    'vikingove': { n: 'Germáni a Vikingové', od: 200, do: 1100, e: '🛶', s: 'stredovek' },
    'abbasovci': { n: 'Islámský zlatý věk', od: 750, do: 1258, e: '🕌', s: 'stredovek' },
    'heian': { n: 'Japonsko Heian', od: 794, do: 1185, e: '🎎', s: 'stredovek' },
    'stredovek': { n: 'Středověká Evropa', od: 500, do: 1500, e: '🏰', s: 'stredovek' },
    'cechy-stredovek': { n: 'Přemyslovci a Lucemburkové', od: 900, do: 1437, e: '👑', s: 'stredovek' },
    'inkove': { n: 'Inkové', od: 1438, do: 1533, e: '🦙', s: 'stredovek' },
    'renesance': { n: 'Renesance', od: 1400, do: 1620, e: '🎨', s: 'novovek' },
    'tudorovci': { n: 'Tudorovská Anglie', od: 1485, do: 1603, e: '🌹', s: 'novovek' },
    'osmanska': { n: 'Osmanská říše', od: 1299, do: 1922, e: '☪️', s: 'novovek' },
    'ming-cching': { n: 'Čína dynastií Ming a Čching', od: 1368, do: 1912, e: '🏮', s: 'novovek' },
    'mughalove': { n: 'Mughalská Indie', od: 1526, do: 1857, e: '🐘', s: 'novovek' },
    'edo': { n: 'Japonsko Edo', od: 1603, do: 1868, e: '🗾', s: 'novovek' },
    'baroko': { n: 'Baroko', od: 1620, do: 1740, e: '⛪', s: 'novovek' },
    'kolonialni-amerika': { n: 'Koloniální Amerika', od: 1607, do: 1783, e: '🦃', s: 'novovek' },
    'stary-rezim': { n: 'Francie starého režimu', od: 1643, do: 1789, e: '⚜️', s: 'novovek' },
    'terezianska': { n: 'Tereziánská doba', od: 1740, do: 1780, e: '👸', s: 'novovek' },
    'napoleonska': { n: 'Napoleonská doba', od: 1799, do: 1815, e: '🎖️', s: 'stoleti19' },
    'biedermeier': { n: 'Biedermeier a obrození', od: 1815, do: 1848, e: '🕯️', s: 'stoleti19' },
    'carske-rusko': { n: 'Carské Rusko', od: 1721, do: 1917, e: '🪆', s: 'stoleti19' },
    'viktorianska': { n: 'Viktoriánská Anglie', od: 1837, do: 1901, e: '🎩', s: 'stoleti19' },
    'rakousko-uhersko': { n: 'Rakousko-Uhersko', od: 1867, do: 1918, e: '🦅', s: 'stoleti19' },
    'belle-epoque': { n: 'Belle époque', od: 1871, do: 1914, e: '🥂', s: 'stoleti19' },
    'prvni-republika': { n: 'První republika', od: 1918, do: 1938, e: '🎩', s: 'stoleti20' },
    'valka': { n: 'Válka a přídělový systém', od: 1939, do: 1954, e: '🎫', s: 'stoleti20' },
    'sovetsky-svaz': { n: 'Sovětský svaz', od: 1922, do: 1991, e: '☭', s: 'stoleti20' },
    'socialismus': { n: 'Socialistické Československo', od: 1948, do: 1989, e: '🏭', s: 'stoleti20' },
    'povalecna-amerika': { n: 'Poválečná Amerika', od: 1945, do: 1970, e: '📺', s: 'stoleti20' }
  };
  const SKUPINY_DOB = { starovek: 'Starověk', stredovek: 'Středověk', novovek: 'Raný novověk', stoleti19: '19. století', stoleti20: '20. století' };
  const rokText = r => r < 0 ? (-r) + (jazyk() === 'cs' ? ' př. n. l.' : ' BC') : String(r);
  const dobaText = id => { const d = DOBY[id]; return d ? d.n + ' (' + rokText(d.od) + '–' + rokText(d.do) + ')' : id; };

  const KONTINENTY = { EU: 'Evropa', AS: 'Asie', AF: 'Afrika', SA: 'Severní Amerika', JA: 'Jižní Amerika', OC: 'Oceánie' };

  /* ---------- hledání ---------- */
  const bezDiakritiky = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function textPolozky(p) {
    if (!p._t) {
      const r = p.recept || {};
      p._t = bezDiakritiky([p.jidlo, p.prilezitost, p.misto, p.proc, r.nazev, (r.suroviny || []).join(' '),
        p.doba ? DOBY[p.doba] && DOBY[p.doba].n : '', p.pramen || '',
        p.zeme.map(nazevZeme).join(' ')].join(' '));
    }
    return p._t;
  }
  function hledej(data, dotaz) {
    const slova = bezDiakritiky(dotaz).split(/\s+/).filter(Boolean);
    if (!slova.length) return data.slice();
    return data.filter(p => slova.every(s => textPolozky(p).includes(s)));
  }

  /* ---------- kontrola dat ---------- */
  function zkontroluj(data) {
    const chyby = [], ids = new Set();
    const TYPY = ['pevne', 'obdobi', 'velikonoce', 'pravoslavne', 'cinsky', 'islamsky', 'zidovsky', 'tyden', 'vrozsahu', 'tabulka', 'slunecni'];
    for (const p of data) {
      const id = p.id || '(bez id)';
      if (ids.has(id)) chyby.push(id + ': duplicitní id'); ids.add(id);
      for (const pole of ['jidlo', 'prilezitost', 'proc', 'kultura']) if (!p[pole]) chyby.push(id + ': chybí ' + pole);
      if (!Array.isArray(p.zeme) || !p.zeme.length) chyby.push(id + ': chybí zeme');
      else for (const z of p.zeme) if (!/^[A-Z]{2}$/.test(z) && !ZVLASTNI[z]) chyby.push(id + ': neznámá země ' + z);
      if (!KULTURY[p.kultura]) chyby.push(id + ': neznámá kultura ' + p.kultura);
      if (p.doba && !DOBY[p.doba]) chyby.push(id + ': neznámá doba ' + p.doba);
      if (!p.kdy || !TYPY.includes(p.kdy.typ)) chyby.push(id + ': neznámý typ kdy');
      if (!p.recept || !(p.recept.suroviny || []).length || !(p.recept.postup || []).length) chyby.push(id + ': chybí recept');
    }
    return chyby;
  }

  koren.SUS = {
    klic, zKlice, naKlic, posun, denTydne, dnesKlic, dniVMesici,
    velikonoce, pravoslavneVelikonoce, intlOk, zacatky, vyskyty, maTabulku, jeObdobi,
    indexRoku, naDen, pristi, pravidloText, datumText, datumDlouze, rozsahText,
    vlajka, nazevZeme, mesicNazev, denNazev, denZkratka, DOBY, SKUPINY_DOB, dobaText, rokText, mapovyKod, KULTURY, KONTINENTY, MESICE, MESICE_2P, DNY,
    bezDiakritiky, hledej, zkontroluj
  };
})(typeof window !== 'undefined' ? window : globalThis);
