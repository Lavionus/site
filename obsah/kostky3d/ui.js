/* Herní kostky a žetony – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro kostky zvláštní (typy, sada, písmo, těžiště, výsledky, kusovník, export). */
/* global KOSTKY3D, KOSTKY3D_GEO, KOSTKY3D_NAHLED, KOSTKY3D_PREDVOLBY, KRAB, G3D, Dialog, TrubkyGui, FONTY */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const K = KOSTKY3D, fmt = K.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, plan = null, geo = null, hlaseni = [], chybaStavby = null, wasm = null;
  const nahled = KOSTKY3D_NAHLED.vytvorNahled($('platno'));

  // číslo mimo rozsah: po potvrzení ukázat, s čím model počítá (poslouchá dřív než aplikace.js)
  document.querySelectorAll('input[data-p]:not([data-typ])').forEach(el => el.addEventListener('change', () => {
    const psano = G3D.ctiCislo(el.value), rozsah = K.ROZSAHY[el.dataset.p];
    if (!rozsah || !Number.isFinite(psano)) return;
    setTimeout(() => {
      const h = K.vezmi(app.p, el.dataset.p);
      if (Math.abs(psano - h) < 1e-9) return;
      el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
      Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: povoleno ${fmt(rozsah[0], 2)}–${fmt(rozsah[1], 2)}, použito ${fmt(h, 2)}.`);
    });
  }));
  $('f_mat').innerHTML = Object.entries(K.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev} – ${m.hustota} g/cm³</option>`).join('');

  const app = G3D.aplikace({
    typ: 'kostky3d', nazev: 'Herní kostky', klic: 'webapp_kostky3d', soubor: 'kostky',
    normalizuj: K.normalizuj, vychozi: () => K.normalizuj({}).p, vezmi: K.vezmi, poloz: K.poloz,
    ulozProjekt: K.ulozProjekt, nactiProjekt: K.nactiProjekt,
    popis: q => `${q.nazev || 'Návrh'} – ${{ kostka: 'kostka', sada: 'sada', zetony: 'žetony', figurky: 'figurky' }[q.rezim] || ''}`,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(), zpozdeni: 90,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(dilyExportu(), app.p.nazev || 'Herní kostky'), pripona: '.3mf' } : null),
    zkratky: { b: 'tRyti', h: 'tHrany', p: 'tPrevisy', l: 'tPravitka' },
    // vlastní hlášení k sadě kostek: pole bez data-p
    hlaseniNavic: (li, x) => { if (x.pole[0] === 'sada.typy') li.addEventListener('click', () => { TrubkyGui.ukazBox('in'); $('sadaVolby').scrollIntoView({ block: 'center', behavior: 'smooth' }); }); },
    zmenaTematu: () => nahled.barvy(css('--border-strong'), css('--text'), css('--bg-panel')),
  });

  /* ---------- formulář ---------- */
  // typ kostky: tlačítka
  const typy = $('typy');
  for (const [typ, t] of Object.entries(K.TYPY)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.typ = typ; b.title = t.nazev;
    b.innerHTML = `${typ === 'dpct' ? 'D%' : typ.toUpperCase()}<small>${t.nazev.replace(/^D\S+\s*/, '') || '&nbsp;'}</small>`;
    b.addEventListener('click', () => { app.zmen(x => { x.kostka.typ = typ; }); app.naplnFormular(); });
    typy.appendChild(b);
  }
  // sada: zaškrtávátka
  for (const typ of K.SADA_TYPY) {
    const l = document.createElement('label'); l.className = 'zaskrt';
    l.innerHTML = `<input type="checkbox" data-sada="${typ}"> ${typ === 'dpct' ? 'D%' : typ.toUpperCase()}`;
    l.querySelector('input').addEventListener('change', e => app.zmen(x => {
      const s = new Set(x.sada.typy); if (e.target.checked) s.add(typ); else s.delete(typ); x.sada.typy = K.SADA_TYPY.filter(t => s.has(t));
    }));
    $('sadaVolby').appendChild(l);
  }

  /** Které oddíly a pole dávají v daném režimu smysl. */
  function viditelnost() {
    p = app.p;
    const r = p.rezim, kostky = r === 'kostka' || r === 'sada', typ = p.kostka.typ;
    const d6 = (r === 'kostka' && typ === 'd6') || (r === 'sada' && p.sada.typy.includes('d6'));
    $('dKostka').hidden = !kostky; $('dZeton').hidden = r !== 'zetony'; $('dFigurka').hidden = r !== 'figurky';
    document.querySelectorAll('[data-pro="kostka"]').forEach(el => { el.hidden = r !== 'kostka'; });
    document.querySelectorAll('[data-pro="sada"]').forEach(el => { el.hidden = r !== 'sada'; });
    document.querySelectorAll('[data-pro="kostky"]').forEach(el => { el.hidden = !kostky; });
    for (const b of typy.children) b.setAttribute('aria-pressed', String(b.dataset.typ === typ));
    $('sadaVolby').querySelectorAll('input').forEach(i => { i.checked = p.sada.typy.includes(i.dataset.sada); });
    $('gTloustka').hidden = !(r === 'kostka' && typ === 'd2');
    $('gZnaceni').hidden = !d6;
    $('dTecky').hidden = !(d6 && p.kostka.znaceni === 'tecky');
    $('dVlastni').hidden = r !== 'kostka';
    $('dPismo').hidden = r === 'figurky'; $('pBezZnaceni').hidden = r !== 'figurky';
    $('gFtl').hidden = p.figurka.typ !== 'meeple';
    $('lFd').textContent = p.figurka.typ === 'meeple' ? 'Šířka' : 'Průměr podstavy';
    $('lZd').textContent = p.zeton.tvar === 'sestiuhelnik' ? 'Rozměr přes plochy' : 'Průměr';
    $('lZh').textContent = p.zeton.znaceni === 'vyryte' ? 'Hloubka' : 'Výška';
    const popisRoz = r === 'sada' ? 'Rozměr D6 (základ sady)' : typ === 'd2' ? 'Průměr mince' : typ === 'd4' ? 'Hrana čtyřstěnu' : 'Stěna – stěna';
    $('lRozmer').textContent = popisRoz;
    $('pRozmer').textContent = r === 'sada'
      ? `Ostatní kostky ze standardních poměrů: ${K.SADA_TYPY.map(t => `${t === 'dpct' ? 'D%' : t.toUpperCase()} ${fmt(p.kostka.rozmer * K.TYPY[t].sada, 1)}`).join(', ')} mm (D4 hrana, ostatní stěna–stěna).`
      : typ === 'd4' ? 'D4: rozměr je hrana ostrého čtyřstěnu, čísla jsou u vrcholů (platí číslo nahoře).'
        : typ === 'd2' ? 'D2: mince se dvěma čely, vlastní symboly v oddílu Značení (např. P / O).' : 'Rozměr = vzdálenost protilehlých stěn (u D6 hrana).';
    if (r === 'kostka') {
      const hod = typ === 'd4' ? [1, 2, 3, 4] : typ === 'd2' ? ['1. čelo', '2. čelo'] : K.cislovani(K.teleso(typ, 16)).map(c => c.text).sort((a, b) => +a - +b);
      $('lVlastni').textContent = `Řádek = stěna v pořadí: ${hod.join(', ')}`;
    }
  }

  /* ---------- písmo (opentype) a geometrické jádro ---------- */
  const pisma = new Map(); let font = null, fontId = null;
  async function nactiPismo(id) {
    if (!pisma.has(id)) pisma.set(id, FONTY.opentype(id));
    try { font = await pisma.get(id); fontId = id; }
    catch (e) {
      pisma.delete(id);
      if (id !== 'libsans') { Dialog.chyba(`Písmo se nenačetlo (${e.message || e}), použije se Liberation Sans.`); app.zmen(x => { x.pismo.id = 'libsans'; }); app.naplnFormular(); return nactiPismo('libsans'); }
      throw e;
    }
  }
  const tvary = new Map();
  function tvar(text, podtrzeni) {
    const kl = fontId + '|' + text + '|' + (podtrzeni ? 1 : 0);
    if (!tvary.has(kl)) tvary.set(kl, Object.assign(K.tvarTextu(font, text, podtrzeni), { klic: kl }));
    return tvary.get(kl);
  }
  if (typeof FONTY !== 'undefined') FONTY.seznam().then(sez => {
    const sel = $('f_font');
    sel.innerHTML = sez.filter(f => f.pro3d && (f.pismo || 'latinka') === 'latinka').map(f => `<option value="${f.id}">${f.nazev}${f.vlastni ? ' (vlastní)' : ''}</option>`).join('');
    sel.value = app.p.pismo.id;
  }).catch(() => { /* jen výchozí písmo */ });

  /* ---------- přepočet ---------- */
  let rozlozeno = [];
  async function prepocitej() {
    p = app.p;
    const st = $('stav3d');
    if (!wasm) return;
    if (p.rezim !== 'figurky' && fontId !== p.pismo.id) { st.textContent = 'Načítám písmo…'; st.classList.remove('chyba'); await nactiPismo(p.pismo.id); }
    if (!font) return;
    nahled.barvy(css('--border-strong'), css('--text'), css('--bg-panel'));
    chybaStavby = null;
    try {
      const t0 = performance.now();
      plan = K.plan(p, tvar);
      geo = KOSTKY3D_GEO.postav(wasm, plan, p);
      hlaseni = K.kontroly(p, plan, geo);
      geo.cas = performance.now() - t0;
      rozlozeno = K.rozmisti(geo.kusy, p.tisk.mezera).map((x, i) => {
        const z = geo.kusy[i];
        return Object.assign(x, { zdroj: z.poz, posunZdroje: [x.poz[0] - z.poz[0], x.poz[1] - z.poz[1], x.poz[2] - z.poz[2]] });
      });
      nahled.nastav(rozlozeno);
      st.textContent = ''; st.classList.remove('chyba');
    } catch (e) {
      console.error(e);
      chybaStavby = e.message || String(e);
      geo = null; rozlozeno = []; nahled.nastav([]);
      hlaseni = [{ uroven: 'chyba', text: 'Model nelze sestavit: ' + chybaStavby, pole: [] }];
      st.textContent = 'Model nelze sestavit: ' + chybaStavby; st.classList.add('chyba');
    }
    vypis();
  }

  /* ---------- výsledky ---------- */
  const box = G3D.dlazdice;
  const esc = G3D.esc;
  const um = mm => `${fmt(mm * 1000, mm * 1000 < 10 ? 1 : 0)} µm`;
  /** Ke které stěně (popisku) míří posun těžiště. */
  function smer(k, v) {
    if (Math.hypot(...v) < 1e-7) return '—';
    if (k.typ === 'd4') { const i = k.T.V.reduce((m, q, j) => (K.vec.dot(q, v) > K.vec.dot(k.T.V[m], v) ? j : m), 0); return `k vrcholu ${i + 1}`; }
    const s = k.steny.reduce((m, q) => (K.vec.dot(q.n, v) > K.vec.dot(m.n, v) ? q : m));
    return `ke stěně ${s.cislo.text}`;
  }
  function vypis() {
    const kostky = plan ? plan.dily.filter(d => d.druh === 'kostka') : [];
    if (geo && rozlozeno.length) {
      const bb = K.obal(rozlozeno.reduce((a, x) => { const b = K.obal(x.poz); a.push(b[0], b[1], b[2], b[3], b[4], b[5]); return a; }, []));
      const objem = geo.kusy.reduce((a, x) => a + x.objem, 0);
      const od = K.odhad(objem, bb[5] - bb[2], p);
      const vadne = geo.site.filter(s => !s.uzavrena).length;
      const troj = rozlozeno.reduce((a, x) => a + x.idx.length / 3, 0);
      let h = box('Sestava na podložce', `${fmt(bb[3] - bb[0])} × ${fmt(bb[4] - bb[1])} × ${fmt(bb[5] - bb[2])} mm`, `${geo.kusy.length} ${geo.kusy.length === 1 ? 'díl' : geo.kusy.length < 5 ? 'díly' : 'dílů'}`)
        + box('Objem', `${fmt(objem / 1000, 2)} cm³`, '100 % výplň')
        + box('Hmotnost', `${fmt(od.gramu, 1)} g`, `${od.material}, filament ${fmt(od.metru, 2)} m (1,75 mm)`)
        + box('Doba tisku', od.minut < 90 ? `≈ ${fmt(od.minut, 0)} min` : `≈ ${fmt(od.minut / 60, 1)} h`, 'hrubý odhad')
        + box('Síť', vadne ? 'vadná' : 'uzavřená', `${troj.toLocaleString('cs-CZ')} trojúhelníků · ${fmt(geo.cas, 0)} ms`, vadne ? 'chyba-t' : 'ok-t');
      if (kostky.length === 1) {
        const k = kostky[0], s = geo.site.find(x => x.dil === k), hs = k.znacky.filter(z => z.druh === 'text').map(z => z.h);
        h += box('Kostka', `${fmt(s.kontrola.bbox[3] - s.kontrola.bbox[0])} × ${fmt(s.kontrola.bbox[4] - s.kontrola.bbox[1])} × ${fmt(s.kontrola.bbox[5] - s.kontrola.bbox[2])} mm`, `${k.nazev}, zaoblení ${fmt(k.r, 2)} mm`)
          + (hs.length ? box('Výška čísel', `${fmt(Math.min(...hs), 1)}${Math.max(...hs) - Math.min(...hs) > 0.05 ? '–' + fmt(Math.max(...hs), 1) : ''} mm`, `hloubka ${fmt(p.pismo.hloubka, 2)} mm`) : '')
          + box('Posun těžiště', um(s.posun), `bez vyrovnání ${um(k.tez0.velikost)}`, s.posun / k.rozmer > 0.001 ? 'mez-t' : 'ok-t');
      }
      $('vVysledky').innerHTML = h;
      $('sVysledky').textContent = `${fmt(od.gramu, 0)} g`;
    } else { $('vVysledky').innerHTML = chybaStavby ? box('Model', 'nelze sestavit', esc(chybaStavby), 'chyba-t') : ''; $('sVysledky').textContent = ''; }

    // těžiště
    const tab = $('tTeziste');
    if (kostky.length && geo) {
      tab.innerHTML = '<tr><th>Kostka</th><th class="c">Bez vyrovnání</th><th class="c">Nyní (výpočet)</th><th class="c">Na síti</th><th class="c">% rozměru</th><th>Směr</th></tr>'
        + kostky.map(k => {
          const s = geo.site.find(x => x.dil === k), rel = s.posun / k.rozmer * 100;
          return `<tr><td>${esc(k.nazev)}</td><td class="c">${um(k.tez0.velikost)}</td><td class="c">${um(k.tez.velikost)}</td><td class="c">${um(s.posun)}</td>`
            + `<td class="c ${rel > 0.1 ? 'mez-t' : 'ok-t'}">${fmt(rel, 3)} %</td><td>${smer(k, s.teziste)}</td></tr>`;
        }).join('');
      const mx = Math.max(...kostky.map(k => geo.site.find(x => x.dil === k).posun));
      $('sTeziste').textContent = um(mx);
    } else { tab.innerHTML = '<tr><td>Těžiště se počítá jen u kostek.</td></tr>'; $('sTeziste').textContent = ''; }
    $('sTisk').textContent = `${K.MATERIALY[p.tisk.material].nazev} · ${fmt(p.tisk.tryska, 2)}`;

    // souhrny oddílů
    const tt = t => (t === 'dpct' ? 'D%' : t.toUpperCase());
    TrubkyGui.souhrn('sKostka', p.rezim === 'sada' ? `${p.sada.typy.length} kostek` : `${tt(p.kostka.typ)} ${fmt(p.kostka.rozmer)} mm${p.kostka.kusu > 1 ? ` × ${p.kostka.kusu}` : ''}`);
    TrubkyGui.souhrn('sZeton', `${plan && plan.dily[0] && plan.dily[0].celkem || 0} ks`);
    TrubkyGui.souhrn('sFigurka', `${p.figurka.hracu} × ${p.figurka.kusu}`);
    TrubkyGui.souhrn('sPismo', `${fmt(p.pismo.velikost, 0)} % · ${fmt(p.pismo.hloubka, 2)} mm`);
    TrubkyGui.souhrn('sTecky', `Ø ${fmt(p.tecky.prumer, 1)} · ${fmt(p.tecky.hloubka, 1)}`);
    TrubkyGui.souhrn('sVlastni', p.kostka.vlastni.trim() ? 'zapnuto' : '', !!p.kostka.vlastni.trim());

    app.hlaseni(hlaseni, { boxy: ['boxTvar', 'boxZnaceni'] });
    if (chybaStavby) TrubkyGui.otevriZalozku('kontrola');
    karta(kostky);
    kusovnik();
  }
  function karta(kostky) {
    const el = $('karta3d');
    if (!geo) { el.innerHTML = ''; return; }
    if (kostky.length === 1) {
      const k = kostky[0], s = geo.site.find(x => x.dil === k);
      el.innerHTML = `<div class="titul">${esc(k.nazev)}</div><b>${fmt(k.rozmer)}</b> mm · těžiště <b>${um(s.posun)}</b><br>`
        + `${k.tecky ? 'tečky' : 'čísla'} ${p.vyrovnat ? 'vyrovnaná' : 'nevyrovnaná'} · převis ${fmt(k.previs, 0)}°`;
    } else el.innerHTML = `<div class="titul">${{ sada: 'Sada kostek', zetony: 'Žetony', figurky: 'Figurky', kostka: 'Kostky' }[p.rezim]}</div><b>${geo.kusy.length}</b> dílů na podložce`;
  }
  /** Jedinečné díly (kopie mají stejnou síť) s počtem kusů a jménem souboru. */
  function jedinecne() {
    const videno = new Map();
    for (const x of geo.kusy) { const z = videno.get(x.idx); if (z) z.ks++; else videno.set(x.idx, { x, ks: 1 }); }
    const jmena = new Set();
    return [...videno.values()].map(o => {
      let jm = o.x.nazev.replace(/ \(?\d+\)?$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_');
      while (jmena.has(jm)) jm += '_';
      jmena.add(jm);
      return Object.assign(o, { jm, nazev: o.x.nazev.replace(/ \(?\d+\)?$/, '') });
    });
  }
  function kusovnik() {
    const el = $('tKusovnik');
    if (!geo || !geo.kusy.length) { el.innerHTML = ''; $('sKusovnik').textContent = ''; return; }
    const J = jedinecne();
    el.innerHTML = '<tr><th>Díl</th><th class="c">Kusů</th><th class="c">Rozměr</th><th class="c">Objem</th><th class="c">Hmotnost</th><th class="c">Export</th></tr>'
      + J.map(({ x, ks, nazev }, i) => {
        const b = K.obal(x.poz), od = K.odhad(x.objem, b[5] - b[2], p);
        return `<tr><td><span class="tecka" style="background:${x.barva}"></span>${esc(nazev)}</td><td class="c">${ks}</td><td class="c">${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])}</td>`
          + `<td class="c">${fmt(x.objem / 1000, 2)} cm³</td><td class="c">${fmt(od.gramu * ks, 1)} g</td><td class="c"><button class="tl" type="button" data-dil="${i}">⬇ STL</button></td></tr>`;
      }).join('');
    $('sKusovnik').textContent = String(geo.kusy.length);
  }
  $('tKusovnik').addEventListener('click', e => {
    const b = e.target.closest('[data-dil]'); if (!b || !lzeExport()) return;
    const { x, jm } = jedinecne()[+b.dataset.dil];
    app.stahni(KRAB.stlBinarni(K.rozmisti([x], 0), x.nazev), app.jmeno('_' + jm + '.stl'), 'model/stl');
  });

  /* ---------- nabídky, předvolby, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_kostky3d_gui', pohled: j => nahled.pohled(j) });
  for (const v of KOSTKY3D_PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => {
      app.zmen(x => { for (const [k, h] of Object.entries(K.kopie(v.p))) { if (h && typeof h === 'object') Object.assign(x[k], h); else x[k] = h; } });
      app.naplnFormular();
    });
    $('seznamPredvoleb').appendChild(b);
  }
  const lzeExport = () => {
    if (!geo || !rozlozeno.length) { Dialog.chyba('Model není sestavený' + (chybaStavby ? ': ' + chybaStavby : ' – počkejte na načtení.')); return false; }
    if (hlaseni.some(h => /není uzavřená/.test(h.text))) { Dialog.chyba('Síť není uzavřená, export by nebyl tisknutelný.'); return false; }
    return true;
  };
  const dilyExportu = () => rozlozeno.map(x => ({ nazev: x.nazev, barva: x.barva, poz: x.poz, idx: x.idx }));
  function exportStl() { if (lzeExport()) app.stahni(KRAB.stlBinarni(dilyExportu(), 'kostky3d - github_site'), app.jmeno('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) app.stahni(KRAB.soubor3mf(dilyExportu(), app.p.nazev || 'Herní kostky'), app.jmeno('.3mf'), 'model/3mf'); });
  $('btnZip').addEventListener('click', () => {
    if (!lzeExport()) return;
    const polozky = jedinecne().map(({ x, jm }) => ({ name: jm + '.stl', data: new Uint8Array(KRAB.stlBinarni(K.rozmisti([x], 0), x.nazev)) }));
    app.stahni(new Blob([KRAB.zip(polozky)], { type: 'application/zip' }), app.jmeno('_dily.zip'), 'application/zip');
  });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => app.stahni(b, app.jmeno('.png'))); });
  app.prepinac('tRyti', h => nahled.prepni('barvaRyti', h));
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !h; });
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);

  /* ---------- start ---------- */
  p = app.p;
  app.start();
  Promise.all([app.manifold(), nactiPismo(app.p.pismo.id)]).then(([w]) => { wasm = w; prepocitej(); }).catch(e => {
    const st = $('stav3d'); st.textContent = 'Geometrické jádro (manifold-3d) nebo písmo se nenačetlo: ' + (e && e.message || e); st.classList.add('chyba');
    chybaStavby = 'manifold-3d nebo písmo se nenačetlo – model ani export nejsou k dispozici.';
    hlaseni = [{ uroven: 'chyba', text: chybaStavby, pole: [] }];
    vypis();
  });
  // pro testy
  window.__kostky3d = { nahled, get p() { return app.p; }, get plan() { return plan; }, get geo() { return geo; }, get hlaseni() { return hlaseni; }, zmen: app.zmen, naplnFormular: app.naplnFormular, prepocitej, app };
})();
