/* Návrhář vaček – ovládání stránky nad společným zapojením gen3d/aplikace.js (historie, formulář [data-p], projekt,
   sdílení, Moje…, klávesy). Tady jen to, co je pro vačky zvláštní: 2D animace, diagramy, porovnání zákonů, 3D disk, exporty. */
/* global Vacky, VackyExport, VPROJ, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const V = window.Vacky, X = window.VackyExport, P = window.VPROJ;
  const $ = id => document.getElementById(id);
  const f = (x, d) => V.fmt(x, d);
  const esc = G3D.esc;
  const BARVY_ZAKONU = { harmonicky: '--s1', cykloidni: '--s2', p345: '--s3', p4567: '--s4' };

  // převod dosavadních dat: odkaz #p={JSON} (do 11/2026) a stav „webapp_vacky_stav“ → projekt gen3d
  let zOdkazu = null;
  try { const o = P.staryOdkaz(location.hash); if (o) zOdkazu = P.prevedStary(o); } catch (e) { zOdkazu = null; }
  try {
    const s = localStorage.getItem('webapp_vacky_stav');
    if (s && !localStorage.getItem('webapp_vacky_projekt')) localStorage.setItem('webapp_vacky_projekt', JSON.stringify(P.prevedStary(s).p));
  } catch (e) { /* bez úložiště nebo poškozený záznam */ }

  let p, r = null, v = null;          // projekt, poslední výpočet, poslední platný výpočet (kreslí se dál i při chybě zadání)
  let model = null, tiskDily = null, chyba3d = '';
  let uhel = 0, hraje = false, jednotky = 'uhel', rezim3d = false;
  const stavZobr = { tisk: false, vZakl: true, vRozt: true, vNorm: true };
  const porovnat = new Set(['harmonicky', 'cykloidni', 'p345']);
  const nahled = KNOF_NAHLED.vytvorNahled($('platno3d'));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  const app = G3D.aplikace({
    typ: 'vacky', nazev: 'Vačky', klic: 'webapp_vacky', soubor: 'vacka',
    normalizuj: P.normalizuj, vychozi: () => G3D.kopie(P.VYCHOZI), popis: P.popis,
    viditelnost: q => viditelnost(q),
    prepocitej: () => prepocitej(),
    png: () => (rezim3d ? nahled.png() : (kresli(), cv.toDataURL('image/png'))),
    pohled: j => { prepniRezim(true); nahled.pohled(j); },
    exportStl: () => exportuj('stl'),
    doModelare: async () => (await lzeExport('3mf') ? { data: KRAB.soubor3mf(tiskDily, p.nazev || 'Vačka'), pripona: '.3mf' } : null),
    zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => { nactiBarvy(); prepocitej(); },
  });

  // ───────── barvy z CSS ─────────
  let B = {}, BARVY_ZAKONU_HOD = {};
  function nactiBarvy() {
    const g = css;
    B = { text: g('--text'), muted: g('--text-muted'), faint: g('--text-faint'), border: g('--border'), bgp: g('--bg-panel'), bgd: g('--bg-deep'),
      accent: g('--accent'), danger: g('--danger'), warn: g('--warn'), ok: g('--ok'), vypln: g('--vacka-vypln'), vodici: g('--vodici'),
      hover: g('--bg-hover'), s1: g('--s1'), s2: g('--s2'), s3: g('--s3'), s4: g('--s4') };
    BARVY_ZAKONU_HOD = {};
    for (const k in BARVY_ZAKONU) BARVY_ZAKONU_HOD[k] = g(BARVY_ZAKONU[k]);
  }

  // ───────── formulář ─────────
  for (const id of ['zakonNabeh', 'zakonNavrat']) $(id).innerHTML = Object.entries(V.ZAKONY).map(([k, z]) => `<option value="${k}">${esc(z.nazev)}</option>`).join('');
  $('f_material').innerHTML = Object.entries(P.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev} · ${String(m.hustota).replace('.', ',')} g/cm³</option>`).join('');
  const NAPOVEDY = {
    hrot: 'Hrot sleduje i vydutá místa, ale bodový dotyk se rychle opotřebí. Profil = roztečná křivka.',
    kladka: 'Profil je ekvidistanta roztečné křivky (střed kladky) ve vzdálenosti Rr. Kladka nesmí mít větší poloměr, než je nejmenší poloměr křivosti vypuklé části roztečné křivky.',
    plochy: 'Talíř kolmý na osu: tlakový úhel 0°, profil musí být konvexní (Rb + s + s″ > 0). Excentricita jen posouvá dotyk po talíři.'
  };
  function viditelnost(q) {
    $('poleRr').hidden = q.typ !== 'kladka';
    $('napovedaTyp').textContent = NAPOVEDY[q.typ];
    document.querySelectorAll('[data-typzdv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typzdv === q.typ)));
  }
  document.querySelectorAll('[data-typzdv]').forEach(b => b.addEventListener('click', () => app.zmen(q => { q.typ = b.dataset.typzdv; })));

  // ───────── přepočet ─────────
  function prepocitej() {
    p = app.p;
    r = V.vypocet(p, { krok: 0.5 });
    const dv = 360 - p.beta1 - p.delta1 - p.beta2;
    $('delta2').textContent = f(Math.max(dv, 0), 1) + ' °';
    $('delta2').style.color = dv < -1e-9 ? 'var(--text-chyba)' : '';
    $('perioda').textContent = r.ok && p.n > 0 ? f(r.cas.perioda * 1000, 1) + ' ms' : '–';
    $('chybyVstupu').innerHTML = r.ok ? '' : r.chyby.map(c => '• ' + esc(c.text)).join('<br>');
    document.querySelectorAll('input.chyba,select.chyba').forEach(e => e.classList.remove('chyba'));
    if (!r.ok) for (const c of r.chyby) { const e = $(c.pole); if (e) e.classList.add('chyba'); }
    if (r.ok) { v = r; postav3d(); }
    else { model = null; tiskDily = null; chyba3d = 'Zadání obsahuje chyby – 3D model se nesestavil.'; ukaz3d(); }
    $('stav3d').textContent = chyba3d;
    app.hlaseni(P.hlaseni(r), { boxy: ['boxPohyb', 'boxDisk'] });
    souhrny();
    if (!r.ok || !v) return;
    vypisVysledky();
    kresliGrafy();
    porovnani();
    kresli();
  }
  function postav3d() {
    model = null; tiskDily = null; chyba3d = '';
    if (!v.profilPolarni) chyba3d = 'Profil není polárně jednoznačný (podřezání) – 3D model, STL ani 3MF nelze vytvořit.';
    else if (v.p.otvor / 2 >= v.ex.rMin) chyba3d = 'Otvor pro hřídel je větší než profil vačky – 3D model nelze vytvořit.';
    else {
      const d = P.disk(v, 720);
      model = { dily: [P.montazni(d, v.p.tloustka)], disk: d };
      tiskDily = G3D.tiskoveRozlozeni([d], 1);
    }
    ukaz3d();
  }
  function ukaz3d(novyPohled) {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    if (model) nahled.nastav(stavZobr.tisk ? tiskDily : model.dily, { tisk: stavZobr.tisk, uhel: p.tisk.uhel, novyPohled });
    else nahled.nastav(null);
  }
  function souhrny() {
    const Z = V.ZAKONY;
    TrubkyGui.souhrn('sPohyb', `${Z[p.zakonNabeh].kratce} / ${Z[p.zakonNavrat].kratce} · h ${f(p.h)} · Rb ${f(p.Rb)} mm`, true);
    TrubkyGui.souhrn('sZdvihatko', { hrot: 'hrotové', kladka: `kladka Rr ${f(p.Rr)}`, plochy: 'plochý talíř' }[p.typ] + (p.eps ? ` · ε ${f(p.eps)}` : '') + (p.smer === 'ccw' ? ' · ↺' : ' · ↻'), true);
    TrubkyGui.souhrn('sDisk', `tl. ${f(p.tloustka)} · otvor ⌀ ${f(p.otvor)} mm`, true);
    TrubkyGui.souhrn('sPruzina', `${f(p.m, 2)} kg · k ${f(p.k, 1)} N/mm · F₀ ${f(p.F0)} N`, true);
    TrubkyGui.souhrn('sTisk', `${P.MATERIALY[p.tisk.material].nazev} · převis ${f(p.tisk.uhel, 0)}°`, true);
  }

  // ───────── výsledky ─────────
  const box = G3D.dlazdice;
  function vypisVysledky() {
    const { ex, cas, silyEx } = v;
    const D = [];
    const stavK = kod => { const k = v.kontroly.filter(x => x.kod === kod); return k.some(x => x.uroven === 'chyba') ? 'chyba-t' : k.some(x => x.uroven === 'varovani') ? 'mez-t' : ''; };
    if (p.typ !== 'plochy') {
      D.push(['Max. tlakový úhel', f(Math.max(ex.phiMax, -ex.phiMin) * V.DEG) + ' °', `náběh ${f(ex.phiMax * V.DEG)}° (${f(ex.phiMaxUhel)}°), návrat ${f(-ex.phiMin * V.DEG)}° (${f(ex.phiMinUhel)}°)`, stavK('tlak')]);
    } else D.push(['Tlakový úhel', '0 °', 'talíř kolmý na osu', '']);
    if (p.typ === 'kladka') D.push(['Min. ρ roztečné křivky', f(ex.rhoRoztecMinVypukla) + ' mm', `u ${f(ex.rhoRoztecMinVypuklaUhel)}°; Rr = ${f(p.Rr)} mm`, stavK('podrez')]);
    else if (p.typ === 'plochy') D.push(['Min. ρ = Rb + s + s″', f(ex.rhoAlgMin) + ' mm', `u ${f(ex.rhoAlgUhel)}°`, stavK('konvex')]);
    else D.push(['Min. ρ vypuklé části', f(ex.rhoMin) + ' mm', `u ${f(ex.rhoMinUhel)}°`, '']);
    D.push(['Průměr vačky', '⌀ ' + f(2 * ex.rMax) + ' mm', `nejmenší ⌀ ${f(2 * ex.rMin)} mm`, stavK('otvor')]);
    if (p.typ === 'plochy') D.push(['Poloměr talíře min.', f(Math.max(-ex.talirOd, ex.talirDo)) + ' mm', `dotyk ${f(ex.talirOd)} až ${f(ex.talirDo)} mm`, '']);
    D.push(['Max. rychlost', f(cas.vMax, 3) + ' m/s', `s′max ${f(Math.max(ex.vMax, -ex.vMin), 2)} mm/rad`, '']);
    D.push(['Max. zrychlení', f(cas.aMax, 1) + ' m/s²', `= ${f(cas.aMax / 9.81, 1)} g; s″max ${f(Math.max(ex.aMax, -ex.aMin), 1)} mm/rad²`, '']);
    D.push(['Max. ryv (konečný)', f(cas.jMax, 0) + ' m/s³', v.skoky.some(s => Math.abs(s.da) > 1e-6) ? 'plus ∞ na skocích zrychlení' : 'zrychlení spojité', stavK('skoka')]);
    D.push(['Max. normálová síla', f(silyEx.FnMax, 1) + ' N', `u ${f(silyEx.FnMaxUhel)}°`, '']);
    D.push(['Min. přítlak v ose', f(silyEx.FyMin, 1) + ' N', silyEx.FyMin < 0 ? `odskok! potřebné F₀ ≥ ${f(silyEx.F0potreba, 1)} N` : `u ${f(silyEx.FyMinUhel)}°`, stavK('odskok')]);
    D.push(['Max. hnací moment', f(silyEx.Mmax / 1000, 2) + ' N·m', `zpětný ${f(silyEx.Mmin / 1000, 2)} N·m (bez tření)`, '']);
    $('dlazdice').innerHTML = D.map(([t, h, pp, c]) => box(t, h, esc(pp), c)).join('');
    // 3D tisk disku
    if (!model) { $('vTisk').innerHTML = box('3D model', 'nelze sestavit', esc(chyba3d), 'chyba-t'); $('vSit').innerHTML = ''; return; }
    const d = model.disk, b = G3D.obal(d.poz), mat = P.MATERIALY[p.tisk.material];
    const o = G3D.odhadTisku(d.objem, mat.hustota, { dilu: 1 }), k = KRAB.kontrolaSite(d.poz, d.idx);
    $('vTisk').innerHTML = box('Rozměry disku', `${f(b[3] - b[0])} × ${f(b[4] - b[1])} × ${f(b[5] - b[2])} mm`, 'š × h × tloušťka')
      + box('Objem', `${f(d.objem / 1000, 2)} cm³`, 'plný disk')
      + box('Hmotnost', `${f(o.g, o.g < 10 ? 1 : 0)} g`, `${mat.nazev}, plný díl (při 30 % výplni zhruba ${f(o.g * 0.55, 0)} g)`)
      + box('Filament', `${f(o.metru, 2)} m`, 'průměr 1,75 mm, plný díl')
      + box('Doba tisku', `≈ ${o.minut < 60 ? o.minut + ' min' : f(o.minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
    $('vSit').innerHTML = box('Síť disku', k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${k.teles} těleso`, k.uzavrena && k.teles === 1 ? 'ok-t' : 'chyba-t');
  }

  // ───────── animace ─────────
  const cv = $('platno');
  function kresli() {
    if (!v) return;
    kresliPlatno();
    odecet();
    for (const gr of grafy) znackaGrafu(gr);
  }
  let pohled = null;
  function rot(q, a) { const c = Math.cos(a), s = Math.sin(a); return [c * q[0] - s * q[1], s * q[0] + c * q[1]]; }
  function spocitejPohled() {
    const p = v.p;
    const R = v.ex.rMax;
    const stem = Math.max(0.55 * R, p.h * 1.2);
    const sirka = Math.max(4, 0.1 * R);
    const gy1 = p.Rb + p.h + (p.typ === 'kladka' ? 2 * p.Rr : sirka * 1.5) + stem * 0.25, gy2 = gy1 + stem * 0.45;
    const nahore = gy2 + 6 + p.h;
    const sir = p.typ === 'plochy' ? Math.max(-v.ex.talirOd, v.ex.talirDo) + Math.abs(p.eps) + 6 : Math.abs(p.eps) + (p.Rr || 0) + 2 * sirka + 4;
    const pul = Math.max(R + 4, sir);
    const ymin = -R - 4, vys = nahore - ymin;
    const span = Math.max(2 * pul, vys) * 1.04;
    pohled = { span, cx: 0, cy: (nahore + ymin) / 2, stem, sirka, gy1, gy2 };
  }
  function kresliPlatno() {
    const p = v.p;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    spocitejPohled();
    const sc = Math.min(w, h) / pohled.span;
    const T = q => [w / 2 + (q[0] - pohled.cx) * sc, h / 2 - (q[1] - pohled.cy) * sc];
    const sm = p.smer === 'ccw' ? -1 : 1;
    const M = q => [sm * q[0], q[1]];          // zrcadlení pevného rámu
    const ang = -sm * uhel * V.RAD;            // natočení vačky
    const b = V.bod(v.p, uhel);
    const cesta = (pts, uzavrit) => { g.beginPath(); pts.forEach((q, i) => { const t = T(q); i ? g.lineTo(t[0], t[1]) : g.moveTo(t[0], t[1]); }); if (uzavrit) g.closePath(); };
    const kruh = (c, r) => { const t = T(c); g.beginPath(); g.arc(t[0], t[1], r * sc, 0, 2 * Math.PI); };
    const lw = Math.max(1, 1.5);
    // vačka
    const prof = v.profil.map(q => rot(q, ang));
    cesta(prof, true);
    if (p.otvor > 0) { const t = T([0, 0]); g.moveTo(t[0] + p.otvor / 2 * sc, t[1]); g.arc(t[0], t[1], p.otvor / 2 * sc, 0, 2 * Math.PI, true); }
    g.fillStyle = B.vypln; g.fill('evenodd');
    g.strokeStyle = B.text; g.lineWidth = lw; cesta(prof, true); g.stroke();
    if (p.otvor > 0) { kruh([0, 0], p.otvor / 2); g.stroke(); }
    // značka 0° na vačce
    const b0 = v.profil[0], d0 = Math.hypot(b0[0], b0[1]);
    const zn = rot([b0[0] / d0 * (p.Rb * 0.85), b0[1] / d0 * (p.Rb * 0.85)], ang), zn0 = rot([b0[0] / d0 * (p.otvor / 2 + 1), b0[1] / d0 * (p.otvor / 2 + 1)], ang);
    g.strokeStyle = B.danger; g.lineWidth = 2; cesta([zn0, zn]); g.stroke();
    g.fillStyle = B.danger; g.font = '11px ' + getComputedStyle(document.body).fontFamily;
    const tz = T(zn); g.fillText('0°', tz[0] + 3, tz[1] - 3);
    g.setLineDash([6, 4]); g.lineWidth = 1;
    if (stavZobr.vZakl) { g.strokeStyle = B.muted; kruh([0, 0], p.Rb); g.stroke(); }
    if (stavZobr.vRozt && p.typ === 'kladka') { g.strokeStyle = B.accent; cesta(v.roztecna.map(q => rot(q, ang)), true); g.stroke(); }
    g.setLineDash([]);
    // osy středu
    g.strokeStyle = B.faint; g.lineWidth = 1; g.setLineDash([10, 3, 2, 3]);
    const r0 = Math.max(p.otvor / 2 + 4, 6);
    cesta([[-r0, 0], [r0, 0]]); g.stroke(); cesta([[0, -r0], [0, r0]]); g.stroke(); g.setLineDash([]);
    // šipka otáčení
    {
      const t = T([0, 0]), r = Math.max(p.otvor / 2 + 3, 0.28 * p.Rb) * sc;
      const a1 = -Math.PI * 0.75, a2 = -Math.PI * 0.25;   // obloučkem nahoře (osa y obrazovky dolů)
      g.strokeStyle = B.accent; g.lineWidth = 2; g.beginPath(); g.arc(t[0], t[1], r, a1, a2); g.stroke();
      const konec = sm > 0 ? a2 : a1, dir = sm > 0 ? 1 : -1;
      const ex = t[0] + r * Math.cos(konec), ey = t[1] + r * Math.sin(konec);
      const tx = -Math.sin(konec) * dir, ty = Math.cos(konec) * dir;
      g.fillStyle = B.accent; g.beginPath(); g.moveTo(ex + tx * 8, ey + ty * 8); g.lineTo(ex - tx * 2 + Math.cos(konec) * 5, ey - ty * 2 + Math.sin(konec) * 5); g.lineTo(ex - tx * 2 - Math.cos(konec) * 5, ey - ty * 2 - Math.sin(konec) * 5); g.closePath(); g.fill();
    }
    // zdvihátko (pevný rám)
    const st = M(b.stred);
    const xa = st[0];
    const sirka = pohled.sirka, gy1 = pohled.gy1, gy2 = pohled.gy2;
    let yb;               // spodek dříku
    if (p.typ === 'hrot') yb = st[1] + sirka;
    else if (p.typ === 'kladka') yb = st[1];
    else yb = st[1] + Math.max(2, 0.05 * v.ex.rMax);
    const yt = gy2 + 4 + b.s;
    g.fillStyle = B.vodici;
    for (const s of [-1, 1]) { const a = T([xa + s * sirka / 2, gy2]), c = T([xa + s * (sirka / 2 + sirka * 0.9), gy1]); g.fillRect(Math.min(a[0], c[0]), a[1], Math.abs(c[0] - a[0]), c[1] - a[1]); }
    g.strokeStyle = B.text; g.lineWidth = lw; g.fillStyle = B.bgp;
    const obd = (x1, y1, x2, y2) => { const a = T([x1, y2]), c = T([x2, y1]); g.beginPath(); g.rect(a[0], a[1], c[0] - a[0], c[1] - a[1]); g.fill(); g.stroke(); };
    obd(xa - sirka / 2, yb, xa + sirka / 2, yt);
    if (p.typ === 'hrot') {
      cesta([[xa, st[1]], [xa - sirka / 2, st[1] + sirka], [xa + sirka / 2, st[1] + sirka]], true); g.fill(); g.stroke();
    } else if (p.typ === 'kladka') {
      kruh(st, p.Rr); g.fill(); g.stroke();
      kruh(st, Math.max(0.8, p.Rr * 0.18)); g.fillStyle = B.text; g.fill();
    } else {
      const W = Math.max(-v.ex.talirOd, v.ex.talirDo) + 3;
      obd(xa - W, st[1], xa + W, st[1] + Math.max(2, 0.05 * v.ex.rMax));
    }
    // osa zdvihátka
    g.strokeStyle = B.faint; g.lineWidth = 1; g.setLineDash([10, 3, 2, 3]);
    cesta([[xa, st[1] - (p.typ === 'kladka' ? p.Rr + 4 : 4)], [xa, yt + 4]]); g.stroke(); g.setLineDash([]);
    // dotyk, normála, tlakový úhel
    const P = M(b.P);
    if (stavZobr.vNorm) {
      const n = p.typ === 'plochy' ? [0, 1] : M(b.normala);
      const L = 0.45 * v.ex.rMax;
      g.strokeStyle = B.warn; g.lineWidth = 1.5;
      cesta([[P[0] - n[0] * L * 0.4, P[1] - n[1] * L * 0.4], [P[0] + n[0] * L, P[1] + n[1] * L]]); g.stroke();
      if (p.typ !== 'plochy' && Math.abs(b.phi) > 0.2 * V.RAD) {
        const c = T(st), r = Math.min(L * 0.8, 0.35 * v.ex.rMax) * sc;
        const aN = Math.atan2(-n[1], n[0]), aV = -Math.PI / 2;
        g.beginPath(); g.arc(c[0], c[1], r, Math.min(aN, aV), Math.max(aN, aV)); g.stroke();
        g.fillStyle = B.text; g.font = '600 12px ' + getComputedStyle(document.body).fontFamily;
        const am = (aN + aV) / 2;
        const tx = c[0] + Math.cos(am) * (r + 6), ty = c[1] + Math.sin(am) * (r + 6);
        const txt = 'φ = ' + f(Math.abs(b.phi) * V.DEG) + '°', tw = g.measureText(txt).width;
        const lx = Math.cos(am) >= 0 ? tx + sirka * sc * 0.6 : tx - tw - sirka * sc * 0.6;
        g.fillStyle = B.bgp; g.globalAlpha = 0.85; g.fillRect(lx - 3, ty - 10, tw + 6, 15); g.globalAlpha = 1;
        g.fillStyle = B.text; g.fillText(txt, lx, ty + 2);
      }
    }
    const tp = T(P); g.fillStyle = B.danger; g.beginPath(); g.arc(tp[0], tp[1], 3.5, 0, 2 * Math.PI); g.fill();
  }
  function odecet() {
    const p = v.p;
    const b = V.bod(v.p, uhel);
    const w_ = v.cas.w;
    const tim = jednotky === 'cas';
    const fy = v.p.F0 + v.p.k * b.s + v.p.m * (b.s2 * w_ * w_ / 1000 + (v.p.svisle ? 9.81 : 0));
    const polozky = [
      ['úhel θ', f(uhel, 1) + ' °'], ['zdvih s', f(b.s, 3) + ' mm'],
      tim ? ['rychlost v', f(b.s1 * w_ / 1000, 3) + ' m/s'] : ["s′", f(b.s1, 2) + ' mm/rad'],
      tim ? ['zrychlení a', f(b.s2 * w_ * w_ / 1000, 1) + ' m/s²'] : ["s″", f(b.s2, 2) + ' mm/rad²'],
      ['tlakový úhel φ', f(b.phi * V.DEG, 2) + ' °'],
      ['ρ profilu', (Math.abs(b.rho) > 1e5 ? '∞' : f(b.rho, 1)) + ' mm'],
      ['síla F_n', f(fy / Math.cos(b.phi), 1) + ' N']
    ];
    $('odecet').innerHTML = polozky.map(([a, c]) => `<div>${a}<b>${c}</b></div>`).join('');
    cv.setAttribute('aria-label', `Vačka natočená o ${f(uhel, 1)}°, zdvih ${f(b.s, 2)} mm, tlakový úhel ${f(b.phi * V.DEG, 1)}°`);
    $('uhel').value = uhel;
  }
  let posledni = 0;
  function smycka(t) {
    if (!hraje) return;
    const dt = posledni ? Math.min(0.1, (t - posledni) / 1000) : 0; posledni = t;
    const r = $('rychlost').value;
    const degS = r === 'real' ? 6 * (p.n || 0) : 360 / Number(r);
    uhel = (uhel + degS * dt) % 360;
    uhel = Math.round(uhel * 100) / 100;
    kresli();
    requestAnimationFrame(smycka);
  }
  function prepniPrehravani(stav) {
    hraje = stav === undefined ? !hraje : stav;
    $('btnPrehrat').setAttribute('aria-pressed', String(hraje));
    $('btnPrehrat').textContent = hraje ? '⏸ Pozastavit' : '▶ Přehrát';
    if (hraje) { posledni = 0; requestAnimationFrame(smycka); }
  }

  // ───────── grafy ─────────
  const grafy = [];
  function novyGraf(kontejner, titul) {
    const d = document.createElement('div'); d.className = 'graf';
    d.innerHTML = `<div class="titul"></div><canvas></canvas><div class="tip" hidden></div>`;
    kontejner.appendChild(d);
    const gr = { el: d, cv: d.querySelector('canvas'), tip: d.querySelector('.tip'), titulEl: d.querySelector('.titul'), data: null, hover: null };
    gr.titulEl.textContent = titul;
    const pohyb = e => {
      if (!gr.data) return;
      const r = gr.cv.getBoundingClientRect(); const x = e.clientX - r.left;
      gr.hover = gr.data.xz(x);
      zobrazTip(gr, x, e.clientY - r.top);
      vykresliGraf(gr);
    };
    gr.cv.addEventListener('pointermove', pohyb);
    gr.cv.addEventListener('pointerleave', () => { gr.hover = null; gr.tip.hidden = true; vykresliGraf(gr); });
    gr.cv.addEventListener('click', e => {
      if (!gr.data || !gr.data.naUhel) return;
      const r = gr.cv.getBoundingClientRect(); const x = gr.data.xz(e.clientX - r.left);
      uhel = Math.round(Math.min(360, Math.max(0, x)) * 2) / 2 % 360; prepniPrehravani(false); kresli();
    });
    return gr;
  }
  function pekneKroky(min, max, n) {
    const rozsah = max - min || 1, hrube = rozsah / n, mag = Math.pow(10, Math.floor(Math.log10(hrube)));
    const k = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= hrube) || 10 * mag;
    const out = []; for (let t = Math.ceil(min / k) * k; t <= max + k * 1e-9; t += k) out.push(Math.abs(t) < k * 1e-9 ? 0 : t);
    return { kroky: out, k };
  }
  /** data: {serie:[{y[], barva, carkovana, popis}], x[], xMin, xMax, jednotka, pasy, naUhel, xPopis, xKroky, nekonecna:[x], des} */
  function nastavGraf(gr, data) { gr.data = data; vykresliGraf(gr); }
  function vykresliGraf(gr) {
    const D = gr.data; if (!D) return;
    const dpr = window.devicePixelRatio || 1, cv = gr.cv;
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const font = getComputedStyle(document.body).fontFamily;
    let ymin = Infinity, ymax = -Infinity;
    for (const s of D.serie) for (const y of s.y) if (isFinite(y)) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    if (!isFinite(ymin)) { ymin = 0; ymax = 1; }
    if (D.nula !== false) { ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0); }
    if (ymax - ymin < 1e-12) { ymax += 1; ymin -= 1; }
    const pad = (ymax - ymin) * 0.06; ymin -= pad; ymax += pad;
    const yt = pekneKroky(ymin, ymax, 4);
    g.font = '11px ' + font;
    const des = Math.max(0, -Math.floor(Math.log10(yt.k)) + (yt.k / Math.pow(10, Math.floor(Math.log10(yt.k))) === 2.5 ? 1 : 0));
    const popY = t => f(t, Math.min(des, 4));
    const L = Math.max(...yt.kroky.map(t => g.measureText(popY(t)).width)) + 10, R = 14, Tt = 8, Bt = 22;
    const pw = w - L - R, ph = h - Tt - Bt;
    const X = x => L + (x - D.xMin) / (D.xMax - D.xMin) * pw, Y = y => Tt + (ymax - y) / (ymax - ymin) * ph;
    D.xz = px => D.xMin + (px - L) / pw * (D.xMax - D.xMin);
    D.X = X; D.Y = Y; D.L = L; D.pw = pw; D.Tt = Tt; D.ph = ph;
    // pásy výdrží
    g.fillStyle = B.hover;
    for (const [a, b] of D.pasy || []) g.fillRect(X(a), Tt, X(b) - X(a), ph);
    // mřížka
    g.strokeStyle = B.border; g.lineWidth = 1; g.fillStyle = B.muted; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const t of yt.kroky) { const y = Math.round(Y(t)) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillText(popY(t), L - 5, y); }
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (const t of D.xKroky) { const x = Math.round(X(t)) + 0.5; g.beginPath(); g.moveTo(x, Tt + ph); g.lineTo(x, Tt + ph + 4); g.stroke(); g.fillText(D.xPopis(t), x, Tt + ph + 6); }
    // nulová čára
    if (ymin < 0 && ymax > 0) { g.strokeStyle = B.faint; g.beginPath(); g.moveTo(L, Math.round(Y(0)) + 0.5); g.lineTo(L + pw, Math.round(Y(0)) + 0.5); g.stroke(); }
    // řady
    g.save(); g.beginPath(); g.rect(L, Tt, pw, ph); g.clip();
    for (const s of D.serie) {
      g.strokeStyle = s.barva; g.lineWidth = 2; g.lineJoin = 'round'; g.setLineDash(s.carkovana ? [6, 4] : []);
      g.beginPath(); let zac = false;
      for (let i = 0; i < D.x.length; i++) {
        const y = s.y[i]; if (!isFinite(y)) { zac = false; continue; }
        const px = X(D.x[i]), py = Y(y);
        if (!zac) { g.moveTo(px, py); zac = true; } else g.lineTo(px, py);
      }
      g.stroke();
    }
    g.setLineDash([]); g.restore();
    // nekonečný ryv na skocích zrychlení
    if (D.nekonecna) {
      g.fillStyle = B.danger; g.font = '600 12px ' + font; g.textAlign = 'center'; g.textBaseline = 'top';
      for (const x of D.nekonecna) { const px = Math.min(L + pw - 6, Math.max(L + 6, X(x))); g.fillText('∞', px, Tt + 1); }
    }
    // hover
    if (gr.hover !== null && gr.hover >= D.xMin && gr.hover <= D.xMax) {
      g.strokeStyle = B.muted; g.lineWidth = 1; const x = Math.round(X(gr.hover)) + 0.5;
      g.beginPath(); g.moveTo(x, Tt); g.lineTo(x, Tt + ph); g.stroke();
      const i = indexX(D, gr.hover);
      for (const s of D.serie) if (isFinite(s.y[i])) { g.fillStyle = s.barva; g.strokeStyle = B.bgp; g.lineWidth = 2; g.beginPath(); g.arc(X(D.x[i]), Y(s.y[i]), 4.5, 0, 2 * Math.PI); g.fill(); g.stroke(); }
    }
    gr.zaklad = g.getImageData(0, 0, cv.width, cv.height);
    znackaGrafu(gr, true);
  }
  function indexX(D, x) {
    let lo = 0, hi = D.x.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D.x[m] <= x) lo = m; else hi = m; }
    return Math.abs(D.x[hi] - x) < Math.abs(D.x[lo] - x) ? hi : lo;
  }
  function znackaGrafu(gr, bezObnovy) {
    const D = gr.data; if (!D || !D.naUhel || !D.X) return;
    const g = gr.cv.getContext('2d');
    if (!bezObnovy && gr.zaklad) { g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(gr.zaklad, 0, 0); const dpr = window.devicePixelRatio || 1; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
    const x = Math.round(D.X(uhel)) + 0.5;
    g.strokeStyle = B.danger; g.lineWidth = 1.5; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(x, D.Tt); g.lineTo(x, D.Tt + D.ph); g.stroke(); g.setLineDash([]);
  }
  function zobrazTip(gr, px, py) {
    const D = gr.data, i = indexX(D, gr.hover);
    if (gr.hover < D.xMin || gr.hover > D.xMax) { gr.tip.hidden = true; return; }
    const rad = D.serie.map(s => `<div>${D.serie.length > 1 ? `<span style="display:inline-block;width:10px;height:3px;background:${s.barva};margin-right:5px;vertical-align:middle"></span>${esc(s.popis)}: ` : ''}<b>${isFinite(s.y[i]) ? f(s.y[i], D.des == null ? 3 : D.des) : '–'}</b> ${esc(D.jednotka)}</div>`).join('');
    gr.tip.innerHTML = `<div style="color:var(--text-muted)">${D.xPopisTip(D.x[i])}</div>${rad}`;
    gr.tip.hidden = false;
    const sw = gr.el.clientWidth, tw = gr.tip.offsetWidth;
    gr.tip.style.left = Math.max(0, Math.min(sw - tw, px + 12)) + 'px';
    gr.tip.style.top = Math.max(0, py - 10) + 'px';
  }

  let hlavniGrafy = null, porGrafy = null;
  function kresliGrafy() {
    const box = $('grafy');
    if (!hlavniGrafy) {
      hlavniGrafy = ['zdvih', 'rych', 'zrych', 'ryv', 'tlak', 'sila'].map(k => { const gr = novyGraf(box, ''); gr.klic = k; grafy.push(gr); return gr; });
    }
    const x = v.body.map(b => b.th), w = v.cas.w, tim = jednotky === 'cas';
    const pasy = v.useky.filter(u => u.typ === 'vydrzH' || u.typ === 'vydrzD').map(u => [u.od, u.do]);
    const xKroky = [0, 60, 120, 180, 240, 300, 360];
    const spol = { x, xMin: 0, xMax: 360, pasy, naUhel: true, xKroky, xPopis: t => t + '°', xPopisTip: t => 'θ = ' + f(t, 1) + '°' };
    const nek = v.skoky.filter(s => Math.abs(s.da) > 1e-6).map(s => s.uhel === 0 ? 0 : s.uhel);
    const nek2 = nek.flatMap(a => a === 0 ? [0, 360] : [a]);
    const def = {
      zdvih: ['Zdvih s', 'mm', v.body.map(b => b.s), 3],
      rych: tim ? ['Rychlost v', 'm/s', v.body.map(b => b.s1 * w / 1000), 4] : ["Rychlost s′ = ds/dθ", 'mm/rad', v.body.map(b => b.s1), 2],
      zrych: tim ? ['Zrychlení a', 'm/s²', v.body.map(b => b.s2 * w * w / 1000), 2] : ["Zrychlení s″", 'mm/rad²', v.body.map(b => b.s2), 2],
      ryv: tim ? ['Ryv (jerk) j', 'm/s³', v.body.map(b => b.s3 * w * w * w / 1000), 0] : ["Ryv s‴", 'mm/rad³', v.body.map(b => b.s3), 1],
      tlak: p.typ === 'plochy' ? ['Poloměr křivosti ρ = Rb + s + s″', 'mm', v.body.map(b => b.rho), 2] : ['Tlakový úhel φ', '°', v.body.map(b => b.phi * V.DEG), 2],
      sila: ['Přítlak v ose F_y (záporný = odskok)', 'N', v.sily.map(s => s.Fy), 1]
    };
    for (const gr of hlavniGrafy) {
      const [t, j, y, des] = def[gr.klic];
      gr.titulEl.textContent = `${t} [${j}]`;
      nastavGraf(gr, Object.assign({}, spol, { serie: [{ y, barva: B.s1, popis: t }], jednotka: j, des, nekonecna: gr.klic === 'ryv' ? nek2 : null }));
    }
  }

  function porovnani() {
    const box = $('grafyPor');
    if (!porGrafy) {
      porGrafy = [['rych', 'Rychlost y′ = dy/dx'], ['zrych', 'Zrychlení y″'], ['ryv', 'Ryv y‴']].map(([k, t]) => { const gr = novyGraf(box, t); gr.klic = k; grafy.push(gr); return gr; });
      const vol = $('porovnaniVolby');
      vol.innerHTML = Object.entries(V.ZAKONY).map(([k, z]) => `<label class="zaskrt"><input type="checkbox" data-por="${k}" ${porovnat.has(k) ? 'checked' : ''}> ${esc(z.nazev)}</label>`).join('');
      vol.addEventListener('change', e => { const k = e.target.dataset.por; if (!k) return; e.target.checked ? porovnat.add(k) : porovnat.delete(k); porovnani(); });
    }
    const ids = Object.keys(V.ZAKONY).filter(k => porovnat.has(k));
    $('legendaPor').innerHTML = ids.map(k => `<span><i style="background:${BARVY_ZAKONU_HOD[k]}"></i>${esc(V.ZAKONY[k].kratce)}</span>`).join('');
    const x = []; for (let i = 0; i <= 400; i++) x.push(i / 400);
    const idx = { rych: 1, zrych: 2, ryv: 3 };
    for (const gr of porGrafy) {
      const serie = ids.map(k => ({ y: x.map(t => V.ZAKONY[k].f(t)[idx[gr.klic]]), barva: BARVY_ZAKONU_HOD[k], popis: V.ZAKONY[k].kratce }));
      nastavGraf(gr, { x, xMin: 0, xMax: 1, serie, jednotka: '', des: 3, naUhel: false, xKroky: [0, 0.25, 0.5, 0.75, 1], xPopis: t => f(t, 2), xPopisTip: t => 'x = ' + f(t, 3) });
    }
    // tabulka
    const res = V.porovnej(p, Object.keys(V.ZAKONY));
    const aktual = p.zakonNabeh === p.zakonNavrat ? p.zakonNabeh : null;
    const hl = `<tr><th>Zákon (náběh i návrat)</th><th>C<sub>v</sub></th><th>C<sub>a</sub></th><th>C<sub>j</sub></th><th>φ max</th><th>ρ min</th><th>a max</th><th>F<sub>n</sub> max</th><th>Spojitost s výdrží</th></tr>`;
    const rad = res.map(({ id, zakon, v: r }) => {
      if (!r.ok) return `<tr><td>${esc(zakon.kratce)}</td><td colspan="8">neplatné zadání</td></tr>`;
      const ex = r.ex;
      const rho = p.typ === 'kladka' ? ex.rhoRoztecMinVypukla - p.Rr : p.typ === 'plochy' ? ex.rhoAlgMin : ex.rhoMin;
      const spoj = id === 'harmonicky' ? 'skok a (∞ ryv)' : id === 'p4567' ? 'spojitý ryv' : 'spojité a, skok j';
      return `<tr class="${id === aktual ? 'aktualni' : ''}"><td>${esc(zakon.kratce)}${id === aktual ? ' (aktuální)' : ''}</td><td>${f(zakon.Cv, 3)}</td><td>${f(zakon.Ca, 3)}</td><td>${f(zakon.Cj, 1)}</td>` +
        `<td>${p.typ === 'plochy' ? '0' : f(Math.max(ex.phiMax, -ex.phiMin) * V.DEG)} °</td><td>${f(rho)} mm</td><td>${f(r.cas.aMax, 1)} m/s²</td><td>${f(r.silyEx.FnMax, 1)} N</td><td>${spoj}</td></tr>`;
    }).join('');
    $('tabPor').innerHTML = `<thead>${hl}</thead><tbody>${rad}</tbody>`;
  }

  // ───────── 2D / 3D ─────────
  function prepniRezim(je3d) {
    if (rezim3d === je3d) return;
    rezim3d = je3d;
    $('platno3d').hidden = !je3d; cv.hidden = je3d;
    $('tip2d').hidden = je3d; $('tip3d').hidden = !je3d;
    $('btn2d').setAttribute('aria-pressed', String(!je3d)); $('btn3d').setAttribute('aria-pressed', String(je3d));
    $('legPrevisy').hidden = !(je3d && stavZobr.tisk && nahled.stav.previsy);
    if (je3d) requestAnimationFrame(() => nahled.pohled('ponech')); else requestAnimationFrame(kresli);
  }
  $('btn2d').addEventListener('click', () => prepniRezim(false));
  $('btn3d').addEventListener('click', () => prepniRezim(true));

  // ───────── export ─────────
  function zprava(t, chyba) { const z = $('zpravaRb'); z.textContent = t; z.classList.toggle('chyba', !!chyba); }
  const jmenoSouboru = pripona => (p.nazev ? app.jmeno(pripona) : `vacka_Rb${String(p.Rb).replace('.', '_')}_h${String(p.h).replace('.', '_')}${pripona}`);
  /** Smí se exportovat? Zadání musí být platné, 3D formáty potřebují model; chyby kontrol se jen potvrdí. */
  async function lzeExport(typ) {
    if (!r || !r.ok) { Dialog.chyba('Zadání obsahuje chyby (viz Kontrola) – export není možný.'); return false; }
    if (['stl', '3mf'].includes(typ) && !model) { Dialog.chyba(chyba3d || '3D model nelze sestavit.'); return false; }
    if (typ !== 'csv' && v.kontroly.some(k => k.uroven === 'chyba')) return await Dialog.potvrd('Návrh obsahuje chyby (viz Kontrola). Přesto exportovat?');
    return true;
  }
  async function exportuj(typ) {
    if (!await lzeExport(typ)) return;
    try {
      if (typ === 'svg') app.stahni(X.svg(v), jmenoSouboru('.svg'), 'image/svg+xml');
      else if (typ === 'dxf') app.stahni(X.dxf(v), jmenoSouboru('.dxf'), 'application/dxf');
      else if (typ === 'csv') app.stahni(X.csv(v, 1), jmenoSouboru('.csv'), 'text/csv;charset=utf-8');
      else if (typ === 'stl') app.stahni(KRAB.stlBinarni(tiskDily, 'Diskova vacka - ' + X.popisNavrhu(v)), jmenoSouboru('.stl'), 'model/stl');
      else if (typ === '3mf') app.stahni(KRAB.soubor3mf(tiskDily, p.nazev || 'Vačka'), jmenoSouboru('.3mf'), 'model/3mf');
    } catch (e) { Dialog.chyba('Export se nepodařil: ' + (e && e.message || e)); }
  }
  for (const [id, typ] of [['btnSvg', 'svg'], ['btnDxf', 'dxf'], ['btnCsv', 'csv'], ['btnStl', 'stl'], ['btn3mf', '3mf']]) $(id).addEventListener('click', () => exportuj(typ));

  // ───────── nabídky, přepínače ─────────
  TrubkyGui.pripoj({ klic: 'webapp_vacky_gui', pohled: j => { prepniRezim(true); nahled.pohled(j); } });
  for (const [id, pv] of Object.entries(P.PREDVOLBY)) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem'); b.dataset.predvolba = id;
    b.innerHTML = `${esc(pv.nazev)}<span class="pozn">${esc(pv.popis)}</span>`;
    b.addEventListener('click', () => { const q = G3D.kopie(pv.p); q.nazev = app.p.nazev; q.tisk = G3D.kopie(app.p.tisk); app.nahrad(P.normalizuj(q).p); });
    $('seznamPredvoleb').appendChild(b);
  }
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk && rezim3d); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  let start = true;
  app.prepinac('tTisk', h => {
    stavZobr.tisk = h;
    if (!start) prepniRezim(true);   // tisková poloha je vidět jen ve 3D
    $('legPrevisy').hidden = !(h && nahled.stav.previsy && rezim3d);
    if (model) ukaz3d(true);
  });
  for (const id of ['vZakl', 'vRozt', 'vNorm']) app.prepinac(id, h => { stavZobr[id] = h; if (!start) { prepniRezim(false); kresli(); } }, true);
  start = false;
  document.querySelectorAll('[data-jedn]').forEach(b => b.addEventListener('click', () => {
    jednotky = b.dataset.jedn;
    document.querySelectorAll('[data-jedn]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    kresliGrafy(); kresli();
  }));
  // grafy ve skryté záložce mají nulovou šířku – po otevření záložky překreslit
  document.querySelectorAll('.zalozky [data-zalozka]').forEach(b => b.addEventListener('click', () => requestAnimationFrame(() => { if (v) for (const gr of grafy) vykresliGraf(gr); })));
  $('uhel').addEventListener('input', () => { uhel = Number($('uhel').value) % 360; prepniPrehravani(false); kresli(); });
  $('btnPrehrat').addEventListener('click', () => prepniPrehravani());
  $('btnMinRb').addEventListener('click', () => {
    const q = Object.assign({}, app.p);
    const x = V.minimalniRb(q, 30, q.typ === 'kladka' ? 0.5 * q.Rr : q.typ === 'plochy' ? 3 : 0);
    if (x === null) { zprava('Vhodné Rb se nepodařilo najít (zkontrolujte úhly a excentricitu).', true); return; }
    const nove = Math.ceil(x);
    app.zmen(s => { s.Rb = nove; }); app.naplnFormular();
    zprava(`Nejmenší vyhovující Rb = ${f(x, 2)} mm → zaokrouhleno na ${nove} mm (φ ≤ 30°, ${q.typ === 'kladka' ? 'ρ roztečné ≥ 1,5·Rr' : q.typ === 'plochy' ? 'ρ ≥ 3 mm' : 'bez rezervy křivosti'}).`);
  });
  // animace: mezerník, šipky ±1° (Shift ±10°), V = 2D / 3D (čísla a písmena H M P L obsluhuje gen3d)
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    if (document.querySelector('.dialog-overlay, dialog[open]')) return;
    if (e.code === 'Space') { e.preventDefault(); prepniPrehravani(); }
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault(); prepniPrehravani(false);
      uhel = ((uhel + (e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)) % 360 + 360) % 360; kresli();
    } else if ((e.key || '').toLowerCase() === 'v') prepniRezim(!rezim3d);
  });
  new ResizeObserver(() => { if (v && !rezim3d) kresli(); }).observe($('canvas-container'));
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (v) for (const gr of grafy) vykresliGraf(gr); }, 120); });

  /* ---------- start ---------- */
  nactiBarvy();
  app.start().then(() => {
    if (zOdkazu) {
      app.nahrad(zOdkazu.p);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sandbox */ }
    }
  });
  window.__vacky = { stav: () => ({ p: app.p, v, uhel, model }), nastavUhel: a => { uhel = a; kresli(); }, prepocet: prepocitej, prepniRezim, app };
})();
