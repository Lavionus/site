/* Mozaika zpráv – jádro bez DOM (testuje _test/zpravy_test.js v node).
   Položka (z větve zpravy-data, viz .github/scripts/zpravy_stahni.py):
     { i, z, r, t, p, u, o?, d, n }  = id, zdroj, rubrika, titulek, perex, odkaz, obrázek, čas vydání, čas prvního výskytu
*/
(function (koren) {
  'use strict';

  // ---------- text ----------
  const BEZ_DIAKRITIKY = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const normalizuj = s => BEZ_DIAKRITIKY(String(s || '').toLowerCase());

  // slova, která o tématu nic neříkají (cs, sk, en) – po odstranění diakritiky
  const STOP = new Set((
    'a i o u v ve na se si ze z za je to ten ta te ty tu tom tim jak jako ale kde kdy uz jiz pri od do po pro pred '
    + 'nez nebo ani by byl byla bylo byli bude budou jsou jsem jsme jste ma maji mel mela meli muze mohou chce '
    + 'tak take jen jeste ktery ktera ktere kteri ktereho jeho jeji jejich jim nam vam mu mi ji ho nas vas '
    + 'tento tato toto tyto tech techto svuj sva sve svych svym nove novy nova novych dalsi vice mene velmi '
    + 'proti mezi pod nad bez kvuli diky pak tam zde tady nyni dnes vcera zitra rok roku roce let lety '
    + 'online video foto fotogalerie rozhovor komentar anketa live zive minut hodin '
    + 'sa sme su bol bola boli aby ako ale ked lebo tiez este len uz nie '
    + 'the of and to in for on at by with from as is are was were be been has have had it its this that '
    + 'after over into about than more new says said will would could can not but out up his her their they'
  ).split(/\s+/));

  /** Slovní kmeny titulku pro porovnání témat. Krácení na 4 znaky hrubě smaže české koncovky (vlaky/vlaků, srážka/srazily); ověřeno na reálných datech – 5 znaků nechávalo stejné zprávy rozdělené. */
  function kmeny(text) {
    const slova = normalizuj(text).split(/[^a-z0-9]+/);
    const out = new Set();
    for (const w of slova) {
      if (w.length < 3 || STOP.has(w)) continue;
      if (/^\d+$/.test(w) && w.length < 3) continue;
      out.add(w.length > 4 ? w.slice(0, 4) : w);
    }
    return out;
  }

  function podobnost(a, b) {
    let spol = 0;
    for (const x of a) if (b.has(x)) spol++;
    const mensi = Math.min(a.size, b.size) || 1;
    return { spol, pomer: spol / mensi };
  }

  /** Stejná zpráva? Aspoň 3 společné kmeny a ≥ 45 % kratšího titulku, nebo 2 kmeny u velmi krátkých titulků. */
  function stejneTema(a, b) {
    const { spol, pomer } = podobnost(a, b);
    if (spol >= 3 && pomer >= 0.45) return true;
    if (spol >= 2 && pomer >= 0.67 && Math.min(a.size, b.size) <= 3) return true;
    return false;
  }

  /**
   * Seskupí zprávy o stejné události z různých zdrojů do témat.
   * Vrací pole témat { hlavni, cleny[], zdroje:Set, d (nejnovější čas), id } seřazené od nejnovějšího.
   * hlavni = člen s obrázkem a nejdelším perexem z nejdříve vybraného zdroje (poradiZdroju).
   */
  function seskup(polozky, moznosti) {
    const m = Object.assign({ okno: 20 * 3600, zapnuto: true, poradiZdroju: null, maxClenu: 12, vydavatel: null }, moznosti);
    const redakce = z => (m.vydavatel && m.vydavatel.get(z)) || z;   // iDNES + Lidovky = jedna redakce (MAFRA)
    const serazene = polozky.slice().sort((a, b) => b.d - a.d);
    const temata = [];
    if (!m.zapnuto) {
      for (const p of serazene) temata.push({ id: p.i, hlavni: p, cleny: [p], zdroje: new Set([p.z]), redakce: new Set([redakce(p.z)]), d: p.d });
      return temata;
    }
    const index = new Map();          // kmen → témata, kde se vyskytuje
    for (const p of serazene) {
      const k = p._k || (p._k = kmeny(p.t));
      let nejlepsi = null, nejSpol = 0;
      if (k.size >= 2) {
        const kandidati = new Set();
        for (const x of k) { const l = index.get(x); if (l) for (const t of l) kandidati.add(t); }
        for (const t of kandidati) {
          if (t.cleny.length >= m.maxClenu || t.zdroje.has(p.z) && t.cleny.some(c => c.z === p.z && c.t === p.t)) continue;
          if (t.dMin - p.d > m.okno) continue;
          for (const c of t.cleny) {
            if (c.z === p.z) continue;            // stejný zdroj = obvykle jiný článek, neslučovat
            if (stejneTema(k, c._k)) {
              const s = podobnost(k, c._k).spol;
              if (s > nejSpol) { nejSpol = s; nejlepsi = t; }
              break;
            }
          }
        }
      }
      if (nejlepsi) {
        nejlepsi.cleny.push(p);
        nejlepsi.zdroje.add(p.z);
        nejlepsi.redakce.add(redakce(p.z));
        nejlepsi.dMin = Math.min(nejlepsi.dMin, p.d);
      } else {
        nejlepsi = { id: p.i, hlavni: p, cleny: [p], zdroje: new Set([p.z]), redakce: new Set([redakce(p.z)]), d: p.d, dMin: p.d };
        temata.push(nejlepsi);
      }
      for (const x of k) {
        let l = index.get(x);
        if (!l) index.set(x, l = []);
        if (!l.includes(nejlepsi)) l.push(nejlepsi);
      }
    }
    const poradi = m.poradiZdroju ? new Map(m.poradiZdroju.map((z, i) => [z, i])) : null;
    for (const t of temata) {
      if (t.cleny.length > 1) {
        const skore = c => (c.o ? 1000 : 0) + Math.min(c.p ? c.p.length : 0, 300) - (poradi && poradi.has(c.z) ? poradi.get(c.z) * 5 : 0);
        t.hlavni = t.cleny.slice().sort((a, b) => skore(b) - skore(a))[0];
        t.id = t.hlavni.i;
        t.cleny.sort((a, b) => b.d - a.d);
      }
    }
    return temata;
  }

  /**
   * Vývoj tématu: všechny zprávy o téže události (i aktualizace stejného webu) seřazené od nejstarší.
   * Stejné kritérium jako seskup(), jen bez omezení na různé weby; okno ±48 h kolem článku.
   */
  function souvisejici(p, polozky, max) {
    const k = p._k || (p._k = kmeny(p.t));
    if (k.size < 2) return [p];
    const out = [];
    const videne = new Set();
    for (const x of polozky) {
      if (videne.has(x.i) || Math.abs(x.d - p.d) > 48 * 3600) continue;
      if (x !== p && !stejneTema(k, x._k || (x._k = kmeny(x.t)))) continue;
      videne.add(x.i);
      out.push(x);
    }
    if (!videne.has(p.i)) out.push(p);
    return out.sort((a, b) => a.d - b.d).slice(-(max || 30));
  }

  /** Je čas (Date) v denním intervalu „HH:MM–HH:MM“? Interval může přecházet přes půlnoc (21:00–06:00). */
  function vIntervalu(od, doCas, datum) {
    const min = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
    const a = min(od), b = min(doCas), x = datum.getHours() * 60 + datum.getMinutes();
    if (!isFinite(a) || !isFinite(b) || a === b) return false;
    return a < b ? x >= a && x < b : x >= a || x < b;
  }

  // ---------- filtrování ----------
  /** Rozebere hledaný výraz: slova AND, "-slovo" vylučuje, "v uvozovkách" = přesná fráze. */
  function rozeberDotaz(dotaz) {
    const kladne = [], zaporne = [];
    const re = /(-?)"([^"]+)"|(-?)(\S+)/g;
    let m;
    while ((m = re.exec(dotaz || ''))) {
      const neg = (m[1] || m[3]) === '-';
      const slovo = normalizuj(m[2] || m[4]);
      if (!slovo || slovo === '-') continue;
      (neg ? zaporne : kladne).push(slovo);
    }
    return { kladne, zaporne };
  }

  /** Normalizovaný titulek + perex (uložený na položce). Název webu se přidává jen k hledání, ne k filtrům. */
  function textPolozky(p) {
    return p._n || (p._n = normalizuj(p.t + ' ' + (p.p || '')));
  }

  /** Obsahuje text (normalizovaný) slovo/frázi? Krátká slova (≤ 3 znaky) jen jako celé slovo. */
  function obsahuje(text, slovo) {
    if (slovo.length <= 3) return new RegExp('(^|[^a-z0-9])' + slovo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(text);
    return text.includes(slovo);
  }

  /**
   * filtr = { zdroje:Set|null, rubrika:'vse'|id, skryteRubriky:Set, jazyky:Set|null, dotaz, ztlumit:[slova],
   *           skryte:Set(id), jenNeprectene, precteno:Set|Map, odCasu, jazykZdroje:Map(z→jazyk), nazvyZdroju:Map }
   */
  function filtruj(polozky, f) {
    const dotaz = rozeberDotaz(f.dotaz);
    const ztlumit = (f.ztlumit || []).map(normalizuj).filter(Boolean);
    return polozky.filter(p => {
      if (f.zdroje && !f.zdroje.has(p.z)) return false;
      if (f.rubrikyZdroju && f.rubrikyZdroju.has(p.z) && !f.rubrikyZdroju.get(p.z).has(p.r)) return false;
      if (f.kraj !== undefined && p.kr && p.kr !== f.kraj) return false;      // regionální zprávy jen z mého kraje
      if (f.clickbait && jeClickbait(p.t, f.clickbait)) return false;
      if (f.rubrika && f.rubrika !== 'vse' && p.r !== f.rubrika) return false;
      if (f.skryteRubriky && f.skryteRubriky.has(p.r)) return false;
      if (f.jazyky && f.jazykZdroje && !f.jazyky.has(f.jazykZdroje.get(p.z) || 'cs')) return false;
      if (f.skryte && f.skryte.has(p.i)) return false;
      if (f.jenNeprectene && f.precteno && f.precteno.has(p.i)) return false;
      if (f.odCasu && p.d < f.odCasu) return false;
      if (ztlumit.length || dotaz.kladne.length || dotaz.zaporne.length || f.vyloucit) {
        const text = textPolozky(p);
        if (f.vyloucit && f.vyloucit.test(text)) return false;
        if (ztlumit.some(s => obsahuje(text, s))) return false;
        if (dotaz.kladne.length || dotaz.zaporne.length) {
          const sNazvem = text + ' ' + normalizuj(f.nazvyZdroju && f.nazvyZdroju.get(p.z));
          if (dotaz.zaporne.some(s => obsahuje(sNazvem, s))) return false;
          if (!dotaz.kladne.every(s => obsahuje(sNazvem, s))) return false;
        }
      }
      return true;
    });
  }

  /** Lákavý titulek bez obsahu: vzor z katalogu, nebo křik VELKÝMI PÍSMENY (přes 80 % písmen). */
  function jeClickbait(titulek, re) {
    if (re.test(titulek.toLowerCase())) return true;
    const pismena = titulek.replace(/[^\p{L}]/gu, '');
    const velka = titulek.replace(/[^\p{Lu}]/gu, '').length;
    return pismena.length >= 15 && velka / pismena.length > 0.8;   // agentury (TASR) píšou VELKÝMI jen úvod – to není křik
  }

  /** Zvýraznit? (klíčová slova uživatele) */
  function zvyraznena(p, slova) {
    if (!slova || !slova.length) return false;
    const text = textPolozky(p);
    return slova.some(s => { s = normalizuj(s).trim(); return s && obsahuje(text, s); });
  }

  // ---------- mozaika ----------
  /** FNV-1a 32 bitů (stejně _fnv() ve stahovacím skriptu). */
  function hash(s, h = 2166136261) {
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const hex8 = n => n.toString(16).padStart(8, '0');
  /** Id článku z odkazu – shodné s id_polozky() ve skriptu, takže živě načtená zpráva má stejné id jako v přehledu. */
  function idOdkazu(u) {
    const k = klicOdkazu(u);
    return hex8(hash(k)) + hex8(hash(k, 0x9747b28c));
  }

  /** Hlavní témata: nejvíc zdrojů za posledních `hodin` hodin. */
  function hlavniTemata(temata, ted, pocet, hodin) {
    const od = ted - (hodin || 12) * 3600;
    const n = t => (t.redakce || t.zdroje).size;      // počítají se redakce, ne kopie jednoho vydavatele
    return temata.filter(t => n(t) >= 2 && t.d >= od)
      .sort((a, b) => n(b) - n(a) || b.d - a.d)
      .slice(0, pocet || 6);
  }

  // ---------- čas ----------
  const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  function pulnoc(ts) { const d = new Date(ts * 1000); d.setHours(0, 0, 0, 0); return d.getTime() / 1000; }
  const hhmm = ts => { const d = new Date(ts * 1000); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };

  function casRelativni(d, ted) {
    const s = Math.max(0, ted - d);
    if (s < 60) return 'právě teď';
    if (s < 3600) return 'před ' + Math.floor(s / 60) + ' min';
    if (s < 6 * 3600) return 'před ' + Math.floor(s / 3600) + ' h';
    const dnes = pulnoc(ted);
    if (d >= dnes) return 'dnes ' + hhmm(d);
    if (d >= dnes - 86400) return 'včera ' + hhmm(d);
    const dt = new Date(d * 1000);
    return dt.getDate() + '. ' + (dt.getMonth() + 1) + '. ' + hhmm(d);
  }

  /** Oddíly časové osy: [{id, nazev, od, do}] od nejnovějšího. */
  function oddilyCasu(ted) {
    const dnes = pulnoc(ted);
    const o = [
      { id: 'hodina', nazev: 'Poslední hodina', od: ted - 3600 },
      { id: 'dnes', nazev: 'Dnes', od: dnes },
      { id: 'vcera', nazev: 'Včera', od: dnes - 86400 },
    ];
    for (let i = 2; i <= 6; i++) {
      const den = dnes - i * 86400;
      const dt = new Date(den * 1000);
      o.push({ id: 'd' + i, nazev: DNY[dt.getDay()] + ' ' + dt.getDate() + '. ' + (dt.getMonth() + 1) + '.', od: den });
    }
    o.push({ id: 'starsi', nazev: 'Starší', od: -Infinity });
    // „Poslední hodina“ dává smysl jen když je dnes déle než hodinu
    if (ted - dnes < 3600) o.splice(0, 1);
    return o;
  }

  function oddilPro(d, oddily) {
    for (const o of oddily) if (d >= o.od) return o.id;
    return oddily[oddily.length - 1].id;
  }

  // ---------- vlastní kanály (v prohlížeči přes DOMParser) ----------
  const textUzlu = (el, ...jmena) => {
    for (const j of jmena) {
      for (const c of el.children) if (c.localName === j && c.textContent.trim()) return c.textContent;
    }
    return '';
  };
  const ENTITY = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", hellip: '…', ndash: '–', mdash: '—',
    lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', laquo: '«', raquo: '»', euro: '€', copy: '©', deg: '°' };
  function entity(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1);
        return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return ENTITY[e.toLowerCase()] !== undefined ? ENTITY[e.toLowerCase()] : m;
    });
  }
  function bezHtml(s) {
    // dvakrát: některé kanály entity escapují dvakrát (&amp;nbsp;), stejně jako skript
    return entity(entity(String(s || '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')))
      .replace(/\s+/g, ' ').trim();
  }
  function zkrat(s, n) {
    if (s.length <= n) return s;
    s = s.slice(0, n);
    const k = s.lastIndexOf(' ');
    return (k > n * 0.6 ? s.slice(0, k) : s).replace(/[ ,;:–-]+$/, '') + '…';
  }

  /** XML text kanálu → položky stejného tvaru jako z Actions. DOMParser se předává (v node ho není). */
  function rozeberKanal(xml, zdrojId, rubrika, DP) {
    const doc = new (DP || DOMParser)().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Kanál není platné XML (RSS/Atom).');
    const ted = Math.floor(Date.now() / 1000);
    const out = [];
    const prvky = [...doc.getElementsByTagName('item'), ...doc.getElementsByTagName('entry')];
    for (const el of prvky) {
      const t = bezHtml(textUzlu(el, 'title'));
      let u = '';
      for (const c of el.children) {
        if (c.localName !== 'link') continue;
        const h = c.getAttribute('href');
        if (h && (!c.getAttribute('rel') || c.getAttribute('rel') === 'alternate')) { u = h; break; }
        if (!h && c.textContent.trim()) { u = c.textContent.trim(); break; }
      }
      if (!u) { const g = textUzlu(el, 'guid'); if (/^https?:/.test(g.trim())) u = g.trim(); }
      if (!t || !/^https?:/.test(u)) continue;
      const popis = textUzlu(el, 'description', 'summary', 'encoded', 'content');
      let o = null;
      for (const c of el.getElementsByTagName('*')) {
        const n = c.localName;
        if ((n === 'content' || n === 'thumbnail') && c.getAttribute('url') && !/video|audio/.test(c.getAttribute('type') || c.getAttribute('medium') || '')) { o = c.getAttribute('url'); break; }
        if (n === 'enclosure' && /^image/.test(c.getAttribute('type') || 'image') && c.getAttribute('url')) { o = c.getAttribute('url'); break; }
      }
      if (!o) { const m = /<img[^>]+src=["']([^"']+)["']/i.exec(popis); if (m) o = m[1]; }
      if (o) { try { o = new URL(entity(o), u).href; } catch (e) { o = null; } if (o && !/^https?:/.test(o)) o = null; }
      const dRaw = textUzlu(el, 'pubDate', 'published', 'updated', 'date');
      const d = dRaw ? Math.floor(Date.parse(dRaw) / 1000) : NaN;
      let p = zkrat(bezHtml(popis), 300);
      if (p.replace(/…$/, '') === t) p = '';
      const pol = { i: idOdkazu(u), z: zdrojId, r: rubrika, t, p, u, d: isFinite(d) ? Math.min(d, ted) : ted, n: ted };
      if (o) pol.o = o;
      const kat = [...el.children].filter(c => c.localName === 'category').map(c => bezHtml(c.textContent || c.getAttribute('term') || '')).filter(Boolean);
      if (kat.length) pol.k = kat.slice(0, 5);
      out.push(pol);
    }
    return out;
  }

  /** Klíč odkazu pro hledání duplicit – stejná normalizace jako id_polozky() v .github/scripts/zpravy_stahni.py. */
  function klicOdkazu(url) {
    let u = /[?&](id|c|p|article)=/.test(url) ? url : url.replace(/[?#].*$/, '');
    return u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
  }

  /** Regulární výraz „slovo na začátku slova“ nad normalizovaným textem. Krátká slova (≤ 3 znaky) a slova
      zakončená tečkou („nato.“ ≠ natočit) se hledají jen celá. Stejně vyraz() ve stahovacím skriptu. */
  function vyrazSlov(slova) {
    const casti = slova.map(normalizuj).map(s => s.trim()).filter(s => s && s !== '.').map(s => {
      const cele = s.endsWith('.') || s.length <= 3;
      s = s.replace(/\.$/, '');
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (cele ? '(?![a-z0-9])' : '');
    });
    return casti.length ? new RegExp('(^|[^a-z0-9])(' + casti.join('|') + ')') : null;
  }

  /**
   * Rubrika živě načtené položky – stejné pořadí jako urci_rubriku() ve stahovacím skriptu:
   * pravidla zdroje (cesta) → pravidla_vsude (celá adresa) → kategorie (je-li kanal.kategorie) → klíčová slova → rubrika kanálu.
   */
  function urciRubriku(p, zdroj, kanal, katalog) {
    const c = katalog._js || (katalog._js = {
      vsude: (katalog.pravidla_vsude || []).map(([v, r]) => [new RegExp(v, 'i'), r]),
      mapa: (katalog.mapa_kategorii || []).map(([k, r]) => [k.toLowerCase(), r]),
      slova: (katalog.klicova_slova || []).map(([r, sl]) => [r, vyrazSlov(sl)]),
    });
    const cesta = p.u.replace(/^https?:\/\/[^/]+/, '');
    const pravidla = zdroj._re || (zdroj._re = (zdroj.pravidla || []).map(([v, r]) => [new RegExp(v), r]));
    for (const [v, r] of pravidla) if (v.test(cesta)) return r;
    for (const [v, r] of c.vsude) if (v.test(p.u)) return r;
    if (kanal.kategorie) {
      for (const k of p.k || []) { const kk = k.toLowerCase(); for (const [v, r] of c.mapa) if (kk.includes(v)) return r; }
    }
    const vychozi = kanal.rubrika || zdroj.rubrika || 'cesko';
    const titulek = normalizuj(p.t);
    for (const [r, re] of c.slova) if (r !== vychozi && re && re.test(titulek)) return r;
    return vychozi;
  }

  /** Adresa přes proxy: šablona s {url} (zakódovaná) nebo prefix, za který se adresa připojí. */
  function prezProxy(sablona, url) {
    if (!sablona) return url;
    return sablona.includes('{url}') ? sablona.replace('{url}', encodeURIComponent(url)) : sablona + encodeURIComponent(url);
  }

  const API = {
    normalizuj, kmeny, podobnost, stejneTema, seskup, rozeberDotaz, filtruj, zvyraznena, obsahuje,
    hlavniTemata, souvisejici, jeClickbait, vIntervalu, klicOdkazu, idOdkazu, entity, vyrazSlov, urciRubriku, casRelativni, oddilyCasu, oddilPro, rozeberKanal, prezProxy, hash, zkrat, bezHtml,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.ZPRAVY_JADRO = API;
})(typeof window !== 'undefined' ? window : globalThis);
