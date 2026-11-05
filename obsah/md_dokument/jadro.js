/* Markdown → DOCX / ODT – jádro bez DOM: rozdíl řádků (evidence změn)
   a poznámky ve formátu čtečky Kronik (obsah/ctecka/jadro.js).
   V prohlížeči window.MD_JADRO, v node require(). */
(function (koren) {
  'use strict';

  /* ---------- rozdíl dvou textů po řádcích (Myers) ----------
     Vrací úseky změn [{a0, a1, b0, b1}] – polootevřené rozsahy řádků
     (od 0) ve starém (a) a novém (b) textu. Úsek bez řádků = vložení/smazání. */
  const MAX_D = 1500;   // víc úprav najednou → jeden velký úsek (paměť stopy roste s D²)

  function rozdil(stary, novy) {
    const a = stary.split('\n'), b = novy.split('\n');
    let s = 0;
    while (s < a.length && s < b.length && a[s] === b[s]) s++;
    let ea = a.length, eb = b.length;
    while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    const N = ea - s, M = eb - s;
    if (!N && !M) return [];
    if (!N || !M) return [{ a0: s, a1: ea, b0: s, b1: eb }];

    const A = a.slice(s, ea), B = b.slice(s, eb), MAX = N + M, off = MAX + 1;
    const v = new Int32Array(2 * MAX + 3), stopa = [];
    let D = -1;
    hledej: for (let d = 0; d <= Math.min(MAX, MAX_D); d++) {
      stopa.push(v.slice(off - d - 1, off + d + 2));   // okno k ∈ ⟨-d-1, d+1⟩
      for (let k = -d; k <= d; k += 2) {
        let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
        let y = x - k;
        while (x < N && y < M && A[x] === B[y]) { x++; y++; }
        v[off + k] = x;
        if (x >= N && y >= M) { D = d; break hledej; }
      }
    }
    if (D < 0) return [{ a0: s, a1: ea, b0: s, b1: eb }];

    // zpětný průchod: dvojice shodných řádků
    const shody = [];
    let x = N, y = M;
    for (let d = D; d >= 0; d--) {
      const w = stopa[d], g = k => w[k + d + 1], k = x - y;
      const pk = (k === -d || (k !== d && g(k - 1) < g(k + 1))) ? k + 1 : k - 1;
      const px = d ? g(pk) : 0, py = d ? px - pk : 0;
      while (x > px && y > py) { x--; y--; shody.push([x, y]); }
      x = px; y = py;
    }
    shody.reverse();

    const useky = [];
    let i = 0, j = 0;
    shody.concat([[N, M]]).forEach(([si, sj]) => {
      if (si > i || sj > j) useky.push({ a0: s + i, a1: s + si, b0: s + j, b1: s + sj });
      i = si + 1; j = sj + 1;
    });
    return useky;
  }

  /* Úsek přijatý do zkontrolovaného textu / vrácený v aktuálním textu. */
  function prijmi(zaklad, novy, u) {
    const a = zaklad.split('\n'), b = novy.split('\n');
    a.splice(u.a0, u.a1 - u.a0, ...b.slice(u.b0, u.b1));
    return a.join('\n');
  }
  function vrat(zaklad, novy, u) {
    const a = zaklad.split('\n'), b = novy.split('\n');
    b.splice(u.b0, u.b1 - u.b0, ...a.slice(u.a0, u.a1));
    return b.join('\n');
  }

  /* ---------- poznámky ve formátu čtečky Kronik ----------
     Balík {format:'kroniky-poznamky', verze, jmeno, cas, zalozky, zvyrazneni};
     zvýraznění {id, kniha, soubor, blok, od, do, text, barva, poznamka, cas}.
     Soubor = Markdown pro člověka a na konci celý balík v HTML komentáři –
     totéž čte i píše obsah/ctecka/jadro.js (poznamkyMd / prectiPoznamky). */
  const FORMAT_P = 'kroniky-poznamky';
  const ZNACKA_P = '<!-- kroniky-poznamky ';
  const KNIHA = 'md_dokument';

  const balik = (jmeno, zvyrazneni, cas = Date.now()) =>
    ({ format: FORMAT_P, verze: 1, jmeno: jmeno || '', cas, zalozky: [], zvyrazneni });

  // „-->“ by komentář ukončil – v JSON stačí zapsat > jako >
  const komentar = b => ZNACKA_P + JSON.stringify(b).replace(/>/g, '\\u003e') + ' -->\n';

  function poznamkyMd(b, nazev) {
    let md = '# ' + (nazev || 'Dokument') + ' – poznámky' + (b.jmeno ? ' čtenáře ' + b.jmeno : '') + '\n\n'
      + '_' + new Date(b.cas).toLocaleString('cs-CZ') + ' · ' + b.zvyrazneni.length + ' zvýraznění, ' + b.zalozky.length + ' záložek_\n\n';
    b.zvyrazneni.slice().sort((x, y) => x.blok - y.blok || x.od - y.od)
      .forEach(x => { md += '> ' + x.text + '\n\n' + (x.poznamka ? x.poznamka + '\n\n' : ''); });
    return md + komentar(b);
  }

  // balík z textu (JSON, Markdown s komentářem, záloha čtečky Kronik); null = nic v něm není
  function prectiPoznamky(txt) {
    let o = null;
    try {
      const t = txt.trim(), i = t.lastIndexOf(ZNACKA_P);
      if (t[0] === '{') o = JSON.parse(t);
      else if (i >= 0) o = JSON.parse(t.slice(i + ZNACKA_P.length, t.indexOf('-->', i)));
    } catch (e) { return null; }
    if (o && o.format === 'kroniky-zaloha' && o.data) o = balik(o.stav && o.stav.nast && o.stav.nast.jmeno, o.data.zvyrazneni || [], o.cas || Date.now());
    if (!o || o.format !== FORMAT_P || !Array.isArray(o.zvyrazneni)) return null;
    const zv = o.zvyrazneni.filter(x => x && typeof x.text === 'string' && x.text && Number.isInteger(x.blok))
      .map(x => Object.assign({}, x, { kniha: String(x.kniha || ''), soubor: String(x.soubor || ''), barva: x.barva || 'zluta', poznamka: String(x.poznamka || '') }));
    return Object.assign({}, o, { zvyrazneni: zv, zalozky: Array.isArray(o.zalozky) ? o.zalozky : [] });
  }

  /* Balík připojený na konec dokumentu (.md uložené i s poznámkami) se z textu vyjme. */
  function oddelBalik(md) {
    const i = md.lastIndexOf(ZNACKA_P);
    if (i < 0) return { md, balik: null };
    const konec = md.indexOf('-->', i);
    if (konec < 0 || md.slice(konec + 3).trim()) return { md, balik: null };   // komentář musí být poslední
    const b = prectiPoznamky(md.slice(i));
    return b ? { md: md.slice(0, i).replace(/\s+$/, '\n'), balik: b } : { md, balik: null };
  }

  /* ---------- poznámky ze starších verzí stránky ----------
     a) citace „> [!poznámka]“ pod odstavcem, b) skrytý blok <!-- md-poznamky … -->.
     Vrátí text bez nich a seznam {kotva, poznamka}; kotva = začátek odstavce
     (prostý text), ke kterému poznámka patřila – stránka podle ní zvýraznění dohledá. */
  const RE_STARE = /\n*<!-- md-poznamky\n([\s\S]*?)\n?-->[ \t]*\n?/;
  const RE_ZNACKA = /^ {0,3}>[ \t]?\[!pozn[aá]mka\]/i;
  const normuj = s => s.replace(/\s+/g, ' ').trim();

  function textPoznamky(raw) {
    const r = raw.replace(/\n+$/, '').split('\n').map(x => x.replace(/^ {0,3}>[ \t]?/, ''));
    r[0] = r[0].replace(/^\[!pozn[aá]mka\][ \t]*/i, '');
    if (!r[0]) r.shift();
    return r.join('\n').trim();
  }

  // prostyText(md) → prostý text bloku (v prohlížeči přes marked + DOM)
  function vyjmiStare(md, marked, prostyText) {
    const nalezene = [];
    const st = md.match(RE_STARE);
    if (st) {
      st[1].split('\n').forEach(r => {
        const x = r.match(/^(\d+) (\{.*\})\s*$/);
        if (!x) return;
        try {
          const o = JSON.parse(x[2]);
          if (String(o.text || '').trim()) nalezene.push({ kotva: normuj(String(o.kotva || '')), poznamka: String(o.text).trim() });
        } catch (e) { /* poškozený řádek se přeskočí */ }
      });
      md = md.replace(RE_STARE, '\n').replace(/\s+$/, '\n');
    }
    if (!/\[!pozn[aá]mka\]/i.test(md)) return { md, poznamky: nalezene };
    let tokeny;
    try { tokeny = marked.lexer(md); } catch (e) { return { md, poznamky: nalezene }; }
    let vystup = '', predchozi = null;
    tokeny.forEach(t => {
      if (t.type === 'blockquote' && RE_ZNACKA.test(t.raw)) {
        const p = textPoznamky(t.raw);
        if (p) nalezene.push({ kotva: predchozi ? normuj(prostyText(predchozi.raw)).slice(0, 60) : '', poznamka: p });
        return;
      }
      if (t.type !== 'space') predchozi = t;
      vystup += t.raw;
    });
    return { md: vystup.replace(/\n{3,}/g, '\n\n'), poznamky: nalezene };
  }

  // konec první věty od začátku textu (zvýraznění převedené poznámky), nejvýš ~140 znaků
  function prvniVeta(text) {
    const m = text.slice(0, 160).match(/^[\s\S]*?[.!?…](?=\s|$)/);
    const k = m && m[0].length >= 8 ? m[0].length : Math.min(text.length, 140);
    return k;
  }

  const API = { rozdil, prijmi, vrat, balik, komentar, poznamkyMd, prectiPoznamky, oddelBalik, vyjmiStare, prvniVeta, KNIHA, ZNACKA_P };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else koren.MD_JADRO = API;
})(typeof window !== 'undefined' ? window : globalThis);
