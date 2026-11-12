/* Leonardův zápisník – jádro bez DOM: čísla listů, adresy snímků, hledání v textech.
 * Testy: node _test/leonardo_test.js */
(function (koren) {
  'use strict';

  // Commons: „0327v“ → Codex_Atlanticus_-_000V-327.jpg (část souborů má krátký název 000R-1001.jpg)
  function nazevCommons(l) {
    const zaklad = '000' + l.s.toUpperCase() + '-' + l.n + '.jpg';
    return l.c.endsWith('*') ? zaklad : 'Codex_Atlanticus_-_' + zaklad;
  }
  function souborListu(l) { return String(l.n).padStart(4, '0') + l.s; }
  function urlCommons(data, l) {
    const h = l.c.replace('*', '');
    return data.commons + h[0] + '/' + h + '/' + nazevCommons(l);
  }
  function urlSnimku(data, l, cesta) {
    return l.loc ? cesta + 'atlanticus/' + souborListu(l) + '.webp' : urlCommons(data, l);
  }
  function urlNahledu(data, l, cesta) {
    // náhled chybí jen během stahování originálů – pak plný snímek z Commons
    return l.nah ? cesta + 'atlanticus/nahledy/' + souborListu(l) + '.webp' : urlCommons(data, l);
  }
  function stranaCommons(l) { return 'https://commons.wikimedia.org/wiki/File:' + nazevCommons(l); }

  const popis = l => l.n + ' ' + l.s;
  // „119 verso a“ → „119 v a“
  const kratkeStare = h => h.replace(/\brecto\b/g, 'r').replace(/\bverso\b/g, 'v').replace(/\s+/g, ' ').trim();

  // vstup: „327v“, „f. 327 v“, „#120“ (pořadí strany), „s119v“ / „s 119 v a“ (staré číslování Hoepli)
  function najdiList(listy, text) {
    let t = String(text || '').trim().toLowerCase();
    if (!t) return -1;
    let m = /^#(\d+)$/.exec(t);
    if (m) return Math.min(listy.length, Math.max(1, +m[1])) - 1;
    m = /^(?:s|st|star[ée])\.?\s*(\d+)\s*(r|v|recto|verso)?\s*([a-e])?$/.exec(t);
    if (m) {
      const n = +m[1], st = m[2] ? m[2][0] : '', pis = m[3] || '';
      let nejlepsi = -1;
      listy.forEach((l, i) => {
        if (nejlepsi >= 0 && !pis) return;
        (l.h || []).forEach(h => {
          const r = /^(\d+)\s*(?:bis\s*)?(recto|verso)?\s*([a-e])?/.exec(h);
          if (!r || +r[1] !== n) return;
          if (st && r[2] && r[2][0] !== st) return;
          if (pis && r[3] !== pis) return;
          if (nejlepsi < 0) nejlepsi = i;
        });
      });
      return nejlepsi;
    }
    m = /^(?:f\.?\s*)?(\d+)\s*([a-e]\s*)?(r|v|recto|verso)?$/.exec(t.replace(/\s+/g, ' '));
    if (!m) return -1;
    const n = +m[1];
    if (n < 1) return -1;
    const s = m[3] ? m[3][0] : 'r';
    const i = listy.findIndex(l => l.n === n && l.s === s);
    return i;
  }

  // ---------- texty ----------
  // stejná délka jako NFC vstup (kvůli pozicím při zvýrazňování)
  const bezDiakritiky = s => String(s).normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[’`']/g, "'");

  function uryvkyNaListech(uryvky) {
    const mapa = {};
    uryvky.forEach(u => (u.ca || []).forEach(i => { (mapa[i] = mapa[i] || []).push(u); }));
    return mapa;
  }

  // dotaz: slova (všechna musí být), "fráze v uvozovkách"; jazyk: obe|cs|it
  function rozeberDotaz(dotaz) {
    const casti = [];
    String(dotaz || '').replace(/"([^"]+)"|(\S+)/g, (_, fr, sl) => { casti.push(bezDiakritiky(fr || sl)); });
    return casti.filter(Boolean);
  }
  function textUryvku(u, jazyk) {
    const it = u.ni + '\n' + u.it.join('\n'), cs = u.nc + '\n' + u.cs.join('\n');
    return jazyk === 'it' ? it : jazyk === 'cs' ? cs : it + '\n' + cs;
  }
  function hledej(uryvky, dotaz, jazyk, oddil) {
    const casti = rozeberDotaz(dotaz);
    return uryvky.filter(u => {
      if (oddil && u.o !== oddil) return false;
      if (!casti.length) return true;
      const t = bezDiakritiky(textUryvku(u, jazyk));
      return casti.every(c => t.includes(c));
    });
  }
  // obalí výskyty <mark>; vstup je už escapovaný HTML text bez značek
  function zvyrazni(html, dotaz) {
    const casti = rozeberDotaz(dotaz);
    if (!casti.length) return html;
    const plain = bezDiakritiky(html);
    const useky = [];
    casti.forEach(c => {
      let i = 0;
      while ((i = plain.indexOf(c, i)) >= 0) { useky.push([i, i + c.length]); i += c.length; }
    });
    if (!useky.length) return html;
    useky.sort((a, b) => a[0] - b[0]);
    let vys = '', pos = 0;
    useky.forEach(([a, b]) => {
      if (a < pos) return;
      // nerozdělit HTML entitu (&amp; …)
      if (html.slice(0, a).lastIndexOf('&') > html.slice(0, a).lastIndexOf(';')) return;
      vys += html.slice(pos, a) + '<mark>' + html.slice(a, b) + '</mark>';
      pos = b;
    });
    return vys + html.slice(pos);
  }

  // ---------- statistiky pro témata ----------
  function souhrnTemat(listy) {
    const mat = {};
    listy.forEach((l, i) => (l.t || []).forEach(([m, t]) => {
      const zm = mat[m] = mat[m] || { listy: new Set(), temata: {} };
      zm.listy.add(i);
      (zm.temata[t] = zm.temata[t] || new Set()).add(i);
    }));
    return mat;
  }
  function souhrnRoku(listy) {
    const roky = {};
    listy.forEach((l, i) => {
      const r = parseInt(l.rok, 10);
      if (r) (roky[r] = roky[r] || []).push(i);
    });
    return roky;
  }

  const API = {
    nazevCommons, souborListu, urlCommons, urlSnimku, urlNahledu, stranaCommons, popis, kratkeStare,
    najdiList, bezDiakritiky, uryvkyNaListech, rozeberDotaz, hledej, zvyrazni, souhrnTemat, souhrnRoku
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else koren.LeoJadro = API;
})(this);
