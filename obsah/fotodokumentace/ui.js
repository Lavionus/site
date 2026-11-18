/* Stránka 📸 Fotodokumentace – fotky ve spisu, vrstvy anotací na plátně, měřítko, fototabulka.
   Data: entity foto spisu (data.anotace, data.meritko, typ, poradi, kdy, autor, exif, w, h) + soubor (blob).
   Značky stop jsou napojené na entity stopa a vazbou foto → stopa (tyka_se, popis POPIS_VAZBY). */
(function () {
  'use strict';
  const S = window.SPIS, J = window.FOTODOK, U = window.FOTODOK_UKAZKA, F = window.FOTOMER, el = S.el;
  const $ = id => document.getElementById(id);
  const NASTROJ = J.NASTROJ;
  const ne = (tag, text, atr) => el(tag, Object.assign({ 'data-i18n': 'ne', text: text == null ? '' : String(text) }, atr || {}));
  const chyba = e => Dialog.chyba(e && e.message ? e.message : String(e));

  let pripad = null, fotky = [], stopy = [], akt = null, obraz = null;
  let an = [], mer = null, vyber = null, nastroj = 'vyber', rozprac = null, tah = null;
  const pohled = { z: 1, x: 0, y: 0, pasuje: true };
  const his = J.historie();
  const nahledy = new Map();
  const cv = $('kresba'), ctx = cv.getContext('2d'), platno = $('platno');

  const autorVychozi = () => { try { return localStorage.getItem(J.KLIC_AUTOR) || ''; } catch (e) { return ''; } };
  const ulozAutora = v => { try { localStorage.setItem(J.KLIC_AUTOR, v); } catch (e) { /* bez úložiště */ } };
  const mapaStop = () => Object.fromEntries(stopy.map(s => [s.id, s]));

  /* ================= kreslení (fotodokumentace/kresba.js – sdílí ho i karta spisu) ================= */
  const K = window.FOTODOK_KRESBA, MERENI = K.MERENI, MERITKO = K.MERITKO;
  const kresliVse = (c, img, anot, m, o) => K.kresliVse(c, img, anot, m, Object.assign({ stopy: mapaStop() }, o));

  /* ================= editor: pohled, vykreslení ================= */
  let dpr = 1;
  function velikostPlatna() {
    const r = platno.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    return r;
  }
  function prizpusob() {
    if (!obraz) return;
    const r = velikostPlatna();
    pohled.z = Math.min(r.width / obraz.width, r.height / obraz.height) * 0.96;
    pohled.x = (r.width - obraz.width * pohled.z) / 2; pohled.y = (r.height - obraz.height * pohled.z) / 2;
    pohled.pasuje = true;
    kresli();
  }
  function zoom(k, sx, sy) {
    if (!obraz) return;
    const r = platno.getBoundingClientRect();
    if (sx === undefined) { sx = r.width / 2; sy = r.height / 2; }
    const z = Math.max(0.02, Math.min(40, pohled.z * k)), f = z / pohled.z;
    pohled.x = sx - (sx - pohled.x) * f; pohled.y = sy - (sy - pohled.y) * f; pohled.z = z; pohled.pasuje = false;
    kresli();
  }
  const naObr = (sx, sy) => [(sx - pohled.x) / pohled.z, (sy - pohled.y) / pohled.z];
  const barvaVyberu = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b82f6';
  let cekaKresba = false;
  function kresli() {
    if (cekaKresba) return;
    cekaKresba = true;
    requestAnimationFrame(kresliHned);
  }
  function kresliHned() {
    cekaKresba = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (!obraz) return;
    ctx.setTransform(dpr * pohled.z, 0, 0, dpr * pohled.z, dpr * pohled.x, dpr * pohled.y);
    ctx.imageSmoothingEnabled = pohled.z < 2;
    const nahled = rozprac && !rozprac.mer && J.DRUHY[rozprac.druh] && rozprac.b.length >= 2 ? an.concat([rozprac]) : an;
    kresliVse(ctx, obraz, nahled, mer, { editor: true, z: pohled.z });
    // rozpracované body (úhel, plocha, perspektiva) a úchopy vybrané anotace
    const z = pohled.z, akc = barvaVyberu();
    const uchop = (p, plny) => { ctx.beginPath(); ctx.arc(p[0], p[1], 6 / z, 0, 7); ctx.fillStyle = plny ? akc : '#ffffff'; ctx.fill(); ctx.lineWidth = 2 / z; ctx.strokeStyle = plny ? '#ffffff' : akc; ctx.stroke(); };
    if (rozprac) {
      if (rozprac.b.length > 1 && (rozprac.mer || rozprac.druh === 'plocha' || rozprac.druh === 'uhel')) {
        ctx.beginPath(); rozprac.b.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
        ctx.strokeStyle = rozprac.mer ? MERITKO : MERENI; ctx.lineWidth = 2 / z; ctx.stroke();
      }
      rozprac.b.forEach(p => uchop(p, true));
    }
    const a = an.find(x => x.id === vyber);
    if (a) {
      const [x0, y0, x1, y1] = J.obal(a), o = 8 / z;
      ctx.setLineDash([5 / z, 4 / z]); ctx.strokeStyle = akc; ctx.lineWidth = 1.5 / z; ctx.strokeRect(x0 - o, y0 - o, x1 - x0 + 2 * o, y1 - y0 + 2 * o); ctx.setLineDash([]);
      a.b.forEach(p => uchop(p, false));
    }
    if (mer && nastroj === 'vyber' && !rozprac) mer.b.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 4 / z, 0, 7); ctx.fillStyle = MERITKO; ctx.fill(); });
  }

  /* ================= nástroje a myš ================= */
  const RADY = {
    vyber: 'Klikněte na anotaci (tažením posun, úchopy mění tvar). Tažení prázdného místa posouvá pohled, kolečko přibližuje.',
    znacka: 'Klikněte na místo stopy – pak vyberte stopu ze spisu.',
    sipka: 'Táhněte od začátku ke hrotu šipky.', kruh: 'Táhněte přes oblast kroužku.', obdelnik: 'Táhněte přes oblast obdélníku.',
    text: 'Klikněte, kam se má text napsat.', vyrez: 'Táhněte přes detail – lupa se objeví vedle (jde posunout).',
    zakryt: 'Táhněte přes obličej nebo SPZ – ve fotce se zakryje, originál zůstane.',
    delka: 'Táhněte od jednoho konce ke druhému.', uhel: 'Klikněte 3 body: rameno – vrchol – rameno.',
    plocha: 'Klikejte body obrysu, dokončete dvojklikem nebo Enter.',
    kalibrace: 'Táhněte po pravítku mezi dvěma body známé vzdálenosti (třeba 0 a 10 cm).',
    perspektiva: 'Klikněte 4 rohy obdélníku známých rozměrů po obvodu (1→2 šířka, 2→3 výška).'
  };
  const DVA_BODY = ['sipka', 'kruh', 'obdelnik', 'vyrez', 'zakryt', 'delka', 'kalibrace'];
  function nastavNastroj(n) {
    nastroj = n; rozprac = null; tah = null;
    document.querySelectorAll('#nastroje [data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === n)));
    $('rada').textContent = RADY[n] || '';
    cv.style.cursor = n === 'vyber' ? 'default' : 'crosshair';
    kresli();
  }
  const stav = () => ({ an: J.kopie(an), mer: mer ? J.kopie(mer) : null });
  const zapisHist = () => his.zapis(stav());
  function obnovStav(s) { if (!s) return; an = s.an; mer = s.mer; if (!an.some(a => a.id === vyber)) vyber = null; zmeneno(); }

  function najdi(p) {
    const z = pohled.z, tol = 9 / z, s = obraz ? Math.max(obraz.width, obraz.height) / 900 : 1;
    const vybrana = an.find(a => a.id === vyber);
    if (vybrana) { const h = J.zasah(vybrana, p[0], p[1], tol, 17 * s); if (h) return { a: vybrana, h }; }
    for (let i = an.length - 1; i >= 0; i--) {
      const a = an[i], h = J.zasah(a, p[0], p[1], tol, a.druh === 'text' ? 24 * s : 17 * s);
      if (h) return { a, h };
    }
    return null;
  }
  const pozice = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  cv.addEventListener('pointerdown', e => {
    if (!obraz || (e.button !== 0 && e.button !== 1)) return;
    cv.focus({ preventScroll: true });
    const [sx, sy] = pozice(e), p = naObr(sx, sy);
    cv.setPointerCapture(e.pointerId);
    if (e.button === 1) { tah = { druh: 'pan', sx, sy, x: pohled.x, y: pohled.y }; return; }
    if (nastroj === 'vyber') {
      if (mer) { const i = mer.b.findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) <= 8 / pohled.z); if (i >= 0) { tah = { druh: 'mer', i, puvodni: stav() }; return; } }
      const n = najdi(p);
      if (n) { vyber = n.a.id; tah = { druh: 'an', a: n.a, h: n.h, p, puvodni: stav(), pohnuto: false }; vykresliPanelAn(); }
      else { vyber = null; vykresliPanelAn(); tah = { druh: 'pan', sx, sy, x: pohled.x, y: pohled.y }; }
      kresli();
    } else if (DVA_BODY.includes(nastroj)) {
      rozprac = { druh: nastroj === 'kalibrace' ? 'delka' : nastroj, b: [p, p], mer: nastroj === 'kalibrace', efekt: 'rozmazat', k: 2.5 };
      if (nastroj === 'vyrez') rozprac.b.push(p);
      tah = { druh: 'nove', sx, sy };
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!obraz) return;
    const [sx, sy] = pozice(e), p = naObr(sx, sy);
    ukazPolohu(p);
    if (!tah) {
      if (nastroj === 'vyber') cv.style.cursor = najdi(p) ? 'move' : 'grab';
      return;
    }
    if (tah.druh === 'pan') { pohled.x = tah.x + sx - tah.sx; pohled.y = tah.y + sy - tah.sy; pohled.pasuje = false; kresli(); }
    else if (tah.druh === 'mer') { mer.b[tah.i] = p; kresli(); }
    else if (tah.druh === 'an') {
      const a = tah.a;
      if (tah.h.bod !== undefined) a.b[tah.h.bod] = p;
      else if (tah.h.lupa) { a.b[2] = [a.b[2][0] + p[0] - tah.p[0], a.b[2][1] + p[1] - tah.p[1]]; tah.p = p; }
      else { J.posun(a, p[0] - tah.p[0], p[1] - tah.p[1]); tah.p = p; }
      tah.pohnuto = true; kresli(); vykresliSeznamAn();
    } else if (tah.druh === 'nove') {
      rozprac.b[1] = p;
      if (rozprac.druh === 'vyrez') rozprac.b = J.nova('vyrez', rozprac.b.slice(0, 2), { k: 2.5 }).b;
      kresli();
    }
  });
  cv.addEventListener('pointerup', async e => {
    if (!obraz) return;
    const [sx, sy] = pozice(e), p = naObr(sx, sy), t = tah;
    tah = null;
    if (t && t.druh === 'an') {
      if (t.pohnuto) { his.zapis(t.puvodni); zmeneno(); }
      // S4: klik (bez tažení) na značku stopy otevře kartu stopy – odtud skok do deníku, náčrtu, na osu
      else if (t.a.druh === 'znacka' && t.a.stopa && stopy.some(s => s.id === t.a.stopa)) SpisKarta.otevri(t.a.stopa, { nastroj: NASTROJ });
      return;
    }
    if (t && t.druh === 'mer') { his.zapis(t.puvodni); zmeneno(); return; }
    if (t && t.druh === 'pan') return;
    if (t && t.druh === 'nove') {
      const r = rozprac; rozprac = null;
      if (Math.hypot(sx - t.sx, sy - t.sy) < 4) { kresli(); return; }
      if (r.mer) return kalibruj(r.b);
      return pridej(J.nova(r.druh, r.b.slice(0, 2)));
    }
    if (nastroj === 'znacka') {
      const id = await vyberStopu();
      if (id) pridej(J.nova('znacka', [p], { stopa: id }), true);
    } else if (nastroj === 'text') {
      const t2 = await Dialog.zeptej('Text popisku ve fotce', '');
      if (t2 && t2.trim()) pridej(J.nova('text', [p], { text: t2.trim().slice(0, 500) }));
    } else if (['uhel', 'plocha', 'perspektiva'].includes(nastroj)) {
      rozprac = rozprac || { druh: nastroj === 'perspektiva' ? null : nastroj, b: [], mer: nastroj === 'perspektiva' };
      rozprac.b.push(p);
      const n = rozprac.b.length;
      if (nastroj === 'uhel' && n === 3) { const r = rozprac; rozprac = null; return pridej(J.nova('uhel', r.b)); }
      if (nastroj === 'perspektiva' && n === 4) { const r = rozprac; rozprac = null; return perspektiva(r.b); }
      $('rada').textContent = RADY[nastroj] + ' (bod ' + n + ')';
      kresli();
    }
  });
  cv.addEventListener('dblclick', async e => {
    if (nastroj === 'plocha' && rozprac) return dokonciPlochu();
    if (nastroj !== 'vyber') return;
    const n = najdi(naObr(...pozice(e)));
    if (n && n.a.druh === 'text') upravVlastnost(n.a);   // značka: klik otevře kartu stopy, jinou stopu nabídne panel
  });
  cv.addEventListener('wheel', e => { if (!obraz) return; e.preventDefault(); const [sx, sy] = pozice(e); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, sx, sy); }, { passive: false });
  cv.addEventListener('pointerleave', () => { $('mer').textContent = ''; });

  function dokonciPlochu() {
    const r = rozprac; rozprac = null;
    // dvojklik přidá poslední bod dvakrát
    const b = r.b.filter((p, i) => !i || Math.hypot(p[0] - r.b[i - 1][0], p[1] - r.b[i - 1][1]) > 0.5);
    if (b.length >= 3) pridej(J.nova('plocha', b)); else kresli();
  }
  function ukazPolohu(p) {
    const k = mer ? J.mmNaPx(mer, p[0], p[1]) : null;
    $('mer').textContent = 'x ' + Math.round(p[0]) + ' · y ' + Math.round(p[1]) + ' px' + (k ? ' · 1 px ≈ ' + J.fmt(k, 2) + ' mm' : '');
  }

  function pridej(a, ponechatNastroj) {
    zapisHist();
    an.push(a); vyber = a.id;
    if (!ponechatNastroj) nastavNastroj('vyber');
    zmeneno();
  }
  const cisloZTextu = t => { const v = Number(String(t).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; };
  async function kalibruj(b) {
    const t = await Dialog.zeptej('Skutečná vzdálenost mezi body v milimetrech', mer && mer.druh === 'delka' ? String(mer.mm) : '100');
    nastavNastroj('vyber');
    if (t === null) return;
    const mm = cisloZTextu(t);
    const m = { druh: 'delka', b, mm, presnost: mer && mer.presnost || 1.5 };
    if (!mm || !J.meritkoPlatne(m)) return Dialog.chyba('Zadejte kladnou délku v mm a body dál od sebe.');
    zapisHist(); mer = m; zmeneno();
    Dialog.info('Měřítko nastaveno: ' + J.fmt(mm, 1) + ' mm.');
  }
  async function perspektiva(b) {
    const t = await Dialog.zeptej('Rozměry obdélníku v mm: šířka (strana 1→2) × výška (strana 2→3)', mer && mer.druh === 'obdelnik' ? mer.w + ' × ' + mer.h : '1000 × 1000');
    nastavNastroj('vyber');
    if (t === null) return;
    const m0 = /^\s*([\d\s.,]+?)\s*[x×X*]\s*([\d\s.,]+)\s*$/.exec(t);
    const w = m0 && cisloZTextu(m0[1]), h = m0 && cisloZTextu(m0[2]);
    const m = { druh: 'obdelnik', b, w, h, presnost: mer && mer.presnost || 1.5 };
    if (!w || !h || !J.meritkoPlatne(m)) return Dialog.chyba('Zadejte dva rozměry, např. „600 × 600“, a body jako rohy obdélníku po obvodu.');
    zapisHist(); mer = m; zmeneno();
    Dialog.info('Perspektiva srovnána podle obdélníku ' + J.fmt(w, 0) + ' × ' + J.fmt(h, 0) + ' mm.');
  }

  /* ================= stopy ze spisu ================= */
  function vyberStopu(aktualni) {
    const d = $('dlgStopa'), box = $('stopyVyber');
    return new Promise(hotovo => {
      let vysledek = null, nova = false;
      box.replaceChildren(...stopy.map(s => el('button', { type: 'button', class: 'tl' + (s.id === aktualni ? ' hlavni' : ''), dataset: { stopa: s.id }, onclick: () => { vysledek = s.id; d.close(); } },
        el('b', { text: 'č. ' }), ne('b', s.data.cislo || '?'), ' – ', ne('span', s.nazev))));
      if (!stopy.length) box.append(el('p', { class: 'pozn', text: 'Případ zatím nemá žádné stopy – založte novou.' }));
      $('novaStopa').onclick = () => { nova = true; d.close(); };
      d.addEventListener('close', async () => {
        if (!nova) return hotovo(vysledek);
        const max = stopy.reduce((m, s) => Math.max(m, parseInt(s.data.cislo, 10) || 0), 0);
        try {
          const e = await SpisKarta.uprav({ typ: 'stopa', data: { cislo: String(max + 1) } }, { nastroj: NASTROJ });
          if (e) stopy = await S.seznam('stopa');
          hotovo(e ? e.id : null);
        } catch (x) { chyba(x); hotovo(null); }
      }, { once: true });
      d.showModal();
    });
  }

  const synchronizujVazby = (f, anot) => J.synchronizujVazby(S, f, anot, NASTROJ);

  /* ================= ukládání ================= */
  let casovac = null, ceka = false;
  function zmeneno() { ceka = true; clearTimeout(casovac); casovac = setTimeout(ulozHned, 500); kresli(); vykresliSeznamAn(); vykresliPanelAn(); tlacitkaHistorie(); }
  async function ulozHned() {
    clearTimeout(casovac);
    if (!ceka || !akt) return;
    ceka = false;
    const f = akt, data = Object.assign({}, f.data, { anotace: an, meritko: mer || undefined });
    if (!mer) delete data.meritko;
    try {
      const e = await S.uloz({ id: f.id, typ: 'foto', nazev: f.nazev, data }, { nastroj: NASTROJ });
      if (akt && akt.id === e.id && !ceka) { akt = e; fotky = fotky.map(x => x.id === e.id ? e : x); }
      await synchronizujVazby(e, an);
    } catch (x) { chyba(x); }
  }
  function tlacitkaHistorie() {
    $('tlZpet').disabled = !his.lzeZpet; $('tlZnovu').disabled = !his.lzeZnovu; $('tlSmazat').disabled = !vyber;
  }

  /* ================= seznam fotek a panel ================= */
  function urlNahledu(f) {
    if (!nahledy.has(f.data.soubor)) nahledy.set(f.data.soubor, S.soubor(f.data.soubor).then(s => s ? URL.createObjectURL(s.blob) : '').catch(() => ''));
    return nahledy.get(f.data.soubor);
  }
  function vykresliFotky() {
    const box = $('fotky');
    box.replaceChildren(...fotky.map((f, i) => {
      const img = el('img', { alt: '', loading: 'lazy' });
      urlNahledu(f).then(u => { if (u) img.src = u; });
      return el('button', { type: 'button', class: 'nahled', 'aria-current': String(!!akt && f.id === akt.id), dataset: { id: f.id }, title: f.nazev },
        img, el('span', { class: 'c', text: String(i + 1) }), ne('span', f.nazev, { class: 'n' }), el('span', { class: 't', text: J.TYPY_SNIMKU[f.data.typ] || '' }));
    }), el('button', { type: 'button', class: 'pridat', dataset: { prikaz: 'nahrat' } }, '➕ Přidat fotky'));
    platno.classList.toggle('prazdne', !fotky.length);
    document.querySelectorAll('[data-potrebuje-foto]').forEach(b => { b.disabled = !akt; });
  }
  function vykresliPanel() {
    $('panelFoto').hidden = !akt;
    if (!akt) return;
    const d = akt.data;
    $('pNazev').value = akt.nazev; $('pTyp').value = d.typ || 'detail'; $('pPopis').value = d.popis || '';
    $('pKdy').value = d.kdy || ''; $('pAutor').value = d.autor || '';
    const ex = d.exif || {}, dl = $('pExif'), radek = (k, v, mono) => v ? [el('dt', { text: k }), ne('dd', v, mono ? { class: 'mono' } : null)] : [];
    dl.replaceChildren(
      ...radek('Rozměr', d.w ? d.w + ' × ' + d.h + ' px' : ''),
      ...radek('EXIF čas', ex.kdy ? S.formatCas(ex.kdy) : ''),
      ...radek('Přístroj', ex.pristroj), ...radek('Objektiv', ex.objektiv),
      ...radek('Ohnisko', ex.ohnisko ? J.fmt(ex.ohnisko, 1) + ' mm' + (ex.ohnisko35 ? ' (ekv. ' + ex.ohnisko35 + ' mm)' : '') : ''),
      ...radek('Orientace', ex.orientace ? J.ORIENTACE[ex.orientace] || String(ex.orientace) : ''),
      ...radek('GPS', ex.lat !== undefined ? ex.lat.toFixed(6) + ', ' + ex.lon.toFixed(6) : ''),
      ...radek('SHA-256', d.sha256, true));
    if (!d.exif) dl.append(el('dt', { text: 'EXIF' }), el('dd', { text: 'bez údajů' }));
    fotopozice();
    vykresliSeznamAn(); vykresliPanelAn();
  }
  // S5: odkaz zpět do plánku – fotopozice náčrtu, ke které je fotka připojená (náčrt zapisuje data.fotopozice; v tomto
  // prohlížeči se náčrt najde i podle značky fotopozice)
  function fotopozice() {
    const box = $('pFotopozice'), id = akt.id;
    const fp = SpisOdkazy.vyskyty(akt, { nacrty: SpisOdkazy.nacrty() }).find(x => x.nastroj === 'scene_sketch');
    box.hidden = !fp;
    if (!fp) return;
    box.replaceChildren(el('span', { text: '📐 Pořízeno z ' }), ne('span', fp.text.replace(/^(.*) – fotopozice (F\d+|F\?)$/, '$2 v náčrtu „$1“')), ' ',
      el('button', { type: 'button', class: 'tl mini', id: 'tlFotopozice', onclick: () => SpisOdkazy.otevri('scene_sketch', id, fp.extra) }, 'Ukázat v plánku'));
  }
  const IKONY = { znacka: '🔢', sipka: '↗️', kruh: '⭕', obdelnik: '▭', text: '🔤', vyrez: '🔍', zakryt: '▦', delka: '📐', uhel: '∠', plocha: '⬠' };
  function popisAn(a, ms) {
    if (a.druh === 'znacka') { const s = ms[a.stopa]; return s ? 'č. ' + (s.data.cislo || '?') + ' – ' + s.nazev : 'stopa nenalezena'; }
    if (a.druh === 'text') return a.text;
    if (a.druh === 'zakryt') return J.EFEKTY[a.efekt];
    if (a.druh === 'vyrez') return '×' + J.fmt(a.k, 1);
    if (J.MERENI.includes(a.druh)) return J.textMereni(J.zmer(a, mer, { vzorku: 200 }));
    return '';
  }
  function vykresliSeznamAn() {
    if (!akt) return;
    const ms = mapaStop();
    $('seznamAn').replaceChildren(...an.map(a => el('li', { 'aria-selected': String(a.id === vyber), dataset: { an: a.id } },
      el('span', { text: IKONY[a.druh] }), el('span', { text: J.DRUHY[a.druh].n }), ne('span', popisAn(a, ms), { class: 'h' }))));
    if (!an.length) $('seznamAn').append(el('li', { class: 'pozn', text: 'Zatím žádné anotace.' }));
    const k = mer && obraz ? J.mmNaPx(mer, obraz.width / 2, obraz.height / 2) : null;
    $('pMeritko').textContent = mer
      ? (mer.druh === 'delka' ? 'Měřítko: kalibrace délkou ' + J.fmt(mer.mm, 1) + ' mm' : 'Měřítko: srovnání perspektivy obdélníkem ' + J.fmt(mer.w, 0) + ' × ' + J.fmt(mer.h, 0) + ' mm')
        + (k ? ' (uprostřed 1 px ≈ ' + J.fmt(k, 2) + ' mm)' : '') + ', přesnost kliknutí ±' + J.fmt(mer.presnost || 1.5, 1) + ' px. Nejistota ± 2σ je orientační – nezahrnuje zkreslení objektivu ani body mimo rovinu měřítka.'
      : 'Bez měřítka – délky a plochy jsou v pixelech. Nastavte ho v nabídce 📏 Měřítko.';
  }
  function vykresliPanelAn() {
    const box = $('panelAn'), a = an.find(x => x.id === vyber);
    tlacitkaHistorie();
    if (!a) { box.replaceChildren(el('p', { class: 'pozn', text: 'Klikněte na anotaci ve fotce nebo v seznamu.' })); return; }
    const casti = [el('div', { text: IKONY[a.druh] + ' ' + J.DRUHY[a.druh].n })];
    const zmena = fn => { zapisHist(); fn(); zmeneno(); };
    if (a.druh === 'znacka') {
      const sel = el('select', { class: 'vstup', id: 'anStopa' }, el('option', { value: '', text: '– vyberte stopu –' }),
        stopy.map(s => ne('option', 'č. ' + (s.data.cislo || '?') + ' – ' + s.nazev, { value: s.id, selected: s.id === a.stopa })));
      sel.onchange = () => zmena(() => { a.stopa = sel.value || undefined; });
      casti.push(el('label', { for: 'anStopa', text: 'Stopa ve spisu' }), sel, el('div', { class: 'radek' },
        el('button', { type: 'button', class: 'tl', disabled: !a.stopa, onclick: () => SpisKarta.otevri(a.stopa, { nastroj: NASTROJ }) }, '🗂️ Karta stopy'),
        el('button', { type: 'button', class: 'tl', onclick: () => upravVlastnost(a) }, '➕ Jiná / nová stopa…')));
    } else if (a.druh === 'text' || a.druh === 'sipka') {
      const t = el('input', { class: 'vstup', id: 'anText', maxlength: 500, 'data-i18n': 'ne' });
      t.value = a.text || '';
      t.onchange = () => { if (a.druh === 'text' && !t.value.trim()) return; zmena(() => { a.text = t.value.trim() || undefined; }); };
      if (a.druh === 'text') casti.push(el('label', { for: 'anText', text: 'Text' }), t);
    } else if (a.druh === 'vyrez') {
      const r = el('input', { type: 'range', id: 'anZoom', min: 1.5, max: 6, step: 0.1, value: a.k, class: 'vstup' });
      r.onchange = () => zmena(() => { a.k = +r.value; });
      casti.push(el('label', { for: 'anZoom', text: 'Zvětšení lupy' }), r, el('p', { class: 'pozn', text: 'Lupu přesuňte tažením.' }));
    } else if (a.druh === 'zakryt') {
      const sel = el('select', { class: 'vstup', id: 'anEfekt' }, Object.entries(J.EFEKTY).map(([k, n]) => el('option', { value: k, text: n, selected: k === a.efekt })));
      sel.onchange = () => zmena(() => { a.efekt = sel.value; });
      casti.push(el('label', { for: 'anEfekt', text: 'Efekt' }), sel, el('p', { class: 'pozn', text: 'Zakrytí je jen ve vrstvě – originální soubor ve spisu zůstává nezměněný. Fototabulka obsahuje už zakrytý obraz.' }));
    } else if (J.MERENI.includes(a.druh)) {
      casti.push(el('p', { class: 'h', 'data-i18n': 'ne', text: popisAn(a, mapaStop()) }));
      if (!mer && a.druh !== 'uhel') casti.push(el('p', { class: 'pozn', text: 'Pro milimetry nastavte měřítko.' }));
    }
    casti.push(el('div', { class: 'radek' }, el('button', { type: 'button', class: 'tl nebezpecne', onclick: smazatAn }, '🗑️ Smazat')));
    box.replaceChildren(...casti);
  }
  async function upravVlastnost(a) {
    if (a.druh === 'text') {
      const t = await Dialog.zeptej('Text popisku ve fotce', a.text);
      if (t && t.trim()) { zapisHist(); a.text = t.trim().slice(0, 500); zmeneno(); }
    } else if (a.druh === 'znacka') {
      const id = await vyberStopu(a.stopa);
      if (id) { zapisHist(); a.stopa = id; zmeneno(); }
    }
  }
  function smazatAn() {
    if (!vyber) return;
    zapisHist(); an = an.filter(a => a.id !== vyber); vyber = null; zmeneno();
  }

  /* ================= načtení případu a fotek ================= */
  async function nacti() {
    try {
      const id = S.aktivni();
      pripad = id ? await S.pripad(id) : null;
      $('chybaUloziste').hidden = true;
    } catch (e) {
      $('chybaUloziste').textContent = e.message; $('chybaUloziste').hidden = false;
      $('uvod').hidden = $('prace').hidden = true;
      return;
    }
    $('uvod').hidden = !!pripad || !$('tabulka').hidden;
    $('prace').hidden = !pripad || !$('tabulka').hidden;
    document.querySelectorAll('[data-potrebuje-pripad]').forEach(b => { b.disabled = !pripad; });
    if (!pripad) { akt = null; obraz = null; fotky = []; $('tabulka').hidden = true; vykresliFotky(); return; }
    await nactiSeznam();
  }
  async function nactiSeznam() {
    fotky = J.seradit(await S.seznam('foto'));
    stopy = await S.seznam('stopa');
    if (akt && !fotky.some(f => f.id === akt.id)) { akt = null; obraz = null; }
    if (akt && !ceka) {          // změna z jiné záložky
      const nova = fotky.find(f => f.id === akt.id);
      if (nova.upraveno !== akt.upraveno) { akt = nova; an = J.cisti(nova.data.anotace); mer = J.cistiMeritko(nova.data.meritko); his.vymaz(); vykresliPanel(); }
    }
    vykresliFotky();
    if (!akt && fotky.length) await otevriFoto(fotky[0].id);
    else { vykresliPanel(); kresli(); }
  }
  async function otevriFoto(id) {
    await ulozHned();
    const f = fotky.find(x => x.id === id);
    if (!f) return;
    akt = f; vyber = null; rozprac = null; his.vymaz();
    an = J.cisti(f.data.anotace); mer = J.cistiMeritko(f.data.meritko);
    vykresliFotky(); vykresliPanel();
    try {
      const s = await S.soubor(f.data.soubor);
      if (!s) throw new Error('Soubor fotky ve spisu chybí.');
      const bmp = await createImageBitmap(s.blob);
      if (akt !== f) { bmp.close(); return; }
      if (obraz && obraz.close) obraz.close();
      obraz = bmp;
    } catch (e) { obraz = null; chyba(e.message && /chybí/.test(e.message) ? e : new Error('Fotku nejde zobrazit (' + (e.message || e) + ').')); }
    prizpusob(); tlacitkaHistorie();
  }
  async function presun(smer) {
    if (!akt) return;
    await ulozHned();
    const i = fotky.findIndex(f => f.id === akt.id), j = i + smer;
    if (j < 0 || j >= fotky.length) return;
    try {
      const nove = fotky.map((f, k) => k === i ? fotky[j] : k === j ? fotky[i] : f);
      for (let k = 0; k < nove.length; k++) if (nove[k].data.poradi !== k + 1) {
        const e = await S.uloz({ id: nove[k].id, typ: 'foto', nazev: nove[k].nazev, data: Object.assign({}, nove[k].data, { poradi: k + 1 }) }, { nastroj: NASTROJ });
        if (e.id === akt.id) akt = e;
      }
      await nactiSeznam();
    } catch (x) { chyba(x); }
  }

  /* ================= přidání fotek ================= */
  async function zajistiSpis() {
    if (pripad) return true;
    const dnes = new Date().toLocaleDateString('cs-CZ');
    const n = await Dialog.zeptej('Fotky se ukládají jen do spisu případu (ať nevznikají dvě oddělená úložiště). Název nového případu:', 'Fotodokumentace ' + dnes);
    if (n === null || !n.trim()) return false;
    try { const p = await S.zalozPripad({ nazev: n }, { nastroj: NASTROJ }); await S.otevri(p.id); pripad = p; return true; }
    catch (e) { chyba(e); return false; }
  }
  async function pridejSoubory(seznam) {
    const obr = [...seznam].filter(f => /^image\//.test(f.type));
    if (!obr.length) return Dialog.chyba('Vložené soubory nejsou obrázky.');
    if (!(await zajistiSpis())) return;
    await ulozHned();
    let nove = 0, dup = 0, posledni = null;
    for (const f of obr) {
      if (f.size > 200 * 1024 * 1024) { Dialog.chyba('Soubor je větší než 200 MB.'); continue; }
      let bmp;
      try { bmp = await createImageBitmap(f); } catch (e) { Dialog.chyba('Obrázek nejde načíst: ' + (f.name || '')); continue; }
      try {
        const exif = J.exifZBajtu(await f.arrayBuffer());
        const s = await S.ulozSoubor(f, { nazev: f.name || 'foto' });
        const byla = fotky.find(x => x.data.sha256 === s.sha256);
        if (byla) { dup++; posledni = byla; continue; }
        const data = { soubor: s.id, sha256: s.sha256, typ: fotky.length ? 'detail' : 'prehled', poradi: J.dalsiPoradi(fotky), autor: autorVychozi(), w: bmp.width, h: bmp.height };
        if (exif) { data.exif = exif; if (exif.kdy) data.kdy = exif.kdy; }
        const e = await S.uloz({ typ: 'foto', nazev: (f.name || 'Fotka').replace(/\.[^.]+$/, '').slice(0, 300) || 'Fotka', data }, { nastroj: NASTROJ });
        fotky.push(e); posledni = e; nove++;
      } catch (x) { chyba(x); } finally { bmp.close(); }
    }
    await nactiSeznam();
    if (posledni) await otevriFoto(posledni.id);
    if (nove || dup) Dialog.info((nove ? 'Uloženo do spisu: ' + nove + ' fotek.' : '') + (dup ? ' Už ve spisu bylo (stejný otisk): ' + dup + '.' : ''));
  }
  $('vstupFotky').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) pridejSoubory(f); });
  $('vstupFoto').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) pridejSoubory(f); });
  document.addEventListener('paste', e => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const f = [...((e.clipboardData && e.clipboardData.files) || [])].filter(x => /^image\//.test(x.type));
    if (f.length) { e.preventDefault(); pridejSoubory(f); }
  });
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); platno.classList.add('tahne'); } });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) platno.classList.remove('tahne'); });
  document.addEventListener('drop', e => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault(); platno.classList.remove('tahne'); pridejSoubory(e.dataTransfer.files);
  });

  /* ================= modelový případ ================= */
  async function ukazka(tise) {
    try {
      await ulozHned();
      const r = await S.zalozModelovy(window.MODELOVY_PRIPAD, { nastroj: 'modelovy-pripad' });
      await S.otevri(r.pripad);
      const pridano = await U.zaloz(S, J, r.pripad);
      akt = null;
      await nacti();
      if (tise !== true) Dialog.info(pridano ? 'Modelový případ 17/2026: přidány ' + pridano + ' ukázkové fotky s anotacemi.' : 'Ukázkové fotky modelového případu už ve spisu jsou – otevřeny beze změn.');
      return pridano;
    } catch (e) { chyba(e); }
  }

  /* ================= fototabulka ================= */
  async function vystup(f, max) {
    const s = await S.soubor(f.data.soubor);
    if (!s) return null;
    const bmp = await createImageBitmap(s.blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d'); g.scale(k, k);
    kresliVse(g, bmp, J.cisti(f.data.anotace), J.cistiMeritko(f.data.meritko), { stopy: mapaStop() });
    bmp.close();
    return c.toDataURL('image/jpeg', 0.9);
  }
  async function tabulka() {
    await ulozHned();
    if (!pripad) return;
    $('uvod').hidden = $('prace').hidden = true; $('tabulka').hidden = false;
    if (!$('tAutor').value) $('tAutor').value = autorVychozi();
    const obsah = $('tabObsah');
    obsah.replaceChildren(el('p', { class: 'pozn', text: 'Připravuji fototabulku…' }));
    const D = J.fototabulka(pripad, fotky, stopy, { autor: $('tAutor').value.trim(), vyhotoveno: new Date().toLocaleDateString('cs-CZ') });
    const t = D.titul, radek = (k, v) => v ? el('tr', {}, el('td', { text: k }), ne('td', v)) : null;
    const titul = el('section', { class: 'list' }, el('h2', { text: 'FOTOTABULKA' }),
      el('table', { class: 'titul' }, el('tbody', {},
        radek('Číslo jednací', t.cislo), radek('Věc', t.nazev), radek('Popis', t.popis),
        el('tr', {}, el('td', { text: 'Počet snímků' }), ne('td', t.pocet)),
        radek('Pořízeno', t.od ? S.formatCas(t.od) + (t.do && t.do !== t.od ? ' – ' + S.formatCas(t.do) : '') : ''),
        radek('Vyhotovil', t.autor), radek('Datum vyhotovení', t.vyhotoveno))),
      el('p', { class: 'pozn-t', text: 'Snímky jsou očíslované v pořadí dokumentace. Žluté číslované značky odkazují na stopy spisu; zakrytá místa jsou upravena jen ve fototabulce, originální soubory zůstávají beze změny a jsou doloženy otiskem SHA-256.' }));
    const listSnimku = el('section', { class: 'list' });
    for (const sn of D.snimky) {
      const f = fotky.find(x => x.id === sn.id), src = f ? await vystup(f, 1600).catch(() => null) : null;
      const p = el('div', { class: 'popisek' },
        el('div', {}, el('b', { text: 'Snímek č. ' }), ne('b', sn.cislo), sn.typNazev ? el('span', { text: ' – ' + sn.typNazev + ' snímek' }) : null),
        ne('div', sn.nazev, { style: 'font-weight:600' }), sn.popis ? ne('div', sn.popis) : null,
        el('div', {}, el('span', { text: 'Pořízeno: ' }), ne('span', sn.kdy ? S.formatCas(sn.kdy) : '–'), el('span', { text: ' · Autor: ' }), ne('span', sn.autor || '–')),
        sn.stopy.length ? el('div', {}, el('span', { text: 'Stopy: ' }), ne('span', sn.stopy.map(c => 'č. ' + c).join(', '))) : null,
        ...sn.detaily.map(d => el('div', {}, el('span', { text: 'Detail stopy ' }), ne('span', 'č. ' + d.stopa), el('span', { text: ' → snímek ' }), ne('span', d.snimky.map(c => 'č. ' + c).join(', ')))),
        sn.meritko ? el('div', {}, el('span', { text: 'Měřítko: ' }), ne('span', sn.meritko)) : null,
        ...sn.mereni.map(m => el('div', {}, el('span', { text: m.nazev + ': ' }), ne('span', m.text))),
        sn.sha256 ? el('div', { class: 'mal' }, el('span', { text: 'SHA-256 originálu: ' }), ne('span', sn.sha256)) : null);
      listSnimku.append(el('div', { class: 'snimek', dataset: { cislo: sn.cislo } }, src ? el('img', { src, alt: 'Snímek ' + sn.cislo }) : el('p', { text: 'Soubor chybí.' }), p));
    }
    if (!D.snimky.length) listSnimku.append(el('p', { text: 'Případ zatím nemá žádné fotky.' }));
    const listy = [titul, listSnimku];
    if ($('tMeritka').checked && F) {
      const m = el('div', { class: 'meritka', 'data-i18n': 'ne' });
      // SVG z FOTOMER: texty escapuje jádro foto_meritka (svgPrvek → esc)
      m.innerHTML = F.svg(F.meritkoL({ rameno: 100, sirka: 25, popisek: (pripad.cislo || '').slice(0, 40) })) + F.svg(F.pravitko({ od: 0, do: 150, sirka: 20 }));
      listy.push(el('section', { class: 'list' }, el('h3', { text: 'Měřítka k vytištění a přiložení do záběru' }), m,
        el('p', { class: 'pozn-t', text: 'Tiskněte ve skutečné velikosti (100 %, bez „přizpůsobit stránce“) a po vytištění ověřte pravítkem, že 100 mm měří 100 mm. Měřítko pokládejte do roviny stopy, fotografujte kolmo.' })));
    }
    obsah.replaceChildren(...listy);
    return D;
  }

  /* ================= příkazy, lišta, klávesnice ================= */
  const PRIKAZY = {
    nahrat() { $('vstupFotky').click(); },
    vyfotit() { $('vstupFoto').click(); },
    ukazka,
    async novyPripad() {
      const n = await Dialog.zeptej('Název nového případu', '');
      if (n === null || !n.trim()) return;
      try { const p = await S.zalozPripad({ nazev: n }, { nastroj: NASTROJ }); await S.otevri(p.id); } catch (e) { chyba(e); }
    },
    kartaFoto() { if (akt) ulozHned().then(() => SpisKarta.otevri(akt.id, { nastroj: NASTROJ })); },
    async smazatFoto() {
      if (!akt) return;
      if (!(await Dialog.potvrd('Smazat fotku „' + akt.nazev + '“ ze spisu? Zůstane v historii spisu a jde obnovit na stránce Spis případu.', { ok: 'Smazat' }))) return;
      try { await ulozHned(); await S.smaz(akt.id, { nastroj: NASTROJ }); akt = null; obraz = null; await nactiSeznam(); } catch (e) { chyba(e); }
    },
    nastroj(b) { if (akt && obraz) nastavNastroj(b.dataset.nastroj); },
    async presnost() {
      if (!mer) return Dialog.info('Nejdřív nastavte měřítko.');
      const t = await Dialog.zeptej('Přesnost kliknutí – směrodatná odchylka v px obrázku (obvykle 1–3; u neostré hrany víc)', String(mer.presnost || 1.5));
      const v = t === null ? null : cisloZTextu(t);
      if (v && v <= 50) { zapisHist(); mer.presnost = v; zmeneno(); }
    },
    zrusMeritko() { if (mer) { zapisHist(); mer = null; zmeneno(); } },
    zpet() { obnovStav(his.zpet(stav())); },
    znovu() { obnovStav(his.znovu(stav())); },
    smazatAn,
    pribliz() { zoom(1.25); }, oddal() { zoom(1 / 1.25); }, prizpusob,
    tabulka,
    zpetKUpravam() { $('tabulka').hidden = true; nacti().then(prizpusob); },
    tisk() { window.print(); },
    napoveda() { $('dlgNapoveda').showModal(); },
    nahoru() { presun(-1); }, dolu() { presun(1); }
  };

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
    if (b && !b.disabled) { zavriNabidky(); return PRIKAZY[b.dataset.prikaz](b); }
    const t = e.target.closest('#nastroje [data-nastroj]');
    if (t) return PRIKAZY.nastroj(t);
    if (!e.target.closest('.nabidka')) zavriNabidky();
    const n = e.target.closest('#fotky .nahled');
    if (n) return otevriFoto(n.dataset.id);
    const li = e.target.closest('#seznamAn li[data-an]');
    if (li) { vyber = li.dataset.an; nastavNastroj('vyber'); vykresliSeznamAn(); vykresliPanelAn(); }
  });
  document.querySelectorAll('[data-zavrit]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  // údaje snímku z panelu
  function udaj(id, fn) {
    $(id).addEventListener('change', () => { if (!akt) return; fn($(id).value); ceka = true; ulozHned().then(vykresliFotky); });
  }
  udaj('pNazev', v => { if (v.trim()) akt.nazev = v.trim(); });
  udaj('pTyp', v => { akt.data.typ = v; });
  udaj('pPopis', v => { akt.data.popis = v; });
  udaj('pKdy', v => { akt.data.kdy = v || undefined; });
  udaj('pAutor', v => { akt.data.autor = v; if (v.trim()) ulozAutora(v.trim()); });
  $('tAutor').addEventListener('change', () => { if ($('tAutor').value.trim()) ulozAutora($('tAutor').value.trim()); tabulka(); });
  $('tMeritka').addEventListener('change', tabulka);
  // pořadí snímků
  $('panelFoto').prepend(el('div', { class: 'radek', style: 'margin-bottom:4px' },
    el('button', { type: 'button', class: 'tl', dataset: { prikaz: 'nahoru' }, title: 'Posunout snímek dřív' }, '↑ Dřív'),
    el('button', { type: 'button', class: 'tl', dataset: { prikaz: 'dolu' }, title: 'Posunout snímek později' }, '↓ Později')));

  const KLAVESY = { v: 'vyber', z: 'znacka', s: 'sipka', k: 'kruh', o: 'obdelnik', t: 'text', l: 'vyrez', b: 'zakryt', d: 'delka', u: 'uhel', p: 'plocha' };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    if (e.target.closest('input, textarea, select, dialog') || document.querySelector('dialog[open]') || !akt || $('prace').hidden) return;
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k === 'z') { e.preventDefault(); return e.shiftKey ? PRIKAZY.znovu() : PRIKAZY.zpet(); }
    if (ctrl && k === 'y') { e.preventDefault(); return PRIKAZY.znovu(); }
    if (ctrl || e.altKey) return;
    if (e.key === 'Escape') { if (rozprac) { rozprac = null; kresli(); } else { vyber = null; vykresliPanelAn(); vykresliSeznamAn(); nastavNastroj('vyber'); } return; }
    if (e.key === 'Enter' && nastroj === 'plocha' && rozprac) return dokonciPlochu();
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return smazatAn(); }
    if (e.key.startsWith('Arrow') && vyber) {
      e.preventDefault();
      const a = an.find(x => x.id === vyber), d = (e.shiftKey ? 10 : 1) / pohled.z;
      zapisHist(); J.posun(a, e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0); zmeneno();
      return;
    }
    if (e.key === '+' || e.key === '=') return zoom(1.25);
    if (e.key === '-') return zoom(1 / 1.25);
    if (e.key === '0') return prizpusob();
    if (KLAVESY[k] && obraz) nastavNastroj(KLAVESY[k]);
  });

  new ResizeObserver(() => { if (pohled.pasuje) prizpusob(); else { velikostPlatna(); kresli(); } }).observe(platno);
  addEventListener('resize', zavriNabidky);
  addEventListener('beforeunload', () => { if (ceka) ulozHned(); });
  addEventListener('pagehide', () => { if (ceka) ulozHned(); });

  // synchronizace se spisem (jiné záložky, karta stopy, výběr případu)
  let cekaNacteni = null;
  S.odebirej(u => {
    if (u.druh === 'aktivni' || u.druh === 'pripad' || u.druh === 'import') { clearTimeout(cekaNacteni); cekaNacteni = setTimeout(async () => { if (u.druh === 'aktivni') { await ulozHned(); akt = null; } nacti(); }, 50); return; }
    if (!pripad || u.pripad !== pripad.id) return;
    if (u.druh === 'entita' && u.typ === 'stopa') { S.seznam('stopa').then(s => { stopy = s; kresli(); vykresliSeznamAn(); vykresliPanelAn(); }); return; }
    if (u.druh === 'entita' && u.typ === 'foto' && !u.mistni) { clearTimeout(cekaNacteni); cekaNacteni = setTimeout(nactiSeznam, 50); }
  });
  // přepnutí spisu: rozpracované anotace (ukládají se se zpožděním 0,5 s) nejdřív uložit k fotce původního spisu
  addEventListener('storage', async e => { if (e.key === S.KLIC_AKTIVNI) { await ulozHned(); akt = null; nacti(); } });

  /* S4: skok z karty – ?entita=<foto> otevře fotku, ?entita=<stopa> (nebo &stopa=) vybere značku stopy */
  async function skok(p) {
    const e = await S.entita(p.entita).catch(() => null);
    const stopa = p.stopa || (e && e.typ === 'stopa' ? e.id : null);
    let foto = e && e.typ === 'foto' ? e.id : null;
    if (!foto && stopa) { const f = fotky.find(x => (x.data.anotace || []).some(a => a.druh === 'znacka' && a.stopa === stopa)); foto = f && f.id; }
    if (!foto || !fotky.some(f => f.id === foto)) return;
    $('tabulka').hidden = true; $('uvod').hidden = true; $('prace').hidden = false;
    if (!akt || akt.id !== foto) await otevriFoto(foto);
    const z = stopa && an.find(a => a.druh === 'znacka' && a.stopa === stopa);
    vyber = z ? z.id : null; nastavNastroj('vyber'); vykresliSeznamAn(); vykresliPanelAn(); kresli();
  }
  SpisOdkazy.zde(NASTROJ, skok);

  SpisVyber.vloz($('vyberMisto'), { nastroj: NASTROJ });
  nastavNastroj('vyber');
  (async () => {
    const c = await SpisOdkazy.cil();
    if (c && c.prepnuto) await new Promise(r => setTimeout(r, 150));   // přepnutí spisu nejdřív vyřídí odběr změn
    await nacti();
    if (c) await skok(c.p);
    // průvodce modelovým případem (?pripad=17): otevřít modelový spis s ukázkovými fotkami
    else if (window.ModelovyPripad && window.ModelovyPripad.aktivni) await ukazka(true);
  })();
  window.FOTODOK_APP = { PRIKAZY, pridejSoubory, otevriFoto, tabulka, ukazka, stav: () => ({ pripad: pripad && pripad.id, akt: akt && akt.id, an, mer, vyber, nastroj, pohled, fotky: fotky.map(f => f.id) }), ulozHned, naObr, kresliVse };
})();
