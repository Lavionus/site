/* Svět u stolu – rozhraní: pohledy Den / Měsíc / Rok / Mapa, hledání, detail s receptem. */
(function () {
  'use strict';
  const S = window.SUS;
  const VSE = (window.SUS_DATA || []).slice();
  const MAPA = window.SUS_MAPA || { q: 0.05, zeme: [] };
  const KLIC_LS = 'webapp_svet_u_stolu';
  const $ = id => document.getElementById(id);
  const obsah = $('obsah');

  /* ---------- pomocné ---------- */
  function h(tag, attrs, ...deti) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const d of deti.flat(Infinity)) if (d != null && d !== false) e.append(d.nodeType ? d : String(d));
    return e;
  }
  const velke = t => t.charAt(0).toUpperCase() + t.slice(1);
  const nactiLS = () => { try { return JSON.parse(localStorage.getItem(KLIC_LS)) || {}; } catch (e) { return {}; } };
  const ulozLS = () => {
    try {
      localStorage.setItem(KLIC_LS, JSON.stringify({
        pohled: stav.pohled, vypKultury: [...stav.vypKultury], vypKontinenty: [...stav.vypKontinenty], vypDoby: [...stav.vypDoby]
      }));
    } catch (e) { /* plné úložiště nevadí */ }
  };

  /* ---------- země a kontinenty ---------- */
  const zemeMapy = {};
  for (const z of MAPA.zeme) zemeMapy[z.a2] = z;
  const kontinent = kod => (zemeMapy[S.mapovyKod(kod)] || {}).kont || null;
  const vlajky = p => p.zeme.map(S.vlajka).join('');
  const zemeText = p => p.zeme.map(S.nazevZeme).join(', ') + (p.misto ? ' · ' + p.misto : '');

  /* ---------- stav ---------- */
  const POHLEDY = ['den', 'mesic', 'rok', 'mapa', 'dejiny', 'seznam'];
  const ulozeno = nactiLS();
  const stav = {
    pohled: POHLEDY.includes(ulozeno.pohled) ? ulozeno.pohled : 'den',
    den: S.dnesKlic(),
    vypKultury: new Set(ulozeno.vypKultury || ['novodobe']),
    vypKontinenty: new Set(ulozeno.vypKontinenty || []),
    vypDoby: new Set(ulozeno.vypDoby || []),      // id epoch + '_dnes' (současné tradice) + '_hist' (všechny historické)
    dotaz: '',
    zeme: null,            // vybraná země v pohledu mapa
    mapaJenDen: false
  };
  let data = VSE;
  function prefiltruj() {
    const dobaOk = p => p.doba ? !stav.vypDoby.has('_hist') && !stav.vypDoby.has(p.doba) : !stav.vypDoby.has('_dnes');
    data = VSE.filter(p => dobaOk(p) && !stav.vypKultury.has(p.kultura) &&
      (stav.vypKontinenty.size === 0 || p.zeme.some(z => { const k = kontinent(z); return !k || !stav.vypKontinenty.has(k); })));
  }

  /* ---------- URL (#pohled/datum/položka) ---------- */
  function zapisHash(polozka) {
    const h2 = '#' + stav.pohled + '/' + stav.den + (polozka ? '/' + polozka : '');
    if (location.hash !== h2) history.replaceState(null, '', h2);
  }
  function ctiHash() {
    const [pohled, den, polozka] = decodeURIComponent(location.hash.slice(1)).split('/');
    if (POHLEDY.includes(pohled)) stav.pohled = pohled;
    if (/^\d{4}-\d\d-\d\d$/.test(den || '')) stav.den = den;
    return polozka;
  }

  /* ---------- karty ---------- */
  function karta(p, extra) {
    extra = extra || {};
    const k = S.KULTURY[p.kultura] || { n: p.kultura, e: '' };
    const doba = p.doba && S.DOBY[p.doba];
    return h('button', { class: 'karta' + (extra.kratka ? ' kratka' : '') + (doba ? ' hist' : ''), type: 'button', onclick: () => otevriDetail(p.id) },
      h('div', { class: 'hlava' },
        h('span', { class: 'emoji', 'aria-hidden': 'true' }, p.emoji || '🍽️'),
        h('div', null,
          h('h4', { 'data-i18n': 'ne' }, p.jidlo),
          h('div', { class: 'kde', 'data-i18n': 'ne' }, vlajky(p) + ' ' + zemeText(p)))),
      h('p', { class: 'proc', 'data-i18n': 'ne' }, p.proc),
      h('div', { class: 'meta' },
        doba ? h('span', { class: 'chip doba' }, doba.e + ' ' + doba.n) : null,
        h('span', { class: 'chip', 'data-i18n': 'ne' }, p.prilezitost),
        doba ? null : h('span', null, k.e + ' ' + k.n),
        extra.datum ? h('span', null, '· ' + extra.datum) : null));
  }
  const terminText = v => v.od === v.do ? S.datumText(v.od) : S.rozsahText(v.od, v.do);

  /* ---------- mapa (Equal Earth) ---------- */
  let cestyMapy = null;
  function projekce(lon, lat) {
    const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    const l = lon * Math.PI / 180, f = lat * Math.PI / 180;
    const t = Math.asin(M * Math.sin(f)), t2 = t * t, t6 = t2 * t2 * t2;
    const x = l * Math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
    const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
    return [x * 100, -y * 100];
  }
  function pripravMapu() {
    if (cestyMapy) return cestyMapy;
    cestyMapy = MAPA.zeme.map(z => {
      let d = '', minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      for (const r of z.r) {
        let x = 0, y = 0;
        for (let i = 0; i < r.length; i += 2) {
          x += r[i]; y += r[i + 1];
          const [px, py] = projekce(x * MAPA.q, y * MAPA.q);
          d += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
          if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
        }
        d += 'Z';
      }
      return { a2: z.a2, d, stred: projekce(z.l[0], z.l[1]), mala: (maxx - minx) * (maxy - miny) < 1.5, bb: [minx, miny, maxx, maxy] };
    });
    // malé země, které v mapě vůbec nejsou (zjednodušením vypadly), nemají tečku – zobrazí se jen v seznamu
    return cestyMapy;
  }
  // sila: Map a2 → 0..1; onKlik(a2)
  function mapaSVG(sila, opt) {
    opt = opt || {};
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', opt.priblizit ? vyrez(sila) : '-275 -135 550 265');
    svg.setAttribute('class', 'mapa');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', opt.popis || 'Mapa světa');
    const obal = h('div', { class: 'mapa-obal' }, svg);
    const bublina = h('div', { class: 'bublina', hidden: true, 'data-i18n': 'ne' });
    obal.append(bublina);
    const ukaz = (e, a2) => {
      const r = obal.getBoundingClientRect();
      bublina.textContent = S.vlajka(a2) + ' ' + S.nazevZeme(a2) + (opt.popisek ? opt.popisek(a2) : '');
      bublina.hidden = false;
      bublina.style.left = Math.min(e.clientX - r.left + 12, r.width - bublina.offsetWidth - 4) + 'px';
      bublina.style.top = (e.clientY - r.top + 12) + 'px';
    };
    const tecky = [];
    for (const c of pripravMapu()) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', c.d);
      const s = sila.get(c.a2);
      if (s) {
        p.setAttribute('class', 'ma' + (opt.vybrana === c.a2 ? ' vybrana' : ''));
        p.style.setProperty('--sila', (0.35 + 0.65 * s).toFixed(2));
        p.addEventListener('mousemove', e => ukaz(e, c.a2));
        p.addEventListener('mouseleave', () => { bublina.hidden = true; });
        if (opt.onKlik) p.addEventListener('click', () => opt.onKlik(c.a2));
        if (c.mala) tecky.push(c);
      }
      svg.append(p);
    }
    for (const c of tecky) {          // malé země jsou vidět jen jako tečka
      const t = document.createElementNS(NS, 'circle');
      t.setAttribute('cx', c.stred[0].toFixed(1)); t.setAttribute('cy', c.stred[1].toFixed(1)); t.setAttribute('r', '2.6');
      t.addEventListener('mousemove', e => ukaz(e, c.a2));
      t.addEventListener('mouseleave', () => { bublina.hidden = true; });
      if (opt.onKlik) t.addEventListener('click', () => opt.onKlik(c.a2));
      svg.append(t);
    }
    return obal;
  }
  // výřez mapy kolem zvýrazněných zemí (poměr stran celé mapy), u daleko rozházených zemí celý svět
  function vyrez(sila) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of pripravMapu()) if (sila.get(c.a2)) {
      // Rusko, USA apod. se přes celou šířku – bere se jen střed, ať výřez nezahltí
      const sir = c.bb[2] - c.bb[0] > 120;
      const b = sir ? [c.stred[0] - 15, c.stred[1] - 10, c.stred[0] + 15, c.stred[1] + 10] : c.bb;
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
    }
    if (x0 > x1) return '-275 -135 550 265';
    const P = 550 / 265, okraj = 8;
    let w = Math.max(x1 - x0 + 2 * okraj, 90), hh = Math.max(y1 - y0 + 2 * okraj, 90 / P);
    if (w / hh > P) hh = w / P; else w = hh * P;
    if (w > 500) return '-275 -135 550 265';
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [cx - w / 2, cy - hh / 2, w, hh].map(v => v.toFixed(1)).join(' ');
  }
  function silaZPolozek(polozky) {
    const pocty = new Map();
    for (const p of polozky) for (const z of new Set(p.zeme.map(S.mapovyKod))) pocty.set(z, (pocty.get(z) || 0) + 1);
    const max = Math.max(1, ...pocty.values());
    const sila = new Map();
    for (const [z, n] of pocty) sila.set(z, n / max);
    return { sila, pocty };
  }

  /* ---------- pohled Den ---------- */
  function pohledDen() {
    const k = stav.den, { den, obdobi } = S.naDen(data, k);
    const dnes = k === S.dnesKlic();
    const DOMA = { CZ: 0, SK: 1 };     // česká a slovenská tradice první, pak abecedně podle země
    const ser = arr => arr.slice().sort((a, b) => ((DOMA[a.p.zeme[0]] ?? 9) - (DOMA[b.p.zeme[0]] ?? 9)) ||
      S.nazevZeme(a.p.zeme[0]).localeCompare(S.nazevZeme(b.p.zeme[0]), 'cs'));
    const levy = h('div', null);
    const dnesni = den.filter(z => !z.p.doba);
    const hist = den.filter(z => z.p.doba).sort((a, b) => S.DOBY[a.p.doba].od - S.DOBY[b.p.doba].od);
    if (dnesni.length) levy.append(h('div', { class: 'karty' }, ser(dnesni).map(z => karta(z.p))));
    else if (hist.length) levy.append(h('div', { class: 'prazdno' }, 'Dnes se v tento den nic zvykového nejí – v minulosti ale ano:'));
    else {
      levy.append(h('div', { class: 'prazdno' }, 'Na tento den nemáme žádnou zvykovou hostinu' +
        (stav.vypKultury.size || stav.vypKontinenty.size || stav.vypDoby.size ? ' (některé tradice máte ve výběru vypnuté)' : '') + '. Nejbližší:'));
      const brzy = nejblizsi(k, 4);
      levy.append(h('div', { class: 'karty', style: 'margin-top:10px' }, brzy.map(([kk, z]) => karta(z.p, { datum: S.datumText(kk) }))));
    }
    if (hist.length) {
      levy.append(h('h3', { class: 'oddil' }, '📜 V historii'));
      levy.append(h('div', { class: 'karty' }, hist.map(z => karta(z.p))));
    }
    if (obdobi.length) {
      levy.append(h('h3', { class: 'oddil' }, 'Probíhá také'));
      levy.append(h('div', { class: 'karty' }, ser(obdobi).map(z => karta(z.p, { kratka: true, datum: 'den ' + z.den + ' z ' + z.delka }))));
    }
    const vsechny = den.concat(obdobi).map(z => z.p);
    const { sila } = silaZPolozek(vsechny);
    const pravy = h('div', null,
      h('div', { class: 'panel' },
        h('h3', { class: 'oddil', style: 'margin-top:0' }, 'Kde se dnes slaví'),
        mapaSVG(sila, { priblizit: true, popis: 'Země s tradicí v tento den', onKlik: a2 => { stav.zeme = a2; prepniPohled('mapa'); } })),
      h('div', { class: 'panel', style: 'margin-top:12px' },
        h('h3', { class: 'oddil', style: 'margin-top:0' }, 'Následující dny'),
        dalsiDny(k, 7)));
    obsah.replaceChildren(
      h('div', { class: 'hlavicka-dne' },
        h('h2', null, S.datumDlouze(k)),
        h('span', { class: 'podtitul' }, S.denNazev(S.denTydne(k))),
        dnes ? h('span', { class: 'stitek-dnes' }, 'dnes') : null,
        h('span', { class: 'info' }, den.length ? pocetText(den.length) : '')),
      h('div', { class: 'rozlozeni-den' }, levy, pravy));
  }
  function pocetText(n) { return n + (n === 1 ? ' tradice' : n < 5 ? ' tradice' : ' tradic'); }
  function nejblizsi(k, kolik) {
    const out = [];
    for (let i = 1; i < 120 && out.length < kolik; i++) {
      const kk = S.posun(k, i);
      for (const z of S.naDen(data, kk).den) if (out.length < kolik) out.push([kk, z]);
    }
    return out;
  }
  function dalsiDny(k, kolik) {
    const ul = h('div', { style: 'display:flex;flex-direction:column;gap:4px' });
    for (let i = 1; i <= kolik; i++) {
      const kk = S.posun(k, i), d = S.naDen(data, kk).den;
      ul.append(h('button', { class: 'tl', type: 'button', 'data-i18n': 'ne', style: 'text-align:left;white-space:normal', onclick: () => { stav.den = kk; vykresli(); } },
        h('b', null, (+kk.slice(8)) + '. ' + (+kk.slice(5, 7)) + '. '),
        d.length ? d.slice(0, 4).map(z => (z.p.emoji || '') + ' ' + z.p.jidlo).join(' · ') + (d.length > 4 ? ' …' : '') : h('span', { style: 'color:var(--text-faint)' }, '—')));
    }
    return ul;
  }

  /* ---------- pohled Měsíc ---------- */
  function pohledMesic() {
    const r = +stav.den.slice(0, 4), m = +stav.den.slice(5, 7);
    const prvni = S.klic(r, m, 1), posun0 = (S.denTydne(prvni) + 6) % 7;
    const dnes = S.dnesKlic();
    const mriz = h('div', { class: 'mrizka' }, [1, 2, 3, 4, 5, 6, 0].map(d => h('div', { class: 'dt' }, S.denZkratka(d))));
    const obdobiMes = new Map();
    for (let i = -posun0; i < 42 - posun0; i++) {
      const kk = S.posun(prvni, i);
      if (i >= S.dniVMesici(r, m) && (i + posun0) % 7 === 0) break;
      const { den, obdobi } = S.naDen(data, kk);
      if (+kk.slice(5, 7) === m) for (const z of obdobi) obdobiMes.set(z.p.id, z);
      const bunka = h('button', {
        class: 'bunka' + (+kk.slice(5, 7) !== m ? ' mimo' : '') + (kk === dnes ? ' dnes' : ''), type: 'button', 'data-i18n': 'ne',
        title: den.map(z => z.p.jidlo + ' (' + S.nazevZeme(z.p.zeme[0]) + ')').join('\n'),
        onclick: () => { stav.den = kk; prepniPohled('den'); }
      }, h('span', { class: 'c' }, +kk.slice(8)));
      const serazene = den.slice().sort((a, b) => (a.p.doba ? 1 : 0) - (b.p.doba ? 1 : 0));
      for (const z of serazene.slice(0, 3)) bunka.append(h('span', { class: 'p' + (z.p.doba ? ' h' : '') },
        (z.p.doba ? '📜' : S.vlajka(z.p.zeme[0])) + (z.p.emoji || ''), h('span', { class: 't' }, ' ' + z.p.jidlo)));
      if (den.length > 3) bunka.append(h('span', { class: 'vic' }, '+' + (den.length - 3)));
      mriz.append(bunka);
    }
    const pas = h('div', { class: 'obdobi-pas' });
    for (const z of obdobiMes.values()) pas.append(h('button', { class: 'tl', type: 'button', 'data-i18n': 'ne', onclick: () => otevriDetail(z.p.id) },
      (z.p.emoji || '') + ' ' + z.p.prilezitost + ' · ' + S.rozsahText(z.od, z.do)));
    obsah.replaceChildren(
      h('div', { class: 'mesic-hlava' }, h('h2', null, velke(S.mesicNazev(m)) + ' ' + r)),
      obdobiMes.size ? pas : null, mriz);
  }

  /* ---------- pohled Rok ---------- */
  function pohledRok() {
    const r = +stav.den.slice(0, 4), dnes = S.dnesKlic();
    const ix = S.indexRoku(data, r);
    const mrizka = h('div', { class: 'rok' });
    for (let m = 1; m <= 12; m++) {
      const prvni = S.klic(r, m, 1), posun0 = (S.denTydne(prvni) + 6) % 7;
      const g = h('div', { class: 'mrizka' });
      for (let i = 0; i < posun0; i++) g.append(h('button', { class: 'prazdny', tabindex: '-1', 'aria-hidden': 'true' }));
      for (let d = 1; d <= S.dniVMesici(r, m); d++) {
        const kk = S.klic(r, m, d);
        const n = (ix[kk] || []).filter(z => !S.jeObdobi(z.p)).length;
        g.append(h('button', {
          class: (n ? 'h' + Math.min(3, n) : '') + (kk === dnes ? ' dnes' : ''), type: 'button', 'data-i18n': 'ne',
          title: S.datumText(kk) + (n ? ': ' + (ix[kk] || []).filter(z => !S.jeObdobi(z.p)).map(z => z.p.jidlo).join(', ') : ''),
          onclick: () => { stav.den = kk; prepniPohled('den'); }
        }, d));
      }
      mrizka.append(h('div', { class: 'minimesic panel' },
        h('h4', { onclick: () => { stav.den = prvni; prepniPohled('mesic'); } }, velke(S.mesicNazev(m))), g));
    }
    const pocet = Object.values(ix).flat().filter(z => !S.jeObdobi(z.p)).length;
    obsah.replaceChildren(
      h('div', { class: 'mesic-hlava' }, h('h2', null, String(r)), h('span', { class: 'info' }, pocet + ' svátečních jídel v kalendáři')),
      mrizka,
      h('div', { class: 'legenda' }, 'Počet tradic v den:',
        h('span', null, h('i', { style: 'background:color-mix(in srgb,var(--accent) 25%,var(--bg-panel))' }), '1'),
        h('span', null, h('i', { style: 'background:color-mix(in srgb,var(--accent) 50%,var(--bg-panel))' }), '2'),
        h('span', null, h('i', { style: 'background:var(--accent)' }), '3 a víc')));
  }

  /* ---------- pohled Mapa ---------- */
  function pohledMapa() {
    const zdroj = stav.mapaJenDen ? (() => { const x = S.naDen(data, stav.den); return x.den.concat(x.obdobi).map(z => z.p); })() : data;
    const { sila, pocty } = silaZPolozek(zdroj);
    const vyber = (a2) => { stav.zeme = stav.zeme === a2 ? null : a2; vykresli(); };
    const prepinac = h('div', { class: 'skup-tl', style: 'gap:4px;flex-wrap:wrap' },
      h('button', { class: 'tl', 'aria-pressed': String(!stav.mapaJenDen), type: 'button', onclick: () => { stav.mapaJenDen = false; vykresli(); } }, 'Celý rok'),
      h('button', { class: 'tl', 'aria-pressed': String(stav.mapaJenDen), type: 'button', onclick: () => { stav.mapaJenDen = true; vykresli(); } }, 'Jen ' + S.datumText(stav.den)));
    const casti = [
      h('div', { class: 'mesic-hlava' }, h('h2', null, 'Mapa tradic'), prepinac,
        h('span', { class: 'info' }, pocty.size + ' zemí · klikněte na zemi')),
      h('div', { class: 'panel' }, mapaSVG(sila, {
        vybrana: stav.zeme, onKlik: vyber, popis: 'Mapa zemí s tradičními jídly',
        popisek: a2 => ' – ' + pocetText(pocty.get(a2) || 0)
      }))
    ];
    if (stav.zeme) {
      const jeji = zdroj.filter(p => p.zeme.some(z => S.mapovyKod(z) === stav.zeme));
      casti.push(h('h3', { class: 'oddil' }, S.vlajka(stav.zeme) + ' ' + S.nazevZeme(stav.zeme) + ' – ' + pocetText(jeji.length)),
        kartyPodleTerminu(jeji));
    } else {
      const zebricek = [...pocty].sort((a, b) => b[1] - a[1]);
      casti.push(h('h3', { class: 'oddil' }, 'Země'),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' }, zebricek.map(([a2, n]) =>
          h('button', { class: 'tl', type: 'button', 'data-i18n': 'ne', onclick: () => vyber(a2) }, S.vlajka(a2) + ' ' + S.nazevZeme(a2) + ' ' + n))));
    }
    obsah.replaceChildren(...casti);
  }
  function kartyPodleTerminu(polozky) {
    const od = stav.den;
    const s = polozky.map(p => ({ p, v: S.pristi(p, od) })).sort((a, b) => (a.v ? a.v.od : '9') < (b.v ? b.v.od : '9') ? -1 : 1);
    return h('div', { class: 'karty' }, s.map(({ p, v }) => karta(p, { datum: v ? terminText(v) : 'datum zatím neznámé' })));
  }

  /* ---------- pohled Dějiny (časová osa epoch) ---------- */
  function pohledDejiny() {
    const r = +stav.den.slice(0, 4);
    const podle = {};
    for (const p of data) if (p.doba && S.DOBY[p.doba]) (podle[p.doba] = podle[p.doba] || []).push(p);
    const casti = [h('div', { class: 'mesic-hlava' }, h('h2', null, '📜 Dějiny u stolu'),
      h('span', { class: 'info' }, 'Co se ke svátkům jedlo v minulých epochách – od antiky po socialismus'))];
    if (!Object.keys(podle).length) casti.push(h('div', { class: 'prazdno' }, 'Historické tradice máte ve výběru vypnuté (Doba ▾).'));
    for (const [sk, nazev] of Object.entries(S.SKUPINY_DOB)) {
      const doby = Object.entries(S.DOBY).filter(([id, d]) => d.s === sk && podle[id]).sort((a, b) => a[1].od - b[1].od);
      if (!doby.length) continue;
      casti.push(h('div', { class: 'osa-skupina' }, nazev));
      for (const [id, d] of doby) {
        const polozky = podle[id].map(p => ({ p, v: S.vyskyty(p, r)[0] })).sort((a, b) => (a.v ? a.v.od : '9') < (b.v ? b.v.od : '9') ? -1 : 1);
        casti.push(h('section', { class: 'epocha' },
          h('h3', null, d.e + ' ' + d.n, h('span', { class: 'roky' }, h('span', { 'data-i18n': 'ne' }, S.rokText(d.od) + '–' + S.rokText(d.do) + ' · '), h('span', null, pocetText(polozky.length)))),
          h('div', { class: 'karty' }, polozky.map(({ p, v }) => karta(p, { datum: v ? (+v.od.slice(8)) + '. ' + (+v.od.slice(5, 7)) + '.' : '' })))));
      }
    }
    obsah.replaceChildren(...casti);
  }

  /* ---------- seznam a hledání ---------- */
  function pohledSeznam(dotaz) {
    const vysl = dotaz ? S.hledej(data, dotaz) : data;
    obsah.replaceChildren(
      h('div', { class: 'vysledky-hlava' },
        h('h2', { style: 'margin:0;font-size:1.3rem' }, dotaz ? 'Hledání: „' + dotaz + '“' : 'Všechny tradice'),
        h('span', { class: 'info' }, pocetText(vysl.length) + ' · seřazeno od ' + S.datumText(stav.den))),
      vysl.length ? kartyPodleTerminu(vysl) : h('div', { class: 'prazdno' }, 'Nic nenalezeno. Zkuste jiné slovo (hledá se v jídle, zemi, svátku i surovinách).'));
  }

  /* ---------- detail ---------- */
  function cisloText(x) {
    if (Math.abs(x - Math.round(x)) < 0.05) return String(Math.round(x));
    const zl = { 0.25: '¼', 0.5: '½', 0.75: '¾' }, cele = Math.floor(x), zb = Math.round((x - cele) * 4) / 4;
    if (zl[zb] && Math.abs(x - cele - zb) < 0.05) return (cele ? cele + ' ' : '') + zl[zb];
    return (Math.round(x * 10) / 10).toString().replace('.', ',');
  }
  function prepocti(surovina, k) {
    if (k === 1) return surovina;
    const m = surovina.match(/^(\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+|½|¼|¾)(?=\s|[a-zA-Zá-ž%])/);
    if (!m) return surovina;
    const hodn = t => t === '½' ? 0.5 : t === '¼' ? 0.25 : t === '¾' ? 0.75 : t.includes('/') ? t.split('/')[0] / t.split('/')[1] : parseFloat(t.replace(',', '.'));
    const nove = m[1].split(/\s*[–-]\s*/).map(t => cisloText(hodn(t) * k)).join('–');
    return nove + surovina.slice(m[1].length);
  }
  function otevriDetail(id) {
    const p = VSE.find(x => x.id === id);
    if (!p) return;
    const r = p.recept || {}, zakl = r.porce || 4;
    let porce = zakl;
    const kultura = S.KULTURY[p.kultura] || { n: p.kultura, e: '' };
    const seznamSurovin = h('ul', { 'data-i18n': 'ne' });
    const vykresliSuroviny = () => seznamSurovin.replaceChildren(...(r.suroviny || []).map(s => h('li', null, prepocti(s, porce / zakl))));
    const out = h('output', null, porce);
    const zmen = d => { porce = Math.max(1, porce + d); out.textContent = porce; vykresliSuroviny(); };
    vykresliSuroviny();
    // nejbližší tři termíny od dneška
    const terminy = [];
    let od = S.dnesKlic();
    for (let i = 0; i < 3; i++) {
      const v = S.pristi(p, od);
      if (!v) break;
      terminy.push(v); od = S.posun(v.do, 1);
    }
    const detail = $('detail');
    detail.replaceChildren(
      h('button', { class: 'tl zav', type: 'button', 'aria-label': 'Zavřít', title: 'Zavřít (Esc)', onclick: zavriDetail }, '✕'),
      h('h2', { id: 'detailNazev', 'data-i18n': 'ne' }, h('span', { class: 'emoji', 'aria-hidden': 'true' }, p.emoji || '🍽️'), p.jidlo),
      h('div', { class: 'kde', 'data-i18n': 'ne' }, vlajky(p) + ' ' + zemeText(p)),
      h('div', { class: 'meta', style: 'display:flex;gap:6px;flex-wrap:wrap;font-size:.8rem' },
        h('span', { class: 'chip', 'data-i18n': 'ne' }, p.prilezitost), h('span', { class: 'chip' }, kultura.e + ' ' + kultura.n),
        h('span', { class: 'chip', 'data-i18n': 'ne' }, S.pravidloText(p.kdy))),
      p.doba && S.DOBY[p.doba] ? h('div', { class: 'meta', style: 'margin-top:6px' }, h('span', { class: 'chip doba' }, S.DOBY[p.doba].e + ' ', h('span', null, S.DOBY[p.doba].n), h('span', { 'data-i18n': 'ne' }, ' (' + S.rokText(S.DOBY[p.doba].od) + '–' + S.rokText(S.DOBY[p.doba].do) + ')'))) : null,
      h('p', { 'data-i18n': 'ne' }, p.proc),
      p.pramen ? h('div', { class: 'pramen' }, h('b', null, 'Dobový pramen: '), h('span', { 'data-i18n': 'ne' }, p.pramen)) : null,
      h('div', { class: 'terminy' }, 'Nejbližší termíny: ',
        terminy.length ? terminy.map((v, i) => [i ? ', ' : '', h('button', {
          type: 'button', onclick: () => { stav.den = v.od; zavriDetail(); prepniPohled('den'); }
        }, terminText(v))]) : 'zatím nevíme (chybí data v tabulce)'),
      (r.suroviny || []).length ? h('section', { class: 'recept' },
        h('h3', null, '🧑‍🍳 ', h('span', null, 'Recept'), r.nazev ? h('span', { 'data-i18n': 'ne' }, ': ' + r.nazev) : null),
        h('div', { class: 'porce' }, 'Porce:',
          h('button', { class: 'tl', type: 'button', 'aria-label': 'Méně porcí', onclick: () => zmen(-1) }, '−'), out,
          h('button', { class: 'tl', type: 'button', 'aria-label': 'Více porcí', onclick: () => zmen(1) }, '+'),
          r.cas ? h('span', null, '· ⏱ ' + r.cas) : null),
        h('h4', { style: 'margin:10px 0 2px' }, 'Suroviny'), seznamSurovin,
        h('h4', { style: 'margin:10px 0 2px' }, 'Postup'), h('ol', { 'data-i18n': 'ne' }, (r.postup || []).map(k => h('li', null, k)))) : null,
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:14px' },
        h('button', { class: 'tl', type: 'button', onclick: () => { stav.zeme = S.mapovyKod(p.zeme[0]); zavriDetail(); prepniPohled('mapa'); } }, '🗺️ Na mapě'),
        p.zdroj ? h('a', { class: 'tl', href: p.zdroj, target: '_blank', rel: 'noopener', style: 'text-decoration:none' }, '🔗 Zdroj') : null)
    );
    $('zavoj').hidden = false;
    detail.scrollTop = 0;
    detail.focus();
    zapisHash(p.id);
  }
  function zavriDetail() { $('zavoj').hidden = true; zapisHash(); }
  $('zavoj').addEventListener('click', e => { if (e.target.id === 'zavoj') zavriDetail(); });

  function napoveda() {
    $('detail').replaceChildren(
      h('button', { class: 'tl zav', type: 'button', 'aria-label': 'Zavřít', onclick: zavriDetail }, '✕'),
      h('h2', { id: 'detailNazev' }, '❓ Nápověda'),
      h('p', null, 'Kalendář ukazuje, co se kde na světě jí v určitý den jako rituál nebo zvyk – od českého kapra na Štědrý den po japonské nudle na Silvestra. Ke každé tradici je vysvětlení, proč se to jí, a domácí recept s přepočtem porcí.'),
      h('h3', null, 'Pohyblivé svátky'),
      h('ul', null,
        h('li', null, 'Velikonoce a svátky od nich odvozené (masopust, Zelený čtvrtek…) se počítají velikonoční tabulkou (computus), pravoslavné podle juliánského kalendáře.'),
        h('li', null, 'Čínský lunární kalendář podle tabulek Hongkongské observatoře (' + (window.SUS_CINSKY ? window.SUS_CINSKY.od + '–' + window.SUS_CINSKY.do : '') + '), mimo ně podle kalendáře prohlížeče.'),
        h('li', null, 'Islámské svátky podle kalendáře Umm al-Qura. Skutečný začátek se v jednotlivých zemích může o den lišit podle pozorování srpku Měsíce.'),
        h('li', null, 'Židovské svátky začínají večer předchozího dne; v kalendáři je uveden první celý den.'),
        h('li', null, 'Hinduistické svátky se řídí místním lunisolárním kalendářem – data jsou z tabulky na roky 2025–2036.')),
      h('h3', null, 'Historické tradice'),
      h('p', null, 'Karty s oranžovým okrajem 📜 popisují, co se ke dni jedlo v minulých epochách – od antického Říma přes tereziánskou Vídeň a viktoriánskou Anglii po socialistické Československo. U každé je dobový pramen a recept převedený pro dnešní kuchyni. Pohled Dějiny je řadí podle epoch, nabídka Doba je umí vypnout.'),
      h('h3', null, 'Ovládání'),
      h('p', null, '← → posun, T dnešek, D/M/R/P/H přepnutí pohledu, / hledání, Esc zavře detail. Odkaz na stránku si pamatuje datum i otevřenou tradici.'),
      h('h3', null, 'Zdroje'),
      h('p', null, 'Každá tradice má u sebe odkaz na zdroj, kterým byla ověřena (listopad 2026). Mapa: Natural Earth (volné dílo).'));
    $('zavoj').hidden = false;
    $('detail').focus();
  }

  /* ---------- nabídky výběru ---------- */
  function nabidkaKultury() {
    const n = $('nabKultury'), pocty = {};
    for (const p of VSE) pocty[p.kultura] = (pocty[p.kultura] || 0) + 1;
    n.replaceChildren(h('div', { class: 'titulek' }, 'Zobrazit tradice'),
      Object.entries(S.KULTURY).filter(([k]) => pocty[k]).map(([k, v]) => h('button', {
        class: 'tl prep', type: 'button', 'aria-pressed': String(!stav.vypKultury.has(k)),
        onclick: e => { e.stopPropagation(); stav.vypKultury.has(k) ? stav.vypKultury.delete(k) : stav.vypKultury.add(k); zmenaFiltru(); nabidkaKultury(); }
      }, v.e + ' ' + v.n, h('span', { class: 'n' }, pocty[k]))),
      h('hr'),
      h('button', { class: 'tl', type: 'button', onclick: e => { e.stopPropagation(); stav.vypKultury.clear(); zmenaFiltru(); nabidkaKultury(); } }, 'Zobrazit vše'));
  }
  function nabidkaKontinenty() {
    const n = $('nabKontinenty');
    n.replaceChildren(h('div', { class: 'titulek' }, 'Kontinenty'),
      Object.entries(S.KONTINENTY).map(([k, v]) => h('button', {
        class: 'tl prep', type: 'button', 'aria-pressed': String(!stav.vypKontinenty.has(k)),
        onclick: e => { e.stopPropagation(); stav.vypKontinenty.has(k) ? stav.vypKontinenty.delete(k) : stav.vypKontinenty.add(k); zmenaFiltru(); nabidkaKontinenty(); }
      }, v)),
      h('hr'),
      h('button', { class: 'tl', type: 'button', onclick: e => { e.stopPropagation(); stav.vypKontinenty.clear(); zmenaFiltru(); nabidkaKontinenty(); } }, 'Všechny kontinenty'));
  }
  function nabidkaDoby() {
    const n = $('nabDoby'), pocty = {};
    for (const p of VSE) if (p.doba) pocty[p.doba] = (pocty[p.doba] || 0) + 1;
    const prep = (klic, text, pocet) => h('button', {
      class: 'tl prep', type: 'button', 'aria-pressed': String(!stav.vypDoby.has(klic)),
      onclick: e => { e.stopPropagation(); stav.vypDoby.has(klic) ? stav.vypDoby.delete(klic) : stav.vypDoby.add(klic); zmenaFiltru(); nabidkaDoby(); }
    }, text, pocet != null ? h('span', { class: 'n' }, pocet) : null);
    const casti = [h('div', { class: 'titulek' }, 'Zobrazit'),
      prep('_dnes', '🌍 Současné tradice', VSE.filter(p => !p.doba).length),
      prep('_hist', '📜 Historické tradice', VSE.filter(p => p.doba).length)];
    if (!stav.vypDoby.has('_hist')) for (const [sk, nazev] of Object.entries(S.SKUPINY_DOB)) {
      const doby = Object.entries(S.DOBY).filter(([id, d]) => d.s === sk && pocty[id]).sort((a, b) => a[1].od - b[1].od);
      if (!doby.length) continue;
      casti.push(h('div', { class: 'titulek' }, nazev));
      for (const [id, d] of doby) casti.push(prep(id, d.e + ' ' + d.n, pocty[id]));
    }
    casti.push(h('hr'), h('button', { class: 'tl', type: 'button', onclick: e => { e.stopPropagation(); stav.vypDoby.clear(); zmenaFiltru(); nabidkaDoby(); } }, 'Zobrazit vše'));
    n.replaceChildren(...casti);
  }
  function zmenaFiltru() { prefiltruj(); ulozLS(); vykresli(); }

  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b) { e.stopPropagation(); zavriNabidky(); return prikaz(b.dataset.prikaz); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);

  /* ---------- příkazy ---------- */
  function krok(smer) {
    const r = +stav.den.slice(0, 4), m = +stav.den.slice(5, 7), d = +stav.den.slice(8, 10);
    if (stav.pohled === 'mesic') { const nm = m + smer, nr = r + Math.floor((nm - 1) / 12), mm = ((nm - 1) % 12 + 12) % 12 + 1; stav.den = S.klic(nr, mm, Math.min(d, S.dniVMesici(nr, mm))); }
    else if (stav.pohled === 'rok') stav.den = S.klic(r + smer, m, Math.min(d, S.dniVMesici(r + smer, m)));
    else stav.den = S.posun(stav.den, smer);
    vykresli();
  }
  function prikaz(id) {
    switch (id) {
      case 'zpet': return krok(-1);
      case 'vpred': return krok(1);
      case 'dnes': stav.den = S.dnesKlic(); return vykresli();
      case 'nahodne': if (data.length) otevriDetail(data[Math.floor(Math.random() * data.length)].id); return;
      case 'vse': $('hledat').value = ''; stav.dotaz = ''; return prepniPohled('seznam');
      case 'tisk': return print();
      case 'napoveda': return napoveda();
    }
  }
  function prepniPohled(p) {
    stav.pohled = p;
    if (p !== 'seznam' && stav.dotaz) { stav.dotaz = ''; $('hledat').value = ''; }
    ulozLS();
    vykresli();
    scrollTo(0, 0);
  }
  document.querySelectorAll('[data-pohled]').forEach(b => b.addEventListener('click', () => prepniPohled(b.dataset.pohled)));
  $('datum').addEventListener('change', e => { if (e.target.value) { stav.den = e.target.value; vykresli(); } });
  let casHledani = 0;
  $('hledat').addEventListener('input', e => {
    clearTimeout(casHledani);
    casHledani = setTimeout(() => { stav.dotaz = e.target.value.trim(); vykresli(); }, 150);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('zavoj').hidden) return zavriDetail(); zavriNabidky(); if (stav.dotaz) { $('hledat').value = ''; stav.dotaz = ''; vykresli(); } return; }
    if (e.target.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey || !$('zavoj').hidden) return;
    const mapa = { ArrowLeft: () => krok(-1), ArrowRight: () => krok(1), t: () => prikaz('dnes'), d: () => prepniPohled('den'),
      m: () => prepniPohled('mesic'), r: () => prepniPohled('rok'), p: () => prepniPohled('mapa'), h: () => prepniPohled('dejiny'), '/': () => $('hledat').focus() };
    const f = mapa[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (f) { e.preventDefault(); f(); }
  });

  /* ---------- vykreslení ---------- */
  function vykresli() {
    $('datum').value = stav.den;
    document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pohled === stav.pohled && !stav.dotaz)));
    if (stav.dotaz) pohledSeznam(stav.dotaz);
    else ({ den: pohledDen, mesic: pohledMesic, rok: pohledRok, mapa: pohledMapa, dejiny: pohledDejiny, seznam: () => pohledSeznam('') })[stav.pohled]();
    if ($('zavoj').hidden) zapisHash();
  }

  if (!VSE.length) { obsah.textContent = 'Data se nepodařilo načíst.'; return; }
  const polozka = ctiHash();
  prefiltruj();
  nabidkaKultury();
  nabidkaKontinenty();
  nabidkaDoby();
  vykresli();
  if (polozka) otevriDetail(polozka);
  addEventListener('hashchange', () => { const pp = ctiHash(); vykresli(); if (pp) otevriDetail(pp); });
  window.SUS_UI = { stav, vykresli, otevriDetail, prepniPohled };
})();
