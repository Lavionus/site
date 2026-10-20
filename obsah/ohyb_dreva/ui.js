/* ============================================================
   Ohýbání dřeva – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const OHD = window.OHD, OHDV = window.OHDV, OHDN = window.OHDN, OHDSTL = window.OHDSTL, PR = window.OHDPrincip;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_ohyb_dreva', KLIC_PROJEKTY = 'webapp_ohyb_dreva_projekty';
  const cz = OHD.cz;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const METODY = ['laminace', 'para', 'zarezy'];
  const NAZEV_M = { laminace: 'Laminování', para: 'Ohyb párou', zarezy: 'Zářezy (kerf)' };

  /* ---------- definice polí ---------- */
  const dreviny = () => (S.dreviny || OHD.DREVINY).map((d) => [d.id, d.nazev]);
  const LIC = [['spodni', 'spodní líc (dotyk s formou)'], ['stred', 'střednice'], ['horni', 'horní líc']];
  const POLE_TVAR = {
    oblouk: [{ k: 'R', n: 'Poloměr R (mm)', min: 10, krok: 1 }, { k: 'uhel', n: 'Úhel (°)', min: 1, max: 180, krok: 1 },
      { k: 'smer', n: 'Orientace', t: 'v', m: [['hrb', 'hrb – střed dole'], ['miska', 'miska – střed nahoře']] }, { k: 'konce', n: 'Rovné konce (mm)', min: 0, krok: 5 }],
    s: [{ k: 'R1', n: 'R₁ (mm)', min: 10 }, { k: 'uhel1', n: 'Úhel₁ (°)', min: 1, max: 170 }, { k: 'R2', n: 'R₂ (mm)', min: 10 }, { k: 'uhel2', n: 'Úhel₂ (°)', min: 1, max: 170 },
      { k: 'mezi', n: 'Rovně mezi (mm)', min: 0, krok: 5 }, { k: 'smer1', n: 'První oblouk', t: 'v', m: [['miska', 'nahoru (miska)'], ['hrb', 'dolů (hrb)']] }, { k: 'konce', n: 'Rovné konce (mm)', min: 0, krok: 5 }],
    spline: [{ k: 'konce', n: 'Rovné konce (mm)', min: 0, krok: 5 }],
    kruh: [{ k: 'D', n: 'Průměr D (mm)', min: 20, krok: 1 }],
  };
  const POLE_M = {
    laminace: () => [
      { k: 'drevina', n: 'Dřevina', t: 'v', m: dreviny() }, { k: 'T', n: 'Tloušťka balíku T (mm)', min: 1, krok: 0.5 },
      { k: 'sirka', n: 'Šířka lamel (mm)', min: 5 }, { k: 'rezim', n: 'Lamely', t: 'v', m: [['auto', 'spočítat počet'], ['pevna', 'pevná tloušťka lamely']] },
      { k: 'tl', n: 'Tloušťka lamely (mm)', min: 0.3, krok: 0.1, ukaz: (p) => p.rezim === 'pevna' },
      { k: 'maxOdpruzeni', n: 'Max. odpružení (% křivosti)', min: 0.1, max: 50, krok: 0.5, ukaz: (p) => p.rezim !== 'pevna' },
      { k: 'minLamel', n: 'Min. počet lamel', min: 1, max: 60, ukaz: (p) => p.rezim !== 'pevna' },
      { k: 'pridavek', n: 'Přídavek na délku (mm, celkem)', min: 0, krok: 5 },
      { k: 'kompenzace', n: 'Kompenzovat odpružení (forma přehnutá o 1/n²)', t: 'b' },
      { s: 'Forma' },
      { k: 'forma', n: 'Typ formy', t: 'v', m: [['dvoudilna', 'dvoudílná (pozitiv + negativ)'], ['jednodilna', 'jednodílná se svěrkami']] },
      { k: 'vlozka', n: 'Vložka korek/pryž (mm)', min: 0, max: 10, krok: 0.5, ukaz: (p) => p.forma === 'dvoudilna' },
      { k: 'segmentu', n: 'Výsečí negativu', min: 2, max: 12, ukaz: (p) => p.forma === 'dvoudilna' && S.tvar.typ === 'kruh' },
      { k: 'hloubka', n: 'Hloubka formy pod lícem (mm)', min: 10, krok: 5 }, { k: 'presah', n: 'Přesah formy za díl (mm)', min: 0, krok: 5 },
      { k: 'mdf', n: 'Tloušťka vrstvy MDF (mm)', min: 3, krok: 1 }, { k: 'okrajSirky', n: 'Okraj formy po šířce (mm)', min: 0, krok: 1 },
      { k: 'kolik', n: 'Kolík vrstev Ø (mm)', min: 3, krok: 1 }, { k: 'pocetKoliku', n: 'Kolíků na díl', min: 0, max: 8 },
      { k: 'okna', n: 'Okna pro svěrky ve formě', t: 'b', ukaz: (p) => p.forma === 'jednodilna' },
      { k: 'okno', n: 'Průměr okna (mm)', min: 10, ukaz: (p) => p.forma === 'jednodilna' && p.okna }, { k: 'odstupOkna', n: 'Okno pod lícem (mm)', min: 3, ukaz: (p) => p.forma === 'jednodilna' && p.okna },
      { s: 'Lepení a svěrky' },
      { k: 'roztec', n: 'Max. rozteč svěrek (mm)', min: 30, krok: 5 }, { k: 'silaSverky', n: 'Síla svěrky (kN, typ.)', min: 0.2, krok: 0.1 },
      { k: 'tlak', n: 'Lisovací tlak (MPa, 0 = dle dřeviny)', min: 0, max: 3, krok: 0.1 }, { k: 'nanos', n: 'Nános lepidla (g/m²)', min: 50, krok: 10 },
      { k: 'prorez', n: 'Prořez pily při rozřezu (mm)', min: 0, krok: 0.1 }, { k: 'prHobl', n: 'Přídavek na hoblování (mm)', min: 0, krok: 0.1 },
    ],
    para: () => [
      { k: 'drevina', n: 'Dřevina', t: 'v', m: dreviny() }, { k: 't', n: 'Tloušťka dílu t (mm)', min: 3, krok: 0.5 },
      { k: 'sirka', n: 'Šířka dílu (mm)', min: 5 }, { k: 'rychlost', n: 'Napařování (h na 25 mm)', min: 0.1, krok: 0.1 },
      { k: 'pas', n: 'Ohýbací pás s dorazy (strap)', t: 'b' },
      { k: 'mezTlak', n: 'Mez stlačení (%, typ.)', min: 1, krok: 1, ukaz: (p) => p.pas }, { k: 'mezTah', n: 'Mez protažení (%, typ.)', min: 0.1, krok: 0.1, ukaz: (p) => !p.pas },
      { k: 'pasTl', n: 'Tloušťka pásu (mm)', min: 0.3, krok: 0.1, ukaz: (p) => p.pas }, { k: 'doraz', n: 'Délka dorazu (mm)', min: 10, ukaz: (p) => p.pas },
      { k: 'prehnuti', n: 'Přehnutí kopyta (% křivosti)', min: 0, max: 40, krok: 1 }, { k: 'pridavek', n: 'Přídavek na délku (mm)', min: 0, krok: 5 },
      { s: 'Kopyto' },
      { k: 'hloubka', n: 'Hloubka kopyta pod lícem (mm)', min: 10, krok: 5 }, { k: 'presah', n: 'Přesah kopyta za díl (mm)', min: 0, krok: 5 },
      { k: 'mdf', n: 'Tloušťka vrstvy MDF (mm)', min: 3 }, { k: 'okrajSirky', n: 'Okraj po šířce (mm)', min: 0 },
      { k: 'kolik', n: 'Kolík vrstev Ø (mm)', min: 3 }, { k: 'pocetKoliku', n: 'Kolíků na díl', min: 0, max: 8 },
      { k: 'roztec', n: 'Max. rozteč svěrek (mm)', min: 30, krok: 5 },
      { k: 'okna', n: 'Okna pro svěrky v kopytu', t: 'b' },
      { k: 'okno', n: 'Průměr okna (mm)', min: 10, ukaz: (p) => p.okna }, { k: 'odstupOkna', n: 'Okno pod lícem (mm)', min: 3, ukaz: (p) => p.okna },
    ],
    zarezy: () => [
      { k: 'material', n: 'Materiál', t: 'v', m: (S.materialy || OHD.MATERIALY_KERF).map((m) => [m.id, m.nazev]) },
      { k: 't', n: 'Tloušťka desky t (mm)', min: 1, krok: 0.5 }, { k: 'zbytek', n: 'Zbytek z – kůže (mm)', min: 0.3, krok: 0.1 },
      { k: 'sirka', n: 'Šířka řezu k (mm)', min: 0.2, krok: 0.1 }, { k: 'R', n: 'Poloměr (mm)', min: 1 },
      { k: 'lic', n: 'Poloměr platí pro', t: 'v', m: [['vnejsi', 'vnější (viditelný) líc'], ['vnitrni', 'vnitřní líc (zářezy)']] },
      { k: 'uhel', n: 'Úhel ohybu (°)', min: 1, max: 360 }, { k: 'minMustek', n: 'Min. můstek mezi řezy (mm)', min: 0, krok: 0.5 },
      { k: 'konecA', n: 'Rovně před ohybem (mm)', min: 0, krok: 5 }, { k: 'konecB', n: 'Rovně za ohybem (mm)', min: 0, krok: 5 },
      { k: 'sirkaDesky', n: 'Šířka desky (mm)', min: 10 }, { k: 'vyskaPasu', n: 'Výška tištěné šablony (mm)', min: 20, max: 150 },
    ],
  };
  const PREDVOLBY = [
    { id: '', nazev: '– vyberte předvolbu –' },
    { id: 'operadlo', m: 'laminace', nazev: 'Laminování: opěradlo židle (buk, R 450 / 50°)', tvar: { typ: 'oblouk', R: 450, uhel: 50, smer: 'hrb', lic: 'stred', konce: 0 }, p: { drevina: 'buk', T: 18, sirka: 60, forma: 'dvoudilna' } },
    { id: 'kolebka', m: 'laminace', nazev: 'Laminování: kolébka houpacího křesla (dub, R 900)', tvar: { typ: 'oblouk', R: 900, uhel: 55, smer: 'miska', lic: 'spodni', konce: 0 }, p: { drevina: 'dub', T: 30, sirka: 40, forma: 'jednodilna', hloubka: 90 } },
    { id: 'snoha', m: 'laminace', nazev: 'Laminování: S-noha stolku (jasan)', tvar: { typ: 's', R1: 250, uhel1: 50, R2: 250, uhel2: 50, mezi: 40, smer1: 'miska', konce: 60, lic: 'spodni' }, p: { drevina: 'jasan', T: 24, sirka: 40, forma: 'dvoudilna' } },
    { id: 'buben', m: 'laminace', nazev: 'Laminování: kruhový rám bubínku Ø 300', tvar: { typ: 'kruh', D: 300, lic: 'spodni' }, p: { drevina: 'buk', T: 6, sirka: 80, forma: 'dvoudilna', hloubka: 50 } },
    { id: 'lampa', m: 'laminace', nazev: 'Laminování: stínidlo lampy – vlastní spline', tvar: { typ: 'spline', konce: 0, lic: 'spodni', body: [[0, 0], [120, 30], [260, 95], [400, 110], [520, 70]] }, p: { drevina: 'orech', T: 8, sirka: 160, forma: 'dvoudilna' } },
    { id: 'naramek', m: 'laminace', nazev: 'Laminování: malá forma pro 3D tisk (R 40, 150°)', tvar: { typ: 'oblouk', R: 40, uhel: 150, smer: 'hrb', lic: 'spodni', konce: 0 }, p: { drevina: 'javor', T: 4, sirka: 20, forma: 'dvoudilna', hloubka: 15, presah: 10, okrajSirky: 2, mdf: 6, kolik: 4, pocetKoliku: 2, roztec: 40 } },
    { id: 'windsor', m: 'para', nazev: 'Pára: opěradlo Windsor (dub 22 mm, R 250 / 120°)', tvar: { typ: 'oblouk', R: 250, uhel: 120, smer: 'hrb', lic: 'spodni', konce: 80 }, p: { drevina: 'dub', t: 22, sirka: 30, pas: true } },
    { id: 'obruc', m: 'para', nazev: 'Pára: obruč Ø 400 (jasan 10 mm)', tvar: { typ: 'kruh', D: 400, lic: 'spodni' }, p: { drevina: 'jasan', t: 10, sirka: 30, pas: true } },
    { id: 'madlo', m: 'para', nazev: 'Pára: madlo / rukojeť (buk 20 mm, R 120 / 90°)', tvar: { typ: 'oblouk', R: 120, uhel: 90, smer: 'hrb', lic: 'spodni', konce: 60 }, p: { drevina: 'buk', t: 20, sirka: 30, pas: true } },
    { id: 'roh', m: 'zarezy', nazev: 'Zářezy: zaoblený roh skříňky (MDF 18, R 100 / 90°)', p: { material: 'mdf', t: 18, zbytek: 3, sirka: 3.2, R: 100, lic: 'vnejsi', uhel: 90 } },
    { id: 'pult', m: 'zarezy', nazev: 'Zářezy: oblouk pultu (MDF 18, R 400 / 180°)', p: { material: 'mdf', t: 18, zbytek: 4, sirka: 3.2, R: 400, lic: 'vnitrni', uhel: 180 } },
    { id: 'preklizka', m: 'zarezy', nazev: 'Zářezy: překližka 12 mm, R 80 / 90°', p: { material: 'preklizka', t: 12, zbytek: 2, sirka: 2.5, R: 80, lic: 'vnejsi', uhel: 90 } },
  ];
  const sekceM = (m) => (m === 'zarezy' ? 'kerf' : m === 'para' ? 'para' : 'lam');
  const TISK_POLE = ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'kalibX', 'kalibY'];
  const STL_POLE = ['sirkaTisk', 'stul', 'kolikD', 'vuleKoliku', 'oznaceni'];

  /* ---------- stav ---------- */
  function slouc(P, u) {
    if (!u || typeof u !== 'object') return P;
    if (METODY.includes(u.metoda)) P.metoda = u.metoda;
    for (const k of ['tvar', 'lam', 'para', 'kerf', 'tisk', 'stl']) if (u[k]) Object.assign(P[k], u[k]);
    if (Array.isArray(u.dreviny) && u.dreviny.length) P.dreviny = u.dreviny;
    if (Array.isArray(u.materialy) && u.materialy.length) P.materialy = u.materialy;
    P.nazev = u.nazev || '';
    return P;
  }
  function nacistStav() { try { return slouc(OHD.vychoziProjekt(), JSON.parse(localStorage.getItem(KLIC) || 'null')); } catch (e) { return OHD.vychoziProjekt(); } }
  let S = nacistStav(), N = null, ulozTimer = 0;
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné úložiště */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  /* ---------- formuláře ---------- */
  function polePole(def, data, prefix) {
    let h = '';
    for (const f of def) {
      if (f.s) { h += `<div class="cela podnadpis" style="margin-top:12px;text-transform:uppercase;font-size:.72rem;letter-spacing:.05em">${esc(f.s)}</div>`; continue; }
      const id = prefix + f.k, v = data[f.k];
      if (f.t === 'b') h += `<div class="cela" data-pole="${f.k}"><label class="chk"><input type="checkbox" id="${id}"${v ? ' checked' : ''}> ${esc(f.n)}</label></div>`;
      else if (f.t === 'v') h += `<div class="${f.n.length > 30 || f.m.some((x) => x[1].length > 22) ? 'cela' : ''}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><select id="${id}">${f.m.map(([a, b]) => `<option value="${esc(a)}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
      else h += `<div data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><input id="${id}" type="number" inputmode="decimal" value="${esc(v)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} step="${f.krok || 1}"></div>`;
    }
    return h;
  }
  function viditelnost(def, data, kontejner) {
    for (const f of def) {
      if (!f.k) continue;
      const el = kontejner.querySelector(`[data-pole="${f.k}"]`);
      if (el) el.classList.toggle('skryte', !!(f.ukaz && !f.ukaz(data)));
    }
  }
  const defTvar = () => POLE_TVAR[S.tvar.typ].concat(S.tvar.typ === 'kruh' && S.metoda === 'para' ? [] : [{ k: 'lic', n: S.metoda === 'para' ? 'Rozměr platí pro (vnitřní = na kopytu)' : 'Rozměr platí pro', t: 'v', m: S.metoda === 'para' ? [['spodni', 'vnitřní líc (na kopytu)'], ['stred', 'střednice'], ['horni', 'vnější líc']] : LIC }]);
  function vykresliFormulare() {
    for (const b of $('metody').children) b.setAttribute('aria-pressed', String(b.dataset.m === S.metoda));
    for (const b of $('typy').children) b.setAttribute('aria-pressed', String(b.dataset.t === S.tvar.typ));
    $('kartaTvar').classList.toggle('skryte', S.metoda === 'zarezy');
    $('kartaStl').classList.toggle('skryte', S.metoda === 'zarezy');
    $('poleTvar').innerHTML = polePole(defTvar(), S.tvar, 't_');
    $('blokBody').classList.toggle('skryte', S.tvar.typ !== 'spline');
    if (S.tvar.typ === 'spline') vykresliBody();
    $('nadpisParam').textContent = '⚙️ ' + NAZEV_M[S.metoda];
    $('poleMetody').innerHTML = polePole(POLE_M[S.metoda](), S[sekceM(S.metoda)], 'm_');
    viditelnost(POLE_M[S.metoda](), S[sekceM(S.metoda)], $('poleMetody'));
    vykresliDreviny();
  }
  function cteni(el, def, data) {
    const k = el.id.slice(2), f = def.find((q) => q.k === k);
    if (!f) return false;
    if (f.t === 'b') data[k] = el.checked;
    else if (f.t === 'v') data[k] = el.value;
    else { const x = parseFloat(String(el.value).replace(',', '.')); if (!isFinite(x)) return false; data[k] = x; }
    return true;
  }
  $('poleTvar').addEventListener('input', (e) => { if (e.target.id && cteni(e.target, defTvar(), S.tvar)) naplanuj(); });
  $('poleTvar').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' && cteni(e.target, defTvar(), S.tvar)) naplanuj(); });
  const zmenaM = (e) => {
    const def = POLE_M[S.metoda](), data = S[sekceM(S.metoda)];
    if (!e.target.id || !cteni(e.target, def, data)) return;
    viditelnost(def, data, $('poleMetody'));
    if (e.target.id === 'm_drevina' || e.target.id === 'm_material') vykresliDreviny();
    naplanuj();
  };
  $('poleMetody').addEventListener('input', zmenaM);
  $('poleMetody').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') zmenaM(e); });

  $('metody').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) nastavMetodu(b.dataset.m); });
  function nastavMetodu(m) { if (!METODY.includes(m) || m === S.metoda) return; S.metoda = m; vykresliFormulare(); prepocti(); }
  $('typy').addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (!b || b.dataset.t === S.tvar.typ) return; S.tvar.typ = b.dataset.t; vykresliFormulare(); prepocti(); });

  /* ---------- body splinu ---------- */
  function vykresliBody() {
    const b = S.tvar.body || [];
    let h = '<tr><th>#</th><th>x</th><th>y</th><th></th></tr>';
    b.forEach((q, i) => { h += `<tr data-i="${i}"><td>${i + 1}</td><td><input type="number" step="1" data-k="0" value="${esc(q[0])}" aria-label="x bodu ${i + 1}"></td><td><input type="number" step="1" data-k="1" value="${esc(q[1])}" aria-label="y bodu ${i + 1}"></td><td><button class="btn btn-sec btn-mini" data-smaz="${i}" type="button" aria-label="Smazat bod ${i + 1}">✕</button></td></tr>`; });
    $('tabBody').innerHTML = h;
  }
  $('tabBody').addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-i]'); if (!tr) return;
    const x = parseFloat(String(e.target.value).replace(',', '.')); if (!isFinite(x)) return;
    S.tvar.body[+tr.dataset.i][+e.target.dataset.k] = x; naplanuj();
  });
  $('tabBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-smaz]'); if (!b) return;
    if (S.tvar.body.length <= 2) { toast('Spline potřebuje aspoň 2 body.'); return; }
    S.tvar.body.splice(+b.dataset.smaz, 1); vykresliBody(); prepocti();
  });
  $('btnBodPridat').addEventListener('click', () => { const b = S.tvar.body, l = b[b.length - 1] || [0, 0]; b.push([l[0] + 100, l[1]]); vykresliBody(); prepocti(); });

  /* ---------- tabulka dřevin / materiálů ---------- */
  function vykresliDreviny() {
    if (S.metoda === 'zarezy') {
      $('sumDreviny').textContent = 'Tabulka materiálů – min. poměr R/z (typické, editovatelné)';
      $('tabDreviny').innerHTML = '<tr><th>Materiál</th><th>R/z</th><th>Poznámka</th></tr>' + S.materialy.map((m, i) => `<tr data-i="${i}"><td>${esc(m.nazev)}</td><td><input type="number" step="1" min="1" data-k="rz" value="${esc(m.rz)}" aria-label="R/z ${esc(m.nazev)}"></td><td>${esc(m.pozn)}</td></tr>`).join('');
      return;
    }
    $('sumDreviny').textContent = 'Tabulka dřevin – typické hodnoty, editovatelné';
    $('tabDreviny').innerHTML = '<tr><th>Dřevina</th><th title="lamela za studena">R/t lam.</th><th title="pára s pásem">R/t pás</th><th title="pára bez pásu">R/t bez</th><th>MPa</th></tr>'
      + S.dreviny.map((d, i) => `<tr data-i="${i}" title="${esc(d.pozn)}"><td>${esc(d.nazev)}</td>${['lam', 'pas', 'bez', 'tlak'].map((k) => `<td><input type="number" step="${k === 'tlak' ? 0.1 : k === 'lam' ? 1 : 0.5}" min="0.1" data-k="${k}" value="${esc(d[k])}" aria-label="${k} ${esc(d.nazev)}"></td>`).join('')}</tr>`).join('');
  }
  $('tabDreviny').addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-i]'); if (!tr) return;
    const x = parseFloat(String(e.target.value).replace(',', '.')); if (!(x > 0)) return;
    (S.metoda === 'zarezy' ? S.materialy : S.dreviny)[+tr.dataset.i][e.target.dataset.k] = x; naplanuj();
  });
  $('btnDrevinyReset').addEventListener('click', () => {
    if (S.metoda === 'zarezy') S.materialy = OHD.MATERIALY_KERF.map((d) => Object.assign({}, d)); else S.dreviny = OHD.DREVINY.map((d) => Object.assign({}, d));
    vykresliDreviny(); prepocti();
  });

  /* ---------- předvolby ---------- */
  $('predvolba').innerHTML = PREDVOLBY.map((p) => `<option value="${p.id}">${esc(p.nazev)}</option>`).join('');
  $('predvolba').addEventListener('change', () => {
    const p = PREDVOLBY.find((x) => x.id === $('predvolba').value); if (!p || !p.m) return;
    const V = OHD.vychoziProjekt(p.m);
    S.metoda = p.m;
    S.tvar = Object.assign(V.tvar, p.tvar || {});
    S[sekceM(p.m)] = Object.assign(V[sekceM(p.m)], p.p || {});
    if (p.id === 'naramek') S.stl.sirkaTisk = 0;
    S.nazev = p.nazev.replace(/^[^:]+:\s*/, '');
    $('nazevProjektu').value = S.nazev;
    $('predvolba').value = '';
    vykresliFormulare(); prepocti();
  });

  /* ---------- tisk / STL nastavení ---------- */
  function doNastaveni() {
    for (const id of TISK_POLE) $(id).value = S.tisk[id];
    for (const id of STL_POLE) { const el = $(id); if (el.type === 'checkbox') el.checked = !!S.stl[id]; else el.value = S.stl[id]; }
    $('nazevProjektu').value = S.nazev || '';
    $('blokPapir').classList.toggle('skryte', S.tisk.papir !== 'vlastni');
  }
  for (const [pole, sek] of [[TISK_POLE, 'tisk'], [STL_POLE, 'stl']]) for (const id of pole) {
    const el = $(id);
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (el.type === 'checkbox') S[sek][id] = el.checked;
      else if (el.tagName === 'SELECT') S[sek][id] = el.value;
      else { const x = parseFloat(String(el.value).replace(',', '.')); if (!isFinite(x)) return; S[sek][id] = x; }
      $('blokPapir').classList.toggle('skryte', S.tisk.papir !== 'vlastni');
      if (sek === 'tisk') { naplanujListy(); uloz(); } else uloz();
    });
  }
  $('dilStl').addEventListener('change', () => { S.stl.dilStl = $('dilStl').value; uloz(); });
  $('nazevProjektu').addEventListener('input', () => { S.nazev = $('nazevProjektu').value; uloz(); });

  /* ---------- přepočet ---------- */
  let timer = 0, timerL = 0, scs = [];
  const naplanuj = () => { clearTimeout(timer); timer = setTimeout(prepocti, 90); };
  const naplanujListy = () => { clearTimeout(timerL); timerL = setTimeout(vykresliListy, 120); };
  function prepocti() {
    try { N = OHD.navrh(S); } catch (e) { console.error(e); $('varovani').innerHTML = `<li class="chyba">${esc(e.message)}</li>`; return; }
    $('popisVysledku').textContent = NAZEV_M[S.metoda];
    $('varovani').innerHTML = N.chyby.map((v) => `<li class="chyba">${esc(v)}</li>`).join('') + N.varovani.map((v) => `<li>${esc(v)}</li>`).join('');
    $('souhrn').innerHTML = N.souhrn.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');
    $('kusovnik').innerHTML = '<tr><th>Pol.</th><th>Název</th><th>Ks</th><th>Rozměr (mm)</th><th>Materiál</th><th>Poznámka</th></tr>' + N.kusovnik.map((k) => `<tr><td>${esc(k.pol)}</td><td>${esc(k.nazev)}</td><td>${esc(k.ks)}</td><td style="white-space:nowrap">${esc(k.rozmer)}</td><td>${esc(k.material)}</td><td>${esc(k.pozn)}</td></tr>`).join('');
    // 2D pohledy
    const zar = S.metoda === 'zarezy';
    $('nadpisPohled1').textContent = zar ? 'Deska po ohnutí' : S.metoda === 'para' ? 'Kopyto, díl, pás s dorazy a svěrky' : 'Forma, balík lamel a svěrky';
    $('nadpisPohled2').textContent = zar ? 'Detail zářezů' : 'Řez balíkem a vrstvami formy';
    try { $('pohled1').innerHTML = OHDN.sestava(N); $('pohled2').innerHTML = OHDN.rez(N); } catch (e) { console.error(e); $('pohled1').textContent = 'Náhled nejde vykreslit: ' + e.message; }
    $('blokPohled3').classList.toggle('skryte', !zar);
    $('legenda').classList.toggle('skryte', zar);
    if (zar) $('pohled3').innerHTML = OHDN.zarezyRovne(N);
    // STL díly
    $('dilStl').innerHTML = N.dily.map((d) => `<option value="${esc(d.id)}"${d.id === S.stl.dilStl ? ' selected' : ''}>${esc(d.id)} – ${esc(d.nazev)}</option>`).join('');
    $('btnStl').disabled = !N.dily.length || N.chyby.length > 0;
    $('princip').innerHTML = PR.princip(S.metoda);
    $('postup').innerHTML = PR.postup(S.metoda);
    vykresliListy();
    aktualizuj3d();
    uloz();
  }
  function vykresliListy() {
    if (!N) return;
    scs = OHDV.sceny(N, { nazev: S.nazev });
    const [pw, ph] = OHD.rozmerPapiru(S.tisk);
    let celkem = 0, h = '';
    for (const sc of scs) {
      const rv = OHD.rozvrhListu(sc, pw, ph, S.tisk); celkem += rv.listy.length;
      let s = OHDV.svg(sc, { okraj: 2 });
      const r = rv.listy.map((l) => `<rect x="${l.x0}" y="${-l.y1}" width="${l.x1 - l.x0}" height="${l.y1 - l.y0}" fill="none" stroke="#888" stroke-dasharray="6 4" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');
      s = s.replace(/width="[\d.]+mm" height="[\d.]+mm"/, '').replace('</svg>', r + '</svg>');
      const o = sc.x1 - sc.x0, v = sc.y1 - sc.y0;
      h += `<figure><div class="papir">${s}</div><figcaption>${esc(sc.nazev)} · ${cz(o, 0)} × ${cz(v, 0)} mm · ${rv.listy.length} ${rv.listy.length === 1 ? 'list' : rv.listy.length < 5 ? 'listy' : 'listů'}</figcaption></figure>`;
    }
    $('listy').innerHTML = h;
    const vrst = N.geo.nVrstev ? ` Každý díl se vyřízne ${N.geo.nVrstev}× z MDF ${cz(N.geo.mdf, 0)} mm.` : '';
    $('infoListy').innerHTML = `PDF: <b>${celkem}</b> ${celkem === 1 ? 'list' : celkem < 5 ? 'listy' : 'listů'} ve skutečné velikosti + souhrn a kusovník.${vrst}`;
    $('infoSablony').textContent = `${scs.length} ${scs.length === 1 ? 'výkres' : scs.length < 5 ? 'výkresy' : 'výkresů'} · ${celkem} listů`;
  }

  /* ---------- soubory ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(S.nazev || 'ohyb_' + S.metoda).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'ohyb_dreva';
  const nazevSouboru = (pr, dop) => `${zaklad()}${dop ? '_' + dop : ''}.${pr}`;
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const nazev = (S.nazev || 'Ohýbání dřeva') + ' – ' + NAZEV_M[S.metoda];
      const st = OHDV.strany(N, OHDV.sceny(N, { nazev: S.nazev }), S.tisk, { nazev, postup: PR.postupPdf(S.metoda) });
      stahni(OHDV.pdf(window.jspdf.jsPDF, st, { pismo, nazev }).output('blob'), nazevSouboru('pdf'));
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });
  $('btnSvg').addEventListener('click', () => { if (N) stahni(OHDV.svgVse(OHDV.sceny(N, { nazev: S.nazev })), nazevSouboru('svg'), 'image/svg+xml'); });
  $('btnDxf').addEventListener('click', () => { if (N) stahni(OHDV.dxf(OHDV.sceny(N, { nazev: S.nazev })), nazevSouboru('dxf'), 'application/dxf'); });
  $('btnCsv').addEventListener('click', () => {
    if (!N) return;
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const r = ['pozice;nazev;ks;rozmer_mm;material;poznamka'].concat(N.kusovnik.map((k) => [k.pol, k.nazev, k.ks, k.rozmer, k.material, k.pozn].map(q).join(';')));
    stahni('﻿' + r.join('\r\n') + '\r\n', nazevSouboru('csv', 'kusovnik'), 'text/csv;charset=utf-8');
  });

  /* ---------- STL ---------- */
  let manifoldSlib = null;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nactiManifold() {
    if (manifoldSlib) return manifoldSlib;
    manifoldSlib = (async () => {
      globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
      if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
      let volby;
      if (location.protocol === 'file:') {
        await nactiSkript('lib/manifold/manifold.wasm.js');
        const b = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) bin[i] = b.charCodeAt(i);
        delete globalThis.MANIFOLD_WASM_B64; volby = { wasmBinary: bin };
      } else volby = { locateFile: (f) => new URL('lib/manifold/' + f, location.href).href };
      const w = await globalThis.ManifoldModule(volby); w.setup(); return w;
    })();
    manifoldSlib.catch(() => { manifoldSlib = null; });
    return manifoldSlib;
  }
  async function sitStl() {
    const d = N.dily.find((x) => x.id === $('dilStl').value) || N.dily[0], w = await nactiManifold();
    const vyska = +S.stl.sirkaTisk > 0 ? +S.stl.sirkaTisk : N.geo.sirkaFormy;
    return { d, m: OHDSTL.forma(w, d, Object.assign({}, S.stl, { vyska })) };
  }
  $('btnStl').addEventListener('click', async () => {
    const b = $('btnStl'), puv = b.textContent; b.disabled = true; b.textContent = 'Počítám STL…';
    try {
      await new Promise((r) => setTimeout(r, 20));
      const { d, m } = await sitStl();
      stahni(new Blob([OHDSTL.stlBinarni(m.poz, m.idx, 'forma ' + d.id)], { type: 'model/stl' }), nazevSouboru('stl', d.id));
      for (const v of m.varovani) toast(v);
      toast(`STL ${d.id}: ${m.casti} ${m.casti === 1 ? 'kus' : m.casti < 5 ? 'kusy' : 'kusů'} (${m.rozmery.map((r) => r.map((x) => cz(x, 0)).join('×')).join(', ')} mm), objem ${cz(m.objem / 1000, 1)} cm³, uzavřené těleso.`);
    } catch (e) { console.error(e); toast('Chyba STL: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- 3D ---------- */
  let pohled3d = null, nacita3d = false;
  function aktualizuj3d() { if (pohled3d && N && !N.chyby.length) pohled3d.aktualizuj(N); }
  function nacti3d() {
    if (pohled3d || nacita3d) return;
    nacita3d = true;
    const hotovo = () => {
      try {
        pohled3d = OHD3D.vytvor($('obal3d')); $('stav3d').textContent = '';
        pohled3d.naZmenuU = (u) => { $('rozsahU').value = Math.round(u * 100); $('hodnotaU').textContent = Math.round(u * 100) + ' %'; };
        pohled3d.nastavU(+$('rozsahU').value / 100);
        aktualizuj3d();
      } catch (e) { $('stav3d').textContent = '3D se nepodařilo spustit: ' + e.message; }
    };
    if (window.THREE) { hotovo(); return; }
    nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  $('rozsahU').addEventListener('input', () => { const u = +$('rozsahU').value / 100; $('hodnotaU').textContent = Math.round(u * 100) + ' %'; if (pohled3d) { pohled3d.nastavU(u); $('b3dHraj').textContent = '▶ Přehrát'; } });
  $('b3dHraj').addEventListener('click', () => { if (!pohled3d) return; const h = !pohled3d.hraje; pohled3d.hraj(h); $('b3dHraj').textContent = h ? '⏸ Zastavit' : '▶ Přehrát'; });
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(-28, 24));
  $('b3dCelo').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 0));
  $('b3dShora').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 89));

  /* ---------- projekty ---------- */
  function vykresliProjekty() {
    const P = projekty(), jm = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((j) => `<option value="${esc(j)}">${esc(j)} – ${esc(NAZEV_M[P[j].metoda] || '')}</option>`).join('') : '<option value="">– zatím nic –</option>';
  }
  $('btnUlozit').addEventListener('click', async () => {
    let jm = (S.nazev || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', NAZEV_M[S.metoda]); if (!jm) return; jm = jm.trim(); S.nazev = jm; $('nazevProjektu').value = jm; }
    const P = projekty();
    if (P[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    P[jm] = JSON.parse(JSON.stringify(S)); P[jm].ulozeno = new Date().toISOString();
    if (ulozProjekty(P)) { vykresliProjekty(); $('seznamProjektu').value = jm; toast('Projekt uložen.'); }
    uloz();
  });
  function nactiProjekt(u) { S = slouc(OHD.vychoziProjekt(), u); vykresliFormulare(); doNastaveni(); prepocti(); }
  $('btnNacist').addEventListener('click', () => { const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return; nactiProjekt(P[j]); toast('Načteno: ' + j); });
  $('btnSmazat').addEventListener('click', async () => {
    const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return;
    if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return;
    delete P[j]; ulozProjekty(P); vykresliProjekty();
  });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify(Object.assign({ aplikace: 'ohyb_dreva', exportovano: new Date().toISOString() }, S), null, 1), nazevSouboru('json'), 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async () => {
    const f = $('souborProjekt').files[0]; $('souborProjekt').value = '';
    if (!f) return;
    try {
      const u = JSON.parse(await f.text());
      if (!u || typeof u !== 'object' || !METODY.includes(u.metoda) || !u.tvar) throw new Error('soubor není projekt ohýbání dřeva');
      nactiProjekt(u); toast('Projekt importován.');
    } catch (e) { toast('Import se nepodařil: ' + e.message, true); }
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty? (Uložené projekty zůstanou.)'))) return;
    S = OHD.vychoziProjekt(S.metoda); vykresliFormulare(); doNastaveni(); prepocti();
  });

  /* ---------- záložky a klávesy ---------- */
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    for (const x of $('zalozky').children) x.setAttribute('aria-selected', String(x === b));
    for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.p !== b.dataset.z;
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const m = /^(?:Digit|Numpad)([1-3])$/.exec(e.code);
    if (m) { e.preventDefault(); nastavMetodu(METODY[+m[1] - 1]); }
  });

  /* ---------- start ---------- */
  vykresliFormulare(); doNastaveni(); vykresliProjekty(); prepocti();
  window.OHDApp = { get stav() { return S; }, get navrh() { return N; }, nastavMetodu, prepocti, nactiManifold, sitStl, get pohled3d() { return pohled3d; } };
})();
