// Tiskopisy – výpočty bez DOM (kalendář, svátky, šířky sloupců). Testováno v node.
(function (koren) {
  'use strict';

  const DNY = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];

  // Velikonoční neděle (gregoriánský kalendář, Meeus/Jones/Butcher).
  function velikonoce(rok) {
    const a = rok % 19, b = Math.floor(rok / 100), c = rok % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mesic = Math.floor((h + l - 7 * m + 114) / 31);
    const den = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(rok, mesic - 1, den));
  }

  const iso = d => d.toISOString().slice(0, 10);

  // Státní svátky a ostatní svátky ČR (zákon č. 245/2000 Sb.) → { 'RRRR-MM-DD': název }
  function svatky(rok) {
    const p = (m, d) => `${rok}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const v = velikonoce(rok).getTime(), DEN = 864e5;
    return {
      [p(1, 1)]: 'Den obnovy samostatného českého státu, Nový rok',
      [iso(new Date(v - 2 * DEN))]: 'Velký pátek',
      [iso(new Date(v + DEN))]: 'Velikonoční pondělí',
      [p(5, 1)]: 'Svátek práce',
      [p(5, 8)]: 'Den vítězství',
      [p(7, 5)]: 'Den slovanských věrozvěstů Cyrila a Metoděje',
      [p(7, 6)]: 'Den upálení mistra Jana Husa',
      [p(9, 28)]: 'Den české státnosti',
      [p(10, 28)]: 'Den vzniku samostatného československého státu',
      [p(11, 17)]: 'Den boje za svobodu a demokracii',
      [p(12, 24)]: 'Štědrý den',
      [p(12, 25)]: '1. svátek vánoční',
      [p(12, 26)]: '2. svátek vánoční',
    };
  }

  // Dny měsíce ('RRRR-MM') s příznakem víkendu a svátku.
  function dnyMesice(rokMesic) {
    const [rok, mesic] = String(rokMesic).split('-').map(Number);
    if (!rok || !mesic) return [];
    const sv = svatky(rok), dny = [];
    const pocet = new Date(Date.UTC(rok, mesic, 0)).getUTCDate();
    for (let den = 1; den <= pocet; den++) {
      const d = new Date(Date.UTC(rok, mesic - 1, den));
      const tyden = d.getUTCDay();
      dny.push({ den, datum: iso(d), zkratka: DNY[tyden], vikend: tyden === 0 || tyden === 6, svatek: sv[iso(d)] || '' });
    }
    return dny;
  }

  // Pracovní dny měsíce (bez víkendů a svátků) – pro fond pracovní doby.
  const pracovniDny = rokMesic => dnyMesice(rokMesic).filter(d => !d.vikend && !d.svatek).length;

  // Relativní šířky sloupců → mm tak, aby součet přesně vyplnil šířku listu.
  function sirkySloupcu(sloupce, sirkaMm) {
    const soucet = sloupce.reduce((s, c) => s + c.sirka, 0) || 1;
    return sloupce.map(c => Math.round(c.sirka / soucet * sirkaMm * 10) / 10);
  }

  // Text s jednou položkou na řádek → pole neprázdných řádků.
  const radkyTextu = text => String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  const NAZVY_MESICU = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  function nazevMesice(rokMesic) {
    const [rok, mesic] = String(rokMesic).split('-').map(Number);
    return rok && mesic ? `${NAZVY_MESICU[mesic - 1]} ${rok}` : '';
  }

  // 'RRRR-MM-DD' → 'D. M. RRRR'
  function datumCesky(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : (s || '');
  }

  // ---------- částka slovy (pokladní doklady) ----------
  const JEDNOTKY = ['', 'jedna', 'dva', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět', 'deset', 'jedenáct', 'dvanáct',
    'třináct', 'čtrnáct', 'patnáct', 'šestnáct', 'sedmnáct', 'osmnáct', 'devatenáct'];
  const DESITKY = ['', '', 'dvacet', 'třicet', 'čtyřicet', 'padesát', 'šedesát', 'sedmdesát', 'osmdesát', 'devadesát'];
  const STOVKY = ['', 'sto', 'dvěstě', 'třista', 'čtyřista', 'pětset', 'šestset', 'sedmset', 'osmset', 'devětset'];

  // 0–999 slovy. `muz` = mužský rod (jeden tisíc, dva miliony); ženský jen u samostatných 1 a 2 (jedna koruna, dvě koruny).
  function trojice(n, muz) {
    const zb = n % 100, j = zb % 10;
    let t = STOVKY[Math.floor(n / 100)];
    if (zb === 1 && n === 1 && !muz) return 'jedna';
    if (zb === 2 && n === 2 && !muz) return 'dvě';
    if (zb < 20) t += zb === 1 && muz ? 'jeden' : JEDNOTKY[zb];
    else t += DESITKY[Math.floor(zb / 10)] + (j === 1 && muz ? 'jeden' : JEDNOTKY[j]);
    return t;
  }
  // tvar podstatného jména: 1 → první, 2–4 → druhý, jinak třetí (dvacet jedna korun, pět korun)
  const tvar = (n, jedna, dve, pet) => n === 1 ? jedna : n >= 2 && n <= 4 ? dve : pet;

  // Celé číslo slovy bez mezer (zvyk na pokladních dokladech – mezi slova se nedá nic vepsat).
  function cisloSlovy(n, muz) {
    if (n === 0) return 'nula';
    const mil = Math.floor(n / 1e6), tis = Math.floor(n / 1e3) % 1000, zb = n % 1000;
    let t = '';
    if (mil) t += trojice(mil, true) + tvar(mil, 'milion', 'miliony', 'milionů');
    if (tis) t += trojice(tis, true) + tvar(tis, 'tisíc', 'tisíce', 'tisíc');
    if (zb) t += trojice(zb, muz);
    return t;
  }

  // '1 250,50' → 'jedentisícdvěstěpadesát korun českých a padesát haléřů'
  function castkaSlovy(vstup) {
    const syrove = String(vstup ?? '').replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(syrove)) return '';
    const halere = Math.round(parseFloat(syrove) * 100), kc = Math.floor(halere / 100), h = halere % 100;
    if (kc >= 1e9) return '';
    let t = cisloSlovy(kc, false) + ' ' + tvar(kc, 'koruna česká', 'koruny české', 'korun českých');
    if (h) t += ' a ' + cisloSlovy(h, true) + ' ' + tvar(h, 'haléř', 'haléře', 'haléřů');
    return t;
  }

  // ---------- předtištěné řádky ----------
  // Řádek textu = řádek tabulky; buňky oddělené „|“ jdou postupně do sloupců `idSloupcu`.
  // „# Nadpis“ = mezititulek přes celou šířku.
  function parsujRadky(text, idSloupcu) {
    return String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(radek => {
      if (radek.startsWith('#')) return { _oddil: radek.replace(/^#+\s*/, '') };
      const bunky = radek.split('|').map(s => s.trim());
      const r = {};
      idSloupcu.forEach((id, i) => { if (bunky[i]) r[id] = bunky[i]; });
      return r;
    });
  }

  // ---------- jednoduchý zápis textu pokynů → HTML (vše escapované) ----------
  // „# “ nadpis, „## “ podnadpis, „- “ odrážka, „a | text“ řádek legendy, **tučně**, prázdný řádek = nový odstavec.
  const escHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function textNaHtml(text) {
    const radky = String(text || '').split(/\r?\n/);
    const out = [];
    let blok = null, obsah = [];
    const uzavri = () => {
      if (!blok) return;
      if (blok === 'p') out.push('<p>' + obsah.join(' ') + '</p>');
      if (blok === 'ul') out.push('<ul>' + obsah.map(x => '<li>' + x + '</li>').join('') + '</ul>');
      if (blok === 'tab') out.push('<table class="legenda">' + obsah.map(b => '<tr>' + b.map(x => '<td>' + x + '</td>').join('') + '</tr>').join('') + '</table>');
      blok = null; obsah = [];
    };
    const inl = s => escHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    for (const syrovy of radky) {
      const r = syrovy.trim();
      if (!r) { uzavri(); continue; }
      let m;
      if ((m = /^(#{1,2})\s+(.*)$/.exec(r))) { uzavri(); out.push(m[1].length === 1 ? `<h2>${inl(m[2])}</h2>` : `<h3>${inl(m[2])}</h3>`); continue; }
      const typ = r.startsWith('- ') ? 'ul' : r.includes(' | ') ? 'tab' : 'p';
      if (typ !== blok) { uzavri(); blok = typ; }
      obsah.push(typ === 'ul' ? inl(r.slice(2)) : typ === 'tab' ? r.split(' | ').map(inl) : inl(r));
    }
    uzavri();
    return out.join('\n');
  }

  // ---------- šablona ----------
  const ZAKLAD = {
    nazev: 'Tiskopis', predpis: '', rezim: 'tabulka', orientace: 'na_vysku', vyskaRadku: 8, stran: 1, kopii: 1,
    titulni: false, titulniRadky: [], pouceni: false, pouceniText: '', cislovat: false,
    udaje: [], sloupce: [], predvyplnene: '', soucet: '', zaver: '', podpisy: [],
    seznam: null, mesic: null, minRadku: 0, bezDoplneni: false,
  };
  const SIRKY_UDAJU = [0, 25, 33, 50, 67, 100];
  const cislo = (v, min, max, vychozi) => { const n = parseFloat(v); return isFinite(n) ? Math.min(max, Math.max(min, n)) : vychozi; };
  const text = v => (v == null ? '' : String(v));
  const pole = v => (Array.isArray(v) ? v.map(text) : []);

  // Doplní chybějící vlastnosti a srovná typy – i pro šablonu z importovaného souboru.
  function normalizujSablonu(s) {
    s = s && typeof s === 'object' ? s : {};
    const v = Object.assign({}, ZAKLAD, s);
    const ids = new Set();
    const unik = (id, pref, i) => { let x = text(id).replace(/[^\w-]/g, '') || pref + i; while (ids.has(x)) x += '_'; ids.add(x); return x; };
    return Object.assign(v, {
      nazev: text(v.nazev) || ZAKLAD.nazev, predpis: text(v.predpis),
      rezim: v.rezim === 'doklad' ? 'doklad' : 'tabulka',
      orientace: v.orientace === 'na_sirku' ? 'na_sirku' : 'na_vysku',
      vyskaRadku: cislo(v.vyskaRadku, 4, 60, 8), stran: Math.round(cislo(v.stran, 1, 200, 1)),
      kopii: Math.round(cislo(v.kopii, 1, 4, 1)), minRadku: Math.round(cislo(v.minRadku, 0, 2000, 0)),
      titulni: !!v.titulni, pouceni: !!v.pouceni, cislovat: !!v.cislovat, bezDoplneni: !!v.bezDoplneni,
      titulniRadky: pole(v.titulniRadky), podpisy: pole(v.podpisy),
      pouceniText: text(v.pouceniText), predvyplnene: text(v.predvyplnene), soucet: text(v.soucet), zaver: text(v.zaver),
      udaje: (Array.isArray(v.udaje) ? v.udaje : []).filter(u => u && typeof u === 'object').map((u, i) => ({
        id: unik(u.id, 'u', i), popisek: text(u.popisek), sirka: SIRKY_UDAJU.includes(+u.sirka) ? +u.sirka : 0,
        typ: ['nadpis', 'zlom', 'date'].includes(u.typ) ? u.typ : '', radku: Math.round(cislo(u.radku, 1, 20, 1)),
        vypocet: !!u.vypocet, vychozi: text(u.vychozi),
      })),
      sloupce: (Array.isArray(v.sloupce) ? v.sloupce : []).filter(c => c && typeof c === 'object').map((c, i) => ({
        id: unik(c.id, 's', i), nazev: text(c.nazev), sirka: cislo(c.sirka, 1, 200, 10), znak: text(c.znak).slice(0, 3),
        cislo: !!c.cislo, skryty: !!c.skryty,
      })),
      seznam: v.seznam && typeof v.seznam === 'object' ? { popisek: text(v.seznam.popisek), naOsobu: text(v.seznam.naOsobu), doSloupce: text(v.seznam.doSloupce) } : null,
      mesic: v.mesic && typeof v.mesic === 'object' ? { radky: text(v.mesic.radky), svatekDo: text(v.mesic.svatekDo), sloupce: !!v.mesic.sloupce, sirkaDne: cislo(v.mesic.sirkaDne, 2, 20, 5) } : null,
    });
  }

  // Sloupce pro dny měsíce (směnný rozpis, denní kontroly). Bez zvoleného měsíce 1–31 bez dní v týdnu.
  function sloupceDnu(rokMesic, sirka) {
    const dny = dnyMesice(rokMesic);
    if (!dny.length) return Array.from({ length: 31 }, (_, i) => ({ id: 'd' + (i + 1), nazev: String(i + 1), sirka, den: true }));
    return dny.map(d => ({ id: 'd' + d.den, nazev: String(d.den), pod: d.zkratka, sirka, den: true, vikend: d.vikend || !!d.svatek }));
  }

  const api = {
    velikonoce, svatky, dnyMesice, pracovniDny, sirkySloupcu, radkyTextu, nazevMesice, datumCesky,
    cisloSlovy, castkaSlovy, parsujRadky, textNaHtml, normalizujSablonu, sloupceDnu, escHtml,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else koren.TISK_JADRO = api;
})(typeof self !== 'undefined' ? self : this);
