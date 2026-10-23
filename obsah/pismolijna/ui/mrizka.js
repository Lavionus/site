/* ============================================================
   Písmolijna – ui/mrizka.js
   Mřížka znaků (obdoba hlavního okna FontForge): bloky Unicode
   vlevo, buňky s náhledem glyfu, výběr myší i klávesnicí,
   hledání, kopírování glyfů mezi buňkami.
   Klíč buňky: název glyfu, u prázdné pozice „U+XXXX“.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL, A = window.PSLAPP;
  const M = A.mrizka = {};

  const elBloky = document.getElementById('bloky');
  const elZnaky = document.getElementById('znaky');
  const elHledat = document.getElementById('hledatZnak');
  const elVel = document.getElementById('velikostBunky');
  const elInfo = document.getElementById('vyberInfo');

  let blok = A.nastaveni.blok || 'font';
  let polozky = [];          // [{klic, nazev|null, cp|null}]
  let kotva = -1;            // index pro výběr se Shiftem
  let fokus = -1;
  const pozorovatel = 'IntersectionObserver' in window ? new IntersectionObserver(viditelne, { root: elZnaky, rootMargin: '200px' }) : null;

  const hexU = cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  const tisknutelny = cp => cp != null && cp > 0x20 && !(cp >= 0x7F && cp <= 0xA0) && !(cp >= 0x300 && cp <= 0x36F) && cp !== 0xAD;

  /* ---------- bloky ---------- */
  function vykresliBloky() {
    const f = A.font, mapa = P.cmap(f);
    elBloky.innerHTML = '';
    const ZAKLADNI = ['font', 'cesky', 'zaklad', 'cisla', 'interpunkce', 'latin1'];   // bloky i v jednoduchém režimu
    const tl = (id, nazev, pocet) => {
      const b = A.el('button', { type: 'button', class: ZAKLADNI.includes(id) ? null : 'pokrocile', 'aria-current': String(blok === id), onclick: () => { blok = id; A.nastaveni.blok = id; A.ulozNastaveni(); elBloky.classList.remove('otevrene'); vykresliBloky(); sestav(); } },
        [A.el('span', { text: nazev }), A.el('span', { class: 'pocet', text: pocet })]);
      elBloky.append(b);
    };
    tl('font', 'Glyfy ve fontu', String(f.poradi.length));
    const bezUni = f.poradi.filter(n => !(f.glyfy[n].uni || []).length).length;
    tl('bezuni', 'Bez Unicode (varianty, ligatury)', String(bezUni));
    elBloky.append(A.el('h3', { text: 'Bloky Unicode' }));
    for (const b of P.BLOKY) {
      const ma = b.znaky.filter(c => mapa.has(c) && !P.glyfJePrazdny(f.glyfy[mapa.get(c)])).length;
      tl(b.id, b.nazev, ma + '/' + b.znaky.length);
    }
  }

  /* ---------- položky ---------- */
  function sestavPolozky() {
    const f = A.font, mapa = P.cmap(f);
    let out;
    if (blok === 'font') out = f.poradi.map(n => ({ klic: n, nazev: n, cp: (f.glyfy[n].uni || [])[0] ?? null }));
    else if (blok === 'bezuni') out = f.poradi.filter(n => !(f.glyfy[n].uni || []).length).map(n => ({ klic: n, nazev: n, cp: null }));
    else {
      const b = P.BLOKY.find(x => x.id === blok) || P.BLOKY[0];
      out = b.znaky.map(cp => mapa.has(cp) ? { klic: mapa.get(cp), nazev: mapa.get(cp), cp } : { klic: hexU(cp), nazev: null, cp });
      // glyfy bez unicode odvozené od znaků bloku (a.alt, a.sc) hned za nimi
    }
    const q = elHledat.value.trim();
    if (q) {
      let cpHledany = null;
      const m = /^(?:U\+|0x)?([0-9A-Fa-f]{4,6})$/.exec(q);
      if (Array.from(q).length === 1) cpHledany = q.codePointAt(0);
      else if (m && /^(U\+|0x)/i.test(q)) cpHledany = parseInt(m[1], 16);
      if (cpHledany != null) {
        const n = mapa.get(cpHledany);
        out = [n ? { klic: n, nazev: n, cp: cpHledany } : { klic: hexU(cpHledany), nazev: null, cp: cpHledany }];
      } else {
        const ql = q.toLowerCase();
        out = f.poradi.filter(n => n.toLowerCase().includes(ql)).map(n => ({ klic: n, nazev: n, cp: (f.glyfy[n].uni || [])[0] ?? null }));
      }
    }
    return out;
  }

  function sestav() {
    polozky = sestavPolozky();
    if (pozorovatel) pozorovatel.disconnect();
    elZnaky.innerHTML = '';
    const frag = document.createDocumentFragment();
    polozky.forEach((p, i) => frag.append(bunka(p, i)));
    elZnaky.append(frag);
    infoVyberu();
  }

  function bunka(p, i) {
    const f = A.font, g = p.nazev ? f.glyfy[p.nazev] : null;
    const prazdna = !g || P.glyfJePrazdny(g);
    const popis = tisknutelny(p.cp) ? String.fromCodePoint(p.cp) : (p.nazev || hexU(p.cp));
    const el = A.el('div', {
      class: 'bunka' + (prazdna ? ' prazdna' : '') + (A.vyber.has(p.klic) ? ' vybrana' : ''),
      'data-i': i, 'data-klic': p.klic,
      title: (p.nazev || '(není ve fontu)') + (p.cp != null ? ' · ' + hexU(p.cp) : '') + (g ? ' · šířka ' + g.sirka : '')
    }, [A.el('div', { class: 'popis', text: popis }), A.el('canvas')]);
    if (g && g.barva) el.append(A.el('span', { class: 'stitek', style: 'background:' + g.barva }));
    if (g && (g.komponenty || []).length) el.append(A.el('span', { class: 'komp', text: '⧉', title: 'složený z komponent' }));
    if (pozorovatel) pozorovatel.observe(el); else setTimeout(() => kresliBunku(el), 0);
    return el;
  }

  function viditelne(zaznamy) {
    for (const z of zaznamy) if (z.isIntersecting) { kresliBunku(z.target); pozorovatel.unobserve(z.target); }
  }

  function kresliBunku(el) {
    const p = polozky[+el.dataset.i];
    if (!p) return;
    const cv = el.querySelector('canvas');
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const f = A.font, B = A.barvy();
    const g = p.nazev ? f.glyfy[p.nazev] : null;
    const asc = Math.max(f.info.ascender, f.info.vyskaVerzalek * 1.15), desc = f.info.descender;
    const k = (h * 0.86) / (asc - desc);
    const zakl = h * 0.07 + asc * k;
    if (!g || P.glyfJePrazdny(g)) {
      if (p.cp != null && tisknutelny(p.cp)) {
        ctx.fillStyle = B.slaby; ctx.font = Math.round(h * 0.5) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(String.fromCodePoint(p.cp), w / 2, h * 0.68);
      }
      if (g) {   // prázdný glyf (mezera): ukázat šířku
        ctx.strokeStyle = B.metrika; ctx.setLineDash([2, 2]);
        const sw = g.sirka * k, x0 = (w - sw) / 2;
        ctx.strokeRect(x0, zakl - 2, sw, 2);
      }
      return;
    }
    const sw = g.sirka * k;
    const x0 = (w - Math.max(sw, 1)) / 2;
    ctx.strokeStyle = B.okraj; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, Math.round(zakl) + .5); ctx.lineTo(w, Math.round(zakl) + .5); ctx.stroke();
    ctx.fillStyle = B.plna;
    ctx.beginPath();
    P.kresliObrysy(ctx, P.plneObrysy(f, g).filter(o => !o.otevreny), [k, 0, 0, -k, x0, zakl]);
    ctx.fill('nonzero');
    const otevrene = g.obrysy.filter(o => o.otevreny);
    if (otevrene.length) {
      ctx.strokeStyle = B.nebezpeci; ctx.beginPath();
      P.kresliObrysy(ctx, otevrene, [k, 0, 0, -k, x0, zakl]); ctx.stroke();
    }
  }

  /* Překreslí buňky daných glyfů (a glyfů, které je používají jako komponenty). */
  function prekresliGlyfy(jmena) {
    const f = A.font, mnozina = new Set(jmena);
    // složené glyfy, které obsahují změněné
    for (const n of f.poradi) for (const k of f.glyfy[n].komponenty || []) if (mnozina.has(k.glyf)) mnozina.add(n);
    for (const el of elZnaky.children) {
      const p = polozky[+el.dataset.i];
      if (p && mnozina.has(p.klic)) kresliBunku(el);
    }
  }

  /* ---------- výběr ---------- */
  function infoVyberu() {
    const n = A.vyber.size;
    elInfo.textContent = n ? 'vybráno: ' + n : '';
    for (const el of elZnaky.children) el.classList.toggle('vybrana', A.vyber.has(el.dataset.klic));
  }
  function vyber(i, rezim) {
    const p = polozky[i]; if (!p) return;
    if (rezim === 'pridat') { if (A.vyber.has(p.klic)) A.vyber.delete(p.klic); else A.vyber.add(p.klic); kotva = i; }
    else if (rezim === 'rozsah' && kotva >= 0) {
      A.vyber.clear();
      for (let k = Math.min(kotva, i); k <= Math.max(kotva, i); k++) A.vyber.add(polozky[k].klic);
    } else { A.vyber.clear(); A.vyber.add(p.klic); kotva = i; }
    fokus = i;
    infoVyberu();
    const el = elZnaky.children[i];
    if (el) el.scrollIntoView({ block: 'nearest' });
    A.vyhlas('vyber');
  }

  /* Vybrané glyfy, které ve fontu existují. */
  A.vybraneGlyfy = function () {
    return Array.from(A.vyber).filter(k => A.font.glyfy[k]);
  };
  /* Vybrané pozice jako {nazev|null, cp|null}. */
  M.vybranePozice = function () {
    const out = [];
    for (const k of A.vyber) {
      if (A.font.glyfy[k]) out.push({ nazev: k, cp: (A.font.glyfy[k].uni || [])[0] ?? null });
      else { const m = /^U\+([0-9A-F]+)$/.exec(k); if (m) out.push({ nazev: null, cp: parseInt(m[1], 16) }); }
    }
    return out;
  };

  /* Zajistí existenci glyfu pro položku a otevře ho v editoru. */
  M.otevri = function (p) {
    let nazev = p.nazev;
    if (!nazev) {
      A.zmen('Nový glyf ' + hexU(p.cp), { glyfy: [] }, () => { nazev = P.glyfProZnak(A.font, p.cp, true).nazev; });
    }
    A.otevriGlyf(nazev);
  };

  elZnaky.addEventListener('click', e => {
    const el = e.target.closest('.bunka'); if (!el) return;
    vyber(+el.dataset.i, e.shiftKey ? 'rozsah' : (e.ctrlKey || e.metaKey) ? 'pridat' : null);
    elZnaky.focus({ preventScroll: true });
  });
  elZnaky.addEventListener('dblclick', e => {
    const el = e.target.closest('.bunka'); if (!el) return;
    M.otevri(polozky[+el.dataset.i]);
  });

  function sloupcu() {
    const prvni = elZnaky.children[0];
    if (!prvni) return 1;
    const w = prvni.getBoundingClientRect().width + 4;
    return Math.max(1, Math.floor((elZnaky.clientWidth - 16 + 4) / w));
  }

  elZnaky.addEventListener('keydown', e => {
    if (e.target !== elZnaky) return;
    const n = polozky.length; if (!n) return;
    const s = sloupcu();
    let i = fokus < 0 ? 0 : fokus;
    const posun = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -s, ArrowDown: s, Home: -Infinity, End: Infinity };
    if (e.key in posun) {
      e.preventDefault();
      i = Math.max(0, Math.min(n - 1, i + posun[e.key]));
      vyber(i, e.shiftKey ? 'rozsah' : null);
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); if (fokus >= 0) M.otevri(polozky[fokus]); return; }
    if (e.key === 'Delete') { e.preventDefault(); A.akce('smazGlyfy'); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.code === 'KeyA') { e.preventDefault(); polozky.forEach(p => A.vyber.add(p.klic)); infoVyberu(); return; }
      if (e.code === 'KeyC') { e.preventDefault(); A.akce('kopirujGlyfy'); return; }
      if (e.code === 'KeyV') { e.preventDefault(); A.akce('vlozGlyfy'); return; }
      if (e.code === 'KeyX') { e.preventDefault(); A.akce('kopirujGlyfy'); A.akce('vymazGlyfy'); return; }
      return;
    }
    // napsaný znak = skok na jeho glyf (jako ve FontForge)
    if (e.key.length === 1 && !e.altKey && e.key !== ' ') {
      const cp = e.key.codePointAt(0);
      let k = polozky.findIndex(p => p.cp === cp);
      if (k < 0) { blok = 'font'; for (const b of P.BLOKY) if (b.znaky.includes(cp)) { blok = b.id; break; } vykresliBloky(); sestav(); k = polozky.findIndex(p => p.cp === cp); }
      if (k >= 0) { e.preventDefault(); vyber(k, null); }
    }
  });

  elHledat.addEventListener('input', () => sestav());
  elVel.value = A.nastaveni.velBunky || 64;
  function nastavVelikost() {
    elZnaky.style.setProperty('--bunka', elVel.value + 'px');
    A.nastaveni.velBunky = +elVel.value; A.ulozNastaveni();
  }
  nastavVelikost();
  elVel.addEventListener('input', () => { nastavVelikost(); sestav(); });
  window.addEventListener('resize', () => { if (A.font && A.pohled === 'znaky') { clearTimeout(M._rs); M._rs = setTimeout(sestav, 150); } });

  M.obnov = function () { vykresliBloky(); sestav(); };
  M.vyberGlyf = function (nazev) {
    const i = polozky.findIndex(p => p.klic === nazev);
    if (i >= 0) vyber(i, null);
  };
  M.fokus = function () { elZnaky.focus({ preventScroll: true }); };

  A.na('font', () => { kotva = fokus = -1; M.obnov(); });
  A.na('zmena', co => {
    if (!A.font) return;
    const zmenaSady = co && co.vse;
    if (A.pohled !== 'znaky') { M._zastarale = true; return; }
    if (zmenaSady || !co || !co.glyfy) { M.obnov(); return; }
    // změnily se jen některé glyfy: když vznikly/zanikly, sestavit znovu, jinak jen překreslit
    const klice = new Set(polozky.map(p => p.klic));
    if (co.glyfy.some(n => !klice.has(n) || !A.font.glyfy[n])) M.obnov(); else prekresliGlyfy(co.glyfy);
  });
  A.na('pohled', p => { if (p === 'znaky' && M._zastarale) { M._zastarale = false; M.obnov(); } });
  A.na('tema', () => { if (!A.font) return; if (A.pohled === 'znaky') sestav(); else M._zastarale = true; });
})();
