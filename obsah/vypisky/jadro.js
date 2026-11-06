/* Výpisky a citáty – logika bez DOM (window.VYPISKY v prohlížeči, module.exports v node).
   Sbírá zvýraznění, poznámky a záložky ze Čtečky knih a z děl (Kroniky, povídky) do jednoho seznamu,
   přidává vlastní citáty, filtruje, řadí, exportuje (Markdown, CSV, JSON), importuje a rozvrhuje kartičky na arch.
   Data čteček se jen čtou – vlastní data (citáty, štítky a hvězdičky k výpiskům) jsou v localStorage webapp_vypisky.

   Výpisek (položka seznamu):
   {id, druh: 'zvyrazneni'|'zalozka'|'vlastni', zdroj: 'ctecka'|'dilo'|'vlastni', zdrojNazev, knihaKlic, kniha, autor,
    kapitola, kapIndex, knihaIndex, soubor, blok, od, text, poznamka, barva, cas, odkaz, ctenar, stitky: [], hvezda} */
(function (koren, tovarna) {
  if (typeof module === 'object' && module.exports) module.exports = tovarna();
  else koren.VYPISKY = tovarna();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BARVY = { zluta: 'žlutá', zelena: 'zelená', modra: 'modrá', ruzova: 'růžová' };
  const BARVY_HEX = { zluta: '#ffd54f', zelena: '#81c784', modra: '#64b5f6', ruzova: '#f06292' };
  const DRUHY = { zvyrazneni: 'Zvýraznění', zalozka: 'Záložka', vlastni: 'Vlastní citát' };

  // stejné bez-diakritické porovnání jako hledání ve čtečce (ctecka/jadro.js)
  const normalizuj = s => Array.from(String(s == null ? '' : s), z => (z.normalize('NFD')[0] || z).toLowerCase()).join('');
  const bezMd = s => String(s || '').replace(/\.md$/i, '');
  const pole = x => Array.isArray(x) ? x : [];
  const cistyStitek = s => String(s || '').trim().replace(/^#/, '').replace(/\s+/g, ' ');
  const stitkyZTextu = s => [...new Set(String(s || '').split(/[,;]/).map(cistyStitek).filter(Boolean))];

  /* ---------- sběr ze zdrojů ---------- */
  // jedna sada poznámek ({zalozky, zvyrazneni, cizi}) → položky; kontext = {zdroj, prefix, zdrojNazev, autor, knihaPodle(idKnihy) → {klic, nazev, index, kapitoly}, odkaz(z, knihaInfo)}
  function zPoznamek(pozn, kx, moznosti) {
    const ven = [];
    const pridej = (z, druh, ctenar) => {
      const k = kx.knihaPodle(z.kniha);
      const kapIndex = k.kapitoly.findIndex(c => c.soubor === z.soubor || bezMd(c.soubor) === bezMd(z.soubor));
      const kap = k.kapitoly[kapIndex];
      const text = druh === 'zalozka' ? String(z.veta || z.slovo || '').trim() : String(z.text || '').trim();
      ven.push({
        id: kx.prefix + (ctenar ? 'cizi:' + ctenar.id + ':' : '') + z.id,
        druh, zdroj: kx.zdroj, zdrojNazev: kx.zdrojNazev, knihaKlic: k.klic, kniha: k.nazev, autor: kx.autor || '',
        kapitola: kap ? kap.nazev : bezMd(z.soubor), kapIndex: kapIndex < 0 ? 9999 : kapIndex, knihaIndex: k.index,
        soubor: z.soubor || '', blok: +z.blok || 0, od: +z.od || 0,
        text, poznamka: String(z.poznamka || '').trim(), barva: druh === 'zalozka' ? '' : (BARVY[z.barva] ? z.barva : 'zluta'),
        cas: +z.cas || 0, odkaz: kx.odkaz(z, k), ctenar: ctenar ? (ctenar.jmeno || 'čtenář') : '',
        stitky: [], hvezda: false,
      });
    };
    pole(pozn && pozn.zvyrazneni).forEach(z => pridej(z, 'zvyrazneni'));
    pole(pozn && pozn.zalozky).forEach(z => pridej(z, 'zalozka'));
    if (moznosti.cizi) pole(pozn && pozn.cizi).forEach(c => {
      pole(c.zvyrazneni).forEach(z => pridej(z, 'zvyrazneni', c));
      pole(c.zalozky).forEach(z => pridej(z, 'zalozka', c));
    });
    return ven;
  }

  /* zdroje = {
       ctecka: [{meta: {id, nazev, autor, kapitoly}, poznamky}],                     – Čtečka knih (IndexedDB + localStorage)
       dila:   [{dilo: {id, nazev, stranka}, knihy: [{id, nazev, kapitoly}], poznamky}], – Kroniky, povídky (dila.json)
       vlastni: {citaty: [...], doplnky: {id: {stitky, hvezda}}} }
     moznosti.cizi = i poznámky betačtenářů načtené ve čtečce */
  function sber(zdroje, moznosti = {}) {
    const ven = [];
    for (const { meta, poznamky } of pole(zdroje.ctecka)) {
      if (!meta || !meta.id) continue;
      const kapitoly = pole(meta.kapitoly);
      const info = { klic: 'ctecka:' + meta.id, nazev: meta.nazev || 'Bez názvu', index: 0, kapitoly };
      ven.push(...zPoznamek(poznamky, {
        zdroj: 'ctecka', prefix: 'c:' + meta.id + ':', zdrojNazev: 'Čtečka knih', autor: meta.autor,
        knihaPodle: () => info,
        odkaz: z => `ctecka_knih.html?id=${encodeURIComponent(meta.id)}&kniha=1&kap=${encodeURIComponent(bezMd(z.soubor))}&blok=${+z.blok || 0}`,
      }, moznosti));
    }
    for (const { dilo, knihy, poznamky } of pole(zdroje.dila)) {
      if (!dilo || !dilo.id) continue;
      const seznam = pole(knihy);
      const knihaPodle = id => {
        const i = seznam.findIndex(k => k.id === id);
        return i >= 0 ? { klic: 'dilo:' + dilo.id + ':' + id, nazev: seznam[i].nazev, index: i, kapitoly: pole(seznam[i].kapitoly) }
          : { klic: 'dilo:' + dilo.id + ':' + id, nazev: String(id || dilo.nazev), index: 999, kapitoly: [] };
      };
      ven.push(...zPoznamek(poznamky, {
        zdroj: 'dilo', prefix: 'd:' + dilo.id + ':', zdrojNazev: dilo.nazev || dilo.id, autor: dilo.autor || '',
        knihaPodle,
        odkaz: (z, k) => k.index < 999
          ? `${dilo.stranka}?kniha=${k.index + 1}&kap=${encodeURIComponent(bezMd(z.soubor))}&blok=${+z.blok || 0}` : dilo.stranka,
      }, moznosti));
    }
    const v = zdroje.vlastni || {};
    for (const c of pole(v.citaty)) {
      ven.push({
        id: 'v:' + c.id, druh: 'vlastni', zdroj: 'vlastni', zdrojNazev: 'Vlastní citáty',
        knihaKlic: 'vlastni:' + normalizuj(c.zdroj || ''), kniha: c.zdroj || '', autor: c.autor || '',
        kapitola: '', kapIndex: 0, knihaIndex: 0, soubor: '', blok: 0, od: 0,
        text: String(c.text || '').trim(), poznamka: String(c.poznamka || '').trim(), barva: '', cas: +c.cas || 0,
        odkaz: '', ctenar: '', stitky: pole(c.stitky).slice(), hvezda: !!c.hvezda, vlastniId: c.id,
      });
    }
    // štítky a hvězdičky k výpiskům ze čteček (uložené u nás podle id výpisku)
    const dopl = v.doplnky || {};
    for (const p of ven) {
      const d = dopl[p.id];
      if (d && p.druh !== 'vlastni') { p.stitky = pole(d.stitky).slice(); p.hvezda = !!d.hvezda; }
    }
    return ven.filter(p => p.text || p.poznamka);
  }

  /* ---------- filtrování a řazení ---------- */
  // dotaz: slova se musí najít všechna (bez diakritiky), #štítek = jen se štítkem, -slovo = vynechat
  function rozeberDotaz(dotaz) {
    const d = { slova: [], stitky: [], bez: [] };
    for (const t of normalizuj(dotaz).split(/\s+/).filter(Boolean)) {
      if (t.length > 1 && t[0] === '#') d.stitky.push(t.slice(1));
      else if (t.length > 1 && t[0] === '-') d.bez.push(t.slice(1));
      else d.slova.push(t);
    }
    return d;
  }
  const hledanyText = p => normalizuj([p.text, p.poznamka, p.kniha, p.kapitola, p.autor, p.zdrojNazev, p.ctenar, p.stitky.join(' ')].join(' \u0001 '));

  /* f = {hledat, druh, barva ('' | barva | 'zadna'), kniha (knihaKlic), stitek, jenPoznamka, jenHvezda} */
  function filtruj(polozky, f = {}) {
    const d = rozeberDotaz(f.hledat || '');
    const stitek = f.stitek ? normalizuj(f.stitek) : '';
    return polozky.filter(p => {
      if (f.druh && p.druh !== f.druh) return false;
      if (f.barva === 'zadna' ? p.barva : f.barva && p.barva !== f.barva) return false;
      if (f.kniha && p.knihaKlic !== f.kniha) return false;
      if (f.jenPoznamka && !p.poznamka) return false;
      if (f.jenHvezda && !p.hvezda) return false;
      const st = p.stitky.map(normalizuj);
      if (stitek && !st.includes(stitek)) return false;
      if (d.stitky.some(s => !st.some(x => x.startsWith(s)))) return false;
      if (!d.slova.length && !d.bez.length) return true;
      const t = hledanyText(p);
      return d.slova.every(s => t.includes(s)) && !d.bez.some(s => t.includes(s));
    });
  }

  const porovnejText = (a, b) => String(a).localeCompare(String(b), 'cs', { sensitivity: 'base' });
  // pořadí v knize: zdroj (čtečka, díla, vlastní), kniha, kapitola, odstavec, místo v odstavci
  const PORADI_ZDROJE = { dilo: 0, ctecka: 1, vlastni: 2 };
  function vKnize(a, b) {
    return PORADI_ZDROJE[a.zdroj] - PORADI_ZDROJE[b.zdroj] || porovnejText(a.zdrojNazev, b.zdrojNazev)
      || a.knihaIndex - b.knihaIndex || porovnejText(a.kniha, b.kniha)
      || a.kapIndex - b.kapIndex || a.blok - b.blok || a.od - b.od || a.cas - b.cas;
  }
  const RAZENI = {
    nove: (a, b) => b.cas - a.cas,
    stare: (a, b) => a.cas - b.cas,
    kniha: vKnize,
    text: (a, b) => porovnejText(a.text, b.text),
    delka: (a, b) => a.text.length - b.text.length,
  };
  // hvězdičky nahoru jen na přání (hvezdyNahoru) – jinak by rozbily pořadí v knize
  function serad(polozky, razeni = 'nove', hvezdyNahoru = false) {
    const fn = RAZENI[razeni] || RAZENI.nove;
    return polozky.slice().sort((a, b) => (hvezdyNahoru ? (b.hvezda - a.hvezda) : 0) || fn(a, b) || porovnejText(a.id, b.id));
  }

  // přehled knih pro filtr: [{klic, nazev, zdrojNazev, n}] v pořadí jako „podle knihy“
  function seznamKnih(polozky) {
    const m = new Map();
    for (const p of serad(polozky, 'kniha')) {
      if (!m.has(p.knihaKlic)) m.set(p.knihaKlic, { klic: p.knihaKlic, nazev: p.kniha || (p.druh === 'vlastni' ? 'bez zdroje' : ''), zdrojNazev: p.zdrojNazev, zdroj: p.zdroj, n: 0 });
      m.get(p.knihaKlic).n++;
    }
    return [...m.values()];
  }
  function seznamStitku(polozky) {
    const m = new Map();
    for (const p of polozky) for (const s of p.stitky) {
      const k = normalizuj(s);
      if (!m.has(k)) m.set(k, { stitek: s, n: 0 });
      m.get(k).n++;
    }
    return [...m.values()].sort((a, b) => b.n - a.n || porovnejText(a.stitek, b.stitek));
  }

  /* ---------- citát dne ---------- */
  function fnv(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  const dnes = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // citovatelné = zvýraznění a vlastní citáty (záložka je jen místo v knize)
  const citovatelne = polozky => polozky.filter(p => p.druh !== 'zalozka' && p.text);
  // stejný den = stejný citát; pořadí podle id, takže přidání citátu jinam výběr změní jen zřídka
  function citatDne(polozky, den = dnes()) {
    const c = citovatelne(polozky).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (!c.length) return null;
    return c[fnv('vypisky:' + den) % c.length];
  }
  function nahodny(polozky, nahoda = Math.random, krome = null) {
    let c = citovatelne(polozky);
    if (c.length > 1 && krome) c = c.filter(p => p.id !== krome);
    return c.length ? c[Math.floor(nahoda() * c.length) % c.length] : null;
  }

  /* ---------- popisky ---------- */
  // název knihy s dílem: „Kroniky vyhnanství – I. Poslední drak“; když název knihy dílo už obsahuje, jen kniha
  function nazevKnihy(p) {
    if (p.zdroj !== 'dilo' || !p.zdrojNazev || normalizuj(p.kniha).includes(normalizuj(p.zdrojNazev))) return p.kniha;
    return `${p.zdrojNazev} – ${p.kniha}`;
  }
  // „Autor, Kniha“ (díla nemají autora v datech)
  const podpis = p => [p.autor, nazevKnihy(p)].filter(Boolean).join(', ');
  const datum = t => {
    if (!t) return '';
    const d = new Date(t);
    return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  };

  /* ---------- export ---------- */
  function exportMd(polozky, nazev = 'Výpisky a citáty') {
    const radky = [`# ${nazev}`, '', `*Exportováno ${datum(Date.now())} · ${polozky.length} výpisků*`, ''];
    let knihaKlic = null, kap = null;
    for (const p of serad(polozky, 'kniha')) {
      if (p.knihaKlic !== knihaKlic) {
        knihaKlic = p.knihaKlic; kap = null;
        const hlava = p.druh === 'vlastni' ? (p.kniha || 'Vlastní citáty') : nazevKnihy(p);
        radky.push(`## ${hlava}${p.druh !== 'vlastni' && p.autor ? ` (${p.autor})` : ''}`, '');
      }
      if (p.kapitola && p.kapitola !== kap) { kap = p.kapitola; radky.push(`### ${kap}`, ''); }
      const text = p.text.split(/\n+/).map(r => '> ' + r).join('\n');
      radky.push(p.druh === 'zalozka' ? '🔖 ' + text.replace(/^> /, '') : text);
      if (p.druh === 'vlastni' && p.autor) radky.push('>', `> — ${p.autor}`);
      const info = [];
      if (p.poznamka) info.push(`📝 ${p.poznamka}`);
      if (p.ctenar) info.push(`👤 ${p.ctenar}`);
      if (p.stitky.length) info.push(p.stitky.map(s => '#' + s.replace(/\s+/g, '_')).join(' '));
      if (p.hvezda) info.push('★');
      if (info.length) radky.push('', info.join(' · '));
      radky.push('');
    }
    return radky.join('\n');
  }

  const CSV_SLOUPCE = ['druh', 'text', 'poznamka', 'autor', 'zdroj', 'kniha', 'kapitola', 'barva', 'stitky', 'hvezda', 'datum', 'odkaz'];
  const csvPole = v => /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  // středník a BOM kvůli českému Excelu
  function exportCsv(polozky) {
    const radky = [CSV_SLOUPCE.join(';')];
    for (const p of polozky) {
      radky.push([p.druh, p.text, p.poznamka, p.autor, p.druh === 'vlastni' ? p.kniha : p.zdrojNazev, p.druh === 'vlastni' ? '' : p.kniha,
        p.kapitola, p.barva, p.stitky.join(', '), p.hvezda ? '1' : '', p.cas ? new Date(p.cas).toISOString().slice(0, 10) : '', p.odkaz]
        .map(v => csvPole(String(v == null ? '' : v))).join(';'));
    }
    return '﻿' + radky.join('\r\n') + '\r\n';
  }

  // JSON: položky (k přečtení jinde) + vlastní data (záloha – jde zpět načíst importem)
  function exportJson(polozky, vlastni = {}) {
    const ven = polozky.map(p => {
      const o = { druh: p.druh, text: p.text };
      for (const k of ['poznamka', 'autor', 'kniha', 'kapitola', 'barva', 'ctenar', 'odkaz']) if (p[k]) o[k] = p[k];
      if (p.druh !== 'vlastni') o.zdroj = p.zdrojNazev; else if (p.kniha) { o.zdroj = p.kniha; delete o.kniha; }
      if (p.stitky.length) o.stitky = p.stitky;
      if (p.hvezda) o.hvezda = true;
      if (p.cas) o.cas = p.cas;
      o.id = p.druh === 'vlastni' ? p.vlastniId : p.id;
      return o;
    });
    return JSON.stringify({ format: 'vypisky', verze: 1, cas: Date.now(), polozky: ven, vlastni: { citaty: pole(vlastni.citaty), doplnky: vlastni.doplnky || {} } }, null, 1);
  }

  /* ---------- import ---------- */
  // RFC 4180 CSV; oddělovač podle prvního řádku (; , tabulátor)
  function ctiCsv(text) {
    text = String(text).replace(/^﻿/, '');
    const prvni = text.split(/\r?\n/)[0] || '';
    const odd = [';', '\t', ','].map(o => [o, prvni.split(o).length]).sort((a, b) => b[1] - a[1])[0][0];
    const radky = [];
    let r = [], bunka = '', uvoz = false;
    for (let i = 0; i < text.length; i++) {
      const z = text[i];
      if (uvoz) {
        if (z === '"') { if (text[i + 1] === '"') { bunka += '"'; i++; } else uvoz = false; }
        else bunka += z;
      } else if (z === '"' && bunka === '') uvoz = true;
      else if (z === odd) { r.push(bunka); bunka = ''; }
      else if (z === '\n' || z === '\r') {
        if (z === '\r' && text[i + 1] === '\n') i++;
        r.push(bunka); bunka = '';
        if (r.some(x => x !== '')) radky.push(r);
        r = [];
      } else bunka += z;
    }
    r.push(bunka);
    if (r.some(x => x !== '')) radky.push(r);
    return radky;
  }

  const HLAVICKY = {
    text: ['text', 'citat', 'quote', 'vypisek', 'zvyrazneni'], autor: ['autor', 'author'], zdroj: ['zdroj', 'source', 'dilo', 'kniha', 'book', 'title', 'nazev'],
    stitky: ['stitky', 'stitek', 'tags', 'tag', 'stitky (oddelene carkou)'], poznamka: ['poznamka', 'note', 'notes', 'komentar'], druh: ['druh'], hvezda: ['hvezda', 'oblibene', 'star'],
  };
  // CSV → [{text, autor, zdroj, stitky, poznamka}]; bez známé hlavičky: text, autor, zdroj, štítky
  function importCsv(text) {
    const radky = ctiCsv(text);
    if (!radky.length) return [];
    const hl = radky[0].map(h => normalizuj(h).trim());
    const sl = {};
    for (const [k, jmena] of Object.entries(HLAVICKY)) { const i = hl.findIndex(h => jmena.includes(h)); if (i >= 0) sl[k] = i; }
    // export této stránky: zdroj = kniha u vlastních, „kniha“ sloupec je u výpisků ze čtečky
    if (hl.includes('kniha') && hl.includes('zdroj')) { sl.zdroj = hl.indexOf('zdroj'); sl.kniha = hl.indexOf('kniha'); }
    const maHlavicku = sl.text != null;
    const data = maHlavicku ? radky.slice(1) : radky;
    if (!maHlavicku) Object.assign(sl, { text: 0, autor: 1, zdroj: 2, stitky: 3 });
    return data.map(r => {
      const g = k => (sl[k] != null ? String(r[sl[k]] || '') : '').trim();
      // výpisek ze čtečky v našem CSV: zdroj = dílo, kniha = název knihy
      const zdroj = g('kniha') ? [g('zdroj') !== g('kniha') ? g('zdroj') : '', g('kniha')].filter(Boolean).join(' – ') : g('zdroj');
      return { text: g('text'), autor: g('autor'), zdroj, stitky: stitkyZTextu(g('stitky')), poznamka: g('poznamka'), hvezda: /^(1|ano|true|★)$/i.test(g('hvezda')) };
    }).filter(c => c.text);
  }

  // JSON: náš export ({format:'vypisky'}), pole citátů, nebo {citaty:[...]}; → {citaty, doplnky}
  function importJson(text) {
    const d = JSON.parse(String(text).replace(/^﻿/, ''));
    const surove = Array.isArray(d) ? d : d && d.format === 'vypisky' ? pole(d.polozky) : pole(d && (d.citaty || d.quotes));
    const citaty = [];
    for (const c of surove) {
      if (!c || typeof c !== 'object') continue;
      if (c.druh && c.druh !== 'vlastni') continue;   // výpisky ze čtečky patří čtečce, ne mezi vlastní citáty
      const t = String(c.text || c.citat || c.quote || '').trim();
      if (!t) continue;
      citaty.push({ text: t, autor: String(c.autor || c.author || '').trim(), zdroj: String(c.zdroj || c.source || c.kniha || '').trim(),
        stitky: Array.isArray(c.stitky || c.tags) ? (c.stitky || c.tags).map(cistyStitek).filter(Boolean) : stitkyZTextu(c.stitky || c.tags),
        poznamka: String(c.poznamka || c.note || '').trim(), hvezda: !!c.hvezda, cas: +c.cas || 0 });
    }
    const doplnky = d && d.format === 'vypisky' && d.vlastni && d.vlastni.doplnky && typeof d.vlastni.doplnky === 'object' ? d.vlastni.doplnky : {};
    // záloha může mít vlastní citáty jen ve vlastni.citaty
    if (d && d.format === 'vypisky' && !citaty.length) pole(d.vlastni && d.vlastni.citaty).forEach(c => c && c.text && citaty.push({ ...c, stitky: pole(c.stitky) }));
    return { citaty, doplnky };
  }

  // sloučení: stejný text (bez diakritiky, mezer a interpunkce) + autor = duplicita → přeskočit
  const otiskCitatu = c => normalizuj(c.text).replace(/[^a-z0-9]+/g, '') + '|' + normalizuj(c.autor || '').replace(/[^a-z0-9]+/g, '');
  function slucCitaty(stare, nove, noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)) {
    const mam = new Set(stare.map(otiskCitatu));
    const citaty = stare.slice();
    let pridano = 0, preskoceno = 0;
    for (const c of nove) {
      const o = otiskCitatu(c);
      if (mam.has(o)) { preskoceno++; continue; }
      mam.add(o);
      citaty.push({ id: noveId(), text: c.text, autor: c.autor || '', zdroj: c.zdroj || '', stitky: pole(c.stitky), poznamka: c.poznamka || '', hvezda: !!c.hvezda, cas: c.cas || Date.now() });
      pridano++;
    }
    return { citaty, pridano, preskoceno };
  }

  /* ---------- kartičky k tisku ---------- */
  // rozměry v mm na šířku (w ≥ h); vizitka podle české normy 90 × 50
  const KARTY = { vizitka: { nazev: 'Vizitka 90 × 50 mm', w: 90, h: 50, podpisPt: 7, maxPt: 13 },
    a7: { nazev: 'A7 105 × 74 mm', w: 105, h: 74, podpisPt: 8, maxPt: 16 },
    a6: { nazev: 'A6 148 × 105 mm', w: 148, h: 105, podpisPt: 10, maxPt: 22 } };
  const A4 = { w: 210, h: 297 };
  const PT = 25.4 / 72;   // 1 pt v mm

  const vejde = (delka, kus, okraj, mezera) => Math.max(0, Math.floor((delka - 2 * okraj + mezera + 1e-6) / (kus + mezera)));
  /* Kolik karet se vejde na arch a kam: zkusí arch na výšku i na šířku a vybere, kde je jich víc (při shodě na výšku).
     karta {w,h}, arch {w,h} (na výšku), o = {okraj, mezera} v mm → {archW, archH, sloupce, radky, naArch, pozice:[{x,y}]} (karty vycentrované) */
  function rozvrh(karta, arch = A4, o = {}) {
    const okraj = o.okraj || 0, mezera = o.mezera || 0;
    let nej = null;
    for (const [aw, ah] of [[arch.w, arch.h], [arch.h, arch.w]]) {
      const s = vejde(aw, karta.w, okraj, mezera), r = vejde(ah, karta.h, okraj, mezera);
      if (!nej || s * r > nej.sloupce * nej.radky) nej = { archW: aw, archH: ah, sloupce: s, radky: r };
    }
    nej.naArch = nej.sloupce * nej.radky;
    const sirka = nej.sloupce * karta.w + (nej.sloupce - 1) * mezera, vyska = nej.radky * karta.h + (nej.radky - 1) * mezera;
    const x0 = (nej.archW - sirka) / 2, y0 = (nej.archH - vyska) / 2;
    nej.pozice = [];
    for (let r = 0; r < nej.radky; r++) for (let s = 0; s < nej.sloupce; s++)
      nej.pozice.push({ x: +(x0 + s * (karta.w + mezera)).toFixed(3), y: +(y0 + r * (karta.h + mezera)).toFixed(3) });
    return nej;
  }
  // rozdělení citátů na archy podle rozvrhu
  function naArchy(polozky, naArch) {
    const archy = [];
    if (naArch < 1) return archy;
    for (let i = 0; i < polozky.length; i += naArch) archy.push(polozky.slice(i, i + naArch));
    return archy;
  }

  /* Zalomení textu na řádky šířky `sirka` (mm); mer(s) = šířka řetězce v mm. Odstavce podle \n.
     Slovo delší než řádek se rozdělí po znacích. */
  function zalom(text, sirka, mer) {
    const radky = [];
    for (const odst of String(text).split(/\n/)) {
      const slova = odst.split(/\s+/).filter(Boolean);
      let r = '';
      for (let s of slova) {
        const zkus = r ? r + ' ' + s : s;
        if (mer(zkus) <= sirka) { r = zkus; continue; }
        if (r) radky.push(r);
        r = '';
        while (mer(s) > sirka && s.length > 1) {   // dlouhé slovo po kouscích
          let n = s.length - 1;
          while (n > 1 && mer(s.slice(0, n)) > sirka) n--;
          radky.push(s.slice(0, n)); s = s.slice(n);
        }
        r = s;
      }
      if (r || !slova.length) radky.push(r);
    }
    while (radky.length > 1 && radky[radky.length - 1] === '') radky.pop();
    return radky;
  }

  /* Největší velikost písma (pt, krok 0,5), při které se text vejde do w × h mm; mer(s, pt) → mm.
     → {pt, radky, oriznuto} – když se nevejde ani minPt, poslední řádek končí „…“. */
  function prizpusob(text, w, h, mer, o = {}) {
    const maxPt = o.maxPt || 14, minPt = o.minPt || 6, rad = o.radkovani || 1.25;
    for (let pt = maxPt; pt >= minPt; pt -= 0.5) {
      const radky = zalom(text, w, s => mer(s, pt));
      if (radky.length * pt * PT * rad <= h + 1e-6) return { pt, radky, oriznuto: false };
    }
    let radky = zalom(text, w, s => mer(s, minPt));
    const max = Math.max(1, Math.floor((h + 1e-6) / (minPt * PT * rad)));
    if (radky.length > max) {
      radky = radky.slice(0, max);
      let r = radky[max - 1];
      while (r && mer(r + '…', minPt) > w) r = r.replace(/\s*\S+$/, '') || r.slice(0, -1);
      radky[max - 1] = r + '…';
      return { pt: minPt, radky, oriznuto: true };
    }
    return { pt: minPt, radky, oriznuto: false };
  }

  /* Rozložení jedné karty (souřadnice v mm od levého horního rohu karty).
     karta {w,h,podpisPt,maxPt}, n = {okraj (vnitřní, mm), uvozovky, podpis, zarovnani: 'stred'|'vlevo', maxPt, radkovani}
     → {text: {pt, radky:[{s, x, y}], oriznuto}, podpis: {pt, radky:[{s, x, y}]} | null, zarovnani}
     y = účaří řádku; x = levý okraj, u zarovnání na střed střed karty. */
  function rozlozKartu(p, karta, mer, n = {}) {
    const okraj = n.okraj != null ? n.okraj : Math.max(5, Math.round(karta.h * 0.1));
    const rad = n.radkovani || 1.25, stred = n.zarovnani !== 'vlevo';
    const w = karta.w - 2 * okraj, vnitrH = karta.h - 2 * okraj;
    const x = stred ? karta.w / 2 : okraj;
    let telo = String(p.text || '').replace(/\s*\n\s*/g, '\n').trim();
    if (n.uvozovky !== false && telo) telo = '„' + telo.replace(/^[„“"]+|[“”"]+$/g, '') + '“';
    let podpisR = null, podpisH = 0;
    const pText = n.podpis !== false ? podpis(p) : '';
    if (pText) {
      const pt = karta.podpisPt;
      const radky = zalom('— ' + pText, w, s => mer(s, pt)).slice(0, 2);
      podpisH = radky.length * pt * PT * 1.2 + pt * PT * 0.8;   // + mezera nad podpisem
      const dole = karta.h - okraj;
      podpisR = { pt, radky: radky.map((s, i) => ({ s, x: stred ? karta.w / 2 : karta.w - okraj, y: +(dole - (radky.length - 1 - i) * pt * PT * 1.2 - pt * PT * 0.25).toFixed(3) })), zarovnani: stred ? 'stred' : 'vpravo' };
    }
    const f = prizpusob(telo, w, vnitrH - podpisH, mer, { maxPt: n.maxPt || karta.maxPt, minPt: 5, radkovani: rad });
    const radekH = f.pt * PT * rad, blokH = f.radky.length * radekH;
    const y0 = okraj + (vnitrH - podpisH - blokH) / 2;   // svisle na střed volné plochy
    return {
      text: { pt: f.pt, oriznuto: f.oriznuto, radky: f.radky.map((s, i) => ({ s, x, y: +(y0 + i * radekH + f.pt * PT * 0.95).toFixed(3) })) },
      podpis: podpisR, zarovnani: stred ? 'stred' : 'vlevo',
    };
  }

  /* ---------- kreslení karet (plátno náhledu i jsPDF přes rozhraní g) ----------
     g = {obdelnik(x, y, w, h, tloustka, barva, carkovane), cara(x1, y1, x2, y2, tloustka), text(s, x, y, pt, zarovnani, barva)}
     n = nastavení karet {ramecek: 'zadny'|'linka'|'dvojity'|'rohy', orezy}; vše v mm. */
  function kresliKartu(g, x, y, k, roz, n = {}) {
    if (n.orezy) g.obdelnik(x, y, k.w, k.h, 0.1, '#b4b4b4', true);
    const v = Math.max(2.5, Math.min(k.w, k.h) * 0.06);
    if (n.ramecek === 'linka') g.obdelnik(x + v, y + v, k.w - 2 * v, k.h - 2 * v, 0.3, '#444444');
    if (n.ramecek === 'dvojity') { g.obdelnik(x + v, y + v, k.w - 2 * v, k.h - 2 * v, 0.5, '#444444'); g.obdelnik(x + v + 1.2, y + v + 1.2, k.w - 2 * v - 2.4, k.h - 2 * v - 2.4, 0.2, '#444444'); }
    if (n.ramecek === 'rohy') {
      const d = Math.min(k.w, k.h) * 0.14;
      for (const [cx, cy, sx, sy] of [[x + v, y + v, 1, 1], [x + k.w - v, y + v, -1, 1], [x + v, y + k.h - v, 1, -1], [x + k.w - v, y + k.h - v, -1, -1]]) {
        g.cara(cx, cy, cx + sx * d, cy, 0.4); g.cara(cx, cy, cx, cy + sy * d, 0.4);
        g.cara(cx + sx * 1.5, cy + sy * 1.5, cx + sx * d * 0.6, cy + sy * 1.5, 0.15); g.cara(cx + sx * 1.5, cy + sy * 1.5, cx + sx * 1.5, cy + sy * d * 0.6, 0.15);
      }
    }
    const stred = roz.zarovnani === 'stred';
    for (const r of roz.text.radky) g.text(r.s, x + r.x, y + r.y, roz.text.pt, stred ? 'center' : 'left', '#1e1e1e');
    if (roz.podpis) for (const r of roz.podpis.radky) g.text(r.s, x + r.x, y + r.y, roz.podpis.pt, stred ? 'center' : 'right', '#555555');
  }

  // vestavěná písma jsPDF neumějí češtinu → vložit TTF (pismo = {base64, rodina, soubor}), jako ostatní stránky webu
  function pridejPismo(doc, p) {
    doc.addFileToVFS(p.soubor, p.base64);
    doc.addFont(p.soubor, p.rodina, 'normal');
    doc.setFont(p.rodina, 'normal');
  }
  /* PDF všech archů: JsPDF = konstruktor jsPDF, r = rozvrh, archy = [[položka]], rozlozeni = Map(id → rozlozKartu) */
  function pdfKaret(JsPDF, { r, k, archy, rozlozeni, n, pismo }) {
    const orient = r.archW > r.archH ? 'l' : 'p';
    const doc = new JsPDF({ unit: 'mm', format: [r.archW, r.archH], orientation: orient, compress: true });
    doc.setProperties({ title: 'Citáty na kartičky', creator: 'Výpisky a citáty' });
    pridejPismo(doc, pismo);
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const g = {
      obdelnik(x, y, w, h, tl, barva, carkovane) { doc.setLineWidth(tl); doc.setDrawColor(...rgb(barva)); doc.setLineDashPattern(carkovane ? [1.5, 1.5] : [], 0); doc.rect(x, y, w, h, 'S'); doc.setLineDashPattern([], 0); },
      cara(x1, y1, x2, y2, tl) { doc.setLineWidth(tl); doc.setDrawColor(68, 68, 68); doc.line(x1, y1, x2, y2); },
      text(s, x, y, pt, zarovnani, barva) { doc.setFontSize(pt); doc.setTextColor(...rgb(barva)); doc.text(s, x, y, { align: zarovnani }); },
    };
    archy.forEach((arch, a) => {
      if (a) doc.addPage([r.archW, r.archH], orient);
      arch.forEach((p, i) => kresliKartu(g, r.pozice[i].x, r.pozice[i].y, k, rozlozeni.get(p.id), n));
    });
    return doc;
  }

  return {
    BARVY, BARVY_HEX, DRUHY, KARTY, A4, PT, normalizuj, stitkyZTextu, sber, rozeberDotaz, filtruj, serad, seznamKnih, seznamStitku,
    fnv, dnes, citatDne, nahodny, nazevKnihy, podpis, datum, exportMd, exportCsv, exportJson, ctiCsv, importCsv, importJson, slucCitaty,
    rozvrh, naArchy, zalom, prizpusob, rozlozKartu, kresliKartu, pridejPismo, pdfKaret,
  };
});
