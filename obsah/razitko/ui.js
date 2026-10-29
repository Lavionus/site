/* Razítka – ovládání stránky: formulář, písma, SVG, otisk, výpočet ve workeru, výsledky, kontroly, export. */
/* global RAZ, RAZ_NAHLED, KRAB, FONTY, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_razitko_projekt';
  const fmt = RAZ.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ---------- stav ---------- */
  let p = nactiUlozeny(), mot = null, vysledek = null;
  function nactiUlozeny() {
    try { const t = localStorage.getItem(KLIC); if (t) return RAZ.normalizuj(JSON.parse(t)).p; } catch (e) { /* poškozený záznam */ }
    return RAZ.zPredvolby(0);
  }
  function uloz() {
    try { localStorage.setItem(KLIC, JSON.stringify(p)); }
    catch (e) { /* plné úložiště – návrh zůstane jen v okně, uložit jde do souboru */ }
  }
  function zmen(fn) {
    fn(p);
    p = RAZ.normalizuj(p).p;
    uloz(); naplnFormular(); naplanuj();
  }

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
    sel.value = p.motiv.pismo;
  }).catch(() => { /* zůstane výchozí písmo */ });

  /* ---------- formulář ---------- */
  const pole = [...document.querySelectorAll('[data-p]')];
  $('f_mat').innerHTML = Object.entries(RAZ.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('f_rtyp').innerHTML = Object.entries(RAZ.RUKOJETI).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  function naplnFormular() {
    for (const el of pole) {
      const h = RAZ.vezmi(p, el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!h;
      else if (document.activeElement !== el) el.value = el.dataset.typ === 'text' ? (h ?? '') : String(h).replace('.', ',');
      el.classList.remove('spatne');
    }
    for (const b of document.querySelectorAll('[data-druh]')) b.setAttribute('aria-pressed', String(b.dataset.druh === p.druh));
    for (const b of document.querySelectorAll('[data-tvar]')) { b.setAttribute('aria-pressed', String(b.dataset.tvar === p.tvar)); b.disabled = p.druh === 'pecet' && b.dataset.tvar !== 'kruh'; }
    for (const b of document.querySelectorAll('[data-zdroj]')) b.setAttribute('aria-pressed', String(b.dataset.zdroj === p.motiv.zdroj));
    viditelnost();
  }
  function viditelnost() {
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
  for (const el of pole) {
    const akce = () => {
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = RAZ.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      RAZ.poloz(p, el.dataset.p, h);
      p = RAZ.normalizuj(p).p;
      uloz(); viditelnost(); naplanuj();
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.dataset.typ !== 'text') el.addEventListener('change', () => {
      // po potvrzení ukázat hodnotu, se kterou se opravdu počítá (meze)
      const psano = RAZ.cislo(el.value, NaN), h = RAZ.vezmi(p, el.dataset.p), r = RAZ.ROZSAHY[el.dataset.p];
      el.value = String(h).replace('.', ',');
      if (Number.isFinite(psano) && Math.abs(psano - h) > 1e-9 && r) {
        el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
        Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: rozsah ${fmt(r[0], 2)}–${fmt(r[1], 2)}, použito ${fmt(h, 2)}.`);
      }
    });
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') el.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const h = RAZ.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
      e.preventDefault();
      const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
      el.dispatchEvent(new Event('input'));
    });
  }
  const VYCHOZI_DRUHU = {
    razitko: { relief: { rezim: 'vystouply', vyska: 1.5, uhel: 30 }, deska: 3 },
    pecet: { tvar: 'kruh', sirka: 25, relief: { rezim: 'vyhloubeny', vyska: 1.2, uhel: 15 }, deska: 4, rukojet: { typ: 'hribova', prumer: 12, delka: 55, hlava: 20 } },
    plaketa: { relief: { rezim: 'vystouply', vyska: 1.6, uhel: 0 }, deska: 3 },
  };
  document.querySelectorAll('[data-druh]').forEach(b => b.addEventListener('click', () => zmen(x => {
    if (x.druh === b.dataset.druh) return;
    const v = VYCHOZI_DRUHU[b.dataset.druh];
    x.druh = b.dataset.druh;
    for (const [k, h] of Object.entries(v)) x[k] = h && typeof h === 'object' ? Object.assign({}, x[k], h) : h;
    if (x.tvar === 'kruh') x.vyska = x.sirka;
  })));
  document.querySelectorAll('[data-tvar]').forEach(b => b.addEventListener('click', () => zmen(x => {
    if (x.tvar === b.dataset.tvar) return;
    x.tvar = b.dataset.tvar;
    if (x.tvar !== 'kruh' && x.vyska >= x.sirka) x.vyska = Math.round(x.sirka * 0.45);
  })));
  document.querySelectorAll('[data-zdroj]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.zdroj === 'svg' && !p.motiv.svg) { $('souborSvg').click(); return; }
    zmen(x => { x.motiv.zdroj = b.dataset.zdroj; });
  }));
  $('btnSvg').addEventListener('click', () => $('souborSvg').click());
  $('souborSvg').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const text = await f.text();
    if (text.length > RAZ.MAX_SVG) { Dialog.chyba('SVG je větší než 400 kB – zjednodušte ho (např. Inkscape: Uložit jako optimalizované SVG).'); return; }
    try { globalThis.MDL.svgNaKontury(globalThis.MDL.ctiSvg(text), p.motiv.svgRezim, 0); }
    catch (err) { Dialog.chyba('SVG se nedá použít: ' + err.message); return; }
    zmen(x => { x.motiv.svg = text; x.motiv.svgNazev = f.name.slice(0, 120); x.motiv.zdroj = 'svg'; });
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
    const s = Math.min((w - 16) / p.sirka, (h - 16) / p.vyska), X = x => w / 2 + x * s, Y = y => h / 2 - y * s;
    // cesty v mm ([[x, y]]) nebo z Clipperu ({X, Y} v µm)
    const cesta = (cesty, mm) => {
      g.beginPath();
      for (const c of cesty) {
        (mm ? c : RAZ.zInt(c)).forEach((q, i) => (i ? g.lineTo : g.moveTo).call(g, X(q[0]), Y(q[1])));
        g.closePath();
      }
    };
    const barva = css('--text'), papir = css('--bg-elevated');
    const ink = p.druh === 'razitko' && p.relief.rezim === 'vyhloubeny';   // negativní razítko: barví pozadí
    cesta([mot.deska], true); g.fillStyle = ink ? barva : papir; g.fill();
    g.strokeStyle = css('--border-strong'); g.lineWidth = 1; g.stroke();
    if (mot.M.length) { cesta(mot.M); g.fillStyle = ink ? papir : barva; g.fill('evenodd'); }
    const mer = vysledek && vysledek.mer;
    if (mer && vysledek.motKlic === klicMotivu) {
      if (mer.tenkeMez.length) { cesta(mer.tenkeMez); g.fillStyle = css('--warn'); g.fill('evenodd'); }
      if (mer.tenke.length) { cesta(mer.tenke); g.fillStyle = css('--danger'); g.fill('evenodd'); }
    }
    if (mot.otvor) { g.beginPath(); g.arc(X(mot.otvor.x), Y(mot.otvor.y), mot.otvor.r * s, 0, 2 * Math.PI); g.fillStyle = css('--bg-input'); g.fill(); g.stroke(); }
    $('nOtisk').textContent = { razitko: 'Otisk na papíře', pecet: 'Otisk ve vosku (čte se)', plaketa: 'Pohled na plaketu' }[p.druh];
    $('lgBarva').textContent = p.druh === 'razitko' ? 'barva' : p.relief.rezim === 'vyhloubeny' ? (p.druh === 'pecet' ? 've vosku vystoupí' : 'vyryto') : (p.druh === 'pecet' ? 've vosku zapadne' : 'vystupuje');
  }
  new ResizeObserver(() => requestAnimationFrame(kresliOtisk)).observe($('cOtisk'));

  /* ---------- výpočet ---------- */
  const nahled = RAZ_NAHLED.vytvorNahled($('platno'));
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
    const q = RAZ.kopie(p);
    const potrebaPisma = (q.motiv.zdroj === 'text' && q.motiv.text.trim()) || (q.tvar === 'kruh' && (q.obvod.nahore.trim() || q.obvod.dole.trim()));
    let f = null;
    if (potrebaPisma) {
      try { f = await font(q.motiv.pismo); }
      catch (e) { stav3d('Písmo se nenačetlo: ' + (e && e.message || e), true); return; }
    }
    if (JSON.stringify(q) !== JSON.stringify(p)) { naplanuj(); return; }   // mezitím se změnilo
    mot = RAZ.motiv(q, { font: f });
    klicMotivu = JSON.stringify(q);
    kresliOtisk();
    if (mot.chyba) { vysledek = null; vypis(q); nahled.nastav([]); stav3d(mot.chyba, true); return; }
    if (!worker) { stav3d('Prohlížeč nepodporuje výpočet na pozadí (Web Worker) – 3D model nejde sestavit.', true); vypis(q); return; }
    bezi = true; posledniId++;
    stav3d('Počítám model…');
    worker.postMessage({ id: posledniId, p: q, mot: { chyba: null, deska: mot.deska, deskaInt: mot.deskaInt, M: mot.M, otvor: mot.otvor }, klic: klicMotivu });
    worker.__klic = klicMotivu; worker.__p = q;
  }
  function prijmi(r) {
    const q = worker.__p;
    vysledek = { mer: r.mer || null, motKlic: worker.__klic, dily: [], chyba: r.chyba || null, p: q };
    if (r.dily && r.dily.length) {
      vysledek.dily = r.dily;
      vysledek.tisk = KRAB.tiskoveRozlozeni(r.dily.map(d => ({ jmeno: d.jmeno, nazev: d.nazev, poz: d.poz, idx: d.idx })), 8);
      nahled.nastav(vysledek.tisk);
    } else nahled.nastav([]);
    stav3d(r.chyba || '', !!r.chyba);
    kresliOtisk(); vypis(q);
  }

  /* ---------- výsledky a kontroly ---------- */
  const box = (popis, cislo, dalsi, tr) => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr || ''}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
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
    if (dily.length) {
      const mat = RAZ.MATERIALY[q.tisk.material];
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
    // hlášení
    const ul = $('hlaseni'); ul.innerHTML = '';
    for (const x of H) {
      const li = document.createElement('li'); li.className = x.uroven + (x.pole.length ? ' skok' : '');
      li.textContent = x.text;
      if (x.pole.length) {
        li.tabIndex = 0;
        const kam = document.createElement('span'); kam.className = 'kam'; kam.textContent = '→ upravit'; li.appendChild(kam);
        li.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') jdiNaPole(x.pole[0]); });
        li.addEventListener('keydown', e => { if (e.key === 'Enter') jdiNaPole(x.pole[0]); });
      }
      if (x.oprava) {
        const b = document.createElement('button'); b.className = 'tl oprava'; b.textContent = '🔧 ' + x.oprava.text;
        b.addEventListener('click', () => zmen(y => RAZ.poloz(y, x.oprava.pole, x.oprava.hodnota)));
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const o = $('stavOdznak');
    o.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    o.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    const vMotivu = x => x.pole.some(c => /^(motiv|obvod|ramecek)/.test(c));
    TrubkyGui.oznacChybu('boxMotiv', H.some(x => x.uroven === 'chyba' && vMotivu(x)));
    TrubkyGui.oznacChybu('boxTeleso', H.some(x => x.uroven === 'chyba' && !vMotivu(x)));
    souhrny(q);
    exportDilu();
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
  function jdiNaPole(cesta) {
    let el = document.querySelector(`[data-p="${cesta}"]`);
    if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    if (el.closest('[hidden]')) el = el.closest('details:not([hidden])') || el;
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (el.focus) el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }

  /* ---------- export ---------- */
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'razitko') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function dilyKExportu(jen) {
    if (!vysledek || !vysledek.dily.length || JSON.stringify(vysledek.p) !== JSON.stringify(p)) {
      Dialog.chyba(mot && mot.chyba ? 'Model nelze sestavit: ' + mot.chyba : 'Model se ještě počítá – zkuste to za chvilku.'); return null;
    }
    const BARVY = ['#3F7BD6', '#D98A4F'];
    const zdroj = vysledek.dily.map((d, i) => ({ jmeno: d.jmeno, nazev: d.nazev, poz: d.poz, idx: d.idx, barva: BARVY[i % 2] }));
    return KRAB.tiskoveRozlozeni(jen != null ? [zdroj[jen]] : zdroj, 8);
  }
  function exportStl(jen) {
    const d = dilyKExportu(jen); if (!d) return;
    stahni(KRAB.stlBinarni(d, 'razitko - github_site'), jmenoSouboru(jen != null ? '_' + d[0].jmeno + '.stl' : '.stl'), 'model/stl');
  }
  function export3mf(jen) {
    const d = dilyKExportu(jen); if (!d) return;
    stahni(KRAB.soubor3mf(d, p.nazev || 'Razítko'), jmenoSouboru(jen != null ? '_' + d[0].jmeno + '.3mf' : '.3mf'), 'model/3mf');
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
  $('btnPng').addEventListener('click', () => fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))));
  $('btnOtiskSvg').addEventListener('click', () => {
    if (!mot || mot.chyba) { Dialog.chyba('Motiv zatím není.'); return; }
    // otisk 1 : 1 v mm (jak se čte) – na kontrolu velikosti vytisknout ve 100 %
    const W = p.sirka + 4, H = p.vyska + 4, d = cesty => cesty.map(c => 'M' + c.map(([x, y]) => `${(x + W / 2).toFixed(3)} ${(H / 2 - y).toFixed(3)}`).join('L') + 'Z').join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`
      + `<path d="${d([mot.deska])}" fill="none" stroke="#999" stroke-width="0.1"/><path d="${d(mot.M.map(c => c.map(q => [q.X / 1000, q.Y / 1000])))}" fill="#000" fill-rule="evenodd"/></svg>`;
    stahni(svg, jmenoSouboru('_otisk.svg'), 'image/svg+xml');
  });
  $('btnUlozit').addEventListener('click', () => stahni(RAZ.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = RAZ.nactiProjekt(await f.text());
      zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, r.p); });
      Dialog.info(r.hlaseni.length ? 'Projekt načten s úpravami: ' + r.hlaseni.join('; ') + '.' : 'Projekt načten.');
    } catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Vrátit návrh na výchozí razítko?')) return;
    zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, RAZ.zPredvolby(0)); });
  });
  const seznam = $('seznamPredvoleb');
  RAZ.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, RAZ.zPredvolby(i)); }));
    seznam.appendChild(b);
  });
  $('tHrany').addEventListener('click', () => { const b = $('tHrany'), h = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(h)); nahled.prepni('hrany', h); });
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnZavritNap').addEventListener('click', () => $('napoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open) return;
    const k = e.key.toLowerCase();
    if (k === '1') nahled.pohled('iso'); else if (k === '2') nahled.pohled('shora'); else if (k === '3') nahled.pohled('zboku');
    else if (k === 'h') $('tHrany').click();
  });
  const barvyNahledu = () => nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
  new MutationObserver(() => { barvyNahledu(); kresliOtisk(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  TrubkyGui.pripoj({ klic: 'webapp_razitko_gui', pohled: j => nahled.pohled(j) });
  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_razitko_tvary', typ: 'razitko', nazev: 'Razítka', kontejner: $('tvary'),
    parametry: () => RAZ.kopie(p),
    pouzij: q => zmen(x => { const r = RAZ.normalizuj(q).p; Object.keys(x).forEach(k => delete x[k]); Object.assign(x, r); }),
    popis: q => `${q.nazev || 'Razítko'} – ${RAZ.DRUHY[q.druh] || ''} ${q.tvar === 'kruh' ? 'Ø ' + fmt(q.sirka) : fmt(q.sirka) + ' × ' + fmt(q.vyska)} mm`,
  });

  /* ---------- start ---------- */
  barvyNahledu();
  naplnFormular();
  spust();
  window.RAZ_UI = { get p() { return p; }, get mot() { return mot; }, get vysledek() { return vysledek; }, zmen, nahled };
})();
