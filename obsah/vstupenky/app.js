/* Vstupenky – návrh série, náhled, arch, tisk/PDF/CSV, projekty v IndexedDB.
   Kontrolu na vstupu má vstupenky/kontrola.js (sdílí window.VSTUP_APP). */
(function () {
  'use strict';
  const V = window.VSTUPENKY, K = window.VSTUPENKY_KRESLI;
  const $ = id => document.getElementById(id);
  const LS = 'webapp_vstupenky_';
  const lsCti = k => { try { return localStorage.getItem(LS + k); } catch (_) { return null; } };
  const lsPis = (k, v) => { try { localStorage.setItem(LS + k, v); } catch (_) { /* plné / zakázané */ } };
  const dlg = () => window.Dialog || { info: t => console.log(t), chyba: t => console.error(t), potvrd: async () => true, zeptej: async (t, v) => v };

  // ---------- IndexedDB ----------
  let dbSlib = null;
  function db() {
    if (!dbSlib) dbSlib = new Promise((hotovo, chyba) => {
      const r = indexedDB.open('webapp_vstupenky', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('projekty')) d.createObjectStore('projekty', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('seznamy')) d.createObjectStore('seznamy', { keyPath: 'id' });
      };
      r.onsuccess = () => hotovo(r.result);
      r.onerror = () => chyba(r.error);
    });
    return dbSlib;
  }
  async function dbOp(store, rezim, fn) {
    const d = await db();
    return new Promise((hotovo, chyba) => {
      const t = d.transaction(store, rezim), s = t.objectStore(store), r = fn(s);
      t.oncomplete = () => hotovo(r && r.result);
      t.onerror = () => chyba(t.error);
    });
  }
  const DB = {
    vse: store => dbOp(store, 'readonly', s => s.getAll()),
    nacti: (store, id) => dbOp(store, 'readonly', s => s.get(id)),
    uloz: (store, o) => dbOp(store, 'readwrite', s => s.put(o)),
    smaz: (store, id) => dbOp(store, 'readwrite', s => s.delete(id)),
  };

  // ---------- stav ----------
  let projekt = null;
  let serie = { kusy: [], varovani: [], chyba: null };
  let index = 0, list = 0, vybrany = null;
  const novyId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function cesta(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
  function nastav(o, p, v) {
    const k = p.split('.'), posl = k.pop();
    const cil = k.reduce((a, x) => (a[x] == null ? (a[x] = {}) : a[x]), o);
    cil[posl] = v;
  }

  // ---------- přepočet ----------
  function prepocti() {
    try {
      const r = V.kusy(projekt);
      serie = { kusy: r.kusy, varovani: r.varovani, chyba: null };
    } catch (e) {
      serie = { kusy: [], varovani: [], chyba: e.message };
    }
    if (index >= serie.kusy.length) index = Math.max(0, serie.kusy.length - 1);
  }
  function rozlozeni() {
    const a = projekt.arch;
    return V.rozlozeni({ arch: { w: +a.w, h: +a.h }, kus: { w: +projekt.rozmer.w, h: +projekt.rozmer.h }, okraj: +a.okraj, mezera: +a.mezera, otoceni: a.otoceni });
  }
  function kusyKTisku() {
    const od = +projekt.arch.tiskOd || 1, doo = +projekt.arch.tiskDo || Infinity;
    return serie.kusy.filter(k => k.poradi >= od && k.poradi <= doo);
  }

  // ---------- vykreslení ----------
  let casovacKresleni = 0, casovacUlozeni = 0;
  function zmena(bezPrepoctu) {
    if (!bezPrepoctu) prepocti();
    clearTimeout(casovacKresleni);
    casovacKresleni = setTimeout(vykresli, 30);
    clearTimeout(casovacUlozeni);
    casovacUlozeni = setTimeout(() => uloz(true), 800);
  }
  function vykresli() {
    vykresliInfo();
    vykresliKus();
    vykresliArch();
  }
  function vykresliInfo() {
    $('nazevProjektu').textContent = projekt.nazev || '';
    document.querySelectorAll('[data-rezim]').forEach(el => { el.hidden = el.dataset.rezim !== projekt.cislovani.rezim; });
    $('qrUrlRadek').hidden = projekt.qr.obsah === '{kod}';
    const v = $('varovani');
    v.innerHTML = '';
    if (serie.chyba) v.innerHTML = '<div class="chyba-box"></div>', v.firstChild.textContent = serie.chyba;
    for (const t of serie.varovani) { const d = document.createElement('div'); d.className = 'varovani'; d.textContent = t; v.appendChild(d); }
    const n = serie.kusy.length;
    const c = projekt.cislovani;
    let info = n + ' ks';
    if (n) info += ' · první ' + serie.kusy[0].kod + ' · poslední ' + serie.kusy[n - 1].kod;
    if (c.rezim === 'nahodne') {
      const ab = V.ABECEDY[c.abeceda] ? V.ABECEDY[c.abeceda].znaky.length : 0;
      if (ab) info += ' · kombinací ' + ab + '^' + c.delka + ' ≈ ' + Math.pow(ab, c.delka).toExponential(1).replace('e+', '·10^');
    }
    $('infoKody').textContent = info;
    $('infoSedadla').textContent = projekt.sedadla.zapnuto ? (serie.chyba ? '' : n + ' sedadel → ' + n + ' vstupenek') : 'Vypnuto – počet určuje číslování.';
    $('celkemKusu').textContent = '/ ' + n;
    $('cisloKusu').max = Math.max(1, n);
    $('cisloKusu').value = n ? index + 1 : 0;
    $('infoKus').textContent = projekt.rozmer.w + ' × ' + projekt.rozmer.h + ' mm' + (n ? ' · ' + serie.kusy[index].kod : '');
    let r;
    try { r = rozlozeni(); } catch (e) { $('infoArch').textContent = e.message; return; }
    const tisk = kusyKTisku().length;
    const listu = r.naArch ? Math.ceil(tisk / r.naArch) : 0;
    $('infoArch').textContent = r.naArch
      ? `${r.sloupcu} × ${r.radku} = ${r.naArch} ks na arch${r.otocit ? ' (otočeno)' : ''} · k tisku ${tisk} ks na ${listu} ${listu === 1 ? 'arch' : listu < 5 ? 'archy' : 'archů'}`
      : 'Kus se na arch nevejde – zmenši okraj nebo kus, nebo zvol větší arch.';
  }

  const platno = $('platno');
  let boxy = [], pxNahled = 4;
  function vykresliKus() {
    const W = +projekt.rozmer.w, H = +projekt.rozmer.h;
    const dpr = window.devicePixelRatio || 1;
    const max = Math.min(900, Math.max(260, $('nahled').clientWidth - 60));
    pxNahled = Math.min(max / W, 520 / H);
    platno.width = Math.round(W * pxNahled * dpr); platno.height = Math.round(H * pxNahled * dpr);
    platno.style.width = Math.round(W * pxNahled) + 'px';
    const ctx = platno.getContext('2d');
    ctx.clearRect(0, 0, platno.width, platno.height);
    boxy = [];
    const kus = serie.kusy[index] || prazdnyKus();
    K.kresliKus(ctx, projekt, kus, pxNahled * dpr, { boxy, vybrany });
  }
  function prazdnyKus() {
    const p = { poradi: 1, cislo: '—', kod: '—' };
    return { kod: '—', cislo: '—', poradi: 1, promenne: V.promenneKusu(projekt, p, null, 0) };
  }

  const archPlatno = $('arch');
  function vykresliArch() {
    const ctx = archPlatno.getContext('2d');
    let r;
    try { r = rozlozeni(); } catch (_) { return; }
    const tisk = kusyKTisku();
    const listu = Math.max(1, r.naArch ? Math.ceil(tisk.length / r.naArch) : 1);
    if (list >= listu) list = listu - 1;
    const max = Math.min(560, Math.max(240, $('nahled').clientWidth - 60));
    const px = Math.min(max / r.archW, 760 / r.archH), dpr = window.devicePixelRatio || 1;
    archPlatno.width = Math.round(r.archW * px * dpr); archPlatno.height = Math.round(r.archH * px * dpr);
    archPlatno.style.width = Math.round(r.archW * px) + 'px';
    const s = px * dpr;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, archPlatno.width, archPlatno.height);
    // nepotiskovatelný okraj
    ctx.strokeStyle = 'rgba(30,144,255,.35)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    const ok = +projekt.arch.okraj;
    if (ok > 0) ctx.strokeRect(ok * s, ok * s, (r.archW - 2 * ok) * s, (r.archH - 2 * ok) * s);
    ctx.setLineDash([]);
    const naListu = tisk.slice(list * r.naArch, (list + 1) * r.naArch);
    r.pozice.forEach((p, i) => {
      const kus = naListu[i];
      ctx.save();
      ctx.translate(p.x * s, p.y * s);
      if (kus) {
        if (r.otocit) { ctx.translate(r.w * s, 0); ctx.rotate(Math.PI / 2); }
        K.kresliKus(ctx, projekt, kus, s);
      } else {
        ctx.strokeStyle = '#ccc'; ctx.strokeRect(0, 0, r.w * s, r.h * s);
      }
      ctx.restore();
      if (kus && projekt.arch.obrys) { ctx.strokeStyle = '#999'; ctx.lineWidth = 0.5; ctx.strokeRect(p.x * s, p.y * s, r.w * s, r.h * s); }
    });
    if (projekt.arch.znacky) {
      ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(0.5, 0.2 * s);
      ctx.beginPath();
      for (const c of V.orezoveZnacky(r)) { ctx.moveTo(c.x1 * s, c.y1 * s); ctx.lineTo(c.x2 * s, c.y2 * s); }
      ctx.stroke();
    }
    $('cisloArchu').textContent = (list + 1) + ' / ' + listu;
    $('infoArchNahled').textContent = (projekt.arch.format === 'vlastni' ? '' : projekt.arch.format + ' · ') + r.archW + ' × ' + r.archH + ' mm';
  }

  // ---------- formulář ----------
  function naplnSelecty() {
    const pr = $('rozmerPreset');
    pr.innerHTML = Object.entries(V.ROZMERY).map(([k, r]) => `<option value="${k}">${r.nazev}</option>`).join('');
    $('selAbeceda').innerHTML = Object.entries(V.ABECEDY).map(([k, a]) => `<option value="${k}">${a.nazev}</option>`).join('');
    $('selKontrolni').innerHTML = Object.entries(V.KONTROLNI).map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
    $('selArch').innerHTML = Object.entries(V.ARCHY).map(([k, a]) => `<option value="${k}">${k} (${a[0]} × ${a[1]})</option>`).join('') +
      '<option value="A4L">A4 na šířku (297 × 210)</option><option value="vlastni">Vlastní</option>';
  }
  function naplnFormular() {
    document.querySelectorAll('[data-p]').forEach(el => {
      const v = cesta(projekt, el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
    });
    const r = Object.entries(V.ROZMERY).find(([, x]) => x.w === +projekt.rozmer.w && x.h === +projekt.rozmer.h);
    $('rozmerPreset').value = r ? r[0] : 'vlastni';
    vykresliPrvky();
  }
  document.querySelectorAll('[data-p]').forEach(el => {
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color' ? 'change' : 'input', () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number' && v !== '' && !/^arch\.tisk/.test(el.dataset.p)) v = +v;
      nastav(projekt, el.dataset.p, v);
      if (el.dataset.p === 'rozmer.w' || el.dataset.p === 'rozmer.h') {
        const r = Object.entries(V.ROZMERY).find(([, x]) => x.w === +projekt.rozmer.w && x.h === +projekt.rozmer.h);
        $('rozmerPreset').value = r ? r[0] : 'vlastni';
      }
      if (el.dataset.p === 'arch.w' || el.dataset.p === 'arch.h') { projekt.arch.format = 'vlastni'; $('selArch').value = 'vlastni'; }
      if (el.dataset.p === 'qr.obsah' && v === 'url' && !projekt.qr.url) { projekt.qr.url = 'https://moje-akce.cz/vstup?kod={kod}'; naplnFormular(); }
      zmena();
    });
  });
  $('rozmerPreset').addEventListener('change', e => {
    const r = V.ROZMERY[e.target.value];
    if (!r || !r.w) return;
    projekt.rozmer = { w: r.w, h: r.h };
    naplnFormular(); zmena();
  });
  $('selArch').addEventListener('change', e => {
    const f = e.target.value;
    if (V.ARCHY[f]) { projekt.arch.w = V.ARCHY[f][0]; projekt.arch.h = V.ARCHY[f][1]; }
    else if (f === 'A4L') { projekt.arch.w = 297; projekt.arch.h = 210; }
    naplnFormular(); zmena();
  });

  // ---------- prvky ----------
  const PROMENNE = ['kod', 'cislo', 'akce', 'podtitul', 'datum', 'misto_konani', 'cena', 'poznamka', 'rada', 'misto', 'sektor', 'poradi', 'celkem', 'url'];
  let posledniPole = null;
  $('promenne').innerHTML = PROMENNE.map(p => `<code data-prom="${p}">{${p}}</code>`).join('');
  $('promenne').addEventListener('mousedown', e => e.preventDefault());   // nevzít fokus poli
  $('promenne').addEventListener('click', e => {
    const p = e.target.dataset.prom;
    if (!p || !posledniPole) return;
    const el = posledniPole, a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
    el.value = el.value.slice(0, a) + '{' + p + '}' + el.value.slice(b);
    el.dispatchEvent(new Event('input'));
    el.focus(); el.selectionStart = el.selectionEnd = a + p.length + 2;
  });
  function vykresliPrvky() {
    const box = $('prvky');
    box.innerHTML = '';
    projekt.prvky.forEach((pr, i) => {
      const d = document.createElement('div');
      d.className = 'prvek' + (vybrany && vybrany.druh === 'prvek' && vybrany.i === i ? ' vybrany' : '');
      d.innerHTML = `<input data-k="text" aria-label="Text prvku">
        <div class="radek">
          <select data-k="oblast" title="Oblast"><option value="hlavni">hlavní</option><option value="ustrizek">ústřižek</option></select>
          <input type="number" data-k="pt" min="3" max="200" step="0.5" title="Velikost písma (pt)">
          <select data-k="zarovnani" title="Zarovnání"><option value="l">⇤</option><option value="c">↔</option><option value="r">⇥</option></select>
          <label class="zaskrt" title="Tučně"><input type="checkbox" data-k="tucne"><b>B</b></label>
          <input type="color" data-k="barva" title="Barva (prázdná = barva textu projektu)" style="width:34px">
          <button class="tl" data-akce="smazat" title="Smazat prvek">🗑</button>
        </div>
        <div class="radek pozn">x <input type="number" data-k="x" step="1" style="width:58px"> % · y <input type="number" data-k="y" step="1" style="width:58px"> %</div>`;
      d.querySelectorAll('[data-k]').forEach(el => {
        const k = el.dataset.k;
        if (el.type === 'checkbox') el.checked = !!pr[k];
        else el.value = k === 'barva' ? (pr.barva || projekt.barvaTextu || '#000000') : pr[k];
        el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'color' ? 'change' : 'input', () => {
          pr[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
          zmena(true);
        });
        el.addEventListener('focus', () => {
          if (k === 'text') posledniPole = el;
          if (!(vybrany && vybrany.druh === 'prvek' && vybrany.i === i)) { vybrany = { druh: 'prvek', i }; box.querySelectorAll('.prvek').forEach((x, j) => x.classList.toggle('vybrany', j === i)); zmena(true); }
        });
      });
      d.querySelector('[data-akce="smazat"]').onclick = () => { projekt.prvky.splice(i, 1); vybrany = null; vykresliPrvky(); zmena(true); };
      box.appendChild(d);
    });
  }
  $('pridatPrvek').onclick = () => {
    projekt.prvky.push({ text: 'Nový text {kod}', x: 10, y: 50, pt: 10, oblast: 'hlavni', zarovnani: 'l', tucne: false, barva: '', otoc: 0 });
    vybrany = { druh: 'prvek', i: projekt.prvky.length - 1 };
    vykresliPrvky(); zmena(true);
    $('prvky').lastChild.querySelector('input').focus();
  };

  // tažení prvků v náhledu
  let tah = null;
  function bodMm(e) {
    const r = platno.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * projekt.rozmer.w, y: (e.clientY - r.top) / r.height * projekt.rozmer.h };
  }
  function cilTahu(b) {
    if (b.druh === 'prvek') return projekt.prvky[b.i];
    if (b.druh === 'qr') return projekt.qr;
    if (b.druh === 'carovy') return projekt.carovy;
    if (b.druh === 'logo') return projekt.logoPozice;
  }
  platno.addEventListener('pointerdown', e => {
    const m = bodMm(e);
    const b = boxy.slice().reverse().find(b => m.x >= b.x - 1 && m.x <= b.x + b.w + 1 && m.y >= b.y - 1 && m.y <= b.y + b.h + 1);
    vybrany = b ? { druh: b.druh, i: b.i } : null;
    vykresliPrvky();
    if (!b) return zmena(true);
    const cil = cilTahu(b), obl = V.oblasti(projekt);
    const o = (cil.oblast === 'ustrizek' && obl.ustrizek) ? obl.ustrizek : obl.hlavni;
    tah = { cil, o, m, x: cil.x, y: cil.y };
    platno.setPointerCapture(e.pointerId);
    platno.classList.add('tahne');
    zmena(true);
  });
  platno.addEventListener('pointermove', e => {
    if (!tah) return;
    const m = bodMm(e);
    tah.cil.x = Math.round((tah.x + (m.x - tah.m.x) / tah.o.w * 100) * 10) / 10;
    tah.cil.y = Math.round((tah.y + (m.y - tah.m.y) / tah.o.h * 100) * 10) / 10;
    clearTimeout(casovacKresleni);
    casovacKresleni = setTimeout(vykresliKus, 0);
  });
  const konecTahu = () => { if (!tah) return; tah = null; platno.classList.remove('tahne'); vykresliPrvky(); zmena(true); };
  platno.addEventListener('pointerup', konecTahu);
  platno.addEventListener('pointercancel', konecTahu);

  // ---------- obrázky ----------
  let cilObrazku = 'logo';
  function nactiObrazek(soubor, cil) {
    if (!soubor || !/^image\//.test(soubor.type)) return dlg().chyba('Tohle není obrázek.');
    if (soubor.size > 8e6) return dlg().chyba('Obrázek je příliš velký (nad 8 MB).');
    const fr = new FileReader();
    fr.onload = () => {
      if (cil === 'logo') projekt.logo = fr.result;
      else { projekt.pozadi.obrazek = fr.result; projekt.pozadi.druh = 'obrazek'; naplnFormular(); }
      K.nactiObrazky(projekt).then(() => zmena(true));
    };
    fr.readAsDataURL(soubor);
  }
  $('btnLogo').onclick = () => { cilObrazku = 'logo'; $('souborObr').click(); };
  $('btnPozadi').onclick = () => { cilObrazku = 'pozadi'; $('souborObr').click(); };
  $('btnLogoPryc').onclick = () => { projekt.logo = null; zmena(true); };
  $('btnPozadiPryc').onclick = () => { projekt.pozadi.obrazek = null; if (projekt.pozadi.druh === 'obrazek') projekt.pozadi.druh = 'barva'; naplnFormular(); zmena(true); };
  $('souborObr').onchange = e => { nactiObrazek(e.target.files[0], cilObrazku); e.target.value = ''; };

  // ---------- projekty ----------
  async function uloz(tise) {
    if (!projekt) return;
    projekt.upraveno = new Date().toISOString();
    try {
      await DB.uloz('projekty', projekt);
      lsPis('posledni', projekt.id);
      if (!tise) dlg().info('Projekt uložen.');
    } catch (e) { dlg().chyba('Uložení se nepovedlo: ' + e.message); }
  }
  async function otevri(p) {
    projekt = p;
    // starší / importované projekty doplnit o výchozí hodnoty
    const zaklad = V.novyProjekt(p.typ);
    for (const k of Object.keys(zaklad)) if (projekt[k] == null) projekt[k] = zaklad[k];
    for (const k of ['arch', 'cislovani', 'pozadi', 'qr', 'carovy', 'sedadla', 'texty', 'logoPozice', 'ustrizek'])
      projekt[k] = Object.assign({}, zaklad[k], projekt[k]);
    index = 0; list = 0; vybrany = null;
    lsPis('posledni', projekt.id);
    naplnFormular();
    await K.nactiObrazky(projekt);
    zmena();
  }
  function novy(typ) {
    const p = V.novyProjekt(typ);
    p.id = novyId();
    p.vytvoreno = new Date().toISOString();
    return otevri(p);
  }
  function stahni(nazev, obsah, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ }));
    a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const souborNazev = () => (projekt.nazev || 'vstupenky').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'vstupenky';

  async function zobrazProjekty() {
    const vse = (await DB.vse('projekty')).sort((a, b) => String(b.upraveno).localeCompare(String(a.upraveno)));
    const box = $('projektySeznam');
    box.innerHTML = vse.length ? '' : '<p class="pozn">Zatím žádné uložené projekty.</p>';
    for (const p of vse) {
      const d = document.createElement('div');
      d.className = 'pol';
      d.innerHTML = '<div class="n"><b></b><small></small></div><button class="tl" data-a="o">Otevřít</button><button class="tl" data-a="s" title="Smazat">🗑</button>';
      d.querySelector('b').textContent = p.nazev || '(bez názvu)';
      d.querySelector('small').textContent = (V.PREDLOHY[p.typ] ? V.PREDLOHY[p.typ].nazev + ' · ' : '') + (p.upraveno ? new Date(p.upraveno).toLocaleString('cs') : '') + (p.id === projekt.id ? ' · otevřený' : '');
      d.querySelector('[data-a="o"]').onclick = async () => { await uloz(true); await otevri(p); zavriModal('projektyBg'); };
      d.querySelector('[data-a="s"]').onclick = async () => {
        if (!(await dlg().potvrd('Smazat projekt „' + (p.nazev || '') + '“?', { ok: 'Smazat' }))) return;
        await DB.smaz('projekty', p.id);
        if (p.id === projekt.id) await novy('vstupenka');
        zobrazProjekty();
      };
      box.appendChild(d);
    }
    otevriModal('projektyBg');
  }
  function zobrazPredlohy() {
    const box = $('predlohyMrizka');
    box.innerHTML = '';
    for (const [k, p] of Object.entries(V.PREDLOHY)) {
      const b = document.createElement('button');
      b.className = 'tl';
      b.innerHTML = '<b></b><br><small class="pozn"></small>';
      b.querySelector('b').textContent = p.nazev;
      b.querySelector('small').textContent = p.rozmer.w + ' × ' + p.rozmer.h + ' mm' + (p.ustrizek.strana !== 'zadny' ? ', ústřižek ' + p.ustrizek.strana : '') + (p.sedadla.zapnuto ? ', sedadla' : '') + (p.cislovani.rezim === 'nahodne' ? ', náhodné kódy' : ', číselná řada');
      b.onclick = async () => { await uloz(true); await novy(k); zavriModal('predlohyBg'); };
      box.appendChild(b);
    }
    otevriModal('predlohyBg');
  }
  async function importJson(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { return dlg().chyba('Soubor není platný JSON.'); }
    if (o && o.rozmer && o.prvky) {
      o.id = novyId();
      await uloz(true);
      await otevri(o);
      dlg().info('Projekt „' + (o.nazev || '') + '“ načten.');
    } else dlg().chyba('Tohle není projekt Vstupenek.');
  }

  // ---------- výstupy ----------
  function prubeh(text, hodnota) {
    let p = document.querySelector('.prubeh');
    if (hodnota == null) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.className = 'prubeh'; p.innerHTML = '<div></div><progress max="1"></progress>'; document.body.appendChild(p); }
    p.firstChild.textContent = text;
    p.lastChild.value = hodnota;
  }
  const chvilka = () => new Promise(r => setTimeout(r, 0));
  function kontrolaVystupu() {
    if (serie.chyba) { dlg().chyba(serie.chyba); return null; }
    const r = rozlozeni();
    if (!r.naArch) { dlg().chyba('Kus se na arch nevejde.'); return null; }
    const tisk = kusyKTisku();
    if (!tisk.length) { dlg().chyba('Žádné kusy k tisku – zkontroluj rozsah „Tisk od–do“.'); return null; }
    return { r, tisk };
  }
  let jspdfSlib = null;
  function nactiJspdf() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    if (!jspdfSlib) jspdfSlib = new Promise((hotovo, chyba) => {
      const s = document.createElement('script');
      s.src = 'lib/jspdf.umd.min.js';
      s.onload = () => hotovo(window.jspdf);
      s.onerror = () => { jspdfSlib = null; chyba(new Error('Knihovnu PDF se nepodařilo načíst.')); };
      document.head.appendChild(s);
    });
    return jspdfSlib;
  }
  async function pdf(jenVratit) {
    const v = kontrolaVystupu();
    if (!v) return;
    const { r, tisk } = v;
    const dpi = +projekt.arch.dpi || 300;
    try {
      const { jsPDF } = await nactiJspdf();
      await K.nactiObrazky(projekt);
      const doc = new jsPDF({ unit: 'mm', format: [r.archW, r.archH], orientation: r.archW > r.archH ? 'landscape' : 'portrait', compress: true });
      doc.setProperties({ title: projekt.nazev || 'Vstupenky', creator: 'Vstupenky – lavionus.github.io/site' });
      const znacky = projekt.arch.znacky ? V.orezoveZnacky(r) : [];
      const listu = Math.ceil(tisk.length / r.naArch);
      for (let l = 0; l < listu; l++) {
        if (l) doc.addPage([r.archW, r.archH], r.archW > r.archH ? 'landscape' : 'portrait');
        const naListu = tisk.slice(l * r.naArch, (l + 1) * r.naArch);
        for (let i = 0; i < naListu.length; i++) {
          const c = K.kusNaPlatno(projekt, naListu[i], dpi, r.otocit);
          doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', r.pozice[i].x, r.pozice[i].y, r.w, r.h, undefined, 'FAST');
          c.width = c.height = 0;
          if (i % 4 === 0) { prubeh('PDF: arch ' + (l + 1) + ' z ' + listu, (l * r.naArch + i) / tisk.length); await chvilka(); }
          if (projekt.arch.obrys) { doc.setDrawColor(160); doc.setLineWidth(0.1); doc.rect(r.pozice[i].x, r.pozice[i].y, r.w, r.h); }
        }
        if (znacky.length) {
          doc.setDrawColor(0); doc.setLineWidth(0.2);
          for (const z of znacky) doc.line(z.x1, z.y1, z.x2, z.y2);
        }
      }
      prubeh();
      if (jenVratit) return doc;
      doc.save(souborNazev() + '.pdf');
      dlg().info('PDF uloženo: ' + tisk.length + ' ks na ' + listu + ' arších.');
    } catch (e) { prubeh(); dlg().chyba('PDF se nepodařilo vytvořit: ' + e.message); }
  }
  async function tiskni() {
    const v = kontrolaVystupu();
    if (!v) return;
    const { r, tisk } = v;
    const dpi = Math.min(300, +projekt.arch.dpi || 300);
    await K.nactiObrazky(projekt);
    const cil = $('tisk');
    cil.innerHTML = '';
    let styl = $('stylTisku');
    if (!styl) { styl = document.createElement('style'); styl.id = 'stylTisku'; document.head.appendChild(styl); }
    styl.textContent = `@page{size:${r.archW}mm ${r.archH}mm;margin:0}`;
    const url = [];
    const listu = Math.ceil(tisk.length / r.naArch);
    const znacky = projekt.arch.znacky ? V.orezoveZnacky(r) : [];
    for (let l = 0; l < listu; l++) {
      const d = document.createElement('div');
      d.className = 'list';
      d.style.cssText = `width:${r.archW}mm;height:${r.archH}mm`;
      const naListu = tisk.slice(l * r.naArch, (l + 1) * r.naArch);
      for (let i = 0; i < naListu.length; i++) {
        const c = K.kusNaPlatno(projekt, naListu[i], dpi, r.otocit);
        const blob = await new Promise(h => c.toBlob(h, 'image/jpeg', 0.92));
        c.width = c.height = 0;
        const u = URL.createObjectURL(blob); url.push(u);
        const img = new Image();
        img.src = u;
        img.style.cssText = `left:${r.pozice[i].x}mm;top:${r.pozice[i].y}mm;width:${r.w}mm;height:${r.h}mm` + (projekt.arch.obrys ? ';outline:0.1mm solid #999' : '');
        d.appendChild(img);
        if (i % 4 === 0) { prubeh('Příprava tisku: arch ' + (l + 1) + ' z ' + listu, (l * r.naArch + i) / tisk.length); await chvilka(); }
      }
      for (const z of znacky) {
        const s = document.createElement('div');
        s.className = 'znacka';
        const svisla = z.x1 === z.x2;
        s.style.cssText = svisla
          ? `left:${z.x1 - 0.1}mm;top:${Math.min(z.y1, z.y2)}mm;width:0.2mm;height:${Math.abs(z.y2 - z.y1)}mm`
          : `top:${z.y1 - 0.1}mm;left:${Math.min(z.x1, z.x2)}mm;height:0.2mm;width:${Math.abs(z.x2 - z.x1)}mm`;
        d.appendChild(s);
      }
      cil.appendChild(d);
    }
    await Promise.all([...cil.querySelectorAll('img')].map(i => i.decode().catch(() => {})));
    prubeh();
    const uklid = () => { cil.innerHTML = ''; url.forEach(u => URL.revokeObjectURL(u)); removeEventListener('afterprint', uklid); };
    addEventListener('afterprint', uklid);
    window.print();
  }
  function csv() {
    if (serie.chyba || !serie.kusy.length) return dlg().chyba(serie.chyba || 'Série je prázdná.');
    stahni(souborNazev() + '-kody.csv', '﻿' + V.csvVydanych(serie.kusy), 'text/csv;charset=utf-8');
  }
  function png() {
    const kus = serie.kusy[index];
    if (!kus) return;
    const c = K.kusNaPlatno(projekt, kus, 300, false);
    c.toBlob(b => stahni(souborNazev() + '-' + V.normalizuj(kus.kod) + '.png', b), 'image/png');
  }
  async function noveKody() {
    if (projekt.cislovani.rezim !== 'nahodne') return dlg().info('Nové kódy mají smysl jen u náhodných kódů.');
    if (!(await dlg().potvrd('Vygenerovat úplně jiné kódy? Už vytištěné nebo rozeslané vstupenky by pak neodpovídaly CSV seznamu.', { ok: 'Vygenerovat' }))) return;
    projekt.cislovani.seminko = V.nahodneSeminko();
    zmena();
  }
  async function doKontroly() {
    if (serie.chyba || !serie.kusy.length) return dlg().chyba(serie.chyba || 'Série je prázdná.');
    const seznam = {
      id: 's' + Date.now().toString(36),
      nazev: (projekt.nazev || 'Série') + ' (' + serie.kusy.length + ' ks)',
      kody: serie.kusy.map(k => k.kod),
      info: Object.fromEntries(serie.kusy.filter(k => k.sedadlo).map(k => [V.normalizuj(k.kod), [k.sedadlo.sektor, 'řada ' + k.sedadlo.rada, 'místo ' + k.sedadlo.misto].filter(Boolean).join(', ')])),
      pouzite: {}, log: [], nastaveni: Object.assign({}, projekt.cislovani), vytvoreno: new Date().toISOString(),
    };
    await DB.uloz('seznamy', seznam);
    rezim('kontrola');
    window.VSTUP_KONTROLA && window.VSTUP_KONTROLA.aktivuj(seznam.id);
    dlg().info('Seznam ' + seznam.kody.length + ' kódů je připravený ke kontrole.');
  }

  // ---------- modální okna, nabídky, režim ----------
  function otevriModal(id) { zavriNabidky(); $(id).hidden = false; }
  function zavriModal(id) { $(id).hidden = true; }
  document.querySelectorAll('.modal-bg').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-zavrit]')) m.hidden = true; });
  });
  function rezim(r) {
    const k = r === 'kontrola';
    $('navrh').hidden = k; $('kontrola').hidden = !k;
    $('rezNavrh').setAttribute('aria-pressed', String(!k)); $('rezKontrola').setAttribute('aria-pressed', String(k));
    lsPis('rezim', r);
    if (k) window.VSTUP_KONTROLA && window.VSTUP_KONTROLA.zobraz();
    else { window.VSTUP_KONTROLA && window.VSTUP_KONTROLA.zastavKameru(); vykresli(); }
  }
  const PRIKAZY = {
    predlohy: zobrazPredlohy,
    ulozit: () => uloz(false),
    ulozitJako: async () => {
      const n = await dlg().zeptej('Název kopie:', (projekt.nazev || '') + ' – kopie');
      if (n == null) return;
      await uloz(true);
      const p = JSON.parse(JSON.stringify(projekt));
      p.id = novyId(); p.nazev = n;
      await otevri(p); await uloz(false);
    },
    projekty: zobrazProjekty,
    exportJson: () => stahni(souborNazev() + '.vstupenky.json', JSON.stringify(projekt, null, 1), 'application/json'),
    importJson: () => $('souborJson').click(),
    pdf: () => pdf(),
    tisk: tiskni,
    csv, png, noveKody, doKontroly,
    rezimNavrh: () => rezim('navrh'),
    rezimKontrola: () => rezim('kontrola'),
    napoveda: () => otevriModal('napovedaBg'),
    predchozi: () => { if (index > 0) { index--; vykresliInfo(); vykresliKus(); } },
    dalsi: () => { if (index < serie.kusy.length - 1) { index++; vykresliInfo(); vykresliKus(); } },
    archPred: () => { if (list > 0) { list--; vykresliArch(); } },
    archDal: () => { list++; vykresliArch(); },
  };
  function prikaz(id) { zavriNabidky(); const p = PRIKAZY[id]; if (p) p(); }
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
    if (b && !b.disabled) { e.stopPropagation(); return prikaz(b.dataset.prikaz); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', () => { zavriNabidky(); if (!$('navrh').hidden) { clearTimeout(casovacKresleni); casovacKresleni = setTimeout(vykresli, 100); } });
  $('cisloKusu').addEventListener('change', e => { index = Math.max(0, Math.min(serie.kusy.length - 1, (+e.target.value || 1) - 1)); vykresliInfo(); vykresliKus(); });
  $('souborJson').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importJson(await f.text()); };

  document.addEventListener('keydown', e => {
    const vPoli = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); return prikaz('ulozit'); }
    if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); return prikaz('projekty'); }
    if (mod && e.key.toLowerCase() === 'p' && !$('navrh').hidden) { e.preventDefault(); return prikaz('tisk'); }
    if (e.key === 'F1') { e.preventDefault(); return prikaz('napoveda'); }
    if (e.key === 'F2') { e.preventDefault(); return prikaz('rezimNavrh'); }
    if (e.key === 'F3') { e.preventDefault(); return prikaz('rezimKontrola'); }
    if (e.key === 'Escape') { zavriNabidky(); document.querySelectorAll('.modal-bg:not([hidden])').forEach(m => { m.hidden = true; }); }
    if (vPoli || mod || $('navrh').hidden) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); prikaz('predchozi'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); prikaz('dalsi'); }
  });

  // drag & drop souborů
  document.addEventListener('dragover', e => { e.preventDefault(); });
  document.addEventListener('drop', async e => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    if (/\.json$/i.test(f.name)) return importJson(await f.text());
    if (/\.(csv|txt)$/i.test(f.name)) { rezim('kontrola'); return window.VSTUP_KONTROLA.importCsv(f); }
    if (/^image\//.test(f.type)) {
      const logo = await dlg().potvrd('Použít obrázek „' + f.name + '“ jako logo, nebo jako pozadí?', { ok: 'Logo', zrus: 'Pozadí' });
      return nactiObrazek(f, logo ? 'logo' : 'pozadi');
    }
    dlg().chyba('Neznámý typ souboru: ' + f.name);
  });

  // ---------- start ----------
  if (window.self === window.top) document.body.classList.add('samostatne');
  naplnSelecty();
  window.VSTUP_APP = { DB, stahni, rezim, projekt: () => projekt, serie: () => serie, pdf, novy, otevri, dlg };
  (async () => {
    let p = null;
    const id = lsCti('posledni');
    try { if (id) p = await DB.nacti('projekty', id); } catch (_) { /* IndexedDB nedostupná */ }
    if (p) await otevri(p); else await novy('vstupenka');
    if (lsCti('rezim') === 'kontrola') rezim('kontrola');
  })();
})();
