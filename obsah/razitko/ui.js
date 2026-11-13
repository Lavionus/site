/* Razítka – ovládání stránky nad společným zapojením gen3d/aplikace.js: tady jen to, co je pro razítka zvláštní
   (písma, SVG, otisk, výpočet ve workeru, výsledky, kusovník, export, montážní poloha). */
/* global RAZ, RAZ_NAHLED, KRAB, FONTY, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = RAZ.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, mot = null, vysledek = null;
  const stavZobr = { tisk: true };
  const nahled = RAZ_NAHLED.vytvorNahled($('platno'));

  const app = G3D.aplikace({
    typ: 'razitko', nazev: 'Razítka', klic: 'webapp_razitko', soubor: 'razitko',
    normalizuj: RAZ.normalizuj, vychozi: () => RAZ.zPredvolby(0),
    ulozProjekt: RAZ.ulozProjekt, nactiProjekt: RAZ.nactiProjekt,
    popis: q => `${q.nazev || 'Razítko'} – ${RAZ.DRUHY[q.druh] || ''} ${q.tvar === 'kruh' ? 'Ø ' + fmt(q.sirka) : fmt(q.sirka) + ' × ' + fmt(q.vyska)} mm`,
    vezmi: RAZ.vezmi, poloz: RAZ.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => naplanuj(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: async () => { const d = await dilyKExportu(); return d ? { data: KRAB.soubor3mf(d, app.p.nazev || 'Razítko'), pripona: '.3mf' } : null; },
    zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', r: 'tRez', l: 'tPravitka' },
    zmenaTematu: () => { barvyNahledu(); kresliOtisk(); },
  });
  p = app.p;

  /* ---------- písma ---------- */
  const fonty = new Map();
  function font(id) {
    if (!fonty.has(id)) fonty.set(id, FONTY.opentype(id).catch(e => { fonty.delete(id); throw e; }));
    return fonty.get(id);
  }
  FONTY.seznam().then(sez => {
    const sel = $('f_pismo');
    sel.innerHTML = sez.filter(f => f.pro3d !== false && (!f.pismo || f.pismo === 'latinka'))
      .map(f => `<option value="${String(f.id).replace(/"/g, '&quot;')}">${String(f.nazev).replace(/</g, '&lt;')}${f.vlastni ? ' (vlastní)' : ''}</option>`).join('');
    sel.value = app.p.motiv.pismo;
  }).catch(() => { /* zůstane výchozí písmo */ });

  /* ---------- formulář ---------- */
  $('f_mat').innerHTML = Object.entries(RAZ.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('f_rtyp').innerHTML = Object.entries(RAZ.RUKOJETI).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  function viditelnost() {
    p = app.p;
    for (const b of document.querySelectorAll('[data-druh]')) b.setAttribute('aria-pressed', String(b.dataset.druh === p.druh));
    for (const b of document.querySelectorAll('[data-tvar]')) { b.setAttribute('aria-pressed', String(b.dataset.tvar === p.tvar)); b.disabled = p.druh === 'pecet' && b.dataset.tvar !== 'kruh'; }
    for (const b of document.querySelectorAll('[data-zdroj]')) b.setAttribute('aria-pressed', String(b.dataset.zdroj === p.motiv.zdroj));
    const kruh = p.tvar === 'kruh', svg = p.motiv.zdroj === 'svg', plak = p.druh === 'plaketa', R = p.rukojet.typ;
    $('gText').hidden = svg; $('gSvg').hidden = !svg;
    for (const id of ['pRad', 'pVel', 'pPro']) $(id).hidden = svg;   // písmo zůstává – používá ho i text po obvodu
    $('dObvod').hidden = !kruh;
    $('pVys').hidden = kruh; $('pZaob').hidden = p.tvar !== 'obdelnik';
    $('lSirka').textContent = kruh ? 'Průměr' : 'Šířka';
    $('dRukojet').hidden = plak; $('dOtvor').hidden = !plak;
    $('gRukojet').hidden = R === 'zadna';
    $('pHlava').hidden = !(R === 'hribova' || R === 'cep');
    for (const id of ['pCep', 'pHloubka', 'pVule']) $(id).hidden = R !== 'cep';
    $('lRv').textContent = p.relief.rezim === 'vyhloubeny' ? 'Hloubka vyhloubení' : 'Výška reliéfu';
    $('svgNazev').textContent = p.motiv.svg ? (p.motiv.svgNazev || 'obrázek.svg') : 'žádný obrázek';
    $('tipDruh').textContent = {
      razitko: 'Motiv je na desce zrcadlově, otiskne se správně. Reliéf 1–2 mm, deska 2–3 mm.',
      pecet: 'Pečeť do vosku: vyhloubený motiv ve vosku vystoupí, vystouplý se vtiskne. Motiv je zrcadlově.',
      plaketa: 'Reliéf / plaketa: motiv se čte přímo (nezrcadlí se), vystouplý nebo vyrytý do desky.',
    }[p.druh];
    $('tipRukojet').textContent = {
      zadna: 'Jen deska – nalepte ji na dřevěný špalík (oboustranná páska, lepidlo).',
      valcova: 'Válec s přechodem do desky pod 45° – tiskne se konejšem dolů bez podpor.',
      hribova: 'Hřib s plochou hlavicí – hlavice leží na podložce, přechod do desky pod 45°.',
      cep: 'Deska s jamkou a samostatná rukojeť s čepem (lepí se). Deska je nízká a tiskne se rychle – vhodné pro TPU desku a PLA rukojeť.',
    }[R];
  }
  // pole se přepočítávají už při psaní (jako dřív); rychlé změny jednoho pole = jeden krok zpět
  document.querySelectorAll('[data-p]').forEach(el => {
    if (el.tagName === 'SELECT' || el.type === 'checkbox') return;
    el.addEventListener('input', () => {
      const c = el.dataset.p;
      let h = el.value;
      if (el.dataset.typ !== 'text') { h = G3D.ctiCislo(el.value); if (!Number.isFinite(h)) return; }
      app.zmen(q => RAZ.poloz(q, c, h), 'pole:' + c);
    });
    // gen3d obsluhu „change“ pole přepíše hodnotou v mezích – zapamatovat si, co uživatel napsal
    el.addEventListener('change', () => { el.dataset.psano = el.value; }, true);
  });
  // rozsah: porovnat napsanou hodnotu (zachycenou před gen3d) s použitou
  document.querySelectorAll('[data-p]').forEach(el => {
    if (el.tagName !== 'INPUT' || el.type === 'checkbox' || el.dataset.typ === 'text') return;
    el.addEventListener('change', () => {
      const psano = G3D.ctiCislo(el.dataset.psano), h = RAZ.vezmi(app.p, el.dataset.p), r = RAZ.ROZSAHY[el.dataset.p];
      if (!r || !Number.isFinite(psano) || Math.abs(psano - h) < 1e-9) return;
      el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
      Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: rozsah ${fmt(r[0], 2)}–${fmt(r[1], 2)}, použito ${fmt(h, 2)}.`);
    });
  });
  const VYCHOZI_DRUHU = {
    razitko: { relief: { rezim: 'vystouply', vyska: 1.5, uhel: 30 }, deska: 3 },
    pecet: { tvar: 'kruh', sirka: 25, relief: { rezim: 'vyhloubeny', vyska: 1.2, uhel: 15 }, deska: 4, rukojet: { typ: 'hribova', prumer: 12, delka: 55, hlava: 20 } },
    plaketa: { relief: { rezim: 'vystouply', vyska: 1.6, uhel: 0 }, deska: 3 },
  };
  const zmenANaplni = f => { app.zmen(f); app.naplnFormular(); };
  document.querySelectorAll('[data-druh]').forEach(b => b.addEventListener('click', () => zmenANaplni(x => {
    if (x.druh === b.dataset.druh) return;
    const v = VYCHOZI_DRUHU[b.dataset.druh];
    x.druh = b.dataset.druh;
    for (const [k, h] of Object.entries(v)) x[k] = h && typeof h === 'object' ? Object.assign({}, x[k], h) : h;
    if (x.tvar === 'kruh') x.vyska = x.sirka;
  })));
  document.querySelectorAll('[data-tvar]').forEach(b => b.addEventListener('click', () => zmenANaplni(x => {
    if (x.tvar === b.dataset.tvar) return;
    x.tvar = b.dataset.tvar;
    if (x.tvar !== 'kruh' && x.vyska >= x.sirka) x.vyska = Math.round(x.sirka * 0.45);
  })));
  document.querySelectorAll('[data-zdroj]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.zdroj === 'svg' && !app.p.motiv.svg) { $('souborSvg').click(); return; }
    zmenANaplni(x => { x.motiv.zdroj = b.dataset.zdroj; });
  }));
  $('btnSvg').addEventListener('click', () => $('souborSvg').click());
  $('souborSvg').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const text = await f.text();
    if (text.length > RAZ.MAX_SVG) { Dialog.chyba('SVG je větší než 400 kB – zjednodušte ho (např. Inkscape: Uložit jako optimalizované SVG).'); return; }
    try { globalThis.MDL.svgNaKontury(globalThis.MDL.ctiSvg(text), app.p.motiv.svgRezim, 0); }
    catch (err) { Dialog.chyba('SVG se nedá použít: ' + err.message); return; }
    zmenANaplni(x => { x.motiv.svg = text; x.motiv.svgNazev = f.name.slice(0, 120); x.motiv.zdroj = 'svg'; });
  });

  /* ---------- otisk (2D) ---------- */
  function pripravPlatno(c) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), w = c.clientWidth || 300, h = c.clientHeight || 200;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w, h };
  }
  function kresliOtisk() {
    const { g, w, h } = pripravPlatno($('cOtisk'));
    if (!mot) return;
    const q = mot.p;
    const s = Math.min((w - 16) / q.sirka, (h - 16) / q.vyska), X = x => w / 2 + x * s, Y = y => h / 2 - y * s;
    // cesty v mm ([[x, y]]) nebo z Clipperu ({X, Y} v µm)
    const cesta = (cesty, mm) => {
      g.beginPath();
      for (const c of cesty) {
        (mm ? c : RAZ.zInt(c)).forEach((t, i) => (i ? g.lineTo : g.moveTo).call(g, X(t[0]), Y(t[1])));
        g.closePath();
      }
    };
    const barva = css('--text'), papir = css('--bg-elevated');
    const ink = q.druh === 'razitko' && q.relief.rezim === 'vyhloubeny';   // negativní razítko: barví pozadí
    cesta([mot.deska], true); g.fillStyle = ink ? barva : papir; g.fill();
    g.strokeStyle = css('--border-strong'); g.lineWidth = 1; g.stroke();
    if (mot.M.length) { cesta(mot.M); g.fillStyle = ink ? papir : barva; g.fill('evenodd'); }
    const mer = vysledek && vysledek.mer;
    if (mer && vysledek.motKlic === klicMotivu) {
      if (mer.tenkeMez.length) { cesta(mer.tenkeMez); g.fillStyle = css('--warn'); g.fill('evenodd'); }
      if (mer.tenke.length) { cesta(mer.tenke); g.fillStyle = css('--danger'); g.fill('evenodd'); }
    }
    if (mot.otvor) { g.beginPath(); g.arc(X(mot.otvor.x), Y(mot.otvor.y), mot.otvor.r * s, 0, 2 * Math.PI); g.fillStyle = css('--bg-input'); g.fill(); g.stroke(); }
    $('nOtisk').textContent = { razitko: 'Otisk na papíře', pecet: 'Otisk ve vosku (čte se)', plaketa: 'Pohled na plaketu' }[q.druh];
    $('lgBarva').textContent = q.druh === 'razitko' ? 'barva' : q.relief.rezim === 'vyhloubeny' ? (q.druh === 'pecet' ? 've vosku vystoupí' : 'vyryto') : (q.druh === 'pecet' ? 've vosku zapadne' : 'vystupuje');
  }
  new ResizeObserver(() => requestAnimationFrame(kresliOtisk)).observe($('cOtisk'));

  /* ---------- výpočet ---------- */
  const stav3d = (t, chyba) => { const s = $('stav3d'); s.textContent = t || ''; s.classList.toggle('chyba', !!chyba); };
  let worker = null, posledniId = 0, bezi = false, cekajici = false, casovac = null, klicMotivu = '';
  try { worker = new Worker('razitko/worker.js'); } catch (e) { worker = null; }
  if (worker) {
    worker.onmessage = e => {
      bezi = false;
      const r = e.data;
      if (r.id === posledniId) prijmi(r);
      if (cekajici) { cekajici = false; spust(); }
    };
    worker.onerror = e => { bezi = false; stav3d('Výpočetní vlákno selhalo: ' + (e.message || 'neznámá chyba'), true); };
  }
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(spust, 180); }
  async function spust() {
    if (bezi) { cekajici = true; return; }
    const q = RAZ.kopie(app.p);
    const potrebaPisma = (q.motiv.zdroj === 'text' && q.motiv.text.trim()) || (q.tvar === 'kruh' && (q.obvod.nahore.trim() || q.obvod.dole.trim()));
    let f = null;
    if (potrebaPisma) {
      try { f = await font(q.motiv.pismo); }
      catch (e) { stav3d('Písmo se nenačetlo: ' + (e && e.message || e), true); return; }
    }
    if (JSON.stringify(q) !== JSON.stringify(app.p)) { naplanuj(); return; }   // mezitím se změnilo
    mot = RAZ.motiv(q, { font: f }); mot.p = q;
    klicMotivu = JSON.stringify(q);
    kresliOtisk();
    if (mot.chyba) { vysledek = null; vypis(q); nahled.nastav(null); stav3d(mot.chyba, true); vyrid(); return; }
    if (!worker) { stav3d('Prohlížeč nepodporuje výpočet na pozadí (Web Worker) – 3D model nejde sestavit.', true); vypis(q); vyrid(); return; }
    bezi = true; posledniId++;
    stav3d(vysledek ? 'Počítám model…' : 'Načítám model…');   // poprvé se ve workeru načítá i geometrické jádro
    worker.postMessage({ id: posledniId, p: q, mot: { chyba: null, deska: mot.deska, deskaInt: mot.deskaInt, M: mot.M, otvor: mot.otvor }, klic: klicMotivu });
    worker.__klic = klicMotivu; worker.__p = q;
  }
  const BARVY = ['#3F7BD6', '#D98A4F'];
  function prijmi(r) {
    const q = worker.__p;
    vysledek = { mer: r.mer || null, motKlic: worker.__klic, dily: [], chyba: r.chyba || null, p: q };
    if (r.dily && r.dily.length) {
      vysledek.dily = r.dily.map((d, i) => Object.assign(d, { barva: BARVY[i % 2] }));
      vysledek.tisk = KRAB.tiskoveRozlozeni(vysledek.dily.map(d => ({ jmeno: d.jmeno, nazev: d.nazev, poz: d.poz, idx: d.idx, barva: d.barva })), 8);
      vysledek.montaz = montaz(vysledek.dily, q);
    }
    zobrazModel();
    stav3d(r.chyba || '', !!r.chyba);
    kresliOtisk(); vypis(q);
    vyrid();
  }
  /* export během přepočtu počká na model (místo hlášky „ještě se počítá“) */
  const aktualni = () => !!(vysledek && vysledek.dily.length && JSON.stringify(vysledek.p) === JSON.stringify(app.p));
  let cekatele = [];
  function vyrid() {
    if (JSON.stringify(mot && mot.p) !== JSON.stringify(app.p) && !aktualni()) return;   // počítá se starší stav
    const c = cekatele; cekatele = []; c.forEach(f => f());
  }
  function hotovyModel() {
    if (aktualni() || !worker || (mot && mot.chyba && JSON.stringify(mot.p) === JSON.stringify(app.p))) return Promise.resolve();
    return new Promise(ok => { cekatele.push(ok); setTimeout(ok, 120000); });
  }
  /** Montážní poloha: rukojeť na čep zasunutá do jamky, razítko a pečeť otočené motivem dolů (jak se drží v ruce). */
  function montaz(dily, q) {
    const otoc = q.druh !== 'plaketa', delkaCepu = Math.max(0.5, q.rukojet.hloubka - 0.4);
    return dily.map(d => {
      const dz = d.jmeno === 'rukojet' ? delkaCepu - G3D.obal(d.poz)[5] : 0, P = new Float32Array(d.poz.length);
      for (let i = 0; i < P.length; i += 3) {
        P[i] = d.poz[i];
        P[i + 1] = otoc ? -d.poz[i + 1] : d.poz[i + 1];
        P[i + 2] = otoc ? -(d.poz[i + 2] + dz) : d.poz[i + 2] + dz;
      }
      return Object.assign({}, d, { poz: P });
    });
  }
  function zobrazModel(novyPohled) {
    if (!vysledek || !vysledek.dily.length) { nahled.nastav(null); return; }
    nahled.nastav(stavZobr.tisk ? vysledek.tisk : vysledek.montaz, { tisk: stavZobr.tisk, uhel: 45, novyPohled });
  }

  /* ---------- výsledky a kontroly ---------- */
  const box = G3D.dlazdice;
  function vypis(q) {
    const v = vysledek && vysledek.p === q ? vysledek : null;
    const dily = v ? v.dily : [];
    let sit = null;
    if (v) {
      const pv = dily.reduce((s, d) => ({ previs: s.previs + d.previsy.previs, mosty: s.mosty + d.previsy.mosty }), { previs: 0, mosty: 0 });
      sit = { previsy: dily.length ? pv : null, chyba: v.chyba, vadna: dily.some(d => !d.kontrola.uzavrena || d.kontrola.objem <= 0) };
    }
    const H = RAZ.kontroly(q, mot, v ? v.mer : null, sit);
    // výsledky
    let html = '';
    const mat = RAZ.MATERIALY[q.tisk.material];
    if (dily.length) {
      let V = 0, hm = 0, fil = 0, cas = 0;
      for (const d of dily) {
        const b = d.kontrola.bbox, o = RAZ.odhad(d.kontrola.objem, b[5] - b[2], q);
        V += d.kontrola.objem; hm += o.hmotnost; fil += o.filament; cas += o.cas;
      }
      const hl = dily[0].kontrola.bbox;
      html += box(dily[0].nazev, `${fmt(hl[3] - hl[0])} × ${fmt(hl[4] - hl[1])} × ${fmt(hl[5] - hl[2])} mm`, dily[1] ? `${dily[1].nazev}: ${fmt(dily[1].kontrola.bbox[5] - dily[1].kontrola.bbox[2])} mm vysoká` : 'v tiskové poloze');
      html += box('Hmotnost', `${fmt(hm, 1)} g`, `${mat.nazev}, objem ${fmt(V / 1000, 2)} cm³ (100 % výplň)`);
      html += box('Filament 1,75 mm', `${fmt(fil, 2)} m`, 'horní odhad pro plnou výplň');
      html += box('Doba tisku', cas < 60 ? `≈ ${fmt(cas, 0)} min` : `≈ ${fmt(cas / 60, 1)} h`, `hrubě, vrstva ${fmt(q.tisk.vrstva, 2)} mm`);
      $('sVysledky').textContent = `${fmt(hm, 0)} g`;
    } else $('sVysledky').textContent = '';
    if (v && v.mer) {
      const m = v.mer, tr = q.tisk.tryska;
      html += box('Nejtenčí čára', `${m.cara >= 4 ? '> 4' : fmt(m.cara, 2)} mm`, `tryska ${fmt(tr, 2)} mm`, m.plochaTenkych > 0.01 ? 'mez-t' : 'ok-t');
      html += box(q.relief.rezim === 'vyhloubeny' ? 'Nejužší stěna' : 'Nejužší mezera', `${m.mezera >= 4 ? '> 4' : fmt(m.mezera, 2)} mm`, 'mezi tahy motivu', m.plochaTenkychMez > 0.01 ? 'mez-t' : 'ok-t');
      html += box('Plocha motivu', `${fmt(m.plochaMotivu / 100, 2)} cm²`, `${fmt(m.plochaMotivu / m.plochaDesky * 100, 0)} % desky`);
    }
    if (dily.length) {
      const ok = dily.every(d => d.kontrola.uzavrena && d.kontrola.objem > 0);
      html += box('Síť', ok ? 'uzavřená' : 'vadná', dily.map(d => `${d.nazev}: ${d.kontrola.trojuhelniku.toLocaleString('cs-CZ')} △`).join('<br>'), ok ? 'ok-t' : 'chyba-t');
    }
    $('vVysledky').innerHTML = html || box('Výsledky', '—', mot && mot.chyba ? mot.chyba : 'počítám…');
    kusovnik(dily, q, mat);
    app.hlaseni(H, { boxy: ['boxMotiv', 'boxTeleso'] });
    souhrny(q);
    exportDilu();
  }
  /** Kusovník – jen u více dílů (rukojeť na čep). */
  function kusovnik(dily, q, mat) {
    const vic = dily.length > 1;
    document.querySelector('[data-zalozka="kusovnik"]').hidden = !vic;
    if (!vic) { if (document.querySelector('[data-zalozka="kusovnik"][aria-selected="true"]')) TrubkyGui.otevriZalozku('vysledky'); $('tKusovnik').innerHTML = ''; return; }
    $('tKusovnik').innerHTML = '<tr><th>Díl</th><th class="c">Rozměr</th><th class="c">Hmotnost</th><th>Export</th></tr>' + dily.map((d, i) => {
      const b = d.kontrola.bbox, o = RAZ.odhad(d.kontrola.objem, b[5] - b[2], q);
      return `<tr><td><span class="tecka" style="background:${d.barva}"></span>${G3D.esc(d.nazev)}</td><td class="c">${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])}</td>`
        + `<td class="c">${fmt(o.hmotnost, 1)} g</td><td><button class="tl" data-i="${i}" data-f="stl">STL</button> <button class="tl" data-i="${i}" data-f="3mf">3MF</button></td></tr>`;
    }).join('') + `<tr><td colspan="4" class="pozn">1 sada, ${mat.nazev}. Rukojeť se do jamky lepí.</td></tr>`;
    $('tKusovnik').querySelectorAll('button').forEach(b => b.addEventListener('click', () => (b.dataset.f === 'stl' ? exportStl : export3mf)(+b.dataset.i)));
  }
  function souhrny(q) {
    TrubkyGui.souhrn('sDruh', `${RAZ.DRUHY[q.druh]} · ${q.tvar === 'kruh' ? 'Ø ' + fmt(q.sirka) : fmt(q.sirka) + ' × ' + fmt(q.vyska)} mm`);
    TrubkyGui.souhrn('sStred', q.motiv.zdroj === 'svg' ? `SVG ${fmt(q.motiv.svgSirka)} mm` : `${q.motiv.text.split('\n').filter(t => t.trim()).length} ř. · ${fmt(q.motiv.velikost)} mm`, q.motiv.zesileni !== 0);
    TrubkyGui.souhrn('sObvod', [q.obvod.nahore, q.obvod.dole].filter(t => t.trim()).length ? `${fmt(q.obvod.velikost)} mm` : 'bez textu');
    TrubkyGui.souhrn('sRamecek', q.ramecek.pocet ? `${q.ramecek.pocet}× ${fmt(q.ramecek.cara)} mm` : 'bez rámečku');
    TrubkyGui.souhrn('sRelief', `${q.relief.rezim === 'vyhloubeny' ? '−' : '+'}${fmt(q.relief.vyska)} mm${q.relief.uhel ? ', úkos ' + fmt(q.relief.uhel, 0) + '°' : ''}`);
    TrubkyGui.souhrn('sRukojet', RAZ.RUKOJETI[q.rukojet.typ]);
    TrubkyGui.souhrn('sOtvor', q.otvor.pouzit ? `Ø ${fmt(q.otvor.prumer)} mm` : 'bez otvoru');
    TrubkyGui.souhrn('sOtisk', RAZ.zrcadlit(q) ? 'na desce zrcadlově' : 'nezrcadlí se');
    $('sTisk').textContent = `${RAZ.MATERIALY[q.tisk.material].nazev}, ${fmt(q.tisk.tryska, 2)} mm`;
    const zRel = q.rukojet.typ === 'valcova' || q.rukojet.typ === 'hribova' ? (q.druh === 'plaketa' ? 0 : q.rukojet.delka) : 0;
    $('tipTisk').innerHTML = (q.relief.rezim === 'vystouply'
      ? `Reliéf začíná ve výšce <b>${fmt(zRel + q.deska, 2)} mm</b> nad podložkou – tam vložte ve sliceru výměnu filamentu (pauza / M600), chcete-li motiv jinou barvou.`
      : `Vyhloubení začíná ve výšce <b>${fmt(zRel + q.deska - q.relief.vyska, 2)} mm</b> nad podložkou.`)
      + ` Úkos boků ${q.relief.uhel ? `rozšíří tahy u paty o ${fmt(RAZ.ukos(q), 2)} mm` : 'je vypnutý'}. Nejtenčí čáru porovnávám s průměrem trysky.`;
  }

  /* ---------- export ---------- */
  async function dilyKExportu(jen) {
    await hotovyModel();
    if (!vysledek || !vysledek.dily.length || JSON.stringify(vysledek.p) !== JSON.stringify(app.p)) {
      Dialog.chyba(mot && mot.chyba ? 'Model nelze sestavit: ' + mot.chyba : 'Model se ještě počítá – zkuste to za chvilku.'); return null;
    }
    const zdroj = vysledek.dily.map(d => ({ jmeno: d.jmeno, nazev: d.nazev, poz: d.poz, idx: d.idx, barva: d.barva }));
    return KRAB.tiskoveRozlozeni(jen != null ? [zdroj[jen]] : zdroj, 8);
  }
  async function exportStl(jen) {
    const d = await dilyKExportu(jen); if (!d) return;
    app.stahni(KRAB.stlBinarni(d, 'razitko - github_site'), app.jmeno(jen != null ? '_' + d[0].jmeno + '.stl' : '.stl'), 'model/stl');
  }
  async function export3mf(jen) {
    const d = await dilyKExportu(jen); if (!d) return;
    app.stahni(KRAB.soubor3mf(d, app.p.nazev || 'Razítko'), app.jmeno(jen != null ? '_' + d[0].jmeno + '.3mf' : '.3mf'), 'model/3mf');
  }
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!vysledek || vysledek.dily.length < 2) return;
    vysledek.dily.forEach((d, i) => {
      for (const [typ, f] of [['STL', exportStl], ['3MF', export3mf]]) {
        const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
        b.innerHTML = `⬇ ${typ} – jen ${d.nazev.replace(/</g, '&lt;')}`;
        b.addEventListener('click', () => f(i));
        el.appendChild(b);
      }
    });
  }
  $('btnStl').addEventListener('click', () => exportStl());
  $('btn3mf').addEventListener('click', () => export3mf());
  $('btnOtiskSvg').addEventListener('click', () => {
    if (!mot || mot.chyba) { Dialog.chyba('Motiv zatím není.'); return; }
    // otisk 1 : 1 v mm (jak se čte) – na kontrolu velikosti vytisknout ve 100 %
    const q = mot.p, W = q.sirka + 4, H = q.vyska + 4, d = cesty => cesty.map(c => 'M' + c.map(([x, y]) => `${(x + W / 2).toFixed(3)} ${(H / 2 - y).toFixed(3)}`).join('L') + 'Z').join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`
      + `<path d="${d([mot.deska])}" fill="none" stroke="#999" stroke-width="0.1"/><path d="${d(mot.M.map(c => c.map(t => [t.X / 1000, t.Y / 1000])))}" fill="#000" fill-rule="evenodd"/></svg>`;
    app.stahni(svg, app.jmeno('_otisk.svg'), 'image/svg+xml');
  });
  RAZ.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => app.nahrad(RAZ.zPredvolby(i)));
    $('seznamPredvoleb').appendChild(b);
  });

  /* ---------- zobrazení ---------- */
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tTisk', h => {
    stavZobr.tisk = h;
    $('legPrevisy').hidden = !(h && nahled.stav.previsy);
    zobrazModel(true);
  });
  const barvyNahledu = () => nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
  TrubkyGui.pripoj({ klic: 'webapp_razitko_gui', pohled: j => nahled.pohled(j) });

  /* ---------- start ---------- */
  barvyNahledu();
  app.start();
  window.RAZ_UI = { get p() { return app.p; }, get mot() { return mot; }, get vysledek() { return vysledek; }, zmen: app.zmen, nahled, app };
})();
