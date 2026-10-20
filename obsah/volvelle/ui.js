/* ============================================================
   Volvelle – uživatelské rozhraní (DOM)
   Šablony a výpočty: VOLV_SABLONY (sablony.js), výstupy: VOLV_VYSTUP, 3D: VOLV_3D, editor: VOLV_EDITOR
   Stav v localStorage pod klíčem webapp_volvelle (try/catch).
   ============================================================ */
(function () {
  'use strict';
  const SB = window.VOLV_SABLONY, ST = window.VOLV_STYLY, O = window.VOLV_VYSTUP, K = window.VOLV_KRESBA, V = window.VOLV;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_volvelle';
  const PAPIRY = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
  const VYCHOZI = { sablona: 'kalendar', styl: 'historicky', bezVyplni: false, papir: 'a4', okraj: 8, prekryv: 12, zadni: false, papirW: 210, papirH: 297, p: {}, uhly: {}, vstupy: {}, rozlozeni3d: 35 };
  let stav = nacti();
  let model = null, uhly = [], aktivni = -1, pruhled = false, vedle = false, sc3d = null, nacita3d = false;

  function nacti() {
    try { const s = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (s && typeof s === 'object') return Object.assign({}, VYCHOZI, s, { p: s.p || {}, uhly: s.uhly || {}, vstupy: s.vstupy || {} }); } catch (e) { /* poškozený stav – výchozí */ }
    return JSON.parse(JSON.stringify(VYCHOZI));
  }
  let casUlozeni = 0;
  function uloz() { clearTimeout(casUlozeni); casUlozeni = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* plné úložiště / soukromé okno */ } }, 250); }
  const sb = () => SB.SABLONY[stav.sablona] || SB.SABLONY.kalendar;
  const parametry = () => (stav.p[stav.sablona] = stav.p[stav.sablona] || {});
  const vstupy = () => {
    if (!stav.vstupy[stav.sablona]) {
      const v = {}, d = new Date();
      for (const f of sb().vstupy) {
        if (f.typ === 'date') v[f.id] = SB.dnes();
        else if (f.typ === 'time') v[f.id] = stav.sablona === 'planisfera' ? '21:00' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        else if (f.vychozi != null) v[f.id] = f.vychozi;
      }
      if (stav.sablona === 'logaritmicky') Object.assign(v, { a: '2', b: '3', op: 'krat' });
      if (stav.sablona === 'prevodnik') v.hodnota = '180';
      if (stav.sablona === 'sifra') Object.assign(v, { posun: '3', smer: 's' });
      stav.vstupy[stav.sablona] = v;
    }
    return stav.vstupy[stav.sablona];
  };

  /* ---------------- sestavení modelu ---------------- */
  function sestav(zachovatUhly) {
    const p = parametry();
    if (stav.sablona === 'vlastni' && !p.vlastni) p.vlastni = JSON.parse(JSON.stringify(SB.VZOR_VLASTNI));
    model = SB.sestav(stav.sablona, p, stav.styl, { bezVyplni: stav.bezVyplni });
    const ul = stav.uhly[stav.sablona];
    if (zachovatUhly && ul && ul.length === model.vrstvy.length) uhly = ul.slice();
    else if (ul && ul.length === model.vrstvy.length) uhly = ul.slice();
    else { uhly = model.vrstvy.map(() => 0); const n = model.nastav(vstupy()); if (n) uhly = n; }
    stav.uhly[stav.sablona] = uhly;
    if (aktivni >= model.vrstvy.length || aktivni < 0 || !model.vrstvy[aktivni].otoc) aktivni = model.vrstvy.map((v) => v.otoc).lastIndexOf(true);
    kresliNahled(); popis(); tabVrstvy(); infoTisk();
    $('navod').innerHTML = '<h3>Sestavení</h3><ol>' + (model.navod || []).map((r) => `<li>${esc(r)}</li>`).join('') + '</ol>' + obecnyNavod();
    $('princip').innerHTML = window.VOLV_PRINCIP.html(stav.sablona);
    $('nadpisNahled').textContent = sb().ikona + ' ' + model.nazev;
    if (sc3d) planuj3d();
  }
  const hlaseni = (t) => { if (typeof Dialog !== 'undefined') Dialog.chyba(t); else console.warn(t); };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function obecnyNavod() {
    return `<h3>Tisk a výroba</h3><ol>
      <li>PDF tiskněte <b>v měřítku 100 %</b> (vypněte „Přizpůsobit stránce“). Kontrolní úsečka 50 mm je na každém listu, čtverec 50 × 50 mm na posledním.</li>
      <li>Vrstvy vystřihněte po plné čáře, šrafovaná okénka vyřízněte skalpelem nebo řezákem na podložce.</li>
      <li>Ve středu je kroužek pro otvor (výchozí 3 mm). Spojte nýtkem, patentkou, mosaznou rozpěrkou (split pin) nebo špendlíkem zapíchnutým do korku.</li>
      <li>Pro plotr (Cricut, Silhouette) nebo laser použijte <b>SVG plotr</b> – tisková vrstva se vytiskne, červená vlasová čára se řeže – nebo DXF s vrstvami REZ a OKNA.</li>
      <li>Oboustranný tisk: každá vrstva je přesně uprostřed listu, zadní strana proto sedí při otáčení po dlouhé i krátké hraně.</li></ol>`;
  }

  /* ---------------- náhled ---------------- */
  function obalNahledu() {
    const Rm = Math.max(...model.vrstvy.map((v) => v.R)) + 3;
    return Rm;
  }
  function kresliNahled() {
    const svg = $('nahled'), st = model.styl;
    let s = '<defs><filter id="stin" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0.5" dy="0.9" stdDeviation="0.9" flood-color="#000" flood-opacity="0.35"/></filter></defs>';
    if (vedle) {
      const L = O.rozlozeni(model.vrstvy, 10);
      svg.setAttribute('viewBox', `-4 -4 ${L.w + 8} ${L.h + 14}`);
      L.pozice.forEach((q, i) => {
        s += `<g transform="translate(${q.x} ${q.y})"><path d="${O.tvarCesta(q.v.tvar)}" fill="#000" filter="url(#stin)" opacity=".6"/>${O.svgVrstva(q.v, st, { nahled: true, id: 'n' + i })}${O.stredSvg(q.v)}<text x="0" y="${q.v.R + 6}" font-size="4" text-anchor="middle" fill="currentColor">${i + 1}. ${esc(q.v.nazev)}</text></g>`;
      });
      svg.style.color = 'var(--text)';
      svg.innerHTML = s; return;
    }
    const R = obalNahledu();
    svg.setAttribute('viewBox', `${-R} ${-R} ${2 * R} ${2 * R}`);
    s += `<g font-family="${O.rodina(st, false).replace(/"/g, "'")}">`;
    model.vrstvy.forEach((v, i) => {
      const op = pruhled && i > 0 && i === model.vrstvy.length - 1 ? 0.55 : 1;
      s += `<g class="vrstva" data-i="${i}" transform="rotate(${uhly[i] || 0})" opacity="${op}"><path d="${O.tvarCesta(v.tvar)}${(v.okna || []).map(O.oknoCesta).join('')}" fill="#000" fill-rule="evenodd" filter="url(#stin)" opacity=".55"/>${O.svgVrstva(v, st, { nahled: true, id: 'n' + i })}</g>`;
    });
    s += `<circle cx="0" cy="0" r="2.2" fill="#c9a227" stroke="#6b5310" stroke-width=".4"/><circle cx="0" cy="0" r=".8" fill="#6b5310"/></g>`;
    svg.innerHTML = s;
  }
  function otocNahled() {
    if (vedle) return;
    for (const g of $('nahled').querySelectorAll('g.vrstva')) g.setAttribute('transform', `rotate(${uhly[+g.dataset.i] || 0})`);
    if (sc3d) sc3d.otoceni(uhly);
  }
  function popis() {
    const v = vstupy(), r = model.popis(uhly, v);
    $('vysledekHlavni').textContent = r.hlavni || '';
    const radky = (r.radky || []).slice(), vs = $('vystupSifry');
    if (model.sifra && v.text) {
      const k = model.posunZ(uhly);
      vs.textContent = model.sifra(v.text, k, v.smer === 'd');
      vs.classList.remove('skryte');
      const i = radky.findIndex((q) => /^(Šifra|Otevřený text): /.test(q)); if (i >= 0) radky.splice(i, 1);
    } else vs.classList.add('skryte');
    $('vysledekRadky').innerHTML = radky.map((q) => `<li>${esc(q)}</li>`).join('');
  }

  /* ---------------- otáčení tažením ---------------- */
  function bodSvg(e) {
    const svg = $('nahled'), p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const m = svg.getScreenCTM(); if (!m) return [0, 0];
    const q = p.matrixTransform(m.inverse()); return [q.x, q.y];
  }
  function vyberVrstvu(q) {
    // shora dolů: pevná vrstva pod ukazatelem „propustí“ tah na otočnou vrstvu pod ní
    for (let i = model.vrstvy.length - 1; i >= 0; i--) {
      const v = model.vrstvy[i], l = V.otoc(q, -(uhly[i] || 0));
      if (K.naPapiru(v, l)) { if (v.otoc) return i; }
    }
    return model.vrstvy.map((v) => v.otoc).lastIndexOf(true);
  }
  let tah = null;
  function prichyt(i, a) { const k = model.vrstvy[i].krok; return k > 0 ? Math.round(a / k) * k : a; }
  function zapojTah() {
    const svg = $('nahled');
    svg.addEventListener('pointerdown', (e) => {
      if (vedle || !model) return;
      const q = bodSvg(e), i = vyberVrstvu(q);
      if (i < 0) return;
      aktivni = i; svg.setPointerCapture(e.pointerId); svg.classList.add('tah');
      tah = { id: e.pointerId, i, a0: V.uhelBodu(q[0], q[1]), u0: uhly[i] || 0 };
      e.preventDefault();
    });
    svg.addEventListener('pointermove', (e) => {
      if (!tah || e.pointerId !== tah.id) return;
      const q = bodSvg(e);
      if (Math.hypot(q[0], q[1]) < 2) return;
      let d = V.uhelBodu(q[0], q[1]) - tah.a0; d = ((d + 540) % 360) - 180;
      tah.a0 += d; tah.u0 += d;
      const nov = prichyt(tah.i, tah.u0);
      if (nov !== uhly[tah.i]) { uhly[tah.i] = nov; otocNahled(); popis(); }
    });
    const konec = (e) => { if (!tah || e.pointerId !== tah.id) return; tah = null; svg.classList.remove('tah'); stav.uhly[stav.sablona] = uhly; uloz(); };
    svg.addEventListener('pointerup', konec); svg.addEventListener('pointercancel', konec);
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (aktivni < 0) return;
      e.preventDefault();
      const k = model.vrstvy[aktivni].krok || 1, smer = e.key === 'ArrowRight' ? 1 : -1;
      uhly[aktivni] = prichyt(aktivni, (uhly[aktivni] || 0) + smer * k * (e.shiftKey ? 10 : 1));
      otocNahled(); popis(); uloz();
    });
  }

  /* ---------------- formuláře ---------------- */
  function kresliSablony() {
    $('sablony').innerHTML = SB.PORADI.map((id, i) => { const s = SB.SABLONY[id]; return `<button type="button" data-id="${id}" aria-pressed="${id === stav.sablona}" title="${esc(s.popis)} (${i + 1})"><span class="em">${s.ikona}</span>${esc(s.nazev)}</button>`; }).join('');
    $('popisSablony').textContent = sb().popis;
  }
  function vyberSablonu(id) {
    if (!SB.SABLONY[id] || id === stav.sablona) return;
    stav.sablona = id; uloz();
    kresliSablony(); kresliFormular(); kresliVstupy(); sestav(true);
  }
  function kresliFormular() {
    const p = Object.assign({}, sb().vychozi, parametry()), f = $('formular');
    f.innerHTML = sb().pole.filter((q) => !q.kdyz || q.kdyz(p)).map((q) => {
      const h = p[q.id], id = 'f_' + q.id;
      if (q.typ === 'zaskrt') return `<label class="chk"><input type="checkbox" id="${id}" data-pole="${q.id}"${h ? ' checked' : ''}> ${esc(q.label)}</label>`;
      if (q.typ === 'vyber') return `<label for="${id}">${esc(q.label)}</label><select id="${id}" data-pole="${q.id}">${q.moznosti.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(h) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      if (q.typ === 'textarea') return `<label for="${id}">${esc(q.label)}</label><textarea id="${id}" data-pole="${q.id}" rows="3">${esc(h || '')}</textarea>`;
      if (q.typ === 'text') return `<label for="${id}">${esc(q.label)}</label><input id="${id}" type="text" data-pole="${q.id}" value="${esc(h || '')}">`;
      const zobr = q.nasob ? h * q.nasob : h;
      return `<label for="${id}">${esc(q.label)}</label><input id="${id}" type="number" data-pole="${q.id}" min="${q.min}" max="${q.max}" step="${q.krok || 1}" value="${zobr}">`;
    }).join('');
    $('editor').innerHTML = '';
    if (stav.sablona === 'vlastni') {
      const pp = parametry(); if (!pp.vlastni) pp.vlastni = JSON.parse(JSON.stringify(SB.VZOR_VLASTNI));
      window.VOLV_EDITOR.vykresli($('editor'), pp.vlastni, zmenaEditoru);
    }
  }
  let casSestaveni = 0;
  function planujSestaveni(zachovat) { clearTimeout(casSestaveni); casSestaveni = setTimeout(() => sestav(zachovat), 160); }
  function zmenaEditoru(m, co) {
    if (co === 'export') { stahni(new Blob([JSON.stringify(m, null, 1)], { type: 'application/json' }), 'volvelle_vlastni.json'); return; }
    if (co === 'import') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = async () => {
        try {
          const d = JSON.parse(await inp.files[0].text());
          if (!d || !Array.isArray(d.vrstvy)) throw new Error('soubor neobsahuje pole „vrstvy“');
          parametry().vlastni = d; stav.uhly.vlastni = null; uloz(); kresliFormular(); sestav(false);
        } catch (e) { hlaseni('JSON nejde načíst: ' + e.message); }
      };
      inp.click(); return;
    }
    uloz();
    if (co === true) { stav.uhly.vlastni = null; }
    planujSestaveni(true);
  }
  function zapojFormular() {
    const f = $('formular');
    const zmena = (e) => {
      const el = e.target.closest('[data-pole]'); if (!el) return;
      const q = sb().pole.find((x) => x.id === el.dataset.pole); if (!q) return;
      let v = q.typ === 'zaskrt' ? el.checked : el.value;
      if (q.typ === 'cislo') { v = parseFloat(String(v).replace(',', '.')); if (!isFinite(v)) return; v = Math.max(q.min * (q.nasob || 1), Math.min(q.max * (q.nasob || 1), v)); if (q.nasob) v /= q.nasob; }
      parametry()[q.id] = v; uloz();
      if (sb().pole.some((x) => x.kdyz)) { if (e.type === 'change') kresliFormular(); }
      // změna počtu vrstev / dílků: úhly přepočítat podle vstupů
      stav.uhly[stav.sablona] = null;
      planujSestaveni(false);
    };
    f.addEventListener('change', zmena);
    f.addEventListener('input', (e) => { if (e.target.matches('textarea, input[type=text]')) zmena(e); });
  }
  function kresliVstupy() {
    const v = vstupy(), sv = sb().vstupy;
    let s = sv.map((f) => {
      const id = 'v_' + f.id, h = v[f.id] == null ? '' : v[f.id];
      if (f.typ === 'textarea') return `<div class="siroky"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" data-vstup="${f.id}" rows="2">${esc(h)}</textarea></div>`;
      if (f.typ === 'select') return `<div><label for="${id}">${esc(f.label)}</label><select id="${id}" data-vstup="${f.id}">${f.moznosti.map(([a, t]) => `<option value="${a}"${a === h ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
      return `<div><label for="${id}">${esc(f.label)}</label><input id="${id}" type="${f.typ}" data-vstup="${f.id}" value="${esc(h)}"${f.typ === 'number' ? ' step="any"' : ''}></div>`;
    }).join('');
    if (sv.some((f) => f.typ === 'date')) s += '<button type="button" class="btn btn-sec" id="btnTed">Dnes / teď</button>';
    if (sv.length) s += '<button type="button" class="btn" id="btnNastav">Natočit</button>';
    $('vstupy').innerHTML = s;
  }
  function zapojVstupy() {
    const kont = $('vstupy');
    const zmena = (e, natocit) => {
      const el = e.target.closest('[data-vstup]'); if (!el) return;
      vstupy()[el.dataset.vstup] = el.value; uloz();
      if (natocit) natoc(); else popis();
    };
    kont.addEventListener('change', (e) => zmena(e, !e.target.matches('textarea') && !(stav.sablona === 'sifra' && e.target.dataset.vstup === 'smer')));
    kont.addEventListener('input', (e) => { if (e.target.matches('textarea')) zmena(e, false); });
    kont.addEventListener('click', (e) => {
      if (e.target.id === 'btnNastav') natoc();
      if (e.target.id === 'btnTed') {
        const d = new Date(), v = vstupy();
        for (const f of sb().vstupy) { if (f.typ === 'date') v[f.id] = SB.dnes(); if (f.typ === 'time') v[f.id] = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
        uloz(); kresliVstupy(); natoc();
      }
    });
  }
  function natoc() {
    const n = model.nastav(vstupy());
    if (n) { uhly = n.map((a, i) => prichyt(i, a)); stav.uhly[stav.sablona] = uhly; uloz(); otocNahled(); }
    popis();
  }

  /* ---------------- styly ---------------- */
  function miniStyl(id) {
    const st = ST.styl(id), b = st.barvy, v = st.vypl;
    let s = `<svg viewBox="-22 -22 44 44" aria-hidden="true"><circle r="21" fill="${b.papir || '#fff'}" stroke="${b.cara}" stroke-width="0.8"/>`;
    if (st.vyplne) for (let i = 0; i < 8; i++) { const a1 = i * 45 * Math.PI / 180, a2 = (i + 1) * 45 * Math.PI / 180; s += `<path d="M${(13 * Math.sin(a1)).toFixed(2)} ${(-13 * Math.cos(a1)).toFixed(2)}L${(20 * Math.sin(a1)).toFixed(2)} ${(-20 * Math.cos(a1)).toFixed(2)}A20 20 0 0 1 ${(20 * Math.sin(a2)).toFixed(2)} ${(-20 * Math.cos(a2)).toFixed(2)}L${(13 * Math.sin(a2)).toFixed(2)} ${(-13 * Math.cos(a2)).toFixed(2)}A13 13 0 0 0 ${(13 * Math.sin(a1)).toFixed(2)} ${(-13 * Math.cos(a1)).toFixed(2)}Z" fill="${v[i]}"/>`; }
    s += `<circle r="13" fill="none" stroke="${b.cara}" stroke-width="0.6"/><text y="3.5" font-size="10" text-anchor="middle" fill="${b.akcent}" font-family="'${st.nadpisInfo.rodina}', sans-serif">Aa</text><path d="M0 -21L2 -16L-2 -16Z" fill="${b.akcent}"/></svg>`;
    return s;
  }
  function kresliStyly() {
    $('styly').innerHTML = Object.keys(ST.STYLY).map((id) => `<button type="button" role="radio" data-styl="${id}" aria-checked="${id === stav.styl}" title="${esc(ST.STYLY[id].popis)}">${miniStyl(id)}${esc(ST.STYLY[id].nazev)}</button>`).join('');
  }

  /* ---------------- tabulka vrstev, informace o tisku ---------------- */
  function tabVrstvy() {
    $('tabVrstvy').innerHTML = '<tr><th>#</th><th>Vrstva</th><th>Průměr</th><th>Okének</th><th>Otáčí se</th></tr>' + model.vrstvy.map((v, i) => `<tr><td>${i + 1}</td><td>${esc(v.nazev)}</td><td>${V.cislo(2 * v.R, 1)} mm</td><td>${(v.okna || []).length}</td><td>${v.otoc ? 'ano' + (v.krok > 0 ? `, po ${V.cislo(v.krok, 2)}°` : '') : 'ne'}</td></tr>`).join('');
  }
  function papir() { return stav.papir === 'vlastni' ? [Math.max(80, +stav.papirW || 210), Math.max(80, +stav.papirH || 297)] : PAPIRY[stav.papir] || PAPIRY.a4; }
  function infoTisk() {
    if (!model) return;
    const [W, H] = papir(), o = +stav.okraj || 8, info = [];
    let listu = 0;
    for (const v of model.vrstvy) { const r = O.rozvrhListu(2 * v.R, 2 * v.R, W, H, o, +stav.prekryv || 0); listu += r.listy.length + (stav.zadni && r.jeden ? 1 : 0); if (!r.jeden) info.push(`${v.nazev}: ${r.listy.length} listy s lepením`); }
    listu += (model.stranky || []).length + 1;
    $('infoTisk').innerHTML = `PDF: <b>${listu}</b> stran (${model.vrstvy.length} vrstev${(model.stranky || []).length ? ' + měsíční kalendář' : ''} + návod s kontrolním čtvercem).` + (info.length ? '<br>' + info.map(esc).join('<br>') : '');
    $('blokPapir').classList.toggle('skryte', stav.papir !== 'vlastni');
  }

  /* ---------------- písma a výstupy ---------------- */
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  async function nactiPismo(soubor) {
    window.FONTY_JS = window.FONTY_JS || {};
    if (window.FONTY_JS[soubor]) return window.FONTY_JS[soubor];
    const cesta = soubor === 'LiberationSans-Regular.ttf' ? 'stitky_panely/fonty/LiberationSans-Regular.ttf.js' : 'fonty/js/' + soubor + '.js';
    try { await nactiSkript(cesta); } catch (e) { return null; }
    return window.FONTY_JS[soubor] || null;
  }
  async function pismaStylu(st) {
    const out = {};
    for (const p of [st.pismoInfo, st.nadpisInfo]) if (p && !p.liberation) out[p.soubor] = await nactiPismo(p.soubor);
    return out;
  }
  function stahni(blob, jmeno) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const jmenoSouboru = (pripona, dopl) => `volvelle_${stav.sablona}${dopl ? '_' + dopl : ''}.${pripona}`;
  async function pdf() {
    const b = $('btnPdf'); b.disabled = true; const puv = b.textContent; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) await nactiSkript('lib/jspdf.umd.min.js');
      const lib = await nactiPismo('LiberationSans-Regular.ttf'), pisma = await pismaStylu(model.styl);
      const doc = O.pdf(window.jspdf.jsPDF, model, { papir: papir(), okraj: +stav.okraj || 8, prekryv: +stav.prekryv || 0, liberation: lib, pisma, zadni: stav.zadni, nazev: model.nazev });
      stahni(doc.output('blob'), jmenoSouboru('pdf'));
    } catch (e) { console.error(e); hlaseni('PDF se nepodařilo vytvořit: ' + e.message); }
    b.disabled = false; b.textContent = puv;
  }
  async function svg(rezim) {
    await pismaStylu(model.styl);
    stahni(new Blob([O.svgExport(model, { rezim, vlozitPisma: rezim !== 'rez' })], { type: 'image/svg+xml' }), jmenoSouboru('svg', rezim));
  }

  /* ---------------- 3D ---------------- */
  let cas3d = 0;
  function planuj3d() { clearTimeout(cas3d); cas3d = setTimeout(async () => { await pismaStylu(model.styl); sc3d.nastavModel(model, uhly); }, 250); }
  function zapoj3d() {
    const karta = $('karta3d');
    const spust = () => {
      if (nacita3d) return; nacita3d = true;
      const hotovo = () => {
        try {
          $('stav3d').remove();
          sc3d = window.VOLV_3D.vytvor($('obal3d'));
          sc3d.rozlozeni((+stav.rozlozeni3d || 0) / 100);
          planuj3d();
        } catch (e) { $('obal3d').innerHTML = `<div class="info" style="padding:12px">3D náhled není k dispozici (${esc(e.message)}).</div>`; }
      };
      if (window.THREE) hotovo(); else nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
    };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((z) => { if (z[0].isIntersecting) { io.disconnect(); spust(); } }, { rootMargin: '200px' }); io.observe(karta); } else spust();
    const r = $('rozlozeni3d');
    r.value = stav.rozlozeni3d; $('rozlozeniH').textContent = r.value + ' %';
    r.addEventListener('input', () => { stav.rozlozeni3d = +r.value; $('rozlozeniH').textContent = r.value + ' %'; if (sc3d) sc3d.rozlozeni(+r.value / 100); uloz(); });
    let anim = 0;
    $('b3dSloz').addEventListener('click', () => {
      cancelAnimationFrame(anim);
      const od = +r.value, cil = od > 50 ? 0 : 100, t0 = performance.now();
      const krok = (t) => { const k = Math.min(1, (t - t0) / 900), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, v = Math.round(od + (cil - od) * e); r.value = v; r.dispatchEvent(new Event('input')); if (k < 1) anim = requestAnimationFrame(krok); };
      anim = requestAnimationFrame(krok);
    });
    $('b3dShora').addEventListener('click', () => sc3d && sc3d.pohled(0, 89));
    $('b3dSikmo').addEventListener('click', () => sc3d && sc3d.pohled(20, 48));
  }

  /* ---------------- zapojení ---------------- */
  function zapoj() {
    $('sablony').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) vyberSablonu(b.dataset.id); });
    $('styly').addEventListener('click', (e) => { const b = e.target.closest('button[data-styl]'); if (!b) return; stav.styl = b.dataset.styl; uloz(); kresliStyly(); sestav(true); });
    $('bezVyplni').checked = !!stav.bezVyplni;
    $('bezVyplni').addEventListener('change', (e) => { stav.bezVyplni = e.target.checked; uloz(); sestav(true); });
    for (const id of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH']) {
      const el = $(id); el.value = stav[id];
      el.addEventListener('change', () => { stav[id] = el.type === 'number' ? +el.value : el.value; uloz(); infoTisk(); });
    }
    $('zadni').checked = !!stav.zadni;
    $('zadni').addEventListener('change', (e) => { stav.zadni = e.target.checked; uloz(); infoTisk(); });
    $('btnPdf').addEventListener('click', pdf);
    $('btnSvg').addEventListener('click', () => svg('tisk'));
    $('btnSvgPlotr').addEventListener('click', () => svg('plotr'));
    $('btnSvgRez').addEventListener('click', () => svg('rez'));
    $('btnDxf').addEventListener('click', () => stahni(new Blob([O.dxf(model)], { type: 'application/dxf' }), jmenoSouboru('dxf')));
    $('btnReset').addEventListener('click', async () => {
      const ok = typeof Dialog !== 'undefined' ? await Dialog.potvrd('Vrátit nastavení šablony „' + sb().nazev + '“ na výchozí?') : true;
      if (!ok) return;
      delete stav.p[stav.sablona]; delete stav.uhly[stav.sablona]; delete stav.vstupy[stav.sablona]; uloz();
      kresliFormular(); kresliVstupy(); sestav(false);
    });
    $('btnVychozi').addEventListener('click', () => { const n = model.nastav(vstupy()); uhly = n || model.vrstvy.map(() => 0); stav.uhly[stav.sablona] = uhly; uloz(); otocNahled(); popis(); });
    $('btnPruhled').addEventListener('click', (e) => { pruhled = !pruhled; e.currentTarget.setAttribute('aria-pressed', pruhled); kresliNahled(); });
    $('btnRozlozit').addEventListener('click', (e) => { vedle = !vedle; e.currentTarget.setAttribute('aria-pressed', vedle); kresliNahled(); });
    $('zalozky').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-z]'); if (!b) return;
      for (const x of $('zalozky').children) x.setAttribute('aria-selected', x === b);
      for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.p !== b.dataset.z;
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const m = /^(Digit|Numpad)([1-8])$/.exec(e.code);
      if (m) { e.preventDefault(); vyberSablonu(SB.PORADI[+m[2] - 1]); }
    });
    zapojTah(); zapojFormular(); zapojVstupy(); zapoj3d();
    // písma náhledu se načítají asynchronně – po načtení překreslit (rozvržení se nemění, jen vzhled)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => kresliNahled());
  }

  kresliSablony(); kresliStyly(); kresliFormular(); kresliVstupy(); zapoj(); sestav(true);
  window.VOLV_UI = { get model() { return model; }, get uhly() { return uhly; }, natoc, vyberSablonu, sestav, nastavUhly(u) { uhly = u.slice(); otocNahled(); popis(); } };
})();
