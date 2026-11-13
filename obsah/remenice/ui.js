/* Řemenice – ovládání stránky nad společným zapojením gen3d/aplikace.js: tady jen to, co je pro řemenice zvláštní
   (předvolby, kresby profilu a pohonu, výsledky, kusovník, export po dílech). Historie, formulář, hlášení, soubory,
   sdílení, klávesy a manifold dělá G3D.aplikace. */
/* global REMENICE, REMENICE_GEO, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const R = REMENICE, fmt = R.fmt;

  const PREDVOLBY = [
    { nazev: 'GT2 20 z – NEMA 17 (⌀ 5 D)', popis: 'nejběžnější řemenice tiskáren, řemen 6 mm, 2 šrouby M3',
      p: { profil: 'gt2', z1: 20, sirkaRemene: 6, otvor: { typ: 'd', prumer: 5, plocha: 0.5 }, naboj: { prumer: 16, vyska: 7, sroubu: 2 } } },
    { nazev: 'GT2 16 z – malá ⌀ 5', popis: 'kompaktní osa X/Y, 1 šroub',
      p: { profil: 'gt2', z1: 16, sirkaRemene: 6, otvor: { typ: 'hladky', prumer: 5 }, naboj: { prumer: 14, vyska: 7, sroubu: 1 } } },
    { nazev: 'GT2 60 : 20 – redukce 1 : 3', popis: 'velká řemenice ⌀ 8 + pastorek ⌀ 5, řemen 9 mm, C = 80 mm',
      p: { nazev: 'Redukce GT2 60-20', profil: 'gt2', z1: 60, sirkaRemene: 9, dily: { r1: true, r2: true }, otvor: { typ: 'hladky', prumer: 8 },
        naboj: { prumer: 20, vyska: 8, sroubu: 1 }, pohon: { z2: 20, otvor2: 5, rezim: 'C', C: 80 } } },
    { nazev: 'GT2 kladka 625 + rameno', popis: 'hladká vodicí kladka na ložisko 625 a otočný napínák',
      p: { nazev: 'Napínák GT2 625', profil: 'gt2', sirkaRemene: 6, dily: { r1: false, kladka: true, napinak: true },
        kladka: { lozisko: '625', pocet: 1, prumer: 20 }, napinak: { typ: 'rameno', delka: 30, sirka: 12, tloustka: 5, cep: 5.3, osa: 5.2 } } },
    { nazev: 'GT2 kladka 2× 623 + posuvná deska', popis: 'malá kladka na dvou ložiskách 623, napínání drážkou',
      p: { nazev: 'Kladka 2x623', profil: 'gt2', sirkaRemene: 6, dily: { r1: false, kladka: true, napinak: true },
        kladka: { lozisko: '623', pocet: 2, prumer: 13 }, napinak: { typ: 'drazka', delka: 14, zdvih: 12, sirka: 10, tloustka: 4, cep: 3.3, osa: 3.2 } } },
    { nazev: 'HTD 5M 30 z – ⌀ 12 s perem', popis: 'výkonnější pohon, řemen 15 mm, pero 4 × 4',
      p: { profil: 'htd5', z1: 30, sirkaRemene: 15, otvor: { typ: 'pero', prumer: 12 }, naboj: { prumer: 26, vyska: 10, sroubu: 1 },
        priruby: { presah: 2.5, tloustka: 1.5 }, pohon: { z2: 60, otvor2: 15, C: 200 } } },
    { nazev: 'HTD 3M 24 z – ⌀ 8', popis: 'řemen 9 mm, CNC a robotika',
      p: { profil: 'htd3', z1: 24, sirkaRemene: 9, otvor: { typ: 'hladky', prumer: 8 }, naboj: { prumer: 18, vyska: 8, sroubu: 1 }, priruby: { presah: 2 } } },
    { nazev: 'T5 24 z – ⌀ 8', popis: 'lichoběžníkový řemen 10 mm',
      p: { profil: 't5', z1: 24, sirkaRemene: 10, otvor: { typ: 'hladky', prumer: 8 }, naboj: { prumer: 20, vyska: 8, sroubu: 1 }, priruby: { presah: 2 } } },
    { nazev: 'MXL 18 z – ⌀ 3', popis: 'drobné mechaniky, řemen 1/4″ (6,4 mm)',
      p: { profil: 'mxl', z1: 18, sirkaRemene: 6.4, otvor: { typ: 'hladky', prumer: 3 }, naboj: { prumer: 10, vyska: 6, sroubu: 0, matice: false }, priruby: { presah: 1.3 } } },
  ];
  /** Předvolba = výchozí hodnoty + změny předvolby (hluboké sloučení). */
  function spoj(cil, zdroj) {
    for (const [k, v] of Object.entries(zdroj)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) spoj(cil[k] = cil[k] || {}, v); else cil[k] = v;
    }
    return cil;
  }


  /* ---------- zapojení gen3d ---------- */
  let p, sestava = null, rozmistene = [], vysl = null, wasm = null, chybaJadra = null, sada = '';
  const stavZobr = { tisk: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));
  const app = G3D.aplikace({
    typ: 'remenice', nazev: 'Řemenice', klic: 'webapp_remenice', soubor: 'remenice',
    normalizuj: R.normalizuj, vychozi: () => R.normalizuj({}).p,
    ulozProjekt: R.ulozProjekt, nactiProjekt: R.nactiProjekt, vezmi: R.vezmi, poloz: R.poloz,
    hlasitOpravyUlozeneho: true,
    popis: q => `${q.nazev || 'Řemenice'} – ${(R.PROFILY[q.profil] || {}).nazev || ''} ${q.z1} z, ⌀ ${fmt(q.otvor && q.otvor.prumer)} mm`,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(rozmistene, app.p.nazev || 'Řemenice'), pripona: '.3mf' } : null),
    zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', r: 'tRez', l: 'tPravitka' },
    zmenaTematu: () => prepocitejOdlozene(),
  });

  /* ---------- formulář ---------- */
  $('f_prof').innerHTML = Object.entries(R.PROFILY).map(([k, x]) => `<option value="${k}">${x.nazev} (p ${fmt(x.p, 3)} mm)</option>`).join('');
  $('f_mat').innerHTML = Object.entries(R.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev} – ${fmt(m.hustota, 2)} g/cm³</option>`).join('');
  $('f_kl').innerHTML = Object.entries(R.LOZISKA).map(([k, [d, D, B]]) => `<option value="${k}">${k} – ${fmt(d)} × ${fmt(D)} × ${fmt(B)} mm</option>`).join('');
  function viditelnost() {
    p = app.p;
    $('pPlocha').hidden = p.otvor.typ !== 'd';
    $('pC').hidden = p.pohon.rezim !== 'C'; $('pL').hidden = p.pohon.rezim !== 'L';
    $('pZdvih').hidden = p.napinak.typ !== 'drazka';
    $('lDelka').textContent = p.napinak.typ === 'rameno' ? 'Rozteč čep ↔ osa' : 'Osa ↔ začátek drážky';
    $('lCep').textContent = p.napinak.typ === 'rameno' ? 'Otvor čepu' : 'Šířka drážky (šroub)';
    for (const id of ['gNaboj', 'f_nm']) { const el = $(id); (el.closest('label') || el).style.opacity = p.naboj.pouzit ? '' : '.45'; }
  }
  // číselná pole se přepočítávají už při psaní (jeden krok zpět za celé psaní); po opuštění pole hlášení o oříznutí na rozsah
  for (const el of document.querySelectorAll('input[type="text"][data-p]:not([data-typ])')) {
    el.addEventListener('input', () => {
      const h = R.cislo(el.value, NaN), c = el.dataset.p;
      el.classList.toggle('spatne', !Number.isFinite(h));
      el._psano = el.value;
      if (Number.isFinite(h)) app.zmen(x => R.poloz(x, c, h), c);
    });
    el.addEventListener('change', () => {
      const psano = R.cislo(el._psano == null ? '' : el._psano, NaN), h = R.vezmi(app.p, el.dataset.p), rozsah = R.ROZSAHY[el.dataset.p];
      el._psano = null;
      if (Number.isFinite(psano) && Math.abs(psano - h) > 1e-9 && rozsah) {
        el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
        Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: povoleno ${fmt(rozsah[0], 2)}–${fmt(rozsah[1], 2)}, použito ${fmt(h, 2)}.`);
      }
    });
  }

  /* ---------- kresby ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function pripravPlatno(c) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), w = c.clientWidth || 300, h = c.clientHeight || 150;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    g.font = '11px system-ui, sans-serif';
    return { g, w, h };
  }
  /** Detail tří drážek u horního okraje řemenice: obrys, hlavová a roztečná kružnice, roztečná čára řemene. */
  function kresliProfil() {
    const c = $('cProfil'); if (!c.clientWidth) return;
    const { g, w, h } = pripravPlatno(c);
    const ob = R.obrysOzubeni(p, p.z1, 0.05);
    const prof = R.PROFILY[p.profil];
    const sirka = 3.2 * ob.pOD, m = Math.min(w / sirka, (h - 40) / (ob.D + prof.H + 1.2));
    const cx = w / 2, cy = 34 + (prof.H + 0.6) * m;
    // souřadnice: osa drážky 0 → nahoru; bod (x, y) řemenice → plátno
    const P = (x, y) => [cx + x * m, cy - (y - ob.R) * m];
    const otoc = ([x, y]) => [-y, x];   // drážka 0 leží na +X, natočit nahoru
    const krivka = (body, barva, sirkaCary, vypln) => {
      g.beginPath(); body.forEach((b, i) => { const q = P(...b); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
      if (vypln) { g.fillStyle = vypln; g.fill(); }
      g.strokeStyle = barva; g.lineWidth = sirkaCary; g.stroke();
    };
    const oblouk = (r, barva, carky) => {
      const pts = []; for (let a = -0.5; a <= 0.5; a += 0.005) pts.push([r * Math.sin(a * sirka / r), r * Math.cos(a * sirka / r)]);
      g.setLineDash(carky || []); krivka(pts, barva, 1); g.setLineDash([]);
    };
    if (ob.body) {
      const pts = ob.body.map(otoc).filter(([x, y]) => y > 0 && Math.abs(x) < sirka * 0.6);
      pts.sort((a, b) => Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0]));
      const plocha = pts.concat([[pts[pts.length - 1][0], ob.R - ob.D - 2], [pts[0][0], ob.R - ob.D - 2]]);
      krivka(plocha.concat([plocha[0]]), css('--accent'), 1.6, css('--accent-soft'));
    }
    oblouk(ob.PD / 2, css('--warn'), [5, 4]);
    oblouk(ob.PD / 2 - prof.u + prof.H, css('--text-faint'), [2, 3]);
    g.fillStyle = css('--text-muted');
    g.fillText(`roztečná ⌀ ${fmt(ob.PD, 2)} (řemen)`, 6, 12);
    g.fillText(`hlavová ⌀ ${fmt(ob.OD, 2)} · drážka ${fmt(ob.W, 2)} × ${fmt(ob.D, 2)} mm`, 6, 26);
    if (!ob.body) { g.fillStyle = css('--danger'); g.fillText('drážky se překrývají', 6, 40); }
  }
  function kresliPohon() {
    const c = $('cPohon'); if (!c.clientWidth) return;
    const { g, w, h } = pripravPlatno(c);
    const po = vysl && vysl.pohon;
    if (!po || !po.platne) { g.fillStyle = css('--danger'); g.fillText('převod nelze sestavit – viz Kontrola', 8, 18); return; }
    const r1 = po.d1 / 2, r2 = po.d2 / 2, C = po.C;
    const m = Math.min((w - 30) / (C + r1 + r2), (h - 34) / (2 * Math.max(r1, r2)));
    const y0 = h / 2 - 6, x1 = (w - (C + r1 + r2) * m) / 2 + r1 * m, x2 = x1 + C * m;
    const f = Math.asin((r2 - r1) / C);
    g.strokeStyle = css('--accent'); g.lineWidth = 2.2;
    // řemen: horní a dolní tečna + oblouky opásání
    g.beginPath();
    g.arc(x1, y0, r1 * m, Math.PI / 2 + f, 3 * Math.PI / 2 - f);
    g.lineTo(x2 + r2 * m * Math.cos(-Math.PI / 2 - f), y0 + r2 * m * Math.sin(-Math.PI / 2 - f));
    g.arc(x2, y0, r2 * m, -Math.PI / 2 - f, Math.PI / 2 + f);
    g.closePath(); g.stroke();
    g.strokeStyle = css('--text-muted'); g.lineWidth = 1;
    for (const [x, r] of [[x1, r1], [x2, r2]]) { g.beginPath(); g.arc(x, y0, r * m, 0, 2 * Math.PI); g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]); }
    g.fillStyle = css('--text');
    for (const [x, t] of [[x1, `z₁ ${p.z1}`], [x2, `z₂ ${p.pohon.z2}`]]) { g.beginPath(); g.arc(x, y0, 2, 0, 7); g.fill(); g.textAlign = 'center'; g.fillText(t, x, y0 - 6); }
    const yk = h - 10;
    g.strokeStyle = css('--text-faint'); g.beginPath(); g.moveTo(x1, yk); g.lineTo(x2, yk); g.stroke();
    g.fillStyle = css('--text-muted'); g.fillText(`C = ${fmt(C, 2)} mm · L = ${fmt(po.L, 2)} mm`, (x1 + x2) / 2, yk - 3); g.textAlign = 'left';
  }

  /* ---------- výsledky ---------- */
  const box = G3D.dlazdice;
  const souhrn = (id, t) => { const el = $(id); if (el) el.textContent = t; };
  function vypis() {
    const po = vysl.pohon, oz = R.ozubeni(p, p.z1), prof = R.PROFILY[p.profil];
    $('vProfil').innerHTML = box('Roztečný ⌀', `${fmt(oz.PD, 2)} mm`, `z ${p.z1} × p ${fmt(prof.p, 3)} / π`)
      + box('Hlavový ⌀ (vnější)', `${fmt(oz.OD, 2)} mm`, `PLD ${fmt(2 * prof.u, 3)} mm${p.komp.prumer ? `, kompenzace ${fmt(p.komp.prumer, 2)}` : ''}`)
      + box('Pata zubů ⌀', `${fmt(2 * oz.Rpata, 2)} mm`, `hlava zubu ${fmt(oz.mustek, 2)} mm`, oz.mustek < 0.3 ? 'mez-t' : '');
    souhrn('sProfil', `${prof.nazev} · ${p.z1} z · ${fmt(p.sirkaRemene)} mm`);
    souhrn('sPriruby', p.priruby.typ === 'zadna' ? 'bez přírub' : `${p.priruby.typ === 'obe' ? 'obě' : 'jedna'} · +${fmt(p.priruby.presah)} mm · ${fmt(p.priruby.ukos, 0)}°`);
    const ot = { hladky: 'hladký', d: 'D', pero: 'pero' }[p.otvor.typ];
    souhrn('sNaboj', `⌀ ${fmt(p.otvor.prumer)} ${ot}` + (p.naboj.pouzit ? ` · náboj ⌀ ${fmt(p.naboj.prumer)}${p.naboj.sroubu ? ` · ${p.naboj.sroubu}× M3` : ''}` : ' · bez náboje'));
    souhrn('sKomp', p.komp.drazka || p.komp.prumer ? `drážka ${fmt(p.komp.drazka, 2)} · ⌀ ${fmt(p.komp.prumer, 2)}` : 'bez kompenzace');
    const dl = [p.dily.r1 && 'ř1', p.dily.r2 && 'ř2', p.dily.kladka && 'kladka', p.dily.napinak && 'napínák'].filter(Boolean);
    souhrn('sDily', dl.join(' + ') || 'nic');
    const pero = p.otvor.typ === 'pero' ? R.PERA.find(([a, b]) => p.otvor.prumer > a && p.otvor.prumer <= b) : null;
    $('nPero').textContent = p.otvor.typ === 'pero' ? (pero ? `Pero DIN 6885: ${pero[2]} × ${pero[2]} mm, hloubka drážky v náboji t₂ = ${fmt(pero[3])} mm (+ vůle).` : '') : '';
    const kl = R.kladka(p);
    $('vKladka').innerHTML = box('Ložisko', p.kladka.lozisko, `${fmt(kl.d)} × ${fmt(kl.D)} × ${fmt(kl.B)} mm, ${p.kladka.pocet} ks`)
      + box('Stěna kolem ložiska', `${fmt(kl.stena, 2)} mm`, `výška kladky ${fmt(kl.H, 2)} mm`, kl.stena < 0.8 ? 'chyba-t' : kl.stena < 1.2 ? 'mez-t' : '');
    souhrn('sKladka', `${p.kladka.lozisko} · ⌀ ${fmt(p.kladka.prumer)}`);
    const n = p.napinak;
    souhrn('sNapinak', n.typ === 'rameno' ? `rameno ${fmt(n.delka)} mm` : `deska, zdvih ${fmt(n.zdvih)} mm`);
    $('nNapinak').textContent = n.typ === 'rameno'
      ? 'Rameno se otáčí na čepu (šroub s podložkou), kladka sedí na ose na druhém konci; přitáhněte pružinou nebo pryží.'
      : 'Deska se přišroubuje dvěma šrouby skrz drážku; posunutím se řemen napne a šrouby se dotáhnou.';
    // pohon
    if (po.platne) {
      $('vPohon').innerHTML = box('Délka řemene', `${fmt(po.L, 2)} mm`, `${fmt(po.N, 2)} zubů řemene`)
        + box('Osová vzdálenost', `${fmt(po.C, 2)} mm`, p.pohon.rezim === 'L' ? 'dopočtená' : 'zadaná')
        + box('Převod', `1 : ${fmt(po.i, 3)}`, `${fmt(p.pohon.otacky, 0)} → ${fmt(po.n2, 1)} /min, řemen ${fmt(po.v, 2)} m/s`)
        + box('Zuby v záběru', String(po.zubuVZaberu), `opásání ${fmt(po.opasani * 180 / Math.PI, 1)}° na menší řemenici`, po.zubuVZaberu < 6 ? 'mez-t' : 'ok-t')
        + box('Roztečné ⌀', `${fmt(po.d1, 2)} / ${fmt(po.d2, 2)}`, 'řemenice 1 / 2');
      $('blizke').innerHTML = '';
      for (const b of po.blizke) {
        if (!Number.isFinite(b.C)) continue;
        const t = document.createElement('button'); t.className = 'tl'; t.type = 'button';
        t.textContent = `${b.N} z = ${fmt(b.L, 2)} mm → C ${fmt(b.C, 2)} mm`;
        t.title = 'Použít tuto délku řemene (přepne na zadávání délky)';
        t.addEventListener('click', () => { app.zmen(x => { x.pohon.rezim = 'L'; x.pohon.L = b.L; }); app.naplnFormular(); });
        $('blizke').appendChild(t);
      }
      souhrn('sPohon', `L ${fmt(po.L, 1)} · ${po.zubuVZaberu} z v záběru`);
    } else { $('vPohon').innerHTML = box('Převod', '—', 'nelze sestavit', 'chyba-t'); $('blizke').innerHTML = ''; souhrn('sPohon', '—'); }
    // tisk: kusovník po dílech a součty do Výsledků
    const radky = [];
    const celk = { V: 0, g: 0, m: 0, min: 0 };
    for (const d of sestava ? sestava.dily : []) {
      const k = KRAB.kontrolaSite(d.poz, d.idx), b = k.bbox, o = R.odhadTisku(d.objem, b[5] - b[2], p.tisk.material);
      celk.V += d.objem; celk.g += o.g; celk.m += o.delka; celk.min += o.min;
      d.kontrola = k;
      radky.push(`<tr><td>${d.nazev}</td><td class="c">${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])}</td><td class="c">${fmt(d.objem / 1000, 2)}</td><td class="c">${fmt(o.g, 1)}</td><td class="c">${fmt(o.min, 0)}</td></tr>`);
    }
    $('tDily').innerHTML = radky.length ? `<tr><th>Díl</th><th class="c">Rozměr mm</th><th class="c">cm³</th><th class="c">g</th><th class="c">min</th></tr>${radky.join('')}` : '';
    const tabKus = document.querySelector('[data-zalozka="kusovnik"]');
    tabKus.hidden = radky.length < 2;
    if (tabKus.hidden && tabKus.getAttribute('aria-selected') === 'true') TrubkyGui.otevriZalozku('vysledky');
    if (radky.length) {
      const B = G3D.obal(new Float32Array(0)); for (const d of rozmistene) { const b = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], b[i]); B[i + 3] = Math.max(B[i + 3], b[i + 3]); } }
      $('vVysledky').innerHTML = box('Rozměry na podložce', `${fmt(B[3] - B[0])} × ${fmt(B[4] - B[1])} × ${fmt(B[5] - B[2])} mm`, `${radky.length} ${radky.length === 1 ? 'díl' : radky.length < 5 ? 'díly' : 'dílů'} vedle sebe, š × h × v`)
        + box('Objem', `${fmt(celk.V / 1000, 2)} cm³`, 'plné díly')
        + box('Hmotnost', `${fmt(celk.g, 1)} g`, `${R.MATERIALY[p.tisk.material].nazev}, při 100% výplni`)
        + box('Filament 1,75 mm', `${fmt(celk.m, 2)} m`, 'při 100% výplni') + box('Doba tisku', `≈ ${fmt(celk.min, 0)} min`, 'hrubý odhad')
        + (p.dily.r1 ? box('Řemenice 1', `⌀ ${fmt(oz.PD, 2)} / ${fmt(oz.OD, 2)} mm`, `roztečný / vnější, ${prof.nazev} ${p.z1} z`) : '')
        + (po.platne ? box('Řemen', `${fmt(po.L, 2)} mm`, `${fmt(po.N, 2)} zubů, C ${fmt(po.C, 2)} mm`) : '');
    } else $('vVysledky').innerHTML = box('Model', wasm ? 'žádný díl' : chybaJadra ? 'nelze sestavit' : 'načítám…', wasm ? (sestava && sestava.chyba) || 'vyberte díly k tisku' : chybaJadra || '');
    souhrn('sTisk', radky.length ? `${fmt(celk.g, 1)} g` : '');
    const vse = sestava ? sestava.dily : [];
    const dobra = vse.length && vse.every(d => d.kontrola.uzavrena && d.kontrola.objem > 0);
    $('vSit').innerHTML = vse.length ? box('Síť', dobra ? 'uzavřená' : 'vadná', `${vse.reduce((s, d) => s + d.kontrola.trojuhelniku, 0).toLocaleString('cs-CZ')} trojúhelníků, ${vse.length} díl(y)`, dobra ? 'ok-t' : 'chyba-t') : '';
    // karta
    const d0 = vse[0];
    $('karta3d').innerHTML = d0 ? `<div class="titul">${vse.map(d => d.nazev).join(' · ')}</div>`
      + (p.dily.r1 ? `${R.PROFILY[p.profil].nazev}, <b>${p.z1}</b> z, roztečný ⌀ <b>${fmt(oz.PD, 2)}</b>, vnější ⌀ <b>${fmt(oz.OD, 2)}</b> mm<br>` : '')
      + `celkem <b>${fmt(celk.g, 1)} g</b> · tisk ≈ ${fmt(celk.min, 0)} min` : '';
    // seznam dílů pro export po jednom
    const sez = $('seznamDilu'); sez.innerHTML = '';
    for (const d of vse) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.textContent = '⬇ ' + d.nazev;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(R.rozmisti([d]), 'remenice - github_site'), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      sez.appendChild(b);
    }
    if (!vse.length) sez.innerHTML = '<div class="nab-tip">žádný díl</div>';
  }
  function vypisHlaseni() {
    const H = vysl.hlaseni.slice();
    if (!H.length && !chybaJadra) H.push({ uroven: 'ok', text: 'Bez připomínek – díly jsou připravené k tisku.', pole: [] });
    app.hlaseni(H, { chybaStavby: chybaJadra, boxy: ['boxRemenice', 'boxKladka'] });
  }

  /* ---------- přepočet ---------- */
  function ukazNahled() {
    const klic = rozmistene.map(d => d.jmeno).join();
    nahled.nastav(rozmistene.length ? rozmistene : null, { tisk: stavZobr.tisk, uhel: 45, novyPohled: klic !== sada && !!sada });
    sada = klic;
    $('legPrevisy').hidden = !(stavZobr.tisk && nahled.stav.previsy);
  }
  let cekaStavba = 0;
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    sestava = null;
    if (wasm) {
      sestava = REMENICE_GEO.postav(wasm, p);
      rozmistene = sestava.chyba ? [] : R.rozmisti(sestava.dily);
      ukazNahled();
      const st = $('stav3d'); st.textContent = sestava.chyba ? 'Model nelze sestavit: ' + sestava.chyba : ''; st.classList.toggle('chyba', !!sestava.chyba);
      if (sestava.chyba) sestava.dily = [];
    }
    vysl = R.kontroly(p, sestava);
    vypis(); vypisHlaseni();
    kresliProfil(); kresliPohon();
  }
  /** Stavba je synchronní a rychlá; při změně tématu se ale sloučí do jednoho snímku. */
  function prepocitejOdlozene() { if (cekaStavba) return; cekaStavba = requestAnimationFrame(() => { cekaStavba = 0; prepocitej(); }); }

  /* ---------- lišta ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_remenice_gui', pohled: j => nahled.pohled(j) });
  for (const v of PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => app.nahrad(spoj(spoj(R.kopie(R.VYCHOZI), { nazev: v.p.nazev || v.nazev.replace(/ –.*$/, '') }), R.kopie(v.p))));
    $('seznamPredvoleb').appendChild(b);
  }
  const lzeExport = () => {
    if (!wasm) { Dialog.chyba(chybaJadra || 'Geometrické jádro se ještě načítá.'); return false; }
    if (!rozmistene.length) { Dialog.chyba('Není co exportovat: ' + (sestava && sestava.chyba ? sestava.chyba : 'vyberte díly k tisku.')); return false; }
    return true;
  };
  function exportStl() { if (lzeExport()) app.stahni(KRAB.stlBinarni(rozmistene, 'remenice - github_site'), app.jmeno('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) app.stahni(KRAB.soubor3mf(rozmistene, app.p.nazev || 'Řemenice'), app.jmeno('.3mf'), 'model/3mf'); });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tTisk', h => { stavZobr.tisk = h; if (wasm) ukazNahled(); });
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  for (const [id, f] of [['cProfil', kresliProfil], ['cPohon', kresliPohon]]) new ResizeObserver(() => { if (vysl) f(); }).observe($(id));

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => {
        chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – výpočty fungují, model ani export ne.';
        const st = $('stav3d'); st.textContent = chybaJadra; st.classList.add('chyba');
        prepocitej();
      },
    },
  });
  window.REMENICE_UI = { get p() { return app.p; }, get sestava() { return sestava; }, get rozmistene() { return rozmistene; }, zmen: app.zmen, nahrad: app.nahrad, naplnFormular: app.naplnFormular, prepocitej, nahled, PREDVOLBY, app };
})();
