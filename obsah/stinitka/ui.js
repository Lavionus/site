/* Lustrová stínítka – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro stínítka zvláštní (paleta profilů, editor křivky, litofanie, náhled rozsvícený i se žárovkou,
   výsledky, výkres, režim váza). Historie, formulář, hlášení, soubory, sdílení a klávesy dělá G3D.aplikace. */
/* global STIN, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = STIN.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, model = null, tiskDily = null, chybaStavby = '', svetloModelu = null;
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));
  const stavZobr = { tisk: false, zarovka: true, svit: false };

  const app = G3D.aplikace({
    typ: 'stinitka', nazev: 'Stínítka', klic: 'webapp_stinitka', soubor: 'stinitko',
    normalizuj: STIN.normalizuj, vychozi: () => STIN.predvolba('tulipan'),
    ulozProjekt: STIN.ulozProjekt, nactiProjekt: STIN.nactiProjekt, popis: STIN.popis,
    vezmi: STIN.vezmi, poloz: STIN.poloz, limitHistorie: 60,   // projekt s obrázkem litofanie je velký
    viditelnost: () => viditelnost(), poNaplneni: () => nahledObrazku(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => { const d = kusy(); return d ? { data: KRAB.soubor3mf(d, app.p.nazev || 'Stínítko'), pripona: '.3mf' } : null; },
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', z: 'tZarovka', s: 'tSvit' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- formulář ---------- */
  const volby = (sel, obj, klice) => { sel.innerHTML = (klice || Object.keys(obj)).map(k => `<option value="${k}">${typeof obj[k] === 'string' ? obj[k] : obj[k].nazev}</option>`).join(''); };
  volby($('f_vtyp'), STIN.VZORY);
  volby($('f_v2typ'), STIN.VZORY, STIN.VZORY2);
  volby($('f_vprubeh'), STIN.PRUBEHY);
  volby($('f_v2prubeh'), STIN.PRUBEHY);
  volby($('f_otyp'), STIN.OKRAJE);
  volby($('f_utyp'), STIN.UCHYTY);
  volby($('f_zarovka'), STIN.ZAROVKY);
  volby($('f_material'), STIN.MATERIALY);
  volby($('f_barva'), STIN.BARVY);

  // paleta profilů s obrysem
  for (const [k, P] of Object.entries(STIN.PROFILY)) {
    if (k === 'vlastni') continue;
    let d = '';
    for (let i = 0; i <= 20; i++) { const t = i / 20, r = 5 + 9 * P.f(t) + 4 * P.b(t); d += (i ? 'L' : 'M') + (17 + r).toFixed(1) + ' ' + (4 + 22 * t).toFixed(1); }
    for (let i = 20; i >= 0; i--) { const t = i / 20, r = 5 + 9 * P.f(t) + 4 * P.b(t); d += 'L' + (17 - r).toFixed(1) + ' ' + (4 + 22 * t).toFixed(1); }
    const b = document.createElement('button'); b.type = 'button'; b.dataset.profil = k;
    b.innerHTML = `<svg viewBox="0 0 34 30" aria-hidden="true"><path d="${d}Z"/></svg><span>${P.nazev}</span>`;
    b.addEventListener('click', () => { if (app.p.tvar.profil !== k) app.zmen(q => { q.tvar.profil = k; }); });
    $('paletaProfilu').appendChild(b);
  }
  {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.profil = 'vlastni';
    b.innerHTML = '<svg viewBox="0 0 34 30" aria-hidden="true"><path d="M12 4 C 4 12, 26 18, 8 26 M22 4 C 30 12, 8 18, 26 26"/><circle cx="7" cy="15" r="2"/><circle cx="27" cy="15" r="2"/></svg><span>Vlastní</span>';
    b.addEventListener('click', () => { if (app.p.tvar.profil !== 'vlastni') { app.zmen(q => prevedNaVlastni(q)); app.naplnFormular(); } });
    $('paletaProfilu').appendChild(b);
  }
  function prevedNaVlastni(q) {
    q.tvar.body = STIN.bodyZProfilu(q, 3);
    q.tvar.profil = 'vlastni'; q.tvar.vybouleni = 0;
  }

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-vzory],[data-nevzory],[data-vzory2],[data-nevzory2],[data-uchyt],[data-okraj],[data-zarovka],[data-lito]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.vzory && !seznam(d.vzory).includes(p.vzor.typ)) vid = false;
      if (d.nevzory && seznam(d.nevzory).includes(p.vzor.typ)) vid = false;
      if (d.vzory2 && !seznam(d.vzory2).includes(p.vzor2.typ)) vid = false;
      if (d.nevzory2 && seznam(d.nevzory2).includes(p.vzor2.typ)) vid = false;
      if (d.uchyt && d.uchyt !== p.uchyt.typ) vid = false;
      if (d.okraj && p.okraj.typ === 'rovny') vid = false;
      if (d.zarovka && p.zarovka.typ === 'zadna') vid = false;
      if (d.lito && !p.lito.pouzit) vid = false;
      el.hidden = !vid;
    });
    if (p.uchyt.typ === 'deska') $('pOtvor').hidden = p.uchyt.objimka !== 'vlastni';
    $('f_hrdlo').disabled = p.uchyt.typ === 'fitter';
    $('lPocet').textContent = p.vzor.typ === 'fazety' ? 'Počet stran' : p.vzor.typ === 'dyne' ? 'Počet laloků' : p.vzor.typ === 'kosoctverce' || p.vzor.typ === 'bubliny' ? 'Počet kolem dokola' : 'Počet žeber';
    $('napVzor').textContent = {
      hladky: 'Hladká stěna – vynikne tvar profilu.', zebra: 'Zaoblená svislá žebra; se zkroucením vznikne spirála.', plise: 'Ostré sklady jako u látkového stínítka.',
      fazety: 'Pravidelný mnohoúhelník s rohy na obrysu profilu; zkroucení dá šroubovici.', dyne: 'Vypouklé laloky s ostrými rýhami mezi nimi.',
      vlny: 'Vodorovné prstence po výšce stínítka.', kosoctverce: 'Dvě proti sobě běžící šroubovice tvoří kosočtverečnou síť.',
      bubliny: 'Pravidelné vypouklé důlky v mřížce.', vlnita: 'Svislá žebra zvlněná do hadovky.',
    }[p.vzor.typ];
    $('napUchyt').textContent = {
      deska: 'Deska v hrdle se navlékne na objímku a přitáhne převlečným kroužkem. Otvor E14/E27 je typický – závit objímky změřte.',
      fitter: 'Krček s lemem zasunutý do držáku lustru (fitter), drží ho tři šroubky pod lemem. Ø hrdla se řídí krčkem.',
      zadny: 'Otevřené hrdlo – stínítko se nasadí na vlastní držák nebo přilepí.',
    }[p.uchyt.typ];
  }

  /* ---------- editor křivky profilu ---------- */
  const ed = $('editorProfilu'), edStav = { q: null, tah: null, mer: null };
  /** Body editoru: [{s, r, druh: 'hrdlo'|'usti'|'bod', i}] z projektu q. */
  function bodyEditoru(q) {
    const o = STIN.odvozene(q), B = [{ s: 0, r: o.rHrdlo, druh: 'hrdlo' }];
    if (q.tvar.profil === 'vlastni') q.tvar.body.forEach((b, i) => B.push({ s: b[0], r: b[1], druh: 'bod', i }));
    B.push({ s: 1, r: q.tvar.usti / 2, druh: 'usti' });
    return B;
  }
  function kresliEditor() {
    const q = edStav.q || app.p, dpr = window.devicePixelRatio || 1;
    const w = ed.clientWidth, h = ed.clientHeight; if (!w) return;
    if (ed.width !== Math.round(w * dpr)) { ed.width = Math.round(w * dpr); ed.height = Math.round(h * dpr); }
    const g = ed.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    let sv;
    try { sv = STIN.povrch(q); } catch (e) { return; }
    const H = q.tvar.vyska, vz = 64;
    const zakl = [], obrys = [];
    let rMax = 10;
    for (let i = 0; i <= vz; i++) { const s = i / vz, a = sv.zaklad(s); let b = 0; for (let j = 0; j < 24; j++) b = Math.max(b, sv.r(j / 24 * Math.PI * 2, s)); zakl.push(a); obrys.push(b); rMax = Math.max(rMax, a, b); }
    const m = 14, sc = Math.min((w / 2 - m) / (rMax * 1.05), (h - 2 * m) / H), cx = w / 2, y0 = h - m - (h - 2 * m - H * sc) / 2;
    edStav.mer = { sc, cx, y0, H };
    const X = r => cx + r * sc, Y = s => y0 - s * H * sc;
    g.strokeStyle = css('--border'); g.setLineDash([4, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx, Y(-0.03)); g.lineTo(cx, Y(1.03)); g.stroke();
    g.strokeStyle = css('--text-faint');
    for (const zn of [1, -1]) { g.beginPath(); obrys.forEach((r, i) => (i ? g.lineTo : g.moveTo).call(g, cx + zn * r * sc, Y(i / vz))); g.stroke(); }
    g.setLineDash([]); g.strokeStyle = css('--accent'); g.lineWidth = 2;
    for (const zn of [1, -1]) { g.beginPath(); zakl.forEach((r, i) => (i ? g.lineTo : g.moveTo).call(g, cx + zn * r * sc, Y(i / vz))); g.stroke(); }
    for (const b of bodyEditoru(q)) {
      g.beginPath(); g.arc(X(b.r), Y(b.s), b.druh === 'bod' ? 5.5 : 6.5, 0, Math.PI * 2);
      g.fillStyle = b.druh === 'bod' ? css('--accent') : css('--bg-elevated'); g.fill();
      g.strokeStyle = css('--accent'); g.lineWidth = 2; g.stroke();
    }
    g.fillStyle = css('--text-muted'); g.font = '11px sans-serif';
    g.fillText('ústí', X(q.tvar.usti / 2) + 9, Y(1) + 4);
    g.fillText('hrdlo', X(STIN.odvozene(q).rHrdlo) + 9, Y(0) + 4);
    $('sKrivka').textContent = q.tvar.profil === 'vlastni' ? `vlastní, ${q.tvar.body.length} bodů` : STIN.PROFILY[q.tvar.profil].nazev.toLowerCase();
  }
  function bodMysi(e) {
    const R = ed.getBoundingClientRect(), M = edStav.mer;
    const x = e.clientX - R.left, y = e.clientY - R.top;
    return { x, y, r: Math.abs(x - M.cx) / M.sc, s: (M.y0 - y) / (M.H * M.sc) };
  }
  function najdiBod(e, q) {
    const m = bodMysi(e), M = edStav.mer;
    let nej = null, d0 = 12;
    for (const b of bodyEditoru(q)) {
      const d = Math.min(Math.hypot(M.cx + b.r * M.sc - m.x, M.y0 - b.s * M.H * M.sc - m.y), Math.hypot(M.cx - b.r * M.sc - m.x, M.y0 - b.s * M.H * M.sc - m.y));
      if (d < d0) { d0 = d; nej = b; }
    }
    return nej;
  }
  ed.addEventListener('pointerdown', e => {
    kresliEditor();                                  // aktuální měřítko (panel mohl být skrytý)
    if (!edStav.mer) return;
    const b = najdiBod(e, app.p); if (!b) return;
    e.preventDefault();
    try { ed.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
    edStav.q = STIN.kopie(app.p);
    if (b.druh === 'bod' || b.druh === 'usti' || (b.druh === 'hrdlo' && app.p.uchyt.typ !== 'fitter')) edStav.tah = b;
  });
  ed.addEventListener('pointermove', e => {
    const b = edStav.tah; if (!b || !edStav.q) return;
    const m = bodMysi(e), q = edStav.q;
    const r = Math.max(3, Math.round(m.r * 2) / 2);
    if (b.druh === 'hrdlo') q.tvar.hrdlo = Math.round(2 * r * 10) / 10;
    else if (b.druh === 'usti') q.tvar.usti = Math.round(2 * r * 10) / 10;
    else {
      const B = q.tvar.body, sMin = b.i > 0 ? B[b.i - 1][0] + 0.02 : 0.02, sMax = b.i < B.length - 1 ? B[b.i + 1][0] - 0.02 : 0.98;
      B[b.i] = [Math.round(Math.min(sMax, Math.max(sMin, m.s)) * 1000) / 1000, r];
    }
    kresliEditor();
  });
  const konecTahu = () => {
    if (edStav.tah && edStav.q) { const q = edStav.q; edStav.q = null; edStav.tah = null; app.zmen(x => { x.tvar = q.tvar; }); app.naplnFormular(); }
    edStav.q = null; edStav.tah = null;
  };
  ed.addEventListener('pointerup', konecTahu);
  ed.addEventListener('pointercancel', konecTahu);
  ed.addEventListener('dblclick', e => {
    kresliEditor();
    if (!edStav.mer) return;
    const b = najdiBod(e, app.p);
    if (b && b.druh === 'bod') { app.zmen(q => { q.tvar.body.splice(b.i, 1); }); return; }
    if (b) return;
    const m = bodMysi(e);
    if (m.s <= 0.03 || m.s >= 0.97) return;
    app.zmen(q => {
      if (q.tvar.profil !== 'vlastni') prevedNaVlastni(q);
      if (q.tvar.body.length >= STIN.MAX_BODU) return;
      q.tvar.body.push([Math.round(m.s * 1000) / 1000, Math.max(3, Math.round(m.r * 2) / 2)]);
    });
    app.naplnFormular();
  });
  new ResizeObserver(() => kresliEditor()).observe(ed);

  /* ---------- litofanie: obrázek ---------- */
  $('btnObrazek').addEventListener('click', () => $('souborObrazek').click());
  $('souborObrazek').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 480 / Math.max(bmp.width, bmp.height), Math.sqrt(120000 / (bmp.width * bmp.height)));
      const W = Math.max(2, Math.round(bmp.width * k)), Hh = Math.max(2, Math.round(bmp.height * k));
      const c = document.createElement('canvas'); c.width = W; c.height = Hh;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, Hh); g.drawImage(bmp, 0, 0, W, Hh);
      const d = g.getImageData(0, 0, W, Hh).data, px = new Uint8Array(W * Hh);
      for (let i = 0; i < px.length; i++) px[i] = Math.round(0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]);
      const data = STIN.litoZakoduj(px);
      app.zmen(q => { Object.assign(q.lito, { pouzit: true, data, sirka: W, vyska: Hh }); });
      app.naplnFormular();
    } catch (err) { Dialog.chyba('Obrázek se nepodařilo načíst: ' + (err && err.message || err)); }
  });
  function nahledObrazku() {
    p = app.p;
    const c = $('litoNahled'), L = p.lito;
    c.hidden = !L.data;
    $('btnObrazek').textContent = L.data ? '🖼 Vyměnit obrázek…' : '🖼 Vybrat obrázek…';
    if (!L.data) { $('sLito').textContent = L.pouzit ? 'chybí obrázek' : 'vypnuto'; return; }
    try {
      const s = atob(L.data), W = L.sirka, Hh = L.vyska;
      c.width = W; c.height = Hh;
      const g = c.getContext('2d'), im = g.createImageData(W, Hh);
      for (let i = 0; i < W * Hh; i++) { const v = s.charCodeAt(i); im.data[4 * i] = im.data[4 * i + 1] = im.data[4 * i + 2] = v; im.data[4 * i + 3] = 255; }
      g.putImageData(im, 0, 0);
    } catch (e) { c.hidden = true; }
    const o = STIN.odvozene(p), obvod = Math.PI * (p.tvar.hrdlo + p.tvar.usti) / 2 / L.opakovani, vys = Math.max(1, p.tvar.vyska - L.okrajDole - L.okrajNahore);
    $('sLito').textContent = L.pouzit ? `${L.sirka} × ${L.vyska} px, ${fmt(L.tMin, 1)}–${fmt(L.tMax, 1)} mm` : 'vypnuto';
    $('napLito').textContent = `Tmavá místa = tlustá stěna, světlá = tenká. Plocha pro obrázek je asi ${fmt(obvod, 0)} × ${fmt(vys, 0)} mm (poměr ${fmt(obvod / vys, 2)}), `
      + `obrázek má poměr ${fmt(L.sirka / L.vyska, 2)} – při velkém rozdílu bude roztažený.${o.lito ? ' Rozsviťte náhled (💡).' : ''}`;
  }

  /* ---------- přepočet a náhled ---------- */
  /** Díly pro náhled v montážní poloze (závěsné stínítko otočené ústím dolů), případně se žárovkou a rozsvícené. */
  function dilyNahledu() {
    if (stavZobr.tisk) return tiskDily;
    const d = model.dily.slice();
    if (stavZobr.svit) {
      if (!svetloModelu) svetloModelu = STIN.svetlo(p, model);
      d[0] = Object.assign({}, d[0], { barvy: svetloModelu.barvy });
    }
    const z = stavZobr.zarovka && STIN.zarovka(p);
    if (z) { if (stavZobr.svit) z.barvy = new Float32Array(z.poz.length).fill(1); d.push(z); }
    return p.montaz === 'dolu' ? d.map(STIN.prevrat) : d;
  }
  function ukazNahled(novyPohled) {
    $('canvas-container').classList.toggle('svit', stavZobr.svit && !stavZobr.tisk);
    $('legPrevisy').hidden = !(stavZobr.tisk && nahled.stav.previsy);
    nahled.nastav(model ? dilyNahledu() : null, { tisk: stavZobr.tisk, novyPohled, uhel: p.tisk.uhel });
  }
  /** Projekt se nemusí vejít do úložiště prohlížeče (velký obrázek litofanie) – aplikace to tiše přejde, tady se to ukáže. */
  function neulozeno() {
    try { return localStorage.getItem('webapp_stinitka_projekt') !== JSON.stringify(p); } catch (e) { return false; }
  }
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    document.querySelectorAll('#paletaProfilu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.profil === p.tvar.profil)));
    let H = STIN.kontroly(p);
    model = null; tiskDily = null; svetloModelu = null;
    try {
      model = STIN.postav(p);
      model.rozbor = STIN.rozborTisku(model.dily[0], p.tisk.uhel);
      model.poloha = STIN.polohaTisku(p, model.rozbor);
      tiskDily = STIN.tiskoveRozlozeni(model.dily, model.poloha, 1);
      H = H.concat(STIN.kontrolyModelu(p, model));
      chybaStavby = '';
    } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    const st = $('stav3d');
    st.textContent = chybaStavby || (neulozeno() ? 'Projekt se nevešel do úložiště prohlížeče (velký obrázek) – uložte ho do souboru.' : '');
    st.classList.toggle('chyba', !!st.textContent);
    ukazNahled(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxTvar', 'boxUchyt'] });
    vypisVysledky();
    souhrny();
    kresliEditor();
    $('vykres').innerHTML = model ? STIN.vykres(p, model) : '';
  }
  function souhrny() {
    const T = p.tvar, V = p.vzor, V2 = p.vzor2, u = p.uchyt, o = STIN.odvozene(p);
    TrubkyGui.souhrn('sTvar', `Ø ${fmt(2 * o.rHrdlo)}/${fmt(T.usti)} × ${fmt(T.vyska)} · stěna ${fmt(T.stena, 2)}`, true);
    TrubkyGui.souhrn('sVzor', STIN.VZORY[V.typ] + (V.typ !== 'hladky' && V.typ !== 'vlny' ? ` × ${V.pocet}` : '') + (V.zkrut ? ` · ${fmt(V.zkrut, 0)}°` : ''), V.typ !== 'hladky');
    TrubkyGui.souhrn('sVzor2', V2.typ === 'hladky' || V2.hloubka <= 0 ? 'žádný' : STIN.VZORY[V2.typ] + ` ${fmt(V2.hloubka, 1)} mm`, V2.typ !== 'hladky' && V2.hloubka > 0);
    TrubkyGui.souhrn('sOkraj', p.okraj.typ === 'rovny' ? 'rovný' : `${STIN.OKRAJE[p.okraj.typ]} × ${p.okraj.pocet}`, p.okraj.typ !== 'rovny');
    TrubkyGui.souhrn('sUchyt', u.typ === 'deska' ? `deska, otvor Ø ${fmt(o.otvor)}` : u.typ === 'fitter' ? `krček Ø ${fmt(u.fitter)}` : 'bez úchytu', u.typ !== 'zadny');
    TrubkyGui.souhrn('sZarovka', `${p.montaz === 'dolu' ? 'závěsné' : 'na rameni'} · ${STIN.ZAROVKY[p.zarovka.typ].nazev}`, true);
    $('sTisk').textContent = model ? (model.poloha === 'usti' ? 'ústím dolů' : 'hrdlem dolů') : '';
  }
  const box = G3D.dlazdice;
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', 'nelze sestavit', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = STIN.MATERIALY[p.tisk.material], k = model.kontrola, b = k.bbox;
    const sx = b[3] - b[0], sy = b[4] - b[1], sz = b[5] - b[2];
    const V = k.objem * p.tisk.kusu, g = V / 1000 * mat.hustota, metru = V / (Math.PI * 0.875 * 0.875) / 1000;
    const minut = Math.round((V / 4 + 60 * p.tisk.kusu) / 60);   // hrubě: tenké stěny ~4 mm³/s
    if (!svetloModelu) svetloModelu = STIN.svetlo(p, model);
    const cl = STIN.cloneni(p);
    let h = box('Rozměry', `${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)} mm`, 'š × h × v');
    h += box('Objem', `${fmt(V / 1000, 2)} cm³`, p.tisk.kusu > 1 ? `${p.tisk.kusu} kusy` : 'plná stěna');
    h += box('Hmotnost', `${fmt(g, g < 10 ? 1 : 0)} g`, `${mat.nazev}${p.tisk.kusu > 1 ? `, ${p.tisk.kusu} kusy` : ''}, plná stěna`);
    h += box('Filament', `${fmt(metru, 2)} m`, 'průměr 1,75 mm');
    h += box('Doba tisku', `≈ ${minut < 60 ? minut + ' min' : fmt(minut / 60, 1) + ' h'}`, 'hrubý odhad');
    h += box('Stěna', `${fmt(model.stena.min, 2)}–${fmt(model.stena.max, 2)} mm`, STIN.odvozene(p).lito ? 'vodorovně, s litofanií' : 'vodorovně; kolmo k povrchu ' + fmt(p.tvar.stena, 2) + ' mm');
    h += box('Propustnost stěny', `≈ ${fmt(svetloModelu.propustnost * 100, 0)} %`, `${STIN.BARVY[p.tisk.barva].nazev} filament, orientačně`);
    if (cl) h += box('Clonicí úhel', cl.vycniva ? 'žárovka vyčnívá' : `${fmt(cl.uhel, 0)}°`, 'pod tímto úhlem od roviny ústí není holá žárovka vidět', cl.vycniva || cl.uhel < 15 ? 'chyba-t' : '');
    h += box('Tisková poloha', model.poloha === 'usti' ? 'ústím dolů' : 'hrdlem dolů', p.tisk.poloha === 'auto' ? 'zvoleno automaticky' : 'zadáno ručně');
    el.innerHTML = h;
    karta.innerHTML = `<div class="titul">${STIN.PROFILY[p.tvar.profil].nazev} · ${STIN.VZORY[p.vzor.typ]}</div><b>${fmt(sx)} × ${fmt(sz)}</b> mm · <b>${fmt(g, g < 10 ? 1 : 0)}</b> g ${mat.nazev}`;
    const tesna = k.uzavrena && k.teles === 1;
    $('vSit').innerHTML = box('Síť', tesna ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${model.N} × ${model.K} vzorků, ${model.cas} ms${k.zKonstrukce ? ', uzavřená z konstrukce' : ''}`, tesna ? 'ok-t' : 'chyba-t');
  }

  /* ---------- nabídky, export, výkres ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_stinitka_gui', pohled: j => nahled.pohled(j) });
  for (const v of STIN.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => {
      const q = STIN.predvolba(v.id), a = app.p;
      q.tisk = Object.assign(STIN.kopie(a.tisk), { poloha: 'auto' }, v.p.tisk || {}); q.kvalita = a.kvalita;
      if (q.lito.pouzit && a.lito.data) Object.assign(q.lito, { data: a.lito.data, sirka: a.lito.sirka, vyska: a.lito.vyska });   // obrázek zůstane
      app.nahrad(q);
    });
    $('seznamPredvoleb').appendChild(b);
  }
  function kusy() {
    if (!model) { Dialog.chyba(chybaStavby || 'Model není k dispozici.'); return null; }
    return STIN.tiskoveRozlozeni(model.dily, model.poloha, app.p.tisk.kusu, 5, app.p.tisk.podlozka);
  }
  function exportStl() { const d = kusy(); if (d) app.stahni(KRAB.stlBinarni(d, 'stinitka - github_site'), app.jmeno('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { const d = kusy(); if (d) app.stahni(KRAB.soubor3mf(d, app.p.nazev || 'Stínítko'), app.jmeno('.3mf'), 'model/3mf'); });
  $('btnVaza').addEventListener('click', () => {
    try {
      const q = app.p, m = STIN.postav(q, { vaza: true });
      const d = STIN.tiskoveRozlozeni(m.dily, 'hrdlo', q.tisk.kusu, 5, q.tisk.podlozka);
      app.stahni(KRAB.stlBinarni(d, 'stinitka vaza - github_site'), app.jmeno('_vaza.stl'), 'model/stl');
      if (STIN.odvozene(q).lito) Dialog.info('Pozor: v režimu váza se tiskne jen vnější obvod, litofanie (tloušťka stěny) se v něm neprojeví.');
    } catch (e) { Dialog.chyba('Těleso pro režim váza nelze sestavit: ' + (e && e.message || e)); }
  });
  const svg = () => (model ? STIN.vykres(app.p, model) : '');
  const stahniSvg = () => { if (model) app.stahni(svg(), app.jmeno('_vykres.svg'), 'image/svg+xml'); };
  const tiskniVykres = () => { if (!model) return; $('tiskVykres').innerHTML = svg(); window.print(); };
  $('btnVykres').addEventListener('click', () => TrubkyGui.otevriZalozku('vykres'));
  $('btnSvg').addEventListener('click', stahniSvg); $('btnSvg2').addEventListener('click', stahniSvg);
  $('btnTiskVykres').addEventListener('click', tiskniVykres); $('btnTiskVykres2').addEventListener('click', tiskniVykres);

  /* ---------- Zobrazení ---------- */
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tTisk', h => { stavZobr.tisk = h; if (model) ukazNahled(true); else $('legPrevisy').hidden = true; });
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tSvit', h => { stavZobr.svit = h; if (model) ukazNahled(false); });
  app.prepinac('tZarovka', h => { stavZobr.zarovka = h; if (model) ukazNahled(false); });

  /* ---------- start ---------- */
  app.start();
  window.STIN_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, naplnFormular: app.naplnFormular, prepocitej, nahled, stavZobr, ukazNahled, edStav, kresliEditor, app };
})();
