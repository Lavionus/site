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
  { id: 5, nazev: 'Celé obraty', popis: 'Úseky zápisů z matrik, tenčí písmo a sklon.' }
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

const API = { KLIC, LIG, ZNAMENKA, prevod, normalizuj, levenshtein, hodnot, UROVNE, polozky, moznosti, michej,
  INTERVALY, prazdnySrs, migruj, zaznam, vyberDalsi, prehled, nejhorsi };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else koren.KurentJadro = API;
})(typeof window !== 'undefined' ? window : globalThis);
