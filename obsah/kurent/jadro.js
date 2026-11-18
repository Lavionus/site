/* Čtení kurentu – jádro bez DOM: převod textu do znaků písma, hodnocení odpovědi, výběr cvičení, opakování (SRS).
   V prohlížeči window.KurentJadro, v node module.exports. */
(function (koren) {
'use strict';

const KLIC = 'webapp_kurent';

/* ---------- převod textu na znaky písma Wiegel Kurrent ---------- */
// ligatury jsou v soukromé oblasti Unicode písma (písmo nemá tabulku GSUB) – delší dřív
const LIG = [
  ['ſſi', ''], ['ſſt', ''], ['ſſk', ''], ['ſch', ''],
  ['ch', ''], ['ck', ''], ['tz', ''], ['tt', ''], ['ll', ''],
  ['mm', ''], ['nn', ''], ['ſſ', ''], ['ſs', ''], ['ſh', ''], ['ſi', ''],
  ['ſl', ''], ['ſk', ''], ['ſj', ''], ['ft', ''], ['fj', ''],
  ['ff', 'ﬀ'], ['fi', 'ﬁ'], ['fl', 'ﬂ']
];
// české znaky, které písmo nemá: základ + znaménko kreslené zvlášť (ů = n s kroužkem místo obloučku u)
const ZNAMENKA = {
  'č': ['c', 'ˇ'], 'ď': ['d', 'ˇ'], 'ě': ['e', 'ˇ'], 'ň': ['n', 'ˇ'], 'ř': ['r', 'ˇ'], 'š': ['s', 'ˇ'],
  'ť': ['t', 'ˇ'], 'ž': ['z', 'ˇ'], 'ů': ['n', '°'],
  'Č': ['C', 'ˇ'], 'Ď': ['D', 'ˇ'], 'Ě': ['E', 'ˇ'], 'Ň': ['N', 'ˇ'], 'Ř': ['R', 'ˇ'], 'Š': ['S', 'ˇ'],
  'Ť': ['T', 'ˇ'], 'Ž': ['Z', 'ˇ'], 'Ů': ['U', '°']
};
const jePismeno = ch => !!ch && /\p{L}/u.test(ch);

/* text → pole úseků {z: znaky pro písmo, d: znaménko nebo ''}.
   opt.dlouheS (výchozí true): s uvnitř slova → ſ, na konci slova kulaté s; „|“ za s vynutí kulaté s (Haus|tür).
   opt.ligatury (výchozí true): ch, ck, tz, mm (m s čárkou)… */
function prevod(text, opt) {
  opt = Object.assign({ dlouheS: true, ligatury: true }, opt);
  const zn = Array.from(String(text || '').normalize('NFC'));
  const jednotky = [];
  for (let i = 0; i < zn.length; i++) {
    let ch = zn[i];
    if (ch === '|') continue;                       // jen značka hranice slabiky
    let d = '';
    if (ZNAMENKA[ch]) { d = ZNAMENKA[ch][1]; ch = ZNAMENKA[ch][0]; }
    if (ch === 's' && opt.dlouheS) {
      const dalsi = zn[i + 1];
      if (dalsi !== '|' && jePismeno(dalsi)) ch = 'ſ';
    }
    jednotky.push({ z: ch, d });
  }
  if (!opt.ligatury) return jednotky;
  const vysl = [];
  for (let i = 0; i < jednotky.length;) {
    let hotovo = false;
    if (!jednotky[i].d) {
      for (const [sek, g] of LIG) {
        const n = sek.length;
        if (i + n > jednotky.length) continue;
        let ok = true;
        for (let k = 0; k < n; k++) if (jednotky[i + k].d || jednotky[i + k].z !== sek[k]) { ok = false; break; }
        if (ok) { vysl.push({ z: g, d: '' }); i += n; hotovo = true; break; }
      }
    }
    if (!hotovo) { vysl.push(jednotky[i]); i++; }
  }
  // sousední úseky bez znaménka slít do jednoho
  const slite = [];
  for (const u of vysl) {
    const p = slite[slite.length - 1];
    if (p && !p.d && !u.d) p.z += u.z; else slite.push({ z: u.z, d: u.d });
  }
  return slite;
}

/* ---------- hodnocení odpovědi ---------- */
// sjednocení pro porovnání: malá písmena, bez diakritiky a interpunkce, ſ→s, ß→ss
function normalizuj(s) {
  return String(s || '').toLowerCase().replace(/ſ/g, 's').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
// jen malá písmena, ſ/ß a mezery – diakritika zůstává (pro rozlišení „přesně“)
function jemne(s) {
  return String(s || '').toLowerCase().replace(/ſ/g, 's').replace(/ß/g, 'ss').normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function levenshtein(a, b) {
  if (a === b) return 0;
  let pred = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const rad = [i];
    for (let j = 1; j <= b.length; j++)
      rad[j] = Math.min(pred[j] + 1, rad[j - 1] + 1, pred[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    pred = rad;
  }
  return pred[b.length];
}
/* odpověď vs. správné znění (+ alternativy) → {stav: 'presne'|'diakritika'|'skoro'|'spatne', ok, vzdalenost}
   'diakritika' = správně, liší se jen diakritikou nebo velikostí písmen; 'skoro' = překlep (počítá se jako chyba). */
function hodnot(odpoved, spravne, alternativy) {
  const moznosti = [spravne].concat(alternativy || []);
  const n = normalizuj(odpoved);
  if (!n) return { stav: 'spatne', ok: false, vzdalenost: Infinity };
  let nejmene = Infinity;
  for (const m of moznosti) {
    if (jemne(odpoved) === jemne(m)) return { stav: 'presne', ok: true, vzdalenost: 0 };
    const nm = normalizuj(m);
    if (n === nm) return { stav: 'diakritika', ok: true, vzdalenost: 0 };
    const v = levenshtein(n, nm);
    const tolerance = nm.length >= 12 ? 2 : nm.length >= 5 ? 1 : 0;
    if (v <= tolerance) nejmene = Math.min(nejmene, v);
  }
  if (nejmene !== Infinity) return { stav: 'skoro', ok: false, vzdalenost: nejmene };
  return { stav: 'spatne', ok: false, vzdalenost: Infinity };
}

/* ---------- úrovně a položky ---------- */
const UROVNE = [
  { id: 1, nazev: 'Malá písmena', popis: 'Poznej jedno malé písmeno ze čtyř možností.' },
  { id: 2, nazev: 'Velká písmena a ligatury', popis: 'Velká písmena, přehlásky a spřežky.' },
  { id: 3, nazev: 'Krátká slova', popis: 'Krátká slova, měsíce, jména a místa – opiš je.' },
  { id: 4, nazev: 'Matriční výrazy', popis: 'getauft, ehelich, povolání, nemoci, česká slova kurentem.' },
  { id: 5, nazev: 'Celé obraty', popis: 'Úseky zápisů z matrik, tenčí písmo a sklon.' },
  { id: 6, nazev: 'Moje řádky', popis: 'Výřezy řádků z vašich vlastních přepisů – skutečné rukopisy.' }
];
/* položky pro úroveň (a volitelně kategorii slov) z dat */
function polozky(data, uroven, kategorie) {
  if (uroven === 1) return data.MALA.map(([z, t]) => ({ id: 'p:' + z, typ: 'pismeno', text: z, popis: t }));
  if (uroven === 2) return data.VELKA.map(([z, t]) => ({ id: 'p:' + z, typ: 'pismeno', text: z, popis: t }))
    .concat(data.LIGATURY.map(([z, t]) => ({ id: 'l:' + z, typ: 'pismeno', text: z, popis: t })));
  return data.SLOVA
    .filter(s => s[4] === uroven && (!kategorie || s[3] === kategorie))
    .map(([t, v, j, k, u, alt]) => ({ id: 'w:' + t, typ: 'slovo', text: t, vyznam: v, jazyk: j, kategorie: k, uroven: u, alt: alt || [] }));
}
/* čtyři možnosti pro písmeno: správná + podobná ze skupiny + náhodné ze stejné úrovně */
function moznosti(polozka, vsechny, podobna, rng) {
  rng = rng || Math.random;
  const vysl = [polozka.text];
  const skup = podobna.find(p => p.znaky.includes(polozka.text));
  const kandidati = (skup ? skup.znaky.filter(z => z !== polozka.text && vsechny.some(v => v.text === z)) : []);
  michej(kandidati, rng);
  for (const k of kandidati) if (vysl.length < 4 && !vysl.includes(k)) vysl.push(k);
  const ostatni = michej(vsechny.map(v => v.text).filter(t => !vysl.includes(t)), rng);
  for (const k of ostatni) if (vysl.length < 4) vysl.push(k);
  return michej(vysl, rng);
}
function michej(pole, rng) {
  rng = rng || Math.random;
  for (let i = pole.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pole[i], pole[j]] = [pole[j], pole[i]]; }
  return pole;
}

/* ---------- opakování s rostoucími intervaly (Leitnerovy přihrádky 0–5) ---------- */
const MIN = 60e3, DEN = 864e5;
const INTERVALY = [1 * MIN, 10 * MIN, 1 * DEN, 3 * DEN, 7 * DEN, 21 * DEN];
function prazdnySrs() { return { v: 1, karty: {} }; }
function migruj(s) {
  if (!s || typeof s !== 'object' || !s.karty || typeof s.karty !== 'object') return prazdnySrs();
  return { v: 1, karty: s.karty };
}
/* zápis výsledku: ok → o přihrádku výš; skoro → zůstává, brzy znovu; chyba → přihrádka 0, za minutu znovu */
function zaznam(srs, id, stav, ted) {
  const k = srs.karty[id] || (srs.karty[id] = { b: 0, due: 0, n: 0, ok: 0, chyb: 0, posl: 0 });
  k.n++; k.posl = ted;
  if (stav === 'presne' || stav === 'diakritika' || stav === true) {
    k.ok++; k.b = Math.min(k.b + 1, INTERVALY.length - 1); k.due = ted + INTERVALY[k.b];
  } else if (stav === 'skoro') {
    k.chyb++; k.due = ted + INTERVALY[1];
  } else {
    k.chyb++; k.b = 0; k.due = ted + INTERVALY[0];
  }
  return k;
}
/* další položka: nejdřív splatné opakování (nejstarší), pak nové, jinak ta s nejbližším termínem.
   Nikdy hned stejnou jako posledně (je-li z čeho vybírat). */
function vyberDalsi(seznam, srs, ted, rng, posledniId) {
  rng = rng || Math.random;
  const kandidati = seznam.length > 1 ? seznam.filter(p => p.id !== posledniId) : seznam.slice();
  if (!kandidati.length) return null;
  const splatne = kandidati.filter(p => srs.karty[p.id] && srs.karty[p.id].due <= ted)
    .sort((a, b) => srs.karty[a.id].due - srs.karty[b.id].due);
  if (splatne.length) return splatne[0];
  const nove = kandidati.filter(p => !srs.karty[p.id]);
  if (nove.length) return nove[Math.floor(rng() * nove.length)];
  return kandidati.slice().sort((a, b) => srs.karty[a.id].due - srs.karty[b.id].due)[0];
}
/* přehled pro seznam položek: nové / učím se (přihrádka 0–2) / umím (3+) / splatné teď */
function prehled(seznam, srs, ted) {
  const p = { celkem: seznam.length, nove: 0, ucim: 0, umim: 0, splatne: 0 };
  for (const it of seznam) {
    const k = srs.karty[it.id];
    if (!k) { p.nove++; continue; }
    if (k.b >= 3) p.umim++; else p.ucim++;
    if (k.due <= ted) p.splatne++;
  }
  return p;
}
/* nejčastější chyby (id, počet chyb, poměr) – pro procvičení chyb */
function nejhorsi(srs, pocet) {
  return Object.entries(srs.karty).filter(([, k]) => k.chyb > 0)
    .map(([id, k]) => ({ id, chyb: k.chyb, n: k.n, b: k.b, pomer: k.chyb / k.n }))
    .sort((a, b) => b.pomer - a.pomer || b.chyb - a.chyb).slice(0, pocet || 20);
}

/* =====================================================================
   PROFI: kalendář, svátky, římské číslice, jména, přepis, obraz, export
   ===================================================================== */

/* ---------- kalendář: juliánský den (JDN), převody, den v týdnu ---------- */
const MESICE_CS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const MESICE_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
const DNY_CS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const DNY_LA = ['Dominica', 'Feria II', 'Feria III', 'Feria IV', 'Feria V', 'Feria VI', 'Sabbatum'];
const DNY_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// algoritmy podle Meeuse (Astronomical Algorithms) – celočíselné, platí i pro roky před 1582
function jdnGreg(r, m, d) {
  const a = Math.floor((14 - m) / 12), y = r + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}
function jdnJul(r, m, d) {
  const a = Math.floor((14 - m) / 12), y = r + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}
function zJdnGreg(j) {
  const a = j + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
  return { r: 100 * b + d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
}
function zJdnJul(j) {
  const c = j + 32082, d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
  return { r: d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
}
const jdn = (r, m, d, kal) => kal === 'jul' ? jdnJul(r, m, d) : jdnGreg(r, m, d);
const zJdn = (j, kal) => kal === 'jul' ? zJdnJul(j) : zJdnGreg(j);
const denTydne = j => (j + 1) % 7;                       // 0 = neděle
const platneDatum = (r, m, d, kal) => { const x = zJdn(jdn(r, m, d, kal), kal); return x.r === r && x.m === m && x.d === d; };
const fmtDatum = x => `${x.d}. ${x.m}. ${x.r}`;
/* o kolik dní je gregoriánský kalendář napřed (platí od 1. 3. daného roku): 1600 → 10, 1700 → 11, 1800 → 12, 1900 → 13 */
const rozdilKalendaru = r => jdnJul(r, 3, 1) - jdnGreg(r, 3, 1);

/* Velikonoční neděle: gregoriánsky (anonymní algoritmus Meeus/Jones/Butcher), juliánsky (Meeus) – datum v daném kalendáři */
function velikonoce(r, kal) {
  if (kal === 'jul') {
    const a = r % 4, b = r % 7, c = r % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
    return { r, m: Math.floor((d + e + 114) / 31), d: ((d + e + 114) % 31) + 1 };
  }
  const a = r % 19, b = Math.floor(r / 100), c = r % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { r, m: Math.floor((h + l - 7 * m + 114) / 31), d: ((h + l - 7 * m + 114) % 31) + 1 };
}

/* Pohyblivé svátky a neděle vztažené k Velikonocům: [id, česky, latinsky / německy, posun ve dnech] */
const POHYBLIVE = [
  ['septuagesima', 'Devítník (neděle Septuagesima)', 'Dominica Septuagesima', -63],
  ['sexagesima', 'neděle Sexagesima', 'Dominica Sexagesima', -56],
  ['estomihi', 'neděle Quinquagesima (Estomihi)', 'Dominica Quinquagesima / Esto mihi', -49],
  ['popelecni', 'Popeleční středa', 'Feria IV Cinerum / Aschermittwoch', -46],
  ['invocavit', '1. neděle postní (Invocavit)', 'Dominica I Quadragesimae / Invocavit', -42],
  ['reminiscere', '2. neděle postní (Reminiscere)', 'Dominica II Quadragesimae / Reminiscere', -35],
  ['oculi', '3. neděle postní (Oculi)', 'Dominica III Quadragesimae / Oculi', -28],
  ['laetare', '4. neděle postní (Laetare, Družebná)', 'Dominica IV Quadragesimae / Laetare', -21],
  ['judica', '5. neděle postní (Judica, Smrtná)', 'Dominica Passionis / Judica', -14],
  ['palmarum', 'Květná neděle', 'Dominica Palmarum', -7],
  ['zeleny', 'Zelený čtvrtek', 'Feria V in Coena Domini / Gründonnerstag', -3],
  ['velky_patek', 'Velký pátek', 'Feria VI in Parasceve / Karfreitag', -2],
  ['velikonoce', 'Boží hod velikonoční', 'Dominica Resurrectionis / Pascha / Ostersonntag', 0],
  ['pondeli', 'Velikonoční pondělí', 'Feria II Paschatis / Ostermontag', 1],
  ['quasimodo', 'Bílá neděle (Quasimodogeniti)', 'Dominica in Albis / Quasimodogeniti', 7],
  ['misericordia', '2. neděle po Velikonocích (Misericordias Domini)', 'Dominica II post Pascha / Misericordias Domini', 14],
  ['jubilate', '3. neděle po Velikonocích (Jubilate)', 'Dominica III post Pascha / Jubilate', 21],
  ['cantate', '4. neděle po Velikonocích (Cantate)', 'Dominica IV post Pascha / Cantate', 28],
  ['rogate', '5. neděle po Velikonocích (Rogate)', 'Dominica V post Pascha / Vocem jucunditatis / Rogate', 35],
  ['nanebevstoupeni', 'Nanebevstoupení Páně', 'Ascensio Domini / Christi Himmelfahrt', 39],
  ['exaudi', 'neděle Exaudi (6. po Velikonocích)', 'Dominica post Ascensionem / Exaudi', 42],
  ['letnice', 'Boží hod svatodušní (Letnice)', 'Dominica Pentecostes / Pfingstsonntag', 49],
  ['svatodusni_pondeli', 'Svatodušní pondělí', 'Feria II Pentecostes / Pfingstmontag', 50],
  ['trojice', 'Nejsvětější Trojice', 'Festum SS. Trinitatis (= Dominica I post Pentecosten)', 56],
  ['bozi_telo', 'Boží Tělo', 'Festum Corporis Christi / Fronleichnam', 60]
];

/* pevné svátky z tabulky [m, d, cs, la, pozn, přestupný] do tvaru pro svatkyRoku */
const pevneSvatky = tab => tab.map(([m, d, cs, la, pozn, pr]) => ({ id: `s${m}_${d}`, cs, la, datum: [m, d], pozn: pozn || '', prestupny: pr || null }));
/* všechny datované položky roku (pevné svátky z dat + pohyblivé + neděle po Zjevení/Letnicích, adventní) */
function svatkyRoku(r, kal, pevne) {
  const v = velikonoce(r, kal), jv = jdn(v.r, v.m, v.d, kal), vysl = [];
  for (const [id, cs, la, posun] of POHYBLIVE) vysl.push({ id, cs, la, jdn: jv + posun, druh: 'pohyblivy' });
  // neděle po Zjevení Páně (6. 1.) až do Septuagesimy
  const zj = jdn(r, 1, 6, kal);
  let ne = denOd(zj, 0, 1);
  for (let n = 1; ne < jv - 63; n++, ne += 7) vysl.push({ id: 'epif' + n, cs: n + '. neděle po Zjevení Páně', la: `Dominica ${rimske(n)} post Epiphaniam`, jdn: ne, druh: 'nedele' });
  // neděle po Letnicích (katolické počítání: I = Trojice) a po Trojici (evangelické) až do adventu
  const advent4 = (() => { const j = jdn(r, 12, 24, kal); return j - denTydne(j); })();
  const jl = jv + 49;
  for (let n = 2, d = jl + 14; d < advent4 - 21; n++, d += 7)
    vysl.push({ id: 'pent' + n, cs: `${n}. neděle po Letnicích (${n - 1}. po Trojici)`, la: `Dominica ${rimske(n)} post Pentecosten / ${n - 1}. Sonntag nach Trinitatis`, jdn: d, druh: 'nedele' });
  for (let n = 1; n <= 4; n++) vysl.push({ id: 'advent' + n, cs: n + '. neděle adventní', la: `Dominica ${rimske(n)} Adventus`, jdn: advent4 - 7 * (4 - n), druh: 'nedele' });
  for (const s of pevne || []) {
    const [m, d] = s.prestupny && platneDatum(r, 2, 29, kal) ? s.prestupny : s.datum;
    if (!platneDatum(r, m, d, kal)) continue;
    vysl.push({ id: s.id, cs: s.cs, la: s.la, jdn: jdn(r, m, d, kal), druh: 'pevny', pozn: s.pozn || '' });
  }
  return vysl.sort((a, b) => a.jdn - b.jdn);
}
/* popis dne: svátky toho dne + liturgické pojmenování („pondělí po neděli Laetare“) */
function popisDne(r, m, d, kal, pevne) {
  const j = jdn(r, m, d, kal), dt = denTydne(j);
  const vse = svatkyRoku(r, kal, pevne);
  const dnes = vse.filter(x => x.jdn === j);
  let liturg = '';
  if (dt !== 0) {
    const ne = j - dt, nd = vse.filter(x => x.jdn === ne && x.druh !== 'pevny');
    if (nd.length) liturg = `${DNY_CS[dt]} po neděli „${nd[0].cs}“ – ${DNY_LA[dt]} post ${nd[0].la.split(' / ')[0].replace(/^Dominica /, 'Dominicam ')}`;
  }
  return { jdn: j, den: dt, denCs: DNY_CS[dt], denLa: DNY_LA[dt], denDe: DNY_DE[dt], svatky: dnes, liturg };
}
/* den v týdnu před/po datu: smer +1 = nejbližší dalsi (ne týž den), -1 = předchozí */
function denOd(j, den, smer) {
  let x = j + smer;
  while (denTydne(x) !== den) x += smer;
  return x;
}

/* ---------- římské číslice a chronogram ---------- */
const RIM = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function rimske(n) {
  n = Math.floor(n); if (!(n > 0 && n < 4000)) return '';
  let s = ''; for (const [h, z] of RIM) while (n >= h) { s += z; n -= h; }
  return s;
}
const HODNOTY = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
/* čtení římského čísla: malá písmena, j = i (viij), u = v, tečky a mezery ignoruje.
   → {hodnota, kanonicky, nestandardni} nebo null; nestandardní = IIII, VIIII, IC… (v matrikách běžné) */
function zRimskeho(s) {
  const t = String(s || '').toUpperCase().replace(/J/g, 'I').replace(/U/g, 'V').replace(/[\s.]/g, '');
  if (!t || /[^IVXLCDM]/.test(t)) return null;
  let h = 0;
  for (let i = 0; i < t.length; i++) {
    const a = HODNOTY[t[i]], b = HODNOTY[t[i + 1]] || 0;
    h += a < b ? -a : a;
  }
  if (h <= 0) return null;
  const kan = rimske(h);
  return { hodnota: h, kanonicky: kan, nestandardni: kan !== t };
}
/* chronogram: součet zvýrazněných (velkých) římských písmen; U = V, J = I, W = VV */
function chronogram(text, jenVelka) {
  let soucet = 0; const pismena = [];
  for (const ch of String(text || '')) {
    const v = jenVelka === false ? ch.toUpperCase() : ch;
    const z = v === 'U' ? 'V' : v === 'J' ? 'I' : v;
    let h = HODNOTY[z] || (v === 'W' ? 10 : 0);
    if (h) { soucet += h; pismena.push(ch); }
  }
  return { soucet, pismena };
}

/* ---------- měsíce v matričních zápisech ---------- */
// rozpozná měsíc z textu: 7ber/7bris/VIIbris = září, Xber = prosinec, latinské a německé tvary i staroněmecké názvy
const MESICE_VZORY = [
  [1, /^(ian|jan[un]|jän|jenner|led(en|na)|hartung|eismon)/], [2, /^(feb|hornung|únor|unor|února|unora)/], [3, /^(mar[tzc]|märz|lenz|bře(zen|zna)|bre(zen|zna))/],
  [4, /^(apr|oster|dub(en|na))/], [5, /^(mai|maj|may|wonne|kvě(ten|tna)|kve(ten|tna))/], [6, /^(iun|jun|brach|červen$|cerven$|června|cervna)/],
  [7, /^(iul|jul|heu|červenec|cervenec|července|cervence)/], [8, /^(aug|ernte|ernting|srp(en|na))/], [9, /^(sept|herbst|scheid|září|zari)/],
  [10, /^(oct|okt|wein|říj(en|na)|rij(en|na))/], [11, /^(nov|winter|nebel|listopad)/], [12, /^(dec|dez|christ|prosin)/]
];
function mesicZTextu(s) {
  const t = String(s || '').trim().toLowerCase().replace(/\.$/, '');
  if (!t) return null;
  // číslovkové zkratky: 7ber, 7bris, 7bre, VIIbris, 8bris, 9ber, 10ber, Xber, Xbris
  const m = t.match(/^(7|8|9|10|vii|viii|ix|x)\s*(b|br|ber|bre|bris|bri|bris\.?)$/);
  if (m) return { 7: 9, vii: 9, 8: 10, viii: 10, 9: 11, ix: 11, 10: 12, x: 12 }[m[1]];
  if (/^\d{1,2}$/.test(t)) { const n = +t; return n >= 1 && n <= 12 ? n : null; }
  for (const [n, re] of MESICE_VZORY) if (re.test(t)) return n;
  return null;
}
/* volný text data → {d, m, r} (např. „7. Xbris 1784“, „den 3ten Jänner 1850“, „12 7bris 1799“) */
function rozeberDatum(s) {
  const t = String(s || '').replace(/(\d+)\./g, '$1 ').replace(/(\d+)\s*(sten|ste|ten|ter|tes|mo|ma|ho|a|o)(?=[\s,;]|$)/gi, '$1 ');
  const slova = t.split(/[\s,;/]+/).filter(Boolean);
  let d = null, m = null, r = null;
  for (const w of slova) {
    if (/^\d{3,4}$/.test(w)) { r = +w; continue; }
    if (m == null) { const mm = mesicZTextu(w); if (mm && !(/^\d{1,2}$/.test(w) && d == null)) { m = mm; continue; } }
    if (/^\d{1,2}$/.test(w)) { if (d == null) d = +w; else if (m == null && +w <= 12) m = +w; }
  }
  if (d == null || m == null || r == null) return null;
  return { d, m, r };
}

/* ---------- latinská jména v pádech ---------- */
/* kandidáti 1. pádu pro latinský tvar (Joannis → Joannes, Mariae → Maria, Petri → Petrus, Wenceslai → Wenceslaus) */
function latinskyNominativ(slovo) {
  const w = String(slovo || '').trim().replace(/[.,;:]+$/, '');
  if (!w) return [];
  const k = new Set([w]);
  const zkus = (kon, nove) => { if (w.length > kon.length + 1 && w.toLowerCase().endsWith(kon)) k.add(w.slice(0, w.length - kon.length) + nove); };
  zkus('ae', 'a'); zkus('am', 'a'); zkus('is', 'es'); zkus('is', ''); zkus('em', 'es'); zkus('em', '');
  zkus('i', 'us'); zkus('um', 'us'); zkus('o', 'us'); zkus('onis', 'o'); zkus('e', 'es');
  return Array.from(k);
}
/* vyhledání jména: [latinsky, česky, německy, ...] – podle 1. pádu nebo kandidátů z pádu, bez diakritiky */
function najdiJmeno(jmena, slovo) {
  const kand = latinskyNominativ(slovo).map(normalizuj).map(x => x.replace(/ph/g, 'f').replace(/th/g, 't').replace(/y/g, 'i').replace(/w/g, 'v'));
  const klic = x => normalizuj(x).replace(/ph/g, 'f').replace(/th/g, 't').replace(/y/g, 'i').replace(/w/g, 'v');
  const sedi = t => String(t || '').split(/\s*[/,]\s*/).some(v => kand.includes(klic(v)));
  return jmena.filter(j => sedi(j[0]) || sedi(j[2]));
}

/* ---------- přepis: nejistá místa ---------- */
// [?] = nečitelné písmeno/slovo, [slovo?] = nejisté čtení, [...] nebo […] = vynechaný nečitelný úsek
const RE_NEJISTE = /\[[^\]\n]*?\?\]|\[(?:\.\.\.|…)\]/g;
function nejista(radky) {
  const vysl = [];
  (radky || []).forEach((r, i) => {
    const t = typeof r === 'string' ? r : (r && r.t) || '';
    let m; RE_NEJISTE.lastIndex = 0;
    while ((m = RE_NEJISTE.exec(t))) vysl.push({ radek: i, pozice: m.index, delka: m[0].length, text: m[0] });
  });
  return vysl;
}
/* rozdělí text na úseky {t, n: nejisté?} – pro zvýraznění v exportu */
function useky(text) {
  const t = String(text || ''), out = []; let p = 0, m; RE_NEJISTE.lastIndex = 0;
  while ((m = RE_NEJISTE.exec(t))) { if (m.index > p) out.push({ t: t.slice(p, m.index), n: false }); out.push({ t: m[0], n: true }); p = m.index + m[0].length; }
  if (p < t.length) out.push({ t: t.slice(p), n: false });
  return out;
}

/* ---------- úpravy obrazu (bez DOM): tabulka jasu a aplikace na RGBA ---------- */
/* u = {jas -100..100, kontrast -100..100, cerna 0..254, bila 1..255, gama 0.2..5, inverze, seda} */
function tabulkaJasu(u) {
  u = Object.assign({ jas: 0, kontrast: 0, cerna: 0, bila: 255, gama: 1, inverze: false }, u);
  const lut = new Uint8ClampedArray(256), c = Math.max(1, u.bila - u.cerna);
  const k = u.kontrast >= 0 ? 1 + u.kontrast / 25 : 1 + u.kontrast / 100;   // 0 → 1, 100 → 5×, -100 → 0
  for (let i = 0; i < 256; i++) {
    let v = Math.min(1, Math.max(0, (i - u.cerna) / c));                    // úrovně (černý a bílý bod)
    v = Math.pow(v, 1 / (u.gama || 1));                                      // gama (střední tóny)
    v = (v - 0.5) * k + 0.5 + u.jas / 100;                                   // kontrast kolem středu, jas
    v = Math.min(1, Math.max(0, v));
    lut[i] = Math.round((u.inverze ? 1 - v : v) * 255);
  }
  return lut;
}
function upravPixely(data, u) {
  const lut = tabulkaJasu(u), seda = u && u.seda;
  for (let i = 0; i < data.length; i += 4) {
    if (seda) { const y = lut[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]; data[i] = data[i + 1] = data[i + 2] = y; }
    else { data[i] = lut[data[i]]; data[i + 1] = lut[data[i + 1]]; data[i + 2] = lut[data[i + 2]]; }
  }
  return data;
}
/* automatické úrovně: černý/bílý bod z histogramu jasu (oříznutí 0,5 % na obou koncích) */
function autoUrovne(data, orez) {
  const h = new Uint32Array(256); let n = 0;
  for (let i = 0; i < data.length; i += 16) { h[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++; n++; }
  const mez = n * (orez == null ? 0.005 : orez);
  let a = 0, s = 0; while (a < 255 && (s += h[a]) <= mez) a++;
  let b = 255; s = 0; while (b > 0 && (s += h[b]) <= mez) b--;
  if (b - a < 10) return { cerna: 0, bila: 255 };
  return { cerna: a, bila: b };
}

/* ---------- Zpět / Znovu: zásobník snímků (řetězce JSON) ---------- */
function novaHistorie(max) { return { s: [], i: -1, max: max || 200 }; }
function historieZapis(h, stav) {
  if (h.s[h.i] === stav) return false;
  h.s.length = h.i + 1; h.s.push(stav);
  if (h.s.length > h.max) h.s.shift();
  h.i = h.s.length - 1; return true;
}
const historieZpet = h => h.i > 0 ? h.s[--h.i] : null;
const historieZnovu = h => h.i < h.s.length - 1 ? h.s[++h.i] : null;

/* ---------- projekt přepisu ---------- */
const UPRAVY_VYCHOZI = { jas: 0, kontrast: 0, cerna: 0, bila: 255, gama: 1, inverze: false, seda: false, otoceni: 0, sklon: 0 };
const META_POLE = [['archiv', 'Archiv'], ['fond', 'Fond / farnost'], ['kniha', 'Kniha, signatura'], ['folio', 'Folio / strana / snímek'], ['druh', 'Druh zápisu'], ['odkaz', 'Odkaz na snímek'], ['pozn', 'Poznámka']];
const noveId = () => Math.random().toString(36).slice(2, 10);
/* sjednocení projektu (z IndexedDB nebo importu) – chybějící pole doplní, neplatná zahodí */
function normalizujProjekt(p) {
  p = p && typeof p === 'object' ? p : {};
  const meta = {};
  for (const [k] of META_POLE) meta[k] = typeof (p.meta || {})[k] === 'string' ? p.meta[k] : '';
  const radky = (Array.isArray(p.radky) ? p.radky : []).map(r => {
    const o = { id: typeof (r && r.id) === 'string' ? r.id : noveId(), t: typeof (r && r.t) === 'string' ? r.t : String(r && r.t != null ? r.t : (typeof r === 'string' ? r : '')) };
    if (r && Array.isArray(r.r) && r.r.length === 4 && r.r.every(Number.isFinite) && r.r[2] > 0 && r.r[3] > 0) o.r = r.r.map(Math.round);
    return o;
  });
  if (!radky.length) radky.push({ id: noveId(), t: '' });
  const upravy = Object.assign({}, UPRAVY_VYCHOZI);
  for (const k of Object.keys(UPRAVY_VYCHOZI)) if (p.upravy && typeof p.upravy[k] === typeof UPRAVY_VYCHOZI[k]) upravy[k] = p.upravy[k];
  upravy.otoceni = ((Math.round(upravy.otoceni / 90) * 90) % 360 + 360) % 360;
  return { id: typeof p.id === 'string' ? p.id : noveId(), nazev: typeof p.nazev === 'string' && p.nazev.trim() ? p.nazev.trim() : 'Bez názvu',
    meta, radky, upravy, zmeneno: Number.isFinite(p.zmeneno) ? p.zmeneno : Date.now(), vytvoreno: Number.isFinite(p.vytvoreno) ? p.vytvoreno : Date.now() };
}
/* prostý text přepisu s hlavičkou */
function exportTxt(p, opt) {
  opt = Object.assign({ cisla: true, hlavicka: true }, opt);
  const out = [];
  if (opt.hlavicka) {
    out.push(p.nazev);
    for (const [k, n] of META_POLE) if (p.meta[k]) out.push(`${n}: ${p.meta[k]}`);
    out.push('Značky: [?] nečitelné, [slovo?] nejisté čtení, […] vynechaný úsek', '');
  }
  const w = String(p.radky.length).length;
  p.radky.forEach((r, i) => out.push(opt.cisla ? String(i + 1).padStart(w, ' ') + '  ' + r.t : r.t));
  return out.join('\n') + '\n';
}

/* ---------- ZIP (bez komprese) a DOCX ---------- */
let CRC_T = null;
function crc32(u8) {
  if (!CRC_T) { CRC_T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; } }
  let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
/* soubory [{nazev, data: Uint8Array|string}] → Uint8Array ZIP (metoda 0 = uloženo) */
function zip(soubory) {
  const enc = new TextEncoder(), casti = [], adr = []; let pos = 0;
  for (const s of soubory) {
    const jm = enc.encode(s.nazev), data = typeof s.data === 'string' ? enc.encode(s.data) : s.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true); h.setUint16(26, jm.length, true); h.setUint16(28, 0, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, jm.length, true); c.setUint32(42, pos, true);
    casti.push(new Uint8Array(h.buffer), jm, data); adr.push(new Uint8Array(c.buffer), jm);
    pos += 30 + jm.length + data.length;
  }
  const velAdr = adr.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, soubory.length, true); e.setUint16(10, soubory.length, true);
  e.setUint32(12, velAdr, true); e.setUint32(16, pos, true);
  const vse = casti.concat(adr, [new Uint8Array(e.buffer)]), out = new Uint8Array(vse.reduce((a, b) => a + b.length, 0));
  let o = 0; for (const x of vse) { out.set(x, o); o += x.length; }
  return out;
}
const xml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
/* DOCX přepisu: nadpis, metadata, volitelně obrázek (JPEG/PNG bajty + rozměry), číslované řádky, nejistá místa zvýrazněná */
function docx(p, obr) {
  const run = (t, vl) => `<w:r>${vl ? `<w:rPr>${vl}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
  const odst = (obsah, styl) => `<w:p>${styl ? `<w:pPr>${styl}</w:pPr>` : ''}${obsah}</w:p>`;
  let telo = odst(run(p.nazev, '<w:b/><w:sz w:val="32"/>'));
  for (const [k, n] of META_POLE) if (p.meta[k]) telo += odst(run(n + ': ', '<w:b/>') + run(p.meta[k]));
  if (obr) {
    const max = 5943600, cx = Math.min(max, Math.round(obr.sirka * 9525)), cy = Math.round(cx * obr.vyska / obr.sirka);
    telo += `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Sken"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="sken.${obr.typ}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="rIdObr"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
      `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }
  telo += odst(run('Přepis', '<w:b/><w:sz w:val="26"/>'));
  p.radky.forEach((r, i) => {
    telo += odst(run((i + 1) + '\t', '<w:color w:val="808080"/>') + useky(r.t).map(u => run(u.t, u.n ? '<w:highlight w:val="yellow"/>' : '')).join(''),
      '<w:tabs><w:tab w:val="left" w:pos="567"/></w:tabs><w:spacing w:after="40"/><w:ind w:left="567" w:hanging="567"/>');
  });
  telo += odst(run('Značky: [?] nečitelné, [slovo?] nejisté čtení, […] vynechaný úsek (žlutě).', '<w:i/><w:sz w:val="18"/>'));
  const dokument = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${telo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const soubory = [
    { nazev: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { nazev: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { nazev: 'word/document.xml', data: dokument },
    { nazev: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${obr ? `<Relationship Id="rIdObr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/sken.${obr.typ}"/>` : ''}</Relationships>` }
  ];
  if (obr) soubory.push({ nazev: 'word/media/sken.' + obr.typ, data: obr.data });
  return zip(soubory);
}

/* ---------- obtahování stylusem: skóre shody tahů s předlohou ---------- */
/* masky Uint8Array (1 = inkoust) w×h; r = tolerance v px. pokryti = kolik předlohy je obtaženo, presnost = kolik tahů leží na předloze */
function rozsir(m, w, h, r) {
  const t = new Uint8Array(m.length), o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) t[y * w + k] = 1;
  }
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    if (!t[y * w + x]) continue;
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) o[k * w + x] = 1;
  }
  return o;
}
function skoreObtahu(predloha, tahy, w, h, r) {
  const pr = rozsir(predloha, w, h, r), tr = rozsir(tahy, w, h, r);
  let nP = 0, okP = 0, nT = 0, okT = 0;
  for (let i = 0; i < w * h; i++) {
    if (predloha[i]) { nP++; if (tr[i]) okP++; }
    if (tahy[i]) { nT++; if (pr[i]) okT++; }
  }
  const pokryti = nP ? okP / nP : 0, presnost = nT ? okT / nT : 0;
  return { pokryti, presnost, skore: Math.round(100 * 2 * pokryti * presnost / Math.max(pokryti + presnost, 1e-9)) };
}

const API = { KLIC, LIG, ZNAMENKA, prevod, normalizuj, levenshtein, hodnot, UROVNE, polozky, moznosti, michej,
  INTERVALY, prazdnySrs, migruj, zaznam, vyberDalsi, prehled, nejhorsi,
  MESICE_CS, MESICE_GEN, DNY_CS, DNY_LA, DNY_DE, jdnGreg, jdnJul, zJdnGreg, zJdnJul, jdn, zJdn, denTydne, platneDatum, fmtDatum,
  rozdilKalendaru, velikonoce, POHYBLIVE, pevneSvatky, svatkyRoku, popisDne, denOd, rimske, zRimskeho, chronogram, mesicZTextu, rozeberDatum,
  latinskyNominativ, najdiJmeno, RE_NEJISTE, nejista, useky, tabulkaJasu, upravPixely, autoUrovne,
  novaHistorie, historieZapis, historieZpet, historieZnovu, UPRAVY_VYCHOZI, META_POLE, noveId, normalizujProjekt, exportTxt,
  crc32, zip, docx, rozsir, skoreObtahu };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else koren.KurentJadro = API;
})(typeof window !== 'undefined' ? window : globalThis);
