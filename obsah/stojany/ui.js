/* Stojany a držáky – ovládání stránky nad společným zapojením gen3d/aplikace.js.
   Sestava = podstava + moduly: seznam modulů, paleta zařízení, formuláře generované ze schématu (STOJ.MODULY[typ].oddily,
   PODSTAVA_ODDILY, ODLEHCENI_ODDILY), rozložení shora s tažením (SVG), výsledky s kusovníkem, exporty.
   Náhled = KNOF_NAHLED (knofliky/nahled.js) nad G3D.scena; vybraný modul svítí. */
/* global STOJ, STOJ_TVARY, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = STOJ.fmt, T = STOJ_TVARY, esc = G3D.esc;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const BARVA_VYBRANEHO = '#FFC23D';
  let p, wasm = null, model = null, tiskDily = null, chybaStavby = '', vybrany = 0, podpisFormu = '';
  const stavZobr = { tisk: false };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));
  const kusy = dily => T.tiskoveRozlozeni(app.p, dily, app.p.tisk.kusu);
  const barvaModulu = i => T.BARVY[i % T.BARVY.length];

  /* ---------- formuláře generované ze schématu ---------- */
  // podmínky viditelnosti: id → {fn(obj, p), zdroj: 'modul' | 'podstava' | 'odlehceni'}
  const KDY = {};
  let citacKdy = 0;
  const registruj = (fn, zdroj) => { const id = (zdroj === 'modul' ? 'm' : 's') + (citacKdy++); KDY[id] = { fn, zdroj }; return id; };
  function htmlOddilu(oddily, prefix, zdroj, idPrefix) {
    return oddily.map(([nazev, pole]) => {
      const pole1 = [], zaskrtavaci = [];
      for (const f of pole) {
        const cesta = prefix + f.k, id = `f_${idPrefix}_${f.k}`;
        const kdy = f.kdy ? ` data-kdy="${registruj(f.kdy, zdroj)}"` : '';
        const title = f.title ? ` title="${esc(f.title)}"` : '';
        if (f.t === 'bool') zaskrtavaci.push(`<label class="zaskrt"${kdy}${title}><input type="checkbox" id="${id}" data-p="${cesta}" data-typ="bool"> ${esc(f.n)}</label>`);
        else if (f.t === 'vycet') {
          const text = typeof f.moz[0][0] !== 'number';
          pole1.push(`<div class="pole"${kdy}><label for="${id}">${esc(f.n)}</label><select id="${id}" data-p="${cesta}"${text ? ' data-typ="text"' : ''}${title}>`
            + f.moz.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('') + '</select></div>');
        } else if (f.t === 'text') pole1.push(`<div class="pole"${kdy}><label for="${id}">${esc(f.n)}</label><input type="text" id="${id}" data-p="${cesta}" data-typ="text" maxlength="80"${title}></div>`);
        else pole1.push(`<div class="pole"${kdy}><label for="${id}">${esc(f.n)}</label><input type="text" inputmode="decimal" class="mm" id="${id}" data-p="${cesta}"${title}><span class="jedn">${esc(f.j || '')}</span></div>`);
      }
      return `<details class="oddil" open><summary><span class="oddil-nazev">${esc(nazev)}</span></summary><div class="oddil-telo"><div class="mrizka">${pole1.join('')}</div>${zaskrtavaci.join('')}</div></details>`;
    }).join('');
  }
  $('formPodstava').innerHTML = htmlOddilu(STOJ.PODSTAVA_ODDILY, 'podstava.', 'podstava', 'pod');
  $('formOdlehceni').innerHTML = htmlOddilu(STOJ.ODLEHCENI_ODDILY, 'odlehceni.', 'odlehceni', 'odl');
  $('f_material').innerHTML = Object.entries(STOJ.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');

  /** Formulář vybraného modulu – překreslí se jen při změně výběru, druhu nebo počtu modulů. */
  function formularModulu() {
    const m = p.moduly[vybrany], podpis = m ? `${vybrany}:${m.typ}:${p.moduly.length}` : '-';
    if (podpis === podpisFormu) return;
    podpisFormu = podpis;
    for (const id of Object.keys(KDY)) if (id[0] === 'm') delete KDY[id];
    if (!m) { $('formModulu').innerHTML = ''; return; }
    const D = STOJ.MODULY[m.typ];
    $('formModulu').innerHTML = `<div class="form-modulu-hlava"><span aria-hidden="true">${D.ikona}</span><span>${vybrany + 1}. ${esc(D.nazev)}</span></div>`
      + `<p class="form-modulu-popis">${esc(D.popis)}</p>` + htmlOddilu(D.oddily.concat([STOJ.ODDIL_UMISTENI]), `moduly.${vybrany}.`, 'modul', 'm');
  }
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-kdy]').forEach(el => {
      const f = KDY[el.dataset.kdy]; if (!f) return;
      const obj = f.zdroj === 'modul' ? p.moduly[vybrany] : f.zdroj === 'podstava' ? p.podstava : p.odlehceni;
      el.hidden = !obj || !f.fn(obj, p);
    });
  }
  function predNaplnenim() {
    p = app.p;
    if (vybrany >= p.moduly.length) vybrany = Math.max(0, p.moduly.length - 1);
    formularModulu();
    seznamModulu();
  }

  /* ---------- seznam modulů a paleta ---------- */
  function seznamModulu() {
    const R = model ? model.rozvrh.moduly : [];
    $('seznamModulu').innerHTML = p.moduly.map((m, i) => {
      const D = STOJ.MODULY[m.typ], r = R.find(x => x.i === i);
      const souhrn = r ? `${fmt(r.rozmer[0], 0)} × ${fmt(r.rozmer[1], 0)} × ${fmt(r.vyska, 0)} mm${r.samostatny && p.podstava.tvar !== 'zadna' ? ' · samostatný díl' : ''}` : '';
      return `<div class="modul-polozka" role="listitem" data-i="${i}" aria-current="${i === vybrany}">`
        + `<button class="vyber" data-akce="vyber" title="Upravit modul"><span class="barva" style="background:${barvaModulu(i)}"></span><span class="ikona" aria-hidden="true">${D.ikona}</span>`
        + `<span class="txt"><span>${i + 1}. ${esc(D.nazev)}</span><small>${souhrn}</small></span></button>`
        + `<button class="mini" data-akce="otoc" title="Otočit o 90°" aria-label="Otočit o 90°">⟳</button>`
        + `<button class="mini" data-akce="dup" title="Duplikovat" aria-label="Duplikovat">⧉</button>`
        + `<button class="mini" data-akce="smaz" title="Odebrat" aria-label="Odebrat">✕</button></div>`;
    }).join('');
    if (!p.moduly.length) $('paletaObal').open = true;
  }
  function vyber(i) {
    vybrany = i; podpisFormu = '';
    app.naplnFormular();
    zobrazNahled(false);
    kresliRozlozeni();
  }
  $('seznamModulu').addEventListener('click', async e => {
    const b = e.target.closest('button[data-akce]'); if (!b) return;
    const i = Number(b.closest('.modul-polozka').dataset.i), akce = b.dataset.akce;
    if (akce === 'vyber') { vyber(i); return; }
    if (akce === 'otoc') app.zmen(q => { q.moduly[i].otoceni = ((q.moduly[i].otoceni + 90) % 360 + 360) % 360; });
    if (akce === 'dup') {
      if (app.p.moduly.length >= STOJ.MAX_MODULU) { Dialog.chyba(`Sestava může mít nejvýš ${STOJ.MAX_MODULU} modulů.`); return; }
      const r = model && model.rozvrh.moduly.find(x => x.i === i), w = r ? r.rozmer[0] : STOJ.otocenyPudorys(app.p.moduly[i])[0];
      app.zmen(q => { const c = G3D.kopie(q.moduly[i]); c.x = Math.round((c.x + w + 8) * 10) / 10; q.moduly.splice(i + 1, 0, c); });
      vybrany = i + 1;
    }
    if (akce === 'smaz') {
      if (!(await Dialog.potvrd(`Odebrat modul ${i + 1}. ${STOJ.MODULY[app.p.moduly[i].typ].nazev}?`))) return;
      app.zmen(q => { q.moduly.splice(i, 1); });
      vybrany = Math.max(0, Math.min(vybrany, app.p.moduly.length - 1));
    }
    podpisFormu = '';
    app.naplnFormular();
  });
  $('paletaZarizeni').innerHTML = STOJ.ZARIZENI.map(z => `<button type="button" data-zarizeni="${z.id}"><span aria-hidden="true">${z.ikona}</span><span>${esc(z.nazev)}<small>${esc(STOJ.MODULY[z.modul.typ].nazev)}</small></span></button>`).join('');
  $('paletaZarizeni').addEventListener('click', e => { const b = e.target.closest('button[data-zarizeni]'); if (b) pridej(b.dataset.zarizeni); });
  /** Přidá modul zařízení vpravo vedle sestavy (zadní hrana zarovnaná); pro víc modulů zapne podstavu. */
  function pridej(id) {
    if (app.p.moduly.length >= STOJ.MAX_MODULU) { Dialog.chyba(`Sestava může mít nejvýš ${STOJ.MAX_MODULU} modulů.`); return; }
    const R = model ? model.rozvrh.moduly.filter(r => !r.samostatny) : [];
    app.zmen(q => {
      const m = STOJ.novyModul(id);
      const naPodstave = q.moduly.filter(x => !STOJ.samostatny(x));
      if (!STOJ.samostatny(m) && q.podstava.tvar === 'zadna' && (STOJ.potrebujePodstavu(m) || naPodstave.length >= 1)) q.podstava.tvar = 'obal';
      q.moduly.push(m);
      if (STOJ.samostatny(m) || !R.length) STOJ.rozmisti(q);
      else {
        const [w, h] = STOJ.otocenyPudorys(m);
        m.x = Math.round((Math.max(...R.map(r => r.bbox[2])) + 8 + w / 2) * 10) / 10;
        m.y = Math.round((Math.max(...R.map(r => r.bbox[3])) - h / 2) * 10) / 10;
      }
    });
    vybrany = app.p.moduly.length - 1; podpisFormu = '';
    app.naplnFormular();
  }
  $('btnRozmistit').addEventListener('click', () => {
    const rozmery = model ? model.rozvrh.moduly.reduce((a, r) => { a[r.i] = r.rozmer; return a; }, []) : null;
    app.zmen(q => STOJ.rozmisti(q, rozmery));
    app.naplnFormular();
  });

  /* ---------- předvolby a náhoda ---------- */
  {
    let skupina = '';
    for (const v of STOJ.PREDVOLBY) {
      if (v.skupina !== skupina) {
        skupina = v.skupina;
        const nd = document.createElement('div'); nd.className = 'nab-nadpis'; nd.textContent = skupina;
        $('seznamPredvoleb').appendChild(nd);
      }
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
      b.addEventListener('click', () => {
        const q = STOJ.predvolba(v.id);
        q.tisk.material = app.p.tisk.material; q.tisk.uhel = app.p.tisk.uhel;
        vybrany = 0; podpisFormu = '';
        app.nahrad(q);
      });
      $('seznamPredvoleb').appendChild(b);
    }
  }
  function nahodnaSestava() {
    const r = a => a[Math.floor(Math.random() * a.length)];
    const kandidati = STOJ.ZARIZENI.filter(z => !(z.modul.typ === 'hak' && z.modul.montaz !== 'sloup'));
    const q = STOJ.normalizuj({
      nazev: 'Náhodná sestava', tisk: app.p.tisk,
      podstava: { tvar: r(['obal', 'obdelnik', 'kruh']), auto: true, nozicky: r([0, 3, 4]), odlehceni: r(['zadne', 'skrz', 'kapsy']), zavazi: r([0, 0, 2]) },
      odlehceni: { druh: r(['okna', 'kosoctverce', 'prihradove', 'vostina']) },
      moduly: Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => STOJ.novyModul(r(kandidati).id)),
    }).p;
    vybrany = 0; podpisFormu = '';
    return STOJ.rozmisti(q);
  }

  /* ---------- aplikace ---------- */
  const app = G3D.aplikace({
    typ: 'stojany', nazev: 'Stojany', klic: 'webapp_stojany', soubor: 'stojan',
    diry: true,   // 👁 Zobrazení → 💧 Díry jako kapka (K)
    normalizuj: STOJ.normalizuj, vychozi: () => STOJ.predvolba('kombi'),
    ulozProjekt: STOJ.ulozProjekt, nactiProjekt: STOJ.nactiProjekt, popis: STOJ.popis,
    predNaplnenim: () => predNaplnenim(),
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(model.dily), app.p.nazev || 'Stojan'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => prepocitej(),
    nahodny: () => nahodnaSestava(),
    cilPole: cesta => {
      const m = /^moduly\.(\d+)\./.exec(cesta);
      if (m && Number(m[1]) !== vybrany) { vybrany = Number(m[1]); podpisFormu = ''; app.naplnFormular(); }
      return null;
    },
  });

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = STOJ.kontroly(p);
    model = null; tiskDily = null;
    if (wasm) {
      try {
        model = T.postav(wasm, p);
        tiskDily = T.tiskoveRozlozeni(p, model.dily, 1);
        H = H.concat(T.kontrolyModelu(p, model, tiskDily));
        chybaStavby = '';
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    }
    const st = $('stav3d');
    st.textContent = wasm ? chybaStavby : chybaStavby || 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobrazNahled(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxSestava', 'boxPodstava'] });
    seznamModulu();
    vypisVysledky();
    kresliRozlozeni();
    exportDilu();
  }
  /** Náhled: v montážní poloze díly po modulech (vybraný zvýrazněný), v tiskové poloze exportní díly. */
  function zobrazNahled(novyPohled) {
    if (!model) { nahled.nastav(null); return; }
    const dily = stavZobr.tisk ? tiskDily : model.nahled.map(d => (d.modul === vybrany && p.moduly.length > 1 ? Object.assign({}, d, { barva: BARVA_VYBRANEHO }) : d));
    nahled.nastav(dily, { tisk: stavZobr.tisk, novyPohled, uhel: p.tisk.uhel });
  }
  const box = G3D.dlazdice;
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('tabKusovnik').innerHTML = ''; $('sTisk').textContent = ''; return; }
    const mat = STOJ.MATERIALY[p.tisk.material], n = p.tisk.kusu;
    const V = model.dily.reduce((s, d) => s + d.objem, 0) * n;
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: model.dily.length * n });
    const B = model.nahled.map(d => G3D.obal(d.poz)).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.max(a[4], b[4]), Math.max(a[5], b[5])]);
    const sx = B[3] - B[0], sy = B[4] - B[1], sz = B[5] - B[2];
    const polohy = [...new Set(model.dily.map(d => STOJ.NAZVY.poloha[T.polohaDilu(p, d)]))].join(' + ');
    $('sTisk').textContent = polohy;
    const pocet = (x, a, b, c) => `${x} ${x === 1 ? a : x < 5 ? b : c}`;
    let h = box('Rozměry', `${fmt(sx, 0)} × ${fmt(sy, 0)} × ${fmt(sz, 0)} mm`, 'šířka × hloubka × výška, jak stojí na stole');
    h += box('Objem', `${fmt(V / 1000, 1)} cm³`, n > 1 ? `${n} sady` : pocet(model.dily.length, 'díl', 'díly', 'dílů'));
    h += box('Hmotnost', `${fmt(od.g, 0)} g`, `${mat.nazev}, plný materiál (při 20 % výplni zhruba ${fmt(od.g * 0.5, 0)} g)`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'průměr 1,75 mm');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad');
    h += box('Moduly', `${p.moduly.length}`, `${STOJ.NAZVY.podstava[p.podstava.tvar]} · odlehčení ${STOJ.NAZVY.odlehceni[p.odlehceni.druh]}`);
    h += box('Tisková poloha', polohy || '–', p.tisk.poloha === 'auto' ? 'zvoleno automaticky' : 'zadáno ručně');
    el.innerHTML = h;
    $('tabKusovnik').innerHTML = model.dily.length < 2 ? '' : '<tr><th>Díl</th><th>Poloha</th><th class="c">V tiskové poloze</th><th class="c">Hmotnost</th></tr>'
      + tiskDily.map((d, k) => { const b = G3D.obal(d.poz), dd = model.dily[k]; return `<tr><td>${esc(d.nazev)}</td><td>${STOJ.NAZVY.poloha[T.polohaDilu(p, dd)]}</td><td class="c">${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} × ${fmt(b[5] - b[2], 0)}</td><td class="c">${fmt(dd.objem / 1000 * mat.hustota, 0)} g</td></tr>`; }).join('');
    karta.innerHTML = `<div class="titul">${esc(p.nazev || 'Stojan')}</div><b>${fmt(sx, 0)} × ${fmt(sy, 0)} × ${fmt(sz, 0)}</b> mm · <b>${fmt(od.g, 0)}</b> g ${mat.nazev}<br>`
      + `${pocet(p.moduly.length, 'modul', 'moduly', 'modulů')} · ${STOJ.NAZVY.podstava[p.podstava.tvar]}<br>tisk ${polohy}`;
    $('vSit').innerHTML = model.dily.map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx); return box('Síť – ' + d.nazev, k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${k.teles} těleso, ${model.cas} ms`, k.uzavrena && k.teles === 1 ? 'ok-t' : 'chyba-t'); }).join('');
  }

  /* ---------- rozložení shora (SVG, předek dole) ---------- */
  const cesta = polys => polys.map(P => 'M' + P.map(([x, y]) => `${x.toFixed(1)},${(-y).toFixed(1)}`).join('L') + 'Z').join('');
  function kresliRozlozeni() {
    const svg = $('rozlozeni');
    if (!model) { svg.innerHTML = ''; return; }
    const R = model.rozvrh, body = [];
    if (R.podstava) R.podstava.forEach(P => body.push(...P));
    R.moduly.forEach(m => m.silueta.forEach(P => body.push(...P)));
    if (!body.length) { svg.innerHTML = ''; return; }
    const xs = body.map(q => q[0]), ys = body.map(q => -q[1]), pad = 15;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    let h = `<line class="osa" x1="${x0}" y1="0" x2="${x1}" y2="0"/><line class="osa" x1="0" y1="${y0}" x2="0" y2="${y1}"/>`;
    if (R.podstava) h += `<path class="podstava" d="${cesta(R.podstava)}"/>`;
    for (const m of R.moduly) {
      const c = m.i === vybrany ? BARVA_VYBRANEHO : barvaModulu(m.i);
      const cx = (m.bbox[0] + m.bbox[2]) / 2, cy = -(m.bbox[1] + m.bbox[3]) / 2;
      h += `<g class="modul${m.i === vybrany ? ' vybrany' : ''}${m.samostatny ? ' samostatny' : ''}" data-i="${m.i}">`
        + `<path class="silueta" d="${cesta(m.silueta)}" fill="${c}" stroke="${c}"/>`
        + (m.pata ? `<path class="pata" d="${cesta(m.pata)}" fill="${c}"/>` : '')
        + `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${m.i + 1}</text></g>`;
    }
    svg.innerHTML = h;
  }
  {
    const svg = $('rozlozeni');
    let tah = null;
    const bod = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    svg.addEventListener('pointerdown', e => {
      const g = e.target.closest('g.modul'); if (!g) return;
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
      const b = bod(e);
      tah = { g, i: Number(g.dataset.i), x0: b.x, y0: b.y, dx: 0, dy: 0 };
    });
    svg.addEventListener('pointermove', e => {
      if (!tah) return;
      const b = bod(e), krok = e.shiftKey ? 5 : 0.5;
      tah.dx = Math.round((b.x - tah.x0) / krok) * krok;
      tah.dy = Math.round((b.y - tah.y0) / krok) * krok;   // ve směru SVG (dolů = −y modelu)
      tah.g.setAttribute('transform', `translate(${tah.dx},${tah.dy})`);
    });
    const konec = () => {
      if (!tah) return;
      const t = tah; tah = null;
      if (Math.abs(t.dx) < 0.3 && Math.abs(t.dy) < 0.3) { t.g.removeAttribute('transform'); vyber(t.i); return; }
      vybrany = t.i; podpisFormu = '';
      app.zmen(q => { const m = q.moduly[t.i]; m.x = Math.round((m.x + t.dx) * 10) / 10; m.y = Math.round((m.y - t.dy) * 10) / 10; });
      app.naplnFormular();
    };
    svg.addEventListener('pointerup', konec);
    svg.addEventListener('pointercancel', konec);
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_stojany_gui', pohled: j => nahled.pohled(j) });
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  function exportStl() { if (lzeExport()) app.stahni(KRAB.stlBinarni(kusy(model.dily), 'stojany - github_site'), app.jmeno('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) app.stahni(KRAB.soubor3mf(kusy(model.dily), app.p.nazev || 'Stojan'), app.jmeno('.3mf'), 'model/3mf'); });
  /** Vícedílná sestava: každý díl zvlášť. */
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    model.dily.forEach((d, k) => {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev)}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(kusy([d]), 'stojany - ' + d.jmeno), app.jmeno(`_${k + 1}_${d.jmeno}.stl`), 'model/stl'));
      el.appendChild(b);
    });
  }
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tTisk', h => {
    stavZobr.tisk = h;
    $('legPrevisy').hidden = !(h && nahled.stav.previsy);
    zobrazNahled(true);
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.STOJ_UI = {
    get p() { return app.p; }, get model() { return model; }, get vybrany() { return vybrany; },
    vyber, pridej, zmen: app.zmen, nahrad: app.nahrad, naplnFormular: app.naplnFormular, prepocitej, nahled, app,
  };
})();
